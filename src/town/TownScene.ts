import * as THREE from 'three';
import { BUILDINGS, getCreature } from '../game/content';
import type { GameStore } from '../game/GameStore';
import { FACTIONS } from '../game/factions';
import type { GameState, TownState } from '../game/types';
import { FACTION_ARCHITECTURE } from './architecture';
import { createTownEnvironment } from './environment';
import { createTownLayout, type TownBuildingPlacement } from './layout';
import { createBuildingModel, disposeTownObject } from './models';
import { resolveFactionId, type FactionId } from './registry';
import { TOWN_SCENE_STYLES } from './styles';

export interface TownBuildingInteraction {
  townId: string;
  buildingId: string;
  built: boolean;
  creatureId?: string;
}

interface BuildingVisual {
  placement: TownBuildingPlacement;
  root: THREE.Group;
  model: THREE.Group;
  built: boolean;
  label: HTMLDivElement;
  button: HTMLButtonElement;
  pickMeshes: THREE.Mesh[];
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

const MIN_ZOOM = 0.55;
const MAX_ZOOM = 2.6;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function createRing(color: THREE.ColorRepresentation): THREE.Mesh {
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.87, 1, 48),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.32;
  ring.renderOrder = 8;
  ring.visible = false;
  return ring;
}

export class TownScene {
  private readonly container: HTMLElement;
  private readonly store: GameStore;
  private readonly onInteract: (interaction: TownBuildingInteraction) => void;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.OrthographicCamera(-15, 15, 15, -15, 0.1, 160);
  private readonly renderer: THREE.WebGLRenderer;
  private readonly root: HTMLDivElement;
  private readonly header: HTMLDivElement;
  private readonly headerTitle: HTMLHeadingElement;
  private readonly headerSubtitle: HTMLParagraphElement;
  private readonly labels: HTMLDivElement;
  private readonly buildingPanel: HTMLElement;
  private readonly buildingList: HTMLOListElement;
  private readonly tooltip: HTMLDivElement;
  private readonly empty: HTMLDivElement;
  private readonly status: HTMLDivElement;
  private readonly townRoot = new THREE.Group();
  private readonly selectionRing = createRing(0xffdc78);
  private readonly hoverRing = createRing(0x91edc4);
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointerNdc = new THREE.Vector2();
  private readonly projectedLabel = new THREE.Vector3();
  private readonly cameraTarget = new THREE.Vector3(0, 0.5, 0);
  private readonly abort = new AbortController();
  private readonly unsubscribe: () => void;
  private readonly visuals = new Map<string, BuildingVisual>();
  private readonly animated = new Set<THREE.Object3D>();
  private resizeObserver: ResizeObserver | null = null;
  private restoreContainerPosition: string | null = null;
  private pointerGesture: PointerGesture | null = null;
  private townId: string | null = null;
  private faction: FactionId | null = null;
  private selectedId: string | null = null;
  private hoverId: string | null = null;
  private yaw = 0.64;
  private pitch = 0.86;
  private previousFrame = 0;
  private disposed = false;

