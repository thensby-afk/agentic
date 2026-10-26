# Harry's Motor Works — Technical Specification v2.0
**Status: Ready for Claude Code**
**Supersedes: harrys-garage-spec.md v1.0**

---

## Summary of Changes from v1.0

1. Solution is **programme-agnostic** — not specific to UU or any engagement
2. **CMMYY filename encoding** standard defined (the "tax disc")
3. **Navigation model** defined — the office IS the nav
4. **Three document types** specified: hire form, MOT cert, V5C logbook
5. **Journey 3** added: certification-only path (pre-remediated tools)
6. **Journey 4** added: change of ownership (V5C)
7. **Data model** updated: programme field, CMMYY, transfer history
8. **Admin view** updated: programme filter

---

## 1. Scope

Harry's Motor Works is a **programme-agnostic** HTML tool security certification service. Any Accenture team that produces standalone HTML tools may use it. It is not specific to UU, any other client, or any engagement.

**Programme** is captured as a required metadata field during certification. This enables:
- The admin view to filter by programme ("show me all certs for my programme")
- The registry to serve as a cross-programme catalogue

**Access model**: All registered tools are visible to all users within the tile's all-acn scope. There is no access control by programme. This mirrors the public availability of vehicle tax status: anyone can check, only the registered keeper can update. No InfoSec approval is required to view the catalogue.

---

## 2. CMMYY Filename Encoding Standard

### 2.1 Format

The CMMYY code is a 5-character suffix appended to the filename of every certified tool, immediately before the `.html` extension:

```
[original_filename]_C[MM][YY].html
```

Where:
- `_C` = separator + literal `C` (denotes "Certified until")
- `MM` = 2-digit month of certification expiry (01–12)
- `YY` = 2-digit year of certification expiry

### 2.2 Examples

| Certified on | Expires | CMMYY | Certified filename |
|---|---|---|---|
| 15 Oct 2026 | 15 Jan 2027 | `C0127` | `FTE_Dashboard_v8_C0127.html` |
| 3 Feb 2027 | 4 May 2027 | `C0527` | `SSB_Value_Tool_C0527.html` |
| 1 Dec 2026 | 1 Mar 2027 | `C0327` | `Leakage_Cockpit_C0327.html` |

### 2.3 Expiry month calculation

The expiry month is the calendar month in which certification lapses. Add 90 days to the certification date; the CMMYY MM/YY values are the month and year of the resulting date.

Example: certified 15 October 2026 → expiry 13 January 2027 → CMMYY = `C0127`.

### 2.4 The "tax disc" principle

The CMMYY suffix allows any reviewer to assess certification status from the filename alone, without querying a central registry. It travels with the artefact. When a tool is re-certified, the suffix is updated:

```
FTE_Dashboard_v8_C0127.html  →  FTE_Dashboard_v8_C0427.html
```

### 2.5 Footer countdown (embedded in every certified tool)

On certification, a footer is appended to the tool. It reads the CMMYY value from a `<meta name="hmw-cmmyy">` tag injected at certification time and renders a status bar:

| State | Condition | Display |
|---|---|---|
| Current | >14 days remaining | `✓ Certified — next due [Month] [Year]` (green) |
| Due soon | ≤14 days remaining | `⚠ Certification due in N days` (amber) |
| Overdue | Past expiry month | `✕ Certification overdue — return to Harry's Garage` (red) |

The footer logic must work offline with no registry call.

### 2.6 CMMYY injection template

At certification, append immediately before `</body>`:

```html
<!-- HARRY'S MOTOR WORKS — CERTIFICATION FOOTER. Do not remove. -->
<meta name="hmw-cmmyy" content="CMMYY_VALUE">
<meta name="hmw-cert" content="CERT_SERIAL">
<meta name="hmw-programme" content="PROGRAMME_NAME">
<div id="hmw-footer" style="position:fixed;bottom:0;left:0;right:0;font-family:monospace;font-size:11px;padding:4px 12px;z-index:9999;display:flex;justify-content:space-between;align-items:center;">
  <span id="hmw-status"></span>
  <span style="color:#9090a0">Harry's Motor Works · Cert CERT_SERIAL · SOLUTION_NAME</span>
</div>
<script>
(function(){
  var code=document.querySelector('meta[name="hmw-cmmyy"]').content;
  var mm=parseInt(code.slice(1,3),10),yy=parseInt(code.slice(3,5),10);
  var exp=new Date(2000+yy,mm,0);// last day of expiry month
  var now=new Date(),days=Math.ceil((exp-now)/86400000);
  var el=document.getElementById('hmw-footer'),st=document.getElementById('hmw-status');
  if(days<0){el.style.background='#c04020';el.style.color='#fff';st.textContent='✕ Certification overdue — return to Harry\'s Garage';}
  else if(days<=14){el.style.background='#d4a010';el.style.color='#1a1408';st.textContent='⚠ Certification due in '+days+' day'+(days!==1?'s':'');}
  else{el.style.background='#1a8020';el.style.color='#fff';st.textContent='✓ Certified — next due '+exp.toLocaleString('en-GB',{month:'long',year:'numeric'});}
})();
</script>
```

