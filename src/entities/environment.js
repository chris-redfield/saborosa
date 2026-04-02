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
        this.spriteKey = `rock${type}`;

        this._rect = { x: 0, y: 0, width: 0, height: 0 };
    }

    getRect() {
        this._rect.x = this.x;
        this._rect.y = this.y;
        this._rect.width = this.width;
        this._rect.height = this.height;
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
        }
    }
}

window.Rock = Rock;
