// Headless browser test: one account-wide MASTERY tab (MP / DMZ / Warzone).
// usage: npm test (all suites) or: node tests/test-mastery.js
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
    page.on('dialog', d => d.accept());

    const open = async (seed) => {
        await page.goto(url);
        await page.evaluate(([KEY, seed]) => seed ? localStorage.setItem(KEY, JSON.stringify(seed)) : localStorage.removeItem(KEY), [KEY, seed]);
        await page.reload();
    };
    const saved = () => page.evaluate(KEY => JSON.parse(localStorage.getItem(KEY)), KEY);
    const tabTexts = () => page.locator('#tabsContainer button').allTextContents();
    const col = (label) => page.locator('.mastery-col', { has: page.locator('h3', { hasText: new RegExp(`^${label}`) }) });
    const card = (name) => page.locator('.mastery-card', { has: page.locator('.mastery-name', { hasText: new RegExp(`^${name}$`) }) });
    const cls = async (name) => (await card(name).getAttribute('class')) || '';
    const status = async (name) => (await card(name).locator('.mastery-status').textContent()).trim();
    const prog = async (name) => card(name).locator('.mastery-num').inputValue();

    // ---------------------------------------------------------------
    console.log('\n1. Tabs');
    await open(null);
    const tabs = await tabTexts();
    check('One MASTERY tab; no MP / DMZ / WARZONE MASTERY tabs', tabs.includes('MASTERY') && !tabs.some(t => /MP MASTERY|DMZ MASTERY|WARZONE MASTERY/.test(t)), tabs.join(' | '));
    check('Order: CAMO TRACK, PRESTIGE, MASTERY, then DMZ LOADOUT…', JSON.stringify(tabs.slice(0, 4)) === JSON.stringify(['CAMO TRACK', 'PRESTIGE', 'MASTERY', 'DMZ LOADOUT']), tabs.join(' | '));
    await page.getByRole('button', { name: 'MASTERY', exact: true }).click();
    check('MASTERY tab is active', (await page.getByRole('button', { name: 'MASTERY', exact: true }).getAttribute('class')).includes('active'));
    check('Weapon list is hidden (not per weapon)', await page.locator('.left-panel').isHidden());
    check('Says it is account-wide', /account-wide/i.test(await page.locator('.panel-subtitle').first().innerText()));

    // ---------------------------------------------------------------
    console.log('\n2. Layout and challenges');
    const labels = await page.locator('.mastery-col h3').evaluateAll(ns => ns.map(n => n.firstChild.textContent.trim()));
    check('Three columns: MULTIPLAYER, DMZ, WARZONE', JSON.stringify(labels) === JSON.stringify(['MULTIPLAYER', 'DMZ', 'WARZONE']), labels.join(','));
    const boxes = await page.locator('.mastery-col').evaluateAll(ns => ns.map(n => n.getBoundingClientRect().top));
    check('Side by side at full width', Math.abs(boxes[0] - boxes[1]) < 2 && Math.abs(boxes[1] - boxes[2]) < 2);
    const data = await page.evaluate(() => window.MW4_TRACKER_DATA.masteryModes);
    const bad = [];
    for (const m of data) {
        const names = await col(m.label).locator('.mastery-name').allTextContents();
        if (JSON.stringify(names) !== JSON.stringify(m.camos.map(c => c.name))) bad.push(`${m.label} order ${names}`);
        for (const [i, c] of m.camos.entries()) {
            const ch = await card(c.name).locator('.mastery-challenge').textContent();
            const req = await card(c.name).locator('.mastery-requires').textContent();
            const tgt = await card(c.name).locator('.mastery-target').textContent();
            if (ch !== c.challenge) bad.push(`${c.name} challenge "${ch}"`);
            const wantReq = i ? `After ${m.camos[i - 1].name}` : 'After DIVERGENCE';
            if (req !== wantReq) bad.push(`${c.name} requires "${req}"`);
            if (tgt !== `/ ${c.target.toLocaleString('en-US')} ${c.unit.toUpperCase()}`) bad.push(`${c.name} target "${tgt}"`);
        }
    }
    check('All 9 camos: right order, challenge, "After …" and target', !bad.length, bad.join(' | '));
    check('Example: Helio needs 25,000 kills', (await card('HELIO').locator('.mastery-target').textContent()) === '/ 25,000 KILLS'
        && (await status('HELIO')) === '25,000 LEFT');
    check('Fresh save: first camo in each mode is "current", the rest locked',
        (await cls('MERCURIAL DRIFT')).includes('current') && (await cls('CHIRAL')).includes('current') && (await cls('PARALLAX')).includes('current')
        && (await cls('POLYATOMIC REFORGED')).includes('locked') && (await cls('EMPYROS')).includes('locked'));
    check('Header 0/9 DONE, columns 0/3', (await page.locator('.mastery-total').textContent()) === '0/9 DONE'
        && (await col('MULTIPLAYER').locator('.recipe-count').textContent()) === '0/3');

    // ---------------------------------------------------------------
    console.log('\n3. Progress counters');
    await card('MERCURIAL DRIFT').getByRole('button', { name: '+' }).click();
    check('+ adds 1', (await prog('MERCURIAL DRIFT')) === '1' && (await status('MERCURIAL DRIFT')) === '249 LEFT');
    await card('MERCURIAL DRIFT').getByRole('button', { name: '+' }).click({ modifiers: ['Shift'] });
    check('Shift + "+" adds 10', (await prog('MERCURIAL DRIFT')) === '11');
    await card('MERCURIAL DRIFT').getByRole('button', { name: '−' }).click();
    check('− takes 1 off', (await prog('MERCURIAL DRIFT')) === '10');
    check('Saved', (await saved()).mastery['mercurial-drift'].progress === 10);

    const inp = card('MERCURIAL DRIFT').locator('.mastery-num');
    await inp.click();
    await inp.fill('');
    await inp.pressSequentially('248');
    check('Typing keeps the cursor in the box', await inp.evaluate(n => document.activeElement === n));
    check('…and updates the count as you type', (await status('MERCURIAL DRIFT')) === '2 LEFT' && (await saved()).mastery['mercurial-drift'].progress === 248);
    await page.keyboard.press('Tab');
    await card('MERCURIAL DRIFT').getByRole('button', { name: '+' }).click();
    await card('MERCURIAL DRIFT').getByRole('button', { name: '+' }).click();
    check('Reaching 250 ticks Done automatically', await card('MERCURIAL DRIFT').locator('.mastery-done input').isChecked()
        && (await status('MERCURIAL DRIFT')) === '✓ DONE' && (await saved()).mastery['mercurial-drift'].done === true);
    check('Done card takes the Mastery 1 color', (await cls('MERCURIAL DRIFT')).includes('done') && (await cls('MERCURIAL DRIFT')).includes('tier-m1'));
    check('Next camo (Polyatomic) becomes "current"', (await cls('POLYATOMIC REFORGED')).includes('current'));
    check('Counts update: header 1/9, MULTIPLAYER 1/3', (await page.locator('.mastery-total').textContent()) === '1/9 DONE'
        && (await col('MULTIPLAYER').locator('.recipe-count').textContent()) === '1/3');

    // ---------------------------------------------------------------
    console.log('\n4. Done checkbox');
    await card('CHIRAL').locator('.mastery-done input').check();
    check('Ticking Done at 0 progress marks it done (full bar)', (await cls('CHIRAL')).includes('done')
        && (await card('CHIRAL').locator('.mat-progress-fill').evaluate(n => n.style.width)) === '100%' && (await prog('CHIRAL')) === '0');
    check('…and opens Ripple Tide', (await cls('RIPPLE TIDE')).includes('current'));
    await card('CHIRAL').locator('.mastery-done input').uncheck();
    check('Unticking undoes it (progress kept)', !(await cls('CHIRAL')).includes('done') && (await cls('RIPPLE TIDE')).includes('locked')
        && (await saved()).mastery['chiral'].done === false);
    await card('EMPYROS').locator('.mastery-done input').check();
    check('A later camo can be ticked even if the one before isn\'t (if you did it already)', (await cls('EMPYROS')).includes('done') && (await cls('EMPYROS')).includes('tier-m3'));
    await page.reload();
    check('All of it is saved across reload', (await cls('MERCURIAL DRIFT')).includes('done') && (await cls('EMPYROS')).includes('done')
        && (await prog('MERCURIAL DRIFT')) === '250' && !(await cls('CHIRAL')).includes('done'));

    // ---------------------------------------------------------------
    console.log('\n5. Divergence (33 Harmonic Breaks)');
    const seedHB = async (n) => {
        const guns = await page.evaluate(() => Object.values(window.MW4_TRACKER_DATA.weaponsByType).flat());
        const track = {};
        guns.slice(0, n).forEach(g => { track[g] = { harmonic: true }; });
        await open({ camos: { track }, mastery: {}, ui: { mode: 'mastery', view: 'detail' } });
    };
    await seedHB(12);
    check('Counts Harmonic Breaks from the Camo Track (12 / 33)', (await page.locator('.mastery-gate-count').textContent()) === '12 / 33 HARMONIC BREAKS'
        && !(await page.locator('.mastery-gate').getAttribute('class')).includes('ready'));
    await seedHB(33);
    check('At 33 it shows ready (purple, ✓)', (await page.locator('.mastery-gate-count').textContent()) === '✓ 33 HARMONIC BREAKS'
        && (await page.locator('.mastery-gate').getAttribute('class')).includes('ready'));
    await page.getByRole('button', { name: 'CAMO TRACK', exact: true }).click();
    check('Camo Track tab still per weapon (weapon list shown)', await page.locator('.left-panel').isVisible() && await page.locator('.gun-list-item').count() === 37);
    await page.getByRole('button', { name: 'PRESTIGE', exact: true }).click();
    check('Prestige tab still per weapon', await page.locator('.left-panel').isVisible() && /PYROCLAST/.test(await page.locator('#rightPanel').innerText()));

    // ---------------------------------------------------------------
    console.log('\n6. Older saves (per-weapon Mastery tabs)');
    await open({
        camos: { mp: { 'M4': { '0': true }, 'AXION': {} }, dmz: { 'ODEN': { '1': true } }, wz: { 'HAN 86': {} }, track: { 'M4': { mil1: true } } },
        ui: { mode: 'mp', view: 'detail' }
    });
    check('An old MP MASTERY tab opens as MASTERY', (await page.getByRole('button', { name: 'MASTERY', exact: true }).getAttribute('class')).includes('active')
        && (await saved()).ui.mode === 'mastery');
    check('Mercurial Drift ticked on any weapon → done overall', (await cls('MERCURIAL DRIFT')).includes('done'));
    check('Ripple Tide ticked on a DMZ weapon → done overall', (await cls('RIPPLE TIDE')).includes('done'));
    check('Nothing else marked done', (await page.locator('.mastery-card.done').count()) === 2);
    let s = await saved();
    check('Converted progress saved; old checks and Camo Track kept', s.mastery['mercurial-drift'].done && s.mastery['ripple-tide'].done
        && s.camos.mp.M4['0'] === true && s.camos.track.M4.mil1 === true);
    await card('RIPPLE TIDE').locator('.mastery-done input').uncheck();
    await page.reload();
    check('Conversion only happens once (unticking sticks after reload)', !(await cls('RIPPLE TIDE')).includes('done'));
    await open({ ui: { mode: 'wz', view: 'detail' } });
    check('An old WARZONE MASTERY tab opens as MASTERY', (await saved()).ui.mode === 'mastery' && await page.locator('.mastery-col').count() === 3);
    // The very first save format stored checkboxes as arrays by position
    await open({ camos: { wz: { 'M4': [false, true, false] }, track: { 'M4': [true] } }, ui: { mode: 'mastery', view: 'detail' } });
    check('Oldest save format (arrays) converts too: Damascus Reforged done', (await cls('DAMASCUS REFORGED')).includes('done')
        && (await page.locator('.mastery-card.done').count()) === 1);
    check('…and its Camo Track checks still convert', (await saved()).camos.track.M4.mil1 === true);

    // ---------------------------------------------------------------
    console.log('\n7. Stats, export, phone');
    await open({ mastery: { 'parallax': { done: true, progress: 300 }, 'helio': { done: true, progress: 0 } }, ui: { mode: 'mastery', view: 'detail' } });
    await page.getByRole('button', { name: 'STATS', exact: true }).click();
    const stats = await page.locator('.stat-card').allInnerTexts();
    check('Stats show MASTERY 2/9 (22.2%) and no per-mode Mastery', stats.some(t => /MASTERY · 2\/9/.test(t) && /22\.2%/.test(t)) && !stats.some(t => /MP MASTERY|WARZONE MASTERY/.test(t)), stats.join(' || ').replace(/\n/g, ' '));
    const [dl] = await Promise.all([page.waitForEvent('download'), page.locator('#exportBtn').click()]);
    const exported = JSON.parse(require('fs').readFileSync(await dl.path(), 'utf8'));
    check('Export includes Mastery progress', exported.mastery && exported.mastery.parallax.done === true);
    await page.getByRole('button', { name: 'MASTERY', exact: true }).click();
    await page.setViewportSize({ width: 600, height: 900 });
    const b0 = await page.locator('.mastery-col').nth(0).boundingBox(), b1 = await page.locator('.mastery-col').nth(1).boundingBox();
    check('Phone width: modes stack (MP above DMZ)', b1.y > b0.y + b0.height - 1 && Math.abs(b0.x - b1.x) < 2);
    check('No sideways scrolling', await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth));

    console.log('\nJS errors on the page: ' + (errors.length ? '\n  ' + errors.join('\n  ') : 'none'));
    console.log(`\n${pass} passed, ${fail} failed`);
    await browser.close();
    process.exit(fail || errors.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
