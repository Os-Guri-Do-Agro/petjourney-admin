# Módulo clínico no portal web — o que foi entregue

> Companheiro de `prompt-modulo-clinico-web.md`. Este documento existe para separar o que está
> pronto do que está declarado como pendência, sem que nada pareça feature acabada por acidente.

## Dois pré-requisitos do prompt não existiam

O plano original mandava **copiar** `data/` e `domain/` do app mobile e seguir
`docs/vetmoduloclinicoimplementacao.md`. Nenhum dos dois estava disponível:

- o repositório irmão `petjourney-app` não está no disco (`c:\...\projetos\` tem só
  `petjourney-admin`, `petjourney-api` e projetos não relacionados);
- `docs/vetmoduloclinicoimplementacao.md` não existe neste repositório.

Consequência: **`data/` e `domain/` foram escritos do zero**, a partir dos contratos e das dez
armadilhas descritas no próprio prompt. Isso significa que os tipos aqui **não são
byte-a-byte iguais aos do mobile** — quando os dois repositórios voltarem a conviver, vale um
diff de `types.ts` antes de assumir compatibilidade.

## Arquitetura

```
src/features/clinico/
├── data/          types.ts · mock-runtime.ts · seed.ts · store.ts · fixtures/ · repositories/
├── domain/        clinic-time · conflicts · overlap · slots · ranges · dose · load · follow-up ·
│                  bulario (dose por espécie, avisos) · resumo (agregações do painel)
├── theme/         clinic-tokens.css (claro + escuro, densidade, zoom)
├── stores/        clinico (raiz + invalidação) · agenda · prontuario · fila
├── composables/   useClinicPrefs · useClinicFormat · useAgendaDia · useAgendaDrag ·
│                  useAgendaUrlState · useClinicShortcuts
└── components/    base/ (5 componentes + painel de dev + atalhos) · prontuario/ ·
                   agenda/ (grade, cards, criar, bloquear, mover, cancelar) ·
                   resumo/ (colunas, ranking, mapa de calor) · bulario/ (lista, ficha, seletor) ·
                   documentos/ (folha A4 comum, receituário, atestado)
```

Rotas: `/veterinario/{meu-dia,resumo,agenda,atendimentos,fila,faltas,atividades,pacientes,bulario}`,
`/veterinario/atendimento/:encounterId`, `/veterinario/paciente/:petId/historico` e
`/design/clinico`.

## Pronto e conferido no navegador

Conferido em 1280, 1024 e 768, nos modos claro e escuro:

- **Página de referência** (`/design/clinico`): os cinco componentes-base nos quatro estados,
  densidade ao vivo, os três nomes extremos, 200 linhas de cansaço, interruptor de escala de
  cinza, lista de tokens.
- **Agenda**: 40 atendimentos no dia âncora, cinco colunas visíveis, eixo de tempo, linha do
  agora, faixas de bloqueio, sobreposição em faixas, encaixe listrado, cancelado riscado e
  presente.
- **Meu dia**, **fila de espera**, **faltas**, **pacientes**, **prontuário** (anamnese, exame
  físico com faixas, diagnóstico, conduta, histórico e consulta anterior).

Quatro bugs visuais foram encontrados **olhando a tela**, não pelo type-check, e corrigidos:
peso do paciente cortado no cartão estreito; coluna numérica quebrando um caractere por linha
em 1024; bloqueio de sala pintando todas as colunas de profissional; campo desabilitado do
PrimeVue nascendo bege (o preset mapeia `surface.200` para `#F5EBE0`).

## Armadilhas do prompt: onde cada uma foi tratada

| # | Armadilha | Onde |
|---|---|---|
| 1 | Hora de parede da clínica | `domain/clinic-time.ts` — único arquivo do módulo que toca `Date` |
| 2 | Conflito como `kind` + `params` | `domain/conflicts.ts` + `useClinicFormat.conflito` |
| 3 | Status do vital recalculado | `domain/ranges.ts`, nunca persistido |
| 4 | `rngStatus` separado de `rngPos` | `data/seed.ts`, com teste dedicado |
| 5 | Reserva provisória devolvida | `data/store.ts` (expira na leitura) — **sem fluxo que a use ainda** |
| 6 | Campo/overlay claro no dark | `theme/clinic-tokens.css`, regras globais + `clinic-overlay` |
| 7 | Acento de perfil não global | acento vem de `--clinic-accent`; colunas por índice, não literal |
| 8 | Falta e cancelamento visíveis | `AgendaAppointmentCard` riscado + filtro "ocultar cancelados" |
| 9 | Bloqueio recorrente materializado | `materializarBloqueios`, com teste |
| 10 | Nada bloqueia | só `holiday-closed` é `blocking`, com teste que fixa isso |

## Revisão de usabilidade, tela por tela

Segunda passada, com o navegador aberto, atrás de um problema só: **informação demais ao mesmo
tempo**. O que mudou e por quê:

| Tela | Antes | Depois |
|---|---|---|
| **Prontuário** | Anamnese, exame, diagnóstico e conduta empilhados numa rolagem de ~2.400 px — mais de trinta campos disputando a atenção de quem está com o animal na mesa | Quatro etapas, **uma por vez**, com um passo no topo que também é o resumo: o que já foi preenchido, o que falta e o que tem alerta. Rodapé leva à etapa seguinte por `Tab`. A etapa mora na URL |
| **Anamnese** | Dez campos idênticos em duas colunas | Ordem de conversa: queixa (largura dupla) → história → sinais gerais agrupados → prevenção. "Vacinação em dia" virou escolha em linha, não `Select` |
| **Exame físico** | Cada vital ocupava dois blocos: o campo e um cartão repetindo o rótulo. Oito sistemas com `Select` + campo de nota sempre visível | Um bloco por vital, com a faixa numa linha discreta. Sistemas em escolha segmentada, e a nota **só aparece quando o achado é "alterado"** |
| **Agenda** | Doze controles em duas linhas: data, visão, agrupamento, densidade, zoom, checkbox, três botões, ajuda e fichas de profissional | Uma linha: data, visão, ação principal. Agrupamento/densidade/zoom recolhidos em **Exibição**; profissionais e situação em **Filtros**, com contador na etiqueta; encaixar/bloquear/atalhos em "mais ações" |
| **Cards da agenda** | Ícone de aviso em quase todo card | Só `warning` e `blocking` marcam o card; `info` (almoço, carga, sala) fica no drawer. Aviso que aparece sempre deixa de ser lido |
| **Cabeçalho de coluna** | "275 min ocupados", cinco vezes | Barra de ocupação + percentual; os minutos ficam no `title` |
| **Faltas** | 24 linhas, a maioria com uma falta só | Três números de resumo e a tabela **começa nos reincidentes**; "Todas" a um clique |
| **Fila** | Prioridade, situação e prazo empilhados na mesma célula | Prioridade só quando não é "normal"; situação em uma palavra; prazo destacado quando aperta |
| **Meu dia** | Blocos sem limite — a coluna de retornos chegava a 14 linhas | Quatro itens por bloco e "Ver todos (N)" para a página dona do assunto |

### Visibilidade da marcação

Passada seguinte, sobre o mesmo bloco de sistemas: a opção escolhida quase não se distinguia
das outras. O ativo era fundo `surface` sobre `surface-soft` — dois por cento de luminância de
diferença, que some numa lista de oito linhas iguais.

Agora a marcação soma **três sinais**, e nenhum deles sozinho depende de enxergar cor: anel de
1,5 px (forma), peso 800 (tipografia) e fundo próprio (cor). Vale para todos os segmentados do
módulo — barra da agenda, densidade, recorte de faltas e a página de referência.

Além disso, no exame físico a escolha passou a ter **tom por significado**: verde para o que
está normal, âmbar para o que tem achado, cinza para o que ninguém avaliou. É o que permite
varrer a coluna dos oito sistemas sem ler as vinte e quatro palavras. E o controle saiu da
borda direita para junto do nome — antes o olho percorria sessenta por cento de vazio a cada
linha.

O `ClinicToggleGroup` entrou na página de referência com os três tons, que era onde ele
deveria estar desde que virou componente-base.

### Terceira passada: o que ainda estava meia-boca

Revisão sobre a revisão, com a crítica na mão. Sete frentes:

**Nenhum filete colorido na borda esquerda.** Estavam no card da agenda, no valor de referência,
na linha selecionada da tabela e no sistema alterado — quatro lugares, mesmo truque. Filete é
decoração barata: não sobrevive a recorte, não é lido em voz e vira maneirismo quando repetido.
Cada caso ganhou o recurso certo para o que precisava dizer: o card usa moldura e fundo na cor
da coluna; o valor fora da faixa usa moldura, fundo, seta e a palavra; a linha selecionada usa
fundo e peso; o sistema alterado usa fundo âmbar.

**Vitais viraram fichas de medição.** Antes: rótulo que quebrava em duas linhas ("Frequência
respiratória · mpm"), campo pequeno e um ícone de proibido solto ao lado. Agora a unidade mora
dentro do campo, o número é grande, tabular e alinhado à direita como em prontuário de papel, e
o "não medir" é **texto** no rodapé — o ícone dizia "bloqueado" quando o que se registra é uma
decisão clínica. A ficha preenchida ganha cor; a marcada como não aferida apaga.

**Lista de diagnósticos com respiro.** Linhas coladas com um "+" minúsculo na ponta pareciam
índice, não escolha. Agora cada sugestão é uma linha de altura de tabela, com o código em
etiqueta de largura fixa e a ação escrita por extenso ao passar o cursor.

**Filtros de verdade, atrás de um botão só.** Nova `ClinicFilterBar`: busca, painel de facetas
e — o que costuma faltar — **as escolhas aplicadas visíveis em fichas removíveis**, com contagem
por opção antes de clicar. Ligada em Pacientes (espécie, alertas, com/sem horário marcado) e em
Prontuários (situação, profissional).

**"Meu dia" virou "Hoje na clínica".** O nome antigo falava do usuário; a tela fala da clínica.
O layout parou de reservar uma coluna inteira para um bloco vazio: sem pendência, o bloco
encolhe até o próprio título, com moldura tracejada e uma marca de "nada aqui". Cada bloco
ganhou ícone e contagem.

**Agenda mais calma.** "ALMOÇO" aparecia cinco vezes na mesma faixa horizontal — agora é uma
faixa só atravessando a grade, com o rótulo no eixo de tempo. Os limites de altura do card
foram recalculados contra o que cada linha ocupa de fato: a consulta de 30 minutos, que é o
card mais comum, voltou a mostrar o tipo do atendimento sem corte. O rodapé deixou de repetir a
hora de início, o que espremia "Finalizado" em "Finaliza…". Atendimento finalizado perde
saturação: é história do dia, não tarefa.

**Marcação visível em todo segmentado.** Anel, peso 800 e fundo próprio, somados; e tom por
significado onde o significado existe (verde/âmbar/cinza nos sistemas, cinza/âmbar/vermelho na
prioridade).

### Prontuário em PDF (A4)

Botão **"Salvar em PDF"** no cabeçalho do atendimento. Sai por `window.print()`; o destino
"Salvar como PDF" do navegador faz o arquivo.

**Sem biblioteca de PDF.** Seriam algumas centenas de kB no bundle para reproduzir o que o
navegador já faz — e, pior, um segundo motor de layout para manter alinhado com o primeiro. O
que existe é uma folha dedicada, `ProntuarioImpressao.vue`, com `@page { size: A4 portrait }`.

**Não é a tela impressa: é outro documento.** A tela serve para preencher, com etapas, botões e
histórico ao lado. O papel serve para ser lido inteiro, arquivado e assinado. A folha é
teleportada para o `body`, e a regra de impressão esconde todo o resto com um seletor de filho
direto — sem isso, imprimir daria páginas de interface e nenhuma de prontuário.

Decisões que vêm de documento clínico, não de interface:

- **Preto sobre branco, medidas em milímetros.** O papel não tem modo escuro nem a densidade
  que a pessoa escolheu na tela; nenhum token `--clinic-*` atravessa. `color-scheme: light`
  impede o navegador de entregar a versão escura à impressora.
- **`não aferido` sai escrito**, na coluna de valor. É a razão de o campo existir: se sumisse
  no papel, o prontuário passaria a dizer que ninguém mediu quando alguém decidiu não medir.
- **A dose sai por extenso**, como na tela — é o texto que o responsável lê em casa.
- **Rascunho é carimbado.** Prontuário sem fecho não pode circular parecendo definitivo.
- **Só o que foi registrado é impresso.** Campos em branco não viram meia página de
  dois-pontos vazios; seção sem conteúdo diz "não registrado" em vez de ficar um título mudo.
- Rodapé com linha de assinatura, nome e conselho do responsável técnico, e data de emissão.

Verificado imprimindo de verdade: `Emulation.setEmulatedMedia({ media: 'print' })` via CDP para
capturar a folha, e `--print-to-pdf` para confirmar o resultado — uma página com o documento,
contra duas de interface quando a regra de impressão é desligada. Conferidos o rascunho (com
carimbo) e um atendimento finalizado (tabela de vitais com faixa e situação, sistemas,
diagnóstico, conduta).

O bloco de prescrição, que na primeira entrega nunca tinha chegado ao papel por falta de dado,
foi conferido impresso depois da passada de completude descrita abaixo: sai com nome comercial,
via, volume, miligramas por administração, intervalo, duração e total de administrações.

### Correções que vieram junto

Bugs, não preferências:

- **"Agenda parada · 1 dias"** — converter duração total para dias arredondava fora a precisão
  que dava sentido ao número, e quebrava o plural. Agora duração é sempre h/min; só *distância
  no tempo* vira dias, e com plural correto.
- **"Sexta-Feira, 21 De Agosto"** — `text-transform: capitalize` maiusculiza toda palavra. Em
  português só a primeira sobe.
- **Peso do paciente cortado** em cartão estreito. Resolvido com container query em vez de
  depender do arredondamento do flex: o cabeçalho decide o arranjo pela largura que recebeu.

E uma correção no gerador: ele dava a mesma sala a todos os banhos do dia e o mesmo paciente a
horários sobrepostos, então a grade **nascia** com conflito em quase todo card. Agora respeita
ocupação de sala e de paciente, e os avisos que sobram são os casos plantados de propósito.

## Quarta passada: nenhuma lista vazia na demonstração

Pedido: *"nas informações de demonstração mocadas, não deixa nenhuma lista vazia, quero
verificar tudo que tem disponível"*. Estado sem exemplo é estado que ninguém revisa — e o que
ninguém revisa chega quebrado no primeiro cliente que o encontrar.

Virou contrato executável, não inspeção manual: `data/__tests__/dataset-completo.spec.ts`
regenera o dataset **às 8h, 15h e 22h** — metade destes estados nasce do relógio — e cobra os
sete status de atendimento, os cinco motivos de bloqueio, os quatro estados da fila, as seis
espécies, os seis tipos de alerta, os três tipos de diagnóstico, os cinco tipos de evento da
linha do tempo, as seis origens, vitais fora da faixa e não aferidos, sistema alterado com
nota, prescrição, exame pedido e retorno indicado.

O que o contrato encontrou e foi corrigido no gerador:

- Nenhuma consulta finalizada saía com prescrição — o bloco mais delicado do prontuário, com
  dose calculada e conferência de alergia, não existia em nenhum lugar do dado.
- O caso da alergia estava só *alcançável*: a rota abria um rascunho vazio e o conflito que dá
  nome ao caso não existia. Agora nasce com a prescrição em conflito **por confirmar**.
- Nenhuma cirurgia, vacina ou exame na linha do tempo: três dos sete ícones não tinham
  ocorrência para revisar.
- Às 22h o dia âncora não tinha mais nada "agendado", e não deve mesmo ter — o contrato exige
  os sete estados no dia âncora **durante o expediente**, e fora dele exige apenas que sigam
  alcançáveis no dataset. Dado falso não resolve lista vazia.

E o excesso, que é o mesmo defeito pelo avesso: com todo retorno do histórico contando como
esquecido, "Retornos sem horário" abria com **84 linhas**. Retorno cujo paciente voltou depois
passou a apontar para a volta — vínculo real, não invenção — e o contrato agora fixa piso *e*
teto (entre 4 e 20). A caixa de pendências virou três colunas: empilhada, a tela larga jogava
"Marcar retorno" a um palmo do nome do paciente.

Junto vieram quatro correções de conteúdo:

- **Toda consulta terminava com a mesma frase** sobre dieta leve — inclusive as de otite e as
  de displasia. Doze repetições na linha do tempo de um paciente anunciavam dado de mentira
  antes de qualquer outra coisa. Agora a orientação é escrita para cada diagnóstico.
- **"Cirurgia — Dermatite alérgica a pulgas".** Cirurgia sorteava do catálogo inteiro; passou a
  sortear entre os diagnósticos locomotores.
- **A coluna do histórico dizia DIAGNÓSTICO e mostrava o tipo** ("Consulta", "Retorno"), que já
  se deduz do horário. Virou "Atendimento", com o diagnóstico real na segunda linha.
- **"17.54 mg · 8 h · 5 d"** no painel de consulta anterior: ponto no lugar da vírgula e sem
  dizer de que remédio se tratava — justamente o que o painel existe para lembrar.

E uma correção visual na agenda: a linha do "agora" passava **por cima** dos cards e caía no
meio da segunda linha de texto do atendimento em curso, deixando o nome do serviço tachado — a
marca de "cancelado" na única consulta que está acontecendo. A linha foi para trás dos cards; o
selo AGORA continua no eixo, acima de tudo.

## Duas telas novas: resumo da clínica e bulário

### Resumo da clínica — `/veterinario/resumo`

Painel de atividade com filtro de período (hoje, esta semana, semana passada, 30 dias),
profissional e tipo de atendimento. Quatro indicadores no topo, quatro visualizações abaixo:
movimento por dia (colunas empilhadas com a linha de ocupação), distribuição por tipo, carga por
profissional, mapa de calor de hora × dia da semana e ranking de diagnósticos.

Três decisões que valem registro:

- **Cancelado não entra na taxa de comparecimento.** Quem avisou liberou o horário; quem não
  apareceu queimou. Somar os dois faz o número parecer pior do que é, e clínica que desconfia de
  um número do painel para de olhar o painel.
- **Ocupação é média dos dias abertos.** Domingo e feriado fora do divisor — incluí-los derruba a
  média e faz a semana cheia parecer folgada.
- **Filtrar por profissional também divide a capacidade por um.** Dividindo pela capacidade da
  equipe inteira, a ocupação caía para um quinto e o painel dizia "clínica vazia" no dia mais
  cheio da agenda de alguém. Tem teste.

**Sem biblioteca de gráfico.** Um gráfico de barras é vinte linhas de matemática; a biblioteca
traria tema próprio, tooltip próprio e um segundo conjunto de cores para manter sincronizado com
o claro/escuro do painel. O que ela resolveria de verdade — escalas complexas, zoom, séries
longas — este painel não pede.

As barras são CSS e só a poligonal é SVG. A primeira versão desenhava tudo em SVG com
`preserveAspectRatio="none"`: o desenho esticava na horizontal e os pontos da linha viravam
elipses achatadas. Um segundo defeito veio junto — SVG é elemento substituído, então posicionado
com `left: 0` e `right: 0` e `width: auto` ele assume a largura intrínseca em vez de esticar, e a
linha inteira nascia comprimida dentro da primeira coluna.

O mapa de calor **não fala só por cor**: cada célula carrega o número. Mapa que depende de matiz
exclui quem não distingue verde de âmbar e morre impresso em preto e branco.

### Bulário eletrônico — `/veterinario/bulario`

Dezesseis fármacos com classe, apresentação, receituário de controle, vias, indicações,
contraindicações, efeitos adversos, interações e **faixa de dose por espécie**. Lista à esquerda
com busca e filtros, ficha à direita.

A busca varre nome comercial, princípio ativo **e indicação**: quem está com um cão com otite na
mesa procura "otite", não "enrofloxacina". Bulário que só casa pelo nome do remédio serve a quem
já sabe a resposta.

A ordem das seções da ficha é a ordem em que a decisão acontece: primeiro o que impede — avisos
deste paciente e contraindicações —, depois a dose, depois o resto. Bula que abre pela
apresentação e esconde a contraindicação três blocos abaixo é bula que ninguém rola até o fim.

**O modelo de dose mudou.** `Medication.doseUsualMgKg` era uma faixa única; agora existe
`doses[]` por espécie, e ela tem precedência. O motivo é clínico: a manutenção felina de
meloxicam é cerca de um quinto da canina, carprofeno não tem dose repetida segura em gato,
enrofloxacina em felino tem teto rígido de 5 mg/kg/dia pelo risco de cegueira irreversível, e
betalactâmico oral em roedor herbívoro é contraindicação de espécie, não dose alta. `avaliarDose`
passou a receber a espécie: conferindo 0,1 mg/kg de meloxicam contra a faixa geral, a tela dava o
**dobro** da dose felina de manutenção como "dentro do usual" e não dizia nada.

### O vínculo com o prontuário

O campo de medicamento da conduta ganhou um botão que abre o bulário em diálogo, com a mesma
lista e os mesmos filtros. Ao escolher, ele devolve **medicamento, dose, intervalo e duração da
espécie do paciente**, e o cálculo refaz a conta inteira. Trocar só o identificador — o que o
`Select` fazia — deixava o mg/kg da escolha anterior no campo: sair de meloxicam canino para
carprofeno mantinha 0,1 mg/kg, que é vinte vezes menos que a dose do carprofeno.

A sugestão é sempre o **mínimo** da faixa. Subir dose é decisão consciente; começar pelo teto
transforma campo pré-preenchido em recomendação.

Três novos avisos entraram na prescrição, ao lado do de alergia que já existia:

- **Espécie proibida** — em vermelho, e o botão do diálogo troca para "Prescrever mesmo assim".
- **Cuidado casado com o alerta do paciente** — condição renal registrada + AINE, gestação +
  metronidazol, cardiopatia + acepromazina. O encontro é por texto do alerta: a clínica escreve
  "Doença renal crônica" e é essa palavra que liga ao cuidado `renal` do bulário.
- **Sem dose da espécie** — diferente de "pode qualquer dose".

Nada bloqueia a prescrição. Bloquear empurra a decisão para fora do sistema; o que a tela garante
é que ninguém decide sem ver.

A ficha traz a isenção em todas as línguas: é conteúdo de apoio à decisão e não substitui a bula
do fabricante nem a avaliação do responsável técnico.

### Conferido

Fluxo ponta a ponta no navegador: abrir a conduta com Dipirona a 20 mg/kg a cada 8 h, escolher
Meloxicam no bulário e ver o formulário virar 0,1 mg/kg a cada 24 h com o resumo recalculado —
"0,32 mL (0,6 mg) a cada 24 h por 5 dias" para uma paciente de 6,4 kg. As duas telas foram
capturadas em claro e escuro; o bulário também com paciente na URL, mostrando o aviso renal de
Tofu e a linha felina destacada.

**41 testes novos de domínio** cobrem as contas do painel (intervalo de período, comparecimento
sem cancelados, ocupação por equipe filtrada, dias fechados fora do divisor, agrupamentos) e as
regras do bulário (dose por espécie, espécie proibida, casamento de alerta com cuidado, filtros,
busca por indicação).

## Quinta etapa do prontuário: resumo e documentos

O prontuário terminava na conduta. Só que **a consulta não termina quando o registro termina**:
o responsável sai da clínica com papel na mão — receita para comprar o remédio, atestado para
justificar a ausência no trabalho, o prontuário para levar a um especialista. Até aqui havia um
botão "Salvar em PDF" que emitia o prontuário inteiro e mais nada.

O stepper ganhou uma quinta etapa, **Resumo**, com duas partes: a conferência do que foi
registrado e os documentos emitíveis.

### O resumo

Data, queixa, diagnósticos com o tipo, **achados fora da faixa** (vitais alterados e sistemas com
nota), prescrições com a dose por extenso, exames pedidos e prazo de retorno. É de leitura, não
de edição: quem chega aqui está conferindo antes de assinar, e campo editável no meio da
conferência convida a mexer no que já foi decidido.

Prescrição em conflito com alergia sem aceite aparece **antes** dos documentos, em vermelho.

O estado do passo espelha o atendimento inteiro — "alerta" enquanto houver conflito de alergia
pendente, "completo" quando as quatro etapas anteriores estiverem completas. Contar campos
próprios daria a um passo de leitura uma barra de progresso que ele não tem como encher.

### Os quatro documentos

Todos em A4, preto sobre branco, sobre a mesma casca `DocumentoFolha` — cabeçalho com clínica e
responsável técnico, identificação de paciente e responsável, rodapé de assinatura. Três folhas
repetindo essa moldura por conta própria significariam três lugares para atualizar quando o CRMV
mudar a exigência de um campo, e três chances de esquecer um.

1. **Prontuário completo** — o que já existia.
2. **Receituário** — nome comercial, apresentação, **quantidade a dispensar**, via e posologia por
   extenso ("0,61 mL (1,2 mg) a cada 12 h por 5 dias — 10 administrações"), mais as orientações ao
   responsável.
3. **Atestado de saúde** — declara o exame na data e **o que o prontuário registra**.
4. **Atestado de comparecimento** — declara que o responsável esteve na clínica, com hora de
   entrada e de saída, para justificar a ausência no trabalho.

**Medicamento sob controle especial sai em folha separada e em duas vias.** Não é preferência de
layout: a Portaria SVS/MS 344/98 exige receituário próprio, com retenção de uma via na farmácia,
endereço completo do prescritor e identificação de comprador e fornecedor. Misturar dipirona e
tramadol na mesma folha faz a farmácia reter o papel inteiro — e o responsável vai embora sem a
receita do resto. O componente emite até três folhas da mesma conduta: a simples, a 1ª via de
controle e a 2ª via.

Os campos de comprador e fornecedor saem **em branco**, com linha para preencher: quem preenche é
a farmácia no ato da dispensação, e imprimir preenchido inventaria um dado que a clínica não tem.
A finalidade do atestado também fica em branco, pelo mesmo motivo — o motivo do papel raramente é
o motivo do atendimento.

### Duas correções que o papel cobrou

**O atestado citava diagnóstico diferencial como constatação.** Diferencial é hipótese em
investigação: atestar "constatei displasia coxofemoral" quando a displasia está registrada como
diferencial afirma no papel algo que o prontuário não afirma. Agora só definitivo e presuntivo
entram no atestado.

**A data saía sem o ano.** `dataLonga` produz "segunda-feira, 24 de agosto" — bom para a tela, em
que o dia da semana situa quem olha a agenda de hoje. Num documento assinado o dia da semana é
ruído e a ausência do ano é defeito: o papel circula meses depois e precisa dizer sozinho a que 24
de agosto se refere. Entrou `dataPorExtenso`, e as três folhas passaram a usá-la.

Junto disso, `Clinic` ganhou `endereco` e `telefone`. Não é enfeite de cabeçalho: sem o endereço
do prescritor a farmácia recusa a retenção do receituário de controle especial. Antes a folha
imprimia uma frase descrevendo o que deveria estar ali — instrução vazando para dentro do
documento.

### Conferido

As quatro folhas foram capturadas com o navegador em mídia de impressão, incluindo o caso de
controle especial: troquei a prescrição para Tramadol pelo seletor do bulário e conferi as duas
vias, com os carimbos "1ª via — retenção da farmácia" e "2ª via — orientação ao responsável", os
blocos de comprador e fornecedor e o aviso da Portaria.

**Não verificado:** conformidade formal com as exigências do CRMV de cada estado. O layout segue
os campos que o receituário e o atestado veterinário costumam exigir, mas a validação é do
responsável técnico da clínica antes de a primeira via circular.

## Criação de atendimento e bloqueio — os três botões mortos

Estavam declarados como pendência: "Novo atendimento", "Encaixar" e "Bloquear horário" — e os
atalhos `N`, `E`, `B` — chamavam um `aindaNaoImplementado()` que só fechava a ajuda. Agora
existem os dois diálogos que faltavam.

**`AgendaCriarDialog`** serve criação e encaixe: encaixe não é outro tipo de agendamento, é o
mesmo agendamento assumindo que vai passar por cima da carga do dia. O tipo de atendimento manda
na duração e nas salas compatíveis — escolher "Cirurgia" muda os dois sem ninguém digitar nada.

Três coisas que o formulário faz e um formulário genérico não faria:

- **O conflito aparece enquanto se escolhe, não ao salvar.** Trocar profissional ou hora recalcula
  os avisos na hora. Descobrir a sobreposição depois de apertar "Agendar" é descobrir na frente do
  responsável que já está no telefone.
- **Nada bloqueia.** Sobreposição, sala ocupada, paciente com dois horários, fora do expediente —
  tudo segue agendável. O que muda é o texto do botão, que passa a ser "Agendar mesmo assim".
  Regra que proíbe vira regra contornada no papel, e a clínica encaixa a emergência de qualquer
  jeito.
- **Havendo choque, a caixa oferece horários livres do mesmo dia.** É a diferença entre "não pode"
  e "pode às 11:30" — a informação que a recepção precisa para responder na hora. Isso liga o
  `buscarAlternativas` de `domain/slots.ts`, que estava escrito e testado sem nenhuma tela.

Clicar numa faixa vazia da grade abre o formulário **já naquele profissional e naquela hora**: é o
caminho que a recepção usa de verdade, olhando o buraco na agenda em vez de digitar um campo.

**`AgendaBloquearDialog`** cobre almoço, reunião, manutenção, folga e férias. Duas escolhas ficam
explícitas em vez de escondidas: bloqueio sem profissional é da clínica inteira (manutenção do
raio-x não é folga de ninguém), e recorrência é escolha de dias da semana, não uma data que se
repete — é o que impede a agenda de encher de cópias.

### Cadastro de paciente dentro do agendamento

Alguém liga, o bicho não está na base. Sair do formulário para cadastrar em outra tela e voltar
perde o horário que estava sendo escolhido — então o cadastro acontece **dentro** do diálogo.

Não é um segundo modal empilhado: é o mesmo diálogo trocando de conteúdo. Modal sobre modal
esconde o contexto ("eu estava marcando para quando mesmo?") e, no fechar, é comum voltar dois
passos em vez de um. O atalho fica no rodapé da lista de pacientes aberta — exatamente onde o olho
está no instante em que a busca não devolve nada.

O formulário pede **o mínimo para o atendimento acontecer**: nome, espécie e alguém por quem
chamar. Nascimento e peso são opcionais e rotulados como tal — quem liga para marcar raramente
tem os dois na mão, e campo obrigatório que ninguém sabe responder é campo preenchido com
qualquer coisa. O responsável pode ser um já cadastrado: cliente antigo com bicho novo é o caso
comum, e recadastrar a pessoa criaria um segundo cadastro com o mesmo telefone.

Três mudanças de modelo vieram junto:

- **`Pet.nascimento` virou opcional.** E o bulário respeita isso: sem data, `idadeEmMeses` devolve
  nulo e os cuidados "filhote" e "idoso" **não são afirmados**. Cuidado que parece conferido e não
  foi é pior que cuidado ausente, porque quem lê a tela assume que alguém olhou. Tem teste.
- **Pacientes e responsáveis saíram da fixture para o dataset.** Fixture é constante de módulo;
  empurrar um cadastro novo para dentro dela vazaria entre regenerações do seed e entre testes.
- **`todosOsPets()` devolve cópia.** Devolvendo a array viva do dataset, cadastrar mutava em lugar:
  a store reatribuía a **mesma referência**, o Vue não via mudança e o paciente recém-criado não
  aparecia na lista. De quebra, quem recebia a array podia alterar o dataset sem passar pelo
  repositório.

### Diálogos do módulo no modo escuro

Os três diálogos novos — criar, bloquear e o seletor do bulário — usavam `clinic-overlay` no root,
quando a convenção do módulo é `clinic-dialog`. No escuro isso deixava título, botão de fechar e
"Cancelar" invisíveis: o `Dialog` do PrimeVue pinta cabeçalho e rodapé pela escala `surface`, que
o tema escuro inverte.

Junto disso, uma regressão da passada anterior: a regra de `:disabled` que eu havia adicionado
trocava a cor do texto mas mantinha o fundo sage cheio do botão primário — cinza apagado sobre
sage dá 1,4:1. Desabilitado agora perde o preenchimento junto, que é o que faz o estado ser
reconhecido antes de alguém tentar clicar.

Conferido com a auditoria de contraste rodando **com o diálogo aberto**: zero achados nos três,
fora o botão primário do app inteiro (branco sobre `#84C1B4`, 2,05:1), que é igual nos dois temas
e também no portal.

### Conferido no navegador

Fluxo ponta a ponta: 40 cartões na grade, abrir o diálogo, escolher paciente, ver os quatro avisos
de conflito e as quatro alternativas, mover o horário e ver os avisos trocarem para "fora do
expediente", confirmar — 41 cartões, com o novo card na coluna certa. O bloqueio recusou a janela
invertida com mensagem e botão desabilitado, e criou a faixa quando corrigida. Os três atalhos de
teclado abrem o diálogo certo, com o encaixe já marcado.

**Continua pendente:** a reserva provisória (`criarReserva`/`liberarReserva`) segue sem uso — o
formulário não segura o horário enquanto está aberto, então duas recepcionistas na mesma clínica
podem chegar ao mesmo slot. Com a camada mocada isso não acontece; com API de verdade, acontece.

## Sétima passada: profundidade, e os cinzas que estavam medidos errado

O pedido foi "a borda do modal está esquisita" mais "dá mais vida às telas e aos modais". As
duas coisas acabaram na mesma raiz: o módulo tinha os tokens de relevo e de acento definidos e
quase não os usava — e dois deles estavam simplesmente errados.

**A borda.** `.clinic-dialog.p-dialog` tinha `border-radius` sem `overflow: hidden`. Cabeçalho e
rodapé pintavam fundo quadrado por cima dos quatro cantos arredondados. Não era ilusão de
escala: eram quatro retalhos quadrados, exatamente onde foram circulados.

**O acento era cinza.** No tema claro, `--clinic-accent-tint` valia `#eef3f1` — byte a byte o
mesmo que `--clinic-surface-sunken`. Trinta e dois lugares pediam destaque de acento e recebiam
cinza: chip de contagem, linha de tabela selecionada, item escolhido no bulário, ladrilho do
indicador em tom `acento`. Nenhum estava quebrado; todos estavam invisíveis. O tema escuro
nunca teve o problema — lá os dois valores sempre foram distintos.

**Os cinzas de texto estavam abaixo do mínimo.** Medidos, não olhados:

| token | antes | depois | onde aparece |
| --- | --- | --- | --- |
| `--clinic-faint` | 2,24:1 | 5,61:1 | todo rótulo de seção, cabeçalho de tabela, data secundária |
| `--clinic-muted` | 4,50:1 | 7,60:1 | texto de apoio (desceu junto, para a hierarquia não inverter) |
| `--clinic-risk-text` | 3,57:1 | 5,61:1 | **"Contraindicado nesta espécie"** |
| `--clinic-attention-text` | 3,14:1 | 5,65:1 | avisos de cuidado do bulário |

O vermelho de risco é o caso que incomoda: ele carrega o texto de maior consequência clínica do
bulário inteiro e era o menos legível da tela. `faint` foi escolhido para fechar 4,5:1 sobre o
fundo **mais escuro** em que cai (o tint de acento), não só sobre branco — foi o que a primeira
tentativa errou.

**Uma regressão minha, encontrada pela auditoria.** O tint mais saturado derrubou
`--clinic-accent-strong` sobre ele para 4,35:1. Escureceu para `#456a60` e fechou 5,10:1.

**Mapa de calor.** A célula de nível 3 dava 3,01:1 no claro e 2,49:1 no escuro. Escurecer o
fundo até o branco fechar apagaria a distância para o nível 4, e um mapa de quatro degraus com
dois degraus iguais deixa de ser mapa. Quem inverte é o texto — com `--clinic-heat-ink`, a única
tinta do módulo que **não** acompanha o tema, porque o fundo daquela célula também não acompanha
(é sálvia média nos dois).

**O que ganhou relevo e âncora.** `--clinic-shadow-card` passou de 6% a duas camadas e chegou às
14 superfícies de cartão que antes eram só contorno de 1px. Cabeçalho de cartão, de pilha e de
diálogo ganharam ladrilho de ícone — o mesmo padrão nos três lugares. `ClinicStat` separou
"pertence à paleta" de "está em destaque": o neutro nasce no tint, o tom `acento` sobe para o
soft com valor colorido. Os tons de sinal (`atencao`, `risco`) não mudaram: cor que significa
alguma coisa continua sendo só deles.

**O diálogo.** Cantos corrigidos, faixa de cabeçalho e de rodapé sobre `surface-soft` com fio de
1px, máscara escurecida com desfoque, entrada de 160 ms respeitando `prefers-reduced-motion`, e
`padding-top` devolvido ao conteúdo — o PrimeVue zera o de cima no cabeçalho e no rodapé, herança
de um tema sem faixa.

**Auditoria depois da passada:** módulo clínico em **zero** achados abaixo de 4,5:1, nos dois
temas, em resumo, bulário e atividades.

**Fora do módulo, não tocado.** Cinco achados persistem em toda tela do painel e pertencem ao
app shell, não à clínica: subtítulo do `PartnerPageFrame` (2,08:1), dois rótulos do cabeçalho e
do navegador (2,95:1), o selo "Em breve" e a inicial do avatar (3,07:1). Some-se o botão
primário branco sobre `#84C1B4` (2,05:1), que já estava sinalizado. São componentes
compartilhados com o portal: mexer neles muda telas fora do escopo deste trabalho, e isso é
decisão de quem toca o portal.

## Declarado como pendente — não está pronto

Estas partes **não foram implementadas**, e o caminho até elas existe sem o destino:

1. **Melhores alternativas na visão de semana.** `domain/slots.ts` calcula e está testado; não
   há tela que apresente.
2. **Comparação campo a campo entre dispositivos.** O bloqueio de edição, o aviso de leitura e
   a transferência explícita funcionam. A tabela de comparação "nesta tela × no servidor"
   ainda não existe — as chaves de tradução estão criadas, a interface não.
3. **Agendar o retorno direto do prontuário.** O botão leva à agenda com o atendimento em
   foco; ele ainda não cria o agendamento (depende do item 1).
4. **Compartilhamentos** (`/veterinario/compartilhamentos`) segue como `ClinicalFeaturePlaceholder`.
   É outra feature, com contrato próprio em `11-13-prontuario-acesso-temporario-portal.md`.

## Medido versus não medido

- **Não medido:** "primeiro paint abaixo de 400 ms" e "60 fps com 40 atendimentos". A grade foi
  construída para isso (posição por transformação de minutos, virtualização do eixo acima de
  100 linhas, sem watcher por card), e no navegador a rolagem parece fluida — mas **nenhum
  número foi coletado**. Tratar como não verificado.
- **Não feito:** revisão por alguém que opera clínica de verdade. A seção de feedback em
  `/design/clinico` está lá, vazia, esperando. O checklist do épico A trata isso como
  bloqueante, e continua bloqueante.
- **Verificado por teste automatizado:** 118 testes do módulo — tempo de parede, conflitos,
  materialização de recorrência, empacotamento de sobreposição, faixas, dose e carga, o teste
  de fumaça que fixa os 40 atendimentos e os 12 casos difíceis, e o contrato de completude do
  dataset em três horários do dia. Suíte inteira do projeto: 307 testes, 32 arquivos.

## Como revisar sem backend

O módulo roda inteiro sem API. O **painel de desenvolvimento** (canto inferior esquerdo, só em
dev) sobe latência, força erro por operação, derruba tudo, desloca o relógio, recria os dados
com outra semente, simula o segundo dispositivo e **pula direto para cada um dos 12 casos
difíceis**.

Para conferir o modo escuro ou a página de referência sem passar pelo login, recrie um entry
temporário na raiz (`design-check.html` + `src/design-check.ts` montando `pages/design/clinico.vue`),
suba com `npx vite --port 5199` e capture com `chrome --headless=new --screenshot`. Os arquivos
usados nesta entrega foram removidos de propósito: um deles semeava sessão falsa no
`localStorage` e não pode existir num repositório que se publica.

## Portões

`npm run type-check`, `npm run lint`, `npm run check:i18n` e `npm run test:unit` passam:
**307 testes em 32 arquivos**, oxlint e eslint limpos, quatro catálogos em paridade.