---

## 3. Navigation Model

### 3.1 The home screen IS the office

There is no traditional top navbar. Navigation is achieved entirely by clicking on elements within the top-down office scene. This is deliberate — it embeds the metaphor into every interaction.

### 3.2 Hotspot map

| Element | Position in scene | Destination | Harry's line on click |
|---|---|---|---|
| **Harry's sprite** | Row 7, col 5 | Quick nav menu ("What do you need?") | *"What is it then, Sunshine?"* |
| **Notice on wall** | Row 2–3, col 6 (right side of back wall) | About / scope / full user contract | *"Read the small print, mate. It's all there."* |
| **Filing cabinet** | Rows 4–6, cols 1–2 | Admin — all registered solutions | *"Filing cabinet. Don't touch anything you don't need to."* |
| **White duplicate** (top) | Rows 2–3, col 12 (cert cabinet) | Journey 2 — Remediation intake (hire form) | *"Bringing something in? Fill in the form."* |
| **Yellow duplicate** (bottom) | Rows 2–3, col 13 (cert cabinet) | Journey 3 — Certification only (pre-remediated) | *"Already done it yourself? Let's have a look then."* |
| **Key cabinet** | Rows 2–3, cols 1–2 | Journey 1 — Download security prompt | *"Here's your checklist. Don't lose it."* |
| **Garage door** | Row 11, cols 13–14 | Phase 2 locked screen | *"Garage is closed. Not ready yet. Come back."* |
| **Yard door** | Row 11, cols 0–1 | Help / external docs | — |
| **Knackered chair** | Row 6, col 6 | No destination (Easter egg: Harry comments on it) | *"I know. I've been meaning to sort that."* |

### 3.3 Hover states

On hover, a clickable element's tiles lighten slightly (+10% brightness). A tooltip appears above the element showing the destination name. Harry does not speak on hover — only on click.

### 3.4 Current section indicator

When the user is in a section (e.g., admin), the corresponding office element is highlighted with a subtle glow border. The office scene is always accessible via a "← Back to office" link.

### 3.5 Mobile

On narrow screens, the office scene scales down. If a tap target is too small (<44px), a simplified icon nav appears beneath the scene listing the same destinations.

---

## 4. User Journeys

### Journey 1 — Download Security Prompt *(Unchanged from v1.0)*

Entry: Key cabinet  
Output: Versioned markdown prompt file (download)  
Harry's line on completion: *"There you go. Follow it and you might not embarrass yourself. Come back when it's done."*

---

### Journey 2 — Remediation

Entry: White duplicate form (cert cabinet)  
Documents produced: HMW-R001 (intake) → HMW-C001 (certificate)

**Step 1 — Intake: Hire Form HMW-R001**

Fields:
- Solution name (required)
- Programme (required, free text, case-insensitive)
- Solution owner name (required)
- Owner email (required)
- Brief description of tool (optional)
- Upload HTML file (.html only, required)
- `[ ]` I have read the notice (required)
- `[ ]` I accept the terms (required)

On submit: static pre-scan runs client-side (C1–C8 grep checks). Results displayed as pre-inspection report. Harry delivers a character response keyed to the scan findings (voice bank, see §8). User confirms work to be carried out.

**Step 2 — Manual remediation (Phase 1)**

User is directed to Claude Code with the security prompt pre-populated with scan findings. Returns when done.

**Step 3 — Certification: MOT Certificate HMW-C001**

User uploads remediated HTML + remediation report. Post-scan runs. If passes, cert is generated with CMMYY code. Remediated HTML is renamed with `_CMMYY` suffix and offered for download. Cert (HTML) also offered for download. Tool registered in catalog.

