# Game Guys Operations — Build Plan & Flow Spec

> **Purpose:** This is a handoff document for the developer + their AI coding assistant.
> Paste it into the AI alongside the codebase so it understands the intended information
> architecture, screen behaviours, data flows, and business rules. Use the **live prototype**
> as the visual reference — this doc is the source of truth for *behaviour*.

**Live prototype:** https://josh441.github.io/gameguys-proposed-ui/
**Screens:** `ownership.html` · `inventory.html` · `machines.html` · `miscellaneous.html` (Calendar) · `crm.html`

---

## 0. Golden rules (read first)

1. **Do not rebuild what already exists — surface it.** The app already has Xero sync, Shopify/Nayax
   syncs, PDF PO/invoice extraction, release calendar, supplier contacts, task assignment + notify,
   and warehouse auto-deduct. This plan reorganises and exposes those; it does not duplicate them.
2. **Source of truth is split:**
   - **Nayax = sales & price truth.** The app *mirrors* Nayax; fillers price/update on Nayax, we pull.
   - **App = stock truth.** Stock is deducted when a fill is finalised, then reconciled against Nayax sales.
3. **Auto-deduct already works** via the `picklist_final_rows` insert trigger
   (`apply_picklist_withdrawal()`) → creates a negative `stock_movements` row → surfaced in `/reconciliation`.
   **Do NOT add a second deduction path** (e.g. from the filler hub) or stock will double-count.
4. **Fillers are scoped** to their assigned machines only (individual `filler_machine_assignments`;
   route assignment is a bulk convenience that writes those rows).
5. Keep navigation to **5 top-level tabs**. Everything deeper is a sub-tab.

---

## 1. Navigation (information architecture)

Five top-level tabs. Sub-views are tabs *inside* a screen, not new sidebar entries.

```mermaid
flowchart LR
  Root[Game Guys Operations] --> O[Ownership<br/>owner]
  Root --> I[Inventory<br/>receiver]
  Root --> M[Machines<br/>filler]
  Root --> C[Calendar<br/>all]
  Root --> R[CRM<br/>owner/team]

  O --> O1[Financials & Sales]
  O --> O2[Machine Value]
  O --> O3[Machine & Product Stats]
  O --> O4[Forecast]
  I --> I1[Stock Overview]
  I --> I2[POs & Invoices]
  R --> R1[Suppliers]
  R --> R2[Task Management]
```

**Role → default tab / visibility**

| Role | Lands on | Can see |
|------|----------|---------|
| Owner / Admin | Ownership | everything |
| Receiver / Warehouse | Inventory | Inventory, Calendar, Machines (read), CRM tasks |
| Filler | Machines | Machines (own), Calendar |

---

## 2. Screen specs

### 2.1 Ownership (owner)
Curated business view. **Surface Xero data, don't rebuild the P&L.**

- **Financials & Sales:** KPIs (total sales all channels, net profit, gross margin, stock spend,
  cash-in-stock, cash flow); sales trend chart split by channel (vending vs online);
  sales-by-channel donut; stock spend by language (EN/JP/CN); curated Xero P&L
  (COGS, opex, fixed, import taxes → net profit). *Limit to what owners actually need.*
- **Machine Value:** see §3.3 (live cost vs retail per machine).
- **Machine & Product Stats:** machines best→worst by net profit; best product per top machine;
  top-10 and bottom-10 products by net profit.
- **Forecast:** projected revenue / recommended stock spend / projected profit; recommended actions;
  scenario planner (conservative / recommended / aggressive spend).

### 2.2 Inventory (receiver)
- **Stock Overview:** current on-hand (live from Nayax + warehouse), incoming stock (synced from
  Nayax + Shopify) with ETA + status, low/out-of-stock flags, dead/slow-stock aging.
  **AI stock camera:** recognise product identity or barcode and auto-count on receiving/stocktake.
- **POs & Invoices:** PO list with per-**pack** cost (TCG) or per-**box**/unit cost (blind boxes/snacks);
  **AI PDF reader** extracts line items, pack/box counts and prices from a dropped quote/invoice.

### 2.3 Machines (filler) — see §3.1 for the flow
- KPIs: machines assigned, urgent fills, last Nayax sync.
- Machine cards (status: urgent/low/good, favourite, location, products-to-fill, est. time).
- **Pick list** (the important part) — see §3.1a for full behaviour. Summary:
  - **Generated on demand** — the picker hits *Regenerate* any day for whichever machine/route
    they're prepping (not on a fixed schedule). Built from the **last 7 days of sales** per location,
    showing how much is missing per row.
  - **Working view rows are ordered by SLOT number ascending** (1,2,3…), *not* by urgency.
  - **Columns:** slot · product group · product name · current qty in machine · **PAR (capacity/size,
    shown beside the qty)** · qty to add · **price (exact, single value)** · pace *(sales/wk + days-left,
    on-screen only — must NOT print)*.
  - **Editing is restricted to product + quantity only** (≈90% of runs need 0–2 changes):
    - Out-of-stock → **swap** a replacement via search/dropdown; the new **price and qty auto-update**.
    - **Add an extra row** (a new set or a hot seller) not on the generated list — product + qty only.
    - Qty is an inline stepper (manual override); everything else is locked.
