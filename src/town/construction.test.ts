import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { BUILDINGS } from '../game/content';
import './factions';
import {
  CONSTRUCTION_SPEEDS,
  ConstructionClock,
  ConstructionModelAnimation,
  createConstructionTimeline,
  sampleConstructionComponent,
  sampleConstructionTimeline,
  type ConstructionSpeed,
} from './construction';
import { createBuildingModel, disposeTownObject } from './models';
import { BUILDING_MODEL_REGISTRY, getBuildingModelSpec } from './registry';

const STAGE_IDS = ['foundation', 'supports', 'walls', 'roof', 'fittings', 'details', 'surroundings', 'finishing'] as const;

function snapshot(model: THREE.Group): string {
  const parts: string[] = [];
  model.traverse((object) => {
    parts.push([
      object.id,
      object.uuid,
      object.visible,
      ...object.position.toArray(),
      ...object.scale.toArray(),
      ...object.quaternion.toArray(),
    ].join(':'));
  });
  return parts.join('|');
}

describe('deterministic construction timeline', () => {
  it('creates the eight ordered stages from the town and real building seed', () => {
    const first = createConstructionTimeline('haven', 'archeryRange');
    const repeat = createConstructionTimeline('haven', 'archeryRange');
    const otherTown = createConstructionTimeline('grove', 'archeryRange');
    expect(first).toEqual(repeat);
    expect(first.stages.map((stage) => stage.id)).toEqual(STAGE_IDS);
    expect(first.stages.map((stage) => stage.label)).toEqual([
      'Foundation', 'Supports', 'Walls', 'Roof', 'Fittings', 'Details', 'Surroundings', 'Finishing',
    ]);
    expect(first.seed).not.toBe(otherTown.seed);
    expect(first.stages[0]!.start).toBe(0);
    expect(first.duration).toBeGreaterThan(8);
    for (const [index, stage] of first.stages.entries()) {
      expect(stage.index).toBe(index);
      expect(stage.end).toBe(stage.start + stage.duration);
      if (index > 0) expect(stage.start).toBe(first.stages[index - 1]!.end);
    }
    expect(first.stages.at(-1)!.end).toBe(first.duration);
    expect(() => createConstructionTimeline('haven', 'missing-building')).toThrow('No town model specification');
    expect(() => createConstructionTimeline('haven', '__proto__')).toThrow('No town model specification');
  });

  it('samples exact boundaries, arbitrary times, and clamped extremes without accumulated state', () => {
    const timeline = createConstructionTimeline('cove', 'seaWitchTower');
    const times = [
      Number.NaN, -100, 0, ...timeline.stages.flatMap((stage) => [stage.start, stage.start + stage.duration * 0.37, stage.end]),
      timeline.duration * 0.83, timeline.duration, Number.POSITIVE_INFINITY,
    ];
    for (const time of times) {
      const expectedTime = Number.isNaN(time) ? 0 : Math.max(0, Math.min(timeline.duration, time));
      expect(sampleConstructionTimeline(timeline, time)).toEqual(sampleConstructionTimeline(timeline, expectedTime));
    }
    for (const [index, stage] of timeline.stages.entries()) {
      const atStart = sampleConstructionTimeline(timeline, stage.start);
      expect(atStart.stageIndex).toBe(index);
      expect(atStart.stageProgress).toBe(0);
      expect(sampleConstructionTimeline(timeline, stage.start + stage.duration / 2).stageProgress).toBeCloseTo(0.5);
    }
    const final = sampleConstructionTimeline(timeline, timeline.duration);
    expect(final.completed).toBe(true);
    expect(final.progress).toBe(1);
    expect(final.stageIndex).toBe(7);
    expect(final.stageProgress).toBe(1);
  });

  it('uses absolute clock anchors for pause, scrub, irregular frames, and all playback speeds', () => {
    const timeline = createConstructionTimeline('tower', 'gremlinWorkshop');
    const clock = new ConstructionClock(timeline);
    clock.play(1_000);
    expect(clock.tick(1_750).time).toBe(0.75);
    expect(clock.tick(2_100).time).toBeCloseTo(1.1);
    clock.pause(2_200);
    const paused = clock.time;
    expect(clock.tick(99_000).time).toBe(paused);
    clock.seek(0.4, 100_000);
    expect(clock.tick(100_500).time).toBe(0.4);
    clock.play(101_000);
    expect(clock.tick(101_500).time).toBeCloseTo(0.9);
    for (const speed of CONSTRUCTION_SPEEDS) {
      clock.seek(1, 200_000);
      clock.play(200_000);
      clock.setSpeed(speed, 200_100);
      const anchored = clock.time;
      expect(clock.tick(200_600).time).toBeCloseTo(anchored + 0.5 * speed);
    }
    clock.seek(timeline.duration * 0.7, 300_000);
    clock.play(300_000);
    expect(clock.tick(300_250).time).toBeCloseTo(timeline.duration * 0.7 + 0.25 * clock.speed);
    clock.seek(timeline.duration, 400_000);
    expect(clock.playing).toBe(false);
    clock.play(400_100);
    expect(clock.time).toBe(0);
    expect(clock.playing).toBe(true);
    expect(() => clock.setSpeed(3 as ConstructionSpeed, 500_000)).toThrow('Unsupported construction speed');
  });

  it('provides drop, bounce, drift, and later-stage growth as pure component functions', () => {
    const timeline = createConstructionTimeline('factory', 'automatonAssembly');
    const model = createBuildingModel(getBuildingModelSpec('automatonAssembly'), 'factory', true);
    const animation = new ConstructionModelAnimation(model, timeline);
    const dropping = animation.components.find((component) => component.stageIndex === 3)!;
    const growing = animation.components.find((component) => component.stageIndex === 6)!;
    const early = sampleConstructionComponent(dropping.motion, true, dropping.motion.start - 0.001);
    expect(early.visible).toBe(false);
    const falling = sampleConstructionComponent(dropping.motion, true, dropping.motion.start + dropping.motion.duration * 0.3);
    expect(falling.visible).toBe(true);
    expect(falling.offsetY).toBeGreaterThan(0);
    expect(Math.hypot(falling.offsetX, falling.offsetZ)).toBeGreaterThan(0);
    const bouncing = sampleConstructionComponent(dropping.motion, true, dropping.motion.start + dropping.motion.duration * 0.85);
    expect(bouncing.offsetY).toBeGreaterThan(0);
    expect(bouncing.offsetY).toBeLessThan(dropping.motion.bounce);
    const growth = sampleConstructionComponent(growing.motion, true, growing.motion.start + growing.motion.duration * 0.4);
    expect(growth.scale).toBeGreaterThan(0.12);
    expect(growth.scale).toBeLessThan(1.1);
    expect(sampleConstructionComponent(growing.motion, true, timeline.duration)).toEqual({
      visible: true, offsetX: 0, offsetY: 0, offsetZ: 0, scale: 1, progress: 1,
    });
    animation.dispose();
    disposeTownObject(model);
  });
});

