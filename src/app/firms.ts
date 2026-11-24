/**
 * Real firms that trade on real exchanges, used as the names on simulated
 * orders. The orders themselves are made up: none of these firms placed
 * them. Logos are the firms' trademarks, from Wikimedia Commons / Wikipedia.
 */
export interface Firm {
  /** The name orders carry, e.g. "Goldman Sachs". */
  name: string
  /** Very short tag for tight spots (3D labels, tape). */
  tag: string
  /** Main brand colour. */
  color: string
  /** Logo file in /public/firms. */
  logo: string
}

export const FIRMS: Firm[] = [
  { name: 'Goldman Sachs', tag: 'GS', color: '#6f9fd8', logo: 'gs.png' },
  { name: 'J.P. Morgan', tag: 'JPM', color: '#8a6b4f', logo: 'jpm.png' },
  { name: 'Morgan Stanley', tag: 'MS', color: '#1b1b1b', logo: 'ms.png' },
  { name: 'Citadel Securities', tag: 'CDL', color: '#1e3a6e', logo: 'citadel.png' },
  { name: 'Bank of America', tag: 'BofA', color: '#e31837', logo: 'bofa.png' },
  { name: 'Citi', tag: 'C', color: '#255be3', logo: 'citi.png' },
  { name: 'Barclays', tag: 'BARC', color: '#00aeef', logo: 'barclays.png' },
  { name: 'UBS', tag: 'UBS', color: '#e60000', logo: 'ubs.png' },
  { name: 'Deutsche Bank', tag: 'DB', color: '#0018a8', logo: 'db.png' },
  { name: 'HSBC', tag: 'HSBC', color: '#db0011', logo: 'hsbc.png' },
  { name: 'Jane Street', tag: 'JS', color: '#111111', logo: 'janestreet.png' },
  { name: 'Virtu Financial', tag: 'VIRT', color: '#0f9a7a', logo: 'virtu.png' },
]

const byName = new Map(FIRMS.map((f) => [f.name, f]))

/** The firm behind a trader name, if it is one of ours. */
export function firmOf(name: string): Firm | undefined {
  return byName.get(name)
}

export function logoUrl(f: Firm): string {
  return `${import.meta.env.BASE_URL}firms/${f.logo}`
}
