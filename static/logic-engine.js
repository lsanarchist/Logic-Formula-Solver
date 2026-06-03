(function (global) {
  "use strict";

  const SHORTCUT_SUGGESTIONS = [
    { symbol: "⇒", command: "\\Rightarrow", aliases: ["→", "⇒", "->"], kind: "connective", triggers: ["/imp", "/to", "/implies", "/rightarrow", "\\Rightarrow"] },
    { symbol: "⇔", command: "\\Leftrightarrow", aliases: ["⇔", "<->", "iff"], kind: "connective", triggers: ["/iff", "/equiv", "/leftrightarrow", "\\Leftrightarrow"] },
    { symbol: "∨", command: "\\lor", aliases: ["|", "or"], kind: "connective", triggers: ["/lor", "/vee", "\\lor"] },
    { symbol: "∧", command: "\\land", aliases: ["&", "and"], kind: "connective", triggers: ["/land", "/wedge", "\\land"] },
    { symbol: "¬", command: "\\neg", aliases: ["!", "~"], kind: "negation", triggers: ["/neg", "/not", "\\neg"] },
    { symbol: "∀", command: "\\forall", aliases: ["forall", "ALL"], kind: "quantifier", triggers: ["/forall", "\\forall"] },
    { symbol: "∃", command: "\\exists", aliases: ["exists", "EX"], kind: "quantifier", triggers: ["/exists", "\\exists"] },
    { symbol: "⊤", command: "\\top", aliases: ["true", "verum"], kind: "constant", triggers: ["/top", "\\top", "/verum", "\\verum"] },
    { symbol: "⊥", command: "\\bot", aliases: ["false", "absurdum"], kind: "constant", triggers: ["/bot", "\\bot", "/absurdum", "\\absurdum"] }
  ];

  const SHORTCUT_REPLACEMENTS = {
    leftrightarrow: "⇔", rightarrow: "⇒", implies: "⇒", forall: "∀", exists: "∃",
    equiv: "⇔", wedge: "∧", lnot: "¬", land: "∧", lor: "∨", neg: "¬",
    not: "¬", iff: "⇔", imp: "⇒", vee: "∨", to: "⇒", top: "⊤", bot: "⊥",
    verum: "⊤", absurdum: "⊥"
  };

  const WORD_ALIAS_REPLACEMENTS = { forall: "∀", exists: "∃", and: "∧", or: "∨" };
  const UPPERCASE_ALIAS_REPLACEMENTS = { ALL: "∀", EX: "∃" };
  const OPERATOR_ALIAS_REPLACEMENTS = { "<->": "⇔", "->": "⇒", "=>": "⇒", "→": "⇒", "↔": "⇔", "⇒": "⇒", "⇔": "⇔", "|": "∨", "&": "∧", "~": "¬", "!": "¬" };

  const OPS = {
    and: { symbol: "∧", ascii: "&", precedence: 3 },
    or: { symbol: "∨", ascii: "|", precedence: 2 },
    imp: { symbol: "⇒", ascii: "->", precedence: 1 },
    iff: { symbol: "⇔", ascii: "<->", precedence: 0 }
  };

  function normalizeFormulaInput(formula) {
    if (!formula) return formula || "";
    let out = String(formula);
    out = out.replace(/(?<![A-Za-z0-9_])[\\/]([A-Za-z]+)(?![A-Za-z0-9_])/g, (m, name) => {
      return SHORTCUT_REPLACEMENTS[name.toLowerCase()] || m;
    });
    out = out.replace(/(?<![A-Za-z0-9_])(forall|exists|and|or)(?![A-Za-z0-9_])/gi, (m) => {
      return WORD_ALIAS_REPLACEMENTS[m.toLowerCase()] || m;
    });
    out = out.replace(/(?<![A-Za-z0-9_])(ALL|EX)(?![A-Za-z0-9_])/g, (m) => {
      return UPPERCASE_ALIAS_REPLACEMENTS[m] || m;
    });
    out = out.replace(/<->|->|=>|→|↔|⇒|⇔|\||&|~|!(?!=)/g, (m) => OPERATOR_ALIAS_REPLACEMENTS[m] || m);
    return out;
  }

  function normalizeFormulaForAscii(formula) {
    return normalizeFormulaInput(formula)
      .replaceAll("¬", "~")
      .replaceAll("∧", "&")
      .replaceAll("∨", "|")
      .replaceAll("⇒", "->")
      .replaceAll("⇔", "<->")
      .replaceAll("∀", "forall")
      .replaceAll("∃", "exists")
      .replaceAll("⊤", "true")
      .replaceAll("⊥", "false");
  }

  function ensureFormula(formula) {
    const normalized = normalizeFormulaInput(formula).trim();
    if (!normalized) throw new Error("Formula cannot be empty.");
    return normalized;
  }

  function v(name) { return { op: "var", value: String(name) }; }
  function c(value) { return { op: "const", value: Boolean(value) }; }
  function not(left) { return { op: "not", left }; }
  function bin(op, left, right) { return { op, left, right }; }
  function clone(expr) { return JSON.parse(JSON.stringify(expr)); }

  function isVar(expr) { return expr && expr.op === "var"; }
  function isConst(expr) { return expr && expr.op === "const"; }
  function isNotVar(expr) { return expr && expr.op === "not" && expr.left && expr.left.op === "var"; }
  function isLiteral(expr) { return isVar(expr) || isNotVar(expr) || isConst(expr); }

  function tokenize(input) {
    const text = normalizeFormulaInput(input);
    const tokens = [];
    let i = 0;
    while (i < text.length) {
      const ch = text[i];
      if (/\s/.test(ch)) { i += 1; continue; }
      const rest = text.slice(i);
      const two = text.slice(i, i + 2);
      const three = text.slice(i, i + 3);
      if (three === "<->") { tokens.push({ type: "iff", text: "⇔" }); i += 3; continue; }
      if (two === "->" || two === "=>") { tokens.push({ type: "imp", text: "⇒" }); i += 2; continue; }
      if (ch === "(" ) { tokens.push({ type: "lparen", text: ch }); i += 1; continue; }
      if (ch === ")" ) { tokens.push({ type: "rparen", text: ch }); i += 1; continue; }
      if (ch === "," ) { tokens.push({ type: "comma", text: ch }); i += 1; continue; }
      if (ch === "." ) { tokens.push({ type: "dot", text: ch }); i += 1; continue; }
      if (ch === "¬" || ch === "~" || ch === "!") { tokens.push({ type: "not", text: "¬" }); i += 1; continue; }
      if (ch === "∧" || ch === "&") { tokens.push({ type: "and", text: "∧" }); i += 1; continue; }
      if (ch === "∨" || ch === "|") { tokens.push({ type: "or", text: "∨" }); i += 1; continue; }
      if (ch === "⇒" || ch === "→") { tokens.push({ type: "imp", text: "⇒" }); i += 1; continue; }
      if (ch === "⇔" || ch === "↔") { tokens.push({ type: "iff", text: "⇔" }); i += 1; continue; }
      if (ch === "∀") { tokens.push({ type: "forall", text: "∀" }); i += 1; continue; }
      if (ch === "∃") { tokens.push({ type: "exists", text: "∃" }); i += 1; continue; }
      if (ch === "⊤") { tokens.push({ type: "const", text: "⊤", value: true }); i += 1; continue; }
      if (ch === "⊥") { tokens.push({ type: "const", text: "⊥", value: false }); i += 1; continue; }
      const m = rest.match(/^[A-Za-z_][A-Za-z0-9_]*/);
      if (m) {
        const word = m[0];
        const lower = word.toLowerCase();
        if (lower === "forall") tokens.push({ type: "forall", text: word });
        else if (lower === "exists") tokens.push({ type: "exists", text: word });
        else if (lower === "and") tokens.push({ type: "and", text: word });
        else if (lower === "or") tokens.push({ type: "or", text: word });
        else if (lower === "not") tokens.push({ type: "not", text: word });
        else if (lower === "imp") tokens.push({ type: "imp", text: word });
        else if (lower === "iff") tokens.push({ type: "iff", text: word });
        else if (lower === "true") tokens.push({ type: "const", text: word, value: true });
        else if (lower === "false") tokens.push({ type: "const", text: word, value: false });
        else tokens.push({ type: "var", text: word, value: word });
        i += word.length;
        continue;
      }
      throw new Error(`Unknown character at position ${i + 1}: ${ch}`);
    }
    return tokens;
  }

  class Parser {
    constructor(tokens) {
      this.tokens = tokens;
      this.i = 0;
    }
    peek() { return this.tokens[this.i] || null; }
    match(type) { if (this.peek()?.type === type) return this.tokens[this.i++]; return null; }
    expect(type, message) { const tok = this.match(type); if (!tok) throw new Error(message || `Expected ${type}`); return tok; }
    atEnd() { return this.i >= this.tokens.length; }
  }

  function parseFormula(input) {
    const tokens = tokenize(ensureFormula(input));
    const p = new Parser(tokens);
    const expr = parseIff(p);
    if (!p.atEnd()) throw new Error(`Unexpected token: ${p.peek().text}`);
    return expr;
  }

  function parseIff(p) {
    const left = parseImp(p);
    if (p.match("iff")) return bin("iff", left, parseIff(p));
    return left;
  }
  function parseImp(p) {
    const left = parseOr(p);
    if (p.match("imp")) return bin("imp", left, parseImp(p));
    return left;
  }
  function parseOr(p) {
    let expr = parseAnd(p);
    while (p.match("or")) expr = bin("or", expr, parseAnd(p));
    return expr;
  }
  function parseAnd(p) {
    let expr = parseUnary(p);
    while (p.match("and")) expr = bin("and", expr, parseUnary(p));
    return expr;
  }
  function parseUnary(p) {
    if (p.match("not")) return not(parseUnary(p));
    return parsePrimary(p);
  }
  function parsePrimary(p) {
    const tok = p.peek();
    if (!tok) throw new Error("Unexpected end of formula.");
    if (p.match("lparen")) {
      const expr = parseIff(p);
      p.expect("rparen", "Expected closing parenthesis.");
      return expr;
    }
    if (tok.type === "var") { p.i += 1; return v(tok.value); }
    if (tok.type === "const") { p.i += 1; return c(tok.value); }
    throw new Error(`Unexpected token: ${tok.text}`);
  }

  function exprKey(expr) {
    if (!expr) return "?";
    if (expr.op === "var") return `var:${expr.value}`;
    if (expr.op === "const") return `const:${expr.value ? 1 : 0}`;
    if (expr.op === "not") return `not(${exprKey(expr.left)})`;
    return `${expr.op}(${exprKey(expr.left)},${exprKey(expr.right)})`;
  }

  function literalKey(expr) {
    if (expr.op === "var") return `${expr.value}:0`;
    if (isNotVar(expr)) return `${expr.left.value}:1`;
    if (expr.op === "const") return `~:${expr.value ? 0 : 1}`;
    return exprKey(expr);
  }

  function compareExpr(a, b) { return literalKey(a).localeCompare(literalKey(b)); }

  function flatten(expr, op) {
    if (!expr || expr.op !== op) return [expr];
    return [...flatten(expr.left, op), ...flatten(expr.right, op)];
  }

  function buildChain(items, op, emptyValue = null) {
    const clean = items.filter(Boolean).map(clone);
    if (!clean.length) return emptyValue !== null ? c(emptyValue) : null;
    return clean.slice(1).reduce((acc, item) => bin(op, acc, item), clean[0]);
  }

  function negate(expr) { return not(clone(expr)); }

  function eliminateArrows(expr) {
    switch (expr.op) {
      case "var":
      case "const": return clone(expr);
      case "not": return not(eliminateArrows(expr.left));
      case "and":
      case "or": return bin(expr.op, eliminateArrows(expr.left), eliminateArrows(expr.right));
      case "imp": return bin("or", not(eliminateArrows(expr.left)), eliminateArrows(expr.right));
      case "iff": {
        const a = eliminateArrows(expr.left);
        const b = eliminateArrows(expr.right);
        return bin("and", bin("or", not(clone(a)), clone(b)), bin("or", not(clone(b)), clone(a)));
      }
      default: throw new Error(`Unsupported operator: ${expr.op}`);
    }
  }

  function toNNF(expr) {
    if (expr.op === "var" || expr.op === "const") return clone(expr);
    if (expr.op === "not") return nnfNeg(expr.left);
    if (expr.op === "and" || expr.op === "or") return bin(expr.op, toNNF(expr.left), toNNF(expr.right));
    return toNNF(eliminateArrows(expr));
  }

  function nnfNeg(expr) {
    if (expr.op === "var") return not(clone(expr));
    if (expr.op === "const") return c(!expr.value);
    if (expr.op === "not") return toNNF(expr.left);
    if (expr.op === "and") return bin("or", nnfNeg(expr.left), nnfNeg(expr.right));
    if (expr.op === "or") return bin("and", nnfNeg(expr.left), nnfNeg(expr.right));
    return nnfNeg(eliminateArrows(expr));
  }

  function distributeOr(a, b) {
    if (isConst(a) && a.value) return c(true);
    if (isConst(b) && b.value) return c(true);
    if (isConst(a) && !a.value) return clone(b);
    if (isConst(b) && !b.value) return clone(a);
    if (a.op === "and") return bin("and", distributeOr(a.left, b), distributeOr(a.right, b));
    if (b.op === "and") return bin("and", distributeOr(a, b.left), distributeOr(a, b.right));
    return bin("or", clone(a), clone(b));
  }

  function distributeOrOverAnd(expr) {
    if (expr.op === "var" || expr.op === "const" || isNotVar(expr)) return clone(expr);
    if (expr.op === "and") return bin("and", distributeOrOverAnd(expr.left), distributeOrOverAnd(expr.right));
    if (expr.op === "or") return distributeOr(distributeOrOverAnd(expr.left), distributeOrOverAnd(expr.right));
    if (expr.op === "not") return clone(expr);
    return distributeOrOverAnd(toNNF(eliminateArrows(expr)));
  }

  function toCNFExpr(expr) { return simplifyNF(distributeOrOverAnd(toNNF(eliminateArrows(expr)))); }
  function toDNFExpr(expr) { return simplifyNF(toNNF(not(toCNFExpr(not(expr))))); }

  function simplifyNF(expr) {
    if (!expr || expr.op === "var" || expr.op === "const") return clone(expr);
    if (expr.op === "not") return not(simplifyNF(expr.left));
    const left = simplifyNF(expr.left);
    const right = simplifyNF(expr.right);
    if (expr.op === "and") {
      if (isConst(left) && !left.value) return c(false);
      if (isConst(right) && !right.value) return c(false);
      if (isConst(left) && left.value) return right;
      if (isConst(right) && right.value) return left;
    }
    if (expr.op === "or") {
      if (isConst(left) && left.value) return c(true);
      if (isConst(right) && right.value) return c(true);
      if (isConst(left) && !left.value) return right;
      if (isConst(right) && !right.value) return left;
    }
    return bin(expr.op, left, right);
  }

  function extractVariables(expr, out = new Set()) {
    if (!expr) return out;
    if (expr.op === "var") out.add(expr.value);
    if (expr.left) extractVariables(expr.left, out);
    if (expr.right) extractVariables(expr.right, out);
    return out;
  }

  function variablesOf(expr) { return [...extractVariables(expr)].sort(); }

  function evalExpr(expr, assignment) {
    switch (expr.op) {
      case "const": return Boolean(expr.value);
      case "var": return Boolean(assignment[expr.value]);
      case "not": return !evalExpr(expr.left, assignment);
      case "and": return evalExpr(expr.left, assignment) && evalExpr(expr.right, assignment);
      case "or": return evalExpr(expr.left, assignment) || evalExpr(expr.right, assignment);
      case "imp": return !evalExpr(expr.left, assignment) || evalExpr(expr.right, assignment);
      case "iff": return evalExpr(expr.left, assignment) === evalExpr(expr.right, assignment);
      default: throw new Error(`Cannot evaluate operator ${expr.op}`);
    }
  }

  function bitPatterns(n) {
    const total = 2 ** n;
    const rows = [];
    for (let i = 0; i < total; i += 1) {
      const row = [];
      for (let shift = n - 1; shift >= 0; shift -= 1) row.push(Math.floor(i / (2 ** shift)) % 2);
      rows.push(row);
    }
    return rows;
  }

  function assignmentFromBits(vars, bits) {
    const a = {};
    vars.forEach((name, i) => { a[name] = bits[i] === 1 || bits[i] === true; });
    return a;
  }

  function trueFalseDigit(value) { return value ? "1" : "0"; }

  function literalVariable(expr) {
    if (expr.op === "var") return expr.value;
    if (isNotVar(expr)) return expr.left.value;
    return null;
  }

  function literalPolarity(expr) {
    if (expr.op === "var") return true;
    if (isNotVar(expr)) return false;
    return null;
  }

  function clauseToLiterals(expr) { return flatten(expr, "or"); }
  function termToLiterals(expr) { return flatten(expr, "and"); }
  function clausesFromCnf(expr) { return flatten(expr, "and"); }
  function termsFromDnf(expr) { return flatten(expr, "or"); }

  function normalizeLiteralList(lits) {
    const seen = new Map();
    const result = [];
    for (const lit of lits) {
      const key = exprKey(lit);
      if (!seen.has(key)) { seen.set(key, true); result.push(clone(lit)); }
    }
    result.sort(compareExpr);
    return result;
  }

  function containsOppositePair(lits) {
    const map = new Map();
    for (const lit of lits) {
      const variable = literalVariable(lit);
      const polarity = literalPolarity(lit);
      if (variable === null || polarity === null) continue;
      if (map.has(variable) && map.get(variable) !== polarity) return true;
      map.set(variable, polarity);
    }
    return false;
  }

  function varsInLiterals(lits) {
    return new Set(lits.map(literalVariable).filter(Boolean));
  }

  function canonicalizeCNF(cnf, allVars) {
    let clauses = clausesFromCnf(cnf).map((clause) => buildChain(normalizeLiteralList(clauseToLiterals(clause)), "or", false));
    clauses = clauses.filter((clause) => !containsOppositePair(clauseToLiterals(clause)));
    const expanded = [];
    for (const clause of clauses) {
      const lits = clauseToLiterals(clause);
      const present = varsInLiterals(lits);
      const missing = allVars.filter((name) => !present.has(name));
      for (const bits of bitPatterns(missing.length)) {
        const added = missing.map((name, i) => bits[i] ? v(name) : not(v(name)));
        expanded.push(buildChain(normalizeLiteralList([...lits, ...added]), "or", false));
      }
    }
    const unique = uniqueExprs(expanded).sort((a, b) => exprKey(a).localeCompare(exprKey(b)));
    return buildChain(unique, "and", true);
  }

  function canonicalizeDNF(dnf, allVars) {
    let terms = termsFromDnf(dnf).map((term) => buildChain(normalizeLiteralList(termToLiterals(term)), "and", true));
    terms = terms.filter((term) => !containsOppositePair(termToLiterals(term)));
    const expanded = [];
    for (const term of terms) {
      const lits = termToLiterals(term);
      const present = varsInLiterals(lits);
      const missing = allVars.filter((name) => !present.has(name));
      for (const bits of bitPatterns(missing.length)) {
        const added = missing.map((name, i) => bits[i] ? v(name) : not(v(name)));
        expanded.push(buildChain(normalizeLiteralList([...lits, ...added]), "and", true));
      }
    }
    const unique = uniqueExprs(expanded).sort((a, b) => exprKey(a).localeCompare(exprKey(b)));
    return buildChain(unique, "or", false);
  }

  function uniqueExprs(items) {
    const seen = new Set();
    const out = [];
    for (const item of items) {
      const key = exprKey(item);
      if (!seen.has(key)) { seen.add(key); out.push(item); }
    }
    return out;
  }

  function canonicalCNFExpr(expr) { return simplifyNF(canonicalizeCNF(toCNFExpr(expr), variablesOf(expr))); }
  function canonicalDNFExpr(expr) { return simplifyNF(canonicalizeDNF(toDNFExpr(expr), variablesOf(expr))); }

  function allTernaryPatterns(n) {
    if (n === 0) return [[]];
    const rest = allTernaryPatterns(n - 1);
    const out = [];
    for (const bit of [0, 1, "x"]) for (const tail of rest) out.push([bit, ...tail]);
    return out;
  }

  function patternCoversRow(pattern, row) {
    return pattern.every((bit, i) => bit === "x" || bit === row[i]);
  }

  function patternLiteralCount(pattern) { return pattern.filter((bit) => bit !== "x").length; }

  function patternSubsumes(a, b) {
    return a.every((bit, i) => bit === "x" || bit === b[i]);
  }

  function rowKey(row) { return row.join(""); }
  function patternKey(pattern) { return pattern.join(""); }

  function rowsToMinimalPatterns(targetRows, nonTargetRows, varCount) {
    if (!targetRows.length) return [];
    if (!nonTargetRows.length) return [Array(varCount).fill("x")];
    const patterns = allTernaryPatterns(varCount);
    let candidates = [];
    for (const pattern of patterns) {
      const covered = targetRows.filter((row) => patternCoversRow(pattern, row));
      if (!covered.length) continue;
      if (nonTargetRows.some((row) => patternCoversRow(pattern, row))) continue;
      candidates.push({ pattern, covered, literalCount: patternLiteralCount(pattern) });
    }
    candidates.sort((a, b) => patternKey(a.pattern).localeCompare(patternKey(b.pattern)));
    candidates = candidates.filter((candidate) => !candidates.some((other) => {
      if (other === candidate) return false;
      return patternKey(other.pattern) !== patternKey(candidate.pattern) && patternSubsumes(other.pattern, candidate.pattern);
    }));

    const targetSet = new Set(targetRows.map(rowKey));
    const candidateMap = new Map();
    for (const row of targetRows) {
      candidateMap.set(rowKey(row), candidates.filter((candidate) => candidate.covered.some((covered) => rowKey(covered) === rowKey(row))));
    }

    let best = null;
    function better(selection) {
      const termCount = selection.length;
      const literalCount = selection.reduce((sum, c) => sum + c.literalCount, 0);
      const keys = selection.map((c) => patternKey(c.pattern)).sort();
      if (!best) return true;
      if (termCount !== best.termCount) return termCount < best.termCount;
      if (literalCount !== best.literalCount) return literalCount < best.literalCount;
      return keys.join("|") < best.keys.join("|");
    }
    function search(uncovered, selected) {
      if (!uncovered.size) {
        if (better(selected)) {
          best = {
            termCount: selected.length,
            literalCount: selected.reduce((sum, c) => sum + c.literalCount, 0),
            keys: selected.map((c) => patternKey(c.pattern)).sort(),
            patterns: selected.map((c) => c.pattern)
          };
        }
        return;
      }
      if (best && selected.length >= best.termCount) return;
      const first = [...uncovered].sort()[0];
      const choices = (candidateMap.get(first) || []).slice().sort((a, b) => {
        const diff = a.literalCount - b.literalCount;
        return diff || patternKey(a.pattern).localeCompare(patternKey(b.pattern));
      });
      for (const candidate of choices) {
        if (selected.some((s) => patternKey(s.pattern) === patternKey(candidate.pattern))) continue;
        const next = new Set(uncovered);
        for (const row of candidate.covered) next.delete(rowKey(row));
        search(next, [...selected, candidate]);
      }
    }
    search(targetSet, []);
    return (best?.patterns || []).sort((a, b) => patternKey(a).localeCompare(patternKey(b)));
  }

  function patternsToDNF(vars, patterns) {
    if (!patterns.length) return c(false);
    if (patterns.length === 1 && patterns[0].every((bit) => bit === "x")) return c(true);
    const terms = patterns.map((pattern) => {
      const lits = pattern.flatMap((bit, i) => bit === "x" ? [] : [bit === 1 ? v(vars[i]) : not(v(vars[i]))]);
      return buildChain(lits, "and", true);
    });
    return buildChain(terms, "or", false);
  }

  function patternsToCNF(vars, patterns) {
    if (!patterns.length) return c(true);
    if (patterns.length === 1 && patterns[0].every((bit) => bit === "x")) return c(false);
    const clauses = patterns.map((pattern) => {
      const lits = pattern.flatMap((bit, i) => bit === "x" ? [] : [bit === 0 ? v(vars[i]) : not(v(vars[i]))]);
      return buildChain(lits, "or", false);
    });
    return buildChain(clauses, "and", true);
  }

  function minimalDNFExpr(expr) {
    const vars = variablesOf(expr);
    const rows = bitPatterns(vars.length);
    const target = rows.filter((bits) => evalExpr(expr, assignmentFromBits(vars, bits)));
    const nonTarget = rows.filter((bits) => !evalExpr(expr, assignmentFromBits(vars, bits)));
    return simplifyNF(patternsToDNF(vars, rowsToMinimalPatterns(target, nonTarget, vars.length)));
  }

  function minimalCNFExpr(expr) {
    const vars = variablesOf(expr);
    const rows = bitPatterns(vars.length);
    const target = rows.filter((bits) => !evalExpr(expr, assignmentFromBits(vars, bits)));
    const nonTarget = rows.filter((bits) => evalExpr(expr, assignmentFromBits(vars, bits)));
    return simplifyNF(patternsToCNF(vars, rowsToMinimalPatterns(target, nonTarget, vars.length)));
  }

  function exprPrec(expr) {
    if (!expr) return 99;
    if (expr.op === "var" || expr.op === "const") return 5;
    if (expr.op === "not") return 4;
    return OPS[expr.op]?.precedence ?? 6;
  }

  function prettyExpr(expr, parentPrec = -1) {
    let text;
    if (expr.op === "var") text = expr.value;
    else if (expr.op === "const") text = expr.value ? "⊤" : "⊥";
    else if (expr.op === "not") {
      const child = prettyExpr(expr.left, exprPrec(expr));
      text = `¬${child}`;
    } else if (OPS[expr.op]) {
      const prec = exprPrec(expr);
      const left = prettyExpr(expr.left, prec);
      const right = prettyExpr(expr.right, prec + (expr.op === "imp" || expr.op === "iff" ? 1 : 0));
      text = `${left} ${OPS[expr.op].symbol} ${right}`;
    } else text = expr.op;
    return exprPrec(expr) < parentPrec ? `(${text})` : text;
  }

  function astText(expr) {
    if (expr.op === "var") return `var(${expr.value})`;
    if (expr.op === "const") return expr.value ? "true" : "false";
    if (expr.op === "not") return `not(${astText(expr.left)})`;
    return `${expr.op}(${astText(expr.left)}, ${astText(expr.right)})`;
  }

  function analyzeFormula(formula) {
    const tokens = tokenize(ensureFormula(formula));
    const expr = parseFormula(formula);
    const tokenText = `[${tokens.map((tok) => tok.type === "var" ? `var(${tok.value})` : tok.type).join(", ")}]`;
    return [tokenText, astText(expr)];
  }

  function cnfFormula(formula) { return prettyExpr(toCNFExpr(parseFormula(formula))); }
  function dnfFormula(formula) { return prettyExpr(toDNFExpr(parseFormula(formula))); }
  function canonicalCNFFormula(formula) { return prettyExpr(canonicalCNFExpr(parseFormula(formula))); }
  function canonicalDNFFormula(formula) { return prettyExpr(canonicalDNFExpr(parseFormula(formula))); }
  function minimalCNFFormula(formula) { return prettyExpr(minimalCNFExpr(parseFormula(formula))); }
  function minimalDNFFormula(formula) { return prettyExpr(minimalDNFExpr(parseFormula(formula))); }

  function normalFormDetails(formulaText, normalForm, sourceFormula = null) {
    const details = { rows: null, summary: null, table_error: null, karnaugh_map: null, karnaugh_error: null };
    try {
      const expr = parseFormula(formulaText);
      const outerOp = normalForm === "cnf" ? "and" : "or";
      const innerOp = normalForm === "cnf" ? "or" : "and";
      const rowLabel = normalForm === "cnf" ? "Clause" : "Term";
      const rowPrefix = normalForm === "cnf" ? "C" : "T";
      const joinSymbol = normalForm === "cnf" ? "∧" : "∨";
      const groups = flatten(expr, outerOp);
      let variables = variablesOf(expr);
      if (!variables.length && sourceFormula) variables = variablesOf(parseFormula(sourceFormula));
      let totalLiterals = 0;
      const rows = groups.map((group, index) => {
        const lits = flatten(group, innerOp);
        const literalTexts = lits.map((lit) => prettyExpr(lit));
        totalLiterals += literalTexts.length;
        return {
          [rowLabel]: `${rowPrefix}${index + 1}`,
          Expression: prettyExpr(group),
          Literals: literalTexts.join(", "),
          Count: String(literalTexts.length)
        };
      });
      details.rows = rows;
      details.summary = {
        row_label: rowLabel,
        row_prefix: rowPrefix,
        join_symbol: joinSymbol,
        group_count: rows.length,
        literal_count: totalLiterals,
        variable_count: variables.length,
        variables: variables.length ? variables.join(", ") : "—"
      };
    } catch (err) {
      details.table_error = err.message || String(err);
    }
    try {
      details.karnaugh_map = buildKarnaughMap(formulaText, normalForm, sourceFormula);
    } catch (err) {
      details.karnaugh_error = err.message || String(err);
    }
    return details;
  }

  function grayCodeTuples(n) {
    let rows = [[]];
    for (let i = 0; i < n; i += 1) {
      rows = [
        ...rows.map((bits) => [false, ...bits]),
        ...rows.slice().reverse().map((bits) => [true, ...bits])
      ];
    }
    return rows;
  }
  function bitsLabel(bits) { return bits.length ? bits.map((b) => b ? "1" : "0").join("") : "0"; }

  function literalConstraint(literal, normalForm) {
    if (literal.op === "var") return [literal.value, normalForm === "dnf"];
    if (isNotVar(literal)) return [literal.left.value, normalForm !== "dnf"];
    if (literal.op === "const") return [null, literal.value];
    throw new Error(`Unsupported literal in ${normalForm.toUpperCase()} group: ${prettyExpr(literal)}`);
  }

  function extractKmapGroups(expr, normalForm) {
    if (expr.op === "const") {
      const focus = normalForm === "dnf" ? "1" : "0";
      if ((expr.value ? "1" : "0") !== focus) return [];
      return [{ id: `${normalForm === "dnf" ? "T" : "C"}1`, expression: prettyExpr(expr), spec: {} }];
    }
    const outerOp = normalForm === "cnf" ? "and" : "or";
    const innerOp = normalForm === "cnf" ? "or" : "and";
    const prefix = normalForm === "cnf" ? "C" : "T";
    return flatten(expr, outerOp).map((group, index) => {
      const spec = {};
      for (const lit of flatten(group, innerOp)) {
        const [name, expected] = literalConstraint(lit, normalForm);
        if (name) spec[name] = expected;
      }
      return { id: `${prefix}${index + 1}`, expression: prettyExpr(group), spec };
    });
  }

  function matchesSpec(assignment, spec) {
    return Object.entries(spec).every(([name, expected]) => assignment[name] === expected);
  }

  function cyclicRuns(indexes, size) {
    if (!indexes.length) return [];
    if (indexes.length === size) return [[0, size - 1]];
    const sorted = [...indexes].sort((a, b) => a - b);
    const runs = [[sorted[0]]];
    for (const index of sorted.slice(1)) {
      const lastRun = runs[runs.length - 1];
      if (index === lastRun[lastRun.length - 1] + 1) lastRun.push(index);
      else runs.push([index]);
    }
    return runs.map((run) => [run[0], run[run.length - 1]]);
  }

  function groupRects(positions, rowCount, colCount) {
    if (!positions.length) return [];
    const rows = [...new Set(positions.map(([r]) => r))];
    const cols = [...new Set(positions.map(([, col]) => col))];
    const rects = [];
    for (const [rowStart, rowEnd] of cyclicRuns(rows, rowCount)) {
      for (const [colStart, colEnd] of cyclicRuns(cols, colCount)) {
        rects.push({ row_start: rowStart, row_end: rowEnd, col_start: colStart, col_end: colEnd });
      }
    }
    return rects;
  }

  function buildKarnaughMap(formulaText, normalForm, sourceFormula = null) {
    const expr = parseFormula(formulaText);
    let variables = variablesOf(expr);
    if (!variables.length && sourceFormula) variables = variablesOf(parseFormula(sourceFormula));
    if (!variables.length) throw new Error("No variables detected in formula.");
    const colCountVars = Math.ceil(variables.length / 2);
    const colVars = variables.slice(0, colCountVars);
    const rowVars = variables.slice(colCountVars);
    const colCodes = grayCodeTuples(colVars.length);
    const rowCodes = grayCodeTuples(rowVars.length);
    const rowLabels = rowCodes.map(bitsLabel);
    const colLabels = colCodes.map(bitsLabel);
    const cellsByPosition = new Map();
    for (let row = 0; row < rowCodes.length; row += 1) {
      for (let col = 0; col < colCodes.length; col += 1) {
        const assignment = {};
        rowVars.forEach((name, i) => { assignment[name] = rowCodes[row][i]; });
        colVars.forEach((name, i) => { assignment[name] = colCodes[col][i]; });
        const value = evalExpr(expr, assignment);
        const indexBits = variables.map((name) => assignment[name] ? "1" : "0").join("");
        cellsByPosition.set(`${row},${col}`, { row, col, value: value ? "1" : "0", index: String(parseInt(indexBits || "0", 2)), groups: [] });
      }
    }
    const palette = ["#38bdf8", "#22c55e", "#f59e0b", "#a855f7", "#ef4444", "#14b8a6", "#f97316", "#6366f1"];
    const groups = [];
    const specs = extractKmapGroups(expr, normalForm);
    specs.forEach((group, groupIndex) => {
      const color = palette[groupIndex % palette.length];
      const positions = [];
      for (let row = 0; row < rowCodes.length; row += 1) {
        for (let col = 0; col < colCodes.length; col += 1) {
          const assignment = {};
          rowVars.forEach((name, i) => { assignment[name] = rowCodes[row][i]; });
          colVars.forEach((name, i) => { assignment[name] = colCodes[col][i]; });
          if (matchesSpec(assignment, group.spec)) positions.push([row, col]);
        }
      }
      const posSet = new Set(positions.map(([r, col]) => `${r},${col}`));
      groups.push({ id: group.id, expression: group.expression, color, rects: groupRects(positions, rowCodes.length, colCodes.length) });
      for (const [row, col] of positions) {
        const cell = cellsByPosition.get(`${row},${col}`);
        const memberships = cell.groups;
        memberships.push({
          id: group.id,
          color,
          slot: memberships.length,
          top: row === 0 || !posSet.has(`${row - 1},${col}`),
          right: col === colCodes.length - 1 || !posSet.has(`${row},${col + 1}`),
          bottom: row === rowCodes.length - 1 || !posSet.has(`${row + 1},${col}`),
          left: col === 0 || !posSet.has(`${row},${col - 1}`)
        });
      }
    });
    const cells = [];
    for (let row = 0; row < rowCodes.length; row += 1) for (let col = 0; col < colCodes.length; col += 1) cells.push(cellsByPosition.get(`${row},${col}`));
    return { normal_form: normalForm, variables, row_vars: rowVars, col_vars: colVars, row_labels: rowLabels, col_labels: colLabels, rows: rowCodes.length, cols: colCodes.length, focus_value: normalForm === "dnf" ? "1" : "0", cells, groups };
  }

  function truthTableBundle(formula) {
    const expr = parseFormula(formula);
    const vars = variablesOf(expr);
    const mdnfExpr = minimalDNFExpr(expr);
    const mcnfExpr = minimalCNFExpr(expr);
    const rows = bitPatterns(vars.length).map((bits) => {
      const assignment = assignmentFromBits(vars, bits);
      const row = {};
      vars.forEach((name, i) => { row[name] = String(bits[i]); });
      row.F = trueFalseDigit(evalExpr(expr, assignment));
      row.MDNF = trueFalseDigit(evalExpr(mdnfExpr, assignment));
      row.MCNF = trueFalseDigit(evalExpr(mcnfExpr, assignment));
      return row;
    });
    const fValues = rows.map((row) => row.F);
    const isTautology = fValues.every((v) => v === "1");
    const isContradiction = fValues.every((v) => v === "0");
    const isSatisfiable = !isContradiction;
    const equivalent = rows.every((row) => row.F === row.MDNF && row.F === row.MCNF);
    return [rows, prettyExpr(mdnfExpr), prettyExpr(mcnfExpr), {
      is_tautology: isTautology,
      is_contradiction: isContradiction,
      is_satisfiable: isSatisfiable,
      equivalent_mdnf_mcnf: equivalent,
      classification: isTautology ? "Tautology" : isContradiction ? "Contradiction" : "Satisfiable (contingent)",
      minimal_available: true,
      minimal_any_available: true,
      mdnf_available: true,
      mcnf_available: true,
      minimal_message: ""
    }];
  }

  function logicalEquivalenceReport(formulaA, formulaB) {
    const exprA = parseFormula(formulaA);
    const exprB = parseFormula(formulaB);
    const vars = [...new Set([...variablesOf(exprA), ...variablesOf(exprB)])].sort();
    const columns = [...vars, "Formula 1", "Formula 2"];
    const rows = bitPatterns(vars.length).map((bits) => {
      const assignment = assignmentFromBits(vars, bits);
      const row = {};
      vars.forEach((name, i) => { row[name] = String(bits[i]); });
      row["Formula 1"] = trueFalseDigit(evalExpr(exprA, assignment));
      row["Formula 2"] = trueFalseDigit(evalExpr(exprB, assignment));
      return row;
    });
    const counterexample = rows.find((row) => row["Formula 1"] !== row["Formula 2"]) || null;
    return { equivalent: !counterexample, variables: vars, columns, rows, counterexample };
  }

  function exprToTree(expr) {
    if (expr.op === "var") return { type: "leaf", label: expr.value };
    if (expr.op === "const") return { type: "leaf", label: expr.value ? "true" : "false" };
    const children = [];
    if (expr.left) children.push(exprToTree(expr.left));
    if (expr.right) children.push(exprToTree(expr.right));
    return { type: "node", label: expr.op, children };
  }

  function formulaTree(formula) { return exprToTree(parseFormula(formula)); }

  function splitTopLevelConjunction(formula) {
    const parts = [];
    let depth = 0;
    let start = 0;
    for (let i = 0; i < formula.length; i += 1) {
      const ch = formula[i];
      if (ch === "(") depth += 1;
      else if (ch === ")") depth = Math.max(0, depth - 1);
      else if (depth === 0 && (ch === "∧" || ch === "&")) {
        const part = formula.slice(start, i).trim();
        if (part) parts.push(part);
        start = i + 1;
      }
    }
    const tail = formula.slice(start).trim();
    if (tail) parts.push(tail);
    return parts.length ? parts : [formula];
  }

  function tseitinTransform(formula) {
    const expr = parseFormula(formula);
    let counter = 0;
    const clauses = [];
    const nodeInfo = {};
    function fresh() { counter += 1; return `x${counter}`; }
    function clause(...items) { return buildChain(items, "or", false); }
    function localClausesFor(op, A, B, C) {
      if (op === "not") return [clause(not(v(A)), not(v(B))), clause(v(A), v(B))];
      if (op === "and") return [clause(not(v(A)), v(B)), clause(not(v(A)), v(C)), clause(v(A), not(v(B)), not(v(C)))];
      if (op === "or") return [clause(v(A), not(v(B))), clause(v(A), not(v(C))), clause(not(v(A)), v(B), v(C))];
      if (op === "imp") return [clause(v(A), v(B)), clause(v(A), not(v(C))), clause(not(v(A)), not(v(B)), v(C))];
      if (op === "iff") return [clause(not(v(A)), not(v(B)), v(C)), clause(not(v(A)), v(B), not(v(C))), clause(v(A), not(v(B)), not(v(C))), clause(v(A), v(B), v(C))];
      return [];
    }
    function walk(node) {
      if (node.op === "var") return { root: node.value, tree: { type: "leaf", label: node.value } };
      if (node.op === "const") return { root: node.value ? "true" : "false", tree: { type: "leaf", label: node.value ? "true" : "false" } };
      const A = fresh();
      if (node.op === "not") {
        const child = walk(node.left);
        const local = localClausesFor("not", A, child.root);
        clauses.push(...local);
        nodeInfo[A] = { equivalence: prettyExpr(bin("iff", v(A), not(v(child.root)))), clauses: prettyExpr(buildChain(local, "and", true)) };
        return { root: A, tree: { type: "node", label: "not", var: A, children: [child.tree] } };
      }
      const left = walk(node.left);
      const right = walk(node.right);
      const local = localClausesFor(node.op, A, left.root, right.root);
      clauses.push(...local);
      nodeInfo[A] = { equivalence: prettyExpr(bin("iff", v(A), bin(node.op, v(left.root), v(right.root)))), clauses: prettyExpr(buildChain(local, "and", true)) };
      return { root: A, tree: { type: "node", label: node.op, var: A, children: [left.tree, right.tree] } };
    }
    const result = walk(expr);
    const full = buildChain([...clauses, v(result.root)], "and", true);
    const text = prettyExpr(full);
    return [result.tree, text, nodeInfo];
  }

  function generateRandomFormula() {
    const pool = ["A", "B", "C", "D", "E", "F"];
    const count = 2 + Math.floor(Math.random() * 3);
    const variables = shuffle(pool).slice(0, count);
    function expr(depth, forceBinary = false) {
      if (depth <= 0) return variables[Math.floor(Math.random() * variables.length)];
      if (!forceBinary && Math.random() < 0.30) return variables[Math.floor(Math.random() * variables.length)];
      if (!forceBinary && Math.random() < 0.24) return ["not", expr(depth - 1)];
      const ops = ["and", "and", "and", "and", "or", "or", "or", "or", "imp", "imp", "iff"];
      const op = ops[Math.floor(Math.random() * ops.length)];
      return [op, expr(depth - 1), expr(depth - 1)];
    }
    function text(e) {
      if (typeof e === "string") return e;
      if (e[0] === "not") return Array.isArray(e[1]) && e[1].length === 3 ? `¬(${text(e[1])})` : `¬${text(e[1])}`;
      const sym = { and: " ∧ ", or: " ∨ ", imp: " ⇒ ", iff: " ⇔ " }[e[0]];
      return `(${text(e[1])}${sym}${text(e[2])})`;
    }
    return text(expr(2 + Math.floor(Math.random() * 3), true));
  }
  function shuffle(arr) { return [...arr].sort(() => Math.random() - 0.5); }

  function looksLikePredicateVariable(name) {
    return /^[xyzuvwXYZUVW_][A-Za-z0-9_]*$/.test(name);
  }

  function parsePredicateFormula(input) {
    const tokens = tokenize(ensureFormula(input));
    const p = new Parser(tokens);
    const expr = predParseIff(p, []);
    if (!p.atEnd()) throw new Error(`Unexpected token: ${p.peek().text}`);
    return expr;
  }

  function predParseIff(p, bound) {
    const left = predParseImp(p, bound);
    if (p.match("iff")) return bin("iff", left, predParseIff(p, bound));
    return left;
  }
  function predParseImp(p, bound) {
    const left = predParseOr(p, bound);
    if (p.match("imp")) return bin("imp", left, predParseImp(p, bound));
    return left;
  }
  function predParseOr(p, bound) {
    let expr = predParseAnd(p, bound);
    while (p.match("or")) expr = bin("or", expr, predParseAnd(p, bound));
    return expr;
  }
  function predParseAnd(p, bound) {
    let expr = predParseUnary(p, bound);
    while (p.match("and")) expr = bin("and", expr, predParseUnary(p, bound));
    return expr;
  }
  function predParseUnary(p, bound) {
    if (p.match("not")) return not(predParseUnary(p, bound));
    if (p.match("forall")) {
      const variable = p.expect("var", "Expected variable after forall.").value;
      p.expect("dot", "Expected dot after quantified variable.");
      return { op: "forall", variable, body: predParseUnary(p, [variable, ...bound]) };
    }
    if (p.match("exists")) {
      const variable = p.expect("var", "Expected variable after exists.").value;
      p.expect("dot", "Expected dot after quantified variable.");
      return { op: "exists", variable, body: predParseUnary(p, [variable, ...bound]) };
    }
    return predParsePrimary(p, bound);
  }
  function predParsePrimary(p, bound) {
    if (p.match("lparen")) {
      const expr = predParseIff(p, bound);
      p.expect("rparen", "Expected closing parenthesis.");
      return expr;
    }
    const tok = p.expect("var", "Expected predicate, atom, or parenthesized formula.");
    if (p.match("lparen")) {
      const args = [];
      if (!p.match("rparen")) {
        while (true) {
          args.push(predParseTerm(p, bound));
          if (p.match("comma")) continue;
          p.expect("rparen", "Expected closing parenthesis in argument list.");
          break;
        }
      }
      return { op: "pred", name: tok.value, args };
    }
    return { op: "var", value: tok.value };
  }
  function predParseTerm(p, bound) {
    const tok = p.expect("var", "Expected term.");
    if (p.match("lparen")) {
      const args = [];
      if (!p.match("rparen")) {
        while (true) {
          args.push(predParseTerm(p, bound));
          if (p.match("comma")) continue;
          p.expect("rparen", "Expected closing parenthesis in function term.");
          break;
        }
      }
      return { kind: "func", name: tok.value, args };
    }
    if (bound.includes(tok.value) || looksLikePredicateVariable(tok.value)) return { kind: "var", name: tok.value };
    return { kind: "const", name: tok.value };
  }

  function clonePred(node) { return JSON.parse(JSON.stringify(node)); }

  function predEliminateImpIff(node) {
    if (["pred", "var", "const"].includes(node.op)) return clonePred(node);
    if (node.op === "not") return not(predEliminateImpIff(node.left));
    if (node.op === "and" || node.op === "or") return bin(node.op, predEliminateImpIff(node.left), predEliminateImpIff(node.right));
    if (node.op === "imp") return bin("or", not(predEliminateImpIff(node.left)), predEliminateImpIff(node.right));
    if (node.op === "iff") {
      const a = predEliminateImpIff(node.left);
      const b = predEliminateImpIff(node.right);
      return bin("and", bin("or", not(clonePred(a)), clonePred(b)), bin("or", not(clonePred(b)), clonePred(a)));
    }
    if (node.op === "forall" || node.op === "exists") return { op: node.op, variable: node.variable, body: predEliminateImpIff(node.body) };
    return clonePred(node);
  }

  function predNNF(node) {
    if (["pred", "var", "const"].includes(node.op)) return clonePred(node);
    if (node.op === "not") return predNNFNeg(node.left);
    if (node.op === "and" || node.op === "or") return bin(node.op, predNNF(node.left), predNNF(node.right));
    if (node.op === "forall" || node.op === "exists") return { op: node.op, variable: node.variable, body: predNNF(node.body) };
    return predNNF(predEliminateImpIff(node));
  }
  function predNNFNeg(node) {
    if (node.op === "pred" || node.op === "var") return not(clonePred(node));
    if (node.op === "not") return predNNF(node.left);
    if (node.op === "and") return bin("or", predNNFNeg(node.left), predNNFNeg(node.right));
    if (node.op === "or") return bin("and", predNNFNeg(node.left), predNNFNeg(node.right));
    if (node.op === "forall") return { op: "exists", variable: node.variable, body: predNNFNeg(node.body) };
    if (node.op === "exists") return { op: "forall", variable: node.variable, body: predNNFNeg(node.body) };
    return predNNFNeg(predEliminateImpIff(node));
  }

  function renameTerm(term, env) {
    if (term.kind === "var") return { kind: "var", name: env.get(term.name) || term.name };
    if (term.kind === "func") return { kind: "func", name: term.name, args: term.args.map((arg) => renameTerm(arg, env)) };
    return { ...term };
  }
  function standardizeApart(node, counter = { n: 0 }, env = new Map()) {
    if (node.op === "pred") return { op: "pred", name: node.name, args: node.args.map((arg) => renameTerm(arg, env)) };
    if (node.op === "var") return { op: "var", value: node.value };
    if (node.op === "not") return not(standardizeApart(node.left, counter, env));
    if (node.op === "and" || node.op === "or") return bin(node.op, standardizeApart(node.left, counter, env), standardizeApart(node.right, counter, env));
    if (node.op === "forall" || node.op === "exists") {
      counter.n += 1;
      const newName = `${node.variable}_${counter.n}`;
      const nextEnv = new Map(env);
      nextEnv.set(node.variable, newName);
      return { op: node.op, variable: newName, body: standardizeApart(node.body, counter, nextEnv) };
    }
    return clonePred(node);
  }

  function existsDistance(prefix) {
    const index = prefix.findIndex((q) => q.kind === "exists");
    return index === -1 ? 1000000 : index;
  }
  function mergePrefixes(a, b) {
    const out = [];
    let qa = [...a], qb = [...b];
    while (qa.length || qb.length) {
      if (!qa.length) { out.push(...qb); break; }
      if (!qb.length) { out.push(...qa); break; }
      if (existsDistance(qb) < existsDistance(qa)) out.push(qb.shift());
      else out.push(qa.shift());
    }
    return out;
  }
  function extractPrefix(node) {
    if (node.op === "forall" || node.op === "exists") {
      const inner = extractPrefix(node.body);
      return { prefix: [{ kind: node.op, variable: node.variable }, ...inner.prefix], matrix: inner.matrix };
    }
    if (node.op === "and" || node.op === "or") {
      const a = extractPrefix(node.left);
      const b = extractPrefix(node.right);
      return { prefix: mergePrefixes(a.prefix, b.prefix), matrix: bin(node.op, a.matrix, b.matrix) };
    }
    return { prefix: [], matrix: clonePred(node) };
  }
  function buildPrenex(prefix, matrix) {
    return prefix.slice().reverse().reduce((body, q) => ({ op: q.kind, variable: q.variable, body }), clonePred(matrix));
  }
  function prenexExpr(node) {
    const noImp = predEliminateImpIff(node);
    const nnf = predNNF(noImp);
    const standardized = standardizeApart(nnf);
    const { prefix, matrix } = extractPrefix(standardized);
    return buildPrenex(prefix, matrix);
  }

  function substituteTerm(term, variable, replacement) {
    if (term.kind === "var" && term.name === variable) return clonePred(replacement);
    if (term.kind === "func") return { kind: "func", name: term.name, args: term.args.map((arg) => substituteTerm(arg, variable, replacement)) };
    return clonePred(term);
  }
  function substitutePred(node, variable, replacement) {
    if (node.op === "pred") return { op: "pred", name: node.name, args: node.args.map((arg) => substituteTerm(arg, variable, replacement)) };
    if (node.op === "var" && node.value === variable) return { op: "term-as-formula", term: clonePred(replacement) };
    if (node.op === "not") return not(substitutePred(node.left, variable, replacement));
    if (node.op === "and" || node.op === "or" || node.op === "imp" || node.op === "iff") return bin(node.op, substitutePred(node.left, variable, replacement), substitutePred(node.right, variable, replacement));
    if ((node.op === "forall" || node.op === "exists") && node.variable !== variable) return { op: node.op, variable: node.variable, body: substitutePred(node.body, variable, replacement) };
    return clonePred(node);
  }
  function skolemWalk(node, universals = [], counter = { n: 0 }) {
    if (node.op === "forall") return { op: "forall", variable: node.variable, body: skolemWalk(node.body, [...universals, node.variable], counter) };
    if (node.op === "exists") {
      counter.n += 1;
      const skName = `sk_${counter.n}`;
      const replacement = universals.length ? { kind: "func", name: skName, args: universals.map((u) => ({ kind: "var", name: u })) } : { kind: "const", name: skName };
      return skolemWalk(substitutePred(node.body, node.variable, replacement), universals, counter);
    }
    return clonePred(node);
  }

  function termPretty(term) {
    if (!term) return "?";
    if (term.kind === "var" || term.kind === "const") return term.name;
    if (term.kind === "func") return `${term.name}(${term.args.map(termPretty).join(", ")})`;
    return String(term.name || "?");
  }
  function predPretty(node, parentPrec = -1) {
    if (node.op === "pred") return node.args.length ? `${node.name}(${node.args.map(termPretty).join(", ")})` : node.name;
    if (node.op === "var") return node.value;
    if (node.op === "term-as-formula") return termPretty(node.term);
    if (node.op === "not") {
      const inner = predPretty(node.left, 4);
      const text = `¬${inner}`;
      return 4 < parentPrec ? `(${text})` : text;
    }
    if (node.op === "forall" || node.op === "exists") {
      const q = node.op === "forall" ? "∀" : "∃";
      const body = predPretty(node.body, -1);
      const needsParens = ["forall", "exists", "and", "or", "not", "imp", "iff"].includes(node.body.op);
      return `${q} ${node.variable}. ${needsParens ? `(${body})` : body}`;
    }
    if (OPS[node.op]) {
      const prec = exprPrec(node);
      const text = `${predPretty(node.left, prec)} ${OPS[node.op].symbol} ${predPretty(node.right, prec + (node.op === "imp" || node.op === "iff" ? 1 : 0))}`;
      return prec < parentPrec ? `(${text})` : text;
    }
    return node.op;
  }

  function predicateFormulaTree(formula) { return predicateNodeToTree(parsePredicateFormula(formula)); }
  function predicateNodeToTree(node) {
    if (node.op === "pred") return node.args.length ? { type: "node", label: node.name, children: node.args.map(termToTree) } : { type: "leaf", label: node.name };
    if (node.op === "var") return { type: "leaf", label: node.value };
    if (node.op === "not") return { type: "node", label: "not", children: [predicateNodeToTree(node.left)] };
    if (node.op === "forall" || node.op === "exists") return { type: "node", label: `${node.op === "forall" ? "∀" : "∃"}${node.variable}`, children: [predicateNodeToTree(node.body)] };
    if (OPS[node.op]) return { type: "node", label: node.op, children: [predicateNodeToTree(node.left), predicateNodeToTree(node.right)] };
    if (node.op === "term-as-formula") return termToTree(node.term);
    return { type: "leaf", label: node.op };
  }
  function termToTree(term) {
    if (term.kind === "var" || term.kind === "const") return { type: "leaf", label: term.name };
    if (term.kind === "func") return { type: "node", label: term.name, children: term.args.map(termToTree) };
    return { type: "leaf", label: "?" };
  }
  function prenexFormula(formula) { return predPretty(prenexExpr(parsePredicateFormula(formula))); }
  function skolemStepsPretty(formula) {
    const prenex = prenexExpr(parsePredicateFormula(formula));
    const skolem = skolemWalk(prenex);
    return [predPretty(prenex), predPretty(skolem)];
  }
  function predicateFormulaHasQuantifiers(formula) { return /\bforall\b|\bexists\b|∀|∃/i.test(normalizeFormulaInput(formula || "")); }

  const api = {
    SHORTCUT_SUGGESTIONS,
    normalizeFormulaInput,
    normalizeFormulaForAscii,
    tokenize,
    parseFormula,
    prettyExpr,
    astText,
    analyzeFormula,
    cnfFormula,
    dnfFormula,
    canonicalCNFFormula,
    canonicalDNFFormula,
    minimalCNFFormula,
    minimalDNFFormula,
    normalFormDetails,
    truthTableBundle,
    logicalEquivalenceReport,
    formulaTree,
    predicateFormulaTree,
    prenexFormula,
    skolemStepsPretty,
    predicateFormulaHasQuantifiers,
    generateRandomFormula,
    tseitinTransform,
    splitTopLevelConjunction,
    // lower-level exports for smoke tests and optional Prolog adapter
    evalExpr,
    variablesOf,
    toCNFExpr,
    toDNFExpr,
    minimalCNFExpr,
    minimalDNFExpr,
    canonicalCNFExpr,
    canonicalDNFExpr,
    parsePredicateFormula,
    predPretty,
    prenexExpr,
    skolemWalk,
    v, c, not, bin
  };

  global.LogicEngine = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : window);
