# Módulo Clínica: evidência determinística (sem navegador)

Repositório `D:\PROJETOS\petjourney-admin`, ramo `develop` (commit `8faf265`), lido em 16/11/2026.
Nada foi editado no repositório. Tudo aqui saiu de leitura de código e do detector; nenhuma tela foi
aberta. Onde o número depende de permissão ou de dado da API, a contagem é o teto que o template
permite ("até N").

Escopo das telas reais: os componentes de `src/components/<área>/` montados pelas páginas de
`src/pages/(accounts)/clinica/**`, mais `src/features/clinico/components/meu-dia/MeuDiaFoco.vue` (o
Hoje). Os `*Demonstracao.vue` ficaram de fora.

Roteiros usados (todos no scratchpad, pasta `analise`): `agrega.mjs`, `classifica.mjs`,
`inventario.mjs`, `somas.mjs`, `sobreposicoes.mjs`, `campos.mjs`, `alcance.mjs`, `botoes.mjs`,
`titulos.mjs`, `vocabulario.mjs`, `pt.mjs` (resolve chave i18n em `src/locales/pt.json`, que é um
arquivo único com chaves aninhadas, não uma pasta `pt/`).

---

## Parte 1. Detector do Impeccable

### 1.1 Execução

- Versão `0.1.6` (`.claude/skills/impeccable/scripts/VERSION`). Comando:
  `.claude/skills/impeccable/scripts/impeccable detect --json <pasta>`, uma chamada por pasta.
- 21 pastas, 21 JSON em
  `C:\Users\darkb\AppData\Local\Temp\claude\478cf78b24a912ec\6f943fdd-c525-4bf3-9a49-d6f9880f96e5\scratchpad\analise\detector\`
  (um `.json` e um `.err` por pasta; todos os `.err` vazios). O comando carregou em todas.
- Código de saída: **2 só em `pedidos` e `layout`**, as duas pastas com achado de severidade
  `warning`. As outras 14 pastas com achados só `advisory` saíram com **0**, mesmo com JSON
  preenchido (121 achados). Quem ler só o código de saída vê "limpo" nelas.
- `src/components/meu-dia` não tem `.vue` (só `useMeuDiaDaClinica.ts`): 0 achados por falta de alvo.

### 1.2 Totais

**213 achados**: 211 `advisory`, 2 `warning`.

| Regra | Severidade | Categoria | Achados |
|---|---|---|---|
| `design-system-font-size` (tamanho de fonte fora do DESIGN.md) | advisory | quality | 110 |
| `design-system-radius` (raio fora do DESIGN.md) | advisory | quality | 71 |
| `design-system-color` (cor fora do DESIGN.md) | advisory | quality | 29 |
| `layout-transition` (transição em propriedade de layout) | warning | quality | 1 |
| `side-tab` (borda grossa de um lado só) | warning | slop | 1 |
| `codex-grid-background` (fundo quadriculado) | advisory | slop | 1 |

| Pasta | Achados | | Pasta | Achados |
|---|---|---|---|---|
| layout | 87 | | atendimento | 5 |
| ui | 38 | | pedidos | 5 |
| cadastro | 20 | | resumo | 4 |
| features/clinico/meu-dia | 17 | | fila | 3 |
| agendamentos | 12 | | bulario, faltas | 2 cada |
| internacao | 9 | | atividades, copias, tratamentos | 1 cada |
| importacao | 6 | | agenda, documentos, estoque, vacinas, meu-dia | 0 |

125 dos 213 (59%) estão em `layout` e `ui`, a moldura e as peças compartilhadas, não nas telas.

### 1.3 Os 15 arquivos com mais achados

| # | Arquivo | Achados |
|---|---|---|
| 1 | `src/components/layout/moldura-app.css` | 26 |
| 2 | `src/features/clinico/components/meu-dia/MeuDiaFoco.vue` | 17 |
| 3 | `src/components/layout/AppShell.vue` | 16 |
| 4 | `src/components/layout/ShellNavegacao.vue` | 14 |
| 5 | `src/components/ui/UiAbas.vue` | 13 |
| 6 | `src/components/ui/UiAbertura.vue` | 12 |
| 7 | `src/components/ui/UiPagina.vue` | 12 |
| 8 | `src/components/layout/ShellConta.vue` | 10 |
| 9 | `src/components/layout/ShellAvisos.vue` | 8 |
| 10 | `src/components/layout/ShellPendencia.vue` | 6 |
| 11 | `src/components/cadastro/LigarAoAppGaveta.vue` | 5 |
| 12 | `src/components/internacao/LeitoDoMapa.vue` | 5 |
| 13 | `src/components/agendamentos/GradeDoDia.vue` | 4 |
| 14 | `src/components/layout/ShellCriar.vue` | 4 |
| 15 | `src/components/resumo/ResumoDaClinica.vue` | 4 |

### 1.4 Exemplos das regras mais frequentes

| Regra | Valores mais comuns | Exemplos (arquivo:linha) |
|---|---|---|
| font-size | 15px ×30, 18px ×30, 16px ×16, 26px ×11, 20px ×7, 19px ×5 | `agendamentos/AgendamentoGaveta.vue:1091` (15px), `cadastro/FichaDoPaciente.vue:1040` (20px), `ui/UiPagina.vue:574` (26px), `internacao/InternacaoDaClinica.vue:413` (15.5px), `cadastro/LigarAoAppGaveta.vue:305` (40px) |
| radius | 10px ×17, 12px ×11, 14px ×10, 22px ×8, 13px ×8, 8px ×5, 18px ×4 | `layout/moldura-app.css:802` (22px), `agendamentos/GradeDoDia.vue:453` (8px), `cadastro/FichaDoPaciente.vue:1120` (14px), `layout/ShellPendencia.vue:271` (13px) |
| color | `rgb(0 0 0 / n%)` ×8, `#000` ×6, `#10302a` ×3, `#2c4741` ×3 | `ui/UiAbas.vue:119` (`#000`), `layout/ShellNavegacao.vue:463` (`#f0b77c`), `internacao/ChecklistDaInternacao.vue:227` (`#10302a`), `layout/AppShell.vue:647` (`#76938d`) |

### 1.5 Amostra aberta no código (18 achados)

