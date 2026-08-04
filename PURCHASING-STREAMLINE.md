# Purchasing Streamline Proposal

**Prepared:** 4 August 2026
**Scope:** the production app `gameguys-saas` (Next.js + Supabase), purchasing module only
**Audience:** the developer implementing this, plus Josh for the decisions in section 10
**Basis:** direct read of the working tree at `Game Guys_Dashboard Project/gameguys-saas`, plus `docs/SOP-Purchasing.html`, `docs/SOP-Admin.html`, `docs/USER_GUIDE.md`, `docs/Bottlenecks-Proposal.html`, `docs/SOP-Readiness-Audit.md`

---

## 0. The short version

Purchasing is already well built. The gap is not features, it is three things:

1. **The buy decision has no supplier reality in it.** Every suggestion the system makes assumes the SKU is available at the supplier. In TCG it usually is not, so the buyer pivots to whatever has stock, and that pivot happens entirely outside the app. There is no offer, availability, MOQ, price-validity or substitute model anywhere in the schema (verified by keyword sweep, section 2.2).
2. **New releases carry no economics.** `upcoming_releases` stores a date, a name and a pre-payment amount. It stores no expected demand, no expected sell price, no projected margin and no committed quantity. Meanwhile a good market-price engine already exists (`lib/consensus-pricing.ts`) with a purpose-built branch for products that have never sold, and **zero bytes of it reach the buy decision**.
3. **Arrival tracking is captured and then not used.** The AfterShip webhook writes `aftership_eta` on every update, and it is rendered on the PO detail page (`app/purchase-orders/[id]/page.tsx:1112-1113`) and nowhere else. No decision logic consumes it: not the board lanes, not the overdue or late calculation, not `/po-dashboard`, and not as a fallback for the hand-typed `expected_date`. Registration also fires only on the `draft -> ordered` transition, so any tracking number added later (including from the receive page, a primary entry point) is never registered and gets no status or ETA at all. Nothing notifies anyone when a shipment is late or in exception.

Around those three, there is a set of small structural problems worth fixing in the same pass: approval can be skipped entirely, five surfaces disagree about which POs need attention, two PO-creation engines do different maths, and landed cost never reaches the stored total or inventory valuation.

The proposal below is mostly **assembly, not construction**. Two new tables carry the whole availability idea. Everything else is wiring parts that already exist to each other, plus a fix list.

---

## 1. How to read this

| Section | Contains |
|---|---|
| 2 | Verified current state, with file references. Read this before disagreeing with anything below. |
| 3 | Where it hurts, ranked, with Josh's own framing |
| 4 | Target process, stage by stage |
| 5 | New versus reused, explicitly |
| 6 | Data model changes |
| 7 | Fix list (defects found while mapping) |
| 8 | Build sequence |
| 9 | Acceptance criteria |
| 10 | Decisions needed before schema is locked |
| 11 | What was deliberately not proposed |

References are `path:line` against the working tree as read on 4 August 2026. Line numbers will drift; the symbol names will not.

**One caveat on the evidence.** This was read from a working copy that did not include every file. The PO edit page (`app/purchase-orders/[id]/edit/*`) and several migrations were absent, including whichever ones create the five header cost columns, `total_aud`, `subtotal_aud`, `fx_rate_to_aud`, `po_lines.qty_allocated`, `paid_at` and `extra_fees_dismissed_at`. Claims about those columns rest on the select strings in application code, which are internally consistent but are not the DDL. Two consequences worth checking before you build: whether `recalc_po_totals` is redefined by a later migration, and whether a migration outside this set already adds `receipts.idempotency_key` (the code at `actions.ts:2047-2070` assumes both the column and its unique index). Also note `v_current_purchasing_summary` has no definition in what was read, so the severity of F2 is unproven even though both reads are confirmed.

---

## 2. Verified current state

### 2.1 Lifecycle and approval

Statuses (`supabase/migrations/20260511022340_rename_po_status_sent_to_ordered.sql:10-12`):
`draft`, `approved`, `ordered`, `partial`, `received`, `cancelled`.

`partial` and `received` are set by a DB trigger, not the app (`supabase/migrations/20260507061504_004_receipts_and_auto_inventory.sql:82-96`). Everything else goes through `setPOStatus` (`app/purchase-orders/actions.ts:1721`).

Approval exists and works: admin-only gate (`actions.ts:1730-1732`), requires a supplier quote or proforma on file before it will pass (`actions.ts:1733-1743`), stamps `approved_at` (`:1747`), notifies all admins on draft creation and notifies the drafter on approval (`:419-431`, `:1816-1825`).

Three real problems:

- **`setPOStatus` is not a state machine.** It validates only the target value against a flat allowlist and never reads the current status (`actions.ts:1724-1725`). A non-admin with the `purchasing` role can move a draft straight to `ordered`, skipping approval. `approved_at` stays null, `sent_at` gets stamped, and the admin-only gate is never reached. The board UI hides the button, but that is UI only.
- **There is no `approved_by` column.** The approver's identity survives only in `activity_log` and in `notifications.actor_email`. Separately, `approver` is a free-text column (`actions.ts:43`) that nothing reconciles against who actually clicked Approve. On the create form it is hardcoded and read-only (`po-form.tsx:94`, `const [approver] = useState("Linda")`, no setter, rendered as text at `:711`), but it stays writable through the per-field edit path (`HEADER_FIELD_KIND`, `actions.ts:471`). Two sources of truth for the same fact, one of which is a name typed once and never checked.
- **`sent_at` is unconditionally overwritten** on every transition to `ordered` (`actions.ts:1751`). Bouncing `ordered -> draft -> ordered` destroys the original send date, which is the input to supplier lead-time measurement.

There are no spend thresholds anywhere. Approval is per-PO and binary regardless of value, confirmed both in code and in `docs/SOP-Admin.html` section 3.

### 2.2 Supplier-side data: definitive absence

A keyword sweep across `app/`, `lib/` and `supabase/` for `availability`, `in_stock`, `stock_status`, `moq`, `minimum_order`, `min_qty`, `offer`, `price_valid`, `valid_until`, `confirmed_qty`, `substitute`, `alternate`, `back_order` returns **nothing usable**. The only hits are a code comment about pack-price substitution and a comment about a UI grouping.

What does exist:

| Thing | Where | What it actually is |
|---|---|---|
| `po_lines.qty_allocated` | `app/purchase-orders/[id]/allocations-editor.tsx`, `actions.ts:1417-1443` | What the supplier confirmed they will ship, typed in by hand after the PO was already sent. Retrospective, per-PO, post-order. |
| `closed_short` / `closed_short_reason` | `supabase/migrations/20260519014609_po_close_short_and_preorder_lead.sql:5-8` | Accepting a permanent shortfall after the fact. |
| Chase heuristic | `app/purchasing-summary/action-center.tsx:39-56` | PO sent more than 5 days ago with lines still unallocated. A badge, no DM. |
| `supplier_product_aliases` | `supabase/migrations/20260512022628_supplier_product_aliases.sql` | Supplier vocabulary mapped to internal SKU, auto-learned from every corrected PO line. **The single most reusable asset for the availability problem.** |
| AI document extraction | `actions.ts:904-951` | Pulls supplier, currency, dates, six fee fields and per-line name/qty/cost out of a quote PDF or photo. The prompt has **no** availability, stock, MOQ or price-validity field, so even when a supplier's quote says "out of stock" or "min 6 boxes", it lands only in free-text notes, capped at 300 characters. |
| `/supplier-pricing` | `app/supplier-pricing/page.tsx` | Landed unit cost in AUD per product across historical PO lines. Cross-supplier comparison of what was paid, not of what is on offer. |

