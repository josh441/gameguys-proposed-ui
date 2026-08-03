# Game Guys Operations Proposal — Product & Development Handoff

**Prepared:** 31 July 2026 · **Revised:** 3 August 2026

**Status:** Ready for product review; interactive front-end proposal, not production-connected

**Proposal:** [Launcher](index.html) · [All-in-one walkthrough](all-in-one.html) · [Detailed build plan](BUILD-PLAN.md)
**Published baseline:** <https://josh441.github.io/gameguys-proposed-ui/> (the latest changes in this handoff must be published separately)

## 1. Outcome

The proposal now covers the full stock journey for Pokémon TCG products:

1. A filler prepares and completes a vending-machine run.
2. Unused products are returned from a selected completed route/machine.
3. Good returns go back to unallocated Warehouse stock; damaged returns go to Quarantine.
4. A receiver can view and edit purchase orders, mark off the delivery, record damage, and allocate every good unit to either the Online store or Vending machines.
5. Inventory keeps Online-store and Vending-machine stock visibly separate and provides an audit-only view of route returns.

The prototype uses Pokémon products throughout so damage examples—dented packaging, crushed boxes, torn seals, water damage, and scuffing—match the business.

## 2. Where each role works

| Role | App area | Main jobs |
|---|---|---|
| Filler | **Machines** | Generate a pick list, complete a route, return unused stock, view/print a stripped filler sheet |
| Receiver | **Inventory** | View stock allocation, view/edit POs, receive deliveries, quarantine damaged arrivals, audit route returns |
| Owner | **Ownership** | Review accounting, performance, machine value, and forecast |
| Owner / team | **CRM** | Supplier contacts and assigned tasks |
| All roles | **Calendar** | Pokémon release schedule and preorder actions |

## 3. Workflow A — stock unused after a vending run

**App path:** `Machines → Return unused stock`

1. The filler finishes the route and returns to the warehouse.
2. They select a completed **route/machine** from the dropdown. Only their completed runs with returnable stock should appear.
3. The app loads the products issued for that run. Each row displays the **item**, the available return **count**, and the locked **machine/location/route source**.
4. The filler enters a returned count between `0` and `issued quantity − filled quantity`.
5. They mark each returned line **Good** or **Damaged**.
6. A damaged line requires a reason. The proposed reasons are dented packaging, crushed box, torn wrapper/seal, water damage, scuffed/unsellable, or other.
7. The summary previews the total units and destinations before confirmation.
8. The filler confirms once. The system creates one route-linked return reference.
9. Good units create a positive movement into **Warehouse · unallocated**. Damaged units create a **Quarantine** movement only and never increase sellable stock.
10. The receiver can see the completed batch in `Inventory → Route Returns`; this is an audit view and does not trigger another stock movement.

