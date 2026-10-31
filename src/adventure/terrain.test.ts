import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createAdventureMap } from '../game/map';
import { applyTerrainFog, buildTerrain } from './terrain';

describe('terrain environment fog', () => {
  it('collapses every kind of tall decoration on unexplored tiles', () => {
    const terrain = buildTerrain(createAdventureMap('fog-hidden'));
    expect(terrain.fogInstances.length).toBeGreaterThan(0);
    applyTerrainFog(terrain, new Set(), new Set());
    for (const visual of terrain.fogInstances) {
      const matrix = new THREE.Matrix4();
      visual.mesh.getMatrixAt(0, matrix);
      expect(matrix.elements.slice(0, 15)).toEqual(new Array<number>(15).fill(0));
      expect(matrix.elements[15]).toBe(1);
    }
    for (const visual of terrain.fogPoints) {
      expect(visual.points.geometry.getAttribute('position').getY(0)).toBe(-1000);
    }
  });

  it('restores original instance transforms and dims explored decorations', () => {
    const terrain = buildTerrain(createAdventureMap('fog-dimmed'));
    const visual = terrain.fogInstances[0];
    expect(visual).toBeDefined();
    if (!visual) return;
    const tileIndex = visual.tileIndices[0];
    expect(tileIndex).toBeGreaterThanOrEqual(0);
    if (tileIndex === undefined) return;
    applyTerrainFog(terrain, new Set(), new Set([tileIndex]));
    const matrix = new THREE.Matrix4();
    visual.mesh.getMatrixAt(0, matrix);
    expect(matrix.elements).toEqual(Array.from(visual.baseMatrices.slice(0, 16)));
    expect(visual.mesh.instanceColor?.getX(0)).toBeCloseTo(0.48);
    applyTerrainFog(terrain, new Set([tileIndex]), new Set([tileIndex]));
    expect(visual.mesh.instanceColor?.getX(0)).toBe(1);
  });

  it('restores firefly positions and applies explored and visible brightness', () => {
    const terrain = buildTerrain(createAdventureMap('fog-fireflies'));
    const visual = terrain.fogPoints[0];
    expect(visual).toBeDefined();
    if (!visual) return;
    const tileIndex = visual.tileIndices[0];
    if (tileIndex === undefined) throw new Error('Missing firefly tile');
    const positions = visual.points.geometry.getAttribute('position');
    const colors = visual.points.geometry.getAttribute('color');
    applyTerrainFog(terrain, new Set(), new Set([tileIndex]));
    expect(positions.getY(0)).toBe(visual.basePositions[1]);
    expect(colors?.getX(0)).toBeCloseTo(0.35);
    applyTerrainFog(terrain, new Set([tileIndex]), new Set([tileIndex]));
    expect(colors?.getX(0)).toBe(1);
  });

  it('dims complete tile surfaces without changing their pickable transforms', () => {
    const terrain = buildTerrain(createAdventureMap('fog-surfaces'));
    const visual = terrain.fogColors[0];
    expect(visual).toBeDefined();
    if (!visual) return;
    const tileIndex = visual.tileIndices[0];
    if (tileIndex === undefined) throw new Error('Missing surface tile');
    const originalMatrix = Array.from(visual.mesh.instanceMatrix.array.slice(0, 16));
    const baseRed = visual.baseColors[0] ?? 1;
    applyTerrainFog(terrain, new Set(), new Set());
    expect(visual.mesh.instanceColor?.getX(0)).toBeCloseTo(baseRed * 0.06);
    expect(Array.from(visual.mesh.instanceMatrix.array.slice(0, 16))).toEqual(originalMatrix);
    applyTerrainFog(terrain, new Set(), new Set([tileIndex]));
    expect(visual.mesh.instanceColor?.getX(0)).toBeCloseTo(baseRed * 0.48);
    applyTerrainFog(terrain, new Set([tileIndex]), new Set([tileIndex]));
    expect(visual.mesh.instanceColor?.getX(0)).toBeCloseTo(baseRed);
  });
});
