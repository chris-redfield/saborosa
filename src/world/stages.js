/**
 * Stage definitions
 *
 * type: 'infinite' — unlimited blocks generated around the player
 * type: 'finite'   — only the listed blocks exist; lava at boundaries
 */
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
        // 6x6 total, 4x4 walkable in the middle with a 1-block sand border
        blocks: [
            [-1, -1], [0, -1], [1, -1], [2, -1], [3, -1], [4, -1],
            [-1,  0], [0,  0], [1,  0], [2,  0], [3,  0], [4,  0],
            [-1,  1], [0,  1], [1,  1], [2,  1], [3,  1], [4,  1],
            [-1,  2], [0,  2], [1,  2], [2,  2], [3,  2], [4,  2],
            [-1,  3], [0,  3], [1,  3], [2,  3], [3,  3], [4,  3],
            [-1,  4], [0,  4], [1,  4], [2,  4], [3,  4], [4,  4]
        ],
        walkableBlocks: [
            [0, 0], [1, 0], [2, 0], [3, 0],
            [0, 1], [1, 1], [2, 1], [3, 1],
            [0, 2], [1, 2], [2, 2], [3, 2],
            [0, 3], [1, 3], [2, 3], [3, 3]
        ],
        terrainShape: 'diamond',
        sandColor: '#c7c4b3',
        groundColor: '#9a9a9a',
        checkerboard: { tileSize: 77, color: '#7e7e7e', style: 'perspective' },
        terrainDepth: 30,
        rockCount: [10, 20],
        backgroundImage: 'stage3_bg',
        // Image 4679x3624 (AR ~1.291). Fit to 4x4 walkable height (2880px),
        // preserving aspect: w = 2880 * 1.291 = 3718. Centered horizontally
        // in the 5120-wide walkable area (margin 701 each side).
        backgroundImageRect: { x: 701, y: 0, w: 3718, h: 2880 },
        spawnX: BLOCK_W * 2 - 24,
        spawnY: BLOCK_H * 2 - 28,
        safeZone: { x: BLOCK_W * 2, y: BLOCK_H * 2, radius: 200 },
        portals: [
            { x: BLOCK_W - 50, y: BLOCK_H / 2 - 200, targetStage: 2, label: 'Sand Bank' }
        ]
    }
};

window.STAGES = STAGES;
