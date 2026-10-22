# Spec: Vacinação conectada (aplicação com lote, protocolo, lista de chamada e carteirinha do app)

**Status:** Concluído (API em dev, 2026-10-21; front em novembro com o Luís)
**Autor:** Nicolas (via Claude)
**Criado em:** 2026-10-20
**Versão:** 0.4
**Épico:** [E4 prontuário](../../../../../epicos/portal-parceiro-e4-prontuario.md)
**Depende de:** [E4-02 catálogos](02-catalogos-clinicos.md) (vacinas e protocolo), [E2-04 publicação](../e2-pacientes-e-ponte/04-publicacao-no-app.md); [E6-01 lotes](../e6-estoque/01-lotes-e-movimentos.md) é opcional (sem estoque, o lote é digitado)
**Onda:** 2 (a que mais vende)

---

## Visão Geral

O ciclo da vacina:
1. **Aplicar na clínica**, com vacina do catálogo, lote do estoque (o que vence primeiro sugerido, o vencido travado) ou digitado, validade, aplicador, via da vacina, dose da série congelada, próxima dose calculada e, se couber em 60 dias, já marcada na agenda.
2. **Registrar dose de outro lugar**, com o local, quem aplicou lá, a procedência (comprovante ou relato) e quem transcreveu.
3. **Protocolo** por espécie e idade e **lista de chamada** de reforços.
4. **Publicar no app**: a carteirinha do responsável muda na hora, com o selo da clínica e a próxima dose.

## Motivação

"É a prova mais fácil de mostrar e a mais difícil de copiar: a carteirinha do app já existe" (doc 13 do portal). A `Vacina` do app não tem lote, fabricante, validade, aplicador, clínica nem dose (`prisma/schema.prisma:950-964`, doc 06 do portal, seção 6: "a maior lacuna comercial do módulo clínico").

---

## Research Findings

- **Portal:**
  - `AplicacaoVacina` (origem clínica ou externa, profissional, `aplicadaEm`, lote e validade anuláveis, dose, `dosesNaSerie` congelado, via, `proximaDoseEm` congelada, `agendamentoDaProximaId`, atendimento, `externa`) e `AplicacaoExterna` (`types.ts:1231-1323`);
  - protocolo em `domain/protocolo-vacinal.ts`: série de filhote até 112 dias de vida, idade mínima, opcionais só quando iniciadas, próxima dose congelada;
  - lote na aplicação em `domain/lote-na-aplicacao.ts`: janela de "perto de vencer" de 60 dias, igual à do estoque;
  - carência de atraso de 3 dias, o mesmo relógio do app (decisão 1 do doc 13);
  - contrato da carteirinha (`PlanoVacinalDoPet`, `ROTAS_DA_CARTEIRINHA`, `TIPO_DE_NOTIFICACAO_DA_VACINA = 'VACINA_REGISTRADA_PELA_CLINICA'`, `contrato/responsavel.ts:1434-1505`) e doc 14.
- **Defeitos do doc 13 que viram testes:**
  - a dose anterior de uma série cobrava para sempre no app (só a aplicação mais recente de cada vacina cobra);
  - a via fixa em subcutânea dentro do atendimento;
  - o lote vencido aceito quando digitado.
- **API:**
  - `VacinaService` cria `Vacina` e o lembrete opcional da próxima dose (`src/vacina/dto/create-vacina.dto.ts:16-37`);
  - `VACINA_ATRASADA` já existe (detector);
  - a E2-04 acrescenta lote e afins na `Vacina` e publica.

**Breaking changes:** nenhuma.

## Decisões

- **D1 Lote vencido trava no servidor**, digitado ou do estoque (`LOTE_VENCIDO`); "perto de vencer" (até 60 dias) é aviso e sugestão de uso.
- **D2 Série decidida pela idade na primeira dose e congelada** (`dosesNaSerie`), sem data de nascimento conta como adulto (decisão 2 do doc 13). A regra WSAVA das 16 semanas espera a pergunta clínica da E4-02.
- **D3 Dose externa conta para o protocolo**, marcada com a procedência; não tem lote (decisão 5 do doc 13), não baixa estoque.
- **D4 Próxima dose marcada só dentro de 60 dias**; o reforço anual fica para a lista de chamada (decisão 6).
- **D5 Uma notificação por ato** (`VACINA_REGISTRADA_PELA_CLINICA`, que já diz o horário da próxima) em vez de duas (decisão 7).
- **D6 Publicação** pela E2-04: `Vacina` com lote, fabricante, validade, dose, série, via e `aplicadaNaClinica`; fecha o lembrete VACINA pendente de mesmo nome; cria a próxima dose como `LembreteSerie` VACINA com a data congelada.
- **D7 Anular aplicação** (lançada por engano) exige motivo, devolve a dose ao estoque e retira a publicação.

## Modelo de dados (aditivo, como foi implementado)

Migrations `20261021210000_vacinacao_conectada` (tabela, enums, índices parciais e CHECKs) e `20261021210100_notificacao_vacina_reforco` (`TipoNotificacao.VACINA_REFORCO_PROXIMO`), aplicadas no dev. O que mudou em relação à v0.1 está em "Decidido na implementação", itens 1 a 3.

