/**
 * Debug — everything the C key draws.
 *
 * READ THIS BEFORE JUDGING A BOX'S POSITION BY EYE.
 *
 * Collision in this game happens ENTIRELY IN THE (x, z) FLOOR PLANE. Nothing
 * has a height. A hurtbox is a FOOTPRINT around a fighter's feet, and a hitbox
 * is a footprint reaching forward from them — so drawn over the side view they
 * both sit at ankle level while the sprite towers 152px above, and a CORRECT box
 * looks wrong. That is a property of the projection, not of the box.
 *
 * Which is why the authority here is THE PLAN VIEW, top-left: x across, z down,
 * every box drawn as the true rectangle the resolver actually tests, at one
 * uniform scale so an overlap on screen is an overlap in the maths. The side-on
 * boxes are an orientation aid; the plan is what a disagreement gets settled by.
 *
 * And because five of the conditions on a hit have no geometry at all, there is
 * a CONDITION READOUT under the plan naming which one failed:
 *
 *     connect = overlap in x
 *               AND overlap in z
 *               AND |attacker.jumpY - target.jumpY| < verticalReach
 *               AND the target is vulnerable (not inside its i-frames)
 *               AND this swing has not already hit (hasHit) — one punch, one person
 *               AND it is the CLOSEST overlapping target
 *
 * EVERY BOX DRAWN HERE COMES FROM THE SAME FUNCTION THE RESOLVER CALLS.
 * `debugHitbox()` and `hitbox()` both return `_attackGeom()`, and the tests
 * below are the same comparisons Combat makes. An overlay that draws a box other
 * than the one being tested is worse than no overlay, because it is believed.
 *
 * Z IS NOT SCREEN Y. On the belt everything lives at `beltTopY + z`. Drawing
 * a box at its raw z puts it ~430px too high — the bug that made the attack box
 * float at the top of the map, apparently unrelated to the fighter throwing it.
 */
const DBG = {
  walk:   'rgba(90,190,255,0.85)',
  nowalk: 'rgba(255,120,220,0.95)',  // where the player CANNOT stand
  air:    'rgba(150,175,210,0.70)',  // right place, WRONG HEIGHT — cannot connect
  plate:  'rgba(255,120,220,0.9)',
  body:   'rgba(90,190,255,0.95)',
  wind:   'rgba(255,190,60,0.9)',
  live:   'rgba(255,70,70,1)',
  spent:  'rgba(150,150,150,0.75)',
  recov:  'rgba(150,110,110,0.7)',
  hit:    'rgba(90,255,120,1)',
  iframe: 'rgba(255,255,255,0.55)',
  panel:  'rgba(0,0,0,0.78)',
  text:   '#dff',
  dim:    '#8aa',
  fail:   '#f88',
  pass:   '#8f8',
};

class Debug {
  static sx(x, camX) { return x - camX; }
  static sy(z) { return Belt.topY + z; }

  /**
   * The NAME of the knob that governs this room's belt, for the overlay labels.
   *
   * ⚠️ A DEBUG LABEL THAT NAMES THE WRONG KNOB IS WORSE THAN NO LABEL, because
   * it is followed. The belt is per room as of 2026-08-27: a room may declare
   * its own `belt` (the desert does -- 380 deep against the default 190) and
   * everything else falls back to CONFIG. Editing `CONFIG.beltDepth` while
   * standing in the desert changes nothing and looks like the overlay lying.
   *
   * Read off the same room `Belt` was set from, so the label and the band it is
   * pointing at cannot disagree.
   */
  static beltKnob(stage, field) {
    const r = stage && stage.room && stage.room();
    if (r && r.belt && r.belt[field] != null) {
      return `ROOMS[${stage.roomIndex}].belt.${field}`;
    }
    return field === 'topY' ? 'CONFIG.beltTopY' : 'CONFIG.beltDepth';
  }

