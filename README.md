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
| **Camo Track** | The full per-weapon track: 8 Military camos, 3 weapon-specific Special camos, then Gold → Platinum → Harmonic Break → Divergence. A **Multiplayer / DMZ** toggle switches the challenge text for each view. Camos earnable in both modes are shared, so checking one in either view marks it done in both. |
| **Prestige** | Weapon Prestige camos (the Pyroclast set). |
| **MP Mastery** | Multiplayer Mastery camos. |
| **DMZ Mastery** | DMZ Mastery camos. |
| **Warzone Mastery** | Warzone Mastery camos. |

The weapon list on the left is grouped by class and searchable. Each weapon is colored by the highest tier it has reached (all camos up to that tier must be checked in order). A class header only lights up once **every** weapon in that class reaches the tier.

### DMZ Loadout

- **Weapons & Manuals:** mark which weapons are unlocked at the Gunsmith (click a card's **LOCKED / ✓ GUNSMITH** button) and, separately, how many Weapon Manuals you've extracted toward the *War Spoils* camo (click the diamonds, 3 needed), plus per-weapon blueprints. Click anywhere else on a card to open that weapon; **← All weapons** takes you back to the same spot in the list. The overview works well on a second monitor.
- **Blueprints & Recipes:** a checklist of 3D Printer recipes grouped like the in-game menu, with rarity tags.
- **Notes & Materials:** a notepad (left) next to your shopping list (right). Pick the items you're crafting, or click base resources and ingredients, in the section below, and the shopping list fills in the materials you need with have/need counts, sorted rarest first (Ultra at the top, base resources at the bottom). Long lists scroll inside the shopping list so the notepad stays beside it; on narrow screens the two stack. A message pops up in the top right corner whenever something is added to or removed from the list (click it to jump up to the list). Below that, **3D Printer Upgrades** shows every upgrade with its tier (I, II, III…) and the cash and materials the next tier needs, including raid items like intel documents and Gold Bars, kept separate from the shopping list. Press **+** when you build a tier.

### Challenges

Set your own DMZ goals: money targets (accepts `250k`, `1.5m`, `$1,000,000`), counters (extracts, contracts, compounds…) or checklists. Quick-start templates fill in the form for common goals.

### Stats

Overall completion for every mode, plus DMZ manual and recipe totals.

## Saving, backup and reset

- Progress is stored in `localStorage` under the key `mw4-tracker-v1`. It stays in the browser you use. Clearing site data or switching browsers or devices starts you fresh.
- **Export** downloads a `mw4-tracker-backup-YYYY-MM-DD.json` file with all your progress.
- **Import** restores a backup file. It replaces your current progress, so it asks you to confirm first.
- **Reset** clears everything. Export first if you might want it back.

## Customizing the data

All game data is in [`mw4-data.js`](mw4-data.js), and the app logic in [`script.js`](script.js) reads it from `window.MW4_TRACKER_DATA`. Comments throughout the data file explain each section. Common edits:

| To change… | Edit |
| --- | --- |
| Weapons or classes | `gunTypes` and `weaponsByType` |
| Military camo unlock levels | `militaryLevels` (use `0` if unknown). If the game only shows a countdown, use `fromRemaining(currentLevel, [...])` |
| Special camo names and challenges | `specialCamos` |
| Gold / Platinum / Harmonic Break challenges | `classChallenges` |
| Mastery and Prestige camos | `modeCamos` |
| 3D Printer categories and recipes | `dmzSettings.recipeCategories`, `recipeCatalog` and `upgradeCatalog` (bump `catalogVersion` after changing rarity or obtained flags on existing items) |
| Materials and crafting costs | `dmzSettings.materialCatalog` and `craftingRecipes` (add a `materialRenames` entry when you rename a material) |
| 3D Printer upgrade costs per tier | `dmzSettings.upgradeCosts` (cash, items, what the tier gives, and an optional `verify` note) |
| Challenge quick-start buttons | `dmzSettings.challengeTemplates` |

Tier and rarity colors are defined in [`styles.css`](styles.css) under **TIER COLORS** and **RARITY COLORS**.

> **Heads-up:** progress is saved by weapon name and camo id. Renaming a weapon resets that weapon's checkboxes, and changing a camo's `id` drops its saved state.

### Data accuracy

Challenge text comes from Infinity Ward's progression blog and community camo guides from launch week. Season 1 weapons (Cronen Osprey, CSG-35) come from community guides published after they released. Some weapons don't have published Military unlock levels yet, and the JAK 12 and ZLR Talonhawk Special camos haven't been revealed (both are upcoming in-season event rewards). 3D Printer upgrade costs come from community sites (Nov 2026); several later tiers are community-reported or have no confirmed cash cost, and those show a ⚠ note or "$ ?" in the app. MIA Recovery IV and Vendor Item II still have no confirmed cash cost. Check entries against the game and update `mw4-data.js` as needed.

## Project structure

```
index.html    Page shell: header, tabs, weapon list, detail panel
styles.css    All styling, including tier and rarity colors
mw4-data.js   Weapons, camos, challenges and DMZ data (edit this one)
script.js     App logic: state, rendering, tabs, DMZ tools, import/export
```

## Changelog

Newest first. Your saved progress carries over through every change listed here.

### 2026-11-27

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