```prisma
enum OrigemAplicacao    { CLINICA EXTERNA }
enum ProcedenciaExterna { COMPROVANTE RELATO }
enum TipoDeSerieVacinal { FILHOTE ADULTO }

model AplicacaoDeVacina {
  id                   String               @id @default(cuid())
  parceiroId           String               // FK Parceiro (cascade)
  pacienteId           String               // FK PacienteDoParceiro (NO ACTION)
  vacinaId             String               // FK VacinaDoCatalogo (NO ACTION): global ou acrescimo da clinica
  origem               OrigemAplicacao
  profissionalId       String               // CLINICA: aplicador; EXTERNA: quem transcreveu (FK, NO ACTION)
  aplicadaEm           DateTime
  loteId               String?              // E6-01 (sem rota ate o estoque existir)
  loteCodigo           String?              // obrigatorio na CLINICA, nulo na EXTERNA (CHECK)
  validadeLote         DateTime?            @db.Date
  dose                 Int
  dosesNaSerie         Int                  // congelado (CHECK 1 <= dose <= dosesNaSerie <= 10)
  tipoDeSerie          TipoDeSerieVacinal   // congelado
  via                  ViaAdministracao?    // obrigatoria na CLINICA (CHECK)
  proximaDoseEm        DateTime             @db.Date // congelada, sempre calculada
  agendamentoProximaId String?
  atendimentoId        String?              // E4-01 (sem rota ate o atendimento existir)
  externaLocal         String?
  externaAplicador     String?
  externaProcedencia   ProcedenciaExterna?
  registradaPorId      String               // usuario que gravou
  observacao           String?              // interna: nunca vai ao app
  vigente              Boolean              @default(true) // a ultima nao anulada da vacina no paciente
  avisoReforcoEm       DateTime?            // marcador do cron
  anuladaEm            DateTime?
  motivoAnulacao       String?
  anuladaPorId         String?
  criadaEm             DateTime             @default(now())
  atualizadaEm         DateTime             @updatedAt
  @@index([pacienteId, vacinaId, aplicadaEm])
  @@index([parceiroId, aplicadaEm])
}
// So na migration: UNIQUE (pacienteId, vacinaId) WHERE vigente; (parceiroId, proximaDoseEm) WHERE vigente
// (chamada e contador); (proximaDoseEm) WHERE vigente AND avisoReforcoEm IS NULL AND dose >= dosesNaSerie
// (cron); CHECKs de origem, anulacao (anulada => nao vigente) e tamanho dos textos.
```

## Rotas

| Método e rota | Permissão | Descrição |
|---|---|---|
| `GET /parceiro/portal/pacientes/:id/vacinas/plano` | `paciente.ler` | `PlanoVacinalDto`: por vacina, sequência de doses (dadas, a da vez, previstas com data, reforço), estado da dose (`APLICADA`, `DEVIDA`, `ATRASADA` depois de 3 dias de carência, `PREVISTA`, `AGUARDA_IDADE`, `PENDENTE`) e situação da vacina (`EM_DIA`, `A_VENCER`, `DEVIDA`, `ATRASADA`, `AGUARDA_IDADE`, `NAO_INICIADA`) |
| `GET /parceiro/portal/pacientes/:id/vacinas` | `paciente.ler` | Histórico de aplicações (anuladas inclusive), até 300; `situacao` (`EM_DIA`, `PROXIMO`, `VENCIDO`, `SERIE_INCOMPLETA`) só na vigente |
| `GET /parceiro/portal/clinica/vacinas/:vacinaId/lotes-para-aplicar` | `vacina.aplicar` | Lotes com o primeiro a vencer sugerido e os vencidos travados com o motivo; sem estoque, os já digitados na clínica (item 12) |
| `POST /parceiro/portal/pacientes/:id/vacinas/aplicar` | `vacina.aplicar` (com `marcarProxima`, também `agenda.escrever`: v0.3, M1) | `{ vacinaId, loteCodigo, validadeLote, via, profissionalId, aplicadaEm?, observacao?, confirmarIdadeMinima?, marcarProxima?: { inicio, profissionalId, tipoId?, confirmarConflitos? } }`, `Idempotency-Key`; 409 `LOTE_VENCIDO`, `VIA_INVALIDA`, `IDADE_MINIMA_NAO_ATINGIDA` (aviso com confirmação), `APLICACAO_REPETIDA`, `APLICACAO_FORA_DE_ORDEM`, `PROXIMA_DOSE_FORA_DA_JANELA`, `PACIENTE_INATIVO`... |
| `POST /parceiro/portal/pacientes/:id/vacinas/externa` | `vacina.aplicar` | Dose de outro lugar: `{ vacinaId, aplicadaEm (dia), local, aplicador?, procedencia, via?, profissionalId, observacao? }`, `Idempotency-Key` |
| `POST /parceiro/portal/clinica/aplicacoes/:id/anular` | `vacina.aplicar` | D7: `{ motivo }`; 409 `APLICACAO_ALTERADA` quando a aplicação mudou de paciente numa mescla (v0.3, B2) |
| `GET /parceiro/portal/clinica/vacinas/aplicadas?de=&ate=&cursor=&limit=` | `agenda.ler` | Lista da clínica (até 92 dias, 100 por página) |
| `GET /parceiro/portal/clinica/vacinas/chamada?situacao=&cursor=&limit=` | `agenda.ler` | Lista de chamada (vencidos até 2 anos, séries incompletas, reforços em 30 dias), do mais atrasado para o menos, 100 por página |
| `GET /tutor/clinica/vacinas?petId=` | dono ou família | `VacinaAplicadaNaClinicaDto[]` (aplicadas na clínica e transcritas de fora) |
| `GET /tutor/clinica/vacinas/plano?petId=&clinicaId=` | dono ou família | `PlanoVacinalDoPetDto[]`, um por clínica com vínculo ativo (o plano da clínica vale mais que o `intervaloProximaDose` do app para o que ela registrou, `contrato/responsavel.ts:1420-1432`); `clinicaId` traz uma clínica só (v0.3, B4) |

