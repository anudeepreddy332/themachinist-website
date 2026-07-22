    // ── Reading progress ──
    window.addEventListener('scroll', () => {
        const d = document.documentElement;
        const pct = (d.scrollTop / (d.scrollHeight - d.clientHeight)) * 100;
        document.getElementById('reading-progress').style.width = pct + '%';
    });

    // ── Active section nav ──
    const navLinks = document.querySelectorAll('.section-nav a');
    const sections = document.querySelectorAll('section[id]');
    const secObs = new IntersectionObserver(entries => {
        entries.forEach(e => {
            if (e.isIntersecting) {
                const id = e.target.id;
                navLinks.forEach(l => l.classList.toggle('active', l.getAttribute('href') === '#' + id));
            }
        });
    }, { rootMargin: '-15% 0px -72% 0px' });
    sections.forEach(s => secObs.observe(s));

    // ── Shared chart config ──
    const isDark = () => document.documentElement.getAttribute('data-theme') === 'dark';
    const gc = () => isDark() ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)';
    const tc = () => isDark() ? '#9ca3af' : '#6b7280';
    const ff = "'Inter', sans-serif";

    // ── Loss surface canvas drawing ──
    function drawLossSurface() {
        const canvas = document.getElementById('lossSurfaceCanvas');
        if (!canvas) return;
        const dpr = window.devicePixelRatio || 1;
        const W = canvas.offsetWidth || 680;
        const H = 230;
        canvas.width  = W * dpr;
        canvas.height = H * dpr;
        canvas.style.width  = W + 'px';
        canvas.style.height = H + 'px';
        const ctx = canvas.getContext('2d');
        ctx.scale(dpr, dpr);

        const dark = isDark();
        const bg   = dark ? '#18181b' : '#ffffff';
        const divC = dark ? '#27272a' : '#e5e7eb';
        const labC = dark ? '#9ca3af' : '#6b7280';
        const red  = '#ef4444';
        const grn  = '#10b981';

        ctx.clearRect(0, 0, W, H);
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, W, H);

        const half = W / 2;
        const lx = half * 0.5, ly = H * 0.47;
        const rx = half + half * 0.5, ry = H * 0.47;

        // ---- LEFT: elongated ellipses ----
        [[half*0.40, H*0.11], [half*0.26, H*0.075], [half*0.13, H*0.038]].forEach(([ex, ey], i) => {
            ctx.beginPath();
            ctx.ellipse(lx, ly, ex, ey, 0, 0, 2*Math.PI);
            ctx.strokeStyle = `rgba(239,68,68,${0.28 + i*0.24})`;
            ctx.lineWidth = 1.5;
            ctx.stroke();
        });
        // zigzag path
        const zz = [
            {x: lx - half*0.34, y: ly},
            {x: lx - half*0.26, y: ly - H*0.05},
            {x: lx - half*0.18, y: ly + H*0.04},
            {x: lx - half*0.10, y: ly - H*0.025},
            {x: lx - half*0.04, y: ly + H*0.01},
            {x: lx, y: ly}
        ];
        ctx.beginPath();
        ctx.moveTo(half, H*0.04);
        ctx.lineTo(half, H*0.86);
        ctx.moveTo(zz[0].x, zz[0].y);
        zz.slice(1).forEach(p => ctx.lineTo(p.x, p.y));
        ctx.strokeStyle = 'rgba(239,68,68,0.85)';
        ctx.lineWidth = 2;
        ctx.setLineDash([4,3]);
        ctx.stroke();
        ctx.setLineDash([]);
        // dot at minimum
        ctx.beginPath(); ctx.arc(lx, ly, 4, 0, 2*Math.PI);
        ctx.fillStyle = red; ctx.fill();

        // label
        ctx.fillStyle = labC; ctx.font = `500 11px ${ff}`; ctx.textAlign = 'center';
        ctx.fillText('Unscaled: gradient zigzags', lx, H * 0.93);

        // ---- DIVIDER ----
        ctx.beginPath(); ctx.moveTo(half, H*0.04); ctx.lineTo(half, H*0.84);
        ctx.strokeStyle = divC; ctx.lineWidth = 1; ctx.stroke();

        // ---- RIGHT: round circles ----
        [H*0.30, H*0.20, H*0.10].forEach((r, i) => {
            ctx.beginPath(); ctx.arc(rx, ry, r, 0, 2*Math.PI);
            ctx.strokeStyle = `rgba(16,185,129,${0.28 + i*0.24})`;
            ctx.lineWidth = 1.5; ctx.stroke();
        });
        // straight path
        const sx = rx - H*0.26, sy = ry + H*0.05;
        ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(rx, ry);
        ctx.strokeStyle = 'rgba(16,185,129,0.85)';
        ctx.lineWidth = 2; ctx.stroke();
        // arrowhead
        const ang = Math.atan2(ry - sy, rx - sx);
        ctx.beginPath();
        ctx.moveTo(rx, ry);
        ctx.lineTo(rx - 10*Math.cos(ang-0.4), ry - 10*Math.sin(ang-0.4));
        ctx.lineTo(rx - 10*Math.cos(ang+0.4), ry - 10*Math.sin(ang+0.4));
        ctx.closePath();
        ctx.fillStyle = 'rgba(16,185,129,0.85)'; ctx.fill();
        // dot at minimum
        ctx.beginPath(); ctx.arc(rx, ry, 4, 0, 2*Math.PI);
        ctx.fillStyle = grn; ctx.fill();

        ctx.fillStyle = labC; ctx.font = `500 11px ${ff}`; ctx.textAlign = 'center';
        ctx.fillText('Scaled: converges directly', rx, H * 0.93);
    }
    drawLossSurface();

    // ── Before / After StandardScaler ──
    (function() {
        const ctx = document.getElementById('beforeAfterChart').getContext('2d');
        const raw    = [20, 25, 28, 32, 35, 38, 40];
        const mean   = raw.reduce((a,b) => a+b,0) / raw.length;
        const std    = Math.sqrt(raw.reduce((a,b) => a + (b-mean)**2, 0) / raw.length);
        const scaled = raw.map(v => +((v-mean)/std).toFixed(2));
        const labels = raw.map(v => 'Age ' + v);

        new Chart(ctx, {
            type: 'bar',
            data: {
                labels,
                datasets: [
                    {
                        label: 'Raw values',
                        data: raw,
                        backgroundColor: 'rgba(59,130,246,0.55)',
                        borderColor: 'rgba(59,130,246,0.9)',
                        borderWidth: 1, borderRadius: 3,
                        yAxisID: 'y'
                    },
                    {
                        label: 'After StandardScaler',
                        data: scaled,
                        backgroundColor: 'rgba(249,115,22,0.55)',
                        borderColor: 'rgba(249,115,22,0.9)',
                        borderWidth: 1, borderRadius: 3,
                        yAxisID: 'y1'
                    }
                ]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { labels: { color: tc(), font: { family: ff, size: 11 }, boxWidth: 11 } }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: { color: tc(), font: { family: ff, size: 10 } }
                    },
                    y: {
                        position: 'left', grid: { color: gc() },
                        ticks: { color: 'rgba(59,130,246,0.8)', font: { family: ff, size: 10 } },
                        title: { display: true, text: 'Raw', color: 'rgba(59,130,246,0.8)', font: { family: ff, size: 10 } }
                    },
                    y1: {
                        position: 'right', grid: { display: false },
                        ticks: { color: 'rgba(249,115,22,0.8)', font: { family: ff, size: 10 } },
                        title: { display: true, text: 'Scaled', color: 'rgba(249,115,22,0.8)', font: { family: ff, size: 10 } }
                    }
                }
            }
        });
    })();

    // ── Sigmoid ──
    (function() {
        const ctx = document.getElementById('sigmoidChart').getContext('2d');
        const xs = [];
        for (let x = -8; x <= 8; x += 0.2) xs.push(+x.toFixed(1));
        const sig  = xs.map(x => +(1/(1+Math.exp(-x))).toFixed(4));
        const grad = xs.map(x => { const s = 1/(1+Math.exp(-x)); return +(s*(1-s)).toFixed(4); });

        new Chart(ctx, {
            type: 'line',
            data: {
                labels: xs,
                datasets: [
                    {
                        label: 'σ(x): output',
                        data: sig,
                        borderColor: 'rgba(59,130,246,0.85)',
                        fill: false, pointRadius: 0,
                        borderWidth: 2, tension: 0.3
                    },
                    {
                        label: 'Gradient',
                        data: grad,
                        borderColor: 'rgba(249,115,22,0.85)',
                        fill: false, pointRadius: 0,
                        borderWidth: 2, borderDash: [5,4],
                        tension: 0.3
                    }
                ]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { labels: { color: tc(), font: { family: ff, size: 11 }, boxWidth: 11 } }
                },
                scales: {
                    x: {
                        grid: { color: gc() },
                        ticks: { color: tc(), font: { family: ff, size: 10 }, maxTicksLimit: 9 },
                        title: { display: true, text: 'Input x', color: tc(), font: { family: ff, size: 10 } }
                    },
                    y: {
                        grid: { color: gc() },
                        ticks: { color: tc(), font: { family: ff, size: 10 } }
                    }
                }
            }
        });
    })();

    // Redraw canvas on theme toggle
    document.getElementById('themeToggle')?.addEventListener('click', () => {
        setTimeout(drawLossSurface, 50);
    });