| # | Achado | O que o código é | Veredito |
|---|---|---|---|
| 1 | `agendamentos/GradeDoDia.vue:413` codex-grid-background | `.gd__coluna`: as linhas de hora e de meia hora da grade da agenda desenhadas em `background-image` | **Falso-positivo**: régua de tempo funcional, não fundo decorativo |
| 2 | `pedidos/RespostaDoPedidoGaveta.vue:877` side-tab | `.rp__citacao`: citação do recado do responsável, fio de 3px em `--linha-suave` (neutro) | **Falso-positivo**: marca de citação em cor neutra, não cartão com acento colorido |
| 3 | `layout/AppShell.vue:920` layout-transition | `.palco__conteudo { transition: padding-inline-end 0.5s … }`: o conteúdo é empurrado quando a gaveta abre | **Verdadeiro**: anima layout por 500 ms a cada gaveta (o CLAUDE.md, Regra 4, põe o teto em 300 ms) |
| 4 | `atividades/AtividadesDaClinica.vue:484` font-size 16px | `.atividade__acao i` | **Falso-positivo**: tamanho de ícone (Phosphor é fonte) |
| 5 | `cadastro/PacientesLista.vue:435` 18px | `.cl__importacao > i` | **Falso-positivo**: ícone |
| 6 | `cadastro/FichaDoPaciente.vue:1134` 26px | `.fp__sem-acesso > i` | **Falso-positivo**: ícone do estado vazio |
| 7 | `resumo/ResumoDaClinica.vue:643` 16px | `.relatorio__intervalo i` | **Falso-positivo**: ícone |
| 8 | `importacao/ImportacaoArquivo.vue:795` 28px | `.arq__soltar-icone` | **Falso-positivo**: ícone |
| 9 | `cadastro/LigarAoAppGaveta.vue:156` e `:158` (15px, `#5f6670`) | CSS dentro de uma string: a folha HTML que vai para a impressora | **Falso-positivo**: não é a interface do portal |
| 10 | `cadastro/FichaDoPaciente.vue:1040` 20px | `.fp__nome`, o h2 "Dados do paciente" | **Verdadeiro**: texto fora da rampa do frontmatter |
| 11 | `cadastro/LigarAoAppGaveta.vue:305` 40px | `.la__digitos`, o código de ligação | **Verdadeiro**: texto fora da rampa (o maior da amostra) |
| 12 | `ui/UiPagina.vue:574` 26px | `.faixa__titulo`, o h1 de toda tela | **Falso-positivo de documentação**: é o título do design do app; a rampa do frontmatter (11/12/13/14/16,8/21,6 px) é anterior a ele |
| 13 | `ui/UiAbas.vue:119` `#000` | `mask-image: linear-gradient(to right, #000 …, transparent)` | **Falso-positivo**: máscara alfa, a cor não aparece |
| 14 | `internacao/ChecklistDaInternacao.vue:227` `#10302a` | `color: var(--pj-lugar-tinta, #10302a)` | **Falso-positivo**: reserva de `var()`; a cor está na prosa do `DESIGN.md` (linha 349) |
| 15 | `layout/ShellNavegacao.vue:463-469` 4 cores | `.mapa__selo--atencao` e `--risco`: fundo e tinta literais | **Verdadeiro**: cor literal fora dos tokens |
| 16 | `layout/moldura-app.css:802` raio 22px | `.ui-folha.ui-cartao`, a caixa de toda seção | **Falso-positivo**: igual ao token `--raio-painel: 22px` (`src/theme/trilha/trilha-tokens.css:84`) e à prosa do `DESIGN.md:457` |
| 17 | `cadastro/FichaDoPaciente.vue:1120` raio 14px | `.fp__faixa` | **Falso-positivo como "fora da escala"** (= `--raio-cartao-pequeno`); verdadeiro como "literal em vez de token" |
| 18 | `layout/AppShell.vue:647` `#76938d` | `.barra__pata`, fundo do ladrilho da marca | **Verdadeiro**: cor literal |

Na amostra: 13 falso-positivos, 5 verdadeiros.

### 1.6 Falso-positivo estimado nos 213 (classificação por seletor e propriedade)

| Regra | Total | Falso-positivo | Por quê | Resta |
|---|---|---|---|---|
| font-size | 110 | ~68 | 57 seletores de ícone achados por regra (`… i`, `__icone`, `::before`) + 10 conferidos à mão (`.criar`, `.barra__recolher`, `.conta__mais`, `.lm__desenho`…) + 1 folha de impressão | ~42 de texto, dos quais 21 são 15px ou 15,5px |
| radius | 71 | 39 | valor igual a um token do tema que o frontmatter não lista: 10px ×17 (`--raio-controle`), 14px ×10, 22px ×8, 18px ×4 | 32 fora das duas escalas: 12px ×11, 13px ×8, 8px ×5, 3px ×3, 28px ×2, 9px ×2, 2px ×1 |
| color | 29 | 15 | 5 sombras em preto translúcido, 4 máscaras, 2 reservas de `var()`, 2 operandos de `color-mix`, 1 folha de impressão, 1 `#10302a` documentado em prosa | 14 literais |
| side-tab, codex-grid | 2 | 2 | ver amostra | 0 |
| layout-transition | 1 | 0 | | 1 |
| **Total** | **213** | **~124 (58%)** | | **~89** |

Causa comum dos falso-positivos: o detector lê só o frontmatter do `DESIGN.md` (`typography:` com 6
tamanhos, `rounded:` com 5 raios, `colors:` com 39 cores). O tema em uso tem outra escala de raio
(`trilha-tokens.css:80-85`: 6/10/14/18/22/999 px) e o design do app usa título 26 e linha 15/15,5,
descritos só na prosa e nos comentários.

### 1.7 O que o detector não diz

Nenhum dos 213 achados trata de layout, navegação, organização do conteúdo ou arquitetura da
informação. São 210 de consistência de token (tipo, raio, cor), 1 de movimento e 2 heurísticas de
aparência. Para o foco da análise, o detector contribui com um fato: a transição de 500 ms que
empurra a página a cada gaveta aberta (`AppShell.vue:920`).

---

## Parte 2. Inventário estático

### 2.1 Rotas, componente e tamanho

31 páginas em `src/pages/(accounts)/clinica/**`. Linhas por `wc -l` (script + template + style).
"Filhos" são os `.vue` importados direto pelo componente, fora `Ui*`, `PetAvatar` e demonstração;
gaveta = arquivo `*Gaveta.vue`.

