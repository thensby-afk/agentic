# Harry's MOT Garage — Full Specification
**UU Simpler Smarter Better Programme**
**Version 1.0 | 2026-10-13**
**Status: Ready for Claude Code**

---

## 1. What This Is

Harry's MOT Garage is an internal HTML remediation and registry service hosted on Tile (tile.accenture.com). It exists because the programme generates standalone single-file HTML tools, and InfoSec/Tech Services require those tools to meet a baseline security standard before running on client machines.

The service deliberately positions itself as a **roadworthy check, not a full security audit**. It is cheap, fast, and standardised — the HTML equivalent of a UK MOT. No tool leaves Harry's without a certificate. But Harry is not a pen tester, and the UI makes that clear.

**The service has two phases.** Build Phase 1 first. Phase 2 is additive and does not require rearchitecting Phase 1.

---

## 2. Tone of Voice

### Banner / Informational Copy
Plain, direct English. No jargon. Explains what the service is, what it is not, and what users need to do. This appears in onboarding text, help sections, and the certificate itself.

Example: *"Harry's Garage runs a standardised security check on your HTML tool and registers it in the programme catalog. This is not a full InfoSec audit. It is a baseline hardening pass using an external vulnerability standard. Tools must be re-registered every quarter."*

### Harry's Voice (Service Persona)
Harry is the garage owner. South London. Gruff, sardonic, technically competent, seen it all before. He has zero patience for people who think their HTML app is special, but he will fix it and he will stand behind his work.

**Tone rules:**
- Address users as "Sunshine" or "mate" — never by name
- Never effusive, never impressed, never rude enough to be offensive
- Technically accurate beneath the personality — Harry knows what he's doing
- Deliver bad news matter-of-factly, good news with mild contempt
- Always gives the user what they need, just not warmly

**Example lines:**
- On upload: *"Right then. Let's have a look at this. ...Oh. Right. Okay. Sit down, Sunshine."*
- On external CDN scripts: *"You've left the door open and the engine running. Amateur hour. Sorting it now."*
- On a clean file: *"Alright. Not bad. Don't get excited."*
- On the prompt download: *"Here's your checklist. Take it to Claude Code, follow it, come back when it's done. Don't lose it."*
- On uploading a certificate: *"Let's see it then. ...Right. That'll do. You're in the system."*
- On a quarterly due warning: *"Your MOT's due, Sunshine. Don't come crying to me when they won't let you on the road."*
- Positioning disclaimer (in character): *"This ain't a full security survey. This is a roadworthy check. You want a proper audit, talk to InfoSec. You want it running? You're in the right place."*

---

## 3. Visual Design

### Aesthetic
8-bit retro garage. Think: pixel fonts, a muted colour palette (grease-stained greens and greys), CRT scanline overlay, chunky UI elements. The metaphor is a forecourt inspection pit — the tool goes in, Harry looks it over, the certificate comes out.

### Key UI Metaphors
- **Job queue** — tools waiting to be registered or checked
- **Inspection bay** — the active upload / prompt generation area
- **Certificate printer** — the download of the remediation certificate
- **The Board** — the admin catalog view, like a garage job board on the wall

### Constraints
- Single HTML file (no build step, inline CSS/JS)
- Chromium only (Tile SDK requirement)
- Must work within Tile's hosted environment — no external CDN references, no remote fonts
- Use system font stack with a pixel/monospace option for the 8-bit feel: `font-family: 'Courier New', Courier, monospace` or a base64-inlined pixel font if one is used
- Dark background preferred — easier to achieve the 8-bit aesthetic without external assets

---

## 4. Phase 1 — MVP (No AI Dependency)

### 4.1 Overview

Phase 1 has three user journeys and no dependency on AI service approval. The only Tile services required are **SQLite** (catalog) and **Files** (artifact storage), both of which a tile admin enables without raising a request.

### 4.2 Tile Configuration (Prerequisites)

| Item | Action | Who |
|---|---|---|
| Create the tile | Private, all-acn, choose slug (e.g. `harrys-garage`) | Tile admin (Thomas) |
| Enable SQLite | Manage → Settings → Services → Database | Tile admin |
| Enable Files | Manage → Settings → Services → Files | Tile admin |
| Publish initial shell | Upload → Finalize → Publish via API | Claude Code / PAT |

AI access is **not required** for Phase 1.

### 4.3 Journey 1 — Generate Security Prompt

**User:** Programme team member about to build or remediate an HTML tool.

