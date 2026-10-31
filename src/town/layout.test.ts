import { describe, expect, it } from 'vitest';
import { FACTIONS } from '../game/factions';
import { createTownEnvironment } from './environment';
import { createTownLayout, TOWN_LAYOUT_BOUNDS } from './layout';
import { disposeTownObject } from './models';
import { COMMON_BUILDING_IDS } from './registry';

function extents(placement: ReturnType<typeof createTownLayout>[number]): [number, number] {
  const [width, depth] = placement.spec.footprint;
  const cos = Math.abs(Math.cos(placement.rotation));
  const sin = Math.abs(Math.sin(placement.rotation));
  return [(cos * width + sin * depth) / 2, (sin * width + cos * depth) / 2];
}

describe('town interior layout', () => {
  it.each(Object.keys(FACTIONS))('lays out nine separate destinations for %s', (key) => {
    const factionId = key as keyof typeof FACTIONS;
    const layout = createTownLayout(factionId);
    expect(layout).toHaveLength(9);
    expect(layout.map((placement) => placement.spec.id)).toEqual([
      ...COMMON_BUILDING_IDS,
      ...FACTIONS[factionId].buildingIds,
    ]);
    expect(new Set(layout.map((placement) => `${placement.x},${placement.z}`)).size).toBe(9);
    for (const placement of layout) {
      const [extentX, extentZ] = extents(placement);
      expect(Math.abs(placement.x) + extentX).toBeLessThan(TOWN_LAYOUT_BOUNDS.width / 2);
      expect(Math.abs(placement.z) + extentZ).toBeLessThan(TOWN_LAYOUT_BOUNDS.depth / 2);
      expect(Number.isFinite(placement.rotation)).toBe(true);
      expect(placement.labelHeight).toBeGreaterThan(placement.spec.height);
    }
    for (let first = 0; first < layout.length; first += 1) {
      for (let second = first + 1; second < layout.length; second += 1) {
        const a = layout[first]!;
        const b = layout[second]!;
        const [aX, aZ] = extents(a);
        const [bX, bZ] = extents(b);
        const separated = Math.abs(a.x - b.x) >= aX + bX + 0.2 || Math.abs(a.z - b.z) >= aZ + bZ + 0.2;
        expect(separated, `${a.spec.id} overlaps ${b.spec.id}`).toBe(true);
      }
    }
  });

  it.each(Object.keys(FACTIONS))('builds faction terrain, a plaza, and roads for %s', (key) => {
    const factionId = key as keyof typeof FACTIONS;
    const environment = createTownEnvironment(factionId, createTownLayout(factionId));
    let meshes = 0;
    environment.traverse((child) => {
      if (child.type === 'Mesh') meshes += 1;
    });
    expect(environment.userData.faction).toBe(factionId);
    expect(meshes).toBeGreaterThan(100);
    disposeTownObject(environment);
  });
});
