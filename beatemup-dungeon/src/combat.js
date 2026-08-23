/**
 * Combat — resolves hitboxes against hurtboxes, and owns the two effects that
 * make a punch feel like it weighed something: HITSTOP and SHAKE.
 *
 * HITSTOP IS THE CHEAPEST AND MOST EFFECTIVE PIECE OF JUICE IN THE GENRE.
 * On a connect, both fighters freeze for a few dozen milliseconds. The picture
 * holding still for two or three frames reads as impact far more strongly than
 * any amount of particle effect, and it costs one timer. Scaled by the blow, so
 * the finisher lands visibly harder than the jab.
 *
 * IT FREEZES THE SIMULATION, NOT THE RENDERER. The loop keeps drawing at the
 * full frame rate through a hitstop — it simply stops advancing time. Skipping
 * the draw as well would show up as a dropped frame, which is what a stutter
 * looks like, rather than as a held moment.
 *
 * ONE ACTIVE WINDOW LANDS ONE HIT PER TARGET, enforced by `hasHit` on the
 * attack rather than by i-frames on the victim. The flying dungeon's hitscan
 * beam had to be rate-limited because it was re-tested every frame; a punch is
 * a discrete event and should behave like one, so the ATTACK remembers it has
 * connected and goes inert for the rest of its active frames. That is stricter
 * than i-frames and means a single punch can never double-dip on a target
 * standing in it.
 */
