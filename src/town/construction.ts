import * as THREE from 'three';
import { getBuildingModelSpec } from './registry';

export const CONSTRUCTION_SPEEDS = [0.5, 1, 2, 4] as const;
export type ConstructionSpeed = (typeof CONSTRUCTION_SPEEDS)[number];
export type ConstructionStageId =
  | 'foundation'
  | 'supports'
  | 'walls'
  | 'roof'
  | 'fittings'
  | 'details'
  | 'surroundings'
  | 'finishing';

export interface ConstructionStage {
  id: ConstructionStageId;
  label: string;
  index: number;
  start: number;
  end: number;
  duration: number;
}

export interface ConstructionTimeline {
  townId: string;
  buildingId: string;
  seed: number;
  duration: number;
  stages: readonly ConstructionStage[];
}

export interface ConstructionSample {
  time: number;
  progress: number;
  completed: boolean;
  stageIndex: number;
  stage: ConstructionStage;
  stageProgress: number;
}

export interface ConstructionComponentMotion {
  id: string;
  stageIndex: number;
  start: number;
  duration: number;
  dropHeight: number;
  bounce: number;
  driftX: number;
  driftZ: number;
  growth: boolean;
}

export interface ConstructionComponentSample {
  visible: boolean;
  offsetX: number;
  offsetY: number;
  offsetZ: number;
  scale: number;
  progress: number;
}

export interface ConstructionComponent {
  readonly id: string;
  readonly label: string;
  readonly geometryType: string;
  readonly object: THREE.Mesh;
  readonly stageIndex: number;
  readonly stageOrder: number;
  readonly stageComponentCount: number;
  readonly motion: ConstructionComponentMotion;
  readonly basePosition: THREE.Vector3;
  readonly baseScale: THREE.Vector3;
  readonly baseVisible: boolean;
}

export interface ConstructionComponentStatus {
  id: string;
  label: string;
  geometryType: string;
  stageIndex: number;
  stageOrder: number;
  stageComponentCount: number;
}

export interface ConstructionStatus {
  townId: string;
  buildingId: string;
  buildingName: string;
  time: number;
  duration: number;
  progress: number;
  speed: ConstructionSpeed;
  playing: boolean;
  completed: boolean;
  reducedMotion: boolean;
  stageIndex: number;
  stageId: ConstructionStageId;
  stageLabel: string;
  stageProgress: number;
  component: ConstructionComponentStatus | null;
}

export interface ConstructionStartOptions {
  autoplay?: boolean;
  speed?: ConstructionSpeed;
  reducedMotion?: boolean;
}

interface ComponentMetrics {
  object: THREE.Mesh;
  index: number;
  center: THREE.Vector3;
  size: THREE.Vector3;
  normalizedY: number;
  radial: number;
  slenderness: number;
  volume: number;
  luminous: boolean;
  stageIndex: number;
}

const STAGE_DEFINITIONS: readonly { id: ConstructionStageId; label: string; duration: number }[] = [
  { id: 'foundation', label: 'Foundation', duration: 1.25 },
  { id: 'supports', label: 'Supports', duration: 1.35 },
  { id: 'walls', label: 'Walls', duration: 1.55 },
  { id: 'roof', label: 'Roof', duration: 1.45 },
  { id: 'fittings', label: 'Fittings', duration: 1.2 },
  { id: 'details', label: 'Details', duration: 1.3 },
  { id: 'surroundings', label: 'Surroundings', duration: 1.25 },
  { id: 'finishing', label: 'Finishing', duration: 1.1 },
];

function finiteTime(value: number): number {
  return Number.isNaN(value) ? 0 : value;
}

function clampTime(timeline: ConstructionTimeline, value: number): number {
  return Math.max(0, Math.min(timeline.duration, finiteTime(value)));
}

function hash(value: string): number {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
}

function seededUnit(seed: number, key: string): number {
  return hash(`${seed}:${key}`) / 4294967295;
}

function smoothstep(value: number): number {
  return value * value * (3 - 2 * value);
}

