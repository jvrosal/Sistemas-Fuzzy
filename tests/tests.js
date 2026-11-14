
import {
  APP_INFO,
  INFERENCE_STAGES,
  DOMAINS,
  FUZZY_SETS,
  DEFUZZIFICATION_STEPS,
  DEFAULT_CONFIG,
  DEFAULT_RULES
} from '../js/constants.js';
import { initializeInterface } from '../js/ui.js';
import { calculateMembership, fuzzifyVariable, fuzzifyInputs } from '../js/membership.js';
import { evaluateRules, validateRules, applyImplication, getImpliedMembership,
  aggregateImplications, getAggregatedMembership } from '../js/inference.js';
import { calculateCentroid } from '../js/defuzzification.js';
import { runSimulation } from '../js/simulator.js';
import { runStateTests } from './state-tests.js';
import { runChartTests } from './chart-tests.js';
import { runUITests } from './ui-tests.js';

const results = document.querySelector('#test-results');
const summary = document.querySelector('#test-summary');
const tests = [];
const originalPageTitle = document.title;

function check(name, condition, group = 'Motor Mamdani') {
  tests.push({ name, passed: Boolean(condition), group });
}

function equal(actual, expected) {
  return JSON.stringify(actual) === JSON.stringify(expected);
}

check('Identificação da aplicação', APP_INFO.title === 'Simulador Fuzzy Mamdani');
check('Cinco etapas na ordem correta', equal(INFERENCE_STAGES, [
  'Fuzzificação', 'Avaliação das regras', 'Implicação', 'Agregação', 'Defuzzificação'
]));

const fixture = document.createElement('section');
fixture.innerHTML = '<span data-app-status></span><ol data-stage-list></ol>';
const initialized = initializeInterface(fixture, { title: APP_INFO.title, stages: INFERENCE_STAGES });

check('Interface inicializada', initialized.ready && fixture.classList.contains('is-ready'));
check('Cinco etapas renderizadas', fixture.querySelectorAll('[data-stage-list] li').length === 5);
check('Mensagem de carregamento atualizada', fixture.querySelector('[data-app-status]').textContent === 'Estrutura carregada');

check('Domínios de entrada e saída corretos', equal([
  [DOMAINS.humidity.min, DOMAINS.humidity.max],
  [DOMAINS.temperature.min, DOMAINS.temperature.max],
  [DOMAINS.irrigation.min, DOMAINS.irrigation.max]
], [[0, 100], [10, 40], [0, 30]]));
check('Unidades definidas', equal([
  DOMAINS.humidity.unit, DOMAINS.temperature.unit, DOMAINS.irrigation.unit
], ['%', '°C', 'min']));
check('Valores iniciais corretos', equal(DEFAULT_CONFIG, { humidity: 35, temperature: 30, step: 0.1 }));
check('Passos permitidos corretos', equal(DEFUZZIFICATION_STEPS, [0.1, 0.05, 0.01]));

const expectedSets = {
  humidity: {
    seco: [0, 0, 20, 50],
    intermediario: [20, 50, 50, 80],
    umido: [50, 80, 100, 100]
  },
  temperature: {
    baixa: [10, 10, 15, 25],
    media: [15, 25, 25, 35],
    alta: [25, 35, 40, 40]
  },
  irrigation: {
    curto: [0, 0, 0, 15],
    medio: [0, 15, 15, 30],
    longo: [15, 30, 30, 30]
  }
};

for (const [variable, sets] of Object.entries(expectedSets)) {
  check(`Três conjuntos de ${variable} definidos`, Object.keys(FUZZY_SETS[variable]).length === 3);

  for (const [name, points] of Object.entries(sets)) {
    const set = FUZZY_SETS[variable][name];
    check(`${variable}: ${name} tem os pontos corretos`, Boolean(set) && equal(set.points, points));
    check(`${variable}: ${name} possui pontos ordenados`, Boolean(set) &&
      set.points.length === 4 && set.points.every((point, i) => i === 0 || point >= set.points[i - 1]));
  }
}

const expectedRules = [
  ['R1', 'seco', 'baixa', 'medio'],
  ['R2', 'seco', 'media', 'longo'],
  ['R3', 'seco', 'alta', 'longo'],
  ['R4', 'intermediario', 'baixa', 'curto'],
  ['R5', 'intermediario', 'media', 'medio'],
  ['R6', 'intermediario', 'alta', 'longo'],
  ['R7', 'umido', 'baixa', 'curto'],
  ['R8', 'umido', 'media', 'curto'],
  ['R9', 'umido', 'alta', 'curto']
];

check('Nove regras padrão definidas', DEFAULT_RULES.length === 9);
check('Antecedentes e consequentes conforme o enunciado', equal(
  DEFAULT_RULES.map(({ id, humidity, temperature, consequent }) => [id, humidity, temperature, consequent]),
  expectedRules
));
check('Todas as combinações de antecedentes são únicas', new Set(
  DEFAULT_RULES.map((rule) => `${rule.humidity}|${rule.temperature}`)
).size === 9);
check('Regras referenciam conjuntos existentes', DEFAULT_RULES.every((rule) =>
  FUZZY_SETS.humidity[rule.humidity] &&
  FUZZY_SETS.temperature[rule.temperature] &&
  FUZZY_SETS.irrigation[rule.consequent]
));
check('Configurações padrão são imutáveis', Object.isFrozen(DEFAULT_CONFIG) &&
  Object.isFrozen(DEFAULT_RULES) && DEFAULT_RULES.every(Object.isFrozen) &&
  Object.values(FUZZY_SETS).every((sets) => Object.isFrozen(sets) &&
    Object.values(sets).every((set) => Object.isFrozen(set) && Object.isFrozen(set.points))));

const tolerance = 1e-6;

function approximately(actual, expected) {
  return Number.isFinite(actual) && Math.abs(actual - expected) <= tolerance;
}

function rejects(callback) {
  try {
    callback();
    return false;
  } catch (error) {
    return error instanceof TypeError;
  }
}