**Prototype:** [Open the return flow](machines.html#warehouse-return) · [Open its inventory audit](inventory.html#route-returns)

## 4. Workflow B — view/edit a PO and receive a delivery

**App path:** `Inventory → Purchase Orders & Invoices`

1. Find the PO and select **View / edit** or **Receive**.
2. In the edit view, review or change the supplier, status, ordered date, ETA, supplier reference, notes, and line-level item, SKU, ordered quantity, pack size, and unit cost.
3. Save the PO. Saving PO details or a receiving draft does not move stock.
4. When the delivery arrives, open **Receive delivery** and mark `Arrived now` and `Damaged` for each line. `Arrived now` includes damaged units.
   The optimized row groups the product and PO balance, this-delivery counts/damage, and allocation into three work areas instead of eight narrow columns.
5. The app calculates `good quantity = arrived now − damaged` and shows anything still due.
6. Allocate every good unit to **Online store**, **Vending machines**, or **Split online + vending**. A split must balance exactly.
7. Enter a damage reason when the damaged count is greater than zero. Damaged units go to Quarantine and are excluded from both sellable allocations.
8. Confirm once. The receipt writes separate Online-store, Vending, and Quarantine movements.
9. The PO becomes **Partial** when units are still due, or **Received** when the order is complete.

For faster clean deliveries, **Receive all outstanding** fills the remaining quantities and keeps the allocation balanced. **Clear this delivery** resets the draft line quantities without moving stock.

**Prototype:** [Open PO editing](inventory.html#po-1042) · [Open receiving](inventory.html#receive-po-1042)

## 5. Workflow C — understand stock allocation

**App path:** `Inventory → Stock Overview`

- Current stock defaults to **10 rows per page**, with a **25-row** option.
- The receiver can search product/SKU/location, filter by language or allocation, and sort by name, language, or on-hand quantity.
- The stock-level graphic and low-stock threshold have been removed because the business has not defined what healthy, borderline, or low inventory means.
- **Scan stock** is a compact action in the Inventory header and opens only when requested; it no longer occupies a dashboard card.
- **Online store** means stock allocated to ecommerce fulfilment.
- **Vending machines** means stock allocated to route staging and future machine fills.
- The same SKU may appear once per allocation, with its physical location and on-hand count.
- **Warehouse · unallocated** is where good route returns land until a receiver or allocator assigns them.
- **Quarantine** is non-sellable stock and is never included in either allocation.
- Transfers between allocations must be explicit stock movements; the UI must not silently merge the balances.

## 6. Workflow D — print or save the filler sheet

**App path:** `Machines → View print / PDF`

1. The print preview is hidden during normal Machines and Returns work.
2. Selecting **View print / PDF** opens a modal preview only when requested.
3. The user can close it with **Close**, the backdrop, or `Escape`.
4. **Print / Save PDF** opens the browser print dialog.
5. The printed sheet contains only **slot · item · exact price · amount**. Pace, PAR, stock status, product group, return controls, and other screen-only information are excluded.

## 7. Product requirements coverage

| Product-manager requirement | Proposal location | Acceptance signal | Status |
|---|---|---|---|
| Stock items back in after a run | Machines → Return unused stock | Completed route/machine can be selected and a return batch confirmed | Included |
| Show the item | Return line | Pokémon product name and SKU are visible | Included |
| Enter the count | Return line | Editable count is bounded by unused issued stock | Included |
| Show where it came from | Route selector + return line | Machine, venue, and route are displayed from the completed run | Included |
| Mark a return damaged | Return line | Good/Damaged choice, required reason, Quarantine destination | Included |
| View and edit POs | Inventory → Purchase Orders & Invoices | Header and line fields can be changed and saved | Included |
| Mark off what arrived | PO → Receive delivery | Arrived, damaged, good, and still-due quantities are shown per line | Included |
| Mark stock for store or vending | Receiving allocation | Online store, Vending machines, or balanced split is required | Included |
| Distinguish store and vending inventory | Inventory → Stock Overview | Separate KPIs, allocation labels, locations, and balances | Included |
| Optimize current-stock browsing | Inventory → Stock Overview | Search, language/allocation filters, sorting, and 10/25 rows | Included |
| Keep AI scan compact | Inventory header → Scan stock | Scanner opens on demand instead of occupying a content card | Included |
| Optimize receiving entry | PO → Receive delivery | Three grouped work areas plus receive-all and clear shortcuts | Included |
| Use hobby-relevant examples | All proposal tabs | Pokémon TCG products, sets, releases, suppliers, and damage reasons | Included |
| Do not keep print preview under Returns | Machines bottom action | Preview is hidden by default and opens only on click | Included |

## 8. Business rules and data safeguards

- A filler can only see machines and completed runs assigned to them.
- Finalising a fill deducts stock exactly once through the existing `picklist_final_rows → apply_picklist_withdrawal()` path.
- A confirmed good return creates one positive Warehouse movement; it does not reverse or replay the original deduction.
- Confirmed route returns and PO receipts require unique idempotency keys so retries cannot move stock twice.
- Draft PO receipts never move stock.
- For each receipt row, `online_store_qty + vending_qty = arrived_qty − damaged_qty`.
- Damaged returns and damaged deliveries always require a reason, go to Quarantine, and never increase sellable stock.
- Nayax remains the source of truth for machine sales and selling prices; a warehouse return does not update a Nayax sale, price, or machine quantity.
- Inventory Route Returns is audit-only—there is no second approval or duplicate stock movement.
- Supplier records contain contact details only; no supplier login credentials are stored.

The proposed tables, constraints, and movement records are specified in [BUILD-PLAN.md](BUILD-PLAN.md#4-data-model-existing--additions).

## 9. Edge cases the production build must handle

- No completed route has returnable stock: explain why the selector is empty and link back to active runs.
- A return count is negative or exceeds unused issued stock: block confirmation and identify the row.
- A damaged quantity has no reason: block confirmation.
- A receiving allocation does not equal the calculated good quantity: show the imbalance and block confirmation.
- A receipt exceeds the outstanding PO quantity: cap or reject it before confirmation.
- Network retry or double-click after confirmation: return the existing receipt/return reference without another movement.
- A product was swapped or added on the final pick list: use the finalised row, not the earlier generated draft, to calculate what is returnable.
- A route includes more than one machine: preserve a machine/location source per return line or split the return into machine-specific batches.
- Concurrent inventory changes: validate quantities again on the server at confirmation and report conflicts without partial writes.

## 10. Production decisions still to confirm

1. **Mixed condition for one SKU:** the prototype marks the entire returned row Good or Damaged. Production should confirm whether one SKU line may be split—for example, 3 good packs and 1 damaged pack—or whether staff should add two condition lines.
2. **Who allocates returned stock:** good route returns currently land in Warehouse · unallocated. Confirm whether allocation to Online store or Vending machines happens as a separate warehouse task or during the return.
3. **Route selector eligibility:** confirm how long a completed run stays returnable and whether a run can have multiple return batches.
4. **Physical warehouse locations:** confirm the real fulfilment shelves, route-staging zones, and Quarantine location codes.
5. **Permissions:** confirm who can edit confirmed POs, void a confirmed receipt, or correct a return; corrections should use compensating movements, not record edits.

## 11. Developer delivery checklist

- [ ] Use assigned-machine scoping on every filler query and mutation.
- [ ] Load returnable quantities from the finalised run, not from editable pick-list drafts.
- [ ] Implement atomic, idempotent confirmation for route returns and PO receipts.
- [ ] Write separate immutable movements for Warehouse, Online store, Vending machines, and Quarantine.
- [ ] Enforce all quantity and allocation constraints on both client and server.
- [ ] Add audit metadata: user, timestamp, route, machine, location, PO/receipt/return reference, and reason.
- [ ] Keep the print preview closed by default and print only the four approved columns.
- [ ] Test full, partial, damaged, mixed-allocation, retry, and concurrent-update cases.
- [ ] Verify mobile/tablet layouts for warehouse and route use.
- [ ] Obtain product sign-off on the five decisions above before backend implementation is considered complete.

## 12. Proposal file map

- [index.html](index.html) — proposal launcher
- [machines.html](machines.html) — filler pick list, after-run return, and click-only print preview
- [inventory.html](inventory.html) — allocation view, editable POs, receiving, and route-return audit
- [all-in-one.html](all-in-one.html) — condensed stakeholder walkthrough
- [BUILD-PLAN.md](BUILD-PLAN.md) — flows, data model, build phases, and non-negotiable rules
- [DEV-PROMPT.md](DEV-PROMPT.md) — copyable production implementation prompt for the developer or AI coding assistant
- [handoff.html](handoff.html) — shareable visual version of this document

## 13. Definition of done

The feature is complete when a filler can return unused Pokémon stock from a valid completed route, damaged stock cannot enter a sellable balance, a receiver can edit and receive a PO with a fully balanced Online-store/Vending allocation, every confirmation creates an auditable and idempotent movement, and the resulting balances and references are visible in the correct Inventory views.
