import type { CSSProperties, ReactElement } from 'react';

import { usePhoneLayout } from '@/hooks/use-phone-layout';
import type { PhoneLayout } from '@/lib/layout/phone';
import { getPhoneZoomButtonsRight, getPhoneZoomButtonsTop } from '@/lib/layout/phone-detail';
import { m } from '@/paraglide/messages';

const BUTTON_CLASS_NAME =
  'glass-panel relative flex size-control cursor-pointer items-center justify-center rounded-full border border-line-control text-foreground transition-colors before:absolute before:-inset-[5px] hover:border-muted';

type ZoomButtonsProps = {
  isDetail: boolean;
  onZoom: (direction: 1 | -1) => void;
};

function getZoomButtonsStyle(layout: PhoneLayout | null, isDetail: boolean): CSSProperties {
  if (!layout) return {};
  return {
    '--zoom-buttons-top': `${getPhoneZoomButtonsTop(layout, isDetail)}px`,
    '--zoom-buttons-right': `${getPhoneZoomButtonsRight(layout, isDetail)}px`,
  } as CSSProperties;
}

function getZoomButtonsPlacement(isDetail: boolean): string {
  return isDetail ? 'flex-row md:right-14 md:bottom-[414px]' : 'flex-col md:right-4 md:bottom-30';
}

function ZoomIcon({ isIn }: { isIn: boolean }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" fill="none" className="size-[15px]">
      <path d="M2.5 8h11" stroke="currentColor" strokeLinecap="round" />
      {isIn && <path d="M8 2.5v11" stroke="currentColor" strokeLinecap="round" />}
    </svg>
  );
}

export default function ZoomButtons({ isDetail, onZoom }: ZoomButtonsProps): ReactElement | null {
  const layout = usePhoneLayout();

  return (
    <fieldset
      aria-label={m.globe_zoom_label()}
      style={getZoomButtonsStyle(layout, isDetail)}
      className={`absolute top-(--zoom-buttons-top) right-(--zoom-buttons-right,16px) z-[1] flex gap-2.5 md:top-auto md:flex-col ${getZoomButtonsPlacement(isDetail)}`}
    >
      <button
        type="button"
        aria-label={m.globe_zoom_in()}
        onClick={() => onZoom(1)}
        className={BUTTON_CLASS_NAME}
      >
        <ZoomIcon isIn />
      </button>
      <button
        type="button"
        aria-label={m.globe_zoom_out()}
        onClick={() => onZoom(-1)}
        className={BUTTON_CLASS_NAME}
      >
        <ZoomIcon isIn={false} />
      </button>
    </fieldset>
  );
}