const membershipCases = [
  ['humidity', 'seco', [[-1, 0], [0, 1], [20, 1], [35, 0.5], [50, 0], [51, 0]]],
  ['humidity', 'intermediario', [[19, 0], [20, 0], [35, 0.5], [50, 1], [65, 0.5], [80, 0], [81, 0]]],
  ['humidity', 'umido', [[49, 0], [50, 0], [65, 0.5], [80, 1], [100, 1], [101, 0]]],
  ['temperature', 'baixa', [[9, 0], [10, 1], [15, 1], [20, 0.5], [25, 0], [26, 0]]],
  ['temperature', 'media', [[14, 0], [15, 0], [20, 0.5], [25, 1], [30, 0.5], [35, 0], [36, 0]]],
  ['temperature', 'alta', [[24, 0], [25, 0], [30, 0.5], [35, 1], [40, 1], [41, 0]]],
  ['irrigation', 'curto', [[-1, 0], [0, 1], [7.5, 0.5], [15, 0], [30, 0]]],
  ['irrigation', 'medio', [[-1, 0], [0, 0], [7.5, 0.5], [15, 1], [22.5, 0.5], [30, 0], [31, 0]]],
  ['irrigation', 'longo', [[0, 0], [15, 0], [22.5, 0.5], [30, 1], [31, 0]]]
];

for (const [variable, setName, cases] of membershipCases) {
  const points = FUZZY_SETS[variable][setName].points;

  for (const [value, expected] of cases) {
    check(`Pertinência ${variable}/${setName} (${value}) = ${expected}`,
      approximately(calculateMembership(value, points), expected));
  }
}

check('Triângulo com b = c', approximately(calculateMembership(5, [0, 5, 5, 10]), 1));
check('Trapézio com platô', approximately(calculateMembership(6, [0, 3, 7, 10]), 1));
check('Rampa esquerda vazia com a = b', approximately(calculateMembership(0, [0, 0, 3, 5]), 1));
check('Rampa direita vazia com c = d', approximately(calculateMembership(5, [0, 2, 5, 5]), 1));
check('Ponto único com a = b = c = d', approximately(calculateMembership(3, [3, 3, 3, 3]), 1));
check('Fora do ponto único retorna zero', approximately(calculateMembership(4, [3, 3, 3, 3]), 0));
check('Argumentos não são modificados', (() => {
  const points = [0, 0, 20, 50];
  calculateMembership(35, points);
  return equal(points, [0, 0, 20, 50]);
})());
check('Valor NaN é rejeitado', rejects(() => calculateMembership(NaN, [0, 0, 20, 50])));
check('Valor infinito é rejeitado', rejects(() => calculateMembership(Infinity, [0, 0, 20, 50])));
check('Valor textual é rejeitado', rejects(() => calculateMembership('35', [0, 0, 20, 50])));
check('Pontos fora de ordem são rejeitados', rejects(() => calculateMembership(5, [0, 7, 3, 10])));
check('Pontos não finitos são rejeitados', rejects(() => calculateMembership(5, [0, 3, Infinity, 10])));
check('Quantidade incorreta de pontos é rejeitada', rejects(() => calculateMembership(5, [0, 5, 10])));
check('Todos os graus permanecem entre 0 e 1', Object.values(FUZZY_SETS).every((sets) =>
  Object.values(sets).every(({ points }) => {
    const [a, , , d] = points;
    for (let x = a - 1; x <= d + 1; x += 0.25) {
      const degree = calculateMembership(x, points);
      if (degree < 0 || degree > 1 || !Number.isFinite(degree)) return false;
    }
    return true;
  })
));

const fuzzificationCases = [
  [35, 30, [0.5, 0.5, 0], [0, 0.5, 0.5]],
  [0, 10, [1, 0, 0], [1, 0, 0]],
  [100, 40, [0, 0, 1], [0, 0, 1]],
  [20, 35, [1, 0, 0], [0, 0, 1]],
  [50, 25, [0, 1, 0], [0, 1, 0]],
  [80, 25, [0, 0, 1], [0, 1, 0]],
  [35, 20, [0.5, 0.5, 0], [0.5, 0.5, 0]]
];

for (const [humidity, temperature, expectedHumidity, expectedTemperature] of fuzzificationCases) {
  const result = fuzzifyInputs(humidity, temperature);

  check(`Fuzzificação da umidade ${humidity}%`,
    Object.values(result.humidity).every((value, i) => approximately(value, expectedHumidity[i])));
  check(`Fuzzificação da temperatura ${temperature}°C`,
    Object.values(result.temperature).every((value, i) => approximately(value, expectedTemperature[i])));
}

const defaultFuzzification = fuzzifyInputs(DEFAULT_CONFIG.humidity, DEFAULT_CONFIG.temperature);

check('Três pertinências de umidade na ordem correta',
  equal(Object.keys(defaultFuzzification.humidity), ['seco', 'intermediario', 'umido']));
check('Três pertinências de temperatura na ordem correta',
  equal(Object.keys(defaultFuzzification.temperature), ['baixa', 'media', 'alta']));
check('Graus de pertinência zero são mantidos',
  Object.hasOwn(defaultFuzzification.humidity, 'umido') &&
  Object.hasOwn(defaultFuzzification.temperature, 'baixa') &&
  defaultFuzzification.humidity.umido === 0 &&
  defaultFuzzification.temperature.baixa === 0);
check('Fuzzificação de variável isolada',
  equal(fuzzifyVariable(35, 'humidity'), defaultFuzzification.humidity) &&
  equal(fuzzifyVariable(30, 'temperature'), defaultFuzzification.temperature));
check('Cálculos mantêm a precisão original',
  approximately(fuzzifyInputs(37, 28).humidity.seco, 13 / 30) &&
  approximately(fuzzifyInputs(37, 28).temperature.media, 0.7));
check('Fuzzificação é determinística',
  equal(fuzzifyInputs(35, 30), fuzzifyInputs(35, 30)));
check('Resultados de fuzzificação são independentes', (() => {
  const first = fuzzifyInputs(35, 30);
  first.humidity.seco = 0;
  return fuzzifyInputs(35, 30).humidity.seco === 0.5;
})());
check('Todos os graus ficam entre zero e um', [0, 10, 20, 35, 50, 65, 80, 100].every((humidity) =>
  [10, 15, 20, 25, 30, 35, 40].every((temperature) =>
    Object.values(fuzzifyInputs(humidity, temperature)).every((values) =>
      Object.values(values).every((degree) => Number.isFinite(degree) && degree >= 0 && degree <= 1)))));

function rejectsRange(callback) {
  try {
    callback();
    return false;
  } catch (error) {
    return error instanceof RangeError;
  }
}

