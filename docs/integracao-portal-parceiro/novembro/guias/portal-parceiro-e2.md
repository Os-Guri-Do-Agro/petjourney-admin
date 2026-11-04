<!-- doc cmviflhqufr5ze1qp77p · "Handoff E2-01: portal-parceiro-e2.md" · atualizado 2026-10-30T16:52:38.780Z · card PJ-ECWI3Z -->

# Guia do front: Portal do parceiro, E2 (clientes, pacientes e a ponte com o app)

**Para:** o Luís. Portal web do parceiro (`petjourney-admin`) e, a partir da E2-02, o app (`petjourney-app`).
**Backend:** E2-01 pronta e validada em dev em 2026-10-21 (unit e integração contra o Postgres de dev; o smoke por HTTP roda no gate da onda 1). **Não está em produção.**
**Specs de origem:**
- `docs/specs/2026/q4/q4-1/portal-parceiro/e2-pacientes-e-ponte/01-clientes-e-pacientes.md` (v0.3)
- `docs/specs/2026/q4/q4-1/portal-parceiro/e2-pacientes-e-ponte/02-vinculo-e-consentimento.md` (v0.2)
- `docs/specs/2026/q4/q4-1/portal-parceiro/e2-pacientes-e-ponte/05-migrador-de-dados.md` (v0.2, seção 4: o migrador, pronto em dev em 2026-10-27)
- `docs/specs/2026/q4/q4-1/portal-parceiro/e2-pacientes-e-ponte/03-leitura-do-app-pela-clinica.md` (seção 5: a clínica lê o app, pronta em dev em 2026-10-27, aguardando auditoria)

**Contrato:** `contrato/openapi.json`; gere os tipos dele. Convenções iguais às da onda 0 ([portal-parceiro-e0.md](portal-parceiro-e0.md), seção 1):
- envelope `{ statusCode, message, data }`;
- erro com `codigo` e `message` localizada;
- `?parceiroId=` quando o usuário tem mais de um parceiro.

---

## 1. Clientes e pacientes (E2-01)

O cadastro que Clínica e Hotel dividem. Substitui o `patientRepository` do mock (`features/clinico/data/repositories/patient-repository.ts`) e os tipos `Pet`, `Tutor`, `PetAlert` de `features/clinico/data/types.ts`.

### 1.1 Quem entra

- **Módulo:** abre com Clínica **ou** Hotel ligado. Sem nenhum: 403 `MODULO_INATIVO` com `modulo: 'QUALQUER'`. Com módulo só de consulta (suspenso, desligado, vencido): lê, e a escrita dá 403 `MODULO_SOMENTE_LEITURA`. Use o `podeLer`/`podeEscrever` do `GET /parceiro/portal/eu` para mostrar ou esconder os botões.
- **Permissão:** ler = `paciente.ler`; criar, editar, inativar, alertas, autorizados e foto = `paciente.escrever`. Sem a permissão: 403 `SEM_PERMISSAO`.
  - Cuidador, banhista e adestrador ainda **não** leem o cadastro: vem com o E7, recortado para os hóspedes. Esconda o menu de pacientes para quem não tem `paciente.ler` em `GET /parceiro/portal/eu`.
- **Mesclar e anonimizar:** só DONO ou quem tem o papel GESTOR. Os outros recebem 403 `SEM_PERMISSAO` (`papel: 'DONO_OU_GESTOR'`). Esconda o botão para quem não pode.

### 1.2 Lista e busca

`GET /parceiro/portal/pacientes?q=&especie=&ativo=&cursor=&limit=`
- **Resposta:** `{ itens: PacienteResumo[], proximoCursor }`. Passe `proximoCursor` em `cursor` para a próxima página; `null` = acabou. Cursor que não veio da API: 400 `CURSOR_INVALIDO` (recarregue a lista).
- **Ordem:** pelo nome do paciente, sem acento.
- **`q`:**
  - com letras, busca no nome do paciente e no do cliente, sem acento e sem caixa ("jose" acha "José");
  - só números, com 3 ou mais dígitos, busca no telefone, no CPF e no microchip. Pode vir com máscara;
  - menos que isso não filtra.
  - Não repita o defeito D2 do doc 08 no front: não filtre telefone com termo sem dígito.
- **`ativo`:** padrão `true`. `ativo=false` lista os inativos (óbito, transferido, mesclado, pedido do responsável).
- **`PacienteResumo`:** `id, nome, especie, especieOutra, raca, sexo, nascimento (AAAA-MM-DD), nascimentoEstimado, porte, ativo, inativoMotivo, obitoEm (AAAA-MM-DD), temFoto, cliente { id, nome, telefone, contatoPreferido }, alertas (só os ativos)`.
- Datas de dia vêm como `AAAA-MM-DD`. Não converta com `new Date()` (o fuso desloca um dia).

### 1.3 Ficha

`GET /parceiro/portal/pacientes/:id` devolve o resumo e mais:
- `castrado` (`null` = não informado), `pesoKg`, `microchip`, `pelagem`;
- `fotoUrl`: URL assinada que vale 15 minutos. Recarregue a ficha se a imagem falhar; `null` = sem foto;
- `mescladoEmId`: se este paciente foi mesclado, abra o que ficou;
- `cliente` completo, com `autorizados` (pessoas que podem buscar, só as ativas);
- `alertas`, ativos e encerrados.

Paciente de outro parceiro: 403 (`OWNERSHIP_FORBIDDEN`), sem dizer se existe.

### 1.4 Cadastrar

`POST /parceiro/portal/pacientes` (aceita `Idempotency-Key`; mande uma por clique em "Salvar", para o clique duplo não criar dois). Repetir a mesma chave com o mesmo corpo devolve o paciente já criado, no estado atual; não cria outro. O mesmo vale para criar alerta e autorizado.
- **Cliente:** mande `clienteId` (cliente que já existe, achado pela busca) **ou** `cliente` (novo, no mesmo corpo). Nenhum dos dois, ou os dois: 400 `CLIENTE_OBRIGATORIO`.
- **Paciente:**
  - `nome` e `especie` são obrigatórios;
  - `especie`: `CACHORRO, GATO, AVE, ROEDOR, COELHO, PEIXE, REPTIL, OUTRO`. O mapa do mock é `canina`→`CACHORRO`, `felina`→`GATO`, `ave`→`AVE`, `roedor`→`ROEDOR`, `reptil`→`REPTIL`, `equina`→`OUTRO` com `especieOutra: "Equino"`. `OUTRO` sem `especieOutra`: 400 `ESPECIE_OUTRA_OBRIGATORIA`;
  - `sexo` (`MACHO`/`FEMEA`/`null`), `nascimento` (`AAAA-MM-DD`), `nascimentoEstimado` (true quando veio de "3 anos"), `castrado` (true, false ou null), `porte` (`MINI, PEQUENO, MEDIO, GRANDE, GIGANTE` ou null; não sai do peso), `pesoKg`, `microchip`, `pelagem`;
  - `alertas` já no cadastro (até 20).
- **Cliente novo:**
  - `nome` (obrigatório), `cpf` (opcional, com ou sem máscara), `telefone` e `telefoneSecundario`, `email`, `contatoPreferido` (`WHATSAPP`, `LIGACAO` ou `EMAIL`), endereço (`cep, logradouro, numero, complemento, bairro, cidade, uf`), `observacao` e contato de emergência (`emergenciaNome`, `emergenciaTelefone`);
  - **telefone:** brasileiro com DDD (a API põe o 55) ou internacional com "+". Volta só dígitos com DDI (`5511987654321`); formate na tela. Inválido: 400 `TELEFONE_INVALIDO` com `campo`;
  - **CPF:** inválido dá 400 `CPF_INVALIDO`. Já cadastrado neste parceiro: 409 `CPF_JA_CADASTRADO` com `clienteId` do existente. Ofereça "usar este cliente".
- **Resposta:** 201 com a ficha.

### 1.5 Editar

- **Paciente:** `PATCH /parceiro/portal/pacientes/:id` com os mesmos campos do cadastro, menos `cliente` e `alertas`.
  - `clienteId` troca o responsável (outro cliente do parceiro).
  - A espécie só muda enquanto não houver atendimento; depois, 409 `ESPECIE_IMUTAVEL`.
  - `null` limpa um campo opcional. Em campo obrigatório (`nome`, `especie`) dá 400.
