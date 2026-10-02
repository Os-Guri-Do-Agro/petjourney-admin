---
name: PetJourney Admin
description: Portal do parceiro PetJourney — tinta sálvia sobre linho, quieto até algo importar.
colors:
  folha-de-salvia: "#84C1B4"
  salvia-de-tinta: "#4F756B"
  salvia-de-tinta-escura: "#456A60"
  salvia-fosca: "#6E9189"
  salvia-profunda: "#3C7B6D"
  regua-de-salvia: "#84A59D"
  veu-de-salvia: "#E5EEEA"
  linho: "#F0EAE3"
  linho-claro: "#FBF7F4"
  linho-macio: "#F5F0EC"
  linho-afundado: "#E6DFD6"
  costura: "#C8B5A8"
  costura-suave: "#DDCDC4"
  tinta: "#1F2F2B"
  tinta-secundaria: "#616C69"
  tinta-apagada: "#7D8583"
  branco-tinta: "#FFFFFF"
  terracota-texto: "#A2503A"
  terracota-fundo: "#FBEEE8"
  terracota-acento: "#D98E73"
  terracota-queimada: "#752712"
  ambar-texto: "#856112"
  ambar-fundo: "#F7F0E0"
  confirmado-texto: "#4B776B"
  confirmado-fundo: "#EAF4F0"
  pendente-texto: "#716C61"
  pendente-fundo: "#F0EFEC"
  coral-texto: "#A7313A"
  coral-fundo: "#FDE3E2"
  pessego-texto: "#8F4322"
  pessego-fundo: "#FFE8DE"
  pessego-cheio: "#FFB7A1"
  ciano-clinica-texto: "#1E5557"
  ciano-clinica-fundo: "#D7EEEE"
  pervinca-hotel-texto: "#4A3F9E"
  pervinca-hotel-fundo: "#E8E4FF"
  azul-noite: "#1D3557"
  pervinca: "#554AA8"
  pervinca-fundo: "#ECE6F7"
  pervinca-linha: "#8C7FDC"
typography:
  headline:
    fontFamily: "PetJourney Arabic, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.35rem"
    fontWeight: 750
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  title:
    fontFamily: "PetJourney Arabic, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.05rem"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "-0.01em"
  body:
    fontFamily: "PetJourney Arabic, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 500
    lineHeight: 1.45
  value:
    fontFamily: "PetJourney Arabic, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
    letterSpacing: "-0.01em"
    fontFeature: "'tnum' 1"
  label:
    fontFamily: "PetJourney Arabic, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 700
    letterSpacing: "0.1em"
  chip:
    fontFamily: "PetJourney Arabic, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 700
rounded:
  control: "0.7rem"
  card: "1rem"
  pill: "999px"
  card-inicio: "1.25rem"
  chip-inicio: "6px"
spacing:
  "1": "0.25rem"
  "2": "0.4rem"
  "3": "0.6rem"
  "4": "0.85rem"
  "5": "1.15rem"
  "6": "1.6rem"
components:
  button-primary:
    backgroundColor: "{colors.folha-de-salvia}"
    textColor: "{colors.branco-tinta}"
    rounded: "{rounded.control}"
    padding: "0.5rem 1rem"
  button-primary-hover:
    backgroundColor: "{colors.salvia-fosca}"
    textColor: "{colors.branco-tinta}"
  button-primary-active:
    backgroundColor: "{colors.salvia-de-tinta}"
    textColor: "{colors.branco-tinta}"
  button-secondary:
    backgroundColor: "{colors.linho-claro}"
    textColor: "{colors.salvia-de-tinta}"
    rounded: "{rounded.control}"
    padding: "0.5rem 1rem"
  input:
    backgroundColor: "{colors.linho-claro}"
    textColor: "{colors.tinta}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    height: "36px"
  card:
    backgroundColor: "{colors.linho-claro}"
    textColor: "{colors.tinta}"
    rounded: "{rounded.card}"
    padding: "1.15rem"
  chip-risco:
    backgroundColor: "{colors.terracota-fundo}"
    textColor: "{colors.terracota-texto}"
    rounded: "{rounded.pill}"
    padding: "0.15rem 0.6rem"
  chip-atencao:
    backgroundColor: "{colors.ambar-fundo}"
    textColor: "{colors.ambar-texto}"
    rounded: "{rounded.pill}"
    padding: "0.15rem 0.6rem"
  chip-confirmado:
    backgroundColor: "{colors.confirmado-fundo}"
    textColor: "{colors.confirmado-texto}"
    rounded: "{rounded.pill}"
    padding: "0.15rem 0.6rem"
  chip-pendente:
    backgroundColor: "{colors.pendente-fundo}"
    textColor: "{colors.pendente-texto}"
    rounded: "{rounded.pill}"
    padding: "0.15rem 0.6rem"
  chip-maquina:
    backgroundColor: "{colors.pervinca-fundo}"
    textColor: "{colors.pervinca}"
    rounded: "{rounded.pill}"
    padding: "0.15rem 0.6rem"
  nav-rail:
    backgroundColor: "{colors.folha-de-salvia}"
    textColor: "{colors.branco-tinta}"
    width: "4.6rem"
  nav-rail-active:
    backgroundColor: "{colors.linho-claro}"
    textColor: "{colors.salvia-de-tinta}"
    rounded: "{rounded.control}"
  inicio-card:
    backgroundColor: "{colors.linho-claro}"
    textColor: "{colors.tinta}"
    rounded: "{rounded.card-inicio}"
    padding: "1.35rem 1.5rem 1.5rem"
  inicio-chip-risco:
    backgroundColor: "{colors.coral-fundo}"
    textColor: "{colors.coral-texto}"
    typography: "{typography.chip}"
    rounded: "{rounded.chip-inicio}"
    padding: "0.2rem 0.55rem"
  inicio-chip-atencao:
    backgroundColor: "{colors.pessego-fundo}"
    textColor: "{colors.pessego-texto}"
    typography: "{typography.chip}"
    rounded: "{rounded.chip-inicio}"
    padding: "0.2rem 0.55rem"
  inicio-chip-neutro:
    backgroundColor: "{colors.pendente-fundo}"
    textColor: "{colors.pendente-texto}"
    typography: "{typography.chip}"
    rounded: "{rounded.chip-inicio}"
    padding: "0.2rem 0.55rem"
  inicio-pilula:
    backgroundColor: "{colors.linho-claro}"
    textColor: "{colors.tinta}"
    rounded: "{rounded.pill}"
    padding: "0 1.05rem"
    height: "2.5rem"
  inicio-pilula-cheia:
    backgroundColor: "{colors.salvia-de-tinta-escura}"
    textColor: "{colors.branco-tinta}"
    rounded: "{rounded.pill}"
    padding: "0 1.05rem"
    height: "2.5rem"
  inicio-pilula-cheia-hover:
    backgroundColor: "color-mix(in srgb, #456A60 82%, #1F2F2B)"
    textColor: "{colors.branco-tinta}"
  inicio-agora:
    backgroundColor: "{colors.salvia-de-tinta-escura}"
    textColor: "{colors.branco-tinta}"
    typography: "{typography.chip}"
    rounded: "{rounded.pill}"
    padding: "0.1rem 0.45rem"
  inicio-bloco-risco:
    backgroundColor: "{colors.coral-texto}"
    textColor: "{colors.coral-fundo}"
    rounded: "{rounded.control}"
    size: "2.25rem"
  inicio-bloco-atencao:
    backgroundColor: "{colors.pessego-fundo}"
    textColor: "{colors.pessego-texto}"
    rounded: "{rounded.control}"
    size: "2.25rem"
  inicio-bloco-neutro:
    backgroundColor: "#E2EFEB"
    textColor: "{colors.salvia-de-tinta-escura}"
    rounded: "{rounded.control}"
    size: "2.25rem"
---

# Design System: PetJourney Admin

## Overview

**Creative North Star: "O Consultório Calmo"**

