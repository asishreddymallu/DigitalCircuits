"use strict";
(() => {
  // Web1/src/ui/dom.ts
  function byId(id) {
    const el2 = document.getElementById(id);
    if (!el2) throw new Error(`Missing #${id} \u2014 index.html is out of sync with script.js`);
    return el2;
  }
  function maybeById(id) {
    return document.getElementById(id);
  }
  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== void 0) node.textContent = text;
    return node;
  }
  function escapeHtml(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
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
  function generateCombinations(variableCount) {
    const total = 1 << variableCount;
    const combinations = [];
    for (let i = 0; i < total; i++) {
      const row = [];
      for (let bit = variableCount - 1; bit >= 0; bit--) {
        row.push(i >> bit & 1);
      }
      combinations.push(row);
    }
    return combinations;
  }
  function astTruthTable(ast, variables) {
    return generateCombinations(variables.length).map((inputs) => {
      const assignment = {};
      variables.forEach((v, i) => {
        assignment[v] = inputs[i] === 1;
      });
      return { inputs, output: evalAst(ast, assignment) ? 1 : 0 };
    });
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
  function getMinimizationSteps(minterms, variables, dontCares, form = "SOP") {
    const steps = [];
    const varCount = variables.length;
    const isPos = form === "POS";
    const terms = isPos ? [...minterms] : [...minterms];
    const dcTerms = dontCares ? [...dontCares] : [];
    steps.push({
      title: `Step 1: Identify ${isPos ? "Zeros (Maxterms)" : "Ones (Minterms)"}`,
      detail: `${isPos ? "F = 0" : "F = 1"} at indices: {${terms.sort((a, b) => a - b).join(", ") || "none"}}` + (dcTerms.length > 0 ? `
Don't cares: {${dcTerms.sort((a, b) => a - b).join(", ")}}` : "")
    });
    const allTerms = [.../* @__PURE__ */ new Set([...terms, ...dcTerms])].sort((a, b) => a - b);
    const binaryTerms = allTerms.map((m) => ({
      minterm: m,
      binary: m.toString(2).padStart(varCount, "0"),
      ones: (m.toString(2).padStart(varCount, "0").match(/1/g) || []).length,
      isDc: dcTerms.includes(m)
    }));
    let groupStr = "";
    const groups = /* @__PURE__ */ new Map();
    binaryTerms.forEach((bt) => {
      if (!groups.has(bt.ones)) groups.set(bt.ones, []);
      groups.get(bt.ones).push(bt);
    });
    [...groups.keys()].sort((a, b) => a - b).forEach((k) => {
      groupStr += `
  Group ${k}: ${groups.get(k).map((bt) => `${bt.binary} (m${bt.minterm}${bt.isDc ? ", dc" : ""})`).join(", ")}`;
    });
    steps.push({
      title: "Step 2: Group by Number of 1s",
      detail: `Group minterms and don't-cares by popcount (number of 1-bits):${groupStr}`
    });
    const primes = getPrimeImplicants(allTerms, varCount);
    steps.push({
      title: "Step 3: Find Prime Implicants",
      detail: `Merge patterns differing in exactly one bit until no more merges are possible.
Found ${primes.length} prime implicant(s):
` + primes.map((p, i) => `  PI${i + 1}: [${p.pattern}] \u2014 covers minterms {${allTerms.filter((m) => patternCovers(p.pattern, m, varCount)).join(", ")}}`).join("\n")
    });
    const chartLines = [];
    const chart = primes.map(
      (p) => terms.map((m) => patternCovers(p.pattern, m, varCount))
    );
    terms.forEach((m, c) => {
      const covering = [];
      primes.forEach((p, r) => {
        if (chart[r][c]) covering.push(`PI${r + 1}`);
      });
      chartLines.push(`  m${m}: covered by ${covering.join(", ") || "none"}`);
    });
    steps.push({
      title: "Step 4: Build Prime Implicant Chart",
      detail: `Check which minterms each prime implicant covers:
${chartLines.join("\n")}`
    });
    const essentialIndices = [];
    for (let c = 0; c < terms.length; c++) {
      const coveringPrimes = [];
      for (let r = 0; r < primes.length; r++) {
        if (chart[r][c]) coveringPrimes.push(r);
      }
      if (coveringPrimes.length === 1) {
        essentialIndices.push(coveringPrimes[0]);
      }
    }
    const uniqueEssentials = [...new Set(essentialIndices)];
    const essentialMintermsCovered = /* @__PURE__ */ new Set();
    uniqueEssentials.forEach((r) => {
      terms.forEach((m, c) => {
        if (chart[r][c]) essentialMintermsCovered.add(m);
      });
    });
    const remainingToCover = terms.filter((m) => !essentialMintermsCovered.has(m));
    steps.push({
      title: "Step 5: Identify Essential Prime Implicants",
      detail: uniqueEssentials.length > 0 ? `Essential PIs (cover minterms uniquely \u2014 no other PI can cover them):
` + uniqueEssentials.map((i) => `  \u2022 PI${i + 1} [${primes[i].pattern}] \u2014 covers minterms {${terms.filter((m) => chart[i][terms.indexOf(m)]).join(", ")}}`).join("\n") + (remainingToCover.length > 0 ? `

Remaining minterms to cover: {${remainingToCover.join(", ")}}` : `

All minterms covered by essential PIs!`) : "No essential prime implicants found \u2014 all minterms are covered by multiple PIs."
    });
    const result = isPos ? minimizePOS(minterms, variables, dontCares) : minimizeSOP(minterms, variables, dontCares);
    const finalForm = result.implicants.map((p) => p.pattern).join(", ");
    const totalLiterals = result.implicants.reduce((sum, p) => {
      return sum + p.pattern.split("").filter((c) => c !== "-").length;
    }, 0);
    steps.push({
      title: "Step 6: Select Minimum Cover",
      detail: `Combine essential primes + remaining primes to cover all minterms with minimum terms.
Final ${form} cover: {${finalForm || "empty"}}
Result: ${result.implicants.length} term(s), ${totalLiterals} literal(s)` + (result.coverTruncated ? "\n\u26A0 Greedy fallback used (function too large for exact search)" : "")
    });
    return steps;
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
  function minimizePOS(zeros, variables, dontCares, options) {
    assertMinimizable(variables.length, zeros.length + (dontCares?.size ?? 0));
    const varCount = variables.length;
    if (zeros.length === 0) {
      return { implicants: [], isConstant: true, constantValue: true, coverTruncated: false };
    }
    if (zeros.length + (dontCares?.size ?? 0) === 1 << varCount) {
      return {
        implicants: [{ pattern: "-".repeat(varCount) }],
        isConstant: true,
        constantValue: false,
        coverTruncated: false
      };
    }
    const allTerms = dontCares ? [.../* @__PURE__ */ new Set([...zeros, ...dontCares])] : zeros;
    const primes = getPrimeImplicants(allTerms, varCount);
    if (primes.length > 5e3) {
      throw new LimitError(
        `This function produced ${primes.length} prime implicants, which is too complex to minimize interactively.`
      );
    }
    const { cover, truncated } = findMinimumCover(zeros, primes, varCount, options?.nodeBudget ?? LIMITS.MINIMIZE_NODE_BUDGET);
    return { implicants: cover, isConstant: false, coverTruncated: truncated };
  }
  function patternToTermAst(pattern, variables) {
    const literals = [];
    for (let i = 0; i < pattern.length; i++) {
      if (pattern[i] === "1") literals.push({ kind: "var", name: variables[i] });
      else if (pattern[i] === "0") literals.push({ kind: "not", child: { kind: "var", name: variables[i] } });
    }
    if (literals.length === 0) return { kind: "const", value: true };
    return literals.reduce((acc, lit) => ({ kind: "and", left: acc, right: lit }));
  }
  function sopAstFromImplicants(implicants, variables) {
    if (implicants.length === 0) return { kind: "const", value: false };
    return implicants.map((imp) => patternToTermAst(imp.pattern, variables)).reduce((acc, term) => ({ kind: "or", left: acc, right: term }));
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
  function clauseToString(pattern, variables, orSymbol = " + ") {
    const parts = [];
    for (let i = 0; i < pattern.length; i++) {
      if (pattern[i] === "0") parts.push(variables[i]);
      else if (pattern[i] === "1") parts.push(`${variables[i]}'`);
    }
    if (parts.length === 0) return "0";
    return parts.length === 1 ? parts[0] : `(${parts.join(orSymbol)})`;
  }

  // Web1/src/circuits/circuitGraph.ts
  var circuitCounter = 0;
  function resetCircuitIds() {
    circuitCounter = 0;
  }
  function createGraph() {
    return { nodes: [], output: "", inputs: [] };
  }
  function addNode(graph, type, inputs = [], label = "") {
    const id = `node_${circuitCounter++}`;
    graph.nodes.push({ id, type, inputs, label });
    return id;
  }
  function addInput(graph, variable) {
    const existing = graph.nodes.find((n) => n.type === "INPUT" && n.label === variable);
    if (existing) return existing.id;
    const id = addNode(graph, "INPUT", [], variable);
    graph.inputs.push(id);
    return id;
  }
  var isAllDash = (imp, n) => imp.pattern === "-".repeat(n);
  function buildBasicSOPCircuit(implicants, variables) {
    const graph = createGraph();
    variables.forEach((v) => addInput(graph, v));
    if (implicants.length === 0) {
      graph.output = addNode(graph, "CONST", [], "0");
      return graph;
    }
    if (implicants.length === 1 && isAllDash(implicants[0], variables.length)) {
      graph.output = addNode(graph, "CONST", [], "1");
      return graph;
    }
    const notMap = /* @__PURE__ */ new Map();
    const getNot = (varName) => {
      if (!notMap.has(varName)) {
        const inId = addInput(graph, varName);
        notMap.set(varName, addNode(graph, "NOT", [inId], `~${varName}`));
      }
      return notMap.get(varName);
    };
    const termNodeIds = [];
    implicants.forEach((imp) => {
      const literalIds = [];
      for (let i = 0; i < imp.pattern.length; i++) {
        if (imp.pattern[i] === "1") literalIds.push(addInput(graph, variables[i]));
        else if (imp.pattern[i] === "0") literalIds.push(getNot(variables[i]));
      }
      if (literalIds.length === 1) {
        termNodeIds.push(literalIds[0]);
      } else if (literalIds.length > 1) {
        termNodeIds.push(addNode(graph, "AND", literalIds));
      }
    });
    graph.output = termNodeIds.length === 1 ? termNodeIds[0] : addNode(graph, "OR", termNodeIds);
    return graph;
  }
  function buildNANDCircuit(implicants, variables) {
    const graph = createGraph();
    variables.forEach((v) => addInput(graph, v));
    if (implicants.length === 0) {
      graph.output = addNode(graph, "CONST", [], "0");
      return graph;
    }
    if (implicants.length === 1 && isAllDash(implicants[0], variables.length)) {
      graph.output = addNode(graph, "CONST", [], "1");
      return graph;
    }
    const notMap = /* @__PURE__ */ new Map();
    const getNandNot = (varName) => {
      if (!notMap.has(varName)) {
        const inId = addInput(graph, varName);
        notMap.set(varName, addNode(graph, "NAND", [inId, inId], `~${varName}`));
      }
      return notMap.get(varName);
    };
    const layer1Ids = [];
    implicants.forEach((imp) => {
      const literals = [];
      for (let i = 0; i < imp.pattern.length; i++) {
        if (imp.pattern[i] === "1") literals.push(addInput(graph, variables[i]));
        else if (imp.pattern[i] === "0") literals.push(getNandNot(variables[i]));
      }
      if (literals.length === 1) {
        layer1Ids.push(addNode(graph, "NAND", [literals[0], literals[0]]));
      } else {
        layer1Ids.push(addNode(graph, "NAND", literals));
      }
    });
    graph.output = layer1Ids.length === 1 ? addNode(graph, "NAND", [layer1Ids[0], layer1Ids[0]]) : addNode(graph, "NAND", layer1Ids);
    return graph;
  }
  function buildNORCircuit(implicants, variables) {
    const graph = createGraph();
    variables.forEach((v) => addInput(graph, v));
    if (implicants.length === 0) {
      graph.output = addNode(graph, "CONST", [], "1");
      return graph;
    }
    if (implicants.length === 1 && isAllDash(implicants[0], variables.length)) {
      graph.output = addNode(graph, "CONST", [], "0");
      return graph;
    }
    const notMap = /* @__PURE__ */ new Map();
    const getNorNot = (varName) => {
      if (!notMap.has(varName)) {
        const inId = addInput(graph, varName);
        notMap.set(varName, addNode(graph, "NOR", [inId, inId], `~${varName}`));
      }
      return notMap.get(varName);
    };
    const layer1Ids = [];
    implicants.forEach((imp) => {
      const literals = [];
      for (let i = 0; i < imp.pattern.length; i++) {
        if (imp.pattern[i] === "0") literals.push(addInput(graph, variables[i]));
        else if (imp.pattern[i] === "1") literals.push(getNorNot(variables[i]));
      }
      if (literals.length === 1) {
        layer1Ids.push(addNode(graph, "NOR", [literals[0], literals[0]]));
      } else {
        layer1Ids.push(addNode(graph, "NOR", literals));
      }
    });
    graph.output = layer1Ids.length === 1 ? addNode(graph, "NOR", [layer1Ids[0], layer1Ids[0]]) : addNode(graph, "NOR", layer1Ids);
    return graph;
  }
  function computeCircuitStats(graph) {
    const gateBreakdown = {};
    let totalGateInputs = 0;
    graph.nodes.forEach((node) => {
      if (node.type === "INPUT" || node.type === "CONST") return;
      gateBreakdown[node.type] = (gateBreakdown[node.type] || 0) + 1;
      totalGateInputs += node.inputs.length;
    });
    const gateCount = Object.values(gateBreakdown).reduce((a, b) => a + b, 0);
    const depthCache = /* @__PURE__ */ new Map();
    function getDepth(id) {
      const cached = depthCache.get(id);
      if (cached !== void 0) return cached;
      const node = graph.nodes.find((n) => n.id === id);
      if (!node) return 0;
      if (node.type === "INPUT" || node.type === "CONST") {
        depthCache.set(id, 0);
        return 0;
      }
      let maxInputDepth = 0;
      for (const inId of node.inputs) {
        maxInputDepth = Math.max(maxInputDepth, getDepth(inId));
      }
      const depth = maxInputDepth + 1;
      depthCache.set(id, depth);
      return depth;
    }
    const logicDepth = getDepth(graph.output);
    return { gateCount, logicDepth, totalGateInputs, gateBreakdown };
  }
  function evaluateCircuit(graph, assignment) {
    const memo = /* @__PURE__ */ new Map();
    function evaluateNode(id) {
      const cached = memo.get(id);
      if (cached !== void 0) return cached;
      const node = graph.nodes.find((n) => n.id === id);
      if (!node) return false;
      let result = false;
      switch (node.type) {
        case "INPUT":
          result = assignment[node.label] ?? false;
          break;
        case "CONST":
          result = node.label === "1";
          break;
        case "NOT":
          result = !evaluateNode(node.inputs[0]);
          break;
        case "AND":
          result = node.inputs.every((inId) => evaluateNode(inId));
          break;
        case "OR":
          result = node.inputs.some((inId) => evaluateNode(inId));
          break;
        case "NAND":
          result = !node.inputs.every((inId) => evaluateNode(inId));
          break;
        case "NOR":
          result = !node.inputs.some((inId) => evaluateNode(inId));
          break;
      }
      memo.set(id, result);
      return result;
    }
    return evaluateNode(graph.output);
  }
  function evaluateAllNodeValues(graph, assignment) {
    const nodeValues = /* @__PURE__ */ new Map();
    function evalNode(id) {
      const cached = nodeValues.get(id);
      if (cached !== void 0) return cached;
      const node = graph.nodes.find((n) => n.id === id);
      if (!node) return false;
      let val = false;
      switch (node.type) {
        case "INPUT":
          val = assignment[node.label] ?? false;
          break;
        case "CONST":
          val = node.label === "1";
          break;
        case "NOT":
          val = !evalNode(node.inputs[0]);
          break;
        case "AND":
          val = node.inputs.every((inp) => evalNode(inp));
          break;
        case "OR":
          val = node.inputs.some((inp) => evalNode(inp));
          break;
        case "NAND":
          val = !node.inputs.every((inp) => evalNode(inp));
          break;
        case "NOR":
          val = !node.inputs.some((inp) => evalNode(inp));
          break;
      }
      nodeValues.set(id, val);
      return val;
    }
    graph.nodes.forEach((n) => evalNode(n.id));
    return nodeValues;
  }

  // Web1/src/solver.ts
  var SolverInputError = class extends Error {
  };
  function generateVariableNames(count) {
    const names = [];
    for (let i = 0; i < count; i++) {
      names.push(String.fromCharCode(65 + i));
    }
    return names;
  }
  function assertVarLimit(count) {
    if (count > LIMITS.MAX_VARIABLES) {
      throw new SolverInputError(
        `${count} variables exceeds the supported maximum of ${LIMITS.MAX_VARIABLES}.`
      );
    }
  }
  function joinLiteralsForDisplay(literals) {
    let out = "";
    literals.forEach((lit, i) => {
      if (i > 0 && /[A-Za-z0-9_]/.test(out[out.length - 1]) && /[A-Za-z0-9_]/.test(lit[0])) {
        out += "\xB7";
      }
      out += lit;
    });
    return out;
  }
  function sopDisplay(result, variables) {
    if (result.isConstant) return result.constantValue ? "1" : "0";
    if (result.implicants.length === 0) return "0";
    return result.implicants.map((imp) => termToString(imp.pattern, variables)).join(" + ");
  }
  function posDisplay(result, variables) {
    if (result.isConstant) return result.constantValue ? "1" : "0";
    if (result.implicants.length === 0) return "1";
    return result.implicants.map((imp) => clauseToString(imp.pattern, variables)).join("");
  }
  function generateCanonicalSOP(rows, variables, dontCares) {
    const terms = rows.map((row, index) => ({ row, index })).filter(({ row, index }) => row.output === 1 && (!dontCares || !dontCares.has(index))).map(({ row }) => joinLiteralsForDisplay(
      row.inputs.map((val, idx) => val ? variables[idx] : `${variables[idx]}'`)
    ));
    return terms.length > 0 ? terms.join(" + ") : "0";
  }
  function generateCanonicalPOS(rows, variables, dontCares) {
    const clauses = rows.map((row, index) => ({ row, index })).filter(({ row, index }) => row.output === 0 && (!dontCares || !dontCares.has(index))).map(({ row }) => {
      const sum = row.inputs.map((val, idx) => val ? `${variables[idx]}'` : variables[idx]).join(" + ");
      return `(${sum})`;
    });
    return clauses.length > 0 ? clauses.join("") : "1";
  }
  function buildSolverModel(raw) {
    switch (raw.mode) {
      case "expression":
        return fromExpression(raw.expression ?? "");
      case "minterms":
        return fromMintermList(raw.mintermCount, raw.mintermList ?? [], /* @__PURE__ */ new Set(), "minterms");
      case "maxterms":
        return fromMaxtermList(raw.maxtermCount, raw.maxtermList ?? []);
      case "dontCare":
        return fromDontCare(raw.dontCareCount, raw.dontCareMintermList ?? [], raw.dontCareList ?? []);
      case "truthTable":
        return fromTruthSelections(raw.truthSelections ?? []);
      case "wordProblem":
        return fromWordProblem(raw.wordProblem);
      case "circuitImage":
        return fromCircuitImage(raw.circuitImage);
      case "timingImage":
        return fromExpression(raw.expression ?? "");
    }
  }
  function finish(mode, variables, originalAst, originalDisplay, rows, dontCares) {
    const ones = [];
    const zeros = [];
    rows.forEach((row, index) => {
      if (row.output === 1) ones.push(index);
      else if (row.output === 0) zeros.push(index);
    });
    const hasDontCares = dontCares.size > 0;
    const dc = hasDontCares ? dontCares : void 0;
    const sop = minimizeSOP(ones, variables, dc);
    const pos = minimizePOS(zeros, variables, dc);
    const simplifiedAst = sop.isConstant ? { kind: "const", value: !!sop.constantValue } : sopAstFromImplicants(sop.implicants, variables);
    return {
      mode,
      variables,
      rows,
      ones,
      zeros,
      dontCares,
      hasDontCares,
      originalAst,
      originalDisplay,
      canonicalSOP: generateCanonicalSOP(rows, variables, dc),
      canonicalPOS: generateCanonicalPOS(rows, variables, dc),
      sop,
      pos,
      simplifiedAst,
      simplifiedDisplay: sopDisplay(sop, variables),
      simplifiedCoverTruncated: sop.coverTruncated
    };
  }
  function astFromMinterms(minterms, variables) {
    if (minterms.length === 0) return { kind: "const", value: false };
    if (minterms.length === 1 << variables.length) return { kind: "const", value: true };
    return minterms.map((m) => patternToTermAst(toPattern(m, variables.length), variables)).reduce((acc, term) => ({ kind: "or", left: acc, right: term }));
  }
  function toPattern(minterm, varCount) {
    return minterm.toString(2).padStart(varCount, "0");
  }
  function mintermExpansionDisplay(minterms, varCount) {
    const variables = generateVariableNames(varCount);
    if (minterms.length === 0) return "0";
    if (minterms.length === 1 << varCount) return "1";
    return minterms.map((m) => termToString(toPattern(m, varCount), variables)).join(" + ");
  }
  function rowsFromMinterms(variableCount, minterms, dontCares) {
    const combinations = generateCombinations(variableCount);
    return combinations.map((inputs, index) => {
      let output;
      if (minterms.includes(index)) output = 1;
      else if (dontCares.has(index)) output = -1;
      else output = 0;
      return { inputs, output };
    });
  }
  function validateIndices(list, varCount, label) {
    const maxVal = (1 << varCount) - 1;
    const bad = list.filter((v) => !Number.isInteger(v) || v < 0 || v > maxVal);
    if (bad.length > 0) {
      throw new SolverInputError(
        `${label} index out of range: ${bad.join(", ")}. For ${varCount} variables, valid indices are 0 to ${maxVal}.`
      );
    }
  }
  function fromExpression(expression) {
    const trimmed = expression.trim();
    const parsed = parseExpression(trimmed);
    const variables = [...new Set(parsed.variables)].sort();
    assertVarLimit(variables.length);
    return finish("expression", variables, parsed.ast, trimmed, astTruthTable(parsed.ast, variables), /* @__PURE__ */ new Set());
  }
  function fromMintermList(count, mintermList, dontCares, _origin) {
    assertVarLimit(count);
    const variables = generateVariableNames(count);
    validateIndices(mintermList, count, "Minterm");
    const unique = [...new Set(mintermList)].sort((a, b) => a - b);
    const ast = astFromMinterms(unique, variables);
    const display = mintermExpansionDisplay(unique, count);
    return finish("minterms", variables, ast, display, rowsFromMinterms(count, unique, dontCares), dontCares);
  }
  function fromMaxtermList(count, maxtermList) {
    assertVarLimit(count);
    const variables = generateVariableNames(count);
    validateIndices(maxtermList, count, "Maxterm");
    const unique = [...new Set(maxtermList)].sort((a, b) => a - b);
    const zerosSet = new Set(unique);
    const minterms = [];
    for (let i = 0; i < 1 << count; i++) {
      if (!zerosSet.has(i)) minterms.push(i);
    }
    const ast = astFromMinterms(minterms, variables);
    const display = unique.length === 0 ? "1" : unique.length === 1 << count ? "0" : unique.map((m) => clauseToString(toPattern(m, count), variables)).join("");
    return finish("maxterms", variables, ast, display, rowsFromMinterms(count, minterms, /* @__PURE__ */ new Set()), /* @__PURE__ */ new Set());
  }
  function fromDontCare(count, mintermList, dcList) {
    assertVarLimit(count);
    if (mintermList.length === 0 && dcList.length === 0) {
      throw new SolverInputError("Please enter at least one minterm or don't-care term.");
    }
    const overlap = mintermList.filter((m) => dcList.includes(m));
    if (overlap.length > 0) {
      throw new SolverInputError(`Terms ${overlap.join(", ")} appear in both minterms and don't cares.`);
    }
    validateIndices(mintermList, count, "Minterm");
    validateIndices(dcList, count, "Don't-care");
    const dontCares = new Set(dcList);
    return fromMintermList(count, mintermList, dontCares, "dontCare");
  }
  function fromTruthSelections(selections) {
    const count = Math.log2(selections.length);
    if (!Number.isInteger(count)) {
      throw new SolverInputError("Truth table length must be a power of two.");
    }
    const variables = generateVariableNames(count);
    const combinations = generateCombinations(count);
    const minterms = [];
    const dontCares = /* @__PURE__ */ new Set();
    const rows = [];
    selections.forEach((val, i) => {
      if (val === "1") {
        rows.push({ inputs: combinations[i], output: 1 });
        minterms.push(i);
      } else if (val === "X") {
        rows.push({ inputs: combinations[i], output: -1 });
        dontCares.add(i);
      } else {
        rows.push({ inputs: combinations[i], output: 0 });
      }
    });
    return finish(
      "truthTable",
      variables,
      astFromMinterms(minterms, variables),
      mintermExpansionDisplay(minterms, count),
      rows,
      dontCares
    );
  }
  function fromCircuitImage(ci) {
    if (ci.variables.length === 0) {
      throw new SolverInputError("The AI backend couldn't identify any variables in the circuit image.");
    }
    assertVarLimit(ci.variables.length);
    const dontCares = new Set(ci.dontCares.filter((d) => !ci.minterms.includes(d)));
    const sorted = [...new Set(ci.minterms)].sort((a, b) => a - b);
    validateIndices(sorted, ci.variables.length, "Minterm");
    const display = ci.expression || (sorted.length === 0 ? "0" : sorted.length === 1 << ci.variables.length ? "1" : sorted.map((m) => termToString(toPattern(m, ci.variables.length), ci.variables)).join(" + "));
    const originalAst = astFromMinterms(sorted, ci.variables);
    const originalDisplay = display;
    return finish(
      "circuitImage",
      ci.variables,
      originalAst,
      originalDisplay,
      rowsFromMinterms(ci.variables.length, sorted, dontCares),
      dontCares
    );
  }
  function fromWordProblem(wp) {
    if (wp.variables.length === 0) {
      throw new SolverInputError("The AI backend couldn't identify any variables in that problem.");
    }
    assertVarLimit(wp.variables.length);
    const dontCares = new Set(wp.dontCares.filter((d) => !wp.minterms.includes(d)));
    const sorted = [...new Set(wp.minterms)].sort((a, b) => a - b);
    validateIndices(sorted, wp.variables.length, "Minterm");
    const display = sorted.length === 0 ? "0" : sorted.length === 1 << wp.variables.length ? "1" : sorted.map((m) => termToString(toPattern(m, wp.variables.length), wp.variables)).join(" + ");
    return finish(
      "wordProblem",
      wp.variables,
      astFromMinterms(sorted, wp.variables),
      display,
      rowsFromMinterms(wp.variables.length, sorted, dontCares),
      dontCares
    );
  }
  function verifySolution(model, circuits) {
    for (let i = 0; i < model.rows.length; i++) {
      const row = model.rows[i];
      if (row.output === -1) continue;
      const assignment = {};
      model.variables.forEach((v, idx) => {
        assignment[v] = row.inputs[idx] === 1;
      });
      const expected = row.output === 1;
      if (evalAst(model.originalAst, assignment) !== expected || evalAst(model.simplifiedAst, assignment) !== expected || evaluateCircuit(circuits.basic, assignment) !== expected || evaluateCircuit(circuits.nand, assignment) !== expected || evaluateCircuit(circuits.nor, assignment) !== expected) {
        return false;
      }
    }
    return true;
  }

  // Web1/src/solverCore.ts
  function parseNumberList(raw) {
    return raw.split(/[\s,]+/).map((s) => s.trim()).filter((s) => s.length > 0).map(Number);
  }

  // Web1/src/ai/booleanApi.ts
  var DEFAULT_API_BASE = "https://digitalcircuits.onrender.com";
  var REQUEST_TIMEOUT_MS = 45e3;
  var ApiError = class extends Error {
  };
  function apiBase() {
    const override = window.DC_BOOLEAN_API_BASE;
    const base = override || DEFAULT_API_BASE;
    return base.replace(/\/+$/, "");
  }
  async function analyzeTimingDiagram(imageDataUrl, options = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6e4);
    const onExternalAbort = () => controller.abort();
    options.signal?.addEventListener("abort", onExternalAbort);
    try {
      const response = await fetch(`${apiBase()}/api/analyze-timing-diagram`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: imageDataUrl }),
        signal: controller.signal
      });
      if (!response.ok) {
        let detail = `Request failed (${response.status})`;
        try {
          const body = await response.json();
          if (body && typeof body.detail === "string") detail = body.detail;
        } catch {
        }
        throw new ApiError(detail);
      }
      const data = await response.json();
      return {
        signals: Array.isArray(data.signals) ? data.signals : [],
        time_steps: typeof data.time_steps === "number" ? data.time_steps : 16,
        confidence: typeof data.confidence === "number" ? data.confidence : void 0
      };
    } catch (err) {
      if (err instanceof ApiError) throw err;
      if (err instanceof DOMException && err.name === "AbortError") {
        throw new ApiError("The AI backend did not respond in time. Please try again.");
      }
      throw new ApiError("Could not reach the AI backend for timing diagram analysis.");
    } finally {
      clearTimeout(timer);
      options.signal?.removeEventListener("abort", onExternalAbort);
    }
  }
  function preprocessImage(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          const MAX_DIM = 1024;
          let w = img.width;
          let h = img.height;
          if (w > MAX_DIM || h > MAX_DIM) {
            const scale = MAX_DIM / Math.max(w, h);
            w = Math.round(w * scale);
            h = Math.round(h * scale);
          }
          const canvas = document.createElement("canvas");
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            reject(new Error("Canvas not available"));
            return;
          }
          ctx.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL("image/png"));
        };
        img.onerror = () => reject(new Error("Failed to load image"));
        img.src = reader.result;
      };
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsDataURL(file);
    });
  }
  async function analyzeCircuitImage(imageDataUrl, options = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6e4);
    const onExternalAbort = () => controller.abort();
    options.signal?.addEventListener("abort", onExternalAbort);
    try {
      const response = await fetch(`${apiBase()}/api/analyze-circuit-image`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: imageDataUrl }),
        signal: controller.signal
      });
      if (!response.ok) {
        let detail = `Request failed (${response.status})`;
        try {
          const body = await response.json();
          if (body && typeof body.detail === "string") {
            detail = body.detail;
          } else if (body && body.detail && typeof body.detail === "object") {
            const d = body.detail;
            if (typeof d.message === "string") detail = d.message;
            else if (typeof d.error === "string") detail = d.error;
            else if (typeof d.reason === "string") detail = d.reason;
            else detail = JSON.stringify(d);
          }
        } catch {
        }
        throw new ApiError(detail);
      }
      const data = await response.json();
      return {
        variables: Array.isArray(data.variables) ? data.variables.map(String) : [],
        minterms: Array.isArray(data.minterms) ? data.minterms.map(Number) : [],
        dontCares: Array.isArray(data.dont_cares) ? data.dont_cares.map(Number) : [],
        expression: typeof data.expression === "string" ? data.expression : void 0,
        confidence: typeof data.confidence === "number" ? data.confidence : void 0,
        circuit: data.circuit && typeof data.circuit === "object" ? data.circuit : void 0
      };
    } catch (err) {
      if (err instanceof ApiError) throw err;
      if (err instanceof DOMException && err.name === "AbortError") {
        throw new ApiError("The AI backend did not respond in time. Please try again.");
      }
      throw new ApiError("Could not reach the AI backend. Check your connection and try again.");
    } finally {
      clearTimeout(timer);
      options.signal?.removeEventListener("abort", onExternalAbort);
    }
  }
  async function fetchMintermsFromProblem(problemStatement, options = {}) {
    if (!problemStatement.trim()) {
      throw new ApiError("Please describe the boolean logic problem.");
    }
    if (problemStatement.length > LIMITS.MAX_PROBLEM_LENGTH) {
      throw new ApiError(
        `The problem description is too long (${problemStatement.length} characters). Maximum supported length is ${LIMITS.MAX_PROBLEM_LENGTH}.`
      );
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    const onExternalAbort = () => controller.abort();
    options.signal?.addEventListener("abort", onExternalAbort);
    try {
      const response = await fetch(`${apiBase()}/api/solve-boolean`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ problem_statement: problemStatement }),
        signal: controller.signal
      });
      if (!response.ok) {
        let detail = `Request failed (${response.status})`;
        try {
          const body = await response.json();
          if (body && typeof body.detail === "string") {
            detail = body.detail;
          } else if (body && body.detail && typeof body.detail === "object") {
            const d = body.detail;
            if (typeof d.message === "string") detail = d.message;
            else if (typeof d.error === "string") detail = d.error;
            else if (typeof d.reason === "string") detail = d.reason;
            else detail = JSON.stringify(d);
          }
        } catch {
        }
        throw new ApiError(detail);
      }
      const data = await response.json();
      return {
        variables: Array.isArray(data.variables) ? data.variables.map(String) : [],
        minterms: Array.isArray(data.minterms) ? data.minterms.map(Number) : [],
        dontCares: Array.isArray(data.dont_cares) ? data.dont_cares.map(Number) : [],
        variableDescriptions: data.variable_descriptions && typeof data.variable_descriptions === "object" ? data.variable_descriptions : void 0
      };
    } catch (err) {
      if (err instanceof ApiError) throw err;
      if (err instanceof DOMException && err.name === "AbortError") {
        throw new ApiError(
          "The AI backend did not respond in time. Please try again in a moment."
        );
      }
      throw new ApiError(
        "Could not reach the AI backend. Check your connection and try again."
      );
    } finally {
      clearTimeout(timer);
      options.signal?.removeEventListener("abort", onExternalAbort);
    }
  }

  // shared/ts/circuit/gates.ts
  var SOURCE_TYPES = /* @__PURE__ */ new Set(["INPUT", "CONST", "CLOCK", "SWITCH"]);

  // shared/ts/circuit/interop.ts
  var GATE_SIZES = {
    INPUT: { width: 80, height: 50 },
    OUTPUT: { width: 80, height: 50 },
    CONST: { width: 70, height: 50 },
    CLOCK: { width: 80, height: 50 },
    SWITCH: { width: 80, height: 50 },
    LED: { width: 70, height: 50 },
    BUFFER: { width: 60, height: 50 },
    NOT: { width: 70, height: 50 },
    AND: { width: 80, height: 60 },
    OR: { width: 80, height: 60 },
    NAND: { width: 90, height: 60 },
    NOR: { width: 90, height: 60 },
    XOR: { width: 80, height: 60 },
    XNOR: { width: 90, height: 60 }
  };
  var GRID_SIZE = 20;
  function convertWeb1Circuit(web1) {
    const idMap = /* @__PURE__ */ new Map();
    const sharedNodes = [];
    const connections = [];
    const inputNodeIds = [];
    let connCounter = 0;
    for (const node of web1.nodes) {
      const newId = `s_${node.id}`;
      idMap.set(node.id, newId);
      const sharedNode = {
        id: newId,
        type: node.type,
        label: node.label,
        inputs: [],
        config: node.type === "CONST" ? { value: node.label === "1" } : void 0
      };
      sharedNodes.push(sharedNode);
      if (SOURCE_TYPES.has(node.type)) {
        inputNodeIds.push(newId);
      }
    }
    for (const node of web1.nodes) {
      const targetId = idMap.get(node.id);
      for (let port = 0; port < node.inputs.length; port++) {
        const sourceId = idMap.get(node.inputs[port]);
        if (sourceId) {
          connections.push({
            id: `conn_${connCounter++}`,
            sourceId,
            targetId,
            targetPort: port
          });
        }
      }
    }
    return {
      id: `shared_${Date.now()}`,
      name: "Converted Circuit",
      version: 1,
      nodes: sharedNodes,
      connections,
      inputNodeIds,
      outputNodeId: idMap.get(web1.output)
    };
  }
  function getInputCount(type) {
    switch (type) {
      case "INPUT":
      case "SWITCH":
      case "CONST":
      case "CLOCK":
        return 0;
      case "NOT":
      case "BUFFER":
      case "OUTPUT":
      case "LED":
        return 1;
      default:
        return 2;
    }
  }
  function getOutputCount(type) {
    switch (type) {
      case "OUTPUT":
      case "LED":
        return 0;
      default:
        return 1;
    }
  }
  function getDefaultInputPorts(type, width, height) {
    const count = getInputCount(type);
    if (count === 0) return [];
    if (count === 1) return [{ x: 0, y: height / 2, side: "left", index: 0 }];
    const ports = [];
    for (let i = 0; i < count; i++) {
      const y = 15 + i * (height - 30) / (count - 1);
      ports.push({ x: 0, y, side: "left", index: i });
    }
    return ports;
  }
  function getDefaultOutputPorts(type, width, height) {
    const count = getOutputCount(type);
    if (count === 0) return [];
    if (count === 1) return [{ x: width, y: height / 2, side: "right", index: 0 }];
    const ports = [];
    for (let i = 0; i < count; i++) {
      const y = 15 + i * (height - 30) / (count - 1);
      ports.push({ x: width, y, side: "right", index: i });
    }
    return ports;
  }
  function importSharedToWeb4(shared) {
    const layers = topologicalLayers(shared);
    const layerMap = /* @__PURE__ */ new Map();
    for (let i = 0; i < layers.length; i++) {
      for (const id of layers[i]) {
        layerMap.set(id, i);
      }
    }
    const nodes = [];
    const H_SPACING = 140;
    const V_SPACING = 90;
    const START_X = 60;
    const START_Y = 60;
    const layerCounts = /* @__PURE__ */ new Map();
    for (const [, layer] of layerMap) {
      layerCounts.set(layer, (layerCounts.get(layer) ?? 0) + 1);
    }
    const layerIndexCounters = /* @__PURE__ */ new Map();
    for (const node of shared.nodes) {
      const layer = layerMap.get(node.id) ?? 0;
      const size = GATE_SIZES[node.type] ?? { width: 80, height: 60 };
      const idx = layerIndexCounters.get(layer) ?? 0;
      const totalInLayer = layerCounts.get(layer) ?? 1;
      const x = START_X + layer * H_SPACING;
      const totalHeight = totalInLayer * V_SPACING;
      const y = START_Y + idx * V_SPACING - totalHeight / 2 + 200;
      layerIndexCounters.set(layer, idx + 1);
      nodes.push({
        id: node.id,
        type: node.type,
        x: Math.round(x / GRID_SIZE) * GRID_SIZE,
        y: Math.round(y / GRID_SIZE) * GRID_SIZE,
        width: size.width,
        height: size.height,
        rotation: 0,
        label: node.label || node.type,
        config: node.config,
        inputPorts: getDefaultInputPorts(node.type, size.width, size.height),
        outputPorts: getDefaultOutputPorts(node.type, size.width, size.height)
      });
    }
    const wires = shared.connections.map((conn, i) => ({
      id: `w_${i}`,
      sourceNodeId: conn.sourceId,
      sourcePort: 0,
      // most gates have 1 output
      targetNodeId: conn.targetId,
      targetPort: conn.targetPort,
      points: [],
      // will be computed by the renderer
      value: false
    }));
    return {
      nodes,
      wires,
      inputNodeIds: shared.inputNodeIds,
      outputNodeIds: shared.outputNodeId ? [shared.outputNodeId] : []
    };
  }
  function topologicalLayers(graph) {
    const inDegree = /* @__PURE__ */ new Map();
    const adjacency = /* @__PURE__ */ new Map();
    for (const node of graph.nodes) {
      inDegree.set(node.id, 0);
      adjacency.set(node.id, []);
    }
    for (const conn of graph.connections) {
      adjacency.get(conn.sourceId)?.push(conn.targetId);
      inDegree.set(conn.targetId, (inDegree.get(conn.targetId) ?? 0) + 1);
    }
    const layers = [];
    let queue = [];
    for (const [id, deg] of inDegree) {
      if (deg === 0) queue.push(id);
    }
    while (queue.length > 0) {
      layers.push([...queue]);
      const nextQueue = [];
      for (const id of queue) {
        for (const neighbor of adjacency.get(id) ?? []) {
          const newDeg = (inDegree.get(neighbor) ?? 1) - 1;
          inDegree.set(neighbor, newDeg);
          if (newDeg === 0) nextQueue.push(neighbor);
        }
      }
      queue = nextQueue;
    }
    return layers;
  }
  var WEB1_IMPORT_KEY = "w4_imported_from_web1";
  function web1ToCircuitFile(web1, name) {
    const shared = convertWeb1Circuit(web1);
    const w4 = importSharedToWeb4(shared);
    return {
      id: shared.id,
      name: name || "Imported from Boolean Solver",
      version: 1,
      nodes: w4.nodes,
      wires: w4.wires,
      inputNodeIds: w4.inputNodeIds,
      outputNodeIds: w4.outputNodeIds,
      savedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
  }
  function storeImportedCircuit(circuit) {
    try {
      localStorage.setItem(WEB1_IMPORT_KEY, JSON.stringify(circuit));
    } catch (e) {
      console.error("Failed to store imported circuit:", e);
    }
  }

  // Web1/src/state.ts
  var state = {
    variables: [],
    rows: [],
    graphs: { basic: null, nand: null, nor: null },
    probeState: {},
    kmap: { implicants: null, variables: [] }
  };

  // shared/ts/exporters/verilog.ts
  function toVerilogExpr(node) {
    switch (node.kind) {
      case "var":
        return node.name;
      case "const":
        return node.value ? "1'b1" : "1'b0";
      case "not":
        return `(~${toVerilogOperand(node.child)})`;
      case "and":
        return `(${toVerilogExpr(node.left)} & ${toVerilogExpr(node.right)})`;
      case "or":
        return `(${toVerilogExpr(node.left)} | ${toVerilogExpr(node.right)})`;
      case "xor":
        return `(${toVerilogExpr(node.left)} ^ ${toVerilogExpr(node.right)})`;
    }
  }
  function toVerilogOperand(node) {
    const atom = node.kind === "var" || node.kind === "const";
    return atom ? toVerilogExpr(node) : `(${toVerilogExpr(node)})`;
  }
  function generateVerilogModule(ast, options = {}) {
    const moduleName = options.moduleName ?? "bool_function";
    const outputName = options.outputName ?? "F";
    const inputs = options.inputs ?? [];
    const portList = [
      ...inputs.map((name) => `    input  wire ${name}`),
      `    output wire ${outputName}`
    ].join(",\n");
    return `// Verilog HDL - Boolean Function Synthesis Module
module ${moduleName} (
${portList}
);
    assign ${outputName} = ${toVerilogExpr(ast)};
endmodule`;
  }

  // shared/ts/exporters/c.ts
  function toCExpr(node) {
    switch (node.kind) {
      case "var":
        return node.name;
      case "const":
        return node.value ? "true" : "false";
      case "not": {
        const inner = node.child.kind === "var" || node.child.kind === "const" ? toCExpr(node.child) : `(${toCExpr(node.child)})`;
        return `!${inner}`;
      }
      case "and":
        return `(${toCExpr(node.left)} && ${toCExpr(node.right)})`;
      case "or":
        return `(${toCExpr(node.left)} || ${toCExpr(node.right)})`;
      case "xor":
        return `(${toCExpr(node.left)} != ${toCExpr(node.right)})`;
    }
  }
  function generateCFunction(ast, options = {}) {
    const functionName = options.functionName ?? "evaluate_logic";
    const parameters = options.parameters ?? [];
    const args = parameters.map((v) => `bool ${v}`).join(", ");
    return `// C / C++ Boolean Function (requires <stdbool.h> in C)
// Semantics verified equivalent to the solved truth table.
bool ${functionName}(${args}) {
    return ${toCExpr(ast)};
}`;
  }

  // shared/ts/exporters/latex.ts
  var IDENT_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;
  function latexVar(name) {
    return IDENT_RE.test(name) && name.length > 1 ? `\\mathrm{${name}}` : name;
  }
  function toLatexExpr(node) {
    switch (node.kind) {
      case "var":
        return latexVar(node.name);
      case "const":
        return node.value ? "1" : "0";
      case "not":
        return `\\overline{${toLatexExpr(node.child)}}`;
      case "and":
        return `${toLatexOperand(node.left, node.kind)} \\cdot ${toLatexOperand(node.right, node.kind)}`;
      case "or":
        return `${toLatexOperand(node.left, node.kind)} + ${toLatexOperand(node.right, node.kind)}`;
      case "xor":
        return `${toLatexOperand(node.left, node.kind)} \\oplus ${toLatexOperand(node.right, node.kind)}`;
    }
  }
  function toLatexOperand(node, parentKind) {
    const PREC = { or: 1, xor: 2, and: 3, not: 4, var: 5, const: 5 };
    if (PREC[node.kind] < PREC[parentKind]) {
      return `\\left(${toLatexExpr(node)}\\right)`;
    }
    return toLatexExpr(node);
  }
  function generateLatex(ast, outputName = "F") {
    return `$$${outputName} = ${toLatexExpr(ast)}$$`;
  }

  // Web1/src/circuits/gates.ts
  function getMultiInputY(y, h, i, count) {
    if (count <= 1) return y + h / 2;
    const margin = 10;
    const available = h - 2 * margin;
    const step = available / (count - 1);
    return y + margin + i * step;
  }
  function getGateInfo(node) {
    switch (node.type) {
      case "INPUT":
      case "CONST":
        return {
          width: 90,
          height: 52,
          inX: (x) => x,
          inY: (_, y) => y + 26,
          outX: (x) => x + 90,
          outY: (_, y) => y + 26
        };
      case "NOT":
        return {
          width: 74,
          height: 52,
          inX: (x) => x,
          inY: (_, y) => y + 26,
          outX: (x) => x + 74,
          outY: (_, y) => y + 26
        };
      case "AND":
        return {
          width: 76,
          height: 52,
          inX: (x) => x,
          inY: (_x, y, i, count) => getMultiInputY(y, 52, i, count),
          outX: (x) => x + 76,
          outY: (_, y) => y + 26
        };
      case "NAND":
        return {
          width: 93,
          height: 52,
          inX: (x) => x,
          inY: (_x, y, i, count) => getMultiInputY(y, 52, i, count),
          outX: (x) => x + 93,
          outY: (_, y) => y + 26
        };
      case "OR":
        return {
          width: 86,
          height: 52,
          // OR inputs sit on a curved back edge; pins inset toward the
          // center line proportionally to their vertical offset.
          inX: (x, y, i, count) => {
            const inputY = getMultiInputY(y, 52, i, count);
            const dy = Math.abs(inputY - (y + 26));
            return x + Math.max(0, 18 * (1 - dy / 26));
          },
          inY: (_x, y, i, count) => getMultiInputY(y, 52, i, count),
          outX: (x) => x + 86,
          outY: (_, y) => y + 26
        };
      case "NOR":
        return {
          width: 100,
          height: 52,
          inX: (x, y, i, count) => {
            const inputY = getMultiInputY(y, 52, i, count);
            const dy = Math.abs(inputY - (y + 26));
            return x + Math.max(0, 18 * (1 - dy / 26));
          },
          inY: (_x, y, i, count) => getMultiInputY(y, 52, i, count),
          outX: (x) => x + 100,
          outY: (_, y) => y + 26
        };
    }
  }
  function renderGateSVG(node, pos) {
    const x = pos.x;
    const y = pos.y;
    const centerY = y + 26;
    if (node.type === "INPUT" || node.type === "CONST") {
      const isConst = node.type === "CONST";
      const polarityLabel = isConst ? "" : "H";
      const polarityColor = "#10b981";
      return `
            <g class="circuit-gate-group pin-interactive" data-node-id="${node.id}" data-var="${node.label}">
                <rect x="${x}" y="${y}" width="90" height="52" rx="10" fill="var(--gate-fill)" stroke="var(--gate-stroke)" stroke-width="2" />
                <text x="${x + 45}" y="${centerY + 5}" text-anchor="middle" font-weight="800" font-size="15" fill="var(--text-primary)">${escapeSvgText(node.label)}</text>
                ${polarityLabel ? `<text x="${x + 78}" y="${y + 12}" font-size="10" font-weight="700" fill="${polarityColor}">${polarityLabel}</text>` : ""}
            </g>
        `;
    }
    if (node.type === "NOT") {
      return `
            <g class="circuit-gate-group" data-node-id="${node.id}">
                <polygon points="${x},${y} ${x + 60},${centerY} ${x},${y + 52}" fill="var(--gate-fill)" stroke="var(--gate-stroke)" stroke-width="2.2" />
                <circle cx="${x + 67}" cy="${centerY}" r="7" fill="var(--gate-fill)" stroke="var(--gate-stroke)" stroke-width="2.2" />
                <text x="${x + 20}" y="${centerY + 5}" font-weight="800" font-size="12" fill="var(--text-primary)">NOT</text>
                <text x="${x + 78}" y="${y + 12}" font-size="10" font-weight="700" fill="#f59e0b">L</text>
            </g>
        `;
    }
    if (node.type === "AND") {
      return `
            <g class="circuit-gate-group" data-node-id="${node.id}">
                <path d="M ${x} ${y} h 50 a 26 26 0 0 1 0 52 h -50 z" fill="var(--gate-fill)" stroke="var(--gate-stroke)" stroke-width="2.2" />
                <text x="${x + 34}" y="${centerY + 5}" text-anchor="middle" font-weight="800" font-size="13" fill="var(--text-primary)">AND</text>
            </g>
        `;
    }
    if (node.type === "NAND") {
      return `
            <g class="circuit-gate-group" data-node-id="${node.id}">
                <path d="M ${x} ${y} h 50 a 26 26 0 0 1 0 52 h -50 z" fill="var(--gate-fill)" stroke="var(--gate-stroke)" stroke-width="2.2" />
                <circle cx="${x + 86}" cy="${centerY}" r="7" fill="var(--gate-fill)" stroke="var(--gate-stroke)" stroke-width="2.2" />
                <text x="${x + 34}" y="${centerY + 5}" text-anchor="middle" font-weight="800" font-size="12" fill="var(--text-primary)">NAND</text>
            </g>
        `;
    }
    if (node.type === "OR") {
      return `
            <g class="circuit-gate-group" data-node-id="${node.id}">
                <path d="M ${x} ${y} Q ${x + 18} ${centerY} ${x} ${y + 52} Q ${x + 48} ${y + 52} ${x + 86} ${centerY} Q ${x + 48} ${y} ${x} ${y} Z" fill="var(--gate-fill)" stroke="var(--gate-stroke)" stroke-width="2.2" />
                <text x="${x + 40}" y="${centerY + 5}" text-anchor="middle" font-weight="800" font-size="13" fill="var(--text-primary)">OR</text>
            </g>
        `;
    }
    return `
        <g class="circuit-gate-group" data-node-id="${node.id}">
            <path d="M ${x} ${y} Q ${x + 18} ${centerY} ${x} ${y + 52} Q ${x + 48} ${y + 52} ${x + 86} ${centerY} Q ${x + 48} ${y} ${x} ${y} Z" fill="var(--gate-fill)" stroke="var(--gate-stroke)" stroke-width="2.2" />
            <circle cx="${x + 93}" cy="${centerY}" r="7" fill="var(--gate-fill)" stroke="var(--gate-stroke)" stroke-width="2.2" />
            <text x="${x + 40}" y="${centerY + 5}" text-anchor="middle" font-weight="800" font-size="12" fill="var(--text-primary)">NOR</text>
        </g>
    `;
  }
  function escapeSvgText(text) {
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  // Web1/src/circuits/layout.ts
  function calculateLevels(graph) {
    const levels = /* @__PURE__ */ new Map();
    function getLevel(id) {
      const cached = levels.get(id);
      if (cached !== void 0) return cached;
      const node = graph.nodes.find((n) => n.id === id);
      if (!node) return 0;
      if (node.type === "INPUT" || node.type === "CONST") {
        levels.set(id, 0);
        return 0;
      }
      let maxIn = -1;
      node.inputs.forEach((inId) => {
        maxIn = Math.max(maxIn, getLevel(inId));
      });
      const lvl = maxIn + 1;
      levels.set(id, lvl);
      return lvl;
    }
    graph.nodes.forEach((n) => getLevel(n.id));
    return levels;
  }
  function calculateCircuitLayout(graph) {
    const levels = calculateLevels(graph);
    const nodesByLevel = /* @__PURE__ */ new Map();
    levels.forEach((lvl, id) => {
      if (!nodesByLevel.has(lvl)) nodesByLevel.set(lvl, []);
      const node = graph.nodes.find((n) => n.id === id);
      if (node) nodesByLevel.get(lvl).push(node);
    });
    const levelGap = 200;
    const paddingX = 40;
    const paddingY = 40;
    const gateHeight = 52;
    const nodeGapY = 32;
    const positions = /* @__PURE__ */ new Map();
    let maxTotalHeight = 0;
    const sortedLevels = [...nodesByLevel.keys()].sort((a, b) => a - b);
    sortedLevels.forEach((lvl) => {
      const list = nodesByLevel.get(lvl);
      const totalHeight = list.length * gateHeight + (list.length - 1) * nodeGapY;
      maxTotalHeight = Math.max(maxTotalHeight, totalHeight);
    });
    const circuitHeight = Math.max(260, maxTotalHeight + 2 * paddingY);
    sortedLevels.forEach((lvl) => {
      const list = nodesByLevel.get(lvl);
      const totalH = list.length * gateHeight + (list.length - 1) * nodeGapY;
      const startY = (circuitHeight - totalH) / 2;
      const x = paddingX + lvl * levelGap;
      list.forEach((node, idx) => {
        positions.set(node.id, { x, y: startY + idx * (gateHeight + nodeGapY), level: lvl });
      });
    });
    const maxLevel = Math.max(0, ...sortedLevels);
    const lastLevelNodes = nodesByLevel.get(maxLevel) || [];
    const maxNodeWidth = lastLevelNodes.reduce((m, n) => Math.max(m, getGateInfo(n).width), 90);
    const circuitWidth = paddingX + maxLevel * levelGap + maxNodeWidth + 120;
    return { positions, levels, width: circuitWidth, height: circuitHeight, levelGap, paddingX, paddingY };
  }

  // Web1/src/circuits/renderer.ts
  function formatHopPathH(x1, x2, y, crossXs) {
    const minX = Math.min(x1, x2);
    const maxX = Math.max(x1, x2);
    const isLtoR = x1 <= x2;
    const valid = crossXs.filter((cx) => cx > minX + 8 && cx < maxX - 8).sort((a, b) => isLtoR ? a - b : b - a);
    if (valid.length === 0) {
      return `M ${x1} ${y} H ${x2}`;
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
    return d;
  }
  function renderEdgesSVG(graph, layout) {
    let svg = "";
    const { positions, levels } = layout;
    const edges = [];
    graph.nodes.forEach((targetNode) => {
      const seen = /* @__PURE__ */ new Map();
      targetNode.inputs.forEach((sourceId, inputIndex) => {
        if (!seen.has(sourceId)) seen.set(sourceId, []);
        seen.get(sourceId).push(inputIndex);
      });
      seen.forEach((indices, sourceId) => {
        const sourceNode = graph.nodes.find((n) => n.id === sourceId);
        const sourcePos = positions.get(sourceId);
        const targetPos = positions.get(targetNode.id);
        if (!sourceNode || !sourcePos || !targetPos) return;
        const sourceInfo = getGateInfo(sourceNode);
        const targetInfo = getGateInfo(targetNode);
        const x1 = sourceInfo.outX(sourcePos.x);
        const y1 = sourceInfo.outY(sourcePos.x, sourcePos.y);
        let sumY2 = 0;
        let sumX2 = 0;
        indices.forEach((i) => {
          sumX2 += targetInfo.inX(targetPos.x, targetPos.y, i, targetNode.inputs.length);
          sumY2 += targetInfo.inY(targetPos.x, targetPos.y, i, targetNode.inputs.length);
        });
        edges.push({
          sourceId,
          targetId: targetNode.id,
          x1,
          y1,
          x2: sumX2 / indices.length,
          y2: sumY2 / indices.length,
          sourceLevel: levels.get(sourceId),
          targetLevel: levels.get(targetNode.id)
        });
      });
    });
    const gapGroups = /* @__PURE__ */ new Map();
    edges.forEach((edge) => {
      const key = `${edge.sourceLevel}->${edge.targetLevel}`;
      if (!gapGroups.has(key)) gapGroups.set(key, []);
      gapGroups.get(key).push(edge);
    });
    gapGroups.forEach((groupEdges) => {
      const sourceMap = /* @__PURE__ */ new Map();
      groupEdges.forEach((edge) => {
        if (!sourceMap.has(edge.sourceId)) sourceMap.set(edge.sourceId, []);
        sourceMap.get(edge.sourceId).push(edge);
      });
      const sources = Array.from(sourceMap.entries()).map(([id, sEdges]) => ({
        id,
        edges: sEdges,
        x1: sEdges[0].x1,
        y1: sEdges[0].y1
      }));
      sources.sort((a, b) => a.y1 - b.y1);
      const maxSourceX = Math.max(...sources.map((s) => s.x1));
      const minTargetX = Math.min(...sources.flatMap((s) => s.edges.map((e) => e.x2)));
      let gapStart = maxSourceX + 16;
      let gapEnd = minTargetX - 16;
      if (gapEnd - gapStart < 35) {
        const mid = (maxSourceX + minTargetX) / 2;
        gapStart = mid - 22;
        gapEnd = mid + 22;
      }
      const available = Math.max(35, gapEnd - gapStart);
      const effectiveStep = available / (sources.length + 1);
      const vBuses = [];
      sources.forEach((source, idx) => {
        const { y1, edges: sEdges } = source;
        const flatSingle = sEdges.length === 1 && Math.abs(y1 - sEdges[0].y2) < 1.5;
        if (!flatSingle) {
          const allY = [y1, ...sEdges.map((e) => e.y2)];
          vBuses.push({
            busX: gapStart + (idx + 1) * effectiveStep,
            minY: Math.min(...allY),
            maxY: Math.max(...allY),
            sourceId: source.id
          });
        }
      });
      sources.forEach((source, idx) => {
        const busEntry = vBuses.find((v) => v.sourceId === source.id);
        const busX = busEntry ? busEntry.busX : gapStart + (idx + 1) * effectiveStep;
        const { id: srcId, x1, y1, edges: sEdges } = source;
        const getCrossings = (hX1, hX2, hY) => vBuses.filter((v) => v.sourceId !== srcId && v.busX > Math.min(hX1, hX2) + 6 && v.busX < Math.max(hX1, hX2) - 6 && v.minY <= hY && hY <= v.maxY).map((v) => v.busX);
        if (sEdges.length === 1) {
          const { x2, y2 } = sEdges[0];
          if (Math.abs(y1 - y2) < 1.5) {
            const d = formatHopPathH(x1, x2, y1, getCrossings(x1, x2, y1));
            svg += wirePath(d, srcId);
          } else {
            const d1 = formatHopPathH(x1, busX, y1, getCrossings(x1, busX, y1));
            const d3 = formatHopPathH(busX, x2, y2, getCrossings(busX, x2, y2));
            svg += wirePath(`${d1} V ${y2} ${d3.replace(`M ${busX} ${y2}`, "")}`, srcId);
          }
        } else {
          const allY = [y1, ...sEdges.map((e) => e.y2)];
          const minY = Math.min(...allY);
          const maxY = Math.max(...allY);
          svg += wirePath(formatHopPathH(x1, busX, y1, getCrossings(x1, busX, y1)), srcId);
          svg += wirePath(`M ${busX} ${minY} V ${maxY}`, srcId);
          svg += `<circle cx="${busX}" cy="${y1}" r="3.8" class="circuit-junction" data-source-id="${srcId}" fill="var(--wire-low)" />`;
          sEdges.forEach((edge) => {
            svg += wirePath(formatHopPathH(busX, edge.x2, edge.y2, getCrossings(busX, edge.x2, edge.y2)), srcId);
            if (Math.abs(edge.y2 - y1) > 1) {
              svg += `<circle cx="${busX}" cy="${edge.y2}" r="3.8" class="circuit-junction" data-source-id="${srcId}" fill="var(--wire-low)" />`;
            }
          });
        }
      });
    });
    return svg;
  }
  function wirePath(d, sourceId) {
    return `<path d="${d}" class="circuit-wire" data-source-id="${sourceId}" stroke="var(--wire-low)" stroke-width="2.2" fill="none" />`;
  }
  function renderCircuit(graph, container, options = {}) {
    container.innerHTML = "";
    if (!graph || !graph.output) return;
    const layout = calculateCircuitLayout(graph);
    let svg = `
        <svg class="circuit-svg" xmlns="http://www.w3.org/2000/svg"
             width="${layout.width}" height="${layout.height}"
             viewBox="0 0 ${layout.width} ${layout.height}">
    `;
    svg += renderEdgesSVG(graph, layout);
    graph.nodes.forEach((node) => {
      svg += renderGateSVG(node, layout.positions.get(node.id));
    });
    const outputNode = graph.nodes.find((node) => node.id === graph.output);
    const outputPos = layout.positions.get(graph.output);
    const outputInfo = getGateInfo(outputNode);
    const outX = outputInfo.outX(outputPos.x);
    const outY = outputInfo.outY(outputPos.x, outputPos.y);
    svg += `
        <path d="M ${outX} ${outY} H ${outX + 60}" class="circuit-wire output-wire" data-source-id="${graph.output}" stroke="var(--wire-low)" stroke-width="2" fill="none" />
        <g class="output-label-group">
            <circle cx="${outX + 65}" cy="${outY}" r="15" fill="var(--bg-card-alt)" stroke="var(--border-color)" stroke-width="2" />
            <text x="${outX + 65}" y="${outY + 5}" text-anchor="middle" font-weight="800" font-size="13" fill="var(--text-primary)" class="output-indicator-text">F</text>
        </g>
    `;
    svg += "</svg>";
    container.innerHTML = svg;
    container.querySelectorAll(".pin-interactive").forEach((group) => {
      group.addEventListener("click", () => {
        const varName = group.getAttribute("data-var");
        if (varName && options.onPinToggle) options.onPinToggle(varName);
      });
    });
  }

  // Web1/src/kmap/kmap.ts
  function grayCode(n) {
    const result = [];
    const total = 1 << n;
    for (let i = 0; i < total; i++) {
      result.push(i ^ i >> 1);
    }
    return result;
  }
  function patternToMinterms(pattern) {
    const dashPositions = [];
    for (let i = 0; i < pattern.length; i++) {
      if (pattern[i] === "-") dashPositions.push(i);
    }
    const total = 1 << dashPositions.length;
    const result = [];
    for (let mask = 0; mask < total; mask++) {
      let minterm = 0;
      for (let i = 0; i < pattern.length; i++) {
        if (pattern[i] === "1") {
          minterm |= 1 << pattern.length - 1 - i;
        } else if (pattern[i] === "-") {
          const dashPos = dashPositions.indexOf(i);
          if (mask & 1 << dashPos) {
            minterm |= 1 << pattern.length - 1 - i;
          }
        }
      }
      result.push(minterm);
    }
    return result;
  }
  function computeKMapGrid(variableCount) {
    if (variableCount < 2 || variableCount > 4) return null;
    let colBits;
    let rowBits;
    if (variableCount === 2) {
      rowBits = 1;
      colBits = 1;
    } else if (variableCount === 3) {
      rowBits = 1;
      colBits = 2;
    } else {
      rowBits = 2;
      colBits = 2;
    }
    const colGray = grayCode(colBits);
    const rowGray = grayCode(rowBits);
    const grid = [];
    for (let ri = 0; ri < rowGray.length; ri++) {
      grid[ri] = [];
      for (let ci = 0; ci < colGray.length; ci++) {
        let minterm = 0;
        for (let b = 0; b < rowBits; b++) {
          if (rowGray[ri] & 1 << rowBits - 1 - b) {
            minterm |= 1 << variableCount - 1 - b;
          }
        }
        for (let b = 0; b < colBits; b++) {
          if (colGray[ci] & 1 << colBits - 1 - b) {
            minterm |= 1 << variableCount - 1 - rowBits - b;
          }
        }
        grid[ri][ci] = minterm;
      }
    }
    return { grid, rowCount: rowGray.length, colCount: colGray.length };
  }
  var BORDER_COLORS = ["#ef4444", "#2563eb", "#16a34a", "#ea580c", "#9333ea"];
  function kmapBorderColor(index) {
    return BORDER_COLORS[index % BORDER_COLORS.length];
  }
  function labelJoin(names) {
    return names.every((n) => n.length === 1) ? names.join("") : names.join(", ");
  }
  function generateKarnaughMap(args) {
    const { variables, rows, dontCares, implicants } = args;
    const info = computeKMapGrid(variables.length);
    if (!info) {
      return `<div class="help-text" style="text-align:center;">Karnaugh maps are displayed for 2 to 4 variables.</div>`;
    }
    const { grid, rowCount, colCount } = info;
    const rowLabels = grayCode(Math.log2(rowCount)).map((v) => v.toString(2).padStart(Math.log2(rowCount), "0"));
    const colLabels = grayCode(Math.log2(colCount)).map((v) => v.toString(2).padStart(Math.log2(colCount), "0"));
    const rowBits = Math.log2(rowCount);
    const colBits = Math.log2(colCount);
    const rowVarStr = labelJoin(variables.slice(0, rowBits));
    const colVarStr = labelJoin(variables.slice(rowBits));
    const legendHTML = implicants && implicants.length > 0 ? `<div class="karnaugh-map-legend">
            ${implicants.map((imp, i) => `
                <span class="legend-item">
                    <span class="legend-swatch" style="border-color:${kmapBorderColor(i)};background:${kmapBorderColor(i)}20"></span>
                    ${termToString(imp.pattern, variables)}
                </span>`).join("")}
        </div>` : "";
    let html = `<div class="karnaugh-map-wrapper">`;
    html += `<div id="karnaughMapGrid" style="position:relative;display:inline-block;">`;
    html += `<table class="karnaugh-map">`;
    html += `<thead><tr><th style="font-size:14px;">${rowVarStr}\\${colVarStr}</th>`;
    for (const label of colLabels) html += `<th>${label}</th>`;
    html += `</tr></thead><tbody>`;
    for (let ri = 0; ri < rowCount; ri++) {
      html += `<tr><th>${rowLabels[ri]}</th>`;
      for (let ci = 0; ci < colCount; ci++) {
        const minterm = grid[ri][ci];
        const output = rows[minterm]?.output;
        let cellClass = "km-zero";
        let cellValue = "0";
        if (dontCares?.has(minterm)) {
          cellClass = "km-dontcare";
          cellValue = "X";
        } else if (output === 1) {
          cellClass = "km-one";
          cellValue = "1";
        } else if (output === -1) {
          cellClass = "km-dontcare";
          cellValue = "X";
        }
        html += `<td class="${cellClass}" data-row="${ri}" data-col="${ci}">
                <span class="km-minterm">m${minterm}</span>
                <span class="km-value">${cellValue}</span>
            </td>`;
      }
      html += `</tr>`;
    }
    html += `</tbody></table></div>`;
    if (legendHTML) html += legendHTML;
    html += `</div>`;
    return html;
  }

  // Web1/src/kmap/overlays.ts
  function contiguousRuns(indices) {
    const sorted = [...new Set(indices)].sort((a, b) => a - b);
    if (sorted.length === 0) return [];
    const runs = [[sorted[0]]];
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] === sorted[i - 1] + 1) {
        runs[runs.length - 1].push(sorted[i]);
      } else {
        runs.push([sorted[i]]);
      }
    }
    return runs;
  }
  function segmentsForImplicant(implicant, cellCoords) {
    const minterms = new Set(patternToMinterms(implicant.pattern));
    const rows = [];
    const cols = [];
    cellCoords.forEach((coord, minterm) => {
      if (minterms.has(minterm)) {
        rows.push(coord.r);
        cols.push(coord.c);
      }
    });
    if (rows.length === 0) return [];
    const rowRuns = contiguousRuns(rows);
    const colRuns = contiguousRuns(cols);
    const segments = [];
    for (const rr of rowRuns) {
      for (const cr of colRuns) {
        segments.push({
          minRow: rr[0],
          maxRow: rr[rr.length - 1],
          minCol: cr[0],
          maxCol: cr[cr.length - 1]
        });
      }
    }
    return segments;
  }
  function positionKarnaughOverlays(args) {
    const { implicants, gridHost } = args;
    if (!gridHost) return;
    gridHost.querySelectorAll(".km-group-overlay").forEach((el2) => el2.remove());
    const grid = gridHost.querySelector("#karnaughMapGrid");
    const table = grid?.querySelector(".karnaugh-map");
    if (!grid || !table || implicants.length === 0) return;
    const cellCoords = /* @__PURE__ */ new Map();
    table.querySelectorAll("td[data-row]").forEach((cell) => {
      const r = parseInt(cell.getAttribute("data-row") ?? "-1", 10);
      const c = parseInt(cell.getAttribute("data-col") ?? "-1", 10);
      const m = parseInt((cell.querySelector(".km-minterm")?.textContent ?? "").replace("m", ""), 10);
      if (!isNaN(r) && !isNaN(c) && !isNaN(m)) cellCoords.set(m, { r, c });
    });
    const gridRect = grid.getBoundingClientRect();
    const padding = 4;
    implicants.forEach((imp, i) => {
      const colorClass = `km-group-${i % 5 + 1}`;
      const borderColor = kmapBorderColor(i);
      const segments = segmentsForImplicant(imp, cellCoords);
      const memberMinterms = new Set(patternToMinterms(imp.pattern));
      for (const seg of segments) {
        let minLeft = Infinity, minTop = Infinity, maxRight = -Infinity, maxBottom = -Infinity;
        let found = false;
        cellCoords.forEach((coord, minterm) => {
          if (!memberMinterms.has(minterm)) return;
          if (coord.r < seg.minRow || coord.r > seg.maxRow) return;
          if (coord.c < seg.minCol || coord.c > seg.maxCol) return;
          const cell = table.querySelector(
            `td[data-row="${coord.r}"][data-col="${coord.c}"]`
          );
          if (!cell) return;
          const rect = cell.getBoundingClientRect();
          minLeft = Math.min(minLeft, rect.left);
          minTop = Math.min(minTop, rect.top);
          maxRight = Math.max(maxRight, rect.right);
          maxBottom = Math.max(maxBottom, rect.bottom);
          found = true;
        });
        if (!found) continue;
        const div = document.createElement("div");
        div.className = `km-group-overlay ${colorClass}`;
        div.style.display = "block";
        div.style.left = `${minLeft - gridRect.left - padding}px`;
        div.style.top = `${minTop - gridRect.top - padding}px`;
        div.style.width = `${maxRight - minLeft + 2 * padding}px`;
        div.style.height = `${maxBottom - minTop + 2 * padding}px`;
        div.style.borderColor = borderColor;
        grid.appendChild(div);
      }
    });
  }

  // Web1/src/ui/probe.ts
  function setupProbePanels(variables, callbacks = {}) {
    state.probeState = {};
    variables.forEach((v) => {
      state.probeState[v] = false;
    });
    ["probeSwitchesBasic", "probeSwitchesNand", "probeSwitchesNor"].forEach((panelId) => {
      const panel = byId(panelId);
      panel.innerHTML = variables.map((v) => {
        const safe = escapeHtml(v);
        return `
            <div class="probe-switch" data-var="${safe}" role="button" tabindex="0" aria-label="Toggle ${safe}">
                <span>${safe}</span>
                <span class="probe-val-badge">0</span>
            </div>
        `;
      }).join("");
      panel.querySelectorAll(".probe-switch").forEach((btn) => {
        btn.addEventListener("click", () => {
          const varName = btn.getAttribute("data-var");
          if (varName) toggleProbe(varName, callbacks);
        });
      });
    });
    updateProbeUI();
    updateCircuitSignals();
  }
  function toggleProbe(varName, callbacks = {}) {
    if (!Object.prototype.hasOwnProperty.call(state.probeState, varName)) return;
    state.probeState[varName] = !state.probeState[varName];
    callbacks.onSound?.(state.probeState[varName]);
    updateProbeUI();
    updateCircuitSignals();
  }
  function updateProbeUI() {
    document.querySelectorAll(".probe-switch").forEach((btn) => {
      const varName = btn.getAttribute("data-var");
      if (varName && Object.prototype.hasOwnProperty.call(state.probeState, varName)) {
        const isHigh = state.probeState[varName];
        btn.classList.toggle("active", isHigh);
        const badge = btn.querySelector(".probe-val-badge");
        if (badge) badge.textContent = isHigh ? "1" : "0";
      }
    });
    document.querySelectorAll(".pin-interactive").forEach((nodeEl) => {
      const varName = nodeEl.getAttribute("data-var");
      if (varName && Object.prototype.hasOwnProperty.call(state.probeState, varName)) {
        const isHigh = state.probeState[varName];
        const textEl = nodeEl.querySelector("text");
        const rectEl = nodeEl.querySelector("rect");
        if (textEl) textEl.textContent = `${varName} = ${isHigh ? "1" : "0"}`;
        if (rectEl) {
          rectEl.setAttribute("stroke", isHigh ? "var(--wire-high)" : "var(--gate-stroke)");
          rectEl.setAttribute("stroke-width", isHigh ? "2.5" : "2");
        }
      }
    });
    if (state.variables.length > 0 && state.rows.length > 0) {
      const rowIdx = state.variables.reduce((acc, v, idx) => {
        return acc | (state.probeState[v] ? 1 : 0) << state.variables.length - 1 - idx;
      }, 0);
      document.querySelectorAll("#generatedTruthTable tr").forEach((tr, i) => {
        if (i > 0) tr.classList.toggle("active-row", i - 1 === rowIdx);
      });
      const hudVector = byId("hudVector");
      hudVector.textContent = state.variables.map((v) => `${v}=${state.probeState[v] ? 1 : 0}`).join(", ");
    }
  }
  function updateCircuitSignals() {
    const pairs = [
      [state.graphs.basic, "basicCircuit"],
      [state.graphs.nand, "nandCircuit"],
      [state.graphs.nor, "norCircuit"]
    ];
    for (const [graph, containerId] of pairs) {
      if (!graph) continue;
      updateGraphWires(graph, containerId);
    }
  }
  function updateGraphWires(graph, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const values = evaluateAllNodeValues(graph, state.probeState);
    values.forEach((isHigh, nodeId) => {
      container.querySelectorAll(`[data-source-id="${nodeId}"]`).forEach((el2) => {
        if (el2.tagName.toLowerCase() === "path") {
          el2.classList.toggle("wire-active", isHigh);
          el2.classList.toggle("wire-inactive", !isHigh);
        } else if (el2.tagName.toLowerCase() === "circle") {
          el2.setAttribute("fill", isHigh ? "var(--wire-high)" : "var(--wire-low)");
        }
      });
    });
    const finalVal = values.get(graph.output);
    if (finalVal !== void 0) {
      const ind = container.querySelector(".output-indicator-text");
      if (ind) ind.textContent = `F = ${finalVal ? "1" : "0"}`;
      if (containerId === "basicCircuit") {
        const hudOutput = byId("hudOutput");
        hudOutput.textContent = `${finalVal ? "1" : "0"} (${finalVal ? "5.0 V" : "0.0 V"})`;
        hudOutput.style.color = finalVal ? "#10b981" : "var(--text-muted)";
      }
    }
  }

  // Web1/src/ui/waveform.ts
  var state2 = {
    variables: [],
    expression: null,
    stepCount: 16,
    patterns: {},
    outputPattern: [],
    delayedOutputPattern: [],
    currentStep: 0,
    isPlaying: false,
    speed: 500,
    timer: null,
    zoomLevel: 1,
    gateDelayNs: 0,
    logicDepth: 1
  };
  function initWaveformPlayground(variables, expression, logicDepth = 1) {
    state2.variables = variables;
    state2.expression = expression;
    state2.stepCount = 16;
    state2.currentStep = 0;
    state2.isPlaying = false;
    state2.patterns = {};
    state2.logicDepth = logicDepth;
    state2.gateDelayNs = 0;
    variables.forEach((v, idx) => {
      const pattern = [];
      const period = 1 << variables.length - 1 - idx;
      for (let step = 0; step < state2.stepCount; step++) {
        pattern.push((step / period | 0) % 2 === 1);
      }
      state2.patterns[v] = pattern;
    });
    computeOutput();
    renderGridEditor();
    drawWaveform();
    updateControls();
    const section = byId("openInPlaygroundSection");
    if (section) section.style.display = "";
  }
  function resetWaveform() {
    if (state2.timer) clearInterval(state2.timer);
    state2.timer = null;
    state2.isPlaying = false;
    state2.variables = [];
    state2.expression = null;
    state2.patterns = {};
    state2.outputPattern = [];
    state2.currentStep = 0;
  }
  function computeOutput() {
    if (!state2.expression || state2.variables.length === 0) return;
    state2.outputPattern = [];
    for (let step = 0; step < state2.stepCount; step++) {
      const assignment = {};
      state2.variables.forEach((v) => {
        assignment[v] = state2.patterns[v]?.[step] ?? false;
      });
      state2.outputPattern.push(evalAst(state2.expression, assignment));
    }
    computeDelayedOutput();
  }
  function computeDelayedOutput() {
    if (state2.gateDelayNs === 0 || state2.outputPattern.length === 0) {
      state2.delayedOutputPattern = [...state2.outputPattern];
      return;
    }
    const totalDelayNs = state2.gateDelayNs * state2.logicDepth;
    const delaySteps = Math.round(totalDelayNs / 50);
    const n = state2.outputPattern.length;
    state2.delayedOutputPattern = [];
    for (let step = 0; step < n; step++) {
      const srcStep = step - delaySteps;
      if (srcStep < 0) {
        state2.delayedOutputPattern.push(false);
      } else {
        state2.delayedOutputPattern.push(state2.outputPattern[srcStep]);
      }
    }
  }
  function renderGridEditor() {
    const container = byId("waveformInputRows");
    if (!container) return;
    let html = "";
    state2.variables.forEach((v) => {
      html += `<div class="waveform-input-row">`;
      html += `<span class="waveform-input-label">${v}</span>`;
      html += `<div class="waveform-input-cells">`;
      for (let step = 0; step < state2.stepCount; step++) {
        const val = state2.patterns[v]?.[step] ?? false;
        const cls = val ? "waveform-cell waveform-cell-high" : "waveform-cell waveform-cell-low";
        const currentCls = step === state2.currentStep ? " current-step" : "";
        html += `<div class="${cls}${currentCls}" data-var="${v}" data-step="${step}" role="button" tabindex="0" aria-label="${v} step ${step}: ${val ? "1" : "0"}">${val ? "1" : "0"}</div>`;
      }
      html += `</div></div>`;
    });
    html += `<div class="waveform-input-row">`;
    html += `<span class="waveform-input-label" style="color:var(--accent-secondary);">F</span>`;
    html += `<div class="waveform-input-cells">`;
    for (let step = 0; step < state2.stepCount; step++) {
      const val = state2.outputPattern[step] ?? false;
      const cls = val ? "waveform-cell waveform-cell-high" : "waveform-cell waveform-cell-output";
      const currentCls = step === state2.currentStep ? " current-step" : "";
      html += `<div class="${cls}${currentCls}">${val ? "1" : "0"}</div>`;
    }
    html += `</div></div>`;
    if (state2.gateDelayNs > 0) {
      html += `<div class="waveform-input-row">`;
      html += `<span class="waveform-input-label" style="color:#f59e0b;">F<sub>d</sub></span>`;
      html += `<div class="waveform-input-cells">`;
      for (let step = 0; step < state2.stepCount; step++) {
        const val = state2.delayedOutputPattern[step] ?? false;
        const cls = val ? "waveform-cell waveform-cell-high" : "waveform-cell waveform-cell-delayed";
        const currentCls = step === state2.currentStep ? " current-step" : "";
        html += `<div class="${cls}${currentCls}" title="Delayed output (t-${Math.round(state2.gateDelayNs * state2.logicDepth / 50)} steps)">${val ? "1" : "0"}</div>`;
      }
      html += `</div></div>`;
    }
    container.innerHTML = html;
    container.querySelectorAll("[data-var]").forEach((cell) => {
      cell.addEventListener("click", () => {
        const v = cell.getAttribute("data-var");
        const step = parseInt(cell.getAttribute("data-step"));
        if (!state2.patterns[v]) state2.patterns[v] = [];
        state2.patterns[v][step] = !state2.patterns[v][step];
        computeOutput();
        renderGridEditor();
        drawWaveform();
      });
      cell.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          cell.click();
        }
      });
    });
  }
  function drawWaveform() {
    const canvas = byId("waveformCanvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const wrapper = canvas.parentElement;
    if (wrapper) {
      canvas.width = wrapper.clientWidth - 2;
    }
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    if (state2.variables.length === 0) return;
    const startX = 50;
    const graphWidth = w - startX - 20;
    const stepX = graphWidth / Math.max(1, state2.stepCount - 1) * state2.zoomLevel;
    ctx.strokeStyle = "rgba(255,255,255,0.04)";
    ctx.lineWidth = 1;
    for (let i = 0; i < state2.stepCount; i++) {
      const x = startX + i * stepX;
      ctx.beginPath();
      ctx.moveTo(x, 5);
      ctx.lineTo(x, h - 5);
      ctx.stroke();
    }
    const curX = startX + state2.currentStep * stepX;
    ctx.strokeStyle = "rgba(56, 189, 248, 0.3)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(curX, 5);
    ctx.lineTo(curX, h - 5);
    ctx.stroke();
    const allSignals = [];
    state2.variables.forEach((v) => {
      allSignals.push({ name: v, pattern: state2.patterns[v] || [], color: "#38bdf8", dashed: false });
    });
    allSignals.push({ name: "F", pattern: state2.outputPattern, color: "#10b981", dashed: false });
    if (state2.gateDelayNs > 0) {
      allSignals.push({ name: "F(dly)", pattern: state2.delayedOutputPattern, color: "#f59e0b", dashed: true });
    }
    const rowHeight = Math.min(28, Math.floor((h - 10) / allSignals.length));
    allSignals.forEach((signal, idx) => {
      const { name, pattern, color, dashed } = signal;
      const topY = 10 + idx * rowHeight;
      const lowY = topY + rowHeight - 5;
      const highY = topY + 5;
      ctx.font = "bold 11px 'JetBrains Mono', monospace";
      ctx.fillStyle = color;
      ctx.textAlign = "right";
      ctx.fillText(name, startX - 8, (highY + lowY) / 2 + 4);
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      if (dashed) ctx.setLineDash([6, 4]);
      else ctx.setLineDash([]);
      ctx.beginPath();
      for (let step = 0; step < state2.stepCount; step++) {
        const x = startX + step * stepX;
        const val = pattern[step];
        const y = val ? highY : lowY;
        if (step === 0) {
          ctx.moveTo(x, y);
        } else {
          const prevVal = pattern[step - 1];
          const prevY = prevVal ? highY : lowY;
          if (prevY !== y) {
            ctx.lineTo(x, prevY);
            ctx.lineTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
      }
      ctx.stroke();
      ctx.setLineDash([]);
    });
    byId("waveformTimeDisplay").textContent = String(state2.currentStep);
    byId("waveformPeriodDisplay").textContent = String(state2.stepCount);
  }
  function updateControls() {
    const playBtn = byId("waveformPlayBtn");
    const pauseBtn = byId("waveformPauseBtn");
    if (playBtn) playBtn.classList.toggle("active", !state2.isPlaying);
    if (pauseBtn) pauseBtn.classList.toggle("active", state2.isPlaying);
  }
  function stepForward() {
    state2.currentStep = (state2.currentStep + 1) % state2.stepCount;
    renderGridEditor();
    drawWaveform();
  }
  function stepBackward() {
    state2.currentStep = (state2.currentStep - 1 + state2.stepCount) % state2.stepCount;
    renderGridEditor();
    drawWaveform();
  }
  function startPlay() {
    if (state2.isPlaying) return;
    state2.isPlaying = true;
    state2.timer = setInterval(() => {
      stepForward();
      updateControls();
    }, state2.speed);
    updateControls();
  }
  function pausePlay() {
    if (!state2.isPlaying) return;
    state2.isPlaying = false;
    if (state2.timer) clearInterval(state2.timer);
    state2.timer = null;
    updateControls();
  }
  function stopPlay() {
    pausePlay();
    state2.currentStep = 0;
    renderGridEditor();
    drawWaveform();
  }
  function setupWaveformControls() {
    byId("waveformPlayBtn")?.addEventListener("click", startPlay);
    byId("waveformPauseBtn")?.addEventListener("click", pausePlay);
    byId("waveformStopBtn")?.addEventListener("click", stopPlay);
    byId("waveformStepFwdBtn")?.addEventListener("click", stepForward);
    byId("waveformStepBackBtn")?.addEventListener("click", stepBackward);
    const speedSlider = byId("waveformSpeed");
    const speedLabel = byId("waveformSpeedLabel");
    if (speedSlider) {
      speedSlider.addEventListener("input", () => {
        state2.speed = Number(speedSlider.value);
        if (speedLabel) speedLabel.textContent = `${state2.speed}ms`;
        if (state2.isPlaying) {
          pausePlay();
          startPlay();
        }
      });
    }
    byId("waveformZoomIn")?.addEventListener("click", () => {
      state2.zoomLevel = Math.min(3, state2.zoomLevel + 0.5);
      drawWaveform();
    });
    byId("waveformZoomOut")?.addEventListener("click", () => {
      state2.zoomLevel = Math.max(0.5, state2.zoomLevel - 0.5);
      drawWaveform();
    });
    const delaySlider = byId("waveformDelay");
    const delayLabel = byId("waveformDelayLabel");
    if (delaySlider) {
      delaySlider.addEventListener("input", () => {
        state2.gateDelayNs = Number(delaySlider.value);
        if (delayLabel) {
          delayLabel.textContent = state2.gateDelayNs === 0 ? "0 ns (ideal)" : `${state2.gateDelayNs} ns \xD7 ${state2.logicDepth} gates = ${state2.gateDelayNs * state2.logicDepth} ns`;
        }
        computeOutput();
        renderGridEditor();
        drawWaveform();
      });
    }
    const stepsSelect = byId("waveformSteps");
    if (stepsSelect) {
      stepsSelect.addEventListener("change", () => {
        const newCount = Number(stepsSelect.value);
        if (newCount !== state2.stepCount && state2.variables.length > 0) {
          state2.stepCount = newCount;
          state2.currentStep = 0;
          state2.variables.forEach((v, idx) => {
            const pattern = [];
            const period = 1 << state2.variables.length - 1 - idx;
            for (let step = 0; step < state2.stepCount; step++) {
              pattern.push((step / period | 0) % 2 === 1);
            }
            state2.patterns[v] = pattern;
          });
          computeOutput();
          renderGridEditor();
          drawWaveform();
          updateControls();
          const periodDisplay = byId("waveformPeriodDisplay");
          if (periodDisplay) periodDisplay.textContent = String(state2.stepCount);
        }
      });
    }
    window.addEventListener("resize", () => drawWaveform());
  }

  // Web1/src/ui/results.ts
  function copyToClipboard(text, btn, onSound) {
    onSound?.(true);
    navigator.clipboard.writeText(text).then(() => {
      const prev = btn.textContent;
      btn.textContent = "\u2705 Copied!";
      btn.classList.add("copied");
      setTimeout(() => {
        btn.textContent = prev;
        btn.classList.remove("copied");
      }, 1600);
    });
  }
  function createTruthTableHTML(variables, rows, dontCareIndices) {
    let html = `<table class="truth-table"><thead><tr>`;
    variables.forEach((v) => {
      html += `<th>${escapeHtml(v)}</th>`;
    });
    html += `<th>F</th></tr></thead><tbody>`;
    rows.forEach((row, index) => {
      html += `<tr>`;
      row.inputs.forEach((val) => {
        html += `<td>${val}</td>`;
      });
      let outCell;
      if (dontCareIndices?.has(index)) {
        outCell = `<span class="tt-dontcare">X</span>`;
      } else if (row.output === 1) {
        outCell = `<span class="tt-one">1</span>`;
      } else {
        outCell = `<span class="tt-zero">0</span>`;
      }
      html += `<td>${outCell}</td></tr>`;
    });
    html += `</tbody></table>`;
    return html;
  }
  function generateMarkdownTable(variables, rows) {
    let md = "| " + variables.join(" | ") + " | F |\n";
    md += "| " + variables.map(() => "---").join(" | ") + " | --- |\n";
    rows.forEach((r) => {
      const outStr = r.output === 1 ? "1" : r.output === 0 ? "0" : "X";
      md += "| " + r.inputs.join(" | ") + " | " + outStr + " |\n";
    });
    return md;
  }
  var errorTimeout = null;
  function showError(message) {
    if (errorTimeout) clearTimeout(errorTimeout);
    const box = byId("errorMessage");
    box.textContent = message;
    box.classList.remove("hidden");
    errorTimeout = setTimeout(() => box.classList.add("hidden"), 6e3);
  }
  function clearError() {
    const box = byId("errorMessage");
    box.textContent = "";
    box.classList.add("hidden");
  }
  function setWordProblemStatus(message, isError = false) {
    const statusEl = byId("wordProblemStatus");
    statusEl.textContent = message;
    statusEl.classList.remove("hidden");
    statusEl.classList.toggle("status-error", isError);
  }
  function clearWordProblemStatus() {
    const statusEl = byId("wordProblemStatus");
    statusEl.textContent = "";
    statusEl.classList.add("hidden");
    statusEl.classList.remove("status-error");
  }
  function showWordProblemLegend(variables, descriptions) {
    const legend = byId("wordProblemLegend");
    if (!descriptions || Object.keys(descriptions).length === 0) {
      legend.classList.add("hidden");
      legend.replaceChildren();
      return;
    }
    legend.replaceChildren();
    variables.forEach((name, i) => {
      if (i > 0) legend.appendChild(el("br"));
      legend.appendChild(el("strong", void 0, name));
      legend.appendChild(document.createTextNode(` = ${descriptions[name] ?? "(no description)"}`));
    });
    legend.classList.remove("hidden");
  }
  function renderVerification(passed, variableCount, onSound) {
    const frag = document.createDocumentFragment();
    if (passed) {
      onSound?.();
      const ok = el("div", "verification-success");
      ok.appendChild(el("strong", void 0, "\u2705 All Implementations Verified Successfully"));
      ok.appendChild(el("br"));
      ok.appendChild(el("br"));
      ok.appendChild(document.createTextNode(
        `The original Boolean function, simplified expression, AND/OR/NOT circuit, NAND-only circuit, and NOR-only circuit produce 100% identical outputs for all ${2 ** variableCount} possible input combinations.`
      ));
      frag.appendChild(ok);
    } else {
      const bad = el("div", "verification-failure");
      bad.appendChild(el("strong", void 0, "\u274C Verification Issue Detected"));
      bad.appendChild(el("br"));
      bad.appendChild(el("br"));
      bad.appendChild(document.createTextNode(
        "One or more circuit implementations does not match the expected Boolean truth table."
      ));
      frag.appendChild(bad);
    }
    return frag;
  }
  function clearResults() {
    resetWaveform();
    byId("results").classList.add("hidden");
    maybeById("dontCareResults")?.classList.add("hidden");
    const statusEl = maybeById("wordProblemStatus");
    if (statusEl) {
      statusEl.textContent = "";
      statusEl.classList.add("hidden");
      statusEl.classList.remove("status-error");
    }
    const legend = maybeById("wordProblemLegend");
    if (legend) {
      legend.textContent = "";
      legend.classList.add("hidden");
    }
    byId("originalExpression").textContent = "";
    byId("generatedTruthTable").innerHTML = "";
    byId("canonicalSOP").textContent = "";
    byId("canonicalPOS").textContent = "";
    byId("simplifiedExpression").textContent = "";
    byId("simplifiedPOS").textContent = "";
    byId("minimizationSteps").innerHTML = "";
    byId("karnaughMap").innerHTML = "";
    byId("basicCircuit").innerHTML = "";
    byId("nandCircuit").innerHTML = "";
    byId("norCircuit").innerHTML = "";
    byId("circuitComparison").innerHTML = "";
    byId("verification").innerHTML = "";
  }
  function renderResults(model, callbacks = {}) {
    state.variables = model.variables;
    state.rows = model.rows;
    byId("originalExpression").textContent = model.originalDisplay;
    byId("generatedTruthTable").innerHTML = createTruthTableHTML(model.variables, model.rows, model.hasDontCares ? model.dontCares : void 0);
    byId("canonicalSOP").textContent = model.canonicalSOP;
    byId("canonicalPOS").textContent = model.canonicalPOS;
    byId("simplifiedExpression").textContent = model.simplifiedDisplay;
    byId("simplifiedPOS").textContent = posDisplay(model.pos, model.variables);
    byId("hudTermCount").textContent = `${model.sop.implicants.length} Implicants`;
    renderMinimizationSteps(model);
    if (model.simplifiedCoverTruncated) {
      byId("simplifiedExpression").appendChild(
        el("div", "help-text", "(very large function: greedy grouping used)")
      );
    }
    byId("karnaughMap").innerHTML = generateKarnaughMap({
      variables: model.variables,
      rows: model.rows,
      dontCares: model.hasDontCares ? model.dontCares : void 0,
      implicants: model.sop.implicants
    });
    state.kmap = { implicants: model.sop.implicants, variables: model.variables };
    requestAnimationFrame(() => positionKarnaughOverlays({
      implicants: model.sop.implicants,
      gridHost: byId("karnaughMap")
    }));
    const dontCareResults = maybeById("dontCareResults");
    if (model.hasDontCares && dontCareResults) {
      dontCareResults.classList.remove("hidden");
      byId("dontCareSummary").replaceChildren(buildDontCareSummary(model));
    } else if (dontCareResults) {
      dontCareResults.classList.add("hidden");
    }
    setupExportButtons(model, callbacks);
    resetCircuitIds();
    state.graphs.basic = buildBasicSOPCircuit(model.sop.implicants, model.variables);
    state.graphs.nand = buildNANDCircuit(model.sop.implicants, model.variables);
    state.graphs.nor = buildNORCircuit(model.pos.implicants, model.variables);
    const onPinToggle = (varName) => toggleProbe(varName, { onSound: callbacks.onClickSound });
    renderCircuit(state.graphs.basic, byId("basicCircuit"), { onPinToggle });
    renderCircuit(state.graphs.nand, byId("nandCircuit"), { onPinToggle });
    renderCircuit(state.graphs.nor, byId("norCircuit"), { onPinToggle });
    renderComparisonTable(state.graphs);
    setupProbePanels(model.variables, { onSound: callbacks.onClickSound });
    const verified = verifySolution(model, state.graphs);
    byId("verification").replaceChildren(
      renderVerification(verified, model.variables.length, callbacks.onSound)
    );
    const basicStats = computeCircuitStats(state.graphs.basic);
    initWaveformPlayground(model.variables, model.simplifiedAst, basicStats.logicDepth);
    const resultsSection = byId("results");
    resultsSection.classList.remove("hidden");
    resultsSection.scrollIntoView({ behavior: "smooth" });
  }
  function buildDontCareSummary(model) {
    const frag = document.createDocumentFragment();
    const wrap = el("div");
    wrap.style.cssText = "font-size:14px;line-height:1.7;";
    const line1 = el("div");
    line1.appendChild(document.createTextNode("Minterms (F = 1): "));
    line1.appendChild(el("strong", void 0, `{${[...model.ones].sort((a, b) => a - b).join(", ") || "none"}}`));
    const line2 = el("div");
    line2.appendChild(document.createTextNode("Don't Cares (F = X): "));
    const dcSpan = el("span", void 0, `{${[...model.dontCares].sort((a, b) => a - b).join(", ") || "none"}}`);
    dcSpan.style.cssText = "color:#f59e0b;font-weight:700;";
    line2.appendChild(dcSpan);
    const line3 = el("div");
    line3.appendChild(document.createTextNode(
      `Total terms used in minimization: ${model.ones.length + model.dontCares.size}`
    ));
    wrap.append(line1, line2, line3);
    frag.appendChild(wrap);
    return frag;
  }
  function renderMinimizationSteps(model) {
    const container = byId("minimizationSteps");
    if (!container) return;
    const steps = getMinimizationSteps(model.ones, model.variables, model.hasDontCares ? model.dontCares : void 0, "SOP");
    let html = `<ol class="minimization-steps-list">`;
    steps.forEach((step) => {
      html += `<li class="minimization-step">`;
      html += `<div class="step-title">${escapeHtml(step.title)}</div>`;
      html += `<pre class="step-detail">${escapeHtml(step.detail)}</pre>`;
      html += `</li>`;
    });
    html += `</ol>`;
    container.innerHTML = html;
  }
  function renderComparisonTable(circuits) {
    const container = byId("circuitComparison");
    if (!container) return;
    const statsBasic = computeCircuitStats(circuits.basic);
    const statsNand = computeCircuitStats(circuits.nand);
    const statsNor = computeCircuitStats(circuits.nor);
    function gateBreakdownStr(stats) {
      return Object.entries(stats.gateBreakdown).map(([type, count]) => `${count}\xD7 ${type}`).join(", ") || "\u2014";
    }
    let html = `<table class="truth-table comparison-table">
        <thead>
            <tr>
                <th>Metric</th>
                <th>AND/OR/NOT</th>
                <th>NAND-Only</th>
                <th>NOR-Only</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td><strong>Gate Count</strong></td>
                <td>${statsBasic.gateCount}</td>
                <td>${statsNand.gateCount}</td>
                <td>${statsNor.gateCount}</td>
            </tr>
            <tr>
                <td><strong>Logic Depth</strong></td>
                <td>${statsBasic.logicDepth}</td>
                <td>${statsNand.logicDepth}</td>
                <td>${statsNor.logicDepth}</td>
            </tr>
            <tr>
                <td><strong>Total Gate-Inputs</strong></td>
                <td>${statsBasic.totalGateInputs}</td>
                <td>${statsNand.totalGateInputs}</td>
                <td>${statsNor.totalGateInputs}</td>
            </tr>
            <tr>
                <td><strong>Gate Breakdown</strong></td>
                <td>${gateBreakdownStr(statsBasic)}</td>
                <td>${gateBreakdownStr(statsNand)}</td>
                <td>${gateBreakdownStr(statsNor)}</td>
            </tr>
        </tbody>
    </table>`;
    container.innerHTML = html;
  }
  function setupExportButtons(model, callbacks) {
    const verilog = generateVerilogModule(model.simplifiedAst, {
      inputs: model.variables
    });
    const cCode = generateCFunction(model.simplifiedAst, {
      parameters: model.variables
    });
    const latex = generateLatex(model.simplifiedAst);
    const mdTable = generateMarkdownTable(model.variables, model.rows);
    const previews = [
      ["verilogPreview", verilog],
      ["codePreview", cCode],
      ["latexPreview", latex]
    ];
    previews.forEach(([id, content]) => {
      const pre = maybeById(id);
      if (pre) pre.textContent = content;
    });
    const buttons = [
      ["copyVerilogBtn", verilog],
      ["copyCodeBtn", cCode],
      ["copyLatexBtn", latex],
      ["copyMarkdownTableBtn", mdTable]
    ];
    buttons.forEach(([id, payload]) => {
      const btn = maybeById(id);
      if (btn) btn.onclick = () => copyToClipboard(payload, btn, callbacks.onClickSound);
    });
    document.querySelectorAll(".copy-btn").forEach((button) => {
      button.onclick = () => {
        const row = button.closest(".expression-row");
        const box = row?.querySelector(".expression-box");
        const text = box?.textContent?.trim();
        if (text) copyToClipboard(text, button, callbacks.onClickSound);
      };
    });
  }

  // Web1/src/ui/truthTableInput.ts
  function generateTruthTableInput(variableCount) {
    const host = byId("userTruthTable");
    const variables = generateVariableNames(variableCount);
    const combinations = generateCombinations(variableCount);
    let html = `<table class="truth-table"><thead><tr>`;
    variables.forEach((v) => {
      html += `<th>${escapeHtml(v)}</th>`;
    });
    html += `<th>Output (F)</th></tr></thead><tbody>`;
    combinations.forEach((inputs, index) => {
      html += `<tr>`;
      inputs.forEach((v) => {
        html += `<td>${v}</td>`;
      });
      html += `<td>
            <select class="tt-input-select" data-row="${index}" aria-label="Output for row ${index}">
                <option value="0">0</option>
                <option value="1">1</option>
                <option value="X">X (Don't Care)</option>
            </select>
        </td></tr>`;
    });
    html += `</tbody></table>`;
    host.innerHTML = html;
  }
  function readTruthTableSelections() {
    const host = byId("userTruthTable");
    return Array.from(host.querySelectorAll(".tt-input-select")).map((sel) => sel.value);
  }
  function parsePastedTruthTable(text) {
    const lines = text.trim().split("\n").map((l) => l.trim()).filter((l) => l.length > 0);
    if (lines.length === 0) return "No data to parse.";
    let startIdx = 0;
    const firstLine = lines[0];
    const hasHeader = /[A-Za-z]/.test(firstLine) && !/[01Xx]/.test(firstLine.replace(/[A-Za-z]/g, ""));
    if (hasHeader) startIdx = 1;
    function parseLine(line) {
      if (line.includes(",")) return line.split(",").map((s) => s.trim());
      if (line.includes("	")) return line.split("	").map((s) => s.trim());
      return line.split(/\s+/).map((s) => s.trim());
    }
    const dataLines = lines.slice(startIdx);
    if (dataLines.length === 0) return "No data rows found after header.";
    const firstDataFields = parseLine(dataLines[0]);
    const numCols = firstDataFields.length;
    const numVars = numCols - 1;
    if (numVars < 1 || numVars > 6) {
      return `Detected ${numVars} variable(s). Supported range: 1-6. Each row must have ${numVars + 1} columns (inputs + output).`;
    }
    const expectedRows = 1 << numVars;
    if (dataLines.length !== expectedRows) {
      return `Expected exactly ${expectedRows} rows for ${numVars} variable(s), but found ${dataLines.length}. Each unique input combination must appear exactly once.`;
    }
    const validOutput = /^[01Xx\-]$/;
    for (let i = 0; i < dataLines.length; i++) {
      const fields = parseLine(dataLines[i]);
      const outputVal = fields[fields.length - 1];
      if (!validOutput.test(outputVal)) {
        return `Row ${i + 1 + startIdx}: invalid output value "${outputVal}". Expected 0, 1, X, or -.`;
      }
      if (fields.length !== numCols) {
        return `Row ${i + 1 + startIdx}: expected ${numCols} columns but found ${fields.length}.`;
      }
    }
    const varSelect = byId("truthVariables");
    varSelect.value = String(numVars);
    generateTruthTableInput(numVars);
    const host = byId("userTruthTable");
    const selects = Array.from(host.querySelectorAll(".tt-input-select"));
    dataLines.forEach((line, idx) => {
      const fields = parseLine(line);
      const outputVal = fields[fields.length - 1].toUpperCase();
      if (idx < selects.length) {
        if (outputVal === "1") selects[idx].value = "1";
        else if (outputVal === "0") selects[idx].value = "0";
        else if (outputVal === "X" || outputVal === "-") selects[idx].value = "X";
      }
    });
    return null;
  }
  function initTruthTableIO() {
    const parseBtn = byId("parseTruthTablePasteBtn");
    if (parseBtn) {
      parseBtn.addEventListener("click", () => {
        const textarea = byId("truthTablePaste");
        if (textarea && textarea.value.trim()) {
          const error = parsePastedTruthTable(textarea.value);
          if (error) {
            const statusEl = byId("truthTablePasteStatus");
            if (statusEl) {
              statusEl.textContent = error;
              statusEl.className = "help-text status-error";
              statusEl.classList.remove("hidden");
              setTimeout(() => statusEl.classList.add("hidden"), 6e3);
            }
          }
        }
      });
    }
    const fileInput = byId("truthTableFileInput");
    if (fileInput) {
      fileInput.addEventListener("change", () => {
        const file = fileInput.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
          const text = reader.result;
          const textarea = byId("truthTablePaste");
          if (textarea) textarea.value = text;
          parsePastedTruthTable(text);
        };
        reader.readAsText(file);
      });
    }
  }

  // Web1/src/ui/controls.ts
  var zoomStates = {
    basicCircuit: freshZoom(),
    nandCircuit: freshZoom(),
    norCircuit: freshZoom()
  };
  function freshZoom() {
    return { scale: 1, panX: 0, panY: 0, isDragging: false, startX: 0, startY: 0 };
  }
  function applyZoomPan(containerId) {
    const container = document.getElementById(containerId);
    const svg = container?.querySelector("svg");
    if (!svg) return;
    const s = zoomStates[containerId];
    svg.style.transform = `translate(${s.panX}px, ${s.panY}px) scale(${s.scale})`;
  }
  function resetZoomPan(containerId) {
    zoomStates[containerId] = freshZoom();
    applyZoomPan(containerId);
  }
  function initZoomPanControls(onSound) {
    document.querySelectorAll(".zoom-in-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const target = btn.getAttribute("data-target");
        if (target && zoomStates[target]) {
          zoomStates[target].scale = Math.min(3, zoomStates[target].scale + 0.2);
          applyZoomPan(target);
          onSound?.(true);
        }
      });
    });
    document.querySelectorAll(".zoom-out-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const target = btn.getAttribute("data-target");
        if (target && zoomStates[target]) {
          zoomStates[target].scale = Math.max(0.4, zoomStates[target].scale - 0.2);
          applyZoomPan(target);
          onSound?.(false);
        }
      });
    });
    document.querySelectorAll(".zoom-reset-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const target = btn.getAttribute("data-target");
        if (target) resetZoomPan(target);
      });
    });
    ["basicCircuit", "nandCircuit", "norCircuit"].forEach((id) => {
      const container = document.getElementById(id);
      if (!container) return;
      container.addEventListener("wheel", (e) => {
        e.preventDefault();
        const delta = e.deltaY < 0 ? 0.1 : -0.1;
        zoomStates[id].scale = Math.min(3, Math.max(0.4, zoomStates[id].scale + delta));
        applyZoomPan(id);
      }, { passive: false });
      container.addEventListener("mousedown", (e) => {
        if (e.button !== 0) return;
        zoomStates[id].isDragging = true;
        zoomStates[id].startX = e.clientX - zoomStates[id].panX;
        zoomStates[id].startY = e.clientY - zoomStates[id].panY;
        container.style.cursor = "grabbing";
      });
      window.addEventListener("mousemove", (e) => {
        if (!zoomStates[id].isDragging) return;
        zoomStates[id].panX = e.clientX - zoomStates[id].startX;
        zoomStates[id].panY = e.clientY - zoomStates[id].startY;
        applyZoomPan(id);
      });
      window.addEventListener("mouseup", () => {
        if (zoomStates[id]) {
          zoomStates[id].isDragging = false;
          container.style.cursor = "grab";
        }
      });
    });
  }
  function updateNumericExamples() {
    const mintermVariables = byId("mintermVariables");
    const maxtermVariables = byId("maxtermVariables");
    const minCount = Number(mintermVariables.value);
    byId("mintermExample").innerHTML = `Valid minterms: <strong>0 to ${(1 << minCount) - 1}</strong> (e.g. 1, 3, 5)`;
    const maxCount = Number(maxtermVariables.value);
    byId("maxtermExample").innerHTML = `Valid maxterms: <strong>0 to ${(1 << maxCount) - 1}</strong> (e.g. 0, 2, 4)`;
    updateDontCareExamples();
  }
  function updateDontCareExamples() {
    const count = Number(byId("dontCareVariables").value);
    byId("dontCareExample").innerHTML = `Valid terms: <strong>0 to ${(1 << count) - 1}</strong> (e.g. Minterms: 1,3,7 &nbsp; Don't Cares: 0,5)`;
  }
  function updateInputInterface() {
    const type = byId("inputType").value;
    const sections = {
      expression: "expressionSection",
      minterms: "mintermSection",
      maxterms: "maxtermSection",
      dontCare: "dontCareSection",
      truthTable: "truthTableSection",
      wordProblem: "wordProblemSection",
      kmapInput: "kmapInputSection",
      timingImage: "timingImageSection",
      circuitImage: "circuitImageSection"
    };
    Object.entries(sections).forEach(([mode, id]) => {
      document.getElementById(id)?.classList.toggle("hidden", mode !== type);
    });
    clearResults();
  }
  var EXAMPLE_PRESETS = [
    { expression: "A'B + B\xB7C", description: "3-variable SOP" },
    { expression: "A\xB7B + A'C", description: "3-variable multiplex" },
    { expression: "(A+B)(A'+C)", description: "3-variable POS" },
    { expression: "A\xB7B\xB7C + A'B'C'", description: "Minterms 0 and 7" },
    { expression: "A\xB7B + A\xB7C + B\xB7C", description: "Majority function" },
    { expression: "A^B", description: "XOR 2-var" },
    { expression: "A'B'C + A'BC' + AB'C' + A\xB7B\xB7C", description: "Full Adder Sum" }
  ];
  var WORD_PROBLEM_PRESETS = [
    { problem: "A laboratory door opens when the identity card and PIN are both valid, or when emergency mode is active and either the PIN is correct or faculty authorization is present.", description: "Lab door access" },
    { problem: "A warning light turns on when the engine is overheating, or when the oil pressure is low and the ignition is on.", description: "Engine warning light" },
    { problem: "A student passes the course if they attend at least 75% of the classes and pass the final exam, or if they have special approval from the dean.", description: "Course pass condition" },
    { problem: "A smart irrigation system waters the garden if the soil is dry and it is not raining, or if the manual override switch is turned on.", description: "Smart irrigation" },
    { problem: "An alarm sounds if a window is open and the security system is armed, or if the smoke detector is triggered regardless of the armed state.", description: "Home alarm system" }
  ];
  var exampleIndex = 0;
  var wordProblemExampleIndex = 0;
  var kmapGridValues = /* @__PURE__ */ new Map();
  function grayCode2(n) {
    const result = [];
    const total = 1 << n;
    for (let i = 0; i < total; i++) {
      result.push(i ^ i >> 1);
    }
    return result;
  }
  function generateKmapInputGrid(variableCount) {
    const host = byId("kmapInputGrid");
    if (!host) return;
    kmapGridValues.clear();
    let colBits, rowBits;
    if (variableCount === 2) {
      rowBits = 1;
      colBits = 1;
    } else if (variableCount === 3) {
      rowBits = 1;
      colBits = 2;
    } else {
      rowBits = 2;
      colBits = 2;
    }
    const colGray = grayCode2(colBits);
    const rowGray = grayCode2(rowBits);
    const colLabels = colGray.map((v) => v.toString(2).padStart(colBits, "0"));
    const rowLabels = rowGray.map((v) => v.toString(2).padStart(rowBits, "0"));
    function cellMinterm(ri, ci) {
      let minterm = 0;
      for (let b = 0; b < rowBits; b++) {
        if (rowGray[ri] & 1 << rowBits - 1 - b) {
          minterm |= 1 << variableCount - 1 - b;
        }
      }
      for (let b = 0; b < colBits; b++) {
        if (colGray[ci] & 1 << colBits - 1 - b) {
          minterm |= 1 << variableCount - 1 - rowBits - b;
        }
      }
      return minterm;
    }
    let html = `<table class="karnaugh-map kmap-input-table">`;
    const variables = Array.from({ length: variableCount }, (_, i) => String.fromCharCode(65 + i));
    const rowVarStr = variables.slice(0, rowBits).join("");
    const colVarStr = variables.slice(rowBits).join("");
    html += `<thead><tr><th>${rowVarStr}\\${colVarStr}</th>`;
    for (const label of colLabels) html += `<th>${label}</th>`;
    html += `</tr></thead><tbody>`;
    for (let ri = 0; ri < rowGray.length; ri++) {
      html += `<tr><th>${rowLabels[ri]}</th>`;
      for (let ci = 0; ci < colGray.length; ci++) {
        const minterm = cellMinterm(ri, ci);
        kmapGridValues.set(`m${minterm}`, "0");
        html += `<td class="kmap-input-cell km-zero" data-minterm="${minterm}" role="button" tabindex="0" aria-label="minterm ${minterm}: 0">`;
        html += `<span class="km-minterm">m${minterm}</span>`;
        html += `<span class="km-value">0</span>`;
        html += `</td>`;
      }
      html += `</tr>`;
    }
    html += `</tbody></table>`;
    host.innerHTML = html;
    host.querySelectorAll(".kmap-input-cell").forEach((cell) => {
      const toggle = () => {
        const key = `m${cell.getAttribute("data-minterm")}`;
        const current = kmapGridValues.get(key) || "0";
        const next = current === "0" ? "1" : current === "1" ? "X" : "0";
        kmapGridValues.set(key, next);
        cell.className = `kmap-input-cell ${next === "1" ? "km-one" : next === "X" ? "km-dontcare" : "km-zero"}`;
        cell.querySelector(".km-value").textContent = next;
        cell.setAttribute("aria-label", `minterm ${cell.getAttribute("data-minterm")}: ${next}`);
      };
      cell.addEventListener("click", toggle);
      cell.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          toggle();
        }
      });
    });
  }
  function readKmapInput() {
    const minterms = [];
    const dontCares = [];
    kmapGridValues.forEach((val, key) => {
      const m = parseInt(key.replace("m", ""));
      if (val === "1") minterms.push(m);
      else if (val === "X") dontCares.push(m);
    });
    return { minterms: minterms.sort((a, b) => a - b), dontCares: dontCares.sort((a, b) => a - b) };
  }
  function initInputControls(onSound) {
    const inputType = byId("inputType");
    const mintermVariables = byId("mintermVariables");
    const maxtermVariables = byId("maxtermVariables");
    const dontCareVariables = byId("dontCareVariables");
    const truthVariables = byId("truthVariables");
    const expressionInput = byId("expression");
    const problemStatementInput = byId("problemStatement");
    inputType.addEventListener("change", () => {
      updateInputInterface();
      onSound?.(true);
    });
    mintermVariables.addEventListener("change", updateNumericExamples);
    maxtermVariables.addEventListener("change", updateNumericExamples);
    dontCareVariables.addEventListener("change", updateDontCareExamples);
    truthVariables.addEventListener("change", () => generateTruthTableInput(Number(truthVariables.value)));
    const kmapInputVariables = byId("kmapInputVariables");
    if (kmapInputVariables) {
      kmapInputVariables.addEventListener("change", () => {
        generateKmapInputGrid(Number(kmapInputVariables.value));
      });
      generateKmapInputGrid(Number(kmapInputVariables.value));
    }
    const tryExampleBtn = byId("tryExampleBtn");
    tryExampleBtn.addEventListener("click", () => {
      onSound?.(true);
      inputType.value = "expression";
      updateInputInterface();
      const preset = EXAMPLE_PRESETS[exampleIndex % EXAMPLE_PRESETS.length];
      expressionInput.value = preset.expression;
      expressionInput.focus();
      tryExampleBtn.textContent = preset.description;
      exampleIndex++;
    });
    const tryWordBtn = byId("tryWordProblemExampleBtn");
    tryWordBtn.addEventListener("click", () => {
      onSound?.(true);
      const preset = WORD_PROBLEM_PRESETS[wordProblemExampleIndex % WORD_PROBLEM_PRESETS.length];
      problemStatementInput.value = preset.problem;
      problemStatementInput.focus();
      tryWordBtn.textContent = preset.description;
      wordProblemExampleIndex++;
    });
  }

  // Web1/src/main.ts
  function sound(isHigh) {
    if (window.StudioFX) window.StudioFX.click(isHigh);
  }
  function collectRawInputs() {
    const mode = byId("inputType").value;
    switch (mode) {
      case "expression":
        return { mode, expression: byId("expression").value };
      case "minterms":
        return {
          mode,
          mintermCount: Number(byId("mintermVariables").value),
          mintermList: parseNumberList(byId("minterms").value)
        };
      case "maxterms":
        return {
          mode,
          maxtermCount: Number(byId("maxtermVariables").value),
          maxtermList: parseNumberList(byId("maxterms").value)
        };
      case "dontCare":
        return {
          mode,
          dontCareCount: Number(byId("dontCareVariables").value),
          dontCareMintermList: parseNumberList(byId("dontCareMinterms").value),
          dontCareList: parseNumberList(byId("dontCares").value)
        };
      case "truthTable":
        return { mode, truthSelections: readTruthTableSelections() };
      case "wordProblem":
        return { mode };
      case "timingImage":
        return { mode };
      case "kmapInput": {
        const { minterms, dontCares } = readKmapInput();
        const varCount = Number(byId("kmapInputVariables").value);
        if (minterms.length === 0 && dontCares.length === 0) {
          throw new SolverInputError("The Karnaugh map is empty. Click cells to set output values.");
        }
        return {
          mode: "dontCare",
          dontCareCount: varCount,
          dontCareMintermList: minterms,
          dontCareList: dontCares
        };
      }
      case "circuitImage":
        return { mode };
      default:
        throw new SolverInputError(`Unknown input mode: ${mode}`);
    }
  }
  var activeAiRequest = null;
  async function runWordProblem() {
    const statement = byId("problemStatement").value.trim();
    if (!statement) throw new SolverInputError("Please describe the boolean logic problem.");
    activeAiRequest?.abort();
    const controller = new AbortController();
    activeAiRequest = controller;
    clearWordProblemStatus();
    setWordProblemStatus("Asking the AI backend to work out the minterms...");
    byId("solveButton").disabled = true;
    try {
      const parsed = await fetchMintermsFromProblem(statement, { signal: controller.signal });
      showWordProblemLegend(parsed.variables, parsed.variableDescriptions);
      return {
        variables: parsed.variables,
        minterms: parsed.minterms,
        dontCares: parsed.dontCares
      };
    } catch (err) {
      if (controller.signal.aborted && !activeAiRequest?.signal.aborted) {
        throw new SolverInputError("__superseded__");
      }
      if (err instanceof Error && err.name === "AbortError") {
        setWordProblemStatus("Request cancelled.", true);
        throw new SolverInputError("__cancelled__");
      }
      const message = err instanceof Error ? err.message : String(err);
      setWordProblemStatus(`Couldn't solve that problem: ${message}`, true);
      throw new SolverInputError(
        "AI conversion failed - see the message above the results for details."
      );
    } finally {
      if (activeAiRequest === controller) activeAiRequest = null;
      byId("solveButton").disabled = false;
    }
  }
  async function solve() {
    clearError();
    try {
      let raw = collectRawInputs();
      if (raw.mode === "wordProblem") {
        const wp = await runWordProblem();
        if (!wp) return;
        raw = { ...raw, wordProblem: wp };
      }
      if (raw.mode === "circuitImage") {
        const ci = await runCircuitImage();
        if (!ci) return;
        raw = { ...raw, circuitImage: ci };
      }
      if (raw.mode === "timingImage") {
        const ti = await runTimingImage();
        if (!ti) return;
        raw = { mode: "expression", expression: ti.expression };
      }
      const model = buildSolverModel(raw);
      renderResults(model, { onSound: () => window.StudioFX?.success(), onClickSound: sound });
    } catch (error) {
      if (error instanceof Error && /__(superseded|cancelled)__/.test(error.message)) return;
      console.error(error);
      const errMsg = error instanceof SolverInputError || error instanceof Error ? error.message : String(error);
      showError(errMsg);
    }
  }
  var circuitImageDataUrl = null;
  async function runCircuitImage() {
    if (!circuitImageDataUrl) throw new SolverInputError("Please upload a circuit image first.");
    activeAiRequest?.abort();
    const controller = new AbortController();
    activeAiRequest = controller;
    const statusEl = byId("circuitImageStatus");
    statusEl.textContent = "Analyzing circuit image...";
    statusEl.className = "help-text circuit-image-status status-loading";
    statusEl.classList.remove("hidden");
    byId("solveButton").disabled = true;
    try {
      const result = await analyzeCircuitImage(circuitImageDataUrl, { signal: controller.signal });
      if (!result.variables || result.variables.length === 0) {
        statusEl.textContent = "The circuit image could not be interpreted confidently. Please try a clearer image.";
        statusEl.className = "help-text circuit-image-status status-error";
        throw new SolverInputError("Could not interpret the circuit image.");
      }
      if (result.confidence !== void 0 && result.confidence < 0.5) {
        statusEl.textContent = `Low confidence (${Math.round(result.confidence * 100)}%). Results may be inaccurate.`;
        statusEl.className = "help-text circuit-image-status status-loading";
      } else {
        statusEl.textContent = "Circuit analysis complete!";
        statusEl.className = "help-text circuit-image-status status-success";
      }
      return {
        variables: result.variables,
        minterms: result.minterms,
        dontCares: result.dontCares,
        expression: result.expression
      };
    } catch (err) {
      if (controller.signal.aborted && !activeAiRequest?.signal.aborted) {
        throw new SolverInputError("__superseded__");
      }
      if (err instanceof Error && err.name === "AbortError") {
        statusEl.textContent = "Request cancelled.";
        statusEl.className = "help-text circuit-image-status status-error";
        throw new SolverInputError("__cancelled__");
      }
      const message = err instanceof Error ? err.message : String(err);
      statusEl.textContent = `Analysis failed: ${message}`;
      statusEl.className = "help-text circuit-image-status status-error";
      throw new SolverInputError("Circuit image analysis failed.");
    } finally {
      if (activeAiRequest === controller) activeAiRequest = null;
      byId("solveButton").disabled = false;
    }
  }
  var timingImageDataUrl = null;
  async function runTimingImage() {
    if (!timingImageDataUrl) throw new SolverInputError("Please upload a timing diagram image first.");
    activeAiRequest?.abort();
    const controller = new AbortController();
    activeAiRequest = controller;
    const statusEl = byId("timingImageStatus");
    statusEl.textContent = "Analyzing timing diagram...";
    statusEl.className = "help-text circuit-image-status status-loading";
    statusEl.classList.remove("hidden");
    byId("solveButton").disabled = true;
    try {
      const result = await analyzeTimingDiagram(timingImageDataUrl, { signal: controller.signal });
      if (!result.signals || result.signals.length === 0) {
        statusEl.textContent = "The timing diagram could not be interpreted. Please try a clearer image.";
        statusEl.className = "help-text circuit-image-status status-error";
        throw new SolverInputError("Could not interpret the timing diagram.");
      }
      statusEl.textContent = `Extracted ${result.signals.length} signals over ${result.time_steps} time steps.`;
      statusEl.className = "help-text circuit-image-status status-success";
      const inputSignals = result.signals.filter((s) => !s.is_output);
      const outputSignals = result.signals.filter((s) => s.is_output);
      if (inputSignals.length === 0 || outputSignals.length === 0) {
        throw new SolverInputError("Could not identify both input and output signals in the timing diagram.");
      }
      const variables = inputSignals.map((s) => s.name);
      const outputSignal = outputSignals[0];
      const minterms = [];
      const timeSteps = Math.min(
        ...inputSignals.map((s) => s.values.length),
        outputSignal.values.length
      );
      for (let t = 0; t < timeSteps; t++) {
        if (outputSignal.values[t] === 1) {
          let minterm = 0;
          variables.forEach((v, idx) => {
            const sig = inputSignals.find((s) => s.name === v);
            if (sig && sig.values[t] === 1) {
              minterm |= 1 << variables.length - 1 - idx;
            }
          });
          minterms.push(minterm);
        }
      }
      const uniqueMinterms = [...new Set(minterms)].sort((a, b) => a - b);
      if (uniqueMinterms.length === 0) {
        return { expression: "0" };
      }
      if (uniqueMinterms.length === 1 << variables.length) {
        return { expression: "1" };
      }
      const terms = uniqueMinterms.map((m) => {
        return variables.map((v, idx) => {
          const bit = m >> variables.length - 1 - idx & 1;
          return bit ? v : `${v}'`;
        }).join("");
      });
      return { expression: terms.join(" + ") };
    } catch (err) {
      if (controller.signal.aborted && !activeAiRequest?.signal.aborted) {
        throw new SolverInputError("__superseded__");
      }
      if (err instanceof Error && err.name === "AbortError") {
        statusEl.textContent = "Request cancelled.";
        statusEl.className = "help-text circuit-image-status status-error";
        throw new SolverInputError("__cancelled__");
      }
      const message = err instanceof Error ? err.message : String(err);
      statusEl.textContent = `Analysis failed: ${message}`;
      statusEl.className = "help-text circuit-image-status status-error";
      throw new SolverInputError("Timing diagram analysis failed.");
    } finally {
      if (activeAiRequest === controller) activeAiRequest = null;
      byId("solveButton").disabled = false;
    }
  }
  function initTimingImageUpload() {
    const dropZone = byId("timingImageDropZone");
    const fileInput = byId("timingImageInput");
    const placeholder = byId("timingImagePlaceholder");
    const preview = byId("timingImagePreview");
    const img = byId("timingImageImg");
    const status = byId("timingImageStatus");
    const replaceBtn = byId("timingImageReplaceBtn");
    const removeBtn = byId("timingImageRemoveBtn");
    async function handleFile(file) {
      if (!file.type.match(/^image\/(png|jpeg|webp)$/)) {
        status.textContent = "Unsupported format. Please use PNG, JPEG, or WebP.";
        status.className = "help-text circuit-image-status status-error";
        status.classList.remove("hidden");
        return;
      }
      try {
        status.textContent = "Processing image...";
        status.className = "help-text circuit-image-status status-loading";
        status.classList.remove("hidden");
        timingImageDataUrl = await preprocessImage(file);
        img.src = timingImageDataUrl;
        placeholder.classList.add("hidden");
        preview.classList.remove("hidden");
        status.textContent = "Image ready. Click Solve to analyze.";
        status.className = "help-text circuit-image-status status-success";
      } catch (e) {
        status.textContent = "Failed to process image.";
        status.className = "help-text circuit-image-status status-error";
        timingImageDataUrl = null;
      }
    }
    dropZone.addEventListener("dragover", (e) => {
      e.preventDefault();
      dropZone.classList.add("drag-over");
    });
    dropZone.addEventListener("dragleave", () => dropZone.classList.remove("drag-over"));
    dropZone.addEventListener("drop", (e) => {
      e.preventDefault();
      dropZone.classList.remove("drag-over");
      const file = e.dataTransfer?.files[0];
      if (file) handleFile(file);
    });
    fileInput.addEventListener("change", () => {
      const file = fileInput.files?.[0];
      if (file) handleFile(file);
    });
    replaceBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      fileInput.click();
    });
    removeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      timingImageDataUrl = null;
      img.src = "";
      placeholder.classList.remove("hidden");
      preview.classList.add("hidden");
      fileInput.value = "";
      status.classList.add("hidden");
    });
    dropZone.addEventListener("click", (e) => {
      if (e.target.closest(".circuit-image-actions")) return;
      fileInput.click();
    });
  }
  function initCircuitImageUpload() {
    const dropZone = byId("circuitImageDropZone");
    const fileInput = byId("circuitImageInput");
    const placeholder = byId("circuitImagePlaceholder");
    const preview = byId("circuitImagePreview");
    const img = byId("circuitImageImg");
    const status = byId("circuitImageStatus");
    const replaceBtn = byId("circuitImageReplaceBtn");
    const removeBtn = byId("circuitImageRemoveBtn");
    async function handleFile(file) {
      if (!file.type.match(/^image\/(png|jpeg|webp)$/)) {
        status.textContent = "Unsupported format. Please use PNG, JPEG, or WebP.";
        status.className = "help-text circuit-image-status status-error";
        status.classList.remove("hidden");
        return;
      }
      try {
        status.textContent = "Processing image...";
        status.className = "help-text circuit-image-status status-loading";
        status.classList.remove("hidden");
        circuitImageDataUrl = await preprocessImage(file);
        img.src = circuitImageDataUrl;
        placeholder.classList.add("hidden");
        preview.classList.remove("hidden");
        status.textContent = "Image ready. Click Solve to analyze.";
        status.className = "help-text circuit-image-status status-success";
      } catch (e) {
        status.textContent = "Failed to process image.";
        status.className = "help-text circuit-image-status status-error";
        circuitImageDataUrl = null;
      }
    }
    dropZone.addEventListener("dragover", (e) => {
      e.preventDefault();
      dropZone.classList.add("drag-over");
    });
    dropZone.addEventListener("dragleave", () => dropZone.classList.remove("drag-over"));
    dropZone.addEventListener("drop", (e) => {
      e.preventDefault();
      dropZone.classList.remove("drag-over");
      const file = e.dataTransfer?.files[0];
      if (file) handleFile(file);
    });
    fileInput.addEventListener("change", () => {
      const file = fileInput.files?.[0];
      if (file) handleFile(file);
    });
    replaceBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      fileInput.click();
    });
    removeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      circuitImageDataUrl = null;
      img.src = "";
      placeholder.classList.remove("hidden");
      preview.classList.add("hidden");
      fileInput.value = "";
      status.classList.add("hidden");
    });
    dropZone.addEventListener("click", (e) => {
      if (e.target.closest(".circuit-image-actions")) return;
      fileInput.click();
    });
  }
  function downloadSvg(targetId) {
    const container = document.getElementById(targetId);
    if (!container) return;
    const svg = container.querySelector("svg");
    if (!svg) return;
    const clone = svg.cloneNode(true);
    const styles = getComputedStyle(document.documentElement);
    const cssVars = ["--gate-fill", "--gate-stroke", "--wire-low", "--wire-high", "--text-primary", "--bg-card-alt", "--border-color"];
    cssVars.forEach((v) => {
      clone.setAttribute(v.replace(/^--/, "data-"), styles.getPropertyValue(v).trim());
    });
    const styleEl = document.createElementNS("http://www.w3.org/2000/svg", "style");
    styleEl.textContent = `
        text { font-family: 'JetBrains Mono', monospace; }
        .circuit-wire { fill: none; stroke-width: 2.2; }
        .wire-active { stroke: #10b981; }
        .wire-inactive { stroke: #475569; }
    `;
    clone.insertBefore(styleEl, clone.firstChild);
    const serializer = new XMLSerializer();
    const svgStr = serializer.serializeToString(clone);
    const blob = new Blob([svgStr], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${targetId}-circuit.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
  function init() {
    initInputControls(sound);
    initCircuitImageUpload();
    initTimingImageUpload();
    initTruthTableIO();
    setupWaveformControls();
    updateNumericExamples();
    generateTruthTableInput(Number(byId("truthVariables").value));
    initZoomPanControls(sound);
    byId("solveButton").addEventListener("click", () => {
      void solve();
    });
    byId("downloadReportBtn")?.addEventListener("click", () => {
      window.print();
    });
    document.querySelectorAll(".download-svg-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const target = btn.getAttribute("data-target");
        if (target) downloadSvg(target);
      });
    });
    const playgroundButtons = [
      ["openBasicBtn", () => state.graphs.basic],
      ["openNandBtn", () => state.graphs.nand],
      ["openNorBtn", () => state.graphs.nor]
    ];
    for (const [btnId, getGraph] of playgroundButtons) {
      const btn = byId(btnId);
      if (!btn) continue;
      btn.addEventListener("click", () => {
        const graph = getGraph();
        if (!graph) return;
        const label = btnId === "openBasicBtn" ? "Basic Gate Circuit" : btnId === "openNandBtn" ? "NAND-Only Circuit" : "NOR-Only Circuit";
        const circuitFile = web1ToCircuitFile(graph, label);
        storeImportedCircuit(circuitFile);
        window.location.href = "../Web4/index.html";
      });
    }
  }
  init();
})();
