import type { Species } from './music/exercise'

export const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V'] as const

export const SPECIES_INFO: Record<Species, { name: string; tagline: string; rules: string[] }> = {
  1: {
    name: 'First species',
    tagline: 'Note against note',
    rules: [
      'Every note is a consonance: unison, third, fifth, sixth, octave (or compounds).',
      'No more than three parallel thirds or sixths in a row.',
    ],
  },
  2: {
    name: 'Second species',
    tagline: 'Two against one',
    rules: [
      'Downbeats are consonant.',
      'The weak half may be dissonant only as a passing tone, stepping through in one direction.',
      'No fifths or octaves on consecutive downbeats.',
    ],
  },
  3: {
    name: 'Third species',
    tagline: 'Four against one',
    rules: [
      'Downbeats are consonant.',
      'Other quarters may be dissonant as a passing tone, a neighbor tone (step away and back), or a cambiata (step down onto the dissonance, leap down a third, step up).',
      'No fifths or octaves on consecutive downbeats.',
    ],
  },
  4: {
    name: 'Fourth species',
    tagline: 'Syncopation',
    rules: [
      'Each new note enters on the weak half as a consonance and is tied over the barline.',
      'If the tied note clashes on the downbeat, it is a suspension and must resolve down by step to a consonance.',
      'Above the cantus use 7–6, 4–3 or 9–8 suspensions; below it, 2–3 or 4–5.',
      'No fifths or octaves on consecutive upbeats or downbeats.',
    ],
  },
  5: {
    name: 'Fifth species',
    tagline: 'Florid',
    rules: [
      'The rhythm is given; each note follows the rules of its own value.',
      'Half notes behave like second species, quarters like third, ties like fourth.',
      'Eighth notes come in pairs and move by step.',
    ],
  },
}

export const GENERAL_RULES = [
  'Begin on a perfect consonance (unison, fifth or octave above the cantus; unison or octave below it).',
  'End on a unison or octave, reached from the leading tone. The leading tone is raised automatically in the second-to-last bar.',
  'No parallel or consecutive fifths and octaves, and no hidden ones: never move into a perfect interval in similar motion.',
  'Unisons only at the beginning and end (on downbeats).',
  "Don't cross the cantus, and stay within a twelfth of it.",
  'Melodic moves: seconds, thirds, perfect fourths and fifths, the rising minor sixth, the octave. No tritones, sevenths or augmented intervals.',
  'After a leap of a fifth or more, turn back the other way. Two leaps in one direction must outline a consonant chord; never three.',
  'No repeated notes, and keep the line within a tenth.',
]
