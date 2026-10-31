import * as THREE from 'three';

export function disposeBattleResources(
  root: THREE.Object3D,
  additionalTextures: Iterable<THREE.Texture> = [],
): void {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>(additionalTextures);
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh) && !(object instanceof THREE.Sprite)) return;
    if ('geometry' in object && object.geometry instanceof THREE.BufferGeometry) geometries.add(object.geometry);
    const objectMaterials = Array.isArray(object.material) ? object.material : [object.material];
    for (const surface of objectMaterials) {
      materials.add(surface);
      if (surface instanceof THREE.SpriteMaterial && surface.map) textures.add(surface.map);
      if (surface instanceof THREE.MeshStandardMaterial && surface.map) textures.add(surface.map);
    }
  });
  for (const geometry of geometries) geometry.dispose();
  for (const texture of textures) texture.dispose();
  for (const surface of materials) surface.dispose();
}
