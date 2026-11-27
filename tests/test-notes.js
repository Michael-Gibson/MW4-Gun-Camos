// Headless browser test for the Notes & Materials layout (notepad | shopping list).
// usage: npm test (all suites) or: node tests/test-notes.js
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
const near = (a, b, tol = 2) => Math.abs(a - b) <= tol;

(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error' && !/fonts\.g/.test(m.text())) errors.push(m.text()); });
    const dialogs = [];
    page.on('dialog', d => { dialogs.push(d.message()); d.accept(); });

    await page.goto(url);
    await page.evaluate(KEY => localStorage.setItem(KEY, JSON.stringify({
        ui: { mode: 'loadout', view: 'detail', dmzView: 'notes' }
    })), KEY);
    await page.reload();

    const box = (sel) => page.locator(sel).first().boundingBox();
    const saved = () => page.evaluate(KEY => JSON.parse(localStorage.getItem(KEY)), KEY);
    const shop = page.locator('.shop-section');
    const pick = page.locator('.pick-section');
    const row = (name) => shop.locator('.mat-row', { has: page.locator('.mat-name', { hasText: new RegExp(`^${name}$`) }) });
    const rowNames = async () => shop.locator('.mat-row .mat-name').allTextContents();
    const craftChip = (name) => page.locator('.craft-chip', { has: page.locator('.craft-chip-name', { hasText: new RegExp(`^${name}$`, 'i') }) });
    const matChip = (name) => page.locator('.mat-picker .mat-chip', { hasText: new RegExp(`^${name}$`) });
    const pill = (name) => shop.locator('.craft-pill', { has: page.locator('.craft-pill-name', { hasText: new RegExp(`^${name}$`, 'i') }) });
    const needOf = async (name) => row(name).locator('.mat-need input').inputValue();
    const statusOf = async (name) => (await row(name).locator('.mat-status').textContent()).trim();
    const readyPill = async () => (await shop.locator('.recipe-heading .recipe-count').textContent()).trim();

    // ---------------------------------------------------------------
    console.log('\n1. Layout at full width (1400px)');
    const top = await box('.notes-top');
    const pad = await box('.notes-pad-section');
    const shopBox = await box('.shop-section');
    const pickBox = await box('.pick-section');
    check('Notepad is on the left, shopping list on the right', pad.x < shopBox.x);
    check('Both sit on the same row', near(pad.y, shopBox.y));
    check('Each takes half the row (equal widths)', near(pad.width, shopBox.width), `${pad.width} vs ${shopBox.width}`);
    check('Together they fill the row', near(pad.width + shopBox.width + 12, top.width, 3), `${pad.width}+${shopBox.width}+gap vs ${top.width}`);
    check('Notepad stays at the top of the page, under the header', pad.y < 320, String(pad.y));
    check('Pickers are below the top row', pickBox.y >= top.y + top.height);
    check('Pickers span the full width', near(pickBox.width, top.width), `${pickBox.width} vs ${top.width}`);
    check('Shopping list heading reads SHOPPING LIST', (await shop.locator('h3').first().innerText()).startsWith('SHOPPING LIST'));
    check('Crafting-for bar + Reset/Clear are in the shopping list', await shop.locator('.craft-bar').count() === 1
        && await shop.getByRole('button', { name: 'Reset counts' }).count() === 1 && await shop.getByRole('button', { name: 'Clear list' }).count() === 1);
    check('Item picker is in the bottom section', await pick.locator('.craft-picker').count() === 1);
    check('Base resources + ingredients are in the bottom section', (await pick.locator('.mat-group-label').allTextContents()).some(t => /BASE RESOURCES/.test(t))
        && (await pick.locator('.mat-group-label').allTextContents()).some(t => /INGREDIENTS/.test(t)));
    check('Add-material form is in the bottom section', await pick.locator('.mat-add-form').count() === 1);
    check('Empty list shows a hint', (await shop.locator('.shop-list').innerText()).includes('Nothing on the list yet'));
    check('Ready pill shows 0 TRACKED', (await readyPill()) === '0 TRACKED', await readyPill());
    const padSection = await box('.notes-pad-section');
    check('Notepad and shopping list are the same height', near(padSection.height, (await box('.shop-section')).height));

    // ---------------------------------------------------------------
    console.log('\n2. Clicking items to craft fills the shopping list');
    await craftChip('Medkit').click();
    check('MEDKIT pill appears in the shopping list', await pill('Medkit').count() === 1);
    check('Medkit chip shows as picked', (await craftChip('Medkit').getAttribute('aria-pressed')) === 'true');
    check('Rows rarest first: Binding Catalyst, Biomaterials, Chemicals', JSON.stringify(await rowNames()) === JSON.stringify(['BINDING CATALYST', 'BIOMATERIALS', 'CHEMICALS']), (await rowNames()).join(', '));
    check('Needs 30 / 1 / 5', (await needOf('CHEMICALS')) === '30' && (await needOf('BINDING CATALYST')) === '1' && (await needOf('BIOMATERIALS')) === '5');
    check('Rows show where they come from ("For MEDKIT ×1")', (await row('CHEMICALS').locator('.mat-sources').textContent()).includes('MEDKIT ×1'));
    await pill('Medkit').getByRole('button', { name: '+' }).click();
    check('+ on the pill doubles the needs (60 / 2 / 10)', (await needOf('CHEMICALS')) === '60' && (await needOf('BINDING CATALYST')) === '2' && (await needOf('BIOMATERIALS')) === '10');
    await craftChip('UAV').click();
    check('Second item adds its materials (6 rows)', (await rowNames()).length === 6, (await rowNames()).join(', '));
    check('Ready pill 0/6 READY', (await readyPill()) === '0/6 READY', await readyPill());

    // ---------------------------------------------------------------
    console.log('\n3. Clicking base resources / ingredients adds rows');
    await matChip('METALS').click();
    check('METALS row added with NO TARGET', await row('METALS').count() === 1 && (await statusOf('METALS')) === 'NO TARGET');
    check('METALS chip shows as tracked', (await matChip('METALS').getAttribute('aria-pressed')) === 'true');
    await matChip('METALS').click();
    check('Clicking METALS again removes it', await row('METALS').count() === 0);
    await matChip('CPU').click();
    check('Ingredient CPU added', await row('CPU').count() === 1);
    await matChip('ELECTRONICS').click();
    check('Material needed by a craft can\'t be removed (shows a message)', await row('ELECTRONICS').count() === 1 && dialogs.some(d => /needed for an item/.test(d)));

    // ---------------------------------------------------------------
    console.log('\n4. Counting HAVE in the shopping list');
    await row('CHEMICALS').locator('.mat-have input').fill('45');
    check('Typing 45 of 60 shows 15 LEFT', (await statusOf('CHEMICALS')) === '15 LEFT', await statusOf('CHEMICALS'));
    await row('CHEMICALS').locator('.mat-have').getByRole('button', { name: '+' }).click({ modifiers: ['Shift'] });
    check('Shift + "+" adds 10 (55)', (await row('CHEMICALS').locator('.mat-have input').inputValue()) === '55');
    for (let i = 0; i < 5; i++) await row('CHEMICALS').locator('.mat-have').getByRole('button', { name: '+' }).click();
    check('Reaching 60 shows READY', (await statusOf('CHEMICALS')) === 'READY');
    // CPU has no target, so it isn't counted: 6 rows with a target
    check('Ready pill counts it (1/6 READY; CPU has no target)', (await readyPill()) === '1/6 READY', await readyPill());
    let s = await saved();
    check('HAVE count is saved', s.materials.tracked.find(t => t.name === 'CHEMICALS').have === 60);

    // ---------------------------------------------------------------
    console.log('\n5. Notepad');
    const padArea = page.locator('.notepad');
    await padArea.fill('Plan: farm Biomaterials at the swamp.\nKey: Bunker 3');
    await page.waitForTimeout(600);
    check('SAVED tag after typing', (await page.locator('.notes-pad-section .recipe-count').textContent()) === 'SAVED');
    s = await saved();
    check('Notes saved to storage', s.notes === 'Plan: farm Biomaterials at the swamp.\nKey: Bunker 3');
    await craftChip('Gas Mask').click();
    check('Notes survive the list redrawing', (await padArea.inputValue()).startsWith('Plan: farm'));
    const padTA = await box('.notepad');
    const padSec = await box('.notes-pad-section');
    check('Notepad box fills its column (stretches to the bottom)', padSec.y + padSec.height - (padTA.y + padTA.height) < 30,
        `gap ${Math.round(padSec.y + padSec.height - (padTA.y + padTA.height))}px`);
    check('Notepad and shopping list still the same height', near(padSec.height, (await box('.shop-section')).height));

    // ---------------------------------------------------------------
    console.log('\n6. Long shopping list scrolls inside its box');
    const ingredients = ['MILITARY COMPOSITES', 'NANO-STRUCTURED ALLOY', 'PROTOTYPE RF MODULE', 'EXPERIMENTAL COMPOUNDS', 'ALLOYED PLATING',
        'BALLISTIC FABRIC', 'NYLON LAMINATE', 'POWER REGULATOR', 'STABILIZED REAGENTS', 'VOLATILE EXPLOSIVES', 'COMMS MODULE', 'TURNED COMPONENTS'];
    for (const m of ingredients) await matChip(m).click();
    const lst = page.locator('.shop-list');
    const dims = await lst.evaluate(n => ({ sh: n.scrollHeight, ch: n.clientHeight, ov: getComputedStyle(n).overflowY }));
    check(`List has ${(await rowNames()).length} rows and scrolls inside (${dims.ch}px box)`, dims.sh > dims.ch && dims.ch <= 520 && dims.ov === 'auto', JSON.stringify(dims));
    const topRow2 = await box('.notes-top');
    check('Top row stays compact (doesn\'t grow with the list)', topRow2.height < 760, String(topRow2.height));
    const pad2 = await box('.notes-pad-section'), shop2 = await box('.shop-section');
    check('Notepad matches the taller shopping list', near(pad2.height, shop2.height));
    await lst.evaluate(n => { n.scrollTop = 300; });
    await matChip('CONTROL UNIT').click();   // redraws the whole view
    const after = await lst.evaluate(n => n.scrollTop);
    check('List keeps its scroll spot after a redraw', near(after, 300, 2), String(after));
    await page.screenshot({ path: path.join(outDir, 'notes-long-list.png') });

    // ---------------------------------------------------------------
    console.log('\n7. Removing, adding your own, reset, clear');
    await pill('UAV').getByRole('button', { name: '×' }).click();
    check('Removing UAV drops its untouched rows', await row('STRUCTURAL ALLOY').count() === 0 && await row('ELECTRONIC SENSORS').count() === 0);
    check('…including ELECTRONICS (only UAV needed it)', await row('ELECTRONICS').count() === 0);
    await page.locator('.mat-add-form input').fill('Gold Bar');
    await page.locator('.mat-add-form button[type=submit]').click();
    check('Custom material added to the shopping list', await row('GOLD BAR').count() === 1);
    check('…and to the picker under ADDED BY YOU', (await pick.locator('.mat-group-label').allTextContents()).includes('ADDED BY YOU'));
    check('Add box keeps focus for the next one', await page.evaluate(() => document.activeElement && document.activeElement.closest('.mat-add-form') !== null));
    await shop.getByRole('button', { name: 'Reset counts' }).click();
    s = await saved();
    check('Reset counts sets HAVE to 0 (asks first)', s.materials.tracked.every(t => t.have === 0) && dialogs.some(d => /HAVE count back to 0/.test(d)));
    await shop.getByRole('button', { name: 'Clear list' }).click();
    check('Clear list empties the shopping list', (await rowNames()).length === 0 && await shop.locator('.craft-pill').count() === 0);

    // ---------------------------------------------------------------
    console.log('\n8. Persistence');
    await craftChip('Medkit').click();
    await page.reload();
    check('After reload: notepad text still there', (await padArea.inputValue()).startsWith('Plan: farm'));
    check('After reload: Medkit still on the shopping list', await pill('Medkit').count() === 1 && (await rowNames()).length === 3);

    // ---------------------------------------------------------------
    console.log('\n9. Narrower window (1050px)');
    await page.setViewportSize({ width: 1050, height: 900 });
    await page.waitForTimeout(100);
    const padM = await box('.notes-pad-section'), shopM = await box('.shop-section');
    check('Still side by side, half each', padM.x < shopM.x && near(padM.y, shopM.y) && near(padM.width, shopM.width));
    const nameB = await row('CHEMICALS').locator('.mat-name').boundingBox();
    const statB = await row('CHEMICALS').locator('.mat-status').boundingBox();
    const haveB = await row('CHEMICALS').locator('.mat-have').boundingBox();
    const rowB = await row('CHEMICALS').boundingBox();
    check('Rows switch to two lines: status beside the name', statB.y < nameB.y + nameB.height && statB.x > nameB.x + nameB.width);
    check('HAVE / NEED on the second line', haveB.y > nameB.y + nameB.height - 2);
    check('Nothing spills out of the row', statB.x + statB.width <= rowB.x + rowB.width && haveB.x >= rowB.x);

    console.log('\n10. Phone width (600px)');
    await page.setViewportSize({ width: 600, height: 900 });
    await page.waitForTimeout(100);
    const padP = await box('.notes-pad-section'), shopP = await box('.shop-section');
    check('Stacked: notepad on top, shopping list under it', shopP.y >= padP.y + padP.height && near(padP.x, shopP.x));
    check('Both full width', near(padP.width, shopP.width));
    check('List doesn\'t scroll separately on phones', (await page.locator('.shop-list').evaluate(n => getComputedStyle(n).overflowY)) === 'visible');
    const pageOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    check('No sideways scrolling on the page', pageOverflow <= 0, `${pageOverflow}px`);

    // ---------------------------------------------------------------
    console.log('\n11. "Added to shopping list" messages (top right)');
    await page.setViewportSize({ width: 1400, height: 900 });
    await page.reload();
    const toasts = page.locator('.toast-stack .toast');
    const panelTopNow = () => page.evaluate(() => document.getElementById('rightPanel').scrollTop);
    check('No message before doing anything', await toasts.count() === 0);
    await craftChip('Bomb Glider').scrollIntoViewIfNeeded();
    check('Scrolled down to the pickers (list out of sight)', await panelTopNow() > 400, String(await panelTopNow()));
    await craftChip('Bomb Glider').click();
    check('Message appears after picking an item', await toasts.count() === 1);
    const t1 = toasts.first();
    check('Says "✓ ADDED TO SHOPPING LIST"', (await t1.locator('.toast-label').textContent()) === '✓ ADDED TO SHOPPING LIST');
    check('Names the item', (await t1.locator('.toast-name').textContent()) === 'BOMB GLIDER');
    check('Item name uses its rarity color (epic)', (await t1.locator('.toast-name').getAttribute('class')).includes('rarity-epic'));
    check('Lists what it needs', (await t1.locator('.toast-detail').textContent()) === 'Needs 30 CHEMICALS · 2 STOCK ROD · 5 CONTROL UNIT', await t1.locator('.toast-detail').textContent());
    await page.waitForTimeout(300);   // let the slide-in finish before measuring
    const tb = await t1.boundingBox();
    check('Sits in the top right corner', near(tb.x + tb.width, 1400 - 20, 3) && tb.y <= 20, JSON.stringify(tb));
    await page.screenshot({ path: path.join(outDir, 'toast-added.png'), clip: { x: 900, y: 0, width: 500, height: 260 } });
    check('Page scroll unchanged by the message', await panelTopNow() > 400);
    await t1.click();
    await page.waitForTimeout(1500);   // smooth scroll is longer now the upgrades section sits above the pickers
    const shopTop = await page.locator('.shop-section').boundingBox();
    const panelBox = await page.locator('#rightPanel').boundingBox();
    check('Clicking the message scrolls up to the shopping list', shopTop.y >= panelBox.y - 1 && shopTop.y < panelBox.y + 120, `shop y ${shopTop.y}, panel y ${panelBox.y}`);
    await page.waitForTimeout(250);
    check('…and closes it', await toasts.count() === 0);

    await matChip('METALS').click();
    check('Material chip: added message', (await toasts.first().locator('.toast-name').textContent()) === 'METALS'
        && (await toasts.first().getAttribute('class')).includes('toast-add'));
    await matChip('METALS').click();
    check('Clicking again: "REMOVED FROM SHOPPING LIST" (amber)', (await toasts.first().locator('.toast-label').textContent()) === 'REMOVED FROM SHOPPING LIST'
        && (await toasts.first().getAttribute('class')).includes('toast-remove'));
    check('Newest message is on top', await toasts.count() === 2 && (await toasts.nth(1).locator('.toast-label').textContent()).startsWith('✓ ADDED'));
    await page.screenshot({ path: path.join(outDir, 'toast-stack.png'), clip: { x: 900, y: 0, width: 500, height: 300 } });
    for (const m of ['CPU', 'STOCK ROD', 'NYLON CLOTH']) await matChip(m).click();
    check('Never more than 3 at once', await toasts.count() === 3, String(await toasts.count()));
    check('Ingredient name uses its rarity color (rare)', (await toasts.first().locator('.toast-name').getAttribute('class')).includes('rarity-rare'));
    await page.waitForTimeout(3400);
    check('Messages fade out on their own after ~3s', await toasts.count() === 0, String(await toasts.count()));

    const dialogsBefore = dialogs.length;
    await matChip('CHEMICALS').click();   // needed by Medkit + Bomb Glider
    check('Craft-needed material: shows the explanation, no "removed" message', dialogs.length === dialogsBefore + 1
        && await toasts.count() === 0 && await row('CHEMICALS').count() === 1);
    await craftChip('Bomb Glider').click();
    check('Un-picking an item: removed message, no cost line', (await toasts.first().locator('.toast-label').textContent()) === 'REMOVED FROM SHOPPING LIST'
        && await toasts.first().locator('.toast-detail').count() === 0);
    await page.locator('.mat-add-form input').fill('cpu');
    await page.locator('.mat-add-form button[type=submit]').click();
    check('Adding something already listed says so', (await toasts.first().locator('.toast-label').textContent()) === 'ALREADY ON THE SHOPPING LIST');
    await page.locator('.mat-add-form input').fill('Rare Coin');   // brand-new material
    await page.locator('.mat-add-form select').selectOption('legendary');
    await page.locator('.mat-add-form button[type=submit]').click();
    check('Adding your own material: added message in its chosen rarity', (await toasts.first().locator('.toast-name').textContent()) === 'RARE COIN'
        && (await toasts.first().locator('.toast-name').getAttribute('class')).includes('rarity-legendary'));
    await page.waitForTimeout(3400);
    await pill('Medkit').getByRole('button', { name: '+' }).click();
    await row('CHEMICALS').locator('.mat-have').getByRole('button', { name: '+' }).click();
    check('No messages for edits inside the shopping list itself', await toasts.count() === 0);
    check('Messages don\'t block the page underneath (stack ignores clicks)', (await page.locator('.toast-stack').evaluate(n => getComputedStyle(n).pointerEvents)) === 'none');

    await page.setViewportSize({ width: 600, height: 900 });
    await matChip('METALS').click();
    const tp = await toasts.first().boundingBox();
    check('Phone width: message fits on screen', tp.x >= 0 && tp.x + tp.width <= 600, JSON.stringify(tp));

    // ---------------------------------------------------------------
    console.log('\n12. Shopping list sorted rarest first');
    await page.setViewportSize({ width: 1400, height: 900 });
    await page.evaluate(KEY => localStorage.setItem(KEY, JSON.stringify({
        ui: { mode: 'loadout', view: 'detail', dmzView: 'notes' }
    })), KEY);
    await page.reload();
    const RANK = { ultra: 5, legendary: 4, epic: 3, rare: 2, uncommon: 1, common: 0 };
    const rowRanks = () => shop.locator('.mat-row .mat-name').evaluateAll(ns => ns.map(n => {
        const m = n.className.match(/rarity-(\w+)/);
        return m ? m[1] : '';
    }));
    const isSorted = (rs) => rs.every((r, i) => i === 0 || (RANK[r] ?? -1) <= (RANK[rs[i - 1]] ?? -1));

    await craftChip('Medkit').click();
    await craftChip('UAV').click();
    await craftChip('Tempered Armor Vest').click();
    await matChip('CPU').click();
    await matChip('METALS').click();
    await page.locator('.mat-add-form input').fill('Rare Coin');
    await page.locator('.mat-add-form select').selectOption('ultra');
    await page.locator('.mat-add-form button[type=submit]').click();
    const expected = ['RARE COIN', 'MILITARY COMPOSITES', 'BALLISTIC FABRIC',
        'BINDING CATALYST', 'STRUCTURAL ALLOY', 'CPU',
        'BIOMATERIALS', 'ELECTRONIC SENSORS', 'RIGID SYNTHETICS',
        'CHEMICALS', 'ELECTRONICS', 'METALS'];
    const got = await rowNames();
    check('Exact order: Ultra → Legendary → Epic → Rare → Uncommon → base resources', JSON.stringify(got) === JSON.stringify(expected), got.join(', '));
    const ranks = await rowRanks();
    check('Every row is at least as rare as the one below it', isSorted(ranks), ranks.join(','));
    check('Base resources (no rarity) are at the bottom', JSON.stringify(got.slice(-3)) === JSON.stringify(['CHEMICALS', 'ELECTRONICS', 'METALS']));
    check('Same rarity keeps the order added (rare: Binding Catalyst, Structural Alloy, CPU)',
        JSON.stringify(got.slice(3, 6)) === JSON.stringify(['BINDING CATALYST', 'STRUCTURAL ALLOY', 'CPU']));
    s = await saved();
    check('Saved list keeps the order things were added (only the display is sorted)',
        s.materials.tracked.map(t => t.name).join(',') === ['CHEMICALS', 'BINDING CATALYST', 'BIOMATERIALS', 'ELECTRONICS', 'STRUCTURAL ALLOY',
            'ELECTRONIC SENSORS', 'MILITARY COMPOSITES', 'BALLISTIC FABRIC', 'RIGID SYNTHETICS', 'CPU', 'METALS', 'RARE COIN'].join(','),
        s.materials.tracked.map(t => t.name).join(','));

    await row('BINDING CATALYST').locator('.mat-have input').fill('2');
    await row('METALS').locator('.mat-have').getByRole('button', { name: '+' }).click();
    s = await saved();
    check('Counts go to the right material after sorting', s.materials.tracked.find(t => t.name === 'BINDING CATALYST').have === 2
        && s.materials.tracked.find(t => t.name === 'METALS').have === 1 && s.materials.tracked.find(t => t.name === 'CPU').have === 0);
    check('Row shows the right status after sorting (Binding Catalyst 2/1 = READY)', (await statusOf('BINDING CATALYST')) === 'READY');

    await craftChip('Self-Revive Kit').click();   // Biomaterials + Binding Catalyst, already listed
    check('Adding more keeps it sorted', isSorted(await rowRanks()) && JSON.stringify(await rowNames()) === JSON.stringify(expected));
    await pill('UAV').getByRole('button', { name: '×' }).click();
    const afterRemove = await rowNames();
    check('Removing an item keeps it sorted', isSorted(await rowRanks()) && !afterRemove.includes('STRUCTURAL ALLOY') && !afterRemove.includes('ELECTRONICS'), afterRemove.join(', '));
    await page.reload();
    check('Still sorted after reload', isSorted(await rowRanks()) && (await rowNames())[0] === 'RARE COIN');
    await page.mouse.move(0, 0);
    await page.evaluate(() => { document.getElementById('rightPanel').scrollTop = 0; });
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(outDir, 'shop-sorted.png') });

    console.log('\nJS errors on the page: ' + (errors.length ? '\n  ' + errors.join('\n  ') : 'none'));
    console.log(`\n${pass} passed, ${fail} failed`);
    await browser.close();
    process.exit(fail || errors.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
