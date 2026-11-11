import { useEffect, useReducer } from 'react'
import {
  canStepForward,
  createSession,
  pushCommand,
  stepBack,
  stepForward,
  type Command,
  type Session,
} from '@/engine/session'
import type { Priority, Side } from '@/engine/types'
import { FREE_PLAY_SEED, SCENARIOS } from './scenarios'

export type Skin = 'chips' | 'checkout'
export type Speed = 0.5 | 1 | 2
export type Mode = 'free' | (typeof SCENARIOS)[number]['id']

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
  | { type: 'predict'; on: boolean }
  | { type: 'guess'; orderId: number }
  | { type: 'continue' }
  | { type: 'mode'; mode: Mode }
  | { type: 'scenario-next' }
  | { type: 'dismiss-error' }

function seedFor(mode: Mode): Command[] {
  return mode === 'free' ? FREE_PLAY_SEED : SCENARIOS.find((s) => s.id === mode)!.seed
}

function fresh(mode: Mode): Pick<State, 'mode' | 'session' | 'scenarioStep' | 'playing' | 'prediction' | 'answered' | 'error'> {
  return {
    mode,
    session: createSession(seedFor(mode)),
    scenarioStep: 0,
    playing: false,
    prediction: null,
    answered: [],
    error: null,
  }
}

export const initialState: State = {
  ...fresh('free'),
  speed: 1,
  priority: 'fifo',
  skin: 'chips',
  predict: false,
}

/**
 * Advance one entry, unless Predict mode wants the learner to guess first.
 * The pause happens right before the first `peek` of each market order, so
 * the book shows the level being visited but not yet who trades.
 */
function advance(state: State): State {
  const s = state.session
  if (!canStepForward(s)) return { ...state, playing: false }
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
  return { ...state, session, playing: state.playing && canStepForward(session) }
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
      return advance({ ...state, playing: false })
    case 'back':
      if (state.prediction) return state
      return { ...state, playing: false, session: stepBack(state.session) }
    case 'play':
      if (state.prediction) return state
      if (!canStepForward(state.session)) return state
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
    case 'predict':
      return { ...state, predict: action.on, prediction: action.on ? state.prediction : null }
    case 'guess':
      if (!state.prediction || state.prediction.guess !== null) return state
      return { ...state, prediction: { ...state.prediction, guess: action.orderId } }
    case 'continue': {
      if (!state.prediction) return state
      const answered = [...state.answered, state.prediction.takerId]
      const session = stepForward(state.session)
      return { ...state, prediction: null, answered, session, playing: canStepForward(session) }
    }
    case 'mode':
      return { ...state, ...fresh(action.mode) }
    case 'scenario-next': {
      if (state.prediction) return state
      if (canStepForward(state.session)) return { ...state, playing: true }
      const scenario = SCENARIOS.find((s) => s.id === state.mode)
      if (!scenario || state.scenarioStep >= scenario.steps.length - 1) return state
      const scenarioStep = state.scenarioStep + 1
      const cmd = scenario.steps[scenarioStep].command
      const next = { ...state, scenarioStep }
      if (!cmd) return next
      return push(next, cmd.type === 'market' ? { ...cmd, priority: state.priority } : cmd)
    }
    case 'dismiss-error':
      return { ...state, error: null }
  }
}

const BASE_MS = 900

export function useController() {
  const [state, dispatch] = useReducer(reducer, initialState)
  const { playing, speed, session, prediction } = state

  useEffect(() => {
    if (!playing || prediction || !canStepForward(session)) return
    const next = session.log[session.cursor].event.kind
    const weight = next === 'fill' ? 1.25 : next === 'market-done' ? 1.1 : next === 'enqueue' ? 0.9 : 1
    const id = window.setTimeout(() => dispatch({ type: 'tick' }), (BASE_MS * weight) / speed)
    return () => window.clearTimeout(id)
  }, [playing, speed, session, prediction])

  return [state, dispatch] as const
}

export type Dispatch = ReturnType<typeof useController>[1]
