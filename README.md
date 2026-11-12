
# Simulador Fuzzy Mamdani — Irrigação de Jardim

Projeto da disciplina de Inteligência Artificial da Universidade Federal do Piauí (2026.2).

## Objetivo

Desenvolver um simulador didático de inferência fuzzy Mamdani que recomende o tempo de irrigação a partir da umidade do solo e da temperatura ambiente. A aplicação será executada integralmente no navegador, sem servidor de aplicação.

## Estado do projeto

O arquivo `js/constants.js` contém os domínios, os nove conjuntos fuzzy, as nove regras padrão, os três passos permitidos para o centroide e os valores iniciais. Os dados do modelo são imutáveis; os consequentes editáveis serão mantidos em cópias das regras padrão.

O módulo `js/membership.js` calcula graus de pertinência de funções triangulares e trapezoidais, incluindo os conjuntos de extremidade. Também realiza a fuzzificação das entradas, retornando os três graus de umidade e os três de temperatura, inclusive quando são zero. **A avaliação das regras, a implicação, a agregação, a defuzzificação e a integração completa do motor Mamdani estão implementadas.** Os controles de edição, a navegação pela inferência e os gráficos serão acrescentados na interface. O visual seguirá o modelo aprovado para o projeto.

## Tecnologias

- HTML5, CSS3 e JavaScript com módulos ES.
- SVG nativo para as futuras visualizações.
- Sem frameworks ou bibliotecas externas.
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

O módulo `simulator.js` integra as cinco operações de inferência. O módulo `charts.js` permanece reservado para as visualizações.

## Conjuntos fuzzy

Cada conjunto é definido pelos pontos `(a, b, c, d)`, com `a ≤ b ≤ c ≤ d`.

### Umidade do solo (0% a 100%)

| Conjunto | Pontos |
|---|---|
| Seco | (0, 0, 20, 50) |
| Intermediário | (20, 50, 50, 80) |
| Úmido | (50, 80, 100, 100) |

### Temperatura (10 °C a 40 °C)

| Conjunto | Pontos |
|---|---|
| Baixa | (10, 10, 15, 25) |
| Média | (15, 25, 25, 35) |
| Alta | (25, 35, 40, 40) |

### Tempo de irrigação (0 a 30 minutos)

| Conjunto | Pontos |
|---|---|
| Curto | (0, 0, 0, 15) |
| Médio | (0, 15, 15, 30) |
| Longo | (15, 30, 30, 30) |

## Funções de pertinência

A função `calculateMembership(value, points)`, exportada por `js/membership.js`, calcula o grau de pertinência de um valor num conjunto definido pelos pontos `(a, b, c, d)`, com `a ≤ b ≤ c ≤ d`.

- Retorna 1 quando `b ≤ value ≤ c`.
- Retorna `(value - a) / (b - a)` quando `a ≤ value < b`.
- Retorna `(d - value) / (d - c)` quando `c < value ≤ d`.
- Retorna 0 fora de `[a, d]`.

O platô é avaliado antes das rampas. Quando `a = b` ou `c = d`, a respectiva rampa é vazia e nenhuma divisão por zero acontece. O método aceita funções triangulares (`b = c`), trapezoidais e conjuntos nas extremidades. Os cálculos não arredondam a pertinência.

Valores de entrada não finitos e pontos inválidos produzem um `TypeError`, em vez de resultados indefinidos. Valores numéricos fora do suporte do conjunto retornam 0.

**Conferências principais:** `μseco(0) = 1`, `μseco(35) = 0,5`, `μintermediário(50) = 1`, `μúmido(100) = 1`, `μbaixa(10) = 1`, `μmédia(25) = 1`, `μalta(40) = 1`, `μcurto(0) = 1` e `μlongo(30) = 1`.

## Fuzzificação

A função `fuzzifyInputs(humidity, temperature)` recebe a umidade (0% a 100%) e a temperatura (10 °C a 40 °C) como números e retorna os seis graus de pertinência, preservando a ordem dos conjuntos:

- Umidade: `seco`, `intermediario`, `umido`.
- Temperatura: `baixa`, `media`, `alta`.

A função `fuzzifyVariable(value, variable)` permite avaliar uma entrada isoladamente (`humidity` ou `temperature`). Ambas utilizam a função `calculateMembership`, sem arredondar resultados nem eliminar pertinências nulas.

Para U = 35% e T = 30 °C, a saída é:

