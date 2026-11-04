import { create } from 'zustand';
import { todayStr } from '../core/dates';
import type { Tier } from '../core/types';

export interface Celebration {
  id: number;
  tier: Exclude<Tier, 'none' | 'below'>;
  habitName: string;
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
  toast: string | null;
  showToast: (msg: string) => void;
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
  showToast: (msg) => {
    set({ toast: msg });
    window.setTimeout(() => get().toast === msg && set({ toast: null }), 3200);
  },
}));
