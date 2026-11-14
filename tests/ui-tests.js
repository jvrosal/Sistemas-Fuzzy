
import { APP_INFO, DEFAULT_RULES, INFERENCE_STAGES } from '../js/constants.js';
import { initializeInterface, mountSimulator } from '../js/ui.js';

export async function runUITests(check) {
  const test = (name, assertion) => {
    try { check(name, Boolean(assertion())); }
    catch { check(name, false); }
  };

  // Usa o HTML real da aplicação em um contêiner isolado para testar o DOM e seus eventos.
  const frame = document.createElement('div');
  frame.setAttribute('aria-hidden', 'true');
  frame.style.cssText = 'position:absolute;left:-10000px;width:1000px;min-height:750px';

  try {
    const response = await fetch('../index.html');
    if (!response.ok) throw new Error('Não foi possível carregar index.html.');
    const parsed = new DOMParser().parseFromString(await response.text(), 'text/html');
    const source = parsed.querySelector('#app');
    if (!source) throw new Error('Elemento #app ausente em index.html.');
    const root = document.importNode(source, true);
    frame.append(root);
    document.body.append(frame);
    initializeInterface(root, { title: APP_INFO.title, stages: INFERENCE_STAGES });
    mountSimulator(root);
    const doc = root;
    const win = window;
    check('Interface real: HTML e módulos da aplicação carregados', true);
    const query = (selector) => doc.querySelector(selector);
    const queryAll = (selector) => [...doc.querySelectorAll(selector)];
    const field = (name) => query(`#${name}-input`);
    const controls = () => ({
      calculate: query('[data-action="calculate"]'),
      advance: query('[data-action="advance"]'),
      reset: query('[data-action="reset"]')
    });
    const enter = (name, value) => {
      const input = field(name);
      input.value = value;
      input.dispatchEvent(new win.Event('input', { bubbles: true }));
    };
    const slide = (name, value) => {
      const input = query(`#${name}-slider`);
      input.value = value;
      input.dispatchEvent(new win.Event('input', { bubbles: true }));
    };
    const chooseRule = (index, value) => {
      const select = queryAll('[data-rule-matrix] select')[index];
      select.value = value;
      select.dispatchEvent(new win.Event('change', { bubbles: true }));
    };
    const chooseStep = (value) => {
      const radio = query(`input[name="step"][value="${value}"]`);
      radio.checked = true;
      radio.dispatchEvent(new win.Event('change', { bubbles: true }));
    };
    const reset = () => controls().reset.click();
    const calculate = () => controls().calculate.click();
    const advance = () => controls().advance.click();
    const result = () => query('[data-result-summary]');
    const visibleResult = () => !result().hidden;
    const time = () => result().querySelector('.summary-value strong')?.textContent;
    const activeStages = () => queryAll('[data-stage-list] > li').filter((item) => item.dataset.state !== 'pending');
    const getExactTime = () => {
      const text = query('.stage-output .formula')?.textContent ?? '';
      const match = text.match(/= ([\d.,]+) min$/);
      return match ? Number(match[1].replace('.', '').replace(',', '.')) : NaN;
    };

    test('Interface: inicializa os cinco estágios', () =>
      queryAll('[data-stage-list] > li').length === 5 && root.classList.contains('is-ready'));
    test('Interface: apresenta os dois campos de entrada', () =>
      field('humidity').value === '35' && field('temperature').value === '30');
    test('Interface: apresenta nove regras editáveis', () => queryAll('[data-rule-matrix] select').length === 9);
    test('Interface: apresenta três opções de precisão', () => queryAll('input[name="step"]').length === 3);
    test('Interface: começa com passo de 0,1', () => query('input[name="step"][value="0.1"]').checked);
    test('Interface: mostra duas curvas prévias em SVG', () => queryAll('[data-overview-graphs] svg').length === 2);
    test('Interface: botões estão habilitados com entradas válidas', () =>
      !controls().calculate.disabled && !controls().advance.disabled);
    test('Interface: resultado começa oculto', () => result().hidden && activeStages().length === 0);

    for (const [name, raw] of [
      ['humidity', '-1'], ['humidity', '101'],
      ['temperature', '9'], ['temperature', '41'],
      ['humidity', ''], ['temperature', ''],
      ['humidity', 'abc'], ['temperature', 'Infinity']
    ]) {
      reset();
      enter(name, raw);
      test(`Interface: bloqueia ${name}=${JSON.stringify(raw)}`, () =>
        Boolean(query(`#${name}-error`).textContent) && field(name).getAttribute('aria-invalid') === 'true' &&
        controls().calculate.disabled && controls().advance.disabled && !visibleResult());
      test(`Interface: fornece aviso para ${name}=${JSON.stringify(raw)}`, () =>
        query('[data-app-status]').textContent.includes('Corrija os campos destacados'));
    }

    for (const [humidity, temperature] of [[0, 10], [100, 40], [0, 40], [100, 10]]) {
      reset();
      enter('humidity', String(humidity));
      enter('temperature', String(temperature));
      test(`Interface: aceita U=${humidity}, T=${temperature}`, () =>
        !controls().calculate.disabled && !controls().advance.disabled &&
        !query('[data-field="humidity"]').classList.contains('has-error') &&
        !query('[data-field="temperature"]').classList.contains('has-error'));
      calculate();
      test(`Interface: calcula limites U=${humidity}, T=${temperature}`, () =>
        visibleResult() && Number(time().replace(',', '.')) >= 0);
    }

    reset();
    calculate();
    const standardTime = time();
    const standardExact = getExactTime();
    test('Interface: cálculo direto apresenta 16,79 minutos', () =>
      standardTime === '16,79' && visibleResult());
    test('Interface: cálculo direto revela cinco operações', () => activeStages().length === 5);
    test('Interface: inclui gráfico com centroide no quinto estágio', () =>
      queryAll('[data-stage-list] > li:nth-child(5) svg').length === 1 &&
      query('[data-stage-list] > li:nth-child(5) svg').getAttribute('aria-label').includes('Centroide'));
    test('Interface: armazena centroide com seis casas na apresentação', () =>
      Math.abs(standardExact - 16.785683) < 0.000001);

    enter('humidity', '40');
    test('Interface: mudança da umidade descarta a resposta antiga', () =>
      !visibleResult() && activeStages().length === 0 &&
      query('[data-notice]').textContent.includes('descartados'));
    test('Interface: mudança da umidade atualiza a prévia gráfica', () =>
      queryAll('[data-overview-graphs] svg').length === 2 &&
      query('[data-overview-graphs] figcaption').textContent.includes('40'));
    calculate();
    slide('temperature', '31');
    test('Interface: slider sincroniza o campo numérico', () => field('temperature').value === '31');
    test('Interface: slider invalida a resposta anterior', () => !visibleResult() && activeStages().length === 0);

    reset();
    calculate();
    chooseRule(4, 'curto');
    test('Interface: edição individual altera o seletor R5', () =>
      queryAll('[data-rule-matrix] select')[4].value === 'curto');
    test('Interface: edição individual invalida o cálculo', () =>
      !visibleResult() && activeStages().length === 0 && query('[data-notice]').dataset.kind === 'changed');
    calculate();
    test('Interface: regra editada efetivamente afeta a inferência', () => time() !== standardTime);
    test('Interface: antecedentes das regras permanecem fixos', () =>
      queryAll('[data-rule-matrix] select').every((select, index) =>
        select.getAttribute('aria-label').startsWith(DEFAULT_RULES[index].id + ':')));

    reset();
    for (let i = 0; i < 9; i += 1) chooseRule(i, 'curto');
    enter('humidity', '50');
    enter('temperature', '25');
    test('Interface: nove consequentes podem ser alterados', () =>
      queryAll('[data-rule-matrix] select').every((select) => select.value === 'curto'));
    calculate();
    test('Interface: nove regras curto produzem 5,00 minutos', () => time() === '5,00');

    reset();
    chooseStep('0.05');
    test('Interface: opção de passo 0,05 é aplicada', () => query('input[value="0.05"]').checked);
    calculate();
    test('Interface: passo 0,05 utiliza 600 amostras', () =>
      query('.stage-output .formula')?.textContent.includes('16,785706') &&
      query('[data-stage-list] > li:nth-child(5)').textContent.includes('600 amostras'));
    chooseStep('0.01');
    test('Interface: alteração do passo invalida o resultado', () => !visibleResult() && activeStages().length === 0);
    calculate();
    test('Interface: passo 0,01 utiliza 3000 amostras', () =>
      /3\.?000 amostras/.test(query('[data-stage-list] > li:nth-child(5)').textContent));

    reset();
    advance();
    test('Interface: avanço 1 mostra fuzzificação', () =>
      activeStages().length === 1 && activeStages()[0].dataset.state === 'current' &&
      queryAll('[data-stage-list] > li:nth-child(1) svg').length === 2);
    advance();
    test('Interface: avanço 2 mostra ativação das nove regras', () =>
      activeStages().length === 2 && activeStages()[1].dataset.state === 'current' &&
      queryAll('[data-stage-list] > li:nth-child(2) tbody tr').length === 9);
    test('Interface: avanço 2 mostra ativação na matriz', () =>
      queryAll('[data-rule-matrix] .cell-h').some((node) => node.textContent.includes('h =')));
    advance();
    test('Interface: avanço 3 mostra implicação e seletor de regras', () =>
      activeStages().length === 3 && activeStages()[2].dataset.state === 'current' &&
      query('[aria-label="Selecione a regra para visualizar a implicação"]')?.options.length === 9);
    const implicationPicker = query('[aria-label="Selecione a regra para visualizar a implicação"]');
    implicationPicker.value = 'R5';
    implicationPicker.dispatchEvent(new win.Event('change', { bubbles: true }));
    test('Interface: seletor de implicação atualiza o gráfico', () =>
      query('[data-stage-list] > li:nth-child(3) figcaption')?.textContent.includes('R5'));
    advance();
    test('Interface: avanço 4 mostra agregação e gráfico', () =>
      activeStages().length === 4 && activeStages()[3].dataset.state === 'current' &&
      queryAll('[data-stage-list] > li:nth-child(4) svg').length === 1);
    advance();
    test('Interface: avanço 5 mostra centroide e resultado final', () =>
      activeStages().length === 5 && visibleResult() && time() === standardTime);
    test('Interface: cálculo progressivo equivale ao cálculo direto', () => getExactTime() === standardExact);
    test('Interface: permite rever do início', () => controls().advance.textContent === 'Rever do início');
    advance();
    test('Interface: rever reinicia apenas a apresentação', () =>
      activeStages().length === 1 && !visibleResult() &&
      controls().advance.textContent === 'Avançar etapa');

    reset();
    chooseRule(0, 'curto');
    chooseStep('0.01');
    enter('humidity', '50');
    enter('temperature', '25');
    calculate();
    reset();
    test('Interface: restauração retorna entradas e sliders ao padrão', () =>
      field('humidity').value === '35' && field('temperature').value === '30' &&
      query('#humidity-slider').value === '35' && query('#temperature-slider').value === '30');
    test('Interface: restauração retorna as nove regras ao padrão', () =>
      queryAll('[data-rule-matrix] select').every((select, i) => select.value === DEFAULT_RULES[i].consequent));
    test('Interface: restauração retorna a precisão ao padrão', () =>
      query('input[name="step"][value="0.1"]').checked);
    test('Interface: restauração limpa resultados e informa o usuário', () =>
      !visibleResult() && activeStages().length === 0 &&
      query('[data-notice]').dataset.kind === 'reset');
    calculate();
    const firstRun = getExactTime();
    reset();
    calculate();
    test('Interface: mesma configuração produz o mesmo resultado', () =>
      firstRun === getExactTime() && firstRun === standardExact);
  } catch (error) {
    check(`Interface real: erro inesperado (${error.message})`, false);
  } finally {
    frame.remove();
  }
}
