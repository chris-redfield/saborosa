/**
 * Player — the coconut.
 *
 * Thin on top of Fighter: reads Input, walks, punches, jumps. Everything about
 * how a punch behaves lives in CONFIG.COMBO and everything about how a body
 * behaves lives in Fighter, so this file is only the translation from "what was
 * pressed" to "what was asked for".
 */
/**
 * WHICH COCONUT IS BEING PLAYED. One value, read by everything that draws the
 * hero: the Player itself, the title screen's walk-across and the ending.
 *
 * ⚠️ IT IS NOT IN CONFIG, AND THAT IS THE POINT. CONFIG is pure data, read the
 * same way by the game and by tools/build-manifest.js in Node -- a value that
 * CHANGES while the game runs does not belong in a file the packager also
 * evaluates. CONFIG.PLAYER_PACKS holds the list, which is data; this holds the
 * finger pointing at one of them, which is state.
 *
 * ⚠️ AND EVERY SCREEN ASKS IT RATHER THAN REMEMBERING THE ANSWER. Three files
 * used to say `'coconut'` in five places; a swap that updated four of them
 * would have left one screen showing the other character, which is precisely
 * the bug this game keeps re-finding under other names -- a value copied out of
 * the thing that moves.
 */
const PlayerPick = {
  /**
   * ONE PICK PER PLAYER SLOT. `picks[0]` is P1's pack index, `picks[1]` is
   * P2's. The defaults are not arbitrary: slot 0 starts on LEBRON and slot 1 on
   * IPANEIMA, so a second player who drops in mid-fight without ever seeing the
   * select screen still arrives as the character the first one is not.
   *
   * IT REPLACED A BARE `i`, AND THE ARRAY IS NOT A SECOND COPY OF IT. `i` was
   * read directly from two places outside this file (the TIME ATTACK's plane
   * art is keyed on the pick), so keeping `i` alongside `picks[0]` would have
   * been exactly the copied-value shape the header above warns about -- the one
   * screen that went on reading the stale field would show the wrong hero. The
   * field is gone; `index(slot)` is the way to ask.
   */
  picks: [0, 1],

  list() {
    const l = CONFIG.PLAYER_PACKS;
    return (l && l.length) ? l : ['coconut'];
  },

  /** The pack INDEX a slot is on, wrapped into the real list. */
  index(slot) {
    const l = this.list();
    const k = this.picks[slot || 0];
    return ((k == null ? 0 : k) % l.length + l.length) % l.length;
  },

  /** The pack key to draw a slot's hero with. Always a real one. */
  kind(slot) {
    return this.list()[this.index(slot)];
  },

  /** Next character for a slot, wrapping. Returns the new kind. */
  next(slot) {
    const s = slot || 0;
    this.picks[s] = (this.index(s) + 1) % this.list().length;
    return this.kind(s);
  },

  /**
   * Choose by index -- what the fruit select screen calls when a player
   * commits. Out-of-range is ignored rather than clamped: a select that has not
   * been answered must not silently mean "the first one", and every caller here
   * already knows whether it has a choice to spend.
   *
   * TWO PLAYERS MAY NOT HOLD THE SAME PACK, and this is where that is enforced
   * rather than on the select screen. The two heroes are the same silhouette in
   * two colourways; on screen, in a crowd, at this size, a pair of identical
   * ones is unreadable, and the alternative -- a drawn 1/2 marker over each
   * head, or a tint on one of them -- is art this game does not have. So a slot
   * taking a pack SWAPS it with whoever was holding it, which keeps both picks
   * valid without any caller having to know it happened.
   *
   * IT SWAPS RATHER THAN REFUSING on purpose. A refusal would leave the second
   * cursor sitting on a portrait it can never confirm, with nothing on screen
   * saying why.
   */
  set(i, slot) {
    const l = this.list();
    const s = slot || 0;
    if (i < 0 || i >= l.length) return this.kind(s);
    const was = this.index(s);
    for (let o = 0; o < this.picks.length; o++) {
      if (o !== s && this.index(o) === i) this.picks[o] = was;
    }
    this.picks[s] = i;
    return this.kind(s);
  },

  /** The pack index NO slot other than `slot` is holding -- what a mid-fight
      joiner arrives as. Falls back to the next one along in a one-pack build. */
  freeIndex(slot) {
    const n = this.list().length;
    for (let i = 0; i < n; i++) {
      let taken = false;
      for (let o = 0; o < this.picks.length; o++) {
        if (o !== slot && this.index(o) === i) taken = true;
      }
      if (!taken) return i;
    }
    return (this.index(0) + 1) % n;
  },
};

