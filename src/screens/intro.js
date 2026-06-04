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
 * animation has finished playing. The animation tuning values come from
 * window.INTRO_JUICE (src/screens/intro.config.js).
 */
class IntroScreen {
    constructor(game) {
        this.game = game;
        this.cfg = window.INTRO_JUICE;   // juice tuning (see intro.config.js)
        this.options = ['START', 'OPTIONS'];
        this.selected = 0;
        this.mode = 'menu';        // 'menu' | 'options'
        this.bgKey = 'intro_bg';
        this.scrollX = 0;          // background scroll offset (px), grows forever
        this.scrollSpeed = this.cfg.scrollSpeed; // px/sec the camera pans across the background
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
        this.startDur = this.cfg.punch.dur;
        this.flash = 0;            // 0..1 white screen flash, decays
        this._cover = null;        // black overlay that covers the START handoff
        this._coverReady = false;  // true once that overlay has actually painted

        // Fade-in from black: the whole window starts black and fades to clear
        // to reveal the page. A canvas can only paint itself, so to cover the
        // letterbox/border around the canvas too we use a full-viewport DOM
        // overlay, created + driven + removed entirely here (no other file is
        // touched).
        this.fadeDur = this.cfg.bootFadeDur;
        this._fade = null;
        this._fadeDone = false;
        this._makeFade();

        // Atmosphere: drifting dust/pollen motes (see intro.config.js).
        this._particles = [];
        this._initParticles();

        // Dev toggles (DOM buttons outside the canvas) for A/B-ing atmosphere.
        this._vignetteOn = true;
        this._pollenOn = true;
        this._devButtons = [];
        this._makeDevToggles();
    }

    _makeDevToggles() {
        this._addToggle(() => `Vignette: ${this._vignetteOn ? 'ON' : 'OFF'}`,
            () => { this._vignetteOn = !this._vignetteOn; });
        this._addToggle(() => `Pollen: ${this._pollenOn ? 'ON' : 'OFF'}`,
            () => { this._pollenOn = !this._pollenOn; });
    }

    // Stacks a labeled toggle button at the top-left, outside the canvas.
    _addToggle(getLabel, onClick) {
        if (typeof document === 'undefined' || !document.body) return;
        const btn = document.createElement('button');
        const s = btn.style;
        s.position = 'fixed';
        s.top = `${10 + this._devButtons.length * 34}px`;
        s.left = '10px';
        s.zIndex = '10000';
        s.width = '150px';
        s.padding = '6px 10px';
        s.font = '13px monospace';
        s.textAlign = 'left';
        s.cursor = 'pointer';
        s.border = '1px solid #888';
        s.borderRadius = '4px';
        s.background = '#222';
        s.color = '#fff';
        btn.textContent = getLabel();
        btn.addEventListener('click', () => { onClick(); btn.textContent = getLabel(); btn.blur(); });
        document.body.appendChild(btn);
        this._devButtons.push(btn);
    }

    // Scatter the dust/pollen motes across the screen with randomized drift,
    // sway and twinkle so they never look like a uniform grid.
    _initParticles() {
        const P = this.cfg.atmosphere.particles;
        const { width: W, height: H } = this.game;
        const rnd = (lo, hi) => lo + Math.random() * (hi - lo);
        for (let i = 0; i < P.count; i++) {
            this._particles.push({
                x: Math.random() * W,
                y: Math.random() * H,
                r: rnd(P.minR, P.maxR),
                driftX: rnd(P.minDriftX, P.maxDriftX),
                vy: rnd(P.minVy, P.maxVy),
                swayFreq: rnd(P.minSwayFreq, P.maxSwayFreq),
                swayPhase: Math.random() * Math.PI * 2,
                baseAlpha: rnd(P.minAlpha, P.maxAlpha),
                twinkleFreq: rnd(P.minTwinkleFreq, P.maxTwinkleFreq),
                twinklePhase: Math.random() * Math.PI * 2,
            });
        }
    }

    // Advance the motes; wrap them around the screen edges so the field is
    // endless. Sway is applied at render time (purely visual), so wrapping
    // stays based on the drifting anchor (x, y).
    _updateParticles(dt) {
        const P = this.cfg.atmosphere.particles;
        const { width: W, height: H } = this.game;
        const m = P.maxR * 2;
        for (const p of this._particles) {
            p.x += p.driftX * dt;
            p.y += p.vy * dt;
            if (p.x < -m) p.x = W + m;
            else if (p.x > W + m) p.x = -m;
            if (p.y < -m) p.y = H + m;
            else if (p.y > H + m) p.y = -m;
        }
    }

