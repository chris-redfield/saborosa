/**
 * LiftRide — the elevator that takes the player out of HIPÓLITO's room and
 * delivers him into the library, and the only two cutscenes in the game where
 * the character walks himself.
 *
 * Asked for 2026-09-04, in two halves that are one mechanism:
 *
 *   *"matou o boss? o player perde o controle do boneco, ele caminha para a
 *   esquerda para o mesmo ponto sempre, e um elevador vai descer do meio, vai
 *   pousar na frente do player, o player entra no elevador (anda até o meio do
 *   elevador) e o elevador sobe e a tela fica parada, até ele sumir da tela"*
 *
 *   *"Quando ele chega na fase da biblioteca, ele chega via elevador, ao invés
 *   de vir caminhando pela esquerda."*
 *
 * ---------------------------------------------------------------------------
 * ⚠️ THE TWO HALVES ARE ONE FILE BECAUSE THEY ARE ONE SHOT, CUT IN THE MIDDLE
 * ---------------------------------------------------------------------------
 * He steps on at the bottom of one room and off at the top of the next; the
 * room change is the fade in between. Writing the exit as a boss-room outro and
 * the arrival as a level-3 entrance would have put the two ends of a single
 * journey in two files that share a lift, a rider and a rise — and they would
 * drift the first time either was tuned. `mode` is the only thing that differs.
 *
 * ⚠️ AND IT REPLACES THE WALK-IN/WALK-OUT RATHER THAN DECORATING THEM. The
 * ordinary room transition is `player.walkOut()` to the right and
 * `player.enterWalk()` from the left. A room that opts in (`exitByLift` /
 * `enterByLift`) gets this instead, and game.js picks between them at the two
 * points it already had for the purpose. Nothing else in the game learns that
 * lifts between rooms exist.
 *
 * ---------------------------------------------------------------------------
 * ⚠️ `jumpY` IS HOW HE RIDES, AND IT IS THE ONLY HONEST FIELD FOR IT
 * ---------------------------------------------------------------------------
 * Fighter's `jumpY` is documented as "height off the floor, DRAWN ONLY — never
 * touches x or z", which is exactly a rider on a platform: he is still standing
 * at his world x on the belt, he is merely drawn further up the screen. The
 * alternative — moving `z`, or inventing a second vertical — would have put him
 * in a different depth lane the moment the ride ended, and z is what the whole
 * game sorts and collides on.
 *
 * ⚠️ IT IS ONLY SAFE BECAUSE NOTHING ELSE IS WRITING IT. `jumpY` is assigned in
 * exactly two places (`_updateJump` while `jumping`, and the knockdown arc while
 * `state === 'down'`), and a scripted player is in neither. Checked before
 * relying on it rather than after.
 *
 * ⚠️ THE SHADOW COMES OFF FOR THE RIDE. A ground shadow is load-bearing for a
 * JUMP — it is the only thing that says where you will land — and actively wrong
 * for a lift, where it would sit on the floor of a room the rider has left while
 * he climbs away from it. `noShadow` is the shared opt-out game.js already
 * honours, and it is restored on the way out; see `_release`.
 *
 * ---------------------------------------------------------------------------
 * ⚠️ THE CAMERA IS NOT TOUCHED, IT IS SIMPLY NOT TICKED
 * ---------------------------------------------------------------------------
 * *"a tela fica parada"*. There is no camera code here and there must not be:
 * the phases that run this (`liftout`, `liftin`) tick the ride, the crowd and
 * the FX and nothing else, so the camera holds wherever the last played frame
 * left it. A lift that froze the camera itself would be a second opinion about
 * where the camera is, which is the bug family level 3 exists to document.
 */
