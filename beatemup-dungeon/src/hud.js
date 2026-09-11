/**
 * HUD — the player's health slab, the enemies' floating bars, and the screen
 * furniture (the "GO" arrow, the end cards).
 *
 * Canvas-drawn, not DOM, for the reason the flying dungeon's HUD records: a div
 * over the page keeps its CSS pixel size while the canvas scales, so it drifts
 * out of the frame's corner at every window size but one.
 *
 * Colours and the font stack are the ones the other two games use — Futura is
 * NOT bundled and is absent from most Linux and Windows machines, so the stack
 * falls through geometric sans-serifs before conceding to a generic one. Same
 * open decision as over there: ship a webfont or accept the fallback.
 */
class Hud {
  constructor(letters) {
    this.flashT = 0;
    /* THE GO PROMPT'S SHUFFLE BAG. `goPick` is the phrase on screen; `goBag` is
       the indices still to be dealt this pass; `goLast` is what the player
       actually last SAW, for the seam between two bags; `goSeq` is the last
       ticket `Stage` handed over. See `_rollGo` and `drawGo`. */
    this.goPick = 0;
    this.goBag = [];
    this.goLast = -1;
    this.goSeq = -1;
    /* THE HAND-LETTERED PACK, for the fighter names and the lives. Optional:
       every use of it below falls back to the type it replaced, so the HUD of a
       build whose pack failed to load still says who you are and how many
       coconuts are left. */
    this.letters = letters || null;
  }

  _lcfg(key, dflt) {
    const L = CONFIG.LETTERS || {};
    return L[key] != null ? L[key] : dflt;
  }

  /**
   * A fighter's name under its bar, drawn from the pack if the sheet has it.
   * Returns false if it did not, which is the caller's cue to set type.
   *
   * ⚠️ LEFT-ALIGNED ON THE BAR'S OWN LEFT EDGE, exactly as the type was --
   * `Letters.draw` centres, so the centre is computed from the frame's width
   * here rather than by giving the pack a second alignment mode it would only
   * ever use once.
   */
  _drawName(ctx, name, box) {
    const L = this.letters;
    const key = L && L.nameKey(name);
    if (!key) return false;
    const sz = L.size(key, CONFIG.GAME_W);
    return L.draw(ctx, key, box.x + sz.w / 2,
                  box.y + box.h + this._lcfg('hudNameGap', 6) + sz.h / 2);
  }

  /**
   * The lives, as drawn coconuts under the player's name.
   *
   * Asked for 2026-09-01: *"instead of X0, x1, x2, for the lives, use the
   * coconut drawing line, for now add 3 coconuts as default"*.
   *
   * ⚠️ ONE COCONUT PER LIFE, INCLUDING THE ONE BEING PLAYED. The old readout
   * said `x` + (lives - 1) -- the SPARES -- so a last life read `x0`, and the
   * user named that exact case: *"0 equals 1 last coconut as life"*. A row of
   * drawings has no way to say "zero spares" except by being empty, which is
   * what a dead player looks like. So the row IS the lives, and `playerLives: 3`
   * draws three.
   *
   * ⚠️ AND THE FOUR DRAWINGS CYCLE. The artist drew four coconuts, not one, and
   * they differ; repeating a single frame would read as a stamp. Asked for.
   */
  _drawLives(ctx, player, box) {
    const L = this.letters;
    if (!L || !L.has('life0')) return false;
    const n = Math.max(0, player.lives | 0);
    if (n <= 0) return true;
    const gap = this._lcfg('lifeGap', 4);
    /* THE COCONUTS ARE TRIMMED UNDER THE PACK'S ONE SCALE, the way the menu is.
       Asked for 2026-09-01: *"the coconut drawing that represent each life is too
       big, make it 20% smaller."* This is the escape hatch letters.js describes
       -- one scale for the pack, and a per-call `mul` where a single element has
       to sit differently. It applies to the MEASURE as well as the draw, or the
       row would be spaced for coconuts it is no longer drawing. */
    const mul = this._lcfg('lifeMul', 1);
    const sizes = [];
    for (let i = 0; i < n; i++) {
      const key = 'life' + (i % 4);
      sizes.push({ key, s: L.size(L.has(key) ? key : 'life0', CONFIG.GAME_W, mul) });
    }
    const h = Math.max.apply(null, sizes.map(o => o.s.h));
    /* THE SAME ROW AS THE NAME, ENDING AT THE BAR'S RIGHT EDGE. Corrected
       2026-09-01: *"the coconut lives should stay at the rightmost end of the HP
       bar, not below the character name."* They shipped on a row of their own
       under the name, on the reasoning that three drawings are not two
       characters and would run back across the bar from the right. That reasoning
       was about the OLD anchor: laid out from `box.x + box.w` BACKWARDS the row
       ends where it should and grows leftwards into the empty middle of the
       plate, which is exactly where `x2` used to sit. The plate is also one line
       shorter for it.

       ⚠️ SO THE ROW IS PLACED BY ITS RIGHT EDGE, WHICH MEANS MEASURING IT FIRST.
       `x2` was two glyphs and `textAlign = 'right'` did this for free; a row of
       pictures has to have its own width summed before its first one can be
       drawn. That is the whole difference between the old readout and this one.

       ⚠️ AND IT IS `box.x + box.w`, THE BAR'S OWN RIGHT EDGE, NOT THE SCREEN'S.
       `LifeBar.render` hands the footprint back for exactly this, so moving or
       resizing the bar carries the lives with it. */
    const y = box.y + box.h + this._lcfg('hudNameGap', 6) + h / 2;
    let total = gap * (sizes.length - 1);
    for (const o of sizes) total += o.s.w;
    let x = box.x + box.w - total;
    for (const o of sizes) {
      L.draw(ctx, o.key, x + o.s.w / 2, y, { mul });
      x += o.s.w + gap;
    }
    return true;
  }

