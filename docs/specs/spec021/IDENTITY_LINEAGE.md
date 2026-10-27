# Squeeze Radar identity and corporate-action lineage

- **Contract version:** `1.0`
- **Mode:** synthetic-only (`SIM`)
- **Golden fixture:** [`identity-lineage-golden-1.0.json`](../../../contracts/squeeze_radar/v1/identity-lineage-golden-1.0.json)
- **Resolver:** [`identityLineage.ts`](../../../src/lib/squeezeRadar/identityLineage.ts)
- **Executable evidence:** [`identityLineage.test.ts`](../../../src/lib/squeezeRadar/identityLineage.test.ts)

Squeeze Radar uses stable identifiers rather than ticker symbols as durable keys. A ticker is a time-varying property of a listing; it is neither an issuer nor a security identity. The synthetic contract therefore stores four independently effective-dated layers:

| Layer | Stable key | Parent | Time-varying examples |
|---|---|---|---|
| Issuer | `issuer_id` | none | legal issuer existence or successor history |
| Share class | `share_class_id` | `issuer_id` | class existence and issuer association |
| Security | `security_id` | `share_class_id` | instrument existence and asset type |
| Listing | `listing_id` | `security_id` | ticker and venue |

Every catalog, identity record, and action carries `data_mode=SIM`; any other mode is rejected. Every identity record also carries `record_id`, `effective_from`, optional `effective_to`, and `first_knowable_at`. Effective intervals are half-open: `[effective_from, effective_to)`. Resolution first applies the knowledge gate `first_knowable_at <= decision_at`, then validates and selects the record effective at the requested economic time. A malformed future revision cannot contaminate an earlier decision. A malformed `first_knowable_at` is quarantined because the record cannot be placed safely on the decision timeline.

Ticker lookup may include a venue. If omitting the venue produces more than one effective listing, the result is quarantined as `AMBIGUOUS_IDENTITY_MAPPING`; the resolver does not choose whichever row happened to arrive first. A security can have zero, one, or multiple listings. Listing-specific consumers must resolve by `listing_id` or ticker plus venue.

## Corporate-action edges

Each action has its own stable `edge_id` and `event_id`, effective and knowable timestamps, source and target identifiers at the security, share-class, and listing layers, and an event-specific conversion ratio. The supported semantics are:

| Event | Required lineage effect |
|---|---|
| `SYMBOL_CHANGE` | Same security, share class, and listing; listing ticker changes at the event time |
| `SPLIT` | Same security, share class, and listing; positive conversion ratio |
| `MERGER` | Source terminates and a distinct target begins; positive conversion ratio |
| `SPIN_OFF` | Parent remains active and a distinct child begins; positive distribution ratio |
| `ADR_CONVERSION` | ADR terminates and a distinct ordinary security begins; positive conversion ratio |
| `SHARE_CLASS_CHANGE` | Source class/security terminates and a distinct class/security begins; positive conversion ratio |
| `DELISTING` | Source terminates with no target and no conversion ratio |

An edge is applied only after its source resolves immediately before the event and its target/state resolves at the event. Replacement and full-delisting edges require the source listing, security, and share class all to terminate; ending one venue on a still-listed security is not a full-security delisting. ADR conversion additionally requires ADR-to-equity asset types and issuer continuity, while a share-class change requires issuer continuity. Catalog disagreement is quarantined as `IDENTITY_LINEAGE_MISMATCH`. Invalid structures or timestamps are quarantined as `INVALID_CORPORATE_ACTION`. Duplicate semantic edges—even when provider event IDs differ—multiple replacements for the same source at one instant, and same-time chains that depend on processing order are quarantined as `AMBIGUOUS_CORPORATE_ACTION`. Active security IDs are held in a set so a lineage cannot silently double count a position.

The committed JSON golden fixture covers ticker reuse and change, merger, split, spin-off, ADR conversion, share-class change, dual listings sharing one security, an ETF, full delisting, and ambiguous mapping. Executable mutation tests add future-knowledge exclusion, malformed and non-SIM records, duplicate edges, same-time chains, broken hierarchy references, partial delisting, invalid event semantics, phantom roots, and catalog/edge disagreement. All identities and values are fictional.

## Boundary with the CSV bundle

This module is the executable T07 domain contract. The current CSV v1.1 `securities.csv` remains the earlier composite transport record and has not silently changed shape. Publishing the separated histories through the local point-in-time service belongs to T08; changing CSV headers or grains requires a new schema version and explicit loader dispatch. Future live adapters must supply the normalized identity fields and clocks documented in [PRODUCTION_DATA_REQUIREMENTS.md](PRODUCTION_DATA_REQUIREMENTS.md), then pass the same identity and lineage suite before use.
