// Headless browser test: the SET LEVEL menu (weapon level + prestige) on the Camo Track and
// Prestige tabs. Saving ticks the Military and Prestige camos the gun has reached.
// usage: npm test (all suites) or: node tests/test-weapon-level.js
const { chromium } = require('playwright-core');
const path = require('path');

const projectDir = process.argv[2] || path.resolve(__dirname, '..'); // the app folder (tests/ lives inside it)
const outDir = path.join(__dirname, 'output'); // screenshots and test files (not committed)
require('fs').mkdirSync(outDir, { recursive: true });
const url = 'file:///' + path.join(projectDir, 'index.html').split(path.sep).join('/');
const KEY = 'mw4-tracker-v1';

// M4: Military 10, 18, 26, 35, 44, 51, 59, 64; Specials MYRIAD 26, NIGHT OPS 51, GREEN 72
// Prestige camos (saved by position "0"-"3"): PYROCLAST, TERMINUS, SCATTER, CASCADE
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
    const track = (gun, view = 'mp') => ({ ui: { mode: 'track', view: 'detail', gun, trackMode: view } });
    const saved = () => page.evaluate(KEY => JSON.parse(localStorage.getItem(KEY)), KEY);
    const card = () => page.locator('.weapon-level');
    const value = () => page.locator('.weapon-level-value').textContent();
    const hint = () => page.locator('.weapon-level-hint').textContent();
    const menu = () => page.locator('dialog.level-menu');
    const menuOpen = async () => (await menu().count()) > 0 && await menu().isVisible();
    const stageBtn = (label) => menu().locator('.segment', { hasText: new RegExp(`^${label}$`) });
    // Open the menu, pick a stage, type a level and save
    const setLevel = async (stage, level) => {
        await page.locator('.weapon-level-btn').click();
        await stageBtn(stage).click();
        await menu().locator('.level-menu-input').fill(String(level));
        await menu().locator('.level-menu-save').click();
    };
    const row = (name) => page.locator('.camo-row', { has: page.locator('.camo-name', { hasText: new RegExp(`^${name}$`) }) });
    const ticked = (name) => row(name).locator('input[type=checkbox]').isChecked();
    const levelLine = async (name) => {
        const l = row(name).locator('.level-lock');
        if (!(await l.count())) return null;
        return (await l.isVisible()) ? await l.textContent() : '(hidden)';
    };
    const listItem = (gun) => page.locator('.gun-list-item', { has: page.locator('.gun-name', { hasText: new RegExp(`^${gun.replace(/[.]/g, '\\.')}$`) }) });
    const badge = async (gun) => {
        const b = listItem(gun).locator('.gun-badge');
        return (await b.isVisible()) ? await b.textContent() : '';
    };
    const lastToast = async () => (await page.locator('.toast').first().count()) ? (await page.locator('.toast').first().innerText()).replace(/\n/g, ' | ') : '';
    const clearToasts = () => page.evaluate(() => document.querySelectorAll('.toast').forEach(t => t.remove()));
    const mil = (n) => `MILITARY ${n}`;
    const PRESTIGE = ['PYROCLAST', 'PYROCLAST TERMINUS', 'PYROCLAST SCATTER', 'PYROCLAST CASCADE'];
    const goPrestige = () => page.locator('button', { hasText: /^PRESTIGE$/ }).first().click(); // same gun stays open
    const goTrack = () => page.locator('button', { hasText: /^CAMO TRACK$/ }).first().click();

    await page.goto(url);

    // ---------------------------------------------------------------
    console.log('\n1. Before a level is set');
    await open(track('M4'));
    check('WEAPON LEVEL card on the Camo Track: "Not set" + SET LEVEL button',
        await card().count() === 1 && (await value()) === 'Not set' && await page.locator('.weapon-level-btn').textContent() === 'SET LEVEL');
    check('Hint explains it', (await hint()).startsWith('Click SET LEVEL'), await hint());
    check('No level lines on rows, no LV badge', await page.locator('.level-lock').count() === 0 && (await badge('M4')) === '');
    await goPrestige();
    check('The card is on the Prestige tab too', await card().count() === 1);
    const prestigeTexts = await page.locator('.camo-row').evaluateAll(rows => rows.map(r => [r.querySelector('.camo-name').textContent, (r.querySelector('.camo-challenge') || {}).textContent || '']));
    check('Prestige tab shows how to get each camo', JSON.stringify(prestigeTexts) === JSON.stringify([
        ['PYROCLAST', 'Reach Weapon Prestige 1'],
        ['PYROCLAST TERMINUS', 'Reach Weapon Prestige 1 Max Level (this moves the gun into Prestige Master)'],
        ['PYROCLAST SCATTER', 'Reach Weapon Prestige Master Level 150'],
        ['PYROCLAST CASCADE', 'Reach Weapon Prestige Master Level 250']]), JSON.stringify(prestigeTexts));
    await page.screenshot({ path: path.join(outDir, 'level-prestige-tab-empty.png') });
    await goTrack();

    // ---------------------------------------------------------------
    console.log('\n2. The menu');
    await page.locator('.weapon-level-btn').click();
    check('SET LEVEL opens the menu, titled with the gun', await menuOpen() && (await menu().locator('.level-menu-title').textContent()) === 'M4');
    check('It asks "Have you prestiged this gun?" with NO / PRESTIGE 1 / PRESTIGE MASTER',
        (await menu().locator('.level-menu-q').textContent()) === 'Have you prestiged this gun?'
        && (await menu().locator('.segment').allTextContents()).join() === 'NO,PRESTIGE 1,PRESTIGE MASTER');
    check('Starts on NO, asking for "Weapon level", with the cursor in the box',
        await stageBtn('NO').evaluate(e => e.classList.contains('active')) && (await menu().locator('.level-menu-label').textContent()) === 'Weapon level'
        && await page.evaluate(() => document.activeElement.classList.contains('level-menu-input')));
    await page.screenshot({ path: path.join(outDir, 'level-menu.png') });
    await stageBtn('PRESTIGE 1').click();
    check('PRESTIGE 1: asks for "Level in Prestige 1" and explains the restart',
        (await menu().locator('.level-menu-label').textContent()) === 'Level in Prestige 1' && (await menu().locator('.level-menu-help').textContent()).includes('restarts the weapon at level 1'));
    await stageBtn('PRESTIGE MASTER').click();
    check('PRESTIGE MASTER: asks for "Prestige Master level", up to 250',
        (await menu().locator('.level-menu-label').textContent()) === 'Prestige Master level' && (await menu().locator('.level-menu-input').getAttribute('max')) === '250');
    await page.screenshot({ path: path.join(outDir, 'level-menu-master.png') });
    await menu().locator('.level-menu-cancel').click();
    check('CANCEL closes it without saving', !(await menuOpen()) && !((await saved()) || {}).levels?.M4);
    await page.locator('.weapon-level-btn').click();
    await page.keyboard.press('Escape');
    check('Esc closes it too', !(await menuOpen()));
    await page.locator('.weapon-level-btn').click();
    check('No CLEAR button while nothing is set', !(await page.locator('.level-menu-clear').count()));
    await page.keyboard.press('Escape');

    // ---------------------------------------------------------------
    console.log('\n3. Not prestiged, level 40');
    await setLevel('NO', 40);
    check('Menu closes on SAVE', !(await menuOpen()));
    check('Military 1-4 (10, 18, 26, 35) ticked; 5+ not', await ticked(mil(1)) && await ticked(mil(4)) && !(await ticked(mil(5))));
    check('Specials never ticked for you', !(await ticked('MYRIAD')));
    let sv = await saved();
    check('Saved as { stage: 0, level: 40 }', JSON.stringify(sv.levels.M4) === '{"stage":0,"level":40}');
    check('Message: "✓ 4 CAMOS TICKED · MILITARY 1, 2, 3, 4 · M4 · LV 40 · Not prestiged"',
        (await lastToast()) === '✓ 4 CAMOS TICKED | MILITARY 1, 2, 3, 4 | M4 · LV 40 · Not prestiged', await lastToast());
    check('Card: "LV 40 · Not prestiged"; hint "Next: MILITARY 5 at level 44 (4 levels away)"',
        (await value()) === 'LV 40 · Not prestiged' && (await hint()) === 'Next: MILITARY 5 at level 44 (4 levels away)', await hint());
    check('Special lines: Myriad ✓ OPEN, Night Ops 11 to go, Green 32 to go',
        (await levelLine('MYRIAD')) === '✓ OPEN · weapon level reached' && (await levelLine('NIGHT OPS')) === 'LOCKED · 11 levels to go' && (await levelLine('GREEN')) === 'LOCKED · 32 levels to go');
    check('Weapon list: "LV 40" badge and 4/15', (await badge('M4')) === 'LV 40' && (await listItem('M4').innerText()).includes('4/15'));
    check('Focus goes back to SET LEVEL', await page.evaluate(() => document.activeElement.classList.contains('weapon-level-btn')));
    await goPrestige();
    check('Prestige tab: nothing ticked; Pyroclast "LOCKED · prestige this weapon at max level"',
        !(await ticked('PYROCLAST')) && (await levelLine('PYROCLAST')) === 'LOCKED · prestige this weapon at max level'
        && (await levelLine('PYROCLAST TERMINUS')) === 'LOCKED · prestige, then reach max level again');
    check('Badge shows on the Prestige tab too', (await badge('M4')) === 'LV 40');
    await goTrack();
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(outDir, 'level-m4-40.png') });

    // ---------------------------------------------------------------
    console.log('\n4. Prestige 1, level 5');
    await clearToasts();
    await page.locator('.weapon-level-btn').click();
    check('Menu reopens on NO with 40 filled in, and a CLEAR button', await stageBtn('NO').evaluate(e => e.classList.contains('active'))
        && (await menu().locator('.level-menu-input').inputValue()) === '40' && await page.locator('.level-menu-clear').count() === 1);
    await stageBtn('PRESTIGE 1').click();
    await menu().locator('.level-menu-input').fill('5');
    await menu().locator('.level-menu-save').click();
    check('All 8 Military ticked (prestiged)', (await Promise.all([1, 2, 3, 4, 5, 6, 7, 8].map(n => ticked(mil(n))))).every(Boolean));
    check('Message: "✓ 5 CAMOS TICKED · MILITARY 5, 6, 7, 8 · PYROCLAST"', (await lastToast()) === '✓ 5 CAMOS TICKED | MILITARY 5, 6, 7, 8 · PYROCLAST | M4 · Prestige 1 · LV 5', await lastToast());
    check('Specials: "✓ OPEN · weapon prestiged"', (await levelLine('GREEN')) === '✓ OPEN · weapon prestiged');
    check('Card "Prestige 1 · LV 5"; hint "Next: PYROCLAST TERMINUS, reach max level again in Prestige 1."',
        (await value()) === 'Prestige 1 · LV 5' && (await hint()) === 'Next: PYROCLAST TERMINUS, reach max level again in Prestige 1.', await hint());
    check('Badge "P1 · LV 5"', (await badge('M4')) === 'P1 · LV 5');
    await goPrestige();
    check('Prestige tab: Pyroclast ticked, Terminus "LOCKED · reach max level again in Prestige 1"',
        await ticked('PYROCLAST') && !(await ticked('PYROCLAST TERMINUS')) && (await levelLine('PYROCLAST TERMINUS')) === 'LOCKED · reach max level again in Prestige 1');
    sv = await saved();
    check('Saved under the same Prestige keys as ticking by hand ("0")', sv.camos.prestige.M4['0'] === true && !sv.camos.prestige.M4['1']);

    // ---------------------------------------------------------------
    console.log('\n5. Prestige Master (set from the Prestige tab)');
    await clearToasts();
    await setLevel('PRESTIGE MASTER', 160);
    check('PM 160: Terminus + Scatter ticked, Cascade not', await ticked('PYROCLAST TERMINUS') && await ticked('PYROCLAST SCATTER') && !(await ticked('PYROCLAST CASCADE')));
    check('Cascade: "LOCKED · 90 Prestige Master levels to go"', (await levelLine('PYROCLAST CASCADE')) === 'LOCKED · 90 Prestige Master levels to go');
    check('Hint: "Next: PYROCLAST CASCADE at Prestige Master level 250 (90 levels away)"', (await hint()) === 'Next: PYROCLAST CASCADE at Prestige Master level 250 (90 levels away)', await hint());
    check('Message lists Terminus and Scatter', (await lastToast()).startsWith('✓ 2 CAMOS TICKED | PYROCLAST TERMINUS · PYROCLAST SCATTER'), await lastToast());
    check('Badge "PM 160"', (await badge('M4')) === 'PM 160');
    await page.screenshot({ path: path.join(outDir, 'level-prestige-tab-pm160.png') });
    await setLevel('PRESTIGE MASTER', 250);
    check('PM 250: Cascade ticked; "Every Military and Prestige camo is unlocked."', await ticked('PYROCLAST CASCADE') && (await hint()) === 'Every Military and Prestige camo is unlocked.');

    // ---------------------------------------------------------------
    console.log('\n6. Never unticks');
    await setLevel('NO', 10);
    sv = await saved();
    check('Going back to "not prestiged, level 10" keeps every tick', ['0', '1', '2', '3'].every(k => sv.camos.prestige.M4[k]) && Object.keys(sv.camos.track.M4).filter(k => /^mil/.test(k)).length === 8);
    await page.locator('.weapon-level-btn').click();
    await page.locator('.level-menu-clear').click();
    sv = await saved();
    check('CLEAR forgets the level, keeps the ticks; card "Not set"', !('M4' in sv.levels) && sv.camos.prestige.M4['3'] === true && (await value()) === 'Not set' && (await badge('M4')) === '');

    // ---------------------------------------------------------------
    console.log('\n7. From nothing straight to Prestige Master 150');
    await open(track('HAN 86'));
    await clearToasts();
    await setLevel('PRESTIGE MASTER', 150);
    check('Message: "✓ 11 CAMOS TICKED · MILITARY 1–8 · PYROCLAST · PYROCLAST TERMINUS · PYROCLAST SCATTER"',
        (await lastToast()).startsWith('✓ 11 CAMOS TICKED | MILITARY 1–8 · PYROCLAST · PYROCLAST TERMINUS · PYROCLAST SCATTER'), await lastToast());
    check('Weapon list 8/15 on the Camo Track', (await listItem('HAN 86').innerText()).includes('8/15'));

    // ---------------------------------------------------------------
    console.log('\n8. Checking what you type');
    await open(track('AXION'));
    const tryLevel = async (stage, v) => {
        await page.locator('.weapon-level-btn').click();
        await stageBtn(stage).click();
        await menu().locator('.level-menu-input').fill(String(v));
        await menu().locator('.level-menu-save').click();
        const stillOpen = await menuOpen();
        const err = stillOpen ? await menu().locator('.level-menu-error').textContent() : '';
        if (stillOpen) await page.keyboard.press('Escape');
        return err;
    };
    check('Empty: "Enter a level from 1 to 150." and the menu stays open', (await tryLevel('NO', '')) === 'Enter a level from 1 to 150.');
    check('0 is refused', (await tryLevel('NO', 0)) === 'Enter a level from 1 to 150.');
    check('151 when not prestiged is refused', (await tryLevel('NO', 151)) === 'Enter a level from 1 to 150.');
    check('251 in Prestige Master: "Enter a level from 1 to 250."', (await tryLevel('PRESTIGE MASTER', 251)) === 'Enter a level from 1 to 250.');
    check('Nothing was saved', !((await saved()) || {}).levels?.AXION);
    await setLevel('NO', 33.7);
    check('33.7 is saved as 33', (await saved()).levels.AXION.level === 33);

    // ---------------------------------------------------------------
    console.log('\n9. Untick by hand, unreleased guns, other tabs');
    await open({ levels: { 'M4': { stage: 0, level: 40 } }, camos: { track: { M4: { mil1: true, mil3: true } } }, ...track('M4') });
    check('A level loaded from the save doesn\'t tick anything by itself', !(await ticked(mil(2))) && await ticked(mil(3)));
    await row(mil(3)).locator('input[type=checkbox]').uncheck();
    check('Untick by hand → "✓ OPEN · weapon level reached"', (await levelLine(mil(3))) === '✓ OPEN · weapon level reached');
    await open({ levels: { 'M4': { stage: 0, level: 40 } }, ...track('M4', 'dmz') });
    check('DMZ view shows the same card and level', (await value()) === 'LV 40 · Not prestiged');
    await open(track('JAK 12'));
    await setLevel('NO', 30);
    check('JAK 12 not prestiged: nothing ticked, hint says levels aren\'t published',
        !(await ticked(mil(1))) && (await hint()).startsWith("Military unlock levels for this weapon aren't published yet"), await hint());
    await setLevel('PRESTIGE 1', 2);
    check('JAK 12 prestiged: all 8 Military ticked anyway', (await Promise.all([1, 2, 3, 4, 5, 6, 7, 8].map(n => ticked(mil(n))))).every(Boolean));
    await open({ levels: { 'M4': { stage: 0, level: 40 } }, ui: { mode: 'mastery' } });
    check('Mastery tab: no card', await card().count() === 0);
    await open({ levels: { 'M4': { stage: 0, level: 40 } }, ui: { mode: 'loadout', dmzView: 'weapons', dmzGun: 'M4' } });
    check('DMZ Loadout weapon page: no card', await card().count() === 0);

    // ---------------------------------------------------------------
    console.log('\n10. Saved, exported and restored');
    await open({ levels: { 'M4': 41, 'HAN 86': 'abc', 'AXION': { stage: 2, level: 200 }, 'ODEN': { stage: 0, level: 200 }, 'PILA': { stage: 7, level: 5 }, 'X-58 NYX': null }, ...track('M4') });
    await setLevel('NO', 42);
    sv = await saved();
    check('An old plain number (41) loads as not prestiged; bad values dropped; unknown stage → not prestiged',
        JSON.stringify(sv.levels) === JSON.stringify({ 'M4': { stage: 0, level: 42 }, 'AXION': { stage: 2, level: 200 }, 'PILA': { stage: 0, level: 5 } }), JSON.stringify(sv.levels));
    const [download] = await Promise.all([page.waitForEvent('download'), page.locator('#exportBtn').click()]);
    const exported = JSON.parse(require('fs').readFileSync(await download.path(), 'utf8'));
    check('Export includes the levels', JSON.stringify(exported.levels.AXION) === '{"stage":2,"level":200}');
    await open({ camos: { track: { M4: { mil1: true } } }, ...track('M4') });
    check('A save without levels opens fine ("Not set")', (await value()) === 'Not set');

    // ---------------------------------------------------------------
    console.log('\n11. Phone width');
    await page.setViewportSize({ width: 390, height: 844 });
    await open({ levels: { 'KG-7 VULCAN': { stage: 0, level: 50 } }, ...track('KG-7 VULCAN') });
    check('Card and hint show', await card().isVisible() && (await hint()).startsWith('Next:'));
    check('No sideways scrolling', await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth));
    await page.locator('.weapon-level-btn').click();
    const box = await menu().boundingBox();
    check('The menu fits on screen', box && box.x >= 0 && box.x + box.width <= 390, JSON.stringify(box));
    await page.screenshot({ path: path.join(outDir, 'level-menu-phone.png') });
    await page.keyboard.press('Escape');

    console.log('\nJS errors on the page: ' + (errors.length ? '\n  ' + errors.join('\n  ') : 'none'));
    console.log(`\n${pass} passed, ${fail} failed`);
    await browser.close();
    process.exit(fail || errors.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
