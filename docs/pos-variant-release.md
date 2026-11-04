# POS variants: release gate and recovery

Target: corporativonexia-creator/upndowncabo PR #27, Vercel upndowncabo / NEXIA,
Supabase xlkjztcxqlsegboivccg. Do not release until every gate below passes.

## Fix

The branch inherited a malformed inventory-admin.tsx: line 99 ended inside an
HTML string, and the missing continuation plus a duplicate print routine appeared
after the component. Local TypeScript and Next.js reproduced the parser failure.
The repair restores category subtotals and removes only the orphan duplicate.
Direct confirmation against the five failed Vercel build logs is still required.

Catalog loading is paginated by stable ID, with parent batches of 100 and pages
of 500. Variants retain price, barcode, SKU, stock, attributes and image metadata.
Inactive-only variant parents are excluded. Duplicate barcodes fail closed.

Sales RPCs keep the original signatures and employee/terminal/shift/role checks.
They lock inventory in deterministic UUID order, require variant_id for variant
parents, enforce physical visibility and MXN, reject canonical duplicate lines,
and preserve server-side price priority. Request IDs in payment metadata make
same-request retries idempotent. Snapshots include the sold variant and attributes.
Void/refund use the recorded variant_id; historical null variant_id lines remain
parent-ledger operations and are never rewritten or guessed from current variants.
Existing variant triggers maintain aggregate parent stock; do not subtract it twice.

Minor existing lint errors are resolved with internal Link navigation, barcode
variable renaming, effect-based ref synchronization, and narrow documented
exceptions for external synchronization effects. No lint rule is globally disabled.

## Verification

- `npm ci`
- `npm run lint` (existing warnings are reported separately)
- `npm run test:pos` (isolated embedded PostgreSQL; concurrency explicitly skipped)
- `POS_TEST_DATABASE_URL=postgres://...@127.0.0.1:5432/pos_variant_qa npm run test:pos`
  uses a disposable PostgreSQL database and real separate connections for locking.
- Build against fixture public configuration, then `npx tsc --noEmit`.
- `npm run test:pos:browser` and `npm run test:admin` against mock-supabase only.
- GitHub workflow `POS variant safety` runs PostgreSQL 17 and browser checks.

The fixture contains schema and function definitions only, no production records.
The local PGlite adapter substitutes native SHA-256 for the unavailable pgcrypto
extension; CI uses real pgcrypto. It is not a substitute for the concurrency gate.

## Deployment sequence

1. Verify PR head, review full diff, require CI and Vercel preview READY at that SHA.
2. Capture current production deployment ID/SHA; export current three RPC definitions,
   ACLs and affected table schema. Take a consistent logical backup of products,
   product_variants, inventory_movements, pos_sales/items/payments/events/refunds,
   and shifts using the existing authorized backup mechanism. Verify restoration
   in an isolated database. Never put customer records or credentials in Git.
3. Record inventory counts/sums, negative-stock counts, sale/payment/refund totals,
   and current maximum sale number. Compare active parent totals with variant sums;
   document historical differences without modifying them.
4. Coordinate a brief checkout maintenance window. Old open POS tabs cannot safely
   sell an aggregate parent after the migration; they must reload before resuming.
5. Apply 20261104020000_pos_variant_sales.sql atomically. It changes functions and
   adds one partial unique index; it does not update historical rows. Verify function
   definitions/ACLs and migration history, with no sample sales in production.
6. Merge PR #27 into main only at the tested SHA; verify production READY and domain.
7. Reload terminals; inspect authorized catalog, variant identifiers and scanners
   without charging test sales. Watch runtime/Postgres logs and first genuine sale
   movements, comparing its exact variant delta and payment/receipt snapshots.

## Recovery

Before any new variant sales, the three original function definitions are preserved
in tests/pos/schema.sql, but extract ONLY those functions for a reviewed rollback;
never execute the fixture against production. Restore the captured ACLs too.

After any variant sale is committed, NEVER restore parent-only void/refund code:
it would replenish the wrong inventory. Keep variant-aware recovery RPCs, suspend
new checkout if necessary, roll back only the UI to a validated compatible build,
and apply a forward fix. Do not delete sales, reset sequences or replace live stock
with a pre-deployment snapshot. Reconcile each genuine transaction via its ledger.
