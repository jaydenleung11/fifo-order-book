import { useEffect, useReducer } from 'react'
import {
  canStepForward,
  createSession,
  currentBook,
  pushCommand,
  stepBack,
  stepForward,
  trimSession,
  type Command,
  type Session,
} from '@/engine/session'
import type { Priority, Side } from '@/engine/types'
import { FREE_PLAY_SEED, SCENARIOS } from './scenarios'
import { nextOrder } from './simulate'

export type Skin = 'chips' | 'checkout'
export type View = '3d' | 'flat' | 'ladder'
export type Speed = 0.5 | 1 | 2 | 4
/** live: endless simulated order flow. free: build your own. */
export type Mode = 'live' | 'free' | (typeof SCENARIOS)[number]['id']

export const isScenario = (m: Mode) => m !== 'live' && m !== 'free'

export interface Prediction {
  takerId: number
  takerSide: Side
  correctId: number
  price: number
  guess: number | null
}

export interface State {
  mode: Mode
  session: Session
  scenarioStep: number
  playing: boolean
  speed: Speed
  priority: Priority
  skin: Skin
  view: View
  /** PRNG state for the live simulation */
  rng: number
  predict: boolean
  prediction: Prediction | null
  /** takers whose prediction has been answered */
  answered: number[]
  error: string | null
}

export type NewOrder =
  | { type: 'limit'; side: Side; price: number; qty: number }
  | { type: 'market'; side: Side; qty: number }

type Action =
  | { type: 'submit'; order: NewOrder }
  | { type: 'tick' }
  | { type: 'step' }
  | { type: 'back' }
  | { type: 'play' }
  | { type: 'pause' }
  | { type: 'reset' }
  | { type: 'speed'; speed: Speed }
  | { type: 'priority'; priority: Priority }
  | { type: 'skin'; skin: Skin }
  | { type: 'view'; view: View }
  | { type: 'predict'; on: boolean }
  | { type: 'guess'; orderId: number }
  | { type: 'continue' }
  | { type: 'mode'; mode: Mode }
  | { type: 'scenario-next' }
  | { type: 'dismiss-error' }

function seedFor(mode: Mode): Command[] {
  return mode === 'free' || mode === 'live' ? FREE_PLAY_SEED : SCENARIOS.find((s) => s.id === mode)!.seed
}

function fresh(mode: Mode): Pick<State, 'mode' | 'session' | 'scenarioStep' | 'playing' | 'prediction' | 'answered' | 'error'> {
  return {
    mode,
    session: createSession(seedFor(mode)),
    scenarioStep: 0,
    // Live and guided modes start moving on their own; build waits for you.
    playing: mode !== 'free',
    prediction: null,
    answered: [],
    error: null,
  }
}

export const initialState: State = {
  ...fresh('live'),
  speed: 1,
  priority: 'fifo',
  skin: 'chips',
  view: '3d',
  rng: 20261201,
  predict: false,
}

/**
 * Advance one entry, unless Predict mode wants the learner to guess first.
 * The pause happens right before the first `peek` of each market order, so
 * the book shows the level being visited but not yet who trades.
 */
function advance(state: State): State {
  let s = state.session
  if (!canStepForward(s)) {
    if (state.mode === 'live') {
      // Caught up: invent the next order and keep going.
      const { command, seed } = nextOrder(currentBook(s), state.priority, state.rng)
      try {
        s = trimSession(pushCommand(s, command))
      } catch {
        return { ...state, rng: seed }
      }
      return advance({ ...state, session: s, rng: seed })
    }
    if (isScenario(state.mode) && state.playing) return scenarioNext(state)
    return { ...state, playing: false }
  }
  const next = s.log[s.cursor].event
  if (
    state.predict &&
    next.kind === 'peek' &&
    !state.answered.includes(next.taker.id) &&
    state.prediction === null
  ) {
    return {
      ...state,
      playing: false,
      prediction: {
        takerId: next.taker.id,
        takerSide: next.taker.side,
        correctId: next.order.id,
        price: next.order.price,
        guess: null,
      },
    }
  }
  if (state.prediction !== null) return state
  const session = stepForward(s)
  const keepGoing = state.mode === 'live' || isScenario(state.mode) || canStepForward(session)
  return { ...state, session, playing: state.playing && keepGoing }
}

function scenarioNext(state: State): State {
  const scenario = SCENARIOS.find((s) => s.id === state.mode)
  if (!scenario || state.scenarioStep >= scenario.steps.length - 1) return { ...state, playing: false }
  const scenarioStep = state.scenarioStep + 1
  const cmd = scenario.steps[scenarioStep].command
  const next = { ...state, scenarioStep }
  if (!cmd) return next
  return push(next, cmd.type === 'market' ? { ...cmd, priority: state.priority } : cmd)
}

