# Frente Parceiro: validação de uso real (29/10/2026)

Persona e roteiro: fui a Helena Prado, dona da Aurora Clínica e Hotel Veterinário (aprovada, com
os programas Afiliado e Participativo, chave PIX = CNPJ, código UBB775), num dia de trabalho, na API
de dev real. Entrada: login com campos vazios, senha errada, "Mostrar", "Manter conectado", seletor
de idioma (pt, es, ar), sair e entrar de novo duas vezes. Casca: menu (recolher e expandir, grupos,
contadores, a forma do Portal medida a cada carga), topo, menu da conta, pular para o conteúdo,
404, Trocar de empresa. Início (bloco do Portal, cartão do código, gaveta do QR), Programas (com e
sem explicações), Divulgação (copiar código e link, regras), Indicados (os quatro filtros),
Acessos (Ativos e Histórico, busca, filtros, ordenação, detalhe da Paçoca e do Fred só olhando,
"Vincular código" aberto e fechado), Carteira (visão, Movimentações, Saques, ajuda, diálogo da chave
PIX aberto e fechado), Equipe (lista, convite pendente do Rafael, gaveta de convidar aberta e
fechada, menu da linha aberto), `/parceiro/convite` (sem token, token inválido, token curto),
Configurações (Perfil, Empresa, Segurança só com senha atual errada, Aparência, Conta).

Tamanhos: 1440x900, 1024x768 e 768x1024 com toque. Temas: claro e escuro (Indicados, Divulgação,
Carteira, Acessos, Equipe, 404, Trocar de empresa). Idiomas: pt em tudo; es na entrada; ar na
entrada, Início, Equipe e nas gavetas (também uma gaveta da Clínica, por causa da regra comum).
Contraste medido por script (texto contra o primeiro fundo opaco) no Início claro, Indicados,
Divulgação e 404 escuros.

Observação de ambiente: a página recarregou várias vezes pelo Vite (três frentes salvando
arquivos). Uma vez, no meio da recarga, a lista de Acessos apareceu com estilo pela metade (sem a
camada da moldura); recarregada, voltou ao normal. Não é defeito do produto.

## Achados

### P-01 · Menu do Portal "pula" depois do login e a cada recarga · Incomoda
- Tela: casca, menu do Portal  ·  Largura/tema: todas
- O que acontece: Indicados (só para dona) e Carteira (só com Afiliados ativo) dependem do contexto da empresa, que a API devolve de 1 a 3 s depois. Medido com um observador no menu: depois do login, o menu nasce com Programas, Divulgação, Acessos e Equipe (1,25 s) e ganha Indicados e Carteira no meio da lista 1,8 s depois; numa recarga em `/parceiro/programas`, 3,3 s depois.
- Por que pesa para quem usa: os itens descem diante de quem vai clicar; quem mira "Acessos" acerta "Indicados".
- Correção: a store guarda a forma do menu da última sessão (`petjourney-parceiro-menu`, dono e afiliado ativo), apagada no logout e na perda de acesso, como o nome da empresa; o menu lê `menuComIndicados` e `menuComCarteira`, que usam o contexto quando ele chega e a forma guardada antes (`src/stores/parceiro.ts:36`, `:94`; `src/composables/useAppNavigation.ts:446`). No login, o "Entrando..." espera também a empresa (teto de 4 s; falha não impede a entrada), e a casca nasce inteira (`src/pages/(shared)/auth/login.vue:184`). Permissão e tela continuam decidindo por `isDono` e `statusAfiliadoAtivo`. Teste novo em `src/stores/__tests__/parceiro.spec.ts`.
- Conferido: 1440, recarga: um estado só, os seis itens em 1,06 s. Sair e entrar de novo: um estado só, os seis itens junto com a tela (3,1 s, o mesmo tempo total de antes, sem a troca). Rede depois do login: um par dashboard + status.

