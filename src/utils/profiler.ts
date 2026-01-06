/**
 * Performance profiling utilities
 * 
 * Provides detailed timing breakdowns for operations to help identify bottlenecks.
 * Uses performance.now() for high-resolution timing.
 */

// ============================================================================
// TYPES
// ============================================================================

export interface ProfileMeasurement {
  name: string
  duration: number  // ms
  startTime: number
  endTime: number
  children: ProfileMeasurement[]
  metadata?: Record<string, unknown>
}

export interface ProfileSummary {
  name: string
  count: number
  totalDuration: number
  avgDuration: number
  minDuration: number
  maxDuration: number
  lastDuration: number
  childSummaries: Map<string, ProfileSummary>
}

export interface ProfilerConfig {
  enabled: boolean
  logToConsole: boolean
  logThresholdMs: number  // Only log if duration exceeds this
  trackHistory: boolean
  historySize: number
}

// ============================================================================
// STATE
// ============================================================================

let config: ProfilerConfig = {
  enabled: false,
  logToConsole: true,
  logThresholdMs: 1,  // Log anything over 1ms
  trackHistory: true,
  historySize: 100
}

// Stack for nested measurements
const measurementStack: ProfileMeasurement[] = []

// Summaries by operation name
const summaries = new Map<string, ProfileSummary>()

// Recent measurements for history view
const recentMeasurements: ProfileMeasurement[] = []

// Frame timing
let lastFrameTime = 0
let frameCount = 0
let frameTimes: number[] = []
const MAX_FRAME_SAMPLES = 60

// ============================================================================
// CONFIGURATION
// ============================================================================

export function configureProfiler(newConfig: Partial<ProfilerConfig>): void {
  config = { ...config, ...newConfig }
  
  if (config.enabled) {
    console.log(
      '%c⏱ Profiler enabled',
      'color: #00ff88; font-weight: bold;',
      config
    )
  }
}

export function enableProfiler(): void {
  configureProfiler({ enabled: true })
}

export function disableProfiler(): void {
  configureProfiler({ enabled: false })
}

export function isProfilerEnabled(): boolean {
  return config.enabled
}

// ============================================================================
// MEASUREMENT API
// ============================================================================

/**
 * Start a named measurement. Must call endMeasure with the same name.
 * Supports nesting - child measurements are tracked under their parent.
 */
export function startMeasure(name: string, metadata?: Record<string, unknown>): void {
  if (!config.enabled) return
  
  const measurement: ProfileMeasurement = {
    name,
    duration: 0,
    startTime: performance.now(),
    endTime: 0,
    children: [],
    metadata
  }
  
  // If there's a parent measurement, this becomes its child
  if (measurementStack.length > 0) {
    const parent = measurementStack[measurementStack.length - 1]
    parent.children.push(measurement)
  }
  
  measurementStack.push(measurement)
}

/**
 * End a named measurement and record the duration.
 */
export function endMeasure(name: string): number {
  if (!config.enabled) return 0
  
  const endTime = performance.now()
  
  // Find the measurement in the stack (should be on top)
  // Manual findLastIndex implementation for compatibility
  let idx = -1
  for (let i = measurementStack.length - 1; i >= 0; i--) {
    if (measurementStack[i].name === name) {
      idx = i
      break
    }
  }
  if (idx === -1) {
    console.warn(`Profiler: No matching startMeasure for "${name}"`)
    return 0
  }
  
  const measurement = measurementStack[idx]
  measurement.endTime = endTime
  measurement.duration = endTime - measurement.startTime
  
  // Remove from stack
  measurementStack.splice(idx, 1)
  
  // Update summary
  updateSummary(measurement)
  
  // If this is a top-level measurement, add to history
  if (idx === 0 && config.trackHistory) {
    recentMeasurements.push(measurement)
    if (recentMeasurements.length > config.historySize) {
      recentMeasurements.shift()
    }
  }
  
  // Log if above threshold and at top level
  if (config.logToConsole && idx === 0 && measurement.duration >= config.logThresholdMs) {
    logMeasurement(measurement)
  }
  
  return measurement.duration
}

/**
 * Measure a synchronous function execution.
 */
export function measure<T>(name: string, fn: () => T, metadata?: Record<string, unknown>): T {
  if (!config.enabled) return fn()
  
  startMeasure(name, metadata)
  try {
    return fn()
  } finally {
    endMeasure(name)
  }
}

/**
 * Measure an async function execution.
 */
