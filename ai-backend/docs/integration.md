# Connect the model to your existing website

Start with the [README setup](../README.md). This repo supplies the AI backend, not a replacement frontend. No training is required to integrate the frozen model.

## 1. Check the working example

Start the backend with the allowed origins shown in README. In a second terminal:

```sh
.venv/bin/python scripts/serve_example.py
```

Open [the connection example](http://127.0.0.1:5174/examples/), enter the backend address and click **Connect backend**. You should see **Live trained model**, the predicted PM10, the issue/target clock and both baselines. Click **POST this history again** to execute `/v1/predict` directly. At clock 120 the current target is hidden; advance to 150 to see the earlier forecast compared with its recorded target. The JSON panel shows exactly what entered and left the API.

This example requires no Node or frontend build. It calls the API across origins using the same adapter you can copy into your website.

## 2. Add the connection files

Copy these into your frontend's source directory together:

- [dusttwin-client.js](../frontend/dusttwin-client.js): framework-independent API adapter.
- [dusttwin-client.d.ts](../frontend/dusttwin-client.d.ts): TypeScript declarations.
- [useDustTwinReplay.ts](../frontend/useDustTwinReplay.ts): optional React hook.

Keep your existing cards, charts and site design. Your frontend already provides React if you use the hook; the backend itself does not need React.

For Vite, put this in **your frontend's** local environment file and restart its dev server:

```dotenv
VITE_DUSTTWIN_API_URL=http://127.0.0.1:8000
```

For plain JavaScript, pass that backend address directly. An empty base address uses the frontend's own origin, which suits a reverse proxy.

### React connection

Use a valid episode and an integer elapsed clock from `/v1/replay`. Your existing playback controls can own `second`; the hook cancels old requests when the recording, clock or backend changes.

```tsx
import { useDustTwinReplay } from './integrations/useDustTwinReplay';

const API = import.meta.env.VITE_DUSTTWIN_API_URL ?? '';

export function ForecastCard({ second }: { second: number }) {
  const state = useDustTwinReplay(API, 'lab_e3_drill10', second);
  if (state.status === 'loading') return <p>Loading selected clock…</p>;
  if (state.status === 'unavailable') return <p>{state.error}</p>;
  const { forecast, matured_forecast } = state.snapshot;
  return (
    <section>
      <p>{state.status === 'live' ? 'Live trained model' : 'Saved inference'}</p>
      <strong>{forecast.predicted_pm10_ug_m3.toFixed(3)} µg/m³</strong>
      <p>Forecast for {forecast.target_time_seconds}s (+30 seconds)</p>
      {matured_forecast && <p>
        Earlier forecast: {matured_forecast.predicted_pm10_ug_m3.toFixed(3)};
        recorded target: {matured_forecast.actual_pm10_ug_m3.toFixed(3)} µg/m³
      </p>}
    </section>
  );
}
```

### Plain JavaScript connection

```js
import { DustTwinClient } from './dusttwin-client.js';
const api = new DustTwinClient('http://127.0.0.1:8000');
const recordings = await api.recordings();
const episode = recordings.episodes[0];
const snapshot = await api.replay(episode.episode_id, episode.first_issue_second);
const valueForYourCard = snapshot.forecast.predicted_pm10_ug_m3;
// replay already executes the model when ready. A separate POST is optional:
const sameForecast = await api.predict(snapshot.request);
```

## 3. Replace the frontend's illustrative values

| Existing UI item | Actual returned source |
|---|---|
| Current recorded PM10 | `snapshot.forecast.current_pm10_ug_m3` |
| Predicted PM10 | `snapshot.forecast.predicted_pm10_ug_m3` |
| Historical observation chart | `snapshot.past_observations` |
| Forecast issue/target | `issue_time_seconds` / `target_time_seconds` |
| Actual for an earlier forecast | `snapshot.matured_forecast` only when non-null |
| Baseline comparison | `snapshot.forecast.baselines` |
| Input/model explanation | `snapshot.request`, `forecast.features`, `model_id`, `artifact_sha256` |
| Mode label | `forecast.mode`: live or previously computed saved inference |
| Results page | `/v1/evidence` and `models/model-card.md` |

Remove random/fixed forecast numbers and any second calculation that claims to be this model. The adapter owns the API call; your components display its returned output. Keep full precision in calculations and round only displayed values.

No PM2.5/PM1, humidity or wind forecast is produced by this model. Exact crossing ETA and calibrated confidence are unavailable. The 500 µg/m³ setting is illustrative, not a regulatory threshold. Do not interpret a 30-second endpoint as guaranteed 30-second warning lead.

For replay, use the endpoint's `past_observations` and matured result. The backing files contain full recordings for offline reproduction; handing their future rows to a controller would invalidate a causal demonstration. Label `/v1/evidence` final-test plots as evaluation, outside the current replay clock.

## 4. Connect optional site-control simulation

If your frontend has a map, wind controls, sprinklers or water comparison, use the shared simulation rather than inventing another prediction or fixed saving percentage:

```js
const savedCase = await api.savedScenario('east');
const customCase = await api.simulate({
  scenario_id: 'east', source_scale: 1.0, wind_from_degrees: 270.0,
  wind_speed_metres_second: 3.0, flow_litres_minute_per_zone: 0.5,
  mist_source_fraction_removed: 0.65,
});
// Four strategy runs share the same conditions:
const predictive = customCase.runs.predictive;
// Trace point: second, pm10_ug_m3[A,B,C,D], commands[A,B,C,D],
// water_litres, data_available, forecast. Metrics are in predictive.metrics.
```

A/B/C/D are **north/east/south/west**. Wind is direction **from**. Slice the simulation trace by your displayed clock and use each strategy's returned commands and metrics. Site layout, transport, mist effectiveness and the synthetic source proxy are explicit assumptions. Read [simulation.md](simulation.md). Keep the measured model replay separate and label these maps/results **uncalibrated simulation**.

## 5. Hosting and offline use

This public GitHub repo does not host a running Python API. A browser cannot execute the joblib file directly, and a static-only frontend host does not start this backend.

- **Local judge demo:** run Python and the existing frontend on the presentation laptop. Their addresses can be localhost. Install dependencies once; subsequent model/replay/simulation calls need no external network.
- **Separate deployed backend:** run `scripts/serve.py --host 0.0.0.0 --port <host-port>` on a Python 3.14 host. Set `DUSTTWIN_ALLOWED_ORIGINS` to the frontend's exact HTTPS origin and set the frontend API address to the backend's HTTPS origin. Verify `ready: true` and the fixture before using that platform.
- **Same-origin proxy:** forward `/health`, `/v1/`, `/demo/` and `/reports/` to Python and use `new DustTwinClient('')`. Cross-origin permission is unnecessary in that arrangement.

For an online website, `127.0.0.1` points to each visitor's computer. Replace it with a real hosted backend address before claiming the deployed website works for everyone. HTTPS frontends need HTTPS API access.

If the live artifact is unavailable, `/v1/predict` returns 503 while recorded replay can return `saved_inference`. Show that mode clearly. If the server itself is offline, the adapter reports unavailable; it does not fabricate fallback values. A complete separate offline website backup is available in the [upstream Round 1 release](https://github.com/arifshekhk8/DustTwin-AI/releases/tag/round1-demo-v1).

## Teammate acceptance checklist

1. Fresh clone contains the model; `verify_model.py` and `verify_handoff.py` pass.
2. Backend health is ready; browser requests succeed from the configured frontend origin.
3. A displayed forecast equals the API response, with the right issue/target clock and mode.
4. Pause/seek/reset or fast recording changes never apply an old response to a new clock.
5. Actual targets appear only when matured; loading, saved and unavailable states are labelled.
6. Results use real evidence and both baselines; maps/water claims stay labelled simulation.

See [api.md](api.md) for the exact request contract, example JSON and error codes. No hardware work or retraining is part of this integration.
