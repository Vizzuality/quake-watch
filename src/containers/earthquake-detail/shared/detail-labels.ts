import type { FaultType } from '@/lib/focal-mechanism/beachball';
import { m } from '@/paraglide/messages';

const MAGNITUDE_TYPE_EXPLANATIONS: Record<string, () => string> = {
  mww: m.detail_magtype_mww,
  mwc: m.detail_magtype_mwc,
  mwb: m.detail_magtype_mwb,
  mwr: m.detail_magtype_mwr,
  mw: m.detail_magtype_mw,
  mb: m.detail_magtype_mb,
  ml: m.detail_magtype_ml,
  md: m.detail_magtype_md,
  ms: m.detail_magtype_ms,
};

const REVIEW_STATUS_LABELS: Record<string, () => string> = {
  reviewed: m.detail_review_reviewed,
  automatic: m.detail_review_automatic,
};

export function getMagnitudeTypeExplanation(type: string): string {
  return (MAGNITUDE_TYPE_EXPLANATIONS[type.toLowerCase()] ?? m.detail_magtype_other)();
}

export function getReviewStatusLabel(status: string): string {
  return REVIEW_STATUS_LABELS[status.toLowerCase()]?.() ?? status;
}

const FAULT_TYPE_LABELS: Record<FaultType, () => string> = {
  'strike-slip': m.detail_fault_strike_slip,
  normal: m.detail_fault_normal,
  reverse: m.detail_fault_reverse,
  'oblique-normal': m.detail_fault_oblique_normal,
  'oblique-reverse': m.detail_fault_oblique_reverse,
};

const FAULT_TYPE_EXPLANATIONS: Record<FaultType, () => string> = {
  'strike-slip': m.detail_fault_strike_slip_explain,
  normal: m.detail_fault_normal_explain,
  reverse: m.detail_fault_reverse_explain,
  'oblique-normal': m.detail_fault_oblique_normal_explain,
  'oblique-reverse': m.detail_fault_oblique_reverse_explain,
};

export function getFaultTypeLabel(type: FaultType): string {
  return FAULT_TYPE_LABELS[type]();
}

export function getFaultTypeExplanation(type: FaultType): string {
  return FAULT_TYPE_EXPLANATIONS[type]();
}
