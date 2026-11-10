// =========================
// MW4 TRACKER DATA
// =========================
// Edit this file to add/rename weapons, rename camos, or fill in challenge text.
// The app logic lives in script.js and reads everything from window.MW4_TRACKER_DATA.
//
// HOW CAMO COLORS WORK
// Any camo with a `tier` key is a color milestone. When every camo up to and
// including that one is checked (in order), the gun in the left list turns that
// tier's color. A gun type header takes the LOWEST tier reached by all of its
// guns, so it only lights up once every gun in the class hits Gold (or higher).
// Tier colors are defined in styles.css under "TIER COLORS".

const gunTypes = [
    "ASSAULT RIFLES",
    "SMGS",
    "SHOTGUNS",
    "LMGS",
    "MARKSMAN RIFLES",
    "SNIPER RIFLES",
    "PISTOLS",
    "LAUNCHERS",
    "MELEE"
];

// VERIFY against your in-game list. MW4 launched with 33 weapons; this list has
// 37 names, so a few are probably seasonal / post-launch. Delete or rename freely.
// Progress is saved by weapon name, so renaming a gun resets that gun's checkboxes.
const weaponsByType = {
    "ASSAULT RIFLES": ["HAN 86", "M4", "KASTOV 762", "AXION", "CRONEN SQUALL", "CRONEN OSPREY", "PATRIOT XMR", "ODEN", "HYEON BURST"],
    "SMGS": ["WZ.55 STRIGA", "X-58 NYX", "CSG-35", "ISO NIGHTSHADE", "PPSH-41", "VEL 46"],
    "SHOTGUNS": ["REZI-12", "JAK 12", "WARLORD"],
    "LMGS": ["FINN LMG", "TYPE 73", "APOC-338"],
    "MARKSMAN RIFLES": ["MAR-9", "ORIS 8.6", "MOSIN-NAGANT"],
    "SNIPER RIFLES": ["SIGNAL 50", "KG-7 VULCAN", "ASTAROTH .57"],
    "PISTOLS": ["SANG 9MM", "KRAIT P68", ".50 GS", "MOJAVE .357"],
    "LAUNCHERS": ["RPG-8", "PILA", "JOKR", "PM-40 ANVIL"],
    "MELEE": ["FSS CARBON EDGE 1095", "ZLR TALONHAWK"]
};

// =========================
// MODES (tabs, in display order)
// =========================
// track    = the camo track every gun has (Military -> Special -> Gold ... Divergence)
// prestige = Weapon Prestige camos
// mp/dmz/wz = mode-specific Mastery camos
const modeOrder = ["track", "prestige", "mp", "dmz", "wz"];

const modeLabels = {
    track: "CAMO TRACK",
    prestige: "PRESTIGE",
    mp: "MP MASTERY",
    dmz: "DMZ MASTERY",
    wz: "WARZONE MASTERY"
};

// Views for the per-gun toggle on the Camo Track tab.
const trackViews = {
    mp: "MULTIPLAYER",
    dmz: "DMZ"
};

// =========================
// CAMO TRACK (MP + DMZ)
// =========================
// Every camo has:
//   id        - what progress is saved under (don't change once you've started tracking)
//   modes     - which toggle views show it: ["mp"], ["dmz"], or ["mp", "dmz"]
//   challenge - { mp: "...", dmz: "..." } text for each view
//   unlock    - optional small note about when the challenge opens
//
// A camo listed in BOTH modes is the same camo: check it in either view and it
// shows as done in both. Military, Special, and Gold..Divergence can all be earned
// in MP or DMZ, so they're all shared. The two views differ only in challenge text.
//
// Challenge text sources: Infinity Ward's MW4 progression blog (Han 86 example),
// Destructoid / codmunity / ConquestCapped camo guides (launch week, Oct 2026).
// Anything marked "(verify)" looked like a typo in the source - check it in game.

// Shorthand: both views get a "Get ..." sentence.
const ch = (mp, dmz) => ({ mp: `Get ${mp}`, dmz: `Get ${dmz}` });

// ---- MILITARY ----
// Military camos unlock by levelling the weapon (no kill challenge).
// Exact levels are only published for a few guns so far; the rest show a generic line.
// 0 = level not known yet (that camo shows the generic "level up this weapon" line).
//
// GAME ONLY SHOWS A COUNTDOWN? ("Earn 22 more weapon unlocks using the ...")
// That number counts from the gun's CURRENT weapon level, so:
//     unlock level = current weapon level + the number shown
// Instead of doing the math, use fromRemaining(currentLevel, [8 countdown numbers]).
// Put 0 for any camo with no countdown (already unlocked, or you didn't check it).
//     "FINN LMG": fromRemaining(31, [0, 0, 0, 0, 6, 11, 17, 22]),
// This works best when the gun is at a low level, before any camos have unlocked.
const fromRemaining = (currentLevel, remaining) =>
    remaining.map(n => (n ? currentLevel + n : 0));

