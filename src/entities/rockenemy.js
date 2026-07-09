/**
 * Rock — a sleeping enemy that only stirs when disturbed.
 *
 * A second enemy type alongside the roaming Coconut (enemy.js). It spends most
 * of its life as an inert rock on the mountain. TOUCH it (footprint overlap) and
 * it WAKES: the wake-up animation plays in its current orientation (col 0 -> 6 of
 * the rock sheet), then it behaves like a normal enemy — chasing and shoving the
 * player. Lose it (leave its perception zone) and it roams for a couple of
 * seconds, then FALLS BACK ASLEEP by playing the same animation in reverse
 * (6 -> 0) and returns to its inert state.
 *
 * Unlike the mountain-only Coconut, the rock lives on the same walkable ground
 * the player roams (WALKABLE / SAND / DENSE_SAND, bounded by the RED cliffs), so
 * it can sit on the spawn island right next to the player. Its obstacle/peer
 * collision and the contact-shove otherwise mirror the Coconut (see enemy.js for
 * the rationale on each). What's new here is the sleep lifecycle layered on top:
 *
 *   SLEEPING        inert; wakes on player footprint contact
 *   WAKING          rises (wake anim forward); stationary
 *   CHASING         player inside perception → hunt + shove
 *   ROAMING         player lost → wander, counting down to sleep
 *   FALLING_ASLEEP  sinks (wake anim reverse); stationary; re-wakes if disturbed
 */

// Load the rock enemy pack ONCE and memoize it on the game (same pattern as the
// coconut pack — every rock shares one sprite set).
function _loadRockPack(game) {
    if (game._enemyRockPack) return game._enemyRockPack;
    const ss = new SpriteSheet(game);
    const ws = (window.ART && window.ART.characterWorldScale) || 0.855;
    game._enemyRockPack = ss.loadRockPack('rock_sheet', 'rock_sprites', ws);
    return game._enemyRockPack;
}

class RockEnemy {
    constructor(game, x, y) {
        this.game = game;
        this.entityType = 'enemy';
        this.x = x;
        this.y = y;

        const pack = _loadRockPack(game);
        this.sprites = pack.sprites;
        this.width = pack.width || 80;
        this.height = pack.height || 95;

        // Reuse the character footprint ratios so the rock's collision box sits
        // under its feet the same way the coconut's does.
        const colCfg = ((game.getJSON('collision_config') || {}).character)
            || { colW: 0.80, colH: 0.50, colOffX: 0.10, colOffY: 0.50 };
        this.colW = Math.round(this.width * colCfg.colW);
        this.colH = Math.round(this.height * colCfg.colH);
        this.colOffX = Math.round(this.width * colCfg.colOffX);
        this.colOffY = Math.round(this.height * colCfg.colOffY);
        this._rect = { x: 0, y: 0, width: 0, height: 0 };

        this.speed = 1.6;       // px/frame while roaming
        this.chaseSpeed = 2.4;  // px/frame while chasing
        this.pushForce = 2.4;   // px/frame shove on contact

        // Perception (only used once awake; sleeping wakes on TOUCH, not sight).
        this.detectionRange = 360;
        this.loseRange = 470;

        this.state = 'sleeping';
        this.facing = Math.random() < 0.5 ? 'left' : 'right';
        this.dirX = 0;
        this.dirY = 0;
        this.moving = false;

        // Wake/sleep animation cursor: a float over [0, NWAKE-1]. Forward while
        // waking, reverse while falling asleep; the current frame is its round.
        this.wakeAnim = 0;
        this.wakeSpeed = 0.20;  // frames/tick — ~0.6s for the 7-frame rise

        // Walk animation.
        this.frame = 0;
        this.animCounter = 0;
        this.animSpeed = 0.12;

        // Roam-before-sleep: once the player is lost, wander this long (~ticks)
        // then go back to sleep. Sub-cadence (pause/amble) reuses wanderTimer.
        this.roamDuration = 150;   // ~2.5s at 60fps
        this.roamElapsed = 0;
        this.roamPhase = 'idle';   // 'idle' | 'wander'
        this.wanderTimer = 0;
        this.wanderPause = 40 + Math.random() * 120;
        this.wanderDuration = 40 + Math.random() * 100;
    }