```js
{
  humidity: { seco: 0.5, intermediario: 0.5, umido: 0 },
  temperature: { baixa: 0, media: 0.5, alta: 0.5 }
}
```

A fuzzificação rejeita valores não numéricos e não finitos com `TypeError` e valores fora dos domínios com `RangeError`. A validação dos controles da interface será adicionada posteriormente.

## Regras padrão

| Regra | Umidade | Temperatura | Tempo |
|---|---|---|---|
| R1 | Seco | Baixa | Médio |
| R2 | Seco | Média | Longo |
| R3 | Seco | Alta | Longo |
| R4 | Intermediário | Baixa | Curto |
| R5 | Intermediário | Média | Médio |
| R6 | Intermediário | Alta | Longo |
| R7 | Úmido | Baixa | Curto |
| R8 | Úmido | Média | Curto |
| R9 | Úmido | Alta | Curto |

Os antecedentes são fixos. Apenas os consequentes poderão ser editados na interface, sem excluir regras.

## Avaliação das regras

O módulo `js/inference.js` avalia todas as nove regras Mamdani por meio da função `evaluateRules(fuzzification, rules)`. O argumento `fuzzification` contém os seis graus calculados por `fuzzifyInputs`. O argumento `rules` é opcional e utiliza a base padrão caso não seja informado.

Cada regra aplica o operador **E** pelo mínimo dos graus de seus dois antecedentes:

```text
h(r) = min(μumidade(U), μtemperatura(T))
```

O retorno inclui o identificador, os dois antecedentes, o consequente, ambos os graus de pertinência, a intensidade `activation` e o indicador `active`. Todas as regras aparecem no retorno, inclusive aquelas com ativação zero. Não há arredondamento nos cálculos.

Para U = 35% e T = 30 °C, as regras R2, R3, R5 e R6 são ativadas com intensidade 0,5. As demais apresentam intensidade zero. Para os casos de ativação única, U = 20% e T = 35 °C ativa somente R3; U = 50% e T = 25 °C ativa somente R5; U = 80% e T = 25 °C ativa somente R8. Em todos os três casos, a intensidade da única regra ativada é 1.

A função `validateRules(rules)` verifica se existem exatamente nove regras, com identificadores únicos, antecedentes originais e consequentes válidos (`curto`, `medio` ou `longo`). Para testar mudanças de consequentes sem alterar os padrões, forneça uma cópia editável:

```js
const rules = DEFAULT_RULES.map((rule) => ({ ...rule }));
rules[1].consequent = 'curto';
const activations = evaluateRules(fuzzifyInputs(35, 30), rules);
```

Alterar consequentes não modifica as intensidades, que dependem apenas dos antecedentes. A interface para editar essas regras será adicionada posteriormente.

## Implicação Mamdani

O módulo `js/inference.js` inclui a função `applyImplication(evaluatedRules)`, que recebe as nove regras avaliadas e prepara o recorte de cada consequente pela respectiva ativação. Cada resultado mantém os dados da regra e acrescenta:

- `clipHeight`: altura de recorte, igual à ativação `h(r)`.
- `consequentPoints`: os quatro pontos originais do conjunto de saída (curto, médio ou longo).

A função `getImpliedMembership(implication, value)` calcula o recorte em um ponto `z`:

```text
μr(z) = min(h(r), μconsequente(z))
```

O conjunto recortado é representado por seus pontos originais e sua altura de corte. Assim, pode ser avaliado em qualquer posição da saída sem substituir o conjunto por uma constante ou calcular antecipadamente uma quantidade fixa de amostras. Isso permitirá utilizar os mesmos recortes na agregação e nos gráficos.

Exemplo com U = 35% e T = 30 °C:

```js
import { fuzzifyInputs } from './js/membership.js';
import { evaluateRules, applyImplication, getImpliedMembership } from './js/inference.js';

const degrees = fuzzifyInputs(35, 30);
const activations = evaluateRules(degrees);
const implications = applyImplication(activations);
const r2 = implications.find((rule) => rule.id === 'R2');

getImpliedMembership(r2, 30); // 0.5
```

Nesse caso, R2, R3, R5 e R6 possuem ativação 0,5. R2, R3 e R6 recortam o conjunto longo em 0,5; R5 recorta o conjunto médio em 0,5. As regras inativas produzem pertinência zero em todos os pontos. Cada recorte permanece independente, sem soma das contribuições e sem arredondamento.

A função `applyImplication` rejeita bases incompletas, consequentes inválidos e ativações fora do intervalo de 0 a 1. A consulta `getImpliedMembership` também rejeita alturas inválidas e valores não finitos. A combinação dos recortes pelo operador máximo está descrita a seguir.

