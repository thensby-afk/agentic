/**
 * Security & regression verification for remediated single-file HTML tools.
 *
 * Usage:
 *   node verify-remediated.js                           — verify all files in 2 - Remediated HTMLs/
 *   node verify-remediated.js <path-to-file.html>       — verify one specific file
 *
 * Requires: npm install (in this directory), then npx playwright install chromium
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const PROJECT_ROOT = path.join(__dirname, '..');
const REMEDIATED_DIR = path.join(PROJECT_ROOT, '2 - Remediated HTMLs');
const REPORTS_DIR = path.join(PROJECT_ROOT, '3 - Remediation reports');

// ── Security checks ──────────────────────────────────────────────────────────

const REQUIRED_CSP_DIRECTIVES = [
  "connect-src 'none'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
];

async function verifyFile(filePath) {
  const fileName = path.basename(filePath);
  const result = { file: fileName, path: filePath, passed: [], failed: [], warnings: [], timestamp: new Date().toISOString() };

  // ── Static checks (no browser needed) ──────────────────────────────────────
  const source = fs.readFileSync(filePath, 'utf8');

  // S1: No external script tags
  const extScripts = [...source.matchAll(/<script[^>]+src\s*=\s*["']https?:\/\//gi)].map(m => m[0].slice(0, 80));
  if (extScripts.length === 0) {
    result.passed.push('S1: No external <script src> tags');
  } else {
    result.failed.push(`S1: External script tags found: ${extScripts.join(' | ')}`);
  }

  // S2: No external stylesheet links
  const extStyles = [...source.matchAll(/<link[^>]+href\s*=\s*["']https?:\/\//gi)].map(m => m[0].slice(0, 80));
  if (extStyles.length === 0) {
    result.passed.push('S2: No external <link href> stylesheet tags');
  } else {
    result.failed.push(`S2: External stylesheet links found: ${extStyles.join(' | ')}`);
  }

  // S3: CSP meta tag present
  // Use [\s\S] so the pattern spans multi-line meta tags; use [^"]+ so single
  // quotes inside 'none'/'unsafe-inline' don't terminate the capture group.
  const cspMatch = source.match(/<meta[\s\S]*?http-equiv\s*=\s*["']Content-Security-Policy["'][\s\S]*?content\s*=\s*"([^"]+)"/i)
                || source.match(/<meta[\s\S]*?content\s*=\s*"([^"]+)"[\s\S]*?http-equiv\s*=\s*["']Content-Security-Policy["']/i);
  if (cspMatch) {
    result.passed.push('S3: CSP meta tag present');
    const cspContent = cspMatch[1];
    for (const directive of REQUIRED_CSP_DIRECTIVES) {
      if (cspContent.includes(directive)) {
        result.passed.push(`S3a: CSP includes '${directive}'`);
      } else {
        result.failed.push(`S3a: CSP missing '${directive}' (found: ${cspContent.slice(0, 120)})`);
      }
    }
  } else {
    result.failed.push('S3: CSP meta tag missing entirely');
  }

  // S4: Referrer-policy
  if (/<meta[^>]+name\s*=\s*["']referrer["'][^>]*content\s*=\s*["']no-referrer["']/i.test(source)
   || /<meta[^>]+content\s*=\s*["']no-referrer["'][^>]*name\s*=\s*["']referrer["']/i.test(source)) {
    result.passed.push('S4: Referrer-policy: no-referrer present');
  } else {
    result.failed.push('S4: Referrer-policy meta tag missing or not set to no-referrer');
  }

  // S5: No eval() in executable code (warn if found outside comments)
  const evalInCode = countOutsideComments(source, /\beval\s*\(/g);
  if (evalInCode === 0) {
    result.passed.push('S5: No eval() in executable code');
  } else {
    result.failed.push(`S5: eval() found ${evalInCode} time(s) outside comments`);
  }

  // S6: No new Function() in executable code
  const newFnInCode = countOutsideComments(source, /new\s+Function\s*\(/g);
  if (newFnInCode === 0) {
    result.passed.push('S6: No new Function() in executable code');
  } else {
    result.failed.push(`S6: new Function() found ${newFnInCode} time(s) outside comments`);
  }

  // S7: No fetch/XHR/WebSocket in executable code
  const networkInCode = countOutsideComments(source, /\bfetch\s*\(|\bXMLHttpRequest\b|\bnew\s+WebSocket\b|\bsendBeacon\b/g);
  if (networkInCode === 0) {
    result.passed.push('S7: No network API calls (fetch/XHR/WebSocket/sendBeacon) in executable code');
  } else {
    result.failed.push(`S7: Network API calls found ${networkInCode} time(s) outside comments`);
  }

  // S8: innerHTML usage — warn if present (requires manual review)
  const innerHTMLCount = countOutsideComments(source, /\.innerHTML\s*=/g);
  if (innerHTMLCount === 0) {
    result.passed.push('S8: No innerHTML assignments in executable code');
  } else {
    result.warnings.push(`S8: ${innerHTMLCount} innerHTML assignment(s) found — verify each uses esc() or builds static markup only`);
  }

  // S9: Formula injection guard in CSV export (warn if CSV export exists without guard)
  const hasCSVExport = /\.csv|createObjectURL|download/i.test(source);
  const hasFormulaGuard = /\besc\s*\(|\/\^\[=\+\\-@\]\/|neutrali|formulaGuard|csvCell/i.test(source);
  if (hasCSVExport && !hasFormulaGuard) {
    result.warnings.push('S9: Tool appears to export CSV but no formula-injection guard pattern detected — check csvCell() or equivalent');
  } else if (hasCSVExport) {
    result.passed.push('S9: CSV export with formula-injection guard detected');
  }

  // ── Browser checks ──────────────────────────────────────────────────────────
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    const consoleErrors = [];
    const cspViolations = [];
    const networkRequests = [];

    page.on('console', msg => {
      if (msg.type() === 'error') {
        const text = msg.text();
        if (text.includes('Content Security Policy')) {
          cspViolations.push(text.slice(0, 200));
        } else {
          consoleErrors.push(text.slice(0, 200));
        }
      }
    });

    page.on('request', req => {
      const url = req.url();
      if (!url.startsWith('file://') && !url.startsWith('data:') && url !== 'about:blank') {
        networkRequests.push(url);
      }
    });

    const fileUrl = 'file:///' + filePath.replace(/\\/g, '/');
    await page.goto(fileUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
    // Brief wait for any deferred scripts
    await page.waitForTimeout(1500);

    // B1: Zero console errors
    if (consoleErrors.length === 0) {
      result.passed.push('B1: Zero JS console errors on load');
    } else {
      result.failed.push(`B1: Console errors: ${consoleErrors.slice(0, 3).join(' | ')}`);
    }

    // B2: Zero network requests
    if (networkRequests.length === 0) {
      result.passed.push('B2: Zero external network requests');
    } else {
      result.failed.push(`B2: External requests made: ${networkRequests.join(' | ')}`);
    }

    // B3: No CSP violations fired
    if (cspViolations.length === 0) {
      result.passed.push('B3: No CSP violations in console');
    } else {
      result.failed.push(`B3: CSP violations: ${cspViolations.slice(0, 3).join(' | ')}`);
    }

    // B4: Page has visible content (not blank)
    const hasContent = await page.evaluate(() => document.body && document.body.innerText.trim().length > 20);
    if (hasContent) {
      result.passed.push('B4: Page renders with visible content');
    } else {
      result.warnings.push('B4: Page body appears empty — may require data file to be loaded (expected for data-driven tools)');
    }

    await browser.close();
  } catch (err) {
    if (browser) await browser.close().catch(() => {});
    result.failed.push(`Browser checks failed: ${err.message}`);
  }

  return result;
}

// ── Helper: count pattern occurrences outside HTML/JS comments ────────────────
function countOutsideComments(source, pattern) {
  // Strip single-line comments and block comments from JS, then count
  // This is approximate — sufficient for audit purposes
  const stripped = source
    .replace(/<!--[\s\S]*?-->/g, ' ')   // HTML comments
    .replace(/\/\*[\s\S]*?\*\//g, ' ')  // block comments
    .replace(/\/\/[^\n]*/g, ' ');       // line comments
  const matches = stripped.match(pattern);
  return matches ? matches.length : 0;
}

