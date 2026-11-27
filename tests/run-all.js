// Runs every browser test suite, one after another, and prints a summary.
// usage: cd tests && npm test        (first time: npm install)
//
// The suites drive the real app (index.html) in headless Microsoft Edge through
// playwright-core, so Edge must be installed (it is on Windows by default).
// Screenshots and files the tests create go to tests/output/.
const { spawnSync } = require('child_process');
const path = require('path');

const suites = [
    ['test-weapons.js', 'DMZ weapon cards + Season 1 camos'],
    ['test-camo-locks.js', 'Camo Track lock status + account-wide Divergence'],
    ['test-military.js', 'Military camo unlock levels (all guns)'],
    ['test-special-levels.js', 'Special camo unlock levels (all guns)'],
    ['test-weapon-level.js', 'SET LEVEL menu (level + prestige auto-ticks)'],
    ['test-warzone.js', 'Warzone view (all guns, shared ticks)'],
    ['test-notes.js', 'Notes & Materials: layout, shopping list, messages, sorting'],
    ['test-upgrades.js', '3D Printer upgrades + costs'],
    ['test-mastery.js', 'Mastery tab'],
    ['test-backup.js', 'Export / Reset / Import']
];

let totalPass = 0;
let totalFail = 0;
const results = [];
for (const [file, label] of suites) {
    console.log(`\n=== ${label} (${file}) ===`);
    const run = spawnSync(process.execPath, [path.join(__dirname, file)], { encoding: 'utf8' });
    const out = (run.stdout || '') + (run.stderr || '');
    process.stdout.write(out);
    const m = out.match(/(\d+) passed, (\d+) failed/);
    const passed = m ? Number(m[1]) : 0;
    const failed = m ? Number(m[2]) : 0;
    const crashed = !m;
    totalPass += passed;
    totalFail += failed;
    results.push({ label, passed, failed, ok: run.status === 0, crashed });
}

console.log('\n=== SUMMARY ===');
results.forEach(r => {
    const status = r.ok ? 'OK  ' : 'FAIL';
    console.log(`${status} ${r.label}: ${r.crashed ? 'crashed (see output above)' : `${r.passed} passed, ${r.failed} failed`}`);
});
console.log(`\n${totalPass} passed, ${totalFail} failed across ${results.length} suites`);
process.exit(results.every(r => r.ok) ? 0 : 1);
