(function (global) {
  "use strict";

  const ORIGINAL_PROLOG_FILES = [
    "prolog/original/cnf_dnf_mimi.pl",
    "prolog/original/canonical.pl",
    "prolog/original/minimal.pl",
    "prolog/original/tseitin.pl"
  ];

  const TAU_COMPAT_PRELUDE = `
  :- dynamic(tau_nb_store/2).

  nb_setval(Key, Value) :- retractall(tau_nb_store(Key, _)), assertz(tau_nb_store(Key, Value)).
  nb_getval(Key, Value) :- tau_nb_store(Key, Value).

  append([], Ys, Ys).
  append([X|Xs], Ys, [X|Zs]) :- append(Xs, Ys, Zs).

  member(X, [X|_]).
  member(X, [_|Xs]) :- member(X, Xs).
  memberchk(X, Xs) :- member(X, Xs), !.

  length([], 0).
  length([_|Xs], N) :- length(Xs, N0), N is N0 + 1.

  maplist(_, []).
  maplist(P, [X|Xs]) :- call(P, X), maplist(P, Xs).
  maplist(_, [], []).
  maplist(P, [X|Xs], [Y|Ys]) :- call(P, X, Y), maplist(P, Xs, Ys).
  maplist(_, [], [], []).
  maplist(P, [X|Xs], [Y|Ys], [Z|Zs]) :- call(P, X, Y, Z), maplist(P, Xs, Ys, Zs).

  include(_, [], []).
  include(P, [X|Xs], [X|Ys]) :- call(P, X), !, include(P, Xs, Ys).
  include(P, [_|Xs], Ys) :- include(P, Xs, Ys).

  exclude(_, [], []).
  exclude(P, [X|Xs], Ys) :- call(P, X), !, exclude(P, Xs, Ys).
  exclude(P, [X|Xs], [X|Ys]) :- exclude(P, Xs, Ys).

  list_to_set(List, Set) :- sort(List, Set).

  number_atom(Number, Atom) :-
    number_chars(Number, Chars),
    atom_chars(Atom, Chars).

  original_runtime_canonical(cnf, Ast, Vars, Out) :-
    to_cnf(Ast, Normal),
    canonicalize_cnf(Normal, Vars, Out).
  original_runtime_canonical(dnf, Ast, Vars, Out) :-
    to_dnf(Ast, Normal),
    canonicalize_dnf(Normal, Vars, Out).
  `;

  let session = null;
  let readyPromise = null;
  let lastError = null;
  let loadedSource = "not loaded";

  function preprocessOriginalProlog(source) {
    return source
      .replace(/^\s*:-\s*consult\([^\n]*\.\s*$/gm, "")
      .replace(/^\s*:-\s*encoding\([^\n]*\.\s*$/gm, "")
      .replace(/^\s*:-\s*discontiguous[^\n]*\.\s*$/gm, "")
      .replace(/^\s*:-\s*dynamic\s+([^\n.]+\/\d+)\.\s*$/gm, ":- dynamic($1).")
      .replace(/atom_concat\('x',\s*N1,\s*V\)\./g, "number_atom(N1, N1Atom), atom_concat('x', N1Atom, V).");
  }

  async function loadOriginalProgram() {
    if (!global.fetch) throw new Error("fetch is not available for loading original Prolog files.");
    const sources = await Promise.all(ORIGINAL_PROLOG_FILES.map(async (path) => {
      const response = await global.fetch(path);
      if (!response.ok) throw new Error(`Could not load ${path}: HTTP ${response.status}`);
      return `\n% --- ${path} ---\n${await response.text()}`;
    }));
    loadedSource = ORIGINAL_PROLOG_FILES.join(", ");
    return `${TAU_COMPAT_PRELUDE}\n${preprocessOriginalProlog(sources.join("\n"))}`;
  }

  function init() {
    if (readyPromise) return readyPromise;
    readyPromise = (async () => new Promise(async (resolve) => {
      if (!global.pl || !global.LogicEngine) {
        lastError = "Tau Prolog is not available.";
        resolve(false);
        return;
      }
      try {
        const program = await loadOriginalProgram();
        session = global.pl.create(1000000);
        session.consult(program, {
          success: () => resolve(true),
          error: (err) => {
            lastError = String(err?.toString ? err.toString() : err);
            resolve(false);
          }
        });
      } catch (err) {
        lastError = err.message || String(err);
        resolve(false);
      }
    }))();
    return readyPromise;
  }

  function atom(name) {
    return `'${String(name).replaceAll("\\", "\\\\").replaceAll("'", "\\'")}'`;
  }

  function exprToTerm(expr) {
    if (expr.op === "var") return `var(${atom(expr.value)})`;
    if (expr.op === "const") return expr.value ? "true" : "false";
    if (expr.op === "not") return `not(${exprToTerm(expr.left)})`;
    return `${expr.op}(${exprToTerm(expr.left)}, ${exprToTerm(expr.right)})`;
  }

  function variablesToPrologList(vars) {
    return `[${vars.map((name) => `var(${atom(name)})`).join(", ")}]`;
  }

  function parsePrologExpr(text) {
    const source = String(text).trim();
    let i = 0;
    function skip() { while (/\s/.test(source[i] || "")) i += 1; }
    function readIdent() {
      skip();
      if (source[i] === "'") {
        i += 1;
        let out = "";
        while (i < source.length && source[i] !== "'") out += source[i++];
        if (source[i] !== "'") throw new Error("Unterminated Prolog atom.");
        i += 1;
        return out;
      }
      const m = source.slice(i).match(/^[A-Za-z_][A-Za-z0-9_]*/);
      if (!m) throw new Error(`Expected identifier near: ${source.slice(i)}`);
      i += m[0].length;
      return m[0];
    }
    function parse() {
      const name = readIdent();
      skip();
      if (source[i] !== "(") {
        if (name === "true") return global.LogicEngine.c(true);
        if (name === "false") return global.LogicEngine.c(false);
        return global.LogicEngine.v(name);
      }
      i += 1;
      const args = [];
      skip();
      if (source[i] !== ")") {
        while (true) {
          args.push(parse());
          skip();
          if (source[i] === ",") { i += 1; continue; }
          break;
        }
      }
      if (source[i] !== ")") throw new Error("Expected ')' in Prolog term.");
      i += 1;
      if (name === "var") return global.LogicEngine.v(args[0]?.value || args[0]?.op || "?");
      if (name === "not") return global.LogicEngine.not(args[0]);
      if (["and", "or", "imp", "iff"].includes(name)) {
        if (!args.length) throw new Error(`Unsupported empty ${name} term.`);
        return args.slice(1).reduce((acc, arg) => global.LogicEngine.bin(name, acc, arg), args[0]);
      }
      throw new Error(`Unsupported Prolog term: ${name}/${args.length}`);
    }
    const expr = parse();
    skip();
    if (i !== source.length) throw new Error(`Trailing Prolog term text: ${source.slice(i)}`);
    return expr;
  }

  function queryOnce(goal) {
    return new Promise((resolve, reject) => {
      session.query(goal, {
        success: () => {
          session.answer((answer) => {
            if (!answer) { reject(new Error("Tau Prolog returned no answer.")); return; }
            resolve(session.format_answer(answer));
          });
        },
        error: (err) => reject(new Error(String(err?.toString ? err.toString() : err)))
      });
    });
  }

  function answerValue(formatted, variable = "Out") {
    return String(formatted).replace(new RegExp(`^${variable}\\s*=\\s*`), "").trim();
  }

  async function queryFormula(goal) {
    const ok = await init();
    if (!ok || !session) throw new Error(lastError || "Tau Prolog initialization failed.");
    const formatted = await queryOnce(goal);
    return global.LogicEngine.prettyExpr(parsePrologExpr(answerValue(formatted)));
  }

  async function transform(kind, formula) {
    const expr = global.LogicEngine.parseFormula(formula);
    const predicate = kind === "dnf" ? "to_dnf" : "to_cnf";
    return queryFormula(`${predicate}(${exprToTerm(expr)}, Out).`);
  }

  async function canonical(kind, formula) {
    const expr = global.LogicEngine.parseFormula(formula);
    const vars = global.LogicEngine.variablesOf(expr);
    return queryFormula(`original_runtime_canonical(${kind}, ${exprToTerm(expr)}, ${variablesToPrologList(vars)}, Out).`);
  }

  async function minimal(kind, formula) {
    const expr = global.LogicEngine.parseFormula(formula);
    return queryFormula(`minimize_formula(${kind}, ${exprToTerm(expr)}, Out).`);
  }

  async function tseitin(formula) {
    const expr = global.LogicEngine.parseFormula(formula);
    return queryFormula(`tseitin_transform(${exprToTerm(expr)}, Out).`);
  }

  async function smoke() {
    try {
      const out = await transform("cnf", "A -> B");
      return /A/.test(out) && /B/.test(out);
    } catch {
      return false;
    }
  }

  global.LogicPrologRuntime = {
    init,
    transform,
    canonical,
    minimal,
    tseitin,
    smoke,
    get lastError() { return lastError; },
    get loadedSource() { return loadedSource; }
  };
})(typeof globalThis !== "undefined" ? globalThis : window);
