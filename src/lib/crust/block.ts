import { EARTH_RADIUS_KM, getRadians } from '@/lib/earthquakes/distance';

import { CRUST_LAYER_KINDS, type CrustCell, type CrustLayerKind } from './types';

export type CrustLayer = { kind: CrustLayerKind; topKm: number; bottomKm: number };

export type DeepBoundary = { kind: 'transition-zone-top' | 'lower-mantle-top'; depthKm: number };

// https://github.com/obspy/obspy/blob/1.4.1/obspy/taup/data/prem.nd
export const PREM_BOUNDARIES_KM = { transitionZoneTop: 400, lowerMantleTop: 670 } as const;

export const RELIEF_EXAGGERATION = 10;

export const MIN_BLOCK_DEPTH_KM = 60;

const MOHO_MARGIN_KM = 20;
const DEPTH_MARGIN_FACTOR = 1.4;
const MAX_RADIUS_CELLS = 6;
export const KM_PER_DEGREE = (EARTH_RADIUS_KM * Math.PI) / 180;
const MOHO_BOUNDARY_INDEX = CRUST_LAYER_KINDS.length;

function getDepthKm(elevationKm: number): number {
  return 0 - elevationKm;
}

function getClamped(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function getCrustLayers(cell: CrustCell): CrustLayer[] {
  const depths = cell.boundaryElevationsKm.map(getDepthKm);
  return CRUST_LAYER_KINDS.map((kind, index) => ({
    kind,
    topKm: depths[index],
    bottomKm: depths[index + 1],
  })).filter((layer) => layer.bottomKm > layer.topKm);
}

export function getMohoDepthKm(cell: CrustCell): number {
  return getDepthKm(cell.boundaryElevationsKm[MOHO_BOUNDARY_INDEX]);
}

export function getBlockDepthKm(depthKm: number, mohoDepthKm: number): number {
  return Math.max(
    Math.max(depthKm, 0) * DEPTH_MARGIN_FACTOR,
    mohoDepthKm + MOHO_MARGIN_KM,
    MIN_BLOCK_DEPTH_KM,
  );
}

export function getRuptureStartDepthKm(depthKm: number, blockDepthKm: number): number {
  return getClamped(depthKm, 0, blockDepthKm);
}

export function getDeepBoundariesKm(blockDepthKm: number): DeepBoundary[] {
  const boundaries: DeepBoundary[] = [
    { kind: 'transition-zone-top', depthKm: PREM_BOUNDARIES_KM.transitionZoneTop },
    { kind: 'lower-mantle-top', depthKm: PREM_BOUNDARIES_KM.lowerMantleTop },
  ];
  return boundaries.filter((boundary) => boundary.depthKm < blockDepthKm);
}

export function getBlockSideKm(blockDepthKm: number): number {
  return blockDepthKm;
}

export function getBlockRadiusCells(blockSideKm: number, latitude: number): number {
  const halfSideKm = blockSideKm / 2;
  const latitudeCells = Math.ceil(halfSideKm / KM_PER_DEGREE);
  const longitudeCells = Math.ceil(halfSideKm / (KM_PER_DEGREE * Math.cos(getRadians(latitude))));
  return getClamped(Math.max(latitudeCells, longitudeCells), 0, MAX_RADIUS_CELLS);
}
