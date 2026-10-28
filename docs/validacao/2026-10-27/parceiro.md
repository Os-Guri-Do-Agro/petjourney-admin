# Frente Parceiro: validação de uso real (27/10/2026)

Persona e roteiro: fui a Helena Prado, dona da Aurora Clínica e Hotel Veterinário, que acabou de
criar a conta e cadastrar a empresa. Com o cadastro EM ANÁLISE: entrada (login com erro, e-mail
inexistente, campos vazios, "manter conectado" ligado e desligado, esqueci a senha até o PIN,
cadastro até o passo 2), casca (menu, menu da conta, 404, `/tutor`, `/parceiro/selecionar`,
`/parceiro/convite`, pular para o conteúdo), Configurações (Perfil, Empresa, Segurança só com
senha errada, Aparência, Conta só olhando) e Início, Programas, Divulgação, Acessos e Carteira.
Durante a validação a empresa foi APROVADA no CMS: segui com a transição, Programas ativos,
Divulgação (código, link, QR), Carteira (chave PIX, saque com saldo zero), Equipe (convite para o
veterinário Rafael Moura, conta criada por mim) e Acessos com um compartilhamento real criado pela
API (tutora Camila Rocha, cachorra Paçoca). Idiomas pt, es e ar (RTL), claro e escuro, 1440,
1024x768 e 768x1024 com toque.

Observação de ambiente: a página foi recarregada pelo Vite dezenas de vezes (as quatro frentes
salvando arquivos); vários formulários longos tiveram de ser refeitos. Não é defeito do produto.

## Achados

### P-01 · Senha atual errada em Segurança derruba a sessão · Bloqueia
- Tela: `/settings?aba=seguranca`  ·  Largura/tema: todas
- O que acontece: com a senha atual errada, aparece "Não foi possível alterar a senha / A senha antiga está incorreta" e, no mesmo instante, o menu lateral some; a tela fica sem casca e o próximo clique leva ao login. A API responde `POST /auth/reset-password-authenticated` com **401** e o `apiFetch` limpava a sessão em todo 401.
- Por que pesa para quem usa: errar uma letra da senha atual desloga a dona da empresa no meio da tela, sem explicação.
- Correção: `apiFetch` ganhou a opção `manterSessaoEm401`, usada pela troca de senha (`src/service/api.ts:75`, `src/service/auth/auth-service.ts:142`). 3 testes novos em `src/service/__tests__/api.spec.ts`.
- Conferido: spec (senha errada mantém o token; sessão que cai limpa e avisa; 401 do login não avisa).

### P-02 · Sessão que cai no meio do uso deixa a tela sem menu e sem aviso · Confunde
- Tela: qualquer tela da casca  ·  Largura/tema: todas
- O que acontece: quando a API devolve 401 (token vencido ou revogado), a sessão é limpa, a moldura some e a tela fica aberta, sem menu, até o próximo clique.
- Por que pesa para quem usa: parece que o sistema quebrou.
- Correção: o 401 com sessão aberta dispara `EVENTO_SESSAO_EXPIRADA`; o `App.vue` mostra "Sua sessão terminou / Entre de novo para continuar de onde parou." e leva ao login com o caminho atual em `redirect` (`src/App.vue:67`, `src/service/api.ts:79`). Chaves `auth.login.sessaoExpirada*` nos 6 idiomas.
- Conferido: spec do evento em `api.spec.ts`.

### P-03 · Dashboard e status pedidos 4 vezes em cada carga · Incomoda
- Tela: `/inicio` (4 pares), `/parceiro/programas` e `/parceiro/divulgacao` (2 pares)  ·  Largura/tema: todas
- O que acontece: `GET /parceiro/portal/dashboard` e `GET /parceiro/portal/status` saíam 4 vezes cada ao abrir o Início (moldura, página, bloco do Portal e cartão do código pedindo o contexto juntos). A API tem limite de 60 pedidos por minuto (`x-ratelimit-limit: 60`).
- Por que pesa para quem usa: carga mais lenta e risco de 429 com várias abas ou várias pessoas da mesma empresa.
- Correção: a store reaproveita a carga em andamento quando o pedido não é forçado (`src/stores/parceiro.ts:150`). 2 testes novos em `src/stores/__tests__/parceiro.spec.ts`.
- Conferido: 1440, rede do Início depois do login: 1 dashboard + 1 status.

