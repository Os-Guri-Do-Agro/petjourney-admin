# Regras de Negocio: Acesso, Compartilhamento e Parcerias

**Status:** Vigente (reflete o que o backend faz hoje). Onde algo nao esta decidido no codigo, esta marcado como **EM ABERTO** na secao 11.
**Criado em:** 2026-06-29
**Para que serve:** explicar, em portugues claro, COMO tudo funciona e POR QUE, para humano e IA lerem. Cobre nao so as 4 partes do epico, mas tambem a base que elas usam (conta/login, planos/trial, pets). A parte tecnica (rotas, JSON, enums) esta em [frontend.md](frontend.md). As decisoes e o racional historico estao no [epico](../epicos/acesso-compartilhamento-e-parcerias.md) (D1-D16).

> Quer so a parte do **dinheiro** (comissao/carteira/saque)? Va direto na **secao 9**. Foi escrita do zero, com exemplo de numeros.

---

## 0. Mapa rapido

| Secao | Assunto |
|---|---|
| 1 | Conta, perfis, cadastro, login, papeis (a base de identidade) |
| 2 | Planos, trial, ativacao, niveis e o que cada plano libera |
| 3 | Pets (o que e, criacao, pet orfao, prontuario) |
| 4 | As 3 frentes em uma frase |
| 5 | Parte 1: compartilhamento com prestador |
| 6 | Parte 2: plano familia |
| 7 | Parte 3: parceiro (identidade, login, cadastro, equipe, auditoria) |
| 8 | Cupom (e por que cupom nao e comissao) |
| 9 | Parte 4: comissao e carteira (a bufunfa) |
| 10 | Tabela de limites e parametros |
| 11 | Perguntas em aberto (o que ainda NAO foi decidido) |
| 12 | Glossario |

---

## 1. Conta, perfis, cadastro e login

### 1.1 Uma conta, varios perfis
- Existe um unico tipo de conta: o **Usuario** (email + senha). Tudo gira em torno dele.
- Um mesmo Usuario pode **acumular perfis**: ser **tutor**, ser **veterinario**, e ser **membro de um parceiro** (operador/dono), ao mesmo tempo. Nao sao contas separadas, sao papeis pendurados na mesma conta.
- O sistema **descobre quem voce e** pelo login. O app nunca manda "sou o tutor X"; o servidor resolve isso pelo token.

### 1.2 Cadastro (signup) - `POST /usuario`
Campos:
- **Obrigatorios:** email (valido, unico), nome (min 3), senha (forte, min 6).
- **Opcionais:** CPF (desde 28/05/2026 deixou de ser obrigatorio), telefones (comum, WhatsApp, outro), "como nos conheceu", **codigo de indicacao** (max 20, normalizado para maiusculas), e os blocos aninhados de perfil (tutor, veterinario) e enderecos.

O que acontece quando alguem se cadastra como tutor:
1. Cria o Usuario (senha com hash bcrypt; email normalizado; CPF/telefone sem mascara).
2. Cria o perfil de **tutor**.
3. **Da o trial automaticamente:** uma assinatura Freemium de **3 meses** (ver secao 2).
4. **Vincula pets orfaos por CPF:** se a pessoa informou CPF, todos os pets cadastrados por clinicas com aquele CPF e ainda sem dono passam a ser dela (ver 3.3). **Sem CPF, isso nao acontece** (fica para o onboarding pedir o CPF depois).
5. Se veio com **codigo de indicacao** de um parceiro aprovado, marca a atribuicao (ver secao 9). Codigo errado **nao quebra** o cadastro.
6. Retorna o token de acesso ja logado.

### 1.3 Login - `POST /auth/login`
- Entra com **email OU CPF** + senha (qualquer um dos dois identifica a conta).
- Devolve **access token** (curto) + **refresh token** (longo, 30 dias). O refresh renova o access sem precisar logar de novo, e gira (cada uso revoga o anterior). Tem `POST /auth/refresh` e `POST /auth/logout`.
- **Conta banida:** se um admin marca a conta como inativa, o login e bloqueado (a conta nao entra mais).
- **Tutor inativo:** se o perfil de tutor foi inativado (mas a conta nao), o login funciona e a resposta avisa que o tutor esta inativo (com motivo), para o app tratar.
- **Esqueci a senha:** fluxo em 3 passos, por PIN de 6 digitos enviado por email/telefone (pedir PIN, validar PIN, trocar a senha). Tem limite de tentativas e resposta neutra (nao revela se o email existe).
- **Biometria:** e **do lado do app** (desbloqueio local do aparelho). O backend nao faz biometria: continua sendo email/senha + token.