**Flow:**
1. User lands on the garage homepage
2. Harry greets them, explains the two paths: "Building new?" or "Got something that needs looking at?"
3. User selects "Building new — I need the security prompt"
4. Harry delivers a brief withering remark about prevention being better than cure
5. User clicks download
6. App serves a pre-built markdown prompt file as a download

**The prompt file** is a self-contained Claude Code system prompt that incorporates:
- All requirements from `Single-File-HTML-Tool-Blueprint.md` §2, §4, §8, §9
- The target CSP string from `Security-Remediation-Checklist.md` §C2
- The `esc()` helper pattern
- The audit comment block format
- Instructions to run static scan checks before finishing

This file is **static** — it is baked into the app HTML and served as a Blob download. It does not require AI. It should be versioned (e.g. `harrys-garage-security-prompt-v1.md`) and the version displayed in the UI.

**Harry's line on completion:** *"There you go. Follow that and you might not embarrass yourself. Come back when it's done."*

### 4.4 Journey 2 — Register a Remediated Tool

**User:** Programme team member who has completed remediation (in Claude Code or manually) and needs to register the tool.

**Flow:**
1. User selects "I've done the remediation — I need to register it"
2. Harry: *"Let's see it then."*
3. Form presented with fields:
   - **Solution name** (text, required)
   - **Solution owner name** (text, required)
   - **Remediated HTML file** (file upload, `.html` only)
   - **Remediation report** (file upload, `.md` or `.pdf`)
4. On submit: files uploaded to `tile.files` (shared scope), metadata written to SQLite
5. A remediation certificate is generated client-side and offered as a download
6. The tool is added to the catalog

**Remediation certificate** (generated HTML/PDF):
- Tool name and owner
- Date of registration
- Next review due date (registration date + 90 days)
- A unique registration ID (generated client-side, stored in SQLite)
- Harry's "stamp" — a pixel art MOT certificate aesthetic
- Standard disclaimer text (plain English, not Harry voice): *"This certificate confirms that [Tool Name] has completed the programme's baseline HTML security hardening process. This is not an InfoSec security audit or penetration test. Certificate valid for 90 days from issue date."*

**Storage:**
```
tile.files:
  tools/<registration-id>/tool.html          (the remediated HTML)
  tools/<registration-id>/report.md|pdf      (the remediation report)

SQLite table: registrations
  id TEXT PRIMARY KEY          -- generated UUID
  solution_name TEXT
  owner_name TEXT
  registered_at TEXT           -- ISO date
  next_due_at TEXT             -- registered_at + 90 days
  tool_file_key TEXT           -- file storage key
  report_file_key TEXT
  status TEXT                  -- 'active' | 'due' | 'overdue'
```

### 4.5 Journey 3 — Admin Catalog (The Board)

**User:** Programme leadership or solution owner checking the registry.

**Flow:**
1. User navigates to "The Board" (admin view)
2. Catalog renders from SQLite — all registered tools
3. Each entry shows: solution name, owner, registered date, next due date, status badge
4. Status badges:
   - ✅ **ROADWORTHY** — more than 2 weeks until due
   - ⚠️ **DUE SOON** — within 2 weeks of next due date
   - 🔴 **OVERDUE** — past next due date
5. User can click any entry to:
   - Download the original remediated HTML
   - Download the remediation report
   - View registration details

**No authentication gate on The Board** — consistent with the programme's file-share permission model. All-acn access means anyone on the tile can see the catalog.

**Harry's presence on The Board:** a small static notice in character: *"All the motors we've put through. Some of 'em are due back. You know who you are."*

### 4.6 In-Tool Expiry Warning

Every tool registered through the service receives an embedded footer. When Harry generates the certificate and the user downloads the remediated HTML (in Phase 2 this is automatic; in Phase 1 this is provided as a **footer snippet** the user must paste into their tool):

```html
<!-- HARRY'S GARAGE — MOT FOOTER. Do not remove. -->
<div id="harrys-mot-footer" style="...">
  <span id="mot-status"></span>
  <script>
    (function() {
      var due = new Date('YYYY-MM-DD'); // replaced at registration time
      var now = new Date();
      var days = Math.floor((due - now) / 86400000);
      var el = document.getElementById('mot-status');
      if (days < 0) {
        el.textContent = '⚠️ Security review overdue — return to Harry\'s Garage';
        el.style.background = '#c0392b';
      } else if (days <= 14) {
        el.textContent = '⚠️ Security review due in ' + days + ' days — Harry\'s Garage';
        el.style.background = '#e67e22';
      } else {
        el.textContent = '✓ Security review current — next due ' + due.toLocaleDateString('en-GB');
        el.style.background = '#27ae60';
      }
    })();
  </script>
</div>
```

