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
 *
 * All the FEEL knobs (how many, how often, size, flicker) live in
 * src/entities/fxobject.config.js (window.FX_JUICE) — change the frequency
 * there via `count`. This file is just the behavior.
 */
(function () {

const SHEET_KEY = 'fx_sheet';
const DEFS_KEY  = 'fx_defs';

// Default feel params if the config file didn't load (config is the real source).
const FX_DEFAULTS = {
    twinkle: { lifeMin: 1.0, lifeJitter: 0.6, speedHz: 1.0, minOpacity: 0.0 },
    ball: { fps: 10, fadeInSec: 0.2 },
};

// One live FX instance. Position is stored as a world-space CENTER so growing
// ball frames expand symmetrically.
class FxObject {
    constructor(game, cx, cy, scale, kind, frames) {
        this.game = game;
        this.cx = cx; this.cy = cy;          // world-space center
        this.scale = scale;
        this.kind = kind;                    // 'ball' | 'twinkle'
        this.frames = frames;                // [{x,y,w,h}] — 1 for twinkle, N for ball

        const cfg = window.FX_JUICE || {};
        this.tw = cfg.twinkle || FX_DEFAULTS.twinkle;
        this.bl = cfg.ball || FX_DEFAULTS.ball;
        this.fps = this.bl.fps || 10;

        this.age = 0;
        // Lifecycle: play the effect ONCE then vanish (random time can come
        // later via twinkle.lifeJitter). Ball dies when its ping-pong completes;
        // twinkle does a single rise-and-fall shimmer (~one cycle).
        if (kind === 'ball') {
            this.life = (2 * (frames.length - 1)) / this.fps + 1; // safety cap only
            this.fadeT = 0;
        } else {
            this.life = this.tw.lifeMin + Math.random() * this.tw.lifeJitter;
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
            this.alpha = Math.min(1, this.age / (this.bl.fadeInSec || 0.2));
            return;
        }

        // Twinkle: shimmer once over its lifetime, then vanish. Random life so
        // they don't all pop together. Fade in -> shimmer -> fade out.
        if (this.age >= this.life) { this.dead = true; return; }
        let env = 1;
        if (this.age < this.fadeT) env = this.age / this.fadeT;
        else if (this.age > this.life - this.fadeT) env = (this.life - this.age) / this.fadeT;
        const t = this.age + this.phase;
        const hz = this.tw.speedHz || 1;
        const minA = this.tw.minOpacity || 0;
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

        // Feel defaults come from window.FX_JUICE (fxobject.config.js); `opts`
        // lets main.js override per stage.
        const cfg = window.FX_JUICE || {};
        const pick = (o, c, d) => (o != null ? o : (c != null ? c : d));
        this.target = pick(opts.target, cfg.count, 7);              // simultaneous FX = frequency dial
        this.ballChance = pick(opts.ballChance, cfg.ballChance, 0.2);
        this.baseScale = pick(opts.scale, cfg.scale, 0.15);
        this.scaleJitter = pick(opts.scaleJitter, cfg.scaleJitter, 0.5);
        this.spread = pick(opts.spread, cfg.spread, 0.85);          // fraction of half-view to scatter across

        const defs = game.getJSON(DEFS_KEY);
        this.singles = [];        // non-ball entity boxes (twinkle)
        this.ballFrames = [];     // ordered ball frames (ping-pong)
        if (defs) {
            for (const r of defs.rows || []) {
                if (r.category === 'ignore' || r.category === 'ball') continue;
                for (const b of r.boxes) this.singles.push(b);
            }
            this.ballFrames = (defs.animation && defs.animation.frames) || [];
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
        const sc = this.baseScale * (0.8 + Math.random() * this.scaleJitter);
        this.list.push(new FxObject(this.game, px, py, sc, useBall ? 'ball' : 'twinkle', frames));
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
