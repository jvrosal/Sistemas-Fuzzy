import { DOMAINS, FUZZY_SETS } from './constants.js';
import { calculateMembership } from './membership.js';
import { getAggregatedMembership } from './inference.js';

// Os gráficos usam as mesmas funções do motor Mamdani (pertinência e agregação).
// O SVG só apresenta os resultados; nada aqui altera a inferência.
// As cores ficam no CSS (classes set-*), para manter um único lugar de ajuste.

const NS = 'http://www.w3.org/2000/svg';
const MARGIN = { top: 26, right: 18, bottom: 42, left: 46 };

const fmt = (value, digits) => Number(value).toLocaleString('pt-BR', digits === undefined
  ? { maximumFractionDigits: 2 }
  : { minimumFractionDigits: digits, maximumFractionDigits: digits });

function svg(tag, attributes = {}, text) {
  const node = document.createElementNS(NS, tag);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
  if (text !== undefined) node.textContent = text;
  return node;
}

function responsiveFigure(title, draw) {
  const figure = document.createElement('figure');
  figure.className = 'chart';
  if (title) {
    const caption = document.createElement('figcaption');
    caption.textContent = title;
    figure.append(caption);
  }
  const canvas = document.createElement('div');
  canvas.className = 'chart-canvas';
  canvas.append(draw(560, 280));
  figure.append(canvas);

  if (typeof ResizeObserver === 'function') {
    let last = '';
    new ResizeObserver(([entry]) => {
      const width = Math.round(entry.contentRect.width);
      const height = Math.round(entry.contentRect.height);
      const key = `${width}x${height}`;
      if (width < 120 || height < 100 || key === last) return;
      const redraw = last !== '';
      last = key;
      canvas.replaceChildren(draw(width, height, redraw));
    }).observe(canvas);
  }
  return figure;
}

// Cria a área de desenho: eixos, grade, rótulos e funções de escala
function frame(variable, { width, height, description, settled = false }) {
  const domain = DOMAINS[variable];
  const plotW = width - MARGIN.left - MARGIN.right;
  const plotH = height - MARGIN.top - MARGIN.bottom;
  const x = (value) => MARGIN.left + ((value - domain.min) / (domain.max - domain.min)) * plotW;
  const y = (mu) => MARGIN.top + (1 - mu) * plotH;

  const root = svg('svg', {
    viewBox: `0 0 ${width} ${height}`,
    width, height,
    role: 'img',
    'aria-label': description,
    class: `chart-svg${settled ? ' is-settled' : ''}`
  });

  for (const tick of [0, 0.5, 1]) {
    root.append(svg('line', { x1: x(domain.min), x2: x(domain.max), y1: y(tick), y2: y(tick), class: tick === 0 ? 'axis' : 'grid' }));
    root.append(svg('text', { x: MARGIN.left - 8, y: y(tick) + 4, 'text-anchor': 'end', class: 'tick' }, fmt(tick)));
  }
  root.append(svg('line', { x1: x(domain.min), x2: x(domain.min), y1: y(0), y2: y(1), class: 'axis' }));

  const span = domain.max - domain.min;
  const step = span === 100
    ? (plotW < 260 ? 25 : plotW < 600 ? 20 : 10)
    : (plotW < 260 ? 10 : 5);
  for (let value = domain.min; value <= domain.max + 1e-9; value += step) {
    root.append(svg('text', { x: x(value), y: y(0) + 16, 'text-anchor': 'middle', class: 'tick' }, fmt(value)));
  }

  root.append(svg('text', { x: MARGIN.left + plotW / 2, y: height - 6, 'text-anchor': 'middle', class: 'axis-label' },
    `${domain.label} (${domain.unit})`));
  root.append(svg('text', {
    x: 12, y: MARGIN.top + plotH / 2, 'text-anchor': 'middle', class: 'axis-label',
    transform: `rotate(-90 12 ${MARGIN.top + plotH / 2})`
  }, 'Pertinência μ'));

  return { root, x, y, domain };
}

function curvePath({ x, y, domain }, fn, samples = 240) {
  let d = '';
  for (let i = 0; i <= samples; i += 1) {
    const value = domain.min + (i / samples) * (domain.max - domain.min);
    d += `${i === 0 ? 'M' : 'L'}${x(value).toFixed(2)} ${y(fn(value)).toFixed(2)}`;
  }
  return d;
}

function areaPath(chart, fn, samples) {
  const { x, y, domain } = chart;
  return `${curvePath(chart, fn, samples)}L${x(domain.max).toFixed(2)} ${y(0).toFixed(2)}L${x(domain.min).toFixed(2)} ${y(0).toFixed(2)}Z`;
}

