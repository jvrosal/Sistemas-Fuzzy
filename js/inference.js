import { DEFAULT_RULES, FUZZY_SETS } from './constants.js';
import { calculateMembership } from './membership.js';

export function validateRules(rules) {
  if (!Array.isArray(rules) || rules.length !== DEFAULT_RULES.length) {
    throw new TypeError('A base deve conter as nove regras completas.');
  }

  const defaults = new Map(DEFAULT_RULES.map((rule) => [rule.id, rule]));
  const seen = new Set();

  for (const rule of rules) {
    if (!rule || typeof rule !== 'object') {
      throw new TypeError('Todas as regras devem estar preenchidas.');
    }

    const original = defaults.get(rule.id);

    if (!original || seen.has(rule.id)) {
      throw new TypeError('A base contém identificadores de regras inválidos ou repetidos.');
    }

    if (rule.humidity !== original.humidity || rule.temperature !== original.temperature) {
      throw new TypeError('Os antecedentes das regras não podem ser modificados.');
    }

    if (!Object.hasOwn(FUZZY_SETS.irrigation, rule.consequent)) {
      throw new TypeError('O consequente deve ser curto, médio ou longo.');
    }

    seen.add(rule.id);
  }

  return true;
}

function validateFuzzification(fuzzification) {
  if (!fuzzification || typeof fuzzification !== 'object') {
    throw new TypeError('Os graus de pertinência são obrigatórios.');
  }

  for (const variable of ['humidity', 'temperature']) {
    const degrees = fuzzification[variable];
    const names = Object.keys(FUZZY_SETS[variable]);

    if (!degrees || typeof degrees !== 'object' || Object.keys(degrees).length !== names.length) {
      throw new TypeError(`Os três graus de ${variable} são obrigatórios.`);
    }

    for (const name of names) {
      const degree = degrees[name];

      if (!Object.hasOwn(degrees, name) || !Number.isFinite(degree) || degree < 0 || degree > 1) {
        throw new TypeError('Todos os graus de pertinência devem estar entre 0 e 1.');
      }
    }
  }
}

export function evaluateRules(fuzzification, rules = DEFAULT_RULES) {
  validateFuzzification(fuzzification);
  validateRules(rules);

  return rules.map(({ id, humidity, temperature, consequent }) => {
    const humidityDegree = fuzzification.humidity[humidity];
    const temperatureDegree = fuzzification.temperature[temperature];
    const activation = Math.min(humidityDegree, temperatureDegree);

    return {
      id,
      humidity,
      temperature,
      consequent,
      humidityDegree,
      temperatureDegree,
      activation,
      active: activation > 0
    };
  });
}

export function applyImplication(evaluatedRules) {
  validateRules(evaluatedRules);

  return evaluatedRules.map((rule) => {
    if (!Number.isFinite(rule.activation) || rule.activation < 0 || rule.activation > 1) {
      throw new TypeError('A ativação da regra deve estar entre 0 e 1.');
    }

    return {
      ...rule,
      clipHeight: rule.activation,
      consequentPoints: FUZZY_SETS.irrigation[rule.consequent].points
    };
  });
}

export function getImpliedMembership(implication, value) {
  if (!implication || typeof implication !== 'object' ||
      !Number.isFinite(implication.clipHeight) ||
      implication.clipHeight < 0 || implication.clipHeight > 1) {
    throw new TypeError('A implicação precisa de uma altura de recorte válida.');
  }

  return Math.min(
    implication.clipHeight,
    calculateMembership(value, implication.consequentPoints)
  );
}

export function aggregateImplications(implications) {
  validateRules(implications);

  return {
    implications: implications.map((rule) => {
      const originalPoints = FUZZY_SETS.irrigation[rule.consequent].points;

      if (
        !Number.isFinite(rule.clipHeight) ||
        rule.clipHeight < 0 || rule.clipHeight > 1 ||
        rule.clipHeight !== rule.activation ||
        !Array.isArray(rule.consequentPoints) ||
        rule.consequentPoints.length !== originalPoints.length ||
        rule.consequentPoints.some((point, index) => point !== originalPoints[index])
      ) {
        throw new TypeError('As implicações devem conter recortes válidos das nove regras.');
      }

      return { ...rule, consequentPoints: [...rule.consequentPoints] };
    })
  };
}

export function getAggregatedMembership(aggregation, value) {
  if (!aggregation || !Array.isArray(aggregation.implications) || aggregation.implications.length !== 9) {
    throw new TypeError('A agregação deve conter os recortes das nove regras.');
  }

  if (!Number.isFinite(value)) {
    throw new TypeError('O tempo de irrigação deve ser um número finito.');
  }

  return aggregation.implications.reduce(
    (maximum, implication) => Math.max(maximum, getImpliedMembership(implication, value)),
    0
  );
}