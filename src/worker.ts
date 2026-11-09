import { makePuzzle, type Level } from './music/generate'
import type { Species } from './music/exercise'

export interface PuzzleRequest {
  id: number
  day: string
  species: Species
  level: Level
}

self.onmessage = (e: MessageEvent<PuzzleRequest>) => {
  const { id, day, species, level } = e.data
  self.postMessage({ id, puzzle: makePuzzle(day, species, level) })
}
