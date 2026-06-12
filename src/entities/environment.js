// Global size for every block variant. The block sheet (saborosa-assets-002)
// is high-res (~580–1020px native per crop), so this scales them down to world
// px. It is FIXED — blocks are no longer randomly sized like the old cubes;
// each variant keeps the sheet's relative proportions (a 3-crate row stays ~3x
// a single crate). 0.14 puts the smallest crate at ~80px, matching the old
// cube's small end. Tune this one number to make every block bigger/smaller.
const BLOCK_SCALE = 0.14;

/**
 * Rock - a pickable/throwable block. Driven by a def from block_defs
 * (assets/saborosa-assets-002-sprites.json): { x, y, w, h, kind:'block', col }.
 * The sheet crop + collision box come from the def; size is def * BLOCK_SCALE.
 * Only `block`-kind defs become Rocks (props become MapObjects instead).
 *
 * The class name stays `Rock` so the player's push/lift/throw/stack code and
 * the depth sort keep working unchanged — those key off width, height, the
 * collision box and mass, which are all still here.
 */
class Rock {
    constructor(game, x, y, def, opts = {}) {
        this.game = game;
        this.x = x;
        this.y = y;
        this.entityType = 'environment';
        this.isObstacle = true;
        this.pushable = true;
        this.flipX = !!opts.flipX;   // editor-placed blocks may mirror; random spawns don't

        // Sheet crop comes straight from the def.
        this.def = def;
        this.sx = def.x; this.sy = def.y; this.sw = def.w; this.sh = def.h;

        // Fixed world size (preserves the crop's aspect ratio).
        this.width = Math.round(def.w * BLOCK_SCALE);
        this.height = Math.round(def.h * BLOCK_SCALE);

        // Red collision footprint from the def's normalized `col` box (offX/offY/
        // w/h as fractions of the sprite). Mirror offX when flipped so the box
        // stays under the same visual feature.
        const col = def.col || { offX: 0.20, offY: 0.78, w: 0.60, h: 0.20 };
        this.colW = Math.round(this.width * col.w);
        this.colH = Math.round(this.height * col.h);
        const offX = Math.round(this.width * col.offX);
        this.colOffX = this.flipX ? (this.width - offX - this.colW) : offX;
        this.colOffY = Math.round(this.height * col.offY);
        this.mass = this.colW * this.colH;
        this._rect = { x: 0, y: 0, width: 0, height: 0 };

        // Stacking
        this.stackParent = null; // rock this one sits on
        this.stackChild = null;  // rock sitting on top of this one

        // Visual sink (mirrors player.onSand) — cropped render when on sand.
        this.onSand = false;

        // Falling (zone-driven stages). When a block ends up on a WALL pixel,
        // it falls until it hits a non-wall zone. Mirror of the player's
        // falling state. pushable flips to false during the fall.
        this.surfaceState = 'ground'; // 'ground' | 'falling'
        this.fallTimerMs = 0;
        this.fallStartSpeed = 1.5;
        this.fallMaxSpeed = 11;
        this.fallAccelPerSec = 15;

        // Throwing (parabolic flight). Set by Player.throwObject; advanced in
        // the main update loop. throwZ is a purely visual height offset — the
        // ground position (x, y) advances normally and is what depth-sorts.
        this.thrown = false;
        this.throwZ = 0;
        this.throwT = 0;
        this.throwDur = 0;
        this.throwH = 0;
        this.throwVx = 0;
        this.throwVy = 0;
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
        // Arc height during a throw lifts the sprite visually (ground y is
        // unchanged, so depth-sort and collision still use the ground spot).
        const sy = this.y - camY - (this.throwZ || 0);

        // Sink into sand: keep the TOP of the sprite and bury the base, scaling
        // the crop to the block's height so small blocks don't lose their whole
        // base while big ones still visibly settle (~0.30 of block height).
        const sinkAmount = this.onSand ? Math.round(this.height * 0.30) : 0;
        const visibleH = this.height - sinkAmount;
        const srcCropRatio = sinkAmount / this.height;

        const sheet = game.getDrawable('block_sheet');
        if (sheet) {
            const cropSh = this.sh * (1 - srcCropRatio);
            if (this.flipX) {
                ctx.save();
                ctx.translate(sx + this.width, sy);
                ctx.scale(-1, 1);
                ctx.drawImage(sheet, this.sx, this.sy, this.sw, cropSh, 0, 0, this.width, visibleH);
                ctx.restore();
            } else {
                ctx.drawImage(sheet, this.sx, this.sy, this.sw, cropSh, sx, sy, this.width, visibleH);
            }
        } else {
            ctx.fillStyle = '#787878';
            ctx.fillRect(sx, sy, this.width, visibleH);
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
