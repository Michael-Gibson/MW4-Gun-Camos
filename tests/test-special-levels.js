// Headless browser test: each Special camo shows "Opens at weapon level N" for every gun.
// usage: npm test (all suites) or: node tests/test-special-levels.js
const { chromium } = require('playwright-core');
const path = require('path');

const projectDir = process.argv[2] || path.resolve(__dirname, '..'); // the app folder (tests/ lives inside it)
const outDir = path.join(__dirname, 'output'); // screenshots and test files (not committed)
require('fs').mkdirSync(outDir, { recursive: true });
const url = 'file:///' + path.join(projectDir, 'index.html').split(path.sep).join('/');
const KEY = 'mw4-tracker-v1';

// The approved levels (researched 27 Nov 2026), in our specialCamos order (0 = not confirmed yet).
// Checked in game by the owner: Cronen Osprey, CSG-35, Kastov 762, Axion, Mosin-Nagant.
// Kept here on purpose, separate from mw4-data.js, so a wrong edit to the data is caught.
const EXPECTED = {
    'HAN 86': [25, 46, 72], 'M4': [26, 51, 72], 'KASTOV 762': [23, 48, 68], 'AXION': [23, 45, 69],
    'CRONEN SQUALL': [24, 45, 67], 'CRONEN OSPREY': [24, 49, 70], 'PATRIOT XMR': [24, 49, 72],
    'ODEN': [25, 44, 65], 'HYEON BURST': [23, 46, 68],
    'WZ.55 STRIGA': [20, 41, 60], 'X-58 NYX': [17, 35, 53], 'CSG-35': [16, 29, 43],
    'ISO NIGHTSHADE': [22, 44, 64], 'PPSH-41': [20, 41, 62], 'VEL 46': [20, 40, 60],
    'REZI-12': [22, 42, 60], 'JAK 12': null, 'WARLORD': [21, 41, 60],
    'FINN LMG': [18, 39, 60], 'TYPE 73': [23, 45, 65], 'APOC-338': [15, 36, 56],
    'MAR-9': [26, 49, 73], 'ORIS 8.6': [27, 49, 70], 'MOSIN-NAGANT': [24, 46, 68],
    'SIGNAL 50': [28, 52, 74], 'KG-7 VULCAN': [22, 47, 75],
    'ASTAROTH .57': [20, 37, 54], 'SANG 9MM': [13, 25, 38], 'KRAIT P68': [13, 25, 38],
    '.50 GS': [18, 34, 50], 'MOJAVE .357': [16, 30, 44],
    'RPG-8': [16, 31, 46], 'PILA': [16, 31, 46], 'JOKR': [16, 31, 46], 'PM-40 ANVIL': [16, 31, 46],
    'FSS CARBON EDGE 1095': [16, 31, 46], 'ZLR TALONHAWK': null
};
const NOT_CONFIRMED = 'Unlock level not confirmed yet';
const NOT_PUBLISHED = 'Not published yet for this weapon';

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

    const open = async (seed) => {
        await page.evaluate(([KEY, seed]) => localStorage.setItem(KEY, JSON.stringify(seed)), [KEY, seed]);
        await page.reload();
    };
    // The 3 Special rows: [name, unlock line]
    const specialRows = () => page.evaluate(() => {
        const all = [...document.querySelectorAll('.camo-row')];
        const mil8 = all.findIndex(r => r.querySelector('.camo-name').textContent === 'MILITARY 8');
        return all.slice(mil8 + 1, mil8 + 4).map(r => [r.querySelector('.camo-name').textContent,
            (r.querySelector('.camo-unlock') || {}).textContent || '']);
    });
    const scrollToSpecial = () => page.evaluate(() => {
        const h = [...document.querySelectorAll('*')].find(e => e.children.length === 0 && e.textContent.trim() === 'SPECIAL');
        if (h) h.scrollIntoView();
    });

    await page.goto(url);

    // ---------------------------------------------------------------
    console.log('\n1. Data file');
    const data = await page.evaluate(() => {
        const D = window.MW4_TRACKER_DATA;
        const guns = Object.values(D.weaponsByType).flat();
        const byGun = Object.assign({}, ...Object.values(D.weapons));
        return { guns, names: Object.fromEntries(guns.map(g => [g, byGun[g].track.filter(c => /^sp\d$/.test(c.id)).map(c => [c.id, c.name])])) };
    });
    check('Every gun in the tracker has expected levels in this test (37)', data.guns.length === 37 && data.guns.every(g => g in EXPECTED),
        data.guns.filter(g => !(g in EXPECTED)).join(', '));
    check('Every gun still has 3 Specials with ids sp1-sp3 (saved progress is safe)',
        data.guns.every(g => data.names[g].map(n => n[0]).join() === 'sp1,sp2,sp3'));

    // ---------------------------------------------------------------
    console.log('\n2. Every gun, both views, shows the right unlock line');
    const wrong = [];
    for (const gun of data.guns) {
        for (const view of ['mp', 'dmz']) {
            await open({ ui: { mode: 'track', view: 'detail', gun, trackMode: view } });
            const rows = await specialRows();
            const want = EXPECTED[gun];
            const ok = rows.length === 3 && rows.every(([, text], i) =>
                text === (!want ? NOT_PUBLISHED : want[i] ? `Opens at weapon level ${want[i]}` : NOT_CONFIRMED));
            if (!ok) wrong.push(`${gun} (${view}): ${rows.map(r => r[1]).join(' | ')}`);
        }
    }
    check('All 37 guns × MP and DMZ views: 3 Specials each, right level in order', !wrong.length, wrong.slice(0, 5).join('\n      '));
    const full = data.guns.filter(g => EXPECTED[g] && EXPECTED[g].every(Boolean)).length;
    check(`${full} guns have all 3 levels (every released gun); JAK 12 and Talonhawk not released`, full === 35);

    // ---------------------------------------------------------------
    console.log('\n3. Spot checks');
    await open({ ui: { mode: 'track', view: 'detail', gun: 'HAN 86', trackMode: 'mp' } });
    let rows = await specialRows();
    check('Han 86 (official): Smoke 25, Stormwave 46, Red 72', rows.map(r => r.join(' ')).join(' / ') ===
        'SMOKE Opens at weapon level 25 / STORMWAVE Opens at weapon level 46 / RED Opens at weapon level 72');
    await scrollToSpecial();
    await page.screenshot({ path: path.join(outDir, 'special-han86.png') });
    await open({ ui: { mode: 'track', view: 'detail', gun: 'SANG 9MM', trackMode: 'dmz' } });
    rows = await specialRows();
    check('Sang 9mm (official): 13, 25, 38', rows.map(r => r[1]).join() === 'Opens at weapon level 13,Opens at weapon level 25,Opens at weapon level 38');
    await open({ ui: { mode: 'track', view: 'detail', gun: 'TYPE 73', trackMode: 'mp' } });
    rows = await specialRows();
    check('Type 73 in in-game order: Ash Pine 23, Outcrop 45, Foxtrail 65', rows.map(r => r.join(' ')).join(' / ') ===
        'ASH PINE Opens at weapon level 23 / OUTCROP Opens at weapon level 45 / FOXTRAIL Opens at weapon level 65');
    await open({ ui: { mode: 'track', view: 'detail', gun: 'REZI-12', trackMode: 'mp' } });
    rows = await specialRows();
    check('Rezi-12 camo is spelled "BRUSHSTROKE"', rows.some(r => r[0] === 'BRUSHSTROKE') && !rows.some(r => r[0] === 'BRUSH STROKE'));
    await open({ ui: { mode: 'track', view: 'detail', gun: 'KASTOV 762', trackMode: 'mp' } });
    rows = await specialRows();
    check('Kastov 762 (from the game): 23, 48, 68', rows.map(r => r[1]).join() === 'Opens at weapon level 23,Opens at weapon level 48,Opens at weapon level 68');
    await open({ ui: { mode: 'track', view: 'detail', gun: 'CRONEN OSPREY', trackMode: 'dmz' } });
    rows = await specialRows();
    check('Cronen Osprey (from the game): In the Weeds 24, Dark Ichor 49, Chained 70', rows.map(r => r.join(' ')).join(' / ') ===
        'IN THE WEEDS Opens at weapon level 24 / DARK ICHOR Opens at weapon level 49 / CHAINED Opens at weapon level 70');
    await open({ ui: { mode: 'track', view: 'detail', gun: 'CSG-35', trackMode: 'mp' } });
    rows = await specialRows();
    check('CSG-35 (from the game): Polyhedron 16, Rind 29, Black Grip 43', rows.map(r => r.join(' ')).join(' / ') ===
        'POLYHEDRON Opens at weapon level 16 / RIND Opens at weapon level 29 / BLACK GRIP Opens at weapon level 43');
    await open({ ui: { mode: 'track', view: 'detail', gun: 'MOSIN-NAGANT', trackMode: 'mp' } });
    rows = await specialRows();
    check('Mosin-Nagant (from the game): 24, 46, 68', rows.map(r => r[1]).join() === 'Opens at weapon level 24,Opens at weapon level 46,Opens at weapon level 68');
    await open({ ui: { mode: 'track', view: 'detail', gun: 'AXION', trackMode: 'dmz' } });
    rows = await specialRows();
    check('Axion (from the game): Sunset Tropic = 45', rows[1][0] === 'SUNSET TROPIC' && rows[1][1] === 'Opens at weapon level 45');
    await open({ ui: { mode: 'track', view: 'detail', gun: 'CRONEN OSPREY', trackMode: 'dmz' } });
    await scrollToSpecial();
    await page.screenshot({ path: path.join(outDir, 'special-osprey.png') });
    await open({ ui: { mode: 'track', view: 'detail', gun: 'JAK 12', trackMode: 'mp' } });
    rows = await specialRows();
    check('JAK 12 (unreleased) still says "Not published yet for this weapon"', rows.every(r => r[1] === NOT_PUBLISHED));

    // ---------------------------------------------------------------
    console.log('\n4. Saved progress is untouched');
    await open({ camos: { track: { 'M4': { sp1: true, sp3: true } } }, ui: { mode: 'track', view: 'detail', gun: 'M4', trackMode: 'mp' } });
    const box = (name) => page.locator('.camo-row', { has: page.locator('.camo-name', { hasText: new RegExp(`^${name}$`) }) }).locator('input[type=checkbox]');
    check('Ticked Special camos stay ticked', await box('MYRIAD').isChecked() && !(await box('NIGHT OPS').isChecked()) && await box('GREEN').isChecked());
    await box('NIGHT OPS').check();
    const s = await page.evaluate(KEY => JSON.parse(localStorage.getItem(KEY)), KEY);
    check('Ticking still saves under the same ids (sp1…sp3)', s.camos.track.M4.sp2 === true && s.camos.track.M4.sp1 === true);

    // ---------------------------------------------------------------
    console.log('\n4b. Type 73 ticks move with their camo (saves from before the reorder)');
    const saved = () => page.evaluate(KEY => JSON.parse(localStorage.getItem(KEY)), KEY);
    // Old order was sp1 Outcrop, sp2 Foxtrail, sp3 Ash Pine. Tick Outcrop + Ash Pine in an old save.
    await open({ camos: { track: { 'TYPE 73': { sp1: true, sp3: true, mil1: true }, 'M4': { sp1: true } } }, ui: { mode: 'track', view: 'detail', gun: 'TYPE 73', trackMode: 'mp' } });
    check('Old save: Outcrop and Ash Pine still ticked, Foxtrail not',
        await box('OUTCROP').isChecked() && await box('ASH PINE').isChecked() && !(await box('FOXTRAIL').isChecked()));
    let sv = await saved();
    const t = () => sv.camos.track['TYPE 73'];
    check('…saved as sp1 (Ash Pine) + sp2 (Outcrop), camoOrder 2, Military untouched',
        sv.camoOrder === 2 && t().sp1 === true && t().sp2 === true && !t().sp3 && t().mil1 === true, JSON.stringify(t()));
    check('…other guns\' Specials untouched (M4 sp1)', sv.camos.track.M4.sp1 === true && !sv.camos.track.M4.sp2);
    await page.reload();
    sv = await saved();
    check('Reloading doesn\'t move them again', t().sp1 === true && t().sp2 === true && !t().sp3
        && await box('OUTCROP').isChecked() && await box('ASH PINE').isChecked());
    await box('FOXTRAIL').check();
    sv = await saved();
    check('Ticking Foxtrail now saves as sp3', t().sp3 === true);
    await open({ camoOrder: 2, camos: { track: { 'TYPE 73': { sp1: true } } }, ui: { mode: 'track', view: 'detail', gun: 'TYPE 73', trackMode: 'mp' } });
    sv = await saved();
    check('A new-order save (camoOrder 2) is left alone: sp1 = Ash Pine', t().sp1 === true && !t().sp2
        && await box('ASH PINE').isChecked() && !(await box('OUTCROP').isChecked()));
    await page.evaluate(KEY => localStorage.removeItem(KEY), KEY);
    await page.reload();
    await page.locator('.camo-row').first().waitFor();
    await page.locator('.camo-row input[type=checkbox]').first().check(); // any save writes the state
    sv = await saved();
    check('A brand-new tracker saves camoOrder 2 (nothing to move)', sv.camoOrder === 2, String(sv.camoOrder));

    // ---------------------------------------------------------------
    console.log('\n5. Phone width');
    await page.setViewportSize({ width: 600, height: 900 });
    await open({ ui: { mode: 'track', view: 'detail', gun: 'KG-7 VULCAN', trackMode: 'mp' } });
    rows = await specialRows();
    check('Levels show at phone width', rows[2][1] === 'Opens at weapon level 75');
    check('No sideways scrolling', await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth));

    console.log('\nJS errors on the page: ' + (errors.length ? '\n  ' + errors.join('\n  ') : 'none'));
    console.log(`\n${pass} passed, ${fail} failed`);
    await browser.close();
    process.exit(fail || errors.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
