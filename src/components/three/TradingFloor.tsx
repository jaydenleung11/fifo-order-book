import { useFrame } from '@react-three/fiber'
import { Environment, Lightformer } from '@react-three/drei'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useReducedMotion } from 'motion/react'
import * as THREE from 'three'
import type { Trade } from '@/engine/types'
import { INSTRUMENTS, type Instrument } from '@/app/instruments'
import { FIRMS, firmOf, logoUrl } from '@/app/firms'
import { C } from '@/components/three/theme'

/* ------------------------------------------------------------------ backdrop

   A trading floor behind the book: a curved video wall (price chart, quote
   board, participants), a scrolling LED ticker under it, and low desks along
   the far left and right. Everything sits at z <= -3.8 or |x| > 8.5, so it
   never stands between the camera and the queues.

   Screens are CanvasTextures redrawn only when the trades or the instrument
   change; the ticker only moves its texture offset each frame.
*/

const MONO = 'ui-monospace, Menlo, Consolas, monospace'
const SANS = 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif'
const PAL = {
  screen: '#06080b',
  panel: '#0d1117',
  grid: '#1a212b',
  text: C.ink,
  muted: C.muted,
  faint: C.faint,
  bid: C.bid,
  ask: C.ask,
  up: C.good,
  down: C.bad,
}


/* ------------------------------------------------------------- canvas utils */

function makeCanvas(w: number, h: number) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return c
}

function makeTexture(canvas: HTMLCanvasElement) {
  const t = new THREE.CanvasTexture(canvas)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  t.generateMipmaps = true
  t.minFilter = THREE.LinearMipmapLinearFilter
  return t
}

/** A canvas plus its texture that lives as long as the component. */
function useCanvasTexture(w: number, h: number) {
  const pair = useMemo(() => {
    const canvas = makeCanvas(w, h)
    return { canvas, texture: makeTexture(canvas) }
  }, [w, h])
  useEffect(() => () => pair.texture.dispose(), [pair])
  return pair
}

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath()
  g.moveTo(x + r, y)
  g.arcTo(x + w, y, x + w, y + h, r)
  g.arcTo(x + w, y + h, x, y + h, r)
  g.arcTo(x, y + h, x, y, r)
  g.arcTo(x, y, x + w, y, r)
  g.closePath()
}

/** Faint scanlines / pixel grid so screens read as displays, not paper. */
function screenFinish(g: CanvasRenderingContext2D, w: number, h: number) {
  g.fillStyle = 'rgba(255,255,255,0.018)'
  for (let y = 0; y < h; y += 4) g.fillRect(0, y, w, 1)
  const v = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.75)
  v.addColorStop(0, 'rgba(0,0,0,0)')
  v.addColorStop(1, 'rgba(0,0,0,0.45)')
  g.fillStyle = v
  g.fillRect(0, 0, w, h)
}

function header(g: CanvasRenderingContext2D, w: number, title: string, right: string) {
  g.fillStyle = PAL.panel
  g.fillRect(0, 0, w, 44)
  g.fillStyle = PAL.grid
  g.fillRect(0, 44, w, 2)
  g.font = `600 20px ${MONO}`
  g.textBaseline = 'middle'
  g.textAlign = 'left'
  g.fillStyle = PAL.muted
  g.fillText(title, 18, 23)
  g.textAlign = 'right'
  g.fillStyle = PAL.faint
  g.fillText(right, w - 18, 23)
}

/* ---------------------------------------------------------------- screens */

