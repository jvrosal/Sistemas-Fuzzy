
import { createInputChart, createImplicationChart, createAggregationChart } from './charts.js';
import { DEFUZZIFICATION_STEPS, DEFAULT_RULES, DOMAINS, FUZZY_SETS, INFERENCE_STAGES } from './constants.js';
import {
  STAGE_COUNT,
  advance,
  calculate,
  createInitialState,
  formatNumber,
  readInputs,
  resetState,
  setConsequent,
  setInput,
  setStep
} from './state.js';

const STAGE_HINTS = Object.freeze([
  'Calcula o grau de compatibilidade da umidade e da temperatura com cada conjunto.',
  'Cada regra recebe a ativação h = mínimo entre os graus dos seus dois antecedentes.',
  'O conjunto de saída de cada regra é recortado na altura h.',
  'Os recortes são combinados pelo máximo, ponto a ponto.',
  'O tempo recomendado é o centroide da área agregada, calculado por pontos médios.'
]);

const NOTICES = Object.freeze({
  changed: 'A configuração mudou. Os resultados anteriores foram descartados.',
  reset: 'Entradas, regras e passo voltaram ao padrão.',
  invalid: 'O cálculo foi bloqueado. Corrija os campos destacados.'
});

const label = (name) => {
  for (const sets of Object.values(FUZZY_SETS)) {
    if (sets[name]) return sets[name].label.toLowerCase();
  }
  return name;
};

const deg = (value) => formatNumber(value);

function el(tag, attributes = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attributes)) {
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key === 'style') node.style.cssText = value;
    else node.setAttribute(key, value);
  }
  node.append(...children.filter((child) => child !== null && child !== undefined));
  return node;
}

//Estrutura: título da página e lista das cinco etapas.
export function initializeInterface(root, { title, stages }) {
  if (!root) {
    throw new Error('Elemento principal da aplicação não encontrado.');
  }

  const status = root.querySelector('[data-app-status]');
  const list = root.querySelector('[data-stage-list]');

  if (!status || !list) {
    throw new Error('Estrutura da interface incompleta.');
  }

  document.title = title;
  list.replaceChildren();

  stages.forEach((name, index) => {
    const item = document.createElement('li');
    const number = document.createElement('span');
    const heading = document.createElement('strong');

    item.className = 'stage';
    item.dataset.state = 'pending';
    number.className = 'stage-number';
    number.textContent = String(index + 1);
    heading.className = 'stage-title';
    heading.textContent = name;

    item.append(number, heading);
    list.append(item);
  });

  status.textContent = 'Estrutura carregada';
  root.classList.add('is-ready');

  return { ready: true, stageCount: stages.length };
}

// Renderização das cinco etapas do processo de inferência fuzzy, com base no resultado do cálculo.

function renderFuzzification(result) {
  const { humidity, temperature } = result.configuration;
  const block = (variable, value) => {
    const { unit, label: name } = DOMAINS[variable];
    const rows = Object.entries(result.fuzzification[variable]).map(([set, mu]) =>
      el('tr', { class: mu > 0 ? 'is-on' : '' },
        el('th', { scope: 'row', text: label(set) }),
        el('td', { class: 'meter-cell' }, el('span', { class: 'meter', style: `--v:${mu}` })),
        el('td', { class: 'num', text: deg(mu) })
      )
    );
    return el('table', { class: 'degrees' },
      el('caption', { text: `${name}: ${formatNumber(value)} ${unit}` }),
      el('tbody', {}, ...rows)
    );
  };
  return el('div', { class: 'input-visuals' },
    el('div', { class: 'pair' }, block('humidity', humidity), block('temperature', temperature)),
    createInputChart('humidity', humidity),
    createInputChart('temperature', temperature)
  );
}

function renderEvaluation(result) {
  const rows = result.evaluation.map((rule) =>
    el('tr', { class: rule.active ? 'is-on' : '' },
      el('th', { scope: 'row', text: rule.id }),
      el('td', { text: `${label(rule.humidity)} e ${label(rule.temperature)}` }),
      el('td', { class: 'num', text: `min(${deg(rule.humidityDegree)}; ${deg(rule.temperatureDegree)})` }),
      el('td', { class: 'num strong', text: deg(rule.activation) })
    )
  );
  return el('table', { class: 'rule-table' },
    el('thead', {}, el('tr', {},
      el('th', { scope: 'col', text: 'Regra' }),
      el('th', { scope: 'col', text: 'Antecedentes' }),
      el('th', { scope: 'col', text: 'Operação' }),
      el('th', { scope: 'col', text: 'h' })
    )),
    el('tbody', {}, ...rows)
  );
}

