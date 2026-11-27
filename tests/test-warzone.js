// Headless browser test: the WARZONE view on the Camo Track.
// Every released gun shows Warzone text for its Special and Completionist camos, and
// ticks are shared with Multiplayer and DMZ.
// usage: npm test (all suites) or: node tests/test-warzone.js
const { chromium } = require('playwright-core');
const path = require('path');

const projectDir = process.argv[2] || path.resolve(__dirname, '..'); // the app folder (tests/ lives inside it)
const outDir = path.join(__dirname, 'output'); // screenshots and test files (not committed)
require('fs').mkdirSync(outDir, { recursive: true });
const url = 'file:///' + path.join(projectDir, 'index.html').split(path.sep).join('/');
const KEY = 'mw4-tracker-v1';
const NOT_PUBLISHED = 'Warzone challenge not published yet';

// The approved Warzone text (researched 27 Nov 2026), kept here on purpose, separate from
// mw4-data.js, so a wrong edit to the data is caught. Special camos in specialCamos order.
const SPECIAL = {
    'HAN 86': ['Get 10 mounted kills against players', 'Get 25 player kills while using a suppressor', 'Get 3 player kills without dying 8 times'],
    'M4': ['Get 10 point blank kills against players', 'Get 10 mounted kills against players', 'Get 15 kills from behind players'],
    'KASTOV 762': ['Get 3 kills without dying 5 times', 'Get 10 longshot kills against players', 'Get 15 hipfire kills against players'],
    'AXION': ['Get 10 longshot kills against players', 'Get 10 player kills with the Miri 40mm Grenade Launcher', 'Get 2 kills without reloading 15 times against players'],
    'CRONEN SQUALL': ['Get 10 point blank kills against players', 'Get 10 mounted kills against players', 'Get 3 kills without dying 10 times against players'],
    'CRONEN OSPREY': ['Get 10 hipfire kills against players', 'Get 30 kills while ADS against players', 'Get 2 kills without reloading 20 times against players'],
    'PATRIOT XMR': ['Get 10 hipfire kills against players', 'Get 25 player kills while using a suppressor', 'Get 15 longshot kills against players'],
    'ODEN': ['Get 15 player kills with the Miri 40mm Grenade Launcher', 'Get 2 kills without reloading 5 times against players', 'Get 45 kills while ADS against players'],
    'HYEON BURST': ['Get 2 kills without reloading 5 times against players', 'Get 10 longshot kills against players', 'Get 45 player kills while using a suppressor'],
    'WZ.55 STRIGA': ['Get 25 player kills while using a suppressor', 'Get 10 player kills while jumping', 'Get 20 point blank kills against players'],
    'X-58 NYX': ['Get 10 player kills while moving', 'Get 10 longshot kills against players', 'Get 20 headshot kills against players'],
    'CSG-35': ['Get 3 player kills without dying 5 times', 'Get 30 player kills while using a suppressor', 'Get 20 player kills while moving'],
    'ISO NIGHTSHADE': ['Get 25 player kills while ADS', 'Get 2 kills within 10 seconds 5 times', 'Get 10 longshot kills against players'],
    'PPSH-41': ['Get 2 kills within 10 seconds 5 times', 'Get 10 longshot kills against players', 'Get 45 player kills while ADS'],
    'VEL 46': ['Get 25 player kills while ADS', 'Get 10 player kills while prone', 'Get 10 headshots against players'],
    'REZI-12': ['Get 10 point blank kills against players', 'Get 5 longshot kills against players', 'Get 20 player kills while jumping'],
    'JAK 12': null,
    'WARLORD': ['Get 10 player kills while moving', 'Get 2 kills within 10 seconds 5 times', 'Get 25 player kills while prone'],
    'FINN LMG': ['Get 10 point blank kills against players', 'Get 2 kills without reloading 5 times against players', 'Get 15 longshot kills against players'],
    'TYPE 73': ['Get 10 mounted kills against players', 'Get 2 kills within 10 seconds 5 times', 'Get 20 headshot kills against players'],
    'APOC-338': ['Get 10 hipfire kills against players', 'Get 10 longshot kills against players', 'Get 45 player kills while prone'],
    'MAR-9': ['Get 10 mounted kills against players', 'Get 15 player kills while crouched', 'Get 15 longshot kills against players'],
    'ORIS 8.6': ['Get 5 quickscope kills against players', 'Get 2 player kills within 10 seconds 10 times', 'Get 3 kills without dying 10 times against players'],
    'MOSIN-NAGANT': ['Get 15 headshots against players', 'Get 2 player kills without reloading 5 times', 'Get 45 player kills while focused'],
    'SIGNAL 50': ['Get 2 player kills within 5 seconds 5 times', 'Get 10 quickscope kills against players', 'Get 20 longshot kills against players'],
    'KG-7 VULCAN': ['Get 5 hipfire kills against players', 'Get 10 headshot kills against players', 'Get 2 player kills without taking damage 10 times'],
    'ASTAROTH .57': ['Get 3 player kills without dying 5 times', 'Get 10 mounted kills against players', 'Get 2 player kills within 5 seconds 10 times'],
    'SANG 9MM': ['Get 15 player kills while ADS', 'Get 3 player kills without dying 3 times', 'Get 25 player kills while using Akimbo'],
    'KRAIT P68': ['Get 10 sliding kills', 'Get 10 point blank kills against players', 'Get 25 player kills while using a suppressor'],
    '.50 GS': ['Get 10 headshot kills against players', 'Get 2 kills within 10 seconds 5 times', 'Get 15 point blank kills against players'],
    'MOJAVE .357': ['Get 10 player kills without taking damage from the target', 'Get 2 player kills without reloading 5 times', 'Get 15 point blank kills against players'],
    'RPG-8': ['Get 5 player kills while prone', 'Get 5 longshot kills against players', 'Destroy 15 killstreaks or enemy vehicles'],
    'PILA': ['Get 5 direct shot kills against players', 'Get 2 kills within 10 seconds 3 times', 'Destroy 15 killstreaks or enemy vehicles'],
    'JOKR': ['Get 2 kills within 10 seconds 3 times', 'Get 5 longshot kills against players', 'Destroy 15 killstreaks or vehicles'],
    'PM-40 ANVIL': ['Get 10 direct shot kills against players', 'Get 2 kills without reloading 3 times against players', 'Get 20 player kills while moving'],
    'FSS CARBON EDGE 1095': ['Get 15 player kills while jumping', 'Get 15 player kills using the heavy melee finisher', 'Get 2 kills within 5 seconds 15 times against players'],
    'ZLR TALONHAWK': null
};
const CLASS = { // [platinum, harmonic]; Gold is the same for every class
    'ASSAULT RIFLES': ['Get 25 headshots against players', 'Get 2 player kills within 10 seconds 15 times'],
    'SMGS': ['Get 15 player kills from behind', 'Get 25 hipfire kills against players'],
    'SHOTGUNS': ['Get 25 hipfire kills against players', 'Get 2 player kills without reloading 15 times'],
    'LMGS': ['Get 3 player kills without dying 10 times', 'Get 2 player kills without releasing the trigger 15 times'],
    'MARKSMAN RIFLES': ['Get 35 player kills while prone', 'Get 45 player kills without taking damage from the target'],
    'SNIPER RIFLES': ['Get 35 player kills while prone', 'Get 35 one shot kills against players'],
    'PISTOLS': ['Get 10 player kills from behind', 'Get 20 hipfire kills against players'],
    'LAUNCHERS': ['Get 2 player kills without taking damage 8 times', 'Get 10 player kills in a match 5 times'],
    'MELEE': ['Get 3 kills without dying 10 times against players', 'Get 15 player kills from behind']
};
const GOLD = 'Get 8 player kills in a single match';

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
    const track = (gun, view) => ({ ui: { mode: 'track', view: 'detail', gun, trackMode: view } });
    const saved = () => page.evaluate(KEY => JSON.parse(localStorage.getItem(KEY)), KEY);
    const rows = () => page.locator('.camo-row').evaluateAll(rs => rs.map(r => [r.querySelector('.camo-name').textContent, (r.querySelector('.camo-challenge') || {}).textContent || '']));
    const row = (name) => page.locator('.camo-row', { has: page.locator('.camo-name', { hasText: new RegExp(`^${name}$`) }) });
    const viewBtn = (label) => page.locator('.view-toggle .segment', { hasText: new RegExp(`^${label}$`) });

    await page.goto(url);

    // ---------------------------------------------------------------
    console.log('\n1. The toggle');
    await open(track('M4', 'mp'));
    check('Toggle has MULTIPLAYER / DMZ / WARZONE', (await page.locator('.view-toggle .segment').allTextContents()).join() === 'MULTIPLAYER,DMZ,WARZONE');
    await viewBtn('WARZONE').click();
    check('WARZONE: subtitle "WARZONE camo track", button active', /^WARZONE camo track$/i.test(await page.locator('.panel-subtitle').first().textContent())
        && await viewBtn('WARZONE').evaluate(e => e.classList.contains('active')));
    check('Choice is saved (trackMode "wz") and kept for other guns', (await saved()).ui.trackMode === 'wz');
    await page.locator('.gun-list-item', { hasText: 'HAN 86' }).first().click();
    check('…Han 86 opens in WARZONE too', await viewBtn('WARZONE').evaluate(e => e.classList.contains('active')));
    check('Hint: shared between Multiplayer, DMZ and Warzone', (await page.locator('.panel-hint').first().textContent()).includes('shared between Multiplayer, DMZ and Warzone'));
    check('Footer: "0/15 WARZONE camos completed"', /0\/15 WARZONE camos completed/i.test(await page.locator('.progress-text').textContent()));
    await page.screenshot({ path: path.join(outDir, 'warzone-han86.png') });

    // ---------------------------------------------------------------
    console.log('\n2. Every gun: Warzone text for Military, Special and Completionist');
    const types = await page.evaluate(() => window.MW4_TRACKER_DATA.weaponsByType);
    const military = await page.evaluate(() => {
        const by = Object.assign({}, ...Object.values(window.MW4_TRACKER_DATA.weapons));
        return Object.fromEntries(Object.entries(by).map(([g, w]) => [g, w.track.filter(c => c.section === 'MILITARY').map(c => c.challenge.mp)]));
    });
    const wrong = [];
    for (const [type, guns] of Object.entries(types)) {
        for (const gun of guns) {
            await open(track(gun, 'wz'));
            const r = await rows();
            const want = [
                ...military[gun],                                   // same text as MP (weapon level)
                ...(SPECIAL[gun] || ['', '', '']),                  // unreleased guns: blank
                GOLD, CLASS[type][0], CLASS[type][1],
                'Earned once for your account after 33 Harmonic Break challenges; it unlocks on every weapon at once'
            ];
            const got = r.map(x => x[1]);
            if (r.length !== 15 || got.some((t, i) => t !== want[i])) wrong.push(`${gun}: ${got.map((t, i) => t === want[i] ? '·' : `[${i}] "${t}" ≠ "${want[i]}"`).filter(x => x !== '·').join('; ')}`);
        }
    }
    check('All 37 guns × 15 camos show the right Warzone text', !wrong.length, wrong.slice(0, 4).join('\n      '));
    const released = Object.values(types).flat().filter(g => SPECIAL[g]).length;
    check(`${released} released guns have all 3 Special Warzone challenges; JAK 12 and Talonhawk blank`, released === 35);

    // ---------------------------------------------------------------
    console.log('\n3. Spot checks and placeholders');
    await open(track('RPG-8', 'wz'));
    check('Launcher Destroy challenge reads "Destroy 15 killstreaks or enemy vehicles"', (await row('BUBBLEGUM OPS').locator('.camo-challenge').textContent()) === 'Destroy 15 killstreaks or enemy vehicles');
    await open(track('M4', 'mp'));
    check('MP text unchanged (M4 Myriad "Get 20 point blank kills")', (await row('MYRIAD').locator('.camo-challenge').textContent()) === 'Get 20 point blank kills');
    await open(track('M4', 'dmz'));
    check('DMZ text unchanged (M4 Myriad "Get 75 point blank kills")', (await row('MYRIAD').locator('.camo-challenge').textContent()) === 'Get 75 point blank kills');
    const placeholder = await page.evaluate((NP) => {
        // A named camo with no Warzone text would say "not published yet"; none should today
        const by = Object.assign({}, ...Object.values(window.MW4_TRACKER_DATA.weapons));
        return Object.values(by).flatMap(w => w.track).filter(c => c.challenge.wz === NP).length;
    }, NOT_PUBLISHED);
    check('No released camo is missing its Warzone text', placeholder === 0);

    // ---------------------------------------------------------------
    console.log('\n4. Ticks are shared across all three views');
    await open(track('M4', 'wz'));
    await row('MYRIAD').locator('input[type=checkbox]').check();
    await row('GOLD').locator('input[type=checkbox]').check();
    let sv = await saved();
    check('Ticked in Warzone → saved under the same ids (sp1, gold)', sv.camos.track.M4.sp1 === true && sv.camos.track.M4.gold === true);
    await viewBtn('MULTIPLAYER').click();
    check('…shows ticked in MULTIPLAYER', await row('MYRIAD').locator('input[type=checkbox]').isChecked() && await row('GOLD').locator('input[type=checkbox]').isChecked());
    await viewBtn('DMZ').click();
    check('…and in DMZ', await row('MYRIAD').locator('input[type=checkbox]').isChecked());
    check('Weapon list counts it once (2/15)', (await page.locator('.gun-list-item', { hasText: 'M4' }).first().innerText()).includes('2/15'));
    await open({ camos: { track: { M4: { mil1: true, sp2: true } } }, ...track('M4', 'wz') });
    check('Ticks saved before Warzone existed show in the Warzone view', await row('MILITARY 1').locator('input[type=checkbox]').isChecked() && await row('NIGHT OPS').locator('input[type=checkbox]').isChecked());
    check('Gold lock line works in Warzone (2/11)', (await row('GOLD').locator('.camo-lock').first().textContent()).includes('2/11'));

    // ---------------------------------------------------------------
    console.log('\n5. Other pages');
    await open({ levels: { M4: { stage: 0, level: 40 } }, ...track('M4', 'wz') });
    check('SET LEVEL card works in Warzone (Myriad ✓ OPEN)', (await row('MYRIAD').locator('.level-lock').textContent()) === '✓ OPEN · weapon level reached');
    await open({ ui: { mode: 'track', view: 'stats', trackMode: 'wz' } });
    check('Stats page opens with Warzone picked, no errors', await page.locator('.right-panel, #rightPanel').first().isVisible() && !errors.length);

    // ---------------------------------------------------------------
    console.log('\n6. Phone width');
    await page.setViewportSize({ width: 390, height: 844 });
    await open(track('KG-7 VULCAN', 'wz'));
    check('All 3 view buttons visible', await viewBtn('WARZONE').isVisible() && await viewBtn('MULTIPLAYER').isVisible());
    check('No sideways scrolling', await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth));
    await viewBtn('WARZONE').scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(outDir, 'warzone-phone.png') });

    console.log('\nJS errors on the page: ' + (errors.length ? '\n  ' + errors.join('\n  ') : 'none'));
    console.log(`\n${pass} passed, ${fail} failed`);
    await browser.close();
    process.exit(fail || errors.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
