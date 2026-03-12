# CLAUDE.md — Talwa Project Reference

This file is the canonical reference for the Talwa codebase. Read it before writing any code.

---

## What Is Talwa

Talwa is a place-based community engagement platform. Project creators define geographic features on a map and collect structured community feedback via AI-facilitated conversations. The AI extracts data points from those conversations, synthesizes them into themes, and presents insights through a dual interface: a map (spatial entry point) and a chat analyst bot (primary exploration workspace).

There are two primary user experiences:
- **Contributors** — browse projects, engage in AI-facilitated dialogue, generate design sketches
- **Project Creators / Admins** — configure projects, review insights, manage contributors, export reports

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js (App Router) |
| Database | Supabase (PostgreSQL + PostGIS) |
| Auth | Supabase Auth |
| File Storage | Supabase Storage |
| Map | Mapbox GL JS |
| AI Chat / Streaming | Vercel AI SDK (`useChat`) |
| AI Models | OpenAI GPT-5 family (see below) |
| Styling | Tailwind CSS + shadcn/ui |
| Deployment | Vercel |

### Model Assignments
- **Facilitator (contributor chat):** `gpt-5` — streaming, with tools
- **Data Point Extraction:** `gpt-5-nano` — structured JSON output
- **Theme Synthesis:** `gpt-5-mini` — structured JSON output
- **Data Point Classification:** `gpt-5-nano` — structured JSON output
- **Image Generation (sketches):** `gpt-image-1` (optional)

---

## Project Structure

```
/app
  /api
    /facilitator        → Streaming chat endpoint (contributor flow)
    /extract            → Data point extraction workflow
    /synthesize         → Theme synthesis workflow
    /classify           → Data point classification workflow
    /images             → Sketch generation (optional, server-side only)
  /(auth)
    /login
    /signup
  /(contributor)
    /explore            → Browse/filter public projects
    /projects/[id]      → Project detail + contributor chat + map
  /(creator)
    /dashboard          → Creator home
    /projects/new       → Create project
    /projects/[id]
      /insights         → Analyst bot + insights map
      /features         → Manage map features
      /contributors     → Manage users
      /conversations    → Raw transcript viewer
      /sketches         → Community sketches
      /updates          → Post project updates
      /configure        → Edit project settings, frameworks, files
/components
  /map                  → Mapbox components
  /chat                 → Chat UI components (facilitator + analyst)
  /cards                → ThemeCard, DataPointCard, SketchCard
  /ui                   → shadcn/ui base components
/lib
  /supabase             → Client, server, and admin Supabase instances
  /openai               → OpenAI client setup
  /prompts              → All system prompts (facilitator, analysis workflows)
  /types                → TypeScript types mirroring DB schema
/hooks
  useFacilitator.ts     → Wraps useChat for contributor flow
  useAnalyst.ts         → Wraps useChat for insights/analyst flow
  useMap.ts             → Mapbox state management
/supabase
  /migrations           → SQL migration files
  /functions            → Supabase Edge Functions (extraction trigger)
```

---

## AI Endpoints

### POST /api/facilitator
Streaming chat for contributors. Uses `gpt-5` with the four registered tools.

**System prompt context includes:**
- Project name, description, dialogue framework questions
- Current feature context (if feature is selected on map)
- Project files (uploaded supporting documents)

**Tools available to the model:**
```typescript
reset_location()
// Clears current location tag. Call when user moves to a new topic
// with no location relevance.

surface_theme(theme_id: string | null)
// Posts a theme card into chat. Backend fetches theme + its data points
// and returns them as context for the card render.
// Pass null to return to the themes overview from a drilled-down state.

surface_data_point(data_point_id: string)
// Posts a data point card into chat when a map marker is selected.
```

**Note:** `publish_image` is intentionally excluded from client-side tools.
Image generation hits the OpenAI images endpoint and must be server-side only via `/api/images`.

**Location metadata pattern:** The Vercel AI SDK `useChat` sends messages as plain strings.
Use the `body` option to pass lat/lng metadata alongside each message when a pin has been dropped.
This must be handled consistently across all chat components — never ad-hoc.

```typescript
// Pattern for all useChat instances that support location
const { messages, append } = useChat({
  api: '/api/facilitator',
  body: {
    location: activePin ?? null,   // { lat: number, lng: number } | null
    feature_id: activeFeature ?? null
  }
})
```

### POST /api/extract
**NOT called directly by the client.** Triggered automatically by a Supabase pg_cron job
(see Extraction Trigger section below).

**Input:** Full conversation transcript + project's analytical framework (research questions)

**Output:** Structured JSON array of data points
```typescript
{
  data_points: [
    {
      content: string,
      research_question: string,
      location: { lat: number, lng: number } | null,
      transcript_reference: string
    }
  ]
}
```

### POST /api/synthesize
Triggered after new data points are extracted.

**Input:** New data points + existing theme summaries (if any) for the same research question bucket

**Output:** Structured JSON
```typescript
{
  assignments: [
    { data_point_id: string, theme_id: string }
  ],
  theme_updates: [
    { theme_id: string, updated_summary: string }
  ],
  new_themes: [
    { name: string, summary: string, research_question: string, rationale: string }
  ]
}
```