  constructor(
    container: HTMLElement,
    store: GameStore,
    onInteract: (interaction: TownBuildingInteraction) => void,
  ) {
    this.container = container;
    this.store = store;
    this.onInteract = onInteract;
    if (getComputedStyle(container).position === 'static') {
      this.restoreContainerPosition = container.style.position;
      container.style.position = 'relative';
    }

    this.root = document.createElement('div');
    this.root.className = 'h3-town-scene';
    this.root.setAttribute('aria-label', 'Interactive three-dimensional town interior');
    const style = document.createElement('style');
    style.textContent = TOWN_SCENE_STYLES;
    this.root.appendChild(style);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const canvas = this.renderer.domElement;
    canvas.tabIndex = 0;
    canvas.setAttribute('role', 'application');
    canvas.setAttribute('aria-label', 'Town model. Drag to pan, right-drag to rotate, and click a building to interact.');
    this.root.appendChild(canvas);

    const vignette = document.createElement('div');
    vignette.className = 'h3-town-scene__vignette';
    this.root.appendChild(vignette);

    this.header = document.createElement('div');
    this.header.className = 'h3-town-scene__header';
    this.headerTitle = document.createElement('h2');
    this.headerSubtitle = document.createElement('p');
    this.header.append(this.headerTitle, this.headerSubtitle);
    this.header.hidden = true;
    this.root.appendChild(this.header);

    const toolbar = document.createElement('div');
    toolbar.className = 'h3-town-scene__toolbar';
    toolbar.setAttribute('aria-label', 'Town camera controls');
    this.addCameraButton(toolbar, '+', 'Zoom in', () => this.zoomBy(1.18));
    this.addCameraButton(toolbar, '−', 'Zoom out', () => this.zoomBy(1 / 1.18));
    this.addCameraButton(toolbar, '↶', 'Rotate left', () => this.rotateBy(-Math.PI / 10, 0));
    this.addCameraButton(toolbar, '↻', 'Rotate right', () => this.rotateBy(Math.PI / 10, 0));
    this.addCameraButton(toolbar, '⌂', 'Reset town camera', () => this.resetCamera());
    this.root.appendChild(toolbar);

    this.labels = document.createElement('div');
    this.labels.className = 'h3-town-scene__labels';
    this.root.appendChild(this.labels);

    this.buildingPanel = document.createElement('aside');
    this.buildingPanel.className = 'h3-town-scene__buildings';
    this.buildingPanel.setAttribute('aria-label', 'Keyboard-equivalent town building list');
    const buildingHeading = document.createElement('h3');
    buildingHeading.textContent = 'Town buildings';
    this.buildingList = document.createElement('ol');
    this.buildingList.className = 'h3-town-scene__building-list';
    this.buildingPanel.append(buildingHeading, this.buildingList);
    this.buildingPanel.hidden = true;
    this.root.appendChild(this.buildingPanel);

    const hint = document.createElement('div');
    hint.className = 'h3-town-scene__hint';
    hint.textContent = 'Click a building · Drag to pan · Right-drag to rotate · Wheel to zoom · Arrow keys pan · Q/E rotate';
    this.root.appendChild(hint);

    this.tooltip = document.createElement('div');
    this.tooltip.className = 'h3-town-scene__tooltip';
    this.tooltip.setAttribute('role', 'tooltip');
    this.tooltip.hidden = true;
    this.root.appendChild(this.tooltip);

    this.empty = document.createElement('div');
    this.empty.className = 'h3-town-scene__empty';
    this.empty.textContent = 'Select a town to view its buildings.';
    this.root.appendChild(this.empty);

    this.status = document.createElement('div');
    this.status.className = 'h3-town-scene__status';
    this.status.setAttribute('role', 'status');
    this.status.setAttribute('aria-live', 'polite');
    this.root.appendChild(this.status);
    container.appendChild(this.root);

    this.scene.background = new THREE.Color(0x718f88);
    this.scene.fog = new THREE.Fog(0x718f88, 44, 88);
    const hemisphere = new THREE.HemisphereLight(0xf2f0d7, 0x31473e, 2.35);
    this.scene.add(hemisphere);
    const sun = new THREE.DirectionalLight(0xffe4b0, 3.0);
    sun.position.set(-18, 28, 17);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1536, 1536);
    sun.shadow.camera.left = -20;
    sun.shadow.camera.right = 20;
    sun.shadow.camera.top = 20;
    sun.shadow.camera.bottom = -20;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 75;
    sun.shadow.bias = -0.00035;
    sun.shadow.normalBias = 0.035;
    this.scene.add(sun, sun.target);
    const fill = new THREE.DirectionalLight(0xa9d8d0, 0.7);
    fill.position.set(15, 13, -16);
    this.scene.add(fill);
    this.townRoot.name = 'active-town';
    this.scene.add(this.townRoot, this.selectionRing, this.hoverRing);

