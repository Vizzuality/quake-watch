import { useLocation } from '@tanstack/react-router';

import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages';
import { getLocale, localizeHref, locales } from '@/paraglide/runtime';

function getLinkClassName(isCurrent: boolean): string {
  return isCurrent ? 'text-fg' : 'text-muted hover:text-fg';
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
          className={cn(
            'inline-flex min-h-6 min-w-6 items-center justify-center rounded-xs focus-visible:outline-2 focus-visible:outline-fg',
            getLinkClassName(locale === currentLocale),
          )}
        >
          {locale.toUpperCase()}
        </a>
      ))}
    </nav>
  );
}