describe('all-building construction model animation', () => {
  it.each(Object.keys(BUILDING_MODEL_REGISTRY))('animates and restores every original mesh in %s across all eight stages', (buildingId) => {
    expect(BUILDINGS[buildingId]).toBeDefined();
    const spec = getBuildingModelSpec(buildingId);
    const faction = spec.faction ?? 'haven';
    const model = createBuildingModel(spec, faction, true);
    const timeline = createConstructionTimeline(`${faction}-town`, buildingId);
    const highlightRoot = new THREE.Scene();
    const animation = new ConstructionModelAnimation(model, timeline, highlightRoot);
    const baseline = snapshot(model);
    const meshCount = animation.components.length;
    expect(meshCount).toBeGreaterThanOrEqual(8);
    expect(new Set(animation.components.map((component) => component.stageIndex))).toEqual(new Set([0, 1, 2, 3, 4, 5, 6, 7]));
    expect(animation.model).toBe(model);
    expect(highlightRoot.children).toHaveLength(1);

    animation.sample(0);
    expect(animation.components.some((component) => !component.object.visible)).toBe(true);
    for (const stage of timeline.stages) {
      const midpoint = animation.sample(stage.start + stage.duration * 0.5);
      expect(midpoint.sample.stageIndex).toBe(stage.index);
      expect(midpoint.component?.stageIndex).toBe(stage.index);
      expect(animation.components.filter((component) => component.stageIndex === stage.index).some((component) => component.object.visible)).toBe(true);
      animation.sample(stage.end);
      for (const component of animation.components) {
        if (component.stageIndex > stage.index) continue;
        expect(component.object.position.toArray()).toEqual(component.basePosition.toArray());
        expect(component.object.scale.toArray()).toEqual(component.baseScale.toArray());
        expect(component.object.visible).toBe(component.baseVisible);
        expect(component.motion.start + component.motion.duration).toBeLessThanOrEqual(timeline.stages[component.stageIndex]!.end + 1e-9);
      }
    }

    for (const target of [timeline.duration * 0.81, timeline.duration * 0.17, timeline.duration * 0.59, 0, timeline.duration * 0.34]) {
      animation.sample(timeline.duration * 0.94);
      animation.sample(timeline.duration * 0.08);
      animation.sample(target);
      const scrubbed = snapshot(model);
      animation.restore();
      animation.sample(target);
      expect(snapshot(model), `${buildingId} direct sample at ${target}`).toBe(scrubbed);
    }

    animation.sample(Number.POSITIVE_INFINITY);
    expect(snapshot(model)).toBe(baseline);
    animation.sample(0);
    animation.dispose();
    expect(snapshot(model)).toBe(baseline);
    expect(highlightRoot.children).toHaveLength(0);
    animation.dispose();
    disposeTownObject(model);
  });
});
