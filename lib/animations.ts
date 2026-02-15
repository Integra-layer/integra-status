/**
 * Animation timing constants and utilities for Integra Status.
 *
 * All durations are in milliseconds. These values correspond to the
 * keyframe animations defined in app/globals.css and are consumed by
 * React components that need programmatic access to animation timing
 * (e.g. staggered entrance delays, counter roll-ups).
 */

export const ANIMATION = {
  /** Delay between successive card entrance animations */
  staggerDelay: 50,
  /** Maximum total stagger delay to avoid excessive wait */
  staggerMaxDelay: 1000,
  /** fade-slide-up card entrance duration */
  cardEntrance: 400,
  /** sparkline-draw stroke animation duration */
  sparklineDraw: 800,
  /** Counter roll-up transition duration */
  counterRollup: 600,
  /** gradient-shift header border cycle */
  headerGradient: 8000,
  /** pulse-green status dot cycle */
  pulseGreen: 2000,
  /** pulse-amber status dot cycle */
  pulseAmber: 1500,
  /** pulse-red status dot cycle */
  pulseRed: 1000,
  /** card-hover transform/shadow transition */
  hoverLift: 200,
  /** gradient-rotate active chip border cycle */
  chipRotation: 4000,
} as const;

/**
 * Returns the stagger delay for a given item index, capped at
 * `ANIMATION.staggerMaxDelay` to prevent excessive entrance times
 * when rendering large lists.
 */
export function getStaggerDelay(index: number): number {
  return Math.min(index * ANIMATION.staggerDelay, ANIMATION.staggerMaxDelay);
}