Cron diário às 12h UTC ("hoje" no fuso de cada clínica): `VACINA_REFORCO_PROXIMO` ao responsável quando o reforço de uma dose aplicada na clínica entra nos 30 dias (marcador por aplicação; em lotes justos entre clínicas desde a v0.3, M2). Contador `vacinasAtrasadas` (E1-06) em `GET /parceiro/portal/pendencias`.

## Acceptance Criteria

- [x] **Given** lote V10-2409 vencido **When** aplica com ele (do estoque ou digitado) **Then** 409 `LOTE_VENCIDO`. Evidência (digitado): `src/vacinacao-clinica/regras/lote.spec.ts` (golden tests do portal), `vacinacao.service.spec.ts` ("D1: lote vencido no dia da aplicacao"), integração ("lote vencido digitado: 409 LOTE_VENCIDO e nada gravado") e smoke ("AC1: lote V10-2409 vencido digitado: 409 LOTE_VENCIDO, mensagem em en-GB"). O lote do estoque passa pela mesma `avaliarValidade` quando a E6-01 existir (hoje não há estoque).
- [x] **Given** filhote de 11 semanas com 1ª dose de V10 externa **When** aplica a 2ª **Then** `dose=2`, `dosesNaSerie=3`, próxima em 28 dias marcada se `marcarProxima`, e a carteira do app mostra 2 de 3 com o selo da clínica. Evidência: `regras/protocolo.spec.ts` ("AC2", nos dois modos da série: em `FIXA` é 2 de 3; em `ATE_IDADE_MINIMA` com 16 semanas a mesma dose é 2 de 4, item 4), `vacinacao.service.spec.ts` ("AC2"), integração ("AC2 + AC5") e smoke ("AC2: 2a dose na clinica" e "GET /vacina: uma linha so, da clinica, 2 de 3, com lote e o selo").
- [x] **Given** antirrábica antes de 12 semanas **Then** o plano diz "a partir de {data}", nunca "atrasada". Evidência: `regras/protocolo.spec.ts` ("AC3"), integração ("o plano da clinica e o do app") e smoke ("AC3: plano de filhote de 11 semanas").
- [x] **Given** a dose 1 de uma série com a dose 2 aplicada **Then** a dose 1 não aparece como vencida (defeito do doc 13 como teste). Evidência: `regras/protocolo.spec.ts` ("AC4 (defeito 1 do doc 13)"), integração e smoke (a dose de fora já seguida pela da clínica vem `EM_DIA` e sem horário nas rotas do app).
- [x] **Given** lembrete VACINA pendente "V10" no app **When** a clínica aplica V10 **Then** o lembrete é concluído e a carteira mostra uma linha só. Evidência: integração ("AC2 + AC5": ocorrência `CONCLUIDO` e uma `Vacina` no pet) e smoke ("AC5" e "GET /vacina: uma linha so").
- [x] **Given** vínculo ausente **Then** a aplicação fica só na clínica e o plano do app não muda. Evidência: `vacinacao.service.spec.ts` ("sem vinculo ativo"), integração ("AC6": nenhuma `PublicacaoClinica`) e as rotas do app, que só leem clínica com vínculo ATIVO (integração "responsavel errado..." e smoke "o pet dele, sem clinica: 200 e lista vazia").
- [ ] **Given** anular **Then** a dose volta ao saldo do lote (E6-01), a `Vacina` do app some e sai `CLINICA_ANULOU_REGISTRO` sem nome de vacina. *Parcial: a `Vacina` e a próxima dose saem do app, o lembrete que a aplicação fechou volta a pendente e o aviso sai sem nome de vacina (integração "AC (D7)" e smoke "== Anular =="). A devolução ao saldo do lote espera a E6-01 (ponto marcado em `vacinacao.service.ts`, `anular`).*
- [x] Uma aplicação gera um push só. Evidência: integração (uma linha de `Notificacao` para a dona depois de aplicar com a próxima dose marcada, nenhuma de agendamento; na corrida, uma só) e smoke ("um push so: a dona tem uma notificacao, VACINA_REGISTRADA_PELA_CLINICA"). O agendamento da próxima dose não avisa (D5; item 7 para a E3-06).

## Estratégia de Testes

- Unit: protocolo (golden tests de `protocolo-vacinal.spec` e `vacinacao.spec` em `regras/protocolo.spec.ts`, mais os dois modos da série), lote (`lote-na-aplicacao.spec` em `regras/lote.spec.ts`), service (todas as recusas, a ordem das escritas, a marcação depois do commit), controller (permissão por rota, `Idempotency-Key`, `audit:endpoints`) e ownership (`ownership.aplicacao-vacina.spec.ts`).
- Integration (Postgres de dev, sem mock de banco): `vacinacao.integration.spec.ts` (25 casos: publicação e um push, sem vínculo, anular, corrida, inativo, BOLA, chamada sem óbito, contador, cron com marcador e lock, família, responsável errado, mescla; da v0.3: autoria e CRMV, anular depois de mesclar, aplicar x anonimizar, teto de avisos por pet, anonimização dos textos, família com pet inativo, observação por permissão, paciente religado) e `vacinacao-custo.integration.spec.ts` (clínica de 3.000 pacientes; cron justo e no prazo com 600 e 500 candidatas).
- Smoke HTTP: `npm run script:smoke-vacinacao` (57 passos, parceiro e responsável errados, o 403 do marcar próxima para a ENFERMAGEM, a autoria no app, resíduo zero).
- Cenários: `REG-VACINACAO-*` em `qa/cenarios/portal-parceiro.json`; as duas rotas do app entram na varredura "tutor errado".

