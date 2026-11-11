import { analyze, type Exercise, type Species } from './music/exercise'
import { completable, makePuzzle, type Level, type Variant } from './music/generate'

export type WorkerRequest =
  | { kind: 'puzzle'; day: string; species: Species; level: Level; variant: Variant }
  | { kind: 'completable'; exercise: Exercise; fixed: (number | null)[] }

export type WorkerReply = { id: number; result: unknown } | { id: number; error: string }

self.onmessage = (e: MessageEvent<{ id: number; req: WorkerRequest }>) => {
  const { id, req } = e.data
  try {
    const result =
      req.kind === 'puzzle'
        ? makePuzzle(req.day, req.species, req.level, req.variant)
        : completable(analyze(req.exercise), req.fixed)
    self.postMessage({ id, result } satisfies WorkerReply)
  } catch (err) {
    self.postMessage({ id, error: String(err) } satisfies WorkerReply)
  }
}