function renderImplication(result) {
  const active = result.implication.filter((rule) => rule.clipHeight > 0);
  const idle = result.implication.length - active.length;
  const items = active.map((rule) =>
    el('li', {},
      el('strong', { text: rule.id }),
      ` concluiu ${label(rule.consequent)}; o conjunto ${label(rule.consequent)} é recortado na altura ${deg(rule.clipHeight)}.`
    )
  );
  const selection = el('select', { 'aria-label': 'Selecione a regra para visualizar a implicação' },
    ...result.implication.map((rule) => el('option', {
      value: rule.id,
      text: `${rule.id} — ${label(rule.consequent)} (h = ${deg(rule.clipHeight)})`
    }))
  );
  const graphArea = el('div', { class: 'implication-chart' });
  const showSelected = () => {
    const rule = result.implication.find((item) => item.id === selection.value);
    graphArea.replaceChildren(createImplicationChart(rule));
  };
  selection.value = active[0]?.id ?? result.implication[0].id;
  selection.addEventListener('change', showSelected);
  showSelected();
  return el('div', { class: 'implication-visuals' },
    el('ul', { class: 'log' }, ...items),
    idle > 0 ? el('p', { class: 'aside', text: `${idle} ${idle === 1 ? 'regra tem' : 'regras têm'} h = 0 e não contribuem para a saída.` }) : null,
    el('label', { class: 'rule-picker' },
      el('span', { text: 'Visualizar implicação da regra' }), selection),
    graphArea
  );
}

function renderAggregation(result) {
  const groups = new Map();
  for (const rule of result.implication) {
    if (rule.clipHeight <= 0) continue;
    const group = groups.get(rule.consequent) ?? { height: 0, ids: [] };
    group.height = Math.max(group.height, rule.clipHeight);
    group.ids.push(rule.id);
    groups.set(rule.consequent, group);
  }

  const items = Object.keys(FUZZY_SETS.irrigation)
    .filter((set) => groups.has(set))
    .map((set) => {
      const { height, ids } = groups.get(set);
      const note = ids.length > 1 ? ` (máximo entre ${ids.join(', ')}, sem somar)` : ` (${ids[0]})`;
      return el('li', {}, el('strong', { text: label(set) }), ` fica com altura ${deg(height)}${note}.`);
    });

  return el('div', {},
    el('p', { text: 'Para cada z, a saída agregada é μ(z) = max(μ1(z), …, μ9(z)).' }),
    items.length
      ? el('ul', { class: 'log' }, ...items)
      : el('p', { class: 'aside', text: 'Nenhum recorte com altura maior que zero.' }),
    createAggregationChart(result)
  );
}

function renderDefuzzification(result) {
  const d = result.defuzzification;
  if (!d.valid) {
    return el('p', { class: 'outcome is-invalid', text: d.message });
  }
  return el('div', {},
    createAggregationChart(result, true),
    el('p', { text: `Centroide por pontos médios: Δz = ${formatNumber(d.step)} min, ${d.sampleCount} amostras, z(k) = (k + 0,5) × Δz.` }),
    el('p', { class: 'num formula', text: `z* = Σ z·μ / Σ μ = ${formatNumber(d.numerator, 4)} / ${formatNumber(d.denominator, 4)} = ${formatNumber(d.time, 6)} min` }),
    el('p', { class: 'outcome' },
      'Regar por ',
      el('strong', { text: formatNumber(d.time, 2) }),
      ' minutos'
    )
  );
}

const STAGE_RENDERERS = [renderFuzzification, renderEvaluation, renderImplication, renderAggregation, renderDefuzzification];

//CONROLADOR - Interface

