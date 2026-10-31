import type { HexCoord } from './types';

export const BATTLEFIELD_COLUMNS = 15;
export const BATTLEFIELD_ROWS = 11;

interface CubeCoord {
  x: number;
  y: number;
  z: number;
}

export function hexKey(hex: HexCoord): string {
  return `${hex.x},${hex.y}`;
}

export function sameHex(a: HexCoord, b: HexCoord): boolean {
  return a.x === b.x && a.y === b.y;
}

export function cloneHex(hex: HexCoord): HexCoord {
  return { x: hex.x, y: hex.y };
}

export function isInsideBattlefield(hex: HexCoord): boolean {
  return Number.isInteger(hex.x) && Number.isInteger(hex.y) &&
    hex.x >= 0 && hex.x < BATTLEFIELD_COLUMNS && hex.y >= 0 && hex.y < BATTLEFIELD_ROWS;
}

export function hexNeighbors(hex: HexCoord): HexCoord[] {
  const diagonalX = hex.y % 2 === 0 ? -1 : 1;
  return [
    { x: hex.x + 1, y: hex.y },
    { x: hex.x - 1, y: hex.y },
    { x: hex.x, y: hex.y - 1 },
    { x: hex.x + diagonalX, y: hex.y - 1 },
    { x: hex.x, y: hex.y + 1 },
    { x: hex.x + diagonalX, y: hex.y + 1 },
  ].filter(isInsideBattlefield);
}

function toCube(hex: HexCoord): CubeCoord {
  const x = hex.x - (hex.y - (hex.y & 1)) / 2;
  const z = hex.y;
  return { x, y: -x - z, z };
}

function fromCube(cube: CubeCoord): HexCoord {
  const y = cube.z;
  return { x: cube.x + (y - (y & 1)) / 2, y };
}

export function hexDistance(a: HexCoord, b: HexCoord): number {
  const cubeA = toCube(a);
  const cubeB = toCube(b);
  return Math.max(
    Math.abs(cubeA.x - cubeB.x),
    Math.abs(cubeA.y - cubeB.y),
    Math.abs(cubeA.z - cubeB.z),
  );
}

function cubeRound(cube: CubeCoord): CubeCoord {
  let x = Math.round(cube.x);
  let y = Math.round(cube.y);
  let z = Math.round(cube.z);
  const xDifference = Math.abs(x - cube.x);
  const yDifference = Math.abs(y - cube.y);
  const zDifference = Math.abs(z - cube.z);
  if (xDifference > yDifference && xDifference > zDifference) x = -y - z;
  else if (yDifference > zDifference) y = -x - z;
  else z = -x - y;
  return { x, y, z };
}

export function hexLine(start: HexCoord, end: HexCoord): HexCoord[] {
  const distance = hexDistance(start, end);
  if (distance === 0) return [cloneHex(start)];
  const cubeA = toCube(start);
  const cubeB = toCube(end);
  const line: HexCoord[] = [];
  for (let step = 0; step <= distance; step += 1) {
    const amount = step / distance;
    line.push(fromCube(cubeRound({
      x: cubeA.x + (cubeB.x - cubeA.x) * amount,
      y: cubeA.y + (cubeB.y - cubeA.y) * amount,
      z: cubeA.z + (cubeB.z - cubeA.z) * amount,
    })));
  }
  return line;
}

export function hexToWorld(hex: HexCoord, size = 1): { x: number; z: number } {
  return {
    x: Math.sqrt(3) * size * (hex.x + 0.5 * (hex.y & 1)),
    z: 1.5 * size * hex.y,
  };
}
