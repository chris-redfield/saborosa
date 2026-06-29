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
            sand:      { image: 'stage3_sand' },        // saborosa-elementos-sand   (later: { color: '#c7c4b3' })
            mountains: { image: 'stage3_mountains' },   // saborosa-elementos-ilhas
            // Trees + holes are spawned as DISCRETE depth-sorted objects (see
            // `overlayObjects` below) so the player passes wholly behind/in front
            // of each one — the structure layers just render flat on top.
            overlays: [
                { image: 'stage3_ovl_estruturas1', onTop: true }, // structures — always on top
                { image: 'stage3_ovl_estruturas2', onTop: true }, // structures — always on top
            ],
        },
        // Per-object tree/hole placements (assets-v2/mapa/overlay-objects.json,
        // built by tools/build-overlay-objects.py). Spawned as OverlayObjects
        // that depth-sort with the player like the old hand-placed assets.
        // overlayCollision gates their footprint boxes (holes opt out per-object).
        overlayObjects: 'overlay_objects',
        overlayCollision: true,
        // Character depth perspective (assets-v2/mapa/perspective.json, authored
        // in tools/main-perspective.html). Scales the player sprite by where its
        // feet sit in the yNear..yFar world band; movement/collision stay flat.
        perspective: 'perspective',
        mountainOcclusion: true,
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
