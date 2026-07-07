/**
 * CharacterSelectScreen — the "SELECT FRUIT" screen, shown after START on the
 * intro and before gameplay begins.
 *
 * The art is a 3-frame looping idle (04 -> 05 -> 06 -> 04). Two pixel-aligned
 * versions of each frame exist: a GRAY base where every fruit is line-art, and
 * a COLORED twin. We always draw the gray base full-screen, then draw the
 * colored twin CLIPPED to the panel under the cursor — so only the highlighted
 * fruit lights up while the whole board keeps animating.
 *
 * update(dt) returns the chosen Player pack index once the player confirms
 * (else null); main.js loads the stage and calls player.setCharacter(pack).
 */
class CharacterSelectScreen {
    constructor(game) {
        this.game = game;

        // Native size of the select art (all six frames share it). Panel rects
        // below are expressed in this coordinate space.
        this.IMG_W = 866;
        this.IMG_H = 682;

        // Opaque content box inside that canvas (title + panels). The art is
        // right-of-centre with empty margins, so we fit/centre on THIS box, not
        // the full image — it centres the visible content and zooms in. Its
        // centre is what lands at the screen centre.
        this.CONTENT = { x: 148, y: 65, w: 657, h: 474 };
        this.fill = 0.9; // fraction of the screen the content box fills

        // The two aligned 3-frame loops. Index `frame` picks gray[frame]
        // everywhere and color[frame] inside the selected panel.
        this.grayFrames  = ['select_gray_1',  'select_gray_2',  'select_gray_3'];
        this.colorFrames = ['select_color_1', 'select_color_2', 'select_color_3'];
        this.frame = 0;
        this.frameTimer = 0;
        this.frameDur = 0.18; // seconds per frame

        // Panels left->right, in IMAGE coordinates. `pack` is the Player sprite
        // pack the panel selects (0=tomato, 1=coconut, 2=eggplant, 3=laranja).
        // Tuned in tools/fruit-select-editor.html (boxes hug the fruit frames,
        // clear of the "SELECT FRUIT" title band).
        this.panels = [
            { name: 'JUIXY', pack: 3, rect: { x: 163, y: 147, w: 212, h: 400 } }, // laranja (yellow)
            { name: 'ERKPA', pack: 2, rect: { x: 386, y: 147, w: 190, h: 400 } }, // eggplant (tan)
            { name: 'TOM',   pack: 0, rect: { x: 585, y: 147, w: 205, h: 400 } }, // tomato (red)
        ];
        this.cursor = 2; // start on TOM (tomato is the default pack)

        // Confirm ("lock-in") animation. While `confirming`, the idle loop
        // freezes and update() withholds the pick until the beat finishes:
        // a stamp pop on the chosen fruit + white flash + shake, fading to
        // black (which also hides the synchronous stage load). Timings in s.
        this.confirming = false;
        this.confirmT = 0;
        this.confirmDur = 0.55;
        this.stampDur = 0.40; // pop settle time
        this.shakeDur = 0.18;
        this.flashDur = 0.22;
        this.fadeDur = 0.20;  // trailing fade-to-black
        this.pickedPack = null;

        this._held = {};
    }

