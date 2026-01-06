/**
 * Centralized constants for the application
 * All magic numbers and configuration values should be defined here
 */

// ============================================================================
// VIEWPORT & ZOOM
// ============================================================================

export const DEFAULT_ZOOM = 1
export const MIN_ZOOM = 0.1
export const MAX_ZOOM = 5
export const FIT_TO_RECT_PADDING_RATIO = 0.25

// ============================================================================
// GRID
// ============================================================================

export const DEFAULT_GRID_SIZE = 10
export const MIN_GRID_SIZE = 10
export const MAX_GRID_SIZE = 100

// Grid rendering
export const GRID_LEVEL_MULTIPLIER = 5
export const GRID_MIN_SCREEN_SPACING = 6      // Below this, dots are too dense
export const GRID_IDEAL_SCREEN_SPACING = 30   // Optimal spacing for visibility
export const GRID_DOT_RADIUS_SCREEN = 1.2     // Dot size in screen pixels

// ============================================================================
// SNAPPING
// ============================================================================

export const POSITION_SNAP_INCREMENT = 10
export const SMART_GUIDE_SNAP_THRESHOLD = 8  // Screen pixels for smart guide alignment
export const RADIUS_SNAP_INCREMENT = 10
export const OFFSET_SNAP_THRESHOLD = 0.05     // Snap offset to 0 when below this
export const OFFSET_SNAP_INCREMENT = Math.PI / 36  // 5 degrees in radians
export const LENGTH_SNAP_INCREMENT = 0.05     // 5% increment for tangent length
export const LENGTH_SNAP_THRESHOLD = 0.1      // Snap length to 1.0 when within this

// ============================================================================
// CIRCLE DEFAULTS
// ============================================================================

export const DEFAULT_CIRCLE_RADIUS = 50
export const MIN_CIRCLE_RADIUS = 5
export const DUPLICATE_OFFSET = { x: 20, y: 20 }

// Non-overlapping radius calculation
export const NON_OVERLAP_MIN_RADIUS = 40
export const NON_OVERLAP_MAX_RADIUS = 120
export const CIRCLE_GAP = 2                   // Gap between circles when auto-sizing

// ============================================================================
// INTERACTION ZONES (as fraction of circle radius)
// ============================================================================

// Zone layout from outside to inside:
// - EDGE_OUTER to EDGE_INNER: Scale zone (drag to resize)
// - DIRECTION_RING_OUTER to DIRECTION_RING_INNER: Direction zone (click to toggle)
// - 0 to DIRECTION_RING_INNER: Body zone (click to move)

export const EDGE_OUTER = 1.08               // Outer boundary of edge/scale zone
export const EDGE_INNER = 0.92               // Inner boundary of edge/scale zone
export const DIRECTION_RING_OUTER = 0.92     // Outer boundary of direction zone
export const DIRECTION_RING_INNER = 0.70     // Inner boundary of direction zone
export const DIRECTION_RING_RADIUS = 0.81    // Where the chevrons are drawn

// ============================================================================
// INDEX DOT GRID
// ============================================================================

export const DOT_SIZE = 7                    // Diameter of each dot
export const DOT_SPACING = 10                // Center-to-center spacing
export const DOT_GRID_Y_OFFSET = 0           // Vertical offset from center (0 = centered)
export const MAX_DOT_COLS = 4                // Maximum dots per row

// ============================================================================
// UI ELEMENT VISIBILITY (fade out when zoomed out)
// ============================================================================

// Elements fade at a threshold with a time-based animation (150ms)
// The threshold is when screen size of element exceeds this fraction of circle diameter

// Index dots fade out earlier (more sensitive to zoom)
export const INDEX_DOT_FADE_THRESHOLD = 0.20  // Threshold at 20% of circle size

// Direction ring fades out later (less sensitive) - stays visible longer
export const DIRECTION_RING_FADE_THRESHOLD = 0.50  // Threshold at 50% of circle size

// The direction ring spans a large visual area (many chevrons around the circle)
// This multiplier accounts for the visual density of the ring
export const DIRECTION_RING_SIZE_MULTIPLIER = 3

// Minimum circle diameter in screen pixels to allow scaling interaction
// Below this size, the edge zone becomes too small to reliably click
export const MIN_SCALE_SCREEN_DIAMETER = 40  // pixels

// ============================================================================
// DIRECTION RING CHEVRONS
// ============================================================================

export const CHEVRON_TARGET_SPACING = 12     // Screen pixels between chevrons
export const CHEVRON_MIN_SCREEN_SIZE = 5     // Minimum chevron size
export const CHEVRON_MAX_SCREEN_SIZE = 14    // Maximum chevron size
export const CHEVRON_PROPORTIONAL_SIZE = 0.136 // As fraction of radius - matches clickable ring width

// ============================================================================
// TOLERANCES & THRESHOLDS
// ============================================================================

export const HANDLE_TOLERANCE = 12           // Hit detection for handles (screen px)
export const PATH_HIT_TOLERANCE = 15         // Hit detection for path segments (screen px)
export const DRAG_THRESHOLD = 3              // Minimum movement to start drag
export const DELETE_ICON_SIZE = 6            // Size of delete X icon
export const DELETE_ICON_Y_OFFSET = 18       // Y offset for delete icon (legacy, not used)
export const SLOT_TOLERANCE_FACTOR = 0.8     // Slot hit area relative to handle

// Action row (mirror + delete icons) positioned below circle
export const ACTION_ROW_OFFSET = 24          // Gap between circle edge and action row
export const ACTION_ICON_SIZE = 9            // Size of action icons
export const ACTION_ICON_SPACING = 24        // Horizontal spacing between icons

// ============================================================================
// TANGENT HANDLES
// ============================================================================

export const DEFAULT_TANGENT_LENGTH = 1.0
export const MIN_TANGENT_LENGTH = 0.1
export const MAX_TANGENT_LENGTH = 3.0
export const TANGENT_DISTANCE_FACTOR = 0.4   // Handle distance as fraction of circle distance

// ============================================================================
// MIRRORED ELEMENTS
// ============================================================================

export const MIRRORED_OPACITY = 0.35

// ============================================================================
// HISTORY
// ============================================================================

export const MAX_HISTORY = 50
export const HISTORY_DEBOUNCE_MS = 300

// ============================================================================
// RENDERING
// ============================================================================

export const MEASUREMENT_LABEL_OFFSET = 12   // Offset for measurement labels
export const PATH_LABEL_OFFSET = 20          // Offset for path labels

// Cursor quantization
export const CURSOR_ANGLE_INCREMENT = 15     // Degrees between cached cursors

// ============================================================================
// DND KIT
// ============================================================================

export const DND_ACTIVATION_DISTANCE = 5     // Distance before drag activates

