import * as THREE from 'three';
import { getTerrain } from '../game/content';
import type { AdventureMap as AdventureMapData, MapTile, TerrainType } from '../game/types';
import { TILE_SIZE, deterministicNoise, terrainElevation, tileToWorld } from './coordinates';

interface InstanceTransform {
  x: number;
  y: number;
  z: number;
  sx?: number;
  sy?: number;
  sz?: number;
  ry?: number;
  color?: THREE.Color;
  tileIndex?: number;
}

export interface TerrainFogInstances {
  mesh: THREE.InstancedMesh;
  tileIndices: number[];
  baseMatrices: Float32Array;
}

export interface TerrainFogPoints {
  points: THREE.Points;
  tileIndices: number[];
  basePositions: Float32Array;
}

export interface TerrainFogColors {
  mesh: THREE.InstancedMesh;
  tileIndices: number[];
  baseColors: Float32Array;
}

export interface TerrainVisuals {
  group: THREE.Group;
  pickMeshes: THREE.InstancedMesh[];
  water: THREE.InstancedMesh | null;
  foam: THREE.Group;
  environment: THREE.Group;
  fogInstances: TerrainFogInstances[];
  fogPoints: TerrainFogPoints[];
  fogColors: TerrainFogColors[];
}

export function applyTerrainFog(
  terrain: TerrainVisuals,
  visible: ReadonlySet<number>,
  explored: ReadonlySet<number>,
): void {
  const matrix = new THREE.Matrix4();
  const hiddenMatrix = new THREE.Matrix4().makeScale(0, 0, 0);
  const color = new THREE.Color();
  for (const visual of terrain.fogColors) {
    visual.tileIndices.forEach((tileIndex, index) => {
      const offset = index * 3;
      const brightness = explored.has(tileIndex) ? visible.has(tileIndex) ? 1 : 0.48 : 0.06;
      color.setRGB(
        (visual.baseColors[offset] ?? 1) * brightness,
        (visual.baseColors[offset + 1] ?? 1) * brightness,
        (visual.baseColors[offset + 2] ?? 1) * brightness,
      );
      visual.mesh.setColorAt(index, color);
    });
    if (visual.mesh.instanceColor) visual.mesh.instanceColor.needsUpdate = true;
  }
  for (const visual of terrain.fogInstances) {
    visual.tileIndices.forEach((tileIndex, index) => {
      if (!explored.has(tileIndex)) {
        visual.mesh.setMatrixAt(index, hiddenMatrix);
        return;
      }
      matrix.fromArray(visual.baseMatrices, index * 16);
      visual.mesh.setMatrixAt(index, matrix);
      visual.mesh.setColorAt(index, color.setScalar(visible.has(tileIndex) ? 1 : 0.48));
    });
    visual.mesh.instanceMatrix.needsUpdate = true;
    if (visual.mesh.instanceColor) visual.mesh.instanceColor.needsUpdate = true;
  }
  for (const visual of terrain.fogPoints) {
    const positions = visual.points.geometry.getAttribute('position');
    const colors = visual.points.geometry.getAttribute('color');
    visual.tileIndices.forEach((tileIndex, index) => {
      const offset = index * 3;
      const x = visual.basePositions[offset] ?? 0;
      const y = visual.basePositions[offset + 1] ?? 0;
      const z = visual.basePositions[offset + 2] ?? 0;
      positions.setXYZ(index, x, explored.has(tileIndex) ? y : -1000, z);
      const brightness = visible.has(tileIndex) ? 1 : 0.35;
      colors?.setXYZ(index, brightness, brightness, brightness);
    });
    positions.needsUpdate = true;
    if (colors) colors.needsUpdate = true;
  }
}