Casos de conferência da implicação (base padrão):

| Entradas | Regra | Recorte observado |
|---|---|---|
| U = 35%, T = 30 °C | R2, R3, R6 | Longo limitado à altura 0,5 |
| U = 35%, T = 30 °C | R5 | Médio limitado à altura 0,5 |
| U = 35%, T = 30 °C | R1, R4, R7, R8, R9 | Pertinência zero em todo o domínio |
| U = 20%, T = 35 °C | R3 | Longo completo, altura 1 |
| U = 50%, T = 25 °C | R5 | Médio completo, altura 1 |
| U = 80%, T = 25 °C | R8 | Curto completo, altura 1 |

## Agregação Mamdani

O módulo `js/inference.js` também disponibiliza `aggregateImplications(implications)`, que recebe os nove recortes preparados pela implicação e produz uma representação única da saída agregada. Os recortes são preservados como cópias independentes, incluindo regras com ativação zero.

A função `getAggregatedMembership(aggregation, value)` calcula o grau de pertinência agregado em qualquer tempo `z`, utilizando exclusivamente o **máximo**:

```text
μagregada(z) = max(μR1(z), μR2(z), ..., μR9(z))
```

Nenhuma contribuição é somada e nenhuma regra ativada é descartada por outra possuir a mesma altura. O método trabalha com as funções recortadas e pode ser consultado em qualquer ponto do domínio de 0 a 30 minutos; não utiliza amostras fixas nem valores constantes no lugar dos conjuntos fuzzy.

Exemplo com U = 35% e T = 30 °C:

```js
import { fuzzifyInputs } from './js/membership.js';
import { evaluateRules, applyImplication, aggregateImplications, getAggregatedMembership } from './js/inference.js';

const degrees = fuzzifyInputs(35, 30);
const rules = evaluateRules(degrees);
const aggregation = aggregateImplications(applyImplication(rules));

getAggregatedMembership(aggregation, 3);   // 0.2
getAggregatedMembership(aggregation, 7.5); // 0.5
getAggregatedMembership(aggregation, 30);  // 0.5
```

Nesse caso, R2, R3 e R6 contribuem com o conjunto longo recortado a 0,5 e R5 contribui com o médio recortado a 0,5. O resultado agregado é:

```text
μagregada(z) = z/15, se 0 ≤ z ≤ 7,5
μagregada(z) = 0,5, se 7,5 < z ≤ 30
```

Valores de conferência:

| z (min) | 0 | 3 | 7,5 | 15 | 30 |
|---|---:|---:|---:|---:|---:|
| μagregada(z) | 0 | 0,2 | 0,5 | 0,5 | 0,5 |

A agregação rejeita listas incompletas, recortes com alturas inválidas e consequentes incoerentes. Também verifica os nove identificadores e os antecedentes fixos. A função de consulta rejeita valores não finitos; fora do suporte dos conjuntos, a pertinência é zero.

Para U = 35% e T = 20 °C, as regras R1, R2, R4 e R5 produzem uma região agregada constante em 0,5 de 0 a 30 minutos. Nos três casos de regra única (R3, R5 e R8), a agregação corresponde exatamente ao respectivo conjunto completo.

## Defuzzificação pelo centroide

O módulo `js/defuzzification.js` exporta a função `calculateCentroid(aggregation, step)`. Ela recebe a saída agregada e calcula o centroide por aproximação numérica **exclusivamente com pontos médios**, conforme o enunciado:

```text
N = 30 / Δz
z(k) = (k + 0,5) × Δz, com k = 0, ..., N - 1
z* = Σ[z(k) × μagregada(z(k))] / Σ[μagregada(z(k))]
```

Os passos permitidos são 0,1, 0,05 e 0,01 minuto, correspondendo a 300, 600 e 3.000 amostras. O cálculo utiliza as pertinências agregadas pelo operador máximo, sem arredondamentos intermediários. O passo padrão é 0,1 minuto.

A função retorna `valid`, `time`, `numerator`, `denominator`, `sampleCount` e `step`. No exemplo abaixo, o tempo calculado é aproximadamente 16,785683 minutos, exibido com duas casas decimais como 16,79 minutos. Se o denominador for zero, retorna `valid: false`, `time: null` e uma mensagem informando que não há saída agregada válida. Não retorna zero nem um valor indefinido como recomendação.

Exemplo de utilização:

