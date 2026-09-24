import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// GET handler to fetch all sticker materials and their pricing
export async function GET() {
    try {
        // Query the 'materials' table from Supabase
        const { data, error } = await supabase
            .from('materials')
            .select('*')
            .order('id', { ascending: true });

        // Handle potential database errors
        if (error) {
            console.error("Database query error:", error.message);
            return NextResponse.json(
                { error: 'Failed to fetch materials from database' },
                { status: 500 }
            );
        }

        // Return the retrieved data successfully
        return NextResponse.json({ materials: data }, { status: 200 });

    } catch (err) {
        console.error("Unexpected server error:", err);
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 }
        );
    }
}
