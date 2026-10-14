# HTML Tool Security Remediation — Process & Standards
**Version 1.0 | UU Simpler Smarter Better Programme**

This document defines the end-to-end process for remediating each HTML tool. Follow it in full for every file. The output of each run is a remediated HTML in `2 - Remediated HTMLs/` and a report in `3 - Remediation reports/`.

---

## Overview

```
┌──────────────────────────────────────────────────────────────────┐
│  For each HTML file (in priority order from checklist):          │
│                                                                  │
│  PHASE 1: Pre-audit    → understand what's broken                │
│  PHASE 2: Rebuild      → apply all fixes                         │
│  PHASE 3: Regression   → verify nothing is functionally broken   │
│  PHASE 4: Verify       → confirm all security items are fixed    │
│  PHASE 5: Report       → write and save the report               │
└──────────────────────────────────────────────────────────────────┘
```

---

## PHASE 1 — Pre-Audit

### 1.1 Static Scan

Run the PowerShell scan from `Security-Remediation-Checklist.md` against the source file and note every finding. Paste the raw output into the report template (Section A).

### 1.2 Functional Inventory

Before touching the code, document what the tool does — specifically the data flows you must preserve:

| Question | Answer (fill in per tool) |
|---|---|
| What input does the tool accept? | (file types, formats) |
| What does the user do in the UI? (key user journeys) | (list 3–5 journeys) |
| What does the tool output? | (display, CSV export, pptx, etc.) |
| Are there calculation/model views that must reconcile? | (yes/no) |
| What data does it persist between sessions? | (none / folder handle / UI prefs) |

This inventory becomes the regression test plan.

### 1.3 Record the Pre-Remediation Checksum

```powershell
certutil -hashfile ".\1 - Unremediated HTMLs\<filename>" SHA256
```

Record the hash in the report. This anchors the audit chain.

---

## PHASE 2 — Rebuild

Apply every finding from the pre-audit. Work through the checklist categories in order (C1 → C8) — Category 1 (external dependencies) first because removing CDN scripts changes what JavaScript is available.

### 2.1 External Dependencies (C1)

**FTE Dashboard only — CDN script replacement:**

Option A — Inline the bundle (recommended for speed):
1. Download the exact pinned version of each library locally.
2. Open the minified `.js` file, copy all content.
3. Replace the `<script src="...">` tag with `<script>` + pasted content + `</script>`.
4. Record the library name, version, and download URL in the report (this is the one place a URL is documented — as an audit record, not a live call).
5. Remove all `<link rel="preconnect">` and `<link rel="stylesheet" href="https://...">` tags.
6. Replace Google Fonts reference with system font stack.

Option B — Remove and rewrite (preferred if the tool can be simplified):
- Only viable if xlsx/pptx generation can be replaced with simpler CSV export.
- Discuss with the team before choosing this path.

**Step 1a (mandatory for Option A) — CVE check before inlining:**

Run `npm audit` against every library being inlined. This checks npm's advisory database for known vulnerabilities in the pinned version.

```powershell
# In a temp directory:
npm init -y
npm install <library>@<pinned-version>
npm audit
```

For each finding, assess whether the vulnerable code is actually present in the **browser bundle** (not just the Node.js build):

```powershell
# Check if the vulnerable package is present in the browser bundle file:
Select-String -Path ".\node_modules\<library>\dist\<bundle>.js" -Pattern "<vulnerable-package-name>" -SimpleMatch
```

**Decision criteria:**

| Finding | Action |
|---|---|
| Zero findings | Proceed — record "npm audit: clean" in report §B2 |
| Finding but vulnerable code not in browser bundle | Proceed — document the finding, the bundle check result, and the rationale in §B2 |
| Finding AND vulnerable code IS in the browser bundle | Evaluate: (a) upgrade to a patched version of the library; (b) if no patched version exists, document as residual risk with InfoSec sign-off required before deployment |
| Critical severity in browser bundle | Do not inline — escalate to team; consider Option B |

### 2.2 Content Security Policy (C2)

Add the following immediately after `<meta charset="utf-8">` if absent, or replace the existing CSP if it is weaker:

```html
<!-- ═══════════════════════════════════════════════════════════════════
     CONTENT SECURITY POLICY
     default-src 'none'    blocks everything not explicitly listed
     connect-src 'none'    no fetch / XHR / WebSocket / EventSource
     script-src 'unsafe-inline'  inline script only; no external scripts
     style-src 'unsafe-inline'   inline style only
     img-src data:         data: URIs only (favicon); no remote images
     form-action 'none'    forms cannot submit anywhere
     base-uri 'none'       <base> injection is blocked
     object-src 'none'     plugins blocked
     frame-src 'none'      iframe loading blocked
     NOTE: frame-ancestors only works as an HTTP response header, not
     in a <meta> tag. Add it there if this file is ever served.
     ═══════════════════════════════════════════════════════════════════ -->
<meta http-equiv="Content-Security-Policy"
      content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'; form-action 'none'; base-uri 'none'; object-src 'none'; frame-src 'none'">
<meta name="referrer" content="no-referrer">
```

### 2.3 DOM Injection / innerHTML (C3)

**For each `innerHTML` assignment carrying data from user input or an imported file:**

Approach A (preferred — structural fix):
```javascript
// BEFORE (vulnerable)
container.innerHTML = '<div class="row">' + esc(value) + '</div>';

// AFTER (structural — injection is architecturally impossible)
var div = document.createElement('div');
div.className = 'row';
div.textContent = value;
container.appendChild(div);
```

Approach B (acceptable where Approach A is too disruptive):
```javascript
// Add esc() helper near the top of the <script> block:
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Then wrap every user/file value before innerHTML:
container.innerHTML = '<div class="row">' + esc(value) + '</div>';
```

**For inline event handlers carrying data:**
```javascript
// BEFORE (vulnerable if name contains a quote)
el.setAttribute('onclick', "showDetail('" + name + "')");

// AFTER (safe)
el.addEventListener('click', function() { showDetail(name); });
```

### 2.4 Dynamic Code Execution (C4)

Replace any `eval()` or `new Function()` with explicit logic. If they exist in the file, the scope of change must be discussed before automated replacement — these cannot be fixed mechanically.

### 2.5 Input Validation (C5)

For tools that currently do no validation, add a validation layer in the parse/import function:

```javascript
// Minimum pattern — validate required columns are present
function validateColumns(actualHeaders, requiredHeaders) {
  var missing = requiredHeaders.filter(function(h) { return actualHeaders.indexOf(h) === -1; });
  if (missing.length > 0) {
    throw new Error('Missing required columns: ' + missing.join(', '));
  }
}
```

For zip-based imports (xlsx files): check that an `SSB.limits` style object (or equivalent) is defined and referenced in the ZIP parser.

### 2.6 Formula Injection (C6)

Add to the CSV export function:

```javascript
// Neutralise formula-injection in CSV cell values
function csvCell(value) {
  var s = String(value == null ? '' : value);
  if (/^[=+\-@]/.test(s)) { s = "'" + s; }  // prefix with single quote
  // Escape embedded quotes for CSV
  if (s.indexOf('"') !== -1) { s = s.replace(/"/g, '""'); }
  return '"' + s + '"';
}
```

### 2.7 Audit Comment Block (C8)

Add (or update) an `── AUDIT NOTES ──` block inside an HTML comment at the top of the file (after the CSP), modelled on the SSB RAID/Delivery v2 pattern. It must cover:

1. No third-party code (state it explicitly)
2. No network activity (no fetch/XHR/WebSocket — list them)
3. What data is embedded vs loaded at runtime
4. Data persistence model (memory-only, or what is stored and where)
5. No dynamic code execution (no eval, new Function)
6. innerHTML approach taken (DOM methods or esc() — state which and why)
7. Input validation approach
8. How to verify (grep commands for auditor)

---

## PHASE 3 — Regression Testing

Run these tests against the **remediated file** before writing the report. Use Chrome or Edge (Chromium only, per blueprint).

### 3.1 Smoke Test — Load & Render

| Test | Pass criteria |
|---|---|
| Open file in browser with no data loaded | App renders without JS console errors |
| No network requests | DevTools → Network panel shows zero requests |
| CSP is active | DevTools → Console shows no CSP violations on load |

### 3.2 Functional Tests (per tool — define before starting rebuild)

For each item in the functional inventory (Phase 1.2), document one test:

| Journey | Input | Expected output | Pass? |
|---|---|---|---|
| (fill in per tool) | | | |

**Suggested test data:** create a minimal valid input file (real programme data with one or two rows) and a minimal invalid file (wrong columns, malformed values). Both are needed.

