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
        // TWO files only. `stage3_bg` (V2) is never drawn — it drives zone
        // classification AND the mountain-occlusion mask (island pixels above
        // the midline). `stage3_background` is the single displayed image (full
        // island + sand). `mountainOcclusion` turns on the fall-behind effect:
        // the mountain (generated in memory from the background masked by the
        // zone map) is drawn opaquely on top of the player when they're behind
        // it, so they get hidden by the mountain shape (see world/main.js).
        backgroundImage: 'stage3_bg',
        backgroundLowerImage: 'stage3_background',
        mountainOcclusion: true,
        // Decorative map assets placed via tools/map-editor.html. `objects` is
        // the loaded placements JSON key; `objectDefs` the sprite/collision defs.
        objects: 'painted_isle_objects',
        objectDefs: 'mapobject_defs',
        // Image 8314x6112 (AR ~1.360). Fit to 9x9 walkable height (6480px),
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
        spawnX: 3255, // 7900
        spawnY: 4725, // 3800
        safeZone: { x: BLOCK_W * 4.5, y: BLOCK_H * 4.5, radius: 200 },
        portals: [
            { x: 8160, y: 740, targetStage: 2, label: 'Sand Bank' }
        ]
    }
};

window.STAGES = STAGES;
