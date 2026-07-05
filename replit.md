# Dolphin Navigation

A maritime navigation PWA for inland waterway sailors — live GPS, SOG/COG readouts, and a full-screen map with Dolphin/Satellite/Hybrid modes.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- Frontend: `artifacts/dolphin/src/`
- Map logic: `src/components/MapView.tsx` — MapLibre GL init with WebGL fallback
- GPS hook: `src/hooks/useGeolocation.ts` — lifecycle-safe watchPosition wrapper
- Main page: `src/pages/DolphinApp.tsx`
- Theme: `src/index.css` — dark nautical palette, teal (#44e4c2) accent
- PWA: `public/manifest.webmanifest`, `public/sw.js`

## Architecture decisions

_Populate as you build — non-obvious choices a reader couldn't infer from the code (3-5 bullets)._

## Product

- Full-screen MapLibre GL map (OSM nautical, ESRI Satellite, Hybrid)
- Live GPS tracking: SOG in knots, COG in degrees, accuracy in meters
- Custom animated boat marker with heading rotation and pulsing ring
- Glass-morphism overlay UI (top bar, search, status strip, locate FAB, layer sheet)
- PWA-ready with service worker and web app manifest
- Dutch language UI

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
