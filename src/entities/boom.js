/**
 * BoomEffect — a one-shot explosion animation played at a world position.
 *
 * Frames + timing come from a defs object (assets-v2/saborosa-boom.json), which
 * is exactly what tools/boom-test.html exports: pick the frames you want there
 * ("sheet view": click a frame to drop it), Copy defs JSON, and the `frames`
 * array here is the subset that plays, in order.
 *
 *   frames  : [[sx, sy, sw, sh], ...]  crops in the boom sheet (play order)
 *   frameMs : ms per frame
 *   scale   : world px per source px (overall size)
 *   anchorY : 0 top · 0.5 center · 1 bottom of the frame sits on (x, y)
 *
 * The effect is centered horizontally on (x, y). `done` latches true when the
 * last frame finishes so the owner can drop it.
 */
class BoomEffect {
    constructor(game, x, y, defs) {
        this.game = game;
        this.x = x;
        this.y = y;
        this.frames = (defs && defs.frames) || [];
        this.frameMs = (defs && defs.frameMs) || 55;
        this.scale = (defs && defs.scale) || 1.3;
        this.anchorY = (defs && defs.anchorY != null) ? defs.anchorY : 0.5;
        this.sheetKey = (defs && defs.sheetKey) || 'boom_sheet';
        this.t = 0;
        this.done = false;
    }

    update(dt) {
        this.t += dt * 1000;
        if (this.frames.length === 0 || this.t >= this.frames.length * this.frameMs) {
            this.done = true;
        }
    }

    render(ctx, game, camX, camY) {
        const n = this.frames.length;
        if (!n) return;
        const idx = Math.min(n - 1, Math.floor(this.t / this.frameMs));
        const f = this.frames[idx];
        const img = game.getDrawable(this.sheetKey);
        if (!img || !(img.naturalWidth || img.width)) return;
        const dw = f[2] * this.scale, dh = f[3] * this.scale;
        const dx = (this.x - camX) - dw / 2;
        const dy = (this.y - camY) - dh * this.anchorY;
        ctx.drawImage(img, f[0], f[1], f[2], f[3], dx, dy, dw, dh);
    }
}

window.BoomEffect = BoomEffect;
