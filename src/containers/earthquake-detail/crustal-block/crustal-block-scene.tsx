import { Html } from '@react-three/drei';
import { Canvas, useThree } from '@react-three/fiber';
import {
  createContext,
  type ReactNode,
  type RefObject,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from 'react';
import { BufferAttribute, BufferGeometry, Color, DoubleSide, SRGBColorSpace } from 'three';

import {
  BLOCK_SEGMENTS,
  type BlockLabelKind,
  type BlockMeshData,
  getBlockFit,
  getBlockLabels,
  getBlockMeshData,
  getDepthTicks,
  type MeshData,
} from '@/lib/crust/scene';
import { ISOMETRIC_CAMERA } from '@/lib/crust/terrarium';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages';

import { BAND_NAMES, getDistanceLabel } from './crust-messages';
import { getBandColor, getTerrainColor, WATER_OPACITY } from './crust-palette';
import { CRUSTAL_BLOCK_HEIGHT } from './layout';
import { type CrustalBlockProps, useCrustalBlock } from './use-crustal-block';
import { useRelief } from './use-relief';

type Vector3 = [number, number, number];
type CrustalBlock = ReturnType<typeof useCrustalBlock>;

const CAMERA_DISTANCE = 1000;
const CAMERA_POSITION: Vector3 = [
  CAMERA_DISTANCE * Math.sin(ISOMETRIC_CAMERA.azimuthRad) * Math.cos(ISOMETRIC_CAMERA.elevationRad),
  CAMERA_DISTANCE * Math.sin(ISOMETRIC_CAMERA.elevationRad),
  CAMERA_DISTANCE * Math.cos(ISOMETRIC_CAMERA.azimuthRad) * Math.cos(ISOMETRIC_CAMERA.elevationRad),
];
const CAMERA = { position: CAMERA_POSITION, zoom: 1, near: 1, far: CAMERA_DISTANCE * 4 };
const LABEL_HEIGHT_PX = 18;
const GUTTER_Y_PX = 36;
const MAX_LEFT_GUTTER_PX = 72;
const LEFT_GUTTER_RATIO = 0.16;
const MAX_RIGHT_GUTTER_PX = 124;
const RIGHT_GUTTER_RATIO = 0.3;
const SCREEN_RIGHT: Vector3 = [
  Math.cos(ISOMETRIC_CAMERA.azimuthRad),
  0,
  -Math.sin(ISOMETRIC_CAMERA.azimuthRad),
];
const COMPACT_WIDTH_PX = 560;
const MARKER_RADIUS_PX = 5;
const LABEL_Z_RANGE = [20, 0];
const OUTLINE_COLOR = '#0b0d10';
const BOUNDARY_COLOR = '#f4f1ea';
const MARKER_COLOR = '#ffffff';

const LabelPortalContext = createContext<RefObject<HTMLDivElement | null> | undefined>(undefined);

const LABEL_TEXTS: Record<BlockLabelKind, () => string> = {
  water: BAND_NAMES.water,
  crust: m.crustal_block_crust,
  moho: m.crustal_block_moho,
  'upper-mantle': BAND_NAMES['upper-mantle'],
  'transition-zone': BAND_NAMES['transition-zone'],
  'lower-mantle': BAND_NAMES['lower-mantle'],
};

function getLinearColors(colors: Float32Array): Float32Array {
  const color = new Color();
  const linear = new Float32Array(colors.length);
  for (let index = 0; index < colors.length; index += 3) {
    color.setRGB(colors[index], colors[index + 1], colors[index + 2], SRGBColorSpace);
    linear.set([color.r, color.g, color.b], index);
  }
  return linear;
}

function getMeshGeometry(data: MeshData): BufferGeometry {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(data.positions, 3));
  geometry.setAttribute('color', new BufferAttribute(getLinearColors(data.colors), 3));
  geometry.setIndex(new BufferAttribute(data.indices, 1));
  geometry.computeVertexNormals();
  return geometry;
}

function getLineGeometry(positions: Float32Array): BufferGeometry {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  return geometry;
}