```js
import { fuzzifyInputs } from './js/membership.js';
import { evaluateRules, applyImplication, aggregateImplications } from './js/inference.js';
import { calculateCentroid } from './js/defuzzification.js';

const degrees = fuzzifyInputs(35, 30);
const rules = evaluateRules(degrees);
const aggregation = aggregateImplications(applyImplication(rules));
const result = calculateCentroid(aggregation, 0.1);

console.log(result.time);
console.log(result.time.toFixed(2));
```

### Conferência dos resultados numéricos

Todos os testes abaixo utilizam a base de regras padrão e o passo Δz = 0,1 minuto, salvo indicação em contrário.

| Umidade | Temperatura | Regras ativadas | Tempo obtido | Referência | Conclusão |
|---|---|---|---:|---:|---|
| 20% | 35 °C | R3 (1) | 24,999889 min | ≈ 25,00 min | Aprovado |
| 50% | 25 °C | R5 (1) | 15,000000 min | 15,00 min | Aprovado |
| 80% | 25 °C | R8 (1) | 5,000111 min | ≈ 5,00 min | Aprovado |
| 35% | 30 °C | R2, R3, R5, R6 (0,5) | 16,785683 min | ≈ 16,785683 min | Aprovado |
| 35% | 20 °C | R1, R2, R4, R5 (0,5) | 15,000000 min | 15,00 min | Aprovado |
| 50% | 25 °C | R5 (1), consequente editado para curto | 5,000111 min | ≈ 5,00 min | Aprovado |

No último caso, todos os consequentes foram alterados para curto. Após restaurar a base padrão, o cálculo com U = 35% e T = 30 °C voltou a 16,79 minutos na exibição com duas casas decimais.

A comparação do passo numérico, utilizando U = 35%, T = 30 °C e a base padrão, produziu:

| Passo Δz | Amostras | Centroide obtido | Referência numérica | Conclusão |
|---|---:|---:|---:|---|
| 0,1 | 300 | 16,785682540 min | 16,785683 min | Aprovado |
| 0,05 | 600 | 16,785706349 min | 16,785706 min | Aprovado |
| 0,01 | 3.000 | 16,785713968 min | 16,785714 min | Aprovado |

Os resultados convergem para o centroide contínuo de aproximadamente **16,785714 minutos**, mas todos são exibidos como **16,79 minutos** quando arredondados para duas casas decimais. A tolerância máxima para os tempos de referência é 0,01 minuto, e a precisão interna é preservada.

Também foram testados o denominador nulo, passos inválidos, a imutabilidade da agregação e o determinismo do cálculo. A validação gráfica e da interface será realizada quando esses componentes forem implementados.

## Execução integrada do simulador

O arquivo `js/simulator.js` exporta `runSimulation(configuration)`, responsável por executar as cinco operações do método Mamdani em sequência, sem depender de elementos HTML. Todas as operações usam os módulos matemáticos já implementados:

1. **Fuzzificação:** calcula os seis graus de pertinência.
2. **Avaliação das regras:** calcula as nove ativações com o operador mínimo.
3. **Implicação:** prepara os recortes dos nove consequentes, também pelo mínimo.
4. **Agregação:** combina os recortes por máximo, sem somar áreas.
5. **Defuzzificação:** calcula o centroide por pontos médios no passo escolhido.

Sem argumentos, a função utiliza a configuração padrão: umidade de 35%, temperatura de 30 °C, passo de 0,1 minuto e as nove regras originais. Para configurações personalizadas, informe `humidity`, `temperature` e `step`; `rules` é opcional, desde que todas as nove regras sejam válidas quando fornecidas.

```js
import { runSimulation } from './js/simulator.js';

const simulation = runSimulation();

console.log(simulation.fuzzification);
console.log(simulation.evaluation);
console.log(simulation.implication);
console.log(simulation.aggregation);
console.log(simulation.defuzzification.time.toFixed(2)); // 16.79
```

O retorno possui os campos:

| Campo | Conteúdo |
|---|---|
| `configuration` | Umidade, temperatura, passo e cópia das nove regras utilizadas |
| `fuzzification` | Três graus de umidade e três de temperatura, inclusive zeros |
| `evaluation` | As nove regras com graus antecedentes e ativações |
| `implication` | Recortes e alturas das nove regras |
| `aggregation` | Representação da saída combinada, consultável em qualquer ponto |
| `defuzzification` | Validade, tempo, numerador, denominador, passo e número de amostras |
| `stages` | Cinco objetos com `id`, `label` e `result`, na ordem da inferência |

