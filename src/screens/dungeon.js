/**
 * DungeonScreen — the interior "fell down a hole" view.
 *
 * A completely different render model from the top-down overworld: a single
 * one-point-perspective background (saborosa-dungeon-fundo-novo.png) with the
 * character walking on a screen-space floor trapezoid that narrows toward a
 * vanishing point. Ported straight from tools/dungeon-perspective.html — the
 * perspective math and tuned params are identical, just wired to the game's
 * engine (input, asset cache, current character sprite pack) instead of the
 * tool's standalone loop.
 *
 * Movement is depth (t: 0 near/front .. 1 far/back) + lateral (L: -1 left wall
 * .. +1 right wall). Up walks IN (deeper, smaller); down walks OUT (nearer,
 * bigger). All positions are normalized to the displayed background rect, so
 * the numbers transfer 1:1 from the tuning tool.
 */
class DungeonScreen {
    constructor(game, player, cfg = {}) {
        this.game = game;
        this.player = player;      // for the current sprite pack + facing frames
        this.bgKey = cfg.bg || 'dungeon_bg';
        this.DUN_W = cfg.nativeW || 6132; // native dungeon dimensions
        this.DUN_H = cfg.nativeH || 4916;

        // Tuned perspective params (defaults from the perspective tool). A stage
        // may override any of them via stage.dungeon.perspective.
        this.params = Object.assign({
            vpX: 0.505, vpY: 0.545,   // vanishing point (center of the back wall)
            yNear: 1.00, yFar: 0.675, // floor front/back edge (normalized Y)
            halfNear: 0.475, halfFar: 0.170, // floor half-width near/far
            fracNear: 0.160, fracFar: 0.08,  // sprite height (× bg height) near/far
            sizeScale: 0.5,           // overall sprite size multiplier
            moveSpeed: 0.35,          // depth travel in t-units/sec
            perspLock: true,          // derive fracFar from geometry (exact)
            perspSpeed: true          // constant ground speed (slower when far)
        }, cfg.perspective || {});

        this.t = cfg.startT != null ? cfg.startT : 0.12; // land near the front
        this.L = 0;
        this.facing = 'down'; // faces the camera as he drops in
        this.bg = { x: 0, y: 0, w: 0, h: 0 };
        this.fadeIn = 1; // black → clear on entry

        // Cat statue on the back wall — a 3-frame flame loop. The frames are
        // full-canvas overlays pre-aligned to the background, so we just draw the
        // current one over the same displayed bg rect. ~0.3s per frame.
        this.gatoFrames = ['dungeon_gato_1', 'dungeon_gato_2', 'dungeon_gato_3'];
        this.gatoFrame = 0;
        this.gatoTimer = 0;
        this.gatoDur = 0.2;
        this.gatoOffsetX = -10; // nudge the statue left of the bg-aligned position (screen px)

        // Statue collision: a solid box on the back-centre floor, expressed in
        // the same (t: depth, L: lateral) space the player moves in. Derived from
        // the art's opaque footprint (base at depth ~0.90, spanning L≈-0.36..0.48),
        // pulled a touch forward so the player stops just in front. Walk around
        // the sides (L outside the band) to reach the back corners. Stage-tunable
        // via cfg.statue.
        this.statue = Object.assign({ tFront: 0.85, lMin: -0.42, lMax: 0.50 }, cfg.statue || {});

        // Fall from the ceiling on entry, reusing the overworld fall dynamics
        // (px/frame @ the fixed 60fps timestep). Movement is locked until he
        // lands. dropOffset is the px above the floor point and is lazily
        // initialized once the layout (and thus the floor point) is known.
        this.falling = true;
        this.fallTimerMs = 0;
        this.dropOffset = null;
        this.ceilFrac = cfg.ceilingFrac != null ? cfg.ceilingFrac : 0.10; // start Y
        this.fallStartSpeed = (player && player.fallStartSpeed) || 1.8;
        this.fallAccelPerSec = (player && player.fallAccelPerSec) || 18;
        this.fallMaxSpeed = (player && player.fallMaxSpeed) || 14.3;
    }

    // Contain-fit the dungeon image into the game canvas, centered (letterboxed).
    _layout() {
        const g = this.game;
        const s = Math.min(g.width / this.DUN_W, g.height / this.DUN_H);
        this.bg.w = this.DUN_W * s;
        this.bg.h = this.DUN_H * s;
        this.bg.x = (g.width - this.bg.w) / 2;
        this.bg.y = (g.height - this.bg.h) / 2;
    }

    // Geometrically-exact far size when perspLock is on, so scale stays strictly
    // proportional to (footY - vanishingY).
    _effFracFar() {
        const p = this.params;
        if (!p.perspLock) return p.fracFar;
        const span = p.yNear - p.vpY;
        if (span <= 0) return p.fracFar;
        return p.fracNear * (p.yFar - p.vpY) / span;
    }

    _fracAt(tt) {
        const p = this.params;
        return (p.fracNear + (this._effFracFar() - p.fracNear) * tt) * p.sizeScale;
    }

    // Floor sample at (depth tt, lateral LL) → screen px { x, y, frac }.
    _floorPoint(tt, LL) {
        const p = this.params;
        const yN = p.yNear + (p.yFar - p.yNear) * tt;
        const halfW = p.halfNear + (p.halfFar - p.halfNear) * tt;
        const xN = p.vpX + LL * halfW;
        return {
            x: this.bg.x + xN * this.bg.w,
            y: this.bg.y + yN * this.bg.h,
            frac: this._fracAt(tt)
        };
    }