Harry's line on success: *"There you go, Sunshine. CMMYY is C[MMYY]. Rename the file. Come back in 90 days."*

---

### Journey 3 — Certification Only (Pre-Remediated)

Entry: Yellow duplicate form (cert cabinet)  
For: Tools already remediated by the owner in Claude Code or manually  
Documents produced: HMW-C001 (certificate)

Shorter form — same fields as Journey 2 Step 1, plus:
- Upload existing remediation report (required, .md or .pdf)
- Declaration: "This tool has been self-remediated in accordance with the checklist" (required)

Post-scan runs immediately on upload. If passes → cert issued. If fails → redirect to Journey 2 with scan findings pre-populated.

Harry's line: *"Already done it yourself, have ya? Let's see. ...Alright. Not bad."* (or on failure: *"Yeah, not quite there yet. Fill in the other form."*)

---

### Journey 4 — Change of Ownership (V5C)

Entry: Admin view (row action on any registration) or direct link  
Documents produced: HMW-V001 (V5C logbook)

For: Transferring a registered tool to a new solution owner.

Fields:
- Certificate lookup (search by cert number or solution name)
- Confirms current owner details (read-only, from registry)
- New owner name (required)
- New owner email (required)
- New programme (optional — only if programme changes)
- Reason for transfer: `(•) Staff movement  ( ) Programme change  ( ) Other: ____`
- Previous keeper declaration (name + date)
- New keeper declaration (name + date)

On submit:
- `transfer_history` record created
- `registrations` updated (new owner, new programme if provided)
- Notification stub (HMW-V001 lower section) generated for previous owner
- Harry's line: *"Right then. New keeper is it? Fill in the V5. Done. Don't scratch it."*

**V5C does not reset the certification clock.** The CMMYY expiry date remains unchanged. Ownership change ≠ re-certification.

---

## 5. Document Specifications

### 5.1 HMW-R001 — Vehicle Remediation Order ("The Hire Form")