## Arquivos Impactados

| Arquivo | Ação |
|---|---|
| `prisma/schema.prisma` + 3 migrations (v0.3: `20261021220000_vacinacao_autoria_crmv`, `AplicacaoDeVacina.crmvConfirmado` e `Vacina.gravadaPorNome`) | Modificar (aditivo) |
| `src/vacinacao-clinica/` (controllers do portal e do app, `vacinacao.service.ts`, `vacinacao-leitura.service.ts`, `vacinacao-responsavel.service.ts`, `vacinacao-apoio.ts`, `regras/protocolo.ts`, `regras/lote.ts`, `regras/teto-de-saida.ts` (v0.3), `vacinacao.cron.ts`, DTOs, testes) | Criar |
| `src/auth/services/ownership.service.ts` (+ `ownership.aplicacao-vacina.spec.ts`) | `assertAplicacaoVacinaDoParceiro`, `assertVacinaDoCatalogoDoParceiro` |
| `src/common/errors/error-catalog.ts`, `codigos-clinicos.ts` | 14 códigos novos (v0.3: `APLICACAO_ALTERADA`), 6 locales |
| `src/notificacao/**`, `scripts/smoke-push-device.ts` | `VACINA_REFORCO_PROXIMO` nos 6 registros e a chave do advisory lock |
| `src/pacientes-parceiro/regras/historico.ts` | Aplicações no registro da mescla (registro clínico) |
| `src/pacientes-parceiro/clientes-parceiro.service.ts` (+ spec) | v0.3: `anonimizar` trava os pacientes antes dos vínculos (B1) e limpa os textos livres das aplicações |
| `src/app.module.ts` | `VacinacaoClinicaModule` |
| `src/publicacao-clinica/publicador-clinico.service.ts` (+ integração) | v0.3: campo opcional `gravadaPorNome` em `AutorDoAto`, gravado só na `Vacina` (P1 a P14 intactas) |
| `src/vacina/vacina.service.ts` | Reuso sem mudança (E2-04): `GET /vacina` devolve a coluna nova sozinho |

## Tasks

- [x] **T1** Migration (`20261021210000_vacinacao_conectada`, `20261021210100_notificacao_vacina_reforco`; SQL conferido sem objeto de outra sessão; `migrate diff` vazio depois)
- [x] **T2** Porte do protocolo e do lote + golden tests (`regras/protocolo.ts`, `regras/lote.ts`; 48 testes, os dois modos da série de filhote)
- [x] **T3** Aplicar, externa, anular (`vacinacao.service.ts`; estoque com os pontos "E6-01" marcados no aplicar e no anular)
- [x] **T4** Plano, lista de chamada, rotas do app (`vacinacao-leitura.service.ts`, `vacinacao-responsavel.service.ts`, os dois controllers)
- [x] **T5** Publicação e notificação; cron de reforço; handoff (carteirinha conectada no app): `vacinacao.cron.ts` (cron e contador `vacinasAtrasadas`), `VACINA_REFORCO_PROXIMO`, `docs/frontend/novembro-2026/portal-parceiro-e4.md` seções 3 e 4

## Riscos e Mitigações

| Nível | Risco | Mitigação |
|---|---|---|
| Alto | Carteirinha do app com vacina errada (pet errado ou lote errado) | Vínculo conferido na publicação (E2-04), lote validado no servidor, anulação que retira do app com aviso |
| Médio | Lembrete de vacina duplicado no app | Fecha o lembrete pendente de mesmo nome na publicação (D6) e teste dedicado |
| Médio | Lista de chamada e plano caros numa clínica grande | Dose `vigente` com índice parcial, paginação por cursor, tetos de período, `take` e tamanho (item 13); medido com 3.000 pacientes; teto em bytes de saída desde a v0.3 (B4) |
| Médio | O app mostra o CRMV de um veterinário que não registrou o ato | v0.3 (M3): CRMV só confirmado pelo próprio ou por DONO/GESTOR; quem gravou vai junto |

## Rollout / Rollback

Aditivo e atrás do módulo (E1-02): nada aparece para parceiro sem o módulo ligado. Migration só cria tabelas e colunas; rollback é reverter o código, e as tabelas ficam sem leitor.

## Decidido na implementação (2026-10-21)

1. **Modelo.** O da v0.1 com o que a regra pedia:
   - `profissionalId` **obrigatório** nas duas origens: o aplicador na CLINICA e quem **transcreveu** na EXTERNA (a Res. CFMV pede o nome de quem responde pelo registro; o contrato do portal tem `externa.registradaPor`). `registradaPorId` é o usuário que gravou.
   - `tipoDeSerie` (FILHOTE ou ADULTO) congelado junto de `dosesNaSerie` (D2): o nascimento editado depois não muda a série.
   - `via` em `ViaAdministracao` (P7, como a E4-02 fez); `proximaDoseEm` obrigatória (sempre calculada).
   - `vigente` marca a última dose não anulada de cada vacina no paciente (a que cobra): índice único parcial `(pacienteId, vacinaId) WHERE vigente` e o índice parcial da chamada; `avisoReforcoEm` é o marcador do cron; `anuladaPorId` e as datas de criação e alteração.
   - FKs: parceiro em cascata; paciente, vacina e profissional `NO ACTION` (registro clínico não some, e a cascata do parceiro passa no mesmo comando).
   - `loteId` e `atendimentoId` ficam como colunas, **fora do corpo**: o estoque (E6-01) e o atendimento (E4-01) não existem, e um id que a API não consegue conferir contra o parceiro não entra.
