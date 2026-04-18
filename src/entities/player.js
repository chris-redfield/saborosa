/**
 * Player - Character with movement and animation
 */
class Player {
    constructor(game, x, y) {
        this.game = game;
        this.x = x;
        this.y = y;
        this.width = 145;
        this.height = 109;
        this.speed = 3;

        // Isometric collision footprint from config
        const colCfg = (game.getJSON('collision_config') || {}).character || { colW: 0.80, colH: 0.50, colOffX: 0.10, colOffY: 0.50 };
        this.colW = Math.round(this.width * colCfg.colW);
        this.colH = Math.round(this.height * colCfg.colH);
        this.colOffX = Math.round(this.width * colCfg.colOffX);
        this.colOffY = Math.round(this.height * colCfg.colOffY);
        this.mass = this.colW * this.colH;
        this.pushing = false;

        this._rect = { x: 0, y: 0, width: 0, height: 0 };

        // Direction and movement
        this.facing = 'down';
        this.moving = false;
        this.frame = 0;
        this.animationSpeed = 0.15;
        this.animationCounter = 0;

        // Diagonal facing tracking
        this.dominantAxis = null;
        this.lastDx = 0;
        this.lastDy = 0;
        this.diagGraceFrames = 0;

        // Dash
        this.dashing = false;
        this.dashDirection = { x: 0, y: 0 };
        this.dashSpeed = 5;        // multiplier of base speed
        this.dashDuration = 150;   // ms
        this.dashCooldown = 1000;  // ms
        this.dashEndTime = 0;
        this.dashTimer = 0;

        // Run (sprint)
        this.running = false;
        this.runSpeedFactor = 1.45; // 100% faster when running

        // Sand sinking
        this.onSand = false;
        this.sandSpeedFactor = 0.7; // 30% slower on sand

        // Wall interaction (Phase 5 — climbing / fall)
        this.surfaceState = 'ground'; // 'ground' | 'climbing' | 'falling'
        this.climbSpeedFactor = 0.4;  // movement multiplier while on green (slower than sand)

        // Falling velocity — accelerates from fallStartSpeed up to fallMaxSpeed
        // as fallTimer increases. Reset when a fall begins.
        this.fallStartSpeed = 1.5;
        this.fallMaxSpeed = 11;
        this.fallAccelPerSec = 15; // px/sec added to velocity each second (was 12, +25%)
        this.fallTimerMs = 0;

        // Tracks the zone under the player on the previous frame — used to
        // detect "just stepped off the cube top onto the wall face" (fall).
        this.lastZone = null;

        // Lifting
        this.liftedObject = null;
        this.liftOffsetX = 0;  // centered on player
        this.liftOffsetY = -30; // above head
        this.stackTarget = null; // rock currently targeted for stacking

        // Sprites
        this.sprites = null;
        this.loadSprites();
    }

    loadSprites() {
        const spriteSheet = new SpriteSheet(this.game);
        const result = spriteSheet.loadSprites(this.width, this.height);
        this.sprites = result.sprites;
    }

    dash(currentTime, inputX, inputY) {
        if (this.dashing || currentTime < this.dashTimer) return false;

        let dx = inputX;
        let dy = inputY;

        // Fall back to facing direction if no input
        if (dx === 0 && dy === 0) {
            const fv = this.getFacingVector();
            dx = fv.x;
            dy = fv.y;
        }

        // Normalize diagonal
        if (dx !== 0 && dy !== 0) {
            const len = Math.sqrt(dx * dx + dy * dy);
            dx /= len;
            dy /= len;
        }

        this.dashing = true;
        this.dashDirection = { x: dx, y: dy };
        this.dashEndTime = currentTime + this.dashDuration;
        this.dashTimer = currentTime + this.dashDuration + this.dashCooldown;
        return true;
    }