- **Cliente:** `GET` e `PATCH /parceiro/portal/clientes/:id`, com os mesmos campos do cliente novo. Cliente mesclado: 409 `CADASTRO_MESCLADO` (com `mescladoEmId`). Anonimizado: 409 `CLIENTE_ANONIMIZADO`.

### 1.6 Inativar, óbito e reativar

- **Inativar:** `POST /parceiro/portal/pacientes/:id/inativar` `{ motivo, obitoEm? }`.
  - `motivo`: `OBITO`, `TRANSFERIDO`, `PEDIDO_DO_RESPONSAVEL` ou `OUTRO` (`DUPLICADO` só pelo mesclar).
  - `OBITO` exige `obitoEm` (`AAAA-MM-DD`). Paciente com óbito não recebe agendamento, lembrete, oferta nem convite da clínica (as rotas de agenda respondem 409 `PACIENTE_INATIVO`).
- **Reativar:** `POST .../pacientes/:id/reativar` desfaz por engano, inclusive óbito. Mesclado não volta.

### 1.7 Alertas

- `POST /parceiro/portal/pacientes/:id/alertas` `{ tipo, severidade, detalhe }`.
  - `tipo`: `ALERGIA, AGRESSIVO, CRONICO, MEDICACAO_CONTINUA, IMUNOSSUPRIMIDO, GESTANTE, INADIMPLENTE`.
  - `severidade`: `INFO, ATENCAO, RISCO`.
- `PATCH .../alertas/:alertaId` altera; `ativo: false` encerra.
- `DELETE .../alertas/:alertaId` (204) também encerra. O alerta fica no histórico da ficha.

- **Teto de 50 alertas ativos por paciente (re-auditoria do G4, 29/10):** criar o 51º, reativar um encerrado (`ativo: true`) com 50 ativos, ou juntar dois cadastros (mesclar) cuja soma passe de 50 dá 409 `ALERTAS_NO_LIMITE` com `limite` e `ativos`. Mostre "Este paciente já tem 50 alertas ativos. Encerre os que não valem mais" e leve para a lista de alertas. Encerrar nunca é barrado. A ficha continua mostrando todos (o paciente que já tinha mais, de antes do teto, não perde nenhum). O cadastro do paciente novo continua com até 20 alertas.

### 1.8 Pessoas autorizadas (hotel)

- `POST /parceiro/portal/clientes/:id/autorizados` `{ nome, telefone?, documento?, relacao? }`.
- `PATCH .../autorizados/:autorizadoId` altera.
- `DELETE .../autorizados/:autorizadoId` (204) tira da lista.

### 1.9 Foto

- `POST /parceiro/portal/pacientes/:id/foto`: multipart, campo `file`.
  - Aceita JPG, PNG, WEBP ou HEIC, até 8 MB. O tipo é conferido pelo conteúdo do arquivo; senão, 400 `FOTO_INVALIDA` com `reason: 'TIPO' | 'TAMANHO'`.
  - Não mande outros campos no multipart.
  - Responde a ficha com a `fotoUrl` nova.
- `DELETE .../foto` (204) tira a foto.

### 1.10 Mesclar duplicados (DONO ou GESTOR)

- **Paciente:** `POST /parceiro/portal/pacientes/:id/mesclar` `{ comPacienteId }`.
  - O da rota **fica**; o histórico do `comPacienteId` passa para ele.
  - Os campos vazios do que fica herdam os do outro (microchip, raça, nascimento...).
  - O outro fica inativo `DUPLICADO`, com `mescladoEmId`.
- **Cliente:** `POST /parceiro/portal/clientes/:id/mesclar` `{ comClienteId }`. Pacientes, autorizados e o CPF vão para o que fica.
  - Contato, documento e endereço do duplicado são apagados: o que faltava no que fica é copiado, e o que divergia **se perde** (o que fica vence). Mostre os dois lado a lado antes de confirmar.
- Mostre uma prévia ("o histórico de X vai para Y") e peça confirmação. Mesclar consigo mesmo: 400 `MESCLA_INVALIDA`. Já mesclado: 409 `CADASTRO_MESCLADO`.

### 1.11 Exclusão a pedido do titular (LGPD, DONO ou GESTOR)

- `POST /parceiro/portal/clientes/:id/anonimizar` `{ motivo }` (10 a 500 caracteres; descreva o pedido sem dado pessoal).
- **Resposta:** `{ resultado, protocolo, bloqueadoAte, ... }`.
  - `EXCLUIDO`: sem registro clínico, o cliente e os pacientes saíram de vez (`bloqueadoAte: null`).
  - `ANONIMIZADO`: o contato e o documento saem na hora (nome, CPF, telefones, e-mail, endereço, contato de emergência e os autorizados), e os pacientes ficam inativos. O prontuário fica **bloqueado** até `bloqueadoAte` (5 anos depois do último atendimento, Res. CFMV 1.321/2020): os pacientes somem da busca (também de `ativo=false`), e a ficha, o prontuário, as receitas, os documentos, as vacinas e a internação deles dão **403 `OWNERSHIP_FORBIDDEN`**, o mesmo de um paciente de outra clínica. No vencimento, a API anonimiza o resto sozinha (nome do animal, pelagem, foto).
  - `bloqueadoAte: null` no `ANONIMIZADO`: o último atendimento já tinha mais de 5 anos, e o resto saiu na hora.
- **Parecer LGPD de 30/10:** não existe "anonimizar mesmo assim" nem "desbloquear", nem para o DONO (a guarda de 5 anos é obrigação do CFMV). Na confirmação, mostre: "Os dados de contato e o documento saem agora. O prontuário fica guardado e bloqueado até {bloqueadoAte}, sem acesso da equipe, e depois é anonimizado." Na tela de sucesso, a data de `bloqueadoAte` no fuso da clínica.
- `GET /parceiro/portal/clientes/:id` do anonimizado continua respondendo (sem dado pessoal) e traz `bloqueadoAte`.
- **O que a exclusão encerra na hora (G6):**
  - os horários futuros do cliente (AGENDADO e CONFIRMADO) ficam `CANCELADO` com `motivoCancelamento: EXCLUSAO_DO_TITULAR`, sem aviso. É motivo do sistema, como o `OBITO`: não entra no seletor de cancelar e, no app, sai `null`. Mostre na agenda como "Cancelado: exclusão a pedido do responsável";
  - o "Iniciar" de um horário que sobrou do cliente anonimizado (o de hoje, já passado) dá **403 `OWNERSHIP_FORBIDDEN`**, o mesmo das outras ações: esconda o botão quando o cliente vier com `anonimizadoEm`;
  - o pedido de cópia do prontuário em aberto vai ao estado final novo `ENCERRADO_NA_EXCLUSAO` (aba "Encerrados"); rótulo sugerido: "Encerrado: exclusão a pedido do responsável";
  - os rascunhos de receita e de documento do cliente são descartados. O atendimento em rascunho fica guardado no prontuário bloqueado e some das pilhas, da lista de atendimentos e dos contadores.
- O `protocolo` (`LGP-AAAA-NNNNNN`) é o comprovante para o titular: mostre e permita copiar.
- Funciona também com o módulo só de consulta (suspenso, desligado, vencido): o pedido do titular não espera a clínica reativar.
- Os clientes que já foram mesclados neste também são anonimizados.
- Peça confirmação dupla: não tem volta.
- Cliente anonimizado vem com `nome: 'Anonimizado'` e `anonimizadoEm` preenchido. Mostre um rótulo traduzido pelo `anonimizadoEm`, não o nome cru. Com `bloqueadoAte`, mostre "prontuário bloqueado até {data}"; o link para os pacientes dele não leva a nada (403).

---

## 2. Vínculo entre o paciente da clínica e o pet do app (E2-02)

Spec: `docs/specs/2026/q4/q4-1/portal-parceiro/e2-pacientes-e-ponte/02-vinculo-e-consentimento.md` (v0.3). O vínculo liga um paciente da clínica a um pet do app, com um responsável que aceitou. Nenhuma proposta aparece para uma conta sem prova de posse: link do e-mail, código do balcão, acesso temporário que a própria pessoa criou ou QR do pet dela. CPF ou e-mail iguais nunca bastam.