class Player extends Fighter {
  /**
   * A FULL SET OF LIVES -- what a run starts with, and what a CONTINUE hands
   * back.
   *
   * ⚠️ ONE PLACE THAT KNOWS, ASKED BY BOTH. They were two reads of
   * `CONFIG.playerLives` and that is the copied-value shape this codebase keeps
   * re-finding: the moment a dev override existed, one of the two would have
   * gone on handing out the shipping number and a continue would have quietly
   * been more generous than the run it continued.
   *
   * The DEV override is read here rather than at either call site because
   * `package.sh` refuses to build while dev mode is on -- so a testing value
   * cannot ship, and `playerLives` stays the tuned number every fight is
   * balanced against.
   */
  fullLives() {
    const d = CONFIG.DEV;
    if (d && d.on && d.lives != null) return d.lives;
    return CONFIG.playerLives != null ? CONFIG.playerLives : 3;
  }

  /**
   * `pickSlot` SAYS WHOSE CHARACTER TO WEAR AND NOTHING ELSE. It is the player
   * number only in the sense that PlayerPick keeps one pick per number -- it is
   * not stored, and this object does not learn its slot here.
   *
   * `Party.add` IS THE ONE WRITER OF `slot`, because the party list's INDEX is
   * the player number and a second field holding the same integer is the
   * copied-value shape this codebase keeps re-finding. Everything that needs to
   * know which player this is (the HUD's bar, the input device) reads `slot`,
   * which exists from the moment he is added.
   */
  constructor(x, z, pickSlot) {
    super(PlayerPick.kind(pickSlot || 0), x, z, { hp: CONFIG.playerHealth, facing: 'right' });
    this.lives = this.fullLives();
    /* OUT OF LIVES, WHICH IS NOT THE SAME AS DEAD -- see Party.inPlay. A dead
       hero has a body on the floor and a revive coming; an `out` hero has spent
       his last life and is waiting for a continue or for the run to end. In a
       one-player run the two are a frame apart and the distinction is
       invisible; in a two-player run it is the game-over rule. */
    this.out = false;

    /* THE TWO COMBO STRINGS, built once. Both share the first four hits -- the
       art is literally the same drawings -- and differ only in the finisher, so
       the shared hits are written once in CONFIG.COMBO and the alternate is
       swapped onto the end. Defining the string twice in config would work
       until someone retuned hit three and changed it in one copy. */
    this.comboStrings = [
      CONFIG.COMBO,
      CONFIG.COMBO_ALT_FINISH
        ? CONFIG.COMBO.slice(0, -1).concat([CONFIG.COMBO_ALT_FINISH])
        : CONFIG.COMBO,
    ];
    this.comboVariant = 1;   // flipped before the first chain, so chain 1 is 0

    /* THE AIR ATTACK, as a one-entry string so it goes through the same
       `Fighter.attack()` as everything else -- index 0 of a length-1 array is
       also the LAST entry, so `atk.last` comes out true and it gets the
       finisher's sound without a special case. Built once here for the same
       reason the combo strings are. Null with no def, and then a jump-punch
       falls back to the ground combo exactly as it did before. */
    this.airString = CONFIG.AIR_ATTACK ? [CONFIG.AIR_ATTACK] : null;
    /* THE SPECIAL'S COOLDOWN, in seconds, counted down in update(). It is the
       move's only cost -- see CONFIG.SPECIAL. */
    this.specialT = 0;
    /* The three-blow string in flight, and how far through it he is. Null when
       no special is running -- see _specialStep(). */
    this.specialSeq = null;
    this.specialI = 0;

    /* THE LAST DIRECTION ASKED FOR, kept so a jump does not lose its momentum
       the instant it throws a punch. There is no horizontal velocity in a jump
       -- `vx`/`vz` are knockback and nothing else -- so every bit of airborne
       motion comes from calling `walk()` once a frame. See `update`. */
    this.airIx = 0;
    this.airIz = 0;
    /* What the current reach is FOR, held across the reach's own duration --
       see update(). Null except during a pickup. */
    this.liftTarget = null;
    /* The same, for FOOD, and a separate reference on purpose: they are reached
       for with different buttons, they end differently (one arrives in his
       hands, the other is simply gone), and one field holding either would need
       a type test at every use. */
    this.eatTarget = null;
    /* Has the barrel left his hands yet this throw? The animation outlasts the
       release, so "still throwing" is not "still holding". */
    this.threw = false;
    /* The room's props, handed in by the shell so the player can find what is
       within reach. Null is a legal state and means a room with nothing in it. */
    this.props = null;
    /* Where the walk-on ends. Only meaningful while `state === 'enter'`; see
       enterWalk(). */
    this.enterToX = 0;
  }