    update(dt) {
        // Dash timing
        const now = performance.now();
        if (this.dashing && now > this.dashEndTime) {
            this.dashing = false;
            this.dashDirection = { x: 0, y: 0 };
        }

        if (this.moving) {
            this.animationCounter += this.animationSpeed;
            const walkKey = `${this.facing}_walk`;
            const frameCount = (this.sprites && this.sprites[walkKey]?.length) || 1;

            if (frameCount > 1) {
                if (this.animationCounter >= frameCount) this.animationCounter = 0;
                this.frame = Math.floor(this.animationCounter);
            } else {
                // No walk frames - just use idle
                this.frame = 0;
            }
        } else {
            this.frame = 0;
            this.animationCounter = 0;
        }

        // Update lifted object position to follow player
        if (this.liftedObject) {
            const obj = this.liftedObject;
            obj.x = this.x + (this.width - obj.width) / 2 + this.liftOffsetX;
            obj.y = this.y + this.liftOffsetY;
        }
    }

    /**
     * Get the facing direction as a unit vector based on last input.
     */
    getFacingVector() {
        const diag = Math.SQRT1_2; // ~0.707
        switch (this.facing) {
            case 'down':       return { x: 0, y: 1 };
            case 'up':         return { x: 0, y: -1 };
            case 'right':      return { x: 1, y: 0 };
            case 'left':       return { x: -1, y: 0 };
            case 'down_right': return { x: diag, y: diag };
            case 'down_left':  return { x: -diag, y: diag };
            case 'up_right':   return { x: diag, y: -diag };
            case 'up_left':    return { x: -diag, y: -diag };
            default:           return { x: 0, y: 1 };
        }
    }

