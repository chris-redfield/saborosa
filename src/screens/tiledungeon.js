/**
 * TileDungeonScreen — an "infinite" top-down dungeon reached by falling into a
 * hole (see main.js enterDungeon). Unlike DungeonScreen (the one-point
 * perspective "fell in a pit" room), this one keeps the classic overworld look:
 * a flat top-down floor with the character drawn at a CONSTANT size no matter
 * where they walk. There's no room — the floor is a single square tile
 * (assets-v2/rafe-saborosa-escaladalow-01.png) repeated forever in every
 * direction, so the player can walk endlessly.
 *
 * Render model: the character is pinned to the centre of the canvas and the
 * tiled floor scrolls underneath as the player moves (a virtual camera at
 * camX/camY in floor-pixel space). Movement, facing, and the shared Player pose
 * animation all work exactly like the overworld; only the "where does the world
 * scroll" bookkeeping lives here. No collision, no props — just open floor.
 */
class TileDungeonScreen {
    constructor(game, player, cfg = {}) {
        this.game = game;
        this.player = player;                 // for the current sprite pack + pose frames
        this.name = cfg.name || 'Bone Pit';   // shown in the C-debug overlay
        this.tileKey = cfg.tile || 'dungeon_tile';

        // Floor tile draw size = native tile px × tileScale. Default ≈ the
        // stage-3 map's own draw scale (8815/5543 ≈ 1.59 world px per native px)
        // dialled back 20% → 1.2722, so the dungeon has ~the same detail density
        // as the overworld and each tile is bigger than the screen — a screen is
        // a *piece* of one tile, not a field of little repeats.
        this.tileScale = cfg.tileScale != null ? cfg.tileScale : 1.2722;
        // Character draw size relative to its authored sprite frames. 1 ≈ the
        // overworld's ~1× camera, which is the look we're matching.
        this.charScale = cfg.charScale != null ? cfg.charScale : 1.0;
        // Collision-footprint shrink, relative to the character. The overworld
        // inflates the sprite by a perspective factor (>1) while the footprint
        // stays at its base size, so the box reads smaller vs the character than
        // it would here at a flat charScale. 0.7 (−30%) matches that feel.
        this.colScale = cfg.colScale != null ? cfg.colScale : 0.7;

        // Virtual camera position in floor pixels. The character stays centred;
        // this is how far the floor has scrolled. Fractional start hides the
        // seam so the very first tile isn't perfectly axis-aligned.
        this.camX = cfg.startX != null ? cfg.startX : 0;
        this.camY = cfg.startY != null ? cfg.startY : 0;

        // Overworld walk speed: player.speed is px per fixed 60fps step, so
        // ×60 gives px/sec for our dt-based update.
        this.moveSpeed = (player && player.speed ? player.speed : 3) * 60;

        this.facing = 'down';  // faces the camera as he drops in
        if (player) { player.facing = 'down'; player.moving = false; }
        this.fadeIn = 1;       // black → clear on entry

        // Per-tile collision grid (skulls + bushes = solid), authored in
        // tools/tile-collision.html. Because the floor is one tile repeated
        // forever, the mask tiles too: the player's feet plane-position is
        // wrapped into tile-local cells (see _boxHitsSolid). Absent → open floor.
        const col = game.getJSON(cfg.collision || 'dungeon_tile_collision');
        this.colMask = null;
        if (col && col.cells) {
            this.colCols = col.cols; this.colRows = col.rows;
            this.colNW = col.nativeW; this.colNH = col.nativeH;
            const m = new Uint8Array(col.cols * col.rows);
            for (let r = 0; r < col.rows; r++) {
                const s = col.cells[r];
                for (let c = 0; c < col.cols; c++) m[r * col.cols + c] = s[c] === '1' ? 1 : 0;
            }
            this.colMask = m;
        }

        // Drop from the ceiling on entry, reusing the overworld fall dynamics
        // (px/frame @ the fixed 60fps step). Walking is locked until he lands.
        // Constant size the whole way down — only the feet position drops.
        this.falling = true;
        this.fallTimerMs = 0;
        this.dropOffset = cfg.dropHeight != null ? cfg.dropHeight : 460; // px above the floor line
        this.fallStartSpeed = (player && player.fallStartSpeed) || 1.8;
        this.fallAccelPerSec = (player && player.fallAccelPerSec) || 18;
        this.fallMaxSpeed = (player && player.fallMaxSpeed) || 14.3;

        // Never drop in wedged inside a skull/bush.
        this._unstickSpawn();

        // Taut-wire rope (Mina-the-Hollower style): a rope stretched STRAIGHT
        // from its bottom end up to an anchor — never a swinging pendulum. The
        // anchor is ALWAYS off the top of the screen and travels with the camera
        // (walk up and it rises with you). The bottom END is a real spot:
        //  - detached (default): a fixed floor-plane point near the spawn — the
        //    player drops in NEXT to it, not clipped onto it, and must walk over
        //    and press interact (E) to grab on.
        //  - attached: the end tracks the player (the taut wire follows him to
        //    the sides), and the three down-facing poses are disabled (see update).
        // The player owns the interact key here (handlesInteract) so grabbing the
        // rope doesn't also climb out. See _drawRope / _touchingRope.
        this.exitRequested = false;
        this.handlesInteract = true;
        const rc = cfg.rope || {};
        if (rc.enabled !== false) {
            const fp = this._feetPoint();
            this.rope = {
                // bottom end in PLANE coords (a world spot near the spawn).
                endPlaneX: this.camX + fp.x + (rc.endDX != null ? rc.endDX : 90),
                endPlaneY: this.camY + fp.y + (rc.endDY != null ? rc.endDY : 0),
                length: rc.length != null ? rc.length : 540, // min anchor height above the end
                width: rc.width != null ? rc.width : 15,     // on-screen thickness px
                sway: rc.sway != null ? rc.sway : 10,        // ambient wire-quiver amplitude px
                anchorDX: rc.anchorDX || 0,                  // anchor x offset (screen)
                attached: false,
                t: 0,                                        // sway clock
            };
        } else {
            this.rope = null;
        }

        // Little hop while holding the rope: press lift (Space / gamepad button
        // 0 — see input.js keyMap) to jump. Purely VISUAL — like a thrown
        // object's arc, a parabolic height (jumpZ) lifts the drawn sprite while
        // a shadow stays pinned at the feet-point so the player can still read
        // exactly where the character is on the floor. camX/camY and collision
        // are untouched (the footprint never leaves the feet-point). Only armed
        // while rope.attached; lift stays free otherwise. See _drawShadow and
        // the jumpZ lift in _drawCharacter.
        const jc = cfg.jump || {};
        this.jumpActive = false;
        this.jumpT = 0;                              // 0..jumpDur clock (sec)
        this.jumpZ = 0;                              // current visual lift (px)
        this.jumpDur = jc.dur != null ? jc.dur : 0.42;   // rise+fall time (sec)
        this.jumpPeak = jc.peak != null ? jc.peak : 54;  // arc peak height (px)

        // Bad-landing "stuck in a bush": while airborne the hop floats OVER every
        // solid cell, but if the feet come down inside a bush/skull the player is
        // pinned in place for a beat, shaking, before he can move or hop out (an
        // escape mode then lets him walk off the solid). See the landing check in
        // update(), the stuck lock at the top of update(), and the shake in
        // _drawCharacter.
        this.stuckTimer = 0;                             // sec remaining locked
        this.stuckShakeT = 0;                            // shake animation clock
        this.stuckDur = jc.stuckDur != null ? jc.stuckDur : 1.0; // lock time (sec)

        // Rope "whip": pushing off for a hop spikes this to 1 and it decays over
        // ~0.5s, briefly boosting the rope's ambient sway so the wire shivers
        // with tension instead of rigidly translating. See _drawRope. (The rope
        // also lifts by jumpZ during the hop so its end follows the player up.)
        this.ropeWhip = 0;
    }