    _wakeCount() {
        const a = this.sprites[`${this.facing}_wake`];
        return (a && a.length) || 1;
    }

    getRect() {
        this._rect.x = this.x + this.colOffX;
        this._rect.y = this.y + this.colOffY;
        this._rect.width = this.colW;
        this._rect.height = this.colH;
        return this._rect;
    }

    update(dt, player, obstacles, world, enemies) {
        const pr = player.getRect();
        const ecx = this.x + this.colOffX + this.colW / 2;
        const ecy = this.y + this.colOffY + this.colH / 2;
        const pcx = pr.x + pr.width / 2;
        const pcy = pr.y + pr.height / 2;
        const ddx = pcx - ecx;
        const ddy = pcy - ecy;
        const dist = Math.hypot(ddx, ddy);

        // The player only counts as present on the rock's plane: not occluded
        // behind the mountain and not mid-fall (input locked). Gates both the
        // wake-on-touch and the perception hunt.
        const canTarget = !player.behindMountain && player.surfaceState !== 'falling';
        const touching = canTarget && this._overlapsFootprint(pr);

        switch (this.state) {
            case 'sleeping':
                this.moving = false;
                // Solid while asleep (see isSolid), so the player can't overlap
                // the footprint — wake when they BUMP it (footprints nearly
                // touching) instead of on overlap.
                if (canTarget && this._playerContact(pr, 10)) this._startWaking();
                break;

            case 'waking':
                this.moving = false;
                this.wakeAnim += this.wakeSpeed;
                if (this.wakeAnim >= this._wakeCount() - 1) {
                    this.wakeAnim = this._wakeCount() - 1;
                    // Fully up: hunt if the player is in range, else start the
                    // roam-then-sleep countdown.
                    this._enterActive(canTarget && dist < this.detectionRange);
                }
                break;

            case 'chasing':
                if (!canTarget || dist > this.loseRange) {
                    this._toRoaming();
                    break;
                }
                {
                    const inv = dist > 0.001 ? 1 / dist : 0;
                    this.dirX = ddx * inv;
                    this.dirY = ddy * inv;
                    this.moving = this._tryMove(this.dirX * this.chaseSpeed, this.dirY * this.chaseSpeed, obstacles, world, enemies);
                    this._faceFrom(this.dirX, this.dirY);
                    if (touching) this._pushPlayer(player, ddx, ddy, dist, obstacles);
                }
                break;

            case 'roaming':
                // Player back in sight → resume the hunt and cancel the sleep.
                if (canTarget && dist < this.detectionRange) {
                    this.state = 'chasing';
                    break;
                }
                this._wander(obstacles, world, enemies);
                this.roamElapsed++;
                if (this.roamElapsed >= this.roamDuration) this._startFallingAsleep();
                break;

            case 'falling_asleep':
                this.moving = false;
                // Disturbed again mid-sink → rise back up from wherever we are.
                // Solid here too, so use the bump test, not overlap.
                if (canTarget && (this._playerContact(pr, 10) || dist < this.detectionRange)) {
                    this.state = 'waking';
                    break;
                }
                this.wakeAnim -= this.wakeSpeed;
                if (this.wakeAnim <= 0) {
                    this.wakeAnim = 0;
                    this.state = 'sleeping';
                }
                break;
        }

        this._animate();
    }

    _startWaking() {
        this.state = 'waking';
        this.wakeAnim = 0;
        this.moving = false;
    }

    // Wake animation finished → become a live enemy. `chase` picks the opening
    // behaviour; either way a fresh roam countdown is armed for when the player
    // is (or becomes) out of range.
    _enterActive(chase) {
        this.roamElapsed = 0;
        this.roamPhase = 'idle';
        this.wanderTimer = 0;
        this.state = chase ? 'chasing' : 'roaming';
    }

    _toRoaming() {
        this.state = 'roaming';
        this.moving = false;
        this.dirX = 0;
        this.dirY = 0;
        this.roamElapsed = 0;
        this.roamPhase = 'idle';
        this.wanderTimer = 0;
        this.wanderPause = 40 + Math.random() * 120;
    }

