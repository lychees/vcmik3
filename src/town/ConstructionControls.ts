import { CONSTRUCTION_SPEEDS, type ConstructionSpeed, type ConstructionStatus } from './construction';

interface ConstructionControlHandlers {
  playPause(): void;
  scrub(time: number): void;
  speed(speed: ConstructionSpeed): void;
  previous(): void;
  next(): void;
}

function button(label: string, ariaLabel: string): HTMLButtonElement {
  const result = document.createElement('button');
  result.type = 'button';
  result.textContent = label;
  result.setAttribute('aria-label', ariaLabel);
  result.title = ariaLabel;
  return result;
}

export class ConstructionControls {
  readonly root: HTMLElement;
  private readonly abort = new AbortController();
  private readonly title: HTMLElement;
  private readonly stage: HTMLSpanElement;
  private readonly play: HTMLButtonElement;
  private readonly previous: HTMLButtonElement;
  private readonly next: HTMLButtonElement;
  private readonly progress: HTMLInputElement;
  private readonly component: HTMLSpanElement;
  private readonly speeds = new Map<ConstructionSpeed, HTMLButtonElement>();
  private lastStage = '';
  private duration = 0;

  constructor(parent: HTMLElement, handlers: ConstructionControlHandlers) {
    this.root = document.createElement('section');
    this.root.className = 'h3-town-scene__construction-controls';
    this.root.setAttribute('aria-label', 'Construction animation controls');
    this.root.hidden = true;

    const heading = document.createElement('div');
    heading.className = 'h3-town-scene__construction-heading';
    this.title = document.createElement('strong');
    this.stage = document.createElement('span');
    this.stage.setAttribute('aria-live', 'polite');
    this.stage.setAttribute('aria-atomic', 'true');
    heading.append(this.title, this.stage);

    const transport = document.createElement('div');
    transport.className = 'h3-town-scene__construction-transport';
    this.previous = button('←', 'Previous construction stage');
    this.play = button('Pause', 'Pause construction animation');
    this.next = button('→', 'Next construction stage');
    transport.append(this.previous, this.play, this.next);

    const progressLabel = document.createElement('label');
    progressLabel.className = 'h3-town-scene__construction-progress';
    const progressText = document.createElement('span');
    progressText.textContent = 'Progress';
    this.progress = document.createElement('input');
    this.progress.type = 'range';
    this.progress.min = '0';
    this.progress.step = '0.01';
    this.progress.setAttribute('aria-label', 'Construction progress');
    progressLabel.append(progressText, this.progress);

    const speedGroup = document.createElement('div');
    speedGroup.className = 'h3-town-scene__construction-speeds';
    speedGroup.setAttribute('role', 'group');
    speedGroup.setAttribute('aria-label', 'Construction playback speed');
    for (const speed of CONSTRUCTION_SPEEDS) {
      const speedButton = button(`${speed}×`, `Play construction at ${speed} times speed`);
      speedButton.dataset.speed = String(speed);
      speedButton.setAttribute('aria-pressed', String(speed === 1));
      speedGroup.appendChild(speedButton);
      this.speeds.set(speed, speedButton);
    }

    this.component = document.createElement('span');
    this.component.className = 'h3-town-scene__construction-component';
    this.root.append(heading, transport, progressLabel, speedGroup, this.component);
    parent.appendChild(this.root);

    const signal = this.abort.signal;
    this.play.addEventListener('click', handlers.playPause, { signal });
    this.previous.addEventListener('click', handlers.previous, { signal });
    this.next.addEventListener('click', handlers.next, { signal });
    this.progress.addEventListener('input', () => {
      const time = Number(this.progress.value);
      handlers.scrub(time >= Number(this.progress.max) ? this.duration : time);
    }, { signal });
    for (const [speed, speedButton] of this.speeds) {
      speedButton.addEventListener('click', () => handlers.speed(speed), { signal });
    }
  }

  update(status: ConstructionStatus): void {
    this.duration = status.duration;
    this.root.hidden = false;
    this.root.dataset.buildingId = status.buildingId;
    this.root.dataset.stage = status.stageId;
    this.root.dataset.playing = String(status.playing);
    this.root.dataset.completed = String(status.completed);
    this.root.dataset.reducedMotion = String(status.reducedMotion);
    this.title.textContent = status.buildingName;
    const stageText = status.completed
      ? `Complete · ${status.stageIndex + 1}/8 ${status.stageLabel}`
      : `${status.stageIndex + 1}/8 · ${status.stageLabel}`;
    if (stageText !== this.lastStage) {
      this.stage.textContent = stageText;
      this.lastStage = stageText;
    }
    this.play.textContent = status.playing ? 'Pause' : status.completed ? 'Replay' : 'Play';
    const playLabel = status.playing ? 'Pause construction animation' : status.completed ? 'Replay construction animation' : 'Play construction animation';
    this.play.setAttribute('aria-label', playLabel);
    this.play.title = playLabel;
    this.previous.disabled = status.stageIndex === 0;
    this.next.disabled = status.stageIndex === 7;
    this.progress.max = status.duration.toFixed(3);
    this.progress.value = status.time.toFixed(3);
    this.progress.setAttribute('aria-valuetext', `${status.stageLabel}, ${status.time.toFixed(1)} of ${status.duration.toFixed(1)} seconds`);
    for (const [speed, speedButton] of this.speeds) speedButton.setAttribute('aria-pressed', String(speed === status.speed));
    this.component.textContent = status.component
      ? `Highlight: ${status.component.label} · ${status.component.geometryType.replace(/Geometry$/, '')}`
      : 'All components in place';
    this.component.title = status.component?.id ?? '';
  }

  hide(): void {
    this.root.hidden = true;
    delete this.root.dataset.buildingId;
    delete this.root.dataset.stage;
    delete this.root.dataset.playing;
    delete this.root.dataset.completed;
    this.lastStage = '';
  }

  dispose(): void {
    this.abort.abort();
    this.root.remove();
  }
}
