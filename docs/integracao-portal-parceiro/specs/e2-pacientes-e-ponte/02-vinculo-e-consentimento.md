# Spec: Vínculo entre paciente da clínica e pet do app, com consentimento

**Status:** Concluído (API em dev, 2026-10-21; front em novembro com o Luís)
**Autor:** Nicolas (via Claude)
**Criado em:** 2026-10-20
**Versão:** 0.4
**Épico:** [E2 pacientes e ponte](../../../../../epicos/portal-parceiro-e2-pacientes-e-ponte.md)
**Depende de:** [E2-01 clientes e pacientes](01-clientes-e-pacientes.md), [E1-06 avisos](../e1-fundacao/06-avisos-ao-parceiro-e-pendencias.md)

---

## Visão Geral

O `VinculoPacientePet` liga um `PacienteDoParceiro` a um `Pet` do app, com um responsável que aceitou. Esta spec define:
- como o vínculo nasce (pedido pelo app, proposta da clínica com prova de posse, acesso temporário, QR da carteirinha);
- a resposta pet a pet (ligar, criar no app, "não é meu");
- o consentimento de leitura por clínica;
- o encerramento e o bloqueio de propostas;
- a tela "Minhas clínicas" do lado do responsável.

## Motivação

É a peça que substitui o legado `ClinicasPacientes` e o `Pet.vetResponsavelId` removido (D4 do épico de saúde). O portal já desenhou o fluxo: `VinculoProposto`, `ResponderVinculo`, `PedirCorrecaoAClinica`, `ROTAS_DO_VINCULO` e `ClinicaDoResponsavel` (`petjourney-admin/src/features/clinico/contrato/responsavel.ts:446-505` e `:1295-1402`), mais o passo a passo para o app nos docs 09 (seção 7) e 12.

---

## Research Findings

- **Contrato do portal (lido):**
  - A proposta é por pessoa e lista vários pets.
  - O dado da clínica vem mascarado (`(11) 9••••-1030`), porque "quem abre o convite ainda não provou ser quem a clínica acha que é".
  - A resposta exige uma ação por pet (`VINCULO_INCOMPLETO` se faltar).
  - O consentimento nasce todo `false`.
  - O responsável não edita o cadastro da clínica: pede correção.
  - Só o dono do pet muda o consentimento (`podeAlterarConsentimento`).
- **Na API:**
  - O cadastro **não verifica** e-mail nem CPF (memória `project-ambientes-docs-e-signup-aberto`). Logo, CPF ou e-mail iguais não provam que a conta é da pessoa que a clínica cadastrou.
  - Modelo de consentimento e escopo vivo de referência: família (`EscopoAcessoPet`, `DelegacaoPet`, `prisma/schema.prisma:2285-2408`) e a trilha `MudancaConsentimentoCompartilhamento` (`:2157-2184`).
  - O acesso temporário tem dono provado: `criadoPorUsuarioId` (`:1869`) e claim do parceiro (Parte 8).
  - Carteirinha pública por `Pet.publicSlug`, camada 1 só identifica (`src/public-pet/public-pet.controller.ts:62-65`).
  - Código de 6 dígitos: `PublicCodeService` (`src/common/public-code/public-code.service.ts:29`).
  - Limite de pets por plano (spec `freemium-expiracao-limite-pets`, memória): o CRIAR precisa respeitar.

**Breaking changes:** nenhuma.

## Decisões

- **D1 Prova de posse antes de mostrar qualquer pet.** Uma proposta só se liga a uma conta por um destes canais:
  - (a) **link com token** enviado ao e-mail que está no `ClienteDoParceiro`;
  - (b) **código de 6 dígitos** mostrado ou impresso no balcão e digitado no app;
  - (c) **acesso temporário** que o próprio responsável criou e que a clínica reivindicou;
  - (d) **QR da carteirinha**: a clínica lê o `publicSlug` e a proposta vai para o dono do pet pela inbox, sem a clínica saber quem é.

  CPF igual nunca entrega proposta sozinho.
