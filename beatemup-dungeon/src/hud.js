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
    ctx.fillText('COCONUT', box.x, box.y + box.h + 4);
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

  /** A full-screen card: the two endings, and the pause. */
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
