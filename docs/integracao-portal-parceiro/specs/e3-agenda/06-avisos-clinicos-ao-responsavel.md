# Spec: Avisos clínicos ao responsável (tipos da agenda, véspera, comprovante e quem não tem app)

**Status:** In Review
**Autor:** Nicolas (via Claude)
**Criado em:** 2026-10-20
**Versão:** 0.1
**Épico:** [E3 agenda](../../../../../epicos/portal-parceiro-e3-agenda.md)
**Depende de:** [E3-02 agenda](02-agenda-e-agendamentos.md)

---

## Visão Geral

O catálogo de notificações da agenda ao responsável, entregue numa leva só, porque os registros do app são `Record` fechados (doc 09 do portal, seção 12):
- criado pela clínica, véspera, remarcado, cancelado, falta, pré-consulta pendente, oferta de vaga, retorno pendente e reforço de vacina próximo;
- os do pedido online;
- os cron que disparam os temporais;
- o **comprovante** de cada aviso enviado (o que a recepção escreveu, quando e por qual canal);
- o caminho para quem não tem o app.

## Motivação

- O doc 01 do portal (L8) pede o rastro dos avisos: "o texto da remarcação é digitado, confirmado e some". Numa tela onde "errar aqui liga para o tutor errado", o comprovante é parte do fluxo.
- O doc 09 (seção 12) lista os 12 tipos, rotas e regras: sem preposição antes do nome da clínica; boletim nunca adianta conteúdo; horário é o da clínica; a mensagem da clínica vai dentro da tela, não no push; família recebe com `paraMembro`.

---

## Research Findings

- Motor: `NotificacaoEmissorService.emitir` (best-effort); tipo novo exige enum (migration), `CATEGORIA_POR_TIPO`, `EMAIL_POR_TIPO`, `ROTA_POR_TIPO`, catálogo nos 6 locales e `audit:notificacao-rotas` no CI (inventário 3.3).
- Quiet hours de 22h a 8h no fuso do aparelho; `pushAdiadoPara` segura o push.
- Idempotência de detector periódico por `NotificacaoMarcador (tipo, alvoId)`.
- O doc 06 do portal registra o custo: "cada tipo de aviso novo custa uma release do app" e "texto escrito pela clínica não passa por tradução num app que roda em 4 locales".
- Categoria `CLINICO`: desligada pelo usuário silencia só o push (a inbox fica).

**Breaking changes:** nenhuma (tipos novos). O app precisa das entradas novas na mesma leva (handoff).

## Decisões

- **D1 Uma leva.** Todos os tipos da agenda e do pedido nascem juntos no enum e no catálogo, mesmo que alguns só disparem quando a spec dona deles estiver pronta.
- **D2 Título e corpo do catálogo; texto da clínica dentro da tela.** O push usa o catálogo no idioma do aparelho. A `mensagemDaClinica` (remarcação, oferta, recusa) aparece na tela citada, com o `idioma` em que foi escrita (doc 09, seção 1.4).
- **D3 Comprovante sempre.** Todo aviso disparado por ato da clínica grava `AvisoAoResponsavel` com o tipo, o canal (`PUSH_INBOX`, `EMAIL`, `PAGINA_TOKEN`), o texto da clínica e o resultado de entrega quando houver (recibo do Expo).
- **D4 Véspera às 18h no fuso da clínica**, só para agendamento não confirmado, com marcador de idempotência por agendamento.
- **D5 Quem não tem app:** visitante do link recebe e-mail (se deixou) e a página do token mostra o estado. Para cliente cadastrado no balcão sem app, a clínica avisa como sempre (telefone); o portal mostra "sem canal no app" no agendamento.
- **D6 Óbito e transferência nunca notificam** (regra transversal P5); falta com motivo óbito também não.

## Tipos (categoria `CLINICO`, rota em `/screens/clinica/*`, `paraMembro` para família)

| Tipo | Quando | Spec que dispara |
|---|---|---|
| `AGENDAMENTO_CRIADO_PELA_CLINICA` | a recepção marcou | E3-02 |
| `AGENDAMENTO_LEMBRETE_VESPERA` | 18h da véspera, sem confirmação | esta (cron) |
| `AGENDAMENTO_REMARCADO` | mudou dia, hora ou profissional | E3-02 |
| `AGENDAMENTO_CANCELADO_PELA_CLINICA` | a clínica cancelou | E3-02 |
| `AGENDAMENTO_FALTA` | a clínica marcou falta | E3-03 |
| `PRE_CONSULTA_PENDENTE` | 24 h antes, sem resposta | E3-07 (cron) |
| `FILA_VAGA_OFERECIDA` | oferta com prazo | E3-04 |
| `PEDIDO_ACEITO`, `PEDIDO_MARCADO_EM_OUTRO_HORARIO`, `PEDIDO_RECUSADO` | resposta ao pedido | E3-05 |
| `RETORNO_PENDENTE` | o retorno sugerido venceu sem horário | esta (cron diário) |
| `VACINA_REFORCO_PROXIMO` | reforço da clínica entrou nos 30 dias | E4-04 (cron) |

