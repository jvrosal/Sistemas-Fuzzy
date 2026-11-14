import { createAggregationChart, createImplicationChart, createSetChart } from './charts.js';
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
  'Grau de compatibilidade de cada entrada com os seus três conjuntos.',
  'Cada regra recebe h = mínimo entre os graus dos seus dois antecedentes.',
  'O consequente de cada regra é recortado na altura h. Escolha uma regra para ver o recorte.',
  'Os recortes são combinados pelo máximo, ponto a ponto. Áreas sobrepostas não se somam.',
  'O tempo recomendado é o centroide da área agregada, calculado por pontos médios.'
]);

const NOTICES = Object.freeze({
  changed: 'A configuração mudou. O resultado anterior foi descartado.',
  reset: 'Entradas, regras e passo voltaram ao padrão.',
  invalid: 'Corrija os campos destacados para calcular.'
});

const label = (name) => {
  for (const sets of Object.values(FUZZY_SETS)) {
    if (sets[name]) return sets[name].label.toLowerCase();
  }
  return name;
};

const deg = (value) => formatNumber(value, 2);

function el(tag, attributes = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attributes)) {
    if (value === false || value === null || value === undefined) continue;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key === 'style') node.style.cssText = value;
    else node.setAttribute(key, value === true ? '' : value);
  }
  node.append(...children.filter((child) => child !== null && child !== undefined && child !== false));
  return node;
}

// Título da página e trilha das cinco etapas
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
    const button = document.createElement('button');
    const number = document.createElement('span');
    const heading = document.createElement('span');
    const value = document.createElement('span');

    item.className = 'stage';
    item.dataset.state = 'pending';
    button.type = 'button';
    button.className = 'stage-tab';
    button.dataset.stage = String(index + 1);
    number.className = 'stage-number';
    number.textContent = String(index + 1);
    heading.className = 'stage-name';
    heading.textContent = name;
    value.className = 'stage-value';

    button.append(number, heading, value);
    item.append(button);
    list.append(item);
  });

  status.textContent = 'Estrutura carregada';
  root.classList.add('is-ready');

  return { ready: true, stageCount: stages.length };
}

// Resumo curto de cada etapa, exibido na trilha depois que a etapa é revelada
function stageSummary(index, result) {
  const active = result.evaluation.filter((rule) => rule.active).length;
  switch (index) {
    case 0: {
      const positive = [...Object.values(result.fuzzification.humidity), ...Object.values(result.fuzzification.temperature)]
        .filter((mu) => mu > 0).length;
      return `${positive} graus acima de 0`;
    }
    case 1: return `${active} ${active === 1 ? 'regra ativa' : 'regras ativas'}`;
    case 2: return `${active} ${active === 1 ? 'recorte' : 'recortes'}`;
    case 3: {
      const sets = aggregationGroups(result).map(({ set }) => label(set));
      return sets.length ? sets.join(' e ').replace(/ e (?=.* e )/, ', ') : 'nenhum recorte';
    }
    default:
      return result.defuzzification.valid ? `${formatNumber(result.defuzzification.time, 2)} min` : 'sem saída';
  }
}

// Conteúdo de cada etapa

function degreeList(variable, degrees) {
  return el('table', { class: 'degrees' },
    el('caption', { class: 'visually-hidden', text: `Graus de ${DOMAINS[variable].label.toLowerCase()}` }),
    el('tbody', {}, ...Object.entries(degrees).map(([set, mu]) =>
      el('tr', { class: mu > 0 ? 'is-on' : '' },
        el('th', { scope: 'row' }, el('i', { class: `swatch set-${set}` }), label(set)),
        el('td', { class: 'meter-cell' }, el('span', { class: `meter set-${set}`, style: `--v:${mu}` })),
        el('td', { class: 'num', text: `μ = ${deg(mu)}` })
      )))
  );
}

function fuzzRow(variable, value, degrees) {
  const domain = DOMAINS[variable];
  return el('div', { class: 'fuzz-row' },
    createSetChart(variable, { value, title: domain.label }),
    el('div', { class: 'fuzz-side' },
      el('p', { class: 'reading' }, 'Entrada', el('strong', {}, formatNumber(value), el('small', { text: domain.unit }))),
      degreeList(variable, degrees)
    )
  );
}

function renderFuzzification(result) {
  const { humidity, temperature } = result.configuration;
  return el('div', {},
    fuzzRow('humidity', humidity, result.fuzzification.humidity),
    fuzzRow('temperature', temperature, result.fuzzification.temperature)
  );
}

