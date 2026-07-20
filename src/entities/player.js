/**
 * Player - Character with movement and animation
 */
class Player {
    constructor(game, x, y) {
        this.game = game;
        this.x = x;
        this.y = y;
        // Base character bbox from the single scale knob (scale.config.js).
        const _ch = (window.ART && window.ART.character) || { width: 145, height: 109 };
        this.width = _ch.width;
        this.height = _ch.height;
        this.speed = 3;

        // Isometric collision footprint from config — cached so a character
        // swap can re-apply the same ratios to a different bounding box.
        this.colCfg = (game.getJSON('collision_config') || {}).character
            || { colW: 0.80, colH: 0.50, colOffX: 0.10, colOffY: 0.50 };
        this.colW = Math.round(this.width * this.colCfg.colW);
        this.colH = Math.round(this.height * this.colCfg.colH);
        this.colOffX = Math.round(this.width * this.colCfg.colOffX);
        this.colOffY = Math.round(this.height * this.colCfg.colOffY);
        this.mass = this.colW * this.colH;
        this.pushing = false;

        this._rect = { x: 0, y: 0, width: 0, height: 0 };

        // Direction and movement
        this.facing = 'down';
        // Last horizontal facing (true = left). A held object mirrors to match
        // this and KEEPS it through pure up/down/idle facings — only a left↔right
        // turn flips it. Updated each frame in update() from `facing`.
        this.heldFlipLeft = false;
        this.moving = false;
        this.frame = 0;
        this.animationSpeed = 0.1125; // walk-cycle advance per tick (25% slower than 0.15)
        this.animationCounter = 0;

        // Diagonal facing tracking
        this.dominantAxis = null;
        this.lastDx = 0;
        this.lastDy = 0;
        this.diagGraceFrames = 0;

        // Dash (now a charge-driven speed boost, not a one-shot lunge)
        this.dashSpeed = 5;        // speed multiplier at a full charge bar
        this.dashDuration = 150;   // ms — retained only to size the bar drain rate
        this.dashCooldown = 1000;  // ms — retained only to size the bar drain rate
        // Charge bar: empty by default. A constant "reverse force" drains it
        // (see update), while each dash-key press pumps it up (see chargeUp).
        // The bar's level scales the player's move speed up to dashSpeed.
        this.dashCharge = 0;    // 0..1 — what the bar displays
        this.rechargeFlash = 0; // 0..1 highlight on the freshly-pumped segment, decays to 0

        // Run (sprint)
        this.running = false;
        this.runSpeedFactor = 1.45; // 100% faster when running

        // Sand sinking
        this.onSand = false;
        this.sandSpeedFactor = 0.7; // 30% slower on sand

        // Wall interaction (Phase 5 — climbing / fall)
        this.surfaceState = 'ground'; // 'ground' | 'climbing' | 'falling'
        this.onTop = false;           // true while standing on a cube top (drives Phase 6 zoom)
        this.climbSpeedFactor = 0.4;  // movement multiplier while on green (slower than sand)

        // Falling velocity — accelerates from fallStartSpeed up to fallMaxSpeed
        // as fallTimer increases. Reset when a fall begins.
        this.fallStartSpeed = 1.8;
        this.fallMaxSpeed = 14.3;
        this.fallAccelPerSec = 18; // px/sec added to velocity each second
        this.fallTimerMs = 0;

        // When set, the falling state ends once player.y reaches this Y
        // instead of waiting to leave a WALL pixel. Used by the fall-behind
        // system: stepping off the mountain (above midline) drops you down
        // to the midline regardless of which sand pixel is below.
        this.fallTargetY = null;

        // True from the moment a fall-behind starts until the player walks
        // out of the mountain's column shadow. While true the upper layer is
        // drawn AFTER the player so the mountain occludes the sprite.
        // Geometric "below mountain pixels" alone is not sufficient because
        // a player approaching from the south is also below those pixels but
        // should render in front of the mountain.
        this.behindMountain = false;

        // Tracks the zone under the player on the previous frame — used to
        // detect "just stepped off the cube top onto the wall face" (fall).
        this.lastZone = null;

        // Tracks whether the player's feet were over the mountain overlay
        // (opaque alpha) on the previous frame. Drives fall-behind and
        // walk-back-behind triggers without going through the zone classifier
        // — the overlay's alpha is exactly the mountain silhouette as drawn,
        // so it doesn't misfire at polygon junctions where the classifier
        // briefly returns SAND/NONE on a black outline pixel.
        this.lastOnMountain = false;
        // Was the player above the image midline on the previous frame?
        // Both transition triggers (fall-behind and walk-back-behind) require
        // BOTH frames to be above midline so that simply crossing the midline
        // (where the overlay only starts being opaque) doesn't read as a
        // sand-to-mountain or mountain-to-sand transition.
        this.lastAboveMidline = false;

        // Lifting. The object is anchored to the collision footprint (the red
        // debug box) so it sits near the character's body center and scales
        // with character size. liftOffsetY fine-tunes vertically (negative =
        // higher).
        this.liftedObject = null;
        this.liftOffsetX = 0;
        // Held object floats this many px ABOVE the box-on-box snap (its red box
        // top-edge clears the player's red box top by |liftOffsetY|), so it
        // reads as held up rather than resting on the body. Negative = higher.
        this.liftOffsetY = -30;
        this.stackTarget = null; // rock currently targeted for stacking

        // Grab animation (one-shot, plays on pickup; last frame held while
        // carrying). Only the coconut has grab frames; other packs fall back
        // to idle/walk.
        this.grabbing = false;
        this.grabReverse = false; // true while playing the put-down (reverse) animation
        this.grabFrame = 0;
        this.grabCounter = 0;
        this.grabSpeed = 0.25; // frames advanced per update tick (~0.27s for 4 frames @60fps)
        // True when the lifted object is "heavy" (>50% of player mass) — uses
        // the longer grab_heavy sequence with the flattened col-3 carry pose.
        this.grabHeavy = false;

        // Throw charging: true while Space is held past the throw threshold.
        // Renders the flattened crouch (wind-up) pose. Released → throwObject.
        this.charging = false;
        this._liftHoldStart = null; // timestamp Space went down (tap vs hold)
        this._liftWasCarrying = false; // were we carrying when Space went down?

        // Power-throw animation (cols 4–8), played one-shot on a charged
        // (≥2s) throw, then returns to idle.
        this.throwAnimating = false;
        this.throwAnimFrame = 0;
        this.throwAnimCounter = 0;
        this.throwAnimSpeed = 0.3;

        // Empty-handed "action" gesture (coconut col 0). One-shot: held for a
        // brief beat when Space is pressed with nothing in range, then idle.
        this.actionAnimating = false;
        this.actionTicks = 0;
        this.actionHoldTicks = 18; // ~0.3s at 60fps fixed timestep

        // One-off "falling into a hole" visual (dungeon entry): the render
        // shrinks the sprite by fallInScale (toward the footprint center) and
        // sinks it by fallInDrop px, so the character reads as dropping into the
        // pit. Both are inert (1 / 0) during normal play; main.js animates them
        // for the dungeon-fall transition, then resets them.
        this.fallInScale = 1;
        this.fallInDrop = 0;
        // World-space pivot the fall-in shrink scales around (the hole center),
        // so the character collapses INTO the hole rather than toward his feet.
        // null during normal play → render uses the plain feet anchor.
        this.fallInPivotX = null;
        this.fallInPivotY = null;
        // Sink-into-the-hole clip: when set (world Y), the render hides every
        // part of the sprite BELOW this horizontal line, so as fallInDrop pushes
        // him down he vanishes behind it into the pit. null during normal play.
        this.sinkClipY = null;

        // Edge-trigger latch for hole → dungeon: true while the feet are inside a
        // hole box, so the fall fires once on entry (not every frame on it).
        this._onHoleLast = false;

        // Sprites
        this.sprites = null;
        this.loadSprites();
    }