| Rota | Componente da API | Linhas | Template | Filhos diretos | Soma com filhos | Templates somados |
|---|---|---|---|---|---|---|
| `/clinica/meu-dia` | `features/clinico/components/meu-dia/MeuDiaFoco.vue` | 1532 | 403 | 0 | 1532 | 403 |
| `/clinica/agenda` | `agendamentos/AgendaDaClinica.vue` | 1153 | 337 | 3 blocos + 2 gavetas | 4308 | 1313 |
| `/clinica/pedidos` | `pedidos/CaixaDePedidos.vue` | 514 | 168 | 2 gavetas | 1984 | 702 |
| `/clinica/fila` | `fila/FilaDeEspera.vue` | 564 | 204 | 3 gavetas/diálogo | 1581 | 569 |
| `/clinica/pacientes` | `cadastro/PacientesLista.vue` | 553 | 199 | 0 | 553 | 199 |
| `/clinica/correcoes` | `cadastro/CorrecoesLista.vue` | 257 | 90 | 0 | 257 | 90 |
| `/clinica/atendimentos` | `atendimento/AtendimentosDaClinica.vue` | 433 | 172 | 0 | 433 | 172 |
| `/clinica/bulario` | `bulario/BularioDaClinica.vue` | 613 | 214 | 1 bloco | 1015 | 317 |
| `/clinica/copias-do-prontuario` | `copias/CopiasDoProntuario.vue` | 292 | 101 | 2 gavetas | 1255 | 472 |
| `/clinica/historico-liberado` | a própria página (só demonstração) | 519 | 210 | 1 bloco + 3 gavetas | 2821 | 990 |
| **`/clinica/ficha/:petId`** | `cadastro/FichaDoPaciente.vue` | **1140** | **470** | **6 blocos + 7 gavetas** | **5290** | **2053** |
| `/clinica/paciente/novo` | `cadastro/PacienteNovo.vue` | 484 | 172 | 2 blocos | 1070 | 579 |
| `/clinica/paciente/importar` | `importacao/ImportacaoDaBase.vue` | 228 | 78 | 7 blocos (passos) | 3221 | 1356 |
| **`/clinica/atendimento/:encounterId`** | `atendimento/AtendimentoDaClinica.vue` | **999** | **353** | **9 blocos + 5 gavetas** | **5388** | **2211** |
| `/clinica/internacao` | `internacao/InternacaoDaClinica.vue` | 433 | 123 | 2 blocos + 1 gaveta | 1671 | 570 |
| **`/clinica/internacao/:internacaoId`** | `internacao/InternacaoDetalhe.vue` | 739 | 370 | 4 blocos + 5 gavetas | 3022 | 1226 |
| `/clinica/internacao/plantao` | `internacao/ChecklistDoPlantao.vue` | 250 | 78 | 1 bloco + 1 gaveta | 779 | 261 |
| `/clinica/internacao/boletins-pendentes` | `internacao/BoletinsPendentes.vue` | 222 | 64 | 1 gaveta | 422 | 146 |
| `/clinica/internacao/vagas` | `internacao/VagasDaInternacao.vue` | 97 | 35 | 0 | 97 | 35 |
| `/clinica/atividades` | `atividades/AtividadesDaClinica.vue` | 548 | 104 | 0 | 548 | 104 |
| `/clinica/faltas` | `faltas/FaltasDaClinica.vue` | 389 | 123 | 1 gaveta | 796 | 238 |
| `/clinica/retornos-pendentes` | `atendimento/RetornosPendentes.vue` | 454 | 134 | 1 bloco + 2 gavetas | 1259 | 424 |
| `/clinica/vacinas` | `vacinas/VacinasDaClinica.vue` | 350 | 132 | 0 | 350 | 132 |
| `/clinica/tratamentos` | `tratamentos/TratamentosDaClinica.vue` | 210 | 67 | 0 | 210 | 67 |
| `/clinica/estoque` | `estoque/EstoqueDaClinica.vue` | 81 | 23 | 4 blocos (as 4 abas) | 1657 | 668 |
| `/clinica/resumo` | `resumo/ResumoDaClinica.vue` | 861 | 275 | 3 blocos (gráficos) | 1694 | 338 |
| `/clinica/configuracao` | `agenda/ConfiguracaoDaAgenda.vue` | 121 | 23 | 6 blocos (as 6 abas) | 3037 | 1190 |
| `/clinica/paciente/:petId/{historico,resumo,tratamento,vacinas}` | 4 páginas próprias (379 a 902 linhas), sobre `features/clinico` | | | | 2872 a 4620 | |

As 4 rotas `/clinica/paciente/:petId/*` e `/clinica/historico-liberado` têm `integrada: false`
(`src/navegacao/rotas-dos-modulos.ts:175-179` e `:192-196`): só abrem na demonstração.

**Os 15 maiores `.vue` das pastas** (145 arquivos, 57.055 linhas; 37 com 500+ linhas, 11 com 800+):

| # | Arquivo | Linhas | script / template / style |
|---|---|---|---|
| 1 | `features/clinico/components/meu-dia/MeuDiaFoco.vue` | 1532 | 238 / 403 / 890 |
| 2 | `agendamentos/AgendamentoGaveta.vue` | 1244 | 627 / 431 / 185 |
| 3 | `agendamentos/AgendaDaClinica.vue` | 1153 | 691 / 337 / 124 |
| 4 | `cadastro/FichaDoPaciente.vue` | 1140 | 514 / 470 / 155 |
| 5 | `layout/AppShell.vue` | 1087 | 307 / 193 / 586 |
| 6 | `atendimento/AtendimentoDaClinica.vue` | 999 | 501 / 353 / 144 |
| 7 | `importacao/ImportacaoArquivo.vue` | 926 | 290 / 477 / 158 |
| 8 | `pedidos/RespostaDoPedidoGaveta.vue` | 882 | 413 / 282 / 186 |
| 9 | `agendamentos/MarcarGaveta.vue` | 871 | 371 / 329 / 170 |
| 10 | `ui/UiPagina.vue` | 870 | 208 / 232 / 429 |
| 11 | `resumo/ResumoDaClinica.vue` | 861 | 335 / 275 / 250 |
| 12 | `internacao/InternacaoDetalhe.vue` | 739 | 243 / 370 / 125 |
| 13 | `copias/CopiaGaveta.vue` | 735 | 361 / 267 / 106 |
| 14 | `atendimento/PrescricaoGaveta.vue` | 719 | 358 / 287 / 73 |
| 15 | `agenda/BloqueiosAba.vue` | 703 | 391 / 225 / 86 |

5 dos 15 são gavetas. A maior gaveta (`AgendamentoGaveta.vue`, 431 linhas de template) tem 5 modos
num arquivo só: ver, editar, mudar, cancelar, falta.

**Alcance por tela** (importações em cadeia; "primários" = `<Button>` sem `severity`, fora de gaveta,
contado no template, então inclui os condicionais e os de linha):

| Tela | Arquivos alcançados | Gavetas | `<h2>` | Botões primários (até) | Template somado |
|---|---|---|---|---|---|
| Ficha do paciente | 28 | **17** | 10 | 8 | 3482 |
| Atendimento | 23 | **14** | 9 | 8 | 3053 |
| Internação detalhe | 18 | **13** | 9 | 8 | 2075 |
| Configuração | 11 | 8 (+1 Dialog) | 6 | 6 | 2000 |
| Agenda | 9 | 2 (+2 Dialog) | 1 | 4 | 1673 |
| Estoque | 14 | 6 | 10 | 1 | 1328 |
| Internação mapa | 5 | 2 | 1 | 2 | 655 |
| Hoje | 1 | 0 | 3 | 3 | 402 |
| Pacientes | 1 | 0 | 0 | 1 | 198 |
| Vacinas | 1 | 0 | 0 | 0 | 131 |