function drawChart(canvas: HTMLCanvasElement, inst: Instrument, trades: Trade[]) {
  const g = canvas.getContext('2d')
  if (!g) return
  const W = canvas.width
  const H = canvas.height
  g.fillStyle = PAL.screen
  g.fillRect(0, 0, W, H)
  header(g, W, `${inst.kind.toUpperCase()} · LAST TRADE`, 'SIMULATED')

  const last = trades[trades.length - 1]
  const prev = trades[trades.length - 2]
  const dir = last && prev ? Math.sign(last.price - prev.price) : 0
  const dirColor = dir > 0 ? PAL.up : dir < 0 ? PAL.down : PAL.text

  // Symbol block
  g.textBaseline = 'alphabetic'
  g.textAlign = 'left'
  g.fillStyle = PAL.text
  g.font = `700 58px ${MONO}`
  g.fillText(inst.symbol, 26, 112)
  g.fillStyle = PAL.muted
  g.font = `500 22px ${SANS}`
  g.fillText(inst.name, 28, 146)

  // Quote block
  g.textAlign = 'right'
  if (last) {
    g.fillStyle = dirColor
    g.font = `700 64px ${MONO}`
    const q = inst.px(last.price)
    g.fillText(q, W - 70, 114)
    // arrow
    g.beginPath()
    const ax = W - 44
    if (dir > 0) {
      g.moveTo(ax - 16, 104)
      g.lineTo(ax + 16, 104)
      g.lineTo(ax, 76)
    } else if (dir < 0) {
      g.moveTo(ax - 16, 78)
      g.lineTo(ax + 16, 78)
      g.lineTo(ax, 106)
    } else {
      g.rect(ax - 14, 86, 28, 8)
    }
    g.closePath()
    g.fill()
    g.fillStyle = PAL.muted
    g.font = `500 20px ${MONO}`
    const delta = prev ? last.price - prev.price : 0
    const dtxt = prev ? `${delta > 0 ? '+' : ''}${delta} tick${Math.abs(delta) === 1 ? '' : 's'}` : 'first trade'
    g.fillText(`${last.qty} ${inst.unit[last.qty === 1 ? 0 : 1]} · ${dtxt}`, W - 26, 146)
  } else {
    g.fillStyle = PAL.faint
    g.font = `700 64px ${MONO}`
    g.fillText(inst.px(100), W - 26, 114)
    g.font = `500 20px ${MONO}`
    g.fillText('awaiting first trade', W - 26, 146)
  }

  // Chart area
  const L = 120
  const R = W - 30
  const T = 176
  const B = H - 34
  const pts = trades.slice(-40).map((t) => t.price)
  const series = pts.length ? pts : [100, 100]
  let lo = Math.min(...series)
  let hi = Math.max(...series)
  if (hi - lo < 4) {
    const mid = (hi + lo) / 2
    lo = Math.floor(mid - 2)
    hi = Math.ceil(mid + 2)
  }
  const yOf = (p: number) => B - ((p - lo) / (hi - lo)) * (B - T)

  g.lineWidth = 1
  g.font = `500 17px ${MONO}`
  g.textAlign = 'right'
  g.textBaseline = 'middle'
  const step = Math.max(1, Math.ceil((hi - lo) / 5))
  for (let p = lo; p <= hi; p += step) {
    const y = Math.round(yOf(p)) + 0.5
    g.strokeStyle = PAL.grid
    g.beginPath()
    g.moveTo(L, y)
    g.lineTo(R, y)
    g.stroke()
    g.fillStyle = PAL.faint
    g.fillText(inst.px(p), L - 12, y)
  }

  const n = series.length
  const xOf = (i: number) => (n <= 1 ? R : L + (i / (n - 1)) * (R - L))
  const lineColor = pts.length ? (dir < 0 ? PAL.down : PAL.up) : PAL.faint

  // fill under the step line
  g.beginPath()
  g.moveTo(xOf(0), B)
  g.lineTo(xOf(0), yOf(series[0]))
  for (let i = 1; i < n; i++) {
    g.lineTo(xOf(i), yOf(series[i - 1]))
    g.lineTo(xOf(i), yOf(series[i]))
  }
  g.lineTo(xOf(n - 1), B)
  g.closePath()
  const grad = g.createLinearGradient(0, T, 0, B)
  grad.addColorStop(0, pts.length ? (dir < 0 ? 'rgba(242,132,141,0.22)' : 'rgba(127,214,155,0.22)') : 'rgba(111,120,132,0.12)')
  grad.addColorStop(1, 'rgba(0,0,0,0)')
  g.fillStyle = grad
  g.fill()

  // step line
  g.beginPath()
  g.moveTo(xOf(0), yOf(series[0]))
  for (let i = 1; i < n; i++) {
    g.lineTo(xOf(i), yOf(series[i - 1]))
    g.lineTo(xOf(i), yOf(series[i]))
  }
  g.strokeStyle = lineColor
  g.lineWidth = 3
  g.setLineDash(pts.length ? [] : [10, 8])
  g.stroke()
  g.setLineDash([])

  if (pts.length) {
    const x = xOf(n - 1)
    const y = yOf(series[n - 1])
    g.fillStyle = lineColor
    g.globalAlpha = 0.25
    g.beginPath()
    g.arc(x, y, 14, 0, Math.PI * 2)
    g.fill()
    g.globalAlpha = 1
    g.beginPath()
    g.arc(x, y, 6, 0, Math.PI * 2)
    g.fill()
  } else {
    g.fillStyle = PAL.faint
    g.font = `500 20px ${MONO}`
    g.textAlign = 'center'
    g.fillText('awaiting first trade', (L + R) / 2, yOf(100) - 22)
  }

  g.textAlign = 'left'
  g.textBaseline = 'alphabetic'
  g.fillStyle = PAL.faint
  g.font = `500 16px ${MONO}`
  g.fillText(pts.length ? `last ${pts.length} trades` : 'no trades yet', L, H - 10)

  screenFinish(g, W, H)
}