    _startFallingAsleep() {
        this.state = 'falling_asleep';
        this.moving = false;
        this.dirX = 0;
        this.dirY = 0;
        this.wakeAnim = this._wakeCount() - 1; // start the reverse from standing
    }

    // Roam cadence: pause a beat, pick a heading, amble until the timer runs out
    // or the mountain edge / an obstacle blocks the way, then repeat. (Same shape
    // as Coconut._wander, but tracked on roamPhase so it composes with the
    // roam-to-sleep countdown above.)
    _wander(obstacles, world, enemies) {
        this.wanderTimer++;
        if (this.roamPhase === 'idle') {
            this.moving = false;
            if (this.wanderTimer >= this.wanderPause) {
                this.wanderTimer = 0;
                this._startRoamStep();
            }
            return;
        }
        if (this.wanderTimer >= this.wanderDuration) {
            this.roamPhase = 'idle';
            this.moving = false;
            this.wanderTimer = 0;
            this.wanderPause = 40 + Math.random() * 120;
            return;
        }
        this.moving = this._tryMove(this.dirX * this.speed, this.dirY * this.speed, obstacles, world, enemies);
        this._faceFrom(this.dirX, this.dirY);
        if (!this.moving) this._startRoamStep();
    }

    _startRoamStep() {
        const a = Math.random() * Math.PI * 2;
        this.dirX = Math.cos(a);
        this.dirY = Math.sin(a);
        this.roamPhase = 'wander';
        this.wanderTimer = 0;
        this.wanderDuration = 40 + Math.random() * 100;
    }

    // --- movement / collision (mirrors Coconut) ----------------------------
    _tryMove(dx, dy, obstacles, world, enemies) {
        let moved = false;
        if (dx !== 0) {
            const nx = this.x + dx;
            if (this._standable(nx, this.y, world) && !this._hitsObstacle(nx, this.y, obstacles)
                && !this._hitsEnemy(nx, this.y, enemies)) {
                this.x = nx;
                moved = true;
            }
        }
        if (dy !== 0) {
            const ny = this.y + dy;
            if (this._standable(this.x, ny, world) && !this._hitsObstacle(this.x, ny, obstacles)
                && !this._hitsEnemy(this.x, ny, enemies)) {
                this.y = ny;
                moved = true;
            }
        }
        return moved;
    }

    // Confined to the ground the player walks: flat land zones only, so it stays
    // on its island (RED cliffs, WALL/ramps and the off-island void all reject).
    _standable(x, y, world) {
        const fx = x + this.colOffX + this.colW / 2;
        const fy = y + this.colOffY + this.colH / 2;
        const z = world.getZoneAt(fx, fy);
        return z === Zone.WALKABLE || z === Zone.SAND || z === Zone.DENSE_SAND;
    }

    _hitsObstacle(x, y, obstacles) {
        const cx = x + this.colOffX;
        const cy = y + this.colOffY;
        for (const o of obstacles) {
            if (!o.getRect) continue;
            const r = o.getRect();
            if (cx < r.x + r.width && cx + this.colW > r.x &&
                cy < r.y + r.height && cy + this.colH > r.y) {
                return true;
            }
        }
        return false;
    }

    _hitsEnemy(x, y, enemies) {
        if (!enemies) return false;
        const cx = x + this.colOffX, cy = y + this.colOffY;
        const curX = this.x + this.colOffX, curY = this.y + this.colOffY;
        for (const o of enemies) {
            if (o === this) continue;
            const r = o.getRect();
            const hitNew = cx < r.x + r.width && cx + this.colW > r.x &&
                           cy < r.y + r.height && cy + this.colH > r.y;
            if (!hitNew) continue;
            const hitNow = curX < r.x + r.width && curX + this.colW > r.x &&
                           curY < r.y + r.height && curY + this.colH > r.y;
            if (!hitNow) return true;
        }
        return false;
    }

    _overlapsFootprint(pr) {
        const cx = this.x + this.colOffX;
        const cy = this.y + this.colOffY;
        return cx < pr.x + pr.width && cx + this.colW > pr.x &&
               cy < pr.y + pr.height && cy + this.colH > pr.y;
    }