const militaryLevels = {
    // ASSAULT RIFLES
    "HAN 86":               [10, 18, 25, 34, 42, 50, 57, 65],
    "M4":                   [9, 17, 25, 34, 43, 50, 58, 63],
    "KASTOV 762":           [9, 16, 25, 32, 39, 48, 56, 63],
    "AXION":                [9, 18, 25, 33, 40, 47, 54, 61],
    "CRONEN SQUALL":        [9, 16, 23, 30, 38, 44, 53, 59],
    "CRONEN OSPREY":        [0, 0, 0, 0, 0, 0, 0, 0],
    "PATRIOT XMR":          [11, 19, 27, 35, 42, 51, 58, 65],
    "ODEN":                 [12, 21, 25, 33, 39, 46, 53, 59],
    "HYEON BURST":          [9, 16, 25, 31, 39, 45, 54, 61],
    // SMGS
    "WZ.55 STRIGA":         [6, 11, 13, 16, 19, 22, 25, 28],
    "X-58 NYX":             [8, 14, 19, 1, 3, 5, 28, 10],
    "CSG-35":               [0, 0, 0, 0, 0, 0, 0, 0],
    "ISO NIGHTSHADE":       [12, 19, 25, 31, 38, 44, 50, 57],
    "PPSH-41":              [0, 0, 0, 0, 0, 0, 0, 0],
    "VEL 46":               [0, 0, 0, 0, 0, 0, 0, 0],
    // SHOTGUNS
    "REZI-12":              [11, 18, 26, 30, 38, 42, 47, 54],
    "JAK 12":               [0, 0, 0, 0, 0, 0, 0, 0],
    "WARLORD":              [0, 0, 0, 0, 0, 0, 0, 0],
    // LMGS
    "FINN LMG":             [12, 18, 24, 31, 37, 42, 48, 53],
    "TYPE 73":              [0, 0, 0, 0, 0, 0, 0, 0],
    "APOC-338":             [0, 0, 0, 0, 0, 0, 0, 0],
    // MARKSMAN RIFLES
    "MAR-9":                [10, 19, 29, 38, 45, 52, 58, 69],
    "ORIS 8.6":             [0, 0, 0, 0, 0, 0, 0, 0],
    "MOSIN-NAGANT":         [0, 0, 0, 0, 0, 0, 0, 0],
    // SNIPER RIFLES
    "SIGNAL 50":            [0, 0, 0, 0, 0, 0, 0, 0],
    "KG-7 VULCAN":          [13, 22, 31, 38, 47, 54, 61, 69],
    "ASTAROTH .57":         [0, 0, 0, 0, 0, 0, 0, 0],
    // PISTOLS
    "SANG 9MM":             [9, 13, 17, 21, 25, 28, 31, 35],
    "KRAIT P68":            [0, 0, 0, 0, 0, 0, 0, 0],
    ".50 GS":               [0, 0, 0, 0, 0, 0, 0, 0],
    "MOJAVE .357":          [0, 0, 0, 0, 0, 0, 0, 0],
    // LAUNCHERS
    "RPG-8":                [0, 0, 0, 0, 0, 0, 0, 0],
    "PILA":                 [0, 0, 0, 0, 0, 0, 0, 0],
    "JOKR":                 [0, 0, 0, 0, 0, 0, 0, 0],
    "PM-40 ANVIL":          [0, 0, 0, 0, 0, 0, 0, 0],
    // MELEE
    "FSS CARBON EDGE 1095": [0, 0, 0, 0, 0, 0, 0, 0],
    "ZLR TALONHAWK":        [0, 0, 0, 0, 0, 0, 0, 0]
};

const buildMilitary = (gun) => Array.from({ length: 8 }, (_, i) => {
    const level = (militaryLevels[gun] || [])[i];
    const text = level ? `Reach weapon level ${level}` : "Earn weapon unlocks (level up this weapon)";
    return {
        id: `mil${i + 1}`,
        name: `MILITARY ${i + 1}`,
        modes: ["mp", "dmz"],
        challenge: { mp: text, dmz: text },
        section: "MILITARY"
    };
});

