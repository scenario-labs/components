/** @jsxRuntime automatic */
/** @jsxImportSource react */
// Copied from scenario-com-landing-page lib/truchet/svg-builder.tsx (1ca540be).
// Changes: explicit .ts import paths; JSX runtime pragmas, as the plug-ins that run it have no tsconfig.
import type { TruchetCell } from './generate-pattern.ts';

type TruchetSvgProps = {
  cells: (TruchetCell | undefined)[][];
  tilesX: number;
  tilesY: number;
  width?: number | string;
  height?: number | string;
};

type Side = 'left' | 'right' | 'top' | 'bottom';

/** A quarter circle centered on a tile corner, joining the middles of two sides. */
type Arc = {
  from: Side;
  to: Side;
  centerX: number;
  centerY: number;
  startAngle: number;
  endAngle: number;
};

/** Every arc (stroked) and cap (filled) drawn at one color and opacity. */
type Layer = { color: string; op: number; strokes: string; caps: string };

const TILE_SIZE = 1;
const STROKE_WIDTH = TILE_SIZE * 0.12;
const CAP_RADIUS = TILE_SIZE * 0.06;
const ANGLE_OFFSET = 0.12;
const RADIUS = TILE_SIZE / 2;

/** Three decimals: 0.001 of a tile is about 0.03 px at the sizes drawn. */
function fmt(value: number): string {
  return String(Math.round(value * 1000) / 1000);
}

function getPoint(
  centerX: number,
  centerY: number,
  angle: number
): { x: number; y: number } {
  return {
    x: centerX + RADIUS * Math.cos(angle),
    y: centerY + RADIUS * Math.sin(angle),
  };
}

function getNeighborCoords(
  x: number,
  y: number,
  side: Side
): { nx: number; ny: number } {
  if (side === 'left') return { nx: x - 1, ny: y };
  if (side === 'right') return { nx: x + 1, ny: y };
  if (side === 'top') return { nx: x, ny: y - 1 };
  return { nx: x, ny: y + 1 };
}

/** The two arcs of a tile: orientation 0 curves around its top-left and bottom-right corners. */
function tileArcs(x: number, y: number, orientation: 0 | 1): Arc[] {
  const x0 = x * TILE_SIZE;
  const y0 = y * TILE_SIZE;
  const x1 = x0 + TILE_SIZE;
  const y1 = y0 + TILE_SIZE;
  const { PI } = Math;
  if (orientation === 0) {
    return [
      {
        from: 'left',
        to: 'top',
        centerX: x0,
        centerY: y0,
        startAngle: PI / 2,
        endAngle: 0,
      },
      {
        from: 'right',
        to: 'bottom',
        centerX: x1,
        centerY: y1,
        startAngle: (3 * PI) / 2,
        endAngle: PI,
      },
    ];
  }
  return [
    {
      from: 'top',
      to: 'right',
      centerX: x1,
      centerY: y0,
      startAngle: PI,
      endAngle: PI / 2,
    },
    {
      from: 'bottom',
      to: 'left',
      centerX: x0,
      centerY: y1,
      startAngle: 2 * PI,
      endAngle: (3 * PI) / 2,
    },
  ];
}

/** A round cap as a path: two half circles from its leftmost point. */
function capPath(point: { x: number; y: number }): string {
  const r = fmt(CAP_RADIUS);
  const d = fmt(2 * CAP_RADIUS);
  return `M${fmt(point.x - CAP_RADIUS)} ${fmt(point.y)}a${r} ${r} 0 1 0 ${d} 0a${r} ${r} 0 1 0 -${d} 0`;
}

/**
 * Appends one arc to its layer. An end that meets a same-color neighbor
 * stops on the tile edge; a free end is pulled back and gets a round cap.
 */
function addArc(layer: Layer, arc: Arc, joins: (side: Side) => boolean): void {
  const startJoined = joins(arc.from);
  const endJoined = joins(arc.to);
  const start = getPoint(
    arc.centerX,
    arc.centerY,
    startJoined ? arc.startAngle : arc.startAngle - ANGLE_OFFSET
  );
  const end = getPoint(
    arc.centerX,
    arc.centerY,
    endJoined ? arc.endAngle : arc.endAngle + ANGLE_OFFSET
  );
  const r = fmt(RADIUS);
  layer.strokes += `M${fmt(start.x)} ${fmt(start.y)}A${r} ${r} 0 0 0 ${fmt(end.x)} ${fmt(end.y)}`;
  if (!startJoined) layer.caps += capPath(start);
  if (!endJoined) layer.caps += capPath(end);
}

/**
 * Collects every visible tile's arcs and caps into one layer per color and
 * opacity. A pattern then costs a few dozen elements instead of ~500 (a group
 * per tile, a path per arc, a circle per cap), which on a model page with a
 * dozen cards was about 6,000 nodes for the browser to parse, lay out and
 * hydrate before it could paint.
 */
function buildLayers(
  cells: (TruchetCell | undefined)[][],
  tilesX: number,
  tilesY: number
): Layer[] {
  const layers = new Map<string, Layer>();
  cells.forEach((row, y) =>
    row.forEach((cell, x) => {
      if (!cell) return;
      const key = `${cell.strokeColor}|${cell.op}`;
      const layer = layers.get(key) ?? {
        color: cell.strokeColor,
        op: cell.op,
        strokes: '',
        caps: '',
      };
      const joins = (side: Side): boolean => {
        const { nx, ny } = getNeighborCoords(x, y, side);
        if (nx < 0 || nx >= tilesX || ny < 0 || ny >= tilesY) return false;
        return cells[ny]?.[nx]?.strokeColor === cell.strokeColor;
      };
      for (const arc of tileArcs(x, y, cell.orientation))
        addArc(layer, arc, joins);
      layers.set(key, layer);
    })
  );
  return [...layers.values()];
}

/** Render a Truchet pattern as an SVG element (works in both RSC and ImageResponse). */
export function TruchetSvg({
  cells,
  tilesX,
  tilesY,
  width = '100%',
  height = '100%',
}: TruchetSvgProps): React.ReactElement | null {
  const layers = buildLayers(cells, tilesX, tilesY);
  if (layers.length === 0) return null;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${tilesX * TILE_SIZE} ${tilesY * TILE_SIZE}`}
      preserveAspectRatio="xMidYMid slice"
      style={{ display: 'flex' }}
    >
      {layers.map(layer => (
        <g key={`${layer.color}|${layer.op}`} opacity={layer.op}>
          <path
            d={layer.strokes}
            stroke={layer.color}
            strokeWidth={STROKE_WIDTH}
            fill="none"
            strokeLinecap="butt"
          />
          {layer.caps && <path d={layer.caps} fill={layer.color} />}
        </g>
      ))}
    </svg>
  );
}
