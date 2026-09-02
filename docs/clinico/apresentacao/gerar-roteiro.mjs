import fs from 'node:fs'
import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  HeadingLevel,
  PageBreak,
  PageNumber,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx'

// ---------------------------------------------------------------- paleta

const VERDE = '456A60'
const VERDE_CLARO = 'E2EFEB'
const VERDE_LINHA = 'D6E9E2'
const TINTA = '1F2F2B'
const CINZA = '5F716B'
const AMBAR = '8A6D1F'
const AMBAR_BG = 'FBF3E2'

// ------------------------------------------------------------- helpers

/** Converte **negrito** em TextRuns, preservando o resto. */
function runs(texto, base = {}) {
  return texto.split(/(\*\*[^*]+\*\*)/g).filter(Boolean).map((parte) => {
    const forte = parte.startsWith('**') && parte.endsWith('**')
    return new TextRun({ ...base, text: forte ? parte.slice(2, -2) : parte, bold: forte || base.bold })
  })
}

function p(texto, opts = {}) {
  return new Paragraph({
    spacing: { after: opts.after ?? 140, line: 276 },
    alignment: opts.alignment,
    children: runs(texto, { size: opts.size ?? 21, color: opts.color ?? TINTA, italics: opts.italics }),
  })
}

function h1(texto) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 360, after: 180 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: VERDE_LINHA, space: 6 } },
    children: [new TextRun({ text: texto, bold: true, size: 30, color: VERDE })],
  })
}

function h2(texto) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 260, after: 120 },
    children: [new TextRun({ text: texto, bold: true, size: 24, color: TINTA })],
  })
}

/** Cabeçalho de ato: título + tela + tempo, numa linha só. */
function ato(numero, titulo, tela, tempo) {
  return [
    new Paragraph({
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 320, after: 40 },
      children: [
        new TextRun({ text: `Ato ${numero}  ·  `, bold: true, size: 26, color: VERDE }),
        new TextRun({ text: titulo, bold: true, size: 26, color: TINTA }),
      ],
    }),
    new Paragraph({
      spacing: { after: 160 },
      children: [
        new TextRun({ text: tela, size: 19, color: CINZA, font: 'Consolas' }),
        new TextRun({ text: `     ${tempo}`, size: 19, color: CINZA, bold: true }),
      ],
    }),
  ]
}

function bullet(texto, nivel = 0) {
  return new Paragraph({
    bullet: { level: nivel },
    spacing: { after: 90, line: 264 },
    children: runs(texto, { size: 21, color: TINTA }),
  })
}

function passo(texto) {
  return new Paragraph({
    numbering: { reference: 'passos', level: 0 },
    spacing: { after: 90, line: 264 },
    children: runs(texto, { size: 21, color: TINTA }),
  })
}

/** Caixa de fala sugerida. */
function fala(texto) {
  return new Paragraph({
    spacing: { before: 120, after: 160, line: 276 },
    indent: { left: 240, right: 240 },
    shading: { type: ShadingType.CLEAR, fill: VERDE_CLARO },
    border: { left: { style: BorderStyle.SINGLE, size: 18, color: VERDE, space: 10 } },
    children: [new TextRun({ text: `“${texto}”`, size: 21, color: TINTA, italics: true })],
  })
}

/** Caixa de atenção. */
function atencao(texto) {
  return new Paragraph({
    spacing: { before: 140, after: 160, line: 276 },
    indent: { left: 200, right: 200 },
    shading: { type: ShadingType.CLEAR, fill: AMBAR_BG },
    border: { left: { style: BorderStyle.SINGLE, size: 18, color: AMBAR, space: 10 } },
    children: runs(texto, { size: 20, color: TINTA }),
  })
}

/** Linha "por que isso importa" — o argumento comercial do ato. */
function porque(texto) {
  return new Paragraph({
    spacing: { before: 60, after: 200 },
    children: [
      new TextRun({ text: 'Por que isso vende:  ', bold: true, size: 20, color: VERDE }),
      ...runs(texto, { size: 20, color: CINZA }),
    ],
  })
}

