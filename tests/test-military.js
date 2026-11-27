// Headless browser test: Military 1-8 show "Reach weapon level N" for every gun.
// usage: npm test (all suites) or: node tests/test-military.js
const { chromium } = require('playwright-core');
const path = require('path');

const projectDir = process.argv[2] || path.resolve(__dirname, '..'); // the app folder (tests/ lives inside it)
const outDir = path.join(__dirname, 'output'); // screenshots and test files (not committed)
require('fs').mkdirSync(outDir, { recursive: true });
const url = 'file:///' + path.join(projectDir, 'index.html').split(path.sep).join('/');
const KEY = 'mw4-tracker-v1';

// The approved levels (researched 27 Nov 2026; M4 Military 1 = 10 confirmed in game).
// Kept here on purpose, separate from mw4-data.js, so a wrong edit to the data is caught.
const EXPECTED = {
    'HAN 86': [10, 18, 25, 34, 42, 50, 57, 65],
    'M4': [10, 18, 26, 35, 39, 44, 51, 59],
    'KASTOV 762': [10, 19, 27, 37, 45, 54, 61, 67],
    'AXION': [10, 19, 26, 34, 41, 48, 55, 62],
    'CRONEN SQUALL': [10, 17, 24, 31, 39, 45, 54, 60],
    'CRONEN OSPREY': [9, 13, 16, 20, 23, 26, 29, 33],
    'PATRIOT XMR': [11, 20, 28, 36, 43, 52, 59, 66],
    'ODEN': [12, 21, 25, 33, 39, 46, 53, 59],
    'HYEON BURST': [10, 17, 26, 32, 40, 49, 55, 62],
    'WZ.55 STRIGA': [12, 18, 23, 29, 36, 41, 47, 54],
    'X-58 NYX': [9, 15, 20, 25, 29, 35, 42, 47],
    'CSG-35': [8, 10, 14, 17, 19, 23, 27, 29],
    'ISO NIGHTSHADE': [12, 19, 25, 31, 38, 44, 50, 57],
    'PPSH-41': [11, 17, 23, 31, 38, 44, 51, 57],
    'VEL 46': [9, 15, 22, 28, 33, 40, 47, 54],
    'REZI-12': [11, 18, 26, 30, 38, 42, 47, 54],
    'JAK 12': null,
    'WARLORD': [13, 19, 25, 30, 37, 43, 49, 55],
    'FINN LMG': [12, 18, 24, 31, 37, 42, 48, 53],
    'TYPE 73': [12, 19, 26, 34, 41, 48, 55, 61],
    'APOC-338': [9, 15, 22, 26, 33, 40, 44, 51],
    'MAR-9': [10, 19, 29, 38, 45, 52, 58, 69],
    'ORIS 8.6': [11, 18, 27, 33, 42, 49, 55, 61],
    'MOSIN-NAGANT': [10, 17, 25, 31, 38, 47, 55, 61],
    'SIGNAL 50': [10, 18, 28, 35, 43, 52, 57, 67],
    'KG-7 VULCAN': [13, 22, 31, 38, 47, 54, 61, 69],
    'ASTAROTH .57': [10, 15, 20, 26, 32, 37, 42, 48],
    'SANG 9MM': [9, 13, 17, 21, 25, 28, 31, 35],
    'KRAIT P68': [10, 14, 18, 22, 25, 28, 32, 35],
    '.50 GS': [10, 16, 22, 28, 32, 36, 40, 46],
    'MOJAVE .357': [9, 13, 18, 22, 26, 30, 35, 40],
    'RPG-8': [6, 11, 16, 21, 26, 31, 36, 41],
    'PILA': [6, 11, 16, 21, 26, 31, 36, 41],
    'JOKR': [6, 11, 16, 21, 26, 31, 36, 41],
    'PM-40 ANVIL': [6, 11, 16, 21, 26, 31, 36, 41],
    'FSS CARBON EDGE 1095': [6, 11, 16, 21, 26, 31, 36, 41],
    'ZLR TALONHAWK': null
};
const NOT_PUBLISHED = 'Unlock level not published yet (level up this weapon)';

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
    const militaryTexts = () => page.locator('.camo-row', { has: page.locator('.camo-name', { hasText: /^MILITARY \d$/ }) })
        .evaluateAll(rows => rows.map(r => [r.querySelector('.camo-name').textContent, (r.querySelector('.camo-challenge') || {}).textContent || '']));

    await page.goto(url);

    // ---------------------------------------------------------------
    console.log('\n1. Data file');
    const data = await page.evaluate(() => ({
        guns: Object.values(window.MW4_TRACKER_DATA.weaponsByType).flat(),
        weapons: window.MW4_TRACKER_DATA.weapons
    }));
    check('Every gun in the tracker has expected levels in this test (37)', data.guns.length === 37 && data.guns.every(g => g in EXPECTED),
        data.guns.filter(g => !(g in EXPECTED)).join(', '));
    const notAscending = Object.entries(EXPECTED).filter(([, l]) => l && l.some((v, i) => i && v <= l[i - 1])).map(([g]) => g);
    check('Every known ladder goes up level by level', !notAscending.length, notAscending.join(', '));

    // ---------------------------------------------------------------
    console.log('\n2. Every gun, both views, shows "Reach weapon level N"');
    const wrong = [];
    for (const gun of data.guns) {
        for (const view of ['mp', 'dmz']) {
            await open({ ui: { mode: 'track', view: 'detail', gun, trackMode: view } });
            const rows = await militaryTexts();
            const want = EXPECTED[gun];
            const ok = rows.length === 8 && rows.every(([name, text], i) =>
                name === `MILITARY ${i + 1}` && text === (want ? `Reach weapon level ${want[i]}` : NOT_PUBLISHED));
            if (!ok) wrong.push(`${gun} (${view}): ${rows.map(r => r[1]).join(' | ')}`);
        }
    }
    check('All 37 guns × MP and DMZ views: 8 rows each, right level in order', !wrong.length, wrong.slice(0, 5).join('\n      '));
    const published = data.guns.filter(g => EXPECTED[g]).length;
    check(`${published} guns have every level filled in; only JAK 12 and ZLR Talonhawk are unpublished`,
        published === 35 && EXPECTED['JAK 12'] === null && EXPECTED['ZLR TALONHAWK'] === null);

    // ---------------------------------------------------------------
    console.log('\n3. Spot checks');
    await open({ ui: { mode: 'track', view: 'detail', gun: 'M4', trackMode: 'mp' } });
    let rows = await militaryTexts();
    check('M4 Military 1 = level 10 (matches the game)', rows[0][1] === 'Reach weapon level 10');
    check('M4 Military 8 = level 59', rows[7][1] === 'Reach weapon level 59');
    await page.screenshot({ path: path.join(outDir, 'military-m4.png') });
    await open({ ui: { mode: 'track', view: 'detail', gun: 'X-58 NYX', trackMode: 'dmz' } });
    rows = await militaryTexts();
    check('X-58 NYX is no longer scrambled (9 … 47)', rows[0][1] === 'Reach weapon level 9' && rows[3][1] === 'Reach weapon level 25' && rows[7][1] === 'Reach weapon level 47');
    await open({ ui: { mode: 'track', view: 'detail', gun: 'JAK 12', trackMode: 'mp' } });
    rows = await militaryTexts();
    check('JAK 12 says the level isn\'t published yet', rows.every(r => r[1] === NOT_PUBLISHED));

    // ---------------------------------------------------------------
    console.log('\n4. Saved progress is untouched');
    await open({ camos: { track: { 'M4': { mil1: true, mil3: true }, 'CSG-35': { mil8: true } } }, ui: { mode: 'track', view: 'detail', gun: 'M4', trackMode: 'mp' } });
    const box = (n) => page.locator('.camo-row', { has: page.locator('.camo-name', { hasText: new RegExp(`^MILITARY ${n}$`) }) }).locator('input[type=checkbox]');
    check('Ticked Military camos stay ticked', await box(1).isChecked() && !(await box(2).isChecked()) && await box(3).isChecked());
    await box(2).check();
    const s = await page.evaluate(KEY => JSON.parse(localStorage.getItem(KEY)), KEY);
    check('Ticking still saves under the same ids (mil1…mil8)', s.camos.track.M4.mil2 === true && s.camos.track['CSG-35'].mil8 === true);
    const m4Item = await page.locator('.gun-list-item', { hasText: 'M4' }).first().innerText();
    check('Weapon list count updates (3/15)', m4Item.includes('3/15'), m4Item.replace(/\n/g, ' '));

    // ---------------------------------------------------------------
    console.log('\n5. Phone width');
    await page.setViewportSize({ width: 600, height: 900 });
    await open({ ui: { mode: 'track', view: 'detail', gun: 'KG-7 VULCAN', trackMode: 'mp' } });
    rows = await militaryTexts();
    check('Levels show at phone width', rows[7][1] === 'Reach weapon level 69');
    check('No sideways scrolling', await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth));

    console.log('\nJS errors on the page: ' + (errors.length ? '\n  ' + errors.join('\n  ') : 'none'));
    console.log(`\n${pass} passed, ${fail} failed`);
    await browser.close();
    process.exit(fail || errors.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
