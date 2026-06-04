# Logic Formula Solver

Logic Formula Solver is a static web application for working with propositional and predicate logic formulas. It runs entirely in the browser: no Flask app, Python server, or installed SWI-Prolog runtime is required. You can open it locally as a regular HTML page or deploy it directly to GitHub Pages.

Live GitHub Pages site: <https://lsanarchist.github.io/Logic-Formula-Solver/>

The browser app uses JavaScript for the interface, visualization, parser-safe fallbacks, and GitHub Pages compatibility. It also loads compatible rules from `prolog/original/` through Tau Prolog for the main logic transformations.

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
- `static/prolog-runtime.js` - Tau Prolog integration that loads compatible source files from `prolog/original/`;
- `static/formula-tree.js` - formula tree rendering;
- `static/karnaugh-map.js` - Karnaugh map rendering;
- `static/shortcut-autocomplete.js` - logical symbol autocomplete;
- `static/theme.js` and `static/styles.css` - theme handling and interface styles;
- `vendor/tau-prolog/core.js` - vendored Tau Prolog runtime;
- `prolog/original/` - original Prolog modules. The GitHub Pages build uses every browser-compatible module from this folder and keeps the remaining SWI-specific files as reference.

## Browser Notes

- The GitHub Pages build attempts to use original Prolog through Tau Prolog for tokenization, CNF/DNF, canonical CNF/DNF, minimal CNF/DNF, truth tables, equivalence checks, Tseitin clause generation, prenex form, and Skolem form.
- The original parser and GUI files are not used as the browser runtime path: the DCG parser hangs in the bundled Tau Prolog core, and `gui.pl` depends on SWI-Prolog XPCE. JavaScript handles browser-side parsing and visualization for those parts.
- If Tau Prolog or a compatible `.pl` path is unavailable, the JavaScript implementation is used as a fallback.
- On GitHub Pages, the original `.pl` files are loaded with browser `fetch`; when opening `index.html` through `file://`, a browser may block those file requests and the app will use JavaScript fallbacks.
- The current execution source is shown in the UI: the status pill changes to `Original Prolog via Tau`, `JavaScript fallback`, or `JavaScript`, and a quiet `Source:` note appears below each result. When Prolog is used, that note lists only the original `.pl` files relevant to the current action.
- Expensive operations show a browser warning before they continue:
  - minimal CNF/DNF above 10 variables;
  - truth-table MDNF/MCNF details above 10 variables;
  - full truth tables and equivalence checks above 12 variables;
  - Karnaugh maps above 6 variables.
- The warning can be accepted, so these operations are still available for larger formulas. Very large formulas may make the browser tab slow or unresponsive.

## TODO
mention authors...
parser.pl is not working in Tau Prolog.
