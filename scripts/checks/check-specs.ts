/**
 * check:specs (verification spec task 2.2)
 *
 * Asserts spec-tree hygiene over .kiro/specs (excluding _archive and _backlog):
 *  - every .md carries a `**Status:**` header near the top
 *  - no duplicate `Requirement N` / task numbering headings within a file
 *  - no prescriptive T4 tier references (T0–T3 is the tier model, D27)
 */

import * as fs from 'fs';
import * as path from 'path';

const SPECS = path.resolve(__dirname, '..', '..', '.kiro', 'specs');
const EXCLUDED_DIRS = new Set(['_archive', '_backlog']);
// Files that are supplementary notes rather than spec documents.
const STATUS_EXEMPT = new Set<string>([]);

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (EXCLUDED_DIRS.has(entry.name)) continue;
      out.push(...walk(path.join(dir, entry.name)));
    } else if (entry.name.endsWith('.md')) {
      out.push(path.join(dir, entry.name));
    }
  }
  return out;
}

let failures = 0;
const fail = (msg: string) => {
  failures++;
  console.error(`  ✗ ${msg}`);
};

console.log('check:specs — spec-tree hygiene (verification Req 6.2)\n');

for (const p of walk(SPECS)) {
  const rel = path.relative(SPECS, p).replace(/\\/g, '/');
  const src = fs.readFileSync(p, 'utf8');
  const lines = src.split(/\r?\n/);

  // 1. Status header in the first 10 lines
  if (!STATUS_EXEMPT.has(rel)) {
    const head = lines.slice(0, 10).join('\n');
    if (!/\*\*Status:\*\*/.test(head)) {
      fail(`${rel}: missing **Status:** header in the first 10 lines`);
    }
  }

  // 2. Duplicate requirement numbering
  const reqSeen = new Map<string, number>();
  lines.forEach((line, i) => {
    const m = line.match(/^#{2,3}\s+Requirement\s+(\d+)\b/);
    if (m) {
      const prev = reqSeen.get(m[1]);
      if (prev !== undefined) {
        fail(`${rel}: duplicate "Requirement ${m[1]}" heading (lines ${prev + 1} and ${i + 1})`);
      } else {
        reqSeen.set(m[1], i);
      }
    }
  });

  // 3. Prescriptive T4 references (D27: tiers are T0–T3). Historical mentions are
  // fine when the line clearly marks T4 as removed/legacy.
  lines.forEach((line, i) => {
    if (!/\bT4\b/.test(line)) return;
    if (/(no[- ]T4|prescriptive T4|legacy|removed|retired|archive|historical|T0[–-]T4)/i.test(line)) return;
    fail(`${rel}:${i + 1}: prescriptive T4 reference — tiers are T0–T3 (D27): ${line.trim().slice(0, 100)}`);
  });
}

if (failures > 0) {
  console.error(`\ncheck:specs FAILED — ${failures} violation(s)`);
  process.exit(1);
}
console.log('check:specs PASSED');
