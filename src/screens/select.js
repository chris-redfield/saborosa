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

        // The two aligned 3-frame loops. Index `frame` picks gray[frame]
        // everywhere and color[frame] inside the selected panel.
        this.grayFrames  = ['select_gray_1',  'select_gray_2',  'select_gray_3'];
        this.colorFrames = ['select_color_1', 'select_color_2', 'select_color_3'];
        this.frame = 0;
        this.frameTimer = 0;
        this.frameDur = 0.18; // seconds per frame

        // Panels left->right, in IMAGE coordinates. `pack` is the Player sprite
        // pack the panel selects (0=tomato, 1=coconut, 2=eggplant, 3=laranja).
        // NOTE: these rects are placeholder estimates — replace x/y/w/h with the
        // exact values from the panel-picking tool.
        this.panels = [
            { name: 'JUIXY', pack: 3, rect: { x: 150, y: 95, w: 215, h: 450 } }, // laranja (yellow)
            { name: 'ERKPA', pack: 2, rect: { x: 378, y: 95, w: 190, h: 450 } }, // eggplant (tan)
            { name: 'TOM',   pack: 0, rect: { x: 585, y: 95, w: 205, h: 450 } }, // tomato (red)
        ];
        this.cursor = 2; // start on TOM (tomato is the default pack)

        this._held = {};
    }

    // Rising-edge detector so a held key fires exactly once, even when the
    // fixed-timestep loop runs several updates in one frame (mirrors IntroScreen).
    _edge(action) {
        const down = this.game.input.isKeyDown(action);
        const was = this._held[action] || false;
        this._held[action] = down;
        return down && !was;
    }

    // Advance the idle loop, move the cursor, and report a confirmed pick.
    update(dt) {
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
        if (eLift || eConfirm || eInteract) return this.panels[this.cursor].pack;
        return null;
    }

    render(ctx) {
        const { width: W, height: H } = this.game;

        // Warm paper backdrop (the art is line-art on transparency).
        ctx.fillStyle = '#faf6ec';
        ctx.fillRect(0, 0, W, H);

        // Contain-fit the art, centered and letterboxed. The same transform maps
        // image-space panel rects to the screen.
        const s = Math.min(W / this.IMG_W, H / this.IMG_H);
        const dw = this.IMG_W * s, dh = this.IMG_H * s;
        const ox = (W - dw) / 2, oy = (H - dh) / 2;

        const gray = this.game.getImage(this.grayFrames[this.frame]);
        if (gray) ctx.drawImage(gray, ox, oy, dw, dh);

        // Light up the selected fruit: clip to its panel and draw the colored
        // twin of the same frame over the gray base.
        const color = this.game.getImage(this.colorFrames[this.frame]);
        const p = this.panels[this.cursor];
        if (color && p) {
            const r = p.rect;
            ctx.save();
            ctx.beginPath();
            ctx.rect(ox + r.x * s, oy + r.y * s, r.w * s, r.h * s);
            ctx.clip();
            ctx.drawImage(color, ox, oy, dw, dh);
            ctx.restore();
        }

        // Small hint at the bottom of the letterbox.
        ctx.save();
        ctx.fillStyle = 'rgba(40,30,20,0.55)';
        ctx.font = `${Math.round(H * 0.028)}px monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText('← →  choose      SPACE  select', W / 2, oy + dh - Math.round(H * 0.02));
        ctx.restore();
    }
}

window.CharacterSelectScreen = CharacterSelectScreen;
