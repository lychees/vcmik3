import * as THREE from 'three';

interface FactoryMaterials {
  brick: THREE.MeshStandardMaterial;
  stone: THREE.MeshStandardMaterial;
  steel: THREE.MeshStandardMaterial;
  darkSteel: THREE.MeshStandardMaterial;
  brass: THREE.MeshStandardMaterial;
  copper: THREE.MeshStandardMaterial;
  wood: THREE.MeshStandardMaterial;
  glass: THREE.MeshStandardMaterial;
  glow: THREE.MeshStandardMaterial;
  blueprint: THREE.MeshStandardMaterial;
}

type BuildingId = 'halflingHovels' | 'automatonAssembly' | 'dreadnoughtFoundry' | 'juggernautHangar';
type Point = readonly [number, number, number];

interface DwellingDetails {
  creatureId: 'halfling' | 'automaton' | 'dreadnought' | 'juggernaut';
  tier: 1 | 2 | 3 | 4;
  form: 'hall' | 'industrial';
  scaffoldHeight: number;
  ghostSize: readonly [number, number, number];
  build: (group: THREE.Group, materials: FactoryMaterials) => void;
}

function material(color: number, roughness = 0.78, metalness = 0): THREE.MeshStandardMaterial {
  const result = new THREE.MeshStandardMaterial({ color, roughness, metalness, flatShading: true });
  result.userData.baseColor = color;
  return result;
}

function createMaterials(): FactoryMaterials {
  const glass = material(0x79b9b5, 0.3, 0.15);
  glass.emissive.setHex(0x326c6b);
  glass.emissiveIntensity = 0.35;
  const glow = material(0xf0a84d, 0.36, 0.12);
  glow.emissive.setHex(0xd56d24);
  glow.emissiveIntensity = 0.65;
  const blueprint = material(0x82c7c2, 0.45, 0.08);
  blueprint.transparent = true;
  blueprint.opacity = 0.2;
  blueprint.depthWrite = false;
  blueprint.emissive.setHex(0x326c6b);
  blueprint.emissiveIntensity = 0.35;
  return {
    brick: material(0x80654f),
    stone: material(0x625f55),
    steel: material(0x596768, 0.48, 0.62),
    darkSteel: material(0x303a3b, 0.56, 0.68),
    brass: material(0xc59a4b, 0.38, 0.72),
    copper: material(0xa86642, 0.46, 0.58),
    wood: material(0x664c37, 0.9),
    glass,
    glow,
    blueprint,
  };
}

function addMesh(
  parent: THREE.Object3D,
  geometry: THREE.BufferGeometry,
  surface: THREE.Material,
  x = 0,
  y = 0,
  z = 0,
): THREE.Mesh {
  const result = new THREE.Mesh(geometry, surface);
  result.position.set(x, y, z);
  result.castShadow = true;
  result.receiveShadow = true;
  parent.add(result);
  return result;
}

function box(
  parent: THREE.Object3D,
  width: number,
  height: number,
  depth: number,
  surface: THREE.Material,
  x = 0,
  y = 0,
  z = 0,
): THREE.Mesh {
  return addMesh(parent, new THREE.BoxGeometry(width, height, depth), surface, x, y, z);
}

function cylinder(
  parent: THREE.Object3D,
  top: number,
  bottom: number,
  height: number,
  segments: number,
  surface: THREE.Material,
  x = 0,
  y = 0,
  z = 0,
): THREE.Mesh {
  return addMesh(parent, new THREE.CylinderGeometry(top, bottom, height, segments), surface, x, y, z);
}

function cone(
  parent: THREE.Object3D,
  radius: number,
  height: number,
  segments: number,
  surface: THREE.Material,
  x = 0,
  y = 0,
  z = 0,
): THREE.Mesh {
  return addMesh(parent, new THREE.ConeGeometry(radius, height, segments), surface, x, y, z);
}

