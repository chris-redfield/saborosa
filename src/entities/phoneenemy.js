/**
 * Telephone — a large enemy that roams the SAND (the flat walkable ground the
 * player uses: WALKABLE / SAND / DENSE_SAND), not the mountain like the Coconut.
 *
 * It differs from the other enemies in two ways:
 *   - No sleep. Unlike the Rock/Bush it is always up and wandering in the open;
 *     there is no inert pose to bump awake.
 *   - No walk cycle. Its sheet (build-phone-defs.py) is one frame per facing per
 *     emotional STATE, so movement just slides the single directional pose. The
 *     three states are the sheet's three rows: normal / nervous / hurt.
 *
 * Behaviour:
 *   ROAMING  wanders with the NORMAL pose (sheet row 0).
 *   NERVOUS  the instant it spots the player it freezes in the NERVOUS pose
 *            (row 1) for a short startled beat, turning to face them.
 *   CHASING  then it snaps back to NORMAL and charges, shoving on contact
 *            (annoy, never damage — same positional shove as the Coconut).
 * HURT (row 2) is loaded but unused for now: it's reserved for a future
 * thrown-object hit (the phone flinches only when the object actually lands).
 *
 * The movement/collision/shove helpers mirror the Coconut (enemy.js) and Rock
 * (rockenemy.js); what's specific here is the roam→nervous→chase machine and the
 * state-based single-frame sprite pick.
 */

// A large enemy: bigger than the 0.855 character world-scale. Tune to taste.
const PHONE_WORLD_SCALE = 1.05;

// Load the phone pack ONCE and memoize it on the game — every phone shares it.
function _loadPhonePack(game) {
    if (game._enemyPhonePack) return game._enemyPhonePack;
    const ss = new SpriteSheet(game);
    game._enemyPhonePack = ss.loadPhonePack('phone_sheet', 'phone_sprites', PHONE_WORLD_SCALE);
    return game._enemyPhonePack;
}

class PhoneEnemy {
    constructor(game, x, y) {
        this.game = game;
        this.entityType = 'enemy';
        this.x = x;
        this.y = y;

        const pack = _loadPhonePack(game);
        this.sprites = pack.sprites;
        this.width = pack.width || 190;
        this.height = pack.height || 150;

        // Reuse the character footprint ratios so the collision box sits under the
        // phone's wheels the same way the coconut's/rock's does.
        const colCfg = ((game.getJSON('collision_config') || {}).character)
            || { colW: 0.80, colH: 0.50, colOffX: 0.10, colOffY: 0.50 };
        this.colW = Math.round(this.width * colCfg.colW);
        this.colH = Math.round(this.height * colCfg.colH);
        this.colOffX = Math.round(this.width * colCfg.colOffX);
        this.colOffY = Math.round(this.height * colCfg.colOffY);
        this._rect = { x: 0, y: 0, width: 0, height: 0 };

        this.speed = 1.5;       // px/frame while roaming
        this.chaseSpeed = 2.3;  // px/frame while charging
        this.pushForce = 2.6;   // px/frame shove on contact

        this.detectionRange = 576; // 720 trimmed 20% (was 360 originally)
        this.loseRange = 752;      // keep the same detect→lose hysteresis ratio

        this.state = 'roaming'; // 'roaming' | 'nervous' | 'chasing'
        this.facing = Math.random() < 0.5 ? 'left' : 'right';
        this.dirX = 0;
        this.dirY = 0;
        this.moving = false;

        // Startled freeze: hold the nervous pose this many ticks before charging.
        this.nervousDuration = 32; // ~0.5s at 60fps
        this.nervousTimer = 0;

        // Roam cadence (in ~60fps ticks): pause, pick a heading, amble, repeat.
        this.wanderTimer = 0;
        this.wanderPause = 40 + Math.random() * 120;
        this.wanderDuration = 40 + Math.random() * 100;
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

        // The player only counts on the phone's plane: not occluded behind the
        // mountain and not mid-fall (input locked then).
        const canTarget = !player.behindMountain && player.surfaceState !== 'falling';

        switch (this.state) {
            case 'roaming':
                // Spotted the player → startle first, then charge.
                if (canTarget && dist < this.detectionRange) {
                    this.state = 'nervous';
                    this.nervousTimer = 0;
                    this.moving = false;
                    this._faceFrom(ddx, ddy);
                    break;
                }
                this._wander(obstacles, world, enemies);
                break;

            case 'nervous':
                this.moving = false;
                this._faceFrom(ddx, ddy); // keep facing the player while startled
                if (!canTarget) { this._toRoaming(); break; }
                if (++this.nervousTimer >= this.nervousDuration) this.state = 'chasing';
                break;

            case 'chasing':
                if (!canTarget || dist > this.loseRange) { this._toRoaming(); break; }
                {
                    const inv = dist > 0.001 ? 1 / dist : 0;
                    this.dirX = ddx * inv;
                    this.dirY = ddy * inv;
                    this.moving = this._tryMove(this.dirX * this.chaseSpeed, this.dirY * this.chaseSpeed, obstacles, world, enemies);
                    this._faceFrom(this.dirX, this.dirY);
                    if (this._overlapsFootprint(pr)) this._pushPlayer(player, ddx, ddy, dist, obstacles);
                }
                break;
        }
    }

