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
  constructor() { this.flashT = 0; }

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
       cannot drift from the one the results board prints. He is LEBRON. */
    const me = (CONFIG.CHARACTERS && CONFIG.CHARACTERS.coconut) || {};
    ctx.fillText(me.name || '', box.x, box.y + box.h + 4);
    ctx.textAlign = 'right';
    ctx.fillText('x' + Math.max(0, player.lives - 1), box.x + box.w, box.y + box.h + 4);
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

  /**
   * "GO [hand]" — shown when an arena clears and the way forward opens.
   *
   * The hand is the main game's own pointing cursor (assets/intro-hand.png),
   * reused rather than redrawn. It already points right, so it is drawn as it
   * comes with no flip.
   *
   * BOTH PIECES ARE HAND-DRAWN ART off the same title sheet — no typeface is
   * involved. A geometric sans "GO" next to a hand-inked hand read as two
   * different games sharing a corner of the screen.
   *
   * EACH PIECE IS INDEPENDENTLY OPTIONAL, and the layout closes up around
   * whichever is missing. If the lettering fails to load the prompt falls back
   * to drawn text; if the hand fails, the word stands alone. A prompt that
   * vanished entirely because one PNG 404'd would strand the player in a
   * cleared arena with no idea the game was waiting for them to walk on.
   */
  drawGo(ctx, t, goImg, handImg) {
    if (t <= 0) return;
    const a = Math.min(1, t / (CONFIG.goFadeMs / 1000));
    // Horizontal, so the prompt nudges toward the exit rather than bouncing.
    const bob = Math.sin(t * CONFIG.goBobFreq) * CONFIG.goBobAmp;
    let right = CONFIG.GAME_W - CONFIG.goMarginRight + bob;

    ctx.save();
    ctx.globalAlpha = a;

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
      // Fallback only — see the note above.
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
   *  ⚠️ NOTHING CALLS THIS ANY MORE. It drew the death card until 2026-08-21,
   *  when dying got a real panel (`game-over.js`) instead. Kept because it is
   *  the obvious tool for a pause screen, which this game does not have yet --
   *  delete it if that never happens rather than leaving it to rot. */
  /**
   * The DEV MODE marker.
   *
   * Small, permanent and in the corner, because the only job it has is to stop
   * a forgotten flag being mistaken for a balance problem. A build where every
   * punch does 50 looks broken rather than switched on, and by then the person
   * looking at it is usually not the person who left it on.
   */
  drawDev(ctx, roomName) {
    if (!(CONFIG.DEV && CONFIG.DEV.on)) return;
    ctx.save();
    ctx.font = '700 14px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    // The room is on the marker because the number keys can change it, and a
    // dev who has jumped rooms should not have to guess which one they are in.
    const label = 'DEV  ' + CONFIG.DEV.punchDamage + ' dmg'
      + (roomName ? '  ·  ' + roomName + '  (1-9 to jump)' : '');
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

  drawCard(ctx, lines, alpha, color) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = 'rgba(0,0,0,0.72)';
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
