/**
 * Enemy — roaming mountain critters that annoy (never damage) the player.
 *
 * Ported from the skeleton/slime AI in game-learning (wander timers + an
 * awareness radius that flips into a chase). Trimmed to fit Saborosa, which has
 * no HP yet: there's no health/knockback/death — the only aggression is a
 * positional SHOVE when the enemy's footprint overlaps the player's.
 *
 * The Coconut reuses the playable coconut sprite pack (the same sheet the Player
 * loads for character-pack 1), so it walks and faces in 8 directions exactly
 * like the player. It is confined to the MOUNTAIN: every candidate step is
 * rejected unless the destination feet still sit on the mountain overlay (and
 * off any RED cliff paint), so the coconut never wanders onto the sand or walks
 * off the mountain's border.
 */

// Load the coconut character pack ONCE and memoize it on the game. The pack
// loader does per-frame canvas pixel scans (feet-baseline alignment), so we
// never want to redo it per enemy — every coconut shares the one sprite set.
function _loadCoconutPack(game) {
    if (game._enemyCoconutPack) return game._enemyCoconutPack;
    const ss = new SpriteSheet(game);
    const ws = (window.ART && window.ART.characterWorldScale) || 0.855;
    game._enemyCoconutPack = ss.loadCharacterPack('coconut_sheet', 'coconut_sprites', ws, 'tan');
    return game._enemyCoconutPack;
}

class Coconut {
    constructor(game, x, y) {
        this.game = game;
        this.entityType = 'enemy';
        this.x = x;
        this.y = y;

        const pack = _loadCoconutPack(game);
        this.sprites = pack.sprites;
        this.width = pack.width || 120;
        this.height = pack.height || 120;

        // Same isometric footprint ratios the player uses (collision-config.json)
        // so the coconut's collision box lines up with its feet the same way.
        const colCfg = ((game.getJSON('collision_config') || {}).character)
            || { colW: 0.80, colH: 0.50, colOffX: 0.10, colOffY: 0.50 };
        this.colW = Math.round(this.width * colCfg.colW);
        this.colH = Math.round(this.height * colCfg.colH);
        this.colOffX = Math.round(this.width * colCfg.colOffX);
        this.colOffY = Math.round(this.height * colCfg.colOffY);
        this._rect = { x: 0, y: 0, width: 0, height: 0 };

        // Speeds (player walk is 3). Roaming is lazy; the hunt is a touch faster.
        this.speed = 1.6;       // px/frame while wandering
        this.chaseSpeed = 2.4;  // px/frame while chasing
        this.pushForce = 2.4;   // px/frame shove applied to the player on contact

        // Awareness radius, with hysteresis so it doesn't flicker in/out of the
        // chase right at the edge: engage within detectionRange, give up past
        // loseRange.
        this.detectionRange = 360;
        this.loseRange = 470;

        this.state = 'idle';    // 'idle' | 'wander' | 'chase'
        this.facing = Math.random() < 0.5 ? 'left' : 'right';
        this.dirX = 0;
        this.dirY = 0;

        this.moving = false;
        this.frame = 0;
        this.animCounter = 0;
        this.animSpeed = 0.12;

        // Wander cadence (in ~60fps ticks): pause, then roam a while, repeat.
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
        // Distance from the coconut's feet to the player's footprint center.
        const pr = player.getRect();
        const ecx = this.x + this.colOffX + this.colW / 2;
        const ecy = this.y + this.colOffY + this.colH / 2;
        const pcx = pr.x + pr.width / 2;
        const pcy = pr.y + pr.height / 2;
        const ddx = pcx - ecx;
        const ddy = pcy - ecy;
        const dist = Math.hypot(ddx, ddy);

        // The player is only a valid target while on the coconut's plane: not
        // occluded behind the mountain and not mid-fall (input is locked then).
        const canTarget = !player.behindMountain && player.surfaceState !== 'falling';

        // Awareness state machine (radius detection, like the reference skeleton).
        if (this.state === 'chase') {
            if (!canTarget || dist > this.loseRange) this._toIdle();
        } else if (canTarget && dist < this.detectionRange) {
            this.state = 'chase';
        }

        if (this.state === 'chase') {
            const inv = dist > 0.001 ? 1 / dist : 0;
            this.dirX = ddx * inv;
            this.dirY = ddy * inv;
            this.moving = this._tryMove(this.dirX * this.chaseSpeed, this.dirY * this.chaseSpeed, obstacles, world, enemies);
            this._faceFrom(this.dirX, this.dirY);
            // Shove the player away on contact (the whole point — annoy, no damage).
            if (canTarget && this._overlapsFootprint(pr)) {
                this._pushPlayer(player, ddx, ddy, dist, obstacles);
            }
        } else {
            this._wander(obstacles, world, enemies);
        }

        this._animate();
    }

    // Random roaming: idle for a beat, pick a heading, amble until the timer
    // runs out or the mountain edge / an obstacle blocks the way, then repeat.
    _wander(obstacles, world, enemies) {
        this.wanderTimer++;
        if (this.state === 'idle') {
            this.moving = false;
            if (this.wanderTimer >= this.wanderPause) {
                this.wanderTimer = 0;
                this._startWander();
            }
            return;
        }
        // state === 'wander'
        if (this.wanderTimer >= this.wanderDuration) {
            this._toIdle();
            return;
        }
        this.moving = this._tryMove(this.dirX * this.speed, this.dirY * this.speed, obstacles, world, enemies);
        this._faceFrom(this.dirX, this.dirY);
        // Blocked (hit the mountain border or something solid) → new heading.
        if (!this.moving) this._startWander();
    }