- **D2 Pedido pelo app ativa direto.** O pedido de horário feito no app (E3-05) e o pedido de reserva no hotel (E7-03) criam o vínculo ATIVO no aceite da clínica: o responsável escolheu a clínica e o pet, e a tela do pedido avisa. Vale como caminho (e) com prova implícita.
- **D3 Consentimento por clínica e responsável.** `ConsentimentoDoResponsavel (parceiroId, tutorId)` com `diarioCompleto`, `peso`, `notas`, todos `false` por padrão; vale para todos os pets daquele responsável vinculados àquela clínica. O compartilhamento de adesão é por tratamento (E4-05). Toda mudança gera linha em `MudancaConsentimentoVinculo`.
- **D4 Quem decide.** Só o dono do pet aceita proposta, muda consentimento e encerra. Membro de família com LEITURA ou mais vê "Minhas clínicas" e recebe as notificações com `paraMembro: true` (padrão do `LEMBRETE_VENCIDO`).
- **D5 Um ATIVO por par.** No máximo um vínculo ATIVO por `(parceiroId, petId)` e por `(parceiroId, pacienteId)`, por índice único parcial (`WHERE status = 'ATIVO'`, SQL cru na migration).
- **D6 Encerrar não apaga.** Encerrado, a leitura para na hora e a publicação para. O que já foi publicado fica no app. Óbito do paciente encerra pelo sistema, sem notificação (P5 do épico pai).
- **D7 Bloquear clínica.** O responsável pode bloquear propostas de uma clínica; propostas novas dela para ele morrem sem aviso, e a clínica vê só "não respondida".

### Decidido na implementação (v0.2)

- **V1 Código de balcão único entre as pendentes, no país inteiro** (índice parcial `WHERE status = 'PENDENTE'`), não por parceiro. O resgate acha a proposta só pelo código, e o `parceiroSlug` deixou de ser necessário. Expirada, cancelada ou respondida libera o número.
- **V2 QR exige `pacienteId`.** A clínica cadastra o paciente antes de ler o QR. Criar o paciente a partir do pet do app revelaria dado do app antes do consentimento.
- **V3 Acesso temporário sem `pacienteId`** cria cliente e paciente pelo cabeçalho do acesso (nome, espécie, castração do pet). O cliente fica com o nome provisório "Responsável de {pet}"; o responsável corrige pela correção.
- **V4 Proposta que não chega a ninguém** (QR de pet inexistente ou inativo, pet já vinculado, dono que bloqueou) é gravada PENDENTE sem destino e vence sozinha. A clínica vê só "não respondida", igual a uma ignorada.
- **V5 Resgate:** toda tentativa (certa ou errada) conta, 5 por hora por conta (`TaxaService`), mais `@Throttle` de 10 por minuto por IP. Passou do teto: 429 `RESGATE_TENTATIVAS_EXCEDIDAS`, sem nem procurar a proposta. Dois resgates simultâneos do mesmo link: só um grava (update condicional), e o outro dá 409.
- **V6 Bloqueio (D7)** também recusa as pendentes dessa clínica já entregues à pessoa. O resgate, que é ato da própria pessoa, não é barrado pelo bloqueio.
- **V7 Limite do plano** usa o erro que o app já trata: 403 `LIMITE_PETS_PLANO`, e não um 409 `LIMITE_DE_PETS` novo. O limite é conferido para todos os CRIAR antes de criar o primeiro. Os pets nascem pelo `PetService` (carteirinha, QR, trava do tutor) antes da transação dos vínculos; se ela falhar, os pets criados ficam no app da pessoa e a proposta segue pendente.
- **V8 Copy fixa nas notificações:**
  - `VINCULO_PROPOSTO` não leva o nome da clínica, que o DONO dela troca depois de aprovado e viraria phishing no push (mesma razão do convite da E1-06). O nome aparece na tela da proposta;
  - os dois da equipe não levam nome de responsável nem de pet.
- **V9 E-mail da proposta** sem nome de pet nem de pessoa: se a clínica errou o endereço, um estranho não fica sabendo quais animais. Link `https://petjourney.health/clinica/vinculo/<token>` (raiz, regra dos deep links; `VINCULO_CLINICO_BASE_URL`), sem click tracking. Só o hash do token vai ao banco.
- **V10 O sistema encerra o vínculo** (`encerrarVinculosPeloSistema`, sem notificação):
  - no óbito do paciente;
  - na anonimização do cliente;
  - na mescla, quando o paciente que fica já tem vínculo ativo. Sem isso, o vínculo do duplicado vai junto (registro `HISTORICOS_DO_PACIENTE` da E2-01).
- **V11 Expurgo LGPD** na exclusão definitiva da conta:
  - os vínculos caem em cascata com os pets;
  - consentimento, histórico de consentimento, bloqueios e pedidos de correção são apagados;
  - a proposta fica com a clínica, sem o elo com a conta, e a pendente é cancelada.