  /**
   * Which string this press belongs to. THE PLAYER NEVER CHOOSES -- one button,
   * and the two combos intercalate on their own: uppercut, low punch, uppercut.
   *
   * IT FLIPS ONLY WHEN A CHAIN BEGINS, and that is the whole trick. Mid-chain
   * the cancel window is still open, so the same string is returned for every
   * press of it and the finisher cannot change out from under a combo already
   * in progress. The moment the window lapses -- the string finished, or was
   * dropped, or was interrupted -- the next press starts a fresh chain and gets
   * the other ending.
   *
   * A BROKEN CHAIN STILL ALTERNATES. Getting hit out of a string means the next
   * one is the other ending rather than a retry of the same one, which is what
   * keeps it from settling back into one drawing whenever a fight goes badly.
   */
  _comboDefs() {
    if (this.comboWindow <= 0) {
      this.comboVariant = (this.comboVariant + 1) % this.comboStrings.length;
    }
    return this.comboStrings[this.comboVariant];
  }

  /**
   * PUNCH + LIFT: the hero's own move. One per pack, off row 14 of its sheet.
   *
   * Returns true if it came out, so the caller can tell the press apart from
   * the cooldown eating it -- nothing reads that yet, and a move that silently
   * does nothing is the thing to be able to see.
   *
   * ⚠️ IT GOES THROUGH `attack()` LIKE EVERY OTHER BLOW, with a one-entry
   * string. That is what buys it the hitstop, the knockback, the hit spark,
   * the debug box and the enemy's reaction for free -- a special with its own
   * strike path would be a second copy of all of it, and the first thing to
   * fall out of step. The def's `sweep`/`radial` do the rest.
   *
   * ⚠️ NOT IN THE AIR. `attack()` would happily start it and the row is drawn
   * with both feet planted -- the flurry and the spin are ground moves. The
   * air already has its own attack.
   */
  _special() {
    const S = CONFIG.SPECIAL;
    if (!S || S.on === false) return false;
    const seq = S[this.kind];
    if (!seq || !seq.length || this.specialT > 0 || this.jumping) return false;
    if (!this.attack([seq[0]])) return false;    // busy, hurt, down -- canAct()
    this.specialSeq = seq;
    this.specialI = 0;
    this.specialT = (S.cooldownMs || 0) / 1000;
    return true;
  }

