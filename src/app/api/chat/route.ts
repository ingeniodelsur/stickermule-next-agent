import { NextResponse } from 'next/server';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { getMaterialsCatalog } from '@/lib/tools';
import { supabase } from '@/lib/supabase'; // Import Supabase client to save chat history

// Initialize the Google Gemini SDK
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

// Define the tool for Gemini
const getMaterialsTool = {
  name: "getMaterialsCatalog",
  description: "Retrieves the current catalog of sticker materials, including their names, base prices per square inch, and stock availability from the database. Call this tool whenever a customer asks for a quote, price calculation, or asks what materials are available.",
  parameters: {
    type: SchemaType.OBJECT,
    properties: {}, // No parameters required to fetch the full catalog
  },
};

export async function POST(req: Request) {
  try {
    // Extract isRetry flag to prevent duplicate DB entries
    const { messages, sessionId, isRetry } = await req.json();

    // 1. Construct the exact conversation history array
    // NEW: Updated mapping to support multi-modal parts (text + inline images)
    const conversationHistory: any[] = messages.map((msg: any) => {
      const parts: any[] = [{ text: msg.content }];
      
      // NEW: If the message contains inlineData (Base64 image), append it to the parts array
      if (msg.inlineData) {
        parts.push({
          inlineData: {
            data: msg.inlineData.data,
            mimeType: msg.inlineData.mimeType
          }
        });
      }

      return {
        role: msg.role === 'user' ? 'user' : 'model',
        parts: parts
      };
    });

    // Prevent API error by ensuring the history starts with a 'user' message
    if (conversationHistory.length > 0 && conversationHistory[0].role === 'model') {
      conversationHistory.shift(); 
    }

    // Extract the latest user message and save it to the database ONLY if it is not a retry
    const latestUserMessage = messages[messages.length - 1];
    if (sessionId && latestUserMessage.role === 'user' && !isRetry) {
      // Note: We only save the text content to DB to save space, not the massive base64 image string
      const { error: insertUserError } = await supabase.from('chat_history').insert([
        { session_id: sessionId, role: 'user', content: latestUserMessage.content }
      ]);
      if (insertUserError) console.error("Error saving user message to DB:", insertUserError);
    }

    // Initialize the model with the tool, formatting rules, strict guardrails, AND vision capabilities
    const model = genAI.getGenerativeModel({ 
      // FIX: Switched from gemini-3.6-flash to gemini-3.5-flash-lite to increase free tier RPD limit from 20 to 500
      model: 'gemini-3.5-flash-lite', 
      tools: [{ functionDeclarations: [getMaterialsTool] }],
      systemInstruction: `You are a professional quoting and design-support agent for Sticker Mule. 
      
      CORE CAPABILITIES:
      1. QUOTING: Always use the 'getMaterialsCatalog' tool to get real-time prices. To calculate a quote: multiply width x height to get square inches, multiply by the base_price_per_inch, and multiply by quantity. 
      2. VISION & DESIGN: If a user uploads an image (a logo or artwork), analyze its visual quality, colors, complexity, and resolution. Advise them if it looks suitable for high-quality sticker printing or if they might need a vector/higher-resolution version.
      
      CRITICAL FORMATTING RULE: You MUST present final quotes using a structured Markdown table containing exactly these columns: 'Material', 'Size (inches)', 'Quantity', and 'Total Cost (USD)'. Do not use plain text for math breakdowns.
      
      SECURITY GUARDRAIL (STRICT): You are exclusively a Sticker Mule agent. If a user asks about topics unrelated to custom stickers, labels, packaging, logo design, or Sticker Mule services, you MUST politely decline and redirect the conversation.`
    });

    // 2. First call to the model sending the entire history
    const result1 = await model.generateContent({ contents: conversationHistory });
    const aiResponse = result1.response;
    const functionCalls = aiResponse.functionCalls();

    let finalResponseText = '';

    // 3. Handle Tool Calling if the AI decides it needs database info
    if (functionCalls && functionCalls.length > 0) {
      const call = functionCalls[0];
      
      if (call.name === "getMaterialsCatalog") {
        console.log("🛠️ Agent triggered Tool: Fetching materials from Supabase...");
        
        // Execute our backend function to query Postgres
        const materialsData = await getMaterialsCatalog();
        
        // Append the model's 'thought process' (function call) to the history
        if (aiResponse.candidates && aiResponse.candidates.length > 0) {
             conversationHistory.push({ 
                 role: "model", 
                 parts: aiResponse.candidates[0].content.parts 
             });
        }
        
        // Append the database result explicitly as a 'user' role to avoid SDK bugs
        conversationHistory.push({ 
            role: "user", 
            parts: [{ 
                functionResponse: { 
                    name: call.name, 
                    response: { catalog: materialsData } 
                } 
            }] 
        });

        // 4. Second call to the model with the newly injected data
        const result2 = await model.generateContent({ contents: conversationHistory });
        finalResponseText = result2.response.text();
      }
    } else {
      // If no tool was called, just use the standard text response
      finalResponseText = aiResponse.text();
    }

    // Save the AI's final response to the database
    if (sessionId && finalResponseText) {
      const { error: insertModelError } = await supabase.from('chat_history').insert([
        { session_id: sessionId, role: 'model', content: finalResponseText }
      ]);
      if (insertModelError) console.error("Error saving model message to DB:", insertModelError);
    }

    return NextResponse.json({ reply: finalResponseText }, { status: 200 });

  } catch (error: any) {
    console.error("Gemini API error:", error);
    const errorMessage = error?.message?.toLowerCase() || '';
    
    if (errorMessage.includes('503') || errorMessage.includes('service unavailable') || errorMessage.includes('429')) {
      return NextResponse.json({ code: "service_unavailable" }, { status: 503 });
    }

    return NextResponse.json({ code: "general_error" }, { status: 500 });
  }
}