In Phase 1 this snippet is provided to the user as a copyable code block in the UI, with the correct due date pre-filled. In Phase 2 it is injected automatically into the remediated HTML before download.

---

## 5. Phase 2 — AI-Powered Remediation (Additive)

Phase 2 adds in-app remediation. It does not change the Phase 1 data model or UI structure — it adds a new journey between Journey 1 and Journey 2.

### 5.1 Additional Prerequisites for Phase 2

| Item | Action | Who |
|---|---|---|
| AI access approval | Raise `ai_access` request in Tile UI | Tile admin (Thomas) — do this early |
| Enable AI on tile | Tile admin enables after approval, acknowledges egress | Tile admin |

### 5.2 New Journey — In-App Remediation

**User:** Programme team member who wants Harry to do the remediation directly.

**Flow:**
1. User selects "Fix it for me — run the MOT"
2. Harry: *"Right. Let's have a look. This might take a minute."*
3. User uploads their HTML file
4. App runs static scan client-side (grep patterns from the checklist — no AI needed for this step)
5. Scan results shown as a pre-inspection report in Harry's voice
6. User confirms they want to proceed with remediation
7. App calls `tile.ai.complete()` with:
   - System prompt: Harry persona + full security checklist + blueprint requirements
   - User prompt: the HTML file content + scan findings
8. AI returns remediated HTML
9. App runs post-remediation static scan to verify fixes
10. Harry delivers his verdict
11. User proceeds to Journey 2 (registration) with the remediated file pre-populated
12. MOT footer is injected automatically before the download

**AI prompt structure:**
- System: Harry persona instructions + remediation checklist (C1–C8) + blueprint patterns + output format instructions
- The AI must return: (a) the full remediated HTML, (b) a structured remediation log in the report format from `Remediation-Process.md`
- Output is parsed and split — HTML to file download, log to report upload field

### 5.3 Harry's Inspection Commentary

During Phase 2, Harry narrates findings as they come back from the AI. Examples keyed to finding categories:

| Finding | Harry's line |
|---|---|
| External CDN scripts | *"You've got live network calls in here. That's not a feature, that's a liability. Sorting it."* |
| No CSP | *"No Content Security Policy. What are you, new? Adding one now."* |
| innerHTML without esc() | *"You're writing straight to the DOM without escaping. Classic. Fixed."* |
| npm audit hit (not in bundle) | *"Found a known vulnerability in one of your libraries. Checked the browser bundle — it's not actually in there. Documenting it anyway."* |
| Clean file | *"Alright, this one's not bad. Couple of things. Nothing dramatic. You've almost done this right."* |

---

## 6. Deployment Path

### 6.1 Stack

| Layer | Technology |
|---|---|
| Host | tile.accenture.com (private tile) |
| Frontend | Single HTML file — inline CSS + JS, no build step |
| SDK | `/apps/pages/vendor/tile.js` (loaded as classic script) |
| Storage — catalog | Tile SQLite |
| Storage — files | Tile Files (shared scope) |
| AI (Phase 2) | `tile.ai.complete()` — default model |
| Source control | GitHub repository |
| CI deploy | GitHub Actions → Tile Publish API (PAT) |

### 6.2 Deployment Sequence (First Deploy)

```
1. Create tile via Tile UI
   - Private, all-acn
   - Slug: harrys-garage (or agree slug with team)
   - Note the URL from the create response

2. Enable services via Manage → Settings
   - SQLite: on
   - Files: on

3. Mint PAT
   - Manage → Automation
   - Scopes: content:write
   - Store in GitHub Actions secret: TILE_PAT

4. Deploy shell tile from Claude Code
   POST /mapi/v1/pages/<slug>/upload   (raw HTML body)
   POST /mapi/v1/pages/<slug>/finalize
   POST /mapi/v1/pages/<slug>/publish
   Confirm: { published: true }

5. Smoke test (see §6.3)

6. Raise ai_access request (Phase 2 — do this in parallel, it may queue)
```

### 6.3 Smoke Test Checklist

Run these before proceeding to full build. All should pass before Phase 1 is considered deployable.