2. **A dose é do servidor** (P2): `dose`, `dosesNaSerie`, `tipoDeSerie` e `proximaDoseEm` saem de `doseSeguinte` e `proximaDose`, sem campo para a tela escolher (o mock deixava). Pergunta em aberto.
3. **Ordem e datas.** Uma dose por vacina por dia (409 `APLICACAO_REPETIDA`, o toque duplo; com `Idempotency-Key` a repetição devolve a mesma) e sempre depois da última daquela vacina (409 `APLICACAO_FORA_DE_ORDEM`: a numeração é congelada, uma dose no meio a deixaria errada). Na clínica, `aplicadaEm` padrão agora, até 30 dias para trás e 5 minutos de folga para a frente; a externa é o dia do papel, ao meio-dia na parede da clínica. Antes do nascimento: 400. A validade do lote é comparada com o **dia da aplicação** na parede da clínica (o registro tardio não trava por vencer depois).
4. **Os dois modos da série de filhote** (pergunta aberta da E4-02, sem decidir qual é o certo): `FIXA` congela o número do catálogo na primeira dose (o protótipo); `ATE_IDADE_MINIMA` recalcula o total a cada dose (no mínimo `dosesSerieFilhote`, até uma dose dada com `idadeMinimaUltimaDoseFilhoteDias`; cada aplicação congela o que se sabia nela; teto de 10, o `@Max` do catálogo e o CHECK). Golden tests dos dois: quem começa com 6 semanas faz 4 doses; com 8, 3; a dose atrasada encurta; o adulto e o sem nascimento fazem a série de adulto nos dois. No AC2, a mesma 2ª dose é "2 de 3" em `FIXA` e "2 de 4" em `ATE_IDADE_MINIMA`. O seed segue `FIXA`.
5. **Idade mínima:** 409 com `aPartirDe` e `exigeConfirmacao`; com `confirmarIdadeMinima: true` grava e devolve o aviso `IDADE_MINIMA_CONFIRMADA`. A externa não é conferida (é transcrição do que já aconteceu).
6. **A dose externa não é publicada no app nem avisa.** O contrato do portal fazia a externa avisar, mas o publicador grava a `Vacina` com o selo (`aplicadaNaClinica`) e somente leitura, e "a clínica não pode assinar o que não aplicou" (doc 14); a dose costuma ser a que o próprio responsável contou (e pode já estar na carteira dele). O responsável vê a externa em `GET /tutor/clinica/vacinas` (`origem: EXTERNA`, sem selo) e no plano. Desde a v0.3 o cron também não avisa o reforço da externa (M2). Pergunta em aberto.
7. **Marcar a próxima dose (D4)** depois do commit, pelo `AgendamentosService.criar` (taxa, expediente, conflitos, feriado, horizonte: as regras da agenda inteiras), com `origem RETORNO` e a observação interna "Próxima dose: {vacina} (dose n de N)". Se a agenda recusar, a dose fica gravada e publicada e a resposta traz `marcacao: { status: RECUSADA, codigo }` (um 500 faria a tela repetir e levar `APLICACAO_REPETIDA`). `tipoId` é opcional (padrão: o primeiro tipo ativo de kind `VACINA`; sem ele, 409 `MARCAR_PROXIMA_SEM_TIPO`). A janela de 60 dias é conferida antes de gravar (o horário) e dentro da transação (a próxima dose calculada); fora dela, 409 `PROXIMA_DOSE_FORA_DA_JANELA` e nada é gravado. A agenda não manda push hoje; **quando a E3-06 ligar `AGENDAMENTO_CRIADO_PELA_CLINICA`, o agendamento nascido aqui fica de fora** (D5).
8. **Concorrência:** a linha-mãe (o paciente) é travada com `FOR NO KEY UPDATE` (não barra as FKs de outras tabelas), as doses são relidas sob a trava, a anterior deixa de ser `vigente` antes de a nova nascer, e o índice único parcial segura o resto. Nada de `COUNT ... FOR UPDATE`. A ordem das travas (paciente, depois o vínculo no publicador) é a da inativação e da mescla. Integração: duas aplicações simultâneas, uma grava e a outra recebe 409.
9. **Publicação** só pelo `PublicadorClinicoService.publicarVacina` na transação do domínio (vínculo travado, idempotência, lembrete fechado por palavra inteira), com o nome canônico da vacina, o fabricante do catálogo, a autoria congelada ("CRMV-SP 12345") e o lembrete da próxima dose às 9h da parede da clínica. O aviso sai com `avisar` depois do commit (e depois da agenda). "Um push só" é provado contando as linhas de `Notificacao` no Postgres.
10. **Anular:** trava o paciente e a aplicação, grava motivo e autor, devolve a vigência à dose anterior da vacina, chama `anular(tx, 'APLICACAO_VACINA', ...)` e grava trilha `ANULAR`, tudo junto; o aviso sai depois. O horário marcado para a próxima dose **fica na agenda** (a recepção decide; a resposta o mostra). A devolução ao estoque é o ponto "E6-01".
11. **Rotas do app:**
    - o plano devolve **uma lista**, um por clínica com vínculo ATIVO (o contrato do portal previa um só; o catálogo e as doses são de cada clínica, A1);
    - o vínculo vem da regra única `vinculosLegiveis` (dono e família; pet inativo some para a família); pet de outra pessoa: 403 antes de qualquer leitura de clínica;
    - entram as aplicações e as externas não anuladas do paciente ligado, inclusive as de antes do vínculo (a ficha é do animal);
    - nada interno: sem observação, sem quem gravou, sem anuladas, sem ids de profissional, lote ou atendimento.