- **Printout** — see §3.1b. Stripped to **slot · item · exact price · amount** and nothing else.
- Bottom bar: Confirm fills · Mark route complete · Print/PDF (bad reception) · total est. cost.

### 2.4 Calendar (all)
Release calendar grouped by month: product, set code, language, preorder status. "Action needed"
list for releases without secured stock. (Feature already exists — just relocate under this tab.)

### 2.5 CRM (owner/team)
- **Suppliers:** contact only — name, phone, email, products ordered, terms, rating.
  **Never store login credentials / passwords.**
- **Task Management:** create + assign a task → assignee is notified (existing `pingAssignee` →
  `notifyUser`). Board columns: To do / In progress / Done.

---

## 3. Core flows

### 3.1 Filler fill workflow (on-demand pick list)

```mermaid
flowchart TD
  A[Filler opens Machines tab] --> B[Sees ONLY assigned machines]
  B --> C[Picks machine/route + hits Generate/Regenerate<br/>any day, on demand]
  C --> D[Pick list built from last 7 days of sales<br/>qty to add = PAR − current in machine]
  D --> E[Rows ordered by SLOT number ascending]
  E --> F{Per line}
  F -- In stock --> G[Keep or adjust qty with +/- stepper]
  F -- Out of stock --> H[Swap a replacement via search<br/>price + qty auto-update to new item]
  F -- Extra needed --> J[Add a row: new set / hot seller<br/>product + qty only]
  G --> K[Print / PDF: slot · item · exact price · amount]
  H --> K
  J --> K
  K --> L[Physically fill machine + set prices on Nayax]
  L --> M[Mark route complete]
  M --> N[App inserts picklist_final_rows]
  N --> O[Trigger apply_picklist_withdrawal<br/>writes negative stock_movements]
  O --> P[/reconciliation compares planned fill vs Nayax sales/]
```

#### 3.1a Working view rules
- **Generation:** on demand (Regenerate button), per machine/route, any day. Source = last 7 days of
  sales per location; `qty_to_add = PAR − current_in_machine` (never negative).
- **Ordering:** by `slot_number` ascending — the physical layout order, not urgency.
- **Columns:** slot · group · product · current-in-machine · **PAR (beside qty)** · qty-to-add ·
  **exact price** · pace *(sales/wk + days-of-cover — screen-only, excluded from print)*.
- **Allowed edits (product + qty ONLY):**
  - **Swap** (out of stock): pick a replacement SKU → its **price and qty populate automatically**.
  - **Add row**: search a SKU (new set / hot seller) + qty. No other columns editable.
  - **Qty override**: inline stepper per row.
- Everything else (slot, group, price source, PAR) is **locked** — target ≈90% zero/low-touch runs.

#### 3.1b Printout rules
- Print/PDF contains **only 4 columns: slot · item name · exact price · amount.**
- **Exactly one price per item** (no ranges) — the filler just keys it into Nayax and moves on.
- Swaps/added rows/qty overrides flow through to the printout; on-screen-only fields (pace,
  group chips, status) are stripped. Implement with a print stylesheet or a dedicated print view.