    this.bindEvents();
    this.unsubscribe = store.subscribe(this.onState);
    this.resize();
    this.resetCamera();
    this.renderer.render(this.scene, this.camera);
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
    this.buildingList.addEventListener('keydown', this.onBuildingListKeyDown, { signal });
    window.addEventListener('resize', this.resize, { signal });
  }

  private readonly onState = (state: Readonly<GameState>): void => {
    if (this.disposed) return;
    this.syncState(state);
  };

  private syncState(state: Readonly<GameState>): void {
    if (!this.townId) return;
    this.clearHover();
    const town = Object.hasOwn(state.towns, this.townId) ? state.towns[this.townId] : undefined;
    if (!town) {
      this.clearTown();
      this.showEmpty('This town is no longer available.');
      return;
    }
    const faction = resolveFactionId(town.faction);
    if (!this.faction || this.faction !== faction || this.visuals.size === 0) {
      this.clearTown();
      this.loadTown(town, faction);
      return;
    }
    for (const visual of this.visuals.values()) {
      const built = town.buildings.includes(visual.placement.spec.id);
      if (built !== visual.built) this.replaceVisualModel(visual, built);
    }
    this.updateHeader(town);
    this.refreshSelection();
  }

  setTown(townId: string | null): void {
    if (this.disposed) return;
    if (this.townId === townId && townId !== null) {
      this.syncState(this.store.getState());
      return;
    }
    this.townId = townId;
    this.root.dataset.townId = townId ?? '';
    this.clearTown();
    if (!townId) {
      this.showEmpty('Select a town to view its buildings.');
      return;
    }
    const town = this.store.getTown(townId);
    if (!town) {
      this.showEmpty('This town is no longer available.');
      return;
    }
    this.loadTown(town, resolveFactionId(town.faction));
  }

  private loadTown(town: Readonly<TownState>, faction: FactionId): void {
    this.faction = faction;
    const factionDefinition = FACTIONS[faction];
    const palette = FACTION_ARCHITECTURE[faction];
    this.root.dataset.faction = faction;
    this.root.dataset.factionName = factionDefinition.name;
    (this.scene.background as THREE.Color).setHex(palette.sky);
    (this.scene.fog as THREE.Fog).color.setHex(palette.sky);
    const layout = createTownLayout(faction);
    this.townRoot.add(createTownEnvironment(faction, layout));
    for (const placement of layout) this.createVisual(placement, town);
    this.collectAnimated();
    this.updateHeader(town);
    this.header.hidden = false;
    this.buildingPanel.hidden = false;
    this.empty.hidden = true;
    this.root.dataset.buildingCount = String(layout.length);
    this.resetCamera();
    this.previousFrame = 0;
    this.renderer.setAnimationLoop(this.animate);
  }

  private createVisual(placement: TownBuildingPlacement, town: Readonly<TownState>): void {
    const spec = placement.spec;
    const built = town.buildings.includes(spec.id);
    const root = new THREE.Group();
    root.name = `destination-${spec.id}`;
    root.position.set(placement.x, 0, placement.z);
    root.rotation.y = placement.rotation;
    const model = createBuildingModel(spec, this.faction!, built);
    root.add(model);
    this.townRoot.add(root);

    const label = document.createElement('div');
    label.className = 'h3-town-scene__label';
    label.dataset.buildingId = spec.id;
    this.labels.appendChild(label);

    const item = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'h3-town-scene__building';
    button.dataset.buildingId = spec.id;
    button.setAttribute('aria-pressed', 'false');
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      this.activateBuilding(spec.id);
    }, { signal: this.abort.signal });
    button.addEventListener('focus', () => this.selectBuilding(spec.id), { signal: this.abort.signal });
    button.addEventListener('mouseenter', () => this.setHover(spec.id), { signal: this.abort.signal });
    button.addEventListener('mouseleave', () => {
      if (this.hoverId === spec.id) this.clearHover();
    }, { signal: this.abort.signal });
    item.appendChild(button);
    this.buildingList.appendChild(item);

    const visual: BuildingVisual = { placement, root, model, built, label, button, pickMeshes: [] };
    this.visuals.set(spec.id, visual);
    this.refreshVisual(visual);
  }

  private replaceVisualModel(visual: BuildingVisual, built: boolean): void {
    visual.root.remove(visual.model);
    disposeTownObject(visual.model);
    visual.model = createBuildingModel(visual.placement.spec, this.faction!, built);
    visual.built = built;
    visual.root.add(visual.model);
    this.refreshVisual(visual);
    this.collectAnimated();
  }

  private refreshVisual(visual: BuildingVisual): void {
    const spec = visual.placement.spec;
    const definition = BUILDINGS[spec.id]!;
    const status = visual.built ? 'Built' : 'Unbuilt';
    visual.root.userData.buildingId = spec.id;
    visual.root.userData.built = visual.built;
    visual.label.dataset.built = String(visual.built);
    visual.label.dataset.selected = String(this.selectedId === spec.id);
    visual.label.dataset.hover = String(this.hoverId === spec.id);
    visual.label.title = `${definition.name} — ${visual.built ? 'Constructed' : 'Not constructed'}`;
    const labelName = document.createElement('span');
    labelName.textContent = definition.name;
    const labelStatus = document.createElement('span');
    labelStatus.className = 'h3-town-scene__label-status';
    labelStatus.textContent = status;
    visual.label.replaceChildren(labelName, labelStatus);

    visual.button.dataset.built = String(visual.built);
    visual.button.setAttribute('aria-label', `${definition.name}, ${visual.built ? 'constructed' : 'not constructed'}. Activate building.`);
    const buttonName = document.createElement('span');
    buttonName.className = 'h3-town-scene__building-name';
    buttonName.textContent = definition.name;
    const buttonStatus = document.createElement('span');
    buttonStatus.className = 'h3-town-scene__building-status';
    buttonStatus.textContent = visual.built ? 'Constructed' : 'Unbuilt';
    visual.button.replaceChildren(buttonName, buttonStatus);

    visual.pickMeshes = [];
    visual.model.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      child.userData.townBuildingId = spec.id;
      visual.pickMeshes.push(child);
    });
  }

  private collectAnimated(): void {
    this.animated.clear();
    this.townRoot.traverse((child) => {
      if (typeof child.userData.townAnimation === 'string') this.animated.add(child);
    });
  }

  private updateHeader(town: Readonly<TownState>): void {
    const builtCount = [...this.visuals.values()].filter((visual) => visual.built).length;
    this.headerTitle.textContent = town.name;
    this.headerSubtitle.textContent = `${FACTIONS[this.faction!].name} · ${builtCount} of ${this.visuals.size} buildings constructed`;
  }

  private showEmpty(message: string): void {
    this.faction = null;
    this.header.hidden = true;
    this.buildingPanel.hidden = true;
    this.empty.textContent = message;
    this.empty.hidden = false;
    delete this.root.dataset.faction;
    delete this.root.dataset.factionName;
    this.root.dataset.buildingCount = '0';
    this.renderer.setAnimationLoop(null);
    this.renderer.render(this.scene, this.camera);
  }

  private clearTown(): void {
    this.renderer.setAnimationLoop(null);
    this.clearHover();
    this.selectedId = null;
    this.selectionRing.visible = false;
    for (const child of [...this.townRoot.children]) {
      this.townRoot.remove(child);
      disposeTownObject(child);
    }
    this.visuals.clear();
    this.animated.clear();
    this.labels.replaceChildren();
    this.buildingList.replaceChildren();
  }

  private activateBuilding(buildingId: string): void {
    if (this.disposed || !this.townId) return;
    const visual = this.visuals.get(buildingId);
    const town = this.store.getTown(this.townId);
    if (!visual || !town) return;
    const built = town.buildings.includes(buildingId);
    this.selectBuilding(buildingId);
    const interaction: TownBuildingInteraction = { townId: town.id, buildingId, built };
    const creatureId = BUILDINGS[buildingId]?.creatureId;
    if (creatureId) interaction.creatureId = creatureId;
    this.status.textContent = `${BUILDINGS[buildingId]!.name}: ${built ? 'constructed' : 'not constructed'}.`;
    this.onInteract(interaction);
  }

  private selectBuilding(buildingId: string): void {
    const visual = this.visuals.get(buildingId);
    if (!visual) return;
    this.selectedId = buildingId;
    this.refreshSelection();
  }

  private refreshSelection(): void {
    const selected = this.selectedId ? this.visuals.get(this.selectedId) : undefined;
    this.selectionRing.visible = Boolean(selected);
    if (selected) this.positionRing(this.selectionRing, selected);
    for (const visual of this.visuals.values()) {
      const active = visual.placement.spec.id === this.selectedId;
      visual.button.setAttribute('aria-pressed', String(active));
      visual.label.dataset.selected = String(active);
    }
  }

  private setHover(buildingId: string | null): void {
    if (this.hoverId === buildingId) return;
    this.hoverId = buildingId;
    const hover = buildingId ? this.visuals.get(buildingId) : undefined;
    this.hoverRing.visible = Boolean(hover);
    if (hover) this.positionRing(this.hoverRing, hover);
    this.renderer.domElement.style.cursor = hover ? 'pointer' : 'default';
    for (const visual of this.visuals.values()) {
      visual.label.dataset.hover = String(visual.placement.spec.id === buildingId);
    }
  }

  private positionRing(ring: THREE.Mesh, visual: BuildingVisual): void {
    ring.position.set(visual.placement.x, 0.31, visual.placement.z);
    const radius = Math.max(...visual.placement.spec.footprint) * 0.58;
    ring.scale.setScalar(radius);
  }

  private readonly onPointerDown = (event: PointerEvent): void => {
    if (event.button > 2 || this.pointerGesture || !this.townId) return;
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
      if (Math.hypot(event.clientX - gesture.startX, event.clientY - gesture.startY) > 4) gesture.dragging = true;
      if (gesture.dragging) {
        const dx = event.clientX - gesture.lastX;
        const dy = event.clientY - gesture.lastY;
        if (gesture.button === 2 || gesture.button === 1) this.rotateBy(-dx * 0.006, dy * 0.004);
        else this.panBy(dx, dy);
        this.clearHover();
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
    if (!gesture.dragging && gesture.button === 0) {
      const buildingId = this.pickAt(event.clientX, event.clientY);
      if (buildingId) this.activateBuilding(buildingId);
    }
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
    if (!this.townId) return;
    event.preventDefault();
    const unit = event.deltaMode === WheelEvent.DOM_DELTA_LINE ? 16 : event.deltaMode === WheelEvent.DOM_DELTA_PAGE ? 240 : 1;
    if (event.shiftKey) this.panBy(event.deltaX * unit + event.deltaY * unit, event.deltaY * unit);
    else this.zoomBy(Math.exp(-event.deltaY * unit * (event.ctrlKey ? 0.0025 : 0.001)));
  };

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    const key = event.key.toLowerCase();
    const handled = ['arrowleft', 'arrowright', 'arrowup', 'arrowdown', 'q', 'e', '+', '=', '-', '_', 'home', '0', 'escape', 'enter', '[', ']'];
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
    else if (key === 'home' || key === '0') this.resetCamera();
    else if (key === 'escape') {
      this.selectedId = null;
      this.refreshSelection();
      this.clearHover();
    } else if (key === 'enter') {
      if (this.selectedId) this.activateBuilding(this.selectedId);
    } else this.cycleSelection(key === ']' ? 1 : -1);
  };

  private readonly onBuildingListKeyDown = (event: KeyboardEvent): void => {
    if (!['arrowdown', 'arrowup', 'arrowleft', 'arrowright', 'home', 'end'].includes(event.key.toLowerCase())) return;
    const buttons = [...this.buildingList.querySelectorAll<HTMLButtonElement>('button[data-building-id]')];
    if (!buttons.length) return;
    const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
    let index = current < 0 ? 0 : current;
    const key = event.key.toLowerCase();
    if (key === 'home') index = 0;
    else if (key === 'end') index = buttons.length - 1;
    else if (key === 'arrowdown' || key === 'arrowright') index = (index + 1) % buttons.length;
    else index = (index - 1 + buttons.length) % buttons.length;
    event.preventDefault();
    buttons[index]!.focus();
  };

  private cycleSelection(direction: number): void {
    const specs = [...this.visuals.keys()];
    if (!specs.length) return;
    const current = this.selectedId ? specs.indexOf(this.selectedId) : -1;
    const index = (current + direction + specs.length) % specs.length;
    this.selectBuilding(specs[index]!);
  }

  private pickAt(clientX: number, clientY: number): string | null {
    if (!this.townId || !this.visuals.size) return null;
    const rect = this.renderer.domElement.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    this.pointerNdc.set((clientX - rect.left) / rect.width * 2 - 1, -(clientY - rect.top) / rect.height * 2 + 1);
    this.raycaster.setFromCamera(this.pointerNdc, this.camera);
    this.scene.updateMatrixWorld(true);
    const meshes: THREE.Mesh[] = [];
    for (const visual of this.visuals.values()) meshes.push(...visual.pickMeshes);
    const intersections = this.raycaster.intersectObjects(meshes, false);
    for (const intersection of intersections) {
      const buildingId = intersection.object.userData.townBuildingId;
      if (typeof buildingId === 'string') return buildingId;
    }
    return null;
  }

  private updateHover(clientX: number, clientY: number): void {
    if (this.disposed || this.pointerGesture?.dragging) return;
    const buildingId = this.pickAt(clientX, clientY);
    this.setHover(buildingId);
    if (buildingId) this.updateTooltip(buildingId, clientX, clientY);
    else this.tooltip.hidden = true;
  }

  private updateTooltip(buildingId: string, clientX: number, clientY: number): void {
    const visual = this.visuals.get(buildingId);
    const definition = BUILDINGS[buildingId];
    if (!visual || !definition) return;
    const title = document.createElement('strong');
    title.textContent = definition.name;
    const state = document.createElement('p');
    state.textContent = visual.built ? 'Constructed · click to enter' : 'Unbuilt · click to view construction';
    const description = document.createElement('p');
    description.textContent = definition.description;
    description.className = 'h3-town-scene__muted';
    const contents: HTMLElement[] = [title, state, description];
    if (definition.creatureId) {
      const creature = document.createElement('p');
      creature.textContent = `${FACTIONS[this.faction!].name} · Tier ${visual.placement.spec.tier} · ${getCreature(definition.creatureId).name}`;
      creature.className = 'h3-town-scene__muted';
      contents.push(creature);
    }
    this.tooltip.replaceChildren(...contents);
    this.tooltip.hidden = false;
    const rootRect = this.root.getBoundingClientRect();
    const x = clamp(clientX - rootRect.left + 16, 8, Math.max(8, rootRect.width - this.tooltip.offsetWidth - 8));
    const y = clamp(clientY - rootRect.top + 16, 8, Math.max(8, rootRect.height - this.tooltip.offsetHeight - 8));
    this.tooltip.style.left = `${x}px`;
    this.tooltip.style.top = `${y}px`;
  }

  private clearHover(): void {
    this.setHover(null);
    this.tooltip.hidden = true;
  }

  private panBy(deltaX: number, deltaY: number): void {
    const viewHeight = this.camera.top - this.camera.bottom;
    const worldPerPixel = viewHeight / this.camera.zoom / Math.max(1, this.container.clientHeight);
    const dx = deltaX * worldPerPixel;
    const dy = deltaY * worldPerPixel;
    this.cameraTarget.x += -Math.cos(this.yaw) * dx - Math.sin(this.yaw) * dy;
    this.cameraTarget.z += Math.sin(this.yaw) * dx - Math.cos(this.yaw) * dy;
    this.cameraTarget.x = clamp(this.cameraTarget.x, -10, 10);
    this.cameraTarget.z = clamp(this.cameraTarget.z, -9, 9);
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

  private resetCamera(): void {
    this.cameraTarget.set(0, 0.5, 0);
    this.yaw = 0.64;
    this.pitch = 0.86;
    this.camera.zoom = 1;
    this.camera.updateProjectionMatrix();
    this.updateCamera();
  }

  private updateCamera(): void {
    const distance = 43;
    const horizontal = Math.cos(this.pitch) * distance;
    this.camera.position.set(
      this.cameraTarget.x + Math.sin(this.yaw) * horizontal,
      this.cameraTarget.y + Math.sin(this.pitch) * distance,
      this.cameraTarget.z + Math.cos(this.yaw) * horizontal,
    );
    this.camera.lookAt(this.cameraTarget);
  }

  readonly resize = (): void => {
    if (this.disposed) return;
    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    const aspect = width / height;
    const viewHeight = Math.max(27, 31 / aspect);
    this.camera.left = -viewHeight * aspect / 2;
    this.camera.right = viewHeight * aspect / 2;
    this.camera.top = viewHeight / 2;
    this.camera.bottom = -viewHeight / 2;
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(width, height, false);
  };

  private positionLabels(): void {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    if (width <= 0 || height <= 0) return;
    for (const visual of this.visuals.values()) {
      this.projectedLabel.set(visual.placement.x, visual.placement.labelHeight, visual.placement.z).project(this.camera);
      const visible = this.projectedLabel.z >= -1 && this.projectedLabel.z <= 1 &&
        Math.abs(this.projectedLabel.x) < 1.15 && Math.abs(this.projectedLabel.y) < 1.15;
      visual.label.hidden = !visible;
      if (!visible) continue;
      const x = (this.projectedLabel.x * 0.5 + 0.5) * width;
      const y = (-this.projectedLabel.y * 0.5 + 0.5) * height;
      visual.label.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -100%)`;
    }
  }

  private readonly animate = (time: number): void => {
    if (this.disposed || !this.townId) return;
    const delta = this.previousFrame ? Math.min(0.05, (time - this.previousFrame) / 1000) : 0;
    this.previousFrame = time;
    for (const object of this.animated) {
      const animation = object.userData.townAnimation;
      if (animation === 'spin') object.rotation.y += delta * 0.55;
      else if (animation === 'spinZ') object.rotation.z += delta * 0.5;
      else if (animation === 'float') object.position.y = (object.userData.baseY as number) + Math.sin(time * 0.0018 + object.id) * 0.12;
      else if (animation === 'pulse') {
        const scale = 1 + Math.sin(time * 0.004 + object.id) * 0.065;
        object.scale.setScalar(scale);
      }
    }
    this.positionLabels();
    this.renderer.render(this.scene, this.camera);
  };

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.unsubscribe();
    this.abort.abort();
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.renderer.setAnimationLoop(null);
    this.clearTown();
    disposeTownObject(this.scene);
    this.renderer.renderLists.dispose();
    this.renderer.dispose();
    this.root.remove();
    this.townId = null;
    this.faction = null;
    if (this.restoreContainerPosition !== null && this.container.style.position === 'relative') {
      this.container.style.position = this.restoreContainerPosition;
    }
  }
}