### P-04 · Topo da barra mostra "Parceiro PetJourney" até chegar o nome da empresa · Incomoda
- Tela: casca, em toda carga completa  ·  Largura/tema: todas
- O que acontece: por 1 a 2 s o topo da barra diz "Parceiro / PetJourney" (texto fixo em português, também em inglês e árabe) e depois troca para "Aurora Clínica e…".
- Por que pesa para quem usa: o nome da empresa piscando a cada recarga parece erro; em outro idioma aparece português.
- Correção: a store guarda o nome da última sessão (`petjourney-parceiro-nome`, apagado no logout e na perda de acesso) e o provisório é traduzido, "Sua empresa" (`src/stores/parceiro.ts:65`, chave `shell.barra.empresaProvisoria`). Teste novo no spec da store.
- Conferido: 1440 claro e escuro, recarga em `/parceiro/carteira`: o nome já aparece no primeiro quadro.

### P-05 · Área principal em branco na primeira carga · Incomoda
- Tela: qualquer tela, recarga completa  ·  Largura/tema: todas
- O que acontece: a barra aparece e a área da tela fica toda branca até o código da página chegar (medido: 350 ms com o servidor quente; 1 a 2 s com o Vite frio).
- Correção: enquanto a página não chega, a faixa com "Carregando" (`UiPagina carregando`) no lugar do branco (`src/App.vue:147`).
- Conferido: 1440, recarga em `/settings` e entrada do Rafael.

### P-06 · Início: o bloco Portal mostrava só um dos dois programas pedidos · Confunde
- Tela: `/inicio`  ·  Largura/tema: 1440 claro e escuro
- O que acontece: a empresa pediu Afiliados e Participativo no cadastro (API: `afiliado: SOLICITADO`, `participativo: SOLICITADO`), mas o bloco mostrava só "Programa de Afiliados · Em análise".
- Por que pesa para quem usa: parece que o segundo pedido se perdeu.
- Correção: o bloco lista os programas pedidos, cada um com o selo, e com os dois em análise diz "Os dois pedidos estão em análise. O resultado aparece aqui assim que for decidido." (`src/components/home/HomeEspacoPortal.vue:210`).
- Conferido: 1440 claro e escuro, ainda em análise.

### P-07 · Início prometia ganhos e código com a empresa em análise · Confunde
- Tela: `/inicio`  ·  Largura/tema: todas
- O que acontece: a frase da abertura dizia "Acompanhe seus ganhos e compartilhe seu código." com o cadastro em análise (sem código e sem carteira), e também para conta sem empresa nenhuma.
- Correção: em análise, "Seu cadastro está em análise. O resultado chega por e-mail."; aprovada sem Afiliados ativo, "Seu código e seus ganhos aparecem quando o Programa de Afiliados estiver ativo."; sem empresa ou carregando, sem frase (`src/pages/(accounts)/inicio.vue:129`).
- Conferido: 1440 claro e escuro (em análise, aprovada, conta do Rafael sem empresa).

### P-08 · Toast do envio do cadastro com frase quebrada · Incomoda
- Tela: `/settings?aba=empresa` (envio do cadastro)  ·  Largura/tema: todas
- O que acontece: "Cadastro e Programa Afiliado, Programa Participativo foram para análise."
- Correção: a lista sai na regra do idioma (`Intl.ListFormat`): "Cadastro da empresa, Programa de Afiliados e Programa Participativo foram para análise. O resultado chega por e-mail." (`src/components/parceiro/PortalParceiroFunilSection.vue:95`, chave `parceiroCadastro.toast.enviadoComProgramas` com `{itens}` nos 6 idiomas).
- Conferido: pelo código e pelas chaves (a conta já tem cadastro; não reenviei).

### P-09 · O mesmo cadastro e o mesmo programa com nomes diferentes · Confunde
- Tela: `/settings?aba=empresa`, `/inicio`, `/parceiro/programas`  ·  Largura/tema: todas
- O que acontece: "Cadastro da empresa" no formulário e "Cadastro do negócio" na lista "Em análise agora"; "Programa Afiliado" no cadastro, "Programa de Afiliados" no Início e em Programas (sérvio e árabe com um terceiro nome no Início).
- Correção: "Cadastro da empresa" e "Programa de Afiliados" em todo lugar, nos 6 idiomas (`parceiroCadastro.pendente.itemCadastro`, `parceiroCadastro.programas.afiliado.name`, `inicio.programa.titulo` em sr/ar).
- Conferido: 1440, Configurações > Empresa (wizard do Rafael: "Vai para análise: Cadastro da empresa, Programa de Afiliados").

### P-10 · "As alterações são salvas imediatamente." com botão Salvar logo abaixo · Confunde
- Tela: `/settings?aba=empresa`, "Editar cadastro"  ·  Largura/tema: todas
- O que acontece: a frase diz que salva sozinho, mas nada é gravado sem "Salvar alterações" (o PATCH só sai no clique). A frase é que estava errada.
- Correção: "Ajuste os dados da empresa e salve as alterações." nos 6 idiomas (`parceiroCadastro.editar.lede`).
- Conferido: 1440 em português e espanhol.

