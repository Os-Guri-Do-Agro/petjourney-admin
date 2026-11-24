// Guia rápido de teste dos cards "Em teste" do portal do parceiro (24/11/2026).
// Mesmo molde dos guias de 09/11 e 17/11 (docs/testes), mais curto: um teste por card, com o que foi
// testado em 24/11 no admin-dev, cms-dev e site de dev, e prints marcados (caixas numeradas).
// Uso: node gerar.mjs  ->  guia.html (as capturas ficam em ./prints, fora do git)
// PDF: msedge --headless=new --no-pdf-header-footer --print-to-pdf=<saida.pdf> guia.html
import fs from 'node:fs'
import { testesDosEpicos } from './epicos.mjs'

const AQUI = new URL('./', import.meta.url)
const q = (t) => `<span class="q">"${t}"</span>` // nome exato de botão, tela ou texto
const b = (t) => `<b>${t}</b>`
const lados = {
  P: ['Portal', 'lado-p'],
  A: ['App do responsável', 'lado-a'],
  S: ['Site', 'lado-s'],
  C: ['CMS', 'lado-c'],
  API: ['Preparo pela API', 'lado-api'],
}

/** Largura e altura de um JPEG, lidas do cabeçalho. */
function medida(arquivo) {
  const buf = fs.readFileSync(new URL(`prints/${arquivo}.jpg`, AQUI))
  let i = 2
  while (i < buf.length) {
    if (buf[i] !== 0xff) {
      i++
      continue
    }
    const marca = buf[i + 1]
    if (marca >= 0xc0 && marca <= 0xc3) return [buf.readUInt16BE(i + 7), buf.readUInt16BE(i + 5)]
    i += 2 + buf.readUInt16BE(i + 2)
  }
  throw new Error(`sem medida: ${arquivo}`)
}

/* As capturas do portal e do CMS têm 1440 px de largura (a do celular, 390; a da folha impressa, 794).
   "tudo" é a tela inteira; "conteudo" tira o menu lateral do portal; "gaveta" mostra só a gaveta da
   direita; "folha" é a página A4; "celular" é a tela do celular. Cada corte tem a sua escala (mm por
   pixel). Os cortes estreitos ficam ao lado do texto do passo. */
const CORTES = {
  tudo: { x: 0, w: 1440, mm: 0.1 },
  conteudo: { x: 272, w: 1168, mm: 0.112 },
  cms: { x: 249, w: 1191, mm: 0.11 },
  gaveta: { x: 860, w: 580, mm: 0.105 },
  folha: { x: 0, w: 794, mm: 0.085 },
  celular: { x: 0, w: 390, mm: 0.15 },
}
const AO_LADO = new Set(['gaveta', 'folha', 'celular'])

/** [arquivo, corte, altura]: a altura (px, a partir do alto) corta o vazio de baixo do print. */
function foto([arquivo, corte = 'conteudo', alturaMax]) {
  const { x, w, mm } = CORTES[corte]
  const [largura, altura] = medida(arquivo)
  const larguraDoCorte = Math.min(w, largura - x)
  const alto = Math.min(alturaMax ?? altura, altura)
  return `<div class="corte corte-${corte}" style="width:${(larguraDoCorte * mm).toFixed(1)}mm;aspect-ratio:${larguraDoCorte}/${alto}"><img src="prints/${arquivo}.jpg" style="width:${((largura / larguraDoCorte) * 100).toFixed(3)}%;margin-left:-${((x / larguraDoCorte) * 100).toFixed(3)}%"></div>`
}

function passo(n, p) {
  const lado = p.lado ? `<span class="lado ${lados[p.lado][1]}">${lados[p.lado][0]}</span>` : ''
  const prints = p.prints ?? []
  const nota = p.nota ? `<div class="nota">${p.nota}</div>` : ''
  const nc = p.naoConferido ? `<div class="nc">Não conferido em 24/11: ${p.naoConferido}</div>` : ''
  const deve = p.deve ? `<div class="deve"><b>Deve aparecer:</b> ${p.deve}</div>` : ''
  const texto = `<div class="bloco"><div class="acao"><span class="num">${n}</span><div>${lado}${p.acao}</div></div>${deve}${nota}${nc}</div>`
  if (prints.length === 1 && AO_LADO.has(prints[0][1])) {
    return `<div class="passo lado-a-lado"><div class="txt">${texto}</div><div class="fotos">${foto(prints[0])}</div></div>`
  }
  const fotos = prints.length ? `<div class="fotos">${prints.map(foto).join('')}</div>` : ''
  return `<div class="passo">${texto}${fotos}</div>`
}

function teste(t) {
  const lista = (titulo, cls, itens) =>
    itens?.length
      ? `<div class="${cls}"><div class="tit">${titulo}</div><ul>${itens.map((i) => `<li>${i}</li>`).join('')}</ul></div>`
      : ''
  return `<section class="teste">
  <div class="cab"><span class="letra">${t.letra}</span><div><h2>${t.titulo}</h2><div class="sub">${t.sub}</div></div>
  <div class="marcar">☐ Passou &nbsp; ☐ Falhou</div></div>
  <div class="situacao ${t.tom ?? 'ok'}">${t.situacao}</div>
  <div class="ficha"><p><b>Card no Nevo:</b> ${t.card}</p><p><b>Onde:</b> ${t.onde}</p><p><b>Conta:</b> ${t.conta}</p>${t.antes ? `<p><b>Antes de começar:</b> ${t.antes}</p>` : ''}</div>
  ${t.passos.map((p, i) => passo(i + 1, p)).join('')}
  <div class="fim">${lista('Não é bug (pode parecer, mas está certo)', 'naobug', t.naoBug)}
  ${lista('É bug se', 'ebug', t.bug)}</div>
  </section>`
}

