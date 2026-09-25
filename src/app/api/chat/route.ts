import { NextResponse } from 'next/server';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { getMaterialsCatalog } from '@/lib/tools';

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
    const { messages } = await req.json();

    // 1. Construct the exact conversation history array
    const conversationHistory: any[] = messages.map((msg: { role: string; content: string }) => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }]
    }));

    // Prevent API error by ensuring the history starts with a 'user' message
    if (conversationHistory.length > 0 && conversationHistory[0].role === 'model') {
      conversationHistory.shift(); 
    }

    // Initialize the model with the tool and explicit instructions
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-3.6-flash',
      tools: [{ functionDeclarations: [getMaterialsTool] }],
      systemInstruction: "You are a professional quoting agent for Sticker Mule. Always use the 'getMaterialsCatalog' tool to get real-time prices before giving a quote. To calculate a quote: multiply the width x height to get square inches, multiply that by the base_price_per_inch of the requested material, and then multiply by the quantity. Present the final price clearly in USD. Be concise and friendly."
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