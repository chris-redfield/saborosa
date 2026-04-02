/**
 * Portal (Fruit Basket) - Transports player between stages
 */
class Portal {
    constructor(game, x, y, targetStage, label) {
        this.game = game;
        this.x = x;
        this.y = y;
        this.width = 101;
        this.height = 101;
        this.targetStage = targetStage;
        this.label = label || `Stage ${targetStage}`;
        this.entityType = 'portal';
        this.isObstacle = false;

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
        const cx = sx + this.width / 2;

        const sprite = game.getImage('fruit_basket');
        if (sprite) {
            ctx.drawImage(sprite, sx, sy, this.width, this.height);
        } else {
            ctx.fillStyle = '#8B4513';
            ctx.fillRect(sx, sy, this.width, this.height);
        }

        // Label
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(this.label, cx, sy - 6);
        ctx.fillStyle = 'rgba(255, 220, 150, 0.7)';
        ctx.fillText('[E]', cx, sy + this.height + 12);
        ctx.textAlign = 'left';

        if (game.showDebug) {
            ctx.strokeStyle = 'magenta';
            ctx.lineWidth = 1;
            ctx.strokeRect(sx, sy, this.width, this.height);
        }
    }
}

window.Portal = Portal;
