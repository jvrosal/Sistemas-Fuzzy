
import { createAggregationChart, createImplicationChart, createInputChart } from '../js/charts.js';
import { runSimulation } from '../js/simulator.js';

export function runChartTests(check) {
  const test = (name, assertion) => {
    try { check(name, Boolean(assertion())); }
    catch { check(name, false); }
  };
  const simulation = runSimulation({ humidity: 35, temperature: 30, step: 0.1 });
  const humidity = createInputChart('humidity', 35);
  const temperature = createInputChart('temperature', 30);
  const implicated = createImplicationChart(simulation.implication.find((rule) => rule.id === 'R2'));
  const aggregated = createAggregationChart(simulation);
  const centroid = createAggregationChart(simulation, true);
  const svg = (element) => element.querySelector('svg');
  const curves = (element) => element.querySelectorAll('svg path[fill="none"]');
  const markerLines = (element) => element.querySelectorAll('svg line[stroke-dasharray="6 5"]');
  const getCoords = (path) => [...path.getAttribute('d').matchAll(/[ML]([\d.]+) ([\d.]+)/g)]
    .map((match) => ({ x: Number(match[1]), y: Number(match[2]) }));

  for (const [name, graph, expectedUnit] of [
    ['umidade', humidity, '%'], ['temperatura', temperature, '°C']
  ]) {
    test(`Gráfico de ${name}: retorna figure com SVG`, () =>
      graph.tagName === 'FIGURE' && svg(graph)?.namespaceURI === 'http://www.w3.org/2000/svg');
    test(`Gráfico de ${name}: acessível e com título`, () =>
      svg(graph).getAttribute('role') === 'img' &&
      svg(graph).getAttribute('aria-label').includes(expectedUnit) &&
      Boolean(graph.querySelector('figcaption')?.textContent));
    test(`Gráfico de ${name}: três curvas de pertinência`, () => curves(graph).length === 3);
    test(`Gráfico de ${name}: legenda com três conjuntos`, () =>
      graph.querySelectorAll('.chart-legend-item').length === 3);
    test(`Gráfico de ${name}: marca a entrada no eixo horizontal`, () => markerLines(graph).length === 1);
    test(`Gráfico de ${name}: mantém amostras no domínio`, () => {
      const samples = getCoords(curves(graph)[0]);
      return samples.length === 301 && samples[0].x === 48 && samples.at(-1).x === 622 &&
        samples.every(({ x, y }) => x >= 48 && x <= 622 && y >= 22 && y <= 227);
    });
  }

  test('Implicação: identifica a regra e a altura de recorte', () =>
    implicated.querySelector('figcaption').textContent.includes('R2') &&
    svg(implicated).getAttribute('aria-label').includes('recorte'));
  test('Implicação: apresenta curva original e curva recortada', () =>
    curves(implicated).length === 2 && implicated.querySelectorAll('svg path[fill-opacity]').length === 1);
  test('Implicação: legenda distingue original do recorte', () =>
    implicated.textContent.includes('original') && implicated.textContent.includes('Recorte'));
  test('Implicação: curva recortada não ultrapassa a ativação', () => {
    const rule = simulation.implication.find((item) => item.id === 'R2');
    const path = curves(implicated)[1];
    const highest = Math.min(...getCoords(path).map(({ y }) => y));
    const theoretical = 22 + (1 - rule.clipHeight) * 205;
    return Math.abs(highest - theoretical) < 0.01;
  });
  test('Implicação: nenhum recorte acima da curva original', () => {
    const original = getCoords(curves(implicated)[0]);
    const clipped = getCoords(curves(implicated)[1]);
    return original.length === clipped.length && clipped.every((point, i) => point.y >= original[i].y - 0.002);
  });

  test('Agregação: quatro curvas (três originais e máximo)', () => curves(aggregated).length === 4);
  test('Agregação: área preenchida sob a função agregada', () =>
    aggregated.querySelectorAll('svg path[fill-opacity]').length === 1);
  test('Agregação: identifica explicitamente o máximo', () =>
    aggregated.textContent.includes('Saída agregada (máximo)'));
  test('Agregação sem centroide: nenhuma linha de marcação', () => markerLines(aggregated).length === 0);
  test('Agregação com centroide: uma marcação no tempo calculado', () => {
    const markers = markerLines(centroid);
    const expectedX = 48 + (simulation.defuzzification.time / 30) * 574;
    return markers.length === 1 && Math.abs(Number(markers[0].getAttribute('x1')) - expectedX) < 0.001;
  });
  test('Centroide: rótulo e valor coerentes', () =>
    svg(centroid).getAttribute('aria-label').includes('Centroide em') &&
    centroid.textContent.includes('z* = 16,79 min'));
  test('Centroide: não altera o resultado matemático', () =>
    Math.abs(simulation.defuzzification.time - 16.78568254) < 0.00001);
  test('Gráficos: não inserem conteúdo no documento ao serem criados', () =>
    !humidity.isConnected && !aggregated.isConnected && !centroid.isConnected);
}
