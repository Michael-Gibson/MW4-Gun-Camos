# MW4 Camo Tracker

A browser-based tracker for the Call of Duty: Modern Warfare 4 camo grind. You can tick off camos for every weapon, track Mastery and Prestige progress, and manage a DMZ loadout: weapon manuals, 3D Printer blueprints, crafting materials and your own goals.

It's plain HTML, CSS and JavaScript. There's no build step, no dependencies and no server. Progress is saved in your browser.

## Getting started

1. Clone or download this repository.
2. Open `index.html` in any modern browser.

That's it. If you'd rather serve it locally (for example, to use it on a second monitor or another device on your network), any static file server works:

```bash
npx serve .
# or
python -m http.server
```

## Features

### Camo tabs

| Tab | What it tracks |
| --- | --- |
| **Camo Track** | The full per-weapon track: 8 Military camos (each shows the weapon level that unlocks it, e.g. "Reach weapon level 26"), 3 weapon-specific Special camos (each shows the weapon level that opens it, e.g. "Opens at weapon level 46"), then Gold → Platinum → Harmonic Break → Divergence. A **Multiplayer / DMZ / Warzone** toggle switches the challenge text for each view (Warzone has its own, usually smaller, targets for the Special and Completionist camos). Every camo is shared across the three modes, as in game, so checking one in any view marks it done in all of them. Gold, Platinum, Harmonic Break and Divergence each show a live **LOCKED / ✓ OPEN** line built from what you've ticked, for example "LOCKED · 6/8 Assault Rifle Golds" plus the weapons that still need Gold, or "12/33 Platinum camos (any weapon)". **Divergence is account-wide:** tick it on any weapon and it's done on all, and it's earned automatically at 33 Harmonic Breaks. **SET LEVEL:** a button at the top of each gun opens a menu that asks whether you've prestiged the gun (No / Prestige 1 / Prestige Master) and its level. Saving ticks every Military camo the gun has reached (all 8 once it's prestiged) and every Prestige camo it qualifies for, and a message says which. Each Military, Special and Prestige camo you haven't ticked then shows **✓ OPEN** or what's still needed ("LOCKED · 11 levels to go"), the card says what's next ("Next: MILITARY 5 at level 44 (4 levels away)"), and the weapon list shows a badge (**LV 40**, **P1 · LV 5**, **PM 160**). Nothing is ever unticked, and Specials are never ticked for you, because they also need their challenge. |
| **Prestige** | Weapon Prestige camos (the Pyroclast set), per weapon, each with how to get it: Pyroclast at Prestige 1, Terminus at max level again in Prestige 1 (which starts Prestige Master), Scatter at Prestige Master level 150, Cascade at 250. The same **SET LEVEL** card is here, and ticks the ones you've reached. |
| **Mastery** | The account-wide Mastery camos, with **Multiplayer**, **DMZ** and **Warzone** side by side. Each camo shows its challenge, the camo it needs first, and a progress counter (e.g. 112 / 300) that ticks the camo done when you reach the target. A **Divergence** box at the top counts your Harmonic Breaks toward the 33 that open Mastery. |

Camo Track and Prestige are tracked per weapon. Mastery isn't: in game any weapon counts toward it, and each Mastery camo unlocks on every weapon at once.

The weapon list on the left is grouped by class and searchable. Each weapon is colored by the highest tier it has reached (all camos up to that tier must be checked in order). A class header only lights up once **every** weapon in that class reaches the tier.

### DMZ Loadout

- **Weapons & Manuals:** mark which weapons are unlocked at the Gunsmith (click a card's **LOCKED / ✓ GUNSMITH** button) and, separately, how many Weapon Manuals you've extracted toward the *War Spoils* camo (click the diamonds, 3 needed), plus per-weapon blueprints. Click anywhere else on a card to open that weapon; **← All weapons** takes you back to the same spot in the list. The overview works well on a second monitor.
- **Blueprints & Recipes:** a checklist of 3D Printer recipes grouped like the in-game menu, with rarity tags.
- **Notes & Materials:** a notepad (left) next to your shopping list (right). Pick the items you're crafting, or click base resources and ingredients, in the section below, and the shopping list fills in the materials you need with have/need counts, sorted rarest first (Ultra at the top, base resources at the bottom). Long lists scroll inside the shopping list so the notepad stays beside it; on narrow screens the two stack. A message pops up in the top right corner whenever something is added to or removed from the list (click it to jump up to the list). Below that, **3D Printer Upgrades** shows every upgrade with its tier (I, II, III…) and the cash and materials the next tier needs, including raid items like intel documents and Gold Bars, kept separate from the shopping list. Press **+** when you build a tier.

### Challenges

Set your own DMZ goals: money targets (accepts `250k`, `1.5m`, `$1,000,000`), counters (extracts, contracts, compounds…) or checklists. Quick-start templates fill in the form for common goals.

### Stats

Overall completion for the Camo Track, Prestige and Mastery, plus DMZ manual and recipe totals.

## Saving, backup and reset

- Progress is stored in `localStorage` under the key `mw4-tracker-v1`. It stays in the browser you use. Clearing site data or switching browsers or devices starts you fresh.
- **Export** downloads a `mw4-tracker-backup-YYYY-MM-DD.json` file with all your progress.
- **Import** restores a backup file. It replaces your current progress, so it asks you to confirm first.
- **Reset** clears everything. Export first if you might want it back.

## Running the tests

The `tests/` folder has browser tests that drive the real app in headless Microsoft Edge, which is installed on Windows by default. They cover:
- DMZ weapon cards and the Season 1 camos;
- Camo Track lock status and account-wide Divergence;
- Military unlock levels for every gun;
- Special camo unlock levels for every gun;
- the SET LEVEL menu (level + prestige, auto-ticking Military and Prestige camos);
- the Warzone view (Warzone text for every gun, shared ticks);
- Notes & Materials (layout, shopping list, messages, sorting);
- 3D Printer upgrades and costs;
- the Mastery tab;
- Export, Reset and Import, including old backups.

You need [Node.js](https://nodejs.org) to run them:

```bash
cd tests
npm install   # first time only: installs playwright-core
npm test      # runs every suite and prints a summary
```

You can also run one suite on its own, for example `node tests/test-mastery.js`. Screenshots and files the tests create go to `tests/output/`, which isn't committed. The app itself still has no dependencies.

## Customizing the data

All game data is in [`mw4-data.js`](mw4-data.js), and the app logic in [`script.js`](script.js) reads it from `window.MW4_TRACKER_DATA`. Comments throughout the data file explain each section. Common edits:

| To change… | Edit |
| --- | --- |
| Weapons or classes | `gunTypes` and `weaponsByType` |
| Military camo unlock levels | `militaryLevels` (use `0` if unknown). If the game only shows a countdown, use `fromRemaining(currentLevel, [...])` |
| Special camo unlock levels | `specialLevels` (use `0` if unknown) |
| Special camo names and challenges | `specialCamos` |
| Special camo Warzone challenges | `specialWarzone` |
| Gold / Platinum / Harmonic Break challenges | `classChallenges` (Warzone: `classWarzone`) |
| Mastery camos (challenges, targets, order) | `masteryModes`, and `masteryGate` for Divergence |
| Prestige camos | `modeCamos` |
| 3D Printer categories and recipes | `dmzSettings.recipeCategories`, `recipeCatalog` and `upgradeCatalog` (bump `catalogVersion` after changing rarity or obtained flags on existing items) |
| Materials and crafting costs | `dmzSettings.materialCatalog` and `craftingRecipes` (add a `materialRenames` entry when you rename a material) |
| 3D Printer upgrade costs per tier | `dmzSettings.upgradeCosts` (cash, items, what the tier gives, and an optional `verify` note) |
| Challenge quick-start buttons | `dmzSettings.challengeTemplates` |

Tier and rarity colors are defined in [`styles.css`](styles.css) under **TIER COLORS** and **RARITY COLORS**.

> **Heads-up:** progress is saved by weapon name and camo id. Renaming a weapon resets that weapon's checkboxes, and changing a camo's `id` drops its saved state.

### Data accuracy

Challenge text comes from Infinity Ward's progression blog and community camo guides from launch week. Season 1 weapons (Cronen Osprey, CSG-35) come from community guides published after they released. Military unlock levels were checked across 4–6 community sites for every gun (Nov 2026), plus some in game: the M4's Military 1 matched the sites, but the sites had both Season 1 guns wrong. The M4's Military 5–8 are 44, 51, 59, 64 in game, which matches codcentral.net's screenshots, not the other sites (39, 44, 51, 59). All eight M4 and Hyeon Burst levels were checked in game, and the Hyeon Burst's Military 8 is 62. The Cronen Osprey's eight Military levels (12, 19, 25, 33, 40, 48, 55, 63) were all checked in game. So were the CSG-35's (11, 15, 19, 23, 27, 31, 35, 39). Special camo unlock levels (Nov 2026) are official for the Han 86 and Sang 9mm. For most other guns they come from a community sheet that matches the official guns, cross-checked with in-game screenshots on codcentral.net. The Cronen Osprey, CSG-35, Kastov 762, Axion and Mosin-Nagant were checked in game, because the sites disagreed or had nothing. So were the APOC-338 and Oris 8.6. The sheet was 1 too high on the Mosin-Nagant's first Special and on all three APOC-338 and Oris 8.6 Specials, so values from the sheet alone could be off by one: the Oden, Mojave .357, launchers, FSS Carbon Edge 1095, and some later Specials. The Mojave .357 (16, 30, 44) is still unconfirmed: its max level is 44, and one guide's countdowns suggest 15, 29, 43. Weapon Prestige rules and the Prestige camo requirements come from the official progression blog (Oct 2026) and about eight guides. Scatter is Prestige Master level 150; codmunity's 160 is the only source that disagrees. The JAK 12 and ZLR Talonhawk Military levels and Special camos haven't been revealed (both are upcoming in-season event rewards). 3D Printer upgrade costs come from community sites (Nov 2026); several later tiers are community-reported or have no confirmed cash cost, and those show a ⚠ note or "$ ?" in the app. MIA Recovery IV still has no confirmed cash cost. Warzone challenges (MW4 weapons joined Warzone in Season 1, 6 Nov 2026) come from codmunity.gg, bosslobbies.com, gamerant and metaradar (Nov 2026); 3–5 sites agree on almost every one. Two are worth checking in game: the FiNN LMG's Green Tiger (two sites say "2 kills without reloading 5 times", one says "2 kills within 10 seconds 5 times") and the Pistol Harmonic Break (20 hipfire kills on three sites, 10 on one). The ISO Nightshade's Brown is a longshot challenge in Warzone on every site, unlike MP and DMZ. Unlock rules for the Completionist camos follow the in-game wording (Nov 2026):
- **Platinum** needs a fixed number of Golds per class, set at launch (AR 8, SMG 5, Shotgun 2, LMG 3, Marksman 3, Sniper 3, Pistol 4, Launcher 4, Melee 1). Season 1 guns can count toward it but didn't raise it.
- **Harmonic Break** needs 33 Platinum camos on any weapons.
- **Divergence** is one account-wide camo, earned after 33 Harmonic Breaks.

Whether Season 1 guns count toward the 33s isn't officially confirmed (guides say they can stand in). The tracker counts every weapon it lists. Check entries against the game and update `mw4-data.js` as needed.

## Project structure

```
index.html    Page shell: header, tabs, weapon list, detail panel
styles.css    All styling, including tier and rarity colors
mw4-data.js   Weapons, camos, challenges and DMZ data (edit this one)
script.js     App logic: state, rendering, tabs, DMZ tools, import/export
CLAUDE.md     Working notes for Claude Code (change routine, research agents)
.claude/agents/
  mw4-researcher.md     Looks up and cross-checks MW4 game data online
  mw4-update-scout.md   Checks for new MW4 updates against mw4-data.js
  mw4-feature-scout.md  Suggests features other trackers/players find useful
tests/        Browser tests (npm test), one file per area, plus run-all.js
```

## Changelog

Newest first. Your saved progress carries over through every change listed here.

### 2026-11-27

- **Warzone view on the Camo Track:** the toggle is now **MULTIPLAYER / DMZ / WARZONE**. MW4 weapons joined Warzone in Season 1 (6 Nov 2026), and Special and Completionist camos have their own Warzone targets.
  - **Special camos:** Warzone challenges for all 105 Special camos on the 35 released guns, e.g. M4 Myriad "Get 10 point blank kills against players" and RPG-8 Bubblegum Ops "Destroy 15 killstreaks or enemy vehicles".
  - **Completionist camos:** Gold is "Get 8 player kills in a single match" for every class. Platinum and Harmonic Break have Warzone text per class, e.g. Assault Rifles "Get 25 headshots against players" and "Get 2 player kills within 10 seconds 15 times". Divergence is the same account-wide unlock.
  - **Military camos** read "Reach weapon level N" in Warzone too, since weapon level counts in every mode.
  - **Shared progress:** camo unlocks are shared between Warzone and every other mode in game, so a camo ticked in any view counts in all three, under the same saved ids. Ticks you made before this update show up in the Warzone view too.
  - The page hint now reads "Every camo here is shared between Multiplayer, DMZ and Warzone".
- New test suite `tests/test-warzone.js` checks the Warzone text on all 37 guns, the shared ticks, and phone width. There are now ten suites with 445 checks.
- **SET LEVEL menu on every gun (Camo Track and Prestige tabs):** a WEAPON LEVEL card at the top shows the gun's level ("LV 40 · Not prestiged", "Prestige 1 · LV 5", "Prestige Master · LV 160"), with a **SET LEVEL** button.
  - **The menu** asks "Have you prestiged this gun?" (**No / Prestige 1 / Prestige Master**) and then the level: weapon level, level in Prestige 1 (it restarts at 1), or Prestige Master level (up to 250). It checks what you type ("Enter a level from 1 to 150.").
  - **Saving ticks what the gun has reached.** Military camos up to the level are ticked, or all 8 once the gun is prestiged. Prestige camos are ticked too: Pyroclast at Prestige 1, Terminus at Prestige Master, Scatter at PM 150 and Cascade at PM 250.
  - A message says what was ticked, e.g. "✓ 5 CAMOS TICKED · MILITARY 5, 6, 7, 8 · PYROCLAST".
  - **Every camo you haven't ticked** shows a green **✓ OPEN** / **✓ REACHED** line, or what's still needed: "LOCKED · 11 levels to go", "LOCKED · reach max level again in Prestige 1", "LOCKED · 90 Prestige Master levels to go".
  - The card says what's next ("Next: PYROCLAST CASCADE at Prestige Master level 250 (90 levels away)"), and the weapon list shows a badge: **LV 40**, **P1 · LV 5** or **PM 160**.
  - Nothing is ever unticked: lowering the level or pressing **CLEAR** keeps your ticks, and you can still untick by hand. Special camos are never ticked for you, because they need their challenge too.
  - The level is saved per gun and is included in Export/Import.
- **Prestige tab:** each Prestige camo now shows how to get it: "Reach Weapon Prestige 1", "Reach Weapon Prestige 1 Max Level", "Reach Weapon Prestige Master Level 150" and "… 250".
- **APOC-338 and Oris 8.6 Special levels checked in game:** each is 1 lower than before. APOC-338 is now 14, 35, 55 (was 15, 36, 56), and Oris 8.6 is now 26, 48, 69 (was 27, 49, 70). The Mojave .357 couldn't be confirmed online and stays at 16, 30, 44 for now.
- **M4 and Hyeon Burst Military levels confirmed in game:** M4 10, 18, 26, 35, 44, 51, 59, 64; Hyeon Burst 10, 17, 26, 32, 40, 49, 55, 62. Nothing changed in the app; the "check in game" notes are gone.
- **Phone fix:** on narrow phones (about 390px) the Export / Import / Reset buttons ran off the right edge. They now wrap under the title.
- New test suite `tests/test-weapon-level.js` (61 checks). There are now nine suites with 423 checks.
- **Special camo unlock levels for every gun:** each Special camo now shows the weapon level that opens it, e.g. "Opens at weapon level 46". Before, only the Han 86 had them.
  - **All 35 released guns are filled in.** The Han 86 and Sang 9mm levels are official, and most others come from community sources (see "Data accuracy").
  - **Checked in game** (the sites disagreed or had nothing):
    - Cronen Osprey: 24, 49, 70.
    - CSG-35: 16, 29, 43.
    - Kastov 762: 23, 48, 68.
    - Axion: 23, 45, 69.
    - Mosin-Nagant: 24, 46, 68. The sites had its first Special at 25.
  - The unreleased JAK 12 and ZLR Talonhawk still say "Not published yet for this weapon".
  - The levels are kept in a new `specialLevels` table in `mw4-data.js`, next to `militaryLevels`. Camo ids haven't changed, so saved progress carries over.
- **Type 73 Special camos in the in-game order:** Ash Pine, Outcrop, Foxtrail. Six sites agree; the tracker had Outcrop, Foxtrail, Ash Pine. Your ticks move with their camo, including when you import an older backup.
- **Rezi-12:** "Brush Stroke" is now spelled "Brushstroke", as in game. Progress is unaffected.
- **M4 Military 5–8** changed from 39, 44, 51, 59 to 44, 51, 59, 64, from codcentral.net's in-game screenshots. Not checked in game yet.
- New test suite `tests/test-special-levels.js` checks all 37 guns in both views, plus the Type 73 move. There are now eight suites with 362 checks.
- **All Season 1 Military levels from the game:** the Cronen Osprey (levels 12, 19, 25, 33, 40, 48, 55, 63) and CSG-35 (levels 11, 15, 19, 23, 27, 31, 35, 39) now have all eight, so neither says "not confirmed yet" any more. The CSG-35's Military 8 changed from 62 to 39 after a recheck in game. Only the unreleased JAK 12 and ZLR Talonhawk are still unconfirmed. The military test checks both guns level by level.

- **Season 1 Military levels from the game:** every community site had the Cronen Osprey and CSG-35 wrong. They now use the levels checked in game: Cronen Osprey Military 1 = level 12; CSG-35 Military 1 = level 11 and Military 8 = level 62. Their other Military camos say "Unlock level not confirmed yet" instead of showing wrong numbers.
- The wording for unknown Military levels changed from "not published yet" to "not confirmed yet" (also used for the unreleased JAK 12 and ZLR Talonhawk).
- **Military unlock levels for every gun:** Military 1–8 now show "Reach weapon level N" on all 35 released guns. JAK 12 and ZLR Talonhawk (unreleased) say "Unlock level not published yet".
  - **Corrected:** M4, Kastov 762, Axion, Cronen Squall, Patriot XMR and Hyeon Burst (mostly 1 level too low before; the M4's Military 1 = level 10 was confirmed in game), WZ.55 Striga, and X-58 NYX (its levels were scrambled).
  - **Filled in:** Cronen Osprey, CSG-35, PPSh-41, Vel 46, Warlord, Type 73, APOC-338, Oris 8.6, Mosin-Nagant, Signal 50, Astaroth .57, Krait P68, .50 GS, Mojave .357, the four launchers and the FSS Carbon Edge 1095.
  - **Unchanged (already right):** Han 86, Oden, ISO Nightshade, Rezi-12, FiNN LMG, MAR-9, KG-7 Vulcan, SANG 9mm.
- New test suite `tests/test-military.js` checks all 37 guns in both views. There are now seven suites with 334 checks.
- **"Why is this locked?" on the Camo Track:** Gold, Platinum, Harmonic Break and Divergence each show a live **LOCKED / ✓ OPEN** line under the challenge, which updates as you tick boxes. It's information only and never stops you ticking a camo.
  - **Gold:** "LOCKED · 6/11 Military + Special done".
  - **Platinum:** "LOCKED · 6/8 Assault Rifle Golds", with how many more are needed and which weapons in the class have no Gold yet.
  - **Harmonic Break:** "12/33 Platinum camos (any weapon)".
  - **Divergence:** "x/33 Harmonic Breaks".
- **Unlock rules fixed:**
  - **Platinum:** now "Opens after N Gold camos on <class> weapons", using the launch counts (AR 8, SMG 5, Shotgun 2, LMG 3, Marksman 3, Sniper 3, Pistol 4, Launcher 4, Melee 1). It used to say "Gold on every weapon", which was wrong once Season 1 added a 9th AR.
  - **Harmonic Break:** now "Opens after 33 Platinum camos on any weapons (account-wide)". It used to say "Opens after Platinum".
- **Divergence is account-wide:** it's earned once for your account after 33 Harmonic Breaks and unlocks on every weapon.
  - Ticking it on any weapon ticks it on all of them, and it's ticked automatically (box locked on) once 33 Harmonic Breaks are ticked.
  - The Mastery tab's Divergence box follows the same rule.
  - Older saves convert: a Divergence ticked on any weapon counts for all.
- New test suite `tests/test-camo-locks.js` (47 checks). There are now six suites with 321 checks.
- **One account-wide Mastery tab:** the MP Mastery, DMZ Mastery and Warzone Mastery tabs (which tracked per weapon) are replaced by a single **Mastery** tab, because in game Mastery counts any weapon and unlocks on every weapon at once. It shows Multiplayer, DMZ and Warzone side by side, each camo in unlock order with its challenge and what it needs first:
  - Multiplayer: Mercurial Drift (10 kills in a match ×250), Polyatomic Reforged (3 kills without taking damage ×300), Orion Reforged (5 kills without dying ×500).
  - DMZ: Chiral (2,500 Tier 3+ enemy kills), Ripple Tide (extract 2 Lieutenant dog tags in one deployment ×50), Helio (25,000 kills with Legendary weapons on a max-level Operator).
  - Warzone: Parallax (5 kills in a match ×300), Damascus Reforged (2 kills without plating ×200), Empyros (top 5 with 6+ kills ×75).
- Each camo has a **progress counter** (type it, or use −/+; Shift = 10) that ticks **Done** when you reach the target, and a Done box to tick yourself. Done camos take the Mastery color; the next one in each mode is outlined green and later ones are dimmed.
- **Divergence box:** counts the Harmonic Break boxes ticked on your Camo Track toward the 33 that open Mastery.
- Stats show Mastery as one total (e.g. 2/9). Older saves convert automatically: a Mastery camo you'd checked on any weapon counts as done.
- Added Claude Code project files: `CLAUDE.md` (change routine, and picking up where you left off each session) and three MW4 research agents in `.claude/agents/` (researcher, update scout, feature scout).
- **Browser tests are now part of the project:** `tests/` holds five test suites (274 checks) plus `run-all.js`. Run them with `npm test`; see "Running the tests". Also added a `.gitignore` for the test tooling and output.
- **Vendor Item Upgrade II confirmed in game:** it costs no cash (items only), so its card shows **NO CASH** instead of "$ ?".
- **MIA Recovery Discount III confirmed in game:** it costs no cash (items only), so its card no longer shows the "⚠ No cash per one site" warning.
- **Shopping list sorted by rarity:** material rows are listed rarest first (Ultra → Legendary → Epic → Rare → Uncommon → Common), with base resources (no rarity) at the bottom. Materials of the same rarity stay in the order they were added. The list re-sorts itself as you add items.
- **"Crafting for" items sorted by rarity** the same way (e.g. Tempered Armor Vest before Medkit).
- **3D Printer upgrades moved to Notes & Materials, with costs:** a new **3D Printer Upgrades** section (between the notepad/shopping list and the pickers) shows all 9 upgrades. Each card has its tier boxes, the next tier to build, what that tier gives, and its cost: cash plus every material in its rarity color. Raid items that aren't printer ingredients (intel documents, Gold Bar, Gold Skull, DRC lockers) are marked **RAID**, and printable items (Fulton Drop Marker, Door Breacher Charge) are marked **CRAFT**. Tiers paid only in items say **NO CASH**, unconfirmed cash shows as "$ ?", and uncertain tiers have a ⚠ note. Upgrades in progress are listed first, maxed ones (gold) last. The −/+/Maxed controls moved here too; nothing here touches the shopping list.
- **Blueprints & Recipes** no longer shows upgrades (or the "Upgrades maxed" stat or the UPGRADES add option). Your saved tiers carry over, and any upgrade missing from an older save is added at tier 0.
- New `upgradeCosts` table in `mw4-data.js` with every tier's cost for Dog Tag Case (4 tiers), Stash Item (4), Stash Weapon (3), MIA Recovery Discount (4), Gunsmith (2), Vendor Item (2), Bank (13, up to a $2,000,000,000 cap) and Uncommon/Epic Ingredient Printing (1 each), cross-checked across seven community sites.
- **Notes & Materials layout:** the notepad now takes the left half of the top row, with a new **Shopping List** on the right half. The shopping list holds the "Crafting for" items, Reset counts / Clear list, the READY counter and the material rows. The item picker, base resources, ingredients and "Material not listed?" box moved to a full-width **Add to the shopping list** section underneath.
- The notepad stretches to match the shopping list's height. Long shopping lists scroll inside their own box (keeping their scroll spot when the list updates). On narrower windows each material row switches to two lines; on phone-sized screens the notepad and list stack.
- **Shopping list messages:** picking or un-picking an item, clicking a material chip, or adding your own material shows a short message in the top right corner ("✓ Added to shopping list" in green, "Removed from shopping list" in amber, or "Already on the shopping list"), with the item's name in its rarity color and, for crafted items, what they need. Messages fade after 3 seconds (at most 3 at once); clicking one scrolls up to the shopping list.
- **Clickable War Spoils diamonds on the overview:** the manual diamonds on each Weapons & Manuals card can be clicked to set the count without opening the weapon. The rest of the card still opens it.
- **Back button keeps your place:** "← All weapons" returns to where you were scrolled in the weapon list instead of the top.
- **Fix:** adding manuals to a gun no longer marks it unlocked at the Gunsmith; the two are fully separate.
- **Gunsmith unlock tracked separately from War Spoils:** each weapon card (and the weapon page) has a **LOCKED / ✓ GUNSMITH** toggle, so a gun can be unlocked with 0 manuals. Older saves keep guns with 1+ manual marked unlocked. Legend, class headers, stat cards and the Stats page use the new flag.
- **Fix:** Cronen Squall *Optical Reverb* DMZ challenge read "Get Get 3 enemy kills…".

### 2026-11-22

- **Season 1 weapons:** added the three Special camos with Multiplayer and DMZ challenges for the **Cronen Osprey** (In the Weeds, Dark Ichor, Chained) and **CSG-35** (Polyhedron, Rind, Black Grip). Their Military unlock levels are left as "level up this weapon" because guides disagree.

### 2026-11-10

- First version: camo track, Prestige and Mastery tabs, DMZ Loadout (weapons & manuals, blueprints & recipes, notes & materials), Challenges, Stats, and export / import / reset.

## Disclaimer

This is an unofficial fan project and isn't affiliated with or endorsed by Activision or Infinity Ward. Call of Duty and Modern Warfare are trademarks of Activision Publishing, Inc.