    loadSprites() {
        const spriteSheet = new SpriteSheet(this.game);
        // Both playable characters now use the same full-behaviour loader and
        // the same map-proportional scale (scale.config.js → characterWorldScale,
        // world-px per author-px). Each pack reports its own idle render size as
        // the bbox; the collision footprint scales from it via the shared colCfg
        // ratios. Cycle order (1 key): 0=tomato (default), 1=coconut,
        // 2=eggplant, 3=laranja. bodyType selects each pack's feet-alignment
        // color scan: tomato red, coconut/eggplant tan bodies, laranja yellow.
        const ws = (window.ART && window.ART.characterWorldScale) || 0.855;
        const tomato   = spriteSheet.loadCharacterPack('tomato_sheet',   'tomato_sprites',   ws, 'red');
        const coconut  = spriteSheet.loadCharacterPack('coconut_sheet',  'coconut_sprites',  ws, 'tan');
        const eggplant = spriteSheet.loadCharacterPack('eggplant_sheet', 'eggplant_sprites', ws, 'tan');
        const laranja  = spriteSheet.loadCharacterPack('laranja_sheet',  'laranja_sprites',  ws, 'yellow');
        this.spritePacks = [
            { sprites: tomato.sprites,   width: tomato.width,   height: tomato.height },
            { sprites: coconut.sprites,  width: coconut.width,  height: coconut.height },
            { sprites: eggplant.sprites, width: eggplant.width, height: eggplant.height },
            { sprites: laranja.sprites,  width: laranja.width,  height: laranja.height }
        ];
        // Beaten-up skins: some characters get progressively more banged up as
        // they die, and stay that way for the rest of the run (even after cycling
        // characters). `deadStages` maps a pack index to an ORDERED list of hurt
        // packs — the Nth death advances to stage N (capped at the last). Most
        // characters have a single stage; TOM has two (hurt, then last-life).
        //   0 = TOM (tomato): [dead-1, dead-2]
        //   2 = ERKPA (eggplant): [dead]
        //   3 = JUIXY (laranja, the lemon-looking citrus): [dead]
        const pack = (p) => ({ sprites: p.sprites, width: p.width, height: p.height });
        const load = (sheet, defs, body) => pack(spriteSheet.loadCharacterPack(sheet, defs, ws, body));
        this.deadStages = {
            0: [load('tomato_dead_sheet',  'tomato_dead_sprites',  'red'),
                load('tomato_dead2_sheet', 'tomato_dead2_sprites', 'red')],
            2: [load('eggplant_dead_sheet',  'eggplant_dead_sprites',  'tan'),
                load('eggplant_dead2_sheet', 'eggplant_dead2_sprites', 'tan')],
            3: [load('laranja_dead_sheet',  'laranja_dead_sprites',  'yellow')]
        };
        this._deathStage = 0; // how many deaths have been applied so far

        this.characterIndex = 0;
        this._applyPackMetrics(this.spritePacks[0]);
    }

    // One-way, called once per death (respawnPlayer in main.js): advance every
    // character that has beaten-up skins to the stage matching the death count.
    // A single-stage character (ERKPA/JUIXY) stays on its one hurt pack after the
    // first death; TOM steps hurt -> last-life across his first two deaths. If the
    // character on screen is one of them, it adopts the new pack now. No-op for
    // any pack whose dead skin failed to load.
    markBeatenUp() {
        if (!this.deadStages) return;
        this._deathStage++;
        for (const key of Object.keys(this.deadStages)) {
            const idx = Number(key);
            const stages = this.deadStages[idx];
            if (!stages || !stages.length) continue;
            const pack = stages[Math.min(this._deathStage - 1, stages.length - 1)];
            if (!pack) continue;
            this.spritePacks[idx] = pack;
            if (this.characterIndex === idx) this._applyPackMetrics(pack);
        }
    }

    // Adopt a pack's sprites, bounding box, and derived collision footprint.
    _applyPackMetrics(pack) {
        this.sprites = pack.sprites;
        this.width = pack.width;
        this.height = pack.height;
        this.colW = Math.round(this.width * this.colCfg.colW);
        this.colH = Math.round(this.height * this.colCfg.colH);
        this.colOffX = Math.round(this.width * this.colCfg.colOffX);
        this.colOffY = Math.round(this.height * this.colCfg.colOffY);
        this.mass = this.colW * this.colH;
    }

    cycleCharacter() {
        this.setCharacter((this.characterIndex + 1) % this.spritePacks.length);
    }