  _font(px, weight) {
    return `${weight || 'bold'} ${px}px ${CONFIG.hudFont}`;
  }

  /**
   * The player's bar, top-left, plus the name and lives.
   *
   * The bar itself is STILL LIFE's hand-drawn one, drawn by LifeBar — 23 hand-
   * inked states rather than a rectangle that shortens. The name and the life
   * count are hung off the footprint that render() hands back, so moving or
   * resizing the bar carries them with it instead of needing three numbers kept
   * in step by hand.
   *
   * If the sheet has not loaded, render() returns null and the whole block
   * is skipped rather than falling back to a drawn rectangle. That is the right
   * failure here: a plain slab where the hand-drawn bar belongs looks like the
   * finished thing and would quietly ship, whereas nothing at all is obviously
   * a missing asset.
   */
  drawPlayer(ctx, player, lifeBar) {
    const box = lifeBar && lifeBar.render(ctx, Math.max(0, player.hp / player.maxHp));
    if (!box) return;

    ctx.save();
    ctx.fillStyle = CONFIG.hudColor;
    ctx.font = this._font(CONFIG.hudSize * 0.62);
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    /* READ FROM THE CAST TABLE rather than written here, so the player's name
       cannot drift from the one the results board prints.

       ⚠️ KEYED ON THE FIGHTER IN FRONT OF IT, NOT ON 'coconut'. This said
       `CHARACTERS.coconut` until Tab could swap the hero (2026-08-26), which
       was correct only while there was one of him: the HUD would have gone on
       naming the character who was not being played. Asking the player his own
       kind is the version that cannot be left behind by a second pack. */
    const me = (CONFIG.CHARACTERS && CONFIG.CHARACTERS[player.kind]) || {};
    /* THE NAME AND THE LIVES ARE DRAWINGS NOW, and the typed pair below is the
       fallback for a build with no pack. They share one row under the bar: the
       name from its left edge, the coconuts ending at its right, which is the
       arrangement `x2` always had. See _drawLives. */
    const drewName = this._drawName(ctx, me.name, box);
    const drewLives = this._drawLives(ctx, player, box);
    if (!drewName) ctx.fillText(me.name || '', box.x, box.y + box.h + 4);
    if (!drewLives) {
      ctx.textAlign = 'right';
      ctx.fillText('x' + Math.max(0, player.lives - 1), box.x + box.w, box.y + box.h + 4);
    }
    ctx.restore();
  }

