# Q-Compare - Decision Model Lab

[![DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.22019653.svg)](https://doi.org/10.5281/zenodo.22019653)

An interactive empirical laboratory for comparing **Classical**, **Bayesian**, and
**Quantum-Inspired** decision models on the same uncertainty and decision-making
problem.

Q-Compare does not claim that quantum-inspired models are always better. It lets
you define a decision problem, provide evidence and context, run all three model
families under comparable conditions, and measure **when and why** one model
performs better than another — with transparent mathematics, a Quantum Advantage
Indicator (QAI), benchmark experiments, insights, reports and full reproducibility.

> The quantum-inspired model is a **mathematical simulation** of quantum-probability
> formalism (amplitude vectors, unitary context transforms, interference, order
> effects). It does not run on a quantum computer and cannot predict future events.

## Start the application

```bash
npm install
npm run dev
```

Open http://localhost:5173 — the application seeds itself with realistic sample
experiments, datasets and benchmarks on first launch.

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Type-check + production build to `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm test` | Run unit tests (Vitest) |
| `npm run test:e2e` | Run Playwright end-to-end tests (desktop/tablet/mobile) |
| `npm run typecheck` | TypeScript strict type-check |

## Modeling paradigms

All three models receive the **same experiment definition** — same problem, same
alternatives, same evidence, same evaluation.

- **Classical** — frequency/conditional probability, normalized outcome
  probabilities, expected utility, maximum-probability decision.
- **Bayesian** — sequential posterior updates `P(H|E) ∝ P(H)·ΠP(Eⱼ|H)` with
  inspectable prior → evidence → posterior steps.
- **Quantum-Inspired** — amplitude state `|ψ⟩ = Σαᵢ|i⟩`, context phase
  transformations `e^{iλ|c⟩⟨c|}`, Givens evidence rotations, Born-rule
  measurement `P(i) = |αᵢ|²`, interference contributions and non-commutative /
  order-sensitive evolution.

## Evaluation and QAI

- Metrics: accuracy, calibration error, log-likelihood, Brier score, prediction
  error, expected utility, model complexity — computed under identical
  conditions for all models.
- Context dependence, order effects (ΔP between reversed evidence orders),
  interference and non-commutativity are measured where mathematically relevant.
- **Quantum Advantage Indicator**: `QAI = w₁Ctx + w₂Interf + w₃ErrRed +
  w₄NonComm + w₅Calib`, share-normalized to 0–1, with configurable weights in
  Settings and a per-component breakdown.
- The model recommendation is based on measured results only — Classical or
  Bayesian models are recommended whenever the evidence does not support a
  quantum-inspired advantage.

## Project structure

```text
src/
├── components/   UI components (charts, gauge, drawer, tables)
├── pages/        Dashboard, New Experiment wizard, Experiments, ...
├── layouts/      Main layout + responsive navigation
├── models/       classical/, bayesian/, quantum/ engines + run orchestration
├── evaluation/   metrics
├── qai/          QAI components, context/order analysis
├── data/         seed experiments, datasets, benchmarks
├── services/     store persistence, insights, reports
├── store/        React state layer
├── types/        domain types
└── utils/        helpers
worker/           optional Cloudflare Worker API (D1 persistence)
migrations/       D1 schema
tests/unit/       Vitest unit tests
tests/e2e/        Playwright end-to-end tests
docs/             deployment guide
```

## Tests

```bash
npm test              # 53 unit tests: model math, evaluation, QAI, app logic
npm run test:e2e      # 24 e2e tests across desktop (1440px), tablet (768px), mobile (390px)
```

## Deployment

See [docs/deployment.md](docs/deployment.md) for the Cloudflare Pages + Workers
+ D1 deployment guide. The core application runs entirely client-side and
remains functional without any backend.

## Scope and limitations (v1)

- No real quantum hardware execution.
- No prediction of real-world future events, financial outcomes or medical
  decisions.
- No external AI dependency for calculations.
- Reports clearly state that the quantum-inspired model is a mathematical
  simulation.
