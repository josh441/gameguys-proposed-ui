# Game Guys Operations — Developer Implementation Prompt

Use this prompt inside the production Game Guys codebase. Treat the proposal as a product and UX reference, not as code to paste into the application.

## Objective

Implement the Game Guys Operations reorganisation and stock workflows described in this repository. Preserve the production app's existing framework, components, authentication, permissions, database conventions, server actions, and third-party integrations. Reuse working functionality instead of rebuilding it.

Read these references before editing production code:

1. `BUILD-PLAN.md` — detailed flows, rules, data model, constraints, and delivery phases.
2. `HANDOFF.md` — product acceptance criteria, edge cases, open decisions, and definition of done.
3. The live proposal at `https://josh441.github.io/gameguys-proposed-ui/` — visual and interaction reference.

Start by auditing the production repository and mapping each requested capability to existing routes, components, services, actions, tables, jobs, and permissions. Then present a short implementation plan identifying what can be reused, what must be extended, and any product decision that blocks safe implementation. Do not create parallel stock logic when an existing path can be extended.

## Required navigation and roles

Keep no more than five top-level operational tabs:

- **Ownership** — owner financials, sales, machine/product performance, machine value, and forecast.
- **Inventory** — receiver stock overview, purchase orders, delivery receiving, and unified Stock History.
- **Machines** — separate **Machines & Pick List** and **Returns** sub-tabs for the filler, plus print/PDF.
- **Calendar** — Pokémon release calendar and preorder actions.
- **CRM** — supplier contacts and team task management.

Use the application's existing roles. Map the receiver workflow to the current warehouse/purchasing permission model rather than inventing an unverified production role. Fillers must only see assigned machines and eligible completed runs.

## Inventory stock overview

Build a compact current-stock table optimized for warehouse use:

- Show product name, SKU, language, product type, allocation, physical location, and on-hand quantity.
- Keep **Online store**, **Vending machines**, **Warehouse · unallocated**, and **Quarantine** distinct.
- Support search by product, SKU, or location.
- Support language and allocation filters.
- Support sorting by name, language, and on-hand quantity.
- Default to 10 rows and allow 25 rows per page, with record count and previous/next controls.
- Do not show a stock-health bar, low-stock label, or reorder threshold until the business defines the calculation and thresholds.
- Put **Scan stock** in the Inventory header. Open the AI camera/scanner only on request; do not reserve a large dashboard card for it.

## Purchase orders and receiving

Support PO viewing and editing for header fields and line items. In receiving, group each line into three clear work areas:

1. **Product + PO balance** — item, SKU, ordered, previously received, and still due.
2. **This delivery + damage** — arrived now, damaged quantity, damage reason, calculated good quantity.
3. **Good-stock allocation** — Online store, Vending machines, or a balanced split.

Receiving rules:

- `arrived_qty` includes damaged units.
- `good_qty = arrived_qty - damaged_qty`.
- `online_store_qty + vending_qty = good_qty` for every confirmed line.
- A damaged quantity greater than zero requires a reason and creates a Quarantine movement only.
- **Receive all outstanding** may fill every remaining line, but it must keep allocations valid.
- **Clear this delivery** resets the draft only and moves no stock.
- Saving a draft moves no stock.
- Confirmation is atomic and idempotent, creates one immutable receipt reference, and sets the PO to `Partial` or `Received` from the remaining quantities.

## After-run route returns

In **Machines**, let the filler return unused Pokémon stock after completing a run:

- Begin with a dropdown of the filler’s eligible completed route/machine runs.
- Load returnable products from the finalised run, not from the earlier editable pick-list draft.
- Show the item, editable return count, and locked machine/location/route source.
- Constrain `returned_qty` to `0..(issued_qty - filled_qty)`.
- Mark each line **Good** or **Damaged**. A damaged line requires a hobby-relevant reason.
- Good stock creates a positive movement to **Warehouse · unallocated**.
- Damaged stock creates a **Quarantine** movement only and never increases sellable inventory.
- Confirm the batch once with a unique idempotency key and a route-linked return reference.
- Show every return movement in `Inventory → Stock History`, alongside PO receipts, route fills, allocation transfers, adjustments, and other damage movements. The receiver must not approve it or move the stock again.
- Show good returns immediately in `Inventory → Stock Overview → Current stock` as Warehouse · unallocated.

If production must support good and damaged quantities for the same SKU in one return, model them as separate condition quantities or rows while preserving the single return batch. Confirm this open product decision before finalising the schema.

