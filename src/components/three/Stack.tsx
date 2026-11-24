import { Text, useTexture } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { Suspense, useLayoutEffect, useMemo, useRef, type RefObject } from 'react'
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import type { Look } from '@/app/instruments'
import { logoUrl, type Firm } from '@/app/firms'
import type { Side } from '@/engine/types'
import { C, D, W, monoFont, sideColor } from './theme'

/* ------------------------------------------------------------------ sizes

   One order is a tray in its side colour (cyan bid / amber ask) with the
   instrument stacked on it, one unit per unit of quantity (capped), and a
   white trade ticket lying on top naming the firm. */

export const TRAY_H = 0.11
export const MAX_UNITS = 12

/** Height of the tray plus its units for an order of `qty`. */
export function stackHeight(look: Look, qty: number): number {
  const n = Math.max(1, Math.min(qty, MAX_UNITS))
  switch (look) {
    case 'share':
      return TRAY_H + n * 0.1
    case 'bond':
      return TRAY_H + n * 0.055 + 0.005
    case 'bar':
      return TRAY_H + Math.ceil(n / 2) * 0.13
    case 'barrel':
      return TRAY_H + Math.ceil(n / 4) * 0.36
  }
}

/* ------------------------------------------------------------------ shared geometry (never disposed) */

const TRAY_GEO = new RoundedBoxGeometry(W, TRAY_H, D, 2, 0.02)
const TILE_GEO = new RoundedBoxGeometry(0.7, 0.075, 0.82, 2, 0.022)
const SHEET_GEO = new THREE.BoxGeometry(0.66, 0.04, 0.8)
const BAR_GEO = (() => {
  // a square frustum (4-sided cylinder), flat shaded, squashed into an ingot
  const g = new THREE.CylinderGeometry(Math.SQRT1_2 * 0.8, Math.SQRT1_2, 1, 4, 1).toNonIndexed()
  g.rotateY(Math.PI / 4)
  g.scale(0.34, 0.12, 0.8)
  g.computeVertexNormals()
  return g
})()
const DRUM_R = 0.17
const DRUM_H = 0.34
const DRUM_GEO = new THREE.CylinderGeometry(DRUM_R, DRUM_R, DRUM_H, 20)
const RIM_GEO = new THREE.CylinderGeometry(DRUM_R + 0.009, DRUM_R + 0.009, 0.024, 20)

export const TICKET_W = W * 0.86
export const TICKET_D = D * 0.82
const TICKET_T = 0.014
const TICKET_GEO = new THREE.BoxGeometry(TICKET_W, TICKET_T, TICKET_D)

/* ------------------------------------------------------------------ colours */

const PAPER = '#efe6cf'
const GOLD = '#d9a93a'
const STEEL = '#dfe4ea'
const lifted = new Map<string, string>()

/** Brand colour, lifted just enough that near-black brands still read on a dark floor. */
export function brandColor(hex: string | undefined): string {
  const key = hex ?? '#5d6773'
  let out = lifted.get(key)
  if (!out) {
    const c = new THREE.Color(key)
    const hsl = { h: 0, s: 0, l: 0 }
    c.getHSL(hsl)
    if (hsl.l < 0.28) c.setHSL(hsl.h, hsl.s, 0.28)
    out = `#${c.getHexString()}`
    lifted.set(key, out)
  }
  return out
}

function rimColor(brand: string): string {
  return `#${new THREE.Color(brand).lerp(new THREE.Color(STEEL), 0.6).getHexString()}`
}

/** Deterministic noise in [0, 1) from an order id and a unit index. */
function hash(a: number, b: number): number {
  const x = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453
  return x - Math.floor(x)
}

/* ------------------------------------------------------------------ stack */

const tmp = new THREE.Object3D()
const tmpColor = new THREE.Color()

/**
 * The units of one order on their tray. Geometry is shared; materials are per
 * order so a glow (written into `emissive.current` by the owner) lights only
 * this order.
 */
