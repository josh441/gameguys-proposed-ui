# Franchise Workspaces Implementation Plan

> Execute in this session using the existing static HTML architecture.

**Goal:** Make all five approved feedback areas reviewable and interactive.
**Architecture:** Preserve franchise.html chrome; add scoped franchise-workspaces.css and franchise-workspaces.js for the richer workspaces and local sample state.
**Tech Stack:** HTML, CSS, browser JavaScript, existing device preview.
**Spec:** ../specs/2026-11-06-franchise-workspaces-design.md

## Global Constraints
Static prototype; no dependencies; no live stock or Shopify changes; retain brand and unrelated files.

## Review Focus
Empty searches; unknown scans; invalid or negative stock balances; picklists exceeding available stock; mobile navigation and table density.

### Task 1: Home and stock
- [x] Move training from dialog into Home subtabs and add readable module content.
- [x] Render a compact catalogue with 100+ sample entries, filters, 10/25 pagination, expansion and density.
- [x] Add scan workspace and adjustment dialog with balance preview and validation.
- [x] Browser-check search, pagination, scan match/unknown and adjustment validation.

### Task 2: Picklists and purchases
- [x] Add manual/recommended builder with machine, quantities, review, draft and print.
- [x] Open each purchase in a read-only Shopify reference details workspace with reconciled item totals and proposed retail.
- [x] Check invalid/empty picklists, draft creation and each order's totals.

### Task 3: Verify and publish
- [x] Check JavaScript syntax and Git whitespace; inspect desktop/mobile screens and key flows.
- [ ] Commit only the portal and its design/plan, push main, verify GitHub Pages response.
