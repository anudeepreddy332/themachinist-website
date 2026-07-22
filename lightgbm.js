        // ── Reading progress ──
        window.addEventListener('scroll', () => {
            const el  = document.documentElement;
            const pct = el.scrollTop / (el.scrollHeight - el.clientHeight) * 100;
            document.getElementById('reading-progress').style.width = pct + '%';
        });

        // ── Chart helpers ──
        const isDark = () => document.documentElement.getAttribute('data-theme') === 'dark';
        const gc  = () => isDark() ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)';
        const tc  = () => isDark() ? '#9ca3af' : '#6b7280';
        const ff  = "'Inter', sans-serif";
        let boostingChartInst, speedChartInst;

        // ── Redraw charts when theme changes ──
        new MutationObserver(() => redrawCharts())
            .observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

        // ── Section nav active state ──
        const navLinks = document.querySelectorAll('.section-nav a');
        const sections = document.querySelectorAll('section[id]');
        const observer = new IntersectionObserver(entries => {
            entries.forEach(e => {
                if (e.isIntersecting) {
                    navLinks.forEach(l => l.classList.remove('active'));
                    const link = document.querySelector(`.section-nav a[href="#${e.target.id}"]`);
                    if (link) link.classList.add('active');
                }
            });
        }, { rootMargin: '-130% 0px -55% 0px' });
        sections.forEach(s => observer.observe(s));

        // ── Chart 1: Boosting iterations loss curve ──
        function buildBoostingChart() {
            if (boostingChartInst) boostingChartInst.destroy();
            const rounds = Array.from({length:40}, (_,i)=>i+1);
            const lgbmLoss  = rounds.map(r => 0.68 * Math.exp(-0.10 * r) + 0.07 + (Math.random()*0.005));
            const xgbLoss   = rounds.map(r => 0.68 * Math.exp(-0.07 * r) + 0.09 + (Math.random()*0.005));
            const rfLoss    = rounds.map(() => 0.21 + (Math.random()*0.008));
            const ctx = document.getElementById('boostingChart').getContext('2d');
            boostingChartInst = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: rounds,
                    datasets: [
                        {
                            label: 'LightGBM',
                            data: lgbmLoss,
                            borderColor: 'rgba(249,115,22,0.9)',
                            backgroundColor: 'transparent',
                            pointRadius: 0, borderWidth: 2.5, tension: 0.4
                        },
                        {
                            label: 'XGBoost',
                            data: xgbLoss,
                            borderColor: 'rgba(59,130,246,0.7)',
                            backgroundColor: 'transparent',
                            pointRadius: 0, borderWidth: 2, tension: 0.4,
                            borderDash: [5,3]
                        },
                        {
                            label: 'Random Forest (reference)',
                            data: rfLoss,
                            borderColor: 'rgba(107,114,128,0.4)',
                            backgroundColor: 'transparent',
                            pointRadius: 0, borderWidth: 1.5, tension: 0,
                            borderDash: [2,4]
                        }
                    ]
                },
                options: {
                    responsive: true,
                    plugins: {
                        legend: { labels: { color: tc(), font:{family:ff,size:11}, boxWidth:11 } }
                    },
                    scales: {
                        x: {
                            grid: { color: gc() },
                            ticks: { color: tc(), font:{family:ff,size:10} },
                            title: { display:true, text:'Boosting Round', color:tc(), font:{family:ff,size:10} }
                        },
                        y: {
                            grid: { color: gc() },
                            ticks: { color: tc(), font:{family:ff,size:10} },
                            title: { display:true, text:'Validation Loss', color:tc(), font:{family:ff,size:10} },
                            min: 0, max: 0.75
                        }
                    }
                }
            });
        }

        // ── Chart 2: Speed comparison by dataset size ──
        function buildSpeedChart() {
            if (speedChartInst) speedChartInst.destroy();
            const labels = ['10k rows', '100k rows', '500k rows', '2M rows', '10M rows'];
            const lgbm   = [1.0, 1.0, 1.0, 1.0, 1.0];
            const xgb    = [1.2, 1.8, 3.1, 5.2, 9.0];
            const catb   = [1.1, 1.5, 2.4, 4.0, 7.5];
            const ctx = document.getElementById('speedChart').getContext('2d');
            speedChartInst = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels,
                    datasets: [
                        { label:'LightGBM', data:lgbm,  backgroundColor:'rgba(249,115,22,0.75)', borderRadius:3 },
                        { label:'XGBoost',  data:xgb,   backgroundColor:'rgba(59,130,246,0.55)',  borderRadius:3 },
                        { label:'CatBoost', data:catb,  backgroundColor:'rgba(139,92,246,0.5)',  borderRadius:3 },
                    ]
                },
                options: {
                    responsive: true,
                    plugins: {
                        legend: { labels:{color:tc(),font:{family:ff,size:11},boxWidth:11} },
                        tooltip: { callbacks:{ label: ctx => `${ctx.dataset.label}: ${ctx.raw}x slower than LightGBM` } }
                    },
                    scales: {
                        x: { grid:{display:false}, ticks:{color:tc(),font:{family:ff,size:10}} },
                        y: {
                            grid: { color:gc() },
                            ticks:{color:tc(),font:{family:ff,size:10}},
                            title:{display:true,text:'Relative training time (LightGBM = 1.0)',color:tc(),font:{family:ff,size:10}},
                            min:0
                        }
                    }
                }
            });
        }

        // ── Canvas: tree growth diagram ──
        function drawTreeGrowth() {
            const canvas = document.getElementById('treeGrowthCanvas');
            if (!canvas) return;
            const dpr = window.devicePixelRatio || 1;
            const W   = canvas.offsetWidth || 680;
            const H   = 280;
            canvas.width        = W * dpr;
            canvas.height       = H * dpr;
            canvas.style.width  = W + 'px';
            canvas.style.height = H + 'px';
            const ctx = canvas.getContext('2d');
            ctx.scale(dpr, dpr);

            const dark  = isDark();
            const bg    = dark ? '#18181b' : '#ffffff';
            const edgeC = dark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.18)';
            const nodeC = dark ? '#3f3f46' : '#e4e4e7';
            const textC = dark ? '#9ca3af' : '#6b7280';
            const accent = '#f97316';
            const half   = W / 2;

            // ── clear ──
            ctx.fillStyle = bg;
            ctx.fillRect(0, 0, W, H);

            // ── panel divider ──
            ctx.beginPath();
            ctx.moveTo(half, 12); ctx.lineTo(half, H - 12);
            ctx.strokeStyle = edgeC; ctx.lineWidth = 1; ctx.stroke();

            // ── helpers ──
            function drawNode(x, y, r, fill, stroke) {
                ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
                ctx.fillStyle = fill; ctx.fill();
                if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1.5; ctx.stroke(); }
            }
            function drawEdge(x1, y1, x2, y2, color) {
                ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
                ctx.strokeStyle = color; ctx.lineWidth = 1.2; ctx.stroke();
            }
            function drawLabel(text, x, y, color, align) {
                ctx.fillStyle = color;
                ctx.font      = `600 9px ${ff}`;
                ctx.textAlign = align || 'left';
                ctx.fillText(text, x, y);
            }

            // Row y-positions
            const R = [44, 104, 162, 220];
            const NR = 10; // node radius

            // ─────────────────────────────────────────
            // LEFT PANEL: level-wise (balanced)
            // ─────────────────────────────────────────
            const lx = half * 0.5;                // panel centre
            const lSpread1 = Math.round(half * 0.17);  // depth-1 spread
            const lSpread2 = Math.round(half * 0.09);  // depth-2 spread

            // depth 0: root
            drawNode(lx, R[0], NR, nodeC, edgeC);
            drawLabel('Root', lx + NR + 4, R[0] + 4, textC);

            // depth 1: nodes A and B
            const lD1 = [-1, 1].map(d => ({ x: lx + d * lSpread1, label: d < 0 ? 'A' : 'B' }));
            lD1.forEach(n => {
                drawEdge(lx, R[0] + NR, n.x, R[1] - NR, edgeC);
                drawNode(n.x, R[1], NR, nodeC, edgeC);
                // label sits to the outer side of each node
                const right = n.x > lx;
                drawLabel(n.label, n.x + (right ? NR + 4 : -NR - 12), R[1] + 4, textC);
            });

            // depth 2: four nodes (all split, level-wise)
            lD1.forEach(parent => {
                [-1, 1].forEach(d => {
                    const cx = parent.x + d * lSpread2;
                    drawEdge(parent.x, R[1] + NR, cx, R[2] - 7, edgeC);
                    drawNode(cx, R[2], 7, nodeC, edgeC);
                });
            });

            // depth 3: eight tiny nodes
            lD1.forEach(parent => {
                [-1, 1].forEach(d => {
                    const px = parent.x + d * lSpread2;
                    [-1, 1].forEach(d2 => {
                        const cx = px + d2 * Math.round(lSpread2 * 0.55);
                        drawEdge(px, R[2] + 7, cx, R[3] - 5, edgeC);
                        drawNode(cx, R[3], 5, nodeC, edgeC);
                    });
                });
            });

            // panel label
            ctx.fillStyle  = textC;
            ctx.font       = `500 10px ${ff}`;
            ctx.textAlign  = 'center';
            ctx.fillText('Level-wise', lx, H - 8);

            // ─────────────────────────────────────────
            // RIGHT PANEL: leaf-wise (asymmetric)
            // ─────────────────────────────────────────
            const rx = half + half * 0.5;         // panel centre
            const rOff = Math.round(half * 0.19); // root → depth-1 horizontal spread

            // depth 0: root (highlighted)
            drawNode(rx, R[0], NR, accent, null);
            drawLabel('Root', rx + NR + 4, R[0] + 4, accent);

            // depth 1: left child (split, high gain) and right child (waiting)
            const lcX = rx - rOff;
            const rcX = rx + rOff;

            drawEdge(rx, R[0] + NR, lcX, R[1] - NR, accent);   // high-gain branch
            drawEdge(rx, R[0] + NR, rcX, R[1] - NR, edgeC);    // low-gain branch

            drawNode(lcX, R[1], NR, accent, null);               // split next
            drawNode(rcX, R[1], NR, nodeC, edgeC);               // not split yet

            // "HIGH" label to the LEFT of lcX, "low" label to the RIGHT of rcX
            drawLabel('HIGH', lcX - NR - 38, R[1] + 4, accent, 'left');
            drawLabel('low',  rcX + NR + 4,  R[1] + 4, textC,  'left');

            // depth 2: only the high-gain child splits (two children)
            const off2 = Math.round(half * 0.115);
            const l2L  = lcX - off2;
            const l2R  = lcX + off2;

            drawEdge(lcX, R[1] + NR, l2L, R[2] - 7, accent);
            drawEdge(lcX, R[1] + NR, l2R, R[2] - 7, accent);

            drawNode(l2L, R[2], 8, accent, null);   // will split next
            drawNode(l2R, R[2], 8, nodeC, edgeC);   // lower gain, waits

            drawLabel('NEXT', l2L - 8 - 36, R[2] + 4, accent, 'left');

            // depth 3: l2L splits further
            const off3 = Math.round(half * 0.07);
            const l3L  = l2L - off3;
            const l3R  = l2L + off3;

            drawEdge(l2L, R[2] + 8, l3L, R[3] - 5, accent);
            drawEdge(l2L, R[2] + 8, l3R, R[3] - 5, accent);

            drawNode(l3L, R[3], 6, nodeC, edgeC);
            drawNode(l3R, R[3], 6, nodeC, edgeC);

            // panel label
            ctx.fillStyle = textC;
            ctx.font      = `500 10px ${ff}`;
            ctx.textAlign = 'center';
            ctx.fillText('Leaf-wise', rx, H - 8);
        }

        function redrawCharts() {
            buildBoostingChart();
            buildSpeedChart();
            drawTreeGrowth();
        }

        // init: script is at body-bottom so DOM is ready; use rAF for canvas sizing
        requestAnimationFrame(function() {
            buildBoostingChart();
            buildSpeedChart();
            drawTreeGrowth();
        });