So the system can tell you what a supplier *did* ship. It has no way to represent what a supplier *has*.

### 2.3 New releases

`upcoming_releases` columns (`supabase/migrations/20260513125203_create_upcoming_releases.sql:1-16` plus `20260602_release_prepayments.sql:7-11`): `set_code`, `set_name`, `language`, `release_date`, `set_type`, `source_url`, `notes`, `manual`, `product_id`, `dismissed_at`, `fetched_at`, `created_by`, `prepayment_due_date`, `prepayment_amount_aud`, `prepayment_paid_at`, `prepayment_notes`.

Rows come from an AI web-search call (`lib/release-calendar.ts:54-91`, Sonnet with web search, AU user location, throttled to one fetch per 24h) or manual entry (`app/upcoming-releases/actions.ts:146-177`).

Not captured, verified against the full column list and the full read of `actions.ts`: expected demand, expected sell price, projected margin, committed quantity, popularity or hype score, confidence on the date, dismissal reason, supplier. Derived state is binary coverage only: Preordered / Paid / Allocated / Needs preorder (`app/upcoming-releases/page.tsx:97-125`).

The zero-history problem is structural, not cosmetic. Four independent mechanisms suppress a new SKU:

1. `v_slot_velocity` is driven off `planogram_slots` (`supabase/migrations/20260507092156_007_velocity_views.sql:27`). No slot means no row at all, so the product is invisible to `v_purchase_summary`, `/auto-po` and the board's restock lane.
2. With zero sales, `weighted_sales_per_week` is 0.
3. `qty_to_bring` therefore falls to the `else 0` branch (`007_velocity_views.sql:74`), so `units_to_purchase` is 0 and the SKU is never suggested.
4. `computeInventoryHealth` classifies zero velocity as **dead stock** (`lib/stock-intelligence.ts:302-307`), so a freshly landed release sitting in machines pre-sale can surface on the dashboard as the worst dead SKU.

Meanwhile the machinery that would answer "what will this sell for" already exists and is good. `lib/consensus-pricing.ts:204-282` does a trust-weighted median across independent source families, excludes and names outliers, and has a dedicated never-sold branch (`:256-279`) that corroborates against distinct AU shop domains and stamps `confidence: "unverified"` rather than discarding a thin result. `products.tcg_market_price_aud` appears in `app/purchase-orders/new/po-form.tsx` at exactly two places (a type member at `:27` and a local object at `:438`) and is **never rendered and never used in any calculation**.

### 2.4 Ordering and sending

The supplier PDF **exists**: `app/purchase-orders/[id]/pdf/page.tsx`, 251 lines, A4 print-optimised, line columns limited to SKU / Product / Qty / Unit cost / Line total in supplier currency. Filename is driven by `generateMetadata` so the browser's Save as PDF lands on `GameGuys PO <number> <date>`.

**But it is not as stripped as the file comment and the SOP claim.** The per-line landed-cost fields are genuinely excluded by the query (`unit_cost_landed*`, `line_total_landed*`, `unit_cost_aud` are not selected at `:48`). The **totals block prints our import costs**: Import duty, Customs broker, Quarantine and inspection, and Other import cost each render as a visible row when non-zero (`:205-228`). `docs/SOP-Purchasing.html:330` states the PDF "deliberately strips internal landed-cost columns", which is only half true. So F19 is not purely a link: decide first whether those four rows should reach a supplier, and drop them if not.

**It is linked from nowhere.** A case-insensitive grep for `pdf` in `app/purchase-orders/[id]/page.tsx` returns zero hits. The route is reachable only by typing the URL. `docs/SOP-Purchasing.html` section 8 documents it as a header button next to Edit and Duplicate, which does not exist. This is the cheapest win in this entire document.

Transmission is manual and the code says so, at `pdf/page.tsx:91-93`: "Print this or save as PDF, then send to the supplier via email / WhatsApp." Nothing records that a send happened. `sent_at` is a self-report attached to the status change.

ETA (`expected_date`) is hand-typed on every path (`actions.ts:34`, `:128`, `:220`, `:618`) even though `suppliers.lead_time_days` and `products.preorder_lead_days_override` both exist. The PO dashboard's overdue count and on-time-delivery KPI are computed entirely from that hand-typed field (`app/po-dashboard/po-dashboard-section.tsx:169-170`, `:265-266`).

### 2.5 Arrival tracking

The AfterShip webhook is properly built: HMAC-SHA256 signature verification over the raw body, timing-safe compare, fails closed when the key is missing (`app/api/aftership/webhook/route.ts:50-55`, `lib/aftership.ts:158-173`). It writes five columns including **`aftership_eta`** from `expected_delivery` (`route.ts:96`).

Then:

- **`aftership_eta` is displayed once and used nowhere.** It is selected and rendered on the PO detail page inside the carrier status card (`app/purchase-orders/[id]/page.tsx:112`, `:1112-1113`). Nothing else touches it: the board reads only `aftership_status`, and only as a `/deliver/i` substring test to move a card to the receive lane (`app/purchasing/board/page.tsx:17-18`); `/po-dashboard` computes overdue from the hand-typed `expected_date` (`po-dashboard-section.tsx:168-170`); and no code falls back to the carrier ETA when `expected_date` is missing. The number is right there and the answer to "when does this arrive" still comes from memory.
- **Registration is one-shot and status-gated.** `registerTrackingForPO` fires only from the transition to `ordered` (`actions.ts:1767-1778`) and bails if there is no tracking number (`:1850`). `updateShipping` (`actions.ts:1372-1395`) never calls it. So tracking added after ordering, including from the receive page (`app/receive/[id]/page.tsx:197-205`), is never registered and never gets a status or ETA.
- **Tracking changed after registration can never re-register.** `updateShipping` overwrites `tracking_number` without clearing `aftership_tracking_id`, and the early return at `actions.ts:1852` then blocks re-registration permanently. `lib/aftership.ts:6` documents reactivate as deferred; no reactivate, PATCH, update or polling function exists.
- **No one is told about an exception.** The webhook file imports no notification helper and has no branch on `tag === "Exception"`. `tagTone` maps Exception to a danger colour (`lib/aftership.ts:184`) and that is the entire response: a badge. `aftership` appears zero times in `app/purchasing-summary/` and `app/po-dashboard/`.
- **Late detection is broken on exactly the POs that matter.** The board computes `overdueDays` only when `expected_date` is past **and `paid_at` is null** (`app/purchasing/board/page.tsx:63-66`). Payment is a hard gate before receiving (`actions.ts:2002-2014`), so most POs actually in transit are already paid, and therefore never show an overdue badge. `/po-dashboard` uses a different rule that ignores payment but caps the dataset at 12 months (`po-dashboard-section.tsx:84`, `:168-170`). A paid late PO appears on one surface and not the other.

