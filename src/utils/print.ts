/**
 * Printing via workshop-kit.
 *
 * Serpentine's canvas units aren't tied to anything physical, so a print
 * either fits the drawing to the paper, or maps units to millimetres at a
 * scale the user picks (tiling across sheets when it's bigger than the paper).
 */
import {
  downloadBlob,
  drawingToSvg,
  ellipseArcToCubics,
  itemsBounds,
  layoutPages,
  scaleItems,
  type ComposedPage,
  type DrawItem,
  type PathItem,
  type Segment,
  type StrokeStyle,
} from '@tomkail/workshop-kit'
import { computeTangentHull } from '../geometry/path'
import { useDocumentStore } from '../stores/documentStore'
import type { CircleShape, PathSegment, Point } from '../types'
import type { SerpentinePrintSettings } from '../stores/printStore'

const pointOnCircle = (c: Point, r: number, a: number): Point => ({ x: c.x + r * Math.cos(a), y: c.y + r * Math.sin(a) })

function segmentStart(seg: PathSegment): Point {
  switch (seg.type) {
    case 'line':
    case 'bezier':
      return seg.start
    case 'arc':
      return pointOnCircle(seg.center, seg.radius, seg.startAngle)
    case 'ellipse-arc': {
      const x = seg.radiusX * Math.cos(seg.startAngle)
      const y = seg.radiusY * Math.sin(seg.startAngle)
      const cos = Math.cos(seg.rotation)
      const sin = Math.sin(seg.rotation)
      return { x: seg.center.x + x * cos - y * sin, y: seg.center.y + x * sin + y * cos }
    }
  }
}

function toKitSegments(seg: PathSegment): Segment[] {
  switch (seg.type) {
    case 'line':
      return [{ type: 'line', to: seg.end }]
    case 'bezier':
      return [{ type: 'cubic', c1: seg.cp1, c2: seg.cp2, to: seg.end }]
    case 'arc':
      // Serpentine arcs use canvas arc() semantics, same as workshop-kit
      return [{ type: 'arc', center: seg.center, radius: seg.radius, start: seg.startAngle, end: seg.endAngle, ccw: seg.counterclockwise }]
    case 'ellipse-arc':
      return ellipseArcToCubics(seg.center, seg.radiusX, seg.radiusY, seg.rotation, seg.startAngle, seg.endAngle, seg.counterclockwise)
  }
}

/** Serpentine path segments → workshop-kit path items (one per sub-path) */
export function pathToItems(segments: PathSegment[], closed: boolean, style: StrokeStyle): PathItem[] {
  const paths: PathItem[] = []
  for (const seg of segments) {
    if (paths.length === 0 || seg.needsMoveTo) {
      paths.push({ kind: 'path', start: segmentStart(seg), segments: [], closed: false, style })
    }
    paths[paths.length - 1].segments.push(...toKitSegments(seg))
  }
  if (closed && paths.length > 0) paths[paths.length - 1].closed = true
  return paths
}

export interface PrintContent {
  items: DrawItem[]
  /** Drawing bounds in canvas units */
  bounds: { x: number; y: number; width: number; height: number }
  name: string
}

/** The current document as printable items, in canvas units */
export function buildPrintContent(settings: SerpentinePrintSettings): PrintContent | null {
  const doc = useDocumentStore.getState()
  const circles = doc.shapes.filter((s): s is CircleShape => s.type === 'circle')
  const { segments } = computeTangentHull(circles, doc.shapeOrder, doc.globalStretch, doc.closedPath, doc.useStartPoint, doc.useEndPoint, doc.mirrorConfig)
  if (segments.length === 0) return null

  const pathStyle: StrokeStyle = { stroke: '#000000', width: settings.strokeWidth, fill: settings.fill && doc.closedPath ? '#e8e8e8' : undefined, layer: 'path' }
  const items: DrawItem[] = []
  if (settings.showCircles) {
    const circleStyle: StrokeStyle = { stroke: '#999999', width: 0.15, dash: [1, 1], layer: 'circles' }
    for (const c of circles) {
      items.push({ kind: 'circle', center: c.center, radius: c.radius, style: circleStyle })
    }
  }
  items.push(...pathToItems(segments, doc.closedPath, pathStyle))

  // Bounds of the path only, so optional circles don't change the scale
  const bounds = itemsBounds(items.filter((i) => i.kind !== 'text' && i.style.layer === 'path'))
  const pad = Math.max(bounds.width, bounds.height) * 0.01
  return {
    items,
    bounds: { x: bounds.x - pad, y: bounds.y - pad, width: bounds.width + pad * 2, height: bounds.height + pad * 2 },
    name: doc.fileName || 'Serpentine',
  }
}

const round = (v: number, d = 1) => Math.round(v * 10 ** d) / 10 ** d

export function buildPrintPages(content: PrintContent, settings: SerpentinePrintSettings): ComposedPage[] {
  const physical = settings.scaleMode === 'physical'
  const w = content.bounds.width
  const h = content.bounds.height
  const header = settings.labels
    ? {
        title: content.name,
        tag: physical ? `Serpentine · 1 unit = ${round(settings.mmPerUnit, 3)} mm` : 'Serpentine',
        lines: physical ? [`${round(w * settings.mmPerUnit)} × ${round(h * settings.mmPerUnit)} mm (${round(w)} × ${round(h)} units)`] : [`${round(w)} × ${round(h)} units`],
      }
    : undefined
  return layoutPages(
    content,
    { paperId: settings.paperId, landscape: settings.landscape, scaleCheck: settings.scaleCheck, header },
    physical ? { mode: 'physical', mmPerUnit: settings.mmPerUnit } : { mode: 'fit' }
  )
}

/** One SVG of the whole drawing: true size in mm, or canvas units if fitting */
export function downloadDrawingSvg(content: PrintContent, settings: SerpentinePrintSettings) {
  const s = settings.scaleMode === 'physical' ? settings.mmPerUnit : 1
  const margin = 5
  const items = scaleItems(content.items, s, { x: margin - content.bounds.x * s, y: margin - content.bounds.y * s })
  const drawing = { width: content.bounds.width * s + margin * 2, height: content.bounds.height * s + margin * 2, items }
  const file = `${content.name.replace(/[^a-z0-9]+/gi, '_')}${settings.scaleMode === 'physical' ? '-1to1' : ''}.svg`
  downloadBlob(drawingToSvg(drawing, { title: content.name }), file, 'image/svg+xml')
}