### 2.2 Diálogo x gaveta

| Pasta | `<Dialog>` | `<Drawer>` cru | Gaveta (`<CadastroGaveta>`) | `ConfirmActionDialog` | `Popover` | `Menu` |
|---|---|---|---|---|---|---|
| agenda | 1 | 0 | 4 | 0 | 0 | 1 |
| agendamentos | 2 | 0 | 2 | 0 | 2 | 1 |
| atendimento | 0 | 0 | 10 | 0 | 0 | 1 |
| cadastro | 0 | 1 (a própria `CadastroGaveta.vue`) | 11 | 0 | 0 | 2 |
| copias | 0 | 0 | 2 | 0 | 0 | 0 |
| documentos | 0 | 0 | 5 | 0 | 0 | 0 |
| estoque | 0 | 0 | 6 | 0 | 0 | 0 |
| faltas | 0 | 0 | 1 | 0 | 0 | 0 |
| fila | 0 | 0 | 2 | 1 | 0 | 0 |
| importacao | 4 | 0 | 1 | 0 | 0 | 0 |
| internacao | 0 | 0 | 17 | 0 | 0 | 0 |
| pedidos | 0 | 0 | 2 | 0 | 0 | 0 |
| tratamentos | 0 | 0 | 1 | 0 | 0 | 0 |
| vacinas | 0 | 0 | 3 | 0 | 0 | 0 |
| layout | 0 | 1 (`ShellAvisos.vue:144`) | 0 | 1 (`ShellConta.vue:268`, "Sair da conta?") | 3 | 0 |
| atividades, bulario, meu-dia (as duas), resumo, ui | 0 | 0 | 0 | 0 | 0 | 0 |
| **Total** | **7** | **2** | **67** | **2** | **5** | **5** |

Fora da lista, usado pela Configuração: `src/components/catalogo` tem mais 3 gavetas (Medicamento,
Vacina, Item simples).

**Os 7 `<Dialog>`: todos são confirmação curta, nenhum tem campo de formulário.**

| Arquivo:linha | Título | Conteúdo |
|---|---|---|
| `agenda/BloqueiosAba.vue:580` | "Apagar bloqueio" / "Tirar um dia" | pergunta + Voltar / Apagar (danger) |
| `agendamentos/AgendaDaClinica.vue:946` | "Fechar o turno" | lista dos horários sem chegada + Voltar / Marcar as faltas |
| `agendamentos/AgendaDaClinica.vue:994` | "A clínica está fechada" | frase + Voltar / Mudar mesmo assim |
| `importacao/ImportacaoArquivo.vue:735` | "Este arquivo já foi importado" | confirmação |
| `importacao/ImportacaoDuvidas.vue:436` | "Descartar a importação" | confirmação |
| `importacao/ImportacaoFim.vue:425` | "Desfazer a importação" | confirmação |
| `importacao/ImportacaoResumo.vue:281` | "Descartar a importação" | confirmação |

Formulário longo em Dialog central: **zero**. Todo formulário mora em gaveta.

**Como a gaveta se comporta** (`src/components/cadastro/CadastroGaveta.vue:35-42`):
`:modal="false"`, `:dismissable="false"`, `:block-scroll="false"`, à direita, largura padrão 30rem.
A partir de 1280 px ela empurra a página (`useSidePanelOffset` + `AppShell.vue:912-920`, transição
de 0,5 s); abaixo disso passa por cima, sem véu, com a lista atrás ainda clicável
(`src/composables/useTelaLarga.ts`). A barra lateral tem 272 px aberta e 72 px recolhida
(`AppShell.vue:504` e `:519`). Com rem de 16 px, a 1280 px de janela e barra aberta, sobra para a
página: 528 px com gaveta de 30rem, 432 px com 36rem, 304 px com 44rem (antes das margens).

**Larguras em uso** (68 arquivos, contando o catálogo): 30rem ×34, 34rem ×17, 36rem ×11, 38rem ×3,
32rem ×1, 40rem ×1, 44rem ×1. Sete larguras diferentes.

**Gavetas com mais campos** (controles de formulário no template):

| Gaveta | Campos | Seções | Largura | Para quê |
|---|---|---|---|---|
| `catalogo/MedicamentoGaveta.vue` | 21 | 14 | 40rem | Novo/Editar medicamento |
| `atendimento/PrescricaoGaveta.vue` | 16 | 13 | 36rem | Prescrever |
| `cadastro/ClienteGaveta.vue` (campos em `ClienteCampos.vue`) | 16 | | 30rem | Editar o responsável |
| `catalogo/VacinaGaveta.vue` | 14 | 12 | 36rem | Nova/Editar vacina |
| `internacao/InternarGaveta.vue` | 13 | 11 | 36rem | Internar no leito |
| `internacao/PrescricaoNaInternacaoGaveta.vue` | 13 | 11 | 38rem | Prescrever na internação |
| `agenda/BloqueioGaveta.vue` | 12 | 9 | 30rem | Novo bloqueio |
| `vacinas/AplicarVacinaGaveta.vue` | 12 | 7 | 36rem | Aplicar vacina |
| `cadastro/PacienteGaveta.vue` (campos em `PacienteCampos.vue`) | 12 | | 30rem | Editar o paciente |
| `pedidos/ConfiguracaoOnlineGaveta.vue` | 11 | 6 | 34rem | Como a clínica recebe pedidos |
| `agendamentos/AgendamentoGaveta.vue` | 10 | 13 | 34rem | 5 modos: ver, editar, mudar, cancelar, marcar falta |
| `agendamentos/MarcarGaveta.vue` | 10 | 11 | 34rem | Marcar horário / Marcar retorno |
| `estoque/ReceberLoteGaveta.vue` | 10 | 9 | 36rem | Receber lote |

17 gavetas têm 8 campos ou mais; 9 têm 12 ou mais.

**Confirmar uma ação destrutiva tem 4 formas no módulo:**

| Forma | Onde | Quantas |
|---|---|---|
| `<Dialog>` central | bloqueio, fechar turno, importação | 7 |
| `ConfirmActionDialog` | `fila/FilaDeEspera.vue:484` ("Tirar {nome} da fila?") | 1 |
| Gaveta lateral curta (motivo e confirmação, até 2 campos) | Anular o ato, Anular o atendimento, Cancelar a receita, Anular documento, Anular (vacina), Inativar, Encerramento administrativo, Suspender {nome}, Desativar {nome}, Encerrar o vínculo, Estornar a baixa, Remover laudo | 12 |
| Confirmação na própria linha | `cadastro/FichaDoPaciente.vue:881-897` (Voltar / Remover em "Quem pode buscar") | 1 |