### P-02 · Gavetas abrem à direita também no árabe · Incomoda
- Tela: todas as gavetas do portal (13 de 15 com `position="right"`)  ·  Largura/tema: `ar`
- O que acontece: o PrimeVue fixa o lado físico (`.p-drawer-mask:dir(rtl)` com `row-reverse`). No árabe a gaveta do QR do Início, as do Hotel e as da Clínica abriam à direita, por cima do começo da linha de leitura; só a de convidar da Equipe e a do saque calculavam o lado sozinhas.
- Por que pesa para quem usa: em árabe a gaveta cobre o título e o menu, em vez de ficar no fim da linha, e a página não é empurrada para o lado certo.
- Correção: regra única no `src/assets/main.css:203`: em RTL, "right" vira o fim da linha e "left" o começo (direção da máscara e animação de entrada e saída espelhadas). O empurrão da página (`padding-inline-end`) e os cantos arredondados já eram lógicos. As duas gavetas que faziam a conta sozinhas passaram a usar `right` (`src/components/parceiro/EquipeConviteGaveta.vue:51`, `src/components/parceiro/PortalSaqueDetalheDrawer.vue:60`); com `left`, a regra comum as devolveria à direita.
- Conferido: 1440 em árabe: gaveta do QR do Início (entra pela esquerda, x 0 a 432), convidar da Equipe (página empurrada, 424 a 1168) e "Configurações" dos pedidos da Clínica (`AgendamentoOnlineGaveta`, x 0 a 576, canto interno arredondado à direita). Em português a do QR continua à direita (1008 a 1440).

### P-03 · Segurança: o erro continua com o campo já corrigido · Confunde
- Tela: `/settings?aba=seguranca`  ·  Largura/tema: todas
- O que acontece: depois de "Alterar senha" com os campos vazios, preencher tudo deixava "Informe a senha atual." embaixo da senha digitada, "A nova senha não atende todos os requisitos." ao lado das quatro regras em verde e "Confirme a nova senha." com a confirmação igual.
- Por que pesa para quem usa: a tela diz o contrário do que mostra; parece que o formulário travou.
- Correção: cada erro sai quando o campo muda; a confirmação também sai quando a nova senha passa a bater com ela (`src/components/settings/SettingsSegurancaPanel.vue:42`).
- Conferido: 1440, três erros com tudo vazio e nenhum depois de preencher. Senha atual errada (nova = atual, para não mudar nada se fosse aceita): "A senha atual não confere. Confira e tente de novo." no campo, a sessão fica (P-01 de 27/10 segue valendo; a API agora responde 400 `SENHA_ATUAL_INCORRETA`).

### P-04 · "Internal server error", em inglês, no lugar do Início · Confunde
- Tela: `/inicio` e qualquer tela do Portal  ·  Largura/tema: todas
- O que acontece: a API de dev devolveu 500 em `dashboard` e `status` (ver Fora do portal). O Início trocou os blocos por "Algo deu errado / Internal server error"; o texto cru do servidor, em inglês, também chegava a toasts e faixas de erro. O mesmo acontecia com a lista do validador num 400 ("token must be longer than or equal to 16 characters").
- Por que pesa para quem usa: texto de desenvolvedor, em outra língua, na tela principal.
- Correção: o `apiFetch` monta a frase do erro: 5xx sem `codigo` vira "O servidor não conseguiu atender agora. Tente de novo em instantes."; mensagem em lista vira "O servidor não aceitou os dados enviados. Confira e tente de novo."; erro com `codigo` continua com a mensagem da API, que já vem traduzida (`src/service/api.ts:65`, chaves `errors.api.servidor` e `errors.api.dadosRecusados` nos 6 idiomas). 3 testes novos e 1 ajustado em `src/service/__tests__/api.spec.ts`.
- Conferido: pelos testes (500 genérico, 503 com código, 400 com lista, 502 com HTML). O 500 da API não se repetiu durante a conferência na tela.

### P-05 · Acessos: "ontem" ao lado de uma data de dois dias atrás · Confunde
- Tela: `/parceiro/acessos` e `/parceiro/acessos/:id`  ·  Largura/tema: todas
- O que acontece: o acesso de 27/10 às 21h13, visto em 29/10 às 20h, dizia "ontem · 27 de out." (47 horas divididas por 24 dão 1 dia).
- Por que pesa para quem usa: a palavra e a data da mesma célula se contradizem.
- Correção: a partir de 24 horas a conta é de dias de calendário no fuso de quem olha (`diasDeCalendarioEntre`, `src/utils/format/expiracao.ts:34`; `src/pages/(accounts)/parceiro/acessos/index.vue:532`, `[id].vue:747`). 3 testes novos em `src/utils/format/__tests__/expiracao.spec.ts`.
- Conferido: 1440: "anteontem · 27 de out.", "ontem · 28 de out.", "há 2 horas · 29 de out.".

