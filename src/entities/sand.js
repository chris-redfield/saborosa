/**
 * Sand - Boundary obstacle for sand stages, rendered as ground layer
 */
class Sand {
    constructor(game, x, y, width, height, color) {
        this.game = game;
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.color = color || '#d4a55a';
        this.entityType = 'sand';
        this.isObstacle = true;
        this.renderLayer = 'ground';

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
        ctx.fillStyle = this.color;
        ctx.fillRect(sx, sy, this.width, this.height);
    }
}

window.Sand = Sand;
