import './styles.css';
import {
  ARTIFACT_RARITIES,
  ARTIFACT_SLOTS,
  ARTIFACT_STATS,
  type ArtifactDefinition,
} from '../game/artifacts';
import { EXTENDED_RESOURCE_TYPES as RESOURCE_TYPES } from '../game/resources';
import type { CreatureAbility, CreatureDefinition } from '../game/types';
import { ContentEditorStore, type ContentEditorStoreOptions } from './ContentEditorStore';
import { createCustomContentBattleHooks, type CustomContentBattleHooks } from './hooks';
import { CreatureModelPreview } from './preview';
import type { CustomContentListener, EditorIssue } from './types';
import { cloneArtifact, cloneCreature, CREATURE_ABILITIES, CREATURE_FACTIONS } from './validation';

let editorSequence = 0;

type ContentKind = 'creature' | 'artifact';
type ArtifactDraft = { -readonly [Key in keyof ArtifactDefinition]: ArtifactDefinition[Key] };
type ContentDraft = CreatureDefinition | ArtifactDraft;
type TransferMode = 'import' | 'export';

interface ConfirmationState {
  readonly title: string;
  readonly message: string;
  readonly confirmLabel: string;
  readonly action: () => void;
}

export interface ContentEditorOptions extends ContentEditorStoreOptions {
  readonly store?: ContentEditorStore;
  readonly modelFactory?: (definition: CreatureDefinition) => import('three').Group;
  readonly onChange?: CustomContentListener;
}

export class ContentEditor {
  private readonly container: HTMLElement;
  private readonly store: ContentEditorStore;
  private readonly root: HTMLElement;
  private readonly id = `content-editor-${++editorSequence}`;
  private readonly preview: CreatureModelPreview;
  private readonly unsubscribe: () => void;
  private readonly onChange?: CustomContentListener;
  private kind: ContentKind = 'creature';
  private draft: ContentDraft;
  private originalId: string | null = null;
  private dirty = false;
  private errors: readonly EditorIssue[] = [];
  private transferErrors: readonly EditorIssue[] = [];
  private confirmation: ConfirmationState | null = null;
  private confirmationReturnFocus: HTMLElement | null = null;
  private transferMode: TransferMode | null = null;
  private disposed = false;

  constructor(container: HTMLElement, options: ContentEditorOptions = {}) {
    this.container = container;
    this.store = options.store ?? new ContentEditorStore(options);
    this.onChange = options.onChange;
    const snapshot = this.store.getSnapshot();
    const firstCreature = snapshot.creatures[0];
    this.draft = firstCreature ? cloneCreature(firstCreature) : this.newCreature();
    this.originalId = firstCreature?.id ?? null;

    this.root = container.ownerDocument.createElement('section');
    this.root.className = 'content-editor';
    this.root.dataset.kind = this.kind;
    this.root.setAttribute('aria-labelledby', `${this.id}-title`);
    this.root.innerHTML = `
      <header class="content-editor-header">
        <div>
          <p class="content-editor-eyebrow">H3CONTENT</p>
          <h2 id="${this.id}-title">Custom creature &amp; artifact editor</h2>
          <p>Create reusable content, validate it, and register it for battle. Changes are stored locally in this browser.</p>
        </div>
        <div class="content-editor-actions" aria-label="Registry actions">
          <button type="button" data-action="export">Export JSON</button>
          <button type="button" data-action="import-open">Import JSON</button>
          <button type="button" class="content-editor-danger-quiet" data-action="reset">Reset custom content</button>
        </div>
      </header>
      <div class="content-editor-tabs" role="tablist" aria-label="Custom content type">
        <button type="button" role="tab" id="${this.id}-creatures-tab" data-action="tab" data-kind="creature" aria-controls="${this.id}-panel">Creatures</button>
        <button type="button" role="tab" id="${this.id}-artifacts-tab" data-action="tab" data-kind="artifact" aria-controls="${this.id}-panel">Artifacts</button>
      </div>
      <div class="content-editor-status" role="status" aria-live="polite" data-ui="status"></div>
      <div data-ui="confirmation"></div>
      <div data-ui="transfer"></div>
      <div class="content-editor-workspace">
        <aside class="content-editor-library" aria-label="Saved custom content">
          <div class="content-editor-library-heading">
            <h3 data-ui="list-title"></h3>
            <button type="button" data-action="new" data-ui="new"></button>
          </div>
          <p class="content-editor-library-help">Select an entry to edit or delete it.</p>
          <ul class="content-editor-list" data-ui="list"></ul>
        </aside>
        <section class="content-editor-form-panel" id="${this.id}-panel" role="tabpanel" data-ui="form-panel"></section>
        <aside class="content-editor-preview" aria-label="Live preview">
          <div class="content-editor-model" data-ui="model"></div>
          <div class="content-editor-preview-stats" data-ui="preview-stats" aria-live="polite"></div>
        </aside>
      </div>
    `;
    this.container.appendChild(this.root);
    this.root.addEventListener('click', this.handleClick);
    this.root.addEventListener('input', this.handleFieldInput);
    this.root.addEventListener('change', this.handleFieldInput);
    this.root.addEventListener('submit', this.handleSubmit);
    this.root.addEventListener('keydown', this.handleKeyDown);
    this.preview = new CreatureModelPreview(this.query('model'), { modelFactory: options.modelFactory });
    this.unsubscribe = this.store.subscribe(this.handleRegistryChange);
    this.renderTabs();
    this.renderList();
    this.renderForm();
    this.renderPreview();
    const loadIssues = this.store.getLoadIssues();
    if (loadIssues.length > 0) {
      this.setStatus(`Stored custom content could not be loaded: ${loadIssues.map((entry) => entry.message).join(' ')}`);
    } else {
      this.setStatus('Ready. New entries are saved only after validation succeeds.');
    }
  }