- **V12 "Minhas clínicas"** agrupa por (clínica, dono) e traz o `tutorId` do dono. A família entra por `OwnershipService.podeLerPetPelaFamilia` (Parte 6), só leitura.
- **V13 Pedido de correção:** até 3 por proposta, com `propostaId` e `usuarioId`.

### Revisão de segurança (v0.3, 2026-10-21)

A segunda rodada do `security-auditor` achou 2 ALTOS, 5 MÉDIOS e alguns BAIXOS. Todos foram corrigidos e estão registrados em `qa/seguranca/achados.json`, cada um com cenário em `qa/cenarios/portal-parceiro.json`.

- **V14 Código de balcão com 8 caracteres** (substitui os 6 dígitos da V1; ALTO `SEG-2026-10-21-VINCULO-CODIGO-ADIVINHAVEL`).
  - **Problema:** o código vale no país inteiro, e o cadastro não verifica e-mail. Com várias contas e IPv6 trocado, dava para acertar um código vivo de outra clínica.
  - **Formato:** alfabeto sem os caracteres que se confundem (0/O, 1/I/L e U), 30^8 ≈ 6,6 x 10^11 combinações. O resgate aceita minúsculas, espaço e hífen (`k7mq-x3pa`), e o formato antigo nem chega ao banco.
  - **Defesa:** além das 5 tentativas por conta por hora, há um balde por origem (IPv4 ou /64) no banco, `@ThrottlePublico('vinculo-resgate', 30/h)`.
  - **Por que não o slug:** manter a V1 (sem `parceiroSlug`) evita um passo a mais no balcão.
- **V15 Pelo código, tudo que não liga dá o mesmo 404** (inexistente, vencido ou resgatado por outra conta). Pelo link, que não se adivinha (32 bytes), vencido continua 410 e outra conta, 409.
- **V16 CRIAR não copia o microchip.** Quem responde ainda não provou que o animal é dele, e o número identifica o animal fora do app. O microchip fica só no cadastro da clínica.
- **V17 Proposta pelo acesso temporário** (MÉDIO `SEG-2026-10-21-VINCULO-ACESSO-REVOGADO`):
  - só com o acesso valendo (`ATIVO`, sem `revogadoEm` e com `expiraEm` no futuro); revogado ou vencido dá 404;
  - uma pendente por acesso: chamar de novo devolve a mesma `propostaId`, sem cadastro nem aviso novo.
- **V18 Pendentes não sobrevivem ao cadastro** (MÉDIO `SEG-2026-10-21-VINCULO-PENDENTE-SOBREVIVE`):
  - `cancelarPropostasPendentes` roda na mesma transação de inativar (inclusive óbito), mesclar paciente, mesclar cliente e anonimizar;
  - `responder` conta, dentro da transação travada, os pacientes ativos, sem óbito, sem mescla e de cliente não anonimizado. Faltou algum: 409 `PACIENTE_INATIVO`.
- **V19 Anonimizar apaga os pedidos de correção** do cliente e dos mesclados nele (MÉDIO `SEG-2026-10-21-ANONIMIZAR-PEDIDO-CORRECAO`): o texto é do titular.
- **V20 Bloqueio (corrige a V6 para cumprir a D7):** as pendentes entregues viram RECUSADA com motivo `BLOQUEIO`. A lista da clínica mostra `PENDENTE` (ou `EXPIRADA` depois do prazo), sem `respondidaEm` nem motivo.
- **V21 Baixos:**
  - o aviso ao dono no QR e no acesso sai sem `await`, para o tempo da resposta não revelar se o pet existe;
  - "Minhas clínicas" mostra também o vínculo de pet inativo, que continua recebendo publicação (D6), para o dono poder encerrar;
  - o assunto do e-mail da proposta não leva o nome da clínica (o nome é editável por quem escolhe o destinatário). O corpo leva o nome escapado, com até 80 caracteres.
  - Fica com o site (Luís): a página `/clinica/vinculo/<token>` precisa de `Referrer-Policy: no-referrer` e não pode carregar analytics. Está no handoff da E2.

## Modelo de dados (aditivo)