    _makeFade() {
        if (typeof document === 'undefined' || !document.body) return;
        const el = document.createElement('div');
        const s = el.style;
        s.position = 'fixed';
        s.left = '0';
        s.top = '0';
        s.width = '100vw';
        s.height = '100vh';
        s.background = '#000';
        s.zIndex = '9999';
        s.pointerEvents = 'none';
        s.opacity = '1';
        document.body.appendChild(el);
        this._fade = el;
    }

    _updateFade() {
        if (this._fadeDone || !this._fade) return;
        if (this.t >= this.fadeDur) {
            this._fade.remove();
            this._fade = null;
            this._fadeDone = true;
            return;
        }
        const p = this._easeOutCubic(this.t / this.fadeDur);
        this._fade.style.opacity = String(1 - p);
    }

    // Solid black full-window overlay placed over the intro at the end of the
    // confirm punch. _coverReady flips true only after the browser has actually
    // painted it (double rAF = a real frame boundary passed), so we can safely
    // trigger the blocking stage load behind it without a visible freeze.
    _makeCover() {
        if (typeof document === 'undefined' || !document.body) return;
        const el = document.createElement('div');
        const s = el.style;
        s.position = 'fixed';
        s.left = '0';
        s.top = '0';
        s.width = '100vw';
        s.height = '100vh';
        s.background = '#000';
        s.zIndex = '9999';
        s.pointerEvents = 'none';
        s.opacity = '1';
        s.transition = `opacity ${this.cfg.reveal.fadeDur}s ease-out`;
        document.body.appendChild(el);
        this._cover = el;
        this._coverReady = false;
        requestAnimationFrame(() => requestAnimationFrame(() => { this._coverReady = true; }));
    }