  /**
   * A BOSS's bar, top-centre and wider, with its NAME under it.
   *
   * ⚠️ THE NAME IS ASKED OF THE BOSS, NOT DERIVED FROM ITS `kind` HERE. The two
   * bosses get theirs from different places -- HIPÓLITO from `CONFIG.CHARACTERS`
   * because he is a proper pack, NARUTÃO from `CONFIG.MOSCA_NAME` because she is
   * two raw sheets and has no cast entry -- and a branch on `kind` in the HUD
   * would be the third place that has to know which is which. Each boss sets
   * `this.name` in its own constructor, so a third one declares a name and
   * nothing here changes.
   *
   * Hung off the footprint `render()` hands back, exactly like the player's, so
   * moving or resizing the bar carries the name with it rather than needing a
   * second set of coordinates kept in step by hand.
   *
   * ⚠️ WHETHER THE BAR IS UP AT ALL IS THE CALLER'S DECISION and deliberately
   * not made here -- it is gated on the boss having ARRIVED and being neither
   * dead nor fleeing, which are facts about the fight rather than about the
   * drawing. See the call site in game.js, where the reasons are written down.
   *
   * Like drawPlayer: if the sheet has not loaded, render() returns null and the
   * whole block is skipped rather than falling back to a drawn rectangle.
   */
  drawBoss(ctx, boss, lifeBar) {
    const box = lifeBar && lifeBar.render(ctx, Math.max(0, boss.hp / boss.maxHp), {
      centre: true, top: CONFIG.flyBossBarTop, wRel: CONFIG.flyBossBarWRel,
    });
    if (!box || !boss.name) return;

    ctx.save();
    ctx.fillStyle = CONFIG.hudColor;
    ctx.font = this._font(CONFIG.hudSize * (CONFIG.bossNameSizeRel || 0.62), 'bold');
    ctx.textBaseline = 'top';
    /* LEFT-ALIGNED ON THE BAR'S LEFT EDGE, exactly as the player's name is on
       his -- requested 2026-08-27, over a centred version. The BAR is still
       centred; it is the name inside it that starts at the same corner the
       player's does, so the two plates read as the same piece of interface
       rather than as two different ones that happen to sit under bars.

       ⚠️ `box.x` IS THE BAR'S OWN LEFT EDGE, NOT THE SCREEN'S. LifeBar.render
       computes it from `centre: true` and hands it back for exactly this -- so
       widening the boss bar (`flyBossBarWRel`) slides the name with it and there
       is no second number to keep in step. */
    ctx.textAlign = 'left';
    /* HAND-LETTERED IF THE SHEET HAS THIS BOSS, TYPE IF IT DOES NOT -- and the
       sheet is asked by the name the boss already declares, so a new boss gets
       its lettering by being drawn under that name and nothing here changes.
       See Letters.nameKey. */
    if (!this._drawName(ctx, boss.name, box)) {
      ctx.fillText(boss.name, box.x, box.y + box.h + (CONFIG.bossNameGap || 4));
    }
    ctx.restore();
  }

  /**
   * An enemy's bar, floating over its head — and ONLY for a beat after it was
   * last hit. A permanent bar over every enemy turns a crowd into a wall of
   * meters and buries the thing the player should be watching, which is the
   * fighters. Showing it on damage means it is up exactly when it is being
   * asked about.
   *
   * DELIBERATELY NOT the hand-drawn bar the player gets. That art is eleven
   * inked squares in a 333px frame; at the ~50px an enemy's bar occupies they
   * collapse into mush, and shrinking it far enough to fit would waste the only
   * thing it is good for. A plain slab is also the right hierarchy — the
   * player's health is the readout that matters, and giving every mook the same
   * treatment flattens that.
   */
  drawEnemy(ctx, e, sheets, camX) {
    /* ⚠️ OFF BY CONFIG SINCE 2026-09-05 -- `CONFIG.enemyBars` is false and the
       bars do not appear at all. The drawing below is kept because the flag is
       the whole change; see the note on the knob for why it is not a deletion.
       This guard is FIRST so nothing below it is a cost while it is off. */
    if (!CONFIG.enemyBars) return;
    if (e.dead || e.showBarT <= 0) return;
    const fade = Math.min(1, e.showBarT / 0.4);
    const size = sheets.size(e.kind, e.pose(sheets), e.frameStep(sheets));
    const x = e.groundX(camX);
    const y = e.groundY() - size.h * e.depthScale() - CONFIG.enemyBarLift;
    const w = CONFIG.enemyBarW, h = CONFIG.enemyBarH;
    const p = Math.max(0, e.hp / e.maxHp);

    ctx.save();
    ctx.globalAlpha = fade;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(x - w / 2 - 1, y - 1, w + 2, h + 2);
    ctx.fillStyle = '#E4463A';
    ctx.fillRect(x - w / 2, y, w * p, h);
    ctx.restore();
  }