    // A stationary rock (asleep, rising, or sinking) is a solid, immovable
    // obstacle the player bumps into — main.js folds these into the player's
    // collision list. A MOVING rock (chasing/roaming) is not solid: it overlaps
    // and shoves like the coconut instead. Staying solid through the whole wake
    // animation (not just 'sleeping') is what stops the player walking through it
    // the instant a bump flips it to 'waking'.
    isSolid() {
        return this.state === 'sleeping' || this.state === 'waking'
            || this.state === 'falling_asleep';
    }

    // Footprint overlap with the box inflated by `margin` — true when the player
    // is touching (or nearly) the rock. Used for the wake-on-bump test, since a
    // solid rock never lets the player's footprint truly overlap it.
    _playerContact(pr, margin) {
        const cx = this.x + this.colOffX - margin;
        const cy = this.y + this.colOffY - margin;
        const w = this.colW + margin * 2;
        const h = this.colH + margin * 2;
        return cx < pr.x + pr.width && cx + w > pr.x &&
               cy < pr.y + pr.height && cy + h > pr.y;
    }

    _pushPlayer(player, ddx, ddy, dist, obstacles) {
        const inv = dist > 0.001 ? 1 / dist : 0;
        let nx = ddx * inv;
        let ny = ddy * inv;
        if (nx === 0 && ny === 0) ny = 1;
        const sf = player.facing, sm = player.moving;
        const sdx = player.lastDx, sdy = player.lastDy;
        const sda = player.dominantAxis, sg = player.diagGraceFrames;
        player.move(nx * this.pushForce, ny * this.pushForce, obstacles);
        player.facing = sf; player.moving = sm;
        player.lastDx = sdx; player.lastDy = sdy;
        player.dominantAxis = sda; player.diagGraceFrames = sg;
    }

    _faceFrom(dx, dy) {
        if (dx === 0 && dy === 0) return;
        const ax = Math.abs(dx), ay = Math.abs(dy);
        const DIAG = 0.45;
        let f;
        if (ax > DIAG && ay > DIAG) {
            f = (dy > 0 ? 'down' : 'up') + '_' + (dx > 0 ? 'right' : 'left');
        } else if (ax >= ay) {
            f = dx > 0 ? 'right' : 'left';
        } else {
            f = dy > 0 ? 'down' : 'up';
        }
        if (this.sprites[`${f}_idle`] && this.sprites[`${f}_idle`].length) this.facing = f;
    }

    _animate() {
        // Only the walk cycle animates on the frame timer; wake/sleep advance via
        // wakeAnim in update(), and sleeping/idle are single frames.
        if ((this.state === 'chasing' || this.state === 'roaming') && this.moving) {
            const key = `${this.facing}_walk`;
            const n = (this.sprites[key] && this.sprites[key].length) || 1;
            this.animCounter += this.animSpeed;
            if (n > 1) {
                if (this.animCounter >= n) this.animCounter = 0;
                this.frame = Math.floor(this.animCounter);
            } else {
                this.frame = 0;
            }
        } else {
            this.frame = 0;
            this.animCounter = 0;
        }
    }

    // Pick the sprite record for the current state/frame.
    _currentSprite() {
        const f = this.facing;
        if (this.state === 'sleeping') {
            const a = this.sprites[`${f}_sleep`];
            return a && a[0];
        }
        if (this.state === 'waking' || this.state === 'falling_asleep') {
            const a = this.sprites[`${f}_wake`];
            if (!a || !a.length) return null;
            const i = Math.max(0, Math.min(a.length - 1, Math.round(this.wakeAnim)));
            return a[i];
        }
        if (this.moving) {
            const a = this.sprites[`${f}_walk`];
            if (a && a.length) return a[Math.min(this.frame, a.length - 1)];
        }
        const idle = this.sprites[`${f}_idle`];
        return idle && idle[0];
    }

