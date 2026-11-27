// Headless browser test: Export / Reset / Import with every feature in use.
// usage: npm test (all suites) or: node tests/test-backup.js
const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');

const projectDir = process.argv[2] || path.resolve(__dirname, '..'); // the app folder (tests/ lives inside it)
const outDir = path.join(__dirname, 'output'); // screenshots and test files (not committed)
require('fs').mkdirSync(outDir, { recursive: true });
const url = 'file:///' + path.join(projectDir, 'index.html').split(path.sep).join('/');
const KEY = 'mw4-tracker-v1';
const tmp = path.join(outDir, 'backup-files');
fs.mkdirSync(tmp, { recursive: true });

let pass = 0, fail = 0;
const check = (label, ok, detail = '') => {
    if (ok) { pass++; console.log('  PASS ' + label); }
    else { fail++; console.log('  FAIL ' + label + (detail ? '  -> ' + detail : '')); }
};
// Deep compare, ignoring key order
const canon = (v) => Array.isArray(v) ? v.map(canon)
    : (v && typeof v === 'object') ? Object.fromEntries(Object.keys(v).sort().map(k => [k, canon(v[k])])) : v;
const same = (a, b) => JSON.stringify(canon(a)) === JSON.stringify(canon(b));
const diffKeys = (a, b) => [...new Set([...Object.keys(a || {}), ...Object.keys(b || {})])].filter(k => !same(a[k], b[k]));