function drawQuotes(canvas: HTMLCanvasElement, inst: Instrument, trades: Trade[]) {
  const g = canvas.getContext('2d')
  if (!g) return
  const W = canvas.width
  const H = canvas.height
  g.fillStyle = PAL.screen
  g.fillRect(0, 0, W, H)
  header(g, W, 'QUOTE BOARD', 'TEACHING DATA')

  const last = trades[trades.length - 1]
  const prev = trades[trades.length - 2]
  const rowH = (H - 46 - 52) / INSTRUMENTS.length
  INSTRUMENTS.forEach((it, i) => {
    const y = 46 + i * rowH
    const cur = it.id === inst.id
    if (cur) {
      g.fillStyle = 'rgba(86,198,212,0.10)'
      g.fillRect(0, y, W, rowH)
      g.fillStyle = PAL.bid
      g.fillRect(0, y, 5, rowH)
    } else if (i % 2) {
      g.fillStyle = 'rgba(255,255,255,0.025)'
      g.fillRect(0, y, W, rowH)
    }
    const cy = y + rowH / 2
    g.textBaseline = 'middle'
    g.textAlign = 'left'
    g.fillStyle = cur ? PAL.text : PAL.muted
    g.font = `700 28px ${MONO}`
    g.fillText(it.symbol, 22, cy - 8)
    g.fillStyle = PAL.faint
    g.font = `500 16px ${SANS}`
    g.fillText(it.kind.toUpperCase(), 24, cy + 18)

    g.textAlign = 'right'
    let quote = it.px(100)
    let color: string = PAL.muted
    let note = 'indicative'
    if (cur) {
      if (last) {
        quote = it.px(last.price)
        const d = prev ? Math.sign(last.price - prev.price) : 0
        color = d > 0 ? PAL.up : d < 0 ? PAL.down : PAL.text
        note = 'last · sim'
      } else {
        color = PAL.text
        note = 'no trades'
      }
    }
    g.fillStyle = color
    g.font = `700 30px ${MONO}`
    g.fillText(quote, W - 22, cy - 8)
    g.fillStyle = PAL.faint
    g.font = `500 15px ${MONO}`
    g.fillText(note, W - 22, cy + 18)
  })

  g.fillStyle = PAL.faint
  g.font = `500 15px ${SANS}`
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillText('Not market data. Others shown at an indicative level.', W / 2, H - 26)

  screenFinish(g, W, H)
}

