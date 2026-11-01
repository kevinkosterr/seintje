import { animate, type MotionValue, motionValue } from "motion";
import type { MotionPreference } from "./types";

/* All movement in Seintje goes through motion's framework-agnostic animate(). */

type Transition = NonNullable<Parameters<typeof animate>[2]>;
type ElementKeyframes = Parameters<typeof animate>[1] & Record<string, unknown>;

/** Main spring for the shape and layout. */
export const SPRING = { type: "spring", visualDuration: 0.44, bounce: 0.24 } as const;
/** Spring without overshoot, used for closing so nothing pokes out of the pill. */
export const SPRING_FLAT = { type: "spring", visualDuration: 0.36, bounce: 0 } as const;
export const FADE_IN = { duration: 0.28, ease: [0.2, 0, 0, 1] } as const;
export const FADE_OUT = { duration: 0.16, ease: [0.4, 0, 1, 1] } as const;
export const INSTANT = { duration: 0 } as const;

interface Playback {
  stop(): void;
}

/**
 * A single number that is written to the DOM on every change and animated
 * with motion. Re-targeting a running spring keeps its velocity.
 */
export class Channel {
  readonly value: MotionValue<number>;
  private playback: Playback | undefined;
  private target: number;

  constructor(initial: number, write: (value: number) => void) {
    this.target = initial;
    this.value = motionValue(initial);
    this.value.on("change", write);
    write(initial);
  }

  get current(): number {
    return this.value.get();
  }

  to(target: number, transition: Transition): void {
    if (target === this.target && this.playback) return;
    this.target = target;
    this.playback?.stop();
    this.playback = undefined;
    if ("duration" in transition && transition.duration === 0) {
      this.value.set(target);
      return;
    }
    if (this.value.get() === target) return;
    this.playback = animate(this.value, target, transition as never);
  }

  /** Jumps to `value` without animating. */
  set(value: number): void {
    this.playback?.stop();
    this.playback = undefined;
    this.target = value;
    this.value.set(value);
  }

  destroy(): void {
    this.playback?.stop();
    this.value.destroy();
  }
}

/** Animates an element's style and transform values. */
export function animateElement(
  element: Element,
  keyframes: ElementKeyframes,
  transition: Transition,
): Playback & { finished: Promise<unknown> } {
  return animate(element, keyframes as never, transition as never);
}

const REDUCE_QUERY = "(prefers-reduced-motion: reduce)";

/**
 * Tracks whether motion should be reduced, combining the toaster option with
 * the user's system preference.
 */
export class MotionSettings {
  private query: MediaQueryList | undefined;
  private preference: MotionPreference;
  private readonly onChange: () => void;

  constructor(preference: MotionPreference, onChange: () => void = () => {}) {
    this.preference = preference;
    this.onChange = onChange;
    if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
      this.query = window.matchMedia(REDUCE_QUERY);
      this.query.addEventListener?.("change", this.onChange);
    }
  }

  setPreference(preference: MotionPreference): void {
    if (preference === this.preference) return;
    this.preference = preference;
    this.onChange();
  }

  get reduced(): boolean {
    if (this.preference === "reduce") return true;
    if (this.preference === "full") return false;
    return this.query?.matches ?? false;
  }

  /** The spring to use, or an instant jump when motion is reduced. */
  spring(flat = false): Transition {
    if (this.reduced) return INSTANT;
    return flat ? SPRING_FLAT : SPRING;
  }

  destroy(): void {
    this.query?.removeEventListener?.("change", this.onChange);
  }
}
