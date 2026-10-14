# Security Remediation Report
**Tool:** FTE_Productivity_Dashboard_v8.html
**Date:** 2026-10-12
**Remediator:** Claude Sonnet 4.6 (via Claude Code)
**Reviewer:** Thomas Hensby
**Priority:** CRITICAL (only file in the set that made live network calls)

---

## A. Pre-Remediation Findings

### A1. Static Scan — Summary

Run of `Security-Remediation-Checklist.md` PowerShell scan:

| Pattern | Hits |
|---|---|
| External script/font/CDN links | **5 lines** (3 script/link tags + 2 preconnects) |
| Content-Security-Policy meta tag | **ABSENT** |
| innerHTML / eval / network patterns | 37 |
| fetch / XHR / WebSocket | 0 (confirmed; 37 hits are `innerHTML` only) |
| localStorage / sessionStorage / cookie | 0 |

### A2. Findings Detail

| ID | Category | Finding | Severity |
|---|---|---|---|
| F1 | C1 — External deps | `<script src="https://cdn.jsdelivr.net/npm/xlsx-js-style@1.2.0/dist/xlsx.bundle.js">` — executes remote code on load; no SRI hash | **CRITICAL** |
| F2 | C1 — External deps | `<script src="https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/dist/pptxgen.bundle.js">` — same | **CRITICAL** |
| F3 | C1 — External deps | `<link rel="preconnect" href="https://fonts.googleapis.com">` and matching `<link rel="stylesheet">` — external font load, potential tracking | HIGH |
| F4 | C2 — CSP | No Content-Security-Policy meta tag | HIGH |
| F5 | C2 — CSP | No Referrer-Policy meta tag | MEDIUM |
| F6 | C3 — XSS | `aEsc()` helper at line 2322 escapes only `'`, not `"`, `<`, `>`. Used in an onclick attribute carrying an uploaded role name — a crafted targets file with `"` in a role name could break out of the attribute string | MEDIUM |
| F7 | C3 — innerHTML | 33 `innerHTML` assignments in executable code — each requires verification of `U.esc()` usage | LOW (all confirmed safe — see §B) |

### A3. Pre-Remediation Checksum (SHA-256)
`7CA74198CC544854E81AC3475987C9C1672F503AAB9D7A9B5B47FF02931A5ADF`

---

## B. Changes Applied

### B1. Change summary

| Finding | Change | Approach |
|---|---|---|
| F1, F2 | CDN script tags removed; libraries inlined verbatim | Inlined (see decision record below) |
| F3 | Google Fonts preconnect + stylesheet links removed; `'Hanken Grotesk'` removed from `--f` CSS variable | System font stack retained as primary |
| F4 | CSP `<meta>` tag added | Blueprint target string |
| F5 | `<meta name="referrer" content="no-referrer">` added | — |
| F6 | `aEsc()` declaration removed; call site replaced with `encodeURIComponent(r)`; `tgtRoleToggle()` handler updated to `decodeURIComponent()` | Matches existing pattern at impact-page buttons (lines 2705, 2709, 2714) |
| F7 | Manual review of all 33 `innerHTML` assignments by Explore agent | All confirmed safe — see note below |

### B2. CDN Library Inlining — Decision Record

**Decision:** inline library bundles verbatim rather than rewrite from scratch.

**Rationale:**
- The tool already ships a hand-rolled ZIP+XML parser (primary path). The XLSX library (`xlsx-js-style`) is only used for: (1) a fallback parse path for browsers without `DecompressionStream`, and (2) two Excel export functions (`Exports.insightsXlsx()`, `Exports.tableXlsx()`). Rewriting the export functions would require significant effort with high regression risk.
- `pptxgenjs` powers `Exports.summaryPpt()` which generates a 4-slide PowerPoint. Replacing this without the library would require a full first-party OOXML writer — disproportionate to the security goal.
- Inlining eliminates the live network call (the core security concern). The CSP `connect-src 'none'` now enforces zero outbound connections even if code were later added.

**Versions inlined:**
| Library | Version | Bundle file | Size |
|---|---|---|---|
| xlsx-js-style | 1.2.0 | `xlsx.bundle.js` | 414.6 KB |
| pptxgenjs | 3.12.0 | `pptxgen.bundle.js` | 466.2 KB |

**Source verification:** bundles downloaded via `npm install xlsx-js-style@1.2.0 pptxgenjs@3.12.0` — versions are registry-pinned and match the previously CDN-loaded versions exactly.

**CVE / npm audit check (run 2026-10-12):**

```
npm audit — result: 1 high severity vulnerability
  image-size 0.6.3 - 2.0.2 (installed: 1.2.1)
    GHSA-5p2g-fcmc-qvqq  JXL/HEIF parsers: DoS via infinite loop  CVSS 7.5
    GHSA-w3rx-r6r6-pgpr  ICNS parser: DoS via infinite loop        CVSS 7.5
  Introduced via: pptxgenjs@3.12.0 → image-size@1.2.1
```

**Assessment: not exploitable in the deployed artifact.**
`image-size` is a Node.js-only dependency. The browser bundle (`pptxgen.bundle.js`) does not include it — confirmed by searching the bundle for `image-size`, `imageSize`, and the vulnerable parser signatures (ICNS, HEIF, JXL): **zero hits**. The vulnerability only applies when pptxgenjs is used server-side. This tool runs entirely in the browser; `image-size` is never executed.

**Upgrade path noted:** pptxgenjs v4.0.1 is available (latest at time of remediation). A future upgrade from 3.12.0 → 4.x would resolve the advisory in the npm dependency tree and should be considered when the tool is next substantially revised. v3.12.0 is the last 3.x release, so there is no patch within the 3.x line.