### P-11 · Ações em texto solto: "Acompanhar credenciamento", "Escolher programas", "Cadastrar/Trocar" chave PIX · Incomoda
- Tela: faixa do cadastro (`/inicio`, `/parceiro/divulgacao`, `/parceiro/acessos`, `/parceiro/acessos/:id`), cadastro da empresa, Carteira  ·  Largura/tema: todas; no escuro o "botão" da faixa sumia
- O que acontece: ações em texto colorido sem caixa (`ui-mais`, `Button link`). Na Carteira com saldo zero, o "Cadastrar" pequeno ao lado de "Chave PIX" é o único caminho para cadastrar a chave.
- Correção: botão secundário de verdade; na faixa e em Acessos `Button :as="RouterLink"` (com classes num link, sem outro botão na tela o PrimeVue não carregava o estilo e o botão virava texto) (`src/components/parceiro/PartnerOperabilityBanner.vue:73`, `src/pages/(accounts)/parceiro/acessos/index.vue:980`, `src/pages/(accounts)/parceiro/acessos/[id].vue:1317`, `src/components/parceiro/PortalParceiroCadastroForm.vue:335`, `src/components/parceiro/panels/PortalCarteiraVisaoPanel.vue:494`).
- Conferido: 1440 claro e escuro (faixa no escuro: fundo `rgba(132,165,157,.12)` sobre o marrom, texto `#A9C6BE`), wizard do Rafael, Carteira.

### P-12 · Faixa dizia que tudo está bloqueado, mas Vincular código funciona · Confunde
- Tela: faixa "Cadastro em análise"  ·  Largura/tema: todas
- O que acontece: "Ações do portal ficam bloqueadas até o credenciamento ser aprovado." Em Acessos, "Vincular código" funciona e guarda o código até a aprovação.
- Correção: "Até a aprovação, o código de indicação, a carteira e os novos acessos ficam em espera." nos 6 idiomas (`frame.operability.pending.body`).
- Conferido: 1440, Início e Divulgação.

### P-13 · Divulgação: aviso da API sem acento e título que mandava pedir de novo · Confunde
- Tela: `/parceiro/divulgacao`  ·  Largura/tema: todas
- O que acontece: "Programa afiliado necessário" e, embaixo, o `aviso` cru da API: "Seu cadastro esta em analise. O codigo, o link e o QR de indicacao ficam disponiveis apos a aprovacao." (sem acento, só em português), seguido da frase do portal dizendo o mesmo.
- Correção: título "Programa de Afiliados em análise" quando o cadastro ou o pedido está em análise; o `aviso` da API não entra (fica a frase traduzida) (`src/components/parceiro/panels/PortalDivulgacaoPanel.vue:77`).
- Conferido: 1440, em análise.

### P-14 · Carteira sem título e com "Solicitar programa afiliado" para quem já pediu · Confunde
- Tela: `/parceiro/carteira`  ·  Largura/tema: todas
- O que acontece: a faixa ficava sem título (a Carteira só entra no menu com o programa ativo, e o título vem do menu); a folha dizia "Programa afiliado necessário / Solicitar programa afiliado" com o pedido já em análise.
- Correção: título "Ganhos de indicação" (o do menu); em análise, "Programa de Afiliados em análise / A carteira, o extrato e os saques abrem assim que a equipe PetJourney aprovar o programa." com "Ver programas"; `text-wrap: pretty` para não deixar "e-" sozinho na linha (`src/pages/(accounts)/parceiro/carteira/index.vue:69`, `:122`).
- Conferido: 1440 claro.

### P-15 · Login: erro longe do formulário, em linguagem de sistema · Incomoda
- Tela: `/auth/login`  ·  Largura/tema: todas
- O que acontece: senha errada (ou e-mail que não existe) mostrava só um toast no canto, "Erro ao entrar / Credenciais inválidas", e o foco ia para o X do toast.
- Correção: no 401, "E-mail ou senha não conferem. Confira e tente de novo." embaixo da senha, foco de volta nela com o texto selecionado; o erro some ao digitar (`src/pages/(shared)/auth/login.vue:34`). Erros de rede continuam no toast.
- Conferido: 1440 claro, senha errada e depois a certa.

### P-16 · Gênero na entrada, no menu e no convite · Incomoda
- Tela: login, cadastro, diálogo "Em breve", Perfil, sair da conta, convite  ·  Largura/tema: todas
- O que acontece: "Bem-vindo de volta", "Bem-vindo! Agora cadastre sua empresa para começar.", "Bem-vindo de volta ao painel.", "Animado! Voltar ao painel", "Dono do parceiro" (selo do Perfil da Helena), "Você será desconectado deste painel.", "Você foi convidado para integrar a equipe…".
- Correção: "Olá de novo", "Agora cadastre sua empresa para começar.", "Tudo certo: o painel está liberado de novo.", "Entendi, voltar ao painel", "Titular da empresa" / "Equipe da empresa", "Este computador sai da sua conta. Para voltar, é só entrar de novo com e-mail e senha.", "Você recebeu um convite…"; o mesmo em espanhol; inglês com "Got it" e "Business owner".
- Conferido: 1440, login, toast do cadastro do Rafael, Perfil.

