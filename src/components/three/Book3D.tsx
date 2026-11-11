import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Billboard, ContactShadows, Edges, Html, OrbitControls, RoundedBox, Text } from '@react-three/drei'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useReducedMotion } from 'motion/react'
import * as THREE from 'three'
import monoFont from '@fontsource/jetbrains-mono/files/jetbrains-mono-latin-600-normal.woff?url'
import type { BookSnapshot, LogEntry, Order, Side, Taker } from '@/engine/types'
import type { Prediction } from '@/app/useController'
import { focusOf } from '@/components/Book'
import { clock } from '@/lib/utils'

/* ------------------------------------------------------------------ layout

   Seen from the front, every price level is one row. Bids queue up on the
   left, asks on the right, and every queue's HEAD faces the middle aisle,
   where market orders arrive and walk to the best price.

        tail ... head | 99  ·  101 | head ... tail      <- best prices (front)
        tail ... head | 98  ·  102 | head ... tail
        ...
*/

const C = {
  bid: '#56c6d4',
  ask: '#f2a65e',
  focus: '#ffe58a',
  good: '#7fd69b',
  bad: '#f2848d',
  ground: '#0f1114',
  lane: '#1b2027',
  ink: '#eef1f4',
  muted: '#aab2bd',
  faint: '#6f7884',
}
const ROW = 1.45
const HEAD_X = 1.95
const SLOT = 1.0
const MAX_SHOWN = 6
const W = 0.8
const D = 0.92
const FRONT_Z = 2 * ROW
const ARRIVE: [number, number, number] = [0, 0.55, FRONT_Z + 1.55]

const sign = (side: Side) => (side === 'buy' ? -1 : 1)
const rowZ = (i: number) => (2 - i) * ROW
const slotX = (side: Side, k: number) => sign(side) * (HEAD_X + k * SLOT)
const heightOf = (qty: number) => 0.2 + Math.min(qty, 20) * 0.075
const sideColor = (side: Side) => (side === 'buy' ? C.bid : C.ask)
const damp = THREE.MathUtils.damp

export interface LaneId {
  side: Side
  price: number
}

interface Props {
  book: BookSnapshot
  entry: LogEntry | null
  prediction: Prediction | null
  onGuess: (id: number) => void
  lane: LaneId | null
  onLane: (lane: LaneId) => void
}

export default function Book3D(props: Props) {
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ position: [0, 8, 12], fov: 36, near: 0.1, far: 80 }}
      aria-hidden
      style={{ touchAction: 'pan-y' }}
    >
      <color attach="background" args={[C.ground]} />
      <fog attach="fog" args={[C.ground, 20, 38]} />
      <ambientLight intensity={0.5} />
      <hemisphereLight args={['#c8d6e5', '#0b0d10', 0.45]} />
      <directionalLight
        position={[3, 11, 7]}
        intensity={1.5}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-12}
        shadow-camera-right={12}
        shadow-camera-top={8}
        shadow-camera-bottom={-8}
      />
      <Rig />
      <Scene {...props} />
    </Canvas>
  )
}

/** Fit the whole book to the canvas width; the viewer can then orbit a little. */
function Rig() {
  const { camera, size } = useThree()
  const coarse = useMemo(() => typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches, [])
  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera
    const aspect = size.width / Math.max(1, size.height)
    const halfV = THREE.MathUtils.degToRad(cam.fov / 2)
    const needW = 9.3 / (Math.tan(halfV) * aspect)
    const needH = 4.4 / Math.tan(halfV)
    const dist = THREE.MathUtils.clamp(Math.max(needW, needH), 9, 34)
    const elev = THREE.MathUtils.degToRad(47)
    cam.position.set(0, Math.sin(elev) * dist, Math.cos(elev) * dist + 1.5)
    cam.lookAt(0, 0, 1.5)
    cam.updateProjectionMatrix()
  }, [camera, size.width, size.height])
  return (
    <OrbitControls
      target={[0, 0, 1.5]}
      enablePan={false}
      enableZoom={false}
      enableRotate={!coarse}
      enableDamping
      minPolarAngle={0.35}
      maxPolarAngle={1.2}
      minAzimuthAngle={-0.75}
      maxAzimuthAngle={0.75}
    />
  )
}