### 2.1 Portal: propor

- **Por e-mail ou código:** `POST /parceiro/portal/clientes/:clienteId/propostas-de-vinculo` `{ pacienteIds: [...], canal: 'EMAIL' | 'CODIGO' }` (`paciente.escrever`).
  - `EMAIL`: a API manda o link ao e-mail do cadastro do cliente. Sem e-mail: 400 `CLIENTE_SEM_EMAIL` (ofereça o código).
  - `CODIGO`: devolve `{ codigo }` com 8 caracteres, letras maiúsculas e números (ex.: `K7MQX3PA`). Não há 0, O, 1, I, L nem U, para não confundir.
    - Mostre em dois blocos (`K7MQ-X3PA`), grande, com opção de imprimir: o responsável digita no app.
    - Vale 72 h.
  - A resposta é a mesma com ou sem conta no app; a API não diz.
  - Paciente inativo, com óbito ou já vinculado: 409 `PACIENTE_INATIVO` ou `VINCULO_JA_ATIVO`.
  - Teto de 50 propostas por dia: 429 `PROPOSTA_TETO_DIARIO`.
- **Pelo QR da carteirinha:** `POST /parceiro/portal/vinculos/por-qr` `{ publicSlug, pacienteId }`.
  - Cadastre o paciente antes e depois leia o QR.
  - A resposta é sempre `{ propostaId }`: a clínica nunca sabe se o pet existe, se tem dono ou se a pessoa bloqueou a clínica.
- **Pelo acesso temporário:** `POST /parceiro/portal/compartilhamentos/:id/propor-vinculo` `{ pacienteId? }`, num acesso que este parceiro reivindicou.
  - Só enquanto o acesso vale: revogado ou vencido dá 404. Esconda o botão nesses casos.
  - Sem `pacienteId`, a API cria cliente e paciente pelo cabeçalho do acesso, com o nome provisório "Responsável de {pet}".
  - Resposta `{ propostaId }`. Chamar de novo no mesmo acesso, com a proposta ainda pendente, devolve a mesma `propostaId`, sem criar outro cadastro.
- **Acompanhar:** `GET /parceiro/portal/clientes/:clienteId/propostas-de-vinculo` lista as propostas com `status`:
  - `PENDENTE` = não respondida. Inclui a que não chegou a ninguém e a de quem bloqueou a clínica: a clínica não fica sabendo do bloqueio;
  - `EXPIRADA`, `RESPONDIDA`, `RECUSADA` (com `motivoRecusa`) ou `CANCELADA`;
  - o que foi feito com cada paciente (`acao`).
- **Cancelar:** `DELETE /parceiro/portal/propostas-de-vinculo/:id` (só pendente).
- **Cancelada pelo sistema:** inativar, registrar óbito, mesclar ou anonimizar cancela as propostas pendentes do paciente ou do cliente. O link ou código já entregue deixa de valer, e a lista mostra `CANCELADA`.
- **Pronto quando:** a ficha do paciente tem "Ligar ao app" com os três caminhos, e a lista mostra o estado de cada proposta.

### 2.2 Portal: o vínculo na ficha

- **Ver:** `GET /parceiro/portal/pacientes/:id/vinculo` devolve `null` ou `{ id, origem, ativadoEm, consentimento: { diarioCompleto, peso, notas } }`.
  - **Mudou na E2-03 (2026-10-27): o `petId` saiu.** A clínica endereça o app sempre pelo `pacienteId` dela (seção 5). Se o portal guardava o `petId`, apague: ele não volta.
  - Mostre o selo "no app", desde quando e o que o responsável liberou.
  - O que não foi liberado aparece como "não liberado", sem botão.
- **Encerrar:** `POST /parceiro/portal/pacientes/:id/vinculo/encerrar` `{ motivo }`.
- **Correções pedidas pelo responsável:**
  - `GET /parceiro/portal/pedidos-de-correcao` (`?resolvidos=true` para o histórico);
  - `POST .../pedidos-de-correcao/:id/resolver` depois de corrigir o cadastro.
- **Inbox do parceiro** (seção 6.2 do e1): `VINCULO_RESPONDIDO` e `VINCULO_ENCERRADO_PELO_RESPONSAVEL`, com `dados.clienteId` e `dados.pacienteIds` para abrir a ficha.
- **Pronto quando:** o selo, o consentimento e a caixa de correções aparecem na ficha e no menu.

### 2.3 App: receber e responder a proposta

- **Link do e-mail:** `https://petjourney.health/clinica/vinculo/<token>`. O app (e o site, para quem não tem o app) abre a tela da proposta e, com a pessoa logada, chama `POST /tutor/clinica/vinculos-propostos/resgatar` `{ token }`.
  - Sem login: login ou cadastro primeiro, depois resgata.
- **Código do balcão:** tela "Tenho um código da clínica" chama `resgatar` com `{ codigo }`.
  - Campo de 8 caracteres, letras e números, com teclado alfanumérico em maiúsculas. Aceite o hífen e espaços: a API limpa.
  - 5 tentativas por hora por conta (429 `RESGATE_TENTATIVAS_EXCEDIDAS`) e 30 por rede (429 `TAXA_PUBLICA_EXCEDIDA`, com `Retry-After`).
  - Código errado, vencido ou já usado em outra conta: sempre 404 `PROPOSTA_NAO_ENCONTRADA`. Uma mensagem só ("código não encontrado ou vencido; peça outro à clínica").
- **Erros do link:** vencido dá 410 `VINCULO_EXPIRADO`; aberto em outra conta, 409 `PROPOSTA_JA_RESGATADA`.
- **Site (página do link para quem não tem o app):** a página `/clinica/vinculo/<token>` precisa responder com `Referrer-Policy: no-referrer` e não pode carregar analytics nem pixel. O token está no caminho e não pode vazar para terceiros.
- **Lista:** `GET /tutor/clinica/vinculos-propostos`, com o detalhe em `GET .../:id`.
  - `clinica { nome, slug, cidade, uf }`.
  - `cliente`, mascarado: "Rita S.", "(11) 9••••-1030", "r•••@e•••.br". Mostre como está; não peça para "confirmar seus dados".
  - `pets[]`, com `sugestaoDoApp` (pet seu de mesmo nome e espécie).
- **Responder:** `POST .../:id/responder` `{ pets: [{ pacienteId, acao, petId? }], consentimento? }`. Uma ação por pet da proposta:
  - `LIGAR` com um pet seu da mesma espécie. Pré-selecione a `sugestaoDoApp`. Espécie diferente: 409 `ESPECIE_DIFERENTE`. Pet que não é seu: 403 `PET_SEM_ACESSO`;
  - `CRIAR` cria o pet no app com os dados da clínica (nome, espécie, raça, sexo, nascimento, porte e castração; o microchip fica só na clínica). Acima do plano: 403 `LIMITE_PETS_PLANO`, o mesmo erro do cadastro de pet, com o mesmo CTA de upgrade ou de pedir aumento;
  - `NAO_E_MEU`.
  - Faltou ação para algum pet: 422 `VINCULO_INCOMPLETO`.
  - A clínica inativou ou mesclou o paciente depois do link: 409 `PACIENTE_INATIVO`. Diga que a proposta não vale mais e volte à lista.
  - `consentimento` (`diarioCompleto`, `peso`, `notas`) nasce todo desligado. Ofereça os três interruptores na própria tela, explicando o que a clínica passa a ver.
  - **Segundo pet com a mesma clínica (E2-03, decisão 15):** o consentimento é por clínica e pessoa, não por pet. Se a pessoa já tem vínculo com esta clínica (ela aparece em `GET /tutor/clinica/clinicas`) e alguma chave está ligada, a tela de aceite mostra o aviso abaixo, com os interruptores já na posição atual e o link "Ajustar" para "Minhas clínicas". `{chaves}` é a lista das chaves ligadas, com os rótulos da tabela.

    | Idioma | Aviso | Rótulos (`diarioCompleto`, `peso`, `notas`) |
    |---|---|---|
    | pt-BR | "Você já liberou para esta clínica: {chaves}. Isso vale também para {petNome}. Para mudar, toque em Ajustar." | diário, peso de casa, notas do diário |
    | en-US | "You already share with this clinic: {chaves}. This also applies to {petNome}. To change it, tap Adjust." | diary, home weight, diary notes |
    | en-GB | "You already share with this clinic: {chaves}. This also applies to {petNome}. To change it, tap Adjust." | diary, home weight, diary notes |
    | es-419 | "Ya compartes con esta clínica: {chaves}. Esto vale también para {petNome}. Para cambiarlo, toca Ajustar." | diario, peso en casa, notas del diario |
    | sr-Latn | "Sa ovom klinikom već delite: {chaves}. To važi i za {petNome}. Da biste promenili, dodirnite Podesi." | dnevnik, težina kod kuće, beleške iz dnevnika |
    | ar | "أنت تشارك بالفعل مع هذه العيادة: {chaves}. ينطبق هذا أيضًا على {petNome}. للتغيير، اضغط على تعديل." | اليوميات، الوزن في المنزل، ملاحظات اليوميات |