    // Where the character's feet rest on screen (centre, slightly low so more
    // floor is visible ahead than behind — same instinct as the overworld cam).
    _feetPoint() {
        return { x: this.game.width / 2, y: this.game.height * 0.56 };
    }

    // Player boxes in screen px, built EXACTLY like the overworld (stage 3):
    // the full sprite bbox (player.width × player.height) feet-anchored at the
    // screen feet-point and horizontally centred, then the collision footprint
    // inset by the SAME colOffX/colOffY/colW/colH the overworld uses. So the box
    // (and its C-debug drawing) is identical to stage 3, just at the dungeon's
    // constant charScale instead of a camera zoom.
    _spriteRect() {
        const fp = this._feetPoint(), cs = this.charScale, p = this.player;
        const w = p.width * cs, h = p.height * cs;
        return { x: fp.x - w / 2, y: fp.y - h, w, h }; // bottom edge on the feet line
    }
    _footRect() {
        const s = this._spriteRect(), cs = this.charScale, p = this.player;
        // Base footprint (stage-3 offsets), then shrink by colScale about its
        // centre so it stays over the feet, just smaller relative to the sprite.
        const cxp = s.x + (p.colOffX + p.colW / 2) * cs;
        const cyp = s.y + (p.colOffY + p.colH / 2) * cs;
        const w = p.colW * cs * this.colScale, h = p.colH * cs * this.colScale;
        return { x: cxp - w / 2, y: cyp - h / 2, w, h };
    }

