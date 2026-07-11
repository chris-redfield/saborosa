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
        this.barrelHalfT = 0.028; // collision half-extents in (t, L)
        this.barrelHalfL = 0.06;
        this.barrel = {
            defKey: 'block_03',
            t: rnd(0.30, 0.72),
            L: rnd(-0.70, 0.70),
            scale: cfg.barrelScale != null ? cfg.barrelScale : 1.0,
            mass: 1,          // light → picked up with the normal (not heavy) grab pose
            flipX: false,
            fly: null,        // arc descriptor while thrown; null when resting/carried
            flyZ: 0,          // current arc lift (fraction of bg height), for the draw
            box: { name: 'barrel', tMin: 0, tMax: 0, lMin: 0, lMax: 0 },
        };
        this._syncBarrelBox();

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

    // True while the player is carrying the barrel (so it isn't also solid).
    _barrelCarried() { return this.player && this.player.liftedObject === this.barrel; }

    // Recompute the barrel's collision box from its (t, L) centre.
    _syncBarrelBox() {
        const b = this.barrel; if (!b) return;
        b.box.tMin = b.t - this.barrelHalfT; b.box.tMax = b.t + this.barrelHalfT;
        b.box.lMin = b.L - this.barrelHalfL; b.box.lMax = b.L + this.barrelHalfL;
    }

    // The barrel is solid (blocks / can be pushed / shows a debug box) only when
    // resting on the floor — not while carried or mid-throw.
    _barrelSolid() { return this.barrel && !this._barrelCarried() && !this.barrel.fly; }

    // All solid collision boxes for the debug overlay: cat furnace + resting barrel.
    _solidBoxes() {
        return this._barrelSolid() ? this.statueBoxes.concat(this.barrel.box) : this.statueBoxes;
    }

    // Reject the player from a set of IMMOVABLE boxes with per-axis resolution
    // (depth first, then lateral) so faces block but corners stay passable.
    _resolveBoxes(oldT, oldL, nt, nl, boxes) {
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

    // Push the barrel out of the player's path (per-axis) and return where the
    // player ends up — pressed against the barrel's near edge, so they shove it
    // along. The barrel itself is clamped against the cat boxes + floor bounds by
    // _moveBarrelAxis, so it can't be pushed into the furnace or off the floor.
    _pushBarrel(oldT, oldL, nt, nl) {
        let rt = nt, rl = nl;
        const bd = this.barrel.box;
        if (oldL > bd.lMin && oldL < bd.lMax) {
            if (oldT <= bd.tMin && rt > bd.tMin) { this._moveBarrelAxis('t', rt - bd.tMin); rt = this.barrel.box.tMin; }
            else if (oldT >= bd.tMax && rt < bd.tMax) { this._moveBarrelAxis('t', rt - bd.tMax); rt = this.barrel.box.tMax; }
        }
        const bl = this.barrel.box;
        if (rt > bl.tMin && rt < bl.tMax) {
            if (oldL <= bl.lMin && rl > bl.lMin) { this._moveBarrelAxis('l', rl - bl.lMin); rl = this.barrel.box.lMin; }
            else if (oldL >= bl.lMax && rl < bl.lMax) { this._moveBarrelAxis('l', rl - bl.lMax); rl = this.barrel.box.lMax; }
        }
        return { t: rt, L: rl };
    }

    // Move the barrel centre by `shift` on one axis, clamped to the floor bounds
    // and against the cat boxes. Returns the shift actually applied.
    _moveBarrelAxis(axis, shift) {
        const b = this.barrel;
        if (axis === 't') {
            const half = this.barrelHalfT;
            let nt = Math.max(half, Math.min(1 - half, b.t + shift));
            for (const c of this.statueBoxes) {
                if (b.L + this.barrelHalfL > c.lMin && b.L - this.barrelHalfL < c.lMax) {
                    if (shift > 0 && b.t + half <= c.tMin && nt + half > c.tMin) nt = c.tMin - half;
                    else if (shift < 0 && b.t - half >= c.tMax && nt - half < c.tMax) nt = c.tMax + half;
                }
            }
            const applied = nt - b.t; b.t = nt; this._syncBarrelBox(); return applied;
        } else {
            const half = this.barrelHalfL;
            let nl = Math.max(-1 + half, Math.min(1 - half, b.L + shift));
            for (const c of this.statueBoxes) {
                if (b.t + this.barrelHalfT > c.tMin && b.t - this.barrelHalfT < c.tMax) {
                    if (shift > 0 && b.L + half <= c.lMin && nl + half > c.lMin) nl = c.lMin - half;
                    else if (shift < 0 && b.L - half >= c.lMax && nl - half < c.lMax) nl = c.lMax + half;
                }
            }
            const applied = nl - b.L; b.L = nl; this._syncBarrelBox(); return applied;
        }
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

        // Collision: the cat furnace boxes are immovable (block + slide). Resolve
        // against them first, then push the barrel if the player walks into it.
        const r = this._resolveBoxes(oldT, oldL, nt, nl, this.statueBoxes);
        nt = r.t; nl = r.L;
        if (this._barrelSolid()) {
            const pr = this._pushBarrel(oldT, oldL, nt, nl);
            nt = pr.t; nl = pr.L;
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

        // Drive the shared player pose animation from the dungeon's own movement,
        // then handle pick-up / carry / throw / put-down (all reuse Player state).
        this.player.facing = this.facing;
        this.player.moving = (dT !== 0 || dL !== 0);
        this.player.advanceAnimations();
        if (this.barrel.fly) this._updateBarrelFlight(dt);
        this._handleLiftThrow();

        if (this.fadeIn > 0) this.fadeIn = Math.max(0, this.fadeIn - dt / 0.35);
    }

    // Lift / throw / put-down input, mirroring the overworld (main.js): tap to
    // pick up (or, empty-handed, play the reach gesture); hold past THROW_HOLD_MS
    // to wind up (crouch); release a charged hold to throw (distance scales with
    // hold time up to THROW_CHARGE_MS); a quick tap while carrying puts it down.
    // The Player grab/throw STATE + animations are reused verbatim.
    _handleLiftThrow() {
        const input = this.game.input;
        const player = this.player;
        const THROW_HOLD_MS = 300, THROW_CHARGE_MS = 2000;
        const liftDown = input.isKeyDown('lift');
        if (input.isKeyJustPressed('lift')) {
            player._liftWasCarrying = !!player.liftedObject;
            if (!player.liftedObject) {
                if (this._barrelInReach()) this._pickupBarrel();
                else player.startAction();
            }
            player._liftHoldStart = performance.now();
        }
        if (player._liftHoldStart != null) {
            const held = performance.now() - player._liftHoldStart;
            if (liftDown) {
                if (player.liftedObject && held >= THROW_HOLD_MS) player.charging = true;
            } else {
                if (player.liftedObject && held >= THROW_HOLD_MS) {
                    this._throwBarrel(Math.min(held, THROW_CHARGE_MS) / THROW_CHARGE_MS);
                } else if (player.liftedObject && player._liftWasCarrying) {
                    this._dropBarrel();
                }
                player.charging = false;
                player._liftHoldStart = null;
            }
        }
    }

    // Is the resting barrel close enough and roughly in front to be picked up?
    _barrelInReach() {
        if (!this._barrelSolid()) return false;
        const dt = this.barrel.t - this.t, dL = this.barrel.L - this.L;
        if (Math.hypot(dt, dL) > 0.16) return false;
        const fv = this.player.getFacingVector(); // (x=L, y where up=-1)
        return dt * (-fv.y) + dL * fv.x > -0.03;   // in front / beside (lenient)
    }

    _pickupBarrel() {
        this.barrel.fly = null; this.barrel.flyZ = 0;
        this.player.liftedObject = this.barrel;
        this.player.startGrab(); // one-shot grab anim; grabHeavy from barrel.mass
    }

    // Put the barrel down just in front of the player's feet, clamped to the floor.
    _dropBarrel() {
        const fv = this.player.getFacingVector();
        const d = 0.09;
        this.barrel.t = Math.max(this.barrelHalfT, Math.min(0.80, this.t + (-fv.y) * d));
        this.barrel.L = Math.max(-1 + this.barrelHalfL, Math.min(1 - this.barrelHalfL, this.L + fv.x * d));
        this._syncBarrelBox();
        this.player.liftedObject = null;
        this.player.startDrop(); // reverse grab anim (carry pose → idle)
    }

    // Launch the barrel on a short (t, L) arc in the facing direction. Reuses the
    // Player throw animation (throwObject plays it + clears liftedObject); the arc
    // itself lives here because it's in dungeon perspective space, not world px.
    _throwBarrel(charge) {
        const fv = this.player.getFacingVector();
        this.player.throwObject(charge); // reuse: clears liftedObject, plays throw anim
        // The barrel is carried above the player's head (its own t/L was frozen at
        // the pick-up spot), so ORIGINATE the arc at the player's current position.
        this.barrel.t = this.t;
        this.barrel.L = this.L;
        const dist = 0.10 + 0.40 * charge;
        const fpO = this._floorPoint(this.t, this.L);
        this.barrel.fly = {
            fromT: this.barrel.t, fromL: this.barrel.L,
            toT: Math.max(this.barrelHalfT, Math.min(0.80, this.barrel.t + (-fv.y) * dist)),
            toL: Math.max(-1 + this.barrelHalfL, Math.min(1 - this.barrelHalfL, this.barrel.L + fv.x * dist)),
            el: 0, dur: 0.35 + 0.45 * charge,
            carryZ: fpO.frac * 0.85,      // starts at hand/head height (frac of bg height)
            peakZ: 0.04 + 0.10 * charge,  // extra arc bump on top, then lands at the floor
        };
    }

    _updateBarrelFlight(dt) {
        const f = this.barrel.fly;
        f.el += dt;
        const k = Math.min(1, f.el / f.dur);
        this.barrel.t = f.fromT + (f.toT - f.fromT) * k;
        this.barrel.L = f.fromL + (f.toL - f.fromL) * k;
        // Leave the hands (carryZ) and land on the floor (0), with an arc bump.
        this.barrel.flyZ = (1 - k) * f.carryZ + Math.sin(Math.PI * k) * f.peakZ;
        if (k >= 1) { this.barrel.fly = null; this.barrel.flyZ = 0; this._syncBarrelBox(); }
    }

    // Character — draws the Player's CURRENT pose frame (idle/walk/grab/carry/
    // throw, chosen by Player.getCurrentFrame), feet (bottom-center) anchored on
    // the floor point. Sizing keys off the idle-frame height so every pose stays
    // in proportion (a shorter throw/crouch frame sits lower, not stretched).
    _drawCharacter(ctx) {
        const fp = this._floorPoint(this.t, this.L);
        const spr = this.player && this.player.sprites;
        if (!spr) return;
        const fr = (this.player.getCurrentFrame && this.player.getCurrentFrame())
            || (spr[`${this.facing}_idle`] && spr[`${this.facing}_idle`][0]);
        const idle = (spr[`${this.facing}_idle`] && spr[`${this.facing}_idle`][0]) || fr;
        if (!fr || !fr.image) return;
        // Dungeon px per authored px, from the idle frame → idle keeps its old size.
        const unit = (fp.frac * this.bg.h) / (idle.height || fr.height);
        const drawH = fr.height * unit;
        const drawW = fr.width * unit;
        // While falling in, lift the feet by dropOffset (constant size).
        const drop = this.dropOffset || 0;
        const dx = fp.x - drawW / 2;
        const dy = fp.y - drawH - drop + (fr.vAlign || 0) * unit;
        ctx.save();
        if (fr.flipped) {
            ctx.translate(dx + drawW, dy);
            ctx.scale(-1, 1);
            ctx.drawImage(fr.image, fr.sx, fr.sy, fr.sw, fr.sh, 0, 0, drawW, drawH);
        } else {
            ctx.drawImage(fr.image, fr.sx, fr.sy, fr.sw, fr.sh, dx, dy, drawW, drawH);
        }
        ctx.restore();
    }

    // Barrel prop — block_03 from the assets-002 sheet, feet (bottom-center) on
    // its floor point, sized by perspective. Lifted by the arc height while thrown.
    _drawBarrel(ctx) {
        const fp = this._floorPoint(this.barrel.t, this.barrel.L);
        const h = fp.frac * this.bg.h * this.barrel.scale;
        const z = (this.barrel.flyZ || 0) * this.bg.h;
        this._blitBarrel(ctx, fp.x, fp.y - z, h);
    }

    // Carried barrel — "clicked" into the arms exactly like the overworld: the
    // object's bottom rests on the player's COLLISION-BOX top plus liftOffsetY
    // (see Player update()), not up at the head. Expressed as a fraction of the
    // player's sprite height above the feet so it adapts to any character, then
    // applied at the current depth. Keeps its full perspective size (only shrinks
    // with depth as the player walks).
    _drawCarriedBarrel(ctx) {
        const fp = this._floorPoint(this.t, this.L);
        const p = this.player;
        const playerH = fp.frac * this.bg.h;
        const h = fp.frac * this.bg.h * this.barrel.scale;
        // 0 = feet, 1 = head-top. Matches world: barrel box-bottom rests on the
        // player collision-box top (colOffY) plus a small raise (liftOffsetY). The
        // raise is scaled to 0.27× the overworld value (0.5× → 40% → another 10%
        // closer) so the barrel sits lower / more "clicked" into the arms.
        const carryFrac = 1 - (p.colOffY + p.liftOffsetY * 0.27) / p.height;
        // Charge crouch / heavy-carry ride 10px lower, same as the overworld.
        const flatDrop = (p.charging || p.grabHeavy) ? (10 / p.height) * playerH : 0;
        this._blitBarrel(ctx, fp.x, fp.y - carryFrac * playerH + flatDrop, h);
    }

    // Shared barrel blit: draw block_03 with bottom-centre at (cx, bottomY), height h.
    // Def coords are author-resolution; the game sheet is downscaled (getSheetScale).
    _blitBarrel(ctx, cx, bottomY, h) {
        const defs = this.game.getJSON('block_defs');
        const def = defs && defs.assets && defs.assets[this.barrel.defKey];
        const sheet = this.game.getDrawable('block_sheet');
        if (!def || !sheet) return;
        const w = h * (def.w / def.h);
        const S = this.game.getSheetScale('block_sheet');
        ctx.drawImage(sheet, def.x * S, def.y * S, def.w * S, def.h * S,
            cx - w / 2, bottomY - h, w, h);
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
        // one overlaps it. While carried, the barrel rides above the head and is
        // drawn with the character (on top).
        if (this._barrelCarried()) {
            this._drawCharacter(ctx);
            this._drawCarriedBarrel(ctx);
        } else if (this.barrel && this.barrel.t > this.t) {
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