### 2.3 Abas

Não há `Tabs`, `TabList` nem `TabView` nas pastas. Há dois mecanismos:

- **Nível 1: abas do destino**, em `UiAbas`, na fileira do cabeçalho (`UiPagina.vue:256` e `:318`),
  definidas em `src/navegacao/espacos.ts:76-138` (RECEITA_DA_CLINICA). São `RouterLink`: cada aba é
  uma rota. Destino de uma aba só não mostra fileira (`UiPagina.vue:111-116`).
- **Nível 2 e 3: `SelectButton`** dentro da tela. O mesmo componente aparece 59 vezes em 45
  arquivos com quatro papéis: sub-aba que troca o conteúdo (5), filtro de lista (14), estado que
  grava ao clicar (1, a Gravidade da internação) e campo de formulário em gaveta (37 + 2 de
  preferência).

| Destino na barra | Abas do destino (nível 1) |
|---|---|
| Hoje | 1 (sem fileira) |
| Agenda | 3: Agenda · Pedidos · Fila de espera |
| Pacientes | 5 com a API: Pacientes · Correções · Atendimentos · Bulário · Cópias (a receita lista 6; "Histórico liberado" só abre na demonstração) |
| Internação | 1 (sem fileira) |
| Pendências | 6: Atividades · Faltas · Retornos · Vacinas · Tratamentos em casa · Estoque de vacinas |
| Relatórios | 1 (sem fileira) |
| Configuração | 1 no destino; a tela põe 6 abas próprias na mesma fileira (`abasDaTela`) |

| Tela | Nível 1 | Nível 2 (rótulos) | Nível 3 | Níveis | Vai para a URL |
|---|---|---|---|---|---|
| Hoje | | "De quem é o dia": Minha agenda · Clínica | | 1 | não |
| Agenda › Agenda | 3 | "Visão": Dia · Semana | no popover "Exibição": "Colunas" Por profissional · Por sala | 2 (+1 escondido) | `data`, `visao`, `por`, `horario` |
| Agenda › Pedidos | 3 | "Situação dos pedidos": Esperando resposta · Aceitos · Recusados · Encerrados | | 2 | `status` |
| Agenda › Fila de espera | 3 | "Quais entradas mostrar": Na fila · Não responderam | | 2 | não |
| Pacientes › Pacientes | 5 | "Situação": Ativos · Inativos | | 2 | não |
| Pacientes › Correções | 5 | Abertos · Resolvidos | | 2 | não |
| Pacientes › Atendimentos | 5 | Todos · Rascunhos · Finalizados · Anulados | | 2 | `status` |
| Pacientes › Bulário | 5 | | | 1 | `paciente` |
| Pacientes › Cópias | 5 | Abertos · Encerrados | | 2 | não |
| Pendências › Atividades | 6 | | | 1 | |
| Pendências › Faltas | 6 | "Quais mostrar": Reincidentes · A justificar · Todas | | 2 | `recorte` |
| Pendências › Retornos | 6 | "Quais retornos": Todos · Vencidos | | 2 | não |
| **Pendências › Vacinas** | 6 | Lista de chamada · Aplicadas | "Situação": Todas · Vencidas · Série aberta · A vencer, ou "Período": 7 · 30 · 92 dias | **3** | `aba`; o nível 3 não |
| Pendências › Tratamentos em casa | 6 | "Quais tratamentos": Pedem atenção · Todos | | 2 | `filtro` |
| **Pendências › Estoque de vacinas** | 6 | "Partes do estoque": Geladeira · Metas · Movimentos · Análise | Movimentos: Tudo · Entradas · Baixas; Análise: Últimos 3 · 6 · 12 meses | **3** | `aba`; o nível 3 não |
| Relatórios | | "Período" (`ClinicToggleGroup`) + 2 `Select` | | 1 | |
| Configuração | 6 próprias: Salas · Leitos · Tipos de atendimento · Bloqueios · Política · Catálogo da clínica | | | 1 | `aba` |
| Atendimento | sem fileira (rota de detalhe) | "Seções do atendimento": Anamnese · Exame físico · Diagnóstico · Conduta · Receita e documentos | | 1 | `secao` |
| Ficha do paciente | sem fileira | nenhuma: tudo empilhado | | 0 | |
| Internação detalhe | sem fileira | nenhuma: tudo empilhado | | 0 | |

Máximo: **3 níveis** (barra › aba do destino › sub-aba › filtro), em Vacinas e em Estoque de
vacinas, os dois dentro de Pendências. Contando o destino na barra lateral, são 4 escolhas até a
lista.

**O título (h1) não acompanha a aba.** `UiPagina` usa o nome do destino quando a tela não passa
`titulo`:

| Destino | Aba | h1 que a tela mostra |
|---|---|---|
| Agenda | Agenda | "Agenda" |
| | Pedidos | "Pedidos de horário" (`pedidos/CaixaDePedidos.vue`) |
| | Fila de espera | "Fila de espera" |
| Pacientes | Pacientes, Correções, Atendimentos, Bulário, Cópias | "Pacientes" nas cinco |
| Pendências | Atividades, Retornos, Vacinas, Tratamentos em casa | "Pendências" nas quatro |
| | Faltas | "Faltas" |
| | Estoque de vacinas | "Estoque de vacinas" |
| Configuração | | "Configuração da clínica" |

### 2.4 Ações por tela

Botões no nível da página (slot `#acoes` do `UiPagina`) e nos cabeçalhos de seção. Os de linha
ficaram de fora, salvo quando são primários.

