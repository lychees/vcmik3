import * as THREE from 'three';

function material(color: number, extra: THREE.MeshStandardMaterialParameters = {}): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.76, ...extra });
}

function mesh(
  group: THREE.Group,
  geometry: THREE.BufferGeometry,
  surface: THREE.Material,
  position: [number, number, number],
  scale: [number, number, number] = [1, 1, 1],
): THREE.Mesh {
  const result = new THREE.Mesh(geometry, surface);
  result.position.set(...position);
  result.scale.set(...scale);
  result.castShadow = true;
  result.receiveShadow = true;
  group.add(result);
  return result;
}

function box(
  group: THREE.Group,
  size: [number, number, number],
  surface: THREE.Material,
  position: [number, number, number],
): THREE.Mesh {
  return mesh(group, new THREE.BoxGeometry(...size), surface, position);
}

function addSwirl(group: THREE.Group, index: number, surface: THREE.Material): void {
  const points: THREE.Vector3[] = [];
  for (let step = 0; step <= 24; step += 1) {
    const amount = step / 24;
    const angle = amount * Math.PI * 2.15 + index * Math.PI * 2 / 3;
    const radius = 0.045 + amount * 0.41;
    points.push(new THREE.Vector3(
      Math.cos(angle) * radius,
      Math.sin(angle) * radius * 1.2,
      0.045 + index * 0.008,
    ));
  }
  const curve = new THREE.CatmullRomCurve3(points);
  const swirl = mesh(group, new THREE.TubeGeometry(curve, 40, 0.018, 5, false), surface, [0, 1.04, 0]);
  swirl.name = `portal-swirl-${index}`;
  swirl.userData.portalDetail = 'swirl';
  swirl.renderOrder = 2;
}

export function createWayfarerPortalModel(): THREE.Group {
  const group = new THREE.Group();
  const stone = material(0x718593, { roughness: 0.88 });
  const darkStone = material(0x405565, { roughness: 0.9 });
  const trim = material(0xa9c6cf, { metalness: 0.18, roughness: 0.5 });
  const glow = material(0x7ce6f2, {
    emissive: 0x2798b3,
    emissiveIntensity: 1.15,
    metalness: 0.08,
    roughness: 0.25,
  });
  const veil = material(0x499bc5, {
    emissive: 0x245b91,
    emissiveIntensity: 0.85,
    transparent: true,
    opacity: 0.5,
    side: THREE.DoubleSide,
    depthWrite: false,
    roughness: 0.3,
  });

  box(group, [1.85, 0.12, 0.72], darkStone, [0, 0.06, 0]).name = 'portal-step-lower';
  box(group, [1.58, 0.08, 0.58], stone, [0, 0.16, 0]).name = 'portal-step-upper';

  for (const side of [-1, 1]) {
    const label = side < 0 ? 'left' : 'right';
    const x = side * 0.67;
    box(group, [0.42, 0.18, 0.46], darkStone, [x, 0.29, 0]);
    const pillar = box(group, [0.28, 1.22, 0.34], stone, [x, 0.91, 0]);
    pillar.name = `portal-pillar-${label}`;
    pillar.userData.portalDetail = 'pillar';
    box(group, [0.4, 0.16, 0.44], trim, [x, 1.52, 0]);
    for (let index = 0; index < 3; index += 1) {
      const rune = mesh(group, new THREE.OctahedronGeometry(0.055, 0), glow, [x, 0.72 + index * 0.28, 0.19], [0.65, 1.25, 0.35]);
      rune.name = `portal-rune-${label}-${index}`;
    }
  }

  const arch = mesh(group, new THREE.TorusGeometry(0.67, 0.12, 7, 28, Math.PI), trim, [0, 1.46, 0]);
  arch.name = 'portal-arch';
  arch.userData.portalDetail = 'arch';
  box(group, [0.24, 0.24, 0.3], darkStone, [0, 2.15, 0]).rotation.z = Math.PI / 4;
  const crystal = mesh(group, new THREE.OctahedronGeometry(0.13, 0), glow, [0, 2.32, 0], [0.85, 1.3, 0.85]);
  crystal.name = 'portal-keystone-crystal';

  const surface = mesh(group, new THREE.CircleGeometry(0.53, 32), veil, [0, 1.04, 0], [1, 1.22, 1]);
  surface.name = 'portal-surface';
  surface.userData.portalDetail = 'surface';
  surface.castShadow = false;
  surface.receiveShadow = false;
  surface.renderOrder = 1;
  for (let index = 0; index < 3; index += 1) addSwirl(group, index, glow);

  group.name = 'landmark-wayfarerPortal';
  const bounds = new THREE.Box3().setFromObject(group);
  group.userData.landmarkId = 'wayfarerPortal';
  group.userData.objectKind = 'landmark';
  group.userData.animationPivot = 'ground';
  group.userData.visualHeight = bounds.max.y - bounds.min.y;
  group.userData.labelHeight = bounds.max.y + 0.45;
  group.userData.swirlCount = 3;
  return group;
}
