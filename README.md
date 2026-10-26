# HTML Garage

**Harry and Tony's Motor Licencing Garage — making solutions roadworthy since 2026**

A client-side HTML security certification tool deployed on the Accenture Tile platform. Solution owners use it to run automated security checks (C1–C9) against their HTML tools, remediate issues, and obtain a formal certification record.

**Live site:** https://tile.accenture.com/view/html-garage/  
**Test site:** https://tile.accenture.com/view/harry-s-html-garage-test/

Created by Tom Hensby and Davin Libert Lewis.

---

## What it does

- **Security Prompts** — downloadable checklist for Claude AI remediation
- **Certify** — intake, automated pre/post scan (checks C1–C9), certificate + CMMYY code
- **Filing Cabinet** — registry of all certified solutions
- **Change of Ownership** — transfer a solution to a new owner
- **Retire** — close out a solution from the registry

---

## Repository structure

```
harrys-garage.html          Source HTML (no embedded images — run embed-images.ps1 first)
images/                     IMG-01.png through IMG-12.png (pixel art scenes)
scripts/
  embed-images.ps1          Build step: embeds images as base64 data URIs into the HTML
  deploy-test.ps1           Deploy to test site (requires YOUR_TEST_PAT_HERE)
  deploy-prod.ps1           Deploy to prod site (requires YOUR_PROD_PAT_HERE)
docs/
  hmw-image-prompts-v3.md   Image generation prompts (Midjourney / ChatGPT)
  harrys-garage-spec-v2.md  Full feature specification
  process-flow.html         E2E certification process flow diagram
```

---

## Deploy workflow

1. Make changes to `harrys-garage.html`
2. Run `scripts\embed-images.ps1` — produces `harrys-garage-embedded.html`
3. Run `scripts\deploy-test.ps1` — push to test site and review
4. Run `scripts\deploy-prod.ps1` — push to prod once confirmed

**PATs:** Obtain from the Tile dashboard → your page → Settings → Access tokens. Never commit PATs to this repo.

---

## Technology

- Single self-contained HTML file, no build dependencies
- Tile platform SDK (`tile.js`) for SQLite, file storage, and user identity
- SQLite schema: `registrations` table with automatic migration on first load
- Warmlight palette: `#1c440c` (forest olive), `#8a6008` (amber), `#6c1608` (brick maroon)
- Pixel art aesthetic generated with Midjourney / ChatGPT (see `docs/hmw-image-prompts-v3.md`)
