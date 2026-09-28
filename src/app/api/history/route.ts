import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase'; // Import Supabase client

export async function GET(req: Request) {
  try {
    // Extract the sessionId from the URL query parameters
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
    }

    // Fetch messages from Supabase matching this session, ordered chronologically
    const { data, error } = await supabase
      .from('chat_history')
      .select('*')
      .eq('session_id', sessionId)
      .order('id', { ascending: true });

    if (error) {
      console.error("Error fetching history from DB:", error);
      throw error;
    }

    return NextResponse.json({ messages: data }, { status: 200 });

  } catch (error: any) {
    console.error("History retrieval error:", error);
    return NextResponse.json({ error: "Failed to fetch history" }, { status: 500 });
  }
}