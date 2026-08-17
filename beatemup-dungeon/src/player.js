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
  }

  update(dt, input, bounds) {
    // The order matters: resolve movement BEFORE the state machine, so a punch
    // thrown this frame comes out from where the player actually is rather than
    // from where they were a frame ago. At 300px/sec that is 5px of reach.
    if (this.canAct()) {
      const ix = (input.right ? 1 : 0) - (input.left ? 1 : 0);
      const iz = (input.down ? 1 : 0) - (input.up ? 1 : 0);
      this.walk(dt, ix, iz, bounds);

      /* ⚠️ MOVEMENT IS READ BUT THE PRESSES ARE NOT CONSUMED HERE when the
         player cannot act — they stay queued. A punch pressed during the
         recovery of the last one is the player asking for the next link in the
         combo, and dropping it because the machine was busy for 40ms is how a
         brawler comes to feel unresponsive. take*() is only called once the
         action can actually start. */
      if (input.takeAttack()) this.attack(CONFIG.COMBO);
      else if (input.takeJump()) this.jump();
    } else {
      /* ⚠️ BEING HIT DROPS THE BUFFER. Everything else that blocks acting is
         the player's own doing — their punch, their jump — and holding their
         next press through it is the courtesy above. Being knocked about is
         not: a press made while reeling is a panic press, and firing it
         automatically the instant the stun ends throws a punch the player has
         long stopped asking for, usually straight into the enemy standing over
         them. */
      if (this.state === 'hurt' || this.state === 'down') {
        input.takeAttack();
        input.takeJump();
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
}