**Important:** Theme IDs persist across updates. Prompts must include guardrails against
over-collapsing or unnecessary proliferation of themes. Prefer refinement over merging
unless themes are clearly redundant.

### POST /api/classify
Maps data points to theme IDs. Used for incremental updates and backfills.

**Input:** Data points + current theme list with summaries

**Output:**
```typescript
{
  classifications: [
    { data_point_id: string, theme_id: string }
  ]
}
```

---

## Extraction Trigger

The extraction workflow is triggered by a **Supabase pg_cron job**, not a client call or Vercel Cron.

**Mechanism:**
1. Every new message upserts `conversations.last_message_at = now()`
2. pg_cron runs every 2 minutes and queries:
   ```sql
   SELECT id FROM conversations
   WHERE extraction_status = 'pending'
   AND last_message_at < now() - interval '5 minutes'
   ```
3. For each matching conversation, pg_cron calls the Supabase Edge Function `trigger-extraction`,
   which sets `extraction_status = 'processing'` and POSTs to `/api/extract`
4. On completion, `/api/extract` sets `extraction_status = 'complete'`
5. On failure, set `extraction_status = 'failed'` (allows retry logic)

**Why pg_cron over Vercel Cron:** Keeps the trigger logic co-located with the data,
avoids cold-start latency on Vercel free tier, and doesn't require a paid Vercel plan.

---

## Data Model

```typescript
type User = {
  id: string
  name_first: string
  name_last: string
  avatar: string | null
  email: string
  user_type: 'community_contributor' | 'project_creator' | 'admin'
}

type Project = {
  id: string
  name: string
  short_description: string
  long_description: string
  featured_image: string | null
  contributor_count: number
  status: 'draft' | 'active' | 'completed' | 'archived'
  location: string
  publicly_visible: boolean
  creator_id: string
  dialogue_framework: string[]     // Guiding questions for the facilitator
  created_at: string
}

type ProjectFollower = {
  user_id: string
  project_id: string
  created_at: string
}

type ProjectAccess = {
  id: string
  user_id: string
  project_id: string
  permissions: ProjectPermission[]
  role: string
}

type ProjectPermission =
  | 'contribute'
  | 'update_project'
  | 'manage_users'
  | 'generate_reports'
  | 'manage_files'
  | 'configure_frameworks'

type Invitation = {
  id: string
  invitee_email: string
  invitee_first_name: string
  invitee_last_name: string
  project_id: string
  permissions: ProjectPermission[]
  status: 'pending' | 'accepted' | 'expired' | 'declined'
  expiration: string
}

type Feature = {
  id: string
  project_id: string
  name: string
  type: 'path' | 'park' | 'plaza' | 'landmark' | 'other'
  description: string
  geojson: string
  creator_id: string
}

type Perspective = {
  id: string
  project_id: string
  feature_id: string
  image: string
  caption: string
  creator_id: string
}

type Sketch = {
  id: string
  project_id: string
  feature_id: string
  perspective_id: string | null
  image: string
  caption: string
  creator_id: string
}

type Conversation = {
  id: string
  project_id: string
  creator_id: string               // The contributor
  last_message_at: string          // Updated on every new message; used by extraction cron
  extraction_status: 'pending' | 'processing' | 'complete' | 'failed'
  created_at: string
}

type Message = {
  id: string
  conversation_id: string
  sender: 'human' | 'ai_facilitator'
  content: string
  referenced_feature_ids: string[]
  location: { lat: number, lng: number } | null
  creator_id: string
  created_at: string
}

type AnalyticalFramework = {
  id: string
  project_id: string
  name: string
  research_questions: string[]
  creator_id: string
}

type DataPoint = {
  id: string
  project_id: string
  conversation_id: string
  content: string
  research_question: string
  feature_id: string | null
  location: { lat: number, lng: number } | null  // Bubbled up from message metadata
  theme_ids: string[]
  // NOTE: No embedding field — Talwa does not use a vector DB or RAG.
  // All analysis is handled through structured prompting and progressive context supply.
  creator_id: string
}

type Theme = {
  id: string
  project_id: string
  name: string
  summary: string
  research_question: string
  creator_id: string
}

type ProjectFile = {
  id: string
  project_id: string
  name: string
  file_url: string
  description: string
}

type ProjectUpdate = {
  id: string
  project_id: string
  title: string
  content: string
  creator_id: string
  created_at: string
}

type Notification = {
  id: string
  user_id: string
  content: string
  status: 'unread' | 'read'
  type: 'new_update' | 'new_insight' | 'access_granted' | 'invitation'
  link: string
  project_id: string
}

type DialogueTemplate = {
  id: string
  name: string
  description: string
  questions: string[]
  // Reusable library of starting frameworks; not project-specific
}
```

---

## Key Interaction Patterns

### Contributor Flow (Map + Chat)

