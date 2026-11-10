document.addEventListener('DOMContentLoaded', () => {
    // =========================
    // APP CONFIG
    // =========================
    // All weapons, camos, and challenge text live in mw4-data.js.
    const appData = window.MW4_TRACKER_DATA || {};

    const gunTypeArray = appData.gunTypes || [];
    const weapons = appData.weapons || {};
    const weaponsByType = appData.weaponsByType || {};
    const gunsArray = gunTypeArray.map(type => weaponsByType[type] || []);
    const allGuns = gunsArray.flat();
    const modeOrder = appData.modeOrder || ['track'];
    const modeLabels = appData.modeLabels || {};
    const trackViews = appData.trackViews || { mp: 'MULTIPLAYER', dmz: 'DMZ' };
    const trackViewKeys = Object.keys(trackViews);
    const dmzSettings = {
        manualsForCamo: 3,
        lootCamoName: 'LOOT CAMO',
        recipeCategories: [],
        recipeCatalog: {},
        rarities: [],
        ...(appData.dmzSettings || {})
    };
    const recipeCategories = dmzSettings.recipeCategories.length
        ? dmzSettings.recipeCategories
        : (dmzSettings.gearCategories || []);
    const rarityLabel = Object.fromEntries(dmzSettings.rarities.map(r => [r.id, r.label]));

    // Extra tabs that are not camo modes
    const LOADOUT_MODE = 'loadout';
    const LOADOUT_LABEL = 'DMZ LOADOUT';
    const CHALLENGE_MODE = 'challenges';
    const CHALLENGE_LABEL = 'CHALLENGES';
    const UPGRADE_TYPE = '__upgrade__'; // "type" value for 3D Printer upgrades in the add form

    // Roman numerals for upgrade tiers (I, II, III, IV, V...)
    const ROMAN = [['M', 1000], ['CM', 900], ['D', 500], ['CD', 400], ['C', 100], ['XC', 90], ['L', 50], ['XL', 40], ['X', 10], ['IX', 9], ['V', 5], ['IV', 4], ['I', 1]];
    const toRoman = (n) => {
        let out = '';
        let left = n;
        ROMAN.forEach(([r, v]) => { while (left >= v) { out += r; left -= v; } });
        return out;
    };
    const fromRoman = (str) => {
        let total = 0;
        let i = 0;
        ROMAN.forEach(([r, v]) => { while (str.startsWith(r, i)) { total += v; i += r.length; } });
        return i === str.length ? total : 0;
    };
    // "Stash Item Upgrade III" -> { base: "STASH ITEM UPGRADE", tier: 3 }
    const splitTier = (name) => {
        const m = name.trim().match(/^(.*?)\s+([IVXLC]+)$/i);
        const tier = m ? fromRoman(m[2].toUpperCase()) : 0;
        if (m && tier) return { base: m[1].trim().toUpperCase(), tier };
        return { base: name.trim().toUpperCase(), tier: 0 };
    };

    // Fast lookup so the UI can find a gun without caring which category it is in.
    const weaponLookup = Object.values(weapons).reduce((lookup, gunsInType) => {
        Object.entries(gunsInType).forEach(([gunName, gunData]) => {
            lookup[gunName] = gunData;
        });
        return lookup;
    }, {});

    const getGunCamos = (mode, gunName) => weaponLookup?.[gunName]?.[mode] || [];

    // Every camo gets a storage key: its id if it has one, otherwise its position.
    // getEntries(mode, gun, view) -> [{ camo, key }]. For the camo track, pass a view
    // ('mp' or 'dmz') to get only the camos shown in that view.
    const getEntries = (mode, gunName, view) => {
        const entries = getGunCamos(mode, gunName).map((camo, i) => ({ camo, key: camo.id || String(i) }));
        if (mode === 'track' && view) return entries.filter(e => (e.camo.modes || trackViewKeys).includes(view));
        return entries;
    };

    const getChallenge = (camo, view) => {
        if (!camo.challenge) return '';
        if (typeof camo.challenge === 'string') return camo.challenge;
        return camo.challenge[view] || '';
    };

    // =========================
    // SAVED STATE (one localStorage key, separate from the BO7 app)
    // =========================
    const STORAGE_KEY = 'mw4-tracker-v1';

    // Materials tracker: { craftFor, custom: [{ name, rarity }] added in the app, tracked: [{ name, have, need }] }
    const toCount = (v) => Math.max(0, Math.floor(Number(v) || 0));
    const normMaterials = (m) => {
        const src = m && typeof m === 'object' ? m : {};
        return {
            craftFor: typeof src.craftFor === 'string' ? src.craftFor : '',
            custom: Array.isArray(src.custom)
                ? src.custom.map(c => (typeof c === 'string' ? { name: c, rarity: '' } : c))
                    .filter(c => c && typeof c.name === 'string')
                    .map(c => ({ name: c.name, rarity: typeof c.rarity === 'string' ? c.rarity : '' }))
                : [],
            // auto: added because a picked craft item needs it (dropped again when no longer needed)
            tracked: Array.isArray(src.tracked)
                ? src.tracked.filter(t => t && typeof t.name === 'string')
                    .map(t => ({ name: t.name, have: toCount(t.have), need: toCount(t.need), ...(t.auto ? { auto: true } : {}) }))
                : [],
            // Items picked under "Crafting for": [{ name, qty }]
            crafting: Array.isArray(src.crafting)
                ? src.crafting.filter(c => c && typeof c.name === 'string')
                    .map(c => ({ name: c.name, qty: Math.max(1, toCount(c.qty)) }))
                : []
        };
    };

    // Challenges: [{ id, title, type: 'money'|'count'|'list', target, current, unit,
    //               items: [{ name, done }], note, createdAt, completedAt }]
    const CHALLENGE_TYPES = ['money', 'count', 'list'];
    const newId = () => `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    const normChallenges = (arr) => (Array.isArray(arr) ? arr : [])
        .filter(c => c && typeof c.title === 'string' && CHALLENGE_TYPES.includes(c.type))
        .map(c => ({
            id: typeof c.id === 'string' ? c.id : newId(),
            title: c.title,
            type: c.type,
            target: toCount(c.target),
            current: toCount(c.current),
            unit: typeof c.unit === 'string' ? c.unit : '',
            items: Array.isArray(c.items)
                ? c.items.filter(i => i && typeof i.name === 'string').map(i => ({ name: i.name, done: Boolean(i.done) }))
                : [],
            note: typeof c.note === 'string' ? c.note : '',
            createdAt: Number(c.createdAt) || Date.now(),
            completedAt: Number(c.completedAt) || 0
        }));

    const defaultState = () => ({
        camos: {},   // camos[mode][gun] = { [camoKey]: true }
        dmz: {},     // dmz[gun] = { manuals: 0-3, blueprints: [{ name, claimed, rarity }] }
        gear: [],    // 3D Printer recipes: [{ category, name, rarity, obtained }]
        seededRecipes: [], // starter recipes already added once (so deleted ones stay deleted)
        upgrades: [],      // 3D Printer upgrades: [{ name, built, maxed, maxTier? }]
        seededUpgrades: [],
        notes: '',         // DMZ notepad text
        materials: normMaterials(),
        challenges: [],
        ui: {
            challengeType: 'money',     // last type picked in the add-challenge form
            challengeFilter: 'all',     // 'all' | 'active' | 'done'
            mode: 'track',
            view: 'detail',
            gun: null,
            dmzGun: null,
            dmzView: 'weapons',     // 'weapons' | 'blueprints' | 'notes'
            trackMode: null,        // 'mp' | 'dmz': camo track view, shared by every gun
            bpType: UPGRADE_TYPE,   // last type picked in the blueprint form
            bpFilter: 'all',        // 'all' | 'need' | 'obtained'
            openTypes: [0]
        }
    });

    const loadState = () => {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return defaultState();
            const parsed = JSON.parse(raw);
            const base = defaultState();
            return {
                camos: parsed.camos || {},
                dmz: parsed.dmz || {},
                gear: Array.isArray(parsed.gear) ? parsed.gear : [],
                seededRecipes: Array.isArray(parsed.seededRecipes) ? parsed.seededRecipes : [],
                catalogVersion: parsed.catalogVersion || 1,
                upgrades: Array.isArray(parsed.upgrades) ? parsed.upgrades : [],
                seededUpgrades: Array.isArray(parsed.seededUpgrades) ? parsed.seededUpgrades : [],
                notes: typeof parsed.notes === 'string' ? parsed.notes : '',
                materials: normMaterials(parsed.materials),
                challenges: normChallenges(parsed.challenges),
                ui: { ...base.ui, ...(parsed.ui || {}) }
            };
        } catch (err) {
            console.warn('Could not read saved MW4 progress, starting fresh.', err);
            return defaultState();
        }
    };

    let state = loadState();

    const saveState = () => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        } catch (err) {
            console.warn('Could not save MW4 progress.', err);
        }
    };

    // Older saves stored checkboxes as arrays by position. Convert them to keyed objects.
    let migrated = false;
    Object.entries(state.camos).forEach(([mode, guns]) => {
        Object.entries(guns || {}).forEach(([gunName, value]) => {
            if (!Array.isArray(value)) return;
            const keyed = {};
            getEntries(mode, gunName).forEach(({ key }, i) => {
                if (value[i]) keyed[key] = true;
            });
            guns[gunName] = keyed;
            migrated = true;
        });
    });

    // Recipes logged before the checklist existed were things you already had: mark them
    // obtained, and move old category names onto the 3D Printer categories.
    const LEGACY_CATEGORY = { 'ARMOR PLATES': 'PLATE CARRIERS', 'ARMOR VESTS': 'PLATE CARRIERS', 'OTHER ITEMS': 'GEAR' };
    state.gear.forEach(item => {
        if (typeof item.obtained !== 'boolean') {
            item.obtained = true;
            migrated = true;
        }
        if (LEGACY_CATEGORY[item.category] && recipeCategories.includes(LEGACY_CATEGORY[item.category])) {
            item.category = LEGACY_CATEGORY[item.category];
            migrated = true;
        }
    });

    // Add starter recipes from mw4-data.js that haven't been added before.
    const recipeId = (category, name) => `${category}::${name}`.toUpperCase();
    const seeded = new Set(state.seededRecipes);
    Object.entries(dmzSettings.recipeCatalog || {}).forEach(([category, items]) => {
        (items || []).forEach(item => {
            const id = recipeId(category, item.name);
            if (seeded.has(id)) return;
            seeded.add(id);
            if (!state.gear.some(g => recipeId(g.category, g.name) === id)) {
                state.gear.push({ category, name: item.name.toUpperCase(), rarity: item.rarity || '', obtained: Boolean(item.obtained) });
            }
            migrated = true;
        });
    });
    state.seededRecipes = [...seeded];

    // When the catalog version goes up, fill in rarities you haven't set and mark items
    // the catalog says are obtained. Never un-checks anything or overwrites your rarity.
    const catalogVersion = dmzSettings.catalogVersion || 1;
    if ((state.catalogVersion || 1) < catalogVersion) {
        Object.entries(dmzSettings.recipeCatalog || {}).forEach(([category, items]) => {
            (items || []).forEach(item => {
                const existing = state.gear.find(g => recipeId(g.category, g.name) === recipeId(category, item.name));
                if (!existing) return; // deleted in the app: leave it deleted
                if (!existing.rarity && item.rarity) existing.rarity = item.rarity;
                if (item.obtained) existing.obtained = true;
            });
        });
        state.catalogVersion = catalogVersion;
        migrated = true;
    }

    // 3D Printer upgrades are tracked by tier. Older saves had them as one checklist
    // card per tier ("Stash Item Upgrade II"): convert those. In game the numeral is
    // the NEXT tier to build, so an unchecked "II" means 1 tier built.
    const upgradeKey = (name) => name.trim().toUpperCase();
    const findUpgrade = (base) => state.upgrades.find(u => upgradeKey(u.name) === base);
    const mergeUpgrade = (base, built, maxed) => {
        let u = findUpgrade(base);
        if (!u) {
            u = { name: base, built: 0, maxed: false };
            state.upgrades.push(u);
        }
        u.built = Math.max(u.built || 0, built);
        if (maxed) u.maxed = true;
        return u;
    };
    state.gear = state.gear.filter(item => {
        if (item.category !== 'UPGRADES') return true;
        const { base, tier } = splitTier(item.name);
        const t = tier || 1;
        mergeUpgrade(base, item.obtained ? t : t - 1, false);
        migrated = true;
        return false;
    });
    const seededUp = new Set(state.seededUpgrades);
    (dmzSettings.upgradeCatalog || []).forEach(entry => {
        const base = upgradeKey(entry.name);
        if (seededUp.has(base)) return;
        seededUp.add(base);
        const u = mergeUpgrade(base, entry.built || 0, Boolean(entry.maxed));
        if (entry.maxTier) u.maxTier = entry.maxTier;
        migrated = true;
    });
    state.seededUpgrades = [...seededUp];
    const isMaxed = (u) => Boolean(u.maxed) || Boolean(u.maxTier && u.built >= u.maxTier);

    // Craft recipes from mw4-data.js, keyed by upper-case item name:
    // recipes[ITEM] = { name, materials: { MATERIAL: amount } }
    const craftRecipes = Object.fromEntries(Object.entries(dmzSettings.craftingRecipes || {}).map(([item, mats]) => [
        item.trim().toUpperCase(),
        {
            name: item.trim().toUpperCase(),
            materials: Object.fromEntries(Object.entries(mats || {}).map(([m, n]) => [m.trim().toUpperCase(), toCount(n)]))
        }
    ]));

    // The old free-text "Crafting for" box becomes a picked item when it names a known recipe
    // (anything else is kept at the end of the notepad so it isn't lost).
    if (state.materials.craftFor.trim()) {
        const key = state.materials.craftFor.trim().toUpperCase();
        if (craftRecipes[key]) {
            if (!state.materials.crafting.some(c => c.name.toUpperCase() === key)) state.materials.crafting.push({ name: key, qty: 1 });
        } else {
            state.notes = `${state.notes}${state.notes ? '\n' : ''}Crafting for: ${state.materials.craftFor.trim()}`;
        }
        state.materials.craftFor = '';
        migrated = true;
    }

    // Materials renamed in mw4-data.js: move tracked counts over to the new name.
    const materialRenames = Object.fromEntries(Object.entries(dmzSettings.materialRenames || {})
        .map(([from, to]) => [from.trim().toUpperCase(), to.trim().toUpperCase()]));
    state.materials.tracked = state.materials.tracked.filter(t => {
        const to = materialRenames[t.name.trim().toUpperCase()];
        if (!to) return true;
        migrated = true;
        const existing = state.materials.tracked.find(x => x.name.trim().toUpperCase() === to);
        if (existing) {
            existing.have = Math.max(existing.have, t.have);
            existing.need = Math.max(existing.need, t.need);
            return false;
        }
        t.name = to;
        return true;
    });

    // Validate restored UI state against current data
    const validModes = [...modeOrder, LOADOUT_MODE, CHALLENGE_MODE];
    if (!CHALLENGE_TYPES.includes(state.ui.challengeType)) state.ui.challengeType = 'money';
    if (!['all', 'active', 'done'].includes(state.ui.challengeFilter)) state.ui.challengeFilter = 'all';
    if (!validModes.includes(state.ui.mode)) state.ui.mode = 'track';
    if (!['detail', 'stats'].includes(state.ui.view)) state.ui.view = 'detail';
    if (!['weapons', 'blueprints', 'notes'].includes(state.ui.dmzView)) state.ui.dmzView = 'weapons';
    if (!['all', 'need', 'obtained'].includes(state.ui.bpFilter)) state.ui.bpFilter = 'all';
    if (state.ui.gun && !weaponLookup[state.ui.gun]) state.ui.gun = null;
    if (state.ui.dmzGun && !weaponLookup[state.ui.dmzGun]) state.ui.dmzGun = null;
    if (!Array.isArray(state.ui.openTypes)) state.ui.openTypes = [0];
    // The MP/DMZ toggle used to be saved per gun; it's one setting for all guns now.
    if (!trackViewKeys.includes(state.ui.trackMode)) {
        const old = state.ui.trackView && typeof state.ui.trackView === 'object' ? state.ui.trackView : {};
        const lastPicked = state.ui.gun && old[state.ui.gun];
        state.ui.trackMode = trackViewKeys.includes(lastPicked) ? lastPicked : trackViewKeys[0];
    }
    delete state.ui.trackView;
    if (migrated) saveState();

    // =========================
    // CAMO HELPERS
    // =========================
    const isChecked = (mode, gunName, key) => Boolean(state.camos?.[mode]?.[gunName]?.[key]);

    const setChecked = (mode, gunName, key, value) => {
        if (!state.camos[mode]) state.camos[mode] = {};
        if (!state.camos[mode][gunName]) state.camos[mode][gunName] = {};
        if (value) state.camos[mode][gunName][key] = true;
        else delete state.camos[mode][gunName][key];
        saveState();
    };

    const countDone = (mode, gunName, entries) => entries.reduce((acc, e) => acc + (isChecked(mode, gunName, e.key) ? 1 : 0), 0);

    const getDoneCount = (mode, gunName) => countDone(mode, gunName, getEntries(mode, gunName));

    // Same MP/DMZ view for every gun
    const getTrackView = () => {
        const v = state.ui.trackMode;
        return trackViewKeys.includes(v) ? v : trackViewKeys[0];
    };

    // Ordered list of tier milestones for a mode, e.g. ['gold','platinum','harmonic','divergence']
    const getTierOrder = (mode, gunName) => getGunCamos(mode, gunName).filter(c => c.tier).map(c => c.tier);

    // Highest milestone reached by checking camos in order along one list.
    const tierAlong = (mode, gunName, entries) => {
        let tier = null;
        for (const { camo, key } of entries) {
            if (!isChecked(mode, gunName, key)) break;
            if (camo.tier) tier = camo.tier;
        }
        return tier;
    };

    // Gun milestone. On the camo track, a tier counts if it's reached in order in EITHER
    // the MP view or the DMZ view, so Gold earned in DMZ lights the gun up too.
    const getGunTier = (mode, gunName) => {
        const order = getTierOrder(mode, gunName);
        const paths = mode === 'track'
            ? trackViewKeys.map(v => getEntries(mode, gunName, v))
            : [getEntries(mode, gunName)];
        let best = -1;
        paths.forEach(entries => {
            const t = tierAlong(mode, gunName, entries);
            if (t) best = Math.max(best, order.indexOf(t));
        });
        return { tier: best >= 0 ? order[best] : null, rank: best };
    };

    const getTierName = (mode, tier) => {
        const camo = getGunCamos(mode, allGuns[0]).find(c => c.tier === tier);
        return camo ? camo.name : tier;
    };

    const ALL_TIER_CLASSES = [
        'tiered', 'tier-gold', 'tier-platinum', 'tier-harmonic', 'tier-divergence',
        'tier-m1', 'tier-m2', 'tier-m3', 'tier-p1', 'tier-p2', 'tier-p3', 'tier-p4'
    ];
    const ALL_DMZ_CLASSES = ['dmz-locked', 'dmz-unlocked', 'dmz-camo'];

    // =========================
    // DMZ HELPERS
    // =========================
    const getDmz = (gunName) => {
        if (!state.dmz[gunName]) state.dmz[gunName] = { manuals: 0, blueprints: [] };
        const entry = state.dmz[gunName];
        if (typeof entry.manuals !== 'number') entry.manuals = 0;
        if (!Array.isArray(entry.blueprints)) entry.blueprints = [];
        return entry;
    };

    const peekDmz = (gunName) => state.dmz[gunName] || { manuals: 0, blueprints: [] };

    const getDmzStatus = (gunName) => {
        const manuals = peekDmz(gunName).manuals || 0;
        if (manuals >= dmzSettings.manualsForCamo) return 'dmz-camo';
        if (manuals >= 1) return 'dmz-unlocked';
        return 'dmz-locked';
    };

    // Cycle a rarity: none -> common -> ... -> legendary -> none
    const nextRarity = (current) => {
        const ids = ['', ...dmzSettings.rarities.map(r => r.id)];
        return ids[(ids.indexOf(current || '') + 1) % ids.length];
    };

    // =========================
    // DOM REFERENCES
    // =========================
    const tabsContainer = document.getElementById('tabsContainer');
    const legendEl = document.getElementById('legend');
    const gunTypeList = document.getElementById('gunTypeList');
    const rightPanel = document.getElementById('rightPanel');
    const searchInput = document.getElementById('gunSearch');

    const tabButtons = {};
    const gunNavItems = {};     // gunName -> { li, bar, count, badge }
    const gunTypeParts = [];    // index -> { details, summary, badge }

    const el = (tag, className, text) => {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text !== undefined) node.textContent = text;
        return node;
    };

    const isCamoMode = () => modeOrder.includes(state.ui.mode);

    // =========================
    // HEADER BUTTONS: RESET / EXPORT / IMPORT
    // =========================
    document.getElementById('resetProgressBtn').addEventListener('click', () => {
        const confirmed = window.confirm(
            'Reset ALL MW4 progress?\n\nThis clears every camo checkbox, DMZ manual, blueprint, note, tracked material, and challenge.\nTip: hit Export first if you want a backup.'
        );
        if (!confirmed) return;
        localStorage.removeItem(STORAGE_KEY);
        window.location.reload();
    });

    document.getElementById('exportBtn').addEventListener('click', () => {
        const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const date = new Date().toISOString().slice(0, 10);
        a.href = url;
        a.download = `mw4-tracker-backup-${date}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    });

    const importFile = document.getElementById('importFile');
    document.getElementById('importBtn').addEventListener('click', () => importFile.click());
    importFile.addEventListener('change', () => {
        const file = importFile.files && importFile.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            try {
                const parsed = JSON.parse(reader.result);
                if (!parsed || typeof parsed !== 'object' || (!parsed.camos && !parsed.dmz && !parsed.gear)) {
                    throw new Error('Not an MW4 tracker backup');
                }
                if (!window.confirm('Replace your current progress with this backup?')) return;
                localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
                window.location.reload();
            } catch (err) {
                window.alert('That file could not be imported. Make sure it is an MW4 tracker backup (.json).');
            } finally {
                importFile.value = '';
            }
        };
        reader.readAsText(file);
    });

    // =========================
    // LEFT PANEL: COLORS + PROGRESS
    // =========================
    const updateGunItem = (gunName) => {
        const parts = gunNavItems[gunName];
        if (!parts) return;
        const { li, bar, count, badge } = parts;

        li.classList.remove(...ALL_TIER_CLASSES, ...ALL_DMZ_CLASSES);
        badge.textContent = '';
        badge.hidden = true;

        if (state.ui.mode === LOADOUT_MODE) {
            const dmz = peekDmz(gunName);
            li.classList.add(getDmzStatus(gunName));
            const manuals = Math.min(dmz.manuals || 0, dmzSettings.manualsForCamo);
            bar.style.width = `${(manuals / dmzSettings.manualsForCamo) * 100}%`;
            count.textContent = `${manuals}/${dmzSettings.manualsForCamo}`;
            const bpCount = (dmz.blueprints || []).length;
            if (bpCount > 0) {
                badge.textContent = `BP ${bpCount}`;
                badge.hidden = false;
            }
            return;
        }

        const mode = isCamoMode() ? state.ui.mode : modeOrder[0]; // e.g. Stats opened from Challenges
        const total = getEntries(mode, gunName).length;
        const done = getDoneCount(mode, gunName);
        bar.style.width = total ? `${(done / total) * 100}%` : '0%';
        count.textContent = `${done}/${total}`;

        const { tier } = getGunTier(mode, gunName);
        if (tier) li.classList.add('tiered', `tier-${tier}`);
    };

    // Gun type header only upgrades when *every* gun in that type reaches that tier.
    const updateGunTypeItem = (typeIndex) => {
        const parts = gunTypeParts[typeIndex];
        if (!parts) return;
        const { summary, badge } = parts;
        const guns = gunsArray[typeIndex] || [];

        summary.classList.remove(...ALL_TIER_CLASSES, ...ALL_DMZ_CLASSES);
        if (!guns.length) {
            badge.textContent = '';
            return;
        }

        if (state.ui.mode === LOADOUT_MODE) {
            const statuses = guns.map(getDmzStatus);
            const unlocked = statuses.filter(s => s !== 'dmz-locked').length;
            badge.textContent = `${unlocked}/${guns.length}`;
            badge.title = 'Weapons unlocked at the Gunsmith';
            if (statuses.every(s => s === 'dmz-camo')) summary.classList.add('dmz-camo');
            else if (unlocked === guns.length) summary.classList.add('dmz-unlocked');
            return;
        }

        const mode = isCamoMode() ? state.ui.mode : modeOrder[0];
        const tiers = guns.map(g => getGunTier(mode, g));
        const minRank = Math.min(...tiers.map(t => t.rank));
        const firstTier = getTierOrder(mode, guns[0])[0];
        const atFirstTier = tiers.filter(t => t.rank >= 0).length;

        badge.textContent = `${atFirstTier}/${guns.length}`;
        badge.title = `Weapons at ${getTierName(mode, firstTier)} or higher`;

        if (minRank >= 0) {
            const tier = getTierOrder(mode, guns[0])[minRank];
            summary.classList.add('tiered', `tier-${tier}`);
        }
    };

    const updateGunAndType = (gunName) => {
        updateGunItem(gunName);
        gunTypeArray.forEach((_, t) => {
            if (gunsArray[t].includes(gunName)) updateGunTypeItem(t);
        });
    };

    const updateAllColors = () => {
        allGuns.forEach(updateGunItem);
        gunTypeArray.forEach((_, i) => updateGunTypeItem(i));
    };

    const updateSelectedHighlight = () => {
        const selected = state.ui.mode === LOADOUT_MODE ? state.ui.dmzGun : state.ui.gun;
        Object.entries(gunNavItems).forEach(([gunName, { li }]) => {
            li.classList.toggle('selected', state.ui.view === 'detail' && gunName === selected);
        });
    };

    // =========================
    // LEFT PANEL: BUILD
    // =========================
    const buildLeftPanel = () => {
        gunTypeList.innerHTML = '';
        gunTypeArray.forEach((gunType, typeIndex) => {
            const details = el('details', 'gun-type-panel');
            details.open = state.ui.openTypes.includes(typeIndex);
            details.addEventListener('toggle', () => {
                if (searchInput.value.trim()) return; // don't save open state while searching
                const open = new Set(state.ui.openTypes);
                if (details.open) open.add(typeIndex); else open.delete(typeIndex);
                state.ui.openTypes = [...open];
                saveState();
            });

            const summary = el('summary', 'gun-type-summary');
            summary.appendChild(el('span', 'gun-type-name', gunType));
            const badge = el('span', 'gun-type-badge');
            summary.appendChild(badge);
            details.appendChild(summary);
            gunTypeParts[typeIndex] = { details, summary, badge };

            const list = el('ul', 'gun-list');
            gunsArray[typeIndex].forEach(gunName => {
                const li = el('li', 'gun-list-item');
                li.dataset.gun = gunName;
                li.tabIndex = 0;

                const row = el('div', 'gun-row');
                row.appendChild(el('span', 'gun-name', gunName));
                const badgeEl = el('span', 'gun-badge');
                badgeEl.hidden = true;
                row.appendChild(badgeEl);
                const countEl = el('span', 'gun-count');
                row.appendChild(countEl);
                li.appendChild(row);

                const track = el('div', 'gun-progress');
                const bar = el('div', 'gun-progress-fill');
                track.appendChild(bar);
                li.appendChild(track);

                li.addEventListener('click', () => selectGun(gunName));
                li.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        selectGun(gunName);
                    }
                });

                gunNavItems[gunName] = { li, bar, count: countEl, badge: badgeEl };
                list.appendChild(li);
            });

            details.appendChild(list);
            gunTypeList.appendChild(details);
        });
    };

    // Search filter for the left list
    searchInput.addEventListener('input', () => {
        const q = searchInput.value.trim().toLowerCase();
        gunTypeArray.forEach((_, typeIndex) => {
            const { details } = gunTypeParts[typeIndex];
            let anyVisible = false;
            gunsArray[typeIndex].forEach(gunName => {
                const match = !q || gunName.toLowerCase().includes(q);
                gunNavItems[gunName].li.hidden = !match;
                if (match) anyVisible = true;
            });
            details.hidden = !anyVisible;
            details.open = q ? anyVisible : state.ui.openTypes.includes(typeIndex);
        });
    });

    // =========================
    // TABS + LEGEND
    // =========================
    const buildTabs = () => {
        tabsContainer.innerHTML = '';

        const makeTab = (key, label, extraClass) => {
            const btn = el('button', `toggle-button${extraClass ? ` ${extraClass}` : ''}`, label);
            btn.addEventListener('click', () => {
                if (key === 'stats') {
                    state.ui.view = 'stats';
                } else {
                    state.ui.mode = key;
                    state.ui.view = 'detail';
                    if (key === LOADOUT_MODE) state.ui.dmzGun = null; // open on the overview
                }
                saveState();
                render();
            });
            tabsContainer.appendChild(btn);
            tabButtons[key] = btn;
        };

        modeOrder.forEach(mode => makeTab(mode, modeLabels[mode] || mode.toUpperCase()));
        tabsContainer.appendChild(el('span', 'tab-divider'));
        makeTab(LOADOUT_MODE, LOADOUT_LABEL, 'loadout-toggle');
        makeTab(CHALLENGE_MODE, CHALLENGE_LABEL, 'loadout-toggle');
        makeTab('stats', 'STATS', 'secondary-toggle');
    };

    const updateTabs = () => {
        Object.entries(tabButtons).forEach(([key, btn]) => {
            const active = key === 'stats'
                ? state.ui.view === 'stats'
                : state.ui.view === 'detail' && state.ui.mode === key;
            // When on stats, keep a faint marker on the mode the left list is colored by
            const context = key !== 'stats' && state.ui.view === 'stats' && state.ui.mode === key;
            btn.classList.toggle('active', active);
            btn.classList.toggle('context', context);
        });
    };

    const renderLegend = () => {
        legendEl.innerHTML = '';
        if (state.ui.mode === LOADOUT_MODE) {
            [
                ['dmz-locked', 'No manual yet'],
                ['dmz-unlocked', 'Unlocked at Gunsmith'],
                ['dmz-camo', `${dmzSettings.manualsForCamo} manuals: ${dmzSettings.lootCamoName}`]
            ].forEach(([cls, label]) => {
                const item = el('span', 'legend-item');
                item.appendChild(el('span', `legend-swatch ${cls}`));
                item.appendChild(el('span', null, label));
                legendEl.appendChild(item);
            });
            return;
        }

        if (state.ui.mode === CHALLENGE_MODE && state.ui.view === 'detail') return; // no color key needed
        const legendMode = isCamoMode() ? state.ui.mode : modeOrder[0];
        const camos = getGunCamos(legendMode, allGuns[0]).filter(c => c.tier);
        legendEl.appendChild(el('span', 'legend-title', 'Colors:'));
        camos.forEach(camo => {
            const item = el('span', 'legend-item');
            item.appendChild(el('span', `legend-swatch tiered tier-${camo.tier}`));
            item.appendChild(el('span', null, camo.name));
            legendEl.appendChild(item);
        });
    };

    // =========================
    // RIGHT PANEL: CAMO DETAIL
    // =========================
    const buildSegmented = (options, current, onPick, className = '') => {
        const wrap = el('div', `segmented ${className}`.trim());
        options.forEach(([value, label]) => {
            const btn = el('button', `segment${value === current ? ' active' : ''}`, label);
            btn.type = 'button';
            btn.addEventListener('click', () => {
                if (value !== current) onPick(value);
            });
            wrap.appendChild(btn);
        });
        return wrap;
    };

    const renderCamoPanel = (gunName) => {
        rightPanel.innerHTML = '';
        const mode = state.ui.mode;

        if (!gunName) {
            rightPanel.appendChild(el('p', 'placeholder-text', 'Select a weapon on the left to see its camos.'));
            return;
        }

        const isTrack = mode === 'track';
        const view = isTrack ? getTrackView() : null;
        const entries = getEntries(mode, gunName, view);

        const header = el('div', 'right-panel-header');
        const titleRow = el('div', 'title-row');
        titleRow.appendChild(el('h2', null, gunName));
        const tierPill = el('span', 'tier-pill');
        titleRow.appendChild(tierPill);

        // Per-gun MP / DMZ toggle on the camo track
        if (isTrack) {
            const toggle = buildSegmented(
                trackViewKeys.map(k => [k, trackViews[k]]),
                view,
                (picked) => {
                    const scrollBefore = rightPanel.scrollTop;
                    state.ui.trackMode = picked; // applies to every gun until changed back
                    saveState();
                    renderCamoPanel(gunName);
                    rightPanel.scrollTop = scrollBefore;
                },
                'view-toggle'
            );
            titleRow.appendChild(toggle);
        }
        header.appendChild(titleRow);

        const subtitle = isTrack ? `${trackViews[view]} camo track` : `${modeLabels[mode]} camos`;
        header.appendChild(el('p', 'panel-subtitle', subtitle));
        // If every camo is shared, say it once instead of tagging every row
        const allShared = isTrack && getGunCamos(mode, gunName).every(c => (c.modes || []).length > 1);
        if (isTrack) {
            header.appendChild(el('p', 'panel-hint', allShared
                ? 'Every camo here is shared between MP and DMZ: check it in either view and it counts in both.'
                : 'Camos marked "MP + DMZ" are shared: check them in either view and they count in both.'));
        }
        rightPanel.appendChild(header);

        const listEl = el('div', 'camo-list');
        let lastSection = null;

        entries.forEach(({ camo, key }) => {
            if (camo.section && camo.section !== lastSection) {
                listEl.appendChild(el('h3', 'camo-section', camo.section));
                lastSection = camo.section;
            }

            const row = el('label', 'camo-row');
            if (camo.tier) row.classList.add('milestone', `tier-${camo.tier}`);

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = isChecked(mode, gunName, key);

            const info = el('div', 'camo-info');
            const nameLine = el('div', 'camo-name-line');
            nameLine.appendChild(el('span', 'camo-name', camo.name));
            if (isTrack && !allShared && (camo.modes || []).length > 1) {
                nameLine.appendChild(el('span', 'shared-tag', 'MP + DMZ'));
            }
            info.appendChild(nameLine);
            const challenge = getChallenge(camo, view);
            if (challenge) info.appendChild(el('p', 'camo-challenge', challenge));
            if (camo.unlock) info.appendChild(el('p', 'camo-unlock', camo.unlock));

            checkbox.addEventListener('change', () => {
                setChecked(mode, gunName, key, checkbox.checked);
                row.classList.toggle('done', checkbox.checked);
                updateGunAndType(gunName);
                updateProgress();
            });

            row.classList.toggle('done', checkbox.checked);
            row.appendChild(checkbox);
            row.appendChild(info);
            listEl.appendChild(row);
        });

        rightPanel.appendChild(listEl);

        const footer = el('div', 'progress-footer');
        const progressText = el('p', 'progress-text');
        const progressTrack = el('div', 'progress-track');
        const progressFill = el('div', 'progress-fill');
        progressTrack.appendChild(progressFill);
        footer.appendChild(progressText);
        footer.appendChild(progressTrack);
        rightPanel.appendChild(footer);

        const updateProgress = () => {
            const done = countDone(mode, gunName, entries);
            const total = entries.length;
            progressText.textContent = isTrack
                ? `${done}/${total} ${trackViews[view]} camos completed`
                : `${done}/${total} camos completed`;
            progressFill.style.width = total ? `${(done / total) * 100}%` : '0%';

            const { tier } = getGunTier(mode, gunName);
            tierPill.className = 'tier-pill';
            if (tier) {
                tierPill.classList.add('tiered', `tier-${tier}`);
                tierPill.textContent = getTierName(mode, tier);
                tierPill.hidden = false;
            } else {
                tierPill.hidden = true;
            }
        };

        updateProgress();
    };

    // =========================
    // RIGHT PANEL: DMZ SHARED PIECES
    // =========================
    const buildManualPips = (gunName, interactive, onChange) => {
        const wrap = el('div', `manual-pips${interactive ? ' interactive' : ''}`);
        const manuals = peekDmz(gunName).manuals || 0;
        for (let n = 1; n <= dmzSettings.manualsForCamo; n++) {
            const pip = el(interactive ? 'button' : 'span', 'pip');
            if (n <= manuals) pip.classList.add('filled');
            if (manuals >= dmzSettings.manualsForCamo) pip.classList.add('complete');
            if (interactive) {
                pip.type = 'button';
                pip.title = `Set manuals extracted to ${n}`;
                pip.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const entry = getDmz(gunName);
                    // Clicking the current highest pip steps back one (so you can undo)
                    entry.manuals = entry.manuals === n ? n - 1 : n;
                    saveState();
                    onChange();
                });
            }
            wrap.appendChild(pip);
        }
        return wrap;
    };

    const buildStatCards = (items) => {
        const cards = el('div', 'stat-cards');
        items.forEach(([label, value]) => {
            const card = el('div', 'stat-card');
            card.appendChild(el('span', 'stat-value', value));
            card.appendChild(el('span', 'stat-label', label));
            cards.appendChild(card);
        });
        return cards;
    };

    // Rarity tag. Clickable tags cycle through rarities.
    const buildRarityTag = (rarity, onCycle) => {
        const tag = el(onCycle ? 'button' : 'span', `rarity-tag${rarity ? ` rarity-${rarity}` : ' rarity-none'}`,
            rarity ? (rarityLabel[rarity] || rarity.toUpperCase()) : 'NO RARITY');
        if (onCycle) {
            tag.type = 'button';
            tag.title = 'Click to change rarity';
            tag.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                onCycle();
            });
        }
        return tag;
    };

    const buildRaritySelect = () => {
        const select = el('select', 'text-input select-input');
        select.appendChild(new Option('Rarity (optional)', ''));
        dmzSettings.rarities.forEach(r => select.appendChild(new Option(r.label, r.id)));
        return select;
    };

    const buildDmzHeader = () => {
        const header = el('div', 'right-panel-header');
        const titleRow = el('div', 'title-row');
        titleRow.appendChild(el('h2', null, 'DMZ LOADOUT'));
        titleRow.appendChild(buildSegmented(
            [['weapons', 'WEAPONS & MANUALS'], ['blueprints', 'BLUEPRINTS & RECIPES'], ['notes', 'NOTES & MATERIALS']],
            state.ui.dmzView,
            (picked) => {
                state.ui.dmzView = picked;
                saveState();
                render();
            },
            'view-toggle'
        ));
        header.appendChild(titleRow);
        return header;
    };

    // =========================
    // RIGHT PANEL: DMZ WEAPONS OVERVIEW (second-monitor view)
    // =========================
    const renderDmzOverview = () => {
        rightPanel.innerHTML = '';
        const header = buildDmzHeader();
        header.appendChild(el('p', 'panel-subtitle', 'Manuals extracted per weapon. Click a weapon to edit.'));
        rightPanel.appendChild(header);

        const unlocked = allGuns.filter(g => getDmzStatus(g) !== 'dmz-locked').length;
        const camos = allGuns.filter(g => getDmzStatus(g) === 'dmz-camo').length;
        const bps = allGuns.flatMap(g => peekDmz(g).blueprints || []);
        rightPanel.appendChild(buildStatCards([
            ['Unlocked at Gunsmith', `${unlocked}/${allGuns.length}`],
            [dmzSettings.lootCamoName, `${camos}/${allGuns.length}`],
            ['Weapon blueprints', `${bps.length}`],
            ['Recipes obtained', `${state.gear.filter(g => g.obtained).length}/${state.gear.length}`]
        ]));

        gunTypeArray.forEach((gunType, typeIndex) => {
            const guns = gunsArray[typeIndex];
            if (!guns.length) return;
            rightPanel.appendChild(el('h3', 'camo-section', gunType));
            const grid = el('div', 'dmz-grid');

            guns.forEach(gunName => {
                const dmz = peekDmz(gunName);
                const card = el('button', `dmz-card ${getDmzStatus(gunName)}`);
                card.type = 'button';
                card.addEventListener('click', () => selectGun(gunName));

                const top = el('div', 'dmz-card-top');
                top.appendChild(el('span', 'dmz-card-name', gunName));
                top.appendChild(buildManualPips(gunName, false));
                card.appendChild(top);

                const chips = el('div', 'bp-chips');
                (dmz.blueprints || []).forEach(bp => {
                    const chip = el('span', `bp-chip${bp.claimed ? ' claimed' : ''}${bp.rarity ? ` rarity-${bp.rarity}` : ''}`, bp.name);
                    chip.title = bp.claimed ? 'Free copy already claimed' : 'Free copy available';
                    chips.appendChild(chip);
                });
                if (!(dmz.blueprints || []).length) chips.appendChild(el('span', 'bp-empty', 'No blueprints'));
                card.appendChild(chips);

                grid.appendChild(card);
            });
            rightPanel.appendChild(grid);
        });
    };

    // =========================
    // RIGHT PANEL: BLUEPRINTS & RECIPES (3D Printer upgrades + recipe checklist)
    // =========================
    const renderBlueprintsView = () => {
        const keepScroll = rightPanel.scrollTop;
        rightPanel.innerHTML = '';
        const rerender = () => renderBlueprintsView();

        const header = buildDmzHeader();
        header.appendChild(el('p', 'panel-subtitle', 'Add the recipes you want, then check them off when you get them.'));
        rightPanel.appendChild(header);

        const obtainedCount = state.gear.filter(g => g.obtained).length;
        const maxedCount = state.upgrades.filter(isMaxed).length;
        rightPanel.appendChild(buildStatCards([
            ['Upgrades maxed', `${maxedCount}/${state.upgrades.length}`],
            ['Recipes obtained', `${obtainedCount}/${state.gear.length}`],
            ['Still need', `${state.gear.length - obtainedCount}`]
        ]));

        // ----- Add form -----
        const form = el('form', 'bp-add-form');
        const typeSelect = el('select', 'text-input select-input');
        typeSelect.appendChild(new Option('UPGRADES', UPGRADE_TYPE));
        recipeCategories.forEach(cat => typeSelect.appendChild(new Option(cat, cat)));
        // Weapon blueprints are logged per gun under WEAPONS & MANUALS
        const validTypes = [UPGRADE_TYPE, ...recipeCategories];
        typeSelect.value = validTypes.includes(state.ui.bpType) ? state.ui.bpType : UPGRADE_TYPE;

        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.maxLength = 60;
        nameInput.className = 'text-input';

        const raritySelect = buildRaritySelect();
        const addBtn = el('button', 'toggle-button small', 'Add');
        addBtn.type = 'submit';

        const syncForm = () => {
            const isUpgrade = typeSelect.value === UPGRADE_TYPE;
            raritySelect.hidden = isUpgrade;
            nameInput.placeholder = isUpgrade ? 'Upgrade name as shown in game (e.g. Armory Upgrade II)'
                : 'Recipe name (e.g. Medkit)';
        };
        typeSelect.addEventListener('change', () => {
            state.ui.bpType = typeSelect.value;
            saveState();
            syncForm();
        });
        syncForm();

        [typeSelect, nameInput, raritySelect, addBtn].forEach(n => form.appendChild(n));
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const name = nameInput.value.trim().toUpperCase();
            if (!name) {
                nameInput.focus();
                return;
            }
            const rarity = raritySelect.value || '';
            if (typeSelect.value === UPGRADE_TYPE) {
                // The numeral shown in game is the next tier to build
                const { base, tier } = splitTier(name);
                if (findUpgrade(base)) {
                    window.alert(`"${base}" is already in your Upgrades. Use its + / - buttons to change the tier.`);
                    return;
                }
                state.upgrades.push({ name: base, built: tier ? tier - 1 : 0, maxed: false });
            } else {
                const dupe = state.gear.find(g => recipeId(g.category, g.name) === recipeId(typeSelect.value, name));
                if (dupe) {
                    window.alert(`"${name}" is already on your ${typeSelect.value} list.`);
                    return;
                }
                state.gear.push({ category: typeSelect.value, name, rarity, obtained: false });
            }
            saveState();
            rerender();
            const next = rightPanel.querySelector('.bp-add-form input[type="text"]');
            if (next) next.focus();
        });
        rightPanel.appendChild(form);

        // ----- Filter -----
        const filter = state.ui.bpFilter;
        const filterRow = el('div', 'bp-filter-row');
        filterRow.appendChild(el('span', 'legend-title', 'Show:'));
        filterRow.appendChild(buildSegmented(
            [['all', 'ALL'], ['need', 'STILL NEED'], ['obtained', 'OBTAINED']],
            filter,
            (picked) => {
                state.ui.bpFilter = picked;
                saveState();
                rerender();
            }
        ));
        rightPanel.appendChild(filterRow);

        const matchesFilter = (obtained) => filter === 'all' || (filter === 'need' ? !obtained : obtained);

        // ----- 3D Printer upgrades (tracked by tier) -----
        {
            const all = state.upgrades.map((u, index) => ({ u, index }));
            const maxedAll = all.filter(x => isMaxed(x.u)).length;
            const shown = all.filter(x => matchesFilter(isMaxed(x.u)));

            const heading = el('h3', 'camo-section recipe-heading', 'UPGRADES');
            heading.appendChild(el('span', `recipe-count${all.length && maxedAll === all.length ? ' complete' : ''}`, `${maxedAll}/${all.length} MAXED`));
            rightPanel.appendChild(heading);

            if (!shown.length) {
                let msg = 'Nothing added yet.';
                if (all.length && filter === 'need') msg = 'All maxed.';
                else if (all.length && filter === 'obtained') msg = 'None maxed yet.';
                rightPanel.appendChild(el('p', 'bp-empty', msg));
            } else {
                const grid = el('div', 'bp-grid upgrade-grid');
                shown.forEach(({ u, index }) => {
                    const maxed = isMaxed(u);
                    const card = el('div', `bp-card upgrade-card${maxed ? ' maxed' : ''}`);

                    const top = el('div', 'bp-card-top');
                    top.appendChild(el('span', 'bp-card-name', u.name));
                    top.appendChild(buildRemoveButton(u.name, () => {
                        state.upgrades.splice(index, 1);
                    }, rerender));
                    card.appendChild(top);

                    // Tier boxes: built tiers filled, the next tier dashed
                    const boxes = el('div', 'tier-boxes');
                    const lastShown = maxed ? u.built : Math.max(u.built + 1, u.maxTier || 0);
                    for (let t = 1; t <= lastShown; t++) {
                        let cls = 'tier-box';
                        if (t <= u.built) cls += ' built';
                        else if (t === u.built + 1) cls += ' next';
                        boxes.appendChild(el('span', cls, toRoman(t)));
                    }
                    card.appendChild(boxes);

                    const bottom = el('div', 'bp-card-bottom');
                    let status;
                    if (maxed) status = u.built ? `MAXED AT ${toRoman(u.built)}` : 'MAXED';
                    else if (u.built === 0) status = `NEXT: ${toRoman(1)}`;
                    else status = `NEXT: ${toRoman(u.built + 1)}`;
                    bottom.appendChild(el('span', 'upgrade-status', status));

                    const controls = el('div', 'upgrade-controls');
                    const minus = el('button', 'step-button', '−');
                    minus.type = 'button';
                    minus.title = 'One tier less';
                    minus.disabled = u.built <= 0;
                    minus.addEventListener('click', () => {
                        const target = state.upgrades[index];
                        target.built = Math.max(0, target.built - 1);
                        target.maxed = false;
                        saveState();
                        rerender();
                    });
                    const plus = el('button', 'step-button', '+');
                    plus.type = 'button';
                    plus.title = 'Built the next tier';
                    plus.addEventListener('click', () => {
                        const target = state.upgrades[index];
                        target.built += 1;
                        // A new tier past a known max means the game added more tiers
                        if (target.maxTier && target.built > target.maxTier) delete target.maxTier;
                        target.maxed = false;
                        saveState();
                        rerender();
                    });
                    const maxLabel = el('label', 'bp-card-claim');
                    const maxCb = document.createElement('input');
                    maxCb.type = 'checkbox';
                    maxCb.checked = maxed;
                    maxCb.addEventListener('change', () => {
                        const target = state.upgrades[index];
                        target.maxed = maxCb.checked;
                        if (maxCb.checked && target.built < 1) target.built = 1;
                        if (!maxCb.checked && target.maxTier && target.built >= target.maxTier) delete target.maxTier;
                        saveState();
                        rerender();
                    });
                    maxLabel.appendChild(maxCb);
                    maxLabel.appendChild(el('span', null, 'Maxed'));
                    controls.appendChild(minus);
                    controls.appendChild(plus);
                    controls.appendChild(maxLabel);
                    bottom.appendChild(controls);
                    card.appendChild(bottom);

                    grid.appendChild(card);
                });
                rightPanel.appendChild(grid);
            }
        }

        // ----- 3D Printer recipes by category -----
        // Include any saved category that isn't in the settings list at the end so nothing is lost.
        const extraCats = [...new Set(state.gear.map(g => g.category))].filter(c => !recipeCategories.includes(c));
        [...recipeCategories, ...extraCats].forEach(category => {
            const all = state.gear.map((item, index) => ({ item, index })).filter(x => x.item.category === category);
            const have = all.filter(x => x.item.obtained).length;
            const shown = all.filter(x => matchesFilter(x.item.obtained));

            const heading = el('h3', 'camo-section recipe-heading', category);
            const count = el('span', `recipe-count${all.length && have === all.length ? ' complete' : ''}`, `${have}/${all.length}`);
            heading.appendChild(count);
            rightPanel.appendChild(heading);

            if (!shown.length) {
                let msg = 'Nothing added yet.';
                if (all.length && filter === 'need') msg = 'All obtained.';
                else if (all.length && filter === 'obtained') msg = 'None obtained yet.';
                rightPanel.appendChild(el('p', 'bp-empty', msg));
                return;
            }

            const grid = el('div', 'bp-grid');
            shown.forEach(({ item, index }) => {
                // The whole card is a label, so clicking anywhere on it checks it off
                const card = el('label', `bp-card recipe-card ${item.obtained ? 'obtained' : 'needed'}${item.rarity ? ` rarity-${item.rarity}` : ''}`);
                const top = el('div', 'bp-card-top');
                const cb = document.createElement('input');
                cb.type = 'checkbox';
                cb.className = 'recipe-check';
                cb.checked = Boolean(item.obtained);
                cb.addEventListener('change', () => {
                    state.gear[index].obtained = cb.checked;
                    saveState();
                    rerender();
                });
                top.appendChild(cb);
                top.appendChild(el('span', 'bp-card-name', item.name));
                top.appendChild(buildRemoveButton(item.name, () => {
                    state.gear.splice(index, 1);
                }, rerender));
                card.appendChild(top);

                const bottom = el('div', 'bp-card-bottom');
                bottom.appendChild(buildRarityTag(item.rarity, () => {
                    state.gear[index].rarity = nextRarity(item.rarity);
                    saveState();
                    rerender();
                }));
                bottom.appendChild(el('span', 'recipe-status', item.obtained ? 'OBTAINED' : 'NEED'));
                card.appendChild(bottom);
                grid.appendChild(card);
            });
            rightPanel.appendChild(grid);
        });

        rightPanel.scrollTop = keepScroll;
    };

    // =========================
    // RIGHT PANEL: NOTES & MATERIALS (notepad + materials to collect for a craft)
    // =========================
    const matKey = (name) => name.trim().toUpperCase();

    // A catalog entry is "Name" or { name, rarity }.
    const toMatItem = (m) => (typeof m === 'string'
        ? { name: matKey(m), rarity: '' }
        : { name: matKey((m && m.name) || ''), rarity: (m && m.rarity) || '' });

    // [[group, [{ name, rarity }], isCustom], ...] from mw4-data.js, plus materials added in the app.
    const getMaterialGroups = () => {
        const groups = Object.entries(dmzSettings.materialCatalog || {})
            .map(([group, items]) => [group, (items || []).map(toMatItem).filter(i => i.name), false]);
        const known = new Set(groups.flatMap(([, items]) => items.map(i => i.name)));
        const custom = state.materials.custom.map(toMatItem).filter(i => i.name && !known.has(i.name));
        if (custom.length) groups.push(['ADDED BY YOU', custom, true]);
        return groups;
    };

    const rarityClass = (rarity) => (rarity ? ` rarity-${rarity}` : '');

    // Notepad saves shortly after you stop typing (and right away when you click out).
    let notesSaveTimer = null;
    const flushNotes = () => {
        if (!notesSaveTimer) return;
        clearTimeout(notesSaveTimer);
        notesSaveTimer = null;
        saveState();
    };
    window.addEventListener('beforeunload', flushNotes);

    const renderNotesView = () => {
        const keepScroll = rightPanel.scrollTop;
        rightPanel.innerHTML = '';
        const rerender = () => renderNotesView();
        const mats = state.materials;
        const tracked = mats.tracked;
        const materialGroups = getMaterialGroups();
        const rarityOf = Object.fromEntries(materialGroups.flatMap(([, items]) => items.map(i => [i.name, i.rarity])));

        const header = buildDmzHeader();
        header.appendChild(el('p', 'panel-subtitle', 'Jot down plans, and pick what to craft to get a shopping list of materials.'));
        rightPanel.appendChild(header);

        // ----- Notepad -----
        const noteSection = el('div', 'dmz-section');
        const noteHeading = el('h3', 'camo-section recipe-heading', 'NOTEPAD');
        const savedTag = el('span', 'recipe-count', 'SAVED');
        noteHeading.appendChild(savedTag);
        noteSection.appendChild(noteHeading);

        const pad = el('textarea', 'text-input notepad');
        pad.value = state.notes;
        pad.placeholder = 'Plans, extract spots, keys to grab, what to print next...';
        pad.addEventListener('input', () => {
            state.notes = pad.value;
            savedTag.textContent = 'SAVING...';
            clearTimeout(notesSaveTimer);
            notesSaveTimer = setTimeout(() => {
                flushNotes();
                savedTag.textContent = 'SAVED';
            }, 400);
        });
        pad.addEventListener('blur', () => {
            flushNotes();
            savedTag.textContent = 'SAVED';
        });
        noteSection.appendChild(pad);
        rightPanel.appendChild(noteSection);

        // ----- Materials tracker -----
        // Shopping list: add up the materials for every item picked under "Crafting for".
        const craftNeeds = {};    // MATERIAL -> total needed by the picked items
        const craftSources = {};  // MATERIAL -> ["MEDKIT ×2", ...]
        mats.crafting.forEach(({ name, qty }) => {
            const recipe = craftRecipes[matKey(name)];
            if (!recipe) return;
            Object.entries(recipe.materials).forEach(([m, amount]) => {
                craftNeeds[m] = (craftNeeds[m] || 0) + amount * qty;
                (craftSources[m] = craftSources[m] || []).push(`${recipe.name} ×${qty}`);
            });
        });
        // Every needed material gets a row; rows added for crafts are dropped once nothing
        // needs them (unless you've started counting them).
        let listChanged = false;
        Object.keys(craftNeeds).forEach(m => {
            if (tracked.some(t => matKey(t.name) === m)) return;
            tracked.push({ name: m, have: 0, need: 0, auto: true });
            listChanged = true;
        });
        for (let i = tracked.length - 1; i >= 0; i--) {
            const t = tracked[i];
            if (t.auto && !craftNeeds[matKey(t.name)] && !t.have && !t.need) {
                tracked.splice(i, 1);
                listChanged = true;
            }
        }
        if (listChanged) saveState();
        const recipeNeed = (t) => craftNeeds[matKey(t.name)] || 0;
        const needOf = (t) => recipeNeed(t) || t.need;

        const matSection = el('div', 'dmz-section');
        const matHeading = el('h3', 'camo-section recipe-heading', 'MATERIALS TRACKER');
        const readyPill = el('span', 'recipe-count');
        matHeading.appendChild(readyPill);
        matSection.appendChild(matHeading);

        const updateReadyPill = () => {
            const withTarget = tracked.filter(t => needOf(t) > 0);
            const ready = withTarget.filter(t => t.have >= needOf(t)).length;
            readyPill.textContent = withTarget.length ? `${ready}/${withTarget.length} READY` : `${tracked.length} TRACKED`;
            readyPill.classList.toggle('complete', withTarget.length > 0 && ready === withTarget.length);
        };

        // Rarity + 3D Printer category for each craftable item (your recipe list wins)
        const itemInfo = {};
        Object.entries(dmzSettings.recipeCatalog || {}).forEach(([category, items]) => (items || []).forEach(it => {
            itemInfo[matKey(it.name)] = { category, rarity: it.rarity || '' };
        }));
        state.gear.forEach(g => {
            const key = matKey(g.name);
            itemInfo[key] = { category: g.category, rarity: g.rarity || (itemInfo[key] || {}).rarity || '' };
        });
        const costText = (recipe) => Object.entries(recipe.materials).map(([m, n]) => `${n} ${m}`).join(' · ');

        // "Crafting for": the picked items, each with a quantity
        const craftBar = el('div', 'mat-toolbar craft-bar');
        craftBar.appendChild(el('span', 'mat-label', 'Crafting for'));
        const picked = el('div', 'craft-picked');
        if (!mats.crafting.length) picked.appendChild(el('span', 'bp-empty', 'Nothing yet. Pick items below to build a shopping list.'));
        mats.crafting.forEach(c => {
            const recipe = craftRecipes[matKey(c.name)];
            const pill = el('span', `craft-pill${rarityClass((itemInfo[matKey(c.name)] || {}).rarity)}`);
            pill.title = recipe ? `Each one costs: ${costText(recipe)}` : 'No recipe cost for this item yet';
            pill.appendChild(el('span', 'craft-pill-name', c.name));
            const minus = el('button', 'step-button', '−');
            minus.type = 'button';
            minus.title = 'Craft one less';
            minus.disabled = c.qty <= 1;
            minus.addEventListener('click', () => {
                c.qty = Math.max(1, c.qty - 1);
                saveState();
                rerender();
            });
            const plus = el('button', 'step-button', '+');
            plus.type = 'button';
            plus.title = 'Craft one more';
            plus.addEventListener('click', () => {
                c.qty += 1;
                saveState();
                rerender();
            });
            const remove = el('button', 'icon-button', '×');
            remove.type = 'button';
            remove.title = 'Stop crafting this';
            remove.addEventListener('click', () => {
                mats.crafting.splice(mats.crafting.indexOf(c), 1);
                saveState();
                rerender();
            });
            [minus, el('span', 'craft-qty', `×${c.qty}`), plus, remove].forEach(n => pill.appendChild(n));
            picked.appendChild(pill);
        });
        craftBar.appendChild(picked);

        const resetBtn = el('button', 'ghost-button', 'Reset counts');
        resetBtn.type = 'button';
        resetBtn.title = 'Set every HAVE count back to 0 (keeps the list)';
        resetBtn.disabled = !tracked.length;
        resetBtn.addEventListener('click', () => {
            if (!window.confirm('Set every HAVE count back to 0?')) return;
            tracked.forEach(t => { t.have = 0; });
            saveState();
            rerender();
        });
        const clearBtn = el('button', 'ghost-button', 'Clear list');
        clearBtn.type = 'button';
        clearBtn.disabled = !tracked.length && !mats.crafting.length;
        clearBtn.addEventListener('click', () => {
            if (!window.confirm('Stop tracking every material and clear the items you picked?')) return;
            tracked.splice(0, tracked.length);
            mats.crafting.splice(0, mats.crafting.length);
            saveState();
            rerender();
        });
        const listButtons = el('div', 'craft-buttons');
        listButtons.appendChild(resetBtn);
        listButtons.appendChild(clearBtn);
        craftBar.appendChild(listButtons);
        matSection.appendChild(craftBar);

        // Item picker, grouped like the 3D Printer menu and colored by rarity
        const craftPicker = document.createElement('details');
        craftPicker.className = 'craft-picker';
        craftPicker.open = state.ui.craftPickerOpen !== false;
        craftPicker.addEventListener('toggle', () => {
            state.ui.craftPickerOpen = craftPicker.open;
            saveState();
        });
        const recipeList = Object.values(craftRecipes);
        craftPicker.appendChild(el('summary', 'craft-picker-summary', `PICK ITEMS TO CRAFT (${recipeList.length})`));
        const pickedSet = new Set(mats.crafting.map(c => matKey(c.name)));
        const byCategory = {};
        recipeList.forEach(r => {
            const cat = (itemInfo[r.name] || {}).category || 'OTHER';
            (byCategory[cat] = byCategory[cat] || []).push(r);
        });
        // Rarest first inside each group (Ultra -> Common, no rarity last); ties keep data order
        const rarityRank = (name) => {
            const r = (itemInfo[name] || {}).rarity;
            const i = dmzSettings.rarities.findIndex(x => x.id === r);
            return i < 0 ? -1 : i;
        };
        Object.values(byCategory).forEach(list => list.sort((a, b) => rarityRank(b.name) - rarityRank(a.name)));
        const catOrder = [...recipeCategories, ...Object.keys(byCategory).filter(c => !recipeCategories.includes(c))];
        catOrder.filter(cat => byCategory[cat]).forEach(cat => {
            craftPicker.appendChild(el('h4', 'mat-group-label', cat));
            const chips = el('div', 'mat-chips');
            byCategory[cat].forEach(r => {
                const on = pickedSet.has(r.name);
                const chip = el('button', `mat-chip craft-chip${on ? ' tracked' : ''}${rarityClass((itemInfo[r.name] || {}).rarity)}`);
                chip.type = 'button';
                chip.setAttribute('aria-pressed', String(on));
                chip.appendChild(el('span', 'craft-chip-name', r.name));
                chip.appendChild(el('span', 'craft-chip-cost', costText(r)));
                chip.addEventListener('click', () => {
                    const i = mats.crafting.findIndex(c => matKey(c.name) === r.name);
                    if (i >= 0) mats.crafting.splice(i, 1);
                    else mats.crafting.push({ name: r.name, qty: 1 });
                    saveState();
                    rerender();
                });
                chips.appendChild(chip);
            });
            craftPicker.appendChild(chips);
        });
        craftPicker.appendChild(el('p', 'panel-hint',
            'Only items with known costs are listed. Add more under craftingRecipes in mw4-data.js.'));
        matSection.appendChild(craftPicker);

        // Tracked rows: HAVE (with -/+) and NEED. Typing updates in place so focus isn't lost.
        const numInput = (value, label) => {
            const input = document.createElement('input');
            input.type = 'number';
            input.min = '0';
            input.inputMode = 'numeric';
            input.className = 'text-input mat-num';
            input.value = value;
            input.setAttribute('aria-label', label);
            return input;
        };

        const buildMatRow = (t) => {
            const fromCraft = recipeNeed(t);
            const row = el('div', `mat-row${fromCraft ? ' from-craft' : ''}`);
            const nameWrap = el('div', 'mat-name-wrap');
            nameWrap.appendChild(el('span', `mat-name${rarityClass(rarityOf[matKey(t.name)])}`, t.name));
            if (fromCraft) nameWrap.appendChild(el('span', 'mat-sources', `For ${craftSources[matKey(t.name)].join(', ')}`));
            row.appendChild(nameWrap);

            const haveGroup = el('div', 'mat-counts');
            haveGroup.appendChild(el('span', 'mat-count-label', 'HAVE'));
            const minus = el('button', 'step-button', '−');
            minus.type = 'button';
            minus.title = 'One less (Shift: 10 less)';
            const haveInput = numInput(t.have, `${t.name} have`);
            const plus = el('button', 'step-button', '+');
            plus.type = 'button';
            plus.title = 'One more (Shift: 10 more)';
            [minus, haveInput, plus].forEach(n => haveGroup.appendChild(n));
            row.appendChild(haveGroup);

            const needGroup = el('div', 'mat-counts');
            needGroup.appendChild(el('span', 'mat-count-label', 'NEED'));
            const needInput = numInput(fromCraft || t.need || '', `${t.name} need`);
            needInput.placeholder = '–';
            if (fromCraft) {
                needInput.disabled = true;
                needInput.title = 'Worked out from the items you picked to craft';
            }
            needGroup.appendChild(needInput);
            row.appendChild(needGroup);

            const status = el('span', 'mat-status');
            row.appendChild(status);

            const remove = el('button', 'icon-button', '×');
            remove.type = 'button';
            remove.title = fromCraft ? 'Needed for an item you picked: remove that item to drop this' : 'Stop tracking';
            remove.disabled = Boolean(fromCraft);
            remove.addEventListener('click', () => {
                if (t.have > 0 && !window.confirm(`Stop tracking "${t.name}"? Your count (${t.have}) will be cleared.`)) return;
                tracked.splice(tracked.indexOf(t), 1);
                saveState();
                rerender();
            });
            row.appendChild(remove);

            const bar = el('div', 'mat-progress');
            const fill = el('div', 'mat-progress-fill');
            bar.appendChild(fill);
            row.appendChild(bar);

            const sync = () => {
                const need = needOf(t);
                const ready = need > 0 && t.have >= need;
                row.classList.toggle('ready', ready);
                row.classList.toggle('no-target', !need);
                status.classList.toggle('no-target', !need);
                minus.disabled = t.have <= 0;
                if (!need) status.textContent = 'NO TARGET';
                else status.textContent = ready ? 'READY' : `${need - t.have} LEFT`;
                fill.style.width = need ? `${Math.min(100, (t.have / need) * 100)}%` : '0%';
                updateReadyPill();
            };

            const step = (dir) => (e) => {
                t.have = Math.max(0, t.have + dir * (e.shiftKey ? 10 : 1));
                haveInput.value = t.have;
                saveState();
                sync();
            };
            minus.addEventListener('click', step(-1));
            plus.addEventListener('click', step(1));
            haveInput.addEventListener('input', () => {
                t.have = toCount(haveInput.value);
                saveState();
                sync();
            });
            haveInput.addEventListener('change', () => { haveInput.value = t.have; });
            needInput.addEventListener('input', () => {
                t.need = toCount(needInput.value);
                saveState();
                sync();
            });
            needInput.addEventListener('change', () => { needInput.value = t.need || ''; });

            sync();
            return row;
        };

        const list = el('div', 'mat-list');
        if (!tracked.length) list.appendChild(el('p', 'bp-empty', 'Nothing tracked yet. Pick items to craft above, or click materials below.'));
        tracked.forEach(t => list.appendChild(buildMatRow(t)));
        matSection.appendChild(list);
        updateReadyPill();

        // ----- Material picker -----
        const trackedSet = new Set(tracked.map(t => matKey(t.name)));
        const toggleMaterial = (name) => {
            const i = tracked.findIndex(t => matKey(t.name) === name);
            if (i >= 0) {
                const t = tracked[i];
                if (recipeNeed(t)) {
                    window.alert(`${t.name} is needed for an item you picked to craft. Remove that item to stop tracking it.`);
                    return;
                }
                if (t.have > 0 && !window.confirm(`Stop tracking "${t.name}"? Your count (${t.have}) will be cleared.`)) return;
                tracked.splice(i, 1);
            } else {
                tracked.push({ name, have: 0, need: 0 });
            }
            saveState();
            rerender();
        };

        const picker = el('div', 'mat-picker');
        picker.appendChild(el('p', 'panel-hint', 'Click a material to track it. Click it again to stop tracking.'));
        materialGroups.forEach(([group, items, isCustom]) => {
            picker.appendChild(el('h4', 'mat-group-label', group));
            const chips = el('div', 'mat-chips');
            items.forEach(({ name, rarity }) => {
                const on = trackedSet.has(name);
                const chip = el('button', `mat-chip${on ? ' tracked' : ''}${rarityClass(rarity)}`, name);
                chip.type = 'button';
                if (rarity) chip.title = rarityLabel[rarity] || rarity.toUpperCase();
                chip.setAttribute('aria-pressed', String(on));
                chip.addEventListener('click', () => toggleMaterial(name));
                if (!isCustom) {
                    chips.appendChild(chip);
                    return;
                }
                // Materials you added can be deleted from the picker
                const wrap = el('span', 'mat-chip-wrap');
                wrap.appendChild(chip);
                wrap.appendChild(buildRemoveButton(name, () => {
                    mats.custom = mats.custom.filter(c => matKey(c.name) !== name);
                }, rerender));
                chips.appendChild(wrap);
            });
            picker.appendChild(chips);
        });

        // Add a material that isn't listed
        const form = el('form', 'bp-form mat-add-form');
        const addInput = document.createElement('input');
        addInput.type = 'text';
        addInput.maxLength = 40;
        addInput.className = 'text-input';
        addInput.placeholder = 'Material not listed? Type it here';
        const addRarity = buildRaritySelect();
        const addBtn = el('button', 'toggle-button small', 'Add & track');
        addBtn.type = 'submit';
        form.appendChild(addInput);
        form.appendChild(addRarity);
        form.appendChild(addBtn);
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const name = matKey(addInput.value);
            if (!name) {
                addInput.focus();
                return;
            }
            const listed = materialGroups.some(([, items]) => items.some(i => i.name === name));
            if (!listed) mats.custom.push({ name, rarity: addRarity.value || '' });
            if (!tracked.some(t => matKey(t.name) === name)) tracked.push({ name, have: 0, need: 0 });
            saveState();
            rerender();
            const next = rightPanel.querySelector('.mat-add-form input');
            if (next) next.focus();
        });
        picker.appendChild(form);
        matSection.appendChild(picker);
        rightPanel.appendChild(matSection);

        rightPanel.scrollTop = keepScroll;
    };

    // =========================
    // RIGHT PANEL: CHALLENGES (your own DMZ goals: money, counters, checklists)
    // =========================
    const CHALLENGE_TYPE_LABEL = { money: 'MONEY', count: 'COUNTER', list: 'CHECKLIST' };
    const challengeTemplates = dmzSettings.challengeTemplates || [];

    // "250k", "$1,500,000", "1.5m" -> number (NaN if it can't be read)
    const parseMoney = (str) => {
        const m = String(str).trim().toLowerCase().replace(/[$,\s]/g, '').match(/^(\d+(?:\.\d+)?)([km]?)$/);
        if (!m) return NaN;
        const mult = m[2] === 'k' ? 1e3 : m[2] === 'm' ? 1e6 : 1;
        return Math.round(parseFloat(m[1]) * mult);
    };
    const fmtMoney = (n) => `$${Math.round(n).toLocaleString('en-US')}`;
    const fmtMoneyShort = (n) => {
        if (n >= 1e6) return `$${+(n / 1e6).toFixed(2)}M`;
        if (n >= 1e3) return `$${+(n / 1e3).toFixed(1)}K`;
        return `$${n}`;
    };

    const challengeProgress = (c) => (c.type === 'list'
        ? { done: c.items.filter(i => i.done).length, total: c.items.length }
        : { done: c.current, total: c.target });
    const isChallengeDone = (c) => {
        const { done, total } = challengeProgress(c);
        return total > 0 && done >= total;
    };
    // Stamp the moment a challenge is finished (cleared again if it drops back under)
    const touchCompletion = (c) => {
        const done = isChallengeDone(c);
        if (done && !c.completedAt) c.completedAt = Date.now();
        if (!done) c.completedAt = 0;
    };

    const renderChallenges = () => {
        const keepScroll = rightPanel.scrollTop;
        rightPanel.innerHTML = '';
        const rerender = () => renderChallenges();
        const all = state.challenges;
        const commit = (c) => {
            touchCompletion(c);
            saveState();
            rerender();
        };

        // ----- Header + stats -----
        const header = el('div', 'right-panel-header');
        header.appendChild(el('h2', null, CHALLENGE_LABEL));
        header.appendChild(el('p', 'panel-subtitle', 'Set your own DMZ goals: cash to bank, compounds to loot, lieutenants to take out.'));
        rightPanel.appendChild(header);

        const active = all.filter(c => !isChallengeDone(c));
        const finished = all.filter(isChallengeDone).sort((a, b) => b.completedAt - a.completedAt);
        const statItems = [['In progress', `${active.length}`], ['Completed', `${finished.length}`]];
        const moneyGoals = active.filter(c => c.type === 'money');
        if (moneyGoals.length) {
            const cur = moneyGoals.reduce((s, c) => s + c.current, 0);
            const tgt = moneyGoals.reduce((s, c) => s + c.target, 0);
            statItems.push(['Cash goals in progress', `${fmtMoneyShort(cur)} / ${fmtMoneyShort(tgt)}`]);
        }
        rightPanel.appendChild(buildStatCards(statItems));

        // ----- Add form -----
        const form = el('form', 'bp-add-form chal-form');
        let formType = state.ui.challengeType;

        const typeRow = el('div', 'chal-form-row');
        const typeWrap = el('div', 'segmented');
        const typeBtns = {};
        CHALLENGE_TYPES.forEach(t => {
            const b = el('button', 'segment', CHALLENGE_TYPE_LABEL[t]);
            b.type = 'button';
            b.addEventListener('click', () => setType(t));
            typeBtns[t] = b;
            typeWrap.appendChild(b);
        });
        typeRow.appendChild(typeWrap);
        const typeHint = el('span', 'chal-type-hint');
        typeRow.appendChild(typeHint);
        form.appendChild(typeRow);

        const textInput = (placeholder, maxLength = 60) => {
            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'text-input';
            input.maxLength = maxLength;
            input.placeholder = placeholder;
            return input;
        };

        const mainRow = el('div', 'chal-form-row');
        const titleInput = textInput('Challenge name');
        mainRow.appendChild(titleInput);

        const moneyInput = textInput('Goal amount (e.g. 500k, 1.5m)', 20);
        moneyInput.classList.add('chal-short');
        const countInput = document.createElement('input');
        countInput.type = 'number';
        countInput.min = '1';
        countInput.className = 'text-input chal-short';
        countInput.placeholder = 'Target (e.g. 5)';
        const unitInput = textInput('Counting what? (e.g. compounds)', 30);
        unitInput.classList.add('chal-short');
        [moneyInput, countInput, unitInput].forEach(n => mainRow.appendChild(n));
        form.appendChild(mainRow);

        const itemsInput = el('textarea', 'text-input chal-items-input');
        itemsInput.rows = 3;
        itemsInput.placeholder = 'Things to check off, one per line (e.g. lieutenant names, compounds). You can add more later.';
        form.appendChild(itemsInput);

        const lastRow = el('div', 'chal-form-row');
        const noteInput = textInput('Note (optional): map, squad, reward...', 120);
        const addBtn = el('button', 'toggle-button small', 'Add challenge');
        addBtn.type = 'submit';
        lastRow.appendChild(noteInput);
        lastRow.appendChild(addBtn);
        form.appendChild(lastRow);

        const TYPE_HINTS = {
            money: 'A cash total to reach. Log what you extract with.',
            count: 'Count up to a number: compounds, extracts, contracts...',
            list: 'Specific things to check off: lieutenants, key rooms...'
        };
        const setType = (t) => {
            formType = t;
            state.ui.challengeType = t;
            saveState();
            Object.entries(typeBtns).forEach(([k, b]) => b.classList.toggle('active', k === t));
            moneyInput.hidden = t !== 'money';
            countInput.hidden = t !== 'count';
            unitInput.hidden = t !== 'count';
            itemsInput.hidden = t !== 'list';
            typeHint.textContent = TYPE_HINTS[t];
        };
        setType(formType);

        // Quick start templates (edit them in mw4-data.js -> challengeTemplates)
        if (challengeTemplates.length) {
            const tplRow = el('div', 'chal-templates');
            tplRow.appendChild(el('span', 'legend-title', 'Quick start:'));
            challengeTemplates.forEach(tpl => {
                if (!CHALLENGE_TYPES.includes(tpl.type)) return;
                const b = el('button', `chal-template chal-type-${tpl.type}`, tpl.title);
                b.type = 'button';
                b.title = `Fill in the form as a ${CHALLENGE_TYPE_LABEL[tpl.type].toLowerCase()} challenge`;
                b.addEventListener('click', () => {
                    setType(tpl.type);
                    titleInput.value = tpl.title;
                    moneyInput.value = tpl.type === 'money' && tpl.target ? fmtMoney(tpl.target) : '';
                    countInput.value = tpl.type === 'count' && tpl.target ? tpl.target : '';
                    unitInput.value = tpl.unit || '';
                    itemsInput.value = (tpl.items || []).join('\n');
                    (tpl.type === 'list' ? itemsInput : titleInput).focus();
                });
                tplRow.appendChild(b);
            });
            form.insertBefore(tplRow, form.firstChild);
        }

        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const title = titleInput.value.trim();
            if (!title) {
                titleInput.focus();
                return;
            }
            const c = {
                id: newId(), title, type: formType, target: 0, current: 0, unit: '', items: [],
                note: noteInput.value.trim(), createdAt: Date.now(), completedAt: 0
            };
            if (formType === 'money') {
                const amount = parseMoney(moneyInput.value);
                if (!(amount > 0)) {
                    window.alert('Enter a cash goal, like 500000, 500k, or 1.5m.');
                    moneyInput.focus();
                    return;
                }
                c.target = amount;
            } else if (formType === 'count') {
                const target = toCount(countInput.value);
                if (target < 1) {
                    window.alert('Enter how many you want to reach (1 or more).');
                    countInput.focus();
                    return;
                }
                c.target = target;
                c.unit = unitInput.value.trim();
            } else {
                c.items = itemsInput.value.split('\n').map(s => s.trim()).filter(Boolean).map(name => ({ name, done: false }));
            }
            state.challenges.push(c);
            saveState();
            rerender();
            const next = rightPanel.querySelector('.chal-form input[type="text"]');
            if (next) next.focus();
        });
        rightPanel.appendChild(form);

        // ----- Filter -----
        const filter = state.ui.challengeFilter;
        const filterRow = el('div', 'bp-filter-row');
        filterRow.appendChild(el('span', 'legend-title', 'Show:'));
        filterRow.appendChild(buildSegmented(
            [['all', 'ALL'], ['active', 'IN PROGRESS'], ['done', 'COMPLETED']],
            filter,
            (picked) => {
                state.ui.challengeFilter = picked;
                saveState();
                rerender();
            }
        ));
        rightPanel.appendChild(filterRow);

        // ----- One challenge card -----
        const buildCard = (c) => {
            const done = isChallengeDone(c);
            const { done: have, total } = challengeProgress(c);
            const pct = total ? Math.min(100, (have / total) * 100) : 0;
            const card = el('div', `chal-card chal-type-${c.type}${done ? ' done' : ''}`);

            const top = el('div', 'bp-card-top');
            const titleWrap = el('div', 'chal-title-wrap');
            titleWrap.appendChild(el('span', 'chal-type', CHALLENGE_TYPE_LABEL[c.type]));
            titleWrap.appendChild(el('span', 'chal-title', c.title));
            top.appendChild(titleWrap);
            top.appendChild(buildRemoveButton(c.title, () => {
                state.challenges.splice(state.challenges.indexOf(c), 1);
            }, rerender));
            card.appendChild(top);

            // Progress line
            let progressText;
            if (c.type === 'money') progressText = `${fmtMoney(c.current)} / ${fmtMoney(c.target)}`;
            else if (c.type === 'count') progressText = `${c.current} / ${c.target}${c.unit ? ` ${c.unit}` : ''}`;
            else progressText = total ? `${have} / ${total} checked off` : 'Add things to check off below';
            const progRow = el('div', 'chal-progress-row');
            progRow.appendChild(el('span', 'chal-progress-text', progressText));
            progRow.appendChild(el('span', 'chal-pct', done ? 'DONE' : `${Math.floor(pct)}%`));
            card.appendChild(progRow);
            const bar = el('div', 'chal-bar');
            const fill = el('div', 'chal-bar-fill');
            fill.style.width = `${pct}%`;
            bar.appendChild(fill);
            card.appendChild(bar);

            // Controls per type
            const controls = el('div', 'chal-controls');
            if (c.type === 'money') {
                const amountForm = el('form', 'chal-amount-form');
                const amount = textInput('Amount (e.g. 45k)', 20);
                amount.classList.add('chal-amount');
                const add = el('button', 'ghost-button', '+ Add');
                add.type = 'submit';
                add.title = 'Add this amount (e.g. what you extracted with)';
                const sub = el('button', 'ghost-button', '− Subtract');
                sub.type = 'button';
                const set = el('button', 'ghost-button', 'Set total');
                set.type = 'button';
                set.title = 'Replace the total with this amount';
                const apply = (how) => {
                    const n = parseMoney(amount.value);
                    if (!(n >= 0)) {
                        amount.focus();
                        return;
                    }
                    if (how === 'add') c.current += n;
                    else if (how === 'sub') c.current = Math.max(0, c.current - n);
                    else c.current = n;
                    commit(c);
                };
                amountForm.addEventListener('submit', (e) => {
                    e.preventDefault();
                    apply('add');
                });
                sub.addEventListener('click', () => apply('sub'));
                set.addEventListener('click', () => apply('set'));
                [amount, add, sub, set].forEach(n => amountForm.appendChild(n));
                controls.appendChild(amountForm);

                const quick = el('div', 'chal-quick');
                [10000, 50000, 100000, 250000].forEach(n => {
                    const b = el('button', 'chal-quick-btn', `+${fmtMoneyShort(n)}`);
                    b.type = 'button';
                    b.addEventListener('click', () => {
                        c.current += n;
                        commit(c);
                    });
                    quick.appendChild(b);
                });
                controls.appendChild(quick);
            } else if (c.type === 'count') {
                const minus = el('button', 'step-button', '−');
                minus.type = 'button';
                minus.title = 'One less (Shift: 5 less)';
                minus.disabled = c.current <= 0;
                const plus = el('button', 'step-button', '+');
                plus.type = 'button';
                plus.title = 'One more (Shift: 5 more)';
                const value = document.createElement('input');
                value.type = 'number';
                value.min = '0';
                value.className = 'text-input mat-num';
                value.value = c.current;
                value.setAttribute('aria-label', `${c.title} progress`);
                minus.addEventListener('click', (e) => {
                    c.current = Math.max(0, c.current - (e.shiftKey ? 5 : 1));
                    commit(c);
                });
                plus.addEventListener('click', (e) => {
                    c.current += e.shiftKey ? 5 : 1;
                    commit(c);
                });
                value.addEventListener('change', () => {
                    c.current = toCount(value.value);
                    commit(c);
                });
                const stepper = el('div', 'mat-counts');
                [minus, value, plus].forEach(n => stepper.appendChild(n));
                controls.appendChild(stepper);
                const goal = el('label', 'chal-goal');
                goal.appendChild(el('span', 'mat-count-label', 'GOAL'));
                const goalInput = document.createElement('input');
                goalInput.type = 'number';
                goalInput.min = '1';
                goalInput.className = 'text-input mat-num';
                goalInput.value = c.target;
                goalInput.addEventListener('change', () => {
                    c.target = Math.max(1, toCount(goalInput.value));
                    commit(c);
                });
                goal.appendChild(goalInput);
                controls.appendChild(goal);
            } else {
                const items = el('div', 'chal-items');
                c.items.forEach((item, i) => {
                    const row = el('div', `chal-item${item.done ? ' done' : ''}`);
                    const label = el('label', 'bp-claim');
                    const cb = document.createElement('input');
                    cb.type = 'checkbox';
                    cb.checked = item.done;
                    cb.addEventListener('change', () => {
                        item.done = cb.checked;
                        commit(c);
                    });
                    label.appendChild(cb);
                    label.appendChild(el('span', 'chal-item-name', item.name));
                    row.appendChild(label);
                    const rm = el('button', 'icon-button', '×');
                    rm.type = 'button';
                    rm.title = 'Remove from this list';
                    rm.addEventListener('click', () => {
                        c.items.splice(i, 1);
                        commit(c);
                    });
                    row.appendChild(rm);
                    items.appendChild(row);
                });
                controls.appendChild(items);

                const addItem = el('form', 'chal-amount-form');
                const itemInput = textInput('Add something to check off', 60);
                const itemBtn = el('button', 'ghost-button', '+ Add');
                itemBtn.type = 'submit';
                addItem.appendChild(itemInput);
                addItem.appendChild(itemBtn);
                addItem.addEventListener('submit', (e) => {
                    e.preventDefault();
                    const name = itemInput.value.trim();
                    if (!name) return;
                    c.items.push({ name, done: false });
                    commit(c);
                    const again = rightPanel.querySelector(`[data-chal="${c.id}"] .chal-items + .chal-amount-form input`);
                    if (again) again.focus();
                });
                controls.appendChild(addItem);
            }
            card.appendChild(controls);

            // Note (saves as you type)
            const note = textInput('Add a note...', 120);
            note.classList.add('chal-note');
            note.value = c.note;
            note.addEventListener('input', () => {
                c.note = note.value;
                saveState();
            });
            card.appendChild(note);

            // Finished: when, plus a restart for repeatable goals
            if (done) {
                const footer = el('div', 'chal-footer');
                const when = c.completedAt ? new Date(c.completedAt).toLocaleDateString() : '';
                footer.appendChild(el('span', 'chal-done-tag', `COMPLETED${when ? ` · ${when}` : ''}`));
                const restart = el('button', 'ghost-button', 'Restart');
                restart.type = 'button';
                restart.title = 'Reset progress to do it again (e.g. a weekly goal)';
                restart.addEventListener('click', () => {
                    if (!window.confirm(`Restart "${c.title}" from zero?`)) return;
                    c.current = 0;
                    c.items.forEach(item => { item.done = false; });
                    commit(c);
                });
                footer.appendChild(restart);
                card.appendChild(footer);
            }

            card.dataset.chal = c.id;
            return card;
        };

        const addSection = (title, list, emptyMsg) => {
            const heading = el('h3', 'camo-section recipe-heading', title);
            heading.appendChild(el('span', 'recipe-count', `${list.length}`));
            rightPanel.appendChild(heading);
            if (!list.length) {
                rightPanel.appendChild(el('p', 'bp-empty', emptyMsg));
                return;
            }
            const grid = el('div', 'chal-grid');
            list.forEach(c => grid.appendChild(buildCard(c)));
            rightPanel.appendChild(grid);
        };

        if (filter !== 'done') {
            addSection('IN PROGRESS', active, all.length
                ? 'Nothing in progress. Add a new challenge above.'
                : 'No challenges yet. Pick a quick start above or make your own.');
        }
        if (filter !== 'active') addSection('COMPLETED', finished, 'Nothing completed yet.');

        rightPanel.scrollTop = keepScroll;
    };

    function buildRemoveButton(name, removeFn, rerender) {
        const btn = el('button', 'icon-button', '×');
        btn.type = 'button';
        btn.title = 'Remove';
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!window.confirm(`Remove "${name}"?`)) return;
            removeFn();
            saveState();
            rerender();
        });
        return btn;
    }

    // =========================
    // RIGHT PANEL: DMZ WEAPON DETAIL
    // =========================
    const renderDmzDetail = (gunName) => {
        rightPanel.innerHTML = '';
        const refresh = () => {
            updateGunAndType(gunName);
            renderDmzDetail(gunName);
        };

        const backLabel = { blueprints: '← All blueprints', notes: '← Notes & materials' }[state.ui.dmzView] || '← All weapons';
        const back = el('button', 'ghost-button back-button', backLabel);
        back.addEventListener('click', () => {
            state.ui.dmzGun = null;
            saveState();
            render();
        });
        rightPanel.appendChild(back);

        const header = el('div', 'right-panel-header');
        header.appendChild(el('h2', null, gunName));
        header.appendChild(el('p', 'panel-subtitle', 'DMZ loadout'));
        rightPanel.appendChild(header);

        // ----- Manuals -----
        const dmz = peekDmz(gunName);
        const manuals = dmz.manuals || 0;
        const manualSection = el('div', `dmz-section ${getDmzStatus(gunName)}`);
        manualSection.appendChild(el('h3', 'camo-section', 'WEAPON MANUALS'));

        const manualRow = el('div', 'manual-row');
        manualRow.appendChild(buildManualPips(gunName, true, refresh));
        let statusText;
        if (manuals === 0) statusText = 'No manual extracted yet. Weapon is locked at the Gunsmith.';
        else if (manuals < dmzSettings.manualsForCamo) {
            const left = dmzSettings.manualsForCamo - manuals;
            statusText = `Unlocked at the Gunsmith. ${left} more manual${left === 1 ? '' : 's'} for ${dmzSettings.lootCamoName}.`;
        } else statusText = `Unlocked, and ${dmzSettings.lootCamoName} camo earned.`;
        manualRow.appendChild(el('p', 'manual-status', statusText));
        manualSection.appendChild(manualRow);
        rightPanel.appendChild(manualSection);

        // ----- Blueprints -----
        const bpSection = el('div', 'dmz-section');
        bpSection.appendChild(el('h3', 'camo-section', 'BLUEPRINTS OWNED'));
        bpSection.appendChild(el('p', 'camo-challenge', 'Your first craft of each blueprint at the FOB Gunsmith is free. Tick it once you have used it.'));

        const list = el('div', 'bp-list');
        (dmz.blueprints || []).forEach((bp, index) => {
            const row = el('div', `bp-row${bp.claimed ? ' claimed' : ''}${bp.rarity ? ` rarity-${bp.rarity}` : ''}`);

            const label = el('label', 'bp-claim');
            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.checked = Boolean(bp.claimed);
            cb.addEventListener('change', () => {
                getDmz(gunName).blueprints[index].claimed = cb.checked;
                saveState();
                refresh();
            });
            label.appendChild(cb);
            label.appendChild(el('span', 'bp-name', bp.name));
            row.appendChild(label);
            row.appendChild(buildRarityTag(bp.rarity, () => {
                getDmz(gunName).blueprints[index].rarity = nextRarity(bp.rarity);
                saveState();
                refresh();
            }));
            row.appendChild(el('span', 'bp-state', bp.claimed ? 'Free copy used' : 'Free copy available'));
            row.appendChild(buildRemoveButton(bp.name, () => {
                getDmz(gunName).blueprints.splice(index, 1);
            }, refresh));
            list.appendChild(row);
        });
        if (!(dmz.blueprints || []).length) list.appendChild(el('p', 'bp-empty', 'No blueprints added for this weapon yet.'));
        bpSection.appendChild(list);

        const form = el('form', 'bp-form');
        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = 'Blueprint name (e.g. Beta Forged)';
        input.maxLength = 60;
        input.className = 'text-input';
        const raritySelect = buildRaritySelect();
        const add = el('button', 'toggle-button small', 'Add');
        add.type = 'submit';
        form.appendChild(input);
        form.appendChild(raritySelect);
        form.appendChild(add);
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const name = input.value.trim();
            if (!name) return;
            getDmz(gunName).blueprints.push({ name: name.toUpperCase(), claimed: false, rarity: raritySelect.value || '' });
            saveState();
            refresh();
            const nextInput = rightPanel.querySelector('.bp-form .text-input');
            if (nextInput) nextInput.focus();
        });
        bpSection.appendChild(form);
        rightPanel.appendChild(bpSection);
    };

    // =========================
    // RIGHT PANEL: STATS
    // =========================
    const renderStatsPanel = () => {
        rightPanel.innerHTML = '';

        const header = el('div', 'right-panel-header');
        header.appendChild(el('h2', null, 'STATS'));
        header.appendChild(el('p', 'panel-subtitle', 'Progress across every mode'));
        rightPanel.appendChild(header);

        // Overall per mode
        const items = modeOrder.map(mode => {
            let done = 0;
            let total = 0;
            allGuns.forEach(g => {
                total += getEntries(mode, g).length;
                done += getDoneCount(mode, g);
            });
            const pct = total ? ((done / total) * 100).toFixed(1) : '0.0';
            return [`${modeLabels[mode]} · ${done}/${total}`, `${pct}%`];
        });
        const dmzUnlocked = allGuns.filter(g => getDmzStatus(g) !== 'dmz-locked').length;
        items.push(['DMZ weapons unlocked', `${dmzUnlocked}/${allGuns.length}`]);
        rightPanel.appendChild(buildStatCards(items));

        // Tier breakdown by weapon class (for the mode the left list is showing)
        const statMode = isCamoMode() ? state.ui.mode : 'track';
        const tierOrder = getTierOrder(statMode, allGuns[0]);

        const tierSection = el('div', 'stats-section');
        tierSection.appendChild(el('h3', 'camo-section', `${modeLabels[statMode]}: weapons at each milestone`));
        const tierTable = el('table', 'stats-table');
        const thead = el('thead');
        const headRow = el('tr');
        headRow.appendChild(el('th', null, 'Class'));
        tierOrder.forEach(t => headRow.appendChild(el('th', null, getTierName(statMode, t))));
        thead.appendChild(headRow);
        tierTable.appendChild(thead);

        const tbody = el('tbody');
        const addTierRow = (label, guns, className) => {
            const row = el('tr', className);
            row.appendChild(el('td', null, label));
            tierOrder.forEach((t, rank) => {
                const count = guns.filter(g => getGunTier(statMode, g).rank >= rank).length;
                row.appendChild(el('td', null, `${count}/${guns.length}`));
            });
            tbody.appendChild(row);
        };
        gunTypeArray.forEach((type, i) => {
            if (gunsArray[i].length) addTierRow(type, gunsArray[i]);
        });
        addTierRow('ALL WEAPONS', allGuns, 'total-row');
        tierTable.appendChild(tbody);
        tierSection.appendChild(tierTable);
        rightPanel.appendChild(tierSection);

        // Per-camo completion (by camo slot, across all guns)
        const perCamo = el('div', 'stats-section');
        perCamo.appendChild(el('h3', 'camo-section', `${modeLabels[statMode]}: per camo across all weapons`));
        const camoTable = el('table', 'stats-table');
        const ch = el('thead');
        const chRow = el('tr');
        ['Camo', 'Weapons done', 'Completion'].forEach(h => chRow.appendChild(el('th', null, h)));
        ch.appendChild(chRow);
        camoTable.appendChild(ch);
        const cb = el('tbody');
        const slotCount = {};
        getEntries(statMode, allGuns[0]).forEach(({ camo, key }) => {
            const doneGuns = allGuns.filter(g => isChecked(statMode, g, key)).length;
            const row = el('tr');
            // Military/Special names vary by gun, so label those by slot
            let label = camo.name;
            if (camo.section === 'MILITARY' || camo.section === 'SPECIAL') {
                slotCount[camo.section] = (slotCount[camo.section] || 0) + 1;
                label = `${camo.section} ${slotCount[camo.section]}`;
            }
            row.appendChild(el('td', null, label));
            row.appendChild(el('td', null, `${doneGuns}/${allGuns.length}`));
            row.appendChild(el('td', null, `${allGuns.length ? ((doneGuns / allGuns.length) * 100).toFixed(1) : '0.0'}%`));
            cb.appendChild(row);
        });
        camoTable.appendChild(cb);
        perCamo.appendChild(camoTable);
        rightPanel.appendChild(perCamo);
    };

    // =========================
    // SELECTION + RENDER
    // =========================
    const selectGun = (gunName) => {
        // Switching guns on a camo tab keeps the same scroll spot, so you can flip between
        // guns and compare the same section without scrolling back down each time.
        const keepScroll = state.ui.view === 'detail' && isCamoMode();
        // Clicking a gun in the sidebar from Stats (opened from Challenges) goes to its camos
        if (!isCamoMode() && state.ui.mode !== LOADOUT_MODE) state.ui.mode = modeOrder[0];
        state.ui.view = 'detail';
        if (state.ui.mode === LOADOUT_MODE) state.ui.dmzGun = gunName;
        else state.ui.gun = gunName;
        saveState();
        render({ keepScroll });
    };

    const leftPanel = document.querySelector('.left-panel');

    const render = ({ keepScroll = false } = {}) => {
        const scrollBefore = rightPanel.scrollTop;
        // The DMZ Loadout tab has its own weapon cards, so the weapons sidebar is hidden there.
        leftPanel.hidden = state.ui.view === 'detail' && [LOADOUT_MODE, CHALLENGE_MODE].includes(state.ui.mode);
        updateTabs();
        renderLegend();
        updateAllColors();
        updateSelectedHighlight();

        if (state.ui.view === 'stats') {
            renderStatsPanel();
        } else if (state.ui.mode === CHALLENGE_MODE) {
            renderChallenges();
        } else if (state.ui.mode === LOADOUT_MODE) {
            if (state.ui.dmzGun) renderDmzDetail(state.ui.dmzGun);
            else if (state.ui.dmzView === 'blueprints') renderBlueprintsView();
            else if (state.ui.dmzView === 'notes') renderNotesView();
            else renderDmzOverview();
        } else {
            if (!state.ui.gun) state.ui.gun = allGuns[0] || null;
            renderCamoPanel(state.ui.gun);
        }
        rightPanel.scrollTop = keepScroll ? scrollBefore : 0;
    };

    // =========================
    // INITIALIZE
    // =========================
    buildLeftPanel();
    buildTabs();
    render();
});