### 2.6 Two engines, five surfaces

**`/purchasing/board`** is the good surface. Lanes derived from PO status (`board/page.tsx:14-21`). Its Suggested lane applies pool-aware netting: a suggested pack is netted against on-order quantity of every format plus uncracked warehouse stock of crackable formats via `product_unit_links` (`:116-208`). `promoteExistingProduct` / `promoteNewProduct` merge into one draft PO per supplier per buy type via `resolveDraftPO` (`board-actions.ts:32-56`). `buyType` already supports `restock | preorder | trial`, and **`trial` is fully plumbed with no generator behind it** (`promote-sheet.tsx:50` even defaults to it).

**`/auto-po`** is the problem. Three defects, compounding:

- The client submits only `productIds`, `expectedDate` and `notes` (`app/auto-po/client.tsx:99-103`). **Quantities are never sent.**
- The server writes `qty_ordered: r.units_to_purchase` (`app/auto-po/actions.ts:88`), the baseline, discarding the lead-time-adjusted number the buyer just reviewed. The "Lead-time adjusted" toggle is **on by default** (`client.tsx:52`). Approve 140 units, get a PO for 100.
- It reads `v_purchase_summary` (`actions.ts:27`) while the page renders `v_current_purchasing_summary` (`page.tsx:21`). Two different views.

It also always inserts a fresh draft PO instead of merging (`actions.ts:69-81`), omits `po_type`, omits `qty_in_box` / `qty_in_packs` that the board's own netting query depends on, and applies no pool netting at all. Using both engines on one supplier produces two draft POs with inconsistent pack maths.

Snoozes are honoured on `/purchasing-summary` and `/auto-po` and **ignored by the board** (no `snooze` reference exists anywhere under `app/purchasing/board/`). A SKU the buyer explicitly deferred with a reason still appears in the Suggested lane.

"Needs attention" is computed five times with four different definitions: board lanes, `/purchasing-summary` action centre, `/po-dashboard` health alerts, `/purchase-orders` status pills, and the PO detail NextActionBanner. Only the board and the PO detail page can act on any of it; the action centre and `/po-dashboard` are links.

`/orders` and `/purchasing` are both bare redirects to `/purchasing/board` (`app/orders/page.tsx:8`, `app/purchasing/page.tsx`). `/purchase-orders` is the history table. Two of the four action-centre tiles point at `/orders` with query strings (`action-center.tsx:79`, `:87`), and **the redirect drops the query string**, so both of those tiles land the user on an unfiltered board. That is a functional break, not a tidiness problem.

### 2.7 Cost and recording

- **`recalc_po_totals` ignores every landed-cost column.** It stores `subtotal`, `gst = subtotal * 0.10`, `total = subtotal + gst` (`supabase/migrations/20260507061421_002_purchasing_tables.sql:63-79`). Freight, duty, broker fee, quarantine and other import cost are absent from the calculation, so the columns `logExtraFee` writes to roll up into nothing. Because those columns live on `purchase_orders` rather than `po_lines`, editing a freight figure does not fire the trigger at all.
- **Four live totals implementations disagree.** The trigger (stored values), `lib/po-totals.ts:36-42` (form display, includes fees, keys off `qty_in_packs`), `app/purchase-orders/[id]/page.tsx:359-371` (detail display, keys off `qty_allocated ?? qty_ordered`, unrounded), and `pdf/page.tsx:73-83` (supplier PDF). The supplier PDF prints the trigger's fee-exclusive `total` underneath an itemised list of the fees that total does not contain.
- **`total_aud` is a payment-time snapshot nothing refreshes.** Written only in `recordPayment` (`actions.ts:1343-1344`). `applyHeaderUpdate` writes `fx_rate_to_aud`, `currency` and all five cost columns and never recomputes it (`:495`, `:510`, `:524-532`). `logExtraFee` never touches it, and since the whole premise of the fee card is that these bills arrive *after* the invoice, fees are structurally guaranteed to land after the only recompute point.
- **`fx_rate_to_aud` defaults to 1 for any currency.** A JPY PO created without a typed rate reports its AUD total at 1:1 until payment, with no warning. Note the live path is `createPOWithLines` (`actions.ts:222`, `data.fx_rate_to_aud ?? 1`) fed by the form's own default (`po-form.tsx:88`, `useState("1")`). The legacy `FormData` paths at `actions.ts:136` and `:626` have the same default, so fixing only those leaves the bug in the path the form actually uses.
- **Extra fees double-count on retry.** `logExtraFee` does a read-modify-write accumulate, `existing + amountSupplier` (`actions.ts:2296`, `:2301`), with no idempotency key and no queryable per-fee row. Resubmitting the same DHL bill inflates landed cost permanently. `dhl_tax` and `import_duty` also map to the same column (`:2257-2268`), so the distinction the dropdown asks for is lost from the cost column. It does survive in `activity_log`, which logs each fee individually with type, both amounts, FX rate, bill date and notes (`:2309-2321`), so that log is the backfill source when the ledger in section 6 lands.
- **The fee prompt silences itself.** `logExtraFee` sets `extra_fees_dismissed_at` on every successful log (`:2304`), and the receive-page prompt is gated on that being null (`app/receive/[id]/page.tsx:133`), directly contradicting the comment above it which explains that one PO picks up several separate DHL bills. Logging the import tax silences the prompt for the broker and quarantine bills.
- **Landed cost never reaches inventory valuation.** `po_lines.unit_cost` flows to `receipt_lines.unit_cost` to `stock_movements.unit_cost` with no FX multiplication and no freight or duty apportionment. A JPY PO books stock movements at a JPY unit cost.
- **Synthetic GST on foreign POs.** `recalc_po_totals` adds 10% regardless of currency, while the real AU import GST arrives separately from DHL and is logged into `import_duty`.
- **`receivePOInFull` has no idempotency key** (`actions.ts:2173`), unlike `receivePO` (`:2095`). A *sequential* double-click is caught by the `remaining > 0` filter, which throws "Nothing left to receive on this PO" (`:2160-2169`), so the exposure is narrower than it first looks: a genuine concurrent race, where both requests read `qty_received` before the trigger increments it, double-books stock. Still real, and cheap to close. Neither receive path is atomic either: the receipt header and the receipt lines are separate round-trips with per-row triggers, so a mid-batch failure leaves some lines booked and an orphan header.
- **No over-receipt guard.** The UI shows "Over by N" (`receive-lines-form.tsx:342-346`) and submits it anyway.
- **Short-allocated preorders can never reach `received`.** Receive prefills from `qty_allocated` (`receive-lines-form.tsx:80`) but the status trigger compares against `sum(qty_ordered)` (`004_receipts_and_auto_inventory.sql:82-92`). Fully receiving a short allocation leaves the PO `partial` indefinitely until someone remembers to close it short.
- **`closePOShort` never drafts the back-order.** `draftBackOrderPO` exists (`actions.ts:1559`) and is never called from it. The modal tells the buyer to go do it manually (`close-short-button.tsx:46-51`).
- **`po_invoices` is dead code.** The table is created, backfilled, indexed and commented as the new home for uploads (`20260523121234_po_invoices_multi.sql`), and referenced by zero lines of application code. Both upload paths still write the legacy `purchase_orders.invoice_*` columns, so a second invoice overwrites the pointer and orphans the file.
- **Xero is pull-only and cannot push.** The cron pulls bank summary, open ACCPAY bills, monthly and weekly P&L, and repeating invoices (`app/api/cron/xero-sync/route.ts:531-539`). `lib/xero.ts` exposes exactly one data function, `xeroGet` (`:226-244`), hardcoded to GET, and every *accounting* scope in `XERO_SCOPES` is read-only (`lib/xero.ts:23-38`; the list also carries `openid`, `profile`, `email` and `offline_access`, none of which authorise a write). Even a hand-rolled POST would 401. `purchase_orders.xero_po_id` has exactly one occurrence in the whole repo: its own column declaration. Xero push for approved POs is listed as next-quarter roadmap in `docs/Bottlenecks-Proposal.html` while the same document's prose asserts it already happens.