12. **Lotes sem estoque:** a rota de lotes devolve os lotes já digitados nesta clínica para a vacina nos últimos 180 dias (até 20, `saldo: null`, `estoque: false`), avaliados pela regra do lote (o primeiro a vencer sugerido, o vencido travado no fim). Com a E6-01, a mesma rota lê a geladeira.
13. **Custo (lição das auditorias de 2026-10-21).**
    - Tetos:
      - histórico: 300 aplicações por paciente (`truncado`);
      - plano: 200 vacinas do catálogo, 10 doses por série;
      - aplicadas: 92 dias, 100 por página;
      - chamada: 100 por página, vencidos até 2 anos;
      - rotas do app: 300 aplicações, 20 clínicas;
      - escritas: 300 por usuário por hora (`TaxaService`, 429 `VACINACAO_TAXA_EXCEDIDA`).
    - A chamada e o contador são SQL com `vigente` literal (o plano genérico de uma consulta parametrizada não provaria o predicado do índice parcial).
    - Medição no Postgres de dev com uma clínica de **3.000 pacientes, 1.500 clientes e 24.000 aplicações** (6.000 vigentes), `vacinacao-custo.integration.spec.ts`:

| Leitura | Tempo (dev, com a rede) | Resposta |
|---|---|---|
| Chamada, 1ª página (50) | 177 ms (0,57 ms de execução no banco, `Index Scan using AplicacaoDeVacina_chamada_idx`) | 29 KB |
| Chamada, 10ª página | 150 ms | |
| Contador `vacinasAtrasadas` (302) | 56 ms | |
| Plano de um paciente | 119 ms | 4 KB |
| Histórico de um paciente (8) | 283 ms | |
| Aplicadas, 92 dias, página de 100 | 299 ms | 55 KB |

14. **Cron de reforço** (`VacinacaoCron`, 12h UTC, advisory lock `vacinacao_reforco_proximo`): só a dose vigente de série fechada (a próxima é reforço; a série aberta já tem o lembrete do app e o aviso do ato), reforço entre hoje e hoje + 30 na parede de cada clínica, até 500 por rodada. Marcador gravado com `updateMany` condicional na transação do lock; push depois do commit, best-effort. Fica de fora (marcado sem aviso, para não voltar a cada rodada): paciente inativo, com óbito ou mesclado, vacina desativada, sem vínculo ATIVO, pet inativo, pet sem dono. Família com `paraMembro` é follow-up (P3 da E2-04). Copy fixa sem nome de vacina nem de clínica; rota `/screens/vacina/lista` com `petId`.
15. **Contador `vacinasAtrasadas`** (E1-06): os vencidos da lista de chamada (paciente ativo, vacina ativa, até 2 anos), `agenda.ler`, tom `RISCO`, `rota /veterinario/vacinas`. É contado na leitura (com o cache da E1-06), não pelo cron.
16. **Mescla (E2-01, D7):** as aplicações entram no `HISTORICOS_DO_PACIENTE` como registro clínico; ao mesclar, vão para o paciente que fica e a vigência de cada vacina é recalculada (a última não anulada das duas fichas cobra). Integração.
17. **Permissão:** nenhuma nova. `vacina.aplicar` já estava na matriz (VETERINÁRIO e ENFERMAGEM, sem CRMV), e a spec não pede CRMV. Pergunta em aberto.
18. **Erros novos** (6 locales e `CODIGOS_CLINICOS`): `LOTE_VENCIDO`, `VIA_INVALIDA`, `IDADE_MINIMA_NAO_ATINGIDA`, `VACINA_FORA_DA_ESPECIE`, `VACINA_INATIVA`, `APLICACAO_REPETIDA`, `APLICACAO_FORA_DE_ORDEM`, `APLICACAO_DATA_INVALIDA`, `APLICACAO_JA_ANULADA`, `PROXIMA_DOSE_FORA_DA_JANELA`, `MARCAR_PROXIMA_SEM_TIPO`, `VACINACAO_TAXA_EXCEDIDA`, `VACINACAO_PERIODO_INVALIDO` e, na v0.3, `APLICACAO_ALTERADA`. Datas do corpo com o validador da agenda (anos de 2000 a 2100).
19. **Notificação nova `VACINA_REFORCO_PROXIMO`** nos 6 registros: catálogo (rota e copy fixa nos 6 idiomas), canal Android `CUIDADO`, sem e-mail, categoria `CLINICO`, `smoke-push-device.ts` com amostra, e o produtor real (o cron).

### Revisão de segurança (v0.3, 2026-10-21)