### 1.4 Papeis (quem pode o que)
Os papeis **nao sao guardados** numa coluna; sao **deduzidos** a cada requisicao:
- **TUTOR:** tem perfil de tutor ativo.
- **VETERINARIO:** tem perfil de veterinario.
- **PARCEIRO:** e membro aceito e ativo de algum parceiro (ver secao 7).
- **ADMIN do sistema:** tem a marca `isSystemAdmin`. Vira admin **na mao** (direto no banco); nao ha tela nem rota para promover. Admin **nao e super-heroi automatico**: uma rota so libera admin se ela explicitamente listar admin junto.

---

## 2. Planos, trial e ativacao

### 2.1 Os planos (e o nivel de cada um)
Existem 4 planos, cada um com um **nivel** numerico que serve para comparar (quanto maior, mais libera):

| Plano | Nivel | Preco mensal | Observacao |
|---|---|---|---|
| Basico | 1 | R$ 0 | gratuito, **nao expira** (vitalicio) |
| Pro | 2 | R$ 24,90 | |
| Premium | 3 | R$ 39,90 | unico que libera Familia |
| Freemium | 4 | R$ 0 | e o **trial** (acesso total por 3 meses) |

Detalhe importante: o **Freemium (trial) tem o nivel mais alto (4)** de proposito, para a pessoa **experimentar tudo** durante o teste. Quando o trial acaba, ela **cai para o Basico (nivel 1)**.

### 2.2 Trial
- Todo tutor novo ganha **3 meses** de Freemium no cadastro.
- Quando vence: a assinatura Freemium expira e o sistema cria automaticamente uma de **Basico** (vitalicia). Isso acontece por um processo diario (de madrugada) e tambem na hora em que o app le os dados (o que vier primeiro).
- Nao existe "X dias de trial" como numero solto: o trial e a assinatura Freemium com data de fim em 3 meses.

### 2.3 Ativacao (quem liga e desliga a assinatura paga)
- As assinaturas pagas (Pro/Premium, mensal ou anual) sao compradas **na loja** (App Store / Google Play), via RevenueCat.
- O nosso backend **so reage**: a loja avisa por webhook (compra, renovacao, troca de plano, cancelamento, expiracao, problema de cobranca) e o backend atualiza a assinatura.
- **O backend nunca cancela nem pausa a assinatura de loja de ninguem.** Quem cancela e o proprio usuario, pela loja. Por isso, em casos de familia, o sistema resolve "qual o melhor nivel" sem mexer na cobranca (ver 6.3).
- Cancelar **nao corta na hora**: a pessoa mantem o acesso ate o fim do periodo ja pago; depois cai.
- **Evento repetido nao conta duas vezes:** o processamento do webhook e idempotente (a loja pode reenviar o mesmo evento; o backend reconhece e nao duplica assinatura nem comissao).

### 2.4 Nivel efetivo (o que vale na pratica)
- O nivel que conta para liberar features e o **maior** entre: o da **assinatura propria** e o **herdado de familia** (um convidado de familia Premium herda Pro). Sem assinatura nenhuma, o nivel e 0 (so o publico).
- Se der qualquer erro ao calcular a familia, o sistema cai com seguranca para o nivel proprio (nunca derruba para 0 por bug).

### 2.5 O que cada plano libera (gating)
O nivel trava (ou libera) recursos:
- **Cupons:** cada cupom pode exigir um nivel minimo; quem esta abaixo nao ve.
- **eBooks:** cada ebook pertence a um plano; alem disso pode ser **bloqueado para quem esta no trial**.
- **Diario do pet:** **escrever** exige Premium (nivel 3+). Ler e livre.
- **Familia:** **so Premium** pode ser lider (ver 6.1). Mesmo o trial (Freemium) **nao** pode liderar familia, porque o trial expira e derrubaria a familia.
- **Limite de pets por plano:** existe um campo para isso, mas **hoje NAO e aplicado** (ninguem e barrado por excesso de pets). Os limites que valem de verdade hoje sao os **da familia** (ver 6.2).

