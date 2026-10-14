# Security Remediation Checklist — Single-File HTML Tools
**Version 1.0 | Prepared for UU Simpler Smarter Better Programme**
**Based on: Single-File-HTML-Tool-Blueprint.md**

This checklist expands and operationalises the blueprint's security requirements into concrete, verifiable audit items. Every item lists: the concern, how to detect it statically, the remediation action, and how to verify it is fixed.

---

## Current File Assessment (Pre-Remediation)

| File | External Dependencies | Has CSP | innerHTML risk | No eval/dynamic | Priority |
|---|---|---|---|---|---|
| FTE_Productivity_Dashboard_v8.html | **CRITICAL** (2× CDN scripts, Google Fonts) | No | High | Unknown | **CRITICAL** |
| Corrective Maintenance Forecast Model_vF.html | None detected | **No** | Very high (136 hits) | Unknown | **HIGH** |
| SSB Value Tool - NoDeps v3.34.html | None detected | **No** | High (107 hits) | Unknown | **HIGH** |
| leakage-status-cockpit-v2 2.html | None detected | Yes | Moderate (30 hits) | Unknown | MEDIUM |
| bji-poc-dashboard-powerbi-mvp-v0.13 (1).html | None detected | Yes | Moderate (28 hits, some in comments) | Unknown | MEDIUM |
| SSB_RAID_Dashboard_v2_3.html | None detected | Yes | Low (3 hits, in comments only per code audit notes) | Confirmed clean | LOW |
| SSB_Delivery_Dashboard_v2_5.html | None detected | Yes | **Zero** (confirmed in code: uses DOM methods) | Confirmed clean | DONE |

> **SSB_Delivery_Dashboard_v2_5** already satisfies every item in this checklist. Use it as the reference implementation.

---

## Checklist: Grouped by Severity

---

### CATEGORY 1 — External Dependencies & Network Calls _(Severity: CRITICAL)_

These represent the highest risk: code loaded from third-party servers can change without notice and can exfiltrate data.

| ID | Check | Static Detection | Remediation | Verification |
|---|---|---|---|---|
| C1.1 | No `<script src="...">` pointing to external host | `grep -n 'script.*src.*http'` | Remove CDN scripts. Either (a) write a first-party replacement or (b) inline the library bundle verbatim inside a `<script>` tag — document the choice and the library version | No hits on grep after fix |
| C1.2 | No `<link rel="stylesheet" href="https://...">` | `grep -n 'link.*stylesheet.*http'` | Remove. Use OS system fonts (e.g. `font-family: -apple-system, 'Segoe UI', system-ui, sans-serif`) or inline any required font as a `@font-face` base64 data URI | No hits |
| C1.3 | No `<link rel="preconnect">` to external host | `grep -n 'preconnect'` | Remove all preconnect hints | No hits |
| C1.4 | No `fetch()`, `XMLHttpRequest`, `WebSocket`, `EventSource`, `navigator.sendBeacon`, `new Image()` in executable code | `grep -n 'fetch\|XMLHttpRequest\|WebSocket\|sendBeacon\|EventSource'` (check hits are in comments only) | Remove or convert to local-only operations | No hits outside comments |
| C1.5 | No dynamic `import()` or `importScripts()` | `grep -n 'import(' ` | Remove | No hits |
| C1.6 | No remote image sources (`src="https://..."`, `url(https://...)`) | `grep -n 'src=.http\|url(http'` | Replace with `data:` URIs or SVG inline | No hits |

**FTE Dashboard specific action:** Lines 9–14 must be removed. The `xlsx-js-style` and `pptxgenjs` bundles must either be inlined (copy the minified bundle text verbatim into a `<script>` block) or replaced with first-party equivalents. Inlining is acceptable as a pragmatic approach; document the exact version and commit hash of the inlined code for future audit.

---

### CATEGORY 2 — Content Security Policy _(Severity: HIGH)_