    // Swap to a specific pack (0=tomato, 1=coconut, 2=eggplant, 3=laranja).
    // Used by the 1-key cycle and the character-select screen.
    setCharacter(index) {
        // Preserve feet center across the swap — without this, changing the
        // collision offsets would visually teleport the sprite by a few pixels.
        const feetX = this.x + this.colOffX + this.colW / 2;
        const feetY = this.y + this.colOffY + this.colH / 2;

        this.characterIndex = ((index % this.spritePacks.length) + this.spritePacks.length) % this.spritePacks.length;
        this._applyPackMetrics(this.spritePacks[this.characterIndex]);

        // Re-anchor so the new footprint center matches the old feet position.
        this.x = feetX - this.colOffX - this.colW / 2;
        this.y = feetY - this.colOffY - this.colH / 2;

        console.log(`Character ${this.characterIndex}: bbox ${this.width}x${this.height}, footprint ${this.colW}x${this.colH}`);
    }

    // Fill force: each dash-key press pumps the charge bar up 11% and flashes
    // the freshly-added segment. The bar drains continuously (see update), so
    // it only climbs while the player keeps pressing faster than it empties.
    chargeUp() {
        this.dashCharge = Math.min(1, this.dashCharge + 0.11);
        this.rechargeFlash = 1;
    }

    // Drain the hustle/charge bar toward 0 and fade the pump highlight. Split out
    // of update() so screens that drive the player themselves (the dungeon) can
    // run the same bar behaviour without re-running movement/physics.
    updateCharge(dt) {
        // Reverse force: the charge bar empties on its own, always settling
        // back to 0. The drain is gentler while the bar is just getting going
        // (≤25% → ~0.60/sec) and ramps up to the full ~0.87/sec at a full bar,
        // so starting from empty is forgiving but holding a high bar still costs.
        if (this.dashCharge > 0) {
            const maxDrain = 1000 / (this.dashDuration + this.dashCooldown); // ~0.87/sec
            const minDrain = 0.60;  // gentler reverse force while low
            const kneeAt = 0.25;    // below this, drain stays at minDrain
            const rampEnd = 0.40;   // by this level, drain is back to full strength
            let drainPerSec;
            if (this.dashCharge <= kneeAt) {
                drainPerSec = minDrain;
            } else if (this.dashCharge >= rampEnd) {
                drainPerSec = maxDrain;
            } else {
                drainPerSec = minDrain + (maxDrain - minDrain) * ((this.dashCharge - kneeAt) / (rampEnd - kneeAt));
            }
            this.dashCharge = Math.max(0, this.dashCharge - drainPerSec * dt);
        }

        // Fade the pump highlight back to the regular bar color.
        if (this.rechargeFlash > 0) {
            this.rechargeFlash = Math.max(0, this.rechargeFlash - dt / 0.4);
        }
    }

    update(dt) {
        this.updateCharge(dt);

        this.advanceAnimations();

        // Track the last horizontal facing (true = left). Kept through pure
        // up/down/idle facings; only an actual left↔right turn changes it.
        const prevFlipLeft = this.heldFlipLeft;
        if (this.facing.includes('left')) this.heldFlipLeft = true;
        else if (this.facing.includes('right')) this.heldFlipLeft = false;

        // Update lifted object position to follow player. The held object's
        // collision footprint (its red box) is snapped to rest ON TOP of the
        // player's footprint: centered horizontally, with the object box's
        // BOTTOM edge meeting the player box's TOP edge. This lifts the object
        // clear of the body so it reads as "held up" rather than worn on the
        // head. liftOffsetX/Y stay as fine-tune nudges (negative Y = higher).
        if (this.liftedObject) {
            const obj = this.liftedObject;
            // Mirror ONLY on an actual left↔right turn (differential, not
            // absolute): pickup and up/down leave the object's orientation
            // untouched, and writing its own flipX means the flip sticks after
            // it's dropped or thrown.
            if (this.heldFlipLeft !== prevFlipLeft) obj.flipX = !obj.flipX;
            const oColW = obj.colW || obj.width;
            const oColH = obj.colH || obj.height;
            const oColOffX = obj.colOffX || 0;
            const oColOffY = obj.colOffY || 0;
            const pBoxCenterX = this.x + this.colOffX + this.colW / 2;
            const pBoxTopY = this.y + this.colOffY;
            // When the body is flattened — the charge crouch, or the heavy-carry
            // pose for an object too heavy for this character — the object rides
            // 10px lower so it tracks the squashed body instead of floating.
            const flat = this.charging || this.grabHeavy;
            const flatDrop = flat ? 10 : 0;
            // object box center X == player box center X
            obj.x = pBoxCenterX - oColW / 2 - oColOffX + this.liftOffsetX;
            // object box bottom == player box top
            obj.y = pBoxTopY - oColH - oColOffY + this.liftOffsetY + flatDrop;
        }

    }

    // Advance the pose animations (walk-cycle frame, one-shot grab/put-down,
    // power-throw, empty-handed action) from this.moving / this.facing / the
    // grab+throw state. Split out of update() so screens that drive the player
    // themselves (e.g. the dungeon) can reuse the exact same animation timing
    // without re-running movement/physics.
    advanceAnimations() {
        if (this.moving) {
            this.animationCounter += this.animationSpeed;
            const walkKey = `${this.facing}_walk`;
            const frameCount = (this.sprites && this.sprites[walkKey]?.length) || 1;

            if (frameCount > 1) {
                if (this.animationCounter >= frameCount) this.animationCounter = 0;
                this.frame = Math.floor(this.animationCounter);
            } else {
                // No walk frames - just use idle
                this.frame = 0;
            }
        } else {
            this.frame = 0;
            this.animationCounter = 0;
        }

        // Advance the one-shot grab animation. Holds on the last frame (the
        // carry pose) when it completes; render keeps showing that while the
        // object is held.
        if (this.grabbing) {
            const grabLen = (this.sprites && this.sprites[this.grabKey()]?.length) || 0;
            if (grabLen === 0) {
                this.grabbing = false;
                this.grabReverse = false;
            } else if (this.grabReverse) {
                // Put-down: play backward to frame 0 (idle pose), then stop.
                this.grabCounter -= this.grabSpeed;
                this.grabFrame = Math.floor(this.grabCounter);
                if (this.grabFrame <= 0) {
                    this.grabFrame = 0;
                    this.grabbing = false;
                    this.grabReverse = false;
                }
            } else {
                // Pickup: play forward, hold the final (carry) frame.
                this.grabCounter += this.grabSpeed;
                this.grabFrame = Math.floor(this.grabCounter);
                if (this.grabFrame >= grabLen) {
                    this.grabFrame = grabLen - 1;
                    this.grabbing = false;
                }
            }
        }

        // Power-throw animation (one-shot; returns to idle when finished).
        if (this.throwAnimating) {
            const len = (this.sprites && this.sprites[`${this.facing}_throw`]?.length) || 0;
            if (len === 0) {
                this.throwAnimating = false;
            } else {
                this.throwAnimCounter += this.throwAnimSpeed;
                this.throwAnimFrame = Math.floor(this.throwAnimCounter);
                if (this.throwAnimFrame >= len) {
                    this.throwAnimFrame = len - 1;
                    this.throwAnimating = false;
                }
            }
        }

        // Empty-handed action gesture (one-shot hold; returns to idle/walk).
        if (this.actionAnimating) {
            this.actionTicks--;
            if (this.actionTicks <= 0) this.actionAnimating = false;
        }
    }