### 2.6 O que cada plano promete (resumo dos beneficios)
- **Basico:** 1 pet, carteirinha digital basica, guardar vacinas/documentos, lembretes simples, 1 ebook de boas-vindas.
- **Pro:** tudo do Basico + ate 3 pets, lembretes avancados, melhor organizacao de documentos, IA de recomendacao, cupons e beneficios, novos ebooks.
- **Premium:** multiplos pets, compartilhamento com veterinario, compartilhamento com cuidadores parceiros, cupons exclusivos, IA, diario do pet, controle de cio, conteudo personalizado, e **gestao da familia (ate 5 pessoas)**.

> Nota: o Premium **ja vende** "compartilhamento" e "familia ate 5 pessoas". E exatamente isso que as Partes 1 e 2 deste epico entregam.

---

## 3. Pets

### 3.1 O que e um pet
- Campos principais: nome, foto, **especie**, data de nascimento, sexo, **ativo**, e o **dono** (`tutorId`).
- Especies: cachorro, gato, ave, roedor, coelho, peixe, reptil.
- Cada especie tem um bloco de infos proprio. O campo **castrado** existe **so para cachorro, gato e coelho** (nas outras especies nao tem).
- Cada pet tem uma **carteirinha publica** acessivel por um link/QR com um codigo opaco (slug), sem precisar de login.

### 3.2 Como o pet pertence ao tutor
- Modelo **1-para-N**: um tutor tem varios pets; cada pet tem um dono. O acesso e checado pela cadeia pet -> tutor -> conta.
- O antigo campo de "vet responsavel do pet" **foi removido**. Hoje o vinculo e so com o tutor (dono). "Vet do pet" via N-N fica para o futuro.

### 3.3 Pet orfao (cadastrado por clinica) e vinculo por CPF
- Um pet pode nascer **sem dono** (`tutorId` vazio), com os dados do responsavel (nome, **CPF**, email, telefone) preenchidos a parte. E o caso de clinicas que cadastram o paciente antes de o tutor ter conta.
- Quando o tutor se cadastra **informando o CPF**, os pets orfaos com aquele CPF passam a ser dele automaticamente. Sem CPF, nao vincula.

### 3.4 Criar / remover
- Criar pet: rota autenticada; valida o bloco da especie (ex: cachorro exige info de cachorro).
- Remover pet e **definitivo** (apaga de verdade). "Inativar" (campo ativo) e diferente de apagar. A **inativacao do tutor** (conta) e outra coisa, ligada a LGPD (prazo de exclusao), e nao mexe no pet.

### 3.5 Prontuario do pet
O pet tem um prontuario modular: **vacinas, consultas, medicamentos, peso, diario, documentos, diagnosticos, alergias, tratamentos fixos, lembretes** (e internacao como caso especial). E esse prontuario que aparece (filtrado) no compartilhamento com prestador, e que a familia pode ler.

---

## 4. As tres frentes em uma frase

1. **Compartilhamento com prestador** (Parte 1): o tutor da um "cartao temporario" do pet a um prestador (banho, tosa, consulta, exame, hotel). O prestador abre por um link com codigo e ve so o que o tutor escolheu. Acaba sozinho no prazo.
2. **Plano Familia** (Parte 2): o dono Premium divide o plano com ate 4 pessoas. Os convidados acessam os pets e herdam o Pro enquanto sao membros.
3. **Parceiro e comissao** (Partes 3 e 4): empresas parceiras ganham login e um codigo de indicacao. Quem elas indicam e vira assinante pagante gera **comissao** (dinheiro) numa carteira sacavel por PIX.

As tres sao independentes: prestador e uma "foto congelada" temporaria; familia e vinculo vivo; parceiro e identidade comercial.

---

## 5. Parte 1: Compartilhamento com Prestador

