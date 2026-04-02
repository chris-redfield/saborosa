/**
 * CRT Filter - WebGL post-processing shader applied to the game canvas
 *
 * Effects: curvature, scanlines, shadow mask, chromatic aberration,
 * vignette, noise, flicker.
 *
 * Toggle with F key.
 */
class CRTFilter {
    constructor(sourceCanvas) {
        this.sourceCanvas = sourceCanvas;
        this.enabled = false;

        // Wrap the game canvas so we can overlay the CRT canvas on top
        this.wrapper = document.createElement('div');
        this.wrapper.style.position = 'relative';
        this.wrapper.style.display = 'inline-block';
        sourceCanvas.parentNode.insertBefore(this.wrapper, sourceCanvas);
        this.wrapper.appendChild(sourceCanvas);

        // Create WebGL canvas (overlays game canvas)
        this.canvas = document.createElement('canvas');
        this.canvas.width = sourceCanvas.width;
        this.canvas.height = sourceCanvas.height;
        this.canvas.id = 'crt-canvas';
        this.canvas.style.position = 'absolute';
        this.canvas.style.top = '0';
        this.canvas.style.left = '0';
        this.canvas.style.display = 'none';
        this.wrapper.appendChild(this.canvas);

        const gl = this.canvas.getContext('webgl', { alpha: false, antialias: false });
        if (!gl) {
            console.warn('WebGL not available, CRT filter disabled');
            this.gl = null;
            return;
        }
        this.gl = gl;
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

        this._initShaders();
        if (!this.program) return;
        this._initGeometry();
        this._initTexture();

        this.startTime = performance.now() / 1000;
        console.log('CRT filter ready (press F to toggle)');
    }

    _compileShader(type, source) {
        const gl = this.gl;
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.error('Shader compile error:', gl.getShaderInfoLog(shader));
            return null;
        }
        return shader;
    }

    _initShaders() {
        const gl = this.gl;

        const vsSource = [
            'attribute vec4 pos;',
            'varying vec2 uv;',
            'void main() {',
            '  gl_Position = vec4(pos.xy, 0.0, 1.0);',
            '  uv = pos.zw;',
            '}'
        ].join('\n');

        const fsSource = [
            'precision mediump float;',
            'varying vec2 uv;',
            'uniform sampler2D tex;',
            'uniform vec2 resolution;',
            'uniform float time;',
            '',
            'vec2 curve(vec2 p) {',
            '  p = (p - 0.5) * 2.0;',
            '  p *= 1.1;',
            '  p.x *= 1.0 + pow(abs(p.y) / 5.0, 2.0);',
            '  p.y *= 1.0 + pow(abs(p.x) / 4.0, 2.0);',
            '  p = (p / 2.0) + 0.5;',
            '  p = p * 0.92 + 0.04;',
            '  return p;',
            '}',
            '',
            'float rand(vec2 co) {',
            '  return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);',
            '}',
            '',
            'void main() {',
            '  vec2 cuv = mix(curve(uv), uv, 0.7);',
            '',
            '  if (cuv.x < 0.0 || cuv.x > 1.0 || cuv.y < 0.0 || cuv.y > 1.0) {',
            '    gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);',
            '    return;',
            '  }',
            '',
            '  float x = sin(0.1 * time + cuv.y * 13.0)',
            '          * sin(0.23 * time + cuv.y * 19.0) * 0.003;',
            '  vec3 col;',
            '  col.r = texture2D(tex, vec2(cuv.x + x + 0.001, cuv.y)).r;',
            '  col.g = texture2D(tex, vec2(cuv.x + x, cuv.y)).g;',
            '  col.b = texture2D(tex, vec2(cuv.x + x - 0.001, cuv.y)).b;',
            '',
            '  float scan = 0.75 + 0.08 * sin(cuv.y * resolution.y * 1.5);',
            '  col *= scan;',
            '',
            '  col *= 1.0 - 0.10 * clamp(mod(gl_FragCoord.x, 3.0) / 2.0, 0.0, 1.0);',
            '',
            '  float vig = 16.0 * cuv.x * cuv.y * (1.0 - cuv.x) * (1.0 - cuv.y);',
            '  col *= pow(vig, 0.15);',
            '',
            '  col -= 0.008 * vec3(rand(cuv * resolution.xy + time));',
            '',
            '  col *= 1.0 - 0.002 * sin(50.0 * time + cuv.y * 2.0);',
            '',
            '  col *= 1.2;',
            '',
            '  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);',
            '}'
        ].join('\n');

        const vs = this._compileShader(gl.VERTEX_SHADER, vsSource);
        const fs = this._compileShader(gl.FRAGMENT_SHADER, fsSource);

        if (!vs || !fs) {
            console.error('CRT: shader compilation failed');
            this.program = null;
            return;
        }

        this.program = gl.createProgram();
        gl.attachShader(this.program, vs);
        gl.attachShader(this.program, fs);
        gl.linkProgram(this.program);

        if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
            console.error('CRT link error:', gl.getProgramInfoLog(this.program));
            this.program = null;
            return;
        }

        gl.useProgram(this.program);

        this.uniforms = {
            tex: gl.getUniformLocation(this.program, 'tex'),
            resolution: gl.getUniformLocation(this.program, 'resolution'),
            time: gl.getUniformLocation(this.program, 'time')
        };
        this.attribPos = gl.getAttribLocation(this.program, 'pos');
    }

    _initGeometry() {
        const gl = this.gl;
        const verts = new Float32Array([
            -1, -1, 0, 0,
             1, -1, 1, 0,
            -1,  1, 0, 1,
             1,  1, 1, 1
        ]);
        this.vbo = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
        gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);
        gl.enableVertexAttribArray(this.attribPos);
        gl.vertexAttribPointer(this.attribPos, 4, gl.FLOAT, false, 0, 0);
    }

    _initTexture() {
        const gl = this.gl;
        this.texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    }

    syncSize() {
        this.canvas.style.width = this.sourceCanvas.style.width;
        this.canvas.style.height = this.sourceCanvas.style.height;
    }

    render() {
        if (!this.enabled || !this.gl || !this.program) return;
        const gl = this.gl;

        gl.bindTexture(gl.TEXTURE_2D, this.texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.sourceCanvas);

        gl.useProgram(this.program);
        gl.uniform1i(this.uniforms.tex, 0);
        gl.uniform2f(this.uniforms.resolution, this.canvas.width, this.canvas.height);
        gl.uniform1f(this.uniforms.time, performance.now() / 1000 - this.startTime);

        gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    toggle() {
        if (!this.gl || !this.program) return false;
        this.enabled = !this.enabled;
        this.syncSize();
        this.canvas.style.display = this.enabled ? 'block' : 'none';
        return this.enabled;
    }
}

window.CRTFilter = CRTFilter;
