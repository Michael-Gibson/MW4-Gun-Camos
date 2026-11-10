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

- **Weapons & Manuals:** record how many Weapon Manuals you've extracted per weapon (unlocked at the Gunsmith → 3 manuals for the *War Spoils* camo), plus per-weapon blueprints. The overview works well on a second monitor.
- **Blueprints & Recipes:** a checklist of 3D Printer recipes grouped like the in-game menu, with rarity tags and tiered upgrades (I, II, III…).
- **Notes & Materials:** a notepad and a materials tracker. Pick the items you're crafting and it builds a shopping list of the materials you need, with have/need counts.

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
| Challenge quick-start buttons | `dmzSettings.challengeTemplates` |

Tier and rarity colors are defined in [`styles.css`](styles.css) under **TIER COLORS** and **RARITY COLORS**.

> **Heads-up:** progress is saved by weapon name and camo id. Renaming a weapon resets that weapon's checkboxes, and changing a camo's `id` drops its saved state.

### Data accuracy

Challenge text comes from Infinity Ward's progression blog and community camo guides from launch week. Some weapons don't have published Military unlock levels yet, and the weapon list may include post-launch or seasonal guns. Check entries against the game and update `mw4-data.js` as needed.

## Project structure

```
index.html    Page shell: header, tabs, weapon list, detail panel
styles.css    All styling, including tier and rarity colors
mw4-data.js   Weapons, camos, challenges and DMZ data (edit this one)
script.js     App logic: state, rendering, tabs, DMZ tools, import/export
```

## Disclaimer

This is an unofficial fan project and isn't affiliated with or endorsed by Activision or Infinity Ward. Call of Duty and Modern Warfare are trademarks of Activision Publishing, Inc.