### P-17 · Cadastro, passo 2: título e passo com nomes diferentes; link "detalhes" solto · Polimento
- Tela: `/auth/register`  ·  Largura/tema: todas
- O que acontece: o passo se chamava "Conta" e o título "Segurança da conta"; o termo terminava com "… da PetJourney. detalhes", com o link no "detalhes".
- Correção: passo "Senha" e título "Escolha uma senha" (chaves que já existiam traduzidas); o link é o próprio nome: "Li e aceito os **termos de uso e a política de privacidade** da PetJourney." (`src/pages/(shared)/auth/register.vue:29`, `I18nT` com `{termos}` nos 6 idiomas).
- Conferido: 1440 claro e escuro, passo 2 (conta do Rafael).

### P-18 · Barra de rolagem do sistema e balão do navegador na entrada · Polimento
- Tela: `/auth/register` (passo 2) e `/auth/forgot-password`, 1440x900  ·  Largura/tema: claro e escuro
- O que acontece: o passo 2 passa 19 px da altura e a barra cinza do Windows, com setas, aparecia colada na arte verde; com campo vazio, o balão do navegador "Preencha este campo." cobria a lista de requisitos da senha (e sai no idioma do navegador, não no do portal).
- Correção: na entrada a barra some e a rolagem continua (`src/components/auth/AuthLayout.vue:445`); cadastro e recuperação com `novalidate`, ficando só a conferência da tela, embaixo de cada campo (`src/pages/(shared)/auth/register.vue:259`, `forgot-password.vue:287` e `:311`).
- Conferido: 1440x900, `clientWidth` 1440 (antes 1430); "Informe pelo menos 3 caracteres." e "E-mail é obrigatório." embaixo dos campos.

### P-19 · Perfil: erro não saía ao corrigir; caixa vizinha descia · Polimento
- Tela: `/settings?aba=perfil`  ·  Largura/tema: 1440
- O que acontece: depois de "Salvar perfil" com erro, a mensagem ficava vermelha com o campo já corrigido; com erro no Telefone, a caixa do WhatsApp descia 12 px.
- Correção: o erro sai ao mexer no campo (`src/components/settings/SettingsPerfilPanel.vue:188`); a grade alinha pelo topo (`src/components/settings/configuracoes.css:99`).
- Conferido: 1440.

### P-20 · "Trocar de empresa" com uma empresa só · Polimento
- Tela: `/parceiro/selecionar` (menu da conta e aba Conta)  ·  Largura/tema: todas
- O que acontece: "Sua conta participa de mais de uma empresa parceira." com uma empresa só; o nome cortado em "Aurora Clínica e Hotel Veter…" com espaço sobrando.
- Correção: com uma empresa, "Esta é a empresa que a sua conta opera. Se você entrar na equipe de outra, ela aparece aqui para escolher."; o nome quebra em vez de cortar (`src/pages/(accounts)/parceiro/selecionar.vue:126`, chave `parceiro.selecionar.bodyUma`).
- Conferido: pelo código; a tela não foi reaberta depois da correção.

### P-21 · A aprovação não aparece para quem está com o portal aberto · Confunde
- Tela: casca, Início, Divulgação  ·  Largura/tema: todas
- O que acontece: a aprovação no CMS não chega ao portal aberto: menu, faixa "Cadastro em análise" e Início só mudam ao recarregar, e nada diz "você foi aprovada". Ao recarregar, a Carteira ("Ganhos de indicação") aparece no menu e a faixa some, sem nenhuma explicação.
- Por que pesa para quem usa: a dona fica esperando a aprovação com a tela aberta e não fica sabendo.
- Correção: com cadastro ou programa em análise, voltar para a aba relê o status (no máximo a cada 30 s, `useRevalidarAoVoltar`); quando o credenciamento passa de PENDENTE para APROVADO (comparado com o último estado visto, por empresa), um aviso só: "Cadastro aprovado / Sua empresa foi credenciada. Os programas aprovados já estão liberados no portal."; o cartão do código no Início carrega sozinho quando o Afiliados vira ativo (`src/components/layout/AppShell.vue:199`, `src/stores/parceiro.ts:88`, `src/components/home/HomeIndique.vue:224`). Teste novo no spec da store.
- Conferido: spec (aviso uma vez só). Não deu para ver no navegador: a aprovação aconteceu antes desta correção existir.

