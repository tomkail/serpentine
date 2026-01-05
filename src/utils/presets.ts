import type { SerpentineDocument } from '../types'

export interface Preset {
  name: string
  description: string
  document: SerpentineDocument
}

/**
 * Guitar body shape
 * Classic acoustic guitar body outline with upper bout, waist indent, and lower bout
 * Uses mirrored shapes for symmetry
 */
const guitar: Preset = {
  name: 'Guitar',
  description: 'Classic guitar body shape with upper bout, waist, and lower bout',
  document: {
    version: 1,
    name: 'Guitar',
    shapes: [
      {
        id: 'upper-bout',
        type: 'circle',
        name: 'Upper Bout',
        center: { x: 200, y: -40 },
        radius: 100,
        direction: 'ccw',
        mirrored: true,
        entryOffset: -0.17612252553627883,
        entryTangentLength: 0.6455787586808588,
        exitTangentLength: 0.7390475459727179
      },
      {
        id: 'waist',
        type: 'circle',
        name: 'Waist',
        center: { x: 480, y: 200 },
        radius: 220,
        direction: 'cw',
        mirrored: true,
        entryOffset: -0.18708791407324643,
        exitTangentLength: 1.2342171687640855,
        entryTangentLength: 0.712902115328755
      },
      {
        id: 'lower-bout',
        type: 'circle',
        name: 'Lower Bout',
        center: { x: 220, y: 680 },
        radius: 220,
        direction: 'ccw',
        mirrored: true,
        exitOffset: 0.058334448016694074,
        entryTangentLength: 0.6470311810695264
      }
    ],
    pathOrder: ['upper-bout', 'waist', 'lower-bout'],
    settings: {
      closedPath: true
    }
  }
}

/**
 * Autodromo Internazionale del Mugello
 * Famous Italian MotoGP circuit in Tuscany
 */
const mugello: Preset = {
  name: 'Mugello',
  description: 'Autodromo Internazionale del Mugello racetrack',
  document: {
    version: 1,
    name: 'Mugello',
    shapes: [
      {
        id: 'san-donato',
        type: 'circle',
        name: 'San Donato (T1)',
        center: { x: 120, y: 160 },
        radius: 40,
        direction: 'ccw',
        entryOffset: 0.08726646259971647
      },
      {
        id: 'luco',
        type: 'circle',
        name: 'Luco (T2)',
        center: { x: 240, y: 100 },
        radius: 40,
        direction: 'cw'
      },
      {
        id: 'poggio-secco',
        type: 'circle',
        name: 'Poggio Secco (T3)',
        center: { x: 340, y: 80 },
        radius: 50,
        direction: 'ccw'
      },
      {
        id: 'materassi',
        type: 'circle',
        name: 'Materassi (T4)',
        center: { x: 580, y: 100 },
        radius: 40,
        direction: 'cw'
      },
      {
        id: 'borgo',
        type: 'circle',
        name: 'Borgo San Lorenzo (T5)',
        center: { x: 700, y: 140 },
        radius: 50,
        direction: 'ccw'
      },
      {
        id: 'casanova',
        type: 'circle',
        name: 'Casanova (T6)',
        center: { x: 880, y: 260 },
        radius: 60,
        direction: 'ccw'
      },
      {
        id: 'savelli',
        type: 'circle',
        name: 'Savelli (T7)',
        center: { x: 1000, y: 340 },
        radius: 50,
        direction: 'cw'
      },
      {
        id: 'arrabbiata1',
        type: 'circle',
        name: 'Arrabbiata 1 (T8)',
        center: { x: 1120, y: 480 },
        radius: 70,
        direction: 'ccw'
      },
      {
        id: 'arrabbiata2',
        type: 'circle',
        name: 'Arrabbiata 2 (T9)',
        center: { x: 1080, y: 640 },
        radius: 70,
        direction: 'ccw'
      },
      {
        id: 'scarperia',
        type: 'circle',
        name: 'Scarperia (T10)',
        center: { x: 880, y: 660 },
        radius: 40,
        direction: 'ccw'
      },
      {
        id: 'palagio',
        type: 'circle',
        name: 'Palagio (T11)',
        center: { x: 780, y: 620 },
        radius: 50,
        direction: 'cw'
      },
      {
        id: 'correntaio',
        type: 'circle',
        name: 'Correntaio (T12)',
        center: { x: 500, y: 480 },
        radius: 60,
        direction: 'ccw'
      },
      {
        id: 'biondetti1',
        type: 'circle',
        name: 'Biondetti 1 (T13)',
        center: { x: 640, y: 420 },
        radius: 50,
        direction: 'cw'
      },
      {
        id: 'biondetti2',
        type: 'circle',
        name: 'Biondetti 2 (T14)',
        center: { x: 700, y: 560 },
        radius: 90,
        direction: 'ccw'
      },
      {
        id: 'bucine',
        type: 'circle',
        name: 'Bucine (T15)',
        center: { x: 1040, y: 560 },
        radius: 80,
        direction: 'cw',
        exitOffset: -0.08726646259971647,
        exitTangentLength: 1.1
      }
    ],
    pathOrder: [
      'san-donato',
      'luco',
      'poggio-secco',
      'materassi',
      'borgo',
      'casanova',
      'savelli',
      'arrabbiata1',
      'arrabbiata2',
      'scarperia',
      'palagio',
      'correntaio',
      'biondetti1',
      'biondetti2',
      'bucine'
    ],
    settings: {
      closedPath: true
    }
  }
}

/**
 * Heart shape
 * A stylized heart using mirrored circles
 */
const heart: Preset = {
  name: 'Heart',
  description: 'A stylized heart shape using mirrored circles',
  document: {
    version: 1,
    name: 'Heart',
    shapes: [
      {
        id: '153ddf78-7062-46bb-8e92-7289e2d9f83a',
        type: 'circle',
        name: 'Circle 2',
        center: { x: 0, y: 200 },
        radius: 10,
        direction: 'cw',
        exitOffset: 0.17453292519943295,
        entryOffset: -0.17453292519943295
      },
      {
        id: '8dbb715e-dbbb-4cfe-b343-3a5c438c3fad',
        type: 'circle',
        name: 'Circle 1',
        center: { x: 80, y: 0 },
        radius: 100,
        direction: 'cw',
        mirrored: true,
        exitOffset: -0.8849444486589597,
        exitTangentLength: 1.2296819201495444,
        entryOffset: -0.3239490299150205,
        entryTangentLength: 0.5965757640541248
      }
    ],
    pathOrder: [
      '153ddf78-7062-46bb-8e92-7289e2d9f83a',
      '8dbb715e-dbbb-4cfe-b343-3a5c438c3fad'
    ],
    settings: {
      closedPath: true
    }
  }
}

export const presets: Preset[] = [
  guitar,
  mugello,
  heart
]

export function getPresetByName(name: string): Preset | undefined {
  return presets.find(p => p.name === name)
}
