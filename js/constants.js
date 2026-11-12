export const APP_INFO = Object.freeze({
  title: 'Simulador Fuzzy Mamdani',
  stage: 1
});

export const INFERENCE_STAGES = Object.freeze([
  'Fuzzificação',
  'Avaliação das regras',
  'Implicação',
  'Agregação',
  'Defuzzificação'
]);

export const DOMAINS = Object.freeze({
  humidity: Object.freeze({ label: 'Umidade do solo', unit: '%', min: 0, max: 100 }),
  temperature: Object.freeze({ label: 'Temperatura', unit: '°C', min: 10, max: 40 }),
  irrigation: Object.freeze({ label: 'Tempo de irrigação', unit: 'min', min: 0, max: 30 })
});

const fuzzySet = (label, points) => Object.freeze({
  label,
  points: Object.freeze(points)
});

export const FUZZY_SETS = Object.freeze({
  humidity: Object.freeze({
    seco: fuzzySet('Seco', [0, 0, 20, 50]),
    intermediario: fuzzySet('Intermediário', [20, 50, 50, 80]),
    umido: fuzzySet('Úmido', [50, 80, 100, 100])
  }),
  temperature: Object.freeze({
    baixa: fuzzySet('Baixa', [10, 10, 15, 25]),
    media: fuzzySet('Média', [15, 25, 25, 35]),
    alta: fuzzySet('Alta', [25, 35, 40, 40])
  }),
  irrigation: Object.freeze({
    curto: fuzzySet('Curto', [0, 0, 0, 15]),
    medio: fuzzySet('Médio', [0, 15, 15, 30]),
    longo: fuzzySet('Longo', [15, 30, 30, 30])
  })
});

export const DEFUZZIFICATION_STEPS = Object.freeze([0.1, 0.05, 0.01]);

export const DEFAULT_CONFIG = Object.freeze({
  humidity: 35,
  temperature: 30,
  step: 0.1
});

export const DEFAULT_RULES = Object.freeze([
  { id: 'R1', humidity: 'seco', temperature: 'baixa', consequent: 'medio' },
  { id: 'R2', humidity: 'seco', temperature: 'media', consequent: 'longo' },
  { id: 'R3', humidity: 'seco', temperature: 'alta', consequent: 'longo' },
  { id: 'R4', humidity: 'intermediario', temperature: 'baixa', consequent: 'curto' },
  { id: 'R5', humidity: 'intermediario', temperature: 'media', consequent: 'medio' },
  { id: 'R6', humidity: 'intermediario', temperature: 'alta', consequent: 'longo' },
  { id: 'R7', humidity: 'umido', temperature: 'baixa', consequent: 'curto' },
  { id: 'R8', humidity: 'umido', temperature: 'media', consequent: 'curto' },
  { id: 'R9', humidity: 'umido', temperature: 'alta', consequent: 'curto' }
].map((rule) => Object.freeze(rule)));