---

## 3. Where it hurts, ranked

Josh's own framing, in his words: *"deciding what stocks to get, there are a lot of factors for TCG. What we need from last time are not always in stock so we tend to pivot to other choices that usually have the best stock. Another problem is when there are new releases, since no historical data on our end is available usually the basis here is demand, popularity and profitability among the AU market which is being done through research. Also for tracking since we need to always know when products will arrive."*

| Rank | Problem | Why it is the top of the list |
|---|---|---|
| 1 | **Availability drives the buy, and the system does not know about availability** | The pivot to whatever has stock is the actual buying process. It happens in WhatsApp and email. The system learns about it weeks later via `qty_allocated`, if at all. Nothing accumulates: the same out-of-stock SKU is suggested again next week at the same rank. |
| 2 | **New releases are decided on research the system never sees** | The research (AU demand, popularity, profitability) is real work done every cycle and stored nowhere. It cannot be revisited, compared against outcome, or reused when the same set family drops in another language. And the pricing engine that could do half of it automatically is not connected. |
| 3 | **Arrival dates are unreliable** | ETA is hand-typed, the carrier's real ETA is displayed on one page and drives nothing, and the late badge deliberately excludes paid POs, which is nearly all in-transit POs. "What is arriving this week and what is late" has no single trustworthy surface. |
| 4 | **Approval is a single-person gate with a bypass** | One approver for everything (confirmed by Josh) is fine at this size, but it must be fast and it must be real. Today it can be skipped by a non-admin and the approver is not recorded on the row. |
| 5 | **Two engines, five surfaces, one quantity bug** | `/auto-po` silently orders less than the buyer approved. That is a correctness bug, not a UX complaint. |
| 6 | **Landed cost is not in the total** | Margin decisions are being made against a number that excludes freight and duty, and inventory is valued in the supplier's currency. |

---

## 4. Target process

Six stages. Each names what already exists, so this reads as a change list rather than a rewrite.

### Stage 1: Buy list (one surface)

**`/purchasing/board` becomes the only origination surface.**

- Fold the lead-time cover maths from `/auto-po` (`app/auto-po/page.tsx:121-128`) into the board's suggestion query so there is one suggested quantity in the product, not two.
- Retire `/auto-po` as a PO-creating engine. Keep it, if wanted, as a read-only bulk table that links into the board. Do not leave two writers.
- Honour `reorder_snoozes` in the board's Suggested lane.
- Introduce a single view, `v_buy_signals`, that produces every suggestion with `suggested_packs`, `reason`, `buy_type`, `on_order_qty`, `snooze_state` and `offer_state` (stage 2). The board, `/purchasing-summary` and `/po-dashboard` all read it. One definition, three renderings.
- Same treatment for attention: one `v_po_attention` view with one definition of overdue, late, awaiting-invoice, awaiting-tracking, unallocated-and-silent. Kill the four competing definitions.
- Surface the truncation. The Suggested lane currently fetches 24 restock rows and renders 10, and fetches 12 releases and renders 6, silently (`board/page.tsx:113`, `:181`, `:220`, `:222`). Show "10 of 24, view all".

### Stage 2: Availability check (the new part)

This is the one genuinely new capability, and it is small.

**Concept.** Before a PO exists, the buyer asks one or more suppliers what they have. The reply, whether a PDF, a photo of a price list, or a pasted WhatsApp message, becomes a structured **offer**. Offers attach to the buy list, so the board can show, per suggestion: is it available, at what price, from whom, until when, and if not, what is the ranked alternative.

**Flow.**

1. From the board, select suggestions and generate an **availability request** per supplier. Output is the existing supplier PDF layout with cost columns replaced by a "qty available / your price" column, plus a copyable plain-text list for WhatsApp.
2. When the supplier replies, drop the file or paste the text into the offer intake. Reuse `extractPOFromFile` (`actions.ts:999`) with the prompt extended to include `availability`, `qty_available`, `moq`, `unit_cost`, `price_valid_until` and `substitute_for`. Reuse `supplier_product_aliases` to map their names onto internal SKUs, and let the existing auto-capture learn the new ones.
3. Review the mapped lines, same review-before-save discipline the PO extractor already uses, then save the offer.
4. The board now shows an **offer chip** on each suggestion: `In stock 8 boxes · JPY 4,900 · valid to 12 Aug`, or `Out at Supplier A`, plus the best-price supplier when more than one has offered.
5. When a suggestion is out of stock, the board shows **ranked alternates** from `product_alternates`, each carrying its own offer chip, velocity, and projected margin. The buyer picks the substitute in one click and it goes into the same draft PO basket, with the substitution recorded.
6. Every suggestion in a round gets an outcome: `ordered`, `passed` with reason, `unavailable` with the substitute chosen, or `snoozed`. Outcomes feed a supplier fill-rate figure and stop the same suggestion resurfacing at full rank next week.

**Why this is cheap.** The extractor, the alias layer, the promote sheet, the draft-PO basket, the pool netting and the landed-cost comparison page all exist. The new parts are two tables, one alternates table, one intake screen and one chip.

**Alternates seeding.** Auto-seed `product_alternates` from same set family plus same format plus same language, and allow manual pinning. Rank by trailing velocity, then by projected margin. The buyer's actual substitution choices should reinforce the ranking over time.

### Stage 3: Release buy card (new releases with no history)

One card per upcoming release, opened from `/upcoming-releases` or from the board's preorder lane. It answers the three questions Josh actually asks, and it stores the answers.

**Will it sell.** Use comparables, not the SKU's own history. Pick the nearest analogue past release by language plus `set_type` plus format, pull its actual first-28-day sell-through per machine from the existing Nayax-backed sales data, and propose a target quantity from that. Show which comparable was used and let the buyer change it. `allocateVmUnits` (`lib/forecast.ts:29-69`) already does the largest-remainder split across machines and already falls back to an even split when total velocity is zero, which is exactly the new-release case.

