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

        this.t = cfg.startT != null ? cfg.startT : 0.06; // land near the front (closer/lower)
        this.L = cfg.startL != null ? cfg.startL : -0.90; // drop in on the far LEFT
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

        // A barrel prop (block_01 — the STANDING barrel — from the objects sheet)
        // spawned at a FIXED spot: the SAME depth as the player's drop-in (startT)
        // but off to his RIGHT, so it's always right there beside him to pick up.
        // Override via cfg.barrelStartT / cfg.barrelStartL. It's solid: a small
        // (t,L) footprint added to the collision boxes.
        this.barrelHalfT = 0.028; // collision half-extents in (t, L)
        this.barrelHalfL = 0.06;
        this.barrel = {
            defKey: 'block_01',
            t: cfg.barrelStartT != null ? cfg.barrelStartT : this.t,
            L: cfg.barrelStartL != null ? cfg.barrelStartL : 0.70, // right side, opposite the player
            scale: cfg.barrelScale != null ? cfg.barrelScale : 1.0,
            mass: 1,          // light → picked up with the normal (not heavy) grab pose
            flipX: false,
            fly: null,        // arc descriptor while thrown; null when resting/carried
            flyZ: 0,          // current arc lift (fraction of bg height), for the draw
            gone: false,      // true once fed to the furnace (consumed, no longer drawn/solid)
            box: { name: 'barrel', tMin: 0, tMax: 0, lMin: 0, lMax: 0 },
        };
        // Remember the barrel's ORIGINAL resting spot — the dropped letter falls
        // here (where the barrel started), not where it struck the furnace.
        this.barrel.startT = this.barrel.t;
        this.barrel.startL = this.barrel.L;
        this._syncBarrelBox();

        // --- Furnace-feeding mechanic --------------------------------------
        // Throw the barrel into the cat's mouth → explosion → a SABOROSA letter
        // drops from the ceiling where it hit, bounces to rest, and collecting it
        // iris-wipes back out to the overworld.
        //
        // Mouth feed target on the BACK WALL — a rectangle in normalized bg coords.
        // The cat is painted on the bg, so a screen rect sits right on the mouth
        // (NOT flat on the floor plane). The thrown barrel arcs up toward the wall
        // and a HIT is its on-screen position entering this rect; the explosion
        // pops at its centre. Tune in tools/dungeon-perspective.html (Cat tab).
        this.mouthRect = cfg.mouthRect || { x: 0.44, y: 0.40, w: 0.12, h: 0.12 };
        this.mouthBoomScale = cfg.mouthBoomScale != null ? cfg.mouthBoomScale : 0.5; // 50% of the old size
        this.mouthBoomOffsetY = cfg.mouthBoomOffsetY != null ? cfg.mouthBoomOffsetY : -25; // blast nudged UP (screen px)

        // Dropped letter: perspective-drawn glyph with a real little bounce (NOT
        // the floaty decorative Letter entity). Physics are in screen px.
        this.letterScale = cfg.letterScale != null ? cfg.letterScale : 1.7; // × perspective height
        this.letterGravity = cfg.letterGravity != null ? cfg.letterGravity : 2400; // px/s²
        this.letterRestitution = 0.42;   // bounce energy kept
        this.letterStopSpeed = 95;       // px/s below which a floor hit stops the bounce
        this.letterCollectDist = 0.16;   // (t,L) proximity to auto-collect
        this.hitLetterDelay = 0.28;      // sec after the blast before the letter drops

        // Sequence state (fresh each entry — the screen is rebuilt on every fall).
        this.booms = [];         // active explosion effects (dungeon-local)
        this.letter = null;      // the dropped letter once it spawns
        this.letterSpot = null;  // (t,L) where the barrel struck → where the letter falls
        this.letterDelay = 0;    // countdown from hit → letter drop
        this.iris = null;        // iris-out wipe descriptor once collected
        this.hit = false;        // latched so the furnace only fires once

        // This screen owns the interact key: E climbs out normally, but the collect
        // sequence exits on its own (after the iris) via exitRequested (main.js).
        this.handlesInteract = true;
        this.exitRequested = false;
        // Set true once the letter is collected — main.js seals the entry hole on
        // exit so it can't be fallen into again (a plain E climb-out leaves it open).
        this.completed = false;

        // Scorched ceiling tile where something dropped through: a black quad on
        // the ceiling grid. The ceiling is the floor plane MIRRORED about the
        // vanishing point (vpY), so a hole at (t,L) sits directly above the floor
        // spot at (t,L) — the same screen column the fall drops down. The player's
        // entry hole is blacked from the start; the letter adds its own when it
        // drops (see _spawnLetter). Tile half-extents in (t,L) via cfg knobs.
        this.ceilHoleDT = cfg.ceilHoleDT != null ? cfg.ceilHoleDT : 0.055;
        this.ceilHoleDL = cfg.ceilHoleDL != null ? cfg.ceilHoleDL : 0.08;
        this.ceilingHoles = [{ t: this.t, L: this.L }];

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

    // Ceiling sample at (depth tt, lateral LL) → screen px. The ceiling plane is
    // the floor MIRRORED about the vanishing-point height (vpY): its near/far Y
    // are 2·vpY − yNear/yFar, same half-widths, so it shares each floor point's
    // screen X (the fall column) but rides the top of the room.
    _ceilPoint(tt, LL) {
        const p = this.params;
        const yNear = 2 * p.vpY - p.yNear, yFar = 2 * p.vpY - p.yFar;
        const yN = yNear + (yFar - yNear) * tt;
        const halfW = p.halfNear + (p.halfFar - p.halfNear) * tt;
        const xN = p.vpX + LL * halfW;
        return { x: this.bg.x + xN * this.bg.w, y: this.bg.y + yN * this.bg.h };
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
    _barrelSolid() { return this.barrel && !this.barrel.gone && !this._barrelCarried() && !this.barrel.fly; }

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

        // Iris-out after collecting the letter: gameplay is frozen while the wipe
        // closes; when it finishes, ask main.js to climb back out to the overworld.
        if (this.iris) {
            this.iris.t += dt;
            if (this.iris.t >= this.iris.dur) this.exitRequested = true;
            return;
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

        // Hustle/charge bar (same as the overworld): mash the dash key to pump the
        // bar against its steady drain; its level scales move speed up to dashSpeed.
        this.player.updateCharge(dt);
        if (this.game.input.isKeyJustPressed('dash')) this.player.chargeUp();
        const hustle = Math.max(1, this.player.dashCharge * this.player.dashSpeed);

        // Constant ground speed: cover fewer screen px per step the farther away.
        const persp = p.perspSpeed ? (this._fracAt(this.t) / this._fracAt(0)) : 1;
        const oldT = this.t, oldL = this.L;
        let nt = Math.max(0, Math.min(1, oldT + dT * p.moveSpeed * persp * hustle * dt));
        let nl = Math.max(-1, Math.min(1, oldL + dL * p.moveSpeed * hustle * dt));

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

        // Explosion + letter drop + bounce/collect.
        this._updateSequence(dt);

        // Manual climb-out (E). The collect sequence exits on its own via the iris,
        // so this only fires during normal play.
        if (this.game.input.isKeyJustPressed('interact')) this.exitRequested = true;

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
            // Allow a forward throw to reach the cat/mouth (t up to 0.94). If it
            // MISSES the mouth trigger it lands deep, so _updateBarrelFlight nudges
            // a barrel that came down inside the furnace back to its front face.
            toT: Math.max(this.barrelHalfT, Math.min(0.94, this.barrel.t + (-fv.y) * dist)),
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
        // Into the furnace? Test the barrel's ON-SCREEN point (which rises with the
        // arc's flyZ) against the mouth rect on the back wall — feeding the furnace
        // fires the sequence (explosion + letter) and consumes the barrel.
        if (!this.hit) {
            const fp = this._floorPoint(this.barrel.t, this.barrel.L);
            const bh = fp.frac * this.bg.h * this.barrel.scale;
            const bcx = fp.x, bcy = fp.y - this.barrel.flyZ * this.bg.h - bh / 2;
            if (this._inMouthScreen(bcx, bcy)) { this._onFurnaceHit(); return; }
        }
        if (k >= 1) {
            this.barrel.fly = null; this.barrel.flyZ = 0; this._syncBarrelBox();
            this._nudgeBarrelOutOfCat(); // a missed deep throw shouldn't rest inside the furnace
        }
    }

    // Push a just-landed barrel out to the front face of any cat box it overlaps,
    // so a throw that reached deep but missed the mouth doesn't sit in the furnace.
    _nudgeBarrelOutOfCat() {
        const b = this.barrel;
        for (const c of this.statueBoxes) {
            if (b.t + this.barrelHalfT > c.tMin && b.t - this.barrelHalfT < c.tMax &&
                b.L + this.barrelHalfL > c.lMin && b.L - this.barrelHalfL < c.lMax) {
                b.t = c.tMin - this.barrelHalfT; // to the box's front face
            }
        }
        b.t = Math.max(this.barrelHalfT, Math.min(1 - this.barrelHalfT, b.t));
        this._syncBarrelBox();
    }

    // Barrel's on-screen point inside the back-wall mouth rect (bg-normalized)?
    _inMouthScreen(cx, cy) {
        const r = this.mouthRect;
        const x0 = this.bg.x + r.x * this.bg.w, y0 = this.bg.y + r.y * this.bg.h;
        return cx >= x0 && cx <= x0 + r.w * this.bg.w &&
               cy >= y0 && cy <= y0 + r.h * this.bg.h;
    }

    // Screen centre of the mouth rect — where the blast pops.
    _mouthCenter() {
        const r = this.mouthRect;
        return { x: this.bg.x + (r.x + r.w / 2) * this.bg.w,
                 y: this.bg.y + (r.y + r.h / 2) * this.bg.h };
    }

    // Barrel fed to the furnace: consume it, pop the explosion at the mouth, and
    // arm the letter drop at the spot it struck.
    _onFurnaceHit() {
        if (this.hit) return;
        this.hit = true;
        // Letter drops at the barrel's ORIGINAL spot (its random spawn), not the
        // mouth it was thrown into.
        this.letterSpot = { t: this.barrel.startT, L: this.barrel.startL };
        this.barrel.fly = null; this.barrel.flyZ = 0; this.barrel.gone = true;
        if (this.player.liftedObject === this.barrel) this.player.liftedObject = null;

        // Reuse the hole-fall explosion, centred on the cat's mouth (screen space,
        // so pass a 0,0 camera when rendering). scale via mouthBoomScale.
        // Full 12-frame boom (grow→peak→fade) for the furnace, not the hole's
        // tail-only subset. Falls back to boom_defs if the full set is absent.
        const defs = this.game.getJSON('boom_full_defs') || this.game.getJSON('boom_defs');
        if (defs) {
            const mc = this._mouthCenter();
            const bd = Object.assign({}, defs, { scale: (defs.scale || 1.3) * this.mouthBoomScale });
            this.booms.push(new BoomEffect(this.game, mc.x, mc.y + this.mouthBoomOffsetY, bd));
        }
        this.letterDelay = this.hitLetterDelay;
    }

    // Advance explosions, the pending letter drop, and the falling/resting letter.
    _updateSequence(dt) {
        if (this.booms.length) {
            for (const b of this.booms) b.update(dt);
            this.booms = this.booms.filter(b => !b.done);
        }
        if (this.letterDelay > 0 && !this.letter) {
            this.letterDelay -= dt;
            if (this.letterDelay <= 0) this._spawnLetter();
        }
        if (this.letter) this._updateLetter(dt);
    }

    // Spawn the letter high above its floor spot so it drops from the ceiling. A
    // random SABOROSA glyph (fresh per entry, like the barrel position).
    _spawnLetter() {
        const defs = this.game.getJSON('letter_defs');
        if (!defs || !defs.assets) return;
        const keys = Object.keys(defs.assets);
        const key = keys[Math.floor(Math.random() * keys.length)];
        const spot = this.letterSpot || { t: 0.6, L: 0 };
        const fp = this._floorPoint(spot.t, spot.L);
        const ceil = this._ceilPoint(spot.t, spot.L);
        this.letter = {
            def: defs.assets[key], defKey: key,
            t: spot.t, L: spot.L,
            // Start AT the ceiling hole (like the player's feet) and fall to the
            // floor — not from the very top of the room.
            z: Math.max(fp.y - ceil.y, 40),     // height above the floor point (px)
            vy: 0,                              // downward velocity (px/s); dz/dt = -vy
            phase: 'falling',
            bounces: 0,
        };
        // Black out the ceiling tile the letter drops through — appears now, as it
        // falls (same (t,L) as the letter, so the hole and letter share the column).
        this.ceilingHoles.push({ t: spot.t, L: spot.L });
    }

    // Gravity + a couple of decaying bounces, then rest; collect on player contact.
    _updateLetter(dt) {
        const L = this.letter;
        if (L.phase === 'falling') {
            L.vy += this.letterGravity * dt;
            L.z -= L.vy * dt;
            if (L.z <= 0) {
                L.z = 0;
                if (Math.abs(L.vy) < this.letterStopSpeed) { L.vy = 0; L.phase = 'resting'; }
                else { L.vy = -L.vy * this.letterRestitution; L.bounces++; } // bounce up
            }
        }
        if (L.phase === 'resting') {
            if (Math.hypot(L.t - this.t, L.L - this.L) < this.letterCollectDist) {
                L.phase = 'collected';
                this._startIris();
            }
        }
    }

    // Iris-out wipe centred on the player, freezing gameplay until it closes.
    _startIris() {
        this.completed = true; // letter secured → seal the hole on the way out
        const fp = this._floorPoint(this.t, this.L);
        const ph = fp.frac * this.bg.h;
        this.iris = { t: 0, dur: 0.75, cx: fp.x, cy: fp.y - ph * 0.4 };
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

    // Barrel prop — block_01 (standing barrel) from the objects sheet, feet
    // (bottom-center) on its floor point, sized by perspective. Lifted by the
    // arc height while thrown.
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

    // Shared barrel blit: draw the barrel def with bottom-centre at (cx, bottomY),
    // height h. Def coords index the game sheet directly (getSheetScale = 1.0 now).
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

    // Black scorched tiles on the ceiling grid where the player / letter dropped
    // through — each a perspective quad on the mirrored ceiling plane.
    _drawCeilingHoles(ctx) {
        if (!this.ceilingHoles.length) return;
        const cT = v => Math.max(0, Math.min(1, v));
        const cL = v => Math.max(-1, Math.min(1, v));
        ctx.fillStyle = '#0d0d0d';
        for (const hle of this.ceilingHoles) {
            const t0 = cT(hle.t - this.ceilHoleDT), t1 = cT(hle.t + this.ceilHoleDT);
            const l0 = cL(hle.L - this.ceilHoleDL), l1 = cL(hle.L + this.ceilHoleDL);
            const a = this._ceilPoint(t0, l0), b = this._ceilPoint(t0, l1);
            const c = this._ceilPoint(t1, l1), d = this._ceilPoint(t1, l0);
            ctx.beginPath();
            ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
            ctx.lineTo(c.x, c.y); ctx.lineTo(d.x, d.y); ctx.closePath();
            ctx.fill();
        }
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

        // Scorched ceiling holes sit on the ceiling grid, over the bg.
        this._drawCeilingHoles(ctx);

        // Cat statue on the back wall — full-canvas overlay aligned to the bg, so
        // it shares the bg rect exactly. Drawn before the character so he passes
        // in front of it as he approaches the wall.
        const gato = g.getDrawable(this.gatoFrames[this.gatoFrame]);
        if (gato && (gato.naturalWidth || gato.width)) {
            ctx.drawImage(gato, this.bg.x + this.gatoOffsetX, this.bg.y, this.bg.w, this.bg.h);
        }

        // Dropped letter sits at the back (near the cat), so draw it before the
        // character — the player passes in front of it as he walks up to collect.
        if (this.letter && this.letter.phase !== 'collected') this._drawLetter(ctx);

        // Floor objects (barrel + character) share the floor and must respect
        // depth: whichever sits further back (larger t) draws first so the nearer
        // one overlaps it. While carried, the barrel rides above the head and is
        // drawn with the character (on top). A furnace-fed barrel (gone) isn't drawn.
        const showBarrel = this.barrel && !this.barrel.gone;
        if (this._barrelCarried()) {
            this._drawCharacter(ctx);
            this._drawCarriedBarrel(ctx);
        } else if (showBarrel && this.barrel.t > this.t) {
            this._drawBarrel(ctx); this._drawCharacter(ctx);
        } else {
            this._drawCharacter(ctx);
            if (showBarrel) this._drawBarrel(ctx);
        }

        // Explosions on top of the floor objects.
        for (const b of this.booms) b.render(ctx, g, 0, 0);

        if (this.fadeIn > 0) {
            ctx.fillStyle = `rgba(0,0,0,${this.fadeIn})`;
            ctx.fillRect(0, 0, g.width, g.height);
        }

        this._drawHustleBar(ctx);

        // Exit hint — press E to climb back out to the overworld.
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.font = '13px monospace';
        ctx.fillText('[E] climb out', 14, g.height - 16);

        // Iris-out wipe closes over everything (incl. the hint) once collected.
        if (this.iris) this._drawIris(ctx);
    }

    // Perspective-drawn dropped letter (bottom-centre on its floor point, lifted
    // by its bounce height z), with a soft ground shadow while it's airborne.
    _drawLetter(ctx) {
        const L = this.letter; if (!L) return;
        const sheet = this.game.getDrawable('letters_sheet');
        if (!sheet || !(sheet.naturalWidth || sheet.width)) return;
        const fp = this._floorPoint(L.t, L.L);
        const h = fp.frac * this.bg.h * this.letterScale;
        const w = h * (L.def.w / L.def.h);
        const S = this.game.getSheetScale('letters_sheet');
        // Ground shadow — shrinks with height so the fall reads clearly.
        if (L.z > 2) {
            const startZ = Math.max(fp.y - this.bg.y, 140);
            const k = 1 - 0.5 * Math.min(1, L.z / startZ);
            ctx.save();
            ctx.fillStyle = 'rgba(0,0,0,0.28)';
            ctx.beginPath();
            ctx.ellipse(fp.x, fp.y, (w * 0.42) * k, (w * 0.16) * k, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
        const bottomY = fp.y - L.z;
        ctx.drawImage(sheet, L.def.x * S, L.def.y * S, L.def.w * S, L.def.h * S,
            fp.x - w / 2, bottomY - h, w, h);
    }

    // Iris-out: black fills the screen except a shrinking circle around the player.
    _drawIris(ctx) {
        const g = this.game, ir = this.iris;
        const k = Math.min(1, ir.t / ir.dur);
        const maxR = Math.hypot(g.width, g.height) * 0.62;
        const r = Math.max(0, maxR * (1 - k));
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, g.width, g.height);
        ctx.arc(ir.cx, ir.cy, r, 0, Math.PI * 2, true); // reverse winding → circular hole
        ctx.fillStyle = '#000';
        ctx.fill('evenodd');
        ctx.restore();
    }

    // Hustle/charge bar — same look as the overworld HUD (top-left): empty by
    // default, drains on its own, brightens the freshly-pumped leading segment.
    _drawHustleBar(ctx) {
        const barX = 10, barY = 24, barW = 60, barH = 6;
        const fill = this.player.dashCharge;
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.fillRect(barX, barY, barW, barH);
        ctx.fillStyle = fill >= 1 ? '#4f4' : '#2a2';
        ctx.fillRect(barX, barY, barW * fill, barH);
        const flash = this.player.rechargeFlash;
        if (flash > 0 && fill > 0) {
            const filledW = barW * fill;
            const segW = Math.min(filledW, barW * 0.11);
            ctx.globalAlpha = flash;
            ctx.fillStyle = '#dfffdf';
            ctx.fillRect(barX + filledW - segW, barY, segW, barH);
            ctx.globalAlpha = 1;
        }
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

        // Mouth feed rect on the BACK WALL (magenta) — a bg-normalized screen rect,
        // NOT a floor box. The barrel's on-screen point entering it feeds the
        // furnace; the blast pops at its centre.
        const mr = this.mouthRect;
        const mx = this.bg.x + mr.x * this.bg.w, my = this.bg.y + mr.y * this.bg.h;
        const mw = mr.w * this.bg.w, mh = mr.h * this.bg.h;
        ctx.fillStyle = 'rgba(233,72,233,0.18)'; ctx.fillRect(mx, my, mw, mh);
        ctx.strokeStyle = 'rgba(233,72,233,0.9)'; ctx.lineWidth = 2; ctx.strokeRect(mx, my, mw, mh);
        const mc = this._mouthCenter();
        ctx.fillStyle = '#ff48e9';
        ctx.beginPath(); ctx.arc(mc.x, mc.y, 5, 0, Math.PI * 2); ctx.fill();

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