    update(dt) {
        this._layout();

        // Statue flame loop advances in every state (including the entry fall).
        this.gatoTimer += dt;
        if (this.gatoTimer >= this.gatoDur) {
            this.gatoTimer -= this.gatoDur;
            this.gatoFrame = (this.gatoFrame + 1) % this.gatoFrames.length;
        }

        // Ceiling fall on entry — same accel curve as the overworld fall. Walking
        // is locked until he touches the floor.
        if (this.falling) {
            const fp = this._floorPoint(this.t, this.L);
            if (this.dropOffset == null) {
                const ceilY = this.bg.y + this.ceilFrac * this.bg.h;
                this.dropOffset = Math.max(0, fp.y - ceilY);
            }
            this.fallTimerMs += dt * 1000;
            const vel = Math.min(this.fallMaxSpeed,
                this.fallStartSpeed + this.fallAccelPerSec * (this.fallTimerMs / 1000));
            this.dropOffset -= vel;
            if (this.dropOffset <= 0) { this.dropOffset = 0; this.falling = false; }
            if (this.fadeIn > 0) this.fadeIn = Math.max(0, this.fadeIn - dt / 0.35);
            return; // airborne — no walking yet
        }

        const mv = this.game.input.getMovementVector(); // x:-1..1, y:-1..1 (up=-1)
        const dT = -mv.y; // up → deeper
        const dL = mv.x;
        const p = this.params;

        // Constant ground speed: cover fewer screen px per step the farther away.
        const persp = p.perspSpeed ? (this._fracAt(this.t) / this._fracAt(0)) : 1;
        const oldT = this.t, oldL = this.L;
        let nt = Math.max(0, Math.min(1, oldT + dT * p.moveSpeed * persp * dt));
        let nl = Math.max(-1, Math.min(1, oldL + dL * p.moveSpeed * dt));

        // Statue collision (solid box on the back wall). Resolve depth first, then
        // lateral: block walking deeper into it, but allow sliding along the front
        // face and around the sides. The per-axis check keeps corners passable.
        const sb = this.statue;
        if (sb) {
            const inBandOld = oldL >= sb.lMin && oldL <= sb.lMax;
            if (inBandOld && nt > sb.tFront) nt = sb.tFront;
            const inBandNew = nl >= sb.lMin && nl <= sb.lMax;
            if (inBandNew && nt > sb.tFront) nl = oldL;
        }
        this.t = nt;
        this.L = nl;

        const up = dT > 0, down = dT < 0, right = dL > 0, left = dL < 0;
        if (up && right) this.facing = 'up_right';
        else if (up && left) this.facing = 'up_left';
        else if (down && right) this.facing = 'down_right';
        else if (down && left) this.facing = 'down_left';
        else if (up) this.facing = 'up';
        else if (down) this.facing = 'down';
        else if (right) this.facing = 'right';
        else if (left) this.facing = 'left';

        if (this.fadeIn > 0) this.fadeIn = Math.max(0, this.fadeIn - dt / 0.35);
    }

    render(ctx) {
        this._layout();
        const g = this.game;
        ctx.fillStyle = '#0c1020';
        ctx.fillRect(0, 0, g.width, g.height);
        ctx.imageSmoothingEnabled = true;

        const img = g.getDrawable(this.bgKey);
        if (img && (img.naturalWidth || img.width)) {
            ctx.drawImage(img, this.bg.x, this.bg.y, this.bg.w, this.bg.h);
        }

        // Cat statue on the back wall — full-canvas overlay aligned to the bg, so
        // it shares the bg rect exactly. Drawn before the character so he passes
        // in front of it as he approaches the wall.
        const gato = g.getDrawable(this.gatoFrames[this.gatoFrame]);
        if (gato && (gato.naturalWidth || gato.width)) {
            ctx.drawImage(gato, this.bg.x + this.gatoOffsetX, this.bg.y, this.bg.w, this.bg.h);
        }

        // Character — reuse the equipped pack's idle frame for the facing, feet
        // (bottom-center) anchored on the floor point, sized by perspective.
        const fp = this._floorPoint(this.t, this.L);
        const spr = this.player && this.player.sprites;
        const fr = spr && ((spr[`${this.facing}_idle`] && spr[`${this.facing}_idle`][0])
            || (spr['down_idle'] && spr['down_idle'][0]));
        const spriteH = fp.frac * this.bg.h;
        if (fr && fr.image) {
            const aspect = fr.sw / fr.sh;
            const spriteW = spriteH * aspect;
            // While falling in, lift the feet by dropOffset so he descends from
            // the ceiling straight down onto the floor point (constant size — the
            // ceiling is directly above the landing spot, i.e. the same depth).
            const drop = this.dropOffset || 0;
            const dx = fp.x - spriteW / 2;
            const dy = fp.y - spriteH - drop;
            ctx.save();
            if (fr.flipped) {
                ctx.translate(dx + spriteW, dy);
                ctx.scale(-1, 1);
                ctx.drawImage(fr.image, fr.sx, fr.sy, fr.sw, fr.sh, 0, 0, spriteW, spriteH);
            } else {
                ctx.drawImage(fr.image, fr.sx, fr.sy, fr.sw, fr.sh, dx, dy, spriteW, spriteH);
            }
            ctx.restore();
        }

        if (this.fadeIn > 0) {
            ctx.fillStyle = `rgba(0,0,0,${this.fadeIn})`;
            ctx.fillRect(0, 0, g.width, g.height);
        }

        // Exit hint — press E to climb back out to the overworld.
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.font = '13px monospace';
        ctx.fillText('[E] climb out', 14, g.height - 16);
    }
}

window.DungeonScreen = DungeonScreen;