### P-06 · Convite: link cortado oferece "Aceitar convite" · Confunde
- Tela: `/parceiro/convite?token=…`  ·  Largura/tema: todas
- O que acontece: com um token curto (link cortado ao copiar do e-mail), a prévia responde 400 sem código e a tela dizia "Não deu para ver agora de que empresa é o convite. Você ainda pode aceitar ou recusar." com "Aceitar convite" ativo, que também ia falhar. Token longo e inexistente já dizia "Este convite não vale mais".
- Por que pesa para quem usa: a pessoa tenta aceitar um convite que nunca vai funcionar, e não sabe que o problema é o link.
- Correção: 400 sem código também é link sem valor: o token sai e a tela diz "Este convite não vale mais / O link deste convite chegou incompleto. Abra de novo o link do e-mail, inteiro, ou peça um convite novo." e mostra a caixa de convites (`src/pages/(accounts)/parceiro/convite.vue:137`, chave `parceiro.convite.linkIncompleto` nos 6 idiomas).
- Conferido: 1440, `?token=abc123invalido` (antes e depois) e `?token=zzzz…` (32 caracteres, 404, como antes).

### P-07 · Equipe: "Sair da equipe" oferecido à única dona · Confunde
- Tela: `/parceiro/equipe`, menu "···" da própria linha  ·  Largura/tema: todas
- O que acontece: a Helena, única dona, tinha "Sair da equipe" no menu da linha. A API recusa (`409 EQUIPE_ULTIMO_DONO`), mas só depois do diálogo de confirmação.
- Por que pesa para quem usa: oferece uma saída que não existe, e assusta: sair da própria empresa.
- Correção: com uma pessoa dona só, a linha dela fica sem o menu; com outra dona, a saída volta (`src/components/parceiro/sections/PortalEquipeSection.vue:307`).
- Conferido: 1440 e 768 em pt e ar: a linha da Helena com o selo e sem o "···". Não abri o diálogo de confirmação.

### P-08 · WhatsApp do suporte escrito de dois jeitos, um deles com os dígitos agrupados errado · Confunde
- Tela: Carteira ("Como funciona a carteira") e as faixas de ajuda que usam `SUPPORT_CONTACTS` (cadastro, `UiPagina`)  ·  Largura/tema: todas
- O que acontece: a ajuda da Carteira dizia "55 67 9883-7848"; o resto do portal, "(67) 98837-848" (cinco e três dígitos, parecendo um celular com um número a menos).
- Por que pesa para quem usa: quem disca o número da faixa acha que falta um dígito.
- Correção: "(67) 9883-7848", os mesmos dígitos do `wa.me/556798837848`, e a ajuda da Carteira usa a constante comum (`src/utils/parceiro/support-contacts.ts:6`, `src/components/parceiro/panels/PortalCarteiraAjuda.vue:25`).
- Conferido: pelo código; o link continua o mesmo.

### P-09 · Login: campo vazio cai no balão do navegador · Incomoda
- Tela: `/auth/login`  ·  Largura/tema: todas
- O que acontece: aberto da rodada anterior (P-32 de 27/10). "Entrar no painel" com o e-mail vazio mostrava o balão "Preencha este campo." do navegador, na língua do sistema e não na do painel, enquanto cadastro e recuperação já conferem na própria tela.
- Correção: formulário com `novalidate` e conferência própria embaixo de cada campo: "E-mail é obrigatório.", "Informe um e-mail válido." (as frases que a recuperação já usa) e "Digite a sua senha." (nova, `auth.login.erroSenhaVazia` nos 6 idiomas); o foco vai para o primeiro campo com problema (`src/pages/(shared)/auth/login.vue:41`, `:359`).
- Conferido: 1440 claro, pt e es, vazio e depois a senha certa.

### P-10 · Login: o erro de senha fica em português depois de trocar o idioma · Polimento
- Tela: `/auth/login`  ·  Largura/tema: todas
- O que acontece: com "E-mail ou senha não conferem." na tela, trocar para Español mudava tudo menos o erro (a frase pronta era guardada).
- Correção: guarda-se o motivo do erro, e a frase sai do idioma atual (mesmo trecho do P-09).
- Conferido: 1440, erro em pt, troca para es pelo seletor: "El correo es obligatorio." e "Escriba su contraseña.".

### P-11 · Espanhol em "tú" na entrada e no detalhe do acesso · Polimento
- Tela: `/auth/login` e formulário de anotação  ·  Largura/tema: `es`
- O que acontece: "¿Aún no tienes cuenta?" e "Elige el área"; o espanhol do portal é em "usted".
- Correção: "¿Aún no tiene cuenta?" e "Elija el área" (`auth.login.support.prompt`, `acessos.anotacao.especialidadePlaceholder`). As chaves `divulgacao.howItWorks.*` também estão em "tú", mas nenhuma tela as usa.
- Conferido: 1440 em espanhol, login.

