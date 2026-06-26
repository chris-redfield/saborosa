/**
 * OverlayObject - one discrete nature object (tree, plant, hole) recovered from
 * a baked overlay layer by tools/build-overlay-objects.py.
 *
 * This is what makes the player pass behind nature CORRECTLY: each object is a
 * separate entity with its own world position + footprint, so it slots into the
 * same bottom-edge depth sort as the old hand-placed assets (main.js) — the
 * player renders wholly in front of, or wholly behind, each object. A single
 * baked image can't do that (it has no per-object base), which is why the
 * earlier feet-split layer produced a seam and wrong occlusion.
 *
 * The sprite is a CROP of the full overlay sheet (the object's normalised bbox),
 * drawn at the object's world rect — visually identical to the baked layer, just
 * addressable per object. Placement is stored normalised (0..1 of the source
 * image) so it maps onto whatever world rect the stage uses, at any resolution.
 */
class OverlayObject {
    constructor(game, o, rect, collide) {
        this.game = game;
        this.entityType = 'overlay';
        this.sheetKey = o.sheet;

        // Normalised crop within the sheet (resolution-independent).
        this.nx = o.nx; this.ny = o.ny; this.nw = o.nw; this.nh = o.nh;

        // World placement = normalised bbox mapped onto the stage world rect.
        this.x = rect.x + o.nx * rect.w;
        this.y = rect.y + o.ny * rect.h;
        this.width = o.nw * rect.w;
        this.height = o.nh * rect.h;

        // Collision footprint (normalised to this object's own box), base-centred.
        const col = o.col || { offX: 0.3, offY: 0.82, w: 0.4, h: 0.16 };
        this.colW = Math.round(this.width * col.w);
        this.colH = Math.round(this.height * col.h);
        this.colOffX = Math.round(this.width * col.offX);
        this.colOffY = Math.round(this.height * col.offY);

        // Static scenery: never pushed/lifted. Collision is per-object (the JSON
        // `collide` flag) so holes can stay passable until their own logic lands.
        this.isObstacle = collide && o.collide !== false;
        this.pushable = false;
        this.liftable = false;
        this.mass = Infinity;

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
        // Raw sub-pixel screen pos (no rounding) so it slides with the world
        // instead of snapping against it — see the render-rounding convention.
        const sx = this.x - camX;
        const sy = this.y - camY;
        const sheet = game.getDrawable(this.sheetKey);
        if (sheet) {
            const dw = sheet.naturalWidth || sheet.width;
            const dh = sheet.naturalHeight || sheet.height;
            ctx.drawImage(sheet,
                this.nx * dw, this.ny * dh, this.nw * dw, this.nh * dh,
                sx, sy, this.width, this.height);
        }

        if (game.showDebug) {
            ctx.strokeStyle = '#39d';
            ctx.lineWidth = 1;
            ctx.strokeRect(sx, sy, this.width, this.height);
            if (this.isObstacle) {
                ctx.strokeStyle = 'red';
                ctx.strokeRect(sx + this.colOffX, sy + this.colOffY, this.colW, this.colH);
            }
        }
    }
}

window.OverlayObject = OverlayObject;
