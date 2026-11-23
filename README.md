# VEXGOAT

V5RC team and event data for 2026–27 Override, with a 2025–26 Push Back archive. Built with Next.js and deployed on Vercel.

## Competition data

VEXGOAT reads teams, events, matches, skills, awards, and qualification rankings through the server-side [VEX Events API v2](https://events.vex.com/api/v2/) (program 1). Override (season 204) is the default; Push Back (season 197) remains selectable. VEXGOAT labels calculated match summaries and predictions as estimates. A daily [Vercel cron](vercel.json) stores incremental Override ratings and skills data in Firestore collections ending in `_204`; historical collections remain separate.

Per the project owner, the existing `ROBOT_EVENTS_API_KEY` token is the VEX Events API token. Keep that variable in `.env.local` and Vercel's server environment; no replacement token is needed. `VEX_EVENTS_API_TOKEN` is an optional alias. `VEX_EVENTS_API_BASE_URL` optionally overrides `https://events.vex.com/api/v2`. Never use `NEXT_PUBLIC_` for credentials. The existing `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, and `CRON_SECRET` support stored ratings and the cron route.

The client has a 10-second timeout, retries rate limits and server errors, follows pagination metadata, deduplicates concurrent reads, and caches successful responses. The [official OpenAPI schema](https://events.vex.com/api/v2/swagger.yml) documents the endpoint paths and fields. Authenticated requests with the existing token returned HTTP 200 for season, event, team, match, ranking, skills, and award data on 2026-11-22. Repeatable tests include [recorded public response rows](tests/fixtures/vex-events-live-2026-11-22.json). In sampled matches, nonzero alliance scores appeared while `scored` was false; VEXGOAT shows those scores as provisional and uses official qualification rankings for published W/L/T records. The API has no documented worldwide skills leaderboard endpoint, so VEXGOAT links to the [official World Skills Standings](https://events.vex.com/robot-competitions/vex-robotics-competition/standings/skills) for worldwide rank, tiebreaks, and geographic or grade filters.

## Local development

After configuring `.env.local`:

```bash
npm install
npm run dev
```

Run `npm test`, `npm run lint`, `npx tsc --noEmit`, and `npm run build` before deployment. Live requests require outbound HTTPS access; the restricted shell network cannot connect, while an unrestricted request succeeded.
