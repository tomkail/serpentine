# Serpentine

A geometric design tool for creating smooth, organic paths defined by circles.

## What it does

Place circles on an infinite canvas, and Serpentine automatically renders a path that wraps around them.
This allows better rounded curves than traditional bezier curves allow, and makes editing faster.

This approach is particularly valuable for:

- **Luthiers** designing guitar bodies and instrument outlines
- **Industrial designers** creating smooth product contours
- **Typographers** constructing letterforms

## Printing

File → Print / PDF… (⌘P) prints the path using [workshop-kit](https://github.com/tomkail/workshop-kit):

- **Fit to page** scales the drawing to the paper. Canvas units don't have a fixed real-world size.
- **True size** maps units to millimetres (set the scale, or type the width or height you want). Drawings bigger than the paper are tiled across overlapping sheets with registration marks for taping together, with scale-check rulers on each sheet.
- Download as a vector PDF (every sheet) or a single SVG.

## Running locally

```bash
npm install
npm run dev
```