O campo `stages` reutiliza os resultados do mesmo cálculo completo, permitindo que a interface os apresente progressivamente sem implementar um segundo caminho matemático. O centroide só é calculado uma vez por execução e sua precisão é mantida até a apresentação. Se não existir área agregada válida, `defuzzification.valid` é `false` e `time` é `null`.

Para alterar os consequentes:

```js
import { DEFAULT_CONFIG, DEFAULT_RULES } from './js/constants.js';
import { runSimulation } from './js/simulator.js';

const rules = DEFAULT_RULES.map((rule) => ({ ...rule, consequent: 'curto' }));
const result = runSimulation({ ...DEFAULT_CONFIG, humidity: 50, temperature: 25, rules });

console.log(result.defuzzification.time.toFixed(2)); // 5.00
```

As configurações inválidas são rejeitadas: campos não numéricos ou não finitos, entradas fora dos domínios, passo diferente dos três permitidos, base incompleta, consequentes inválidos ou alteração de antecedentes. A execução não modifica as configurações recebidas nem as regras padrão. Para a execução manual, a página principal ainda não possui controles funcionais; essa parte será implementada separadamente da lógica matemática.

### Resultados da integração

Com a base padrão e Δz = 0,1 minuto, os testes de integração reproduzem os tempos de referência: U = 20%, T = 35 °C → aproximadamente 25,00 min; U = 50%, T = 25 °C → 15,00 min; U = 80%, T = 25 °C → aproximadamente 5,00 min; U = 35%, T = 30 °C → aproximadamente 16,785683 min; U = 35%, T = 20 °C → 15,00 min. Também foram validados os passos 0,05 e 0,01, os consequentes editados, a preservação dos dados e a repetibilidade da execução.

## Configurações iniciais

| Parâmetro | Inicial | Valores permitidos |
|---|---|---|
| Umidade | 35% | 0% a 100% |
| Temperatura | 30 °C | 10 °C a 40 °C |
| Passo de defuzzificação | 0,1 min | 0,1; 0,05; 0,01 min |

## Como executar

Use um servidor estático local, como a extensão **Live Server** do VS Code, e abra `index.html`. Não é necessário instalar dependências.

Alternativamente, com Python instalado, execute na pasta do projeto:

```bash
python -m http.server 8000
```

Acesse `http://localhost:8000/` para visualizar o projeto e `http://localhost:8000/tests/` para executar os testes.

O uso de um servidor estático local serve apenas para carregar os módulos ES durante o desenvolvimento. A aplicação final será estática e poderá ser publicada diretamente no GitHub Pages.

## Testes

A página `tests/index.html` verifica a estrutura existente, domínios e unidades, valores iniciais, passos numéricos, conjuntos e regras padrão. Também testa os cálculos de pertinência dos nove conjuntos, seus limites, rampas, platôs, casos degenerados e entradas inválidas. Os testes da fuzzificação verificam os seis graus de pertinência, inclusive zeros, limites dos domínios, exemplos do enunciado, preservação da precisão e repetibilidade.

Para os graus de pertinência, a tolerância de comparação utilizada é `0,000001`, conforme o enunciado. Os testes de avaliação das regras conferem todas as ativações da base padrão, os três casos de regra única, a simetria, a edição de consequentes, a integridade dos antecedentes, o determinismo e a rejeição de configurações inválidas. Os testes de implicação conferem a preservação das nove regras, seus consequentes originais, recortes com alturas 0, 0,25, 0,5, 0,75 e 1, regras inativas, casos de ativação única, alteração de consequentes, repetibilidade e entradas inválidas. Os testes de agregação verificam o máximo ponto a ponto, a sobreposição de consequentes iguais e diferentes, a simetria, os casos de regra única, as alterações dos consequentes, a ordem das regras, a repetibilidade e as configurações inválidas. Os testes do centroide conferem os tempos de referência das seções 6.2 a 6.4, as três precisões, os somatórios, o denominador nulo, o determinismo e a validação dos passos permitidos. Os testes de integração do simulador verificam as cinco operações, os resultados intermediários, a base padrão e editada, os tempos de referência, os três passos, os dados retornados, o determinismo e a rejeição de configurações inválidas. Os testes visuais e dos controles serão acrescentados quando a interface estiver implementada.

## Autores

- João Vinício Teles Rosal
- Benjamim Pessoa Vale Filho
- Gustavo Bastos Ribeiro Carvalho
