# Backend fix — stop concurrent saves from reverting each other

**For:** ISG Job System (Google Apps Script behind the ISG Operations App)
**Date:** 2026-07-23
**Symptom fixed:** a job marked Collected (or any status change) silently reverting
minutes later — e.g. Faith's job flipping back to "Ready for Collection".

## Why this happens

Every save (`updateJob`) currently works like this in `apiApplyUpdatesToRow_`:

1. read the **entire spreadsheet row** into memory,
2. change the few cells being updated,
3. write the **entire row** back.

There is **no locking** anywhere, and Apps Script serves simultaneous requests
concurrently. So when two saves for the same job overlap (which the app used to
do on every status change — one save for the status, one for the activity log),
whichever request writes last wins the *whole row*, including the stale cells it
read before the other request's change. That's how "Collected" gets overwritten
back to "Ready for Collection".

There's also a rarer, nastier variant: `createJob` **inserts a row at the top**
of the sheet. If an update is mid-flight when that happens, its row number is
now off by one and the whole-row write lands **on the wrong job's row**.

The app (frontend) has already been fixed to send one merged request per action,
which removes the most common trigger. The two backend changes below remove the
root cause. Apply both.

## Change 1 — write only the changed cells

In the Apps Script editor, find `apiApplyUpdatesToRow_` and replace the whole
function with this version. The logic is identical; the only difference is that
it writes individual cells instead of reading-and-rewriting the entire row, so a
save can never clobber cells it wasn't asked to touch:

```javascript
function apiApplyUpdatesToRow_(jobs, hm, row, updatesRaw) {
  const updates = normalizeApiUpdates_(updatesRaw);
  const headers = Object.keys(updates);
  if (!headers.length) return { ok: false, error: "No updates provided" };

  const changedHeaders = [];

  headers.forEach(header => {
    if (!API_ALLOWED_UPDATE_HEADERS.includes(header)) return;
    const col = findApiHeaderColumn_(hm, header);
    if (!col) return;
    let value = updates[header];
    if (header === COL.CUSTOMER_APPROVED) {
      value = value === true || String(value).toUpperCase() === "TRUE";
    }
    jobs.getRange(row, col).setValue(value); // targeted cell write — no whole-row rewrite
    changedHeaders.push(header);
  });

  if (!changedHeaders.length) return { ok: false, error: "No valid update fields provided" };

  // If artwork link is present, auto-promote artwork source so workflow can move forward.
  const artworkLinkCol = findApiHeaderColumn_(hm, COL.ARTWORK_LINK);
  const artworkSourceCol = findApiHeaderColumn_(hm, COL.ARTWORK_SOURCE);
  if (changedHeaders.includes(COL.ARTWORK_LINK) && artworkSourceCol) {
    const linkVal = String(artworkLinkCol ? jobs.getRange(row, artworkLinkCol).getValue() : "").trim();
    const sourceVal = String(jobs.getRange(row, artworkSourceCol).getValue() || "").trim();
    if (linkVal && (!sourceVal || sourceVal === "Customer will send later")) {
      jobs.getRange(row, artworkSourceCol).setValue("Customer supplied now");
      if (!changedHeaders.includes(COL.ARTWORK_SOURCE)) changedHeaders.push(COL.ARTWORK_SOURCE);
    }
  }

  if (changedHeaders.includes(COL.CUSTOMER_APPROVED) && hm[COL.APPROVAL_DATE]) {
    const approved = jobs.getRange(row, hm[COL.CUSTOMER_APPROVED]).getValue() === true;
    jobs.getRange(row, hm[COL.APPROVAL_DATE]).setValue(approved ? new Date() : "");
  }

  if (apiUpdateNeedsWorkflowRecalc_(changedHeaders)) {
    recalcRowWorkflow_(jobs, hm, row);
  } else if (changedHeaders.includes(COL.PROMISED_DUE)) {
    syncPromiseRiskNoteForRow_(jobs, hm, row);
  }

  return { ok: true };
}
```

## Change 2 — serialise writes with a script lock

This makes each write finish completely before the next one starts, which also
fixes the wrong-row hazard when a new job is being created at the same moment.
In `handleApiPost_`, add the lock at the top and release it at the end. The
simplest safe way is to wrap the existing body:

```javascript
function handleApiPost_(e) {
  const params = (e && e.parameter) ? e.parameter : {};
  const payload = parseJsonBody_(e);
  const key = payload.key || params.key || "";
  if (!isValidApiKey_(key)) return { ok: false, error: "Unauthorized. Invalid API key." };

  const action = String(payload.action || params.action || "");

  // Serialise all sheet-mutating actions: prevents concurrent saves from
  // interleaving reads/writes on the same sheet (lost updates, wrong-row writes).
  const MUTATING_ACTIONS = [
    "updateJob", "createJob", "bulkUpdateJobs", "uploadArtwork",
    "deleteJob", "permanentDeleteJob",
    "createAction", "updateAction", "deleteAction",
  ];
  let lock = null;
  if (MUTATING_ACTIONS.includes(action)) {
    lock = LockService.getScriptLock();
    try {
      lock.waitLock(20000); // wait up to 20s for other writes to finish
    } catch (err) {
      return { ok: false, error: "Server busy — please try again in a moment." };
    }
  }
  try {
    // ─── existing body of handleApiPost_ from here down, unchanged ───
    //   if (action === "updateJob") { ... }
    //   if (action === "createJob") { ... }
    //   ... etc ...
  } finally {
    if (lock) lock.releaseLock();
  }
}
```

Keep every existing `if (action === ...)` line exactly as it is — just move them
inside the `try { }` block so the `finally` always releases the lock.

## How to apply safely

1. Open the spreadsheet → Extensions → Apps Script.
2. **File → Make a copy** first (your rollback).
3. Apply Change 1 and Change 2.
4. Save, then **Deploy → Manage deployments → edit (pencil) → Version: New
   version → Deploy** on the *existing* deployment. This keeps the same
   `/exec` URL so the app doesn't need any change. (Do NOT create a new
   deployment — that would change the URL.)
5. Test: open a job in the app, mark it Ready for Collection, then Collected,
   then check the Google Sheet row shows "Collected" and the comm log column
   updated. Refresh the app after 60s and confirm the status stays.

## Rollback

Deploy → Manage deployments → edit → pick the previous version → Deploy.
Same URL, instant rollback.
