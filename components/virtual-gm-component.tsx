import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { Send, Terminal, Sparkles, User, Loader2 } from 'lucide-react';
import { Character } from './character-dashboard';

interface Message {
  id: string;
  role: 'player' | 'gm';
  content: string;
  senderName: string;
  timestamp: Date;
}

interface ChatGMProps {
  playerName: string;
  onSendMessage?: (message: string) => void;
  characterId: string;
  isGMLoading?: boolean;
}

export default function ChatGMComponent({
  playerName = "Wanderer",
  characterId,
  onSendMessage,
  isGMLoading = false
}: ChatGMProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'gm',
      senderName: 'The Architect',
      content: "You are coming into a small town. It is evening. You have been travelling all day. To either side, the forest thins to make way for homesteads, gardens; livestock left out to graze. \n\n  Gods above it is lovely - makes one's mind drift. \n\n The smoke settles in low gray haze at the valley bottom. You will reach the town proper by evening. What do you do?",
      timestamp: new Date(),
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isGMLoading]);

  const handleSend = () => {
    if (!inputValue.trim() || isGMLoading) return;

    const newMessage: Message = {
      id: Date.now().toString(),
      role: 'player',
      senderName: playerName,
      content: inputValue.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, newMessage]);
    onSendMessage?.(inputValue.trim());
    setInputValue('');
  };

  return (
    <div className="flex flex-col h-full w-full max-w-4xl mx-auto bg-zinc-950 border-x border-zinc-800 font-sans text-zinc-200 shadow-2xl">
      {/* --- Header --- */}
      <header className="h-14 border-b border-zinc-800 flex items-center px-6 bg-zinc-900/50 backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-cyan-500" />
          <span className="text-xs uppercase tracking-[0.3em] font-bold text-zinc-400">Chronicle</span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isGMLoading ? 'bg-cyan-500 animate-pulse' : 'bg-emerald-500'}`} />
          <span className="text-[10px] uppercase tracking-widest text-zinc-500">
            {isGMLoading ? 'Processing Paradox...' : 'Engine Ready'}
          </span>
        </div>
      </header>

      {/* --- Message Area --- */}
      <main
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-6 space-y-8 scroll-smooth"
      >
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col gap-2 animate-in fade-in slide-in-from-bottom-2 duration-300 ${
              msg.role === 'player' ? 'items-end' : 'items-start'
            }`}
          >
            {/* Sender Label */}
            <div className={`flex items-center gap-2 px-1 ${msg.role === 'player' ? 'flex-row-reverse' : 'flex-row'}`}>
              {msg.role === 'player' ? <User className="w-3 h-3 text-zinc-500" /> : <Sparkles className="w-3 h-3 text-cyan-500" />}
              <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-zinc-500">
                {msg.senderName}
              </span>
            </div>

            {/* Message Bubble */}
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

        {isGMLoading && (
          <div className="flex items-center gap-3 text-cyan-500/70 p-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-xs font-mono tracking-tighter">The Architect is weaving reality...</span>
          </div>
        )}
      </main>

      {/* --- Input Footer --- */}
      <footer className="p-4 bg-zinc-900/80 border-t border-zinc-800 backdrop-blur-xl">
        <div className="relative flex items-center group">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Type your intent..."
            className="w-full bg-zinc-950 border border-zinc-800 rounded-md py-3 pl-4 pr-14 text-sm focus:outline-none focus:border-cyan-600 focus:ring-1 focus:ring-cyan-600/20 transition-all placeholder:text-zinc-600 text-zinc-100"
          />
          <button
            onClick={handleSend}
            disabled={!inputValue.trim() || isGMLoading}
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
            V-GM v4.0.2
          </span>
        </div>
      </footer>
    </div>
  );
}