function torus(
  parent: THREE.Object3D,
  radius: number,
  tube: number,
  surface: THREE.Material,
  x = 0,
  y = 0,
  z = 0,
): THREE.Mesh {
  return addMesh(parent, new THREE.TorusGeometry(radius, tube, 6, 20), surface, x, y, z);
}

function beam(
  parent: THREE.Object3D,
  start: Point,
  end: Point,
  radius: number,
  surface: THREE.Material,
): THREE.Mesh {
  const origin = new THREE.Vector3(...start);
  const direction = new THREE.Vector3(...end).sub(origin);
  const result = addMesh(parent, new THREE.CylinderGeometry(radius, radius, direction.length(), 6), surface);
  result.position.copy(origin).addScaledVector(direction, 0.5);
  result.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  return result;
}

function gableRoof(
  parent: THREE.Object3D,
  width: number,
  depth: number,
  height: number,
  surface: THREE.Material,
  x: number,
  baseY: number,
  z: number,
): THREE.Mesh {
  const halfWidth = width / 2;
  const halfDepth = depth / 2;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([
    -halfWidth, 0, -halfDepth, halfWidth, 0, -halfDepth, 0, height, -halfDepth,
    -halfWidth, 0, halfDepth, halfWidth, 0, halfDepth, 0, height, halfDepth,
  ], 3));
  geometry.setIndex([
    0, 2, 1, 3, 4, 5,
    0, 3, 5, 0, 5, 2,
    1, 2, 5, 1, 5, 4,
    0, 1, 4, 0, 4, 3,
  ]);
  geometry.computeVertexNormals();
  return addMesh(parent, geometry, surface, x, baseY, z);
}

function addFoundation(parent: THREE.Object3D, materials: FactoryMaterials): void {
  box(parent, 3.35, 0.16, 3, materials.stone, 0, 0.08, 0);
  box(parent, 3.15, 0.06, 2.8, materials.darkSteel, 0, 0.19, 0);
  for (const x of [-1.45, 1.45]) {
    for (const z of [-1.25, 1.25]) {
      cylinder(parent, 0.075, 0.075, 0.05, 8, materials.brass, x, 0.245, z);
    }
  }
}

function addWindow(
  parent: THREE.Object3D,
  materials: FactoryMaterials,
  x: number,
  y: number,
  z: number,
  width = 0.3,
  height = 0.4,
): void {
  box(parent, width + 0.09, height + 0.09, 0.055, materials.brass, x, y, z);
  box(parent, width, height, 0.065, materials.glass, x, y, z + 0.025);
  box(parent, 0.035, height, 0.075, materials.darkSteel, x, y, z + 0.045);
  box(parent, width, 0.035, 0.075, materials.darkSteel, x, y, z + 0.045);
}

function addGear(
  parent: THREE.Object3D,
  materials: FactoryMaterials,
  x: number,
  y: number,
  z: number,
  radius: number,
): THREE.Group {
  const gear = new THREE.Group();
  gear.position.set(x, y, z);
  gear.userData.townAnimation = 'spinZ';
  parent.add(gear);
  torus(gear, radius, radius * 0.16, materials.brass);
  cylinder(gear, radius * 0.2, radius * 0.2, radius * 0.3, 10, materials.darkSteel).rotation.x = Math.PI / 2;
  for (let index = 0; index < 10; index += 1) {
    const angle = index * Math.PI * 2 / 10;
    const tooth = box(
      gear,
      radius * 0.24,
      radius * 0.38,
      radius * 0.25,
      materials.brass,
      Math.sin(angle) * radius,
      Math.cos(angle) * radius,
      0,
    );
    tooth.rotation.z = -angle;
  }
  return gear;
}

