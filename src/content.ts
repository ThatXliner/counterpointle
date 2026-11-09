import type { Species } from './music/exercise'
import type { Rulebook } from './music/rules'

export const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V'] as const

export const SPECIES_INFO: Record<Species, { name: string; tagline: string; rules: string[] }> = {
  1: {
    name: 'First species',
    tagline: 'Note against note',
    rules: [
      'Every note is a consonance: unison, third, fifth, sixth, octave (or compounds). Fourths count as dissonant.',
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

/** Species rules where the AP rulebook differs from Fux. */
export const AP_SPECIES_RULES: Partial<Record<Species, string[]>> = {
  1: ['Every note is a consonance: unison, third, fifth, sixth, octave (or compounds). Fourths count as dissonant.'],
  2: [
    'Downbeats are consonant.',
    'The weak half may be dissonant as a passing tone (step through) or a neighbor tone (step away and back).',
    'No fifths or octaves on consecutive downbeats ("beat-to-beat").',
  ],
}

const FRAME = [
  'Begin on a perfect consonance (unison, fifth or octave above the cantus; unison or octave below it).',
  'End on a unison or octave, reached from the leading tone. In minor and the modes it is raised for you in the second-to-last bar.',
]

export const RULEBOOK_NAME: Record<Rulebook, string> = {
  ap: 'AP Music Theory voice leading',
  fux: "Fux's Gradus ad Parnassum",
}

export const GENERAL_RULES: Record<Rulebook, string[]> = {
  ap: [
    ...FRAME,
    'No parallel fifths or octaves, and none by contrary motion either.',
    'Moving into a fifth or octave in similar motion is fine only if the upper voice moves by step.',
    'A diminished fifth may not move to a perfect fifth.',
    "Don't cross the cantus or overlap it (move past the note it just left).",
    'A leading tone that belongs to the harmony (a consonance) rises by step to the tonic, and is never doubled.',
    'No more than three thirds or three sixths in a row.',
    'The upper voice moves by seconds, thirds, perfect fourths and fifths. The bass may also leap a sixth or an octave (then turn back), or fall a diminished fifth (then step up).',
    'Two leaps in one direction must outline a triad. A note may repeat only from a downbeat.',
  ],
  fux: [
    ...FRAME,
    'No parallel or consecutive fifths and octaves, and no hidden ones: never move into a perfect interval in similar motion.',
    'Unisons only at the beginning and end (on downbeats).',
    "Don't cross the cantus, and stay within a twelfth of it.",
    'Melodic moves: seconds, thirds, perfect fourths and fifths, the rising minor sixth, the octave. No tritones, sevenths or augmented intervals.',
    'After a leap of a fifth or more, turn back the other way. Two leaps in one direction must outline a consonant chord; never three.',
    'No repeated notes, and keep the line within a tenth.',
  ],
}