class Combat {
  /* `stats` is the run's tally and is OPTIONAL — the resolver works without one,
     so nothing here has to be guarded by "is there a scoreboard". It is passed
     in rather than reached for because this file is the one place every hit in
     the game is decided, which makes it the only honest place to count them. */
  constructor(stats, sound, hitFX) {
    this.stats = stats || null;
    /* `sound` is optional for the same reason `stats` is: the resolver decides
       hits and must keep working without a mixer attached. It is passed in
       rather than reached for because THIS is the one place in the game where a
       blow is known to have connected -- anywhere else would be guessing from
       an animation frame. */
    this.sound = sound || null;
    /* The impact art, optional on the same principle as the two above: the
       resolver decides hits and must keep deciding them with no effects pack
       loaded. Without one, drawFX simply draws nothing. */
    this.hitFX = hitFX || null;
    this.stop = 0;        // hitstop remaining, seconds
    /* Impact points, for the FX pass. Each carries the variant it drew, because
       the pick has to survive the whole burst -- see hit-fx.js. */
    this.events = [];
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

  /* `byPlayer` says which way the blow went. It is passed in rather than worked
     out from the arguments because this function has no idea which of the two
     fighters is the player -- and it only matters at all when HIT_FX.colorByRole
     is on, where the colour of the mark is the information. */
  _impact(attacker, victim, poseName, byPlayer) {
    const stop = (CONFIG.hitstopMs && CONFIG.hitstopMs[poseName]) || 60;
    // Take the LONGEST pending freeze rather than adding to it: two connects in
    // the same frame (a punch clipping two enemies) is one moment of impact,
    // not two stacked ones, and summing them would visibly hang the game.
    this.stop = Math.max(this.stop, stop / 1000);

    /* NO SCREEN SHAKE. It was built and taken out again by request — the effect
       is not wanted in this game. Hitstop carries the weight of a blow on its
       own, which is the arrangement most of the genre's best-feeling games
       actually use. Don't put it back as juice; it was a decision, not a gap. */

    /* THE VARIANT IS DRAWN HERE, ONCE, and rides the event for its whole life.
       Six animations exist so that a five-punch combo does not stamp the same
       mark five times; rolling the dice inside drawFX instead would strobe
       through all six inside a fifth of a second, which is noise rather than
       variety. Same for the mirror. */
    const fx = CONFIG.HIT_FX || {};
    const colour = fx.colorByRole
      ? (byPlayer ? fx.playerColour : fx.enemyColour)
      : null;

    // Impact point, in world coords: between the two, at the victim's depth.
    this.events.push({
      x: (attacker.x + victim.x) / 2,
      z: victim.z,
      y: victim.jumpY,
      t: (fx.ms || 220) / 1000,
      life: (fx.ms || 220) / 1000,
      big: poseName === 'finisher',
      fx: this.hitFX ? this.hitFX.pick(colour) : null,
      mirror: fx.mirror !== false && Math.random() < 0.5,
    });
  }

  /**
   * Resolve the player's live punch against the crowd.
   *
   * Only the FIRST target in a swing is struck (`hasHit` closes the box), which
   * is the genre default: a punch hits a person, not a row of them. A sweeping
   * attack that hits everyone would be a different move with a different name.
   */
  playerHits(player, crowd, boss, props) {
    const box = player.hitbox();
    if (!box) return;
    /* COUNTED HERE, AFTER THE BOX EXISTS — the order of these two lines is the
       whole definition of accuracy. `hitbox()` is null until the active window
       opens, so a punch the player was knocked out of during its start-up never
       counts against them: they did not miss it, they never threw it. Counted
       above the guard instead, every wind-up interrupted by a hit would score as
       a miss, and accuracy would measure how often they were interrupted.

       Stats dedupes by the attack OBJECT, so the several frames a window stays
       live are still one swing — and a swing that connects is counted here
       before `hasHit` closes the box below. */
    if (this.stats) this.stats.countSwing(player.atk);
    /* The boss is just another target. It answers vulnerable()/overlaps()/hurt()
       with the same shapes a Fighter does, which is why it needs no special case
       here — the one place the resolver would otherwise have grown a branch. */
    /* BARRELS ARE TARGETS LIKE ANYTHING ELSE. They answer vulnerable(),
       overlaps() and hurt() with the fighters' shapes, so they join the list
       rather than growing a branch -- the same bargain the bosses make.

       ⚠️ A BARREL CAN THEREFORE STEAL A PUNCH from an enemy standing behind it,
       because only the NEAREST target is hit. That is the genre's behaviour and
       it is why a barrel breaks in one blow: the punch is not wasted, it is
       spent on the thing that was in the way. */
    let targets = boss ? crowd.list.concat([boss]) : crowd.list;
    if (props) targets = targets.concat(props.targets());
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
    /* DEV MODE overrides the damage and nothing else -- the reach, the timing,
       the knockdown and the combo all behave normally, so what is being tested
       is still the real fight, just a shorter one. It is applied HERE, at the
       one place the player's damage is read, rather than by rewriting
       CONFIG.COMBO: the table documents a 28-damage string that every enemy's
       HP is tuned against, and a config that lies about that is worse than a
       branch. */
    const dmg = (CONFIG.DEV && CONFIG.DEV.on && CONFIG.DEV.punchDamage != null)
      ? CONFIG.DEV.punchDamage
      : box.def.damage;
    const wasDead = best.dead;
    best.hurt(dmg, box.dir, box.def.knockback, box.def.lift, box.def.knockdown);
    /* THE SOUND OF IT, fired here rather than in _impact() because _impact is
       shared with the blows the ENEMIES land on the player, and this one is the
       player connecting.

       IT IS NOT AFFECTED BY THE HITSTOP that starts a few lines below. Web
       Audio runs on its own clock, so the effect plays through the freeze at
       full speed -- which is right: the freeze is the picture holding on the
       moment of impact, and the impact is what is being heard.

       DETUNED PER LINK IN THE COMBO. The same 300ms sample five times in a row
       reads as a stuck record rather than as five punches, so each hit of a
       string comes out slightly higher than the last. `comboIndex` is already
       the position in the string, so this costs nothing to know. */
    if (this.sound) {
      /* THE LAST LINK OF A STRING LANDS DIFFERENTLY, so it sounds different --
         its own recording, not the punch pitched up. `atk.last` was decided
         when the attack started (see Fighter.attack), which is the only moment
         the string and the position in it are both known.

         THE FINISHER IS NOT DETUNED. The rising pitch exists to keep four
         copies of one sample from reading as a stuck record; the finisher is
         heard once, against three that were not it, so there is nothing for it
         to be told apart from. */
      if (player.atk.last) {
        this.sound.play('comboFinish');
      } else {
        const step = (CONFIG.sfxHitDetune != null) ? CONFIG.sfxHitDetune : 0.045;
        this.sound.play('hit', 1 + step * (player.comboIndex || 0));
      }
    }
    if (this.stats) {
      this.stats.hit(dmg);
      // The kill is read AFTER the blow, and only on the transition: `dead`
      // stays true while the body falls and fades, so testing it alone would
      // score one death every frame of the fall.
      // ⚠️ `scores` KEEPS BARRELS OFF THE BOARD. Everything else this can hit is
      // a fighter; a smashed barrel would otherwise count as an enemy downed.
      if (!wasDead && best.dead && best.scores !== false) this.stats.killed(best.kind);
    }
    this._impact(player, best, box.def.pose, true);
  }

  /**
   * The Mosca Boss's contact damage.
   *
   * THE VERTICAL TOLERANCE IS NOT APPLIED HERE, unlike the crowd's swings.
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
    /* `lift` and `knockdown` are READ OFF THE BOX, not hardcoded as they are
       for the crowd. A mook's swing never floors anyone, so crowdHits() can pass
       0/false; the boss's blows differ from each other — the ambush pass knocks
       the player down for no damage at all, which is the entire shape of that
       move — and hardcoding here would quietly flatten it into an ordinary hit. */
    player.hurt(box.def.damage, box.dir, box.def.knockback,
                box.def.lift || 0, !!box.def.knockdown);
    if (this.stats) this.stats.tookHit(box.def.damage);
    this._takeHitSound();
    this._impact(boss, player, 'finisher', false);
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
      /* LIFT AND KNOCKDOWN COME FROM THE DEF NOW, and used to be hardcoded 0
         and false -- no enemy attack in the game could put the player on the
         floor. Nothing about the crowd changes by reading them: not one
         cigarette punch sets either flag, so every existing swing still behaves
         exactly as it did. It is the barata's CHARGE that needs it. A move that
         bowls you over and keeps going has to actually bowl you over, or it
         reads as a very fast enemy brushing past. */
      player.hurt(box.def.damage, box.dir, box.def.knockback,
                  box.def.lift || 0, !!box.def.knockdown);
      if (this.stats) this.stats.tookHit(box.def.damage);
      this._takeHitSound();
      this._impact(e, player, 'straight', false);
    }
  }

  /**
   * A THROWN BARREL, against the crowd.
   *
   * ⚠️ IT COUNTS AS THE PLAYER'S BLOW, and that is not a detail now that the
   * impact marks carry information: `byPlayer` true is what makes the burst
   * yellow. The player threw it, so it is their hit -- it is scored as theirs
   * and it sounds like theirs.
   *
   * ⚠️ ONE ENEMY PER THROW, unless `throwPierce` says otherwise. A barrel
   * crossing an arena would otherwise hit each of five enemies as it passed
   * through them, which is a different move from the one that was asked for --
   * and it never breaks, because breaking is what hitting is supposed to do.
   * `hitIds` is what remembers; it is per-throw, not per-barrel, so a barrel
   * picked up and thrown twice starts fresh.
   */
  propHits(prop, crowd, player, boss) {
    if (!prop || prop.state !== 'thrown') return;
    /* ⚠️ THE THROW IS COUNTED AS A SWING, ONCE, or accuracy goes over 100%.
       `hits` and `swings` are the two halves of one ratio (see stats.js), so a
       hit that never had a swing behind it makes SAGACIDADE read 110%. The prop
       itself is the identity `countSwing` compares against -- it builds no
       attack object -- and the flag is reset by throwFrom(), so a barrel thrown
       twice counts twice. A throw that misses still counts, which is right: it
       was an attempt. */
    if (this.stats && !prop.swingCounted) {
      prop.swingCounted = true;
      this.stats.countSwing(prop);
    }
    const C = prop.cfg || {};
    const hw = prop.halfW(), hz = prop.halfZ();
    /* ⚠️ A BOSS IS IN THE LIST. The boss room has barrels in it and the first
       thing any player does with a barrel and a horse in the same room is throw
       one at the other; finding that it passes straight through reads as the
       mechanic being broken rather than as a rule. Both bosses answer
       vulnerable() and hurt() like a mook, so they cost this one concat. */
    const targets = boss ? (crowd ? crowd.list.concat([boss]) : [boss])
                         : (crowd ? crowd.list : []);
    for (const e of targets) {
      if (!e.vulnerable() || prop.hitIds.indexOf(e) >= 0) continue;
      if (Math.abs(e.x - prop.x) > hw + CONFIG.fighterSizePx * 0.3) continue;
      if (Math.abs(e.z - prop.z) > hz + 20) continue;
      /* ⚠️ HEIGHT MATTERS FOR A THROWN THING and this is the one place in the
         game where it is the ARC that decides: the barrel is only dangerous
         while it is at body height. Without it a barrel sailing over an enemy's
         head knocks him down from three feet above his hat. */
      if (Math.abs(prop.jumpY - e.jumpY) > (C.throwReachY || 130)) continue;

      prop.hitIds.push(e);
      const dir = prop.vx >= 0 ? 1 : -1;
      e.hurt(C.throwDamage || 22, dir, C.throwKnockback || 260,
             C.throwLiftHit || 90, C.throwKnockdown !== false);
      if (this.stats) {
        this.stats.hit(C.throwDamage || 22);
        if (e.dead) this.stats.killed(e.kind);
      }
      if (this.sound) this.sound.play('hit', 0.92);
      this._impact(prop, e, 'finisher', true);
      if (!C.throwPierce) { prop.smash(true); return; }
    }
  }

  /**
   * A blow LANDING ON THE PLAYER.
   *
   * ⚠️ IT IS THE PUNCH SAMPLE, PITCHED DOWN, AND THAT IS THE REQUEST -- "the
   * porrada noise when the player gets hit, like when he hits the enemies".
   * A second recording would have been a different sound, and half the point is
   * that a fight sounds like one fight.
   *
   * ⚠️ CALLED FROM EVERY PATH THAT DAMAGES THE PLAYER, and there are two --
   * the crowd's swings and a boss's contact -- which is exactly why it is a
   * method rather than two copies of one line. The player's own connects fire
   * their sound in playerHits() instead, because that is where the combo
   * position is known and the finisher gets its own clip.
   *
   * NO DETUNE PER HIT. The rising pitch in a combo exists to keep five copies
   * of one sample in a row from reading as a stuck record; blows coming the
   * other way arrive from different attackers at irregular spacing and have
   * nothing to be told apart from.
   */
  _takeHitSound() {
    if (!this.sound) return;
    const r = (CONFIG.sfxTakeHitRate != null) ? CONFIG.sfxTakeHitRate : 0.82;
    this.sound.play('hit', r);
  }

  /**
   * The impact marks.
   *
   * SPRITED SINCE 2026-08-21. What was here before was a four-spoke starburst
   * drawn in code, with a comment saying it was placeholder and that a shape
   * drawn in code is an honest one where a borrowed sprite would quietly become
   * permanent. effects-porrada-01.png is the real art, so it went.
   *
   * THE PICK IS ALREADY MADE. Which of the six animations this event draws, and
   * whether it is mirrored, were decided in _impact and stored on the event.
   * Nothing random happens in here -- see hit-fx.js for why that matters.
   *
   * `t` counts DOWN, and does not advance during hitstop, so a burst holds its
   * solid first frame for as long as the picture is held and then breaks up.
   */
  drawFX(ctx, camX) {
    if (!this.hitFX || !this.hitFX.ready()) return;
    const cfg = CONFIG.HIT_FX || {};
    for (const ev of this.events) {
      if (!ev.fx) continue;
      const p = 1 - ev.t / (ev.life || 0.22);       // 0 -> 1 through the burst
      const x = ev.x - camX;
      const y = CONFIG.beltTopY + ev.z - ev.y
              - CONFIG.fighterSizePx * (cfg.chestRel != null ? cfg.chestRel : 0.42);
      /* The fade runs over the TAIL only. The art dissipates on its own -- it
         ends as a scatter of dots -- so ramping alpha across the whole life
         would spend the fade on the solid star, which is the frame that reads
         as the hit. */
      const tail = cfg.fadeTail != null ? cfg.fadeTail : 0.3;
      const alpha = tail > 0 && p > 1 - tail ? Math.max(0, (1 - p) / tail) : 1;
      const size = ev.big
        ? (cfg.bigSizePx || 95)
        : (cfg.sizePx || 65);
      this.hitFX.draw(ctx, ev.fx, p, x, y, size, ev.mirror, alpha);
    }
  }
}