// ---- SPECIAL ----
// Three weapon-specific camos per gun, in in-game order.
// [name, challenge, optional unlock note]
const specialCamos = {
    // ASSAULT RIFLES
    "HAN 86": [
        ["SMOKE", ch("20 mounted player kills", "75 mounted enemy kills"), "Opens at weapon level 25"],
        ["STORMWAVE", ch("50 player kills while using a suppressor", "125 enemy kills while using a suppressor"), "Opens at weapon level 46"],
        ["RED", ch("3 player kills without dying 15 times", "3 enemy kills without taking damage 50 times"), "Opens at weapon level 72"]
    ],
    "M4": [
        ["MYRIAD", ch("20 point blank kills", "75 point blank kills")],
        ["NIGHT OPS", ch("20 mounted kills", "75 mounted kills")],
        ["GREEN", ch("25 kills from behind", "100 kills from behind")]
    ],
    "KASTOV 762": [
        ["SAMNIM", ch("3 kills without dying 10 times", "5 kills without taking damage 25 times")],
        ["RASTER AUX", ch("20 longshot kills", "75 longshot kills")],
        ["YELLOW", ch("30 hipfire kills", "100 hipfire kills")]
    ],
    "AXION": [
        ["SPLINTER ROCK", ch("20 longshot kills", "75 longshot kills")],
        ["SUNSET TROPIC", ch("25 kills with the Miri 40mm Grenade Launcher", "75 kills with the Miri 40mm Grenade Launcher")],
        ["CYAN", ch("2 kills without reloading 25 times", "2 kills without reloading 50 times")]
    ],
    "CRONEN SQUALL": [
        ["ONI", ch("20 point blank kills", "75 point blank kills")],
        ["URBAN SMOKE", ch("20 mounted kills", "75 mounted kills")],
        ["OPTICAL REVERB", ch("3 kills without dying 15 times", "Get 3 enemy kills without taking damage 50 times")]
    ],
    "PATRIOT XMR": [
        ["DUNE SEA", ch("20 hipfire kills", "75 hipfire kills")],
        ["SCORCH", ch("50 kills while using a suppressor", "125 kills while using a suppressor")],
        ["DISPERSE", ch("30 longshot kills", "100 longshot kills")]
    ],
    "ODEN": [
        ["DARK MOSS", ch("25 kills with the Miri 40mm Grenade Launcher", "75 kills with the Miri 40mm Grenade Launcher")],
        ["SHALE", ch("2 kills without reloading 10 times", "2 kills without reloading 30 times")],
        ["HOT ROD", ch("100 kills while ADS", "250 kills while ADS")]
    ],
    "HYEON BURST": [
        ["PONDEROSA", ch("2 kills without reloading 10 times", "2 kills without reloading 30 times")],
        ["RED RAIN", ch("20 longshot kills", "75 longshot kills")],
        ["KITTY KAOS", ch("100 kills while using a suppressor", "250 kills while using a suppressor")]
    ],
    // SMGS
    "WZ.55 STRIGA": [
        ["STELLATION", ch("50 kills while using a suppressor", "125 kills while using a suppressor")],
        ["RATTLESNAKE", ch("20 kills while jumping", "50 kills while jumping")],
        ["DARK TAN", ch("40 point blank kills", "100 point blank kills")]
    ],
    "X-58 NYX": [
        ["SNIPER VEIL", ch("20 kills while moving", "75 kills while moving")],
        ["CARBONATED", ch("20 longshot kills", "75 longshot kills")],
        ["LIME", ch("40 headshot kills", "100 headshot kills")]
    ],
    "ISO NIGHTSHADE": [
        ["ASPHALT", ch("50 kills while ADS", "125 kills while ADS")],
        ["BLACK TOPO", ch("10 double kills", "30 double kills")],
        ["BROWN", ch("3 kills without dying 15 times", "3 kills without taking damage 50 times")]
    ],
    "PPSH-41": [
        ["BLACKWELL", ch("10 double kills", "30 double kills")],
        ["IRON", ch("20 longshot kills", "75 longshot kills")],
        ["CURRENTS", ch("100 kills while ADS", "250 kills while ADS")]
    ],
    "VEL 46": [
        ["JUNGLE SHADOW", ch("50 kills while ADS", "125 kills while ADS")],
        ["GHAST", ch("20 kills while prone", "100 kills while prone")],
        ["GUNMETAL", ch("20 headshots", "75 headshots")]
    ],
    // SHOTGUNS
    "REZI-12": [
        ["STRUCK OIL", ch("20 point blank kills", "75 point blank kills")],
        ["BRUSH STROKE", ch("10 longshot kills", "50 longshot kills")],
        ["WHITE PINE", ch("40 kills while jumping", "100 kills while jumping")]
    ],
    "WARLORD": [
        ["REDSHIFT", ch("20 kills while moving", "75 kills while moving")],
        ["CORRUPTED CLAY", ch("10 double kills", "30 double kills")],
        ["MAGMA IRE", ch("50 kills while prone", "125 kills while prone")]
    ],
    // LMGS
    "FINN LMG": [
        ["DESERT TACTICS", ch("20 point blank kills", "75 point blank kills")],
        ["GREEN TIGER", ch("2 kills without reloading 10 times", "2 kills without reloading 30 times")],
        ["THUNDERHEAD", ch("30 longshot kills", "100 longshot kills")]
    ],
    "TYPE 73": [
        ["OUTCROP", ch("10 double kills", "30 double kills")],
        ["FOXTRAIL", ch("40 headshots", "100 headshots")],
        ["ASH PINE", ch("20 mounted kills", "75 mounted kills")]
    ],
    "APOC-338": [
        ["PHANTOM FLUX", ch("20 hipfire kills", "75 hipfire kills")],
        ["MINERAL", ch("20 longshot kills", "75 longshot kills")],
        ["TIGER SWIPE", ch("100 kills while prone", "250 kills while prone")]
    ],
    // MARKSMAN RIFLES
    "MAR-9": [
        ["MANGROVE", ch("20 mounted kills", "75 mounted kills")],
        ["FUNGAL GRID", ch("25 kills while crouched", "75 kills while crouched")],
        ["WHITE", ch("30 longshot kills", "100 longshot kills")]
    ],
    "ORIS 8.6": [
        ["HIBISCUS", ch("10 quickscope kills", "50 quickscope kills")],
        ["FIRE TOPO", ch("20 double kills", "50 double kills")],
        ["DEEP SPACE", ch("3 kills without dying 15 times", "3 kills without taking damage 50 times")]
    ],
    "MOSIN-NAGANT": [
        ["ICE SHEER", ch("25 headshots", "75 headshots")],
        ["FRACTAL SNOW", ch("2 kills without reloading 10 times", "2 kills without reloading 30 times")],
        ["STICKER SHOCK", ch("100 kills while focused", "250 kills while focused")]
    ],
    // SNIPER RIFLES
    "SIGNAL 50": [
        ["ANACONDA", ch("2 kills within 5 seconds 10 times", "2 kills within 5 seconds 25 times")],
        ["RIPPLEWAVE", ch("20 quickscope kills", "30 quickscope kills")],
        ["SUNBURN", ch("40 longshot kills", "100 longshot kills")]
    ],
    "KG-7 VULCAN": [
        ["TREELINE", ch("10 hipfire kills", "25 hipfire kills")],
        ["SPIDERSILK", ch("20 headshots", "75 headshots")],
        ["TENSION", ch("2 kills without taking damage 20 times", "2 kills without taking damage 30 times")]
    ],
    "ASTAROTH .57": [
        ["DRY BRUSH", ch("3 kills without dying 10 times", "3 kills without taking damage 25 times")],
        ["BACKCOUNTRY", ch("20 mounted kills", "75 mounted kills")],
        ["DREAD PLAGUE", ch("2 kills within 5 seconds 20 times", "2 kills within 5 seconds 50 times")]
    ],
    // PISTOLS
    "SANG 9MM": [
        ["AUTUMN", ch("25 kills while ADS", "75 kills while ADS")],
        ["SNAKESKIN", ch("3 kills without dying 5 times", "3 kills without taking damage 15 times")],
        ["SPACE TIME", ch("50 kills while using akimbo", "125 kills while using akimbo")]
    ],
    "KRAIT P68": [
        ["OFF GRID", ch("15 kills while ledge hanging", "50 kills while ledge hanging")],
        ["URBAN FLAMINGO", ch("15 point blank kills", "50 point blank kills")],
        ["SMOKESCREEN", ch("50 kills while using a suppressor", "125 kills while using a suppressor")]
    ],
    ".50 GS": [
        ["FROSTED", ch("20 headshot kills", "75 headshot kills")],
        ["SPLATTER OPS", ch("7 double kills", "20 double kills")],
        ["RED TIGER", ch("30 point blank kills", "75 point blank kills")]
    ],
    "MOJAVE .357": [
        ["MIAMI", ch("15 one shot kills", "50 one shot kills")],
        ["WALLPAPER", ch("2 kills without reloading 10 times", "2 kills without reloading 20 times")],
        ["GARLAND", ch("30 point blank kills", "75 point blank kills")]
    ],
    // LAUNCHERS
    "RPG-8": [
        ["DIGI BARK", ch("10 kills while prone", "25 kills while prone")],
        ["STONE BITS", ch("10 longshot kills", "25 longshot kills")],
        ["BUBBLEGUM OPS", { mp: "Destroy 30 killstreaks or vehicles", dmz: "Destroy 50 killstreaks or vehicles" }]
    ],
    "PILA": [
        ["FRONTIER", ch("10 direct shot kills", "25 direct shot kills")],
        ["SANDWASH", ch("5 double kills", "100 double kills")],
        ["DIGITAL FALL", { mp: "Destroy 30 killstreaks or vehicles", dmz: "Destroy 50 killstreaks or vehicles" }]
    ],
    "JOKR": [
        ["THICKET", ch("5 double kills", "15 double kills")],
        ["TECTONIC", ch("10 longshot kills", "25 longshot kills")],
        ["BLUE TIGER", { mp: "Destroy 30 killstreaks or vehicles", dmz: "Destroy 50 killstreaks or vehicles" }]
    ],
    "PM-40 ANVIL": [
        ["NIGHT SNOW", ch("25 direct shot kills", "25 direct shot kills")],
        ["RECURSIVE", ch("2 kills without reloading 5 times", "2 kills without reloading 20 times")],
        ["URBAN STANDARD", ch("40 kills while moving", "100 kills while moving")]
    ],
    // MELEE
    "FSS CARBON EDGE 1095": [
        ["RASTER LITE", ch("25 kills while jumping", "100 kills while jumping")],
        ["STOCKPILE", ch("25 kills with a heavy melee finisher", "75 kills with a heavy melee finisher")],
        ["DEATHBED", ch("2 kills within 5 seconds 25 times", "2 kills within 5 seconds 50 times")]
    ]
};

