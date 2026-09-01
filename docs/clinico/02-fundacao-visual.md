# 02 · Fundação visual do módulo clínico

> Definir a linguagem visual do produto para a clínica antes de desenhar tela nenhuma:
> densidade, tipografia de dado clínico e os componentes que vão se repetir em todo o módulo.

## Por que existe

O app do responsável é emocional e espaçado; o sistema da clínica é operacional e denso. A
recepção olha a agenda o dia inteiro e o vet preenche prontuário entre consultas. Usar a mesma
régua nos dois produz uma tela bonita que ninguém consegue operar.

## Pronto quando

Existe uma página de referência com todos os componentes base, nos quatro estados, revisada
por alguém que opera clínica de verdade.

---

## Estado atual (auditoria de código)

A fundação está **construída e em uso**. A página de referência existe em
[`src/pages/design/clinico.vue`](../../src/pages/design/clinico.vue) (819 linhas), com seletor
de estado, alternador de densidade, interruptor de escala de cinza, os três nomes extremos e
200 linhas para julgar cansaço.

### Já existe e atende

| O que o requisito pede | Onde está | Observação |
|---|---|---|
| Escala de densidade própria | `theme/clinic-tokens.css` | Três níveis (`compacta`/`media`/`confortavel`) em `:root[data-clinic-density]` |
| Tamanho mínimo de fonte para número | `--clinic-font-base: 0.8125rem` (13 px) | Comentado no token: "densidade de tela larga, não de dedo" |
| Altura de linha e espaçamento | `--clinic-row-height`, `--clinic-cell-padding-*` | 32/36/44 px conforme densidade |
| Alvo de clique separado do de toque | `--clinic-hit-target: 28px` | "alvo de mouse, não de toque" |
| Escala de zoom da grade | `:root[data-clinic-zoom]` | Independente da densidade — a agenda tem necessidade própria |
| Persistência da escolha | `useClinicPrefs.ts` | `localStorage` + atributo no `<html>`, para overlay teleportado do PrimeVue enxergar |
| Tabela densa | `ClinicDataTable.vue` | Numeral tabular, colunas que somem abaixo de 1024, seleção de linha |
| Formulário de duas colunas, rótulo à esquerda | `ClinicForm.vue` + `ClinicField.vue` | `colunas` configurável |
| Cabeçalho de paciente | `ClinicPatientHeader.vue` | Avatar, nome em até 2 linhas, peso, espécie/raça/**idade**/sexo/castração, responsável e telefone |
| Alertas sem clicar | `ClinicPatientHeader.vue` → `alertasOrdenados` | Risco primeiro; alergia aparece com o detalhe (princípio ativo) na própria ficha |
| Chip de alerta crítico | `ClinicAlertChip.vue` | Três severidades |
| **Valor fora da faixa sem depender de cor** | `ClinicRefValue.vue` + `domain/ranges.ts` | Seta de direção **mais** a palavra ("acima"/"abaixo") **mais** a faixa. Intensidade graduada por `desvioRelativo` |
| `não aferido` distinto de vazio | `types.ts` → `Measurement.naoAferido` | Traço para "ninguém preencheu", palavra para "decidiu não medir" |
| Status recalculado, nunca persistido | `domain/ranges.ts` → `statusDaMedicao` | Editar o peso não deixa leitura antiga marcada como "dentro" |
| Nomes extremos sem quebrar | `ClinicPatientHeader.vue` | "Ni", "Maximiliano Bartholomeu von Schnauzerhausen III", "Açaí Nhoque Çãpeçã" no dataset |
| Jornada de doze horas | `design/clinico.vue` → seção "cansaço" | 200 linhas + interruptor de escala de cinza |

O componente de valor fora da faixa merece registro: ele resolve a subtarefa por inteiro e com
o argumento certo — *"filete colorido é decoração barata: some em qualquer recorte e não
sobrevive à leitura por voz"*. Nada a fazer ali.

---

## Lacunas

### F1 · A tabela não tem ordenação

