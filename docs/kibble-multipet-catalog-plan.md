# Kibble multi-pet catalog research plan

## Recommendation

Add the 33 researched products to a merchant review queue. Do not add them to the active Kibble catalog yet.

If approved, the catalog would grow from 49 dog products to 82 products across dogs, cats, birds, snakes, and bearded dragons. Four products apply to both reptile profiles. They remain four SKUs, not eight.

This is enough depth for a meaningful household-personalization demo. It is not enough breadth to imitate a full pet retailer. The point is to show better decisions inside a bounded assortment: two cats can share a litter routine while keeping separate food constraints; a snake and bearded dragon can share monitoring candidates without sharing husbandry assumptions.

The 33 rows are retailer-listed research candidates. They are not merchant-approved products, live offers, inventory facts, provider plans, or care recommendations.

## The assortment now covers a whole household

The flagship profile is the real household described for this work:

- Two dogs
- Two cats
- One snake
- One bearded dragon

The existing 49 products already cover the dog side. The proposed rows add food, litter, feeding, enrichment, travel, habitat, and enclosure-equipment decisions for the other four animals.

Birds use a separate demo profile because the household does not include one. That profile must name the bird species, life stage, size, and current diet. A generic “bird owner” persona is too broad to choose food or cage fit truthfully.

```text
Current catalog                     If all candidates are approved
49 dog products                     82 catalog products
└── 8 dog categories                ├── 49 dog products
                                    └── 33 multi-pet candidates
                                        ├── 11 cat
                                        ├── 7 bird
                                        ├── 4 snake-only
                                        ├── 4 shared reptile
                                        └── 7 bearded-dragon-only
```

The four shared reptile products are two thermostats, one temperature-and-humidity monitor, and one water dish. Species applicability is not product duplication.

## Category depth is persona-ready but retailer-light

The current dog catalog has meaningful category breadth but uneven depth.

| Existing dog category | Products |
| --- | ---: |
| Food | 10 |
| Supplements | 9 |
| Treats | 4 |
| Grooming | 3 |
| Toys | 4 |
| Walk gear | 6 |
| Beds and apparel | 5 |
| Bundles | 8 |
| **Dog total** | **49** |

The proposed catalog adds enough roles to exercise different shopper jobs per species.

| Species applicability | Candidate rows | Covered roles | Repeat coverage |
| --- | ---: | --- | --- |
| Cat | 11 | Food 3; litter 2; treats 2; feeding 1; enrichment 2; travel 1 | Food, litter, treats; replacement reminders for scratcher and toy |
| Bird | 7 | Food 3; topper 1; enrichment 1; habitat 1; travel 1 | Food and topper; toy replacement reminder |
| Snake | 8 | Substrate 2; hide 1; heat 1; controls 2; monitoring 1; hydration 1 | Substrate; heat-source replacement reminder |
| Bearded dragon | 11 | Food 3; UVB 1; fixture 1; heat 1; hide 1; controls 2; monitoring 1; hydration 1 | Food; UVB and basking-lamp replacement reminders |