const buildSpecial = (gun) => Array.from({ length: 3 }, (_, i) => {
    const [name, challenge, unlock] = (specialCamos[gun] || [])[i] || [];
    return {
        id: `sp${i + 1}`,
        name: name || `SPECIAL ${i + 1}`,
        modes: ["mp", "dmz"],
        challenge: challenge || { mp: "", dmz: "" },
        unlock: unlock || (name ? "" : "Not published yet for this weapon"),
        section: "SPECIAL"
    };
});

// ---- COMPLETIONIST (Gold -> Platinum -> Harmonic Break -> Divergence) ----
// Gold is the same for every gun (launchers need fewer in DMZ).
// Platinum and Harmonic Break depend on the weapon class.
const classLabels = {
    "ASSAULT RIFLES": "Assault Rifle",
    "SMGS": "SMG",
    "SHOTGUNS": "Shotgun",
    "LMGS": "LMG",
    "MARKSMAN RIFLES": "Marksman Rifle",
    "SNIPER RIFLES": "Sniper Rifle",
    "PISTOLS": "Pistol",
    "LAUNCHERS": "Launcher",
    "MELEE": "Melee"
};

const classChallenges = {
    "ASSAULT RIFLES": {
        platinum: ch("50 headshots against players", "100 headshots against enemies"),
        harmonic: ch("25 double kills against players", "50 double kills against enemies")
    },
    "SMGS": {
        platinum: ch("25 player kills from behind", "75 enemy kills from behind"),
        harmonic: ch("50 hipfire kills against players", "100 hipfire kills against enemies")
    },
    "SHOTGUNS": {
        platinum: ch("50 hipfire kills against players", "125 hipfire kills against enemies"),
        harmonic: ch("2 player kills without reloading 25 times", "2 enemy kills without reloading 50 times")
    },
    "LMGS": {
        platinum: ch("3 player kills without dying 15 times", "3 enemy kills without taking damage 50 times"),
        harmonic: ch("2 player kills without releasing the trigger 25 times", "2 enemy kills without releasing the trigger 75 times")
    },
    "MARKSMAN RIFLES": {
        platinum: ch("75 player kills while prone", "150 enemy kills while prone"),
        harmonic: ch("75 one shot kills against players", "150 one shot kills against enemies")
    },
    "SNIPER RIFLES": {
        platinum: ch("75 player kills while prone", "150 enemy kills while prone"),
        harmonic: ch("75 one shot kills against players", "150 one shot kills against enemies")
    },
    "PISTOLS": {
        platinum: ch("20 player kills from behind", "75 enemy kills from behind"),
        harmonic: ch("40 hipfire kills against players", "100 hipfire kills against enemies")
    },
    "LAUNCHERS": {
        platinum: ch("2 player kills without taking damage 15 times", "2 enemy kills without taking damage 50 times"),
        harmonic: ch("10 player kills in a single match 7 times", "10 enemy kills in a single match 15 times")
    },
    "MELEE": {
        platinum: ch("3 player kills without dying 15 times", "3 enemy kills without taking damage 50 times"),
        harmonic: ch("25 player kills from behind", "75 enemy kills from behind")
    }
};

const buildCompletionist = (type) => {
    const label = classLabels[type] || "class";
    const c = classChallenges[type] || {};
    const empty = { mp: "", dmz: "" };
    const divergence = `Complete the Harmonic Break challenge on every ${label} weapon`;
    return [
        {
            id: "gold", name: "GOLD", tier: "gold",
            challenge: ch("15 player kills in a single match",
                type === "LAUNCHERS" ? "50 enemy kills in a single DMZ match" : "100 enemy kills in a single DMZ match"),
            unlock: "Opens after all 8 Military and 3 Special camos on this weapon"
        },
        {
            id: "platinum", name: "PLATINUM", tier: "platinum",
            challenge: c.platinum || empty,
            unlock: `Opens after Gold on every ${label} weapon`
        },
        {
            id: "harmonic", name: "HARMONIC BREAK", tier: "harmonic",
            challenge: c.harmonic || empty,
            unlock: "Opens after Platinum"
        },
        {
            id: "divergence", name: "DIVERGENCE", tier: "divergence",
            challenge: { mp: divergence, dmz: divergence },
            unlock: "Opens after Harmonic Break"
        }
    ].map(camo => ({ ...camo, modes: ["mp", "dmz"], section: "COMPLETIONIST" }));
};

