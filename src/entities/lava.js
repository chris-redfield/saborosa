/**
 * Lava - Boundary obstacle for finite stages, rendered as ground layer
 */
class Lava {
    constructor(game, x, y, width, height) {
        this.game = game;
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.entityType = 'lava';
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
        const t = performance.now() / 1000;

        // Dark base
        ctx.fillStyle = '#8b0000';
        ctx.fillRect(sx, sy, this.width, this.height);

        // Animated lava cells
        const cellSize = 24;
        for (let lx = 0; lx < this.width; lx += cellSize) {
            for (let ly = 0; ly < this.height; ly += cellSize) {
                const wx = this.x + lx;
                const wy = this.y + ly;
                const n1 = Math.sin(wx * 0.015 + t * 1.2) * Math.cos(wy * 0.015 + t * 0.8);
                const n2 = Math.sin(wx * 0.025 + t * 0.7) * Math.cos(wy * 0.02 - t * 1.1);
                const n = (n1 + n2) * 0.5;
                const r = Math.floor(180 + n * 75);
                const g = Math.floor(50 + n * 60);
                const a = 0.5 + n * 0.3;
                ctx.fillStyle = `rgba(${r}, ${g}, 0, ${a})`;
                const w = Math.min(cellSize, this.width - lx);
                const h = Math.min(cellSize, this.height - ly);
                ctx.fillRect(sx + lx, sy + ly, w, h);
            }
        }

        // Bright embers
        const numEmbers = Math.floor(this.width * this.height / 8000);
        for (let i = 0; i < numEmbers; i++) {
            const ex = Math.sin(i * 73.7 + t * 0.5) * 0.5 + 0.5;
            const ey = Math.cos(i * 91.3 + t * 0.3) * 0.5 + 0.5;
            const ea = 0.3 + Math.sin(t * 3 + i * 2.1) * 0.3;
            ctx.fillStyle = `rgba(255, 200, 50, ${ea})`;
            ctx.beginPath();
            ctx.arc(sx + ex * this.width, sy + ey * this.height, 2 + Math.sin(t * 2 + i) * 1, 0, Math.PI * 2);
            ctx.fill();
        }

        if (game.showDebug) {
            ctx.strokeStyle = 'red';
            ctx.lineWidth = 2;
            ctx.strokeRect(sx, sy, this.width, this.height);
        }
    }
}

window.Lava = Lava;
