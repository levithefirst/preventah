/**
 * Household join codes.
 *
 * Six characters from an alphabet with no 0/O or 1/I, because these get
 * read aloud across a kitchen table. Generated in a mutation, where
 * Convex seeds Math.random per run, so a retried mutation does not
 * reproduce the same code.
 */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function makeJoinCode(): string {
  let code = '';
  for (let i = 0; i < 6; i += 1) {
    code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return code;
}

/**
 * Uppercases and strips anything the generator could not have produced.
 *
 * That includes I, O, 0 and 1, which the alphabet omits precisely because
 * they get misheard. Stripping them rather than mapping them is the
 * honest move: a code containing one was misheard, and a silent guess
 * would send someone into the wrong household.
 */
export function normalizeJoinCode(value: string): string {
  return value.toUpperCase().replace(/[^A-HJ-NP-Z2-9]/g, '').slice(0, 6);
}
