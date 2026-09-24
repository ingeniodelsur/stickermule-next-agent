import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize the Google Gemini SDK using the API key from our environment variables
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(req: Request) {
  try {
    // Read the messages array sent from our frontend
    const { messages } = await req.json();

    // Format the messages to match Gemini's required structure { role, parts: [{ text }] }
    // Gemini uses strictly 'user' and 'model' as roles
    const formattedHistory = messages.map((msg: { role: string; content: string }) => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }]
    }));

    // FIX: Gemini strictly requires the conversation history to start with a 'user' message.
    // If the first message is the bot's initial greeting, we remove it from the history array.
    if (formattedHistory.length > 0 && formattedHistory[0].role === 'model') {
      formattedHistory.shift(); 
    }

    // Initialize the model (using gemini-1.5-flash for speed and lower cost)
    const model = genAI.getGenerativeModel({ model: 'gemini-3.6-flash' });

    // Extract the very last message from the array to send as the current prompt
    const lastMessage = formattedHistory.pop();
    
    // Now 'formattedHistory' is either empty or safely begins with a 'user' message
    const chat = model.startChat({
      history: formattedHistory,
    });

    // Send the new message to Gemini and wait for the response
    const result = await chat.sendMessage(lastMessage.parts[0].text);
    const responseText = result.response.text();

    // Send the generated text back to our frontend
    return NextResponse.json({ reply: responseText }, { status: 200 });

  } catch (error) {
    console.error("Gemini API error:", error);
    return NextResponse.json(
      { error: "Failed to communicate with AI Agent" }, 
      { status: 500 }
    );
  }
}
