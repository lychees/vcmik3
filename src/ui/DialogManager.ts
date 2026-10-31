import { escapeHtml } from './format';
import { icon } from './icons';

export interface DialogAction {
  label: string;
  icon?: 'check' | 'close' | 'save' | 'spark';
  className?: string;
  ariaLabel?: string;
  close?: boolean;
  autofocus?: boolean;
  onSelect?: () => void;
}

export interface DialogRequest {
  title: string;
  eyebrow?: string;
  body: string | HTMLElement;
  actions?: DialogAction[];
  className?: string;
  dismissible?: boolean;
  onClose?: () => void;
}

let nextDialogId = 1;

export class DialogManager {
  readonly element: HTMLDialogElement;
  private readonly queue: DialogRequest[] = [];
  private active: DialogRequest | null = null;
  private readonly titleId = `h3-dialog-title-${nextDialogId++}`;
  private disposed = false;

  constructor(parent: HTMLElement) {
    this.element = document.createElement('dialog');
    this.element.className = 'h3-dialog';
    this.element.setAttribute('aria-labelledby', this.titleId);
    this.element.addEventListener('close', this.handleClose);
    this.element.addEventListener('cancel', this.handleCancel);
    this.element.addEventListener('pointerdown', this.handlePointerDown);
    parent.appendChild(this.element);
  }

  get isOpen(): boolean {
    return this.element.open;
  }

  show(request: DialogRequest): void {
    if (this.disposed) return;
    this.queue.push(request);
    this.presentNext();
  }

  private presentNext(): void {
    if (this.disposed || this.active || this.element.open) return;
    const request = this.queue.shift();
    if (!request) return;
    this.active = request;
    const dismissible = request.dismissible !== false;
    this.element.className = `h3-dialog ${request.className ?? ''}`.trim();
    this.element.innerHTML = `
      <div class="h3-dialog-frame">
        <header class="h3-dialog-header">
          <div>${request.eyebrow ? `<p class="h3-eyebrow">${escapeHtml(request.eyebrow)}</p>` : ''}<h2 id="${this.titleId}">${escapeHtml(request.title)}</h2></div>
          ${dismissible ? `<button type="button" class="h3-icon-button" data-dialog-close aria-label="Close dialog" title="Close (Escape)">${icon('close')}</button>` : ''}
        </header>
        <div class="h3-dialog-body"></div>
        <footer class="h3-dialog-actions"></footer>
      </div>`;
    const body = this.element.querySelector<HTMLElement>('.h3-dialog-body');
    if (body) {
      if (typeof request.body === 'string') body.innerHTML = request.body;
      else body.appendChild(request.body);
    }
    this.element.querySelector('[data-dialog-close]')?.addEventListener('click', () => this.close());
    const actions = request.actions?.length ? request.actions : [{ label: 'Close', close: true }];
    const footer = this.element.querySelector<HTMLElement>('.h3-dialog-actions');
    for (const action of actions) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `h3-button ${action.className ?? ''}`.trim();
      if (action.ariaLabel) button.setAttribute('aria-label', action.ariaLabel);
      if (action.autofocus) button.autofocus = true;
      button.innerHTML = `${action.icon ? icon(action.icon) : ''}<span>${escapeHtml(action.label)}</span>`;
      button.addEventListener('click', () => {
        if (action.close !== false) this.close();
        action.onSelect?.();
      });
      footer?.appendChild(button);
    }
    if (!footer?.hasChildNodes()) footer?.remove();
    this.element.showModal();
  }

  private finishActive(): void {
    const request = this.active;
    if (!request) return;
    this.active = null;
    request.onClose?.();
    queueMicrotask(() => this.presentNext());
  }

  private readonly handleClose = (): void => {
    if (!this.element.open) this.finishActive();
  };

  private readonly handleCancel = (event: Event): void => {
    event.preventDefault();
    if (this.active?.dismissible !== false) this.close();
  };

  private readonly handlePointerDown = (event: PointerEvent): void => {
    if (event.target !== this.element || this.active?.dismissible === false) return;
    const bounds = this.element.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) {
      this.close();
    }
  };

  close(): void {
    if (!this.element.open) return;
    this.element.close();
    this.finishActive();
  }

  clear(): void {
    this.queue.length = 0;
    this.close();
  }

  dispose(): void {
    if (this.disposed) return;
    this.clear();
    this.disposed = true;
    this.element.removeEventListener('close', this.handleClose);
    this.element.removeEventListener('cancel', this.handleCancel);
    this.element.removeEventListener('pointerdown', this.handlePointerDown);
    this.element.remove();
  }
}
