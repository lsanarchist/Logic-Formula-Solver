(function (global) {
  "use strict";

  const ORIGINAL_PROLOG_FILES = [
    "prolog/original/tokenizer.pl",
    "prolog/original/cnf_dnf_mimi.pl",
    "prolog/original/canonical.pl",
    "prolog/original/minimal.pl",
    "prolog/original/truth_table.pl",
    "prolog/original/equivalence.pl",
    "prolog/original/tseitin.pl",
    "prolog/original/prenex.pl",
    "prolog/original/skolem.pl"
  ];

  const METHOD_PROLOG_FILES = {
    transform: [
      "prolog/original/cnf_dnf_mimi.pl"
    ],
    canonical: [
      "prolog/original/cnf_dnf_mimi.pl",
      "prolog/original/canonical.pl"
    ],
    minimal: [
      "prolog/original/cnf_dnf_mimi.pl",
      "prolog/original/canonical.pl",
      "prolog/original/minimal.pl"
    ],
    tseitin: [
      "prolog/original/tseitin.pl"
    ],
    tokenize: [
      "prolog/original/tokenizer.pl"
    ],
    truthTableBundle: [
      "prolog/original/cnf_dnf_mimi.pl",
      "prolog/original/canonical.pl",
      "prolog/original/minimal.pl",
      "prolog/original/truth_table.pl"
    ],
    equivalence: [
      "prolog/original/cnf_dnf_mimi.pl",
      "prolog/original/canonical.pl",
      "prolog/original/minimal.pl",
      "prolog/original/truth_table.pl",
      "prolog/original/equivalence.pl"
    ],
    prenex: [
      "prolog/original/prenex.pl"
    ],
    skolemSteps: [
      "prolog/original/prenex.pl",
      "prolog/original/skolem.pl"
    ]
  };

  const TAU_COMPAT_PRELUDE = `
  :- dynamic(tau_nb_store/2).

  nb_setval(Key, Value) :- retractall(tau_nb_store(Key, _)), assertz(tau_nb_store(Key, Value)).
  nb_getval(Key, Value) :- tau_nb_store(Key, Value).

  append([], Ys, Ys).
  append([X|Xs], Ys, [X|Zs]) :- append(Xs, Ys, Zs).

  member(X, [X|_]).
  member(X, [_|Xs]) :- member(X, Xs).
  memberchk(X, Xs) :- member(X, Xs), !.

  char_type(C, alpha) :- atom_codes(C, [Code]), Code >= 65, Code =< 90.
  char_type(C, alpha) :- atom_codes(C, [Code]), Code >= 97, Code =< 122.
  char_type(C, alnum) :- char_type(C, alpha).
  char_type(C, alnum) :- atom_codes(C, [Code]), Code >= 48, Code =< 57.

  length([], 0).
  length([_|Xs], N) :- length(Xs, N0), N is N0 + 1.

  nth1(1, [X|_], X) :- !.
  nth1(N, [_|Xs], X) :-
    N > 1,
    N0 is N - 1,
    nth1(N0, Xs, X).

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

  original_runtime_truth_table(Ast, Vars, result(VarNames, Rows, Mdnf, Mcnf, Props)) :-
    maplist(varterm_to_name, Vars, VarNames),
    minimize_formula(dnf, Ast, Mdnf),
    minimize_formula(cnf, Ast, Mcnf),
    length(Vars, N),
    generate_bit_patterns(N, Patterns),
    maplist(truth_table_row(Ast, Vars, Mdnf, Mcnf), Patterns, Rows),
    truth_table_props(Rows, true, true, Mdnf, Mcnf, Props).

  original_runtime_equivalence(AstA, AstB, Vars, result(VarNames, Rows, Equivalent, Counterexample)) :-
    maplist(varterm_to_name, Vars, VarNames),
    length(Vars, N),
    generate_bit_patterns(N, Patterns),
    maplist(equivalence_row(AstA, AstB, Vars), Patterns, Rows),
    equivalence_result(Rows, Equivalent, Counterexample).

  original_runtime_prenex(Ast, Pretty) :-
    to_prenex_normal_form(Ast, Pretty).

  original_runtime_skolem_steps(Ast, result(PrenexPretty, SkolemPretty)) :-
    to_prenex_normal_form(Ast, PrenexPretty),
    reset_skolem_counter,
    skolem_walk(PrenexPretty, [], SkolemPretty).
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
      .replace(/atom_concat\('x',\s*N1,\s*V\)\./g, "number_atom(N1, N1Atom), atom_concat('x', N1Atom, V).")
      .replace(/atomic_list_concat\(\[Old,\s*'_',\s*N1\],\s*New\)\./g, "number_atom(N1, N1Atom), atomic_list_concat([Old, '_', N1Atom], New).")
      .replace(/atomic_list_concat\(\[sk,\s*'_',\s*N1\],\s*Sk\)\./g, "number_atom(N1, N1Atom), atomic_list_concat([sk, '_', N1Atom], Sk).");
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

  function termToProlog(term) {
    if (term.kind === "var") return `var(${atom(term.name)})`;
    if (term.kind === "const") return `const(${atom(term.name)})`;
    if (term.kind === "func") return `func(${atom(term.name)}, [${term.args.map(termToProlog).join(", ")}])`;
    throw new Error(`Unsupported predicate term: ${term.kind}`);
  }

  function predicateExprToTerm(node) {
    if (node.op === "pred") return `pred(${atom(node.name)}, [${node.args.map(termToProlog).join(", ")}])`;
    if (node.op === "var") return `var(${atom(node.value)})`;
    if (node.op === "not") return `not(${predicateExprToTerm(node.left)})`;
    if (node.op === "forall" || node.op === "exists") return `${node.op}(var(${atom(node.variable)}), ${predicateExprToTerm(node.body)})`;
    if (["and", "or", "imp", "iff"].includes(node.op)) return `${node.op}(${predicateExprToTerm(node.left)}, ${predicateExprToTerm(node.right)})`;
    throw new Error(`Unsupported predicate formula node: ${node.op}`);
  }

  function filesFor(method) {
    return METHOD_PROLOG_FILES[method] || [];
  }

  function parsePrologData(text) {
    const source = String(text).trim();
    let i = 0;
    function skip() { while (/\s/.test(source[i] || "")) i += 1; }
    function readAtom() {
      skip();
      if (source[i] === "'") {
        i += 1;
        let out = "";
        while (i < source.length) {
          if (source[i] === "'" && source[i + 1] === "'") { out += "'"; i += 2; continue; }
          if (source[i] === "'") { i += 1; return out; }
          out += source[i++];
        }
        throw new Error("Unterminated quoted Prolog atom.");
      }
      const number = source.slice(i).match(/^-?\d+(?:\.\d+)?/);
      if (number) {
        i += number[0].length;
        return Number(number[0]);
      }
      const ident = source.slice(i).match(/^[A-Za-z_][A-Za-z0-9_]*/);
      if (!ident) throw new Error(`Expected Prolog data near: ${source.slice(i)}`);
      i += ident[0].length;
      return ident[0];
    }
    function parseList() {
      i += 1;
      const items = [];
      skip();
      if (source[i] === "]") { i += 1; return items; }
      while (true) {
        items.push(parse());
        skip();
        if (source[i] === ",") {
          i += 1;
          skip();
          if (source[i] === "]") { items.push(""); i += 1; return items; }
          continue;
        }
        if (source[i] === "]") { i += 1; return items; }
        throw new Error("Expected ',' or ']' in Prolog list.");
      }
    }
    function parse() {
      skip();
      if (source[i] === "[") return parseList();
      const name = readAtom();
      skip();
      if (source[i] !== "(") return name;
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
      return { functor: name, args };
    }
    const out = parse();
    skip();
    if (i !== source.length) throw new Error(`Trailing Prolog data text: ${source.slice(i)}`);
    return out;
  }

  function dataToExpr(data) {
    if (data === "true") return global.LogicEngine.c(true);
    if (data === "false") return global.LogicEngine.c(false);
    if (typeof data === "string") return global.LogicEngine.v(data);
    if (!data || typeof data !== "object" || !data.functor) throw new Error("Expected Prolog formula term.");
    const { functor, args } = data;
    if (functor === "var") return global.LogicEngine.v(String(args[0]));
    if (functor === "not") return global.LogicEngine.not(dataToExpr(args[0]));
    if (["and", "or", "imp", "iff"].includes(functor)) {
      if (!args.length) throw new Error(`Unsupported empty ${functor} term.`);
      return args.slice(1).reduce((acc, arg) => global.LogicEngine.bin(functor, acc, dataToExpr(arg)), dataToExpr(args[0]));
    }
    throw new Error(`Unsupported Prolog formula term: ${functor}/${args.length}`);
  }

  function dataToPredicateTerm(data) {
    if (!data || typeof data !== "object" || !data.functor) throw new Error("Expected Prolog predicate term.");
    if (data.functor === "var") return { kind: "var", name: String(data.args[0]) };
    if (data.functor === "const") return { kind: "const", name: String(data.args[0]) };
    if (data.functor === "func") return { kind: "func", name: String(data.args[0]), args: data.args[1].map(dataToPredicateTerm) };
    throw new Error(`Unsupported predicate term: ${data.functor}/${data.args.length}`);
  }

  function dataToPredicateNode(data) {
    if (!data || typeof data !== "object" || !data.functor) throw new Error("Expected Prolog predicate formula.");
    const { functor, args } = data;
    if (functor === "pred") return { op: "pred", name: String(args[0]), args: args[1].map(dataToPredicateTerm) };
    if (functor === "var") return { op: "var", value: String(args[0]) };
    if (functor === "not") return global.LogicEngine.not(dataToPredicateNode(args[0]));
    if (functor === "forall" || functor === "exists") return { op: functor, variable: String(args[0].args[0]), body: dataToPredicateNode(args[1]) };
    if (["and", "or", "imp", "iff"].includes(functor)) return global.LogicEngine.bin(functor, dataToPredicateNode(args[0]), dataToPredicateNode(args[1]));
    throw new Error(`Unsupported predicate formula term: ${functor}/${args.length}`);
  }

  function predicateDataPretty(data) {
    return global.LogicEngine.normalizeFormulaInput(global.LogicEngine.predPretty(dataToPredicateNode(data)));
  }

  function dataText(data) {
    if (data === null || data === undefined) return "";
    if (typeof data === "string" || typeof data === "number" || typeof data === "boolean") return String(data);
    if (Array.isArray(data)) return data.map(dataText).join(", ");
    if (data.functor === "Satisfiable" && data.args?.[0] === "contingent") return "Satisfiable (contingent)";
    if (data.functor) return `${data.functor}${data.args?.length ? `(${data.args.map(dataText).join(", ")})` : ""}`;
    return String(data);
  }

  function prologBool(value) {
    return value === true || value === "true";
  }

  function parsePrologExpr(text) {
    return dataToExpr(parsePrologData(text));
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

  async function queryData(goal) {
    const ok = await init();
    if (!ok || !session) throw new Error(lastError || "Tau Prolog initialization failed.");
    const formatted = await queryOnce(goal);
    return parsePrologData(answerValue(formatted));
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

  async function tokenize(formula) {
    const data = await queryData(`tokenize(${atom(global.LogicEngine.normalizeFormulaForAscii(formula))}, Out).`);
    return `[${data.map((token) => {
      if (token?.functor === "var") return `var(${token.args[0]})`;
      return String(token);
    }).join(", ")}]`;
  }

  async function truthTableBundle(formula) {
    const expr = global.LogicEngine.parseFormula(formula);
    const vars = global.LogicEngine.variablesOf(expr);
    const result = await queryData(`original_runtime_truth_table(${exprToTerm(expr)}, ${variablesToPrologList(vars)}, Out).`);
    if (!result || result.functor !== "result") throw new Error("Unexpected Prolog truth-table result.");
    const [varNames, rawRows, mdnfAst, mcnfAst, propsList] = result.args;
    const columns = [...varNames.map(String), "F", "MDNF", "MCNF"];
    const rows = rawRows.map((rawRow) => {
      const row = {};
      columns.forEach((column, index) => { row[column] = String(rawRow[index]); });
      return row;
    });
    const mdnf = global.LogicEngine.prettyExpr(dataToExpr(mdnfAst));
    const mcnf = global.LogicEngine.prettyExpr(dataToExpr(mcnfAst));
    const props = {
      classification: dataText(propsList[0]),
      is_tautology: prologBool(propsList[1]),
      is_contradiction: prologBool(propsList[2]),
      is_satisfiable: prologBool(propsList[3]),
      equivalent_mdnf_mcnf: prologBool(propsList[4]),
      minimal_available: prologBool(propsList[5]) && prologBool(propsList[6]),
      minimal_any_available: prologBool(propsList[5]) || prologBool(propsList[6]),
      mdnf_available: prologBool(propsList[5]),
      mcnf_available: prologBool(propsList[6]),
      minimal_message: dataText(propsList[7])
    };
    return [rows, mdnf, mcnf, props];
  }

  async function equivalence(formulaA, formulaB) {
    const exprA = global.LogicEngine.parseFormula(formulaA);
    const exprB = global.LogicEngine.parseFormula(formulaB);
    const vars = [...new Set([...global.LogicEngine.variablesOf(exprA), ...global.LogicEngine.variablesOf(exprB)])].sort();
    const result = await queryData(`original_runtime_equivalence(${exprToTerm(exprA)}, ${exprToTerm(exprB)}, ${variablesToPrologList(vars)}, Out).`);
    if (!result || result.functor !== "result") throw new Error("Unexpected Prolog equivalence result.");
    const [varNames, rawRows, equivalent] = result.args;
    const columns = [...varNames.map(String), "Formula 1", "Formula 2"];
    const rows = rawRows.map((rawRow) => {
      const row = {};
      columns.forEach((column, index) => { row[column] = String(rawRow[index]); });
      return row;
    });
    return {
      equivalent: prologBool(equivalent),
      variables: varNames.map(String),
      columns,
      rows,
      counterexample: rows.find((row) => row["Formula 1"] !== row["Formula 2"]) || null
    };
  }

  async function prenex(formula) {
    const expr = global.LogicEngine.parsePredicateFormula(formula);
    const data = await queryData(`original_runtime_prenex(${predicateExprToTerm(expr)}, Out).`);
    return predicateDataPretty(data);
  }

  async function skolemSteps(formula) {
    const expr = global.LogicEngine.parsePredicateFormula(formula);
    const result = await queryData(`original_runtime_skolem_steps(${predicateExprToTerm(expr)}, Out).`);
    if (!result || result.functor !== "result") throw new Error("Unexpected Prolog Skolem result.");
    return result.args.map(predicateDataPretty);
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
    tokenize,
    truthTableBundle,
    equivalence,
    prenex,
    skolemSteps,
    smoke,
    filesFor,
    get lastError() { return lastError; },
    get loadedSource() { return loadedSource; }
  };
})(typeof globalThis !== "undefined" ? globalThis : window);
