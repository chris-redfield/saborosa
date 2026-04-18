/**
 * Saborosa - Main entry point
 */

let game;

const ZONE_DEBUG_COLORS = {
    WALKABLE:   '#cccccc',
    RAMP_LEFT:  '#e6c93a',
    RAMP_RIGHT: '#3a8fd1',
    DENSE_SAND: '#808080',
    WALL:       '#3aa847',
    NONE:       '#000000'
};

const gameState = {
    player: null,
    world: null,
    currentStage: null,
    // Basket ascent transition
    transition: null // { basket, targetStage, basketY, startY, speed, phase }
};

async function init() {
    console.log('Initializing Saborosa...');

    game = new Game('game-canvas');
    await game.loadAssets();

    loadStage(STAGES[3]);

    game.onUpdate = (dt) => updateGame(dt);
    game.onRender = (ctx) => renderGame(ctx);

    game.start();
    console.log('Game started! WASD to move. E near portal to travel. Hold C for debug.');
}

function loadStage(stage) {
    gameState.currentStage = stage;
    gameState.world = new World(game, stage);
    game.world = gameState.world;

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

    // --- Basket ascent transition ---
    if (gameState.transition) {
        const t = gameState.transition;
        if (t.phase === 'ascending') {
            // Move basket and player upward
            t.basketY -= t.speed;
            t.basket.y = t.basketY;
            player.x = t.basket.x + t.playerOffsetX;
            player.y = t.basketY + t.playerOffsetY;

            // Camera follows the basket
            world.cameraX = t.basket.x + t.basket.width / 2 - game.width / 2;
            world.cameraY = t.basketY + t.basket.height / 2 - game.height / 2;

            // After ascending enough, load new stage
            if (t.startY - t.basketY > game.height * 1.2) {
                loadStage(STAGES[t.targetStage]);
                gameState.transition = null;
            }
        }
        return; // skip normal input during transition
    }

    // --- Normal gameplay ---
    const obstacles = world.getObstacles();
    const movement = game.input.getMovementVector();

    // Dash
    if (game.input.isKeyJustPressed('dash')) {
        player.dash(performance.now(), movement.x, movement.y);
    }

    // Sample the zone under the player's footprint once — reused for sand,
    // drift, and any future zone-based behavior.
    const feetX = player.x + player.colOffX + player.colW / 2;
    const feetY = player.y + player.colOffY + player.colH / 2;
    const playerZone = world.getZoneAt(feetX, feetY);

    // Check if player is on sand. Only regular sand sinks the sprite —
    // DENSE_SAND slows the player but doesn't crop the sprite.
    const playerCenterX = player.x + player.width / 2;
    const playerBottomY = player.y + player.height;
    player.onSand = !world.isOnWalkableTerrain(playerCenterX, playerBottomY);

    // Run (sprint) — hold R to move 27% faster
    player.running = game.input.isKeyDown('run');

    // Movement: dash overrides normal speed, sand slows, run boosts.
    // DENSE_SAND applies the sand speed factor with an extra 10% slowdown,
    // without the sinking effect.
    let speedMult = 1;
    if (player.onSand) speedMult = player.sandSpeedFactor;
    else if (playerZone === Zone.DENSE_SAND) speedMult = player.sandSpeedFactor * 0.9;
    if (player.running && !player.dashing) speedMult *= player.runSpeedFactor;
    let dx, dy;
    if (player.dashing) {
        const dashVel = player.speed * player.dashSpeed * speedMult;
        dx = player.dashDirection.x * dashVel;
        dy = player.dashDirection.y * dashVel;
    } else {
        dx = movement.x * player.speed * speedMult;
        dy = movement.y * player.speed * speedMult;
    }

    // --- Wall state machine (Phase 5) ---
    // While onWall, the entire "upper" zone set keeps you on the wall:
    //   WALL       — another wall face (side of a higher cube)
    //   DENSE_SAND — gray top of the cube
    //   RAMP_*     — a ramp sitting on top of the cube
    // Anything else (walkable, none) means you stepped off the edge and fall.
    const onWallStickyZone = (z) =>
        z === Zone.WALL || z === Zone.DENSE_SAND ||
        z === Zone.RAMP_LEFT || z === Zone.RAMP_RIGHT;

    // Track previous state so we can detect a transition *into* falling.
    const prevState = player.surfaceState;

    // 1) Transitions based on current zone + intended movement direction.
    if (player.surfaceState === 'ground' && playerZone === Zone.WALL) {
        // Entering a wall from ground: climb only if moving predominantly "up"
        // into the wall (smaller Y). Any other direction = fall.
        if (dy < 0 && Math.abs(dy) >= Math.abs(dx)) {
            player.surfaceState = 'climbing';
            player.surfaceTimer = player.climbDurationMs;
        } else {
            player.surfaceState = 'falling';
        }
    } else if (player.surfaceState === 'onWall') {
        // Zones that represent being "on top of a cube" (anything walkable
        // you can stand on up there). Stepping from a top zone back onto a
        // WALL face means you crossed the front edge and should fall.
        const isTopZone = (z) =>
            z === Zone.DENSE_SAND || z === Zone.RAMP_LEFT || z === Zone.RAMP_RIGHT;
        if (!onWallStickyZone(playerZone)) {
            // Stepped off the cube onto beige (walkable) / image void.
            player.surfaceState = 'falling';
        } else if (isTopZone(player.lastZone) && playerZone === Zone.WALL) {
            // Crossed the edge from the top of the cube back onto the face.
            player.surfaceState = 'falling';
        }
    } else if (player.surfaceState === 'falling' && playerZone !== Zone.WALL && playerZone !== Zone.NONE) {
        // Landed on another zone.
        player.surfaceState = 'ground';
    }

    // Reset fall timer the frame we start falling.
    if (player.surfaceState === 'falling' && prevState !== 'falling') {
        player.fallTimerMs = 0;
    }

    // 2) State-specific movement overrides.
    if (player.surfaceState === 'climbing') {
        // Physically rise over climbDuration, so the collision footprint
        // (and zone sampling) end up on top of the wall when the timer
        // finishes. No visual-only offset — the real Y carries the sprite.
        const totalLift = Math.abs(player.onWallOffsetY); // 40px upward
        const climbSec = player.climbDurationMs / 1000;
        dx = 0;
        dy = -(totalLift / climbSec) * dt;
        player.surfaceTimer -= dt * 1000;
        if (player.surfaceTimer <= 0) {
            player.surfaceState = 'onWall';
            player.surfaceTimer = 0;
        }
    } else if (player.surfaceState === 'falling') {
        // No recovery until landing — input ignored. Fall speed accelerates
        // with time: start slow, accelerate, cap at fallMaxSpeed.
        player.fallTimerMs += dt * 1000;
        const t = player.fallTimerMs / 1000;
        dx = 0;
        dy = Math.min(player.fallMaxSpeed, player.fallStartSpeed + player.fallAccelPerSec * t);
    }

    // 3) Ramp drift applies whenever you're standing on terrain — both
    //    the ground level and the top of a cube. Falling/climbing are not
    //    drifted; they're locked movement states.
    if (!player.dashing &&
        (player.surfaceState === 'ground' || player.surfaceState === 'onWall')) {
        const drift = getZoneDrift(playerZone);
        dx += drift.dx;
        dy += drift.dy;
    }

    player.move(dx, dy, obstacles);

    // Record the zone we settled on this frame for next frame's edge-detect.
    player.lastZone = playerZone;

    // Apply zone drift to movable obstacles (rocks, live rocks).
    // Skip carried objects and stack children (their parent will drag them).
    for (const obs of obstacles) {
        if (obs === player) continue;
        if (!obs.pushable) continue;
        if (obs.stackParent) continue;
        if (player.liftedObject === obs) continue;
        const ocx = obs.x + (obs.colOffX || 0) + (obs.colW || obs.width) / 2;
        const ocy = obs.y + (obs.colOffY || 0) + (obs.colH || obs.height) / 2;
        const oZone = world.getZoneAt(ocx, ocy);
        const oDrift = getZoneDrift(oZone);
        if (oDrift.dx || oDrift.dy) {
            applyObstacleDrift(obs, oDrift.dx, oDrift.dy, obstacles, player);
        }
    }

    // Cube wall-fall physics (zone-driven stages only). A cube whose
    // footprint center lands on a WALL pixel starts falling: vertical-only
    // drop with the same accel curve as the player. Lands when the sampled
    // zone is no longer WALL/NONE. While falling the cube is non-pushable.
    if (world.stage && world.stage.backgroundImage) {
        for (const obs of obstacles) {
            if (obs === player) continue;
            if (obs === player.liftedObject) continue;
            if (obs.stackParent) continue;
            if (obs.surfaceState === undefined) continue;

            const ocxF = obs.x + (obs.colOffX || 0) + (obs.colW || obs.width) / 2;
            const ocyF = obs.y + (obs.colOffY || 0) + (obs.colH || obs.height) / 2;

            if (obs.surfaceState === 'ground') {
                if (world.getZoneAt(ocxF, ocyF) === Zone.WALL) {
                    obs.surfaceState = 'falling';
                    obs.fallTimerMs = 0;
                    obs.pushable = false;
                }
            }

            if (obs.surfaceState === 'falling') {
                obs.fallTimerMs += dt * 1000;
                const t = obs.fallTimerMs / 1000;
                const vy = Math.min(obs.fallMaxSpeed, obs.fallStartSpeed + obs.fallAccelPerSec * t);
                obs.y += vy;
                if (obs.stackChild) obs.stackChild.y += vy;

                const newCy = obs.y + (obs.colOffY || 0) + (obs.colH || obs.height) / 2;
                const landedZone = world.getZoneAt(ocxF, newCy);
                if (landedZone !== Zone.WALL && landedZone !== Zone.NONE) {
                    obs.surfaceState = 'ground';
                    obs.pushable = true;
                    obs.fallTimerMs = 0;
                }
            }
        }
    }
    player.update(dt);
    world.update(player);

    // Animate live rocks
    for (const obs of obstacles) {
        if (obs.update && obs !== player) obs.update(dt);
    }

    // Update stack target cursor every frame while carrying
    player.updateStackTarget(obstacles);

    // Lift / drop (Space)
    if (game.input.isKeyJustPressed('attack')) {
        player.liftOrDrop(obstacles);
    }

    // Basket interaction — start ascent
    if (game.input.isKeyJustPressed('interact')) {
        const portal = world.getPortalAt(player);
        if (portal) {
            gameState.transition = {
                basket: portal,
                targetStage: portal.targetStage,
                basketY: portal.y,
                startY: portal.y,
                playerOffsetX: player.x - portal.x,
                playerOffsetY: player.y - portal.y,
                speed: 3,
                phase: 'ascending'
            };
            player.moving = false;
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
    // Exclude lifted object (player renders it on top of themselves)
    const entities = world.getAllEntities().filter(e => e !== player.liftedObject);
    entities.push(player);
    // Stacked rocks use their parent's bottom edge + 1 so they render in front
    entities.sort((a, b) => {
        const ay = a.stackParent ? (a.stackParent.y + a.stackParent.height + 1) : (a.y + a.height);
        const by = b.stackParent ? (b.stackParent.y + b.stackParent.height + 1) : (b.y + b.height);
        return ay - by;
    });

    // Render with camera offset
    for (const entity of entities) {
        const sx = entity.x - camX;
        const sy = entity.y - camY;
        if (sx + entity.width < 0 || sx > game.width ||
            sy + entity.height < 0 || sy > game.height) continue;

        entity.render(ctx, game, camX, camY);
    }

    // During transition, draw the basket on top of everything (it's ascending)
    if (gameState.transition) {
        const t = gameState.transition;
        t.basket.render(ctx, game, camX, camY);
        player.render(ctx, game, camX, camY);
    }

    // Stage name
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = '11px monospace';
    ctx.fillText(gameState.currentStage.name, 10, 16);

    // Dash cooldown bar
    if (!gameState.transition) {
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
    }

    // Debug overlay
    if (game.showDebug) {
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(4, game.height - 72, 360, 68);
        ctx.fillStyle = '#0f0';
        ctx.font = '12px monospace';
        const bx = Math.floor(player.x / BLOCK_W);
        const by = Math.floor(player.y / BLOCK_H);
        const feetX = player.x + player.colOffX + player.colW / 2;
        const feetY = player.y + player.colOffY + player.colH / 2;
        const zone = world.getZoneAt ? world.getZoneAt(feetX, feetY) : '-';
        ctx.fillText(`World: ${Math.floor(player.x)}, ${Math.floor(player.y)}  Block: (${bx}, ${by})  Stage: ${gameState.currentStage.id}`, 10, game.height - 54);
        ctx.fillText(`Loaded blocks: ${Object.keys(world.blocks).length}  Type: ${gameState.currentStage.type}`, 10, game.height - 36);
        ctx.fillText(`Zone: ${zone}   State: ${player.surfaceState}`, 10, game.height - 16);

        // Zone badge near the player's feet
        const swatch = ZONE_DEBUG_COLORS[zone] || '#888';
        const screenFeetX = feetX - camX;
        const screenFeetY = feetY - camY;
        ctx.fillStyle = swatch;
        ctx.fillRect(screenFeetX - 6, screenFeetY + 4, 12, 12);
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 1;
        ctx.strokeRect(screenFeetX - 6, screenFeetY + 4, 12, 12);
        ctx.fillStyle = '#fff';
        ctx.font = '10px monospace';
        ctx.fillText(zone, screenFeetX + 10, screenFeetY + 14);
    }
}

window.addEventListener('load', init);