function drawParticipants(canvas: HTMLCanvasElement, trades: Trade[], logos: Map<string, HTMLImageElement>) {
  const g = canvas.getContext('2d')
  if (!g) return
  const W = canvas.width
  const H = canvas.height
  g.fillStyle = PAL.screen
  g.fillRect(0, 0, W, H)
  header(g, W, 'PARTICIPANTS', 'VOLUME · SIM')

  const vol = new Map<string, number>()
  for (const t of trades) {
    vol.set(t.makerTrader, (vol.get(t.makerTrader) ?? 0) + t.qty)
    vol.set(t.takerTrader, (vol.get(t.takerTrader) ?? 0) + t.qty)
  }
  const recent = new Set<string>()
  const lastTrade = trades[trades.length - 1]
  if (lastTrade) {
    recent.add(lastTrade.makerTrader)
    recent.add(lastTrade.takerTrader)
  }

  const cols = 3
  const rows = Math.ceil(FIRMS.length / cols)
  const pad = 14
  const top = 58
  const cw = (W - pad * (cols + 1)) / cols
  const ch = (H - top - pad * (rows + 1) + pad) / rows
  FIRMS.forEach((f, i) => {
    const x = pad + (i % cols) * (cw + pad)
    const y = top + Math.floor(i / cols) * (ch + pad)
    const hot = recent.has(f.name)
    // white card (logos are drawn for a light background)
    roundRect(g, x, y, cw, ch, 8)
    g.fillStyle = hot ? '#ffffff' : '#e7eaee'
    g.fill()
    if (hot) {
      g.strokeStyle = C.focus
      g.lineWidth = 4
      g.stroke()
    }
    // brand stripe
    g.fillStyle = f.color
    g.fillRect(x, y + 6, 6, ch - 12)

    const img = logos.get(f.name)
    const bw = cw - 34
    const bh = ch - 30
    if (img && img.naturalWidth) {
      const s = Math.min(bw / img.naturalWidth, bh / img.naturalHeight)
      const iw = img.naturalWidth * s
      const ih = img.naturalHeight * s
      g.drawImage(img, x + 14 + (bw - iw) / 2, y + 4 + (bh - ih) / 2, iw, ih)
    } else {
      g.fillStyle = '#20252c'
      g.font = `700 22px ${SANS}`
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      g.fillText(f.tag, x + 14 + bw / 2, y + 4 + bh / 2)
    }
    const v = vol.get(f.name) ?? 0
    g.font = `600 14px ${MONO}`
    g.textAlign = 'right'
    g.textBaseline = 'alphabetic'
    g.fillStyle = v ? '#2a3038' : '#9aa2ad'
    g.fillText(v ? `${v} traded` : '—', x + cw - 10, y + ch - 7)
  })

  screenFinish(g, W, H)
}

/** Loads the firm logos once (local files under /public/firms). */
function useLogos() {
  const [logos, setLogos] = useState<Map<string, HTMLImageElement>>(() => new Map())
  useEffect(() => {
    let alive = true
    const map = new Map<string, HTMLImageElement>()
    let pending = FIRMS.length
    const done = () => {
      pending -= 1
      if (pending === 0 && alive) setLogos(map)
    }
    for (const f of FIRMS) {
      const img = new Image()
      img.decoding = 'async'
      img.onload = () => {
        map.set(f.name, img)
        done()
      }
      img.onerror = done
      img.src = logoUrl(f)
    }
    return () => {
      alive = false
    }
  }, [])
  return logos
}

/* ----------------------------------------------------------------- ticker */

function tickerText(inst: Instrument, trades: Trade[]) {
  const tag = (name: string) => firmOf(name)?.name ?? name
  const items = trades
    .slice(-5)
    .reverse()
    .map((t) => {
      const arrow = t.takerSide === 'buy' ? '▲' : '▼'
      return `${arrow} ${inst.symbol} ${t.qty} @ ${inst.px(t.price)}  ${tag(t.takerTrader)} ← ${tag(t.makerTrader)}`
    })
  const parts = items.length
    ? items
    : [`${inst.symbol} ${inst.px(100)}  awaiting first trade`, 'send a market order to trade against the queues']
  return ['SIMULATED ORDERS FOR TEACHING', ...parts, 'every price level is a FIFO queue: first in, first filled']
}

const TICKER_H = 64
const TICKER_PLANE: [number, number] = [15.6, 0.34]

function buildTicker(inst: Instrument, trades: Trade[]) {
  const parts = tickerText(inst, trades)
  const font = `600 38px ${MONO}`
  const sep = '   •   '
  const probe = makeCanvas(8, 8).getContext('2d')!
  probe.font = font
  const full = parts.join(sep) + sep
  const planeAspect = TICKER_PLANE[0] / TICKER_PLANE[1]
  const minW = Math.ceil(planeAspect * TICKER_H)
  const width = Math.min(4096, Math.max(minW, Math.ceil(probe.measureText(full).width) + 8))
  const canvas = makeCanvas(width, TICKER_H)
  const g = canvas.getContext('2d')!
  g.fillStyle = '#050608'
  g.fillRect(0, 0, width, TICKER_H)
  g.font = font
  g.textBaseline = 'middle'
  let x = 4
  parts.forEach((p) => {
    const sim = p.startsWith('SIMULATED') || p.startsWith('every')
    g.fillStyle = sim ? C.focus : p.startsWith('▲') ? PAL.bid : p.startsWith('▼') ? PAL.ask : PAL.text
    g.fillText(p, x, TICKER_H / 2 + 2)
    x += g.measureText(p).width
    g.fillStyle = PAL.faint
    g.fillText(sep, x, TICKER_H / 2 + 2)
    x += g.measureText(sep).width
  })
  // LED dot mask
  g.fillStyle = 'rgba(0,0,0,0.35)'
  for (let yy = 0; yy < TICKER_H; yy += 4) g.fillRect(0, yy, width, 1)
  for (let xx = 0; xx < width; xx += 4) g.fillRect(xx, 0, 1, TICKER_H)

  const tex = makeTexture(canvas)
  tex.wrapS = THREE.RepeatWrapping
  tex.repeat.x = (planeAspect * TICKER_H) / width
  return tex
}

