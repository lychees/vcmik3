import type { ArtifactDefinition } from '../game/artifacts';
import type { CreatureDefinition } from '../game/types';

export const CONTENT_EDITOR_FORMAT = 'h3content-editor' as const;
export const CONTENT_EDITOR_VERSION = 1 as const;
export const CUSTOM_CONTENT_STORAGE_KEY = 'h3content.custom-registry.v1';

export interface CustomContentRegistry {
  readonly format: typeof CONTENT_EDITOR_FORMAT;
  readonly version: typeof CONTENT_EDITOR_VERSION;
  readonly creatures: readonly CreatureDefinition[];
  readonly artifacts: readonly ArtifactDefinition[];
}

export type EditorIssueCode =
  | 'type'
  | 'required'
  | 'range'
  | 'enum'
  | 'format'
  | 'version'
  | 'unknown-key'
  | 'prototype-key'
  | 'duplicate'
  | 'not-found'
  | 'storage';

export interface EditorIssue {
  readonly path: string;
  readonly code: EditorIssueCode;
  readonly message: string;
}

export type EditorResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly errors: readonly EditorIssue[] };

export type CustomContentListener = (registry: CustomContentRegistry) => void;
export type ContentImportMode = 'merge' | 'replace';

export interface CustomContentSource {
  getSnapshot(): CustomContentRegistry;
}