  /**
   * DRIVE THE THREE BLOWS -- called once a frame, after the fighter has ticked.
   *
   * ⚠️ IT RUNS AFTER `super.update()` AND THAT IS WHY THERE IS NO FLICKER. The
   * base tick is what ends a blow: it clears `atk` and drops the state to
   * 'idle'. Chained on the NEXT frame instead, the render in between would draw
   * one frame of him standing still in the middle of his own special -- 16ms of
   * idle pose, three times a move.
   *
   * ⚠️ ANYTHING THAT IS NOT "FINISHED A BLOW" ENDS THE CHAIN. Hurt, knocked
   * down, dead, grabbed by a cutscene: `canAct()` covers all of them, and a
   * special that carried on through a knockdown would be a player throwing
   * punches off the floor. The cooldown is NOT refunded -- being interrupted
   * out of a special costs it, which is the same bargain every combo makes.
   */
  _specialStep() {
    if (!this.specialSeq) return;
    if (this.atk) return;                        // the current blow is running
    if (this.specialI + 1 >= this.specialSeq.length || !this.canAct()) {
      this.specialSeq = null;
      return;
    }
    this.specialI++;
    if (!this.attack([this.specialSeq[this.specialI]])) this.specialSeq = null;
  }

  update(dt, input, bounds, sheets) {
    if (this.specialT > 0) this.specialT = Math.max(0, this.specialT - dt);
    // The order matters: resolve movement BEFORE the state machine, so a punch
    // thrown this frame comes out from where the player actually is rather than
    // from where they were a frame ago. At 300px/sec that is 5px of reach.
    if (this.canAct()) {
      const ix = (input.right ? 1 : 0) - (input.left ? 1 : 0);
      const iz = (input.down ? 1 : 0) - (input.up ? 1 : 0);
      /* ⚠️ THE ONLY PLACE `walkScale` IS SPENT, and that is what "only the
         walk" means: a jump still carries him as far, a lunge still steps as
         far, and nothing he throws travels differently. Slowing him anywhere
         more central -- walkSpeedX, or a scale inside walk() -- would have
         reached all of those through the one field. */
      this.walk(dt, ix, iz, bounds, this.feel().walkScale || 1);

      /* LATCHED EVERY FRAME HE CAN ACT, which is the only place it can be. On
         the ground this is just bookkeeping; on the frame a jump or an air
         punch starts it is the direction he was travelling, and the airborne
         branch below flies it out for him. It is read AFTER `walk` and BEFORE
         the buttons on purpose -- a punch pressed this frame inherits the
         direction of this frame. */
      this.airIx = ix;
      this.airIz = iz;

      /* MOVEMENT IS READ BUT THE PRESSES ARE NOT CONSUMED HERE when the
         player cannot act — they stay queued. A punch pressed during the
         recovery of the last one is the player asking for the next link in the
         combo, and dropping it because the machine was busy for 40ms is how a
         brawler comes to feel unresponsive. take*() is only called once the
         action can actually start. */
      /* ⚠️ THE SPECIAL IS ASKED FIRST, AND IT HAS TO BE. It is punch AND lift,
         so every branch below it can consume half of it -- `takeSpecial()`
         eats both presses or neither, and asking it after `takeAttack()` would
         mean the punch had already been spent and the move could never come
         out. See Input.takeSpecial() for why it is not a time window.

         ⚠️ IT REFUSES WITH A BARREL UP. Punch-while-carrying is the throw and
         lift-while-carrying is the put-down; a special there would be a third
         meaning for two buttons the player is already using for something
         else, and it would have to decide what happens to the barrel. */
      if (!this.carrying && input.takeSpecial()) this._special();
      /* ⚠️ WITH A BARREL UP, THE PUNCH BUTTON THROWS IT. One button, and which
         verb it is depends on what is in his hands -- the same arrangement the
         pickup button already has (stoop or hoist, chosen by the object). A
         separate throw button would be a fourth thing to teach for a move that
         can only ever mean one thing while you are holding something. */
      else if (this.carrying && input.takeAttack()) {
        this.throwHeld((CONFIG.PICKUP_MS && CONFIG.PICKUP_MS.throw) || 420);
        this.threw = false;
      }
      /* PUNCHING IN THE AIR IS A DIFFERENT MOVE, not the next link of the
         ground string thrown while airborne -- which is what it used to be.
         It sweeps and it launches; see CONFIG.AIR_ATTACK.

         ⚠️ `_comboDefs()` IS NOT CALLED ON THIS BRANCH, AND THAT MATTERS.
         That method has a side effect: it flips which finisher the next chain
         ends on, whenever the cancel window has lapsed. Calling it here would
         let a jump-punch quietly consume the alternation, so a player who
         jumped between chains would get the same ending twice. The air attack
         still BREAKS the chain -- `attack()` clears the combo window, as any
         attack does -- so the next ground press starts fresh and alternates,
         which is the same courtesy a chain broken by a hit already gets. */
      else if (input.takeAttack()) {
        /* ⚠️ STANDING OVER FOOD, THE PUNCH BUTTON STOOPS FOR IT. Requested
           2026-08-24, replacing eat-on-contact: food is now taken deliberately,
           with the pickup animation, rather than swept up by walking past.

           IT IS THIS BUTTON AND NOT THE PICKUP ONE for the reason the pickup
           one gives about barrels: two things on one button means the player
           who wanted the barrel gets the chicken lying next to it. The punch
           button already chooses a verb by what is in his hands (throw when
           carrying), so it is the one that already works this way.

           ⚠️ THIS BRANCH WINS WHENEVER FOOD IS IN REACH, full bar or not. The
           button is predictable in exchange for the odd wasted drumstick --
           see Props.eatTarget().

           ⚠️ `pickup()` IS ASKED, NOT TOLD. It refuses in mid-air, so a player
           who jumps over a drumstick and presses punch gets the AIR ATTACK
           rather than a stoop he cannot perform -- the fall-through below is
           the whole handling of that case, and there is no `jumping` test here
           to keep in step with the one inside `pickup()`.

           ⚠️ AND `_comboDefs()` IS NOT REACHED ON THIS PATH, which matters: it
           flips which finisher the next chain ends on. Stooping for a chicken
           must not quietly consume the alternation. */
        const food = this.props ? this.props.eatTarget(this) : null;
        if (food && this.pickup(false)) {
          this.eatTarget = food;
          /* THE FOOD GETS THE REACH'S OWN CLOCK, the same one the animation
             runs on, so the heal lands when he actually reaches it. Same
             bargain the barrel makes in the pickup branch below. */
          food.claim(this, this.pickupMs);
        } else {
          this.attack(this.jumping && this.airString ? this.airString
                                                     : this._comboDefs());
        }
      }
      else if (input.takeJump()) this.jump();
      /* PICK UP -- or PUT DOWN, if his hands are already full.
         Which animation comes out is the OBJECT's business, not the button's:
         `pickup(heavy)` picks the stoop or the hoist. This used to carry a note
         saying there were no liftable objects in the game yet and that when
         they arrived the only change here would be "finding what is in reach
         and asking it how heavy it is". Barrels arrived on 2026-08-22 and that
         turned out to be exactly true.

         ⚠️ THE DROP BRANCH IS NOT A CONVENIENCE, IT IS A BUG FIX. Without it,
         pressing pickup while already holding a barrel starts a second reach
         and `carrying` is overwritten -- and the FIRST barrel is orphaned: it is
         still `held`, still following the player, drawn over his head forever,
         and nothing can ever release it. Two verbs on one button is also the
         right feel here: punch throws it, pickup puts it down. */
      /* ⚠️ AND THE WHOLE BRANCH IS OFF. `CONFIG.pickupButton` is false since
         2026-08-24 -- the button does nothing and barrels cannot be lifted; see
         the note there for what that costs and what it does not. The press is
         READ FIRST and then discarded by the `&&`, which is what keeps it from
         queueing up and firing later if the flag is ever turned back on. */
      else if (input.takePickup() && CONFIG.pickupButton) {
        if (this.carrying) {
          this.carrying.drop(this);
          this.carrying = null;
        } else {
          /* ⚠️ THE TARGET IS FOUND AND REMEMBERED BEFORE THE REACH STARTS, not
             when it ends. `pickup()` already makes the same argument about the
             POSE: an object destroyed or snatched during the reach would
             otherwise change the animation halfway through it, and here it
             would also mean reaching for a barrel and standing up holding a
             different one. What is caught is what was reached for. */
          this.liftTarget = this.props ? this.props.liftTarget(this) : null;
          this.pickup(!!this.liftTarget);
          /* ⚠️ THE BARREL STARTS MOVING NOW, not when the reach ends. It rides
             the arms up an arc over `pickupMs` -- the same clock the animation
             runs on, passed in so the two cannot drift. Started at the END it
             teleported from the floor to above his head on a single frame. */
          if (this.liftTarget) this.liftTarget.lift(this, this.pickupMs);
        }
      }
      /* LETTING GO OF THE REACH. ⚠️ THIS NO LONGER CATCHES THE BARREL -- the
         barrel puts itself in his hands on the frame it arrives (see
         `Prop._liftArc`), because polled from here it was ONE FRAME LATE and
         that frame was drawn with his arms down under a barrel already
         overhead. `player.update` runs before `props.update`, so the hoist can
         never have finished by the time this looks.

         What is left is the REFERENCE, and the three ways a hoist can fail --
         all of which end with him empty-handed rather than holding a ghost: the
         barrel was smashed by a stray punch mid-hoist (`smash`), the hoist was
         aborted because he was hit (`idle` again), or it is simply still on its
         way (`lifting` -- keep waiting). Anything that is no longer `lifting`
         has finished with him one way or the other. */
      if (this.liftTarget && this.liftTarget.state !== 'lifting') {
        this.liftTarget = null;
      }
      /* THE SAME QUESTION FOR FOOD, and it is only a reference to drop: the
         food heals him itself when the stoop completes, and puts itself back on
         the floor if he was knocked out of it. Either way it stops being
         `taking` and there is nothing here to decide -- which is the point.
         Reached on the first frame he can act again, exactly like the catch
         above. */
      if (this.eatTarget && this.eatTarget.state !== 'taking') this.eatTarget = null;
    } else {
      /* THE RELEASE, partway through the throw animation. Outside `canAct()`
         because `throwing` is exactly one of the states that blocks it -- this
         is the game finishing an action the player already committed to, not
         the player asking for a new one. */
      if (this.state === 'throwing' && this.carrying && !this.threw) {
        const rel = (CONFIG.PICKUP_MS && CONFIG.PICKUP_MS.throwReleaseRel);
        if (this.stateT >= (this.throwMs / 1000) * (rel == null ? 0.5 : rel)) {
          this.carrying.throwFrom(this);
          this.carrying = null;
          this.threw = true;
        }
      }
      /* BEING HIT DROPS THE BUFFER. Everything else that blocks acting is
         the player's own doing — their punch, their jump — and holding their
         next press through it is the courtesy above. Being knocked about is
         not: a press made while reeling is a panic press, and firing it
         automatically the instant the stun ends throws a punch the player has
         long stopped asking for, usually straight into the enemy standing over
         them. */
      if (this.state === 'hurt' || this.state === 'down') {
        input.takeAttack();
        input.takeJump();
        input.takePickup();
        /* ⚠️ AND HE DROPS THE BARREL. Being hit while carrying one has to cost
           it, or the barrel is a free extra life bar's worth of pressure the
           player can hold indefinitely while walking through a fight. It lands
           where he was standing, intact, and can be picked back up -- taking a
           hit should cost the position, not the object. */
        if (this.carrying) {
          this.carrying.drop(this);
          this.carrying = null;
        }
        /* ⚠️ AND THE ONE HE IS STILL LIFTING. It used to be guaranteed NOT to
           be the same object, and that was the one-frame race this exists for:
           a barrel that arrived this very frame was `held` while `carrying` was
           still null, so clearing the reference without letting go of it
           stranded the barrel on him forever.

           ⚠️ SINCE 2026-08-24 IT CAN BE THE SAME OBJECT, because the barrel now
           sets `carrying` on the frame it arrives -- the race is gone by
           construction rather than by being caught here. Both calls are still
           made and the order is still `drop` then `letGo`, which is safe on one
           object: `drop` puts it on the floor as `idle`, and `letGo` returns
           immediately for anything that is neither `held` nor `lifting`. */
        if (this.liftTarget) {
          this.liftTarget.letGo(this);
          this.liftTarget = null;
        }
      }
      /* AIR PUNCHES KEEP FLYING. This is the ONLY branch an airborne fighter
         can reach with his hands busy: `canAct` does not test `jumping`, so a
         jump with the hands free is steered by the block above at full walking
         speed and never gets here at all. Throwing a punch is what drops him
         down here -- and until this existed, nothing moved him, so he stopped
         dead in x and z the moment he swung and fell straight down out of his
         own arc.

         THE DIRECTION IS THE LATCHED ONE, NOT THE HELD ONE. Input is not read
         here, so the swing is committed: he flies out the line he was on when
         he threw it and cannot turn on a dime mid-punch. That is the enemies'
         jump-in rule and deliberately the same one -- they latch `leapIx` on
         the tell and keep walking through their own `atk` (Enemy `_step`, the
         `ai === 'leap'` branch, the one state that moves mid-attack). */
      if (this.jumping) this.walk(dt, this.airIx, this.airIz, bounds);

      /* WALKING ON AT THE START OF A RUN. `state === 'enter'` already means
         "not in the player's hands": `canAct()` and `vulnerable()` both test
         for it, so this branch is the only thing moving him and nothing can
         hit him on the way in.

         ⚠️ NO BOUNDS, and it is the same reason the enemies' walk-in passes
         none: he starts OUTSIDE the left gate, and clamping him to it would
         teleport him to the wall on his first frame -- the materialising-in-
         front-of-you problem the walk-on exists to avoid, with an extra step.
         He becomes subject to the walls the moment he arrives. */
      if (this.state === 'enter') {
        this.walk(dt, 1, 0, null);
        if (this.x >= this.enterToX) {
          this.x = this.enterToX;
          this.state = 'idle';
          this.stateT = 0;
        }
      }
    }

    super.update(dt, bounds);
    this._specialStep();
    this._tickLongIdle(dt, sheets);
  }

