/**
 * PERF — lightweight frame profiler + on-screen HUD (visible while holding C,
 * the existing debug key). See PERFORMANCE.md for what each line means and the
 * full optimization plan this instrumentation supports.
 *
 * Design constraints:
 *  - ZERO per-frame allocation (stat objects are created once per section name
 *    and reused) — profiling must not create the GC pressure it's measuring.
 *  - Negligible overhead when the HUD is hidden: begin/end are two
 *    performance.now() calls per section (~10 calls/frame total).
 *
 * API (all no-ops if a name is new — sections/counters self-register):
 *  PERF.frame(now)        — call ONCE per rAF, first thing, with the rAF timestamp
 *  PERF.begin(name) / PERF.end(name)
 *                         — time a section; multiple begin/end pairs per frame
 *                           accumulate (e.g. the overlay draws twice)
 *  PERF.count(name, n=1)  — bump a per-frame counter (e.g. zone lookups)
 *  PERF.note(name, value) — publish a value as-is (e.g. updates this frame)
 *  PERF.render(ctx, game) — draw the HUD panel (call only while debug is held)
 */
(function () {

const EMA = 0.05;        // smoothing for the avg column
const MAX_DECAY = 0.985; // decaying max, so spikes stay visible ~2s then fade
const LONG_FRAME_MS = 33.4; // anything slower than ~30fps counts as a long frame

class PerfMonitor {
    constructor() {
        this._secNames = [];
        this._sec = Object.create(null);   // name -> {t0, ms, last, avg, max}
        this._cntNames = [];
        this._cnt = Object.create(null);   // name -> {n, last}
        this._noteNames = [];
        this._notes = Object.create(null); // name -> value

        this._lastTs = 0;
        this.frameMs = 0;   // last full rAF-to-rAF time
        this.frameAvg = 0;
        this.frameMax = 0;
        this.workMs = 0;    // measured JS work last frame (sum of sections)
        this.fps = 0;
        this._fpsCount = 0;
        this._fpsTime = 0;

        // Long frames in a rolling 5s bucket (GC spikes / decode hitches show
        // up here even when the averages look fine).
        this.longIn5s = 0;
        this._bucketLong = 0;
        this._bucketStart = 0;
    }

    _section(name) {
        let s = this._sec[name];
        if (!s) {
            s = this._sec[name] = { t0: 0, ms: 0, last: 0, avg: 0, max: 0 };
            this._secNames.push(name);
        }
        return s;
    }

    // Roll the previous frame's accumulators into stats, start a new frame.
    frame(now) {
        if (this._lastTs) {
            this.frameMs = now - this._lastTs;
            this.frameAvg += (this.frameMs - this.frameAvg) * EMA;
            this.frameMax = Math.max(this.frameMs, this.frameMax * MAX_DECAY);

            this._fpsCount++;
            this._fpsTime += this.frameMs;
            if (this._fpsTime >= 500) {
                this.fps = Math.round(this._fpsCount * 1000 / this._fpsTime);
                this._fpsCount = 0;
                this._fpsTime = 0;
            }

            if (this.frameMs > LONG_FRAME_MS) this._bucketLong++;
            if (now - this._bucketStart >= 5000) {
                this.longIn5s = this._bucketLong;
                this._bucketLong = 0;
                this._bucketStart = now;
            }

            for (let i = 0; i < this._secNames.length; i++) {
                const s = this._sec[this._secNames[i]];
                s.last = s.ms;
                s.avg += (s.ms - s.avg) * EMA;
                s.max = Math.max(s.ms, s.max * MAX_DECAY);
                s.ms = 0;
            }
            // Total JS work = the two TOP-LEVEL sections only (ground/overlay/
            // entities/fx are nested inside 'render' — summing all would
            // double-count).
            this.workMs = (this._sec.update ? this._sec.update.last : 0)
                        + (this._sec.render ? this._sec.render.last : 0);

            for (let i = 0; i < this._cntNames.length; i++) {
                const c = this._cnt[this._cntNames[i]];
                c.last = c.n;
                c.n = 0;
            }
        } else {
            this._bucketStart = now;
        }
        this._lastTs = now;
    }

    begin(name) {
        this._section(name).t0 = performance.now();
    }

    end(name) {
        const s = this._sec[name];
        if (s) s.ms += performance.now() - s.t0;
    }

    count(name, n) {
        let c = this._cnt[name];
        if (!c) {
            c = this._cnt[name] = { n: 0, last: 0 };
            this._cntNames.push(name);
        }
        c.n += (n === undefined ? 1 : n);
    }

    note(name, value) {
        if (!(name in this._notes)) this._noteNames.push(name);
        this._notes[name] = value;
    }

    render(ctx, game) {
        const lines = [];
        const f1 = (v) => v.toFixed(1).padStart(5);
        lines.push(`frame ${f1(this.frameMs)}  avg ${f1(this.frameAvg)}  max ${f1(this.frameMax)}  fps ${this.fps}`);
        // "other" = frame time not accounted for by measured JS work. At a
        // healthy fps this is just vsync idle; at LOW fps a big "other" means
        // the browser itself (canvas present/composite, software raster, GC)
        // is the bottleneck, not our JS. The key no-GPU signal.
        const other = Math.max(0, this.frameMs - this.workMs);
        lines.push(`work  ${f1(this.workMs)}  other ${f1(other)}  long(5s) ${this.longIn5s}`);
        for (let i = 0; i < this._secNames.length; i++) {
            const n = this._secNames[i];
            const s = this._sec[n];
            lines.push(`${n.padEnd(8)} ${f1(s.last)}  avg ${f1(s.avg)}  max ${f1(s.max)}`);
        }
        let extras = '';
        for (let i = 0; i < this._cntNames.length; i++) {
            const n = this._cntNames[i];
            extras += `${n} ${this._cnt[n].last}  `;
        }
        for (let i = 0; i < this._noteNames.length; i++) {
            const n = this._noteNames[i];
            extras += `${n} ${this._notes[n]}  `;
        }
        if (extras) lines.push(extras.trimEnd());
        if (performance.memory) {
            lines.push(`heap ${(performance.memory.usedJSHeapSize / 1048576) | 0}MB (js only, chrome)`);
        }

        const lh = 14, pad = 8, w = 318;
        const h = lines.length * lh + pad * 2;
        const x = game.width - w - 10, y = 34;
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = 'rgba(0,0,0,0.72)';
        ctx.fillRect(x, y, w, h);
        ctx.font = '11px ui-monospace, monospace';
        ctx.fillStyle = '#9f9';
        for (let i = 0; i < lines.length; i++) {
            ctx.fillText(lines[i], x + pad, y + pad + 10 + i * lh);
        }
        ctx.restore();
    }
}

window.PERF = new PerfMonitor();

})();
