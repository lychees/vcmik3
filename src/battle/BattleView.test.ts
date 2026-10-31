import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BattleResult } from '../game/types';
import { BattleView } from './BattleView';
import type { BattleStackState } from './types';

interface TimingView {
  disposed: boolean;
  busy: boolean;
  auto: boolean;
  aiTimer: ReturnType<typeof setTimeout> | null;
  selectedSpell: string | null;
  spellbookOpen: boolean;
  engine: {
    getResult: () => BattleResult | null;
    getActiveStack: () => BattleStackState | null;
  };
  refresh: ReturnType<typeof vi.fn>;
  perform: ReturnType<typeof vi.fn>;
  handleAction: (action: string) => void;
  scheduleAi: () => void;
}

function createTimingView(): { view: TimingView; active: BattleStackState } {
  const active = { id: 'attacker:0', side: 'attacker' } as BattleStackState;
  const view = Object.create(BattleView.prototype) as unknown as TimingView;
  Object.assign(view, {
    disposed: false,
    busy: false,
    auto: false,
    aiTimer: null,
    selectedSpell: null,
    spellbookOpen: false,
    engine: {
      getResult: () => null,
      getActiveStack: () => active,
    },
    refresh: vi.fn(),
    perform: vi.fn(),
  });
  return { view, active };
}

describe('BattleView AI scheduling', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('cancels a queued attacker action when Auto is toggled off', () => {
    const { view } = createTimingView();
    view.handleAction('auto');
    expect(view.auto).toBe(true);
    expect(view.aiTimer).not.toBeNull();

    view.handleAction('auto');
    expect(view.auto).toBe(false);
    expect(view.aiTimer).toBeNull();
    vi.advanceTimersByTime(1000);
    expect(view.perform).not.toHaveBeenCalled();
  });

  it('clears pending actions before busy or disposed scheduling early returns', () => {
    const { view } = createTimingView();
    view.auto = true;
    view.scheduleAi();
    view.busy = true;
    view.scheduleAi();
    expect(view.aiTimer).toBeNull();

    view.busy = false;
    view.scheduleAi();
    expect(view.aiTimer).not.toBeNull();
    view.disposed = true;
    view.scheduleAi();
    expect(view.aiTimer).toBeNull();
    vi.advanceTimersByTime(1000);
    expect(view.perform).not.toHaveBeenCalled();
  });

  it('revalidates Auto eligibility when a delayed callback fires', () => {
    const { view } = createTimingView();
    view.auto = true;
    view.scheduleAi();
    view.auto = false;
    vi.advanceTimersByTime(180);
    expect(view.aiTimer).toBeNull();
    expect(view.perform).not.toHaveBeenCalled();
  });

  it('preserves the normal defender AI delay and action', () => {
    const { view, active } = createTimingView();
    active.side = 'defender';
    view.scheduleAi();
    expect(view.aiTimer).not.toBeNull();
    vi.advanceTimersByTime(479);
    expect(view.perform).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(view.perform).toHaveBeenCalledTimes(1);
    expect(view.aiTimer).toBeNull();
  });
});