  getStore(): ContentEditorStore {
    return this.store;
  }

  getBattleHooks(): CustomContentBattleHooks {
    return createCustomContentBattleHooks(this.store);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.unsubscribe();
    this.preview.dispose();
    this.root.removeEventListener('click', this.handleClick);
    this.root.removeEventListener('input', this.handleFieldInput);
    this.root.removeEventListener('change', this.handleFieldInput);
    this.root.removeEventListener('submit', this.handleSubmit);
    this.root.removeEventListener('keydown', this.handleKeyDown);
    this.root.remove();
  }

  private readonly handleRegistryChange = (registry: ReturnType<ContentEditorStore['getSnapshot']>): void => {
    if (this.disposed) return;
    this.renderTabs(registry.creatures.length, registry.artifacts.length);
    this.renderList();
    this.onChange?.(registry);
  };

  private readonly handleClick = (event: Event): void => {
    const target = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('button[data-action]') : null;
    if (!target || !this.root.contains(target)) return;
    const action = target.dataset.action;
    if (action === 'tab') {
      const kind = target.dataset.kind === 'artifact' ? 'artifact' : 'creature';
      this.requestKind(kind);
    } else if (action === 'new') {
      this.requestNew();
    } else if (action === 'select') {
      const id = target.dataset.id;
      if (id) this.requestSelect(id);
    } else if (action === 'cancel') {
      this.cancelDraft();
    } else if (action === 'delete') {
      this.requestDelete();
    } else if (action === 'reset') {
      this.requestReset();
    } else if (action === 'export') {
      this.openTransfer('export');
    } else if (action === 'import-open') {
      this.requestImport();
    } else if (action === 'transfer-close') {
      this.transferMode = null;
      this.transferErrors = [];
      this.renderTransfer();
    } else if (action === 'import-apply') {
      this.applyImport();
    } else if (action === 'download') {
      this.downloadExport();
    } else if (action === 'confirm-yes') {
      const confirmation = this.confirmation;
      this.confirmation = null;
      this.renderConfirmation();
      confirmation?.action();
    } else if (action === 'confirm-no') {
      this.confirmation = null;
      this.renderConfirmation();
      if (this.confirmationReturnFocus?.isConnected) this.confirmationReturnFocus.focus();
      this.confirmationReturnFocus = null;
    }
  };

  private readonly handleSubmit = (event: Event): void => {
    if (!(event.target instanceof HTMLFormElement) || !event.target.matches('form[data-editor-form]')) return;
    event.preventDefault();
    this.saveDraft();
  };

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    const target = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('[role="tab"]') : null;
    if (!target || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const kind = event.key === 'Home'
      ? 'creature'
      : event.key === 'End'
        ? 'artifact'
        : target.dataset.kind === 'creature' ? 'artifact' : 'creature';
    const tab = this.root.querySelector<HTMLButtonElement>(`[role="tab"][data-kind="${kind}"]`);
    tab?.focus();
    if (kind !== this.kind) this.requestKind(kind);
  };