- **Recusar:** `POST .../:id/recusar` `{ motivo: 'NAO_SOU_EU' | 'NAO_QUERO_VINCULO' }`.
- **Pedir correção:** `POST .../:id/correcao` `{ mensagem }`, até 3 por proposta. O responsável não edita o cadastro da clínica.
- **Aviso `VINCULO_PROPOSTO`** (proposta por QR ou acesso temporário):
  - em `rotas-notificacao.ts`, rota para a tela de propostas quando ela existir; até lá, `ROTA_INBOX`;
  - `AFETA_HOME_POR_TIPO`: `false`; `PERFIL_POR_TIPO`: perfil responsável;
  - ícone sugerido `StethoscopeIcon`.
  - Copy fixa, sem o nome da clínica; o nome aparece na tela.
  - `dados`: `{ parceiroId, parceiroNome, propostaId }`.
- **Pronto quando:** dá para abrir o link e o código, responder pet a pet com a sugestão pré-marcada, e os 3 tipos novos do inbox (2.3 e 6.3 do e1, mais este) abrem a tela certa.

### 2.4 App: "Minhas clínicas"

- **Lista:** `GET /tutor/clinica/clinicas` devolve um item por (clínica, dono):
  - `parceiroId, nome, slug, cidade, uf, telefonePublico, whatsappPublico`;
  - `tutorId, petIds, desde, consentimento`. `petIds` inclui pet inativo, que segue recebendo o que a clínica publica: mostre-o, para o dono poder encerrar;
  - `podeAlterarConsentimento`.
  - Membro de família vê as clínicas dos pets da família só para ler (`podeAlterarConsentimento: false`): esconda interruptores e botões.
- **Consentimento:** `PUT /tutor/clinica/clinicas/:parceiroId/consentimento` `{ diarioCompleto?, peso?, notas? }`. Só o dono; família: 403 `SOMENTE_LEITURA`.
- **Encerrar:** `POST .../clinicas/:parceiroId/encerrar` `{ petId? }`, um pet ou todos.
  - A clínica para de ler na hora; o que ela já publicou fica no app.
- **Bloquear:** `POST` e `DELETE .../clinicas/:parceiroId/bloquear`. Bloquear recusa as pendentes dessa clínica e corta as propostas novas por QR e acesso, sem aviso a ela.
- **"Quem viu"** (seção 5 do e1): `GET /tutor/clinica/clinicas/:parceiroId/acessos`.
- **Pronto quando:** a tela lista as clínicas, os interruptores salvam, e encerrar e bloquear têm confirmação.

## 3. O que a clínica publica no app (E2-04)

Spec: `docs/specs/2026/q4/q4-1/portal-parceiro/e2-pacientes-e-ponte/04-publicacao-no-app.md` (v0.3). Com o vínculo ativo, o que a clínica registra entra sozinho no prontuário do pet:
- consulta (resumo do atendimento);
- vacina (com lote, dose e via, fechando o lembrete pendente de mesmo nome e criando o da próxima dose);
- peso aferido.

### 3.1 App: selo da clínica e somente leitura

- **Campos novos** em `GET /consulta`, `/vacina`, `/peso-registro` e na timeline (`metadata`):
  - `origem` (`TUTOR`, `ANOTACAO`, `LEITURA_RECEITA`, `PARCEIRO`), `parceiroId`, `profissionalNome`, `profissionalCrmv`;
  - na vacina também `lote`, `fabricante`, `validadeLote`, `dose`, `dosesNaSerie`, `via` e `aplicadaNaClinica`.
- **`origem = PARCEIRO`:**
  - selo "Registrado pela clínica", com o nome do profissional e o CRMV como vieram;
  - **esconda editar** (e o "adicionar anexo" da consulta). Se uma build antiga tentar, a API responde 403 `REGISTRO_DA_CLINICA` com mensagem localizada;
  - na leitura de receita, **não ofereça a consulta da clínica** em "juntar a uma consulta existente": a API recusa com o mesmo 403;
  - troque "apagar" por **"Remover do meu app"**: a cópia sai, e a clínica não publica de novo aquele registro (nem por adendo). Confirmação sugerida: "Isso tira o registro só do seu app. A clínica continua com o prontuário dela."
- `ANOTACAO` e `LEITURA_RECEITA` continuam editáveis como hoje. O selo pode dizer de onde veio, se o design quiser.
- **Pronto quando:** consulta, vacina e peso da clínica aparecem com selo, sem editar, com "Remover do meu app", e a vacina mostra lote, dose e via.

### 3.2 App: os quatro avisos novos

Todos vão para o dono do pet, com copy pronta nos 6 idiomas e só o nome do pet (sem clínica e sem remédio ou vacina). `dados`: `{ parceiroId, petId, petNome, publicacaoId, alvoTipo, alvoId }`.

| Tipo | Quando | `dados` extra |
|---|---|---|
| `ATENDIMENTO_RESUMO_DISPONIVEL` | A clínica publicou o resumo do atendimento | |
| `ATENDIMENTO_RESUMO_ATUALIZADO` | A clínica fez um adendo que muda o que aparece | |
| `VACINA_REGISTRADA_PELA_CLINICA` | A clínica registrou uma vacina aplicada | `proximaDose` (ISO), se criou o lembrete |
| `CLINICA_ANULOU_REGISTRO` | A clínica anulou um registro; a cópia saiu do app | |

- **Em `rotas-notificacao.ts`:**
  - `ROTA_POR_TIPO`: hoje a API manda `ROTA_INBOX`. Quando o app mapear, os três primeiros podem abrir o detalhe pelo `alvoTipo` (`CONSULTA` ou `VACINA`) e `alvoId`; o de anulação abre o inbox;
  - `AFETA_HOME_POR_TIPO`: `true` nos três primeiros (o prontuário mudou), `false` no de anulação;
  - `PERFIL_POR_TIPO`: perfil responsável.
- **Ícones sugeridos:** `FileTextIcon`, `PencilSimpleIcon`, `SyringeIcon` e `ArrowCounterClockwiseIcon`.
- **Pronto quando:** os quatro tipos estão no mapa e o `audit:notificacao-rotas` passa.

## 4. Migrador da base da clínica (E2-05)

Spec: `docs/specs/2026/q4/q4-1/portal-parceiro/e2-pacientes-e-ponte/05-migrador-de-dados.md` (v0.3, revisão de segurança R1 a R15). Backend pronto em dev em 2026-10-27 (unit, integração contra o Postgres de dev e smoke HTTP 45/45). **Não está em produção.**

