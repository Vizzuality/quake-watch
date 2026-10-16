export const THEME_PREFERENCES = ['system', 'light', 'dark'] as const;

export type ThemePreference = (typeof THEME_PREFERENCES)[number];
export type ResolvedTheme = Exclude<ThemePreference, 'system'>;

export const THEME_CANVAS_COLORS: Record<ResolvedTheme, string> = {
  light: '#f3f4f6',
  dark: '#0e1116',
};

export const THEME_STORAGE_KEY = 'quake-watch-theme';
export const RESOLVED_THEME_ATTRIBUTE = 'data-resolved-theme';
const DARK_QUERY = '(prefers-color-scheme: dark)';

export function getThemePreference(stored: string | null): ThemePreference {
  return THEME_PREFERENCES.find((preference) => preference === stored) ?? 'system';
}

export function getResolvedTheme(preference: ThemePreference, prefersDark: boolean): ResolvedTheme {
  if (preference !== 'system') return preference;
  return prefersDark ? 'dark' : 'light';
}

function writeStoredPreference(preference: ThemePreference) {
  try {
    if (preference === 'system') window.localStorage.removeItem(THEME_STORAGE_KEY);
    else window.localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // Storage blocked (private mode): the choice still applies for this page view.
  }
}

export function getCurrentThemePreference(): ThemePreference {
  return getThemePreference(document.documentElement.getAttribute('data-theme'));
}

export function getCurrentResolvedTheme(): ResolvedTheme {
  return document.documentElement.getAttribute(RESOLVED_THEME_ATTRIBUTE) === 'light'
    ? 'light'
    : 'dark';
}

function setThemeColorMeta(theme: ResolvedTheme) {
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', THEME_CANVAS_COLORS[theme]);
}

export function applyThemePreference(preference: ThemePreference) {
  const root = document.documentElement;
  const resolved = getResolvedTheme(preference, window.matchMedia(DARK_QUERY).matches);
  writeStoredPreference(preference);
  if (preference === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', preference);
  root.setAttribute(RESOLVED_THEME_ATTRIBUTE, resolved);
  setThemeColorMeta(resolved);
}

export function subscribeToTheme(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributeFilter: ['data-theme', RESOLVED_THEME_ATTRIBUTE],
  });
  return () => observer.disconnect();
}

export const THEME_BOOT_SCRIPT = `(function () {
  var root = document.documentElement;
  var query = window.matchMedia('${DARK_QUERY}');
  function read() {
    try { return localStorage.getItem('${THEME_STORAGE_KEY}'); } catch (e) { return null; }
  }
  var meta = document.createElement('meta');
  meta.name = 'theme-color';
  document.head.appendChild(meta);
  var colors = ${JSON.stringify(THEME_CANVAS_COLORS)};
  function apply() {
    var stored = read();
    var explicit = stored === 'light' || stored === 'dark' ? stored : null;
    var resolved = explicit || (query.matches ? 'dark' : 'light');
    if (explicit) root.setAttribute('data-theme', explicit); else root.removeAttribute('data-theme');
    root.setAttribute('${RESOLVED_THEME_ATTRIBUTE}', resolved);
    meta.content = colors[resolved];
  }
  apply();
  query.addEventListener('change', apply);
})();`;