    // Fade the cover out to reveal the now-loaded game. CSS drives the fade so
    // it keeps running after the intro hands control to main.js (our update()
    // stops being called once screen === 'playing'). The opacity flip is rAF-
    // deferred so it lands AFTER the synchronous stage load — the screen stays
    // solid black through the load, then fades in. All contained in this file.
    _beginGameReveal() {
        // Tear down the dev toggles when we leave the intro.
        this._devButtons.forEach(b => b.remove());
        this._devButtons = [];
        const el = this._cover;
        if (!el) return;
        el.addEventListener('transitionend', () => el.remove());
        requestAnimationFrame(() => requestAnimationFrame(() => { el.style.opacity = '0'; }));
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
        this._updateFade();
        this._updateParticles(dt);

        // Ease each option toward / away from "selected", and decay the
        // selection-change pop + the flash regardless of mode.
        this.options.forEach((_, i) => {
            const target = i === this.selected ? 1 : 0;
            this._optAnim[i] = this._approach(this._optAnim[i], target, this.cfg.menu.selectEaseRate, dt);
        });
        if (this.selPulse > 0) this.selPulse = Math.max(0, this.selPulse - dt / this.cfg.menu.pulseDecay);
        if (this.flash > 0) this.flash = Math.max(0, this.flash - dt / this.cfg.punch.flashDecay);

        // Confirm punch in progress: swallow input, play it out, then go.
        if (this.starting) {
            this.startT += dt;
            // Keep edge state fresh so a held key doesn't re-fire post-load.
            this._edge('attack'); this._edge('confirm'); this._edge('interact');
            this._edge('up'); this._edge('down'); this._edge('escape');
            if (this.startT >= this.startDur) {
                // Black out the whole window, but DON'T hand off to the game
                // until that black has actually been painted — otherwise the
                // synchronous stage load blocks before the overlay shows and
                // the browser freezes on the last intro frame for ~0.5s.
                if (!this._cover) this._makeCover();
                if (this._coverReady) {
                    this._beginGameReveal();
                    return 'START';
                }
            }
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

    // Darkened edges (radial gradient) to focus the eye on the center.
    _renderVignette(ctx, W, H) {
        if (!this._vignetteOn) return;
        const v = this.cfg.atmosphere.vignette;
        if (v.strength <= 0) return;
        const cx = W / 2, cy = H / 2;
        const outer = Math.hypot(W, H) / 2;
        const g = ctx.createRadialGradient(cx, cy, outer * v.innerRadius, cx, cy, outer);
        g.addColorStop(0, 'rgba(0,0,0,0)');
        g.addColorStop(1, `rgba(0,0,0,${v.strength})`);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
    }

    // Soft glowing dust/pollen motes, each twinkling and swaying.
    _renderParticles(ctx) {
        if (!this._pollenOn) return;
        const P = this.cfg.atmosphere.particles;
        const [cr, cg, cb] = P.color;
        for (const p of this._particles) {
            const tw = 1 + Math.sin(this.t * p.twinkleFreq + p.twinklePhase) * P.twinkleAmp;
            const a = Math.max(0, Math.min(1, p.baseAlpha * tw));
            if (a <= 0) continue;
            const x = p.x + Math.sin(this.t * p.swayFreq + p.swayPhase) * P.swayAmp;
            const rad = p.r * 2; // soft falloff radius
            const g = ctx.createRadialGradient(x, p.y, 0, x, p.y, rad);
            g.addColorStop(0, `rgba(${cr},${cg},${cb},${a})`);
            g.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.arc(x, p.y, rad, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    render(ctx) {
        const { width: W, height: H } = this.game;

        // Background + readability darken sit UNDER the shake so screen edges
        // never reveal gaps when the foreground jolts.
        this._drawScrollingBackground(ctx);
        ctx.fillStyle = 'rgba(0,0,0,0.30)';
        ctx.fillRect(0, 0, W, H);

        // Atmosphere sits over the art but under the text (keeps it readable).
        this._renderVignette(ctx, W, H);
        this._renderParticles(ctx);

        // Foreground (title + menu) is shaken as one group during the punch.
        ctx.save();
        if (this.starting) {
            const p = this.cfg.punch;
            const k = 1 - this.startT / this.startDur;     // 1 → 0 over the punch
            const amp = p.shakeAmp * k * k;
            ctx.translate(
                Math.sin(this.startT * p.shakeFreqX) * amp,
                Math.cos(this.startT * p.shakeFreqY) * amp * p.shakeYScale
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
            ctx.fillStyle = `rgba(255,255,255,${this.cfg.punch.flashStrength * this.flash})`;
            ctx.fillRect(0, 0, W, H);
        }
        // The fade-in from black is a DOM overlay (see _makeFade / _updateFade)
        // so it can cover the whole window, not just this canvas.
    }

    _renderTitle(ctx, W, H) {
        const T = this.cfg.title;
        // Entrance: drop in from above with a slight overshoot + fade.
        const inP = Math.min(1, this.t / T.enterDur);
        const eased = this._easeOutBack(inP);
        const enterDy = (1 - eased) * -T.enterDrop;
        let alpha = Math.min(1, this.t / T.fadeInDur);
        let scale = 1;

        // Idle: gentle vertical bob + breathing once it has settled.
        const settled = Math.min(1, Math.max(0, (this.t - T.settleDelay) / T.settleDur));
        const bob = Math.sin(this.t * T.bobFreq) * T.bobAmp * settled;
        scale *= 1 + Math.sin(this.t * T.breatheFreq) * T.breatheAmp * settled;

        // Confirm punch: title kicks bigger and fades out as we hand off.
        if (this.starting) {
            const k = this.startT / this.startDur;
            scale *= 1 + this._easeOutCubic(k) * T.punchKick;
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
        const M = this.cfg.menu;
        const baseY = H * 0.60 + 30;
        const gap = 72;
        // Fade the whole menu out during the confirm punch.
        const menuAlpha = this.starting ? Math.max(0, 1 - this.startT / (this.startDur * M.fadeOnStartFactor)) : 1;

        this.options.forEach((opt, i) => {
            const a = this._optAnim[i];                 // 0..1 selected-ness
            const sel = i === this.selected;
            const y = baseY + i * gap;
            // Selected item scales up a touch (+ a pop on change) and slides right.
            const pulse = sel ? this.selPulse * M.pulseScale : 0;
            const scale = this._lerp(1, M.selScale, a) + pulse;
            const slide = this._lerp(0, M.selSlide, a);
            const size = 38;

            // Color glides white -> the selected (gold) color with selected-ness.
            const r = Math.round(this._lerp(255, M.selColor[0], a));
            const g = Math.round(this._lerp(255, M.selColor[1], a));
            const b = Math.round(this._lerp(255, M.selColor[2], a));
            const baseAlpha = this._lerp(M.idleAlpha, 1, a);

            ctx.save();
            ctx.translate(W / 2 + slide, y);
            ctx.scale(scale, scale);
            ctx.globalAlpha = baseAlpha * menuAlpha;
            ctx.font = `${a > 0.5 ? 'bold ' : ''}${size}px Georgia, serif`;
            ctx.fillStyle = `rgb(${r},${g},${b})`;

            // Animated arrows breathe out from the text the more selected it is.
            if (a > 0.02) {
                const w = ctx.measureText(opt).width;
                const gapX = w / 2 + M.arrowGap + Math.sin(this.t * M.arrowBreatheFreq) * M.arrowBreatheAmp * a;
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