### P-22 · Chave PIX aceita qualquer texto · Confunde
- Tela: `/parceiro/carteira`, diálogo "Chave PIX"  ·  Largura/tema: todas
- O que acontece: "abc" foi aceito pelo portal e pela API (`PATCH /parceiro/portal/carteira/pix` → 200, "Chave PIX salva"); a carteira passou a mostrar "abc" como chave.
- Por que pesa para quem usa: o erro só apareceria no dia do saque, com o pagamento sem destino.
- Correção: a carteira confere o formato antes de salvar (CPF, CNPJ, e-mail, telefone com DDD, chave aleatória) e diz "Esta não parece uma chave PIX. Use CPF, CNPJ, e-mail, celular com DDD ou a chave aleatória do banco." embaixo do campo (`src/utils/validation/pix.ts`, `src/components/parceiro/panels/PortalCarteiraVisaoPanel.vue:230`, chave `carteira.visao.pix.invalida` nos 6 idiomas). Testes em `src/utils/validation/__tests__/pix.spec.ts`.
- Conferido: 1440 escuro: "abc" recusado; a chave foi corrigida para o CNPJ da empresa.

### P-23 · Árabe: "R$" virava "$R" na Carteira · Confunde
- Tela: `/parceiro/carteira`, Programas, Início  ·  Largura/tema: `ar`
- O que acontece: os valores apareciam "$R 0.00" (o "R$" partido pela direção da linha).
- Correção: em idioma da direita para a esquerda o valor sai isolado da linha (LRI … PDI), "0.00 R$" (`src/utils/format/money.ts:28`). Teste novo em `money.spec.ts`.
- Conferido: 1440 escuro em árabe, Carteira.

### P-24 · Árabe: nome da empresa cortado pelo começo no topo da barra · Polimento
- Tela: casca  ·  Largura/tema: `ar`
- O que acontece: "…otel Veterinário" em vez de "Aurora Clínica e…".
- Correção: `dir="auto"` no nome (`src/components/layout/AppShell.vue:352`).
- Conferido: 1440 escuro em árabe.

### P-25 · Convite de equipe: tela com jargão de desenvolvedor · Confunde
- Tela: `/parceiro/convite`  ·  Largura/tema: todas
- O que acontece: campo "ID do parceiro", exemplo "cuid-da-empresa" e dica "Obrigatório. Vem no link como ?parceiroId=..."; texto "Você foi convidado…"; a tela não diz de que empresa é o convite.
- Correção: "Código da empresa", "Código que vem no link do convite", "O link do convite que chegou por e-mail já preenche este campo." e "Você recebeu um convite para entrar na equipe de uma empresa parceira PetJourney. Abra o link do convite que chegou por e-mail para aceitar." nos 6 idiomas. Mostrar o nome da empresa depende da API (ver Fora do portal).
- Conferido: 1440 escuro, como Helena e como Rafael.

### P-26 · Convite de equipe novo não tem como ser aceito pelo portal · Bloqueia (quando a Equipe for ligada)
- Tela: `/parceiro/convite?parceiroId=…` (conta do Rafael)  ·  Largura/tema: todas
- O que acontece: "Aceitar convite" responde "Não foi possível aceitar / Para aceitar este convite, abra o link que enviamos para o seu e-mail." (`PATCH /parceiro/portal/equipe/convites/aceitar?parceiroId=…` → 403 `CONVITE_EXIGE_LINK`). A API nova só aceita o convite com o token do e-mail (`POST /parceiro/portal/equipe/convites/aceitar-por-link {token}`), e o e-mail leva para `/parceiro/convite?token=…`; a tela do portal não lê `token`, só `parceiroId`.
- Por que pesa para quem usa: quem clicar no link do e-mail cai numa tela que pede um código e não consegue entrar na equipe.
- Não corrigido: é integração nova (rota `aceitar-por-link`, `meus-convites`, recusar), sem card nem guia de front; registrado para virar tarefa. Hoje a Equipe está oculta (`EQUIPE_MENU_ENABLED = false`, `/parceiro/equipe` redireciona para o Início), então nenhum dono consegue convidar pelo portal.
- Conferido: 1440, conta do Rafael, convite criado pela API (ver Dados criados).

### P-27 · Menu da conta e gaveta com rótulos errados · Polimento
- Tela: casca  ·  Largura/tema: todas; gaveta no tablet
- O que acontece: "Logout" em inglês no menu da conta (o resto diz "Sair da conta"); no tablet, o botão da gaveta se chama "Abrir navegador" / "Fechar navegador" (navegador = browser) para o leitor de tela; o passo 3 do cadastro diz "Complete os dados e solicite os programas.", mas os programas já vão no envio.
- Correção: "Sair da conta", "Abrir menu" / "Fechar menu" (pt, en, en-GB, es), "Os programas aprovados aparecem no portal." (6 idiomas).
- Conferido: 768x1024 com toque (gaveta), 1440 (menu da conta).

