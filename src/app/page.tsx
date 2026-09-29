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
      <div className="w-full max-w-3xl bg-white md:rounded-3xl shadow-2xl overflow-hidden flex flex-col h-[100vh] md:h-[85vh] border border-gray-100">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-[#f46b10] to-[#fa8537] p-4 md:p-5 text-white flex items-center gap-4 shadow-sm z-10">
          <div className="bg-white p-1.5 md:p-2 rounded-xl flex items-center justify-center h-12 w-12 flex-shrink-0">
            {/* INLINE SVG: Rendered directly without external image requests, optimized with React attributes */}
            <svg height="28" viewBox="0 0 21 20" width="28" xmlns="http://www.w3.org/2000/svg" className="block">
              <path clipRule="evenodd" fillRule="evenodd" fill="#f46b10" d="M12.7133 19.4382C12.4951 19.5031 12.267 19.5281 12.0399 19.5119C11.8195 19.5427 11.5949 19.5073 11.3946 19.4102C11.3332 19.3338 11.3009 19.2381 11.3034 19.1401C11.3035 19.0374 11.3153 18.9351 11.3385 18.835C11.3762 18.7211 11.3762 18.5982 11.3385 18.4843C11.2859 18.4071 11.0895 18.4387 10.9878 18.3826C10.8861 18.3265 10.8475 18.1757 10.8124 18.0143C10.8124 17.9617 10.7704 17.9162 10.7668 17.8741C10.759 17.5909 10.7945 17.3083 10.8721 17.0359C10.9352 16.7623 11.0123 16.5098 11.0579 16.2608C11.1264 15.8637 11.1476 15.4599 11.1211 15.0579C11.1002 14.8808 11.1002 14.7019 11.1211 14.5248C11.1491 14.3635 11.2158 14.2302 11.2508 14.0724C11.2508 14.0198 11.2508 13.9602 11.2508 13.9041C11.2508 13.8479 11.2859 13.8164 11.2894 13.7743C11.2838 13.6509 11.2709 13.5279 11.2508 13.406C11.2385 13.0189 11.2478 12.6313 11.2789 12.2452C11.2789 12.1365 11.3385 12.0172 11.2613 11.9681C10.9085 11.9788 10.5568 12.0151 10.2092 12.0769C9.21535 12.211 8.207 12.1957 7.21768 12.0313C7.13351 12.0137 7.04934 12.0137 6.96868 11.9927C6.36088 11.8604 5.78971 11.5958 5.2958 11.2176C5.22917 11.165 5.145 11.1054 5.06784 11.0423C4.99613 10.977 4.91866 10.9183 4.83638 10.8669C4.6666 10.8027 4.48096 10.7931 4.30549 10.8397C4.13002 10.8862 3.97351 10.9865 3.8579 11.1264C3.80179 11.2176 3.7597 11.3404 3.70359 11.4491C3.64748 11.5578 3.60189 11.6665 3.55279 11.7717C3.31431 12.3189 3.04777 12.8239 2.80578 13.3885C2.65207 13.7211 2.5197 14.0632 2.40948 14.4126C2.18853 15.1666 2.40948 16.1661 2.5673 16.8886C2.58833 16.9565 2.61292 17.0232 2.64095 17.0885C2.69969 17.2834 2.80432 17.4614 2.94606 17.6075C3.0162 17.6671 3.13544 17.7057 3.2126 17.7724C3.31535 17.8923 3.39931 18.0271 3.4616 18.1722C3.49317 18.2318 3.53876 18.2984 3.58084 18.3721C3.67203 18.5334 3.70359 18.6772 3.52473 18.7719C3.3573 18.8381 3.1787 18.8714 2.99867 18.8701C2.9145 18.8946 2.94255 19.0104 2.88995 19.0665C2.82145 19.1106 2.74707 19.1448 2.669 19.1682C2.3867 19.2367 2.09208 19.2367 1.80977 19.1682C1.76082 19.154 1.71517 19.1303 1.67544 19.0984C1.63571 19.0665 1.6027 19.027 1.5783 18.9823C1.5292 18.8315 1.64844 18.6316 1.53972 18.5194C1.49413 18.4703 1.39243 18.4773 1.30124 18.4387C1.15801 18.3722 1.04613 18.2528 0.989113 18.1055C0.841816 17.7338 0.929493 17.1481 0.915464 16.7027C0.915464 16.5694 0.890915 16.4256 0.887408 16.2783C0.887408 16.0083 0.813759 15.7418 0.785702 15.4752C0.763972 15.3569 0.735874 15.2398 0.701533 15.1245C0.659448 14.9316 0.627884 14.7247 0.571771 14.5318C0.504699 14.3375 0.504699 14.1264 0.571771 13.9321C0.589306 13.8795 0.645419 13.8339 0.673476 13.7638C0.712754 13.6609 0.730654 13.5511 0.726082 13.4411C0.698026 13.3885 0.568264 13.4411 0.533193 13.378C0.456037 12.7958 0.36836 12.2066 0.322768 11.5964C0.30874 11.3719 0.30874 11.1615 0.287697 10.9511C0.24912 10.5338 0.287697 10.1094 0.242105 9.70608C0.242105 9.50618 0.175471 9.32381 0.150921 9.13092C0.0237819 8.54613 -0.014056 7.94545 0.038695 7.34932C0.0975597 7.01664 0.237262 6.70352 0.445516 6.43748C0.589025 6.25082 0.7461 6.07499 0.915464 5.91142C1.08555 5.74775 1.26722 5.59655 1.45906 5.45901C1.58352 5.35963 1.71743 5.2727 1.85887 5.19948C2.2156 5.03487 2.5996 4.93738 2.99165 4.9119C3.43545 4.88316 3.88104 4.90197 4.32084 4.96802C4.72415 5.04167 5.12746 5.11181 5.52376 5.18896C5.92006 5.26612 6.29181 5.37133 6.65655 5.46602C6.70565 5.46602 6.74773 5.50811 6.79683 5.52214C6.91257 5.5537 7.04584 5.56071 7.1756 5.59578C7.57135 5.69357 7.97791 5.74071 8.38554 5.73607C8.80072 5.74906 9.21604 5.71494 9.62354 5.63436C9.67655 5.61598 9.72812 5.59371 9.77785 5.56773C9.83747 5.54669 9.90761 5.56773 9.96372 5.53266C10.0198 5.49759 10.0409 5.47654 10.083 5.45901C10.2903 5.35956 10.4887 5.24221 10.6757 5.1083C10.8225 4.99645 10.9827 4.90337 11.1526 4.83124C11.2438 4.79617 11.335 4.75058 11.4227 4.72252C11.6115 4.6723 11.7939 4.60052 11.9663 4.50859C12.1764 4.35681 12.3745 4.18915 12.559 4.00708C12.7554 3.83172 12.9588 3.65637 13.1657 3.49855C13.59 3.14784 14.0214 2.85325 14.4212 2.5306C14.6281 2.35654 14.8485 2.19939 15.0805 2.06065C15.7728 1.54924 16.6371 1.32782 17.4899 1.4434C17.5673 1.46657 17.6476 1.47839 17.7284 1.47847C17.802 1.47847 17.8582 1.35222 17.9037 1.26805C18.0052 1.10546 18.0943 0.935474 18.1703 0.759524C18.2369 0.626255 18.2018 0.5 18.3351 0.5C18.4684 0.5 18.4509 0.850708 18.4579 0.990991C18.4469 1.1533 18.4469 1.31616 18.4579 1.47847C18.4745 1.5291 18.505 1.57403 18.5459 1.60814C18.5868 1.64224 18.6365 1.66415 18.6893 1.67136C18.763 1.67136 18.8121 1.61174 18.8822 1.56966C18.9459 1.53902 19.008 1.50507 19.0681 1.46795C19.1919 1.36569 19.3091 1.25558 19.4188 1.13829C19.51 1.0436 19.6538 0.822651 19.8081 0.843694C20.0676 0.87175 19.8081 1.26104 19.752 1.38729C19.6152 1.6889 19.4819 1.91335 19.3276 2.20093C19.261 2.31667 19.1137 2.47449 19.1137 2.59723C19.1137 2.71998 19.1873 2.73752 19.2259 2.8287C19.2645 2.91988 19.254 2.91638 19.2715 2.95495C19.3616 3.20096 19.4388 3.45147 19.503 3.70547C19.5626 3.90888 19.6117 4.12983 19.6853 4.33324C19.759 4.53665 19.8642 4.71902 19.9449 4.9119C19.9659 4.96451 19.9694 5.02764 19.9905 5.08024C20.1588 5.51161 20.3236 6.00261 20.527 6.41644C20.6379 6.60847 20.7038 6.82308 20.7199 7.04421C20.6995 7.27111 20.606 7.48525 20.4534 7.65444C20.3868 7.76316 20.2921 7.92448 20.1939 7.95956C20.118 7.96655 20.0417 7.96655 19.9659 7.95956C19.8607 7.95956 19.787 8.04022 19.6959 8.05074C19.5799 8.05658 19.4651 8.02587 19.3676 7.96295C19.27 7.90002 19.1947 7.80806 19.1523 7.70003C19.1371 7.62724 19.1277 7.55336 19.1242 7.47909C19.0673 7.22266 18.919 6.99574 18.7069 6.8408C18.5879 6.72014 18.452 6.61736 18.3036 6.53568C18.0651 6.41293 17.802 6.33929 17.553 6.20251C17.4689 6.14711 17.3697 6.11895 17.269 6.12185C17.1357 6.1464 17.0024 6.36384 16.9183 6.50061C16.2659 7.35985 15.6873 8.25415 15.0525 9.08533C14.6009 9.63504 14.1962 10.2216 13.8426 10.8389C13.761 11.011 13.693 11.1892 13.6391 11.3719C13.5725 11.5578 13.5409 11.7612 13.4708 11.9541C13.2253 12.6555 13.1517 13.5113 12.9272 14.2442C12.9027 14.3214 12.8956 14.4091 12.8711 14.4932C12.7694 14.8685 12.6677 15.2964 12.5484 15.6927C12.4633 16.05 12.4198 16.416 12.4187 16.7834C12.3726 17.1581 12.4072 17.5384 12.5204 17.8986C12.5905 18.0214 12.843 18.067 12.9377 18.1967C13.0324 18.3265 13.0464 18.4562 13.1131 18.5755C13.1797 18.6947 13.2884 18.828 13.2779 18.9542C13.2699 18.9971 13.2513 19.0372 13.2237 19.0709C13.1961 19.1046 13.1605 19.1308 13.1201 19.1471C13.0429 19.1857 12.9272 19.1471 12.8536 19.2032C12.7799 19.2594 12.8009 19.3716 12.7133 19.4382Z" />
            </svg>
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