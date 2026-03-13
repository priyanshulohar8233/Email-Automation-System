import React, { useState, useEffect, useRef } from 'react';
import { Bot, X, Send, Minus, MessageSquare, Sparkles, User, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export const ClawdAssistant: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: "Hey! I'm **Clawd**, your AI email specialist. How can I help you grow your reach today?" }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isOpen]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setIsLoading(true);

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMsg,
          history: messages.slice(-5) // Send last 5 for context
        })
      });

      if (!response.ok) throw new Error('Failed to reach Clawd');
      const data = await response.json();
      setMessages(prev => [...prev, { role: 'assistant', content: data.response }]);
    } catch (error) {
      setMessages(prev => [...prev, { role: 'assistant', content: "Sorry, I'm having trouble connecting to my brain right now. Please check your internet or API settings!" }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col items-end pointer-events-none">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className={`w-[380px] sm:w-[420px] bg-card/80 backdrop-blur-xl border border-indigo-500/20 shadow-2xl rounded-3xl overflow-hidden pointer-events-auto flex flex-col mb-4 ${isMinimized ? 'h-14' : 'h-[550px]'}`}
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-indigo-600 to-violet-600 p-4 flex items-center justify-between text-white shrink-0">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30">
                  <Bot className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold leading-tight">Clawd Assistant</h3>
                  <div className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
                    <span className="text-[10px] text-indigo-100 font-medium opacity-80 uppercase tracking-wider">AI Strategy Engine</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button 
                  onClick={() => setIsMinimized(!isMinimized)}
                  className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <button 
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Chat Area */}
            {!isMinimized && (
              <>
                <div 
                  ref={scrollRef}
                  className="flex-1 overflow-y-auto p-4 space-y-4 scroll-smooth"
                >
                  {messages.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[85%] rounded-2xl p-3 text-sm shadow-sm ${
                        msg.role === 'user' 
                        ? 'bg-indigo-600 text-white rounded-tr-none' 
                        : 'bg-muted/50 border border-border text-foreground rounded-tl-none font-medium'
                      }`}>
                        <div className="whitespace-pre-wrap leading-relaxed">
                          {msg.content}
                        </div>
                      </div>
                    </div>
                  ))}
                  {isLoading && (
                    <div className="flex justify-start">
                      <div className="bg-muted/50 border border-border rounded-2xl rounded-tl-none p-3 shadow-sm">
                        <div className="flex gap-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 animate-[bounce_1s_infinite_0ms]" />
                          <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 animate-[bounce_1s_infinite_200ms]" />
                          <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 animate-[bounce_1s_infinite_400ms]" />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Input Area */}
                <div className="p-4 border-t border-border bg-card/50">
                  <div className="relative group">
                    <input
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                      placeholder="Ask Clawd about your campaign..."
                      className="w-full bg-muted/50 border border-border hover:border-indigo-500/50 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 rounded-2xl py-3 pl-4 pr-12 text-sm transition-all duration-300 outline-none placeholder:text-muted-foreground/50"
                    />
                    <button
                      onClick={handleSend}
                      disabled={isLoading || !input.trim()}
                      className={`absolute right-1.5 top-1.5 h-9 w-9 rounded-xl flex items-center justify-center transition-all bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 disabled:hover:bg-indigo-600 shadow-lg shadow-indigo-500/20`}
                    >
                      <Send className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="mt-3 flex items-center justify-center gap-4 text-[10px] text-muted-foreground/60 font-semibold uppercase tracking-widest">
                    <span className="flex items-center gap-1"><Sparkles className="h-3 w-3" /> GPT-4 Intelligence</span>
                    <span className="flex items-center gap-1"><Info className="h-3 w-3" /> End-to-End Encrypted</span>
                  </div>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`pointer-events-auto h-14 w-14 rounded-2xl shadow-2xl flex items-center justify-center transition-all duration-500 active:scale-90 group relative overflow-hidden ${
          isOpen 
          ? 'bg-muted border border-border text-foreground hover:bg-card' 
          : 'bg-gradient-to-br from-indigo-500 via-indigo-600 to-violet-600 text-white hover:shadow-indigo-500/40 hover:scale-110'
        }`}
      >
        <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300 pointer-events-none" />
        {isOpen ? <X className="h-6 w-6 relative" /> : <Bot className="h-7 w-7 relative" />}
      </button>
    </div>
  );
};