function renderEvaluation(result, ui) {
  const rows = result.evaluation.map((rule) =>
    el('tr', { class: rule.active ? 'is-on' : '' },
      el('th', { scope: 'row', text: rule.id }),
      el('td', { text: label(rule.humidity) }),
      el('td', { text: label(rule.temperature) }),
      el('td', {}, el('span', { class: `tag set-${rule.consequent}`, text: label(rule.consequent) })),
      el('td', { class: 'num', text: `min(${deg(rule.humidityDegree)}; ${deg(rule.temperatureDegree)})` }),
      el('td', { class: 'num h', text: deg(rule.activation) }),
      el('td', { class: 'go' }, rule.active && ui.canView(3)
        ? el('button', { type: 'button', class: 'link', 'data-show-rule': rule.id, text: 'ver recorte' })
        : null)
    )
  );
  return el('div', {},
    el('table', { class: 'rule-table' },
      el('thead', {}, el('tr', {},
        el('th', { scope: 'col', text: 'Regra' }),
        el('th', { scope: 'col', text: 'Se o solo é' }),
        el('th', { scope: 'col', text: 'e a temperatura é' }),
        el('th', { scope: 'col', text: 'então o tempo é' }),
        el('th', { scope: 'col', class: 'num', text: 'Operação' }),
        el('th', { scope: 'col', class: 'num', text: 'h' }),
        el('th', { scope: 'col' }, el('span', { class: 'visually-hidden', text: 'Ações' }))
      )),
      el('tbody', {}, ...rows)
    )
  );
}

function ruleLog(rule) {
  const evaluation = rule;
  if (rule.clipHeight <= 0) {
    return `${rule.id}: min(${deg(evaluation.humidityDegree)}; ${deg(evaluation.temperatureDegree)}) = 0. A regra não contribui para a saída.`;
  }
  return `${rule.id}: min(${deg(evaluation.humidityDegree)}; ${deg(evaluation.temperatureDegree)}) = ${deg(rule.clipHeight)}; consequente ${label(rule.consequent)} recortado em ${deg(rule.clipHeight)}.`;
}

function renderImplication(result, ui) {
  const rules = result.implication.map((rule, index) => ({ ...result.evaluation[index], ...rule }));
  const selected = rules.find((rule) => rule.id === ui.selectedRule) ?? rules[0];

  const picker = el('div', { class: 'rule-picker', role: 'radiogroup', 'aria-label': 'Regra exibida no gráfico' },
    ...rules.map((rule) => el('button', {
      type: 'button',
      role: 'radio',
      'aria-checked': String(rule.id === selected.id),
      class: `pick${rule.clipHeight > 0 ? ' is-on' : ''}`,
      'data-select-rule': rule.id
    },
    el('strong', { text: rule.id }),
    el('span', { class: `tag set-${rule.consequent}`, text: label(rule.consequent) }),
    el('span', { class: 'num', text: `h ${deg(rule.clipHeight)}` })))
  );

  return el('div', { class: 'layout-stack' },
    picker,
    el('div', { class: 'info-block' },
      createImplicationChart(selected),
      el('p', { class: 'log-line', text: ruleLog(selected) })
    )
  );
}

function aggregationGroups(result) {
  const groups = new Map();
  for (const rule of result.implication) {
    if (rule.clipHeight <= 0) continue;
    const group = groups.get(rule.consequent) ?? { height: 0, ids: [] };
    group.height = Math.max(group.height, rule.clipHeight);
    group.ids.push(rule.id);
    groups.set(rule.consequent, group);
  }
  return Object.keys(FUZZY_SETS.irrigation).filter((set) => groups.has(set)).map((set) => ({ set, ...groups.get(set) }));
}

function renderAggregation(result) {
  const groups = aggregationGroups(result);
  return el('div', { class: 'layout-stack' },
    createAggregationChart(result),
    el('div', { class: 'info-strip' },
      el('p', { class: 'formula', text: 'μ(z) = max(μR1(z), …, μR9(z))' }),
      el('ul', { class: 'facts facts-row' }, ...groups.map(({ set, height, ids }) =>
        el('li', {},
          el('span', { class: `tag set-${set}`, text: label(set) }),
          ` altura ${deg(height)}`,
          el('small', { text: ids.length > 1 ? `máximo entre ${ids.join(', ')}, sem somar` : `vem de ${ids[0]}` })
        )))
    )
  );
}

function renderDefuzzification(result) {
  const d = result.defuzzification;
  if (!d.valid) {
    return el('p', { class: 'empty is-error', text: d.message });
  }
  return el('div', { class: 'layout-stack' },
    createAggregationChart(result, { centroid: true }),
    el('div', { class: 'info-strip' },
      el('p', { class: 'outcome' }, 'Regar por', el('strong', { text: formatNumber(d.time, 2) }), 'minutos'),
      el('div', { class: 'info-block' },
        el('p', { class: 'formula', text: 'z* = Σ z·μ(z) / Σ μ(z)' }),
        el('p', { class: 'formula num', text: `= ${formatNumber(d.numerator, 4)} / ${formatNumber(d.denominator, 4)} = ${formatNumber(d.time, 6)} min` }),
        el('p', { class: 'muted', text: `${d.sampleCount} pontos médios com Δz = ${formatNumber(d.step)} min, z(k) = (k + 0,5)·Δz.` })
      )
    )
  );
}

const STAGE_RENDERERS = [renderFuzzification, renderEvaluation, renderImplication, renderAggregation, renderDefuzzification];

