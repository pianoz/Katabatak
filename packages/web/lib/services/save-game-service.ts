export interface GmTurn {
  role: 'player' | 'gm';
  content: string;
}

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