export function mountSimulator(root) {
  const form = root.querySelector('#controls');
  const stageItems = [...root.querySelectorAll('[data-stage-list] > li')];
  const status = root.querySelector('[data-app-status]');
  const notice = root.querySelector('[data-notice]');
  const matrix = root.querySelector('[data-rule-matrix]');
  const stepOptions = root.querySelector('[data-step-options]');
  const buttons = {
    calculate: root.querySelector('[data-action="calculate"]'),
    advance: root.querySelector('[data-action="advance"]')
  };
  const fields = Object.fromEntries(['humidity', 'temperature'].map((variable) => [variable, {
    wrapper: root.querySelector(`[data-field="${variable}"]`),
    number: root.querySelector(`#${variable}-input`),
    slider: root.querySelector(`#${variable}-slider`),
    error: root.querySelector(`#${variable}-error`)
  }]));

  let state = createInitialState();
  const selects = buildMatrix(matrix);
  const radios = buildStepOptions(stepOptions);

  // Corpo de cada etapa: descrição fixa + área de resultados
  const stageBodies = stageItems.map((item, index) => {
    const hint = el('p', { class: 'stage-hint', text: STAGE_HINTS[index] });
    const output = el('div', { class: 'stage-output' });
    item.append(el('div', { class: 'stage-body' }, hint, output));
    return output;
  });

  function update(next) {
    state = next;
    render();
  }

  function render() {
    const inputs = readInputs(state);

    for (const [variable, field] of Object.entries(fields)) {
      const message = inputs.errors[variable] ?? '';
      field.error.textContent = message;
      field.wrapper.classList.toggle('has-error', Boolean(message));
      field.number.setAttribute('aria-invalid', String(Boolean(message)));
      if (!message) field.slider.value = String(inputs[variable]);
    }

    selects.forEach((select, index) => {
      if (select.value !== state.consequents[index]) select.value = state.consequents[index];
      select.dataset.consequent = state.consequents[index];
    });
    radios.forEach((radio) => { radio.checked = Number(radio.value) === state.step; });

    buttons.calculate.disabled = !inputs.valid;
    buttons.advance.disabled = !inputs.valid;
    buttons.advance.textContent = state.result && state.stageIndex >= STAGE_COUNT
      ? 'Rever do início'
      : 'Avançar etapa';

    renderStages();
    renderMatrixActivation();

    notice.textContent = state.notice ? NOTICES[state.notice] : '';
    notice.dataset.kind = state.notice ?? '';
    status.textContent = statusText(inputs);
    root.classList.toggle('has-result', Boolean(state.result));
  }

  function renderStages() {
    stageItems.forEach((item, index) => {
      const revealed = state.result && index < state.stageIndex;
      const current = state.result && index === state.stageIndex - 1 && state.stageIndex < STAGE_COUNT;
      item.dataset.state = revealed ? (current ? 'current' : 'done') : 'pending';
      if (revealed) {
        stageBodies[index].replaceChildren(STAGE_RENDERERS[index](state.result));
      } else {
        stageBodies[index].replaceChildren();
      }
    });
  }

  function renderMatrixActivation() {
    const showActivation = state.result && state.stageIndex >= 2;
    selects.forEach((select, index) => {
      const cell = select.closest('td');
      const h = showActivation ? state.result.evaluation[index].activation : 0;
      cell.style.setProperty('--h', String(h));
      cell.classList.toggle('is-active', showActivation && h > 0);
      cell.querySelector('.cell-h').textContent = showActivation ? `h = ${deg(h)}` : '';
    });
  }

  function statusText(inputs) {
    if (!inputs.valid) return 'Corrija os campos destacados para calcular.';
    if (!state.result) return 'Pronto para calcular.';
    if (state.stageIndex < STAGE_COUNT) {
      return `Etapa ${state.stageIndex} de ${STAGE_COUNT}: ${INFERENCE_STAGES[state.stageIndex - 1]}.`;
    }
    const { humidity, temperature, step } = state.result.configuration;
    return `Calculado para U = ${formatNumber(humidity)} %, T = ${formatNumber(temperature)} °C e Δz = ${formatNumber(step)} min.`;
  }

  //Entradas e controles
  for (const [variable, field] of Object.entries(fields)) {
    field.number.addEventListener('input', () => {
      update(setInput(state, variable, field.number.value, field.number.validity.badInput));
    });
    field.slider.addEventListener('input', () => {
      field.number.value = field.slider.value;
      update(setInput(state, variable, field.slider.value));
    });
  }

  selects.forEach((select, index) => {
    select.addEventListener('change', () => update(setConsequent(state, index, select.value)));
  });

  radios.forEach((radio) => {
    radio.addEventListener('change', () => update(setStep(state, Number(radio.value))));
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    update(calculate(state));
  });
  buttons.advance.addEventListener('click', () => update(advance(state)));
  root.querySelector('[data-action="reset"]').addEventListener('click', () => {
    const next = resetState();
    for (const [variable, field] of Object.entries(fields)) {
      field.number.value = next.inputs[variable].raw;
      field.slider.value = next.inputs[variable].raw;
    }
    update(next);
  });

  render();
  return { getState: () => state };
}

function buildMatrix(table) {
  const humiditySets = Object.keys(FUZZY_SETS.humidity);
  const temperatureSets = Object.keys(FUZZY_SETS.temperature);
  const options = Object.keys(FUZZY_SETS.irrigation);

  const head = el('thead', {}, el('tr', {},
    el('td', { class: 'corner', text: 'solo / temperatura' }),
    ...temperatureSets.map((set) => el('th', { scope: 'col', text: label(set) }))
  ));

  const selects = [];
  const body = el('tbody');

  for (const humidity of humiditySets) {
    const row = el('tr', {}, el('th', { scope: 'row', text: label(humidity) }));
    for (const temperature of temperatureSets) {
      const index = DEFAULT_RULES.findIndex((rule) => rule.humidity === humidity && rule.temperature === temperature);
      const rule = DEFAULT_RULES[index];
      const select = el('select', {
        'aria-label': `${rule.id}: se o solo é ${label(humidity)} e a temperatura é ${label(temperature)}, então o tempo é`
      }, ...options.map((option) => el('option', { value: option, text: label(option) })));
      selects[index] = select;
      row.append(el('td', { class: 'cell' },
        el('span', { class: 'cell-id', text: rule.id }),
        select,
        el('span', { class: 'cell-h' })
      ));
    }
    body.append(row);
  }

  table.append(head, body);
  return selects;
}

function buildStepOptions(container) {
  return DEFUZZIFICATION_STEPS.map((step) => {
    const id = `step-${String(step).replace('.', '-')}`;
    const radio = el('input', { type: 'radio', name: 'step', id, value: String(step) });
    container.append(el('span', {}, radio, el('label', { for: id, text: `${formatNumber(step)} min` })));
    return radio;
  });
}