function Ticker({ inst, trades }: { inst: Instrument; trades: Trade[] }) {
  const tex = useMemo(() => buildTicker(inst, trades), [inst, trades])
  useEffect(() => () => tex.dispose(), [tex])
  const reduce = !!useReducedMotion()
  // Scroll at a constant speed in world units, whatever the text length.
  const speed = useMemo(() => tex.repeat.x * 0.06, [tex])
  // Distance scrolled so far, in canvas pixels, so a new trade does not snap
  // the ticker back to the start: the new texture carries on where it was.
  const scrolled = useRef(0)
  useLayoutEffect(() => {
    const width = tex.image.width as number
    tex.offset.x = (scrolled.current % width) / width
  }, [tex])
  useFrame((_, dt) => {
    if (reduce) return
    tex.offset.x = (tex.offset.x + Math.min(dt, 0.1) * speed) % 1
    scrolled.current = tex.offset.x * (tex.image.width as number)
  })
  return (
    <group position={[0, 0.42, -4.35]} rotation={[-0.32, 0, 0]}>
      <mesh position={[0, 0, -0.03]} geometry={GEO.box} material={MAT.bezel} scale={[TICKER_PLANE[0] + 0.24, TICKER_PLANE[1] + 0.14, 0.06]} />
      <mesh>
        <planeGeometry args={TICKER_PLANE} />
        <meshBasicMaterial map={tex} toneMapped={false} fog={false} />
      </mesh>
    </group>
  )
}

/* -------------------------------------------------------- shared geometry */

const GEO = {
  box: new THREE.BoxGeometry(1, 1, 1),
  plane: new THREE.PlaneGeometry(1, 1),
}
const MAT = {
  bezel: new THREE.MeshStandardMaterial({ color: '#0a0c10', roughness: 0.35, metalness: 0.6 }),
  frame: new THREE.MeshStandardMaterial({ color: '#151a21', roughness: 0.55, metalness: 0.5 }),
  desk: new THREE.MeshStandardMaterial({ color: '#171b22', roughness: 0.4, metalness: 0.35 }),
  deskTop: new THREE.MeshStandardMaterial({ color: '#232a33', roughness: 0.25, metalness: 0.55 }),
  monitorBack: new THREE.MeshStandardMaterial({ color: '#0c0e12', roughness: 0.5, metalness: 0.4 }),
  monBid: new THREE.MeshBasicMaterial({ color: new THREE.Color(C.bid).multiplyScalar(0.42), toneMapped: false }),
  monAsk: new THREE.MeshBasicMaterial({ color: new THREE.Color(C.ask).multiplyScalar(0.38), toneMapped: false }),
  monInk: new THREE.MeshBasicMaterial({ color: new THREE.Color('#9fb3c8').multiplyScalar(0.3), toneMapped: false }),
}

/* ------------------------------------------------------------- video wall */

function Screen({
  w,
  h,
  texture,
  position,
  rotation,
}: {
  w: number
  h: number
  texture: THREE.Texture
  position: [number, number, number]
  rotation: [number, number, number]
}) {
  return (
    <group position={position} rotation={rotation}>
      <mesh position={[0, 0, -0.06]} geometry={GEO.box} material={MAT.bezel} scale={[w + 0.18, h + 0.18, 0.1]} />
      <mesh position={[0, 0, 0.002]} geometry={GEO.plane} scale={[w, h, 1]}>
        <meshBasicMaterial map={texture} toneMapped={false} fog={false} />
      </mesh>
    </group>
  )
}

const TILT = -0.3

