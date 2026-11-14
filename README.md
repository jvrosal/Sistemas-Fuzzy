# Simulador Fuzzy Mamdani — Irrigação de Jardim

**Raiz** é um simulador didático de irrigação baseado em inferência fuzzy Mamdani, desenvolvido para a disciplina de **Inteligência Artificial** da **Universidade Federal do Piauí (UFPI)**, período **2026.2**.

**[Código-fonte no GitHub](https://github.com/jvrosal/Sistemas-Fuzzy)** · **Aplicação no GitHub Pages:** endereço de publicação ainda não confirmado nesta revisão (ver [Repositório e publicação](#11-repositorio-e-publicacao)).

## Sumário

1. [Descrição](#1-descricao)
2. [Tecnologias](#2-tecnologias)
3. [Funcionalidades implementadas](#3-funcionalidades-implementadas)
4. [Modelo de inferência Mamdani](#4-modelo-de-inferencia-mamdani)
5. [Parâmetros](#5-parametros)
6. [Estrutura do projeto](#6-estrutura-do-projeto)
7. [Como executar](#7-como-executar)
8. [Como utilizar](#8-como-utilizar)
9. [Testes e validação](#9-testes-e-validacao)
10. [Situação atual](#10-situacao-atual)
11. [Repositório e publicação](#11-repositorio-e-publicacao)
12. [Autores](#12-autores)

## 1. Descrição

O simulador recomenda o **tempo de irrigação de um jardim**, em minutos, a partir de duas entradas:

- **Umidade do solo (U):** 0% a 100%.
- **Temperatura ambiente (T):** 10 °C a 40 °C.

A saída é o **tempo de irrigação (z)**, no intervalo de **0 a 30 minutos**. O sistema representa condições linguísticas por conjuntos fuzzy, aplica nove regras e calcula uma resposta numérica por centroide. É um modelo didático: não controla equipamentos, não lê sensores e não simula a dinâmica da água no solo.

O usuário pode editar somente os consequentes das regras, ajustar a precisão numérica e acompanhar as cinco operações de inferência com tabelas, explicações e gráficos. **Graus de pertinência indicam compatibilidade com termos linguísticos, não probabilidades; o tempo calculado não resulta de aprendizado de máquina.**

## 2. Tecnologias

| Tecnologia | Finalidade |
|---|---|
| HTML5 | Estrutura e controles da aplicação |
| CSS3 | Aparência e layout responsivo |
| JavaScript (módulos ES) | Modelo fuzzy, gerenciamento de estado e interatividade |
| SVG nativo | Gráficos dos conjuntos, recortes, agregação e centroide |
| GitHub Pages | Hospedagem estática da aplicação |

Não são utilizados frameworks nem bibliotecas externas de inferência fuzzy, inteligência artificial ou gráficos. As operações Mamdani foram implementadas diretamente em JavaScript. A aplicação funciona no navegador, **sem servidor de aplicação**; para desenvolvimento local, utiliza-se um servidor estático para carregar os módulos ES.

## 3. Funcionalidades implementadas

- Entradas de umidade e temperatura por campo numérico e controle deslizante, com valores padrão.
- Validação de campos vazios, valores não numéricos ou não finitos e entradas fora dos intervalos, **sem corrigir silenciosamente** os dados.
- Matriz 3 × 3 das nove regras, com antecedentes fixos e consequentes editáveis: **curto**, **médio** e **longo**.
- Escolha do passo de defuzzificação: **0,1**, **0,05** ou **0,01** minuto.
- **Calcular irrigação:** mostra os resultados das cinco operações de uma vez.
- **Avançar etapa:** revela progressivamente fuzzificação, avaliação, implicação, agregação e defuzzificação; após a quinta etapa, permite **Rever do início**.
- **Restaurar padrão:** recupera entradas, nove consequentes e passo originais e limpa resultados anteriores.
- Invalidação do resultado e reinício da navegação quando uma configuração é alterada.
- Gráficos SVG dos conjuntos de entrada com valores marcados, regras ativadas, recorte por regra selecionada, área agregada e posição do centroide.
- Apresentação de todos os graus de pertinência, inclusive os iguais a zero, e do tempo final com duas casas decimais.

A interface utiliza o mesmo motor matemático para o cálculo direto e a apresentação progressiva; não existem dois algoritmos de inferência diferentes.

## 4. Modelo de inferência Mamdani

### 4.1. Conjuntos e funções de pertinência

Os nove conjuntos são **fixos** e definidos por quatro pontos `(a, b, c, d)`, com `a ≤ b ≤ c ≤ d`:

| Variável | Conjunto | Pontos (a, b, c, d) |
|---|---|---|
| Umidade (%) | Seco | (0, 0, 20, 50) |
| Umidade (%) | Intermediário | (20, 50, 50, 80) |
| Umidade (%) | Úmido | (50, 80, 100, 100) |
| Temperatura (°C) | Baixa | (10, 10, 15, 25) |
| Temperatura (°C) | Média | (15, 25, 25, 35) |
| Temperatura (°C) | Alta | (25, 35, 40, 40) |
| Irrigação (min) | Curto | (0, 0, 0, 15) |
| Irrigação (min) | Médio | (0, 15, 15, 30) |
| Irrigação (min) | Longo | (15, 30, 30, 30) |

A pertinência `μ(x)` varia de 0 a 1. É calculada por partes:

```text
μ(x) = 1,                 se b ≤ x ≤ c
μ(x) = (x − a)/(b − a),   se a ≤ x < b
μ(x) = (d − x)/(d − c),   se c < x ≤ d
μ(x) = 0,                 fora de [a, d]
```

O trecho de pertinência 1 é avaliado antes das rampas. Quando `a = b` ou `c = d`, a respectiva rampa é vazia, evitando divisão por zero. O modelo aceita triângulos (`b = c`), trapézios e conjuntos nas extremidades. Não há arredondamento intermediário. A implementação fica em `calculateMembership()` e `fuzzifyInputs()`, no arquivo `js/membership.js`.

### 4.2. Base padrão de regras

Todas as regras têm dois antecedentes ligados por **E**. Os antecedentes e os identificadores são fixos; a interface permite modificar somente o consequente.

| Regra | Umidade | Temperatura | Consequente |
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

`js/constants.js` mantém os conjuntos e regras padrão imutáveis. `validateRules()`, em `js/inference.js`, exige nove regras válidas, antecedentes originais e consequentes permitidos.

### 4.3. As cinco operações

1. **Fuzzificação:** `fuzzifyInputs(U, T)` calcula os três graus de umidade e os três de temperatura, inclusive zeros. Uma entrada fora do domínio é rejeitada.
2. **Avaliação das regras:** `evaluateRules()` aplica o operador **mínimo** aos dois antecedentes de cada regra: `h(r) = min(μumidade(U), μtemperatura(T))`. Todas as nove regras são preservadas, mesmo quando `h(r) = 0`.
3. **Implicação:** `applyImplication()` mantém o consequente original e sua altura de corte. `getImpliedMembership()` avalia cada recorte: `μr(z) = min(h(r), μconsequente(z))`.
4. **Agregação:** `aggregateImplications()` combina as nove saídas recortadas usando o **máximo**: `μagregada(z) = max(μR1(z), …, μR9(z))`. Não soma áreas sobrepostas nem seleciona apenas a regra mais ativada. `getAggregatedMembership()` consulta a agregação em qualquer ponto.
5. **Defuzzificação:** `calculateCentroid()` calcula o tempo recomendado pela aproximação numérica do **centroide por pontos médios**, sem substituir o centroide por médias de centros dos conjuntos.

Para o domínio de saída de 0 a 30 minutos, com passo `Δz`:

```text
N    = 30 / Δz
z(k) = (k + 0,5) × Δz,  k = 0, …, N − 1
z*   = Σ[z(k) × μagregada(z(k))] / Σ[μagregada(z(k))]
```

O fator `Δz` se cancela no quociente. A precisão interna é mantida e o tempo é arredondado somente para exibição. Se o denominador for zero, o retorno informa saída agregada inválida (`valid: false`, `time: null`), nunca tempo zero ou `NaN` como recomendação.

### 4.4. Integração matemática

`runSimulation(configuration)`, em `js/simulator.js`, executa as cinco operações e retorna `configuration`, `fuzzification`, `evaluation`, `implication`, `aggregation`, `defuzzification` e `stages`. O campo `stages` permite à interface mostrar os resultados por operação sem recalcular o motor.

```js
import { runSimulation } from './js/simulator.js';

const result = runSimulation(); // U = 35%, T = 30 °C, Δz = 0,1
console.log(result.defuzzification.time.toFixed(2)); // 16.79
```

Para simular alterações de regras sem modificar a base padrão:

```js
import { DEFAULT_CONFIG, DEFAULT_RULES } from './js/constants.js';
import { runSimulation } from './js/simulator.js';

const rules = DEFAULT_RULES.map((r) => ({ ...r, consequent: 'curto' }));
const result = runSimulation({ ...DEFAULT_CONFIG, humidity: 50, temperature: 25, rules });
console.log(result.defuzzification.time.toFixed(2)); // 5.00
```

O motor rejeita configurações incompletas, valores fora dos domínios, passo inválido, alterações de antecedentes e regras incompletas. As configurações de entrada e as constantes originais não são modificadas.

## 5. Parâmetros

| Parâmetro | Valor inicial | Valores permitidos | Controle |
|---|---|---|---|
| Umidade do solo (U) | 35% | 0% a 100% | Numérico e deslizante |
| Temperatura (T) | 30 °C | 10 °C a 40 °C | Numérico e deslizante |
| Consequentes R1–R9 | Base da seção 4.2 | Curto, médio ou longo | Nove seletores |
| Passo de defuzzificação (Δz) | 0,1 min | 0,1; 0,05; 0,01 min | Seletor de precisão |
| Tempo de irrigação (z) | Calculado | 0 a 30 min | Resultado, não editável |

Os passos correspondem a **300**, **600** e **3.000** pontos médios, respectivamente. Um passo menor aumenta o número de amostras e melhora a aproximação numérica, mas não altera as regras ou as funções de pertinência.

## 6. Estrutura do projeto

```text
Sistemas-Fuzzy/
├── index.html
├── README.md
├── css/
│   └── style.css
├── js/
│   ├── app.js
│   ├── constants.js
│   ├── membership.js
│   ├── inference.js
│   ├── defuzzification.js
│   ├── simulator.js
│   ├── state.js
│   ├── charts.js
│   └── ui.js
└── tests/
    ├── index.html
    └── tests.js
```

| Arquivo | Responsabilidade |
|---|---|
| `index.html`, `css/style.css` | Página e estilos responsivos |
| `js/app.js` | Inicialização da aplicação |
| `js/constants.js` | Domínios, conjuntos, regras padrão e opções de precisão |
| `js/membership.js` | Pertinência e fuzzificação |
| `js/inference.js` | Ativação, implicação e agregação |
| `js/defuzzification.js` | Centroide numérico |
| `js/simulator.js` | Execução integrada das cinco operações |
| `js/state.js` | Validação, edição de parâmetros, cálculo, navegação e restauração |
| `js/charts.js` | Gráficos SVG das entradas, implicação, agregação e centroide |
| `js/ui.js` | Montagem dos controles e apresentação das operações |
| `tests/index.html`, `tests/tests.js` | Página e suíte existente de testes do motor |

A interface chama `runSimulation()` por meio do estado; o motor matemático permanece independente do DOM. Os gráficos utilizam os resultados da inferência, sem alterar os cálculos.

## 7. Como executar

### 7.1. Clonar e iniciar localmente

É necessário um navegador moderno e um servidor HTTP **estático** local, pois os arquivos utilizam módulos ES. **Não abra `index.html` diretamente por `file://`.**

```bash
git clone https://github.com/jvrosal/Sistemas-Fuzzy.git
cd Sistemas-Fuzzy
python -m http.server 8000
```

No Windows, se `python` não estiver disponível, utilize:

```bash
py -m http.server 8000
```

Em seguida, acesse:

- **Aplicação:** http://localhost:8000/
- **Suíte de testes:** http://localhost:8000/tests/

Como alternativa, abra a pasta no VS Code e inicie um servidor estático pela extensão **Live Server**. **Não é necessário instalar dependências, executar `npm install` nem iniciar um back-end.**

### 7.2. Execução on-line

O projeto é compatível com GitHub Pages a partir de `main` e `/(root)`. O endereço público deve ser obtido em **Settings → Pages → Visit site** e verificado antes da entrega. Veja a [seção 11](#11-repositorio-e-publicacao) para o estado da publicação.

## 8. Como utilizar

1. Abra a aplicação e informe **umidade** e **temperatura** nos campos ou controles deslizantes.
2. Confira a matriz 3 × 3. Se desejar, altere os consequentes das nove regras, mantendo os antecedentes fixos.
3. Escolha a precisão do centroide: `0,1`, `0,05` ou `0,01` minuto.
4. Clique em **Calcular irrigação** para apresentar todas as operações, ou em **Avançar etapa** para revelá-las uma a uma.
5. Consulte os graus de pertinência, a ativação das nove regras, os recortes, a região agregada e a linha do centroide nos gráficos.
6. Na implicação, selecione uma regra para comparar o conjunto de saída original ao recorte produzido, inclusive para regras inativas.
7. Após a quinta etapa, utilize **Rever do início** para repetir a apresentação sem alterar o resultado.
8. Clique em **Restaurar padrão** para voltar a U = 35%, T = 30 °C, Δz = 0,1 e à base original, limpando o cálculo anterior.

**Exemplo:** com U = 35%, T = 30 °C, base padrão e Δz = 0,1, as regras R2, R3, R5 e R6 são ativadas em 0,5. O tempo calculado é aproximadamente **16,785683 minutos**, exibido como **16,79 minutos**.

Os gráficos mostram os três conjuntos de cada entrada, valores marcados, graus de pertinência e as saídas intermediárias. A última visualização contém a área agregada preenchida e a posição do centroide. Entradas inválidas impedem a execução; alterações nas configurações descartam os resultados antigos.

## 9. Testes e validação

### 9.1. Como executar e interpretar os testes

Inicie o servidor estático conforme a [seção 7](#7-como-executar) e abra **http://localhost:8000/tests/**. A página `tests/index.html` carrega `tests/tests.js` e apresenta o resultado individual de cada verificação e um resumo com a quantidade aprovada.

**A suíte do repositório é executada no navegador.** Não existe `package.json` nem comando `npm test` configurado neste projeto. Em auditoria separada, a mesma suíte foi executada com Node.js e DOM simulado, com **418 de 418 verificações aprovadas**. A execução em Node.js foi um procedimento de auditoria, não um comando oficial disponível no repositório.

A documentação abaixo segue as **seções 6.1 a 6.5 do enunciado**. Em cada caso, informa configuração, resultado obtido, referência e conclusão. Salvo quando indicado, a base é a **R1–R9 padrão** e o passo é **Δz = 0,1 minuto**. As tolerâncias do enunciado são **0,000001** para pertinências e ativações e **0,01 minuto** para tempos.

### 9.2. Pertinências e extremos 

**Configuração:** conjuntos fixos, regras R1–R9 padrão, Δz = 0,1. A entrada não avaliada permanece no padrão (U = 35% ou T = 30 °C); os graus abaixo dependem apenas da variável avaliada.

| Entrada | Graus obtidos (na ordem dos conjuntos) | Referência | Conclusão |
|---|---|---|---|
| U = 35% | (seco 0,5; intermediário 0,5; úmido 0) | (0,5; 0,5; 0) | Aprovado |
| T = 30 °C | (baixa 0; média 0,5; alta 0,5) | (0; 0,5; 0,5) | Aprovado |
| U = 0% | (1; 0; 0) | (1; 0; 0) | Aprovado |
| U = 100% | (0; 0; 1) | (0; 0; 1) | Aprovado |
| T = 10 °C | (1; 0; 0) | (1; 0; 0) | Aprovado |
| T = 40 °C | (0; 0; 1) | (0; 0; 1) | Aprovado |

**Conclusão:** os graus coincidem com as referências. Os casos nas extremidades não provocam divisão por zero, e pertinências nulas não são omitidas.

### 9.3. Ativação de regra única

**Configuração:** base padrão, Δz = 0,1 (300 pontos médios).

| U | T | Regra ativada | Saída agregada | Tempo obtido | Referência | Conclusão |
|---:|---:|---|---|---:|---:|---|
| 20% | 35 °C | R3, h = 1 | Longo completo | 24,999889 min | ≈ 25,00 min | Aprovado |
| 50% | 25 °C | R5, h = 1 | Médio completo | 15,000000 min | 15,00 min | Aprovado |
| 80% | 25 °C | R8, h = 1 | Curto completo | 5,000111 min | ≈ 5,00 min | Aprovado |

**Conclusão:** cada situação ativa uma única regra e recupera o conjunto de saída completo. Os valores de aproximadamente 5 e 25 minutos vêm do **centroide dos triângulos**, não de seus picos; solo úmido não implica automaticamente tempo zero neste modelo.

### 9.4. Sobreposição de regras 

**Configuração:** U = 35%, T = 30 °C; base padrão; Δz = 0,1 (300 pontos médios).

**Fuzzificação obtida:** umidade = `(0,5; 0,5; 0)`; temperatura = `(0; 0,5; 0,5)`.

| Regra | Consequente | Ativação h(r) | Resultado |
|---|---|---:|---|
| R1 | Médio | 0 | Inativa |
| R2 | Longo | 0,5 | Recorte longo em 0,5 |
| R3 | Longo | 0,5 | Recorte longo em 0,5 |
| R4 | Curto | 0 | Inativa |
| R5 | Médio | 0,5 | Recorte médio em 0,5 |
| R6 | Longo | 0,5 | Recorte longo em 0,5 |
| R7 | Curto | 0 | Inativa |
| R8 | Curto | 0 | Inativa |
| R9 | Curto | 0 | Inativa |

Os recortes são combinados pelo **máximo**. As três regras com consequente longo **não somam** suas alturas. A função agregada obtida é:

```text
μagregada(z) = z/15,  para 0 ≤ z ≤ 7,5
μagregada(z) = 0,5,   para 7,5 < z ≤ 30
```

| z (min) | Agregação obtida μ(z) | Referência | Conclusão |
|---:|---:|---:|---|
| 0 | 0 | 0 | Aprovado |
| 3 | 0,2 | 0,2 | Aprovado |
| 7,5 | 0,5 | 0,5 | Aprovado |
| 15 | 0,5 | 0,5 | Aprovado |
| 30 | 0,5 | 0,5 | Aprovado |

**Resultado obtido:** centroide numérico de **16,785682540 min**; referência numérica de aproximadamente **16,785683 min** (centroide contínuo ≈ 16,785714 min). Exibição: **16,79 min**.

**Conclusão:** aprovado para fuzzificação, ativações, implicação por mínimo, agregação por máximo e centroide. A sobreposição não produz soma indevida de áreas ou alturas.

### 9.5. Simetria, edição de regras e precisão 

**Teste de simetria — base padrão, Δz = 0,1:**

| U | T | Regras ativadas | Região agregada | Centroide obtido | Referência | Conclusão |
|---:|---:|---|---|---:|---:|---|
| 35% | 20 °C | R1, R2, R4, R5; h = 0,5 | μ(z) = 0,5 em [0, 30] | 15,000000 min | 15,00 min | Aprovado |

Os três conjuntos de saída são recortados em 0,5, e a união por máximo gera uma região constante e simétrica.

**Teste de alteração das regras e restauração — Δz = 0,1:**

| Ação e configuração | Resultado obtido | Referência | Conclusão |
|---|---|---|---|
| Alterar todos os consequentes para curto; U = 50%, T = 25 °C | 5,000111 min | ≈ 5,00 min | Aprovado |
| Acionar **Restaurar padrão** | U = 35%, T = 30 °C, passo 0,1 e regras originais; resultado limpo | Estado inicial recuperado | Aprovado |
| Calcular novamente após restaurar | 16,785683 min (exibição 16,79) | ≈ 16,79 min | Aprovado |

**Teste de precisão — U = 35%, T = 30 °C, base padrão:**

| Δz (min) | Amostras | Centroide obtido (min) | Referência (min) | Erro para centroide contínuo (aprox.) | Conclusão |
|---:|---:|---:|---:|---:|---|
| 0,1 | 300 | 16,785682540 | 16,785683 | 0,000031746 | Aprovado |
| 0,05 | 600 | 16,785706349 | 16,785706 | 0,000007937 | Aprovado |
| 0,01 | 3.000 | 16,785713968 | 16,785714 | 0,000000317 | Aprovado |

**Conclusão:** os resultados convergem para o centroide contínuo de aproximadamente **16,785714286 min** conforme o passo diminui. A precisão interna melhora, mas o valor mostrado com duas casas decimais continua **16,79 min** em todos os três casos. Os antecedentes e conjuntos permanecem inalterados.

### 9.6. Interface e determinismo 

**Configuração de entradas inválidas:** regras padrão, Δz = 0,1; a variável não alterada permanece no valor inicial.

| Entrada testada | Resultado obtido | Conclusão |
|---|---|---|
| U = −1% ou 101% | Campo inválido; cálculo bloqueado, sem ajuste para o limite | Aprovado |
| T = 9 °C ou 41 °C | Campo inválido; cálculo bloqueado, sem ajuste para o limite | Aprovado |
| U ou T vazia | Campo obrigatório; cálculo bloqueado | Aprovado |
| U = `abc` ou T = `xyz` | Valor não numérico; cálculo bloqueado | Aprovado |
| U = 0%, T = 10 °C | Limites inferiores aceitos | Aprovado |
| U = 100%, T = 40 °C | Limites superiores aceitos | Aprovado |

**Determinismo — U = 35%, T = 30 °C, regras padrão, Δz = 0,1:**

| Verificação | Resultado obtido | Conclusão |
|---|---|---|
| Repetir a mesma configuração | Graus, ativações, agregação e centroide iguais | Aprovado |
| Calcular diretamente | Cinco operações disponíveis; saída de 16,79 min | Aprovado |
| Avançar pelas cinco operações | Mesma saída numérica, na ordem correta | Aprovado |
| Rever do início | Retorna à primeira visualização sem alterar o cálculo | Aprovado |
| Editar umidade, consequente ou passo | Resultado anterior descartado e apresentação reiniciada | Aprovado |
| Apenas mudar o gráfico apresentado | O gráfico utiliza resultados do motor, sem alterá-los | Conforme à arquitetura; cobertura automatizada de renderização ainda pendente |

**Conclusão:** as entradas inválidas foram bloqueadas, as configurações válidas tiveram resultados determinísticos e as duas modalidades de navegação apresentaram a mesma saída. A validação separada dos gráficos e controles não deve ser confundida com a suíte permanente do repositório.

### 9.7. Resumo e limites da verificação

| Evidência | Resultado registrado | Origem |
|---|---|---|
| Suíte matemática existente (`tests/tests.js`) | **418/418 aprovados** | Auditoria da suíte em Node.js com DOM simulado |
| Verificações adicionais de estados e cenários | **19/19 aprovadas** | Auditoria separada dos módulos |
| Verificações de interface | **65/65 aprovadas** | Auditoria anterior em Chromium |

## 10. Situação atual

**Implementado:** modelo fuzzy completo, nove regras configuráveis pelos consequentes, validação de entradas, cálculo direto e progressivo, restauração e visualizações SVG. A suíte matemática existente passou nas verificações registradas na seção 9.

## 11. Repositório e publicação

- **Repositório público:** [github.com/jvrosal/Sistemas-Fuzzy](https://github.com/jvrosal/Sistemas-Fuzzy)
- **Aplicação (GitHub Pages):** [https://jvrosal.github.io/Sistemas-Fuzzy/](https://jvrosal.github.io/Sistemas-Fuzzy/)

O GitHub Pages deve publicar a branch que contém a versão final, com `index.html` na pasta `/(root)`. Não é necessário contratar domínio próprio. A aplicação publicada deve funcionar **sem login nem instalação** e oferecer um link visível ao repositório — disponível na interface pelo controle **Código no GitHub**.

**Atenção:** o repositório público, isoladamente, não substitui o endereço da aplicação exigido no enunciado.

## 12. Autores

- **João Vinício Teles Rosal**
- **Benjamim Pessoa Vale Filho**
- **Gustavo Bastos Ribeiro Carvalho**

**Universidade Federal do Piauí — UFPI**  
**Disciplina:** Inteligência Artificial  
**Período:** 2026.2