### P-28 · Tablet em pé: sombra da gaveta fechada vazava na borda e a gaveta levava 320 ms · Polimento
- Tela: casca a 768x1024  ·  Largura/tema: claro
- O que acontece: com a gaveta fechada (12 px fora da tela), a sombra larga dela pintava uma faixa cinza na borda esquerda da página; abrir e fechar levava 320 ms.
- Correção: sombra só com a gaveta aberta; transição de 200 ms (Regra 4) (`src/components/layout/AppShell.vue:950`, `:972`).
- Conferido: 768x1024 com toque, aberta e fechada (`box-shadow: none` fechada).

### P-29 · Divulgação: frase do topo errada durante a carga · Polimento
- Tela: `/parceiro/divulgacao`  ·  Largura/tema: todas
- O que acontece: com o programa ativo, a faixa mostrava "O código aparece quando o programa de afiliados estiver ativo" enquanto carregava, e depois trocava.
- Correção: sem frase até o painel carregar (`src/pages/(accounts)/parceiro/divulgacao.vue:36`, `PortalDivulgacaoPanel.vue:330`).
- Conferido: pelo código; a página foi recarregada logo depois.

### P-30 · Conta sem empresa: cartão do código parado no esqueleto · Incomoda
- Tela: `/inicio` (Rafael, sem empresa)  ·  Largura/tema: 1440 escuro
- O que acontece: o cartão "Indique e ganhe" ficava como esqueleto cinza em cima da faixa, para sempre (o contexto responde 403).
- Correção: sem acesso a empresa, o cartão não aparece (`src/components/home/HomeIndique.vue:88`).
- Conferido: 1440 escuro, conta do Rafael.

### P-31 · Programas: o Participativo é descrito de dois jeitos · Confunde
- Tela: cadastro da empresa (aba Programas) e `/parceiro/programas`  ·  Largura/tema: todas
- O que acontece: no cadastro, "Sua empresa aparece na rede credenciada PetJourney e oferece vantagens… Cupons e vantagens para atrair novos clientes"; em Programas, "Participe da produção de conteúdo da PetJourney… Selo de parceiro participativo… Presença nas redes sociais".
- Não corrigido: qual das duas é a verdade é decisão de produto (ver Propostas).

### P-32 · Pequenos atritos anotados, não corrigidos · Polimento
- "Ganhos de indicação" (pt) e "Ganancias por referidos" (es) cortados no menu a 1440 ("Ganhos de indica…").
- Recuperação de senha: placeholder "seuemail@clinica.com" (no login, "seuemail@empresa.com"); não há "reenviar código" no diálogo do PIN (é preciso fechar e enviar de novo).
- Login continua com o balão do navegador para campo vazio (não há conferência própria; não mexi para não mudar o envio).
- Acesso da Paçoca: a categoria Peso foi compartilhada e não aparece em "Dados clínicos" (Alergias, Vacinas e Comportamento aparecem com "não registrou"); o exemplo do campo "Serviço realizado" é "Banho e tosa" num acesso de Consulta.
- Menu: com a Carteira liberada, "Ganhos de indicação" só entra no menu depois do status carregar (o menu cresce diante de quem olha).
- Diálogo da chave PIX abre no meio da tela (a casa pede formulário em gaveta à direita).
- "Baixar QR" abre o seletor de arquivos do sistema (`showSaveFilePicker`); não deu para conferir o arquivo aqui.
- Aba Conta: o selo do papel ainda diz "Dono" para a Helena (outra chave, `settings…dono`); no Perfil já ficou "Titular da empresa".
- Programas: o texto fixo "O dono pede a ativação do programa." e "Somente o dono da conta pode solicitar…" aparece também para a própria dona.

## Compartilhado (para a casca/base)

Sou a dona da casca; o que mudei nela, para as outras frentes saberem:
- `src/App.vue`: faixa "Carregando" no lugar da área branca na primeira carga; ouvinte de sessão expirada que leva ao login com aviso.
- `src/components/layout/AppShell.vue`: nome da empresa com `dir="auto"`; relê o status ao voltar para a aba quando há algo em análise e avisa a aprovação; gaveta do tablet com sombra só aberta e 200 ms.
- `src/components/auth/AuthLayout.vue`: sem barra de rolagem do sistema na entrada (a rolagem continua).
- `src/components/settings/configuracoes.css`: `.cfg-grade` alinha pelo topo.
- `src/service/api.ts`: `apiFetch(endpoint, options, { manterSessaoEm401 })` e o evento `EVENTO_SESSAO_EXPIRADA`.
- `src/utils/format/money.ts`: em árabe o valor sai isolado (LRI…PDI). Só telas do Portal usam a função.
- `src/stores/parceiro.ts`: `bootstrap()` não forçado reaproveita a carga em andamento; nome da empresa e último estado do credenciamento guardados no navegador.
- Durante a validação o `check:i18n` ficou vermelho por alguns minutos com `clinico.agenda.bloqueio.afetados` (2 formas de plural em sr/ar); outra frente corrigiu em seguida.

