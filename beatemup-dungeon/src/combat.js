/**
 * Combat — resolves hitboxes against hurtboxes, and owns the two effects that
 * make a punch feel like it weighed something: HITSTOP and SHAKE.
 *
 * ⚠️ HITSTOP IS THE CHEAPEST AND MOST EFFECTIVE PIECE OF JUICE IN THE GENRE.
 * On a connect, both fighters freeze for a few dozen milliseconds. The picture
 * holding still for two or three frames reads as impact far more strongly than
 * any amount of particle effect, and it costs one timer. Scaled by the blow, so
 * the finisher lands visibly harder than the jab.
 *
 * ⚠️ IT FREEZES THE SIMULATION, NOT THE RENDERER. The loop keeps drawing at the
 * full frame rate through a hitstop — it simply stops advancing time. Skipping
 * the draw as well would show up as a dropped frame, which is what a stutter
 * looks like, rather than as a held moment.
 *
 * ⚠️ ONE ACTIVE WINDOW LANDS ONE HIT PER TARGET, enforced by `hasHit` on the
 * attack rather than by i-frames on the victim. The flying dungeon's hitscan
 * beam had to be rate-limited because it was re-tested every frame; a punch is
 * a discrete event and should behave like one, so the ATTACK remembers it has
 * connected and goes inert for the rest of its active frames. That is stricter
 * than i-frames and means a single punch can never double-dip on a target
 * standing in it.
 */
class Combat {
  constructor() {
    this.stop = 0;        // hitstop remaining, seconds
    this.events = [];     // { x, y, kind } — impact points, for the FX pass
  }

  /** True while the simulation should be held. */
  frozen() { return this.stop > 0; }

  /** Tick the freeze down. Called with REAL dt, before anything else, and it is
      the only thing that advances while frozen. */
  tickFreeze(dt) {
    if (this.stop > 0) { this.stop = Math.max(0, this.stop - dt); return true; }
    return false;
  }

  tick(dt) {
    for (let i = this.events.length - 1; i >= 0; i--) {
      this.events[i].t -= dt;
      if (this.events[i].t <= 0) this.events.splice(i, 1);
    }
  }

  _impact(attacker, victim, poseName) {
    const stop = (CONFIG.hitstopMs && CONFIG.hitstopMs[poseName]) || 60;
    // Take the LONGEST pending freeze rather than adding to it: two connects in
    // the same frame (a punch clipping two enemies) is one moment of impact,
    // not two stacked ones, and summing them would visibly hang the game.
    this.stop = Math.max(this.stop, stop / 1000);

    /* NO SCREEN SHAKE. It was built and taken out again by request — the effect
       is not wanted in this game. Hitstop carries the weight of a blow on its
       own, which is the arrangement most of the genre's best-feeling games
       actually use. Don't put it back as juice; it was a decision, not a gap. */

    // Impact point, in world coords: between the two, at the victim's depth.
    this.events.push({
      x: (attacker.x + victim.x) / 2,
      z: victim.z,
      y: victim.jumpY,
      t: 0.22,
      big: poseName === 'finisher',
    });
  }

  /**
   * Resolve the player's live punch against the crowd.
   *
   * Only the FIRST target in a swing is struck (`hasHit` closes the box), which
   * is the genre default: a punch hits a person, not a row of them. A sweeping
   * attack that hits everyone would be a different move with a different name.
   */
  playerHits(player, crowd, boss) {
    const box = player.hitbox();
    if (!box) return;
    /* The boss is just another target. It answers vulnerable()/overlaps()/hurt()
       with the same shapes a Fighter does, which is why it needs no special case
       here — the one place the resolver would otherwise have grown a branch. */
    const targets = boss ? crowd.list.concat([boss]) : crowd.list;
    let best = null, bestD = Infinity;
    for (const e of targets) {
      if (!e.vulnerable()) continue;
      // Airborne fighters are out of reach of a ground punch. Cheap, and it is
      // what makes the jump worth having.
      if (Math.abs(e.jumpY - player.jumpY) > CONFIG.verticalReach) continue;
      if (!e.overlaps(box)) continue;
      const d = Math.abs(e.x - player.x);
      if (d < bestD) { bestD = d; best = e; }
    }
    if (!best) return;
    player.atk.hasHit = true;
    best.hurt(box.def.damage, box.dir, box.def.knockback, box.def.lift, box.def.knockdown);
    this._impact(player, best, box.def.pose);
  }

  /**
   * The Mosca Boss's contact damage.
   *
   * ⚠️ THE VERTICAL TOLERANCE IS NOT APPLIED HERE, unlike the crowd's swings.
   * The boss attacks by flying INTO you, so its altitude is already the whole
   * story: a swoop that bottoms out at the floor and a ground pass that scrapes
   * along it are dangerous precisely because they are at your height, and a dive
   * still 200px up is harmless because it has not arrived yet. That is expressed
   * by the phase gating in FlyBoss.hitbox(), which only opens the box while it
   * is genuinely coming down. Adding a jumpY comparison on top would let the
   * player jump THROUGH a ground pass, which is exactly the dodge the attack
   * exists to deny — the answer to it is depth, not height.
   */
  bossHits(boss, player) {
    if (!boss) return;
    const box = boss.hitbox();
    if (!box) return;
    if (!player.vulnerable()) return;
    if (!player.overlaps(box)) return;
    boss.hasHit = true;               // one hit per pass
    /* ⚠️ `lift` and `knockdown` are READ OFF THE BOX, not hardcoded as they are
       for the crowd. A mook's swing never floors anyone, so crowdHits() can pass
       0/false; the boss's blows differ from each other — the ambush pass knocks
       the player down for no damage at all, which is the entire shape of that
       move — and hardcoding here would quietly flatten it into an ordinary hit. */
    player.hurt(box.def.damage, box.dir, box.def.knockback,
                box.def.lift || 0, !!box.def.knockdown);
    this._impact(boss, player, 'finisher');
  }

  /** ...and the crowd's swings against the player. */
  crowdHits(crowd, player) {
    for (const e of crowd.list) {
      const box = e.hitbox();
      if (!box) continue;
      if (!player.vulnerable()) continue;
      if (Math.abs(player.jumpY - e.jumpY) > CONFIG.verticalReach) continue;
      if (!player.overlaps(box)) continue;
      e.atk.hasHit = true;
      player.hurt(box.def.damage, box.dir, box.def.knockback, 0, false);
      this._impact(e, player, 'straight');
    }
  }

  /**
   * The impact marks. Deliberately drawn rather than sprited: there is no
   * impact art in any Saborosa pack yet, and a shape drawn in code is honest
   * placeholder where a borrowed sprite would quietly become permanent.
   */
  drawFX(ctx, camX) {
    for (const ev of this.events) {
      const p = ev.t / 0.22;                       // 1 → 0
      const r = (ev.big ? 46 : 26) * (1.35 - p * 0.6);
      const x = ev.x - camX;
      const y = CONFIG.beltTopY + ev.z - ev.y - CONFIG.fighterSizePx * 0.42;
      ctx.save();
      ctx.globalAlpha = p;
      ctx.strokeStyle = ev.big ? '#FAFA24' : '#ffffff';
      ctx.lineWidth = ev.big ? 4 : 2.5;
      ctx.beginPath();
      // A starburst: four spokes, which at this size reads as an impact and at
      // any size reads as "not final art".
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + 0.4;
        ctx.moveTo(x + Math.cos(a) * r * 0.35, y + Math.sin(a) * r * 0.35);
        ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
      }
      ctx.stroke();
      ctx.restore();
    }
  }
}