check('Umidade abaixo de zero é rejeitada', rejectsRange(() => fuzzifyInputs(-1, 30)));
check('Umidade acima de 100 é rejeitada', rejectsRange(() => fuzzifyInputs(101, 30)));
check('Temperatura abaixo de 10 é rejeitada', rejectsRange(() => fuzzifyInputs(35, 9)));
check('Temperatura acima de 40 é rejeitada', rejectsRange(() => fuzzifyInputs(35, 41)));
check('Umidade vazia é rejeitada', rejects(() => fuzzifyInputs('', 30)));
check('Temperatura vazia é rejeitada', rejects(() => fuzzifyInputs(35, '')));
check('Umidade textual é rejeitada', rejects(() => fuzzifyInputs('35', 30)));
check('Temperatura textual é rejeitada', rejects(() => fuzzifyInputs(35, '30')));
check('Umidade NaN é rejeitada', rejects(() => fuzzifyInputs(NaN, 30)));
check('Temperatura infinita é rejeitada', rejects(() => fuzzifyInputs(35, Infinity)));
check('Umidade nula é rejeitada', rejects(() => fuzzifyInputs(null, 30)));
check('Temperatura indefinida é rejeitada', rejects(() => fuzzifyInputs(35, undefined)));
check('Variável inexistente é rejeitada', rejects(() => fuzzifyVariable(35, 'irrigation')));

const referenceActivations = [0, 0.5, 0.5, 0, 0.5, 0.5, 0, 0, 0];
const evaluated = evaluateRules(defaultFuzzification);

check('Nove regras são avaliadas, incluindo as inativas', evaluated.length === 9);
check('Regras mantêm a ordem e os identificadores',
  equal(evaluated.map(({ id }) => id), DEFAULT_RULES.map(({ id }) => id)));

for (const [index, rule] of evaluated.entries()) {
  check(`${rule.id}: ativação pelo mínimo`, approximately(rule.activation, referenceActivations[index]));
  check(`${rule.id}: antecedentes e consequente preservados`,
    rule.humidity === DEFAULT_RULES[index].humidity &&
    rule.temperature === DEFAULT_RULES[index].temperature &&
    rule.consequent === DEFAULT_RULES[index].consequent);
  check(`${rule.id}: graus e estado de ativação`,
    approximately(rule.humidityDegree, defaultFuzzification.humidity[rule.humidity]) &&
    approximately(rule.temperatureDegree, defaultFuzzification.temperature[rule.temperature]) &&
    rule.active === (rule.activation > 0));
}

check('Apenas R2, R3, R5 e R6 são ativadas no exemplo padrão',
  equal(evaluated.filter(({ active }) => active).map(({ id }) => id), ['R2', 'R3', 'R5', 'R6']));

for (const [humidity, temperature, id] of [[20, 35, 'R3'], [50, 25, 'R5'], [80, 25, 'R8']]) {
  const evaluatedRules = evaluateRules(fuzzifyInputs(humidity, temperature));
  check(`Apenas ${id} é ativada para U=${humidity}, T=${temperature}`,
    evaluatedRules.filter(({ active }) => active).length === 1 &&
    evaluatedRules.find((rule) => rule.id === id).activation === 1 &&
    evaluatedRules.filter((rule) => rule.id !== id).every((rule) => rule.activation === 0));
}

const symmetry = evaluateRules(fuzzifyInputs(35, 20));
check('Simetria ativa R1, R2, R4 e R5 na altura 0,5',
  equal(symmetry.filter(({ active }) => active).map(({ id }) => id), ['R1', 'R2', 'R4', 'R5']) &&
  symmetry.filter(({ active }) => active).every(({ activation }) => approximately(activation, 0.5)));

const editedRules = DEFAULT_RULES.map((rule) => ({ ...rule, consequent: 'curto' }));
const editedEvaluated = evaluateRules(defaultFuzzification, editedRules);
check('Nove consequentes podem ser alterados para curto',
  editedEvaluated.every(({ consequent }) => consequent === 'curto'));
check('Editar consequentes não altera as ativações',
  editedEvaluated.every(({ activation }, i) => approximately(activation, evaluated[i].activation)));
check('Editar consequentes não modifica a base padrão',
  DEFAULT_RULES[1].consequent === 'longo' && DEFAULT_RULES[4].consequent === 'medio');
check('Qualquer consequente válido pode ser selecionado', (() => {
  const rules = DEFAULT_RULES.map((rule) => ({ ...rule }));
  rules[0].consequent = 'curto';
  rules[1].consequent = 'medio';
  rules[2].consequent = 'longo';
  const result = evaluateRules(defaultFuzzification, rules);
  return result[0].consequent === 'curto' && result[1].consequent === 'medio' && result[2].consequent === 'longo';
})());
check('Regras podem ser informadas em outra ordem sem mudar suas ativações', (() => {
  const reverse = evaluateRules(defaultFuzzification, [...DEFAULT_RULES].reverse());
  return reverse.every((rule) => approximately(rule.activation, evaluated.find(({ id }) => id === rule.id).activation));
})());
check('Validação aceita as nove regras padrão', validateRules(DEFAULT_RULES) === true);
check('Avaliação não altera a entrada de fuzzificação',
  equal(defaultFuzzification, fuzzifyInputs(35, 30)));
check('Resultados de regras são independentes entre execuções', (() => {
  const first = evaluateRules(defaultFuzzification);
  first[1].activation = 0;
  return evaluateRules(defaultFuzzification)[1].activation === 0.5;
})());
check('Avaliação de regras é determinística',
  equal(evaluateRules(defaultFuzzification), evaluateRules(defaultFuzzification)));
check('Ativações permanecem entre 0 e 1',
  [0, 20, 35, 50, 80, 100].every((humidity) =>
    [10, 20, 25, 30, 35, 40].every((temperature) =>
      evaluateRules(fuzzifyInputs(humidity, temperature))
        .every(({ activation }) => Number.isFinite(activation) && activation >= 0 && activation <= 1))));

const invalidRules = (change) => {
  const rules = DEFAULT_RULES.map((rule) => ({ ...rule }));
  change(rules);
  return rules;
};

check('Base incompleta é rejeitada', rejects(() => evaluateRules(defaultFuzzification, DEFAULT_RULES.slice(0, 8))));
check('Base vazia é rejeitada', rejects(() => evaluateRules(defaultFuzzification, [])));
check('Base não numérica é rejeitada', rejects(() => evaluateRules(defaultFuzzification, 'R1')));
check('Regras repetidas são rejeitadas', rejects(() => evaluateRules(defaultFuzzification,
  invalidRules((rules) => { rules[1].id = 'R1'; }))));
check('Identificadores inválidos são rejeitados', rejects(() => evaluateRules(defaultFuzzification,
  invalidRules((rules) => { rules[1].id = 'R10'; }))));
check('Antecedente de umidade não pode ser alterado', rejects(() => evaluateRules(defaultFuzzification,
  invalidRules((rules) => { rules[0].humidity = 'umido'; }))));
check('Antecedente de temperatura não pode ser alterado', rejects(() => evaluateRules(defaultFuzzification,
  invalidRules((rules) => { rules[0].temperature = 'alta'; }))));
