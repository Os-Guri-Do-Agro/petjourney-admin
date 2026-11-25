// Guia rápido de teste (25/11/2026): um bloco curto por card, com os passos que importam e um print.
// Cobre os cards "Em teste" do Luís no Nevo: os 17 do módulo parceiro testados em 24/11 e os 2 da
// reavaliação do uso contínuo (25/11). O detalhe de cada teste fica no guia de 24/11 (docs/testes).
// Uso: node gerar.mjs  ->  guia.html (os prints ficam em ./prints, fora do git)
// PDF: msedge --headless=new --no-pdf-header-footer --print-to-pdf=<saida.pdf> guia.html
import fs from 'node:fs'

const AQUI = new URL('./', import.meta.url)
const VERSAO = JSON.parse(fs.readFileSync(new URL('../../../package.json', AQUI), 'utf8')).version
const q = (t) => `<span class="q">"${t}"</span>`
const LADOS = { P: ['Portal', 'p'], A: ['App', 'a'], S: ['Site', 's'], C: ['CMS', 'c'] }

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

/** Recorte de um print: x, y, w, h em pixels do original; mm é a largura no papel. */
function foto({ arq, x = 0, y = 0, w, h, mm = 84 }) {
  const [largura, altura] = medida(arq)
  const cw = w ?? largura - x
  const ch = h ?? altura - y
  const pc = (n) => ((n / cw) * 100).toFixed(3)
  return `<div class="corte" style="width:${mm}mm;height:${((mm * ch) / cw).toFixed(2)}mm"><img src="prints/${arq}.jpg" style="width:${pc(largura)}%;margin-left:-${pc(x)}%;margin-top:-${pc(y)}%"></div>`
}

const passo = ([lado, faz, ve]) =>
  `<li><span class="lado lado-${LADOS[lado][1]}">${LADOS[lado][0]}</span>${faz}${ve ? ` <span class="ve">→ ${ve}</span>` : ''}</li>`

function card(c) {
  const selos = `<span class="selo web">${c.web ?? 'Web marcada'}</span>${c.celular ? '<span class="selo cel">Celular</span>' : ''}`
  return `<section class="card">
  <div class="topo"><span class="letra">${c.letra}</span><h2>${c.titulo}</h2>${selos}<span class="marca">☐ Passou ☐ Falhou</span></div>
  <div class="meta"><b>Onde:</b> ${c.onde} · <b>Conta:</b> ${c.conta}</div>
  <div class="corpo"><div class="txt"><ol>${c.passos.map(passo).join('')}</ol>
  ${c.obs ? `<div class="obs">${c.obs}</div>` : ''}${c.bug ? `<div class="bug"><b>É bug se</b> ${c.bug}</div>` : ''}</div>
  <div class="fotos${c.lado ? ' lado' : ''}">${c.prints.map(foto).join('')}</div></div>
</section>`
}

