# Guia do front: Portal do parceiro, E2 (clientes, pacientes e a ponte com o app)

**Para:** o Luís. Portal web do parceiro (`petjourney-admin`) e, a partir da E2-02, o app (`petjourney-app`).
**Backend:** E2-01 pronta e validada em dev em 2026-10-21 (unit e integração contra o Postgres de dev; o smoke por HTTP roda no gate da onda 1). **Não está em produção.**
**Specs de origem:**
- `docs/specs/2026/q4/q4-1/portal-parceiro/e2-pacientes-e-ponte/01-clientes-e-pacientes.md` (v0.3)
- `docs/specs/2026/q4/q4-1/portal-parceiro/e2-pacientes-e-ponte/02-vinculo-e-consentimento.md` (v0.2)

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
- **Resposta:** `{ resultado, protocolo }`.
  - `EXCLUIDO`: sem registro clínico, o cliente e os pacientes saíram de vez.
  - `ANONIMIZADO`: o prontuário fica. Os dados pessoais do cliente e os autorizados saem, e os pacientes ficam inativos.
- O `protocolo` (`LGP-AAAA-NNNNNN`) é o comprovante para o titular: mostre e permita copiar.
- Funciona também com o módulo só de consulta (suspenso, desligado, vencido): o pedido do titular não espera a clínica reativar.
- Os clientes que já foram mesclados neste também são anonimizados.
- Peça confirmação dupla: não tem volta.
- Cliente anonimizado vem com `nome: 'Anonimizado'` e `anonimizadoEm` preenchido. Mostre um rótulo traduzido pelo `anonimizadoEm`, não o nome cru.

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

- **Ver:** `GET /parceiro/portal/pacientes/:id/vinculo` devolve `null` ou `{ id, petId, origem, ativadoEm, consentimento: { diarioCompleto, peso, notas } }`.
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
