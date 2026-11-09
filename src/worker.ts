import { makePuzzle, type Level, type Variant } from './music/generate'
import type { Species } from './music/exercise'

export interface PuzzleRequest {
  id: number
  day: string
  species: Species
  level: Level
  variant: Variant
}

self.onmessage = (e: MessageEvent<PuzzleRequest>) => {
  const { id, day, species, level, variant } = e.data
  self.postMessage({ id, puzzle: makePuzzle(day, species, level, variant) })
}