| ID | Check | Static Detection | Remediation | Verification |
|---|---|---|---|---|
| C2.1 | CSP `<meta>` tag present in `<head>` | `grep -n 'Content-Security-Policy'` | Add the standard CSP meta tag (see blueprint §9) | Tag present |
| C2.2 | `default-src 'none'` or `default-src 'self'` is the baseline | Read CSP value | Set `default-src 'none'` — this ensures anything not explicitly allowed is blocked | Confirmed in CSP string |
| C2.3 | `connect-src 'none'` blocks all network | Read CSP value | Set `connect-src 'none'` (stricter than blueprint's `'self'` — use `'none'` for local file tools) | Confirmed |
| C2.4 | `object-src 'none'` blocks plugins | Read CSP value | Add `object-src 'none'` | Confirmed |
| C2.5 | `base-uri 'none'` prevents base-tag hijack | Read CSP value | Add `base-uri 'none'` | Confirmed |
| C2.6 | `form-action 'none'` blocks form submission | Read CSP value | Add `form-action 'none'` | Confirmed |
| C2.7 | `frame-src 'none'` blocks iframe loading | Read CSP value | Add `frame-src 'none'` | Confirmed |
| C2.8 | Document `frame-ancestors` caveat | Presence of comment | Add inline comment noting `frame-ancestors` only works as HTTP header, not in `<meta>` CSP | Comment present |
| C2.9 | `<meta name="referrer" content="no-referrer">` present | `grep -n 'referrer'` | Add referrer meta tag immediately after CSP | Tag present |

**Target CSP string:**
```
default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'; form-action 'none'; base-uri 'none'; object-src 'none'; frame-src 'none'
```

---

### CATEGORY 3 — DOM Injection / XSS _(Severity: HIGH)_

| ID | Check | Static Detection | Remediation | Verification |
|---|---|---|---|---|
| C3.1 | `innerHTML` never set to untrusted data | `grep -n 'innerHTML'` then review each hit | (a) Replace with `document.createElement` + `textContent` (preferred), OR (b) wrap in `esc()` escape function before assignment. Never do both — pick one pattern per codebase | All innerHTML hits either use `esc()` or build static HTML only |
| C3.2 | `esc()` helper present if innerHTML is used at all | `grep -n 'function esc'` | Add the standard `esc()` helper from blueprint §9 | Function present |
| C3.3 | No inline event handler attributes carrying data (`onclick="fn('${data}')"`) | `grep -n 'onclick=.\${\\|onmouseenter=.\${\\|on.*=.*\+'` | Replace with `addEventListener` over a closure | No template-literal-in-handler patterns |
| C3.4 | No `document.write()` | `grep -n 'document\.write'` | Remove; use DOM methods | No hits |
| C3.5 | No `javascript:` URIs | `grep -in 'javascript:'` | Remove | No hits in executable code |
| C3.6 | SVG `<use href>` only references `#symbol-id` (same-document symbols), not external URLs | `grep -n '<use'` | Verify href values are `#...` only | Confirmed |

---

### CATEGORY 4 — Dynamic Code Execution _(Severity: HIGH)_

| ID | Check | Static Detection | Remediation | Verification |
|---|---|---|---|---|
| C4.1 | No `eval()` in executable code | `grep -n '\beval('` | Remove; express logic as data transforms | No hits outside comments |
| C4.2 | No `new Function(...)` | `grep -n 'new Function'` | Remove | No hits |
| C4.3 | No `setTimeout` or `setInterval` with a string first argument | `grep -n 'setTimeout.*"\\|setInterval.*"'` | Replace string with a function reference | No hits |
| C4.4 | No `Function.prototype.constructor` call | `grep -n '\.constructor('` | Remove | No hits |

---

### CATEGORY 5 — Input Validation & File Parsing _(Severity: MEDIUM-HIGH)_

These defend against a user loading a maliciously crafted input file.

| ID | Check | Static Detection | Remediation | Verification |
|---|---|---|---|---|
| C5.1 | Expected columns/sheets validated before data is read | Read import/parse code path | Add column-presence check; block with user-visible error list if required columns missing | Test with truncated input file |
| C5.2 | Field type checks (date, number, text) on imported data | Review parse code | Add per-field type validation; reject rows that fail with clear error | Test with invalid cell types |
| C5.3 | Zip bomb protection: max uncompressed size per entry and total | `grep -n 'limits\|maxSize\|maxUncompressed'` | Add `SSB.limits` style object with caps; refuse entries exceeding thresholds | Test with crafted oversized zip |
| C5.4 | Zip bomb protection: max entry count | Same as C5.3 | Cap number of entries processed | Verified in limits object |
| C5.5 | XML/cell value length capping | Review parse code | Cap string length after reading each cell value | Confirmed in code |
| C5.6 | Zip entry names not used as filesystem paths | Review zip reader | Ensure entry names are only used as lookup keys, never passed to any file API | Code review |
| C5.7 | Parser errors produce user message, not silent failure or unhandled throw | Review try/catch structure | Wrap all parse operations; catch and display errors | Manual test with bad file |

---

### CATEGORY 6 — Formula Injection _(Severity: MEDIUM)_

Affects tools that export CSV data subsequently opened in Excel.

| ID | Check | Static Detection | Remediation | Verification |
|---|---|---|---|---|
| C6.1 | CSV cell values with leading `=`, `+`, `-`, `@` are neutralised before export | `grep -n 'csv\|CSV\|export'` then review export function | Prefix affected values with a single quote `'` or tab character, or strip the leading character | Test: export CSV with a cell value `=HYPERLINK("http://evil.com","click")`, open in Excel, verify it does not execute |
| C6.2 | On import, strip leading formula-injection markers from cell values | Review import/normalise function | Strip or quote-prefix `=`, `+`, `-`, `@` when reading cell values | Test with crafted XLSX containing formula cell |

---

### CATEGORY 7 — Data Privacy & Local Storage _(Severity: MEDIUM)_

| ID | Check | Static Detection | Remediation | Verification |
|---|---|---|---|---|
| C7.1 | No sensitive data written to `localStorage` | `grep -n 'localStorage'` | If used, ensure only non-sensitive preferences (e.g. UI state) are stored, never programme data | Confirm in code |
| C7.2 | No sensitive data written to `sessionStorage` | `grep -n 'sessionStorage'` | Same as C7.1 | Confirmed |
| C7.3 | No cookies set | `grep -n 'document\.cookie'` | Remove; cookies are unnecessary for local-file tools | No hits |
| C7.4 | No IndexedDB writes of sensitive content | `grep -n 'indexedDB\|IDBDatabase'` | If used for folder-handle persistence only (blueprint pattern), confirm only the handle is stored, not data | Confirmed scope |
| C7.5 | On-screen statement that data is memory-only (if applicable) | Read app's data-handling description | Add audit note / help text stating data is not persisted beyond session | Note present in code or UI |

---

### CATEGORY 8 — Governance & Auditability _(Severity: MEDIUM)_

| ID | Check | Static Detection | Remediation | Verification |
|---|---|---|---|---|
| C8.1 | Version string visible in the built app UI | Run app, inspect | Add a version/date marker in the UI footer or nav | Visible in browser |
| C8.2 | Security audit comment block present in source | `grep -n 'AUDIT NOTES\|pen test\|security review'` | Add an `── AUDIT NOTES ──` block (like SSB RAID/Delivery v2) explaining: no external code, no network calls, no eval, no innerHTML (or esc() approach taken), input validation approach | Comment block present |
| C8.3 | SHA-256 checksum of the remediated file recorded | Post-build step | Generate checksum with `certutil -hashfile <file> SHA256` (Windows) and record in remediation report | Checksum in report |
| C8.4 | Known benign URL-like strings documented | Search for `http` in non-comment code | Any `www.w3.org` or similar XML namespace strings should be noted in audit comment as "never fetched" | Documented |
| C8.5 | In-app requirements/methodology view (for complex calculation tools) | Run app | For tools that calculate outputs: add a collapsible "How it works" or "Methodology" view | Present where applicable |

---

## Remediation Priority Order

| Priority | File | Rationale |
|---|---|---|
| 1 | FTE_Productivity_Dashboard_v8.html | Live CDN network calls are an immediate InfoSec concern — this is the only file that currently phones home |
| 2 | Corrective Maintenance Forecast Model_vF.html | No CSP + highest innerHTML hit count |
| 3 | SSB Value Tool - NoDeps v3.34.html | No CSP + high innerHTML count |
| 4 | leakage-status-cockpit-v2 2.html | Has CSP but moderate innerHTML risk |
| 5 | bji-poc-dashboard-powerbi-mvp-v0.13 (1).html | Has CSP; innerHTML hits likely include comments |
| 6 | SSB_RAID_Dashboard_v2_3.html | Low risk; minor gaps only |
| 7 | SSB_Delivery_Dashboard_v2_5.html | Reference implementation — no action required |

---

## Grep Commands for Quick Pre-Audit Scan

Run these from the `1 - Unremediated HTMLs` directory to produce a fast baseline on any file:

```powershell
# Run against a single file — replace $f with the filename
$f = "FTE_Productivity_Dashboard_v8.html"

Write-Host "=== EXTERNAL DEPENDENCIES ===" -ForegroundColor Yellow
Select-String -Path $f -Pattern 'script.*src.*http|link.*href.*http|preconnect|fonts\.google|cdn\.|jsdelivr'

Write-Host "=== CSP ===" -ForegroundColor Yellow
Select-String -Path $f -Pattern 'Content-Security-Policy'

Write-Host "=== DANGEROUS PATTERNS ===" -ForegroundColor Yellow
Select-String -Path $f -Pattern 'innerHTML\s*=|eval\(|new Function|document\.write|setTimeout.*"'

Write-Host "=== NETWORK APIs ===" -ForegroundColor Yellow
Select-String -Path $f -Pattern '\bfetch\(|XMLHttpRequest|WebSocket|sendBeacon|EventSource'

Write-Host "=== STORAGE ===" -ForegroundColor Yellow
Select-String -Path $f -Pattern 'localStorage|sessionStorage|document\.cookie|indexedDB'
```
