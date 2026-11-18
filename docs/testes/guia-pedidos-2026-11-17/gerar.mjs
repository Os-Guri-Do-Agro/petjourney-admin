// Gera o guia básico de teste dos pedidos de 17/11 (HTML para imprimir em PDF pelo Edge).
// Mesmo molde do guia de 09/11 (docs/testes/guia-portal-2026-11-09), mais curto: um teste por pedido.
// Uso: node gerar.mjs  ->  guia.html (as capturas ficam em ./prints, fora do git)
// PDF: msedge --headless --no-pdf-header-footer --print-to-pdf=<saida.pdf> guia.html
import fs from 'node:fs'

const AQUI = new URL('./', import.meta.url)
const q = (t) => `<span class="q">"${t}"</span>` // nome exato de botão, tela ou texto
const b = (t) => `<b>${t}</b>`
const lados = {
  P: ['Portal', 'lado-p'],
  A: ['App do responsável', 'lado-a'],
  S: ['Site', 'lado-s'],
  C: ['CMS', 'lado-c'],
}

/** Largura e altura de um JPEG, lidas do cabeçalho. */
function medida(arquivo) {
  const buf = fs.readFileSync(new URL(`prints/${arquivo}.jpg`, AQUI))
  let i = 2
  while (i < buf.length) {
    if (buf[i] !== 0xff) { i++; continue }
    const marca = buf[i + 1]
    if (marca >= 0xc0 && marca <= 0xc3) return [buf.readUInt16BE(i + 7), buf.readUInt16BE(i + 5)]
    i += 2 + buf.readUInt16BE(i + 2)
  }
  throw new Error(`sem medida: ${arquivo}`)
}

/* As capturas do portal e do CMS são de 1440 px de largura; as do site, de 1280 (computador) e
   390 (celular). "conteudo" tira o menu lateral do portal; "cms" tira o do CMS; "gaveta" mostra só a
   gaveta da direita; "formulario" é a coluna do cadastro do site; "celular" é a tela do celular;
   "tudo" é a tela inteira. Cada corte tem a sua escala (mm por pixel). Os cortes estreitos ficam ao
   lado do texto do passo. */
const CORTES = {
  tudo: { x: 0, w: 1440, mm: 0.095 },
  conteudo: { x: 272, w: 1168, mm: 0.105 },
  cms: { x: 249, w: 1191, mm: 0.105 },
  gaveta: { x: 955, w: 485, mm: 0.12 },
  dialogo: { x: 505, w: 430, mm: 0.14 },
  formulario: { x: 170, w: 400, mm: 0.12 },
  celular: { x: 0, w: 390, mm: 0.15 },
}
const AO_LADO = new Set(['gaveta', 'dialogo', 'formulario', 'celular'])

function foto([arquivo, corte = 'conteudo']) {
  const { x, w, mm } = CORTES[corte]
  const [largura, altura] = medida(arquivo)
  const larguraDoCorte = Math.min(w, largura - x)
  return `<div class="corte corte-${corte}" style="width:${(larguraDoCorte * mm).toFixed(1)}mm;aspect-ratio:${larguraDoCorte}/${altura}"><img src="prints/${arquivo}.jpg" style="width:${((largura / larguraDoCorte) * 100).toFixed(3)}%;margin-left:-${((x / larguraDoCorte) * 100).toFixed(3)}%"></div>`
}