/** A versão do admin-dev no fim do teste (a do package.json do develop). */
const VERSAO = JSON.parse(fs.readFileSync(new URL('../../../package.json', AQUI), 'utf8')).version
const SENHA = 'senha Teste@123'
const DEMO = `portal-demo@petjourney.test (${SENHA}), dona da "Clínica e Hotel Demo".`
const PORTAL = 'admin-dev (portal-dev.petjourney.health), no computador, com 1280 px de largura ou mais.'
const CMS = 'cms-dev (cms-dev.petjourney.health), com a sua conta de administrador.'
const SITE = 'site de dev (dev.petjourney.health).'
const REAL = 'Testado em 24/11'

const testesAvulsos = [
  {
    letra: 'A',
    titulo: 'Fotos dos pets em todas as listas',
    sub: 'A foto da clínica ou a do app, e a inicial com a silhueta da espécie quando não há foto',
    card: 'Portal › Pacientes: a foto do pet aparece em todas as listas',
    ondeCurto: 'Portal',
    situacaoCurta: 'Passou · Web marcada',
    situacao: `${REAL} no admin-dev, gravando de verdade: passou. A foto nova do Nino foi posta pela API, como o app faz.`,
    onde: PORTAL,
    conta: `${DEMO} No app, qa-rafael@petjourney.test (${SENHA}), responsável do Nino.`,
    antes: 'A Mel tem foto da clínica; a Fubá e o Nino, foto do app. Não toque em "Desligar" nos módulos do Início da conta demo.',
    passos: [
      { lado: 'P', acao: `${q('Pacientes')}${b(', aba')} ${q('Cadastros')}.`, deve: 'Mel, Fubá e Nino com a foto redonda. Os outros com a inicial em um círculo colorido; Pipoca e Jim com a silhueta de gato, os cachorros com a de cachorro.', prints: [['fotos-01-pacientes']] },
      { lado: 'A', acao: b('No app da qa-rafael, troque a foto de um pet ligado à clínica. No portal, recarregue Pacientes e, uns 15 segundos depois, recarregue de novo.'), deve: 'Na primeira leitura, a inicial; na seguinte, a foto do app. A ficha do pet mostra a mesma foto.' },
      { lado: 'P', acao: `${q('Agenda')} › ${q('Marcar horário')}${b(', campo')} ${q('Paciente')}${b(': digite "Bi".')}`, deve: 'O rosto antes de cada nome: Bisteca e Bidu com "B". Marcando o Bisteca hoje, a grade do dia e o Início mostram "B" (nunca "BT").', prints: [['fotos-05-campo-paciente', 'gaveta']] },
      { lado: 'P', acao: `${q('Internação')}${b(': interne a Mel em um leito livre e a Pipoca no Felino (peso de entrada: o do cadastro).')}`, deve: 'No mapa, a Mel com a foto e a Pipoca com "P" e a silhueta de gato. No detalhe da internação, a foto da Mel no alto, ao lado do nome.', prints: [['fotos-09-mapa']] },
      { lado: 'P', acao: `${q('Lista de espera')} › ${q('Adicionar à fila')}${b(': o Nino.')}`, deve: 'Depois de "1º", a foto do Nino.', prints: [['fotos-12-fila', 'conteudo', 330]] },
      { lado: 'P', acao: b('F12 › Network: bloqueie o domínio das fotos (aytykedscyvbynxegkwn.supabase.co) e recarregue Pacientes, a Lista de chamada e o mapa.'), deve: 'Só iniciais, nenhuma imagem quebrada. Sem o bloqueio, as fotos voltam.', prints: [['fotos-13-bloqueado']] },
      { lado: 'P', acao: b('Deixe a conta como estava: tire o Nino da fila, dê alta à Mel e à Pipoca e cancele o horário do Bisteca (o cancelar pede o motivo).') },
    ],
    naoBug: [
      'Na primeira leitura de um pet ligado ao app, aparece a inicial: a miniatura da foto do app vem na leitura seguinte.',
      'Internar com um peso muito diferente do cadastro pede para digitar o peso de novo: é uma trava de segurança.',
      'Na visão Semana da agenda não há foto: a API não manda foto nessa lista.',
    ],
    bug: ['Aparece o ícone de imagem quebrada ou um quadrado vazio.', '"Bisteca" mostra "BT".', 'A Pipoca aparece com a silhueta de cachorro.'],
  },
  {
    letra: 'B',
    titulo: 'Lembrete de vacina e "Editar registro"',
    sub: 'A recepção liga o lembrete da dose que falta; o responsável recebe o aviso no app',
    card: 'Portal e app: a clínica liga o lembrete de vacina do pet (subtarefa do portal)',
    ondeCurto: 'Portal (o push é do app)',
    situacaoCurta: 'Portal passou · Web marcada',
    situacao: `${REAL} no admin-dev: os 16 passos do portal passaram. O aviso ficou "Só na caixa de entrada", porque a qa-bruna não tem celular registrado. Na API de dev cada gravação leva de 2 a 5 segundos: a tela atualiza sozinha quando a resposta chega.`,
    onde: `${PORTAL} Para ver o push, o app de dev no celular com a qa-bruna.`,
    conta: `${DEMO} Enfermagem: qa-vacina-enfermagem@petjourney.test. App: qa-bruna@petjourney.test (${SENHA}), responsável da Fubá.`,
    antes: 'Use só a Fubá (o push é de verdade). O primeiro aviso de uma dose sai uma vez a cada 24 h: o lembrete da Fubá foi ligado em 24/11 às 15h44.',
    passos: [
      { lado: 'P', acao: `${q('Vacinas')}${b(', aba')} ${q('Lista de chamada')}.`, deve: `Mel, Nino, Bidu e Fubá com a V10. ${q('Ativar lembrete')} em Mel, Nino e Fubá; no Bidu, só o texto ${q('Ligue para o telefone do cadastro')}, sem botão.`, prints: [['lem-01-chamada']] },
      { lado: 'P', acao: `${b('Na Fubá,')} ${q('Ativar lembrete')}.`, deve: `A gaveta ${q('Lembrete no app')} com a prévia ${q('Vacina de Fubá chegando')} e o "Quando sai". Nenhuma chamada ao abrir.`, prints: [['lem-02-previa', 'gaveta']] },
      { lado: 'P', acao: `${q('Ativar lembrete')} ${b('na gaveta; depois, recarregue e toque em')} ${q('Lembrete ativo')}.`, deve: `A caixa passa a ${q('Lembrete ativo')} sem recarregar. Na gaveta: "Ativado em", "Último envio em ...: Entregue" (ou Enviado, ou Só na caixa de entrada) e "Próximo envio em 07/12, 09:00", na hora de Brasília.`, prints: [['lem-04-gaveta-ativo', 'gaveta']] },
      { lado: 'A', acao: b('Com a qa-bruna no app de dev do celular, notificações ligadas, espere até 2 minutos.'), deve: 'O push "Vacina de Fubá chegando"; o toque abre as Vacinas da Fubá no perfil de responsável.', naoConferido: 'o push e o toque (não há celular aqui).' },
      { lado: 'P', acao: `${q('Desligar lembrete')}${b(', e ligue de novo no mesmo dia.')}`, deve: 'A caixa volta a "Ativar lembrete" sem recarregar (espere a resposta da API); religada, o mesmo último envio e nenhum push novo.' },
      { lado: 'P', acao: `${b('No "..." da Fubá,')} ${q('Editar registro')}${b(': mude a observação, escreva um motivo de 3 letras, depois um de verdade.')}`, deve: `${q('Salvar')} desligado sem mudança; com 3 letras, o motivo fica vermelho e nada sai; com o motivo certo, ${q('Registro corrigido.')} e a observação em "Ver detalhes".`, prints: [['lem-05-editar', 'gaveta']] },
      { lado: 'P', acao: b('Entre com a qa-vacina-enfermagem e abra a mesma lista.'), deve: 'Os mesmos 4 cartões, sem nada do lembrete; o "..." continua com "Editar registro" e "Apagar registro".', prints: [['lem-10-enfermagem']] },
    ],
    naoBug: ['"Na fila" logo depois de ligar: a entrega muda em uma leitura seguinte.', 'Religar no mesmo dia não manda push.', '"Só na caixa de entrada": a responsável não tinha o app aberto em um celular com notificações.'],
    bug: ['O Bidu (sem app) mostra "Ativar lembrete".', 'O F5 perde o "Lembrete ativo".', 'A Enfermagem vê o botão do lembrete.'],
  },
  {
    letra: 'C',
    titulo: 'Convite para o app por WhatsApp, QR e código',
    sub: 'Um convite com link e código, que vale 7 dias; a página do link mostra a clínica',
    card: 'Portal, app e site: convite da clínica por WhatsApp, QR e código (portal e site)',
    ondeCurto: 'Portal e site (o aceite é do app)',
    situacaoCurta: 'Portal e site passaram · Web marcada',
    situacao: `${REAL} no admin-dev e no site de dev, gravando de verdade: passou. Ficou na conta demo o cliente "QA Convite 24/11" com a Luna e cinco convites (o último vale até 01/12).`,
    onde: `${PORTAL} ${SITE}`,
    conta: DEMO,
    antes: 'Para o WhatsApp abrir a conversa com você, use o número do seu celular de teste no cadastro do cliente.',
    passos: [
      { lado: 'P', acao: `${q('Pacientes')} › ${q('Cadastrar paciente')}${b(': cliente novo com telefone e sem e-mail, pet "Luna".')}`, deve: `${q('Luna cadastrado')} e o passo ${q('Convidar para o app agora?')} com WhatsApp, Mostrar QR, Copiar mensagem e Outras formas; sem "Enviar por e-mail"; o pé diz ${q('Agora não')}.`, prints: [['conv-01-convidar-agora', 'gaveta']] },
      { lado: 'P', acao: `${q('Copiar mensagem')}${b(', depois')} ${q('Enviar pelo WhatsApp')}.`, deve: 'A mensagem com o link, o código XXXX-XXXX e a validade; o WhatsApp abre no número do cadastro com a mesma mensagem. Embaixo, "Vale até 1 de dezembro às 14:56." (7 dias).' },
      { lado: 'P', acao: `${q('Mostrar QR')}${b(', depois')} ${q('Imprimir')}${b('. Com o QR aberto, aperte Esc.')}`, deve: 'O QR com o código em dois blocos; a folha com o nome da clínica, o QR, o código, a instrução e a validade. O Esc fecha só o QR.', prints: [['conv-03-qr']] },
      { lado: 'P', acao: b('Abra a ficha da Luna e toque em "Convidar para o app" de novo; depois "Reenviar".'), deve: `${q('O convite anterior deixou de valer.')}; em Propostas, uma "Não respondida" e as outras "Cancelada".`, prints: [['conv-04-ficha']] },
      { lado: 'S', acao: b('Abra o link do convite trocando "https://petjourney.health" por "https://dev.petjourney.health".'), deve: `${q('Clínica e Hotel Demo quer conectar seus pets ao app PetJourney')}, "São Paulo, SP" e "Vale até ...", sem nome de pet, de pessoa nem o código.`, prints: [['site-conv-01-valido']] },
      { lado: 'S', acao: b('Abra o convite vencido: dev.petjourney.health/clinica/vinculo/IZossrGFdj-UyTJF235RoOKbBSfbX1yhYbA1bktg4AI'), deve: `${q('Este convite venceu.')} e ${q('Pedir outro convite pelo WhatsApp')}.`, prints: [['site-conv-02-vencido']] },
      { lado: 'A', acao: b('No celular, toque no link do WhatsApp e aceite o pedido da clínica.'), deve: 'O "Pedido da clínica" com a Luna; aceito, a ficha no portal diz "Ligado desde [data], por convite por link."', naoConferido: 'as telas do app.' },
    ],
    naoBug: ['Cada abertura da gaveta na ficha cria um convite novo: vale o último.', 'O link leva a petjourney.health (produção) mesmo no dev: por isso o site se testa trocando o começo do link.', 'Sem rede, a mensagem de erro sai em inglês ("Failed to fetch").'],
    bug: ['O WhatsApp abre sem o número ou sem a mensagem.', 'O Esc com o QR aberto fecha também a gaveta.', 'A página do site mostra nome de pet, de pessoa ou o código.'],
  },
  {
    letra: 'D',
    titulo: 'Veterinário autônomo, recorte do diário e espécie Outro',
    sub: 'Configurações › Empresa e o detalhe e o filtro dos Acessos',
    card: 'Portal › Empresa e Acessos: Veterinário, o que foi compartilhado e espécie Outro',
    ondeCurto: 'Portal',
    situacaoCurta: 'Passou · Web marcada',
    situacao: `${REAL}: passou. O salvar do Veterinário foi testado no "Pet Shop Luís QA" (a portal-demo não tem CNPJ nem telefone). Os acessos foram criados pela API com a qa-premium, como o app faz.`,
    onde: PORTAL,
    conta: `luis.qa.petshop@petjourney.test (${SENHA}) para o Veterinário. ${DEMO} No app: qa-premium@petjourney.test.`,
    passos: [
      { lado: 'P', acao: `${q('Configurações')} › ${q('Empresa')}${b(', abra a lista de categorias e marque "Veterinário autônomo".')}`, deve: 'A lista com "Veterinário autônomo" separado de "Clínica veterinária"; marcado, aparece o campo CRMV. Com o CRMV, salva ("Cadastro atualizado") e continua depois de recarregar.', prints: [['emp-02-crmv']] },
      { lado: 'A', acao: b('No app da qa-premium: novo acesso temporário da Luna, Consulta, "Diário do pet" com "Últimos 7 dias". Anote o código.') },
      { lado: 'P', acao: `${q('Acessos')} › ${q('Novo acesso temporário')}${b(': digite o código e')} ${q('Vincular')}.`, deve: `O detalhe abre sozinho. Em "Diário do pet": ${q('Todos os registros de [data] a [data], como o responsável escolheu.')} e os registros, do mais recente para o mais antigo.`, prints: [['ace-02-recorte-diario']] },
      { lado: 'P', acao: b('Vincule um acesso de um pet da espécie Outro (no teste, o "Espinho", um ouriço) e abra Filtros › Espécie.'), deve: '"Ouriço" no cartão; a lista de espécies com "Outro" depois de Réptil; escolhendo "Outro", só o Espinho.', prints: [['ace-05-especie-outro']] },
    ],
    naoBug: ['O botão se chama "Novo acesso temporário" (o roteiro antigo fala em "Vincular código").', 'O aviso de itens que não couberam só aparece quando algo passa do limite.', 'As notas do diário só vão quando o responsável inclui as notas no acesso.'],
    bug: ['"Veterinário autônomo" não salva ou volta sozinho.', 'O detalhe do acesso não diz o período do diário.', 'Aparece texto cru de tradução em inglês.'],
  },
  {
    letra: 'H',
    titulo: 'QR da página pública no padrão da marca',
    sub: 'O QR do WFQR (sage, com a pata) na aba Página pública, na gaveta, no PNG, no SVG e na folha',
    card: 'Portal: QR da página pública no padrão da marca, com a pata',
    ondeCurto: 'Portal',
    situacaoCurta: 'Passou · Web marcada',
    situacao: `${REAL} no admin-dev: passou. O destino de cada QR foi conferido pelo redirecionamento do srhub (sem câmera).`,
    onde: PORTAL,
    conta: DEMO,
    antes: 'A página da conta demo está publicada em clinica-e-hotel-demo. Se trocar o endereço, volte para esse no fim.',
    passos: [
      { lado: 'P', acao: `${q('Estabelecimento')}${b(', aba')} ${q('Página pública')}.`, deve: '"Página da clínica" e "Página do hotel", cada uma com o link e o QR no padrão (sage, arredondado, pata no centro), diferentes entre si.', prints: [['qr-01-aba']] },
      { lado: 'P', acao: `${q('Baixar ou imprimir')}${b(', depois')} ${q('Imagem PNG')}${b(',')} ${q('Arquivo SVG')} ${b('e')} ${q('Folha para o balcão')}.`, deve: 'O QR grande e nítido; o PNG e o SVG iguais à tela; a folha A4 com o nome da casa, o QR e o endereço.', prints: [['qr-02-gaveta', 'gaveta'], ['qr-03-folha', 'folha']] },
      { lado: 'P', acao: `${q('Trocar endereço')}${b(': clinica-e-hotel-demo-2, salve; depois volte para clinica-e-hotel-demo.')}`, deve: 'O link muda e a imagem do QR não muda; o QR já impresso passa a levar ao endereço novo (o srhub leva alguns segundos para atualizar).', prints: [['qr-04-endereco-novo']] },
      { lado: 'P', acao: b('F12 › Network: bloqueie srhub.up.railway.app e recarregue.'), deve: 'O QR desenhado no navegador (verde escuro, quadrado), que é só a reserva; nada em branco. Sem o bloqueio, o padrão volta.', prints: [['qr-05-reserva']] },
    ],
    naoBug: ['No dev, o celular abre a página "não encontrada" do site de produção: o que se confere é o endereço.', 'O celular mostra srhub.up.railway.app antes de abrir a página.'],
    bug: ['O QR sai verde escuro com o serviço de QR no ar.', 'A imagem do QR muda depois de "Trocar endereço".'],
  },
  {
    letra: 'I',
    titulo: '"Apagar vários" feriados em um pedido só',
    sub: 'Estabelecimento › Horários: marcar e apagar de uma vez',
    card: 'Portal: "Apagar vários" dias especiais num pedido só (aba Horários)',
    ondeCurto: 'Portal',
    situacaoCurta: 'Passou · Web marcada',
    situacao: `${REAL} na conta nova "Clínica Luís QA", para não apagar os feriados da conta demo: passou.`,
    onde: `${PORTAL} Com o F12 aberto na aba Network.`,
    conta: `luis.qa.clinica@petjourney.test (${SENHA}), dona da "Clínica Luís QA".`,
    antes: 'Cadastre 3 feriados futuros em "Adicionar feriado". A API só mostra os dias dos últimos 30 dias em diante.',
    passos: [
      { lado: 'P', acao: `${q('Estabelecimento')} › ${q('Horários')} › ${q('Apagar vários')}${b(': marque os 3 e toque em')} ${q('Apagar 3')}.`, deve: 'Um POST só para .../dias-especiais/remover, 200, e os 3 somem da lista.', prints: [['apg-01-marcados']] },
      { lado: 'P', acao: `${b('Com mais de 20 dias passados:')} ${q('Mostrar ... que já passaram')} › ${q('Apagar vários')} › ${q('Marcar os que já passaram')}.`, deve: 'Um pedido só e a lista fica só com os futuros.', prints: [['apg-03-passados']] },
      { lado: 'P', acao: b('Marque dois dias, apague um deles em outra aba e, nesta, apague os dois.'), deve: `Nenhum erro: ${q('Feriados removidos')} e ${q('2 dias saíram da lista.')}` },
    ],
    naoBug: ['Dias passados de mais de 30 dias não aparecem: a API não os devolve.'],
    bug: ['Um DELETE por dia em vez de um POST só.', 'Erro quando um dos dias já tinha sido apagado.'],
  },
  {
    letra: 'J',
    titulo: 'Ficha de emergência pelo QR da coleira',
    sub: 'Para o pet que chegou sem o responsável: a ficha curta e o aviso na hora',
    card: 'Portal: ficha de emergência pelo QR da coleira',
    ondeCurto: 'Portal',
    situacaoCurta: 'Passou · Web marcada',
    situacao: `${REAL} com a portal-demo (CRMV conferido) e o Thor, pet da sua conta nova de responsável: passou. O aviso foi para luis.qa.tutor.`,
    onde: PORTAL,
    conta: `${DEMO} Pet de teste: Thor, da luis.qa.tutor@petjourney.test (${SENHA}).`,
    antes: 'Cada ficha aberta avisa o responsável. Limite: 10 fichas por pessoa e 30 por clínica em 24 h.',
    passos: [
      { lado: 'P', acao: `${q('Acessos')} › ${q('Emergência pelo QR')}${b(': cole petjourney.health/carteirinha/2aeecbbedd50f1e7f35a226b02760668 (ou só o código do fim) e um motivo.')}`, deve: 'Motivo com menos de 10 caracteres: "Escreva de 10 a 300 caracteres." e nada sai.', prints: [['eme-01-gaveta', 'gaveta']] },
      { lado: 'P', acao: q('Abrir ficha'), deve: `${q('O responsável foi avisado agora.')}, "Thor · Cachorro · Macho · Castrado · 5 anos", "18,4 kg em 24 de nov. de 2026" e a alergia "Dipirona · Medicamentosa · Grave" com o ícone de risco.`, prints: [['eme-02-ficha', 'gaveta']] },
      { lado: 'P', acao: b('Repita com um código que não existe e com um endereço que não é de carteirinha.'), deve: `${q('Ficha indisponível para este QR.')} e ${q('Este endereço não é o da carteirinha...')}` },
    ],
    naoBug: ['A ficha não traz o contato do responsável: ele liga para a clínica.'],
    bug: ['A ficha abre sem avisar o responsável.', 'Quem não tem o CRMV conferido abre a ficha.'],
  },
]

