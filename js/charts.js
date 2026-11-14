
import { DOMAINS, FUZZY_SETS } from './constants.js';
import { calculateMembership } from './membership.js';
import { getAggregatedMembership } from './inference.js';

// Os gráficos usam o mesmo cálculo de pertinência e agregação do motor Mamdani.
// SVG é usado apenas para apresentação; nunca altera os resultados da inferência.
const NS = 'http://www.w3.org/2000/svg';
const COLORS = Object.freeze({
  primeiro: '#c1834c',
  segundo: '#267da8',
  terceiro: '#566c99',
  recorte: '#1c6699',
  agregado: '#1c6699',
  centroide: '#b2533b',
  grade: '#e2e9f0',
  eixo: '#64788b'
});
const MARGIN = { top: 22, right: 18, bottom: 48, left: 48 };
const WIDTH = 640;
const HEIGHT = 275;
const W = WIDTH - MARGIN.left - MARGIN.right;
const H = HEIGHT - MARGIN.top - MARGIN.bottom;
const fmt = (value, digits = 2) => Number(value).toLocaleString('pt-BR', {
  minimumFractionDigits: digits, maximumFractionDigits: digits
});

function svgEl(tag, attrs = {}, text) {
  const node = document.createElementNS(NS, tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
  if (text !== undefined) node.textContent = text;
  return node;
}

function htmlEl(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function plot({ domain, title, description, curves, fill, markers = [], samples = 300 }) {
  const wrapper = htmlEl('figure', 'fuzzy-chart');
  const caption = htmlEl('figcaption', 'chart-title', title);
  const chart = svgEl('svg', {
    viewBox: `0 0 ${WIDTH} ${HEIGHT}`, role: 'img', 'aria-label': description,
    class: 'fuzzy-svg', preserveAspectRatio: 'xMidYMid meet'
  });
  const x = (value) => MARGIN.left + ((value - domain.min) / (domain.max - domain.min)) * W;
  const y = (value) => MARGIN.top + (1 - value) * H;
  const points = Array.from({ length: samples + 1 }, (_, i) => domain.min +
    (i / samples) * (domain.max - domain.min));
  const path = (f) => points.map((value, index) =>
    `${index === 0 ? 'M' : 'L'}${x(value).toFixed(3)} ${y(f(value)).toFixed(3)}`).join(' ');

  for (const tick of [0, 0.25, 0.5, 0.75, 1]) {
    chart.append(svgEl('line', { x1: MARGIN.left, x2: WIDTH - MARGIN.right,
      y1: y(tick), y2: y(tick), stroke: COLORS.grade, 'stroke-width': 1 }));
    chart.append(svgEl('text', { x: MARGIN.left - 9, y: y(tick) + 4, 'text-anchor': 'end',
      class: 'chart-tick' }, fmt(tick, tick === 0 || tick === 1 ? 0 : 2)));
  }
  const divisions = 5;
  for (let i = 0; i <= divisions; i += 1) {
    const value = domain.min + ((domain.max - domain.min) * i) / divisions;
    chart.append(svgEl('text', { x: x(value), y: HEIGHT - 26, 'text-anchor': 'middle',
      class: 'chart-tick' }, fmt(value, Number.isInteger(value) ? 0 : 1)));
  }
  chart.append(svgEl('line', { x1: MARGIN.left, y1: y(0), x2: WIDTH - MARGIN.right,
    y2: y(0), stroke: COLORS.eixo, 'stroke-width': 1.2 }));
  chart.append(svgEl('line', { x1: MARGIN.left, y1: y(0), x2: MARGIN.left,
    y2: y(1), stroke: COLORS.eixo, 'stroke-width': 1.2 }));
  chart.append(svgEl('text', { x: WIDTH / 2, y: HEIGHT - 5, 'text-anchor': 'middle',
    class: 'chart-axis-label' }, `${domain.label} (${domain.unit})`));
  chart.append(svgEl('text', { x: 15, y: HEIGHT / 2, 'text-anchor': 'middle',
    transform: `rotate(-90 15 ${HEIGHT / 2})`, class: 'chart-axis-label' }, 'Grau de pertinência (0 a 1)'));

  if (fill) {
    const polygon = `${path(fill.fn)} L${x(domain.max).toFixed(3)} ${y(0).toFixed(3)} ` +
      `L${x(domain.min).toFixed(3)} ${y(0).toFixed(3)} Z`;
    chart.append(svgEl('path', { d: polygon, fill: fill.color, 'fill-opacity': 0.2,
      stroke: 'none' }));
  }
  for (const curve of curves) {
    chart.append(svgEl('path', { d: path(curve.fn), fill: 'none', stroke: curve.color,
      'stroke-width': curve.width ?? 2.5, 'stroke-dasharray': curve.dash ?? 'none',
      'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));
  }
  for (const marker of markers) {
    chart.append(svgEl('line', { x1: x(marker.value), x2: x(marker.value),
      y1: y(0), y2: y(1), stroke: marker.color, 'stroke-width': 2,
      'stroke-dasharray': '6 5' }));
    const rightSide = marker.value > domain.min + (domain.max - domain.min) * 0.78;
    chart.append(svgEl('text', { x: x(marker.value) + (rightSide ? -6 : 6), y: y(1) + 15,
      'text-anchor': rightSide ? 'end' : 'start', class: 'chart-marker-label',
      fill: marker.color }, marker.label));
  }
  const legend = htmlEl('div', 'chart-legend');
  for (const item of [...curves, ...(fill && !curves.some((c) => c.name === fill.name) ? [fill] : [])]) {
    const entry = htmlEl('span', 'chart-legend-item');
    const swatch = htmlEl('i', 'chart-swatch');
    swatch.style.backgroundColor = item.color;
    if (item.dash) swatch.style.background = `repeating-linear-gradient(90deg, ${item.color} 0 7px, transparent 7px 12px)`;
    entry.append(swatch, document.createTextNode(item.name));
    legend.append(entry);
  }
  wrapper.append(caption, chart, legend);
  return wrapper;
}

function setCurves(variable) {
  return Object.entries(FUZZY_SETS[variable]).map(([name, set], index) => ({
    name: set.label,
    color: [COLORS.primeiro, COLORS.segundo, COLORS.terceiro][index],
    fn: (value) => calculateMembership(value, set.points)
  }));
}

export function createInputChart(variable, value) {
  const domain = DOMAINS[variable];
  const degrees = Object.entries(FUZZY_SETS[variable]).map(([name, set]) =>
    `${set.label}: ${fmt(calculateMembership(value, set.points))}`).join('; ');
  return plot({
    domain,
    title: `${domain.label} — ${fmt(value, Number.isInteger(value) ? 0 : 1)} ${domain.unit}`,
    description: `Conjuntos de ${domain.label.toLowerCase()}; entrada ${value} ${domain.unit}. ${degrees}.`,
    curves: setCurves(variable),
    markers: [{ value, label: `${fmt(value, Number.isInteger(value) ? 0 : 1)} ${domain.unit}`,
      color: COLORS.centroide }]
  });
}

export function createImplicationChart(rule) {
  const set = FUZZY_SETS.irrigation[rule.consequent];
  const original = (value) => calculateMembership(value, set.points);
  const clipped = (value) => Math.min(rule.clipHeight, original(value));
  return plot({
    domain: DOMAINS.irrigation,
    title: `${rule.id} — ${set.label} com h = ${fmt(rule.clipHeight)}`,
    description: `${rule.id}: consequente ${set.label.toLowerCase()}; curva original e recorte na altura ${fmt(rule.clipHeight)}.`,
    curves: [
      { name: `${set.label} original`, fn: original, color: COLORS.terceiro, dash: '7 5' },
      { name: 'Recorte da regra', fn: clipped, color: COLORS.recorte, width: 3 }
    ],
    fill: { name: 'Recorte da regra', fn: clipped, color: COLORS.recorte }
  });
}

export function createAggregationChart(result, showCentroid = false) {
  const aggregated = (value) => getAggregatedMembership(result.aggregation, value);
  const curves = setCurves('irrigation').map((curve) => ({ ...curve, width: 1.8, dash: '6 5' }));
  curves.push({ name: 'Saída agregada (máximo)', color: COLORS.agregado, fn: aggregated, width: 3.5 });
  const centroid = result.defuzzification;
  const markers = showCentroid && centroid.valid ? [{
    value: centroid.time, color: COLORS.centroide,
    label: `z* = ${fmt(centroid.time)} min`
  }] : [];
  return plot({
    domain: DOMAINS.irrigation,
    title: showCentroid ? 'Saída agregada e centroide' : 'Saída agregada — máximo dos recortes',
    description: `Conjuntos curto, médio e longo e saída agregada calculada pelo máximo ponto a ponto.${
      markers.length ? ` Centroide em ${fmt(centroid.time)} minutos.` : ''}`,
    curves,
    fill: { name: 'Saída agregada (máximo)', fn: aggregated, color: COLORS.agregado },
    markers,
    samples: 600
  });
}
