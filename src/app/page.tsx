'use client';

import { useState, useEffect, useRef } from 'react';
import { Send, Bot, User, Clock, AlertCircle, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

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
  const [actionText, setActionText] = useState('Analyzing request...');
  
  // State to hold the unique session ID
  const [sessionId, setSessionId] = useState<string>('');
  
  const [countdown, setCountdown] = useState<number | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const MAX_RETRIES = 1;
  const failedMessagesRef = useRef<Message[]>([]);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading, countdown, actionText]);

  // Initialize or retrieve the session ID from Local Storage
  useEffect(() => {
    let currentSession = localStorage.getItem('sm_chat_session');
    if (!currentSession) {
      currentSession = crypto.randomUUID();
      localStorage.setItem('sm_chat_session', currentSession);
    }
    setSessionId(currentSession);
  }, []);

  // NEW: Load chat history when sessionId is established
  useEffect(() => {
    const loadHistory = async (id: string) => {
      try {
        const response = await fetch(`/api/history?sessionId=${id}`);
        if (response.ok) {
          const data = await response.json();
          if (data.messages && data.messages.length > 0) {
            
            // Map database records to our frontend Message type
            const historyMessages: Message[] = data.messages.map((msg: any) => ({
              id: msg.id.toString(),
              role: msg.role,
              content: msg.content
            }));
            
            // Keep the default welcome message, then append the history
            setMessages([
              { id: '1', role: 'model', content: 'Hi! I am the Sticker Mule AI Assistant. How can I help you with your custom stickers today?' },
              ...historyMessages
            ]);
          }
        }
      } catch (error) {
        console.error("Failed to load history:", error);
      }
    };

    if (sessionId) {
      loadHistory(sessionId);
    }
  }, [sessionId]);

  // Dynamic action text rotation while loading
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isLoading) {
      setActionText('Analyzing request...');
      let step = 0;
      interval = setInterval(() => {
        step++;
        if (step === 1) setActionText('Checking materials catalog...');
        else if (step === 2) setActionText('Calculating quote...');
        else if (step >= 3) setActionText('Generating response...');
      }, 2000);
    }
    return () => clearInterval(interval);
  }, [isLoading]);

  // Handle countdown timer
  useEffect(() => {
    if (countdown === null) return;
    
    if (countdown === 0) {
      setCountdown(null);
      executeRequest(failedMessagesRef.current);
      return;
    }

    const timer = setInterval(() => {
      setCountdown((prev) => (prev !== null ? prev - 1 : null));
    }, 1000);

    return () => clearInterval(timer);
  }, [countdown]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const executeRequest = async (chatHistory: Message[]) => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Send the sessionId along with the message history
        body: JSON.stringify({ 
          messages: chatHistory,
          sessionId: sessionId 
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.code || 'general_error');
      }

      const data = await response.json();
      const botMsg: Message = { id: Date.now().toString(), role: 'model', content: data.reply };
      setMessages((prev) => [...prev, botMsg]);
      
      setRetryCount(0);
    } catch (error: any) {
      console.error("Chat error:", error);
      
      if (error.message === 'service_unavailable') {
        if (retryCount < MAX_RETRIES) {
          setRetryCount((prev) => prev + 1);
          failedMessagesRef.current = chatHistory;
          setCountdown(180); 
        } else {
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
    if (!input.trim() || countdown !== null) return; 

    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: input };
    const newMessages = [...messages, userMsg];
    
    setMessages(newMessages);
    setInput('');
    
    await executeRequest(newMessages);
  };

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
    <main className="flex h-screen flex-col bg-gray-100 items-center justify-center p-4 md:p-8 font-sans">
      <div className="w-full max-w-3xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col h-[85vh] border border-gray-100">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-[#f46b10] to-[#fa8537] p-5 text-white flex items-center gap-4 shadow-sm z-10">
          <div className="bg-white/20 p-2 rounded-xl">
            <Bot size={28} className="text-white" />
          </div>
          <div>
            <h1 className="font-bold text-xl tracking-wide">Sticker Mule AI</h1>
            <p className="text-sm text-orange-50 font-medium opacity-90">Quoting & Support Agent</p>
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 bg-gray-50/50 scroll-smooth">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`flex gap-3 max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1 ${msg.role === 'user' ? 'bg-gray-200 text-gray-600' : 'bg-[#ffe8d6] text-[#f46b10] shadow-sm'}`}>
                  {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
                </div>
                
                <div className={`p-4 text-[15px] leading-relaxed shadow-sm ${msg.role === 'user' ? 'bg-gray-100 text-gray-800 rounded-3xl rounded-tr-sm' : 'bg-white border border-gray-100 text-gray-800 rounded-3xl rounded-tl-sm'}`}>
                  {msg.role === 'user' ? (
                    <p>{msg.content}</p>
                  ) : (
                    <ReactMarkdown 
                      remarkPlugins={[remarkGfm]}
                      components={{
                        p: ({node, ...props}) => <p className="mb-3 last:mb-0" {...props} />,
                        ul: ({node, ...props}) => <ul className="list-disc ml-5 mb-3 space-y-1" {...props} />,
                        ol: ({node, ...props}) => <ol className="list-decimal ml-5 mb-3 space-y-1" {...props} />,
                        strong: ({node, ...props}) => <strong className="font-semibold text-gray-900" {...props} />,
                        table: ({node, ...props}) => (
                          <div className="overflow-hidden rounded-xl border border-gray-200 mb-3 mt-2">
                            <table className="min-w-full divide-y divide-gray-200 text-sm" {...props} />
                          </div>
                        ),
                        th: ({node, ...props}) => <th className="bg-gray-50 px-4 py-2 text-left font-semibold text-gray-600" {...props} />,
                        td: ({node, ...props}) => <td className="px-4 py-2 border-t border-gray-100 text-gray-700" {...props} />
                      }}
                    >
                      {msg.content}
                    </ReactMarkdown>
                  )}
                </div>
              </div>
            </div>
          ))}
          
          {/* Dynamic Action Indicator */}
          {isLoading && (
            <div className="flex justify-start animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="flex gap-3 max-w-[85%] flex-row">
                <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1 bg-[#ffe8d6] text-[#f46b10] shadow-sm">
                  <Bot size={16} />
                </div>
                <div className="px-5 py-3.5 bg-white border border-gray-100 rounded-3xl rounded-tl-sm shadow-sm flex items-center gap-3">
                  <Loader2 size={16} className="text-[#f46b10] animate-spin" />
                  <span className="text-[14px] font-medium text-gray-600 animate-pulse">
                    {actionText}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Retry Countdown Banner */}
          {countdown !== null && (
            <div className="flex justify-start animate-fade-in">
              <div className="flex gap-3 max-w-[85%] flex-row">
                <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1 bg-[#fff3eb] text-[#f46b10] border border-[#f46b10]/20">
                  <AlertCircle size={16} />
                </div>
                <div className="flex items-center justify-between p-4 bg-[#fff3eb] border border-[#f46b10]/30 text-[#d95a0c] rounded-3xl rounded-tl-sm shadow-sm w-full gap-4">
                  <div className="flex items-center gap-2 text-[15px]">
                    <Clock size={16} />
                    <span>High demand. Retrying in <strong>{formatTime(countdown)}</strong>...</span>
                  </div>
                  <button 
                    onClick={handleCancelRetry}
                    className="px-4 py-1.5 text-sm font-medium bg-white border border-[#f46b10]/20 rounded-xl hover:bg-[#f46b10] hover:text-white transition-all shadow-sm flex-shrink-0"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className={`p-4 bg-white border-t border-gray-100 transition-opacity ${countdown !== null ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
          <div className="flex gap-3 max-w-4xl mx-auto">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder={countdown !== null ? "Waiting for retry..." : "Message Sticker Mule AI..."}
              className="flex-1 p-4 border border-gray-200 rounded-2xl focus:outline-none focus:border-[#f46b10] focus:ring-1 focus:ring-[#f46b10] transition-all bg-gray-50/50 focus:bg-white disabled:bg-gray-100 disabled:text-gray-500 cursor-text disabled:cursor-not-allowed shadow-inner"
              disabled={countdown !== null || isLoading}
            />
            <button
              onClick={handleSend}
              disabled={isLoading || !input.trim() || countdown !== null}
              className="px-6 flex items-center justify-center bg-[#f46b10] text-white rounded-2xl hover:bg-[#d95a0c] disabled:bg-gray-200 disabled:text-gray-400 transition-all cursor-pointer disabled:cursor-not-allowed shadow-md hover:shadow-lg active:scale-95"
            >
              <Send size={20} />
            </button>
          </div>
        </div>

      </div>
    </main>
  );
}