function celula(texto, { negrito = false, fundo, largura } = {}) {
  return new TableCell({
    width: largura ? { size: largura, type: WidthType.PERCENTAGE } : undefined,
    shading: fundo ? { type: ShadingType.CLEAR, fill: fundo } : undefined,
    margins: { top: 90, bottom: 90, left: 140, right: 140 },
    children: [
      new Paragraph({
        spacing: { after: 0, line: 252 },
        children: runs(texto, { size: 19, color: negrito ? TINTA : CINZA, bold: negrito }),
      }),
    ],
  })
}

function tabela(cabecalho, linhas, larguras) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4, color: VERDE_LINHA },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: VERDE_LINHA },
      left: { style: BorderStyle.NONE },
      right: { style: BorderStyle.NONE },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: VERDE_LINHA },
      insideVertical: { style: BorderStyle.NONE },
    },
    rows: [
      new TableRow({
        tableHeader: true,
        children: cabecalho.map((t, i) => celula(t, { negrito: true, fundo: VERDE_CLARO, largura: larguras?.[i] })),
      }),
      ...linhas.map((linha) => new TableRow({
        children: linha.map((t, i) => celula(t, { negrito: i === 0, largura: larguras?.[i] })),
      })),
    ],
  })
}

function espaco(altura = 200) {
  return new Paragraph({ spacing: { after: altura }, children: [] })
}

// ------------------------------------------------------------- conteúdo

const capa = [
  espaco(1800),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 100 },
    children: [new TextRun({ text: 'PETJOURNEY', bold: true, size: 24, color: VERDE, characterSpacing: 60 })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 160 },
    children: [new TextRun({ text: 'Roteiro de Apresentação', bold: true, size: 56, color: TINTA })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 400 },
    children: [new TextRun({ text: 'Módulo Clínico  ·  demonstração de 12 minutos', size: 26, color: CINZA })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 120 },
    border: { top: { style: BorderStyle.SINGLE, size: 8, color: VERDE_LINHA, space: 12 } },
    children: [new TextRun({ text: 'Para quem vai apresentar a uma clínica veterinária', size: 21, color: CINZA })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: 'Setembro de 2026', size: 20, color: CINZA })],
  }),
  new Paragraph({ children: [new PageBreak()] }),
]

const comoUsar = [
  h1('Como usar este roteiro'),
  p('Este documento é para ser lido **antes** e mantido ao lado durante a apresentação. Ele cobre o fluxo clínico inteiro em sete atos, com tempo sugerido para cada um.'),
  p('Três convenções ao longo do texto:'),
  bullet('**Passos numerados** são o que fazer na tela, na ordem.'),
  bullet('**Blocos em verde** são fala sugerida. Não precisa decorar — a ideia é o argumento, não a frase.'),
  bullet('**Blocos em âmbar** são avisos: coisas que atrapalham a demonstração se ninguém prestar atenção.'),
  p('No fim há três seções que valem tanto quanto o roteiro: as **perguntas que o cliente costuma fazer**, a lista honesta do **que é real e o que é demonstração**, e o **plano B** para quando algo não responde.'),
  atencao('**O produto está em fase de protótipo navegável.** As telas são reais e funcionam, mas rodam sobre dados de demonstração — não há integração com servidor ainda. A seção “O que é real e o que é demonstração” explica exatamente onde está a linha. Vale lê-la antes de prometer prazo.'),
]

