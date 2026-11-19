import { type KeyboardEvent, type MouseEvent, useId, useRef } from 'react';

import { m } from '@/paraglide/messages';

type DataSource = { name: string; href: string; description: () => string };

const DATA_SOURCES: DataSource[] = [
  {
    name: 'USGS Earthquake Hazards Program',
    href: 'https://earthquake.usgs.gov/earthquakes/feed/',
    description: m.about_source_usgs,
  },
  {
    name: 'EMSC Seismic Portal',
    href: 'https://www.seismicportal.eu/',
    description: m.about_source_emsc,
  },
  {
    name: 'Natural Earth',
    href: 'https://www.naturalearthdata.com/',
    description: m.about_source_natural_earth,
  },
  {
    name: 'OpenStreetMap',
    href: 'https://www.openstreetmap.org/copyright',
    description: m.about_source_osm,
  },
  { name: 'Photon', href: 'https://photon.komoot.io/', description: m.about_source_photon },
  {
    name: 'ETOPO1 · GMTED2010',
    href: 'https://github.com/tilezen/joerd/blob/master/docs/attribution.md',
    description: m.about_source_relief,
  },
  {
    name: 'CRUST1.0',
    href: 'https://igppweb.ucsd.edu/~gabi/crust1.html',
    description: m.about_source_crust,
  },
  {
    name: 'USGS Slab2',
    href: 'https://doi.org/10.5066/F7PV6JNV',
    description: m.about_source_slab,
  },
];

const LINK_CLASS_NAME = 'text-foreground underline hover:text-accent';

function getWrappedFocusTarget(dialog: HTMLElement, isBackward: boolean): HTMLElement | null {
  const focusable = [...dialog.querySelectorAll<HTMLElement>('a[href], button:not([disabled])')];
  const first = focusable.at(0);
  const last = focusable.at(-1);
  if (isBackward && document.activeElement === first) return last ?? null;
  if (!isBackward && document.activeElement === last) return first ?? null;
  return null;
}

function CloseIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 15 15" fill="currentColor" className="size-[15px]">
      <path d="M11.9672 11.4703C12.0017 11.5025 12.0294 11.5413 12.0486 11.5844C12.0679 11.6276 12.0782 11.6741 12.079 11.7213C12.0799 11.7685 12.0712 11.8154 12.0535 11.8592C12.0358 11.903 12.0095 11.9427 11.9761 11.9761C11.9427 12.0095 11.903 12.0358 11.8592 12.0535C11.8154 12.0712 11.7685 12.0799 11.7213 12.079C11.6741 12.0782 11.6276 12.0679 11.5844 12.0486C11.5413 12.0294 11.5025 12.0017 11.4703 11.9672L7.5 7.99746L3.52969 11.9672C3.46304 12.0293 3.3749 12.0631 3.28382 12.0615C3.19274 12.0599 3.10584 12.023 3.04143 11.9586C2.97701 11.8942 2.94012 11.8073 2.93851 11.7162C2.9369 11.6251 2.97071 11.537 3.03281 11.4703L7.00254 7.5L3.03281 3.52969C2.97071 3.46304 2.9369 3.3749 2.93851 3.28382C2.94012 3.19274 2.97701 3.10584 3.04143 3.04143C3.10584 2.97701 3.19274 2.94012 3.28382 2.93851C3.3749 2.9369 3.46304 2.97071 3.52969 3.03281L7.5 7.00254L11.4703 3.03281C11.537 2.97071 11.6251 2.9369 11.7162 2.93851C11.8073 2.94012 11.8942 2.97701 11.9586 3.04143C12.023 3.10584 12.0599 3.19274 12.0615 3.28382C12.0631 3.3749 12.0293 3.46304 11.9672 3.52969L7.99746 7.5L11.9672 11.4703Z" />
    </svg>
  );
}

function AboutColumn({ heading, body }: { heading: string; body: string }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-2">
      <h3 className="text-caption text-foreground uppercase">{heading}</h3>
      <p className="text-body-s text-muted">{body}</p>
    </div>
  );
}

export function AboutDialog() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();

  function open() {
    dialogRef.current?.showModal();
    closeRef.current?.focus();
  }

  function close() {
    dialogRef.current?.close();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key === 'Tab') {
      const target = getWrappedFocusTarget(event.currentTarget, event.shiftKey);
      if (!target) return;
      event.preventDefault();
      target.focus();
      return;
    }
    if (event.key !== 'Escape') return;
    event.preventDefault();
    close();
  }

  function handleClick(event: MouseEvent<HTMLDialogElement>) {
    if (event.target === event.currentTarget) close();
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={open}
        className="pointer-events-auto cursor-pointer py-1 text-button text-muted uppercase transition-colors hover:text-foreground"
      >
        {m.about_link()}
      </button>
      {/* oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- a modal dialog owns Escape, the Tab wrap and the scrim click */}
      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        onKeyDown={handleKeyDown}
        onClick={handleClick}
        onClose={() => triggerRef.current?.focus()}
        className="pointer-events-auto mx-auto mt-[5.33dvh] max-h-[90dvh] w-[calc(100%-32px)] max-w-none overflow-y-auto rounded-modal border border-line-sheet bg-glass-modal text-foreground backdrop-blur-[100px] backdrop:bg-scrim backdrop:backdrop-blur-[6px] md:m-auto md:max-h-[calc(100%-2em-6px)] md:w-[620px] md:max-w-[calc(100%-32px)] md:backdrop-blur-[50px] md:backdrop:backdrop-blur-[3px]"
      >
        <div className="flex flex-col gap-5.5 px-5.5 py-7 md:px-10 md:py-9">
          <div className="flex items-start">
            <div className="flex min-w-0 flex-1 flex-col gap-2 pr-10 md:pr-0">
              <p className="text-caption text-accent uppercase">{m.about_link()}</p>
              <h2 id={titleId} className="text-title-m">
                {m.app_title()}
              </h2>
            </div>
            <button
              ref={closeRef}
              type="button"
              aria-label={m.about_close()}
              onClick={close}
              className="absolute top-[17px] right-[17px] flex size-control shrink-0 cursor-pointer items-center justify-center rounded-full border border-line-control transition-colors before:absolute before:-inset-[6px] hover:border-muted md:static md:before:hidden"
            >
              <CloseIcon />
            </button>
          </div>
          <p className="text-body">{m.about_lead()}</p>
          <div className="flex flex-col gap-5.5 sm:flex-row sm:gap-7">
            <AboutColumn heading={m.about_see_heading()} body={m.about_see_body()} />
            <AboutColumn heading={m.about_read_heading()} body={m.about_read_body()} />
          </div>
          <div className="flex flex-col gap-2">
            <h3 className="text-caption text-foreground uppercase">{m.about_sources_heading()}</h3>
            <ul className="flex flex-col gap-2">
              {DATA_SOURCES.map(({ name, href, description }) => (
                <li key={name} className="text-body-s text-muted">
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={LINK_CLASS_NAME}
                  >
                    {name}
                  </a>
                  {` · ${description()}`}
                </li>
              ))}
            </ul>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4.5 text-muted">
            <p className="text-body-s">
              {m.about_credit()}{' '}
              <a
                href="https://www.vizzuality.com/"
                target="_blank"
                rel="noopener noreferrer"
                className={LINK_CLASS_NAME}
              >
                Vizzuality
              </a>
            </p>
            <p className="text-caption uppercase">{m.about_year()}</p>
          </div>
        </div>
      </dialog>
    </>
  );
}
