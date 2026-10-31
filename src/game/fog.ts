import { isInsideMap, toTileIndex } from './map';
import type { GameState, Point } from './types';

export function updateFog(state: GameState, playerId: string): void {
  if (!Object.hasOwn(state.fog, playerId)) return;
  const fog = state.fog[playerId];
  if (!fog) return;
  const visible = new Set<number>();
  const reveal = (position: Point, radius: number): void => {
    for (let y = position.y - radius; y <= position.y + radius; y += 1) {
      for (let x = position.x - radius; x <= position.x + radius; x += 1) {
        const point = { x, y };
        if (isInsideMap(state.map, point) && Math.hypot(position.x - x, position.y - y) <= radius) {
          visible.add(toTileIndex(state.map, point));
        }
      }
    }
  };
  for (const hero of Object.values(state.heroes)) {
    if (hero.ownerId === playerId && hero.alive) reveal(hero.position, 5);
  }
  for (const town of Object.values(state.towns)) {
    if (town.ownerId === playerId) reveal(town.position, 4);
  }
  fog.visible = [...visible].sort((a, b) => a - b);
  fog.explored = [...new Set([...fog.explored, ...fog.visible])].sort((a, b) => a - b);
}

export function updateAllFog(state: GameState): void {
  for (const playerId of state.playerOrder) updateFog(state, playerId);
}

export function isTileVisible(state: GameState, playerId: string, position: Point): boolean {
  return isInsideMap(state.map, position) && Object.hasOwn(state.fog, playerId) &&
    Boolean(state.fog[playerId]?.visible.includes(toTileIndex(state.map, position)));
}

export function isTileExplored(state: GameState, playerId: string, position: Point): boolean {
  return isInsideMap(state.map, position) && Object.hasOwn(state.fog, playerId) &&
    Boolean(state.fog[playerId]?.explored.includes(toTileIndex(state.map, position)));
}