const antes = [
  h1('Antes de entrar na sala'),
  p('Cinco minutos de preparação evitam os dois jeitos mais comuns de a demonstração começar mal: o menu não aparecer, ou as telas abrirem vazias.'),

  h2('1. Ligar o módulo clínico'),
  p('O módulo nasce **oculto** de propósito — ele não aparece para quem entra no portal normalmente. Para ligar, há dois caminhos:'),
  bullet('Acrescentar **?clinico=on** ao fim do endereço de qualquer tela do portal e dar Enter.'),
  bullet('Ou simplesmente **digitar a palavra “clinico”** com o portal aberto, fora de qualquer campo de texto.'),
  p('O portal guarda essa escolha **para a conta que está logada**, naquele computador. Ou seja: ligue com a conta que você vai usar para apresentar. Se outra pessoa entrar na mesma máquina com a conta dela, o módulo volta a ficar invisível — que é o comportamento correto, e o motivo de ele nunca aparecer para um cliente por acidente.'),
  atencao('Confirme que os grupos **“Clínico”** e **“Pets”** apareceram no menu lateral **antes** de a plateia entrar na sala. Se não apareceram, o módulo não está ligado — e nenhuma tela deste roteiro existe.'),

  h2('2. Não apresentar num domingo'),
  p('A clínica de demonstração está **fechada aos domingos**. Num domingo, “Hoje na clínica” e a Agenda abrem vazias, e a apresentação perde os dois primeiros atos.'),
  p('Se a reunião cair num domingo, avise a equipe técnica com antecedência: é um ajuste de dado, rápido, mas precisa ser feito antes.'),

  h2('3. Ajustar a largura para o projetor'),
  p('A agenda mostra **cinco colunas de profissional**. Em projetor 4:3 elas apertam e o texto fica pequeno. Use o painel de exibição da própria agenda para deixar **dois ou três** profissionais visíveis antes de começar.'),

  h2('4. Deixar as abas abertas'),
  p('Abrir tela por tela na frente do cliente custa tempo morto. Deixe estas quatro já carregadas em abas separadas:'),
  bullet('Hoje na clínica'),
  bullet('Agenda'),
  bullet('Um atendimento já aberto (o prontuário do paciente em atendimento)'),
  bullet('Vacinas'),

  h2('Checklist final'),
  tabela(
    ['Item', 'Confere'],
    [
      ['Módulo ligado, “Clínico” e “Pets” no menu', '☐'],
      ['Não é domingo (ou o ajuste já foi feito)', '☐'],
      ['Agenda filtrada em 2–3 profissionais', '☐'],
      ['Quatro abas abertas e carregadas', '☐'],
      ['Som do computador mudo (avisos do sistema)', '☐'],
      ['Zoom do navegador em 100 % ou 110 %', '☐'],
    ],
    [78, 22],
  ),
  new Paragraph({ children: [new PageBreak()] }),
]

