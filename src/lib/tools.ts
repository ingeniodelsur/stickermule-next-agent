import { supabase } from './supabase';

// Defines the expected structure of a material returned by our database
export interface Material {
    id: number;
    name: string;
    base_price_per_inch: number;
    in_stock: boolean;
}

/**
 * Fetches the current pricing catalog from the Supabase database.
 * This function will be provided to the AI Agent as a tool.
 */
export async function getMaterialsCatalog(): Promise<Material[]> {
    const { data, error } = await supabase
        .from('materials')
        .select('*')
        .order('id', { ascending: true });

    if (error) {
        console.error('Error fetching materials for Agent:', error);
        throw new Error('Could not fetch materials catalog');
    }

    return data || [];
}
