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
    this.lives = 3;

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

      /* MOVEMENT IS READ BUT THE PRESSES ARE NOT CONSUMED HERE when the
         player cannot act — they stay queued. A punch pressed during the
         recovery of the last one is the player asking for the next link in the
         combo, and dropping it because the machine was busy for 40ms is how a
         brawler comes to feel unresponsive. take*() is only called once the
         action can actually start. */
      if (input.takeAttack()) this.attack(this._comboDefs());
      else if (input.takeJump()) this.jump();
      /* PICK UP. Which animation comes out is the OBJECT's business, not the
         button's -- `pickup(heavy)` picks the stoop or the hoist. There are no
         liftable objects in this game yet, so nothing is ever in range and the
         default stoop always plays. When they exist, the only change here is
         finding what is in reach and asking it how heavy it is. */
      else if (input.takePickup()) this.pickup(this._liftTargetHeavy());
    } else {
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
      }
      // Still steerable in the air: a jump you cannot influence is a commitment
      // the genre does not ask for.
      if (this.jumping && !this.atk) {
        const ix = (input.right ? 1 : 0) - (input.left ? 1 : 0);
        const iz = (input.down ? 1 : 0) - (input.up ? 1 : 0);
        this.walk(dt, ix * 0.7, iz * 0.5, bounds);
      }
    }

    super.update(dt, bounds);
  }

  /**
   * Is the thing within reach a heavy one?
   *
   * THE SEAM FOR THE LIFT MECHANIC, and deliberately the whole of it. There are
   * no liftable objects in this game yet, so this is always false and the
   * ground stoop always plays. When objects land, this is where "what is in
   * range, and how heavy is it" goes -- nothing above it has to change, because
   * the button, the state and both animations are already wired.
   */
  _liftTargetHeavy() {
    return false;
  }
}
