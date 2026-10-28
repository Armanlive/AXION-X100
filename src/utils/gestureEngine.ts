/**
 * Local, deterministic air-gesture recognizer over 21-point hand landmarks
 * (MediaPipe Hand Landmarker layout, coordinates normalized to the frame).
 * Runs per frame on-device: no frames or landmarks leave the machine.
 *
 *  - Air-tap: quick pinch-and-release (thumb tip to index tip) → select/open
 *  - Pinch-hold + push/pull toward the camera → zoom in / zoom out
 *  - Fast open-hand sweep → swipe left / right / up / down
 */
export interface Landmark { x: number; y: number; z?: number }
export type Gesture =
  | {type: 'tap'}
  | {type: 'zoom'; direction: 'in' | 'out'}
  | {type: 'swipe'; direction: 'left' | 'right' | 'up' | 'down'};

const WRIST = 0, THUMB_TIP = 4, INDEX_TIP = 8, MIDDLE_MCP = 9;
const dist = (a: Landmark, b: Landmark) => Math.hypot(a.x - b.x, a.y - b.y);

export interface GestureOptions {
  /** Preview is shown mirrored, so the user's right is the frame's left. */
  mirrored?: boolean;
  pinchOn?: number; pinchOff?: number;
  tapMaxMs?: number; zoomStep?: number;
  swipeDistance?: number; swipeWindowMs?: number; cooldownMs?: number;
}

export class GestureEngine {
  private o: Required<GestureOptions>;
  private pinching = false;
  private pinchStart = 0;
  private zoomBase = 0;
  private zoomed = false;
  private trail: {x: number; y: number; t: number}[] = [];
  private quietUntil = 0;

  constructor(options: GestureOptions = {}) {
    this.o = {mirrored: true, pinchOn: 0.35, pinchOff: 0.5, tapMaxMs: 320, zoomStep: 0.18, swipeDistance: 0.22, swipeWindowMs: 420, cooldownMs: 650, ...options};
  }

  reset() { this.pinching = false; this.zoomed = false; this.trail = []; }

  /** Feed one frame; `hand` is null when no hand is visible. Returns at most one gesture. */
  update(hand: Landmark[] | null, now: number): Gesture | null {
    if (!hand || hand.length < 21) { this.reset(); return null; }
    const size = dist(hand[WRIST], hand[MIDDLE_MCP]);
    if (!(size > 0.02)) { this.reset(); return null; }
    const pinch = dist(hand[THUMB_TIP], hand[INDEX_TIP]) / size;

    // Hysteresis keeps a borderline pinch from flickering on and off.
    if (!this.pinching && pinch < this.o.pinchOn) {
      this.pinching = true; this.pinchStart = now; this.zoomBase = size; this.zoomed = false; this.trail = [];
      return null;
    }
    if (this.pinching) {
      if (pinch > this.o.pinchOff) {
        this.pinching = false;
        const tap = !this.zoomed && now - this.pinchStart <= this.o.tapMaxMs && now >= this.quietUntil;
        if (tap) { this.quietUntil = now + this.o.cooldownMs; return {type: 'tap'}; }
        return null;
      }
      // Hand grows when pulled toward the camera: that reads as "bring it closer" → zoom in.
      const ratio = size / this.zoomBase;
      if (ratio > 1 + this.o.zoomStep || ratio < 1 / (1 + this.o.zoomStep)) {
        this.zoomBase = size; this.zoomed = true;
        return {type: 'zoom', direction: ratio > 1 ? 'in' : 'out'};
      }
      return null;
    }

    // Open hand: swipe from wrist travel inside a short window.
    const wrist = hand[WRIST];
    this.trail.push({x: wrist.x, y: wrist.y, t: now});
    while (this.trail.length && now - this.trail[0].t > this.o.swipeWindowMs) this.trail.shift();
    if (now < this.quietUntil || this.trail.length < 3) return null;
    const first = this.trail[0];
    const dx = (wrist.x - first.x) * (this.o.mirrored ? -1 : 1), dy = wrist.y - first.y;
    const horizontal = Math.abs(dx) > this.o.swipeDistance && Math.abs(dx) > Math.abs(dy) * 1.6;
    const vertical = Math.abs(dy) > this.o.swipeDistance && Math.abs(dy) > Math.abs(dx) * 1.6;
    if (!horizontal && !vertical) return null;
    this.trail = []; this.quietUntil = now + this.o.cooldownMs;
    return {type: 'swipe', direction: horizontal ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up')};
  }
}

export interface GestureTargets {
  files: string[];
  cursor: number;
  zoom: number;
}
export type GestureAction =
  | {kind: 'focusFile'; index: number}
  | {kind: 'openFile'; path: string}
  | {kind: 'filePanel'; open: boolean}
  | {kind: 'zoom'; level: number}
  | {kind: 'none'; reason: string};

export const ZOOM_MIN = 0.8, ZOOM_MAX = 1.5;
/** Maps a gesture to a workspace action. Pure, so the bindings are testable without a camera. */
export function gestureAction(gesture: Gesture, t: GestureTargets): GestureAction {
  if (gesture.type === 'zoom') {
    const level = Math.round(Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, t.zoom + (gesture.direction === 'in' ? 0.1 : -0.1))) * 100) / 100;
    return level === t.zoom ? {kind: 'none', reason: `Zoom limit reached (${Math.round(level * 100)}%)`} : {kind: 'zoom', level};
  }
  if (gesture.type === 'swipe') {
    if (gesture.direction === 'up') return {kind: 'filePanel', open: true};
    if (gesture.direction === 'down') return {kind: 'filePanel', open: false};
    if (!t.files.length) return {kind: 'none', reason: 'No workspace files to move through'};
    const step = gesture.direction === 'right' ? 1 : -1;
    return {kind: 'focusFile', index: (t.cursor + step + t.files.length) % t.files.length};
  }
  const path = t.files[t.cursor];
  return path ? {kind: 'openFile', path} : {kind: 'none', reason: 'Swipe to pick a file first'};
}