/* Achados e o que ficou para decidir. */
const pendencias = [
  ['F', 'Depois de o admin recusar um módulo e o dono pedir de novo, o Início mostrava o texto da recusa ao lado de "O pedido está com a equipe PetJourney.".', 'Corrigido (0.8.2)'],
  ['Todos', 'Os botões do calendário anunciavam "Choose Month" e "Choose Year" em inglês ao leitor de tela.', 'Corrigido (0.8.2)'],
  ['K', 'A Auditoria mostrava nomes técnicos ("criou um registro (lembrete-de-vacina)"): 62 tipos de registro ganharam nome nos 6 idiomas.', 'Corrigido (0.8.3 e 0.8.4)'],
  ['K', 'A Auditoria aberta pelo endereço, sem a permissão, mostrava os filtros e um "Tentar de novo" que não resolve.', 'Corrigido (0.8.3)'],
  ['G', 'Sem rede, as telas mostravam "Failed to fetch", o texto do navegador em inglês.', 'Corrigido (0.8.3)'],
  ['E', 'Um pet shop sem Clínica via "Falta pouco para emitir receitas" no pé do menu.', 'Corrigido (0.8.3)'],
  ['L', 'O Diário do app mostrava no dia seguinte o registro feito entre 21h e meia-noite de Brasília.', 'Corrigido (0.8.4)'],
  ['M', 'Aceitar um pedido feito pelo site criava cliente e pet repetidos, mesmo com o telefone de um cliente da casa. Agora a gaveta oferece o cliente e a ficha que a clínica já tem (vincularA).', 'Corrigido (0.8.5)'],
  ['M', 'A falta já reagendada escondia o "Reagendar" para sempre, mesmo com o horário novo cancelado.', 'Corrigido (0.8.5)'],
  ['N', 'O bulário mostrava a faixa de dose com ponto ("0.1 a 0.2 mg/kg").', 'Corrigido (0.8.5)'],
  ['N', 'A receita cancelada ficava sem "Repetir", embora a API aceite.', 'Corrigido (0.8.5)'],
  ['N', 'O documento de quem pede a cópia (ou aceita o termo) com parêntese ou acento levava a "O servidor não aceitou os dados enviados"; agora o campo diz a regra.', 'Corrigido (0.8.5)'],
  ['O', 'Logo depois de "Dar alta", o checklist seguia com "Dei" e "Pulei" nas doses suspensas até recarregar.', 'Corrigido (0.8.5)'],
  ['O', 'O telefone aparecia só com números (5511970002411) na fila de boletins e no bloco do boletim.', 'Corrigido (0.8.5)'],
  ['P', 'Na gaveta das metas, o pedido de compra não se refazia ao passar para o campo seguinte com o Tab.', 'Corrigido (0.8.5)'],
  ['P', 'Com a gaveta aberta, o botão "Combinar metas de novembro" cobria o título do cartão.', 'Corrigido (0.8.5)'],
  ['M', '"Marcar mesmo assim" no horário que outro já tomou recebe 400: o DTO da API só aceita holiday-closed, embora o guia e o serviço esperem professional-overlap (lacuna N53).', 'API'],
  ['M', 'Depois de responder um pedido, os contadores ficam com o número velho: a API não limpa o cache de 30 s na resposta, e o selo "Pedidos" espera a próxima conferência do portal (lacuna N56).', 'API'],
  ['M', 'A página do pedido aceito no site não mostra a mensagem da clínica: a API não a manda (lacuna L1).', 'API'],
  ['L', 'Juntar dois pacientes (Paçoca C) deu 500 na API de dev duas vezes; juntar os clientes deu certo. O pet repetido do teste ficou inativo (lacuna N55).', 'API'],
  ['N, O', 'Algumas horas (entrada da internação, doses, "Salvo às", histórico da gaveta do horário) aparecem no fuso do computador, não no da clínica.', 'Em aberto (erro conhecido de fuso)'],
  ['K', 'No site de dev, o "Pedir horário" abria dizendo que o pedido estava indisponível (o captcha ficava desligado em todo build). Na produção, a main precisa da NEXT_PUBLIC_TURNSTILE_SITE_KEY de verdade no Amplify.', 'Corrigido no site (43c0e77); conferir a chave da produção'],
  ['F', 'Na portal-demo, a confirmação do Desligar conta "4 agendamentos futuros" com 1 horário na agenda: a API soma 3 atendimentos de 08/11 que ficaram "aguardando".', 'API ou dado do dev'],
  ['E', 'Salvar pelo CMS grava o telefone com máscara; o portal grava só os dígitos.', 'API'],
  ['K', 'O contador de ocorrências sem contato do Hotel volta nulo em /parceiro/portal/pendencias (às vezes o Início diz que parte das pendências não pôde ser conferida).', 'API'],
  ['I', 'A API só devolve os dias especiais dos últimos 30 dias em diante; o roteiro fala em mais de 20 dias passados.', 'Roteiro'],
  ['D', 'O roteiro do card fala em "Vincular código"; o botão hoje é "Novo acesso temporário".', 'Roteiro'],
]