function createInstances(
  geometry: THREE.BufferGeometry,
  surface: THREE.Material,
  transforms: readonly InstanceTransform[],
  castShadow = false,
): THREE.InstancedMesh | null {
  if (transforms.length === 0) return null;
  const mesh = new THREE.InstancedMesh(geometry, surface, transforms.length);
  const dummy = new THREE.Object3D();
  transforms.forEach((transform, index) => {
    dummy.position.set(transform.x, transform.y, transform.z);
    dummy.scale.set(transform.sx ?? 1, transform.sy ?? 1, transform.sz ?? 1);
    dummy.rotation.set(0, transform.ry ?? 0, 0);
    dummy.updateMatrix();
    mesh.setMatrixAt(index, dummy.matrix);
    if (transform.color) mesh.setColorAt(index, transform.color);
  });
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.castShadow = castShadow;
  mesh.receiveShadow = true;
  return mesh;
}

function addInstances(
  parent: THREE.Object3D,
  geometry: THREE.BufferGeometry,
  surface: THREE.Material,
  transforms: readonly InstanceTransform[],
  castShadow = false,
): THREE.InstancedMesh | null {
  const mesh = createInstances(geometry, surface, transforms, castShadow);
  if (mesh) parent.add(mesh);
  return mesh;
}

function neighbors(map: AdventureMapData, tile: MapTile): Array<{ dx: number; dy: number; tile?: MapTile }> {
  return [
    { dx: -1, dy: 0, tile: map.tiles[tile.y * map.width + tile.x - 1] },
    { dx: 1, dy: 0, tile: map.tiles[tile.y * map.width + tile.x + 1] },
    { dx: 0, dy: -1, tile: map.tiles[(tile.y - 1) * map.width + tile.x] },
    { dx: 0, dy: 1, tile: map.tiles[(tile.y + 1) * map.width + tile.x] },
  ].map((neighbor) => ({
    ...neighbor,
    tile: tile.x + neighbor.dx < 0 || tile.x + neighbor.dx >= map.width ||
      tile.y + neighbor.dy < 0 || tile.y + neighbor.dy >= map.height ? undefined : neighbor.tile,
  }));
}

function terrainColor(tile: MapTile, map: AdventureMapData): THREE.Color {
  const color = new THREE.Color(getTerrain(tile.terrain).color);
  const noise = deterministicNoise(map.seed, tile.y * map.width + tile.x, 17);
  color.offsetHSL((noise - 0.5) * 0.012, (noise - 0.5) * 0.045, (noise - 0.5) * 0.055);
  return color;
}

