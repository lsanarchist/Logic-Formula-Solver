(() => {
  "use strict";

  const L = window.LogicEngine;
  const ACTIONS = {
    propositional: [
      { id: "analyze", label: "Analyze" },
      { id: "cnf", label: "CNF" },
      { id: "dnf", label: "DNF" },
      { id: "canonical_cnf", label: "Canon. CNF" },
      { id: "canonical_dnf", label: "Canon. DNF" },
      { id: "minimal_cnf", label: "Minimal CNF" },
      { id: "minimal_dnf", label: "Minimal DNF" },
      { id: "truth_table", label: "Truth Table" },
      { id: "equivalence", label: "Equivalence" },
      { id: "tree", label: "Formula Tree" },
      { id: "tseitin", label: "Tseitin" }
    ],
    predicate: [
      { id: "predicate_tree", label: "Formula Tree" },
      { id: "prenex", label: "Prenex form" },
      { id: "skolem", label: "Skolem form" }
    ]
  };

  const DEFAULTS = {
    propositional: "A->B",
    predicate: "∀ x. (P(x) ⇒ ∃ y. Q(y))",
    formulaB: "¬A ∨ B"
  };
  const EXPENSIVE_THRESHOLDS = {
    minimal: 10,
    truthTable: 12,
    equivalence: 12,
    karnaughMap: 6
  };

  let state = {
    logicMode: "propositional",
    activeAction: null,
    formula: DEFAULTS.propositional,
    formulaB: DEFAULTS.formulaB,
    busy: false
  };

  const els = {};

  function $(id) { return document.getElementById(id); }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function formulaHighlight(value) {
    const text = String(value ?? "");
    const re = /<->|->|=>|⇒|⇔|↔|→|[~¬!&∧|∨]|\(|\)|⊤|⊥|[A-Za-z_][A-Za-z0-9_]*/g;
    const operators = new Set(["<->", "->", "=>", "⇒", "⇔", "↔", "→", "~", "¬", "!", "&", "∧", "|", "∨"]);
    let last = 0;
    let html = "";
    for (const match of text.matchAll(re)) {
      if (match.index > last) html += escapeHtml(text.slice(last, match.index));
      const token = match[0];
      const lower = token.toLowerCase();
      const cls = operators.has(token) ? "syntax-op" : token === "(" || token === ")" ? "syntax-punct" : token === "⊤" || token === "⊥" || lower === "true" || lower === "false" ? "syntax-const" : "syntax-var";
      html += `<span class="${cls}">${escapeHtml(token)}</span>`;
      last = match.index + token.length;
    }
    if (last < text.length) html += escapeHtml(text.slice(last));
    return html;
  }

  function jsonScript(className, data) {
    const json = JSON.stringify(data)
      .replace(/</g, "\\u003c")
      .replace(/>/g, "\\u003e")
      .replace(/&/g, "\\u0026")
      .replace(/\u2028/g, "\\u2028")
      .replace(/\u2029/g, "\\u2029");
    return `<script type="application/json" class="${className}">${json}</script>`;
  }

  function init() {
    els.formula = $("formula");
    els.formulaB = $("formula_b");
    els.compareRow = $("compare-row");
    els.actionGrid = $("action-grid");
    els.resultRoot = $("result-root");
    els.logicTabs = Array.from(document.querySelectorAll("[data-logic-mode]"));
    els.randomButton = $("random-formula");
    els.statusPill = $("status-pill");

    els.formula.value = state.formula;
    els.formulaB.value = state.formulaB;
    renderMode();
    renderActions();
    updateCompareVisibility();

    els.formula.addEventListener("input", () => { state.formula = els.formula.value; });
    els.formulaB.addEventListener("input", () => { state.formulaB = els.formulaB.value; });

    els.logicTabs.forEach((button) => {
      button.addEventListener("click", () => {
        const mode = button.dataset.logicMode;
        if (!ACTIONS[mode]) return;
        state.logicMode = mode;
        state.activeAction = null;
        state.formula = mode === "predicate" ? DEFAULTS.predicate : DEFAULTS.propositional;
        els.formula.value = state.formula;
        renderMode();
        renderActions();
        updateCompareVisibility();
        hideResult();
      });
    });

    els.randomButton.addEventListener("click", () => {
      state.formula = L.generateRandomFormula();
      els.formula.value = state.formula;
      hideResult();
    });

    function handleEnter(event) {
      if (event.key !== "Enter" || event.shiftKey || event.ctrlKey || event.altKey || event.metaKey) return;
      const popup = $("shortcut-popup");
      if (popup?.classList.contains("visible")) return;
      event.preventDefault();
      const fallback = event.currentTarget === els.formulaB ? "equivalence" : "analyze";
      runAction(state.activeAction || fallback);
    }
    els.formula.addEventListener("keydown", handleEnter);
    els.formulaB.addEventListener("keydown", handleEnter);

    if (window.LogicPrologRuntime) {
      window.LogicPrologRuntime.smoke().then((ok) => {
        els.statusPill.textContent = ok ? "Static JS + Tau Prolog" : "Static JS";
      });
    }
  }

  function renderMode() {
    els.logicTabs.forEach((button) => {
      const active = button.dataset.logicMode === state.logicMode;
      button.classList.toggle("active", active);
      button.setAttribute("aria-selected", active ? "true" : "false");
    });
    document.querySelector(".formula-row")?.classList.toggle("predicate-mode", state.logicMode === "predicate");
    els.formula.placeholder = state.logicMode === "predicate" ? DEFAULTS.predicate : "A -> B";
    els.randomButton.hidden = state.logicMode !== "propositional";
  }

  function renderActions() {
    els.actionGrid.innerHTML = ACTIONS[state.logicMode].map((action) => `
      <button type="button" data-action="${action.id}" class="tool-action${state.activeAction === action.id ? " active" : ""}">
        ${escapeHtml(action.label)}
      </button>
    `).join("");
    els.actionGrid.querySelectorAll("[data-action]").forEach((button) => {
      button.addEventListener("click", () => runAction(button.dataset.action));
    });
  }

  function updateCompareVisibility() {
    els.compareRow.hidden = !(state.logicMode === "propositional" && state.activeAction === "equivalence");
  }

  function assignmentCountLabel(variableCount) {
    const total = 2 ** variableCount;
    return Number.isSafeInteger(total) ? total.toLocaleString() : `2^${variableCount}`;
  }

  function variableCountForFormula(formula) {
    return L.variablesOf(L.parseFormula(L.normalizeFormulaInput(formula))).length;
  }

  function combinedVariableCount(formulaA, formulaB) {
    const exprA = L.parseFormula(L.normalizeFormulaInput(formulaA));
    const exprB = L.parseFormula(L.normalizeFormulaInput(formulaB));
    return [...new Set([...L.variablesOf(exprA), ...L.variablesOf(exprB)])].length;
  }

  function confirmExpensiveAction(action) {
    if (state.logicMode !== "propositional") return true;
    const warnings = [];
    try {
      const formula = els.formula.value;
      const formulaB = els.formulaB.value || DEFAULTS.formulaB;
      if (action === "minimal_cnf" || action === "minimal_dnf" || action === "truth_table") {
        const count = variableCountForFormula(formula);
        if ((action === "minimal_cnf" || action === "minimal_dnf") && count > EXPENSIVE_THRESHOLDS.minimal) {
          warnings.push(`Minimal form generation for ${count} variables may inspect up to ${assignmentCountLabel(count)} assignments.`);
        }
        if ((action === "minimal_cnf" || action === "minimal_dnf") && count > EXPENSIVE_THRESHOLDS.karnaughMap) {
          warnings.push(`The Karnaugh map for ${count} variables will contain ${assignmentCountLabel(count)} cells.`);
        }
        if (action === "truth_table" && count > EXPENSIVE_THRESHOLDS.truthTable) {
          warnings.push(`The truth table for ${count} variables will contain ${assignmentCountLabel(count)} rows.`);
        }
        if (action === "truth_table" && count > EXPENSIVE_THRESHOLDS.minimal) {
          warnings.push(`Truth table output also computes MDNF and MCNF, which may be slow for ${count} variables.`);
        }
      }
      if (action === "equivalence") {
        const count = combinedVariableCount(formula, formulaB);
        if (count > EXPENSIVE_THRESHOLDS.equivalence) {
          warnings.push(`The equivalence table for ${count} variables will contain ${assignmentCountLabel(count)} rows.`);
        }
      }
    } catch {
      return true;
    }
    if (!warnings.length) return true;
    return window.confirm(`Warning: this operation may be slow or freeze the browser tab.\n\n${warnings.join("\n")}\n\nContinue anyway?`);
  }

  function hideResult() {
    els.resultRoot.hidden = true;
    els.resultRoot.innerHTML = "";
  }

  function setBusy(busy) {
    state.busy = busy;
    els.actionGrid.querySelectorAll("button").forEach((button) => { button.disabled = busy; });
    els.randomButton.disabled = busy;
    document.body.classList.toggle("is-busy", busy);
  }

  async function runAction(action) {
    if (state.busy) return;
    state.formula = els.formula.value;
    state.formulaB = els.formulaB.value;
    state.activeAction = action;
    renderActions();
    updateCompareVisibility();
    if (!confirmExpensiveAction(action)) return;
    setBusy(true);
    showLoading(action);
    try {
      const result = await buildResult(action);
      renderResult(result);
    } catch (err) {
      renderError(err.message || String(err));
    } finally {
      setBusy(false);
    }
  }

  function showLoading(action) {
    const label = ACTIONS[state.logicMode].find((item) => item.id === action)?.label || "Result";
    els.resultRoot.hidden = false;
    els.resultRoot.innerHTML = `
      <section class="result-panel">
        <div class="result-head">
          <p class="eyebrow">Computing</p>
          <h2>${escapeHtml(label)}</h2>
        </div>
        <div class="notice">Working in the browser…</div>
      </section>
    `;
  }

  async function prologTransformOrFallback(kind, fallback) {
    if (window.LogicPrologRuntime) {
      try {
        return await window.LogicPrologRuntime.transform(kind, state.formula);
      } catch (err) {
        console.warn("Tau Prolog fallback used:", err);
      }
    }
    return fallback();
  }

  async function buildResult(action) {
    const formula = L.normalizeFormulaInput(state.formula);
    const formulaB = L.normalizeFormulaInput(state.formulaB || DEFAULTS.formulaB);
    state.formula = formula;
    state.formulaB = formulaB;
    els.formula.value = formula;
    els.formulaB.value = formulaB;

    if (state.logicMode === "propositional") {
      if (action === "analyze") {
        const [tokens, ast] = L.analyzeFormula(formula);
        return { kind: "sections", title: "Analysis", sections: [{ title: "Tokens", body: tokens }, { title: "AST", body: ast }] };
      }
      if (action === "cnf") return formulaResult("CNF Result", await prologTransformOrFallback("cnf", () => L.cnfFormula(formula)));
      if (action === "dnf") return formulaResult("DNF Result", await prologTransformOrFallback("dnf", () => L.dnfFormula(formula)));
      if (action === "canonical_cnf") return formulaResult("Canonical CNF Result", L.canonicalCNFFormula(formula));
      if (action === "canonical_dnf") return formulaResult("Canonical DNF Result", L.canonicalDNFFormula(formula));
      if (action === "minimal_cnf") {
        const formulaText = L.minimalCNFFormula(formula);
        return { kind: "normal_form", title: "Minimal CNF Result", formula: formulaText, normal_form: "cnf", ...L.normalFormDetails(formulaText, "cnf", formula) };
      }
      if (action === "minimal_dnf") {
        const formulaText = L.minimalDNFFormula(formula);
        return { kind: "normal_form", title: "Minimal DNF Result", formula: formulaText, normal_form: "dnf", ...L.normalFormDetails(formulaText, "dnf", formula) };
      }
      if (action === "truth_table") {
        const [rows, mdnf, mcnf, props] = L.truthTableBundle(formula);
        return { kind: "truth_table", title: "Truth Table", rows, columns: rows.length ? Object.keys(rows[0]) : [], mdnf, mcnf, props };
      }
      if (action === "equivalence") {
        const report = L.logicalEquivalenceReport(formula, formulaB);
        return { kind: "equivalence", title: "Logical Equivalence", formula_a: formula, formula_b: formulaB, ...report };
      }
      if (action === "tree") return { kind: "tree", title: "Formula Tree", tree: L.formulaTree(formula), legend_variant: "formula", node_info: {}, show_info_panel: false };
      if (action === "tseitin") {
        const [tree, fullFormula, nodeInfo] = L.tseitinTransform(formula);
        return { kind: "tseitin", title: "Tseitin Transformation", formula: fullFormula, clauses: L.splitTopLevelConjunction(fullFormula), tree, legend_variant: "tseitin", node_info: nodeInfo, show_info_panel: true };
      }
    } else {
      if (action === "predicate_tree") return { kind: "tree", title: "Predicate Formula Tree", tree: L.predicateFormulaTree(formula), legend_variant: "formula", node_info: {}, show_info_panel: false };
      if (action === "prenex") return formulaResult("Prenex Form", L.prenexFormula(formula));
      if (action === "skolem") {
        const [prenex, skolem] = L.skolemStepsPretty(formula);
        const notices = [];
        if (!L.predicateFormulaHasQuantifiers(formula)) notices.push("This formula does not contain quantifiers, so Skolem normal form is trivial here.");
        return { kind: "sections", title: "Skolem Normal Form", sections: [{ title: "Prenex", body: prenex }, { title: "Skolem", body: skolem }], notices };
      }
    }
    return null;
  }

  function formulaResult(title, value) { return { kind: "formula", title, formula: value }; }

  function renderError(message) {
    els.resultRoot.hidden = false;
    els.resultRoot.innerHTML = `
      <section class="result-panel">
        <div class="result-head">
          <p class="eyebrow">Error</p>
          <h2>Could not compute result</h2>
        </div>
        <div class="notice error">${escapeHtml(message)}</div>
      </section>
    `;
  }

  function renderResult(result) {
    if (!result) { hideResult(); return; }
    els.resultRoot.hidden = false;
    els.resultRoot.innerHTML = `
      <section class="result-panel">
        <div class="result-head">
          <p class="eyebrow">Result</p>
          <h2>${escapeHtml(result.title)}</h2>
        </div>
        ${renderResultBody(result)}
      </section>
    `;
    queueMicrotask(() => {
      window.renderFormulaTrees?.();
      window.renderKarnaughMaps?.();
    });
  }

  function renderResultBody(result) {
    if (result.notices?.length) {
      return `${result.notices.map((notice) => `<div class="notice">${escapeHtml(notice)}</div>`).join("")}${renderResultBody({ ...result, notices: [] })}`;
    }
    if (result.kind === "formula") return renderFormulaSection(result.formula);
    if (result.kind === "sections") return result.sections.map((section) => `
      <div class="result-section">
        <h3>${escapeHtml(section.title)}</h3>
        <pre class="code-block"><code>${escapeHtml(section.body)}</code></pre>
      </div>
    `).join("");
    if (result.kind === "normal_form") return renderNormalForm(result);
    if (result.kind === "truth_table") return renderTruthTable(result);
    if (result.kind === "equivalence") return renderEquivalence(result);
    if (result.kind === "tree") return renderTree(result);
    if (result.kind === "tseitin") return renderTseitin(result);
    return "";
  }

  function renderFormulaSection(formula) {
    return `
      <div class="result-section">
        <h3>Output</h3>
        <pre class="code-block formula-code"><code>${formulaHighlight(formula)}</code></pre>
      </div>
    `;
  }

  function renderNormalForm(result) {
    let html = renderFormulaSection(result.formula);
    if (result.summary) {
      html += `
        <div class="result-section">
          <h3>Structure</h3>
          <div class="metric-strip">
            <div class="metric"><span>${escapeHtml(result.summary.row_label)}</span><strong>${escapeHtml(result.summary.group_count)}</strong></div>
            <div class="metric"><span>Literals</span><strong>${escapeHtml(result.summary.literal_count)}</strong></div>
            <div class="metric"><span>Variables</span><strong>${escapeHtml(result.summary.variable_count)}</strong></div>
            <div class="metric"><span>Join</span><strong>${escapeHtml(result.summary.join_symbol)}</strong></div>
          </div>
          <p class="muted-line">Variables: ${escapeHtml(result.summary.variables)}</p>
        </div>
      `;
    }
    if (result.rows?.length) {
      html += renderTableSection("Breakdown", Object.keys(result.rows[0]), result.rows);
    } else if (result.table_error) {
      html += `<div class="notice">${escapeHtml(result.table_error)}</div>`;
    }
    if (result.karnaugh_map) {
      html += `
        <div class="result-section">
          <h3>Karnaugh Map</h3>
          <div class="kmap" data-title="${escapeHtml(result.title)}">
            ${jsonScript("kmap-data", result.karnaugh_map)}
          </div>
        </div>
      `;
    } else if (result.karnaugh_error) {
      html += `<div class="notice">${escapeHtml(result.karnaugh_error)}</div>`;
    }
    return html;
  }

  function renderTruthTable(result) {
    let html = result.rows?.length ? renderTableSection("Rows", result.columns, result.rows) : "";
    html += `
      <div class="result-section">
        <h3>Summary</h3>
        <div class="metric-strip">
          <div class="metric wide"><span>Classification</span><strong>${escapeHtml(result.props.classification)}</strong></div>
          <div class="metric"><span>Tautology</span><strong>${result.props.is_tautology ? "True" : "False"}</strong></div>
          <div class="metric"><span>Contradiction</span><strong>${result.props.is_contradiction ? "True" : "False"}</strong></div>
          <div class="metric"><span>Satisfiable</span><strong>${result.props.is_satisfiable ? "True" : "False"}</strong></div>
        </div>
      </div>
    `;
    if (result.props.mdnf_available) html += `<div class="result-section"><h3>MDNF</h3><pre class="code-block formula-code"><code>${formulaHighlight(result.mdnf)}</code></pre></div>`;
    if (result.props.mcnf_available) html += `<div class="result-section"><h3>MCNF</h3><pre class="code-block formula-code"><code>${formulaHighlight(result.mcnf)}</code></pre></div>`;
    if (!result.props.minimal_any_available) html += `<div class="notice">${escapeHtml(result.props.minimal_message)}</div>`;
    return html;
  }

  function renderEquivalence(result) {
    let html = `
      <div class="result-section">
        <h3>Conclusion</h3>
        <div class="metric-strip">
          <div class="metric wide"><span>Equivalent</span><strong>${result.equivalent ? "True" : "False"}</strong></div>
          <div class="metric wide"><span>Variables</span><strong>${escapeHtml(result.variables.length ? result.variables.join(", ") : "-")}</strong></div>
        </div>
      </div>
      <div class="result-section">
        <h3>Formulas</h3>
        <div class="equivalence-pair">
          <pre class="code-block formula-code"><code>${formulaHighlight(result.formula_a)}</code></pre>
          <pre class="code-block formula-code"><code>${formulaHighlight(result.formula_b)}</code></pre>
        </div>
      </div>
    `;
    if (result.counterexample) {
      html += `<div class="notice error">Counterexample: ${Object.entries(result.counterexample).map(([k, v]) => `${escapeHtml(k)}=${escapeHtml(v)}`).join(", ")}</div>`;
    }
    if (result.rows?.length) html += renderTableSection("Comparison Table", result.columns, result.rows, result.counterexample);
    return html;
  }

  function renderTree(result) {
    return `
      <div class="result-section">
        <h3>Visualization</h3>
        <div class="tree-visual" data-legend="${escapeHtml(result.legend_variant)}" data-show-info="${result.show_info_panel ? "true" : "false"}">
          ${jsonScript("tree-data", result.tree)}
          ${jsonScript("tree-info", result.node_info || {})}
        </div>
      </div>
    `;
  }

  function renderTseitin(result) {
    return `
      <div class="result-section">
        <h3>Output Clauses</h3>
        <div class="clause-list" aria-label="Tseitin output clauses">
          ${result.clauses.map((clause, index) => `
            <div class="clause-row">
              <span class="clause-index">C${index + 1}</span>
              <code class="clause-expression formula-code">${formulaHighlight(clause)}</code>
            </div>
          `).join("")}
        </div>
        <details class="raw-output">
          <summary>Raw Prolog-style output</summary>
          <pre class="code-block wrap formula-code"><code>${formulaHighlight(result.formula)}</code></pre>
        </details>
      </div>
      <div class="result-section">
        <h3>Annotated Tree</h3>
        <div class="tree-visual compact" data-legend="${escapeHtml(result.legend_variant)}" data-show-info="${result.show_info_panel ? "true" : "false"}">
          ${jsonScript("tree-data", result.tree)}
          ${jsonScript("tree-info", result.node_info || {})}
        </div>
      </div>
    `;
  }

  function renderTableSection(title, columns, rows, highlightRow = null) {
    return `
      <div class="result-section">
        <h3>${escapeHtml(title)}</h3>
        <div class="table-wrap">
          <table>
            <thead><tr>${columns.map((column) => `<th>${escapeHtml(column)}</th>`).join("")}</tr></thead>
            <tbody>
              ${rows.map((row) => {
                const isHighlight = highlightRow && JSON.stringify(row) === JSON.stringify(highlightRow);
                return `<tr${isHighlight ? " class=\"counterexample-row\"" : ""}>${columns.map((column) => `<td>${escapeHtml(row[column])}</td>`).join("")}</tr>`;
              }).join("")}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  document.addEventListener("DOMContentLoaded", init);
})();