Um consultório bem cuidado não grita. A sala é clara sem ofuscar, as paredes são de um tom
quente e neutro, e a única cor que se repete é a da casa: sálvia. Quando algo precisa de
atenção — um animal em risco, uma medicação atrasada, um turno que vai passar — o sinal
aparece pequeno e exato, num ícone ou num rótulo, e todo o resto continua quieto. É isso que
permite a mesma tela convencer numa demonstração e continuar descansada na oitava hora de uso.

O sistema é **denso por ofício e macio no toque**. Densidade de estação de trabalho (corpo em
13px, linha de tabela de 36px, três níveis de densidade escolhidos pelo usuário) convive com
cantos generosos e superfícies de linho, para que a ferramenta clínica não tenha frieza
hospitalar. A hierarquia vem de tamanho, peso e linha — não de cor e não de sombra. A
superfície é plana por padrão: a borda separa, e só o que realmente flutua ganha sombra.

Rejeições já confirmadas, e que definem o sistema tanto quanto o que ele faz: faixa de acento
na borda esquerda, cartão ou linha pintados inteiros para sinalizar urgência, barras de
segmentos com muitos botões para ações raras, e o achatamento em que todo bloco tem a mesma
borda, o mesmo raio e o mesmo fundo.

Fontes de verdade no código: [src/theme/colors.ts](src/theme/colors.ts) (paleta nos dois
modos), [src/theme/primevue.ts](src/theme/primevue.ts) (preset do PrimeVue) e
[src/features/clinico/theme/clinic-tokens.css](src/features/clinico/theme/clinic-tokens.css)
(tokens de módulo, densidade, estados). `docs/DESIGN_SYSTEM.md` é registro histórico: a
página verde-sálvia descrita lá foi substituída pelo linho.

**Em 30/09/2026 o acabamento da Visão geral deixou de ser exceção e virou o design do portal.**
O usuário não gostava do visual de linho e decidiu levar o da Visão geral — fundo `#F5F7F6` com
grade e brilho de sálvia, cartão branco de fio fino e sombra baixa, título com a frase de estado em
degradê, ações em pílula e selos de 6px — a todas as telas, módulo por módulo. Onde este documento
descreve o linho (Linho, Linho Claro, Costura, "Pico de Luz", "Plano por Padrão"), ele descreve as
telas **ainda não migradas**; as migradas seguem a seção **Design do portal (migração)** logo abaixo
e o código. A ordem combinada: moldura e Clínico (feitos), depois Hotel, Portal do parceiro e
Conta/login.

Nas seções abaixo, o que a Visão geral inaugurou fica sob o subtítulo **Variante da Visão geral** —
é a origem do que hoje vale no portal.

### Design do portal (migração)

Como uma tela entra no design novo, e onde cada peça mora no código:

- **Tokens** — `src/theme/hc-tokens.css`, na raiz (`:root` e `:root.app-dark`): os `--hc-*`
  (fundo, cartão, borda, linha, três tintas, marca, marca forte, marca clara, degradês, sombras e
  os pares de selo: ciano, lilás, pêssego, coral, verde, cinza, azul). Carregados no `main.ts`.
- **Acabamento** — `src/theme/hc-tema.css`, preso a `.hc-tema`. A tela migra pondo
  `class="hc-tema"` no `PartnerPageFrame`, e ganha: a **ponte de tokens** (`--clinic-*` apontam
  para os `--hc-*`, então tabela, cartão, campo e gráfico trocam juntos), o fundo com grade e
  brilho, o cabeçalho da página na escala da saudação, rótulos e cabeçalhos de coluna em caixa
  normal, os botões do PrimeVue em pílula (o primário vira a pílula cheia em degradê, com o
  branco acima de 5:1; o contornado, a pílula clara), os `SelectButton` em trilho de pílula, e
  `.hc-pilula`. Diálogo e popover que o PrimeVue leva ao `body` precisam levar `hc-tema` também
  (todos os `clinic-dialog` do Clínico já levam).
- **Cartão** — `src/components/home/home-card.css` (`.hc`, `.hc__cabeca`, `.hc__titulo`,
  `.hc-selo`, `.hc-chip`, `.hc--<par>`), global.
- **Saudação** — `.hc-saudacao` no slot `cabecalho` do `PartnerPageFrame`: a linha pequena (data,
  plantão ou módulo), o título, e na mesma linha a frase de estado em degradê e as pílulas, com a
  cheia sendo o próximo passo natural. Numa tela de paciente, `FichaCabeca` (com `atual: null`
  fora da ficha, como no internado).
- **Pauta** — `src/components/home/PautaTabela.vue`: a lista "o que pede ação" (assunto, gravidade
  em selo, onde se resolve), usada na Visão geral, em Hoje na clínica e na Internação. No lugar da
  fileira de quatro cartões de número, que o redesenho tirou de Hoje na clínica, Internação e Faltas.
- **Moldura** — trilho, painel e cabeçalho brancos com fio (`AppShell.vue`, variáveis `--shell-*`
  apontando para os `--hc-*`), seção e página abertas em pastilha verde-clara, logotipo numa
  pastilha no degradê, controles do cabeçalho em pílula e o tema (claro/escuro) no menu da conta.
  O título da página no cabeçalho nunca quebra: com o cabeçalho abaixo de 66rem (container query,
  segue o painel aberto ou recolhido), quem cede é a busca, que vira botão de ícone. Interruptor
  (`ToggleSwitch`): trilho cinza, ligado na marca, alça branca — nunca o linho do preset.
- **Segmentos** — `ClinicToggleGroup`: trilho em pílula, a escolhida numa pílula no par do tom, e
  a contagem num selo (`contagem`), nunca escrita no rótulo. As abas de seção
  (`PartnerSectionTabs`) ganham o mesmo trilho dentro de `.hc-tema`. O raio do trilho é fixo (meia
  altura de uma linha), não 999px: no estreito, quando as opções quebram em duas linhas, ele vira
  retângulo arredondado em vez de bolha.
- **Avisos** — o motivo de um travamento ou pendência é uma linha com ícone na tinta do estado,
  nunca uma faixa pintada (`.aviso`, `.exig__resumo`). O `Message` do PrimeVue, dentro de
  `.hc-tema`, é contornado: fundo do cartão e fio na tinta do estado. Bloco que agrupa campos
  (período da reserva, entrega do turno) fica no papel neutro (`--clinic-surface-soft`), não no
  verde-claro: verde é tinta, não papel.

**Já migradas:** a moldura; a Visão geral; o módulo Clínico inteiro (as 15 telas, a ficha, o
migrador e os diálogos); o módulo Hotel inteiro (as 10 telas e os diálogos); o Portal do parceiro (Programas,
Divulgação, Acessos e detalhe, Ganhos de indicação com Extrato e Saques, e os diálogos de vínculo, saque e cupom).
Os componentes do Portal passam as cores por `style`,
cada um com um prefixo (`--prog-*`, `--div-*`, `--pf-*`, `--auth-*`…); a "ponte do Portal" em `hc-tema.css` liga cada
papel ao token novo, e o cartão em foco (`--pf-*`, antes um gradiente verde) vira cartão branco. Redesenhadas além do
acabamento, com proposta aprovada: Hoje na clínica, Internação (mapa e internado), Agenda (bloco
branco: o tipo só no ícone, a cor do fundo só para o estado), Faltas, Painel do dia, Hóspedes na
casa e Rotina do turno; no Portal, Divulgação (o kit de compartilhar primeiro, as regras recolhidas), Ganhos (o saldo
na frase da saudação, sacar e PIX em diálogo, a ajuda recolhida), Programas (uma linha por programa num cartão só, as
etapas de ativação recolhidas) e Acessos (um pet, uma linha: os acessos do mesmo pet se agrupam e abrem embaixo dele;
abas, busca e filtros numa linha, os filtros finos recolhidos atrás de um botão com contagem).

