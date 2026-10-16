import { MonitorIcon, MoonIcon, SunIcon } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useId } from 'react';

import { useThemePreference } from '@/hooks/use-theme';
import { THEME_PREFERENCES, applyThemePreference, getThemePreference } from '@/lib/theme/theme';
import type { ThemePreference } from '@/lib/theme/theme';
import { m } from '@/paraglide/messages';

const THEME_ICONS: Record<ThemePreference, LucideIcon> = {
  system: MonitorIcon,
  light: SunIcon,
  dark: MoonIcon,
};

const THEME_LABELS: Record<ThemePreference, () => string> = {
  system: m.theme_system,
  light: m.theme_light,
  dark: m.theme_dark,
};

export function ThemeSwitch() {
  const current = useThemePreference();
  const name = useId();

  return (
    <fieldset className="m-0 inline-flex rounded-sm border border-line-strong bg-surface p-0.5">
      <legend className="sr-only">{m.theme_switch_label()}</legend>
      {THEME_PREFERENCES.map((preference) => {
        const Icon = THEME_ICONS[preference];
        const label = THEME_LABELS[preference]();
        return (
          <label
            key={preference}
            title={label}
            className="relative inline-flex size-7 cursor-pointer items-center justify-center rounded-xs text-muted transition-colors duration-150 after:absolute after:inset-x-0 after:-inset-y-2 hover:text-fg has-checked:bg-fg has-checked:text-canvas has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-fg"
          >
            <input
              type="radio"
              name={name}
              value={preference}
              checked={preference === current}
              onChange={(event) => applyThemePreference(getThemePreference(event.target.value))}
              className="sr-only"
            />
            <Icon aria-hidden="true" className="size-3.5" />
            <span className="sr-only">{label}</span>
          </label>
        );
      })}
    </fieldset>
  );
}
