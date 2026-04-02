/**
 * Player - Character with movement and animation
 */
class Player {
    constructor(game, x, y) {
        this.game = game;
        this.x = x;
        this.y = y;
        this.width = 48;
        this.height = 56;
        this.speed = 3;

        // Isometric collision footprint (bottom portion of sprite)
        this.colW = 48;
        this.colH = 28; // bottom half
        this.colOffX = 0;
        this.colOffY = 28; // offset from top of sprite
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

        // Dash
        this.dashing = false;
        this.dashDirection = { x: 0, y: 0 };
        this.dashSpeed = 5;        // multiplier of base speed
        this.dashDuration = 150;   // ms
        this.dashCooldown = 1000;  // ms
        this.dashEndTime = 0;
        this.dashTimer = 0;

        // Sand sinking
        this.onSand = false;
        this.sandSpeedFactor = 0.7; // 30% slower on sand

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
            switch (this.facing) {
                case 'right': dx = 1; break;
                case 'left': dx = -1; break;
                case 'down': dy = 1; break;
                case 'up': dy = -1; break;
            }
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
    }

    move(dx, dy, obstacles = []) {
        if (dx !== 0 || dy !== 0) {
            this.moving = true;

            // Determine dominant axis for facing direction
            const wasH = this.lastDx !== 0;
            const wasV = this.lastDy !== 0;
            const nowH = dx !== 0;
            const nowV = dy !== 0;

            if (nowH && nowV) {
                if (!wasH && nowH) this.dominantAxis = 'vertical';
                else if (!wasV && nowV) this.dominantAxis = 'horizontal';
                if (!this.dominantAxis) {
                    this.dominantAxis = Math.abs(dx) >= Math.abs(dy) ? 'horizontal' : 'vertical';
                }
            } else if (nowH) {
                this.dominantAxis = 'horizontal';
            } else {
                this.dominantAxis = 'vertical';
            }

            if (this.dominantAxis === 'horizontal') {
                this.facing = dx > 0 ? 'right' : 'left';
            } else {
                this.facing = dy > 0 ? 'down' : 'up';
            }

            this.lastDx = dx;
            this.lastDy = dy;

            // Per-axis collision with pushing
            let newX = this.x + dx;
            let newY = this.y + dy;
            this.pushing = false;

            // Check X axis
            let xBlocked = false;
            for (const obs of obstacles) {
                if (this._collides(newX, this.y, obs)) {
                    if (obs.pushable && obs.mass < this.mass) {
                        const pushDir = dx > 0 ? 1 : -1;
                        const pushSpeed = obs.mass < this.mass * 0.5 ? 0.7 : 0.5;
                        const pushDx = pushDir * Math.abs(dx) * pushSpeed;
                        const pushNewX = obs.x + pushDx;
                        const oCol = obs.getRect();

                        let pushBlocked = false;
                        for (const other of obstacles) {
                            if (other === obs) continue;
                            const offX = oCol.x - obs.x;
                            const offY = oCol.y - obs.y;
                            if (this._rectsOverlap(pushNewX + offX, oCol.y, oCol.width, oCol.height, other)) {
                                pushBlocked = true;
                                break;
                            }
                        }
                        if (!pushBlocked) {
                            obs.x = pushNewX;
                            const r = obs.getRect();
                            // Snap player collision edge against rock collision edge
                            newX = dx > 0 ? r.x - this.colW - this.colOffX : r.x + r.width - this.colOffX;
                            this.pushing = true;
                        } else {
                            xBlocked = true;
                        }
                    } else {
                        xBlocked = true;
                    }
                    break;
                }
            }
            if (!xBlocked) this.x = newX;

            // Check Y axis
            let yBlocked = false;
            for (const obs of obstacles) {
                if (this._collides(this.x, newY, obs)) {
                    if (obs.pushable && obs.mass < this.mass) {
                        const pushDir = dy > 0 ? 1 : -1;
                        const pushSpeed = obs.mass < this.mass * 0.5 ? 0.7 : 0.5;
                        const pushDy = pushDir * Math.abs(dy) * pushSpeed;
                        const pushNewY = obs.y + pushDy;
                        const oCol = obs.getRect();

                        let pushBlocked = false;
                        for (const other of obstacles) {
                            if (other === obs) continue;
                            const offX = oCol.x - obs.x;
                            const offY = oCol.y - obs.y;
                            if (this._rectsOverlap(oCol.x, pushNewY + offY, oCol.width, oCol.height, other)) {
                                pushBlocked = true;
                                break;
                            }
                        }
                        if (!pushBlocked) {
                            obs.y = pushNewY;
                            const r = obs.getRect();
                            // Snap player collision edge against rock collision edge
                            newY = dy > 0 ? r.y - this.colH - this.colOffY : r.y + r.height - this.colOffY;
                            this.pushing = true;
                        } else {
                            yBlocked = true;
                        }
                    } else {
                        yBlocked = true;
                    }
                    break;
                }
            }
            if (!yBlocked) this.y = newY;
        } else {
            this.moving = false;
            this.dominantAxis = null;
            this.lastDx = 0;
            this.lastDy = 0;
        }
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
            const dashInfo = this.dashing ? ' DASH' : (performance.now() < this.dashTimer ? ' cd' : '');
            ctx.fillText(`${this.facing} ${this.moving ? 'walk' : 'idle'} f:${this.frame}${dashInfo}`, drawX, drawY - 4);
        }
    }
}

window.Player = Player;