const DEMO = 'portal-demo'
const cards = [
  {
    letra: 'A',
    titulo: 'Fotos dos pets em todas as listas',
    onde: 'Portal',
    conta: DEMO,
    passos: [
      ['P', `${q('Pacientes')}, aba ${q('Cadastros')}.`, 'Mel e Fubá com foto; os outros com a inicial em um círculo e a silhueta da espécie (Pipoca e Jim, de gato).'],
      ['P', `${q('Agenda')} › ${q('Marcar horário')}, campo ${q('Paciente')}: digite "Bi".`, 'o rosto antes de cada nome; Bisteca com "B", nunca "BT".'],
      ['P', `Interne a Mel e ponha o Nino na ${q('Lista de espera')}.`, 'a foto no mapa dos leitos e depois do "1º" na fila. No fim, dê alta e tire da fila.'],
    ],
    obs: 'Pet ligado ao app mostra a inicial na primeira leitura e a foto do app na seguinte.',
    bug: 'aparecer imagem quebrada, quadrado vazio ou gato com silhueta de cachorro.',
    prints: [{ arq: 'fotos-01-pacientes', x: 200, y: 225, w: 760, h: 600 }],
  },
  {
    letra: 'B',
    titulo: 'Lembrete de vacina e "Editar registro"',
    celular: true,
    onde: 'Portal; o push chega no app',
    conta: `${DEMO}; app qa-bruna (Fubá); Enfermagem qa-vacina-enfermagem`,
    passos: [
      ['P', `${q('Vacinas')} › ${q('Lista de chamada')}.`, `${q('Ativar lembrete')} em Mel, Nino e Fubá; no Bidu, sem app, só ${q('Ligue para o telefone do cadastro')}.`],
      ['P', `Na Fubá, ${q('Ativar lembrete')} e confirme na gaveta.`, `a prévia ${q('Vacina de Fubá chegando')}; depois, ${q('Lembrete ativo')} com o último e o próximo envio.`],
      ['A', 'Celular com a qa-bruna e as notificações ligadas; espere até 2 minutos.', 'o push "Vacina de Fubá chegando"; o toque abre as Vacinas da Fubá.'],
      ['P', `"..." da Fubá › ${q('Editar registro')}: motivo de 3 letras, depois um de verdade.`, `com 3 letras nada sai; com o certo, ${q('Registro corrigido.')}`],
    ],
    obs: 'O primeiro aviso de uma dose sai uma vez a cada 24 h (o da Fubá foi ligado em 24/11 às 15h44). Desligar e religar no mesmo dia não manda push.',
    bug: 'o Bidu mostrar "Ativar lembrete" ou a Enfermagem ver o botão do lembrete.',
    prints: [{ arq: 'lem-01-chamada', x: 300, y: 190, w: 1110, h: 690 }],
  },
  {
    letra: 'C',
    titulo: 'Convite para o app por WhatsApp, QR e código',
    celular: true,
    onde: 'Portal e site; o aceite é no app',
    conta: DEMO,
    passos: [
      ['P', `${q('Pacientes')} › ${q('Cadastrar paciente')}: cliente novo com o seu celular de teste e sem e-mail.`, `${q('Convidar para o app agora?')} com ${q('Enviar pelo WhatsApp')}, ${q('Mostrar QR')} e ${q('Copiar mensagem')}.`],
      ['P', `${q('Enviar pelo WhatsApp')} e ${q('Mostrar QR')}.`, 'a mensagem com o link, o código XXXX-XXXX e a validade de 7 dias; o Esc fecha só o QR.'],
      ['S', 'Abra o link trocando "https://petjourney.health" por "https://dev.petjourney.health".', `${q('Clínica e Hotel Demo quer conectar seus pets ao app PetJourney')}, sem nome de pet, de pessoa nem o código.`],
      ['A', 'No celular, toque no link e aceite.', 'na ficha do pet, "Ligado desde [data], por convite por link."'],
    ],
    obs: 'Cada abertura da gaveta na ficha cria um convite novo: vale o último.',
    prints: [{ arq: 'conv-01-convidar-agora', x: 868, y: 0, w: 572, h: 380, mm: 74 }],
  },
  {
    letra: 'D',
    titulo: 'Veterinário autônomo, recorte do diário e espécie Outro',
    celular: true,
    onde: 'Portal; o acesso é criado no app',
    conta: 'luis.qa.petshop (Veterinário); portal-demo (Acessos); app qa-premium (Luna)',
    passos: [
      ['P', `${q('Configurações')} › ${q('Empresa')}: marque "Veterinário autônomo".`, 'aparece o campo CRMV; salvo, continua depois do F5.'],
      ['A', `No app, novo acesso temporário com ${q('Diário do pet')} dos últimos 7 dias. No portal, ${q('Acessos')} › ${q('Novo acesso temporário')} com o código.`, `${q('Todos os registros de [data] a [data], como o responsável escolheu.')}`],
      ['P', `${q('Acessos')} › ${q('Filtros')} › Espécie › ${q('Outro')}.`, 'só o Espinho, com "Ouriço" no cartão.'],
    ],
    prints: [{ arq: 'ace-02-recorte-diario', x: 305, y: 355, w: 440, h: 270, mm: 74 }],
  },
  {
    letra: 'E',
    titulo: 'A empresa escolhe mais de uma categoria',
    onde: 'Portal, CMS e site',
    conta: 'luis.qa.petshop; CMS dev@gmail.com',
    passos: [
      ['P', `${q('Configurações')} › ${q('Empresa')}: marque mais duas categorias e salve.`, `a primeira com ${q('Principal')}, as outras com ${q('Tornar principal')}; a ordem continua depois do F5.`],
      ['P', 'Desmarque todas e tente salvar.', `${q('Escolha pelo menos uma categoria.')} e nada é salvo.`],
      ['C', `${q('Parceiros')} › editar a mesma empresa › ${q('Tornar principal')} em outra e salve.`, 'na lista, os selos com a principal primeiro; o filtro acha a empresa por qualquer categoria.'],
      ['S', '/cadastro?perfil=parceiro com um e-mail novo e duas categorias.', 'no portal, a empresa nova com a principal que você escolheu primeiro.'],
    ],
    obs: 'Portal e CMS mexem na mesma empresa: não teste os dois ao mesmo tempo.',
    prints: [{ arq: 'cm-cat-02-portal-tres-categorias', x: 600, y: 330, w: 800, h: 220 }],
  },
  {
    letra: 'F',
    titulo: 'O dono liga e desliga os módulos',
    onde: 'Portal e CMS',
    conta: 'luis.qa.clinica (o teste grátis da Clínica está livre); CMS dev@gmail.com',
    passos: [
      ['P', `${q('Início')}, faixa dos módulos › ${q('Ligar teste grátis de 30 dias')} na Clínica.`, `${q('Clínica: teste grátis ligado até [data].')} e o menu ganha a Clínica sem recarregar.`],
      ['P', `${q('Desligar')} e confirme.`, `${q('Desligado por você. Você pode religar até [data].')}; a Agenda fica sem "Marcar horário".`],
      ['C', `${q('Parceiros')} › a empresa › ${q('Módulos')}.`, `${q('Desligado pelo parceiro em [data]')} e o histórico do parceiro.`],
    ],
    obs: 'O teste grátis liga uma vez por módulo: depois deste teste, a luis.qa.clinica não tem mais o da Clínica.',
    prints: [{ arq: 'cm-mod-02-portal-ligado', x: 0, y: 0, w: 1440, h: 580 }],
  },
  {
    letra: 'G',
    titulo: 'Registro de uso: quem entrou e que telas abriu',
    onde: 'Portal e CMS',
    conta: `${DEMO}; CMS dev@gmail.com`,
    passos: [
      ['P', 'Entre e abra três telas, com o F12 › Network (filtro "uso").', 'POST .../uso/eventos com 202 a cada 10 segundos; a rota sem o id do paciente (/clinica/ficha/:petId).'],
      ['C', `${q('Uso da plataforma')}, usuário portal-demo.`, '"Entrou" e um "Abriu tela" por tela.'],
      ['P', 'Saia, erre a senha uma vez e entre.', 'no CMS, "Saiu", "Login recusado · Senha errada" e "Entrou".'],
    ],
    obs: 'Não erre a senha mais de 2 vezes seguidas: o login tem limite por minuto. A linha leva até 10 segundos para chegar ao CMS.',
    prints: [{ arq: 'e12-uso-03-cms-saiu-recusado-entrou', x: 285, y: 395, w: 1105, h: 330 }],
  },
  {
    letra: 'H',
    titulo: 'QR da página pública no padrão da marca',
    onde: 'Portal',
    conta: DEMO,
    passos: [
      ['P', `${q('Estabelecimento')} › ${q('Página pública')}.`, 'um QR da clínica e um do hotel, em sálvia, arredondados, com a pata no centro.'],
      ['P', `${q('Baixar ou imprimir')}: PNG, SVG e ${q('Folha para o balcão')}.`, 'iguais à tela; a folha A4 com o nome, o QR e o endereço.'],
      ['P', `${q('Trocar endereço')} para clinica-e-hotel-demo-2 e depois volte.`, 'o link muda e a imagem do QR não. Deixe em clinica-e-hotel-demo.'],
    ],
    prints: [{ arq: 'qr-01-aba', x: 310, y: 185, w: 640, h: 410, mm: 70 }],
  },
  {
    letra: 'I',
    titulo: '"Apagar vários" feriados em um pedido só',
    onde: 'Portal, com o F12 › Network aberto',
    conta: 'luis.qa.clinica',
    passos: [
      ['P', `${q('Estabelecimento')} › ${q('Horários')}: cadastre 3 feriados futuros, ${q('Apagar vários')}, marque os 3 e ${q('Apagar 3')}.`, 'um POST só (.../dias-especiais/remover) e os 3 somem.'],
      ['P', 'Marque dois, apague um deles em outra aba e, nesta, apague os dois.', `sem erro: ${q('Feriados removidos')}.`],
    ],
    bug: 'sair um DELETE por dia em vez de um POST só.',
    prints: [{ arq: 'apg-01-marcados', x: 975, y: 140, w: 440, h: 340, mm: 62 }],
  },
  {
    letra: 'J',
    titulo: 'Ficha de emergência pelo QR da coleira',
    onde: 'Portal',
    conta: `${DEMO} (CRMV conferido); o pet é o Thor, da luis.qa.tutor`,
    passos: [
      ['P', `${q('Acessos')} › ${q('Emergência pelo QR')}: cole petjourney.health/carteirinha/2aeecbbedd50f1e7f35a226b02760668 e um motivo de 5 letras.`, `${q('Escreva de 10 a 300 caracteres.')} e nada sai.`],
      ['P', `Motivo certo › ${q('Abrir ficha')}.`, `${q('O responsável foi avisado agora.')}, o Thor com 18,4 kg e a alergia grave a dipirona.`],
      ['P', 'Um código que não existe.', `${q('Ficha indisponível para este QR.')}`],
    ],
    obs: 'Cada ficha aberta avisa o responsável (no máximo 10 por pessoa e 30 por clínica em 24 h).',
    prints: [{ arq: 'eme-02-ficha', x: 965, y: 20, w: 475, h: 300, mm: 70 }],
  },
  {
    letra: 'K',
    titulo: 'E1 · Fundação do estabelecimento',
    onde: 'Portal, site e CMS',
    conta: `${DEMO}; Enfermagem qa-vacina-enfermagem; CMS dev@gmail.com`,
    passos: [
      ['S', `dev.petjourney.health/agendar/clinica-e-hotel-demo › ${q('Pedir horário')}.`, `${q('PASSO 1 DE 5')} e, no último passo, o captcha de teste; nada de "indisponível".`],
      ['P', `${q('Equipe')} › ${q('Profissionais')} › ${q('Cadastrar profissional')} com um CRMV que já existe.`, `${q('Já existe um profissional com este registro (ou este usuário) neste estabelecimento.')}`],
      ['P', `${q('Equipe')} › ${q('Auditoria')}; depois o mesmo endereço com a Enfermagem.`, `frases legíveis ("criou uma baixa de lote"); para a Enfermagem, só ${q('Seu papel na equipe não permite esta ação.')}`],
      ['C', `${q('Identidade e CRMV')} › a Portal Demo › ${q('Conferir de novo')}.`, `${q('CRMV conferido: Portal Demo')} e ${q('O selo vale 365 dias.')}`],
    ],
    prints: [{ arq: 'v084-auditoria', x: 300, y: 225, w: 820, h: 370 }],
  },
  {
    letra: 'L',
    titulo: 'E2 · Clientes, pacientes e a ponte com o app',
    celular: true,
    onde: 'Portal; o diário vem do app',
    conta: `${DEMO}; app qa-bruna (Fubá)`,
    passos: [
      ['P', `${q('Cadastrar paciente')} com CEP; depois, outro cliente com o mesmo CPF.`, `o CEP preenche o endereço; o CPF repetido oferece ${q('Usar este cliente')}.`],
      ['A', 'No app da qa-bruna, registre o diário da Fubá (um registro depois das 21h também).', 'no portal, cada registro no dia em que foi feito.'],
      ['P', `Ficha da Fubá › ${q('Este pet em 30 segundos')} e ${q('Ver o diário')}.`, 'o que mudou em casa, o peso de 6 meses e os tratamentos em casa.'],
      ['P', `${q('Importar planilha')} com 3 linhas; depois, desfaça.`, 'o resumo, a importação e, ao desfazer, tudo como antes.'],
    ],
    prints: [{ arq: 'e203-01-resumo', x: 905, y: 120, w: 535, h: 420, mm: 70 }],
  },
  {
    letra: 'M',
    titulo: 'E3 · Agenda e recepção',
    celular: true,
    onde: 'Portal e site; a pré-consulta é respondida no app',
    conta: `${DEMO}; cliente da casa "QA Épicos C 24/11", (11) 97000-2411; app qa-bruna`,
    passos: [
      ['P', `${q('Agenda')}: marque um horário em cima de outro e abra a gaveta; depois, ${q('Fechar o turno')}.`, `${q('Avisos')} com a sobreposição; a falta marcada com ${q('Desfazer')}.`],
      ['S', `Peça um horário em dev.petjourney.health/agendar/clinica-e-hotel-demo com o telefone do cliente da casa. No portal, ${q('Pedidos')} › ${q('Responder')}.`, `o cliente da casa já escolhido (${q('Já é cliente')}) e a ficha que ele já tem; nenhum cliente repetido.`],
      ['A', 'Marque um horário da Fubá e responda a pré-consulta no app da qa-bruna (abre 72 h antes).', `no portal, ${q('Ver a pré-consulta')} com "Respondida em"; na Anamnese, ${q('Nada entra sozinho na anamnese.')} e ${q('Usar')}.`],
    ],
    obs: 'Não é bug (vem da API): o selo "Pedidos" pode ficar com o número velho por até 5 minutos (N56) e a pré-consulta aparece "editada" já na primeira resposta (N57).',
    prints: [{ arq: 'b2-01-cadastro-da-casa', x: 905, y: 425, w: 535, h: 400, mm: 70 }],
  },
  {
    letra: 'N',
    titulo: 'E4 · Prontuário, receita, vacinas e documentos',
    celular: true,
    web: 'Web em 7 de 9',
    onde: 'Portal, site e CMS; os tratamentos em casa vêm do app',
    conta: `${DEMO} (a senha de assinatura é a da conta); app qa-bruna`,
    passos: [
      ['P', `Atendimento › ${q('Receita e documentos')} › ${q('Prescrever')} do catálogo, por peso.`, `a confirmação do arredondamento com ${q('Estou ciente')}; no Bulário, a faixa com vírgula ("0,1 a 0,2 mg/kg").`],
      ['P', `${q('Fazer a receita')} › ${q('Assinar')}: senha errada, depois a certa.`, `${q('Senha incorreta.')}; depois ${q('Receita assinada.')} com código, ${q('Abrir o PDF')}, ${q('Repetir')} e ${q('Cancelar a receita')}.`],
      ['S', 'dev.petjourney.health/receita/ com o código; depois cancele no portal.', `${q('Receita válida')}; cancelada, ${q('Receita cancelada')} e, no portal, só ${q('Repetir')}.`],
      ['P', `Na ficha, ${q('Aplicar vacina')} com lote e um termo com ${q('Registrar aceite')} no balcão.`, 'a dose sai do lote; o termo passa de "aceite pendente" a "aceito".'],
      ['A', `${q('Pendências')} › ${q('Tratamentos em casa')} com a Fubá (app da qa-bruna).`, `o tratamento criado no app, o crítico e ${q('Registrar contato')}.`],
    ],
    obs: 'Sem Web no Nevo: os tratamentos em casa (passo 5) e a curadoria do catálogo no CMS, que só foi lida para não mexer no catálogo das clínicas.',
    prints: [{ arq: 'e36-e4-09-receita-assinada', x: 615, y: 330, w: 775, h: 300 }],
  },
  {
    letra: 'O',
    titulo: 'E5 · Internação',
    celular: true,
    onde: 'Portal; o boletim chega no app',
    conta: `${DEMO}; app qa-bruna (Fubá); o plantão vai para a qa-vacina-enfermagem`,
    passos: [
      ['P', `${q('Internação')} › um leito livre › ${q('Internar')} a Fubá; ${q('Prescrever')} e ${q('Dei')}.`, `${q('Dada por Portal Demo às ...')} com ${q('Desfazer')}.`],
      ['P', `Gravidade ${q('Crítico')}.`, `na hora, o boletim ${q('Retido')} com ${q('piorou: ligue antes')}; ${q('Registrar ligação')} e ${q('Enviar')} dão ${q('Boletim enviado ao app.')}`],
      ['P', `Aba Mapa, cartão do plantão › ${q('Passar plantão')} para a Enfermagem QA Vacina.`, `${q('Plantão entregue a Enfermagem QA Vacina')}`],
      ['P', `${q('Encerrar internação')} › ${q('Dar alta')}.`, `as doses futuras ${q('Suspensa')}, sem ${q('Dei')} nem ${q('Pulei')}; o leito fica livre.`],
      ['A', 'No app da qa-bruna, a internação da Fubá.', 'o boletim com "Depois da conversa por telefone".'],
    ],
    prints: [{ arq: 'e5f-05-boletim-retido', x: 325, y: 360, w: 1075, h: 180 }],
  },
  {
    letra: 'P',
    titulo: 'E6 · Estoque de vacinas',
    onde: 'Portal',
    conta: DEMO,
    passos: [
      ['P', `${q('Vacinas')} › ${q('Estoque')} › ${q('Receber lote')}.`, `${q('Lote ... recebido, N doses.')}`],
      ['P', `${q('Movimentos')} › ${q('Estornar')} com um motivo.`, `a linha riscada e ${q('Estornada por ...')} com o motivo.`],
      ['P', `${q('Metas')} › ${q('Planejar dezembro')}: troque a meta da V10 sem sair do campo.`, `a frase do pedido de compra muda sozinha; ${q('Copiar pedido')} copia o texto.`],
    ],
    prints: [{ arq: 'e36-e6-02-movimentos-estorno', x: 310, y: 262, w: 1090, h: 140 }],
  },
  {
    letra: 'Q',
    titulo: 'Fronts: os endereços antigos',
    onde: 'Portal',
    conta: DEMO,
    passos: [
      ['P', 'Abra portal-dev.petjourney.health/veterinario/agenda?agrupar=sala.', 'vai para /clinica/agenda?agrupar=sala, também depois do login.'],
      ['P', 'Abra /veterinario/compartilhamentos.', `vai para ${q('Acessos')}.`],
    ],
    bug: 'algum endereço /veterinario/* cair na página "não encontrada".',
    prints: [{ arq: 'e12-fr-01-veterinario-vira-clinica', x: 0, y: 140, w: 760, h: 200, mm: 70 }],
  },
  {
    letra: 'R',
    titulo: 'Prescrição: reavaliar em N dias no uso contínuo',
    celular: true,
    onde: 'Portal; a resposta vem do app',
    conta: `${DEMO}; app qa-bruna (Fubá)`,
    passos: [
      ['P', `Atendimento da Fubá › ${q('Prescrever')} Enalapril 5 mg, 1 comprimido por dia, ${q('Uso contínuo')} e ${q('Reavaliar em')} 90 dias.`, 'a linha termina em "uso contínuo. Reavaliar em 90 dias." Com duração de 10 dias, o campo some.'],
      ['P', `${q('Reavaliar em')} 800 dias.`, `${q('A reavaliação precisa ser de 1 a 730 dias.')}`],
      ['P', `Assine a receita, finalize e ${q('Liberar o resumo')}.`, 'o PDF diz "Reavaliar em 90 dias." Guarde o PDF para o card S.'],
      ['P', `${q('Pacientes')} › Fubá › ${q('Tratamentos em casa')}.`, `o Enalapril com ${q('Reavaliar em 23/02/2027')}; vencida, ${q('Reavaliação vencida')} em destaque.`],
      ['A', 'A qa-bruna responde a pergunta no app.', `o selo vira ${q('Nova data: [data]')}, ${q('Responsável continuou sem data ([data])')} ou ${q('Encerrado pelo responsável ([data])')}.`],
    ],
    obs: 'Não é bug: a data das respostas segue o fuso do computador. Antes de liberar o resumo, a API diz que o pet não tem vínculo (lacuna N59). Na leitura com IA da anotação do parceiro, o prazo vai para as instruções (lacuna N58).',
    prints: [
      { arq: 'r090-01-reavaliar-na-prescricao', x: 875, y: 480, w: 560, h: 230 },
      { arq: 'r090-05-ficha-reavaliar-em', x: 340, y: 232, w: 600, h: 110 },
    ],
  },
  {
    letra: 'S',
    titulo: 'App: data de reavaliação e "O veterinário mandou continuar?"',
    celular: true,
    onde: 'App no celular (a Web foi testada no app pelo navegador)',
    conta: 'app qa-premium (Luna); app qa-bruna (Fubá)',
    passos: [
      ['A', `Luna › ${q('Remédios de uso contínuo')}.`, `o Enalapril com o selo ${q('Reavaliar')} (venceu em 24/11).`],
      ['A', 'Abra o Enalapril.', `${q('O veterinário mandou continuar?')} com ${q('Continuar sem data')}, ${q('Nova data')} e ${q('Encerrar')}.`],
      ['A', `${q('Nova data')}: escolha amanhã.`, `o seletor do celular não deixa hoje nem dia passado; o detalhe diz ${q('Reavaliação em')} amanhã.`],
      ['A', 'Amanhã, depois das 9h, espere a hora cheia.', 'chega "Hora de reavaliar o ... de Luna"; o toque abre a pergunta.'],
      ['A', 'Leia pela câmera ou pelo arquivo o PDF da receita do card R.', `no resumo, ${q('Reavaliar em')} com a data da receita mais 90 dias.`],
    ],
    obs: 'Não é bug: os avisos das doses continuam depois da data; o aviso da reavaliação sai no máximo 3 vezes (no dia, 7 e 14 dias depois). O nome do Enalapril da Luna está com o acento quebrado desde o preparo da conta.',
    lado: true,
    prints: [
      { arq: 'a090-01-lista-selo', x: 0, y: 480, w: 390, h: 140, mm: 41 },
      { arq: 'a090-02-pergunta', x: 0, y: 225, w: 390, h: 330, mm: 41 },
    ],
  },
]

