"use strict";
// The Truchet pattern of Scenario's link-preview cards, ported from
// scenario-com-landing-page's lib/truchet (constants, utils, generate-colors,
// generate-pattern, svg-builder) to plain JavaScript. Same numbers, same
// output; TruchetSvg returns a satori element (h.js) instead of JSX.

const { h } = require("./h.js");

// constants.ts
const DEFAULT_TILES = 22;
const DEFAULT_PRESERVATION_PERCENT = 0.7;
const MIN_OPACITY = 0.1;
const GRADIENT_START = 1.8;
const GRADIENT_END = 0.8;

// utils.ts
/** Deterministic PRNG: fast 32-bit hash. */
function pseudoRandom(seed) {
  let t = seed + 1_831_565_813;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
}

/** FNV-like string to 32-bit unsigned int. Used for pattern generation. */
function hashString(str) {
  let hash = 2_166_136_261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16_777_619);
  }
  return hash >>> 0;
}

/** Seeded PRNG factory: a function that produces deterministic floats 0..1. */
function createRng(seed) {
  let i = 0;
  return function rand() {
    i++;
    return pseudoRandom(seed + i);
  };
}

/** Linear interpolation between two RGB arrays. */
function mix(c1, c2, w) {
  return c1.map((c, i) => Math.round(c + (c2[i] - c) * w));
}

function hexToRgb(hex) {
  const match = hex.match(/\w\w/g);
  if (!match || match.length < 3) return [0, 0, 0];
  return match.slice(0, 3).map((c) => parseInt(c, 16));
}

function rgbToHex(rgb) {
  const [r, g, b] = rgb;
  return "#" + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
}

// generate-colors.ts
/** Hand-picked bg and stroke combinations from fawkes ALTERNATE_THEME_DUAL_PALETTE. */
const DUAL_PALETTE = [
  { bg: "#00112f", text: "#00a15c" },
  { bg: "#00112f", text: "#9c183e" },
  { bg: "#00112f", text: "#ffa800" },
  { bg: "#00a15c", text: "#00112f" },
  { bg: "#00a15c", text: "#2b2b18" },
  { bg: "#1e1428", text: "#acd2c0" },
  { bg: "#1e1428", text: "#cc5416" },
  { bg: "#1e1428", text: "#f4c991" },
  { bg: "#1e1428", text: "#f8f6f5" },
  { bg: "#2b2b18", text: "#00a15c" },
  { bg: "#2b2b18", text: "#9c183e" },
  { bg: "#2b2b18", text: "#acd2c0" },
  { bg: "#2b2b18", text: "#bcd6f1" },
  { bg: "#2b2b18", text: "#c3c1ea" },
  { bg: "#2b2b18", text: "#eec1d9" },
  { bg: "#3c1403", text: "#bcd6f1" },
  { bg: "#3c1403", text: "#acd2c0" },
  { bg: "#9c183e", text: "#00112f" },
  { bg: "#9c183e", text: "#2b2b18" },
  { bg: "#acd2c0", text: "#1e1428" },
  { bg: "#acd2c0", text: "#2b2b18" },
  { bg: "#bcd6f1", text: "#2b2b18" },
  { bg: "#bcd6f1", text: "#3c1403" },
  { bg: "#c3c1ea", text: "#2b2b18" },
  { bg: "#c3c1ea", text: "#3c1403" },
  { bg: "#eec1d9", text: "#2b2b18" },
  { bg: "#eec1d9", text: "#00112f" },
  { bg: "#f4c991", text: "#1e1428" },
  { bg: "#f4c991", text: "#3c1403" },
  { bg: "#f8f6f5", text: "#1e1428" },
  { bg: "#f8f6f5", text: "#9c183e" }
];

/** Stroke colours that contrast with baseColor (luminance-aware). */
function generateStrokeColors(baseColor) {
  const rgb = hexToRgb(baseColor);
  const lum = 0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2];
  const white = [255, 255, 255];
  const black = [0, 0, 0];
  if (lum < 150) return { c1: rgbToHex(mix(rgb, white, 0.15)), c2: rgbToHex(mix(rgb, white, 0.35)) };
  return { c1: rgbToHex(mix(rgb, black, 0.1)), c2: rgbToHex(mix(rgb, black, 0.3)) };
}

// generate-pattern.ts
/**
 * A 2D grid of Truchet cells with deterministic skip and opacity logic.
 * Each cell is {orientation, strokeColor, op}, or undefined when hidden.
 */
function generatePatternData(seed, baseColor, tilesX, tilesY, preservationPercent) {
  const rng = createRng(hashString(seed + "|" + baseColor));
  const { c2 } = generateStrokeColors(baseColor);
  const skipRng = createRng(hashString(seed + "|skip"));
  const cells = [];
  for (let y = 0; y < tilesY; y++) {
    const row = [];
    for (let x = 0; x < tilesX; x++) {
      const r1 = rng();
      const orientation = r1 < 0.5 ? 0 : 1;
      const nx = x / tilesX;
      const ny = y / tilesY;
      const m = (r1 - 0.5) * 0.8;
      let skipChance = 0;
      if (nx <= 0.5 + m && ny <= 0.7 + m) skipChance = 0.85;
      else if (nx <= 0.5 + m && ny > 0.3 + m) skipChance = 0.2;
      else if ((nx > 0.5 + m && ny <= 0.25 + m) || (nx > 0.5 + m && ny >= 0.75 + m)) skipChance = 0.8;
      else if (nx > 0.5 + m && ny > 0.25 + m && ny < 0.75 + m) skipChance = 0.4;
      if (skipChance > 0 && skipRng() < skipChance) {
        row.push(undefined);
        continue;
      }
      const cellRand = (hashString(`${seed}|preserve|${x}|${y}`) % 1_000) / 1_000;
      if (cellRand > preservationPercent) {
        row.push(undefined);
        continue;
      }
      const d = 1 - nx + ny;
      let op = (d - GRADIENT_END) / (GRADIENT_START - GRADIENT_END);
      op = Math.max(0, Math.min(1, op));
      op = Math.round(op * 100) / 100;
      if (op <= MIN_OPACITY) {
        row.push(undefined);
        continue;
      }
      row.push({ orientation, strokeColor: c2, op });
    }
    cells.push(row);
  }
  return cells;
}

