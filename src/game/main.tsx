import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MotionConfig } from 'motion/react'
import './game.css'
import { Game } from './Game'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* "user" honours prefers-reduced-motion. */}
    <MotionConfig reducedMotion="user">
      <Game />
    </MotionConfig>
  </StrictMode>,
)