**Mudou na v0.3 (revisão de segurança), em resumo para o front:**
- Dúvida nova: `motivo: CPF_NOME_DIVERGE` (o mesmo CPF com outro primeiro nome), contra a clínica e dentro da planilha. O telefone igual com só o primeiro nome agora pergunta (`TELEFONE`).
- Cada lado da dúvida vem com no máximo 10 linhas e o total (`totalLinhas`): mostre "e mais {total menos 10} linhas".
- Códigos novos no relatório: `TELEFONE_DE_ENCHIMENTO`, `TELEFONES_A_MAIS`, `CPF_DE_OUTRO_CADASTRO` (seção 4.5).
- O lote de propostas deixa de fora quem a clínica precisa conferir (`pelaFicha`, `clientesPelaFicha`) e quem repete e-mail (`emailRepetido`) (seção 4.7).
- O desfazer dá 409 `IMPORTACAO_OCUPADA` com o lote de propostas no ar, e cancela as propostas pendentes (seção 4.6).
- As planilhas de demonstração do portal (`data/fixtures/planilhas-de-demonstracao.ts`) ainda têm e-mails de gmail, hotmail, yahoo e `exemplo.com`: troque por `@petjourney.test` (a API trocou; o smoke propõe vínculo a eles).
- **CSV no portal:** se o portal montar CSV ("baixar as linhas que não entraram", relatório) com `ajustes.de`, nomes ou qualquer texto que veio da planilha, neutralize a célula que começa com `=`, `+`, `-` ou `@` (prefixe com `'`), para o Excel não executar fórmula.

O que muda no portal, em uma frase: o arquivo continua no navegador (ler o `.csv` e o `.xlsx`, achar o cabeçalho, ligar as colunas e o de-para de espécie seguem no portal), mas **a base da clínica não desce mais**, e o plano, as dúvidas de duplicidade, a gravação em lotes e o relatório passam a ser do servidor.

- **Apagar do portal:** `migracaoRepository.base()` (baixava todos os clientes e pacientes, com CPF e telefone), `migracaoRepository.importarLote` e o laço de lotes do `stores/migracao.ts`. O `planejar` local pode ficar só como prévia antes de mandar; quem decide é a API.
- **Rotas:** todas sob `/parceiro/portal/importacoes`, com `importacao.executar` (DONO e GESTOR) e qualquer módulo (Clínica ou Hotel). RECEPCAO e VETERINARIO recebem 403 `SEM_PERMISSAO`: esconda o "Importar planilha" para eles.

### 4.1 Subir a planilha

- **O que o portal mantém:** leitura do arquivo, cabeçalho, ligação das colunas (a pergunta "qual coluna tem o nome do animal?") e o de-para de espécie (uma escolha por valor da coluna).
- **De-para de espécie, agora no enum da API** (`Especie`): canina para `CACHORRO`, felina para `GATO`, ave para `AVE`, roedor para `ROEDOR`, réptil para `REPTIL`, equina para `OUTRO` com `especieOutra: "Equino"`.
  - **Coelho e peixe passam a existir** (`COELHO`, `PEIXE`): a API reconhece "Coelho" e "Peixe" sozinha. Pare de perguntar por eles.
  - A escolha vai em cada linha: `especieEscolhida` (o enum ou `FORA`), e `especieOutra` quando for `OUTRO`.
- **Código do sistema anterior (D6):** ligue as colunas `Código`, `cod_cliente` e `cod_animal` (o protótipo mandava para "nenhum") aos campos novos `codigoCliente` e `codigoAnimal`. Eles vão para o cadastro (`codigoNaOrigem`), aparecem na ficha e na lista, e a busca de pacientes acha por eles ("o 3021 do Vetus").
- **Começar:** `POST /parceiro/portal/importacoes` com `Idempotency-Key`:
  - corpo `{ arquivoNome, hashArquivo, totalLinhas, ddd, ordemDasDatas, origemDetectada? }`;
  - `hashArquivo`: sha256 do arquivo, em hexadecimal minúsculo (`crypto.subtle.digest`);
  - `totalLinhas`: as linhas de dado do arquivo, **com as em branco do meio** (de depois do cabeçalho até a última linha com conteúdo);
  - `ddd`: o DDD do telefone da clínica. Sem ele, telefone anotado sem DDD fica de fora (`TELEFONE_INVALIDO`), em vez de ganhar um 11 inventado;
  - `ordemDasDatas`: `DMY` ou `MDY`, o resultado do `ordemDasDatas()` da coluna de nascimento;
  - resposta `{ id, status, jaImportadoEm }`. Com `jaImportadoEm`, avise: "Este arquivo já foi importado em {data}. Quer importar de novo?".
- **Mandar as linhas:** `POST /parceiro/portal/importacoes/:id/linhas`, até 500 linhas por chamada e uma `Idempotency-Key` por chamada (se a rede cair, repita com a mesma chave).
  - Cada linha: `{ numeroLinha, campos: { responsavelNome, cpf, telefone, telefone2, email, cep, endereco, numero, complemento, bairro, cidade, uf, codigoCliente, petNome, especie, raca, sexo, castrado, nascimento, idade, peso, microchip, pelagem, alergia, situacao, codigoAnimal }, especieEscolhida?, especieOutra?, mescladas? }`.
  - `numeroLinha` é a linha do Excel (a que o relatório mostra). `campos` leva **o texto da célula como está**: a API lê cada valor de novo (CPF, telefone, data, peso, espécie) e não confia no navegador.
  - `mescladas`: os campos que vieram de célula mesclada no `.xlsx` (hoje só `responsavelNome` vira ajuste).
  - **Mande também as linhas em branco do meio:** é por elas que a API sabe que o animal sem responsável não é continuação da linha de cima.
  - Resposta `{ status, recebidas, totalLinhas, duvidasAbertas, linhas: [{ numeroLinha, destino, motivos, repetida }] }`. Quando a última chega, a API roda o plano, e o status vira `COM_DUVIDAS` ou `PRONTA`.
- **Tetos:** 10.000 linhas por importação (divida o arquivo maior e avise antes de subir), 500 por chamada (até 1 MiB de corpo), 40 chamadas por importação, 2 importações abertas por clínica (409 `IMPORTACAO_ABERTAS_NO_LIMITE`). Muitas ações seguidas: 429 `IMPORTACAO_TAXA_EXCEDIDA` com `tenteDeNovoEmSegundos`.
- **Pronto quando:** a planilha de demonstração de 39 linhas sobe em duas chamadas e cai em `COM_DUVIDAS` com 5 dúvidas.

### 4.2 Dúvidas

- `GET /parceiro/portal/importacoes/:id/duvidas?pendentes=true&limite=20&cursor=`: `{ itens, proximoCursor, abertas, total }`. Uma por vez na tela, como hoje.
- Cada dúvida: `{ id, tipo, motivo, numeroLinha, respostasAceitas, resposta, daPlanilha, outro, candidatos }`. **A primeira de `respostasAceitas` é a resposta segura**: use-a como a saída de quem não sabe.

| `tipo` | Quando | Respostas |
|---|---|---|
| `RESPONSAVEL_EXISTENTE` | Só o nome igual a um cliente da clínica (`motivo: NOME`); o mesmo telefone sem o nome inteiro igual (`TELEFONE`); o mesmo CPF com outro primeiro nome (`CPF_NOME_DIVERGE`, v0.3) | `PESSOAS_DIFERENTES`, `JUNTAR_AO` (com o `clienteId` de um dos `candidatos`), `DEIXAR_DE_FORA` |
| `MESMA_PESSOA` | Duas pessoas da planilha com o mesmo nome e contatos diferentes (`MESMO_NOME`), ou o mesmo CPF com outro primeiro nome (`CPF_NOME_DIVERGE`, v0.3) | `PESSOAS_DIFERENTES`, `MESMA_PESSOA` |
| `ORFAO` | Animal sem responsável logo abaixo de quem tem | `DEIXAR_DE_FORA`, `JUNTAR_AO` (liga à linha de cima) |