| Tela | Cabeçalho da página | Outros controles no nível da página | Primários ao mesmo tempo | Marca |
|---|---|---|---|---|
| **Hoje** `MeuDiaFoco.vue` | sem slot de ações | seletor Minha agenda/Clínica; 3 números-link (Na recepção, Em consulta, Internados); no cartão: **Iniciar consulta** ou **Continuar atendimento**, link "Resumo em 30 s", anterior/próximo; "Ver na agenda" | 1 | |
| **Agenda** `AgendaDaClinica.vue:703-791` | Fechar o turno (n) [secundário, condicional] · **Marcar horário** | Dia anterior · [data] · Próximo dia · Hoje · Dia/Semana · Exibição | 1 | **8 controles** |
| **Pacientes** `PacientesLista.vue:227-236` | Importar planilha · **Cadastrar paciente** | busca, espécie, Ativos/Inativos; faixa "Ver a importação" | 1 | |
| **Ficha** `FichaDoPaciente.vue:525-558` | **Editar** · Mais (menu: Trocar/Pôr foto, Tirar foto, Registrar óbito, Inativar, Juntar com outro cadastro) | 10 ações em cabeçalho de seção: Novo alerta · **Aplicar vacina** · Registrar de outro lugar · **Atendimento avulso** · **Novo documento** · Editar (responsável) · Mais ações do responsável (menu: Juntar com outro responsável, Excluir a pedido do titular) · Ver o diário · **Ligar ao app** / Encerrar vínculo · Adicionar (quem pode buscar). Mais 5 botões de abrir sublista: Encerrados (n) ×2, Opcionais não iniciadas (n), Histórico (n), Ver os últimos 42 dias | **até 5** (+ "Registrar aceite" por documento pendente) | **12 ações, 5 primários** |
| **Atendimento** `AtendimentoDaClinica.vue:519-557` | rascunho: Mais (Descartar o rascunho, Anular) · **Revisar e finalizar**. Finalizado: Mais · Adendo · **Liberar o resumo** | seletor de 5 seções; "Assumir edição". Na seção Receita e documentos: **Prescrever** · **Fazer a receita** · **Assinar** · **Novo documento** · **Anexar laudo** | 1 nas 4 primeiras seções; **até 6** em Receita e documentos | **6 primários na 5ª seção** |
| **Internação mapa** `InternacaoDaClinica.vue:233-243` | Leitos [secundário, leva à Configuração] | seção Plantão: Checklist do plantão · **Assumir plantão** ou **Passar plantão** | 1 | |
| **Internação detalhe** `InternacaoDetalhe.vue:260-277` | Encerrar sem veterinário [condicional] · **Encerrar internação** | Gravidade (grava ao clicar) · Mudar de leito · Definir/Mudar previsão · **Prescrever** · **Registrar evolução** · Ajustar · **Escrever boletim** · Editar o caso | **até 4** (+ **Enviar** e **Registrar ligação** por boletim) | **10 ações, 4 primários** |
| **Estoque** `EstoqueDaClinica.vue` | nenhuma | seletor de 4 partes. Geladeira: **Receber lote**. Metas: Editar/Combinar metas · Editar/Planejar · Copiar pedido | 1 | |
| **Vacinas** `VacinasDaClinica.vue` | nenhuma | 2 seletores (aba + situação ou período) | 0 | sem ação na página |
| **Configuração** `ConfiguracaoDaAgenda.vue` | nenhuma | por aba: **Nova sala** · **Novo leito** · **Novo tipo** · **Novo bloqueio** · **Salvar** (Política). Catálogo: **Novo medicamento** · **Nova vacina** · **Novo exame** · **Novo diagnóstico** | 1 por aba; **4 no Catálogo** | **4 primários no Catálogo** |

Outros fatos da mesma leitura:

- O primário de **Pedidos** é "Como recebemos pedidos" (`CaixaDePedidos.vue:257`), uma gaveta de
  configuração.
- O primário do cabeçalho do **detalhe da internação** é "Encerrar internação", a ação que termina o
  caso.
- No **mapa da internação**, "Leitos" nomeia duas coisas: o botão do cabeçalho
  (`internacao.leitos.titulo`, vai para Configuração › Leitos) e a seção da planta
  (`internacao.planta.titulo`).
- A ação de criar mora no cabeçalho da página em 4 listas (Agenda: Marcar horário; Pacientes:
  Cadastrar paciente; Fila: Adicionar à fila; Cópias: Registrar pedido) e no cabeçalho da caixa em
  Estoque (Receber lote) e nas abas da Configuração.
- O primário de **Atendimentos** é "Continuar o de {pet}" (`AtendimentosDaClinica.vue:201`): abre o
  rascunho mais antigo.
- A gaveta do horário (`AgendamentoGaveta.vue:957-1008`), no modo ver: Mais ações (menu: Confirmar
  presença, Iniciar atendimento, Editar, Mudar horário, Cancelar horário) · Marcar falta · e uma
  entre Confirmar presença / Marcar chegada / Iniciar atendimento / Marcar retorno / Fechar.

### 2.5 Seções por tela

**Ficha do paciente** (`cadastro/FichaDoPaciente.vue`). Duas colunas a partir de 960 px de
contêiner (`:998-1002`), uma abaixo disso. Nenhuma seção é recolhível: as 10 nascem abertas. O que
se recolhe são sublistas.

| # | Coluna | Seção (h2) | Origem | Aparece para | Nasce | Recolhido dentro dela |
|---|---|---|---|---|---|---|
| 1 | esq. | Dados do paciente | `:584` | todos | aberta | |
| 2 | esq. | Alertas | `:626` | todos | aberta | "Encerrados (n)" |
| 3 | esq. | Vacinas | `vacinas/VacinasDaFicha.vue` | `paciente.ler` + Clínica | aberta | "Opcionais não iniciadas (n)", "Histórico (n)" |
| 4 | esq. | Histórico clínico | `atendimento/LinhaDoTempoDaFicha.vue` | `prontuario.ler` | aberta | filtro "Tipo de registro"; "Ver mais" |
| 5 | esq. | Tratamentos em casa | `tratamentos/TratamentosDaFicha.vue` | `prontuario.ler` | aberta | "Encerrados (n)", "Ver os últimos 42 dias" |
| 6 | esq. | Documentos | `documentos/DocumentosDoPaciente.vue` | `prontuario.ler` | aberta | "Ver mais" |
| 7 | dir. | [nome do responsável] | `:758` | todos | aberta | |
| 8 | dir. | Este pet em 30 segundos | `cadastro/ResumoDoApp.vue` | `prontuario.ler` | aberta | 5 subseções h3: O que chama atenção · Em casa desde a última consulta · Peso nos últimos 6 meses · Tratamentos em casa · Medicação e carteirinha do app |
| 9 | dir. | No app do responsável | `cadastro/VinculoCartao.vue` | todos | aberta | h3 Propostas ("Ver todas (n)") · h3 Pedidos de correção |
| 10 | dir. | Quem pode buscar | `:841` | todos | aberta | |

"Tratamentos em casa" aparece duas vezes na mesma tela: seção 5 (h2) e subseção da seção 8 (h3).
A ficha não tem slot `#voltar` e não mostra a fileira de abas (é rota de detalhe).

**Atendimento** (`atendimento/AtendimentoDaClinica.vue`). Uma coluna. Uma seção por vez, escolhida
no seletor (`:593`); o seletor marca a seção em que falta algo para finalizar.

