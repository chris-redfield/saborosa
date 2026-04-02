/**
 * Portal - Transports player between stages
 */
class Portal {
    constructor(game, x, y, targetStage, label) {
        this.game = game;
        this.x = x;
        this.y = y;
        this.width = 48;
        this.height = 64;
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
        const t = performance.now() / 1000;
        const cx = sx + this.width / 2;
        const cy = sy + this.height / 2;

        ctx.save();

        // Outer glow
        const glowR = 36 + Math.sin(t * 2) * 4;
        const grad = ctx.createRadialGradient(cx, cy, 5, cx, cy, glowR);
        grad.addColorStop(0, `rgba(140, 60, 255, ${0.5 + Math.sin(t * 3) * 0.15})`);
        grad.addColorStop(0.6, `rgba(80, 20, 200, ${0.3 + Math.sin(t * 2.5) * 0.1})`);
        grad.addColorStop(1, 'rgba(40, 0, 120, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.ellipse(cx, cy, 30, 36, 0, 0, Math.PI * 2);
        ctx.fill();

        // Inner vortex
        ctx.fillStyle = `rgba(60, 0, 160, ${0.8 + Math.sin(t * 4) * 0.15})`;
        ctx.beginPath();
        ctx.ellipse(cx, cy, 18, 26, 0, 0, Math.PI * 2);
        ctx.fill();

        // Bright core
        ctx.fillStyle = `rgba(180, 120, 255, ${0.6 + Math.sin(t * 5) * 0.2})`;
        ctx.beginPath();
        ctx.ellipse(cx, cy, 8, 12, 0, 0, Math.PI * 2);
        ctx.fill();

        // Spinning particles
        for (let i = 0; i < 8; i++) {
            const angle = t * 2.5 + (i * Math.PI * 2 / 8);
            const r = 12 + Math.sin(t * 3 + i * 1.5) * 6;
            const px = cx + Math.cos(angle) * r;
            const py = cy + Math.sin(angle) * r * 1.3;
            const pa = 0.4 + Math.sin(t * 4 + i * 2) * 0.3;
            ctx.fillStyle = `rgba(200, 160, 255, ${pa})`;
            ctx.beginPath();
            ctx.arc(px, py, 1.5 + Math.sin(t * 3 + i) * 0.8, 0, Math.PI * 2);
            ctx.fill();
        }

        // Label
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(this.label, cx, sy - 6);
        ctx.fillStyle = 'rgba(200, 180, 255, 0.7)';
        ctx.fillText('[E]', cx, sy + this.height + 12);
        ctx.textAlign = 'left';

        ctx.restore();

        if (game.showDebug) {
            ctx.strokeStyle = 'magenta';
            ctx.lineWidth = 1;
            ctx.strokeRect(sx, sy, this.width, this.height);
        }
    }
}

window.Portal = Portal;