export function buildTerrain(map: AdventureMapData): TerrainVisuals {
  const group = new THREE.Group();
  group.name = 'procedural-terrain';
  const pickMeshes: THREE.InstancedMesh[] = [];
  const foam = new THREE.Group();
  foam.name = 'coastal-foam';
  const environment = new THREE.Group();
  environment.name = 'environment-details';
  group.add(foam, environment);
  const fogInstances: TerrainFogInstances[] = [];
  const fogPoints: TerrainFogPoints[] = [];
  const fogColors: TerrainFogColors[] = [];
  const trackFogColors = (mesh: THREE.InstancedMesh | null, transforms: readonly InstanceTransform[]): void => {
    if (!mesh) return;
    const baseColors = new Float32Array(transforms.length * 3);
    transforms.forEach((transform, index) => {
      baseColors[index * 3] = transform.color?.r ?? 1;
      baseColors[index * 3 + 1] = transform.color?.g ?? 1;
      baseColors[index * 3 + 2] = transform.color?.b ?? 1;
    });
    fogColors.push({
      mesh,
      tileIndices: transforms.map((transform) => transform.tileIndex ?? -1),
      baseColors,
    });
  };
  const addFogInstances = (
    geometry: THREE.BufferGeometry,
    surface: THREE.Material,
    transforms: readonly InstanceTransform[],
    castShadow = false,
  ): void => {
    const mesh = addInstances(environment, geometry, surface, transforms, castShadow);
    if (!mesh) return;
    fogInstances.push({
      mesh,
      tileIndices: transforms.map((transform) => transform.tileIndex ?? -1),
      baseMatrices: new Float32Array(mesh.instanceMatrix.array),
    });
  };

  const mapWidth = map.width * TILE_SIZE;
  const mapDepth = map.height * TILE_SIZE;
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(mapWidth + 0.45, 0.7, mapDepth + 0.45),
    new THREE.MeshStandardMaterial({ color: 0x3f4937, roughness: 1, flatShading: true }),
  );
  base.position.y = -0.58;
  base.receiveShadow = true;
  group.add(base);

  const landTypes: TerrainType[] = ['grass', 'dirt', 'forest', 'swamp', 'sand', 'mountain'];
  const columnGeometry = new THREE.BoxGeometry(TILE_SIZE * 0.988, 1, TILE_SIZE * 0.988);
  for (const terrain of landTypes) {
    const tiles = map.tiles.filter((tile) => tile.terrain === terrain);
    const tileIndices: number[] = [];
    const transforms = tiles.map((tile): InstanceTransform => {
      const top = terrainElevation(terrain) + (terrain === 'grass' || terrain === 'forest'
        ? (deterministicNoise(map.seed, tile.y * map.width + tile.x, 3) - 0.5) * 0.025 : 0);
      const world = tileToWorld(map, tile, top);
      const depth = top + 0.48;
      const tileIndex = tile.y * map.width + tile.x;
      tileIndices.push(tileIndex);
      return { x: world.x, y: top - depth / 2, z: world.z, sy: depth, color: terrainColor(tile, map), tileIndex };
    });
    const mesh = addInstances(group, columnGeometry, new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.96,
      flatShading: true,
    }), transforms);
    if (mesh) {
      mesh.name = `terrain-${terrain}`;
      mesh.userData.tileIndices = tileIndices;
      pickMeshes.push(mesh);
      trackFogColors(mesh, transforms);
    }
  }

  const waterTiles = map.tiles.filter((tile) => tile.terrain === 'water');
  const waterIndices: number[] = [];
  const waterTransforms = waterTiles.map((tile): InstanceTransform => {
    const world = tileToWorld(map, tile, terrainElevation('water'));
    const tileIndex = tile.y * map.width + tile.x;
    waterIndices.push(tileIndex);
    return { x: world.x, y: world.y, z: world.z, ry: deterministicNoise(map.seed, waterIndices.length, 9) * Math.PI, tileIndex };
  });
  const waterGeometry = new THREE.PlaneGeometry(TILE_SIZE * 1.015, TILE_SIZE * 1.015, 2, 2);
  waterGeometry.rotateX(-Math.PI / 2);
  const water = addInstances(group, waterGeometry, new THREE.MeshPhysicalMaterial({
    color: 0x3b8ca2,
    roughness: 0.24,
    metalness: 0.08,
    transparent: true,
    opacity: 0.88,
    flatShading: true,
    depthWrite: true,
  }), waterTransforms);
  if (water) {
    water.name = 'animated-water';
    water.userData.tileIndices = waterIndices;
    water.renderOrder = 1;
    pickMeshes.push(water);
    trackFogColors(water, waterTransforms);
  }

  const foamTransforms: InstanceTransform[] = [];
  const shoreTransforms: InstanceTransform[] = [];
  for (const tile of map.tiles) {
    const tileIndex = tile.y * map.width + tile.x;
    const world = tileToWorld(map, tile, terrainElevation(tile.terrain));
    for (const neighbor of neighbors(map, tile)) {
      if (!neighbor.tile) continue;
      if (tile.terrain === 'water' && neighbor.tile.terrain !== 'water') {
        foamTransforms.push({
          x: world.x + neighbor.dx * TILE_SIZE * 0.47,
          y: terrainElevation('water') + 0.026,
          z: world.z + neighbor.dy * TILE_SIZE * 0.47,
          sx: neighbor.dx === 0 ? TILE_SIZE * 0.83 : 0.035,
          sy: 0.012,
          sz: neighbor.dy === 0 ? TILE_SIZE * 0.83 : 0.035,
          tileIndex,
        });
      } else if (tile.terrain !== 'water' && neighbor.tile.terrain === 'water') {
        shoreTransforms.push({
          x: world.x + neighbor.dx * TILE_SIZE * 0.43,
          y: world.y + 0.012,
          z: world.z + neighbor.dy * TILE_SIZE * 0.43,
          sx: neighbor.dx === 0 ? TILE_SIZE * 0.94 : TILE_SIZE * 0.15,
          sy: 1,
          sz: neighbor.dy === 0 ? TILE_SIZE * 0.94 : TILE_SIZE * 0.15,
          tileIndex,
        });
      }
    }
  }
  const foamMesh = addInstances(foam, new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({
    color: 0xc7eee0,
    transparent: true,
    opacity: 0.64,
    depthWrite: false,
  }), foamTransforms);
  trackFogColors(foamMesh, foamTransforms);
  const shoreGeometry = new THREE.PlaneGeometry(1, 1);
  shoreGeometry.rotateX(-Math.PI / 2);
  const shoreMesh = addInstances(group, shoreGeometry, new THREE.MeshStandardMaterial({ color: 0xc8b47a, roughness: 1 }), shoreTransforms);
  trackFogColors(shoreMesh, shoreTransforms);

  const roadTransforms: InstanceTransform[] = [];
  const trackTransforms: InstanceTransform[] = [];
  for (const tile of map.tiles.filter((candidate) => candidate.road)) {
    const tileIndex = tile.y * map.width + tile.x;
    const world = tileToWorld(map, tile, terrainElevation(tile.terrain) + 0.018);
    roadTransforms.push({ x: world.x, y: world.y, z: world.z, tileIndex });
    for (const offset of [-0.22, 0.22]) {
      trackTransforms.push({ x: world.x + offset, y: world.y + 0.005, z: world.z, sx: 0.045, sy: TILE_SIZE * 0.8, sz: 1, tileIndex });
    }
  }
  const roadGeometry = new THREE.PlaneGeometry(TILE_SIZE * 0.98, TILE_SIZE * 0.98);
  roadGeometry.rotateX(-Math.PI / 2);
  const roadMesh = addInstances(group, roadGeometry, new THREE.MeshStandardMaterial({ color: 0xa98d5f, roughness: 1 }), roadTransforms);
  trackFogColors(roadMesh, roadTransforms);
  const trackMesh = addInstances(group, roadGeometry, new THREE.MeshStandardMaterial({ color: 0xc0a875, roughness: 1 }), trackTransforms);
  trackFogColors(trackMesh, trackTransforms);

  const trunks: InstanceTransform[] = [];
  const crowns: InstanceTransform[] = [];
  const upperCrowns: InstanceTransform[] = [];
  const mountains: InstanceTransform[] = [];
  const snow: InstanceTransform[] = [];
  const rocks: InstanceTransform[] = [];
  const reeds: InstanceTransform[] = [];
  const flowers: InstanceTransform[] = [];
  const fireflyPositions: number[] = [];
  const fireflyTileIndices: number[] = [];
  for (const tile of map.tiles) {
    const tileIndex = tile.y * map.width + tile.x;
    const world = tileToWorld(map, tile, terrainElevation(tile.terrain));
    const occupied = tile.objectId !== null || tile.road;
    if (tile.terrain === 'forest' && !occupied) {
      const count = deterministicNoise(map.seed, tileIndex, 30) > 0.45 ? 3 : 2;
      for (let index = 0; index < count; index += 1) {
        const angle = deterministicNoise(map.seed, tileIndex, 31 + index) * Math.PI * 2;
        const radius = 0.15 + deterministicNoise(map.seed, tileIndex, 40 + index) * 0.27;
        const x = world.x + Math.cos(angle) * radius;
        const z = world.z + Math.sin(angle) * radius;
        const size = 0.75 + deterministicNoise(map.seed, tileIndex, 50 + index) * 0.45;
        trunks.push({ x, y: world.y + 0.18 * size, z, sy: size, tileIndex });
        crowns.push({ x, y: world.y + 0.52 * size, z, sy: size, sx: size, sz: size, ry: angle, tileIndex });
        upperCrowns.push({ x, y: world.y + 0.79 * size, z, sy: size, sx: size * 0.75, sz: size * 0.75, ry: angle + 0.4, tileIndex });
        if (index === 0) {
          fireflyPositions.push(x, world.y + 0.65 + deterministicNoise(map.seed, tileIndex, 70) * 0.4, z);
          fireflyTileIndices.push(tileIndex);
        }
      }
    } else if (tile.terrain === 'mountain') {
      const size = 0.78 + deterministicNoise(map.seed, tileIndex, 80) * 0.5;
      mountains.push({ x: world.x, y: world.y + 0.45 * size, z: world.z, sx: size, sy: size, sz: size, ry: deterministicNoise(map.seed, tileIndex, 81) * Math.PI, tileIndex });
      snow.push({ x: world.x, y: world.y + 0.94 * size, z: world.z, sx: size * 0.38, sy: size * 0.38, sz: size * 0.38, tileIndex });
    } else if (tile.obstacle && tile.terrain !== 'water') {
      rocks.push({ x: world.x, y: world.y + 0.2, z: world.z, ry: deterministicNoise(map.seed, tileIndex, 82) * Math.PI, tileIndex });
    } else if (tile.terrain === 'swamp' && !occupied && deterministicNoise(map.seed, tileIndex, 83) > 0.42) {
      for (let index = 0; index < 4; index += 1) {
        reeds.push({
          x: world.x + (deterministicNoise(map.seed, tileIndex, 90 + index) - 0.5) * 0.65,
          y: world.y + 0.13,
          z: world.z + (deterministicNoise(map.seed, tileIndex, 100 + index) - 0.5) * 0.65,
          sy: 0.7 + deterministicNoise(map.seed, tileIndex, 110 + index) * 0.6,
          tileIndex,
        });
      }
    } else if (!occupied && tile.terrain === 'grass' && deterministicNoise(map.seed, tileIndex, 120) > 0.86) {
      flowers.push({ x: world.x + 0.2, y: world.y + 0.06, z: world.z - 0.17, ry: deterministicNoise(map.seed, tileIndex, 121) * Math.PI, tileIndex });
    }
  }
  addFogInstances(new THREE.CylinderGeometry(0.035, 0.05, 0.36, 5),
    new THREE.MeshStandardMaterial({ color: 0x65472f, roughness: 1, flatShading: true }), trunks, true);
  addFogInstances(new THREE.ConeGeometry(0.28, 0.65, 6),
    new THREE.MeshStandardMaterial({ color: 0x315f42, roughness: 0.95, flatShading: true }), crowns, true);
  addFogInstances(new THREE.ConeGeometry(0.28, 0.55, 6),
    new THREE.MeshStandardMaterial({ color: 0x46784c, roughness: 0.95, flatShading: true }), upperCrowns, true);
  addFogInstances(new THREE.ConeGeometry(0.48, 0.9, 5),
    new THREE.MeshStandardMaterial({ color: 0x747872, roughness: 0.98, flatShading: true }), mountains, true);
  addFogInstances(new THREE.ConeGeometry(0.48, 0.45, 5),
    new THREE.MeshStandardMaterial({ color: 0xe3e5d9, roughness: 0.9, flatShading: true }), snow, true);
  addFogInstances(new THREE.DodecahedronGeometry(0.32, 0),
    new THREE.MeshStandardMaterial({ color: 0x77796e, roughness: 1, flatShading: true }), rocks, true);
  addFogInstances(new THREE.CylinderGeometry(0.012, 0.018, 0.36, 4),
    new THREE.MeshStandardMaterial({ color: 0x789155, roughness: 1, flatShading: true }), reeds);
  addFogInstances(new THREE.OctahedronGeometry(0.065, 0),
    new THREE.MeshStandardMaterial({ color: 0xe7bd6c, emissive: 0x3c2508, roughness: 0.7, flatShading: true }), flowers);

  if (fireflyPositions.length > 0) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(fireflyPositions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(new Array<number>(fireflyTileIndices.length * 3).fill(1), 3));
    const fireflies = new THREE.Points(geometry, new THREE.PointsMaterial({
      color: 0xffe69a,
      size: 0.055,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
      sizeAttenuation: true,
      vertexColors: true,
    }));
    fireflies.name = 'fireflies';
    environment.add(fireflies);
    fogPoints.push({
      points: fireflies,
      tileIndices: fireflyTileIndices,
      basePositions: new Float32Array(fireflyPositions),
    });
  }

  return { group, pickMeshes, water, foam, environment, fogInstances, fogPoints, fogColors };
}