  private readonly handleFieldInput = (event: Event): void => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement)) return;
    if (target.dataset.action) return;
    let changed = false;
    if (this.kind === 'creature' && this.isCreature(this.draft)) changed = this.updateCreatureField(target);
    if (this.kind === 'artifact' && !this.isCreature(this.draft)) changed = this.updateArtifactField(target);
    if (!changed) return;
    this.dirty = true;
    this.errors = [];
    this.clearFieldErrors();
    this.renderPreview();
  };

  private updateCreatureField(control: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement): boolean {
    if (!this.isCreature(this.draft)) return false;
    const field = control.dataset.field;
    const numberField = () => control instanceof HTMLInputElement ? control.valueAsNumber : Number(control.value);
    if (control instanceof HTMLInputElement && control.dataset.ability) {
      const ability = control.dataset.ability as CreatureAbility;
      const abilities = new Set(this.draft.abilities);
      if (control.checked) abilities.add(ability);
      else abilities.delete(ability);
      this.draft.abilities = CREATURE_ABILITIES.filter((entry) => abilities.has(entry));
      return true;
    }
    if (control instanceof HTMLInputElement && control.dataset.resource) {
      const resource = control.dataset.resource as keyof CreatureDefinition['cost'];
      this.draft.cost = { ...this.draft.cost, [resource]: control.valueAsNumber };
      return true;
    }
    if (!field) return false;
    if (field === 'id' || field === 'name' || field === 'faction') {
      this.draft[field] = control.value;
      return true;
    }
    if (field === 'damageMin' || field === 'damageMax') {
      const index = field === 'damageMin' ? 0 : 1;
      const damage: [number, number] = [this.draft.damage[0], this.draft.damage[1]];
      damage[index] = numberField();
      this.draft.damage = damage;
      return true;
    }
    if (field === 'tier' || field === 'attack' || field === 'defense' || field === 'health' ||
      field === 'speed' || field === 'shots' || field === 'growth') {
      this.draft[field] = numberField();
      return true;
    }
    return false;
  }

  private updateArtifactField(control: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement): boolean {
    if (this.isCreature(this.draft)) return false;
    if (control instanceof HTMLInputElement && control.dataset.stat) {
      const stat = control.dataset.stat as keyof ArtifactDefinition['bonuses'];
      this.draft.bonuses = { ...this.draft.bonuses, [stat]: control.valueAsNumber };
      return true;
    }
    const field = control.dataset.field;
    if (field === 'id' || field === 'name' || field === 'description') {
      this.draft[field] = control.value;
      return true;
    }
    if (field === 'slot') {
      this.draft.slot = control.value as ArtifactDefinition['slot'];
      return true;
    }
    if (field === 'rarity') {
      this.draft.rarity = control.value as ArtifactDefinition['rarity'];
      return true;
    }
    return false;
  }

  private requestKind(kind: ContentKind): void {
    if (kind === this.kind) return;
    this.guardDraft(() => this.activateKind(kind));
  }

  private requestNew(): void {
    this.guardDraft(() => {
      this.draft = this.kind === 'creature' ? this.newCreature() : this.newArtifact();
      this.originalId = null;
      this.dirty = false;
      this.errors = [];
      this.renderList();
      this.renderForm();
      this.renderPreview();
      this.setStatus(`New ${this.kind} draft. A unique ID has been generated.`);
      this.focusField('name');
    });
  }

  private requestSelect(id: string): void {
    if (id === this.originalId) return;
    this.guardDraft(() => this.selectEntry(id));
  }

  private selectEntry(id: string): void {
    const snapshot = this.store.getSnapshot();
    const definition = this.kind === 'creature'
      ? snapshot.creatures.find((entry) => entry.id === id)
      : snapshot.artifacts.find((entry) => entry.id === id);
    if (!definition) {
      this.setStatus(`The selected ${this.kind} no longer exists.`);
      this.renderList();
      return;
    }
    this.draft = this.kind === 'creature'
      ? cloneCreature(definition as CreatureDefinition)
      : cloneArtifact(definition as ArtifactDefinition);
    this.originalId = id;
    this.dirty = false;
    this.errors = [];
    this.renderList();
    this.renderForm();
    this.renderPreview();
    this.setStatus(`Editing ${definition.name}.`);
  }

  private activateKind(kind: ContentKind): void {
    this.kind = kind;
    this.root.dataset.kind = kind;
    const snapshot = this.store.getSnapshot();
    if (kind === 'creature') {
      const first = snapshot.creatures[0];
      this.draft = first ? cloneCreature(first) : this.newCreature();
      this.originalId = first?.id ?? null;
    } else {
      const first = snapshot.artifacts[0];
      this.draft = first ? cloneArtifact(first) : this.newArtifact();
      this.originalId = first?.id ?? null;
    }
    this.dirty = false;
    this.errors = [];
    this.transferMode = null;
    this.transferErrors = [];
    this.renderTabs();
    this.renderList();
    this.renderForm();
    this.renderPreview();
    this.renderTransfer();
    this.setStatus(`Editing custom ${kind === 'creature' ? 'creatures' : 'artifacts'}.`);
  }

  private guardDraft(action: () => void): void {
    if (!this.dirty) {
      action();
      return;
    }
    this.requestConfirmation({
      title: 'Discard unsaved changes?',
      message: 'The saved registry has not been changed. Continue only if you want to discard this draft.',
      confirmLabel: 'Discard changes',
      action,
    });
  }

  private cancelDraft(): void {
    if (this.originalId) {
      this.selectEntry(this.originalId);
      this.setStatus('Changes cancelled. The saved entry was not modified.');
      this.focusField('name');
      return;
    }
    const snapshot = this.store.getSnapshot();
    const first = this.kind === 'creature' ? snapshot.creatures[0] : snapshot.artifacts[0];
    if (first) {
      this.selectEntry(first.id);
    } else {
      this.draft = this.kind === 'creature' ? this.newCreature() : this.newArtifact();
      this.originalId = null;
      this.dirty = false;
      this.errors = [];
      this.renderList();
      this.renderForm();
      this.renderPreview();
    }
    this.setStatus('New draft cancelled. Nothing was added to the registry.');
    this.focusField('name');
  }

  private saveDraft(): void {
    const result = this.kind === 'creature'
      ? this.originalId
        ? this.store.updateCreature(this.originalId, this.draft)
        : this.store.createCreature(this.draft)
      : this.originalId
        ? this.store.updateArtifact(this.originalId, this.draft)
        : this.store.createArtifact(this.draft);
    if (!result.ok) {
      this.errors = result.errors;
      this.renderForm();
      this.setStatus(`${result.errors.length} validation ${result.errors.length === 1 ? 'issue' : 'issues'} prevented saving.`);
      this.query<HTMLElement>('form-errors').focus();
      return;
    }
    const wasNew = this.originalId === null;
    this.draft = this.kind === 'creature'
      ? cloneCreature(result.value as CreatureDefinition)
      : cloneArtifact(result.value as ArtifactDefinition);
    this.originalId = result.value.id;
    this.dirty = false;
    this.errors = [];
    this.renderList();
    this.renderForm();
    this.renderPreview();
    this.setStatus(`${result.value.name} ${wasNew ? 'created' : 'updated'} and registered for custom battle content.`);
    this.focusSavedEntry(result.value.id);
  }

  private requestDelete(): void {
    if (!this.originalId) return;
    const id = this.originalId;
    this.requestConfirmation({
      title: `Delete ${this.draft.name}?`,
      message: `This removes the custom ${this.kind} from the local registry. Built-in game content is not affected.`,
      confirmLabel: `Delete ${this.kind}`,
      action: () => {
        const result = this.kind === 'creature' ? this.store.deleteCreature(id) : this.store.deleteArtifact(id);
        if (!result.ok) {
          this.errors = result.errors;
          this.renderForm();
          return;
        }
        this.originalId = null;
        const snapshot = this.store.getSnapshot();
        const next = this.kind === 'creature' ? snapshot.creatures[0] : snapshot.artifacts[0];
        if (next) this.selectEntry(next.id);
        else {
          this.draft = this.kind === 'creature' ? this.newCreature() : this.newArtifact();
          this.dirty = false;
          this.errors = [];
          this.renderList();
          this.renderForm();
          this.renderPreview();
        }
        this.setStatus(`${result.value.name} deleted.`);
      },
    });
  }

  private requestReset(): void {
    this.requestConfirmation({
      title: 'Reset all custom content?',
      message: 'This permanently deletes every custom creature and artifact from this browser. Export JSON first if you need a backup. Built-in content is not affected.',
      confirmLabel: 'Reset all content',
      action: () => {
        const result = this.store.reset();
        if (!result.ok) {
          this.errors = result.errors;
          this.renderForm();
          this.setStatus('Reset failed; the existing registry was retained.');
          return;
        }
        this.originalId = null;
        this.draft = this.kind === 'creature' ? this.newCreature() : this.newArtifact();
        this.dirty = false;
        this.errors = [];
        this.transferMode = null;
        this.transferErrors = [];
        this.renderList();
        this.renderForm();
        this.renderPreview();
        this.renderTransfer();
        this.setStatus('Custom content reset. The local registry is now empty.');
      },
    });
  }

  private requestImport(): void {
    this.guardDraft(() => this.openTransfer('import'));
  }

  private openTransfer(mode: TransferMode): void {
    this.transferMode = mode;
    this.transferErrors = [];
    this.renderTransfer();
  }

  private applyImport(): void {
    const textarea = this.root.querySelector<HTMLTextAreaElement>('[data-ui="json-input"]');
    const mode = this.root.querySelector<HTMLSelectElement>('[data-ui="import-mode"]');
    if (!textarea) return;
    this.lastImportText = textarea.value;
    this.lastImportMode = mode?.value === 'replace' ? 'replace' : 'merge';
    const result = this.store.importJson(textarea.value, { mode: this.lastImportMode });
    if (!result.ok) {
      this.transferErrors = result.errors;
      this.renderTransfer();
      this.root.querySelector<HTMLElement>('[data-ui="transfer-errors"]')?.focus();
      return;
    }
    this.transferMode = null;
    this.transferErrors = [];
    this.renderTransfer();
    const first = this.kind === 'creature' ? result.value.creatures[0] : result.value.artifacts[0];
    if (first) this.selectEntry(first.id);
    else {
      this.draft = this.kind === 'creature' ? this.newCreature() : this.newArtifact();
      this.originalId = null;
      this.dirty = false;
      this.renderList();
      this.renderForm();
      this.renderPreview();
    }
    this.setStatus(`Import complete: ${result.value.creatures.length} creatures and ${result.value.artifacts.length} artifacts are registered.`);
  }

  private downloadExport(): void {
    const document = this.root.ownerDocument;
    const blob = new Blob([this.store.exportJson()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'h3custom-content-v1.json';
    link.hidden = true;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
    this.setStatus('Versioned JSON export downloaded.');
  }

  private requestConfirmation(confirmation: ConfirmationState): void {
    this.confirmationReturnFocus = this.root.ownerDocument.activeElement instanceof HTMLElement
      ? this.root.ownerDocument.activeElement
      : null;
    this.confirmation = confirmation;
    this.renderConfirmation();
    this.root.querySelector<HTMLButtonElement>('[data-action="confirm-no"]')?.focus();
  }

  private renderConfirmation(): void {
    const mount = this.query('confirmation');
    mount.replaceChildren();
    if (!this.confirmation) return;
    const section = this.element('section', 'content-editor-confirmation');
    section.setAttribute('role', 'alertdialog');
    section.setAttribute('aria-labelledby', `${this.id}-confirm-title`);
    section.setAttribute('aria-describedby', `${this.id}-confirm-description`);
    const title = this.element('h3', '', this.confirmation.title);
    title.id = `${this.id}-confirm-title`;
    const message = this.element('p', '', this.confirmation.message);
    message.id = `${this.id}-confirm-description`;
    const actions = this.element('div', 'content-editor-confirmation-actions');
    const cancel = this.button('Keep editing', 'confirm-no');
    const confirm = this.button(this.confirmation.confirmLabel, 'confirm-yes', 'content-editor-danger');
    actions.append(cancel, confirm);
    section.append(title, message, actions);
    mount.appendChild(section);
  }

  private renderTransfer(): void {
    const mount = this.query('transfer');
    mount.replaceChildren();
    if (!this.transferMode) return;
    const section = this.element('section', 'content-editor-transfer');
    section.setAttribute('aria-labelledby', `${this.id}-transfer-title`);
    const heading = this.element('h3', '', this.transferMode === 'export' ? 'Export custom content' : 'Import custom content');
    heading.id = `${this.id}-transfer-title`;
    section.appendChild(heading);
    if (this.transferErrors.length > 0) {
      const errors = this.errorSummary(this.transferErrors, 'Import was not applied. No existing content was changed.');
      errors.dataset.ui = 'transfer-errors';
      section.appendChild(errors);
    }
    const document = this.root.ownerDocument;
    const label = document.createElement('label');
    label.className = 'content-editor-json-label';
    label.htmlFor = `${this.id}-json`;
    label.textContent = this.transferMode === 'export'
      ? 'Versioned registry JSON (saved entries only)'
      : 'Paste a version 1 H3CONTENT registry';
    const textarea = document.createElement('textarea');
    textarea.id = `${this.id}-json`;
    textarea.rows = 12;
    textarea.spellcheck = false;
    textarea.dataset.ui = 'json-input';
    if (this.transferMode === 'export') {
      textarea.readOnly = true;
      textarea.value = this.store.exportJson();
    } else {
      textarea.value = this.lastImportText;
    }
    section.append(label, textarea);
    if (this.transferMode === 'import') {
      const modeLabel = document.createElement('label');
      modeLabel.htmlFor = `${this.id}-import-mode`;
      modeLabel.textContent = 'Import behavior';
      const mode = document.createElement('select');
      mode.id = `${this.id}-import-mode`;
      mode.dataset.ui = 'import-mode';
      mode.append(
        this.option('merge', 'Merge; reject duplicate IDs'),
        this.option('replace', 'Replace the entire custom registry'),
      );
      mode.value = this.lastImportMode;
      section.append(modeLabel, mode);
    }
    const actions = this.element('div', 'content-editor-transfer-actions');
    if (this.transferMode === 'export') actions.appendChild(this.button('Download JSON', 'download'));
    else actions.appendChild(this.button('Validate and import', 'import-apply', 'content-editor-primary'));
    actions.appendChild(this.button('Close', 'transfer-close'));
    section.appendChild(actions);
    mount.appendChild(section);
    if (this.transferMode === 'export') {
      textarea.focus();
      textarea.select();
    }
  }

  private lastImportText = '';
  private lastImportMode: 'merge' | 'replace' = 'merge';

  private renderTabs(creatureCount?: number, artifactCount?: number): void {
    const snapshot = this.store.getSnapshot();
    const counts = {
      creature: creatureCount ?? snapshot.creatures.length,
      artifact: artifactCount ?? snapshot.artifacts.length,
    };
    for (const tab of this.root.querySelectorAll<HTMLButtonElement>('[role="tab"]')) {
      const kind = tab.dataset.kind as ContentKind;
      const selected = kind === this.kind;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
      tab.textContent = `${kind === 'creature' ? 'Creatures' : 'Artifacts'} (${counts[kind]})`;
    }
    this.query('form-panel').setAttribute('aria-labelledby', `${this.id}-${this.kind === 'creature' ? 'creatures' : 'artifacts'}-tab`);
  }

  private renderList(): void {
    const snapshot = this.store.getSnapshot();
    const entries: readonly (CreatureDefinition | ArtifactDefinition)[] = this.kind === 'creature' ? snapshot.creatures : snapshot.artifacts;
    this.query('list-title').textContent = this.kind === 'creature' ? 'Creature registry' : 'Artifact registry';
    this.query<HTMLButtonElement>('new').textContent = `New ${this.kind}`;
    const list = this.query('list');
    list.replaceChildren();
    if (entries.length === 0) {
      const empty = this.element('li', 'content-editor-empty', `No custom ${this.kind === 'creature' ? 'creatures' : 'artifacts'} yet.`);
      list.appendChild(empty);
      return;
    }
    for (const entry of entries) {
      const item = this.element('li', 'content-editor-list-item');
      const select = this.button('', 'select');
      select.dataset.id = entry.id;
      select.className = 'content-editor-list-select';
      select.setAttribute('aria-current', entry.id === this.originalId ? 'true' : 'false');
      const name = this.element('strong', '', entry.name);
      const detail = this.kind === 'creature'
        ? `${(entry as CreatureDefinition).faction} · Tier ${(entry as CreatureDefinition).tier}`
        : `${(entry as ArtifactDefinition).rarity} · ${(entry as ArtifactDefinition).slot}`;
      const meta = this.element('small', '', detail);
      const id = this.element('code', '', entry.id);
      select.append(name, meta, id);
      item.appendChild(select);
      list.appendChild(item);
    }
  }

  private renderForm(): void {
    const mount = this.query('form-panel');
    mount.replaceChildren();
    const document = this.root.ownerDocument;
    const form = document.createElement('form');
    form.dataset.editorForm = 'true';
    form.noValidate = true;
    form.setAttribute('aria-labelledby', `${this.id}-form-title`);
    const heading = this.element('h3', '', `${this.originalId ? 'Edit' : 'Create'} ${this.kind}`);
    heading.id = `${this.id}-form-title`;
    form.appendChild(heading);
    if (this.errors.length > 0) {
      const summary = this.errorSummary(this.errors, 'The entry was not saved. Correct the following fields:');
      summary.id = `${this.id}-form-errors`;
      summary.dataset.ui = 'form-errors';
      form.appendChild(summary);
    }
    const grid = this.element('div', 'content-editor-fields');
    if (this.kind === 'creature' && this.isCreature(this.draft)) this.renderCreatureFields(grid, this.draft);
    else if (!this.isCreature(this.draft)) this.renderArtifactFields(grid, this.draft);
    form.appendChild(grid);
    const actions = this.element('div', 'content-editor-form-actions');
    actions.appendChild(this.button(this.originalId ? 'Save changes' : `Create ${this.kind}`, 'save', 'content-editor-primary', 'submit'));
    actions.appendChild(this.button('Cancel', 'cancel'));
    if (this.originalId) actions.appendChild(this.button(`Delete ${this.kind}`, 'delete', 'content-editor-danger-quiet'));
    form.appendChild(actions);
    mount.appendChild(form);
  }

  private renderCreatureFields(parent: HTMLElement, creature: CreatureDefinition): void {
    parent.append(
      this.textControl('ID', 'id', creature.id, 'Unique content ID; letters, numbers, hyphens, and underscores.', this.originalId !== null),
      this.textControl('Name', 'name', creature.name, 'Shown in recruitment and battle.'),
      this.selectControl('Faction', 'faction', creature.faction, CREATURE_FACTIONS),
      this.selectControl('Tier', 'tier', String(creature.tier), ['1', '2', '3', '4']),
      this.numberControl('Attack', 'attack', creature.attack, 0, 999),
      this.numberControl('Defense', 'defense', creature.defense, 0, 999),
      this.numberControl('Minimum damage', 'damageMin', creature.damage[0], 0, 999_999, 'damage'),
      this.numberControl('Maximum damage', 'damageMax', creature.damage[1], 0, 999_999, 'damage'),
      this.numberControl('Health', 'health', creature.health, 1, 999_999),
      this.numberControl('Speed', 'speed', creature.speed, 1, 99),
      this.numberControl('Shots', 'shots', creature.shots, 0, 999, 'shots', 'Ranged creatures need at least one shot.'),
      this.numberControl('Weekly growth', 'growth', creature.growth, 0, 999),
    );
    const costs = this.element('fieldset', 'content-editor-fieldset content-editor-wide');
    costs.appendChild(this.element('legend', '', 'Recruitment cost'));
    const costGrid = this.element('div', 'content-editor-fields');
    for (const resource of RESOURCE_TYPES) {
      costGrid.appendChild(this.numberControl(
        this.capitalize(resource),
        `cost.${resource}`,
        creature.cost[resource] ?? 0,
        0,
        1_000_000,
        'cost',
        undefined,
        { resource },
      ));
    }
    costs.appendChild(costGrid);
    const abilities = this.element('fieldset', 'content-editor-fieldset content-editor-wide');
    abilities.appendChild(this.element('legend', '', 'Existing battle abilities'));
    const abilityGrid = this.element('div', 'content-editor-checkboxes');
    for (const ability of CREATURE_ABILITIES) {
      const label = this.element('label', 'content-editor-checkbox');
      const input = this.root.ownerDocument.createElement('input');
      input.type = 'checkbox';
      input.checked = creature.abilities.includes(ability);
      input.dataset.ability = ability;
      input.id = `${this.id}-ability-${ability}`;
      label.append(input, this.root.ownerDocument.createTextNode(this.abilityLabel(ability)));
      abilityGrid.appendChild(label);
    }
    abilities.appendChild(abilityGrid);
    parent.append(costs, abilities);
  }

  private renderArtifactFields(parent: HTMLElement, artifact: ArtifactDefinition): void {
    parent.append(
      this.textControl('ID', 'id', artifact.id, 'Unique content ID; letters, numbers, hyphens, and underscores.', this.originalId !== null),
      this.textControl('Name', 'name', artifact.name, 'Shown in inventories and hero equipment.'),
      this.selectControl('Slot', 'slot', artifact.slot, ARTIFACT_SLOTS),
      this.selectControl('Rarity', 'rarity', artifact.rarity, ARTIFACT_RARITIES),
      this.textControl('Description', 'description', artifact.description, 'A short description of the artifact.', false, true),
    );
    const bonuses = this.element('fieldset', 'content-editor-fieldset content-editor-wide');
    bonuses.appendChild(this.element('legend', '', 'Primary-stat bonuses'));
    const grid = this.element('div', 'content-editor-fields');
    for (const stat of ARTIFACT_STATS) {
      grid.appendChild(this.numberControl(
        this.statLabel(stat),
        `bonuses.${stat}`,
        artifact.bonuses[stat] ?? 0,
        0,
        99,
        'bonuses',
        'At least one bonus must be greater than zero.',
        { stat },
      ));
    }
    bonuses.appendChild(grid);
    parent.appendChild(bonuses);
  }

  private renderPreview(): void {
    this.query('model').hidden = this.kind !== 'creature';
    const mount = this.query('preview-stats');
    mount.replaceChildren();
    mount.dataset.previewKind = this.kind;
    mount.dataset.contentId = this.draft.id;
    mount.appendChild(this.element('h3', '', this.draft.name || 'Untitled content'));
    if (this.kind === 'creature' && this.isCreature(this.draft)) {
      const draft = this.draft;
      const creature = this.safePreviewCreature(draft);
      this.preview.update(creature);
      mount.appendChild(this.element('p', 'content-editor-preview-subtitle', `${creature.faction} · Tier ${creature.tier}`));
      const stats: readonly [string, string][] = [
        ['Attack / Defense', `${this.displayNumber(draft.attack)} / ${this.displayNumber(draft.defense)}`],
        ['Damage', `${this.displayNumber(draft.damage[0])}–${this.displayNumber(draft.damage[1])}`],
        ['Health', this.displayNumber(draft.health)],
        ['Speed', this.displayNumber(draft.speed)],
        ['Shots', this.displayNumber(draft.shots)],
        ['Growth', this.displayNumber(draft.growth)],
        ['Abilities', draft.abilities.length > 0 ? draft.abilities.map(this.abilityLabel).join(', ') : 'None'],
      ];
      mount.appendChild(this.definitionList(stats));
      const costs = RESOURCE_TYPES.filter((resource) => (draft.cost[resource] ?? 0) > 0)
        .map((resource) => `${draft.cost[resource]} ${resource}`);
      mount.appendChild(this.element('p', 'content-editor-preview-cost', `Cost: ${costs.join(', ') || 'Free'}`));
    } else if (!this.isCreature(this.draft)) {
      const draft = this.draft;
      mount.appendChild(this.element('p', 'content-editor-preview-subtitle', `${this.capitalize(draft.rarity)} ${draft.slot}`));
      mount.appendChild(this.element('p', '', draft.description));
      const stats = ARTIFACT_STATS.map((stat) => {
        const value = draft.bonuses[stat] ?? 0;
        return [this.statLabel(stat), Number.isFinite(value) ? `+${value}` : 'Invalid number'] as const;
      });
      mount.appendChild(this.definitionList(stats));
    }
  }

  private safePreviewCreature(creature: CreatureDefinition): CreatureDefinition {
    const finite = (value: number, fallback: number) => Number.isFinite(value) ? value : fallback;
    return {
      ...creature,
      tier: finite(creature.tier, 1),
      attack: finite(creature.attack, 0),
      defense: finite(creature.defense, 0),
      health: Math.max(1, finite(creature.health, 1)),
      speed: finite(creature.speed, 1),
      shots: finite(creature.shots, 0),
      growth: finite(creature.growth, 0),
      damage: [finite(creature.damage[0], 0), finite(creature.damage[1], 1)],
      cost: { ...creature.cost },
      abilities: [...creature.abilities],
    };
  }

  private errorSummary(errors: readonly EditorIssue[], heading: string): HTMLElement {
    const summary = this.element('div', 'content-editor-errors');
    summary.setAttribute('role', 'alert');
    summary.tabIndex = -1;
    summary.appendChild(this.element('strong', '', heading));
    const list = this.element('ul');
    for (const error of errors) list.appendChild(this.element('li', '', `${error.path}: ${error.message}`));
    summary.appendChild(list);
    return summary;
  }

  private textControl(
    labelText: string,
    field: string,
    value: string,
    hint: string,
    readOnly = false,
    multiline = false,
  ): HTMLElement {
    const wrapper = this.element('div', multiline ? 'content-editor-field content-editor-wide' : 'content-editor-field');
    const id = `${this.id}-field-${field}`;
    const label = this.element('label', '', labelText);
    label.htmlFor = id;
    const control = multiline
      ? this.root.ownerDocument.createElement('textarea')
      : this.root.ownerDocument.createElement('input');
    control.id = id;
    control.dataset.field = field;
    control.value = value;
    if (control instanceof HTMLInputElement) {
      control.type = 'text';
      control.readOnly = readOnly;
      control.maxLength = field === 'id' ? 64 : 80;
    } else {
      control.rows = 3;
      control.maxLength = 240;
    }
    this.applyFieldAccessibility(control, field, hint, id);
    wrapper.append(label, control);
    this.appendFieldMessages(wrapper, field, hint, id);
    return wrapper;
  }

  private numberControl(
    labelText: string,
    field: string,
    value: number,
    minimum: number,
    maximum: number,
    errorField = field,
    hint = '',
    dataset: { resource?: string; stat?: string } = {},
  ): HTMLElement {
    const wrapper = this.element('div', 'content-editor-field');
    const id = `${this.id}-field-${field.replace('.', '-')}`;
    const label = this.element('label', '', labelText);
    label.htmlFor = id;
    const input = this.root.ownerDocument.createElement('input');
    input.id = id;
    input.type = 'number';
    input.inputMode = 'numeric';
    input.step = '1';
    input.min = String(minimum);
    input.max = String(maximum);
    input.value = Number.isFinite(value) ? String(value) : '';
    if (field === 'damageMin' || field === 'damageMax') input.dataset.field = field;
    else if (!dataset.resource && !dataset.stat && !field.includes('.')) input.dataset.field = field;
    if (dataset.resource) input.dataset.resource = dataset.resource;
    if (dataset.stat) input.dataset.stat = dataset.stat;
    this.applyFieldAccessibility(input, errorField, hint, id);
    wrapper.append(label, input);
    this.appendFieldMessages(wrapper, errorField, hint, id);
    return wrapper;
  }

  private selectControl(
    labelText: string,
    field: string,
    value: string,
    choices: readonly string[],
  ): HTMLElement {
    const wrapper = this.element('div', 'content-editor-field');
    const id = `${this.id}-field-${field}`;
    const label = this.element('label', '', labelText);
    label.htmlFor = id;
    const select = this.root.ownerDocument.createElement('select');
    select.id = id;
    select.dataset.field = field;
    for (const choice of choices) select.appendChild(this.option(choice, this.capitalize(choice)));
    select.value = value;
    this.applyFieldAccessibility(select, field, '', id);
    wrapper.append(label, select);
    this.appendFieldMessages(wrapper, field, '', id);
    return wrapper;
  }

  private applyFieldAccessibility(control: HTMLElement, field: string, hint: string, id: string): void {
    const errors = this.fieldErrors(field);
    control.setAttribute('aria-invalid', String(errors.length > 0));
    const descriptions: string[] = [];
    if (hint) descriptions.push(`${id}-hint`);
    if (errors.length > 0) descriptions.push(`${id}-error`);
    if (descriptions.length > 0) control.setAttribute('aria-describedby', descriptions.join(' '));
  }

  private appendFieldMessages(wrapper: HTMLElement, field: string, hint: string, id: string): void {
    if (hint) {
      const help = this.element('p', 'content-editor-hint', hint);
      help.id = `${id}-hint`;
      wrapper.appendChild(help);
    }
    const errors = this.fieldErrors(field);
    if (errors.length > 0) {
      const message = this.element('p', 'content-editor-field-error', errors.map((entry) => entry.message).join(' '));
      message.id = `${id}-error`;
      wrapper.appendChild(message);
    }
  }

  private fieldErrors(field: string): readonly EditorIssue[] {
    const base = field === 'damageMin' || field === 'damageMax' ? 'damage' : field;
    return this.errors.filter((error) => {
      const path = error.path.replace(/^registry\.(creatures|artifacts)\[\d+\]\./, '').replace(/^(creature|artifact)\./, '');
      return path === base || path.startsWith(`${base}.`) || path.startsWith(`${base}[`);
    });
  }

  private clearFieldErrors(): void {
    for (const element of this.root.querySelectorAll<HTMLElement>('[data-ui="form-errors"], .content-editor-field-error')) element.remove();
    for (const control of this.root.querySelectorAll<HTMLElement>('[aria-invalid="true"]')) control.setAttribute('aria-invalid', 'false');
    for (const control of this.root.querySelectorAll<HTMLElement>('[aria-describedby]')) {
      const descriptions = (control.getAttribute('aria-describedby') ?? '').split(' ')
        .filter((id) => id && !id.endsWith('-error'));
      if (descriptions.length > 0) control.setAttribute('aria-describedby', descriptions.join(' '));
      else control.removeAttribute('aria-describedby');
    }
  }

  private definitionList(entries: readonly (readonly [string, string])[]): HTMLElement {
    const list = this.element('dl', 'content-editor-definition-list');
    for (const [label, value] of entries) {
      const row = this.element('div');
      row.append(this.element('dt', '', label), this.element('dd', '', value));
      list.appendChild(row);
    }
    return list;
  }

  private newCreature(): CreatureDefinition {
    return {
      id: this.store.generateCreatureId('creature'),
      name: 'New creature',
      faction: 'Haven',
      tier: 1,
      attack: 3,
      defense: 3,
      damage: [1, 3],
      health: 10,
      speed: 5,
      shots: 0,
      cost: { gold: 100 },
      growth: 10,
      abilities: [],
    };
  }

  private newArtifact(): ArtifactDefinition {
    return {
      id: this.store.generateArtifactId('artifact'),
      name: 'New artifact',
      description: 'A custom artifact for a hero.',
      slot: 'weapon',
      rarity: 'common',
      bonuses: { attack: 1 },
    };
  }

  private isCreature(draft: ContentDraft): draft is CreatureDefinition {
    return 'health' in draft;
  }

  private option(value: string, label: string): HTMLOptionElement {
    const option = this.root.ownerDocument.createElement('option');
    option.value = value;
    option.textContent = label;
    return option;
  }

  private button(label: string, action: string, className = '', type = 'button'): HTMLButtonElement {
    const button = this.root.ownerDocument.createElement('button');
    button.type = type as 'button' | 'submit' | 'reset';
    button.dataset.action = action;
    button.className = className;
    button.textContent = label;
    return button;
  }

  private element<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text?: string): HTMLElementTagNameMap[K] {
    const element = this.root.ownerDocument.createElement(tag);
    element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  private query<T extends HTMLElement = HTMLElement>(name: string): T {
    const result = this.root.querySelector<T>(`[data-ui="${name}"]`);
    if (!result) throw new Error(`Content editor element is missing: ${name}`);
    return result;
  }

  private setStatus(message: string): void {
    this.query('status').textContent = message;
  }

  private focusField(field: string): void {
    this.root.querySelector<HTMLElement>(`[data-field="${field}"]`)?.focus();
  }

  private focusSavedEntry(id: string): void {
    const entry = this.root.querySelector<HTMLButtonElement>(`[data-action="select"][data-id="${id}"]`);
    if (entry) entry.focus();
    else this.focusField('name');
  }

  private displayNumber(value: number): string {
    return Number.isFinite(value) ? String(value) : 'Invalid number';
  }

  private capitalize(value: string): string {
    return value.length > 0 ? `${value[0]!.toUpperCase()}${value.slice(1)}` : value;
  }

  private statLabel(stat: string): string {
    return stat === 'spellPower' ? 'Spell power' : this.capitalize(stat);
  }

  private abilityLabel(ability: string): string {
    const labels: Record<string, string> = {
      ranged: 'Ranged',
      flying: 'Flying',
      retaliation: 'Retaliation',
      doubleStrike: 'Double strike',
      regeneration: 'Regeneration',
      spellResistance: 'Spell resistance',
    };
    return labels[ability] ?? ability;
  }
}
