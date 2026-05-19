# ResumeAI

AI-powered job application assistant.

## Stack
- Next.js 16 + TypeScript
- PostgreSQL via Prisma
- NextAuth (Google, GitHub, Email magic link)
- Stripe subscriptions
- Sentry error tracking
- Python FastAPI worker (see `_extracted_worker/`)

## Dev setup
```bash
cp .env.production.template .env.local
# Fill in DATABASE_URL, NEXTAUTH_SECRET, Google/GitHub OAuth, Stripe keys
npm install
npm run db:push
npm run dev
```

## Deploy
Push to main → Vercel auto-deploys. Set env vars in Vercel dashboard.
Python worker is deployed separately as a Docker container.
