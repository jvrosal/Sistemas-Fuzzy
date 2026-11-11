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
    const label = document.createElement('strong');

    item.className = 'workflow-item';
    number.className = 'workflow-number';
    number.textContent = String(index + 1).padStart(2, '0');
    label.textContent = name;

    item.append(number, label);
    list.append(item);
  });

  status.textContent = 'Estrutura carregada';
  root.classList.add('is-ready');

  return { ready: true, stageCount: stages.length };
}