const css = `
@page { size: A4; margin: 12mm 11mm 12mm 11mm; }
* { box-sizing: border-box; }
body { font-family: "Segoe UI", system-ui, sans-serif; color: #1F2A2E; font-size: 10.3pt; line-height: 1.42; margin: 0; }
h1 { color: #2E5A4C; font-size: 23pt; margin: 0 0 2mm; }
h2 { color: #1F2A2E; font-size: 14.5pt; margin: 0; }
h3 { color: #2E5A4C; font-size: 12.5pt; margin: 0 0 2mm; }
.q { color: #2B5E9C; font-weight: 600; }
code { font-size: 9pt; background: #F1F4F3; padding: 0 1mm; border-radius: 3px; }
.capa-sub { color: #5B6B70; margin-bottom: 5mm; }
.caixa { border: 1px solid #DCE3E1; border-radius: 10px; padding: 3.5mm 4.5mm; margin-bottom: 3.5mm; break-inside: avoid; }
.caixa.alerta { border-color: #E9C9A0; background: #FDF6EC; }
table { width: 100%; border-collapse: collapse; font-size: 9.3pt; }
th { background: #EEF2F1; text-align: left; padding: 1.8mm; }
td { border-top: 1px solid #E3E8E6; padding: 1.8mm; vertical-align: top; }
.ok { color: #2E7D4F; font-weight: 600; } .at { color: #B4621A; font-weight: 600; } .ru { color: #B03A3A; font-weight: 600; }
ul { margin: 1mm 0 0; padding-left: 5mm; } li { margin: 0.5mm 0; }
.teste { break-before: page; }
.cab { display: flex; align-items: center; gap: 4mm; border-bottom: 2px solid #2E5A4C; padding-bottom: 2mm; margin-bottom: 3mm; }
.letra { width: 11mm; height: 11mm; border-radius: 50%; background: #2E5A4C; color: #fff; font-weight: 700; font-size: 15pt; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.cab > div { flex: 1; } .sub { color: #5B6B70; font-size: 9.5pt; }
.marcar { font-size: 10pt; color: #2E5A4C; white-space: nowrap; border: 1px solid #C9D6D2; border-radius: 6px; padding: 1mm 2.5mm; }
.situacao { background: #E8F3EC; border-radius: 8px; padding: 2.2mm 4mm; margin-bottom: 3mm; }
.situacao.atencao { background: #FCF0E3; }
.situacao.falhou { background: #FBEAEA; }
.ficha { background: #F4F6F6; border-radius: 8px; padding: 2.2mm 4mm; margin-bottom: 3.5mm; }
.ficha p { margin: 0.5mm 0; }
.passo { margin: 0 0 4mm; }
.passo .bloco { break-inside: avoid; }
.passo:not(:has(.fotos)) { break-inside: avoid; }
.passo:has(.fotos) .bloco { break-after: avoid; }
.acao { display: flex; gap: 3mm; align-items: flex-start; margin-bottom: 1.3mm; }
.num { width: 7mm; height: 7mm; border-radius: 50%; background: #E3ECE9; color: #2E5A4C; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-size: 10pt; }
.lado { display: inline-block; font-size: 8pt; font-weight: 700; letter-spacing: .3px; text-transform: uppercase; border-radius: 4px; padding: .3mm 1.8mm; margin-right: 2mm; vertical-align: 1px; }
.lado-p { background: #DCEBE6; color: #2E5A4C; } .lado-a { background: #DDE8F4; color: #2B5E9C; } .lado-s { background: #EEE6F6; color: #6A4A8C; } .lado-c { background: #F1E9DD; color: #7A5A2A; } .lado-api { background: #ECECEC; color: #444; }
.deve { background: #EAF5EE; border-radius: 6px; padding: 1.8mm 3.5mm; margin-left: 10mm; }
.nota { background: #FCF3E6; border-radius: 6px; padding: 1.6mm 3.5mm; margin: 1.4mm 0 0 10mm; font-size: 9.3pt; }
.nc { background: #EDEDED; border-radius: 6px; padding: 1.6mm 3.5mm; margin: 1.4mm 0 0 10mm; font-size: 9pt; color: #444; }
.fotos { display: flex; gap: 4mm; margin: 2.5mm 0 0 10mm; flex-wrap: wrap; }
.corte { overflow: hidden; border-radius: 6px; border: 1px solid #CBD5D2; flex-shrink: 0; break-inside: avoid; }
.corte img { display: block; }
.passo > .fotos { display: block; }
.passo > .fotos .corte { display: inline-block; vertical-align: top; margin: 0 4mm 3mm 0; }
.lado-a-lado { display: flex; gap: 5mm; align-items: flex-start; break-inside: avoid; }
.lado-a-lado .txt { flex: 1; min-width: 0; }
.lado-a-lado .fotos { margin: 0; flex-wrap: nowrap; }
.fim { display: grid; grid-template-columns: 1fr 1fr; gap: 4mm; margin-top: 3mm; break-inside: avoid; }
.naobug, .ebug { border-radius: 8px; padding: 2.6mm 4mm; font-size: 9.3pt; }
.naobug { background: #EAF1FA; } .ebug { background: #FBEAEA; }
.tit { font-weight: 700; }
.resultado td { height: 8.5mm; }
.compacta { font-size: 8.9pt; } .compacta td, .compacta th { padding: 1.3mm 1.7mm; line-height: 1.33; }
.quebra { break-before: page; }
`

