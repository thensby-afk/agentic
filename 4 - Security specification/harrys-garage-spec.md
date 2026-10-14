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
- CSP note: Harry's Garage loads the Tile SDK via `<script src="/apps/pages/vendor/tile.js">`. This requires `script-src 'self' 'unsafe-inline'` rather than the `script-src 'unsafe-inline'` used in the standalone tools. This deviation from the blueprint CSP is deliberate — the blueprint applies to data-only tools; Harry's Garage is an SDK-integrated application.

---

## 4. Phase 1 — MVP (No AI Dependency)

### 4.1 Overview

Phase 1 has three user journeys and no dependency on AI service approval. The only Tile services required are **SQLite** (catalog) and **Files** (artifact storage), both of which a tile admin enables without raising a request.

The remediation workflow is split between the hosted service and the builder's local Claude Code instance:
1. Builder accesses the hosted solution and selects their journey
2. Hosted solution generates the remediation blueprint and delivers it to the builder
3. Builder feeds the blueprint to their local Claude Code instance (process must be compatible with Claude.ai as well as Claude Code, since not all builders use VS Code/Claude Code)
4. Local Claude generates a remediated HTML with audit trail comments, a countdown footer, and a remediation certificate
5. Builder registers their HTML with the hosted solution, uploading the file and certificate, with their name, and agreeing to return for re-check at the next due date

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

This file is **static** — it is baked into the app HTML at build time as a JS string literal and served as a Blob download. It does not require AI. It should be versioned (e.g. `harrys-garage-security-prompt-v1.md`) and the version displayed in the UI.

**Harry's line on completion:** *"There you go. Follow that and you might not embarrass yourself. Come back when it's done."*

### 4.4 Journey 2 — Register a Remediated Tool

**User:** Programme team member who has completed remediation (via local Claude Code or Claude.ai) and needs to register the tool.

**Flow:**
1. User selects "I've done the remediation — I need to register it"
2. Harry: *"Let's see it then."*
3. Form presented with fields:
   - **Solution name** (text, required)
   - **Solution owner name** (text, required)
   - **Solution owner email** (email, validated, required — auto-populated from `tile.role().email` if available)
   - **Remediated HTML file** (file upload, `.html` only)
   - **Remediation certificate** (file upload, `.pdf` only)
   - Checkbox: "I agree to return this tool for re-check before the due date"
4. On submit: files uploaded to `tile.files` (shared scope), metadata written to SQLite
5. A registration confirmation is shown with the registration ID and due date
6. The tool is added to the catalog

**Write access control:** Registration requires a passcode. The passcode is set by the tile admin and displayed on the tile's admin settings page. This prevents unauthenticated writes from any all-acn viewer. The passcode is checked client-side only — this is a programme-process control, not a security boundary.

**Storage:**
```
tile.files:
  tools/<registration-id>/tool.html          (the remediated HTML)
  tools/<registration-id>/certificate.pdf    (the remediation certificate)

SQLite table: registrations
  id TEXT PRIMARY KEY          -- generated UUID
  solution_name TEXT
  owner_name TEXT
  owner_email TEXT
  registered_at TEXT           -- ISO date
  next_due_at TEXT             -- registered_at + 90 days
  tool_file_key TEXT           -- file storage key
  certificate_file_key TEXT
  status TEXT                  -- computed on read: 'active' | 'due' | 'overdue'
```

`status` is computed on read (compare `next_due_at` to today) — not stored as a drifting value.

### 4.5 Journey 3 — Admin Catalog (The Board)

**User:** Programme leadership or solution owner checking the registry.

**Flow:**
1. User navigates to "The Board" (admin view)
2. Catalog renders from SQLite — all registered tools
3. Each entry shows: solution name, owner name, owner email, registered date, next due date, status badge
4. Status badges:
   - ✅ **ROADWORTHY** — more than 2 weeks until due
   - ⚠️ **DUE SOON** — within 2 weeks of next due date
   - 🔴 **OVERDUE** — past next due date
5. User can click any entry to:
   - Download the original remediated HTML
   - Download the remediation certificate
   - View registration details

**No authentication gate on The Board** — consistent with the programme's file-share permission model. All-acn access means anyone on the tile can view the catalog and download artifacts. This is a deliberate decision.

**Harry's presence on The Board:** a small static notice in character: *"All the motors we've put through. Some of 'em are due back. You know who you are."*

### 4.6 MOT Countdown Footer

The remediation certificate generated by local Claude Code must include an MOT countdown footer baked into the remediated HTML. The due date is set at remediation time (registration date + 90 days) and hardcoded into the snippet.