function easeOutBack(value: number): number {
  const overshoot = 1.18;
  const shifted = value - 1;
  return 1 + (overshoot + 1) * shifted * shifted * shifted + overshoot * shifted * shifted;
}

export function createConstructionTimeline(townId: string, buildingId: string): ConstructionTimeline {
  getBuildingModelSpec(buildingId);
  const seed = hash(`aster-vale-construction:${townId}:${buildingId}`);
  const stages: ConstructionStage[] = [];
  let start = 0;
  for (const [index, definition] of STAGE_DEFINITIONS.entries()) {
    const duration = definition.duration * (0.94 + seededUnit(seed, `stage-${definition.id}`) * 0.12);
    stages.push({
      id: definition.id,
      label: definition.label,
      index,
      start,
      end: start + duration,
      duration,
    });
    start += duration;
  }
  return Object.freeze({
    townId,
    buildingId,
    seed,
    duration: start,
    stages: Object.freeze(stages.map((stage) => Object.freeze(stage))),
  });
}

export function sampleConstructionTimeline(timeline: ConstructionTimeline, value: number): ConstructionSample {
  const time = clampTime(timeline, value);
  const completed = time >= timeline.duration;
  let stageIndex = timeline.stages.length - 1;
  if (!completed) {
    stageIndex = timeline.stages.findIndex((stage) => time < stage.end);
    if (stageIndex < 0) stageIndex = timeline.stages.length - 1;
  }
  const stage = timeline.stages[stageIndex]!;
  const stageProgress = completed ? 1 : Math.max(0, Math.min(1, (time - stage.start) / stage.duration));
  return {
    time,
    progress: completed || timeline.duration <= 0 ? 1 : time / timeline.duration,
    completed,
    stageIndex,
    stage,
    stageProgress,
  };
}

export function sampleConstructionComponent(
  motion: ConstructionComponentMotion,
  baseVisible: boolean,
  value: number,
): ConstructionComponentSample {
  const time = finiteTime(value);
  if (time < motion.start) {
    return { visible: false, offsetX: motion.driftX, offsetY: motion.dropHeight, offsetZ: motion.driftZ, scale: motion.growth ? 0.12 : 1, progress: 0 };
  }
  const progress = Math.max(0, Math.min(1, (time - motion.start) / motion.duration));
  if (progress >= 1) {
    return { visible: baseVisible, offsetX: 0, offsetY: 0, offsetZ: 0, scale: 1, progress: 1 };
  }
  const landing = 0.74;
  let offsetY: number;
  if (progress < landing) {
    const fall = progress / landing;
    offsetY = motion.dropHeight * (1 - fall * fall);
  } else {
    const bounce = (progress - landing) / (1 - landing);
    offsetY = motion.bounce * Math.sin(Math.PI * bounce) * (1 - bounce);
  }
  const travel = 1 - smoothstep(Math.min(1, progress / landing));
  const scale = motion.growth ? 0.12 + 0.88 * easeOutBack(progress) : 1;
  return {
    visible: baseVisible,
    offsetX: motion.driftX * travel,
    offsetY,
    offsetZ: motion.driftZ * travel,
    scale,
    progress,
  };
}

export class ConstructionClock {
  readonly timeline: ConstructionTimeline;
  time = 0;
  speed: ConstructionSpeed = 1;
  playing = false;
  private anchorNow = 0;
  private anchorTime = 0;

  constructor(timeline: ConstructionTimeline, speed: ConstructionSpeed = 1) {
    this.timeline = timeline;
    this.speed = speed;
  }

  tick(now: number): ConstructionSample {
    if (this.playing) {
      const elapsed = Math.max(0, finiteTime(now) - this.anchorNow) / 1000;
      this.time = clampTime(this.timeline, this.anchorTime + elapsed * this.speed);
      if (this.time >= this.timeline.duration) this.playing = false;
    }
    return sampleConstructionTimeline(this.timeline, this.time);
  }