const buildTrack = (gun, type) => [
    ...buildMilitary(gun),
    ...buildSpecial(gun),
    ...buildCompletionist(type)
];

// =========================
// MASTERY + PRESTIGE CAMOS
// =========================
const modeCamos = {
    mp: [
        { name: "MERCURIAL DRIFT", challenge: "", tier: "m1" },
        { name: "POLYATOMIC REFORGED", challenge: "", tier: "m2" },
        { name: "ORION REFORGED", challenge: "", tier: "m3" }
    ],
    dmz: [
        { name: "CHIRAL", challenge: "", tier: "m1" },
        { name: "RIPPLE TIDE", challenge: "", tier: "m2" },
        { name: "HELIO", challenge: "", tier: "m3" }
    ],
    wz: [
        // Parallax placement in Warzone is a best guess; swap if the in-game order differs.
        { name: "PARALLAX", challenge: "", tier: "m1" },
        { name: "DAMASCUS REFORGED", challenge: "", tier: "m2" },
        { name: "EMPYROS", challenge: "", tier: "m3" }
    ],
    prestige: [
        { name: "PYROCLAST", challenge: "", tier: "p1" },
        { name: "PYROCLAST TERMINUS", challenge: "", tier: "p2" },
        { name: "PYROCLAST SCATTER", challenge: "", tier: "p3" },
        { name: "PYROCLAST CASCADE", challenge: "", tier: "p4" }
    ]
};

