import { useLocation } from '@tanstack/react-router';

import { m } from '@/paraglide/messages';
import { getLocale, localizeHref, locales } from '@/paraglide/runtime';

function getLinkClassName(isCurrent: boolean): string {
  return isCurrent ? 'text-paper' : 'text-muted hover:text-paper';
}

export function LanguageSwitch() {
  const { href } = useLocation();
  const currentLocale = getLocale();

  return (
    <nav aria-label={m.language_switch_label()} className="flex gap-2 text-xs font-medium">
      {locales.map((locale) => (
        <a
          key={locale}
          href={localizeHref(href, { locale })}
          hrefLang={locale}
          aria-current={locale === currentLocale ? 'true' : undefined}
          className={getLinkClassName(locale === currentLocale)}
        >
          {locale.toUpperCase()}
        </a>
      ))}
    </nav>
  );
}
