import { create } from 'zustand';

/**
 * First-run state: the guided tour to Cloud Brain, and "Meet AXION" (the spoken
 * introduction once a brain is connected). Both are remembered so they show once.
 */
const TOUR_KEY = 'axion.tour.v1';
const MEET_KEY = 'axion.meet.v1';
const read = (key: string) => { try { return globalThis.localStorage?.getItem(key) ?? ''; } catch { return ''; } };
const write = (key: string, value: string) => { try { globalThis.localStorage?.setItem(key, value); } catch { /* session only */ } };

interface OnboardingState {
  /** 'done' once finished or skipped. */
  tour: string;
  tourStep: number;
  /** 'done' after the interview, 'later' if the user said not now. */
  meet: string;
  meetOpen: boolean;
  nextTourStep: () => void;
  finishTour: () => void;
  openMeet: () => void;
  closeMeet: (outcome: 'done' | 'later' | 'cancel') => void;
}

export const useOnboardingStore = create<OnboardingState>((set, get) => ({
  tour: read(TOUR_KEY),
  tourStep: 0,
  meet: read(MEET_KEY),
  meetOpen: false,
  nextTourStep: () => set({ tourStep: get().tourStep + 1 }),
  finishTour: () => { write(TOUR_KEY, 'done'); set({ tour: 'done' }); },
  openMeet: () => set({ meetOpen: true }),
  closeMeet: (outcome) => {
    if (outcome !== 'cancel') { write(MEET_KEY, outcome); set({ meet: outcome }); }
    set({ meetOpen: false });
  },
}));
