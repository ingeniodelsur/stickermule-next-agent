'use client';

import { useState, useEffect, useRef } from 'react';
import { Send, Bot, User, Clock, AlertCircle, Loader2, Paperclip, X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

type Message = {
  id: string;
  role: 'user' | 'model';
  content: string;
  inlineData?: {
    data: string;
    mimeType: string;
  };
};

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome-msg',
      role: 'model',
      content: 'Hi! I am the Sticker Mule AI Assistant. How can I help you with your custom stickers today?'
    }
  ]);
  const [input, setInput] = useState('');
  
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isLoading, setIsLoading] = useState(false);
  
  const [sessionId, setSessionId] = useState<string>('');
  
  const [countdown, setCountdown] = useState<number | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  // Professional Exponential Backoff limit
  const MAX_RETRIES = 3; 
  
  const MAX_CONTEXT_MESSAGES = 10;
  
  const failedMessagesRef = useRef<Message[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading, countdown]);

  useEffect(() => {
    let currentSession = localStorage.getItem('sm_chat_session');
    if (!currentSession) {
      currentSession = crypto.randomUUID();
      localStorage.setItem('sm_chat_session', currentSession);
    }
    setSessionId(currentSession);
  }, []);

  useEffect(() => {
    const loadHistory = async (id: string) => {
      try {
        const response = await fetch(`/api/history?sessionId=${id}`);
        if (response.ok) {
          const data = await response.json();
          if (data.messages && data.messages.length > 0) {
            const historyMessages: Message[] = data.messages.map((msg: any) => ({
              id: msg.id.toString(),
              role: msg.role,
              content: msg.content
            }));
            
            setMessages([
              { id: 'welcome-msg', role: 'model', content: 'Hi! I am the Sticker Mule AI Assistant. How can I help you with your custom stickers today?' },
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

  // Handle professional exponential backoff timer (2s, 4s, 8s)
  useEffect(() => {
    if (countdown === null) return;
    
    if (countdown === 0) {
      setCountdown(null);
      executeRequest(failedMessagesRef.current, true);
      return;
    }

    const timer = setInterval(() => {
      setCountdown((prev) => (prev !== null ? prev - 1 : null));
    }, 1000);

    return () => clearInterval(timer);
  }, [countdown]);

  const executeRequest = async (chatHistory: Message[], isRetry: boolean = false) => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          messages: chatHistory,
          sessionId: sessionId,
          isRetry: isRetry
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.code || 'general_error');
      }

      const data = await response.json();
      const botMsg: Message = { id: Date.now().toString(), role: 'model', content: data.reply };
      
      setMessages((prev) => [...prev, botMsg]);
      setRetryCount(0); // Reset retries on success
      
    } catch (error: any) {
      console.error("Chat error:", error);
      
      if (error.message === 'service_unavailable') {
        if (retryCount < MAX_RETRIES) {
          // Exponential Backoff: 2^1 = 2s, 2^2 = 4s, 2^3 = 8s
          const nextDelay = Math.pow(2, retryCount + 1);
          setRetryCount((prev) => prev + 1);
          failedMessagesRef.current = chatHistory;
          setCountdown(nextDelay); 
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const clearFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSend = async () => {
    if ((!input.trim() && !selectedFile) || countdown !== null) return; 

    let base64Data = '';
    let mimeType = '';

    if (selectedFile) {
      const reader = new FileReader();
      const filePromise = new Promise<void>((resolve, reject) => {
        reader.onloadend = () => {
          const result = reader.result as string;
          const splitData = result.split(',');
          base64Data = splitData[1];
          mimeType = selectedFile.type;
          resolve();
        };
        reader.onerror = reject;
      });
      reader.readAsDataURL(selectedFile);
      await filePromise;
    }

    const userMsg: Message = { 
      id: Date.now().toString(), 
      role: 'user', 
      content: selectedFile ? `[Attached File: ${selectedFile.name}]\n${input}` : input,
      ...(selectedFile && { inlineData: { data: base64Data, mimeType: mimeType } })
    };
    
    const newMessages = [...messages, userMsg];
    
    setMessages(newMessages);
    setInput('');
    clearFile();
    
    await executeRequest(newMessages, false);
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
    <main className="flex h-screen flex-col bg-gray-100 items-center justify-center p-0 md:p-8 font-sans">
      {/* Container height adjusted for better mobile fit */}
      <div className="w-full max-w-3xl bg-white md:rounded-3xl shadow-2xl overflow-hidden flex flex-col h-[100vh] md:h-[85vh] border border-gray-100">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-[#f46b10] to-[#fa8537] p-4 md:p-5 text-white flex items-center gap-4 shadow-sm z-10">
          <div className="bg-white p-1.5 md:p-2 rounded-xl flex items-center justify-center h-12 w-12">
            {/* Added standard img tag referencing a local file in the public folder */}
            <img src="/logo.png" alt="Sticker Mule Logo" className="h-full w-full object-contain" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
            <Bot size={24} className="text-[#f46b10] absolute -z-10" />
          </div>
          <div>
            <h1 className="font-bold text-lg md:text-xl tracking-wide">Sticker Mule AI</h1>
            <p className="text-xs md:text-sm text-orange-50 font-medium opacity-90">AI Quoting & Design Agent</p>
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 bg-gray-50/50 scroll-smooth">
          {messages.map((msg, index) => {
            const isOutOfContext = messages.length > MAX_CONTEXT_MESSAGES && index < messages.length - MAX_CONTEXT_MESSAGES;
            
            return (
              <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} transition-opacity duration-500`}>
                <div className={`flex gap-3 max-w-[90%] md:max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'} ${isOutOfContext ? 'opacity-50 grayscale' : 'opacity-100'}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1 ${msg.role === 'user' ? 'bg-gray-200 text-gray-600' : 'bg-[#ffe8d6] text-[#f46b10] shadow-sm'}`}>
                    {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
                  </div>
                  
                  <div className={`p-3 md:p-4 text-[14px] md:text-[15px] leading-relaxed shadow-sm ${msg.role === 'user' ? 'bg-gray-100 text-gray-800 rounded-3xl rounded-tr-sm whitespace-pre-wrap' : 'bg-white border border-gray-100 text-gray-800 rounded-3xl rounded-tl-sm overflow-hidden'}`}>
                    {isOutOfContext && (
                      <div className="text-[11px] text-gray-400 font-medium mb-2 uppercase tracking-wider flex items-center gap-1">
                        <Clock size={12} /> Archived Context
                      </div>
                    )}
                    
                    {msg.role === 'user' ? (
                      <p className="break-words">{msg.content}</p>
                    ) : (
                      <div className="overflow-x-auto w-full">
                        <ReactMarkdown 
                          remarkPlugins={[remarkGfm]}
                          components={{
                            p: ({node, ...props}) => <p className="mb-3 last:mb-0 break-words" {...props} />,
                            ul: ({node, ...props}) => <ul className="list-disc ml-5 mb-3 space-y-1" {...props} />,
                            ol: ({node, ...props}) => <ol className="list-decimal ml-5 mb-3 space-y-1" {...props} />,
                            strong: ({node, ...props}) => <strong className="font-semibold text-gray-900" {...props} />,
                            table: ({node, ...props}) => (
                              <div className="overflow-x-auto rounded-xl border border-gray-200 mb-3 mt-2 w-full">
                                <table className="min-w-full divide-y divide-gray-200 text-sm whitespace-nowrap" {...props} />
                              </div>
                            ),
                            th: ({node, ...props}) => <th className="bg-gray-50 px-4 py-2 text-left font-semibold text-gray-600" {...props} />,
                            td: ({node, ...props}) => <td className="px-4 py-2 border-t border-gray-100 text-gray-700" {...props} />
                          }}
                        >
                          {msg.content}
                        </ReactMarkdown>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          
          {isLoading && (
            <div className="flex justify-start animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="flex gap-3 max-w-[85%] flex-row">
                <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1 bg-[#ffe8d6] text-[#f46b10] shadow-sm">
                  <Bot size={16} />
                </div>
                <div className="px-5 py-3.5 bg-white border border-gray-100 rounded-3xl rounded-tl-sm shadow-sm flex items-center gap-3">
                  <Loader2 size={16} className="text-[#f46b10] animate-spin" />
                  <span className="text-[14px] font-medium text-gray-600">
                    Processing request...
                  </span>
                </div>
              </div>
            </div>
          )}

          {countdown !== null && (
            <div className="flex justify-start animate-fade-in">
              <div className="flex gap-3 max-w-[90%] md:max-w-[85%] flex-row">
                <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1 bg-[#fff3eb] text-[#f46b10] border border-[#f46b10]/20">
                  <AlertCircle size={16} />
                </div>
                <div className="flex items-center justify-between p-3 md:p-4 bg-[#fff3eb] border border-[#f46b10]/30 text-[#d95a0c] rounded-3xl rounded-tl-sm shadow-sm w-full gap-2 md:gap-4 flex-wrap">
                  <div className="flex items-center gap-2 text-[14px] md:text-[15px]">
                    <Clock size={16} />
                    <span>High demand. Retrying in <strong>{countdown}s</strong>... (Attempt {retryCount}/{MAX_RETRIES})</span>
                  </div>
                  <button 
                    onClick={handleCancelRetry}
                    className="px-3 md:px-4 py-1.5 text-xs md:text-sm font-medium bg-white border border-[#f46b10]/20 rounded-xl hover:bg-[#f46b10] hover:text-white transition-all shadow-sm flex-shrink-0"
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
        <div className={`p-3 md:p-4 bg-white border-t border-gray-100 transition-opacity ${countdown !== null ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
          <div className="flex flex-col max-w-4xl mx-auto gap-2">
            
            {selectedFile && (
              <div className="flex items-center gap-2 bg-[#fff3eb] border border-[#f46b10]/30 text-[#d95a0c] px-3 py-1.5 rounded-xl self-start text-sm animate-in fade-in slide-in-from-bottom-2">
                <Paperclip size={14} />
                <span className="truncate max-w-[150px] md:max-w-[200px] font-medium">{selectedFile.name}</span>
                <button 
                  onClick={clearFile} 
                  className="hover:text-red-500 transition-colors rounded-full p-0.5 ml-1"
                >
                  <X size={14} />
                </button>
              </div>
            )}

            {/* Adjusted flex container for mobile layout stability */}
            <div className="flex gap-2 w-full items-center">
              <input 
                type="file" 
                accept="image/*" 
                className="hidden" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={countdown !== null || isLoading}
                className="flex-shrink-0 h-[52px] w-[52px] flex items-center justify-center bg-gray-50 border border-gray-200 text-gray-500 rounded-2xl hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50 transition-all cursor-pointer shadow-sm"
                title="Attach logo image"
              >
                <Paperclip size={20} />
              </button>

              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder={countdown !== null ? "Waiting..." : "Message AI..."}
                className="flex-1 min-w-0 h-[52px] px-4 border border-gray-200 rounded-2xl focus:outline-none focus:border-[#f46b10] focus:ring-1 focus:ring-[#f46b10] transition-all bg-gray-50/50 focus:bg-white disabled:bg-gray-100 disabled:text-gray-500 cursor-text disabled:cursor-not-allowed shadow-inner"
                disabled={countdown !== null || isLoading}
              />
              
              <button
                onClick={handleSend}
                disabled={isLoading || (!input.trim() && !selectedFile) || countdown !== null}
                className="flex-shrink-0 h-[52px] px-5 md:px-6 flex items-center justify-center bg-[#f46b10] text-white rounded-2xl hover:bg-[#d95a0c] disabled:bg-gray-200 disabled:text-gray-400 transition-all cursor-pointer disabled:cursor-not-allowed shadow-md hover:shadow-lg active:scale-95"
              >
                <Send size={20} />
              </button>
            </div>
          </div>
        </div>

      </div>
    </main>
  );
}