    /**
     * Get the facing direction as a unit vector based on last input.
     */
    getFacingVector() {
        const diag = Math.SQRT1_2; // ~0.707
        switch (this.facing) {
            case 'down':       return { x: 0, y: 1 };
            case 'up':         return { x: 0, y: -1 };
            case 'right':      return { x: 1, y: 0 };
            case 'left':       return { x: -1, y: 0 };
            case 'down_right': return { x: diag, y: diag };
            case 'down_left':  return { x: -diag, y: diag };
            case 'up_right':   return { x: diag, y: -diag };
            case 'up_left':    return { x: -diag, y: -diag };
            default:           return { x: 0, y: 1 };
        }
    }

    /**
     * Find the best rock to stack on: closest in the facing direction.
     */
    updateStackTarget(obstacles) {
        // Only update every 6 frames
        this._stackTargetTimer = (this._stackTargetTimer || 0) + 1;
        if (this._stackTargetTimer % 6 !== 0) return;

        this.stackTarget = null;
        if (!this.liftedObject) return;

        const cx = this.x + this.width / 2;
        const cy = this.y + this.height / 2;
        const dir = this.getFacingVector();
        const maxDist = 96;

        let bestScore = Infinity;
        for (const obs of obstacles) {
            if (!obs.pushable || obs === this.liftedObject) continue;
            if (obs.stackChild) continue;

            const ox = obs.x + obs.width / 2;
            const oy = obs.y + obs.height / 2;
            const dx = ox - cx;
            const dy = oy - cy;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > maxDist || dist < 1) continue;

            // Dot product: how aligned is this rock with facing direction
            const dot = (dx / dist) * dir.x + (dy / dist) * dir.y;
            if (dot < 0.3) continue; // must be roughly in front

            // Score: prefer closer and more aligned
            const score = dist * (1.5 - dot);
            if (score < bestScore) {
                bestScore = score;
                this.stackTarget = obs;
            }
        }
    }

    /**
     * Try to lift a nearby object, or drop the currently held one.
     * Returns the dropped object (if any) so main.js can re-add it to the world.
     */
    liftOrDrop(obstacles) {
        if (this.liftedObject) {
            // Drop in front of the player, placed so the object's collision
            // footprint just touches the player's footprint (the red box) in
            // the facing direction — close, but not overlapping.
            const obj = this.liftedObject;
            const gap = 4;
            const fv = this.getFacingVector();
            const oColW = obj.colW || obj.width;
            const oColH = obj.colH || obj.height;
            const oColOffX = obj.colOffX || 0;
            const oColOffY = obj.colOffY || 0;
            // Player footprint center
            const pcx = this.x + this.colOffX + this.colW / 2;
            const pcy = this.y + this.colOffY + this.colH / 2;
            // Desired object footprint center: pushed out by the two half-
            // footprints plus the gap so the boxes touch without overlapping.
            const ocx = pcx + fv.x * (this.colW / 2 + oColW / 2 + gap);
            const ocy = pcy + fv.y * (this.colH / 2 + oColH / 2 + gap);
            // Convert footprint center → object top-left.
            obj.x = ocx - oColOffX - oColW / 2;
            obj.y = ocy - oColOffY - oColH / 2;

            // Stack onto the targeted rock if one exists
            let stacked = false;
            if (this.stackTarget && !this.stackTarget.stackChild) {
                const other = this.stackTarget;
                obj.x = other.x + (other.width - obj.width) / 2;
                obj.y = other.y - STACK_OFFSET;
                obj.stackParent = other;
                other.stackChild = obj;
                stacked = true;
            }
            this.stackTarget = null;

            obj.isObstacle = true;

            // Nudge player out if the dropped rock overlaps with them
            const dr = obj.getRect();
            const pr = this.getRect();
            if (pr.x < dr.x + dr.width && pr.x + pr.width > dr.x &&
                pr.y < dr.y + dr.height && pr.y + pr.height > dr.y) {
                if (fv.x > 0)  this.x = dr.x - this.colW - this.colOffX - 1;
                if (fv.x < 0)  this.x = dr.x + dr.width - this.colOffX + 1;
                if (fv.y > 0)  this.y = dr.y - this.colH - this.colOffY - 1;
                if (fv.y < 0)  this.y = dr.y + dr.height - this.colOffY + 1;
            }
            this.liftedObject = null;
            this.startDrop();
            return obj;
        }

        // Try to pick up a nearby pushable object in the facing direction
        const reach = 8;
        const liftFv = this.getFacingVector();
        for (const obs of obstacles) {
            if (!obs.pushable || obs.mass >= this.mass) continue;
            if (obs.liftable === false) continue; // live rocks can't be lifted
            if (obs.stackChild) continue; // can't lift if something is on top

            const r = obs.getRect();
            const pr = this.getRect();
            // Visual vertical overlap (generous — allows lifting stacked rocks above player)
            const vOverlap = this.y + this.height > obs.y && this.y < obs.y + obs.height;
            // Horizontal overlap using collision footprint
            const hOverlap = pr.x + pr.width > r.x && pr.x < r.x + r.width;

            let inRange = false;
            if (liftFv.x !== 0 && liftFv.y !== 0) {
                // Diagonal: the object must be near the forward CORNER — within
                // reach on BOTH axes. (Previously this OR'd the two axis checks,
                // each of which is unbounded on the other axis, so a diagonal
                // facing would grab any liftable object anywhere up/down the
                // same column or across the same row — picking cubes up from
                // clear across the map.)
                const hOk = liftFv.x > 0
                    ? pr.x + pr.width + reach > r.x && pr.x < r.x
                    : pr.x - reach < r.x + r.width && pr.x > r.x;
                const vOk = liftFv.y > 0
                    ? pr.y + pr.height + reach > r.y && pr.y < r.y
                    : pr.y - reach < r.y + r.height && pr.y > r.y;
                inRange = hOk && vOk;
            } else if (liftFv.y > 0)  { inRange = pr.y + pr.height + reach > r.y && pr.y < r.y && hOverlap; }
            else if (liftFv.y < 0)    { inRange = pr.y - reach < r.y + r.height && pr.y > r.y && hOverlap; }
            else if (liftFv.x > 0)    { inRange = pr.x + pr.width + reach > r.x && pr.x < r.x && vOverlap; }
            else if (liftFv.x < 0)    { inRange = pr.x - reach < r.x + r.width && pr.x > r.x && vOverlap; }

            if (inRange) {
                // Detach from stack if this rock was on top of another
                if (obs.stackParent) {
                    obs.stackParent.stackChild = null;
                    obs.stackParent = null;
                }
                this.liftedObject = obs;
                obs.isObstacle = false;
                // Lifted out of the sand: drop the sink crop so the whole
                // sprite shows while carried. It re-evaluates (and reappears)
                // once dropped/thrown back onto sand.
                if ('onSand' in obs) obs.onSand = false;
                this.startGrab();
                return null;
            }
        }
        return null;
    }

    // The active grab animation key for the current facing — the longer
    // grab_heavy sequence when carrying a heavy object, else the normal grab.
    grabKey() {
        return this.grabHeavy ? `${this.facing}_grab_heavy` : `${this.facing}_grab`;
    }

    // Kick off the one-shot grab animation if the active sprite pack has grab
    // frames for the current facing (coconut does, tomato doesn't). Heavy
    // objects (>50% of player mass) use the longer flattening sequence.
    startGrab() {
        const obj = this.liftedObject;
        this.grabHeavy = !!obj && obj.mass > this.mass * 0.5;
        if (this.sprites && this.sprites[this.grabKey()]?.length) {
            this.grabbing = true;
            this.grabReverse = false;
            this.grabFrame = 0;
            this.grabCounter = 0;
        }
    }

    // Kick off the empty-handed action gesture if the active sprite pack has
    // action frames for the current facing (coconut does, tomato doesn't —
    // for those this is a no-op). Called when a pickup press finds nothing.
    startAction() {
        if (this.actionAnimating) return;
        if (this.sprites && this.sprites[`${this.facing}_action`]?.length) {
            this.actionAnimating = true;
            this.actionTicks = this.actionHoldTicks;
        }
    }

    // Launch the carried object on a parabolic arc in the facing direction.
    // Returns the thrown object (now detached) or null.
    //
    // `charge` is 0..1, linear in how long Space was held (capped by the
    // caller). Ground distance scales linearly with it: full charge throws the
    // max distance, half the charge → half the distance. Arc height and flight
    // duration ease up with charge too, so a light toss is small and quick and
    // a full throw is big and long.
    //
    // FUTURE: distance should also scale with object mass (heavier = shorter).
    // FUTURE: mid-flight collision with other objects / players.
    throwObject(charge = 1) {
        const obj = this.liftedObject;
        if (!obj) return null;
        const c = Math.max(0, Math.min(1, charge));
        const fv = this.getFacingVector();
        const MAX_D = 520;                       // ground distance (px) at full charge
        let D = MAX_D * c;
        const T = Math.round(42 + (60 - 42) * c); // flight duration in frames
        const H = 140 + (210 - 140) * c;          // arc peak height in px (visual only)

        // Upward throws (any negative-y facing) read as travelling farther
        // because of the iso perspective illusion, so shorten them 30%.
        if (fv.y < 0) D *= 0.7;

        obj.thrown = true;
        obj.pushable = false;
        obj.isObstacle = false;
        obj.surfaceState = 'ground'; // don't let cube-fall grab it on landing
        obj.stackParent = null;
        obj.throwT = 0;
        obj.throwDur = T;
        obj.throwH = H;
        obj.throwVx = fv.x * D / T;
        obj.throwVy = fv.y * D / T;
        obj.throwZ = 0;

        this.liftedObject = null;
        this.charging = false;

        // Strong throws play the big wind-up→release animation (cols 4–8).
        if (c >= 0.5 && this.sprites[`${this.facing}_throw`]?.length) {
            this.throwAnimating = true;
            this.throwAnimFrame = 0;
            this.throwAnimCounter = 0;
        }
        return obj;
    }

    // Play the grab sequence in reverse (carry pose → idle) on put-down.
    // grabHeavy is left as-is so the reverse matches the sequence that was
    // used to pick the object up.
    startDrop() {
        const len = (this.sprites && this.sprites[this.grabKey()]?.length) || 0;
        if (len > 0) {
            this.grabbing = true;
            this.grabReverse = true;
            this.grabFrame = len - 1;
            this.grabCounter = len - 1;
        }
    }

    move(dx, dy, obstacles = []) {
        if (dx !== 0 || dy !== 0) {
            this.moving = true;

            // Determine facing direction — use diagonal when both axes active
            const nowH = dx !== 0;
            const nowV = dy !== 0;

            if (nowH && nowV) {
                const vDir = dy > 0 ? 'down' : 'up';
                const hDir = dx > 0 ? 'right' : 'left';
                const diagFacing = `${vDir}_${hDir}`;
                const diagKey = `${diagFacing}_idle`;
                if (this.sprites && this.sprites[diagKey] && this.sprites[diagKey].length > 0) {
                    this.facing = diagFacing;
                } else {
                    const wasH = this.lastDx !== 0;
                    const wasV = this.lastDy !== 0;
                    if (!wasH && nowH) this.dominantAxis = 'vertical';
                    else if (!wasV && nowV) this.dominantAxis = 'horizontal';
                    if (!this.dominantAxis) {
                        this.dominantAxis = Math.abs(dx) >= Math.abs(dy) ? 'horizontal' : 'vertical';
                    }
                    if (this.dominantAxis === 'horizontal') {
                        this.facing = dx > 0 ? 'right' : 'left';
                    } else {
                        this.facing = dy > 0 ? 'down' : 'up';
                    }
                }
                this.diagGraceFrames = 3;
            } else if (this.diagGraceFrames > 0) {
                // Just released one key from diagonal — hold diagonal facing briefly
                this.diagGraceFrames--;
            } else if (nowH) {
                this.dominantAxis = 'horizontal';
                this.facing = dx > 0 ? 'right' : 'left';
            } else {
                this.dominantAxis = 'vertical';
                this.facing = dy > 0 ? 'down' : 'up';
            }

            // While climbing, the player is hugging the wall and cannot turn
            // to face downward. Clamp the lower half of the facing set to the
            // equivalent upward pose.
            if (this.surfaceState === 'climbing') {
                if      (this.facing === 'down')       this.facing = 'up';
                else if (this.facing === 'down_left')  this.facing = 'up_left';
                else if (this.facing === 'down_right') this.facing = 'up_right';
                else if (this.facing === 'left')       this.facing = 'up_left';
                else if (this.facing === 'right')      this.facing = 'up_right';
            }

            this.lastDx = dx;
            this.lastDy = dy;

            // Per-axis collision with pushing
            let newX = this.x + dx;
            let newY = this.y + dy;
            this.pushing = false;

            // Check X axis (only if actually moving on X)
            let xBlocked = false;
            if (dx !== 0) {
                xBlocked = this._resolveAxis(newX, this.y, dx, 'x', obstacles);
                if (!xBlocked) this.x = this._resolvedPos;
            }

            // Check Y axis (only if actually moving on Y)
            let yBlocked = false;
            if (dy !== 0) {
                yBlocked = this._resolveAxis(this.x, newY, dy, 'y', obstacles);
                if (!yBlocked) this.y = this._resolvedPos;
            }
        } else {
            this.moving = false;
            this.dominantAxis = null;
            this.lastDx = 0;
            this.lastDy = 0;
            this.diagGraceFrames = 0;
        }
    }

    /**
     * Resolve collision on a single axis. Returns true if blocked.
     * On success, sets this._resolvedPos to the new coordinate.
     * Supports chain pushing: rock A pushed into rock B pushes both.
     */
    _resolveAxis(testX, testY, delta, axis, obstacles) {
        // 0. Red zones are impassable: any move whose destination feet center
        // lands on RED is rejected. Skipped while behindMountain — same as
        // ramp drift, climb, and the other zone-driven rules, the player
        // isn't on the same plane as the painted terrain there.
        const worldRef = this.game && this.game.world;
        if (worldRef && worldRef.getZoneAt && !this.behindMountain) {
            const destFeetX = testX + this.colOffX + this.colW / 2;
            const destFeetY = testY + this.colOffY + this.colH / 2;
            if (worldRef.getZoneAt(destFeetX, destFeetY) === Zone.RED) {
                return true;
            }
        }

        // 1. Collect all obstacles the player directly collides with
        const directHits = new Set();
        const pushChain = new Set();
        for (const obs of obstacles) {
            if (this._collides(testX, testY, obs)) {
                const base = obs.stackParent || obs;
                if (base.onCollision) base.onCollision();
                if (!base.pushable) return true; // immovable
                directHits.add(base);
                pushChain.add(base);
            }
        }

        if (pushChain.size === 0) {
            this._resolvedPos = axis === 'x' ? testX : testY;
            this.pushing = false;
            return false;
        }

        // 2. Cascade: check if pushed rocks would hit other rocks, adding them to the chain
        const pushDir = delta > 0 ? 1 : -1;
        let chainChanged = true;
        while (chainChanged) {
            chainChanged = false;
            for (const base of pushChain) {
                const oCol = base.getRect();
                // Simulate this rock's pushed position
                const simX = axis === 'x' ? oCol.x + delta : oCol.x;
                const simY = axis === 'y' ? oCol.y + delta : oCol.y;

                for (const other of obstacles) {
                    const otherBase = other.stackParent || other;
                    if (pushChain.has(otherBase) || other === base.stackChild) continue;

                    const oR = other.getRect();
                    if (simX < oR.x + oR.width && simX + oCol.width > oR.x &&
                        simY < oR.y + oR.height && simY + oCol.height > oR.y) {
                        // This rock would be pushed into 'other'
                        if (!otherBase.pushable) return true; // chain hits immovable
                        pushChain.add(otherBase);
                        chainChanged = true;
                    }
                }
            }
        }

        // 3. Sum combined mass of entire chain
        let combinedMass = 0;
        for (const base of pushChain) {
            combinedMass += base.mass + (base.stackChild ? base.stackChild.mass : 0);
        }
        if (combinedMass >= this.mass) return true; // too heavy

        // 4. Compute push speed based on combined mass, then check for external blockers
        const pushSpeed = combinedMass < this.mass * 0.5 ? 0.7 : 0.5;
        const pushDelta = pushDir * Math.abs(delta) * pushSpeed;

        const savedPositions = [];
        for (const base of pushChain) {
            savedPositions.push({ base, x: base.x, y: base.y });
        }

        // Check each chain rock's pushed position against non-chain obstacles
        for (const base of pushChain) {
            const oCol = base.getRect();
            const newColX = axis === 'x' ? oCol.x + pushDelta : oCol.x;
            const newColY = axis === 'y' ? oCol.y + pushDelta : oCol.y;

            for (const other of obstacles) {
                const otherBase = other.stackParent || other;
                if (pushChain.has(otherBase) || other === base.stackChild) continue;

                const oR = other.getRect();
                if (newColX < oR.x + oR.width && newColX + oCol.width > oR.x &&
                    newColY < oR.y + oR.height && newColY + oCol.height > oR.y) {
                    return true; // chain blocked by external obstacle
                }
            }
        }

        // On zone-driven stages: reject upward pushes that would land any
        // chain rock on a WALL pixel. Side and downward pushes onto walls are
        // allowed — the per-frame fall check in updateGame turns them into
        // a fall. Upward pushes (pushing a cube from below onto a wall) are
        // blocked outright for now.
        const world = this.game && this.game.world;
        if (axis === 'y' && pushDelta < 0 && world && world.stage && world.stage.backgroundImage) {
            for (const base of pushChain) {
                const cx = base.x + (base.colOffX || 0) + (base.colW || base.width) / 2;
                const cy = base.y + pushDelta + (base.colOffY || 0) + (base.colH || base.height) / 2;
                if (world.getZoneAt(cx, cy) === Zone.WALL) return true;
            }
        }

        // 5. Apply push to entire chain
        for (const base of pushChain) {
            if (axis === 'x') {
                base.x += pushDelta;
                if (base.stackChild) base.stackChild.x = base.x + (base.width - base.stackChild.width) / 2;
            } else {
                base.y += pushDelta;
                if (base.stackChild) base.stackChild.y = base.y - STACK_OFFSET;
            }
        }

        // 6. Snap player to nearest directly-hit obstacle edge
        let snapPos;
        if (axis === 'x') {
            if (delta > 0) {
                snapPos = Infinity;
                for (const base of directHits) {
                    const r = base.getRect();
                    snapPos = Math.min(snapPos, r.x - this.colW - this.colOffX);
                }
            } else {
                snapPos = -Infinity;
                for (const base of directHits) {
                    const r = base.getRect();
                    snapPos = Math.max(snapPos, r.x + r.width - this.colOffX);
                }
            }
        } else {
            if (delta > 0) {
                snapPos = Infinity;
                for (const base of directHits) {
                    const r = base.getRect();
                    snapPos = Math.min(snapPos, r.y - this.colH - this.colOffY);
                }
            } else {
                snapPos = -Infinity;
                for (const base of directHits) {
                    const r = base.getRect();
                    snapPos = Math.max(snapPos, r.y + r.height - this.colOffY);
                }
            }
        }

        // 7. Verify snap position doesn't overlap any obstacle
        const verifyX = axis === 'x' ? snapPos : testX;
        const verifyY = axis === 'y' ? snapPos : testY;
        for (const obs of obstacles) {
            if (this._collides(verifyX, verifyY, obs)) {
                for (const saved of savedPositions) {
                    saved.base.x = saved.x;
                    saved.base.y = saved.y;
                    if (saved.base.stackChild) {
                        saved.base.stackChild.x = saved.x + (saved.base.width - saved.base.stackChild.width) / 2;
                        saved.base.stackChild.y = saved.y - STACK_OFFSET;
                    }
                }
                return true;
            }
        }

        this._resolvedPos = snapPos;
        this.pushing = true;
        return false;
    }

    _collides(testX, testY, obstacle) {
        const r = obstacle.getRect();
        const cx = testX + this.colOffX;
        const cy = testY + this.colOffY;
        return cx < r.x + r.width &&
               cx + this.colW > r.x &&
               cy < r.y + r.height &&
               cy + this.colH > r.y;
    }

    _rectsOverlap(x, y, w, h, obstacle) {
        const r = obstacle.getRect();
        return x < r.x + r.width &&
               x + w > r.x &&
               y < r.y + r.height &&
               y + h > r.y;
    }

    getRect() {
        this._rect.x = this.x + this.colOffX;
        this._rect.y = this.y + this.colOffY;
        this._rect.width = this.colW;
        this._rect.height = this.colH;
        return this._rect;
    }

    // Pick the sprite frame for the current pose (throw > charge-crouch > grab >
    // carry-hold > walk > action > idle). Pure selection — no drawing — so a
    // screen that renders the player itself (the dungeon) shows the exact same
    // poses as the overworld. Returns a spriteData frame, or undefined.
    getCurrentFrame() {
        const walkKey = `${this.facing}_walk`;
        const idleKey = `${this.facing}_idle`;
        const grabFrames = this.sprites[this.grabKey()];
        const heavyFrames = this.sprites[`${this.facing}_grab_heavy`];
        const throwFrames = this.sprites[`${this.facing}_throw`];

        if (this.throwAnimating && throwFrames && throwFrames.length > 0) {
            // Power-throw release motion (cols 4–8).
            return throwFrames[Math.min(this.throwAnimFrame, throwFrames.length - 1)];
        } else if (this.charging && this.liftedObject && heavyFrames && heavyFrames.length > 0) {
            // Throw wind-up: hold the flattened crouch (grab_heavy last frame).
            return heavyFrames[heavyFrames.length - 1];
        } else if (this.grabbing && grabFrames && grabFrames.length > 0) {
            // Playing the pickup/put-down animation.
            return grabFrames[Math.min(this.grabFrame, grabFrames.length - 1)];
        } else if (this.liftedObject && grabFrames && grabFrames.length > 0) {
            // Carrying — hold the last grab frame as the carry pose.
            return grabFrames[grabFrames.length - 1];
        } else if (this.moving && this.sprites[walkKey] && this.sprites[walkKey].length > 0) {
            return this.sprites[walkKey][Math.min(this.frame, this.sprites[walkKey].length - 1)];
        } else if (this.actionAnimating && this.sprites[`${this.facing}_action`]?.length > 0) {
            // Empty-handed "reach" gesture (coconut col 0); walking overrides it.
            return this.sprites[`${this.facing}_action`][0];
        } else if (this.sprites[idleKey] && this.sprites[idleKey].length > 0) {
            return this.sprites[idleKey][0];
        }
        return undefined;
    }

    render(ctx, game, camX, camY) {
        const drawX = this.x - camX;
        const drawY = this.y - camY;

        const spriteData = this.getCurrentFrame();

        const sinkAmount = this.onSand ? STACK_OFFSET : 0;

        if (spriteData && spriteData.image) {
            // Each frame renders at its own width AND height (a single scale
            // factor was baked in at load time), so poses with a different
            // aspect — e.g. the flattened heavy-carry frame — stay
            // proportionally sized instead of being stretched to a fixed
            // height. Anchored at the BOTTOM of the bounding box so the feet
            // stay planted; a shorter frame sits lower, not bigger.
            //
            // Depth perspective: scale the DRAWN sprite (only) by where the feet
            // sit in the stage's perspective band — bigger to the south, smaller
            // to the north. Collision/movement/depth-sort use the unscaled box,
            // so only the visual responds (1 when the stage has no perspective).
            let pscale = 1;
            if (game.world && game.world.getPerspectiveScale) {
                const feetY = this.y + this.colOffY + this.colH * 0.5;
                pscale = game.world.getPerspectiveScale(feetY);
            }
            const f = this.fallInScale;
            const renderW = spriteData.width * pscale * f;
            const renderH = spriteData.height * pscale * f;
            const visibleH = renderH - sinkAmount;
            const srcCropRatio = sinkAmount / renderH;
            const cropSh = spriteData.sh * (1 - srcCropRatio);

            // Full-size (f=1) anchor: feet planted, centered on the footprint
            // column, nudged by the frame's feet-baseline correction (coconut
            // frames carry vAlign; others default to 0) so every pose plants its
            // feet on the same line. This is where the sprite sits before any
            // fall-in shrink is applied.
            const fullW = spriteData.width * pscale;
            const fullH = spriteData.height * pscale;
            let baseX = drawX;
            if (fullW !== this.width) {
                baseX = drawX + this.colOffX + this.colW / 2 - fullW / 2;
            }
            const baseY = drawY + this.height - fullH + (spriteData.vAlign || 0);

            // Position the (possibly shrunk) sprite. During the dungeon-fall the
            // shrink scales AROUND the hole-center pivot, so the character
            // collapses INTO the hole instead of toward his own feet. With full
            // scale / no pivot this reduces exactly to the normal feet anchor.
            let offsetX, topY;
            if (this.fallInPivotX != null && f !== 1) {
                const px = this.fallInPivotX - camX;
                const py = this.fallInPivotY - camY;
                offsetX = px + (baseX - px) * f;
                topY = py + (baseY - py) * f;
            } else {
                offsetX = baseX;
                topY = baseY;
            }
            offsetX = Math.round(offsetX);
            topY += this.fallInDrop;

            // Sink-into-the-hole: clip away everything below the sink line so the
            // sprite vanishes behind it as fallInDrop pushes it down. The rect is
            // in the same world-minus-cam space the sprite draws in (inside the
            // camera transform), so the clip tracks the sprite correctly.
            const sinking = this.sinkClipY != null;
            if (sinking) {
                ctx.save();
                ctx.beginPath();
                ctx.rect(-100000, -100000, 200000, (this.sinkClipY - camY) + 100000);
                ctx.clip();
            }

            ctx.save();
            if (spriteData.flipped) {
                ctx.translate(offsetX + renderW, topY);
                ctx.scale(-1, 1);
                ctx.drawImage(
                    spriteData.image,
                    spriteData.sx, spriteData.sy, spriteData.sw, cropSh,
                    0, 0, renderW, visibleH
                );
            } else {
                ctx.drawImage(
                    spriteData.image,
                    spriteData.sx, spriteData.sy, spriteData.sw, cropSh,
                    offsetX, topY, renderW, visibleH
                );
            }
            ctx.restore();

            if (sinking) ctx.restore();
        } else {
            ctx.fillStyle = '#ff6b35';
            ctx.fillRect(drawX, drawY, this.width, this.height - sinkAmount);
            ctx.fillStyle = '#fff';
            ctx.font = '10px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('PLAYER', drawX + this.width / 2, drawY + (this.height - sinkAmount) / 2 + 4);
            ctx.textAlign = 'left';
        }

        if (game.showDebug) {
            ctx.strokeStyle = 'lime';
            ctx.lineWidth = 1;
            ctx.strokeRect(drawX, drawY, this.width, this.height);
            // Collision footprint
            ctx.strokeStyle = 'red';
            ctx.strokeRect(drawX + this.colOffX, drawY + this.colOffY, this.colW, this.colH);
            ctx.fillStyle = 'lime';
            ctx.font = '10px monospace';
            const runInfo = this.running ? ' RUN' : '';
            const chargeInfo = this.dashCharge > 0 ? ` chg:${Math.round(this.dashCharge * 100)}%` : '';
            ctx.fillText(`${this.facing} ${this.moving ? 'walk' : 'idle'} f:${this.frame}${runInfo}${chargeInfo} m:${this.mass}`, drawX, drawY - 4);
        }

        // Render lifted object above head. Its orientation is driven through
        // obj.flipX in update() (mirrors with the player and persists on release),
        // so this is a plain draw.
        if (this.liftedObject) {
            this.liftedObject.render(ctx, game, camX, camY);
        }

        // Stack target cursor — shows which rock you'll stack on
        if (this.stackTarget && this.liftedObject) {
            const t = this.stackTarget;
            const tx = t.x - camX;
            const ty = t.y - camY;
            const pad = 4;
            const cornerLen = 8;

            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.globalAlpha = 0.6 + Math.sin(performance.now() / 200) * 0.3;

            // Top-left corner
            ctx.beginPath();
            ctx.moveTo(tx - pad, ty - pad + cornerLen);
            ctx.lineTo(tx - pad, ty - pad);
            ctx.lineTo(tx - pad + cornerLen, ty - pad);
            ctx.stroke();
            // Top-right corner
            ctx.beginPath();
            ctx.moveTo(tx + t.width + pad - cornerLen, ty - pad);
            ctx.lineTo(tx + t.width + pad, ty - pad);
            ctx.lineTo(tx + t.width + pad, ty - pad + cornerLen);
            ctx.stroke();
            // Bottom-left corner
            ctx.beginPath();
            ctx.moveTo(tx - pad, ty + t.height + pad - cornerLen);
            ctx.lineTo(tx - pad, ty + t.height + pad);
            ctx.lineTo(tx - pad + cornerLen, ty + t.height + pad);
            ctx.stroke();
            // Bottom-right corner
            ctx.beginPath();
            ctx.moveTo(tx + t.width + pad - cornerLen, ty + t.height + pad);
            ctx.lineTo(tx + t.width + pad, ty + t.height + pad);
            ctx.lineTo(tx + t.width + pad, ty + t.height + pad - cornerLen);
            ctx.stroke();

            ctx.globalAlpha = 1;
        }
    }
}

window.Player = Player;