function push(state: State, cmd: Command): State {
  try {
    const session = pushCommand(state.session, cmd)
    return { ...state, session, playing: true, error: null }
  } catch (err) {
    return { ...state, error: err instanceof Error ? err.message : String(err) }
  }
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'submit': {
      const o = action.order
      const cmd: Command = o.type === 'market' ? { ...o, priority: state.priority } : o
      return push(state, cmd)
    }
    case 'tick':
      return state.playing ? advance(state) : state
    case 'step':
      if (isScenario(state.mode) && !canStepForward(state.session)) return scenarioNext({ ...state, playing: false })
      return advance({ ...state, playing: false })
    case 'back':
      if (state.prediction) return state
      return { ...state, playing: false, session: stepBack(state.session) }
    case 'play':
      if (state.prediction) return state
      if (state.mode === 'free' && !canStepForward(state.session)) return state
      return { ...state, playing: true }
    case 'pause':
      return { ...state, playing: false }
    case 'reset':
      return { ...state, ...fresh(state.mode) }
    case 'speed':
      return { ...state, speed: action.speed }
    case 'priority':
      return { ...state, priority: action.priority }
    case 'skin':
      return { ...state, skin: action.skin }
    case 'view':
      return { ...state, view: action.view }
    case 'predict':
      return { ...state, predict: action.on, prediction: action.on ? state.prediction : null }
    case 'guess':
      if (!state.prediction || state.prediction.guess !== null) return state
      return { ...state, prediction: { ...state.prediction, guess: action.orderId } }
    case 'continue': {
      if (!state.prediction) return state
      const answered = [...state.answered, state.prediction.takerId]
      const session = stepForward(state.session)
      return { ...state, prediction: null, answered, session, playing: state.mode !== 'free' || canStepForward(session) }
    }
    case 'mode':
      return { ...state, ...fresh(action.mode) }
    case 'scenario-next': {
      if (state.prediction) return state
      if (canStepForward(state.session)) return { ...state, playing: true }
      return scenarioNext(state)
    }
    case 'dismiss-error':
      return { ...state, error: null }
  }
}

const BASE_MS = 850
/** Pause on each guided caption before moving on by itself. */
const CAPTION_MS = 3400

const MODES: Mode[] = ['live', 'free', ...SCENARIOS.map((s) => s.id)]
const hashFor = (m: Mode) => (m === 'live' ? '' : m === 'free' ? '#build' : '#' + m)
const modeFromHash = (h: string): Mode | null => {
  if (h === '') return 'live'
  if (h === 'build') return 'free'
  return MODES.includes(h) ? h : null
}

function reducedMotion() {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

/** The mode lives in the URL hash (#sweep, #build), so it can be linked to. */
function initFromHash(): State {
  const h = typeof window === 'undefined' ? '' : window.location.hash.slice(1)
  const mode = modeFromHash(h) ?? 'live'
  // With reduced motion, nothing moves until you press Play or Step.
  // Phones get the flat view first; the 3D book needs a wide screen.
  const view = typeof window !== 'undefined' && window.innerWidth < 760 ? 'flat' : '3d'
  return { ...initialState, ...fresh(mode), view, playing: mode !== 'free' && !reducedMotion() }
}

export function useController() {
  const [state, dispatch] = useReducer(reducer, undefined, initFromHash)

  useEffect(() => {
    const want = hashFor(state.mode)
    if (window.location.hash !== want) {
      history.replaceState(null, '', want || window.location.pathname + window.location.search)
    }
  }, [state.mode])

  useEffect(() => {
    const onHash = () => {
      const mode = modeFromHash(window.location.hash.slice(1))
      if (mode) dispatch({ type: 'mode', mode })
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const { playing, speed, session, prediction, mode } = state

  useEffect(() => {
    if (!playing || prediction) return
    let ms: number
    if (canStepForward(session)) {
      const next = session.log[session.cursor].event.kind
      const weight = next === 'fill' ? 1.25 : next === 'market-done' ? 1.1 : next === 'enqueue' ? 0.8 : 1
      ms = BASE_MS * weight
    } else if (mode === 'live') ms = BASE_MS * 0.6
    else if (isScenario(mode)) ms = CAPTION_MS
    else return
    const id = window.setTimeout(() => dispatch({ type: 'tick' }), ms / speed)
    return () => window.clearTimeout(id)
  }, [playing, speed, session, prediction, mode])

  return [state, dispatch] as const
}

export type Dispatch = ReturnType<typeof useController>[1]