### P-12 · Programas: "Como um programa é ativado" e "Somente o dono pode solicitar" para a dona com tudo ativo · Incomoda
- Tela: `/parceiro/programas`  ·  Largura/tema: todas
- O que acontece: aberto da rodada anterior (P-32). Com os dois programas ativos, a tela mantinha a trilha "Solicitar, Em análise, Ativo" e "Somente o dono da conta pode solicitar a ativação. Operadores acompanham o status, mas não enviam pedidos." para a própria dona.
- Correção: com os dois ativos, a trilha só aparece com "Mostrar explicações" ligado; a nota do dono só aparece para quem não é dono (`src/components/parceiro/ProgramasParticipacaoView.vue:25`).
- Conferido: 1440 claro: a página termina nos dois programas.

### P-13 · Programas: só o de Afiliados diz desde quando está ativo · Polimento
- Tela: `/parceiro/programas`  ·  Largura/tema: todas
- O que acontece: "Ativo desde 27 de out. de 2026" no Afiliados e só "Ativo" no Participativo, aprovado no mesmo dia.
- Correção: os dois usam a data da decisão do programa, ou a do credenciamento quando a API não manda a do programa (`src/components/parceiro/ProgramaParticipacaoCard.vue:125`).
- Conferido: 1440: os dois selos com "Ativo desde 27 de out. de 2026".

### P-14 · Acessos: a busca diz "3 pets encontrados" para dois pets · Confunde
- Tela: `/parceiro/acessos`, aba Ativos, com busca, filtro ou ordenação  ·  Largura/tema: todas
- O que acontece: a frase do topo contava as linhas (acessos) como pets: "paç" dava "2 pets encontrados" para os dois acessos da mesma Paçoca.
- Correção: nos Ativos a frase conta acessos, "2 acessos encontrados" (`src/pages/(accounts)/parceiro/acessos/index.vue:821`, chave `acessos.saudacao.encontradosAcessos` com as formas de plural de sr e ar); o Histórico, que agrupa por pet, segue contando pets.
- Conferido: 1440: "2 acessos encontrados", "Nenhum acesso encontrado".

### P-15 · Acessos: "furão" em minúscula ao lado de "Cachorro" · Polimento
- Tela: lista e detalhe de Acessos (pet do tipo "Outro")  ·  Largura/tema: todas
- O que acontece: o tipo digitado pelo responsável aparecia como veio ("furão"), embaixo do nome, na mesma posição em que os outros pets mostram "Cachorro".
- Correção: inicial maiúscula, o resto como foi digitado (`src/utils/parceiro/especie-do-acesso.ts:19`); spec ajustado.
- Conferido: 1440, lista: "Fred · Furão · Consulta".

### P-16 · Detalhe do acesso: "Diagnóstico" desce para o meio da caixa · Polimento
- Tela: `/parceiro/acessos/:id`, Tratamento contínuo  ·  Largura/tema: 1440
- O que acontece: ao lado de um "Para que serve" de três linhas, o valor do "Diagnóstico" descia para a linha do meio (a grade esticava a célula).
- Correção: cada par alinhado pelo topo (`src/pages/(accounts)/parceiro/acessos/[id].vue:2237`).
- Conferido: 1440, NexGard: os dois valores na mesma altura (y 762).

### P-17 · Detalhe do acesso: dica do campo "Profissional" cortada · Polimento
- Tela: `/parceiro/acessos/:id`, Quem atendeu  ·  Largura/tema: 1440
- O que acontece: "Se vazio, usamos o nome da sua cont" (a caixa tem meia largura).
- Correção: a dica é o próprio nome da conta, em cinza ("Helena Prado"); sem nome, a frase de antes (`src/pages/(accounts)/parceiro/acessos/[id].vue:116`).
- Conferido: 1440, detalhe da Paçoca (sem enviar nada).

### P-18 · Estados vazios com uma palavra sozinha na última linha · Polimento
- Tela: Acessos (Histórico vazio, busca sem resultado), Carteira (Movimentações e Saques vazios)  ·  Largura/tema: 1440
- O que acontece: "…com as anotações da sua / empresa.", "…só o nome do / pet.", "…aparecem / aqui.".
- Correção: `text-wrap: balance` nos textos centrados (`acessos/index.vue:2306`, `PortalCarteiraExtratoPanel.vue:501`, `PortalCarteiraSaquesPanel.vue:291`).
- Conferido: 1440, busca sem resultado: "Ajuste a busca ou o período. A / busca alcança só o nome do pet.".