  _goPack(assets) {
    const C = CONFIG.GO_WORDS;
    if (!assets || !C || C.on === false) return null;
    /* ⚠️ `goPrompt`. `goWords` is the GAME OVER pack -- see manifest.js. */
    const img = assets.getDrawable('goPrompt');
    const defs = assets.getJSON('goPrompt');
    return (img && defs && defs.frames && defs.frames.length) ? { img, defs } : null;
  }

  /**
   * Choose the phrase. Called once per PROMPT, off `Stage.goSeq`.
   *
   * ⚠️ SAMPLING WITHOUT REPLACEMENT, NOT INDEPENDENT DRAWS -- lifted whole from
   * `Pause.roll()`, which lifted it whole from `GameOver.roll()`, seam included,
   * because it is the same request each time: *"use the same mechanic that we
   * use for the pause lettering, sampling without substitution etc."* A fresh
   * `random()` per prompt is memoryless, and memoryless is not what a player
   * experiences as random: with five phrases an immediate repeat lands one
   * prompt in five, and POR AQUI! twice running reads as the pack being broken
   * -- the one outcome a sheet of five phrases exists to prevent.
   *
   * ⚠️ AND THE SEAM BETWEEN TWO BAGS IS THE PART THAT IS EASY TO GET WRONG. A
   * plain shuffle-and-deal can end one bag on a phrase and open the next on the
   * same one -- a repeat on the single boundary the shuffle does not cover,
   * about one refill in five. `goLast` is what was actually SHOWN, and a refill
   * opening on it is nudged: swapped with the END rather than re-shuffled,
   * because a re-shuffle can land on it again and a loop that retries is a loop
   * that can spin.
   *
   * ⚠️ THE ARENA COUNT IS WHY THIS MATTERS MORE HERE THAN ON THE DEATH PANEL.
   * A death is rare; the GO prompt goes up after every cleared fight and again
   * on every back-nudge, so a player sees the whole cycle several times in a
   * run -- this pack's seam is the pause card's case, not the game over's.
   *
   * ⚠️ THE BAG IS NOT PERSISTED. It lasts as long as the page.
   */
  _rollGo(n) {
    if (!(n > 0)) { this.goPick = 0; return; }
    if (!this.goBag.length) {
      for (let i = 0; i < n; i++) this.goBag.push(i);
      // Fisher-Yates, so every ordering is equally likely.
      for (let i = this.goBag.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const t = this.goBag[i]; this.goBag[i] = this.goBag[j]; this.goBag[j] = t;
      }
      if (n > 1 && this.goBag[0] === this.goLast) {
        this.goBag[0] = this.goBag[n - 1]; this.goBag[n - 1] = this.goLast;
      }
    }
    this.goPick = this.goBag.shift();
    this.goLast = this.goPick;
  }

