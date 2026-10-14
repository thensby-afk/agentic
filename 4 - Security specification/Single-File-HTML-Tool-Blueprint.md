# Single-File HTML Tool - Architecture & Security Blueprint

**Purpose:** reusable design context for building a **new** browser-based business tool with the same
architecture and security posture as the Budget / Capacity Planning Tool. Give this file to your AI assistant or
developer at the start of the build, and hold to it throughout. It describes *how* to build the tool, not *what*
the tool does - fill in the domain features yourself.

---

## 1. What this describes
A self-contained internal tool that **runs entirely in the user's web browser** - no server, no database, no
installation. It reads and writes files in a folder the user chooses, and is safe to use with sensitive internal
data on a **managed corporate file share** (an NTFS-permissioned network share).

## 2. Non-negotiable principles
- **One file.** The whole application is a single `index.html` (HTML + CSS + JavaScript inline).
- **Client-side only.** No back end, no application server, no database. Nothing to host or attack server-side.
- **Zero third-party libraries.** No frameworks, no CDNs, no npm runtime dependencies. Write **first-party**
  helpers instead (e.g. CSV parsing, Excel/spreadsheet read-write). Result: no supply chain to trust or patch.
- **No runtime network calls.** The tool never fetches or sends anything. Verify by scanning the source for
  `fetch` / `XMLHttpRequest` / `WebSocket` / `sendBeacon` / `EventSource` / dynamic `import` / `new Image`.
- **No build step.** Everything is inline; you open the file and it runs. Never split it into multiple files or
  introduce a bundler/transpiler.
- **Runs in the signed-in user's context** - no service account, no elevated rights, no install, no admin.

## 3. Architecture pattern (keep it simple and predictable)
- **Single source of truth:** one `STATE` object holds all data.
- **Pure model functions** read `STATE` and return computed results, cached (e.g. on `STATE._cache`).
- **Render functions** return HTML strings built from `STATE`.
- Call **`invalidateCache()`** after any change to `STATE`, then **`render()`** repaints the active view.
- **Greppable, no magic:** find code by the visible on-screen text or the function name. Avoid clever
  indirection - a non-specialist (or an AI assistant) should be able to locate and change one thing safely.
- **The tool documents itself:** keep an in-app, versioned **requirements/spec** and a **methodology/how-it's-
  calculated** view, kept in step with every change, so behaviour is always described somewhere inside the tool.

## 4. Security model
**Access control**
- Access = the **file share's own permissions** (NTFS on a managed network share), **not an in-app login**. Do
  **not** build a password/PIN into the tool. Anyone who can open the file can use it; who can open or edit is
  decided entirely by the share's permissions.
- Recommend a **read-only** location for the tool file, separate from a **write-restricted** data/output folder.
- **Distribution model:** the people granted access to the tool's file share **run the tool there** and produce
  the outputs; those outputs are then **distributed to wider business users via a file share** too. Each file
  share's NTFS permissions decide who can reach the tool and who can reach the outputs - there is still **no
  in-app login at any point**.

**Content-Security-Policy (CSP)**
- Include a strict `<meta>` CSP that blocks external script/style hosts, plugins/objects, and outbound
  connections. (Inline script/style is allowed because a single-file app is inline by design - that trade-off
  is fine; the key protection is blocking *external* code and *any* network connection.) See the starter in §9.
- If the file is ever served from a host, **also** set the CSP plus `X-Content-Type-Options: nosniff` and
  `Referrer-Policy` as real **HTTP response headers** (some directives, e.g. `frame-ancestors`, only work as
  headers).

**Code safety**
- **Escape all user/imported text** before putting it in the page (an `esc()` helper). Never `innerHTML` an
  untrusted string. Do a full sweep and keep a test that a marker payload can't reach the DOM unescaped.
- **No `eval` / `new Function` / dynamic code execution.** Imported data is data, never run.
- **Validate every imported file before use:** expected columns present + per-field type checks
  (date/number/text). Block with a clear, itemised error rather than silently mis-loading.
