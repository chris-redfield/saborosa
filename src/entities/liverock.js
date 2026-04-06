/**
 * LiveRock - Special rock that can't be lifted.
 * Slowly cycles through 4 sprite positions, creating a circling animation.
 */
class LiveRock {
    constructor(game, x, y) {
        this.game = game;
        this.x = x;
        this.y = y;
        this.entityType = 'environment';
        this.isObstacle = true;
        this.pushable = true;
        this.liftable = false; // can't be lifted
        this._rect = { x: 0, y: 0, width: 0, height: 0 };

        // Stacking
        this.stackParent = null;
        this.stackChild = null;

        // Animation: cycle through pos1-3 normally, pos4 only on collision
        this.spriteFrames = [];  // pos1, pos2, pos3
        this.hitFrame = null;    // pos4
        this.animFrame = 0;
        this.animTimer = 0;
        this.animSpeed = 800; // ms per frame
        this.animTimer = Math.random() * this.animSpeed;
        this.showHitFrame = false;
        this.hitFrameTimer = 0;
        this.hitFrameDuration = 400; // ms to show pos4 on collision
        this._loadSprites();

        // Dimensions from sprite data (like the character)
        if (this.spriteFrames.length > 0) {
            const f = this.spriteFrames[0];
            this.width = f.sw;
            this.height = f.sh;
        } else {
            this.width = 50;
            this.height = 50;
        }

        // Isometric collision footprint from config
        const colCfg = (game.getJSON('collision_config') || {}).liverock || { colW: 0.92, colH: 0.52, colOffX: 0.02, colOffY: 0.31 };
        this.colW = Math.round(this.width * colCfg.colW);
        this.colH = Math.round(this.height * colCfg.colH);
        this.colOffX = Math.round(this.width * colCfg.colOffX);
        this.colOffY = Math.round(this.height * colCfg.colOffY);
        this.mass = this.colW * this.colH;
    }

    _loadSprites() {
        const json = this.game.getJSON('liverock_sprites');
        const img = this.game.getImage('liverock_sheet');
        if (!json || !img) return;

        // pos1-3 are the normal cycle frames
        const cycle = ['pos1_idle', 'pos2_idle', 'pos3_idle'];
        for (const key of cycle) {
            if (json[key] && json[key].length > 0) {
                const f = json[key][0];
                this.spriteFrames.push({ image: img, sx: f.x, sy: f.y, sw: f.w, sh: f.h });
            }
        }
        // pos4 is the collision reaction frame
        if (json['pos4_idle'] && json['pos4_idle'].length > 0) {
            const f = json['pos4_idle'][0];
            this.hitFrame = { image: img, sx: f.x, sy: f.y, sw: f.w, sh: f.h };
        }
        this.animFrame = Math.floor(Math.random() * this.spriteFrames.length);
    }

    onCollision() {
        this.showHitFrame = true;
        this.hitFrameTimer = this.hitFrameDuration;
    }

    update(dt) {
        const ms = dt * 1000;

        // Hit frame countdown
        if (this.showHitFrame) {
            this.hitFrameTimer -= ms;
            if (this.hitFrameTimer <= 0) {
                this.showHitFrame = false;
            }
            return; // pause cycling while showing hit frame
        }

        if (this.spriteFrames.length <= 1) return;
        this.animTimer += ms;
        if (this.animTimer >= this.animSpeed) {
            this.animTimer -= this.animSpeed;
            this.animFrame = (this.animFrame + 1) % this.spriteFrames.length;
        }
    }

    getRect() {
        this._rect.x = this.x + this.colOffX;
        this._rect.y = this.y + this.colOffY;
        this._rect.width = this.colW;
        this._rect.height = this.colH;
        return this._rect;
    }

    render(ctx, game, camX, camY) {
        const sx = this.x - camX;
        const sy = this.y - camY;

        const activeFrame = (this.showHitFrame && this.hitFrame)
            ? this.hitFrame
            : (this.spriteFrames.length > 0 ? this.spriteFrames[this.animFrame] : null);

        if (activeFrame) {
            const s = activeFrame;
            ctx.drawImage(s.image, s.sx, s.sy, s.sw, s.sh, sx, sy, this.width, this.height);
        } else {
            ctx.fillStyle = '#a04030';
            ctx.fillRect(sx, sy, this.width, this.height);
            ctx.fillStyle = '#fff';
            ctx.font = '9px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('LIVE', sx + this.width / 2, sy + this.height / 2);
            ctx.textAlign = 'left';
        }

        if (game.showDebug) {
            ctx.strokeStyle = '#ff4444';
            ctx.lineWidth = 1;
            ctx.strokeRect(sx, sy, this.width, this.height);
            ctx.strokeStyle = 'red';
            ctx.strokeRect(sx + this.colOffX, sy + this.colOffY, this.colW, this.colH);
            ctx.fillStyle = '#ff4444';
            ctx.font = '9px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(`LR m:${this.mass}`, sx + this.width / 2, sy - 3);
            ctx.textAlign = 'left';
        }
    }
}

window.LiveRock = LiveRock;