const roteiro = [
  h1('O roteiro — 12 minutos'),
  p('A ordem importa: cada ato prepara o seguinte. A história é um dia de trabalho da clínica, do momento em que a recepção abre a porta até o documento que o responsável leva para casa.'),

  ...ato(0, 'A promessa', 'antes de clicar em qualquer coisa', '30 s'),
  p('Não abra nenhuma tela ainda. Diga de que se trata, em duas frases, olhando para a pessoa e não para o projetor.'),
  fala('Hoje a clínica de vocês vive em três lugares: a agenda num sistema, o prontuário no papel ou no Word, e o contato com o responsável no WhatsApp. O que eu vou mostrar em dez minutos é esse dia inteiro num lugar só — e, no fim, uma parte dele chegando sozinha no celular de quem trouxe o animal.'),
  porque('A plateia precisa saber o que está prestes a ver. Sem essa frase, os primeiros dois minutos são gastos adivinhando.'),

  ...ato(1, 'Hoje na clínica', '/veterinario/meu-dia', '1 min'),
  passo('Abra **Hoje na clínica**. É a primeira tela do dia.'),
  passo('Aponte os três blocos: quem **já está esperando**, quem está **em atendimento**, e o que **vem a seguir**.'),
  passo('Não entre em nada ainda. Deixe a pessoa ler a tela por alguns segundos.'),
  fala('Antes de abrir qualquer prontuário, a clínica já sabe onde ela está. Quem chegou, quem está lá dentro, e o que vem depois. É a tela que a recepção deixa aberta o dia todo.'),
  porque('É a primeira impressão de organização. Clínica que trabalha com papel reconhece na hora o que essa tela substitui.'),

  ...ato(2, 'A agenda', '/veterinario/agenda', '2 min 30 s'),
  p('É o coração da demonstração e onde a clínica decide se troca de sistema. Vá devagar aqui.'),
  passo('**Mostre a legenda** e clique num tipo de atendimento: a grade filtra na hora. Diga que a cor **nunca vem sozinha** — sempre tem ícone e nome junto, para quem não distingue cores.'),
  passo('**Arraste um atendimento** para outro horário. Aparece uma confirmação com o de → para, os avisos, e **o texto que sairia para o responsável**.'),
  passo('**Não confirme.** Cancele de propósito, e diga por quê.'),
  passo('**Alterne para “por sala”** e volte para “por profissional”. Mesmo horário, outro eixo de leitura.'),
  fala('Repare que arrastar não salvou nada sozinho. Toda mudança de horário passa por uma confirmação que mostra o que muda e o que o responsável vai receber. Agenda é a coisa mais fácil de estragar sem perceber.'),
  porque('O medo número um de quem troca de sistema é perder ou bagunçar horário. Mostrar o cancelamento é mais convincente que mostrar o salvamento.'),

  ...ato(3, 'A falta que vira ligação', '/veterinario/agenda  e  /veterinario/fila', '1 min 30 s'),
  passo('Na agenda, **marque uma falta** pelo botão do próprio card do atendimento.'),
  passo('Aponte as três coisas que acontecem juntas: o status muda, a **fila de espera é consultada**, e o **reagendamento abre na hora** — já com horários buscados e o telefone clicável.'),
  passo('Abra **Fila de espera**. Mostre a posição de cada um e a **oferta de vaga com prazo**.'),
  fala('Falta é dinheiro perdido, e normalmente ninguém tem tempo de correr atrás. Aqui a falta já abre a ligação, com o horário novo sugerido e o telefone na tela. Vira uma ligação de trinta segundos, não uma linha num relatório que ninguém lê.'),
  porque('É o primeiro número concreto da conversa. Pergunte quantas faltas eles têm por semana — a conta se faz sozinha na cabeça deles.'),

  ...ato(4, 'O atendimento', 'prontuário do paciente em atendimento', '4 min'),
  p('O trecho mais longo, e o que justifica o produto. São cinco etapas: anamnese, exame físico, diagnóstico, conduta e resumo.'),

  h2('4.1 · O cabeçalho do paciente'),
  passo('Aponte que **alergia e comorbidade aparecem sem clicar em nada**.'),
  fala('Isso não está escondido numa aba. Quem abre o prontuário vê o que não pode esquecer antes de ler qualquer outra coisa.'),

  h2('4.2 · Exame físico — o momento do peso'),
  passo('**Afira o peso** do animal no campo de peso.'),
  passo('Mostre que **a dose recalcula sozinha** e o cabeçalho acompanha, marcando “hoje”.'),
  passo('Registre um sinal vital **fora da faixa**. Aparece seta, palavra e a faixa de referência da espécie, porte e idade.'),
  fala('O peso de hoje não é o peso do cadastro. No momento em que o animal sobe na balança, tudo que depende de peso se ajusta — inclusive a dose que vai sair na receita. É o erro mais comum de receita manual, e aqui ele não tem como acontecer.'),
  porque('É a demonstração mais técnica e a que mais impressiona veterinário. Faça devagar e deixe a pessoa ver o número mudar.'),

  h2('4.3 · Digitação rápida'),
  passo('Clique em **“Ver teclas”** ao lado das etapas.'),
  passo('Mostre: **Enter** avança de campo, **Alt + setas** mudam de etapa, e **números escolhem** direto a opção de um grupo.'),
  fala('A consulta inteira sem tirar a mão do teclado. Quem digita enquanto atende sabe o quanto isso muda — o mouse é o que faz o veterinário olhar para a tela em vez de olhar para o animal.'),

  h2('4.4 · Diagnóstico e conduta'),
  passo('No **diagnóstico**, busque no catálogo e marque um diferencial.'),
  passo('Na **conduta**, prescreva pelo bulário. Mostre **a conta aberta**: peso × mg/kg = dose.'),
  passo('Mostre o **fracionamento em palavra** — “meio comprimido”, não “0,5”.'),
  passo('Prescreva algo a que o paciente tem **alergia registrada**. O alerta exige confirmação explícita, mas **não impede**.'),
  fala('A conta aparece porque o veterinário confere de cabeça. Número pronto num campo ninguém confere. E o alerta de alergia não bloqueia: quem decide é o profissional, o sistema só garante que ele viu.'),
  porque('Respeitar a autonomia do veterinário é argumento de venda. Sistema que bloqueia é sistema que o profissional aprende a burlar.'),

  ...ato(5, 'A receita', 'mesma tela, painel de receita', '1 min 30 s'),
  passo('**Assine e emita**. Saem o código verificador, o CRMV e a validade.'),
  passo('Mostre o bloco **“Como o responsável vê”**: a mesma prescrição em linguagem de quem vai dar o remédio.'),
  passo('Clique em **“Enviar ao responsável”**. Fica registrado com data e hora.'),
  passo('Se houver receita anterior, mostre **“Repetir”** — traz tudo de uma vez.'),
  fala('É aqui que o elo aparece. A mesma prescrição que o veterinário escreveu chega no aplicativo de quem levou o animal, já em linguagem de casa, sem ninguém digitar duas vezes. E vira lembrete no horário certo.'),
  porque('É o diferencial que os concorrentes não têm. Guarde-o para o fim do ato do atendimento, quando a plateia já entendeu o resto.'),

  ...ato(6, 'Vacinas — a consulta que a clínica provoca', '/veterinario/vacinas', '1 min 30 s'),
  p('Este é o ato comercial da apresentação. Se o tempo apertar, corte outro — não corte este.'),
  passo('Abra **Vacinas**. Mostre as três pilhas: **vencido**, **a vencer** e **série aberta**.'),
  passo('Aponte o número de **“Agenda a recuperar”** no topo.'),
  passo('Escolha uma linha e mostre os botões **Ligar** e **Agendar**, ali mesmo.'),
  fala('Esta tela não espera o cliente ligar. Ela diz quem está com reforço vencido, quem vence nos próximos trinta dias, e quem começou uma série de vacina e não voltou para a segunda dose. Cada linha aqui é um atendimento que a clínica já ganhou e não cobrou.'),
  porque('É a única tela que fala em faturamento, e é a que fica na cabeça do dono da clínica depois que a reunião acaba.'),

  ...ato(7, 'Os documentos e o fechamento', 'etapa “Resumo” do atendimento', '1 min'),
  passo('Volte ao atendimento, etapa **Resumo**.'),
  passo('Mostre os **documentos sugeridos** — três ou quatro cartões, montados a partir do que **este** atendimento tem.'),
  passo('Abra **“Outros documentos”** e passe os olhos pela lista: termos, declarações, encaminhamento, orçamento.'),
  fala('São quinze documentos possíveis, mas a tela só oferece os três ou quatro que esta consulta pede. O resto está a um clique, sem entulhar a tela de quem está com o animal na mesa.'),
  espaco(120),
  p('**Feche olhando para a pessoa, não para a tela:**'),
  fala('O que vocês viram é um dia de trabalho: a recepção sabendo onde está, a falta virando ligação, a consulta registrada sem papel, a receita chegando no celular do responsável e a clínica sabendo quem chamar de volta. Queria entender qual desses cinco resolveria mais problema para vocês.'),
  porque('Termine com pergunta, não com resumo. A resposta dela é o que define a proposta.'),
  new Paragraph({ children: [new PageBreak()] }),
]

