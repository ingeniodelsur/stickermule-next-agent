import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize the Google Gemini SDK
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();

    const formattedHistory = messages.map((msg: { role: string; content: string }) => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }]
    }));

    // Prevent Gemini API error by ensuring the history doesn't start with a model message
    if (formattedHistory.length > 0 && formattedHistory[0].role === 'model') {
      formattedHistory.shift(); 
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-3.6-flash' });

    const lastMessage = formattedHistory.pop();
    
    const chat = model.startChat({
      history: formattedHistory,
    });

    const result = await chat.sendMessage(lastMessage.parts[0].text);
    const responseText = result.response.text();

    return NextResponse.json({ reply: responseText }, { status: 200 });

  } catch (error: any) {
    console.error("Gemini API error:", error);

    const errorMessage = error?.message?.toLowerCase() || '';
    
    // Check if the error is related to Google's servers being saturated (Rate Limit / 503)
    if (errorMessage.includes('503') || errorMessage.includes('service unavailable') || errorMessage.includes('429')) {
      return NextResponse.json(
        { code: "service_unavailable" }, 
        { status: 503 }
      );
    }

    // Fallback for any other type of error (API key issues, timeouts, etc.)
    return NextResponse.json(
      { code: "general_error" }, 
      { status: 500 }
    );
  }
}