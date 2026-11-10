import { analyze, type Exercise, type Species } from './music/exercise'
import { completable, makePuzzle, type Level, type Variant } from './music/generate'

export type WorkerRequest =
  | { kind: 'puzzle'; day: string; species: Species; level: Level; variant: Variant }
  | { kind: 'completable'; exercise: Exercise; fixed: (number | null)[] }

self.onmessage = (e: MessageEvent<{ id: number; req: WorkerRequest }>) => {
  const { id, req } = e.data
  const result =
    req.kind === 'puzzle'
      ? makePuzzle(req.day, req.species, req.level, req.variant)
      : completable(analyze(req.exercise), req.fixed)
  self.postMessage({ id, result })
}