  /**
   * THE WAY OUT IS THAT WAY — shown when an arena clears and the way forward
   * opens. One of FIVE hand-drawn phrases: PRA LÁ', VAI!, POR AQUI!, VÁ and
   * ANDA LOGO!, dealt without replacement per prompt.
   *
   * ⚠️ IT USED TO BE TWO PICTURES AND IS NOW ONE. The prompt was a hand-lettered
   * `GO!` cut off the title sheet plus the MAIN GAME's pointing hand
   * (assets/intro-hand.png), laid out side by side with `goGap` between them.
   * Replaced 2026-09-11 by `batidao-letter-poraqui-001`, where **every phrase is
   * drawn with its own pointer already on it** — three a pointing fist, two a
   * solid arrow, the artist's choice per phrase. So there is no gap to tune, no
   * second image to be missing, and no layout to close up around it. The old
   * two-piece prompt is kept whole below as the fallback; `goGap`/`goH`/
   * `goHandH` are read by that path only.
   *
   * ⚠️ THE PHRASE IS DEALT ON `Stage.goSeq`, NOT PER FRAME AND NOT PER CALL TO
   * `_goPrompt`. The prompt is re-nudged while a player leans on the left wall
   * (`tryingBack`, once every `goBackNudgeS`), and a nudge must not swap the
   * phrase out from under them. See `_rollGo` and the note on the ticket in
   * stage.js.
   *
   * STILL NO TYPEFACE ANYWHERE IN IT. A geometric sans "GO" beside a hand-inked
   * hand read as two different games sharing a corner of the screen, and that
   * is as true of five phrases as it was of one.
   */
  drawGo(ctx, t, seq, assets) {
    if (t <= 0) return;
    const pack = this._goPack(assets);
    /* ⚠️ THE PICK IS MADE ON THE TICKET, NOT ON THE CLOCK. `Stage.goSeq` changes
       once per prompt that RISES; comparing it here is the whole of "deal a new
       phrase". Rolling inside the draw without it would re-roll every frame and
       flicker five phrases through the 2.6s the prompt is up -- the same bug
       `GameOver` documents, and the reason its header's "stateless" boast had to
       be amended. ⚠️ Rolled even with no pack loaded, so the bag's cycle does not
       depend on whether a PNG arrived. */
    if (seq !== this.goSeq) {
      this.goSeq = seq;
      this._rollGo(pack ? pack.defs.frames.length : 0);
    }
    const a = Math.min(1, t / (CONFIG.goFadeMs / 1000));
    // Horizontal, so the prompt nudges toward the exit rather than bouncing.
    const bob = Math.sin(t * CONFIG.goBobFreq) * CONFIG.goBobAmp;
    let right = CONFIG.GAME_W - CONFIG.goMarginRight + bob;

    ctx.save();
    ctx.globalAlpha = a;

    if (pack) {
      /* ONE PICTURE: the phrase and its pointer are one drawing, so there is no
         gap to close and no second image to be missing.

         ⚠️ ONE SCALE FOR THE WHOLE PACK, off the widest frame -- read from the
         pack itself rather than written down, so a recut sheet cannot leave the
         scale behind. Fitting each phrase to `wRel` in turn is the other obvious
         implementation and it destroys the only thing the pack is doing: VA is
         drawn 543 against POR AQUI!'s 899 because that is how it was drawn.

         ⚠️ AND IT HANGS OFF THE RIGHT EDGE, WHICH IS THE FRAME'S OWN ANCHOR.
         The pointer is at the right-hand end of every band, so anchoring there
         keeps it in one place and lets the words grow leftward. Centred
         instead, a long phrase and a short one would put their fists in two
         different spots and the prompt would appear to jump between picks. */
      const C = CONFIG.GO_WORDS || {};
      const frames = pack.defs.frames;
      const f = frames[this.goPick % frames.length];
      let maxW = 1;
      for (const q of frames) if (q.w > maxW) maxW = q.w;
      const k = CONFIG.GAME_W * (C.wRel || 0.32) / maxW;
      ctx.drawImage(pack.img, f.x, f.y, f.w, f.h,
                    right - f.ax * k, CONFIG.goY - f.ay * k, f.w * k, f.h * k);
      ctx.restore();
      return;
    }

    /* FALLBACK ONLY, and it is the prompt this pack replaced: the hand-lettered
       `GO!` off the title sheet plus the main game's pointing hand, laid out
       side by side. Kept whole rather than deleted for the reason every pack in
       this game keeps its predecessor -- a sheet that fails to load should cost
       the lettering's look and not the prompt. A player stranded in a cleared
       arena with nothing telling them the game is waiting is a worse outcome
       than a plainer arrow. Each piece is still independently optional and the
       layout still closes up around whichever is missing. */
    const goImg = assets && assets.getDrawable('go');
    const handImg = assets && assets.getDrawable('hand');

    if (handImg && handImg.width) {
      const h = CONFIG.goHandH;
      const w = (handImg.width / handImg.height) * h;
      ctx.drawImage(handImg, right - w, CONFIG.goY - h / 2, w, h);
      right -= w + CONFIG.goGap;
    }

    if (goImg && goImg.width) {
      const h = CONFIG.goH;
      const w = (goImg.width / goImg.height) * h;
      ctx.drawImage(goImg, right - w, CONFIG.goY - h / 2, w, h);
    } else {
      // Fallback to the fallback — see the note above.
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.font = this._font(CONFIG.goH * 0.8);
      ctx.fillStyle = CONFIG.hudColor;
      ctx.fillText('GO!', right, CONFIG.goY);
    }
    ctx.restore();
  }

