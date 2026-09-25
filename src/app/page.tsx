'use client';

import { useState, useEffect, useRef } from 'react';
import { Send, Bot, User, Clock, AlertCircle } from 'lucide-react';

type Message = {
  id: string;
  role: 'user' | 'model';
  content: string;
};

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'model',
      content: 'Hi! I am the Sticker Mule AI Assistant. How can I help you with your custom stickers today?'
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // States for the automatic retry mechanism
  const [countdown, setCountdown] = useState<number | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const MAX_RETRIES = 1; // Strict limit to prevent infinite loops
  const failedMessagesRef = useRef<Message[]>([]);

  // Effect to handle the countdown timer
  useEffect(() => {
    if (countdown === null) return;
    
    // When countdown hits zero, stop the timer and trigger the retry
    if (countdown === 0) {
      setCountdown(null);
      executeRequest(failedMessagesRef.current);
      return;
    }

    // Decrease the countdown every second
    const timer = setInterval(() => {
      setCountdown((prev) => (prev !== null ? prev - 1 : null));
    }, 1000);

    return () => clearInterval(timer);
  }, [countdown]);

  // Format seconds into MM:SS
  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // Core function to communicate with the Next.js backend
  const executeRequest = async (chatHistory: Message[]) => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: chatHistory }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.code || 'general_error');
      }

      const data = await response.json();
      const botMsg: Message = { id: Date.now().toString(), role: 'model', content: data.reply };
      setMessages((prev) => [...prev, botMsg]);
      
      // Reset retries upon success
      setRetryCount(0);

    } catch (error: any) {
      console.error("Chat error:", error);
      
      if (error.message === 'service_unavailable') {
        if (retryCount < MAX_RETRIES) {
          // Initiate retry protocol
          setRetryCount((prev) => prev + 1);
          failedMessagesRef.current = chatHistory;
          setCountdown(180); // Set to 3 minutes
        } else {
          // Max retries reached, abort and inform user
          setRetryCount(0);
          const errorMsg: Message = { 
            id: Date.now().toString(), 
            role: 'model', 
            content: 'Our quoting systems are currently experiencing sustained high demand. Please try again later.' 
          };
          setMessages((prev) => [...prev, errorMsg]);
        }
      } else {
        const errorMsg: Message = { 
          id: Date.now().toString(), 
          role: 'model', 
          content: 'We are experiencing technical difficulties. Please try again later.' 
        };
        setMessages((prev) => [...prev, errorMsg]);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || countdown !== null) return; // Extra safety guard

    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: input };
    const newMessages = [...messages, userMsg];
    
    setMessages(newMessages);
    setInput('');
    
    await executeRequest(newMessages);
  };

  // Function to manually cancel the automatic retry
  const handleCancelRetry = () => {
    setCountdown(null);
    setRetryCount(0);
    const cancelMsg: Message = { 
      id: Date.now().toString(), 
      role: 'model', 
      content: 'Automatic retry cancelled.' 
    };
    setMessages((prev) => [...prev, cancelMsg]);
  };

  return (
    <main className="flex h-screen flex-col bg-gray-50 items-center justify-center p-4 md:p-8">
      <div className="w-full max-w-3xl bg-white rounded-2xl shadow-xl overflow-hidden flex flex-col h-[85vh] border border-gray-200">
        
        {/* Header */}
        <div className="bg-[#f46b10] p-4 text-white flex items-center gap-3 shadow-md z-10">
          <Bot size={32} className="opacity-90" />
          <div>
            <h1 className="font-bold text-xl tracking-tight">Sticker Mule AI</h1>
            <p className="text-sm text-orange-100 font-medium">Quoting & Support Agent</p>
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 bg-gray-50/50">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`flex gap-3 max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1 ${msg.role === 'user' ? 'bg-gray-300 text-gray-600' : 'bg-[#ffe8d6] text-[#f46b10] shadow-sm'}`}>
                  {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
                </div>
                <div className={`p-4 rounded-2xl text-[15px] leading-relaxed ${msg.role === 'user' ? 'bg-[#f0f0f0] text-gray-800 rounded-tr-none' : 'bg-white border border-gray-200 text-gray-800 rounded-tl-none shadow-sm'}`}>
                  {msg.content}
                </div>
              </div>
            </div>
          ))}
          
          {/* Loading Indicator */}
          {isLoading && (
            <div className="flex justify-start">
              <div className="flex gap-3 max-w-[85%] flex-row">
                <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1 bg-[#ffe8d6] text-[#f46b10] shadow-sm">
                  <Bot size={16} />
                </div>
                <div className="p-4 bg-white border border-gray-200 rounded-2xl rounded-tl-none shadow-sm flex items-center gap-1.5">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }}></div>
                </div>
              </div>
            </div>
          )}

          {/* Retry Countdown Banner (Moved into chat flow) */}
          {countdown !== null && (
            <div className="flex justify-start animate-fade-in">
              <div className="flex gap-3 max-w-[85%] flex-row">
                <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1 bg-[#fff3eb] text-[#f46b10] border border-[#f46b10]/20">
                  <AlertCircle size={16} />
                </div>
                <div className="p-4 bg-[#fff3eb] border border-[#f46b10]/30 text-[#d95a0c] rounded-2xl rounded-tl-none shadow-sm flex flex-col gap-2">
                  <div className="flex items-center gap-2 text-[15px]">
                    <Clock size={16} />
                    <span>High demand. Retrying automatically in <strong>{formatTime(countdown)}</strong>...</span>
                  </div>
                  <button 
                    onClick={handleCancelRetry}
                    className="text-sm font-medium underline hover:text-[#f46b10] transition-colors self-start"
                  >
                    Cancel retry
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Input Area (Visually disabled during countdown) */}
        <div className={`p-4 bg-white border-t border-gray-200 transition-opacity ${countdown !== null ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
          <div className="flex gap-3 max-w-4xl mx-auto">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder={countdown !== null ? "Waiting for retry..." : "E.g., I need 2000 holographic stickers..."}
              className="flex-1 p-4 border border-gray-300 rounded-xl focus:outline-none focus:border-[#f46b10] focus:ring-1 focus:ring-[#f46b10] transition-all bg-gray-50 focus:bg-white disabled:bg-gray-100 disabled:text-gray-500 cursor-text disabled:cursor-not-allowed"
              disabled={countdown !== null || isLoading}
            />
            <button
              onClick={handleSend}
              disabled={isLoading || !input.trim() || countdown !== null}
              className="px-6 flex items-center justify-center bg-[#f46b10] text-white rounded-xl hover:bg-[#d95a0c] disabled:bg-gray-300 disabled:text-gray-500 transition-colors cursor-pointer disabled:cursor-not-allowed"
            >
              <Send size={20} />
            </button>
          </div>
        </div>

      </div>
    </main>
  );
}