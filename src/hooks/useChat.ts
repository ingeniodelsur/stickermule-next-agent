import { useState, useEffect, useRef } from 'react';

export type Message = {
  id: string;
  role: 'user' | 'model';
  content: string;
  inlineData?: {
    data: string;
    mimeType: string;
  };
};

export function useChat() {
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
      setRetryCount(0); 
      
    } catch (error: any) {
      console.error("Chat error:", error);
      
      if (error.message === 'service_unavailable') {
        if (retryCount < MAX_RETRIES) {
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

  return {
    messages,
    input,
    setInput,
    selectedFile,
    fileInputRef,
    isLoading,
    countdown,
    retryCount,
    MAX_RETRIES,
    MAX_CONTEXT_MESSAGES,
    messagesEndRef,
    handleFileChange,
    clearFile,
    handleSend,
    handleCancelRetry
  };
}