
import { DEFAULT_CONFIG, DEFAULT_RULES, DEFUZZIFICATION_STEPS } from '../js/constants.js';
import {
  STAGE_COUNT, advance, buildRules, calculate, createInitialState, parseInput,
  readInputs, resetState, setConsequent, setInput, setStep
} from '../js/state.js';

export function runStateTests(check) {
  const test = (name, assertion) => {
    try { check(name, Boolean(assertion())); }
    catch { check(name, false); }
  };

  const initial = createInitialState();
  test('Estado inicial: entradas padrão', () =>
    initial.inputs.humidity.raw === '35' && initial.inputs.temperature.raw === '30');
  test('Estado inicial: passo padrão', () => initial.step === 0.1);
  test('Estado inicial: nove consequentes', () =>
    JSON.stringify(initial.consequents) === JSON.stringify(DEFAULT_RULES.map((rule) => rule.consequent)));
  test('Estado inicial: sem resultado nem aviso', () =>
    initial.result === null && initial.stageIndex === 0 && initial.notice === null);
  test('Estado inicial: cópias independentes', () => {
    const other = createInitialState();
    return other !== initial && other.inputs !== initial.inputs && other.consequents !== initial.consequents;
  });

  for (const [variable, min, max] of [
    ['humidity', 0, 100], ['temperature', 10, 40]
  ]) {
    for (const raw of [min, max]) {
      test(`${variable}: aceita limite ${raw}`, () => {
        const parsed = parseInput(String(raw), variable);
        return parsed.error === null && parsed.value === raw;
      });
    }
    for (const raw of [min - 1, max + 1]) {
      test(`${variable}: rejeita ${raw} fora do domínio`, () => {
        const parsed = parseInput(String(raw), variable);
        return parsed.value === null && /fora do intervalo/i.test(parsed.error);
      });
    }
    for (const raw of ['', ' ', 'abc', 'NaN', 'Infinity', '-Infinity', '0x10']) {
      test(`${variable}: rejeita entrada ${JSON.stringify(raw)}`, () => {
        const parsed = parseInput(raw, variable);
        return parsed.value === null && typeof parsed.error === 'string' && parsed.error.length > 0;
      });
    }
    test(`${variable}: rejeita badInput do navegador`, () =>
      parseInput('30', variable, { badInput: true }).error !== null);
    test(`${variable}: aceita vírgula decimal`, () =>
      parseInput('27,5', variable).value === 27.5);
    test(`${variable}: aceita ponto decimal`, () =>
      parseInput('27.5', variable).value === 27.5);
    test(`${variable}: aceita arredondamento sem alterar entrada`, () => {
      const parsed = parseInput('27,125', variable);
      return parsed.value === 27.125 && parsed.error === null;
    });
  }

  for (const [field, raw] of [
    ['humidity', '-1'], ['humidity', '101'], ['humidity', ''], ['humidity', 'abc'],
    ['temperature', '9'], ['temperature', '41'], ['temperature', ''], ['temperature', 'Infinity']
  ]) {
    test(`Estado: ${field}=${JSON.stringify(raw)} impede cálculo`, () => {
      const changed = setInput(createInitialState(), field, raw);
      const inputs = readInputs(changed);
      const after = calculate(changed);
      return !inputs.valid && Boolean(inputs.errors[field]) &&
        after.result === null && after.notice === 'invalid' && after.stageIndex === 0;
    });
  }
  test('Estado: dois campos inválidos geram dois erros', () => {
    const both = setInput(setInput(initial, 'humidity', ''), 'temperature', '41');
    return Object.keys(readInputs(both).errors).length === 2;
  });
  test('Estado: limites válidos calculam normalmente', () => {
    for (const [humidity, temperature] of [[0, 10], [100, 40], [0, 40], [100, 10]]) {
      const state = setInput(setInput(initial, 'humidity', String(humidity)),
        'temperature', String(temperature));
      if (!readInputs(state).valid || !calculate(state).result?.defuzzification?.valid) return false;
    }
    return true;
  });
  test('Estado: passo fora das opções impede cálculo', () => {
    const invalid = setStep(initial, 0.2);
    return !readInputs(invalid).valid && Boolean(readInputs(invalid).errors.step) &&
      calculate(invalid).result === null;
  });
  test('Estado: três precisões aceitas', () => DEFUZZIFICATION_STEPS.every((step) =>
    readInputs(setStep(initial, step)).valid));

  const calculated = calculate(initial);
  test('Cálculo direto: produz resultado e revela cinco etapas', () =>
    calculated.result?.defuzzification?.valid && calculated.stageIndex === STAGE_COUNT);
  test('Cálculo direto: valor padrão aproximado', () =>
    Math.abs(calculated.result.defuzzification.time - 16.785683) < 0.00001);
  test('Cálculo direto: configuração preservada no resultado', () =>
    calculated.result.configuration.humidity === 35 &&
    calculated.result.configuration.temperature === 30 &&
    calculated.result.configuration.step === 0.1);
  test('Cálculo direto: não altera o estado de entrada', () =>
    initial.result === null && initial.stageIndex === 0 && initial.notice === null);

  for (const [kind, change] of [
    ['umidade', (s) => setInput(s, 'humidity', '40')],
    ['temperatura', (s) => setInput(s, 'temperature', '29')],
    ['precisão', (s) => setStep(s, 0.05)],
    ['consequente', (s) => setConsequent(s, 0, 'curto')]
  ]) {
    test(`Mudança de ${kind}: descarta resultado e etapas anteriores`, () => {
      const changed = change(calculated);
      return changed.result === null && changed.stageIndex === 0 && changed.notice === 'changed';
    });
  }
  test('Mudança antes do cálculo não gera aviso de descarte', () =>
    setInput(initial, 'humidity', '40').notice === null);
  test('Mudança de entrada não altera estado já calculado', () => {
    const next = setInput(calculated, 'humidity', '40');
    return calculated.result !== null && calculated.inputs.humidity.raw === '35' &&
      next.inputs.humidity.raw === '40';
  });

  test('Regras construídas: mantêm os nove antecedentes fixos', () => {
    const built = buildRules(Array(9).fill('curto'));
    return built.length === 9 && built.every((rule, i) =>
      rule.id === DEFAULT_RULES[i].id && rule.humidity === DEFAULT_RULES[i].humidity &&
      rule.temperature === DEFAULT_RULES[i].temperature && rule.consequent === 'curto');
  });
  test('Regras construídas: não modificam a base padrão', () =>
    DEFAULT_RULES[0].consequent === 'medio' && DEFAULT_RULES[1].consequent === 'longo');
  for (let i = 0; i < 9; i += 1) {
    test(`Edição: regra R${i + 1} altera somente seu consequente`, () => {
      const next = setConsequent(initial, i, 'curto');
      return next.consequents.length === 9 && next.consequents[i] === 'curto' &&
        next.consequents.every((value, index) => index === i || value === initial.consequents[index]);
    });
  }
  test('Edição: nove consequentes curto alteram a inferência', () => {
    let state = createInitialState();
    for (let i = 0; i < 9; i += 1) state = setConsequent(state, i, 'curto');
    state = setInput(setInput(state, 'humidity', '50'), 'temperature', '25');
    const result = calculate(state).result;
    return result.configuration.rules.every((rule) => rule.consequent === 'curto') &&
      Math.abs(result.defuzzification.time - 5.000111) < 0.00001;
  });

  test('Restauração: volta ao padrão após múltiplas alterações', () => {
    const modified = setStep(setConsequent(setInput(calculated, 'humidity', '62'), 3, 'longo'), 0.01);
    const restored = resetState(modified);
    return restored.inputs.humidity.raw === String(DEFAULT_CONFIG.humidity) &&
      restored.inputs.temperature.raw === String(DEFAULT_CONFIG.temperature) &&
      restored.step === DEFAULT_CONFIG.step && restored.result === null &&
      restored.stageIndex === 0 && restored.notice === 'reset' &&
      JSON.stringify(restored.consequents) === JSON.stringify(initial.consequents);
  });

  let progressive = createInitialState();
  for (let stage = 1; stage <= STAGE_COUNT; stage += 1) {
    progressive = advance(progressive);
    const snapshot = progressive;
    test(`Navegação: etapa ${stage} na ordem correta`, () =>
      snapshot.stageIndex === stage && snapshot.result?.defuzzification?.valid);
  }
  test('Navegação: reinicia a visualização sem recalcular', () => {
    const again = advance(progressive);
    return again.stageIndex === 1 && again.result === progressive.result;
  });
  test('Navegação e cálculo direto: respostas equivalentes', () =>
    progressive.result.defuzzification.time === calculated.result.defuzzification.time &&
    JSON.stringify(progressive.result.aggregation) === JSON.stringify(calculated.result.aggregation));
  test('Navegação: entrada inválida não inicia a sequência', () => {
    const invalid = advance(setInput(initial, 'temperature', '9'));
    return invalid.stageIndex === 0 && invalid.result === null && invalid.notice === 'invalid';
  });
  test('Determinismo: duas execuções idênticas geram resultados idênticos', () =>
    JSON.stringify(calculate(createInitialState()).result) ===
    JSON.stringify(calculate(createInitialState()).result));
}