const contas = [
  ['portal-demo@petjourney.test', 'Clínica e Hotel Demo, dona, com o CRMV conferido. Quase todos os cards.'],
  ['luis.qa.clinica@petjourney.test', 'Clínica Luís QA, sem módulo: o teste grátis está livre (F e I).'],
  ['luis.qa.petshop@petjourney.test', 'Pet Shop Luís QA: categorias e Veterinário autônomo (D e E).'],
  ['luis.qa.tutor@petjourney.test', 'Responsável do Thor e do Espinho, um ouriço (J e D).'],
  ['qa-bruna@petjourney.test', 'App: responsável da Fubá, ligada à clínica (B, L, M, N, O, R e S).'],
  ['qa-premium@petjourney.test', 'App: responsável da Luna (D e S).'],
  ['qa-vacina-enfermagem@petjourney.test', 'Enfermagem da clínica demo (B, K e O).'],
  ['dev@gmail.com', 'O seu admin do cms-dev, com a sua senha.'],
]

const css = `
@page { size: A4; margin: 10mm 11mm; }
* { box-sizing: border-box; }
body { font-family: "Segoe UI", system-ui, sans-serif; color: #1F2A2E; font-size: 9.4pt; line-height: 1.38; margin: 0; }
h1 { color: #2E5A4C; font-size: 19pt; margin: 0 0 .5mm; }
h2 { font-size: 11.5pt; margin: 0; flex: 1; }
h3 { color: #2E5A4C; font-size: 11pt; margin: 0 0 1.5mm; }
.sub1 { color: #5B6B70; margin-bottom: 3mm; }
.q { color: #2B5E9C; font-weight: 600; }
.caixa { border: 1px solid #DCE3E1; border-radius: 8px; padding: 3mm 4mm; margin-bottom: 3mm; }
.caixa ul { margin: 0; padding-left: 4.5mm; } .caixa li { margin: .6mm 0; }
table { width: 100%; border-collapse: collapse; font-size: 8.8pt; }
th { background: #EEF2F1; text-align: left; padding: 1.3mm 1.8mm; }
td { border-top: 1px solid #E3E8E6; padding: .8mm 1.8mm; vertical-align: top; }
.card { border: 1px solid #DCE3E1; border-radius: 8px; padding: 2.6mm 3.5mm 3mm; margin-bottom: 3.5mm; break-inside: avoid; }
.topo { display: flex; align-items: center; gap: 2.5mm; border-bottom: 1.5px solid #2E5A4C; padding-bottom: 1.5mm; margin-bottom: 1.5mm; }
.letra { width: 7.5mm; height: 7.5mm; border-radius: 50%; background: #2E5A4C; color: #fff; font-weight: 700; font-size: 11pt; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.selo { font-size: 7.6pt; font-weight: 700; border-radius: 4px; padding: .4mm 1.8mm; white-space: nowrap; }
.selo.web { background: #E3F1E8; color: #2E6B47; }
.selo.cel { background: #DDE8F4; color: #2B5E9C; }
.marca { font-size: 8.4pt; color: #2E5A4C; white-space: nowrap; border: 1px solid #C9D6D2; border-radius: 5px; padding: .3mm 2mm; }
.meta { font-size: 8.6pt; color: #3D4B50; margin-bottom: 1.6mm; }
.corpo { display: grid; grid-template-columns: 1fr auto; gap: 4.5mm; align-items: start; }
ol { margin: 0; padding-left: 4.6mm; } ol li { margin: 0 0 1.1mm; padding-left: .5mm; }
.ve { color: #2E6B47; }
.lado { display: inline-block; font-size: 7pt; font-weight: 700; text-transform: uppercase; letter-spacing: .3px; border-radius: 3px; padding: 0 1.4mm; margin-right: 1.5mm; vertical-align: 1px; }
.lado-p { background: #DCEBE6; color: #2E5A4C; } .lado-a { background: #DDE8F4; color: #2B5E9C; } .lado-s { background: #EEE6F6; color: #6A4A8C; } .lado-c { background: #F1E9DD; color: #7A5A2A; }
.obs { background: #F3F6F8; border-radius: 5px; padding: 1.2mm 2.5mm; font-size: 8.5pt; margin-top: 1.2mm; color: #3D4B50; }
.bug { background: #FBEAEA; border-radius: 5px; padding: 1.2mm 2.5mm; font-size: 8.5pt; margin-top: 1.2mm; }
.fotos { display: flex; flex-direction: column; gap: 2mm; }
.fotos.lado { flex-direction: row; align-items: flex-start; }
.corte { overflow: hidden; border-radius: 5px; border: 1px solid #CBD5D2; }
.corte img { display: block; }
.res td:nth-child(n+3) { white-space: nowrap; width: 1%; }
.res td, .res th { padding-top: .8mm; padding-bottom: .8mm; }
.quebra { break-before: page; }
`