## Inventory Stock History

Build one newest-first, read-only movement ledger instead of a return-specific Inventory screen:

- Source the ledger from immutable stock movements and join the relevant receipt, route, transfer, adjustment, product, location, and user metadata. Do not create a second return record or approval step just to populate this view.
- Include PO receipts, route-fill withdrawals, route returns, allocation transfers, stocktake adjustments, and Quarantine/damage movements.
- Show date/time, movement type, product/SKU, source, destination/allocation, signed quantity, reference, recorded-by user, and resulting balance.
- Support text search and filters for movement type, stock area/allocation, and whether the movement increased, decreased, or did not affect sellable stock.
- Open a referenced PO, receipt, route, return batch, or adjustment in its existing detail view when the production app already has that route.
- Keep confirmed movements immutable. Corrections must add a compensating movement that is also visible in this ledger.
- Preserve old Inventory return-history deep links by redirecting them to Stock History when practical.

## Filler pick list and print behavior

- Generate pick lists on demand from the last seven days of sales and the machine planogram/PAR configuration.
- Order working rows and printed rows by slot number.
- Allow only product swaps/additions and quantity changes; price, slot, PAR, and source fields remain locked.
- Show the latest successful Nayax selling price for the exact SKU across the filler-visible machine fleet, including the source machine and sale timestamp.
- If no exact-SKU sale exists, show a comparable-product price only when it is explicitly labelled as a similar-product fallback; never imply it is an exact match.
- Keep latest PO unit cost secondary and explicitly labelled. It must never be confused with the selling price. The proposal example is Pokémon Card 151: latest PO cost `$5.99`, last Nayax sale `$8.50` at GGV-007 on 2 August.
- Use the last-sold Nayax value as the default exact selling-price reference. Snapshot and print both `price to set` and `last sold (Nayax)` as separate columns, even when the values match. Keep PO cost and sale-source machine/timestamp off the printed sheet.
- Finalising the route feeds the existing `picklist_final_rows → apply_picklist_withdrawal()` path. Do not create a second deduction.
- Keep print preview hidden during normal work. **View print / PDF** opens a modal on request.
- Print only **slot · item · price to set · last sold (Nayax) · amount**.

## Non-negotiable stock safeguards

- Stock deducts exactly once at fill finalisation.
- Confirmed returns and receipts are idempotent and use immutable movement records.
- Corrections use compensating movements; do not edit confirmed movement history.
- Nayax remains the selling-price and machine-sales source of truth. Last-sold lookup must use successful sales, respect filler machine visibility, and expose its source timestamp. Warehouse returns must not alter Nayax sales, prices, or machine stock.
- Never merge Online-store and Vending-machine balances into an ambiguous “Store” bucket.
- Never count Quarantine as sellable stock.
- Never store supplier login credentials; supplier contact details only.
- Validate permissions, quantities, allocations, and outstanding balances on the server inside the same transaction as confirmation.

## Engineering expectations

- Preserve existing production architecture and naming conventions.
- Use migrations only for additions not already represented in the current schema.
- Keep authorization and validation server-side even when the UI prevents invalid input.
- Make operational screens usable on warehouse tablets and filler phones.
- Provide accessible labels, keyboard behavior, focus management, loading states, empty states, and actionable validation messages.
- Add focused tests for full/partial receipts, damage, mixed allocations, route eligibility, excessive quantities, duplicate retries, concurrent changes, and compensating corrections.
- Update existing tests when extending reused logic; do not weaken unrelated coverage.

## Delivery sequence

1. Audit the production repository and map reusable functionality.
2. Confirm the five open product decisions listed in `HANDOFF.md` where they affect schema or irreversible behavior.
3. Implement navigation and role visibility without breaking existing deep links.
4. Implement the optimized Inventory table and PO edit/receiving workflow.
5. Implement the separate filler Returns tab and unified Inventory Stock History using existing finalised-run and stock-movement data.
6. Implement the click-only print preview and approved print stylesheet.
7. Add migrations, server validation, permissions, idempotency, audit metadata, and tests.
8. Demonstrate the end-to-end stock movements and document any production differences from the proposal.

## Definition of done

The work is done when a filler can complete a run and return unused Pokémon stock from the correct route/machine; damaged stock cannot enter a sellable balance; a receiver can efficiently browse current stock and receive a PO with a fully balanced Online-store/Vending allocation; every confirmation is authorized, auditable, atomic, and idempotent; and the resulting references and balances appear in the correct Inventory views without duplicate deductions.