| # | Bloco | Quando aparece | Nasce |
|---|---|---|---|
| 0 | Faixa de estado (em outra aba, finalizado, anulado) com "Assumir edição" | condicional | aberta |
| 1 | Seletor das 5 seções + estado da gravação | sempre | |
| 2 | "Consulta anterior, {dia}" + Abrir | só na Anamnese | aberta |
| 3 | Seção **Anamnese**: Pré-consulta do app (se houver) + Anamnese com 3 subseções: O que trouxe · Em casa · Prevenção | 1ª opção (padrão) | aberta |
| 4 | Seção **Exame físico**: Sinais vitais · Mucosas e hidratação · Sistemas · Observação do exame | 2ª | oculta até escolher |
| 5 | Seção **Diagnóstico**: Diagnósticos · Antecedentes | 3ª | oculta |
| 6 | Seção **Conduta**: Para o responsável · Retorno · Só na clínica · Atos da consulta | 4ª | oculta |
| 7 | Seção **Receita e documentos**: Receita (Prescrições · Receitas) + Documentos + Laudos recebidos | 5ª | oculta |
| 8 | Registro ("Quem responde por este atendimento e os adendos") | só fora do rascunho, em qualquer seção | aberta |

15 subseções (h3) repartidas em 5 seções. A 5ª junta três caixas de assuntos diferentes (receita,
documentos, laudos) e é a que concentra 5 botões primários.

**Detalhe da internação** (`internacao/InternacaoDetalhe.vue`). Uma coluna (`:616-619`), tudo
empilhado, nenhuma seção recolhível.

| # | Seção (h2) | Origem | Aparece para | Nasce | Recolhido dentro dela |
|---|---|---|---|---|---|
| 0 | Recados e aviso "Sem registro há {n} h" | `:280-291` | condicional | aberta | |
| 1 | Estado (Gravidade, Leito, Previsão de alta, Entrada) | `:293` | todos | aberta | |
| 2 | Checklist | `ChecklistDaInternacao.vue` | `internacao.executar` | aberta | |
| 3 | Prescrições | `PrescricoesDaInternacao.vue` | `internacao.executar` | aberta | "Suspensas e terminadas (n)" |
| 4 | Evolução | `EvolucoesDaInternacao.vue` | `internacao.executar` | aberta | "{n} versões anteriores", "Ver mais" |
| 5 | Boletim ao responsável | `BoletinsDaInternacao.vue` | `boletim.compor` ou `boletim.enviar` | aberta | "Ver mais" |
| 6 | O caso (Motivo, Diagnóstico de trabalho, Observação interna, Veterinário responsável, Paciente) | `:411` | todos | aberta | |
| 7 | O que ele tomava no hotel | `:472` | se também hospedado | aberta | |
| 8 | Desfecho | `:511` | se encerrada | aberta | |
| 9 | O que mudou | `:542` | se houver mudanças | aberta | "Ver as {n}" acima de 3 |

Até 9 seções abertas numa coluna. "O caso" (motivo e diagnóstico) é a 6ª, depois de Checklist,
Prescrições, Evolução e Boletim.

### 2.6 Vocabulário

Base: 3.382 chaves de `src/locales/pt.json` referenciadas pelas telas reais (as pastas do módulo,
`espacos.ts`, `useAppNavigation.ts`, `ShellCriar.vue`), com as chaves dinâmicas expandidas.
Contagem por palavra inteira, com plural.

| Coisa | Termos e ocorrências | Observação |
|---|---|---|
| O evento na agenda | **horário 131** · **atendimento 97** · consulta 30 · encaixe 12 · agendamento 8 | "horário" também é hora do dia, a conta superestima |
| O animal | **paciente 112** · pet 45 · animal 25 | |
| A pessoa | **responsável 125** · cliente 38 · dono 7 · titular 4 · tutor 0 | "tutor" não aparece em nenhum rótulo |
| O registro | **cadastro 55** · prontuário 22 · histórico 20 · ficha 16 | a rota é `/clinica/ficha`, o destino é "Pacientes" |
| Quem atende | profissional 35 · veterinário 23 · equipe 8 | |
| Verbos de fim | encerrar 47 · cancelar 42 · anular 36 · finalizar 34 · descartar 27 · fechar 26 · apagar 20 · concluir 20 · remover 15 · tirar 14 · suspender 12 · desativar 11 · inativar 11 · dar baixa 10 · excluir 8 · estornar 4 | 16 verbos |

**Onde divergem na mesma tela ou no mesmo fluxo:**

| Onde | Termos lado a lado | Chaves |
|---|---|---|
| Hoje (`MeuDiaFoco.vue`) | o mesmo botão: "Iniciar **consulta**" e "Continuar **atendimento**" | `clinico.hoje.chamar`, `clinico.meuDia.carrossel.continuar` |
| Hoje → Agenda | "Iniciar **consulta**" no Hoje abre a gaveta da Agenda, onde o botão é "Iniciar **atendimento**" | `clinico.hoje.chamar`, `agendamentos.acao.iniciar` |
| Agenda | "Marcar **horário**", "Cancelar **horário**", status do horário "Finalizado"; no menu Criar, "**Agendamento**"; a aba vizinha é "Pedidos de **horário**" e a configuração fala em "Link de **agendamento**" | `agendamentos.marcar.titulo`, `shell.barra.criarItens.agendamento`, `clinico.pedidos.titulo`, `clinico.pedidos.link.titulo` |
| Atendimento | título e abas dizem "**atendimento**"; dentro: "**Consulta** anterior, {dia}", "Atos da **consulta**", "Pré-**consulta** do app" | `atendimento.anterior`, `atendimento.atos.titulo`, `atendimento.preConsulta.titulo` |
| Internação detalhe | "Abrir a **consulta** de origem" leva a `/clinica/atendimento/:id` | `internacao.abrirAtendimento` |
| Cadastrar paciente (`PacienteNovo.vue`) | **cliente** 10 × responsável 1: "Quem responde por ele", "**Cliente** da casa", "**Cliente** novo", "Procurar o **cliente**"; o outro bloco é "O **pet**" numa tela chamada "Cadastrar **paciente**" | `cadastro.novo.*` |
| Ficha | **paciente** 5 × pet 1; **responsável** 6 × titular 1; "Juntar com outro **cadastro**", "**Ficha** indisponível", "**Prontuário** bloqueado", "**Histórico** clínico" | `cadastro.ficha.*`, `cadastro.mesclar.*`, `cadastro.exclusao.titulo` |
| Receita | "Abrir a ficha do **cliente**" | `atendimento.receita.assinar.abrirFicha` |
| Cópias | "histórico de outro **dono**", "Quando o **dono** baixar pelo app" | `copias.outroDono`, `copias.entregaPeloApp` |
| Busca de paciente | o campo se chama "paciente" e o texto de exemplo diz "Nome do **pet**, do responsável ou telefone" | `agendamentos.marcar.buscarPaciente`, `cadastro.lista.buscar` |
| Prescrição | "Informe o peso do **animal**", "O **animal** recebe {real} mg" | `atendimento.receita.prescrever.semPeso` |
| Nome da tela | rota `/clinica/meu-dia`, destino "Hoje", título do menu antigo "Hoje na clínica"; rota `/clinica/resumo`, destino "Relatórios", título "Resumo da clínica"; aba "Correções", título "Pedidos de correção"; aba "Cópias", título "Cópias do prontuário" | `espacos.clinica.*`, `clinico.*.titulo` |
| "O que pede ação" | título de seção no Hoje e no mapa da internação | `inicio.pauta.titulo`, `internacao.pauta.titulo` |

