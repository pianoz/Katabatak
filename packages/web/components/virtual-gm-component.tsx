"use client"

import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { Send, Terminal, Sparkles, User, Loader2, Dice1, Zap, Sun, Moon, X, Trash2, ShieldOff } from 'lucide-react';
import { useCharacterStore } from '@/features/characters/hooks/use-character-store';
import { useApiKey } from '@/hooks/use-api-key';

// ─── Sky Tracker ──────────────────────────────────────────────────────────────

function getSkyBackground(hours: number): string {
  if (hours < 5 || hours >= 22) return 'linear-gradient(180deg, #04040b 0%, #0c0c1a 50%, #04040b 100%)';
  if (hours < 7)  return 'linear-gradient(180deg, #09091a 0%, #1c0f08 65%, #09091a 100%)';
  if (hours < 9)  return 'linear-gradient(180deg, #09091a 0%, #2e1806 70%, #09091a 100%)';
  if (hours < 17) return 'linear-gradient(180deg, #0c1220 0%, #111e2e 55%, #0c1220 100%)';
  if (hours < 19) return 'linear-gradient(180deg, #0c1220 0%, #2e1508 70%, #0c1220 100%)';
  if (hours < 21) return 'linear-gradient(180deg, #0d0b1c 0%, #22091e 65%, #0d0b1c 100%)';
  return 'linear-gradient(180deg, #04040b 0%, #0c0c1a 50%, #04040b 100%)';
}