  /**
   * THE SPECIAL IDLE -- the drawing he does when the player has left him alone
   * (2026-09-17). *"These ones are like SPECIAL idle, that run if the player
   * doesn't move the character for like 7 seconds."* The row is `idleLong`, cut
   * into each hero's own atlas by tools/build-beat-coconut-defs.py; the knobs
   * are `CONFIG.IDLE_LONG` and the drawing is `Fighter.pose`/`frameStep`.
   *
   * ⚠️ "HAS NOT MOVED" IS READ OFF THE SETTLED STATE, NOT OFF THE INPUT, and
   * that is what makes it total. `walk()` promotes `idle` to `walk` on the
   * BUTTON rather than on the movement -- so a player leaning into a wall, who
   * is not moving one pixel, still reads as walking and is correctly not
   * bored. Everything else that matters (a punch, a jump, a hit, a barrel, the
   * walk-on at the start of a room) already has a state or a flag of its own,
   * and asking the input instead would be a second list of them to maintain.
   *
   * ⚠️ IT IS CALLED AFTER `super.update`, so the state it reads is this frame's
   * -- a punch that ended this frame has already put him back in `idle` and the
   * seven seconds start now rather than one frame late.
   *
   * ⚠️ AND THE LENGTH OF THE FLOURISH COMES FROM THE CUT, which is why this
   * takes `sheets`. Writing the frame count in CONFIG would be the one number
   * that has to be edited every time the row is re-drawn, and the cutter would
   * not know it had gone stale.
   */
  _tickLongIdle(dt, sheets) {
    const C = CONFIG.IDLE_LONG || {};
    /* `art()`, not `kind`: the length and the existence of this row are facts
       about the PICTURE, and `frameStep` asks the same way. A hero in a skin
       whose row is a different length would otherwise have the drawer and this
       end-test disagreeing -- the exact split idleLongOrder() exists to close.
       No hero has a skin today; this is the rule, not a fix. */
    const has = !!(sheets && sheets.has(this.art(), 'idleLong'));
    const still = C.on !== false && has && !this.dead && !this.atk
               && !this.carrying && !this.jumping && this.jumpY <= 0
               && this.state === 'idle';
    if (!still) {
      /* ⚠️ BOTH CLOCKS, AND THE FLAG. Anything he does cancels the flourish
         outright rather than pausing it: it is a thing he does because nothing
         is happening, so the moment something is, it is over. */
      this.idleT = 0;
      this.longIdle = false;
      this.longIdleT = 0;
      return;
    }
    if (this.longIdle) {
      this.longIdleT += dt;
      if (C.loop) return;
      /* ⚠️ THE PLAY LENGTH, NOT THE CUT LENGTH. The flourish ping-pongs and
         holds, so 7 cut drawings are 10 slots on screen -- ending here at the
         cut count would take him away mid-descent. Same function the drawer
         uses; see idleLongOrder() in fighter.js. */
      const n = idleLongOrder(sheets.poseLength(this.art(), 'idleLong')).length;
      if (this.longIdleT >= n * (Math.max(1, C.frameMs || 130) / 1000)) {
        /* Back to breathing, and the wait starts again -- so he does it about
           every `afterS` + the length of the row, for as long as he is left. */
        this.longIdle = false;
        this.longIdleT = 0;
        this.idleT = 0;
      }
      return;
    }
    this.idleT += dt;
    if (this.idleT >= (C.afterS != null ? C.afterS : 7)) {
      this.longIdle = true;
      this.longIdleT = 0;
      this.idleT = 0;
    }
  }