export function Stack({
  look,
  qty,
  side,
  brand,
  seed,
  glow,
  emissive,
}: {
  look: Look
  qty: number
  side: Side
  /** Firm brand colour (already passed through brandColor). */
  brand: string
  /** Stable per-order number for the little paper jitter. */
  seed: number
  glow: string
  emissive: RefObject<number>
}) {
  const n = Math.max(1, Math.min(qty, MAX_UNITS))
  const units = useRef<THREE.InstancedMesh>(null!)
  const rims = useRef<THREE.InstancedMesh>(null)
  const trayMat = useRef<THREE.MeshStandardMaterial>(null!)
  const unitMat = useRef<THREE.MeshStandardMaterial>(null!)
  const rimMat = useRef<THREE.MeshStandardMaterial>(null)

  useLayoutEffect(() => {
    const m = units.current
    const r = rims.current
    let rimCount = 0
    for (let i = 0; i < n; i++) {
      tmp.rotation.set(0, 0, 0)
      tmp.scale.set(1, 1, 1)
      if (look === 'share') {
        tmp.position.set(0, TRAY_H + 0.01 + 0.0375 + i * 0.1, 0)
      } else if (look === 'bond') {
        tmp.position.set((hash(seed, i) - 0.5) * 0.035, TRAY_H + 0.02 + i * 0.055, (hash(seed, i + 40) - 0.5) * 0.03)
        tmp.rotation.y = (hash(seed, i + 80) - 0.5) * 0.14
        const shade = 0.93 + 0.07 * hash(seed, i + 120)
        m.setColorAt(i, tmpColor.setRGB(shade, shade, shade * 0.98))
      } else if (look === 'bar') {
        const layer = Math.floor(i / 2)
        tmp.position.set(i % 2 === 0 ? -0.19 : 0.19, TRAY_H + 0.06 + layer * 0.13, 0)
      } else {
        const layer = Math.floor(i / 4)
        const s = i % 4
        const y = TRAY_H + DRUM_H / 2 + layer * 0.36
        const x = s % 2 === 0 ? -0.19 : 0.19
        const z = s < 2 ? 0.21 : -0.21
        tmp.position.set(x, y, z)
        if (r) {
          for (const dy of [-0.11, 0.11]) {
            tmp.position.set(x, y + dy, z)
            tmp.updateMatrix()
            r.setMatrixAt(rimCount++, tmp.matrix)
          }
          tmp.position.set(x, y, z)
        }
      }
      tmp.updateMatrix()
      m.setMatrixAt(i, tmp.matrix)
    }
    m.count = n
    m.instanceMatrix.needsUpdate = true
    if (m.instanceColor) m.instanceColor.needsUpdate = true
    if (r) {
      r.count = rimCount
      r.instanceMatrix.needsUpdate = true
    }
  }, [look, n, seed])

  useFrame(() => {
    const e = emissive.current ?? 0
    trayMat.current.emissiveIntensity = e
    unitMat.current.emissiveIntensity = look === 'bar' ? e * 0.6 : e
    if (rimMat.current) rimMat.current.emissiveIntensity = e * 0.5
  })

  const geo = look === 'share' ? TILE_GEO : look === 'bond' ? SHEET_GEO : look === 'bar' ? BAR_GEO : DRUM_GEO
  const unitColor = look === 'bond' ? PAPER : look === 'bar' ? GOLD : brand

  return (
    <group>
      {/* a glowing pad in the side colour, so buy vs sell reads at a glance */}
      <mesh rotation-x={-Math.PI / 2} position-y={0.004} dispose={null}>
        <planeGeometry args={[W + 0.14, D + 0.14]} />
        <meshBasicMaterial color={sideColor(side)} transparent opacity={0.55} toneMapped={false} depthWrite={false} />
      </mesh>
      <mesh geometry={TRAY_GEO} position-y={TRAY_H / 2} castShadow receiveShadow dispose={null}>
        <meshStandardMaterial
          ref={trayMat}
          color={sideColor(side)}
          emissive={glow}
          emissiveIntensity={0}
          roughness={0.45}
          metalness={0.1}
        />
      </mesh>
      <instancedMesh
        key={look}
        ref={units}
        args={[geo, undefined, MAX_UNITS]}
        castShadow
        receiveShadow
        frustumCulled={false}
        dispose={null}
      >
        {look === 'bar' ? (
          <meshStandardMaterial ref={unitMat} color={unitColor} emissive={glow} emissiveIntensity={0} metalness={1} roughness={0.3} />
        ) : look === 'bond' ? (
          <meshStandardMaterial ref={unitMat} color={unitColor} emissive={glow} emissiveIntensity={0} roughness={0.95} metalness={0} />
        ) : look === 'barrel' ? (
          <meshStandardMaterial ref={unitMat} color={unitColor} emissive={glow} emissiveIntensity={0} roughness={0.45} metalness={0.35} />
        ) : (
          <meshStandardMaterial ref={unitMat} color={unitColor} emissive={glow} emissiveIntensity={0} roughness={0.35} metalness={0.15} />
        )}
      </instancedMesh>
      {look === 'barrel' && (
        <instancedMesh ref={rims} args={[RIM_GEO, undefined, MAX_UNITS * 2]} castShadow frustumCulled={false} dispose={null}>
          <meshStandardMaterial ref={rimMat} color={rimColor(brand)} emissive={glow} emissiveIntensity={0} metalness={0.85} roughness={0.32} />
        </instancedMesh>
      )}
    </group>
  )
}

