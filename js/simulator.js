import { DEFAULT_CONFIG, DEFAULT_RULES, DEFUZZIFICATION_STEPS, INFERENCE_STAGES } from './constants.js';
import { fuzzifyInputs } from './membership.js';
import { evaluateRules, applyImplication, aggregateImplications } from './inference.js';
import { calculateCentroid } from './defuzzification.js';

const stageIds = ['fuzzification', 'evaluation', 'implication', 'aggregation', 'defuzzification'];

export function runSimulation(configuration = DEFAULT_CONFIG) {
  if (!configuration || typeof configuration !== 'object' || Array.isArray(configuration)) {
    throw new TypeError('Informe uma configuração válida para o simulador.');
  }

  const { humidity, temperature, step, rules = DEFAULT_RULES } = configuration;

  if (!DEFUZZIFICATION_STEPS.includes(step)) {
    throw new RangeError('O passo deve ser 0,1, 0,05 ou 0,01 minuto.');
  }

  const fuzzification = fuzzifyInputs(humidity, temperature);
  const evaluation = evaluateRules(fuzzification, rules);
  const implication = applyImplication(evaluation);
  const aggregation = aggregateImplications(implication);
  const defuzzification = calculateCentroid(aggregation, step);
  const stageResults = [fuzzification, evaluation, implication, aggregation, defuzzification];

  return {
    configuration: {
      humidity,
      temperature,
      step,
      rules: evaluation.map(({ id, humidity, temperature, consequent }) => ({
        id,
        humidity,
        temperature,
        consequent
      }))
    },
    fuzzification,
    evaluation,
    implication,
    aggregation,
    defuzzification,
    stages: INFERENCE_STAGES.map((label, index) => ({
      id: stageIds[index],
      label,
      result: stageResults[index]
    }))
  };
}
