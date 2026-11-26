const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const context = { console };
context.window = context;
context.globalThis = context;
vm.createContext(context);
for (const name of ['data.js', 'writing.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'src', 'lib', name), 'utf8'), context);
}
const W = context.OPB_WRITING;

const field = { key: 'executing_mission', label: 'Executing the Mission', limit: 350 };
const rawDraft = '  Led "Operation North" across 3 wings—cut delays by 22%.\nSecond line with café & O&M metrics.  ';

// 1. Primary clarity prompt
const primary = W.buildPrompt(field, rawDraft, 'Improve clarity');
assert.match(primary, /^Revise this Air Force Officer Performance Brief narrative\./);
assert.match(primary, /Section: Executing the Mission/);
assert.match(primary, /Character limit: 350, including spaces and punctuation\./);
assert.match(primary, /Keep the revised narrative within the stated character limit\./);
assert.match(primary, /BEGIN DRAFT\n  Led "Operation North" across 3 wings—cut delays by 22%\.\nSecond line with café & O&M metrics\.  \nEND DRAFT$/);

// 2. All four additional prompt options
const expectedGoals = [
  [
    'Improve impact',
    'Make the connection between actions and documented outcomes explicit. Lead with the strongest supported result where appropriate. Clarify the significance of existing evidence without inventing impact.'
  ],
  [
    'Shorten to fit',
    'Remove repetition and filler. Preserve the strongest documented actions, facts, and outcomes. Keep the revised narrative within the stated character limit.'
  ],
  [
    'Expand toward the character limit',
    'Use the available space to clarify documented scope, actions, and outcomes. Approach the stated character limit only as far as the supplied facts support. Avoid padding and invented details. Keep the revised narrative within the limit.'
  ],
  [
    'Polish grammar',
    'Correct grammar, punctuation, and sentence structure while keeping the wording, facts, metrics, and emphasis close to the original. Keep the revised narrative within the stated character limit.'
  ]
];

for (const [label, snippet] of expectedGoals) {
  const built = W.buildPrompt(field, rawDraft, label);
  assert(built.includes(snippet), `Missing expected instruction for ${label}`);
  assert(built.includes(W.BASE_PROMPT_INSTRUCTION), `Missing base instruction for ${label}`);
  assert(built.endsWith(`BEGIN DRAFT\n${rawDraft}\nEND DRAFT`), `Draft not preserved verbatim for ${label}`);
}

// 3. Official AFPC Oct 28, 2024 lookup (148 live verified entries)
const approved = W.getApprovedEntries();
assert.equal(approved.size, 148, 'Expected 148 verified AFPC entries');
for (const okTerm of ['AFI', 'O&M', 'C2', 'AFSO21', 'C4ISR', 'JADC2', 'FTEC', 'QOL', 'XAB']) {
  assert(approved.has(okTerm), `Expected ${okTerm} in official lookup`);
}
assert(!approved.has('DEIA'), 'DEIA is absent from live AFPC list');

// Approved examples recognized; unknown examples with digits, hyphens, slashes, ampersands flagged
const sample = 'Executed AFI guidance with O&M and C2 oversight; piloted FTEC and QoL initiatives alongside C2/ISR, X-99, R&D, and T3K systems.';
const flagged = Array.from(W.acronymMatches(sample, []), m => m[0]);
assert.deepEqual(flagged, ['C2/ISR', 'X-99', 'R&D', 'T3K']);

// Custom terms suppress local reminders without altering official lookup
const suppressed = Array.from(W.acronymMatches(sample, ['c2/isr', 'r&d']), m => m[0]);
assert.deepEqual(suppressed, ['X-99', 'T3K']);
assert(!W.getApprovedEntries().has('C2/ISR'), 'Official AFPC lookup must remain intact');

// "THIS SECTION NOT USED." should not trigger false acronym warnings
assert.deepEqual(Array.from(W.acronymMatches('THIS SECTION NOT USED.', [])), []);

// Currency magnitudes like $42M or $1.4M should not split into false acronym highlights
assert.deepEqual(Array.from(W.acronymMatches('Stewarded $42M O&M budget; saved $1.4M.', [])), []);

console.log('Passed: prompt formatting, verbatim draft preservation, AFPC snapshot lookup, special-character acronym detection, and custom term suppression.');
