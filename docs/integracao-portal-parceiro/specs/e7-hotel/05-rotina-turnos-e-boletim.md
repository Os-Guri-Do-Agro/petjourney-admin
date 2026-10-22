# Spec: Rotina do hotel, prancheta, ocorrências, passagem de turno e boletim

**Status:** In Review
**Autor:** Nicolas (via Claude)
**Criado em:** 2026-10-20
**Versão:** 0.1
**Épico:** [E7 hotel](../../../../../epicos/portal-parceiro-e7-hotel.md)
**Depende de:** [E7-04 estadia](04-check-in-estadia-e-check-out.md), [E5-02 turnos](../e5-internacao/02-prescricao-enfermagem-e-plantoes.md) (modelo `Turno` comum)

---

## Visão Geral

O dia da casa:
- **rotina padrão** versionada (água, higiene, passeio, pesagem, com horários), publicada com prévia do efeito e desfazer;
- **ajustes por hóspede** (substitui ou suspende, com motivo) e **proposta de rotina** para o hóspede, nunca de medicação e com refeição combinada com o responsável;
- **materialização** das tarefas do dia: refeições do plano alimentar, medicações e cuidados da estadia, serviços vendidos e itens da rotina;
- **prancheta** agrupada em rondas (horário por tipo), com "marcar a ronda inteira", exceto medicação;
- **diário** do hóspede;
- **ocorrências** (leve vai ao diário; grave exige contato e trava turno e boletim, R3);
- **passagem de turno**;
- **boletim** ao responsável (12, 24 ou 48 h).

## Motivação

Docs `hotel/README` (D13 a D19) e tipos:
- `ItemDeRotina`, `RotinaPadrao`, `AjusteDeRotina`, `PublicacaoDeRotina`, `TarefaDeRotina`, `TarefaKind`, `RegistroDoDiario`, `Ocorrencia`, `GravidadeDaOcorrencia`, `Boletim` e `PreferenciaDeBoletim` (`petjourney-admin/src/features/hotel/data/types.ts:855-1148`);
- domínio `rotina.ts` (janela de 30 min, rondas, `RONDA_ABRE_ATE = 6`), `rotina-padrao.ts` (`MAX_HORARIOS_POR_ITEM = 12`, `rotinaEfetiva`, `previsaoDaPublicacao`), `rotina-sugerida.ts` (`proporRotina`, recusas `medicacao-nao-se-propoe` e `refeicao-combina-com-responsavel`), `materializacao.ts` (`reconciliarDia`, `conflitosReais`), `estadia.ts` (R3: `exigeContato`, `ocorrenciasTravadas`, `boletimPodeSair`).

---

## Decisões

- **D1 Materialização diária por cron** (00:05 no fuso do hotel, advisory lock) e na hora do check-in. Republicar a rotina reconcilia as tarefas futuras sem tocar nas executadas (`particionarPorImutabilidade`).
- **D2 Marcar a ronda inteira** só para tarefas que não são medicação, e uma por vez, parando na primeira falha. Medicação nunca em lote (decisão D18 do hotel).
- **D3 R3 no servidor.** Ocorrência `GRAVE` nasce com `exigeContato`. Enquanto não houver contato registrado:
  - o boletim fica retido (`BOLETIM_EXIGE_CONTATO`);
  - a passagem de turno trava (`OCORRENCIA_SEM_CONTATO`);
  - o check-out trava (E7-04).
- **D4 Turno comum** (`Turno`, `contexto=HOTEL`, E5-02), com o horário do turno que entrega e do que assume, e as pendências **em ordem de relógio**, com a data quando não é do dia (D16 do hotel).
- **D5 Proposta de rotina por regras** (o portal usa um motor de regras, não IA). Ela fica no servidor como sugestão que o balcão aprova item a item, e nunca propõe medicação.
- **D6 Boletim do hotel** (12, 24 ou 48 h; foto; push sem conteúdo) pelo mesmo mecanismo da E5-03, com retenção por ocorrência grave em vez de piora de gravidade. Só com vínculo ativo.

## Modelo de dados (aditivo, resumo)

