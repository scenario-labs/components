// Copied from scenario-com-landing-page lib/truchet/generate-pattern.ts (1ca540be).
// Changes: explicit .ts import paths. Em dashes in comments written as colons (house rule).
import { GRADIENT_END, GRADIENT_START, MIN_OPACITY } from './constants.ts';
import { generateStrokeColors } from './generate-colors.ts';
import { createRng, hashString } from './utils.ts';

export type TruchetCell = {
  orientation: 0 | 1;
  strokeColor: string;
  op: number;
};

/**
 * Generate a 2D grid of Truchet cells with deterministic skip/opacity logic.
 * Returns `(TruchetCell | undefined)[][]`: undefined means the cell is hidden.
 */
export function generatePatternData(
  seed: string,
  baseColor: string,
  tilesX: number,
  tilesY: number,
  preservationPercent: number
): (TruchetCell | undefined)[][] {
  const h = hashString(seed + '|' + baseColor);
  const rng = createRng(h);

  const { c2 } = generateStrokeColors(baseColor);

  const skipRngSeed = hashString(seed + '|skip');
  const skipRng = createRng(skipRngSeed);

  const cells: (TruchetCell | undefined)[][] = [];

  for (let y = 0; y < tilesY; y++) {
    const row: (TruchetCell | undefined)[] = [];
    for (let x = 0; x < tilesX; x++) {
      const r1 = rng();
      const orientation: 0 | 1 = r1 < 0.5 ? 0 : 1;

      const nx = x / tilesX;
      const ny = y / tilesY;
      const m = (r1 - 0.5) * 0.8;
      let skipChance = 0;

      if (nx <= 0.5 + m && ny <= 0.7 + m) {
        skipChance = 0.85;
      } else if (nx <= 0.5 + m && ny > 0.3 + m) {
        skipChance = 0.2;
      } else if (
        (nx > 0.5 + m && ny <= 0.25 + m) ||
        (nx > 0.5 + m && ny >= 0.75 + m)
      ) {
        skipChance = 0.8;
      } else if (nx > 0.5 + m && ny > 0.25 + m && ny < 0.75 + m) {
        skipChance = 0.4;
      }

      if (skipChance > 0) {
        const skipRandom = skipRng();
        if (skipRandom < skipChance) {
          row.push(undefined);
          continue;
        }
      }

      const cellHash = hashString(`${seed}|preserve|${x}|${y}`);
      const cellRand = (cellHash % 1_000) / 1_000;
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