- **Candidato da clínica:** nome, telefone mascarado (`(11) 9••••-6410`) e até 5 animais. **Nunca vem CPF.** O lado da planilha vem do mesmo jeito (nome, telefone mascarado, animais e as linhas: no máximo 10, com `totalLinhas`).
- **Mudou do protótipo (v0.3):** o mesmo telefone de um cliente da clínica só junta sozinho com o **nome inteiro** igual. Só o primeiro nome igual vira dúvida (`motivo: TELEFONE`): "Maria Souza" e "Maria Lima" com o fixo da casa são duas pessoas. O mesmo CPF com outro primeiro nome também pergunta (`CPF_NOME_DIVERGE`, CPF reaproveitado de um parente). Texto sugerido para ela: "O CPF desta linha já está no cadastro de {nome}. É a mesma pessoa?"; se a clínica disser que não, a pessoa nova entra sem o CPF.
- **Telefone de enchimento não junta ninguém (v0.3):** 99999-9999, 00000-0000 e o telefone da própria clínica (do perfil do estabelecimento) são lidos como "sem telefone" (`TELEFONE_DE_ENCHIMENTO`).
- **Nome comum (v0.3):** com mais de 50 pessoas da planilha com o mesmo nome, a API não pergunta: trata como pessoas diferentes.
- **Responder:** `POST /parceiro/portal/importacoes/:id/respostas` `{ respostas: [{ duvidaId, resposta, clienteId? }] }` (até 500 de uma vez). Resposta `{ status, duvidasAbertas }`.
  - **Leia as dúvidas de novo depois de cada resposta:** quem responde `MESMA_PESSOA` junta os dois grupos, e só então a API procura o grupo na clínica (pode nascer uma `RESPONSAVEL_EXISTENTE` nova).
  - Dá para mudar de ideia antes de importar: responda de novo a mesma dúvida (`pendentes=false` traz as respondidas).
  - 400 `IMPORTACAO_DUVIDA_INEXISTENTE`: recarregue a lista. 400 `IMPORTACAO_RESPOSTA_INVALIDA`: resposta que a dúvida não aceita, ou `clienteId` que não é candidato.
- **Pronto quando:** as respostas do roteiro (Luciana "sim", as duas Marias "pessoas diferentes", os três animais "ligar") deixam a importação `PRONTA`.

### 4.3 Resumo (as três caixas)

- `GET /parceiro/portal/importacoes/:id/resumo`: `entram`, `corrigidas`, `paraCompletar`, `naoEntram`, `emBranco`, `emDuvida`, `duvidasAbertas`, `responsaveisNovos`, `responsaveisExistentes`, `pacientesNovos`, `pacientesExistentes`, e as listas `foraPorMotivo`, `ajustesPorMotivo` e `padronizacoes` (o que só mudou de forma, somado).
- Na planilha de demonstração, com o roteiro: **33 entram, 16 corrigidas, 4 não entram, 2 em branco.** O protótipo dizia 18 corrigidas porque contava "espécie escolhida" nas linhas 8 e 42, que só têm o responsável. A API só lê espécie de linha com animal.
- O texto "Usamos 18 de 20 colunas" continua sendo do portal (é ele quem sabe das colunas).

### 4.4 Importar e acompanhar

- **Importar:** `POST /parceiro/portal/importacoes/:id/confirmar`. A API refaz o plano com a base de agora (outra importação, ou a recepção, pode ter cadastrado alguém) e congela.
  - 409 `IMPORTACAO_COM_DUVIDAS` com `duvidasAbertas`: a base mudou e nasceu dúvida nova; volte para as dúvidas.
  - 200 com `status: PROCESSANDO`: a gravação é um job no servidor, em lotes de 80. Ela segue com a aba fechada e pode ser acompanhada de outro aparelho.
- **Acompanhar:** `GET /parceiro/portal/importacoes/:id` a cada 1 ou 2 segundos enquanto `PROCESSANDO`. O progresso é `processadas / aGravar`; no fim vêm `criados`, `juntados` e `foraCount`. As datas vêm com o offset da clínica.
- **Pausar e continuar:** `POST .../pausar` (o lote no ar termina, o próximo não sai) e `POST .../continuar` (de `PAUSADA` ou `FALHOU`, do mesmo lote). Em `FALHOU`, `ultimoErro` traz um código técnico: mostre "A importação parou. Tente continuar." e o código num detalhe.
- **Lista de pacientes:** o contador `importacoesPausadas` (`GET /parceiro/portal/pendencias`, tom de atenção, só para quem importa) avisa da importação pausada ou parada.
- **Pronto quando:** o Vetus de 2.400 linhas importa, pausa no meio, continua e conclui; recarregar a página no meio mostra o progresso certo.

### 4.5 Relatório por linha

- `GET /parceiro/portal/importacoes/:id/linhas?destino=&motivo=&desfecho=&cursor=&limite=` (até 100 por página; `proximoCursor` é o número da última linha).
- Cada linha: `numeroLinha`, `destino` (`ENTRA`, `JUNTA_EXISTENTE`, `JUNTA_LINHA`, `CONTATO`, `FORA`, `DUVIDA`), `motivos` (códigos), `ajustes` (`{ campo, tipo, de, para }`, para frases como "Telefone (11) 8411-2299 não tinha o 9: ficou (11) 98411-2299"), `camposPreenchidos` (o que a linha preencheu num cadastro que já existia), `clienteId`, `pacienteId`, `grupoLinha`, `juntaComLinha` e `desfecho` (depois do desfazer).
- **As frases são do portal**, a partir dos códigos, nos 6 idiomas. Os códigos (`CodigoDeMotivo`):
  - ajustes que entram: `DATA_ANO_CURTO`, `DATA_DA_PLANILHA`, `DATA_AMERICANA`, `DATA_SEM_DIA`, `NASCIMENTO_PELA_IDADE`, `PESO_EM_GRAMAS`, `TELEFONE_NONO_DIGITO`, `TELEFONE_SEM_DDD_CORRIGIDO`, `TELEFONE_DIVIDIDO`, `CPF_ZEROS`, `CEP_ZERO`, `ESPECIE_PELA_RACA`, `ESPECIE_ESCOLHIDA`, `CELULA_MESCLADA`, `RESPONSAVEL_DA_LINHA_ANTERIOR`, `NOME_CORTADO`;
  - valor que não entrou (o campo fica em branco): `DATA_INVALIDA`, `DATA_FUTURA`, `IDADE_INVALIDA`, `PESO_INVALIDO`, `TELEFONE_INVALIDO`, `CPF_INVALIDO`, `EMAIL_INVALIDO`, `CEP_INVALIDO`, `UF_INVALIDA`, `MICROCHIP_INVALIDO`, `MICROCHIP_CIENTIFICO`, `SEXO_NAO_RECONHECIDO`, `CASTRADO_NAO_RECONHECIDO`, `TEXTO_LONGO`, e na v0.3 `TELEFONE_DE_ENCHIMENTO` ("99999-9999 parece telefone de enchimento: ficou sem telefone"), `TELEFONES_A_MAIS` (a célula tinha mais de 3 números; os outros não entraram) e `CPF_DE_OUTRO_CADASTRO` (o CPF é de outra pessoa; o cadastro novo entrou sem ele);
  - v0.3: `de` vem com até 120 caracteres; `EMAIL_INVALIDO` agora também pega `Nome <x@y.com>` (a mesma regra da ficha), e nome do animal passa de 80 caracteres vira `NOME_CORTADO`, pelagem acima de 60 e alergia acima de 200 viram `TEXTO_LONGO` (os tetos da ficha);
  - não entra: `ANIMAL_SEM_RESPONSAVEL`, `ANIMAL_SEM_NOME`, `ESPECIE_DESCONHECIDA`, `RESPONSAVEL_SEM_NOME`, `ANIMAL_FALECIDO`, `DEIXADA_DE_FORA`, `ALVO_INDISPONIVEL` (o cadastro a juntar foi apagado a pedido do titular) e `LINHA_EM_BRANCO`;
  - aviso: `SEM_CONTATO`. Junção: `JUNTOU_POR_CPF`, `JUNTOU_POR_TELEFONE`, `JUNTOU_POR_NOME`, `JUNTOU_AO_PACIENTE`. Onde a planilha discorda do cadastro (fica o do cadastro): `DIVERGE_RACA`, `DIVERGE_SEXO`, `DIVERGE_NASCIMENTO`, `DIVERGE_PESO`, `DIVERGE_MICROCHIP`, `DIVERGE_PELAGEM`, `DIVERGE_TELEFONE`, `DIVERGE_EMAIL`, `DIVERGE_CPF`.
- **30 dias depois do fim (D7):** `ajustes`, `responsavel` e `animal` voltam vazios (`dadosApagadosEm` preenchido no status). Ficam o destino e os códigos.
- **"Baixar as linhas que não entraram"** continua no portal, a partir do arquivo na memória. Se a página foi recarregada, ofereça só o número da linha e o motivo.