const testes = [...testesAvulsos, ...testesDosEpicos({ q, b, SENHA, DEMO, PORTAL, CMS, SITE, REAL })].sort((x, y) => x.letra.localeCompare(y.letra))
const tom = { ok: 'ok', atencao: 'at', falhou: 'ru' }
const linhasIndice = testes.map((t) => `<tr><td><b>${t.letra}.</b> ${t.titulo}</td><td>${t.ondeCurto ?? ''}</td><td class="${tom[t.tom ?? 'ok']}">${t.situacaoCurta ?? ''}</td></tr>`).join('')

const contas = [
  ['portal-demo@petjourney.test', 'A clínica de QA ("Clínica e Hotel Demo"), DONO, com o CRMV conferido. Pacientes Mel, Nino, Bidu, Fubá, Pipoca, Jim, Bisteca e a Luna do "QA Convite 24/11". Clínica ativa; Hotel desligado pela equipe. Não desligue a Clínica: outros testes usam a conta.'],
  ['luis.qa.clinica@petjourney.test', '<b>Nova (24/11).</b> Dona da "Clínica Luís QA", aprovada, só Clínica veterinária, <b>sem nenhum módulo</b>: o teste grátis da Clínica está livre para você ligar (teste F).'],
  ['luis.qa.petshop@petjourney.test', '<b>Nova (24/11).</b> Dona do "Pet Shop Luís QA", aprovada, só Pet shop, com CNPJ e telefone: serve para as categorias e o Veterinário autônomo (testes D e E).'],
  ['luis.qa.tutor@petjourney.test', '<b>Nova (24/11).</b> Responsável com o Thor (cachorro, alergia grave a dipirona, 18,4 kg) e o Espeto (ouriço, espécie Outro). Para o app: acessos temporários, convite e a ficha de emergência.'],
  ['qa-vacina-enfermagem@petjourney.test', 'Enfermagem da Clínica e Hotel Demo (teste B).'],
  ['qa-bruna, qa-rafael, qa-premium, qa-julia, qa-marina (@petjourney.test)', 'Responsáveis de QA ligados à clínica demo (Fubá, Nino, Luna da qa-premium...).'],
  ['qa-categorias-dono, qa-modulos-dono e qa-modulos-operador (@petjourney.test)', 'Contas do Nicolas para as categorias e os módulos. A Clínica da "Clínica QA Módulos" terminou desligada pelo admin: para o teste do zero, use a luis.qa.clinica.'],
  ['dev@gmail.com', 'O seu admin do cms-dev (a senha é a sua).'],
]