check('Consequente vazio é rejeitado', rejects(() => evaluateRules(defaultFuzzification,
  invalidRules((rules) => { rules[0].consequent = ''; }))));
check('Consequente inexistente é rejeitado', rejects(() => evaluateRules(defaultFuzzification,
  invalidRules((rules) => { rules[0].consequent = 'enorme'; }))));
check('Regra nula é rejeitada', rejects(() => evaluateRules(defaultFuzzification,
  invalidRules((rules) => { rules[0] = null; }))));
check('Fuzzificação ausente é rejeitada', rejects(() => evaluateRules(null)));
check('Fuzzificação parcial é rejeitada', rejects(() => evaluateRules({ humidity: { seco: 1 } })));
check('Grau NaN é rejeitado', rejects(() => evaluateRules({
  ...defaultFuzzification,
  humidity: { ...defaultFuzzification.humidity, seco: NaN }
})));
check('Grau maior que 1 é rejeitado', rejects(() => evaluateRules({
  ...defaultFuzzification,
  temperature: { ...defaultFuzzification.temperature, media: 1.1 }
})));
check('Grau negativo é rejeitado', rejects(() => evaluateRules({
  ...defaultFuzzification,
  humidity: { ...defaultFuzzification.humidity, seco: -0.1 }
})));
check('Grau textual é rejeitado', rejects(() => evaluateRules({
  ...defaultFuzzification,
  humidity: { ...defaultFuzzification.humidity, seco: '0.5' }
})));
check('Grau infinito é rejeitado', rejects(() => evaluateRules({
  ...defaultFuzzification,
  temperature: { ...defaultFuzzification.temperature, alta: Infinity }
})));
check('Conjuntos incompletos são rejeitados', rejects(() => evaluateRules({
  ...defaultFuzzification,
  humidity: { seco: 0.5, intermediario: 0.5 }
})));
check('Conjuntos extras são rejeitados', rejects(() => evaluateRules({
  ...defaultFuzzification,
  temperature: { ...defaultFuzzification.temperature, extra: 0 }
})));

const implications = applyImplication(evaluated);

check('Implicação preserva as nove regras', implications.length === 9);
check('Implicação mantém a ordem e os identificadores',
  equal(implications.map(({ id }) => id), DEFAULT_RULES.map(({ id }) => id)));
check('Alturas de recorte correspondem às ativações',
  implications.every((rule, i) => approximately(rule.clipHeight, evaluated[i].activation)));
check('Pontos dos consequentes originais são preservados',
  implications.every((rule) => equal(rule.consequentPoints, FUZZY_SETS.irrigation[rule.consequent].points)));
check('Implicação não altera os dados de avaliação das regras',
  equal(evaluated, evaluateRules(defaultFuzzification)));
check('Implicação não altera os conjuntos de saída',
  equal(Object.fromEntries(Object.entries(FUZZY_SETS.irrigation).map(([name, set]) => [name, set.points])),
    { curto: [0, 0, 0, 15], medio: [0, 15, 15, 30], longo: [15, 30, 30, 30] }));

for (const rule of implications) {
  check(`${rule.id}: recorte não ultrapassa a ativação`,
    Array.from({ length: 121 }, (_, i) => i * 0.25).every((z) => {
      const degree = getImpliedMembership(rule, z);
      return degree >= 0 && degree <= rule.activation && degree <= 1;
    }));

  if (rule.activation === 0) {
    check(`${rule.id}: ativação zero produz contribuição nula`,
      [0, 3, 7.5, 15, 22.5, 30].every((z) => getImpliedMembership(rule, z) === 0));
  }
}

const r2Implication = implications.find(({ id }) => id === 'R2');
const r3Implication = implications.find(({ id }) => id === 'R3');
const r5Implication = implications.find(({ id }) => id === 'R5');
const r6Implication = implications.find(({ id }) => id === 'R6');

for (const [z, expected] of [[0, 0], [15, 0], [18, 0.2], [22.5, 0.5], [30, 0.5]]) {
  check(`R2: consequente longo recortado em z=${z}`,
    approximately(getImpliedMembership(r2Implication, z), expected));
}

for (const [z, expected] of [[0, 0], [3, 0.2], [7.5, 0.5], [15, 0.5], [22.5, 0.5], [30, 0]]) {
  check(`R5: consequente médio recortado em z=${z}`,
    approximately(getImpliedMembership(r5Implication, z), expected));
}

check('R2, R3 e R6 produzem o mesmo recorte longo',
  [0, 3, 15, 18, 22.5, 30].every((z) =>
    approximately(getImpliedMembership(r2Implication, z), getImpliedMembership(r3Implication, z)) &&
    approximately(getImpliedMembership(r2Implication, z), getImpliedMembership(r6Implication, z))));
check('A implicação não soma regras com o mesmo consequente',
  [15, 22.5, 30].every((z) =>
    Math.max(getImpliedMembership(r2Implication, z), getImpliedMembership(r3Implication, z),
      getImpliedMembership(r6Implication, z)) <= 0.5));

for (const [humidity, temperature, id, consequent, sample] of [
  [20, 35, 'R3', 'longo', 30],
  [50, 25, 'R5', 'medio', 15],
  [80, 25, 'R8', 'curto', 0]
]) {
  const single = applyImplication(evaluateRules(fuzzifyInputs(humidity, temperature)));
  check(`${id}: ativação um preserva o consequente original`,
    single.find((rule) => rule.id === id).clipHeight === 1 &&
    approximately(getImpliedMembership(single.find((rule) => rule.id === id), sample),
      calculateMembership(sample, FUZZY_SETS.irrigation[consequent].points)) &&
    single.filter((rule) => rule.id !== id).every((rule) =>
      [0, 7.5, 15, 22.5, 30].every((z) => getImpliedMembership(rule, z) === 0)));
}

const customActivations = [0, 0.25, 0.5, 0.75, 1].map((activation) =>
  applyImplication(evaluated.map((rule) => ({ ...rule, activation })))[1]);

for (const [index, activation] of [0, 0.25, 0.5, 0.75, 1].entries()) {
  const implication = customActivations[index];
  check(`Recorte com ativação ${activation}`,
    approximately(getImpliedMembership(implication, 22.5), Math.min(activation, 0.5)) &&
    approximately(getImpliedMembership(implication, 30), activation));
}

const editedImplications = applyImplication(editedEvaluated);
check('Consequentes editados usam os pontos do conjunto curto',
  editedImplications.every((rule) => equal(rule.consequentPoints, [0, 0, 0, 15])));
check('Consequentes editados produzem recortes do conjunto curto',
  editedImplications.every((rule) =>
    approximately(getImpliedMembership(rule, 0), rule.clipHeight) &&
    getImpliedMembership(rule, 30) === 0));