```html
<!-- HARRY'S GARAGE — MOT FOOTER. Do not remove. -->
<div id="harrys-mot-footer" style="position:fixed;bottom:0;left:0;right:0;padding:4px 12px;font-family:monospace;font-size:12px;z-index:9999;">
  <span id="mot-status"></span>
  <script>
    (function() {
      var due = new Date('YYYY-MM-DD'); // set at registration time: today + 90 days
      var now = new Date();
      var days = Math.floor((due - now) / 86400000);
      var el = document.getElementById('mot-status');
      if (days < 0) {
        el.textContent = '⚠️ Security review overdue — return to Harry\'s Garage';
        el.style.background = '#c0392b'; el.style.color = '#fff';
      } else if (days <= 14) {
        el.textContent = '⚠️ Security review due in ' + days + ' days — Harry\'s Garage';
        el.style.background = '#e67e22'; el.style.color = '#fff';
      } else {
        el.textContent = '✓ Security review current — next due ' + due.toLocaleDateString('en-GB');
        el.style.background = '#27ae60'; el.style.color = '#fff';
      }
    })();
  </script>
</div>
```

This snippet is provided to the user as a copyable code block in the post-registration confirmation screen, with the correct due date pre-filled. It is also included in the instructions delivered to local Claude Code as part of the remediation blueprint.

---

## 5. Phase 2 — Additive Enhancements (Future)

Phase 2 is deferred. The hosted solution remains deterministic (no AI dependency) in Phase 1. Any AI-powered in-app remediation features are out of scope until Phase 1 is stable and the ai_access request has been approved.

Outstanding Phase 2 decisions:
- In-app remediation scope: the Tile AI request body cap is 256 KiB; most remediated HTML files significantly exceed this. Phase 2 must strip inlined library bundles before sending to AI, or operate only on smaller source files.
- Egress disclosure: builder-uploaded HTML content would egress to an external model provider (AWS Bedrock or Azure). A consent/acknowledgement step is required.
- Output token cap: `maxOutputTokens` is capped at 8192 on the platform. Adequate for small files only.

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
| AI | Not required for Phase 1 |
| Source control | https://github.com/thensby-afk/agentic |
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
   - Also store TILE_SLUG as a repo variable

4. Deploy shell tile from Claude Code
   POST /mapi/v1/pages/<slug>/upload   (raw HTML body)
   POST /mapi/v1/pages/<slug>/finalize
   POST /mapi/v1/pages/<slug>/publish
   Confirm: { published: true }

5. Smoke test (see §6.3)
```

### 6.3 Smoke Test Checklist

| Test | Method | Pass criteria |
|---|---|---|
| Tile resolves | Open `tile.accenture.com/view/<slug>/` in Chromium | Page loads, no 404 |
| SDK loads | `console.log(window.tile)` in DevTools | Object present |
| Identity works | `tile.role()` in DevTools console | Returns `{ email, isPageAdmin, ... }` |
| SQLite enabled | `tile.role().then(r => console.log(r.canWriteSqlite))` | `true` (folds in whether SQLite is on) |
| SQLite write | Run schema setup, insert a test row, query it back | Row returned |
| Files enabled | `tile.files.put('test/ping.txt', new Blob(['ok']), { scope: 'shared' })` | `{ ok: true }` |
| Files read | `tile.files.get('test/ping.txt', { scope: 'shared' })` | Response with 'ok' body |
| Zero console errors | Load tile, open DevTools | Zero errors |
| Zero network requests | DevTools → Network | No external requests |

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
  owner_email TEXT NOT NULL,
  registered_at TEXT NOT NULL,
  next_due_at TEXT NOT NULL,
  tool_file_key TEXT NOT NULL,
  certificate_file_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active'
);
```

`status` is computed on read (compare `next_due_at` to today). It is not stored as a drifting value.

---

## 8. Repository Structure

```
/
├── index.html                          (the whole app — single file)
├── assets/
│   └── security-prompt-v1.md          (the static prompt download, inlined at build time)
├── spec/
│   ├── harrys-garage-spec.md           (this file)
│   └── process-flows/                  (per-journey Mermaid + step-table docs, TBD)
└── .github/
    └── workflows/
        └── deploy.yml
```

The security specification files (`Single-File-HTML-Tool-Blueprint.md`, `Security-Remediation-Checklist.md`, `Remediation-Process.md`) live in the parent HTML audit repository and are referenced, not duplicated.

---

## 9. Outstanding Before Build

| Item | Status | Owner |
|---|---|---|
| Tile slug agreed | ❌ To confirm | Thomas |
| Tile created | ❌ | Thomas |
| SQLite + Files enabled | ❌ | Thomas |
| PAT minted and stored in repo secrets | ❌ | Thomas |
| Process flow diagrams written | ❌ — next step | Thomas + Claude Code |
| Phase 2 go/no-go decision | Deferred | Thomas |