const perguntas = [
  h1('Perguntas que o cliente vai fazer'),
  p('As sete mais comuns, com a resposta curta. Responder com segurança vale mais que qualquer tela.'),
  espaco(80),
  tabela(
    ['Pergunta', 'Resposta'],
    [
      ['“Isso já funciona ou é maquete?”', 'As telas funcionam de verdade. O que ainda não existe é a integração com servidor — hoje roda com dados de demonstração. É protótipo navegável, e a fase é de validar com clínicas antes de construir o motor.'],
      ['“Meus dados ficam onde?”', 'A pergunta é legítima e a resposta honesta é: a arquitetura está definida, a implementação não. Anote e leve para a equipe técnica — não improvise.'],
      ['“Funciona no celular?”', 'O portal é responsivo, mas a agenda e o prontuário foram desenhados para tela grande, que é onde se atende. O celular é o lado do responsável, não o da clínica.'],
      ['“Quantos veterinários suporta?”', 'A agenda é multiprofissional e multissala. Na demonstração há cinco veterinários e várias salas ao mesmo tempo.'],
      ['“Importa meus dados do sistema atual?”', 'Ainda não está construído. Não prometa prazo — anote qual sistema eles usam hoje, que é a informação que a equipe precisa.'],
      ['“E o preço?”', 'Fora do escopo desta apresentação. Encaminhe para a conversa comercial.'],
      ['“Quando fica pronto?”', 'Não dê data. Diga que a fase atual é ouvir clínicas, e que a opinião deles entra no que será construído primeiro — o que é verdade e é o melhor convite possível.'],
    ],
    [34, 66],
  ),
  new Paragraph({ children: [new PageBreak()] }),
]

