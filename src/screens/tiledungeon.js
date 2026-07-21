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
        // Floor backdrop. Opaque tiles (the Bone Pit) cover it entirely so it only
        // shows in the void behind the drop; a TRANSPARENT tile (the pista) lets
        // it show through as the ground — pass `sandColor` to get the overworld's
        // flat-sand look under the structure.
        this.bgColor = cfg.sandColor || cfg.bgColor || '#0c1020';

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

        // Ambient no-collision FX — the same twinkles/balls the overworld pops in
        // (FxManager, see main.js). Default size (no scale override — the overworld
        // only looks smaller because the camera is zoomed; down here 1:1 matches).
        // Modest count, but frequent enough to notice against the dark floor.
        this.fxManager = new FxManager(game, {
            target: 4, spawnGapMin: 1.0, spawnGapJitter: 1.8
        });

        // Scattered pickable rocks (assets-002 blocks). The infinite floor is one
        // tile repeated, so each tile-instance is seeded ONCE with ONE OF EACH
        // block type, every type at a spot chosen by a deterministic hash of the
        // tile's grid coords — stable as you scroll back and forth, and truly
        // infinite. They start SOLID + PUSHABLE (walk into one to shove it);
        // picking them up comes later. plane coords == screen px here (no camera
        // zoom), so the Rock's own collision boxes drop straight in.
        const blockEntries = Object.entries(((game.getJSON('block_defs') || {}).assets) || {})
            .filter(([, d]) => d.kind === 'block');
        this.rockDefs = blockEntries.map(([, d]) => d);
        // Placement pool = one of each type, PLUS two extra copies of the two
        // barrels (block_00 = on the ground, block_01 = standing) so each barrel
        // shows up THREE times per tile (each copy gets its own hashed spot via
        // its list index).
        const BARREL_KEYS = new Set(['block_00', 'block_01']);
        const barrels = blockEntries.filter(([k]) => BARREL_KEYS.has(k)).map(([, d]) => d);
        this.placeDefs = this.rockDefs.concat(barrels, barrels);
        this.rocks = [];
        this._rockTiles = new Set(); // tile keys already seeded (one attempt each)

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

        // Horizontal-bridge tiles (the pista) connect ONLY left↔right — they are a
        // single road strip, not a field that repeats up/down. In this mode the
        // floor is drawn as ONE strip tiled in X only, with the sand backdrop
        // showing above and below it, and the player is confined to the deck: the
        // tan railings wall the deck's top/bottom, and anything OUTSIDE the tile's
        // vertical span counts as solid (see _drawFloor + _boxHitsSolid). The tile
        // top sits at plane-Y 0; camY is seeded so the deck centre (deckYFrac of the
        // native height) lands under the feet point, so the player drops onto the road.
        this.horizontal = !!cfg.horizontal;
        this.deckYFrac = cfg.deckYFrac != null ? cfg.deckYFrac : 0.5;
        // Near (lower) railing depth-sort: the tile slice from this fraction of the
        // native height downward is re-drawn OVER the player (see _drawBridgeRailing),
        // so he walks behind the front parapet at the deck's lower edge. null = off.
        this.railYFrac = cfg.railYFrac != null ? cfg.railYFrac : null;
        if (this.horizontal && cfg.startY == null) {
            const img = this.game.getDrawable(this.tileKey);
            const nh = this.colNH || (img && (img.naturalHeight || img.height)) || 0;
            this.camY = this.deckYFrac * nh * this.tileScale - this._feetPoint().y;
        }

        // Vertical-shaft tiles (the fire dungeon) are the mirror image of the
        // bridge: the tile repeats ONLY up↔down, endlessly deep. camX is seeded so
        // `deckXFrac` of the CENTRE tile's native width lands under the feet point
        // (0.5 = drop in mid-tile). `horizontal` wins if both are somehow set.
        this.vertical = !this.horizontal && !!cfg.vertical;
        this.deckXFrac = cfg.deckXFrac != null ? cfg.deckXFrac : 0.5;
        // How many tiles wide the shaft is, side by side (odd, centred on the
        // spawn tile — 3 = one left, the spawn tile, one right). One tile is
        // narrower than the canvas (820 × 1.2722 ≈ 1043 of 1280), so a 1-wide
        // shaft leaves bare backdrop down both screen edges; the flanking tiles
        // cover it. The centre tile's left edge is always plane-X 0, so the spawn
        // seeding below is independent of the count.
        this.shaftTiles = cfg.shaftTiles != null ? cfg.shaftTiles : 1;
        this.shaftHalf = Math.floor(this.shaftTiles / 2);
        // Collision-column window spanning the whole shaft. The mask REPEATS per
        // tile (each flanking tile gets its own copy of the same skull/bush
        // layout), and anything outside the window is solid — the shaft walls.
        this.shaftC0 = -this.shaftHalf * (this.colCols || 0);
        this.shaftSpan = this.shaftTiles * (this.colCols || 0);
        if (this.vertical && cfg.startX == null) {
            const img = this.game.getDrawable(this.tileKey);
            const nw = this.colNW || (img && (img.naturalWidth || img.width)) || 0;
            this.camX = this.deckXFrac * nw * this.tileScale - this._feetPoint().x;
        }

        // Frozen-X camera (the fire shaft). Normally the character is pinned to
        // the screen and the whole floor scrolls under him on BOTH axes. In a
        // shaft that's wrong: scrolling sideways slides the whole corridor across
        // the screen as he steps left/right. With freezeCamX the corridor stays
        // PUT and the character walks left/right within it — the camera follows
        // on Y only, the classic vertical-scroller framing.
        //
        // `camX` stays the player's plane position, so every logic path
        // (collision, rope grab, rock pushes, spawns) is untouched. Only the DRAW
        // frame is frozen: everything blits at plane − _camDrawX(), and the
        // character is shifted off the screen centre by _charOffX() to make up
        // the difference.
        //
        // Set BEFORE _unstickSpawn so the viewport fence below is already live
        // while the spawn nudge searches — the drop-in can't land off-camera.
        this.freezeCamX = !!cfg.freezeCamX;
        this._viewCamX = this.camX;
        // With the camera frozen, walking past the screen edge would carry the
        // character out of frame (the floor no longer follows him), so the
        // viewport itself is a wall — see the fence in _planeBoxSolid. Inset
        // keeps him a little clear of the very edge.
        this.viewWallInset = cfg.viewWallInset != null ? cfg.viewWallInset : 24;

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

        // Optional roaming Telephone enemy (the same sand-roamer as the overworld,
        // phoneenemy.js) reused INSIDE the dungeon. The overworld PhoneEnemy is
        // welded to world zones / perspective / obstacles, none of which exist
        // here, so we only borrow its SPRITE PACK (loaded once, memoized on the
        // game) and run a compact roam→nervous→chase machine in the dungeon's own
        // plane/camera model. It's drawn at the SAME charScale as the player, so
        // the phone:player size ratio is exactly the overworld's (both packs bake
        // their own world-scale; the shared charScale preserves the proportion).
        // Position is a plane-space FEET point; spawnDX<0 puts it to the player's
        // LEFT so he's pressured to run right. See _updatePhone / _drawPhone.
        this.phone = null;
        const pc = cfg.phone || {};
        if (pc.enabled && typeof _loadPhonePack === 'function') {
            const pack = _loadPhonePack(this.game);
            if (pack && pack.sprites) {
                const cc = ((this.game.getJSON('collision_config') || {}).character)
                    || { colW: 0.80, colH: 0.50 };
                const fp = this._feetPoint();
                this.phone = {
                    pack,
                    // Feet in PLANE coords (player feet plane at spawn = cam + feetPoint).
                    planeX: this.camX + fp.x + (pc.spawnDX != null ? pc.spawnDX : -340),
                    planeY: this.camY + fp.y + (pc.spawnDY != null ? pc.spawnDY : 0),
                    // Collision footprint in PLANE px (sprite px × charScale, using the
                    // character footprint ratios like the overworld phone does).
                    colW: (pack.width || 190) * cc.colW * this.charScale,
                    colH: (pack.height || 150) * cc.colH * this.charScale,
                    facing: 'right',
                    state: 'roaming',          // roaming | nervous | chasing
                    nervousT: 0,
                    speed:      pc.speed      != null ? pc.speed      : 2.0, // px/frame roam
                    chaseSpeed: pc.chaseSpeed != null ? pc.chaseSpeed : 2.3, // px/frame chase (< player)
                    push:       pc.push       != null ? pc.push       : 2.6, // contact shove px/frame
                    detect:     pc.detect     != null ? pc.detect     : 760, // range to wake
                    lose:       pc.lose       != null ? pc.lose       : 980, // range to give up
                    nervousDur: pc.nervousDur != null ? pc.nervousDur : 0.5, // startled beat (sec)
                };
            }
        }

        // Test boss — an 8-frame animated sheet, feet-anchored at a plane spot
        // (defs in assets/saborosa-boss-test-defs.json). Spawns off-screen, waits
        // `chaseDelay`, then homes STRAIGHT at the player with NO collision (walks
        // through everything). Depth-sorts vs the player like the phone.
        this.boss = null;
        const bc = cfg.boss || {};
        const bd = game.getJSON('boss_defs');
        if (bc.enabled && bd && bd.frames && bd.frames.length) {
            const fp = this._feetPoint();
            this.boss = {
                frames: bd.frames,
                frameMs: bc.frameMs != null ? bc.frameMs : (bd.frameMs || 120),
                scale:   bc.scale   != null ? bc.scale   : (bd.scale || 0.5),
                planeX: this.camX + fp.x + (bc.spawnDX != null ? bc.spawnDX : 1000),
                planeY: this.camY + fp.y + (bc.spawnDY != null ? bc.spawnDY : 0),
                speed:      bc.speed       != null ? bc.speed       : 3.45, // px/frame (pista phone chaseSpeed)
                chaseDelay: bc.chaseDelayMs != null ? bc.chaseDelayMs : 3000, // ms after spawn before it hunts
                age: 0,      // ms since the dungeon was entered
                t: 0, frameI: 0,
            };
        }

        // Rising wall of fire (the fire shaft). A wide flame band that starts
        // BELOW the drop-in, off the bottom of the screen, and climbs the shaft
        // forever — the player has to keep heading up. Plane coords, so it scrolls
        // with the floor like everything else. `planeY` is the band's BASELINE
        // (its bottom edge): the art fills solid from the flame tips down, and the
        // frames are bottom-anchored, so anchoring the draw to the bottom is what
        // keeps the flames flickering in place instead of bobbing.
        this.fire = null;
        const fc = cfg.fire || {};
        const fd = game.getJSON('fire_defs');
        if (fc.enabled && fd && fd.frames && fd.frames.length) {
            const fp = this._feetPoint();
            this.fire = {
                frames: fd.frames,
                frameMs: fc.frameMs != null ? fc.frameMs : (fd.frameMs || 129),
                scale:   fc.scale   != null ? fc.scale   : (fd.scale || 1),
                // Baseline starts spawnDY below the player's feet — a screen-ish
                // gap, so he sees it coming rather than landing in it.
                planeY: this.camY + fp.y + (fc.spawnDY != null ? fc.spawnDY : 900),
                speed: fc.speed != null ? fc.speed : 0.6,  // px/frame UP (@60fps)
                // Solid fill painted below the baseline. Default is the exact
                // yellow the band fills with (sampled from the sheet), so the
                // flames and the burnt area read as one body with no seam.
                fill: fc.fill || '#ffea3e',
                // How wide ONE flame band is drawn. null = the art's natural size
                // (828 × scale) repeated across the screen. Set it to the canvas
                // width to get a SINGLE stretched flame instead — fewer, bigger
                // waves, but the line art softens at a 1.55x upscale.
                bandWidth: fc.bandWidth != null ? fc.bandWidth : null,
                // Source-rect inset that trims the sheet's semi-transparent 1px
                // border, and the destination overlap that closes the tile join.
                // See _drawFire — 2 is the measured-clean value, don't drop to 1.
                edgeInset: fc.edgeInset != null ? fc.edgeInset : 2,
                // How many flame bands are stacked DOWN from the leading edge.
                // 1 = the old look (flames on top, flat fill below). 2+ puts more
                // waves inside the body, so as the front climbs past the top of
                // the screen there's still fire to look at behind it.
                rows: fc.rows != null ? fc.rows : 2,
                // Vertical pitch between rows. null = one full band height, so the
                // rows sit flush; smaller overlaps them into a denser mass.
                rowGap: fc.rowGap != null ? fc.rowGap : null,
                t: 0, frameI: 0,
            };
        }
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

    // Camera X used for DRAWING only (see freezeCamX): the frozen spawn X in a
    // shaft, the live camera everywhere else. Logic always uses this.camX.
    _camDrawX() {
        return this.freezeCamX ? this._viewCamX : this.camX;
    }
    // How far the character is drawn from the screen feet-point, so that his
    // pinned logical position (feet + camX) still lands on the right floor spot
    // once the floor is drawn at the frozen _camDrawX(). Zero unless frozen.
    _charOffX() {
        return this.camX - this._camDrawX();
    }

    // True if the feet footprint would overlap ANY solid tile cell at camera
    // (cx, cy). The player is pinned to the screen feet-point; a plane point P
    // maps to screen as P - cam, so the feet's plane position is feet + cam.
    // Everything is in screen px; convert to native tile px (÷ tileScale), wrap
    // into the tile, and test every cell the footprint AABB covers (it spans a
    // few cells, so we iterate rather than sample corners).
    _boxHitsSolid(cx, cy) {
        if (!this.colMask) return false;
        // The player is pinned to the screen, so a plane point P maps to screen
        // P − cam → the footprint's plane position is its screen rect + cam.
        const r = this._footRect();
        return this._planeBoxSolid(r.x + cx, r.y + cy, r.w, r.h);
    }

    // True if a plane-space AABB (px,py,pw,ph in the same floor-pixel units as the
    // camera) overlaps ANY solid tile cell. Shared by the player footprint test
    // above and the phone (see _updatePhone): convert to native tile px
    // (÷ tileScale), wrap columns into the tile, and — in horizontal-bridge mode —
    // treat anything off the strip's top/bottom as solid. Iterates every cell the
    // AABB covers (it spans a few), rather than sampling corners.
    _planeBoxSolid(px, py, pw, ph) {
        // Frozen-camera fence: the view never scrolls in X, so anything that left
        // the visible strip would simply walk off-camera. Treat the viewport edges
        // as walls. Checked before the mask so it holds even on a maskless floor.
        if (this.freezeCamX && this._viewCamX != null) {
            const left = this._viewCamX + this.viewWallInset;
            const right = this._viewCamX + this.game.width - this.viewWallInset;
            if (px < left || px + pw > right) return true;
        }
        if (!this.colMask) return false;
        const img = this.game.getDrawable(this.tileKey);
        const nw = (img && (img.naturalWidth || img.width)) || this.colNW;
        const nh = (img && (img.naturalHeight || img.height)) || this.colNH;
        const s = this.tileScale;
        const minX = px / s, maxX = (px + pw) / s;
        const minY = py / s, maxY = (py + ph) / s;
        const cW = nw / this.colCols, cH = nh / this.colRows;
        const c0 = Math.floor(minX / cW), c1 = Math.floor(maxX / cW);
        const r0 = Math.floor(minY / cH), r1 = Math.floor(maxY / cH);
        for (let r = r0; r <= r1; r++) {
            let rr;
            if (this.horizontal) {
                // Off the top/bottom of the single strip = sand → not walkable.
                if (r < 0 || r >= this.colRows) return true;
                rr = r;
            } else {
                rr = ((r % this.colRows) + this.colRows) % this.colRows;
            }
            for (let c = c0; c <= c1; c++) {
                let cc;
                if (this.vertical) {
                    // Off the left/right end of the shaft = void → not walkable.
                    // Inside it the mask repeats per tile, so each flanking tile
                    // carries the same skulls/bushes as the centre one.
                    if (c < this.shaftC0 || c >= this.shaftC0 + this.shaftSpan) return true;
                    cc = ((c % this.colCols) + this.colCols) % this.colCols;
                } else {
                    cc = ((c % this.colCols) + this.colCols) % this.colCols;
                }
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

        // Ambient FX tick every frame (so twinkles keep shimmering even while
        // falling in or stuck), scattered around the visible deck in world/plane
        // coords and scrolling with the camera.
        if (this.fxManager) {
            this.fxManager.update(dt, this.camX + this.game.width / 2, this.camY + this.game.height / 2, 1);
        }
        this._ensureRocks(); // seed rocks for any newly-visible tiles

        // Fire: flicker + climb. Ticks before the drop-in early-return below, so
        // it keeps rising while the player is still falling in and never pauses.
        // Nothing stops it — it just goes up forever (no collision or damage yet).
        if (this.fire) {
            const f = this.fire;
            f.t += dt * 1000;
            f.frameI = Math.floor(f.t / f.frameMs) % f.frames.length;
            f.planeY -= f.speed * 60 * dt;  // px/frame @60fps → px this tick
        }

        if (this.boss) {
            const b = this.boss;
            // Looping animation.
            b.t += dt * 1000;
            b.frameI = Math.floor(b.t / b.frameMs) % b.frames.length;
            // After the delay, home STRAIGHT at the player's feet (plane) at a
            // fixed speed — no collision, so nothing stops him.
            b.age += dt * 1000;
            if (b.age >= b.chaseDelay) {
                const fp = this._feetPoint();
                const ddx = (this.camX + fp.x) - b.planeX;
                const ddy = (this.camY + fp.y) - b.planeY;
                const dist = Math.hypot(ddx, ddy) || 0.001;
                const move = b.speed * 60 * dt; // px/frame → px this tick (matches the phone)
                b.planeX += (ddx / dist) * move;
                b.planeY += (ddy / dist) * move;
            }
        }

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
        // Mid-hop (or a bad landing inside a solid) floats over everything —
        // otherwise each axis is gated by solid tiles AND rocks (which get shoved
        // along if they've got room). Per-axis so a blocked axis still slides.
        const passThrough = this.jumpActive || this._boxHitsSolid(this.camX, this.camY);
        if (sx && (passThrough || this._canMove(sx, 0))) this.camX += sx;
        if (sy && (passThrough || this._canMove(0, sy))) this.camY += sy;

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

        // Roaming Telephone chases the (now-updated) player. Runs only once he's
        // landed and free — the early returns above already gate out the fall and
        // the stuck-in-bush lock.
        this._updatePhone(dt);

        if (this.fadeIn > 0) this.fadeIn = Math.max(0, this.fadeIn - dt / 0.35);
    }

    // --- Scattered pickable rocks ------------------------------------------

    // Deterministic hash → [0,1) from a tile's grid coords + a salt (so one tile
    // yields several independent "random" values). Stable across scroll/reload.
    _rng(a, b, salt) {
        let h = (Math.imul(a | 0, 73856093) ^ Math.imul(b | 0, 19349663) ^ Math.imul(salt | 0, 83492791)) >>> 0;
        h = Math.imul(h ^ (h >>> 15), 2246822519);
        h = Math.imul(h ^ (h >>> 13), 3266489917);
        h ^= h >>> 16;
        return (h >>> 0) / 4294967296;
    }

    _aabb(ax, ay, aw, ah, bx, by, bw, bh) {
        return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
    }

    // Seed at most one rock per tile-instance for every tile currently in view
    // (plus a one-tile margin). Each tile is attempted exactly once; a candidate
    // is dropped if it lands on a solid cell (skull/bush/off-deck) or overlaps a
    // rock already placed. Pushed rocks keep their moved position (never re-seeded).
    _ensureRocks() {
        if (!this.rockDefs.length) return;
        const img = this.game.getDrawable(this.tileKey);
        if (!img) return;
        const tw = (img.naturalWidth || img.width) * this.tileScale;
        const th = (img.naturalHeight || img.height) * this.tileScale;
        if (tw <= 0 || th <= 0) return;
        const g = this.game;
        const ix0 = Math.floor((this.camX - tw) / tw), ix1 = Math.floor((this.camX + g.width + tw) / tw);
        const iy0 = Math.floor((this.camY - th) / th), iy1 = Math.floor((this.camY + g.height + th) / th);
        for (let iy = iy0; iy <= iy1; iy++) {
            for (let ix = ix0; ix <= ix1; ix++) {
                const key = ix + ',' + iy;
                if (this._rockTiles.has(key)) continue;
                this._rockTiles.add(key);
                // ONE OF EACH block type per tile (barrels twice — see placeDefs),
                // each at its own hashed spot in the tile. A copy is skipped only if
                // its spot lands on a solid cell (skull/bush/off-deck) or would
                // overlap an already-placed rock — so they spread out, not stack.
                for (let t = 0; t < this.placeDefs.length; t++) {
                    const rock = new Rock(g, 0, 0, this.placeDefs[t]);
                    const fx = ix * tw + (0.06 + 0.88 * this._rng(ix, iy, t * 2 + 1)) * tw;
                    const fy = iy * th + (0.06 + 0.88 * this._rng(ix, iy, t * 2 + 2)) * th;
                    rock.x = Math.round(fx - (rock.colOffX + rock.colW / 2));
                    rock.y = Math.round(fy - (rock.colOffY + rock.colH / 2));
                    const rr = rock.getRect();
                    if (this._planeBoxSolid(rr.x, rr.y, rr.width, rr.height)) continue;
                    if (this._rockOverlaps(rr, null)) continue;
                    this.rocks.push(rock);
                }
            }
        }
    }

    _rockOverlaps(rect, exclude) {
        for (const o of this.rocks) {
            if (o === exclude) continue;
            const or = o.getRect();
            if (this._aabb(rect.x, rect.y, rect.width, rect.height, or.x, or.y, or.width, or.height)) return true;
        }
        return false;
    }

    // Can the player's footprint move by (mx,my)? Blocked by solid tiles; rocks in
    // the way are shoved along if every one of them has room (tested before any is
    // moved, so a partial push never desyncs the player from a stuck rock).
    _canMove(mx, my) {
        const ncx = this.camX + mx, ncy = this.camY + my;
        if (this._boxHitsSolid(ncx, ncy)) return false;
        if (!this.rocks.length) return true;
        const r = this._footRect();
        const px = r.x + ncx, py = r.y + ncy;
        const hit = [];
        for (const rock of this.rocks) {
            const rr = rock.getRect();
            if (this._aabb(px, py, r.w, r.h, rr.x, rr.y, rr.width, rr.height)) hit.push(rock);
        }
        if (!hit.length) return true;
        for (const rock of hit) if (!this._canRockMove(rock, mx, my, hit)) return false;
        for (const rock of hit) { rock.x += mx; rock.y += my; }
        return true;
    }

    // A rock can slide by (mx,my) unless it would enter a solid tile cell or a
    // rock that isn't part of this same push (single-step shove, no chaining yet).
    _canRockMove(rock, mx, my, movingSet) {
        const rr = rock.getRect();
        const nx = rr.x + mx, ny = rr.y + my;
        if (this._planeBoxSolid(nx, ny, rr.width, rr.height)) return false;
        for (const o of this.rocks) {
            if (o === rock || movingSet.includes(o)) continue;
            const or = o.getRect();
            if (this._aabb(nx, ny, rr.width, rr.height, or.x, or.y, or.width, or.height)) return false;
        }
        return true;
    }

    // All objects, drawn straight from the block sheet crop (no perspective — the
    // dungeon has no camera zoom). They all sit behind the rope and character now,
    // so there's no per-rock depth split; off-screen ones are culled.
    _drawRocks(ctx) {
        if (!this.rocks.length) return;
        const img = this.game.getDrawable('block_sheet');
        if (!img) return;
        const g = this.game;
        for (const rock of this.rocks) {
            // RAW sub-pixel screen pos (no Math.round) — the world scrolls
            // sub-pixel, so per-entity rounding makes them shake against it.
            // See render_rounding_jitter: match the phone/Rock/Player convention.
            const dx = rock.x - this._camDrawX(), dy = rock.y - this.camY;
            if (dx > g.width || dx + rock.width < 0 || dy > g.height || dy + rock.height < 0) continue;
            ctx.drawImage(img, rock.sx, rock.sy, rock.sw, rock.sh, dx, dy, rock.width, rock.height);
        }
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

        // Horizontal bridge: draw ONE strip (tiled in X only). The tile top is at
        // plane-Y 0 → screen-Y = −camY; the sand backdrop shows above and below.
        if (this.horizontal) {
            const ox = -(((this._camDrawX() % tw) + tw) % tw);
            const yTop = Math.round(-this.camY);
            const yBot = Math.round(th - this.camY);
            for (let gx = 0; ox + gx * tw < g.width; gx++) {
                const x0 = Math.round(ox + gx * tw);
                const x1 = Math.round(ox + (gx + 1) * tw);
                ctx.drawImage(img, x0, yTop, (x1 - x0) + 1, (yBot - yTop));
            }
            return;
        }

        // Vertical shaft: draw ONE column (tiled in Y only). The tile's left edge
        // is at plane-X 0 → screen-X = −camX; the backdrop shows to either side.
        if (this.vertical) {
            const oy = -(((this.camY % th) + th) % th);
            for (let gx = -this.shaftHalf; gx <= this.shaftHalf; gx++) {
                // Same shared-integer-edge snapping as the infinite floor, so the
                // side tiles butt against the centre one with no hairline seam.
                const xL = Math.round(gx * tw - this._camDrawX());
                const xR = Math.round((gx + 1) * tw - this._camDrawX());
                if (xL > g.width || xR < 0) continue;
                for (let gy = 0; oy + gy * th < g.height; gy++) {
                    const y0 = Math.round(oy + gy * th);
                    const y1 = Math.round(oy + (gy + 1) * th);
                    ctx.drawImage(img, xL, y0, (xR - xL) + 1, (y1 - y0) + 1);
                }
            }
            return;
        }

        // Float offset of the first tile: wrap the camera into [-tile, 0] so a
        // tile always starts off the top-left edge and the whole canvas is covered.
        const ox = -(((this._camDrawX() % tw) + tw) % tw);
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
        // the player's end lifts by jumpZ toward that fixed anchor.
        const hop = (r.attached ? this.jumpZ : 0) || 0;
        const bx = r.endPlaneX - this._camDrawX();
        const groundBy = r.endPlaneY - this.camY; // where the end rests on the floor
        const by = groundBy - hop;                // player's end lifts with the hop
        if (by < -40) return; // whole rope above the screen
        const ax = bx + r.anchorDX;
        const ay = Math.min(groundBy - r.length, -60);

        // Baseline anchor→end and its perpendicular. Instead of drawing a rigid
        // straight strip, we lay the twist tiles along a transverse TRAVELLING
        // WAVE so the rope ripples like a real line, not a pole. The wave tapers
        // to zero at BOTH ends — the pinned anchor and the hand gripping the end
        // — and bulges between, travelling up the rope over time. Amplitude has a
        // subtle idle shimmer, more while walking, and a big spike on a hop
        // (ropeWhip) so pushing off sends a wave rippling up the line.
        const dirx = bx - ax, diry = by - ay;
        const len = Math.hypot(dirx, diry); if (len < 1) return;
        const ux = dirx / len, uy = diry / len;    // unit along the rope
        const perpx = -uy, perpy = ux;             // unit perpendicular
        const scale = r.width / nw;                // on-screen thickness / native width
        const period = nh * scale;                 // one twist period on screen
        // Only tile as far as the visible screen (rope is near-vertical, anchored
        // off the top) — caps drawImage calls to ~one screenful.
        const drawLen = Math.min(len, this.game.height - ay + period);
        const n = Math.ceil(drawLen / period) + 1;

        // Same gentle shimmer whether stationary or walking; only a hop kicks up
        // the big ripple (ropeWhip).
        const amp = (r.waveIdle != null ? r.waveIdle : 3)          // resting shimmer
                  + this.ropeWhip * (r.waveWhip != null ? r.waveWhip : 34); // hop ripple
        const humps = r.waveHumps != null ? r.waveHumps : 2.3;     // wave count along length
        const speed = r.waveSpeed != null ? r.waveSpeed : 7;       // travel speed up the rope
        // Lateral offset (px) of the rope at parameter tt in [0,1] (0=anchor,
        // 1=hand). sin(π·tt) pins both ends; the inner sin makes it travel.
        const lat = (tt) => Math.sin(Math.PI * tt) * amp
                          * Math.sin(humps * Math.PI * tt - speed * r.t);

        ctx.save();
        // Nearest-neighbour (not bilinear): the segment is downscaled ~14× to the
        // wire width, and bilinear greys the thin black twist lines into mush.
        ctx.imageSmoothingEnabled = false;
        // Walk down the rope one twist tile at a time, offsetting each point by
        // the wave and rotating the tile to its own local tangent so the texture
        // follows the curve. The last tile is clamped to the rope's end.
        let prevX = ax, prevY = ay;                // anchor: lat(0) == 0
        for (let i = 1; i <= n; i++) {
            const dist = Math.min(i * period, len);
            const tt = dist / len;
            const l = lat(tt);
            const x = ax + ux * dist + perpx * l;
            const y = ay + uy * dist + perpy * l;
            const segdx = x - prevX, segdy = y - prevY;
            const segLen = Math.hypot(segdx, segdy) || period;
            const a = Math.atan2(segdy, segdx) - Math.PI / 2; // texture +y → down-rope
            ctx.save();
            ctx.translate(prevX, prevY);
            ctx.rotate(a);
            ctx.drawImage(img, -r.width / 2, 0, r.width, segLen + 1);
            ctx.restore();
            prevX = x; prevY = y;
            if (dist >= len) break;                // reached the hand — stop
        }
        ctx.restore();
    }

    // Ground shadow for the rope-hop: a soft ellipse on the character's real floor
    // position while the sprite is lifted by jumpZ. It stays put and shrinks a
    // touch as he rises, so the height reads clearly and the player always knows
    // where the character actually is. Only shown while airborne (jumpZ > 0).
    // Offset by _charOffX() like the sprite — with a frozen camera the feet-point
    // is no longer where the character is, so an unshifted shadow would sit at the
    // screen centre while he walks away from it.
    _drawShadow(ctx) {
        if (!(this.jumpZ > 0)) return;
        const fp = this._feetPoint();
        const fr = this._footRect();
        const k = 1 - 0.28 * (this.jumpZ / this.jumpPeak); // shrink with height
        const rx = (fr.w * 0.55) * k, ry = (fr.w * 0.22) * k;
        ctx.save();
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.ellipse(fp.x + this._charOffX(), fp.y - 2, rx, ry, 0, 0, Math.PI * 2);
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
        const dx = fp.x - drawW / 2 + shake + this._charOffX();
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

    // Depth-sort the bridge's NEAR (lower) railing: everything from `railYFrac`
    // of the tile downward — the near parapet + the legs — is drawn a SECOND time
    // on top of the character, so when he walks to the lower edge of the deck his
    // feet tuck BEHIND the railing instead of standing on it. It's the exact same
    // slice of the tile, re-blitted with pixel-aligned scaling to the strip in
    // _drawFloor, so it overlays seamlessly. Only meaningful for horizontal-bridge
    // tiles that opt in via cfg.railYFrac.
    _drawBridgeRailing(ctx) {
        if (!this.horizontal || this.railYFrac == null) return;
        const g = this.game;
        const img = g.getDrawable(this.tileKey);
        if (!img || !(img.naturalWidth || img.width)) return;
        const nw = img.naturalWidth || img.width, nh = img.naturalHeight || img.height;
        const tw = nw * this.tileScale, th = nh * this.tileScale;
        // Same strip mapping as _drawFloor (tile top at plane 0 → screen −camY).
        const yTop = Math.round(-this.camY);
        const yBot = Math.round(th - this.camY);
        const sNat = this.railYFrac * nh;                       // source Y where the railing starts
        // Where that source row lands on screen within the already-drawn strip.
        const railTop = Math.round(yTop + (sNat / nh) * (yBot - yTop));
        const sh = nh - sNat;
        if (sh <= 0 || yBot - railTop <= 0) return;
        const ox = -(((this._camDrawX() % tw) + tw) % tw);
        for (let gx = 0; ox + gx * tw < g.width; gx++) {
            const x0 = Math.round(ox + gx * tw);
            const x1 = Math.round(ox + (gx + 1) * tw);
            ctx.drawImage(img, 0, sNat, nw, sh, x0, railTop, (x1 - x0) + 1, yBot - railTop);
        }
    }

    // Telephone AI in the dungeon's plane/camera model. Mirrors the overworld
    // phone's roam→nervous→chase beats, but movement is plane-space and confined
    // to the walkable floor via _planeBoxSolid (so on the bridge it stays on the
    // deck, blocked by the tan railings just like the player). On contact it shoves
    // the player horizontally AWAY (by nudging the camera, the dungeon's stand-in
    // for the player's world position), never damaging — same annoyance as the sand.
    _updatePhone(dt) {
        const ph = this.phone;
        if (!ph) return;
        const fp = this._feetPoint();
        const pxp = this.camX + fp.x, pyp = this.camY + fp.y; // player feet (plane)
        const ddx = pxp - ph.planeX, ddy = pyp - ph.planeY;
        const dist = Math.hypot(ddx, ddy) || 0.001;
        const step = 60 * dt; // px/frame → px this tick

        if (ph.state === 'roaming') {
            if (dist < ph.detect) { ph.state = 'nervous'; ph.nervousT = 0; }
            this._facePhone(ph, ddx, ddy);
        } else if (ph.state === 'nervous') {
            this._facePhone(ph, ddx, ddy);          // freeze, face the player
            ph.nervousT += dt;
            if (ph.nervousT >= ph.nervousDur) ph.state = 'chasing';
        } else { // chasing
            if (dist > ph.lose) { ph.state = 'roaming'; }
            else {
                const inv = 1 / dist;
                this._movePhone(ph, ddx * inv * ph.chaseSpeed * step,
                                    ddy * inv * ph.chaseSpeed * step);
                this._facePhone(ph, ddx, ddy);
                // Contact shove: if the footprints overlap, push the player away
                // horizontally (the deck is open in X, so a wall never traps him).
                const pf = this._footRect();
                const pfx = pf.x + this.camX, pfy = pf.y + this.camY;
                const phx = ph.planeX - ph.colW / 2, phy = ph.planeY - ph.colH;
                if (pfx < phx + ph.colW && pfx + pf.w > phx &&
                    pfy < phy + ph.colH && pfy + pf.h > phy) {
                    const away = ddx >= 0 ? 1 : -1; // shove player away from the phone
                    const shove = ph.push * step * away;
                    if (!this._boxHitsSolid(this.camX + shove, this.camY)) this.camX += shove;
                }
            }
        }
    }

    // Move the phone by (dx,dy) plane px, per-axis, blocked by solid tile cells so
    // it slides along the railings and can't leave the deck.
    _movePhone(ph, dx, dy) {
        const boxX = () => ph.planeX - ph.colW / 2;
        const boxY = () => ph.planeY - ph.colH; // feet at the box bottom
        if (dx && !this._planeBoxSolid(boxX() + dx, boxY(), ph.colW, ph.colH)) ph.planeX += dx;
        if (dy && !this._planeBoxSolid(boxX(), boxY() + dy, ph.colW, ph.colH)) ph.planeY += dy;
    }

    // 8-way facing from a heading (matches PhoneEnemy._faceFrom); only switch if the
    // pose exists in the pack.
    _facePhone(ph, dx, dy) {
        if (dx === 0 && dy === 0) return;
        const ax = Math.abs(dx), ay = Math.abs(dy), DIAG = 0.45;
        const n = Math.hypot(dx, dy), ux = dx / n, uy = dy / n;
        let f;
        if (Math.abs(ux) > DIAG && Math.abs(uy) > DIAG) f = (uy > 0 ? 'down' : 'up') + '_' + (ux > 0 ? 'right' : 'left');
        else if (ax >= ay) f = dx > 0 ? 'right' : 'left';
        else f = dy > 0 ? 'down' : 'up';
        if (ph.pack.sprites[`${f}_normal`] && ph.pack.sprites[`${f}_normal`].length) ph.facing = f;
    }

    // The phone's current frame: nervous pose while startled, else normal.
    _phoneSprite(ph) {
        const st = ph.state === 'nervous' ? 'nervous' : 'normal';
        const a = ph.pack.sprites[`${ph.facing}_${st}`]
               || ph.pack.sprites[`${ph.facing}_normal`]
               || ph.pack.sprites['down_normal'];
        return a && a[0];
    }

    // Draw the phone feet-anchored at its plane point (screen = plane − cam), at the
    // SAME charScale as the player so the size ratio matches the overworld.
    // The boss's current animation frame, feet-anchored at its plane point
    // (screen = plane − cam) and horizontally centred, drawn straight from the
    // full-res sheet crop at the def's scale.
    _drawBoss(ctx) {
        const b = this.boss;
        if (!b) return;
        const img = this.game.getDrawable('boss_sheet');
        if (!img) return;
        const f = b.frames[b.frameI] || b.frames[0];
        const drawW = f[2] * b.scale, drawH = f[3] * b.scale;
        const fx = b.planeX - this._camDrawX(), fy = b.planeY - this.camY; // feet on screen
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(img, f[0], f[1], f[2], f[3], fx - drawW / 2, fy - drawH, drawW, drawH);
    }

    // Rising wall of fire. The band is one wide flame drawn REPEATED across the
    // full canvas width (the art tiles horizontally), so it reads as a solid
    // front filling the shaft rather than a single flame in the middle. Set
    // cfg.fire.bandWidth to the canvas width for one stretched flame instead.
    //
    // Anchored by its BOTTOM edge to the plane baseline: every frame is the same
    // 828x216 box cut to a shared bottom, which is what makes the flames flicker
    // in place instead of bobbing (see the fire-animation notes). Below the
    // baseline the shaft is drawn solid in the fire's own colour, so what's
    // already burnt reads as filled rather than showing floor under the flames.
    //
    // SEAM FIX — the crop's outermost 1px border is SEMI-TRANSPARENT (alpha ~128
    // to ~158 vs 255 inside). Left as-is, two of those translucent columns meet
    // at every tile join and the dark floor shows through as a vertical line, and
    // the translucent bottom row draws a line along the baseline (see bug.png).
    // So: inset the SOURCE rect on all four sides to cut the fringe off, overlap
    // the destinations by the same amount to close the join, and start the fill
    // 1px high. Measured clean at inset 2 — inset 1 still leaked, because
    // rescaling 826→828 lets the sampler bleed back toward the edge.
    _drawFire(ctx) {
        const f = this.fire;
        if (!f) return;
        const img = this.game.getDrawable('fire_sheet');
        if (!img) return;
        const fr = f.frames[f.frameI] || f.frames[0];
        const g = this.game;
        const ins = f.edgeInset;
        const drawW = f.bandWidth || (fr[2] * f.scale), drawH = fr[3] * f.scale;
        const by = f.planeY - this.camY;            // baseline on screen
        if (by - drawH > g.height) return;          // still far below the view
        // Burnt-out fill below the flames (1px high, tucked under the band).
        if (by < g.height) {
            ctx.fillStyle = f.fill;
            ctx.fillRect(0, by - 1, g.width, g.height - by + 1);
        }
        const step = Math.max(1, drawW - ins);
        // Stacked rows, leading edge first and each one drawn OVER the fill (and
        // over the previous row's solid body when they overlap), so every row's
        // flame tips stay visible instead of being buried. Rows below the bottom
        // of the screen are skipped. Each row is one animation frame out of step
        // with the one above it, so the wall churns instead of pulsing in unison.
        const gap = f.rowGap || drawH;
        for (let r = 0; r < f.rows; r++) {
            const rowBy = by + r * gap;
            if (rowBy - drawH > g.height) break;
            const rf = f.frames[(f.frameI + r) % f.frames.length] || fr;
            for (let x = 0; x < g.width; x += step) {
                ctx.drawImage(img, rf[0] + ins, rf[1] + ins, rf[2] - ins * 2, rf[3] - ins * 2,
                              x, rowBy - drawH, drawW, drawH);
            }
        }
    }

    _drawPhone(ctx) {
        const ph = this.phone;
        if (!ph) return;
        const s = this._phoneSprite(ph);
        if (!s || !s.image) return;
        const unit = this.charScale;
        const drawW = s.width * unit, drawH = s.height * unit;
        const fx = ph.planeX - this._camDrawX(), fy = ph.planeY - this.camY; // feet on screen
        const dx = fx - drawW / 2, dy = fy - drawH + (s.vAlign || 0) * unit;
        if (s.flipped) {
            ctx.save();
            ctx.translate(dx + drawW, dy);
            ctx.scale(-1, 1);
            ctx.drawImage(s.image, s.sx, s.sy, s.sw, s.sh, 0, 0, drawW, drawH);
            ctx.restore();
        } else {
            ctx.drawImage(s.image, s.sx, s.sy, s.sw, s.sh, dx, dy, drawW, drawH);
        }
    }

    render(ctx) {
        const g = this.game;
        ctx.fillStyle = this.bgColor;
        ctx.fillRect(0, 0, g.width, g.height);
        ctx.imageSmoothingEnabled = true;

        this._drawFloor(ctx);
        this._drawRocks(ctx);       // ALL objects (rocks/barrels) sit behind the rope
        this._drawRope(ctx);        // rope always in front of the objects...
        this._drawShadow(ctx);      // rope-hop ground shadow, under the character
        // ...but the character is always on top of the rope. Enemies (boss, phone)
        // depth-sort vs the player by feet-Y — drawn behind him when their feet are
        // higher on the deck, in front when lower.
        const feetY = this.camY + this._feetPoint().y;
        const phoneInFront = this.phone && this.phone.planeY > feetY;
        const bossInFront = this.boss && this.boss.planeY > feetY;
        if (this.boss && !bossInFront) this._drawBoss(ctx);
        if (this.phone && !phoneInFront) this._drawPhone(ctx);
        this._drawCharacter(ctx);
        if (this.phone && phoneInFront) this._drawPhone(ctx);
        if (this.boss && bossInFront) this._drawBoss(ctx);
        this._drawBridgeRailing(ctx); // near/lower railing paints OVER the player + phone

        // Ambient FX on top of the scene (no collision/depth sort), same as the
        // overworld. Under the entry fade so they don't flash during the drop-in.
        if (this.fxManager) this.fxManager.render(ctx, this._camDrawX(), this.camY);

        // Fire absolutely last: it's an opaque wall the player is fleeing, so
        // nothing stands in front of it — not the character, and not the ambient
        // twinkles, which would otherwise sparkle THROUGH the flames. Only this
        // dungeon has a fire, so the other tiled dungeons are unaffected (the
        // call no-ops when this.fire is null).
        this._drawFire(ctx);

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
            // Bridge/shaft exist ONCE on their walled axis (tile edge = plane 0 →
            // screen −cam), so don't wrap that axis like the infinite floor.
            const ox = this.vertical ? Math.round(-this.shaftHalf * tw - this._camDrawX())
                                     : -(((this._camDrawX() % tw) + tw) % tw);
            const oy = this.horizontal ? Math.round(-this.camY)
                                       : -(((this.camY % th) + th) % th);
            const txEnd = this.vertical ? ox + this.shaftTiles * tw - 1 : g.width;
            const tyEnd = this.horizontal ? oy + th - 1 : g.height;
            ctx.fillStyle = 'rgba(233,69,96,0.35)';
            for (let ty = oy; ty < tyEnd; ty += th) {
                for (let tx = ox; tx < txEnd; tx += tw) {
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
        // Shifted by _charOffX() like the sprite, so with a frozen camera the
        // boxes stay on the character instead of at the screen centre.
        const sb = this._spriteRect(), fb = this._footRect(), coff = this._charOffX();
        ctx.lineWidth = 1;
        ctx.strokeStyle = 'lime';
        ctx.strokeRect(sb.x + coff, sb.y, sb.w, sb.h);
        ctx.strokeStyle = 'red';
        ctx.strokeRect(fb.x + coff, fb.y, fb.w, fb.h);

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