    // Overshoot ease (settles just past the target then back) — the stamp bounce.
    _easeOutBack(p) {
        const c1 = 1.70158, c3 = c1 + 1;
        return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2);
    }

    // Rising-edge detector so a held key fires exactly once, even when the
    // fixed-timestep loop runs several updates in one frame (mirrors IntroScreen).
    _edge(action) {
        const down = this.game.input.isKeyDown(action);
        const was = this._held[action] || false;
        this._held[action] = down;
        return down && !was;
    }

    // Advance the idle loop / confirm beat, move the cursor, and report a
    // confirmed pick once the lock-in animation has played out.
    update(dt) {
        // Lock-in beat: freeze the board, swallow input, hand off when done.
        if (this.confirming) {
            this.confirmT += dt;
            // Keep every edge fresh so a held key doesn't re-fire in gameplay.
            this._edge('lift'); this._edge('confirm'); this._edge('interact');
            this._edge('left'); this._edge('right');
            if (this.confirmT >= this.confirmDur) return this.pickedPack;
            return null;
        }

        this.frameTimer += dt;
        if (this.frameTimer >= this.frameDur) {
            this.frameTimer -= this.frameDur;
            this.frame = (this.frame + 1) % this.grayFrames.length;
        }

        const left  = this._edge('left');
        const right = this._edge('right');
        if (left)  this.cursor = (this.cursor + this.panels.length - 1) % this.panels.length;
        if (right) this.cursor = (this.cursor + 1) % this.panels.length;

        // Evaluate every confirm binding so each one's edge state stays current.
        const eLift    = this._edge('lift');
        const eConfirm = this._edge('confirm');
        const eInteract = this._edge('interact');
        if (eLift || eConfirm || eInteract) {
            this.confirming = true;
            this.confirmT = 0;
            this.pickedPack = this.panels[this.cursor].pack;
        }
        return null;
    }

    render(ctx) {
        const { width: W, height: H } = this.game;

        // Warm paper backdrop (the art is line-art on transparency).
        ctx.fillStyle = '#faf6ec';
        ctx.fillRect(0, 0, W, H);

        // Fit the CONTENT box to `fill` of the screen and centre it. The image
        // is drawn at scale `s` from origin (ox,oy); image point p maps to
        // screen (ox + p*s). We solve ox/oy so the content-box centre lands at
        // the screen centre. The same transform maps panel rects below.
        const c = this.CONTENT;
        const s = Math.min((W * this.fill) / c.w, (H * this.fill) / c.h);
        let ox = W / 2 - (c.x + c.w / 2) * s;
        let oy = H / 2 - (c.y + c.h / 2) * s;
        const dw = this.IMG_W * s, dh = this.IMG_H * s;

        // Confirm-beat parameters (all inert / defaults when not confirming).
        const t = this.confirmT;
        let popK = 1, flashA = 0;
        if (this.confirming) {
            const sp = Math.min(1, t / this.stampDur);
            popK = 1 + 0.25 * (1 - this._easeOutBack(sp)); // 1.25 -> ~1.0 bounce
            flashA = Math.max(0, 1 - t / this.flashDur) * 0.85;
            // Decaying screen shake, applied to the whole board.
            const amp = 9 * Math.max(0, 1 - t / this.shakeDur);
            ox += Math.sin(t * 82) * amp;
            oy += Math.cos(t * 71) * amp;
        }

        const gray = this.game.getImage(this.grayFrames[this.frame]);
        if (gray) ctx.drawImage(gray, ox, oy, dw, dh);

        // Light up the selected fruit: clip to its panel and draw the colored
        // twin of the same frame over the gray base. During the confirm beat the
        // fruit "stamps" — scaled about the panel centre but clipped to the
        // panel, so it swells inside its frame without bleeding into neighbours.
        const color = this.game.getImage(this.colorFrames[this.frame]);
        const p = this.panels[this.cursor];
        if (color && p) {
            const r = p.rect;
            const px = ox + r.x * s, py = oy + r.y * s, pw = r.w * s, ph = r.h * s;
            ctx.save();
            ctx.beginPath();
            ctx.rect(px, py, pw, ph);
            ctx.clip(); // fixed to the panel in screen space
            if (popK !== 1) {
                const cx = px + pw / 2, cy = py + ph / 2;
                ctx.translate(cx, cy);
                ctx.scale(popK, popK);
                ctx.translate(-cx, -cy);
            }
            ctx.drawImage(color, ox, oy, dw, dh);
            ctx.restore();
            // Flash over the panel (screen space, so it isn't warped by the pop
            // scale — the rect already matches the panel, no clip needed).
            if (flashA > 0) {
                ctx.fillStyle = `rgba(255,255,255,${flashA})`;
                ctx.fillRect(px, py, pw, ph);
            }
        }

        // Hint (hidden once the player has committed).
        if (!this.confirming) {
            ctx.save();
            ctx.fillStyle = 'rgba(40,30,20,0.55)';
            ctx.font = `${Math.round(H * 0.028)}px monospace`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'alphabetic';
            ctx.fillText('← →  choose      SPACE  select', W / 2, H - Math.round(H * 0.05) + 30);
            ctx.restore();
        }

        // Trailing fade-to-black — covers the hand-off (and the stage load).
        if (this.confirming) {
            const fadeA = Math.min(1, Math.max(0, (t - (this.confirmDur - this.fadeDur)) / this.fadeDur));
            if (fadeA > 0) {
                ctx.fillStyle = `rgba(0,0,0,${fadeA})`;
                ctx.fillRect(0, 0, W, H);
            }
        }
    }
}

window.CharacterSelectScreen = CharacterSelectScreen;
