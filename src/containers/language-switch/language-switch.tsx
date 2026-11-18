import { useLocation } from '@tanstack/react-router';
import { Fragment } from 'react';

import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages';
import { getLocale, localizeHref, locales } from '@/paraglide/runtime';
import type { Locale } from '@/paraglide/runtime';

const LANGUAGE_NAMES: Record<Locale, string> = {
  en: 'English',
  es: 'Español',
  pt: 'Português',
};

function getLinkClassName(isCurrent: boolean): string {
  return isCurrent ? 'text-foreground' : 'text-muted hover:text-foreground';
}

export function LanguageSwitch() {
  const { href } = useLocation();
  const currentLocale = getLocale();

  return (
    <nav
      aria-label={m.language_switch_label()}
      className="pointer-events-auto flex items-center gap-1.5 text-label text-muted uppercase"
    >
      {locales.map((locale, index) => (
        <Fragment key={locale}>
          {index > 0 && <span aria-hidden="true">/</span>}
          <a
            href={localizeHref(href, { locale })}
            hrefLang={locale}
            lang={locale}
            aria-current={locale === currentLocale ? 'page' : undefined}
            className={cn(
              'inline-flex min-h-6 items-center transition-colors',
              getLinkClassName(locale === currentLocale),
            )}
          >
            <span aria-hidden="true">{locale}</span>
            <span className="sr-only">{LANGUAGE_NAMES[locale]}</span>
          </a>
        </Fragment>
      ))}
    </nav>
  );
}