function SkyTracker({ gameTimeMinutes, gameDateDays }: { gameTimeMinutes: number; gameDateDays: number }) {
  const hours = Math.floor(gameTimeMinutes / 60);
  const mins = gameTimeMinutes % 60;
  const positionPct = (gameTimeMinutes / 1440) * 100;
  const isDay = hours >= 6 && hours < 20;
  const timeStr = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;

  return (
    <div
      className="relative w-full overflow-hidden border-b border-zinc-900"
      style={{ height: '56px', background: getSkyBackground(hours) }}
    >
      {/* Stars — night only */}
      {!isDay && (
        <>
          <span className="absolute top-2 left-[9%]  w-0.5 h-0.5 rounded-full bg-white/45" />
          <span className="absolute top-4 left-[22%] w-px  h-px  rounded-full bg-white/30" />
          <span className="absolute top-1 left-[40%] w-0.5 h-0.5 rounded-full bg-white/50" />
          <span className="absolute top-5 left-[58%] w-px  h-px  rounded-full bg-white/35" />
          <span className="absolute top-2 left-[74%] w-0.5 h-0.5 rounded-full bg-white/40" />
          <span className="absolute top-3 left-[88%] w-px  h-px  rounded-full bg-white/25" />
        </>
      )}

      {/* Celestial body */}
      <div
        className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 transition-[left] duration-700 ease-linear"
        style={{ left: `${positionPct}%` }}
      >
        {isDay ? (
          <div className="relative flex items-center justify-center">
            <div className="absolute w-8 h-8 rounded-full bg-amber-400/20 blur-md" />
            <Sun className="relative w-4 h-4 text-amber-300" />
          </div>
        ) : (
          <div className="relative flex items-center justify-center">
            <div className="absolute w-6 h-6 rounded-full bg-blue-300/10 blur-md" />
            <Moon className="relative w-3.75 h-3.75 text-blue-100/80" />
          </div>
        )}
      </div>

      {/* Time readout */}
      <div className="absolute bottom-1.5 left-4 flex items-center gap-3">
        <span className="text-[8px] uppercase tracking-[0.3em] text-zinc-600 font-mono">Day {gameDateDays}</span>
        <span className="text-[8px] uppercase tracking-[0.3em] text-zinc-500 font-mono">{timeStr}</span>
      </div>
    </div>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface Message {
  id: string;
  role: 'player' | 'gm';
  content: string;
  senderName: string;
  timestamp: Date;
}

interface PendingCheck {
  difficulty: number;
  pool: 'Power' | 'Essence' | 'Will';
  check_description: string;
  originalMessage: string;
  basePoolValue: number;
}

function poolToStoreKey(pool: 'Power' | 'Essence' | 'Will'): 'power' | 'will' | 'essence' {
  return pool.toLowerCase() as 'power' | 'will' | 'essence'
}

interface ChatGMProps {
  playerName: string;
  characterId: string;
  gameId?: string;
  isSyncing?: boolean;
  isDev?: boolean;
  onGMReply?: () => void;
  onClose?: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ChatGMComponent({
  playerName = "Wanderer",
  characterId,
  gameId,
  isSyncing = false,
  isDev = false,
  onGMReply,
  onClose,
}: ChatGMProps) {
  const isDirty = useCharacterStore((s) => s.isDirty);
  const gmBlocked = isDirty || isSyncing;
  const { apiKey } = useApiKey();

  const [gameTimeMinutes, setGameTimeMinutes] = useState(1020); // 17:00 default matches DB default
  const [gameDateDays, setGameDateDays]       = useState(1);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'gm',
      senderName: 'The Architect',
      content: "Begin your adventure.",
      timestamp: new Date(),
    }
  ]);
  const [ledgerNeutered, setLedgerNeutered] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [isGMLoading, setIsGMLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState<string | null>(null);
  const [pendingCheck, setPendingCheck] = useState<PendingCheck | null>(null);
  const [poolContributed, setPoolContributed] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isGMLoading, streamingContent]);

  useEffect(() => {
    if (!characterId) return;
    fetch(`/api/gm/turns?characterId=${characterId}&limit=3`)
      .then((r) => r.json())
      .then(({ turns, game_time_minutes, game_date_days }: {
        turns?: Array<{ role: 'player' | 'assistant'; content: string }>;
        game_time_minutes?: number | null;
        game_date_days?: number | null;
      }) => {
        if (turns?.length) {
          const loaded: Message[] = turns.map((t, i) => ({
            id: `history-${i}`,
            role: t.role === 'assistant' ? 'gm' : 'player',
            senderName: t.role === 'assistant' ? 'The Architect' : playerName,
            content: t.content,
            timestamp: new Date(),
          }));
          setMessages(loaded);
        }
        if (game_time_minutes != null) setGameTimeMinutes(game_time_minutes);
        if (game_date_days   != null) setGameDateDays(game_date_days);
      })
      .catch(() => {});
  }, [characterId]);

  const toggleNeuterLedger = async () => {
    const next = !ledgerNeutered;
    try {
      await fetch('/api/dev/neuter-ledger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: next }),
      });
      setLedgerNeutered(next);
    } catch (err) {
      console.error('[DEV] toggleNeuterLedger error:', err);
    }
  };

  const dumpHistory = async () => {
    if (!confirm('Delete all conversation history for this character? This cannot be undone.')) return;
    try {
      await fetch('/api/dev/conversation-history', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ characterId }),
      });
      setMessages([{
        id: Date.now().toString(),
        role: 'gm',
        senderName: 'The Architect',
        content: 'Conversation history cleared.',
        timestamp: new Date(),
      }]);
    } catch (err) {
      console.error('[DEV] dumpHistory error:', err);
    }
  };

  const sendToGM = async (message: string, checkResolution?: { choice: 'spend' | 'roll'; pool: string; roll_result?: number; pool_contributed?: number; succeeded?: boolean }) => {
    setIsGMLoading(true);
    setStreamingContent('');

    try {
      const gmHeaders: Record<string, string> = { 'Content-Type': 'application/json' }
      if (apiKey) gmHeaders['X-Anthropic-Key'] = apiKey

      const res = await fetch('/api/gm', {
        method: 'POST',
        headers: gmHeaders,
        body: JSON.stringify({
          message,
          characterId,
          gameId,
          checkResolution,
        }),
      });

      if (!res.ok) {
        throw new Error(`Server error ${res.status}`);
      }

      const contentType = res.headers.get('content-type') ?? '';

      // Check interruption — server returned JSON, not a stream
      if (!contentType.includes('text/event-stream')) {
        const data = await res.json() as { type?: string; difficulty?: number; pool?: string; check_description?: string };
        if (data.type === 'check_required') {
          const pool = (data.pool ?? 'Power') as PendingCheck['pool'];
          const storeState = useCharacterStore.getState();
          const basePoolValue = storeState[poolToStoreKey(pool)]?.current ?? 0;
          setPoolContributed(0);
          setPendingCheck({
            difficulty: data.difficulty ?? 10,
            pool,
            check_description: data.check_description ?? 'Attempting a difficult task',
            originalMessage: message,
            basePoolValue,
          });
          setStreamingContent(null);
          return;
        }
        return;
      }

      // SSE streaming
      const reader = res.body?.getReader();
      if (!reader) return;

      const decoder = new TextDecoder();
      let buffer = '';
      let fullText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop() ?? '';

        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith('data:')) continue;
          const json = line.slice(5).trim();
          try {
            const payload = JSON.parse(json) as { chunk?: string; done?: boolean; error?: string };
            if (payload.error) throw new Error(payload.error);
            if (payload.done) break;
            if (payload.chunk) {
              fullText += payload.chunk;
              setStreamingContent(fullText);
            }
          } catch {
            // malformed SSE line — skip
          }
        }
      }

      if (fullText) {
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          role: 'gm',
          senderName: 'The Architect',
          content: fullText,
          timestamp: new Date(),
        }]);
        // Advance game time by 10 minutes per turn (mirrors server TIME_INCREMENT)
        setGameTimeMinutes(prev => {
          const next = prev + 10;
          if (next >= 1440) {
            setGameDateDays(d => d + 1);
            return next % 1440;
          }
          return next;
        });
        onGMReply?.();
      }
    } catch (err) {
      console.error('[GM] fetch error:', err);
    } finally {
      setIsGMLoading(false);
      setStreamingContent(null);
    }
  };

  const handleSend = async () => {
    if (!inputValue.trim() || isGMLoading || gmBlocked) return;

    const content = inputValue.trim();
    setInputValue('');
    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      role: 'player',
      senderName: playerName,
      content,
      timestamp: new Date(),
    }]);

    await sendToGM(content);
  };

  const handleAddPool = () => {
    if (!pendingCheck || poolContributed >= pendingCheck.basePoolValue) return;
    const next = poolContributed + 1;
    setPoolContributed(next);
    useCharacterStore.getState().updatePool(poolToStoreKey(pendingCheck.pool), pendingCheck.basePoolValue - next);
  };

  const handleRemovePool = () => {
    if (!pendingCheck || poolContributed <= 0) return;
    const next = poolContributed - 1;
    setPoolContributed(next);
    useCharacterStore.getState().updatePool(poolToStoreKey(pendingCheck.pool), pendingCheck.basePoolValue - next);
  };

  const resolveCheck = async (autoSucceed: boolean) => {
    if (!pendingCheck) return;
    const { originalMessage, pool, difficulty, basePoolValue } = pendingCheck;
    const contributed = poolContributed;
    const totalBase = basePoolValue + contributed;

    setPendingCheck(null);
    setPoolContributed(0);

    const rollResult = autoSucceed ? undefined : Math.floor(Math.random() * 20) + 1;
    const succeeded = autoSucceed || (totalBase + (rollResult ?? 0)) >= difficulty;

    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      role: 'player',
      senderName: playerName,
      content: autoSucceed
        ? `[Guaranteed — base ${totalBase}${contributed > 0 ? ` (${contributed} contributed)` : ''} vs difficulty ${difficulty}]`
        : `[Roll: ${rollResult} | Total: ${totalBase + rollResult!} vs ${difficulty} — ${succeeded ? 'SUCCESS' : 'FAILURE'}]`,
      timestamp: new Date(),
    }]);

    await sendToGM(originalMessage, {
      choice: autoSucceed ? 'spend' : 'roll',
      pool,
      ...(rollResult !== undefined ? { roll_result: rollResult } : {}),
      pool_contributed: contributed,
      succeeded,
    });
  };

  return (
    <div className="flex flex-col h-full w-full bg-zinc-950 font-sans text-zinc-200 overflow-hidden">
      {/* Sky Tracker */}
      <SkyTracker gameTimeMinutes={gameTimeMinutes} gameDateDays={gameDateDays} />

      {/* Header */}
      <header className="h-14 border-b border-zinc-800 flex items-center px-6 bg-zinc-900/50 backdrop-blur-md shrink-0">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-cyan-500" />
          <span className="text-xs uppercase tracking-[0.3em] font-bold text-zinc-400">SYNGEM</span>
          <span className="text-[9px] uppercase tracking-[0.2em] text-zinc-700 ml-1">Chronicle</span>
        </div>
        <div className="ml-auto flex items-center gap-4">
          {isDev && (
            <button
              onClick={toggleNeuterLedger}
              disabled={isGMLoading}
              title="[DEV] Suppress ledger DB writes"
              className={`flex items-center gap-1 text-[10px] uppercase tracking-widest disabled:opacity-30 transition-colors ${ledgerNeutered ? 'text-amber-400' : 'text-zinc-600 hover:text-zinc-400'}`}
            >
              <ShieldOff className="w-3 h-3" />
              Neuter Ledger
            </button>
          )}
          {isDev && (
            <button
              onClick={dumpHistory}
              disabled={isGMLoading}
              title="[DEV] Dump conversation history"
              className="flex items-center gap-1 text-[10px] uppercase tracking-widest text-red-700 hover:text-red-400 disabled:opacity-30 transition-colors"
            >
              <Trash2 className="w-3 h-3" />
              Dump History
            </button>
          )}
          {gmBlocked && (
            <span className="text-[10px] uppercase tracking-widest text-amber-500/70 flex items-center gap-1">
              Syncing…
            </span>
          )}
          <div className={`w-2 h-2 rounded-full ${isGMLoading ? 'bg-cyan-500 animate-pulse' : 'bg-emerald-500'}`} />
          <span className="text-[10px] uppercase tracking-widest text-zinc-500">
            {isGMLoading ? 'Processing...' : 'Ready'}
          </span>
          {onClose && (
            <button
              onClick={onClose}
              className="ml-2 text-zinc-600 hover:text-zinc-300 transition-colors"
              aria-label="Close SYNGEM"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </header>

      {/* Message Area */}
      <div className="relative flex-1 overflow-hidden">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-linear-to-b from-zinc-950 via-zinc-950/70 to-transparent z-10" />
        <main ref={scrollRef} className="h-full overflow-y-auto p-3 md:p-6 space-y-8 scroll-smooth [scrollbar-width:thin] [scrollbar-color:#52525b_transparent] [&::-webkit-scrollbar]:w-[3px] [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-zinc-600/50">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col gap-2 animate-in fade-in slide-in-from-bottom-2 duration-300 ${
                msg.role === 'player' ? 'items-end' : 'items-start'
              }`}
            >
              <div className={`flex items-center gap-2 px-1 ${msg.role === 'player' ? 'flex-row-reverse' : 'flex-row'}`}>
                {msg.role === 'player' ? <User className="w-3 h-3 text-zinc-500" /> : <Sparkles className="w-3 h-3 text-cyan-500" />}
                <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-zinc-500">
                  {msg.senderName}
                </span>
              </div>
              <div className={`
                px-4 py-3 text-sm leading-relaxed
                ${msg.role === 'player'
                  ? 'bg-zinc-800/60 text-zinc-100 md:bg-zinc-800 md:border md:border-zinc-700 md:max-w-[85%] md:rounded-lg'
                  : 'bg-cyan-950/20 text-zinc-300 md:bg-transparent md:border-l-2 md:border-cyan-900/50 md:max-w-[85%] md:rounded-lg'}
              `}>
                <div className="prose prose-invert prose-sm max-w-none prose-p:leading-relaxed prose-strong:text-cyan-400 prose-em:text-zinc-400 prose-code:text-emerald-400">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              </div>
            </div>
          ))}

          {/* Streaming in-progress message */}
          {streamingContent !== null && (
            <div className="flex flex-col gap-2 items-start animate-in fade-in duration-200">
              <div className="flex items-center gap-2 px-1">
                <Sparkles className="w-3 h-3 text-cyan-500 animate-pulse" />
                <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-zinc-500">The Architect</span>
              </div>
              <div className="px-4 py-3 bg-cyan-950/20 text-zinc-300 text-sm leading-relaxed md:max-w-[85%] md:bg-transparent md:border-l-2 md:border-cyan-900/50">
                <div className="prose prose-invert prose-sm max-w-none prose-p:leading-relaxed prose-strong:text-cyan-400 prose-em:text-zinc-400">
                  <ReactMarkdown>{streamingContent || '…'}</ReactMarkdown>
                </div>
              </div>
            </div>
          )}

          {isGMLoading && streamingContent === null && (
            <div className="flex items-center gap-3 text-cyan-500/70 p-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-xs font-mono tracking-tighter">The Architect is weaving reality...</span>
            </div>
          )}
        </main>
      </div>

      {/* Check Interruption Panel */}
      {pendingCheck && (() => {
        const totalBase = pendingCheck.basePoolValue + poolContributed;
        const autoSucceed = totalBase >= pendingCheck.difficulty;
        const remainingPool = pendingCheck.basePoolValue - poolContributed;
        return (
          <div className="border-t border-amber-800/50 bg-zinc-900/90 px-6 py-4 shrink-0">
            <div className="flex items-start gap-3 mb-4">
              <Dice1 className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
              <div className="flex-1">
                <p className="text-xs uppercase tracking-widest text-amber-400 font-bold mb-1">Fate Check Required</p>
                <p className="text-sm text-zinc-300 mb-2">{pendingCheck.check_description}</p>
                <p className="text-xs text-zinc-500">
                  Difficulty: <span className="text-amber-400 font-bold text-sm">{pendingCheck.difficulty}</span>
                </p>
              </div>
            </div>

            {/* Score breakdown */}
            <div className="mb-4 bg-zinc-950/60 border border-zinc-800 rounded px-4 py-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs uppercase tracking-widest text-zinc-500">Base ({pendingCheck.pool})</span>
                <span className="text-amber-400 font-bold font-mono">{totalBase}</span>
              </div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs uppercase tracking-widest text-zinc-500">Die</span>
                <span className="text-zinc-400 font-mono text-xs">+ 1d20</span>
              </div>
              <div className="flex items-center justify-between border-t border-zinc-800 pt-2">
                <span className="text-xs uppercase tracking-widest text-zinc-500">
                  Sacrifice ({remainingPool} {pendingCheck.pool} left)
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleRemovePool}
                    disabled={poolContributed <= 0}
                    className="w-6 h-6 flex items-center justify-center border border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200 disabled:opacity-30 disabled:cursor-not-allowed rounded transition-colors"
                  >−</button>
                  <span className="text-amber-400 font-mono text-sm w-8 text-center">
                    {poolContributed > 0 ? `+${poolContributed}` : '0'}
                  </span>
                  <button
                    onClick={handleAddPool}
                    disabled={poolContributed >= pendingCheck.basePoolValue}
                    className="w-6 h-6 flex items-center justify-center border border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200 disabled:opacity-30 disabled:cursor-not-allowed rounded transition-colors"
                  >+</button>
                </div>
              </div>
            </div>

            <button
              onClick={() => resolveCheck(autoSucceed)}
              className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 text-xs uppercase tracking-widest font-bold transition-colors rounded ${
                autoSucceed
                  ? 'bg-amber-900/60 border border-amber-600/70 text-amber-300 hover:bg-amber-900/80'
                  : 'bg-zinc-800 border border-zinc-700 text-zinc-300 hover:bg-zinc-700'
              }`}
            >
              {autoSucceed ? <Zap className="w-3 h-3" /> : <Dice1 className="w-3 h-3" />}
              {autoSucceed ? 'Succeed' : 'Roll'}
            </button>
          </div>
        );
      })()}

      {/* Input Footer */}
      <footer className="p-4 bg-zinc-900/80 border-t border-zinc-800 backdrop-blur-xl shrink-0">
        <div className="relative flex items-center group">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !pendingCheck && handleSend()}
            placeholder={
              pendingCheck ? 'Resolve the fate check above first…'
              : gmBlocked ? 'Waiting for character state to save…'
              : 'Type your intent...'
            }
            disabled={gmBlocked || !!pendingCheck}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-md py-3 pl-4 pr-14 text-sm focus:outline-none focus:border-cyan-600 focus:ring-1 focus:ring-cyan-600/20 transition-all placeholder:text-zinc-600 text-zinc-100 disabled:opacity-40 disabled:cursor-not-allowed"
          />
          <button
            onClick={handleSend}
            disabled={!inputValue.trim() || isGMLoading || gmBlocked || !!pendingCheck}
            className="absolute right-2 p-2 text-zinc-500 hover:text-cyan-400 disabled:opacity-30 disabled:hover:text-zinc-500 transition-colors"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
        <div className="mt-2 flex justify-between px-1">
          <span className="text-[9px] text-zinc-600 uppercase tracking-widest font-mono italic">
            Press [Enter] to commit action
          </span>
          <span className="text-[9px] text-zinc-600 uppercase tracking-widest font-mono">
            SYNGEM v1.0.0
          </span>
        </div>
      </footer>
    </div>
  );
}
