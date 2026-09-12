class RippleTankSimulation {
    constructor() {
        this.model = new RippleTankModel();
        this.speed = 0.3;
        this.probe = 30;
        this.showRays = true;
        this.isRunning = false;
        this.animationId = null;
        this.lastTimestamp = null;
        this.canvases = ['mainCanvas', 'screenCanvas', 'brightnessCanvas'].map(id => document.getElementById(id));
        this.bindControls();
        this.resizeObserver = new ResizeObserver(() => this.resize());
        this.canvases.forEach(canvas => this.resizeObserver.observe(canvas));
        document.addEventListener('visibilitychange', () => { if (document.hidden) this.pause(); });
        this.resize();
        this.syncControls();
    }

    bindControls() {
        for (const key of ['wavelength', 'amplitude', 'frequency', 'screenGap']) {
            document.getElementById(key + 'Slider').addEventListener('input', event => {
                this.model[key] = Number(event.target.value);
                this.syncControls();
                this.draw();
            });
        }
        document.getElementById('waveMode').addEventListener('change', event => {
            this.model.mode = event.target.value;
            this.draw();
        });
        document.getElementById('speedSlider').addEventListener('input', event => {
            this.speed = Number(event.target.value);
            this.syncControls();
        });
        document.getElementById('showRays').addEventListener('change', event => {
            this.showRays = event.target.checked;
            this.draw();
        });
        document.getElementById('probeSlider').addEventListener('input', event => {
            this.probe = Number(event.target.value);
            this.draw();
        });
        this.canvases.forEach(canvas => canvas.addEventListener('pointerdown', event => {
            const rect = canvas.getBoundingClientRect();
            const plot = this.plot(canvas);
            this.probe = Math.max(0, Math.min(this.model.width, (event.clientX - rect.left - plot.left) / plot.width * this.model.width));
            document.getElementById('probeSlider').value = this.probe;
            this.draw();
        }));
        document.getElementById('startBtn').addEventListener('click', () => this.start());
        document.getElementById('pauseBtn').addEventListener('click', () => this.pause());
        document.getElementById('resetBtn').addEventListener('click', () => this.reset());
        document.getElementById('stepBtn').addEventListener('click', () => {
            this.pause();
            this.model.time += 1 / 30;
            this.draw();
        });
        for (const [id, mode, amplitude] of [['presetTraveling', 'traveling', 0.35], ['presetStanding', 'standing', 0.35], ['presetFlat', 'traveling', 0]]) {
            document.getElementById(id).addEventListener('click', () => {
                Object.assign(this.model, { mode, amplitude, wavelength: 12, frequency: 1, screenGap: 12 });
                this.syncControls();
                this.reset();
            });
        }
    }

    syncControls() {
        for (const [key, decimals] of [['wavelength', 1], ['amplitude', 2], ['frequency', 1], ['screenGap', 0]]) {
            document.getElementById(key + 'Slider').value = this.model[key];
            document.getElementById(key + 'Value').textContent = this.model[key].toFixed(decimals);
        }
        document.getElementById('waveMode').value = this.model.mode;
        document.getElementById('speedValue').textContent = this.speed.toFixed(1) + '×';
    }

    start() {
        if (this.isRunning) return;
        this.isRunning = true;
        this.lastTimestamp = null;
        document.getElementById('startBtn').disabled = true;
        document.getElementById('pauseBtn').disabled = false;
        this.animationId = requestAnimationFrame(time => this.animate(time));
    }

    pause() {
        this.isRunning = false;
        if (this.animationId !== null) cancelAnimationFrame(this.animationId);
        this.animationId = null;
        this.lastTimestamp = null;
        document.getElementById('startBtn').disabled = false;
        document.getElementById('pauseBtn').disabled = true;
    }

    reset() {
        this.pause();
        this.model.time = 0;
        this.draw();
    }

    animate(timestamp) {
        if (!this.isRunning) return;
        if (this.lastTimestamp !== null) this.model.time += Math.min((timestamp - this.lastTimestamp) / 1000, 0.06) * this.speed;
        this.lastTimestamp = timestamp;
        this.draw();
        this.animationId = requestAnimationFrame(time => this.animate(time));
    }

    resize() {
        const dpr = window.devicePixelRatio || 1;
        this.canvases.forEach(canvas => {
            const rect = canvas.getBoundingClientRect();
            canvas.width = Math.round(rect.width * dpr);
            canvas.height = Math.round(rect.height * dpr);
            canvas.getContext('2d').setTransform(dpr, 0, 0, dpr, 0, 0);
        });
        this.draw();
    }

    plot(canvas) {
        const rect = canvas.getBoundingClientRect();
        return { W: rect.width, H: rect.height, left: 48, width: rect.width - 64 };
    }

    prepare(canvas) {
        const ctx = canvas.getContext('2d');
        const plot = this.plot(canvas);
        ctx.fillStyle = '#0c1928';
        ctx.fillRect(0, 0, plot.W, plot.H);
        ctx.font = '13px "Microsoft JhengHei", sans-serif';
        return { ctx, ...plot, x: value => plot.left + value / this.model.width * plot.width };
    }

    line(ctx, x1, y1, x2, y2, color, width = 1) {
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
    }

    probeLine(ctx, x, top, bottom) {
        ctx.setLineDash([4, 4]);
        this.line(ctx, x, top, x, bottom, '#ff8cbe', 1.5);
        ctx.setLineDash([]);
    }

    draw() {
        this.frame = this.model.computeFrame();
        this.drawTank();
        this.drawScreen();
        this.drawGraph();
        document.getElementById('timeValue').textContent = this.model.time.toFixed(2);
        document.getElementById('waveSpeedValue').textContent = (this.model.wavelength * this.model.frequency).toFixed(1);
        document.getElementById('probeValue').textContent = this.probe.toFixed(1);
        document.getElementById('intensityValue').textContent = this.frame.intensity[Math.round(this.probe / this.model.binSize)].toFixed(2);
    }

    drawTank() {
        const { ctx, W, H, left, width, x } = this.prepare(this.canvases[0]);
        const meanY = H * 0.28;
        const bottomY = H * 0.61;
        const screenY = H - 22;
        const surface = value => meanY - this.model.height(value) * (bottomY - meanY) / this.model.depth;
        ctx.save();
        ctx.beginPath();
        ctx.rect(left, 8, width, H - 16);
        ctx.clip();
        ctx.beginPath();
        ctx.moveTo(left, bottomY);
        for (let i = 0; i <= 400; i++) {
            const value = this.model.width * i / 400;
            ctx.lineTo(x(value), surface(value));
        }
        ctx.lineTo(left + width, bottomY);
        ctx.closePath();
        ctx.fillStyle = '#163e56';
        ctx.fill();
        if (this.showRays) {
            for (const ray of this.frame.rays) {
                const sx = x(ray.x);
                const sy = surface(ray.x);
                this.line(ctx, sx, 12, sx, sy, '#edc56588');
                this.line(ctx, sx, sy, x(ray.bottomX), bottomY, '#8ad5ffb0');
                if (ray.hitX !== null) this.line(ctx, x(ray.bottomX), bottomY, x(ray.hitX), screenY, '#edc565aa');
            }
        }
        ctx.beginPath();
        for (let i = 0; i <= 400; i++) {
            const value = this.model.width * i / 400;
            const px = x(value), py = surface(value);
            if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.strokeStyle = '#70d7ff';
        ctx.lineWidth = 3;
        ctx.stroke();
        this.line(ctx, left, bottomY, left + width, bottomY, '#9fb6c9', 2);
        this.line(ctx, left, screenY, left + width, screenY, '#e8dfbe', 3);
        this.probeLine(ctx, x(this.probe), 8, screenY + 5);
        ctx.fillStyle = '#ff8cbe';
        ctx.beginPath();
        ctx.arc(x(this.probe), surface(this.probe), 4, 0, 2 * Math.PI);
        ctx.fill();
        ctx.restore();
        ctx.fillStyle = '#d0e0ef';
        ctx.textAlign = 'left';
        ctx.fillText('水面', 8, meanY + 4);
        ctx.fillText('槽底', 8, bottomY + 4);
        ctx.fillText('屏幕', 8, screenY + 4);
        ctx.textAlign = 'right';
        ctx.fillStyle = '#b9cddc';
        ctx.fillText(this.model.mode === 'standing' ? '駐波：節點不移動' : this.model.mode === 'travelingLeft' ? '← 波向左傳播' : '波向右傳播 →', W - 16, H - 4);
    }

    drawScreen() {
        const { ctx, H, left, width, x } = this.prepare(this.canvases[1]);
        const values = this.frame.intensity;
        for (let i = 0; i < values.length - 1; i++) {
            // Fixed exposure; no per-frame maximum normalization.
            const gray = Math.round(255 * (1 - Math.exp(-0.7 * values[i])));
            ctx.fillStyle = 'rgb(' + gray + ',' + gray + ',' + gray + ')';
            ctx.fillRect(left + i / (values.length - 1) * width, 4, width / (values.length - 1) + 1, H - 22);
        }
        this.probeLine(ctx, x(this.probe), 1, H - 17);
        ctx.fillStyle = '#c1d3e3';
        ctx.textAlign = 'center';
        for (let value = 0; value <= 60; value += 10) ctx.fillText(String(value), x(value), H - 3);
        ctx.textAlign = 'left';
        ctx.fillText('cm', 9, H - 3);
    }

    drawGraph() {
        const { ctx, H, left, width, x } = this.prepare(this.canvases[2]);
        const values = this.frame.intensity;
        const max = Math.max(2, Math.ceil(Math.max(...values)));
        const top = 14, bottom = H - 16;
        const y = value => bottom - value / max * (bottom - top);
        ctx.textAlign = 'right';
        ctx.fillStyle = '#c1d3e3';
        for (const value of [0, max / 2, max]) {
            this.line(ctx, left, y(value), left + width, y(value), '#2b4054');
            ctx.fillText(value.toFixed(1), left - 7, y(value) + 4);
        }
        ctx.setLineDash([5, 4]);
        this.line(ctx, left, y(1), left + width, y(1), '#8b9daf');
        ctx.setLineDash([]);
        ctx.beginPath();
        for (let i = 0; i < values.length; i++) {
            const px = left + i / (values.length - 1) * width;
            if (i === 0) ctx.moveTo(px, y(values[i])); else ctx.lineTo(px, y(values[i]));
        }
        ctx.strokeStyle = '#ffcd64';
        ctx.lineWidth = 2;
        ctx.stroke();
        this.probeLine(ctx, x(this.probe), top, bottom);
    }
}
window.rippleTank = new RippleTankSimulation();
