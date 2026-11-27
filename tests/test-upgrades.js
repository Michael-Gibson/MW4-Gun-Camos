// Headless browser test: 3D Printer upgrades moved to Notes & Materials, with costs.
// usage: npm test (all suites) or: node tests/test-upgrades.js
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
const roman = (n) => ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'][n];

(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error' && !/fonts\.g/.test(m.text())) errors.push(m.text()); });
    const dialogs = [];
    page.on('dialog', d => { dialogs.push(d.message()); d.accept(); });

    const open = async (seed) => {
        await page.goto(url);
        await page.evaluate(([KEY, seed]) => localStorage.setItem(KEY, JSON.stringify(seed)), [KEY, seed]);
        await page.reload();
    };
    const saved = () => page.evaluate(KEY => JSON.parse(localStorage.getItem(KEY)), KEY);
    const ups = page.locator('.upgrades-section');
    const card = (name) => ups.locator('.upgrade-cost-card', { has: page.locator('.bp-card-name', { hasText: new RegExp(`^${name}$`) }) });
    const chipsOf = async (name) => (await card(name).locator('.upg-items .upg-chip').allInnerTexts()).map(s => s.replace(/\s+/g, ' ').trim());
    const headOf = async (name) => (await card(name).locator('.upg-cost-head').textContent()).trim();

    // ---------------------------------------------------------------
    console.log('\n1. Blueprints & Recipes no longer has upgrades');
    await open({ ui: { mode: 'loadout', view: 'detail', dmzView: 'blueprints' } });
    const bpText = await page.locator('#rightPanel').innerText();
    check('No UPGRADES heading or upgrade cards', !/\bUPGRADES\b\s+\d+\/\d+ MAXED/.test(bpText) && await page.locator('#rightPanel .upgrade-card').count() === 0);
    check('No "Upgrades maxed" stat card', !(await page.locator('.stat-card').allInnerTexts()).some(t => /Upgrades maxed/i.test(t)));
    const opts = await page.locator('.bp-add-form select').first().locator('option').allTextContents();
    check('Add form no longer offers UPGRADES', !opts.includes('UPGRADES') && opts[0] === 'CONSUMABLES', opts.join(','));
    check('Page points to where upgrades went', /3D Printer upgrades are on Notes & Materials/i.test(bpText));
    await page.locator('.bp-add-form input[type=text]').fill('Test Ration');
    await page.locator('.bp-add-form button[type=submit]').click();
    check('Adding a recipe still works', (await saved()).gear.some(g => g.name === 'TEST RATION' && g.category === 'CONSUMABLES'));
    check('Recipe categories still listed', bpText.includes('CONSUMABLES') && bpText.includes('FIRE SUPPORT'));

    // ---------------------------------------------------------------
    console.log('\n2. Upgrades on Notes & Materials (your starting tiers)');
    await open({ ui: { mode: 'loadout', view: 'detail', dmzView: 'notes' } });
    check('3D PRINTER UPGRADES section exists', await ups.count() === 1);
    const order = await page.evaluate(() => [...document.getElementById('rightPanel').children].map(n => n.className));
    const iTop = order.findIndex(c => c.includes('notes-top')), iUp = order.findIndex(c => c.includes('upgrades-section')), iPick = order.findIndex(c => c.includes('pick-section'));
    check('Order: notepad|shopping list, then upgrades, then pickers', iTop < iUp && iUp < iPick, order.join(' / '));
    check('Upgrades are separate from the shopping list', await page.locator('.shop-section .upgrade-cost-card').count() === 0);
    check('All 9 upgrades shown', await ups.locator('.upgrade-cost-card').count() === 9);
    check('Header shows 2/9 MAXED', (await ups.locator('.recipe-count').textContent()) === '2/9 MAXED');
    const names = await ups.locator('.bp-card-name').allTextContents();
    check('Maxed upgrades are listed last', JSON.stringify(names.slice(-2)) === JSON.stringify(['UNCOMMON INGREDIENT PRINTING', 'EPIC INGREDIENT PRINTING']), names.join(', '));

    // Every card's cost matches mw4-data.js for its next tier
    const data = await page.evaluate(() => window.MW4_TRACKER_DATA.dmzSettings.upgradeCosts);
    const st = await saved();
    let mismatches = [];
    for (const [name, tiers] of Object.entries(data)) {
        const u = st.upgrades.find(x => x.name === name.toUpperCase());
        if (u.maxed) continue;
        const t = tiers[u.built];
        const cashText = t.cash === null ? '$ ?' : t.cash === 0 ? 'NO CASH' : '$' + t.cash.toLocaleString('en-US');
        const expectChips = [cashText, ...Object.entries(t.items).map(([m, n]) => `${n}× ${m.toUpperCase()}`)];
        const got = (await chipsOf(name.toUpperCase())).map(s => s.replace(/\s*(RAID|CRAFT)$/, '').replace(/\s+/g, ' ').trim());
        if (JSON.stringify(got) !== JSON.stringify(expectChips)) mismatches.push(`${name}: got [${got}] want [${expectChips}]`);
        const head = await headOf(name.toUpperCase());
        if (head !== `NEXT: TIER ${roman(u.built + 1)}`) mismatches.push(`${name}: head "${head}"`);
    }
    check('Every in-progress card shows exactly its next tier\'s cost from the data', !mismatches.length, mismatches.join(' | '));

    check('Bank: next tier V, $500,000 + 10 Degraded Execution Footage', (await headOf('BANK UPGRADE')) === 'NEXT: TIER V'
        && (await chipsOf('BANK UPGRADE')).join('|').includes('$500,000') && (await chipsOf('BANK UPGRADE')).join('|').includes('DEGRADED EXECUTION FOOTAGE'));
    check('Bank says what the tier gives', (await card('BANK UPGRADE').locator('.upg-gives').textContent()) === 'Bank holds $5,000,000');
    check('Bank tier boxes: I–IV built, V next, VI–XIII shown', (await card('BANK UPGRADE').locator('.tier-box.built').count()) === 4
        && (await card('BANK UPGRADE').locator('.tier-box.next').textContent()) === 'V' && (await card('BANK UPGRADE').locator('.tier-box').count()) === 13);
    check('Raid items are marked RAID', (await card('BANK UPGRADE').locator('.upg-chip.raid .upg-tag').textContent()) === 'RAID');
    check('Ingredients use their rarity color', (await card('DOG TAG CASE UPGRADE').locator('.upg-chip', { hasText: 'RIGID SYNTHETICS' }).getAttribute('class')).includes('rarity-uncommon')
        && (await card('MIA RECOVERY DISCOUNT').locator('.upg-chip', { hasText: 'POWER REGULATOR' }).getAttribute('class')).includes('rarity-epic'));
    check('Vendor II confirmed in game: NO CASH with no ⚠ warning', (await headOf('VENDOR ITEM UPGRADE')) === 'NEXT: TIER II'
        && (await card('VENDOR ITEM UPGRADE').locator('.upg-cash').textContent()) === 'NO CASH'
        && await card('VENDOR ITEM UPGRADE').locator('.upg-verify').count() === 0);
    await card('MIA RECOVERY DISCOUNT').getByRole('button', { name: '+' }).click();
    check('Unknown cash shows "$ ?" (MIA IV)', (await headOf('MIA RECOVERY DISCOUNT')) === 'NEXT: TIER IV'
        && (await card('MIA RECOVERY DISCOUNT').locator('.upg-cash').textContent()) === '$ ?'
        && (await card('MIA RECOVERY DISCOUNT').locator('.upg-cash').getAttribute('class')).includes('unknown'));
    await card('MIA RECOVERY DISCOUNT').getByRole('button', { name: '−' }).click();
    check('No-cash tiers say "NO CASH" (MIA III)', (await card('MIA RECOVERY DISCOUNT').locator('.upg-cash').textContent()) === 'NO CASH'
        && (await card('MIA RECOVERY DISCOUNT').locator('.upg-cash').getAttribute('class')).includes('none'));
    check('MIA III confirmed in game: NO CASH with no ⚠ warning', await card('MIA RECOVERY DISCOUNT').locator('.upg-verify').count() === 0);
    await card('MIA RECOVERY DISCOUNT').getByRole('button', { name: '−' }).click();
    check('MIA II (not confirmed) still shows NO CASH with its ⚠ note', (await headOf('MIA RECOVERY DISCOUNT')) === 'NEXT: TIER II'
        && (await card('MIA RECOVERY DISCOUNT').locator('.upg-cash').textContent()) === 'NO CASH'
        && (await card('MIA RECOVERY DISCOUNT').locator('.upg-verify').textContent()).includes('No cash per one site'));
    await card('MIA RECOVERY DISCOUNT').getByRole('button', { name: '+' }).click();
    check('Back to MIA III', (await headOf('MIA RECOVERY DISCOUNT')) === 'NEXT: TIER III');
    check('Uncertain tiers show a ⚠ note', (await card('STASH ITEM UPGRADE').locator('.upg-verify').textContent()).includes('Slot count not confirmed'));
    check('Gunsmith II no longer flagged (3 sites agree on $100,000)', await card('GUNSMITH UPGRADE').locator('.upg-verify').count() === 0
        && (await chipsOf('GUNSMITH UPGRADE'))[0] === '$100,000');
    check('Built count shows "4 OF 13 BUILT"', (await card('BANK UPGRADE').locator('.upgrade-status').textContent()) === '4 OF 13 BUILT');
    check('Maxed card: gold, "MAXED AT II", no cost', (await card('EPIC INGREDIENT PRINTING').getAttribute('class')).includes('maxed')
        && (await headOf('EPIC INGREDIENT PRINTING')) === 'MAXED AT II' && await card('EPIC INGREDIENT PRINTING').locator('.upg-chip').count() === 0);
    check('Upgrades with cost data have no remove button', await ups.locator('.bp-card-top .icon-button').count() === 0);

    // ---------------------------------------------------------------
    console.log('\n3. Building tiers');
    await card('DOG TAG CASE UPGRADE').getByRole('button', { name: '+' }).click();
    check('+ moves Dog Tag Case to tier II', (await headOf('DOG TAG CASE UPGRADE')) === 'NEXT: TIER II');
    check('…and shows tier II\'s cost', JSON.stringify(await chipsOf('DOG TAG CASE UPGRADE')) === JSON.stringify(['$50,000', '20× DETONATORS', '10× NYLON CLOTH', '5× POWER REGULATOR']),
        (await chipsOf('DOG TAG CASE UPGRADE')).join(','));
    check('Saved: Dog Tag Case built 1', (await saved()).upgrades.find(u => u.name === 'DOG TAG CASE UPGRADE').built === 1);
    await card('DOG TAG CASE UPGRADE').getByRole('button', { name: '−' }).click();
    check('− goes back to tier I', (await headOf('DOG TAG CASE UPGRADE')) === 'NEXT: TIER I' && (await chipsOf('DOG TAG CASE UPGRADE'))[0] === '$10,000');
    check('− is disabled at 0 built', await card('DOG TAG CASE UPGRADE').getByRole('button', { name: '−' }).isDisabled());
    await card('GUNSMITH UPGRADE').getByRole('button', { name: '+' }).click();
    check('Past the last known tier: says costs aren\'t known yet', (await card('GUNSMITH UPGRADE').locator('.upg-unknown').textContent()).includes("Tier III costs aren't known yet"));
    await card('GUNSMITH UPGRADE').locator('.bp-card-claim input').check();
    check('Ticking Maxed: card turns gold and moves to the end', (await ups.locator('.bp-card-name').allTextContents()).slice(-3)[0] === 'GUNSMITH UPGRADE'
        && (await card('GUNSMITH UPGRADE').getAttribute('class')).includes('maxed'));
    check('Header updates to 3/9 MAXED', (await ups.locator('.recipe-count').textContent()) === '3/9 MAXED');
    await card('GUNSMITH UPGRADE').locator('.bp-card-claim input').uncheck();
    await card('GUNSMITH UPGRADE').getByRole('button', { name: '−' }).click();
    check('Unticking + − restores Gunsmith to tier II with its cost', (await headOf('GUNSMITH UPGRADE')) === 'NEXT: TIER II' && (await chipsOf('GUNSMITH UPGRADE'))[0] === '$100,000');
    check('Upgrade changes don\'t add anything to the shopping list', await page.locator('.shop-section .mat-row').count() === 0
        && await page.locator('.shop-section .craft-pill').count() === 0 && await page.locator('.toast').count() === 0);
    await page.reload();
    check('Tiers saved across reload', (await headOf('GUNSMITH UPGRADE')) === 'NEXT: TIER II' && (await headOf('BANK UPGRADE')) === 'NEXT: TIER V');

    // ---------------------------------------------------------------
    console.log('\n4. Older saves');
    await open({
        upgrades: [{ name: 'BANK UPGRADE', built: 6, maxed: false }, { name: 'ARMORY UPGRADE', built: 1, maxed: false }],
        seededUpgrades: ['BANK UPGRADE', 'DOG TAG CASE UPGRADE', 'STASH ITEM UPGRADE', 'STASH WEAPON UPGRADE', 'MIA RECOVERY DISCOUNT',
            'GUNSMITH UPGRADE', 'VENDOR ITEM UPGRADE', 'UNCOMMON INGREDIENT PRINTING', 'EPIC INGREDIENT PRINTING'],
        ui: { mode: 'loadout', view: 'detail', dmzView: 'notes' }
    });
    check('Your saved tier is kept (Bank built 6 → next VII)', (await headOf('BANK UPGRADE')) === 'NEXT: TIER VII'
        && (await chipsOf('BANK UPGRADE')).join('|').includes('W.M.D. MANIFEST'));
    check('Missing upgrades are filled in (all 9 + your own)', await ups.locator('.upgrade-cost-card').count() === 10);
    check('Your own upgrade shows "no cost data"', (await card('ARMORY UPGRADE').locator('.upg-unknown').textContent()).includes('No cost data'));
    await card('ARMORY UPGRADE').locator('.bp-card-top .icon-button').click();
    check('…and can be removed (asks first)', await card('ARMORY UPGRADE').count() === 0 && dialogs.some(d => d.includes('ARMORY UPGRADE')));
    check('Removal saved', !(await saved()).upgrades.some(u => u.name === 'ARMORY UPGRADE'));

    // ---------------------------------------------------------------
    console.log('\n4b. Bank XII and XIII (top tiers)');
    await open({ upgrades: [{ name: 'BANK UPGRADE', built: 11, maxed: false }], ui: { mode: 'loadout', view: 'detail', dmzView: 'notes' } });
    check('Bank built 11 → next tier XII', (await headOf('BANK UPGRADE')) === 'NEXT: TIER XII' && (await card('BANK UPGRADE').locator('.upg-gives').textContent()) === 'Bank holds $1,000,000,000');
    check('XII: "$ ?", 20 Gold Bar, 20 Gold Skull, 3 Irradiated Container, 3 Fulton Drop Marker',
        JSON.stringify((await chipsOf('BANK UPGRADE')).map(s => s.replace(/\s*(RAID|CRAFT)$/, '')))
        === JSON.stringify(['$ ?', '20× GOLD BAR', '20× GOLD SKULL', '3× IRRADIATED CONTAINER', '3× FULTON DROP MARKER']), (await chipsOf('BANK UPGRADE')).join(','));
    const fulton = card('BANK UPGRADE').locator('.upg-chip', { hasText: 'FULTON DROP MARKER' });
    check('Fulton Drop Marker is tagged CRAFT in its rarity (ultra)', (await fulton.locator('.upg-tag').textContent()) === 'CRAFT'
        && (await fulton.getAttribute('class')).includes('craft') && (await fulton.getAttribute('class')).includes('rarity-ultra'));
    check('Irradiated Container is tagged RAID', (await card('BANK UPGRADE').locator('.upg-chip', { hasText: 'IRRADIATED CONTAINER' }).locator('.upg-tag').textContent()) === 'RAID');
    check('XII flagged as one site only', (await card('BANK UPGRADE').locator('.upg-verify').textContent()).includes('Only one site'));
    await card('BANK UPGRADE').getByRole('button', { name: '+' }).click();
    check('XIII: 3 DRC lockers (RAID) + 5 Door Breacher Charge (CRAFT)', (await headOf('BANK UPGRADE')) === 'NEXT: TIER XIII'
        && await card('BANK UPGRADE').locator('.upg-chip.raid').count() === 3
        && (await card('BANK UPGRADE').locator('.upg-chip.craft').innerText()).replace(/\s+/g, ' ').trim() === '5× DOOR BREACHER CHARGE CRAFT');
    await page.locator('.upgrades-section').scrollIntoViewIfNeeded();
    await card('BANK UPGRADE').getByRole('button', { name: '−' }).click();
    await card('BANK UPGRADE').scrollIntoViewIfNeeded();
    await page.mouse.move(0, 0);
    await card('BANK UPGRADE').screenshot({ path: path.join(outDir, 'bank-xii.png') });
    await card('BANK UPGRADE').getByRole('button', { name: '+' }).click();
    await card('BANK UPGRADE').getByRole('button', { name: '+' }).click();
    check('After XIII: "costs aren\'t known yet"', (await card('BANK UPGRADE').locator('.upg-unknown').textContent()).includes("Tier XIV costs aren't known yet"));
    await card('MIA RECOVERY DISCOUNT').scrollIntoViewIfNeeded();
    await card('MIA RECOVERY DISCOUNT').screenshot({ path: path.join(outDir, 'mia-nocash.png') });

    // ---------------------------------------------------------------
    console.log('\n5. "Crafting for" items sorted rarest first');
    const craftChip = (n) => page.locator('.craft-chip', { has: page.locator('.craft-chip-name', { hasText: new RegExp(`^${n}$`, 'i') }) });
    for (const n of ['Medkit', 'Bandage', 'Tempered Armor Vest', 'Self-Revive Kit']) await craftChip(n).click();
    const pills = await page.locator('.shop-section .craft-pill-name').allTextContents();
    check('Order: Tempered (ultra), Self-Revive (legendary), Medkit (epic), Bandage (uncommon)',
        JSON.stringify(pills) === JSON.stringify(['TEMPERED ARMOR VEST', 'SELF-REVIVE KIT', 'MEDKIT', 'BANDAGE']), pills.join(', '));
    await page.locator('.shop-section .craft-pill', { hasText: 'MEDKIT' }).getByRole('button', { name: '+' }).click();
    check('+ on a sorted pill changes the right item', (await saved()).materials.crafting.find(c => c.name === 'MEDKIT').qty === 2
        && (await saved()).materials.crafting.find(c => c.name === 'BANDAGE').qty === 1);
    await page.locator('.shop-section .craft-pill', { hasText: 'BANDAGE' }).getByRole('button', { name: '×' }).click();
    check('× on a sorted pill removes the right item', JSON.stringify(await page.locator('.shop-section .craft-pill-name').allTextContents())
        === JSON.stringify(['TEMPERED ARMOR VEST', 'SELF-REVIVE KIT', 'MEDKIT']));

    // ---------------------------------------------------------------
    console.log('\n6. Phone width');
    await page.setViewportSize({ width: 600, height: 900 });
    const cw = await ups.locator('.upgrade-cost-card').first().boundingBox();
    const sw = await ups.boundingBox();
    check('Cards go one per row', cw.width > sw.width * 0.8);
    check('No sideways scrolling', await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth));

    console.log('\nJS errors on the page: ' + (errors.length ? '\n  ' + errors.join('\n  ') : 'none'));
    console.log(`\n${pass} passed, ${fail} failed`);
    await browser.close();
    process.exit(fail || errors.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
