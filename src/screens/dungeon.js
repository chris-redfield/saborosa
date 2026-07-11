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
        this.name = cfg.name || 'Dungeon 1'; // shown in the C-debug overlay
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

        // Statue (cat furnace) collision: a UNION of axis-aligned boxes on the
        // back-centre floor, in the same (t: depth, L: lateral) space the player
        // moves in. A big body box plus two small paw boxes poking forward, so the
        // player stops on the paws too. Each box is { tMin, tMax, lMin, lMax }
        // (tMin = front edge nearest the camera). Tune with tools/dungeon-perspective.html
        // (Cat Collision tab) and paste the exported array as cfg.statueBoxes.
        // Back-compat: an old single cfg.statue { tFront, lMin, lMax } is converted.
        this.statueBoxes = cfg.statueBoxes
            ? cfg.statueBoxes.map(b => ({ tMin: b.tMin, tMax: b.tMax != null ? b.tMax : 1, lMin: b.lMin, lMax: b.lMax }))
            : cfg.statue
                ? [{ tMin: cfg.statue.tFront, tMax: 1, lMin: cfg.statue.lMin, lMax: cfg.statue.lMax }]
                : [
                    { name: 'body',  tMin: 0.85, tMax: 1.00, lMin: -0.42, lMax: 0.50 },
                    { name: 'paw L', tMin: 0.80, tMax: 0.90, lMin: -0.42, lMax: -0.14 },
                    { name: 'paw R', tMin: 0.80, tMax: 0.90, lMin: 0.22, lMax: 0.50 },
                  ];

        // A barrel prop (block_03 from the assets-002 sheet) dropped at a RANDOM
        // floor spot every time the dungeon is entered (this screen is rebuilt on
        // each entry, so a fresh Math.random() here reshuffles it). Kept in front
        // of the cat (t well below the statue band) and off the side walls + the
        // spawn point so it never lands on top of the player or the furnace. It's
        // solid: a small (t,L) footprint added to the collision boxes.
        const rnd = (a, b) => a + Math.random() * (b - a);
        this.barrel = {
            defKey: 'block_03',
            t: rnd(0.30, 0.72),
            L: rnd(-0.70, 0.70),
            scale: cfg.barrelScale != null ? cfg.barrelScale : 1.0,
        };
        const bt = 0.028, bl = 0.06; // collision half-extents in (t, L)
        this.barrel.box = {
            name: 'barrel',
            tMin: this.barrel.t - bt, tMax: this.barrel.t + bt,
            lMin: this.barrel.L - bl, lMax: this.barrel.L + bl,
        };

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

    // All solid collision boxes: the cat furnace + the barrel prop.
    _solidBoxes() {
        return this.barrel ? this.statueBoxes.concat(this.barrel.box) : this.statueBoxes;
    }

    // Reject the player from every solid box with per-axis resolution (depth
    // first, then lateral) so faces block but corners stay passable.
    _resolveStatue(oldT, oldL, nt, nl) {
        const boxes = this._solidBoxes();
        let rt = nt, rl = oldL;
        for (const b of boxes) {
            if (rl > b.lMin && rl < b.lMax) {
                if (oldT <= b.tMin && rt > b.tMin) rt = b.tMin;
                else if (oldT >= b.tMax && rt < b.tMax) rt = b.tMax;
            }
        }
        rl = nl;
        for (const b of boxes) {
            // tMax INCLUSIVE: a box whose back edge is on the wall (tMax=1) must
            // still block lateral entry when the player is pinned at the wall, or
            // they slide straight through the footprint behind it. tMin stays
            // EXCLUSIVE so sliding along the front face still works.
            if (rt > b.tMin && rt <= b.tMax) {
                if (oldL <= b.lMin && rl > b.lMin) rl = b.lMin;
                else if (oldL >= b.lMax && rl < b.lMax) rl = b.lMax;
            }
        }
        return { t: rt, L: rl };
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

        // Statue collision (union of solid boxes). Resolve depth first, then
        // lateral, against every box: block walking into a face, but allow sliding
        // along faces and around the sides. Per-axis keeps corners passable.
        const r = this._resolveStatue(oldT, oldL, nt, nl);
        this.t = r.t;
        this.L = r.L;

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

    // Character — reuse the equipped pack's idle frame for the facing, feet
    // (bottom-center) anchored on the floor point, sized by perspective.
    _drawCharacter(ctx) {
        const fp = this._floorPoint(this.t, this.L);
        const spr = this.player && this.player.sprites;
        const fr = spr && ((spr[`${this.facing}_idle`] && spr[`${this.facing}_idle`][0])
            || (spr['down_idle'] && spr['down_idle'][0]));
        if (!fr || !fr.image) return;
        const spriteH = fp.frac * this.bg.h;
        const aspect = fr.sw / fr.sh;
        const spriteW = spriteH * aspect;
        // While falling in, lift the feet by dropOffset so he descends from the
        // ceiling straight down onto the floor point (constant size — the ceiling
        // is directly above the landing spot, i.e. the same depth).
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

    // Barrel prop — block_03 from the assets-002 sheet, feet (bottom-center) on
    // its floor point, sized by perspective like the character. The def coords are
    // author-resolution; the game sheet is downscaled (getSheetScale).
    _drawBarrel(ctx) {
        const defs = this.game.getJSON('block_defs');
        const def = defs && defs.assets && defs.assets[this.barrel.defKey];
        const sheet = this.game.getDrawable('block_sheet');
        if (!def || !sheet) return;
        const fp = this._floorPoint(this.barrel.t, this.barrel.L);
        const h = fp.frac * this.bg.h * this.barrel.scale;
        const w = h * (def.w / def.h);
        const S = this.game.getSheetScale('block_sheet');
        ctx.drawImage(sheet, def.x * S, def.y * S, def.w * S, def.h * S,
            fp.x - w / 2, fp.y - h, w, h);
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

        // Floor objects (barrel + character) share the floor and must respect
        // depth: whichever sits further back (larger t) draws first so the nearer
        // one overlaps it. The barrel never moves; the character does.
        if (this.barrel && this.barrel.t > this.t) {
            this._drawBarrel(ctx); this._drawCharacter(ctx);
        } else {
            this._drawCharacter(ctx);
            if (this.barrel) this._drawBarrel(ctx);
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

    // C-key debug overlay — mirrors the overworld (stage 3): collision boxes in
    // the world, a bottom-left info panel, and the top-right perf panel. Here the
    // "world" is (t: depth, L: lateral) space, so boxes are drawn by sampling the
    // floor at their corners (they come out as perspective trapezoids).
    renderDebug(ctx) {
        this._layout();
        const g = this.game;

        // Walkable floor bounds (the side walls + front/back edges): L=-1..1 over
        // t=0..1. Cyan outline.
        const corner = (t, L) => this._floorPoint(t, L);
        const quad = (pts, stroke, fill) => {
            ctx.beginPath();
            ctx.moveTo(pts[0].x, pts[0].y);
            for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
            ctx.closePath();
            if (fill) { ctx.fillStyle = fill; ctx.fill(); }
            ctx.strokeStyle = stroke; ctx.lineWidth = 2; ctx.stroke();
        };
        quad([corner(0, -1), corner(0, 1), corner(1, 1), corner(1, -1)],
            'rgba(83,216,251,0.7)', null);

        // Collision boxes (cat furnace + barrel) — each drawn as a red trapezoid
        // with its front stop-face (what blocks the player) in bright yellow.
        for (const b of this._solidBoxes()) {
            quad([corner(b.tMin, b.lMin), corner(b.tMin, b.lMax),
                  corner(b.tMax, b.lMax), corner(b.tMax, b.lMin)],
                'rgba(233,69,96,0.9)', 'rgba(233,69,96,0.22)');
            const fL = corner(b.tMin, b.lMin), fR = corner(b.tMin, b.lMax);
            ctx.strokeStyle = '#ffd166'; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.moveTo(fL.x, fL.y); ctx.lineTo(fR.x, fR.y); ctx.stroke();
        }

        // Player floor point marker.
        const fp = this._floorPoint(this.t, this.L);
        ctx.fillStyle = '#0f0';
        ctx.beginPath(); ctx.arc(fp.x, fp.y, 4, 0, Math.PI * 2); ctx.fill();

        // Bottom-left info panel (location + movement state), same corner as stage 3.
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(4, g.height - 72, 360, 68);
        ctx.fillStyle = '#0f0';
        ctx.font = '12px monospace';
        ctx.fillText(`Location: ${this.name}`, 10, g.height - 54);
        ctx.fillText(`t: ${this.t.toFixed(3)}  L: ${this.L.toFixed(3)}  facing: ${this.facing}`, 10, g.height - 36);
        ctx.fillText(`furnace boxes: ${this.statueBoxes.length}`, 10, g.height - 16);

        // Perf panel (top right) — identical to the overworld.
        if (window.PERF) window.PERF.render(ctx, g);
    }
}

window.DungeonScreen = DungeonScreen;