    // True if the feet footprint would overlap ANY solid tile cell at camera
    // (cx, cy). The player is pinned to the screen feet-point; a plane point P
    // maps to screen as P - cam, so the feet's plane position is feet + cam.
    // Everything is in screen px; convert to native tile px (÷ tileScale), wrap
    // into the tile, and test every cell the footprint AABB covers (it spans a
    // few cells, so we iterate rather than sample corners).
    _boxHitsSolid(cx, cy) {
        if (!this.colMask) return false;
        const img = this.game.getDrawable(this.tileKey);
        const nw = (img && (img.naturalWidth || img.width)) || this.colNW;
        const nh = (img && (img.naturalHeight || img.height)) || this.colNH;
        const s = this.tileScale;
        // Footprint AABB in native tile px. The player is pinned to the screen,
        // so a plane point P maps to screen P - cam → the footprint's plane
        // position is its screen rect + cam. Convert to native (÷ tileScale).
        const r = this._footRect();
        const minX = (r.x + cx) / s, maxX = (r.x + r.w + cx) / s;
        const minY = (r.y + cy) / s, maxY = (r.y + r.h + cy) / s;
        const cW = nw / this.colCols, cH = nh / this.colRows;
        const c0 = Math.floor(minX / cW), c1 = Math.floor(maxX / cW);
        const r0 = Math.floor(minY / cH), r1 = Math.floor(maxY / cH);
        for (let r = r0; r <= r1; r++) {
            const rr = ((r % this.colRows) + this.colRows) % this.colRows;
            for (let c = c0; c <= c1; c++) {
                const cc = ((c % this.colCols) + this.colCols) % this.colCols;
                if (this.colMask[rr * this.colCols + cc]) return true;
            }
        }
        return false;
    }

    // If the drop-in spot lands the feet inside a solid cell, nudge the camera
    // outward (spiral search over plane px) to the nearest open floor so the
    // player never starts wedged in a skull/bush.
    _unstickSpawn() {
        if (!this._boxHitsSolid(this.camX, this.camY)) return;
        const stepPx = this._footRect().w * 0.5 || 20;
        for (let ring = 1; ring <= 40; ring++) {
            for (let a = 0; a < 8; a++) {
                const ang = a * Math.PI / 4;
                const nx = this.camX + Math.cos(ang) * ring * stepPx;
                const ny = this.camY + Math.sin(ang) * ring * stepPx;
                if (!this._boxHitsSolid(nx, ny)) { this.camX = nx; this.camY = ny; return; }
            }
        }
    }

