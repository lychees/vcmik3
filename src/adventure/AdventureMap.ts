import * as THREE from 'three';
import { getCreature, getTerrain } from '../game/content';
import type { GameStore } from '../game/GameStore';
import type {
  AdventureMap as AdventureMapData,
  GameState,
  HeroState,
  InteractionResult,
  MapObject,
  MovementResult,
  Point,
  ReachableTile,
} from '../game/types';
import { TILE_SIZE, clamp, samePoint, tileElevation, tileToWorld } from './coordinates';
import {
  createGroundMarker,
  createHeroModel,
  createObjectModel,
  type AdventureModel,
} from './models';
import {
  createMapSnapshot,
  createTravelTimeline,
  describeArmy,
  formatResources,
  sampleTravel,
  type AdventureMapSnapshot,
  type TravelTimeline,
} from './presentation';
import { ADVENTURE_STYLES } from './styles';
import { applyTerrainFog, buildTerrain, type TerrainVisuals } from './terrain';

export interface AdventureCameraState {
  target: { x: number; z: number };
  zoom: number;
  yaw: number;
  pitch: number;
}

export interface AdventureInteractionDetail {
  interaction: InteractionResult;
  heroId: string;
  movement?: MovementResult;
}

type PickTarget =
  | { kind: 'hero'; id: string; point: Point }
  | { kind: 'object'; id: string; point: Point }
  | { kind: 'tile'; point: Point };

interface ObjectVisual extends AdventureModel {
  signature: string;
  pickMeshes: THREE.Mesh[];
}

interface HeroVisual extends AdventureModel {
  signature: string;
  pickMeshes: THREE.Mesh[];
}

interface PendingAction {
  heroId: string;
  path: Point[];
}

interface ActiveTravel {
  heroId: string;
  destination: Point;
  startedAt: number;
  timeline: TravelTimeline;
}

interface PointerGesture {
  id: number;
  button: number;
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  dragging: boolean;
}

const VIEW_SIZE = 18;
const MIN_ZOOM = 0.55;
const MAX_ZOOM = 3.2;

function disposeObject(object: THREE.Object3D): void {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh) && !(child instanceof THREE.Points) && !(child instanceof THREE.Line)) return;
    geometries.add(child.geometry);
    const childMaterials = Array.isArray(child.material) ? child.material : [child.material];
    for (const surface of childMaterials) materials.add(surface);
  });
  for (const geometry of geometries) geometry.dispose();
  for (const surface of materials) surface.dispose();
}

function clearGroup(group: THREE.Group): void {
  for (const child of [...group.children]) {
    group.remove(child);
    disposeObject(child);
  }
}

function modelMeshes(group: THREE.Group, pick: PickTarget): THREE.Mesh[] {
  const meshes: THREE.Mesh[] = [];
  group.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    child.userData.adventurePick = pick;
    meshes.push(child);
  });
  return meshes;
}

function applyModelFog(model: AdventureModel, visible: boolean): void {
  model.group.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    const surfaces = Array.isArray(child.material) ? child.material : [child.material];
    for (const surface of surfaces) {
      if (!('color' in surface) || !(surface.color instanceof THREE.Color)) continue;
      const base = typeof surface.userData.fogBaseColor === 'number'
        ? surface.userData.fogBaseColor
        : surface.color.getHex();
      surface.userData.fogBaseColor = base;
      surface.color.setHex(base);
      if (!visible) surface.color.multiplyScalar(0.53);
    }
  });
}

function objectSignature(object: MapObject, state: Readonly<GameState>): string {
  return JSON.stringify([
    object,
    object.kind === 'town' ? state.towns[object.townId] : null,
  ]);
}

