# finpal

Track expenses and budget around savings goals (an emergency fund, then investing), using bank data from the [Finverse API](https://www.finverse.com/). Amounts are in Malaysian ringgit (RM).

## Layout

| Path | What it is |
| --- | --- |
| `apps/app` | Expo app (Expo Router) for iOS, Android and web |
| `apps/api` | Fastify backend; holds the Finverse secret and bank tokens |
| `packages/shared` | Types and money/budget logic shared by both |

## Setup

Requires Node 20+ and pnpm (`corepack enable`).

1. Create a free [Supabase](https://supabase.com/) project and copy its URL and anon key (Project Settings, API).
2. Copy `apps/app/.env.example` to `apps/app/.env` and `apps/api/.env.example` to `apps/api/.env`, then fill in the Supabase values.
3. Install and run:

```sh
pnpm install
pnpm api   # backend on http://localhost:4000
pnpm app   # Expo dev server: press w for web, or scan the QR code with Expo Go
```

On a physical phone, set `EXPO_PUBLIC_API_URL` to your computer's LAN IP, not `localhost`.

## Bank linking (Finverse sandbox)

1. Run the files in `supabase/migrations` in order in the Supabase SQL editor (or `supabase db push`).
2. In `apps/api/.env`, fill in `SUPABASE_SERVICE_ROLE_KEY`, the Finverse client ID and secret, and `TOKEN_ENCRYPTION_KEY` (`openssl rand -base64 32`).
3. Register `FINVERSE_REDIRECT_URI` (default `http://localhost:4000/link/callback`) as a redirect URI in the Finverse developer portal, and confirm the sandbox API host there.
4. In the app, tap **Link a bank**, pick a sandbox bank, and log in with its test credentials. The app then polls `/sync` until Finverse has the data.

Until all of those settings are present, `/health` reports `bankLinking: false` and the bank routes answer 503.

## Checks

```sh
pnpm typecheck
pnpm test
```

Never commit `.env` files. The Finverse client secret belongs only in `apps/api/.env` or your host's secret settings.
