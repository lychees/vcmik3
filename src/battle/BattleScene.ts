import * as THREE from 'three';
import { getCombatSpell } from '../game/spellbook';
import { createCreatureModel } from './creatures';
import type { BattleEngine } from './BattleEngine';
import { BATTLEFIELD_COLUMNS, BATTLEFIELD_ROWS, hexKey, hexToWorld } from './hex';
import { disposeBattleResources } from './resources';
import type {
  BattleEvent,
  BattleObstacle,
  BattleStackState,
  HexCoord,
  ReachableHex,
} from './types';

interface StackVisual {
  group: THREE.Group;
  label: THREE.Sprite;
  canvas: HTMLCanvasElement;
  texture: THREE.CanvasTexture;
  targetRing: THREE.Mesh;
}

interface HoverPayload {
  stackId: string | null;
  hex: HexCoord | null;
  clientX: number;
  clientY: number;
}

interface SceneHandlers {
  onStackClick: (stackId: string) => void;
  onHexClick: (hex: HexCoord) => void;
  onHover: (payload: HoverPayload) => void;
}

interface SceneOptions {
  createCustomCreatureModel?: (creatureId: string, side: 'attacker' | 'defender') => THREE.Group | undefined;
}

interface Tween {
  start: number;
  duration: number;
  update: (progress: number) => void;
  resolve: () => void;
}

const CENTER = hexToWorld({ x: 7, y: 5 });

function worldPosition(hex: HexCoord): THREE.Vector3 {
  const point = hexToWorld(hex);
  return new THREE.Vector3(point.x - CENTER.x, 0, point.z - CENTER.z);
}

function ease(progress: number): number {
  return progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;
}

export class BattleScene {
  private readonly host: HTMLElement;
  private readonly engine: BattleEngine;
  private readonly handlers: SceneHandlers;
  private readonly options: SceneOptions;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.OrthographicCamera(-15, 15, 10, -10, 0.1, 120);
  private readonly renderer: THREE.WebGLRenderer;
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private readonly visuals = new Map<string, StackVisual>();
  private readonly tileOverlays = new Map<string, THREE.Mesh>();
  private readonly tweens: Tween[] = [];
  private readonly listeners = new AbortController();
  private readonly hoverRing: THREE.Mesh;
  private readonly activeRing: THREE.Mesh;
  private activeStackId: string | null = null;
  private disposed = false;
  private animating = false;
  private pointerDown: { x: number; y: number; button: number; camera: boolean; pointerId: number } | null = null;
  private dragged = false;
  private yaw = 0;
  private target = new THREE.Vector3();

  constructor(host: HTMLElement, engine: BattleEngine, handlers: SceneHandlers, options: SceneOptions = {}) {
    this.host = host;
    this.engine = engine;
    this.handlers = handlers;
    this.options = options;
    this.scene.background = new THREE.Color(0x101b19);
    this.scene.fog = new THREE.Fog(0x101b19, 35, 70);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.domElement.className = 'h3b-canvas';
    this.renderer.domElement.setAttribute('aria-label', 'Interactive tactical hex battlefield');
    this.host.appendChild(this.renderer.domElement);
    this.scene.add(new THREE.HemisphereLight(0xe8f1d4, 0x26372f, 2.4));
    const sun = new THREE.DirectionalLight(0xffe3af, 3.1);
    sun.position.set(-10, 24, 12);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -20;
    sun.shadow.camera.right = 20;
    sun.shadow.camera.top = 18;
    sun.shadow.camera.bottom = -18;
    this.scene.add(sun);
    this.createBattlefield();
    this.createStacks();
    this.hoverRing = this.createRing(0xf5e4ac, 0.73, 0.035);
    this.activeRing = this.createRing(0xffd86b, 0.78, 0.065);
    this.scene.add(this.hoverRing, this.activeRing);
    this.hoverRing.visible = false;
    this.activeRing.visible = false;
    this.bindInput();
    this.resetCamera();
    this.resize();
    this.sync();
    this.renderer.setAnimationLoop((time) => this.render(time));
  }