### 4.6 Desfazer

- `POST /parceiro/portal/importacoes/:id/desfazer` (de `CONCLUIDA`, `PAUSADA`, `FALHOU`, `CANCELADA` com algo gravado, ou `DESFEITA` para rodar de novo). Vira `DESFAZENDO`, um job em lotes; acompanhe pelo `GET .../:id` até `DESFEITA` (`desfazer`: `pacientesRemovidos`, `clientesRemovidos`, `preenchimentosDesfeitos`, `ficaram`, `propostasCanceladas`).
- **v0.3:** com o lote de propostas no ar (seção 4.7), o desfazer responde **409 `IMPORTACAO_OCUPADA`**: "As propostas de vínculo ainda estão saindo. Tente desfazer em instantes." Ao começar, o desfazer **cancela as propostas de vínculo pendentes** desta importação (`propostasCanceladas`): o link que já foi por e-mail deixa de valer (o app mostra "convite não encontrado"). Diga isso na confirmação.
- **v0.3:** se o desfazer falhar 5 vezes seguidas, a importação para em `FALHOU` com `ultimoErro` começando por `DESFAZER_`; o "continuar" retoma o **desfazer** de onde parou (não volta a gravar). Texto: "O desfazer parou. Tente continuar."
- **O que sai:** o paciente e o cliente que a importação criou e ninguém usou nem editou depois. O que a importação preencheu num cadastro que já existia volta a branco, se ninguém mexeu nele depois.
- **O que fica**, com o porquê no relatório (`?desfecho=`):
  - `FICOU_REGISTRO_POSTERIOR`: agendamento, vacina ou outro registro clínico;
  - `FICOU_VINCULO`: vínculo com o app, ou proposta que a pessoa já respondeu (ou criada depois que o desfazer começou); proposta cancelada, recusada ou vencida não segura mais nada (v0.3);
  - `FICOU_EDITADO`: alguém mexeu no cadastro depois;
  - `FICOU_CLIENTE_EM_USO`: o cliente ficou porque um paciente dele ficou, ou porque tem pessoa autorizada ou pedido de correção.
- **Confirmação sugerida:** "Desfazer esta importação? Saem os cadastros que ela criou e que ninguém usou ainda. O que já tem agendamento, vacina, vínculo com o app ou foi editado fica, e a lista mostra por quê."

### 4.7 Propor vínculos em lote

- `POST /parceiro/portal/importacoes/:id/propor-vinculos` (só `CONCLUIDA`): propõe vínculo pelo e-mail do cadastro (seção 2.1) a cada cliente desta importação, com os pacientes dela.
- Resposta `{ propostas, semEmail, jaPropostos, emailRepetido, semPaciente, paraDepois, pelaFicha, clientesPelaFicha }`. A regra é a da E2-02: o link vai só ao e-mail do cadastro, a resposta é igual com ou sem conta no app, e o teto é de 50 propostas por clínica por dia. Com `paraDepois` maior que zero: "O limite de hoje acabou. Amanhã você pode mandar para os outros {n}."
- Quem já teve proposta desta clínica não recebe de novo, nem pelo cliente nem pelo e-mail; o mesmo e-mail em dois clientes do lote recebe uma vez só (`emailRepetido`, v0.3). Clique duplo: 409 `IMPORTACAO_OCUPADA`.
- **v0.3, o que o lote deixa de propor:** só entram os animais **que esta importação criou**. Ficam de fora, listados em `clientesPelaFicha` (até 100; a contagem toda em `pelaFicha`), para a clínica conferir e propor pela ficha (seção 2.1):
  - `PACIENTE_JA_EXISTIA`: o animal já era paciente antes da importação (a junção pode ter sido com outra pessoa);
  - `EMAIL_PREENCHIDO_NA_IMPORTACAO`: o e-mail do cliente veio desta planilha, não do cadastro que a clínica já conhecia.
  - Texto sugerido: "{n} clientes ficaram de fora porque o animal já era paciente ou o e-mail veio da planilha. Confira na ficha antes de convidar." com o link para cada ficha.

### 4.8 Descartar e histórico

- **Descartar** antes de importar: `POST .../:id/descartar` (nada foi gravado; as linhas saem do servidor).
- **Histórico:** `GET /parceiro/portal/importacoes?limite=10&cursor=` (o último ano, a mais nova primeiro).
- **Sozinha:** a importação que não foi confirmada em 7 dias é descartada; a que ficou pausada 30 dias é cancelada (o que foi gravado fica, e o desfazer continua valendo).
- **Pronto quando:** o fluxo inteiro (subir, dúvidas, resumo, importar com pausa, relatório, desfazer, propor) roda contra a API de dev sem o mock.

## 5. A clínica lê o app com consentimento (E2-03)

Spec: `docs/specs/2026/q4/q4-1/portal-parceiro/e2-pacientes-e-ponte/03-leitura-do-app-pela-clinica.md`, seção "Decisões do gerente (2026-10-27)". Pronta em dev em 2026-10-27, aguardando auditoria; **não está em produção**. Substitui no portal o mock do "Este pet em 30 segundos" (`features/clinico/domain/resumo-do-paciente.ts`) e o `DiarioParaClinica` de `contrato/responsavel.ts`.

### 5.1 Quem lê e o que muda no contrato

- Módulo Clínica e `prontuario.ler`: VETERINARIO e ENFERMAGEM (sem exigir CRMV), e o DONO. RECEPCAO, GESTOR e FINANCEIRO: 403 `SEM_PERMISSAO`. Esconda as abas para quem não tem `prontuario.ler` (o `GET /parceiro/portal/eu` diz as permissões).
- Tudo pelo **`pacienteId` da clínica**. Nenhuma resposta traz `petId`, `tutorId`, id do app, e-mail ou URL pública de foto. A rota antiga do contrato do portal (`/pacientes/:petId/diario`) não existe.
- **Recusas iguais nas 5 rotas:**
  - paciente de outra clínica ou inexistente: 403 sem `codigo` (o mesmo corpo para os dois);
  - sem vínculo ativo (proposta pendente, encerrado, pet transferido, conta do dono em exclusão, paciente mesclado ou com óbito): 403 `PET_SEM_ACESSO`. Mostre "Sem ligação ativa com o app" e o caminho para propor de novo (seção 2.1);
  - chave desligada: 403 `SEM_CONSENTIMENTO` com `chave` (`diarioCompleto` ou `peso`). Mostre "O responsável ainda não liberou" com o nome da chave, sem botão;
  - mais de 600 leituras por pessoa ou 3.000 por clínica numa hora: 429 `LEITURA_APP_TAXA_EXCEDIDA` com `tenteDeNovoEmSegundos`.
- Toda resposta vem com `Cache-Control: no-store`. **Não guarde em cache no portal** (nem React Query com `staleTime` longo): o responsável pode desligar a qualquer momento e a próxima leitura já é recusada.
- Cada leitura que deu certo fica na trilha (`LER_DADO_DO_APP`) e o responsável vê em "Quem viu". Na trilha do portal (seção 5 do e1), os eventos **não trazem mais `petId`**.

### 5.2 Diário

- `GET /parceiro/portal/pacientes/:pacienteId/app/diario?desde=AAAA-MM-DD` responde `{ desde, ate, entradas, truncado, motivo }`.
  - Sem `desde`: desde o dia do último atendimento finalizado **nesta** clínica; sem nenhum, 30 dias. Até amanhã no fuso da clínica.
  - `desde` no futuro ou antes de 90 dias: 400 `LEITURA_APP_PERIODO_INVALIDO` com `minimo` e `maximo`. Use os dois no seletor de data.
  - `entradas` (mais recente primeiro, até 500 e 256 KB; `truncado: true` quando havia mais): `id` (opaco, só para a chave da lista), `data`, os campos do diário **em enum cru** (`vitalidade`, `alimentacao`, `hidratacao`, `fezes`, `urina`, `sintomas[]`, `doencas[]`, `cicloCio`, `temperamento[]`) com os textos "Outro" (`vitalidadeOutra`, `alimentacaoOutra`, `hidratacaoOutra`, `fezesOutro`, `urinaOutro`, `sintomasOutros`, `doencasOutras`, `temperamentoOutro`), `observacoes`, `remedios`, `nota` e `fotoIds[]`.
  - `nota` só vem com a chave `notas` ligada; senão é `null`.
  - **O portal rotula:** os rótulos dos enums são do portal (a API não traduz).
  - Texto livre sai como o responsável escreveu, HTML inclusive: **renderize como texto**, nunca como HTML.
  - `motivo: 'SEM_DIARIO'` (com `entradas: []`): o plano do dono do pet não tem diário. Mostre "O responsável não usa o diário no plano atual", sem botão.