  play(now: number): ConstructionSample {
    this.tick(now);
    if (this.time >= this.timeline.duration) this.time = 0;
    this.anchorTime = this.time;
    this.anchorNow = finiteTime(now);
    this.playing = true;
    return this.tick(now);
  }

  pause(now: number): ConstructionSample {
    const sample = this.tick(now);
    this.anchorTime = this.time;
    this.anchorNow = finiteTime(now);
    this.playing = false;
    return sample;
  }

  seek(value: number, now: number): ConstructionSample {
    this.time = clampTime(this.timeline, value);
    this.anchorTime = this.time;
    this.anchorNow = finiteTime(now);
    if (this.time >= this.timeline.duration) this.playing = false;
    return sampleConstructionTimeline(this.timeline, this.time);
  }

  setSpeed(speed: ConstructionSpeed, now: number): ConstructionSample {
    if (!CONSTRUCTION_SPEEDS.includes(speed)) throw new Error(`Unsupported construction speed: ${speed}`);
    const sample = this.tick(now);
    this.speed = speed;
    this.anchorTime = this.time;
    this.anchorNow = finiteTime(now);
    return sample;
  }
}

function stagePreference(metrics: Omit<ComponentMetrics, 'stageIndex'>): number {
  const name = metrics.object.name.toLowerCase();
  if (metrics.normalizedY < 0.15 && metrics.size.y < 0.55) return 0;
  if (metrics.radial > 0.7 && metrics.normalizedY < 0.48) return 6;
  if (name.includes('roof') || name.includes('canopy') || name.includes('awning')) return 3;
  if (metrics.normalizedY > 0.67 && (metrics.object.geometry.type.includes('Cone') || metrics.size.y < 1.3)) return 3;
  if (metrics.slenderness > 1.45 && metrics.normalizedY < 0.72) return 1;
  if (metrics.volume > 0.5 && metrics.normalizedY < 0.68) return 2;
  if (metrics.luminous || name.includes('detail') || name.includes('crest')) return 5;
  if (metrics.normalizedY < 0.52) return 4;
  if (metrics.normalizedY > 0.8) return 7;
  return 5;
}

function reassignmentCost(metrics: ComponentMetrics, targetStage: number): number {
  const y = metrics.normalizedY;
  const small = 1 / (1 + metrics.volume);
  switch (targetStage) {
    case 0: return y * 3 + metrics.size.y * 0.2;
    case 1: return Math.abs(y - 0.38) + 1 / (1 + metrics.slenderness);
    case 2: return Math.abs(y - 0.45) + small;
    case 3: return (1 - y) * 2 + (metrics.object.geometry.type.includes('Cone') ? 0 : 0.35);
    case 4: return Math.abs(y - 0.42) + small;
    case 5: return Math.abs(y - 0.64) + small - (metrics.luminous ? 0.5 : 0);
    case 6: return y * 1.5 + (1 - metrics.radial);
    case 7: return Math.abs(y - 0.78) + small;
    default: return 0;
  }
}

