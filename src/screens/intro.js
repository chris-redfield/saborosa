/**
 * Intro / title screen.
 *
 * Renders an infinitely scrolling horizontal background (the source image is
 * seamless — its right edge continues into its left edge — so we just tile it
 * and advance an offset) with a START / OPTIONS menu on top.
 *
 * Runs at the game's standard resolution via game.width / game.height
 * (1280x720), so it scales with the rest of the game.
 *
 * update() returns the chosen action string ('START') when the player confirms
 * it; OPTIONS is handled internally as a sub-screen. Input edges are tracked
 * manually (isKeyDown + previous state) so a transition fires exactly once even
 * when the fixed-timestep loop runs several updates in a single frame.
 */
class IntroScreen {
    constructor(game) {
        this.game = game;
        this.options = ['START', 'OPTIONS'];
        this.selected = 0;
        this.mode = 'menu';        // 'menu' | 'options'
        this.bgKey = 'intro_bg';
        this.scrollX = 0;          // background scroll offset (px), grows forever
        this.scrollSpeed = 40;     // px/sec the camera pans across the background
        this.t = 0;                // elapsed time, for subtle animation
        this._held = {};           // per-action previous down-state, for edge detection
    }

    _edge(action) {
        const down = this.game.input.isKeyDown(action);
        const was = this._held[action] || false;
        this._held[action] = down;
        return down && !was;
    }

    // Returns 'START' when the player commits to starting, else null.
    update(dt) {
        this.t += dt;
        this.scrollX += this.scrollSpeed * dt;

        const up = this._edge('up');
        const down = this._edge('down');
        // Evaluate every confirm key so each one's edge-state stays current.
        const eAttack = this._edge('attack');
        const eConfirm = this._edge('confirm');
        const eInteract = this._edge('interact');
        const confirm = eAttack || eConfirm || eInteract;
        const back = this._edge('escape');

        if (this.mode === 'menu') {
            if (up) this.selected = (this.selected + this.options.length - 1) % this.options.length;
            if (down) this.selected = (this.selected + 1) % this.options.length;
            if (confirm) {
                const opt = this.options[this.selected];
                if (opt === 'OPTIONS') this.mode = 'options';
                else return opt; // 'START'
            }
        } else { // options
            if (confirm || back) this.mode = 'menu';
        }
        return null;
    }

    _drawScrollingBackground(ctx) {
        const { width: W, height: H } = this.game;
        const img = this.game.getImage(this.bgKey);
        if (!img) {
            ctx.fillStyle = '#c2956b';
            ctx.fillRect(0, 0, W, H);
            return;
        }
        const iw = img.naturalWidth || img.width;
        const ih = img.naturalHeight || img.height;
        const scale = H / ih;          // fit image height to the screen
        const sw = iw * scale;         // on-screen width of one copy
        // Start one tile to the left of the wrapped offset, then tile across.
        let x = -(this.scrollX % sw);
        if (x > 0) x -= sw;
        for (; x < W; x += sw) {
            ctx.drawImage(img, Math.round(x), 0, Math.ceil(sw) + 1, H);
        }
    }

    render(ctx) {
        const { width: W, height: H } = this.game;

        this._drawScrollingBackground(ctx);
        // Darken slightly so text stays readable over any art.
        ctx.fillStyle = 'rgba(0,0,0,0.30)';
        ctx.fillRect(0, 0, W, H);

        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';

        // Title
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.6)';
        ctx.shadowBlur = 14;
        ctx.shadowOffsetY = 5;
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 96px Georgia, "Times New Roman", serif';
        ctx.fillText('SABOROSA', W / 2, H * 0.34);
        ctx.restore();

        if (this.mode === 'menu') {
            this._renderMenu(ctx, W, H);
        } else {
            this._renderOptions(ctx, W, H);
        }

        // Reset alignment so gameplay rendering (which assumes defaults) is unaffected.
        ctx.textAlign = 'start';
        ctx.textBaseline = 'alphabetic';
    }

    _renderMenu(ctx, W, H) {
        const baseY = H * 0.60 + 30;
        const gap = 72;
        this.options.forEach((opt, i) => {
            const sel = i === this.selected;
            const y = baseY + i * gap;
            ctx.font = `${sel ? 'bold ' : ''}${sel ? 46 : 38}px Georgia, serif`;
            ctx.fillStyle = sel ? '#ffd166' : 'rgba(255,255,255,0.82)';
            ctx.fillText(sel ? `▸  ${opt}  ◂` : opt, W / 2, y);
        });

        ctx.font = '18px Georgia, serif';
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.fillText('↑ / ↓ to choose   ·   Space / Enter to select', W / 2, H * 0.9 + 57);
    }

    _renderOptions(ctx, W, H) {
        ctx.font = 'bold 44px Georgia, serif';
        ctx.fillStyle = '#ffd166';
        ctx.fillText('OPTIONS', W / 2, H * 0.58);

        ctx.font = '24px Georgia, serif';
        ctx.fillStyle = 'rgba(255,255,255,0.82)';
        ctx.fillText('Coming soon', W / 2, H * 0.66);

        ctx.font = '18px Georgia, serif';
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.fillText('Esc / Space to go back', W / 2, H * 0.9 + 30);
    }
}

window.IntroScreen = IntroScreen;