    _toRoaming() {
        this.state = 'roaming';
        this.moving = false;
        this.dirX = 0;
        this.dirY = 0;
        this.wanderTimer = 0;
        this.wanderPause = 40 + Math.random() * 120;
    }

    // Random roaming: idle a beat, pick a heading, amble until the timer runs out
    // or the sand edge / an obstacle blocks the way, then repeat. `wanderTimer`
    // doubles as the pause/amble clock; `moving` gates it into the wander branch.
    _wander(obstacles, world, enemies) {
        this.wanderTimer++;
        if (!this.moving && this.dirX === 0 && this.dirY === 0) {
            // idling
            if (this.wanderTimer >= this.wanderPause) {
                this.wanderTimer = 0;
                this._startWander();
            }
            return;
        }
        if (this.wanderTimer >= this.wanderDuration) {
            this.moving = false;
            this.dirX = 0;
            this.dirY = 0;
            this.wanderTimer = 0;
            this.wanderPause = 40 + Math.random() * 120;
            return;
        }
        this.moving = this._tryMove(this.dirX * this.speed, this.dirY * this.speed, obstacles, world, enemies);
        this._faceFrom(this.dirX, this.dirY);
        if (!this.moving) this._startWander(); // blocked → new heading
    }

    _startWander() {
        const a = Math.random() * Math.PI * 2;
        this.dirX = Math.cos(a);
        this.dirY = Math.sin(a);
        this.wanderTimer = 0;
        this.wanderDuration = 40 + Math.random() * 100;
    }

    // --- movement / collision (mirrors Coconut/Rock) -----------------------
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

    // Confined to the flat ground the player walks (never the mountain, never off
    // the island border) — same rule as the Rock.
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
            if (!hitNow) return true; // block only moves that create a fresh overlap
        }
        return false;
    }

    _overlapsFootprint(pr) {
        const cx = this.x + this.colOffX;
        const cy = this.y + this.colOffY;
        return cx < pr.x + pr.width && cx + this.colW > pr.x &&
               cy < pr.y + pr.height && cy + this.colH > pr.y;
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

    // 8-way facing from a heading. Checks the NORMAL pose exists for the facing
    // (the phone has all 8 as explicit frames, no mirroring).
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
        if (this.sprites[`${f}_normal`] && this.sprites[`${f}_normal`].length) this.facing = f;
    }

    // One frame per facing per state; nervous while startled, else normal. (Hurt
    // is wired for the future thrown-object hit but never selected yet.)
    _currentSprite() {
        const f = this.facing;
        const st = this.state === 'nervous' ? 'nervous' : 'normal';
        const a = this.sprites[`${f}_${st}`] || this.sprites[`${f}_normal`] || this.sprites['down_normal'];
        return a && a[0];
    }

    // Bottom-anchored draw with depth-perspective scaling — identical to the
    // Coconut/Rock (recentre on the collision column, lift by renderH so the feet
    // stay planted when the taller nervous pose is drawn).
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
            const colCenter = drawX + this.colOffX + this.colW / 2;
            offsetX = Math.round(colCenter - renderW / 2);
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
            ctx.fillStyle = '#d8d8d8';
            ctx.fillRect(drawX, drawY, this.width, this.height);
        }

        if (game.showDebug) {
            const fcx = drawX + this.colOffX + this.colW / 2;
            const fcy = drawY + this.colOffY + this.colH / 2;
            ctx.strokeStyle = 'magenta';
            ctx.lineWidth = 1;
            ctx.strokeRect(drawX, drawY, this.width, this.height);
            ctx.strokeStyle = 'red';
            ctx.strokeRect(drawX + this.colOffX, drawY + this.colOffY, this.colW, this.colH);
            ctx.strokeStyle = this.state === 'chasing' ? 'rgba(255,80,80,0.6)'
                : this.state === 'nervous' ? 'rgba(255,220,60,0.6)' : 'rgba(80,160,255,0.35)';
            ctx.beginPath();
            ctx.arc(fcx, fcy, this.detectionRange, 0, Math.PI * 2);
            ctx.stroke();
        }
    }
}

// Scatter `count` phones on walkable ground in a ring around the player spawn —
// same placement as the sleepers (spawnSleeperEnemies is placement-only; it does
// not touch behaviour), so they sit on the sand within easy reach for testing.
function spawnPhoneEnemies(game, world, cfg) {
    return spawnSleeperEnemies(game, world, cfg, PhoneEnemy);
}

window.PhoneEnemy = PhoneEnemy;
window.spawnPhoneEnemies = spawnPhoneEnemies;