export async function measureAsync<T>(
  name: string,
  fn: () => Promise<T>,
  metadata?: Record<string, unknown>
): Promise<T> {
  if (!config.enabled) return fn()
  
  startMeasure(name, metadata)
  try {
    return await fn()
  } finally {
    endMeasure(name)
  }
}

/**
 * Create a wrapped function that automatically measures each call.
 */
export function wrapWithProfiling<Args extends unknown[], R>(
  name: string,
  fn: (...args: Args) => R
): (...args: Args) => R {
  return (...args: Args): R => {
    return measure(name, () => fn(...args))
  }
}

// ============================================================================
// FRAME TIMING
// ============================================================================

/**
 * Call at the start of each frame to track FPS and frame time.
 */
export function markFrame(): void {
  if (!config.enabled) return
  
  const now = performance.now()
  if (lastFrameTime > 0) {
    const frameTime = now - lastFrameTime
    frameTimes.push(frameTime)
    if (frameTimes.length > MAX_FRAME_SAMPLES) {
      frameTimes.shift()
    }
  }
  lastFrameTime = now
  frameCount++
}

/**
 * Get current FPS estimate based on recent frames.
 */
export function getFPS(): number {
  if (frameTimes.length === 0) return 0
  const avgFrameTime = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length
  return avgFrameTime > 0 ? 1000 / avgFrameTime : 0
}

/**
 * Get average frame time in ms.
 */
export function getAvgFrameTime(): number {
  if (frameTimes.length === 0) return 0
  return frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length
}

// ============================================================================
// SUMMARY MANAGEMENT
// ============================================================================

function updateSummary(measurement: ProfileMeasurement): void {
  let summary = summaries.get(measurement.name)
  
  if (!summary) {
    summary = {
      name: measurement.name,
      count: 0,
      totalDuration: 0,
      avgDuration: 0,
      minDuration: Infinity,
      maxDuration: 0,
      lastDuration: 0,
      childSummaries: new Map()
    }
    summaries.set(measurement.name, summary)
  }
  
  summary.count++
  summary.totalDuration += measurement.duration
  summary.avgDuration = summary.totalDuration / summary.count
  summary.minDuration = Math.min(summary.minDuration, measurement.duration)
  summary.maxDuration = Math.max(summary.maxDuration, measurement.duration)
  summary.lastDuration = measurement.duration
  
  // Update child summaries
  for (const child of measurement.children) {
    let childSummary = summary.childSummaries.get(child.name)
    if (!childSummary) {
      childSummary = {
        name: child.name,
        count: 0,
        totalDuration: 0,
        avgDuration: 0,
        minDuration: Infinity,
        maxDuration: 0,
        lastDuration: 0,
        childSummaries: new Map()
      }
      summary.childSummaries.set(child.name, childSummary)
    }
    
    childSummary.count++
    childSummary.totalDuration += child.duration
    childSummary.avgDuration = childSummary.totalDuration / childSummary.count
    childSummary.minDuration = Math.min(childSummary.minDuration, child.duration)
    childSummary.maxDuration = Math.max(childSummary.maxDuration, child.duration)
    childSummary.lastDuration = child.duration
  }
}

// ============================================================================
// REPORTING
// ============================================================================

function logMeasurement(measurement: ProfileMeasurement): void {
  const color = measurement.duration > 16 ? '#ff6b6b' : 
                measurement.duration > 8 ? '#ffd93d' : '#6bcb77'
  
  const metaStr = measurement.metadata 
    ? ` (${Object.entries(measurement.metadata).map(([k, v]) => `${k}: ${v}`).join(', ')})`
    : ''
  
  console.groupCollapsed(
    `%c⏱ ${measurement.name}%c ${measurement.duration.toFixed(2)}ms${metaStr}`,
    `color: ${color}; font-weight: bold;`,
    `color: ${color};`
  )
  
  if (measurement.children.length > 0) {
    console.log('%cBreakdown:', 'color: #888; font-style: italic;')
    
    // Calculate self time (total minus children)
    const childrenTotal = measurement.children.reduce((sum, c) => sum + c.duration, 0)
    const selfTime = measurement.duration - childrenTotal
    
    // Create breakdown table
    const breakdown: Array<{ Phase: string; Time: string; '%': string }> = []
    
    for (const child of measurement.children) {
      const pct = (child.duration / measurement.duration * 100).toFixed(1)
      breakdown.push({
        Phase: child.name,
        Time: `${child.duration.toFixed(2)}ms`,
        '%': `${pct}%`
      })
    }
    
    if (selfTime > 0.01) {
      const selfPct = (selfTime / measurement.duration * 100).toFixed(1)
      breakdown.push({
        Phase: '(self)',
        Time: `${selfTime.toFixed(2)}ms`,
        '%': `${selfPct}%`
      })
    }
    
    console.table(breakdown)
  }
  
  console.groupEnd()
}