    _startWander() {
        const a = Math.random() * Math.PI * 2;
        this.dirX = Math.cos(a);
        this.dirY = Math.sin(a);
        this.state = 'wander';
        this.wanderTimer = 0;
        this.wanderDuration = 40 + Math.random() * 100;
    }

    _toIdle() {
        this.state = 'idle';
        this.moving = false;
        this.dirX = 0;
        this.dirY = 0;
        this.wanderTimer = 0;
        this.wanderPause = 40 + Math.random() * 120;
    }

    // Per-axis move, committing an axis only when the destination keeps the
    // coconut on the mountain (never sand, never off the border) and clear of
    // any obstacle on the mountain plane. Returns true if either axis moved.
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

    // True when the footprint center at (x,y) is on the mountain and not on an
    // impassable RED cliff pixel. This is the confinement rule: it fails on sand
    // and past the mountain's border, so a step there is simply rejected.
    _standable(x, y, world) {
        const fx = x + this.colOffX + this.colW / 2;
        const fy = y + this.colOffY + this.colH / 2;
        if (!world.isOnMountain(fx, fy)) return false;
        if (world.getZoneAt(fx, fy) === Zone.RED) return false;
        return true;
    }

    // AABB against obstacles that live on the mountain plane (trees/plants).
    // Sand-level obstacles are ignored — the coconut is never down there.
    _hitsObstacle(x, y, obstacles) {
        const cx = x + this.colOffX;
        const cy = y + this.colOffY;
        for (const o of obstacles) {
            if (!o.onMountainPlane) continue;
            const r = o.getRect();
            if (cx < r.x + r.width && cx + this.colW > r.x &&
                cy < r.y + r.height && cy + this.colH > r.y) {
                return true;
            }
        }
        return false;
    }

    // Footprint AABB against the other coconuts so they bump instead of merging.
    // A peer already overlapping us (e.g. two spawned close, or a shove stacked
    // them) is ignored on this axis so they can still slide apart — only NEW
    // overlaps are blocked, which avoids the classic stuck-together deadlock.
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

    // Shove the player directly away from the coconut. Routed through
    // player.move so the push respects walls, rocks and red zones — then the
    // player's own facing/animation state is restored so the shove reads as
    // getting bumped, not as the player choosing to walk that way.
    _pushPlayer(player, ddx, ddy, dist, obstacles) {
        const inv = dist > 0.001 ? 1 / dist : 0;
        let nx = ddx * inv;
        let ny = ddy * inv;
        if (nx === 0 && ny === 0) ny = 1; // perfectly overlapped → nudge down
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
        const DIAG = 0.45; // both axes strong-ish → diagonal facing
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
        if (this.moving) {
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

    // Mirrors Player.render (idle/walk poses only): bottom-anchored with the
    // per-frame vAlign baseline correction, horizontal flip for the mirrored
    // side-facings, and the stage's depth-perspective size scaling.
    render(ctx, game, camX, camY) {
        const drawX = this.x - camX;
        const drawY = this.y - camY;

        let s;
        const walk = this.sprites[`${this.facing}_walk`];
        const idle = this.sprites[`${this.facing}_idle`];
        if (this.moving && walk && walk.length) s = walk[Math.min(this.frame, walk.length - 1)];
        else if (idle && idle.length) s = idle[0];

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
            ctx.fillStyle = '#8a5a2b';
            ctx.fillRect(drawX, drawY, this.width, this.height);
        }

        if (game.showDebug) {
            const fcx = drawX + this.colOffX + this.colW / 2;
            const fcy = drawY + this.colOffY + this.colH / 2;
            ctx.strokeStyle = 'orange';
            ctx.lineWidth = 1;
            ctx.strokeRect(drawX, drawY, this.width, this.height);
            ctx.strokeStyle = 'red';
            ctx.strokeRect(drawX + this.colOffX, drawY + this.colOffY, this.colW, this.colH);
            ctx.strokeStyle = this.state === 'chase' ? 'rgba(255,80,80,0.6)' : 'rgba(80,160,255,0.35)';
            ctx.beginPath();
            ctx.arc(fcx, fcy, this.detectionRange, 0, Math.PI * 2);
            ctx.stroke();
        }
    }
}

// Scatter `count` coconuts across the mountain of a stage. Rejection-samples
// candidate feet positions in the above-midline band until each lands on the
// mountain (and off any RED cliff). No-op when the stage has no mountain.
function spawnCoconutEnemies(game, world, cfg) {
    const out = [];
    const count = (cfg && cfg.count) || 0;
    const rect = world.stage && world.stage.backgroundImageRect;
    if (!count || !rect || !world.isOnMountain) return out;

    const midY = world.getMidlineWorldY ? world.getMidlineWorldY() : (rect.y + rect.h * 0.5);
    const yMin = rect.y + rect.h * 0.06;   // keep off the very top fringe
    const yMax = midY - rect.h * 0.04;     // keep above the mountain's bottom edge
    const ATTEMPTS = 240;

    for (let i = 0; i < count; i++) {
        const e = new Coconut(game, 0, 0);
        let placed = false;
        for (let a = 0; a < ATTEMPTS && !placed; a++) {
            const fx = rect.x + Math.random() * rect.w;
            const fy = yMin + Math.random() * (yMax - yMin);
            const tlx = fx - e.colOffX - e.colW / 2;
            const tly = fy - e.colOffY - e.colH / 2;
            if (!world.isOnMountain(fx, fy) || world.getZoneAt(fx, fy) === Zone.RED) continue;
            // Keep clear of already-placed coconuts so none start stacked (which
            // would look like a single enemy and jam the mutual-collision test).
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

window.Coconut = Coconut;
window.spawnCoconutEnemies = spawnCoconutEnemies;