const honestidade = [
  h1('O que é real e o que é demonstração'),
  p('Esta seção existe para proteger quem apresenta. Prometer o que não existe custa a próxima reunião.'),

  h2('Funciona de verdade nas telas'),
  bullet('Agenda multiprofissional e multissala, com encaixe, bloqueio e arraste com confirmação'),
  bullet('Detecção de conflito: sobreposição, sala ocupada, invasão de bloqueio, fora do expediente'),
  bullet('Prontuário completo, com salvamento automático e aviso quando dois aparelhos abrem o mesmo'),
  bullet('Faixas de referência por espécie, **porte e idade**'),
  bullet('Cálculo de dose com a conta aberta, fracionamento e aviso de alergia por princípio ativo'),
  bullet('Registro de vacina com lote, fabricante, validade e dose da série'),
  bullet('Lista de chamada de reforço: vencido, a vencer e série aberta'),
  bullet('Quinze documentos em folha A4, com impressão pelo navegador'),
  bullet('Fila de espera com posição, oferta e prazo'),
  bullet('Digitação da consulta inteira pelo teclado'),

  h2('A forma está certa, o motor ainda não existe'),
  espaco(60),
  tabela(
    ['O que a tela mostra', 'O que ainda não acontece'],
    [
      ['Assinatura eletrônica com código verificador', 'O código é gerado localmente; virará assinatura criptográfica de verdade'],
      ['“Enviar ao responsável”', 'O envio fica registrado, mas quem entrega é o aplicativo — outro projeto, ainda não conectado'],
      ['Lembrete de medicação', 'Nasce da posologia e é exibido; quem dispara no celular é o aplicativo'],
      ['Aviso de remarcação e oferta de vaga', 'O texto é gravado como comprovante; nenhuma mensagem sai'],
      ['Pré-consulta respondida no aplicativo', 'O dado está plantado na demonstração; a coleta é do aplicativo'],
    ],
    [42, 58],
  ),

  h2('Não existe — não prometa'),
  bullet('**Nenhuma integração com servidor.** Tudo roda com dados de demonstração no próprio navegador'),
  bullet('**Preços**: o orçamento sai com os itens listados e os valores em branco'),
  bullet('**Plano de saúde do paciente**: operadora e apólice são preenchidos à mão'),
  bullet('**Microchip**'),
  bullet('**Importação de dados** de outro sistema'),
  atencao('Se o cliente pedir algo desta última lista, a melhor resposta é anotar na frente dele e dizer que vai para a lista do que construir primeiro. Isso vale mais que uma promessa vaga — e é o que esta fase do produto realmente precisa ouvir.'),
  new Paragraph({ children: [new PageBreak()] }),
]