/* ------------------------------------------------------------------ ticket */

/** A firm logo on an XY plane, fit inside maxW x maxH at the logo's own aspect. */
export function LogoPlane({
  firm,
  maxW,
  maxH,
  fade,
  tag,
}: {
  firm: Firm
  maxW: number
  maxH: number
  fade?: RefObject<number>
  /** For very wide wordmarks, also print the firm's short tag large. */
  tag?: boolean
}) {
  const tex = useTexture(logoUrl(firm))
  useLayoutEffect(() => {
    if (tex.colorSpace !== THREE.SRGBColorSpace) {
      tex.colorSpace = THREE.SRGBColorSpace
      tex.anisotropy = 4
      tex.needsUpdate = true
    }
  }, [tex])
  const [w, h, wide] = useMemo(() => {
    const img = tex.image as { width?: number; height?: number } | undefined
    const a = img?.width && img?.height ? img.width / img.height : 3
    // Long wordmarks (J.P. Morgan, Citadel, BofA) would shrink to a hairline:
    // give them the full width, and the tag above does the reading.
    if (tag && a > 7) return [maxW * 1.08, (maxW * 1.08) / a, true] as const
    return a > maxW / maxH ? ([maxW, maxW / a, false] as const) : ([maxH * a, maxH, false] as const)
  }, [tex, maxW, maxH, tag])
  const mat = useRef<THREE.MeshBasicMaterial>(null!)
  useFrame(() => {
    if (fade) mat.current.opacity = fade.current ?? 1
  })
  const logo = (
    <mesh position-y={wide ? -maxH * 0.32 : 0}>
      <planeGeometry args={[w, h]} />
      <meshBasicMaterial ref={mat} map={tex} transparent alphaTest={0.02} toneMapped={false} depthWrite={false} />
    </mesh>
  )
  if (!wide) return logo
  return (
    <group>
      <Text font={monoFont} position-y={maxH * 0.12} fontSize={maxH * 0.62} color={firm.color} anchorX="center" anchorY="middle">
        {firm.tag}
      </Text>
      {logo}
    </group>
  )
}

/**
 * The trade ticket lying on top of a stack: white card, the firm's brand
 * colour along the far edge, its logo, and "#id · qty" near the viewer.
 * Its origin is the bottom-centre of the card.
 */
export function Ticket({ firm, label, fade }: { firm: Firm | undefined; label: string; fade?: RefObject<number> }) {
  const card = useRef<THREE.MeshStandardMaterial>(null!)
  const strip = useRef<THREE.MeshBasicMaterial>(null!)
  const text = useRef<THREE.Mesh & { fillOpacity: number }>(null!)
  useFrame(() => {
    if (!fade) return
    const o = fade.current ?? 1
    card.current.opacity = o
    strip.current.opacity = o
    if (text.current) text.current.fillOpacity = o
  })
  const top = TICKET_T + 0.002
  return (
    <group>
      <mesh geometry={TICKET_GEO} position-y={TICKET_T / 2} castShadow receiveShadow dispose={null}>
        <meshStandardMaterial
          ref={card}
          color="#f7f6f1"
          emissive="#ffffff"
          emissiveIntensity={0.12}
          roughness={0.75}
          transparent={!!fade}
        />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, top, -TICKET_D / 2 + 0.045]}>
        <planeGeometry args={[TICKET_W, 0.09]} />
        <meshBasicMaterial ref={strip} color={firm?.color ?? C.faint} toneMapped={false} transparent={!!fade} />
      </mesh>
      {firm && (
        <group rotation-x={-Math.PI / 2} position={[0, top + 0.001, -0.05]}>
          <Suspense fallback={null}>
            <LogoPlane firm={firm} maxW={TICKET_W * 0.88} maxH={0.3} fade={fade} tag />
          </Suspense>
        </group>
      )}
      <Text
        ref={text}
        font={monoFont}
        rotation-x={-Math.PI / 2}
        position={[0, top + 0.002, TICKET_D / 2 - 0.13]}
        fontSize={label.length > 9 ? 0.12 : 0.145}
        color="#191c21"
        anchorX="center"
        anchorY="middle"
      >
        {label}
      </Text>
    </group>
  )
}