export class AdventureMap {
  private readonly container: HTMLElement;
  private readonly store: GameStore;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 180);
  private readonly renderer: THREE.WebGLRenderer;
  private readonly root: HTMLDivElement;
  private readonly tooltip: HTMLDivElement;
  private readonly heroCard: HTMLDivElement;
  private readonly status: HTMLDivElement;
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointerNdc = new THREE.Vector2();
  private readonly cameraTarget = new THREE.Vector3();
  private readonly pathGroup = new THREE.Group();
  private readonly tileOverlays = new THREE.Group();
  private readonly selectionRing = createGroundMarker(0xffdc78, 0.56);
  private readonly hoverRing = createGroundMarker(0x8ce6c1, 0.5);
  private readonly abort = new AbortController();
  private readonly unsubscribe: () => void;
  private readonly sun = new THREE.DirectionalLight(0xffe5b0, 2.8);
  private resizeObserver: ResizeObserver | null = null;
  private state: Readonly<GameState>;
  private mapSource: AdventureMapData | null = null;
  private terrain: TerrainVisuals | null = null;
  private unknownFog: THREE.InstancedMesh | null = null;
  private exploredFog: THREE.InstancedMesh | null = null;
  private reachableOverlay: THREE.InstancedMesh | null = null;
  private readonly objectVisuals = new Map<string, ObjectVisual>();
  private readonly heroVisuals = new Map<string, HeroVisual>();
  private reachable: ReachableTile[] = [];
  private hover: PickTarget | null = null;
  private pathKey = '';
  private pendingAction: PendingAction | null = null;
  private activeTravel: ActiveTravel | null = null;
  private pointerGesture: PointerGesture | null = null;
  private yaw = Math.PI * 0.23;
  private pitch = 0.88;
  private disposed = false;
  private restoreContainerPosition: string | null = null;

  constructor(container: HTMLElement, store: GameStore) {
    this.container = container;
    this.store = store;
    this.state = store.getState();

    if (getComputedStyle(container).position === 'static') {
      this.restoreContainerPosition = container.style.position;
      container.style.position = 'relative';
    }
    this.root = document.createElement('div');
    this.root.className = 'h3-adventure';
    this.root.setAttribute('aria-label', 'Three-dimensional adventure map');
    const style = document.createElement('style');
    style.textContent = ADVENTURE_STYLES;
    this.root.appendChild(style);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const canvas = this.renderer.domElement;
    canvas.tabIndex = 0;
    canvas.setAttribute('role', 'application');
    canvas.setAttribute('aria-label', 'Adventure map. Click a hero to select, then click a reachable destination to travel.');
    this.root.appendChild(canvas);

    const vignette = document.createElement('div');
    vignette.className = 'h3-adventure__vignette';
    this.root.appendChild(vignette);
    const toolbar = document.createElement('div');
    toolbar.className = 'h3-adventure__toolbar';
    toolbar.setAttribute('aria-label', 'Camera controls');
    this.addCameraButton(toolbar, '+', 'Zoom in', () => this.zoomBy(1.2));
    this.addCameraButton(toolbar, '−', 'Zoom out', () => this.zoomBy(1 / 1.2));
    this.addCameraButton(toolbar, '↶', 'Rotate left', () => this.rotateBy(-Math.PI / 8, 0));
    this.addCameraButton(toolbar, '↻', 'Rotate right', () => this.rotateBy(Math.PI / 8, 0));
    this.addCameraButton(toolbar, '◎', 'Focus selected hero', () => this.focusSelectedHero());
    this.root.appendChild(toolbar);

    this.heroCard = document.createElement('div');
    this.heroCard.className = 'h3-adventure__hero';
    this.root.appendChild(this.heroCard);
    const hint = document.createElement('div');
    hint.className = 'h3-adventure__hint';
    hint.textContent = 'Click to travel · Drag to pan · Right-drag to rotate · Wheel to zoom';
    this.root.appendChild(hint);
    this.tooltip = document.createElement('div');
    this.tooltip.className = 'h3-adventure__tooltip';
    this.tooltip.setAttribute('role', 'tooltip');
    this.tooltip.hidden = true;
    this.root.appendChild(this.tooltip);
    this.status = document.createElement('div');
    this.status.className = 'h3-adventure__status';
    this.status.setAttribute('role', 'status');
    this.status.setAttribute('aria-live', 'polite');
    this.root.appendChild(this.status);
    container.appendChild(this.root);

    this.scene.background = new THREE.Color(0x86aaa2);
    this.scene.fog = new THREE.Fog(0x86aaa2, 42, 88);
    const hemisphere = new THREE.HemisphereLight(0xe9f4dd, 0x29473e, 2.25);
    this.scene.add(hemisphere);
    this.sun.position.set(-18, 30, 16);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.bias = -0.00035;
    this.sun.shadow.normalBias = 0.025;
    this.scene.add(this.sun, this.sun.target);
    const fill = new THREE.DirectionalLight(0x9fd5ce, 0.55);
    fill.position.set(16, 12, -18);
    this.scene.add(fill);
    this.scene.add(this.pathGroup, this.tileOverlays, this.selectionRing, this.hoverRing);
    this.pathGroup.renderOrder = 6;
    this.selectionRing.renderOrder = 7;
    this.hoverRing.renderOrder = 7;

    this.bindEvents();
    this.unsubscribe = store.subscribe(this.onState);
    this.syncState(this.state);
    this.resize();
    const selected = store.getSelectedHero();
    this.focusOn(selected?.position ?? { x: this.state.map.width / 2, y: this.state.map.height / 2 }, 1.05);
    this.renderer.setAnimationLoop(this.animate);

    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(this.resize);
      this.resizeObserver.observe(container);
    }
  }

  private addCameraButton(parent: HTMLElement, label: string, title: string, action: () => void): void {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.title = title;
    button.setAttribute('aria-label', title);
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      action();
    }, { signal: this.abort.signal });
    parent.appendChild(button);
  }

  private bindEvents(): void {
    const canvas = this.renderer.domElement;
    const signal = this.abort.signal;
    canvas.addEventListener('pointerdown', this.onPointerDown, { signal });
    canvas.addEventListener('pointermove', this.onPointerMove, { signal });
    canvas.addEventListener('pointerup', this.onPointerUp, { signal });
    canvas.addEventListener('pointercancel', this.onPointerCancel, { signal });
    canvas.addEventListener('pointerleave', this.onPointerLeave, { signal });
    canvas.addEventListener('wheel', this.onWheel, { passive: false, signal });
    canvas.addEventListener('contextmenu', (event) => event.preventDefault(), { signal });
    canvas.addEventListener('keydown', this.onKeyDown, { signal });
    window.addEventListener('resize', this.resize, { signal });
  }

  private readonly onState = (state: Readonly<GameState>): void => {
    if (this.disposed) return;
    const pending = this.pendingAction;
    if (pending) {
      const hero = Object.hasOwn(state.heroes, pending.heroId) ? state.heroes[pending.heroId] : undefined;
      const destination = pending.path[pending.path.length - 1];
      if (hero?.alive && destination && samePoint(hero.position, destination)) {
        this.startTravel(pending.heroId, pending.path);
      }
    }
    this.syncState(state);
  };

  private syncState(state: Readonly<GameState>): void {
    this.state = state;
    this.clearHover();
    if (this.mapSource !== state.map) this.rebuildMap(state.map);
    this.syncObjects();
    this.syncHeroes();
    this.updateFog();
    this.updateReachable();
    this.updateHeroCard();
  }

  private rebuildMap(map: AdventureMapData): void {
    if (this.terrain) {
      this.scene.remove(this.terrain.group);
      disposeObject(this.terrain.group);
    }
    for (const visual of this.objectVisuals.values()) {
      this.scene.remove(visual.group);
      disposeObject(visual.group);
    }
    for (const visual of this.heroVisuals.values()) {
      this.scene.remove(visual.group);
      disposeObject(visual.group);
    }
    this.objectVisuals.clear();
    this.heroVisuals.clear();
    this.activeTravel = null;
    this.pendingAction = null;
    this.hover = null;
    clearGroup(this.pathGroup);
    clearGroup(this.tileOverlays);
    this.mapSource = map;
    this.terrain = buildTerrain(map);
    this.scene.add(this.terrain.group);
    this.createTileOverlays(map.tiles.length);
    const shadowExtent = Math.max(map.width, map.height) * TILE_SIZE * 0.7;
    this.sun.shadow.camera.left = -shadowExtent;
    this.sun.shadow.camera.right = shadowExtent;
    this.sun.shadow.camera.top = shadowExtent;
    this.sun.shadow.camera.bottom = -shadowExtent;
    this.sun.shadow.camera.far = 100;
    this.sun.shadow.camera.updateProjectionMatrix();
    this.cameraTarget.x = clamp(this.cameraTarget.x, -map.width * TILE_SIZE / 2, map.width * TILE_SIZE / 2);
    this.cameraTarget.z = clamp(this.cameraTarget.z, -map.height * TILE_SIZE / 2, map.height * TILE_SIZE / 2);
  }

  private createTileOverlays(count: number): void {
    const geometry = new THREE.PlaneGeometry(TILE_SIZE * 1.015, TILE_SIZE * 1.015);
    geometry.rotateX(-Math.PI / 2);
    const create = (color: number, opacity: number, order: number): THREE.InstancedMesh => {
      const mesh = new THREE.InstancedMesh(geometry, new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity,
        depthWrite: false,
        side: THREE.DoubleSide,
      }), count);
      mesh.count = 0;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.frustumCulled = false;
      mesh.renderOrder = order;
      this.tileOverlays.add(mesh);
      return mesh;
    };
    this.unknownFog = create(0x10201f, 1, 3);
    this.exploredFog = create(0x19342f, 0.38, 3);
    this.reachableOverlay = create(0x8ce6b5, 0.2, 4);
  }

  private setOverlayTiles(mesh: THREE.InstancedMesh | null, indices: readonly number[], lift: number): void {
    if (!mesh || !this.mapSource) return;
    const dummy = new THREE.Object3D();
    let count = 0;
    for (const tileIndex of indices) {
      const tile = this.mapSource.tiles[tileIndex];
      if (!tile) continue;
      const world = tileToWorld(this.mapSource, tile, tileElevation(tile) + lift);
      dummy.position.set(world.x, world.y, world.z);
      dummy.updateMatrix();
      mesh.setMatrixAt(count, dummy.matrix);
      count += 1;
    }
    mesh.count = count;
    mesh.instanceMatrix.needsUpdate = true;
  }

  private syncObjects(): void {
    const currentIds = new Set(Object.keys(this.state.map.objects));
    for (const [id, visual] of this.objectVisuals) {
      if (currentIds.has(id)) continue;
      this.scene.remove(visual.group);
      disposeObject(visual.group);
      this.objectVisuals.delete(id);
    }
    const fog = this.state.fog[this.state.activePlayerId];
    const visible = new Set(fog?.visible ?? []);
    const explored = new Set(fog?.explored ?? []);
    for (const object of Object.values(this.state.map.objects)) {
      const signature = objectSignature(object, this.state);
      let visual = this.objectVisuals.get(object.id);
      if (!visual || visual.signature !== signature) {
        if (visual) {
          this.scene.remove(visual.group);
          disposeObject(visual.group);
        }
        const model = createObjectModel(object, this.state);
        const world = tileToWorld(this.state.map, object.position,
          this.state.map.tiles[object.position.y * this.state.map.width + object.position.x]
            ? tileElevation(this.state.map.tiles[object.position.y * this.state.map.width + object.position.x]!) : 0);
        model.group.position.set(world.x, world.y, world.z);
        model.group.name = `object-${object.id}`;
        const pickMeshes = modelMeshes(model.group, { kind: 'object', id: object.id, point: object.position });
        this.scene.add(model.group);
        visual = { ...model, signature, pickMeshes };
        this.objectVisuals.set(object.id, visual);
      }
      const tileIndex = object.position.y * this.state.map.width + object.position.x;
      const owned = object.kind === 'mine'
        ? object.ownerId === this.state.activePlayerId
        : object.kind === 'town' && this.state.towns[object.townId]?.ownerId === this.state.activePlayerId;
      visual.group.visible = explored.has(tileIndex) || owned;
      applyModelFog(visual, visible.has(tileIndex) || owned);
    }
  }

  private syncHeroes(): void {
    for (const [id, visual] of this.heroVisuals) {
      const hero = Object.hasOwn(this.state.heroes, id) ? this.state.heroes[id] : undefined;
      if (hero?.alive) continue;
      this.scene.remove(visual.group);
      disposeObject(visual.group);
      this.heroVisuals.delete(id);
    }
    const visible = new Set(this.state.fog[this.state.activePlayerId]?.visible ?? []);
    for (const hero of Object.values(this.state.heroes)) {
      if (!hero.alive) continue;
      const signature = `${hero.definitionId}:${hero.ownerId}`;
      let visual = this.heroVisuals.get(hero.id);
      if (!visual || visual.signature !== signature) {
        if (visual) {
          this.scene.remove(visual.group);
          disposeObject(visual.group);
        }
        const model = createHeroModel(hero, this.state.players[hero.ownerId]?.color ?? '#dddddd');
        const pickMeshes = modelMeshes(model.group, { kind: 'hero', id: hero.id, point: hero.position });
        model.group.name = `hero-${hero.id}`;
        this.scene.add(model.group);
        visual = { ...model, signature, pickMeshes };
        this.heroVisuals.set(hero.id, visual);
      }
      const tileIndex = hero.position.y * this.state.map.width + hero.position.x;
      visual.group.visible = hero.ownerId === this.state.activePlayerId || visible.has(tileIndex);
      for (const mesh of visual.pickMeshes) {
        mesh.userData.adventurePick = { kind: 'hero', id: hero.id, point: hero.position };
      }
      if (this.activeTravel?.heroId !== hero.id) this.placeHero(visual.group, hero);
    }
  }

  private placeHero(group: THREE.Group, hero: HeroState): void {
    const tile = this.state.map.tiles[hero.position.y * this.state.map.width + hero.position.x];
    const world = tileToWorld(this.state.map, hero.position, tile ? tileElevation(tile) + 0.04 : 0.04);
    group.position.set(world.x, world.y, world.z);
  }

  private updateFog(): void {
    const fog = this.state.fog[this.state.activePlayerId];
    const visible = new Set(fog?.visible ?? []);
    const explored = new Set(fog?.explored ?? []);
    const unknown: number[] = [];
    const dimmed: number[] = [];
    for (let index = 0; index < this.state.map.tiles.length; index += 1) {
      if (!explored.has(index)) unknown.push(index);
      else if (!visible.has(index)) dimmed.push(index);
    }
    this.setOverlayTiles(this.unknownFog, unknown, 0.052);
    this.setOverlayTiles(this.exploredFog, dimmed, 0.053);
    if (this.terrain) applyTerrainFog(this.terrain, visible, explored);
  }

  private updateReachable(): void {
    const hero = this.store.getSelectedHero();
    const canMove = hero?.alive && hero.ownerId === this.state.activePlayerId &&
      this.state.phase === 'playing' && !this.state.pendingBattle && !this.activeTravel;
    this.reachable = canMove && hero ? this.store.getReachableTiles(hero.id) : [];
    const explored = new Set(this.state.fog[this.state.activePlayerId]?.explored ?? []);
    this.setOverlayTiles(this.reachableOverlay,
      this.reachable.filter((tile) => explored.has(tile.tileIndex)).map((tile) => tile.tileIndex), 0.046);
  }

  private updateHeroCard(): void {
    const hero = this.store.getSelectedHero();
    const name = document.createElement('strong');
    const details = document.createElement('span');
    if (hero) {
      name.textContent = `${hero.name} · Level ${hero.level}`;
      details.textContent = `Movement ${hero.movementPoints} / ${hero.maxMovementPoints} · ${describeArmy(hero.army)}`;
    } else {
      name.textContent = 'No hero selected';
      details.textContent = 'Select one of your heroes on the map.';
    }
    this.heroCard.replaceChildren(name, details);
  }

  private startTravel(heroId: string, path: readonly Point[]): void {
    const destination = path[path.length - 1];
    if (!destination || path.length < 2) return;
    this.activeTravel = {
      heroId,
      destination: { ...destination },
      startedAt: performance.now(),
      timeline: createTravelTimeline(this.state, path),
    };
    const visual = this.heroVisuals.get(heroId);
    const first = sampleTravel(this.activeTravel.timeline, 0);
    if (visual && first) visual.group.position.set(first.x, first.y, first.z);
  }

  private readonly animate = (time: number): void => {
    if (this.disposed) return;
    const seconds = time * 0.001;
    if (this.terrain?.water) this.terrain.water.position.y = Math.sin(seconds * 1.35) * 0.018;
    if (this.terrain) {
      this.terrain.foam.position.y = Math.sin(seconds * 1.35 + 0.5) * 0.012;
      const fireflies = this.terrain.environment.getObjectByName('fireflies');
      if (fireflies) fireflies.position.y = Math.sin(seconds * 0.8) * 0.055;
    }
    let flagIndex = 0;
    for (const visual of [...this.objectVisuals.values(), ...this.heroVisuals.values()]) {
      for (const flag of visual.flags) {
        flag.rotation.y = Math.sin(seconds * 2.1 + flagIndex * 0.7) * 0.13;
        flagIndex += 1;
      }
    }
    if (this.activeTravel) {
      const travel = this.activeTravel;
      const hero = Object.hasOwn(this.state.heroes, travel.heroId) ? this.state.heroes[travel.heroId] : undefined;
      const visual = this.heroVisuals.get(travel.heroId);
      if (!hero?.alive || !visual || !samePoint(hero.position, travel.destination)) {
        this.activeTravel = null;
        if (hero && visual) this.placeHero(visual.group, hero);
        this.updateReachable();
      } else {
        const elapsed = (time - travel.startedAt) / 1000;
        const position = sampleTravel(travel.timeline, elapsed);
        const ahead = sampleTravel(travel.timeline, elapsed + 0.06);
        if (position) {
          visual.group.position.set(position.x, position.y + Math.abs(Math.sin(elapsed * 15)) * 0.025, position.z);
          if (ahead && Math.hypot(ahead.x - position.x, ahead.z - position.z) > 0.001) {
            visual.group.rotation.y = Math.atan2(-(ahead.x - position.x), -(ahead.z - position.z));
          }
        }
        if (elapsed >= travel.timeline.duration) {
          this.activeTravel = null;
          this.placeHero(visual.group, hero);
          this.updateReachable();
          this.updateHeroCard();
          this.refreshHover(true);
          this.showStatus(`${hero.name} arrived. ${hero.movementPoints} movement remaining.`);
        }
      }
    }
    const selectedId = this.state.selectedHeroId;
    const selectedVisual = selectedId ? this.heroVisuals.get(selectedId) : undefined;
    this.selectionRing.visible = Boolean(selectedVisual?.group.visible);
    if (selectedVisual) {
      this.selectionRing.position.copy(selectedVisual.group.position);
      this.selectionRing.position.y += 0.035;
      const pulse = 1 + Math.sin(seconds * 3.5) * 0.045;
      this.selectionRing.scale.setScalar(pulse);
    }
    this.hoverRing.scale.setScalar(1 + Math.sin(seconds * 4.2) * 0.035);
    this.pathGroup.position.y = Math.sin(seconds * 3) * 0.008;
    this.renderer.render(this.scene, this.camera);
  };

  readonly resize = (): void => {
    if (this.disposed) return;
    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    const aspect = width / height;
    this.camera.left = -VIEW_SIZE * aspect / 2;
    this.camera.right = VIEW_SIZE * aspect / 2;
    this.camera.top = VIEW_SIZE / 2;
    this.camera.bottom = -VIEW_SIZE / 2;
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(width, height, false);
  };

  private updateCamera(): void {
    const distance = 44;
    const horizontal = Math.cos(this.pitch) * distance;
    this.camera.position.set(
      this.cameraTarget.x + Math.sin(this.yaw) * horizontal,
      this.cameraTarget.y + Math.sin(this.pitch) * distance,
      this.cameraTarget.z + Math.cos(this.yaw) * horizontal,
    );
    this.camera.lookAt(this.cameraTarget);
  }

  private panBy(deltaX: number, deltaY: number): void {
    const worldPerPixel = VIEW_SIZE / this.camera.zoom / Math.max(1, this.container.clientHeight);
    const dx = deltaX * worldPerPixel;
    const dy = deltaY * worldPerPixel;
    this.cameraTarget.x += -Math.cos(this.yaw) * dx - Math.sin(this.yaw) * dy;
    this.cameraTarget.z += Math.sin(this.yaw) * dx - Math.cos(this.yaw) * dy;
    this.cameraTarget.x = clamp(this.cameraTarget.x,
      -this.state.map.width * TILE_SIZE / 2, this.state.map.width * TILE_SIZE / 2);
    this.cameraTarget.z = clamp(this.cameraTarget.z,
      -this.state.map.height * TILE_SIZE / 2, this.state.map.height * TILE_SIZE / 2);
    this.updateCamera();
  }

  private zoomBy(factor: number): void {
    this.camera.zoom = clamp(this.camera.zoom * factor, MIN_ZOOM, MAX_ZOOM);
    this.camera.updateProjectionMatrix();
  }

  private rotateBy(yawDelta: number, pitchDelta: number): void {
    this.yaw = Math.atan2(Math.sin(this.yaw + yawDelta), Math.cos(this.yaw + yawDelta));
    this.pitch = clamp(this.pitch + pitchDelta, 0.55, 1.18);
    this.updateCamera();
  }

  private focusSelectedHero(): void {
    const hero = this.store.getSelectedHero();
    if (hero) this.focusOn(hero.position);
    else this.focusOn({ x: this.state.map.width / 2, y: this.state.map.height / 2 });
  }

  focusOn(position: Point, zoom?: number): void {
    const world = tileToWorld(this.state.map, position);
    this.cameraTarget.set(world.x, 0, world.z);
    if (zoom !== undefined && Number.isFinite(zoom)) {
      this.camera.zoom = clamp(zoom, MIN_ZOOM, MAX_ZOOM);
      this.camera.updateProjectionMatrix();
    }
    this.updateCamera();
  }

  getCameraState(): AdventureCameraState {
    return {
      target: { x: this.cameraTarget.x, z: this.cameraTarget.z },
      zoom: this.camera.zoom,
      yaw: this.yaw,
      pitch: this.pitch,
    };
  }

  getMapState(): AdventureMapSnapshot {
    return createMapSnapshot(this.state, this.reachable);
  }

  private readonly onPointerDown = (event: PointerEvent): void => {
    if (event.button > 2 || this.pointerGesture) return;
    this.renderer.domElement.focus({ preventScroll: true });
    this.pointerGesture = {
      id: event.pointerId,
      button: event.button,
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      lastY: event.clientY,
      dragging: false,
    };
    this.renderer.domElement.setPointerCapture(event.pointerId);
    event.preventDefault();
  };

  private readonly onPointerMove = (event: PointerEvent): void => {
    const gesture = this.pointerGesture;
    if (gesture?.id === event.pointerId) {
      const totalDistance = Math.hypot(event.clientX - gesture.startX, event.clientY - gesture.startY);
      if (totalDistance > 4) gesture.dragging = true;
      if (gesture.dragging) {
        const dx = event.clientX - gesture.lastX;
        const dy = event.clientY - gesture.lastY;
        if (gesture.button === 2) this.rotateBy(-dx * 0.006, dy * 0.004);
        else this.panBy(dx, dy);
        this.hideTooltip();
        this.hoverRing.visible = false;
      }
      gesture.lastX = event.clientX;
      gesture.lastY = event.clientY;
      return;
    }
    this.updateHover(event.clientX, event.clientY);
  };

  private readonly onPointerUp = (event: PointerEvent): void => {
    const gesture = this.pointerGesture;
    if (!gesture || gesture.id !== event.pointerId) return;
    if (!gesture.dragging && gesture.button === 0) this.handleClick(event.clientX, event.clientY);
    this.pointerGesture = null;
    if (this.renderer.domElement.hasPointerCapture(event.pointerId)) {
      this.renderer.domElement.releasePointerCapture(event.pointerId);
    }
    this.updateHover(event.clientX, event.clientY);
  };

  private readonly onPointerCancel = (): void => {
    this.pointerGesture = null;
    this.clearHover();
  };

  private readonly onPointerLeave = (): void => {
    if (!this.pointerGesture) this.clearHover();
  };

  private readonly onWheel = (event: WheelEvent): void => {
    event.preventDefault();
    const unit = event.deltaMode === WheelEvent.DOM_DELTA_LINE ? 16 : event.deltaMode === WheelEvent.DOM_DELTA_PAGE ? 240 : 1;
    if (event.shiftKey) {
      this.panBy(event.deltaX * unit + event.deltaY * unit, event.deltaY * unit);
    } else {
      this.zoomBy(Math.exp(-event.deltaY * unit * (event.ctrlKey ? 0.0025 : 0.001)));
    }
  };

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    const key = event.key.toLowerCase();
    const handled = ['arrowleft', 'arrowright', 'arrowup', 'arrowdown', 'q', 'e', '+', '=', '-', '_', 'f', 'escape'];
    if (!handled.includes(key)) return;
    event.preventDefault();
    if (key === 'arrowleft') this.panBy(-55, 0);
    else if (key === 'arrowright') this.panBy(55, 0);
    else if (key === 'arrowup') this.panBy(0, -55);
    else if (key === 'arrowdown') this.panBy(0, 55);
    else if (key === 'q') this.rotateBy(-Math.PI / 12, 0);
    else if (key === 'e') this.rotateBy(Math.PI / 12, 0);
    else if (key === '+' || key === '=') this.zoomBy(1.16);
    else if (key === '-' || key === '_') this.zoomBy(1 / 1.16);
    else if (key === 'f') this.focusSelectedHero();
    else this.clearHover();
  };

  private pickAt(clientX: number, clientY: number): PickTarget | null {
    const rect = this.renderer.domElement.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    this.pointerNdc.set((clientX - rect.left) / rect.width * 2 - 1, -(clientY - rect.top) / rect.height * 2 + 1);
    this.raycaster.setFromCamera(this.pointerNdc, this.camera);
    const meshes: THREE.Object3D[] = [...this.terrain?.pickMeshes ?? []];
    for (const visual of this.objectVisuals.values()) {
      if (visual.group.visible) meshes.push(...visual.pickMeshes);
    }
    for (const visual of this.heroVisuals.values()) {
      if (visual.group.visible) meshes.push(...visual.pickMeshes);
    }
    const intersections = this.raycaster.intersectObjects(meshes, false);
    for (const intersection of intersections) {
      const pick = intersection.object.userData.adventurePick as PickTarget | undefined;
      if (pick) return pick;
      if (intersection.object instanceof THREE.InstancedMesh && intersection.instanceId !== undefined) {
        const indices = intersection.object.userData.tileIndices as number[] | undefined;
        const tileIndex = indices?.[intersection.instanceId];
        const tile = tileIndex === undefined ? undefined : this.state.map.tiles[tileIndex];
        if (tile) return { kind: 'tile', point: { x: tile.x, y: tile.y } };
      }
    }
    return null;
  }

  private updateHover(clientX: number, clientY: number): void {
    if (this.disposed || this.pointerGesture?.dragging) return;
    this.hover = this.pickAt(clientX, clientY);
    this.refreshHover();
    this.updateTooltip(clientX, clientY);
  }

  private refreshHover(force = false): void {
    const key = this.hover
      ? `${this.state.revision}:${this.state.selectedHeroId ?? ''}:${this.hover.kind}:${'id' in this.hover ? this.hover.id : ''}:${this.hover.point.x},${this.hover.point.y}`
      : '';
    if (!force && key === this.pathKey) return;
    this.pathKey = key;
    clearGroup(this.pathGroup);
    this.hoverRing.visible = Boolean(this.hover) && !this.pointerGesture?.dragging;
    if (!this.hover) return;
    if (this.hover.kind === 'hero') {
      const visual = this.heroVisuals.get(this.hover.id);
      if (visual) {
        this.hoverRing.position.copy(visual.group.position);
        this.hoverRing.position.y += 0.035;
      }
      (this.hoverRing.material as THREE.MeshBasicMaterial).color.setHex(0xffe293);
      return;
    }
    const tile = this.state.map.tiles[this.hover.point.y * this.state.map.width + this.hover.point.x];
    const world = tileToWorld(this.state.map, this.hover.point, tile ? tileElevation(tile) + 0.06 : 0.06);
    this.hoverRing.position.set(world.x, world.y, world.z);
    const hero = this.store.getSelectedHero();
    const canMove = hero?.alive && hero.ownerId === this.state.activePlayerId && !this.activeTravel &&
      !this.state.pendingBattle && this.state.phase === 'playing' && !samePoint(hero.position, this.hover.point);
    const path = canMove && hero ? this.store.findHeroPath(hero.id, this.hover.point) : null;
    const ringMaterial = this.hoverRing.material as THREE.MeshBasicMaterial;
    ringMaterial.color.setHex(path && path.path.length > 1 ? 0x8ce6c1 : 0xe2816f);
    if (!path || path.path.length < 2) return;
    const points = path.path.map((point) => {
      const pathTile = this.state.map.tiles[point.y * this.state.map.width + point.x];
      const position = tileToWorld(this.state.map, point, pathTile ? tileElevation(pathTile) + 0.105 : 0.105);
      return new THREE.Vector3(position.x, position.y, position.z);
    });
    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(points),
      new THREE.LineBasicMaterial({ color: 0xc9f5b2, transparent: true, opacity: 0.9, depthTest: false }),
    );
    line.renderOrder = 6;
    this.pathGroup.add(line);
    const dotGeometry = new THREE.CylinderGeometry(0.047, 0.047, 0.022, 8);
    const dotMaterial = new THREE.MeshBasicMaterial({ color: 0xe0f7b6, depthTest: false });
    for (const point of points.slice(1)) {
      const dot = new THREE.Mesh(dotGeometry, dotMaterial);
      dot.position.copy(point);
      dot.renderOrder = 6;
      this.pathGroup.add(dot);
    }
  }

  private clearHover(): void {
    this.hover = null;
    this.pathKey = '';
    clearGroup(this.pathGroup);
    this.hoverRing.visible = false;
    this.hideTooltip();
  }

  private hideTooltip(): void {
    this.tooltip.hidden = true;
  }

  private updateTooltip(clientX: number, clientY: number): void {
    if (!this.hover) {
      this.hideTooltip();
      return;
    }
    const title = document.createElement('strong');
    const lines: HTMLElement[] = [];
    const addLine = (text: string, muted = false): void => {
      const line = document.createElement('div');
      line.textContent = text;
      if (muted) line.className = 'h3-adventure__muted';
      lines.push(line);
    };
    if (this.hover.kind === 'hero') {
      const hero = Object.hasOwn(this.state.heroes, this.hover.id) ? this.state.heroes[this.hover.id] : undefined;
      if (!hero) return;
      title.textContent = hero.name;
      addLine(`Level ${hero.level} · ${this.state.players[hero.ownerId]?.name ?? hero.ownerId}`);
      addLine(`Movement ${hero.movementPoints} / ${hero.maxMovementPoints}`);
      addLine(describeArmy(hero.army), true);
    } else if (this.hover.kind === 'object') {
      const object = Object.hasOwn(this.state.map.objects, this.hover.id)
        ? this.state.map.objects[this.hover.id] : undefined;
      if (!object) return;
      title.textContent = object.name;
      if (object.kind === 'resource') addLine(`Treasure: ${formatResources(object.resources)}`);
      else if (object.kind === 'mine') {
        const owner = object.ownerId ? this.state.players[object.ownerId]?.name ?? object.ownerId : 'Unclaimed';
        addLine(`${object.resource} mine · ${object.dailyOutput} per day`);
        addLine(owner, true);
      } else if (object.kind === 'dwelling') {
        addLine(object.available > 0
          ? `${object.available} ${getCreature(object.creatureId).name} available`
          : 'Visited · no recruits available');
      } else if (object.kind === 'monster') {
        addLine(describeArmy(object.army));
        addLine(`Treasure: ${formatResources(object.treasure)}`, true);
      } else {
        const town = this.state.towns[object.townId];
        addLine(`${town?.faction ?? 'Town'} · ${town ? this.state.players[town.ownerId]?.name ?? town.ownerId : 'Unknown owner'}`);
        addLine(town?.ownerId === this.state.activePlayerId ? 'Friendly town' : 'Hostile garrison', true);
      }
    } else {
      const tileIndex = this.hover.point.y * this.state.map.width + this.hover.point.x;
      const tile = this.state.map.tiles[tileIndex];
      if (!tile) return;
      const explored = this.state.fog[this.state.activePlayerId]?.explored.includes(tileIndex) ?? false;
      title.textContent = explored ? getTerrain(tile.terrain).name : 'Uncharted wilds';
      addLine(explored ? `${tile.road ? 'Road · ' : ''}Tile ${tile.x}, ${tile.y}` : 'Unexplored terrain');
    }
    const hero = this.store.getSelectedHero();
    if (hero && this.hover.kind !== 'hero' && !samePoint(hero.position, this.hover.point) && !this.activeTravel) {
      const path = this.store.findHeroPath(hero.id, this.hover.point);
      addLine(path && path.path.length > 1 ? `Travel cost: ${path.cost} movement` : 'No route with remaining movement', true);
    }
    this.tooltip.replaceChildren(title, ...lines);
    this.tooltip.hidden = false;
    const rootRect = this.root.getBoundingClientRect();
    const x = clamp(clientX - rootRect.left + 16, 8, Math.max(8, rootRect.width - this.tooltip.offsetWidth - 8));
    const y = clamp(clientY - rootRect.top + 16, 8, Math.max(8, rootRect.height - this.tooltip.offsetHeight - 8));
    this.tooltip.style.left = `${x}px`;
    this.tooltip.style.top = `${y}px`;
  }

  private handleClick(clientX: number, clientY: number): void {
    const target = this.pickAt(clientX, clientY);
    if (!target) return;
    if (target.kind === 'hero') {
      const hero = Object.hasOwn(this.state.heroes, target.id) ? this.state.heroes[target.id] : undefined;
      if (!hero?.alive) return;
      if (hero.ownerId !== this.state.activePlayerId) {
        this.showStatus(`${hero.name} belongs to ${this.state.players[hero.ownerId]?.name ?? 'another player'}.`);
        return;
      }
      const result = this.store.selectHero(hero.id);
      this.showStatus(result.ok ? `${hero.name} selected.` : result.error);
      return;
    }
    const hero = this.store.getSelectedHero();
    if (!hero || hero.ownerId !== this.state.activePlayerId || !hero.alive) {
      this.showStatus('Select one of your heroes first.');
      return;
    }
    if (this.activeTravel) {
      this.showStatus('Wait for the selected hero to finish traveling.');
      return;
    }
    if (target.kind === 'object' && samePoint(hero.position, target.point)) {
      const result = this.store.interact(hero.id);
      if (result.ok) {
        this.dispatchInteraction(hero.id, result.value);
        this.showStatus(result.value.message);
      } else this.showStatus(result.error);
      return;
    }
    this.moveSelectedHero(target.point);
  }

  private moveSelectedHero(destination: Point): void {
    const hero = this.store.getSelectedHero();
    if (!hero) return;
    if (this.activeTravel) {
      this.showStatus('Wait for the selected hero to finish traveling.');
      return;
    }
    if (samePoint(hero.position, destination)) {
      this.showStatus('The hero is already on this tile.');
      return;
    }
    const path = this.store.findHeroPath(hero.id, destination);
    if (!path || path.path.length < 2) {
      this.showStatus('That destination is not reachable with the remaining movement.');
      this.refreshHover(true);
      return;
    }
    this.pendingAction = { heroId: hero.id, path: path.path.map((point) => ({ ...point })) };
    const result = this.store.moveSelectedHero(destination);
    this.pendingAction = null;
    if (!result.ok) {
      this.activeTravel = null;
      this.syncHeroes();
      this.updateReachable();
      this.showStatus(result.error);
      return;
    }
    if (!this.activeTravel) {
      this.startTravel(hero.id, result.value.path);
      this.updateReachable();
    }
    this.clearGroupAfterMove();
    this.dispatchInteraction(hero.id, result.value.interaction, result.value);
    this.showStatus(result.value.interaction.message);
  }

  private clearGroupAfterMove(): void {
    clearGroup(this.pathGroup);
    this.pathKey = '';
    this.hoverRing.visible = false;
    this.hideTooltip();
  }

  private dispatchInteraction(heroId: string, interaction: InteractionResult, movement?: MovementResult): void {
    const detail: AdventureInteractionDetail = { interaction, heroId };
    if (movement) detail.movement = movement;
    this.container.dispatchEvent(new CustomEvent<AdventureInteractionDetail>('adventure-interaction', {
      bubbles: true,
      detail,
    }));
  }

  private showStatus(message: string): void {
    this.status.textContent = message;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.unsubscribe();
    this.abort.abort();
    this.resizeObserver?.disconnect();
    this.renderer.setAnimationLoop(null);
    disposeObject(this.scene);
    this.renderer.renderLists.dispose();
    this.renderer.dispose();
    this.root.remove();
    if (this.restoreContainerPosition !== null && this.container.style.position === 'relative') {
      this.container.style.position = this.restoreContainerPosition;
    }
    this.objectVisuals.clear();
    this.heroVisuals.clear();
    this.terrain = null;
    this.mapSource = null;
  }
}