check('Consequentes editados não alteram as alturas de recorte',
  editedImplications.every((rule, i) => rule.clipHeight === implications[i].clipHeight));
check('Implicação funciona com regras em ordem diferente', (() => {
  const reversed = applyImplication([...evaluated].reverse());
  return reversed.every((rule) => {
    const original = implications.find((item) => item.id === rule.id);
    return [0, 7.5, 15, 22.5, 30].every((z) =>
      approximately(getImpliedMembership(rule, z), getImpliedMembership(original, z)));
  });
})());
check('Implicação é determinística',
  equal(applyImplication(evaluated), applyImplication(evaluated)));
check('Implicações permanecem independentes dos dados de origem', (() => {
  const source = evaluateRules(defaultFuzzification);
  const result = applyImplication(source);
  source[1].activation = 0;
  return result[1].clipHeight === 0.5 &&
    approximately(getImpliedMembership(result[1], 30), 0.5);
})());
check('Consultar o recorte não modifica seus parâmetros', (() => {
  const before = { ...r2Implication };
  getImpliedMembership(r2Implication, 22.5);
  return equal(r2Implication, before);
})());
check('Consulta fora do suporte retorna zero',
  getImpliedMembership(r2Implication, -1) === 0 &&
  getImpliedMembership(r2Implication, 31) === 0);
check('Alturas de recorte inválidas são rejeitadas',
  [NaN, Infinity, -0.1, 1.1, '0.5', null].every((height) =>
    rejects(() => getImpliedMembership({ ...r2Implication, clipHeight: height }, 22.5))));
check('Valor de saída não finito é rejeitado',
  rejects(() => getImpliedMembership(r2Implication, NaN)) &&
  rejects(() => getImpliedMembership(r2Implication, Infinity)));
check('Recortes com regras incompletas são rejeitados',
  rejects(() => applyImplication(evaluated.slice(0, 8))));
check('Recortes com consequentemente inválido são rejeitados',
  rejects(() => applyImplication(evaluated.map((rule) =>
    rule.id === 'R2' ? { ...rule, consequent: 'invalido' } : rule))));
check('Recortes com ativação negativa são rejeitados',
  rejects(() => applyImplication(evaluated.map((rule) =>
    rule.id === 'R2' ? { ...rule, activation: -0.1 } : rule))));
check('Recortes com ativação maior que um são rejeitados',
  rejects(() => applyImplication(evaluated.map((rule) =>
    rule.id === 'R2' ? { ...rule, activation: 1.1 } : rule))));
check('Recortes com ativação não finita são rejeitados',
  rejects(() => applyImplication(evaluated.map((rule) =>
    rule.id === 'R2' ? { ...rule, activation: NaN } : rule))));

const aggregation = aggregateImplications(implications);

check('Agregação mantém as nove contribuições', aggregation.implications.length === 9);
check('Agregação preserva os identificadores e os consequentes',
  equal(aggregation.implications.map(({ id, consequent }) => [id, consequent]),
    implications.map(({ id, consequent }) => [id, consequent])));
check('Agregação não altera os recortes de entrada',
  equal(implications, applyImplication(evaluated)));

for (const [z, expected] of [
  [0, 0], [3, 0.2], [7.5, 0.5], [10, 0.5], [15, 0.5], [18, 0.5],
  [22.5, 0.5], [25, 0.5], [30, 0.5]
]) {
  check(`Agregação padrão em z=${z}: ${expected}`,
    approximately(getAggregatedMembership(aggregation, z), expected));
}

check('Agregação padrão corresponde à função definida no enunciado',
  Array.from({ length: 121 }, (_, i) => i * 0.25).every((z) =>
    approximately(getAggregatedMembership(aggregation, z), z <= 7.5 ? z / 15 : 0.5)));
check('A agregação utiliza o máximo de todos os recortes',
  Array.from({ length: 121 }, (_, i) => i * 0.25).every((z) =>
    approximately(getAggregatedMembership(aggregation, z),
      Math.max(...implications.map((rule) => getImpliedMembership(rule, z))))));
check('Três regras com consequente longo não somam suas alturas',
  approximately(getAggregatedMembership(aggregation, 30), 0.5) &&
  approximately(getAggregatedMembership(aggregation, 22.5), 0.5));
check('Contribuições com consequentes diferentes são consideradas',
  approximately(getAggregatedMembership(aggregation, 7.5), 0.5) &&
  approximately(getAggregatedMembership(aggregation, 30), 0.5));
check('Graus agregados permanecem entre zero e um',
  Array.from({ length: 301 }, (_, i) => i / 10).every((z) => {
    const degree = getAggregatedMembership(aggregation, z);
    return Number.isFinite(degree) && degree >= 0 && degree <= 1;
  }));
check('Consulta fora do suporte devolve zero',
  getAggregatedMembership(aggregation, -1) === 0 &&
  getAggregatedMembership(aggregation, 31) === 0);

for (const [humidity, temperature, expectedRule, consequent] of [
  [20, 35, 'R3', 'longo'],
  [50, 25, 'R5', 'medio'],
  [80, 25, 'R8', 'curto']
]) {
  const single = aggregateImplications(
    applyImplication(evaluateRules(fuzzifyInputs(humidity, temperature))));
  check(`Agregação de regra única ${expectedRule} mantém o conjunto ${consequent}`,
    [0, 3, 7.5, 15, 18, 22.5, 30].every((z) =>
      approximately(getAggregatedMembership(single, z),
        calculateMembership(z, FUZZY_SETS.irrigation[consequent].points))));
}

const symmetricalAggregation = aggregateImplications(
  applyImplication(evaluateRules(fuzzifyInputs(35, 20))));
check('Simetria resulta em pertinência 0,5 de 0 a 30 minutos',
  Array.from({ length: 121 }, (_, i) => i * 0.25).every((z) =>
    approximately(getAggregatedMembership(symmetricalAggregation, z), 0.5)));

const allShortAggregation = aggregateImplications(editedImplications);
check('Todos os consequentes alterados para curto produzem somente o conjunto curto recortado',
  [0, 3, 7.5, 15, 22.5, 30].every((z) =>
    approximately(getAggregatedMembership(allShortAggregation, z),
      Math.min(0.5, calculateMembership(z, FUZZY_SETS.irrigation.curto.points)))));
check('Edição não modifica a agregação padrão já calculada',
  approximately(getAggregatedMembership(aggregation, 30), 0.5));