function componentLabel(object: THREE.Mesh, index: number): string {
  if (object.name) return object.name.replaceAll(/[-_]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
  const geometry = object.geometry.type.replace(/Geometry$/, '').replace(/([a-z])([A-Z])/g, '$1 $2');
  return `${geometry} component ${index + 1}`;
}

function collectMetrics(model: THREE.Group): { metrics: ComponentMetrics[]; height: number } {
  model.updateWorldMatrix(true, true);
  const inverseModel = model.matrixWorld.clone().invert();
  const bounds = new THREE.Box3();
  const entries: Omit<ComponentMetrics, 'normalizedY' | 'radial' | 'stageIndex'>[] = [];
  let index = 0;
  model.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    const geometry = object.geometry;
    if (!geometry.boundingBox) geometry.computeBoundingBox();
    const relative = inverseModel.clone().multiply(object.matrixWorld);
    const objectBounds = geometry.boundingBox
      ? geometry.boundingBox.clone().applyMatrix4(relative)
      : new THREE.Box3().setFromObject(object);
    if (objectBounds.isEmpty()) return;
    const center = objectBounds.getCenter(new THREE.Vector3());
    const size = objectBounds.getSize(new THREE.Vector3());
    bounds.union(objectBounds);
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    const luminous = materials.some((material) => 'emissiveIntensity' in material && Number(material.emissiveIntensity) > 0);
    entries.push({
      object,
      index,
      center,
      size,
      slenderness: size.y / Math.max(0.001, Math.max(size.x, size.z)),
      volume: size.x * size.y * size.z,
      luminous,
    });
    index += 1;
  });
  const height = Math.max(0.001, bounds.max.y - bounds.min.y);
  const radius = Math.max(0.001, bounds.max.x - bounds.min.x, bounds.max.z - bounds.min.z) / 2;
  const centerX = (bounds.min.x + bounds.max.x) / 2;
  const centerZ = (bounds.min.z + bounds.max.z) / 2;
  const metrics = entries.map((entry) => {
    const normalizedY = (entry.center.y - bounds.min.y) / height;
    const radial = Math.hypot(entry.center.x - centerX, entry.center.z - centerZ) / radius;
    const withoutStage = { ...entry, normalizedY, radial };
    return { ...withoutStage, stageIndex: stagePreference(withoutStage) };
  });
  return { metrics, height };
}

function balanceStages(metrics: ComponentMetrics[]): void {
  for (let target = 0; target < STAGE_DEFINITIONS.length; target += 1) {
    if (metrics.some((entry) => entry.stageIndex === target)) continue;
    let candidate: ComponentMetrics | undefined;
    let candidateCost = Number.POSITIVE_INFINITY;
    for (const entry of metrics) {
      if (metrics.filter((other) => other.stageIndex === entry.stageIndex).length <= 1) continue;
      const cost = reassignmentCost(entry, target);
      if (cost < candidateCost || (cost === candidateCost && entry.index < (candidate?.index ?? Number.MAX_SAFE_INTEGER))) {
        candidate = entry;
        candidateCost = cost;
      }
    }
    if (candidate) candidate.stageIndex = target;
  }
}

function createMotion(
  timeline: ConstructionTimeline,
  componentId: string,
  stageIndex: number,
  order: number,
  count: number,
  modelHeight: number,
): ConstructionComponentMotion {
  const stage = timeline.stages[stageIndex]!;
  const start = stage.start + stage.duration * 0.3 * order / Math.max(1, count);
  const available = stage.end - start;
  const duration = available * (0.84 + seededUnit(timeline.seed, `${componentId}:duration`) * 0.16);
  const direction = seededUnit(timeline.seed, `${componentId}:direction`) * Math.PI * 2;
  const drift = 0.06 + seededUnit(timeline.seed, `${componentId}:drift`) * 0.2;
  return {
    id: componentId,
    stageIndex,
    start,
    duration,
    dropHeight: modelHeight * (0.42 + seededUnit(timeline.seed, `${componentId}:drop`) * 0.38) + 0.8,
    bounce: 0.1 + seededUnit(timeline.seed, `${componentId}:bounce`) * 0.22,
    driftX: Math.cos(direction) * drift,
    driftZ: Math.sin(direction) * drift,
    growth: stageIndex === 0 || stageIndex >= 4,
  };
}

export class ConstructionModelAnimation {
  readonly model: THREE.Group;
  readonly timeline: ConstructionTimeline;
  readonly components: readonly ConstructionComponent[];
  private readonly highlight: THREE.Box3Helper | null = null;
  private readonly highlightRoot: THREE.Object3D | null;
  private disposed = false;

