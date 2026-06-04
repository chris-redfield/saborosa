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

    // Title: entrance (drop-in + fade) then perpetual idle motion.
    title: {
        enterDur: 0.7,           // sec — drop-in with slight overshoot
        enterDrop: 70,           // px it falls in from
        fadeInDur: 0.5,          // sec — opacity ramp
        settleDelay: 0.5,        // sec before idle motion starts ramping in
        settleDur: 0.5,          // sec for idle motion to reach full strength
        bobAmp: 6,               // px — vertical idle bob
        bobFreq: 1.6,            // rad/sec
        breatheAmp: 0.012,       // scale wobble amount
        breatheFreq: 1.2,        // rad/sec
        punchKick: 0.35,         // extra scale added during the confirm punch
    },

    // Menu: animated selection feel.
    menu: {
        selectEaseRate: 16,      // how fast the highlight glides between items
        pulseDecay: 0.22,        // sec — per-change "pop" fade
        pulseScale: 0.10,        // extra scale on a selection change
        selScale: 1.18,          // selected item scale
        selSlide: 6,             // px — selected item slides right
        idleAlpha: 0.82,         // alpha of unselected items (selected = 1)
        selColor: [255, 209, 102], // gold the selected item tweens to
        arrowGap: 26,            // px — arrows sit this far from the text edge
        arrowBreatheFreq: 4,     // rad/sec — arrow in/out
        arrowBreatheAmp: 3,      // px — arrow in/out
        fadeOnStartFactor: 0.6,  // menu fades over (punch.dur * this) during punch
    },

    // Confirm punch when START is pressed.
    punch: {
        dur: 0.55,               // sec — total punch length before handoff
        flashStrength: 0.7,      // peak white-flash alpha
        flashDecay: 0.35,        // sec — flash fade
        shakeAmp: 14,            // px — peak shake
        shakeFreqX: 62,          // rad/sec — horizontal jitter
        shakeFreqY: 53,          // rad/sec — vertical jitter
        shakeYScale: 0.6,        // vertical shake is gentler than horizontal
    },

    // Black cover + game fade-in after START.
    reveal: {
        fadeDur: 0.4,            // sec — black cover fades out to reveal the game
    },
};