### P-19 · Indicados: coluna vazia empurra o selo para o meio da linha · Polimento
- Tela: `/parceiro/indicados`  ·  Largura/tema: todas
- O que acontece: a coluna de participação tem largura fixa e fica vazia quando ninguém rendeu nada; o selo "Não assinou" do Bruno ficava a 136 px da borda, com um vão à direita.
- Correção: a coluna só existe quando alguém da lista tem participação (`src/pages/(accounts)/parceiro/indicados.vue:247`).
- Conferido: 1440 claro e escuro: selo na borda (1380 de 1404, o respiro da linha).

### P-20 · Conta: "Dono" lá, "Titular da empresa" no Perfil · Polimento
- Tela: `/settings?aba=conta`  ·  Largura/tema: todas
- O que acontece: aberto da rodada anterior (P-32): a mesma pessoa era "Titular da empresa" no Perfil e "Dono" na Conta.
- Correção: a Conta usa os mesmos selos do Perfil (`src/components/settings/SettingsContaPanel.vue:75`).
- Conferido: 1440: "Aurora Clínica e Hotel Veterinário · Titular da empresa".

### P-21 · Trocar de empresa: outro nome, coluna no meio e linha pintada · Polimento
- Tela: `/parceiro/selecionar`  ·  Largura/tema: todas
- O que acontece: o menu da conta diz "Trocar de empresa" e a tela se chamava "Selecionar parceiro"; o título, a frase e a lista ficavam numa coluna de 34rem no meio, com as bordas vazias, e a empresa em uso pintava a linha inteira de pêssego.
- Correção: título "Trocar de empresa" (a chave do menu), a faixa de sempre com a frase, a lista na largura da tela, e a empresa em uso marcada só pelo selo "Em uso" (`src/pages/(accounts)/parceiro/selecionar.vue:122`, `:194`).
- Conferido: 1440 claro e escuro.