function addRoundDoor(
  parent: THREE.Object3D,
  materials: FactoryMaterials,
  x: number,
  baseY: number,
  z: number,
  radius: number,
): void {
  cylinder(parent, radius, radius, 0.065, 16, materials.darkSteel, x, baseY + radius, z).rotation.x = Math.PI / 2;
  torus(parent, radius, 0.045, materials.brass, x, baseY + radius, z + 0.045);
  addMesh(parent, new THREE.SphereGeometry(0.045, 8, 5), materials.brass,
    x + radius * 0.52, baseY + radius, z + 0.09);
}

function addChimney(
  parent: THREE.Object3D,
  materials: FactoryMaterials,
  x: number,
  z: number,
  bottom: number,
  height: number,
): void {
  cylinder(parent, 0.18, 0.25, height, 10, materials.darkSteel, x, bottom + height / 2, z);
  cylinder(parent, 0.27, 0.27, 0.12, 10, materials.brass, x, bottom + height * 0.45, z);
  cylinder(parent, 0.29, 0.21, 0.2, 10, materials.copper, x, bottom + height + 0.1, z);
}

function buildHalflingHovels(group: THREE.Group, materials: FactoryMaterials): void {
  box(group, 1.7, 1.05, 1.45, materials.brick, -0.45, 0.745, -0.25);
  gableRoof(group, 1.95, 1.7, 0.65, materials.steel, -0.45, 1.27, -0.25);
  box(group, 0.85, 0.85, 1.1, materials.brick, 0.95, 0.645, -0.45);
  gableRoof(group, 1.08, 1.32, 0.48, materials.copper, 0.95, 1.07, -0.45);
  addRoundDoor(group, materials, -0.55, 0.22, 0.51, 0.31);
  addRoundDoor(group, materials, 0.91, 0.22, 0.135, 0.25);
  addWindow(group, materials, 0.08, 0.88, 0.51, 0.25, 0.31);
  addWindow(group, materials, 1.19, 0.76, 0.135, 0.2, 0.27);
  box(group, 0.3, 1.08, 0.32, materials.brick, -1.02, 1.76, -0.65);
  box(group, 0.44, 0.16, 0.46, materials.brass, -1.02, 2.38, -0.65);
  const roofGear = addGear(group, materials, -0.08, 1.42, 0.51, 0.2);
  roofGear.name = 'hovel-roof-gear';

  const target = new THREE.Group();
  target.name = 'halfling-target';
  group.add(target);
  beam(target, [0.83, 0.22, 0.98], [1.05, 0.78, 0.98], 0.035, materials.wood);
  beam(target, [1.27, 0.22, 0.98], [1.05, 0.78, 0.98], 0.035, materials.wood);
  cylinder(target, 0.3, 0.3, 0.07, 16, materials.wood, 1.05, 0.94, 1.02).rotation.x = Math.PI / 2;
  cylinder(target, 0.21, 0.21, 0.075, 16, materials.brass, 1.05, 0.94, 1.065).rotation.x = Math.PI / 2;
  cylinder(target, 0.08, 0.08, 0.08, 12, materials.darkSteel, 1.05, 0.94, 1.11).rotation.x = Math.PI / 2;
  beam(target, [1.08, 0.96, 1.15], [1.08, 0.96, 1.4], 0.015, materials.steel);
}