1. Contributor selects a project and lands on the engagement view
2. Map shows project features (GeoJSON polygons/paths/markers)
3. Chat panel shows the AI facilitator, initialized with dialogue framework
4. Contributor chats; facilitator may ask them to drop a pin on the map
5. Clicking a map feature posts context to chat; facilitator shifts focus
6. Conversation goes quiet (5 min) → pg_cron triggers extraction automatically
7. Extraction → synthesis → classification workflows run in sequence

### Insights Flow (Creator / Admin)

1. Creator opens the insights view: map + analyst bot
2. Analyst bot presents theme cards for the project
3. Clicking a theme: map filters to supporting data point markers; bot shows theme detail
4. Clicking a data point marker: card posts in chat; bot can drill to transcript excerpts
5. Progressive context disclosure:
   - Initial: bot has themes only
   - On theme selection: supporting data points are supplied
   - On data point selection: transcript excerpts are supplied
6. `surface_theme(null)` resets analyst bot to themes overview

### Mobile Chat/Map Handoff

- Map view: floating chat bubble (top-right), badge/pulse when context is waiting
- Tapping a map marker → posts data point card to chat → bubble activates
- Chat → map: bot surfaces an action card with "Go to Map" button when pin is needed
- After pin drop → bubble activates to bring user back to chat
- Single-pane mobile UI; desktop supports split-pane

---

## Prompt Engineering Notes

- System prompts live in `/lib/prompts/` as template strings, not hardcoded in route handlers
- Analysis workflows use structured output (JSON schema) — never freeform text
- Facilitator prompt must include: project context, dialogue framework questions,
  current feature context (if any), instruction to request location pins when locations are mentioned
- Analyst bot uses progressive context disclosure: themes only at first; supply data points
  when a theme is selected; supply transcript excerpts when a data point is selected
- No vector DB / RAG — rely on structured prompting and progressive context supply
- Theme synthesis prompts must include guardrails against over-collapsing or
  unnecessary proliferation of themes

---

## Brand & Design System

### Color Tokens
| Token | Hex | Usage |
|---|---|---|
| `talwa-olive-black` | `#1F1E0A` | Deep background, darkest text |
| `talwa-olive` | `#ADA739` | Logo mark, accents |
| `talwa-olive-light` | `#DBD894` | Secondary warm accent, subtle highlights |
| `talwa-navy` | `#031D25` | Dark UI surfaces, footers, primary text |
| `talwa-teal` | `#0A4F66` | Wordmark, buttons, links, primary interactive |
| `talwa-sky` | `#C7EDFA` | Light backgrounds, hover states, badges |
| `talwa-burnt-orange` | `#BD4F00` | Alert / CTA accent (use sparingly) |
| `talwa-cream` | `#FAFAEF` | Default page background, card backgrounds |

Default background: `talwa-cream`. Primary text: `talwa-navy`. Interactive elements: `talwa-teal`.

### Typography
- **Headings:** Fraunces (serif) — `font-heading`
- **Body / UI:** Source Sans 3 (sans-serif) — `font-sans`

### Logo Assets (`/public/brand/`)
- `brand-mark.png` — Icon-only mark (olive on black)
- `lockup.png` — Stacked lockup (mark + wordmark)
- `lockup-horizontal.png` — Horizontal lockup for nav bars
- `social-image.jpg` — OG / social share image

Never recolor logo assets. Use black-background variants on dark surfaces.

---

## Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=   # replaces legacy anon key — safe for client/browser
SUPABASE_SECRET_KEY=                    # replaces legacy service_role key — server-side only, never expose to client
NEXT_PUBLIC_MAPBOX_TOKEN=
OPENAI_API_KEY=
EXTRACTION_SECRET=                      # Shared secret for Edge Function → /api/extract auth
NEXT_PUBLIC_APP_URL=                    # Full URL of the Next.js deployment (for Edge Function callback)
```

### Supabase API Key Notes
Supabase has replaced the legacy `anon` and `service_role` JWT-based keys with:
- **Publishable key** (`sb_publishable_...`) — used anywhere the old `anon` key was used (Supabase client init on the client side)
- **Secret key** (`sb_secret_...`) — used anywhere the old `service_role` key was used (server-side admin operations, bypasses RLS)

**Edge Function caveat:** The new secret key does not support built-in JWT verification in Edge Functions.
Use `--no-verify-jwt` when deploying the `trigger-extraction` function and implement
authorization manually inside the function (verify the key matches `Deno.env.get('SUPABASE_SECRET_KEY')`).

---

## Conventions

- Use server components by default; add `'use client'` only when needed
- All Supabase DB calls go through `/lib/supabase/` helpers, never inline
- Client helper initializes with `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`; server/admin helper uses `SUPABASE_SECRET_KEY`
- All OpenAI calls go through `/lib/openai/` — never import the SDK directly in components
- Route handlers in `/app/api/` are thin: validate input, call a lib function, return response
- Location metadata must always flow through the `body` option in `useChat`, never appended to message content
- TypeScript strict mode on — no `any`
- Prefer explicit types from `/lib/types` over inferring from Supabase generated types
- `publish_image` is server-side only — never expose image generation as a client tool
- All map components must use `dynamic(() => import(...), { ssr: false })` to prevent SSR crashes
