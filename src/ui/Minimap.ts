import { getTerrain } from '../game/content';
import { getObjectAt, getTile, toTileIndex } from '../game/map';
import type { GameState, MapObject, Point, ReachableTile } from '../game/types';
import { getFactionVisual } from './presentation';

function color(value: number): string {
  return `#${value.toString(16).padStart(6, '0')}`;
}

export class Minimap {
  private readonly canvas: HTMLCanvasElement;
  private readonly onNavigate: (point: Point) => void;
  private readonly resizeObserver: ResizeObserver | null;
  private state: Readonly<GameState> | null = null;
  private reachable = new Set<number>();
  private hovered: Point | null = null;
  private cursor: Point = { x: 0, y: 0 };
  private enabled = true;
  private disposed = false;

  constructor(canvas: HTMLCanvasElement, onNavigate: (point: Point) => void) {
    this.canvas = canvas;
    this.onNavigate = onNavigate;
    canvas.addEventListener('pointerdown', this.handlePointerDown);
    canvas.addEventListener('pointermove', this.handlePointerMove);
    canvas.addEventListener('pointerleave', this.handlePointerLeave);
    canvas.addEventListener('keydown', this.handleKeyDown);
    this.resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(this.draw);
    this.resizeObserver?.observe(canvas);
  }

  render(state: Readonly<GameState>, reachable: readonly ReachableTile[] = []): void {
    this.state = state;
    this.reachable = new Set(reachable.map((tile) => tile.tileIndex));
    const selected = state.selectedHeroId ? state.heroes[state.selectedHeroId] : undefined;
    if (selected && !this.hovered) this.cursor = { ...selected.position };
    this.draw();
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.canvas.setAttribute('aria-disabled', String(!enabled));
    this.canvas.tabIndex = enabled ? 0 : -1;
  }

  private pointFromEvent(event: PointerEvent): Point | null {
    if (!this.state) return null;
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    return {
      x: Math.max(0, Math.min(this.state.map.width - 1, Math.floor((event.clientX - rect.left) / rect.width * this.state.map.width))),
      y: Math.max(0, Math.min(this.state.map.height - 1, Math.floor((event.clientY - rect.top) / rect.height * this.state.map.height))),
    };
  }

  private readonly handlePointerDown = (event: PointerEvent): void => {
    if (!this.enabled || event.button !== 0) return;
    const point = this.pointFromEvent(event);
    if (!point) return;
    event.preventDefault();
    this.cursor = { ...point };
    this.draw();
    this.onNavigate(point);
  };

  private readonly handlePointerMove = (event: PointerEvent): void => {
    if (!this.state) return;
    const point = this.pointFromEvent(event);
    if (!point || (this.hovered?.x === point.x && this.hovered.y === point.y)) return;
    this.hovered = point;
    this.canvas.title = this.describePoint(point);
    this.draw();
  };