**Rule:** the hub does NOT deduct stock itself — deduction happens only at "Mark route complete"
through the existing `picklist_final_rows` path (see Golden Rule #3).

### 3.2 Source of truth

```mermaid
flowchart LR
  N[Nayax<br/>sales + price truth] -->|pull entries| APP[App - mirror]
  APP -->|deduct at fill finalisation| S[App - stock truth]
  N --> RC[Route reconciliation]
  S --> RC
  RC --> V[Variance flagged per filler / machine]
```

### 3.3 Machine Value (live cost vs retail)

Each machine tracks **cost** (what we paid) and **retail** (what it sells for). Value recomputes on
every sale (down) and restock (up). No manual entry.

```mermaid
flowchart LR
  Start[Start of day<br/>retail value $1,000] -->|customer buys $50| Down[$950]
  Down -->|filler restocks $100| Up[$1,050]
```

- `machine_value_retail = Σ(unit_qty × selling_price)` per machine.
- `machine_value_cost   = Σ(unit_qty × unit_cost)` per machine.
- `margin = (retail − cost) / retail`.
- **Decrease** on a Nayax sale (pulled): reduce qty of sold SKU → recompute.
- **Increase** on a fill/restock: `stock_movements` into machine → recompute.
- Portfolio totals = sum across machines. Show "today's change" (▲ restocked / ▼ sold).

### 3.4 Inventory receiving (with AI)

```mermaid
flowchart TD
  PO[Create PO] --> AIP[AI PDF reader extracts lines, pack/box counts, unit cost]
  AIP --> CF[Confirm PO]
  CF --> INC[Incoming list - synced Nayax/Shopify, ETA + status]
  INC --> RCV[Receiver receives; AI camera counts by identity/barcode]
  RCV --> WH[Warehouse stock increases -> stock_movements]
```

### 3.5 Task assignment

```mermaid
flowchart LR
  T[Anyone creates a task] --> AS[Assign to a teammate]
  AS --> NT[Assignee notified - pingAssignee -> notifyUser]
  NT --> BD[Board: To do / In progress / Done]
```

---

## 4. Data model (existing + additions)

**Existing (reuse):**
- `routes`, `routes.assigned_user_id`
- `machines`
- `filler_machine_assignments` — **the scoping source of truth** for fillers
- `stock_movements` — every stock change (restock/sale/adjustment) with signed `qty_delta`
- `picklist_upload_pulls`, `picklist_final_rows` — final upload + `apply_picklist_withdrawal()` trigger
- `products` + `products_naming_parts` (set_code / series_name / language)
- Xero, Shopify, Nayax sync tables; supplier + task tables

**Likely additions for this plan:**
- **Machine planogram / par config** — `machine_slots(machine_id, slot_number, product_id, par_qty)`.
  Drives slot ordering, PAR (capacity), and `qty_to_add = par_qty − current_in_machine`.
- **Selling price per SKU** (mirrored from Nayax) + **unit cost** (from PO) → powers price column + Machine Value.
- **Sales velocity** per machine+SKU (last-7-day units → `sales_per_week`, `days_of_cover`) — screen-only pace.
- **Pick list generation** — `picklists(id, machine_id, generated_by, generated_at, source='last_7d_sales')`
  and `picklist_rows(picklist_id, slot_number, product_id, current_qty, par_qty, qty_to_add,
  unit_price, row_type ∈ {generated, swapped, added}, swapped_from_product_id, edited_qty)`.
  This is the *editable working draft*; on "Mark route complete" it feeds the existing
  `picklist_final_rows` (do NOT add a second deduct path — Golden Rule #3).
- Price snapshot stored on each row at print time so the printout shows one exact price.

**Pick-list schema sketch:**

```sql
create table machine_slots (          -- planogram: what sits where + capacity
  machine_id   uuid references machines(id),
  slot_number  int,                   -- ordering + printed slot
  product_id   uuid references products(id),
  par_qty      int,                   -- capacity / target level
  primary key (machine_id, slot_number)
);

create table picklists (              -- one on-demand generation
  id           uuid primary key default gen_random_uuid(),
  machine_id   uuid references machines(id),
  generated_by uuid references users(id),
  generated_at timestamptz default now(),
  source       text default 'last_7d_sales'
);

create table picklist_rows (          -- editable working draft (product + qty only)
  id                     uuid primary key default gen_random_uuid(),
  picklist_id            uuid references picklists(id) on delete cascade,
  slot_number            int,                       -- order asc for both view + print
  product_id             uuid references products(id),
  current_qty            int,                        -- in machine now
  par_qty                int,                        -- PAR / capacity
  qty_to_add             int,                        -- default par−current, editable stepper
  unit_price             numeric,                    -- exact single price (mirrored from Nayax)
  sales_per_week         numeric,                    -- pace: screen-only, not printed
  days_of_cover          numeric,                    -- pace: screen-only, not printed
  row_type               text default 'generated',   -- generated | swapped | added
  swapped_from_product_id uuid references products(id)
);
```

---

## 5. Build phases

1. **Navigation reshape** — 5 tabs + sub-tabs; role-based default landing + visibility. Low risk.
2. **On-demand pick list** — Regenerate button (last-7-day sales); slot-ordered rows; group/PAR/price/pace
   columns; swap-on-out-of-stock (auto price+qty); add-row (product+qty only); stripped 4-column printout
   (slot·item·price·qty). Needs `machine_slots` par/planogram + `picklists`/`picklist_rows`.
   Reuse existing final-upload/deduct path — do NOT add a second deduct.
3. **Machine Value** — join qty × (cost, selling price); recompute on sale-pull + restock; Ownership sub-tab.
4. **Inventory polish** — surface incoming + AI PDF reader on PO form; scope AI camera (identity/barcode).
5. **CRM/Calendar** — relocate existing supplier + task + release-calendar features under new tabs.

---

## 6. Non-negotiables / gotchas

- Fillers must never see machines they aren't assigned to.
- Stock deducts exactly once (at fill finalisation) — reconciled against Nayax, never double-count.
- Nayax pricing is authoritative; the app displays/pulls, it does not push prices as truth.
- No supplier credentials stored — contact details only.
- Keep owner financials curated (surface Xero essentials, not a full accounting rebuild).
- Pick list is **slot-ordered**, **generated on demand**, and **edit-locked to product + quantity**.
- Printout is **slot · item · exact price · amount only** — one price per item, no on-screen-only fields.
