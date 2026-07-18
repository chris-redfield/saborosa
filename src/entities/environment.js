// Global size for every block variant. Scales a def's crop (in the objects
// sheet's native px, ~60–230px per object) down to world px. It is FIXED —
// blocks are not randomly sized; each keeps the sheet's relative proportions
// (a 3-crate row stays ~3x a single crate). Tune this one number to make every
// block bigger/smaller.
//
// The new objects sheet (saborosa-objetos-novos) has crops ~6x smaller than the
// old assets-002 master, so the scale is ~6x the old value (0.14*0.8*0.9 ≈ 0.101)
// for a comparable on-screen size. 0.86 matched the old world sizes; trimmed 15%
// to 0.73 (user: blocks read too big).
const BLOCK_SCALE = 0.73;

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

        // Fixed world size (preserves the crop's aspect ratio). def.sizeMul is a
        // per-object tweak on top of the global scale (the crate/cube clusters on
        // the sheet's last two rows ship at 0.8 — they read too big otherwise).
        const scale = BLOCK_SCALE * (def.sizeMul || 1);
        this.width = Math.round(def.w * scale);
        this.height = Math.round(def.h * scale);

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

        // Depth perspective: scale the DRAWN sprite (only) by where the block's
        // feet sit in the stage's perspective band — bigger to the south,
        // smaller to the north — matching the player/enemy. Collision, movement
        // and depth-sort use the unscaled box, so only the visual responds
        // (pscale is 1 when the stage has no perspective config). Uses the
        // GROUND y (not throwZ) so a thrown block keeps its ground-level size.
        let pscale = 1;
        if (game.world && game.world.getPerspectiveScale) {
            const feetY = this.y + this.colOffY + this.colH * 0.5;
            pscale = game.world.getPerspectiveScale(feetY);
        }
        const renderW = this.width * pscale;
        const renderH = this.height * pscale;

        // Bottom-anchored on the collision column so the block stays planted as
        // it scales (a smaller block sits lower, not floating), mirroring the
        // player/enemy feet anchor.
        let baseX = sx;
        if (renderW !== this.width) {
            // Raw sub-pixel, no round: the world scrolls fractionally, so
            // rounding baseX here alone snapped the block in 1-px steps and made
            // it shake against the ground as the camera moved. Matches
            // MapObject/Player convention (see render_rounding_jitter notes).
            const colCenter = sx + this.colOffX + this.colW / 2;
            baseX = colCenter - renderW / 2;
        }
        const baseY = sy + this.height - renderH;

        // Sink into sand: keep the TOP of the sprite and bury the base, scaling
        // the crop to the block's (scaled) height so small blocks don't lose
        // their whole base while big ones still visibly settle (~0.30 of height).
        const sinkAmount = this.onSand ? Math.round(renderH * 0.30) : 0;
        const visibleH = renderH - sinkAmount;
        const srcCropRatio = sinkAmount / renderH;

        const sheet = game.getDrawable('block_sheet');
        if (sheet) {
            const cropSh = this.sh * (1 - srcCropRatio);
            // Defs coords are author-resolution; the game sheet is downscaled.
            const S = game.getSheetScale('block_sheet');
            if (this.flipX) {
                ctx.save();
                ctx.translate(baseX + renderW, baseY);
                ctx.scale(-1, 1);
                ctx.drawImage(sheet, this.sx * S, this.sy * S, this.sw * S, cropSh * S, 0, 0, renderW, visibleH);
                ctx.restore();
            } else {
                ctx.drawImage(sheet, this.sx * S, this.sy * S, this.sw * S, cropSh * S, baseX, baseY, renderW, visibleH);
            }
        } else {
            ctx.fillStyle = '#787878';
            ctx.fillRect(baseX, baseY, renderW, visibleH);
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