const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Guia rápido de teste: portal do parceiro (24/11)</title><style>${css}</style></head><body>
<h1>Guia rápido de teste: portal do parceiro</h1>
<div class="capa-sub">Os cards "Em teste" do módulo parceiro no Nevo · testados em 24/11/2026 no admin-dev, no cms-dev e no site de dev</div>

<div class="caixa"><h3>O que tem neste guia</h3>
<p style="margin:0 0 2mm">Um teste por card. Em cada um: o que foi conferido em 24/11, as contas, os passos com o que deve aparecer e prints marcados (caixa vermelha numerada no que olhar). Os cards que passaram estão com a caixa <b>Web</b> marcada no Nevo; iOS e Android ficam com você.</p>
<table><tr><th>Teste</th><th>Onde</th><th>Situação em 24/11</th></tr>${linhasIndice}</table></div>

<div class="caixa alerta"><h3>Antes de testar</h3><ul>
<li><b>O admin-dev está na versão ${VERSAO}</b> (veja no pé do login). Ela tem as correções achadas no teste (lista no fim). O site de dev tem a correção do captcha.</li>
<li><b>Todas as contas de teste usam a senha Teste@123</b>, menos o admin do CMS.</li>
<li><b>Na API de dev, gravar leva de 2 a 5 segundos.</b> Espere a resposta antes de achar que a tela não atualizou.</li>
<li><b>O que não dá para ver daqui:</b> as telas e os pushes do app, e a câmera lendo QR. Esses passos estão nos quadros cinza "Não conferido".</li>
<li><b>"Convite aberto com a conta errada":</b> já estava com Web marcada por você em 04/11 e não foi retestado, porque o link do convite de equipe só chega por e-mail.</li>
</ul></div>

