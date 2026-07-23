# Spec: Observe Dashboard — Real-Time Storefront Telemetry

## Purpose

A `/observe` route in the Aisles SvelteKit app that acts as a "man behind the curtain" view during demos. One browser shows the storefront (the shopper's experience); the other shows `/observe` (what's actually happening — signals, inference, layout decisions, persona shifts). The goal is to make the invisible visible: show the aisles moving in real time.

## Demo Setup

```
┌─────────────────────────┐  ┌──────────────────────────────┐
│   Haven Storefront       │  │   Observe Dashboard           │
│   (shopper POV)          │  │   (architect POV)             │
│                          │  │                               │
│   Browsing Living Room   │  │   Session: abc-123            │
│   as Gatherer...         │  │   ┌─ Signal Timeline ───────┐│
│                          │  │   │ 12:01 request.pageview   ││
│                          │  │   │ 12:01 request.device     ││
│                          │  │   │ 12:03 nav.category_view  ││
│                          │  │   │ 12:05 nav.search "dorm"  ││
│                          │  │   └──────────────────────────┘│
│   [layout shifts to      │  │   ┌─ Persona Vector ────────┐│
│    Hunter grid]           │  │   │ gatherer ████░░░░ 35%   ││
│                          │  │   │ hunter   ██████░░ 55%  ↑ ││
│                          │  │   │ researcher ██░░░░ 17%   ││
│                          │  │   │ gifter   █░░░░░░  7%   ││
│                          │  │   │                          ││
│                          │  │   │ SHIFT DETECTED           ││
│                          │  │   │ gatherer → hunter        ││
│                          │  │   │ trigger: "dorm room desk"││
│                          │  │   └──────────────────────────┘│
│                          │  │   ┌─ Layout Decision ───────┐│
│                          │  │   │ model: haiku (2.1s)      ││
│                          │  │   │ cache: MISS              ││
│                          │  │   │ sections: 4              ││
│                          │  │   │ tokens: 892 in / 340 out ││
│                          │  │   └──────────────────────────┘│
└─────────────────────────┘  └──────────────────────────────┘
```

## Architecture

### Data Flow

The observe dashboard polls a server endpoint for the current session state. No WebSocket needed — polling every 2 seconds is sufficient for demo pace.

```
Storefront (shopper)              Server                    Dashboard (/observe)
────────────────────              ──────                    ────────────────────
emitter → /api/signals ──→ Redis session store ←── /api/observe/session (poll)
                          ──→ Postgres gen_logs  ←── /api/observe/logs (poll)
```

### New Endpoints

**`GET /api/observe/session?id={sessionId}`**

Returns the current session's full state:
```json
{
  "sessionId": "abc-123",
  "events": [
    { "type": "request.pageview", "timestamp": 1775500000, "data": { "referrer": "..." } },
    { "type": "nav.category_view", "timestamp": 1775500010, "data": { "category": "living-room" } },
    { "type": "nav.search", "timestamp": 1775500030, "data": { "query": "dorm room desk" } }
  ],
  "inference": {
    "probabilities": { "gatherer": 0.35, "hunter": 0.55, "researcher": 0.17, "gifter": 0.07 },
    "primary": "hunter",
    "confidence": 0.20,
    "modifiers": { "priceSensitivity": 0.45, "urgency": 0.0, "familiarityWithStore": 0.28 },
    "shift": { "detected": true, "from": "gatherer", "trigger": "search query \"dorm room desk\"" },
    "signalCount": 5
  },
  "eventCount": 5
}
```

**`GET /api/observe/logs?limit=20`**

Returns recent generation logs:
```json
{
  "logs": [
    {
      "type": "layout",
      "persona": "hunter",
      "categorySlug": "office",
      "cacheHit": false,
      "generationMs": 2100,
      "inputTokens": 892,
      "outputTokens": 340,
      "createdAt": "2026-04-06T17:00:00Z"
    }
  ]
}
```

**`GET /api/observe/sessions`**

Returns active session IDs (from Redis) so the dashboard can pick one to watch.

### Page Route: `/observe`

A single SvelteKit page with these panels:

#### 1. Session Picker (top bar)
- Dropdown of active session IDs from `/api/observe/sessions`
- "Watch latest" toggle — auto-switches to the most recently active session
- Session metadata: visit count, stored persona, current category

#### 2. Signal Timeline (left panel)
- Chronological list of all SignalEvent objects in the session
- Each event shows: timestamp, type badge (color-coded by source), key data
- New events animate in at the top
- Source color coding: request=slate, navigation=blue, interaction=amber, commerce=green, refinement=purple

#### 3. Persona Vector (right panel, top)
- Horizontal bar chart of all 4 persona probabilities
- Animates on update — bars slide smoothly
- Primary persona highlighted
- Confidence gap shown
- Modifier gauges below: price sensitivity, urgency, familiarity (0-100%)
- Shift detection alert: flashes when a shift is detected, shows from→to and trigger

#### 4. Layout Decision Log (right panel, bottom)
- Most recent layout/refine generation
- Shows: model used (Haiku/Sonnet), cache hit/miss, generation time, token usage
- Cumulative stats: total generations, cache hit rate, average generation time, total tokens