### 5.3 Peso de casa

- `GET .../app/pesos?desde=` responde `{ desde, ate, pesos: [{ id, data, pesoKg }], truncado }`.
  - Só o peso que o responsável registrou em casa (nem o que a clínica publicou, nem o de anotação de prestador).
  - Sem `desde`: 180 dias (a janela em que o resumo calcula a perda). Teto de 180.
  - Exige a chave `peso`.

### 5.4 Carteirinha

- `GET .../app/carteirinha` responde `{ vacinas, alergias, diagnosticos, tratamentos }`. Basta o vínculo ativo (nenhuma chave).
  - `vacinas`: todas as do app, mais recente primeiro, com `nome`, `aplicadaEm`, `origem`, `fabricante`, `dose`; `lote` e `clinicaNome` só quando veio de clínica; `daClinica: true` quando foi esta. Sem nome nem CRMV de profissional de outra clínica.
  - `alergias` e `diagnosticos` ativos; `tratamentos` contínuos em uso (com dose, unidade, frequência, via, motivo, início e fim).
  - `truncado: true`: passou de 200 itens numa lista ou de 512 KB no total, e o resto ficou de fora. Mostre "lista resumida" no fim.

### 5.5 Foto do diário

- `GET .../app/fotos/:fotoId/url` responde `{ url, expiraEm, motivo }`.
  - `url`: link de 15 minutos de uma cópia **sem metadados** (sem GPS) no armazenamento privado da clínica. Peça a URL na hora de abrir a foto; não guarde. Venceu: peça de novo.
  - `url: null` com `motivo: 'FORMATO_NAO_SUPORTADO'`: foto em HEIC (ou que não abre). Mostre "Esta foto está num formato que o portal não abre". O original não é entregue (levaria a localização da casa).
  - `url: null` com `motivo: 'ARQUIVO_INDISPONIVEL'`: registro antigo sem o arquivo. Mostre "Foto indisponível".
  - A foto tem de ser de uma entrada do pet nos últimos 90 dias; senão 403 (o mesmo de foto inexistente).
  - Armazenamento fora: 503 `LEITURA_APP_FOTO_INDISPONIVEL` ("Não foi possível abrir a foto agora. Tente de novo em alguns minutos.").
  - O responsável desligou o diário (ou encerrou o vínculo) no meio do pedido: 403 `SEM_CONSENTIMENTO` (ou `PET_SEM_ACESSO`), como na seção 5.1.
  - Exige a chave `diarioCompleto`.

### 5.6 "Este pet em 30 segundos"

- `GET /parceiro/portal/pacientes/:pacienteId/resumo` responde `ResumoDoPacienteDto` e **sempre 200** com vínculo ativo, mesmo sem nada liberado:
  - `naoLiberado: ('diario' | 'peso')[]`: chaves desligadas. Mostre "não liberado pelo responsável" no lugar do bloco.
  - `naoDisponivel: ['adesao']` e `adesao: null`: a adesão ao tratamento (E4-05) ainda não existe. Esconda o bloco.
  - `primeiraVez`, `ultimaConsulta { agendamentoId, em }` (o último atendimento finalizado nesta clínica) e `diasDesdeUltima`.
  - `sinais[]`, risco primeiro. `tipo` e `severidade` (`risco` ou `atencao`) sempre; o resto por tipo:
    - `perda-de-peso`: `variacao { deKg, paraKg, percentual, semanas, continua }`;
    - `alarme`: `achados [{ campo, valor }]` (enum cru), `em`, `relato` (os "outros sintomas") e `texto` (as observações; a nota só com a chave `notas`);
    - `sintoma-recorrente`: `sintoma`, `vezes`;
    - `campo-alterado`: `campo`, `predominante`, `alterados`, `total`;
    - `polifarmacia`: `total`.
  - `diario`: `liberado`, `motivo` (`SEM_CONSENTIMENTO` ou `SEM_DIARIO`), `desde`, `ate`, `total`, `semAlteracao` ("84 sem alteração"), `campos[]` (contagem por campo, com `ultimo`), `sintomas[]`, `doencas[]`, `falas[]` (até 3; vazio sem a chave `notas`) e `peso` (de casa na janela).
  - `peso`: `serie [{ em, pesoKg, origem: 'clinica' | 'casa' }]` (180 dias; `clinica` é só esta clínica) e `variacao`.
  - `medicacoes[]` (tratamentos contínuos, um por remédio) e `carteirinha` (a mesma da 5.4).
- O resumo devolve **códigos**, não frases: a copy dos sinais é do portal (o mock já tem). As regras são as do mock (`resumo-do-paciente.ts`), portadas para a API com os mesmos limites.
- **Pronto quando:** a ficha do paciente mostra o resumo, o diário, o peso e a carteirinha lendo a API (sem o mock), com os estados "não liberado", "sem diário no plano" e "sem ligação com o app", e a foto abre pela URL de 15 minutos.

### 5.7 App

- **Diário: mande JPEG.** O app novo envia a foto do diário em JPEG (o portal não abre HEIC, e a API não converte). Foto HEIC de build antiga continua aceita, mas a clínica não a recebe.
- **"Quem viu"** (seção 2.4): mostra só o que a clínica fez a partir do primeiro aceite **desta conta** com a clínica; quem recebeu o pet por transferência não vê as leituras do dono anterior. Tipos novos de `recursoTipo`: `diario-do-app`, `peso-do-app`, `carteirinha-do-app`, `foto-do-app`, `resumo-do-paciente` (rótulos sugeridos: "Diário", "Peso", "Carteirinha", "Foto do diário", "Resumo do pet").
- **Peso:** `POST /peso-registro` com o campo `origem` no corpo dá 400. Não mande: a API grava o peso do app como de casa.
- **Uploads (base de upload, 2026-10-27):** foto de pet (`/upload/file-pet`) aceita JPEG, PNG e WEBP; avatar (`/upload/file-usuario`) também GIF; Documentos aceita PDF e imagem (JPEG, PNG, WEBP, HEIC). O tipo é lido do conteúdo do arquivo: outro formato (inclusive PDF com outro arquivo colado) dá 400 `UPLOAD_TIPO_NAO_PERMITIDO` com `permitidos`; imagem que não abre, 400 `UPLOAD_IMAGEM_ILEGIVEL`; acima de 50 megapixels, 400 `UPLOAD_IMAGEM_GRANDE_DEMAIS`; servidor ocupado regravando imagens (ou muitas da mesma pessoa ao mesmo tempo), 503 `UPLOAD_PROCESSAMENTO_OCUPADO` com `Retry-After`: espere e mande de novo. Toda imagem é gravada sem os dados de localização da câmera.
- **Alergia e diagnóstico:** `gatilho` até 500 caracteres; `reacao` e `observacoes` da alergia e `observacoes` do diagnóstico até 2000. Acima disso, 400. Ponha o mesmo limite no campo.
- **Sem tipo de notificação novo** nesta spec.

## 6. Correção do G5 (29/10): a exclusão do titular e o hotel

- `POST /parceiro/portal/clientes/:id/anonimizar`: com o módulo do hotel só para consulta, a reserva viva paga é cancelada pelo sistema (motivo `EXCLUSAO_DO_TITULAR`) em vez de travar o pedido. A resposta ganha `comPagamento` e `reservasAjustadas` (ids). Rótulos e aviso em `portal-parceiro-e7.md`, seção 45.
- Inativar com `OBITO` um animal hospedado não dá mais 409: a estadia dele é encerrada pelo sistema.
