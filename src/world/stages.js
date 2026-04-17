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
        rockCount: [10, 20],
        backgroundImage: 'stage3_bg',
        // Image 4679x3624 (AR ~1.291). Fit to 9x9 walkable height (6480px),
        // preserving aspect: w = 6480 * 1.291 = 8366. Centered horizontally
        // in the 11520-wide walkable area (margin ~1577 each side).
        backgroundImageRect: { x: 1577, y: 0, w: 8366, h: 6480 },
        spawnX: BLOCK_W * 4.5 - 24,
        spawnY: BLOCK_H * 4.5 - 28,
        safeZone: { x: BLOCK_W * 4.5, y: BLOCK_H * 4.5, radius: 200 },
        portals: [
            { x: BLOCK_W - 50, y: BLOCK_H / 2 - 200, targetStage: 2, label: 'Sand Bank' }
        ]
    }
};

window.STAGES = STAGES;