Para a equipe (categoria `PARCEIRO`, via E1-06): `PEDIDO_HORARIO_RECEBIDO`, `FILA_OFERTA_ACEITA`, `AGENDAMENTO_CANCELADO_PELO_RESPONSAVEL`, `PRE_CONSULTA_RESPONDIDA`.

Os tipos da publicação (`ATENDIMENTO_RESUMO_DISPONIVEL`, `ATENDIMENTO_RESUMO_ATUALIZADO`, `VACINA_REGISTRADA_PELA_CLINICA`, `CLINICA_ANULOU_REGISTRO`) são da [E2-04](../e2-pacientes-e-ponte/04-publicacao-no-app.md), e os do vínculo, da [E2-02](../e2-pacientes-e-ponte/02-vinculo-e-consentimento.md). Para o app, a leva única junta os três conjuntos.

## Modelo de dados (aditivo)

```prisma
enum CanalAviso { PUSH_INBOX EMAIL PAGINA_TOKEN NENHUM }

model AvisoAoResponsavel {
  id               String     @id @default(cuid())
  parceiroId       String
  agendamentoId    String?
  pedidoId         String?
  filaId           String?
  tipo             String     // TipoNotificacao
  canal            CanalAviso
  mensagemDaClinica String?
  idiomaDaMensagem String?
  notificacaoId    String?
  enviadoPorId     String?    // null = automático
  enviadoEm        DateTime   @default(now())
  @@index([agendamentoId])
  @@index([parceiroId, enviadoEm])
}
```

## Rotas

| Método e rota | Quem | Descrição |
|---|---|---|
| `GET /parceiro/portal/clinica/agendamentos/:id/avisos` | `agenda.ler` | Comprovantes do agendamento (L8 do doc 01) |
| `GET /tutor/clinica/avisos/:notificacaoId` | dono | Mensagem da clínica citada, com idioma, quando houver |

Crons (advisory lock, monitor Sentry): véspera a cada 15 min por fuso de estabelecimento; retorno pendente diário às 10h no fuso da clínica.

## Acceptance Criteria

- [ ] Os 12 tipos ao responsável e os 4 da equipe existem no enum, no catálogo dos 6 locales (en-GB explícito, sem travessão, "responsável" em pt) e passam no `audit:notificacao-rotas` e no `lint:copy`.
- [ ] **Given** agendamento amanhã às 09:00, não confirmado **When** o cron roda às 18:00 local **Then** sai uma véspera só (marcador), para o dono e a família com `paraMembro: true`.
- [ ] **Given** remarcação com mensagem da clínica **Then** o push tem só o texto do catálogo, e a mensagem fica no comprovante e na tela do app.
- [ ] **Given** falta com motivo óbito **Then** nada é enviado e nenhum comprovante de envio é gravado (só o registro de que não se avisou).
- [ ] **Given** cliente sem app **Then** o comprovante registra `canal=NENHUM`, e a agenda mostra que a clínica precisa ligar.

## Estratégia de Testes

- Unit: catálogo (forma, locales, travessão), véspera (fuso, idempotência), retorno pendente, comprovantes.
- Regressão: suíte de notificações verde.

## Arquivos Impactados

| Arquivo | Ação |
|---|---|
| `prisma/schema.prisma` + migration | Enum `TipoNotificacao` (+16) e `AvisoAoResponsavel` |
| `src/notificacao/catalogo/notificacao-catalogo.ts` e registros exaustivos | Modificar |
| `src/agenda/avisos/` (service de comprovante, crons) | Criar |

## Tasks

- [ ] **T1** Enum e catálogo (6 locales) com `lint:copy`
- [ ] **T2** Comprovante e serviço que os domínios chamam
- [ ] **T3** Crons de véspera e retorno
- [ ] **T4** Testes e handoff do app (leva única dos tipos, `ROTA_POR_TIPO`, `AFETA_HOME_POR_TIPO`)

## Riscos e Mitigações

| Nível | Risco | Mitigação |
|---|---|---|
| Médio | Release do app sem as rotas dos tipos novos quebrar o `tsc` ou cair em "Unmatched Route" | Leva única de tipos (D1) e handoff com `ROTA_POR_TIPO` completo; o CI roda `audit:notificacao-rotas` |
| Médio | Véspera duplicada em 3 réplicas | Marcador `(tipo, agendamentoId)` e advisory lock no cron |

## Rollout / Rollback

Aditivo e atrás do módulo (E1-02): nada aparece para parceiro sem o módulo ligado. Migration só cria tabelas e colunas; rollback é reverter o código, e as tabelas ficam sem leitor.

## Change Log

| Data | Versão | Mudança | Autor |
|---|---|---|---|
| 2026-10-20 | 0.1 | Criação | Nicolas (via Claude) |
