# Kibble local showcase

Start the local showcase:

```bash
npm run dev:kibble-showcase
```

Synthetic demo enrichment — not merchant data. The launcher prints the storefront URL and uses port `5174` by default:

```text
http://127.0.0.1:5174/
```

Use **Show decision inspector** on any storefront page. No query parameter
knowledge is required. The lightweight rail remains available while you follow
ordinary catalog links. It can show zone outlines, collapse or expand, explain
the commerce boundary, or open the exact simulated shopper session in Observe
in a new tab. Home also links to the full signal lab. Observe starts pinned to
that session instead of silently switching to the newest one.

Set `KIBBLE_SHOWCASE_PORT` to another non-privileged port if `5174` is occupied. The launcher accepts only `localhost`, `127.0.0.1`, or `::1` for `KIBBLE_SHOWCASE_HOST`.
Every local response also carries a URL-encoded `x-kibble-showcase-enrichment-source` header. Its decoded value is `Synthetic demo enrichment — not merchant data`.

## Evidence boundary

Real in this local process:

- signal extraction and the explicit `intent` inference rule;
- policy evaluation, deterministic product ranking, and the Preserve renderer;
- the six-zone decision trace shown by the Aisles demo inspector; and
- the production enrichment query interface, supplied by a runner-only provider.

Synthetic demo enrichment — not merchant data:

- the pinned catalog fixture; and
- persona-fit scores, which are fixed demo values for every fixture product.

Absent from this launcher:

- model calls;
- database writes or database connections;
- paid enrichment APIs; and
- commerce actions.

The fixture interceptor, no-op Postgres replacement, and enrichment alias are selected only by `scripts/kibble-showcase-vite.config.ts`. Normal `npm run dev`, `npm run build`, `npm run preview`, and Wrangler do not use them.

The isolated launcher also forces `KIBBLE_DEMO_AI_ENABLED` off. The deployed
prospect demo can expose separate opt-in bounded AI controls when that server
flag is enabled. Home, PLP, PDP, zero-result Search, empty Cart, and eligible
Checkout routes each expose only their approved presentation action. No action
is automatic: each reserves a Redis-backed budget and sends sanitized
inference plus the minimum approved candidate facts. A response can select only
registered product order, merchant-authored copy IDs, registered component IDs,
an approved section order, or one optional marketing block. Every selected field
must pass its exact named-zone executor before the aggregate response renders.
Product facts, prices, eligibility, cadence, inventory, links, CSS, cart,
checkout, account, payment, order, and subscription state remain outside model
authority.

The launcher blanks the app's production database, Redis, model, incentive, and Observe credentials before it starts Vite. It stamps the run with scenario ID `kibble-local-showcase`, so contracted provenance reports the catalog and scores as synthetic. The inspector and response header both display `Synthetic demo enrichment — not merchant data`.

The Kibble launcher is available on every reference-owned shopper route in both
the local showcase and deployed demo. Its explicit `?observe=true` request sets
a four-hour, HTTP-only demo cookie so the rail survives normal navigation;
`?observe=false` clears it. The unrelated site-wide dev cookie cannot reopen
the rail, and a normal storefront request does not receive inspector data.
Shopper page data never includes persona-fit scores.

The behavior simulator appears only after the explicit demo inspector stamps a
synthetic scenario. In this local runner, its catalog and fit data also come
from the pinned fixture. Its controls are not commerce controls. They model recognizable actions—browsing
departments, comparing products, searching for a deal, or shopping for a
gift—and emit the listed typed storefront events through the normal client
emitter and `/api/signals` endpoint. Multi-event behaviors travel as one batch.
The inspector shows the event types, updated inference, fired rules, and shelf
result. **Start a fresh shopper** clears the local session so scenarios do not
silently inherit earlier evidence.

Every demo receipt is bound to the exact emitted sequence, so an older
in-flight inference cannot confirm a newer control. The receipt has a ten-second
fail-safe and always describes an unconfirmed delivery as uncertain.
After a validated signal persists,
the inspector immediately asks `POST /api/kibble/home-decision?observe=true` for a
server-derived shelf preview. The endpoint accepts no decision inputs from the
browser. It reads the existing `aisles_session`, derives inference, loads the
pinned nine-product reference shelf, and applies the trusted Kibble Home
`reference-preserve` rules policy.

The local signal transport normally restores the controls first: it aborts a
stalled request after four seconds and does not replay that uncertain batch.
Any newer queued control drains immediately.
The preview request has a separate ten-second watchdog; timeout retains the
last approved shelf and marks the preview failed. Before replacing that shelf,
the client strictly validates the complete versioned preview payload: reference
and policy identity, data-source label, zone decisions, contracted rules
provenance, and the absence of protected scores. The inspector and live-preview
client are opt-in production chunks loaded only when the inspector is open.

The preview endpoint fails closed unless all of these are true: the request
includes `?observe=true`, the active brand is Kibble, the trusted Home policy is
`reference-preserve`, and the session exists in the active brand scope. It
returns `404` for an unavailable surface,
`409` for a missing or unknown session, and `Cache-Control: no-store` on every
response. Its response is a preview-only, versioned decision record with the
trusted reference and policy identity, sanitized inference, the score-free
zone trace, runner data-source label, and contracted provenance.

The automatic preview does not generate a layout or call a model. It does not
write a database, mutate the session, or read or write the layout-decision cache. It
does read the existing scoped session from the in-memory session cache or
Redis when configured. Preserve keeps the Kibble shell fixed. Allowed signals
can only rank and select products from the approved shelf. The local catalog
and fit data remain pinned synthetic fixtures, not merchant data.

Stop the process with `Ctrl-C`.
