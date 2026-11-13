import {DEFAULT_CONFIG, DEFAULT_RULES, DEFUZZIFICATION_STEPS, DOMAINS, INFERENCE_STAGES} from './constants.js';
import {runSimulation} from './simulator.js';

export const STAGE_COUNT = INFERENCE_STAGES.length;

const NUMBER_PATTERN = /^[+-]?(\d+([.,]\d*)?|[.,]\d+)([eE][+-]?\d+)?$/;
const FIELD_NAMES = Object.freeze({ 
    humidity: "a umidade do solo",
    temperature: "a temperatura"
});

//Converter o texto de um campo em número, sem corrigir o valor
export function parseInput(raw, variable, {badInput = false} = {}) {
    const {min, max, unit} = DOMAINS[variable];
    const range = `${min} a ${max} ${unit}`;
    const text = raw === null || raw === undefined ? '' : String(raw).trim();

    if (badInput || (text !== '' && !NUMBER_PATTERN.test(text))) {
        return {value: null, error: `Use apenas números, como ${variable === 'humidity' ? '35 ou 42,5' : '30 ou 27,5'}.` };
    }

    if(text === '') {
        return {value: null, error: `Informe ${FIELD_NAMES[variable]}, entre ${range}.`};
    }

    const value = Number(text.replace(',', '.'));

    if (!Number.isFinite(value)) {
        return {value: null, error: 'O número informado não é finito'};
    }

    if (value < min || value > max) {
        return { value: null, error: `${formatNumber(value)} ${unit} está fora do intervalo de ${range}.` };
    }

    return {value, error: null};
}

export function createInitialState() {
    return {
        inputs: {
            humidity: {raw: String(DEFAULT_CONFIG.humidity), badInput: false},
            temperature: {raw: String(DEFAULT_CONFIG.temperature), badInput: false}
        },
        step: DEFAULT_CONFIG.step,
        consequents: DEFAULT_RULES.map((rule) => rule.consequent),
        result: null,
        stageIndex: 0,
        notice: null
    };
}

export function readInputs(state) {
  const humidity = parseInput(state.inputs.humidity.raw, 'humidity', state.inputs.humidity);
  const temperature = parseInput(state.inputs.temperature.raw, 'temperature', state.inputs.temperature);
  const errors = {};

  if (humidity.error) errors.humidity = humidity.error;
  if (temperature.error) errors.temperature = temperature.error;
  if (!DEFUZZIFICATION_STEPS.includes(state.step)) errors.step = 'Escolha um passo de 0,1, 0,05 ou 0,01 minuto.';

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    humidity: humidity.value,
    temperature: temperature.value
  };
}

export function buildRules(consequents) {
  return DEFAULT_RULES.map((rule, index) => ({ ...rule, consequent: consequents[index] }));
}

// Reinicia a simulação caso haja alguma alteração nos dados de entrada ou na configuração do modelo
function invalidate(state, patch) {
  return {
    ...state,
    ...patch,
    result: null,
    stageIndex: 0,
    notice: state.result ? 'changed' : null
  };
}

export function setInput(state, variable, raw, badInput = false) {
  return invalidate(state, {
    inputs: { ...state.inputs, [variable]: { raw: String(raw), badInput } }
  });
}

export function setConsequent(state, index, consequent) {
  const consequents = [...state.consequents];
  consequents[index] = consequent;
  return invalidate(state, { consequents });
}

export function setStep(state, step) {
  return invalidate(state, { step });
}

export function resetState() {
  return { ...createInitialState(), notice: 'reset' };
}

function simulate(state) {
  const inputs = readInputs(state);

  if (!inputs.valid) {
    return null;
  }

  return runSimulation({
    humidity: inputs.humidity,
    temperature: inputs.temperature,
    step: state.step,
    rules: buildRules(state.consequents)
  });
}

//Cálculo do resultado final, após a simulação
export function calculate(state) {
  const result = simulate(state);

  if (!result) {
    return { ...state, notice: 'invalid' };
  }

  return { ...state, result, stageIndex: STAGE_COUNT, notice: null };
}

//Avança para a próxima etapa da simulação, ou reinicia caso haja alguma alteração nos dados de entrada ou na configuração do modelo
export function advance(state) {
  if (!state.result) {
    const result = simulate(state);
    return result
      ? { ...state, result, stageIndex: 1, notice: null }
      : { ...state, notice: 'invalid' };
  }

  const stageIndex = state.stageIndex >= STAGE_COUNT ? 1 : state.stageIndex + 1;
  return { ...state, stageIndex, notice: null };
}

const numberFormat = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 6 });

export function formatNumber(value, digits) {
  if (digits === undefined) {
    return numberFormat.format(value);
  }
  return value.toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}
