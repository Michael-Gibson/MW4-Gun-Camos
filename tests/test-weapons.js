// Headless browser test: DMZ weapon cards (Gunsmith toggle, War Spoils diamonds, back-button scroll) + Season 1 camos.
// usage: npm test (all suites) or: node tests/test-weapons.js
const { chromium } = require('playwright-core');
const path = require('path');

const projectDir = process.argv[2] || path.resolve(__dirname, '..'); // the app folder (tests/ lives inside it)
const outDir = path.join(__dirname, 'output'); // screenshots and test files (not committed)
require('fs').mkdirSync(outDir, { recursive: true });
const shotsDir = outDir;
const url = 'file:///' + path.join(projectDir, 'index.html').replace(/\\/g, '/');
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

    // Seed an OLD-format save (no gunsmith flag): M4 = 2 manuals, HAN 86 = 3 manuals.
    await page.goto(url);
    await page.evaluate(([KEY]) => {
        localStorage.setItem(KEY, JSON.stringify({
            camos: {},
            dmz: { 'M4': { manuals: 2, blueprints: [] }, 'HAN 86': { manuals: 3, blueprints: [] } },
            ui: { mode: 'loadout', view: 'detail', dmzView: 'weapons', dmzGun: null }
        }));
    }, [KEY]);
    await page.reload();

    const card = (gun) => page.locator('.dmz-card', { has: page.locator('.dmz-card-name', { hasText: new RegExp(`^${gun.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`) }) });
    const cardClass = async (gun) => (await card(gun).getAttribute('class')) || '';
    const toggleText = async (gun) => (await card(gun).locator('.gunsmith-toggle').textContent()).trim();
    const saved = () => page.evaluate(KEY => JSON.parse(localStorage.getItem(KEY)), KEY);
    const statValue = async (label) => page.locator('.stat-card', { hasText: label }).locator('.stat-value').textContent();

    console.log('\n1. Old saves keep their unlocks');
    check('M4 (2 manuals, old save) shows unlocked', (await cardClass('M4')).includes('dmz-unlocked'));
    check('M4 toggle reads "✓ GUNSMITH"', (await toggleText('M4')) === '✓ GUNSMITH', await toggleText('M4'));
    check('HAN 86 (3 manuals) shows War Spoils', (await cardClass('HAN 86')).includes('dmz-camo'));
    check('AXION (nothing) shows locked', (await cardClass('AXION')).includes('dmz-locked'));
    check('AXION toggle reads "LOCKED"', (await toggleText('AXION')) === 'LOCKED');
    const before = await statValue('Unlocked at Gunsmith');
    check('Overview stat counts 2 unlocked', before.startsWith('2/'), before);
    await page.screenshot({ path: path.join(shotsDir, '1-overview-before.png') });

    console.log('\n2. Toggle a gun from the overview card (0 manuals)');
    await card('AXION').locator('.gunsmith-toggle').click();
    check('Still on the overview (card click did not open the detail page)', await page.locator('.dmz-grid').count() > 0);
    check('AXION now unlocked', (await cardClass('AXION')).includes('dmz-unlocked'));
    check('AXION toggle reads "✓ GUNSMITH"', (await toggleText('AXION')) === '✓ GUNSMITH');
    let s = await saved();
    check('Saved: AXION gunsmith=true, manuals=0', s.dmz.AXION.gunsmith === true && s.dmz.AXION.manuals === 0, JSON.stringify(s.dmz.AXION));
    check('Overview stat now 3 unlocked', (await statValue('Unlocked at Gunsmith')).startsWith('3/'));
    const axLeft = await page.locator('.gun-list-item', { hasText: 'AXION' }).first().getAttribute('class');
    check('Left sidebar AXION is green too', (axLeft || '').includes('dmz-unlocked'), axLeft);
    await card('AXION').locator('.gunsmith-toggle').click();
    check('Clicking again re-locks AXION', (await cardClass('AXION')).includes('dmz-locked'));

    console.log('\n3. Old-save gun can be switched off, manuals kept');
    await card('M4').locator('.gunsmith-toggle').click();
    s = await saved();
    check('M4 now locked', (await cardClass('M4')).includes('dmz-locked'));
    check('M4 manuals still 2', s.dmz.M4.manuals === 2 && s.dmz.M4.gunsmith === false, JSON.stringify(s.dmz.M4));

    console.log('\n4. Weapon detail page');
    await card('KASTOV 762').locator('.dmz-card-name').click();
    check('Clicking the card body opens the detail page', await page.locator('h2', { hasText: 'KASTOV 762' }).count() === 1);
    const sections = await page.locator('.dmz-section h3').allTextContents();
    check('Has GUNSMITH section above WEAPON MANUALS', sections[0] === 'GUNSMITH' && sections[1].startsWith('WEAPON MANUALS'), sections.join(' | '));
    await page.locator('.gunsmith-toggle.large').click();
    check('Large toggle unlocks it', (await page.locator('.gunsmith-toggle.large').textContent()).includes('GUNSMITH')
        && (await page.locator('.dmz-section').first().getAttribute('class')).includes('dmz-unlocked'));
    await page.locator('.manual-pips.interactive .pip').first().click();
    const manualStatus = await page.locator('.dmz-section').nth(1).locator('.manual-status').textContent();
    check('Manual pip still works (1/3)', manualStatus.startsWith('1/3'), manualStatus);
    await page.screenshot({ path: path.join(shotsDir, '2-detail.png') });
    await page.locator('.back-button').click();

    console.log('\n5. Keyboard + persistence');
    await card('ODEN').focus();
    await page.keyboard.press('Enter');
    check('Enter on a focused card opens it', await page.locator('h2', { hasText: 'ODEN' }).count() === 1);
    await page.locator('.back-button').click();
    await page.reload();
    check('After reload: KASTOV 762 unlocked', (await cardClass('KASTOV 762')).includes('dmz-unlocked'));
    check('After reload: M4 still locked', (await cardClass('M4')).includes('dmz-locked'));
    await page.screenshot({ path: path.join(shotsDir, '3-overview-after.png') });

    console.log('\n5b. Clicking diamonds on overview cards');
    const pips = (gun) => card(gun).locator('.manual-pips .pip');
    check('Overview diamonds are buttons', await pips('PATRIOT XMR').first().evaluate(n => n.tagName) === 'BUTTON');
    await pips('PATRIOT XMR').nth(1).click();
    check('Clicking the 2nd diamond stays on the overview', await page.locator('.dmz-grid').count() > 0);
    s = await saved();
    check('PATRIOT XMR manuals = 2', s.dmz['PATRIOT XMR'].manuals === 2, JSON.stringify(s.dmz['PATRIOT XMR']));
    check('2 diamonds filled on the card', await pips('PATRIOT XMR').locator('xpath=self::*[contains(@class,"filled")]').count() === 2);
    check('Manuals alone do not unlock the Gunsmith', (await toggleText('PATRIOT XMR')) === 'LOCKED');
    const sideCount = await page.locator('.gun-list-item', { hasText: 'PATRIOT XMR' }).first().innerText();
    check('Sidebar count shows 2/3', sideCount.includes('2/3'), sideCount);
    await pips('PATRIOT XMR').nth(2).click();
    check('3rd diamond turns the card War Spoils gold', (await cardClass('PATRIOT XMR')).includes('dmz-camo'));
    check('War Spoils stat now 2/37', (await statValue('WAR SPOILS')).startsWith('2/'), await statValue('WAR SPOILS'));
    await pips('PATRIOT XMR').nth(2).click();
    s = await saved();
    check('Clicking the top diamond again steps back to 2', s.dmz['PATRIOT XMR'].manuals === 2);
    await pips('ODEN').first().focus();
    await page.keyboard.press('Enter');
    s = await saved();
    check('Enter on a focused diamond sets 1 manual (does not open the gun)',
        s.dmz.ODEN.manuals === 1 && await page.locator('.dmz-grid').count() > 0, JSON.stringify(s.dmz.ODEN));
    await card('PATRIOT XMR').locator('.bp-chips').click();
    check('Clicking elsewhere on the card still opens the weapon', await page.locator('h2', { hasText: 'PATRIOT XMR' }).count() === 1);
    await page.locator('.back-button').click();
    await card('PATRIOT XMR').scrollIntoViewIfNeeded();
    await pips('PATRIOT XMR').first().hover();
    await page.screenshot({ path: path.join(shotsDir, '5-overview-pips.png'), clip: { x: 20, y: 380, width: 1360, height: 260 } });

    console.log('\n5c. Back button returns to the same scroll spot');
    const panelTop = () => page.evaluate(() => document.getElementById('rightPanel').scrollTop);
    await card('RPG-8').scrollIntoViewIfNeeded();
    const spotBefore = await panelTop();
    check('List is scrolled down (desktop: panel scrolls)', spotBefore > 300, String(spotBefore));
    await card('RPG-8').locator('.dmz-card-name').click();
    check('Weapon page opens at the top', await panelTop() === 0 && await page.locator('h2', { hasText: 'RPG-8' }).count() === 1);
    await page.locator('.back-button').click();
    const spotAfter = await panelTop();
    check('Back returns to the same spot', Math.abs(spotAfter - spotBefore) <= 1, `${spotBefore} -> ${spotAfter}`);
    check('RPG-8 card is on screen after going back', await card('RPG-8').isVisible()
        && await card('RPG-8').evaluate(n => { const r = n.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; }));
    await page.screenshot({ path: path.join(shotsDir, '6-back-scroll.png') });
    // Tab switches still start at the top
    await page.locator('.view-toggle button', { hasText: 'BLUEPRINTS' }).click();
    await page.locator('.view-toggle button', { hasText: 'WEAPONS' }).click();
    check('Switching sub-tabs still starts at the top', await panelTop() === 0);

    // Phone-width layout (sidebar stacks above; the panel still scrolls)
    await page.setViewportSize({ width: 600, height: 800 });
    await page.reload();
    await card('JOKR').scrollIntoViewIfNeeded();
    const phoneBefore = await panelTop();
    check('Phone width: list is scrolled down', phoneBefore > 300, String(phoneBefore));
    await card('JOKR').locator('.dmz-card-name').click();
    await page.locator('.back-button').click();
    const phoneAfter = await panelTop();
    check('Phone width: back returns to the same spot', Math.abs(phoneAfter - phoneBefore) <= 1, `${phoneBefore} -> ${phoneAfter}`);
    await page.setViewportSize({ width: 1400, height: 900 });

    console.log('\n6. Season 1 guns on the Camo Track tab');
    for (const [gun, names] of [['CSG-35', ['POLYHEDRON', 'RIND', 'BLACK GRIP']], ['CRONEN OSPREY', ['IN THE WEEDS', 'DARK ICHOR', 'CHAINED']]]) {
        for (const view of ['mp', 'dmz']) {
            await page.evaluate(([KEY, gun, view]) => {
                const st = JSON.parse(localStorage.getItem(KEY));
                st.ui = { ...st.ui, mode: 'track', view: 'detail', gun, trackMode: view };
                localStorage.setItem(KEY, JSON.stringify(st));
            }, [KEY, gun, view]);
            await page.reload();
            const text = await page.locator('#rightPanel').innerText();
            check(`${gun} (${view.toUpperCase()}) shows ${names.join(', ')}`, names.every(n => text.includes(n)));
            if (gun === 'CSG-35' && view === 'dmz') await page.screenshot({ path: path.join(shotsDir, '4-csg35-dmz.png'), fullPage: false });
        }
    }

    console.log('\nJS errors on the page: ' + (errors.length ? '\n  ' + errors.join('\n  ') : 'none'));
    console.log(`\n${pass} passed, ${fail} failed`);
    await browser.close();
    process.exit(fail || errors.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
