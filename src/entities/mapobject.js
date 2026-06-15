/**
 * MapObject - static decorative map asset (plants, trees, grass, fruit, rocks)
 * placed via the map editor (tools/map-editor.html).
 *
 * Mirrors Rock/LiveRock so it slots into the existing collision + depth-sort
 * pipeline with no special-casing:
 *   - isObstacle + non-pushable  -> Player._resolveAxis blocks on its getRect()
 *   - x/y/width/height           -> the bottom-edge (y+height) depth sort in
 *                                   main.js renders the player behind it when
 *                                   above and in front when below
 *
 * The visual is a crop of an asset sheet (default game image 'mapobjects_sheet',
 * or another key passed as `sheetKey` — e.g. 'block_sheet' for the assets-002
 * "prop" structures) described by a def { x, y, w, h, col }. `col` is the
 * normalized red-collision box (the rest of the sprite is freely passable /
 * "green"). Each placement may scale and flip the sprite; the collision box
 * scales with it and mirrors when flipped.
 */
class MapObject {
    constructor(game, def, placement, sheetKey = 'mapobjects_sheet') {
        this.game = game;
        this.entityType = 'mapobject';
        this.isObstacle = true;
        this.pushable = false;   // static — Player blocks outright on contact
        this.liftable = false;
        this.sheetKey = sheetKey;

        // Sheet crop.
        this.sx = def.x; this.sy = def.y; this.sw = def.w; this.sh = def.h;
        this.flipX = !!placement.flipX;

        const scale = placement.scale || 1;
        this.width = Math.round(def.w * scale);
        this.height = Math.round(def.h * scale);

        // World position = top-left (placement stores it that way).
        this.x = placement.x;
        this.y = placement.y;

        // Red collision box (normalized -> px). Mirror offX when flipped so the
        // box stays under the same visual feature.
        const col = def.col || { offX: 0.2, offY: 0.78, w: 0.6, h: 0.2 };
        this.colW = Math.round(this.width * col.w);
        this.colH = Math.round(this.height * col.h);
        const offX = Math.round(this.width * col.offX);
        this.colOffX = this.flipX ? (this.width - offX - this.colW) : offX;
        this.colOffY = Math.round(this.height * col.offY);
        this.mass = Infinity;    // never pushed

        this._rect = { x: 0, y: 0, width: 0, height: 0 };
    }

    getRect() {
        this._rect.x = this.x + this.colOffX;
        this._rect.y = this.y + this.colOffY;
        this._rect.width = this.colW;
        this._rect.height = this.colH;
        return this._rect;
    }

    render(ctx, game, camX, camY) {
        // Match Rock/Player: render at the raw sub-pixel screen position. The
        // whole world scrolls at fractional precision (cameraX tracks the
        // fractional player position; the background pans its source rect
        // sub-pixel). Rounding here alone made placed props snap in 1-px steps
        // while everything else slid smoothly — they appeared to jitter/swim
        // against the ground as the camera moved.
        const sx = this.x - camX;
        const sy = this.y - camY;
        const sheet = game.getDrawable(this.sheetKey);

        if (sheet) {
            // Defs coords are author-resolution; the game sheet is downscaled.
            const S = game.getSheetScale(this.sheetKey);
            if (this.flipX) {
                ctx.save();
                ctx.translate(sx + this.width, sy);
                ctx.scale(-1, 1);
                ctx.drawImage(sheet, this.sx * S, this.sy * S, this.sw * S, this.sh * S, 0, 0, this.width, this.height);
                ctx.restore();
            } else {
                ctx.drawImage(sheet, this.sx * S, this.sy * S, this.sw * S, this.sh * S, sx, sy, this.width, this.height);
            }
        } else {
            ctx.fillStyle = '#5a7d3a';
            ctx.fillRect(sx, sy, this.width, this.height);
        }

        if (game.showDebug) {
            ctx.strokeStyle = 'yellow';
            ctx.lineWidth = 1;
            ctx.strokeRect(sx, sy, this.width, this.height);
            ctx.strokeStyle = 'red';
            ctx.strokeRect(sx + this.colOffX, sy + this.colOffY, this.colW, this.colH);
        }
    }
}

window.MapObject = MapObject;
