/**
 * Enemy — TOM, JUIXY and ERKPA, doing the villain's job.
 *
 * ⚠️ READ THE ATTACK TOKEN NOTE BEFORE CHANGING ANY OF THIS. It is in
 * `Crowd.update()` below and it is the single most important rule in the file:
 * however many enemies are on screen, only `CONFIG.maxAttackers` of them may be
 * committing to an attack at any moment. The rest close in, hover at a
 * stand-off distance, and circle. Without it, six enemies that each attack when
 * in range all attack on the same frame, the player is hit from three sides at
 * once, and the game is not difficult — it is arbitrary. Every beat 'em up
 * worth the name does this and almost none of them mention it.
 *
 * An enemy's own states are a thin layer over Fighter's:
 *
 *     enter      walking in from off-screen at spawn
 *     approach   closing on the player's stand-off spot
 *     circle     in range but WITHOUT the token: orbiting, waiting a turn
 *     wind       has the token, hesitating before the swing (the tell)
 *     attack     Fighter's own attack state does the work
 */
class Enemy extends Fighter {
  constructor(kind, x, z, opts) {
    const o = opts || {};
    super(kind, x, z, {
      hp: (CONFIG.enemyHealth && CONFIG.enemyHealth[kind]) || 40,
      facing: 'left',
    });
    this.ai = 'enter';
    this.aiT = 0;
    this.hasToken = false;
    this.windT = 0;
    this.enterT = (o.delayMs || 0) / 1000;
    // Where the walk-in heads for. Null = fight from where it was placed.
    this.entryX = o.entryX != null ? o.entryX : null;
    this.speedScale = (CONFIG.enemySpeedScale && CONFIG.enemySpeedScale[kind]) || 0.8;
    this.damage = (CONFIG.enemyDamage && CONFIG.enemyDamage[kind]) || 6;
    // Where on the circle this one sits. Seeded from the spawn position rather
    // than randomly so a restarted arena plays the same way — a fight that
    // reshuffles itself on every attempt cannot be learned.
    this.orbit = ((x * 0.017 + z * 0.031) % (Math.PI * 2));
    this.showBarT = 0;
    // The attack this enemy throws. One entry rather than a combo: an enemy
    // with a combo is a boss, and this is a mook.
    this.swing = {
      pose: 'straight',
      startupMs: CONFIG.enemyStartupMs,
      activeMs: CONFIG.enemyActiveMs,
      recoverMs: CONFIG.enemyRecoverMs,
      cancelMs: 0,
      damage: this.damage,
      reachX: CONFIG.enemyReachX,
      reachZ: CONFIG.enemyReachZ,
      knockback: 150,
      lift: 0,
    };
  }

  hurt(dmg, dir, knockback, lift, knockdown) {
    const took = super.hurt(dmg, dir, knockback, lift, knockdown);
    if (took) {
      this.showBarT = CONFIG.enemyBarFadeMs / 1000;
      // Losing the token on being hit is what stops an enemy tanking a combo
      // and swinging anyway — and it hands the turn to somebody else, so a
      // crowd keeps pressing while the player is busy with one of them.
      this.hasToken = false;
      this.ai = 'approach';
      this.aiT = 0;
    }
    return took;
  }

  update(dt, player, bounds) {
    if (this.showBarT > 0) this.showBarT -= dt;
    this.aiT += dt;

    if (!this.dead && this.state !== 'hurt' && this.state !== 'down') {
      this._think(dt, player, bounds);
    }
    super.update(dt, bounds);
  }

