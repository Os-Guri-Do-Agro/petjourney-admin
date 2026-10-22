# Spec: Documentos clínicos (atestados, termos, pedidos de exame, laudos e cópia do prontuário)

**Status:** In Review
**Autor:** Nicolas (via Claude)
**Criado em:** 2026-10-20
**Versão:** 0.1
**Épico:** [E4 prontuário](../../../../../epicos/portal-parceiro-e4-prontuario.md)
**Depende de:** [E4-01 atendimento](01-atendimento-e-prontuario.md), [E4-03 receituário](03-receituario-digital.md) (PDF, assinatura e bucket)

---

## Visão Geral

Os documentos que a clínica emite e recebe, num serviço só, com o mesmo PDF, a mesma assinatura avançada e o mesmo bucket privado da receita:
- **Emitidos:** prontuário, pedido de exame, orientações, encaminhamento, relatório e plano, atestados (saúde, comparecimento, viagem), declaração de óbito, comprovante de vacinação, termos (consentimento, recusa, eutanásia) e orçamento. São os 15 tipos de `TIPOS_DE_DOCUMENTO_CLINICO` do contrato do portal.
- **Recebidos:** laudos de exame (PDF ou foto), anexados ao atendimento.
- **Termos com aceite do responsável:** no balcão ou pelo app.
- **Cópia do prontuário** a pedido do responsável, no prazo da Res. CFMV.

## Motivação

- O portal imprime receituário (inclusive controle especial) e atestado em HTML (`ProntuarioImpressao.vue`, `components/documentos/`), e o contrato tem `DocumentoClinico`, `DocumentoSalvoNoPet` e as rotas de URL e de "salvar nos documentos" (`contrato/responsavel.ts:821-848`, `:1133-1134`).
- A Res. CFMV 1.321/2020 (alterada pela 1.653/2025, §1º) manda atender o pedido de cópia do prontuário em até 5 dias úteis, prorrogáveis a 30 com justificativa escrita do responsável técnico, e incluir cópia dos laudos (inciso X).

---

## Decisões

- **D1 Um modelo de documento, molde por tipo.** `DocumentoClinico { tipo, atendimentoId?, internacaoId?, pacienteId, conteudo Json (campos do molde), pdfCaminho, hashSha256, codigoVerificador, assinadoPorProfissionalId, assinadoEm }`. Cada tipo tem molde em `src/documentos-clinicos/moldes/` com os campos obrigatórios. Microchip, pelagem, espécie, raça e sexo entram na declaração de óbito e no atestado de viagem (comentários do portal em `types.ts:241-256`).
- **D2 Termo com aceite.** Termos (consentimento cirúrgico ou anestésico, recusa de tratamento, eutanásia) têm estado `PENDENTE_ACEITE`, `ACEITO` ou `RECUSADO`, por dois caminhos:
  - **no balcão:** nome digitado do responsável, documento e assinatura desenhada no tablet, gravada como imagem no PDF;
  - **pelo app:** o responsável com vínculo vê o termo e toca "Aceito", com reautenticação, IP e instante; nunca para eutanásia, que exige presença.

  Eutanásia nunca é notificada por push (P5 do épico pai).
- **D3 Laudo recebido é anexo do atendimento**, no bucket privado, com `tipoExame` do catálogo e data do resultado; publicado no resumo quando o atendimento for liberado.
- **D4 Entrega ao responsável.** Documento ligado a atendimento liberado aparece no resumo com URL assinada; "salvar nos documentos" é toque dele, idempotente (`jaExistia`), com o tipo do app (`RECEITUARIO` vira "Receita Médica"; `COMPROVANTE_VACINACAO`, "Carteira de Vacinação"; o resto, "Outro"; doc 09 do portal, seção 2) e `dataEmissao`.
- **D5 Cópia do prontuário.** `PedidoDeCopiaDoProntuario` com prazo de 5 dias úteis (contado no calendário do estabelecimento), prorrogação a 30 com justificativa obrigatória do responsável técnico e entrega por PDF consolidado (atendimentos, prescrições, vacinas, internações, laudos). Pode ser pedido pelo app (pelo dono com vínculo) ou registrado no balcão. Contador e aviso de prazo vencendo para DONO e GESTOR.
- **D6 Orçamento** é documento sem valor fiscal, com itens e total em centavos; aprovação pelo app fica no E9 (cobrança).

## Rotas (`@ExigeModulo(CLINICA)`)