```prisma
enum StatusVinculo { ATIVO ENCERRADO }
enum OrigemVinculo { PEDIDO_APP PROPOSTA_EMAIL PROPOSTA_CODIGO ACESSO_TEMPORARIO QR_CARTEIRINHA }
enum StatusProposta { PENDENTE RESPONDIDA RECUSADA EXPIRADA CANCELADA }
enum AcaoNoPet { LIGAR CRIAR NAO_E_MEU }
enum QuemEncerrou { RESPONSAVEL PARCEIRO SISTEMA }

model VinculoPacientePet {
  id               String        @id @default(cuid())
  parceiroId       String
  pacienteId       String
  petId            String
  tutorId          String        // dono que aceitou
  status           StatusVinculo @default(ATIVO)
  origem           OrigemVinculo
  propostaId       String?
  ativadoEm        DateTime      @default(now())
  encerradoEm      DateTime?
  encerradoPor     QuemEncerrou?
  motivoEncerramento String?
  pet              Pet           @relation(fields: [petId], references: [id], onDelete: Cascade)
  @@index([parceiroId, status])
  @@index([petId, status])
  // + índices únicos parciais da D5 no SQL da migration
}

model PropostaDeVinculo {
  id               String         @id @default(cuid())
  parceiroId       String
  clienteId        String
  canal            OrigemVinculo  // PROPOSTA_EMAIL, PROPOSTA_CODIGO, ACESSO_TEMPORARIO, QR_CARTEIRINHA
  status           StatusProposta @default(PENDENTE)
  tokenHash        String?        @unique // link do e-mail
  codigo           String?        // 6 dígitos, balcão
  usuarioDestinoId String?        // preenchido quando a posse é provada (resgate, acesso, QR)
  petDestinoId     String?        // QR: o pet lido
  compartilhamentoId String?      // acesso temporário de origem
  expiraEm         DateTime
  criadaPorId      String
  respondidaEm     DateTime?
  motivoRecusa     String?        // NAO_SOU_EU | NAO_QUERO_VINCULO
  pets             PropostaDeVinculoPet[]
  @@index([parceiroId, status])
  @@index([usuarioDestinoId, status])
  @@unique([parceiroId, codigo])
}

model PropostaDeVinculoPet {
  propostaId String
  pacienteId String
  acao       AcaoNoPet?
  petId      String?
  @@id([propostaId, pacienteId])
}

model ConsentimentoDoResponsavel {
  parceiroId     String
  tutorId        String
  diarioCompleto Boolean  @default(false)
  peso           Boolean  @default(false)
  notas          Boolean  @default(false)
  atualizadoEm   DateTime @updatedAt
  @@id([parceiroId, tutorId])
}

model MudancaConsentimentoVinculo {
  id           String   @id @default(cuid())
  parceiroId   String
  tutorId      String
  campo        String   // diarioCompleto | peso | notas
  de           Boolean
  para         Boolean
  em           DateTime @default(now())
  porUsuarioId String
}

model BloqueioDePropostas {
  usuarioId  String
  parceiroId String
  criadoEm   DateTime @default(now())
  @@id([usuarioId, parceiroId])
}

model PedidoDeCorrecao {
  id          String    @id @default(cuid())
  parceiroId  String
  clienteId   String
  mensagem    String    // até 500
  criadoEm    DateTime  @default(now())
  resolvidoEm DateTime?
}
```

## Rotas

**Parceiro** (`@ExigeModulo`, `@ExigePermissao('paciente.escrever')` nas escritas):

| Método e rota | Descrição |
|---|---|
| `POST /parceiro/portal/clientes/:clienteId/propostas-de-vinculo` | `{ pacienteIds[], canal: 'EMAIL' \| 'CODIGO' }`. EMAIL exige `cliente.email` e envia o link; CODIGO devolve `{ codigo, expiraEm }` (72 h) para mostrar ou imprimir. Resposta igual com ou sem conta no app. Teto: 50 propostas por parceiro por dia |
| `GET /parceiro/portal/clientes/:clienteId/propostas-de-vinculo` | Lista com status |
| `DELETE /parceiro/portal/propostas-de-vinculo/:id` | Cancela pendente |
| `POST /parceiro/portal/compartilhamentos/:id/propor-vinculo` | Do acesso temporário reivindicado por este parceiro: cria (ou acha) o paciente a partir do header do acesso e propõe ao criador do acesso pela inbox |
| `POST /parceiro/portal/vinculos/por-qr` | `{ publicSlug, pacienteId? }`: propõe ao dono do pet lido, pela inbox; a clínica só recebe `{ propostaId }`. Teto: 30 por dia, `@Throttle` 10/min |
| `GET /parceiro/portal/pacientes/:id/vinculo` | Vínculo ativo, origem, desde quando, e o consentimento atual (só as chaves) |
| `POST /parceiro/portal/pacientes/:id/vinculo/encerrar` | `{ motivo }` |
| `GET /parceiro/portal/pedidos-de-correcao` + `POST .../:id/resolver` | Caixa de correções pedidas pelo responsável |