## Fora do portal (API, CMS, app)

- **API aceita qualquer chave PIX**: `PATCH /parceiro/portal/carteira/pix?parceiroId=cmvrdj8s3000i19mq28u7kjnp` com chave `"abc"` → 200. O portal agora confere o formato, mas a API deveria recusar (400) para não depender da tela.
- **Senha atual errada responde 401**: `POST /auth/reset-password-authenticated` `{"oldPassword":"…","newPassword":"…"}` → 401 "A senha antiga está incorreta". 401 é o código de "sessão inválida"; para senha errada, 400/422 com `reason` evitaria que qualquer cliente derrube a sessão (o portal agora trata).
- **Aviso da indicação sem acento e só em português**: `GET /parceiro/portal/indicacao` → `"aviso":"Seu cadastro esta em analise. O codigo, o link e o QR de indicacao ficam disponiveis apos a aprovacao."` mesmo com `Accept-Language`.
- **Convite de equipe**: o fluxo novo exige o token do e-mail (`CONVITE_EXIGE_LINK`), e o portal ainda usa a rota antiga; falta a tela que lê `?token=` e chama `aceitar-por-link` (ver P-26). Sugestão: a API devolver o nome da empresa do convite (pelo token) para a tela dizer "A Aurora Clínica… convidou você".
- **`POST /pet` devolve 500**: corpo `{"nome":"Paçoca","especiePet":"CACHORRO","tutorId":"cmvrf6h9o001g19mq56ooikx5","sexo":"FEMEA","dataNascimento":"2021-03-14","alergias":"Frango","dogInfo":{"raca":"SRD (sem raça definida)","porte":"MEDIO","castrado":true}}` → 500 "Internal server error". Sem `dataNascimento`/`alergias` e com `raca: "SRD"` → 201. Erro de validação deveria ser 400 com o campo.
- **Limite de 60 pedidos por minuto** (`x-ratelimit-limit: 60`) para a mesma conta: com várias pessoas da empresa ou várias abas, fica apertado (o portal já parou de repetir dashboard/status).
- **CMS** (anotado pelo coordenador): (a) "Aprovar" no menu da Auditoria aprova na hora, sem confirmação, e não decide os programas junto: Afiliado e Participativo ficaram em "Solicitações de modos" e precisaram de uma segunda aprovação, enquanto o portal promete "Credenciamento e programas são decididos na mesma revisão. Você não precisa pedir nada de novo."; (b) depois de aprovar, o contador "Aprovados" seguiu em 0; (c) "Solicitações de modos" mostra 0/0/0 e lista vazia durante a carga, sem indicador; (d) texto de desenvolvedor exposto: "Lista montada via GET /parceiro filtrando status SOLICITADO no cliente."; (e) login do CMS diz "Bem-vindo de volta!" e o X do toast se chama "Close".

## Propostas (mudanças maiores, não implementadas)

- **Clínica e Hotel de demonstração numa empresa recém-cadastrada** (achado 11 do coordenador): os dois módulos são de propósito ocultos e mocados; só aparecem para a conta que os liga (`?clinico=on&hotel=on` ou a sequência secreta, guardado com o `userId`), e o único sinal de demonstração é o painel flutuante "Demonstração" (latência, semente, recriar dados). Não há faixa porque o modo existe para apresentação. Proposta: quando o módulo estiver ligado e a empresa não tiver Clínica/Hotel de verdade, um selo discreto "Dados de exemplo" no título do espaço na barra (urgência no ícone, não na superfície), que some quando a conta tiver o módulo real. Decisão de produto: o selo apareceria também nas capturas da apresentação.
- **"Validar cupom · Em breve" fixo no pé do menu** (achado 10): o item abre um diálogo "Cupons chegando com tudo"; ocupa lugar permanente na barra para algo que não existe. Proposta: tirar o item da barra até a função existir e anunciar o lançamento no Início.
- **Programa Participativo**: escolher uma descrição só (rede credenciada e cupons, ou produção de conteúdo e redes sociais) e usar nas duas telas (P-31).
- **Convite de equipe completo** (P-26): tela que lê `?token=`, mostra a empresa, aceita ou recusa; ligar a Equipe quando estiver pronta; no cadastro, um caminho "Recebeu um convite de uma empresa?" para quem entra como veterinário convidado (hoje o Rafael cai direto no "Cadastre sua empresa parceira").
- **Recuperação de senha**: "Reenviar código" e "Trocar e-mail" no diálogo do PIN.
- **Chave PIX em gaveta à direita**, com o tipo de chave escolhido antes (CPF, CNPJ, e-mail, telefone, aleatória) e máscara por tipo.
- **Login com conferência própria** (sem o balão do navegador), como já ficou no cadastro e na recuperação.
- **Faixa de entrada**: o texto branco sobre a sálvia da arte (`#84C1B4`) é limítrofe (documentado no próprio `AuthLayout`); a regra da casa pede tinta escura sobre sálvia.

