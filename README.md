
# Rumrunners

A multiplayer browser crime game set in Britain, 1933.

## Technology
- Next.js 15
- React 19
- TypeScript
- PostgreSQL
- Prisma ORM

## Setup

1. Install Node.js 20+ and PostgreSQL.
2. Copy `.env.example` to `.env`.
3. Set `DATABASE_URL` to your PostgreSQL connection string.
4. Set `SESSION_SECRET` to a long, random secret.
5. Install dependencies:

   ```bash
   npm install
   ```

6. Generate the Prisma client:

   ```bash
   npx prisma generate
   ```

7. Create or update the database:

   ```bash
   npm run db:push
   ```

8. Start the development server:

   ```bash
   npm run dev
   ```

## Current features

- Player registration and login.
- Persistent player profiles.
- Crime system foundation.
- Keno: choose 10 numbers from 80, with 20 numbers drawn.
- Three-reel slots.
- Server-side casino results and wager processing.
- Casino transaction logging.

## Still in development

Blackjack, roulette, racetrack, auto theft, organised crime, player combat, market, properties, banking, rankings and messaging.

The navigation for these sections is scaffolding until their gameplay systems are implemented.

## Casino notes

Casino outcomes are generated server-side. Multipliers currently represent total returns, including the original stake. Slot reel weights are initial balancing values and should be reviewed before public launch.