// =========================
// DMZ LOADOUT SETTINGS
// =========================
const dmzSettings = {
    // DMZ "War Spoils" camo: extract 3 Weapon Manuals for a weapon while that weapon
    // is equipped. Available since launch (not a seasonal camo).
    manualsForCamo: 3,
    lootCamoName: "WAR SPOILS",

    // Sections on the Blueprints page, matching the in-game 3D Printer menu.
    // Add, rename, or reorder freely. Entries saved under a category that's no longer
    // listed still show at the bottom of the page so nothing gets lost.
    recipeCategories: [
        "CONSUMABLES",
        "PLATE CARRIERS",
        "BACKPACKS",
        "TACTICALS",
        "LETHALS",
        "FIELD UPGRADES",
        "FIRE SUPPORT",
        "GEAR"
    ],

    // Starter recipes from your 3D Printer screenshots (Nov 2026). Each is added to the
    // checklist once. obtained: true = unlocked in game (no lock icon). rarity comes from
    // the colored strip on the item icon: common / uncommon / rare / epic / legendary / ultra.
    // Add more here any time: new entries are added the next time you open the app.
    // Deleting one in the app keeps it deleted.
    // Bump catalogVersion after editing rarity/obtained on items already in your list:
    // the app then fills in missing rarities and marks newly-obtained items (it never
    // un-checks anything or overwrites a rarity you set yourself).
    catalogVersion: 2,
    recipeCatalog: {
        "CONSUMABLES": [
            { name: "Energy Drink", rarity: "common", obtained: true },
            { name: "Bandage", rarity: "uncommon", obtained: true },
            { name: "Sedative Inhaler", rarity: "uncommon", obtained: true },
            { name: "Radiation Blockers", rarity: "rare", obtained: true },
            { name: "Medkit", rarity: "epic", obtained: true },
            { name: "Self-Revive Kit", rarity: "legendary", obtained: true },
            { name: "Pain Killers", rarity: "uncommon" },
            { name: "Smelling Salts", rarity: "rare" },
            { name: "Door Breacher Charge", rarity: "ultra" }
        ],
        "PLATE CARRIERS": [
            { name: "1-Plate Armor Vest", rarity: "uncommon", obtained: true },
            { name: "2-Plate Armor Vest", rarity: "rare", obtained: true },
            { name: "2-Plate Ballistic Gel Vest", rarity: "epic", obtained: true },
            { name: "2-Plate Helmet Armor Vest", rarity: "epic", obtained: true },
            { name: "3-Plate Ballistic Gel Vest", rarity: "ultra", obtained: true },
            { name: "Tempered Armor Vest", rarity: "ultra", obtained: true },
            { name: "3-Plate Armor Vest", rarity: "legendary" },
            { name: "3-Plate Helmet Armor Vest", rarity: "ultra" }
        ],
        "BACKPACKS": [
            { name: "Small Backpack", rarity: "uncommon", obtained: true },
            { name: "Medium Backpack", rarity: "rare", obtained: true },
            { name: "Small Secure Backpack", rarity: "epic", obtained: true },
            { name: "Large Backpack", rarity: "legendary", obtained: true },
            { name: "Medium Secure Backpack", rarity: "legendary", obtained: true },
            { name: "Medium Scavenger Backpack", rarity: "epic" },
            { name: "Medium Weapon Backpack", rarity: "epic" },
            { name: "Large Scavenger Backpack", rarity: "legendary" },
            { name: "Large Secure Backpack", rarity: "ultra" },
            { name: "Secure Scavenger Backpack", rarity: "ultra" }
        ],
        "TACTICALS": [
            { name: "Concussion Grenade", rarity: "common", obtained: true },
            { name: "Snapshot Grenade", rarity: "common", obtained: true },
            { name: "Smoke Grenade", rarity: "common", obtained: true },
            { name: "Shock Stick", rarity: "common", obtained: true },
            { name: "Screamer Mine", rarity: "common", obtained: true },
            { name: "Flash", rarity: "common", obtained: true },
            { name: "Decoy Grenade", rarity: "common", obtained: true },
            { name: "Stim", rarity: "uncommon", obtained: true },
            { name: "Heartbeat Sensor", rarity: "uncommon", obtained: true },
            { name: "Spotter Scope", rarity: "rare", obtained: true }
        ],
        "LETHALS": [
            { name: "Frag Grenade", rarity: "common", obtained: true },
            { name: "Molotov Cocktail", rarity: "common", obtained: true },
            { name: "Zip Gun", rarity: "common", obtained: true },
            { name: "Proximity Mine", rarity: "common", obtained: true },
            { name: "Semtex", rarity: "common", obtained: true },
            { name: "Thermite", rarity: "common", obtained: true },
            { name: "Drill Charge", rarity: "uncommon", obtained: true },
            { name: "Trip Wire", rarity: "uncommon", obtained: true },
            { name: "Throwing Knife", rarity: "uncommon", obtained: true },
            { name: "C4", rarity: "common" },
            { name: "Claymore", rarity: "common" }
        ],
        "FIELD UPGRADES": [
            { name: "Inflatable Decoy", rarity: "uncommon", obtained: true },
            { name: "Ammo Box", rarity: "uncommon", obtained: true },
            { name: "Armor Box", rarity: "rare", obtained: true },
            { name: "Defibrillator", rarity: "rare", obtained: true },
            { name: "DDOS", rarity: "rare", obtained: true },
            { name: "Recon Drone", rarity: "rare", obtained: true },
            { name: "Portable Radar", rarity: "uncommon" },
            { name: "Razor Wire Trap", rarity: "uncommon" },
            { name: "Rebreather", rarity: "uncommon" },
            { name: "Riot Shield", rarity: "uncommon" },
            { name: "Seeker Drone", rarity: "uncommon" },
            { name: "Smoke Wall", rarity: "uncommon" },
            { name: "Trophy System", rarity: "rare" },
            { name: "SAM Airburst Turret", rarity: "rare" },
            { name: "Revive Pistol", rarity: "legendary" },
            { name: "Fulton Drop Marker", rarity: "ultra" }
        ],
        "FIRE SUPPORT": [
            { name: "Care Package", rarity: "rare", obtained: true },
            { name: "Bombing Run", rarity: "epic", obtained: true },
            { name: "Combat Drone", rarity: "epic", obtained: true },
            { name: "UAV", rarity: "epic", obtained: true },
            { name: "Artillery Beacon", rarity: "legendary", obtained: true },
            { name: "Impact Warhead", rarity: "legendary", obtained: true },
            { name: "Bomb Glider", rarity: "epic" },
            { name: "Advanced UAV", rarity: "legendary" },
            { name: "Railgun Sentry", rarity: "legendary" },
            { name: "Crossfire", rarity: "ultra" }
        ],
        "GEAR": [
            { name: "Gas Mask", rarity: "rare", obtained: true },
            { name: "Disposable Parachute", rarity: "rare", obtained: true },
            { name: "Night Vision Goggles", rarity: "rare", obtained: true },
            { name: "Weak Night Vision Goggles", rarity: "uncommon" },
            { name: "Durable Gas Mask", rarity: "epic" },
            { name: "Elite Night Vision Goggles", rarity: "legendary" },
            { name: "Parachute", rarity: "legendary" }
        ]
    },

    // 3D Printer UPGRADES are tracked by tier instead of one checkbox per tier.
    // In game, the numeral on an upgrade is the NEXT tier to build, and a big
    // checkmark means it's maxed. So: built = tiers you've finished.
    // Starting values come from your 3D Printer screenshot (Nov 2026). They're only
    // applied once; after that the app's saved values win. maxTier is optional:
    // fill it in if you learn how many tiers an upgrade has.
    upgradeCatalog: [
        { name: "Dog Tag Case Upgrade", built: 0 },
        { name: "Stash Item Upgrade", built: 1 },
        { name: "Stash Weapon Upgrade", built: 0 },
        { name: "MIA Recovery Discount", built: 2 },
        { name: "Gunsmith Upgrade", built: 1 },
        { name: "Vendor Item Upgrade", built: 1 },
        { name: "Bank Upgrade", built: 4 },
        { name: "Uncommon Ingredient Printing", built: 1, maxed: true },
        { name: "Epic Ingredient Printing", built: 2, maxed: true }
    ],

    // Optional rarity tag for any blueprint. Colors are in styles.css under "RARITY COLORS".
    rarities: [
        { id: "common", label: "COMMON" },
        { id: "uncommon", label: "UNCOMMON" },
        { id: "rare", label: "RARE" },
        { id: "epic", label: "EPIC" },
        { id: "legendary", label: "LEGENDARY" },
        { id: "ultra", label: "ULTRA" }
    ],

    // Materials for the NOTES & MATERIALS view: click one in the app to track how many
    // you have vs. need. Each entry is a name, or { name, rarity } to color it
    // (rarity ids are listed in `rarities` above).
    // Ingredients + rarities: the CODMunity DMZ item database (24 Oct 2026), every
    // printer ingredient (KEEP) item. Other databases disagree on some rarities.
    // Add, rename, or regroup freely; you can also add materials in the app.
    materialCatalog: {
        "BASE RESOURCES": ["Synthetics", "Electronics", "Chemicals", "Metals"],
        "INGREDIENTS": [
            // Legendary
            { name: "Military Composites", rarity: "legendary" },
            { name: "Nano-Structured Alloy", rarity: "legendary" },
            { name: "Prototype RF Module", rarity: "legendary" },
            { name: "Experimental Compounds", rarity: "legendary" }, // from the 3-Plate Ballistic Gel Vest screen (orange icon)
            // Epic
            { name: "Alloyed Plating", rarity: "epic" },
            { name: "Ballistic Fabric", rarity: "epic" },
            { name: "Nylon Laminate", rarity: "epic" },
            { name: "Power Regulator", rarity: "epic" },
            { name: "Stabilized Reagents", rarity: "epic" },
            { name: "Volatile Explosives", rarity: "epic" },
            { name: "Comms Module", rarity: "epic" },
            { name: "Turned Components", rarity: "epic" },
            // Rare
            { name: "Stock Rod", rarity: "rare" },
            { name: "CPU", rarity: "rare" },
            { name: "Binding Catalyst", rarity: "rare" },
            { name: "Structural Alloy", rarity: "rare" },
            { name: "Nitro Compounds", rarity: "rare" },
            { name: "High-Tenacity Fibers", rarity: "rare" },
            { name: "Printed Circuit Board", rarity: "rare" },
            { name: "Nylon Cloth", rarity: "rare" },
            // Uncommon
            { name: "Biomaterials", rarity: "uncommon" },
            { name: "Electronic Sensors", rarity: "uncommon" },
            { name: "Rigid Synthetics", rarity: "uncommon" },
            { name: "Reactive Metals", rarity: "uncommon" },
            { name: "Detonators", rarity: "uncommon" },
            { name: "Control Unit", rarity: "uncommon" }
        ]
    },

    // What each 3D Printer item costs to craft: "Item": { "Material": amount, ... }.
    // Picking items under "Crafting for" adds these up into a shopping list.
    // Item names should match the printer recipe names above; material names should
    // match materialCatalog. Sources: in-game 3D Printer screens (marked "in game"),
    // the rest from codmunity.gg's DMZ crafting planner (Nov 2026).
    // Items not listed here can't be picked yet: add them the same way.
    craftingRecipes: {
        // ---- From in-game screenshots ----
        "Smelling Salts":             { "Chemicals": 30, "Detonators": 3 },
        "2-Plate Ballistic Gel Vest": { "Synthetics": 50, "Binding Catalyst": 3, "Reactive Metals": 10 },
        "2-Plate Helmet Armor Vest":  { "Synthetics": 50, "Structural Alloy": 3, "Reactive Metals": 10 },
        "3-Plate Armor Vest":         { "Ballistic Fabric": 2, "Nylon Cloth": 5, "Reactive Metals": 10 },
        "3-Plate Ballistic Gel Vest": { "Experimental Compounds": 2, "Stabilized Reagents": 4, "Biomaterials": 10 },
        "3-Plate Helmet Armor Vest":  { "Nano-Structured Alloy": 2, "Alloyed Plating": 4, "Reactive Metals": 10 },
        "Medium Scavenger Backpack":  { "Metals": 50, "Nylon Cloth": 3, "Rigid Synthetics": 10 },
        "Medium Weapon Backpack":     { "Synthetics": 50, "High-Tenacity Fibers": 3, "Rigid Synthetics": 10 },
        "Medium Secure Backpack":     { "Alloyed Plating": 2, "Nylon Cloth": 5, "Reactive Metals": 10 },
        "Large Backpack":             { "Nylon Laminate": 2, "Structural Alloy": 5, "Rigid Synthetics": 10 },
        "Large Scavenger Backpack":   { "Nylon Laminate": 2, "High-Tenacity Fibers": 5, "Rigid Synthetics": 10 },
        "Large Secure Backpack":      { "Prototype RF Module": 2, "Alloyed Plating": 4, "Rigid Synthetics": 10 },
        // Field upgrades
        "Inflatable Decoy":           { "Synthetics": 15, "Electronics": 15 },
        "Ammo Box":                   { "Synthetics": 15, "Metals": 15 },
        "Portable Radar":             { "Synthetics": 15, "Electronics": 15 },
        "Razor Wire Trap":            { "Electronics": 15, "Metals": 15 },
        "Rebreather":                 { "Synthetics": 15, "Chemicals": 15 },
        "Riot Shield":                { "Synthetics": 15, "Metals": 15 },
        "Seeker Drone":               { "Synthetics": 15, "Electronics": 15 },
        "Smoke Wall":                 { "Electronics": 15, "Chemicals": 15 },
        "Defibrillator":              { "Electronics": 30, "Control Unit": 3 },
        "DDOS":                       { "Electronics": 30, "Detonators": 3 },
        "Recon Drone":                { "Metals": 30, "Electronic Sensors": 3 },
        "Trophy System":              { "Electronics": 15, "Control Unit": 3 },
        "SAM Airburst Turret":        { "Metals": 30, "Detonators": 3 },
        "Fulton Drop Marker":         { "Prototype RF Module": 1, "Comms Module": 3, "Control Unit": 5 },
        // Fire support
        "Care Package":               { "Electronics": 20, "Control Unit": 2, "Rigid Synthetics": 2 },
        "Combat Drone":               { "Electronics": 30, "CPU": 2, "Control Unit": 5 },
        "UAV":                        { "Electronics": 30, "Structural Alloy": 2, "Electronic Sensors": 5 },
        "Bomb Glider":                { "Chemicals": 30, "Stock Rod": 2, "Control Unit": 5 },
        "Bombing Run":                { "Chemicals": 30, "Nitro Compounds": 2, "Control Unit": 5 },
        "Artillery Beacon":           { "Volatile Explosives": 2, "Nitro Compounds": 3, "Detonators": 5 },
        "Impact Warhead":             { "Turned Components": 2, "Nitro Compounds": 3, "Detonators": 5 },
        "Advanced UAV":               { "Comms Module": 2, "Nitro Compounds": 3, "Electronic Sensors": 5 },
        "Railgun Sentry":             { "Power Regulator": 2, "Nitro Compounds": 3, "Control Unit": 5 },
        "Crossfire":                  { "Prototype RF Module": 2, "Volatile Explosives": 3, "Electronic Sensors": 5 },
        // Gear
        "Gas Mask":                   { "Chemicals": 30, "Rigid Synthetics": 3 },
        "Durable Gas Mask":           { "Chemicals": 30, "High-Tenacity Fibers": 1, "Biomaterials": 5 },
        "Weak Night Vision Goggles":  { "Metals": 25, "Control Unit": 5 },
        "Night Vision Goggles":       { "Metals": 50, "Printed Circuit Board": 3, "Control Unit": 10 },
        "Elite Night Vision Goggles": { "Power Regulator": 2, "CPU": 3, "Electronic Sensors": 5 },
        "Parachute":                  { "Turned Components": 2, "Nylon Cloth": 5, "Rigid Synthetics": 10 },

        // ---- Tacticals & lethals: criticalhits.com.br and gamingpromax.com (both agree) ----
        // Tacticals
        "Concussion Grenade":   { "Synthetics": 10, "Chemicals": 10 },
        "Snapshot Grenade":     { "Synthetics": 10, "Chemicals": 10 },
        "Smoke Grenade":        { "Synthetics": 10, "Chemicals": 10 },
        "Shock Stick":          { "Synthetics": 10, "Chemicals": 10 },
        "Screamer Mine":        { "Synthetics": 10, "Chemicals": 10 },
        "Flash":                { "Synthetics": 10, "Chemicals": 10 },
        "Decoy Grenade":        { "Synthetics": 10, "Chemicals": 10 },
        "Stim":                 { "Synthetics": 15, "Chemicals": 15 },
        "Heartbeat Sensor":     { "Synthetics": 25, "Chemicals": 25 },
        "Spotter Scope":        { "Synthetics": 50, "Electronic Sensors": 5 },
        // Lethals
        "C4":                   { "Chemicals": 10, "Metals": 10 },
        "Claymore":             { "Chemicals": 10, "Metals": 10 },
        "Frag Grenade":         { "Chemicals": 10, "Metals": 10 },
        "Molotov Cocktail":     { "Chemicals": 10, "Metals": 10 },
        "Zip Gun":              { "Chemicals": 10, "Metals": 10 },
        "Proximity Mine":       { "Chemicals": 10, "Metals": 10 },
        "Semtex":               { "Chemicals": 10, "Metals": 10 },
        "Thermite":             { "Chemicals": 10, "Metals": 10 },
        "Drill Charge":         { "Chemicals": 15, "Metals": 15 },
        "Trip Wire":            { "Chemicals": 15, "Metals": 15 },
        "Throwing Knife":       { "Chemicals": 25, "Metals": 25 },

        // ---- gamingpromax.com only (replaced codmunity's incomplete versions): check in game ----
        "Door Breacher Charge": { "Experimental Compounds": 1, "Stock Rod": 5, "Volatile Explosives": 3 },
        "Armor Box":            { "Metals": 30, "Reactive Metals": 3 },
        "Disposable Parachute": { "Chemicals": 30, "Rigid Synthetics": 3 },

        // ---- From codmunity.gg (not checked in game yet) ----
        // Consumables
        "Energy Drink":         { "Chemicals": 10, "Metals": 10 },
        "Bandage":              { "Synthetics": 15, "Chemicals": 15 },
        "Pain Killers":         { "Electronics": 15, "Chemicals": 15 },
        "Sedative Inhaler":     { "Synthetics": 15, "Chemicals": 15 },
        "Radiation Blockers":   { "Electronics": 15, "Chemicals": 15 },
        "Medkit":               { "Chemicals": 30, "Binding Catalyst": 1, "Biomaterials": 5 },
        "Self-Revive Kit":      { "Biomaterials": 5, "Binding Catalyst": 3 },
        // Plate carriers
        "1-Plate Armor Vest":   { "Synthetics": 25, "Metals": 25 },
        "2-Plate Armor Vest":   { "Synthetics": 50, "Reactive Metals": 5 },
        "Tempered Armor Vest":  { "Military Composites": 2, "Ballistic Fabric": 4, "Rigid Synthetics": 10 },
        // Backpacks
        "Small Backpack":            { "Synthetics": 25, "Metals": 25 },
        "Medium Backpack":           { "Synthetics": 50, "Rigid Synthetics": 5 },
        "Small Secure Backpack":     { "Metals": 50, "Rigid Synthetics": 10, "Structural Alloy": 3 },
        "Secure Scavenger Backpack": { "Military Composites": 2, "Nylon Laminate": 4, "Reactive Metals": 10 },
        // Field upgrades
        "Revive Pistol":        { "Power Regulator": 2, "Binding Catalyst": 3, "Detonators": 5 }
    },

    // If you rename a material above, map OLD -> NEW here so tracked counts follow it.
    materialRenames: {
        "PCB": "Printed Circuit Board"
    },

    // CHALLENGES tab: the "Quick start" buttons. Clicking one fills in the add form.
    //   type: "money" (target in $), "count" (target number + unit), or "list" (items to check off)
    // Add your own regular goals here.
    challengeTemplates: [
        { title: "Bank $1,000,000", type: "money", target: 1000000 },
        { title: "Loot compounds", type: "count", target: 5, unit: "compounds" },
        { title: "Kill lieutenants", type: "list", items: [] },
        { title: "Successful extracts", type: "count", target: 10, unit: "extracts" },
        { title: "Finish contracts", type: "count", target: 5, unit: "contracts" },
        { title: "Open key rooms", type: "list", items: [] },
        { title: "Extract with Legendary loot", type: "count", target: 3, unit: "times" }
    ]
};

// Build the weapon lookup: weapons[type][gun][mode] = [camos...]
const weapons = Object.fromEntries(
    gunTypes.map(type => [
        type,
        Object.fromEntries(
            (weaponsByType[type] || []).map(gun => [
                gun,
                {
                    track: buildTrack(gun, type),
                    mp: modeCamos.mp,
                    dmz: modeCamos.dmz,
                    wz: modeCamos.wz,
                    prestige: modeCamos.prestige
                }
            ])
        )
    ])
);

// Expose one clean data object for script.js.
window.MW4_TRACKER_DATA = {
    gunTypes,
    weaponsByType,
    modeOrder,
    modeLabels,
    trackViews,
    weapons,
    dmzSettings
};