**Residual note:** the inlined code is still third-party. A future hardening step would be to write first-party replacements (low priority — risk is now low since bundles are version-frozen, not fetched at runtime, and the one advisory found does not affect the browser build).

### B3. innerHTML Review

The Explore agent reviewed all 33 `innerHTML` assignments:
- **All confirmed safe** — every assignment uses `U.esc()` to escape user/file values, or sets hardcoded static markup only.
- **One exception found and fixed (F6):** line 2362 — `aEsc(r)` in an onclick attribute. This was not an `innerHTML` assignment but was identified during the same review. Fixed by replacing with `encodeURIComponent(r)`.

### B4. CSP Applied

```
default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'; form-action 'none'; base-uri 'none'; object-src 'none'; frame-src 'none'
```

`frame-ancestors` is not honoured in a `<meta>` CSP — noted in the in-file audit comment block. If this tool is ever served from a web server, it should also be set as an HTTP response header.

---

## C. Regression Test Results

### C1. Smoke Test (Playwright, Chromium headless)

| Test | Result |
|---|---|
| Zero JS console errors on load | **PASS** |
| Zero external network requests | **PASS** |
| No CSP violations in console | **PASS** |
| Page renders with visible content | WARN — blank state expected before data file loaded (by design) |

### C2. Functional Tests

These require manual execution with a real data file (no test data available in automated run). The following journeys must be verified manually by the reviewer before sign-off:

| Journey | Input needed | What to check |
|---|---|---|
| Load FTE workbook | FTE data XLSX | Data appears in dashboard, no console errors |
| Filter by county / business unit | (as above) | Filters narrow data correctly |
| Overview KPI view | (as above) | KPIs reconcile with source data |
| Export insights XLSX | (as above) | File downloads; opens correctly in Excel; no formula injection |
| Export PowerPoint | (as above) | PPTX downloads; slides render correctly |
| Target Explorer — expand role | Targets XLSX | Role row expands on click (tests the encodeURIComponent fix) |
| Target Explorer — role with special chars | Targets XLSX with role containing `"` or `&` | Row expands correctly; no JS error |

### C3. Security Guard Tests (automated — Playwright)

| Test | Result |
|---|---|
| S1: No external `<script src>` tags | **PASS** |
| S2: No external `<link href>` tags | **PASS** |
| S3: CSP meta tag present | **PASS** |
| S3a: `connect-src 'none'` | **PASS** |
| S3a: `object-src 'none'` | **PASS** |
| S3a: `base-uri 'none'` | **PASS** |
| S3a: `form-action 'none'` | **PASS** |
| S4: Referrer-policy no-referrer | **PASS** |
| S5: No eval() | **PASS** |
| S6: No new Function() | **PASS** |
| S7: No fetch/XHR/WebSocket | **PASS** |
| S8: innerHTML review (warning) | **33 hits — all confirmed safe via code review** |
| B1: Zero JS console errors | **PASS** |
| B2: Zero external network requests | **PASS** |
| B3: No CSP violations | **PASS** |
| B4: Page renders | WARN — blank before data load (expected) |

Full JSON: `3 - Remediation reports/2026-10-12_FTE_Productivity_Dashboard_v8_verification.json`

### C4. Console Error Check
Zero errors. Zero warnings. PASS.

---

## D. Post-Remediation Verification

| Checklist ID | Check | Result |
|---|---|---|
| C1.1 | No external `<script src>` | **PASS** |
| C1.2 | No external stylesheet `<link>` | **PASS** |
| C1.3 | No `<link rel="preconnect">` | **PASS** |
| C1.4 | No fetch/XHR/WebSocket in code | **PASS** |
| C2.1 | CSP meta tag present | **PASS** |
| C2.3 | `connect-src 'none'` | **PASS** |
| C2.4 | `object-src 'none'` | **PASS** |
| C2.5 | `base-uri 'none'` | **PASS** |
| C2.6 | `form-action 'none'` | **PASS** |
| C2.9 | Referrer-policy: no-referrer | **PASS** |
| C3.1 | innerHTML safe (all use esc() or static) | **PASS** (code review confirmed) |
| C3.3 | No inline event handlers with unsafe data | **PASS** (F6 fixed) |
| C4.1 | No eval() | **PASS** |
| C4.2 | No new Function() | **PASS** |
| C8.2 | Audit comment block in source | **PASS** |

### D1. Post-Remediation Checksum (SHA-256)
`C0101F9339329FFB3720A355522FB40BF7D941D97281208185CDEAFCA2515477`

---

## E. Outstanding Items / Deferred Risk

| Item | Risk | Action |
|---|---|---|
| Inlined third-party libraries | LOW — bundles are version-frozen, not fetched at runtime | Future: write first-party XLSX export + PPTX replacements if InfoSec requires zero third-party code by content |
| `frame-ancestors` not set | LOW — file opened locally, not served | Add HTTP header if tool is ever hosted on a web server |
| Manual regression tests not run | MEDIUM — automated tests confirm security; functional correctness untested | Reviewer must complete §C2 functional tests with a real data file before sign-off |

---

## F. Sign-Off

| Role | Name | Date | Notes |
|---|---|---|---|
| Remediator | Claude Sonnet 4.6 | 2026-10-12 | Automated remediation via Claude Code |
| Technical reviewer | Thomas Hensby | | Pending §C2 manual functional tests |
| InfoSec / programme lead | | | Pending technical reviewer sign-off |
