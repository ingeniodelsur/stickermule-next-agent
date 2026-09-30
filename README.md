# Sticker Mule AI Quoting & Design Agent

An autonomous, multi-modal AI agent built specifically for Sticker Mule. This application seamlessly integrates conversational commerce, real-time database querying, and computer vision to handle custom sticker quoting and design validation without human intervention.

## Live Demo
**[https://stickermule-next-agent.vercel.app/](https://stickermule-next-agent.vercel.app/)**

## Core Architecture & AI Patterns

This project goes beyond a simple LLM wrapper, implementing enterprise-grade AI engineering patterns:

* **Autonomous Tool Calling (RAG):** The agent natively routes pricing inquiries to a PostgreSQL database (Supabase). It executes backend SQL functions to retrieve the live materials catalog, performs the mathematical quote calculation (Width × Height × Base Price × Quantity), and returns a precise Markdown table.
* **Multi-Modal Vision System:** Users can attach logo files directly in the chat. The agent leverages Gemini's Vision capabilities to analyze image resolution, color complexity, and print suitability before proceeding with the quote.
* **Context Sliding Window:** To optimize token consumption (TPM limits) and reduce latency, the application implements a sliding window memory system. It persists the entire chat history in PostgreSQL for analytics but strictly limits the active LLM context to the last 10 interactions.
* **Enterprise Guardrails:** Strict Prompt Engineering prevents prompt injection and off-topic interactions. The agent is strictly constrained to Sticker Mule products, custom printing, and design support.
* **Professional Error Handling:** Implements a robust `Exponential Backoff` algorithm (2s, 4s, 8s) on the client side to gracefully handle API rate limits (HTTP 429) during high-demand spikes, complete with transparent UI indicators.

## Tech Stack

* **Frontend:** Next.js 15 (App Router), React, Tailwind CSS v4, Lucide Icons.
* **Backend:** Next.js Serverless Route Handlers.
* **Database:** Supabase (PostgreSQL) with Row Level Security (RLS).
* **AI Provider:** Google Gemini API (`gemini-3.5-flash-lite` for high-throughput development).
* **Deployment:** Vercel (Edge-ready).

## Database Schema (Supabase)

```sql
-- Materials Catalog
CREATE TABLE materials (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    base_price_per_inch DECIMAL(10, 4) NOT NULL,
    in_stock BOOLEAN DEFAULT TRUE
);

-- Persistent Chat History
CREATE TABLE chat_history (
    id SERIAL PRIMARY KEY,
    session_id UUID NOT NULL,
    role VARCHAR(10) NOT NULL CHECK (role IN ('user', 'model')),
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

## Local Development Setup

1. Clone the repository:
   ```bash
   git clone [https://github.com/ingeniodelsur/stickermule-next-agent.git](https://github.com/ingeniodelsur/stickermule-next-agent.git)

2. Install dependencies:
    ```bash
    npm install

3. Configure Environment Variables (.env.local):
    ```Fragment code
    NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
    NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
    GEMINI_API_KEY=your_google_gemini_api_key

4. Run the development server:
    ```bash
    npm run dev

## UI/UX Highlights

* Syncs the backend sliding window context with the UI, visually fading out "archived" messages.
* Fully responsive layout with custom mobile padding and layout preservation.
* Zero-dependency native inline SVG for brand logos to ensure instant rendering.