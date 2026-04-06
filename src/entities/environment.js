/**
 * Rock - Environment obstacle with collision
 */
class Rock {
    constructor(game, x, y, size, type) {
        this.game = game;
        this.x = x;
        this.y = y;
        this.width = size;
        this.height = size;
        this.entityType = 'environment';
        this.isObstacle = true;
        this.pushable = true;
        this.spriteKey = `rock${type}`;

        // Isometric collision footprint from config
        const colCfg = (game.getJSON('collision_config') || {}).rock || { colW: 1.00, colH: 0.50, colOffX: 0.00, colOffY: 0.50 };
        this.colW = Math.round(this.width * colCfg.colW);
        this.colH = Math.round(this.height * colCfg.colH);
        this.colOffX = Math.round(this.width * colCfg.colOffX);
        this.colOffY = Math.round(this.height * colCfg.colOffY);
        this.mass = this.colW * this.colH;
        this._rect = { x: 0, y: 0, width: 0, height: 0 };

        // Stacking
        this.stackParent = null; // rock this one sits on
        this.stackChild = null;  // rock sitting on top of this one
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

        const sprite = game.getImage(this.spriteKey);
        if (sprite) {
            ctx.drawImage(sprite, sx, sy, this.width, this.height);
        } else {
            ctx.fillStyle = '#787878';
            ctx.fillRect(sx, sy, this.width, this.height);
        }

        if (game.showDebug) {
            ctx.strokeStyle = 'yellow';
            ctx.lineWidth = 1;
            ctx.strokeRect(sx, sy, this.width, this.height);
            // Collision footprint
            ctx.strokeStyle = 'red';
            ctx.strokeRect(sx + this.colOffX, sy + this.colOffY, this.colW, this.colH);
            // Mass label
            ctx.fillStyle = 'yellow';
            ctx.font = '9px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(`m:${this.mass}`, sx + this.width / 2, sy - 3);
            ctx.textAlign = 'left';
        }
    }
}

window.Rock = Rock;
