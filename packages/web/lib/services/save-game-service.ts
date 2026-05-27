/** A single turn in the GM conversation, as stored client-side before a save. */
export interface GmTurn {
  role: 'player' | 'gm';
  content: string;
}

/** Posts the current character ID and recent turns to the `/api/gm/save` endpoint. Throws on failure. */
export async function saveGame(characterId: string, recentTurns: GmTurn[]): Promise<void> {
  const res = await fetch('/api/gm/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ characterId, recentTurns }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(data.error ?? 'Save game failed');
  }
}
