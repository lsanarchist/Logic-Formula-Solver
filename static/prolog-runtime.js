(function (global) {
  "use strict";

  const PROGRAM = `
  eliminate_arrows(var(X), var(X)).
  eliminate_arrows(true, true).
  eliminate_arrows(false, false).
  eliminate_arrows(not(A), not(NA)) :- eliminate_arrows(A, NA).
  eliminate_arrows(and(A, B), and(NA, NB)) :- eliminate_arrows(A, NA), eliminate_arrows(B, NB).
  eliminate_arrows(or(A, B), or(NA, NB)) :- eliminate_arrows(A, NA), eliminate_arrows(B, NB).
  eliminate_arrows(imp(A, B), or(not(NA), NB)) :- eliminate_arrows(A, NA), eliminate_arrows(B, NB).
  eliminate_arrows(iff(A, B), and(or(not(NA), NB), or(not(NB), NA))) :- eliminate_arrows(A, NA), eliminate_arrows(B, NB).

  to_nnf(var(X), var(X)).
  to_nnf(true, true).
  to_nnf(false, false).
  to_nnf(not(true), false).
  to_nnf(not(false), true).
  to_nnf(not(var(X)), not(var(X))).
  to_nnf(not(not(A)), NNA) :- to_nnf(A, NNA).
  to_nnf(not(and(A, B)), or(NA, NB)) :- to_nnf(not(A), NA), to_nnf(not(B), NB).
  to_nnf(not(or(A, B)), and(NA, NB)) :- to_nnf(not(A), NA), to_nnf(not(B), NB).
  to_nnf(and(A, B), and(NA, NB)) :- to_nnf(A, NA), to_nnf(B, NB).
  to_nnf(or(A, B), or(NA, NB)) :- to_nnf(A, NA), to_nnf(B, NB).

  distribute_or_over_and(var(X), var(X)).
  distribute_or_over_and(true, true).
  distribute_or_over_and(false, false).
  distribute_or_over_and(not(var(X)), not(var(X))).
  distribute_or_over_and(and(A, B), and(DA, DB)) :- distribute_or_over_and(A, DA), distribute_or_over_and(B, DB).
  distribute_or_over_and(or(A, B), Out) :- distribute_or_over_and(A, DA), distribute_or_over_and(B, DB), distribute_or(DA, DB, Out).
  distribute_or(and(A, C), B, and(X, Y)) :- !, distribute_or(A, B, X), distribute_or(C, B, Y).
  distribute_or(A, and(B, C), and(X, Y)) :- !, distribute_or(A, B, X), distribute_or(A, C, Y).
  distribute_or(true, _, true) :- !.
  distribute_or(_, true, true) :- !.
  distribute_or(false, B, B) :- !.
  distribute_or(A, false, A) :- !.
  distribute_or(A, B, or(A, B)).

  to_cnf(Ast, Cnf) :- eliminate_arrows(Ast, S1), to_nnf(S1, S2), distribute_or_over_and(S2, Cnf).
  to_dnf(Ast, Dnf) :- to_cnf(not(Ast), CnfNotAst), to_nnf(not(CnfNotAst), Dnf).
  `;

  let session = null;
  let readyPromise = null;
  let lastError = null;

  function init() {
    if (readyPromise) return readyPromise;
    readyPromise = new Promise((resolve) => {
      if (!global.pl || !global.LogicEngine) {
        lastError = "Tau Prolog is not available.";
        resolve(false);
        return;
      }
      try {
        session = global.pl.create(100000);
        session.consult(PROGRAM, {
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
    });
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
      if (["and", "or", "imp", "iff"].includes(name)) return global.LogicEngine.bin(name, args[0], args[1]);
      throw new Error(`Unsupported Prolog term: ${name}/${args.length}`);
    }
    const expr = parse();
    skip();
    if (i !== source.length) throw new Error(`Trailing Prolog term text: ${source.slice(i)}`);
    return expr;
  }

  async function transform(kind, formula) {
    const ok = await init();
    if (!ok || !session) throw new Error(lastError || "Tau Prolog initialization failed.");
    const expr = global.LogicEngine.parseFormula(formula);
    const predicate = kind === "dnf" ? "to_dnf" : "to_cnf";
    const goal = `${predicate}(${exprToTerm(expr)}, Out).`;
    return new Promise((resolve, reject) => {
      session.query(goal, {
        success: () => {
          session.answer((answer) => {
            if (!answer) { reject(new Error("Tau Prolog returned no answer.")); return; }
            const formatted = session.format_answer(answer);
            const rhs = String(formatted).replace(/^Out\s*=\s*/, "").trim();
            try {
              resolve(global.LogicEngine.prettyExpr(parsePrologExpr(rhs)));
            } catch (err) {
              reject(err);
            }
          });
        },
        error: (err) => reject(new Error(String(err?.toString ? err.toString() : err)))
      });
    });
  }

  async function smoke() {
    try {
      const out = await transform("cnf", "A -> B");
      return /A/.test(out) && /B/.test(out);
    } catch {
      return false;
    }
  }

  global.LogicPrologRuntime = { init, transform, smoke, get lastError() { return lastError; } };
})(typeof globalThis !== "undefined" ? globalThis : window);
