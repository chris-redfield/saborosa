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
 *
 * All "game juice" (title entrance + idle bob, animated menu selection, and the
 * confirm punch) lives entirely in this file so the rest of the codebase stays
 * untouched: main.js just polls update() and gets 'START' once the punch
 * animation has finished playing.
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

        // --- juice state ---
        // Per-option "selected-ness", eased toward 1 for the highlighted item
        // and 0 for the rest so the highlight glides instead of snapping.
        this._optAnim = this.options.map((_, i) => (i === this.selected ? 1 : 0));
        this.selPulse = 0;         // 0..1 pop kick on each selection change, decays
        // Confirm punch: once START is chosen we play a short flash/shake/kick
        // before actually handing control to the game.
        this.starting = false;
        this.startT = 0;
        this.startDur = 0.55;
        this.flash = 0;            // 0..1 white screen flash, decays
    }

    // --- small easing / math helpers ----------------------------------------
    _lerp(a, b, t) { return a + (b - a) * t; }
    _easeOutCubic(p) { return 1 - Math.pow(1 - p, 3); }
    // Slight overshoot, used for the title settling into place.
    _easeOutBack(p) {
        const c1 = 1.70158, c3 = c1 + 1;
        return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2);
    }
    // Frame-rate independent approach toward a target ("rate" = how fast).
    _approach(cur, target, rate, dt) {
        return cur + (target - cur) * (1 - Math.exp(-rate * dt));
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

        // Ease each option toward / away from "selected", and decay the
        // selection-change pop + the flash regardless of mode.
        this.options.forEach((_, i) => {
            const target = i === this.selected ? 1 : 0;
            this._optAnim[i] = this._approach(this._optAnim[i], target, 16, dt);
        });
        if (this.selPulse > 0) this.selPulse = Math.max(0, this.selPulse - dt / 0.22);
        if (this.flash > 0) this.flash = Math.max(0, this.flash - dt / 0.35);

        // Confirm punch in progress: swallow input, play it out, then go.
        if (this.starting) {
            this.startT += dt;
            // Keep edge state fresh so a held key doesn't re-fire post-load.
            this._edge('attack'); this._edge('confirm'); this._edge('interact');
            this._edge('up'); this._edge('down'); this._edge('escape');
            if (this.startT >= this.startDur) return 'START';
            return null;
        }

        const up = this._edge('up');
        const down = this._edge('down');
        // Evaluate every confirm key so each one's edge-state stays current.
        const eAttack = this._edge('attack');
        const eConfirm = this._edge('confirm');
        const eInteract = this._edge('interact');
        const confirm = eAttack || eConfirm || eInteract;
        const back = this._edge('escape');

        if (this.mode === 'menu') {
            if (up || down) {
                const dir = up ? this.options.length - 1 : 1;
                this.selected = (this.selected + dir) % this.options.length;
                this.selPulse = 1;
            }
            if (confirm) {
                const opt = this.options[this.selected];
                if (opt === 'OPTIONS') {
                    this.mode = 'options';
                } else { // START — kick off the confirm punch, return later
                    this.starting = true;
                    this.startT = 0;
                    this.flash = 1;
                    this.selPulse = 1;
                }
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

        // Background + readability darken sit UNDER the shake so screen edges
        // never reveal gaps when the foreground jolts.
        this._drawScrollingBackground(ctx);
        ctx.fillStyle = 'rgba(0,0,0,0.30)';
        ctx.fillRect(0, 0, W, H);

        // Foreground (title + menu) is shaken as one group during the punch.
        ctx.save();
        if (this.starting) {
            const k = 1 - this.startT / this.startDur;     // 1 → 0 over the punch
            const amp = 14 * k * k;
            ctx.translate(
                Math.sin(this.startT * 62) * amp,
                Math.cos(this.startT * 53) * amp * 0.6
            );
        }

        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';

        this._renderTitle(ctx, W, H);
        if (this.mode === 'menu') {
            this._renderMenu(ctx, W, H);
        } else {
            this._renderOptions(ctx, W, H);
        }

        // Reset alignment so gameplay rendering (which assumes defaults) is unaffected.
        ctx.textAlign = 'start';
        ctx.textBaseline = 'alphabetic';
        ctx.restore();

        // White flash on confirm, drawn last so it covers the whole screen.
        if (this.flash > 0) {
            ctx.fillStyle = `rgba(255,255,255,${0.7 * this.flash})`;
            ctx.fillRect(0, 0, W, H);
        }
    }

    _renderTitle(ctx, W, H) {
        // Entrance: drop in from above with a slight overshoot + fade over ~0.7s.
        const inP = Math.min(1, this.t / 0.7);
        const eased = this._easeOutBack(inP);
        const enterDy = (1 - eased) * -70;
        let alpha = Math.min(1, this.t / 0.5);
        let scale = 1;

        // Idle: gentle vertical bob + breathing once it has settled.
        const settled = Math.min(1, Math.max(0, (this.t - 0.5) / 0.5));
        const bob = Math.sin(this.t * 1.6) * 6 * settled;
        scale *= 1 + Math.sin(this.t * 1.2) * 0.012 * settled;

        // Confirm punch: title kicks bigger and fades out as we hand off.
        if (this.starting) {
            const k = this.startT / this.startDur;
            scale *= 1 + this._easeOutCubic(k) * 0.35;
            alpha *= 1 - k;
        }

        ctx.save();
        ctx.translate(W / 2, H * 0.34 + enterDy + bob);
        ctx.scale(scale, scale);
        ctx.globalAlpha = alpha;
        ctx.shadowColor = 'rgba(0,0,0,0.6)';
        ctx.shadowBlur = 14;
        ctx.shadowOffsetY = 5;
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 96px Georgia, "Times New Roman", serif';
        ctx.fillText('SABOROSA', 0, 0);
        ctx.restore();
    }

    _renderMenu(ctx, W, H) {
        const baseY = H * 0.60 + 30;
        const gap = 72;
        // Fade the whole menu out during the confirm punch.
        const menuAlpha = this.starting ? Math.max(0, 1 - this.startT / (this.startDur * 0.6)) : 1;

        this.options.forEach((opt, i) => {
            const a = this._optAnim[i];                 // 0..1 selected-ness
            const sel = i === this.selected;
            const y = baseY + i * gap;
            // Selected item scales up a touch (+ a pop on change) and slides right.
            const pulse = sel ? this.selPulse * 0.10 : 0;
            const scale = this._lerp(1, 1.18, a) + pulse;
            const slide = this._lerp(0, 6, a);
            const size = 38;

            // Color glides white -> gold with selected-ness.
            const r = Math.round(this._lerp(255, 255, a));
            const g = Math.round(this._lerp(255, 209, a));
            const b = Math.round(this._lerp(255, 102, a));
            const baseAlpha = this._lerp(0.82, 1, a);

            ctx.save();
            ctx.translate(W / 2 + slide, y);
            ctx.scale(scale, scale);
            ctx.globalAlpha = baseAlpha * menuAlpha;
            ctx.font = `${a > 0.5 ? 'bold ' : ''}${size}px Georgia, serif`;
            ctx.fillStyle = `rgb(${r},${g},${b})`;

            // Animated arrows breathe out from the text the more selected it is.
            if (a > 0.02) {
                const w = ctx.measureText(opt).width;
                const gapX = w / 2 + 26 + Math.sin(this.t * 4) * 3 * a;
                ctx.save();
                ctx.globalAlpha = baseAlpha * menuAlpha * a;
                ctx.fillText('▸', -gapX, 0);
                ctx.fillText('◂', gapX, 0);
                ctx.restore();
            }
            ctx.fillText(opt, 0, 0);
            ctx.restore();
        });

        ctx.save();
        ctx.globalAlpha = menuAlpha;
        ctx.font = '18px Georgia, serif';
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.fillText('↑ / ↓ to choose   ·   Space / Enter to select', W / 2, H * 0.9 + 57);
        ctx.restore();
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
