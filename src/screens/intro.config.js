/**
 * Tunable parameters for the intro/title screen "game juice".
 *
 * Everything here is feel/animation tuning — durations (seconds), amplitudes
 * (px or scale), frequencies (rad/sec), and the colors used in tweens. Static
 * layout (font sizes, text positions) stays in intro.js; this file is the dial
 * box for the animation. Loaded as a global before intro.js (see index.html).
 */
window.INTRO_JUICE = {
    // Background pan. User-approved feel — change deliberately.
    scrollSpeed: 40,             // px/sec

    // Fade-in from black when the title screen first appears.
    bootFadeDur: 0.9,            // sec

    // Title: entrance (drop-in, no fade) then perpetual idle motion.
    title: {
        imgHeight: 150,          // px — on-screen height of the SABOROSA art (width keeps aspect)
        enterDur: 0.7,           // sec — drop-in with slight overshoot
        enterDrop: 70,           // px it falls in from
        settleDelay: 0.5,        // sec before idle motion starts ramping in
        settleDur: 0.5,          // sec for idle motion to reach full strength
        bobAmp: 6,               // px — vertical idle bob
        bobFreq: 1.6,            // rad/sec
        breatheAmp: 0.012,       // scale wobble amount
        breatheFreq: 1.2,        // rad/sec
    },

    // Menu: animated selection feel.
    menu: {
        itemHeight: 52,          // px — on-screen height of each option's art (width keeps aspect)
        // Entrance on load: START slides in from the right, OPTIONS from the left
        // (same easeOutBack overshoot as the title drop), then the hand pops in.
        enterDur: 0.6,           // sec — slide-in duration
        enterDelay: 0.2,         // sec — wait after load before the menu slides in
        enterOffset: 130,        // px — how far the words travel in from the sides
        handEnterDur: 0.3,       // sec — hand pop-in once the words have arrived
        selectEaseRate: 16,      // how fast the highlight glides between items
        pulseDecay: 0.22,        // sec — per-change "pop" fade
        pulseScale: 0.10,        // extra scale on a selection change
        selScale: 1.18,          // selected item scale
        selSlide: 6,             // px — selected item slides right
        idleAlpha: 0.82,         // alpha of unselected items (selected = 1)
        handHeight: 37,          // px — on-screen height of the pointing-hand cursor
        handGap: 28,             // px — base distance from the word's left edge
        handBreatheFreq: 4,      // rad/sec — hand in/out motion
        handBreatheAmp: 9,       // px — hand in/out amplitude
    },

    // OPTIONS sub-screen (VOLUME with OFF / ON, selected by a thumbs-up hand).
    options: {
        volumeY: 0.58,           // fraction of screen height — VOLUME label center
        valueY: 0.72,            // fraction of screen height — OFF / ON center
        volumeHeight: 52,        // px — on-screen height of the VOLUME label art (matches menu.itemHeight)
        valueHeight: 52,         // px — on-screen height of the OFF / ON art (matches menu.itemHeight)
        valueSpread: 150,        // px — half-distance between the OFF and ON centers
        idleAlpha: 0.7,          // dim factor for the unselected value
        valueSelScale: 1.12,     // scale bump on the selected value
        selectEaseRate: 16,      // how fast the thumb glides between OFF and ON
        thumbHeight: 57,         // px — on-screen height of the thumbs-up cursor (30% under original)
        thumbGap: 14,            // px — base gap from the value's bottom to the thumb
        thumbBreatheFreq: 4,     // rad/sec — thumb up/down motion
        thumbBreatheAmp: 8,      // px — thumb up/down amplitude
    },

    // Confirm beat when START is pressed — mirrors the character-select "lock in"
    // (see src/screens/select.js): a stamp pop on the chosen word + shake, then a
    // trailing fade-to-black that covers the hand-off.
    punch: {
        dur: 0.55,               // sec — total beat length before handoff
        stampDur: 0.40,          // sec — pop settle time
        popAmount: 0.25,         // selected word swells 1.25 → ~1.0 (easeOutBack bounce)
        shakeAmp: 9,             // px — peak shake
        shakeDur: 0.18,          // sec — shake linear decay
        shakeFreqX: 82,          // rad/sec — horizontal jitter
        shakeFreqY: 71,          // rad/sec — vertical jitter
        fadeDur: 0.20,           // sec — trailing fade-to-black covering the hand-off
    },

    // Black cover + game fade-in after START.
    reveal: {
        fadeDur: 0.4,            // sec — black cover fades out to reveal the game
    },

    // Atmosphere layers (depth/ambience). Set any group's strength/count to 0
    // to disable that layer.
    atmosphere: {
        // Vignette: darkened edges that draw the eye to the center.
        vignette: {
            strength: 0.25,      // peak corner darkness (alpha); 0 = off
            innerRadius: 0.35,   // fraction of half-diagonal where darkening starts
        },
        // Drifting dust / pollen motes floating through the air.
        particles: {
            count: 45,           // number of motes; 0 = off
            minR: 1,             // px — mote radius range
            maxR: 3,
            minDriftX: -14,      // px/sec — horizontal drift range (gentle leftward)
            maxDriftX: -4,
            minVy: -22,          // px/sec — vertical drift (negative = floats up)
            maxVy: -6,
            swayAmp: 12,         // px — sideways sway amplitude
            minSwayFreq: 0.4,    // rad/sec — sway speed range
            maxSwayFreq: 1.1,
            minAlpha: 0.12,      // base opacity range
            maxAlpha: 0.5,
            twinkleAmp: 0.25,    // opacity wobble (fraction of base)
            minTwinkleFreq: 0.6, // rad/sec — twinkle speed range
            maxTwinkleFreq: 1.8,
            color: [255, 246, 214], // warm pollen tint
        },
    },
};
