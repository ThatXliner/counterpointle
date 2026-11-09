import { makePuzzle, type Level } from './music/generate'
import type { Species } from './music/exercise'

export interface PuzzleRequest {
  id: number
  day: string
  species: Species
  level: Level
  hard: boolean
}

self.onmessage = (e: MessageEvent<PuzzleRequest>) => {
  const { id, day, species, level, hard } = e.data
  self.postMessage({ id, puzzle: makePuzzle(day, species, level, hard) })
}