  resize(): void {
    if (this.disposed) return;
    const width = Math.max(1, this.host.clientWidth);
    const height = Math.max(1, this.host.clientHeight);
    const aspect = width / height;
    const verticalSize = Math.max(19, 31 / aspect);
    this.camera.left = -verticalSize * aspect / 2;
    this.camera.right = verticalSize * aspect / 2;
    this.camera.top = verticalSize / 2;
    this.camera.bottom = -verticalSize / 2;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  sync(): void {
    for (const stack of this.engine.getState().stacks) {
      const visual = this.visuals.get(stack.id);
      if (!visual) continue;
      visual.group.visible = stack.count > 0;
      visual.label.visible = stack.count > 0;
      if (!this.animating) visual.group.position.copy(worldPosition(stack.position));
      visual.targetRing.position.copy(worldPosition(stack.position));
      visual.targetRing.position.y = 0.13;
      this.updateLabel(stack);
    }
    this.setActive(this.engine.getActiveStack()?.id ?? null);
  }

  setActive(stackId: string | null): void {
    this.activeStackId = stackId;
    const stack = stackId ? this.engine.getStack(stackId) : undefined;
    this.activeRing.visible = Boolean(stack && stack.count > 0);
    if (stack) this.activeRing.position.copy(worldPosition(stack.position)).setY(0.12);
  }

  setHighlights(reachable: ReachableHex[], targetIds: string[], targetColor = 0xe66858): void {
    const reachableKeys = new Set(reachable.map((tile) => hexKey(tile.position)));
    for (const [key, overlay] of this.tileOverlays) overlay.visible = reachableKeys.has(key);
    const targets = new Set(targetIds);
    for (const [id, visual] of this.visuals) {
      visual.targetRing.visible = targets.has(id);
      (visual.targetRing.material as THREE.MeshBasicMaterial).color.setHex(targetColor);
    }
  }

  setHover(stackId: string | null, hex: HexCoord | null): void {
    const stack = stackId ? this.engine.getStack(stackId) : undefined;
    const position = stack?.position ?? hex;
    this.hoverRing.visible = Boolean(position);
    if (position) this.hoverRing.position.copy(worldPosition(position)).setY(0.15);
  }

  async animate(events: BattleEvent[]): Promise<void> {
    if (this.disposed) return;
    this.animating = true;
    this.hoverRing.visible = false;
    for (const event of events) {
      if (this.disposed) break;
      if (event.kind === 'move') await this.animateMove(event.stackId, event.path);
      else if (event.kind === 'attack') await this.animateAttack(event);
      else if (event.kind === 'spell') await this.animateSpell(event);
      else if (event.kind === 'wait' || event.kind === 'defend') {
        const stack = this.engine.getStack(event.stackId);
        if (stack) this.floatText(stack.position, event.kind === 'wait' ? 'WAIT' : 'DEFEND', '#f4d98c');
        await this.tween(140, () => undefined);
      }
    }
    this.animating = false;
    this.sync();
  }

  resetCamera(): void {
    this.yaw = 0;
    this.target.set(0, 0, 0);
    this.camera.zoom = 1;
    this.updateCamera();
  }

  rotateCamera(direction: number): void {
    this.yaw += direction * Math.PI / 4;
    this.updateCamera();
  }

  zoomBy(factor: number): void {
    this.camera.zoom = THREE.MathUtils.clamp(this.camera.zoom * factor, 0.65, 2.4);
    this.updateCamera();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.listeners.abort();
    this.renderer.setAnimationLoop(null);
    for (const tween of this.tweens) tween.resolve();
    this.tweens.length = 0;
    disposeBattleResources(this.scene, [...this.visuals.values()].map((visual) => visual.texture));
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  private createBattlefield(): void {
    const foundation = new THREE.Mesh(
      new THREE.BoxGeometry(30, 0.75, 19),
      new THREE.MeshStandardMaterial({ color: 0x314d3a, roughness: 1, flatShading: true }),
    );
    foundation.position.set(0, -0.55, 0);
    foundation.receiveShadow = true;
    this.scene.add(foundation);
    const groundMaterials = [
      new THREE.MeshStandardMaterial({ color: 0x597a4d, roughness: 1, flatShading: true }),
      new THREE.MeshStandardMaterial({ color: 0x617f50, roughness: 1, flatShading: true }),
      new THREE.MeshStandardMaterial({ color: 0x526f47, roughness: 1, flatShading: true }),
    ];
    const tileGeometry = new THREE.CylinderGeometry(0.965, 0.965, 0.12, 6);
    const overlayGeometry = new THREE.CylinderGeometry(0.84, 0.84, 0.035, 6);
    const overlayMaterial = new THREE.MeshBasicMaterial({ color: 0x76d6a0, transparent: true, opacity: 0.36, depthWrite: false });
    for (let y = 0; y < BATTLEFIELD_ROWS; y += 1) {
      for (let x = 0; x < BATTLEFIELD_COLUMNS; x += 1) {
        const hex = { x, y };
        const tile = new THREE.Mesh(tileGeometry, groundMaterials[(x + y * 2) % groundMaterials.length]);
        tile.position.copy(worldPosition(hex)).setY(-0.08);
        tile.rotation.y = Math.PI / 6;
        tile.receiveShadow = true;
        tile.userData.hex = hex;
        this.scene.add(tile);
        const overlay = new THREE.Mesh(overlayGeometry, overlayMaterial);
        overlay.position.copy(worldPosition(hex)).setY(0.015);
        overlay.rotation.y = Math.PI / 6;
        overlay.visible = false;
        overlay.userData.hex = hex;
        this.scene.add(overlay);
        this.tileOverlays.set(hexKey(hex), overlay);
      }
    }
    for (const obstacle of this.engine.getState().obstacles) this.createObstacle(obstacle);
  }

  private createObstacle(obstacle: BattleObstacle): void {
    const group = new THREE.Group();
    group.position.copy(worldPosition(obstacle.position));
    if (obstacle.kind === 'rock') {
      const rock = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.63, 0),
        new THREE.MeshStandardMaterial({ color: 0x788078, flatShading: true, roughness: 1 }),
      );
      rock.scale.set(1, 0.8, 0.85);
      rock.position.y = 0.43;
      rock.rotation.set(0.2, 0.4, 0.1);
      rock.castShadow = true;
      group.add(rock);
    } else if (obstacle.kind === 'tree') {
      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.12, 0.18, 0.9, 5),
        new THREE.MeshStandardMaterial({ color: 0x5b4632, flatShading: true }),
      );
      trunk.position.y = 0.45;
      trunk.castShadow = true;
      group.add(trunk);
      const leaves = new THREE.MeshStandardMaterial({ color: 0x315b3d, flatShading: true });
      for (const [y, radius] of [[1.05, 0.65], [1.55, 0.48]] as const) {
        const crown = new THREE.Mesh(new THREE.ConeGeometry(radius, 1.15, 6), leaves);
        crown.position.y = y;
        crown.castShadow = true;
        group.add(crown);
      }
    } else {
      const stone = new THREE.MeshStandardMaterial({ color: 0x92978d, flatShading: true, roughness: 1 });
      const wall = new THREE.Mesh(new THREE.BoxGeometry(1.15, 1.25, 1.25), stone);
      wall.position.y = 0.6;
      wall.castShadow = true;
      wall.receiveShadow = true;
      group.add(wall);
      for (const z of [-0.43, 0, 0.43]) {
        const merlon = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.32, 0.22), stone);
        merlon.position.set(0, 1.36, z);
        merlon.castShadow = true;
        group.add(merlon);
      }
    }
    group.userData.hex = obstacle.position;
    this.scene.add(group);
  }

  private createStacks(): void {
    for (const stack of this.engine.getState().stacks) {
      const group = this.options.createCustomCreatureModel?.(stack.creatureId, stack.side) ??
        createCreatureModel(stack.creatureId, stack.side);
      group.position.copy(worldPosition(stack.position));
      group.userData.stackId = stack.id;
      this.scene.add(group);
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 96;
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: false, transparent: true }));
      const labelHeight = typeof group.userData.labelHeight === 'number' ? group.userData.labelHeight : 2.05;
      label.position.set(0, labelHeight, 0);
      label.scale.set(1.9, 0.72, 1);
      label.userData.stackId = stack.id;
      group.add(label);
      const targetRing = this.createRing(0xe66858, 0.72, 0.055);
      targetRing.visible = false;
      targetRing.userData.stackId = stack.id;
      targetRing.position.copy(worldPosition(stack.position)).setY(0.13);
      this.scene.add(targetRing);
      this.visuals.set(stack.id, { group, label, canvas, texture, targetRing });
      this.updateLabel(stack);
    }
  }

  private createRing(color: number, radius: number, thickness: number): THREE.Mesh {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(radius, thickness, 6, 32),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, depthWrite: false }),
    );
    ring.rotation.x = Math.PI / 2;
    return ring;
  }

  private updateLabel(stack: BattleStackState): void {
    const visual = this.visuals.get(stack.id);
    if (!visual) return;
    const context = visual.canvas.getContext('2d');
    if (!context) return;
    context.clearRect(0, 0, 256, 96);
    context.fillStyle = 'rgba(13, 22, 20, 0.9)';
    context.fillRect(43, 8, 170, 70);
    context.strokeStyle = stack.side === 'attacker' ? '#79c7e8' : '#e58b7d';
    context.lineWidth = 4;
    context.strokeRect(43, 8, 170, 70);
    context.fillStyle = '#fff7df';
    context.font = 'bold 37px Georgia, serif';
    context.textAlign = 'center';
    context.fillText(`×${stack.count}`, 128, 48);
    const healthRatio = this.engine.getStackMaxHealth(stack) > 0
      ? this.engine.getStackHealth(stack) / this.engine.getStackMaxHealth(stack)
      : 0;
    context.fillStyle = '#321f20';
    context.fillRect(59, 59, 138, 9);
    context.fillStyle = healthRatio > 0.35 ? '#73c579' : '#e7a55d';
    context.fillRect(59, 59, 138 * healthRatio, 9);
    visual.texture.needsUpdate = true;
  }

  private bindInput(): void {
    const canvas = this.renderer.domElement;
    const signal = this.listeners.signal;
    canvas.addEventListener('contextmenu', (event) => event.preventDefault(), { signal });
    canvas.addEventListener('pointerdown', (event) => {
      this.pointerDown = {
        x: event.clientX,
        y: event.clientY,
        button: event.button,
        camera: event.button !== 0 || event.shiftKey || event.pointerType === 'touch',
        pointerId: event.pointerId,
      };
      this.dragged = false;
      canvas.setPointerCapture(event.pointerId);
    }, { signal });
    canvas.addEventListener('pointermove', (event) => {
      if (this.pointerDown) {
        const dx = event.clientX - this.pointerDown.x;
        const dy = event.clientY - this.pointerDown.y;
        if (Math.abs(dx) + Math.abs(dy) > 4) this.dragged = true;
        if (this.pointerDown.camera && this.dragged) {
          if (this.pointerDown.button === 1 || this.pointerDown.button === 0 && event.shiftKey) {
            this.target.x -= dx * 0.025 / this.camera.zoom;
            this.target.z -= dy * 0.025 / this.camera.zoom;
          } else {
            this.yaw -= dx * 0.007;
          }
          this.pointerDown.x = event.clientX;
          this.pointerDown.y = event.clientY;
          this.updateCamera();
          return;
        }
      }
      const picked = this.pick(event);
      this.handlers.onHover({ ...picked, clientX: event.clientX, clientY: event.clientY });
    }, { signal });
    canvas.addEventListener('pointerup', (event) => {
      const down = this.pointerDown;
      this.pointerDown = null;
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
      if (!down || down.button !== 0 || this.dragged || this.animating) return;
      const picked = this.pick(event);
      if (picked.stackId) this.handlers.onStackClick(picked.stackId);
      else if (picked.hex) this.handlers.onHexClick(picked.hex);
    }, { signal });
    canvas.addEventListener('pointerleave', () => {
      this.pointerDown = null;
      this.handlers.onHover({ stackId: null, hex: null, clientX: 0, clientY: 0 });
    }, { signal });
    canvas.addEventListener('wheel', (event) => {
      event.preventDefault();
      this.zoomBy(Math.exp(-event.deltaY * 0.001));
    }, { signal, passive: false });
  }

  private pick(event: PointerEvent): { stackId: string | null; hex: HexCoord | null } {
    const bounds = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(
      (event.clientX - bounds.left) / bounds.width * 2 - 1,
      -(event.clientY - bounds.top) / bounds.height * 2 + 1,
    );
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects(this.scene.children, true);
    let hex: HexCoord | null = null;
    for (const hit of hits) {
      let object: THREE.Object3D | null = hit.object;
      while (object) {
        if (typeof object.userData.stackId === 'string') {
          const stack = this.engine.getStack(object.userData.stackId);
          if (stack && (stack.count > 0 || this.visuals.get(stack.id)?.targetRing.visible)) {
            return { stackId: stack.id, hex: { ...stack.position } };
          }
        }
        if (!hex && object.userData.hex) hex = { ...(object.userData.hex as HexCoord) };
        object = object.parent;
      }
    }
    return { stackId: null, hex };
  }

  private updateCamera(): void {
    this.camera.position.set(
      this.target.x + Math.sin(this.yaw) * 24,
      22,
      this.target.z + Math.cos(this.yaw) * 24,
    );
    this.camera.lookAt(this.target);
    this.camera.updateProjectionMatrix();
  }

  private render(time: number): void {
    if (this.disposed) return;
    for (let index = this.tweens.length - 1; index >= 0; index -= 1) {
      const tween = this.tweens[index];
      if (!tween) continue;
      const progress = Math.min(1, (time - tween.start) / tween.duration);
      tween.update(ease(Math.max(0, progress)));
      if (progress >= 1) {
        this.tweens.splice(index, 1);
        tween.resolve();
      }
    }
    if (this.activeRing.visible) {
      const scale = 1 + Math.sin(time * 0.006) * 0.07;
      this.activeRing.scale.setScalar(scale);
      const active = this.activeStackId ? this.engine.getStack(this.activeStackId) : undefined;
      if (active && !this.animating) this.activeRing.position.copy(worldPosition(active.position)).setY(0.12);
    }
    this.renderer.render(this.scene, this.camera);
  }

  private tween(duration: number, update: (progress: number) => void): Promise<void> {
    if (this.disposed) return Promise.resolve();
    return new Promise((resolve) => {
      this.tweens.push({ start: performance.now(), duration, update, resolve });
    });
  }

  private async animateMove(stackId: string, path: HexCoord[]): Promise<void> {
    const visual = this.visuals.get(stackId);
    if (!visual || path.length < 2) return;
    const points = path.map(worldPosition);
    const duration = Math.min(850, 150 * (points.length - 1));
    await this.tween(duration, (progress) => {
      const scaled = progress * (points.length - 1);
      const index = Math.min(points.length - 2, Math.floor(scaled));
      const start = points[index];
      const end = points[index + 1];
      if (!start || !end) return;
      visual.group.position.lerpVectors(start, end, scaled - index);
      visual.group.position.y = Math.sin((scaled - index) * Math.PI) * 0.18;
      this.activeRing.position.copy(visual.group.position).setY(0.12);
    });
    visual.group.position.copy(points[points.length - 1] ?? worldPosition(path[path.length - 1] ?? { x: 0, y: 0 }));
  }

  private async animateAttack(event: Extract<BattleEvent, { kind: 'attack' }>): Promise<void> {
    const attacker = this.visuals.get(event.attackerId);
    const targetStack = this.engine.getStack(event.targetId);
    const target = this.visuals.get(event.targetId);
    if (!attacker || !target || !targetStack) return;
    const targetPosition = worldPosition(targetStack.position);
    if (event.attackType === 'ranged') {
      const projectile = new THREE.Mesh(
        new THREE.SphereGeometry(0.09, 6, 4),
        new THREE.MeshBasicMaterial({ color: 0xffd58a }),
      );
      const start = attacker.group.position.clone().add(new THREE.Vector3(0, 1, 0));
      const end = targetPosition.clone().add(new THREE.Vector3(0, 0.8, 0));
      projectile.position.copy(start);
      this.scene.add(projectile);
      await this.tween(300, (progress) => {
        projectile.position.lerpVectors(start, end, progress);
        projectile.position.y += Math.sin(progress * Math.PI) * 1.4;
      });
      this.scene.remove(projectile);
      projectile.geometry.dispose();
      (projectile.material as THREE.Material).dispose();
    } else {
      const start = attacker.group.position.clone();
      const direction = targetPosition.clone().sub(start).multiplyScalar(0.35);
      await this.tween(260, (progress) => {
        attacker.group.position.copy(start).addScaledVector(direction, Math.sin(progress * Math.PI));
      });
      attacker.group.position.copy(start);
    }
    this.floatText(targetStack.position, `−${event.damage}`, event.retaliation ? '#f3ae79' : '#ff8073');
    await this.tween(100, () => undefined);
  }

  private async animateSpell(event: Extract<BattleEvent, { kind: 'spell' }>): Promise<void> {
    const spell = getCombatSpell(event.spellId);
    const color = spell.school === 'fire' ? 0xff784e : spell.school === 'water' ? 0x72d7e8 :
      spell.school === 'earth' ? 0xc4b379 : 0xc4a5ef;
    const effect = typeof spell.effect === 'string' ? spell.effect : spell.effect.kind;
    const rings: THREE.Mesh[] = [];
    for (const targetId of event.targetIds) {
      const stack = this.engine.getStack(targetId);
      if (!stack) continue;
      const ring = this.createRing(color, 0.5, 0.08);
      ring.position.copy(worldPosition(stack.position)).setY(0.25);
      this.scene.add(ring);
      rings.push(ring);
      const amount = event.amounts[targetId] ?? 0;
      const damaging = effect === 'damage' || effect === 'chainDamage' || effect === 'massDamage';
      const healing = effect === 'heal' || effect === 'restoration';
      const text = damaging ? `−${amount}` : healing ? `+${amount}` : spell.name.toUpperCase();
      this.floatText(stack.position, text, healing ? '#83e39a' : '#d7b6ff');
    }
    const anchor = this.engine.getActiveStack() ?? this.engine.getLivingStacks(event.side)[0];
    if (anchor) {
      for (const side of ['attacker', 'defender'] as const) {
        const amount = event.amounts[`hero:${side}`];
        if (amount === undefined) continue;
        const ring = this.createRing(color, 0.65, 0.08);
        ring.position.copy(worldPosition(anchor.position)).setY(0.25);
        this.scene.add(ring);
        rings.push(ring);
        this.floatText(anchor.position, `${amount >= 0 ? '+' : '−'}${Math.abs(amount)} MANA`, '#83d9ef');
      }
    }
    await this.tween(420, (progress) => {
      for (const ring of rings) {
        ring.scale.setScalar(0.6 + progress * 1.8);
        (ring.material as THREE.MeshBasicMaterial).opacity = 1 - progress;
        ring.position.y = 0.2 + progress * 1.2;
      }
    });
    for (const ring of rings) {
      this.scene.remove(ring);
      ring.geometry.dispose();
      (ring.material as THREE.Material).dispose();
    }
  }

  private floatText(hex: HexCoord, text: string, color: string): void {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 96;
    const context = canvas.getContext('2d');
    if (!context) return;
    context.font = 'bold 42px Georgia, serif';
    context.textAlign = 'center';
    context.strokeStyle = '#15201d';
    context.lineWidth = 8;
    context.strokeText(text, 128, 58);
    context.fillStyle = color;
    context.fillText(text, 128, 58);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false }));
    const start = worldPosition(hex).add(new THREE.Vector3(0, 2.2, 0));
    sprite.position.copy(start);
    sprite.scale.set(2.3, 0.86, 1);
    this.scene.add(sprite);
    void this.tween(850, (progress) => {
      sprite.position.copy(start).add(new THREE.Vector3(0, progress * 1.1, 0));
      (sprite.material as THREE.SpriteMaterial).opacity = 1 - Math.max(0, progress - 0.55) / 0.45;
    }).then(() => {
      this.scene.remove(sprite);
      texture.dispose();
      sprite.material.dispose();
    });
  }
}
