"use strict";
(() => {
  // Web3/src/types.ts
  var SEGMENTS = ["a", "b", "c", "d", "e", "f", "g"];
  var HEX_PATTERNS = {
    0: { a: 1, b: 1, c: 1, d: 1, e: 1, f: 1, g: 0 },
    1: { a: 0, b: 1, c: 1, d: 0, e: 0, f: 0, g: 0 },
    2: { a: 1, b: 1, c: 0, d: 1, e: 1, f: 0, g: 1 },
    3: { a: 1, b: 1, c: 1, d: 1, e: 0, f: 0, g: 1 },
    4: { a: 0, b: 1, c: 1, d: 0, e: 0, f: 1, g: 1 },
    5: { a: 1, b: 0, c: 1, d: 1, e: 0, f: 1, g: 1 },
    6: { a: 1, b: 0, c: 1, d: 1, e: 1, f: 1, g: 1 },
    7: { a: 1, b: 1, c: 1, d: 0, e: 0, f: 0, g: 0 },
    8: { a: 1, b: 1, c: 1, d: 1, e: 1, f: 1, g: 1 },
    9: { a: 1, b: 1, c: 1, d: 1, e: 0, f: 1, g: 1 },
    10: { a: 1, b: 1, c: 1, d: 0, e: 1, f: 1, g: 1 },
    // A
    11: { a: 0, b: 0, c: 1, d: 1, e: 1, f: 1, g: 1 },
    // b
    12: { a: 1, b: 0, c: 0, d: 1, e: 1, f: 1, g: 0 },
    // C
    13: { a: 0, b: 1, c: 1, d: 1, e: 1, f: 0, g: 1 },
    // d
    14: { a: 1, b: 0, c: 0, d: 1, e: 1, f: 1, g: 1 },
    // E
    15: { a: 1, b: 0, c: 0, d: 0, e: 1, f: 1, g: 1 }
    // F
  };
  var HEX_CHARS = [
    "0",
    "1",
    "2",
    "3",
    "4",
    "5",
    "6",
    "7",
    "8",
    "9",
    "A",
    "b",
    "C",
    "d",
    "E",
    "F"
  ];
  var BCD_MINTERMS = {
    a: [0, 2, 3, 5, 6, 7, 8, 9],
    b: [0, 1, 2, 3, 4, 7, 8, 9],
    c: [0, 1, 3, 4, 5, 6, 7, 8, 9],
    d: [0, 2, 3, 5, 6, 8, 9],
    e: [0, 2, 6, 8],
    f: [0, 4, 5, 6, 8, 9],
    g: [2, 3, 4, 5, 6, 8, 9]
  };

  // Web3/src/segments.ts
  function render7Segment(pattern, isCommonAnode, size = 180) {
    const w = size;
    const h = size * 1.7;
    const segLen = w * 0.58;
    const gap = w * 0.06;
    const cx = w / 2;
    const topY = h * 0.08;
    const midY = h * 0.5;
    const botY = h * 0.92;
    const leftX = cx - segLen / 2;
    const rightX = cx + segLen / 2;
    const segDefs = [
      { id: "a", path: `M ${leftX + gap} ${topY} L ${rightX - gap} ${topY}`, labelX: cx, labelY: topY - 10 },
      { id: "b", path: `M ${rightX} ${topY + gap * 2} L ${rightX} ${midY - gap}`, labelX: rightX + 16, labelY: (topY + midY) / 2 },
      { id: "c", path: `M ${rightX} ${midY + gap} L ${rightX} ${botY - gap * 2}`, labelX: rightX + 16, labelY: (midY + botY) / 2 },
      { id: "d", path: `M ${leftX + gap} ${botY} L ${rightX - gap} ${botY}`, labelX: cx, labelY: botY + 18 },
      { id: "e", path: `M ${leftX} ${midY + gap} L ${leftX} ${botY - gap * 2}`, labelX: leftX - 16, labelY: (midY + botY) / 2 },
      { id: "f", path: `M ${leftX} ${topY + gap * 2} L ${leftX} ${midY - gap}`, labelX: leftX - 16, labelY: (topY + midY) / 2 },
      { id: "g", path: `M ${leftX + gap} ${midY} L ${rightX - gap} ${midY}`, labelX: cx, labelY: midY - 10 }
    ];
    let svg = `<svg class="seg-svg" xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="-25 -20 ${w + 50} ${h + 40}">`;
    segDefs.forEach((seg) => {
      const isLit = isCommonAnode ? pattern[seg.id] === 0 : pattern[seg.id] === 1;
      const cls = isLit ? "segment-path seg-on" : "segment-path seg-off";
      svg += `
            <g class="segment-group" data-seg="${seg.id}">
                <path d="${seg.path}" class="${cls}" stroke-width="14" stroke-linecap="round" fill="none" />
                <text x="${seg.labelX}" y="${seg.labelY + 4}" text-anchor="middle" font-size="12" font-weight="750" fill="var(--text-muted)">${seg.id}</text>
            </g>
        `;
    });
    svg += `<circle cx="${rightX + 18}" cy="${botY}" r="7" class="segment-path seg-off" stroke-width="0" fill="var(--seg-off)" />`;
    svg += `</svg>`;
    return svg;
  }
  function findMatchingPattern(pat, isHexMode, isCommonAnode) {
    const count = isHexMode ? 16 : 10;
    for (let i = 0; i < count; i++) {
      const hexP = HEX_PATTERNS[i];
      let match = true;
      for (const seg of SEGMENTS) {
        const expected = isCommonAnode ? 1 - hexP[seg] : hexP[seg];
        if (pat[seg] !== expected) {
          match = false;
          break;
        }
      }
      if (match) {
        const bin = i.toString(2).padStart(4, "0");
        return `Digit '${HEX_CHARS[i]}' (${bin}) \u2014 Hex 0x${i.toString(16).toUpperCase()}`;
      }
    }
    const litSegs = SEGMENTS.filter((s) => isCommonAnode ? pat[s] === 0 : pat[s] === 1).join(", ");
    return `Custom Glyph {${litSegs || "none"}}`;
  }

  // Web3/src/circuit.ts
  function wireHopH(x1, x2, y, crossXs, isHigh) {
    const minX = Math.min(x1, x2);
    const maxX = Math.max(x1, x2);
    const isLtoR = x1 <= x2;
    const cls = isHigh ? "wire-active" : "wire-inactive";
    const valid = crossXs.filter((cx) => cx > minX + 8 && cx < maxX - 8).sort((a, b) => isLtoR ? a - b : b - a);
    if (valid.length === 0) {
      return `<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" class="${cls}" stroke-width="2.2" fill="none" />`;
    }
    let d = `M ${x1} ${y}`;
    valid.forEach((cx) => {
      if (isLtoR) {
        d += ` H ${cx - 7} A 7 7 0 0 1 ${cx + 7} ${y}`;
      } else {
        d += ` H ${cx + 7} A 7 7 0 0 1 ${cx - 7} ${y}`;
      }
    });
    d += ` H ${x2}`;
    return `<path d="${d}" class="${cls}" stroke-width="2.2" fill="none" />`;
  }
  function wireV(x, y1, y2, isHigh) {
    const cls = isHigh ? "wire-active" : "wire-inactive";
    return `<line x1="${x}" y1="${y1}" x2="${x}" y2="${y2}" class="${cls}" stroke-width="2.2" fill="none" />`;
  }
  function dot(cx, cy, isHigh) {
    const col = isHigh ? "var(--wire-high)" : "var(--wire-low)";
    return `<circle cx="${cx}" cy="${cy}" r="3.8" class="circuit-junction" fill="${col}" />`;
  }
  function renderDecoderSchematic(currentInput, segmentValues, isHexMode, isCommonAnode) {
    const a = currentInput >> 3 & 1;
    const b = currentInput >> 2 & 1;
    const c = currentInput >> 1 & 1;
    const d = currentInput & 1;
    const notA = 1 - a;
    const notB = 1 - b;
    const notC = 1 - c;
    const notD = 1 - d;
    let svg = `<svg class="circuit-svg" xmlns="http://www.w3.org/2000/svg" width="800" height="380" viewBox="0 0 800 380">`;
    svg += `
        <rect x="250" y="20" width="260" height="340" rx="14" fill="var(--bg-card-alt)" stroke="var(--border-color)" stroke-width="2.2"/>
        <text x="380" y="180" text-anchor="middle" font-size="16" font-weight="800" fill="var(--text-primary)">${isHexMode ? "HEX" : "BCD"} to 7-SEG</text>
        <text x="380" y="205" text-anchor="middle" font-size="12" font-weight="700" fill="var(--text-muted)">Decoder Logic Matrix</text>
        <text x="380" y="225" text-anchor="middle" font-size="11" font-weight="600" fill="var(--accent-secondary)">${isCommonAnode ? "Common Anode (Active LOW)" : "Common Cathode (Active HIGH)"}</text>
    `;
    const inY = [60, 130, 200, 270];
    const inNames = ["A (8)", "B (4)", "C (2)", "D (1)"];
    const inVals = [a, b, c, d];
    const inNots = [notA, notB, notC, notD];
    for (let i = 0; i < 4; i++) {
      const yPos = inY[i];
      const val = inVals[i];
      const nVal = inNots[i];
      svg += wireHopH(30, 130, yPos, [], val);
      svg += `<text x="15" y="${yPos + 4}" font-size="13" font-weight="800" fill="var(--text-primary)">${inNames[i]}</text>`;
      svg += dot(100, yPos, val);
      svg += wireV(100, yPos, yPos + 25, val);
      svg += wireHopH(100, 250, yPos + 25, [], val);
      svg += `
            <g transform="translate(130, ${yPos - 12})">
                <polygon points="0,0 26,12 0,24" fill="var(--bg-card)" stroke="var(--border-hover)" stroke-width="2" />
                <circle cx="31" cy="12" r="4" fill="var(--bg-card)" stroke="var(--border-hover)" stroke-width="2" />
            </g>
        `;
      svg += wireHopH(165, 250, yPos, [], nVal);
    }
    const outY = [45, 90, 135, 180, 225, 270, 315];
    for (let i = 0; i < 7; i++) {
      const sId = SEGMENTS[i];
      const val = segmentValues[sId];
      const isLit = isCommonAnode ? val === 0 : val === 1;
      const yPos = outY[i];
      svg += wireHopH(510, 650, yPos, [], isLit);
      svg += dot(510, yPos, isLit);
      svg += `
            <g transform="translate(660, ${yPos - 13})">
                <rect width="60" height="26" rx="8" fill="var(--bg-card)" stroke="${isLit ? "var(--seg-on)" : "var(--border-color)"}" stroke-width="${isLit ? "2" : "1.2"}"/>
                <text x="30" y="17" text-anchor="middle" font-size="12" font-weight="800" fill="${isLit ? "var(--seg-on)" : "var(--text-muted)"}">seg ${sId} = ${val}</text>
            </g>
        `;
    }
    svg += `</svg>`;
    return svg;
  }

  // shared/ts/boolean/limits.ts
  var LIMITS = {
    /** Maximum number of distinct variables in one function. */
    MAX_VARIABLES: 8,
    /** Maximum characters accepted for a typed Boolean expression. */
    MAX_EXPRESSION_LENGTH: 2e3,
    /** Maximum characters accepted for a natural-language problem statement. */
    MAX_PROBLEM_LENGTH: 4e3,
    /** Maximum don't-care conditions accepted from the AI per request. */
    MAX_DONT_CARE_CONDITIONS: 8,
    /**
     * Node budget for the exact-cover branch search in Quine-McCluskey.
     * When exceeded, the solver finishes the cover greedily. The result stays
     * logically equivalent (verified afterwards); only guaranteed minimality
     * is relaxed. Typical 6-variable problems use far fewer nodes.
     */
    MINIMIZE_NODE_BUDGET: 2e5
  };
  var LimitError = class extends Error {
    constructor(message) {
      super(message);
      this.name = "LimitError";
    }
  };

  // shared/ts/boolean/minimizer.ts
  function canCombine(a, b) {
    let diff = 0;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) {
        diff++;
        if (diff > 1) return false;
      }
    }
    return diff === 1;
  }
  function combinePatterns(a, b) {
    let result = "";
    for (let i = 0; i < a.length; i++) {
      result += a[i] === b[i] ? a[i] : "-";
    }
    return result;
  }
  function patternCovers(pattern, minterm, variableCount) {
    const bin = minterm.toString(2).padStart(variableCount, "0");
    for (let i = 0; i < pattern.length; i++) {
      if (pattern[i] !== "-" && pattern[i] !== bin[i]) return false;
    }
    return true;
  }
  function getPrimeImplicants(minterms, variableCount) {
    let groups = /* @__PURE__ */ new Map();
    minterms.forEach((m) => {
      const bin = m.toString(2).padStart(variableCount, "0");
      const ones = (bin.match(/1/g) || []).length;
      if (!groups.has(ones)) groups.set(ones, /* @__PURE__ */ new Set());
      groups.get(ones).add(bin);
    });
    const primes = /* @__PURE__ */ new Set();
    while (groups.size > 0) {
      const nextGroups = /* @__PURE__ */ new Map();
      const combined = /* @__PURE__ */ new Set();
      const onesKeys = [...groups.keys()].sort((a, b) => a - b);
      for (let i = 0; i < onesKeys.length - 1; i++) {
        const k1 = onesKeys[i];
        const k2 = onesKeys[i + 1];
        if (k2 !== k1 + 1) continue;
        const g1 = groups.get(k1);
        const g2 = groups.get(k2);
        g1.forEach((p1) => {
          g2.forEach((p2) => {
            if (canCombine(p1, p2)) {
              combined.add(p1);
              combined.add(p2);
              const merged = combinePatterns(p1, p2);
              const ones = (merged.replace(/-/g, "").match(/1/g) || []).length;
              if (!nextGroups.has(ones)) nextGroups.set(ones, /* @__PURE__ */ new Set());
              nextGroups.get(ones).add(merged);
            }
          });
        });
      }
      groups.forEach((set) => {
        set.forEach((pattern) => {
          if (!combined.has(pattern)) primes.add(pattern);
        });
      });
      groups = nextGroups;
    }
    return [...primes].map((pattern) => ({ pattern }));
  }
  function findMinimumCover(minterms, primes, variableCount, nodeBudget = LIMITS.MINIMIZE_NODE_BUDGET) {
    if (minterms.length === 0 || primes.length === 0) return { cover: [], truncated: false };
    const chart = primes.map(
      (p) => minterms.map((m) => patternCovers(p.pattern, m, variableCount))
    );
    const essentialPrimes = /* @__PURE__ */ new Set();
    const uncoveredMinterms = new Set(minterms.map((_, i) => i));
    for (let c = 0; c < minterms.length; c++) {
      const coveringPrimes = [];
      for (let r = 0; r < primes.length; r++) {
        if (chart[r][c]) coveringPrimes.push(r);
      }
      if (coveringPrimes.length === 1) {
        const r = coveringPrimes[0];
        essentialPrimes.add(r);
        for (let col = 0; col < minterms.length; col++) {
          if (chart[r][col]) uncoveredMinterms.delete(col);
        }
      }
    }
    if (uncoveredMinterms.size === 0) {
      return { cover: [...essentialPrimes].map((i) => primes[i]), truncated: false };
    }
    const remainingPrimes = primes.map((_, i) => i).filter((i) => !essentialPrimes.has(i));
    const remainingMinterms = [...uncoveredMinterms];
    let bestCombination = null;
    let nodesUsed = 0;
    let truncated = false;
    function search(uncovered, chosen) {
      if (uncovered.length === 0) {
        if (bestCombination === null || chosen.length < bestCombination.length) {
          bestCombination = [...chosen];
        }
        return;
      }
      if (bestCombination !== null && chosen.length >= bestCombination.length) return;
      if (++nodesUsed > nodeBudget) {
        truncated = true;
        return;
      }
      const targetMinterm = uncovered[0];
      const covering = remainingPrimes.filter((p) => chart[p][targetMinterm] && !chosen.includes(p));
      for (const p of covering) {
        const newUncovered = uncovered.filter((m) => !chart[p][m]);
        search(newUncovered, [...chosen, p]);
      }
    }
    search(remainingMinterms, []);
    let chosenIndices = /* @__PURE__ */ new Set([...essentialPrimes, ...bestCombination ?? []]);
    let stillUncovered = truncated ? remainingMinterms.filter((mIdx) => ![...chosenIndices].some((r) => chart[r][mIdx])) : [];
    if (truncated && stillUncovered.length > 0) {
      while (stillUncovered.length > 0) {
        let bestPrime = -1;
        let bestGain = -1;
        for (const r of remainingPrimes) {
          if (chosenIndices.has(r)) continue;
          const gain = stillUncovered.filter((mIdx) => chart[r][mIdx]).length;
          if (gain > bestGain || gain === bestGain && gain > 0 && bestPrime === -1) {
            bestGain = gain;
            bestPrime = r;
          }
        }
        if (bestPrime === -1 || bestGain <= 0) break;
        chosenIndices.add(bestPrime);
        stillUncovered = stillUncovered.filter((mIdx) => !chart[bestPrime][mIdx]);
      }
    }
    return { cover: [...chosenIndices].map((i) => primes[i]), truncated };
  }
  function assertMinimizable(varCount, termCount) {
    if (varCount > LIMITS.MAX_VARIABLES) {
      throw new LimitError(
        `${varCount} variables exceeds the supported maximum of ${LIMITS.MAX_VARIABLES}. Reduce the number of variables in this function.`
      );
    }
    if (termCount > 1 << varCount) {
      throw new LimitError(`Term list contains more entries than the ${varCount}-variable space allows.`);
    }
  }
  function minimizeSOP(minterms, variables, dontCares, options) {
    assertMinimizable(variables.length, minterms.length + (dontCares?.size ?? 0));
    const varCount = variables.length;
    if (minterms.length === 0) {
      return { implicants: [], isConstant: true, constantValue: false, coverTruncated: false };
    }
    if (minterms.length + (dontCares?.size ?? 0) === 1 << varCount) {
      return {
        implicants: [{ pattern: "-".repeat(varCount) }],
        isConstant: true,
        constantValue: true,
        coverTruncated: false
      };
    }
    const allTerms = dontCares ? [.../* @__PURE__ */ new Set([...minterms, ...dontCares])] : minterms;
    const primes = getPrimeImplicants(allTerms, varCount);
    if (primes.length > 5e3) {
      throw new LimitError(
        `This function produced ${primes.length} prime implicants, which is too complex to minimize interactively.`
      );
    }
    const { cover, truncated } = findMinimumCover(minterms, primes, varCount, options?.nodeBudget ?? LIMITS.MINIMIZE_NODE_BUDGET);
    return { implicants: cover, isConstant: false, coverTruncated: truncated };
  }

  // shared/ts/boolean/tokenizer.ts
  var BooleanParseError = class extends Error {
    constructor(message, position = 0) {
      super(message);
      this.name = "BooleanParseError";
      this.position = position;
    }
  };
  var IDENT_START = /[A-Za-z_]/;
  var IDENT_PART = /[A-Za-z0-9_]/;
  function isIdentPart(ch) {
    return IDENT_PART.test(ch);
  }
  function tokenize(expression) {
    if (expression.length > 2e3) {
      throw new BooleanParseError(
        `Expression is too long (${expression.length} characters). Maximum supported length is 2000 characters.`,
        2e3
      );
    }
    const tokens = [];
    let i = 0;
    while (i < expression.length) {
      const ch = expression[i];
      if (/\s/.test(ch)) {
        i++;
        continue;
      }
      if (IDENT_START.test(ch)) {
        let j = i + 1;
        while (j < expression.length && IDENT_PART.test(expression[j])) j++;
        const raw = expression.slice(i, j);
        tokens.push({ type: "IDENT", value: raw.toUpperCase(), raw, pos: i });
        i = j;
        continue;
      }
      if (ch === "0" || ch === "1") {
        tokens.push({ type: "CONST", value: ch, raw: ch, pos: i });
        i++;
        continue;
      }
      switch (ch) {
        case "'":
        case "\u2019":
          tokens.push({ type: "NOT_POSTFIX", raw: "'", pos: i });
          i++;
          continue;
        case "!":
        case "~":
        case "\xAC":
          tokens.push({ type: "NOT_PREFIX", raw: ch, pos: i });
          i++;
          continue;
        case "*":
        case "&":
        case "\xB7":
        case "\u2227":
        case ".":
          tokens.push({ type: "AND", raw: ch, pos: i });
          i++;
          continue;
        case "+":
        case "|":
        case "\u2228":
          tokens.push({ type: "OR", raw: ch, pos: i });
          i++;
          continue;
        case "^":
        case "\u2295":
          tokens.push({ type: "XOR", raw: ch, pos: i });
          i++;
          continue;
        case "(":
        case "[":
          tokens.push({ type: "LPAREN", raw: "(", pos: i });
          i++;
          continue;
        case ")":
        case "]":
          tokens.push({ type: "RPAREN", raw: ")", pos: i });
          i++;
          continue;
      }
      throw new BooleanParseError(
        `Invalid character '${ch}' at position ${i + 1}. Supported: variables (A\u2013Z or names like ENABLE), constants 0 and 1, NOT (' ! ~), AND (* & \xB7), OR (+ |), XOR (^), parentheses.`,
        i
      );
    }
    return tokens;
  }
  function insertImplicitAND(tokens) {
    const result = [];
    for (let i = 0; i < tokens.length; i++) {
      const current = tokens[i];
      result.push(current);
      if (i + 1 < tokens.length) {
        const next = tokens[i + 1];
        const leftCanEnd = current.type === "IDENT" || current.type === "CONST" || current.type === "NOT_POSTFIX" || current.type === "RPAREN";
        const rightCanStart = next.type === "IDENT" || next.type === "CONST" || next.type === "LPAREN" || next.type === "NOT_PREFIX";
        if (leftCanEnd && rightCanStart) {
          result.push({ type: "AND", raw: "", pos: next.pos });
        }
      }
    }
    return result;
  }

  // shared/ts/boolean/formatter.ts
  function joinAndLiterals(literals, andSymbol) {
    let result = "";
    for (let i = 0; i < literals.length; i++) {
      if (i > 0) {
        const prevEnd = result[result.length - 1];
        const nextStart = literals[i][0];
        const needsSeparator = andSymbol !== "" || prevEnd !== void 0 && nextStart !== void 0 && isBoundaryAmbiguous(prevEnd, nextStart);
        result += needsSeparator ? andSymbol || "\xB7" : "";
      }
      result += literals[i];
    }
    return result;
  }
  function isBoundaryAmbiguous(prevChar, nextChar) {
    if (prevChar === "'") return false;
    if (!isIdentPart(prevChar)) return false;
    return isIdentPart(nextChar);
  }
  function termToString(pattern, variables, andSymbol = "") {
    const literals = [];
    for (let i = 0; i < pattern.length; i++) {
      if (pattern[i] === "1") literals.push(variables[i]);
      else if (pattern[i] === "0") literals.push(`${variables[i]}'`);
    }
    if (literals.length === 0) return "1";
    return joinAndLiterals(literals, andSymbol);
  }

  // shared/ts/boolean/ast.ts
  function evalAst(node, assignment) {
    switch (node.kind) {
      case "var":
        return assignment[node.name] ?? false;
      case "const":
        return node.value;
      case "not":
        return !evalAst(node.child, assignment);
      case "and":
        return evalAst(node.left, assignment) && evalAst(node.right, assignment);
      case "or":
        return evalAst(node.left, assignment) || evalAst(node.right, assignment);
      case "xor":
        return evalAst(node.left, assignment) !== evalAst(node.right, assignment);
    }
  }

  // shared/ts/boolean/parser.ts
  var TokenStream = class {
    constructor(tokens) {
      this.tokens = tokens;
      this.index = 0;
    }
    peek() {
      return this.tokens[this.index];
    }
    next() {
      return this.tokens[this.index++];
    }
    describe(token) {
      if (!token) return "end of expression";
      return `'${token.raw ?? token.value ?? token.type}'`;
    }
  };
  function parseExpression(source, knownVariables) {
    const trimmed = source.trim();
    if (!trimmed) {
      throw new BooleanParseError("The expression is empty. Enter a Boolean expression such as A'B + BC.");
    }
    const stream = new TokenStream(insertImplicitAND(tokenize(trimmed)));
    const node = parseOR(stream);
    const trailing = stream.peek();
    if (trailing) {
      throw new BooleanParseError(
        `Unexpected ${stream.describe(trailing)} at position ${trailing.pos + 1} after the end of the expression. Missing an operator (AND *, OR +, XOR ^)?`,
        trailing.pos
      );
    }
    const variables = [...collectAstVars(node)].sort();
    if (knownVariables && knownVariables.length > 0) {
      const known = new Set(knownVariables);
      for (const v of variables) {
        if (!known.has(v)) {
          const looksMerged = v.length > 1 && [...v].every((c) => known.has(c));
          const hint = looksMerged ? ` If you meant ${[...v].map((c) => `${c}' or variables joined with \xB7`).join(", ").replace("' or variables joined with \xB7", "")}, write them with an explicit AND, e.g. "${[...v].join("\xB7")}".` : "";
          throw new BooleanParseError(
            `Unknown variable '${v}'. This function uses: ${knownVariables.join(", ")}.${hint}`
          );
        }
      }
    }
    return { ast: node, variables };
  }
  function collectAstVars(node, out = /* @__PURE__ */ new Set()) {
    switch (node.kind) {
      case "var":
        out.add(node.name);
        break;
      case "const":
        break;
      case "not":
        collectAstVars(node.child, out);
        break;
      default:
        collectAstVars(node.left, out);
        collectAstVars(node.right, out);
    }
    return out;
  }
  function parseOR(stream) {
    let node = parseXOR(stream);
    while (stream.peek()?.type === "OR") {
      stream.next();
      node = { kind: "or", left: node, right: parseXOR(stream) };
    }
    return node;
  }
  function parseXOR(stream) {
    let node = parseAND(stream);
    while (stream.peek()?.type === "XOR") {
      const opToken = stream.next();
      const right = parseAND(stream);
      if (right.kind === "xor" || right.kind === "and" || right.kind === "or") {
      }
      node = { kind: "xor", left: node, right };
    }
    return node;
  }
  function parseAND(stream) {
    let node = parseUnary(stream);
    while (stream.peek()?.type === "AND") {
      stream.next();
      node = { kind: "and", left: node, right: parseUnary(stream) };
    }
    return node;
  }
  function parseUnary(stream) {
    const tok = stream.peek();
    if (tok?.type === "NOT_PREFIX") {
      stream.next();
      const child = parseUnary(stream);
      if (child.kind === "var" || child.kind === "const") {
      }
      return { kind: "not", child };
    }
    let node = parsePrimary(stream);
    while (stream.peek()?.type === "NOT_POSTFIX") {
      stream.next();
      node = { kind: "not", child: node };
    }
    return node;
  }
  function parsePrimary(stream) {
    const token = stream.next();
    if (!token) {
      throw new BooleanParseError(
        "Unexpected end of expression. Expected a variable, a constant (0 or 1), or '('."
      );
    }
    if (token.type === "IDENT") {
      return { kind: "var", name: token.value };
    }
    if (token.type === "CONST") {
      return { kind: "const", value: token.value === "1" };
    }
    if (token.type === "LPAREN") {
      const inner = parseOR(stream);
      const close = stream.next();
      if (!close || close.type !== "RPAREN") {
        throw new BooleanParseError(
          `Missing closing ')' for the parenthesis opened at position ${token.pos + 1}.`,
          token.pos
        );
      }
      return inner;
    }
    if (token.type === "NOT_POSTFIX") {
      throw new BooleanParseError(
        `Stray ''' at position ${token.pos + 1}: nothing before it to complement.`,
        token.pos
      );
    }
    throw new BooleanParseError(
      `Unexpected ${stream.describe(token)} at position ${token.pos + 1}. Expected a variable, a constant (0 or 1), or '('.`,
      token.pos
    );
  }

  // Web3/src/hexExpressions.ts
  var SEGMENTS2 = ["a", "b", "c", "d", "e", "f", "g"];
  var VARIABLES = ["A", "B", "C", "D"];
  var HEX_PATTERNS2 = {
    0: { a: 1, b: 1, c: 1, d: 1, e: 1, f: 1, g: 0 },
    1: { a: 0, b: 1, c: 1, d: 0, e: 0, f: 0, g: 0 },
    2: { a: 1, b: 1, c: 0, d: 1, e: 1, f: 0, g: 1 },
    3: { a: 1, b: 1, c: 1, d: 1, e: 0, f: 0, g: 1 },
    4: { a: 0, b: 1, c: 1, d: 0, e: 0, f: 1, g: 1 },
    5: { a: 1, b: 0, c: 1, d: 1, e: 0, f: 1, g: 1 },
    6: { a: 1, b: 0, c: 1, d: 1, e: 1, f: 1, g: 1 },
    7: { a: 1, b: 1, c: 1, d: 0, e: 0, f: 0, g: 0 },
    8: { a: 1, b: 1, c: 1, d: 1, e: 1, f: 1, g: 1 },
    9: { a: 1, b: 1, c: 1, d: 1, e: 0, f: 1, g: 1 },
    10: { a: 1, b: 1, c: 1, d: 0, e: 1, f: 1, g: 1 },
    11: { a: 0, b: 0, c: 1, d: 1, e: 1, f: 1, g: 1 },
    12: { a: 1, b: 0, c: 0, d: 1, e: 1, f: 1, g: 0 },
    13: { a: 0, b: 1, c: 1, d: 1, e: 1, f: 0, g: 1 },
    14: { a: 1, b: 0, c: 0, d: 1, e: 1, f: 1, g: 1 },
    15: { a: 1, b: 0, c: 0, d: 0, e: 1, f: 1, g: 1 }
  };
  function segmentMinterms(patterns, seg) {
    const total = Object.keys(patterns).length;
    const minterms = [];
    for (let d = 0; d < total; d++) {
      if (patterns[d][seg] === 1) minterms.push(d);
    }
    return minterms;
  }
  function implicantToExpression(implicants, variables) {
    if (implicants.length === 0) return "0";
    return implicants.map((imp) => termToString(imp.pattern, variables, "\xB7")).join(" + ");
  }
  function verifyExpression(expression, patterns, seg, totalCount) {
    const { ast } = parseExpression(expression);
    for (let d = 0; d < totalCount; d++) {
      const assignment = {
        A: (d >> 3 & 1) === 1,
        B: (d >> 2 & 1) === 1,
        C: (d >> 1 & 1) === 1,
        D: (d & 1) === 1
      };
      const computed = evalAst(ast, assignment) ? 1 : 0;
      if (computed !== patterns[d][seg]) {
        console.error(
          `Verification FAILED for segment ${seg} at digit ${d}: expected ${patterns[d][seg]}, got ${computed} from "${expression}"`
        );
        return false;
      }
    }
    return true;
  }
  function deriveSegmentExpressions(patterns, totalCount, dontCareDigits = []) {
    const dcSet = new Set(dontCareDigits);
    const result = {};
    for (const seg of SEGMENTS2) {
      const minterms = segmentMinterms(patterns, seg).filter((m) => m < totalCount && !dcSet.has(m));
      const allMintermsForQM = segmentMinterms(patterns, seg).filter((m) => m < totalCount);
      const minimized = minimizeSOP(allMintermsForQM, VARIABLES, dcSet);
      const expr = minimized.isConstant ? minimized.constantValue ? "1" : "0" : implicantToExpression(minimized.implicants, VARIABLES);
      if (!verifyExpression(expr, patterns, seg, totalCount)) {
        console.error(`FATAL: expression for segment ${seg} failed verification!`);
      }
      result[seg] = expr;
    }
    return result;
  }
  var HEX_EXPRESSIONS = deriveSegmentExpressions(HEX_PATTERNS2, 16, []);
  var BCD_EXPRESSIONS = deriveSegmentExpressions(HEX_PATTERNS2, 10, [10, 11, 12, 13, 14, 15]);

  // Web3/src/ui.ts
  function recordSegmentWave(deps2) {
    const { state: state2 } = deps2;
    state2.segWaveTimer++;
    state2.segWaveHistory.push({ time: state2.segWaveTimer, segs: { ...state2.segmentValues } });
    if (state2.segWaveHistory.length > 25) {
      state2.segWaveHistory.shift();
    }
    drawSegTimingDiagram(deps2);
  }
  function drawSegTimingDiagram(deps2) {
    const { state: state2, els: els2 } = deps2;
    const canvas = els2.segTimingCanvas;
    if (!canvas || state2.segWaveHistory.length === 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    const rowHeight = Math.floor((h - 20) / 7);
    const startX = 90;
    const graphWidth = w - startX - 30;
    const stepX = graphWidth / Math.max(15, state2.segWaveHistory.length - 1);
    ctx.strokeStyle = "rgba(255,255,255,0.06)";
    ctx.lineWidth = 1;
    for (let x = startX; x < w - 20; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 10);
      ctx.lineTo(x, h - 10);
      ctx.stroke();
    }
    SEGMENTS.forEach((sId, sIdx) => {
      const topY = 12 + sIdx * rowHeight;
      const lowY = topY + rowHeight - 6;
      const highY = topY + 4;
      ctx.font = "bold 12px 'JetBrains Mono', Consolas, monospace";
      ctx.fillStyle = "#38bdf8";
      ctx.textAlign = "right";
      ctx.fillText(`seg ${sId}`, startX - 10, lowY - 2);
      ctx.strokeStyle = "#38bdf8";
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      state2.segWaveHistory.forEach((pt, i) => {
        const x = startX + i * stepX;
        const isLit = state2.isCommonAnode ? pt.segs[sId] === 0 : pt.segs[sId] === 1;
        const y = isLit ? highY : lowY;
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          const prevLit = state2.isCommonAnode ? state2.segWaveHistory[i - 1].segs[sId] === 0 : state2.segWaveHistory[i - 1].segs[sId] === 1;
          const prevY = prevLit ? highY : lowY;
          if (prevY !== y) {
            ctx.lineTo(x, prevY);
          }
          ctx.lineTo(x, y);
        }
      });
      ctx.stroke();
    });
  }
  function buildInputs(deps2) {
    const { state: state2, els: els2, sfx } = deps2;
    const bits = [
      { name: "A", weight: 8 },
      { name: "B", weight: 4 },
      { name: "C", weight: 2 },
      { name: "D", weight: 1 }
    ];
    els2.bcdInput.innerHTML = bits.map((b) => {
      const val = state2.currentInput & b.weight ? 1 : 0;
      return `
            <button type="button" class="input-toggle-btn ${val ? "active" : ""}" data-weight="${b.weight}">
                <span>${b.name} (${b.weight})</span>
                <span class="input-val-badge">${val}</span>
            </button>
        `;
    }).join("");
    els2.bcdInput.querySelectorAll(".input-toggle-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const w = Number(btn.getAttribute("data-weight"));
        if (state2.currentInput & w) state2.currentInput &= ~w;
        else state2.currentInput |= w;
        const maxLimit = state2.isHexMode ? 15 : 9;
        if (state2.currentInput > maxLimit) state2.currentInput = maxLimit;
        if (sfx) sfx.click(true);
        syncDisplayFromInput(deps2);
      });
    });
  }
  function syncDisplayFromInput(deps2) {
    const { state: state2 } = deps2;
    const pat = HEX_PATTERNS[state2.currentInput] || HEX_PATTERNS[0];
    SEGMENTS.forEach((s) => {
      state2.segmentValues[s] = state2.isCommonAnode ? 1 - pat[s] : pat[s];
    });
    updateAllViews(deps2);
  }
  function updateAllViews(deps2) {
    const { state: state2, els: els2, sfx } = deps2;
    els2.segmentDisplay.innerHTML = render7Segment(state2.segmentValues, state2.isCommonAnode);
    els2.segmentDisplay.querySelectorAll(".segment-group").forEach((grp) => {
      grp.addEventListener("click", () => {
        if (state2.currentMode !== "interactive") return;
        const seg = grp.getAttribute("data-seg");
        if (seg) {
          state2.segmentValues[seg] = state2.segmentValues[seg] === 1 ? 0 : 1;
          if (sfx) sfx.click(state2.segmentValues[seg] === 1);
          reverseDecodeCustomDisplay(deps2);
        }
      });
    });
    els2.reverseMatchText.textContent = findMatchingPattern(
      state2.segmentValues,
      state2.isHexMode,
      state2.isCommonAnode
    );
    els2.bcdInput.querySelectorAll(".input-toggle-btn").forEach((btn) => {
      const w = Number(btn.getAttribute("data-weight"));
      const isHigh = (state2.currentInput & w) !== 0;
      btn.classList.toggle("active", isHigh);
      const badge = btn.querySelector(".input-val-badge");
      if (badge) badge.textContent = isHigh ? "1" : "0";
    });
    els2.truthTable.querySelectorAll("tbody tr").forEach((tr) => {
      const rowVal = Number(tr.getAttribute("data-val"));
      tr.classList.toggle("active-row", rowVal === state2.currentInput);
    });
    renderCircuitDiagram(deps2);
    recordSegmentWave(deps2);
  }
  function reverseDecodeCustomDisplay(deps2) {
    const { state: state2, els: els2, sfx } = deps2;
    els2.segmentDisplay.innerHTML = render7Segment(state2.segmentValues, state2.isCommonAnode);
    els2.segmentDisplay.querySelectorAll(".segment-group").forEach((grp) => {
      grp.addEventListener("click", () => {
        const seg = grp.getAttribute("data-seg");
        if (seg) {
          state2.segmentValues[seg] = state2.segmentValues[seg] === 1 ? 0 : 1;
          if (sfx) sfx.click(state2.segmentValues[seg] === 1);
          reverseDecodeCustomDisplay(deps2);
        }
      });
    });
    els2.reverseMatchText.textContent = findMatchingPattern(
      state2.segmentValues,
      state2.isHexMode,
      state2.isCommonAnode
    );
    recordSegmentWave(deps2);
  }
  function buildTruthTable(deps2) {
    const { state: state2, els: els2 } = deps2;
    const totalRows = state2.isHexMode ? 16 : 10;
    let html = `<table class="truth-table"><thead><tr>`;
    html += `<th>Digit</th><th>A (8)</th><th>B (4)</th><th>C (2)</th><th>D (1)</th>`;
    SEGMENTS.forEach((s) => {
      html += `<th>${s}</th>`;
    });
    html += `</tr></thead><tbody>`;
    for (let i = 0; i < totalRows; i++) {
      const p = HEX_PATTERNS[i];
      const a = i >> 3 & 1, b = i >> 2 & 1, c = i >> 1 & 1, d = i & 1;
      html += `<tr data-val="${i}">`;
      html += `<td><strong>${HEX_CHARS[i]}</strong></td>`;
      html += `<td>${a}</td><td>${b}</td><td>${c}</td><td>${d}</td>`;
      SEGMENTS.forEach((s) => {
        const val = state2.isCommonAnode ? 1 - p[s] : p[s];
        const isLit = state2.isCommonAnode ? val === 0 : val === 1;
        const cls = isLit ? "tt-one" : "tt-zero";
        html += `<td class="${cls}">${val}</td>`;
      });
      html += `</tr>`;
    }
    html += `</tbody></table>`;
    els2.truthTable.innerHTML = html;
  }
  function buildExpressions(deps2) {
    const { state: state2, els: els2, sfx } = deps2;
    const expressions = state2.isHexMode ? HEX_EXPRESSIONS : BCD_EXPRESSIONS;
    els2.booleanExpressions.innerHTML = SEGMENTS.map((s) => `
        <div class="expression-card">
            <h3>Segment ${s.toUpperCase()}</h3>
            <div class="expression-formula">${s} = ${expressions[s]}</div>
        </div>
    `).join("");
    const code = generateVerilogModule(state2.isHexMode, state2.isCommonAnode);
    els2.verilogBox.textContent = code;
    els2.copyVerilogBtn.onclick = () => {
      if (sfx) sfx.click(true);
      navigator.clipboard.writeText(code).then(() => {
        els2.copyVerilogBtn.textContent = "\u2705 Copied!";
        els2.copyVerilogBtn.classList.add("copied");
        setTimeout(() => {
          els2.copyVerilogBtn.textContent = "\u{1F4CB} Copy Verilog";
          els2.copyVerilogBtn.classList.remove("copied");
        }, 1600);
      });
    };
  }
  function generateVerilogModule(isHexMode, isCommonAnode) {
    const modName = isHexMode ? "hex_to_7seg_decoder" : "bcd_to_7seg_decoder";
    return `// Synthesizable 7-Segment Decoder (${isHexMode ? "Hex 0-F" : "BCD 0-9"}, ${isCommonAnode ? "Common Anode" : "Common Cathode"})
module ${modName} (
    input  wire [3:0] in,
    output reg  [6:0] seg // {a, b, c, d, e, f, g}
);
    always @(*) begin
        case (in)
            4'h0: seg = 7'b${isCommonAnode ? "0000001" : "1111110"}; // 0
            4'h1: seg = 7'b${isCommonAnode ? "1001111" : "0110000"}; // 1
            4'h2: seg = 7'b${isCommonAnode ? "0010010" : "1101101"}; // 2
            4'h3: seg = 7'b${isCommonAnode ? "0000110" : "1111001"}; // 3
            4'h4: seg = 7'b${isCommonAnode ? "1001100" : "0110011"}; // 4
            4'h5: seg = 7'b${isCommonAnode ? "0100100" : "1011011"}; // 5
            4'h6: seg = 7'b${isCommonAnode ? "0100000" : "1011111"}; // 6
            4'h7: seg = 7'b${isCommonAnode ? "0001111" : "1110000"}; // 7
            4'h8: seg = 7'b${isCommonAnode ? "0000000" : "1111111"}; // 8
            4'h9: seg = 7'b${isCommonAnode ? "0000100" : "1111011"}; // 9
            ${isHexMode ? `
            4'hA: seg = 7'b${isCommonAnode ? "0001000" : "1110111"}; // A
            4'hB: seg = 7'b${isCommonAnode ? "1100000" : "0011111"}; // b
            4'hC: seg = 7'b${isCommonAnode ? "0110001" : "1001110"}; // C
            4'hD: seg = 7'b${isCommonAnode ? "1000010" : "0111101"}; // d
            4'hE: seg = 7'b${isCommonAnode ? "0110000" : "1001111"}; // E
            4'hF: seg = 7'b${isCommonAnode ? "0111000" : "1000111"}; // F` : ""}
            default: seg = 7'b${isCommonAnode ? "1111111" : "0000000"};
        endcase
    end
endmodule`;
  }
  function buildKarnaughMaps(deps2) {
    const { state: state2, els: els2 } = deps2;
    const rowLabels = ["00", "01", "11", "10"];
    const colLabels = ["00", "01", "11", "10"];
    const grid = [
      [0, 1, 3, 2],
      [4, 5, 7, 6],
      [12, 13, 15, 14],
      [8, 9, 11, 10]
    ];
    els2.karnaughMaps.innerHTML = SEGMENTS.map((s) => {
      const minterms = state2.isHexMode ? Array.from({ length: 16 }, (_, i) => i).filter((i) => HEX_PATTERNS[i][s] === 1) : BCD_MINTERMS[s];
      let table = `<table class="karnaugh-map"><thead><tr><th>AB\\CD</th>`;
      colLabels.forEach((c) => {
        table += `<th>${c}</th>`;
      });
      table += `</tr></thead><tbody>`;
      for (let r = 0; r < 4; r++) {
        table += `<tr><th>${rowLabels[r]}</th>`;
        for (let c = 0; c < 4; c++) {
          const m = grid[r][c];
          let cellCls = "km-zero";
          let cellVal = "0";
          if (!state2.isHexMode && m >= 10) {
            cellCls = "km-dontcare";
            cellVal = "X";
          } else if (minterms.includes(m)) {
            cellCls = "km-one";
            cellVal = "1";
          }
          table += `<td class="${cellCls}">
                    <span class="km-minterm">m${m}</span>
                    <span class="km-value">${cellVal}</span>
                </td>`;
        }
        table += `</tr>`;
      }
      table += `</tbody></table>`;
      return `
            <div class="kmap-card">
                <h3>Segment ${s.toUpperCase()}</h3>
                ${table}
            </div>
        `;
    }).join("");
  }
  function renderCircuitDiagram(deps2) {
    const { state: state2, els: els2 } = deps2;
    els2.circuitDiagram.innerHTML = renderDecoderSchematic(
      state2.currentInput,
      state2.segmentValues,
      state2.isHexMode,
      state2.isCommonAnode
    );
    applyZoom(deps2);
  }
  function applyZoom(deps2) {
    const { state: state2, els: els2 } = deps2;
    const svg = els2.circuitDiagram.querySelector("svg");
    if (svg) {
      svg.style.transform = `translate(${state2.panX}px, ${state2.panY}px) scale(${state2.zoomScale})`;
    }
  }
  function resetZoom(deps2) {
    deps2.state.zoomScale = 1;
    deps2.state.panX = 0;
    deps2.state.panY = 0;
    applyZoom(deps2);
  }
  function setupZoomPan(deps2) {
    const { state: state2, els: els2, sfx } = deps2;
    let isDragging = false;
    let startDragX = 0;
    let startDragY = 0;
    els2.zoomInBtn.addEventListener("click", () => {
      state2.zoomScale = Math.min(2.5, state2.zoomScale + 0.2);
      applyZoom(deps2);
      if (sfx) sfx.click(true);
    });
    els2.zoomOutBtn.addEventListener("click", () => {
      state2.zoomScale = Math.max(0.4, state2.zoomScale - 0.2);
      applyZoom(deps2);
      if (sfx) sfx.click(false);
    });
    els2.zoomResetBtn.addEventListener("click", () => resetZoom(deps2));
    els2.circuitDiagram.addEventListener("wheel", (e) => {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 0.1 : -0.1;
      state2.zoomScale = Math.min(2.5, Math.max(0.4, state2.zoomScale + delta));
      applyZoom(deps2);
    }, { passive: false });
    els2.circuitDiagram.addEventListener("mousedown", (e) => {
      if (e.button !== 0) return;
      isDragging = true;
      startDragX = e.clientX - state2.panX;
      startDragY = e.clientY - state2.panY;
      els2.circuitDiagram.style.cursor = "grabbing";
    });
    window.addEventListener("mousemove", (e) => {
      if (!isDragging) return;
      state2.panX = e.clientX - startDragX;
      state2.panY = e.clientY - startDragY;
      applyZoom(deps2);
    });
    window.addEventListener("mouseup", () => {
      isDragging = false;
      els2.circuitDiagram.style.cursor = "grab";
    });
  }
  function setupCounter(deps2) {
    const { state: state2, els: els2, sfx } = deps2;
    function stepCounter(dir = 1) {
      const maxVal = state2.isHexMode ? 15 : 9;
      if (dir === 1) {
        state2.currentInput = (state2.currentInput + 1) % (maxVal + 1);
      } else {
        state2.currentInput = (state2.currentInput - 1 + (maxVal + 1)) % (maxVal + 1);
      }
      if (sfx) sfx.tick();
      syncDisplayFromInput(deps2);
    }
    els2.counterStart.addEventListener("click", () => {
      if (state2.counterInterval) return;
      els2.counterStart.disabled = true;
      els2.counterStop.disabled = false;
      if (sfx) sfx.relay();
      const speed = Number(els2.counterSpeed.value);
      state2.counterInterval = setInterval(() => stepCounter(1), speed);
    });
    els2.counterStop.addEventListener("click", () => {
      if (state2.counterInterval) {
        clearInterval(state2.counterInterval);
        state2.counterInterval = null;
      }
      els2.counterStart.disabled = false;
      els2.counterStop.disabled = true;
      if (sfx) sfx.click(false);
    });
    els2.counterReset.addEventListener("click", () => {
      if (state2.counterInterval) {
        clearInterval(state2.counterInterval);
        state2.counterInterval = null;
        els2.counterStart.disabled = false;
        els2.counterStop.disabled = true;
      }
      state2.currentInput = 0;
      if (sfx) sfx.click(true);
      syncDisplayFromInput(deps2);
    });
    els2.counterStepFwd.addEventListener("click", () => stepCounter(1));
    els2.counterStepBack.addEventListener("click", () => stepCounter(-1));
    els2.counterSpeed.addEventListener("input", () => {
      const ms = Number(els2.counterSpeed.value);
      const hz = (1e3 / ms).toFixed(2);
      els2.speedLabel.textContent = `${ms}ms (${hz} Hz)`;
      if (state2.counterInterval) {
        clearInterval(state2.counterInterval);
        state2.counterInterval = setInterval(() => stepCounter(1), ms);
      }
    });
  }
  function setupLedColorPicker(deps2) {
    document.querySelectorAll(".color-swatch").forEach((swatch) => {
      swatch.addEventListener("click", () => {
        const theme = swatch.getAttribute("data-led");
        if (theme) {
          document.body.classList.remove("led-red", "led-green", "led-cyan", "led-amber", "led-purple", "led-white");
          document.body.classList.add(theme);
          document.querySelectorAll(".color-swatch").forEach((s) => s.classList.remove("active"));
          swatch.classList.add("active");
          if (deps2.sfx) deps2.sfx.click(true);
          updateAllViews(deps2);
        }
      });
    });
  }
  function setupKeyboard(deps2) {
    const { state: state2, sfx } = deps2;
    window.addEventListener("keydown", (e) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const key = e.key.toUpperCase();
      const hexIdx = HEX_CHARS.indexOf(key);
      if (hexIdx !== -1) {
        if (!state2.isHexMode && hexIdx > 9) return;
        state2.currentInput = hexIdx;
        if (sfx) sfx.relay();
        syncDisplayFromInput(deps2);
      }
    });
  }
  function setupModeControls(deps2) {
    const { state: state2, els: els2, sfx } = deps2;
    function refreshAll() {
      syncDisplayFromInput(deps2);
      buildTruthTable(deps2);
      buildExpressions(deps2);
      buildKarnaughMaps(deps2);
    }
    document.querySelectorAll(".category-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const cat = btn.getAttribute("data-category");
        state2.currentMode = cat;
        els2.step1.classList.add("hidden");
        els2.step3.classList.remove("hidden");
        els2.counterSection.classList.toggle("hidden", state2.currentMode !== "counter");
        els2.displayHint.textContent = state2.currentMode === "interactive" ? "Click segments, use binary switches, or press 0-F on your keyboard to control the display." : "Use the clock controls below to run the automated counter.";
        els2.breadcrumbCurrent.textContent = `7-Segment Display Simulator / ${state2.currentMode === "interactive" ? "Interactive Mode" : "Counter Mode"}`;
        if (sfx) sfx.relay();
        refreshAll();
      });
    });
    els2.backToStep2.addEventListener("click", () => {
      if (state2.counterInterval) {
        clearInterval(state2.counterInterval);
        state2.counterInterval = null;
        els2.counterStart.disabled = false;
        els2.counterStop.disabled = true;
      }
      els2.step1.classList.remove("hidden");
      els2.step3.classList.add("hidden");
      els2.breadcrumbCurrent.textContent = "7-Segment Display Simulator";
    });
    els2.encBcdBtn.addEventListener("click", () => {
      state2.isHexMode = false;
      els2.encBcdBtn.classList.add("active");
      els2.encHexBtn.classList.remove("active");
      if (state2.currentInput > 9) state2.currentInput = 0;
      if (sfx) sfx.click(true);
      refreshAll();
    });
    els2.encHexBtn.addEventListener("click", () => {
      state2.isHexMode = true;
      els2.encHexBtn.classList.add("active");
      els2.encBcdBtn.classList.remove("active");
      if (sfx) sfx.click(true);
      refreshAll();
    });
    els2.polCathodeBtn.addEventListener("click", () => {
      state2.isCommonAnode = false;
      els2.polCathodeBtn.classList.add("active");
      els2.polAnodeBtn.classList.remove("active");
      if (sfx) sfx.click(true);
      syncDisplayFromInput(deps2);
      buildTruthTable(deps2);
      buildExpressions(deps2);
    });
    els2.polAnodeBtn.addEventListener("click", () => {
      state2.isCommonAnode = true;
      els2.polAnodeBtn.classList.add("active");
      els2.polCathodeBtn.classList.remove("active");
      if (sfx) sfx.click(true);
      syncDisplayFromInput(deps2);
      buildTruthTable(deps2);
      buildExpressions(deps2);
    });
  }

  // Web3/script.ts
  function byId(id) {
    return document.getElementById(id);
  }
  var els = {
    step1: byId("step1"),
    step3: byId("step3"),
    backToStep2: byId("backToStep2"),
    breadcrumbCurrent: byId("breadcrumbCurrent"),
    encBcdBtn: byId("encBcdBtn"),
    encHexBtn: byId("encHexBtn"),
    polCathodeBtn: byId("polCathodeBtn"),
    polAnodeBtn: byId("polAnodeBtn"),
    segmentDisplay: byId("segmentDisplay"),
    reverseMatchText: byId("reverseMatchText"),
    bcdInput: byId("bcdInput"),
    truthTable: byId("truthTable"),
    booleanExpressions: byId("booleanExpressions"),
    karnaughMaps: byId("karnaughMaps"),
    circuitDiagram: byId("circuitDiagram"),
    verilogBox: byId("verilogBox"),
    copyVerilogBtn: byId("copyVerilogBtn"),
    segTimingCanvas: byId("segTimingCanvas"),
    displayHint: byId("displayHint"),
    counterSection: byId("counterSection"),
    counterStart: byId("counterStart"),
    counterStop: byId("counterStop"),
    counterReset: byId("counterReset"),
    counterStepFwd: byId("counterStepFwd"),
    counterStepBack: byId("counterStepBack"),
    counterSpeed: byId("counterSpeed"),
    speedLabel: byId("speedLabel"),
    zoomInBtn: byId("zoomInBtn"),
    zoomOutBtn: byId("zoomOutBtn"),
    zoomResetBtn: byId("zoomResetBtn")
  };
  var state = {
    currentMode: "interactive",
    isHexMode: false,
    isCommonAnode: false,
    currentInput: 0,
    segmentValues: { a: 1, b: 1, c: 1, d: 1, e: 1, f: 1, g: 0 },
    zoomScale: 1,
    panX: 0,
    panY: 0,
    segWaveHistory: [],
    segWaveTimer: 0,
    counterInterval: null
  };
  var deps = {
    els,
    state,
    sfx: window.StudioFX ?? null
  };
  setupZoomPan(deps);
  setupCounter(deps);
  setupLedColorPicker(deps);
  setupKeyboard(deps);
  setupModeControls(deps);
  buildInputs(deps);
  buildTruthTable(deps);
  buildExpressions(deps);
  buildKarnaughMaps(deps);
  syncDisplayFromInput(deps);
})();