// Desenha os três conjuntos da variável, com o nome sobre o topo de cada um
function drawSets(chart, variable, { faint = false } = {}) {
  for (const [name, set] of Object.entries(FUZZY_SETS[variable])) {
    const [, b, c] = set.points;
    if (!faint) {
      chart.root.append(svg('path', {
        d: areaPath(chart, (value) => calculateMembership(value, set.points)),
        class: `area is-soft set-${name}`
      }));
    }
    chart.root.append(svg('path', {
      d: curvePath(chart, (value) => calculateMembership(value, set.points)),
      class: `curve set-${name}${faint ? ' is-faint' : ''}`
    }));

    const center = (b + c) / 2;
    const { min, max } = chart.domain;
    const anchor = center <= min ? 'start' : center >= max ? 'end' : 'middle';
    chart.root.append(svg('text', {
      x: chart.x(center), y: chart.y(1) - 8, 'text-anchor': anchor, class: `set-label set-${name}`
    }, set.label.toLowerCase()));
  }
}

//Linha vertical com o valor escrito junto ao eixo horizontal.
function drawMarker(chart, value, label, kind = 'input') {
  const { x, y, root, domain } = chart;
  const px = x(value);
  root.append(svg('line', { x1: px, x2: px, y1: y(0), y2: y(1), class: `marker marker-${kind}` }));

  const nearEnd = value > domain.min + (domain.max - domain.min) * 0.8;
  const nearStart = value < domain.min + (domain.max - domain.min) * 0.2;
  const anchor = nearEnd ? 'end' : nearStart ? 'start' : 'middle';
  const text = svg('text', { x: px + (nearEnd ? -4 : nearStart ? 4 : 0), y: y(0) - 8, 'text-anchor': anchor, class: `marker-label marker-${kind}` }, label);
  root.append(text);
}

export function createSetChart(variable, { value = null, title } = {}) {
  const domain = DOMAINS[variable];
  const valueText = value === null ? '' : `${fmt(value)} ${domain.unit}`;
  const degrees = value === null ? '' : Object.values(FUZZY_SETS[variable])
    .map((set) => `${set.label}: ${fmt(calculateMembership(value, set.points), 2)}`).join('; ');
  const description = `Conjuntos de ${domain.label.toLowerCase()}${value === null ? '' : `, entrada ${valueText}. ${degrees}`}.`;

  return responsiveFigure(title, (width, height, settled) => {
    const chart = frame(variable, { width, height, description, settled });

    drawSets(chart, variable);

    if (value !== null) {
      drawMarker(chart, value, valueText);
      for (const [name, set] of Object.entries(FUZZY_SETS[variable])) {
        const mu = calculateMembership(value, set.points);
        if (mu > 0) {
          chart.root.append(svg('circle', { cx: chart.x(value), cy: chart.y(mu), r: 4.5, class: `dot set-${name}` }));
        }
      }
    }

    return chart.root;
  });
}

export function createImplicationChart(rule) {
  const set = FUZZY_SETS.irrigation[rule.consequent];
  const original = (z) => calculateMembership(z, set.points);
  const clipped = (z) => Math.min(rule.clipHeight, original(z));
  const description = `${rule.id}: consequente ${set.label.toLowerCase()} recortado na altura ${fmt(rule.clipHeight, 2)}.`;

  return responsiveFigure(null, (width, height, settled) => {
    const chart = frame('irrigation', { width, height, description, settled });

    chart.root.append(svg('path', { d: curvePath(chart, original), class: `curve set-${rule.consequent} is-dashed` }));
    if (rule.clipHeight > 0) {
      chart.root.append(svg('path', { d: areaPath(chart, clipped), class: `area set-${rule.consequent} grow` }));
      chart.root.append(svg('path', { d: curvePath(chart, clipped), class: `curve set-${rule.consequent} is-strong` }));
    }

    const hy = chart.y(rule.clipHeight);
    chart.root.append(svg('line', { x1: chart.x(0), x2: chart.x(30), y1: hy, y2: hy, class: 'cut-line' }));
    chart.root.append(svg('text', { x: chart.x(30), y: hy - 6, 'text-anchor': 'end', class: 'cut-label' },
      `h = ${fmt(rule.clipHeight, 2)}`));

    const [, b, c] = set.points;
    const center = (b + c) / 2;
    chart.root.append(svg('text', {
      x: chart.x(center), y: chart.y(1) - 8,
      'text-anchor': center <= 0 ? 'start' : center >= 30 ? 'end' : 'middle',
      class: `set-label set-${rule.consequent}`
    }, `${set.label.toLowerCase()} (original)`));

    return chart.root;
  });
}

// Saída: conjuntos curto, médio e longo, área agregada pelo máximo e, opcionalmente, o centroide
export function createAggregationChart(result, { centroid = false } = {}) {
  const aggregated = (z) => getAggregatedMembership(result.aggregation, z);
  const d = result.defuzzification;
  const description = `Saída agregada pelo máximo dos recortes${centroid && d.valid ? `; centroide em ${fmt(d.time, 2)} minutos` : ''}.`;

  return responsiveFigure(null, (width, height, settled) => {
    const chart = frame('irrigation', { width, height, description, settled });

    drawSets(chart, 'irrigation', { faint: true });
    chart.root.append(svg('path', { d: areaPath(chart, aggregated, 600), class: 'area aggregate grow' }));
    chart.root.append(svg('path', { d: curvePath(chart, aggregated, 600), class: 'curve aggregate' }));

    if (centroid && d.valid) {
      drawMarker(chart, d.time, `z* = ${fmt(d.time, 2)} min`, 'centroid');
    }

    return chart.root;
  });
}