  constructor(model: THREE.Group, timeline: ConstructionTimeline, highlightRoot: THREE.Object3D | null = null) {
    this.model = model;
    this.timeline = timeline;
    this.highlightRoot = highlightRoot;
    const { metrics, height } = collectMetrics(model);
    balanceStages(metrics);
    const components: ConstructionComponent[] = [];
    for (let stageIndex = 0; stageIndex < STAGE_DEFINITIONS.length; stageIndex += 1) {
      const stageMetrics = metrics.filter((entry) => entry.stageIndex === stageIndex);
      stageMetrics.sort((left, right) => {
        const leftKey = left.center.y + seededUnit(timeline.seed, `order-${left.index}`) * 0.16;
        const rightKey = right.center.y + seededUnit(timeline.seed, `order-${right.index}`) * 0.16;
        return leftKey - rightKey || left.index - right.index;
      });
      for (const [stageOrder, entry] of stageMetrics.entries()) {
        const id = `${timeline.buildingId}:${entry.index}`;
        const motion = createMotion(timeline, id, stageIndex, stageOrder, stageMetrics.length, height);
        entry.object.userData.constructionComponentId = id;
        entry.object.userData.constructionStage = timeline.stages[stageIndex]!.id;
        components.push({
          id,
          label: componentLabel(entry.object, entry.index),
          geometryType: entry.object.geometry.type,
          object: entry.object,
          stageIndex,
          stageOrder,
          stageComponentCount: stageMetrics.length,
          motion,
          basePosition: entry.object.position.clone(),
          baseScale: entry.object.scale.clone(),
          baseVisible: entry.object.visible,
        });
      }
    }
    this.components = Object.freeze(components);
    if (highlightRoot) {
      this.highlight = new THREE.Box3Helper(new THREE.Box3(), 0xffe38a);
      this.highlight.name = 'construction-component-highlight';
      this.highlight.visible = false;
      this.highlight.renderOrder = 20;
      const material = this.highlight.material as THREE.LineBasicMaterial;
      material.depthTest = false;
      material.transparent = true;
      material.opacity = 0.95;
      highlightRoot.add(this.highlight);
    }
  }

  sample(value: number): { sample: ConstructionSample; component: ConstructionComponentStatus | null } {
    if (this.disposed) return { sample: sampleConstructionTimeline(this.timeline, value), component: null };
    const sample = sampleConstructionTimeline(this.timeline, value);
    for (const component of this.components) {
      const transform = sampleConstructionComponent(component.motion, component.baseVisible, sample.time);
      component.object.visible = transform.visible;
      if (transform.progress >= 1) {
        component.object.position.copy(component.basePosition);
        component.object.scale.copy(component.baseScale);
      } else {
        component.object.position.set(
          component.basePosition.x + transform.offsetX,
          component.basePosition.y + transform.offsetY,
          component.basePosition.z + transform.offsetZ,
        );
        component.object.scale.copy(component.baseScale).multiplyScalar(transform.scale);
      }
    }
    const stageComponents = this.components.filter((component) => component.stageIndex === sample.stageIndex);
    const active = stageComponents.find((component) => {
      const progress = (sample.time - component.motion.start) / component.motion.duration;
      return progress >= 0 && progress < 1;
    }) ?? stageComponents.at(-1) ?? null;
    if (this.highlight) {
      this.highlight.visible = Boolean(active?.object.visible && !sample.completed);
      if (active && this.highlight.visible) {
        active.object.updateWorldMatrix(true, false);
        this.highlight.box.setFromObject(active.object);
        this.highlight.updateMatrixWorld(true);
      }
    }
    return {
      sample,
      component: active ? {
        id: active.id,
        label: active.label,
        geometryType: active.geometryType,
        stageIndex: active.stageIndex,
        stageOrder: active.stageOrder,
        stageComponentCount: active.stageComponentCount,
      } : null,
    };
  }

  restore(): void {
    for (const component of this.components) {
      component.object.visible = component.baseVisible;
      component.object.position.copy(component.basePosition);
      component.object.scale.copy(component.baseScale);
    }
    if (this.highlight) this.highlight.visible = false;
  }

  dispose(): void {
    if (this.disposed) return;
    this.restore();
    this.disposed = true;
    if (this.highlight) {
      this.highlightRoot?.remove(this.highlight);
      this.highlight.geometry.dispose();
      const materials = Array.isArray(this.highlight.material) ? this.highlight.material : [this.highlight.material];
      for (const material of materials) material.dispose();
    }
  }
}
