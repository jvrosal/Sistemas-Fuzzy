# Simulador Fuzzy Mamdani — Irrigação de Jardim

Projeto da disciplina de Inteligência Artificial da Universidade Federal do Piauí (2026.2).

## Objetivo

Desenvolver um simulador didático de inferência fuzzy Mamdani que recomende o tempo de irrigação a partir da umidade do solo e da temperatura ambiente. A aplicação será executada integralmente no navegador, sem servidor de aplicação.

## Estado do projeto

**Etapa 00 — Fundação e estrutura inicial.**

Nesta etapa foram criadas a estrutura de arquivos, a interface inicial, a inicialização dos módulos e uma página de testes de carregamento. **A inferência fuzzy ainda não está implementada.**

As próximas etapas implementarão os conjuntos, a fuzzificação, as regras, a implicação, a agregação, a defuzzificação e as visualizações.

## Tecnologias

- HTML5, CSS3 e JavaScript com módulos ES.
- SVG nativo para as futuras visualizações.
- Sem frameworks ou bibliotecas externas nesta etapa.
- GitHub Pages para a publicação final.

## Estrutura

```text
simulador-fuzzy/
├── index.html
├── README.md
├── css/
│   └── style.css
├── js/
│   ├── constants.js
│   ├── membership.js
│   ├── inference.js
│   ├── defuzzification.js
│   ├── simulator.js
│   ├── charts.js
│   ├── ui.js
│   └── app.js
└── tests/
    ├── index.html
    └── tests.js
```

Os módulos `membership.js`, `inference.js`, `defuzzification.js`, `simulator.js` e `charts.js` estão reservados para as próximas etapas.

## Como executar

Use um servidor estático local (por exemplo, a extensão **Live Server** do VS Code) e abra `index.html`. Não é necessário instalar dependências.

Alternativamente, com Python instalado, execute na pasta do projeto:

```bash
python -m http.server 8000
```

Acesse `http://localhost:8000/` no navegador.

Para executar os testes iniciais, abra `http://localhost:8000/tests/`.

O uso de um servidor estático local serve apenas para carregar os módulos ES durante o desenvolvimento. A aplicação final será estática e poderá ser publicada diretamente no GitHub Pages.

## Testes da etapa 00

A página `tests/index.html` verifica as informações básicas do aplicativo, a ordem das cinco etapas, a inicialização da interface, a renderização da lista e o carregamento dos módulos reservados. Esses testes ainda **não validam cálculos fuzzy**.

## Requisitos das próximas etapas

- Entradas: umidade de 0 a 100% e temperatura de 10 a 40 °C.
- Saída: tempo de irrigação de 0 a 30 minutos.
- Nove regras editáveis apenas em seus consequentes.
- Inferência Mamdani com operador mínimo, agregação por máximo e centroide numérico por pontos médios.
- Visualização gráfica obrigatória das etapas do processo.
- Testes de referência e documentação dos resultados neste README.

## Autores

A preencher antes da entrega.