function buildAutomatonAssembly(group: THREE.Group, materials: FactoryMaterials): void {
  box(group, 2.55, 1.55, 1.85, materials.brick, 0, 0.995, -0.35);
  for (const x of [-1.15, 1.15]) {
    box(group, 0.25, 1.8, 0.35, materials.steel, x, 1.12, 0.37);
  }
  box(group, 2.85, 0.18, 2.1, materials.darkSteel, 0, 1.86, -0.35);
  box(group, 1.25, 0.85, 1.1, materials.steel, 0, 2.375, -0.45);
  const crown = cone(group, 0.9, 0.55, 4, materials.copper, 0, 3.075, -0.45);
  crown.rotation.y = Math.PI / 4;
  crown.scale.z = 0.78;
  addChimney(group, materials, -0.96, -0.92, 1.77, 1.3);
  addChimney(group, materials, 0.96, -0.92, 1.77, 1.3);
  box(group, 1.15, 1.2, 0.075, materials.darkSteel, 0, 0.82, 0.61);
  for (const x of [-0.88, 0.88]) addWindow(group, materials, x, 1.14, 0.61, 0.32, 0.43);
  const crownGear = addGear(group, materials, 0, 2.36, 0.13, 0.29);
  crownGear.name = 'assembly-crown-gear';

  for (const x of [-1.12, 1.12]) {
    beam(group, [x, 0.22, 1.08], [x, 1.98, 1.08], 0.055, materials.steel);
  }
  beam(group, [-1.18, 1.98, 1.08], [1.18, 1.98, 1.08], 0.065, materials.brass);

  const automaton = new THREE.Group();
  automaton.name = 'automaton-assembly-arms';
  group.add(automaton);
  box(automaton, 0.56, 0.65, 0.38, materials.brass, 0, 0.93, 1.03);
  box(automaton, 0.43, 0.38, 0.4, materials.steel, 0, 1.455, 1.03);
  for (const side of [-1, 1]) {
    beam(automaton, [side * 0.16, 0.22, 1.03], [side * 0.16, 0.64, 1.03], 0.07, materials.darkSteel);
    box(automaton, 0.22, 0.12, 0.35, materials.steel, side * 0.16, 0.28, 1.08);
    beam(automaton, [side * 0.29, 1.15, 1.03], [side * 0.57, 0.88, 1.03], 0.075, materials.brass);
    beam(automaton, [side * 0.57, 0.88, 1.03], [side * 0.48, 0.58, 1.12], 0.06, materials.steel);
    addMesh(automaton, new THREE.SphereGeometry(0.045, 8, 5), materials.glow,
      side * 0.11, 1.49, 1.245);
  }
  addGear(automaton, materials, 0, 0.95, 1.245, 0.16);
}

function buildDreadnoughtFoundry(group: THREE.Group, materials: FactoryMaterials): void {
  box(group, 2.75, 1.85, 2.1, materials.brick, 0, 1.145, -0.25);
  for (const x of [-1.28, 1.28]) {
    box(group, 0.24, 1.55, 0.38, materials.steel, x, 0.995, 0.66);
  }
  gableRoof(group, 3.02, 2.36, 0.65, materials.darkSteel, 0, 2.07, -0.25);
  addChimney(group, materials, -0.78, -0.62, 2.35, 1.65);
  addChimney(group, materials, 0.78, -0.62, 2.25, 1.25);
  for (const x of [-0.88, 0.88]) addWindow(group, materials, x, 1.55, 0.835, 0.34, 0.43);
  box(group, 0.65, 0.85, 0.08, materials.darkSteel, 0.85, 0.645, 0.84);
  box(group, 0.45, 0.57, 0.09, materials.glow, 0.85, 0.59, 0.895);
  for (const x of [0.7, 0.85, 1]) {
    box(group, 0.035, 0.62, 0.04, materials.brass, x, 0.59, 0.96);
  }
  const foundryGear = addGear(group, materials, -0.96, 1.55, 0.85, 0.34);
  foundryGear.name = 'foundry-gear';
  beam(group, [1.39, 0.35, -0.55], [1.39, 2.35, -0.55], 0.065, materials.copper);
  beam(group, [1.39, 2.35, -0.55], [1.39, 2.35, 0.45], 0.065, materials.copper);

  const cannon = new THREE.Group();
  cannon.name = 'dreadnought-cannon';
  group.add(cannon);
  cylinder(cannon, 0.42, 0.5, 0.28, 12, materials.steel, -0.2, 0.48, 0.85);
  box(cannon, 0.65, 0.42, 0.72, materials.darkSteel, -0.2, 0.77, 0.85);
  cylinder(cannon, 0.13, 0.21, 1.2, 12, materials.steel, -0.2, 1.17, 0.9).rotation.x = Math.PI / 2;
  torus(cannon, 0.17, 0.055, materials.brass, -0.2, 1.17, 1.51);
  for (const side of [-1, 1]) {
    const wheel = torus(cannon, 0.31, 0.085, materials.brass, -0.2 + side * 0.48, 0.52, 0.88);
    wheel.rotation.y = Math.PI / 2;
    beam(cannon, [-0.2 + side * 0.48, 0.52, 0.88], [-0.2, 0.77, 0.85], 0.045, materials.darkSteel);
  }
}