No Clínico, a segunda passada (02/10, guiada pela auditoria de carga): Resumo da clínica (frase com os concluídos, os
cartões de número viram linha de fatos, um gráfico por pergunta — a ocupação vira frase —, ranking em linhas HTML do
maior para o menor com "70 (44%)", mapa de horários em tabela com a hora na lateral); Histórico da ficha (uma lista só,
por mês, sem o diálogo de entrada — o veredito do resumo vira uma linha; o futuro sai da lista para "Próximo:");
Tratamento e Vacinas da ficha (o celular do responsável numa gaveta sem máscara, aberta por "Como … vê no app");
Agenda (sobreposição em cascata, alerta de risco escrito no card, texto de 12,5 px, legenda recolhida; a semana virou
tabela pessoa × dia); Vacinas (abre em Em atraso quando há vencidas, um pet por linha, histórico de 20 em 20, estoque
em linha de fatos); Pacientes (o alerta pelo nome da condição, a categoria no ícone, "+1"); Atendimentos (rascunhos no
topo, blocos por dia); Fila (ofertas primeiro, pela que expira antes, com "Registrar aceite/recusa" escritos).
Padrões que saíram daqui: **cartões de número viram frase + linha de fatos**; **o que se repete agrupa** (pet, dia,
mês); **ação escrita fica sempre à vista** — o esconde-até-o-hover da `ClinicDataTable` vale só para ícone; datas pelo
`ClinicDateField` (DatePicker com valor em texto), nunca o calendário do navegador; todo DatePicker passa
`panel-class="hc-tema"`.

Terceira passada no Clínico (02/10, depois do retorno do usuário — "a agenda vira uma bagunça
visual quando tem muitos atendimentos", "listas de pacientes sem avatar", "a gravação poderia ser um
modal lateral"): a **Agenda do dia virou tabela** (`AgendaTabelaDia`: uma linha por meia hora, uma
coluna por profissional, cada atendimento uma linha do mesmo tamanho com avatar e nome; encaixes
um embaixo do outro; o procedimento longo continua como faixa; risco é ícone por categoria; aviso
de choque só no que ainda se decide; arrastar para outra célula remarca) — a grade proporcional
continua em Exibição → "Linha do tempo"; **todo paciente em lista tem rosto** (`ClinicPacienteCelula`
sobre o `PetAvatar` do hotel, e a pauta da `PautaTabela` aceita `pet`); a **revisão da gravação
da consulta mora numa gaveta à direita** que, em tela larga, abre espaço na página
(`html.escuta-lateral`); o **checklist da internação** é uma lista num cartão, com o que já foi
registrado recolhido numa linha; Atividades empilhada na largura toda.

*Nota:* o código da Visão geral foi além do que esta variante descreve — fundo `#F5F7F6` com dois
brilhos de sálvia e uma grade fina que some descendo, cartão branco com borda fina e sombra
baixa, resumo e pílula cheia em degradê (`home-card.css`, `inicio.vue`). Onde este documento e o
código divergem, a ficha segue o código, que é o que o usuário vê e aprovou. O código fica em
[src/pages/(accounts)/inicio.vue](<src/pages/(accounts)/inicio.vue>) e `src/components/home/`,
e a composição da tela, no brief `.impeccable/surfaces/src-pages-accounts-inicio-vue.md`.

**Key Characteristics:**

- Verde é tinta, não papel: sálvia no acento, linho quente na superfície.
- Cor fora do sálvia só entra com significado próprio, e nunca preenche área grande.
- Plano por padrão; a linha separa, a sombra é reservada ao que flutua.
- Cantos macios, densidade de estação de trabalho, números tabulares.
- Modo claro é o padrão; o escuro espelha cada papel com valores próprios.
- Movimento curto (140–220 ms) que explica mudança de estado e desliga com
  `prefers-reduced-motion`.
- O design do portal, nascido na Visão geral e em migração tela a tela desde 30/09/2026: fundo com
  grade e brilho de sálvia, cartão branco de fio fino e sombra baixa, saudação com frase de estado
  em degradê, selo de 6px, ação em pílula (ver **Design do portal (migração)**).

## Colors

Tinta sálvia sobre linho quente, com quatro gavetas de cor semântica que só abrem quando a
frase que elas dizem é verdadeira.

### Primary