Achados da auditoria em `qa/seguranca/achados.json` (`SEG-2026-10-21-VACINA-MARCAR-PROXIMA-SEM-AGENDA`, `-CRON-SEM-JUSTICA`, `-AUTORIA-CRMV`, todos MÉDIO, e o agregado `-BAIXOS`), corrigidos no dev; cenários `REG-VACINACAO-*` em `qa/cenarios/portal-parceiro.json`. O que muda nos itens acima:

20. **M1, marcar a próxima dose exige agenda.** `marcarProxima` cria agendamento pelo `AgendamentosService`; a ENFERMAGEM tem `vacina.aplicar` e não tem `agenda.escrever`. No handler (`vacinacao-parceiro.controller.ts`), antes da taxa e de qualquer leitura: com `marcarProxima` e sem `agenda.escrever` no contexto, 403 `SEM_PERMISSAO` com `permissao: "agenda.escrever"` e nada gravado. A matriz não mudou. Provas: controller spec ("M1") e smoke (`aplicacoes: 1, agendamentos: 0` depois do 403).
21. **M2, cron justo e no prazo** (`vacinacao.cron.ts`, substitui o "até 500 por rodada" do item 14):
    - no primeiro lote, as vencidas (reforço antes de hoje na parede de cada clínica, "hoje" de cada fuso numa tabela `VALUES`) são marcadas num `UPDATE` só, sem aviso;
    - cada lote lê até 500 candidatas, no máximo 100 por clínica (`ROW_NUMBER() OVER (PARTITION BY "parceiroId")`), já com paciente, vacina, vínculo, pet e dono na mesma consulta; marca com `UPDATE ... RETURNING` condicional (vigente, sem marcador), e só as devolvidas avisam;
    - um lote por transação, cada um com o advisory lock, até esvaziar ou passar de 45 s (o que sobrou vai ao log com a contagem); pushes depois do commit, 5 em paralelo;
    - **a dose EXTERNA não avisa reforço** (a copy diz "registrada pela clínica" e a tela do app não a mostra como da clínica). Segue a pergunta aberta 2; a externa em dia não entra na fila nem é marcada, para a decisão poder mudar sem migrar dado.
22. **M3, autoria e CRMV** (padrão seguro desta rodada; a escolha final é do Nicolas, pergunta abaixo): o CRMV do profissional do corpo vai ao app só quando quem grava é o próprio profissional (`Profissional.usuarioId` = quem pediu) ou é DONO ou GESTOR. Senão a publicação sai sem CRMV e o app mostra "CRMV não confirmado". A decisão é congelada no ato (`AplicacaoDeVacina.crmvConfirmado`) e vale também na rota do app (aplicação e `externa.registradaPor`). A publicação leva quem gravou quando não é o aplicador (`Vacina.gravadaPorNome`: o nome do profissional ligado ao usuário ou, sem ele, o da conta), por um campo opcional novo em `AutorDoAto`; `GET /tutor/clinica/vacinas` devolve `gravadaPor`. Migration aditiva `20261021220000_vacinacao_autoria_crmv` (duas colunas, SQL conferido, `migrate diff` vazio depois). O portal ganha `crmvConfirmado` na `AplicacaoDeVacinaDto`.
23. **B1, aplicar x anonimizar.** O aplicar trava paciente e depois vínculo; o `anonimizar` mexia nos vínculos antes dos pacientes: deadlock (40P01). Agora o `anonimizar` trava os pacientes do titular (`ORDER BY id FOR NO KEY UPDATE`) logo depois do cliente. A integração reproduziu `deadlock detected` antes da correção; depois, 10 rodadas com atrasos dos dois lados (7 vezes o anonimizar na frente, 409 `PACIENTE_INATIVO` no aplicar; 3 vezes o aplicar na frente), sem 40P01 nem 500.
24. **B2, anular depois de mesclar.** Sob a trava, a aplicação é relida com o `pacienteId` lido fora dela; sem a linha (a mescla a levou), 409 `APLICACAO_ALTERADA` e a tela relê. Integração: anular a vigente que veio do duplicado devolve a vigência à dose anterior no paciente que ficou.
25. **B3, teto de avisos.** No máximo 6 avisos de vacina (registrada ou anulada) por pet por dia, pelo `TaxaService` (`aviso-vacina:{petId}:{dia}`; o balde é fixado na meia-noite que encerra o dia da parede da clínica, para a poda horária dos baldes não zerar a contagem antes do fim do dia). Passou: a publicação acontece e o aviso não sai (log). O `NotificacaoEmissorService` não mudou. Integração: 4 ciclos de aplicar e anular, 8 tentativas, 6 notificações.
26. **B4, teto em bytes de saída** (`regras/teto-de-saida.ts`, completa o item 13):
    - o plano mostra, por vacina, as doses dadas, a da vez e a seguinte (ou o próximo reforço); nunca a série inteira prevista (o `total` diz quantas são);
    - teto de 64 KB por plano (portal e app) com `truncado`, `vacinasOmitidas` e `opcionaisOmitidas` (corta do fim, as que menos pedem ação; os contadores são do plano inteiro);
    - rota do app: planos calculados 4 de cada vez, soma em 256 KB; a clínica que passa vem só com o cabeçalho e o app a pede sozinha com `?clinicaId=`;
    - histórico do portal e lista do app em 256 KB (`truncado` no histórico).