    update(dt) {
        if (this.rope) this.rope.t += dt; // taut-wire ambient sway clock
        if (this.ropeWhip > 0) this.ropeWhip = Math.max(0, this.ropeWhip - dt / 0.5);

        // Ceiling drop on entry — same accel curve as the overworld fall.
        if (this.falling) {
            this.fallTimerMs += dt * 1000;
            const vel = Math.min(this.fallMaxSpeed,
                this.fallStartSpeed + this.fallAccelPerSec * (this.fallTimerMs / 1000));
            this.dropOffset -= vel;
            if (this.dropOffset <= 0) { this.dropOffset = 0; this.falling = false; }
            if (this.fadeIn > 0) this.fadeIn = Math.max(0, this.fadeIn - dt / 0.35);
            return; // airborne — no walking yet
        }

        // Stuck after a bad hop into a bush/skull: locked in place and shaking
        // for a beat. No walking, no hopping, no interact until it wears off —
        // then normal update resumes with the feet still on a solid, so the
        // escape mode in the collision test below lets him walk out.
        if (this.stuckTimer > 0) {
            this.stuckTimer -= dt;
            this.stuckShakeT += dt;
            this.player.facing = this.facing;
            this.player.moving = false;
            this.player.advanceAnimations();
            if (this.fadeIn > 0) this.fadeIn = Math.max(0, this.fadeIn - dt / 0.35);
            return;
        }

        const mv = this.game.input.getMovementVector(); // x:-1..1, y:-1..1 (up=-1)

        // Hustle/charge bar (same as the overworld + perspective dungeon): mash
        // the dash key to pump the bar against its drain; its level scales move
        // speed up to dashSpeed.
        this.player.updateCharge(dt);
        if (this.game.input.isKeyJustPressed('dash')) this.player.chargeUp();
        const hustle = Math.max(1, this.player.dashCharge * this.player.dashSpeed);

        // Normalize diagonals so moving NE isn't faster than moving N.
        let dx = mv.x, dy = mv.y;
        const len = Math.hypot(dx, dy);
        if (len > 1) { dx /= len; dy /= len; }
        const step = this.moveSpeed * hustle * dt;
        // Per-axis collision against the solid tile cells: try X then Y so a
        // blocked axis still lets the player slide along a wall (skull/bush edge).
        // The wall test is skipped when he should pass through: mid-hop he floats
        // OVER solids, and if his feet are currently inside a solid (a bad landing
        // that's worn off) he can walk straight out of it — either way, don't trap
        // him. Normal collision resumes the moment he's airborne-free and clear.
        const sx = dx * step, sy = dy * step;
        const passThrough = this.jumpActive || this._boxHitsSolid(this.camX, this.camY);
        if (sx && (passThrough || !this._boxHitsSolid(this.camX + sx, this.camY))) this.camX += sx;
        if (sy && (passThrough || !this._boxHitsSolid(this.camX, this.camY + sy))) this.camY += sy;

        // 8-way facing from the movement vector (matches DungeonScreen).
        const up = dy < 0, down = dy > 0, right = dx > 0, left = dx < 0;
        if (up && right) this.facing = 'up_right';
        else if (up && left) this.facing = 'up_left';
        else if (down && right) this.facing = 'down_right';
        else if (down && left) this.facing = 'down_left';
        else if (up) this.facing = 'up';
        else if (down) this.facing = 'down';
        else if (right) this.facing = 'right';
        else if (left) this.facing = 'left';

        // While attached to the rope the character grips it facing away, so the
        // three DOWNWARD poses are disabled — remap them to the up equivalent
        // (up/up-diagonals + plain left/right stay). Mirrors the green-wall climb
        // clamp in player.move(), but that one also kills plain left/right; here
        // only the down set is dropped.
        if (this.rope && this.rope.attached) {
            if      (this.facing === 'down')       this.facing = 'up';
            else if (this.facing === 'down_left')  this.facing = 'up_left';
            else if (this.facing === 'down_right') this.facing = 'up_right';
        }

        // Attached rope end tracks the player (the taut wire follows him); the
        // anchor stays off the top of the screen (see _drawRope).
        if (this.rope && this.rope.attached) {
            const fp = this._feetPoint();
            this.rope.endPlaneX = this.camX + fp.x;
            this.rope.endPlaneY = this.camY + fp.y;
        }

        // Interact (E / gamepad): grab the rope when touching it, release when
        // already attached, otherwise climb out of the dungeon. main.js reads
        // exitRequested (this screen owns the interact key — handlesInteract).
        if (this.game.input.isKeyJustPressed('interact')) {
            if (this.rope && this.rope.attached) this.rope.attached = false;
            else if (this.rope && this._touchingRope()) this.rope.attached = true;
            else this.exitRequested = true;
        }

        // Rope hop: lift starts a jump only while gripping the rope and not
        // already mid-hop. The character can still walk (the world scrolls) and
        // the rope end tracks him during the arc — the jump is a pure vertical
        // draw offset layered on top.
        if (this.rope && this.rope.attached && !this.jumpActive
            && this.game.input.isKeyJustPressed('lift')) {
            this.jumpActive = true;
            this.jumpT = 0;
            this.ropeWhip = 1; // kick the rope so it shivers as he pushes off
        }
        if (this.jumpActive) {
            this.jumpT += dt;
            const p = Math.min(1, this.jumpT / this.jumpDur);
            // Same parabola as a thrown object (throwZ = 4·H·p·(1−p)): 0 at the
            // ground, peak at p=0.5.
            this.jumpZ = 4 * this.jumpPeak * p * (1 - p);
            if (this.jumpT >= this.jumpDur) {
                this.jumpActive = false; this.jumpZ = 0;
                // Touchdown: if the feet landed on a bush/skull, he's stuck for a
                // beat (shaking) before he can move or hop again. Land on open
                // floor and nothing happens — play just continues.
                if (this._boxHitsSolid(this.camX, this.camY)) {
                    this.stuckTimer = this.stuckDur;
                    this.stuckShakeT = 0;
                }
            }
        }

        // Drive the shared Player pose animation from our own movement.
        this.player.facing = this.facing;
        this.player.moving = (dx !== 0 || dy !== 0);
        this.player.advanceAnimations();

        if (this.fadeIn > 0) this.fadeIn = Math.max(0, this.fadeIn - dt / 0.35);
    }