| Test | Method | Pass criteria |
|---|---|---|
| Tile resolves | Open `tile.accenture.com/view/<slug>/` in Chromium | Page loads, no 404 |
| SDK loads | `console.log(window.tile)` in DevTools | Object present |
| Identity works | `tile.role()` in DevTools console | Returns `{ email, isPageAdmin, ... }` |
| SQLite enabled | `tile.role().then(r => console.log(r.canWriteSqlite))` | `true` |
| SQLite write | Run schema setup, insert a test row, query it back | Row returned |
| Files enabled | `tile.files.put('test/ping.txt', new Blob(['ok']), { scope: 'shared' })` | `{ ok: true }` |
| Files read | `tile.files.get('test/ping.txt', { scope: 'shared' })` | Response with 'ok' body |
| Zero console errors | Load tile, open DevTools | Zero errors |
| Zero network requests | DevTools → Network | No external requests |
| AI available (Phase 2 only) | `tile.ai.available()` | `{ ok: true }` |

### 6.4 GitHub Actions Deploy Workflow

```yaml
name: Deploy to Tile
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Upload to Tile
        run: |
          UPLOAD=$(curl -s -X POST \
            -H "Authorization: Bearer ${{ secrets.TILE_PAT }}" \
            -H "Content-Type: text/html" \
            --data-binary @index.html \
            https://tile.accenture.com/mapi/v1/pages/${{ vars.TILE_SLUG }}/upload)
          UPLOAD_ID=$(echo $UPLOAD | python3 -c "import sys,json; print(json.load(sys.stdin)['upload_id'])")
          curl -s -X POST \
            -H "Authorization: Bearer ${{ secrets.TILE_PAT }}" \
            -H "Content-Type: application/json" \
            -d "{\"upload_id\": \"$UPLOAD_ID\"}" \
            https://tile.accenture.com/mapi/v1/pages/${{ vars.TILE_SLUG }}/finalize
          curl -s -X POST \
            -H "Authorization: Bearer ${{ secrets.TILE_PAT }}" \
            https://tile.accenture.com/mapi/v1/pages/${{ vars.TILE_SLUG }}/publish
```

---

## 7. Data Model

### SQLite Schema

```sql
CREATE TABLE IF NOT EXISTS registrations (
  id TEXT PRIMARY KEY,
  solution_name TEXT NOT NULL,
  owner_name TEXT NOT NULL,
  registered_at TEXT NOT NULL,
  next_due_at TEXT NOT NULL,
  tool_file_key TEXT NOT NULL,
  report_file_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  phase2_remediated INTEGER DEFAULT 0,
  remediation_log TEXT
);
```

`status` is computed on read (compare `next_due_at` to today) — not stored as a drifting value.

`phase2_remediated` flag distinguishes tools remediated in-app (Phase 2) from self-remediated uploads (Phase 1). Allows future reporting.

`remediation_log` stores the structured Phase 2 report JSON if applicable.

### File Storage Keys

```
tools/<registration-id>/tool.html
tools/<registration-id>/report.md      (or .pdf)
```

---

## 8. Files in the Repository

```
/
├── index.html                          (the whole app — single file)
├── assets/
│   └── security-prompt-v1.md          (the static prompt download)
├── spec/
│   ├── harrys-garage-spec.md           (this file)
│   ├── Security-Remediation-Checklist.md
│   ├── Remediation-Process.md
│   ├── Single-File-HTML-Tool-Blueprint.md
│   └── tile-skill/references/          (Tile SDK reference docs)
└── .github/
    └── workflows/
        └── deploy.yml
```

`index.html` is self-contained. The `assets/` folder holds the prompt file, which is fetched at build time and inlined into the HTML as a base64 data URI or a JS string literal — so the deployed tile has no external file dependencies.

---

## 9. What to Hand to Claude Code

Give Claude Code:
1. This spec file
2. `Single-File-HTML-Tool-Blueprint.md` (architecture pattern)
3. `Security-Remediation-Checklist.md` (C1–C8 checks)
4. `Remediation-Process.md` (report format)
5. `tile-skill/SKILL.md` + all `references/` files
6. Instruction: **build Phase 1 only. Smoke test deployment before writing application logic.**

Suggested opening prompt for Claude Code:
> "Read harrys-garage-spec.md and all referenced files. Build Phase 1 of Harry's MOT Garage as a single index.html for deployment on Tile. Before writing any application logic, deploy a shell tile and run the smoke test checklist in §6.3. Report results and wait for confirmation before proceeding."

---

## 10. Outstanding Before Build

| Item | Status | Owner |
|---|---|---|
| Tile slug agreed | ❌ To confirm | Thomas |
| Tile created | ❌ | Thomas |
| SQLite + Files enabled | ❌ | Thomas |
| PAT minted and stored | ❌ | Thomas |
| ai_access request raised (Phase 2) | ❌ Start now — may queue | Thomas |
| Phase 2 go/no-go decision | Deferred | Thomas |
