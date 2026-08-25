# AskOps (prototype)

Internal knowledge assistant. Ask questions, get answers from the ops corpus.

## Run it

```bash
docker compose up -d
npm install
npm run db:migrate
npm run ingest
npm run dev
```

Open http://localhost:3000 and ask something like "How do I set up the VPN?".

Set `ANTHROPIC_API_KEY` in `.env` for LLM answers. Without it you get the raw
best matching chunk back.