  private readonly handlePointerLeave = (): void => {
    this.hovered = null;
    this.canvas.title = 'Strategic overview of Aster Vale';
    this.draw();
  };

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (!this.enabled || !this.state) return;
    const delta = event.key === 'ArrowLeft' ? { x: -1, y: 0 }
      : event.key === 'ArrowRight' ? { x: 1, y: 0 }
        : event.key === 'ArrowUp' ? { x: 0, y: -1 }
          : event.key === 'ArrowDown' ? { x: 0, y: 1 }
            : null;
    if (delta) {
      event.preventDefault();
      event.stopPropagation();
      this.cursor = {
        x: Math.max(0, Math.min(this.state.map.width - 1, this.cursor.x + delta.x)),
        y: Math.max(0, Math.min(this.state.map.height - 1, this.cursor.y + delta.y)),
      };
      this.canvas.title = this.describePoint(this.cursor);
      this.draw();
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      event.stopPropagation();
      this.onNavigate({ ...this.cursor });
    }
  };

  private describePoint(point: Point): string {
    if (!this.state) return '';
    const fog = this.state.fog[this.state.activePlayerId];
    const index = toTileIndex(this.state.map, point);
    if (!fog?.explored.includes(index)) return `Unexplored territory · ${point.x + 1}, ${point.y + 1}`;
    const tile = getTile(this.state.map, point);
    const object = getObjectAt(this.state.map, point);
    const terrain = tile ? getTerrain(tile.terrain).name : 'Unknown';
    const visible = fog.visible.includes(index);
    const town = object?.kind === 'town' ? this.state.towns[object.townId] : undefined;
    const owner = town ? this.state.players[town.ownerId]?.name ?? town.ownerId : null;
    const objectName = town ? `${town.name} · ${town.faction} · ${owner}` : object?.name;
    return `${objectName && visible ? `${objectName} · ` : ''}${terrain}${tile?.road ? ' road' : ''} · ${point.x + 1}, ${point.y + 1}`;
  }

  private drawObject(context: CanvasRenderingContext2D, object: MapObject, x: number, y: number, size: number): void {
    if (!this.state) return;
    const centerX = x + size / 2;
    const centerY = y + size / 2;
    const ownerId = object.kind === 'town' ? this.state.towns[object.townId]?.ownerId
      : object.kind === 'mine' ? object.ownerId : null;
    const ownerColor = ownerId ? this.state.players[ownerId]?.color ?? '#e5cf8b' : '#e5cf8b';
    const town = object.kind === 'town' ? this.state.towns[object.townId] : undefined;
    context.strokeStyle = object.kind === 'town' ? ownerColor : '#101c18';
    context.lineWidth = Math.max(1, size * (object.kind === 'town' ? 0.16 : 0.1));
    context.fillStyle = town ? getFactionVisual(town.faction).primary : ownerColor;
    context.beginPath();
    if (object.kind === 'town') {
      context.rect(x + size * 0.15, y + size * 0.15, size * 0.7, size * 0.7);
    } else if (object.kind === 'mine' || object.kind === 'resource') {
      context.moveTo(centerX, y + size * 0.12);
      context.lineTo(x + size * 0.88, centerY);
      context.lineTo(centerX, y + size * 0.88);
      context.lineTo(x + size * 0.12, centerY);
      context.closePath();
    } else if (object.kind === 'monster') {
      context.fillStyle = '#d16d5d';
      context.moveTo(centerX, y + size * 0.12);
      context.lineTo(x + size * 0.88, y + size * 0.84);
      context.lineTo(x + size * 0.12, y + size * 0.84);
      context.closePath();
    } else {
      context.fillStyle = '#b8d799';
      context.arc(centerX, centerY, size * 0.3, 0, Math.PI * 2);
    }
    context.fill();
    context.stroke();
  }

  private readonly draw = (): void => {
    if (this.disposed || !this.state) return;
    const state = this.state;
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const ratio = Math.min(2, globalThis.devicePixelRatio || 1);
    const width = Math.max(1, Math.round(rect.width * ratio));
    const height = Math.max(1, Math.round(rect.height * ratio));
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
    const context = this.canvas.getContext('2d');
    if (!context) return;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    const tileWidth = rect.width / state.map.width;
    const tileHeight = rect.height / state.map.height;
    const fog = state.fog[state.activePlayerId];
    const explored = new Set(fog?.explored ?? []);
    const visible = new Set(fog?.visible ?? []);

    context.fillStyle = '#07120f';
    context.fillRect(0, 0, rect.width, rect.height);
    for (const tile of state.map.tiles) {
      const index = toTileIndex(state.map, tile);
      if (!explored.has(index)) continue;
      const x = tile.x * tileWidth;
      const y = tile.y * tileHeight;
      context.fillStyle = color(getTerrain(tile.terrain).color);
      context.fillRect(x, y, Math.ceil(tileWidth + 0.25), Math.ceil(tileHeight + 0.25));
      if (tile.road) {
        context.fillStyle = '#b49a69';
        context.fillRect(x, y + tileHeight * 0.4, tileWidth, Math.max(1, tileHeight * 0.2));
        context.fillRect(x + tileWidth * 0.4, y, Math.max(1, tileWidth * 0.2), tileHeight);
      }
      if (this.reachable.has(index) && visible.has(index)) {
        context.fillStyle = 'rgba(229, 218, 137, .18)';
        context.fillRect(x, y, tileWidth, tileHeight);
      }
      if (!visible.has(index)) {
        context.fillStyle = 'rgba(4, 13, 12, .58)';
        context.fillRect(x, y, tileWidth + 0.25, tileHeight + 0.25);
      }
      if (!tile.objectId) continue;
      const object = state.map.objects[tile.objectId];
      if (object && (visible.has(index) || object.kind === 'town')) {
        const size = Math.max(object.kind === 'town' ? 5 : 3, Math.min(tileWidth, tileHeight));
        this.drawObject(context, object, x + (tileWidth - size) / 2, y + (tileHeight - size) / 2, size);
      }
    }

    for (const hero of Object.values(state.heroes)) {
      if (!hero.alive) continue;
      const index = toTileIndex(state.map, hero.position);
      if (hero.ownerId !== state.activePlayerId && !visible.has(index)) continue;
      const x = (hero.position.x + 0.5) * tileWidth;
      const y = (hero.position.y + 0.5) * tileHeight;
      context.beginPath();
      context.arc(x, y, Math.max(2.5, Math.min(tileWidth, tileHeight) * 0.43), 0, Math.PI * 2);
      context.fillStyle = state.players[hero.ownerId]?.color ?? '#ffffff';
      context.fill();
      context.strokeStyle = state.selectedHeroId === hero.id ? '#fff3ad' : '#122019';
      context.lineWidth = state.selectedHeroId === hero.id ? 2 : 1;
      context.stroke();
    }

    const marker = this.hovered ?? this.cursor;
    if (marker) {
      context.strokeStyle = this.hovered ? '#fff4ba' : 'rgba(255, 244, 186, .65)';
      context.lineWidth = 1;
      context.strokeRect(
        marker.x * tileWidth + 0.5,
        marker.y * tileHeight + 0.5,
        Math.max(1, tileWidth - 1),
        Math.max(1, tileHeight - 1),
      );
    }
  };

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.resizeObserver?.disconnect();
    this.canvas.removeEventListener('pointerdown', this.handlePointerDown);
    this.canvas.removeEventListener('pointermove', this.handlePointerMove);
    this.canvas.removeEventListener('pointerleave', this.handlePointerLeave);
    this.canvas.removeEventListener('keydown', this.handleKeyDown);
    this.state = null;
  }
}
