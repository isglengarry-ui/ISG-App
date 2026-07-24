# ISG Operations App — full review (24 Jul 2026)

Three-angle audit: robustness/data integrity, day-to-day workflow/UX, backend/security.
Already fixed on the branch (not re-listed): status-save race, pending-save verification,
WhatsApp desktop launch, unified card design, overdue/due-today flags, pipeline view.

## Tier 1 — important, fix soon

### 1. The API is effectively open to the internet (HIGH)
- The only credential is the static key `ISG2026`, shipped inside the public
  GitHub Pages JavaScript. Anyone who views source can call the API.
- `action=jobs` returns EVERY column for every job — customer names, phone
  numbers, emails, job values. One request exfiltrates the whole customer base.
- Destructive actions (`deleteJob`, `permanentDeleteJob`, `bulkUpdateJobs`) are
  gated only by the same key; the "owner passcode" is checked in the browser,
  never on the server. A key-holder could wipe or rewrite the job sheet, mark
  unpaid jobs as Paid, or alter values.
- Raw backend error messages are returned to callers (leaks sheet names).
- Realistic exposure: requires someone to look at the site's source — not mass
  scanning, but trivially findable. For a business holding customer PII this
  deserves attention.
- Pragmatic fix path (no full login system needed):
  a) server-side owner passcode check for destructive actions;
  b) trim `API_ALLOWED_UPDATE_HEADERS` to fields the UI actually writes;
  c) generic error messages to clients;
  d) rotate the API key (it's also in old git history);
  e) longer term: Google sign-in for the app.

### 2. Pricing lives per-PC — different computers quote different prices
- Vinyl pricing settings have a half-built sync: the frontend already calls
  `action=pricingSettings` / `savePricingSettings`, but the backend never
  implemented those actions, so it silently falls back to "Saved locally".
- Price list adjustments, cost settings, canvas and poster prices are
  localStorage-only (`ISG_PRICE_LIST_V1`, `ISG_PRICE_ADJUSTMENTS_V1`,
  `ISG_PRICE_COST_SETTINGS_V1`, `ISG_POSTER_PRICES_V1`, canvas key).
- Consequence: a price change on one PC is invisible on the others; a cleared
  browser silently reverts to hard-coded defaults.
- Fix: add the two settings actions to the Apps Script (a Settings sheet tab),
  extend to the other pricing stores; keep localStorage as cache only.

### 3. Comm logs & payment methods are also per-browser
- `ISG_COMM_LOG` and `ISG_PAYMENT_METHODS_V1` live in localStorage. The comm
  log does write to the sheet's Comm Log column, but restore-on-load prefers
  local; payment methods only reach the sheet when a save echoes them.
- Consequence: history recorded on Faith's PC may not appear on yours.
- Fix: treat the sheet as source of truth; merge by appending unseen entries
  instead of preferring either side wholesale.

## Tier 2 — quick wins (small code changes, real daily value)

4. **Alerts rows aren't clickable** — staff see "PROMISE RISK ISG-000182" but
   can't open the job. Add `openJobPanel_` per row. (Alerts also mostly
   duplicates board badges — consider adding what boards DON'T show: stale
   jobs, unpaid-over-N-days.)
5. **Search is hidden on phones** — at ≤720px the search box is `display:none`
   with no replacement; counter staff on a phone can't look up a job. Add a
   mobile search affordance.
6. **Search silently ignores half the tabs** — Completed Jobs, Alerts, Mimaki
   Queue, Supplier Orders never apply `applySearchFilter_`. Apply it
   consistently.
7. **Background save failures freeze the screen** — quiet/bulk save errors use
   `window.alert`, blocking the whole board. Use the toast instead.
8. **Load failure shows fake demo jobs** — if the first load fails, the board
   fills with sample data (banner is easy to miss); staff could act on fake
   jobs. Show an explicit error/empty state instead.
9. **Due date optional & accepts past dates at intake** — jobs created without
   a promised date never appear in overdue/due-today counts. Require it (or
   auto-fill the suggested date) and set `min=today`.
10. **Failed saves leave phantom log entries** — the auto "Status → X" /
    "customer notified" comm-log entry isn't rolled back when the save fails.
    Roll it back on the failure branch.
11. **Bulk saves claim success on partial failure** — failed jobNos stay
    optimistically updated and staff aren't told which failed. Revert and list
    them.
12. **No undo for quick-pill taps** — status changes fire instantly (easy
    mis-tap on a phone); deletes get confirms but pills don't. Add a brief
    undo toast.

## Tier 3 — worthwhile, not urgent

13. **Cards could show more** — job value and "in this status for N days"
    (stalled-job detection) are the two highest-value additions; data already
    exists.
14. **Backend save is heavy** — `recalcRowWorkflow_` does ~25 single-cell
    reads/writes per save and `refreshAlerts_` rebuilds a whole sheet; with
    the new lock this compounds. Batch to one read + one write per row.
15. **Full-sheet reads per request** — every API call re-reads the whole Jobs
    sheet; gets slower as history grows. Consider archiving Collected jobs
    older than N months to an Archive tab.
16. **Job number counter can drift** — `nextJobNumber_` uses a stored counter
    never reconciled with the sheet; a restore/import could re-issue an
    existing number, and `findJobRowByNo_` silently picks the first duplicate.
    Derive from the sheet max / fail loudly on duplicates.
17. **localStorage stores grow forever** — comm-log/payment stores never prune
    old jobs; at the ~5MB quota, writes start failing silently. Prune on save.
18. **Completed Jobs table** — no completion date, no value, not sortable;
    hard to see "what we finished today" or reconcile revenue.
19. **Email alert quota** — Ink/Stock alert emails are sent inside a silent
    catch with no dedup; if the ~100/day MailApp quota is hit, alerts stop
    with no signal.
20. **Duplicated "is finished" rules** — at least 5 slightly-different
    hardcoded status arrays decide if a job is terminal; route through
    `isJobCompleted_` so views can't disagree.
21. **Silent-refresh overlap** — two refresh timers can race; an older
    response can briefly overwrite newer state. Add an in-flight guard.
22. **Duplicate-job guard at intake** — matches exact customer+product string
    only; near-duplicates slip through. Loosen matching.

## Noted, deliberately not action items
- Pipeline vs Staff Board in-house lane duplication: intentional transition
  state; revisit after staff adopt the pipeline.
- Gmail add-on code lives in separate project folders (isg-gmail-addon /
  isg-owner-addon), not missing.
- Design-category jobs at "Completed" don't sit in any lane bucket — but they
  do appear in Completed Jobs, and the board's Design lane is normally empty;
  cosmetic at most.