  _think(dt, player, bounds) {
    if (this.ai === 'enter') {
      /* The stagger first: `delayMs` holds this one off the screen entirely
         while the ones before it walk on, so a group arrives as a trickle
         rather than as a wall. Then it walks to its entry mark.

         ⚠️ It walks in with NO bounds passed, deliberately: it starts outside
         the arena walls, and clamping it to them would teleport it to the wall
         on its first frame — which is the materialising-in-front-of-the-player
         problem the walk-in exists to avoid, with an extra step. It becomes
         subject to the walls the moment it starts fighting. */
      this.enterT -= dt;
      if (this.enterT > 0) return;
      const target = this.entryX;
      if (target == null || Math.abs(this.x - target) < 12) {
        this.ai = 'approach';
        this.aiT = 0;
        this._face(player);
        return;
      }
      this.walk(dt, target > this.x ? 1 : -1, 0, null, this.speedScale);
      return;
    }

    if (this.atk) return;      // mid-swing; Fighter is driving

    const dx = player.x - this.x;
    const dz = player.z - this.z;

    /* The stand-off. Enemies that walk to the player's exact position end up
       standing INSIDE them, and two fighters in one pixel is a shoving match
       rather than a fight. So the target is a spot beside the player, on
       whichever side this enemy is already on — approaching from behind by
       walking through them would be worse than not approaching at all. */
    const side = dx >= 0 ? -1 : 1;         // stand on the near side
    const wantX = player.x + side * CONFIG.enemyStandoffX;
    const wantZ = player.z;

    const atX = Math.abs(this.x - wantX) < 14;
    const atZ = Math.abs(dz) < CONFIG.enemyStandoffZ;

    if (this.ai === 'wind') {
      this.windT -= dt;
      this._face(player);
      if (this.windT <= 0) {
        // Swing. If the player has moved out of reach in the meantime it will
        // simply miss, which is correct — the wind-up is the tell, and a tell
        // you can walk out of is the whole point of having one.
        this.attack([this.swing]);
        this.ai = 'approach';
        this.aiT = 0;
        this.hasToken = false;
      }
      return;
    }

    if (this.hasToken && atX && atZ) {
      this.ai = 'wind';
      const lo = CONFIG.enemyWindupMinMs, hi = CONFIG.enemyWindupMaxMs;
      this.windT = (lo + Math.random() * (hi - lo)) / 1000;
      this._face(player);
      return;
    }

    if (this.hasToken) {
      // Close in.
      const ix = Math.abs(this.x - wantX) < 6 ? 0 : (wantX > this.x ? 1 : -1);
      const iz = Math.abs(dz) < 8 ? 0 : (wantZ > this.z ? 1 : -1);
      this.walk(dt, ix, iz, bounds, this.speedScale);
      this.ai = 'approach';
    } else {
      /* No token: ORBIT. Hanging back at a radius, drifting round the player,
         is what makes a crowd read as alive rather than as a queue. It also
         keeps the un-committed enemies visibly present and threatening, which
         is the pressure the token system would otherwise remove. */
      this.orbit += CONFIG.enemyCircleSpeed * dt * (this.z > player.z ? 1 : -1);
      const r = CONFIG.enemyCircleRadius;
      const tx = player.x + Math.cos(this.orbit) * r;
      const tz = player.z + Math.sin(this.orbit) * r * 0.35;
      const ix = Math.abs(tx - this.x) < 10 ? 0 : (tx > this.x ? 1 : -1);
      const iz = Math.abs(tz - this.z) < 10 ? 0 : (tz > this.z ? 1 : -1);
      this.walk(dt, ix, iz, bounds, this.speedScale * 0.8);
      this.ai = 'circle';
      // Keep looking at the player even while sidling — an enemy that faces the
      // way it is walking reads as having lost interest.
      this._face(player);
    }
  }

  _face(player) {
    const dx = player.x - this.x;
    const dz = player.z - this.z;
    this.facing = facingFor(dx, Math.abs(dz) > 40 ? dz : 0, this.facing);
  }
}

/**
 * Crowd — owns the enemies of the current fight and hands out the attack token.
 *
 * Kept separate from the enemies themselves because the token is a property of
 * the GROUP, not of any member: no enemy can decide on its own whether it is
 * allowed to attack without knowing what the others are doing, and giving each
 * one a reference to all the others is the same thing with more places to get
 * it wrong.
 */
class Crowd {
  constructor() { this.list = []; }

  add(e) { this.list.push(e); }
  clear() { this.list.length = 0; }

  /** Everyone still standing. A dead one lies where it fell and is skipped. */
  alive() { return this.list.filter(e => !e.dead); }
  cleared() { return this.alive().length === 0; }

  update(dt, player, bounds) {
    /* ===== THE ATTACK TOKEN =====================================================
       Count who is currently committed — winding up or mid-swing. If that is
       under the cap, hand the token to the CLOSEST eligible enemy that does not
       already have one.

       Closest, rather than longest-waiting, on purpose: the enemy in the
       player's face is the one the player is watching, so it is the one whose
       attack they have a chance of reading. Awarding it by patience instead
       would routinely have someone swing from behind while the player is
       occupied with the one in front, which is the exact unfairness the token
       exists to prevent.

       Enemies still walking in, stunned, knocked down or dead are not eligible
       and cannot hold it — which is also what releases the token when the
       player hits whoever had it, so the turn passes immediately rather than
       stalling the crowd for the length of a stun. */
    /* ⚠️ THE COUNT IS OF TOKEN HOLDERS, NOT OF SWINGING ENEMIES. A token is a
       RESERVATION taken at the moment an enemy starts closing in, and it is
       held all the way through the approach, the wind-up and the swing. Counting
       only the ones visibly attacking would hand fresh tokens to everybody still
       walking — and then they would all arrive together and all swing at once,
       which is precisely the pile-on this exists to prevent, only delayed by the
       length of a walk. */
    let committed = 0;
    for (const e of this.list) {
      if (e.dead) { e.hasToken = false; continue; }
      const busy = e.ai === 'wind' || !!e.atk;
      if (!busy && (e.state === 'hurt' || e.state === 'down' || e.ai === 'enter')) {
        e.hasToken = false;
      }
      if (e.hasToken || busy) committed++;
    }

    if (committed < CONFIG.maxAttackers) {
      let best = null, bestD = Infinity;
      for (const e of this.list) {
        if (e.dead || e.hasToken || e.ai === 'enter') continue;
        if (e.state === 'hurt' || e.state === 'down' || e.atk) continue;
        const d = Math.hypot(e.x - player.x, (e.z - player.z) * 2);
        if (d < bestD) { bestD = d; best = e; }
      }
      if (best) best.hasToken = true;
    }

    for (const e of this.list) e.update(dt, player, bounds);
  }
}
