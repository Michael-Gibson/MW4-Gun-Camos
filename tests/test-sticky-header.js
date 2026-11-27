// Headless browser test: on a gun's page, the row with the gun name and the
// MULTIPLAYER / DMZ / WARZONE toggle stays pinned to the top while you scroll.
// usage: npm test (all suites) or: node tests/test-sticky-header.js
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
    const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error' && !/fonts\.g/.test(m.text())) errors.push(m.text()); });

    const open = async (seed) => {
        await page.evaluate(([KEY, seed]) => localStorage.setItem(KEY, JSON.stringify(seed)), [KEY, seed]);
        await page.reload();
        await page.waitForTimeout(100);
    };
    const bar = () => page.locator('.camo-header > .title-row');
    const viewBtn = (label) => page.locator('.view-toggle .segment', { hasText: new RegExp(`^${label}$`) });
    // Where the bar is, and whether it's the thing actually on top at its centre
    const barState = () => page.evaluate(() => {
        const b = document.querySelector('.camo-header > .title-row');
        const r = b.getBoundingClientRect();
        const panel = document.getElementById('rightPanel').getBoundingClientRect();
        const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return { top: Math.round(r.top), bottom: Math.round(r.bottom), panelTop: Math.round(panel.top), onTop: b.contains(hit) };
    });
    const panelScroll = () => page.evaluate(() => document.getElementById('rightPanel').scrollTop);
    const scrollPanelToBottom = () => page.evaluate(() => { const p = document.getElementById('rightPanel'); p.scrollTop = p.scrollHeight; });

    await page.goto(url);

    // ---------------------------------------------------------------
    console.log('\n1. Desktop: the camo panel scrolls, the gun row stays');
    await open({ ui: { mode: 'track', view: 'detail', gun: 'M4', trackMode: 'mp' } });
    let s0 = await barState();
    check('Gun row (name + MULTIPLAYER / DMZ / WARZONE) sits at the top of the panel', Math.abs(s0.top - s0.panelTop) <= 2 && s0.onTop, JSON.stringify(s0));
    await scrollPanelToBottom();
    await page.waitForTimeout(100);
    const scrolled = await panelScroll();
    let s1 = await barState();
    check('After scrolling to the bottom (Completionist camos), it is still at the top and on top of the camos',
        scrolled > 500 && Math.abs(s1.top - s1.panelTop) <= 2 && s1.onTop, JSON.stringify({ scrolled, ...s1 }));
    check('Gun name visible in it', (await bar().locator('h2').textContent()) === 'M4' && await bar().locator('h2').isVisible());
    await page.screenshot({ path: path.join(outDir, 'sticky-desktop-scrolled.png') });
    await viewBtn('WARZONE').click();
    check('Clicking WARZONE down there switches the view', /^WARZONE camo track$/i.test(await page.locator('.panel-subtitle').first().textContent()));
    check('…and keeps your place (no jump back to the top)', Math.abs((await panelScroll()) - scrolled) <= 5, `${await panelScroll()} vs ${scrolled}`);
    s1 = await barState();
    check('…with the row still pinned', Math.abs(s1.top - s1.panelTop) <= 2 && s1.onTop);
    await viewBtn('DMZ').click();
    check('DMZ works from there too', /^DMZ camo track$/i.test(await page.locator('.panel-subtitle').first().textContent()) && Math.abs((await panelScroll()) - scrolled) <= 5);
    const rowUnderBar = await page.evaluate(() => {
        // The first camo row below the bar should be fully visible (not hidden under the bar)
        const b = document.querySelector('.camo-header > .title-row').getBoundingClientRect();
        const rows = [...document.querySelectorAll('.camo-row')].map(r => r.getBoundingClientRect()).filter(r => r.bottom > b.bottom + 5);
        return rows.length > 0;
    });
    check('Camos below the row stay visible', rowUnderBar);

    // ---------------------------------------------------------------
    console.log('\n2. Prestige tab and short screens');
    await page.setViewportSize({ width: 1400, height: 560 });
    await open({ ui: { mode: 'prestige', view: 'detail', gun: 'M4' } });
    await scrollPanelToBottom();
    await page.waitForTimeout(100);
    const sp = await barState();
    check('Prestige tab: gun row pinned too', (await panelScroll()) > 0 && Math.abs(sp.top - sp.panelTop) <= 2 && sp.onTop, JSON.stringify(sp));
    await page.setViewportSize({ width: 1400, height: 900 });

    // ---------------------------------------------------------------
    console.log('\n3. Phone: the camo panel scrolls under the weapon list, the gun row stays at its top');
    await page.setViewportSize({ width: 390, height: 844 });
    await open({ ui: { mode: 'track', view: 'detail', gun: 'KG-7 VULCAN', trackMode: 'mp' } });
    await page.locator('#rightPanel').scrollIntoViewIfNeeded();
    await scrollPanelToBottom();
    await page.waitForTimeout(150);
    const phScroll = await panelScroll();
    const ph = await barState();
    check('Scrolled to the bottom of the camos: the row is at the top of the panel', phScroll > 500 && Math.abs(ph.top - ph.panelTop) <= 2 && ph.onTop, JSON.stringify({ phScroll, ...ph }));
    check('All three buttons are visible', await viewBtn('MULTIPLAYER').isVisible() && await viewBtn('DMZ').isVisible() && await viewBtn('WARZONE').isVisible());
    await page.screenshot({ path: path.join(outDir, 'sticky-phone-scrolled.png') });
    await viewBtn('WARZONE').click();
    await page.waitForTimeout(150);
    check('Clicking WARZONE switches the view and keeps your place', /^WARZONE camo track$/i.test(await page.locator('.panel-subtitle').first().textContent())
        && Math.abs((await panelScroll()) - phScroll) <= 5, `${await panelScroll()} vs ${phScroll}`);
    const ph2 = await barState();
    check('…row still at the top', Math.abs(ph2.top - ph2.panelTop) <= 2 && ph2.onTop);
    check('No sideways scrolling', await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth));

    // ---------------------------------------------------------------
    console.log('\n4. Other pages are unchanged');
    await page.setViewportSize({ width: 1400, height: 900 });
    await open({ ui: { mode: 'loadout', dmzView: 'weapons', dmzGun: 'M4' } });
    check('DMZ Loadout weapon page header is not pinned', await page.locator('.camo-header').count() === 0);
    await open({ ui: { mode: 'loadout', dmzView: 'notes' } });
    check('Notes & Materials header is not pinned', await page.locator('.camo-header').count() === 0);

    console.log('\nJS errors on the page: ' + (errors.length ? '\n  ' + errors.join('\n  ') : 'none'));
    console.log(`\n${pass} passed, ${fail} failed`);
    await browser.close();
    process.exit(fail || errors.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
