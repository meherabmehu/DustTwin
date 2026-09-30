import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeResultsSummary,
  RESULTS_DEFAULT_SCENARIO,
} from '../src/features/results/resultsEngine';
import { predictSimulation } from '../src/features/simulation/simulationEngine';
import { calculateStrategyComparison } from '../src/features/simulation/strategyComparison';
import { derivePm10 } from '../src/features/simulation/sensorModel';
import { PM25_MODERATE_THRESHOLD } from '../src/features/simulation/simulationConfig';

test('Results page default scenario is deterministic and uses standard conditions', () => {
  assert.equal(RESULTS_DEFAULT_SCENARIO.dustIntensity, 70);
  assert.equal(RESULTS_DEFAULT_SCENARIO.windSpeed, 4.2);
  assert.equal(RESULTS_DEFAULT_SCENARIO.windDirection, 315);
  assert.equal(RESULTS_DEFAULT_SCENARIO.temperatureC, 28);
  assert.equal(RESULTS_DEFAULT_SCENARIO.humidity, 45);

  const { prediction, strategyResults, summary } = computeResultsSummary();
  assert.equal(prediction.input.dustIntensity, 70);
  assert.equal(prediction.input.windSpeed, 4.2);
  assert.equal(prediction.input.windDirection, 315);
  assert.equal(strategyResults.length, 4);
  assert.ok(summary);
});

test('Card 1: PM Reduction is calculated deterministically vs No Control', () => {
  const { strategyResults, summary } = computeResultsSummary();
  const noControl = strategyResults.find((s) => s.strategy === 'noControl')!;
  const predictive = strategyResults.find((s) => s.strategy === 'predictive')!;

  const expectedPmReduction = Math.round(
    ((noControl.boundaryPm25 - predictive.boundaryPm25) / noControl.boundaryPm25) * 100
  );

  assert.equal(summary.noControlPm25, 49.0);
  assert.equal(summary.predictivePm25, 35.3);
  assert.equal(summary.pmReductionPercent, expectedPmReduction);
  assert.equal(summary.pmReductionPercent, 28);
});

test('Card 2: Boundary Exceedance Time Reduction is calculated deterministically vs No Control', () => {
  const { strategyResults, summary } = computeResultsSummary();
  const noControl = strategyResults.find((s) => s.strategy === 'noControl')!;
  const predictive = strategyResults.find((s) => s.strategy === 'predictive')!;

  const expectedExceedanceReduction = Math.round(
    ((noControl.exceedanceMinutes - predictive.exceedanceMinutes) / noControl.exceedanceMinutes) * 100
  );

  assert.equal(summary.noControlExceedance, 8.0);
  assert.equal(summary.predictiveExceedance, 0.3);
  assert.equal(summary.exceedanceReductionPercent, expectedExceedanceReduction);
  assert.equal(summary.exceedanceReductionPercent, 96);
});

test('Card 3: Water Use Reduction is calculated deterministically vs Continuous Spraying', () => {
  const { strategyResults, summary } = computeResultsSummary();
  const continuous = strategyResults.find((s) => s.strategy === 'continuous')!;
  const predictive = strategyResults.find((s) => s.strategy === 'predictive')!;

  const expectedWaterReduction = Math.round(
    ((continuous.waterUsedL - predictive.waterUsedL) / continuous.waterUsedL) * 100
  );

  assert.equal(summary.continuousWater, 16.0);
  assert.equal(summary.predictiveWater, 1.1);
  assert.equal(summary.waterReductionPercent, expectedWaterReduction);
  assert.equal(summary.waterReductionPercent, 93);
});

test('Card 4 & Card 5: Prediction Lead Time and Targeted Zone Utilization match physics simulation', () => {
  const { prediction, summary } = computeResultsSummary();

  assert.equal(summary.leadTimeSeconds, 26);
  assert.equal(prediction.leadTimeSeconds, 26);
  assert.equal(summary.activeZonesCount, 2);
  assert.equal(summary.totalZonesCount, 4);
  assert.deepEqual(summary.activeZoneIds, ['A', 'D']);
});

test('Strategy Comparison includes all four strategies and all four required metrics', () => {
  const { strategyResults } = computeResultsSummary();
  assert.equal(strategyResults.length, 4);

  const [noControl, continuous, reactive, predictive] = strategyResults;
  assert.equal(noControl.strategy, 'noControl');
  assert.equal(continuous.strategy, 'continuous');
  assert.equal(reactive.strategy, 'reactive');
  assert.equal(predictive.strategy, 'predictive');

  // Verify PM10 derivation PM10 = PM2.5 * 1.65
  for (const result of strategyResults) {
    assert.equal(result.boundaryPm10, derivePm10(result.boundaryPm25));
  }

  // Verify boundary exceedance thresholds (moderate threshold: 40 µg/m³)
  assert.equal(PM25_MODERATE_THRESHOLD, 40);
  assert.ok(noControl.exceedanceMinutes >= reactive.exceedanceMinutes);
  assert.ok(reactive.exceedanceMinutes >= predictive.exceedanceMinutes);

  // Verify water savings: predictive uses less water than continuous and reactive
  assert.ok(predictive.waterUsedL < continuous.waterUsedL);
  assert.ok(predictive.waterUsedL <= reactive.waterUsedL);
  assert.equal(noControl.waterUsedL, 0);
});

test('Results page state is pure, deterministic, and isolated from Main and Circuit Simulation', () => {
  const run1 = computeResultsSummary();
  const run2 = computeResultsSummary();
  assert.deepEqual(run1.summary, run2.summary);
  assert.deepEqual(run1.strategyResults, run2.strategyResults);

  // Mutating one copy or custom scenario does not alter subsequent default runs
  const custom = computeResultsSummary({
    dustIntensity: 90,
    windSpeed: 6.0,
    windDirection: 90,
    temperatureC: 30,
    humidity: 35,
  });
  assert.notDeepEqual(custom.summary, run1.summary);

  const run3 = computeResultsSummary();
  assert.deepEqual(run3.summary, run1.summary);
});