  /**
   * Walk out of frame, under the game's control rather than the player's.
   *
   * The level is over: the last enemy is down and the coconut leaves the way it
   * came in, to the right. INPUT IS NOT READ AT ALL here — this is not "the
   * player happens to be walking right", it is the game taking the character
   * back, and a stray key should not be able to stop or steer it.
   *
   * `iz` IS ZERO ON PURPOSE. Depth is left exactly where the last fight ended,
   * so the exit is a straight line across the belt rather than a drift toward
   * some tidier lane. The walk animation, the facing and the depth scale all
   * follow from `walk` as they always do.
   */
  /**
   * Start the run by walking ON from the left, instead of being there already.
   *
   * ⚠️ IT IS MEASURED FROM WHERE HE WOULD HAVE STOOD, not to a fixed mark. The
   * caller has already placed him -- at the room's `startX`, or wherever a DEV
   * room jump put him -- so this reads that as the destination and backs him
   * off it. A hardcoded target would be wrong in every room but the first.
   */
  enterWalk(px) {
    if (!(px > 0)) return;
    this.enterToX = this.x;
    this.x -= px;
    this.facing = 'right';
    this.state = 'enter';
    this.stateT = 0;
  }

  walkOut(dt) {
    this.walk(dt, 1, 0, null, 1);
    super.update(dt, null);
  }

