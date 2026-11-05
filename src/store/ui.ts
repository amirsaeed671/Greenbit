import { create } from 'zustand';
import { todayStr } from '../core/dates';
import type { Tier } from '../core/types';

export interface Celebration {
  id: number;
  tier: Exclude<Tier, 'none' | 'below'>;
  habitName: string;
  /** Overrides the default "Minimum met" style headline. */
  label?: string;
}

export interface Toast {
  msg: string;
  action?: { label: string; run: () => void };
}

interface UIState {
  today: string;
  refreshToday: () => void;
  calendarMonth: string; // YYYY-MM-01
  setCalendarMonth: (m: string) => void;
  calendarHabitId: string | null;
  setCalendarHabitId: (id: string | null) => void;
  celebration: Celebration | null;
  celebrate: (c: Omit<Celebration, 'id'>) => void;
  clearCelebration: () => void;
  toast: Toast | null;
  showToast: (msg: string, action?: Toast['action']) => void;
  quickAddOpen: boolean;
  setQuickAdd: (open: boolean) => void;
}

const firstOfMonth = (d: string) => `${d.slice(0, 7)}-01`;

export const useUI = create<UIState>((set, get) => ({
  today: todayStr(),
  refreshToday: () => {
    const t = todayStr();
    if (t !== get().today) set({ today: t });
  },
  calendarMonth: firstOfMonth(todayStr()),
  setCalendarMonth: (m) => set({ calendarMonth: firstOfMonth(m) }),
  calendarHabitId: null,
  setCalendarHabitId: (id) => set({ calendarHabitId: id }),
  celebration: null,
  celebrate: (c) => set({ celebration: { ...c, id: Date.now() } }),
  clearCelebration: () => set({ celebration: null }),
  toast: null,
  showToast: (msg, action) => {
    const t = { msg, action };
    set({ toast: t });
    window.setTimeout(() => get().toast === t && set({ toast: null }), action ? 5000 : 3200);
  },
  quickAddOpen: false,
  setQuickAdd: (open) => set({ quickAddOpen: open }),
}));
