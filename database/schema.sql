-- ==========================================
-- STICKER MULE AI AGENT - DATABASE SCHEMA
-- ==========================================

-- 1. Materials Table
-- Stores the available sticker types and their base pricing.
CREATE TABLE materials (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    base_price_per_inch DECIMAL(10, 2) NOT NULL,
    in_stock BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Insert default Sticker Mule catalog data
INSERT INTO materials (name, base_price_per_inch, in_stock) VALUES
('Die-cut (Troquelados)', 0.50, TRUE),
('Holographic (Holográficos)', 0.75, TRUE),
('Clear (Transparentes)', 0.60, TRUE),
('Transfer (Transferencia)', 0.90, TRUE);

-- ==========================================

-- 2. Chat History Table
-- Maintains conversation state so the LLM can remember previous context.
CREATE TABLE chat_history (
    id SERIAL PRIMARY KEY,
    session_id UUID DEFAULT gen_random_uuid(),
    role VARCHAR(50) NOT NULL, -- Identifies if the sender is 'user' or 'model'
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
