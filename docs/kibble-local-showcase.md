# Kibble local showcase

Start the local showcase:

```bash
npm run dev:kibble-showcase
```

Synthetic demo enrichment — not merchant data. The launcher prints the same links and uses port `5174` by default:

```text
http://127.0.0.1:5174/?dev=true&intent=gatherer
http://127.0.0.1:5174/?dev=true&intent=hunter
http://127.0.0.1:5174/?dev=true&intent=researcher
http://127.0.0.1:5174/?dev=true&intent=gifter
```

Set `KIBBLE_SHOWCASE_PORT` to another non-privileged port if `5174` is occupied. The launcher accepts only `localhost`, `127.0.0.1`, or `::1` for `KIBBLE_SHOWCASE_HOST`.
Every local response also carries a URL-encoded `x-kibble-showcase-enrichment-source` header. Its decoded value is `Synthetic demo enrichment — not merchant data`.

## Evidence boundary

Real in this local process:

- signal extraction and the explicit `intent` inference rule;
- policy evaluation, deterministic product ranking, and the Preserve renderer;
- the six-zone decision trace shown by the development inspector; and
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

The launcher blanks the app's production database, Redis, model, incentive, and Observe credentials before it starts Vite. It stamps the run with scenario ID `kibble-local-showcase`, so contracted provenance reports the catalog and scores as synthetic. The inspector and response header both display `Synthetic demo enrichment — not merchant data`.

The inspector requires compile-time development mode and `?dev=true` on the
current request. A previously stored site-wide dev cookie cannot reopen it.
Shopper page data never includes persona-fit scores.

The synthetic rehearsal buttons appear only for this synthetic local scenario.
They are not shopper controls. Each button emits one allowed `nav.search`
signal through the normal client emitter and `/api/signals` endpoint. The
development receipt is bound to that event's exact client sequence, so an
older in-flight inference cannot confirm a newer button. The receipt has a
ten-second fail-safe and always describes an unconfirmed delivery as uncertain.
After a validated signal persists,
the inspector immediately asks `POST /api/kibble/home-decision?dev=true` for a
server-derived shelf preview. The endpoint accepts no decision inputs from the
browser. It reads the existing `aisles_session`, derives inference, loads the
pinned nine-product reference shelf, and applies the trusted Kibble Home
`reference-preserve` rules policy.

The local signal transport normally restores the controls first: it aborts a
stalled request after four seconds and does not replay that uncertain batch.
Any newer queued control drains immediately.
The preview request has a separate ten-second watchdog; timeout retains the
last approved shelf and marks the preview failed. The receipt helper, inspector,
and live-preview client are development-only lazy modules and are absent from
the production shopper bundle.

The preview endpoint fails closed unless all of these are true: the compiled
app is in development mode, the request includes `?dev=true`, the active brand
is Kibble, the trusted Home policy is `reference-preserve`, and the session
exists in the active brand scope. It returns `404` for an unavailable surface,
`409` for a missing or unknown session, and `Cache-Control: no-store` on every
response. Its response is a preview-only, versioned decision record with the
trusted reference and policy identity, sanitized inference, the score-free
zone trace, runner data-source label, and contracted provenance.

The preview does not generate a layout, call a model, write a database, mutate
the session, write telemetry, or read or write the layout-decision cache. It
does read the existing scoped session from the in-memory session cache or
Redis when configured. Preserve keeps the Kibble shell fixed. Allowed signals
can only rank and select products from the approved shelf. The local catalog
and fit data remain pinned synthetic fixtures, not merchant data.

Stop the process with `Ctrl-C`.
