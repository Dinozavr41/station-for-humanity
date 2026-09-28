# Agent Reach Tender Radar

Agent Reach is added as a DISCOVER/FETCH layer for the RPK tender pipeline. It does not replace the official EIS 44-FZ reader and it never submits a bid.

Files:
- ops/install-agent-reach.ps1 — safe Windows bootstrap (no --system).
- ops/agent-reach-tender.config.json — RPK tender queries/categories.
- ops/agent-reach-tender-radar.mjs — Agent Reach/Exa discovery, Jina enrichment, scoring, JSONL output and optional push.
- supabase/functions/agent-reach-tender-ingest/index.ts — token-guarded ingest into business_opportunities.

Run:
1. powershell -ExecutionPolicy Bypass -File .\ops\install-agent-reach.ps1
2. node .\ops\agent-reach-tender-radar.mjs
3. Configure AGENT_REACH_INGEST_URL and AGENT_REACH_INGEST_TOKEN, then use --push.

Safety:
- only known public procurement hosts are accepted by ingest;
- every hit has requires_human_review=true and auto_submit=false;
- only official zakupki.gov.ru + explicit 44-FZ is marked combat_44fz_eligible;
- existing STOP PRICE, tender economics, KEP and owner approval rules stay unchanged.