- **Folha de Sálvia** (#84C1B4): a cor da casa. Trilho de navegação, botão primário, marca,
  acento de seleção. Aparece como tinta e como faixa estreita, nunca como plano de página.
- **Sálvia de Tinta** (#4F756B): a sálvia levada ao escuro para escrever. Texto de ação, link,
  item ativo, estado pressionado do primário.
- **Sálvia de Tinta Escura** (#456A60): a sálvia que escreve nos tokens de módulo
  (`--clinic-accent-strong`), em Clínica, Hotel e na Visão geral, e a cor do anel de foco.
  Fica em 5,7:1 contra o cartão. Na Visão geral é também a linha-resumo e o fundo da pílula
  cheia, com branco por cima a 6:1. Convive com a Sálvia de Tinta, que segue nas telas do
  Portal e no preset.
- **Sálvia Fosca** (#6E9189): hover do primário e ênfase média.
- **Sálvia Profunda** (#3C7B6D): superfície de foco com texto claro (cartão de destaque do
  modo foco), em gradiente até #2E6156.
- **Régua de Sálvia** (#84A59D): linha com intenção — tracejado de estado vazio, régua
  estrutural, borda de campo no módulo clínico. 2,5:1 contra o cartão.
- **Véu de Sálvia** (#E5EEEA): fundo de item selecionado e de destaque suave.

### Secondary

- **Azul-Noite** (#1D3557): "isto é do outro turno". Fronteira entre o meu turno e o
  seguinte e o botão de passar o turno. Nunca preenche superfície.
- **Pervinca** (#554AA8, fundo #ECE6F7, linha #8C7FDC): "a máquina propôs e ninguém aprovou
  ainda". Moldura da anamnese por voz e grifo do trecho que virou campo. Aprovado, o campo
  perde a cor e vira prontuário.

### Tertiary

Estados, sempre em par texto/fundo e sempre acompanhados de rótulo, ícone ou forma:

- **Terracota** (texto #A2503A sobre #FBEEE8, acento #D98E73): risco alto, erro, urgência.
- **Terracota Queimada** (#752712): tinta de ação destrutiva (sair, excluir), resolvida para
  4,5:1 no pior estado do chip.
- **Âmbar** (texto #856112 sobre #F7F0E0): atenção, pendência de prazo.
- **Confirmado** (texto #4B776B sobre #EAF4F0): sucesso, confirmado, em dia.
- **Pendente** (texto #716C61 sobre #F0EFEC): neutro, aguardando, sem juízo.

O módulo clínico tem ainda uma paleta de **categoria** (tipo de atendimento, colunas de
profissional, séries de gráfico) em `clinic-tokens.css`. Categoria é significado legítimo, mas
cada tom vive como marca pequena — ponto, faixa de evento, linha de gráfico — nunca como fundo.

### Neutral

- **Linho** (#F0EAE3): o plano da página. Matiz quente (74°) com luminância travada — foi o
  giro de matiz que tirou o "verde demais" da tela sem mexer no contraste.
- **Linho Claro** (#FBF7F4): cartão, casca do shell, campo. É o pico de luz da tela (93,8%).
- **Linho Macio** (#F5F0EC): bloco interno ao cartão, cabeçalho de tabela, hover.
- **Linho Afundado** (#E6DFD6): área rebaixada, trilho de progresso, poço.
- **Costura** (#C8B5A8): borda padrão de cartão e campo, 1,86:1 contra o cartão.
- **Costura Suave** (#DDCDC4): fundo de trilho e contorno de hover. Fica em 1,45:1 contra o
  cartão, abaixo do piso da regra Linha Separa — não serve como único separador de linhas; para
  isso, Costura.
- **Tinta** (#1F2F2B): texto principal, 11,6:1.
- **Tinta Secundária** (#616C69): texto de apoio, 4,5:1 — o piso AA.
- **Tinta Apagada** (#7D8583): label, divisor tipográfico, placeholder; 3,1:1, só para texto
  grande ou não essencial. No módulo clínico, a densidade de 13px escurece muted e faint para
  #43504D e #56645F.
- **Branco-Tinta** (#FFFFFF): existe só como tinta — texto e ícone sobre sálvia cheia — e
  como zona quieta de QR code.

### Variante da Visão geral

A paleta é a mesma. O que muda é que quatro pastéis da paleta da casa (`src/theme/colors.ts`)
ganham par de selo, e o pêssego entra também cheio, numa marca pequena. Em cada par, a tinta é
o próprio matiz escurecido até passar de 5:1 contra o fundo do selo e contra o cartão.

- **Coral** (texto #A7313A sobre #FDE3E2, do coral #F28482): gravidade urgente, programa
  rejeitado ou suspenso nos ganhos e, na Linha do dia, o contorno da falta. Fica em 5,5:1 no
  selo e 6,3:1 no cartão. Invertido, com o fundo na tinta e o ícone no fundo do selo, é o bloco
  cheio do ícone urgente na pauta, nos mesmos 5,5:1. No escuro, o bloco é #F6A9A8 com o ícone
  em #3F2226, a 7,6:1.
- **Pêssego** (texto #8F4322 sobre #FFE8DE, do pêssego #FFB7A1): gravidade de atenção, no selo
  e no bloco do ícone da pauta, saque bloqueado, pedido de programa ainda sem resposta e, na
  Linha do dia, o tempo que pede atenção: quem espera na recepção, o movimento do hotel atrasado
  ou travado. Fica em 6:1 no selo e 6,6:1 no cartão.
- **Pêssego Cheio** (#FFB7A1; no escuro, #8A4A2C): o próprio pastel, sem mistura. Preenche só a
  conta de quem aguarda na recepção e as amostras dela, sempre com contorno na tinta pêssego:
  contra o cartão, o pastel sozinho fica em 1,6:1 e quase some.
- **Normal** usa o par Pendente no selo, sem mudança. Na pauta, o bloco do ícone normal fica na
  sálvia clara (`--clinic-accent-tint`) com a Sálvia de Tinta Escura, a 5,1:1.
- **Ciano e pervinca** são a identidade de módulo, uma categoria: o selo do grupo na pauta, o
  rótulo da pista na Linha do dia e, dentro dela, o que é do módulo. A Clínica usa #1E5557 sobre
  #D7EEEE (no escuro, #A8DADC sobre #173A3C). O Hotel usa #4A3F9E sobre #E8E4FF (no escuro,
  #CFC7FF sobre #2B2750). Todos passam de 6,8:1. A marca do hotel leva contorno na linha da
  Pervinca (#8C7FDC; no escuro, #6F64B8).
- **O véu do topo** é Folha de Sálvia a 34% (12% no escuro), num degradê radial de 64rem ×
  28rem ancorado 8rem acima da borda superior, a 12% da largura. Ele se dissolve no linho antes
  do meio da tela. Só sálvia: pastel é de selo, não de fundo.
- **As pistas da Linha do dia** não têm cor própria: são a superfície do cartão, separadas por
  fios de Costura. Só os riscos de hora são um véu quente do linho, `rgb(140 120 105 / 16%)` (no
  escuro, `rgb(240 234 227 / 9%)`). Não há campo nem tom de passado: no fim do dia, o passado
  cobria a pista inteira e ela voltava a ler como campo bege, e o usuário pediu fundo branco nas
  pistas, como nos outros cartões — aqui, o Linho Claro, pico de luz da casa. O fio do agora é o
  único sinal de onde o dia está, e a conta finalizada, em Régua de Sálvia, fica a 2,5:1 contra o
  cartão.

Coral e pêssego vivem na raiz da página (`--grav-*`), para que a pauta, os ganhos e a Linha do
dia digam "atenção" com a mesma cor. A identidade de módulo mora ao lado (`--modulo-*`) pelo
mesmo motivo: o selo da pauta e a pista da Linha do dia dizem o módulo com o mesmo par. O resto
do portal segue com terracota e âmbar. A pervinca do Hotel tem o mesmo matiz da gaveta "a
máquina propôs", e o contorno da marca do hotel é o próprio valor da linha dessa gaveta. Na
Visão geral as duas não se encontram, mas levar a identidade de módulo a outra tela pede
resolver isso antes.

### Named Rules

**The Tinta, Não Papel Rule.** Sálvia é a cor que escreve, marca e seleciona. Nenhuma
superfície maior que um chip é sálvia, exceto o brilho do topo das telas no design novo, a
pastilha do logotipo e, na Visão geral, a faixa de "Indique e ganhe", a parte de baixo do cartão
de ganhos. (O trilho de navegação sálvia deixou de existir com a moldura clara.)

**The Quatro Gavetas Rule.** Cor fora do sálvia só existe para dizer uma destas frases: "é
risco ou pendência" (terracota, âmbar; coral e pêssego na Visão geral), "é do outro turno"
(azul-noite), "a máquina propôs" (pervinca), "é desta categoria" (paleta de tipo; identidade
de módulo na Visão geral). Nenhuma cor decora, e nenhuma diferencia coisas do mesmo tipo.

**The Escala de Cinza Rule.** Em escala de cinza nenhuma informação pode se perder. Todo
estado tem, além da cor, um rótulo, um ícone ou uma forma.

**The Pico de Luz Rule.** Nenhuma superfície mais clara que Linho Claro (#FBF7F4). Branco puro
é tinta, não papel. Clarear cartão ou casca "para destacar" é o erro que já gerou duas
rejeições.

**The Agora Não É Alarme Rule.** Na Visão geral, o agora é um fio de Sálvia de Tinta Escura,
nunca vermelho nem coral. Vermelho que marca "são 10h12" ensina a ignorar o vermelho que marca
"ligue agora". Na Linha do dia, coral é só a falta.

## Typography

**Body Font:** a sans do sistema (`ui-sans-serif, system-ui`: Segoe UI no Windows, SF no Mac),
precedida de PetJourney Arabic para a faixa árabe.
**Label/Mono Font:** a mesma família; números em algarismos tabulares.

**Character:** Uma sans única e neutra. O portal **não carrega webfont latina**, então o que
renderiza é a fonte do sistema de quem usa. O módulo clínico declara DM Sans no topo da própria
pilha (`--clinic-font-sans`), mas ela só entra se estiver instalada na máquina — na prática, a
tela sai em Segoe UI. O árabe entra via Readex Pro (a mesma do app) restrita por
`unicode-range`. Escolher e hospedar uma face própria é uma decisão em aberto, não um fato do
sistema.

### Hierarchy

- **Headline** (750, 1.35rem, 1.2, -0.02em): título de página e de painel principal. Faixa
  observada 1.25–1.5rem; acima disso só número de métrica isolado e a saudação da Visão geral
  (ver Variante).
- **Title** (700, 1.05rem, 1.3): título de cartão, seção e diálogo.
- **Body** (500, 0.8125rem / 13px, 1.45): texto corrido e célula de tabela na densidade média.
  Compacta desce a 12.5px; confortável sobe a 14px.
- **Value** (600, 0.875rem / 14px, tabular): valor clínico, horário, dose, peso, dinheiro.
- **Label** (700, 0.6875rem / 11px, 0.1em, caixa-alta): rótulo de campo, cabeçalho de coluna,
  em Tinta Apagada. O piso de tamanho de texto da interface é este: nada abaixo de 11px.
- **Chip** (700, 0.75rem / 12px): texto de pílula de estado ("Urgente", "Em análise"), sempre no
  par texto/fundo da sua gaveta.

### Variante da Visão geral

A saudação abre a tela num degrau que o resto do portal não usa. Tudo sai na mesma sans do
sistema. A fonte própria continua em aberto, e estes tamanhos não a escolhem. São tamanhos da
Visão geral, por isso ficam aqui e não nos tokens.

- **Saudação** (750, 2rem, 1.15, -0.03em): o `h1` "Olá, {parceiro}".
- **Resumo** (500, 1.75rem, 1.2, -0.02em, em Sálvia de Tinta Escura): a frase que diz o estado
  da pauta, como quantos assuntos pedem atenção ou se está tudo em dia. É mais leve que o
  título, e a cor marca estado, não importância.
- **Valor em destaque** (750, 2.5rem, 1.05, -0.03em, tabular): o valor liberado dos ganhos. É o
  número de métrica isolado que a Headline já prevê.
- **Código de indicação** (800, 2rem, 1.1, 0.1em, tabular): um dado para ser ditado ao
  telefone, sem rótulo. No painel do QR, cai para 1.5rem com 0.12em.
- **Rótulo de eixo** (600, 0.75rem, em Tinta Apagada): cabeçalho de coluna da pauta e horas da
  régua da Linha do dia, estas em algarismos tabulares. Em caixa normal, não em Label.

Título de cartão, o "Hoje" e o nome em destaque na Linha do dia, corpo e valor seguem Title,
Body e Value.

### Named Rules

**The Número Tabular Rule.** Todo número que se compara na vertical usa `tnum`. Coluna de
número que dança obriga a reler linha a linha, e reler número é onde o erro entra.

**The Peso Antes da Cor Rule.** Hierarquia sobe por tamanho e peso (500 → 700 → 750/800). Cor
de texto só muda para indicar estado ou ação, nunca para dar importância. Na Visão geral, a
linha-resumo é tinta sálvia porque diz o estado da pauta, e o peso dela (500) fica abaixo do
título.

## Layout

Shell de três faixas: **trilho** de ícones sálvia (4.6rem), **painel** de links da seção ativa
(18rem, 16.25rem na densidade compacta) e **área de conteúdo** com header fixo de 4.25rem que
não cobre a navegação. O trilho pode recolher (só ícones) ou sumir no modo foco; abaixo de
900px a navegação vira gaveta sobreposta.

Ritmo de espaçamento em seis degraus não lineares (0.25 → 1.6rem), com o padding interno de
cartão no degrau 5 (1.15rem). Densidade é escolha do usuário em três níveis (compacta, média,
confortável) e troca tamanho de fonte, altura de linha e alvo de clique juntos, a partir de
uma única variável no `:root`.

Desktop é o cenário principal e tablet é prioritário: em `pointer: coarse` o shell aumenta os
alvos, e a densidade confortável leva o alvo mínimo a 34px. A densidade média usa alvo de
mouse (28px), não de dedo.

Todo layout funciona espelhado em RTL (`ar`): propriedades lógicas (`padding-inline`,
`inset-inline`) e ícones direcionais do PrimeIcons espelhados globalmente.

Cada tela tem forma própria, derivada do que ela faz — grade de ocupação, linha do tempo do
dia, eixo de horários, régua de relógio. Uma fileira de quatro cartões de número com lista
embaixo não é layout padrão; foi exatamente o que fez telas diferentes parecerem a mesma.

### Variante da Visão geral

A grade responde à largura do próprio conteúdo, por container query, e não à da janela. Com
trilho e painel abertos, um tablet de 1024px deixa uns 720px para a página. A grade tem duas
áreas: a pauta e o cartão de ganhos, que leva a indicação na faixa de baixo. A partir de 60rem,
as duas ficam lado a lado (`'pauta ganhos'`, 1.5fr / 1fr). Abaixo disso, tudo vira uma coluna
com a pauta primeiro: quem opera no tablet vê o trabalho antes do dinheiro. Conta sem clínica
nem hotel não tem pauta, e o cartão de ganhos ocupa a largura toda. A partir de 46rem, as duas
partes dele ficam lado a lado (1.15fr / 1fr), os ganhos primeiro. O vão entre cartões é de
1.25rem. Dentro deles, vale a escada de espaçamento da casa.

Entre a fileira de pílulas e a grade vem a Linha do dia, um cartão de ponta a ponta da coluna, só
quando a conta tem clínica ou hotel. Por dentro, ela é uma grade de duas colunas: rótulos
(5.25rem) e trilho, com 1rem entre elas. A régua e cada pista são linhas dessa grade, e os riscos
de hora e o fio do agora atravessam todas na mesma escala horizontal. A legenda fica fora da
grade, recuada até o trilho, e os blocos por extenso ocupam a largura toda do cartão. A pista da
clínica ganha uma subpista de 0.875rem por atendimento simultâneo, até seis. A do hotel ganha uma
de 2.25rem por marca que encavalaria, até três. Com menos de 38rem de largura (container query
própria), o desenho rola de lado, com 36rem no mínimo, e a legenda e os blocos por extenso
quebram em linhas e ficam inteiros à vista.

## Elevation & Depth

Plano por padrão. A separação entre página, bloco e cartão vem da escada de linho (três
degraus iguais em OKLCH) e de uma borda de verdade (Costura, 1,86:1), não de sombra. Sombra é
resposta a flutuação: diálogo, toast, overlay de menu, pastilha ativa do trilho.

### Shadow Vocabulary

- **Flutuante** (`box-shadow: 0 12px 32px rgb(31 47 43 / 14%)`): diálogo, popover, overlay
  de Select.
- **Toast** (`box-shadow: 0 14px 36px rgb(31 47 43 / 14%)`): notificação no canto.
- **Pastilha do trilho** (`box-shadow: 0 2px 10px rgb(40 51 47 / 18%)`): seção ativa no
  trilho sálvia, que distingue por forma e elevação e não só por cor.
- **Anel de foco** (`box-shadow: 0 0 0 2px #FBF7F4, 0 0 0 4px #456A60`): foco visível em
  todo elemento navegável por teclado.
- **Cartão da Visão geral** (`box-shadow: 0 1px 2px rgb(31 47 43 / 5%), 0 12px 32px -14px
  rgb(31 47 43 / 18%)`): Linha do dia, pauta e o cartão de ganhos, com a indicação dentro, em
  repouso, só nessa tela. No escuro, a mesma receita troca a cor por preto e mantém as
  opacidades.
- **Controle claro da Visão geral** (`box-shadow: 0 1px 2px rgb(31 47 43 / 8%)`; no hover,
  `0 4px 12px -4px rgb(31 47 43 / 24%)`): controle em Linho Claro que, já no teto de luz, sobe
  pela sombra em vez de clarear. É a pílula Copiar da faixa de indicação e a marca do hotel na
  Linha do dia.

No modo escuro a sombra usa preto puro com opacidade maior (46%), porque a sombra quente some
sobre fundo escuro.

### Variante da Visão geral

Na Visão geral, o cartão flutua em repouso, e a Linha do dia é um desses cartões. A sombra macia
substitui a borda e nunca se soma a ela, porque borda e sombra juntas desenhariam o cartão duas
vezes. Dentro do cartão tudo volta a ser plano: grupos e linhas da pauta e as pistas da Linha do
dia se separam por Costura; o bloco da capacidade de saque e os blocos por extenso do dia descem
um degrau, para Linho Macio, sem sombra. Ganhos e indicação dividem um cartão, e a sombra é só
dele: as duas partes entram sem sombra própria. Sobre a faixa de sálvia, o hover dos dois
controles claros aprofunda a sombra em vez de clarear o fundo (ver Components › Ganhos e
indicação).

Dentro da Linha do dia não há campo nem passado: as pistas são a superfície do cartão (ver
Colors). Só a dica flutua, e só ela leva sombra de flutuação (`0 1px 2px` a 8% com
`0 12px 30px -12px` a 30%). A marca do hotel, controle claro sobre o próprio Linho Claro, mantém
a sombra de controle claro. Todo hover que sobe pela sombra troca a variável da sombra, nunca a
`box-shadow` inteira, para não apagar o anel de foco.

### Named Rules

**The Plano por Padrão Rule.** Cartão em repouso não tem sombra. Se dois blocos precisam se
separar, a resposta é linha ou degrau de linho. *Divergência atual:* `.clinic-card` ainda
aplica `--clinic-shadow-card` (5%/8%) em repouso; o alvo é removê-la ao tocar cada tela, sem
varredura em massa. *Exceção com escopo:* a Visão geral, onde o cartão troca a borda pela
sombra (ver Variante).

**The Linha Separa Rule.** Linha abaixo de 1,5:1 contra o cartão não existe para o olho. Se a
borda não se vê, não compense clareando a página — escureça a linha.

## Shapes

Cantos macios e generosos, em três raios que dizem o que o objeto é: **cartão** (1rem),
**controle** (0.7rem — botão, campo, segmento) e **pílula** (999px — chip de estado, contador,
avatar). Toast e diálogo ficam no mesmo patamar de cartão (0.95–1rem). Dentro de um grupo de
segmentos só as pontas externas arredondam; o grupo é uma peça só.

Bordas são sempre completas e de 1px. Nenhuma borda de um lado só como acento; o único traço
unilateral legítimo é estrutural (divisor de lista, régua de eixo), nunca decorativo.

### Variante da Visão geral

Na Visão geral, a forma se inverte: o selo fica quase reto (6px) e a ação vira pílula (999px).
O cartão sobe para 20px (1.25rem) e não tem borda. As partes do cartão de ganhos não têm raio
próprio: o cartão recorta a faixa de sálvia no raio dele. O quadro do QR tem raio de 0.8rem, e o
quadro grande do painel, 20px. O bloco do ícone da pauta usa o raio de controle (0.7rem).
Divisores de grupo e de linha continuam como traço estrutural de 1px em Costura.

Na Linha do dia, tudo o que é tempo é pílula: a conta (10px de altura, com 1px de ar entre duas
coladas, para não lerem como uma só), a marca do hotel (1.75rem) e a hora do agora. A pista não
tem forma própria: é a superfície do cartão, aberta por um fio de Costura. Os blocos por extenso
usam o raio de cartão da casa (1rem), um degrau abaixo dos 20px do cartão que os contém. O
rótulo da pista é o selo de módulo de 6px. O almoço é só um tracejado de 1px em Régua de Sálvia
nas duas pontas do intervalo.

## Components

Macios e acolhedores: cantos generosos, superfície de linho, estado claro, e peso visual
proporcional à importância. Sempre PrimeVue 4 sobre o `PetJourneyPreset` (Aura), nunca HTML
nativo.

### Buttons

- **Shape:** controle macio (0.7rem).
- **Primary:** Folha de Sálvia com texto branco. *Contraste:* branco sobre #84C1B4 fica em
  ~2:1; o rótulo depende de peso 700 e ícone. Em ação crítica, preferir texto em Sálvia de
  Tinta sobre Véu de Sálvia até o preset ser revisto.
- **Hover / Active:** Sálvia Fosca / Sálvia de Tinta, 140–160 ms `ease`. Sem escala, sem
  levantar.
- **Exceção da Visão geral:** sobre a faixa de sálvia, a pílula Copiar e o quadro do QR não
  clareiam. A pílula já está no teto de Linho Claro, e o quadro, no branco da zona quieta. O
  hover aprofunda a sombra, sem escala e sem deslocamento (ver Ganhos e indicação).
- **Secondary / Text:** fundo Linho Claro ou transparente, texto Sálvia de Tinta, borda
  Costura no outlined.
- **Destrutivo:** tinta Terracota Queimada; nunca botão terracota cheio.
- **Rara ação:** recolhida (menu, Select) em vez de barra de botões.
- **Na Visão geral:** a ação é pílula (999px). A contornada usa Linho Claro com borda Costura:
  tem 2.5rem na fileira da saudação (rótulo em Tinta, ícone Phosphor duotone em sálvia) e
  2.25rem dentro do cartão (rótulo em sálvia). A cheia usa Sálvia de Tinta Escura com texto
  branco e fica só para o próximo passo natural: a primeira pílula da fileira, "Pedir saque"
  quando há saldo liberado e "Baixar QR" no painel do QR. No hover, a cheia anda em direção à
  tinta do texto (Sálvia de Tinta Escura a 82% com Tinta, cerca de #3E5F56, com o branco a 7:1)
  e, no escuro, clareia do mesmo jeito. O sálvia médio (`--clinic-accent-deep`) não serve:
  deixava o branco a 4,47:1. Transição de 150 ms `ease-out`.
- **No painel do QR:** os secundários não ficam na cor do "secondary" do tema, que no escuro
  pinta o rótulo #2B423A sobre #121D19, a 1,6:1. Levam as tintas da casa: o contornado em Tinta
  com borda Régua de Sálvia (`--clinic-line-strong`), o de texto em Sálvia de Tinta Escura, e o
  hover dos dois na sálvia clara (`--clinic-accent-tint`) com Tinta. O fechar fica em texto de
  apoio (`--clinic-muted`) e ganha o mesmo hover.

### Chips

- **Style:** pílula, par texto/fundo da gaveta semântica (risco, atenção, confirmado,
  pendente, máquina), sempre com rótulo e, quando urgente, ícone cheio.
- **State:** a urgência mora no chip e no ícone; a linha e o cartão que o contêm ficam
  neutros.
- **Na Visão geral:** selo de 6px, no par pastel da variante (ver Colors), em 0.75rem/700. O
  selo de módulo vai em caixa-alta com 0.05em e é também o rótulo de cada pista da Linha do dia.
  O de gravidade leva a palavra ("Urgente",
  "Atenção", "Normal") e cai sempre na mesma coluna. A urgência continua no ícone: na pauta, é
  o bloco do ícone que leva a gravidade (ver Pauta).

### Cards / Containers

- **Corner Style:** 1rem.
- **Background:** Linho Claro sobre página Linho; bloco interno em Linho Macio.
- **Shadow Strategy:** nenhuma em repouso (ver Plano por Padrão).
- **Border:** 1px Costura, completa.
- **Internal Padding:** 1.15rem.
- Nem todo agrupamento é cartão. Listas, eixos e grades vivem direto sobre o plano, separados
  por linha e espaço; o cartão marca uma unidade de trabalho.
- **Na Visão geral:** 20px, Linho Claro, sem borda, com a sombra do cartão da Visão geral em
  repouso e padding de 1.35rem 1.5rem 1.5rem. A Linha do dia também é um deles, a pedido do
  usuário, para ser da mesma família dos cartões ao lado; por dentro, o eixo segue plano,
  separado por fio. Ganhos e indicação dividem um cartão só (ver Ganhos e indicação). O
  cabeçalho leva um ícone Phosphor duotone em sálvia (1.25rem) e o título em Title. O link do
  cabeçalho é texto em sálvia com seta, e o hover pinta só a pílula de fundo dele.

### Inputs / Fields

- **Style:** Linho Claro, borda Costura (Régua de Sálvia no módulo clínico), raio de controle,
  altura seguindo a densidade (36px na média).
- **Focus:** anel duplo — 2px da superfície, 2px de Sálvia de Tinta escura (#456A60).
- **Error / Disabled:** borda e mensagem em Terracota com texto explicando o que corrigir;
  desabilitado em Tinta Apagada sobre Linho Macio.
- Overlays teleportados recebem `clinic-overlay` via `:pt` para herdar tokens.

### Navigation

- **Trilho (moldura clara, 30/09/2026):** faixa branca de 4.6rem com fio à direita, ícone +
  label de 0.58rem na tinta de apoio; hover no cinza da linha; seção ativa em pastilha verde-clara
  (`--hc-marca-clara`) com a tinta forte da marca. O logotipo é a única superfície verde da
  moldura: a pata clara numa pastilha no degradê da pílula cheia. Sair e recolher são pílulas
  contornadas. Sem barrinha lateral. (O trilho Folha de Sálvia com texto branco foi substituído;
  as direções "trilho verde-escuro" e "moldura fundida no fundo" foram prototipadas e recusadas.)
- **Painel:** lista de links sobre o branco do cartão, linha de 2.4rem (2rem na densidade
  compacta), grupos com label em caixa-alta; ativo na mesma pastilha verde-clara do trilho, peso
  750, com o ícone num ladrilho cheio. Os números de pendência são selos de 6px: cinza, pêssego
  (atenção) ou coral (risco).
- **Cabeçalho:** branco com fio embaixo; cronômetro, busca, cupom e conta em pílulas contornadas.
  O seletor claro/escuro saiu do cabeçalho e é um interruptor "Tema escuro" no menu da conta.
- **Modo foco:** esconde a navegação e deixa a página inteira; header fica.
- **Ícones:** Phosphor para domínio (animal, acomodação, turno), PrimeIcons para interface.
  Nunca SVG desenhado à mão.
- **Tamanho do ícone mora no contêiner.** O ícone tem 1em de quem o contém, como em qualquer fonte
  de ícones: a forma (disco, bloco, marcador) ou a linha de texto declara `font-size`, e o ícone
  segue. Numa forma, o ícone fica entre metade e 60% do lado dela. O tema do PrimeVue fixava
  `.pi` em 1rem e anulava isso em todo o portal — o visto de 16 px num disco de 17 px, a seta de
  abrir linha ocupando dois terços do quadradinho, ícone de 16 px ao lado de rótulo de 11 px. A
  regra `html .pi` em `src/assets/main.css` devolve o contrato; os ícones internos dos
  componentes do PrimeVue (classe `p-*` no elemento) seguem o tamanho do tema. O Phosphor já nasce
  em 1em.

### Toast

Cartão Linho Claro com borda misturada à cor do estado (40% da tinta semântica sobre
Costura), sem ícone — a hierarquia é título 0.9rem/700 e detalhe 0.8rem/500. Única superfície
com sombra fixa, porque flutua.

### Linha do dia (Visão geral)

O dia desenhado como um dia, logo abaixo da saudação: quando cada coisa acontece e onde está o
agora. É um cartão como os outros da tela (`inicio-card`): Linho Claro, 20px, a sombra do cartão
da Visão geral, sem borda, com padding de 1.35rem 1.5rem 1.5rem. No alto vão "Hoje", com ícone
Phosphor duotone em sálvia, a contagem do dia em texto de apoio tabular e o link "Agenda
completa". Na contagem, chegadas e saídas contam só as pendentes, e zero não entra. Embaixo vêm a
régua, uma pista por módulo ligado, a legenda e os blocos por extenso.

- **Régua:** horas rotuladas de duas em duas, em Rótulo de eixo, e riscos de hora em hora que
  atravessam as pistas. A janela é o expediente da clínica, esticado para caber o que acontece
  hoje e o próprio agora, em horas cheias e com duas horas no mínimo. Sem expediente, vai das
  07:00 às 19:00. O rótulo de hora que encostaria na hora do agora sai de cena. A folga é medida
  em pixels na largura real da régua: 46px, ou 72px para o rótulo da ponta, que se ancora para
  dentro. Em minutos, a mesma folga sobrava no monitor largo e faltava no estreito.
- **Pistas:** sem fundo próprio, na superfície do cartão (ver Colors). Cada uma abre com um fio
  de Costura que atravessa rótulo e trilho, como a linha entre as linhas da pauta.
- **Pista da clínica:** cada atendimento é uma conta do tamanho que dura, e o que acontece ao
  mesmo tempo se empilha, para o pico se ver sem ler número. A conta em atendimento se desenha
  até o agora quando passa da hora marcada. O estado mora na conta, com uma regra só: cheia é
  animal que está ou esteve na casa, e contornada é o que ainda não veio, ou não veio.
  Finalizado vai cheio na Régua de Sálvia, abaixo do resto de propósito. Em atendimento, cheio
  no ciano escuro da Clínica. Aguardando na recepção, Pêssego Cheio com contorno de 1.5px na
  tinta pêssego, a única conta cheia de cor além da que está em atendimento. Agendado, contorno
  de 1.5px no ciano escuro sobre o ciano claro. Falta, só o contorno coral. Cancelado não se
  desenha.
- **Pista do hotel:** marcas de hora e rosto, em pílula de Linho Claro com contorno na linha da
  Pervinca, ícone de entrada ou saída na tinta do Hotel e hora em 0.8125rem/700 tabular. A pista
  só tem o que falta fazer, então horário vencido é atraso, nunca passado: a marca fica com peso
  inteiro, e o contorno e a hora vão para a tinta pêssego. Movimento travado (documento na
  chegada, pesagem na saída) ganha o mesmo contorno e o ícone de aviso cheio.
- **Agora:** fio de 2px em Sálvia de Tinta Escura por cima de tudo, com a hora num rótulo cheio
  (`inicio-agora`). É o único sinal de onde o dia está: a pista não escurece o que já passou.
- **Legenda:** é o resumo. Traz cada estado que existe hoje, com a conta em miniatura (1rem ×
  0.5rem) e o número ("24 finalizados"), e o almoço com o horário. Ninguém decifra cor para
  saber o número.
- **Blocos por extenso:** em atendimento, a seguir e o movimento do hotel da vez, cada um num
  bloco, como o cartão de compromisso do calendário do Prodify. Ficam numa grade
  `repeat(auto-fit, minmax(16rem, 1fr))` com 0.75rem de vão. O bloco desce um degrau, para Linho
  Macio, com raio de 1rem e padding de 0.85rem 1rem, e é um link inteiro. Leva o rosto do animal
  (PetAvatar md) e, ao lado, três linhas. A de cima traz a amostra do estado, o que o bloco é
  ("Em atendimento", "A seguir", "Chegada atrasada") e o tempo relativo em sálvia, na tinta pêssego
  quando alguém espera ou algo atrasou. Depois vêm o título em Title, cortado com reticências, e o
  detalhe em texto de apoio, em até duas linhas. O hover vai para a sálvia clara
  (`--clinic-accent-tint`), não para um pastel: a cor fica na amostra e no tempo. Sem ninguém em
  atendimento nem por vir, uma frase diz que o dia da clínica acabou, num bloco igual, sem hover.
- **Dica:** o ponteiro sobre uma conta ou marca, e o foco numa marca, abre acima dela rosto,
  nome, hora, tipo e profissional em até duas linhas, e o estado com a amostra, ou o aviso na
  tinta pêssego.
- **Estados da pista:** carregando, um esqueleto do tamanho da pista, com o raio de controle
  (0.7rem); falha, o aviso em linha da pauta; clínica fechada, feriado, dia sem atendimento ou
  hotel sem pendência, uma frase em texto de apoio dentro da pista.
- **Movimento:** a conta que muda de estado na reconferência troca cor, tamanho e lugar em
  180 ms `ease-out`. A dica esmaece em 140 ms, e os hovers levam 150 ms. Tudo desliga com
  `prefers-reduced-motion`.
- **Por extenso para quem não vê:** as contas são desenho, fora da árvore acessível e do Tab. O
  rótulo da pista traz a faixa descrita em palavras, e o que se faz com ela são os links logo
  abaixo. As marcas do hotel, poucas, são links com nome completo; o hover delas troca a variável
  da sombra, nunca a `box-shadow` inteira, para não apagar o anel de foco (ver Ganhos e
  indicação).

### Pauta (Visão geral)

A lista de trabalho da tela. Há um grupo por módulo, com selo, contagem e atalho, e cada grupo
recolhe. A altura anima pela grade (0fr ↔ 1fr), 180 ms `ease-out`, e o que fica fechado sai do
Tab. Dentro do grupo, quatro colunas fixas (ícone de 2.25rem, assunto, gravidade, seta) valem
no cabeçalho e em cada linha, para o selo de gravidade cair sempre na mesma vertical. Cada linha
é um link inteiro até a tela onde o trabalho está: altura mínima de 3.35rem, hover em Linho
Macio, divisores em Costura. O movimento só explica mudança: a linha que entra ou sai (160 ms,
4px) e a frase que troca (esmaece).

A linha abre com o bloco do ícone, como os serviços da rotina do hotel: Phosphor duotone, uma
cor só, o desenho da coisa (ampulheta para a fila, leito para a internação, seringa para a
vacina). O bloco é um quadrado de 2.25rem com raio de controle (0.7rem) e ícone de 1.3rem,
sempre duotone. A gravidade mora no bloco, não na linha. Só o urgente é cheio, no par coral
invertido, com o fundo na tinta e o ícone no fundo do selo, no claro e no escuro. Atenção é um
bloco suave no par pêssego do selo. Normal é a sálvia clara (`--clinic-accent-tint`) com a
Sálvia de Tinta Escura. Numa lista de seis, seis blocos cheios seriam uma parede, e o urgente
deixaria de saltar.

Quando a conferência de um módulo falha, o aviso é uma linha: ícone de aviso cheio na tinta
pêssego, a frase em Tinta e "Tentar de novo" como botão de texto em sálvia. Nada pinta faixa, e
o ícone carrega a urgência. As pistas da Linha do dia falham do mesmo jeito. A pauta guarda o
que está parado. O que acontece hoje, e a que horas, é da Linha do dia, inclusive as chegadas e
saídas do hotel.

### Ganhos e indicação (Visão geral)

Um cartão só para a parceria: os ganhos em cima e, embaixo, o código que os gera. A casca é a
dos outros cartões da tela: Linho Claro, 20px, a sombra do cartão da Visão geral, sem borda, e
`overflow: hidden` para a faixa de baixo seguir o raio dele. As duas partes entram embutidas: os
ganhos perdem raio, sombra e fundo próprios, e a indicação perde raio e sombra e guarda só a
cor. Sem o programa de afiliados ativo, a faixa não entra.

A faixa de "Indique e ganhe" é a única superfície de cor da tela além do véu do topo: um degradê
a 135° do Véu de Sálvia (#E5EEEA) até uma sálvia clara (#C9E2D9); no escuro, de #1B302A a
#22403A. Por cima vai tinta escura sólida: Tinta a 10:1 ou mais, texto de apoio em #3D4F4A a
6,3:1 ou mais, ícone de pata em sálvia. Ela traz o título com o link, o código com Copiar e o
QR. O código é o maior dado da faixa e não tem rótulo (ver Typography). A frase sobre a
participação não fica na faixa: mora no painel do QR.

- **Copiar:** pílula em Linho Claro com rótulo em sálvia, 2.25rem. No hover, a sombra passa de
  `0 1px 2px` a 8% para `0 4px 12px -4px` a 24%. No escuro, a pílula é #26413A e o hover também
  troca o fundo, para #2F4D45.
- **Quadro do QR:** 4.75rem, branco puro, raio de 0.8rem, com o QR recuado 0.35rem. A sombra
  `0 6px 18px -8px` a 30% vai, no hover, a `0 10px 24px -8px` a 40%. No canto, um disco de
  Linho Claro de 1.35rem, com seta em sálvia, diz que ele amplia. O clique no quadro, ou na
  pílula "Compartilhar código" da saudação, abre o painel do QR.
- **Painel do QR:** um Drawer do PrimeVue à direita, com largura `min(100vw, 26rem)` pela prop
  `style` e fundo Linho Claro (`--clinic-surface`). De cima para baixo: o QR grande (14rem) num
  quadro branco de 20px, com o código e a instrução embaixo; as ações, "Baixar QR" cheia em
  Sálvia de Tinta Escura e "Imprimir" e "Copiar código" contornadas (ver Buttons); o link de
  indicação com "Copiar link"; as leituras do QR; e "Como funciona", com a frase da participação
  e a da janela de segurança de 14 dias. O link e "Como funciona" abrem com um fio de Costura.
- **Leituras do QR:** o `IndicacaoMetricasCard` da tela de Divulgação, com as cores dela
  (`--div-*`) apontadas para os tokens da casa. No painel, é um degrau só de Linho Macio, sem
  contorno e sem caixa dentro de caixa: o aviso de nenhuma leitura usa o mesmo fundo.
- O hover troca uma variável da sombra, nunca a `box-shadow` inteira, para não apagar o anel
  de foco do teclado.
- O tom da faixa, véu claro como está ou chapa de Sálvia Profunda, é decisão em aberto do
  usuário.

### Faixa de doses (adesão ao tratamento)

Um quadradinho por dose, uma coluna por dia, uma linha por horário do dia (07:00, 15:00, 23:00).
É a "adesão em uma linha" — desenhada, não calculada: mostra o fim de semana sem registro e a dose
da noite que fica para trás, que nenhum número mostra. Mora na aba Tratamento da ficha, no cartão
"Remédio em casa" do resumo e, compacta, na lista Tratamentos em casa
(`components/tratamento/FaixaDeDoses.vue`).

- **Estados, e só estes:** dada em sálvia (#2F8C7C, escuro #6CC9B5); pulada em pêssego
  (#AD4A13, escuro #E07B3C); sem registro no cinza do trilho vazio (#BCC7C3, escuro #3A4A44); a
  dose da vez só com contorno de 1.5px; prevista quase nada. Tokens num lugar só
  (`faixa-cores.css`), para a legenda e a faixa não divergirem.
- **Sem julgamento:** pulada nunca é vermelha — é o que a casa contou. Sem registro nunca usa cor
  de aviso — a dose pode ter sido dada. O coral fica para o alerta da clínica, fora da faixa.
- **Conferida para daltonismo:** sálvia × pêssego com ΔE 12 no claro e 14,4 no escuro. O pêssego da
  Visão geral (#FFC39F) dava 5,1 contra a sálvia escura e por isso não é usado aqui.
- **Marcas:** 10px (8px compacta), raio 2px, vão de 2px, sem contorno em volta. Em contêiner
  estreito a coluna afina até 2px em vez de vazar. A última consulta é um fio de 1px no vão.
- **Leitura:** ao passar o ponteiro, a dose diz dia, hora, situação e quem registrou. A frase ao lado
  e a tabela de registros são a versão sem cor; o leitor de tela recebe a frase inteira.
- **Legenda uma por cartão**, com a frase "Sem registro não quer dizer que não deu".

## Do's and Don'ts

### Do:

- **Do** usar sálvia como tinta (texto, ícone, seleção, trilho) e linho como papel.
- **Do** marcar urgência num chip ou ícone cheio com rótulo, deixando a linha e o cartão
  neutros.
- **Do** separar blocos com Costura (#C8B5A8) ou um degrau de linho antes de pensar em sombra.
- **Do** usar números tabulares em toda coluna de valor, horário, dose e dinheiro.
- **Do** dar a cada tela uma forma que corresponda à pergunta que ela responde.
- **Do** manter transições em 140–220 ms com `ease`, `ease-out` ou
  `cubic-bezier(0.32, 0.72, 0, 1)`, e zerá-las em `prefers-reduced-motion`.
- **Do** conferir cor de superfície amostrando o pixel da captura, não a olho.
- **Do**, na Visão geral, deixar a sombra macia declarar o cartão sozinha, sem borda junto, e
  separar o que há dentro dele por Costura e degrau de linho, como no resto do sistema.
- **Do**, na Visão geral, pôr os pastéis da paleta da casa só em selo de 6px e no bloco do ícone
  da pauta, e só com significado (coral e pêssego para gravidade, ciano e pervinca para módulo),
  com a tinta escurecida no próprio matiz até passar de 5:1.
- **Do**, na Visão geral, desenhar o tempo num cartão como os outros, com as pistas na própria
  superfície dele e separadas por fios de Costura: o estado dentro da conta, a legenda como resumo
  e o agora num fio de Sálvia de Tinta Escura, o único sinal de onde o dia está.

### Don't:

- **Don't** usar faixa de acento na borda esquerda (ou direita) de cartão, linha ou alerta.
- **Don't** pintar cartão, linha ou faixa de ponta a ponta para sinalizar estado.
- **Don't** criar barra de segmentos com muitos botões e contagens para uma ação rara.
- **Don't** transformar todo bloco em cartão com a mesma borda, raio e fundo.
- **Don't** usar cor para decorar ou para diferenciar itens do mesmo tipo.
- **Don't** clarear superfície acima de #FBF7F4 nem usar branco puro como fundo.
- **Don't** usar o creme #F5EBE0 como fundo de página — já foi recusado.
- **Don't** usar `<button>`, `<select>`, `<input>` nativos nem SVG desenhado à mão.
- **Don't** usar entrada escalonada de cartões, número que conta subindo, parallax ou hover
  que escala; nada de transição acima de 300 ms em tela de operação.
- **Don't**, na Visão geral, pintar o agora de vermelho ou coral, nem apagar como passado o que
  ainda falta fazer: numa pista de pendências, horário vencido é atraso.
- **Don't** misturar os dois acabamentos na mesma tela: uma tela está no design novo inteira
  (`.hc-tema` na raiz, diálogos incluídos) ou ainda no linho. A migração vai tela a tela, olhando
  antes e depois; o que ainda não foi migrado (Hotel, Portal do parceiro, Conta/login) não muda
  "de carona" por regra global.
- **Don't**, no design novo, voltar a fileira de quatro cartões de número acima de uma lista: o
  que é fila de trabalho vai para a frase de estado e para a pauta; o que é recorte, para o selo
  do segmento.