const planoB = [
  h1('Plano B'),
  p('O que fazer quando algo não responde, sem quebrar o ritmo da apresentação.'),
  espaco(80),
  tabela(
    ['Se acontecer', 'O que fazer'],
    [
      ['O menu “Clínico” não aparece', 'O módulo está desligado para esta conta. Acrescente ?clinico=on ao endereço e recarregue, ou digite “clinico” com a tela aberta, fora de um campo de texto. Confirme também que você está logado com a conta em que ligou.'],
      ['A agenda abre vazia', 'Verifique se é domingo. Se for, o ato 1 e o ato 2 não têm dado — pule direto para o prontuário, que funciona em qualquer dia.'],
      ['Uma tela demora ou trava', 'Recarregue a página (F5). Os dados são recriados na hora e nada se perde, porque nada está salvo em servidor.'],
      ['Errou um passo e a tela ficou em estado estranho', 'Recarregue. É a vantagem de rodar sobre dados de demonstração: o mundo volta ao início.'],
      ['O projetor corta as colunas da agenda', 'Use o painel de exibição para reduzir a dois profissionais, ou diminua o zoom do navegador para 80 %.'],
      ['Perguntaram algo que você não sabe', 'Anote na frente da pessoa e diga que traz a resposta. Numa fase de protótipo, isso constrói mais confiança que responder por cima.'],
    ],
    [34, 66],
  ),
  espaco(300),
  new Paragraph({
    spacing: { before: 200 },
    border: { top: { style: BorderStyle.SINGLE, size: 8, color: VERDE_LINHA, space: 12 } },
    children: [new TextRun({ text: 'Uma última coisa', bold: true, size: 24, color: VERDE })],
  }),
  p('A apresentação não precisa terminar com o cliente convencido. Ela precisa terminar com ele **falando do dia dele** — quantas faltas tem por semana, quantas vacinas deixa de cobrar, quanto tempo o veterinário gasta escrevendo. É essa conversa que decide a próxima reunião, e o roteiro inteiro existe para chegar até ela.'),
]

// ------------------------------------------------------------- documento

const doc = new Document({
  creator: 'PetJourney',
  title: 'Roteiro de Apresentação — Módulo Clínico',
  description: 'Roteiro de demonstração do fluxo clínico do portal do parceiro.',
  numbering: {
    config: [{
      reference: 'passos',
      levels: [{
        level: 0,
        format: 'decimal',
        text: '%1.',
        alignment: AlignmentType.START,
        style: { paragraph: { indent: { left: 420, hanging: 260 } } },
      }],
    }],
  },
  styles: {
    default: { document: { run: { font: 'Calibri', size: 21, color: TINTA } } },
  },
  sections: [{
    properties: { page: { margin: { top: 1140, bottom: 1140, left: 1140, right: 1140 } } },
    footers: {
      default: new Footer({
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({ text: 'PetJourney · Roteiro de Apresentação · Módulo Clínico          ', size: 16, color: CINZA }),
            new TextRun({ children: [PageNumber.CURRENT], size: 16, color: CINZA }),
          ],
        })],
      }),
    },
    children: [...capa, ...comoUsar, ...antes, ...roteiro, ...perguntas, ...honestidade, ...planoB],
  }],
})

const destino = process.argv[2]
const buffer = await Packer.toBuffer(doc)
fs.writeFileSync(destino, buffer)
console.log('gerado:', destino, (buffer.length / 1024).toFixed(1), 'KB')
