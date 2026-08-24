/**
 * Player — the coconut.
 *
 * Thin on top of Fighter: reads Input, walks, punches, jumps. Everything about
 * how a punch behaves lives in CONFIG.COMBO and everything about how a body
 * behaves lives in Fighter, so this file is only the translation from "what was
 * pressed" to "what was asked for".
 */
class Player extends Fighter {
  constructor(x, z) {
    super('coconut', x, z, { hp: CONFIG.playerHealth, facing: 'right' });
    this.lives = CONFIG.playerLives != null ? CONFIG.playerLives : 3;

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

  update(dt, input, bounds) {
    // The order matters: resolve movement BEFORE the state machine, so a punch
    // thrown this frame comes out from where the player actually is rather than
    // from where they were a frame ago. At 300px/sec that is 5px of reach.
    if (this.canAct()) {
      const ix = (input.right ? 1 : 0) - (input.left ? 1 : 0);
      const iz = (input.down ? 1 : 0) - (input.up ? 1 : 0);
      this.walk(dt, ix, iz, bounds);

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
      /* ⚠️ WITH A BARREL UP, THE PUNCH BUTTON THROWS IT. One button, and which
         verb it is depends on what is in his hands -- the same arrangement the
         pickup button already has (stoop or hoist, chosen by the object). A
         separate throw button would be a fourth thing to teach for a move that
         can only ever mean one thing while you are holding something. */
      if (this.carrying && input.takeAttack()) {
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
      /* THE CATCH, AND IT ASKS THE BARREL RATHER THAN THE CLOCK. The barrel is
         travelling up its own arc; his hands close when it ARRIVES (`held`),
         which is the same moment either way but says so in terms of the thing
         being caught.

         IT CAN FAIL, three ways, and all three end with him empty-handed rather
         than holding a ghost: the barrel was smashed by a stray punch mid-hoist
         (`smash`), the hoist was aborted because he was hit (`idle` again), or
         it is simply still on its way (neither -- keep waiting). */
      if (this.liftTarget) {
        const st = this.liftTarget.state;
        if (st === 'held') { this.carrying = this.liftTarget; this.liftTarget = null; }
        else if (st !== 'lifting') { this.liftTarget = null; }
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
        /* ⚠️ AND THE ONE HE IS STILL LIFTING, which is NOT the same object and
           is the one-frame race `letGo` exists for -- a barrel that arrived in
           his hands this very frame is `held` while `carrying` is still null,
           and clearing the reference without letting go of it strands the
           barrel on him forever. */
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
}
