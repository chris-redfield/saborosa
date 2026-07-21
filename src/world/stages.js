/**
 * Stage definitions
 *
 * type: 'infinite' — unlimited blocks generated around the player
 * type: 'finite'   — only the listed blocks exist; lava at boundaries
 */

// Helper: build a rectangular grid of [x, y] block coords (inclusive bounds).
function rectBlocks(minX, minY, maxX, maxY) {
    const out = [];
    for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) out.push([x, y]);
    }
    return out;
}

const STAGES = {
    1: {
        id: 1,
        name: 'Endless Desert',
        type: 'infinite',
        groundColor: '#5c3317',
        rockCount: [5, 12],
        spawnX: BLOCK_W / 2 - 24,
        spawnY: BLOCK_H / 2 - 28,
        safeZone: { x: BLOCK_W / 2, y: BLOCK_H / 2, radius: 120 },
        portals: [
            { x: BLOCK_W / 2 + 80, y: BLOCK_H / 2 - 32, targetStage: 2, label: 'Sand Bank' }
        ]
    },
    2: {
        id: 2,
        name: 'Sand Bank',
        type: 'finite',
        blocks: [
            [-1, -1], [0, -1], [1, -1],
            [-1,  0], [0,  0], [1,  0],
            [-1,  1], [0,  1], [1,  1]
        ],
        walkableBlocks: [[0, 0]],
        terrainShape: 'diamond',
        sandColor: '#d4a55a',
        groundColor: '#c9a070',
        checkerboard: { tileSize: 77, color: '#b8875f', style: 'perspective' },
        terrainDepth: 30,
        rockCount: [8, 16],
        liveRocks: [
            { x: BLOCK_W / 2 , y: BLOCK_H / 2 - 250 }
        ],
        spawnX: BLOCK_W / 2 - 24,
        spawnY: BLOCK_H / 2 - 28,
        safeZone: { x: BLOCK_W / 2, y: BLOCK_H / 2, radius: 120 },
        portals: [
            { x: BLOCK_W / 2 - 160, y: BLOCK_H / 2 - 160, targetStage: 1, label: 'Desert' },
            { x: BLOCK_W / 2 + 80,  y: BLOCK_H / 2 - 160, targetStage: 3, label: 'Painted Isle' }
        ]
    },
    3: {
        id: 3,
        name: 'Painted Isle',
        type: 'finite',
        // 11x11 total, 9x9 walkable (50% bigger than the previous 6x6)
        // with a 1-block sand border on all sides.
        blocks: rectBlocks(-1, -1, 9, 9),
        walkableBlocks: rectBlocks(0, 0, 8, 8),
        terrainShape: 'diamond',
        sandColor: '#c7c4b3',
        groundColor: '#9a9a9a',
        checkerboard: { tileSize: 77, color: '#7e7e7e', style: 'perspective' },
        terrainDepth: 30,
        rockCount: [7, 14], // ~30% fewer (was [10, 20])
        // --- 4-LAYER MAP MODEL ---------------------------------------------
        // All four layers share `backgroundImageRect` (same world rect, aligned
        // pixel-for-pixel). World._normalizeLayers flattens this onto the
        // engine's fields, so legacy plumbing is untouched.
        //   zoning    — never drawn; classifies terrain zones AND drives the
        //               mountain-occlusion mask (island pixels above midline).
        //   sand      — the base ground image (later: swap `image` for a flat
        //               `color: '#c7c4b3'` to drop the layer entirely).
        //   mountains — dedicated transparent image above the sand + the source
        //               the pass-behind occlusion is built from. Commented until
        //               the new art lands; meanwhile the mountain is whatever the
        //               sand image bakes in and occlusion is derived from it.
        //   overlays  — foreground trees/plants, feet-split occlusion. Commented
        //               until the new art lands; meanwhile the nature assets are
        //               still hand-placed via `objects` below (map editor).
        // NEW-ASSET SWAP: point sand→stage3_sand, uncomment mountains+overlays,
        // and delete the `objects`/`objectDefs` manual placements below.
        layers: {
            zoning:    { image: 'stage3_zoning' },     // saborosa-elementos-zoning-000 (transparent outside island)
            sand:      { color: '#c8bb9b' },            // flat tan — was a 1-colour 5543px image (~90MB); now a solid fill
            mountains: { image: 'stage3_mountains' },   // saborosa-elementos-ilhas
            // Trees + holes + structures are ALL spawned as discrete objects from
            // `overlayObjects` below (trees/holes depth-sort with the player;
            // structures are `top` → always-on-top crops). No full-map overlay
            // blits, so nothing is drawn here.
        },
        // Per-object tree/hole placements (assets-v2/mapa/overlay-objects.json,
        // built by tools/build-overlay-objects.py). Spawned as OverlayObjects
        // that depth-sort with the player like the old hand-placed assets.
        // overlayCollision gates their footprint boxes (holes opt out per-object).
        overlayObjects: 'overlay_objects',
        overlayCollision: true,
        // Decorative SABOROSA letters (non-colliding bob/flicker). Kept after the
        // old `objects` placements were dropped — these are letters-only.
        letters: 'letters_placements',
        // Character depth perspective (assets-v2/mapa/perspective.json, authored
        // in tools/main-perspective.html). Scales the player sprite by where its
        // feet sit in the yNear..yFar world band; movement/collision stay flat.
        perspective: 'perspective',
        mountainOcclusion: true,
        // Hand-placed enemies + live rocks, authored in tools/enemy-placement.html
        // and exported to assets/enemy-placements.json. Each entry is
        // { type, x, y } (top-left world coords). The four dynamic enemies —
        // coconut/rock/bush/phone — are instantiated at those exact spots in
        // main.js; `liverock` entries are static obstacles spawned into world
        // blocks (see world.js). (Replaces the old random `enemies:[{type,count}]`
        // ring-spawn — enemies are now positioned deliberately.)
        enemyPlacements: 'enemy_placements',
        // Dungeon interior reached by falling into a hole (see dungeon.js). The
        // perspective params default from the tuning tool; override here if needed.
        // statueBoxes = cat-furnace collision, authored in tools/dungeon-perspective.html
        // (Cat Collision tab): a body box on the back wall + two paw boxes poking forward.
        dungeon: {
            bg: 'dungeon_bg', nativeW: 1022, nativeH: 819,
            // Perspective override. perspLock:false makes the game honor the
            // explicit fracFar (sprite size far) instead of back-computing it from
            // the floor geometry — matches the tool with "lock far size" UNCHECKED,
            // so the character no longer shrinks too much at the back wall.
            perspective: { perspLock: false, fracNear: 0.160, fracFar: 0.08 },
            statueBoxes: [
                { name: 'body',  tMin: 0.85, tMax: 1.00, lMin: -0.42, lMax: 0.50 },
                { name: 'paw L', tMin: 0.80, tMax: 0.90, lMin: -0.42, lMax: -0.14 },
                { name: 'paw R', tMin: 0.80, tMax: 0.90, lMin: 0.22, lMax: 0.50 },
            ],
            // Mouth feed target on the back wall (bg-normalized screen rect),
            // authored in the tool's Cat Collision tab. Throw the barrel through
            // here → explosion + a letter drops at the barrel's spawn spot →
            // collect it to iris-wipe back to the overworld. See dungeon.js.
            mouthRect: { x: 0.469, y: 0.524, w: 0.074, h: 0.074 },
        },
        // A SECOND dungeon reached by a different hole (target: 'tiled'). Instead
        // of the perspective room, this is an "infinite" top-down floor: one
        // square tile repeated forever, character drawn at a CONSTANT size (see
        // screens/tiledungeon.js). Tune tile/character size via tileScale/charScale.
        dungeonTiled: {
            name: 'Bone Pit', tile: 'dungeon_tile',
            // tileScale ≈ the stage-3 map's own draw scale (world px per native
            // px = backgroundImageRect.w / 5543 = 8815/5543 = 1.5903), dialled
            // back 20% (× 0.8) to taste → 1.2722. Drawing the tile at ~this scale
            // gives the dungeon roughly the SAME on-screen detail density as the
            // overworld: one screen is a *piece* of a single tile (each tile
            // bigger than the screen), not a field of little repeats. NOTE: the
            // shipped tile is low-res (820×1169, "escaladalow"), so it upscales
            // ~1.3× and reads a touch soft — dropping in a true high-res master
            // makes it sharp AND proportionally huge with no code change.
            tileScale: 1.2722, charScale: 1.0,
            // Collision footprint shrink relative to the character (−30%), so the
            // box reads like the overworld (which inflates the sprite past its
            // footprint via perspective). Lower = smaller box.
            colScale: 0.7,
            // Taut-wire rope (Mina-the-Hollower style): a straight stretched rope
            // whose anchor stays off the top of the screen (travels with the
            // camera, never a world spot). The bottom END is a floor spot near the
            // spawn — the player drops in NEXT to it (endDX/endDY offset from the
            // spawn) and presses interact (E) while touching it to grab on; grabbed,
            // the end follows the player and the down-facing poses are disabled.
            // `length` = min anchor height above the end; `width` = thickness;
            // `sway` = ambient quiver px; enabled:false removes it.
            rope: { enabled: true, length: 540, width: 15, sway: 10, endDX: 90, endDY: 0 },
            // Test boss (8-frame animated sheet, defs in assets/saborosa-boss-test-
            // defs.json). Spawns OFF-SCREEN (spawnDX far to the right of the drop-in),
            // waits chaseDelayMs, then homes STRAIGHT at the player ignoring all
            // collision (walks through rocks/skulls/bushes). speed matches the pista
            // telephone's chaseSpeed (3.45 px/frame).
            boss: { enabled: true, spawnDX: 1000, spawnDY: 0, scale: 0.7, speed: 3.45, chaseDelayMs: 3000 },
        },
        // A THIRD dungeon (target: 'tiled2') — the "pista". Same infinite top-down
        // engine as dungeonTiled, but the tile is a TRANSPARENT structure (the
        // composited pista art, cropped to its non-transparent extent) drawn over
        // a flat sand fill: `sandColor` paints the whole floor, then the tan
        // viaduct tiles over it and its transparent parts show the sand through —
        // exactly the flat-sand look of the stage-3 overworld. The tan walls/legs
        // are solid (per-tile collision); the white field + the sand gaps between
        // legs are walkable. No rope here.
        dungeonTiled2: {
            name: 'Pista', tile: 'dungeon_tile_pista',
            collision: 'dungeon_tile_pista_collision',
            // Same flat sand as the overworld ground (layers.sand.color), shown
            // above/below the bridge and through the tile's transparent parts.
            sandColor: '#c8bb9b',
            // Horizontal BRIDGE: the pista tile only connects left↔right, so it's
            // drawn as one road strip tiled in X (not a field repeating up/down).
            // The player drops onto the deck and is walled to it — he never walks
            // on the sand. deckYFrac = the deck centre as a fraction of native
            // height (white road band ≈ native Y 65–260 of 659 → centre ~0.246),
            // used to seed the camera so he lands on the road.
            horizontal: true, deckYFrac: 0.246,
            // Depth: the near/lower railing (the tan parapet below the deck, native
            // Y ≈ 260 of 659 → ~0.39) is re-drawn on top of the player, so at the
            // deck's lower edge he tucks BEHIND it. Lower this to tuck him deeper.
            railYFrac: 0.39,
            // The pista tile is wide+short (1193×659). At this scale one road
            // segment ≈ fills the view width; the deck is ~170px tall to walk in.
            tileScale: 0.87, charScale: 1.0, colScale: 0.7,
            rope: { enabled: false },
            // Roaming Telephone (same sprite pack as the overworld sand enemy),
            // spawned to the player's LEFT so he's pressured to run right down the
            // bridge. Drawn at the shared charScale so its size vs the player matches
            // the overworld. Speeds are DUNGEON-ONLY (the overworld PhoneEnemy is
            // untouched) and 50% quicker than the first pass: chase 2.3→3.45,
            // roam 2.0→3.0 px/frame — chase now edges past the player's ~3, so he
            // must juke, not just sprint. spawnDX = plane-px offset (negative = left).
            phone: { enabled: true, spawnDX: -360, spawnDY: 0, speed: 3.0, chaseSpeed: 3.45 },
        },
        // A FOURTH dungeon (target: 'fire') — the fire dungeon, reached by the
        // lower-right hole. Same infinite tiled engine and the SAME tile as the
        // Bone Pit, but `vertical: true` tiles it only up↔down: the floor is one
        // tile wide (≈1043px of the 1280 screen) and endlessly deep, walled left
        // and right, so this reads as a shaft you descend rather than open floor.
        // Keeps the Bone Pit's furniture — rope + the scattered pushable blocks.
        // The 3-frame flame band (assets-v2/saborosa-dungeon-fire-test-2.png) is
        // NOT wired yet; that's the next step.
        dungeonTiledFire: {
            name: 'Fire Shaft', tile: 'dungeon_tile',
            collision: 'dungeon_tile_collision',
            vertical: true,
            // Three tiles side by side (left / spawn / right). One tile is 1043px
            // of the 1280 canvas, so a single column left bare backdrop down both
            // edges; the flanking tiles fill it and carry the same collision.
            shaftTiles: 3,
            // Drop in mid-shaft (0.5 of the tile's native width under the feet).
            deckXFrac: 0.5,
            // Lock the camera's X: the shaft stays put on screen and the player
            // walks left/right within it, instead of the corridor sliding under a
            // pinned character. Camera still follows on Y (see freezeCamX).
            freezeCamX: true,
            // Same scales as the Bone Pit so the character reads identically.
            tileScale: 1.2722, charScale: 1.0, colScale: 0.7,
            // Same taut-wire rope as the Bone Pit — a shaft is where it belongs.
            rope: { enabled: true, length: 540, width: 15, sway: 10, endDX: 90, endDY: 0 },
            // Rising wall of fire (assets/saborosa-dungeon-fire-defs.json, frames
            // validated in tools/fire-anim.html). Starts spawnDY below the drop-in
            // — off the bottom of the screen, so he sees it arrive — and climbs at
            // `speed` px/frame forever. FIRST PASS: it only moves; it doesn't
            // collide, damage, or interact with anything yet.
            // bandWidth: null = the art at 1:1, repeated (~1.5 across the 1280
            // canvas). Set it to 1280 for ONE stretched flame — fewer, bigger
            // waves, but a 1.55x upscale visibly softens the line art.
            fire: { enabled: true, spawnDY: 900, speed: 0.6, bandWidth: null },
            // No boss/phone down here yet.
        },
        // Non-colliding trigger boxes: when the player's FEET enter one, they
        // fall into the dungeon. World-space; tune with the magenta debug box (C).
        // This first one sits on the black pit just right of the spawn approach.
        //   x, y, w, h    — the hole box; its position/size + the trigger region.
        //   triggerInset  — fraction inset of the inner "on top" trigger (0.22).
        //   vanishLine    — the horizontal line the player vanishes behind, as a
        //                   fraction of hole height (0=top, 1=bottom).
        // Turn on debug (C): magenta = hole/trigger boxes, cyan = the vanish
        // line. Tune with tools/hole-fall-test.html.
        holes: [
            {
                x: 6257, y: 3465, w: 113, h: 122, target: 'dungeon',
                triggerInset: 0.22,
                vanishLine: 0.5
            },
            // Second hole → the "infinite" tiled dungeon. Centered on the buraco
            // overlay graphic at world (4925, 3536).
            {
                x: 4865, y: 3476, w: 120, h: 120, target: 'tiled',
                triggerInset: 0.22,
                vanishLine: 0.5
            },
            // Third hole → the "pista" tiled dungeon (target: 'tiled2'). Centered on
            // the THIRD buraco overlay graphic in overlay-objects.json (the one up on
            // the plateau): its center converts through backgroundImageRect to world
            // (5678, 2850)  [cx = (nx+nw/2)*rect.w + rect.x, cy = (ny+nh/2)*rect.h].
            {
                x: 5618, y: 2790, w: 120, h: 120, target: 'tiled2',
                triggerInset: 0.22,
                vanishLine: 0.5
            },
            // Fourth hole → the fire dungeon (target: 'fire'), on the lower-right
            // plateau. Hand-placed from the debug HUD (player at world 8745,4469);
            // there's no buraco overlay graphic here yet, so this is a bare trigger.
            // Leads to `dungeonTiledFire` above (see enterDungeon in main.js).
            {
                x: 8685, y: 4459, w: 120, h: 120, target: 'fire',
                triggerInset: 0.22,
                vanishLine: 0.5
            }
        ],
        // (Decorative nature is now the `overlays` layer above — the old manual
        // map-editor placements `objects`/`objectDefs` were removed.)
        // Image AR ~1.360. Fit to 9x9 walkable height (6480px),
        // preserving aspect: w = 6480 * 1.360 = 8815. Centered horizontally
        // in the 11520-wide walkable area (margin ~1352 each side). The rect is
        // world-space, so it tracks the image's aspect ratio, not its pixel
        // resolution — the PNGs can be downscaled freely without touching this.
        backgroundImageRect: { x: 1352, y: 0, w: 8815, h: 6480 },
        // Camera zoom bands keyed off feetY (world coords). Two Y thresholds
        // → three altitude zones. As the player walks north (smaller Y) and
        // crosses a threshold, the target scale steps further out. Walking
        // south back across a threshold steps it back in. Exponential
        // smoothing makes the steps feel like an eased transition.
        cameraZoomThresholds: [5000, 2500],
        cameraZoomScales: [1.0, 0.88, 0.78],
        spawnX: 3005, // moved left off an overlay object (was 3255)
        spawnY: 4725, // 3800
        safeZone: { x: BLOCK_W * 4.5, y: BLOCK_H * 4.5, radius: 200 },
        portals: [
            { x: 8160, y: 740, targetStage: 2, label: 'Sand Bank' }
        ]
    }
};

window.STAGES = STAGES;
