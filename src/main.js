/**
 * Saborosa - Main entry point
 */

let game;

const gameState = {
    player: null,
    world: null,
    currentStage: null
};

async function init() {
    console.log('Initializing Saborosa...');

    game = new Game('game-canvas');
    await game.loadAssets();

    loadStage(STAGES[2]);

    game.onUpdate = (dt) => updateGame(dt);
    game.onRender = (ctx) => renderGame(ctx);

    game.start();
    console.log('Game started! WASD to move. E near portal to travel. Hold C for debug.');
}

function loadStage(stage) {
    gameState.currentStage = stage;
    gameState.world = new World(game, stage);

    if (!gameState.player) {
        gameState.player = new Player(game, stage.spawnX, stage.spawnY);
    } else {
        gameState.player.x = stage.spawnX;
        gameState.player.y = stage.spawnY;
        gameState.player.moving = false;
        gameState.player.frame = 0;
        gameState.player.animationCounter = 0;
    }

    const bx = Math.floor(gameState.player.x / BLOCK_W);
    const by = Math.floor(gameState.player.y / BLOCK_H);
    gameState.world.loadSurrounding(bx, by);

    // Background for areas outside blocks
    game.backgroundColor = stage.sandColor || (stage.type === 'finite' ? '#0a0500' : stage.groundColor);
}

function updateGame(dt) {
    const player = gameState.player;
    const world = gameState.world;
    const obstacles = world.getObstacles();
    const movement = game.input.getMovementVector();

    // Dash
    if (game.input.isKeyJustPressed('dash')) {
        player.dash(performance.now(), movement.x, movement.y);
    }

    // Check if player is on sand
    const playerCenterX = player.x + player.width / 2;
    const playerBottomY = player.y + player.height;
    player.onSand = !world.isOnWalkableTerrain(playerCenterX, playerBottomY);

    // Movement: dash overrides normal speed, sand slows
    const speedMult = player.onSand ? player.sandSpeedFactor : 1;
    let dx, dy;
    if (player.dashing) {
        const dashVel = player.speed * player.dashSpeed * speedMult;
        dx = player.dashDirection.x * dashVel;
        dy = player.dashDirection.y * dashVel;
    } else {
        dx = movement.x * player.speed * speedMult;
        dy = movement.y * player.speed * speedMult;
    }

    player.move(dx, dy, obstacles);
    player.update(dt);
    world.update(player);

    // Portal interaction
    if (game.input.isKeyJustPressed('interact')) {
        const portal = world.getPortalAt(player);
        if (portal) {
            loadStage(STAGES[portal.targetStage]);
            game.input.clearFrameState();
            return;
        }
    }
}

function renderGame(ctx) {
    const world = gameState.world;
    const player = gameState.player;
    const camX = world.cameraX;
    const camY = world.cameraY;

    // Draw ground tiles + lava
    world.renderGround(ctx);

    // Collect all renderables, depth-sort by bottom edge
    const entities = world.getAllEntities();
    entities.push(player);
    entities.sort((a, b) => (a.y + a.height) - (b.y + b.height));

    // Render with camera offset
    for (const entity of entities) {
        const sx = entity.x - camX;
        const sy = entity.y - camY;
        if (sx + entity.width < 0 || sx > game.width ||
            sy + entity.height < 0 || sy > game.height) continue;

        entity.render(ctx, game, camX, camY);
    }

    // Stage name
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = '11px monospace';
    ctx.fillText(gameState.currentStage.name, 10, 16);

    // Dash cooldown bar
    const barX = 10, barY = 24, barW = 60, barH = 6;
    const now = performance.now();
    const cdEnd = player.dashTimer;
    const cdTotal = player.dashDuration + player.dashCooldown;
    const remaining = Math.max(0, cdEnd - now);
    const fill = 1 - remaining / cdTotal;

    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(barX, barY, barW, barH);
    ctx.fillStyle = fill >= 1 ? '#4f4' : '#2a2';
    ctx.fillRect(barX, barY, barW * fill, barH);

    // Debug overlay
    if (game.showDebug) {
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(4, game.height - 52, 340, 48);
        ctx.fillStyle = '#0f0';
        ctx.font = '12px monospace';
        const bx = Math.floor(player.x / BLOCK_W);
        const by = Math.floor(player.y / BLOCK_H);
        ctx.fillText(`World: ${Math.floor(player.x)}, ${Math.floor(player.y)}  Block: (${bx}, ${by})  Stage: ${gameState.currentStage.id}`, 10, game.height - 34);
        ctx.fillText(`Loaded blocks: ${Object.keys(world.blocks).length}  Type: ${gameState.currentStage.type}`, 10, game.height - 16);
    }
}

window.addEventListener('load', init);
