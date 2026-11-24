/** Best stars per level, kept in this browser only. */
const KEY = 'ftr-stars'

export function loadStars(): Record<number, number> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<number, number>
  } catch {
    return {}
  }
}

export function saveStars(level: number, stars: number): Record<number, number> {
  const all = loadStars()
  all[level] = Math.max(all[level] ?? 0, stars)
  try {
    localStorage.setItem(KEY, JSON.stringify(all))
  } catch {
    /* blocked storage: progress lasts for this visit only */
  }
  return all
}
