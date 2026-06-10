/**
 * FxObject / FxManager — ambient, NO-COLLISION visual effects (assets-003).
 *
 * Unlike MapObject (placed on the map, blocks the player), these are pure eye
 * candy: they randomly pop in around the player's viewport, flicker, then fade
 * out — new ones keep appearing elsewhere. The "ball" entity ping-pongs through
 * its growing frames; every other entity twinkles (random shimmer), matching
 * the effects dialed in by tools/fx-lab.html.
 *
 * Defs come from assets/saborosa-assets-003-fx.json (game.getJSON('fx_defs')),
 * sprites from game.getImage('fx_sheet'). No block/obstacle/collision wiring —
 * the manager owns the instances and draws them directly inside the camera
 * transform (see main.js renderGame), so the player walks right through them.
 */
(function () {

const SHEET_KEY = 'fx_sheet';
const DEFS_KEY  = 'fx_defs';

// One live FX instance. Position is stored as a world-space CENTER so growing
// ball frames expand symmetrically.
class FxObject {
    constructor(game, cx, cy, scale, kind, frames, fx, fps) {
        this.game = game;
        this.cx = cx; this.cy = cy;          // world-space center
        this.scale = scale;
        this.kind = kind;                    // 'ball' | 'twinkle'
        this.frames = frames;                // [{x,y,w,h}] — 1 for twinkle, N for ball
        this.fx = fx || {};                  // { speedHz, minOpacity }
        this.fps = fps || 10;

        this.age = 0;
        // Lifecycle: play the effect ONCE then vanish (random time can come
        // later). Ball dies when its ping-pong completes; twinkle does a single
        // rise-and-fall shimmer (~one cycle). Slight randomness desyncs them.
        if (kind === 'ball') {
            this.life = (2 * (frames.length - 1)) / this.fps + 1; // safety cap only
            this.fadeT = 0;
        } else {
            this.life = 1.0 + Math.random() * 0.6;   // ~one shimmer cycle
            this.fadeT = this.life / 2;               // pure rise->fall, no hold
        }
        this.phase = Math.random() * Math.PI * 2;  // desync shimmer/animation
        this.frameI = 0; this.dir = 1; this.frameTimer = 0;
        this.alpha = 0; this.dead = false;
    }

    update(dt) {
        this.age += dt;

        if (this.kind === 'ball') {
            // Single ping-pong: grow to the largest frame, shrink back, then
            // vanish. The shrink IS the vanish (no fade needed) — a quick fade-in
            // only softens the pop-in.
            this.frameTimer += dt;
            const step = 1 / this.fps;
            while (this.frameTimer >= step) {
                this.frameTimer -= step;
                this.frameI += this.dir;
                if (this.frameI >= this.frames.length - 1) { this.frameI = this.frames.length - 1; this.dir = -1; }
                else if (this.frameI <= 0 && this.dir === -1) { this.frameI = 0; this.dead = true; break; }
            }
            this.alpha = Math.min(1, this.age / 0.2);
            return;
        }

        // Twinkle: shimmer once over its lifetime, then vanish. Random life so
        // they don't all pop together. Fade in -> shimmer -> fade out.
        if (this.age >= this.life) { this.dead = true; return; }
        let env = 1;
        if (this.age < this.fadeT) env = this.age / this.fadeT;
        else if (this.age > this.life - this.fadeT) env = (this.life - this.age) / this.fadeT;
        const t = this.age + this.phase;
        const hz = this.fx.speedHz || 1;
        const minA = this.fx.minOpacity || 0;
        const shimmer = (0.55 + 0.45 * Math.sin(t * hz * 2 * Math.PI)) * (0.6 + 0.4 * Math.random());
        this.alpha = env * (minA + (1 - minA) * shimmer);
    }

    render(ctx, camX, camY) {
        const img = this.game.getImage(SHEET_KEY);
        if (!img) return;
        const f = this.frames[Math.min(this.frameI, this.frames.length - 1)];
        const dw = f.w * this.scale, dh = f.h * this.scale;
        ctx.globalAlpha = Math.max(0, Math.min(1, this.alpha));
        ctx.drawImage(img, f.x, f.y, f.w, f.h, this.cx - dw / 2 - camX, this.cy - dh / 2 - camY, dw, dh);
        ctx.globalAlpha = 1;
    }
}

// Spawns/maintains a small pool of FX around the player's viewport.
class FxManager {
    constructor(game, opts = {}) {
        this.game = game;
        this.list = [];
        this.target = opts.target != null ? opts.target : 7;        // simultaneous FX
        this.ballChance = opts.ballChance != null ? opts.ballChance : 0.2;
        this.baseScale = opts.scale != null ? opts.scale : 0.15;
        this.spread = opts.spread != null ? opts.spread : 0.85;     // fraction of half-view to scatter across

        const defs = game.getJSON(DEFS_KEY);
        this.singles = [];        // non-ball entity boxes (twinkle)
        this.ballFrames = [];     // ordered ball frames (ping-pong)
        this.fps = 10;
        this.entityFx = { speedHz: 1, minOpacity: 0 };
        if (defs) {
            for (const r of defs.rows || []) {
                if (r.category === 'ignore' || r.category === 'ball') continue;
                for (const b of r.boxes) this.singles.push(b);
            }
            this.ballFrames = (defs.animation && defs.animation.frames) || [];
            if (defs.animation && defs.animation.fps) this.fps = defs.animation.fps;
            if (defs.entityFx) this.entityFx = { speedHz: defs.entityFx.speedHz, minOpacity: defs.entityFx.minOpacity };
        }
        this.ready = !!(this.singles.length || this.ballFrames.length);
    }

    _spawn(cx, cy, scale) {
        const s = scale || 1;
        const halfW = (this.game.width / 2) / s * this.spread;
        const halfH = (this.game.height / 2) / s * this.spread;
        const px = cx + (Math.random() * 2 - 1) * halfW;
        const py = cy + (Math.random() * 2 - 1) * halfH;

        const useBall = this.ballFrames.length && Math.random() < this.ballChance;
        const frames = useBall ? this.ballFrames : [this.singles[(Math.random() * this.singles.length) | 0]];
        const sc = this.baseScale * (0.8 + Math.random() * 0.5);
        this.list.push(new FxObject(this.game, px, py, sc, useBall ? 'ball' : 'twinkle', frames, this.entityFx, this.fps));
    }

    // cx,cy = player world center; scale = world.cameraScale (so the scatter
    // box matches what's actually visible at the current zoom).
    update(dt, cx, cy, scale) {
        if (!this.ready) return;
        for (const fx of this.list) fx.update(dt);
        this.list = this.list.filter(fx => !fx.dead);
        let guard = 0;
        while (this.list.length < this.target && guard++ < 64) this._spawn(cx, cy, scale);
    }

    render(ctx, camX, camY) {
        if (!this.ready) return;
        for (const fx of this.list) fx.render(ctx, camX, camY);
    }
}

window.FxObject = FxObject;
window.FxManager = FxManager;

})();