const linhas = cards
  .map((c) => `<tr><td><b>${c.letra}</b></td><td>${c.titulo}</td><td>${c.celular ? 'iOS ☐ Android ☐' : ''}</td><td>☐ Passou ☐ Falhou</td></tr>`)
  .join('')

const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Guia rápido de teste (25/11)</title><style>${css}</style></head><body>
<h1>Guia rápido de teste</h1>
<div class="sub1">Os cards do Luís em teste no Nevo: os 17 do módulo parceiro (24/11) e os 2 da reavaliação do uso contínuo (25/11) · admin-dev ${VERSAO}</div>

<div class="caixa"><h3>Como usar</h3><ul>
<li>Um bloco por card: faça cada passo e confira o que vem depois da seta. O texto entre aspas azuis é o que está escrito na tela; nos prints, as caixas vermelhas mostram onde olhar. Todos os passos, o que não é bug e os erros achados ficam no guia de 24/11.</li>
<li>A <b>Web</b> já está marcada no Nevo em todos (no E4, em 7 das 9 subtarefas). O selo <span class="selo cel">Celular</span> mostra os cards com uma parte no app: é o que falta para marcar iOS e Android.</li>
<li>As contas de teste usam a senha <b>Teste@123</b>. Na API de dev, cada gravação leva de 2 a 5 segundos.</li>
</ul></div>

<div class="caixa"><h3>Contas</h3>
<table><tr><th style="width:38%">Conta</th><th>Para quê</th></tr>${contas.map(([c, p]) => `<tr><td><b>${c}</b></td><td>${p}</td></tr>`).join('')}</table></div>

<div class="caixa"><h3>Resultado</h3>
<table class="res"><tr><th></th><th>Card</th><th>Celular</th><th>Resultado</th></tr>${linhas}</table></div>

<div class="quebra"></div>
${cards.map(card).join('\n')}
</body></html>`

fs.writeFileSync(new URL('./guia.html', AQUI), html)
console.log('guia.html gerado:', cards.length, 'cards,', cards.reduce((s, c) => s + c.passos.length, 0), 'passos,', cards.reduce((s, c) => s + c.prints.length, 0), 'prints')
