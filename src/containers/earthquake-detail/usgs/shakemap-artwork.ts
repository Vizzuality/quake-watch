import {
  type CanvasPoint,
  type CanvasSize,
  getContourPaths,
  getShakemapCanvasSize,
  getSurfacePixels,
} from '@/lib/shakemap/canvas';
import type { ShakemapContour } from '@/lib/shakemap/contours';
import type { ShakemapGrid } from '@/lib/shakemap/coverage';

const ARTWORK_LONG_SIDE_PX = 1280;
const CONTOUR_WIDTH_PX = 3;
const CONTOUR_HALO_WIDTH_PX = 5;
const CONTOUR_HALO_COLOR = 'rgba(11, 13, 16, 0.4)';
const EDGE_FADE_RATIO = 0.07;
const EDGE_MASK_COLOR = '#000000';
const EDGE_CLEAR_COLOR = 'rgba(0, 0, 0, 0)';

export function getCanvas({ width, height }: CanvasSize): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function tracePath(context: CanvasRenderingContext2D, points: readonly CanvasPoint[]) {
  const [first, ...rest] = points;
  if (!first) return;
  context.moveTo(first[0], first[1]);
  for (const [x, y] of rest) context.lineTo(x, y);
}

function fadeEdges(context: CanvasRenderingContext2D, { width, height }: CanvasSize) {
  const gradients = [
    context.createLinearGradient(0, 0, width, 0),
    context.createLinearGradient(0, 0, 0, height),
  ];
  context.save();
  context.globalCompositeOperation = 'destination-in';
  for (const gradient of gradients) {
    gradient.addColorStop(0, EDGE_CLEAR_COLOR);
    gradient.addColorStop(EDGE_FADE_RATIO, EDGE_MASK_COLOR);
    gradient.addColorStop(1 - EDGE_FADE_RATIO, EDGE_MASK_COLOR);
    gradient.addColorStop(1, EDGE_CLEAR_COLOR);
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);
  }
  context.restore();
}

function getSurfaceCanvas(grid: ShakemapGrid): HTMLCanvasElement {
  const size = getShakemapCanvasSize(grid, Math.max(grid.columns, grid.rows));
  const canvas = getCanvas(size);
  canvas
    .getContext('2d')
    ?.putImageData(new ImageData(getSurfacePixels(grid, size), size.width, size.height), 0, 0);
  return canvas;
}

export function getShakemapArtwork(
  grid: ShakemapGrid,
  contours: readonly ShakemapContour[],
): HTMLCanvasElement {
  const size = getShakemapCanvasSize(grid, ARTWORK_LONG_SIDE_PX);
  const artwork = getCanvas(size);
  const context = artwork.getContext('2d');
  if (!context) return artwork;
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(getSurfaceCanvas(grid), 0, 0, size.width, size.height);

  const paths = getContourPaths(grid, size, contours);
  context.lineJoin = 'round';
  context.lineCap = 'round';
  context.lineWidth = CONTOUR_HALO_WIDTH_PX;
  context.strokeStyle = CONTOUR_HALO_COLOR;
  context.beginPath();
  for (const path of paths) for (const line of path.lines) tracePath(context, line);
  context.stroke();
  context.lineWidth = CONTOUR_WIDTH_PX;
  for (const path of paths) {
    context.strokeStyle = path.color;
    context.beginPath();
    for (const line of path.lines) tracePath(context, line);
    context.stroke();
  }
  fadeEdges(context, size);
  return artwork;
}

export function drawReveal(
  target: HTMLCanvasElement,
  artwork: HTMLCanvasElement,
  outline: readonly CanvasPoint[] | null,
) {
  const context = target.getContext('2d');
  if (!context) return;
  context.clearRect(0, 0, target.width, target.height);
  if (!outline) {
    context.drawImage(artwork, 0, 0);
    return;
  }
  context.save();
  context.beginPath();
  tracePath(context, outline);
  context.closePath();
  context.clip();
  context.drawImage(artwork, 0, 0);
  context.restore();
}