**Responsável** (JWT; dono do pet, família só leitura):

| Método e rota | Descrição |
|---|---|
| `POST /tutor/clinica/vinculos-propostos/resgatar` | `{ token }` (link) ou `{ codigo, parceiroSlug? }` (balcão): liga a proposta à conta logada. Código errado conta tentativa (`MAX_TENTATIVAS`, padrão do `PublicCodeService`) |
| `GET /tutor/clinica/vinculos-propostos` | Pendentes já resgatadas ou entregues pela inbox (acesso, QR). `VinculoProposto` com dado mascarado e `sugestaoDoApp` por pet (mesmo nome e espécie, sem vínculo com a clínica) |
| `GET /tutor/clinica/vinculos-propostos/:id` | Detalhe; 410 `VINCULO_EXPIRADO` |
| `POST /tutor/clinica/vinculos-propostos/:id/responder` | `ResponderVinculo` (uma ação por pet, `consentimento?`). 422 `VINCULO_INCOMPLETO`; 409 `LIMITE_DE_PETS` no CRIAR acima do plano; 409 `ESPECIE_DIFERENTE` no LIGAR |
| `POST /tutor/clinica/vinculos-propostos/:id/recusar` | `{ motivo }` |
| `POST /tutor/clinica/vinculos-propostos/:id/correcao` | `{ mensagem }` (até 500) |
| `GET /tutor/clinica/clinicas` | `ClinicaDoResponsavel[]`: clínicas com vínculo ativo, `petIds`, contato, política, consentimento, `podeAlterarConsentimento` |
| `PUT /tutor/clinica/clinicas/:parceiroId/consentimento` | `{ diarioCompleto?, peso?, notas? }` (dono) |
| `POST /tutor/clinica/clinicas/:parceiroId/encerrar` | `{ petId? }` (um pet ou todos) |
| `POST /tutor/clinica/clinicas/:parceiroId/bloquear` e `DELETE .../bloquear` | D7 |

**CRIAR no app:** cria `Pet` do responsável com nome, espécie (e `OtherInfo.tipoEspecie` de `especieOutra`), sexo, nascimento, raça e castração nas sub-infos, porte do cão convertido (`MINI`/`PEQUENO`→`PEQUENO`, `MEDIO`→`MEDIO`, `GRANDE`/`GIGANTE`→`GRANDE`), pelo serviço de criação de pet que já aplica o limite do plano.

**Notificações novas:**
- `VINCULO_PROPOSTO` (responsável, CLINICO): só nos canais (c) e (d) e depois do resgate.
- `VINCULO_RESPONDIDO` e `VINCULO_ENCERRADO_PELO_RESPONSAVEL` (equipe com `paciente.escrever`, PARCEIRO).
- E-mail da proposta (link) nos 6 locales.

## Acceptance Criteria

### Comportamentais
- [x] **Given** uma conta com o mesmo CPF do cliente da clínica e sem resgate **When** chama `GET .../vinculos-propostos` **Then** a proposta não aparece.
- [x] **Given** o link do e-mail **When** o usuário logado chama `resgatar` com o token **Then** a proposta passa a aparecer só para ele; um segundo resgate do mesmo token por outra conta dá 409.
- [x] **Given** a proposta com 2 pets **When** o responsável responde só 1 **Then** 422 `VINCULO_INCOMPLETO` e nada muda.
- [x] **Given** LIGAR para um pet de outra pessoa **Then** 403 `PET_SEM_ACESSO`.
- [x] **Given** CRIAR com o plano no limite **Then** 409 `LIMITE_DE_PETS` e a proposta continua pendente. *Com o erro que o app já trata: 403 `LIMITE_PETS_PLANO` (V7).*
- [x] **Given** a resposta completa **Then** nasce um `VinculoPacientePet` ATIVO por pet ligado ou criado, a proposta fica RESPONDIDA, e a equipe com `paciente.escrever` recebe `VINCULO_RESPONDIDO`.
- [x] **Given** a clínica lê o QR de um pet **Then** a resposta à clínica não tem nada do dono, e o dono recebe `VINCULO_PROPOSTO` com o nome da clínica.
- [ ] **Given** um vínculo ATIVO **When** o responsável desliga `diarioCompleto` **Then** a próxima leitura do diário pela clínica (E2-03) dá 403 `SEM_CONSENTIMENTO`, sem cache. *Depende da E2-03: o consentimento é lido do banco a cada vez (sem cache); a leitura do diário é de lá.*
- [x] **Given** um membro de família com LEITURA **When** tenta mudar o consentimento **Then** 403 `SOMENTE_LEITURA`.
- [x] **Given** o responsável bloqueou a clínica **When** ela propõe por QR **Then** a clínica recebe a mesma resposta de sempre, e o responsável não recebe nada.