### 2.7 Rotas órfãs

19 das 31 rotas são aba de um destino. As outras 12:

| Rota | Mora em | De onde se chega (arquivo:linha) | Volta |
|---|---|---|---|
| `/clinica/internacao/boletins-pendentes` | acende "Internação" na barra | **Nenhum `to=` nem `router.push` nas telas reais.** Só existe como item do menu antigo (`src/composables/useAppNavigation.ts:206`), que a receita de `espacos.ts` não transforma em aba. Pode entrar pela pauta do Início se o servidor mandar essa rota num contador (`components/home/usePautaDaHome.ts:114-121`) | sem `#voltar` |
| `/clinica/internacao/vagas` | acende "Internação" | **Idem**: só `useAppNavigation.ts:213`, com `seNaoAbrir: '/clinica/internacao'` (feita para a recepção, que não abre o mapa). Quem não abre o mapa não tem o destino Internação na barra | sem `#voltar` |
| `/clinica/internacao/plantao` | acende "Internação" | um link-botão "Checklist do plantão" na seção Plantão do mapa (`internacao/PlantaoDaInternacao.vue:147`), só com `internacao.executar` | `#voltar` → Internação |
| `/clinica/internacao/:internacaoId` | acende "Internação" | leito ocupado e pauta do mapa (`InternacaoDaClinica.vue:125`, `:212`, `:216`), Histórico clínico da ficha (`LinhaDoTempoDaFicha.vue:126`), Hoje (`meu-dia/useMeuDiaDaClinica.ts:189`) | `#voltar` → Internação |
| `/clinica/paciente/novo` | prefixo de "Pacientes" | "Cadastrar paciente" na lista (`PacientesLista.vue:211`, cabeçalho e vazio). O menu Criar (`ShellCriar.vue:55`) só existe na demonstração | link no slot `resumo`, não em `#voltar` |
| `/clinica/paciente/importar` | prefixo de "Pacientes" | "Importar planilha" e "Ver a importação" na lista (`PacientesLista.vue:234`, `:256`) | `#voltar` → Pacientes |
| `/clinica/ficha/:petId` | prefixo de "Pacientes" | linha da lista (`PacientesLista.vue:341`), gaveta da agenda (`AgendamentoGaveta.vue:638`), Vacinas, Tratamentos, Retornos, Cópias, Atividades, Correções, detalhe da internação (`:458`), Hoje ("Resumo em 30 s", `useMeuDiaDaClinica.ts:377`), avisos (`ShellAvisos.vue:47`) | **sem `#voltar`** |
| `/clinica/atendimento/:encounterId` | prefixo de "Pacientes", mesmo vindo da Agenda | gaveta da agenda (`AgendamentoGaveta.vue:265`, `:693`), lista de Atendimentos (`:258`, `:323`), Histórico clínico da ficha (`LinhaDoTempoDaFicha.vue:125`, `:152`), "Consulta anterior" (`AtendimentoDaClinica.vue:661`), detalhe da internação (`:463`), Repetir receita | `#voltar` → "Agenda" se veio de horário, senão "Atendimentos" |
| `/clinica/paciente/:petId/historico`, `/resumo`, `/tratamento`, `/vacinas` | prefixo de "Pacientes" | só a demonstração (`integrada: false`) | |

`/clinica/historico-liberado` é aba de Pacientes, mas também só abre na demonstração.

### 2.8 Outros fatos de navegação vistos no caminho

| Fato | Onde |
|---|---|
| A **busca global** (Ctrl K) só é montada na demonstração: o botão, o atalho e o componente estão atrás de `v-if="clinicaNaDemonstracao"` | `layout/AppShell.vue:137`, `:400`, `:464`, `:494` |
| O botão **"Criar novo"** (Agendamento, Paciente, Espera por vaga) só tem opções na demonstração: `ShellCriar` recebe `:clinica="clinicaNaDemonstracao"` e devolve lista vazia fora dela | `layout/AppShell.vue:411`, `layout/ShellCriar.vue:35-66` |
| Com a API, o botão principal do **Hoje** ("Iniciar consulta" / "Continuar atendimento") não abre o atendimento: leva a `/clinica/agenda?horario=<id>`, que abre a gaveta do horário, onde está "Iniciar atendimento". São duas telas e dois cliques até o prontuário | `meu-dia/useMeuDiaDaClinica.ts:363-374`, `agendamentos/AgendamentoGaveta.vue:254-266` |
| No Hoje, **"Resumo em 30 s"** leva à ficha inteira (`/clinica/ficha/:id`), onde "Este pet em 30 segundos" é a 8ª seção, na coluna da direita | `useMeuDiaDaClinica.ts:376-378`, `cadastro/FichaDoPaciente.vue:827` |
| A **ficha não tem ação de marcar horário**. O único caminho da ficha para a Agenda é clicar num horário já existente no Histórico clínico. A Agenda da API não lê `?novo=` nem `?paciente=` (lê `data`, `visao`, `por`, `horario`, `retorno`) | `atendimento/LinhaDoTempoDaFicha.vue:128`, `agendamentos/AgendaDaClinica.vue:103-125`, `:535`, `:603` |
| O atendimento aberto pela Agenda acende **"Pacientes"** na barra, não "Agenda" | `navegacao/espacos.ts:105` |
| **Atividades** (Pendências) empilha 7 listas que repetem abas vizinhas e de outros destinos: Pedidos com o prazo vencido, Faltas sem contato, Retornos sem horário, Vacinas atrasadas, Atendimentos iniciados e não abertos, Prontuários em rascunho, Resumos que não chegaram ao app | `atividades/AtividadesDaClinica.vue:325-407` |
| Telas de detalhe com `#voltar`: Atendimento, Internação detalhe, Checklist do plantão, Importação. Sem: Ficha, Cadastrar paciente (usa o slot `resumo`), Boletins pendentes, Vagas | `grep '#voltar'` |
| Filtros que não vão para a URL (somem ao recarregar ou voltar): Pacientes (busca, espécie, situação), Fila, Correções, Cópias, Retornos, e o 3º nível de Vacinas e de Estoque | tabela 2.3 |