  /** A full-screen card: a dimmed screen with a line or two over it.
   *
   *  It drew the death card until 2026-08-21, when dying got a real panel
   *  (`game-over.js`) instead, and was kept on the argument that it was the
   *  obvious tool for a pause screen this game did not have yet. THE PAUSE
   *  SCREEN ARRIVED and this is what draws it -- one caller, in game.js.
   *
   *  ⚠️ IT IS PLAIN CANVAS TEXT, not the hand-drawn letter pack, so it will set
   *  any string it is handed. That is why the pause card can grow a DEV MODE ON
   *  line without a glyph being cut for it. */
  /**
   * The DEV MODE marker.
   *
   * Small, permanent and in the corner, because the only job it has is to stop
   * a forgotten flag being mistaken for a balance problem. A build where every
   * punch does 50 looks broken rather than switched on, and by then the person
   * looking at it is usually not the person who left it on.
   */
  /**
   * `props` is the live collection, and it is COUNTED FROM THE LIST THE GAME
   * DRAWS FROM -- not from CONFIG.
   *
   * ⚠️ THAT DISTINCTION IS THE WHOLE POINT OF PUTTING IT HERE. Counting the
   * config would answer "what did I write down", which is the question that has
   * already been answered every time this is asked; the useful question is
   * "what is actually in the room right now", and the two differ for real
   * reasons -- a barrel that has been smashed is gone from the list, and a
   * chicken that came OUT of one was never in the config at all. Same rule as
   * the debug overlay: read from the code the game runs, or the readout is just
   * a second opinion about a file. See STATE.md on verifiable views.
   */
  drawDev(ctx, roomName, props) {
    if (!(CONFIG.DEV && CONFIG.DEV.on)) return;
    ctx.save();
    ctx.font = '700 14px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    let tally = '';
    if (props) {
      let barrels = 0, placedFood = 0, dropped = 0;
      for (const o of props.all()) {
        if (o.kind === 'barrel') barrels++;
        else if (o.fromBarrel) dropped++;
        else placedFood++;
      }
      tally = '  ·  ' + barrels + ' barrels  ' + placedFood + '+' + dropped + ' food';
    }
    // The room is on the marker because the number keys can change it, and a
    // dev who has jumped rooms should not have to guess which one they are in.
    /* `null` is a real setting, not a missing one -- it is how a dev session
       keeps the room jumps while leaving the damage table alone (see the note
       in CONFIG.DEV). Printing it as "null dmg" made that look like a bug. */
    const dmg = CONFIG.DEV.punchDamage == null ? 'real' : CONFIG.DEV.punchDamage;
    const label = 'DEV  ' + dmg + ' dmg'
      + (roomName ? '  ·  ' + roomName + '  (1-9 to jump)' : '') + tally;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillText(label, CONFIG.GAME_W - 9, 9);
    ctx.fillStyle = '#E4463A';
    ctx.fillText(label, CONFIG.GAME_W - 10, 8);
    ctx.restore();
  }