**Visual language**: Cream paper (`#f8f4e8`). Navy header bar with badge. Courier New throughout. Light blue ruled lines. Footer clearly shows WHITE COPY (operator) and YELLOW DUPLICATE (Harry's). Style: Hertz rental form c.1995 crossed with a council planning application.

**Sections:**

```
┌─────────────────────────────────────────────────────────────────────┐
│ [BADGE]  HARRY'S MOTOR WORKS — 147a CRYSTAL PALACE RD, SE19        │
│ ══════════════════════════════════════════════════════════════════  │
│         VEHICLE REMEDIATION ORDER            Form HMW-R001 Rev 3.2  │
│ ══════════════════════════════════════════════════════════════════  │
│                                                                     │
│ SECTION A — VEHICLE DETAILS                    Date: ____________   │
│ Solution name:     ___________________________________________      │
│ Programme:         ___________________________________________      │
│ Solution owner:    ___________________________________________      │
│ Owner email:       ___________________________________________      │
│ Description:       ___________________________________________      │
│                    ___________________________________________      │
│                                                                     │
│ SECTION B — PRESENTING CONDITION (completed by Harry)              │
│ [ ] External scripts / CDN calls   [ ] Missing or weak CSP         │
│ [ ] innerHTML without escaping     [ ] eval() / new Function()     │
│ [ ] No audit comment block         [ ] Formula injection risk       │
│ Harry's assessment: ______________________________________________  │
│                                                                     │
│ SECTION C — WORK TO BE CARRIED OUT                                  │
│ [ ] Remove external dependencies   [ ] Add/strengthen CSP          │
│ [ ] Remediate innerHTML risks      [ ] Add esc() helper             │
│ [ ] Remove dynamic code execution  [ ] Add audit comment block     │
│ [ ] Input validation               [ ] Formula injection guard      │
│ [ ] Other: ____________________________________________________     │
│                                                                     │
│ SECTION D — DECLARATION                                             │
│ I have read the notice. I accept that certification confirms        │
│ mechanical compliance only. The primary danger is how I drive it.   │
│                                                                     │
│ Signature: _________________________ Date: _____________________   │
│                                                                     │
│═════════════════════════════════════════════════════════════════════│
│ ████████████ WHITE COPY — OPERATOR        ░░░░░░░ YELLOW — HARRY'S │
└─────────────────────────────────────────────────────────────────────┘
```

---

### 5.2 HMW-C001 — Security Test Certificate ("The MOT")

**Visual language**: Pale green paper (`#e8f4e4`). Dark green double border (`#1a6030`). Badge top-centre. Courier New for fields, Georgia for headings. Large stamp: green PASS / amber CONDITIONAL / red FAIL. CMMYY code in prominent box with rename instruction. Style: UK MOT test pass certificate.

**Structure:**

```
┌════════════════════════════════════════════════════════════════════╗
║                        [BADGE]                                    ║
║               HARRY'S MOTOR WORKS                                 ║
║           SECURITY TEST CERTIFICATE                               ║
║  Certificate No: HMW-C-[SERIAL]          Date: _______________   ║
╠════════════════════════════════════════════════════════════════════╣
║  Solution:    ________________________________                     ║
║  Programme:   ________________________________                     ║
║  Owner:       ________________________________                     ║
║  Filename:    [original_name_CMMYY.html] ← file as it should be saved ║
╠════════════════════════════════════════════════════════════════════╣
║  TEST RESULTS                                        RESULT       ║
║  C1  External dependencies                           PASS / FAIL  ║
║  C2  Content Security Policy                         PASS / FAIL  ║
║  C3  DOM injection / innerHTML                       PASS / FAIL  ║
║  C4  Dynamic code execution                          PASS / FAIL  ║
║  C5  Input validation                                PASS / FAIL  ║
║  C6  Formula injection guard                         PASS / FAIL  ║
║  C7  Data privacy / local storage                    PASS / FAIL  ║
║  C8  Audit comment block                             PASS / FAIL  ║
╠════════════════════════════════════════════════════════════════════╣
║  ┌────────────────────┐   Valid from:  ____________________       ║
║  │  ██ SECURITY  ██   │   Valid until: ____________________       ║
║  │    COMPLIANT       │   CMMYY code:  [C0127]                    ║
║  │     [BADGE]        │                                           ║
║  │  BY ORDER OF       │   ┌────────────────────────────────────┐  ║
║  │    INFOSEC         │   │  Append _C0127 to filename before  │  ║
║  │  [DATE] [SERIAL]   │   │  distributing this tool.           │  ║
║  └────────────────────┘   └────────────────────────────────────┘  ║
╠════════════════════════════════════════════════════════════════════╣
║  This certificate confirms mechanical compliance at date of test.  ║
║  The primary danger is not the roadworthiness of the vehicle.      ║
║  It is how it is driven.                                           ║
║                                                                    ║
║  Signed: H. Williams (Proprietor)    Station: AT10047              ║
╚════════════════════════════════════════════════════════════════════╝
```

**Stamp colours:**
- PASS: `#1a8020` green background, white text
- CONDITIONAL PASS: `#d4a010` amber background, dark text (minor items failed)
- FAIL: `#c04020` red background, white text

**CONDITIONAL PASS** applies when: all CRITICAL (C1, C4) checks pass, but some HIGH/MEDIUM items (C5–C8) fail. The tool is considered driveable but must return for full certification within 30 days.

---

### 5.3 HMW-V001 — Certificate of Ownership ("The V5C Logbook")

**Visual language**: SALMON PINK paper (`#f4c0a8`). Dark navy text (`#1a2844`). Two sections separated by a perforated tear line. Upper section = keeper's copy. Lower section = notification stub (Harry's records). Style: DVLA V5C vehicle registration certificate — the distinctive salmon-pink is non-negotiable.

**Structure:**

