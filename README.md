# MyTube

A YouTube-style video platform with an upload pipeline, a creator studio, AI-assisted metadata generation, and a full watch experience — built with Next.js 15, tRPC, Drizzle, Clerk, Mux, and Upstash QStash workflows.

## Features

**Watching**
- Infinite-scroll home feed with category filter carousel
- Full-text video search with per-channel search
- Video player (Mux) with autoplay-next, views tracking, likes/dislikes
- Comments with replies, comment likes/dislikes, and pinned author replies
- Channels with banners, about sections, and video/ playlists tabs
- Playlists, Liked videos, and Watch history

**Creator studio**
- Chunked video uploads (UploadThing → Mux direct upload)
- Thumbnail upload, AI thumbnail generation, and restore-to-default
- Visibility control (public / private)
- Real-time Mux processing status (video + subtitle tracks)
- Video link sharing and revalidation tools

**AI background jobs (QStash workflows)**
- AI title generation from the video transcript
- AI description generation from the video transcript
- AI thumbnail generation from a text prompt (Gemini image model)

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router), React 19 |
| Language | TypeScript |
| API layer | tRPC v11 + superjson (RSC hydration via `createHydrationHelpers`) |
| Database | Neon Postgres + Drizzle ORM (server-sql mode, push-only schema) |
| Auth | Clerk 6 (server middleware + svix webhook sync) |
| Video | Mux (assets, direct uploads, webhooks, player) |
| File uploads | UploadThing (thumbnails) + Mux uploader (videos) |
| Queue / jobs | Upstash QStash Workflows, Upstash Redis (rate limiting) |
| AI | Gemini via `@google/genai` |
| UI | Tailwind CSS v4, shadcn/ui, lucide-react, embla-carousel, react-hook-form + zod, sonner |
| Runtime | Bun |

## Architecture

```
src/
├── app/
│   ├── (auth)/                 # sign-in / sign-up
│   ├── (home)/                 # feed, search, watch, channels, subscriptions, history, playlists
│   ├── (studio)/studio/        # upload flow + video detail editor
│   └── api/
│       ├── users/webhook/      # Clerk svix webhook → upsert users
│       ├── videos/webhook/     # Mux webhook → status, thumbnails, preview, subtitles
│       ├── videos/workflows/   # QStash routes: title / description / thumbnail
│       ├── uploadthing/        # UploadThing router + callback
│       └── trpc/               # tRPC fetch handler
├── modules/                    # feature modules
│   └── <feature>/
│       ├── server/procedures.ts  # tRPC router for the feature
│       ├── ui/                   # components + sections
│       └── types.ts
├── trpc/                       # routers/_app.ts (12 routers), client, server init
├── db/                         # schema.ts (Drizzle tables + relations + zod schemas)
├── lib/                        # mux, redis, workflow, uploadthing, utils
└── components/                 # shared UI (shadcn/ui + app-level components)
```

Key flows:
- **Video lifecycle**: upload → Mux asset created → webhook updates `muxPlaybackId`/`muxTrackId` → studio shows live status → AI jobs become available once subtitles exist.
- **AI jobs**: tRPC mutation triggers `trigger()` on a QStash route; the route runs durable steps (`context.run`) and writes results back to the `videos` table.
- **Auth sync**: Clerk webhook inserts/updates the `users` table so videos, comments, and subscriptions join on a local user ID.
- **Rate limiting**: protected tRPC procedures use a sliding-window Upstash ratelimit (20 requests / 10s).

## Getting Started

### Prerequisites
- Node.js 18.18+ (or 20.x) and [Bun](https://bun.sh)
- [ngrok](https://ngrok.com) (for local webhook delivery)
- Accounts: Clerk, Neon, Mux, UploadThing, Upstash (Redis + QStash), Google AI Studio (Gemini)

### 1. Install

```bash
bun install
```

### 2. Configure environment

Create a `.env.local` in the project root with the following variables (values only — never commit secrets):

```bash
# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
NEXT_PUBLIC_CLERK_SIGN_IN_URL=
NEXT_PUBLIC_CLERK_SIGN_UP_URL=
NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=
NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=
CLERK_SECRET_KEY=
# Webhook signing secret for Clerk (svix)
CLERK_SIGN_IN_SECRET=

# Database (Neon)
DATABASE_URL=

# UploadThing
UPLOADTHING_TOKEN=

# Mux
MUX_TOKEN_ID=
MUX_TOKEN_SECRET=
MUX_WEBHOOK_SECRET=

# Upstash Redis (rate limiting)
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# Upstash QStash (workflows)
QSTASH_TOKEN=
QSTASH_URL=
QSTASH_CURRENT_SIGNING_KEY=
QSTASH_NEXT_SIGNING_KEY=
QSTASH_DEV=
UPSTASH_WORKFLOW_URL=

# Gemini
GEMINI_API_KEY=

# App
NEXT_PUBLIC_APP_URL=
```

`QSTASH_DEV` and `UPSTASH_WORKFLOW_URL` are optional and only needed for running workflows without deploying QStash.

### 3. Set up webhooks

- **Clerk**: point the `user.created` / `user.updated` / `user.deleted` webhook endpoint to `<your-domain>/api/users/webhook` and copy the signing secret into `CLERK_SIGN_IN_SECRET`.
- **Mux**: register `asset.upload.completed`, `asset.ready`, `asset.pending`, `asset.errored`, and `videoAssetTracker` events on `<your-domain>/api/videos/webhook`, then copy the webhook secret into `MUX_WEBHOOK_SECRET`.

For local development, run the tunnel first (it also starts `next dev`):

```bash
bun run dev:all
```

The configured ngrok domain is in `package.json` (`dev:webhook`); change it to your own.

### 4. Initialize the database

This project has no committed migrations. Push the schema straight to your Neon database:

```bash
bunx drizzle-kit push
```

Then seed the categories:

```bash
bunx tsx src/script/seed-categories.ts
```

## Scripts

| Command | Description |
|---|---|
| `bun run dev` | Start Next.js in development |
| `bun run dev:all` | `dev` + ngrok tunnel concurrently (for webhooks) |
| `bun run dev:webhook` | Start the ngrok tunnel only |
| `bun run build` | Production build |
| `bun run start` | Serve the production build |
| `bun run lint` | Next.js lint |

## Known Caveats

- **Schema is push-only**: there is no `drizzle/` migration directory; changes are synced with `drizzle-kit push` against the live database. Add committed migrations before sharing a database across environments.
- **QStash dev mode**: when `QSTASH_DEV` is set, builds print a "Dev mode active" notice — this is expected noise, not an error.
- **Rate limiting** currently applies only to protected mutations; reads are unrestricted.
- **Dark mode**: `next-themes` is installed but no `ThemeProvider` is wired up, so the `.dark` styles are dormant.