  render(ctx, all, stage, backdrop, camX) {
    ctx.save();
    ctx.font = '11px monospace';
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    ctx.lineWidth = 1.5;

    const live = all.filter(f => f && !(f.dead && f.downPhase === 'lie'));
    const plate = this._plateInfo(ctx, backdrop, camX);
    this._noWalk(ctx, stage, camX);
    this._walkable(ctx, stage, camX);
    this._sideBoxes(ctx, live, camX);

    /* The player is the reference for "can this be reached". The plan view drops
       the y axis, so every box in it needs marking relative to somebody — and
       the only question a dev is actually asking of that view is "could I hit
       that". `live[0]` is the player: render() is handed [player, ...crowd, boss]. */
    const planBottom = this._plan(ctx, live, live[0], stage, camX);
    this._conditions(ctx, live, planBottom);
    this._legend(ctx, stage, plate);
    ctx.restore();
  }

  /* ===== The plate ======================================================== */

  /**
   * THE PLATE IS THE WHOLE BACKGROUND PICTURE, not the strip above the belt.
   * It is the painted (later filmed) image that fills the entire frame, and the
   * walkable lane is a band drawn ON TOP of it — so the plate always ENCLOSES
   * the blue area rather than sitting above it. There is no "region the player
   * cannot walk in" as a thing the game models: the belt is a band, and
   * everything outside it is simply picture.
   *
   * Which is why this no longer outlines it. A dashed rectangle around the whole
   * canvas every frame is pure noise that says "the background is the
   * background", and it read as floating junk near the top of the screen. The
   * only fact worth surfacing is WHETHER IT COVERS THE FRAME — a plate falling
   * short shows the clear colour through, which is near-invisible against dark
   * art — so the numbers go in the legend panel and the overlay draws something
   * ONLY when there is a gap, in which case it fills the uncovered band.
   *
   * Returns the lines for the legend.
   */
  _plateInfo(ctx, backdrop, camX) {
    const out = [];
    if (!backdrop) return out;
    for (const layer of CONFIG.LAYERS) {
      if (layer.entities || layer.on === false || !layer.source) continue;
      const b = backdrop.layerBounds(layer, camX, CONFIG.GAME_W, CONFIG.GAME_H);
      if (!b) {
        out.push({ text: `${layer.name}: NOT LOADED — nothing drawn`, ok: false });
        continue;
      }
      const top = b.y, bot = b.y + b.h;
      const covers = top <= 0 && bot >= CONFIG.GAME_H;
      out.push({
        text: `${layer.name} @${layer.parallax} y${Math.round(top)}..${Math.round(bot)} ` +
              (covers ? 'covers frame' : 'GAP'),
        ok: covers,
      });
      if (covers) continue;

      // The uncovered band(s), filled loudly — this is the actionable case.
      ctx.save();
      ctx.fillStyle = 'rgba(255,120,220,0.30)';
      ctx.strokeStyle = DBG.plate;
      if (top > 0) {
        ctx.fillRect(0, 0, CONFIG.GAME_W, top);
        ctx.strokeRect(0.5, 0.5, CONFIG.GAME_W - 1, top - 1);
        ctx.fillStyle = DBG.plate;
        ctx.fillText(`${layer.name}: ${Math.round(top)}px UNCOVERED`, 8, 4);
      }
      if (bot < CONFIG.GAME_H) {
        ctx.fillStyle = 'rgba(255,120,220,0.30)';
        ctx.fillRect(0, bot, CONFIG.GAME_W, CONFIG.GAME_H - bot);
        ctx.strokeRect(0.5, bot + 0.5, CONFIG.GAME_W - 1, CONFIG.GAME_H - bot - 1);
        ctx.fillStyle = DBG.plate;
        ctx.fillText(`${layer.name}: ${Math.round(CONFIG.GAME_H - bot)}px UNCOVERED`, 8, bot + 4);
      }
      ctx.restore();
    }
    return out;
  }

  /* ===== The NO-WALK region =============================================== */

