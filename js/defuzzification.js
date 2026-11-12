import { DEFAULT_CONFIG, DEFUZZIFICATION_STEPS, DOMAINS } from './constants.js';
import { getAggregatedMembership } from './inference.js';

export function calculateCentroid(aggregation, step = DEFAULT_CONFIG.step) {
  if (!Number.isFinite(step) || !DEFUZZIFICATION_STEPS.includes(step)) {
    throw new RangeError('O passo deve ser 0,1, 0,05 ou 0,01 minuto.');
  }

  const { min, max } = DOMAINS.irrigation;
  const sampleCount = Math.round((max - min) / step);
  let numerator = 0;
  let denominator = 0;

  for (let k = 0; k < sampleCount; k += 1) {
    const z = min + (k + 0.5) * step;
    const membership = getAggregatedMembership(aggregation, z);

    numerator += z * membership;
    denominator += membership;
  }

  if (denominator === 0) {
    return {
      valid: false,
      time: null,
      numerator,
      denominator,
      sampleCount,
      step,
      message: 'Não há saída agregada válida.'
    };
  }

  return {
    valid: true,
    time: numerator / denominator,
    numerator,
    denominator,
    sampleCount,
    step
  };
}