function VideoWall({ inst, trades }: { inst: Instrument; trades: Trade[] }) {
  const chart = useCanvasTexture(1024, 448)
  const quotes = useCanvasTexture(640, 400)
  const people = useCanvasTexture(640, 400)
  const logos = useLogos()

  useEffect(() => {
    drawChart(chart.canvas, inst, trades)
    chart.texture.needsUpdate = true
    drawQuotes(quotes.canvas, inst, trades)
    quotes.texture.needsUpdate = true
  }, [inst, trades, chart, quotes])

  useEffect(() => {
    drawParticipants(people.canvas, trades, logos)
    people.texture.needsUpdate = true
  }, [trades, logos, people])

  const cw = 6.2
  const ch = (cw * 448) / 1024
  const sw = 3.9
  const sh = (sw * 400) / 640

  return (
    <group>
      {/* back wall + support beam */}
      <mesh position={[0, 1.9, -6.6]} geometry={GEO.box} material={MAT.frame} scale={[22, 3.9, 0.2]} />
      <mesh position={[0, 0.12, -5.3]} geometry={GEO.box} material={MAT.frame} scale={[17, 0.24, 1.6]} />
      <Screen w={cw} h={ch} texture={chart.texture} position={[0, 1.95, -5.7]} rotation={[TILT, 0, 0]} />
      <Screen w={sw} h={sh} texture={quotes.texture} position={[-5.45, 1.75, -5.3]} rotation={[TILT, 0.36, 0.035]} />
      <Screen w={sw} h={sh} texture={people.texture} position={[5.45, 1.75, -5.3]} rotation={[TILT, -0.36, -0.035]} />
    </group>
  )
}

/* ----------------------------------------------------------------- desks */

const MON = [MAT.monBid, MAT.monInk, MAT.monAsk]

const DESK_Z = [-1.6, -3.6, -5.6]

function Desk({ side, z }: { side: 1 | -1; z: number }) {
  const x = side * 10.2
  // monitors face the centre of the room (towards x = 0)
  const face = -side * Math.PI * 0.5
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.36, 0]} geometry={GEO.box} material={MAT.desk} scale={[1.1, 0.72, 1.7]} />
      <mesh position={[0, 0.74, 0]} geometry={GEO.box} material={MAT.deskTop} scale={[1.2, 0.04, 1.8]} />
      {[-0.42, 0.42].map((dz, i) => (
        <group key={i} position={[side * 0.3, 1.02, dz]} rotation={[0, face, 0]}>
          <mesh geometry={GEO.box} material={MAT.monitorBack} scale={[0.72, 0.46, 0.04]} />
          <mesh
            position={[0, 0, 0.022]}
            geometry={GEO.plane}
            material={MON[(i + DESK_Z.indexOf(z) + (side > 0 ? 1 : 0)) % MON.length]}
            scale={[0.66, 0.4, 1]}
          />
        </group>
      ))}
    </group>
  )
}

function Desks() {
  return (
    <group>
      {([-1, 1] as const).map((side) => DESK_Z.map((z) => <Desk key={`${side}${z}`} side={side} z={z} />))}
    </group>
  )
}

/* ------------------------------------------------------------- lighting */

function FloorEnvironment() {
  return (
    <Environment resolution={256} background={false} frames={1} environmentIntensity={0.35}>
      <color attach="background" args={['#06070a']} />
      {/* soft overhead strip lights */}
      <Lightformer form="rect" intensity={1.4} color="#dfe8f2" position={[0, 6, 0]} rotation-x={Math.PI / 2} scale={[12, 1.2, 1]} />
      <Lightformer form="rect" intensity={0.9} color="#dfe8f2" position={[0, 6, -4]} rotation-x={Math.PI / 2} scale={[12, 0.8, 1]} />
      {/* the video wall glow behind, cool on one side, warm on the other */}
      <Lightformer form="rect" intensity={0.8} color={C.bid} position={[-5, 2, -8]} scale={[6, 2.5, 1]} />
      <Lightformer form="rect" intensity={0.7} color={C.ask} position={[5, 2, -8]} scale={[6, 2.5, 1]} />
      {/* faint fill from the front */}
      <Lightformer form="ring" intensity={0.4} color="#ffffff" position={[0, 3, 9]} scale={3} />
    </Environment>
  )
}

/* ------------------------------------------------------------------ main */

export function TradingFloor({ inst, trades }: { inst: Instrument; trades: Trade[] }) {
  return (
    <group>
      <FloorEnvironment />
      <VideoWall inst={inst} trades={trades} />
      <Ticker inst={inst} trades={trades} />
      <Desks />
    </group>
  )
}