- **Harden any first-party file parser:** cap declared/uncompressed sizes (per entry and per archive),
  bounds-check offsets (refuse zip-bombs), and guard decompression against hangs (throw, don't freeze).
- **Spreadsheet formula-injection guard:** when writing any shared CSV, neutralise a leading `= + - @` in cell
  values (and strip on read), so a crafted cell can't execute as a formula when reopened in Excel.

**Data privacy**
- Data stays **local**. The tool only reads/writes the folder the user explicitly grants via the browser's
  file-picker - it is sandboxed and cannot roam the machine's filesystem.
- **Classify the data.** If sensitive, apply a **Microsoft Purview sensitivity label** (and optional encryption)
  to the data folder. State the honest residual risk: an authorised reader can still copy the data - folder
  permissions gate the *original*, not copies; labelling/encryption mitigates a stray copy.
- **Local browser storage:** an autosave working copy and the chosen folder handle live in the browser
  (IndexedDB) on that machine - on shared/kiosk devices, clear browser data on exit. The folder files are the
  durable record.

## 4a. Security assurance & governance (for InfoSec sign-off)
These are what a security team asks about when approving the tool - build them in and document them from day one.
- **No external code of any kind.** State it explicitly (not just "no libraries"): no `<script src>`,
  `<link href>`, **web fonts, analytics or trackers** are loaded.
- **External-looking strings are inert.** The only URLs in the file are XML/SVG namespace identifiers (e.g.
  `www.w3.org/2000/svg`) used as labels inside generated Office/SVG files - they are **never fetched**. Note this
  so an independent source scan doesn't raise a false flag.
- **Independent security check.** Beyond your own automated test suite, plan an external **vulnerability scan /
  SAST** (e.g. Precursor, Semgrep, CodeQL) and/or a **pen-test / security review**, and record its scope.
- **Master-file integrity.** Keep the master `index.html` in a **write-restricted** folder and, ideally,
  **publish a checksum (hash)** so a tampered or swapped file is detectable.
- **Data classification & DLP.** Record the data's **sensitivity classification**; exports are ordinary files in
  a governed file share, so **existing file-share / endpoint DLP controls apply** unchanged; apply a Purview
  label where warranted
  (see §4).
- **Retention & clean-up.** Decide how long saved versions and the browser autosave copy are kept (the platform's
  file share's version history / backups are the record), and clear browser data on shared/kiosk machines.
- **Release governance.** Agree **who signs off a new build** before it replaces the master file, and keep the
  audit trail (who/when/what changed) plus archived versions (see §7).

## 5. Data & file handling
- Use the **File System Access API** (Chromium) to read/write a user-chosen folder; persist the folder handle in
  IndexedDB so reconnecting is one click on later visits.
- Prefer **plain, human-readable, diff-friendly files** (CSV, or JSONL for versioned records) over opaque blobs.
- **Versioning/audit:** keep an append-only version history plus a changelog capturing who/when/what changed;
  the file share's own version history / backups are the tamper-evident record.
- **Autosave** a working copy to IndexedDB; treat the folder files as the source of truth.
- Note that the tool works off a **point-in-time snapshot** (imported files), not a live database.

## 6. Deployment & environment constraints
- **Hosted on a managed network file share** (not a web server). The tool file and its data folders live on the
  share; users reach them via a mapped drive (see the mapped-drive rule below). Outputs are shared on to business
  users through a file share too (see §4).
- **Chromium only** (Chrome / Edge). The File System Access API is not in Firefox/Safari, so folder read/write
  won't work there.
- **Open from a mapped drive letter** (e.g. `Z:\...`), the **same letter for every user** - **not** a raw UNC
  path (`\\server\share\...`), which makes the folder-connect step **fail silently (AbortError)**. Push the
  drive mapping via login script / GPO.
- **No install, no admin rights** required.

## 7. Quality & maintainability
- **No build step** - edit the one file.
- **Version marker in-app** (a short build string/date shown in the UI) and keep **timestamped archived copies**
  of the file for easy rollback.
- **Automated headless test suite** (e.g. Node + Playwright): boot the app headlessly, smoke-render every view
  with **zero console errors**, check the models reconcile, and assert the **security guards** hold; exit
  non-zero on any failure. Optionally run it in CI on every change.
- **Living requirements:** keep the in-app spec current with every behaviour/UI change - treat "update the
  requirement" and "change the code" as one unit of work.

## 8. Hard-rules checklist (paste into the build brief)
**DO:** single file; client-side only; first-party code; strict CSP; escape all output; validate + harden every
import; access via folder permissions; plain CSV/JSONL; version + archive each build; automated smoke/guard
tests; keep an in-app spec; **no web fonts/analytics/trackers; publish a master-file checksum; plan an
independent security scan; record data classification, retention & release sign-off** (see §4a).

**DON'T:** add libraries / CDNs / npm runtime dependencies; add a build step; split the file; make any network
call; use `eval` / `new Function`; build an in-app login (rely on folder permissions); assume a UNC path works;
rely on non-Chromium browsers for the folder features.

## 9. Starter snippets

**Strict CSP `<meta>` tag** (in `<head>`):
```html
<meta http-equiv="Content-Security-Policy"
      content="default-src 'self';
               script-src 'self' 'unsafe-inline';
               style-src 'self' 'unsafe-inline';
               img-src 'self' data:;
               connect-src 'self';
               object-src 'none';
               base-uri 'none';
               form-action 'none';
               frame-ancestors 'none'">
```
(`'unsafe-inline'` is required because a single-file app keeps its script/style inline; the important part is
that `connect-src 'self'` blocks all outbound connections and no external hosts are allowed.)

**Minimal skeleton** (the pattern to grow from):
```html
<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta http-equiv="Content-Security-Policy" content="...as above...">
  <title>My Tool</title>
  <style> /* all CSS inline here */ </style>
</head>
<body>
  <div id="app"></div>
  <script>
    var STATE = { /* single source of truth */ _cache: {} };

    function esc(s) {            // escape ALL user/imported text before it hits the DOM
      return String(s == null ? '' : s)
        .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
        .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
    }
    function invalidateCache() { STATE._cache = {}; }

    function someModel(state) {  // pure: read STATE, return computed result (cache it)
      if (state._cache.someModel) return state._cache.someModel;
      var result = /* compute from state */ {};
      return (state._cache.someModel = result);
    }

    function renderMainView() {  // returns an HTML string built from STATE
      var m = someModel(STATE);
      return '<h1>' + esc('My Tool') + '</h1>';
    }

    function render() {          // repaint the active view
      document.getElementById('app').innerHTML = renderMainView();
    }

    render();
  </script>
</body>
</html>
```

---

*Use this as the standing context for the new tool. The domain (what it calculates, its screens and data) is
yours to define - but keep every rule above, because together they are what make the tool safe to run
unmanaged on the estate, easy to hand over, and simple to maintain without specialist tooling.*