## Dados criados (para a apresentação)

- Helena Prado (`helena@clinica-aurora.example.com`): telefone e WhatsApp (11) 98765-4321 no Perfil; nome mantido.
- Aurora Clínica e Hotel Veterinário: chave PIX = CNPJ 27.527.903/0001-81 (por alguns minutos a chave foi "abc", no teste do P-22; já corrigida). Código de indicação UBB775 (gerado na aprovação).
- Rafael Moura (`rafael@clinica-aurora.example.com`, senha `Aurora@2026`): conta criada pelo cadastro do portal, sem empresa própria. Convite de equipe da Aurora para ele como OPERADOR, criado pela API (`conviteId cmvrf4b12001d19mq2dgjiu42`, PENDENTE, expira em 11/11/2026); não aceito (P-26).
- Camila Rocha, tutora (`camila.tutora@clinica-aurora.example.com`, senha `Aurora@2026`, telefone 11 99123-4567), criada pela API como o app faria. Pet Paçoca, cachorra SRD, porte médio, castrada (`cmvrf7xa7001q19mq1yx0ig0j`). Compartilhamento de Consulta com a Aurora por 7 dias (alergias, vacinas, peso, comportamento, observações), mensagem "A Paçoca vem para a consulta de rotina na quinta. Ela fica agitada com barulho e não pode comer frango." (código 760039, `cmvrf8888001t19mqbs9xio1y`, expira 03/11 21:13), vinculado pela Helena em Acessos.

## Pendente da aprovação

A aprovação chegou durante a execução; foi feito: Programas ativos, Divulgação (copiar código; link e WhatsApp à vista), Carteira com chave PIX e saldo zero (sem botão de saque, frase "Ainda não há ganhos…"), extrato e saques vazios, Acessos com dado real. Falta:
- Aceite de convite de equipe (bloqueado pelo P-26) e a tela de Equipe (oculta por flag).
- Saque com saldo de verdade (precisa de uma assinatura indicada que gere participação).
- Anotação no acesso da Paçoca (o formulário foi preenchido duas vezes e perdido em recargas do Vite).
- Conferir o arquivo do "Baixar QR" e a impressão.
- Ver o aviso "Cadastro aprovado" no navegador (precisa de uma empresa que passe de PENDENTE para APROVADO depois desta versão).
- Varredura completa em en, en-GB e sr (feitas pt, es e ar) e 1024/768 em todas as telas (feitos Início e gaveta).

## Verificação final (vitest, i18n, eslint/oxlint, type-check: comando e resultado)

- `npx vitest run src/components/home src/components/parceiro "src/pages/(accounts)/parceiro" src/stores/__tests__/parceiro.spec.ts src/service src/utils src/navegacao src/router` → 36 arquivos, 326 testes, todos passando. Testes novos: 3 em `src/service/__tests__/api.spec.ts` (401), 4 em `src/stores/__tests__/parceiro.spec.ts` (carga única, forçado, nome guardado, aviso de aprovação), 2 em `src/utils/validation/__tests__/pix.spec.ts`, 1 em `src/utils/format/__tests__/money.spec.ts`.
- `npm run check:i18n` → "✅ paridade OK". As chaves novas e alteradas foram escritas nos 6 idiomas por troca de linha exata (sem reserializar o JSON), com script em `scratchpad/parceiro/trocar-linhas.mjs`.
- `npx oxlint <29 arquivos tocados>` → sem erros (3 erros de tipo de mock no spec novo, corrigidos). `npx eslint <29 arquivos tocados>` → sem saída.
- `npx prettier --check` nos arquivos tocados acusa 14 arquivos, todos já fora do Prettier antes desta validação (conferido contra o `HEAD`); não formatei para não reescrever trechos de outras frentes.
- `npm run type-check` (uma vez, no fim) → 1 erro, de outra frente: `src/pages/(accounts)/hotel/mapa.vue(124,41): Property '$el' does not exist…`. Nenhum erro nos arquivos desta frente.
- `src/components/layout/moldura-app.css` (casca) foi alterado por outra frente: uma linha, `.shell.shell--moldura-app .barra` → `.shell.shell--moldura-app > .barra`. Conferi: só estreita o seletor ao filho direto, sem efeito nas telas do Portal.