function useMeshGeometry(data: MeshData): BufferGeometry {
  const geometry = useMemo(() => getMeshGeometry(data), [data]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return geometry;
}

function useLineGeometry(positions: Float32Array): BufferGeometry {
  const geometry = useMemo(() => getLineGeometry(positions), [positions]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return geometry;
}

function Label({ position, children }: { position: Vector3; children: ReactNode }) {
  const portal = useContext(LabelPortalContext) as RefObject<HTMLElement>;
  return (
    <Html position={position} portal={portal} pointerEvents="none" zIndexRange={LABEL_Z_RANGE}>
      {children}
    </Html>
  );
}

function BlockGeometry({ mesh }: { mesh: BlockMeshData }) {
  const terrain = useMeshGeometry(mesh.terrain);
  const walls = useMeshGeometry(mesh.walls);
  const water = useMeshGeometry(mesh.water);
  const outlines = useLineGeometry(mesh.outlines);
  const mohoLine = useLineGeometry(mesh.mohoLine);
  const deepLines = useLineGeometry(mesh.deepLines);

  return (
    <>
      <mesh geometry={terrain}>
        <meshStandardMaterial
          vertexColors
          roughness={1}
          polygonOffset
          polygonOffsetFactor={1}
          polygonOffsetUnits={1}
        />
      </mesh>
      <mesh geometry={walls}>
        <meshStandardMaterial
          vertexColors
          roughness={1}
          side={DoubleSide}
          polygonOffset
          polygonOffsetFactor={1}
          polygonOffsetUnits={1}
        />
      </mesh>
      <mesh geometry={water} renderOrder={1}>
        <meshStandardMaterial
          vertexColors
          roughness={0.4}
          side={DoubleSide}
          transparent
          opacity={WATER_OPACITY}
          depthWrite={false}
        />
      </mesh>
      <lineSegments geometry={outlines}>
        <lineBasicMaterial color={OUTLINE_COLOR} transparent opacity={0.55} />
      </lineSegments>
      <lineSegments geometry={mohoLine}>
        <lineBasicMaterial color={BOUNDARY_COLOR} transparent opacity={0.8} />
      </lineSegments>
      <lineSegments geometry={deepLines}>
        <lineBasicMaterial color={BOUNDARY_COLOR} transparent opacity={0.45} />
      </lineSegments>
    </>
  );
}

function getRuptureStartLabel(depthKm: number, compact: boolean): string {
  const distance = getDistanceLabel(depthKm);
  return compact ? distance : m.crustal_block_rupture_start_label({ depth: distance });
}

function RuptureStart({
  block,
  surfaceKm,
  radiusKm,
  compact,
}: {
  block: CrustalBlock;
  surfaceKm: number;
  radiusKm: number;
  compact: boolean;
}) {
  const depthKm = block.ruptureStartDepthKm;
  const linePositions = useMemo(
    () => new Float32Array([0, surfaceKm, 0, 0, -depthKm, 0]),
    [surfaceKm, depthKm],
  );
  const line = useLineGeometry(linePositions);

  return (
    <>
      <lineSegments geometry={line} renderOrder={2}>
        <lineBasicMaterial color={MARKER_COLOR} transparent opacity={0.9} depthTest={false} />
      </lineSegments>
      <mesh position={[0, -depthKm, 0]} renderOrder={3}>
        <sphereGeometry args={[radiusKm, 24, 16]} />
        <meshBasicMaterial color={MARKER_COLOR} depthTest={false} />
      </mesh>
      <mesh position={[0, -depthKm, 0]} renderOrder={2}>
        <sphereGeometry args={[radiusKm * 2.2, 24, 16]} />
        <meshBasicMaterial color={MARKER_COLOR} transparent opacity={0.22} depthTest={false} />
      </mesh>
      <Label position={[0, -depthKm, 0]}>
        <span
          aria-hidden="true"
          className="block translate-x-4 -translate-y-1/2 rounded bg-ink/85 px-1.5 py-0.5 text-xs whitespace-nowrap text-paper ring-1 ring-paper/25"
        >
          {getRuptureStartLabel(depthKm, compact)}
        </span>
      </Label>
      <Label position={[0, surfaceKm, 0]}>
        <span
          aria-hidden="true"
          className="block -translate-x-1/2 -translate-y-[calc(100%+12px)] text-[11px] font-medium tracking-wide whitespace-nowrap text-paper"
        >
          {m.crustal_block_epicenter()}
        </span>
      </Label>
    </>
  );
}

function BlockLabels({
  block,
  mesh,
  scale,
}: {
  block: CrustalBlock;
  mesh: BlockMeshData;
  scale: number;
}) {
  const halfSideKm = block.sideKm / 2;
  const labels = getBlockLabels(mesh.labelCornerBands, LABEL_HEIGHT_PX / scale);

  return (
    <>
      {labels.map((label) => (
        <Label key={label.kind} position={[halfSideKm, label.yKm, -halfSideKm]}>
          <span
            aria-hidden="true"
            className="flex translate-x-1 -translate-y-1/2 items-center gap-1.5 text-[11px] font-medium tracking-wide whitespace-nowrap text-paper/90"
          >
            <span className="h-px w-3 bg-paper/50" />
            {LABEL_TEXTS[label.kind]()}
          </span>
        </Label>
      ))}
      {getDepthTicks(block.blockDepthKm).map((depthKm) => (
        <Label key={depthKm} position={[-halfSideKm, -depthKm, halfSideKm]}>
          <span
            aria-hidden="true"
            className="flex -translate-x-full -translate-y-1/2 items-center gap-1.5 pr-1 text-[11px] whitespace-nowrap text-muted tabular-nums"
          >
            {getDistanceLabel(depthKm)}
            <span className="h-px w-2 bg-muted" />
          </span>
        </Label>
      ))}
    </>
  );
}

function getShiftedPosition(position: readonly number[], shiftPx: number): Vector3 {
  return [
    position[0] + SCREEN_RIGHT[0] * shiftPx,
    position[1],
    position[2] + SCREEN_RIGHT[2] * shiftPx,
  ];
}

function BlockContents({ block, mesh }: { block: CrustalBlock; mesh: BlockMeshData }) {
  const size = useThree((state) => state.size);
  const leftGutter = Math.min(MAX_LEFT_GUTTER_PX, size.width * LEFT_GUTTER_RATIO);
  const rightGutter = Math.min(MAX_RIGHT_GUTTER_PX, size.width * RIGHT_GUTTER_RATIO);
  const fit = getBlockFit({
    sideKm: block.sideKm,
    topKm: mesh.topKm,
    bottomKm: -block.blockDepthKm,
    width: size.width,
    height: size.height,
    gutterX: (leftGutter + rightGutter) / 2,
    gutterY: GUTTER_Y_PX,
    view: ISOMETRIC_CAMERA,
  });

  return (
    <>
      <ambientLight intensity={1.4} />
      <directionalLight position={[-0.45, 1, 0.75]} intensity={2.2} />
      <group
        position={getShiftedPosition(fit.position, (leftGutter - rightGutter) / 2)}
        scale={fit.scale}
      >
        <BlockGeometry mesh={mesh} />
        <RuptureStart
          block={block}
          surfaceKm={mesh.surfaceAtCenterKm}
          radiusKm={MARKER_RADIUS_PX / fit.scale}
          compact={size.width < COMPACT_WIDTH_PX}
        />
        <BlockLabels block={block} mesh={mesh} scale={fit.scale} />
      </group>
    </>
  );
}

export default function CrustalBlockScene(props: CrustalBlockProps) {
  const block = useCrustalBlock(props);
  const { latitude, longitude } = props;
  const origin = useMemo(() => ({ latitude, longitude }), [latitude, longitude]);
  const relief = useRelief(origin, block.sideKm);
  const mesh = useMemo(
    () =>
      getBlockMeshData({
        cells: block.cells,
        origin,
        sideKm: block.sideKm,
        blockDepthKm: block.blockDepthKm,
        segments: BLOCK_SEGMENTS,
        relief,
        getBandColor,
        getTerrainColor,
      }),
    [block, origin, relief],
  );
  const labelsRef = useRef<HTMLDivElement>(null);

  return (
    <div
      aria-hidden="true"
      className={cn(
        'relative overflow-hidden rounded-lg border border-line bg-[radial-gradient(ellipse_at_50%_30%,var(--color-surface),var(--color-ink))]',
        CRUSTAL_BLOCK_HEIGHT,
      )}
    >
      <Canvas orthographic flat frameloop="demand" dpr={[1, 2]} camera={CAMERA}>
        <LabelPortalContext value={labelsRef}>
          <BlockContents block={block} mesh={mesh} />
        </LabelPortalContext>
      </Canvas>
      <div ref={labelsRef} className="pointer-events-none absolute inset-0 overflow-hidden" />
    </div>
  );
}