- **Quem pode:** qualquer tutor (nao precisa ser Premium). Membros da familia tambem podem, para os proprios pets.
- **O tutor escolhe o que mostrar:** marca categorias (alergias, vacinas, medicamentos, peso, comportamento, diagnosticos, observacoes). O prestador so ve o que foi marcado; o resto **nem sai do servidor**.
- **Foto congelada:** o prestador ve um retrato do pet **do momento da criacao**. Mudar uma vacina depois nao altera um acesso ja entregue.
- **Identidade sempre aparece:** nome, especie, foto e castrado (e o "cabecalho" de quem e o pet), mesmo sem nenhuma categoria marcada.
- **Prazo:** 24h, 48h, 72h ou 7 dias. Vencido, o link morre sozinho. Da para cancelar antes (revogar). O historico fica salvo para o tutor.
- **Retorno do prestador:** ele escreve anotacoes (varias durante a estadia) e anexa ate 3 arquivos por anotacao (foto/PDF). O tutor le, marca como lido e pode **salvar os anexos nos documentos do pet** (escolhendo a categoria na hora).
- **Anti-abuso:** ate 10 compartilhamentos ativos por pet, 50 por tutor; o link publico tem limite de tentativas por minuto; codigo invalido/vencido devolve um erro generico (para nao deixar adivinhar codigos).

---

## 6. Parte 2: Plano Familia

### 6.1 Quem e quem
- **Lider:** precisa ser **Premium**. So Premium lidera (o Freemium expira e derrubaria a familia).
- **Convidado:** entra a convite; pode ser Freemium ou pagante.

### 6.2 Membros, pets e limites
- Ate **5 pessoas** no total (lider + 4).
- O lider coloca ate **5 pets**; cada convidado, ate **2 pets**. (O rascunho antigo dizia 3; o valor real e 2.)
- **Solicitacao pendente ja ocupa vaga** do convidado.
- O lider adiciona pet **direto**. O convidado **pede**, e o lider aprova ou recusa.
- Remover pet ou membro **nao apaga** o pet nem a conta; so tira do plano.
- **Uma familia ativa por pessoa.**

### 6.3 Convite, heranca e carencia
- **Convite por codigo** (o lider digita o codigo do convidado) **e por link** (o convidado abre o link do lider). O link do lider e reutilizavel; o codigo do convidado e de uso unico.
- **Heranca:** enquanto membro de uma familia ativa de lider Premium, o convidado **herda o Pro** (sem pagar a mais). Nunca herda Premium. Se ja paga algo melhor, fica com o melhor (o sistema nunca cancela a assinatura de loja dele).
- **Carencia:** se o lider perde o Premium, a familia fica **suspensa por 7 dias**; nesse tempo o convidado ainda mantem o Pro herdado. Passada a carencia sem o lider voltar, os convidados voltam ao plano proprio. Nada e apagado.

### 6.4 Quem ve e quem mexe
- **Todos os membros leem todos os pets do plano** (so leitura). **Mexer** continua so do dono.
- A leitura do **prontuario completo** dos pets da familia esta atras de uma chave que hoje fica **desligada** em producao (ate as telas serem validadas). Enquanto desligada, o membro nao-dono nao abre o prontuario dos pets dos outros.
- **Delegacao temporaria** ("deixei o Rex com minha irma essa semana"): o **dono** do pet da acesso de **escrita so para adicionar** (diario, medicamento, vacina, peso, documento) a outro membro, por 1, 3, 7 ou 14 dias, ou ate revogar. Nao deixa editar/apagar registro antigo nem mexer no pet/familia.

---

## 7. Parte 3: Parceiro (identidade, login, cadastro, equipe, auditoria)

### 7.1 O que e o parceiro
- O **parceiro** e a empresa comercial (petshop, clinica, farmacia, banho e tosa, nutricao, vet autonomo). Antes era so um nome no admin; agora tem **identidade e login**.
- A categoria (petshop, veterinario, etc) hoje fica **no cupom**, nao no parceiro (um parceiro pode ter cupons de categorias diferentes).

### 7.2 Como o parceiro e criado hoje (atencao: isto e o que esta no codigo)
- O parceiro (a empresa) e criado **por um admin** (no CMS) ou pela carga inicial (seed). Quando o admin cria, ele **ja nasce aprovado** e ja recebe o **codigo de indicacao**.
- **Nao existe auto-cadastro de parceiro** (a empresa nao se cadastra sozinha por um formulario publico). Isso e uma **decisao em aberto** (ver secao 11), nao um recurso pronto.
- Ao criar, o admin pode ja apontar quem e o **dono** (vincula a conta da pessoa como DONO aceito).

