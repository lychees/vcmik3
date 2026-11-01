import * as THREE from 'three';
import type { CreatureDefinition } from '../game/types';
import { createCustomCreatureModel, disposeCustomContentModel } from './models';

export interface CreatureModelPreviewOptions {
  readonly modelFactory?: (definition: CreatureDefinition) => THREE.Group;
}

export class CreatureModelPreview {
  private readonly container: HTMLElement;
  private readonly modelFactory: (definition: CreatureDefinition) => THREE.Group;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
  private readonly renderer: THREE.WebGLRenderer | null;
  private readonly resizeObserver: ResizeObserver | null;
  private model: THREE.Group | null = null;
  private disposed = false;

  constructor(container: HTMLElement, options: CreatureModelPreviewOptions = {}) {
    this.container = container;
    this.modelFactory = options.modelFactory ?? ((definition) => createCustomCreatureModel(definition));
    this.camera.position.set(3.2, 2.25, 4.5);
    this.camera.lookAt(0, 0.9, 0);
    this.scene.add(new THREE.HemisphereLight(0xdcecff, 0x263128, 2.2));
    const key = new THREE.DirectionalLight(0xffedcf, 3.1);
    key.position.set(3, 5, 4);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x91b8dd, 1.4);
    rim.position.set(-3, 2, -3);
    this.scene.add(rim);

    let renderer: THREE.WebGLRenderer | null = null;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio || 1, 2));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.domElement.setAttribute('role', 'img');
      renderer.domElement.setAttribute('aria-label', 'Live custom creature model preview');
      this.container.appendChild(renderer.domElement);
    } catch {
      const fallback = this.container.ownerDocument.createElement('p');
      fallback.className = 'content-editor-preview-fallback';
      fallback.textContent = 'The 3D preview is unavailable in this browser. Statistics and battle registration remain available.';
      this.container.appendChild(fallback);
    }
    this.renderer = renderer;
    this.resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => this.resize());
    this.resizeObserver?.observe(this.container);
    this.resize();
  }

  update(definition: CreatureDefinition): void {
    if (this.disposed) return;
    if (this.model) {
      this.scene.remove(this.model);
      disposeCustomContentModel(this.model);
    }
    this.model = this.modelFactory(definition);
    this.scene.add(this.model);
    if (this.renderer) {
      this.renderer.domElement.setAttribute(
        'aria-label',
        `${definition.name}, tier ${definition.tier} ${definition.faction} creature model`,
      );
    }
    this.render();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.resizeObserver?.disconnect();
    if (this.model) disposeCustomContentModel(this.model);
    this.model = null;
    this.renderer?.dispose();
    this.container.replaceChildren();
  }

  private resize(): void {
    if (!this.renderer || this.disposed) return;
    const width = Math.max(1, this.container.clientWidth || 320);
    const height = Math.max(1, this.container.clientHeight || 280);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
    this.render();
  }

  private render(): void {
    if (this.renderer && !this.disposed) this.renderer.render(this.scene, this.camera);
  }
}