  /**
   * MAGENTA = EVERYWHERE THE PLAYER CANNOT STAND. The complement of the
   * walkable band within the frame: the strip above the belt, the strip below
   * it, and anything outside the segment's walls.
   *
   * This is what the magenta is FOR. It used to outline the backdrop plate,
   * which was the whole canvas and therefore said nothing. Marking the forbidden
   * region instead makes the belt's size directly negotiable by eye — you can
   * look at a band and say "eat 100px of that into the belt", and the labels
   * name the exact knob that does it.
   *
   * THE TWO BANDS ARE GOVERNED BY DIFFERENT NUMBERS, which is why they are
   * labelled separately rather than as one "no-walk" area:
   *
   *     top band     ends at  topY                  — LOWER topY to eat it
   *     bottom band  starts at topY + depth         — RAISE depth to eat it
   *
   * So "make the belt 100px taller" is two different edits depending on which
   * edge is meant to move, and this makes which one obvious before the change
   * rather than after.
   *
   * ⚠️ AND THE LABEL NAMES THE KNOB THAT ACTUALLY GOVERNS THIS ROOM. Since
   * 2026-08-27 the belt is per room (see belt.js) -- the desert's is double the
   * street's -- so an overlay hard-coded to say "beltTopY" would send the reader
   * to a CONFIG line that has no effect on the room they are looking at. It
   * reads the same room the geometry does; see beltKnob().
   *
   * Drawn with an even-odd fill — the whole canvas, minus the walkable rect —
   * so the two can never disagree about where the boundary is.
   */
  _noWalk(ctx, stage, camX) {
    const b = stage.bounds();
    const x0 = Debug.sx(b.minX, camX), x1 = Debug.sx(b.maxX, camX);
    const y0 = Debug.sy(0), y1 = Debug.sy(Belt.depth);

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, CONFIG.GAME_W, CONFIG.GAME_H);
    ctx.rect(x0, y0, x1 - x0, y1 - y0);
    ctx.fillStyle = 'rgba(255,120,220,0.20)';
    ctx.fill('evenodd');

    ctx.strokeStyle = DBG.nowalk;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(0, y0); ctx.lineTo(CONFIG.GAME_W, y0);
    ctx.moveTo(0, y1); ctx.lineTo(CONFIG.GAME_W, y1);
    ctx.stroke();
    ctx.setLineDash([]);

