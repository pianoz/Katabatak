"use client"

import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { Send, Terminal, Sparkles, User, Loader2, Dice1, Zap, Sun, Moon, X, Trash2 } from 'lucide-react';
import { useCharacterStore } from '@/features/characters/hooks/use-character-store';

// ─── Sky Tracker ──────────────────────────────────────────────────────────────

const GAME_START_MINUTE = 480; // 8:00 AM in-game

function getSkyBackground(hours: number): string {
  if (hours < 5 || hours >= 22) return 'linear-gradient(180deg, #04040b 0%, #0c0c1a 50%, #04040b 100%)';
  if (hours < 7)  return 'linear-gradient(180deg, #09091a 0%, #1c0f08 65%, #09091a 100%)';
  if (hours < 9)  return 'linear-gradient(180deg, #09091a 0%, #2e1806 70%, #09091a 100%)';
  if (hours < 17) return 'linear-gradient(180deg, #0c1220 0%, #111e2e 55%, #0c1220 100%)';
  if (hours < 19) return 'linear-gradient(180deg, #0c1220 0%, #2e1508 70%, #0c1220 100%)';
  if (hours < 21) return 'linear-gradient(180deg, #0d0b1c 0%, #22091e 65%, #0d0b1c 100%)';
  return 'linear-gradient(180deg, #04040b 0%, #0c0c1a 50%, #04040b 100%)';
}

function SkyTracker({ turnCount }: { turnCount: number }) {
  const totalMinutes = GAME_START_MINUTE + turnCount * 10;
  const minuteOfDay = totalMinutes % 1440;
  const dayNumber = Math.floor(totalMinutes / 1440) + 1;
  const hours = Math.floor(minuteOfDay / 60);
  const mins = minuteOfDay % 60;
  const positionPct = (minuteOfDay / 1440) * 100;
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
            <Moon className="relative w-[15px] h-[15px] text-blue-100/80" />
          </div>
        )}
      </div>

      {/* Time readout */}
      <div className="absolute bottom-1.5 left-4 flex items-center gap-3">
        <span className="text-[8px] uppercase tracking-[0.3em] text-zinc-600 font-mono">Day {dayNumber}</span>
        <span className="text-[8px] uppercase tracking-[0.3em] text-zinc-500 font-mono">{timeStr}</span>
        <span className="text-[8px] uppercase tracking-[0.3em] text-zinc-700 font-mono">Turn {turnCount + 1}</span>
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

  const [turnCount, setTurnCount] = useState(0);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'gm',
      senderName: 'The Architect',
      content: "Begin your adventure.",
      timestamp: new Date(),
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isGMLoading, setIsGMLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState<string | null>(null);
  const [pendingCheck, setPendingCheck] = useState<PendingCheck | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isGMLoading, streamingContent]);

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
      setTurnCount(0);
    } catch (err) {
      console.error('[DEV] dumpHistory error:', err);
    }
  };

  const sendToGM = async (message: string, checkResolution?: { choice: 'spend' | 'roll'; pool: string }) => {
    setIsGMLoading(true);
    setStreamingContent('');

    try {
      const res = await fetch('/api/gm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
          setPendingCheck({
            difficulty: data.difficulty ?? 10,
            pool: (data.pool ?? 'Power') as PendingCheck['pool'],
            check_description: data.check_description ?? 'Attempting a difficult task',
            originalMessage: message,
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
        setTurnCount(prev => prev + 1);
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

  const resolveCheck = async (choice: 'spend' | 'roll') => {
    if (!pendingCheck) return;
    const { originalMessage, pool } = pendingCheck;
    setPendingCheck(null);

    const rollResult = choice === 'roll' ? Math.floor(Math.random() * 10) + 1 : undefined;

    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      role: 'player',
      senderName: playerName,
      content: choice === 'spend'
        ? `[Spent from ${pool} pool — auto-succeeding]`
        : `[Rolling dice — result: ${rollResult}]`,
      timestamp: new Date(),
    }]);

    await sendToGM(originalMessage, { choice, pool, ...(rollResult !== undefined ? { roll_result: rollResult } : {}) });
  };

  return (
    <div className="flex flex-col h-full w-full bg-zinc-950 font-sans text-zinc-200 overflow-hidden">
      {/* Sky Tracker */}
      <SkyTracker turnCount={turnCount} />

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
        <main ref={scrollRef} className="h-full overflow-y-auto p-6 space-y-8 scroll-smooth">
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
                max-w-[85%] px-4 py-3 rounded-lg text-sm leading-relaxed
                ${msg.role === 'player'
                  ? 'bg-zinc-800 border border-zinc-700 text-zinc-100'
                  : 'bg-transparent border-l-2 border-cyan-900/50 text-zinc-300'}
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
              <div className="max-w-[85%] px-4 py-3 bg-transparent border-l-2 border-cyan-900/50 text-zinc-300 text-sm leading-relaxed">
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
      {pendingCheck && (
        <div className="border-t border-amber-800/50 bg-zinc-900/90 px-6 py-4 shrink-0">
          <div className="flex items-start gap-3 mb-3">
            <Dice1 className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs uppercase tracking-widest text-amber-400 font-bold mb-1">Fate Check Required</p>
              <p className="text-sm text-zinc-300">{pendingCheck.check_description}</p>
              <p className="text-xs text-zinc-500 mt-1">
                Difficulty: <span className="text-amber-400 font-bold">{pendingCheck.difficulty}</span>
                {' '}— Pool: <span className="text-amber-400 font-bold">{pendingCheck.pool}</span>
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => resolveCheck('spend')}
              className="flex items-center gap-1.5 px-4 py-2 bg-amber-900/40 border border-amber-700/50 text-amber-300 text-xs uppercase tracking-widest hover:bg-amber-900/60 transition-colors rounded"
            >
              <Zap className="w-3 h-3" />
              Spend {pendingCheck.difficulty} {pendingCheck.pool} — Guarantee Success
            </button>
            <button
              onClick={() => resolveCheck('roll')}
              className="flex items-center gap-1.5 px-4 py-2 bg-zinc-800 border border-zinc-700 text-zinc-300 text-xs uppercase tracking-widest hover:bg-zinc-700 transition-colors rounded"
            >
              <Dice1 className="w-3 h-3" />
              Roll the Dice
            </button>
          </div>
        </div>
      )}

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
