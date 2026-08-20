import { Panel, Badge } from '../components/ui';
import { APP_VERSION, CALCULATION_VERSION, MODEL_VERSION } from '../types';

export function About() {
  return (
    <div>
      <h1 className="mb-1">About Q-Compare</h1>
      <p className="text-2 mb-2">
        Q-Compare is an interactive empirical laboratory for comparing <strong>Classical</strong>,{' '}
        <strong>Bayesian</strong>, and <strong>Quantum-Inspired</strong> decision models on the same uncertainty and
        decision-making problem.
      </p>

      <Panel title="Product Principle" className="mb-2">
        <div className="formula">Do not ask "Is quantum better?" Ask "Under what conditions, if any, does a quantum-inspired
model provide measurable additional value over classical and Bayesian alternatives?"</div>
        <p className="small text-2 mt-2 mb-0">
          The software is neutral, transparent, reproducible, and experimentally driven. No model family is hard-coded as
          superior. The Quantum Advantage Indicator (QAI) is a configurable research visualization metric, not a universal
          scientific measure of "quantumness".
        </p>
      </Panel>

      <div className="grid grid-3 mb-2">
        <Panel title="Classical">
          <p className="small text-2 mb-1">
            Conventional probability reasoning: frequency-based aggregation, conditional probabilities, normalized outcome
            probabilities, expected utility.
          </p>
          <Badge tone="blue">Blue in charts</Badge>
        </Panel>
        <Panel title="Bayesian">
          <p className="small text-2 mb-1">
            Explicit priors and likelihoods with sequential posterior updates: P(H|E) = P(E|H)·P(H) / P(E).
          </p>
          <Badge tone="green">Green in charts</Badge>
        </Panel>
        <Panel title="Quantum-Inspired">
          <p className="small text-2 mb-1">
            Classical numerical simulation of quantum-probability formalism: amplitudes, context phases, interference and
            order-sensitive transformations. <strong>Not</strong> a real quantum computer.
          </p>
          <Badge tone="purple">Purple in charts</Badge>
        </Panel>
      </div>

      <Panel title="Interpretation & Limits" className="mb-2">
        <ul className="small text-2" style={{ paddingLeft: 18, margin: 0 }}>
          <li>Sample experiments are decision-analysis simulations — not predictions of real-world future events.</li>
          <li>No financial, trading, or investment advice; no medical diagnosis.</li>
          <li>Model calculations and QAI do not depend on any external AI service.</li>
          <li>All results are reproducible from stored configurations (see Reproducibility on each experiment).</li>
          <li>QAI language: "the quantum-inspired model demonstrates stronger performance for this experiment under the
            selected evaluation criteria" — never "quantum is better".</li>
        </ul>
      </Panel>

      <Panel title="Version Information" tight>
        <div className="row wrap">
          <Badge tone="teal">Application v{APP_VERSION}</Badge>
          <Badge tone="teal">Calculation v{CALCULATION_VERSION}</Badge>
          <Badge tone="teal">Model engine v{MODEL_VERSION}</Badge>
          <Badge tone="gray">Local storage persistence</Badge>
          <Badge tone="gray">Cloudflare Pages ready</Badge>
        </div>
      </Panel>
    </div>
  );
}