  /**
   * THE CLEAR BOARD: the run, counted up a row at a time.
   *
   * `t` is seconds since the board appeared, and EVERYTHING IS DERIVED FROM IT
   * rather than stepped — no row holds its own progress, nothing accumulates.
   * That is what makes `skip` a single number: setting the clock past the end
   * finishes the tally exactly as if it had run, with no state to reconcile.
   *
   * ⚠️ THE ROWS ROLL FROM ZERO, WHICH MEANS THE LAST ROW IS THE SLOWEST THING
   * ON SCREEN. A board of seven rows at `rowMs` each, staggered by
   * `rowStaggerMs`, is over in about two seconds — worth keeping it there. Long
   * enough to watch, short enough that nobody reaches for the button; the tally
   * is a reward, and a reward that outstays its welcome becomes a loading bar.
   *
   * Rows are drawn as a LABEL COLUMN and a VALUE COLUMN, left and right aligned
   * against two x positions rather than centred as one string — centring makes
   * the numbers wander as they grow, and a column of digits that shifts while it
   * counts is unreadable.
   */
  drawResults(ctx, stats, t, alpha) {
    const R = CONFIG.RESULTS;
    const rows = stats.rows();
    const W = CONFIG.GAME_W;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = 'rgba(0,0,0,0.78)';
    ctx.fillRect(0, 0, W, CONFIG.GAME_H);

    ctx.fillStyle = CONFIG.hudColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    /* THE END CARD, AND IT IS TWO LINES IN TWO LANGUAGES ON PURPOSE. It used to
       be the single word CLEAR; it was asked to be "obrigado por jogar THANK
       YOU". The English half stays English -- that pairing is the same one the
       flying dungeon's finale uses, and it is the ONE thing on this board that
       is deliberately not Portuguese. */
    const L = R.LABELS || {};
    ctx.font = this._font(R.titleSize || 54, 900);
    ctx.fillText(L.thanks || '', W / 2, R.titleY);
    if (L.thanks2) {
      ctx.font = this._font(R.subTitleSize || 26, 'bold');
      ctx.globalAlpha = alpha * 0.8;
      ctx.fillText(L.thanks2, W / 2, R.titleY + (R.subTitleGap || 40));
      ctx.globalAlpha = alpha;
    }

    const ease = (p) => 1 - Math.pow(1 - p, 3);       // fast, then settling
    let y = R.rowsY;
    rows.forEach((row, i) => {
      const start = (i * R.rowStaggerMs) / 1000;
      const p = Math.max(0, Math.min(1, (t - start) / (R.rowMs / 1000)));
      if (p <= 0) { y += R.rowStep + (row.note ? R.noteStep : 0); return; }

      // The row itself fades in over its first fifth, so it arrives rather than
      // appearing — the count-up is already carrying the eye.
      ctx.globalAlpha = alpha * Math.min(1, p * 5);
      ctx.font = this._font(R.rowSize, 'bold');
      ctx.textAlign = 'left';
      ctx.fillStyle = CONFIG.hudColor;
      ctx.fillText(row.label, R.labelX, y);

      ctx.textAlign = 'right';
      const shown = row.value == null ? 0 : row.value * ease(p);
      /* A ROLLING NUMBER MUST NOT LAND SHORT. `ease` reaches 1 exactly, but the
         value is rounded for display all the way up, so the final frame has to
         be the real figure and not a rounding of it. */
      ctx.fillText(row.text(p >= 1 ? row.value : Math.round(shown)), R.valueX, y);
      y += R.rowStep;

      /* ⚠️ NO ROW SUPPLIES A `note` SINCE 2026-08-27. The DOWNED row carried the
         roll-call of who was beaten -- "DUDU x7   DIDI x5" -- and it was taken
         off the board on request. The mechanism is kept because putting the line
         back is one field in `Stats.rows()`, and because a future row may want
         a second line under it. Nothing here is dead by accident.

         ⚠️ IT COSTS THE BOARD NOTHING WHILE UNUSED: `_resultsTimes` reads
         `rows().length`, which the note never contributed to, so the tally runs
         to exactly the same clock as before. */
      if (row.note) {
        ctx.font = this._font(R.noteSize, 'bold');
        ctx.globalAlpha = alpha * Math.min(1, p * 5) * 0.72;
        ctx.textAlign = 'right';
        ctx.fillText(row.note, R.valueX, y);
        y += R.noteStep;
      }
    });

    /* THE RANK IS STAMPED, NOT ROLLED, and it lands after every number is in.
       It is the one line that judges the run, so it has to arrive as a verdict
       on figures the player has already read — rolling it alongside them would
       make it just another statistic. */
    const { stampAt, promptAt } = this._resultsTimes(stats);
    const sp = Math.max(0, Math.min(1, (t - stampAt) / (R.rankMs / 1000)));
    if (sp > 0) {
      const letter = stats.rank();
      ctx.globalAlpha = alpha * Math.min(1, sp * 3);
      ctx.textAlign = 'center';
      ctx.save();
      ctx.translate(W / 2, R.rankY);
      // Overshoot and settle: 1.6x down to 1. A stamp that scales up from
      // nothing reads as a fade; one that comes down onto the board reads as a
      // stamp, and that is the whole difference.
      ctx.scale(1 + 0.6 * (1 - ease(sp)), 1 + 0.6 * (1 - ease(sp)));
      ctx.fillStyle = R.rankColors[letter] || CONFIG.hudColor;
      ctx.font = this._font(R.rankSize, 900);
      ctx.fillText(letter, 0, 0);
      ctx.font = this._font(R.rowSize * 0.8, 'bold');
      ctx.fillText(L.rank || '', 0, -R.rankSize * 0.62);
      ctx.restore();

      if (CONFIG.DEV && CONFIG.DEV.on) {
        ctx.globalAlpha = alpha * 0.8;
        ctx.fillStyle = '#E4463A';
        ctx.font = this._font(16, 'bold');
        ctx.fillText(L.dev || '', W / 2, R.rankY + 54);
      }
    }

    if (t >= promptAt) {
      ctx.globalAlpha = alpha * (0.55 + 0.45 * Math.abs(Math.sin(t * 2.2)));
      ctx.fillStyle = CONFIG.hudColor;
      ctx.textAlign = 'center';
      ctx.font = this._font(22, 'bold');
      ctx.fillText(L.prompt || '', W / 2, CONFIG.GAME_H - 46);
    }
    ctx.restore();
  }