O requisito nomeia ordenação **duas vezes** ("tabela densa com ordenação"; "Tabela com
ordenação, seleção e ação por linha"). Busca por `ordena|sort` em `features/clinico`: nenhuma
ocorrência em componente de tabela. `ColunaTabela` não tem campo de ordenação, o cabeçalho não
é clicável e nenhuma tela do módulo ordena nada.

É a lacuna mais cara do requisito: a tabela "carrega a maior parte das telas do módulo", e uma
lista de 200 pacientes sem ordenação obriga a usar a busca para tudo.

Entregar: ordenação por coluna declarada em `ColunaTabela`, indicador de direção no cabeçalho
(seta **mais** `aria-sort`), e ordenação estável para que reordenar não embaralhe empates.

### F2 · Ação por linha não é API, é gambiarra de slot

Hoje quem precisa de ação por linha declara uma coluna `acoes` e preenche o slot
`celula-acoes` na mão — é o que `fila.vue` faz. Funciona, mas cada tela reinventa largura,
alinhamento, comportamento no hover e o `@click.stop` que impede a ação de disparar a seleção
da linha. O requisito trata "ação por linha" como capacidade da tabela.

Entregar: contrato de ações por linha na `ClinicDataTable`, com o `stopPropagation` resolvido
num lugar só.

### F3 · A tabela não tem o quarto estado

`ClinicDataTable` cobre carregando, erro e vazio. **Somente leitura não existe** nela —
`ClinicForm` tem (`somenteLeitura` + `motivoSomenteLeitura`), a tabela não. O requisito pede
"os quatro estados de **cada** componente".

Entregar: estado somente-leitura na tabela — sem seleção, sem ações, com o motivo declarado.

### F4 · Os quatro estados moram na página de referência, não nos componentes

Esta é a lacuna estrutural, e a que mais custa depois.

Em `design/clinico.vue`, o esqueleto de carregamento, a faixa de erro e o vazio de
`ClinicPatientHeader`, `ClinicAlertChip` e `ClinicRefValue` são **marcação da própria página**,
não dos componentes. `ClinicPatientHeader` é `v-if="pet"`: sem paciente, ele não renderiza
nada — nem esqueleto, nem vazio.

Consequência: a página prova que os estados foram *desenhados*, mas nenhuma tela real os herda.
Cada consumidor reimplementa os três, e eles divergem — que é exatamente o que a fundação
existe para evitar.

Entregar: os estados dentro dos componentes, com a página de referência passando a apenas
acioná-los.

### F5 · "Somente leitura" não é um dos eixos da página

O seletor da página tem quatro valores: `carregando`, `erro`, `vazio`, `pronto`. Os quatro do
requisito são `carregando`, `vazio`, `erro`, **`somente leitura`**. Hoje somente-leitura entra
de carona no eixo errado — `design/clinico.vue:345` liga `:somente-leitura="estado === 'vazio'"`,
e só no formulário.

Entregar: somente-leitura como quinto valor do seletor (ou eixo próprio), aplicado a todos os
componentes que o admitem.

### F6 · Não existe alerta de "medicação contínua"

A subtarefa do cabeçalho nomeia os três alertas que o vet precisa ver sem clicar: **alergia,
medicação contínua, comorbidade**. O enum `PetAlertKind` tem `alergia` e `cronico`
(≈ comorbidade), mas **não tem medicação contínua** — e é o que decide interação
medicamentosa na hora de prescrever.

Entregar: `medicacao-continua` no `PetAlertKind`, traduzido nos quatro idiomas, presente no
dataset e cruzado com o bulário como já se faz com alergia.

### F7 · Falta a comparação lado a lado com a densidade do app do responsável

A subtarefa de tokens pede explicitamente: *"Comparar lado a lado com a densidade do app do
tutor, para a diferença ser deliberada e não acidental."* A página de referência tem uma seção
de tokens, mas nenhuma comparação — a diferença existe no código e não está demonstrada em
lugar nenhum.

Entregar: bloco na página de referência com o mesmo conteúdo nas duas réguas, lado a lado, e
os números (fonte, altura de linha, espaçamento) explícitos em ambas.

### F8 · A página de referência não é alcançável por quem precisa revisá-la

O "pronto quando" exige revisão **por alguém que opera clínica de verdade**. A página existe
em `/design/clinico`, mas não está em menu nenhum (`useAppNavigation` não a lista): só chega lá
quem souber a URL. Além disso, alguns textos da página estão fixos em português
("Nenhum alerta neste paciente", "Exame físico ainda não preenchido") num módulo com quatro
idiomas.

Entregar: entrada de navegação para a página (ao menos em ambiente de demonstração) e os textos
soltos traduzidos.

---

## Plano de execução

### Bloco A — A tabela cumpre o que o requisito pede ✅

- [x] **F1** Ordenação por coluna, com indicador e `aria-sort` — ciclo de três (direção,
      inversa, sem ordenação), estável no empate, vazio sempre no fim, texto por localidade.
      Regra em `domain/table-sort.ts`, coberta por 10 testes.
- [x] **F2** Ação por linha como contrato da tabela — `AcaoDeLinha`, com o `stopPropagation`
      resolvido num lugar só. Aplicado na fila de espera, que era quem improvisava.
- [x] **F3** Estado somente leitura na tabela — sem seleção e sem ações, com o motivo
      declarado; leitura e ordenação continuam valendo.

### Bloco B — Os estados passam a ser dos componentes

- [ ] **F4** Carregando, vazio e erro dentro de `ClinicPatientHeader`, `ClinicAlertChip` e `ClinicRefValue`
- [ ] **F5** Somente leitura como eixo próprio da página de referência

### Bloco C — O cabeçalho mostra o que decide conduta

- [ ] **F6** Alerta de medicação contínua no domínio, no dataset e no cruzamento com o bulário

### Bloco D — A página de referência fica revisável

- [ ] **F7** Comparação lado a lado com a densidade do app do responsável
- [ ] **F8** Página alcançável por navegação e sem texto fora do i18n

### Fora do código

- [ ] Revisão da página por alguém que opera clínica de verdade — **gate de processo**, não
      entregável de código. Nenhum item acima o substitui.

---

## Decisões

- **Cor nunca sozinha.** Vale para faixa de referência, alerta, tipo de atendimento e estado.
  O par mínimo é símbolo mais palavra; a cor é a terceira camada, não a primeira.
- **Status clínico é recalculado, nunca persistido.** Vale para faixa de referência e para
  qualquer julgamento derivado de valor mais regra.
- **Densidade é escolha de quem opera**, não do desenvolvedor: persiste por pessoa, e é global
  ao módulo — dois painéis com densidades diferentes seria defeito, não recurso.
- **A régua da clínica é deliberadamente diferente da do app do responsável.** Enquanto a
  comparação não estiver na página (F7), essa diferença é convicção, não evidência.
