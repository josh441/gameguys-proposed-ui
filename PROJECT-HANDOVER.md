# Game Guys Operations Proposal — Project Handover

**Prepared:** 7 August 2026
**Status:** Integrated purchasing and print-Notes revision ready for product review; publication pending
**Repository:** `josh441/gameguys-proposed-ui`
**Live proposal:** <https://josh441.github.io/gameguys-proposed-ui/>
**GitHub Pages source:** `main` branch, repository root
**Published release verified:** `d2d38f3` (merged PR #7 purchasing proposal)
**Working branch:** `purchasing-streamline` at `58dc694`, with the integrated UI revision in the working tree

## 1. Purpose of this handover

This document is the consolidated handover for the Game Guys Operations proposal. It records:

- what the published prototype currently demonstrates;
- the agreed filler, receiver, stock, PO, return, pricing, and print workflows;
- the rules that production code must preserve;
- what is only mocked in the proposal and still needs engineering;
- decisions that still require product confirmation;
- the current release and deployment state.

The HTML files in this repository are an interactive visual reference. They are not production code and are not connected to live authentication, Nayax, Shopify, Xero, a database, a camera, or warehouse stock.

## 2. Authoritative references

Use these references together:

| Reference | Purpose |
|---|---|
| [Live proposal](https://josh441.github.io/gameguys-proposed-ui/) | Current visual and interaction reference |
| [all-in-one.html](all-in-one.html) | Condensed stakeholder walkthrough |
| [BUILD-PLAN.md](BUILD-PLAN.md) | Detailed behavior, flows, proposed data model, and safeguards |
| [DEV-PROMPT.md](DEV-PROMPT.md) | Implementation brief for a developer or coding assistant |
| [HANDOFF.md](HANDOFF.md) | Product acceptance criteria, edge cases, and open decisions |
| [handoff.html](handoff.html) | Shareable visual summary of the product handoff |
| [PURCHASING-STREAMLINE.md](PURCHASING-STREAMLINE.md) | Purchasing proposal for the **production** app: current-state map, target flow, data model, fix list, build sequence (summarised in section 17) |
| [Inventory → Purchasing](inventory.html#purchasing) | Integrated purchasing mockup with three work tabs: Plan, Orders, and Receive |
| This file | Current release, scope, implementation boundary, and operational handover |

If an older statement conflicts with the current prototype, the current requirement is:

- the filler printout has **six columns**: `Slot · Item · Price to set · Last sold (Nayax) · Amount · Notes`;
- Returns are a separate sub-tab in Machines;
- Inventory uses one unified Stock History rather than a separate Route Returns screen.

Known discrepancies in older artifacts at the time of handover:

- The header in `HANDOFF.md` says its latest changes still need publication. That note is stale; the current release is published at commit `a770f5d`.
- Earlier releases used four- and five-column printouts. Section 3.1b, the current UI, and this handover contain the approved six-column version with a blank handwritten Notes field.
- The SQL sketch in `BUILD-PLAN.md` shows the earlier `unit_price` field, while the current behavioral requirement also calls for `price_to_set_snapshot`, `last_sold_price_snapshot`, and `last_sold_sale_id`. The production schema must be based on the audited application, not copied from the sketch.
- The current print-table header says `Qty`; product documentation calls the same value `Amount`. Production should standardize the final label without changing its meaning: quantity to stock.

## 3. Current release state

The GitHub Pages baseline was reconciled on 5 August 2026. PR #7 is published; the integrated Inventory navigation and six-column print revision described in this handover are local and still need publication:

| Check | Result |
|---|---|
| GitHub Pages status | Built successfully |
| Published commit | `d2d38f3` |
| Pages source | `main` at `/` |
| Live Machines page | HTTP 200 |
| Separate Returns tab | Present |
| Last sold price in print preview | Present |
| Live Inventory page | HTTP 200 |
| Unified Stock History | Present |
| Published standalone purchasing proposal | Present |
| Local integrated Inventory purchasing view | Ready; not yet published |
| Local blank Notes print column | Ready; not yet published |

Relevant merged releases:

- [PR #5 — Refine stock returns and Nayax pricing](https://github.com/josh441/gameguys-proposed-ui/pull/5)
- [PR #6 — Print Nayax last-sold prices](https://github.com/josh441/gameguys-proposed-ui/pull/6)
- [PR #7 — Purchasing streamline proposal](https://github.com/josh441/gameguys-proposed-ui/pull/7)

The local file `MERGE-READINESS-AUDIT.md` is currently untracked. It is not part of the published proposal or the release described here.

## 4. Information architecture and roles

The proposal keeps five top-level operational areas:

| App area | Primary role | Purpose |
|---|---|---|
| **Ownership** | Owner/Admin | Financials, sales, machine value, product/machine performance, forecast |
| **Inventory** | Receiver/Warehouse | Current stock, allocation, POs, receiving, and Stock History |
| **Machines** | Filler | Assigned machines, pick lists, Nayax pricing reference, print/PDF, and Returns |
| **Calendar** | All roles | Pokémon release calendar and preorder actions |
| **CRM** | Owner/Team | Supplier contacts and task management |

Role rules expected in production:

- Owner/Admin can see all operational areas.
- Receiver/Warehouse lands in Inventory and may have read access to Machines.
- Filler lands in Machines and only sees individually assigned machines and eligible completed runs.
- The receiver role should map to the production application's existing warehouse/purchasing permissions rather than introducing an assumed new role.

## 5. Implemented proposal surfaces

### 5.1 Machines — Machines & Pick List

The filler view demonstrates:

- machine cards for assigned machines;
- on-demand pick-list generation using the last seven days of sales;
- rows ordered by physical slot number;
- current machine quantity, PAR/capacity, quantity to add, pace, and fill status;
- product swaps when an item is unavailable;
- adding an extra product row;
- quantity-only overrides;
- latest successful Nayax sale price for the exact SKU;
- source machine and sale date for the last-sold reference;
- a clearly labelled similar-product fallback when no exact-SKU sale exists;
- latest PO cost as secondary context, never as the customer selling price.

Current Pokémon 151 example:

- SKU: `PKM-151-JP`
- latest PO cost: `$5.99`
- last successful Nayax sale: `$8.50`
- example source: `GGV-007`, 2 August

The working pick list allows changes to product and quantity only. Slot, PAR, price source, and other generated fields are locked in the proposal.

### 5.2 Machines — Returns

Returns are a separate Machines sub-tab, not an Inventory action.

The filler can:

1. choose an eligible completed route/machine from a dropdown;
2. load products from the finalised run;
3. see the item, issued count, stocked count, returnable count, and locked source;
4. enter the unused return count;
5. mark a line Good or Damaged;
6. select a required damage reason for damaged stock;
7. confirm one route-linked return batch.

Expected destinations:

- Good return → **Warehouse · unallocated**
- Damaged return → **Quarantine** only

After confirmation:

- good stock appears immediately in Inventory Current Stock;
- good and damaged movements appear in the unified Stock History;
- the receiver does not approve or move the same return again;
- Nayax sales, prices, and machine quantities are not changed by the warehouse return.

Prototype links:

- [Inventory → Purchasing](inventory.html#purchasing)
- [Returns](machines.html#returns)
- [Stock History](inventory.html#stock-history)

### 5.3 Machines — print preview and PDF

The print preview is hidden during normal work and opens only when **View print / PDF** is selected.

The preview closes through Close, the backdrop, or `Escape`. **Print / Save PDF** uses the browser print dialog.

The approved printed columns are:

1. Slot
2. Item
3. Price to set
4. Last sold (Nayax)
5. Amount (`Qty` in the current prototype)
6. Notes (blank, for handwriting during the route)

Print rules:

- `Price to set` and `Last sold (Nayax)` remain separate even when they match.
- The last-sold value is the latest successful Nayax sale for the same SKU.
- Latest PO cost does not print.
- The source machine and sale timestamp do not print.
- Notes prints as a blank writable field on every product row.
- Pace, PAR, group, stock status, return controls, and other screen-only fields do not print.
- The proposal uses an A4 portrait print layout.

Production should snapshot both `price_to_set` and `last_sold_price` when the sheet is generated so a later Nayax sync cannot silently change an already-generated sheet.

### 5.4 Inventory — Stock Overview

The receiver view demonstrates:

- a compact Current Stock table;
- 10 rows by default with a 25-row option;
- search by product, SKU, or location;
- language and allocation filters;
- sorting by name, language, or on-hand quantity;
- separate balances for Online store, Vending machines, Warehouse · unallocated, and Quarantine;
- physical location per stock row;
- a compact **Scan stock** header action that opens on demand.

There is no stock-health graphic or low/borderline/healthy threshold because the business has not defined those calculations.

### 5.5 Inventory — Purchase Orders and receiving

The proposal supports viewing and editing PO header and line information. Receiving is grouped into three work areas:

1. Product and PO balance
2. This delivery and damage
3. Good-stock allocation

Receiving rules:

- `arrived_qty` includes damaged units.
- `good_qty = arrived_qty - damaged_qty`.
- `online_store_qty + vending_qty = good_qty`.
- Damaged quantity greater than zero requires a reason.
- Damaged stock creates a Quarantine movement only.
- Saving a PO or receiving draft moves no stock.
- **Receive all outstanding** fills the remaining quantities but must preserve valid allocation.
- **Clear this delivery** resets the draft only.
- Confirmation must be atomic and idempotent.
- PO status becomes Partial if quantity remains due, otherwise Received.

Prototype links:

- [PO editing](inventory.html#po-1042)
- [Receive PO](inventory.html#receive-po-1042)

### 5.6 Inventory — Stock History

Inventory uses one newest-first, read-only ledger rather than a return-specific screen.

It includes:

- PO receipts;
- route-fill withdrawals;
- route returns;
- allocation transfers;
- stocktake adjustments;
- supplier and route damage/Quarantine movements.

The proposal shows date/time, movement type, product/SKU, source, destination/allocation, signed quantity, reference, recorded-by user, and resulting stock. It supports search plus movement-type, stock-area, and balance-effect filters.

The legacy `#route-returns` deep link is mapped to Stock History for compatibility.

### 5.7 Other proposal areas

- **Ownership:** curated Xero-oriented financial and sales reporting, machine value, performance, and forecast.
- **Calendar:** Pokémon release and preorder planning.
- **CRM:** supplier contact details and task management.

These surfaces are proposal screens. Production should reuse existing integrations and features rather than recreate them.

## 6. Source-of-truth model

| Data | Expected source of truth |
|---|---|
| Vending sales and selling prices | Nayax |
| Last-seven-day machine/SKU sales | Nayax mirror |
| Last successful sold price | Nayax successful sale history |
| Warehouse and allocation balances | Application stock ledger |
| Stock changes | Immutable `stock_movements` |
| Fill deduction | Existing `picklist_final_rows → apply_picklist_withdrawal()` path |
| PO unit cost | Purchase order/receipt data |
| Online sales/incoming context | Existing Shopify integration |
| Accounting/financial reporting | Existing Xero integration |

Do not create a second stock deduction from the filler hub. Fill finalisation remains the only negative warehouse withdrawal for that fill.

## 7. Non-negotiable business and engineering rules

- A filler must never see another filler's machines or completed runs.
- Stock deducts exactly once at fill finalisation.
- Returns and receipts use unique idempotency keys.
- Confirmed movements are immutable.
- Corrections use compensating movements rather than editing history.
- Good returns create positive Warehouse movements.
- Damaged returns and damaged receipts go to Quarantine and never increase sellable stock.
- Every good received unit must be allocated to Online store, Vending machines, or an exact split.
- Online-store and Vending-machine stock must never be merged into an ambiguous Store balance.
- Quarantine is never counted as sellable stock.
- Nayax remains authoritative for vending sales and prices.
- Last-sold lookup must use successful sales and respect the filler's machine visibility.
- A comparable price must be labelled as a similar-product fallback.
- Latest PO cost must never be presented as the customer selling price.
- Supplier records contain contacts only; never store supplier credentials.
- Server-side permission, quantity, allocation, outstanding-balance, and idempotency validation must run in the same transaction as confirmation.

## 8. Proposed production data changes

Audit the production schema before adding anything. Reuse existing tables and actions where they already cover the requirement.

Likely additions or extensions:

- `machine_slots` for planogram slot and PAR configuration;
- `picklists` and editable `picklist_rows` for on-demand generation;
- `price_to_set_snapshot`, `last_sold_price_snapshot`, and `last_sold_sale_id` for stable printing and audit;
- `route_stock_returns` and `route_stock_return_rows` for idempotent return batches;
- `purchase_order_receipts` and `purchase_order_receipt_rows` for draft/confirmed receipts and allocation;
- joins or read models that build Stock History from immutable movements and their route, return, receipt, transfer, adjustment, product, location, and user metadata.

The SQL in `BUILD-PLAN.md` is a schema sketch, not an approved migration. Production naming, constraints, tenancy, permissions, and relationships must follow the real codebase.

## 9. Prototype boundary

### Demonstrated by this repository

- navigation and role-oriented information architecture;
- responsive static UI behavior;
- representative pick-list controls plus interactive return, receiving, filter, scanner-overlay, and print-preview examples;
- realistic Pokémon sample data;
- acceptance criteria and proposed business rules.

### Not implemented here

- production authentication or authorization;
- live database reads/writes;
- Nayax, Shopify, or Xero API calls;
- durable drafts, confirmations, or idempotency enforcement;
- actual stock movement transactions;
- real camera/barcode recognition;
- server-generated PDFs;
- notification delivery;
- production migrations, monitoring, or automated integration tests.

All current confirmations and calculations are front-end demonstrations using sample data.

## 10. Product decisions still required

The following decisions should be confirmed before finalising irreversible schema or permission behavior:

1. **Mixed condition for one SKU:** may a return row contain both good and damaged quantities, or must staff create separate rows?
2. **Allocation of good returns:** should Warehouse staff allocate returned stock later, or should allocation occur during the return?
3. **Return eligibility window:** how long does a completed run remain returnable, and may one run have multiple return batches?
4. **Physical locations:** confirm real warehouse, online fulfilment, route staging, returns bench, and Quarantine location codes.
5. **Correction permissions:** confirm who may edit POs, void receipts, or correct returns after confirmation.
6. **Similar-product pricing:** define the permitted fallback matching rule when no exact Nayax SKU sale exists.
7. **Price-to-set ownership:** confirm whether the filler may ever override the suggested price or whether only office/admin users control it.
8. **Filler cost visibility:** confirm whether latest PO cost should be visible to fillers in production or restricted by role.
9. **Print retention:** confirm whether generated print snapshots must be stored, versioned, or reproducible for audit.

## 11. Required production tests

At minimum, cover:

- full and partial PO receipts;
- damaged and undamaged receipt lines;
- exact Online/Vending split validation;
- receipt quantity exceeding the PO balance;
- empty or missing damage reason;
- eligible and ineligible route returns;
- return quantity exceeding issued minus filled;
- good and damaged route returns;
- product swaps and added pick-list rows;
- duplicate submission and network retry;
- concurrent stock or PO changes;
- compensating corrections;
- assigned-machine authorization;
- exact-SKU Nayax price match and similar-product fallback;
- print snapshots remaining stable after a later Nayax sync;
- legacy deep links to Stock History.

## 12. Recommended implementation sequence

1. Audit the production repository and map existing routes, tables, actions, jobs, permissions, and integrations.
2. Resolve the product decisions above where they affect schema or authorization.
3. Implement role visibility and navigation while preserving existing deep links.
4. Implement the optimized Inventory table and PO edit/receiving workflow.
5. Implement the separate Returns tab using finalised-run data and the existing stock movement ledger.
6. Implement unified Stock History as a read-only movement view.
7. Implement exact-SKU Nayax last-sold lookup, labelled fallback, and stable print snapshots.
8. Implement the click-only five-column print/PDF view.
9. Add server validation, transactions, idempotency, audit metadata, migrations, and tests.
10. Demonstrate end-to-end stock effects and document any intentional differences from the proposal.

## 13. Validation already completed on the proposal

The proposal has been checked for:

- inline JavaScript syntax across all nine HTML pages;
- duplicate HTML IDs;
- local link targets;
- separate Machines/Returns panels;
- unified Stock History and filters;
- Current Stock visibility for a good return;
- five-column print rows for all sample products;
- Pokémon 151 PO-cost/last-sold example;
- local HTTP 200 responses for affected pages;
- live GitHub Pages HTTP 200 responses and required content;
- clean Git whitespace checks before publication.

This is static-prototype validation. It is not a substitute for production integration, permission, transaction, or browser/device testing.

## 14. Deployment and maintenance

Current release flow:

1. Work is committed on `mobile-responsive`.
2. The branch is pushed to `origin`.
3. A pull request targets `main`.
4. Merging to `main` triggers the legacy GitHub Pages build from the repository root.
5. The live site is verified after Pages reports `built`.

The live proposal URL is:

<https://josh441.github.io/gameguys-proposed-ui/>

Local preview used during proposal work:

`http://127.0.0.1:4173/`

## 15. File map

| File | Purpose |
|---|---|
| `index.html` | Proposal launcher |
| `ownership.html` | Owner financial, value, performance, and forecast views |
| `inventory.html` | Stock, allocation, PO editing/receiving, and Stock History |
| `machines.html` | Filler machines, pick list, pricing, Returns, and print preview |
| `miscellaneous.html` | Release calendar |
| `crm.html` | Supplier contacts and task management |
| `all-in-one.html` | Condensed proposal walkthrough |
| `board.html` | Flow and architecture diagrams |
| `handoff.html` | Shareable visual product/development handoff |
| `HANDOFF.md` | Acceptance criteria, edge cases, and open decisions |
| `BUILD-PLAN.md` | Detailed behavior and proposed data model |
| `DEV-PROMPT.md` | Production implementation prompt |
| `PROJECT-HANDOVER.md` | Consolidated current-state handover |
| `PURCHASING-STREAMLINE.md` | Purchasing streamline proposal for the production app (section 17) |
| `purchasing-flow.html` | Embedded Purchasing workspace source and backward-compatible standalone route |

## 16. Definition of production completion

The production feature is complete only when:

- fillers see only assigned machines and eligible completed runs;
- pick lists use production Nayax data and preserve the approved pricing/print behavior;
- fill stock deducts exactly once;
- unused good stock returns to Warehouse and damaged stock goes only to Quarantine;
- good returns immediately affect Current Stock;
- POs can be safely edited and received with complete Online/Vending allocation;
- confirmations are authorized, atomic, idempotent, and auditable;
- Stock History shows all relevant immutable movements without creating a second stock action;
- production tests cover permissions, quantities, damage, allocation, retries, concurrency, corrections, pricing lookup, and print snapshots;
- product signs off on the unresolved decisions or their documented production resolutions.

## 17. Purchasing streamline (production app)

**Scope note.** This section summarises a proposal against the **live production application** (`gameguys-saas`, Next.js + Supabase), covering purchasing end to end from buy signal through supplier reality, approval, ordering, tracking, receiving, and landed cost. The audited production detail remains in `PURCHASING-STREAMLINE.md`; its six underlying lifecycle steps are grouped into three user-facing tabs—Plan, Orders, and Receive—inside `Inventory → Purchasing`. The audit was written on 4 August 2026 from a direct read of the production working tree plus `docs/SOP-Purchasing.html`, `docs/SOP-Admin.html`, `docs/USER_GUIDE.md`, `docs/Bottlenecks-Proposal.html` and `docs/SOP-Readiness-Audit.md`.

The full proposal is [PURCHASING-STREAMLINE.md](PURCHASING-STREAMLINE.md). The interactive version is [Inventory → Purchasing](inventory.html#purchasing). This section exists so the handover is not silent about it.

### 17.1 The finding

Purchasing in production is already substantial: draft to approved to ordered to partial to received, admin-only approval gated on an attached supplier quote, AI extraction of supplier documents, a self-learning supplier alias layer, a pool-aware suggestion board, allocation tracking, a first-class receive flow, AfterShip webhook ingestion with HMAC verification, and a read-only Xero pull. The gap is not features. It is three specific things:

1. **The buy decision contains no supplier reality.** Every suggestion assumes the SKU is available. In TCG it frequently is not, so the buyer pivots to whatever has stock, entirely outside the app. A keyword sweep of `app/`, `lib/` and `supabase/` confirms there is no offer, availability, MOQ, price-validity, substitute or alternate model anywhere. `po_lines.qty_allocated` records what a supplier actually shipped, after the order was placed, which is a different question.
2. **New releases carry no economics.** `upcoming_releases` stores a date, a name, a source URL and a pre-payment amount. It stores no expected demand, expected sell price, projected margin, committed quantity or decision record. Separately, four independent mechanisms suppress a zero-velocity SKU (no planogram slot means no row at all; `qty_to_bring` falls to zero; `units_to_purchase` is therefore zero; and `computeInventoryHealth` classifies zero velocity as dead stock). Meanwhile a capable consensus market-price engine exists, with a branch built specifically for never-sold products, and no part of it reaches purchasing.
3. **Arrival tracking is captured and then drives nothing.** The AfterShip webhook writes `aftership_eta` on every update. The PO detail page displays it; nothing else consumes it, not the board lanes, not the late calculation, not `/po-dashboard`, and not as a fallback for the hand-typed `expected_date`. Registration fires only on the transition to `ordered`, so tracking added later, including from the receive page, is never registered at all. Changing a tracking number blocks re-registration permanently. Nothing notifies anyone on an exception, and the overdue badge requires `paid_at` to be null while payment is a hard gate before receiving, so the POs actually in transit are precisely the ones that never show as late.

### 17.2 Target flow

| Stage | Change |
|---|---|
| 01 Buy list | `/purchasing/board` becomes the single origination surface. Lead-time cover folds into its query and `/auto-po` stops writing POs. Snoozes honoured. One `v_buy_signals` view feeds the board, the reorder queue and the dashboard. One `v_po_attention` view replaces four competing definitions of "needs attention". |
| 02 Availability | New. Generate an availability request per supplier, capture the reply (PDF, photo or pasted text) through the existing extractor with the prompt extended for availability, quantity, MOQ and price validity, map names via the existing alias table, and show an offer chip plus ranked alternates on the buy list. Every suggestion ends with a recorded outcome. |
| 03 Release call | New card. Quantity from a named comparable's actual first-28-day sell-through; expected sell price from the existing consensus engine's never-sold branch; projected margin from the existing formula; demand research stored with sources and confidence; deposit surfaced from the existing `prepayment_*` columns. Decision recorded as commit, watch or pass with a revisit date. |
| 04 Approval | One card carrying lines, landed cost in AUD, projected margin, supplier fill rate, cash guardrail and the quote. `approved_by` added. `setPOStatus` becomes a real state machine so approval cannot be skipped. Standing authority under a threshold offered as an optional policy switch. |
| 05 Send and track | Link the supplier PDF that already exists and is currently unreachable, after deciding whether its totals block should keep printing our import duty, broker, quarantine and other import cost rows to the supplier (the file comment and the SOP both claim it strips them; it does not). Record send channel, recipient and sender. Prefill ETA from supplier lead time. Register or re-register tracking whenever it changes. Use `aftership_eta` as the primary ETA. One Arrivals view. Slack and in-app alerts on exception, expiry and ETA slip. |
| 06 Record | One totals function including all five landed-cost columns, recomputing `total_aud` on any cost, currency or FX change. A `po_fees` ledger replacing accumulate-in-place. Landed cost converted to AUD and apportioned into `stock_movements` at receipt. Receiving made atomic and idempotent on both paths. Status trigger compares against confirmed quantity so short allocations can reach `received`. |

### 17.3 New schema

Five new tables: `supplier_offers`, `supplier_offer_lines`, `product_alternates`, `buy_outcomes`, `po_fees`. Added columns on `upcoming_releases` (release economics and decision), `purchase_orders` (`approved_by`, send record) and `receipts` (the `idempotency_key` the code already assumes exists). Three new views: `v_buy_signals`, `v_po_attention`, `v_supplier_fill_rate`. Everything else is wiring existing parts together.

### 17.4 Defects to fix in the same pass

Thirty-five are catalogued in the proposal with file and line references. The ones that change behaviour rather than polish it:

- `/auto-po` submits only product ids and writes the baseline quantity, discarding the lead-time-adjusted number the buyer reviewed, and reads a different view than the page renders.
- `setPOStatus` never reads the current status, so a non-admin can move a draft straight to `ordered` and bypass approval entirely.
- `receivePOInFull` has no idempotency key. A sequential double click is caught by the remaining-quantity guard, but two concurrent requests both book the stock. Neither receive path is atomic.
- `logExtraFee` accumulates in place with no key, so a resubmitted supplier bill inflates landed cost permanently; import GST and duty write to the same cost column, surviving only in the activity log; and logging the first fee silences the prompt for the rest.
- `recalc_po_totals` omits all five landed-cost columns, and editing a fee does not fire it at all. Four separate totals implementations disagree, including the one printed on the supplier PDF.
- `fx_rate_to_aud` silently defaults to 1 for any currency.
- Promoting a release never writes `po_upcoming_releases`, so a preordered release re-suggests forever and the calendar never shows Preordered.
- The receive tracking gate requires carrier and number on the server while the UI shows a green badge for either one.
- Four purchasing actions, including supplier allocation confirmation, write no activity row.
- Two action-centre tiles link to `/orders` with query strings, and that route is a bare redirect that drops the query, so both land the user on an unfiltered board.

### 17.5 Sequence

Five sprints, roughly 19 to 27 developer-days, each shipping something usable alone: free wins with no schema; approval and arrivals; availability and substitution; release economics; cost truth; then consolidation and SOP reconciliation. Full breakdown in the proposal.

### 17.6 Decisions required

Nine, listed in section 10 of the proposal. The ones that block schema: standing-authority threshold and eligible suppliers, default offer validity, substitution rules (which swaps count as valid and in what rank order), Xero push versus a bill export, release commit granularity, and whether the five header cost columns stay as derived values once the fee ledger exists.

## 18. Immediate next actions

- Product: confirm the nine prototype decisions in section 10.
- Product: confirm the nine purchasing decisions in section 10 of `PURCHASING-STREAMLINE.md`, in particular standing authority and substitution rules.
- Developer: audit the production repository before proposing migrations.
- Developer: map current Nayax sale-history fields and stock-movement paths.
- Developer: produce an implementation plan showing reused versus new components.
- Developer: ship purchasing Sprint 0 (link the supplier PDF, the auto-PO quantity bug, the FX-defaults-to-1 bug on the live create path, the approval bypass, tracking re-registration, feeding `aftership_eta` into the late calculation, the action-centre links that drop their query string). No schema changes, and it removes three silent correctness bugs.
- Developer: clear the stale rows in `docs/SOP-Readiness-Audit.md`. Zod on PO create and update, server-side idempotency on PO create, and the client-side submit disable are all already shipped, and the audit still lists them as open.
- QA/Product: validate the final production build on filler phones, warehouse tablets, and printable A4 output.
- Documentation: reconcile `docs/SOP-Purchasing.html` and `docs/Bottlenecks-Proposal.html` after the build. Both currently describe capabilities that do not exist as written (a Supplier PDF header button, an automatic Xero push, a supplier scorecard).