function Scene({ book, entry, prediction, onGuess, lane, onLane }: Props) {
  const reduce = !!useReducedMotion()
  const focus = focusOf(entry)
  const ev = entry?.event
  // The lane the current step is about (or the one the viewer pinned).
  const active: LaneId | null =
    ev?.kind === 'enqueue'
      ? { side: ev.order.side, price: ev.order.price }
      : focus.makerSide && focus.price !== null
        ? { side: focus.makerSide, price: focus.price }
        : null
  const predictLane: LaneId | null = prediction
    ? { side: prediction.takerSide === 'buy' ? 'sell' : 'buy', price: prediction.price }
    : null

  const rows = [0, 1, 2, 3, 4]
  const bestBid = book.bids.find((l) => l.orders.length)?.price
  const bestAsk = book.asks.find((l) => l.orders.length)?.price

  return (
    <group>
      <Floor />
      {rows.map((i) => (
        <group key={i}>
          {(['buy', 'sell'] as const).map((side) => {
            const level = (side === 'buy' ? book.bids : book.asks)[i]
            if (!level) return null
            const isActive = !!active && active.side === side && active.price === level.price
            const isPinned = !!lane && lane.side === side && lane.price === level.price
            const isPredict = !!predictLane && predictLane.side === side && predictLane.price === level.price
            return (
              <Lane
                key={side}
                side={side}
                row={i}
                price={level.price}
                orders={level.orders}
                best={(side === 'buy' ? bestBid : bestAsk) === level.price}
                highlight={isPredict ? 'predict' : isActive ? 'active' : isPinned ? 'pinned' : null}
                entry={entry}
                prediction={isPredict ? prediction : null}
                onGuess={onGuess}
                onSelect={() => onLane({ side, price: level.price })}
                reduce={reduce}
              />
            )
          })}
        </group>
      ))}
      <Legend />
      <Gone entry={entry} book={book} reduce={reduce} />
      <TakerToken entry={entry} book={book} reduce={reduce} />
      <TradeBurst entry={entry} book={book} reduce={reduce} />
      <ContactShadows position={[0, 0.002, 0.5]} scale={[24, 12]} opacity={0.45} blur={2.2} far={3} frames={reduce ? 1 : Infinity} />
    </group>
  )
}

/* ------------------------------------------------------------------ floor */

function Floor() {
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.01, 0.6]} receiveShadow>
        <planeGeometry args={[40, 24]} />
        <meshStandardMaterial color="#12161b" roughness={1} />
      </mesh>
      {/* the aisle where market orders walk */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.001, 0.6]}>
        <planeGeometry args={[0.06, 8.6]} />
        <meshBasicMaterial color={C.faint} transparent opacity={0.5} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[ARRIVE[0], 0.003, ARRIVE[2]]}>
        <ringGeometry args={[0.42, 0.48, 48]} />
        <meshBasicMaterial color={C.faint} transparent opacity={0.8} />
      </mesh>
      <FlatText position={[0, 0.004, ARRIVE[2] + 0.75]} size={0.17} color={C.faint}>
        MARKET ORDERS ENTER
      </FlatText>
    </group>
  )
}

function Legend() {
  const z = FRONT_Z + 0.95
  return (
    <group>
      <FlatText position={[-(HEAD_X + 3 * SLOT), 0.004, z]} size={0.3} color={C.bid}>
        BIDS · buyers in line
      </FlatText>
      <FlatText position={[-(HEAD_X + 3 * SLOT), 0.004, z + 0.45]} size={0.17} color={C.muted}>
        {'join at tail  ›››  trade at head'}
      </FlatText>
      <FlatText position={[HEAD_X + 3 * SLOT, 0.004, z]} size={0.3} color={C.ask}>
        ASKS · sellers in line
      </FlatText>
      <FlatText position={[HEAD_X + 3 * SLOT, 0.004, z + 0.45]} size={0.17} color={C.muted}>
        {'trade at head  ‹‹‹  join at tail'}
      </FlatText>
    </group>
  )
}