| Método e rota | Permissão | Descrição |
|---|---|---|
| `POST /parceiro/portal/clinica/documentos` | `prontuario.escrever` | `{ tipo, pacienteId, atendimentoId?, internacaoId?, conteudo }` (rascunho) |
| `POST /parceiro/portal/clinica/documentos/:id/emitir` | `prontuario.finalizar` | Assinatura avançada (reautenticação), PDF, hash, código |
| `GET /parceiro/portal/clinica/documentos/:id/pdf` | `prontuario.ler` | URL assinada |
| `POST /parceiro/portal/clinica/documentos/:id/aceite-no-balcao` | `prontuario.escrever` | `{ nome, documento, assinaturaPng }` (termos) |
| `POST /parceiro/portal/clinica/atendimentos/:id/laudos` | `prontuario.escrever` | Multipart sem DTO (até 6 arquivos, denylist e assinatura de conteúdo do `file-safety.util.ts`) |
| `GET/POST /parceiro/portal/clinica/pedidos-de-copia` + `POST .../:id/prorrogar` + `POST .../:id/entregar` | DONO ou GESTOR | D5 |
| `GET /public/documentos/:codigo` | público | Verificação no padrão da receita (sem conteúdo clínico além do tipo, data e emitente) |
| `GET /tutor/clinica/documentos/:id/url`, `POST /tutor/clinica/documentos/:id/salvar-nos-documentos` | dono ou família (salvar só dono) | D4 |
| `GET /tutor/clinica/termos?petId=` + `POST /tutor/clinica/termos/:id/aceitar` e `/recusar` | dono | D2 pelo app |
| `POST /tutor/clinica/clinicas/:parceiroId/copia-do-prontuario` | dono | Pede a cópia (D5) |

## Acceptance Criteria

- [ ] **Given** declaração de óbito sem microchip quando o paciente tem microchip **Then** o PDF sai com o microchip do cadastro (campo preenchido pelo servidor).
- [ ] **Given** termo de eutanásia **When** alguém tenta aceitar pelo app **Then** 409 `ACEITE_PRESENCIAL_OBRIGATORIO`.
- [ ] **Given** pedido de cópia numa sexta às 17:00 **Then** o prazo vence em 5 dias úteis do calendário do estabelecimento (sem feriados nem dias fechados); prorrogar sem justificativa dá 422.
- [ ] **Given** salvar nos documentos duas vezes **Then** um documento só no app e `jaExistia: true` na segunda.
- [ ] O PDF de cópia do prontuário contém todos os atendimentos finalizados (com adendos e anulações marcadas), prescrições, vacinas, internações e laudos do paciente naquela clínica.
- [ ] Laudo com MIME bloqueado é recusado (denylist).

## Estratégia de Testes

- Unit: moldes (campos obrigatórios por tipo), prazo em dias úteis, aceite (balcão e app), salvar idempotente.
- Integration: PDF consolidado da cópia com hash.

## Arquivos Impactados

| Arquivo | Ação |
|---|---|
| `prisma/schema.prisma` + migration | `DocumentoClinico`, `AnexoDeAtendimento`, `PedidoDeCopiaDoProntuario` |
| `src/documentos-clinicos/` (service, moldes, controllers parceiro, público e tutor) | Criar |

## Tasks

- [ ] **T1** Migration
- [ ] **T2** Moldes dos 15 tipos (começar por receita, atestado de saúde, atestado de viagem, comprovante de vacinação, pedido de exame, declaração de óbito)
- [ ] **T3** Emitir, verificar, aceite no balcão e pelo app
- [ ] **T4** Laudos recebidos
- [ ] **T5** Cópia do prontuário com prazo, prorrogação e contador
- [ ] **T6** Entrega e salvar nos documentos; handoff

## Riscos e Mitigações

| Nível | Risco | Mitigação |
|---|---|---|
| Alto | Termo de eutanásia ou declaração de óbito chegando por push | Nenhum push para esses tipos (P5) e aceite de eutanásia só presencial (D2) |
| Médio | Prazo da cópia do prontuário vencer sem ninguém ver | Contador e aviso para DONO e GESTOR dois dias úteis antes do vencimento |

## Rollout / Rollback

Aditivo e atrás do módulo (E1-02): nada aparece para parceiro sem o módulo ligado. Migration só cria tabelas e colunas; rollback é reverter o código, e as tabelas ficam sem leitor.

## Change Log

| Data | Versão | Mudança | Autor |
|---|---|---|---|
| 2026-10-20 | 0.1 | Criação | Nicolas (via Claude) |