/**
 * Get all summaries for display.
 */
export function getSummaries(): Map<string, ProfileSummary> {
  return new Map(summaries)
}

/**
 * Get recent measurements.
 */
export function getRecentMeasurements(): ProfileMeasurement[] {
  return [...recentMeasurements]
}

/**
 * Print a summary report to console.
 */
export function printSummaryReport(): void {
  if (summaries.size === 0) {
    console.log('%cNo profiling data collected yet', 'color: #888;')
    return
  }
  
  console.group('%c📊 Profiler Summary Report', 'color: #00ff88; font-weight: bold; font-size: 14px;')
  
  // Frame stats
  console.log(
    `%cFrame Stats:%c ${getFPS().toFixed(1)} FPS, ${getAvgFrameTime().toFixed(2)}ms avg frame time`,
    'color: #888; font-weight: bold;',
    'color: #fff;'
  )
  
  // Sort by total duration
  const sortedSummaries = [...summaries.values()]
    .sort((a, b) => b.totalDuration - a.totalDuration)
  
  for (const summary of sortedSummaries) {
    const avgColor = summary.avgDuration > 16 ? '#ff6b6b' : 
                     summary.avgDuration > 8 ? '#ffd93d' : '#6bcb77'
    
    console.groupCollapsed(
      `%c${summary.name}%c - ${summary.count} calls, avg: ${summary.avgDuration.toFixed(2)}ms`,
      `color: ${avgColor}; font-weight: bold;`,
      'color: #888;'
    )
    
    console.table({
      'Total': `${summary.totalDuration.toFixed(2)}ms`,
      'Count': summary.count,
      'Average': `${summary.avgDuration.toFixed(2)}ms`,
      'Min': `${summary.minDuration.toFixed(2)}ms`,
      'Max': `${summary.maxDuration.toFixed(2)}ms`,
      'Last': `${summary.lastDuration.toFixed(2)}ms`
    })
    
    // Child breakdown
    if (summary.childSummaries.size > 0) {
      console.log('%cChild phases (avg):', 'color: #888; font-style: italic;')
      const childData: Record<string, string> = {}
      for (const [name, child] of summary.childSummaries) {
        const pct = (child.avgDuration / summary.avgDuration * 100).toFixed(1)
        childData[name] = `${child.avgDuration.toFixed(2)}ms (${pct}%)`
      }
      console.table(childData)
    }
    
    console.groupEnd()
  }
  
  console.groupEnd()
}

/**
 * Clear all profiling data.
 */
export function clearProfilingData(): void {
  summaries.clear()
  recentMeasurements.length = 0
  frameTimes.length = 0
  frameCount = 0
  lastFrameTime = 0
  measurementStack.length = 0
  
  console.log('%c⏱ Profiling data cleared', 'color: #888;')
}

// ============================================================================
// PERFORMANCE MARKS (for Chrome DevTools)
// ============================================================================

/**
 * Add a performance mark visible in Chrome DevTools Performance tab.
 */
export function mark(name: string): void {
  if (!config.enabled) return
  performance.mark(`serpentine:${name}`)
}

/**
 * Measure between two marks in Chrome DevTools.
 */
export function measureMarks(name: string, startMark: string, endMark: string): void {
  if (!config.enabled) return
  try {
    performance.measure(
      `serpentine:${name}`,
      `serpentine:${startMark}`,
      `serpentine:${endMark}`
    )
  } catch {
    // Marks might not exist
  }
}

// ============================================================================
// CONVENIENCE EXPORTS
// ============================================================================

/**
 * Quick one-off timing for debugging.
 */
export function time(label: string): () => number {
  const start = performance.now()
  return () => {
    const duration = performance.now() - start
    console.log(`%c⏱ ${label}: ${duration.toFixed(2)}ms`, 'color: #6bcb77;')
    return duration
  }
}

// Expose to window for console access
if (typeof window !== 'undefined') {
  (window as any).profiler = {
    enable: enableProfiler,
    disable: disableProfiler,
    config: configureProfiler,
    report: printSummaryReport,
    clear: clearProfilingData,
    getSummaries,
    getRecentMeasurements,
    getFPS,
    getAvgFrameTime
  }
}

