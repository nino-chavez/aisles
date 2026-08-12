# Demo reel — regeneration

Two reels live here:

- **Current — Bealls / builder narrative (20 scenes)** — captions.json + capture-bealls.mjs
- **Historical — Haven/Volt/Ember UIP reel (13 scenes, v4)** — capture.mjs + screenshots/demo-NN-*.png. Captions backup at git rev `acc9457`. Restore with `git show acc9457:scripts/demo-reel/captions.json > captions.json`.

The shared generator (`generate.mjs`) reads whichever `captions.json` is in place — TTS narration → captioned screenshots → MP4.

---

## Current reel — Bealls / builder narrative

Audience: builders shipping AI features into BigCommerce stores. Tone: pattern, file paths, tradeoffs. Reference implementation framing, not product pitch.

Twenty scenes across four acts:
1. **Foundation works** (1) — clean Bealls home
2. **Make the AI visible** (2–7) — `?dev=1` reveal, DevToolbar, `?fresh=1` regen, /observe, refinement chat, cross-session continuity
3. **Composition latitude + the V invariant** (8–13) — PLP/PDP/cart latitude, /test/p0-blocks vocabulary, Zod+Gateway code beat, brand config
4. **Where this goes** (14–19) — three-brand swap, Voucherify/UIP, cost meter, adjacent BC-stack inputs, returning shopper, beyond the storefront
5. **Close** (20) — the kit

### Prereqs

In `bealls-aisles` (the reel's app):
```bash
cd ~/Workspace/dev/wip/bealls-aisles
npm install
node scripts/cache/prewarm.ts   # cold-start is 5–10s/cell; warm before capture
npm run dev                     # leave running on :5173
```

In this repo:
- `ELEVENLABS_API_KEY` in `.env.local` (auto-sourced from `~/Workspace/dev/apps/rally-hq/.env.local` if missing)
- `npx playwright install chromium` (one-time, ~300MB)
- ImageMagick `magick` on PATH (used by both capture-bealls and generate)

For scene 14 (three-brand swap), set the brand URLs:
```
BEALLS_URL=https://aisles-demo-1-signal-x-studio-labs.vercel.app
BEALLS_FLORIDA_URL=https://aisles-demo-2-signal-x-studio-labs.vercel.app
HOMECENTRIC_URL=https://aisles-demo-3-signal-x-studio-labs.vercel.app
```
Without these, scene 14 falls back to a single-brand capture.

### Run

```bash
# 1. Capture all 20 scenes (~3–5 min)
AISLES_URL=http://localhost:5173 \
  OBSERVE_ACCESS_TOKEN=your-observe-token \
  node scripts/demo-reel/capture-bealls.mjs

# 2. Generate the reel (~2–4 min depending on TTS)
node scripts/demo-reel/generate.mjs

# Output: out/demo-reel.mp4
```

Iteration flags:
- `ONLY_SCENES=2,5,11 node scripts/demo-reel/capture-bealls.mjs` — re-capture specific scenes
- `SKIP_SCENES=14,16 node scripts/demo-reel/capture-bealls.mjs` — skip slow/fragile scenes
- `SKIP_TTS=1 node scripts/demo-reel/generate.mjs` — reuse audio, iterate on frames
- `SKIP_FRAMES=1 node scripts/demo-reel/generate.mjs` — reuse frames, iterate on stitch
- `TTS_VOICE=george node scripts/demo-reel/generate.mjs` — try a different ElevenLabs preset

### Fragile scenes (verify first run)

These scenes use best-guess selectors and may need a touch-up after the first capture:

| # | Scene | What can go wrong | Fix |
|---|---|---|---|
| 03 | DevToolbar zoom | Selector heuristic falls back to a corner clip | Inspect DevToolbar.svelte, add a `data-dev-toolbar` attribute, update the `triggers` array |
| 06 | Refinement chat | Trigger/input selectors are guesses | Inspect RefinementChat.svelte; update `triggers` and `inputs` arrays |
| 07 | Cross-session return | Depends on returning-visitor signal rules firing on re-navigation | Verify Observe shows `returning-*` rules; if not, re-capture after a real session-close |
| 14 | Brand swap composite | Needs all three brand URLs reachable | Set the env vars above; re-run with `ONLY_SCENES=14` |
| 16 | Cost meter | Depends on Observe surfacing per-generation cost | If the panel doesn't exist, the script saves the full Observe shot — crop in post or build the cost panel into Observe |

### Editing the narrative

`captions.json` schema per scene:
- `image` — filename in `screenshots/`
- `title` — bold caption title
- `caption` — body text; ElevenLabs reads this verbatim
- `captionPosition` — `"top"` or `"bottom"` (default). Flip to top when the UI under the default bottom band has important content (DevToolbar pinned bottom-right, cart drawer pinned bottom)
- `holdSeconds` — extra silence after narration ends (default 0.5)

After editing text only, rerun `generate.mjs`. After editing `image:` references, rerun the relevant capture scene first.

---

## Historical — UIP reel (v4)

The Haven/Volt/Ember reel that demonstrated UIP / Voucherify integration. Source artifacts:
- `capture.mjs` — captures `demo-14-cart-drawer.png`, `demo-15-uip-response.png`, `demo-17-observe-incentives.png` from the upstream multi-brand demo (this repo) plus renders `demo-16-voucherify.png` from a live Voucherify API call and `demo-18-config-moat.png` from a code panel of the Ember config block
- `screenshots/demo-NN-*.png` — kept in place; reused by scene 15 of the current reel (Voucherify cart)
- `captions.json` for v4 — git rev `acc9457`

To regenerate the v4 reel:
```bash
git show acc9457:scripts/demo-reel/captions.json > /tmp/v4-captions.json
cp scripts/demo-reel/captions.json /tmp/current-captions.json   # backup
cp /tmp/v4-captions.json scripts/demo-reel/captions.json
node scripts/demo-reel/capture.mjs    # only if you need to re-shoot v4 scenes
node scripts/demo-reel/generate.mjs
# Restore current captions when done:
cp /tmp/current-captions.json scripts/demo-reel/captions.json
```

The v4 manual scenes (Voucherify dashboard, Ember config) are now auto-rendered by `capture.mjs`; only scenes that need a live Voucherify campaign require sandbox creds in `.env.local` (`VOUCHERIFY_APP_ID`, `VOUCHERIFY_SECRET_KEY`, `VOUCHERIFY_API_URL`).
