# Logic Formula Solver — GitHub Pages build

This is a static browser-only rewrite of the original Flask + SWI-Prolog project.
It is intended to be deployed directly to GitHub Pages without Python, Flask, SWI-Prolog,
or any server-side process.

## How to run locally

Open `index.html` in a browser, or serve this folder with any static server:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

## How to deploy on GitHub Pages

1. Create a repository or use an existing one.
2. Copy the contents of this folder into the repository root.
3. Commit and push.
4. In GitHub, open **Settings → Pages**.
5. Select deployment from the branch and choose the repository root, or put the files under `docs/` and select `/docs`.

## Main files

- `index.html` — static UI entry point.
- `static/logic-engine.js` — JavaScript implementation of parsing, normal forms, truth tables,
  equivalence, minimal forms, predicate prenex/skolem transformations, formula trees, and Tseitin output.
- `static/prolog-runtime.js` — Tau Prolog bridge used for browser-side Prolog CNF/DNF transformation.
- `vendor/tau-prolog/core.js` — vendored Tau Prolog browser runtime.
- `prolog/original/` — original `.pl` source files kept for reference.

## Feature coverage

Implemented in the static build:

- propositional formula analysis;
- CNF and DNF;
- canonical CNF and canonical DNF;
- minimal CNF and minimal DNF;
- truth table with classification;
- logical equivalence check;
- formula tree visualization;
- Tseitin transformation;
- predicate formula tree;
- prenex form;
- Skolem form;
- random propositional formula generation;
- shortcut autocomplete and theme switching.

## Notes and limits

- The original SWI-Prolog DCG parser is not consulted directly in the browser build. The static version uses a JavaScript parser for GitHub Pages compatibility.
- CNF/DNF are attempted through Tau Prolog in the browser; if Tau Prolog is unavailable, the JavaScript implementation is used as fallback.
- Minimal CNF/DNF are limited to 10 propositional variables to avoid freezing the browser.
- Truth-table and equivalence operations are limited to 12 propositional variables.
- Karnaugh maps are shown for formulas with up to 6 variables.
