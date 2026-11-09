// Gera o guia de teste do portal do parceiro de novembro (HTML para imprimir em PDF pelo Edge).
// Mesmo molde do guia do módulo clínico no app (petjourney-app, docs/testes/guia-modulo-clinico-2026-11-08).
// Uso: node gerar.mjs  ->  guia.html (as capturas ficam em ./prints, fora do git)
// PDF: msedge --headless --no-pdf-header-footer --print-to-pdf=<saida.pdf> guia.html
import fs from 'node:fs'

const q = (t) => `<span class="q">"${t}"</span>` // nome exato de botão, tela ou texto
const b = (t) => `<b>${t}</b>`
const lados = {
  P: ['Portal', 'lado-p'],
  A: ['App do responsável', 'lado-a'],
  S: ['Site', 'lado-s'],
  C: ['CMS', 'lado-c'],
}

/* As capturas são de 1280 × 800 e saem recortadas, na mesma escala (0,12 mm por pixel):
   "conteudo" tira o menu lateral; "gaveta" mostra só a gaveta da direita; "tudo" é a tela inteira. */
const CORTES = { tudo: [0, 1280], conteudo: [272, 1008], gaveta: [700, 580] }
const MM_POR_PX = 0.1

function foto([arquivo, corte = 'conteudo']) {
  const [x, w] = CORTES[corte]
  return `<div class="corte corte-${corte}" style="width:${(w * MM_POR_PX).toFixed(1)}mm;aspect-ratio:${w}/800"><img src="prints/${arquivo}.jpeg" style="width:${((1280 / w) * 100).toFixed(3)}%;margin-left:-${((x / w) * 100).toFixed(3)}%"></div>`
}