check('Agregação independe da ordem das regras', (() => {
  const reversed = aggregateImplications([...implications].reverse());
  return Array.from({ length: 121 }, (_, i) => i * 0.25).every((z) =>
    approximately(getAggregatedMembership(aggregation, z), getAggregatedMembership(reversed, z)));
})());
check('Agregação é determinística',
  equal(aggregateImplications(implications), aggregateImplications(implications)));
check('Agregação preserva cópias independentes dos recortes', (() => {
  const source = applyImplication(evaluated);
  const combined = aggregateImplications(source);
  source[1].clipHeight = 0;
  source[1].consequentPoints = [0, 0, 0, 15];
  return approximately(getAggregatedMembership(combined, 30), 0.5);
})());
check('Consultar a agregação não modifica seus dados', (() => {
  const snapshot = JSON.stringify(aggregation);
  getAggregatedMembership(aggregation, 22.5);
  return JSON.stringify(aggregation) === snapshot;
})());
check('Agregação rejeita lista incompleta', rejects(() => aggregateImplications(implications.slice(0, 8))));
check('Agregação rejeita lista vazia', rejects(() => aggregateImplications([])));
check('Agregação rejeita valor nulo', rejects(() => aggregateImplications(null)));
check('Agregação rejeita recortes duplicados', rejects(() =>
  aggregateImplications(implications.map((rule, i) => i === 1 ? implications[0] : rule))));
check('Agregação rejeita altura negativa', rejects(() => aggregateImplications(implications.map((rule) =>
  rule.id === 'R2' ? { ...rule, clipHeight: -0.1 } : rule))));
check('Agregação rejeita altura acima de um', rejects(() => aggregateImplications(implications.map((rule) =>
  rule.id === 'R2' ? { ...rule, clipHeight: 1.1 } : rule))));
check('Agregação rejeita altura não finita', rejects(() => aggregateImplications(implications.map((rule) =>
  rule.id === 'R2' ? { ...rule, clipHeight: NaN } : rule))));
check('Agregação rejeita altura diferente da ativação', rejects(() => aggregateImplications(implications.map((rule) =>
  rule.id === 'R2' ? { ...rule, clipHeight: 0.25 } : rule))));
check('Agregação rejeita pontos de consequente incoerentes', rejects(() => aggregateImplications(implications.map((rule) =>
  rule.id === 'R2' ? { ...rule, consequentPoints: [0, 0, 0, 15] } : rule))));
check('Agregação rejeita pontos incompletos', rejects(() => aggregateImplications(implications.map((rule) =>
  rule.id === 'R2' ? { ...rule, consequentPoints: [15, 30] } : rule))));
check('Consulta rejeita agregação ausente', rejects(() => getAggregatedMembership(null, 15)));
check('Consulta rejeita agregação incompleta', rejects(() => getAggregatedMembership({ implications: [] }, 15)));
check('Consulta rejeita valores não finitos',
  rejects(() => getAggregatedMembership(aggregation, NaN)) &&
  rejects(() => getAggregatedMembership(aggregation, Infinity)));
check('Consulta rejeita valor textual', rejects(() => getAggregatedMembership(aggregation, '15')));

function buildAggregation(humidity, temperature, rules = DEFAULT_RULES) {
  return aggregateImplications(applyImplication(evaluateRules(fuzzifyInputs(humidity, temperature), rules)));
}

const centroidReferences = [
  [20, 35, 25, 'R3'],
  [50, 25, 15, 'R5'],
  [80, 25, 5, 'R8'],
  [35, 30, 16.785683, 'sobreposição'],
  [35, 20, 15, 'simetria']
];

for (const [humidity, temperature, expected, caseName] of centroidReferences) {
  const result = calculateCentroid(buildAggregation(humidity, temperature), 0.1);
  check(`Centroide ${caseName}: ${expected} min`, result.valid &&
    Math.abs(result.time - expected) <= 0.01);
  check(`Centroide ${caseName} permanece no domínio`, result.time >= 0 && result.time <= 30);
  check(`Centroide ${caseName} possui somatórios válidos`,
    Number.isFinite(result.numerator) && Number.isFinite(result.denominator) && result.denominator > 0);
}

const centroidPrecision = [
  [0.1, 300, 16.785683],
  [0.05, 600, 16.785706],
  [0.01, 3000, 16.785714]
];

for (const [step, count, expected] of centroidPrecision) {
  const result = calculateCentroid(aggregation, step);
  check(`Passo ${step}: usa ${count} pontos médios`,
    result.valid && result.sampleCount === count && result.step === step);
  check(`Passo ${step}: centroide numérico de referência`,
    Math.abs(result.time - expected) <= 0.000001);
  check(`Passo ${step}: exibição com duas casas`, result.time.toFixed(2) === '16.79');
  check(`Passo ${step}: usa a soma ponderada pelo denominador`,
    Math.abs(result.time - result.numerator / result.denominator) < 1e-12);
}

const preciseCentroid = calculateCentroid(aggregation, 0.1);
const continuousCentroid = 16.785714285714285;

check('Passo padrão é 0,1 minuto',
  equal(calculateCentroid(aggregation), calculateCentroid(aggregation, 0.1)));
check('Precisão interna não é arredondada para duas casas',
  preciseCentroid.time !== Number(preciseCentroid.time.toFixed(2)));
check('Reduzir o passo aproxima o centroide contínuo',
  centroidPrecision.map(([step]) => Math.abs(calculateCentroid(aggregation, step).time - continuousCentroid))
    .every((error, index, errors) => index === 0 || error < errors[index - 1]));
check('Centroide de simetria é exatamente 15 minutos',
  Math.abs(calculateCentroid(symmetricalAggregation).time - 15) < 1e-10);
check('Todas as regras alteradas para curto produzem 5 minutos',
  Math.abs(calculateCentroid(buildAggregation(50, 25, editedRules)).time - 5) <= 0.01);
check('Restaurar a base padrão mantém o centroide de 16,79 minutos',
  calculateCentroid(buildAggregation(35, 30)).time.toFixed(2) === '16.79');
check('Centroide independe da ordem das regras',
  Math.abs(calculateCentroid(aggregateImplications([...implications].reverse())).time -
    preciseCentroid.time) < 1e-12);
check('Centroide não altera a agregação recebida', (() => {
  const previous = JSON.stringify(aggregation);
  calculateCentroid(aggregation, 0.01);
  return JSON.stringify(aggregation) === previous;
})());
check('Cálculo do centroide é determinístico',
  equal(calculateCentroid(aggregation, 0.05), calculateCentroid(aggregation, 0.05)));

const zeroDegrees = {
  humidity: { seco: 0, intermediario: 0, umido: 0 },
  temperature: { baixa: 0, media: 0, alta: 0 }
};
const emptyAggregation = aggregateImplications(applyImplication(evaluateRules(zeroDegrees)));
const emptyCentroid = calculateCentroid(emptyAggregation);

