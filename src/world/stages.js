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
        sandColor: '#d4a55a',
        groundColor: '#c9a070',
        checkerboard: { tileSize: 77, color: '#b8875f', style: 'perspective' },
        terrainDepth: 30,
        rockCount: [8, 16],
        spawnX: BLOCK_W / 2 - 24,
        spawnY: BLOCK_H / 2 - 28,
        safeZone: { x: BLOCK_W / 2, y: BLOCK_H / 2, radius: 120 },
        portals: [
            { x: BLOCK_W / 2 + 80, y: BLOCK_H / 2 - 32, targetStage: 1, label: 'Desert' }
        ]
    }
};

window.STAGES = STAGES;