```prisma
enum TarefaKind { REFEICAO MEDICACAO PASSEIO RECREACAO HIGIENE AGUA PESAGEM BANHO TOSA ADESTRAMENTO CUIDADO } // = TarefaKind do portal
enum OcorrenciaKind { BRIGA TENTATIVA_DE_FUGA LESAO VOMITO DIARREIA RECUSA_ALIMENTAR APATIA TOSSE ESTRESSE DESTRUICAO OUTRO }
enum RegistroDoDiarioKind { REFEICAO PASSEIO BRINCADEIRA SONO ELIMINACAO BANHO CARINHO OBSERVACAO }
enum StatusTarefa { PENDENTE FEITA RECUSADA PULADA }
enum GravidadeOcorrencia { LEVE MODERADA GRAVE }

model RotinaPadraoDoHotel { id, parceiroId, versao Int, itens Json, vigenteDesde, publicadaEm, publicadaPorId }
model AjusteDeRotina { id, hospedagemId, kind, acao (SUBSTITUI|SUSPENDE), horarios String[], motivo, origem (PESSOA|PROPOSTA), registradoEm, registradoPorId, revogadoEm? }
model TarefaDoHotel { id, hospedagemId, kind, descricao, origemId?, previstaPara, status, executadaEm?, executadaPorId?, turnoId?, observacao? ; @@unique([hospedagemId, kind, origemId, previstaPara]) }
model RegistroDoDiarioDoHotel { id, hospedagemId, kind, texto, fotoCaminho?, registradoEm, registradoPorId, turnoId? }
model OcorrenciaDoHotel { id, hospedagemId, kind, gravidade, descricao, conduta?, registradaEm, registradaPorId, exigeContato Boolean, contatoEm?, contatoPorId?, encaminhadaAoVeterinario Boolean }
model BoletimDoHotel { id, hospedagemId, status (RASCUNHO|RETIDO|ENVIADO), texto, idioma, fotos String[], geradoEm, autorId?, enviadoEm?, exigeContato Boolean, contatoEm? }
model PreferenciaDeBoletimDoHotel { hospedagemId @id, frequenciaHoras Int, fotoSempre Boolean }
```

## Rotas (`@ExigeModulo(HOTEL)`, `hotel.*`)

| Método e rota | Descrição |
|---|---|
| `GET /parceiro/portal/hotel/rotina-padrao`, `POST .../rotina-padrao/previsao`, `POST .../rotina-padrao/publicar`, `POST .../rotina-padrao/desfazer` | Rotina padrão |
| `GET /parceiro/portal/hotel/hospedagens/:id/proposta-de-rotina`, `POST .../aprovar`, `POST .../ajustes`, `DELETE .../ajustes/:aid` | Por hóspede |
| `GET /parceiro/portal/hotel/prancheta?dia=` | Tarefas em rondas, com tempo (agora, adiante, passado) e progresso |
| `POST /parceiro/portal/hotel/tarefas/:id/marcar` e `POST .../tarefas/ronda` | D2 |
| `POST .../hospedagens/:id/diario`, `POST .../hospedagens/:id/ocorrencias`, `POST .../ocorrencias/:id/contato` | Diário e R3 |
| `GET /parceiro/portal/clinica/turnos/atual?contexto=HOTEL` e `POST .../turnos/:id/entregar` | Turno comum (E5-02) |
| `POST .../hospedagens/:id/boletins`, `POST .../boletins/:id/enviar` | Boletim |
| `GET /tutor/hotel/hospedagens?petId=`, `GET /tutor/hotel/hospedagens/:id/boletins`, `PUT .../preferencias` | Lado do app |

Contadores (E1-06): `tarefasAtrasadas`, `ocorrenciasSemContato`, `boletinsDoHotelRetidos`.

## Acceptance Criteria

- [ ] **Given** banho vendido para o dia 2 **Then** a prancheta do dia 2 tem a tarefa de banho com a origem (costura 1 do D13).
- [ ] **Given** ronda de refeição com 20 animais **When** marca a ronda **Then** as 20 viram FEITA, uma por vez; uma ronda de medicação **Then** 409 `MEDICACAO_NAO_ACEITA_LOTE`.
- [ ] **Given** ocorrência grave sem contato **Then** enviar boletim dá 409 `BOLETIM_EXIGE_CONTATO` e entregar o turno dá 409 `OCORRENCIA_SEM_CONTATO`.
- [ ] **Given** republicar a rotina padrão **Then** as tarefas futuras são reconciliadas e as feitas não mudam.
- [ ] **Given** proposta de rotina **Then** nenhuma sugestão é de medicação.
- [ ] A passagem lista as pendências em ordem de relógio com a data das que são de ontem.

## Estratégia de Testes

- Unit: golden tests de `rotina.spec`, `rotina-padrao.spec`, `rotina-sugerida.spec`, `materializacao.spec`, `estadia.spec`.
- Integration: cron de materialização em 3 réplicas sem duplicar (unique).

## Arquivos Impactados

| Arquivo | Ação |
|---|---|
| `prisma/schema.prisma` + migration | Modificar |
| `src/hotel/rotina/` (rotina padrão, proposta, prancheta, cron, ocorrências, boletim) | Criar |

## Tasks

- [ ] **T1** Migration
- [ ] **T2** Rotina padrão, ajustes, proposta
- [ ] **T3** Materialização e prancheta
- [ ] **T4** Diário, ocorrências (R3), turno
- [ ] **T5** Boletim e rotas do app; contadores; handoff

## Riscos e Mitigações

| Nível | Risco | Mitigação |
|---|---|---|
| Alto | Ocorrência grave chegando ao responsável só pelo app | R3 no servidor: retém boletim, trava turno e check-out até o contato |
| Médio | Medicação marcada em lote sem ninguém dar | Lote proibido para medicação (D2) |

## Rollout / Rollback

Aditivo e atrás do módulo (E1-02): nada aparece para parceiro sem o módulo ligado. Migration só cria tabelas e colunas; rollback é reverter o código, e as tabelas ficam sem leitor.

## Change Log

| Data | Versão | Mudança | Autor |
|---|---|---|---|
| 2026-10-20 | 0.1 | Criação | Nicolas (via Claude) |