**What will it sell for.** Wire `lib/consensus-pricing.ts` into this card. Its never-sold branch (`:256-279`) is purpose-built: multi-source, family-aware independence, distinct-AU-shop corroboration, and it stamps `unverified` rather than discarding a thin result. Store the result in `product_price_observations`, which already has `sources` jsonb and `reasoning` columns for exactly this.

**Is it worth it.** Reuse the existing margin formula from `app/purchase-orders/[id]/page.tsx:691`, `(retail - unitLandedAud) / retail`, with expected sell price on the retail side and expected landed cost, including estimated freight and duty, on the cost side. Same thresholds already in use: 35% and 15%.

**Demand and popularity research.** Clone the existing pattern into a demand-research call: Sonnet with web search and AU user location pinned, strict JSON schema, field-by-field validation (`lib/release-calendar.ts:54-131`), plus the 24h DB-cached throttle that wraps it (`app/upcoming-releases/actions.ts:13`, `:35-45`). It returns evidence with source URLs and a confidence, stored in `demand_evidence` jsonb. It never decides. It replaces the tab-hunting part of the research, not the judgement.

**Decision record.** `decision` of `commit | watch | pass`, `target_qty_packs`, `decision_reason`, `decided_by`, `decided_at`. A `pass` behaves like a snooze: it expires and comes back, with the reason attached, instead of vanishing.

**Deposit.** The `prepayment_*` columns already exist and already feed `computeCashFlowForecast` (`lib/cash-flow.ts:426-448`). Surface them on this card and on the PO, so a deposit due in six weeks is visible where the buy decision is made.

**Fix while here.** `promoteNewProduct` never writes `po_upcoming_releases` (`board-actions.ts:144-234`), while the Suggested lane's dedupe reads exactly that table (`board/page.tsx:212-213`). A release preordered from the board re-appears in Suggested forever and the calendar never shows Preordered, Paid or Allocated. It is more than a one-line insert: the `Suggestion` type carries no release id (`board/types.ts:27-39`) and the id currently exists only inside the display key (`preorder-${r.id}`, `board/page.tsx:226`), so it needs a field on `Suggestion`, threading through `promote-sheet.tsx`, a schema change on the promote payload, and then the insert.

### Stage 4: Approval (fast, and real)

Josh approves everything. Design for that.

- **One approval card**, openable from the board, the notification, or the Slack DM link. It shows lines with quantities, landed cost in AUD, projected margin, supplier fill-rate, the attached quote, and the `safeToSpend` guardrail the board already computes (`board/page.tsx:266-279`). Approve or Hold-with-reason. Nothing else on screen.
- **Carry the prerequisite treatment across to the board.** On PO detail this is already handled well: Approve renders disabled with an explanatory title when no invoice is on file, and the Documents fold auto-opens (`app/purchase-orders/[id]/page.tsx:532-533`, `:1040`), with the server throw at `actions.ts:1739-1743` as a backstop. The board's approve control has no such gate (`card-actions.tsx:53`), so the same click from the board fails with an error in a small inline div and no way to fix it there. The approval card should show every unmet prerequisite with an inline upload, wherever it is opened from.
- **Add `approved_by uuid`.** Backfill from `activity_log` where possible. Either drop the free-text `approver` field or auto-fill it from the approver and make it read-only.
- **Make `setPOStatus` a real state machine.** An explicit transition table: `draft -> approved | cancelled`, `approved -> ordered | draft | cancelled`, `ordered -> partial | received | cancelled`, `partial -> received | cancelled`, and `received` terminal except via a compensating action. Reject anything else server-side. This closes the approval bypass.
- **Do not overwrite `sent_at`** if it is already set; record re-sends separately.
- **Optional, Josh's call:** standing authority. A named supplier plus `po_type = restock` plus total under a threshold auto-approves, with the approvals appearing in a daily digest that Josh can reverse. Default off. This is the only real escape valve from single-approver latency, and it is a policy decision, not a technical one (section 10, decision 1).

### Stage 5: Send and track

**Send.**

- **Link the supplier PDF, after deciding what prints.** Add the button to the PO detail header next to Edit and Duplicate, which is where `docs/SOP-Purchasing.html` section 8 already tells staff it is. The link itself is a few lines. First settle whether the four import-cost rows in the totals block (`pdf/page.tsx:205-228`) should be visible to a supplier; the file comment and the SOP both say they are stripped, and they are not.
- **Record the send.** New columns `sent_channel` (`email | whatsapp | portal | other`), `sent_to`, `sent_by`, and keep the send events in `activity_log`. "Mark ordered" then means something verifiable.
- **Prefill ETA** from `suppliers.lead_time_days`, or `products.preorder_lead_days_override` for preorders, with the field still editable. The dashboard KPIs depend on this field, so stop asking a human to remember it.
- Fix the supplier PDF total to match whichever totals definition wins in stage 6, and either show GST or state that the total is GST-exclusive.

**Track.** This is Josh's "always know when products will arrive".

- **Register tracking whenever it changes,** not only on the transition to `ordered`. Call `registerTrackingForPO` from `updateShipping`, clear `aftership_tracking_id` when the tracking number changes, and add the reactivate call that `lib/aftership.ts:6` has been deferring.
- **Use `aftership_eta` as the primary ETA**, with hand-typed `expected_date` as the fallback and a visible marker for which one is showing. It is already in the database on every webhook update, and already rendered on PO detail; the work is making the board, the late calculation, `/po-dashboard` and the new Arrivals view read it too.
- **One Arrivals view**, grouped by week: PO, supplier, contents summary, ETA with source, days late, exception flag, paid state, and a direct Receive action. This replaces "Inbound this week" as a tile with an actual working surface.
- **One definition of late,** in `v_po_attention`, that does **not** exclude paid POs. Delete the `!paid_at` condition at `board/page.tsx:63-66`.
- **Notify.** Slack DM plus notification row on AfterShip tag `Exception` or `Expired`, and on an ETA slipping past the promised date. Add a daily arrivals digest on the existing cron pattern. The webhook currently writes the tag and tells nobody.
- **Fix the tracking gate mismatch.** The server requires both carrier and tracking number (`actions.ts:1983-1995`); the UI's `hasTracking` uses OR and shows a green "Tracked" badge (`shipping-section.tsx:31`). A PO with a tracking number and no carrier looks fine and fails at receive.

### Stage 6: Record