function passo(n, p) {
  const lado = p.lado ? `<span class="lado ${lados[p.lado][1]}">${lados[p.lado][0]}</span>` : ''
  const prints = p.prints ?? []
  const nota = p.nota ? `<div class="nota">${p.nota}</div>` : ''
  const erro = p.erro ? `<div class="erro">No preparo: ${p.erro}</div>` : ''
  const nc = p.naoConferido ? `<div class="nc">Este passo não foi conferido no preparo: ${p.naoConferido}</div>` : ''
  const texto = `<div class="bloco"><div class="acao"><span class="num">${n}</span><div>${lado}${p.acao}</div></div>
  <div class="deve"><b>Deve aparecer:</b> ${p.deve}</div>${erro}${nota}${nc}</div>`
  if (prints.length === 1 && prints[0][1] === 'gaveta') {
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
  ${t.extra ?? ''}
  ${lista('Erro já conhecido (não precisa avisar de novo)', 'conhecido', t.conhecido)}
  ${lista('Não é bug (pode parecer, mas está certo)', 'naobug', t.naoBug)}
  ${lista('É bug se', 'ebug', t.bug)}
  </section>`
}

const CLINICA = 'portal-demo@petjourney.test'
const JULIA = 'qa-julia@petjourney.test'
const PORTAL = 'portal, no computador (1280 px de largura ou mais).'
const VIA_API = 'No preparo, este lado foi feito pela API de dev com a conta da responsável, nas mesmas rotas que o app usa.'

const testes = [
  {
    letra: 'A', titulo: 'Entrar e achar o caminho', sub: 'Início, empresa, avisos, Pendências e Hoje',
    situacao: 'Testado em 09/11 no portal (computador, 1280 px): passou.',
    onde: PORTAL, conta: CLINICA,
    passos: [
      { lado: 'P', acao: b('Entre com a conta.'), deve: `O ${q('Início')} com a saudação, os quatro números no alto (${q('Na recepção')}, ${q('Em consulta')}, ${q('Pedidos esperando resposta')}, ${q('Por vir hoje')}), o bloco ${q('Clínica')} com ${q('Agenda de hoje')} e, mais abaixo, ${q('O que pede ação')} e ${q('Agenda da semana')}. No menu: ${q('Clínica')} (Hoje, Agenda, Pacientes, Internação, Pendências, Relatórios, Configuração), ${q('Hotel')} e ${q('Portal')}.`, prints: [['a1-inicio', 'tudo'], ['a1b-pede-acao']] },
      { lado: 'P', acao: `${b('Toque no nome da empresa, no alto do menu.')}`, deve: `${q('Suas empresas')} com ${q('Clínica e Hotel Demo')} · ${q('Seu negócio')} marcada e ${q('Esta é a empresa que a sua conta opera. Se você entrar na equipe de outra, ela aparece aqui para escolher.')}`, prints: [['a2-empresas', 'tudo']] },
      { lado: 'P', acao: `${b('Abra')} ${q('Avisos')}${b(', no pé do menu.')}`, deve: `A gaveta ${q('Avisos')} com ${q('Os avisos de Clínica e Hotel Demo')}, ${q('Marcar como lidos')} e os avisos com hora e ${q('Não lido')} (pedido de horário, pré-consulta respondida, vaga da fila aceita...).`, prints: [['a3-avisos', 'gaveta']] },
      { lado: 'P', acao: `${b('Clínica >')} ${q('Pendências')}.`, deve: `As abas ${q('Atividades')}, ${q('Faltas')}, ${q('Retornos')}, ${q('Vacinas')}, ${q('Tratamentos em casa')} e ${q('Estoque de vacinas')}. Em Atividades: ${q('Prontuários em rascunho')} e ${q('Resumos que não chegaram ao app')}, cada linha com ${q('Ver o paciente')}.`, prints: [['a4-pendencias']] },
      { lado: 'P', acao: `${b('Clínica >')} ${q('Hoje')}.`, deve: `${q('Minha agenda')} e ${q('Clínica')}, a frase ${q('1 de 2 atendimentos feitos hoje')} (o número muda), ${q('Na recepção')}, ${q('Em consulta')}, ${q('Internados')}, ${q('Quem vem depois')} e ${q('O que pede ação')}.`, prints: [['a5-hoje']] },
    ],
    naoBug: [
      'O número ao lado de Agenda, Pacientes e Avisos conta o que pede ação: muda ao longo do dia.',
      `${q('Minha agenda')} mostra só o profissional da conta; ${q('Clínica')} mostra a clínica inteira.`,
    ],
    bug: ['Algum item do menu abre tela em branco ou "Algo deu errado" (fora os erros já conhecidos dos testes J, L e S).', 'Os números do Início não batem com a agenda do dia.'],
  },
  {
    letra: 'B', titulo: 'Configuração da clínica', sub: 'Salas, tipos de atendimento, política, leitos, bloqueios e catálogo',
    situacao: 'Testado em 09/11: passou. Neste teste só confira; não mude nada, porque outras pessoas usam a mesma clínica.',
    onde: PORTAL, conta: CLINICA,
    passos: [
      { lado: 'P', acao: `${b('Clínica >')} ${q('Configuração')}.`, deve: `${q('Configuração da clínica')} com as abas ${q('Salas')}, ${q('Leitos')}, ${q('Tipos de atendimento')}, ${q('Bloqueios')}, ${q('Política')} e ${q('Catálogo da clínica')}. Em Salas: Consultório 1, Consultório 2, Sala de vacina e Internação, cada uma com ${q('Desativar')}, e as desligadas em ${q('DESATIVADAS')} com ${q('Reativar')}.`, prints: [['b1-salas']] },
      { lado: 'P', acao: `${b('Abra')} ${q('Tipos de atendimento')}.`, deve: `Consulta (30 min), Retorno (20 min) e Vacinação (15 min) com ${q('Online')}; Emergência (30 min, qualquer sala) sem ${q('Online')}.`, prints: [['b2-tipos']] },
      { lado: 'P', acao: `${b('Abra')} ${q('Política')}.`, deve: `${q('Horários livres')}, ${q('Quem marca pelo app')}, ${q('Pedido de horário')} e ${q('Fila de espera')} com ${q('Ofertar vagas sozinho ao primeiro da fila')}, e ${q('Vale para o que for marcado depois. O que já está marcado não muda.')}`, prints: [['b3-politica']] },
      { lado: 'P', acao: `${b('Abra')} ${q('Leitos')}, ${q('Bloqueios')} ${b('e')} ${q('Catálogo da clínica')}.`, deve: `Leitos F1, I1, R1, R2 e UTI. Bloqueios com ${q('Novo bloqueio')} e o almoço de domingo. Catálogo com ${q('Medicamentos da clínica')}, ${q('Vacinas da clínica')}, ${q('Exames da clínica')} e ${q('Diagnósticos da clínica')}, e ${q('O catálogo da PetJourney é só leitura.')}`, prints: [['b4-catalogo']] },
    ],
    naoBug: [`${q('Sala não se apaga: desativa.')}`, 'Emergência nunca vai ao pedido pelo app.', 'Os horários da semana e os feriados ficam em Estabelecimento (teste Q), não aqui.'],
    bug: ['Alguma aba dá erro.', 'Os dados não batem com a lista acima. Antes, avise o Nicolas: outra pessoa pode ter mudado.'],
  },
  {
    letra: 'C', titulo: 'Equipe, profissionais e auditoria', sub: 'Convite, link do convite, fichas e quem fez o quê',
    tom: 'atencao',
    situacao: 'Testado em 09/11: convidar, cancelar, link inválido, fichas e auditoria passaram. O aceite e "Definir funções" não foram conferidos: o convite só se aceita pelo link do e-mail.',
    onde: `${PORTAL} E o e-mail de quem você convidar.`, conta: `${CLINICA} e um e-mail seu.`,
    antes: `Use um e-mail que você lê. Com Gmail, dá para usar o mesmo endereço com +: ${b('seuemail+recepcao@gmail.com')} chega na sua caixa.`,
    passos: [
      { lado: 'P', acao: `${b('Portal >')} ${q('Equipe')} > ${q('Convidar pessoa')}${b('. Digite o e-mail, deixe')} ${q('Operador')} ${b('e toque em')} ${q('Enviar convite')}.`, deve: `A gaveta explica ${q('Operador')} e ${q('Dono')} e diz ${q('A pessoa recebe um link por e-mail e aceita por ele. O link vale por 14 dias.')} Depois: ${q('Convite enviado')} e, em ${q('Convites pendentes')}, o e-mail com ${q('Operador · Vale até ... · Enviado em ...')}, ${q('Reenviar')} e ${q('Cancelar')}.`, prints: [['c1-convidar', 'gaveta'], ['c2-convite-pendente']] },
      { lado: 'P', acao: b('Abra o e-mail e o link, entrando (ou criando a conta) com o mesmo e-mail. Aceite.'), deve: 'A página do convite com o nome da empresa e o papel. Ao aceitar, a pessoa cai no portal da empresa e aparece em "Pessoas" no portal do dono.', naoConferido: 'o e-mail @petjourney.test do preparo não recebe nada.' },
      { lado: 'P', acao: b('Abra o mesmo link de novo, ou um inventado: /parceiro/convite?token=qualquer.'), deve: `${q('Seus convites')} com ${q('Este convite não vale mais')} e ${q('Convite não encontrado.')} O token some do endereço.`, prints: [['c6-convite-invalido']] },
      { lado: 'P', acao: `${b('Na pessoa nova, menu da linha >')} ${q('Definir funções')}${b(': marque')} ${q('Recepção')} ${b('e salve.')}`, deve: `As 8 funções (Recepção, Veterinário, Enfermagem, Cuidador, Banhista, Adestrador, Gestor, Financeiro), cada uma com o que abre. Marcando Cuidador, Banhista ou Adestrador numa pessoa sem ficha, aparece ${q('Cadastrar a ficha de profissional')} já marcada. Sem nenhuma função: só o portal comercial.`, naoConferido: 'sem uma segunda pessoa aceita na equipe. Veja a tabela do menu abaixo.' },
      { lado: 'P', acao: `${q('Equipe')} > ${q('Profissionais')} ${b('e depois')} ${q('Cadastrar profissional')}${b('. Olhe e toque em')} ${q('Cancelar')}.`, deve: `${q('Dra. Helena Duarte · CRMV 45678/SP · sem login · CRMV a conferir')} e ${q('Portal Demo · CRMV 12345/SP · login de Portal Demo · CRMV conferido')}. A gaveta ${q('Novo profissional')} pede Nome, Conselho, Especialidades (até 5), Cor na agenda, ${q('Atende na agenda')} e ${q('Login no portal')}.`, prints: [['c3-profissionais'], ['c4-ficha-profissional', 'gaveta']] },
      { lado: 'P', acao: `${q('Equipe')} > ${q('Auditoria')}.`, deve: `${q('Quem leu, escreveu, publicou ou exportou dado clínico, e quando. Sem o conteúdo, só a ação.')}, os filtros ${q('Ação')}, ${q('Pessoa')} e ${q('Período')} e as ações do dia, com hora e pessoa.`, prints: [['c5-auditoria']] },
      { lado: 'P', acao: `${b('Se não aceitou, cancele o convite do passo 1:')} ${q('Cancelar')} > ${q('Cancelar convite')}.`, deve: `${q('Cancelar o convite para ...?')} com ${q('O link enviado para esse e-mail para de funcionar.')} e depois ${q('Convite cancelado')}.` },
    ],
    extra: `<div class="caixa evitar"><div class="tit">O que cada função vê no menu (do código e dos guias; não conferido no preparo)</div>
<table><tr><th>Função</th><th>Clínica (base)</th><th>Pedidos</th><th>Pacientes</th><th>Atendimentos</th><th>Internação</th><th>Tratamentos</th><th>Estoque</th><th>Auditoria</th></tr>
<tr><td>Dono</td><td>sim</td><td>sim</td><td>sim</td><td>sim</td><td>sim</td><td>sim</td><td>sim</td><td>sim</td></tr>
<tr><td>Veterinário</td><td>sim</td><td>sim</td><td>sim</td><td>sim</td><td>sim</td><td>sim</td><td>sim</td><td>não</td></tr>
<tr><td>Recepção</td><td>sim</td><td>sim</td><td>sim</td><td>não</td><td>não</td><td>não</td><td>sim</td><td>não</td></tr>
<tr><td>Enfermagem</td><td>sim</td><td>não</td><td>sim</td><td>sim</td><td>sim</td><td>sim</td><td>sim</td><td>não</td></tr>
<tr><td>Gestor</td><td>sim</td><td>sim</td><td>sim</td><td>não</td><td>não</td><td>não</td><td>sim</td><td>sim</td></tr>
<tr><td>Financeiro</td><td>não</td><td>não</td><td>não</td><td>não</td><td>não</td><td>não</td><td>só o estoque</td><td>não</td></tr>
<tr><td>Sem função</td><td>não</td><td>não</td><td>não</td><td>não</td><td>não</td><td>não</td><td>não</td><td>não</td></tr></table>
<p class="mini">Clínica (base) = Hoje, Agenda, Fila, Pendências, Relatórios e Configuração. Todos veem Início, Programas, Divulgação, Acessos, Equipe e Estabelecimento (só lendo). Contas prontas para conferir isso, na Clínica Bem-Estar: bemestar.veterinaria, .recepcao, .enfermagem, .gestao, .financeiro e .semfuncao @example.com (senha das contas de 04/11), depois de aceitar o convite delas pelo link.</p></div>`,
    conhecido: [`A auditoria mostra o nome técnico em algumas linhas: ${q('abriu um registro (adesao)')}, ${q('(linha-do-tempo)')}, ${q('(preferencia-boletim)')}.`],
    naoBug: [`Só o Dono vê ${q('Convidar pessoa')}, ${q('Definir funções')} e ${q('Cadastrar profissional')}.`, `O convite novo só se aceita pelo link do e-mail: ${q('Seus convites')} é só aviso.`],
    bug: ['O link aceito põe a pessoa em outra empresa.', 'O link de um convite cancelado ainda aceita.'],
  },
  {
    letra: 'D', titulo: 'Cadastrar paciente e completar a ficha', sub: 'Cliente novo com CEP, alerta, quem pode buscar e o menu Mais',
    situacao: 'Testado em 09/11: passou (2 detalhes de tela, abaixo).',
    onde: PORTAL, conta: CLINICA,
    antes: `A responsável deste teste é a ${b('Júlia Prado')} (${JULIA}, telefone (11) 98888-7712). No app dela já existe o cachorro ${b('Bento')} (Beagle, macho). Os prints mostram a ${b('Fubá')}, da Bruna, cadastrada no preparo.`,
    passos: [
      { lado: 'P', acao: `${b('Clínica >')} ${q('Pacientes')}.`, deve: `${q('N pacientes ativos')}, ${q('Importar planilha')}, ${q('Cadastrar paciente')}, as abas ${q('Pacientes')}, ${q('Correções')}, ${q('Atendimentos')}, ${q('Bulário')} e ${q('Cópias')}, e a lista com espécie, raça, responsável, telefone e o selo do alerta.`, prints: [['d1-pacientes']] },
      { lado: 'P', acao: `${b('Toque em')} ${q('Cadastrar paciente')}${b('. Preencha: Bento, Cachorro, raça Beagle,')} ${q('Macho')}${b(', castrado')} ${q('Não')}${b(', porte')} ${q('Médio')}${b(', peso 12,4.')}`, deve: `${q('Nome e espécie são obrigatórios. O resto pode ser completado depois.')} O peso vira ${q('12,4 kg')} e ${q('Nascimento (opcional)')} é um calendário.`, prints: [['d2-cadastro-pet']] },
      { lado: 'P', acao: `${b('Em')} ${q('Quem responde por ele')}${b(', toque em')} ${q('Cliente novo')}${b(': Júlia Prado, telefone 11988887712,')} ${q('WhatsApp')}${b(', e-mail qa-julia@petjourney.test e CEP 01310-100.')}`, deve: `Ao completar o CEP, Rua ${q('Avenida Paulista')}, Bairro ${q('Bela Vista')}, Cidade ${q('São Paulo')} e UF ${q('SP')} se preenchem, com ${q('Endereço preenchido pelo CEP.')}`, prints: [['d3-cadastro-cliente']] },
      { lado: 'P', acao: `${b('Toque em')} ${q('Cadastrar paciente')}.`, deve: `O aviso ${q('Bento cadastrado')} e a ficha com ${q('Dados do paciente')}, ${q('Alertas')}, ${q('Vacinas')} (Antirrábica e V10 ${q('Não iniciada')}), ${q('Histórico clínico')}, ${q('Tratamentos em casa')}, ${q('Documentos')}, o bloco da Júlia com telefone, e-mail e endereço, ${q('Este pet em 30 segundos')}, ${q('No app do responsável')} com ${q('Ligar ao app')}, e ${q('Quem pode buscar')}.`, prints: [['d4-ficha']] },
      { lado: 'P', acao: `${b('Em Alertas,')} ${q('Novo alerta')}${b(': Alergia,')} ${q('Risco')}${b(', detalhe "Dipirona: inchaço no focinho" e')} ${q('Salvar')}.`, deve: `O alerta ${q('Alergia')} com o selo ${q('Risco')}, o detalhe, o lápis e ${q('Encerrar')}.`, prints: [['d5-alerta', 'gaveta']] },
      { lado: 'P', acao: `${b('Em')} ${q('Quem pode buscar')}${b(',')} ${q('Adicionar')}${b(': nome, relação, telefone e documento >')} ${q('Salvar')}.`, deve: `${q('Pessoa autorizada')} pede Nome, Relação, Telefone e Documento; a pessoa entra na lista como ${q('Irmão · (11) 9...-.... · RG ...')}.`, prints: [['d6-ficha-alerta-buscar']] },
      { lado: 'P', acao: `${b('Toque em')} ${q('Mais')}${b(', no alto da ficha. NÃO confirme nada.')}`, deve: `${q('Pôr foto')}, ${q('Registrar óbito')}, ${q('Inativar')} e ${q('Juntar com outro cadastro')}.`, prints: [['d7-mais']] },
      { lado: 'P', acao: b('Volte a Pacientes e busque "Júlia".'), deve: 'O Bento aparece pela busca do nome da responsável.', naoConferido: 'a busca não foi feita no preparo.' },
    ],
    conhecido: [`Com ${q('Endereço preenchido pelo CEP')}, o campo Número fica mais alto que o CEP ao lado.`, `O calendário lê ${q('Choose Month')} e ${q('Choose Year')}, em inglês, para leitor de tela.`],
    naoBug: ['A clínica tem o próprio cadastro: o Bento só se liga ao do app no teste E.', 'O plano de vacinas segue o catálogo da clínica (a de QA tem uma "Fiv/Felv" cadastrada para cachorro).'],
    bug: ['O cadastro fica duplicado.', 'O CEP preenche outro endereço.', 'A ficha abre sem o responsável ou com outro telefone.'],
  },
  {
    letra: 'E', titulo: 'Ligar o paciente ao app pelo código', sub: 'Código do balcão, aceite no app e o vínculo na ficha',
    situacao: `Testado em 09/11: passou. ${VIA_API}`,
    onde: `${PORTAL} App de dev no celular da responsável.`, conta: `Portal: ${CLINICA}. App: ${JULIA}.`,
    passos: [
      { lado: 'P', acao: `${b('Na ficha do Bento,')} ${q('Ligar ao app')} > ${q('Código')} > ${q('Gerar código')}.`, deve: `${q('Código para o responsável')} com 8 letras e números (ex.: MVJD-WZP8), ${q('No app, na tela "Tenho um código da clínica".')}, ${q('Vale até ...')} (72 horas) e ${q('Imprimir')}. As outras abas: ${q('E-mail')} manda o link ao e-mail do cadastro; ${q('QR da carteirinha')}.`, prints: [['e1-codigo', 'gaveta']] },
      { lado: 'A', acao: `${b('No app da Júlia:')} ${q('Minhas clínicas')} > ${q('Tenho um código da clínica')}${b('. Digite AAAA1111, depois o código certo. Ligue')} ${q('Diário')} ${b('e')} ${q('Peso de casa')} ${b('e')} ${q('Aceitar')}.`, deve: `O errado: ${q('Código não encontrado ou vencido. Peça outro à clínica.')} O certo: ${q('Pedido da clínica')} com ${q('Ligar a Bento')} e, depois de aceitar, a clínica em ${q('Clínicas')}.`, nota: 'No preparo, pela API: o código errado voltou 404 PROPOSTA_NAO_ENCONTRADA e o certo trouxe o pet com a sugestão "Fubá".' },
      { lado: 'P', acao: b('Recarregue a ficha do Bento.'), deve: `${q('No app do responsável')} com o selo ${q('No app')}, ${q('Ligado desde 9 de novembro de 2026, por código.')}, ${q('Encerrar vínculo')}, ${q('Diário completo: liberado')}, ${q('Peso de casa: liberado')} e ${q('Notas: não liberado')}; em ${q('PROPOSTAS')}, ${q('Aceita')}. ${q('Este pet em 30 segundos')} passa a mostrar ${q('Primeira vez na clínica')} e ${q('Ver o diário')}.`, prints: [['e2-ligado']] },
    ],
    naoBug: ['Cada código liga um paciente.', 'Em "Este pet em 30 segundos", Alergias vem do app: o alerta da clínica não aparece ali.'],
    bug: ['O código certo dá "não encontrado".', 'O Bento da clínica se liga a outro pet do app.', 'A ficha não mostra "Ligado desde" depois do aceite.'],
  },
  {
    letra: 'F', titulo: 'Agenda: marcar e ver horários', sub: 'Marcar, a gaveta do horário e a semana',
    tom: 'atencao',
    situacao: 'Testado em 09/11: passou. Tem 1 falta conhecida (não dá para avisar o responsável).',
    onde: PORTAL, conta: CLINICA,
    passos: [
      { lado: 'P', acao: `${b('Clínica >')} ${q('Agenda')}.`, deve: `${q('N horários marcados')}, ${q('Fechar o turno (N)')} quando há horário passado sem desfecho, ${q('Marcar horário')}, as abas ${q('Agenda')}, ${q('Pedidos')} e ${q('Fila de espera')}, o dia com as setas, ${q('Dia')}/${q('Semana')}, ${q('Exibição')} e uma coluna por profissional (07:00–22:00).`, prints: [['f1-agenda-dia']] },
      { lado: 'P', acao: `${q('Marcar horário')}${b(': Paciente "Bento"; Consulta; Portal Demo; hoje; hora: daqui a 1 hora; Salas: Consultório 1.')}`, deve: `Em ${q('Neste horário')}: ${q('Sem aviso neste horário.')}, ${q('Como pediu: Recepção')} e ${q('Encaixe')}.`, prints: [['f2-marcar', 'gaveta']] },
      { lado: 'P', acao: `${b('Toque em')} ${q('Marcar')}.`, deve: `O horário entra na coluna da Portal Demo com o nome do Bento, e ${q('Desfazer')} aparece por alguns segundos.`, prints: [['f3-marcado']] },
      { lado: 'P', acao: b('Marque outro horário do Bento hoje, 1 hora ANTES de agora, com a Dra. Helena Duarte e sem sala (é o do teste M).'), deve: 'O horário entra na coluna da Dra. Helena como agendado.' },
      { lado: 'P', acao: `${b('Toque no horário de daqui a 1 hora e depois em')} ${q('Mais ações')}.`, deve: `A gaveta com ${q('Responsável: Júlia Prado')}, ${q('Abrir a ficha')}, Quando, Atendimento, Profissional, Sala, ${q('Situação: Agendado')}, ${q('Pré-consulta')}, ${q('Histórico: Marcado em ... (Recepção)')} e ${q('Marcar chegada')}. Em Mais ações: ${q('Confirmar presença')}, ${q('Iniciar atendimento')}, ${q('Editar')}, ${q('Mudar horário')} e ${q('Cancelar horário')}.`, prints: [['f4-gaveta-horario', 'gaveta'], ['f5-mais-acoes', 'gaveta']] },
      { lado: 'P', acao: `${b('Feche e toque em')} ${q('Semana')}.`, deve: `${q('9 – 15 de novembro')} (a semana atual), um dia por linha com ${q('N horários')}, ${q('1 falta')} quando há, e os primeiros horários de cada dia.`, prints: [['f6-semana']] },
    ],
    conhecido: ['O portal não tem a opção de avisar o responsável ao marcar, mudar ou cancelar o horário (a API aceita desde a E3-06). A Júlia vê o horário no app, mas não recebe o aviso.'],
    naoBug: ['O horário cancelado fica no dia, riscado.', 'O número em "Fechar o turno" conta os horários que já passaram sem chegada nem falta.'],
    bug: ['O horário cai em outro dia ou com outro profissional.', '"Desfazer" não desfaz.'],
  },
  {
    letra: 'G', titulo: 'Recepção: presença, pré-consulta e chegada', sub: 'O que o responsável manda pelo app aparece na gaveta do horário',
    situacao: `Testado em 09/11: passou. ${VIA_API}`,
    onde: `${PORTAL} App de dev.`, conta: `Portal: ${CLINICA}. App: ${JULIA}.`,
    passos: [
      { lado: 'A', acao: `${b('No app da Júlia, abra o horário de daqui a 1 hora >')} ${q('Confirmar presença')}.`, deve: `${q('Presença confirmada')}.` },
      { lado: 'A', acao: `${q('Responder a pré-consulta')}${b(': Está com sintoma, "Está coçando muito a orelha direita e balançando a cabeça.", 3 a 7 dias, Igual, sintomas Coceira e Lambedura excessiva, peso de casa 12,5 e uma observação >')} ${q('Enviar para a clínica')}.`, deve: `${q('Pré-consulta enviada. A clínica lê antes da consulta.')}` },
      { lado: 'P', acao: b('Na agenda do portal, abra o horário do Bento.'), deve: `${q('Situação: Confirmado')} e, no histórico, ${q('Presença confirmada em ..., pelo responsável no app')}.`, prints: [['g1-confirmado', 'gaveta']] },
      { lado: 'P', acao: `${b('Toque em')} ${q('Ver a pré-consulta')}.`, deve: `${q('Respondida em ...')}, ${q('Sintoma')}, a queixa, ${q('3 a 7 dias · Igual')}, ${q('Sintomas: Coceira, Lambedura excessiva')}, ${q('Peso de casa: 12,5 kg, pesado em ...')} com ${q('Peso da balança de casa: confirme na clínica antes de anotar nos vitais.')} e a observação.`, prints: [['g2-pre-consulta', 'gaveta']] },
      { lado: 'P', acao: `${b('Toque em')} ${q('Marcar chegada')}.`, deve: `${q('Situação: Aguardando')}, ${q('Chegou em ...')} no histórico e o botão ${q('Iniciar atendimento')}.`, prints: [['g3-chegada', 'gaveta']] },
    ],
    conhecido: [`A pré-consulta respondida uma vez já diz ${q('editada em ...')} no mesmo minuto.`],
    naoBug: ['A pré-consulta abre 72 horas antes e fecha na hora do horário.', 'Peso de casa nunca vira peso aferido.'],
    bug: ['A presença confirmada no app não chega à agenda.', 'Os sintomas marcados no app não aparecem na gaveta.'],
  },
  {
    letra: 'H', titulo: 'Atendimento completo com receita assinada', sub: 'Seções, ato, prescrição, receita, finalizar, liberar e adendo',
    tom: 'atencao',
    situacao: 'Testado em 09/11: passou, com assinatura e PDF de verdade. Tem 3 erros conhecidos.',
    onde: PORTAL, conta: CLINICA,
    antes: `Para assinar, use a senha da conta (Teste@123). O catálogo de remédios do dev é pequeno: use ${q('Nome livre')}.`,
    passos: [
      { lado: 'P', acao: `${b('Na gaveta do horário,')} ${q('Iniciar atendimento')}.`, deve: `A tela do Bento com ${q('Consulta · data hora · Portal Demo · Cachorro · peso')}, ${q('Mais')}, ${q('Revisar e finalizar')}, as abas ${q('Anamnese')}, ${q('Exame físico')}, ${q('Diagnóstico')}, ${q('Conduta')} e ${q('Receita e documentos')}, ${q('Tudo salvo')} e ${q('Pré-consulta do app')} com ${q('Usar nos campos vazios')} e ${q('Ver as respostas')}. Cada campo respondido mostra ${q('No app: ...')} e ${q('Usar')}.`, prints: [['h1-atendimento']] },
      { lado: 'P', acao: `${q('Ver as respostas')} ${b('e depois')} ${q('Usar nos campos vazios')}.`, deve: `Motivo, Sintomas (Coceira, Lambedura excessiva), Peso de casa e a observação, com ${q('Recolher')}. Depois, Queixa principal, Desde quando e Apetite preenchidos, com o selo ${q('Do app')}.`, prints: [['h2-respostas']] },
      { lado: 'P', acao: `${q('Exame físico')}${b(': peso 12,6, temperatura 38,6, frequência cardíaca 96, respiratória 24.')}`, deve: `Os campos com a unidade (kg, °C, bpm, mpm) e ${q('Em casa: 12,5 kg. Não vai aos vitais.')}; no alto, ${q('Salvando')} e depois ${q('Salvo às ...')}.`, prints: [['h3-exame']] },
      { lado: 'P', acao: `${q('Diagnóstico')} > ${q('Adicionar diagnóstico')}${b(', busque "otite", escolha')} ${q('Otite externa bacteriana')} ${b('e troque')} ${q('Presuntivo')} ${b('por')} ${q('Definitivo')}.`, deve: `A linha com ${q('Otite externa bacteriana')} e o código ${q('DR-09')}.` },
      { lado: 'P', acao: `${q('Conduta')}${b(': Orientações, Sinais de alerta e retorno em 15 dias. Depois')} ${q('Registrar ato')} > ${q('Procedimento')} > ${b('"Limpeza do conduto auditivo direito" >')} ${q('Registrar')}.`, deve: `${q('Ato registrado.')} e, em ${q('Atos da consulta')}, a limpeza com a hora, ${q('Portal Demo')} e ${q('Anular')}.`, prints: [['h4-conduta']] },
      { lado: 'P', acao: `${q('Receita e documentos')} > ${q('Prescrever')} > ${q('Nome livre')}${b(': Otomax, marque')} ${q('Declaro que não é um medicamento controlado.')}${b(', 5, Gota, Otológica, a cada 12 horas, 10 dias, instruções >')} ${q('Salvar')}.`, deve: `${q('Prescrição salva.')} e ${q('5 gotas · Otológica · a cada 12 horas · por 10 dias')} com ${q('Fazer a receita')}.`, prints: [['h5-prescrever', 'gaveta']] },
      { lado: 'P', acao: `${q('Fazer a receita')}${b(', digite uma senha errada e')} ${q('Assinar')}.`, deve: `${q('Assinar a receita')} com ${q('Sai no PDF')} e, com a senha errada, ${q('Senha incorreta.')}`, prints: [['h6-senha-errada', 'gaveta']] },
      { lado: 'P', acao: `${b('Digite a senha certa e')} ${q('Assinar')}.`, deve: `Depois de alguns segundos, ${q('Receita assinada.')} e, em ${q('Receitas')}, ${q('Receita [código] · emitida em ... · válida até ... · Portal Demo')} com ${q('Abrir o PDF')}, ${q('Repetir')} e ${q('Cancelar a receita')}. ${b('Anote o código (teste T).')}`, prints: [['h7-receita']] },
      { lado: 'P', acao: `${q('Abrir o PDF')}.`, deve: 'Abre uma aba com o PDF da receita (ou ele baixa).', nota: 'No preparo, a aba abriu e o PDF baixou.' },
      { lado: 'P', acao: `${q('Revisar e finalizar')}.`, deve: `${q('Vai ao responsável quando o resumo for liberado')} com Diagnósticos, Orientações, Sinais de alerta e ${q('Retorno: Em 15 dias')}, e ${q('Depois de finalizar, orientação errada só se corrige por adendo.')}`, prints: [['h8-revisar', 'gaveta']] },
      { lado: 'P', acao: `${q('Finalizar')}.`, deve: `${q('Atendimento finalizado.')}, ${q('Finalizado em ... por Portal Demo')}, ${q('Registro fechado: para corrigir, escreva um adendo.')} e o botão ${q('Liberar o resumo')}.`, prints: [['h9-finalizado']] },
      { lado: 'P', acao: `${q('Liberar o resumo')}.`, deve: `${q('Resumo no app desde ...')} e o botão some.`, prints: [['h10-liberado']] },
      { lado: 'P', acao: `${q('Adendo')}${b(': escreva, deixe')} ${q('Para o responsável')} ${b('ligado e')} ${q('Salvar adendo')}.`, deve: `${q('Adendo salvo.')} e, em ${q('Registro')}, ${q('Adendo para o responsável')} com o texto, o nome e a hora. No app, o adendo aparece depois das orientações.`, prints: [['h11-adendo', 'gaveta'], ['h12-registro-adendo']] },
    ],
    conhecido: [
      `Antes de liberar, aparece ${q('Não publicado: o paciente não tem responsável ligado no app.')} com o pet ligado (o mesmo erro do app).`,
      `Em ${q('Ver as respostas')}, o peso de casa sai ${q('12,5 kg kg')}.`,
      `${q('Salvo às ...')} usa o fuso do computador: com o computador em Cuiabá, sai 1 hora antes da hora da clínica.`,
    ],
    naoBug: ['Assinar demora alguns segundos: o PDF é gerado na hora.', 'O PDF abre por 15 minutos; depois, toque de novo em "Abrir o PDF".', 'A receita pede a senha a cada assinatura.'],
    bug: ['A senha certa dá erro ao assinar.', 'O PDF não abre.', 'Depois de finalizar, ainda dá para mudar uma seção.', 'O resumo, a receita ou o adendo não chegam ao app.'],
  },
  {
    letra: 'I', titulo: 'Vacina e estoque', sub: 'Aplicar com o lote, a geladeira, receber lote e a lista de chamada',
    situacao: 'Testado em 09/11: passou (1 texto, abaixo).',
    onde: PORTAL, conta: CLINICA,
    passos: [
      { lado: 'P', acao: `${b('Na ficha do Bento,')} ${q('Aplicar vacina')} > ${q('V10 (múltipla canina)')}.`, deve: `Os lotes do estoque com validade e doses (ex.: ${q('V10-2611 · 30 de jun. de 2027 · 18 doses')}), o primeiro já escolhido, código e validade preenchidos, via ${q('Subcutânea')} e ${q('Quem aplicou: Portal Demo')}.`, prints: [['i1-aplicar-vacina', 'gaveta']] },
      { lado: 'P', acao: `${q('Aplicar e registrar')}.`, deve: `${q('V10 (múltipla canina): dose 1 de 2 registrada.')} e ${q('Já está na carteirinha do app de Júlia Prado.')}; no plano, ${q('V10 · A vencer · Próxima: dose 2 de 2 em ...')} e ${q('Histórico (1)')}.`, prints: [['i2-vacina-registrada']] },
      { lado: 'P', acao: `${q('Pendências')} > ${q('Estoque de vacinas')}.`, deve: `${q('N doses na geladeira · R$ ... parados')}, as abas Geladeira, Metas, Movimentos e Análise, e o lote usado com 1 dose a menos.`, prints: [['i3-geladeira']] },
      { lado: 'P', acao: `${q('Receber lote')}${b(': V10, um código, 5 doses, validade no ano que vem, custo 45,00 >')} ${q('Receber')}.`, deve: `O lote novo em ${q('Lotes')} com ${q('5 de 5 doses · vence em ...')}.`, prints: [['i4-receber-lote', 'gaveta']] },
      { lado: 'P', acao: `${b('Aba')} ${q('Movimentos')}.`, deve: `${q('Entraram 5 doses de V10 (múltipla canina)')} com a data, o código, quem recebeu e o valor.`, prints: [['i5-movimentos']] },
      { lado: 'P', acao: `${q('Pendências')} > ${q('Vacinas')}.`, deve: `${q('Lista de chamada')} com ${q('Todas')}, ${q('Vencidas')}, ${q('Série aberta')} e ${q('A vencer')}, e o Bento em ${q('Série aberta · V10 (múltipla canina) · Vence em 28 dias')} com o telefone. ${q('Aplicadas')} mostra a dose de hoje.`, prints: [['i6-lista-chamada']] },
    ],
    conhecido: ['Na lista de chamada o telefone sai sem máscara: 5511988887712.'],
    naoBug: ['"Marcar a próxima dose na agenda" é opcional.', 'Giárdia e Traqueobronquite aparecem como opcionais não iniciadas.'],
    bug: ['O estoque não baixa a dose.', 'A vacina não chega à carteirinha do app.', 'Lote vencido entra sem aviso.'],
  },
  {
    letra: 'J', titulo: 'Retornos e tratamentos em casa', sub: 'O retorno da Conduta e as doses que a casa registra',
    tom: 'falhou',
    situacao: 'Testado em 09/11: Retornos passou. Tratamentos em casa NÃO abriu (erro conhecido, abaixo).',
    onde: `${PORTAL} App de dev.`, conta: `Portal: ${CLINICA}. App: ${JULIA}.`,
    passos: [
      { lado: 'A', acao: `${b('No app da Júlia,')} ${q('Depois da consulta')} > ${b('a consulta >')} ${q('Criar lembretes')}${b('; na hora da dose,')} ${q('Dei')}.`, deve: `${q('Lembretes ativos')} e, na dose, ${q('Dada às ...')}`, nota: VIA_API },
      { lado: 'P', acao: `${q('Pendências')} > ${q('Retornos')}.`, deve: `${q('Todos')}/${q('Vencidos')} e o Bento com ${q('Vence em 15 dias · Retorno · Portal Demo · consulta de ...')}, ${q('Outro horário')} e ${q('Marcar')}.`, prints: [['j1-retornos']] },
      { lado: 'P', acao: `${q('Pendências')} > ${q('Tratamentos em casa')}.`, deve: `O Otomax do Bento com ${q('desde ...')}, e ${q('Pedem atenção')} vazia.`, erro: `${q('Algo deu errado — O servidor não aceitou os dados enviados.')}`, prints: [['j2-tratamentos-erro']] },
      { lado: 'P', acao: `${b('Ficha do Bento >')} ${q('Tratamentos em casa')}.`, deve: 'O Otomax com a dose que a Júlia marcou e "Ver os últimos 42 dias".', naoConferido: 'a ficha não foi aberta depois do "Dei".' },
    ],
    conhecido: ['Tratamentos em casa abre com "Algo deu errado" depois de entrar pelo login: a lista da API recusa o parceiroId (lacuna N34), e o contorno do portal depende de um dado que o login não põe no token.'],
    bug: ['O "Dei" do app não aparece na ficha.', 'O retorno não aparece depois do atendimento finalizado.'],
  },
  {
    letra: 'K', titulo: 'Documentos, termo e cópia do prontuário', sub: 'Termo com aceite pelo app e a cópia pedida pelo app',
    situacao: `Testado em 09/11: passou. ${VIA_API}`,
    onde: `${PORTAL} App de dev.`, conta: `Portal: ${CLINICA}. App: ${JULIA}.`,
    passos: [
      { lado: 'P', acao: `${b('Ficha do Bento >')} ${q('Novo documento')} > ${q('Termo de consentimento')}${b(': objeto, detalhamento, ligue')} ${q('Pedir o aceite pelo app')}${b(', senha >')} ${q('Emitir')}.`, deve: `Os tipos: atestados, comprovante de vacinação, pedido de exame, encaminhamento, declaração de óbito e os termos. Depois: ${q('Documento emitido.')} e ${q('Termo de consentimento · Emitido em ... · [código] · Portal Demo · aceite pendente · esperando a resposta no app')} com ${q('Abrir PDF')}, ${q('Registrar aceite')} e ${q('Anular')}. ${b('Anote o código (teste T).')}`, prints: [['k1-termo', 'gaveta']] },
      { lado: 'A', acao: `${b('No app da Júlia,')} ${q('Termos para responder')} > ${b('o termo > aceitar com a senha.')}`, deve: 'O termo fica aceito.' },
      { lado: 'P', acao: b('Recarregue a ficha.'), deve: `${q('... · aceito')}, sem ${q('Registrar aceite')}.`, prints: [['k2-termo-aceito']] },
      { lado: 'A', acao: `${b('No app, a clínica >')} ${q('Cópia do prontuário')} > ${q('Pedir')} ${b('no Bento.')}`, deve: `${q('Cópia pedida à clínica')}.` },
      { lado: 'P', acao: `${q('Pacientes')} > ${q('Cópias')} > ${b('o Bento >')} ${q('Gerar cópia')}${b(', e na gaveta')} ${q('Gerar cópia')} ${b('de novo.')}`, deve: `${q('Aberto')}, ${q('Pedido pelo app')}, Recebido em, ${q('Todo o histórico')}, Prazo (7 dias), ${q('Prorrogar prazo')} e ${q('Recusar pedido')}. Depois: ${q('Pronto')}, ${q('Na cópia: 1 atendimento')}, ${q('PDF guardado até ...')}, ${q('Baixar PDF')}, ${q('Como foi entregue')} e ${q('Quando o dono baixar pelo app, a entrega se registra sozinha.')}`, prints: [['k3-copia', 'gaveta'], ['k4-copia-pronta', 'gaveta']] },
    ],
    naoBug: ['Pedido pelo app: a cópia traz o histórico desde o início do vínculo do dono atual.', 'O prazo legal da cópia corre desde o pedido.'],
    bug: ['O aceite do app não chega à ficha.', 'A cópia sai sem o atendimento.'],
  },
  {
    letra: 'L', titulo: 'Pedidos de horário', sub: 'Pedido pelo app ou pelo site, aceitar e recusar',
    tom: 'falhou',
    situacao: 'Testado em 09/11: a caixa de Pedidos NÃO abriu (erro conhecido). O resto do teste não foi conferido.',
    onde: `${PORTAL} App de dev.`, conta: `Portal: ${CLINICA}. App: ${JULIA}.`,
    passos: [
      { lado: 'P', acao: `${q('Agenda')} > ${q('Pedidos')}.`, deve: `As abas ${q('Pendentes')}, ${q('Aceitos')}, ${q('Recusados')} e ${q('Encerrados')}, e o botão ${q('Como recebemos pedidos')}.`, erro: `${q('Algo deu errado — O servidor não aceitou os dados enviados.')}`, prints: [['l1-pedidos-erro']] },
      { lado: 'A', acao: `${b('No app da Júlia, a clínica >')} ${q('Pedir horário')}${b(': Bento, Vacina, Vacinação,')} ${q('Escolher o horário')}${b(', amanhã >')} ${q('Enviar pedido')}.`, deve: `${q('Pedido enviado. A clínica responde pelo app.')}`, naoConferido: 'a caixa não abriu.' },
      { lado: 'P', acao: `${b('Pedidos > o pedido >')} ${q('Horário pedido')}${b(', escreva uma mensagem >')} ${q('Marcar')}.`, deve: 'O pedido como aceito e o horário na agenda de amanhã. No app: "Aceito" e a mensagem da clínica.', naoConferido: 'a caixa não abriu.' },
      { lado: 'P', acao: `${b('Faça um segundo pedido e')} ${q('Recusar')} ${b('com um motivo.')}`, deve: 'No app: "Recusado" e "Por que a clínica recusou".', naoConferido: 'a caixa não abriu.' },
      { lado: 'P', acao: `${q('Como recebemos pedidos')}.`, deve: `${q('Receber pedidos pelo app e pelo link')}, os serviços, os profissionais e o prazo para responder.`, naoConferido: 'o botão não abriu nada com a caixa em erro.' },
    ],
    conhecido: ['A caixa de Pedidos abre com "Algo deu errado" depois de entrar pelo login: a API recusa o parceiroId nessa lista (lacuna N22), e o contorno do portal depende de um dado que o login não põe no token. É a mesma causa do teste J.'],
    bug: ['O pedido não chega à clínica.', 'O horário aceito não aparece na agenda nem no app.'],
  },
  {
    letra: 'M', titulo: 'Faltas', sub: 'A clínica marca, o responsável conta o motivo',
    situacao: `Testado em 09/11: passou (1 texto). ${VIA_API}`,
    onde: `${PORTAL} App de dev.`, conta: `Portal: ${CLINICA}. App: ${JULIA}.`,
    antes: 'Use o horário do Bento de 1 hora atrás (teste F, passo 4).',
    passos: [
      { lado: 'P', acao: `${b('Agenda > o horário que já passou >')} ${q('Marcar falta')}.`, deve: `${q('Bento não veio no horário das ...')} e a chave ${q('Já falei com o responsável')}.`, prints: [['m1-marcar-falta', 'gaveta']] },
      { lado: 'P', acao: `${q('Marcar falta')}.`, deve: `${q('Situação: Falta')}, o bloco ${q('Falta — Ninguém procurou ainda')} com ${q('Registrar contato')} e ${q('Reagendar')}, e ${q('Falta marcada em ...')} no histórico. ${q('Desfazer')} por alguns segundos.`, prints: [['m2-falta-marcada']] },
      { lado: 'A', acao: `${b('No app da Júlia, Agendamentos > Passados > o horário >')} ${q('Contar o que houve')} > ${q('Tive um imprevisto')} ${b('e uma frase >')} ${q('Enviar')}.`, deve: `${q('Obrigado por contar. A clínica vai ver.')}` },
      { lado: 'P', acao: `${q('Pendências')} > ${q('Faltas')} > ${q('Todas')} > ${b('a Júlia.')}`, deve: `${q('Faltas de Júlia Prado')} com o horário, ${q('Justificada')}, ${q('Pelo app · Imprevisto: [texto]')} e ${q('1 registro')}.`, prints: [['m3-faltas', 'gaveta']] },
    ],
    conhecido: [`O motivo sai com espaço antes dos dois-pontos: ${q('Imprevisto : O carro...')}`],
    naoBug: ['"Marcar falta" só aparece depois da hora e sem chegada marcada.', '"A justificar" fica vazia quando o responsável já contou o motivo.'],
    bug: ['A falta não aparece no app.', 'O motivo do app não chega à clínica.'],
  },
  {
    letra: 'N', titulo: 'Fila de espera e oferta de vaga', sub: 'A clínica põe na fila, a vaga abre e a oferta sai sozinha',
    situacao: `Testado em 09/11: passou. A oferta saiu sozinha (a política da clínica oferta ao primeiro da fila). ${VIA_API}`,
    onde: `${PORTAL} App de dev.`, conta: `Portal: ${CLINICA}. App: ${JULIA}.`,
    passos: [
      { lado: 'P', acao: `${q('Agenda')} > ${q('Fila de espera')} > ${q('Adicionar à fila')}${b(': Bento, Retorno, Portal Demo, Normal, disponibilidade amanhã das 08:00 às 12:00 >')} ${q('Adicionar à fila')}.`, deve: `${q('1 aguardando vaga')} e a linha ${q('1º · Bento · Retorno · Júlia Prado · Portal Demo · [dia] 08:00 a 12:00')}.`, prints: [['n1-adicionar-fila', 'gaveta']] },
      { lado: 'P', acao: `${b('Para abrir uma vaga: marque um Retorno do Bento amanhã às 10:00 com a Portal Demo, abra e')} ${q('Mais ações')} > ${q('Cancelar horário')} > ${b('um motivo >')} ${q('Cancelar o horário')}.`, deve: `${q('Cancelado em ..., pela recepção: [motivo]')} e o horário riscado no dia.`, nota: 'Escolha um horário em que a profissional está livre: um horário que já tem outro agendamento não vira vaga (no preparo, 09:00 não virou por causa do retorno da Mel).', prints: [['n2-cancelar', 'gaveta']] },
      { lado: 'P', acao: b('Espere 1 minuto e recarregue a Fila de espera.'), deve: `A linha do Bento com ${q('Vaga oferecida: [dia] · 10:00, responde até ...')}, o selo ${q('oferta automática')}, ${q('Registrar aceite')} e ${q('Registrar recusa')}.`, prints: [['n3-oferta-automatica']] },
      { lado: 'A', acao: `${b('No app da Júlia,')} ${q('Fila de espera')} > ${q('Aceitar este horário')}.`, deve: 'O agendamento já confirmado.' },
      { lado: 'P', acao: b('Abra a agenda de amanhã e o horário das 10:00.'), deve: `O Retorno do Bento ${q('Confirmado')}, com ${q('Marcado em ... (Fila de espera)')} no histórico.`, prints: [['n4-vaga-aceita', 'gaveta']] },
    ],
    conhecido: [`${q('Vagas para a fila (1)')} mostra 1, mas a gaveta diz ${q('Nenhuma vaga liberada com alguém da fila que caiba, nos próximos 14 dias.')} enquanto a oferta automática está aberta.`],
    naoBug: ['Com "Ofertar vagas sozinho ao primeiro da fila" ligado, a vaga sai sozinha em até 1 minuto e não fica em "Vagas para a fila".', 'O prazo da oferta não corre das 22h às 8h.'],
    bug: ['A oferta não chega ao app.', 'Aceitar não marca o horário.', 'Depois do prazo ainda dá para aceitar.'],
  },
  {
    letra: 'O', titulo: 'Internação e boletim', sub: 'Internar, prescrever, dose, evolução, boletim e alta',
    tom: 'atencao',
    situacao: 'Testado em 09/11: passou. As horas da internação saem no fuso do computador (erro conhecido).',
    onde: `${PORTAL} App de dev.`, conta: `Portal: ${CLINICA}. App: ${JULIA}.`,
    passos: [
      { lado: 'P', acao: `${b('Clínica >')} ${q('Internação')}.`, deve: `${q('0 de 5 leitos ocupados')}, ${q('Leitos')}, ${q('Plantão')}, ${q('Checklist do plantão')}, ${q('O que pede ação')} e os leitos por tipo (UTI, Geral R1 e R2, Felino F1, Isolamento I1) com ${q('Livre')} e ${q('Internar')}.`, prints: [['o1-mapa']] },
      { lado: 'P', acao: `${b('No R1,')} ${q('Internar')}${b(': Bento, motivo,')} ${q('Atenção')}${b(', peso de entrada 12,6; em')} ${q('Diagnóstico, responsável, entrada e previsão')}${b(': diagnóstico de trabalho e')} ${q('Eu, quem interna')} > ${q('Internar')}.`, deve: `${q('Internar no leito R1 — Leito R1 (Geral).')} Depois, a internação: ${q('R1 · Geral · 0 h internado · responsável: Portal Demo')}, Estado, Gravidade, Leito, Previsão de alta, Entrada, Checklist, Prescrições, Evolução, ${q('Boletim ao responsável')} e ${q('O caso')}.`, prints: [['o2-internar', 'gaveta'], ['o3-internado']] },
      { lado: 'P', acao: `${q('Prescrever')} > ${q('Monitoramento')}${b(': "Temperatura, hidratação e se vomitou", a cada 4 horas, Agora, Até suspender >')} ${q('Prescrever')}.`, deve: `${q('Prescrição feita, N doses criadas.')} e o checklist com as doses de 4 em 4 horas, cada uma com ${q('Recusou')}, ${q('Pulei')} e ${q('Dei')}.` },
      { lado: 'P', acao: `${b('No checklist,')} ${q('Dei')} ${b('na dose de agora.')}`, deve: `${q('Dada por Portal Demo às ...')} com ${q('Desfazer')}, e ${q('Tudo em dia.')}`, prints: [['o4-dose-dada']] },
      { lado: 'P', acao: `${q('Registrar evolução')}${b(': Atenção, temperatura 38,9 e os três textos >')} ${q('Salvar')}.`, deve: `A evolução com o plantão, a hora, ${q('Atenção')}, ${q('Portal Demo · 38,9 °C')}, os textos e ${q('Reescrever')}.`, prints: [['o5-evolucao', 'gaveta']] },
      { lado: 'P', acao: `${q('Escrever boletim')} > ${q('Usar')} ${b('numa sugestão >')} ${q('Salvar boletim')} > ${q('Enviar')}.`, deve: `As sugestões, ${q('O que a enfermagem anotou (interno)')} com ${q('Usar como ponto de partida')} e ${q('1 dose dada desde ...')}. Primeiro ${q('Rascunho')} com ${q('Descartar')} e ${q('Enviar')}; depois ${q('Boletim enviado ao app.')} e ${q('Enviado ... a 1 pessoa')}.`, prints: [['o6-boletim', 'gaveta'], ['o7-boletim-enviado']] },
      { lado: 'A', acao: `${b('No app da Júlia,')} ${q('Minhas clínicas')} > ${q('Internações')}.`, deve: `${q('Na clínica desde ...')} e o boletim em ${q('Notícias da clínica')}.`, nota: 'No preparo, a API devolveu a internação do Fubá para a responsável.' },
      { lado: 'P', acao: `${q('Encerrar internação')}${b(': Alta, orientação de saída, Agora >')} ${q('Dar alta')}.`, deve: `${q('Alta registrada.')}, ${q('As doses futuras foram suspensas.')}, ${q('Estado: Alta')} e as doses seguintes como ${q('Não registrada (internação encerrada)')}. No mapa, o R1 livre de novo.`, prints: [['o8-alta', 'gaveta'], ['o9-alta-registrada']] },
    ],
    conhecido: ['Entrada, doses, evolução e fim do plantão aparecem no fuso do computador: com o computador em Cuiabá e a clínica em São Paulo, tudo sai 1 hora antes (a API manda 18:13; a tela mostra 17:13).'],
    naoBug: ['O boletim sempre passa pela revisão: nada vai sozinho para a família.', `${q('O plantão passou do fim e não foi entregue')} aparece até alguém passar o plantão (o da noite de 08/11 ficou aberto).`, 'Peso de entrada não muda o peso do cadastro.'],
    bug: ['O boletim não chega ao app.', 'A alta não libera o leito.', 'A alta não aparece para a família.'],
  },
  {
    letra: 'P', titulo: 'Emergência pelo QR', sub: 'A ficha curta do pet que chegou sem o responsável',
    situacao: 'Testado em 09/11: passou. O QR foi trocado pelo endereço da carteirinha.',
    onde: `${PORTAL} App de dev.`, conta: `Portal: ${CLINICA} (CRMV conferido). App: ${JULIA}.`,
    antes: 'Leia com o celular o QR da carteirinha do Bento (no app da Júlia) e copie o endereço que abrir.',
    passos: [
      { lado: 'P', acao: `${b('Portal >')} ${q('Acessos')} > ${q('Emergência pelo QR')}${b('. Cole o endereço (ou só o código do fim) e um motivo >')} ${q('Abrir ficha')}.`, deve: `${q('Para o pet que chegou sem o responsável. Só quem tem o CRMV conferido abre a ficha, e o responsável é avisado na hora.')} O motivo conta até 300.`, prints: [['p1-emergencia', 'gaveta']] },
      { lado: 'P', acao: b('Veja o resultado.'), deve: `${q('O responsável foi avisado agora.')} e a ficha curta: nome, espécie, sexo, castrado, idade, peso, ${q('Alergias')}, ${q('Remédios contínuos')}, ${q('Condições')} e ${q('A ficha não traz o contato do responsável...')}, com ${q('Abrir outra ficha')}.`, prints: [['p2-ficha-aberta', 'gaveta']] },
      { lado: 'A', acao: b('No app da Júlia, a ficha de emergência do Bento.'), deve: `Em ${q('Quem abriu')}: a clínica, a hora, ${q('Portal Demo · CRMV-SP 12345')} e o motivo. Também chega notificação.`, nota: 'No preparo, a API mostrou o acesso para a responsável com o motivo e o CRMV.' },
    ],
    naoBug: ['A ficha mostra o que está no app do responsável; o alerta da clínica não entra.', 'Um link que não é de carteirinha mostra o aviso do link, sem abrir nada.'],
    bug: ['A ficha abre para quem não tem CRMV conferido.', 'O responsável não fica sabendo.'],
  },
  {
    letra: 'Q', titulo: 'Estabelecimento e página pública', sub: 'Página no ar, QR, horários e feriados em lote',
    situacao: 'Testado em 09/11: passou. Os feriados de 2027 foram adicionados e apagados.',
    onde: PORTAL, conta: CLINICA,
    passos: [
      { lado: 'P', acao: `${b('Portal >')} ${q('Estabelecimento')}${b('. Só olhe: NÃO tire a página do ar.')}`, deve: `${q('A página está no ar')}, as abas ${q('Página pública')}, ${q('Perfil e endereço')} e ${q('Horários')}, ${q('Tirar do ar')}, ${q('Publicada em ...')}, os links da clínica (petjourney.health/agendar/...) e do hotel (/reservar/...) com o QR, ${q('Copiar link')} e ${q('Baixar ou imprimir')}, ${q('Endereço da página')} com ${q('Trocar endereço')} e ${q('Mensagens ao responsável')}.`, prints: [['q1-pagina-publica']] },
      { lado: 'P', acao: `${q('Baixar ou imprimir')} ${b('da página da clínica.')}`, deve: `${q('QR da página')} com o QR, o link, ${q('Copiar link')}, ${q('Imagem PNG')}, ${q('Arquivo SVG')} e ${q('Folha para o balcão')}.`, prints: [['q2-qr', 'gaveta']] },
      { lado: 'P', acao: `${b('Aba')} ${q('Horários')}.`, deve: `${q('Aberto agora, fecha às 22:00')}, a régua do dia, os 7 dias das 07:00 às 22:00 e ${q('Feriados')} com ${q('Adicionar feriado')}.`, prints: [['q3-horarios']] },
      { lado: 'P', acao: `${q('Adicionar feriado')} > ${q('Feriados nacionais de 2027')}.`, deve: `Os 10 feriados de 2027, cada um ${q('Fechado')}, e ${q('Apagar vários')}.`, prints: [['q4-feriados']] },
      { lado: 'P', acao: `${q('Apagar vários')}${b(', marque os 10 >')} ${q('Apagar 10')} > ${q('Apagar')}.`, deve: `${q('Apagar 10 feriados?')} com ${q('Eles saem da lista e o horário da semana volta a valer nessas datas.')} e depois ${q('Feriados removidos — 10 dias saíram da lista.')}`, prints: [['q5-apagar-varios']] },
      { lado: 'P', acao: `${b('Aba')} ${q('Perfil e endereço')}${b(': troque o CEP e veja o endereço se preencher. NÃO salve.')}`, deve: 'Rua, bairro, cidade e UF do CEP novo.', naoConferido: 'só visto no cadastro de paciente (teste D).' },
    ],
    conhecido: [`Os horários dizem ${q('Horários no fuso America/Sao Paulo')} (o nome técnico do fuso), no portal e no site.`],
    naoBug: ['O feriado vale no lugar do horário da semana naquele dia.'],
    bug: ['O link ou o QR levam a outra clínica.', '"Apagar vários" deixa algum para trás.'],
  },
  {
    letra: 'R', titulo: 'Identidade e selo de assinatura', sub: 'O que libera assinar receita e finalizar prontuário',
    tom: 'atencao',
    situacao: 'Testado em 09/11 com a conta que já tem o selo: passou. O caminho de quem ainda não tem o selo não foi feito no preparo.',
    onde: PORTAL, conta: `${CLINICA}; para o passo 3, uma conta sem o selo.`,
    passos: [
      { lado: 'P', acao: `${q('Configurações')} > ${q('Perfil')}.`, deve: `${q('Verificação de identidade')}: ${q('Documento com foto, selfie e CPF, conferidos por uma pessoa da PetJourney. É o que libera emitir receitas e prescrições e finalizar prontuários.')} e ${q('Aprovada em 30 de outubro de 2026.')} com ${q('Ver envio')}; em CRMV, ${q('Abrir as fichas da equipe')}.`, prints: [['r1-identidade']] },
      { lado: 'P', acao: `${q('Ver envio')}.`, deve: `${q('Aprovada')}, o nome, ${q('Enviada em')} e ${q('Decidida em')}.`, prints: [['r2-ver-envio', 'gaveta']] },
      { lado: 'P', acao: b('Com uma conta sem o selo (na Bem-Estar, a Veterinária antes da conferência do CMS), tente assinar uma receita.'), deve: 'O botão avisa que falta a conferência da PetJourney e leva a enviar a identidade.', naoConferido: 'a conta de QA já tem o selo.' },
    ],
    naoBug: ['O CRMV fica na ficha de profissional (Equipe), não no perfil.'],
    bug: ['Uma conta sem o selo consegue assinar.'],
  },
  {
    letra: 'S', titulo: 'Hotel', sub: 'A casa, reservas e a rotina',
    tom: 'falhou',
    situacao: 'Testado em 09/11: Reservas, Mapa e Hóspedes NÃO abriram (erro conhecido). A casa de QA não tem acomodações; só foi criado o corredor "Canil".',
    onde: PORTAL, conta: CLINICA,
    passos: [
      { lado: 'P', acao: `${b('Hotel >')} ${q('Reservas')}.`, deve: `As abas ${q('Mapa')}, ${q('Reservas')} e ${q('Pedidos')}; ${q('Lista')}, ${q('Grade')} e ${q('Espera')}; ${q('Nova reserva')} e os filtros.`, erro: `${q('O servidor não aceitou os dados enviados. Confira e tente de novo.')}`, prints: [['s1-reservas-erro']] },
      { lado: 'P', acao: `${b('Hotel >')} ${q('A casa')}.`, deve: `${q('Acomodações')} e ${q('Rotina padrão')}, as abas Tipos, Tarifas, Temporadas, Serviços, Política e Exigências, ${q('Novo corredor')} e ${q('Nova acomodação')}. Sem tipo e tarifa: ${q('Para cadastrar acomodação, a casa precisa de um corredor, um tipo e uma tarifa.')}`, prints: [['s2-a-casa']] },
      { lado: 'P', acao: b('Crie um tipo, uma tarifa e uma acomodação no corredor "Canil".'), deve: 'A acomodação no corredor, livre no mapa.', naoConferido: 'parado no erro das listas.' },
      { lado: 'P', acao: b('Nova reserva para o Bento, check-in, rotina (prancheta), ocorrência, boletim e check-out.'), deve: 'Cada passo muda a reserva e o mapa; o boletim chega ao app.', naoConferido: 'parado no erro das listas. Depois da correção, use a seção de hotel do guia anterior (Claude Docs).' },
    ],
    conhecido: ['Reservas, Mapa e Hóspedes: a API recusa o parceiroId (400 "property parceiroId should not exist") e o portal sempre manda. Nessas telas não há contorno.'],
    bug: ['Uma tela do hotel mostra dados de outra casa.'],
  },
  {
    letra: 'T', titulo: 'Site', sub: 'Verificar receita e documento, e a página de agendar',
    tom: 'atencao',
    situacao: 'Testado em 09/11 com o site local: a receita verificou; o termo deu "Documento não encontrado"; o pedido pelo site não foi feito.',
    onde: 'site (petjourney-web), no computador.', conta: 'nenhuma.',
    passos: [
      { lado: 'S', acao: b('Abra /receita/[código do teste H].'), deve: `${q('Verificação de receita')}, ${q('Receita válida')}, ${q('Válida até ...')}, ${q('Receita emitida eletronicamente por Portal Demo, CRMV-SP 12345.')}, o código, a emissão, o estabelecimento, o paciente, o responsável só com as iniciais e os medicamentos.`, prints: [['t1-receita-valida', 'tudo']] },
      { lado: 'S', acao: b('Abra /documento/[código do termo do teste K].'), deve: 'Documento válido, com a data, o estabelecimento, quem emitiu e o resumo do conteúdo. Nunca o tipo do documento.', erro: `${q('Documento não encontrado')}`, prints: [['t2-documento-nao-encontrado', 'tudo']] },
      { lado: 'S', acao: b('Abra /agendar/clinica-e-hotel-demo.'), deve: `O nome e a cidade, ${q('Aberto agora, fecha às 22:00')}, ${q('Já usa a PetJourney? Peça pelo app')}, ${q('Pedir horário')} com ${q('Peça sem criar conta. A clínica responde em até 4 h, dentro do horário de atendimento.')}, ${q('PASSO 1 DE 5 — Qual o motivo da visita?')}, os horários e o contato.`, prints: [['t3-agendar', 'tudo']] },
      { lado: 'S', acao: b('Faça o pedido até o fim, com seu nome e telefone.'), deve: 'A confirmação do pedido; ele chega em Agenda > Pedidos (teste L).', naoConferido: 'a caixa de Pedidos estava em erro.' },
      { lado: 'S', acao: `${b('No portal, ficha de um paciente >')} ${q('Ligar ao app')} > ${q('E-mail')} ${b('para um e-mail seu; abra o link.')}`, deve: 'A página /clinica/vinculo/... com a clínica e o pet, e o caminho para aceitar no app.', naoConferido: 'precisa de um e-mail que receba.' },
    ],
    conhecido: ['Verificação do documento: a API responde 404 (DOCUMENTO_NAO_ENCONTRADO) para o código que ela mesma deu ao termo. A receita verifica.'],
    bug: ['Uma receita válida aparece como inválida.', 'A página mostra dados de outra clínica.'],
  },
  {
    letra: 'U', titulo: 'CMS', sub: 'Identidade, CRMV, módulos e aprovação de parceiro',
    tom: 'atencao',
    situacao: 'Não conferido no preparo: precisa da conta de administrador. Os passos vêm dos guias e do código.',
    onde: 'CMS (npm run dev no petjourney-cms, http://localhost:3000).', conta: 'a sua conta de administrador.',
    passos: [
      { lado: 'C', acao: `${b('Parceiros >')} ${q('Identidade e CRMV')} > ${q('Fila de identidade')}.`, deve: `${q('Em análise')}, do mais antigo ao mais novo. Abrir um envio mostra documento, verso e selfie com ${q('Os links expiram em m:ss.')}; ${q('Recusar')} pede 10 caracteres; ${q('Aprovar')} dá o protocolo IDT. No portal, ${q('Aprovada em ...')}.`, naoConferido: 'sem conta de administrador.' },
      { lado: 'C', acao: `${q('Conferir CRMV')} ${b('de uma ficha com identidade aprovada.')}`, deve: `${q('Conferir o CRMV de [nome]')} com a busca pública; motivo de 10 a 500 caracteres; ${q('CRMV conferido: [nome]')}, ${q('O selo vale 365 dias.')} e o protocolo CRM. No portal, a ficha passa a ${q('CRMV conferido')}.`, naoConferido: 'sem conta de administrador.' },
      { lado: 'C', acao: `${b('Parceiros > menu da linha >')} ${q('Módulos')}.`, deve: `Clínica e Hotel com o estado, o prazo, ${q('Mudar o prazo')}, ${q('Ligar como ativo')}, ${q('Suspender')} e ${q('Desligar')}. Suspenso, o portal mostra ${q('Só consulta')}.`, naoConferido: 'sem conta de administrador.' },
      { lado: 'C', acao: `${b('Parceiros >')} ${q('Auditoria')} > ${b('um pendente >')} ${q('Reconsultar na Receita')}.`, deve: `${q('CNPJ na Receita')} com situação, razão social e CNAE, e ${q('Consulta informativa. Ela não muda o credenciamento do parceiro.')}`, naoConferido: 'sem conta de administrador.' },
    ],
    naoBug: ['O administrador não decide a própria verificação.', 'Com 14 dias na fila, o envio é cancelado e as fotos apagadas.'],
    bug: ['A decisão do CMS não chega ao portal.'],
  },
  {
    letra: 'V', titulo: 'Empresa sem o módulo', sub: 'O que aparece para quem ainda não tem Clínica nem Hotel',
    situacao: 'Testado em 09/11: passou (1 texto).',
    onde: PORTAL, conta: 'qa-basico@petjourney.test (dona da "Pet Shop Teste QA").',
    passos: [
      { lado: 'P', acao: b('Entre com a qa-basico. NÃO peça nenhum módulo.'), deve: `O menu sem ${q('Clínica')} e sem ${q('Hotel')}; no Início, em Programas, ${q('Clínica — Agenda, prontuário, receitas e vacinas, ligados ao app do responsável.')} e ${q('Hotel — Reservas, check-in, rotina da casa e boletim ao responsável.')}, cada um com ${q('Pedir o módulo')}.`, prints: [['v1-inicio-sem-modulo', 'tudo'], ['v2-pedir-modulo']] },
      { lado: 'P', acao: b('Digite /clinica/agenda na barra do navegador.'), deve: 'Volta ao Início.' },
    ],
    conhecido: [`O pé do menu diz ${q('Falta pouco para emitir receitas')} para um pet shop sem a Clínica.`],
    bug: ['A Clínica aparece para quem não tem o módulo.', '"Pedir o módulo" dá erro.'],
  },
]

const situacaoCurta = {
  A: ['Portal', 'Alta', 'Passou'], B: ['Portal', 'Média', 'Passou'], C: ['Portal', 'Alta', 'Passou em parte'],
  D: ['Portal', 'Alta', 'Passou, 2 detalhes'], E: ['Portal e app', 'Alta', 'Passou'], F: ['Portal', 'Alta', 'Passou, 1 falta conhecida'],
  G: ['Portal e app', 'Alta', 'Passou'], H: ['Portal', 'Alta', 'Passou, 3 erros conhecidos'], I: ['Portal', 'Alta', 'Passou, 1 texto'],
  J: ['Portal e app', 'Média', 'Falhou: Tratamentos'], K: ['Portal e app', 'Média', 'Passou'], L: ['Portal e app', 'Alta', 'Falhou: caixa não abre'],
  M: ['Portal e app', 'Média', 'Passou, 1 texto'], N: ['Portal e app', 'Média', 'Passou'], O: ['Portal e app', 'Alta', 'Passou, horas no fuso errado'],
  P: ['Portal e app', 'Média', 'Passou'], Q: ['Portal', 'Média', 'Passou'], R: ['Portal', 'Alta', 'Passou em parte'],
  S: ['Portal', 'Média', 'Falhou: listas não abrem'], T: ['Site', 'Alta', 'Receita passou, documento falhou'], U: ['CMS', 'Alta', 'Não conferido'],
  V: ['Portal', 'Baixa', 'Passou, 1 texto'],
}

const achados = [
  ['J, L', 'Pedidos e Tratamentos em casa abrem com "Algo deu errado" depois de entrar pelo login. A API recusa o parceiroId nessas listas (lacunas N22 e N34); o portal só deixa de mandar quando o token traz o parceiroAtivoId, e o token do login não traz (só a troca de empresa traz).', 'Portal (contorno) e API (N22, N34)', 'Alta'],
  ['S', 'Hotel: Reservas, Mapa e Hóspedes abrem com erro. A API recusa o parceiroId (400 "property parceiroId should not exist") e o portal sempre manda.', 'API (e contorno no portal)', 'Alta'],
  ['T', 'Verificação pública do documento: GET /public/documentos/:codigo dá 404 para o código que a API deu ao termo (8B5F8DHSA9). A receita verifica.', 'API', 'Alta'],
  ['F', 'Marcar horário, Mudar horário e Cancelar não têm "avisar o responsável" (a API aceita desde a E3-06, guia e3 §4).', 'Portal', 'Média'],
  ['O, H', 'Internação (entrada, doses, evolução, plantão) e "Salvo às" mostram a hora no fuso do computador, não no da clínica.', 'Portal', 'Média'],
  ['H', 'Antes de liberar o resumo: "Não publicado: o paciente não tem responsável ligado no app." com o pet ligado (o mesmo do app).', 'API', 'Média'],
  ['H', 'Ver as respostas da pré-consulta: "12,5 kg kg" (PreConsultaNoAtendimento.vue põe o kg duas vezes).', 'Portal', 'Baixa'],
  ['I', 'Lista de chamada: telefone sem máscara ("5511988887711").', 'Portal', 'Baixa'],
  ['N', '"Vagas para a fila (1)" e a gaveta dizendo "Nenhuma vaga..." com a oferta automática aberta.', 'Portal ou API', 'Baixa'],
  ['G', 'Pré-consulta respondida uma vez já aparece como "editada" no mesmo minuto.', 'Portal ou API', 'Baixa'],
  ['M', 'Faltas: "Imprevisto : O carro..." com espaço antes dos dois-pontos.', 'Portal', 'Baixa'],
  ['C', 'Auditoria com nomes técnicos: "(adesao)", "(linha-do-tempo)", "(preferencia-boletim)".', 'Portal', 'Baixa'],
  ['D', 'Cadastro: com "Endereço preenchido pelo CEP", o campo Número fica mais alto que o CEP.', 'Portal', 'Baixa'],
  ['D, F, I', 'Calendário com "Choose Month" e "Choose Year" em inglês (leitor de tela).', 'Portal', 'Baixa'],
  ['Q, T', '"Horários no fuso America/Sao Paulo": o nome técnico do fuso, no portal e no site.', 'Portal e site', 'Baixa'],
  ['V', 'Pet shop sem a Clínica vê "Falta pouco para emitir receitas" no pé do menu.', 'Portal', 'Baixa'],
]

const achadosDoCodigo = [
  'Vagas e Boletins pendentes da internação não têm item no menu (abrem só pelo endereço).',
  '"Encerrar sem veterinário" não aparece para nenhuma função sozinha; só com Gestor e Enfermagem juntas.',
  'O Cuidador não acha nenhum pet em "Nova reserva" (a busca pede paciente.ler).',
  'Trocar o login de uma ficha com CRMV mostra a mensagem genérica de duplicado.',
  '"Completar meu CRMV" abre a ficha com o CRMV travado.',
  'Os selos do hotel no menu não têm texto próprio ("{total} pendências").',
]

const css = `
@page { size: A4; margin: 13mm 12mm 13mm 12mm; }
* { box-sizing: border-box; }
body { font-family: "Segoe UI", system-ui, sans-serif; color: #1F2A2E; font-size: 10.5pt; line-height: 1.45; margin: 0; }
h1 { color: #2E5A4C; font-size: 26pt; margin: 0 0 2mm; }
h2 { color: #1F2A2E; font-size: 15pt; margin: 0; }
h3 { color: #2E5A4C; font-size: 13pt; margin: 0 0 2mm; }
.q { color: #2B5E9C; font-weight: 600; }
.capa-sub { color: #5B6B70; margin-bottom: 6mm; }
.caixa { border: 1px solid #DCE3E1; border-radius: 10px; padding: 4mm 5mm; margin-bottom: 4mm; break-inside: avoid; }
.caixa.evitar { margin-top: 4mm; }
table { width: 100%; border-collapse: collapse; font-size: 9.5pt; }
th { background: #EEF2F1; text-align: left; padding: 2mm; }
td { border-top: 1px solid #E3E8E6; padding: 2mm; vertical-align: top; }
.mini { font-size: 9pt; color: #44545A; margin: 2mm 0 0; }
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
.passo:has(.fotos) .bloco { break-after: avoid; }
.lado-a-lado { break-inside: avoid; }
.acao { display: flex; gap: 3mm; align-items: flex-start; margin-bottom: 1.5mm; }
.num { width: 7mm; height: 7mm; border-radius: 50%; background: #E3ECE9; color: #2E5A4C; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-size: 10pt; }
.lado { display: inline-block; font-size: 8pt; font-weight: 700; letter-spacing: .3px; text-transform: uppercase; border-radius: 4px; padding: .3mm 1.8mm; margin-right: 2mm; vertical-align: 1px; }
.lado-p { background: #DCEBE6; color: #2E5A4C; } .lado-a { background: #DDE8F4; color: #2B5E9C; } .lado-s { background: #EEE6F6; color: #6A4A8C; } .lado-c { background: #F1E9DD; color: #7A5A2A; }
.deve { background: #EAF5EE; border-radius: 6px; padding: 2mm 3.5mm; margin-left: 10mm; }
.erro { background: #FBEAEA; border-radius: 6px; padding: 1.8mm 3.5mm; margin: 1.5mm 0 0 10mm; font-weight: 600; color: #8A2E2E; }
.nota { background: #FCF3E6; border-radius: 6px; padding: 1.8mm 3.5mm; margin: 1.5mm 0 0 10mm; font-size: 9.5pt; }
.nc { background: #F1F1F1; border-radius: 6px; padding: 1.8mm 3.5mm; margin: 1.5mm 0 0 10mm; font-size: 9pt; color: #555; }
.fotos { display: flex; gap: 4mm; margin: 3mm 0 0 10mm; flex-wrap: wrap; }
.corte { overflow: hidden; border-radius: 6px; border: 1px solid #CBD5D2; flex-shrink: 0; break-inside: avoid; }
.corte img { display: block; }
.passo > .fotos { display: block; orphans: 1; widows: 1; }
.passo > .fotos .corte { display: inline-block; vertical-align: top; margin: 0 4mm 3mm 0; }
.lado-a-lado { display: flex; gap: 5mm; align-items: flex-start; }
.lado-a-lado .txt { flex: 1; min-width: 0; }
.lado-a-lado .fotos { margin: 0; flex-wrap: nowrap; }
.conhecido, .naobug, .ebug { border-radius: 8px; padding: 3mm 4mm; margin-top: 4mm; break-inside: avoid; }
.conhecido { background: #FCF0E3; } .naobug { background: #EAF1FA; } .ebug { background: #FBEAEA; }
.tit { font-weight: 700; }
.resultado td { height: 8.5mm; }
.compacta { font-size: 8.8pt; } .compacta td, .compacta th { padding: 1.3mm 1.6mm; line-height: 1.35; }
.compacta + h3 + ul { font-size: 9pt; }
.quebra { break-before: page; }
`

const linhasIndice = testes
  .map((t) => {
    const [onde, prio, sit] = situacaoCurta[t.letra]
    const cls = /Falhou|falhou/.test(sit) ? 'ru' : /erro|falta|texto|detalhe|parte|fuso|Não conferido/.test(sit) ? 'at' : 'ok'
    return `<tr><td><b>${t.letra}.</b> ${t.titulo}</td><td>${onde}</td><td>${prio}</td><td class="${cls}">${sit}</td></tr>`
  })
  .join('')

const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Guia de teste: portal do parceiro (novembro)</title><style>${css}</style></head><body>
<h1>Guia de teste PetJourney</h1>
<div class="capa-sub">09/11/2026 · Portal do parceiro (novembro), com o site e o CMS · API de dev</div>

<div class="caixa"><h3>O que tem neste guia</h3>
<table><tr><th>Teste</th><th>Onde</th><th>Prioridade</th><th>Situação no preparo (09/11)</th></tr>${linhasIndice}</table></div>

<div class="caixa"><h3>Como usar</h3><ul>
<li>Faça os testes <b>na ordem</b>. De D a P o paciente é o mesmo: o <b>Bento</b>, da <b>Júlia</b>. Os prints foram tirados no preparo com a <b>Fubá</b>, da <b>Bruna</b>: no seu teste aparecem Bento e Júlia no lugar. Datas, horas e números mudam.</li>
<li>O portal é no <b>computador</b>. O lado do responsável é no <b>app de dev</b>, no celular (o guia do app de 08/11 mostra essas telas). Cada passo diz de que lado é: <span class="lado lado-p">Portal</span> <span class="lado lado-a">App do responsável</span> <span class="lado lado-s">Site</span> <span class="lado lado-c">CMS</span></li>
<li>No preparo, os passos do app foram feitos pela API de dev, com a conta da responsável, nas mesmas rotas que o app usa.</li>
<li>Em cada passo: faça o que está em negrito e confira o quadro verde <b>Deve aparecer</b>. Os textos entre aspas azuis são os nomes exatos dos botões e das telas.</li>
<li>Quadro vermelho <b>No preparo</b>: o que aconteceu de errado no preparo. Fundo cinza "não foi conferido no preparo": é o que mais precisa do seu olho.</li>
<li>Algumas horas do portal saem no fuso do computador (erro conhecido): com o computador em Cuiabá, some 1 hora nesses lugares.</li>
<li>Marque ☐ Passou / ☐ Falhou no alto de cada teste e preencha a folha de resultado no fim.</li>
<li>Achou um problema? Mande a letra do teste e o número do passo, o print, a hora e a conta. Antes, leia <b>Erro já conhecido</b> e <b>Não é bug</b>.</li>
</ul></div>

<div class="caixa"><h3>Ambientes</h3><ul>
<li><b>Portal</b>: o develop do admin contra a API de dev (no preparo, o commit bc519bc servido localmente). A clínica de QA tem os módulos Clínica e Hotel ativos.</li>
<li><b>App de dev</b>: para o lado do responsável. Deixe as notificações ligadas.</li>
<li><b>Site</b>: o petjourney-web contra a API de dev (no preparo, <code>next dev</code> local).</li>
<li><b>CMS</b>: <code>npm run dev</code> no petjourney-cms, com a sua conta de administrador.</li>
</ul></div>

<div class="caixa quebra"><h3>Contas prontas</h3>
<table><tr><th>Conta</th><th>Para quê</th><th>O que já tem</th></tr>
<tr><td><b>portal-demo@petjourney.test</b><br>senha Teste@123</td><td>A clínica. Dona da "Clínica e Hotel Demo", a mesma do guia do app.</td><td>CRMV conferido e identidade aprovada (assina receita e finaliza). Profissionais: Portal Demo e Dra. Helena Duarte. Salas, tipos, 5 leitos, estoque de V10, antirrábica e V4 felina. Clínica e Hotel ativos; o hotel sem acomodações (só o corredor "Canil").</td></tr>
<tr><td><b>qa-julia@petjourney.test</b><br>senha Teste@123</td><td>A responsável do teste de ponta a ponta (D a P).</td><td>Bento (Beagle, macho) no app. Sem nenhuma clínica.</td></tr>
<tr><td><b>qa-bruna@petjourney.test</b><br>senha Teste@123</td><td>Responsável com tudo pronto, para olhar sem criar nada.</td><td>Fubá ligada à clínica por código; consulta com receita assinada, adendo e lembrete; V10; falta justificada; retorno pela fila; internação com boletim e alta; termo aceito; cópia do prontuário pronta; ficha de emergência aberta. Também tem a gata Amora, sem clínica.</td></tr>
<tr><td><b>qa-basico@petjourney.test</b><br>senha Teste@123</td><td>Empresa sem Clínica nem Hotel (teste V).</td><td>Dona da "Pet Shop Teste QA". Não peça o módulo.</td></tr>
<tr><td><b>bemestar.*@example.com</b><br>senha das contas de 04/11</td><td>Uma pessoa por função na Clínica Bem-Estar (teste C, tabela do menu).</td><td>Veterinária (com ficha CRMV 48213/MT a criar), Recepção, Enfermagem, Gestão, Financeiro e Sem função. O convite de cada uma espera o aceite pelo link (token no banco).</td></tr>
</table>
<ul style="margin-top:3mm">
<li>Os testes mudam os dados das contas. Se algo não bater porque outra pessoa já testou, avise antes de marcar como bug.</li>
<li>Para repetir do zero: crie um responsável novo no app de dev (e-mail terminado em @petjourney.test) com um pet e use no lugar da Júlia.</li>
<li>Para assinar a receita, emitir documento ou aceitar termo, a senha pedida é a do login.</li>
</ul></div>

<div class="caixa"><h3>Fora deste guia</h3><ul>
<li>Celular: o portal é para computador e tablet.</li>
<li>Os protótipos que só existem na demonstração (histórico liberado, pedido em poucos passos).</li>
<li>Idiomas e o tema escuro: o preparo foi em português e no tema claro.</li>
<li>A família do responsável (só leitura).</li>
</ul></div>

${testes.map(teste).join('\n')}

<section class="teste"><h3>Erros já conhecidos (achados ao preparar este guia, 09/11)</h3>
<p>Se aparecerem, não precisa avisar de novo; avise se aparecer algo diferente.</p>
<table class="compacta"><tr><th>Teste</th><th>O que acontece</th><th>Onde corrigir</th><th>Peso</th></tr>${achados.map(([t, o, c, p]) => `<tr><td>${t}</td><td>${o}</td><td>${c}</td><td>${p}</td></tr>`).join('')}</table>
<h3 style="margin-top:6mm">Achados no código (não vistos na tela)</h3>
<ul>${achadosDoCodigo.map((a) => `<li>${a}</li>`).join('')}</ul>

<h3 class="quebra">Folha de resultado</h3>
<p>Quem testou: ____________________ &nbsp; Data: ___/___/2026 &nbsp; Navegador: ____________ &nbsp; Celular do app: ☐ Android ☐ iPhone</p>
<table class="resultado"><tr><th style="width:42%">Teste</th><th>Passou</th><th>Falhou</th><th style="width:38%">Passo e observação</th></tr>
${testes.map((t) => `<tr><td><b>${t.letra}.</b> ${t.titulo}</td><td>☐</td><td>☐</td><td></td></tr>`).join('')}</table>
</section>
</body></html>`

fs.writeFileSync(new URL('./guia.html', import.meta.url), html)
console.log('guia.html gerado,', testes.length, 'testes,', testes.reduce((s, t) => s + t.passos.length, 0), 'passos,', testes.reduce((s, t) => s + t.passos.reduce((n, p) => n + (p.prints?.length ?? 0), 0), 0), 'prints')
