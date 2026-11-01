import type * as THREE from 'three';
import type { ArtifactDefinition } from '../game/artifacts';
import type { BattleSideId } from '../battle/types';
import type { CreatureDefinition } from '../game/types';
import { createCustomCreatureModel } from './models';
import type { CustomContentRegistry, CustomContentSource } from './types';
import { cloneArtifact, cloneCreature, cloneRegistry } from './validation';

export interface CustomContentBattleDefinitions {
  readonly creatures: Readonly<Record<string, CreatureDefinition>>;
  readonly artifacts: Readonly<Record<string, ArtifactDefinition>>;
}

export interface CustomContentBattleHooks {
  getSnapshot(): CustomContentRegistry;
  getBattleDefinitions(): CustomContentBattleDefinitions;
  getCreature(id: string): CreatureDefinition | undefined;
  getArtifact(id: string): ArtifactDefinition | undefined;
  createCreatureModel(id: string, side?: BattleSideId): THREE.Group | undefined;
}

function definitionRecord<T extends { readonly id: string }>(definitions: readonly T[]): Record<string, T> {
  const result = Object.create(null) as Record<string, T>;
  for (const definition of definitions) result[definition.id] = definition;
  return result;
}

export function createCustomContentBattleHooks(source: CustomContentSource): CustomContentBattleHooks {
  return {
    getSnapshot: () => cloneRegistry(source.getSnapshot()),
    getBattleDefinitions: () => {
      const snapshot = source.getSnapshot();
      return {
        creatures: definitionRecord(snapshot.creatures.map(cloneCreature)),
        artifacts: definitionRecord(snapshot.artifacts.map(cloneArtifact)),
      };
    },
    getCreature: (id) => {
      const definition = source.getSnapshot().creatures.find((creature) => creature.id === id);
      return definition ? cloneCreature(definition) : undefined;
    },
    getArtifact: (id) => {
      const definition = source.getSnapshot().artifacts.find((artifact) => artifact.id === id);
      return definition ? cloneArtifact(definition) : undefined;
    },
    createCreatureModel: (id, side = 'attacker') => {
      const definition = source.getSnapshot().creatures.find((creature) => creature.id === id);
      return definition ? createCustomCreatureModel(definition, side) : undefined;
    },
  };
}