### Observáveis
- [x] Índice único parcial impede dois ATIVO para o mesmo pet e parceiro (teste de integração com duas respostas simultâneas).
- [x] `MudancaConsentimentoVinculo` registra cada troca, com quem e quando.

## Estratégia de Testes

- Unit: mascaramento, `sugestaoDoApp`, resposta completa e incompleta, LIGAR, CRIAR (conversão de porte e espécie), limite de pets, consentimento, bloqueio, resgate com tentativas.
- Integration: dois resgates simultâneos do mesmo código; dois aceites simultâneos.
- Cenários `qa/cenarios/`: outro tutor responde (403), família LEITURA muda consentimento (403), outro parceiro lê o vínculo (403).

## Arquivos Impactados

| Arquivo | Ação |
|---|---|
| `prisma/schema.prisma` + migration (com SQL dos índices parciais) | Modificar |
| `src/vinculo-clinico/` (module, controller do parceiro, controller do tutor, service, regras) | Criar |
| `src/pet/pet.service.ts` | Reusar a criação com limite (sem mudar contrato) |
| `src/sendgrid-mail/` | Template da proposta |
| `src/notificacao/catalogo/*` | 3 tipos |
| `src/inactivation/inactivation.service.ts` | Expurgo: vínculos, consentimentos e bloqueios do usuário excluído |

## Tasks

- [x] **T1** Migration + índices parciais (`20261021103000`)
- [x] **T2** Propor (e-mail, código, acesso, QR) com tetos *(T1)*
- [x] **T3** Resgatar, listar, responder, recusar, corrigir *(T2)*
- [x] **T4** Minhas clínicas, consentimento, encerrar, bloquear *(T3)*
- [x] **T5** `ativarPorPedido` para a E3-05 e a E7-03 *(T1)*
- [x] **T6** Notificações, e-mail, expurgo LGPD, testes, cenários, handoff do app (tela "Minhas clínicas" e "Vínculo proposto"). Handoff em `docs/frontend/novembro-2026/portal-parceiro-e2.md`, seção 2; smoke por HTTP no gate G1

## Riscos e Mitigações

| Nível | Risco | Mitigação |
|---|---|---|
| Alto | Impostor com CPF alheio ver pets e clínica | D1: só prova de posse entrega proposta |
| Médio | Clínica usar o QR para saber se um pet tem dono no app | A resposta é a mesma sempre (`propostaId`), inclusive para pet inexistente |
| Médio | Código de balcão adivinhado | V14: 8 caracteres (30^8), 72 h, 5 tentativas por conta por hora, 30 por origem /64 no banco, e o mesmo 404 para tudo que não liga (V15) |

## Rollout / Rollback

Aditivo e atrás do módulo. Rollback reverte o código; vínculos criados ficam sem leitor (nada publica sem a E2-04).

## Change Log

| Data | Versão | Mudança | Autor |
|---|---|---|---|
| 2026-10-20 | 0.1 | Criação | Nicolas (via Claude) |
| 2026-10-21 | 0.2 | Implementação (T1 a T6) e decisões V1 a V13 | Claude |
| 2026-10-21 | 0.3 | Segunda revisão de segurança: V14 a V21 (código de 8 caracteres, 404 único, sem microchip no CRIAR, acesso só valendo, pendentes canceladas com o cadastro, correções apagadas na anonimização, bloqueio como não respondida) | Claude |
| 2026-10-21 | 0.4 | Gate G1: concluída do lado da API. O AC do `diarioCompleto` desligado depende da leitura do diário (E2-03) | Claude |
