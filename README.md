# Logic Formula Solver

Logic Formula Solver is a static web application for working with propositional and predicate logic formulas. It runs entirely in the browser: no Flask app, Python server, or installed SWI-Prolog runtime is required. You can open it locally as a regular HTML page or deploy it directly to GitHub Pages.

Live GitHub Pages site: <https://lsanarchist.github.io/Logic-Formula-Solver/>

The repository also keeps the original Prolog files in `prolog/original/`, but the active browser version is implemented in JavaScript.

## Features

### Propositional Logic

- formula analysis with tokens and AST output;
- CNF and DNF conversion;
- canonical CNF and canonical DNF conversion;
- minimal CNF and minimal DNF conversion;
- truth table generation with formula classification;
- logical equivalence checking for two formulas;
- formula tree visualization;
- Tseitin transformation with generated clauses;
- Karnaugh maps for normal forms;
- random propositional formula generation.

### Predicate Logic

- predicate formula tree visualization;
- prenex form conversion;
- Skolem form conversion.

### Interface

- symbol autocomplete through `/` or `\`;
- theme switcher: system, light, dark;
- action buttons and `Enter` key execution.

## Formula Syntax

The app accepts both logical symbols and ASCII aliases.

| Operation | Symbol | Input examples |
| --- | --- | --- |
| Negation | `¬` | `¬A`, `~A`, `!A`, `\neg A` |
| Conjunction | `∧` | `A ∧ B`, `A & B`, `A and B` |
| Disjunction | `∨` | `A ∨ B`, <code>A &#124; B</code>, `A or B` |
| Implication | `⇒` | `A ⇒ B`, `A -> B`, `A => B` |
| Equivalence | `⇔` | `A ⇔ B`, `A <-> B`, `A iff B` |
| Universal quantifier | `∀` | `∀ x. P(x)`, `forall x. P(x)` |
| Existential quantifier | `∃` | `∃ x. P(x)`, `exists x. P(x)` |
| Truth | `⊤` | `⊤`, `true`, `\top` |
| Falsehood | `⊥` | `⊥`, `false`, `\bot` |

Examples:

```text
A -> B
(A & B) | C
~A <-> B
forall x. (P(x) -> exists y. Q(y))
```

## Usage

Use the published GitHub Pages version:

<https://lsanarchist.github.io/Logic-Formula-Solver/>

For a local preview of the source code, open `index.html` directly in a browser. No local server or build step is required.

## Code Check

The project has no npm dependencies. Use this command to run syntax checks for the main JavaScript files:

```bash
npm run check
```

It runs `node --check` for `static/logic-engine.js`, `static/prolog-runtime.js`, and `static/app-static.js`.

## Project Structure

- `index.html` - application entry point;
- `static/app-static.js` - UI state and action handling;
- `static/logic-engine.js` - parser, normal forms, truth tables, equivalence checks, minimization, prenex form, Skolemization, and Tseitin transformation;
- `static/prolog-runtime.js` - Tau Prolog integration for browser-side CNF/DNF transformations;
- `static/formula-tree.js` - formula tree rendering;
- `static/karnaugh-map.js` - Karnaugh map rendering;
- `static/shortcut-autocomplete.js` - logical symbol autocomplete;
- `static/theme.js` and `static/styles.css` - theme handling and interface styles;
- `vendor/tau-prolog/core.js` - vendored Tau Prolog runtime;
- `prolog/original/` - original Prolog modules kept as reference material.



## Limits

- CNF/DNF transformations are attempted through Tau Prolog in the browser; if it is unavailable, the JavaScript implementation is used as a fallback.
- Minimal CNF/DNF operations are limited to 10 variables to avoid freezing the browser.
- Truth tables and equivalence checks are limited to 12 variables.
- Karnaugh maps are generated for formulas with up to 6 variables.

## TODO
mention authors...