### 7.3 Como o parceiro faz login
- **Nao tem login separado.** O parceiro entra com a **conta normal de Usuario** (email/senha).
- A pessoa "vira parceiro" porque tem um **vinculo de equipe aceito e ativo** com aquela empresa. O sistema descobre isso na hora (consultando os vinculos), nao pelo token.

### 7.4 Equipe (dono e operador)
- Cada membro tem papel **DONO** ou **OPERADOR**. So o **DONO** gere a equipe, define a chave PIX e pede saque; o OPERADOR ve as informacoes.
- **Convite de membro:** o dono convida por email; a pessoa **aceita** (e ai o vinculo fica ativo). Membro removido pode ser reconvidado.
- **Regra dura:** todo parceiro aprovado tem que ter **pelo menos 1 dono**. Nao da para remover o ultimo dono.
- **Multi-parceiro:** uma mesma pessoa pode ser membro de **varias** empresas; quando isso acontece, ela precisa dizer **qual parceiro** esta operando (as telas mandam o id do parceiro).

### 7.5 Auditoria (credenciamento)
- Status possiveis: **pendente, aprovado, rejeitado, suspenso**. So **aprovado e ativo** pode operar de verdade (cupons aparecem para o tutor, comissao conta).
- Quem aprova/rejeita/suspende e um **admin**. Rejeicao e suspensao guardam o **motivo** (mostrado ao parceiro). Para aprovar, o parceiro precisa ter pelo menos 1 dono.
- Como o admin cria ja aprovado (7.2), o status "pendente" so existiria num futuro fluxo de auto-cadastro.

### 7.6 O parceiro acessa o app do tutor ou um portal proprio?
- As telas do parceiro batem em rotas que vivem **na mesma API** (prefixo do portal do parceiro). Tecnicamente, **quem consome** essas rotas (o proprio app do tutor para quem tambem e operador, ou um **front web separado** para parceiros) **ainda nao esta decidido**. Esta marcado como **EM ABERTO** na secao 11. O codigo permite os dois; falta a decisao de produto.

---

## 8. Cupom (e por que cupom nao e comissao)

- O parceiro pode ter **cupons de desconto**. O tutor resgata o cupom no app e usa o desconto **na loja fisica** do parceiro.
- **Cupom e so desconto.** Ele **nao gera dinheiro nenhum** para o parceiro no nosso sistema. O resgate fica registrado e atribuido ao parceiro (ele ve quantos resgataram), mas **sem comissao**.
- A bufunfa (comissao) vem de **outro lugar**: a indicacao de assinatura (secao 9). **Nao confunda cupom com comissao.**

---

## 9. Parte 4: Comissao e Carteira (a bufunfa, explicada do zero)

### 9.1 De onde vem a comissao
A comissao **nao vem de cupom**. Vem de **indicacao de assinatura**:
1. O parceiro tem um **codigo de indicacao** (com link e QR).
2. Uma pessoa nova baixa o app e **se cadastra usando esse codigo**.
3. A partir dai ela fica **atribuida ao parceiro** (gravado uma vez, para sempre; cada pessoa pertence a no maximo um parceiro).
4. A pessoa usa o trial. **Trial nao paga comissao.**
5. Quando ela **vira assinante pagante**, o parceiro **ganha 5%** do valor da assinatura.

> Resumo: parceiro indica -> pessoa assina e paga -> parceiro ganha 5%.

### 9.2 Quanto e por quanto tempo
- Padrao **5%** (pode ser diferente por parceiro, negociado; o sistema ja entrega a comissao calculada, ninguem na tela precisa calcular).
- Janela de **18 meses** contados do **primeiro pagamento** da pessoa.
- **Mensal:** 5% **a cada mes** que ela renova e paga, durante os 18 meses.
- **Anual:** 5% do valor anual **de uma vez, na hora**. Renovou o ano dentro dos 18 meses, ganha de novo.
- **Upgrade:** se a pessoa sobe de plano (paga mais), a comissao acompanha (5% do novo valor).