function passo(n, p) {
  const lado = p.lado ? `<span class="lado ${lados[p.lado][1]}">${lados[p.lado][0]}</span>` : ''
  const prints = p.prints ?? []
  const nota = p.nota ? `<div class="nota">${p.nota}</div>` : ''
  const erro = p.erro ? `<div class="erro">No preparo: ${p.erro}</div>` : ''
  const nc = p.naoConferido ? `<div class="nc">Não conferido no preparo: ${p.naoConferido}</div>` : ''
  const simulado = p.simulado ? `<div class="sim">No preparo: ${p.simulado}</div>` : ''
  const texto = `<div class="bloco"><div class="acao"><span class="num">${n}</span><div>${lado}${p.acao}</div></div>
  <div class="deve"><b>Deve aparecer:</b> ${p.deve}</div>${simulado}${erro}${nota}${nc}</div>`
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
  <div class="ficha"><p><b>Onde:</b> ${t.onde}</p><p><b>Conta:</b> ${t.conta}</p>${t.antes ? `<p><b>Antes de começar:</b> ${t.antes}</p>` : ''}</div>
  ${t.passos.map((p, i) => passo(i + 1, p)).join('')}
  <div class="fim">${lista('Não é bug (pode parecer, mas está certo)', 'naobug', t.naoBug)}
  ${lista('É bug se', 'ebug', t.bug)}</div>
  </section>`
}

const CLINICA = 'portal-demo@petjourney.test (senha Teste@123), dona da "Clínica e Hotel Demo".'
const BRUNA = 'qa-bruna@petjourney.test (senha Teste@123), responsável da Fubá, ligada à clínica.'
const PORTAL = 'portal, no computador (1280 px de largura ou mais) ou no tablet.'
const SIMULADO_PORTAL = 'tela aberta no portal local lendo a API de dev; o que grava foi respondido no próprio navegador (nada foi gravado na API).'

const testes = [
  {
    letra: 'A', ondeCurto: 'Portal', situacaoCurta: 'Passou, com fotos simuladas', titulo: 'Fotos dos pets nas listas', sub: 'Pedido 1: a foto da clínica ou a do app, e as iniciais quando não há foto',
    situacao: 'Preparo em 17/11 no portal: passou. A clínica de QA não tem paciente com foto, internado nem fila: as fotos e esses estados foram simulados no navegador. A API de dev já manda o campo da foto.',
    tom: 'atencao',
    onde: PORTAL, conta: CLINICA,
    antes: 'Ponha foto em um paciente pela ficha ("Pôr foto"). Para ver a foto que vem do app, use um paciente ligado a um responsável que tem foto do pet no app (a Fubá, se a Bruna puser foto nela).',
    passos: [
      { lado: 'P', acao: `${b('Clínica >')} ${q('Pacientes')}${b(', aba')} ${q('Cadastros')}.`, deve: 'A foto redonda ao lado do nome de quem tem foto. Quem não tem mostra a inicial num círculo claro com a silhueta da espécie bem apagada atrás (gato, cachorro...).', simulado: SIMULADO_PORTAL, prints: [['portal-1-1']] },
      { lado: 'P', acao: `${b('Abra a ficha de um paciente com vínculo e foto no app, volte e recarregue')} ${q('Pacientes')} ${b('alguns segundos depois.')}`, deve: 'Na primeira leitura, as iniciais; depois de recarregar, a foto do app no lugar delas.', naoConferido: 'a conta de QA não tem paciente com foto no app.' },
      { lado: 'P', acao: `${q('Início')}${b(', bloco')} ${q('Agenda da semana')}${b(', com um pet chamado Bisteca e outro Bolinha de Neve marcados.')}`, deve: `Bisteca com a inicial ${q('B')} (antes saía "BT") e Bolinha de Neve com ${q('BN')}.`, simulado: 'horários simulados; a regra também passou nos testes automáticos.', prints: [['portal-1-3']] },
      { lado: 'P', acao: `${b('Clínica >')} ${q('Internação')}${b(', mapa dos leitos, com um gato internado sem foto.')}`, deve: 'A foto no leito de quem tem; o gato sem foto com a inicial e a silhueta de gato (antes não havia silhueta). Tocando no leito, a foto grande no alto do detalhe da internação.', simulado: 'internados simulados.', prints: [['portal-1-2']] },
      { lado: 'P', acao: `${q('Agenda')} > ${q('Marcar horário')}${b(' e toque no campo do paciente.')} ${b('Faça o mesmo em')} ${q('Atender agora')}${b(', na fila, na internação e no hotel.')}`, deve: 'Em cada opção da lista, o rosto do pet (foto ou iniciais) antes do nome. No cartão de cada horário da agenda do dia, um rosto pequeno entre a hora e o nome.', simulado: 'conferido em "Marcar horário" e "Atender agora"; as outras gavetas usam o mesmo componente.', prints: [['portal-1-4']] },
      { lado: 'P', acao: `${b('Ainda com a foto aparecendo: no Chrome, F12 > aba Network, botão direito numa foto >')} ${q('Block request domain')}${b(', e recarregue Pacientes, Agenda, Vacinas e Internação.')}`, deve: 'Em todas, as iniciais com a silhueta da espécie no lugar da foto. Nenhum ícone de imagem quebrada.', simulado: 'foto apontando para um endereço que não existe: nenhuma imagem quebrada.' },
    ],
    naoBug: [
      'Na primeira leitura de um paciente com vínculo, aparecem as iniciais: a foto do app vem numa leitura seguinte.',
      'Na visão Semana da agenda, no dia de hoje do Início e no painel Hoje não há foto: a API não manda foto nessas listas.',
      'Logo depois de mover ou marcar um horário, o rosto pode mostrar as iniciais por um instante, até a agenda se reler.',
      '"Bolinha de Neve" aparece "BD" na grade da agenda e "BN" no Início: as duas telas já faziam iniciais de jeitos diferentes.',
    ],
    bug: [
      'Aparece o ícone de imagem quebrada ou um quadrado vazio em qualquer avatar.',
      'O paciente com foto da clínica mostra as iniciais em alguma das listas, com a imagem carregando normalmente.',
      '"Bisteca" mostra "BT".',
      'A lista de pacientes se recarrega sozinha várias vezes esperando a foto.',
    ],
  },
  {
    letra: 'B', ondeCurto: 'Portal e CMS', situacaoCurta: 'Passou com simulação', titulo: 'O dono liga e desliga os módulos', sub: 'Pedido 2: teste grátis de 30 dias, desligar com a prévia, religar, e o que o CMS mostra',
    situacao: 'Preparo em 17/11. Portal: passou com as respostas simuladas (nenhum módulo foi ligado nem desligado de verdade); a leitura da API de dev com a clínica de QA passou. CMS: passou com respostas simuladas.',
    tom: 'atencao',
    onde: `${PORTAL} O CMS com a sua conta de administrador.`, conta: 'Conta A: uma empresa nova, feita pelo site com a categoria Clínica veterinária e CNPJ, aprovada no CMS e sem nenhum módulo. Conta B: um operador da conta A (convite pela Equipe). E a portal-demo@petjourney.test para o caso do suporte.',
    antes: 'O teste grátis só se liga uma vez por módulo: depois do passo 2, a conta A não repete o passo 2. Não toque em "Desligar" na portal-demo.',
    passos: [
      { lado: 'P', acao: `${b('Entre com a conta A.')} ${q('Início')}${b(', faixa dos módulos (abaixo dos programas).')}`, deve: `Clínica com ${q('Combina com o seu cadastro')}, ${q('Sem custo e sem cartão. Depois dos 30 dias, a equipe PetJourney fala com você para continuar.')} e o botão ${q('Ligar teste grátis de 30 dias')}. Hotel com ${q('Este módulo não faz parte das categorias do seu cadastro, então o teste grátis não liga sozinho. Peça o módulo e a equipe PetJourney analisa.')} e ${q('Pedir o módulo')}.`, simulado: 'respostas simuladas sobre a tela real.', prints: [['portal-2-1']] },
      { lado: 'P', acao: `${q('Ligar teste grátis de 30 dias')}.`, deve: `O aviso ${q('Clínica: teste grátis ligado até [data daqui a 30 dias].')} Sem recarregar, o menu ganha a Clínica, e a linha passa a ${q('Em teste até [data].')} com ${q('Desligar')}.`, simulado: 'ligar respondido no navegador.' },
      { lado: 'P', acao: `${b('Marque dois horários em dias futuros e interne um paciente. Volte ao Início e toque em')} ${q('Desligar')}.`, deve: `${q('Desligar a Clínica?')}, ${q('Ficam só para consulta: 2 agendamentos futuros e 1 internação em andamento.')}, o destaque ${q('Há paciente internado: a equipe não vai conseguir registrar medicação nem evolução até você religar.')} e ${q('Nada é cancelado nem apagado, e os responsáveis não recebem aviso.')} Sem nada em andamento: ${q('Nada em andamento será afetado.')}`, simulado: 'prévia simulada com 3 agendamentos e 1 internação.', prints: [['portal-2-3', 'dialogo']] },
      { lado: 'P', acao: `${q('Desligar')} ${b('na confirmação e, depois,')} ${q('Religar')}.`, deve: `${q('Clínica desligada.')} e a linha ${q('Desligado por você. Você pode religar até [a mesma data].')} com ${q('Só consulta')}; no menu, a Clínica só para consulta. Religada: ${q('Clínica religada.')} e de volta ${q('Em teste até [a mesma data].')}`, simulado: 'desligar e religar respondidos no navegador.' },
      { lado: 'P', acao: b('Entre com a conta B (operador) e abra o Início.'), deve: `A linha da Clínica com o estado e ${q('Só o dono liga ou desliga módulos.')}, sem nenhum botão.`, simulado: 'papel trocado no navegador.' },
      { lado: 'P', acao: b('Entre com a portal-demo e abra o Início.'), deve: `Clínica com ${q('Desligar')}; Hotel com ${q('A equipe PetJourney suspendeu, recusou ou desligou este módulo. Para ligá-lo de novo, fale com a equipe PetJourney.')} e ${q('Só consulta')}, sem botão.`, simulado: 'passou lendo a API de dev, sem simulação.' },
      { lado: 'C', acao: `${b('No CMS:')} ${q('Parceiros')} ${b('> o parceiro > aba')} ${q('Módulos')}${b(', depois de o dono ligar o teste grátis pelo portal.')}`, deve: `No cartão da Clínica, ${q('Ligado pelo parceiro (teste grátis) em DD/MM')} e, embaixo, ${q('Histórico do parceiro')} com ${q('Ligou o teste grátis')} e a data. ${q('Última decisão')} continua ${q('-')}: o ligar do dono não é decisão do admin.`, naoConferido: 'a tela nesse estado; a regra passou nos testes do CMS.' },
      { lado: 'C', acao: `${b('Depois de o dono desligar a Clínica pelo portal,')} ${q('Atualizar')}.`, deve: `${q('Desligado pelo parceiro em DD/MM')}, ${q('Pode religar para')} com ${q('Em teste')}, ${q('Teste grátis do parceiro já usado em DD/MM')} e o histórico com ${q('Desligou')} no alto.`, simulado: 'tela do CMS local com as respostas trocadas no navegador.', prints: [['cms-1', 'cms']] },
      { lado: 'C', acao: `${b('No mesmo cartão,')} ${q('Ligar em teste')} ${b('(não confirme, se não quiser tirar o religar do dono).')}`, deve: `No alto do modal: ${q('Sua decisão substitui a do parceiro: ele não consegue mais religar sozinho.')}`, simulado: 'tela do CMS local.' },
      { lado: 'C', acao: b('Num módulo recusado pelo admin e pedido de novo pelo dono.'), deve: `${q('Pedido refeito depois de recusa em DD/MM')}.`, simulado: 'tela do CMS local (cartão do Hotel no print acima).' },
    ],
    naoBug: [
      'O estado do teste diz "Em teste até [data]." (a frase que já existia), e não "Teste grátis até".',
      'Desligar não cancela horário nem internação: ficam para consulta, e os responsáveis não recebem aviso.',
      'O módulo ativo só aparece na faixa para o dono, porque só ele desliga.',
      'No CMS, o ligar e o religar do dono não preenchem "Última decisão" nem o motivo: esses são do admin.',
    ],
    bug: [
      'O botão diz "30 dias" quando a API manda outro número de dias.',
      'Depois de ligar, desligar ou religar, o menu só muda recarregando a página.',
      'A confirmação mostra "0 internações" ou "1 agendamentos futuros".',
      'O operador vê algum botão de ligar, desligar ou pedir.',
      'No CMS, "Desligado pelo parceiro" aparece num módulo desligado pelo admin.',
    ],
  },
  {
    letra: 'C', ondeCurto: 'Site, portal e CMS', situacaoCurta: 'Passou na tela, sem gravar', titulo: 'Cadastro com várias categorias', sub: 'Pedido 3: escolher mais de uma categoria, com uma principal',
    situacao: 'Preparo em 17/11: site, portal e CMS passaram na tela sem gravar. O que vai para a API foi conferido pelo corpo do pedido (no navegador e nos testes); a gravação de verdade não foi feita.',
    tom: 'atencao',
    onde: 'Site (cadastro de parceiro), portal (dados do cadastro) e CMS (parceiros).', conta: 'Um e-mail ainda sem conta, para o cadastro pelo site. No portal, a conta nova (ou a da clínica de QA). No CMS, a sua conta de administrador.',
    passos: [
      { lado: 'S', acao: `${b('No site,')} ${q('Sou parceiro')}${b(', preencha a etapa 1 e, na etapa 2, marque Pet shop, Clínica veterinária e Banho e tosa.')}`, deve: `${q('Escolha uma ou mais categorias')} e oito caixas. ${q('Principal')} embaixo da primeira marcada (Pet shop) e ${q('Tornar principal')} nas outras. Embaixo: ${q('A principal aparece primeiro na sua página e nas buscas.')}`, simulado: 'tela do site local, sem enviar.', prints: [['site-5', 'formulario']] },
      { lado: 'S', acao: `${q('Tornar principal')} ${b('em Banho e tosa, depois desmarque Banho e tosa.')}`, deve: `${q('Principal')} passa para Banho e tosa; desmarcada, volta para Pet shop (a primeira que sobrou). Tocar em ${q('Tornar principal')} não marca nem desmarca a caixa.`, simulado: 'tela e testes do site.' },
      { lado: 'S', acao: `${b('Deixe Pet shop e Clínica veterinária, termine e')} ${q('Enviar cadastro')}${b('. Com o F12 aberto, aba Network.')}`, deve: `${q('Obrigado pelo seu cadastro!')} O pedido do cadastro leva ${q('categorias: [PET_SHOP, CLINICA_VETERINARIA]')} e não leva ${q('categoria')}. Sem nenhuma marcada, o cadastro passa e não leva nenhuma das duas.`, naoConferido: 'o envio de verdade; o corpo do pedido passou nos testes do site.' },
      { lado: 'P', acao: `${b('No portal:')} ${q('Configurações')} > ${q('Empresa')}${b(', campo')} ${q('Categorias')}${b('. Marque Hotel e creche e Pet shop.')}`, deve: `${q('Escolha uma ou mais. A primeira é a principal.')} e, embaixo, a ordem: a primeira com ${q('Principal')} e as outras com ${q('Tornar principal')}.`, simulado: 'lido da API de dev e marcado na tela, sem salvar.', prints: [['portal-3-1']] },
      { lado: 'P', acao: `${b('Troque a principal,')} ${q('Salvar alterações')} ${b('e recarregue a página.')}`, deve: `O aviso de salvo; recarregando, as três categorias na mesma ordem. Editar só o telefone e salvar mantém as três. Desmarcar todas: ${q('Escolha pelo menos uma categoria.')} e nada é enviado.`, naoConferido: 'a gravação; o pedido leva só categorias, conferido no navegador e nos testes.' },
      { lado: 'P', acao: `${b('Com Clínica veterinária e Hotel e creche salvas, abra o')} ${q('Início')}.`, deve: `Na faixa dos módulos, o Hotel também com ${q('Combina com o seu cadastro')} e ${q('Ligar teste grátis de 30 dias')} (se o teste do Hotel ainda não foi usado).`, naoConferido: 'a mudança vinda da API; a tela com os dois sugeridos foi simulada.' },
      { lado: 'C', acao: `${b('No CMS:')} ${q('Parceiros')} > ${q('Novo parceiro')} ${b('(ou editar um parceiro), marque duas categorias e use')} ${q('Tornar principal')}.`, deve: `${q('Categorias')}, ${q('Escolha uma ou mais. A primeira é a principal.')}, o selo ${q('Principal')} e ${q('Tornar principal')} nas outras. Salvo: ${q('Parceiro atualizado com sucesso!')} e, reaberto, a mesma ordem.`, simulado: 'tela do CMS local; a gravação foi respondida no navegador e levou só categorias.', prints: [['cms-6', 'cms']] },
      { lado: 'C', acao: `${b('Lista')} ${q('Parceiros')}${b(', depois o filtro de categoria')} ${q('Pet shop')}.`, deve: 'Embaixo do nome, um selo por categoria: a principal com fundo, as outras só com borda. O filtro também acha quem tem Pet shop como segunda categoria. O mesmo em Auditoria e em Feedback dos parceiros.', simulado: 'os selos na tela do CMS local; o filtro é da API e não foi conferido.', prints: [['cms-3', 'cms']] },
    ],
    naoBug: [
      'No CMS, a aba Módulos ainda mostra "Categoria:" só com a principal; os módulos sugeridos já somam as categorias (clínica e hotel sugere Clínica e Hotel).',
      'O filtro de categoria continua escolhendo uma categoria por vez.',
      'No portal, "Veterinário autônomo" só aparece quando o cadastro já a tem: o portal não tem o campo de CRMV que ela exige.',
      'O erro de CNPJ da API quase não aparece no portal: o formulário já pede o CNPJ antes de mandar.',
    ],
    bug: [
      'Editar só o telefone (portal ou CMS) apaga as outras categorias.',
      'A principal não é a primeira da lista enviada, ou o selo "Principal" fica numa categoria desmarcada.',
      'Alguma lista do CMS mostra só a principal de quem tem mais de uma categoria.',
    ],
  },
  {
    letra: 'D', ondeCurto: 'Portal, app e site', situacaoCurta: 'Portal passou com simulação; app só por scripts', titulo: 'Convidar o paciente para o app', sub: 'Pedido 4: link, WhatsApp e QR no portal; o convite aberto no app e no site',
    situacao: 'Preparo em 17/11. Portal: passou com o convite respondido no navegador (nenhum convite foi criado nem enviado). Site: passou com a prévia respondida no navegador. App: conferido por scripts com as funções do app; as telas não foram abertas.',
    tom: 'atencao',
    onde: `${PORTAL} O app de dev no celular, com e sem login.`, conta: `${CLINICA} No app, uma conta de responsável sua (ou uma nova).`,
    antes: 'Escolha um paciente ativo, ainda fora do app, com responsável que tenha telefone (de preferência o seu celular) e e-mail. Na conta de QA: "Rafael lima". Cada convite de verdade conta no limite de 50 por dia e cancela o convite anterior do mesmo responsável.',
    passos: [
      { lado: 'P', acao: `${b('Abra a ficha do paciente e desça até o cartão')} ${q('No app do responsável')}.`, deve: `O botão ${q('Convidar para o app')} no alto do cartão e, em cada proposta ${q('Expirada')} ou ${q('Não respondida')}, o botão ${q('Reenviar')}.`, simulado: SIMULADO_PORTAL, prints: [['portal-4-3']] },
      { lado: 'P', acao: `${b('Toque em')} ${q('Convidar para o app')}.`, deve: `A gaveta ${q('Convidar para o app')}, sem abas: ${q('Convite para [pet]. O responsável abre o link no celular e aceita pelo app.')}, o botão cheio ${q('Enviar pelo WhatsApp')}, ${q('Mostrar QR')}, ${q('Copiar mensagem')}, ${q('Enviar por e-mail')} (só se o cliente tem e-mail), ${q('Vale até [data daqui a 7 dias]')} e ${q('Outras formas')} recolhido.`, simulado: 'resposta do convite simulada.', prints: [['portal-4-1', 'gaveta']] },
      { lado: 'P', acao: `${q('Enviar pelo WhatsApp')}.`, deve: 'O WhatsApp abre numa aba nova, na conversa com o telefone do cadastro, com a mensagem pronta: nome da clínica, o pet, o link, o código e a validade.', naoConferido: 'a conversa no WhatsApp (o portal abre o endereço que a API manda).' },
      { lado: 'P', acao: `${q('Mostrar QR')}.`, deve: `A tela inteira com o QR num cartão branco, o código em dois blocos (como ${q('K7MQ-X3PA')}), o texto ${q('Baixe o app PetJourney na App Store ou no Google Play, toque em Minhas clínicas e aponte a câmera para o QR. Ou digite o código ...')}, a validade e ${q('Imprimir')}.`, simulado: 'conferido também em 1024 px e no tema escuro.', prints: [['portal-4-2', 'tudo']] },
      { lado: 'S', acao: b('No computador (sem o app), abra o link da mensagem.'), deve: `A página do site com o logo, ${q('[clínica] quer conectar seus pets ao app PetJourney')}, a cidade e a UF, ${q('Vale até [data]')}, as lojas e ${q('Depois de instalar, toque no link de novo ou digite o código que veio na mensagem.')} Nenhum nome de pet ou de pessoa.`, simulado: 'tela do site local com a prévia respondida no navegador; o pedido sai do navegador, com a página sem Analytics.', prints: [['site-1', 'tudo']] },
      { lado: 'A', acao: b('No celular SEM login no app, toque no link da mensagem do WhatsApp.'), deve: `O logo da clínica, ${q('[clínica] te convidou')}, ${q('A clínica quer acompanhar seus pets pelo app. Crie sua conta para ver o convite.')} e os botões ${q('Criar conta')} e ${q('Já tenho conta')}.`, naoConferido: 'a tela; a chamada da prévia passou nos scripts.' },
      { lado: 'A', acao: `${q('Já tenho conta')} ${b('e entre com a sua conta.')}`, deve: `Depois de entrar, a tela ${q('Pedido da clínica')} com o pet do convite. Aceite.`, naoConferido: 'a tela; a espera para abrir só depois do login passou nos scripts.' },
      { lado: 'P', acao: b('Volte ao portal, feche a gaveta e abra o convite de novo para o mesmo paciente.'), deve: `${q('O convite anterior deixou de valer.')} abaixo da validade. ${b('No site, o link anterior')} passa a mostrar o texto genérico ${q('Proposta da clínica')}, sem o nome da clínica; um convite com mais de 7 dias mostra ${q('Este convite venceu.')} e ${q('Pedir outro convite pelo WhatsApp')} (só se a clínica tem WhatsApp público).`, simulado: 'frase do portal e as páginas do site com respostas simuladas.' },
      { lado: 'P', acao: `${b('Cadastre um paciente novo (')}${q('Cadastrar paciente')}${b(') para um responsável que já é da casa.')}`, deve: `No fim, ${q('Convidar para o app agora?')} com as mesmas ações e ${q('Agora não')} no pé. ${q('Agora não')} leva à ficha sem criar convite.`, simulado: 'cadastro respondido no navegador.', prints: [['portal-4-4', 'gaveta']] },
      { lado: 'A', acao: `${b('Com uma conta que já tem um pet de mesmo nome e espécie do convite, abra o convite e escolha')} ${q('Criar [pet] no app')}.`, deve: `A folha ${q('Você já tem [pet] no app')} com ${q('Ligar ao que já tenho')} e ${q('Criar mesmo assim')}.`, naoConferido: 'a tela; a regra (nome sem acento e sem maiúscula, mesma espécie) passou nos scripts.' },
      { lado: 'A', acao: `${b('Num celular sem dados do app, abra o app:')} ${q('Recebi um convite de uma clínica')}${b(', crie a conta.')}`, deve: `Depois do cadastro, a tela do código com ${q('Digite o código que a recepção da clínica te passou. Ele tem 8 letras e números e vale por 7 dias.')} Digite o código do convite: abre o pedido da clínica.`, naoConferido: 'a tela. O topo da boas-vindas ficou mais baixo para os três botões caberem: olhe num celular pequeno.' },
    ],
    naoBug: [
      'Abrir a gaveta já cria um convite (o guia do backend pede assim): abrir e fechar várias vezes gasta convites do limite diário, e só o último vale.',
      '"Enviar por e-mail" faz um convite novo e o link da gaveta deixa de valer.',
      'Sem telefone no cadastro, o WhatsApp abre sem destinatário e a recepção escolhe o contato.',
      'A mensagem do WhatsApp vem pronta da API e diz para digitar o código em "Minhas clínicas"; a folha impressa fala em apontar a câmera (texto do guia do backend). Ver a pendência 3 no fim.',
      'O convite por link e o código não mandam push ao responsável: só o QR da carteirinha e o acesso temporário mandam.',
    ],
    bug: [
      'A gaveta ainda mostra as abas antigas ("Código", "E-mail", "QR da carteirinha").',
      'O WhatsApp abre sem a mensagem, ou com outro número quando o cadastro tem telefone.',
      'O link sem login vai direto ao login (com internet e a API de dev atualizada).',
      'Depois de entrar pelo link, o app fica na home e não abre o pedido da clínica.',
      '"Agora não", no fim do cadastro, deixa uma proposta nova na ficha.',
    ],
  },
  {
    letra: 'E', ondeCurto: 'Portal e app', situacaoCurta: 'Esperando o N42 na API de dev', titulo: 'Lembrete de vacina pedido pela clínica', sub: 'Pedido 5 (N42): ligar o lembrete na lista de chamada, o push no app e "Editar registro"',
    situacao: 'Preparo em 17/11, 21h20: a API de dev AINDA NÃO TINHA o N42 (a lista de chamada vinha sem os campos do lembrete). O portal passou com respostas simuladas; o push não foi conferido. Faça este teste só depois de o N42 estar no dev (veja o primeiro passo).',
    tom: 'falhou',
    onde: `${PORTAL} O app de dev da Bruna no celular, com notificações ligadas.`, conta: `${CLINICA} No app: ${BRUNA}`,
    antes: 'O lembrete manda push de verdade: use só a Fubá, da Bruna (conta de teste).',
    passos: [
      { lado: 'P', acao: `${b('Clínica >')} ${q('Vacinas')}${b(', aba')} ${q('Lista de chamada')}.`, deve: `Em cada caixa de vacina, um destes três: ${q('Ativar lembrete')}, ${q('Lembrete ativo')} ou ${q('Ligue para o telefone do cadastro')} (este em texto, sem botão, para pet sem responsável no app). ${b('Se todas as caixas mostram "Ativar lembrete", o N42 ainda não está no dev: pare aqui.')}`, simulado: 'os estados foram simulados sobre a lista real do dev.', prints: [['portal-5-1']] },
      { lado: 'P', acao: `${b('Na caixa da Fubá,')} ${q('Ativar lembrete')} ${b('e, na gaveta,')} ${q('Ativar lembrete')} ${b('de novo.')}`, deve: `A gaveta fecha, a lista se relê e a Fubá passa a ${q('Lembrete ativo')}, com ${q('Na fila')} embaixo (depois ${q('Entregue')}, recarregando).`, simulado: 'ligar foi respondido no navegador.' },
      { lado: 'A', acao: b('No celular da Bruna, veja o push e toque nele.'), deve: 'O aviso "Vacina de Fubá chegando" (ou "atrasada") com o ícone da seringa; o toque abre as vacinas da Fubá, no perfil de responsável.', naoConferido: 'o push; a rota do toque passou nos scripts do app.' },
      { lado: 'P', acao: `${b('Toque em')} ${q('Lembrete ativo')}.`, deve: `${q('Ativado em [dia, hora]')}, ${q('Último envio em [dia, hora]: Entregue')} e ${q('Próximo envio em [dia da próxima dose], 09:00')} ou ${q('Sem novo envio previsto')}. No pé, ${q('Desligar lembrete')}. As horas são as da clínica.`, simulado: 'estado simulado.', prints: [['portal-5-2', 'gaveta']] },
      { lado: 'P', acao: `${q('Desligar lembrete')}${b(', e depois ligue de novo no mesmo dia.')}`, deve: `Desligado, a caixa volta a ${q('Ativar lembrete')}. Ligado de novo: ${q('Lembrete ativo')} e nenhum segundo push no mesmo dia.`, naoConferido: 'o segundo push (regra da API).' },
      { lado: 'P', acao: b('Se um envio não sair (difícil de provocar: 6 avisos de vacina da clínica ao mesmo responsável no dia).'), deve: `${q('Não saiu')} com o motivo: ${q('O responsável já recebeu 6 avisos de vacina desta clínica hoje.')}, ${q('O responsável não está mais no app.')} ou ${q('A dose já foi registrada.')}`, simulado: 'estado simulado.', prints: [['portal-5-3', 'gaveta']] },
      { lado: 'P', acao: `${b('No "..." do cartão da Fubá,')} ${q('Editar registro')}${b('. Mude a observação, preencha o motivo e')} ${q('Salvar')}.`, deve: `A gaveta com ${q('Observação')}, ${q('Via')} e ${q('Motivo')}; ${q('Salvar')} desligado enquanto nada muda e o motivo pede ${q('Pelo menos 5 caracteres.')} Salvo: ${q('Registro corrigido.')} Vacina, dose, data e lote seguem por ${q('Apagar e registrar de novo')}.`, simulado: 'a gravação foi respondida no navegador e levou só a observação e o motivo.', prints: [['portal-5-4', 'gaveta']] },
      { lado: 'P', acao: b('Entre com uma pessoa da equipe só com a função Enfermagem e abra a mesma lista.'), deve: 'Nenhuma caixa com o lembrete (nem o texto do telefone). O "..." continua: ela aplica vacina.', simulado: 'permissão tirada no navegador.' },
    ],
    naoBug: [
      '"Na fila" logo depois de ligar: o push sai em instantes e a entrega muda numa leitura seguinte.',
      '"Sem novo envio previsto" depois da repetição: o lembrete manda no máximo dois avisos.',
      'Depois de ligar ou desligar, a lista volta ao começo (ela se relê, como depois de anular).',
      'O rastro de avisos da clínica não tem tela no portal ainda: o tipo "Lembrete de vacina" só tem o nome pronto.',
    ],
    bug: [
      'Com o N42 no dev, um pet sem responsável no app mostra "Ativar lembrete".',
      '"Ligue para o telefone do cadastro" vira botão ou abre a discagem.',
      'Depois de ligar ou desligar, a caixa fica como antes até recarregar a página.',
      'O aviso antigo "o lembrete fica marcado só neste navegador" ainda aparece.',
      'A Enfermagem vê o lembrete, ou "Salvar" do "Editar registro" fica ligado sem mudança.',
    ],
  },
]

/* Pendências achadas na implementação (guia do backend x API x telas). */
const pendencias = [
  ['E', 'A API de dev ainda não tem o N42 em 17/11, 21h20: a lista de chamada não traz o lembrete. Sem isso, o teste E não roda.', 'API (publicar no dev)'],
  ['D', 'O push "VINCULO_PROPOSTO" não sai no convite por link, só no QR da carteirinha e no acesso temporário. O guia do backend diz que o push abre a proposta: no convite por link não há push.', 'API ou guia'],
  ['D', 'A folha impressa do QR (texto do guia) manda apontar a câmera em "Minhas clínicas", mas o app não tem leitor de QR ali; a mensagem da API manda digitar o código. Decidir qual texto vale.', 'Decisão (Luís e Nicolas)'],
  ['D', '"Falar com a clínica" na proposta vencida quase nunca aparece: o 410 do detalhe da proposta não traz o contato da clínica (só o resgate pelo link traz).', 'API'],
  ['D', 'Não há rota com os pacientes de um cliente: o portal procura pelo nome do cliente (até 50) para juntar os pets no convite. Cliente com nome muito comum pode deixar pet de fora.', 'API (rota nova) ou aceitar'],
  ['D', 'Mensagens da API pensadas para o outro lado: o 422 "Escolha o que fazer com cada pet da proposta." e o 400 "...ou use o código de balcão" aparecem na recepção.', 'API (texto)'],
  ['E', 'O rastro de avisos da clínica (GET /clinica/avisos) não tem tela no portal; o filtro "Lembrete de vacina" fica para quando a tela existir.', 'Portal (tela nova, fora do guia)'],
  ['E', '"CRMV_OBRIGATORIO" (403) está no contrato e falta na tabela de erros do guia; o portal mostra a mensagem da API.', 'Guia'],
  ['A', 'O guia cita uma lista de "possíveis repetidos" no cadastro de paciente que não existe; a foto entrou na busca de clientes.', 'Guia'],
  ['C', 'O portal não tem campo de CRMV: a categoria "Veterinário autônomo" não é oferecida e o erro de CRMV leva o foco às categorias. Decidir se o portal ganha o campo.', 'Decisão'],
  ['C', 'A API também pede CNPJ para Farmácia (o guia fala só de clínica). O portal segue a API.', 'Guia'],
  ['B', 'Um teste grátis vencido continua com "Desligar" (a API manda podeDesligar), ao lado de "O período do módulo terminou...".', 'API'],
  ['Todos', 'As specs citadas no guia (docs/specs/2026/q4/q4-2/) não estão no repositório da API (a pasta docs/ é ignorada no git). Os fronts seguiram o guia e o código da API.', 'Nicolas'],
]

const css = `
@page { size: A4; margin: 13mm 12mm 13mm 12mm; }
* { box-sizing: border-box; }
body { font-family: "Segoe UI", system-ui, sans-serif; color: #1F2A2E; font-size: 10.5pt; line-height: 1.45; margin: 0; }
h1 { color: #2E5A4C; font-size: 24pt; margin: 0 0 2mm; }
h2 { color: #1F2A2E; font-size: 15pt; margin: 0; }
h3 { color: #2E5A4C; font-size: 13pt; margin: 0 0 2mm; }
.q { color: #2B5E9C; font-weight: 600; }
code { font-size: 9pt; background: #F1F4F3; padding: 0 1mm; border-radius: 3px; }
.capa-sub { color: #5B6B70; margin-bottom: 6mm; }
.caixa { border: 1px solid #DCE3E1; border-radius: 10px; padding: 4mm 5mm; margin-bottom: 4mm; break-inside: avoid; }
.caixa.alerta { border-color: #E9C9A0; background: #FDF6EC; }
table { width: 100%; border-collapse: collapse; font-size: 9.5pt; }
th { background: #EEF2F1; text-align: left; padding: 2mm; }
td { border-top: 1px solid #E3E8E6; padding: 2mm; vertical-align: top; }
.ok { color: #2E7D4F; font-weight: 600; } .at { color: #B4621A; font-weight: 600; } .ru { color: #B03A3A; font-weight: 600; }
ul { margin: 1mm 0 0; padding-left: 5mm; } li { margin: 0.6mm 0; }
.teste { break-before: page; }
.cab { display: flex; align-items: center; gap: 4mm; border-bottom: 2px solid #2E5A4C; padding-bottom: 2mm; margin-bottom: 3mm; }
.letra { width: 11mm; height: 11mm; border-radius: 50%; background: #2E5A4C; color: #fff; font-weight: 700; font-size: 15pt; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.cab > div { flex: 1; } .sub { color: #5B6B70; font-size: 9.5pt; }
.marcar { font-size: 10pt; color: #2E5A4C; white-space: nowrap; border: 1px solid #C9D6D2; border-radius: 6px; padding: 1mm 2.5mm; }
.situacao { background: #E8F3EC; border-radius: 8px; padding: 2.5mm 4mm; margin-bottom: 3mm; }
.situacao.atencao { background: #FCF0E3; }
.situacao.falhou { background: #FBEAEA; }
.ficha { background: #F4F6F6; border-radius: 8px; padding: 2.5mm 4mm; margin-bottom: 4mm; }
.ficha p { margin: 0.6mm 0; }
.passo { margin: 0 0 5mm; }
.passo .bloco { break-inside: avoid; }
.passo:not(:has(.fotos)) { break-inside: avoid; }
.passo:has(.fotos) .bloco { break-after: avoid; }
.acao { display: flex; gap: 3mm; align-items: flex-start; margin-bottom: 1.5mm; }
.num { width: 7mm; height: 7mm; border-radius: 50%; background: #E3ECE9; color: #2E5A4C; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-size: 10pt; }
.lado { display: inline-block; font-size: 8pt; font-weight: 700; letter-spacing: .3px; text-transform: uppercase; border-radius: 4px; padding: .3mm 1.8mm; margin-right: 2mm; vertical-align: 1px; }
.lado-p { background: #DCEBE6; color: #2E5A4C; } .lado-a { background: #DDE8F4; color: #2B5E9C; } .lado-s { background: #EEE6F6; color: #6A4A8C; } .lado-c { background: #F1E9DD; color: #7A5A2A; }
.deve { background: #EAF5EE; border-radius: 6px; padding: 2mm 3.5mm; margin-left: 10mm; }
.erro { background: #FBEAEA; border-radius: 6px; padding: 1.8mm 3.5mm; margin: 1.5mm 0 0 10mm; font-weight: 600; color: #8A2E2E; }
.nota { background: #FCF3E6; border-radius: 6px; padding: 1.8mm 3.5mm; margin: 1.5mm 0 0 10mm; font-size: 9.5pt; }
.sim { background: #F4F6F6; border-radius: 6px; padding: 1.5mm 3.5mm; margin: 1.5mm 0 0 10mm; font-size: 8.8pt; color: #44545A; }
.nc { background: #EDEDED; border-radius: 6px; padding: 1.8mm 3.5mm; margin: 1.5mm 0 0 10mm; font-size: 9pt; color: #444; }
.fotos { display: flex; gap: 4mm; margin: 3mm 0 0 10mm; flex-wrap: wrap; }
.corte { overflow: hidden; border-radius: 6px; border: 1px solid #CBD5D2; flex-shrink: 0; break-inside: avoid; }
.corte img { display: block; }
.passo > .fotos { display: block; }
.passo > .fotos .corte { display: inline-block; vertical-align: top; margin: 0 4mm 3mm 0; }
.lado-a-lado { display: flex; gap: 5mm; align-items: flex-start; break-inside: avoid; }
.lado-a-lado .txt { flex: 1; min-width: 0; }
.lado-a-lado .fotos { margin: 0; flex-wrap: nowrap; }
.fim { display: grid; grid-template-columns: 1fr 1fr; gap: 4mm; margin-top: 4mm; break-inside: avoid; }
.naobug, .ebug { border-radius: 8px; padding: 3mm 4mm; font-size: 9.5pt; }
.naobug { background: #EAF1FA; } .ebug { background: #FBEAEA; }
.tit { font-weight: 700; }
.resultado td { height: 9mm; }
.compacta { font-size: 9pt; } .compacta td, .compacta th { padding: 1.4mm 1.8mm; line-height: 1.35; }
.quebra { break-before: page; }
`

const linhasIndice = testes
  .map((t) => `<tr><td><b>${t.letra}.</b> ${t.titulo}</td><td>${t.ondeCurto ?? ''}</td><td class="${{ ok: 'ok', atencao: 'at', falhou: 'ru' }[t.tom ?? 'ok']}">${t.situacaoCurta ?? ''}</td></tr>`)
  .join('')

const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Guia de teste: pedidos de 17/11</title><style>${css}</style></head><body>
<h1>Guia de teste: pedidos de 17/11</h1>
<div class="capa-sub">17/11/2026 · Portal do parceiro, app, site e CMS · API de dev</div>

<div class="caixa"><h3>O que tem neste guia</h3>
<p style="margin:0 0 2mm">Um teste por pedido feito ao backend em 17/11. A API foi feita pelo Nicolas; as telas, a partir do guia que ele mandou.</p>
<table><tr><th>Teste</th><th>Onde</th><th>Situação no preparo (17/11)</th></tr>${linhasIndice}</table></div>

<div class="caixa alerta"><h3>Antes de testar</h3><ul>
<li><b>Nada subiu ainda.</b> Está tudo commitado no <code>develop</code> local de cada repositório, sem push. Para testar nos ambientes de develop (portal-dev, app de dev, site e CMS), é preciso subir primeiro. No computador, dá para testar o portal pelo <code>npm run dev</code>.</li>
<li><b>Lembrete de vacina (teste E):</b> em 17/11, 21h20, a API de dev ainda não tinha o N42. Confira o primeiro passo do teste E antes.</li>
<li><b>Como foi o preparo:</b> as telas do portal foram abertas com a conta da clínica de QA, lendo a API de dev. Tudo o que grava (ligar módulo, convite, lembrete, editar) foi respondido no próprio navegador, para não mandar mensagem, push nem gastar o teste grátis de ninguém. Por isso o fundo cinza "Não conferido" e as notas "No preparo" dizem o que falta ver de verdade.</li>
<li><b>App:</b> as telas novas não foram abertas no celular; o comportamento foi conferido rodando as funções do app em scripts. É onde mais vale o seu olho.</li>
</ul></div>

<div class="caixa"><h3>Como usar</h3><ul>
<li>Cada passo diz de que lado é: <span class="lado lado-p">Portal</span> <span class="lado lado-a">App do responsável</span> <span class="lado lado-s">Site</span> <span class="lado lado-c">CMS</span></li>
<li>Faça o que está em negrito e confira o quadro verde <b>Deve aparecer</b>. Os textos entre aspas azuis são os nomes exatos na tela; o que está entre colchetes muda (nome do pet, data).</li>
<li>Marque ☐ Passou / ☐ Falhou no alto de cada teste e preencha a folha de resultado no fim.</li>
<li>Achou um problema? Mande a letra do teste e o número do passo, o print e a conta. Antes, leia <b>Não é bug</b> e as pendências no fim.</li>
</ul></div>

<div class="caixa quebra"><h3>Contas</h3>
<table><tr><th>Conta</th><th>Para quê</th></tr>
<tr><td><b>portal-demo@petjourney.test</b><br>senha Teste@123</td><td>A clínica de QA ("Clínica e Hotel Demo"), DONO. Pacientes Mel, Nino, Bidu, Fubá, Pipoca e Rafael lima. Clínica ativa; Hotel desligado pelo suporte.</td></tr>
<tr><td><b>qa-bruna@petjourney.test</b><br>senha Teste@123</td><td>Responsável da Fubá, ligada à clínica. Para o push do lembrete (teste E).</td></tr>
<tr><td>Sua conta de responsável no app</td><td>Para abrir o convite (teste D). Use um celular sem login para o link sem conta.</td></tr>
</table></div>

<div class="caixa"><h3>Pendências achadas na implementação</h3>
<p>Diferenças entre o guia do backend, a API e as telas. Não são erros do teste: são decisões ou ajustes que dependem da API ou de você.</p>
<table class="compacta"><tr><th>Teste</th><th>O que é</th><th>Com quem</th></tr>${pendencias.map(([t, o, c], i) => `<tr><td>${i + 1}. ${t}</td><td>${o}</td><td>${c}</td></tr>`).join('')}</table></div>

${testes.map(teste).join('\n')}

<section class="teste"><h3>Folha de resultado</h3>
<p>Quem testou: ____________________ &nbsp; Data: ___/___/2026 &nbsp; Navegador: ____________ &nbsp; Celular do app: ☐ Android ☐ iPhone</p>
<table class="resultado"><tr><th style="width:42%">Teste</th><th>Passou</th><th>Falhou</th><th style="width:38%">Passo e observação</th></tr>
${testes.map((t) => `<tr><td><b>${t.letra}.</b> ${t.titulo}</td><td>☐</td><td>☐</td><td></td></tr>`).join('')}</table>
</section>
</body></html>`

fs.writeFileSync(new URL('./guia.html', import.meta.url), html)
console.log('guia.html gerado,', testes.length, 'testes,', testes.reduce((s, t) => s + t.passos.length, 0), 'passos,', testes.reduce((s, t) => s + t.passos.reduce((n, p) => n + (p.prints?.length ?? 0), 0), 0), 'prints')