function buildJuggernautHangar(group: THREE.Group, materials: FactoryMaterials): void {
  box(group, 2.9, 2.05, 2.15, materials.brick, 0, 1.245, -0.3);
  gableRoof(group, 3.18, 2.42, 0.75, materials.steel, 0, 2.27, -0.3);
  for (const x of [-1.25, 1.25]) {
    box(group, 0.42, 2.65, 0.55, materials.darkSteel, x, 1.545, -0.75);
    cone(group, 0.38, 0.5, 8, materials.copper, x, 3.12, -0.75);
  }
  box(group, 1.85, 1.7, 0.08, materials.darkSteel, 0, 1.07, 0.815);
  for (const x of [-0.82, -0.41, 0, 0.41, 0.82]) {
    box(group, 0.055, 1.68, 0.095, materials.brass, x, 1.07, 0.875);
  }
  box(group, 1.92, 0.1, 0.12, materials.steel, 0, 1.94, 0.86);
  const hangarGear = addGear(group, materials, 0, 2.43, 0.83, 0.39);
  hangarGear.name = 'hangar-gear';

  const crane = new THREE.Group();
  crane.name = 'hangar-crane';
  group.add(crane);
  box(crane, 0.22, 2, 0.22, materials.darkSteel, 0, 3.52, -0.75);
  box(crane, 2.5, 0.16, 0.18, materials.brass, 0, 4.44, -0.75);
  beam(crane, [0, 3.7, -0.75], [-1.12, 4.42, -0.75], 0.045, materials.steel);
  beam(crane, [0, 3.7, -0.75], [1.12, 4.42, -0.75], 0.045, materials.steel);
  cylinder(crane, 0.025, 0.025, 0.82, 6, materials.darkSteel, 0.86, 3.95, -0.75);
  const hook = torus(crane, 0.12, 0.035, materials.brass, 0.86, 3.49, -0.75);
  hook.scale.y = 1.25;
  const craneGear = addGear(crane, materials, 0, 4.62, -0.75, 0.25);
  craneGear.name = 'hangar-crane-gear';

  const engine = new THREE.Group();
  engine.name = 'juggernaut-siege-engine';
  group.add(engine);
  for (const side of [-1, 1]) {
    box(engine, 0.35, 0.36, 0.9, materials.darkSteel, side * 0.55, 0.4, 1.03);
    for (const z of [0.75, 1.03, 1.31]) {
      const wheel = torus(engine, 0.13, 0.045, materials.brass, side * 0.55, 0.4, z);
      wheel.rotation.y = Math.PI / 2;
    }
  }
  box(engine, 1.1, 0.55, 0.75, materials.steel, 0, 0.83, 1.03);
  cylinder(engine, 0.31, 0.36, 0.25, 10, materials.brass, 0, 1.23, 1.03);
  cylinder(engine, 0.1, 0.15, 0.85, 10, materials.darkSteel, 0, 1.31, 1.25).rotation.x = Math.PI / 2;
  torus(engine, 0.13, 0.04, materials.brass, 0, 1.31, 1.68);
}