const LiftRide = {
  active: false,
  mode: null,        // 'exit' | 'arrive'
  step: null,
  t: 0,
  /** World x the slab stands at, and how far ABOVE the belt line it is drawn. */
  liftX: 0,
  rise: 0,
  markX: 0,
  /* THE SLAB HE STEPPED OFF, still on the wall after the ride hands back. */
  parked: false,
  parkedX: 0,
  _lastCamX: null,
  _wasNoShadow: false,

  cfg() { return CONFIG.LIFT_RIDE || {}; },
  _n(k, d) { const v = this.cfg()[k]; return (v != null) ? v : d; },

  /** Per-room overrides live on the ROOM, because the marks are room geography. */
  _roomCfg(stage) {
    const r = (stage && stage.room) ? stage.room() : null;
    if (!r) return {};
    return (this.mode === 'exit' ? r.exitByLift : r.enterByLift) || {};
  },
  _rn(stage, k, d) {
    const v = this._roomCfg(stage)[k];
    return (v != null) ? v : this._n(k, d);
  },

  reset() {
    this.active = false;
    this.mode = null;
    this.step = null;
    this.t = 0;
    this.rise = 0;
    this.parked = false;
    this._lastCamX = null;
  },

  /**
   * HE KILLED THE BOSS. Take the character away and walk him to the mark.
   *
   * ⚠️ THE MARK IS ALWAYS THE SAME PLACE — *"ele caminha para a esquerda para o
   * mesmo ponto sempre"* — so it is a world x and not an offset from wherever
   * the fight happened to end. That is the whole request: the shot is supposed
   * to look identical every run, and a mark measured from the player would make
   * the elevator land somewhere new each time.
   */
  startExit(player, stage) {
    this.reset();
    this.active = true;
    this.mode = 'exit';
    this.step = 'walk';
    /* ⚠️ THE MARKS ARE SCREEN X, RESOLVED ONCE AGAINST THE FROZEN CAMERA, and
       that is not the same as being lazy about world coordinates.
       *"um elevador vai descer do meio"* is a statement about the SCREEN, and
       *"o mesmo ponto sempre"* is a statement about what you see -- and in this
       room those two only agree if the camera is where you expect. It is not
       guaranteed to be: the boss segment does not lock (`lock: false`), so the
       camera ends wherever the last exchange left it, anywhere in the room's
       337px of travel. A fixed WORLD mark would then land the lift a third of a
       screen off centre on some runs and look like a bug in the cutscene.
       Resolved against `camX` at the moment the ride starts -- which is the last
       time the camera moves, because nothing ticks it from here -- the shot is
       identical every run, which is what was actually asked for. */
    const camX = (stage && stage.camX) || 0;
    this.liftX = camX + this._rn(stage, 'liftScreenX', 640);
    /* ⚠️ WHERE HE WAITS IS NOT FREE -- IT IS THE SLAB'S EDGE PLUS A GAP, and
       that is the whole of *"vai pousar na frente do player"*. The lift is 960px
       wide and anchored on its lip's CENTRE, so a mark chosen independently sits
       INSIDE it: at the obvious-looking 890, against a slab spanning 160..1120,
       the elevator comes down ON TOP of him and there is nothing to walk onto.
       Rendered it, saw it, and derived the mark instead -- half the slab plus
       `markGapPx` of daylight. Change `widthPx` and the mark follows.
       `markScreenX` is still honoured if a room wants to say it outright. */
    const half = this._n('widthPx', 960) / 2;
    const given = this._rn(stage, 'markScreenX', null);
    this.markX = camX + ((given != null) ? given
                         : (this.liftX - camX) + half + this._n('markGapPx', 70));
    /* IT STARTS ABOVE THE FRAME, so `descend` has somewhere to come from --
       *"um elevador vai descer"*. Nothing is drawn off-screen; the cull in
       `draw` is the slab's own box. */
    this.rise = this._n('dropPx', 900);
    this._grab(player);
  },

  /**
   * A NEW ROOM, ARRIVED IN RATHER THAN WALKED INTO.
   *
   * ⚠️ HIS X NEVER MOVES AT ALL, which is what keeps this out of level 3's way.
   * The lift brings him UP to the floor and that is the whole of it: he is set
   * down at the centre of the screen and the beat ends there.
   *
   * ⚠️ IT USED TO WALK HIM OFF THE SLAB, AND THAT WAS MINE RATHER THAN THE ASK.
   * *"he should keep locked at the middle of the elevator, right now he starts
   * walking to the right by himself, the player should [do] that, not the
   * animation"*. A cutscene that ends by moving the character somewhere the
   * player did not ask for is the cutscene overstaying: the arrival is over the
   * moment he has arrived. Stepping off the lift is PLAY, and play begins the
   * instant the ride hands back.
   */
  startArrive(player, stage) {
    this.reset();
    this.active = true;
    this.mode = 'arrive';
    this.step = 'climb';
    /* ⚠️ HE COMES UP FROM BELOW, NOT DOWN FROM ABOVE, AND CENTRED -- asked for
       2026-09-04 after the first build had him descending: *"quando chegando na
       proxima fase, ele vem de cima, deveria vir de baixo. e centralizado, como
       uma continuacao do movimento da cena anterior"*.
       That is the whole point of the shot: he rode UP out of the boss room, so
       he must still be going UP when the next room fades in. A descent reads as
       a second, unrelated lift ride -- and worse, as him going back down.

       ⚠️ SO `rise` STARTS NEGATIVE. It is "how far ABOVE the belt line the slab
       is drawn", so a negative value is below the floor and off the bottom of
       the frame, and the climb to 0 brings both of them up into the room. No
       other code changes sign: the draw already subtracts it and `jumpY`
       already means the same thing in both directions. */
    this.rise = -this._n('arriveDropPx', 420);
    /* ⚠️ CENTRED ON THE SCREEN, WHICH ALSO HAPPENS TO BE THE ONLY PLACE THE
       CAMERA WILL TOLERATE HIM. The follow has a dead band of `focus +/-
       deadzone` (407.6..667.6); land him outside it and the camera lurches on
       the first played frame, which in level 3 also drags the film with it.
       640 is inside it, so the shot holds exactly where the room set it. */
    const camX = (stage && stage.camX) || 0;
    this.liftX = camX + this._n('arriveScreenX', 640);
    this.markX = this.liftX;
    if (player) player.x = this.liftX;
    this._grab(player);
    player.jumpY = this.rise;      // he comes up WITH it
    /* ⚠️ AND THE SHADOW GOES OFF **HERE**, NOT ON THE FIRST TICK OF THE CLIMB.
       `drawShadow` paints at `Belt.topY + z` -- the GROUND -- whatever `jumpY`
       says, which is exactly right for a jump and exactly wrong for a rider who
       is still below the frame. And this runs at the fade's MIDPOINT, while the
       climb does not start until the fade has finished: that leaves ~450ms of
       fading-up world in which he is invisible and his shadow is already lying
       on the library floor waiting for him. Reported as *"before the player
       arrives, his shadow is already rendered"*.

       ⚠️ THE SAME SHAPE AS THE GROUND-FRAME BUG ONE FIX AGO, from the other end
       of the same fade: a rider's state has to be right at the moment the ride
       is SET UP, because the half-fade either side of that moment is painted
       and nothing is ticking. Anything the ride sets in its first `update()` is
       already too late. */
    if (player) player.noShadow = true;
  },

  /** Take the character. See the header for why the shadow goes too. */
  _grab(player) {
    if (!player) return;
    this._wasNoShadow = !!player.noShadow;
    player.facing = (this.mode === 'exit') ? 'left' : 'right';
    player.state = 'idle';
    player.stateT = 0;
  },

  /**
   * Give him back exactly as he was found.
   *
   * ⚠️ `keepY` IS NOT A TIDINESS FLAG, IT IS THE FIX FOR A VISIBLE BUG. On the
   * way OUT the ride ends with him 900px above the room and the game moves to
   * `fade` -- and a fade DRAWS THE WORLD for its first half, going black at the
   * midpoint. Dropping him to the floor here put him back on the ground, in
   * shot, for ~450ms of visible frames before the black: *"a frame of him
   * appears at the ground again, before the transition"*. So the exit leaves
   * the rider exactly where the ride left him and the reset happens at the room
   * swap instead, which is the blackest point of the fade. See `clearRider`.
   */
  _release(player, keepY) {
    if (player) {
      if (!keepY) {
        player.jumpY = 0;
        player.noShadow = this._wasNoShadow;
      }
      player.state = 'idle';
      player.stateT = 0;
    }
    this.active = false;
    this.step = 'done';
  },

  /**
   * Put the rider back on the floor. Called at the ROOM SWAP -- the one moment
   * nothing is drawn -- so that anything the exit left raised is undone where
   * it cannot be seen. Safe to call when no ride happened: it restores the
   * shadow flag to whatever was recorded, which is `false` on a fresh object.
   */
  clearRider(player) {
    if (!player) return;
    player.jumpY = 0;
    player.noShadow = this._wasNoShadow;
  },

  /** Ease that starts fast and settles, so the slab lands rather than stops. */
  _easeOut(p) { return 1 - (1 - p) * (1 - p); },

  /**
   * Drive it. Returns TRUE on the frame the ride is over and the caller may
   * move on — the same contract `stage.update()` has with game.js.
   */
  update(dt, player, stage) {
    if (!this.active) return true;
    this.t += dt;
    const ms = this.t * 1000;

    if (this.mode === 'exit') return this._exit(dt, player, stage, ms);
    return this._arrive(dt, player, stage, ms);
  },

  _exit(dt, player, stage, ms) {
    const walkSpd = this._n('walkScale', 1);

    if (this.step === 'walk') {
      /* ⚠️ HE MAY ALREADY BE PAST IT. The boss can die anywhere in the room, so
         a walk that only ever went left would stall forever with him standing
         to the left of his own mark. Whichever side he is on, he goes TO it. */
      const dir = (player.x > this.markX) ? -1 : 1;
      player.scriptWalk(dt, dir);
      const there = (dir < 0) ? (player.x <= this.markX) : (player.x >= this.markX);
      if (there) {
        player.x = this.markX;
        player.facing = 'left';
        this._to('descend', player);
      }
      return false;
    }

    if (this.step === 'descend') {
      const dur = this._n('descendMs', 1500);
      const p = Math.min(1, ms / dur);
      this.rise = this._n('dropPx', 900) * (1 - this._easeOut(p));
      player.scriptIdle(dt);
      if (p >= 1) { this.rise = 0; this._to('board', player); }
      return false;
    }

    if (this.step === 'board') {
      /* *"o player entra no elevador (anda até o meio do elevador)"* -- the
         middle of the slab IS `liftX`, because the pack is anchored on its front
         lip's CENTRE. So there is no half-width to add here, and adding one is
         the mistake this note exists to prevent. */
      player.scriptWalk(dt, -1);
      if (player.x <= this.liftX) {
        player.x = this.liftX;
        player.facing = 'right';     // he turns to face the room he is leaving
        this._to('hold', player);
      }
      return false;
    }

    if (this.step === 'hold') {
      player.scriptIdle(dt);
      if (ms >= this._n('boardHoldMs', 420)) this._to('rise', player);
      return false;
    }

    // 'rise' -- *"o elevador sobe e a tela fica parada, até ele sumir da tela"*.
    player.scriptIdle(dt);
    this.rise += this._n('risePxPerSec', 260) * dt;
    player.jumpY = this.rise;
    player.noShadow = true;
    /* ⚠️ THE TEST IS THE SLAB, NOT THE RIDER. He stands ON it, so his feet leave
       the frame first and the platform is still crossing the top of the screen
       for another half-second after he has gone -- *"ele desaparece com o
       elevador"*, the two of them together. Ending on the player would cut to
       black with the lift still visible. */
    if (this.rise > CONFIG.GAME_H + this._n('exitPadPx', 260)) {
      this._release(player, true);      // he stays up there -- see _release
      return true;
    }
    return false;
  },

  _arrive(dt, player, stage, ms) {
    if (this.step === 'climb') {
      /* ⚠️ LINEAR, AT THE EXIT'S OWN SPEED, AND THAT IS THE CONTINUATION. The
         first build eased this like the boss room's DESCENT and it was wrong
         twice over: an eased curve puts most of its travel at the start, which
         here is the part that is still below the frame, so the lift was out of
         sight for 76% of the climb and then hurried into place in the last
         350ms. Same `risePxPerSec` the exit climbs at, no curve: he was rising
         at that speed when the screen faded and he is still rising at it when
         it comes back. That is what "uma continuacao do movimento" means. */
      this.rise = Math.min(0, this.rise + this._n('risePxPerSec', 320) * dt);
      player.jumpY = this.rise;
      player.noShadow = true;
      player.scriptIdle(dt);
      if (this.rise >= 0) {
        this.rise = 0;
        player.jumpY = 0;
        player.noShadow = this._wasNoShadow;
        this._release(player);
        /* ⚠️ THE SLAB STAYS. Ending the ride used to stop drawing it, so the
           lift he was standing on BLINKED OUT under him. It is parked now:
           still painted at its world x, scrolling away with the camera like
           every other lift in the game, until the next room swap clears it. */
        this.parked = true;
        this.parkedX = this.liftX;
        return true;
      }
      return false;
    }
    return true;
  },

  _to(step, player) {
    this.step = step;
    this.t = 0;
    if (player) { player.state = 'idle'; player.stateT = 0; }
  },

  /**
   * The slab, under the fighters. Drawn from the SAME `Belt` line the room's
   * floor uses, lifted by `rise`.
   *
   * ⚠️ IT BOILS THE WHOLE TIME, unlike level 3's, and the difference is not an
   * inconsistency. Level 3 asks whether the lift is moving RELATIVE TO THE
   * VIEWER, because a parked lift there slides across a panning shot. Here the
   * camera is frozen by construction and the slab is either descending, being
   * boarded or climbing — it is never a piece of parked scenery, so there is no
   * still case to detect.
   */
  draw(ctx, stage, assets, camX) {
    if (!this.active && !this.parked) return;
    const A = Elevador.art(assets);
    if (!A) return;
    /* ⚠️ IT BOILS WHILE IT IS MOVING **RELATIVE TO THE VIEWER**, which is level
       3's rule and deliberately the same one: during the ride the slab is
       climbing, and once parked it only animates while the camera pans past it.
       A parked lift boiling on a still screen reads as a machine running with
       nobody in it; a moving one held on frame 0 reads as stuck. */
    const dCam = (this._lastCamX == null) ? 0 : camX - this._lastCamX;
    this._lastCamX = camX;
    const moving = this.active || Math.abs(dCam) > 0.05;
    /* ⚠️ OFF THE WALL CLOCK, NOT OFF A TICKED TIMER, and that is the whole
       reason it is not `_boilT`. Once the ride hands back, nothing calls
       `update()` any more -- a ticked clock would stop dead and the parked slab
       would hold one frame forever, including while the camera pans past it and
       level 3's own lifts beside it are boiling. `performance.now()` keeps
       running whether anyone is ticking this object or not. */
    const now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    const n = Elevador.frameCount(assets);
    const f = (n > 1 && moving)
      ? Math.floor(now / this._n('boilMs', 110)) % n
      : 0;
    const worldX = this.active ? this.liftX : this.parkedX;
    const y = Belt.topY + Belt.depth - (this.active ? this.rise : 0);
    const r = Elevador.rect(assets, worldX - camX + this._n('offsetX', 0),
                            y, this._n('widthPx', 960));
    if (r.cx + r.wFront < 0 || r.cx - r.wFront > CONFIG.GAME_W) return;
    Elevador.draw(ctx, assets, f, r);
  },
};
