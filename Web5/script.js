"use strict";
(() => {
  // Web5/src/types.ts
  var FF_PANELS = [
    {
      kind: "SR",
      title: "SR Flip-Flop",
      inputs: ["S", "R"],
      description: "Set\u2013Reset. S=1 sets Q, R=1 resets Q, S=R=0 holds. S=R=1 is forbidden.",
      characteristic: "Q\u207A = S + R\u2032\xB7Q   (S\xB7R = 0)",
      icon: "\u{1F500}"
    },
    {
      kind: "JK",
      title: "JK Flip-Flop",
      inputs: ["J", "K"],
      description: "Universal flip-flop. J=K=1 toggles Q on every active clock edge.",
      characteristic: "Q\u207A = J\xB7Q\u2032 + K\u2032\xB7Q",
      icon: "\u267B\uFE0F"
    },
    {
      kind: "T",
      title: "T Flip-Flop",
      inputs: ["T"],
      description: "Toggle flip-flop. T=1 inverts Q on every active clock edge, T=0 holds.",
      characteristic: "Q\u207A = T \u2295 Q",
      icon: "\u{1F501}"
    },
    {
      kind: "D",
      title: "D Flip-Flop",
      inputs: ["D"],
      description: "Data / delay flip-flop. Q copies D at the active clock edge, otherwise holds.",
      characteristic: "Q\u207A = D",
      icon: "\u{1F4BE}"
    }
  ];
  var HISTORY_LIMIT = 48;
  var SIGNAL_COLORS = {
    clock: "#f59e0b",
    input: "#38bdf8",
    output: "#10b981",
    edge: "#ef4444",
    low: "#64748b"
  };

  // Web5/src/flipflops.ts
  function nextQ(kind, inputs, q) {
    switch (kind) {
      case "SR": {
        const [s, r] = inputs;
        if (s && r) return { q, invalid: true };
        if (s) return { q: true, invalid: false };
        if (r) return { q: false, invalid: false };
        return { q, invalid: false };
      }
      case "JK": {
        const [j, k] = inputs;
        if (j && k) return { q: !q, invalid: false };
        if (j) return { q: true, invalid: false };
        if (k) return { q: false, invalid: false };
        return { q, invalid: false };
      }
      case "T": {
        const [t] = inputs;
        return t ? { q: !q, invalid: false } : { q, invalid: false };
      }
      case "D": {
        const [d] = inputs;
        return { q: d, invalid: false };
      }
    }
  }
  function isInvalid(kind, inputs) {
    return kind === "SR" && inputs[0] === true && inputs[1] === true;
  }
  function createPanelState(kind, inputCount) {
    return {
      kind,
      inputs: new Array(inputCount).fill(false),
      q: false,
      invalid: false,
      prevClk: false,
      history: []
    };
  }
  function stepClock(panel, clk) {
    const edge = panel.prevClk === true && clk === false;
    panel.prevClk = clk;
    if (!edge) {
      panel.invalid = isInvalid(panel.kind, panel.inputs);
      return false;
    }
    const result = nextQ(panel.kind, panel.inputs, panel.q);
    const changed = result.q !== panel.q;
    panel.q = result.q;
    panel.invalid = result.invalid;
    return changed;
  }
  function toggleInput(panel, index) {
    panel.inputs[index] = !panel.inputs[index];
    panel.invalid = isInvalid(panel.kind, panel.inputs);
    return panel.inputs[index];
  }
  function resetPanel(panel) {
    panel.inputs = panel.inputs.map(() => false);
    panel.q = false;
    panel.invalid = false;
    panel.prevClk = false;
    panel.history = [];
  }
  function recordSample(panel, clk) {
    const sample = {
      clk,
      inputs: [...panel.inputs],
      q: panel.q,
      invalid: panel.invalid
    };
    panel.history.push(sample);
    if (panel.history.length > HISTORY_LIMIT) {
      panel.history.shift();
    }
  }
  function advanceClock(state) {
    const period = state.highTicks + state.lowTicks;
    const phase = state.tick % period;
    state.tick++;
    return phase < state.highTicks;
  }
  function excitationTable(kind) {
    switch (kind) {
      case "SR":
        return [
          { inputs: "0 0", action: "Hold (no change)" },
          { inputs: "0 1", action: "Reset \u2192 Q = 0" },
          { inputs: "1 0", action: "Set \u2192 Q = 1" },
          { inputs: "1 1", action: "Forbidden \u2717" }
        ];
      case "JK":
        return [
          { inputs: "0 0", action: "Hold (no change)" },
          { inputs: "0 1", action: "Reset \u2192 Q = 0" },
          { inputs: "1 0", action: "Set \u2192 Q = 1" },
          { inputs: "1 1", action: "Toggle \u2192 Q = Q\u0304" }
        ];
      case "T":
        return [
          { inputs: "0", action: "Hold (no change)" },
          { inputs: "1", action: "Toggle \u2192 Q = Q\u0304" }
        ];
      case "D":
        return [
          { inputs: "0", action: "Q\u207A = 0" },
          { inputs: "1", action: "Q\u207A = 1" }
        ];
    }
  }

  // Web5/src/schematic.ts
  function esc(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  function wireColor(v) {
    return v ? "var(--w5-signal-1, #10b981)" : "var(--w5-signal-0, #475569)";
  }
  function wireStraight(x1, y1, x2, y2, value, id = "") {
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" ${id ? `data-wire="${id}"` : ""} stroke="${wireColor(value)}" stroke-width="2" stroke-linecap="round"/>`;
  }
  function label(x, y, text, opts) {
    return `<text x="${x}" y="${y}" text-anchor="${opts?.anchor ?? "start"}" font-size="${opts?.size ?? 11}"
        font-weight="${opts?.bold === false ? 500 : 700}" font-family="'JetBrains Mono', monospace"
        fill="${opts?.color ?? "var(--w5-text, #f8fafc)"}">${esc(text)}</text>`;
  }
  function sigBadge(x, y, v, size = 18) {
    const color = v ? "var(--w5-signal-1, #10b981)" : "var(--w5-signal-0, #475569)";
    return `<g pointer-events="none">
        <rect x="${x - size / 2}" y="${y - size / 2}" width="${size}" height="${size}" rx="4" fill="var(--w5-bg, #0f172a)" stroke="${color}" stroke-width="1.4"/>
        <text x="${x}" y="${y + 4}" text-anchor="middle" font-size="10.5" font-weight="800"
            font-family="'JetBrains Mono', monospace" fill="${color}">${v ? "1" : "0"}</text>
    </g>`;
  }
  function bubble(x, y) {
    return `<circle cx="${x}" cy="${y}" r="4.5" fill="var(--w5-gate-fill, #1e293b)" stroke="var(--w5-gate-stroke, #94a3b8)" stroke-width="1.8"/>`;
  }
  function renderClockSchematic(clk, highTicks, lowTicks) {
    const W = 300;
    const H = 120;
    const midY = H / 2 + 8;
    let svg = `<svg viewBox="0 0 ${W} ${H}" class="w5-schematic-svg" role="img" aria-label="Clock source schematic">`;
    svg += `<rect x="16" y="${midY - 26}" width="86" height="52" rx="10"
        fill="var(--w5-gate-fill, #1e293b)" stroke="${SIGNAL_COLORS.clock}" stroke-width="2"/>`;
    svg += label(59, midY - 4, "CLOCK", { anchor: "middle", size: 12, color: SIGNAL_COLORS.clock });
    svg += label(59, midY + 12, `${highTicks}\u2191 / ${lowTicks}\u2193`, { anchor: "middle", size: 9, color: "var(--w5-muted, #94a3b8)" });
    svg += wireStraight(102, midY, 168, midY, clk);
    svg += sigBadge(138, midY, clk);
    const gx = 176;
    const gy = midY - 16;
    const gw = 108;
    const hh = 12;
    const hl = highTicks;
    const ll = lowTicks;
    const seg = gw / (hl + ll);
    svg += `<path d="M ${gx} ${gy + hh} h ${seg * Math.max(hl, 1)} V ${gy} h ${seg * Math.max(ll, 1)} V ${gy + hh}"
        fill="none" stroke="${SIGNAL_COLORS.clock}" stroke-width="2" opacity="0.8"/>`;
    svg += `</svg>`;
    return svg;
  }
  function ffLayout(inputCount) {
    const W = 460;
    const H = 190;
    const inYs = inputCount === 1 ? [H / 2 + 10] : [H / 2 - 12, H / 2 + 42];
    return { W, H, inX: 14, inYs, outX: W - 14, qY: H / 2 + 10, qnY: H / 2 + 62 };
  }
  function renderFlipFlopSchematic(panel, clk) {
    const { kind } = panel;
    const L = ffLayout(panel.inputs.length);
    const names = panel.kind === "SR" ? ["S", "R"] : panel.kind === "JK" ? ["J", "K"] : panel.kind === "T" ? ["T"] : ["D"];
    let svg = `<svg viewBox="0 0 ${L.W} ${L.H}" class="w5-schematic-svg" role="img" aria-label="${esc(kind)} flip-flop schematic">`;
    names.forEach((name, i) => {
      const y = L.inYs[i];
      const v = panel.inputs[i];
      svg += wireStraight(L.inX, y, 96, y, v, `in-${kind}-${i}`);
      svg += label(L.inX + 2, y - 8, name, { size: 12, color: "var(--w5-text, #f8fafc)" });
      svg += sigBadge(L.inX + 34, y - 20, v);
    });
    const clkY = L.H - 22;
    svg += wireStraight(L.inX, clkY, 96, clkY, clk, `clk-${kind}`);
    svg += label(L.inX + 2, clkY - 8, "CLK", { size: 10, color: SIGNAL_COLORS.clock });
    svg += sigBadge(L.inX + 34, clkY - 20, clk);
    svg += `<rect x="96" y="34" width="150" height="${L.H - 58}" rx="10"
        fill="var(--w5-gate-fill, #1e293b)" stroke="${panel.invalid ? "var(--w5-invalid, #ef4444)" : "var(--w5-gate-stroke, #94a3b8)"}"
        stroke-width="${panel.invalid ? 2.4 : 2}"/>`;
    svg += `<path d="M 88 ${clkY - 5} L 96 ${clkY} L 88 ${clkY + 5} Z" fill="none" stroke="var(--w5-gate-stroke, #94a3b8)" stroke-width="1.6"/>`;
    svg += bubble(84, clkY);
    svg += label(112, clkY + 3, "\u25BE neg-edge", { size: 8.5, color: "var(--w5-muted, #94a3b8)" });
    svg += label(171, 56, `${kind} FF`, { anchor: "middle", size: 13, color: "var(--w5-text, #f8fafc)" });
    const eq = kind === "SR" ? "Q\u207A=S+R\u2032Q" : kind === "JK" ? "Q\u207A=JQ\u2032+K\u2032Q" : kind === "T" ? "Q\u207A=T\u2295Q" : "Q\u207A=D";
    svg += label(171, 72, eq, { anchor: "middle", size: 9, color: "var(--w5-muted, #94a3b8)" });
    if (panel.invalid) {
      svg += label(171, 88, "INVALID INPUTS", { anchor: "middle", size: 9, color: "var(--w5-invalid, #ef4444)" });
    }
    names.forEach((name, i) => {
      const y = L.inYs[i];
      svg += wireStraight(96, y, 106, y, panel.inputs[i]);
      svg += label(112, y + 4, name, { size: 10 });
    });
    svg += wireStraight(246, L.qY, L.outX - 40, L.qY, panel.q, `q-${kind}`);
    svg += label(258, L.qY - 8, "Q", { size: 12, color: SIGNAL_COLORS.output });
    svg += sigBadge(L.outX - 24, L.qY, panel.q, 20);
    svg += wireStraight(246, L.qnY, L.outX - 40, L.qnY, !panel.q, `qn-${kind}`);
    svg += bubble(250, L.qnY);
    svg += label(260, L.qnY - 8, "Q\u0304", { size: 12, color: "var(--w5-muted, #94a3b8)" });
    svg += sigBadge(L.outX - 24, L.qnY, !panel.q, 20);
    svg += renderActionHint(panel, L);
    svg += `</svg>`;
    return svg;
  }
  function renderActionHint(panel, L) {
    const names = panel.kind === "SR" ? ["S", "R"] : panel.kind === "JK" ? ["J", "K"] : panel.kind === "T" ? ["T"] : ["D"];
    let action;
    if (panel.invalid) {
      action = "S=R=1 forbidden \u2014 Q holds";
    } else {
      const [a, b] = panel.inputs;
      switch (panel.kind) {
        case "SR":
          action = a ? "Set Q=1 at next \u2193" : b ? "Reset Q=0 at next \u2193" : "Hold at next \u2193";
          break;
        case "JK":
          action = a && b ? "Toggle Q at next \u2193" : a ? "Set Q=1 at next \u2193" : b ? "Reset Q=0 at next \u2193" : "Hold at next \u2193";
          break;
        case "T":
          action = a ? "Toggle Q at next \u2193" : "Hold at next \u2193";
          break;
        case "D":
          action = `Q\u207A = ${a ? 1 : 0} at next \u2193`;
          break;
      }
    }
    void names;
    return label(L.W - 12, L.H - 10, action, { anchor: "end", size: 10, color: "var(--w5-accent, #38bdf8)" });
  }
  function excitationTableHTML(rows) {
    return rows.map((r) => `
        <div class="w5-tt-row">
            <span class="w5-tt-inputs">${esc(r.inputs)}</span>
            <span class="w5-tt-action">${esc(r.action)}</span>
        </div>`).join("");
  }

  // Web5/src/waveform.ts
  var LABEL_W = 92;
  var RIGHT_PAD = 14;
  var TOP_PAD = 18;
  var BOTTOM_PAD = 26;
  var ROW_MIN = 34;
  function drawSignals(ctx, signals, w, h, opts) {
    const width = w;
    const height = h;
    if (signals.length === 0) {
      ctx.fillStyle = "#64748b";
      ctx.font = "13px 'JetBrains Mono', monospace";
      ctx.textAlign = "center";
      ctx.fillText("No signals to display", width / 2, height / 2);
      return;
    }
    const plotW = width - LABEL_W - RIGHT_PAD;
    const rowH = Math.max(ROW_MIN, Math.min(46, (height - TOP_PAD - BOTTOM_PAD) / signals.length));
    const n = Math.max(...signals.map((s) => s.values.length));
    if (n === 0) return;
    const stepX = plotW / Math.max(n - 1, 1);
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(148, 163, 184, 0.12)";
    for (let i = 0; i < n; i += Math.ceil(n / 16)) {
      const x = LABEL_W + i * stepX;
      ctx.beginPath();
      ctx.moveTo(x, TOP_PAD - 6);
      ctx.lineTo(x, height - BOTTOM_PAD + 6);
      ctx.stroke();
    }
    ctx.fillStyle = "#64748b";
    ctx.font = "9px 'JetBrains Mono', monospace";
    ctx.textAlign = "center";
    for (let i = 0; i < n; i += Math.ceil(n / 16)) {
      const x = LABEL_W + i * stepX;
      ctx.fillText(String(i), x, height - 8);
    }
    const edgeRef = opts?.edgeSource ?? signals[0];
    const markEdges = opts?.markNegativeEdges !== false && edgeRef.values.length > 1;
    const edgeXs = [];
    if (markEdges) {
      for (let i = 1; i < edgeRef.values.length; i++) {
        if (edgeRef.values[i - 1] === true && edgeRef.values[i] === false) {
          edgeXs.push(LABEL_W + i * stepX);
        }
      }
    }
    signals.forEach((sig, sigIdx) => {
      const topY = TOP_PAD + sigIdx * rowH;
      const highY = topY + 6;
      const lowY = topY + rowH - 14;
      if (sigIdx % 2 === 0) {
        ctx.fillStyle = "rgba(148, 163, 184, 0.05)";
        ctx.fillRect(LABEL_W, topY, plotW, rowH);
      }
      ctx.fillStyle = sig.color;
      ctx.font = "bold 11px 'JetBrains Mono', monospace";
      ctx.textAlign = "right";
      ctx.fillText(sig.label, LABEL_W - 10, (highY + lowY) / 2 + 4);
      ctx.strokeStyle = "rgba(148, 163, 184, 0.18)";
      ctx.setLineDash([2, 4]);
      ctx.beginPath();
      ctx.moveTo(LABEL_W, lowY);
      ctx.lineTo(width - RIGHT_PAD, lowY);
      ctx.moveTo(LABEL_W, highY);
      ctx.lineTo(width - RIGHT_PAD, highY);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "rgba(148, 163, 184, 0.55)";
      ctx.font = "9px 'JetBrains Mono', monospace";
      ctx.textAlign = "left";
      ctx.fillText("1", width - RIGHT_PAD + 2, highY + 3);
      ctx.fillText("0", width - RIGHT_PAD + 2, lowY + 3);
      ctx.strokeStyle = sig.color;
      ctx.lineWidth = 2;
      if (sig.dashed) ctx.setLineDash([5, 4]);
      ctx.beginPath();
      const vals = sig.values;
      for (let i = 0; i < vals.length; i++) {
        const x = LABEL_W + i * stepX;
        const y = vals[i] ? highY : lowY;
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          const prevY = vals[i - 1] ? highY : lowY;
          if (prevY !== y) ctx.lineTo(x, prevY);
          ctx.lineTo(x, y);
        }
      }
      const lastY = vals[vals.length - 1] ? highY : lowY;
      ctx.lineTo(LABEL_W + (vals.length - 1) * stepX + stepX, lastY);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = sig.color;
      ctx.font = "8.5px 'JetBrains Mono', monospace";
      ctx.textAlign = "center";
      for (let i = 0; i < vals.length; i++) {
        const x = LABEL_W + i * stepX;
        const y = vals[i] ? highY : lowY;
        ctx.fillText(vals[i] ? "1" : "0", x + stepX / 2, y - 3);
      }
    });
    if (markEdges) {
      ctx.strokeStyle = SIGNAL_COLORS.edge;
      ctx.lineWidth = 1.2;
      ctx.setLineDash([4, 3]);
      for (const x of edgeXs) {
        ctx.beginPath();
        ctx.moveTo(x, TOP_PAD - 4);
        ctx.lineTo(x, height - BOTTOM_PAD + 4);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = SIGNAL_COLORS.edge;
        ctx.beginPath();
        ctx.moveTo(x - 4, TOP_PAD - 10);
        ctx.lineTo(x + 4, TOP_PAD - 10);
        ctx.lineTo(x, TOP_PAD - 4);
        ctx.closePath();
        ctx.fill();
        ctx.setLineDash([4, 3]);
      }
      ctx.setLineDash([]);
      if (edgeXs.length > 0) {
        ctx.fillStyle = SIGNAL_COLORS.edge;
        ctx.font = "9.5px 'JetBrains Mono', monospace";
        ctx.textAlign = "left";
        ctx.fillText("\u25BC = negative (falling) clock edge \u2192 state updates", LABEL_W + 4, TOP_PAD + 2);
      }
    }
  }
  function panelSignals(kind, inputNames, history, clockColor) {
    const signals = [
      {
        label: "CLK",
        values: history.map((s) => s.clk),
        color: clockColor
      }
    ];
    inputNames.forEach((name, i) => {
      signals.push({
        label: name,
        values: history.map((s) => s.inputs[i] ?? false),
        color: SIGNAL_COLORS.input
      });
    });
    signals.push({
      label: "Q",
      values: history.map((s) => s.q),
      color: SIGNAL_COLORS.output
    });
    signals.push({
      label: "Q\u0304",
      values: history.map((s) => !s.q),
      color: SIGNAL_COLORS.output,
      dashed: true
    });
    void kind;
    return signals;
  }

  // Web5/script.ts
  function byId(id) {
    const el = document.getElementById(id);
    if (!el) throw new Error(`Missing #${id}`);
    return el;
  }
  var clock = {
    tick: 0,
    highTicks: 2,
    lowTicks: 2,
    running: true,
    value: false
  };
  var TICK_MS = 300;
  var panels = /* @__PURE__ */ new Map();
  var timer = null;
  function init() {
    buildClockControls();
    buildPanels();
    setupKeyboard();
    renderAll();
    if (clock.running) start();
  }
  function buildClockControls() {
    const controls = byId("w5ClockControls");
    controls.innerHTML = `
        <button type="button" class="w5-ctrl-btn" id="w5ClockRun" title="Run / pause the clock">\u23F8 Pause</button>
        <button type="button" class="w5-ctrl-btn" id="w5ClockStep" title="Advance one half period">\u23ED Step</button>
        <button type="button" class="w5-ctrl-btn" id="w5ClockReset" title="Reset all flip-flops (Q=0)">\u27F2 Reset All</button>
        <div class="w5-speed-group" role="group" aria-label="Clock speed">
            <span class="w5-speed-label">Speed</span>
            <button type="button" class="w5-speed-btn" data-speed="slow">0.5\xD7</button>
            <button type="button" class="w5-speed-btn active" data-speed="normal">1\xD7</button>
            <button type="button" class="w5-speed-btn" data-speed="fast">2\xD7</button>
        </div>
    `;
    byId("w5ClockRun").addEventListener("click", toggleRun);
    byId("w5ClockStep").addEventListener("click", () => {
      if (clock.running) pause();
      tickOnce();
    });
    byId("w5ClockReset").addEventListener("click", resetAll);
    controls.querySelectorAll(".w5-speed-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const speed = btn.getAttribute("data-speed");
        controls.querySelectorAll(".w5-speed-btn").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        if (speed === "slow") setSpeed(2);
        else if (speed === "fast") setSpeed(0.5);
        else setSpeed(1);
      });
    });
  }
  function buildPanels() {
    const host = byId("w5Panels");
    host.innerHTML = FF_PANELS.map((meta) => {
      const inputNames = meta.inputs.map((n) => `<span class="w5-in-name">${n}</span>`).join("");
      return `
        <section class="w5-panel" id="w5Panel-${meta.kind}" data-ff="${meta.kind}">
            <header class="w5-panel-header">
                <span class="w5-panel-icon">${meta.icon}</span>
                <div class="w5-panel-titles">
                    <h2>${meta.title}</h2>
                    <p>${meta.description}</p>
                </div>
                <span class="w5-panel-edge" title="Negative edge triggered">\u25BE neg-edge</span>
                <span class="w5-q-badge" id="w5Q-${meta.kind}" title="Current state Q">Q = 0</span>
            </header>
            <div class="w5-panel-grid">
                <div class="w5-panel-left">
                    <div class="w5-schematic" id="w5Schematic-${meta.kind}"></div>
                    <div class="w5-controls" id="w5Controls-${meta.kind}">
                        <span class="w5-controls-label">Inputs:</span>
                        ${meta.inputs.map((n) => `
                            <button type="button" class="w5-in-btn" data-ff="${meta.kind}" data-input="${n}" aria-pressed="false">
                                ${n} <kbd>0</kbd>
                            </button>`).join("")}
                        <button type="button" class="w5-ff-reset" data-ff="${meta.kind}" title="Reset this flip-flop">\u27F2 Q=0</button>
                    </div>
                    <div class="w5-tt" id="w5TT-${meta.kind}">
                        <div class="w5-tt-title">Excitation table (at \u2193)</div>
                        <div class="w5-tt-head"><span>${inputNames}</span><span>Action</span></div>
                        ${excitationTableHTML(excitationTable(meta.kind))}
                    </div>
                </div>
                <div class="w5-panel-right">
                    <div class="w5-wave-header">
                        <span class="w5-wave-title">\u{1F4C8} Timing diagram (0 / 1)</span>
                        <span class="w5-wave-hint">\u25BC red = negative clock edge (state updates)</span>
                    </div>
                    <div class="w5-wave-canvas-wrap">
                        <canvas id="w5Wave-${meta.kind}" class="w5-wave-canvas"></canvas>
                    </div>
                </div>
            </div>
        </section>`;
    }).join("");
    FF_PANELS.forEach((meta) => {
      const kind = meta.kind;
      panels.set(kind, createPanelState(kind, meta.inputs.length));
      byId(`w5Panel-${kind}`).querySelectorAll(".w5-in-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
          const idx = meta.inputs.indexOf(btn.getAttribute("data-input") ?? "");
          if (idx < 0) return;
          const panel = panels.get(kind);
          const v = toggleInput(panel, idx);
          btn.setAttribute("aria-pressed", String(v));
          btn.querySelector("kbd").textContent = v ? "1" : "0";
          btn.classList.toggle("active", v);
          if (window.StudioFX) window.StudioFX.click(v);
          renderPanel(kind);
        });
      });
      byId(`w5Panel-${kind}`).querySelector(".w5-ff-reset").addEventListener("click", () => {
        const panel = panels.get(kind);
        resetPanel(panel);
        syncPanelButtons(kind);
        renderPanel(kind);
      });
    });
  }
  function setupKeyboard() {
    window.addEventListener("keydown", (e) => {
      const target = e.target;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT")) return;
      if (e.key === " ") {
        e.preventDefault();
        toggleRun();
      } else if (e.key.toLowerCase() === "n") {
        if (clock.running) pause();
        tickOnce();
      }
    });
  }
  function setSpeed(multiplier) {
    const base = 600;
    const period = base * multiplier;
    const half = Math.max(120, Math.round(period / 2));
    clock.highTicks = Math.max(1, Math.round(half / TICK_MS));
    clock.lowTicks = clock.highTicks;
    if (clock.running) {
      stopTimer();
      startTimer(half);
    }
  }
  function startTimer(intervalMs) {
    timer = setInterval(tickOnce, intervalMs);
  }
  function stopTimer() {
    if (timer) clearInterval(timer);
    timer = null;
  }
  function start() {
    clock.running = true;
    startTimer(halfPeriodMs());
    byId("w5ClockRun").textContent = "\u23F8 Pause";
  }
  function pause() {
    clock.running = false;
    stopTimer();
    byId("w5ClockRun").textContent = "\u25B6 Run";
  }
  function toggleRun() {
    if (clock.running) pause();
    else start();
  }
  function halfPeriodMs() {
    const speedActive = document.querySelector(".w5-speed-btn.active")?.getAttribute("data-speed") ?? "normal";
    const mult = speedActive === "slow" ? 2 : speedActive === "fast" ? 0.5 : 1;
    return Math.max(120, Math.round(300 * mult));
  }
  function tickOnce() {
    const level = advanceClock(clock);
    clock.value = level;
    FF_PANELS.forEach((meta) => {
      const panel = panels.get(meta.kind);
      stepClock(panel, level);
      recordSample(panel, level);
    });
    renderAll();
  }
  function resetAll() {
    FF_PANELS.forEach((meta) => {
      const panel = panels.get(meta.kind);
      resetPanel(panel);
      syncPanelButtons(meta.kind);
    });
    renderAll();
  }
  function syncPanelButtons(kind) {
    const panel = panels.get(kind);
    byId(`w5Panel-${kind}`).querySelectorAll(".w5-in-btn").forEach((btn) => {
      const name = btn.getAttribute("data-input") ?? "";
      const idx = kind === "SR" ? name === "S" ? 0 : 1 : kind === "JK" ? name === "J" ? 0 : 1 : 0;
      const v = panel.inputs[idx];
      btn.setAttribute("aria-pressed", String(v));
      btn.querySelector("kbd").textContent = v ? "1" : "0";
      btn.classList.toggle("active", v);
    });
  }
  function renderAll() {
    byId("w5ClockSchematic").innerHTML = renderClockSchematic(clock.value, clock.highTicks, clock.lowTicks);
    byId("w5ClockBadge").textContent = clock.value ? "1" : "0";
    byId("w5ClockBadge").classList.toggle("high", clock.value);
    FF_PANELS.forEach((meta) => renderPanel(meta.kind));
    byId("w5TickCounter").textContent = String(clock.tick);
  }
  function renderPanel(kind) {
    const panel = panels.get(kind);
    const meta = FF_PANELS.find((m) => m.kind === kind);
    byId(`w5Schematic-${kind}`).innerHTML = renderFlipFlopSchematic(panel, clock.value);
    const qBadge = byId(`w5Q-${kind}`);
    qBadge.textContent = panel.q ? "1" : "0";
    qBadge.classList.toggle("high", panel.q);
    qBadge.classList.toggle("invalid", panel.invalid);
    drawWave(kind, meta.inputs, panel);
  }
  function drawWave(kind, inputNames, panel) {
    const canvas = byId(`w5Wave-${kind}`);
    const wrap = canvas.parentElement;
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(260, wrap.clientWidth - 8);
    const h = Math.max(150, wrap.clientHeight - 8);
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const signals = panelSignals(kind, inputNames, panel.history, SIGNAL_COLORS.clock);
    drawSignals(ctx, signals, w, h, {
      markNegativeEdges: true,
      edgeSource: signals[0]
    });
  }
  document.addEventListener("DOMContentLoaded", init);
})();