function addConstructionSite(group: THREE.Group, materials: FactoryMaterials, details: DwellingDetails): void {
  const construction = new THREE.Group();
  construction.name = 'construction';
  group.add(construction);
  const height = details.scaffoldHeight;
  const top = 0.22 + height;
  for (const x of [-1.25, 1.25]) {
    for (const z of [-1, 1]) {
      cylinder(construction, 0.04, 0.055, height, 6, materials.wood, x, 0.22 + height / 2, z);
      cylinder(construction, 0.075, 0.075, 0.08, 8, materials.brass, x, 0.28, z);
    }
  }
  for (const z of [-1, 1]) {
    box(construction, 2.62, 0.09, 0.09, materials.wood, 0, top, z);
    beam(construction, [-1.25, 0.35, z], [1.25, top - 0.08, z], 0.03, materials.wood);
  }
  for (const x of [-1.25, 1.25]) {
    box(construction, 0.09, 0.09, 2.1, materials.wood, x, top, 0);
  }
  box(construction, 2.45, 0.3, 0.18, materials.brick, 0, 0.37, -0.82);
  box(construction, 0.18, 0.55, 1.4, materials.brick, -1.02, 0.495, -0.25);
  const [ghostWidth, ghostHeight, ghostDepth] = details.ghostSize;
  const ghost = box(construction, ghostWidth, ghostHeight, ghostDepth, materials.blueprint,
    0, 0.22 + ghostHeight / 2, -0.15);
  ghost.name = 'blueprint-ghost';
  for (let index = 0; index < 4; index += 1) {
    const supply = box(construction, 0.38, 0.18, 0.28,
      index % 2 === 0 ? materials.steel : materials.copper,
      -0.75 + index * 0.43, 0.31 + (index === 2 ? 0.12 : 0), 1.27);
    supply.rotation.y = index * 0.17;
  }
  beam(construction, [0.78, 0.24, 1.17], [1.13, 0.63, 1.17], 0.025, materials.wood);
  box(construction, 0.28, 0.12, 0.12, materials.steel, 1.15, 0.65, 1.17).rotation.z = -0.35;
}

const DWELLINGS: Readonly<Record<BuildingId, DwellingDetails>> = {
  halflingHovels: {
    creatureId: 'halfling', tier: 1, form: 'hall', scaffoldHeight: 1.25,
    ghostSize: [2.2, 0.95, 1.55], build: buildHalflingHovels,
  },
  automatonAssembly: {
    creatureId: 'automaton', tier: 2, form: 'industrial', scaffoldHeight: 1.65,
    ghostSize: [2.35, 1.35, 1.7], build: buildAutomatonAssembly,
  },
  dreadnoughtFoundry: {
    creatureId: 'dreadnought', tier: 3, form: 'industrial', scaffoldHeight: 2.05,
    ghostSize: [2.55, 1.65, 1.85], build: buildDreadnoughtFoundry,
  },
  juggernautHangar: {
    creatureId: 'juggernaut', tier: 4, form: 'industrial', scaffoldHeight: 2.4,
    ghostSize: [2.75, 1.95, 2], build: buildJuggernautHangar,
  },
};

function createDwelling(id: BuildingId, built: boolean): THREE.Group {
  const details = DWELLINGS[id];
  const group = new THREE.Group();
  const materials = createMaterials();
  addFoundation(group, materials);
  if (built) {
    const completed = new THREE.Group();
    completed.name = 'completed';
    group.add(completed);
    details.build(completed, materials);
  } else {
    addConstructionSite(group, materials, details);
  }
  group.name = id;
  group.userData.faction = 'factory';
  group.userData.buildingId = id;
  group.userData.creatureId = details.creatureId;
  group.userData.tier = details.tier;
  group.userData.form = details.form;
  group.userData.built = built;
  group.userData.constructionState = built ? 'complete' : 'underConstruction';
  return group;
}

const factoryModelPack = {
  faction: 'Factory',
  createBuildingModel(buildingId: string, built: boolean): THREE.Group | null {
    if (!Object.hasOwn(DWELLINGS, buildingId)) return null;
    return createDwelling(buildingId as BuildingId, built);
  },
};

export default factoryModelPack;
