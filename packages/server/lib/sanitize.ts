/**
 * Sanitizes player-supplied text before it enters AI prompts or DB writes.
 *
 * Operations (in order):
 * 1. Trim leading/trailing whitespace
 * 2. Strip null bytes and non-printable ASCII control chars (0x00–0x1F) except \n and \r
 * 3. Strip zero-width and invisible Unicode characters
 * 4. Strip backticks (prompt injection via code-fence spoofing)
 * 5. Normalize \r\n and \r → \n
 * 6. Collapse runs of 3+ consecutive \n to \n\n (blocks fake === SYSTEM === header injection)
 * 7. Replace tabs with a single space
 * 8. Collapse runs of 2+ spaces to one space
 * 9. Truncate to maxLength (silent — no throw)
 */
export function sanitizeInput(raw: string, maxLength: number): string {
  return raw
    .trim()
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
    .replace(/[​-‏  ﻿­]/g, '')
    .replace(/`/g, '')
    .replace(/\r\n|\r/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\t/g, ' ')
    .replace(/ {2,}/g, ' ')
    .slice(0, maxLength)
}

export const LIMITS = {
  GM_MESSAGE: 500,
  CHARACTER_CREATOR_ANSWER: 500,
  CHARACTER_NAME: 100,
  BACKGROUND_PRIMARY: 300,
  PHYSICAL_DESCRIPTION: 500,
  BACKSTORY: 1500,
} as const