function FlatText({
  children,
  position,
  size,
  color,
  anchorX = 'center',
}: {
  children: string
  position: [number, number, number]
  size: number
  color: string
  anchorX?: 'left' | 'center' | 'right'
}) {
  return (
    <Text
      font={monoFont}
      position={position}
      rotation-x={-Math.PI / 2}
      fontSize={size}
      color={color}
      anchorX={anchorX}
      anchorY="middle"
    >
      {children}
    </Text>
  )
}

/* ------------------------------------------------------------------ lanes */

type Highlight = 'active' | 'pinned' | 'predict' | null

function Lane({
  side,
  row,
  price,
  orders,
  best,
  highlight,
  entry,
  prediction,
  onGuess,
  onSelect,
  reduce,
}: {
  side: Side
  row: number
  price: number
  orders: Order[]
  best: boolean
  highlight: Highlight
  entry: LogEntry | null
  prediction: Prediction | null
  onGuess: (id: number) => void
  onSelect: () => void
  reduce: boolean
}) {
  const z = rowZ(row)
  const s = sign(side)
  const laneLen = MAX_SHOWN * SLOT + 0.3
  const laneX = s * (HEAD_X - 0.65 + laneLen / 2)
  const shown = orders.length > MAX_SHOWN ? orders.slice(0, MAX_SHOWN - 1) : orders
  const hidden = orders.length - shown.length
  const focus = focusOf(entry)
  const ev = entry?.event
  const matStrip = useRef<THREE.MeshBasicMaterial>(null!)
  const target = highlight === 'predict' ? 0.5 : highlight === 'active' ? 0.34 : highlight === 'pinned' ? 0.24 : 0.1
  useFrame((st, dt) => {
    const pulse = highlight === 'predict' && !reduce ? 0.12 * Math.sin(st.clock.elapsedTime * 5) : 0
    matStrip.current.opacity = damp(matStrip.current.opacity, target + pulse, 8, dt)
  })
  const tint = highlight === 'predict' ? C.focus : sideColor(side)
  const n = orders.length
  const tailK = Math.min(n, MAX_SHOWN) - 1

  return (
    <group>
      {/* lane floor strip: click to inspect this queue */}
      <mesh
        rotation-x={-Math.PI / 2}
        position={[laneX, 0.002, z]}
        onClick={(e) => {
          e.stopPropagation()
          onSelect()
        }}
        onPointerOver={() => (document.body.style.cursor = 'pointer')}
        onPointerOut={() => (document.body.style.cursor = '')}
      >
        <planeGeometry args={[laneLen, D + 0.3]} />
        <meshBasicMaterial ref={matStrip} color={tint} transparent opacity={0.1} depthWrite={false} />
      </mesh>

      {/* price label in the middle aisle */}
      <FlatText position={[s * 0.72, 0.004, z]} size={best ? 0.46 : 0.38} color={best ? sideColor(side) : C.muted}>
        {String(price)}
      </FlatText>

      {/* HEAD and TAIL marks on the floor in front of the queue */}
      {n > 0 && (
        <FlatText position={[slotX(side, 0), 0.004, z + D / 2 + 0.2]} size={0.15} color={highlight ? C.ink : C.faint}>
          HEAD
        </FlatText>
      )}
      {n > 1 && hidden === 0 && (
        <FlatText position={[slotX(side, tailK), 0.004, z + D / 2 + 0.2]} size={0.15} color={highlight ? C.ink : C.faint}>
          TAIL
        </FlatText>
      )}

      {/* where the next order would join */}
      {(highlight === 'active' || highlight === 'pinned') && n < MAX_SHOWN && (
        <mesh position={[slotX(side, n), 0.3, z]}>
          <boxGeometry args={[W, 0.6, D]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          <Edges color={C.faint} />
        </mesh>
      )}

      {shown.map((o, k) => {
        let state: BlockState = 'idle'
        if (focus.orderId === o.id) state = ev?.kind === 'fill' ? 'fill' : 'peek'
        if (ev?.kind === 'enqueue' && ev.order.id === o.id) state = 'joined'
        if (prediction && prediction.guess !== null) {
          if (o.id === prediction.correctId) state = 'right'
          else if (o.id === prediction.guess) state = 'wrong'
        }
        return (
          <Block
            key={o.id}
            order={o}
            side={side}
            x={slotX(side, k)}
            z={z}
            state={state}
            reduce={reduce}
            clickable={!!prediction && prediction.guess === null}
            onClick={() => (prediction && prediction.guess === null ? onGuess(o.id) : onSelect())}
          />
        )
      })}
      {hidden > 0 && (
        <Billboard position={[slotX(side, MAX_SHOWN - 1), 0.5, z]}>
          <Text font={monoFont} fontSize={0.3} color={C.muted}>{`+${hidden}`}</Text>
        </Billboard>
      )}
    </group>
  )
}

/* ------------------------------------------------------------------ blocks */

type BlockState = 'idle' | 'peek' | 'fill' | 'joined' | 'right' | 'wrong'

function Block({
  order,
  side,
  x,
  z,
  state,
  reduce,
  clickable,
  onClick,
}: {
  order: Order
  side: Side
  x: number
  z: number
  state: BlockState
  reduce: boolean
  clickable: boolean
  onClick: () => void
}) {
  const group = useRef<THREE.Group>(null!)
  const body = useRef<THREE.Mesh>(null!)
  const top = useRef<THREE.Group>(null!)
  const front = useRef<THREE.Group>(null!)
  const mat = useRef<THREE.MeshStandardMaterial>(null!)
  const h = heightOf(order.qty)
  // New orders drop in from above (at the tail, where they belong).
  const cur = useRef({ x, z, y: reduce ? 0 : 3.4, h })
  const [hover, setHover] = useState(false)
  const glow =
    state === 'right' ? C.good : state === 'wrong' ? C.bad : state === 'peek' || state === 'fill' ? C.focus : '#ffffff'

  useFrame((st, dt) => {
    const c = cur.current
    const k = reduce ? 1e3 : 8
    c.x = damp(c.x, x, k, dt)
    c.z = damp(c.z, z, k, dt)
    c.y = damp(c.y, 0, reduce ? 1e3 : 6, dt)
    c.h = damp(c.h, h, reduce ? 1e3 : 6, dt)
    group.current.position.set(c.x, c.y, c.z)
    body.current.scale.y = c.h
    body.current.position.y = c.h / 2
    top.current.position.y = c.h + 0.003
    front.current.position.y = c.h / 2
    let e = 0
    if (state === 'peek') e = 0.45 + (reduce ? 0 : 0.3 * Math.sin(st.clock.elapsedTime * 9))
    else if (state === 'fill') e = 0.95
    else if (state === 'right' || state === 'wrong') e = 0.8
    else if (state === 'joined') e = 0.35
    else if (hover) e = clickable ? 0.55 : 0.25
    mat.current.emissiveIntensity = damp(mat.current.emissiveIntensity, e, 10, dt)
  })

  return (
    <group ref={group}>
      <RoundedBox
        ref={body}
        args={[W, 1, D]}
        radius={0.05}
        smoothness={3}
        castShadow
        receiveShadow
        onClick={(e) => {
          e.stopPropagation()
          onClick()
        }}
        onPointerOver={(e) => {
          e.stopPropagation()
          setHover(true)
          document.body.style.cursor = 'pointer'
        }}
        onPointerOut={() => {
          setHover(false)
          document.body.style.cursor = ''
        }}
      >
        <meshStandardMaterial
          ref={mat}
          color={sideColor(side)}
          emissive={glow}
          emissiveIntensity={0}
          roughness={0.5}
          metalness={0.05}
        />
      </RoundedBox>
      {/* order id on the lid */}
      <group ref={top}>
        <Text font={monoFont} rotation-x={-Math.PI / 2} fontSize={0.21} color="#0f1114" anchorX="center" anchorY="middle">
          {`#${order.id}`}
        </Text>
      </group>
      {/* shares on the front face */}
      <group ref={front}>
        <Text font={monoFont} position={[0, 0, D / 2 + 0.003]} fontSize={0.2} color="#0f1114" anchorX="center" anchorY="middle">
          {String(order.qty)}
        </Text>
      </group>
      {hover && (
        <Html position={[0, h + 0.55, 0]} center zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
          <div className="whitespace-nowrap rounded-lg bg-raised px-2.5 py-1.5 text-[12px] leading-tight text-ink shadow-lg">
            <b className="font-semibold">#{order.id}</b> {order.trader} · {order.qty} sh
            <div className="tnum text-faint">arrived {clock(order.time)}</div>
          </div>
        </Html>
      )}
    </group>
  )
}

/** An order that was just dequeued floats up and fades out. */
function Gone({ entry, book, reduce }: { entry: LogEntry | null; book: BookSnapshot; reduce: boolean }) {
  const ev = entry?.event
  if (!entry || ev?.kind !== 'dequeue' || reduce) return null
  const levels = ev.order.side === 'buy' ? book.bids : book.asks
  const row = levels.findIndex((l) => l.price === ev.price)
  const left = levels[row]?.orders.length ?? 0
  const k = ev.end === 'head' ? 0 : Math.min(left, MAX_SHOWN - 1)
  return <GoneBlock key={entry.seq} side={ev.order.side} x={slotX(ev.order.side, k)} z={rowZ(row)} />
}

function GoneBlock({ side, x, z }: { side: Side; x: number; z: number }) {
  const g = useRef<THREE.Group>(null!)
  const m = useRef<THREE.MeshStandardMaterial>(null!)
  const t = useRef(0)
  useFrame((_, dt) => {
    t.current = Math.min(1, t.current + dt / 0.75)
    const p = t.current
    g.current.position.y = 0.15 + p * 2.2
    g.current.scale.setScalar(1 - 0.5 * p)
    m.current.opacity = 1 - p
  })
  return (
    <group ref={g} position={[x, 0.15, z]}>
      <mesh>
        <boxGeometry args={[W, 0.3, D]} />
        <meshStandardMaterial ref={m} color={sideColor(side)} emissive={C.focus} emissiveIntensity={0.8} transparent />
      </mesh>
    </group>
  )
}

/* ------------------------------------------------------------------ taker */

function takerTarget(entry: LogEntry, book: BookSnapshot): { pos: [number, number, number]; gone: boolean } {
  const ev = entry.event
  const rowOf = (side: Side, price: number) =>
    (side === 'buy' ? book.bids : book.asks).findIndex((l) => l.price === price)
  switch (ev.kind) {
    case 'market-arrive':
      return { pos: ARRIVE, gone: false }
    case 'visit-level':
    case 'level-empty':
      return { pos: [0, 0.55, rowZ(rowOf(ev.makerSide, ev.price))], gone: false }
    case 'peek':
    case 'fill':
    case 'dequeue': {
      const makerSide: Side = ev.taker.side === 'buy' ? 'sell' : 'buy'
      const price = ev.kind === 'fill' ? ev.trade.price : ev.kind === 'peek' ? ev.order.price : ev.price
      const row = rowOf(makerSide, price)
      const n = (makerSide === 'buy' ? book.bids : book.asks)[row]?.orders.length ?? 0
      const end = ev.end
      if (end === 'head') return { pos: [sign(makerSide) * (HEAD_X - 0.6), 0.95, rowZ(row)], gone: false }
      // LIFO: hop over the line to its back end
      const k = Math.min(Math.max(n - 1, 0), MAX_SHOWN - 1)
      return { pos: [slotX(makerSide, k), 1.95, rowZ(row)], gone: false }
    }
    default:
      return { pos: ARRIVE, gone: true }
  }
}

function TakerToken({ entry, book, reduce }: { entry: LogEntry | null; book: BookSnapshot; reduce: boolean }) {
  const ev = entry?.event
  const taker: Taker | null = entry?.taker ?? (ev?.kind === 'market-done' ? ev.taker : null)
  if (!entry || !taker) return null
  return <Token key={taker.id} taker={taker} target={takerTarget(entry, book)} reduce={reduce} />
}

function Token({
  taker,
  target,
  reduce,
}: {
  taker: Taker
  target: { pos: [number, number, number]; gone: boolean }
  reduce: boolean
}) {
  const g = useRef<THREE.Group>(null!)
  const cur = useRef({ x: ARRIVE[0], y: ARRIVE[1] + 1.5, z: ARRIVE[2] + 1, s: 0 })
  useFrame((st, dt) => {
    const c = cur.current
    const k = reduce ? 1e3 : 6
    c.x = damp(c.x, target.pos[0], k, dt)
    c.y = damp(c.y, target.pos[1], k, dt)
    c.z = damp(c.z, target.pos[2], k, dt)
    c.s = damp(c.s, target.gone ? 0 : 1, k, dt)
    const bob = reduce ? 0 : Math.sin(st.clock.elapsedTime * 3) * 0.05
    g.current.position.set(c.x, c.y + bob, c.z)
    g.current.scale.setScalar(Math.max(0.001, c.s))
  })
  const color = sideColor(taker.side)
  return (
    <group ref={g}>
      <mesh castShadow>
        <icosahedronGeometry args={[0.32, 2]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.9} roughness={0.25} />
      </mesh>
      <pointLight color={color} intensity={3} distance={3.2} />
      <Billboard position={[0, 0.72, 0]}>
        <Text font={monoFont} fontSize={0.24} color={C.ink} outlineWidth={0.02} outlineColor={C.ground}>
          {`${taker.side === 'buy' ? 'MARKET BUY' : 'MARKET SELL'} ${taker.remaining}`}
        </Text>
      </Billboard>
    </group>
  )
}

/* ------------------------------------------------------------------ trade burst */

function TradeBurst({ entry, book, reduce }: { entry: LogEntry | null; book: BookSnapshot; reduce: boolean }) {
  const ev = entry?.event
  if (!entry || ev?.kind !== 'fill') return null
  const makerSide: Side = ev.trade.takerSide === 'buy' ? 'sell' : 'buy'
  const levels = makerSide === 'buy' ? book.bids : book.asks
  const row = levels.findIndex((l) => l.price === ev.trade.price)
  const n = levels[row]?.orders.length ?? 1
  const k = ev.end === 'head' ? 0 : Math.min(n - 1, MAX_SHOWN - 1)
  return (
    <Burst
      key={entry.seq}
      x={slotX(makerSide, k)}
      z={rowZ(row)}
      label={`${ev.trade.qty} @ ${ev.trade.price}`}
      reduce={reduce}
    />
  )
}

function Burst({ x, z, label, reduce }: { x: number; z: number; label: string; reduce: boolean }) {
  const ring = useRef<THREE.Mesh>(null!)
  const ringMat = useRef<THREE.MeshBasicMaterial>(null!)
  const text = useRef<THREE.Group>(null!)
  const t = useRef(reduce ? 0.6 : 0)
  useFrame((_, dt) => {
    t.current = Math.min(1, t.current + dt / 1.1)
    const p = t.current
    ring.current.scale.setScalar(0.6 + p * 1.8)
    ringMat.current.opacity = 0.9 * (1 - p)
    text.current.position.y = 2.0 + p * 0.7
  })
  return (
    <group position={[x, 0, z]}>
      <mesh ref={ring} rotation-x={-Math.PI / 2} position={[0, 0.02, 0]}>
        <ringGeometry args={[0.55, 0.65, 48]} />
        <meshBasicMaterial ref={ringMat} color={C.focus} transparent depthWrite={false} />
      </mesh>
      <group ref={text}>
        <Billboard>
          <Text font={monoFont} fontSize={0.3} color={C.focus} outlineWidth={0.025} outlineColor={C.ground}>
            {`TRADE ${label}`}
          </Text>
        </Billboard>
      </group>
    </group>
  )
}