#### Exemplo com numeros
Pro mensal custa **R$ 24,90**:
- A pessoa indicada assina Pro e paga o 1o mes. O parceiro ganha **5% de R$ 24,90 = R$ 1,25**.
- Mes que vem ela renova e paga: mais **R$ 1,25**. E assim a cada mes, ate completar 18 meses do 1o pagamento.
- Se fosse Premium (R$ 39,90/mes): **5% = cerca de R$ 2,00 por mes**.
- Se fosse um plano **anual**, o parceiro receberia 5% do valor anual **de uma vez**.

### 9.3 A carteira
- Cada parceiro tem uma **carteira estilo banco**: um **saldo** e um **extrato** (entradas e saidas).
- Entradas e saidas: **credito de comissao** (entra), **saque** (sai), **estorno** (volta quando ha reembolso), **ajuste** (correcao manual do admin).
- **Tudo e em centavos no sistema.** Na tela, divide por 100 (5000 = R$ 50,00).

### 9.4 Saque (tirar o dinheiro)
- Via **PIX**, minimo **R$ 50**, e precisa ter cadastrado a **chave PIX** antes.
- **Carencia de 14 dias por credito (hold):** cada comissao so fica "sacavel" depois de 14 dias (protege contra reembolso logo apos a compra). Por isso a carteira mostra dois numeros: **saldo total** (tudo) e **saldo sacavel** (o que ja passou dos 14 dias).
- **Ciclo:** corte dia **27**, pagamento ate dia **5**. Nesta fase, quem faz o PIX e um **admin na mao** (sem banco automatico): o parceiro pede o saque; o admin marca como pago (com comprovante) ou como falha (e o valor volta para a carteira).

### 9.5 Quando o dinheiro volta (estorno / clawback)
- Se a pessoa **pede reembolso**, a comissao daquele ciclo e **estornada** (sai da carteira do parceiro).
- Se a pessoa so **cancela** (sem reembolso), o que ja foi creditado **fica**; so para a recorrencia futura.
- **Saldo negativo:** se o estorno vem depois do parceiro ja ter sacado, o saldo pode ficar negativo. Isso vira uma **divida abatida das proximas comissoes** (o proximo credito quita). Nao cobramos nem bloqueamos a conta por isso.

### 9.6 Anti-fraude leve ("anti-laranja")
- Parceiro que gera **muitos cadastros indicados em pouco tempo** entra em **revisao**: as comissoes **continuam sendo creditadas** normalmente, mas os **saques ficam segurados** ate um admin olhar. Protege contra inflar comissao com contas falsas.

### 9.7 Onde o app/portal entra
- **No cadastro (app):** campo opcional de **codigo de indicacao** no signup; se a pessoa veio pelo link/QR, e capturado. Codigo errado nao trava o cadastro.
- **No portal do parceiro:** ve carteira (total e sacavel), extrato, cadastra a chave PIX e pede saque. Nao calcula nada: ja vem pronto.
- **No admin (CMS):** aprova parceiros e processa saques (pagar/falhar), faz ajuste e liga/desliga a revisao.

### 9.8 Estado atual (importante)
A maquina de comissao esta **desligada por padrao em producao** (chaves de rollout off) ate validar com caso real. Enquanto desligada, **nenhuma comissao e gerada** e a carteira fica zerada mesmo com indicacoes.

---

## 10. Tabela de limites e parametros

| Tema | Regra / valor | Como muda |
|---|---|---|
| Planos / niveis | Basico 1 (R$0, vitalicio), Pro 2 (R$24,90), Premium 3 (R$39,90), Freemium 4 (trial) | seed |
| Trial | 3 meses, depois cai para Basico | regra |
| Ativacao paga | so via loja (RevenueCat); backend nunca cancela | regra |
| Nivel efetivo | max(proprio, herdado Pro de familia); sem assinatura = 0 | regra |
| Diario do pet | escrever exige Premium (nivel 3+) | regra |
| Familia: lider | so Premium | regra |
| Familia: membros | 5 no total (lider + 4) | por plano |
| Familia: pets do lider | 5 | por plano |
| Familia: pets do convidado | 2 | por plano |
| Familia: carencia | 7 dias | env |
| Familia: validade do convite | 30 dias | env |
| Delegacao: duracoes | 1, 3, 7, 14 dias, ou indefinida | fixo |
| Prestador: duracoes | 24h, 48h, 72h, 168h | fixo |
| Prestador: max ativos | 10 por pet, 50 por tutor | fixo |
| Prestador: anexos por anotacao | 3 | fixo |
| Comissao: percentual | 5% (pode variar por parceiro) | env / por parceiro |
| Comissao: janela | 18 meses desde a 1a paga | regra |
| Carteira: hold por credito | 14 dias | env |
| Saque: minimo | R$ 50 | fixo |
| Saque: ciclo | corte dia 27, pagamento ate dia 5 | regra operacional |
| Limite de pets por plano | campo existe mas **NAO e aplicado** | (gap) |
| Token de acesso (TTL) | hoje 30 dias no codigo; alvo 15 min apos hardening | env |

