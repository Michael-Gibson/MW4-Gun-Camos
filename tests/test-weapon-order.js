// Headless browser test: weapons are listed in the in-game order and with in-game names,
// and progress saved under an old name ("REZI-12") moves to the new one ("REZI 12").
// usage: npm test (all suites) or: node tests/test-weapon-order.js
const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');

const projectDir = process.argv[2] || path.resolve(__dirname, '..'); // the app folder (tests/ lives inside it)
const outDir = path.join(__dirname, 'output'); // screenshots and test files (not committed)
fs.mkdirSync(outDir, { recursive: true });
const url = 'file:///' + path.join(projectDir, 'index.html').split(path.sep).join('/');
const KEY = 'mw4-tracker-v1';

// In-game order (DMZ Gunsmith list, checked 27 Nov 2026). Kept here on purpose, separate
// from mw4-data.js, so a wrong edit to the data is caught.
const ORDER = {
    'ASSAULT RIFLES': ['HAN 86', 'M4', 'HYEON BURST', 'KASTOV 762', 'PATRIOT XMR', 'ODEN', 'AXION', 'CRONEN SQUALL', 'CRONEN OSPREY'],
    'SMGS': ['ISO NIGHTSHADE', 'VEL 46', 'WZ.55 STRIGA', 'PPSH-41', 'X-58 NYX', 'CSG-35'],
    'SHOTGUNS': ['REZI 12', 'WARLORD', 'JAK 12'],
    'LMGS': ['FINN LMG', 'TYPE 73', 'APOC-338'],
    'MARKSMAN RIFLES': ['MAR-9', 'ORIS 8.6', 'MOSIN-NAGANT'],
    'SNIPER RIFLES': ['KG-7 VULCAN', 'ASTAROTH .57', 'SIGNAL 50'],
    'PISTOLS': ['SANG 9MM', 'KRAIT P68', '.50 GS', 'MOJAVE .357'],
    'LAUNCHERS': ['PILA', 'RPG-8', 'JOKR', 'PM-40 ANVIL'],
    'MELEE': ['FSS CARBON EDGE 1095', 'ZLR TALONHAWK']
};

let pass = 0, fail = 0;
const check = (label, ok, detail = '') => {
    if (ok) { pass++; console.log('  PASS ' + label); }
    else { fail++; console.log('  FAIL ' + label + (detail ? '  -> ' + detail : '')); }
};

