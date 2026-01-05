# StringPath — Design Document

## Overview

**StringPath** is a geometric design tool for creating smooth, organic paths defined by shapes. Users place circles (and eventually ellipses, rounded polygons) on an infinite canvas, and the app automatically renders a path that wraps around them — like a string held taut between pegs.

The tool is designed for:
- Luthiers designing guitar bodies and instrument outlines
- Industrial designers creating smooth product contours
- Typographers constructing letterforms
- Anyone who thinks in terms of curves defined by circular arcs

---

## Design Philosophy

### Inspired by Hundred Rabbits & Permacomputing

StringPath follows the software philosophy of [Hundred Rabbits](https://hundredrabbits.itch.io/dotgrid) and the permacomputing movement:

| Principle | Implementation |
|-----------|----------------|
| **Single-purpose** | One tool, one job: defining paths through tangent geometry |
| **Offline-first** | No server, no accounts, no tracking — runs entirely in browser |
| **Resilient** | Works on low-powered devices, saves locally, exports to standard formats |
| **Keyboard-driven** | Every action accessible via shortcut |
| **Themeable** | Monochrome by default, customizable palette |
| **Transparent** | Human-readable JSON file format, open source |
| **Frugal** | Minimal dependencies, small bundle size |

### Core Beliefs

1. **Direct manipulation over menus** — Drag shapes, see results instantly
2. **Constraints as creativity** — Limited palette, grid-based, focused toolset
3. **Generators over output** — Edit the circles, not the path; the path emerges
4. **Precision when needed, freeform when not** — Snap-to-grid is a toggle, not a mandate
5. **Information density done right** — Measurements visible but never loud

---

## Visual Language

StringPath uses a carefully designed visual language that prioritizes clarity, consistency, and accessibility.

### Core Principles

| Principle | Implementation |
|-----------|----------------|
| **Shape = Function** | Different handle types use distinct shapes (diamond, circle, slot) |
| **Opacity = State** | Filled = primary/active, Hollow = secondary, Ghost = reference |
| **Single Hue** | One accent color with opacity variations for all interactive elements |
| **Double-Stroke Handles** | Inner dark + outer light stroke ensures visibility on any background |
| **Line Texture** | Solid, dashed, dotted patterns create visual hierarchy |

### Handle System

All interactive handles follow a consistent visual grammar:

| Handle | Shape | Style | Purpose |
|--------|-------|-------|---------|
| Entry tangent | Diamond ◆ | Filled | Where path enters circle |
| Exit tangent | Diamond ◇ | Hollow (stroke) | Where path exits circle |
| Entry length | Circle ● | Filled | Curve tightness control |
| Exit length | Circle ○ | Hollow (stroke) | Curve tightness control |
| Raw tangent (slot) | Diamond | Dashed ghost | Reference position when offset applied |
| Delete | X mark | Center of selected shape | Remove shape |

### Double-Stroke Rendering

Handles are rendered with two strokes for universal visibility:

```
┌─────────────┐
│ outer light │  ← White/light halo (wider)
│ ┌─────────┐ │
│ │  inner  │ │  ← Dark outline (narrower)
│ │  dark   │ │
│ │ ┌─────┐ │ │
│ │ │fill │ │ │  ← Accent color fill or stroke
│ │ └─────┘ │ │
│ └─────────┘ │
└─────────────┘
```

This ensures handles are visible whether over the dark canvas background, light path strokes, or shape fills.

### Slot Shapes

"Slots" are ghost markers showing reference positions:

- Appear when a handle has been offset from its default position
- Rendered as dashed outlines at low opacity
- Connected to actual handle by dotted line
- Help users understand how far they've deviated from the geometric default

### Direction Ring

Each circle displays a direction ring showing path flow:

- Ring at 70% of circle radius with a gap indicating flow start
- Chevron marks distributed around the ring pointing in flow direction
- Dashed when idle, solid when hovered
- Click anywhere on ring to reverse direction
- Replaces the old single-arrow indicator for better visibility from any angle

### Delete Icon

Selected shapes display a delete icon (✕) at their center:

- Only visible when shape is selected
- Highlights in danger color (red) on hover
- Single click to delete
- Double-stroke rendering for visibility

### Hover Behavior

Interactive elements provide visual feedback on hover:

| Element | Hover Effect |
|---------|--------------|
| Circle edge | Highlights (indicates scale action available) |
| Circle body | Shows move cursor |
| Direction ring | Becomes solid, shows pointer cursor |
| Delete icon | Turns red |
| Tangent handles | Brighten to full accent color |
| Length handles | Brighten to full accent color |

### Cursor States

Custom cursors communicate available actions:

| Context | Cursor |
|---------|--------|
| Over shape body | Move (four-way arrow) |
| Over shape edge | Scale (diagonal resize) |
| Over direction ring | Pointer |
| Over delete icon | Pointer |
| Over handle | Grab |
| Dragging handle | Grabbing |
| Panning canvas | Grab / Grabbing |

### Theme System

The visual language is implemented through a themeable system:

```typescript
interface CanvasTheme {
  name: string
  
  // Single accent hue with opacity variations
  accent: string           // Primary interactive color
  accentDim: string        // 40% - secondary elements
  accentGhost: string      // 15% - slots, references
  accentGlow: string       // Selection halos
  
  // Neutrals
  background: string
  stroke: string
  strokeHover: string
  fill: string
  chrome: string           // Guides, connections
  
  // Danger state
  danger: string
  dangerDim: string
  
  // Stroke weights (scaled by zoom)
  weights: {
    hairline: number       // 1px - guides, slots
    light: number          // 1.5px - secondary
    medium: number         // 2px - primary
    heavy: number          // 3px - emphasis
  }
  
  // Handle rendering
  handle: {
    size: number
    innerStroke: string
    outerStroke: string
    innerWidth: number
    outerWidth: number
  }
}
```

Default theme: **Midnight** (dark background, blue accent)

---

## Core Concepts

### The Tangent Hull

The central mechanic: given an ordered list of shapes, compute the path that:
1. Leaves each shape along a **tangent line** toward the next shape
2. Wraps around each shape via an **arc** connecting entry and exit points
3. Forms a **closed loop** back to the first shape

### Wrap Direction (Implemented ✓)

Each circle has a **wrap side** property (`'left'` or `'right'`) that controls whether the path wraps clockwise or counter-clockwise around that circle:

| Wrap Side | Direction | Visual |
|-----------|-----------|--------|
| `'right'` | Clockwise (CW) | ↺ |
| `'left'` | Counter-clockwise (CCW) | ↻ |

This affects tangent calculations:
- **Same wrap side** on consecutive circles → External tangent (path stays outside)
- **Opposite wrap sides** → Internal tangent (path crosses between circles, creating figure-8 patterns)

Direction is toggled by clicking the direction arrow indicator on each circle.

### Shape Abstraction

All shapes implement a common interface:

```typescript
interface TangentShape {
  id: string
  type: ShapeType
  center: Point
  
  // Compute where the path touches this shape from a given direction
  getTangentPoint(approachAngle: number, direction: 'entry' | 'exit'): TangentResult
  
  // Render the arc segment between two points on this shape's perimeter
  getArcPath(from: Point, to: Point, clockwise: boolean): string // SVG path
  
  // Hit testing for interaction
  containsPoint(p: Point): boolean
  isOnEdge(p: Point, threshold: number): boolean
  
  // Bounding box for culling/selection
  getBounds(): Rect
}
```

**Phase 1:** Circles only (✓ Implemented)  
**Phase 2:** Ellipses, rounded rectangles, rounded n-gons

### Stretch (Implemented ✓ - Partial)

A parameter that controls the "bulge" of arcs around circles:

| Stretch | Behavior |
|---------|----------|
| `-100%` | Flatter — arc compressed toward chord |
| `0%` | Circular — exact circle arc (default) |
| `+100%` | Bulgier — arc stretched outward |

**Implementation Details:**
- Global stretch value applies to all circles by default
- Per-circle override available via hierarchy panel
- Implemented using elliptical arcs (Canvas `ellipse()` API)
- **Known Issue:** Direction calculation for non-180° arcs is currently buggy

**Hierarchy:** Circle-level stretch > Global stretch

### Tangent Offset (Implemented ✓)

Contact points can be rotated around the circle from the true tangent position:

| Parameter | Range | Effect |
|-----------|-------|--------|
| Entry Offset | -90° to +90° | Rotates where the path enters the circle |
| Exit Offset | -90° to +90° | Rotates where the path exits the circle |

When offsets are non-zero, the connecting line segments become Bézier curves to maintain tangent continuity at the offset contact points.

### Tangent Length Multiplier (Implemented ✓)

Controls the "tightness" of Bézier curves at contact points:

| Parameter | Range | Effect |
|-----------|-------|--------|
| Entry Length | 0% - 300% | Controls curve tightness at entry |
| Exit Length | 0% - 300% | Controls curve tightness at exit |

- `100%` = default smooth curve
- `< 100%` = tighter curve (control points closer)
- `> 100%` = more extended curve (control points further)

---

## Features

### Canvas (Implemented ✓)

| Feature | Behavior |
|---------|----------|
| **Pan** | Middle-mouse drag, or Space + drag |
| **Zoom** | Scroll wheel, centered on cursor |
| **Dot grid** | Subtle background grid, scales dynamically with zoom |
| **Infinite canvas** | No boundaries |
| **Fit to viewport** | View menu option to auto-zoom to show all shapes |

#### Dynamic Grid Scaling (Implemented ✓)

The dot grid dynamically adjusts based on zoom level:
- Multiple grid levels with different dot sizes
- Dots crossfade smoothly between scale transitions
- Prevents grid from becoming a solid mass when zoomed out
- Similar to Unity's scene view grid behavior

### Shape Manipulation (Implemented ✓)

| Action | Trigger |
|--------|---------|
| **Select** | Click shape |
| **Move** | Drag shape center |
| **Scale** | Drag shape edge |
| **Multi-select** | Shift+click |
| **Delete** | Backspace / Delete key, or ✕ button |
| **Duplicate** | Via context (future) |
| **Toggle direction** | Click direction arrow on circle |

### Constant UI Scaling (Implemented ✓)

All canvas UI elements maintain consistent screen size regardless of zoom:
- Direction arrow indicators
- Debug labels and points
- Measurement text
- Entry/exit point markers

### Selected Shape on Top (Implemented ✓)

The currently selected shape is always rendered on top of other shapes, ensuring it can be selected and dragged even if normally drawn underneath.

### Snap to Grid (Implemented ✓)

- Toggle: Button in toolbar, persisted setting
- Snaps shape centers to grid intersections
- Snaps radii to grid units
- Visual indicator shows snap state

### Measurements (Implemented ✓)

Three display modes (cycle with `M`):

| Mode | Displays |
|------|----------|
| **Clean** | Shapes and path only |
| **Minimal** | Shape radii + total path length |
| **Detailed** | All segment lengths, coordinates, arc lengths |

Measurement style:
- Monospace font
- Muted gray color
- CAD-style dimension aesthetic

### Hierarchy Panel (Implemented ✓)

Right-side panel listing all shapes:

- **Drag to reorder** — Defines path sequence (using @dnd-kit)
- **Click to select** — Highlights shape on canvas
- **Rename** — Double-click name
- **Delete** — Click ✕ button
- **Direction toggle** — Click ↺/↻ icon
- **Stretch controls** — Per-circle stretch override with checkbox
- **Advanced controls** — Expandable section for offset and tangent length

#### Global Settings (Implemented ✓)

- **Global Stretch slider** — Project-wide default (-100% to +100%)
- **Reset button** — Returns setting to default value

#### Per-Circle Settings (Implemented ✓)

- **Stretch override** — Checkbox to enable, slider to adjust
- **Entry/Exit Offset** — Angular offset from true tangent
- **Entry/Exit Tangent Length** — Curve tightness multipliers
- **Reset buttons** — For each setting individually

### Path Info (Implemented ✓)

Bottom of hierarchy panel shows:
- Total path length
- Number of segments
- Lines / Arcs count

### File Operations (Implemented ✓)

| Action | Shortcut | Behavior |
|--------|----------|----------|
| **New** | Cmd/Ctrl + N | Clear canvas (with confirmation) |
| **Save** | Cmd/Ctrl + S | Download `.stringpath` JSON file |
| **Load** | Cmd/Ctrl + O | Open file picker |

**Auto-save:** State persists to `localStorage` on every change. Reloading the page restores exactly where you left off.

### Test Presets (Implemented ✓)

Built-in presets accessible from the File menu for testing:

| Preset | Description |
|--------|-------------|
| **Capsule (Both CW)** | Two circles, both clockwise — capsule shape |
| **Capsule (Both CCW)** | Two circles, both counter-clockwise — capsule shape |
| **Infinity (CW + CCW)** | Two circles with opposite directions — figure-8 |
| **Triangle (All CW)** | Three circles forming a triangle |
| **Stretch Demo** | Two circles demonstrating stretch effect |
| **Guitar** | Complex shape with various settings |

### Debug Menu (Implemented ✓)

Toggle debug visualizations:
- **Show Tangent Points** — Entry (green) and exit (red) markers
- **Show Labels** — Point labels (L0s, L0e, etc.)
- **Show Arc Angles** — Entry/exit angle values
- **Show Path Order** — Numbers indicating path sequence
- **Show Centers** — Circle center points

### Error Handling (Implemented ✓)

- **Error Boundary** — Catches and displays UI errors gracefully
- **Toast Notifications** — Non-intrusive messages for user feedback
- **Global Error Handlers** — Catches unhandled exceptions and promise rejections

---

## User Interface

### Color Palette (Default Theme)

```css
:root {
  /* Canvas */
  --canvas-bg: #0a0a0a;
  --grid-dot: #1a1a1a;
  
  /* Shapes */
  --shape-fill: #0f0f0f;
  --shape-stroke: #333333;
  --shape-stroke-hover: #4a4a4a;
  --shape-stroke-selected: #707070;
  --shape-handle: #505050;
  
  /* Path */
  --path-stroke: #ffffff;  /* Pure white for visibility */
  --path-width: 2px;
  
  /* Measurements */
  --measure-text: #4a4a4a;
  --measure-line: #2a2a2a;
  
  /* Panel */
  --panel-bg: #0d0d0d;
  --panel-border: #1a1a1a;
  --panel-item-bg: #141414;
  --panel-item-hover: #1c1c1c;
  --panel-item-selected: #252525;
  
  /* Text */
  --text-primary: #c0c0c0;
  --text-secondary: #606060;
  --text-muted: #404040;
  
  /* Menu */
  --menu-bg: #111111;
  --menu-hover: #1a1a1a;
  --menu-border: #222222;
}
```

### Typography

| Element | Font | Size |
|---------|------|------|
| UI labels | `Inter`, system sans | 13px |
| Measurements | `JetBrains Mono` | 10px |
| Menu items | `Inter` | 13px |
| Panel headings | `Inter`, semi-bold | 11px, uppercase, tracked |

---

## Technical Architecture

### Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | React 18 + TypeScript |
| Build | Vite |
| State | Zustand (with `persist` middleware) |
| Canvas | HTML Canvas API (custom React bindings) |
| Drag & Drop | @dnd-kit/core + @dnd-kit/sortable |
| Styling | CSS Modules + CSS Variables |

### Project Structure

```
src/
├── components/
│   ├── App.tsx
│   ├── Canvas/
│   │   ├── Canvas.tsx
│   │   ├── Canvas.module.css
│   │   ├── useCanvasInteraction.ts
│   │   └── renderers/
│   │       ├── GridRenderer.ts
│   │       ├── ShapeRenderer.ts
│   │       ├── PathRenderer.ts
│   │       └── MeasurementRenderer.ts
│   ├── HierarchyPanel/
│   │   ├── HierarchyPanel.tsx
│   │   ├── HierarchyPanel.module.css
│   │   ├── ShapeListItem.tsx
│   │   └── PathInfo.tsx
│   ├── MenuBar/
│   │   ├── MenuBar.tsx
│   │   ├── MenuBar.module.css
│   │   ├── Menu.tsx
│   │   └── MenuItem.tsx
│   ├── Toolbar/
│   │   ├── Toolbar.tsx
│   │   └── Toolbar.module.css
│   ├── Toast/
│   │   ├── Toast.tsx
│   │   ├── Toast.module.css
│   │   └── ToastContainer.tsx
│   └── ErrorBoundary.tsx
├── stores/
│   ├── documentStore.ts     # Shapes, path order, stretch
│   ├── viewportStore.ts     # Pan, zoom
│   ├── selectionStore.ts    # Selected/hovered (not persisted)
│   ├── settingsStore.ts     # Grid, snap, measurement mode
│   ├── debugStore.ts        # Debug visualization toggles
│   └── toastStore.ts        # Toast notifications
├── geometry/
│   ├── shapes/
│   │   └── Circle.ts
│   ├── tangent.ts           # Tangent calculation (external & internal)
│   ├── path.ts              # Full path computation with stretch
│   └── math.ts              # Vector utilities
├── utils/
│   ├── fileIO.ts            # Save/load logic
│   └── presets.ts           # Test preset definitions
├── types/
│   └── index.ts
├── theme.css
├── main.tsx
└── index.html
```

### State Management

**documentStore** (persisted):
```typescript
interface DocumentState {
  shapes: Shape[]
  shapeOrder: string[]  // IDs defining path sequence
  globalStretch: number // -1.0 to 1.0
  fileName: string | null
}
```

**viewportStore** (persisted):
```typescript
interface ViewportState {
  pan: { x: number; y: number }
  zoom: number
}
```

**selectionStore** (not persisted):
```typescript
interface SelectionState {
  selectedIds: string[]
  hoveredId: string | null
  dragState: DragState | null
}
```

**settingsStore** (persisted):
```typescript
interface SettingsState {
  snapToGrid: boolean
  gridSize: number
  measurementMode: 'clean' | 'minimal' | 'detailed'
}
```

**debugStore** (not persisted):
```typescript
interface DebugState {
  showTangentPoints: boolean
  showLabels: boolean
  showArcAngles: boolean
  showPathOrder: boolean
  showCenters: boolean
}
```

---

## Data Types

### Circle Shape

```typescript
interface CircleShape {
  id: string
  type: 'circle'
  name: string
  center: Point
  radius: number
  wrapSide: 'left' | 'right'  // CCW or CW wrapping
  
  // Stretch: stretches the arc into an ellipse
  stretch?: number  // -1 to 1, inherits from global if undefined
  
  // Tangent offset: rotates contact points from true tangent
  entryOffset?: number    // radians, 0 = true tangent
  exitOffset?: number     // radians, 0 = true tangent
  
  // Tangent length: controls bezier curve tightness
  entryTangentLength?: number  // multiplier, 1.0 = default
  exitTangentLength?: number   // multiplier, 1.0 = default
}
```

### Path Segments

```typescript
type PathSegment = LineSegment | BezierSegment | ArcSegment | EllipseArcSegment

interface LineSegment {
  type: 'line'
  start: Point
  end: Point
  length: number
}

interface BezierSegment {
  type: 'bezier'
  start: Point
  cp1: Point  // Control point 1
  cp2: Point  // Control point 2
  end: Point
  length: number
}

interface ArcSegment {
  type: 'arc'
  center: Point
  radius: number
  startAngle: number
  endAngle: number
  clockwise: boolean
  length: number
}

interface EllipseArcSegment {
  type: 'ellipse-arc'
  center: Point
  radiusX: number
  radiusY: number
  rotation: number
  startAngle: number
  endAngle: number
  counterclockwise: boolean
  length: number
}
```

---

## File Format

`.stringpath` files are JSON:

```json
{
  "version": 1,
  "name": "Guitar Body v3",
  "created": "2026-01-03T12:00:00Z",
  "modified": "2026-01-03T14:30:00Z",
  "settings": {
    "gridSize": 20,
    "globalStretch": 0.0
  },
  "viewport": {
    "pan": { "x": 0, "y": 0 },
    "zoom": 1.0
  },
  "shapes": [
    {
      "id": "c1",
      "type": "circle",
      "name": "Upper Bout",
      "center": { "x": 100, "y": 100 },
      "radius": 60,
      "wrapSide": "right",
      "stretch": 0.1,
      "entryOffset": 0.2,
      "exitOffset": -0.1
    }
  ],
  "pathOrder": ["c1", "c2", "c3"]
}
```

Human-readable, diffable, version-controlled.

---

## Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| Pan | Space + drag / Middle mouse |
| Zoom in | Cmd/Ctrl + = / Scroll up |
| Zoom out | Cmd/Ctrl + - / Scroll down |
| Zoom to fit | View menu → Fit to Viewport |
| Delete | Backspace / Delete |
| New | Cmd/Ctrl + N |
| Save | Cmd/Ctrl + S |
| Load | Cmd/Ctrl + O |
| Cycle measurements | M |
| Escape | Deselect all |

---

## Known Issues & Limitations

### Stretch Feature (Elliptical Arcs)

The stretch feature that transforms circular arcs into elliptical arcs has known bugs:

1. **Direction calculation fails for non-180° arcs** — The ellipse arc sometimes goes the wrong direction (through the wrong half of the ellipse) for arcs that aren't semicircles
2. **Works correctly at 0% stretch** — Circular arcs render correctly
3. **Works correctly for 180° arcs** — Semicircular arcs (like in the Capsule preset) work properly with stretch

**Root cause:** The calculation for determining which half of the ellipse to traverse is sensitive to the geometric relationship between chord direction, arc midpoint position, and ellipse rotation. The current implementation doesn't correctly handle all cases.

**Workaround:** Use 0% stretch for complex shapes, or only apply stretch to shapes where the tangent points create approximately 180° arcs.

---

## Future Extensions

### Phase 2: Additional Shapes
- Ellipses
- Rounded rectangles
- Rounded n-gons (triangles, hexagons, etc.)
- Stadiums (pill shapes)

### Phase 3: Advanced Features
- Multiple separate paths
- Path offset (parallel path at distance)
- Fix stretch feature for all arc angles

### Phase 4: Design Tools
- Symmetry mode (mirror across axis)
- Reference image underlay
- Rulers and guides

### Phase 5: Export
- SVG export
- PNG export (with scale options)
- DXF export for CAD/CNC

### Phase 6: Polish
- Undo/redo history
- Custom themes
- Touch/tablet support

---

## Summary

StringPath is a focused, well-crafted tool for geometric path construction. It embraces constraints as a design philosophy — monochrome palette, grid-based, single-purpose — while providing the precision and flexibility needed for real design work.

The architecture prioritizes:
- **Extensibility** — Shape abstraction allows new primitives without rewriting core logic
- **Persistence** — Never lose work; auto-save and file export
- **Performance** — Canvas rendering, minimal re-renders
- **Accessibility** — Keyboard-driven, clear visual hierarchy

### Implementation Status

| Feature | Status |
|---------|--------|
| Core canvas (pan/zoom/grid) | ✅ Complete |
| Circle shapes | ✅ Complete |
| Tangent hull path | ✅ Complete |
| Wrap direction (CW/CCW) | ✅ Complete |
| Internal/external tangents | ✅ Complete |
| Hierarchy panel with drag reorder | ✅ Complete |
| File save/load | ✅ Complete |
| Auto-save to localStorage | ✅ Complete |
| Snap to grid | ✅ Complete |
| Measurements (3 modes) | ✅ Complete |
| Debug visualizations | ✅ Complete |
| Test presets | ✅ Complete |
| Error handling (boundary + toasts) | ✅ Complete |
| Constant UI scaling | ✅ Complete |
| Dynamic grid scaling | ✅ Complete |
| Fit to viewport | ✅ Complete |
| Tangent offset | ✅ Complete |
| Tangent length multiplier | ✅ Complete |
| Stretch (elliptical arcs) | ⚠️ Partial (bugs with non-180° arcs) |
| Additional shapes | 🔲 Future |
| Export (SVG/PNG/DXF) | 🔲 Future |
| Undo/redo | 🔲 Future |