- **One totals function.** A single DB function computing `subtotal`, `adjustments`, `gst`, `total`, `subtotal_aud`, `total_aud`, keyed off one agreed quantity column, including all five cost columns and the discount. Fire it on `po_lines` changes **and** on `purchase_orders` cost, currency or FX changes. Delete `lib/po-totals.ts`, the `[id]/page.tsx` inline recompute and the `pdf/page.tsx` recompute, and have all four surfaces read the stored values.
- **Recompute `total_aud` on every cost change,** not only at payment. Keep the `payment-snap` FX behaviour: that part is correct and deliberate.
- **Warn on FX 1.0** for a non-AUD PO at create and edit time.
- **Replace fee accumulation with a `po_fees` ledger:** one row per bill, with `fee_type`, `amount_aud`, `amount_supplier`, `fx_rate`, `bill_date`, `document_id`, `idempotency_key`, `created_by`. Derive the header columns from the ledger. This removes double-counting, un-collapses `dhl_tax` from `import_duty`, and lets the prompt stay open until the buyer explicitly says "no more fees expected" rather than silencing itself on the first log.
- **Apportion landed cost at receipt.** Convert to AUD and spread freight and duty across received units by value, so `stock_movements.unit_cost` is a real AUD landed cost. This is what makes margin, GMROI and inventory valuation trustworthy.
- **Make receiving atomic and idempotent.** Move the receipt header plus lines into one RPC. Add an idempotency key to `receivePOInFull`. Add the missing `receipts.idempotency_key` migration that `actions.ts:2054-2055` already assumes exists.
- **Block or flag over-receipt** instead of showing "Over by N" and submitting it.
- **Compare against `coalesce(qty_allocated, qty_ordered)`** in the status trigger so a fully received short allocation reaches `received` instead of sitting `partial` forever.
- **Offer the back-order draft from `closePOShort`.** `draftBackOrderPO` already exists.
- **Either use `po_invoices` or drop it.** Today a second invoice silently orphans the first file.
- **Xero:** decide (section 10, decision 4). Push needs a write scope and a re-consent, which is a real decision, not a code task. The interim is a one-click bill export from the approved PO, which removes the retyping without touching the OAuth grant.

---

## 5. New versus reused

| Target capability | Status | Built on |
|---|---|---|
| One buy-list surface | Reuse + consolidate | `app/purchasing/board/*`, retire `/auto-po` as a writer |
| Pool-aware netting | Reuse as-is | `board/page.tsx:116-208`, `product_unit_links` |
| Suggestion to draft PO | Reuse as-is | `promote-sheet.tsx`, `resolveDraftPO` |
| Supplier availability / offers | **New** | 2 tables, extend `extractPOFromFile` prompt, reuse `supplier_product_aliases` |
| Substitution / alternates | **New** | 1 table, seeded from set family + format + language |
| Buy outcome record | **New** (small) | Pattern copied from `reorder_snoozes` |
| Release economics | Extend existing table | `upcoming_releases` + new columns |
| Expected sell price for a never-sold SKU | Reuse, currently disconnected | `lib/consensus-pricing.ts:256-279`, `product_price_observations` |
| Demand research | Reuse pattern | `lib/release-calendar.ts:54-131` |
| Projected margin | Reuse formula | `app/purchase-orders/[id]/page.tsx:691` |
| Machine allocation for a new release | Reuse as-is | `lib/forecast.ts:29-69` |
| Deposit tracking | Reuse, needs surfacing | `prepayment_*` columns, `lib/cash-flow.ts:426-448` |
| Cash guardrail on the buy screen | Reuse as-is | `board/page.tsx:249-279` |
| Approval card | Reuse + 1 column | `approved_by`, state machine in `setPOStatus` |
| Supplier PDF | **Exists, needs a link plus a decision on the import-cost rows** | `app/purchase-orders/[id]/pdf/page.tsx` |
| Send record | Extend | 3 columns on `purchase_orders` |
| Real ETA | Reuse, currently display-only | `aftership_eta`, written by the webhook, rendered on PO detail, drives nothing |
| Arrivals view + late alerts | New screen, existing data | `v_po_attention`, AfterShip columns, `lib/notifications.ts`, `lib/slack.ts` |
| Fee ledger | **New** table | Replaces the accumulate-in-place columns |
| Landed cost in valuation | Fix | Receipt path, `stock_movements.unit_cost` |
| Xero push | Decision, then new | Needs `accounting.transactions` write scope and re-consent |

Genuinely new schema: `supplier_offers`, `supplier_offer_lines`, `product_alternates`, `buy_outcomes`, `po_fees`. Five tables. Everything else is columns, views, wiring and fixes.

---

## 6. Data model changes

Sketch only. Audit the live schema first; names, tenancy and constraints follow the real codebase, and migrations go through the `apply_migration` MCP tool per `docs/SOP-Readiness-Audit.md`.

```
supplier_offers
  id, supplier_id -> suppliers, received_at, source ('pdf'|'photo'|'text'|'manual'),
  document_path, currency, valid_until, notes, created_by, created_at
  -- one supplier reply. Immutable once saved; supersede rather than edit.

supplier_offer_lines
  id, offer_id -> supplier_offers, product_id -> products (nullable),
  raw_name, raw_sku, availability ('in_stock'|'limited'|'out'|'preorder'|'unknown'),
  qty_available, unit_cost, unit_kind, packs_per_unit, moq,
  substitute_for_product_id -> products (nullable), notes
  -- product_id nullable so an unmapped supplier name is still captured;
  -- resolve later via supplier_product_aliases rather than discarding the line.

product_alternates
  product_id -> products, alternate_product_id -> products,
  relation ('same_set'|'same_format'|'same_language'|'manual'),
  rank int, created_by, created_at
  primary key (product_id, alternate_product_id)

buy_outcomes
  id, product_id -> products, round_date date,
  outcome ('ordered'|'passed'|'unavailable'|'snoozed'),
  reason text, substituted_with_product_id -> products (nullable),
  po_id -> purchase_orders (nullable), decided_by, created_at
  -- one row per suggestion per round. Feeds supplier fill-rate and
  -- suppresses re-suggestion at full rank.

po_fees
  id, po_id -> purchase_orders, fee_type, amount_aud, amount_supplier,
  fx_rate_to_aud, bill_date, document_id -> po_documents (nullable),
  idempotency_key unique, notes, created_by, created_at
  -- replaces read-modify-write on the five header cost columns.
  -- Header columns become derived, or drop them and compute.

upcoming_releases  (added columns)
  expected_sell_price_aud, expected_sell_price_confidence,
  expected_landed_cost_aud, projected_margin_pct,
  demand_score, demand_evidence jsonb, comparable_product_id -> products,
  target_qty_packs, decision ('commit'|'watch'|'pass'),
  decision_reason, decided_by, decided_at, revisit_at

purchase_orders  (added columns)
  approved_by uuid, sent_channel, sent_to, sent_by,
  standing_authority_applied boolean

receipts  (missing migration the code already assumes)
  idempotency_key text + partial unique index
```

New views:

- `v_buy_signals`: every suggestion with quantity, reason, buy type, on-order netting, snooze state, offer state, best offer, alternates count. Single source for the board, the reorder queue and the dashboard.
- `v_po_attention`: single definition of overdue, late, awaiting invoice, awaiting tracking, unallocated-and-silent, exception. Does not exclude paid POs.
- `v_supplier_fill_rate`: promised versus allocated versus received, per supplier, rolling 12 months. Replaces the scorecard that two code comments reference and no table implements.

---

## 7. Fix list

Independent of the design work above. Each is small, each is a real defect.

