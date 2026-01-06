/**
 * Opacity animation system for smooth threshold-based transitions
 * 
 * When zoom crosses a threshold, instead of instantly showing/hiding,
 * the opacity animates smoothly over a short duration.
 */

// Animation duration in milliseconds
const FADE_DURATION_MS = 150

// Track animated opacity values by a unique key (e.g., "indexDots_circleId" or "directionRing_circleId")
interface AnimatedOpacity {
  current: number      // Current animated opacity (0 to 1)
  target: number       // Target opacity (0 or 1)
  startTime: number    // When animation started
  startValue: number   // Opacity value when animation started
}

const animatedOpacities = new Map<string, AnimatedOpacity>()

/**
 * Ease-out cubic for smooth deceleration
 */
function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3)
}

/**
 * Get the animated opacity for a given key and target value.
 * Call this every frame - it will smoothly animate towards the target.
 * 
 * @param key Unique identifier for this animated value
 * @param targetVisible Whether the element should be visible (true = 1, false = 0)
 * @returns Current animated opacity (0 to 1)
 */
export function getAnimatedOpacity(key: string, targetVisible: boolean): number {
  const target = targetVisible ? 1 : 0
  const now = performance.now()
  
  let state = animatedOpacities.get(key)
  
  if (!state) {
    // First time seeing this key - start at target (no animation)
    state = {
      current: target,
      target,
      startTime: now,
      startValue: target
    }
    animatedOpacities.set(key, state)
    return target
  }
  
  // Check if target changed
  if (state.target !== target) {
    // Target changed - start new animation from current position
    state.startValue = state.current
    state.startTime = now
    state.target = target
  }
  
  // Calculate animation progress
  const elapsed = now - state.startTime
  const progress = Math.min(1, elapsed / FADE_DURATION_MS)
  const easedProgress = easeOutCubic(progress)
  
  // Interpolate between start and target
  state.current = state.startValue + (state.target - state.startValue) * easedProgress
  
  return state.current
}

/**
 * Clean up animation state for elements that no longer exist
 * Call this periodically to prevent memory leaks
 */
export function cleanupAnimations(validKeys: Set<string>): void {
  for (const key of animatedOpacities.keys()) {
    if (!validKeys.has(key)) {
      animatedOpacities.delete(key)
    }
  }
}

/**
 * Check if any animations are currently in progress
 * Useful for triggering re-renders during animations
 */
export function hasActiveAnimations(): boolean {
  const now = performance.now()
  for (const state of animatedOpacities.values()) {
    if (state.current !== state.target) {
      const elapsed = now - state.startTime
      if (elapsed < FADE_DURATION_MS) {
        return true
      }
    }
  }
  return false
}

