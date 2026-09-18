/* CONFIG — every tunable for the beat 'em up, in one place. Plain data, no logic.
 *
 * THE PROSE LIVES IN `config-notes.md`, NOT HERE. This file is the knobs; that
 * file is the reasoning, moved out whole and unedited on 2026-09-18 because the
 * two together were ~184k tokens and every read of a knob dragged in an essay.
 *
 *     on: true,   // ⚠N0005     <- documented AND carries a trap
 *     DEV: {      // ~N0004     <- documented, prose only
 *
 * Grep the ID, never the key name: `grep -n N0005 config-notes.md` lands on
 * exactly one note. Key names repeat across this file; the ids do not.
 *
 * ⚠ THE MARKER IS PART OF THE KNOB. Move a key, move its marker. Delete a key,
 * delete its note. A marker pointing at nothing sends the next reader hunting.
 * ⚠ NEW REASONING GOES IN config-notes.md UNDER A NEW ID — do not let the
 * essays grow back into this file, which is the whole point of the split.
 */
const BODY_SCALE = 0.72;  // ~N0001 ~N0002

const BELT_TOP_Y = 520;  // ~N0003
const BELT_DEPTH = 190;
const PLAYER_START_ZREL = 0.6;
const CANVAS_H = 720;

const CONFIG = {
  DEV: {  // ~N0004
    on: true,  // ⚠N0005
    punchDamage: 50,  // ⚠N0006
    lives: 1,  // ⚠N0007

    startRoom: 0,  // ⚠N0008
    JUMPS: [0, 1, 'timeattack', 2, 3],  // ⚠N0009
  },

  ASSET_BASE: '../assets/',  // ~N0010
  ASSET_V2_BASE: '../assets-v2/',  // ~N0011
  GAMEPAD_MAPPING: 'gamepad-mapping.json',  // ~N0012

  // --- Canvas: fixed internal resolution (matches the other two games) -----
  GAME_W: 1280,
  GAME_H: 720,
  fitMarginPx: 0,
  bigTextureCap: 3200,  // ~N0013

  fitMaxScale: 0,        // 0 = uncapped, so itch's fullscreen button can fill a
                         // big monitor — see flying-dungeon/STATE.md for why

  spawnMarginPx: 70,  // ⚠N0014

  GRADE: {  // ⚠N0015
    on: true,
    mode: 'multiply',
    strength: 0.70,  // ⚠N0016
    stops: [  // ~N0017
      { t: 0.00, color: '#ffa24a', alpha: 0.16 },   // low warm sun
      { t: 0.45, color: '#ff6a4d', alpha: 0.22 },   // late afternoon
      { t: 0.80, color: '#b0508f', alpha: 0.30 },   // dusk, pink over the sand
      { t: 1.00, color: '#6b3fa0', alpha: 0.38 },   // purple
    ],

    PRESETS: {  // ⚠N0018
      night: {  // ⚠N0019
        strength: 0.476,  // ⚠N0020
        saturate: 1.1,  // ⚠N0021
        stops: [  // ⚠N0022
          { t: 0.00, color: '#16235e', alpha: 0.91 },   // shelf 1 -- deep night blue
          { t: 0.50, color: '#2a1d63', alpha: 0.88 },   // shelf 2 -- bluish purple
          { t: 1.00, color: '#3f1b66', alpha: 0.85 },   // shelf 3 -- purple
        ],
      },
    },
  },

  beltTopY: BELT_TOP_Y,  // screen y of z = 0 — the FAR edge of the walkable band  ~N0023 ~N0024 ⚠N0025
  beltDepth: BELT_DEPTH, // its height in px; z runs 0..this
  playerStartZRel: PLAYER_START_ZREL,  // ~N0026
  playerEnterPx: 360,  // ⚠N0027
  beltFarScale: 1.0,  // ~N0028

  LAYERS: [  // ~N0029
    { name: 'plate',      source: 'plate',      parallax: 1.0 },  // ~N0030
    { name: 'scenery',    scenery: true },  // ~N0031 ~N0032
    { name: 'vermes',     vermes: true },  // ⚠N0033
    { name: 'flies',      flies: true },
    { name: 'fighters',   entities: true },
    { name: 'foreground', source: 'foreground', parallax: 1.25, on: false },  // ~N0034
  ],

  SOURCES: {  // ~N0035
    plate: {  // ~N0036 ~N0037
      kind: 'video',
      src: 'v2:beatemup-dungeon/street-plate.mp4',  // ⚠N0038

      allowReverse: true,  // ⚠N0039

      worldPxPerSecond: 116,  // ~N0040

      resyncS: 6.0,  // ~N0041

      trackGain: 1.2,  // ~N0042

      maxRate: 10,  // ~N0043
      tint: '',
    },

    bossPlate: {  // ~N0044
      kind: 'video',
      src: 'v2:beatemup-dungeon/boss-room-plate.mp4',
      worldPxPerSecond: 64.8,  // ~N0045
      allowReverse: true,
      resyncS: 2.0,          // the room is small; a big drift here is visible
      trackGain: 1.2,
      maxRate: 8,
      tint: '',
    },
    desertPlate: {  // ⚠N0046
      kind: 'video',
      src: 'v2:beatemup-dungeon/desert-plate.mp4',
      worldPxPerSecond: 192.4,  // ~N0047
      allowReverse: true,  // ~N0048
      resyncS: 6.0,  // ~N0049
      trackGain: 1.2,
      maxRate: 10,
      tint: '',
    },

    level3Plate: {  // ⚠N0050
      kind: 'video',
      src: 'v2:beatemup-dungeon/level-3-plate.mp4',
      worldPxPerSecond: 182.8,
      allowReverse: true,  // ⚠N0051
      resyncS: 6.0,
      trackGain: 1.2,
      maxRate: 10,
    },
    // Declared but unused until there is art — see the LAYERS note.
    foreground: { kind: 'image', src: '', scale: 1 },
  },

  ROOMS: [  // ~N0052 ~N0053 ~N0054
    {
      name: 'street',
      plate: 'plate',
      startX: 220,
      flies: true,  // ~N0055
      props: [  // ⚠N0056
        { kind: 'barrel',  x: 430, z: 110, drops: true, dropKind: 'bomb' },  // ⚠N0057 ⚠N0058
        { kind: 'barrel',  x: 620, z: 165 },
        // The opening walk: a barrel, and nothing that can hit back.
        // { kind: 'barrel',  x: 1450, z: 60 },
        { kind: 'coxinha', x: 1900, z: 105 },
        // The first arena.
        // { kind: 'barrel',  x: 2180, z: 40 },
        // Past the sub-boss: the roaches. Far side of the belt, for variety --
        // the other three are all within a lane of the near edge.
        { kind: 'coxinha', x: 3480, z: 120 },
        // { kind: 'barrel',  x: 3860, z: 180 },
        // The last stand.
        // { kind: 'barrel',  x: 4120, z: 55 },
      ],
      endX: 4704,  // ~N0059
      reverse: true,  // ⚠N0060
      segments: [
    { kind: 'scroll', toX: 2100 },         // camera ends ≈ 1430; view ≈ 1430..2710  ~N0061
    {  // ~N0062
      kind: 'arena',
      enemies: [
        { kind: 'cigarro',  x: 2280, z: 40 },
        { kind: 'cigarro2',   x: 2450, z: 120, delayMs: 500 },
        { kind: 'cigarro3', x: 2360, z: 175, delayMs: 1400 },
        { kind: 'cigarro3', x: 2200, z: 90,  delayMs: 6400, from: 'behind' },
        { kind: 'cigarro',  x: 2240, z: 160, delayMs: 9400, from: 'behind' },
      ],
    },
    { kind: 'scroll', toX: 3300 },
    { kind: 'boss', fleeAt: 0.5 },  // ⚠N0063

    { kind: 'scroll', toX: 3690 },        // camera 2632 -> 3022   (film 88%)  ~N0064
    {  // ~N0065
      kind: 'arena',
      enemies: [  // ~N0066
        { kind: 'cigarro3', x: 3600, z: 70 },
        { kind: 'barata',   x: 3800, z: 150, delayMs: 600 },
        { kind: 'barata2',  x: 3500, z: 110, delayMs: 2400, from: 'behind' },
        { kind: 'barata',   x: 3900, z: 50,  delayMs: 5200 },
        { kind: 'barata2',  x: 3450, z: 170, delayMs: 8000, from: 'behind' },
      ],
    },
    { kind: 'scroll', toX: 4092 },        // camera 3022 -> 3424   (film 100%)
    {  // ~N0067
      kind: 'arena',
      enemies: [
        { kind: 'barata2',  x: 4000, z: 60 },
        { kind: 'cigarro3', x: 4230, z: 150, delayMs: 500 },
        { kind: 'barata',   x: 3950, z: 110, delayMs: 1600, from: 'behind' },
        { kind: 'barata2',  x: 4100, z: 180, delayMs: 4200, from: 'behind' },
        { kind: 'barata',   x: 4300, z: 40,  delayMs: 7000 },
      ],
    },
    { kind: 'boss' },],  // ⚠N0068
    },

    {  // ⚠N0069
      name: 'desert',
      plate: 'desertPlate',
      startX: 220,
      timeAttackOnExit: true,  // ⚠N0070
      music: 'musicDesert',  // ⚠N0071 ⚠N0072
      belt: { topY: 330, depth: 380 },  // ⚠N0073
      scenery: true,  // ~N0074
      dense: { fromX: 4880, toX: 6360 },  // ⚠N0075
      grade: true,  // ~N0076
      endX: 6286,  // ~N0077
      reverse: true,  // ~N0078
      segments: [  // ~N0079
        { kind: 'scroll', toX: 2400 },   // camera 0 -> 1732   (film 35%)  ~N0080
        {  // ⚠N0081 ⚠N0082
          kind: 'arena',
          enemies: [
            { kind: 'cigarro', x: 2600, z: 220, from: 'ground' },
            { kind: 'espeto',  x: 2750, z: 300, delayMs: 900, from: 'ground' },  // ⚠N0083
            { kind: 'charutobi', x: 2900, z: 150, delayMs: 1800, from: 'ground' },  // ⚠N0084 ⚠N0085
            { kind: 'charutobi', x: 2900, z: 260, delayMs: 2600 },  // ⚠N0086
          ],
        },
        { kind: 'scroll', toX: 4000 },   // camera 1732 -> 3332 (film 67%)
        {  // ~N0087
          kind: 'arena',
          enemies: [
            { kind: 'cigarro', x: 4200, z: 220, from: 'ground' },
            { kind: 'espeto',  x: 4350, z: 300, delayMs: 900, from: 'ground' },
            // Same three-in-a-row staggering as the first arena; see the note
            // on the charutobi there for why he comes in a second behind.
            { kind: 'charutobi', x: 4500, z: 150, delayMs: 1800, from: 'ground' },
            { kind: 'charutobi', x: 4500, z: 250, delayMs: 2800 },  // ⚠N0088
            { kind: 'charutobi', x: 4500, z: 330, delayMs: 3700, from: 'behind' },  // ⚠N0089
            { kind: 'charutobi', x: 4500, z: 190, delayMs: 4600, from: 'behind' },
          ],
        },
        { kind: 'scroll', toX: 5674 },   // camera 3332 -> 5006 (film 100%)  ~N0090

        {  // ⚠N0091
          kind: 'arena',
          enemies: [
            { kind: 'cigarro3', x: 5900, z: 220, from: 'ground' },
            { kind: 'espeto',   x: 6050, z: 300, delayMs: 900, from: 'ground' },  // ~N0092
            // ...and the third, so the room's hardest fight is the one that has
            // all three of its enemies in it. See the first arena's note.
            { kind: 'charutobi', x: 6200, z: 150, delayMs: 1800, from: 'ground' },
          ],
        },
        { kind: 'boss', who: 'horacio', lock: false },  // ⚠N0093
      ],
    },

    {  // ~N0094
      name: 'boss-room',
      plate: 'bossPlate',
      startX: 220,
      exitByLift: true,  // ⚠N0095
      music: 'musicBoss',  // ⚠N0096

      props: [  // ⚠N0097 ⚠N0098
        { kind: 'barrel',  x: 1528, z: 40 },
        { kind: 'barrel',  x: 1594, z: 95 },
      ],
      endX: 1617,  // ~N0099
      reverse: true,
      segments: [
        {  // ~N0100
          kind: 'arena',
          lock: false,  // ~N0101
          enemies: [  // ⚠N0102
            { kind: 'barata',  x: 900,  z: 70 },
            { kind: 'barata2', x: 1100, z: 150, delayMs: 900 },
            { kind: 'barata',  x: 700,  z: 110, delayMs: 2600, from: 'behind' },
          ],
        },
        { kind: 'boss', who: 'horse', lock: false },  // ~N0103 ⚠N0104
      ],
    },

    {  // ⚠N0105
      name: 'level-3',
      plate: 'level3Plate',
      startX: 220,
      level3: true,
      enterByLift: true,  // ⚠N0106
      music: 'musicLevel3',  // ⚠N0107 ⚠N0108
      belt: { topY: 470, depth: 200 },  // ⚠N0109 ⚠N0110
      endX: 24500,  // ⚠N0111
      // grade: 'night',
      segments: [  // ⚠N0112 ⚠N0113
        { kind: 'scroll', toX: 24000 },  // ~N0114
      ],
    },
  ],
  scrollMinWalkPx: 260,  // ~N0115 ~N0116 ⚠N0117

  levelEndX: 4704,

  // --- Camera --------------------------------------------------------------
  camDeadzone: 130,       // px either side of the camera's focus point  ~N0118
  camFocusX: 0.42,        // where in the view that focus point sits (0..1)
  camFollowGain: 1.0,  // ~N0119

  camEaseRate: 7,         // still used by the arena lock hand-over         // how quickly it closes the gap, 1/sec
  camLockEaseRate: 4,     // ...and when snapping to an arena lock (slower, so
                          // the lock reads as the world stopping, not a cut)

  PLAYER_PACKS: ['coconut', 'coconutStrong'],  // ~N0120 ~N0121

  CHARACTERS: {
    coconut:  { sheet: 'v2:beatemup-dungeon/coconut-beat', pack: 'ragged',  // ~N0122
                drawScale: 0.9, name: 'LEBRON',
                jumpScale: 1.08,  // ⚠N0123
                poses: {  // ⚠N0124
                  victory: { anim: 'jump', from: 2, to: 3 },
                  downLand: { anim: 'knockdown', from: 0, to: 3 },  // ⚠N0125
                  downLie:  { anim: 'knockdown', from: 3, to: 4 },
                  downRise: { anim: 'knockdown', from: 4, to: 6 },
                } },

    coconutStrong: { sheet: 'v2:beatemup-dungeon/coconut-strong-beat',  // ⚠N0126 ⚠N0127
                     pack: 'ragged', drawScale: 0.9 * 1.04, name: 'IPANEIMA',
                     airDwell: { slot: 4, share: 2 },  // ~N0128
                     walkScale: 0.90,  // ~N0129
                     knockbackScale: 1.15,  // ~N0130
                     poses: {  // ~N0131
                       special1: { anim: 'special', from: 0, to: 6 },  // ⚠N0132
                       special2: { anim: 'special', from: 7, to: 8 },  // ⚠N0133
                       special3: { anim: 'special', from: 8, to: 9 },
                       special4: { anim: 'special', from: 4, to: 5 },  // ⚠N0134
                       victory:  { anim: 'jump', from: 2, to: 3 },
                       downLand: { anim: 'knockdown', from: 0, to: 3 },
                       downLie:  { anim: 'knockdown', from: 3, to: 4 },
                       downRise: { anim: 'knockdown', from: 4, to: 6 },
                     } },

    cigarro:  { sheet: 'v2:beatemup-dungeon/cigarro-beat', pack: 'ragged',  // ~N0135
                name: 'DUDU',
                drawScale: 1.452,  // ⚠N0136
                poses: {
                  downLand: { anim: 'knockdown', from: 0, to: 3 },  // ~N0137
                  downLie:  { anim: 'knockdown', from: 3, to: 4 },
                  downRise: { anim: 'knockdown', from: 4, to: 6 },
                } },

    cigarro2: { sheet: 'v2:beatemup-dungeon/cigarro2-beat', pack: 'ragged',  // ~N0138
                name: 'DIDI',
                drawScale: 1.691,  // ⚠N0139
                poses: {
                  downLand: { anim: 'knockdown', from: 0, to: 3 },
                  downLie:  { anim: 'knockdown', from: 3, to: 4 },
                  downRise: { anim: 'knockdown', from: 4, to: 6 },
                } },

    barata:  { sheet: 'v2:beatemup-dungeon/barata-beat', pack: 'ragged',  // ⚠N0140 ⚠N0141
               name: 'CLAUDINHO',
               shadowWRel: 2.24,  // ⚠N0142
               drawScale: 2.55134,  // ⚠N0143
               corpseFadeSteps: 4,  // ⚠N0144
               poses: {
                 combo1: { anim: 'combo', from: 1, to: 2 },
                 combo2: { anim: 'combo', from: 2, to: 3 },
                 combo3: { anim: 'combo', from: 3, to: 4 },
                 combo4: { anim: 'combo', from: 4, to: 5 },  // ~N0145
                 down:   { anim: 'death', from: 2, to: 3 },
               } },
    barata2: { sheet: 'v2:beatemup-dungeon/barata2-beat', pack: 'ragged',  // ~N0146
               name: 'ZIDANE',
               shadowWRel: 2.24,  // ⚠N0147
               // The same number as the tan one, and measured rather than
               // assumed: both sheets cut to an identical body (167.8px then,
               // 348.9 now), so the pair is drawn at one size and there is no
               // ratio to preserve between them the way there is between the
               // cigarettes. They took the 2026-08-22 +30% and the -10% after
               // it together, the 2026-08-23 +5% as well, and the 2026-09-11
               // +10% -- 2.3194 x 1.1 -- for the same reason.
               // ⚠️ THAT LAST ONE WAS ASKED FOR AGAINST THE RED ONE ALONE
               // (*"testei com a barata vermelha"*) and applied to BOTH: they
               // are one animal in two colours, and sizing them apart would be
               // a difference nobody asked for, visible the first time they
               // share a screen. The atlas was re-cut with it -- see the tan
               // one's note, and build-beat-enemy-defs.py.
               drawScale: 2.55134,
               corpseFadeSteps: 4,  // ⚠N0148
               poses: {
                 combo1: { anim: 'combo', from: 1, to: 2 },
                 combo2: { anim: 'combo', from: 2, to: 3 },
                 combo3: { anim: 'combo', from: 3, to: 4 },
                 combo4: { anim: 'combo', from: 4, to: 5 },  // ~N0149
                 down:   { anim: 'death', from: 2, to: 3 },
               } },

    verme:   { sheet: 'v2:beatemup-dungeon/verme-beat', pack: 'ragged',  // ⚠N0150
               name: 'VERME',
               drawScale: 1.46,
               groundNudgePx: 10,  // ⚠N0151
               stage1: ['vermeOculos1', 'vermeOculos2',  // ⚠N0152
                        'vermeOculos3', 'vermeOculos4'],
               shadow: false,  // ⚠N0153
               poses: {
                 down: { anim: 'death', from: 1, to: 2 },  // ~N0154
                 egg:  { anim: 'egg' },  // ~N0155
               } },

    vermeOculos1: { sheet: 'v2:beatemup-dungeon/verme-oculos-1-beat', pack: 'ragged',  // ⚠N0156
               name: 'VERME', drawScale: 1.46, groundNudgePx: 10, shadow: false,
               poses: {
                 down:    { anim: 'death', from: 1, to: 2 },
                 egg:     { anim: 'egg' },
                 hurt:    { anim: 'hurt', from: 0, to: 2 },
                 glasses: { anim: 'hurt', from: 2, to: 3 },
               } },
    vermeOculos2: { sheet: 'v2:beatemup-dungeon/verme-oculos-2-beat', pack: 'ragged',
               name: 'VERME', drawScale: 1.46, groundNudgePx: 10, shadow: false,
               poses: {
                 down:    { anim: 'death', from: 1, to: 2 },
                 egg:     { anim: 'egg' },
                 hurt:    { anim: 'hurt', from: 0, to: 2 },
                 glasses: { anim: 'hurt', from: 2, to: 3 },
               } },
    vermeOculos3: { sheet: 'v2:beatemup-dungeon/verme-oculos-3-beat', pack: 'ragged',
               name: 'VERME', drawScale: 1.46, groundNudgePx: 10, shadow: false,
               poses: {
                 down:    { anim: 'death', from: 1, to: 2 },
                 egg:     { anim: 'egg' },
                 hurt:    { anim: 'hurt', from: 0, to: 2 },
                 glasses: { anim: 'hurt', from: 2, to: 3 },
               } },
    vermeOculos4: { sheet: 'v2:beatemup-dungeon/verme-oculos-4-beat', pack: 'ragged',
               name: 'VERME', drawScale: 1.46, groundNudgePx: 10, shadow: false,
               poses: {
                 down:    { anim: 'death', from: 1, to: 2 },
                 egg:     { anim: 'egg' },
                 hurt:    { anim: 'hurt', from: 0, to: 2 },
                 glasses: { anim: 'hurt', from: 2, to: 3 },
               } },

    horse:   { sheet: 'v2:beatemup-dungeon/horse-beat', pack: 'ragged',  // ⚠N0157
               name: 'HIPÓLITO',
               drawScale: 2.3355,
               poses: {
                 runAttack: { anim: 'runAttack' },
                 trot:      { anim: 'trot' },
                 walk:      { anim: 'walk' },
                 kick:      { anim: 'kick' },
                 turn:      { anim: 'turn' },
               } },

    barril:  { sheet: 'v2:beatemup-dungeon/barril-beat', pack: 'ragged',  // ⚠N0158
               name: 'BARRIL',
               drawScale: 1.144,  // ⚠N0159
               poses: {
                 idle:      { anim: 'idle' },       // 4: two drawings + mirrors
                 smash:     { anim: 'brk' },
                 smash2:    { anim: 'brk2' },
                 side:      { anim: 'side' },       // carried, and in flight
                 smashSide: { anim: 'brkSide' },
                 bomb:      { anim: 'bomb' },    // fuse to the right  ~N0160 ⚠N0161
                 bomb2:     { anim: 'bomb2' },   // fuse to the left
                 chicken:   { anim: 'food', from: 0, to: 1 },
                 coxinha:   { anim: 'food', from: 1, to: 2 },
                 bomb:      { anim: 'bomb' },    // fuse to the right  ⚠N0162
                 bomb2:     { anim: 'bomb2' },   // fuse to the left
               } },

    cigarro3: { sheet: 'v2:beatemup-dungeon/cigarro3-beat', pack: 'ragged',
                name: 'DEDÉ',
                drawScale: 1.691,
                poses: {
                  downLand: { anim: 'knockdown', from: 0, to: 3 },
                  downLie:  { anim: 'knockdown', from: 3, to: 4 },
                  downRise: { anim: 'knockdown', from: 4, to: 6 },
                } },

    espeto:   { sheet: 'v2:beatemup-dungeon/espeto-beat', pack: 'ragged',  // ⚠N0163
                name: 'ESPETO',
                drawScale: 0.9,  // ⚠N0164
                corpseFade: false,  // ⚠N0165
                groundNudge: 9,  // ⚠N0166
                poses: {
                  downLand: { anim: 'knockdown', from: 0, to: 3 },
                  downLie:  { anim: 'knockdown', from: 3, to: 4 },
                  downRise: { anim: 'knockdown', from: 4, to: 6 },
                } },

    charutobi: { sheet: 'v2:beatemup-dungeon/charutobi-beat', pack: 'ragged',  // ⚠N0167
                name: 'CHARUTOBI',
                drawScale: 0.6885,  // ⚠N0168
                corpseFade: false,
                poses: {  // ~N0169
                  downLand: { anim: 'knockdown', from: 0, to: 2 },
                  downLie:  { anim: 'knockdown', from: 2, to: 3 },
                  downRise: { anim: 'knockdown', from: 3, to: 6 },
                  death:    { anim: 'death', from: 4 },  // ⚠N0170 ⚠N0171
                } },
  },

  POSE: {  // ~N0172
    idle:     [0],
    walk:     [0],
    jab:      [1],
    straight: [2],
    finisher: [5, 6, 7],
    hurt:     [3],
    down:     [3],
  },

  POSE_RAGGED: {  // ~N0173
    idle:       { anim: 'idle' },
    walk:       { anim: 'walk' },
    jump:       { anim: 'jump' },
    airPunch:   { anim: 'airPunch' },

    combo1:     { anim: 'combo', from: 0, to: 2 },
    combo2:     { anim: 'combo', from: 2, to: 4 },
    combo3:     { anim: 'combo', from: 4, to: 6 },   // the leaning punch
    combo4:     { anim: 'combo', from: 6, to: 8 },
    combo5:     { anim: 'combo', from: 8, to: 10 },  // the UPPERCUT
    comboLow5:  { anim: 'comboLow', from: 8, to: 10 },

    hurt:       { anim: 'hurt' },
    down:       { anim: 'knockdown' },
    death:      { anim: 'death' },

    idleLong:   { anim: 'idleLong' },  // ⚠N0174

    special1:   { anim: 'special', from: 0, to: 3 },  // ⚠N0175
    special2:   { anim: 'special', from: 3, to: 8 },
    special3:   { anim: 'special', from: 8, to: 10 },

    ball:       { anim: 'ball' },  // ~N0176

    lift:       { anim: 'lift' },
    liftThrow:  { anim: 'liftThrow' },  // ~N0177
    carryThrow: { anim: 'liftThrow', from: 2 },  // ⚠N0178 ⚠N0179
    pickGround: { anim: 'pickGround' },
    carryWalk:  { anim: 'carryWalk' },
  },

  POSE_MS: { idle: 200, walk: 124, hurt: 100, down: 110, death: 130, ball: 55 },  // ~N0180 ~N0181

  GLASSES: {  // ⚠N0182 ⚠N0183
    on: true,
    flyMs: 583,  // ⚠N0184 ⚠N0185
    upPx: 130,      // the top of the arc, in px at the near edge of the belt
    fallPx: 380,    // and how far past it they drop -- enough to leave the floor
    awayPx: 420,    // sideways, in the direction of the blow: ~600px/sec
    spin: 7.0,      // radians over the flight -- a bit over one tumble
    fadeFrom: 0.78,  // ⚠N0186
  },

  IDLE_LONG: {
    on: true,
    afterS: 7,  // ~N0187
    frameMs: 156,  // ⚠N0188
    loop: false,  // ⚠N0189
  },

  jumpLandHoldMs: 150,  // ~N0190

  corpseFadeDelayS: 0.25,  // ~N0191 ⚠N0192
  corpseFadeS: 0.55,

  deathHoldMs: 1000,

  RESULTS: {  // ⚠N0193
    rowMs: 1000,            // how long one number takes to roll up  ⚠N0194
    rowStaggerMs: 500,      // gap between rows starting
    rankDelayMs: 400,       // beat between the LAST ROW FINISHING and the stamp
    TICK: { on: true, sfx: 'coin', ms: 90, rise: 0.25 },  // ⚠N0195
    rankMs: 420,
    LABELS: {  // ~N0196 ⚠N0197
      hits:     'PORRADAS',      // hits landed / swings
      accuracy: 'SAGACIDADE',    // accuracy %
      taken:    'VACILOS',       // times the player got hit
      dealt:    'ESTRAGO',       // damage dealt
      suffered: 'PREJUÍZO',      // damage taken
      time:     'TEMPO',
      downed:   'RANGO',         // enemies put down
      rank:     'NOTA',          // the letter stamp's caption
      thanks:   'OBRIGADO POR JOGAR',
      thanks2:  'THANK YOU',     // in English ON PURPOSE -- see above
      prompt:   'pressione qualquer botão',
      lost:     'PERDEU!',
      dev:      'MODO DEV: os números de dano não são reais',
    },
    titleY: 100,
    titleSize: 54,         // was 76 when the word was just CLEAR
    subTitleSize: 26,
    subTitleGap: 40,       // px below the title line
    rowsY: 190,
    rowStep: 42,
    noteStep: 30,
    labelX: 366,
    valueX: 914,
    rowSize: 27,
    noteSize: 17,
    rankY: 588,
    rankSize: 76,
    rankColors: { S: '#FFD23F', A: '#7BD389', B: '#6FB3E0', C: '#E8E8E8' },
    // score >= min, first match wins. Keep it sorted downward.
    rankTiers: [['S', 0.90], ['A', 0.75], ['B', 0.55], ['C', 0]],
    rankWeights: [0.40, 0.40, 0.20],   // accuracy, health kept, pace
    rankDamageBudget: 220,             // two full bars of damage taken = 0
    rankParS: 150,                     // a comfortable clear, in seconds
  },

  outroExitPad: 220,  // ~N0198

  fadeMs: 900,  // ~N0199

  PICKUP_MS: { ground: 420, heavy: 640, throw: 420, throwReleaseRel: 0.45 },  // ~N0200 ⚠N0201

  pickupButton: true,  // ⚠N0202

  PROPS: {  // ⚠N0203
    barrel: {
      on: true,  // ⚠N0204
      hp: 5,  // ~N0205
      sizePx: 156,  // ⚠N0206
      hitWRel: 0.8,      // hurtbox width, as a fraction of sizePx
      hitZ: 46,          // and its depth on the belt, in px
      liftRangeX: 105,  // ~N0207 ⚠N0208
      liftRangeZ: 46,
      dropAheadPx: 89,  // ⚠N0209
      carryYRel: 0.627,  // ⚠N0210 ⚠N0211
      LIFT_ARC: {  // ⚠N0212
        startRel: 0.3,  // ~N0213
        bulgePx: 34,  // ~N0214
        spinDeg: 90,  // ~N0215
        steps: 4,  // ⚠N0216
      },

      throwSpeed: 624,  // ~N0217 ⚠N0218
      throwLift: 120,
      throwGravity: 900,
      throwDamage: 22,  // ~N0219
      throwKnockback: 260,
      throwLiftHit: 90,
      throwKnockdown: true,
      throwReachY: 130,  // ⚠N0220
      throwPierce: false,  // ~N0221
      spinMs: 90,        // per frame of the tumble while in flight
      smashMs: 480,      // the three break frames, then it is gone
      dropChance: 0.35,  // ⚠N0222
      bombChance: 0.5,  // ⚠N0223
    },
    bomb: {  // ⚠N0224
      sizePx: 82,  // ~N0225
      hitWRel: 0.8,
      hitZ: 40,
      hp: 1,  // ~N0226
      fuseMs: 8000,  // ~N0227
      animMs: 82,  // ⚠N0228
      animPanicS: 3,  // ⚠N0229
      animPanicMs: 40,
      panicTintAlpha: 0.85,  // ⚠N0230
      panicTint: 'brightness(0) invert(24%) sepia(100%) saturate(4000%) ' +
                 'hue-rotate(-8deg) brightness(110%)',
      liftRangeX: 88,  // ~N0231
      liftRangeZ: 46,
      dropAheadPx: 60,
      carryYRel: 0.627,
      spinMs: 90,
      smashMs: 1200,
      throwSpeed: 700,  // ~N0232
      throwLift: 150,
      throwGravity: 900,
      throwDamage: 8,
      throwKnockback: 240,
      throwLiftHit: 80,
      throwKnockdown: true,
      throwReachY: 130,
      LIFT_ARC: { startRel: 0.3, bulgePx: 26, spinDeg: 0, steps: 4 },
      blastR: 150,          // px on the floor plane, with depth weighted x2  ~N0233
      damage: 18,
      knockback: 380,
      lift: 150,
      knockdown: true,
      BOOM: { on: true, count: 4, everyMs: 90, startMs: 0,  // ~N0234
              spreadXRel: 0.5, spreadYRel: 0.5, sizePx: 170, sizeJitter: 0.25 },
    },

    food: {
      chickenRel: 0.5,  // ⚠N0235
      coxinhaRel: 1 / 3,
      rangeX: 52,  // ⚠N0236
      rangeZ: 40,
      rangeY: 60,  // ~N0237
      bobPx: 0,  // ⚠N0238
      bobRate: 3.2,
    },
  },


  fighterSizePx: 190 * BODY_SCALE,  // ~N0239 ~N0240
  bodyW: 74 * BODY_SCALE,  // ~N0241
  bodyZ: 30 * BODY_SCALE,

  poseNudge: { finisher: -6 * BODY_SCALE },  // ~N0242

  shadowW: 44 * BODY_SCALE,  // ~N0243
  shadowH: 13 * BODY_SCALE,
  shadowLiftRef: 240,  // ~N0244

  // --- Movement ------------------------------------------------------------
  walkSpeedX: 300,        // px/sec along the belt  ~N0245
  walkSpeedZ: 165,        // px/sec across it
  jumpHeight: 118 * BODY_SCALE,  // px at the top of the arc — scaled with the body, so  ~N0246
                          // a jump stays the same height IN FIGHTERS
  jumpMs: 620,
  // --- Health --------------------------------------------------------------
  playerHealth: 110,  // ~N0247
  playerLives: 3,  // ~N0248
  respawnInvulnMs: 1500,  // ⚠N0249
  enemyHealth: { verme: 45, cigarro2: 40, cigarro: 34, cigarro3: 55, barata: 50, barata2: 66,  // ~N0250 ⚠N0251 ⚠N0252 ⚠N0253
                 espeto: 60, charutobi: 30 },

  COMBO: [  // ~N0254 ~N0255
    { pose: 'combo1', startupMs: 55, activeMs: 70, recoverMs:  85, cancelMs: 230,
      damage: 5, reachX:  96 * BODY_SCALE, reachZ: 46 * BODY_SCALE, knockback:  60, lift: 0 },
    { pose: 'combo2', startupMs: 55, activeMs: 70, recoverMs:  85, cancelMs: 230,
      damage: 6, reachX: 100 * BODY_SCALE, reachZ: 46 * BODY_SCALE, knockback:  80, lift: 0 },
    // The leaning punch: the body commits forward, so it reaches further.
    { pose: 'combo3', startupMs: 70, activeMs: 80, recoverMs: 100, cancelMs: 250,
      damage: 8, reachX: 110 * BODY_SCALE, reachZ: 46 * BODY_SCALE, knockback: 140, lift: 0 },
    { pose: 'combo4', startupMs: 55, activeMs: 70, recoverMs:  85, cancelMs: 240,
      damage: 5, reachX: 100 * BODY_SCALE, reachZ: 46 * BODY_SCALE, knockback:  80, lift: 0 },
    { pose: 'combo5', startupMs: 110, activeMs: 100, recoverMs: 240, cancelMs: 0,  // ~N0256
      damage: 12, reachX: 118 * BODY_SCALE, reachZ: 52 * BODY_SCALE, knockback: 320,
      lift: 190 * BODY_SCALE, knockdown: true, lungePx: 30 * BODY_SCALE,
      sweep: true },
  ],

  AIR_ATTACK: {  // ⚠N0257
    pose: 'airPunch', startupMs: 80, activeMs: 420, recoverMs: 190, cancelMs: 0,
    damage: 8, reachX: 100 * BODY_SCALE, reachZ: 56 * BODY_SCALE, reachY: 120,
    knockback: 300, lift: 190 * BODY_SCALE, knockdown: true, sweep: true,
  },

  SPECIAL: {  // ⚠N0258
    on: true,
    cooldownMs: 1400,
    coconut: [  // ⚠N0259
      { pose: 'special1', frameMs: 80,  // ~N0260
        startupMs: 120, activeMs: 90, recoverMs: 30, cancelMs: 0,
        damage: 6, reachX: 175 * BODY_SCALE, reachZ: 100 * BODY_SCALE,
        knockback: 20, sweep: true },
      { pose: 'special2', frameMs: 80,  // ~N0261
        startupMs: 180, activeMs: 90, recoverMs: 130, cancelMs: 0,
        damage: 6, reachX: 175 * BODY_SCALE, reachZ: 100 * BODY_SCALE,
        knockback: 26, sweep: true },
      { pose: 'special3', frameMs: 80,  // ⚠N0262
        startupMs: 80, activeMs: 60, recoverMs: 100, cancelMs: 0,
        dwell: { slot: 1, share: 2 },
        damage: 14, reachX: 210 * BODY_SCALE, reachZ: 120 * BODY_SCALE,
        knockback: 420, lift: 150 * BODY_SCALE, knockdown: true, sweep: true,
        lungePx: 60 * BODY_SCALE },
    ],
    coconutStrong: [
      { pose: 'special1', frameMs: 120,  // ⚠N0263
        startupMs: 608, activeMs: 72, recoverMs: 40, cancelMs: 0,
        damage: 5, reachX: 130 * BODY_SCALE, reachZ: 100 * BODY_SCALE,
        knockback: 22, radial: true, sweep: true },
      { pose: 'special2', frameMs: 120,  // ~N0264
        startupMs: 170, activeMs: 72, recoverMs: 40, cancelMs: 0,
        damage: 5, reachX: 130 * BODY_SCALE, reachZ: 100 * BODY_SCALE,
        knockback: 28, radial: true, sweep: true },
      { pose: 'special3', frameMs: 120,  // ~N0265
        startupMs: 165, activeMs: 80, recoverMs: 60, cancelMs: 0,
        damage: 13, reachX: 165 * BODY_SCALE, reachZ: 120 * BODY_SCALE,
        knockback: 380, lift: 130 * BODY_SCALE, knockdown: true, sweep: true,
        radial: true },
      { pose: 'special4', frameMs: 120,  // ⚠N0266
        startupMs: 140, activeMs: 0, recoverMs: 0, cancelMs: 0,
        damage: 0, reachX: 0, reachZ: 0, knockback: 0 },
    ],
  },



  COMBO_ALT_FINISH: {  // ⚠N0267 ⚠N0268 ⚠N0269
    pose: 'comboLow5', startupMs: 110, activeMs: 100, recoverMs: 240, cancelMs: 0,
    damage: 12, reachX: 124 * BODY_SCALE, reachZ: 46 * BODY_SCALE, knockback: 420,
    lift: 150, knockdown: true, lungePx: 50 * BODY_SCALE, sweep: true,
  },

  hitstopMs: { jab: 55, straight: 70, finisher: 130,  // ~N0270 ⚠N0271 ⚠N0272
               special1: 15, special2: 15, special3: 130 },

  HIT_FX: {  // ~N0273 ~N0274
    on: true,
    sizePx: 90 * BODY_SCALE,  // ~N0275
    bigSizePx: 132 * BODY_SCALE,   // the finisher, and every blow the boss lands
    chestRel: 0.42,  // ~N0276
    ms: 220,  // ~N0277
    fadeTail: 0.3,  // ~N0278
    mirror: true,  // ~N0279
    colorByRole: true,  // ⚠N0280
    playerColour: 'yellow',   // used only when colorByRole is on
    enemyColour: 'red',
  },
  FX_SHEET: 'v2:beatemup-dungeon/effects-porrada',  // ~N0281

  // --- Being hit -----------------------------------------------------------
  verticalReach: 70,  // ~N0282

  ENEMY_HIT_SFX: ['enemyHit'],  // ⚠N0283 ⚠N0284


  TIME_ATTACK: {  // ⚠N0285
    on: true,

    CHARACTERS: ['lebron', 'ipaneima'],  // ⚠N0286
    CH_FRAMES: 6,
    CH_REST: 3,
    character: null,  // ⚠N0287

    ASSET_BASE: 'v2:beatemup-dungeon/',  // ⚠N0288 ⚠N0289
    planeDir: 'time-attack/',
    planeFilePrefix: 'batidao-plane-',
    gunBase: 'v2:flying-dungeon/character-sheets/',
    PLATE: 'v2:beatemup-dungeon/time-attack/time-attack-1-plate.mp4',
    FLY_SHEET:      'v2:flying-dungeon/enemy-sheets/saborosa-mosca.png',  // ~N0290
    FLY_DEAD_SHEET: 'v2:flying-dungeon/enemy-sheets/saborosa-mosca dead.png',
    COIN_SHEETS: { '01': 'v2:flying-dungeon/coin/saborosa-coin-time-01.webp' },
    keyFly:     'ta:fly',  // ⚠N0291
    keyFlyDead: 'ta:flyDead',
    keyCoin:    'ta:coin_',
    keyBoom:    'boom',

    ROUNDS: [  // ⚠N0292
      { coins:  8, timeMs: 30000, flies: 4, clocks: 1 },
      { coins: 14, timeMs: 30000, flies: 5, clocks: 2 },
      { coins: 22, timeMs: 30000, flies: 6, clocks: 2 },
    ],
    coinsPerFly: 1,  // ⚠N0293
    quotaLabel: 'MOSCAS',  // ⚠N0294
    LETTER: {  // ⚠N0295 ⚠N0296
      on: true,
      SHEET: 'v2:beatemup-dungeon/batidao-timeattack',
      scale: 0.52,
      clockMul: 1.1,  // ⚠N0297
      holePadMul: 0.55,  // ⚠N0298
      holeAirPx: 10,  // ⚠N0299
      PUNCH: { on: true, stampMs: 400, pop: 0.25,  // ⚠N0300
               shakeAmp: 9, shakeMs: 180, shakeFreqX: 82, shakeFreqY: 71 },
      CLOCK_PUNCH: { on: true, stampMs: 220, pop: 0.20,  // ⚠N0301
                     shakeAmp: 3, shakeMs: 110, shakeFreqX: 82, shakeFreqY: 71 },
      wordGapPx: 10,     // between a label and its number
      digitGapPx: 6,     // between two card digits of one number
    },
    clockAddMs: 5000,
    carryTime: false,  // ~N0302
    roundCardMs: 1600,  // ~N0303
    musicKey: 'musicTimeAttack',  // ~N0304 ⚠N0305 ⚠N0306
    plateRate: 2,
    inBeatMs: 1100,  // ⚠N0307 ⚠N0308
    ENTRY: [  // ⚠N0309
      { ms: 1100 },                      // RODADA 01
      { ms: 1500, numAtMs: 300 },        // DESTRUA [ 8 ] MOSCAS -- see PUNCH
      { ms: 1100 },                      // VAI!
    ],
    outMs: 1200,

    pointsPerCoin: 100,  // ⚠N0310
    pointsPerRound: 1000,

    spawnFromRel: 0.58,  // ~N0311 ⚠N0312
    spawnToRel: 0.98,
    spawnTopRel: 0.14,     // fraction of the canvas the field starts at
    spawnBotRel: 0.86,     // and ends at
    respawnMs: 450,        // beat before a killed fly is replaced
    rayThickness: 14,      // Still Life's beam width
    rayDamage: 1,

    lostWord: 'PERDEU!',  // ⚠N0313 ⚠N0314 ⚠N0315 ⚠N0316
    hitVoice: false,
    GAME_H: 720,  // ⚠N0317
    planeHealth: 4,  // ⚠N0318 ⚠N0319
    flyTouchDamage: 1,  // ⚠N0320
    barrels: true,            // the feature switch; false empties the stream  ⚠N0321
    barrelHardFilter: 'brightness(0.85)',  // ⚠N0322
    barrelHardChance: 0.35,  // ⚠N0323
    barrelFirstMs: 2200,  // ~N0324
    barrelEveryMs: 1700,
    barrelEveryVarMs: 700,
    barrelMax: 3,  // ⚠N0325
    barrelSpeed: 312,  // ⚠N0326
    barrelSpeedVar: 0,  // ⚠N0327
    barrelSpinChance: 0.5,  // ⚠N0328
    barrelSpinMs: 1407,  // ⚠N0329
    barrelSpinVarMs: 363,
    barrelScale: 0.75,  // ⚠N0330
    barrelHitWRel: 0.85,  // ⚠N0331 ⚠N0332
    barrelHitHRel: 0.85,
    barrelBoilMs: 110,        // per frame of the 4-frame wobble
    barrelBreakMs: 260,       // the whole 3-frame smash, played ONCE
    barrelHealth: 3,  // ⚠N0333
    barrelHurtMs: 180,
    barrelHitFxSize: null,  // ⚠N0334
    barrelSpawnPadPx: 30,     // clear of the right edge, ON TOP of its half-width
    barrelCullPx: 40,         // and how far past the left edge before it is dropped
    barrelDamage: 1,          // ⚠️ one of `planeHealth` 4, same as a fly touch
    planeScale: 0.30720000000000003,  // ~N0335
    planeOffsetY: 0,
    startX: 0.35,
    startY: 0.7611111111111111,
    moveSpeed: 0.3,
    tiltMs: 110,
    planeEntry: true,
    planeEntryFromX: -0.55,
    planeEntryHoldMs: 150,
    planeEntryMs: 1035,
    stepped: false,  // ⚠N0336
    steppedMs: 43.47826086956522,
    planeHitWRel: 0.35,  // ~N0337
    planeHitHRel: 0.5,
    planeHurtMs: 1100,
    planeBlinkMs: 100,
    planeShakeAmp: 12,
    planeShakeFreq: 90,
    planeShakeMs: 260,
    planeShakeYRel: 0.55,
    planeShakeYFreqRel: 0.7,
    planeFallMaxMs: 3000,
    planeFallSpin: 2.4,
    planeFallVy0: -150,
    planeWearSheets: false,
    planeWearFilter: [],  // ⚠N0338
    planeDrainOn: false,
    planeDrainStartMs: 60000,
    planeDrainFullMs: 0,
    planeDrainMax: 0.5,
    planeDrainCurve: 1,
    GUN_FRAMES: 6,  // ~N0339
    fireMs: 70,
    gunScale: 1.3,
    gunOffX: 12,
    gunOffY: 5,
    gunOffRefScale: 0.32,
    gunAnchorX: 0.655,
    gunAnchorY: 0.564,
    rayMuzzleXRel: 0.64,  // ⚠N0340
    rayOffsetY: 15,
    FLY_RECTS: [[20, 98, 168, 181], [245, 92, 181, 192], [447, 80, 188, 222], [707, 84, 238, 225], [1002, 54, 273, 263]],  // ~N0341
    FLY_DEAD_RECT: [547, 102, 189, 178],
    flyScale: 0.06006,  // ⚠N0342 ⚠N0343
    flyHealth: 2,  // ⚠N0344
    flySpeed: 200,
    flyVSpeed: 300,
    flyHurtMs: 180,
    flyHurtAlpha: 0.35,
    flyHurtBlinkMs: 45,
    flyKnockback: 260,
    flyMaxTilt: 15,
    flyTiltEase: 9,
    flyWobbleAmp: 6,
    flyWobbleFreq: 13,
    flyRetargetMin: 0.25,
    flyRetargetMax: 0.9,
    flyLegMemory: 12,
    flyBurstMs: 70,
    flyGravity: 900,
    flyHitScale: 0.8,
    flyHitBurstFrames: 4,
    flyHitBurstMs: 70,
    flyHitBurstScale: 1,
    flyCorpseLead: 500,
    corpseBallistic: true,
    corpseTiltDeg: 25,
    corpsePlaneTop: 1.15,  // ⚠N0345
    corpsePlaneBottom: 1.3,
    COIN_CELL: 160,  // ~N0346
    COIN_FRAMES: 22,
    coinSizePx: 83.6,  // ⚠N0347
    coinHealth: 7,
    coinSpeed: 120,
    coinSpeedVar: 0,  // ⚠N0348
    coinOffscreenPx: 240,  // ⚠N0349
    coinMinGapPx: 113,  // ⚠N0350
    coinSpawnTries: 40,  // ⚠N0351
    coinHurtMs: 160,
    coinHoldMs: 60,
    coinHitScale: 0.72,
    coinHitFxFrames: 4,
    coinHitFxMs: 70,
    coinHitFxSize: 1.3,
    coinBoomSize: 1.7,
    coinSpasmMs: 140,
    coinSpasmAmp: 5,
    coinSpasmFreq: 13,
    coinSpasmScale: 0.12,
    coinBobRel: 0.05,
    coinBobMin: 6,
    coinBobFreq: 2.52,
    BOOM_RECTS: [[243, 234, 93, 86], [438, 179, 134, 134], [638, 143, 162, 156], [844, 128, 173, 158], [210, 380, 190, 162], [431, 363, 182, 164], [642, 347, 179, 155], [851, 335, 160, 151], [233, 619, 129, 120], [448, 610, 97, 112], [663, 616, 99, 84], [901, 615, 56, 67]],  // ~N0352
    boomMs: 70.9090909090909,
    bobRel: 0.05,
    bobMin: 6,
    bobFreq: 2.52,
    CH_FRAMES: 6,  // ~N0353
    CH_REST: 3,
  },

  DEV_UNLOCK: {  // ⚠N0354 ⚠N0355
    on: true,
    word: 'SABOROSA',
    label: 'SABOROSA MODE',  // ⚠N0356
  },

  VERMES: {  // ⚠N0357
    on: true,
    sheet: 'v2:beatemup-dungeon/vermes-fundo',
    track: 'v2:beatemup-dungeon/level-3-wall-track.json',
    perLeg: 58,  // ⚠N0358 ⚠N0359
    perLiftScreen: 22,  // ⚠N0360
    bands: 3,  // ⚠N0361
    bandScale: 1.0,
    yFrom: -0.32,  // ⚠N0362
    yTo: -0.06,
    jitterXRel: 0.8,  // ~N0363
    denseShare: 0.5,  // ~N0364
    boilMs: 200,  // ⚠N0365
  },

  ELEVADOR: {  // ~N0366 ⚠N0367
    liftPx: 24,  // ⚠N0368
    riseSpeed: 160,  // ⚠N0369
    standHalfRel: 0.35,  // ⚠N0370
  },

  LIFT_RIDE: {
    dropPx: 900,  // ~N0371
    descendMs: 1500,  // ⚠N0372
    arriveDropPx: 420,  // ⚠N0373
    arriveScreenX: 640,  // ⚠N0374
    boardHoldMs: 420,  // ~N0375
    risePxPerSec: 320,  // ⚠N0376
    exitPadPx: 260,  // ⚠N0377
    liftScreenX: 640,  // ⚠N0378 ⚠N0379
    markScreenX: null,  // ⚠N0380
    markGapPx: 70,
    widthPx: 960,  // ⚠N0381
    boilMs: 110,
    offsetX: 0,
  },

  PAUSE: {
    on: true,
    LINES: ['PAUSA'],  // ⚠N0382
    dimAlpha: 0.5,  // ⚠N0383

    SHEET: 'v2:beatemup-dungeon/batidao-pause-words',  // ⚠N0384
    wRel: 0.44,  // ⚠N0385
    yPct: 47,  // ~N0386
    offX: 0,
    offY: 0,
    subGapPx: 8,  // ~N0387
    subOffX: 0,
    subOffY: 0,
  },

  hitFlash: false,  // ⚠N0388

  hurtStepPx: 10,
  hurtMs: 260,            // stun + i-frames. One number, so the invulnerability
                          // is always exactly as long as the flinch showing it.
  hurtBlinkMs: 60,        // flicker period while stunned
  knockbackDecay: 6,      // 1/sec — how fast a shoved fighter comes to rest

  DEATH_THROW: { up: 190 * BODY_SCALE * 0.9, back: 440 },  // ⚠N0389
  downLandMs: 520,        // the arc, launch to floor  ~N0390
  downLieMs: 620,         // flat on the ground
  downRiseMs: 320,        // getting up — i-frames continue through this
  // How far a knocked-down fighter slides while airborne, px/sec.
  downSlideSpeed: 210,

  maxAttackers: 3,  // ⚠N0391
  enemyStandoffX: 88 * BODY_SCALE,  // ~N0392
  enemyStandoffZ: 16 * BODY_SCALE,
  // How long an enemy hangs at the stand-off before it takes a swing, once it
  // holds the token. The randomised half stops a group attacking in lockstep.
  enemyWindupMinMs: 260,
  enemyWindupMaxMs: 900,
  // Off-token enemies drift to a spot around the player rather than standing
  // still — the circling that makes a crowd read as alive.
  enemyCircleRadius: 210,
  enemyCircleSpeed: 0.9,  // rad/sec around the player
  enemyReadyRadius: 180,  // ⚠N0393
  enemyReadySpeedRel: 0.5,
  enemyRingEase: 3,  // ⚠N0394

  ENEMY_STROLL: {  // ⚠N0395
    on: true,
    everyMinMs: 4200,      // shortest gap between one enemy's strolls
    everyMaxMs: 9000,      // longest
    padPx: 110,            // how far short of the wall it stops
    maxMs: 6000,           // give up and rejoin the ring -- see the note above
    arrivePx: 46,          // close enough to call it arrived
    speedRel: 0.85,        // a wander, not a march
  },
  enemySpeedScale: { cigarro2: 0.72, cigarro: 0.88, cigarro3: 0.58,
                     // Faster than any cigarette. It is a roach; it should
                     // skitter, and the charge only reads as a charge if the
                     // walk it interrupts was already brisk.
                     barata: 1.05, barata2: 0.9,
                     // A ball with legs, and the second-quickest thing on the
                     // belt. Under the tan roach, over every cigarette: he
                     // should close the distance rather than trudge into it,
                     // because a spiky ball that plods is a pillow.
                     espeto: 0.95,
                     charutobi: 0.95 },  // ⚠N0396
  enemyDamage: { verme: 7, cigarro2: 7, cigarro: 5, cigarro3: 10, barata: 6, barata2: 8,  // ~N0397
                 espeto: 7 },  // ~N0398
  enemyReachX: 92 * BODY_SCALE,  // ⚠N0399
  enemyReachZ: 48 * BODY_SCALE,
  enemyStartupMs: 200,
  enemyActiveMs: 90,
  enemyRecoverMs: 420,

  ENEMY_COMBOS: {  // ~N0400
    cigarro: [
      { pose: 'combo1', startupMs: 200, activeMs: 90, recoverMs: 200,
        cancelMs: 0, damage: 3, reachX: 92 * BODY_SCALE, reachZ: 48 * BODY_SCALE,
        knockback: 110, lift: 0 },
      { pose: 'combo2', startupMs: 150, activeMs: 90, recoverMs: 200,
        cancelMs: 0, damage: 3, reachX: 92 * BODY_SCALE, reachZ: 48 * BODY_SCALE,
        knockback: 110, lift: 0 },
      { pose: 'combo3', startupMs: 190, activeMs: 110, recoverMs: 460,  // ~N0401
        cancelMs: 0, damage: 5, reachX: 108 * BODY_SCALE, reachZ: 48 * BODY_SCALE,
        knockback: 210, lift: 0 },
    ],
    cigarro2: [  // ~N0402
      { pose: 'combo1', startupMs: 260, activeMs: 100, recoverMs: 240,
        cancelMs: 0, damage: 4, reachX: 92 * BODY_SCALE, reachZ: 48 * BODY_SCALE,
        knockback: 130, lift: 0 },
      { pose: 'combo2', startupMs: 200, activeMs: 100, recoverMs: 240,
        cancelMs: 0, damage: 4, reachX: 92 * BODY_SCALE, reachZ: 48 * BODY_SCALE,
        knockback: 130, lift: 0 },
      { pose: 'combo3', startupMs: 240, activeMs: 120, recoverMs: 540,
        cancelMs: 0, damage: 7, reachX: 108 * BODY_SCALE, reachZ: 48 * BODY_SCALE,
        knockback: 260, lift: 0 },
    ],

  espeto: [  // ⚠N0403
    { pose: 'combo1', startupMs: 190, activeMs: 90, recoverMs: 200,
      cancelMs: 0, damage: 3, reachX: 131 * BODY_SCALE, reachZ: 48 * BODY_SCALE,
      knockback: 110, lift: 0 },
    { pose: 'combo2', startupMs: 150, activeMs: 90, recoverMs: 200,
      cancelMs: 0, damage: 3, reachX: 131 * BODY_SCALE, reachZ: 48 * BODY_SCALE,
      knockback: 110, lift: 0 },
    { pose: 'combo3', startupMs: 210, activeMs: 110, recoverMs: 420,  // ~N0404
      cancelMs: 0, damage: 5, reachX: 104 * BODY_SCALE, reachZ: 48 * BODY_SCALE,
      knockback: 200, lift: 0 },
    { pose: 'combo4', startupMs: 150, activeMs: 90, recoverMs: 200,
      cancelMs: 0, damage: 3, reachX: 131 * BODY_SCALE, reachZ: 48 * BODY_SCALE,
      knockback: 110, lift: 0 },
    { pose: 'combo5', startupMs: 240, activeMs: 120, recoverMs: 520,  // ~N0405
      cancelMs: 0, damage: 7, reachX: 124 * BODY_SCALE, reachZ: 48 * BODY_SCALE,
      knockback: 260, lift: 0 },
  ],

    barata: [  // ⚠N0406 ⚠N0407 ⚠N0408
      { pose: 'combo1', startupMs: 200, activeMs: 80, recoverMs: 170,
        cancelMs: 0, damage: 4, reachX: 104 * BODY_SCALE, reachZ: 46 * BODY_SCALE,
        knockback: 45, lift: 0 },
      { pose: 'combo2', startupMs: 190, activeMs: 80, recoverMs: 170,
        cancelMs: 0, damage: 4, reachX: 104 * BODY_SCALE, reachZ: 46 * BODY_SCALE,
        knockback: 45, lift: 0 },
      { pose: 'combo3', startupMs: 190, activeMs: 100, recoverMs: 430,
        cancelMs: 0, damage: 6, reachX: 114 * BODY_SCALE, reachZ: 46 * BODY_SCALE,
        knockback: 200, lift: 0 },
      { pose: 'combo4', startupMs: 220, activeMs: 120, recoverMs: 520,  // ⚠N0409
        cancelMs: 0, damage: 7, reachX: 114 * BODY_SCALE, reachZ: 46 * BODY_SCALE,
        knockback: 260, lift: 0 },
    ],
    // The red one: the same string played heavier, the way the stub is to
    // CIGARRO. Every window longer, every hit worth more.
    barata2: [
      { pose: 'combo1', startupMs: 250, activeMs: 90, recoverMs: 220,
        cancelMs: 0, damage: 5, reachX: 104 * BODY_SCALE, reachZ: 46 * BODY_SCALE,
        knockback: 50, lift: 0 },
      { pose: 'combo2', startupMs: 230, activeMs: 90, recoverMs: 220,
        cancelMs: 0, damage: 5, reachX: 104 * BODY_SCALE, reachZ: 46 * BODY_SCALE,
        knockback: 50, lift: 0 },
      { pose: 'combo3', startupMs: 240, activeMs: 110, recoverMs: 520,
        cancelMs: 0, damage: 9, reachX: 118 * BODY_SCALE, reachZ: 46 * BODY_SCALE,
        knockback: 240, lift: 0 },
      // The red one's fourth, heavier and slower in the same proportion the
      // other three keep. Reach is combo3's for the reason stated there: the
      // four strike drawings all reach the same distance.
      { pose: 'combo4', startupMs: 260, activeMs: 130, recoverMs: 600,
        cancelMs: 0, damage: 10, reachX: 118 * BODY_SCALE, reachZ: 46 * BODY_SCALE,
        knockback: 300, lift: 0 },
    ],

    verme: [  // ⚠N0410
      { pose: 'combo1', startupMs: 210, activeMs: 90, recoverMs: 210,
        cancelMs: 0, damage: 3, reachX: 133 * BODY_SCALE, reachZ: 48 * BODY_SCALE,
        knockback: 45, lift: 0 },
      { pose: 'combo2', startupMs: 170, activeMs: 90, recoverMs: 210,
        cancelMs: 0, damage: 3, reachX: 133 * BODY_SCALE, reachZ: 48 * BODY_SCALE,
        knockback: 45, lift: 0 },
      { pose: 'combo3', startupMs: 220, activeMs: 110, recoverMs: 430,
        cancelMs: 0, damage: 5, reachX: 131 * BODY_SCALE, reachZ: 48 * BODY_SCALE,
        knockback: 150, lift: 0 },
      { pose: 'combo4', startupMs: 170, activeMs: 90, recoverMs: 210,
        cancelMs: 0, damage: 3, reachX: 133 * BODY_SCALE, reachZ: 48 * BODY_SCALE,
        knockback: 45, lift: 0 },
      // The finisher, and the one strike whose drawing really does reach out.
      { pose: 'combo5', startupMs: 250, activeMs: 120, recoverMs: 530,
        cancelMs: 0, damage: 7, reachX: 161 * BODY_SCALE, reachZ: 48 * BODY_SCALE,
        knockback: 260, lift: 0 },
    ],

    cigarro3: [
      { pose: 'combo1', startupMs: 300, activeMs: 100, recoverMs: 280,
        cancelMs: 0, damage: 6, reachX: 92 * BODY_SCALE, reachZ: 48 * BODY_SCALE,
        knockback: 140, lift: 0 },
      { pose: 'combo2', startupMs: 240, activeMs: 100, recoverMs: 280,
        cancelMs: 0, damage: 6, reachX: 92 * BODY_SCALE, reachZ: 48 * BODY_SCALE,
        knockback: 140, lift: 0 },
      { pose: 'combo3', startupMs: 280, activeMs: 120, recoverMs: 620,
        cancelMs: 0, damage: 10, reachX: 108 * BODY_SCALE, reachZ: 48 * BODY_SCALE,
        knockback: 300, lift: 0 },
    ],
  },
  ENEMY_LEAP: {  // ~N0411
    cigarro: {
      pose: 'airPunch', startupMs: 420, activeMs: 200, recoverMs: 150,
      cancelMs: 0, damage: 6, reachX: 104 * BODY_SCALE, reachZ: 52 * BODY_SCALE,
      knockback: 300, lift: 0,
    },
    cigarro2: {  // ~N0412
      pose: 'airPunch', startupMs: 420, activeMs: 200, recoverMs: 260,
      cancelMs: 0, damage: 8, reachX: 104 * BODY_SCALE, reachZ: 52 * BODY_SCALE,
      knockback: 340, lift: 0,
    },
    cigarro3: {  // ~N0413
      pose: 'airPunch', startupMs: 420, activeMs: 200, recoverMs: 340,
      cancelMs: 0, damage: 10, reachX: 104 * BODY_SCALE, reachZ: 52 * BODY_SCALE,
      knockback: 380, lift: 0,
    },
  },
  enemyLeapChance: {  // ⚠N0414
    cigarro:  0.10,
    // The stub jumps in HALF as often. He is the slow one; a heavy fighter who
    // closes the distance as readily as the quick one is not a second enemy,
    // and the leap is the one move that hides how slowly he walks.
    cigarro2: 0.05,
    cigarro3: 0.05,  // ~N0415
    espeto:   0.10,  // ~N0416
  },
  enemyLeapMinX: 90,  // ~N0417
  enemyLeapMaxX: 520,
  enemyLeapMaxZ: 34,      // how lined up in depth he has to be before take-off
  enemyLeapLandX: 50,  // ~N0418
  enemyLeapMaxSpeed: 2.6,  // ~N0419

  HORACIO_BOSS: {  // ~N0420 ⚠N0421 ⚠N0422
    name: 'HORÁCIO',
    sheet: 'v2:beatemup-dungeon/horacio',
    health: 192,  // ⚠N0423
    enterLevel: 1,  // ~N0424
    sheetAtlases: 5,      // see manifest.js  ⚠N0425 ⚠N0426
    sizeByLevel: [324, 354, 404, 449],  // ⚠N0427
    sizePx: 354,          // the fallback, and the level he enters at
    shadow: false,  // ~N0428
    fxColour: 'yellow',  // ⚠N0429
    hurtAt: 0.5,  // ~N0430
    nakedAt: 0.25,  // ⚠N0431
    nakedLevel: 0,  // ⚠N0432
    hitPoseMs: null,  // ⚠N0433
    HIT_FX: { on: true, frameMs: null },  // ⚠N0434
    SUMMON: {  // ⚠N0435
      kind: 'charutobi',
      count: 5,  // ~N0436
      zFrom: 0.12, zTo: 0.95,
      jitterZRel: 0.07,  // ⚠N0437
      jitterXPx: 190,
      speed: null,  // ~N0438
      triggerX: 72,  // ⚠N0439
      triggerZ: 58,
      signalState: 0, signalFacing: 0,  // ⚠N0440
      signalMs: 420,     // the wind-up, in the ordinary body
      recoverMs: 600,  // ⚠N0441
      offscreenPx: 260,  // how far out they start and how far past they run
      staggerMs: 0,      // per-slot delay; the ragged arrival comes from jitterXPx
      clearY: 40,  // ⚠N0442
    },
    outFacing: 0,  // ⚠N0443
    hitWRel: 0.62,        // he is round, not long like the horse (0.86)
    hitZ: 52,
    spawnZRel: 0.62,  // ~N0444
    dieMs: 2150,  // ⚠N0445
    THEATRE: [  // ⚠N0446
      { level: 0, ms: 1000 },   // "fica como joaninha por 1 segundo"
      { level: 3, ms: 620 },    // "sai grandao"
      { level: 0, ms: 380 },    // "joaninha"
      { level: 3, ms: 620 },    // "e sai grandao"
      { level: 1, ms: 520 },    // "no final ele volta pro nível 1"
    ],
    hittableSunk: 0.6,  // ⚠N0447
    BALL: {  // ~N0448
      digMs: 480,        // going down, and balling up
      peekRiseMs: 260,   // the head coming out
      peekSunk: 0.55,    // how much of him shows while he looks about
      peekMs: 1250,      // ⚠️ the fight's one reliable opening -- see hittableSunk
      lookMs: 380,       // how long he holds each side while "olhando pros lados"
      roamSpeed: 387,    // px/s underground -- he crosses ground fast, unseen  ⚠N0449
      roamMaxMs: 1800,   // a ceiling, so an unreachable goal cannot hang the phase
      roamMinPx: 280,  // ⚠N0450
      roamSunk: 0.86,  // ⚠N0451
      bobMs: 1500,  // ⚠N0452
      bobAmp: 0.035,
      surfaceMs: 560,    // the whole climb-and-hop out of the floor  ⚠N0453
      walkMs: 1700,      // beat 7: how long he strolls before digging back in
      walkSpeed: 79,
    },
    RISE: {  // ⚠N0454
      clearAt: 0.55,  // ⚠N0455
      hopPx: 67,  // ⚠N0456
      steps: null,  // ⚠N0457
      unballAtStart: true,  // ⚠N0458
      holdMs: 500,  // ⚠N0459
    },
    LANES: [0.18, 0.5, 0.86],  // ~N0460
    CHARGE: {  // ⚠N0461
      speed: 558,
      startPad: 220,     // how far past the screen edge he surfaces to run up
      sunk: 0.38,  // ⚠N0462
      overrun: 180,      // how far past the wall he carries before digging in
      hitUpRel: 0.562,  // ⚠N0463
      hitDownRel: 0.093,
      damage: 12, knockback: 260, lift: 0, knockdown: true,
    },
    STAB: {  // ~N0464
      level: 3,          // he does it as the grandao -- the spikes are the move
      standOff: 90,      // how far to the side of the player he surfaces
      riseMs: 300, activeMs: 220, recoverMs: 420,
      reachX: 96, reachZ: 62,
      damage: 14, knockback: 200, lift: 0, knockdown: false,
    },
    DEATH_BOOM: {  // ⚠N0465 ⚠N0466 ⚠N0467
      on: true,
      count: 8,  // ~N0468
      startMs: 800,  // ⚠N0469
      everyMs: 55,  // ⚠N0470
      spreadXRel: 0.42,  // ⚠N0471
      spreadYRel: 0.58,
      baseYRel: 0.16,  // ~N0472
      sizePx: 240,  // ~N0473
      sizeJitter: 0.28,
      vanishAt: null,  // ⚠N0474 ⚠N0475
    },
    DEATH_FUSE: {  // ⚠N0476
      ms: 40,  // ~N0477
      tint: 'brightness(0) invert(24%) sepia(100%) saturate(4000%) ' +
            'hue-rotate(-8deg) brightness(110%)',
      tintAlpha: 0.85,
    },
    WEIGHTS: { charge: 0.4, stab: 0.22, summon: 0.22, walk: 0.16 },
    FACING_DEG: [0, 45, 90, 135, 180, 225, 270, 315],  // ⚠N0478
  },

  LEVEL3: {
    on: true,
    plateSource: 'level3Plate',  // ~N0479
    bandGapPx: 4000,  // ~N0480
    startInsetPx: 200,  // ~N0481
    landingInsetPx: 300,  // ⚠N0482
    boardWalk: true,  // ⚠N0483
    legs: [
      { kind: 'walk', dir: +1, px: 3647, film: [0.00, 18.98],  // ⚠N0484
        arena: { atRel: 0.50, enemies: [  // ⚠N0485
          { kind: 'verme',   sx: 980,  z: 150 },
          { kind: 'verme',   sx: 1120, z: 70,  delayMs: 900 },
          { kind: 'barata',  sx: 1040, z: 30,  delayMs: 2600 },  // ~N0486
          { kind: 'barata2', sx: 240,  z: 180, delayMs: 4200, from: 'behind' },
        ] } },
      { kind: 'lift', sec: 13.67, film: [18.98, 32.65],  // ⚠N0487
        riders: [  // ⚠N0488
          { kind: 'verme', sx: 880, z: 110, from: 'sky', delayMs: 400 },
        ] },
      { kind: 'walk', dir: -1, px: 5515, film: [32.68, 46.96],
        arena: { atRel: 0.50, enemies: [  // ⚠N0489
          { kind: 'verme',   sx: 300,  z: 150 },
          { kind: 'verme',   sx: 160,  z: 70,  delayMs: 800 },
          { kind: 'verme',   sx: 980,  z: 110, delayMs: 2200, from: 'behind' },
          { kind: 'barata',  sx: 1060, z: 40,  delayMs: 3600 },  // ⚠N0490
          { kind: 'barata2', sx: 420,  z: 180, delayMs: 5200, from: 'behind' },
        ] } },
      { kind: 'lift', sec: 8.21, film: [46.99, 55.20] },
      { kind: 'walk', dir: +1, px: 3390, film: [55.23, 73.97],
        arena: { atRel: 0.88, enemies: [
          { kind: 'verme',   sx: 980,  z: 150 },
          { kind: 'verme',   sx: 1120, z: 60,  delayMs: 700 },
          { kind: 'verme',   sx: 300,  z: 110, delayMs: 2000, from: 'behind' },
          { kind: 'barata',  sx: 1060, z: 30,  delayMs: 3400 },  // ⚠N0491
          { kind: 'barata2', sx: 220,  z: 180, delayMs: 5000, from: 'behind' },
        ] } },
    ],
    platform: {  // ⚠N0492
      sheet: 'v2:beatemup-dungeon/elevador',
      widthPx: 960,      // the NEAR LIP's width on screen; the one size knob
      offsetX: 0,
      standHalfRel: 0.35,// how much of that width he may stand on, each way
      boilMs: 110,  // ~N0493
      camStillPx: 0.05,  // ~N0494
    },
  },

  SCENERY: {  // ⚠N0495
    on: true,
    DENSE: {  // ⚠N0496
      on: true,
      extraRows: 16,   // against the field's 10, and interleaved between them
      spacing: 0.5,  // ⚠N0497
    },
    sheet: 'v2:beatemup-dungeon/cigarros-fundo',  // ~N0498
    rows: 10,          // rows of drifts across the belt's depth -- the COVERAGE dial
    bands: 5,  // ⚠N0499
    spacing: 1.25,  // ⚠N0500 ⚠N0501
    zJitter: 60,       // px, so the rows do not read as stripes
    zFrom: 0.12,  // ~N0502 ⚠N0503
    zTo: 1.10,
    marginPx: 1000,  // ~N0504 ⚠N0505
    parallax: {  // ~N0506
      on: true,
      rates: [0.75, 0.81, 0.87, 0.94, 1.00],  // ⚠N0507
    },
    bandScale: [1.00, 1.025, 1.05, 1.075, 1.10],  // ⚠N0508
    bandOffsetZ: [0.20, 0.20, 0.20, 0.20, 0.20],  // ⚠N0509
    backLayer: {  // ⚠N0510
      on: true,
      rows: 2,
      zFrom: 0.25,  // ~N0511 ⚠N0512
      zTo: 0.45,
      zJitter: 0,
      parallax: 0.70,  // ⚠N0513
      scale: 1.00,  // ~N0514
      spacing: 1.25,  // ~N0515
    },
  },

  SKY_FALL: {  // ⚠N0516 ⚠N0517
    on: true,
    fromPx: 760,
    ms: 800,  // ⚠N0518
  },

  EMERGE: {
    on: true,
    heaveMs: 380,  // ~N0519
    riseMs: 560,  // ⚠N0520
    stepPx: 34,  // ⚠N0521
    hopPx: 26,  // ⚠N0522
    clearAt: 0.55,
    holdFrame: 2,  // ⚠N0523
    boomFrom: 5,  // ⚠N0524
    boomSizePx: 200,
    boomStride: 2,  // ⚠N0525
    steps: 6,  // ⚠N0526
    boomDelayMs: 7,  // ⚠N0527 ⚠N0528
    boomAtMs: 395,  // ⚠N0529
    settleMs: 420,  // ~N0530
    holeW: 31.2,  // ⚠N0531 ⚠N0532
    holeH: 10.2,
    holeAlpha: 0.62,
    holeColor: '#241609',  // ~N0533

    spawnBehindScenery: true,  // ⚠N0534
    minBandsInFront: 1,  // ⚠N0535
    maxBandsInFront: 3,
  },

  DEATH_BURST: {  // ⚠N0536
    espeto: {  // ⚠N0537
      from: 6,  // ⚠N0538
      hideBurst: true,  // ⚠N0539
      ms: [140, 210, 294, 224],  // ~N0540
      shudder: {  // ⚠N0541
        pose: 'airPunch', from: 5, to: 6, ms: 40, holdMs: 800,  // ⚠N0542
        tint: 'brightness(0) invert(24%) sepia(100%) saturate(4000%) ' +  // ⚠N0543
              'hue-rotate(-8deg) brightness(110%)',
        tintAlpha: 0.85,
      },
    },

    charutobi: {  // ⚠N0544
      from: 3,  // ⚠N0545
      ms: [60, 80, 110],  // ⚠N0546
      hideAfterRow: true,  // ⚠N0547
      shudder: {  // ⚠N0548
        from: 1, to: 2, ms: 40, holdMs: 800,  // ⚠N0549
        tint: 'brightness(0) invert(24%) sepia(100%) saturate(4000%) ' +  // ~N0550
              'hue-rotate(-8deg) brightness(110%)',
        tintAlpha: 0.85,
      },
    },
  },

  DEATH_BOOM: {  // ⚠N0551
    espeto: {
      on: true,
      count: 1,  // ~N0552
      atFrame: 6,  // ~N0553
      spreadXRel: 0,  // ~N0554
      spreadYRel: 0,
      jitterRel: 0,
      baseYRel: 0.5,  // ~N0555
      refPx: 180,  // ⚠N0556
      sizePx: 208,  // ⚠N0557
      sizeJitter: 0,
    },

    charutobi: {  // ~N0558
      on: true,
      count: 1,
      atFrame: 3,  // ⚠N0559 ⚠N0560
      spreadXRel: 0,
      spreadYRel: 0,
      jitterRel: 0,
      baseYRel: 0.46,  // ⚠N0561
      refPx: 115,
      sizePx: 193,  // ⚠N0562
      sizeJitter: 0,
    },
  },

  DEATH_BLAST: {  // ⚠N0563
    espeto: {
      atBoomPeak: true,  // ⚠N0564 ⚠N0565
      activeMs: 300,      // live across frames 7 and 8, the two widest
      damage: 8,
      reachX: 187 * BODY_SCALE,  // ~N0566
      reachZ: 63 * BODY_SCALE,
      knockback: 240,
      knockdown: true,
      radial: true,
    },

    charutobi: {  // ⚠N0567
      atFrame: 4,  // ⚠N0568 ⚠N0569
      activeMs: 200,  // ⚠N0570
      damage: 12,  // ~N0571
      reachX: 174 * BODY_SCALE,  // ⚠N0572
      reachZ: 59 * BODY_SCALE,
      knockback: 280,
      knockdown: true,
      radial: true,  // ~N0573
    },
  },

  enemyComboWeights: {
    cigarro:  [4, 3, 3],
    espeto:   [5, 3, 2, 1, 1],  // ⚠N0574
    // The stub leans SHORTER. His hits cost more and commit him for longer, so
    // a full string from him is a bigger promise than the white one's -- at the
    // same weights he would be reliably worth more than his 40 HP is meant to
    // buy, and the fights he opens would swing on whether he happened to roll
    // three.
    cigarro2: [5, 3, 2],
    cigarro3: [5, 3, 2],  // ⚠N0575
    barata:  [2, 3, 4, 4],  // ~N0576 ⚠N0577
    barata2: [3, 3, 4, 4],
    verme:   [5, 3, 2, 1, 1],  // ⚠N0578
  },
  BARATA_CHARGE: {  // ⚠N0579
    // Per TURN, not per frame -- same rule as enemyLeapChance, and the same
    // trap if it is ever read anywhere else.
    chance:      { barata: 0.154, barata2: 0.112 },  // ~N0580
    curlMs:      260,  // ⚠N0581
    speed:       3.4,        // x walk speed. Nothing outruns it; step aside.
    damage:      { barata: 12, barata2: 15 },
    reachX:      74 * BODY_SCALE,
    reachZ:      44 * BODY_SCALE,
    knockback:   420,
    knockdown:   true,       // it bowls the player over, which is the point
    // How far past the arena wall he must get before he counts as gone.
    exitMarginPx: 180,
    // Off-screen, out of the fight. Then he walks back in from that same side.
    returnMs:    { barata: 1500, barata2: 2100 },
    minX:        150,  // ~N0582
    maxX:        620,
  },

  SUICIDE_RUSH: {  // ⚠N0583
    charutobi: {
      speed: 1.7,  // ⚠N0584 ⚠N0585
      triggerX: 24,  // ⚠N0586
      triggerZ: 34,
    },
  },

  // Enemies spawn by WALKING IN from the nearest side of the screen rather
  // than appearing — a fighter that materialises in front of the player reads
  // as a bug even when it is the design.
  enemyEnterMs: 500,

  FLIES: {  // ⚠N0587
    on: true,  // ~N0588
    SHEET: 'v2:flying-dungeon/enemy-sheets/saborosa-mosca.png',  // ~N0589
    RECT: [20, 98, 168, 181],
    count: 2,  // ⚠N0590
    countRight: 1,  // ⚠N0591
    sizePx: 39,  // ⚠N0592
    sizeJitter: 0.12,        // +/- this fraction, rolled once per fly -> 34..44px
    topY: 64,  // ~N0593
    bottomY: 404,
    speed: 118,  // ~N0594
    vSpeed: 165,             // vertical dart speed -- what makes it erratic
    retargetMin: 0.22,       // s -- shortest hold before a new heading
    retargetMax: 0.85,       // s -- longest
    wobbleAmp: 4,            // px -- the fast micro-buzz on top of the wander
    wobbleFreq: 13,          // rad/sec
    maxTilt: 15,             // deg -- bank at full vertical speed
    tiltEase: 9,             // how fast the bank eases toward the heading (1/s)
    marginPx: 140,  // ~N0595
    alpha: 0.92,             // a touch back, so they sit INTO the plate
  },

  MOSCA_SHEETS: [  // ~N0596
    'v2:flying-dungeon/enemy-sheets/saborosa-boss-mosca-01.png',
    'v2:flying-dungeon/enemy-sheets/saborosa-boss-mosca-02.png',
  ],
  MOSCA_NAME: 'NARUTÃO',  // ⚠N0597
  MOSCA_CYCLE: [0, 1, 0],
  moscaFlapMs: 90,
  MOSCA_RECTS: [  // ~N0598
    [  57, 38, 253, 265],   // profile, facing LEFT
    [ 323, 38, 212, 265],
    [ 570, 38, 176, 265],
    [ 823, 38, 188, 265],   // head-on
    [1068, 38, 176, 265],
    [1278, 38, 212, 265],
    [1504, 38, 252, 265],   // profile, facing RIGHT
  ],
  MOSCA_REF_H: 265,

  // Drawn height in the fixed canvas. Fighters are 152, so at 230 it is half as
  // tall again as the thing fighting it — big enough to read as a boss without
  // filling the belt it has to move along.
  flyBossDeathBoom: {  // ~N0599 ⚠N0600
    on: true,
    count: 5,
    startMs: 0,
    everyMs: 165,
    spreadXRel: 0.45,
    spreadYRel: 0.6,
    sizePx: 170,
    sizeJitter: 0.3,
    fadeMs: 560,  // ~N0601
  },

  HORSE_BOSS: {  // ⚠N0602
    sizePx: 319,  // ~N0603
    health: 150,  // ⚠N0604
    hurtMs: 150,           // i-frames, same as the Mosca. Never optional.
    shadow: false,  // ~N0605
    hitWRel: 0.86,  // ~N0606
    hitZ: 52,
    knockback: 30,         // barely shoved; he outweighs everything in the game

    // --- Arriving ------------------------------------------------------------
    enterMargin: 240,      // px beyond the view edge he starts from  ~N0607
    enterSpeed: 260,  // ~N0608

    // --- Choosing what to do -------------------------------------------------
    ACTIONS: { charge: 60, kick: 50, approach: 50 },  // ⚠N0609
    chargeNearWeight: 0.35,  // ⚠N0610
    chargeFarRange: 600,
    chargeCooldownFarScale: 0.2,  // ⚠N0611
    chargeCooldownMs: 2400,  // ⚠N0612
    approachStopMin: 165,  // ⚠N0613
    approachStopMax: 340,
    approachMinTravel: 95,  // ⚠N0614
    approachMs: 1800,
    approachMaxMs: 2400,  // ~N0615

    // --- The rhythm ----------------------------------------------------------
    walkSpeed: 92,
    trotSpeed: 200,
    idleMs: 620,           // the breath between passes, stood in the turn row
    // trotMs: 1500,
    kickRange: 210,  // ~N0616 ~N0617
    chargeMinRange: 240,  // ⚠N0618

    // --- The charge ----------------------------------------------------------
    chargeTellMs: 420,     // stood still, facing you. The only warning.
    chargeSpeed: 520,      // faster than the player runs. Step out of the lane.
    chargeMaxMs: 2200,     // a fuse, for the case where he cannot reach the edge
    chargeDamage: 16,
    chargeReachX: 229,  // ⚠N0619
    chargeReachZ: 52,
    chargeKnockback: 480,
    chargeKnockdown: true, // it bowls you over, which is the whole point
    chargeOverrun: 90,  // ~N0620

    // --- The kick ------------------------------------------------------------
    kickTellMs: 260,  // ~N0621
    kickActiveMs: 180,
    kickRecoverMs: 420,
    kickDamage: 14,
    kickReachX: 355,  // ⚠N0622
    kickReachZ: 50,
    kickKnockback: 420,
    kickKnockdown: true,

    // --- Turning -------------------------------------------------------------
    turnMs: 460,           // seven frames of coming about. See the warning above.

    // --- Animation -----------------------------------------------------------
    runMs: 52,  // ~N0623
    trotAnimMs: 62,
    walkAnimMs: 84,
    kickAnimMs: 62,

    // --- Dying ---------------------------------------------------------------
    dieMs: 2000,  // ~N0624 ⚠N0625
    dieTipRad: 1.15,  // ⚠N0626
    DEATH_BOOM: {  // ⚠N0627
      on: true,
      count: 7,
      startMs: 0,  // ⚠N0628
      everyMs: 180,
      spreadXRel: 0.55,  // ~N0629
      spreadYRel: 0.75,
      sizePx: 210,  // ~N0630
      sizeJitter: 0.3,     // +/- this fraction, per blast
      fadeMs: 620,  // ~N0631
    },
  },

  flyBossSizePx: 304,
  flyBossHealth: 110,  // ⚠N0632
  flyBossHurtMs: 150,        // i-frames. Never optional — see the note on hurtMs.
  flyBossHitWRel: 0.62,      // hurtbox width, × flyBossSizePx. Fixed, not the
                             // pose's own silhouette: the turn takes it from
                             // 253px to 176px wide, and a box that breathed with
                             // that would make it a harder target as it turned.
  flyBossHitZ: 46,           // ...and its depth on the belt
  flyBossKnockback: 40,      // barely shoved: it outweighs a fighter, and a boss
                             // a combo could push around would never finish a move

  flyBossTurnMs: 380,  // ~N0633

  flyBossEnterMargin: 260,   // px beyond the view edge it starts from  ~N0634
  flyBossAmbushDamage: 0,  // ~N0635
  flyBossAmbushLift: 150,    // how high the knockdown throws them
  flyBossDescendSpeed: 430,  // beat two: down the middle. Slower — this beat is
                             // the arrival, not the threat
  flyBossDescendFromY: 620,  // altitude it reappears at, above the canvas top

  flyBossAttacks: ['swoop', 'sweep'],  // ~N0636

  flyBossHoverY: 150,        // rest altitude. ABOVE a standing punch (see the
                             // 70px vertical tolerance in combat.js) but inside
                             // the apex of a jump — that gap is the skill window
  flyBossHoverSpeed: 120,
  flyBossHoverMs: 1500,      // the rest beat before it winds up again
  flyBossTellY: 210,         // it RISES to telegraph: the only warning given
  flyBossTellMs: 620,
  flyBossFaceSpanX: 520,     // px of offset that turns it fully to profile

  flyBossSwoopSpeed: 560,
  flyBossSwoopY: 16,         // bottoms out just off the floor — which is also
                             // exactly when it becomes easy to punch
  flyBossSwoopMaxMs: 1400,   // a fuse, in case the aim point is unreachable
  flyBossSwoopDamage: 12,
  flyBossRecoverMs: 700,
  flyBossTouchKnockback: 260,

  flyBossFleeY: 330,         // altitude it breaks off to -- out of reach, in shot  ~N0637
  flyBossFleeSpeed: 620,     // top speed of the exit: quicker than a hover drift
  flyBossFleeAccelMs: 400,   // ...ramped into, so it reads as turning tail
  flyBossFleeMaxMs: 4000,  // ~N0638

  flyBossSweepSetSpeed: 620, // moving to the starting corner  ~N0639
  flyBossSweepHoldMs: 420,   // the pause on the floor before it goes
  flyBossSweepSpeed: 980,    // and then it is faster than the player can run
  flyBossSweepOverrun: 220,  // px past each edge, so it enters and leaves clean
  flyBossSweepDamage: 18,    // it hurts more than the dive, because it is harder
                             // to be caught by and easier to read

  flyBossFallSpeed: 240,     // out of the sky when killed
  flyBossBobFreq: 2.6,       // rad/sec — quicker and lighter than a fighter's
  flyBossBobAmp: 9,
  // Its health bar: the same hand-drawn bar, top-centre and wider than the
  // player's, which is how the flying dungeon stages a boss too.
  flyBossBarWRel: 0.34,
  flyBossBarTop: 26,
  bossNameSizeRel: 0.62,  // x hudSize (26) -> ~16px  ⚠N0640
  bossNameGap: 4,         // px below the bar

  // --- Gates ---------------------------------------------------------------
  gateMarginX: 40,        // px inside the view edge the wall sits  ~N0641

  // --- HUD -----------------------------------------------------------------
  hudFont: 'Futura, "Futura PT", "Century Gothic", "URW Gothic", "Trebuchet MS", sans-serif',
  hudColor: '#FAFA24',
  hudSize: 26,
  hudMargin: 22,
  BAR_SHEET: 'v2:flying-dungeon/saborosa-hustlebar.webp',  // ~N0642
  BAR_CELL_W: 333,
  BAR_CELL_H: 50,
  BAR_FRAMES: 23,
  lifeBarWRel: 0.24,      // of canvas width  ~N0643
  lifeBarLeft: 22,
  lifeBarTop: 18,

  // The ENEMY bars stay plain slabs — see the note in hud.js. They are ~50px
  // wide and the hand-drawn bar's 11 squares are illegible at that size.
  hudBarW: 300,
  hudBarH: 18,
  enemyBars: false,  // ⚠N0644
  enemyBarW: 62 * BODY_SCALE,
  enemyBarH: 6,
  enemyBarLift: 14 * BODY_SCALE, // px above the sprite's top
  enemyBarFadeMs: 1400,   // how long after its last hit an enemy's bar shows

  GO_SHEET: 'v2:beatemup-dungeon/saborosa-go.png',  // ~N0645 ~N0646

  GO_WORDS: {  // ⚠N0647
    on: true,
    SHEET: 'v2:beatemup-dungeon/batidao-go-words',
    wRel: 0.4576,  // ⚠N0648
  },

  title: true,           // false = straight into the fight  ⚠N0649
  TITLE_BG: 'v2:beatemup-dungeon/intro-background.jpg',

  titleDropAtMs: 0,      // when the fall starts. 0 = the first frame  ⚠N0650
  titleDropMs: 900,      // how long the fall takes  ⚠N0651
  titleBouncePx: 12,  // ⚠N0652
  titleBounceMs: 460,
  titleBounceCycles: 1.5,   // 1 = one dip and back. 2+ starts to jiggle
  titleDropFromRel: 1.0,  // ~N0653
  titleNameFadeMs: 0,    // the drop IS the entrance; 0 = no fade over it

  TITLE_NAME: 'BATIDÃO DE CÔCO',  // ~N0654
  TITLE_SUBNAME: '(BIG COCONUT BASH)',  // ~N0655
  TITLE_FONT: '"Futura Extra Bold","Futura ExtraBold","Futura Std Extra Bold",'  // ⚠N0656
            + '"Futura PT Extra Bold","Futura Bold","Futura","Futura PT",'
            + '"Futura Std","Century Gothic","URW Gothic","Jost",sans-serif',
  titleNameWeight: 900,  // ~N0657
  titleSubWeight: 400,
  titleNameLsPct: 3,  // ~N0658
  titleFauxBoldPct: 1.5,
  titleNameSize: 74,     // px on the 1280x720 canvas
  titleSubSize: 30,
  titleNameGap: 20,      // px between the two lines
  titleNameY: 0.26,      // centre of the block, as a fraction of canvas height  ~N0659
  titleNameColor: '#FAFA30',  // ~N0660
  titleFadeOutMs: 600,   // to black, once dismissed

  LETTERS: {  // ⚠N0661
    SHEET: 'v2:beatemup-dungeon/batidao-letters',
    titleWRel: 0.72,  // ~N0662
    titleYRel: 0.17,  // ⚠N0663 ⚠N0664
    subtitleYRel: 0.35,
    titleNudgePx: 24,  // ⚠N0665
    menuYRel: 0.68,      // the middle of the three items  ⚠N0666
    menuMul: 0.90,  // ⚠N0667
    itemPop: 0.10,  // ⚠N0668 ⚠N0669
    itemPopMs: 260,
    menuHoldMs: 300,  // ⚠N0670
    menuGapRel: 0.11,    // between item centres, as a fraction of canvas height
    selectedMul: 1.10,  // ⚠N0671
    menuFadeMs: 320,     // the items coming up once the name has landed
    chooseYRel: 0.11,  // ~N0672
    pickNameXRel: 0.16,  // ⚠N0673
    pickNameYRel: 0.792,  // ⚠N0674
    hudNameGap: 6,  // ~N0675
    lifeGap: 4,          // between coconuts
    lifeMul: 0.80,  // ⚠N0676
    optTitleYRel: 0.22,  // ⚠N0677 ⚠N0678
    optRowYRel: 0.50,
    optRowGapRel: 0.115,  // ⚠N0679
    credTitleYRel: 0.32,  // ~N0680
    credNamesYRel: 0.58,
  },

  OPTIONS: {  // ⚠N0681
    bars: 8,
    volume: 8,          // SFX, in bars
    music: 8,           // the music bus, in bars
  },

  titleWalk: true,  // ⚠N0682
  titleWalkAfterMs: 250,  // ~N0683 ⚠N0684
  titleWalkStartXRel: -0.12,   // off the left edge, so he walks ON
  titleWalkEndXRel: 1.12,      // and keeps going until he is clear of the right
  titleWalkExitXRel: 1.06,  // ⚠N0685
  titleWalkSpeed: 300,  // ⚠N0686
  titleWalkGroundYRel: (BELT_TOP_Y + BELT_DEPTH * PLAYER_START_ZREL) / CANVAS_H,  // ⚠N0687
  titleWalkScale: 1.0,
  titleWalkRepeatMs: 0,  // ~N0688 ⚠N0689

  SELECT: {  // ⚠N0690
    on: true,  // ~N0691
    PROMPT: 'ESCOLHA SUA FRUTA',
    nudgePx: 24,  // ⚠N0692
    // dropMs: 320,
    NONE: 'v2:beatemup-dungeon/batidao-player-select-003-game.png',  // ⚠N0693 ⚠N0694
    PICKED: {  // ⚠N0695
      coconut:       'v2:beatemup-dungeon/batidao-player-select-001-game.png',
      coconutStrong: 'v2:beatemup-dungeon/batidao-player-select-002-game.png',
    },
    LAYERS: {  // ⚠N0696
      coconut: {
        off: 'v2:beatemup-dungeon/batidao-player-select-yellow-01-game.png',
        on:  'v2:beatemup-dungeon/batidao-player-select-coco-01-game.png',
        cxRel: 0.2708, cyRel: 0.5451,
      },
      coconutStrong: {
        off: 'v2:beatemup-dungeon/batidao-player-select-yellow-02-game.png',
        on:  'v2:beatemup-dungeon/batidao-player-select-coco-02-game.png',
        cxRel: 0.7146, cyRel: 0.4899,
      },
    },
    defaultPick: 0,  // ⚠N0697
    liftMs: 520,  // ~N0698
    // A beat of empty screen between the name leaving and the prompt arriving.
    // Without it the two moves overlap and read as one lump of type passing
    // another going the other way.
    gapMs: 140,
    artFadeMs: 320,
    PUNCH: {  // ⚠N0699
      on: true,
      stampMs: 400,       // pop settle time
      pop: 0.25,          // swells to 1.25 and bounces back to ~1.0
      shakeAmp: 9,        // px at its peak, decaying linearly
      shakeMs: 180,
      shakeFreqX: 82,     // rad/sec -- the main game's numbers, unchanged
      shakeFreqY: 71,
    },
    chosenHoldMs: 500,  // ~N0700
    promptYRel: 0.11,  // ~N0701
    promptSize: 58,
    artHRel: 0.64,  // ⚠N0702
    artYRel: 0.436,  // ⚠N0703
  },

  CONTINUE: {  // ⚠N0704
    on: true,  // ~N0705
    DIR: 'v2:beatemup-dungeon/continue/batidao-continue-',
    seconds: 9,  // ~N0706
    figureMs: 380,  // ⚠N0707
    figureEndMs: 80,
    flapMs: 110,  // ⚠N0708
    deadHoldMs: 2600,  // ⚠N0709
    deadLightMs: 2000,  // ⚠N0710
    deadLightFrom: 0.55,
    deadLightTo: 1.35,
    deadPunch: -0.10,  // ⚠N0711
    deadPunchMs: 400,
    deadPunchSplit: 0.5595,   // the empty column between figures and number
    deadPunchCX: 0.3009,      // the figures' ink centre, x
    deadPunchCY: 0.5282,      //   ...and y
    lives: null,          // null = CONFIG.playerLives  ~N0712
    veilAlpha: 0.50,  // ⚠N0713 ⚠N0714
    fadeInMs: 250,  // ⚠N0715
    hRel: 0.90,  // ~N0716
    yRel: 0.52,
  },

  VERMIN_FRAMES: [  // ⚠N0717
    'v2:flying-dungeon/game-over/saborosa-natureza-vermes-001.webp',
    'v2:flying-dungeon/game-over/saborosa-natureza-vermes-002.webp',
    'v2:flying-dungeon/game-over/saborosa-natureza-vermes-003.webp',
  ],

  LOGO: {  // ⚠N0718
    on: true,
    onRestart: false,  // ⚠N0719
    onClear: true,
    SHEET: 'v2:flying-dungeon/saborosa-logo.webp',
    wRel: 0.52,        // logo width as a fraction of the canvas. Still Life's
    yRel: 0.5,         // and its centre, down the canvas
    holdMs: 3000,      // it leaves on its own after this. 0 = wait for a press
    armMs: 250,        // before a press counts -- see the note in logo.js
    fadeInMs: 400,     // up out of the loading bar's black
    fadeOutMs: 600,    // down into the title screen
  },  // ~N0720

  GAME_OVER: {  // ⚠N0721
    on: true,
    holdsMs: [105, 105, 105],   // ~9.5fps, looping 1-2-3
    fadeOutMs: 900,             // the fight dipping to black
    holdMs: 350,                // black, before the panel
    fadeInMs: 900,              // the panel arriving
    armMs: 500,                 // after the word is up, before a press counts
    title: {  // ⚠N0722
      SHEET: 'v2:beatemup-dungeon/batidao-gameover-words',
      wRel: 0.80,        // the WIDEST phrase, as a fraction of canvas width
      sizePct: 20.4,     // % of canvas height -- the TYPE fallback only
      yPct: 50,          // vertical middle of the text, down the canvas
      lsPct: 3,          // letter spacing, % of font size
      gapPct: 20,        // between words, if it ever has more than one
      fauxBold: 1.5,     // extra weight as a stroke, % of font size
      color: '#FAFA30',  // that game's yellow
      weight: 900,
      d1: 1100,          // ms into the panel before the word shows
      d2: 700,           // ...and before a second word, if there is one
      revealMs: 0,       // 0 = hard pop
      offX: 0, offY: 0,
    },
  },

  ENDING: {  // ⚠N0723
    BG: 'v2:beatemup-dungeon/ending-background.jpg',
    fadeInMs: 700,        // the plate coming up out of the outro's black
    startXRel: -0.10,  // ~N0724
    stopXRel: 0.5,        // the middle
    walkSpeed: 210,       // px/s
    groundYRel: 0.93,  // ~N0725 ⚠N0726
    scale: 1.0,  // ⚠N0727
    poseHoldMs: 2500,  // ⚠N0728
  },

  BOOM_SHEET: 'v2:flying-dungeon/saborosa-boom.webp',  // ⚠N0729
  BOOM_RECTS: [
    [243, 234,  93,  86],
    [438, 179, 134, 134],
    [638, 143, 162, 156],
    [844, 128, 173, 158],
    [210, 380, 190, 162],   // widest -- the peak, and what `sizePx` measures
    [431, 363, 182, 164],
    [642, 347, 179, 155],   // spans a detached debris fleck at x 808
    [851, 335, 160, 151],
    [233, 619, 129, 120],
    [448, 610,  97, 112],
    [663, 616,  99,  84],   // spans a second fleck at x 920
    [901, 615,  56,  67],
  ],
  boomMs: 78 / 1.1,  // ~N0730

  MUSIC_TRACK: 'v2:beatemup-dungeon/soundtrack/Arrocha da Serpente.mp3',  // ⚠N0731 ⚠N0732
  musicVolume: 0.55,

  TITLE_TRACK: 'v2:beatemup-dungeon/soundtrack/Coco Nha Nha.mp3',  // ⚠N0733 ⚠N0734

  MUSIC_TRACKS: {  // ⚠N0735
    musicDesert: 'v2:beatemup-dungeon/soundtrack/Sucuri - Samuraio.mp3',  // ⚠N0736
    musicTimeAttack: 'v2:beatemup-dungeon/soundtrack/Dance Saborosa.mp3',  // ⚠N0737
    musicLevel3: 'v2:beatemup-dungeon/soundtrack/Cumbia Corazon - 09-07-26.mp3',  // ⚠N0738
    musicEnding: 'v2:beatemup-dungeon/soundtrack/Pode Me Chamar - Rasteirinha.mp3',  // ⚠N0739
  },

  MUSIC_LAYERS: {},  // ⚠N0740 ⚠N0741


  MUSIC_LOOP: {
  },  // ⚠N0742 ⚠N0743 ⚠N0744

  BOSS_TRACK: 'v2:beatemup-dungeon/audio/song-enmakun2011.mp3',  // ⚠N0745

  MUSIC_GAIN: {  // ⚠N0746 ⚠N0747
    music: 0.72,  // ~N0748 ⚠N0749
    musicBoss: 0.85,
    musicTitle: 0.92,  // ⚠N0750
    musicDesert: 0.97,  // ⚠N0751 ⚠N0752
    musicLevel3: 0.72,
    musicTimeAttack: 0.72,  // ⚠N0753
    musicEnding: 0.92,  // ~N0754
  },  // ⚠N0755

  SFX: {  // ⚠N0756
    hit: 'v2:beatemup-dungeon/audio/sfx/single-hit.ogg',
    comboFinish: 'v2:beatemup-dungeon/audio/sfx/combo-finish.ogg',  // ~N0757
    coin: 'v2:beatemup-dungeon/audio/sfx/coin-tick.ogg',  // ~N0758
    enemyHit: 'v2:beatemup-dungeon/audio/sfx/enemy-hit-1.ogg',  // ⚠N0759
    playerHit: 'v2:beatemup-dungeon/audio/sfx/enemy-hit-3.ogg',  // ⚠N0760
    playerDeath: 'v2:beatemup-dungeon/audio/sfx/player-death.ogg',  // ~N0761
    enemyDeath: 'v2:beatemup-dungeon/audio/sfx/enemy-death.ogg',  // ~N0762
    gameOver: 'v2:flying-dungeon/audio/game-over.ogg',  // ⚠N0763 ⚠N0764
    up: 'v2:flying-dungeon/audio/efeito-pra-cima-01.ogg',  // ⚠N0765 ~N0766
    down: 'v2:flying-dungeon/audio/efeito-pra-baixo-01.ogg',
    gun: 'v2:flying-dungeon/audio/efeito-metralha-01.ogg',
    coinHit: 'v2:flying-dungeon/audio/coin-hit-01.ogg',  // ~N0767
  },
  sfxVolume: 0.567,  // ⚠N0768 ⚠N0769

  SFX_GAIN: {  // ⚠N0770
    comboFinish: 1.2,      // the last hit of a string reads as the biggest one
    gameOver: 0.74,  // ⚠N0771
    coin: 0.156,  // ⚠N0772
    enemyHit: 0.7,  // ~N0773
    playerHit: 0.7,  // ⚠N0774 ~N0775
    playerDeath: 0.47,  // ⚠N0776
    enemyDeath: 0.7,  // ~N0777
    up: 0.426,  // ⚠N0778 ⚠N0779
    down: 0.426,
    gun: 0.611,  // ⚠N0780
    coinHit: 0.986,  // ⚠N0781
  },

  SFX_LOOP: {  // ⚠N0782
    gun: { loopTrimMs: 12 },
    coinHit: { loopTrimMs: 12 },
  },
  WIN_MUSIC: {  // ⚠N0783 ⚠N0784
    fadeSec: 1.2,          // the level's song rolling off across the walk-out
  },

  GAME_OVER_STING: {
    on: true,
    rate: 0.9,
    doubleDelayMs: 50,
    musicFadeSec: 0.35,    // the bed getting out of the way
  },
  sfxHitDetune: 0.045,  // ~N0785
  sfxTakeHitRate: 0.82,  // ~N0786
  PLAYER_HIT_VOICE: { on: true, sfx: 'playerHit' },  // ⚠N0787
  PLAYER_DEATH_VOICE: { on: true, sfx: 'playerDeath' },  // ⚠N0788
  goY: 198,  // ⚠N0789
  goH: 74 * 1.3 * 1.1,    // on-screen height of the GO! art; width follows aspect  ⚠N0790
  goHandH: 54 * 1.3 * 1.1,  // on-screen height of the hand; width follows its aspect
  goGap: 22,              // px between the word and the hand
  goMarginRight: 60,
  goBobFreq: 9,           // rad/sec
  goBobAmp: 8,            // px of horizontal nudge

  goBackNudgeS: 1.2,  // ~N0791 ⚠N0792
  goMs: 2600,
  goFadeMs: 400,          // the fade as it leaves; part of goMs, not extra
  goFadeSteps: 4,  // ⚠N0793

  // --- Debug ---------------------------------------------------------------
  debugColors: {  // ~N0794
    body:   'rgba(90,190,255,0.85)',
    hit:    'rgba(255,80,80,0.9)',
    belt:   'rgba(255,255,255,0.18)',
    gate:   'rgba(255,200,60,0.6)',
  },
};