    // Infinite floor: repeat the tile across the whole canvas, scrolled by the
    // virtual camera. Positive camX scrolls the floor left (player walks right).
    //
    // Seam-free tiling: at fractional scale/scroll, drawing each tile at a raw
    // float position leaves a hairline gap (the dark bg bleeds through as a thin
    // grey line) or a smoothed edge between neighbours. To kill it, every tile
    // boundary is SNAPPED to an integer pixel that both neighbours share
    // (tile i's right edge == tile i+1's left edge, exactly), and each tile is
    // drawn 1px wider/taller so it OVERLAPS its neighbour — no gap can appear.
    // The tiles are opaque, so the 1px overlap is invisible.
    _drawFloor(ctx) {
        const g = this.game;
        const img = g.getDrawable(this.tileKey);
        if (!img || !(img.naturalWidth || img.width)) return;
        const tw = (img.naturalWidth || img.width) * this.tileScale;
        const th = (img.naturalHeight || img.height) * this.tileScale;
        if (tw <= 0 || th <= 0) return;

        // Float offset of the first tile: wrap the camera into [-tile, 0] so a
        // tile always starts off the top-left edge and the whole canvas is covered.
        const ox = -(((this.camX % tw) + tw) % tw);
        const oy = -(((this.camY % th) + th) % th);
        for (let gy = 0; oy + gy * th < g.height; gy++) {
            const y0 = Math.round(oy + gy * th);
            const y1 = Math.round(oy + (gy + 1) * th);
            for (let gx = 0; ox + gx * tw < g.width; gx++) {
                const x0 = Math.round(ox + gx * tw);
                const x1 = Math.round(ox + (gx + 1) * tw);
                // +1 on the far edge overlaps into the next tile → no seam gap.
                ctx.drawImage(img, x0, y0, (x1 - x0) + 1, (y1 - y0) + 1);
            }
        }
    }