// ── Report output ─────────────────────────────────────────────────────────────
function formatResult(result) {
  const status = result.failed.length === 0 ? 'PASS' : 'FAIL';
  const lines = [
    `\n${'═'.repeat(72)}`,
    `FILE: ${result.file}`,
    `STATUS: ${status}  |  ${result.passed.length} passed, ${result.failed.length} failed, ${result.warnings.length} warnings`,
    `${'─'.repeat(72)}`,
  ];
  result.failed.forEach(f => lines.push(`  ✗ ${f}`));
  result.warnings.forEach(w => lines.push(`  ⚠ ${w}`));
  if (result.failed.length === 0) {
    lines.push('  All security checks passed.');
  }
  return lines.join('\n');
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const arg = process.argv[2];
  let files;

  if (arg) {
    const resolved = path.resolve(arg);
    if (!fs.existsSync(resolved)) {
      console.error(`File not found: ${resolved}`);
      process.exit(1);
    }
    files = [resolved];
  } else {
    if (!fs.existsSync(REMEDIATED_DIR)) {
      console.error(`Remediated directory not found: ${REMEDIATED_DIR}`);
      process.exit(1);
    }
    files = fs.readdirSync(REMEDIATED_DIR)
      .filter(f => f.toLowerCase().endsWith('.html'))
      .map(f => path.join(REMEDIATED_DIR, f));
    if (files.length === 0) {
      console.log('No HTML files found in 2 - Remediated HTMLs/');
      process.exit(0);
    }
  }

  console.log(`\npstack verify-html-tools — ${files.length} file(s)\n`);

  const allResults = [];
  for (const file of files) {
    process.stdout.write(`Checking: ${path.basename(file)} ...`);
    const result = await verifyFile(file);
    allResults.push(result);
    const status = result.failed.length === 0 ? ' PASS' : ' FAIL';
    console.log(status);
    if (result.failed.length > 0 || result.warnings.length > 0) {
      console.log(formatResult(result));
    }
  }

  // Summary
  const passCount = allResults.filter(r => r.failed.length === 0).length;
  console.log(`\n${'═'.repeat(72)}`);
  console.log(`SUMMARY: ${passCount}/${allResults.length} files passed all security checks`);
  console.log(`${'═'.repeat(72)}\n`);

  // Save JSON results for report inclusion
  if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR, { recursive: true });
  const stamp = new Date().toISOString().slice(0, 10);
  const baseName = allResults.length === 1
    ? allResults[0].file.replace(/\.html$/i, '')
    : 'all-files';
  const jsonPath = path.join(REPORTS_DIR, `${stamp}_${baseName}_verification.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(allResults, null, 2), 'utf8');
  console.log(`Results saved: ${jsonPath}`);

  process.exit(allResults.some(r => r.failed.length > 0) ? 1 : 0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