### P-22 · 404 com o desenho de antes da migração e entrada escalonada · Polimento
- Tela: qualquer endereço que não existe  ·  Largura/tema: claro e escuro
- O que acontece: fora da moldura, a página ficava sem a camada do app: botão verde-escuro (#2B5F51) e a pata num quadrado quase preto, ao lado de um portal inteiro em sálvia. As pegadas entravam uma a uma (110 ms cada, a interrogação aos 700 ms), a entrada escalonada que a Regra 4 recusa.
- Correção: a página põe `moldura-app` no `<html>` enquanto está aberta, como a entrada; a pata usa a sálvia do destaque; as pegadas ficam paradas (`src/pages/[...pathMatch].vue:37`, `:152`).
- Conferido: 1440 claro e escuro; "Ir para o início" leva ao Início com a moldura certa.

### P-23 · Início: bloco Portal diz "Nada parado agora" enquanto carrega · Polimento
- Tela: `/inicio`, bloco Portal  ·  Largura/tema: todas (visto a 1024)
- O que acontece: com os números ainda em esqueleto, o pé do bloco dizia "Nada parado agora"; quando a carteira chegava, virava "Abrir divulgação" e, 130 ms depois, "Compartilhar código".
- Correção: o pé fica em esqueleto até a carteira e o código chegarem (prop opcional `passoCarregando` em `src/components/home/HomeEspaco.vue:56`, usada em `HomeEspacoPortal.vue:329`; Clínica e Hotel não passam a prop e não mudam).
- Conferido: 1440, observador no pé: "esqueleto" e depois "Compartilhar código", sem a troca do meio.

## Não corrigido

### P-24 · Faixa de cima com texto branco sobre a sálvia abaixo de 4,5:1 · Polimento
- Tela: a faixa de todas as telas (data e frase do Início, frase das telas)  ·  claro
- Medido: 3,32:1 ("Quinta-feira, 29 de outubro", 13,5 px; "2 assuntos urgentes…", 15 px) e 4,25:1 nos rótulos dos quatro números.
- Por que não: é a faixa do app que o Luís escolheu em 26/10, em todas as telas e frentes. Proposta: escurecer a sálvia só atrás do texto (o mesmo tom do botão do app, #627A74, dá 4,6:1 com branco) ou subir a frase para 16 px em peso 700.

### P-25 · Programas e Divulgação com "R$ 50,00" escrito no texto · Incomoda
- Tela: Programas ("Saque via PIX a partir de R$ 50,00") e Divulgação, regras ("Saque a partir de R$ 50,00")
- O que acontece: a Carteira e o Início já leem o mínimo da API (`saqueMinimoCentavos`, E0-02); estes dois textos são fixos nos 6 idiomas e vão divergir quando o mínimo mudar.
- Correção (fechamento): o cartão do Afiliados guarda o `saqueMinimoCentavos` da carteira que ele já buscava e escreve "Saque via PIX a partir de {valor}"; sem a carteira (programa não ativo ou falha), "Saque via PIX na chave da empresa"; enquanto ela chega, um esqueleto na linha, para o texto não trocar diante de quem lê (`src/components/parceiro/ProgramaParticipacaoCard.vue:45`, `:197`; chave nova `programas.card.afiliado.feature3SemValor`). A Divulgação não carrega a carteira (e o arquivo dela estava com o coordenador): a regra ficou sem valor, "Saque via PIX / Quando o saldo sacável chega ao mínimo da Carteira, você pede o saque lá e recebe na chave PIX cadastrada." (`divulgacao.terms.payout`, só texto). As duas frases nos 6 idiomas; nenhum "R$ 50" sobrou nos catálogos.
- Conferido: 1440 claro. Programas: esqueleto em 0,8 s e "Saque via PIX a partir de R$ 50,00" (o valor da API) em 2,0 s, sem frase intermediária; o esqueleto fica na altura da linha. Divulgação, "Ver regras completas": o bloco "Saque via PIX" com a frase nova.

### P-26 · Ajuda da Carteira em linguagem de sistema · Polimento
- "liquidação orientativa até o dia 5", "o sacável libera após a janela", "programa afiliado" (minúsculo, o nome é "Programa de Afiliados"), "Cadastre a chave PIX da empresa antes de pedir saque. Só o dono…".
- Correção (fechamento): os quatro blocos reescritos nos 6 idiomas (es em "usted"): "Como o saldo entra / Cada assinatura paga por um responsável que veio da sua indicação rende participação na carteira, enquanto o Programa de Afiliados estiver ativo.", "O que entra espera 14 dias antes de poder ser sacado. O total mostra tudo; o sacável, só o que já passou desse prazo.", "Chave PIX da empresa / O saque cai na chave PIX da empresa: cadastre a chave antes do primeiro pedido. Só o dono da conta troca a chave e pede saque." e "Quando o pagamento cai / Saque a partir de {valor}. Os pedidos fecham no dia 27, e o pagamento está previsto até o dia 5 do mês seguinte." ("previsto" guarda o "orientativa" de antes). O valor continua vindo da API (`carteira.help.*` nos `src/locales/*.json`; `PortalCarteiraAjuda.vue` não mudou).
- Conferido: 1440 claro, Carteira, "Como funciona a carteira" aberto: os quatro blocos em duas colunas, "Saque a partir de R$ 50,00." com o mínimo da API.

### P-27 · Descrições das abas de Configurações com texto de sistema · Polimento
- "Segurança: Troca de senha da conta autenticada.", "Conta: Sessão, desativação de perfil e preferências futuras.", "Aparência: Tema, formato do menu lateral e densidade das listas." (a aba também tem idioma e explicações). Na Conta: "Encerramento permanente (LGPD) é outro fluxo e não aparece aqui." e "Não apaga clínica, parceiro nem histórico".
- Correção (fechamento): Segurança "Trocar a sua senha.", Aparência "Tema, navegação, explicações e idioma." (os títulos das quatro seções da aba), Conta "Sair deste computador, trocar de empresa e pausar o perfil."; na Conta, "A clínica, a empresa e o histórico continuam como estão. Só o seu perfil fica pausado." e "Excluir a conta de vez é outro pedido e não se faz por aqui." (sem "fluxo" nem "LGPD"; o portal não tem tela de exclusão, então a frase não promete caminho). Nos 6 idiomas (`settings.tabs.*.description`, `settings.conta.risk.points.scope.text` e `notDelete.text`).
- Conferido: 1440, as descrições no `title` das abas e as frases na Conta, claro e escuro.

### P-28 · Conta: a faixa "Desativar perfil" pinta a largura toda de rosa · Polimento
- A zona de risco é uma faixa rosa de ponta a ponta; a regra da casa põe o aviso no ícone e no botão, não na superfície.
- Correção (fechamento): a seção perdeu o fundo rosa e fica na mesma folha da sessão, separada pelo fio das outras seções de Configurações; o risco ficou no ladrilho (`ui-ladrilho--risco`) e no botão "Desativar perfil" (`severity="danger"`, contornado), que já estavam assim (`src/components/settings/SettingsContaPanel.vue:499`).
- Conferido: 1440 claro e escuro. Contraste medido no escuro: título 12,5:1, textos 7,1:1, botão 10,5:1, ícone do ladrilho 8,9:1. No escuro o fio entre as seções quase não aparece, como nas outras abas de Configurações.

### P-29 · Equipe: papéis no masculino ("Dono" para a Helena) · Polimento
- O selo da Equipe e o convite dizem "Dono" e "Operador"; o Perfil e agora a Conta dizem "Titular da empresa" e "Equipe da empresa" (P-16 de 27/10).
- Por que não: "Dono" e "Operador" são o vocabulário dos papéis em toda a tela ("Tornar dono", "Operadores acompanham…"). Proposta: "Titular" e "Equipe" no selo e nas ações ("Tornar titular"), nos 6 idiomas, numa passada só.

### P-30 · Divulgação: a mesma frase das leituras duas vezes · Polimento
- Topo: "Nenhuma leitura do QR ainda. Imprima o QR para o balcão e comece a medir."; logo abaixo, no bloco: "Nenhuma leitura ainda. Divulgue o QR no balcão e nas redes para começar a medir.".
- Correção (fechamento, coordenador): sem leituras, a faixa fica só com o título; a frase das leituras aparece uma vez, no bloco (`src/pages/(accounts)/parceiro/divulgacao.vue:44`). A chave `divulgacao.tela.resumoZero` saiu dos 6 idiomas.
- Conferido: 1440 claro, "Nenhuma leitura" uma vez na tela.

### P-31 · Indicados: "Quem assinou pelo seu código continua assinando." sem ninguém assinado · Polimento
- Filtro "Cancelaram" com zero assinaturas.
- Correção (fechamento, coordenador): "Ninguém cancelou / Se alguém que assinou pelo seu código cancelar a assinatura, o nome aparece aqui.", que vale com ou sem assinatura, nos 6 idiomas (`parceiro.indicados.vazioFiltro.CANCELADO.corpo`; no en, "canceled" com um l, como no resto do inglês americano).
- Conferido: 1440, dado real (Bruno, sem assinatura), filtro "Cancelaram".

### P-32 · Detalhe do acesso: cartão "Peso" com vão embaixo · Polimento
- No topo da Paçoca, o cartão do peso estica até a altura do cartão do prazo (que tem a barra), com ~50 px vazios.
- Correção (fechamento, coordenador): os blocos alinham pelo topo, cada um com a altura do que tem (`src/pages/(accounts)/parceiro/acessos/[id].vue:2231`, `align-items: flex-start`).
- Conferido: Paçoca, peso 100 px e prazo 135 px, os dois com o topo em 208.

### P-33 · Login: menu de idiomas encostado na borda e "العربية" desalinhado · Polimento
- O painel do seletor passa da borda direita do botão e encosta na janela (1440); a linha do árabe tem o nome à direita e o código "AR" à esquerda, ao contrário das outras.
- Correção (fechamento): no login e na página pública o painel cresce a partir do fim do botão, como o do painel de Configurações já fazia (`src/components/common/LanguageSwitcher.vue:341`); o nome do idioma, que já tinha `dir="auto"`, encolhe ao texto e fica no começo da linha (`justify-self: start`, `:380`), então "العربية" alinha com os outros nomes e com "AR". Na tela o botão já fica a 44 px da borda (20 px a 768), e o painel herda essa margem.
- Conferido: 1440 em pt (painel de 1196 a 1396, botão termina em 1397; as seis linhas com nome e código em x 1245 e 50 px de altura) e em ar (painel de 44 a 244, alinhado ao fim do botão, nomes e códigos à direita em x 195); 768 em pt (painel termina em 747, junto com o botão).

Não testado (exigiria ação real e irreversível, ou o estado não existe na conta):
- Salvar a chave PIX com "abc" para ver a recusa do portal: o clique em "Salvar chave" no diálogo real foi bloqueado pela permissão do ambiente; a recusa está coberta por `src/utils/validation/__tests__/pix.spec.ts`. A chave segue `275…181` (conferido depois na Carteira).
- Aviso da indicação vindo da API (só aparece com cadastro ou programa em análise; a Aurora está ativa). Saque (saldo zero, `SEM_SALDO`). Aceite e recusa do convite do Rafael (convite real). "Baixar QR" e "Imprimir" (abrem janelas do sistema).

## Para outras frentes

- **Hotel** (`src/features/hotel/components/base/PetAvatar.vue:180`): os seis tons do avatar são cheios (azul #3D6F8F, marrom #7A6A4A…) com letra branca, e aparecem também em Acessos (Fred "FR", Paçoca "PA") e na Agenda da semana do Início. A regra é cor só em pastel. Proposta: fundo pastel do mesmo matiz com a tinta escura da família.
- **Clínica** (Início, "Agenda da semana"): a lista de hoje sai fora da ordem do relógio (17:45 Luna em atendimento, depois 09:30, 15:00, 16:30, 17:00). Se a ordem é por estado, falta dizer isso; lido de relance, parece embaralhada.
- **Todas**: a regra das gavetas no árabe (P-02) vale para as gavetas da Clínica e do Hotel; conferi a `AgendamentoOnlineGaveta`. E o `apiFetch` (P-04) troca o texto de 5xx sem código e de lista do validador por frase da casa; quem decide por `statusCode`, `error` ou `codigo` não muda.

## Fora do portal (API, CMS, app)

- **500 intermitente na API de dev**: `GET /parceiro/portal/dashboard?parceiroId=cmvrdj8s3000i19mq28u7kjnp` e `GET /parceiro/portal/status?…` → 500 `{"statusCode":500,"message":"Internal server error"}` (29/10 por volta das 20h28, horário de Brasília); `GET /parceiro/portal/carteira?…` → 500 igual às 20h20, e 200 na tentativa seguinte. Com o dashboard fora, o Início inteiro vira estado de erro.
- **Prévia do convite com token curto**: `POST /parceiro/portal/equipe/convites/previa-por-link` `{"token":"abc123invalido"}` → 400 `{"message":["token must be longer than or equal to 16 characters"],"error":"Bad Request"}`, em inglês e sem `codigo`. Sugestão: tratar como `404 CONVITE_NAO_ENCONTRADO`, com a mensagem traduzida, como o token longo e inexistente já é.
- **Data da decisão dos programas**: `GET /parceiro/portal/status` devolve `afiliado.decididoEm: null` e `participativo.decididoEm: null` com os dois `ATIVO`; o portal mostra a data do credenciamento (`auditadoEm`) no lugar.
- **Resolvidos desde 27/10** (saem da lista): senha atual errada agora responde `400 SENHA_ATUAL_INCORRETA` (era 401); o limite subiu para 300 pedidos por minuto (era 60).
- Depois de "Sair da conta", saem `GET /parceiro/portal/dashboard` e `/status` sem token (401). Não aparece para quem usa; anotado porque gasta dois pedidos a cada saída.

## Arquivos compartilhados editados

- `src/locales/*.json` (6): chaves novas `auth.login.erroSenhaVazia`, `errors.api.servidor`, `errors.api.dadosRecusados`, `parceiro.convite.linkIncompleto`, `acessos.saudacao.encontradosAcessos`; duas frases do espanhol. Só com a ferramenta Edit, em trechos pequenos.
- `src/assets/main.css`: regra das gavetas no árabe (P-02).
- `src/service/api.ts`: frase do erro (P-04).
- `src/stores/parceiro.ts`: forma do menu guardada (P-01).
- `src/composables/useAppNavigation.ts`: o menu do Portal lê `menuComIndicados` e `menuComCarteira` (a frente da Clínica também mexeu neste arquivo, no selo de Faltas; sem conflito).
- `src/components/home/HomeEspaco.vue`: prop opcional `passoCarregando` (Clínica e Hotel não usam).

## Verificação final

- `npm run type-check`: sem erros.
- `npm run check:i18n`: paridade OK. `node scripts/lint-copy.mjs src/locales`: ok.
- `npx oxlint` e `npx eslint` nos 30 arquivos tocados: sem saída.
- `npx vitest run src/components/home src/components/parceiro src/components/settings "src/pages/(accounts)/parceiro" src/stores/__tests__/parceiro.spec.ts src/service src/utils src/navegacao src/router src/composables`: 48 arquivos, 447 testes, todos passando. Novos: 1 em `parceiro.spec.ts` (forma do menu), 3 em `api.spec.ts` (e 1 ajustado), 3 em `expiracao.spec.ts`; `especie-do-acesso.spec.ts` ajustado.
- Prettier `--write` só em `src/pages/[...pathMatch].vue` e `especie-do-acesso.spec.ts`, os dois formatados no HEAD e não compartilhados; os outros arquivos tocados já estavam fora do Prettier no HEAD ou são compartilhados.
- Nada criado nem alterado na API: nenhum convite, nenhum saque, nenhuma anotação, chave PIX igual. Pedidos de escrita feitos: um `POST /auth/reset-password-authenticated` com a senha atual errada (e a nova igual à atual) e prévias de convite com tokens falsos.
- Navegador de volta a pt e claro no fim.