  /**
   * The board's two moments, in seconds on its own clock.
   *
   * ⚠️ ONE SOURCE FOR BOTH, AND THE SHELL READS THE SAME ONE. `promptAt` is
   * when the board is finished and asks to be dismissed, and it is ALSO the
   * shell's test for whether a press should skip the tally or restart the game.
   * Computed separately they drift, and the gap between them is a window where
   * the board says "press anything" and then eats the press — which is exactly
   * the bug this replaced: 150ms of a visible prompt doing nothing.
   *
   * `stampAt` is measured from the last row FINISHING; the last row starts at
   * (n-1) staggers in, not n, so counting a stagger per row put an extra beat
   * of silence in front of the rank and made `rankDelayMs` mean 410 when it
   * said 260.
   */
  _resultsTimes(stats) {
    const R = CONFIG.RESULTS;
    const stampAt = ((stats.rows().length - 1) * R.rowStaggerMs + R.rowMs
                     + R.rankDelayMs) / 1000;
    return { stampAt, promptAt: stampAt + R.rankMs / 1000 + 0.35 };
  }

  /** When the board is finished: the shell's skip-or-restart line. */
  resultsRunS(stats) { return this._resultsTimes(stats).promptAt; }

  /**
   * When the last NUMBER lands -- which is not when the board finishes.
   *
   * ⚠️ THREE MOMENTS, NOT TWO, AND THIS IS THE FIRST. The numbers stop rolling,
   * then `rankDelayMs` later the rank is stamped, then the prompt arrives. The
   * count-up SOUND has to end here and not at either of the others: ticking
   * through the beat before the stamp would fill the silence that makes the
   * stamp land, and `resultsRunS` is half a second further still.
   *
   * Derived from `_resultsTimes` rather than re-multiplied, so the tick and the
   * drawing can never disagree about when the numbers stopped.
   */
  resultsRollS(stats) {
    return this._resultsTimes(stats).stampAt - CONFIG.RESULTS.rankDelayMs / 1000;
  }

  /**
   * A wash over the world with a word on it. The PAUSE screen is its only
   * caller.
   *
   * `dim` is how black the wash is, 0..1. It defaults to the 0.72 this was
   * written with, so the number is a parameter rather than a new meaning for
   * `alpha` -- `alpha` fades the WHOLE card in and out and the two are not the
   * same knob.
   */
  drawCard(ctx, lines, alpha, color, dim) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = 'rgba(0,0,0,' + (dim != null ? dim : 0.72) + ')';
    ctx.fillRect(0, 0, CONFIG.GAME_W, CONFIG.GAME_H);
    ctx.fillStyle = color || CONFIG.hudColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const cy = CONFIG.GAME_H / 2;
    lines.forEach((ln, i) => {
      const big = i === 0;
      ctx.font = this._font(big ? 92 : 26, big ? 900 : 'bold');
      ctx.fillText(ln, CONFIG.GAME_W / 2, cy + (i === 0 ? -20 : 60 + (i - 1) * 34));
    });
    ctx.restore();
  }

  /* The debug boxes USED TO LIVE HERE and have moved to src/debug.js, which owns
     the whole C-key overlay.

     The version that was here drew the attack box at `box.z0` as a screen Y,
     when everything on the belt lives at `beltTopY + z` — so the hitbox floated
     ~430px above the fighter throwing it, looking like an unrelated red square
     at the top of the map. Two debug drawers in two files was how a bug like
     that survived: the hurtbox right beside it converted correctly. */
}