#### 5. Product Enrichment View (expandable)
- Table of products in the current category with persona-fit scores
- Sorted by the current persona's fit score
- Semantic tags shown as pills
- Highlights which products the AI chose for hero/featured vs grid

### Styling

Use the same brand tokens (Haven design system) but with a dark theme to visually distinguish from the storefront. The dashboard should feel like a mission control — information-dense, monospace numbers, no editorial copy.

### Polling Strategy

```typescript
// Poll every 2 seconds
const POLL_INTERVAL = 2000;

let sessionId = $state<string | null>(null);
let sessionData = $state(null);
let logs = $state([]);

$effect(() => {
  if (!sessionId) return;
  
  const interval = setInterval(async () => {
    const [session, genLogs] = await Promise.all([
      fetch(`/api/observe/session?id=${sessionId}`).then(r => r.json()),
      fetch(`/api/observe/logs?limit=20`).then(r => r.json()),
    ]);
    sessionData = session;
    logs = genLogs.logs;
  }, POLL_INTERVAL);
  
  return () => clearInterval(interval);
});
```

### What Already Exists (no new code needed)

- `SignalStore.getEvents()` — returns all session events
- `SignalStore.toInferenceContext()` → `infer()` — produces the persona vector
- `getSessionStore(sessionId)` — retrieves any session from Redis
- `generation_logs` table — all layout/refine calls with full metadata
- `enriched_products` table — persona-fit scores and semantic tags

### What Needs to Be Built

| Component | Effort | Notes |
|---|---|---|
| `/api/observe/session` endpoint | Small | Read from Redis session store |
| `/api/observe/logs` endpoint | Small | SELECT from generation_logs |
| `/api/observe/sessions` endpoint | Small | Scan Redis for `aisles:session:*` keys |
| `/observe/+page.svelte` | Medium | The main dashboard UI with 5 panels |
| Animated probability bars | Small | CSS transitions on width changes |
| Signal timeline component | Small | Scrollable list with color-coded badges |
| Dark theme variant | Small | Tailwind dark classes or a separate CSS layer |

### Security

The `/observe` route and its API endpoints should be gated behind a URL parameter or basic auth — it exposes session data. For the demo, `?key=aisles-observe` is sufficient. Production would need proper auth.

### Build Sequence

1. **API endpoints** — `/api/observe/session`, `/api/observe/logs`, `/api/observe/sessions`
2. **Page shell** — `/observe` with layout, dark theme, session picker
3. **Signal timeline panel** — chronological event list with polling
4. **Persona vector panel** — animated bars, shift detection alert
5. **Layout decision panel** — latest generation details, cumulative stats
6. **Product enrichment panel** — expandable table with fit scores
7. **Polish** — animations, auto-scroll, "watch latest" mode

### Demo Script

The intended demo flow:

1. Open two browser windows side by side
2. Left: `https://aisles-signal-x-studio-labs.vercel.app/category/living-room`
3. Right: `https://aisles-signal-x-studio-labs.vercel.app/observe`
4. On the right, select the active session
5. Browse the storefront on the left — the right shows every signal, every inference update
6. Search "dorm room desk" on the left — the right shows the persona shift in real time
7. The layout changes on the left — the right shows why: which signals triggered it, what the new probabilities are, which model generated it, how long it took

"The shopper just sees a store that gets them. Here's what's actually happening."

### Decision: Polling over SSE (2026-04-06)

**Choice:** The observe dashboard uses 2-second polling against REST endpoints, not Server-Sent Events (SSE) or WebSockets.

**Context:** Production log viewers (Vercel, Railway, Datadog, Grafana Loki) use SSE for real-time streaming — the server holds an open connection and pushes new entries as they arrive. This eliminates wasted requests during idle periods and removes the poll-interval latency gap. They also use virtual scrolling (only visible rows rendered in the DOM) to handle thousands of log lines without performance degradation.

**Why polling is sufficient here:**

- This is a demo tool, not a production observability platform. Sessions are short, event counts are low (tens, not thousands), and the audience is watching a live walkthrough — they won't perceive 2-second latency.
- Polling against Redis + Postgres is simple to implement and debug. SSE would require a pub/sub layer (Redis Pub/Sub or a message broker) to push events from the signal ingestion path to the dashboard connection.
- The existing data sources (Redis session store, Postgres generation_logs) are pull-oriented. SSE would need an event bus sitting between signal ingestion and the dashboard, adding infrastructure complexity for no demo benefit.

**What would warrant revisiting:**

- If the dashboard becomes a persistent monitoring tool (not just demo)
- If event volume grows enough that polling creates noticeable load
- If the 2-second latency gap becomes visible during the demo narrative

**Upgrade path if needed:**

1. Add SSE endpoint that tails Redis Pub/Sub (signal ingestion publishes to a channel, SSE endpoint subscribes and streams to the client)
2. Replace the event list with a virtual scroller (e.g., tanstack-virtual) for large sessions
3. Add tail-pinning behavior: auto-scroll to newest, pause when user scrolls up, "Jump to latest" pill to re-pin