  /**
   * Walk in a given direction under the game's control. `walkOut` generalised,
   * for the lift cutscenes (src/lift-ride.js).
   *
   * ⚠️ IT DOES NOT REPLACE `walkOut`, WHICH IS NOT THE SAME THING WEARING A
   * PARAMETER. That one is the level's last beat and always goes right, out of
   * the frame, past every wall; this one walks him to a MARK inside the room and
   * stops. Folding them together would mean one of the two callers passing
   * arguments that mean nothing to it.
   *
   * ⚠️ NO BOUNDS, LIKE `walkOut` AND FOR THE SAME REASON. The mark the caller is
   * walking him to is its own limit, and clamping to the room's walls mid-
   * cutscene would fight it — a lift that stands where a wall is (which is
   * exactly where the boss room's does) could never be reached.
   *
   * `iz` IS ZERO ON PURPOSE: depth stays where the fight left it, so the walk is
   * a straight line across the belt rather than a drift into a tidier lane.
   */
  scriptWalk(dt, ix) {
    this.walk(dt, ix, 0, null, 1);
    super.update(dt, null);
  }

  /**
   * Stand still under the game's control — the animation ticks, nothing moves.
   *
   * ⚠️ THE ANIMATION HAS TO KEEP TICKING, which is the whole reason this is not
   * simply "do nothing". A frozen fighter holds frame one, and the beats where
   * he waits for the lift are the ones where he is the only thing on screen.
   */
  scriptIdle(dt) {
    if (this.state === 'walk') { this.state = 'idle'; this.stateT = 0; }
    super.update(dt, null);
  }
}
