# Generative-commerce MVP contract

**Status**: canonical for new presentation and inference work
**Audience**: engineers and reviewers
**Primary job**: decide whether a storefront zone may call a model, and verify what the call changed

## The rule

Aisles may adapt a merchant-owned presentation inside an approved zone. The
model does not own the storefront, commerce state, or page recipe.

The merchant owns templates, product facts, prices, links, actions, transaction
state, and responsive behavior. A model may select an approved product order,
copy variant, component variant, marketing block, or section order only when
the surface and zone policy allow that capability.

The authority ceiling is enforced in
`src/lib/foundation/surface-authority.ts` and checked when a composition policy
is compiled. A policy can narrow a surface. It cannot make a narrow surface act
like Home.

## Surface authority

| Surface | Latitude | Model may affect | Fixed boundary |
|---|---|---|---|
| Home | wide | approved composition, merchandising, copy, components, and section order | merchant template, products, facts, prices, links, and actions |
| PLP / CLP | medium | framing, marketing, approved component treatment, and bounded product ranking | category, catalog membership, prices, links, sort contract, and page recipe |
| PDP | narrow | related recommendations, bounded copy, marketing, and approved component treatment | product facts, price, purchase actions, links, and page recipe |
| Search | narrow | approved recovery copy only | query handling and search results |
| Cart | narrower | approved recovery copy only | cart contents, prices, totals, and actions |
| Checkout | narrowest | approved assurance copy only | payment, totals, order state, and purchase authorization |
| Account | none | no approved AI use case | merchant-owned account surface |
| Locator and error/empty surfaces | none | fixed recovery or locator content | merchant-owned recovery behavior |

This contract does not add cart, checkout, account, subscription, or payment
service wiring. Those are separate commerce concerns.

## A model action has one bounded path

The reusable runtime path is:

```text
zone policy
  -> executeZoneDecision
  -> runBoundedModelAction
  -> structured provider output
  -> strict Zod allow-list
  -> merchant-owned materializer
  -> exact decision evidence
```

`runBoundedModelAction` in
`src/lib/server/bounded-model-action.server.ts` owns the provider boundary.
It makes one primary attempt and, while the same deadline is still live, one
fallback attempt. It supplies the action-wide `AbortSignal`, output token cap,
strict structured-output schema, served model, provider, call count, and token
usage. A timeout, caller abort, provider failure, or invalid output publishes no
model result.

The current Kibble implementation is the reference adapter for this path. Its
four model modules use the shared runner while keeping Kibble's product and
presentation allow-lists local to the brand. New brand adapters should follow
that boundary instead of calling `generateText` directly.

## Evidence is part of the result

The model result is not complete until a prospect can tell what happened. The
shared evidence shape is in
`src/lib/foundation/presentation-evidence.ts`. A completed action records:

- Before and After product order.
- Moved, added, removed, and unchanged products.
- Changed or unchanged copy, component, section, and marketing values.
- Provider, served model, call count, policy version, and zone ID.
- An explicit `outcome`: `changed` or `kept`.
- Whether fallback retained the prior approved presentation.

The Kibble Observe rail renders these facts with the states `Template`,
`Rules`, `AI available`, `AI running`, `AI changed`, `AI kept`, `AI failed`, and
`Fallback`. “AI kept” is a result, not an absence of evidence: it means a
bounded model call completed, passed validation, and matched the approved
presentation.

## Safety bounds

Every live model zone must have all of these bounds:

- A strict structured-output schema with merchant-owned IDs and variants.
- No arbitrary products, prices, links, actions, CSS, components, or page recipes.
- A bounded output size and one action-wide timeout.
- A provider budget and cooldown before the call is offered to a user.
- A deterministic fallback that keeps the last approved presentation.
- No raw shopper identifiers, credentials, or unredacted request details in prompts or evidence.

The Kibble demo budget and cooldown remain in
`src/lib/server/kibble-demo-ai-budget.ts`. A new adapter must provide an
equivalent budget gate before it exposes a paid provider action.

## Compatibility boundary

`/api/layout` and `/api/layout/stream` are legacy generic-renderer routes. They
remain for existing compatibility coverage, but they are not the canonical
generative-commerce contract because they can generate a whole page rather than
execute one policy-bound zone action with prospect-facing before/after evidence.

The canonical path is zone-scoped, merchant-owned, and evidence-bearing. Do not
extend the legacy whole-page route for new commerce behavior.

## Verification checklist

Before calling a zone complete, verify the following:

1. The surface policy compiles under the authority ceiling.
2. The provider path is exercised with structured output and records provider,
   served model, and call count.
3. A changed result and an unchanged result both produce exact evidence.
4. Retry, cooldown, timeout, caller abort, invalid output, and fallback retain
   the approved presentation.
5. The feature flag and non-AI surfaces do not call a provider.
6. `npm run check`, `npm run build`, and the relevant full test suite pass.
7. Desktop and mobile browser checks confirm focus restoration, readable state
   labels, and no color-only meaning.
