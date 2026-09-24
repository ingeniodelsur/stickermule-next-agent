'use client';

import { useState } from 'react';
import { Send, Bot, User } from 'lucide-react';

// Type definition for a chat message
type Message = {
  id: string;
  role: 'user' | 'model';
  content: string;
};

export default function Home() {
  // State to store conversation history in the UI
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'model',
      content: 'Hi! I am the Sticker Mule AI Assistant. How can I help you with your custom stickers today?'
    }
  ]);
  // State for the text input
  const [input, setInput] = useState('');
  // State to handle the "thinking" animation
  const [isLoading, setIsLoading] = useState(false);

  const handleSend = async () => {
    if (!input.trim()) return;

    // 1. Add user message to UI immediately
    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: input };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    // 2. TODO: Connect to Gemini AI API (To be implemented in Hour 10)
    // For now, we simulate a fake response delay
    setTimeout(() => {
      const botMsg: Message = { id: (Date.now() + 1).toString(), role: 'model', content: 'Agent backend connection pending...' };
      setMessages((prev) => [...prev, botMsg]);
      setIsLoading(false);
    }, 1000);
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
                {/* Avatar */}
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1 ${msg.role === 'user' ? 'bg-gray-300 text-gray-600' : 'bg-[#ffe8d6] text-[#f46b10] shadow-sm'}`}>
                  {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
                </div>
                {/* Message Bubble */}
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
        </div>

        {/* Input Area */}
        <div className="p-4 bg-white border-t border-gray-200">
          <div className="flex gap-2 relative max-w-4xl mx-auto">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="E.g., I need 2000 holographic stickers..."
              className="flex-1 p-4 pr-14 border border-gray-300 rounded-xl focus:outline-none focus:border-[#f46b10] focus:ring-1 focus:ring-[#f46b10] transition-all bg-gray-50 focus:bg-white"
            />
            <button
              onClick={handleSend}
              disabled={isLoading || !input.trim()}
              className="absolute right-2 top-2 bottom-2 aspect-square flex items-center justify-center bg-[#f46b10] text-white rounded-lg hover:bg-[#d95a0c] disabled:opacity-50 disabled:hover:bg-[#f46b10] transition-colors"
            >
              <Send size={20} className="ml-1" />
            </button>
          </div>
        </div>

      </div>
    </main>
  );
}
