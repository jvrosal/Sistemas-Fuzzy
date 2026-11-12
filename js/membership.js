import { DOMAINS, FUZZY_SETS } from './constants.js';

export function calculateMembership(value, points) {
  if (!Number.isFinite(value)) {
    throw new TypeError('O valor de entrada deve ser um número finito.');
  }

  if (
    !Array.isArray(points) ||
    points.length !== 4 ||
    !points.every(Number.isFinite) ||
    points.some((point, index) => index > 0 && point < points[index - 1])
  ) {
    throw new TypeError('O conjunto fuzzy deve ter quatro pontos finitos e ordenados.');
  }

  const [a, b, c, d] = points;

  if (value >= b && value <= c) {
    return 1;
  }

  if (value < a || value > d) {
    return 0;
  }

  if (value >= a && value < b) {
    return (value - a) / (b - a);
  }

  if (value > c && value <= d) {
    return (d - value) / (d - c);
  }

  return 0;
}

export function fuzzifyVariable(value, variable) {
  if (variable !== 'humidity' && variable !== 'temperature') {
    throw new TypeError('A variável deve ser umidade ou temperatura.');
  }

  if (!Number.isFinite(value)) {
    throw new TypeError('O valor de entrada deve ser um número finito.');
  }

  const domain = DOMAINS[variable];

  if (value < domain.min || value > domain.max) {
    throw new RangeError(`${domain.label} deve estar entre ${domain.min} e ${domain.max} ${domain.unit}.`);
  }

  return Object.fromEntries(
    Object.entries(FUZZY_SETS[variable]).map(([name, set]) => [
      name,
      calculateMembership(value, set.points)
    ])
  );
}

export function fuzzifyInputs(humidity, temperature) {
  return {
    humidity: fuzzifyVariable(humidity, 'humidity'),
    temperature: fuzzifyVariable(temperature, 'temperature')
  };
}