<div class="caixa"><h3>Contas</h3>
<table class="compacta"><tr><th style="width:34%">Conta (senha Teste@123)</th><th>Para quê</th></tr>${contas.map(([c, p]) => `<tr><td><b>${c}</b></td><td>${p}</td></tr>`).join('')}</table></div>

<div class="caixa"><h3>Como usar</h3><ul>
<li>Cada passo diz de que lado é: <span class="lado lado-p">Portal</span> <span class="lado lado-a">App do responsável</span> <span class="lado lado-s">Site</span> <span class="lado lado-c">CMS</span></li>
<li>Faça o que está em negrito e confira o quadro verde <b>Deve aparecer</b>. Os textos entre aspas azuis são os nomes exatos na tela.</li>
<li>Nos prints, as caixas vermelhas numeradas mostram onde olhar, na ordem do passo.</li>
<li>Achou um problema? Anote a letra do teste, o passo, o print e a conta. Antes, leia <b>Não é bug</b> e a lista de achados no fim.</li>
</ul></div>

${testes.map(teste).join('\n')}

<section class="teste"><h3>Achados do teste de 24/11</h3>
<p>O que foi corrigido e o que depende de outra pessoa ou de uma decisão.</p>
<table class="compacta"><tr><th>Teste</th><th>O que é</th><th>Situação</th></tr>${pendencias.map(([t, o, c]) => `<tr><td>${t}</td><td>${o}</td><td>${c}</td></tr>`).join('')}</table>
<h3 style="margin-top:6mm">Folha de resultado</h3>
<p>Quem testou: ____________________ &nbsp; Data: ___/___/2026 &nbsp; Celular do app: ☐ Android ☐ iPhone</p>
<table class="resultado"><tr><th style="width:44%">Teste</th><th>Passou</th><th>Falhou</th><th style="width:36%">Passo e observação</th></tr>
${testes.map((t) => `<tr><td><b>${t.letra}.</b> ${t.titulo}</td><td>☐</td><td>☐</td><td></td></tr>`).join('')}</table>
</section>
</body></html>`

fs.writeFileSync(new URL('./guia.html', import.meta.url), html)
console.log('guia.html gerado,', testes.length, 'testes,', testes.reduce((s, t) => s + t.passos.length, 0), 'passos,', testes.reduce((s, t) => s + t.passos.reduce((n, p) => n + (p.prints?.length ?? 0), 0), 0), 'prints')