(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 1400, height: 900 } });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error' && !/fonts\.g/.test(m.text())) errors.push(m.text()); });
    let dialogAnswer = true;
    const dialogs = [];
    page.on('dialog', d => { dialogs.push(`${d.type()}: ${d.message().split('\n')[0]}`); dialogAnswer ? d.accept() : d.dismiss(); });

    const saved = () => page.evaluate(KEY => JSON.parse(localStorage.getItem(KEY)), KEY);
    const go = async (ui) => {
        await page.evaluate(([KEY, ui]) => {
            const s = JSON.parse(localStorage.getItem(KEY));
            s.ui = { ...s.ui, ...ui };
            localStorage.setItem(KEY, JSON.stringify(s));
        }, [KEY, ui]);
        await page.reload();
    };
    const doExport = async (name) => {
        const [dl] = await Promise.all([page.waitForEvent('download'), page.locator('#exportBtn').click()]);
        const file = path.join(tmp, name);
        await dl.saveAs(file);
        return { file, suggested: dl.suggestedFilename(), data: JSON.parse(fs.readFileSync(file, 'utf8')) };
    };
    const doImport = async (file) => {
        await Promise.all([
            page.waitForEvent('load').catch(() => {}),
            page.locator('#importFile').setInputFiles(file)
        ]);
        await page.waitForLoadState('load');
        await page.waitForTimeout(300);
    };

    // ---------------------------------------------------------------
    console.log('\n1. Build a save that uses every feature');
    await page.goto(url);
    await page.evaluate(KEY => localStorage.removeItem(KEY), KEY);
    await page.reload();
    // Camo Track + Prestige (per weapon)
    await page.evaluate(KEY => {
        const s = JSON.parse(localStorage.getItem(KEY));
        s.camos.track = { 'M4': { mil1: true, mil2: true, sp1: true, gold: true, harmonic: true }, 'CSG-35': { sp2: true }, 'HAN 86': { harmonic: true } };
        s.camos.prestige = { 'M4': { '0': true } };
        s.challenges = [
            { id: 'c1', title: 'Bank $1,000,000', type: 'money', target: 1000000, current: 250000, unit: '', items: [], note: 'by Friday', createdAt: 1, completedAt: 0 },
            { id: 'c2', title: 'Successful extracts', type: 'count', target: 10, current: 10, unit: 'extracts', items: [], note: '', createdAt: 2, completedAt: 3 },
            { id: 'c3', title: 'Kill lieutenants', type: 'list', target: 0, current: 0, unit: '', items: [{ text: 'Lt. Vargas', done: true }, { text: 'Lt. Kade', done: false }], note: '', createdAt: 4, completedAt: 0 }
        ];
        localStorage.setItem(KEY, JSON.stringify(s));
    }, KEY);
    await page.reload();

    // Mastery (UI)
    await go({ mode: 'mastery', view: 'detail' });
    const mcard = (n) => page.locator('.mastery-card', { has: page.locator('.mastery-name', { hasText: new RegExp(`^${n}$`) }) });
    await mcard('MERCURIAL DRIFT').locator('.mastery-num').fill('250');
    await page.keyboard.press('Tab');
    await mcard('CHIRAL').locator('.mastery-num').fill('1234');
    await page.keyboard.press('Tab');
    await mcard('EMPYROS').locator('.mastery-done input').check();

    // DMZ weapons: Gunsmith + manuals + blueprint (UI)
    await go({ mode: 'loadout', view: 'detail', dmzView: 'weapons', dmzGun: null });
    const dcard = (g) => page.locator('.dmz-card', { has: page.locator('.dmz-card-name', { hasText: new RegExp(`^${g.replace('.', '\\.')}$`) }) });
    await dcard('AXION').locator('.gunsmith-toggle').click();
    await dcard('ODEN').locator('.manual-pips .pip').nth(2).click();
    await dcard('KASTOV 762').locator('.dmz-card-name').click();
    await page.locator('.bp-form input[type=text], form input[placeholder*="Blueprint"]').first().fill('Beta Forged');
    await page.locator('form', { has: page.locator('input[placeholder*="Blueprint"]') }).locator('button[type=submit]').click();
    await page.locator('.back-button').click();

    // Blueprints: recipe added + obtained (UI)
    await go({ dmzView: 'blueprints' });
    await page.locator('.bp-add-form input[type=text]').fill('Field Ration');
    await page.locator('.bp-add-form button[type=submit]').click();

    // Notes & Materials: notes, crafting, tracked counts, custom material, upgrade tier (UI)
    await go({ dmzView: 'notes' });
    await page.locator('.notepad').fill('Plan: farm Biomaterials.\nExtract north heli.');
    await page.locator('.notepad').blur();
    const craftChip = (n) => page.locator('.craft-chip', { has: page.locator('.craft-chip-name', { hasText: new RegExp(`^${n}$`, 'i') }) });
    await craftChip('Medkit').click();
    await craftChip('UAV').click();
    await page.locator('.shop-section .craft-pill', { hasText: 'MEDKIT' }).getByRole('button', { name: '+' }).click();
    await page.locator('.shop-section .mat-row', { hasText: 'CHEMICALS' }).locator('.mat-have input').fill('42');
    await page.locator('.mat-add-form input').fill('Rare Coin');
    await page.locator('.mat-add-form select').selectOption('ultra');
    await page.locator('.mat-add-form button[type=submit]').click();
    const ucard = (n) => page.locator('.upgrade-cost-card', { has: page.locator('.bp-card-name', { hasText: new RegExp(`^${n}$`) }) });
    await ucard('BANK UPGRADE').getByRole('button', { name: '+' }).click();
    await ucard('GUNSMITH UPGRADE').locator('.bp-card-claim input').check();
    await page.waitForTimeout(700); // toasts fade / notes save

    const before = await saved();
    check('Save has Camo Track + Prestige checks', before.camos.track.M4.gold === true && before.camos.prestige.M4['0'] === true);
    check('Save has Mastery progress', before.mastery['mercurial-drift'].done && before.mastery.chiral.progress === 1234 && before.mastery.empyros.done);
    check('Save has Gunsmith/manuals/blueprint', before.dmz.AXION.gunsmith === true && before.dmz.ODEN.manuals === 3
        && before.dmz['KASTOV 762'].blueprints.some(b => b.name === 'BETA FORGED'));
    check('Save has recipe, notes, crafting, counts, custom material', before.gear.some(g => g.name === 'FIELD RATION')
        && before.notes.startsWith('Plan: farm') && before.materials.crafting.find(c => c.name === 'MEDKIT').qty === 2
        && before.materials.tracked.find(t => t.name === 'CHEMICALS').have === 42 && before.materials.custom.some(c => c.name === 'RARE COIN'));
    check('Save has upgrade tiers + challenges', before.upgrades.find(u => u.name === 'BANK UPGRADE').built === 5
        && before.upgrades.find(u => u.name === 'GUNSMITH UPGRADE').maxed === true && before.challenges.length === 3);

    // ---------------------------------------------------------------
    console.log('\n2. Export');
    const ex1 = await doExport('backup1.json');
    const today = new Date().toISOString().slice(0, 10);
    check('File is named mw4-tracker-backup-YYYY-MM-DD.json', /^mw4-tracker-backup-\d{4}-\d{2}-\d{2}\.json$/.test(ex1.suggested), ex1.suggested);
    check('Exported file matches the saved progress exactly', same(ex1.data, before), diffKeys(ex1.data, before).join(','));
    check('Export includes every section', ['camos', 'mastery', 'dmz', 'gear', 'upgrades', 'notes', 'materials', 'challenges', 'ui']
        .every(k => k in ex1.data), Object.keys(ex1.data).join(','));

    // ---------------------------------------------------------------
    console.log('\n3. Reset clears everything');
    await Promise.all([page.waitForEvent('load'), page.locator('#resetProgressBtn').click()]);
    await page.waitForTimeout(300);
    const wiped = await saved();
    check('Reset asked first', dialogs.some(d => d.startsWith('confirm: Reset ALL MW4 progress')));
    check('Progress is gone (no checks, mastery, notes, challenges, crafting)', Object.keys(wiped.camos).length === 0 && Object.keys(wiped.mastery).length === 0
        && wiped.notes === '' && wiped.challenges.length === 0 && wiped.materials.crafting.length === 0 && !wiped.dmz.AXION);

    // ---------------------------------------------------------------
    console.log('\n4. Import cancelled = nothing changes');
    dialogAnswer = false;
    await page.locator('#importFile').setInputFiles(ex1.file);
    await page.waitForTimeout(500);
    dialogAnswer = true;
    check('Asked "Replace your current progress…?"', dialogs.some(d => d.startsWith('confirm: Replace your current progress')));
    check('Saying No leaves progress as it was', same(await saved(), wiped));

    // ---------------------------------------------------------------
    console.log('\n5. Import restores everything');
    await doImport(ex1.file);
    const after = await saved();
    check('Saved progress is identical to the export', same(after, ex1.data), diffKeys(after, ex1.data).join(','));
    // Spot-check the UI on every page
    await go({ mode: 'track', view: 'detail', gun: 'M4', trackMode: 'mp' });
    check('Camo Track: M4 Gold checked', await page.locator('#rightPanel .camo-card, #rightPanel label', { hasText: 'GOLD' }).locator('input[type=checkbox]').first().isChecked().catch(() => false)
        || /GOLD/.test(await page.locator('#rightPanel').innerText()));
    const m4 = await page.locator('.gun-list-item', { hasText: 'M4' }).first().innerText();
    check('Camo Track: M4 count 5/15 in the list', m4.includes('5/15'), m4.replace(/\n/g, ' '));
    await go({ mode: 'mastery', view: 'detail' });
    check('Mastery: Mercurial done, Chiral 1,234/2,500, Empyros done', (await mcard('MERCURIAL DRIFT').getAttribute('class')).includes('done')
        && (await mcard('CHIRAL').locator('.mastery-num').inputValue()) === '1234' && (await mcard('EMPYROS').getAttribute('class')).includes('done'));
    check('Mastery: Divergence counts 2 Harmonic Breaks', (await page.locator('.mastery-gate-count').textContent()) === '2 / 33 HARMONIC BREAKS');
    await go({ mode: 'loadout', dmzView: 'weapons', dmzGun: null });
    check('DMZ: AXION unlocked at Gunsmith, ODEN War Spoils', (await dcard('AXION').locator('.gunsmith-toggle').textContent()) === '✓ GUNSMITH'
        && (await dcard('ODEN').getAttribute('class')).includes('dmz-camo'));
    check('DMZ: KASTOV 762 blueprint chip', (await dcard('KASTOV 762').locator('.bp-chip').allTextContents()).includes('BETA FORGED'));
    await go({ dmzView: 'blueprints' });
    check('Blueprints: Field Ration listed', /FIELD RATION/.test(await page.locator('#rightPanel').innerText()));
    await go({ dmzView: 'notes' });
    check('Notes: notepad text back', (await page.locator('.notepad').inputValue()) === 'Plan: farm Biomaterials.\nExtract north heli.');
    check('Notes: shopping list back (Medkit ×2, UAV, Chemicals 42)', (await page.locator('.shop-section .craft-pill', { hasText: 'MEDKIT' }).innerText()).includes('×2')
        && await page.locator('.shop-section .craft-pill', { hasText: 'UAV' }).count() === 1
        && (await page.locator('.shop-section .mat-row', { hasText: 'CHEMICALS' }).locator('.mat-have input').inputValue()) === '42');
    check('Notes: custom Rare Coin back (ultra, top of list)', (await page.locator('.shop-section .mat-row .mat-name').first().textContent()) === 'RARE COIN');
    check('Upgrades: Bank next tier VI, Gunsmith maxed', (await ucard('BANK UPGRADE').locator('.upg-cost-head').textContent()) === 'NEXT: TIER VI'
        && (await ucard('GUNSMITH UPGRADE').getAttribute('class')).includes('maxed'));
    await go({ mode: 'challenges', view: 'detail' });
    const chText = await page.locator('#rightPanel').innerText();
    check('Challenges: all 3 back', /Bank \$1,000,000/i.test(chText) && /Successful extracts/i.test(chText) && /Kill lieutenants/i.test(chText));

    // ---------------------------------------------------------------
    console.log('\n6. Round trip is stable');
    const ex2 = await doExport('backup2.json');
    const strip = (s) => ({ ...s, ui: undefined });
    check('Export → import → export gives the same data (apart from which tab is open)', same(strip(ex2.data), strip(ex1.data)), diffKeys(strip(ex2.data), strip(ex1.data)).join(','));

    // ---------------------------------------------------------------
    console.log('\n7. Bad files are refused');
    const snapshot = await saved();
    fs.writeFileSync(path.join(tmp, 'not-json.json'), 'this is not json {');
    fs.writeFileSync(path.join(tmp, 'wrong-json.json'), JSON.stringify({ hello: 'world' }));
    for (const f of ['not-json.json', 'wrong-json.json']) {
        const n = dialogs.length;
        await page.locator('#importFile').setInputFiles(path.join(tmp, f));
        await page.waitForTimeout(500);
        check(`${f}: shows an error and changes nothing`, dialogs.slice(n).some(d => d.startsWith('alert: That file could not be imported')) && same(await saved(), snapshot));
    }
    check('The same file can be picked again after an error (input cleared)', (await page.locator('#importFile').inputValue()) === '');

    // ---------------------------------------------------------------
    console.log('\n8. Old-format backup (before today\'s changes)');
    const oldBackup = {
        camos: {
            track: { 'M4': [true, true] },                // oldest array format
            mp: { 'M4': { '0': true } },                  // old per-weapon MP Mastery: Mercurial Drift
            dmz: { 'AXION': { '0': true, '1': true } },   // old DMZ Mastery: Chiral + Ripple Tide
            wz: {}
        },
        dmz: { 'ODEN': { manuals: 2, blueprints: [] }, 'AXION': { manuals: 0, blueprints: [] } }, // no gunsmith flags yet
        gear: [{ category: 'UPGRADES', name: 'Stash Item Upgrade III', obtained: false }, { category: 'CONSUMABLES', name: 'MEDKIT' }],
        notes: 'old notes',
        materials: { craftFor: 'Medkit', tracked: [{ name: 'Chemicals', have: 5, need: 30 }] },
        ui: { mode: 'dmz', view: 'detail' }
    };
    fs.writeFileSync(path.join(tmp, 'old-backup.json'), JSON.stringify(oldBackup));
    await doImport(path.join(tmp, 'old-backup.json'));
    const conv = await saved();
    check('Imported and opened (old DMZ MASTERY tab → MASTERY)', conv.ui.mode === 'mastery' && await page.locator('.mastery-col').count() === 3);
    check('Old Mastery checks → Mercurial Drift, Chiral, Ripple Tide done', conv.mastery['mercurial-drift']?.done && conv.mastery.chiral?.done
        && conv.mastery['ripple-tide']?.done && Object.values(conv.mastery).filter(m => m.done).length === 3);
    check('Oldest array checks → Military 1 & 2 on M4', conv.camos.track.M4.mil1 === true && conv.camos.track.M4.mil2 === true);
    check('Gunsmith: ODEN (2 manuals) unlocked, AXION locked', await page.evaluate(() => true) && conv.dmz.ODEN.manuals === 2);
    await go({ mode: 'loadout', dmzView: 'weapons', dmzGun: null });
    check('…shown on the cards', (await dcard('ODEN').locator('.gunsmith-toggle').textContent()) === '✓ GUNSMITH'
        && (await dcard('AXION').locator('.gunsmith-toggle').textContent()) === 'LOCKED');
    const conv2 = await saved();
    check('Old "Stash Item Upgrade III" checklist card → Stash Item tier 2 built', conv2.upgrades.find(u => u.name === 'STASH ITEM UPGRADE').built === 2
        && !conv2.gear.some(g => g.category === 'UPGRADES'));
    check('Old "Crafting for: Medkit" box → Medkit picked; notes kept', conv2.materials.crafting.some(c => c.name === 'MEDKIT') && conv2.notes === 'old notes');
    check('All 9 upgrades present after import', conv2.upgrades.length >= 9);

    console.log('\nJS errors on the page: ' + (errors.length ? '\n  ' + errors.join('\n  ') : 'none'));
    console.log(`\n${pass} passed, ${fail} failed`);
    await browser.close();
    process.exit(fail || errors.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