    // Is the player's footprint up against the rope? (near its vertical line,
    // at or above its bottom end). Used to gate the interact grab.
    _touchingRope() {
        const r = this.rope; if (!r) return false;
        const fp = this._feetPoint();
        const fxp = this.camX + fp.x, fyp = this.camY + fp.y; // player feet (plane)
        const ry = Math.min(fyp, r.endPlaneY);                // nearest point up the rope
        const grab = r.width / 2 + this._footRect().w / 2 + 14;
        return Math.hypot(fxp - r.endPlaneX, fyp - ry) < grab;
    }

    // Taut-wire rope: a STRAIGHT rope from the bottom END up to an anchor that is
    // always kept off the top of the screen (Mina tether — the anchor rides with
    // the camera, never pinned to a world spot). The end is a floor-plane point
    // (→ screen via P − cam): a fixed world spot when detached, or the player
    // when attached. The twist is tiled along the line, rotated to its angle, so
    // it stays a rigid wire at any length/angle (no swing). The only motion is a
    // subtle ambient sway: the (off-screen) anchor drifts a few px sideways on
    // layered sines, quivering the taut line like a wire under tension.
    _drawRope(ctx) {
        const r = this.rope; if (!r) return;
        const img = this.game.getDrawable('rope_segment');
        if (!img || !(img.naturalWidth || img.width)) return;
        const nw = img.naturalWidth || img.width, nh = img.naturalHeight || img.height;

        // Bottom end in screen space; if it's off the bottom edge the rope isn't
        // visible (player walked away from it). The FAR end (anchor) is pinned
        // from the RESTING ground position and does NOT move with the hop — only
        // the player's end lifts by jumpZ toward that fixed anchor. So the wire
        // pivots/shortens with its top staying put (the near-player part rises
        // most, the far end holds still) instead of the whole thing translating
        // up like a rigid pole.
        const hop = (r.attached ? this.jumpZ : 0) || 0;
        const bx = r.endPlaneX - this.camX;
        const groundBy = r.endPlaneY - this.camY; // where the end rests on the floor
        const by = groundBy - hop;                // player's end lifts with the hop
        if (by < -40) return; // whole rope above the screen
        // Anchor directly above, CLAMPED off the top edge so it's never visible
        // and always trails the camera. Computed from groundBy (NOT the lifted
        // by) so the far end stays fixed through the hop. Sway drifts it sideways
        // a few px; the hop "whip" briefly amplifies it and adds a fast decaying
        // quiver so the wire shivers with tension when he pushes off.
        let ax = bx + r.anchorDX;
        const ay = Math.min(groundBy - r.length, -60);
        ax += r.sway * (1 + 2.2 * this.ropeWhip)
              * (0.7 * Math.sin(r.t * 1.7) + 0.3 * Math.sin(r.t * 3.3 + 1.1));
        ax += this.ropeWhip * 13 * Math.sin(r.t * 24);

        const dirx = bx - ax, diry = by - ay;
        const len = Math.hypot(dirx, diry); if (len < 1) return;
        const scale = r.width / nw;              // on-screen thickness / native width
        const period = nh * scale;               // one twist period on screen
        // Only tile as far as the visible screen: the rope is near-vertical and
        // anchored just off the top, so past the bottom edge there's nothing to
        // see. Caps drawImage calls to ~one screenful even if the (detached) end
        // is far off-screen — no runaway when you walk away from the rope.
        const drawLen = Math.min(len, this.game.height - ay + period);
        const n = Math.ceil(drawLen / period) + 1; // tiles to cover the visible rope
        const angle = Math.atan2(diry, dirx) - Math.PI / 2; // segment +y → A→B dir

        ctx.save();
        // Nearest-neighbour (not bilinear): the segment is downscaled ~14× to the
        // wire width, and bilinear greys the thin black twist lines into mush.
        // Nearest keeps them solid black and crisp. imageSmoothingEnabled is part
        // of the saved canvas state, so this stays scoped to the rope.
        ctx.imageSmoothingEnabled = false;
        ctx.translate(ax, ay);
        ctx.rotate(angle);
        // Draw from the anchor down the +y axis; the last tile is clipped to the
        // rope length so it doesn't overshoot past the end.
        ctx.beginPath();
        ctx.rect(-r.width / 2, 0, r.width, len);
        ctx.clip();
        for (let i = 0; i < n; i++) {
            ctx.drawImage(img, -r.width / 2, i * period, r.width, period + 1);
        }
        ctx.restore();
    }

