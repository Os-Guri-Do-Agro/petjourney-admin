---
version: 1
slug: "src-pages-accounts-inicio-vue"
primary_target: "src/pages/(accounts)/inicio.vue"
related_targets: []
---

# Visão geral (/inicio)

## Escopo e modo

Tela inicial do portal, modo Operate. Só esta tela recebe o visual novo; menu lateral e demais telas
ficam como estão até o usuário aprovar o resultado.

## Audiência, tarefa, conteúdo

Equipe que opera o dia (clínica, hotel) e dono do negócio parceiro. Tarefa: ver o que está parado
por módulo, quanto a parceria rendeu, e agir com um clique. Conteúdo real: pendências dos
contadores (clínica, hotel), carteira (liberado, retido, sacado, capacidade de saque), código e QR
de indicação. Nada inventado.

## Direction contract

THESIS: a home de trabalho com o acabamento do Prodify, na paleta da casa. Logo abaixo da
saudação, a Linha do dia desenha o dia como um dia — quando cada coisa acontece, e onde está o
agora —; a pauta é a lista de trabalho principal, agrupada por módulo como a lista de tarefas do
Prodify. Recusa o painel de cartões de métrica iguais.

OWN-WORLD: linho #F0EAE3 com véu só de sálvia no topo; cartões linho claro #FBF7F4, raio 20px,
sombra suave e sem borda; selos pastel com significado e raio 6px — identidade de módulo (ciano =
Clínica, pervinca = Hotel) e gravidade (coral = urgente, pêssego = atenção, neutro = normal), com a
tinta de cada par escurecida no próprio matiz até passar de 5:1; tinta sálvia nos destaques; Phosphor
duotone; um único card de cor, "Indique e ganhe", no Véu de Sálvia descendo para sálvia clara, com
tinta escura sólida. Nenhum pastel como fundo ou enfeite. A Linha do dia não é cartão: corre direto
no fundo, com o campo das pistas num degrau de linho; cada atendimento é uma conta do tamanho que
dura, com o estado na própria conta e só com significado (contorno ciano = agendado, ciano escuro =
em atendimento, pêssego cheio = aguardando na recepção, contorno coral = falta, cinza-sálvia =
finalizado, na Régua de Sálvia); o passado é um degrau mais fundo do próprio linho e o agora é um
fio sálvia, nunca vermelho; a conta em atendimento se desenha até o agora; as marcas do hotel levam
hora e rosto do animal, e como a pista só tem o que falta fazer, horário vencido é atraso — marca
inteira, hora em pêssego —, nunca passado apagado. A linha por extenso leva o rosto de quem nomeia.

STORY: em segundos a pessoa sabe o que pede ação em cada módulo e quanto tem liberado; cada linha e
cada pílula levam direto ao trabalho.

FIRST VIEWPORT: data pequena; "Olá, {parceiro}" em 32px; linha-resumo dinâmica em sálvia (28px, peso 500);
fileira de pílulas de ação; a Linha do dia de ponta a ponta — "Hoje" com a contagem do dia, régua
de horas, pista da clínica com as contas empilhadas pelo que acontece ao mesmo tempo, pista do
hotel com chegadas e saídas, o fio do agora, a legenda que é o resumo por estado e, por extenso, em
atendimento / a seguir / próximo movimento do hotel —; grade larga com a pauta à esquerda (1.5fr, grupos recolhíveis com
colunas Assunto e Gravidade) e, à direita, Ganhos de indicação (valor em destaque) sobre o card
"Indique e ganhe" (código grande sem rótulo, Copiar, QR em quadro branco que amplia numa janela com Baixar e
Imprimir). Uma coluna: pauta, ganhos, indique.

FORM: referência pinada pelo usuário (capturas do Prodify); sem sorteio de conceito. Code-led: sem
geração de imagem nesta sessão.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Decisões em aberto

- Levar o visual ao menu lateral, ao cabeçalho e às demais telas (depende da aprovação desta).
- Fonte própria do portal (hoje, a do sistema).