**Correctness**

| # | Fix | Where |
|---|---|---|
| F1 | `/auto-po` orders the baseline, not the reviewed lead-time-adjusted quantity | `app/auto-po/client.tsx:99-103`, `app/auto-po/actions.ts:88` |
| F2 | `/auto-po` reads `v_purchase_summary`, page renders `v_current_purchasing_summary` | `app/auto-po/actions.ts:27` vs `page.tsx:21` |
| F3 | Approval can be skipped: `setPOStatus` never reads current status | `app/purchase-orders/actions.ts:1721-1725` |
| F4 | `receivePOInFull` has no idempotency key. Sequential double-clicks are caught by the `remaining > 0` guard; a concurrent race double-books stock | `actions.ts:2160-2173` |
| F5 | `logExtraFee` accumulates in place with no key, resubmission double-counts landed cost. Per-fee detail exists in `activity_log` only, so use it to backfill the ledger | `actions.ts:2296`, `:2301`, `:2309-2321` |
| F6 | Over-receipt is displayed and then accepted | `receive-lines-form.tsx:342-346` |
| F7 | Short-allocated PO can never reach `received` | `004_receipts_and_auto_inventory.sql:82-92` |
| F8 | Landed-cost columns absent from `recalc_po_totals` | `002_purchasing_tables.sql:63-79` |
| F9 | `total_aud` not recomputed on cost, currency or FX edits | `actions.ts:495`, `:510`, `:524-532` |
| F10 | `fx_rate_to_aud` silently defaults to 1 for non-AUD. Fix the live path first, not only the legacy ones | `actions.ts:222` and `po-form.tsx:88` (live), `actions.ts:136`, `:626` (legacy) |
| F11 | Tracking gate: server needs carrier AND number, UI shows OK with either | `actions.ts:1983-1995` vs `shipping-section.tsx:31` |
| F12 | Tracking added or changed after ordering is never registered with AfterShip | `actions.ts:1372-1395`, `:1850-1852` |
| F13 | `promoteNewProduct` never writes `po_upcoming_releases`, so releases re-suggest forever. Needs a release id on `Suggestion` and through the promote payload first | `board-actions.ts:144-234`, `board/types.ts:27-39`, `board/page.tsx:226` |
| F14 | Board ignores `reorder_snoozes` | no reference under `app/purchasing/board/` |
| F15 | Late detection excludes paid POs, which is most in-transit POs | `board/page.tsx:63-66` |
| F16 | Fee prompt silences itself after the first fee | `actions.ts:2304`, `receive/[id]/page.tsx:133` |
| F17 | Dead `'sent'` branch in `process_receipt_line` after the status rename | `004_receipts_and_auto_inventory.sql:87` |
| F18 | Receipt header and lines are not atomic | `actions.ts:2093`, `:2125` |

**Visibility and hygiene**

| # | Fix | Where |
|---|---|---|
| F19 | Supplier PDF is unreachable, link it from the PO header. Decide first whether the four import-cost rows should print to a supplier | `pdf/page.tsx:205-228`, `[id]/page.tsx` header cluster |
| F20 | `aftership_eta` is rendered on PO detail and consumed by no logic: not lanes, not late, not `/po-dashboard`, not as an `expected_date` fallback | `[id]/page.tsx:1112-1113`, `board/page.tsx:63-66`, `po-dashboard-section.tsx:168-170` |
| F21 | AfterShip Exception and Expired notify nobody | `app/api/aftership/webhook/route.ts` |
| F22 | `po.shipping_update` has no `ACTION_META` entry, renders as a raw string | `timeline-section.tsx:36-212` |
| F23 | `updateAllocations`, `replacePOLines`, `setPurchaseOrderReleases`, `deleteInvoice` write no activity row | `actions.ts:1421`, `:1640`, `:341`, `:1212` |
| F24 | Timeline capped at 50 events, no pagination, early approval events fall off | `timeline-section.tsx:289-293` |
| F25 | Suggested lane truncates 24 to 10 and 12 to 6 with no indication | `board/page.tsx:113`, `:181`, `:220`, `:222` |
| F26 | `received_by` is prefilled from the session but the server trusts whatever the client posts, and `receivePOInFull` hardcodes null | `actions.ts:2045`, `:2173`, prefill at `receive/[id]/page.tsx:115` |
| F27 | `deleteInvoice` leaves `supplier_invoice_no` and date populated | `actions.ts:1212-1240` |
| F28 | `po_invoices` created and unused; second invoice orphans the first file | `20260523121234_po_invoices_multi.sql` |
| F29 | Two action-centre tiles link to `/orders` with query strings, and the redirect drops the query, so both land on an unfiltered board | `action-center.tsx:79`, `:87`, `app/orders/page.tsx:8` |
| F30 | `notifyAdmins` targets role `admin` exactly, so `developer` never gets notified despite `isAdmin()` including it | `lib/notifications.ts:24-27` vs `lib/auth.ts:47` |
| F31 | Guardrail tile labelled "Committed · next 4 wks" shows an unfiltered total | `board.tsx:85` vs `board/page.tsx:256-258` |
| F32 | `paid_at` and `bill_date` default to today, so a payment made last week records as today | `card-actions.tsx:142`, `:195` |
| F33 | Notification fan-out silently drops recipients past 200 users | `actions.ts:436`, `:1911`, `:1973` |
| F34 | `xero_po_id` is genuinely unreferenced (one occurrence, its own declaration); either wire it or drop it. `carrierToSlug` is called internally at `lib/aftership.ts:99`, only its `export` is unused | `002_purchasing_tables.sql:15`, `lib/aftership.ts:51` |
| F35 | Documentation claims features that do not exist as documented (Supplier PDF button, Xero push, supplier scorecard). Reconcile the SOPs after the build. | `docs/SOP-Purchasing.html`, `docs/Bottlenecks-Proposal.html` |

One thing **not** to carry over: `docs/SOP-Readiness-Audit.md` still lists zod validation on PO create and update, server-side idempotency on PO create, and a client-side submit disable as open items. All three are done (`poHeaderBaseSchema` at `actions.ts:31-52` used by `createPO` at `:125`; the `createPOWithLines` schema at `:93`; `updatePOHeaderSchema` at `:614`; the idempotency migration `20260518225023` plus `actions.ts:199-248`; `disabled={submitting}` at `po-form.tsx:928`). Those audit rows are stale. Worth clearing them so nobody spends a day re-doing them.

---

## 8. Build sequence

Effort is rough developer-days for someone already in this codebase.

### Sprint 0: Free wins, no schema (1 to 2 days)

F19 (link the PDF, minus the import-cost rows if that is the call), F1, F10, F12, F14, F20, F25, F29, F31, plus ETA prefill from `lead_time_days`, plus F3 (state machine).

Rationale: F19 is minutes and the SOP already promises it. F1 and F10 are silent correctness bugs, one under-ordering and one mis-stating AUD totals. F3 closes a governance hole. F12 and F20 together deliver most of "know when products will arrive" with no new UI. F29 is a broken link two clicks from the daily routine. F13 slips to Sprint 3 because it needs a payload change, not a one-liner.