    // Bottom-anchored draw with the stage's depth-perspective scaling and the
    // horizontal flip for mirrored side-facings — identical to Coconut.render.
    render(ctx, game, camX, camY) {
        const drawX = this.x - camX;
        const drawY = this.y - camY;
        const s = this._currentSprite();

        if (s && s.image) {
            let pscale = 1;
            if (game.world && game.world.getPerspectiveScale) {
                const feetY = this.y + this.colOffY + this.colH * 0.5;
                pscale = game.world.getPerspectiveScale(feetY);
            }
            const renderW = s.width * pscale;
            const renderH = s.height * pscale;

            let offsetX = drawX;
            if (renderW !== this.width) {
                const colCenter = drawX + this.colOffX + this.colW / 2;
                offsetX = Math.round(colCenter - renderW / 2);
            }
            const topY = drawY + this.height - renderH + (s.vAlign || 0);

            ctx.save();
            if (s.flipped) {
                ctx.translate(offsetX + renderW, topY);
                ctx.scale(-1, 1);
                ctx.drawImage(s.image, s.sx, s.sy, s.sw, s.sh, 0, 0, renderW, renderH);
            } else {
                ctx.drawImage(s.image, s.sx, s.sy, s.sw, s.sh, offsetX, topY, renderW, renderH);
            }
            ctx.restore();
        } else {
            ctx.fillStyle = '#cfcfcf';
            ctx.fillRect(drawX, drawY, this.width, this.height);
        }

        if (game.showDebug) {
            const fcx = drawX + this.colOffX + this.colW / 2;
            const fcy = drawY + this.colOffY + this.colH / 2;
            ctx.strokeStyle = 'cyan';
            ctx.lineWidth = 1;
            ctx.strokeRect(drawX, drawY, this.width, this.height);
            ctx.strokeStyle = 'red';
            ctx.strokeRect(drawX + this.colOffX, drawY + this.colOffY, this.colW, this.colH);
            const awake = this.state === 'chasing' || this.state === 'roaming';
            ctx.strokeStyle = this.state === 'chasing' ? 'rgba(255,80,80,0.6)'
                : awake ? 'rgba(80,160,255,0.35)' : 'rgba(160,160,160,0.4)';
            ctx.beginPath();
            ctx.arc(fcx, fcy, this.detectionRange, 0, Math.PI * 2);
            ctx.stroke();
        }
    }
}

// Scatter `count` sleeping rocks on walkable ground in a ring around the player
// spawn, so they sit on the spawn island within easy reach for testing. Rejects
// non-walkable ground, spots too near the spawn (rMin, so none land on the
// player) and stacked rocks. `cfg.radius` / `cfg.minDist` tune the ring.
function spawnRockEnemies(game, world, cfg) {
    const out = [];
    const count = (cfg && cfg.count) || 0;
    const stage = world.stage;
    if (!count || !stage || stage.spawnX == null) return out;

    const sx = stage.spawnX, sy = stage.spawnY;
    const rMin = (cfg && cfg.minDist) || 240;   // keep off the player's start spot
    const rMax = (cfg && cfg.radius) || 900;    // within a short walk of spawn
    const walkable = z => z === Zone.WALKABLE || z === Zone.SAND || z === Zone.DENSE_SAND;
    const ATTEMPTS = 400;

    for (let i = 0; i < count; i++) {
        const e = new RockEnemy(game, 0, 0);
        let placed = false;
        for (let a = 0; a < ATTEMPTS && !placed; a++) {
            const ang = Math.random() * Math.PI * 2;
            const rad = rMin + Math.random() * (rMax - rMin);
            const fx = sx + Math.cos(ang) * rad;
            const fy = sy + Math.sin(ang) * rad;
            if (!walkable(world.getZoneAt(fx, fy))) continue;
            const tlx = fx - e.colOffX - e.colW / 2;
            const tly = fy - e.colOffY - e.colH / 2;
            const bx = tlx + e.colOffX, by = tly + e.colOffY;
            let tooClose = false;
            for (const other of out) {
                const r = other.getRect();
                const pad = e.colW * 0.5;
                if (bx - pad < r.x + r.width && bx + e.colW + pad > r.x &&
                    by - pad < r.y + r.height && by + e.colH + pad > r.y) { tooClose = true; break; }
            }
            if (tooClose) continue;
            e.x = tlx;
            e.y = tly;
            placed = true;
        }
        if (placed) out.push(e);
    }
    return out;
}

window.RockEnemy = RockEnemy;
window.spawnRockEnemies = spawnRockEnemies;