```
┌─────────────────────────────────────────────────────────────────┐
│ [BADGE]   HARRY'S MOTOR WORKS      CERTIFICATE OF OWNERSHIP     │
│           147a Crystal Palace Rd   Form HMW-V001                │
├─────────────────────────────────────────────────────────────────┤
│ REGISTERED SOLUTION                                             │
│ Certificate no:  ________________  Programme: _______________   │
│ Solution name:   _______________________________________        │
│ CMMYY code:      ________________  Expires: _______________     │
├─────────────────────────────────────────────────────────────────┤
│ CURRENT REGISTERED KEEPER                                       │
│ Name:  _______________________________  (read-only)             │
│ Email: _______________________________  (read-only)             │
├─────────────────────────────────────────────────────────────────┤
│ NEW REGISTERED KEEPER                                           │
│ Name:       ___________________________________________________  │
│ Email:      ___________________________________________________  │
│ Programme:  ___________________ (only if changing programme)    │
├─────────────────────────────────────────────────────────────────┤
│ REASON FOR TRANSFER                                             │
│ (•) Staff movement  ( ) Programme change  ( ) Other: ________   │
├─────────────────────────────────────────────────────────────────┤
│ DECLARATION                                                     │
│ I confirm transfer of responsibility for the above solution.    │
│ Previous keeper: __________________ Date: _________________     │
│ New keeper:      __________________ Date: _________________     │
├─────────────────────────────────────────────────────────────────┤
│ FOR HARRY'S USE ONLY                                            │
│ Transfer recorded: (Y/N)   Certificate updated: (Y/N)           │
│ Date: ____________________                                      │
│─────────────────────────────────────────────────────────────────│
│- - - - - - - - - - CUT HERE - - - - - - - - - - - - - - - - - -│
│ NOTIFICATION STUB — HARRY'S MOTOR WORKS COPY                    │
│ Solution: _______________  From: ______________  To: ___________ │
│ Date: _______________  Cert: _______________  CMMYY: ___________│
└─────────────────────────────────────────────────────────────────┘
```

**Important**: The V5C does NOT reset the certification clock. CMMYY expiry is unchanged by a transfer. Ownership ≠ re-certification.

---

## 6. Data Model (Updated)

### 6.1 Changes to `registrations` table

```sql
-- Add to existing CREATE TABLE registrations:
ALTER TABLE registrations ADD COLUMN programme TEXT NOT NULL DEFAULT 'Unknown';
ALTER TABLE registrations ADD COLUMN cmmyy_code TEXT;          -- e.g. 'C0127'
ALTER TABLE registrations ADD COLUMN cert_version INTEGER DEFAULT 1;
ALTER TABLE registrations ADD COLUMN journey_type TEXT DEFAULT 'remediation';
  -- 'remediation' | 'cert_only'
ALTER TABLE registrations ADD COLUMN cert_serial TEXT;         -- e.g. 'HMW-C-001847'
```

### 6.2 New `transfer_history` table

```sql
CREATE TABLE IF NOT EXISTS transfer_history (
  id             TEXT PRIMARY KEY,
  registration_id TEXT NOT NULL,
  from_owner_name  TEXT,
  from_owner_email TEXT,
  to_owner_name    TEXT NOT NULL,
  to_owner_email   TEXT NOT NULL,
  from_programme   TEXT,
  to_programme     TEXT,
  reason           TEXT,
  transfer_date    TEXT NOT NULL,
  stub_file_key    TEXT            -- tile.files key for the stub PDF/HTML
);
```

### 6.3 Key queries

```sql
-- Admin: all programmes (latest cert per solution)
SELECT * FROM registrations ORDER BY next_due_at;

-- Admin: filter by programme (case-insensitive)
SELECT * FROM registrations
WHERE lower(trim(programme)) = lower(trim(?))
ORDER BY next_due_at;

-- Admin: programme list (for dropdown)
SELECT DISTINCT lower(trim(programme)) AS prog, COUNT(*) AS count
FROM registrations GROUP BY prog ORDER BY prog;

-- Check V5C history for a solution
SELECT * FROM transfer_history
WHERE registration_id = ?
ORDER BY transfer_date DESC;
```

---

## 7. Admin View (Updated)

### 7.1 The Board — updated columns

| Column | Notes |
|---|---|
| Solution name | Clickable → view detail |
| Programme | New — filterable |
| Owner | Updated by V5C |
| CMMYY | New — shown as a monospace badge |
| Registered | Date |
| Next due | Countdown-coloured |
| Status | ✓ ROADWORTHY / ⚠ DUE SOON / ✕ OVERDUE |
| Actions | Download cert · Transfer (V5C) · Re-certify |

### 7.2 Programme filter

A search/filter control above The Board:
- Default: "All programmes"
- Typing filters live (case-insensitive match on programme field)
- Shows count: "Showing 4 of 12 solutions"
- URL updates: `?programme=ssb` for shareable filtered views

### 7.3 Harry's line on admin view

*"These are all the motors we've put through. Some of 'em are due back. You know who you are."*

---

## 8. Voice Bank (Harry's responses)

For programmatic selection based on scan results and journey state.