### Sprint 1: Approval and arrivals (3 to 4 days)

`approved_by`, approval card, `v_po_attention`, one definition of late (F15), Arrivals view, exception and late notifications (F21), daily arrivals digest, send record columns, F11, F22, F23, F24.

Deliverable: Josh can approve from one card in under a minute, and there is one screen that answers "what is arriving and what is late" correctly.

### Sprint 2: Availability and substitution (5 to 7 days)

`supplier_offers`, `supplier_offer_lines`, `product_alternates`, `buy_outcomes`. Extend the extraction prompt. Offer intake screen. Availability request output (PDF plus copyable text). Offer chips and ranked alternates on the board. Outcome recording. `v_supplier_fill_rate`.

Deliverable: the pivot to whatever has stock happens inside the app and accumulates.

### Sprint 3: Release economics (4 to 5 days)

`upcoming_releases` columns, release buy card, comparable selection, wire `consensus-pricing`, projected margin, demand research call, deposit surfacing, `pass` with revisit date, F13 (release id through the promote payload).

Deliverable: a new release decision is recorded with its evidence, and can be compared to what actually happened.

### Sprint 4: Cost truth (4 to 6 days)

One totals function, `total_aud` recompute (F8, F9, F10), `po_fees` ledger (F5, F16), landed cost apportioned into `stock_movements` at receipt, atomic and idempotent receiving (F4, F18), over-receipt guard (F6), F7, back-order from close-short, `po_invoices` decision (F28), Xero decision.

Deliverable: margin and inventory valuation are trustworthy, and a retry cannot corrupt cost or stock.

### Sprint 5: Consolidation (2 to 3 days)

`v_buy_signals`, retire `/auto-po` as a writer (which also disposes of F2), single reorder-queue rendering, F30, F32, F33, F34, then reconcile the SOPs and clear the stale readiness-audit rows (F35).

Total: roughly 19 to 27 developer-days, sequenced so that each sprint ships something usable on its own.

---

## 9. Acceptance criteria

**Deciding**

- One screen lists everything worth buying this round, with quantity, reason, on-order netting, snooze state and offer state. No second screen produces a different quantity for the same SKU.
- A supplier reply, as a PDF, a photo or pasted text, becomes structured offer lines mapped to internal SKUs in one review pass, with unmapped names captured rather than dropped.
- A suggestion that is out of stock at the supplier shows ranked alternates with velocity, offer price and projected margin, and substituting takes one click.
- Every suggestion in a round ends with a recorded outcome. A passed or unavailable SKU does not resurface at full rank next round.
- Supplier fill-rate is computed from promised versus allocated versus received, not from a comment referencing a scorecard that does not exist.

**New releases**

- A release card shows a named comparable, a projected quantity derived from that comparable's actual first-28-day sell-through, an expected sell price with confidence, and a projected margin.
- Research evidence is stored with source URLs and is visible next time.
- A committed release writes `po_upcoming_releases` and disappears from Suggested. The calendar shows Preordered, Paid and Allocated correctly.
- Deposits appear on the release card, on the PO and in the cash-flow forecast.

**Approval**

- A non-admin cannot reach `ordered` from `draft`. Attempting it is rejected server-side.
- Every approved PO records `approved_by`. There is exactly one field representing who approved.
- Approval prerequisites are visible before the click, not thrown after it.

**Ordering**

- The supplier PDF is reachable from the PO header in one click.
- Sending records channel, recipient, sender and time. `sent_at` is not destroyed by a re-transition.
- ETA is prefilled from supplier lead time and remains editable.

**Tracking**

- Adding or changing a tracking number at any point registers or re-registers it with AfterShip.
- The displayed ETA comes from AfterShip when available, with the source visible.
- One Arrivals view answers "what is arriving, when, and what is late", including paid POs.
- An Exception or Expired tag, or an ETA slipping past the promised date, produces a Slack DM and a notification row.

**Recording**

- One totals implementation. Freight, duty, broker, quarantine and other import cost are in `total`. Supplier PDF, PO detail, new-PO form and stored values agree to the cent.
- `total_aud` is correct after any cost, currency or FX change, not only after payment.
- Logging the same supplier fee twice does not change landed cost twice.
- `stock_movements.unit_cost` is AUD landed cost per unit.
- Double-submitting a receipt books stock once. A failed receipt books nothing.
- A fully received short allocation reaches `received` without manual intervention.

---

## 10. Decisions needed from Josh

These block schema or policy, so they come first.

1. **Standing authority.** Keep every PO on your desk, or pre-authorise routine restocks under a threshold from named suppliers, with a daily digest you can reverse? If yes, what threshold and which suppliers? This is the only structural fix for single-approver latency.
2. **Offer freshness.** How long is a supplier's quoted availability good for by default? Drives `valid_until` defaults and when the board should stop trusting an offer chip.
3. **Substitution rules.** When the exact SKU is out, what is a valid substitute? Same set different language, same set different format (box versus ETB versus tin), or same language different set? Rank order matters for the alternates seeding.
4. **Xero.** Push approved POs as draft bills (needs a write scope and re-consent, and touches your accountant's workflow), or keep the current read-only pull plus a one-click bill export? The docs currently claim the push exists.
5. **Release commit granularity.** Does a "commit" on a release need a quantity at commit time, or is a commit a decision to preorder with quantity settled when the supplier confirms allocation?
6. **Demand research depth.** Should the AU demand and popularity research be an on-demand button per release, or a weekly batch for everything inside the preorder window? Weekly batch costs more in API spend and `docs/SOP-Purchasing.html` already flags per-click cost discipline.
7. **Fee ledger migration.** Retain the five header cost columns as derived values (safer for existing reads), or drop them and compute from `po_fees` (cleaner)?
8. **Over-receipt policy.** Hard block, or allow with a reason and an audit row? Warehouse reality may require the second.
9. **Late threshold.** How many days past ETA before a shipment is "late" and someone gets pinged? Today the chase badge fires at 5 days silent, which is a different signal.

---

## 11. Deliberately not proposed

- **A supplier portal.** It is on the roadmap in `docs/Bottlenecks-Proposal.html` and it would help, but the offer intake in stage 2 gets most of the value without asking suppliers to change how they work. TCG suppliers replying on WhatsApp will not adopt a portal.
- **Automated buying.** Nothing in this proposal decides a purchase. TCG buying is judgement work under supply constraints and hype. The system's job is to put the evidence in one place, record the decision, and stop asking the same question twice.
- **Replacing Nayax or Xero.** Explicitly rejected in `docs/Bottlenecks-Proposal.html` section 1, and correctly.
- **A second stock deduction path.** One ledger, three write paths (receipt, restock, adjustment). Nothing in this proposal adds a fourth.
- **A forecasting model for new releases.** Comparables plus recorded outcomes will beat a model at this data volume, and the recorded outcomes are what would train one later anyway.
- **Cron-driven auto-PO.** On the roadmap, but scheduling an engine that currently orders the wrong quantity would be the wrong order of operations. Fix F1, consolidate to one engine, then schedule it.