    /**
     * Find the best rock to stack on: closest in the facing direction.
     */
    updateStackTarget(obstacles) {
        // Only update every 6 frames
        this._stackTargetTimer = (this._stackTargetTimer || 0) + 1;
        if (this._stackTargetTimer % 6 !== 0) return;

        this.stackTarget = null;
        if (!this.liftedObject) return;

        const cx = this.x + this.width / 2;
        const cy = this.y + this.height / 2;
        const dir = this.getFacingVector();
        const maxDist = 96;

        let bestScore = Infinity;
        for (const obs of obstacles) {
            if (!obs.pushable || obs === this.liftedObject) continue;
            if (obs.stackChild) continue;

            const ox = obs.x + obs.width / 2;
            const oy = obs.y + obs.height / 2;
            const dx = ox - cx;
            const dy = oy - cy;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > maxDist || dist < 1) continue;

            // Dot product: how aligned is this rock with facing direction
            const dot = (dx / dist) * dir.x + (dy / dist) * dir.y;
            if (dot < 0.3) continue; // must be roughly in front

            // Score: prefer closer and more aligned
            const score = dist * (1.5 - dot);
            if (score < bestScore) {
                bestScore = score;
                this.stackTarget = obs;
            }
        }
    }

    /**
     * Try to lift a nearby object, or drop the currently held one.
     * Returns the dropped object (if any) so main.js can re-add it to the world.
     */
    liftOrDrop(obstacles) {
        if (this.liftedObject) {
            // Drop in front of the player based on facing direction
            const obj = this.liftedObject;
            const gap = 4;
            const fv = this.getFacingVector();
            const cx = this.x + (this.width - obj.width) / 2;
            const cy = this.y + (this.height - obj.height) / 2;
            obj.x = cx + fv.x * (this.width / 2 + obj.width / 2 + gap);
            obj.y = cy + fv.y * (this.height / 2 + obj.height / 2 + gap);

            // Stack onto the targeted rock if one exists
            let stacked = false;
            if (this.stackTarget && !this.stackTarget.stackChild) {
                const other = this.stackTarget;
                obj.x = other.x + (other.width - obj.width) / 2;
                obj.y = other.y - STACK_OFFSET;
                obj.stackParent = other;
                other.stackChild = obj;
                stacked = true;
            }
            this.stackTarget = null;

            obj.isObstacle = true;

            // Nudge player out if the dropped rock overlaps with them
            const dr = obj.getRect();
            const pr = this.getRect();
            if (pr.x < dr.x + dr.width && pr.x + pr.width > dr.x &&
                pr.y < dr.y + dr.height && pr.y + pr.height > dr.y) {
                if (fv.x > 0)  this.x = dr.x - this.colW - this.colOffX - 1;
                if (fv.x < 0)  this.x = dr.x + dr.width - this.colOffX + 1;
                if (fv.y > 0)  this.y = dr.y - this.colH - this.colOffY - 1;
                if (fv.y < 0)  this.y = dr.y + dr.height - this.colOffY + 1;
            }
            this.liftedObject = null;
            return obj;
        }

        // Try to pick up a nearby pushable object in the facing direction
        const reach = 8;
        const liftFv = this.getFacingVector();
        for (const obs of obstacles) {
            if (!obs.pushable || obs.mass >= this.mass) continue;
            if (obs.liftable === false) continue; // live rocks can't be lifted
            if (obs.stackChild) continue; // can't lift if something is on top

            const r = obs.getRect();
            const pr = this.getRect();
            // Visual vertical overlap (generous — allows lifting stacked rocks above player)
            const vOverlap = this.y + this.height > obs.y && this.y < obs.y + obs.height;
            // Horizontal overlap using collision footprint
            const hOverlap = pr.x + pr.width > r.x && pr.x < r.x + r.width;

            let inRange = false;
            if (liftFv.x !== 0 && liftFv.y !== 0) {
                // Diagonal: check both axes independently (generous)
                const hOk = liftFv.x > 0
                    ? pr.x + pr.width + reach > r.x && pr.x < r.x
                    : pr.x - reach < r.x + r.width && pr.x > r.x;
                const vOk = liftFv.y > 0
                    ? pr.y + pr.height + reach > r.y && pr.y < r.y
                    : pr.y - reach < r.y + r.height && pr.y > r.y;
                inRange = hOk || vOk;
            } else if (liftFv.y > 0)  { inRange = pr.y + pr.height + reach > r.y && pr.y < r.y && hOverlap; }
            else if (liftFv.y < 0)    { inRange = pr.y - reach < r.y + r.height && pr.y > r.y && hOverlap; }
            else if (liftFv.x > 0)    { inRange = pr.x + pr.width + reach > r.x && pr.x < r.x && vOverlap; }
            else if (liftFv.x < 0)    { inRange = pr.x - reach < r.x + r.width && pr.x > r.x && vOverlap; }

            if (inRange) {
                // Detach from stack if this rock was on top of another
                if (obs.stackParent) {
                    obs.stackParent.stackChild = null;
                    obs.stackParent = null;
                }
                this.liftedObject = obs;
                obs.isObstacle = false;
                return null;
            }
        }
        return null;
    }

    move(dx, dy, obstacles = []) {
        if (dx !== 0 || dy !== 0) {
            this.moving = true;

            // Determine facing direction — use diagonal when both axes active
            const nowH = dx !== 0;
            const nowV = dy !== 0;

            if (nowH && nowV) {
                const vDir = dy > 0 ? 'down' : 'up';
                const hDir = dx > 0 ? 'right' : 'left';
                const diagFacing = `${vDir}_${hDir}`;
                const diagKey = `${diagFacing}_idle`;
                if (this.sprites && this.sprites[diagKey] && this.sprites[diagKey].length > 0) {
                    this.facing = diagFacing;
                } else {
                    const wasH = this.lastDx !== 0;
                    const wasV = this.lastDy !== 0;
                    if (!wasH && nowH) this.dominantAxis = 'vertical';
                    else if (!wasV && nowV) this.dominantAxis = 'horizontal';
                    if (!this.dominantAxis) {
                        this.dominantAxis = Math.abs(dx) >= Math.abs(dy) ? 'horizontal' : 'vertical';
                    }
                    if (this.dominantAxis === 'horizontal') {
                        this.facing = dx > 0 ? 'right' : 'left';
                    } else {
                        this.facing = dy > 0 ? 'down' : 'up';
                    }
                }
                this.diagGraceFrames = 3;
            } else if (this.diagGraceFrames > 0) {
                // Just released one key from diagonal — hold diagonal facing briefly
                this.diagGraceFrames--;
            } else if (nowH) {
                this.dominantAxis = 'horizontal';
                this.facing = dx > 0 ? 'right' : 'left';
            } else {
                this.dominantAxis = 'vertical';
                this.facing = dy > 0 ? 'down' : 'up';
            }

            // While climbing, the player is hugging the wall and cannot turn
            // to face downward. Clamp the lower half of the facing set to the
            // equivalent upward pose.
            if (this.surfaceState === 'climbing') {
                if      (this.facing === 'down')       this.facing = 'up';
                else if (this.facing === 'down_left')  this.facing = 'up_left';
                else if (this.facing === 'down_right') this.facing = 'up_right';
                else if (this.facing === 'left')       this.facing = 'up_left';
                else if (this.facing === 'right')      this.facing = 'up_right';
            }

            this.lastDx = dx;
            this.lastDy = dy;

            // Per-axis collision with pushing
            let newX = this.x + dx;
            let newY = this.y + dy;
            this.pushing = false;

            // Check X axis (only if actually moving on X)
            let xBlocked = false;
            if (dx !== 0) {
                xBlocked = this._resolveAxis(newX, this.y, dx, 'x', obstacles);
                if (!xBlocked) this.x = this._resolvedPos;
            }

            // Check Y axis (only if actually moving on Y)
            let yBlocked = false;
            if (dy !== 0) {
                yBlocked = this._resolveAxis(this.x, newY, dy, 'y', obstacles);
                if (!yBlocked) this.y = this._resolvedPos;
            }
        } else {
            this.moving = false;
            this.dominantAxis = null;
            this.lastDx = 0;
            this.lastDy = 0;
            this.diagGraceFrames = 0;
        }
    }

    /**
     * Resolve collision on a single axis. Returns true if blocked.
     * On success, sets this._resolvedPos to the new coordinate.
     * Supports chain pushing: rock A pushed into rock B pushes both.
     */
    _resolveAxis(testX, testY, delta, axis, obstacles) {
        // 1. Collect all obstacles the player directly collides with
        const directHits = new Set();
        const pushChain = new Set();
        for (const obs of obstacles) {
            if (this._collides(testX, testY, obs)) {
                const base = obs.stackParent || obs;
                if (base.onCollision) base.onCollision();
                if (!base.pushable) return true; // immovable
                directHits.add(base);
                pushChain.add(base);
            }
        }

        if (pushChain.size === 0) {
            this._resolvedPos = axis === 'x' ? testX : testY;
            this.pushing = false;
            return false;
        }

        // 2. Cascade: check if pushed rocks would hit other rocks, adding them to the chain
        const pushDir = delta > 0 ? 1 : -1;
        let chainChanged = true;
        while (chainChanged) {
            chainChanged = false;
            for (const base of pushChain) {
                const oCol = base.getRect();
                // Simulate this rock's pushed position
                const simX = axis === 'x' ? oCol.x + delta : oCol.x;
                const simY = axis === 'y' ? oCol.y + delta : oCol.y;

                for (const other of obstacles) {
                    const otherBase = other.stackParent || other;
                    if (pushChain.has(otherBase) || other === base.stackChild) continue;

                    const oR = other.getRect();
                    if (simX < oR.x + oR.width && simX + oCol.width > oR.x &&
                        simY < oR.y + oR.height && simY + oCol.height > oR.y) {
                        // This rock would be pushed into 'other'
                        if (!otherBase.pushable) return true; // chain hits immovable
                        pushChain.add(otherBase);
                        chainChanged = true;
                    }
                }
            }
        }

        // 3. Sum combined mass of entire chain
        let combinedMass = 0;
        for (const base of pushChain) {
            combinedMass += base.mass + (base.stackChild ? base.stackChild.mass : 0);
        }
        if (combinedMass >= this.mass) return true; // too heavy

        // 4. Compute push speed based on combined mass, then check for external blockers
        const pushSpeed = combinedMass < this.mass * 0.5 ? 0.7 : 0.5;
        const pushDelta = pushDir * Math.abs(delta) * pushSpeed;

        const savedPositions = [];
        for (const base of pushChain) {
            savedPositions.push({ base, x: base.x, y: base.y });
        }

        // Check each chain rock's pushed position against non-chain obstacles
        for (const base of pushChain) {
            const oCol = base.getRect();
            const newColX = axis === 'x' ? oCol.x + pushDelta : oCol.x;
            const newColY = axis === 'y' ? oCol.y + pushDelta : oCol.y;

            for (const other of obstacles) {
                const otherBase = other.stackParent || other;
                if (pushChain.has(otherBase) || other === base.stackChild) continue;

                const oR = other.getRect();
                if (newColX < oR.x + oR.width && newColX + oCol.width > oR.x &&
                    newColY < oR.y + oR.height && newColY + oCol.height > oR.y) {
                    return true; // chain blocked by external obstacle
                }
            }
        }

        // On zone-driven stages: reject upward pushes that would land any
        // chain rock on a WALL pixel. Side and downward pushes onto walls are
        // allowed — the per-frame fall check in updateGame turns them into
        // a fall. Upward pushes (pushing a cube from below onto a wall) are
        // blocked outright for now.
        const world = this.game && this.game.world;
        if (axis === 'y' && pushDelta < 0 && world && world.stage && world.stage.backgroundImage) {
            for (const base of pushChain) {
                const cx = base.x + (base.colOffX || 0) + (base.colW || base.width) / 2;
                const cy = base.y + pushDelta + (base.colOffY || 0) + (base.colH || base.height) / 2;
                if (world.getZoneAt(cx, cy) === Zone.WALL) return true;
            }
        }

        // 5. Apply push to entire chain
        for (const base of pushChain) {
            if (axis === 'x') {
                base.x += pushDelta;
                if (base.stackChild) base.stackChild.x = base.x + (base.width - base.stackChild.width) / 2;
            } else {
                base.y += pushDelta;
                if (base.stackChild) base.stackChild.y = base.y - STACK_OFFSET;
            }
        }

        // 6. Snap player to nearest directly-hit obstacle edge
        let snapPos;
        if (axis === 'x') {
            if (delta > 0) {
                snapPos = Infinity;
                for (const base of directHits) {
                    const r = base.getRect();
                    snapPos = Math.min(snapPos, r.x - this.colW - this.colOffX);
                }
            } else {
                snapPos = -Infinity;
                for (const base of directHits) {
                    const r = base.getRect();
                    snapPos = Math.max(snapPos, r.x + r.width - this.colOffX);
                }
            }
        } else {
            if (delta > 0) {
                snapPos = Infinity;
                for (const base of directHits) {
                    const r = base.getRect();
                    snapPos = Math.min(snapPos, r.y - this.colH - this.colOffY);
                }
            } else {
                snapPos = -Infinity;
                for (const base of directHits) {
                    const r = base.getRect();
                    snapPos = Math.max(snapPos, r.y + r.height - this.colOffY);
                }
            }
        }

        // 7. Verify snap position doesn't overlap any obstacle
        const verifyX = axis === 'x' ? snapPos : testX;
        const verifyY = axis === 'y' ? snapPos : testY;
        for (const obs of obstacles) {
            if (this._collides(verifyX, verifyY, obs)) {
                for (const saved of savedPositions) {
                    saved.base.x = saved.x;
                    saved.base.y = saved.y;
                    if (saved.base.stackChild) {
                        saved.base.stackChild.x = saved.x + (saved.base.width - saved.base.stackChild.width) / 2;
                        saved.base.stackChild.y = saved.y - STACK_OFFSET;
                    }
                }
                return true;
            }
        }

        this._resolvedPos = snapPos;
        this.pushing = true;
        return false;
    }

    _collides(testX, testY, obstacle) {
        const r = obstacle.getRect();
        const cx = testX + this.colOffX;
        const cy = testY + this.colOffY;
        return cx < r.x + r.width &&
               cx + this.colW > r.x &&
               cy < r.y + r.height &&
               cy + this.colH > r.y;
    }

    _rectsOverlap(x, y, w, h, obstacle) {
        const r = obstacle.getRect();
        return x < r.x + r.width &&
               x + w > r.x &&
               y < r.y + r.height &&
               y + h > r.y;
    }

    getRect() {
        this._rect.x = this.x + this.colOffX;
        this._rect.y = this.y + this.colOffY;
        this._rect.width = this.colW;
        this._rect.height = this.colH;
        return this._rect;
    }

    render(ctx, game, camX, camY) {
        const drawX = this.x - camX;
        const drawY = this.y - camY;

        let spriteData;
        const walkKey = `${this.facing}_walk`;
        const idleKey = `${this.facing}_idle`;

        if (this.moving && this.sprites[walkKey] && this.sprites[walkKey].length > 0) {
            const frameIndex = Math.min(this.frame, this.sprites[walkKey].length - 1);
            spriteData = this.sprites[walkKey][frameIndex];
        } else if (this.sprites[idleKey] && this.sprites[idleKey].length > 0) {
            spriteData = this.sprites[idleKey][0];
        }

        // When on sand, crop the bottom STACK_OFFSET pixels of the sprite
        const sinkAmount = this.onSand ? STACK_OFFSET : 0;
        const visibleH = this.height - sinkAmount;
        const srcCropRatio = sinkAmount / this.height;

        if (spriteData && spriteData.image) {
            const cropSh = spriteData.sh * (1 - srcCropRatio);
            ctx.save();
            if (spriteData.flipped) {
                ctx.translate(drawX + this.width, drawY);
                ctx.scale(-1, 1);
                ctx.drawImage(
                    spriteData.image,
                    spriteData.sx, spriteData.sy, spriteData.sw, cropSh,
                    0, 0, spriteData.width, visibleH
                );
            } else {
                ctx.drawImage(
                    spriteData.image,
                    spriteData.sx, spriteData.sy, spriteData.sw, cropSh,
                    drawX, drawY, spriteData.width, visibleH
                );
            }
            ctx.restore();
        } else {
            ctx.fillStyle = '#ff6b35';
            ctx.fillRect(drawX, drawY, this.width, visibleH);
            ctx.fillStyle = '#fff';
            ctx.font = '10px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('PLAYER', drawX + this.width / 2, drawY + visibleH / 2 + 4);
            ctx.textAlign = 'left';
        }

        if (game.showDebug) {
            ctx.strokeStyle = 'lime';
            ctx.lineWidth = 1;
            ctx.strokeRect(drawX, drawY, this.width, this.height);
            // Collision footprint
            ctx.strokeStyle = 'red';
            ctx.strokeRect(drawX + this.colOffX, drawY + this.colOffY, this.colW, this.colH);
            ctx.fillStyle = 'lime';
            ctx.font = '10px monospace';
            const runInfo = this.running ? ' RUN' : '';
            const dashInfo = this.dashing ? ' DASH' : (performance.now() < this.dashTimer ? ' cd' : '');
            ctx.fillText(`${this.facing} ${this.moving ? 'walk' : 'idle'} f:${this.frame}${runInfo}${dashInfo} m:${this.mass}`, drawX, drawY - 4);
        }

        // Render lifted object above head
        if (this.liftedObject) {
            this.liftedObject.render(ctx, game, camX, camY);
        }

        // Stack target cursor — shows which rock you'll stack on
        if (this.stackTarget && this.liftedObject) {
            const t = this.stackTarget;
            const tx = t.x - camX;
            const ty = t.y - camY;
            const pad = 4;
            const cornerLen = 8;

            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.globalAlpha = 0.6 + Math.sin(performance.now() / 200) * 0.3;

            // Top-left corner
            ctx.beginPath();
            ctx.moveTo(tx - pad, ty - pad + cornerLen);
            ctx.lineTo(tx - pad, ty - pad);
            ctx.lineTo(tx - pad + cornerLen, ty - pad);
            ctx.stroke();
            // Top-right corner
            ctx.beginPath();
            ctx.moveTo(tx + t.width + pad - cornerLen, ty - pad);
            ctx.lineTo(tx + t.width + pad, ty - pad);
            ctx.lineTo(tx + t.width + pad, ty - pad + cornerLen);
            ctx.stroke();
            // Bottom-left corner
            ctx.beginPath();
            ctx.moveTo(tx - pad, ty + t.height + pad - cornerLen);
            ctx.lineTo(tx - pad, ty + t.height + pad);
            ctx.lineTo(tx - pad + cornerLen, ty + t.height + pad);
            ctx.stroke();
            // Bottom-right corner
            ctx.beginPath();
            ctx.moveTo(tx + t.width + pad - cornerLen, ty + t.height + pad);
            ctx.lineTo(tx + t.width + pad, ty + t.height + pad);
            ctx.lineTo(tx + t.width + pad, ty + t.height + pad - cornerLen);
            ctx.stroke();

            ctx.globalAlpha = 1;
        }
    }
}

window.Player = Player;
