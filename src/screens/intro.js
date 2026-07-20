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
        // OPTIONS sub-screen volume choice, synced to the real audio state.
        // _volAnim eases 0 (OFF) .. 1 (ON) so the thumb glides between values.
        this._volumeOn = !(this.game.audio && this.game.audio.muted);
        this._volAnim = this._volumeOn ? 1 : 0;
        // Confirm beat: once START is chosen we play the character-select "lock
        // in" beat (stamp pop on the word + flash + shake + fade-to-black) before
        // actually handing control to the game.
        this.starting = false;
        this.startT = 0;
        this.startDur = this.cfg.punch.dur;

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

        // Art / atmosphere variant flags. These used to be wired to on-screen
        // dev toggle buttons (removed); they now just hold the shipping defaults.
        this._vignetteOn = false;
        this._pollenOn = true;
        this._titleBW = false;
        this._menuBW = false;
        // The pointing hand defaults to the WHITE line-art variant (intro-hand-bw).
        this._handBW = true;
        this._titleBob = true;     // idle bob on the SABOROSA title
        // Style for UNSELECTED menu words: 'standard' (current yellow art),
        // 'white' or 'red' (transparent line-art variants from letras-02).
        // The selected word always uses the standard art.
        this._unselStyles = ['standard', 'white', 'red'];
        this._unselStyle = 'standard';
        this._devButtons = [];
    }

    // Pick the yellow or black-and-white variant of an art key based on a flag.
    _art(key, bw) { return bw ? `${key}_bw` : key; }

    // Apply the OFF/ON choice to the game audio. Tolerant of an older cached
    // AudioManager (falls back to toggleMute, or just the muted flag) so a
    // missing method can never crash the render loop.
    _applyVolume() {
        const audio = this.game.audio;
        if (!audio) return;
        const muted = !this._volumeOn;
        if (typeof audio.setMuted === 'function') audio.setMuted(muted);
        else if (audio.muted !== muted && typeof audio.toggleMute === 'function') audio.toggleMute();
        else audio.muted = muted;
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

    // Remove the top-left dev toggle buttons as we leave the intro for good.
    _teardownDevToggles() {
        this._devButtons.forEach(b => b.remove());
        this._devButtons = [];
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
        // Glide the volume thumb toward the chosen value.
        this._volAnim = this._approach(this._volAnim, this._volumeOn ? 1 : 0, this.cfg.options.selectEaseRate, dt);

        // Confirm punch in progress: swallow input, play it out, then go.
        if (this.starting) {
            this.startT += dt;
            // Keep edge state fresh so a held key doesn't re-fire post-load.
            this._edge('lift'); this._edge('confirm'); this._edge('interact');
            this._edge('up'); this._edge('down'); this._edge('escape');
            if (this.startT >= this.startDur) {
                // Hand straight off to the character-select screen: the shared
                // scrolling background carries over unbroken and the comic
                // panels fade in front of it. Tear down the dev toggles as we
                // leave the intro.
                this._teardownDevToggles();
                return 'START';
            }
            return null;
        }

        const up = this._edge('up');
        const down = this._edge('down');
        // Evaluate every confirm key so each one's edge-state stays current.
        const eLift = this._edge('lift');
        const eConfirm = this._edge('confirm');
        const eInteract = this._edge('interact');
        const confirm = eLift || eConfirm || eInteract;
        const back = this._edge('escape');
        const left = this._edge('left');
        const right = this._edge('right');

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
                } else { // START — kick off the confirm beat, return later
                    this.starting = true;
                    this.startT = 0;
                }
            }
        } else { // options
            // OFF sits on the left, ON on the right — pick directly, and apply
            // it to the live game audio (OFF = muted) so the choice carries over.
            if (left || right) {
                this._volumeOn = right ? true : false;
                this._applyVolume();
            }
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

        // Atmosphere sits over the art but under the text (keeps it readable).
        this._renderVignette(ctx, W, H);
        this._renderParticles(ctx);

        // Foreground (title + menu) is shaken as one group during the beat —
        // same decaying jitter the character-select lock-in uses.
        ctx.save();
        if (this.starting) {
            const p = this.cfg.punch;
            const amp = p.shakeAmp * Math.max(0, 1 - this.startT / p.shakeDur);
            ctx.translate(
                Math.sin(this.startT * p.shakeFreqX) * amp,
                Math.cos(this.startT * p.shakeFreqY) * amp
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

        // Trailing fade-to-black covers the hand-off to the character-select
        // screen (and hides the synchronous stage load), same as select.js.
        if (this.starting) {
            const p = this.cfg.punch;
            const fadeA = Math.min(1, Math.max(0, (this.startT - (this.startDur - p.fadeDur)) / p.fadeDur));
            if (fadeA > 0) {
                ctx.fillStyle = `rgba(0,0,0,${fadeA})`;
                ctx.fillRect(0, 0, W, H);
            }
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
        const bob = this._titleBob ? Math.sin(this.t * T.bobFreq) * T.bobAmp * settled : 0;
        if (this._titleBob) scale *= 1 + Math.sin(this.t * T.breatheFreq) * T.breatheAmp * settled;

        // During the confirm beat the title holds steady (no kick/fade) — the
        // trailing fade-to-black carries it off, matching the select screen.

        ctx.save();
        ctx.translate(W / 2, H * 0.34 + enterDy + bob);
        ctx.scale(scale, scale);
        ctx.globalAlpha = alpha;
        const img = this.game.getImage(this._art('intro_title', this._titleBW));
        if (img) {
            const h = T.imgHeight;
            const w = h * (img.naturalWidth / img.naturalHeight);
            ctx.drawImage(img, -w / 2, -h / 2, w, h);
        } else { // fallback while the art loads
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 96px Georgia, "Times New Roman", serif';
            ctx.fillText('SABOROSA', 0, 0);
        }
        ctx.restore();
    }

    _renderMenu(ctx, W, H) {
        const M = this.cfg.menu;
        const baseY = H * 0.60 + 30;
        const gap = 72;
        // The menu stays solid during the confirm beat — the trailing
        // fade-to-black (not a menu fade) now carries it off, like select.js.
        const menuAlpha = 1;
        const imgKeys = ['intro_start', 'intro_options'];

        // Entrance: START (i=0) slides in from the right, OPTIONS (i=1) from the
        // left, with the same easeOutBack overshoot the title uses, then fade in.
        const enterT = this.t - M.enterDelay;
        const enterP = Math.min(1, Math.max(0, enterT / M.enterDur));
        const enterEase = this._easeOutBack(enterP);
        const enterAlpha = Math.min(1, Math.max(0, enterT / (M.enterDur * 0.6)));
        // Hand pops in only after the words have arrived.
        const handP = Math.min(1, Math.max(0, (enterT - M.enterDur) / M.handEnterDur));

        this.options.forEach((opt, i) => {
            const a = this._optAnim[i];                 // 0..1 selected-ness
            const sel = i === this.selected;
            const y = baseY + i * gap;
            // Selected item scales up a touch (+ a pop on change) and slides right.
            const pulse = sel ? this.selPulse * M.pulseScale : 0;
            let scale = this._lerp(1, M.selScale, a) + pulse;
            // Confirm beat: the chosen word "stamps" — swells 1.25 → ~1.0 with the
            // same easeOutBack bounce the character-select lock-in uses.
            if (this.starting && sel) {
                const P = this.cfg.punch;
                const sp = Math.min(1, this.startT / P.stampDur);
                scale *= 1 + P.popAmount * (1 - this._easeOutBack(sp));
            }
            const slide = this._lerp(0, M.selSlide, a);
            // Off-screen start: +offset (right) for START, -offset (left) for OPTIONS.
            const dir = i === 0 ? 1 : -1;
            const enterX = (1 - enterEase) * dir * M.enterOffset;
            // Art is pre-colored, so selection reads through scale + opacity
            // (unselected items dim toward idleAlpha) rather than a color tween.
            const baseAlpha = 1;                        // words stay fully solid; selection reads through scale/slide

            ctx.save();
            ctx.translate(W / 2 + slide + enterX, y);
            ctx.scale(scale, scale);
            ctx.globalAlpha = baseAlpha * menuAlpha * enterAlpha;

            // Unselected words can switch to a transparent line-art variant
            // (white/red); the selected word always uses the standard art.
            const key = (!sel && this._unselStyle !== 'standard')
                ? `${imgKeys[i]}_${this._unselStyle}`
                : this._art(imgKeys[i], this._menuBW);
            const img = this.game.getImage(key);
            let halfW;
            if (img) {
                const h = M.itemHeight;
                const w = h * (img.naturalWidth / img.naturalHeight);
                halfW = w / 2;
                ctx.drawImage(img, -halfW, -h / 2, w, h);
                // White flash over the chosen word during the confirm beat
                // (peak alpha, linear decay — same as the select-panel flash).
                if (this.starting && sel) {
                    const P = this.cfg.punch;
                    const flashA = P.flashStrength * Math.max(0, 1 - this.startT / P.flashDur);
                    if (flashA > 0) {
                        ctx.globalAlpha = flashA;
                        ctx.fillStyle = '#fff';
                        ctx.fillRect(-halfW, -h / 2, w, h);
                    }
                }
            } else { // fallback while the art loads
                ctx.font = `${a > 0.5 ? 'bold ' : ''}38px Georgia, serif`;
                ctx.fillStyle = '#ffd166';
                ctx.textBaseline = 'middle';
                ctx.fillText(opt, 0, 0);
                halfW = ctx.measureText(opt).width / 2;
            }

            // A pointing hand sits to the LEFT of the selected word and breathes
            // toward/away from it (same in/out motion the arrows used to have).
            const hand = this.game.getImage(this._art('intro_hand', this._handBW));
            if (hand && a > 0.02 && handP > 0) {
                // Pop in with a slight overshoot after the words have arrived.
                const popScale = this._easeOutBack(handP);
                const hh = M.handHeight * popScale;
                const hw = hh * (hand.naturalWidth / hand.naturalHeight);
                // Distance from the word's left edge to the hand's right edge,
                // pulling closer as it breathes in.
                const gapX = halfW + M.handGap - Math.sin(this.t * M.handBreatheFreq) * M.handBreatheAmp * a;
                ctx.globalAlpha = baseAlpha * menuAlpha * a * handP;
                ctx.drawImage(hand, -gapX - hw, -hh / 2, hw, hh);
            }
            ctx.restore();
        });

        ctx.save();
        ctx.globalAlpha = menuAlpha;
        ctx.font = '18px Georgia, serif';
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.fillText('↑ / ↓ to choose   ·   Space / Enter to select', W / 2, H * 0.9 + 57);
        ctx.restore();
    }

    // Draw an image centered at (x, y) scaled to a target height, keeping aspect.
    _drawImageCentered(ctx, img, x, y, h, alpha) {
        if (!img) return 0;
        const w = h * (img.naturalWidth / img.naturalHeight);
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.drawImage(img, x - w / 2, y - h / 2, w, h);
        ctx.restore();
        return w;
    }

    _renderOptions(ctx, W, H) {
        const O = this.cfg.options;
        const cx = W / 2;
        const volY = H * O.volumeY;
        const valY = H * O.valueY;

        // VOLUME label.
        this._drawImageCentered(ctx, this.game.getImage('intro_volume'), cx, volY, O.volumeHeight, 1);

        // OFF (left) and ON (right). Selected-ness crossfades with the thumb glide.
        const offX = cx - O.valueSpread;
        const onX = cx + O.valueSpread;
        const onAmt = this._volAnim;        // 1 when ON selected
        const offAmt = 1 - this._volAnim;   // 1 when OFF selected
        const drawValue = (img, x, amt) => {
            const scale = this._lerp(1, O.valueSelScale, amt);
            const alpha = this._lerp(O.idleAlpha, 1, amt);
            this._drawImageCentered(ctx, img, x, valY, O.valueHeight * scale, alpha);
        };
        drawValue(this.game.getImage('intro_off'), offX, offAmt);
        drawValue(this.game.getImage('intro_on'), onX, onAmt);

        // Thumbs-up cursor under the selected value, gliding between OFF and ON
        // and breathing up toward it.
        const thumb = this.game.getImage(this._art('intro_thumb', this._handBW));
        if (thumb) {
            const hh = O.thumbHeight;
            const hw = hh * (thumb.naturalWidth / thumb.naturalHeight);
            const handX = this._lerp(offX, onX, this._volAnim);
            const valBottom = valY + O.valueHeight / 2;
            const breathe = -Math.abs(Math.sin(this.t * O.thumbBreatheFreq)) * O.thumbBreatheAmp;
            const topY = valBottom + O.thumbGap + breathe;
            ctx.drawImage(thumb, handX - hw / 2, topY, hw, hh);
        }

        ctx.font = '18px Georgia, serif';
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.fillText('← / → to choose   ·   Esc to go back', cx, H * 0.9 + 57);
    }
}

window.IntroScreen = IntroScreen;