A full retailer goes much wider. Chewy exposes top-level shopping for dogs, cats, small pets, birds, fish, reptiles, and other pet needs on its [current storefront](https://www.chewy.com/). The proposed Kibble assortment deliberately stops at five species groups and a small set of jobs within each.

The scale difference is large even inside one species group. PetSmart's [bird category](https://www.petsmart.com/bird) returned 667 results at review time across pet-bird, wild-bird, poultry, food, cage, toy, and care lanes. Kibble's seven bird candidates are a bounded demo set, not a retailer-sized department.

That makes the assortment light by retailer standards. It is still deep enough for the demo if the goal is personalization rather than endless search results.

## Each species creates a different personalization test

**Cats test household coordination.** Three foods, two litter materials, two treat formats, a feeding tool, two enrichment products, and a carrier create real comparisons. The system must keep life stage, food restrictions, allergies, litter preference, pet measurements, and airline confirmation attached to the right cat.

**Birds test taxonomy discipline.** The food rows are not interchangeable. The researched set includes [Harrison's Adult Lifetime Fine](https://www.chewy.com/harrisons-adult-lifetime-fine-organic/dp/1429582), [Kaytee parakeet food](https://www.chewy.com/kaytee-forti-diet-pro-health-parakeet/dp/122973), and [ZuPreem medium-bird food](https://www.chewy.com/zupreem-fruitblend-flavor-natural/dp/128392). Species, size, life stage, current diet, and transition state determine whether any row can enter a candidate set.

**Snakes test environmental restraint.** Two substrate materials create a useful comparison only after species and humidity target are known. The [Arcadia 80-watt deep heat projector](https://www.chewy.com/arcadia-reptile-deep-heat-projector/dp/1364502) cannot become a recommendation from wattage or species label alone. Enclosure size, measured temperatures, target range, controller, fixture, and wattage capacity remain required.

**Bearded dragons test life-stage and equipment compatibility.** Adult and juvenile prepared foods have mutually exclusive life-stage gates. The [Zoo Med 34-inch UVB lamp](https://www.chewy.com/zoo-med-reptisun-100-t5-ho-uvb/dp/344986) and [36-inch hood](https://www.chewy.com/zoo-med-reptisun-t5-ho-reptile/dp/345003) remain separate products. The data does not assume that a lamp, fixture, enclosure, and basking distance fit one another.

**The household tests shared routines without shared facts.** The two cats may share litter while needing separate food candidates. The snake and bearded dragon may compare the same monitor while keeping different target ranges. That is the personalization advantage this assortment can demonstrate.

## The manifest blocks universal care recommendations

Every bird candidate requires a profile. Every snake and bearded-dragon candidate also requires a profile and at least one stop condition.

The typed manifest enforces the highest-risk inputs:

- Cat food requires life stage, dietary restrictions, and known food allergies
- The cat carrier requires pet measurements and direct airline confirmation
- Bird foods require bird species and life stage
- Bird cages require species, size, bar-spacing need, and occupancy count
- Snake substrate requires species and target humidity
- Reptile heat, thermostat, and UVB products require enclosure measurements and compatible equipment facts
- UVB selection also requires fixture length and basking distance
- Adult and juvenile bearded-dragon foods stop when the life stage does not match

These fields support candidate filtering. They do not supply care targets. The catalog contains no medical diagnosis, veterinary advice, treatment claim, or universal feeding and habitat rule.

## Repeat scenarios are not subscription approval

The proposal distinguishes three repeat patterns:

| Repeat pattern | Meaning in this research file |
| --- | --- |
| `consumable-repeat` | A merchant could review the item for replenishment after usage and cadence facts exist |
| `replacement-reminder` | A merchant could review a replacement reminder based on condition or an approved schedule |
| `none` | The research does not propose a repeat-purchase scenario |

No row has a provider plan. A repeat pattern does not prove subscription eligibility, inventory, price authority, or checkout support.

## Source facts stop at the retailer snapshot

Every product records one exact Chewy product URL, the observed price, retrieval date `2026-08-14`, and one to three terse listing facts. Product and source prices must match for the file to parse.

The 1-lb Harrison's bird-food row was temporarily out of stock at retrieval. It remains a real product-identity candidate, but merchant review must replace or re-verify it before approval.

The source supports product identity and the observed listing snapshot. It does not grant merchant approval or establish current availability. Prices can drift after the retrieval date.

The manifest intentionally omits:

- Inventory and stock quantity
- Shipping weight and package dimensions
- Product images
- Merchant-authored complements, alternatives, or routines
- Provider-plan and subscription claims

The exact 33 source URLs live beside their products in `src/lib/brand/reference/kibble-multipet-catalog.json`. Representative source rows include [Tiki Cat wet food](https://www.chewy.com/tiki-cat-after-dark-variety-pack/dp/1654030), [Prevue's small-bird flight cage](https://www.chewy.com/prevue-pet-products-small-bird-flight/dp/133480), [Zoo Med aspen snake bedding](https://www.chewy.com/zoo-med-aspen-snake-bedding/dp/123799), and [Fluker's juvenile bearded-dragon food](https://www.chewy.com/flukers-buffet-blend-juvenile-bearded/dp/347415).

## The missing categories are deliberate

This proposal does not include live feeders, frozen snake food, veterinary diets, medication, or products whose value depends on a health claim.

Those omissions are not evidence that the products do not exist. They mark places where a retailer listing is not enough for a safe demo contract.

This proposal also assumes an existing-pet household, not a new-pet setup journey. If the demo adds onboarding, two additional role holes are already evidenced: Petco's [basic cat-supply list](https://www.petco.com/category/cat) includes a litter box, and PetSmart's [bearded-dragon checklist](https://www.petsmart.com/learning-center/reptile-care/bearded-dragon-care-guide/A0015.html) includes a terrarium and screened lid. Those products are not needed for the current replenishment-and-replacement persona, but they would be required for a truthful new-pet persona.

Additional products become justified when all three conditions hold:

1. A named shopper job has no truthful candidate in the proposed assortment
2. A comparable retailer or manufacturer source proves the exact product identity and relevant selection facts
3. The merchant approves the product, its role, and the facts allowed on the demo surface

The “33 candidates are enough” conclusion is falsified if a planned persona cannot complete a core routine without one of the excluded product types. It is also falsified if merchant review rejects enough rows to leave a species with no food or replenishment path, no habitat decision, or no safe comparison set.

The catalog remains incomplete until merchant review supplies live product IDs, publication state, price authority, inventory policy, and any approved merchandising relationships.

## Approval starts with a dry run

The first wiring step is to validate this JSON with the `gen-commerce-store-data` dry-run path. The preview must preserve all 33 research rows and emit no remote catalog writes.

After that review:

1. The merchant approves or rejects each candidate and its allowed facts
2. Approved rows receive merchant product IDs and final SKUs
3. The merchandising graph receives only approved products and source-backed relations
4. Purchase and repeat-purchase evidence remain separate from research metadata

Do not merge these 33 rows directly into the active 49-product evidence. The active catalog is a merchant record. This file is a research proposal.
