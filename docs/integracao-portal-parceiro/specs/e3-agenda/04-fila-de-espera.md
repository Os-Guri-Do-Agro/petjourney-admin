# Spec: Fila de espera com oferta de vaga

**Status:** In Review
**Autor:** Nicolas (via Claude)
**Criado em:** 2026-10-20
**Versão:** 0.1
**Épico:** [E3 agenda](../../../../../epicos/portal-parceiro-e3-agenda.md)
**Depende de:** [E3-02 agenda](02-agenda-e-agendamentos.md), [E3-06 avisos](06-avisos-clinicos-ao-responsavel.md) (para a oferta chegar)

---

## Visão Geral

Quem não achou horário entra na fila com as janelas que aceita (dia da semana e horário), a prioridade e o profissional (ou qualquer um). Quando um horário vaga (cancelamento, falta, remarcação), a API acha quem cabe, a recepção revê a mensagem e oferta; o responsável tem um prazo para aceitar pelo app; o aceite cria o agendamento de forma atômica.

## Motivação

Doc 01 do portal (bloco D): posição na fila "sou o quantos?" (L5), prévia da mensagem com o prazo (L6), entrar na fila pela tela (L7). Tipos `WaitlistEntry`, `WaitlistWindow`, `WaitlistPriority` (`petjourney-admin/src/features/clinico/data/types.ts:487-523`); regras de posição em `domain/waitlist.ts` (prioridade e depois antiguidade, quem já recebeu oferta fora da contagem, 7 testes); erros `OFERTA_EXPIRADA` e `VAGA_JA_PREENCHIDA` (`waitlist-repository.ts:37-53`); prazo de oferta da política (30 min no fixture). O doc 09 (seção 20, item 11) pede: "oferta de vaga não segura o horário: o aceite confere a vaga de forma atômica".

---

## Decisões

- **D1 Posição calculada no servidor**, nunca guardada: prioridade (`URGENTE` > `PREFERENCIAL` > `NORMAL`), depois `criadoEm`, sem contar quem está com oferta aberta.
- **D2 A oferta não segura o horário.** A recepção pode encaixar alguém por cima; o aceite confere a vaga numa transação com advisory lock por `(profissional, dia)` e responde `VAGA_JA_PREENCHIDA` se perdeu.
- **D3 Uma oferta aberta por entrada.** Ofertar de novo exige a anterior expirada ou recusada.
- **D4 Expiração preguiçosa e por cron.** A leitura marca `EXPIRADO` (padrão do acesso temporário, `compartilhamento-prestador.service.ts:1901-1951`); um cron de 5 min expira e tira a oferta do contador.
- **D5 A mensagem é da clínica**, revista na tela, com o prazo dentro do texto, e guardada como comprovante (E3-06).
- **D6 Entrar na fila também pelo app**, quando a busca de horário volta vazia (estado vazio do doc 09, seção 3).

## Modelo de dados (aditivo)

```prisma
enum StatusFila { AGUARDANDO OFERTADO ACEITO EXPIRADO RECUSADO REMOVIDO }
enum PrioridadeFila { NORMAL PREFERENCIAL URGENTE }

model EntradaNaFila {
  id                 String         @id @default(cuid())
  parceiroId         String
  pacienteId         String
  tipoId             String
  profissionalId     String?        // null = qualquer
  prioridade         PrioridadeFila @default(NORMAL)
  janelas            Json           // [{ diaSemana, inicio, fim }], até 14
  status             StatusFila     @default(AGUARDANDO)
  observacao         String?
  origem             String         // RECEPCAO | APP
  ofertaInicio       DateTime?
  ofertaProfissionalId String?
  ofertaExpiraEm     DateTime?
  ofertaMensagem     String?
  agendamentoId      String?
  criadoEm           DateTime       @default(now())
  @@index([parceiroId, status])
}
```

## Rotas

