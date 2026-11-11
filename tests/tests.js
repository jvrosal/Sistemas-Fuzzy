import { APP_INFO, INFERENCE_STAGES } from '../js/constants.js';
import { initializeInterface } from '../js/ui.js';

const results = document.querySelector('#test-results');
const summary = document.querySelector('#test-summary');
const tests = [];

function check(name, condition) {
  tests.push({ name, passed: Boolean(condition) });
}

check('Informações da aplicação definidas', APP_INFO.title === 'Simulador Fuzzy Mamdani' && APP_INFO.stage === 0);
check('Cinco etapas na ordem correta', INFERENCE_STAGES.join('|') === 'Fuzzificação|Avaliação das regras|Implicação|Agregação|Defuzzificação');

const fixture = document.createElement('section');
fixture.innerHTML = '<span data-app-status></span><ol data-stage-list></ol>';
const initialized = initializeInterface(fixture, { title: APP_INFO.title, stages: INFERENCE_STAGES });

check('Interface inicializada', initialized.ready && fixture.classList.contains('is-ready'));
check('Cinco etapas renderizadas', fixture.querySelectorAll('[data-stage-list] li').length === 5);
check('Mensagem de carregamento atualizada', fixture.querySelector('[data-app-status]').textContent === 'Estrutura carregada');

const modules = ['membership', 'inference', 'defuzzification', 'simulator', 'charts'];

for (const moduleName of modules) {
  try {
    await import(`../js/${moduleName}.js`);
    check(`Módulo ${moduleName} carregado`, true);
  } catch {
    check(`Módulo ${moduleName} carregado`, false);
  }
}

results.replaceChildren();

for (const test of tests) {
  const row = document.createElement('div');
  const label = document.createElement('strong');
  const state = document.createElement('span');

  row.className = 'test-result';
  label.textContent = test.name;
  state.className = test.passed ? 'test-pass' : 'test-fail';
  state.textContent = test.passed ? 'Aprovado' : 'Falhou';
  row.append(label, state);
  results.append(row);
}

const passed = tests.filter((test) => test.passed).length;
summary.textContent = `${passed} de ${tests.length} testes aprovados.`;
summary.dataset.passed = String(passed);
summary.dataset.total = String(tests.length);
