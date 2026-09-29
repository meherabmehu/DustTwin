# DustTwin

DustTwin is a responsive, multi-page frontend prototype for predictive construction-site dust monitoring and targeted misting control. The UI follows the supplied dark navy / cyan dashboard references and includes an interactive live simulation, a browser-based circuit demonstration, and a tabletop prototype explainer.

## Run locally

```bash
npm install
npm run dev
```

Create a production build with:

```bash
npm run build
```

## Pages

- `/` — Overview
- `/problem` — Construction dust problem
- `/how-it-works` — Five-step process and system architecture
- `/simulation` — Interactive live digital twin mock
- `/circuit-simulation` — Browser-based wiring and relay demonstration
- `/prototype` — Judge-facing tabletop hardware prototype
- `/results` — Clearly labelled illustrative simulation results
- `/team` — Replaceable placeholder team roles
- `/contact` — Validated demo contact form

## Model and backend integration

No ML model is trained or deployed in this repository. `src/lib/simulation.ts` exposes the model-agnostic `predictDust` adapter and currently returns deterministic local mock results. Replace its implementation with the future prediction API while retaining the same input/output contract.

`src/services/contactService.ts` validates and accepts form submissions locally for demonstration; connect it to a protected backend or email provider before production. Contact placeholders and team roles are maintained in `src/data/site.ts`.