### 3.3 Security Guard Tests

| Test | Method | Pass criteria |
|---|---|---|
| Malicious cell value does not reach DOM | Load an XLSX with a cell containing `<img src=x onerror=alert(1)>` | Value appears as literal text in the UI — no alert fires |
| Malicious cell value in CSV export | Export a row containing `=HYPERLINK("http://evil.com","x")` as a cell value | On opening the CSV in Notepad, the cell reads `'=HYPERLINK...` (prefixed quote) |
| No data after tab close | Load data, close tab, reopen file | App shows blank state — no previously loaded data |
| Oversized file refused | Load a file > the defined max size limit | App shows an error message; does not hang or crash |

### 3.4 Console Error Check

Open DevTools, load the tool, exercise all main views. The console must show **zero errors** (warnings may be acceptable; record them).

---

## PHASE 4 — Security Verification

Re-run the static scan from Phase 1.1 against the **remediated file**. For each finding in the pre-audit, confirm it is resolved. Record the result in the report (Section D).

Additional manual checks:
- [ ] Open file source, search `innerHTML` — review every hit
- [ ] Open file source, search `http` — confirm every hit is in a comment or is a W3C namespace identifier
- [ ] Open file source, search `eval` — confirm every hit is in a comment
- [ ] Confirm CSP meta tag is present and matches the target string

---

## PHASE 5 — Report

Save the completed report to `3 - Remediation reports/` using this naming convention:

```
YYYY-MM-DD_<ToolName>_remediation-report.md
```

Use the template below.

---

## Report Template

```markdown
# Security Remediation Report
**Tool:** <filename>
**Date:** YYYY-MM-DD
**Remediator:** <name>
**Reviewer:** <name>

---

## A. Pre-Remediation Findings

### A1. Static Scan Output
[Paste raw PowerShell scan output]

### A2. Summary of Findings

| ID | Category | Finding | Severity |
|---|---|---|---|
| | | | |

### A3. Pre-Remediation Checksum (SHA-256)
`<hash>`

---

## B. Changes Applied

| Finding ID | Change Made | Approach Chosen | Notes |
|---|---|---|---|
| | | | |

### B1. External Dependencies — Decision Record
[If libraries were inlined: state library name, version, original URL, and file size.
 If rewritten: state what was replaced with.]

---

## C. Regression Test Results

### C1. Smoke Test
| Test | Result |
|---|---|
| No JS console errors on load | PASS / FAIL |
| Zero network requests | PASS / FAIL |
| No CSP violations | PASS / FAIL |

### C2. Functional Tests
| Journey | Input Used | Result | Notes |
|---|---|---|---|
| | | PASS / FAIL | |

### C3. Security Guard Tests
| Test | Result | Notes |
|---|---|---|
| Malicious cell in DOM | PASS / FAIL | |
| Formula injection in CSV | PASS / FAIL | |
| No data persistence | PASS / FAIL | |
| Oversized file refused | PASS / FAIL | |

### C4. Console Error Check
Result: PASS / FAIL — [notes]

---

## D. Post-Remediation Verification

| Checklist ID | Check | Result |
|---|---|---|
| C1.1 | No external script tags | PASS / FAIL |
| C2.1 | CSP meta present | PASS / FAIL |
| C3.1 | innerHTML safe | PASS / FAIL |
| C4.1 | No eval | PASS / FAIL |
| ... | ... | ... |

### D1. Post-Remediation Checksum (SHA-256)
`<hash>`

---

## E. Outstanding Items / Deferred Risk

[Any items that could not be fully remediated, with justification and proposed follow-up]

---

## F. Sign-Off

| Role | Name | Date | Signature |
|---|---|---|---|
| Remediator | | | |
| Technical reviewer | | | |
| InfoSec / programme lead | | | |
```

---

## Naming & Storage Conventions

| Item | Location | Naming |
|---|---|---|
| Source (unchanged) | `1 - Unremediated HTMLs/` | Original filename |
| Remediated file | `2 - Remediated HTMLs/` | Original filename (unchanged — version is in the file's internal version string) |
| Remediation report | `3 - Remediation reports/` | `YYYY-MM-DD_<ShortName>_remediation-report.md` |

After all tools are remediated, add an index file `3 - Remediation reports/00-INDEX.md` listing all reports with their post-remediation checksums.
```