| Trigger | Harry's line |
|---|---|
| Scan: external CDN scripts found | *"You've left the door open and the engine running. Amateur hour."* |
| Scan: no CSP | *"No Content Security Policy. What are you, new?"* |
| Scan: high innerHTML count | *"You're writing straight to the DOM without escaping. Classic."* |
| Scan: clean file | *"Alright, this one's not bad. Don't get excited."* |
| Scan: npm audit hit (not in bundle) | *"Found a known vulnerability. Checked the browser bundle — not in there. Documenting it anyway."* |
| Cert issued | *"There you go. CMMYY is [code]. Rename the file. Come back in 90 days."* |
| Re-cert due | *"Your MOT's due, Sunshine. Don't come crying to me when they won't let you on the road."* |
| Transfer initiated | *"Right then. New keeper is it? Fill in the V5. Done. Don't scratch it."* |
| Garage door (Phase 2 locked) | *"Garage is closed. Not ready yet. Come back later."* |
| Chair Easter egg | *"I know. I've been meaning to sort that."* |
| Admin view entered | *"These are all the motors we've put through. Some of 'em are due back. You know who you are."* |
| Phase 2 (future, AI remediation) | *"Right. Let's have a look. This might take a minute."* |

---

## 9. Tile Platform Notes

### 9.1 AI enablement (Phase 2 only)

Phase 1 has no AI dependency. Tile AI is required for Phase 2 (in-app remediation). The `ai_access` request should be raised now as it may queue — but Phase 1 build should not wait for it.

### 9.2 Storage allocation

| Store | Content | Estimated size |
|---|---|---|
| SQLite | `registrations` + `transfer_history` tables | <1 MB |
| `tile.files` (shared) | Uploaded HTMLs, remediation reports, cert docs | Up to 50–100 MB |

File key convention:
```
tools/<registration-id>/original.html
tools/<registration-id>/remediated_CMMYY.html
tools/<registration-id>/report.md
tools/<registration-id>/cert_HMW-C-SERIAL.html
tools/<registration-id>/v5c/<transfer-id>.html
```

---

## 10. Phase 1 Build Order

Build in this sequence; do not start the next until the current deploys clean:

1. **Shell tile** — deploy empty `index.html` to Tile; confirm URL resolves and SQLite/Files are on
2. **Home screen** — interactive office scene with hotspot hover/click; Harry responds; nav works
3. **Journey 1** — key cabinet → download prompt file (static, no DB)
4. **Journey 2 intake** — hire form HMW-R001; static pre-scan; scan results displayed; Harry responds
5. **Journey 2 cert** — upload remediated HTML + report; post-scan; generate HMW-C001; CMMYY; register in DB
6. **Admin view** — The Board; programme filter; download cert; status badges
7. **Journey 3** — cert-only path (shorter form, same cert output)
8. **Journey 4** — V5C change of ownership
9. **Phase 2 prep** — raise `ai_access` request; placeholder "garage closed" screen

---

## 11. Files to Hand to Claude Code

```
harrys-garage-spec-v2.md        ← this document (primary brief)
harrys-garage-spec.md           ← v1.0 for background context
design-guide.md                 ← visual design reference (see companion file)
Security-Remediation-Checklist.md
Remediation-Process.md
Single-File-HTML-Tool-Blueprint.md
tile-skill/SKILL.md
tile-skill/references/foundations.md
tile-skill/references/ai.md
tile-skill/references/sqlite.md
tile-skill/references/storage.md
tile-skill/references/publishing.md
tile-skill/references/automation.md
```

### Opening prompt for Claude Code

> "Read `harrys-garage-spec-v2.md` in full before writing any code.
> Build Phase 1 in the order listed in §10.
> Start by deploying a shell tile and running the smoke test checklist from v1.0 §6.3.
> Report results before proceeding to the home screen.
> The tile slug is [AGREE WITH THOMAS BEFORE STARTING].
> The PAT is in the environment variable `TILE_PAT`."

---

## 12. Outstanding Before Build

| Item | Status | Owner |
|---|---|---|
| Tile slug agreed | ❌ Confirm | Thomas |
| Tile created (private, all-acn) | ❌ | Thomas |
| SQLite + Files enabled | ❌ | Thomas |
| PAT minted (content:write), stored in GitHub Actions | ❌ | Thomas |
| ai_access request raised (for Phase 2) | ❌ Start now | Thomas |
| Tile URL confirmed | ❌ | Thomas |