    // Ground shadow for the rope-hop: a soft ellipse pinned at the feet-point
    // (the character's real floor position) while the sprite is lifted by jumpZ.
    // It stays put and shrinks a touch as he rises, so the height reads clearly
    // and the player always knows where the character actually is. Only shown
    // while airborne (jumpZ > 0).
    _drawShadow(ctx) {
        if (!(this.jumpZ > 0)) return;
        const fp = this._feetPoint();
        const fr = this._footRect();
        const k = 1 - 0.28 * (this.jumpZ / this.jumpPeak); // shrink with height
        const rx = (fr.w * 0.55) * k, ry = (fr.w * 0.22) * k;
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.28)';
        ctx.beginPath();
        ctx.ellipse(fp.x, fp.y - 2, rx, ry, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    // Character — the Player's CURRENT pose frame, feet (bottom-centre) planted
    // on the fixed screen feet-point, at a constant scale (no perspective). Sizes
    // off the idle-frame height so every pose stays in proportion (a shorter
    // throw/crouch frame sits lower, not stretched).
    _drawCharacter(ctx) {
        const fp = this._feetPoint();
        const spr = this.player && this.player.sprites;
        if (!spr) return;
        const fr = (this.player.getCurrentFrame && this.player.getCurrentFrame())
            || (spr[`${this.facing}_idle`] && spr[`${this.facing}_idle`][0]);
        const idle = (spr[`${this.facing}_idle`] && spr[`${this.facing}_idle`][0]) || fr;
        if (!fr || !fr.image) return;
        const unit = this.charScale;              // dungeon px per authored px
        const drawH = fr.height * unit;
        const drawW = fr.width * unit;
        const drop = this.dropOffset || 0;        // lifted while falling in
        const hop = this.jumpZ || 0;              // rope-hop arc lift
        // Struggle shake while stuck in a bush — a fast horizontal jitter on two
        // detuned sines so it reads as frantic, not a clean wobble.
        const shake = this.stuckTimer > 0
            ? Math.sin(this.stuckShakeT * 52) * 3 + Math.sin(this.stuckShakeT * 31) * 1.5
            : 0;
        const dx = fp.x - drawW / 2 + shake;
        const dy = fp.y - drawH - drop - hop + (fr.vAlign || 0) * unit;
        if (fr.flipped) {
            ctx.save();
            ctx.translate(dx + drawW, dy);
            ctx.scale(-1, 1);
            ctx.drawImage(fr.image, fr.sx, fr.sy, fr.sw, fr.sh, 0, 0, drawW, drawH);
            ctx.restore();
        } else {
            ctx.drawImage(fr.image, fr.sx, fr.sy, fr.sw, fr.sh, dx, dy, drawW, drawH);
        }
    }

    render(ctx) {
        const g = this.game;
        ctx.fillStyle = '#0c1020';
        ctx.fillRect(0, 0, g.width, g.height);
        ctx.imageSmoothingEnabled = true;

        this._drawFloor(ctx);
        this._drawRope(ctx);        // taut wire on the floor, under the character
        this._drawShadow(ctx);      // rope-hop ground shadow, under the character
        this._drawCharacter(ctx);

        if (this.fadeIn > 0) {
            ctx.fillStyle = `rgba(0,0,0,${this.fadeIn})`;
            ctx.fillRect(0, 0, g.width, g.height);
        }

        this._drawHustleBar(ctx);

        // Exit hint — press E to climb back out to the overworld.
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.font = '13px monospace';
        ctx.fillText('[E] climb out', 14, g.height - 16);
    }

    // Hustle/charge bar — identical to the overworld + perspective dungeon HUD.
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

    // C-key debug overlay — bottom-left info panel + the shared perf panel,
    // mirroring the overworld and the perspective dungeon.
    renderDebug(ctx) {
        const g = this.game;

        // Solid collision cells over the visible floor — red, tiled like the
        // floor (plane→screen is P - cam, cells wrap into the tile).
        if (this.colMask) {
            const img = g.getDrawable(this.tileKey);
            const nw = (img && (img.naturalWidth || img.width)) || this.colNW;
            const nh = (img && (img.naturalHeight || img.height)) || this.colNH;
            const cW = (nw / this.colCols) * this.tileScale;   // cell size in screen px
            const cH = (nh / this.colRows) * this.tileScale;
            const tw = nw * this.tileScale, th = nh * this.tileScale;
            const ox = -(((this.camX % tw) + tw) % tw);
            const oy = -(((this.camY % th) + th) % th);
            ctx.fillStyle = 'rgba(233,69,96,0.35)';
            for (let ty = oy; ty < g.height; ty += th) {
                for (let tx = ox; tx < g.width; tx += tw) {
                    for (let r = 0; r < this.colRows; r++) {
                        for (let c = 0; c < this.colCols; c++) {
                            if (!this.colMask[r * this.colCols + c]) continue;
                            const x = tx + c * cW, y = ty + r * cH;
                            if (x > g.width || y > g.height || x + cW < 0 || y + cH < 0) continue;
                            ctx.fillRect(x, y, cW + 1, cH + 1);
                        }
                    }
                }
            }
        }

        // Player boxes — identical to the overworld (player.render debug): lime
        // full sprite bbox + red collision footprint, from the same colOff/colW
        // ratios, at the dungeon's constant charScale.
        const sb = this._spriteRect(), fb = this._footRect();
        ctx.lineWidth = 1;
        ctx.strokeStyle = 'lime';
        ctx.strokeRect(sb.x, sb.y, sb.w, sb.h);
        ctx.strokeStyle = 'red';
        ctx.strokeRect(fb.x, fb.y, fb.w, fb.h);

        // Bottom-left info panel, same corner as the other screens.
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(4, g.height - 72, 360, 68);
        ctx.fillStyle = '#0f0';
        ctx.font = '12px monospace';
        ctx.fillText(`Location: ${this.name} (infinite)`, 10, g.height - 54);
        ctx.fillText(`cam: ${this.camX.toFixed(0)}, ${this.camY.toFixed(0)}  facing: ${this.facing}`, 10, g.height - 36);
        const solids = this.colMask ? `${this.colCols}×${this.colRows} grid` : 'none';
        ctx.fillText(`tileScale: ${this.tileScale}  collision: ${solids}`, 10, g.height - 16);

        // Perf panel (top right) — identical to the overworld.
        if (window.PERF) window.PERF.render(ctx, g);
    }
}

window.TileDungeonScreen = TileDungeonScreen;