27. **Recomendações aplicadas:**
    - o histórico só devolve a `observacao` interna a quem tem `prontuario.ler` (RECEPÇÃO e GESTOR recebem `null`);
    - a anonimização limpa `observacao`, `externaAplicador` e `motivoAnulacao` (vira "Anonimizado": o CHECK exige o motivo na anulada) das aplicações dos pacientes do titular, e o motivo copiado na publicação anulada, na mesma transação (precedente: B2 da E3-02);
    - **doses de antes do vínculo (decisão desta rodada, o Nicolas confirma; P11 da E2-04):** a lista do app mostra só as doses aplicadas ou registradas a partir do `ativadoEm` do vínculo ATIVO, ou publicadas para aquele pet; o plano continua calculado com o histórico inteiro, mas as doses de antes do vínculo saem da lista de doses e viram só a contagem `aplicadasAntesDoVinculo` (sem data, lote, aplicador nem textos). Substitui o "inclusive as de antes do vínculo" do item 11.
28. **Medições** (Postgres de dev, com a rede; ida e volta numa transação: 26,7 ms):

| O quê | Antes | Depois |
|---|---|---|
| Plano no pior caso (500 vacinas, séries de 10, 300 aplicações) | 5.500 doses, 925 KB | 1.300 doses sem o teto (413 KB); com o teto, 63,1 KB (63 vacinas, 437 omitidas) |
| Rota do app com 20 clínicas no pior caso | cerca de 18,1 MB | 196,1 KB (3 planos inteiros e 17 cabeçalhos) |
| Plano de um paciente real (clínica de 3.000 pacientes) | 4 KB, 119 ms | 4 KB, 120 ms |
| Cron, 500 candidatas com destino | estimado 53 a 67 s numa transação de 60 s (4 a 5 idas em série por candidata) | 6 lotes, o mais longo 204 ms; rodada inteira 12,1 s (os pushes depois do commit) |
| Cron, 600 vencidas numa clínica e 1 reforço em 30 dias noutra | a outra esperava o lote seguinte | as 600 num `UPDATE` (lote de 237 ms) e a outra avisada na mesma rodada |
| Cron, 600 a vencer numa clínica e 1 noutra, um lote só | as 500 primeiras da grande | 100 da grande e a outra avisada |

## Perguntas em Aberto

- [ ] Regra das 16 semanas (WSAVA): `FIXA` ou `ATE_IDADE_MINIMA` por vacina. Herdada da E4-02; a API calcula os dois (item 4). Responsável: veterinário responsável técnico + Nicolas.
- [ ] A dose de outro lugar deveria avisar o responsável (o contrato do portal dizia que sim) ou entrar na carteira dele como `Vacina`, sem selo? Hoje não vai ao app como vacina e não avisa, nem no ato nem no reforço (itens 6 e 21). Responsável: Nicolas.
- [ ] O veterinário escolhe a dose à mão (o mock deixava) ou ela é sempre a do protocolo? Hoje, sempre a do protocolo (item 2). Responsável: veterinário responsável técnico.
- [ ] `vacina.aplicar` exige CRMV em dia, como os outros atos de veterinário? Hoje não (a ENFERMAGEM aplica; o aplicador fica registrado). Responsável: Nicolas, com o jurídico.
- [ ] Anular a aplicação deveria cancelar sozinho o horário da próxima dose? Hoje fica na agenda (item 10). Responsável: Nicolas.
- [ ] **Autoria e CRMV (v0.3, item 22):** o CRMV de quem não registrou o ato pode ir ao app? Hoje, só quando quem grava é o próprio profissional ou DONO/GESTOR; senão vai "CRMV não confirmado" e o nome de quem gravou. Alternativas: exigir que o aplicador seja sempre quem pede (o `profissionalId` sai do corpo), ou aceitar a palavra de qualquer `vacina.aplicar`. Responsável: Nicolas, com o jurídico (Res. CFMV).
- [ ] **Doses de antes do vínculo no app (v0.3, item 27):** a lista do app esconde as doses de antes do `ativadoEm` que não foram publicadas para o pet, e o plano só as conta. Confirmar, ou mostrar tudo quando o paciente nunca foi ligado a outro pet (o caso comum da ficha antiga da clínica). Responsável: Nicolas.

## Change Log

| Data | Versão | Mudança | Autor |
|---|---|---|---|
| 2026-10-20 | 0.1 | Criação | Nicolas (via Claude) |
| 2026-10-21 | 0.3 | Revisão de segurança: `marcarProxima` exige `agenda.escrever` (M1); cron em lotes justos (100 por clínica), vencidas em massa, sem aviso da externa e no prazo (M2); CRMV só confirmado e quem gravou na publicação (M3, migration aditiva); travas do anonimizar (B1); anular sob a trava (B2, `APLICACAO_ALTERADA`); 6 avisos por pet por dia (B3); teto em bytes no plano, no histórico e no app (B4); observação só com `prontuario.ler`; anonimização das aplicações; doses de antes do vínculo fora da lista do app. Medições no item 28; duas perguntas novas | Claude |
| 2026-10-21 | 0.2 | T1 a T5 implementadas (API e handoff do portal e do app): modelo com `vigente`, `tipoDeSerie` e quem transcreveu; os dois modos da série de filhote; plano do app por clínica; externa fora do app; próxima dose marcada depois do commit; cron e contador; medição com 3.000 pacientes. AC7 parcial (saldo do lote espera a E6-01) | Claude |
| 2026-10-21 | 0.4 | Fechada do lado da API depois da revisão de segurança (achados corrigidos e conferidos: `npm test` 6686, integrações 52/52 em série no dev, smoke 57/57). AC7 parcial até a E6-01; perguntas de produto com o Nicolas | Claude |