    // The measurements, at the edge each one governs.
    ctx.fillStyle = DBG.nowalk;
    ctx.fillText(`NO-WALK  ${Math.round(y0)}px tall  ` +
                 `— ${Debug.beltKnob(stage, 'topY')} ${Belt.topY}, ` +
                 `lower it to eat into this`,
                 12, Math.max(2, y0 - 15));
    const below = CONFIG.GAME_H - y1;
    ctx.fillText(`NO-WALK  ${Math.round(below)}px tall  ` +
                 `— ${Debug.beltKnob(stage, 'depth')} ${Belt.depth}, ` +
                 `raise it to eat into this`,
                 12, y1 + 6);
    ctx.restore();
  }

  /* ===== The walkable region ============================================== */

  /** The belt (z 0..beltDepth) crossed with the segment's walls. */
  _walkable(ctx, stage, camX) {
    const b = stage.bounds();
    const x0 = Debug.sx(b.minX, camX), x1 = Debug.sx(b.maxX, camX);
    const y0 = Debug.sy(0), y1 = Debug.sy(Belt.depth);

    ctx.save();
    ctx.fillStyle = 'rgba(90,190,255,0.07)';
    ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    ctx.strokeStyle = DBG.walk;
    ctx.strokeRect(x0 + 0.5, y0 + 0.5, x1 - x0 - 1, y1 - y0 - 1);
    ctx.fillStyle = DBG.walk;
    ctx.fillText('z=0 FAR', Math.max(4, x0 + 5), y0 + 3);
    ctx.fillText(`z=${Belt.depth} NEAR`, Math.max(4, x0 + 5), y1 - 13);
    ctx.setLineDash([4, 4]);
    for (const [wx, label] of [[x0, 'minX'], [x1, 'maxX']]) {
      if (wx < -30 || wx > CONFIG.GAME_W + 30) continue;
      ctx.beginPath();
      ctx.moveTo(wx, 0); ctx.lineTo(wx, CONFIG.GAME_H);
      ctx.stroke();
      ctx.fillText(label, wx + 3, y1 + 6);
    }
    ctx.restore();
  }

  /* ===== Side-on boxes (orientation only — the plan is the authority) ===== */

  _sideBoxes(ctx, all, camX) {
    const ref = all[0];      // the player — see the note in _plan()
    for (const f of all) {
      const dy = ref ? (f.jumpY || 0) - (ref.jumpY || 0) : 0;
      const reachable = Math.abs(dy) <= CONFIG.verticalReach;
      const x = Debug.sx(f.x, camX), y = Debug.sy(f.z);
      const hw = f.halfW(), hz = f.halfZ();
      ctx.save();
      /* The OWNERSHIP CONNECTOR. Without it the footprint reads as a stray
         rectangle near somebody's feet; the line ties it to the body it belongs
         to. Faint and thin because the collision is the FOOTPRINT — the column
         is not a hitbox and must not look like one. */
      ctx.strokeStyle = 'rgba(255,255,255,0.18)';
      ctx.setLineDash([2, 3]);
      ctx.beginPath();
      ctx.moveTo(x, y - f.jumpY - (f.bodyHeight ? f.bodyHeight() * 0.5 : 60));
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.setLineDash([]);

      // Dashed and dimmed when the heights do not line up — same meaning as in
      // the plan view, so one convention covers both.
      const canHit = f.vulnerable();
      ctx.strokeStyle = !reachable ? DBG.air : canHit ? DBG.body : DBG.iframe;
      if (!canHit || !reachable) ctx.setLineDash([3, 3]);
      ctx.strokeRect(x - hw, y - hz, hw * 2, hz * 2);
      if (f !== ref && !reachable) {
        ctx.fillStyle = DBG.air;
        ctx.fillText(`${dy > 0 ? '+' : ''}${Math.round(dy)}y out of reach`, x + hw + 4, y - 5);
      }
      ctx.restore();

      const g = f.debugHitbox && f.debugHitbox();
      if (!g) continue;
      const col = g.phase === 'startup' ? DBG.wind
        : g.spent ? DBG.spent : g.live ? DBG.live : DBG.recov;
      ctx.save();
      ctx.strokeStyle = col;
      ctx.lineWidth = g.live ? 2 : 1.5;
      if (g.phase === 'startup') ctx.setLineDash([5, 4]);
      ctx.strokeRect(Debug.sx(g.x0, camX), Debug.sy(g.z0), g.x1 - g.x0, g.z1 - g.z0);
      ctx.restore();
    }
  }

  /* ===== THE PLAN VIEW — the authority =================================== */

  /**
   * The belt seen from above: x across, z down, one uniform scale.
   *
   * This is the only view in which the two axes a hit is actually tested on are
   * both undistorted, so it is the one to trust. An overlap here IS an overlap
   * in the resolver.
   */
  _plan(ctx, all, ref, stage, camX) {
    const b = stage.bounds();
    const PX = 22, PY = 112, PW = 430, HEAD = 15;

    /* THE SCALE IS ANCHORED TO THE CAMERA'S VIEW, NOT TO stage.bounds().
       It used to divide PW by the bounds' width, and the panel visibly GREW
       TALLER as the player walked — because in a scroll segment `maxX` is
       `levelEndX` (4000), so the span shrinks from ~3960 to ~1240 on approach
       and the scale, and therefore the height, climbed with it. In an arena the
       span is a constant 1200 and it looked fine, which is why it only misbehaved
       "at certain places".

       Drawing 4000px of level into a 430px strip was never useful anyway. The
       window is now the 1280px the camera is showing, so the scale is CONSTANT,
       the panel never changes size, and the plan is a true overhead of exactly
       what is on screen. The walls are drawn where they fall inside it. */
    const spanX = CONFIG.GAME_W;
    const s = PW / spanX;
    const PH = Belt.depth * s;

    const px = wx => PX + (wx - camX) * s;
    const pz = z => PY + HEAD + z * s;

    ctx.save();
    ctx.fillStyle = DBG.panel;
    ctx.fillRect(PX - 6, PY - 4, PW + 12, PH + HEAD + 14);
    ctx.fillStyle = DBG.text;
    ctx.fillText(`PLAN VIEW  x -> ,  z (depth) v   scale ${s.toFixed(3)}  (camera view)`, PX, PY);

    // Everything below is clipped to the panel, so a fighter outside the view —
    // an enemy still walking in, the boss on its overrun — cannot paint over the
    // rest of the HUD.
    ctx.beginPath();
    ctx.rect(PX, PY + HEAD, PW, PH);
    ctx.clip();

    // The belt band, and the walls where they fall inside the view.
    ctx.strokeStyle = DBG.walk;
    ctx.strokeRect(PX + 0.5, PY + HEAD + 0.5, PW - 1, PH - 1);
    ctx.fillStyle = 'rgba(90,190,255,0.10)';
    const wx0 = Math.max(PX, px(b.minX)), wx1 = Math.min(PX + PW, px(b.maxX));
    if (wx1 > wx0) ctx.fillRect(wx0, PY + HEAD, wx1 - wx0, PH);
    ctx.strokeStyle = DBG.walk;
    ctx.setLineDash([3, 3]);
    for (const wx of [px(b.minX), px(b.maxX)]) {
      if (wx < PX || wx > PX + PW) continue;
      ctx.beginPath();
      ctx.moveTo(wx, PY + HEAD); ctx.lineTo(wx, PY + HEAD + PH);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    /* Hurtboxes.
     *
     * A PLAN VIEW DROPS THE Y AXIS, so a fighter hovering out of reach draws
     * in exactly the same place as one standing next to you — which is why the
     * Mosca Boss looked hittable while it hovered and wasn't. Anything whose
     * altitude puts it outside the reference fighter's `verticalReach` is drawn
     * DASHED AND DIMMED, with the height difference printed. Dashed here means
     * "the geometry lines up but the heights do not — this cannot connect".
     *
     * Measured against the player, because "could I hit that" is the only
     * question this view is ever asked. */
    for (const f of all) {
      const hw = f.halfW() * s, hz = f.halfZ() * s;
      const dy = ref ? (f.jumpY || 0) - (ref.jumpY || 0) : 0;
      const reachable = Math.abs(dy) <= CONFIG.verticalReach;

      ctx.strokeStyle = !reachable ? DBG.air
        : f.vulnerable() ? DBG.body : DBG.iframe;
      ctx.setLineDash(!reachable ? [3, 3] : f.vulnerable() ? [] : [2, 2]);
      ctx.strokeRect(px(f.x) - hw, pz(f.z) - hz, hw * 2, hz * 2);
      ctx.setLineDash([]);

      // The altitude the plan cannot show — printed rather than implied, and
      // only when it is actually doing something.
      if (f !== ref && !reachable) {
        ctx.fillStyle = DBG.air;
        ctx.fillText(`${dy > 0 ? '+' : ''}${Math.round(dy)}y`,
                     px(f.x) + hw + 3, pz(f.z) - 5);
      } else if (f.jumpY > 1) {
        ctx.fillStyle = DBG.dim;
        ctx.fillText('y' + Math.round(f.jumpY), px(f.x) + hw + 3, pz(f.z) - 5);
      }
    }

    // Hitboxes, and the overlaps that are genuinely connecting.
    for (const f of all) {
      const g = f.debugHitbox && f.debugHitbox();
      if (!g) continue;
      const col = g.phase === 'startup' ? DBG.wind
        : g.spent ? DBG.spent : g.live ? DBG.live : DBG.recov;
      ctx.strokeStyle = col;
      ctx.lineWidth = g.live ? 2 : 1;
      if (g.phase === 'startup') ctx.setLineDash([4, 3]);
      ctx.strokeRect(px(g.x0), pz(g.z0), (g.x1 - g.x0) * s, (g.z1 - g.z0) * s);
      ctx.setLineDash([]);
      ctx.lineWidth = 1.5;

      if (!g.live) continue;
      for (const t of all) {
        if (t === f || !this._connects(f, t, g)) continue;
        const ox0 = Math.max(g.x0, t.x - t.halfW()), ox1 = Math.min(g.x1, t.x + t.halfW());
        const oz0 = Math.max(g.z0, t.z - t.halfZ()), oz1 = Math.min(g.z1, t.z + t.halfZ());
        ctx.fillStyle = 'rgba(90,255,120,0.45)';
        ctx.fillRect(px(ox0), pz(oz0), (ox1 - ox0) * s, (oz1 - oz0) * s);
        ctx.strokeStyle = DBG.hit;
        ctx.strokeRect(px(ox0), pz(oz0), (ox1 - ox0) * s, (oz1 - oz0) * s);
      }
    }
    ctx.restore();
    return PY + PH + HEAD + 18;
  }

  /** The resolver's own test, in one place, so the plan and the readout agree. */
  _connects(attacker, target, g) {
    if (!target.vulnerable()) return false;
    if (Math.abs((target.jumpY || 0) - (attacker.jumpY || 0)) > g.reachY) return false;
    return target.overlaps(g);
  }

  /* ===== The condition readout =========================================== */

  /**
   * Why a punch did or did not land, condition by condition.
   *
   * The geometry is only two of the six tests. This names the other four, which
   * is the difference between "the boxes look like they touched" and knowing
   * what the resolver decided.
   */
  _conditions(ctx, all, y) {
    const attacker = all.find(f => f.debugHitbox && f.debugHitbox());
    const X = 22, W = 430;

    ctx.save();
    const rows = attacker ? all.length : 1;
    ctx.fillStyle = DBG.panel;
    ctx.fillRect(X - 6, y - 4, W + 12, 20 + rows * 14 + 8);

    if (!attacker) {
      ctx.fillStyle = DBG.dim;
      ctx.fillText('no attack in progress — punch to see the hit test', X, y);
      ctx.restore();
      return;
    }

    const g = attacker.debugHitbox();
    ctx.fillStyle = DBG.text;
    ctx.fillText(
      `${attacker.kind} ${g.def ? g.def.pose : g.phase} — ${g.phase}` +
      (g.spent ? '  (SPENT: already hit)' : g.live ? '  (LIVE)' : '  (no hitbox this phase)') +
      // The two things about THIS blow that the boxes cannot show.
      `   reachY ${Math.round(g.reachY)}` + (g.def && g.def.sweep ? '  SWEEP' : ''),
      X, y);

    /* Closest connecting target wins — the last condition, and the only one
       that depends on the others' results.

       ⚠️ UNLESS THE DEF SWEEPS, in which case there is no "closest" and every
       connecting target is struck. Read straight off `g.def`, the same field
       the resolver branches on, so this cannot drift from it. Without this the
       overlay would report two of three enemies as "overlaps, but not closest"
       on the very move whose whole point is that it hits all three. */
    const sweep = !!(g.def && g.def.sweep);
    let best = null, bestD = Infinity;
    for (const t of all) {
      if (t === attacker || !this._connects(attacker, t, g)) continue;
      const d = Math.abs(t.x - attacker.x);
      if (d < bestD) { bestD = d; best = t; }
    }

    let row = 0;
    for (const t of all) {
      if (t === attacker) continue;
      const ly = y + 18 + row * 14;
      row++;
      const dx = (t.x - attacker.x), dz = (t.z - attacker.z);
      const dy = (t.jumpY || 0) - (attacker.jumpY || 0);
      const okX = g.x1 >= t.x - t.halfW() && g.x0 <= t.x + t.halfW();
      const okZ = g.z1 >= t.z - t.halfZ() && g.z0 <= t.z + t.halfZ();
      // ⚠️ OFF THE BOX, NOT OFF CONFIG. A def may raise its own vertical reach
      // (the air attack does), and an overlay reading the global would call a
      // hit a miss on exactly the move whose reach is unusual.
      const okY = Math.abs(dy) <= g.reachY;
      const okV = t.vulnerable();

      let verdict, col;
      if (!okX) { verdict = 'miss: x'; col = DBG.fail; }
      else if (!okZ) { verdict = `miss: DEPTH (dz ${dz.toFixed(0)})`; col = DBG.fail; }
      else if (!okY) { verdict = `miss: height (dy ${dy.toFixed(0)})`; col = DBG.fail; }
      else if (!okV) { verdict = 'miss: i-frames'; col = DBG.fail; }
      else if (g.spent) { verdict = 'blocked: swing spent'; col = DBG.spent; }
      else if (!g.live) { verdict = 'no hitbox yet'; col = DBG.wind; }
      else if (!sweep && t !== best) { verdict = 'overlaps, but not closest'; col = DBG.spent; }
      else { verdict = sweep ? 'CONNECTS (sweep)' : 'CONNECTS'; col = DBG.pass; }

      ctx.fillStyle = DBG.dim;
      ctx.fillText(`${t.kind.padEnd(9)} dx${dx.toFixed(0).padStart(5)} ` +
                   `dz${dz.toFixed(0).padStart(4)} dy${dy.toFixed(0).padStart(4)}`, X, ly);
      ctx.fillStyle = col;
      ctx.fillText(verdict, X + 210, ly);
    }
    ctx.restore();
  }

  /* ===== Legend ========================================================== */

  _legend(ctx, stage, plate) {
    const lines = [
      ['walkable belt', DBG.walk],
      ['NO-WALK — player blocked', DBG.nowalk],
      ['hurtbox — footprint on floor', DBG.body],
      ['i-frames: cannot be hit', DBG.iframe],
      ['dashed: wrong HEIGHT to hit', DBG.air],
      ['attack: winding up, no box', DBG.wind],
      ['attack: hitbox LIVE', DBG.live],
      ['attack: already connected', DBG.spent],
      ['attack: recovery', DBG.recov],
      ['CONNECTING overlap', DBG.hit],
    ];
    const info = plate || [];
    const w = 250, h = lines.length * 15 + 46 + info.length * 14;
    const x = CONFIG.GAME_W - w - 10, y = CONFIG.GAME_H - h - 10;
    ctx.save();
    ctx.fillStyle = DBG.panel;
    ctx.fillRect(x, y, w, h);
    const seg = stage.segment();
    ctx.fillStyle = DBG.text;
    ctx.fillText(`segment ${stage.index} ${seg ? seg.kind : 'end'}   camX ${Math.round(stage.camX)}`, x + 8, y + 7);
    // The DEFAULT band. A live attack whose def overrides it shows its own
    // number in the condition readout, which is where a specific blow is judged.
    ctx.fillText(`belt z 0..${Belt.depth}   vertical reach ${CONFIG.verticalReach} (default)`, x + 8, y + 22);
    /* The plate's status as TEXT rather than an outline — it fills the whole
       frame and encloses the walkable band, so a rectangle round it says nothing
       (see _plateInfo). Green when it covers, red plus a filled band on screen
       when it does not. */
    info.forEach((p, i) => {
      ctx.fillStyle = p.ok ? DBG.pass : DBG.fail;
      ctx.fillText(p.text, x + 8, y + 38 + i * 14);
    });
    lines.forEach((ln, i) => {
      const ly = y + 42 + info.length * 14 + i * 15;
      ctx.fillStyle = ln[1];
      ctx.fillRect(x + 8, ly + 2, 14, 7);
      ctx.fillStyle = DBG.text;
      ctx.fillText(ln[0], x + 28, ly);
    });
    ctx.restore();
  }
}