// svg-builder.tsx
const TILE_SIZE = 1;
const STROKE_WIDTH = TILE_SIZE * 0.12;
const CAP_RADIUS = TILE_SIZE * 0.06;
const ANGLE_OFFSET = 0.12;
const RADIUS = TILE_SIZE / 2;

/** Three decimals: 0.001 of a tile is about 0.03 px at the sizes drawn. */
function fmt(value) {
  return String(Math.round(value * 1000) / 1000);
}

function getPoint(centerX, centerY, angle) {
  return { x: centerX + RADIUS * Math.cos(angle), y: centerY + RADIUS * Math.sin(angle) };
}

function getNeighborCoords(x, y, side) {
  if (side === "left") return { nx: x - 1, ny: y };
  if (side === "right") return { nx: x + 1, ny: y };
  if (side === "top") return { nx: x, ny: y - 1 };
  return { nx: x, ny: y + 1 };
}

/** The two arcs of a tile: orientation 0 curves around its top-left and bottom-right corners. */
function tileArcs(x, y, orientation) {
  const x0 = x * TILE_SIZE;
  const y0 = y * TILE_SIZE;
  const x1 = x0 + TILE_SIZE;
  const y1 = y0 + TILE_SIZE;
  const { PI } = Math;
  if (orientation === 0) {
    return [
      { from: "left", to: "top", centerX: x0, centerY: y0, startAngle: PI / 2, endAngle: 0 },
      { from: "right", to: "bottom", centerX: x1, centerY: y1, startAngle: (3 * PI) / 2, endAngle: PI }
    ];
  }
  return [
    { from: "top", to: "right", centerX: x1, centerY: y0, startAngle: PI, endAngle: PI / 2 },
    { from: "bottom", to: "left", centerX: x0, centerY: y1, startAngle: 2 * PI, endAngle: (3 * PI) / 2 }
  ];
}

/** A round cap as a path: two half circles from its leftmost point. */
function capPath(point) {
  const r = fmt(CAP_RADIUS);
  const d = fmt(2 * CAP_RADIUS);
  return `M${fmt(point.x - CAP_RADIUS)} ${fmt(point.y)}a${r} ${r} 0 1 0 ${d} 0a${r} ${r} 0 1 0 -${d} 0`;
}

/** Appends one arc to its layer: an end meeting a same-colour neighbour stops on the tile edge, a free end gets a round cap. */
function addArc(layer, arc, joins) {
  const startJoined = joins(arc.from);
  const endJoined = joins(arc.to);
  const start = getPoint(arc.centerX, arc.centerY, startJoined ? arc.startAngle : arc.startAngle - ANGLE_OFFSET);
  const end = getPoint(arc.centerX, arc.centerY, endJoined ? arc.endAngle : arc.endAngle + ANGLE_OFFSET);
  const r = fmt(RADIUS);
  layer.strokes += `M${fmt(start.x)} ${fmt(start.y)}A${r} ${r} 0 0 0 ${fmt(end.x)} ${fmt(end.y)}`;
  if (!startJoined) layer.caps += capPath(start);
  if (!endJoined) layer.caps += capPath(end);
}

/** Every visible tile's arcs and caps, one layer per colour and opacity. */
function buildLayers(cells, tilesX, tilesY) {
  const layers = new Map();
  cells.forEach((row, y) =>
    row.forEach((cell, x) => {
      if (!cell) return;
      const key = `${cell.strokeColor}|${cell.op}`;
      const layer = layers.get(key) || { color: cell.strokeColor, op: cell.op, strokes: "", caps: "" };
      const joins = (side) => {
        const { nx, ny } = getNeighborCoords(x, y, side);
        if (nx < 0 || nx >= tilesX || ny < 0 || ny >= tilesY) return false;
        return cells[ny] && cells[ny][nx] ? cells[ny][nx].strokeColor === cell.strokeColor : false;
      };
      for (const arc of tileArcs(x, y, cell.orientation)) addArc(layer, arc, joins);
      layers.set(key, layer);
    })
  );
  return [...layers.values()];
}

/** The pattern as an SVG element. */
function TruchetSvg({ cells, tilesX, tilesY, width = "100%", height = "100%" }) {
  const layers = buildLayers(cells, tilesX, tilesY);
  if (layers.length === 0) return null;
  return h(
    "svg",
    { width, height, viewBox: `0 0 ${tilesX * TILE_SIZE} ${tilesY * TILE_SIZE}`, preserveAspectRatio: "xMidYMid slice", style: { display: "flex" } },
    ...layers.map((layer) =>
      h(
        "g",
        { opacity: layer.op },
        h("path", { d: layer.strokes, stroke: layer.color, strokeWidth: STROKE_WIDTH, fill: "none", strokeLinecap: "butt" }),
        layer.caps ? h("path", { d: layer.caps, fill: layer.color }) : null
      )
    )
  );
}

module.exports = { DEFAULT_TILES, DEFAULT_PRESERVATION_PERCENT, DUAL_PALETTE, generateStrokeColors, generatePatternData, TruchetSvg, hashString };