check('Área agregada vazia é identificada explicitamente',
  emptyCentroid.valid === false && emptyCentroid.time === null &&
  emptyCentroid.denominator === 0 && emptyCentroid.numerator === 0 &&
  typeof emptyCentroid.message === 'string' && emptyCentroid.message.length > 0);
check('Área vazia não retorna zero, NaN ou infinito como recomendação',
  emptyCentroid.time === null && emptyCentroid.sampleCount === 300);
check('Área vazia é identificada nas três precisões',
  DEFUZZIFICATION_STEPS.every((step) => {
    const result = calculateCentroid(emptyAggregation, step);
    return !result.valid && result.time === null && result.denominator === 0;
  }));

check('Centroide rejeita agregação ausente', rejects(() => calculateCentroid(null)));
check('Centroide rejeita agregação incompleta',
  rejects(() => calculateCentroid({ implications: [] })));
for (const step of [-0.1, 0, 0.001, 0.2, NaN, Infinity, -Infinity, '0.1', '', null]) {
  check(`Centroide rejeita passo inválido ${String(step)}`,
    rejectsRange(() => calculateCentroid(aggregation, step)));
}

const simulation = runSimulation();
const fullConfiguration = { ...DEFAULT_CONFIG, rules: DEFAULT_RULES };

check('Simulador usa os valores iniciais quando não recebe argumentos',
  equal(simulation.configuration, fullConfiguration));
check('Simulador preserva o nome e a ordem das cinco operações',
  equal(simulation.stages.map(({ label }) => label), INFERENCE_STAGES));
check('Simulador identifica cada operação de maneira estável',
  equal(simulation.stages.map(({ id }) => id),
    ['fuzzification', 'evaluation', 'implication', 'aggregation', 'defuzzification']));
check('Cada etapa apresenta o mesmo resultado do cálculo completo',
  simulation.stages.every(({ id, result }) => result === simulation[id]));
check('Fuzzificação integrada corresponde ao cálculo isolado',
  equal(simulation.fuzzification, defaultFuzzification));
check('Avaliação integrada corresponde ao cálculo isolado',
  equal(simulation.evaluation, evaluated));
check('Implicação integrada corresponde ao cálculo isolado',
  equal(simulation.implication, implications));
check('Agregação integrada corresponde ao cálculo isolado',
  equal(simulation.aggregation, aggregation));
check('Defuzzificação integrada corresponde ao cálculo isolado',
  equal(simulation.defuzzification, preciseCentroid));
check('Resultado padrão da inferência completa é 16,79 minutos',
  simulation.defuzzification.valid && simulation.defuzzification.time.toFixed(2) === '16.79');
check('Cálculo completo mantém precisão numérica interna',
  Math.abs(simulation.defuzzification.time - 16.785683) < 1e-6 &&
  simulation.defuzzification.time !== 16.79);
check('Resultado completo preserva as nove regras, inclusive as inativas',
  simulation.configuration.rules.length === 9 && simulation.evaluation.length === 9 &&
  simulation.implication.length === 9 && simulation.aggregation.implications.length === 9);
check('Resultado completo mantém todas as pertinências de grau zero',
  simulation.fuzzification.humidity.umido === 0 &&
  simulation.fuzzification.temperature.baixa === 0);
check('Resultado completo ativa apenas R2, R3, R5 e R6',
  equal(simulation.evaluation.filter(({ active }) => active).map(({ id }) => id),
    ['R2', 'R3', 'R5', 'R6']));
check('Soma de ativações não é confundida com agregação',
  Math.abs(getAggregatedMembership(simulation.aggregation, 30) - 0.5) < 1e-12);
check('Simulador informa somatórios e quantidade de amostras',
  simulation.defuzzification.sampleCount === 300 &&
  simulation.defuzzification.numerator > 0 && simulation.defuzzification.denominator > 0);
check('Simulador mantém os dados necessários à inspeção das regras',
  simulation.evaluation.every((rule) => Number.isFinite(rule.humidityDegree) &&
    Number.isFinite(rule.temperatureDegree) && Number.isFinite(rule.activation)));
check('As saídas intermediárias permitem avaliar recortes individualmente',
  approximately(getImpliedMembership(simulation.implication[1], 30), 0.5));

for (const [humidity, temperature, expectedTime, name] of centroidReferences) {
  const result = runSimulation({ humidity, temperature, step: 0.1 });
  check(`Integração: ${name} produz ${expectedTime} min`, result.defuzzification.valid &&
    Math.abs(result.defuzzification.time - expectedTime) <= 0.01);
  check(`Integração: ${name} tem cinco resultados intermediários`,
    result.stages.length === 5 && result.stages.every(({ result: data }) => data !== undefined));
}

for (const [step, count, expected] of centroidPrecision) {
  const result = runSimulation({ humidity: 35, temperature: 30, step });
  check(`Integração: passo ${step} usa ${count} pontos médios`,
    result.defuzzification.sampleCount === count && result.defuzzification.step === step);
  check(`Integração: passo ${step} retorna a referência do professor`,
    Math.abs(result.defuzzification.time - expected) <= 1e-6);
}

const allShortResult = runSimulation({ humidity: 50, temperature: 25, step: 0.1, rules: editedRules });
check('Alterar todos os consequentes para curto altera o resultado numérico',
  allShortResult.defuzzification.valid &&
  Math.abs(allShortResult.defuzzification.time - 5) < 0.01);
check('Alterar consequentes não altera intensidades de ativação',
  allShortResult.evaluation.every((rule, i) =>
    rule.activation === evaluateRules(fuzzifyInputs(50, 25))[i].activation));
check('Simulador recebe consequentes mistos e os mantém no retorno', (() => {
  const rules = DEFAULT_RULES.map((rule) => ({ ...rule }));
  rules[1].consequent = 'curto';
  rules[4].consequent = 'longo';
  const result = runSimulation({ ...DEFAULT_CONFIG, rules });
  return result.configuration.rules[1].consequent === 'curto' &&
    result.configuration.rules[4].consequent === 'longo' &&
    result.evaluation[1].consequent === 'curto' &&
    result.implication[4].consequent === 'longo';
})());
check('Regras enviadas não são modificadas durante a execução', (() => {
  const rules = DEFAULT_RULES.map((rule) => ({ ...rule }));
  const snapshot = JSON.stringify(rules);
  runSimulation({ ...DEFAULT_CONFIG, rules });
  return JSON.stringify(rules) === snapshot;
})());
check('A configuração retornada não mantém referência às regras editáveis', (() => {
  const rules = DEFAULT_RULES.map((rule) => ({ ...rule }));
  const result = runSimulation({ ...DEFAULT_CONFIG, rules });
  rules[1].consequent = 'curto';
  return result.configuration.rules[1].consequent === 'longo';
})());
check('Uma execução não altera os padrões de outra execução', (() => {
  const first = runSimulation({ ...DEFAULT_CONFIG, rules: editedRules });
  const second = runSimulation();
  return first.configuration.rules[1].consequent === 'curto' &&
    second.configuration.rules[1].consequent === 'longo' &&
    second.defuzzification.time.toFixed(2) === '16.79';
})());
check('Executar a mesma configuração produz resultados iguais',
  equal(runSimulation(fullConfiguration), runSimulation(fullConfiguration)));
