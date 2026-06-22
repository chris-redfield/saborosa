/**
 * Letter - decorative SABOROSA glyph scattered across the scenery via the map
 * editor (tools/map-editor.html). Pure eye-candy: NOT an obstacle, so it never
 * enters the collision/push pipeline (no getRect, mass, or isObstacle).
 *
 * Two things animate, both driven straight off performance.now() so no per-frame
 * update() tick is needed (the main loop only update()s obstacles):
 *   - bob   : a gentle vertical sine, amplitude scaled to the glyph height.
 *   - flicker: a smooth crossfade between the yellow sheet and a white-fill copy
 *             of the SAME artwork (saborosa-letters{,-white}.png). Because only
 *             the fill differs (the black outline is identical in both), the
 *             crossfade reads as the fill pulsing yellow<->white with no ghosting.
 *
 * Each glyph derives its phase from its world x, so a row of placed letters bobs
 * and pulses as a travelling wave rather than in lockstep.
 *
 * x/y are the top-left anchor (the editor stores placements that way); width/
 * height/x/y feed the existing bottom-edge depth sort + cull in main.js. The bob
 * is a visual-only offset and deliberately does NOT move the sort anchor, so a
 * bobbing letter keeps a stable draw order against the ground and its neighbours.
 */
const LETTER_BOB_FREQ = 2.1;    // rad/sec — vertical bob
const LETTER_BOB_REL = 0.05;    // bob amplitude as a fraction of glyph height
const LETTER_BOB_MIN = 6;       // px — floor so tiny glyphs still bob visibly
const LETTER_FLICK_FREQ = 2.6;  // rad/sec — yellow<->white crossfade

class Letter {
    constructor(game, def, placement) {
        this.game = game;
        this.entityType = 'letter';
        this.isObstacle = false;   // decorative — no collision at all

        this.sx = def.x; this.sy = def.y; this.sw = def.w; this.sh = def.h;
        this.flipX = !!placement.flipX;

        const scale = placement.scale || 1;
        this.width = Math.round(def.w * scale);
        this.height = Math.round(def.h * scale);

        this.x = placement.x;
        this.y = placement.y;

        // Phase from world x → neighbouring letters animate slightly out of sync.
        this.phase = placement.x * 0.012;
        this.bobAmp = Math.max(LETTER_BOB_MIN, this.height * LETTER_BOB_REL);
    }

    _blit(ctx, sheet, S, sx, sy) {
        if (this.flipX) {
            ctx.save();
            ctx.translate(sx + this.width, sy);
            ctx.scale(-1, 1);
            ctx.drawImage(sheet, this.sx * S, this.sy * S, this.sw * S, this.sh * S, 0, 0, this.width, this.height);
            ctx.restore();
        } else {
            ctx.drawImage(sheet, this.sx * S, this.sy * S, this.sw * S, this.sh * S, sx, sy, this.width, this.height);
        }
    }

    render(ctx, game, camX, camY) {
        const t = performance.now() / 1000;
        const bob = Math.sin(t * LETTER_BOB_FREQ + this.phase) * this.bobAmp;
        const white = 0.5 + 0.5 * Math.sin(t * LETTER_FLICK_FREQ + this.phase); // 0=yellow 1=white

        // Match Rock/MapObject: draw at the raw sub-pixel screen position so the
        // glyph slides with the sub-pixel-scrolling world instead of snapping.
        const sx = this.x - camX;
        const sy = this.y - camY + bob;

        const yellow = game.getDrawable('letters_sheet');
        const whiteSheet = game.getDrawable('letters_white_sheet');
        if (!yellow) {
            ctx.fillStyle = '#f2d94c';
            ctx.fillRect(sx, sy, this.width, this.height);
            return;
        }

        const S = game.getSheetScale('letters_sheet');
        this._blit(ctx, yellow, S, sx, sy);
        if (whiteSheet && white > 0.01) {
            ctx.save();
            ctx.globalAlpha = white;
            this._blit(ctx, whiteSheet, game.getSheetScale('letters_white_sheet'), sx, sy);
            ctx.restore();
        }

        if (game.showDebug) {
            ctx.strokeStyle = 'cyan';
            ctx.lineWidth = 1;
            ctx.strokeRect(this.x - camX, this.y - camY, this.width, this.height);
        }
    }
}

window.Letter = Letter;