function renderOverview(inputs) {
  return el('div', { class: 'layout-stack overview' },
    inputs.valid
      ? el('p', { class: 'hint', text: 'Calcular mostra o resultado e libera as cinco etapas acima. Avançar etapa mostra uma etapa por vez.' })
      : null,
    createSetChart('humidity', { value: inputs.errors.humidity ? null : inputs.humidity, title: 'Umidade do solo (entrada)' }),
    createSetChart('temperature', { value: inputs.errors.temperature ? null : inputs.temperature, title: 'Temperatura (entrada)' }),
    createSetChart('irrigation', { title: 'Tempo de irrigação (saída)' })
  );
}

// Controlador

export function mountSimulator(root) {
  const form = root.querySelector('#controls');
  const tabs = [...root.querySelectorAll('[data-stage-list] .stage-tab')];
  const status = root.querySelector('[data-app-status]');
  const viewTitle = root.querySelector('[data-view-title]');
  const viewBody = root.querySelector('[data-view-body]');
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
  // Estado só de apresentação: qual etapa está na tela e qual regra está no gráfico.
  // Trocar a etapa exibida ou a regra selecionada nunca recalcula a inferência.
  const ui = {
    view: 0,
    selectedRule: null,
    canView: (stage) => Boolean(state.result) && stage <= state.stageIndex
  };

  const selects = buildMatrix(matrix);
  const radios = buildStepOptions(stepOptions);

  function update(next) {
    const isNewResult = next.result && next.result !== state.result;
    state = next;
    ui.view = state.stageIndex;
    if (isNewResult) {
      ui.selectedRule = state.result.implication.find((rule) => rule.clipHeight > 0)?.id ?? 'R1';
    }
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
    buttons.advance.textContent = state.result && state.stageIndex >= STAGE_COUNT ? 'Rever do início' : 'Avançar etapa';

    renderRail();
    renderMatrixActivation();
    renderView(inputs);

    root.classList.toggle('has-result', Boolean(state.result));
  }

  function renderRail() {
    tabs.forEach((tab, index) => {
      const stage = index + 1;
      const revealed = ui.canView(stage);
      const item = tab.parentElement;
      item.dataset.state = !revealed ? 'pending' : stage === ui.view ? 'current' : 'done';
      tab.disabled = !revealed;
      tab.setAttribute('aria-current', stage === ui.view ? 'step' : 'false');
      tab.querySelector('.stage-value').textContent = revealed ? stageSummary(index, state.result) : '';
    });
  }

  function renderView(inputs) {
    if (!state.result || ui.view === 0) {
      viewTitle.textContent = 'Conjuntos do modelo';
      const kind = !inputs.valid ? 'invalid' : state.notice;
      status.dataset.kind = kind ?? '';
      status.textContent = kind
        ? NOTICES[kind]
        : 'As linhas verticais acompanham as entradas. Nada foi calculado ainda.';
      viewBody.replaceChildren(renderOverview(inputs));
      return;
    }

    const index = ui.view - 1;
    viewTitle.textContent = `${ui.view}. ${INFERENCE_STAGES[index]}`;
    status.dataset.kind = '';
    status.textContent = STAGE_HINTS[index];
    viewBody.replaceChildren(STAGE_RENDERERS[index](state.result, ui));
  }

  function renderMatrixActivation() {
    const showActivation = ui.canView(2);
    selects.forEach((select, index) => {
      const cell = select.closest('td');
      const h = showActivation ? state.result.evaluation[index].activation : 0;
      cell.style.setProperty('--h', String(h));
      cell.classList.toggle('is-active', showActivation && h > 0);
      cell.querySelector('.cell-h').textContent = showActivation ? `h ${deg(h)}` : '';
    });
  }

  // Entradas numéricas e controles deslizantes
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

  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => {
      if (!ui.canView(index + 1)) return;
      ui.view = index + 1;
      render();
    });
  });

  // Seleção de regra (etapa 3) e atalho "ver recorte" (etapa 2)
  viewBody.addEventListener('click', (event) => {
    const pick = event.target.closest('[data-select-rule], [data-show-rule]');
    if (!pick) return;
    ui.selectedRule = pick.dataset.selectRule ?? pick.dataset.showRule;
    if (pick.dataset.showRule) ui.view = 3;
    render();
    viewBody.querySelector(`[data-select-rule="${ui.selectedRule}"]`)?.focus();
  });

  render();
  return { getState: () => state };
}

function buildMatrix(table) {
  const humiditySets = Object.keys(FUZZY_SETS.humidity);
  const temperatureSets = Object.keys(FUZZY_SETS.temperature);
  const options = Object.keys(FUZZY_SETS.irrigation);

  const head = el('thead', {}, el('tr', {},
    el('td', { class: 'corner', text: 'solo / temp.' }),
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
        el('span', { class: 'cell-h' }),
        select
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
    container.append(el('span', {}, radio, el('label', { for: id, text: formatNumber(step) })));
    return radio;
  });
}