---

## 11. Perguntas em aberto (o que ainda NAO foi decidido)

Marcado de proposito para nao virar invencao. Sao decisoes de produto pendentes:

1. **Auto-cadastro de parceiro:** hoje so admin (ou seed) cria a empresa parceira. Nao existe formulario publico de "quero ser parceiro". Se vai existir, e como (com auditoria pendente antes de aprovar), esta **em aberto**.
2. **Onde o parceiro opera (app vs web):** as rotas do parceiro vivem na mesma API, mas se o parceiro usa o **app do tutor** (sendo tambem operador) ou um **portal web separado** ainda **nao foi decidido**. O codigo aceita os dois.
3. **Caminho "vet com conta":** o compartilhamento com prestador comeca por link + codigo. Um vet com conta propria que recebe acesso "vivo" e follow-up (sem tela/contrato ainda).
4. **Dominios dos links publicos:** prestador, convite de familia e indicacao usam dominios placeholder (via env). Falta confirmar os dominios reais antes do deploy publico.
5. **Limite de pets por plano:** o campo existe mas nao e aplicado. Se/como ligar (e a partir de qual plano) esta em aberto.
6. **Promocao de admin:** virar admin do sistema e manual (no banco). Nao ha fluxo definido.

---

## 12. Glossario

- **Usuario / conta:** o login unico (email + senha). Carrega os perfis.
- **Perfil:** tutor, veterinario ou membro de parceiro. Uma conta pode ter varios.
- **Nivel:** numero do plano (Basico 1, Pro 2, Premium 3, Freemium/trial 4). Quanto maior, mais libera.
- **Trial:** os 3 meses de Freemium dados no cadastro; depois cai para Basico.
- **Snapshot (foto congelada):** copia dos dados do pet no momento do compartilhamento; nao muda depois.
- **Lider / convidado:** dono da familia (Premium) e quem ele convida (herda Pro).
- **Carencia:** 7 dias de tolerancia antes de rebaixar convidados quando o lider perde o Premium.
- **Delegacao:** dar a outro membro acesso de escrita "so adicionar" de um pet, por um tempo.
- **Parceiro:** empresa comercial parceira, com login (via conta de Usuario) e equipe.
- **DONO / OPERADOR:** papeis dentro do parceiro; so o dono gere equipe/PIX/saque.
- **Auditoria:** credenciamento do parceiro (pendente/aprovado/rejeitado/suspenso).
- **Indicacao:** codigo/link/QR do parceiro que, usado no cadastro, atribui o tutor ao parceiro.
- **Comissao:** 5% do valor da assinatura paga de um indicado. Vem de assinatura, nao de cupom.
- **Carteira / extrato:** saldo do parceiro e a lista de entradas/saidas.
- **Hold:** 14 dias antes de uma comissao virar sacavel.
- **Clawback / estorno:** comissao devolvida quando ha reembolso.
- **Saldo sacavel:** parte do saldo que ja passou do hold e pode ser sacada.
- **Anti-laranja:** trava leve que segura saques de parceiros com indicacoes suspeitas.
- **Cupom:** desconto de loja para o tutor; nao gera comissao.

---

## Change Log

| Data | Versao | Mudanca | Autor |
|---|---|---|---|
| 2026-06-29 | 1.0 | Regras das Partes 1-4 + fundamentos (conta/login, planos/trial, pets), com comissao explicada do zero e perguntas em aberto separadas | Claude + Nicolas |