(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error' && !/fonts\.g/.test(m.text())) errors.push(m.text()); });
    page.on('dialog', d => d.accept()); // Import asks "Replace your current progress?"

    const open = async (seed) => {
        await page.evaluate(([KEY, seed]) => localStorage.setItem(KEY, JSON.stringify(seed)), [KEY, seed]);
        await page.reload();
    };
    const saved = () => page.evaluate(KEY => JSON.parse(localStorage.getItem(KEY)), KEY);
    const ticked = (name) => page.locator('.camo-row', { has: page.locator('.camo-name', { hasText: new RegExp(`^${name}$`) }) }).locator('input[type=checkbox]').isChecked();
    const allOpen = { openTypes: [0, 1, 2, 3, 4, 5, 6, 7, 8] };

    await page.goto(url);

    // ---------------------------------------------------------------
    console.log('\n1. Data file');
    const data = await page.evaluate(() => ({ types: window.MW4_TRACKER_DATA.gunTypes, by: window.MW4_TRACKER_DATA.weaponsByType }));
    check('Class order: ARs, SMGs, Shotguns, LMGs, Marksman, Sniper, Pistols, Launchers, Melee',
        data.types.join() === Object.keys(ORDER).join(), data.types.join());
    const wrongClasses = Object.entries(ORDER).filter(([t, guns]) => (data.by[t] || []).join() !== guns.join()).map(([t]) => `${t}: ${(data.by[t] || []).join(', ')}`);
    check('Every class lists its guns in the in-game order', !wrongClasses.length, wrongClasses.join('\n      '));
    check('"REZI 12" (with a space, as in game); no "REZI-12" left', JSON.stringify(data.by).includes('"REZI 12"') && !JSON.stringify(data.by).includes('REZI-12'));

    // ---------------------------------------------------------------
    console.log('\n2. The weapon list and DMZ Loadout cards follow it');
    await open({ ui: { mode: 'track', view: 'detail', gun: 'HAN 86', trackMode: 'mp', ...allOpen } });
    const listed = await page.locator('.gun-type-panel').evaluateAll(ps => ps.map(p => [p.querySelector('.gun-type-name').textContent,
        [...p.querySelectorAll('.gun-list-item .gun-name')].map(n => n.textContent)]));
    const wrongList = listed.filter(([t, guns]) => guns.join() !== (ORDER[t] || []).join()).map(([t, g]) => `${t}: ${g.join(', ')}`);
    check('Camo Track weapon list: in-game order in every class', listed.length === 9 && !wrongList.length, wrongList.join('\n      '));
    await page.screenshot({ path: path.join(outDir, 'order-list.png') });
    await open({ ui: { mode: 'loadout', dmzView: 'weapons', dmzGun: null, ...allOpen } });
    const cards = await page.locator('.dmz-card-name').allTextContents();
    check('DMZ Loadout cards: same order', cards.join() === Object.values(ORDER).flat().join(), cards.slice(0, 9).join(', '));
    await open({ ui: { mode: 'track', view: 'detail', gun: 'M4', trackMode: 'mp' } });
    const plat = await page.locator('.camo-row', { has: page.locator('.camo-name', { hasText: /^PLATINUM$/ }) }).locator('.camo-lock-detail').textContent();
    check('Platinum "no Gold yet" list follows the new order (HAN 86, M4, HYEON BURST, …)', plat.includes('HAN 86, M4, HYEON BURST, KASTOV 762, PATRIOT XMR'), plat);

    // ---------------------------------------------------------------
    console.log('\n3. Progress saved as "REZI-12" moves to "REZI 12"');
    const oldSave = {
        camos: { track: { 'REZI-12': { mil1: true, sp2: true, gold: true } }, prestige: { 'REZI-12': { '0': true } } },
        dmz: { 'REZI-12': { manuals: 2, gunsmith: true, blueprints: [{ name: 'SHORT FUSE', claimed: true, rarity: '' }] } },
        levels: { 'REZI-12': { stage: 1, level: 7 } },
        ui: { mode: 'track', view: 'detail', gun: 'REZI-12', trackMode: 'mp' }
    };
    await open(oldSave);
    let sv = await saved();
    check('Opens on REZI 12 (the gun you had open)', (await page.locator('.right-panel-header h2').first().textContent()) === 'REZI 12' && sv.ui.gun === 'REZI 12');
    check('Camo ticks moved (Military 1, Special 2, Gold)', await ticked('MILITARY 1') && await ticked('WHITE PINE') === false && await ticked('BRUSHSTROKE') && await ticked('GOLD'));
    check('Saved under "REZI 12", old name gone', JSON.stringify(sv.camos.track['REZI 12']) === '{"mil1":true,"sp2":true,"gold":true}'
        && !('REZI-12' in sv.camos.track) && sv.camos.prestige['REZI 12']['0'] === true && !('REZI-12' in sv.camos.prestige));
    check('DMZ loadout moved (2 manuals, Gunsmith, blueprint)', sv.dmz['REZI 12'].manuals === 2 && sv.dmz['REZI 12'].gunsmith === true
        && sv.dmz['REZI 12'].blueprints[0].name === 'SHORT FUSE' && !('REZI-12' in sv.dmz));
    check('Weapon level moved (Prestige 1 · LV 7)', JSON.stringify(sv.levels['REZI 12']) === '{"stage":1,"level":7}' && !('REZI-12' in sv.levels)
        && (await page.locator('.weapon-level-value').textContent()) === 'Prestige 1 · LV 7');
    const reziItem = await page.locator('.gun-list-item', { hasText: 'REZI 12' }).first().textContent();
    check('Weapon list shows 3/15 on REZI 12', reziItem.includes('3/15'), reziItem);
    await page.reload();
    sv = await saved();
    check('Reloading keeps it all (moves once)', sv.camos.track['REZI 12'].sp2 === true && !('REZI-12' in sv.camos.track));
    await open({ ...oldSave, camos: { track: { 'REZI-12': { mil1: true }, 'REZI 12': { mil2: true } } }, ui: { mode: 'track', view: 'detail', gun: 'REZI 12', trackMode: 'mp' } });
    sv = await saved();
    check('If both names are saved, the ticks are combined', sv.camos.track['REZI 12'].mil1 === true && sv.camos.track['REZI 12'].mil2 === true && !('REZI-12' in sv.camos.track));
    await open({ ui: { mode: 'loadout', dmzView: 'weapons', dmzGun: 'REZI-12' }, dmz: { 'REZI-12': { manuals: 1, blueprints: [] } } });
    check('DMZ Loadout page opened on "REZI-12" → opens REZI 12', (await saved()).ui.dmzGun === 'REZI 12');

    // ---------------------------------------------------------------
    console.log('\n4. Importing an old backup');
    await open({ ui: { mode: 'track', view: 'detail', gun: 'HAN 86', trackMode: 'mp' } });
    const backup = path.join(outDir, 'old-rezi-backup.json');
    fs.writeFileSync(backup, JSON.stringify({ camos: { track: { 'REZI-12': { mil3: true } } }, dmz: {}, ui: { mode: 'track', view: 'detail', gun: 'REZI-12', trackMode: 'dmz' } }));
    await Promise.all([page.waitForEvent('load').catch(() => {}), page.locator('#importFile').setInputFiles(backup)]);
    await page.waitForLoadState('load');
    await page.waitForTimeout(300);
    sv = await saved();
    check('An imported backup with "REZI-12" lands on "REZI 12"', sv.camos.track['REZI 12'].mil3 === true && !('REZI-12' in sv.camos.track) && await ticked('MILITARY 3'));

    console.log('\nJS errors on the page: ' + (errors.length ? '\n  ' + errors.join('\n  ') : 'none'));
    console.log(`\n${pass} passed, ${fail} failed`);
    await browser.close();
    process.exit(fail || errors.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
