// Headless browser test: Camo Track lock status (Gold / Platinum / Harmonic Break / Divergence)
// and account-wide Divergence.
// usage: npm test (all suites) or: node tests/test-camo-locks.js
const { chromium } = require('playwright-core');
const path = require('path');

const projectDir = process.argv[2] || path.resolve(__dirname, '..'); // the app folder (tests/ lives inside it)
const outDir = path.join(__dirname, 'output'); // screenshots and test files (not committed)
require('fs').mkdirSync(outDir, { recursive: true });
const url = 'file:///' + path.join(projectDir, 'index.html').split(path.sep).join('/');
const KEY = 'mw4-tracker-v1';

let pass = 0, fail = 0;
const check = (label, ok, detail = '') => {
    if (ok) { pass++; console.log('  PASS ' + label); }
    else { fail++; console.log('  FAIL ' + label + (detail ? '  -> ' + detail : '')); }
};

(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error' && !/fonts\.g/.test(m.text())) errors.push(m.text()); });

    const data = await (async () => {
        await page.goto(url);
        return page.evaluate(() => ({
            byType: window.MW4_TRACKER_DATA.weaponsByType,
            all: Object.values(window.MW4_TRACKER_DATA.weaponsByType).flat()
        }));
    })();
    const ARS = data.byType['ASSAULT RIFLES'];          // 9 incl. Cronen Osprey
    const MELEE = data.byType['MELEE'];

    const open = async (seed) => {
        await page.evaluate(([KEY, seed]) => localStorage.setItem(KEY, JSON.stringify(seed)), [KEY, seed]);
        await page.reload();
    };
    const saved = () => page.evaluate(KEY => JSON.parse(localStorage.getItem(KEY)), KEY);
    const track = (map) => Object.fromEntries(Object.entries(map));
    const ui = (gun, view = 'mp') => ({ mode: 'track', view: 'detail', gun, trackMode: view });
    const row = (name) => page.locator('.camo-row', { has: page.locator('.camo-name', { hasText: new RegExp(`^${name}$`) }) });
    const lock = async (name) => (await row(name).locator('.camo-lock').textContent()).trim();
    const lockOpen = async (name) => (await row(name).locator('.camo-lock').getAttribute('class')).includes('open');
    const detail = async (name) => (await row(name).locator('.camo-lock-detail').textContent()).trim();
    const tick = async (name) => row(name).locator('input[type=checkbox]').check();
    const untick = async (name) => row(name).locator('input[type=checkbox]').uncheck();
    const nGuns = (n, camos) => Object.fromEntries(data.all.slice(0, n).map(g => [g, Object.fromEntries(camos.map(c => [c, true]))]));

    // ---------------------------------------------------------------
    console.log('\n1. Text fixes');
    await open({ camos: {}, ui: ui('M4') });
    const unlocks = await page.locator('.camo-row .camo-unlock').allTextContents();
    check('Platinum: "Opens after 8 Gold camos on Assault Rifle weapons"', (await row('PLATINUM').locator('.camo-unlock').textContent()) === 'Opens after 8 Gold camos on Assault Rifle weapons');
    check('Harmonic Break: "Opens after 33 Platinum camos on any weapons (account-wide)"',
        (await row('HARMONIC BREAK').locator('.camo-unlock').textContent()) === 'Opens after 33 Platinum camos on any weapons (account-wide)');
    check('No more "Opens after Platinum" or "every … weapon" wording', !unlocks.some(t => t === 'Opens after Platinum' || /Gold on every/.test(t))
        && !/Harmonic Break challenge on every/.test(await page.locator('#rightPanel').innerText()));
    check('Divergence challenge is account-wide', /Earned once for your account after 33 Harmonic Break challenges/.test(await row('DIVERGENCE').locator('.camo-challenge').textContent()));
    await open({ camos: {}, ui: ui('FSS CARBON EDGE 1095') });
    check('Melee: "Opens after 1 Gold camo on Melee weapons" (singular)', (await row('PLATINUM').locator('.camo-unlock').textContent()) === 'Opens after 1 Gold camo on Melee weapons');
    const perClass = { 'SMGS': 5, 'SHOTGUNS': 2, 'LMGS': 3, 'MARKSMAN RIFLES': 3, 'SNIPER RIFLES': 3, 'PISTOLS': 4, 'LAUNCHERS': 4 };
    const bad = [];
    for (const [type, n] of Object.entries(perClass)) {
        await open({ camos: {}, ui: ui(data.byType[type][0]) });
        const t = await row('PLATINUM').locator('.camo-unlock').textContent();
        if (!t.startsWith(`Opens after ${n} Gold camos`)) bad.push(`${type}: ${t}`);
        const l = await lock('PLATINUM');
        if (!l.includes(`0/${n} `)) bad.push(`${type} lock: ${l}`);
    }
    check('Launch Gold counts per class (SMG 5, Shotgun 2, LMG 3, Marksman 3, Sniper 3, Pistol 4, Launcher 4)', !bad.length, bad.join(' | '));

    // ---------------------------------------------------------------
    console.log('\n2. Gold lock (this weapon\'s Military + Special)');
    await open({ camos: { track: { 'M4': { mil1: true, mil2: true, mil3: true, mil4: true, mil5: true, mil6: true } } }, ui: ui('M4') });
    check('Shows "LOCKED · 6/11 Military + Special done"', (await lock('GOLD')) === 'LOCKED · 6/11 Military + Special done' && !(await lockOpen('GOLD')));
    for (const n of ['MILITARY 7', 'MILITARY 8', 'MYRIAD', 'NIGHT OPS']) await tick(n);
    check('Updates live as boxes are ticked (10/11)', (await lock('GOLD')) === 'LOCKED · 10/11 Military + Special done');
    await tick('GREEN');
    check('All 11 → "✓ OPEN" in green', (await lock('GOLD')) === '✓ OPEN · 11/11 Military + Special done' && await lockOpen('GOLD'));
    await untick('GREEN');
    check('Unticking locks it again', (await lock('GOLD')) === 'LOCKED · 10/11 Military + Special done');

    // ---------------------------------------------------------------
    console.log('\n3. Platinum lock (N Golds in the class)');
    const sixAR = Object.fromEntries(ARS.slice(0, 6).map(g => [g, { gold: true }]));
    await open({ camos: { track: sixAR }, ui: ui('M4') });
    check('6 AR Golds → "LOCKED · 6/8 Assault Rifle Golds"', (await lock('PLATINUM')) === 'LOCKED · 6/8 Assault Rifle Golds');
    const d = await detail('PLATINUM');
    check('Says how many more and which ARs have no Gold', d.startsWith('Need 2 more · no Gold yet: ') && ARS.slice(6).every(g => d.includes(g)), d);
    await open({ camos: { track: { ...sixAR, [ARS[6]]: { gold: true } } }, ui: ui('M4') });
    check('7 Golds → 7/8, need 1 more', (await lock('PLATINUM')) === 'LOCKED · 7/8 Assault Rifle Golds' && (await detail('PLATINUM')).startsWith('Need 1 more'));
    // The 8th Gold is the Cronen Osprey (Season 1 gun) → any 8 of the 9 ARs opens Platinum
    const eightWithOsprey = Object.fromEntries([...ARS.filter(g => g !== 'CRONEN OSPREY').slice(0, 7), 'CRONEN OSPREY'].map(g => [g, { gold: true }]));
    check('Test setup: the 8 include the Season 1 Cronen Osprey', ARS.includes('CRONEN OSPREY') && ARS.length === 9);
    await open({ camos: { track: eightWithOsprey }, ui: ui('M4') });
    check('Any 8 of the 9 ARs (incl. Osprey) → "✓ OPEN · 8/8 Assault Rifle Golds"', (await lock('PLATINUM')) === '✓ OPEN · 8/8 Assault Rifle Golds'
        && await lockOpen('PLATINUM') && await row('PLATINUM').locator('.camo-lock-detail').isHidden());
    await open({ camos: { track: Object.fromEntries(ARS.map(g => [g, { gold: true }])) }, ui: ui('M4') });
    check('All 9 still shows 8/8 (capped)', (await lock('PLATINUM')) === '✓ OPEN · 8/8 Assault Rifle Golds');
    // Live: ticking Gold on this gun's page updates its own Platinum line
    await open({ camos: { track: Object.fromEntries(ARS.filter(g => g !== 'M4').slice(0, 7).map(g => [g, { gold: true }])) }, ui: ui('M4') });
    check('7 others + M4 not yet → 7/8', (await lock('PLATINUM')) === 'LOCKED · 7/8 Assault Rifle Golds');
    await tick('GOLD');
    check('Ticking M4 Gold opens Platinum live', (await lock('PLATINUM')) === '✓ OPEN · 8/8 Assault Rifle Golds');
    await open({ camos: { track: { 'FSS CARBON EDGE 1095': { gold: true } } }, ui: ui('ZLR TALONHAWK') });
    check('Melee: 1 Gold on any melee opens it (even from the other melee weapon)', (await lock('PLATINUM')) === '✓ OPEN · 1/1 Melee Golds');
    await page.screenshot({ path: path.join(outDir, 'locks-melee.png'), fullPage: false });

    // ---------------------------------------------------------------
    console.log('\n4. Harmonic Break lock (33 Platinum, any weapons)');
    await open({ camos: { track: nGuns(12, ['platinum']) }, ui: ui('M4') });
    check('12 Platinums → "LOCKED · 12/33 Platinum camos (any weapon)"', (await lock('HARMONIC BREAK')) === 'LOCKED · 12/33 Platinum camos (any weapon)');
    check('Notes that Season 1 guns are counted', /Season 1 guns included/.test(await row('HARMONIC BREAK').locator('.camo-lock-note').textContent()));
    await open({ camos: { track: nGuns(32, ['platinum']) }, ui: ui(data.all[35]) });
    check('32 → still locked', (await lock('HARMONIC BREAK')) === 'LOCKED · 32/33 Platinum camos (any weapon)');
    await tick('PLATINUM');
    check('Ticking the 33rd Platinum here opens it live', (await lock('HARMONIC BREAK')) === '✓ OPEN · 33/33 Platinum camos (any weapon)' && await lockOpen('HARMONIC BREAK'));

    // ---------------------------------------------------------------
    console.log('\n5. Divergence: account-wide');
    await open({ camos: { track: nGuns(5, ['harmonic']) }, divergence: false, ui: ui('M4') });
    check('Shows "LOCKED · 5/33 Harmonic Breaks (account-wide)"', (await lock('DIVERGENCE')) === 'LOCKED · 5/33 Harmonic Breaks (account-wide)');
    await tick('DIVERGENCE');
    check('Ticking it on M4 → "✓ TICKED (account-wide)"', (await lock('DIVERGENCE')) === '✓ TICKED (account-wide) · 5/33 Harmonic Breaks');
    let s = await saved();
    check('Saved as one account-wide flag', s.divergence === true && !(s.camos.track.M4 || {}).divergence);
    await open({ ...(await saved()), ui: ui('AXION', 'dmz') });
    check('…and shows ticked on another weapon (AXION, DMZ view)', await row('DIVERGENCE').locator('input').isChecked());
    await untick('DIVERGENCE');
    await open({ ...(await saved()), ui: ui('M4') });
    check('Unticking on AXION unticks it on M4 too', !(await row('DIVERGENCE').locator('input').isChecked()) && (await saved()).divergence === false);

    await open({ camos: { track: nGuns(32, ['harmonic']) }, divergence: false, ui: ui(data.all[34]) });
    check('32 Harmonic Breaks: not earned yet', !(await row('DIVERGENCE').locator('input').isChecked()));
    await tick('HARMONIC BREAK');
    check('Ticking the 33rd Harmonic Break → Divergence earned automatically, box locked on', await row('DIVERGENCE').locator('input').isChecked()
        && await row('DIVERGENCE').locator('input').isDisabled() && (await lock('DIVERGENCE')) === '✓ EARNED · 33/33 Harmonic Breaks');
    await page.screenshot({ path: path.join(outDir, 'locks-divergence-earned.png'), fullPage: true });
    await open({ ...(await saved()), ui: ui('M4') });
    check('…including weapons with no Harmonic Break of their own', await row('DIVERGENCE').locator('input').isChecked());
    await open({ ...(await saved()), ui: { mode: 'mastery', view: 'detail' } });
    check('Mastery tab Divergence box agrees (ready, 33)', (await page.locator('.mastery-gate').getAttribute('class')).includes('ready')
        && (await page.locator('.mastery-gate-count').textContent()) === '✓ 33 HARMONIC BREAKS');
    await open({ camos: { track: nGuns(4, ['harmonic']) }, divergence: true, ui: { mode: 'mastery', view: 'detail' } });
    check('Mastery box also counts a ticked Divergence ("✓ TICKED · 4 / 33")', (await page.locator('.mastery-gate').getAttribute('class')).includes('ready')
        && (await page.locator('.mastery-gate-count').textContent()) === '✓ TICKED · 4 / 33 HARMONIC BREAKS');
    await open({ camos: { track: nGuns(4, ['harmonic']) }, divergence: false, ui: { mode: 'mastery', view: 'detail' } });
    check('…and isn\'t ready when neither', !(await page.locator('.mastery-gate').getAttribute('class')).includes('ready'));

    // Full track on one gun reaches the Divergence tier color once Divergence is done account-wide
    const fullM4 = { mil1: true, mil2: true, mil3: true, mil4: true, mil5: true, mil6: true, mil7: true, mil8: true, sp1: true, sp2: true, sp3: true, gold: true, platinum: true, harmonic: true };
    await open({ camos: { track: { M4: fullM4 } }, divergence: true, ui: ui('M4') });
    const m4Item = page.locator('.gun-list-item', { hasText: /^M4/ }).first();
    check('M4 with every camo + account Divergence → Divergence color in the list', (await m4Item.getAttribute('class')).includes('tier-divergence'));
    check('…and 15/15 on its page', /15\/15/.test(await page.locator('.progress-text').textContent()));
    await open({ camos: { track: { M4: fullM4 } }, divergence: false, ui: ui('M4') });
    check('Without Divergence it stops at Harmonic Break', (await m4Item.getAttribute('class')).includes('tier-harmonic'));

    // ---------------------------------------------------------------
    console.log('\n6. Older saves (Divergence ticked per weapon)');
    await open({ camos: { track: { 'ODEN': { divergence: true }, 'M4': { mil1: true } } }, ui: ui('M4') });
    s = await saved();
    check('A Divergence ticked on any weapon → account-wide', s.divergence === true && await row('DIVERGENCE').locator('input').isChecked());
    check('Other progress untouched', s.camos.track.M4.mil1 === true);
    await untick('DIVERGENCE');
    await page.reload();
    check('Converted once (unticking sticks after reload)', !(await row('DIVERGENCE').locator('input').isChecked()));
    await open({ camos: { track: { 'M4': { mil1: true } } }, ui: ui('M4') });
    check('Old save with no Divergence → not ticked', (await saved()).divergence === false);

    // ---------------------------------------------------------------
    console.log('\n7. Both views and phone width');
    await open({ camos: { track: { ...sixAR } }, ui: ui('M4', 'dmz') });
    check('DMZ view shows the same lock lines', (await lock('PLATINUM')) === 'LOCKED · 6/8 Assault Rifle Golds' && (await lock('GOLD')).startsWith('LOCKED · 0/11'));
    await page.locator('.view-toggle button', { hasText: 'MULTIPLAYER' }).click();
    check('Switching to MP keeps them', (await lock('PLATINUM')) === 'LOCKED · 6/8 Assault Rifle Golds');
    check('Military / Special rows have no lock line', await row('MILITARY 1').locator('.camo-lock').count() === 0);
    check('Prestige tab has no lock lines', await (async () => {
        await page.getByRole('button', { name: 'PRESTIGE', exact: true }).click();
        return await page.locator('.camo-lock').count() === 0;
    })());
    await page.getByRole('button', { name: 'CAMO TRACK', exact: true }).click();
    await page.setViewportSize({ width: 600, height: 900 });
    await row('PLATINUM').scrollIntoViewIfNeeded();
    const lb = await row('PLATINUM').locator('.camo-lock').boundingBox();
    const rb = await row('PLATINUM').boundingBox();
    check('Phone width: lock line fits inside its row', lb.x >= rb.x && lb.x + lb.width <= rb.x + rb.width + 1, JSON.stringify({ lb, rb }));
    check('No sideways scrolling', await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth));
    await row('PLATINUM').screenshot({ path: path.join(outDir, 'locks-platinum-phone.png') });
    await page.setViewportSize({ width: 1400, height: 1000 });
    await page.locator('.camo-section', { hasText: 'COMPLETIONIST' }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(outDir, 'locks-completionist.png') });

    console.log('\nJS errors on the page: ' + (errors.length ? '\n  ' + errors.join('\n  ') : 'none'));
    console.log(`\n${pass} passed, ${fail} failed`);
    await browser.close();
    process.exit(fail || errors.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