check('A execução integrada não modifica os valores e regras padrão',
  equal(DEFAULT_CONFIG, { humidity: 35, temperature: 30, step: 0.1 }) &&
  equal(DEFAULT_RULES.map(({ id, consequent }) => [id, consequent]),
    [['R1', 'medio'], ['R2', 'longo'], ['R3', 'longo'], ['R4', 'curto'],
      ['R5', 'medio'], ['R6', 'longo'], ['R7', 'curto'], ['R8', 'curto'], ['R9', 'curto']]));
check('Ordem das regras não altera a saída integrada', (() => {
  const reverse = runSimulation({ ...DEFAULT_CONFIG, rules: [...DEFAULT_RULES].reverse() });
  return Math.abs(reverse.defuzzification.time - simulation.defuzzification.time) < 1e-12 &&
    [0, 3, 7.5, 15, 30].every((z) => approximately(
      getAggregatedMembership(reverse.aggregation, z),
      getAggregatedMembership(simulation.aggregation, z)));
})());
check('Alterar resultado de uma execução não afeta a seguinte', (() => {
  const first = runSimulation();
  first.evaluation[1].activation = 0;
  first.configuration.rules[1].consequent = 'curto';
  first.fuzzification.humidity.seco = 0;
  const second = runSimulation();
  return second.evaluation[1].activation === 0.5 &&
    second.configuration.rules[1].consequent === 'longo' &&
    second.fuzzification.humidity.seco === 0.5;
})());

check('Simulador rejeita configuração nula', rejects(() => runSimulation(null)));
check('Simulador rejeita configuração textual', rejects(() => runSimulation('irrigar')));
check('Simulador rejeita configuração em lista', rejects(() => runSimulation([])));
check('Simulador rejeita umidade ausente', rejects(() => runSimulation({ temperature: 30, step: 0.1 })));
check('Simulador rejeita temperatura ausente', rejects(() => runSimulation({ humidity: 35, step: 0.1 })));
check('Simulador rejeita umidade vazia', rejects(() => runSimulation({ humidity: '', temperature: 30, step: 0.1 })));
check('Simulador rejeita temperatura textual', rejects(() => runSimulation({ humidity: 35, temperature: '30', step: 0.1 })));
check('Simulador rejeita umidade NaN', rejects(() => runSimulation({ humidity: NaN, temperature: 30, step: 0.1 })));
check('Simulador rejeita temperatura infinita', rejects(() => runSimulation({ humidity: 35, temperature: Infinity, step: 0.1 })));
check('Simulador rejeita umidade fora do domínio', rejectsRange(() => runSimulation({ humidity: -1, temperature: 30, step: 0.1 })));
check('Simulador rejeita temperatura fora do domínio', rejectsRange(() => runSimulation({ humidity: 35, temperature: 41, step: 0.1 })));
check('Simulador rejeita passo não informado', rejectsRange(() => runSimulation({ humidity: 35, temperature: 30 })));
check('Simulador rejeita passo nulo', rejectsRange(() => runSimulation({ humidity: 35, temperature: 30, step: null })));
check('Simulador rejeita passo textual', rejectsRange(() => runSimulation({ humidity: 35, temperature: 30, step: '0.1' })));
check('Simulador rejeita passo não permitido', rejectsRange(() => runSimulation({ humidity: 35, temperature: 30, step: 0.2 })));
check('Simulador rejeita regras incompletas', rejects(() => runSimulation({ ...DEFAULT_CONFIG, rules: DEFAULT_RULES.slice(0, 8) })));
check('Simulador rejeita alteração de antecedentes', rejects(() => runSimulation({ ...DEFAULT_CONFIG,
  rules: invalidRules((rules) => { rules[0].humidity = 'umido'; }) })));
check('Simulador rejeita consequentes não preenchidos', rejects(() => runSimulation({ ...DEFAULT_CONFIG,
  rules: invalidRules((rules) => { rules[0].consequent = ''; }) })));

const modules = ['membership', 'inference', 'defuzzification', 'simulator', 'charts'];

for (const moduleName of modules) {
  try {
    await import(`../js/${moduleName}.js`);
    check(`Módulo ${moduleName} carregado`, true);
  } catch {
    check(`Módulo ${moduleName} carregado`, false);
  }
}


// Os testes originais permanecem; os novos grupos ampliam a cobertura da aplicação.
runStateTests((name, passed) => check(name, passed, 'Estado e validação'));
runChartTests((name, passed) => check(name, passed, 'Gráficos SVG'));
await runUITests((name, passed) => check(name, passed, 'Interface real'));

results.replaceChildren();

const groups = [...new Set(tests.map((test) => test.group))];
for (const groupName of groups) {
  const groupTests = tests.filter((test) => test.group === groupName);
  const groupPassed = groupTests.filter((test) => test.passed).length;
  const section = document.createElement('section');
  section.className = 'test-group';
  const heading = document.createElement('h2');
  heading.className = 'test-group-title';
  heading.textContent = `${groupName} — ${groupPassed}/${groupTests.length} aprovados`;
  section.append(heading);

  for (const test of groupTests) {
    const row = document.createElement('div');
    const label = document.createElement('strong');
    const state = document.createElement('span');
    row.className = 'test-result';
    label.textContent = test.name;
    state.className = test.passed ? 'test-pass' : 'test-fail';
    state.textContent = test.passed ? 'Aprovado' : 'Falhou';
    row.append(label, state);
    section.append(row);
  }
  results.append(section);
}


const passed = tests.filter((test) => test.passed).length;
summary.textContent = `${passed} de ${tests.length} testes aprovados.`;
summary.dataset.passed = String(passed);
summary.dataset.total = String(tests.length);
summary.classList.toggle('test-fail', passed !== tests.length);
summary.classList.toggle('test-pass', passed === tests.length);
document.title = originalPageTitle;
