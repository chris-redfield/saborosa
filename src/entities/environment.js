// Cube sprite regions on `assets/cor-saborosa-box-01.png` (after whiteout).
// Each cube has a different top/side color combo. Detected via tight bbox
// over non-white pixels. Some orientations are taller, some wider.
const CUBE_REGIONS = [
    { x:   0, y:   0, w: 361, h: 422 },  // cube 1: gray top, green face, blue side
    { x: 432, y:   0, w: 361, h: 422 },  // cube 2: green top, yellow face, blue side
    { x: 859, y:   0, w: 361, h: 422 },  // cube 3: yellow top, red face, blue side
    { x: 518, y: 452, w: 361, h: 422 },  // cube 4: blue top, green face, yellow side
    { x:   0, y: 513, w: 422, h: 361 },  // cube 5: gray top, green face, blue side (low)
    { x: 972, y: 513, w: 422, h: 361 }   // cube 6: yellow top, green face, red side (low)
];

/**
 * Rock - Environment obstacle with collision
 */
class Rock {
    constructor(game, x, y, size, type) {
        this.game = game;
        this.x = x;
        this.y = y;
        this.entityType = 'environment';
        this.isObstacle = true;
        this.pushable = true;

        // Pick a cube region based on type (1..6). Modulo so any integer works.
        const regionIdx = (((type - 1) % CUBE_REGIONS.length) + CUBE_REGIONS.length) % CUBE_REGIONS.length;
        this.cubeRegion = CUBE_REGIONS[regionIdx];

        // Width from caller; height scaled to preserve the cube's aspect ratio.
        this.width = size;
        this.height = Math.round(size * this.cubeRegion.h / this.cubeRegion.w);

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

        // Falling (zone-driven stages). When a cube ends up on a WALL pixel,
        // it falls until it hits a non-wall zone. Mirror of the player's
        // falling state. pushable flips to false during the fall.
        this.surfaceState = 'ground'; // 'ground' | 'falling'
        this.fallTimerMs = 0;
        this.fallStartSpeed = 1.5;
        this.fallMaxSpeed = 11;
        this.fallAccelPerSec = 15;
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

        const sheet = game.getImage('cubes');
        if (sheet && this.cubeRegion) {
            const r = this.cubeRegion;
            ctx.drawImage(sheet, r.x, r.y, r.w, r.h, sx, sy, this.width, this.height);
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