| Método e rota | Quem | Descrição |
|---|---|---|
| `GET /parceiro/portal/clinica/fila` | `agenda.ler` | Entradas com `posicao` e janelas agrupadas |
| `POST /parceiro/portal/clinica/fila` | `fila.gerir` | Entrar (recepção) |
| `DELETE /parceiro/portal/clinica/fila/:id` | `fila.gerir` | Remover |
| `GET /parceiro/portal/clinica/fila/elegiveis?inicio=&profissionalId=` | `agenda.ler` | Quem cabe na vaga (janela, tipo, profissional), na ordem da posição |
| `POST /parceiro/portal/clinica/fila/:id/ofertar` | `fila.gerir` | `{ inicio, profissionalId, mensagem }`; envia `FILA_VAGA_OFERECIDA` com `expiraEm` |
| `GET /tutor/clinica/fila?petId=` | dono ou família | `EntradaNaFila` do contrato com `posicao`, `oferta { inicio, expiraEm, mensagemDaClinica }` |
| `POST /tutor/clinica/fila` | dono | `EntrarNaFila` (janelas, prioridade sempre NORMAL pelo app) |
| `DELETE /tutor/clinica/fila/:id` | dono | Sair |
| `POST /tutor/clinica/fila/:id/oferta/aceitar` | dono | Cria `Agendamento` `origem=FILA`, `CONFIRMADO`; 410 `OFERTA_EXPIRADA`, 409 `VAGA_JA_PREENCHIDA` |
| `POST /tutor/clinica/fila/:id/oferta/recusar` | dono | Volta para `AGUARDANDO` sem perder a antiguidade |

Contador da E1-06: `filaComOferta` e `fila`.

## Acceptance Criteria

- [ ] **Given** três entradas (normal antiga, urgente nova, preferencial) **Then** as posições são urgente 1, preferencial 2, normal 3 (casos de `waitlist.spec` do portal).
- [ ] **Given** uma oferta aberta **Then** essa entrada sai da contagem de posição das outras.
- [ ] **Given** oferta expirada **When** aceita **Then** 410 `OFERTA_EXPIRADA`.
- [ ] **Given** a recepção encaixou alguém no horário ofertado **When** o responsável aceita **Then** 409 `VAGA_JA_PREENCHIDA` e a entrada volta a `AGUARDANDO`.
- [ ] **Given** dois aceites simultâneos de ofertas diferentes para o mesmo horário **Then** um ganha (teste de integração com advisory lock).
- [ ] **Given** recusar **Then** a entrada mantém o `criadoEm` original.

## Estratégia de Testes

- Unit: posição (golden tests), elegibilidade por janela e tipo, expiração.
- Integration: corrida de aceites.

## Arquivos Impactados

| Arquivo | Ação |
|---|---|
| `prisma/schema.prisma` + migration | Modificar |
| `src/agenda/fila/` (service, controllers, cron, `regras/posicao.ts`) | Criar |

## Tasks

- [ ] **T1** Migration
- [ ] **T2** Regras e leituras
- [ ] **T3** Ofertar, aceitar (atômico), recusar, expirar
- [ ] **T4** Rotas do app, contadores, testes

## Riscos e Mitigações

| Nível | Risco | Mitigação |
|---|---|---|
| Alto | Duas pessoas aceitando a mesma vaga | Advisory lock por profissional e dia no aceite (D2) e teste de corrida |
| Médio | Oferta que expira sem o responsável ver (push atrasado) | Prazo configurável (E3-01), expiração preguiçosa e por cron, e a recepção vê quem não respondeu para ligar |

## Rollout / Rollback

Aditivo e atrás do módulo (E1-02): nada aparece para parceiro sem o módulo ligado. Migration só cria tabelas e colunas; rollback é reverter o código, e as tabelas ficam sem leitor.

## Change Log

| Data | Versão | Mudança | Autor |
|---|---|---|---|
| 2026-10-20 | 0.1 | Criação | Nicolas (via Claude) |
