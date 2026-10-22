# Spec: Agenda e agendamentos

**Status:** Concluído (API em dev, 2026-10-21; front em novembro com o Luís)
**Autor:** Nicolas (via Claude)
**Criado em:** 2026-10-20
**Versão:** 0.4
**Épico:** [E3 agenda](../../../../../epicos/portal-parceiro-e3-agenda.md)
**Depende de:** [E3-01 configuração](01-configuracao-da-agenda.md), [E2-01 pacientes](../e2-pacientes-e-ponte/01-clientes-e-pacientes.md), [E1-04 contrato](../e1-fundacao/04-contrato-erros-e-rotas-publicas.md)

---

## Visão Geral

O núcleo da recepção, com as regras no servidor:
- dia por profissional ou por sala, e semana com carga por profissional e por período;
- criar, encaixar, mover (inclusive arrastando entre colunas), editar, cancelar com motivo e desfazer a última ação;
- confirmar presença, registrar chegada, iniciar e finalizar;
- sugestão de horários livres (reagendar, retorno);
- conflitos tipados em toda resposta.

Do lado do responsável, a lista e o detalhe dos agendamentos dele, confirmar presença e cancelar dentro do prazo.

## Motivação

O doc 01 do portal: "Dá para percorrer um dia inteiro de uma clínica de três vets no protótipo: marcar, encaixar, bloquear, arrastar e cancelar, sem sair da tela." Os tipos `Appointment`, `Conflict`, `Hold`, `AgendaDia`, `DiaCarga`, `CargaDoProfissional`, `SlotSugestao` (`petjourney-admin/src/features/clinico/data/types.ts:276-458`, `:1551-1618`) e o repositório `agendaRepository` (`data/repositories/agenda-repository.ts:157-685`) definem as operações. As regras estão em `domain/conflicts.ts`, `domain/slots.ts`, `domain/load.ts` (capacidade de 8 h por profissional), `domain/overlap.ts` e `domain/politica.ts` (confirmação abre 48 h antes).

---

## Research Findings

- **Status:** `agendado → confirmado → aguardando (chegou) → em-atendimento → finalizado`, com saídas `falta` e `cancelado` (`types.ts:276-283`).
- **Origens:** recepção, app, link, telefone, encaixe, retorno, fila (`:293-300`).
- **Motivos de cancelamento:** responsável desmarcou, clínica remarcou, paciente indisponível, duplicado, outro (`:302-307`).
- **Conflitos (`kind`):**
  - `professional-overlap`, `room-overlap`, `pet-double-book`, `block-invasion`, `outside-hours`, `lunch-overlap`, `holiday-closed`, `over-capacity`, `type-room-mismatch`;
  - severidade `info`, `warning` ou `blocking`, onde `blocking` só para feriado fechado, "ainda assim contornável" (`:464-485`, doc 01).
- **Defeito D1 do doc 01:** arrastar no agrupamento por sala gravava id de sala no profissional. A API recebe o destino tipado (`{ profissionalId? , salaIds? }`), nunca "a coluna".
- **Desfazer de 8 s** (`stores/agenda.ts:43`); **atendimento em duas salas** via `linkedGroupId`; **reserva de 5 min** (`Hold`).
- **API:** sem nada de agenda (inventário 2.10). Fuso do estabelecimento e dias especiais da E1-01; política da E3-01.

**Breaking changes:** nenhuma.

## Decisões

- **D1 Conflito calculado em toda leitura e escrita**, com o porte de `detectarConflitos` (golden tests do portal), e devolvido como `{ kind, severity, params }`. Escrita com conflito `blocking` exige `confirmarConflitos: ['holiday-closed']` no corpo (o "contornável" vira gesto explícito).
- **D2 Conflito novo `pedido-pendente`.** Marcar por cima de um horário segurado por pedido online pendente (E3-05) ou por reserva ativa avisa antes (lacuna listada no doc 18 do portal).
- **D3 Grupo ligado.** Um atendimento em duas salas (cirurgia + recuperação) é um `GrupoDeAgendamento` com N linhas; mover move o grupo inteiro.
- **D4 Versão otimista.** Todo `PATCH`/ação manda `versao`; divergência dá 409 `AGENDAMENTO_ALTERADO` com o estado atual.
- **D5 Desfazer.** Toda mutação devolve `desfazerToken` (válido por 15 s no servidor, folga sobre os 8 s da tela). `POST .../desfazer` reverte se a `versao` ainda é a da mutação.
- **D6 Horário online segura; recepção não.** Reserva de horário (`ReservaDeHorario`) é só para canal online e fila; a recepção encaixa por cima de reserva com o conflito da D2.
- **D7 Prazo do responsável calculado no servidor.** `cancelarAte` = início menos `cancelarAteHorasAntes`; `podeCancelar`, `podeConfirmar` (abre 48 h antes) e `podeRemarcar` saem prontos no contrato do app.
- **D8 Chegada e início.** Chegar grava `chegadaEm` e põe na sala de espera (o painel do dia lê). Iniciar abre o atendimento (E4-01) e vira `em-atendimento`. Finalizar vem da finalização do atendimento.

### Decidido na implementação (v0.2)

- **D9 Modelo** (aditivo, migration `20261021150000_agenda_e_agendamentos`, aplicada no dev):
  - o da spec, com FKs: parceiro e paciente em `CASCADE` (a exclusão real a pedido do titular, D8 da E2-01, leva a agenda junto), profissional e tipo em `RESTRICT` (nunca se apagam);
  - **prazos da política gravados no agendamento** (`cancelarAteHorasAntes`, `confirmacaoAbreHorasAntes`): a D1 da E3-01 diz que mudar a política não reescreve o que já foi marcado, e o prazo do responsável é calculado com o que valia ao marcar;
  - `canceladoPor` (`APP` ou `RECEPCAO`, o mesmo enum da confirmação) e índice em `grupoId`;
  - `DesfazerDaAgenda` guarda o **sha256** do token (`tokenHash`), com `parceiroId` e `criadoEm`; `ReservaDeHorario` com FK para profissional e `criadoEm`;
  - CHECKs à mão: `fim > inicio` (agendamento e reserva), `versao >= 1`, até 4 salas, prazos não negativos, observação até 500, `donoTipo` em `PEDIDO_APP`/`PEDIDO_LINK`/`FILA`, uma versão por linha no desfazer;
  - o agendamento entra no registro `HISTORICOS_DO_PACIENTE` da E2-01: mesclar leva a agenda para o paciente que fica (com versão nova); não é registro clínico.
- **D10 Grupo sem tabela própria.** `grupoId` é o **id da perna principal**: o app e o contador contam um item por atendimento (`grupoId` nulo ou igual ao próprio id). Criar em grupo é `pernasLigadas` (até 3 pernas a mais, mesmo horário, paciente e profissional; cada uma com salas e tipo). Mover anda o grupo pelo mesmo deslocamento, só o alvo troca de sala e o profissional novo vale para todas (o atendimento é um só); confirmar, chegada e cancelar valem para o grupo; iniciar é por perna (cada sala começa na sua hora); PATCH só no alvo.
- **D11 Concorrência.** Toda escrita da recepção trava a linha do `Parceiro` (`FOR NO KEY UPDATE`: serializa a agenda daquela clínica e não barra as FKs) e depois as linhas do agendamento em ordem de id, sempre nessa ordem; sob a trava relê só o que pode conflitar (agendamentos do profissional, das salas por `hasSome` e do paciente, e as reservas). Expediente, bloqueios, salas e tipos são lidos fora da trava. As rotas do responsável travam só as linhas (a recepção trava o parceiro antes delas: sem ciclo). Nunca `COUNT ... FOR UPDATE`.
- **D12 Conflitos no contrato.**
  - `params` com horas em `HH:mm` da parede da clínica e ids (`agendamentoId`, `bloqueioId`, `salaId`, `reservaId`), nunca texto pronto;
  - o **expediente do profissional** manda (E3-01, D2 e D13): `outside-hours` com `motivo` `FECHADO`, `FOLGA`, `FORA_DO_EXPEDIENTE`, `FORA_DO_ESTABELECIMENTO` (a faixa própria passa do horário da clínica) ou `ESTABELECIMENTO_FECHADO`; o almoço do estabelecimento é o buraco entre as faixas (`lunch-overlap`);
  - `holiday-closed` = dia especial fechado da E1-01;
  - `type-room-mismatch` com `motivo` `SALA_INATIVA` (warning; AC5 da E3-01) ou `SALA_INCOMPATIVEL` (info);
  - bloqueio de **sala** atinge só quem usa a sala (no portal, um bloqueio de sala sem profissional atingia todo mundo);
  - carga: capacidade = a faixa do profissional no dia, no máximo 8 h (`CAPACIDADE_MINUTOS_POR_PROFISSIONAL`); o grupo conta uma vez;
  - cancelado e falta saem sem conflitos.
- **D13 Sugestões.** Só horários **sem aviso nenhum** (`slotsLivres` do portal), na faixa de cada profissional, no passo da `granularidadeMinutos` da política, por até 5 semanas, uma semana por leitura, parando quando acha a quantidade (padrão 6, até 20). Sem `profissionalId`: quem está ativo e atende na agenda. Sem sala (como o portal). Nada que já começou. O `simular` devolve, além dos conflitos por perna, as 5 melhores alternativas do mesmo dia com o mesmo profissional (`buscarAlternativas`, com os avisos de cada uma).
- **D14 Desfazer.** O token vale 15 s, é do mesmo usuário e parceiro, é gasto na transação (dois desfazer ao mesmo tempo: um passa) e reverte com **versão nova** (nunca volta o número). Desfazer de uma criação apaga as linhas (`removidos` na resposta). Vencido, alheio, já gasto ou com mudança depois: o mesmo 409 `DESFAZER_EXPIRADO`. Um cron por hora apaga os tokens vencidos.
- **D15 Situação.** Tabela de ações por status (`regras/transicoes.ts`): antes de chegar, tudo; na espera, editar, mover, cancelar e iniciar; em atendimento, só editar; encerrado, nada (409 `AGENDAMENTO_STATUS_INVALIDO` com `status` e `acao`). Iniciar sem chegada registrada grava a chegada também. `atendimentoId` fica nulo até a E4-01; finalizar é dela. Cancelar libera a vaga: o chamado da fila (E3-04) entra no ponto marcado pelo log `VAGA_LIBERADA`.
- **D16 Validações da escrita.**
  - profissional ativo e que atende na agenda (409 `PROFISSIONAL_INDISPONIVEL` com `reason`); tipo ativo (409 `TIPO_INATIVO`); sala ativa (409 `SALA_INATIVA`; no PATCH, a sala que já estava pode ficar); paciente ativo (409 `PACIENTE_INATIVO`, da E2-01);
  - início entre 30 dias atrás e 730 dias à frente; sala repetida no grupo; perna ligada sem sala; `salaIds` e `trocarSala` juntos; sala de origem que o agendamento não tem: 400 `AGENDAMENTO_INVALIDO` com `reason`;
  - origens que a recepção escolhe: `RECEPCAO`, `TELEFONE`, `ENCAIXE` (marca `encaixe`) e `RETORNO`; `APP`, `LINK` e `FILA` são dos canais online;
  - o PATCH ganhou `duracaoMinutos` (muda o fim) e `encaixe`; o mover ganhou `destino.trocarSala { de, para }` (o arrastar entre colunas de sala, D1 do doc 01), além de `salaIds` e `confirmarConflitos`;
  - `confirmar-presenca`, `chegada` e `iniciar` também mandam `versao` (D4).
- **D17 Tetos.** Dia: 1.000 agendamentos; semana: 3.000; intervalo: 31 dias e 200 por página (cursor cifrado); passou: 400 `AGENDA_LEITURA_EXCEDIDA`. Bloqueios com os tetos da E3-01 (`ocorrencias()`). Escritas (inclusive simular e desfazer): 600 por usuário por hora no balde do Postgres (`agenda-escrita:<usuario>`): 429 `AGENDAMENTO_TAXA_EXCEDIDA` com `limite` e `tenteDeNovoEmSegundos`.
- **D18 Q2 da E3-01 respondida: o teto de 5.000 ocorrências fica.** Dia e semana leem no máximo 7 dias (300 séries vivas x 7 = 2.100, longe do teto). A grade do mês não materializa o mês inteiro de uma vez: o portal lê a `semana` (cinco leituras) ou o `intervalo`, que pagina e materializa só os dias da página. Se mesmo assim passar (muitos bloqueios únicos), sai o 400 da E3-01 e a tela lê por semana.
- **D19 Responsável.**
  - lista por `quando` (`PROXIMOS`: `fim` no futuro, do mais cedo; `PASSADOS`: do mais recente), cursor cifrado por usuário, `limit` até 50; um item por atendimento (D10);
  - a família lê e não altera nada (403 `SOMENTE_LEITURA`, qualquer escopo de família, como na E2-02); pet inativo some para a família; vínculo encerrado tira o agendamento do app na hora;
  - confirmar é idempotente (já confirmado volta 200 sem gravar); fora da janela, 409 `AGENDAMENTO_ENCERRADO` com `reason` (`AINDA_NAO_ABRIU`, `JA_COMECOU`, `STATUS`);
  - cancelar aceita `motivo` estruturado (`RESPONSAVEL_DESMARCOU`, o padrão, `PACIENTE_INDISPONIVEL` ou `OUTRO`), nunca texto livre;
  - o contrato não leva observação interna, encaixe, chegada, versão nem quem criou; leva `confirmacaoAbreEm` e `somenteLeitura` a mais; `podeRemarcar` é sempre `false` até a E3-05 existir; `preConsulta` (E3-07) e `falta` (E3-03) entram nas specs donas;
  - a regra "vínculos que a pessoa lê" saiu da E2-02 para `vinculo-clinico/regras/vinculos-legiveis.ts`, usada pelas duas.
- **D20 Aviso ao responsável é da E3-06.** `avisarResponsavel` e `mensagem` (até 500) entram já no contrato do mover e do cancelar, validados, mas o disparo, os tipos de notificação e o comprovante nascem na E3-06, numa leva só (os registros do app são fechados). Hoje nada sai; o log marca `aviso=E3_06`. Esta spec não cria tipo de notificação.
- **D21 Contador da E1-06:** `agendamentosSemConfirmacao` (módulo CLINICA, `agenda.escrever`, tom ATENCAO, rota `/veterinario/agenda`): AGENDADOS que começam nas próximas 48 h, um por atendimento.
- **D22 Sem trilha clínica.** Agenda não é registro clínico (E1-05); as escritas ficam no log `[Agenda]`, sem dado pessoal.
- **D23 Contrato.** `OrigemAgendamento.LINK` é o `LINK_PUBLICO` do contrato do portal; data-hora sempre com o offset da clínica, inclusive no app (o `X-Timezone` do aparelho é ignorado).

### Revisão de segurança (v0.3, 2026-10-21)

Auditoria de 2026-10-21 (achados `SEG-2026-10-21-AGENDA-CONFLITOS-QUADRATICOS`, ALTO; `SEG-2026-10-21-AGENDA-SUGESTOES-SEM-TETO` e `SEG-2026-10-21-FAMILIA-LE-PET-INATIVO`, MÉDIO; `SEG-2026-10-21-AGENDA-BAIXOS`, BAIXO; em `qa/seguranca/achados.json`). O "nada bloqueia" (D-E3.1) deixa gravar mil agendamentos no mesmo horário, e a leitura pagava por isso ao quadrado: um conflito por sobreposição, com a hora convertida no fuso (`Intl`) a cada uma. As sugestões não tinham teto de candidatos. A família lia agendamento de pet inativo, o desfazer devolvia agendamento sem reconferir nada e `data=9999-12-31` dava 500.

- **D24 Escrita e desfazer reconferem sob a trava** (B1, `agendamentos.service.ts`):
  - criar e mover releem o paciente (ativo, sem óbito, não mesclado) e o profissional novo (ativo e atendendo na agenda) com `FOR SHARE` depois da trava do parceiro: a inativação, o óbito e o mesclar esperam a escrita terminar, e a escrita enxerga o que eles gravaram antes (409 `PACIENTE_INATIVO` com `obito` e, se mesclado, `mescladoEmId`; 409 `PROFISSIONAL_INDISPONIVEL` com `reason`). O mover passa a recusar paciente inativo (antes não conferia o paciente);
  - ordem das travas: parceiro, paciente, profissional, linhas do agendamento. O mesclar trava o paciente e depois os agendamentos, e a anonimização apaga o desfazer guardado antes de mexer nos pacientes: a mesma ordem, sem ciclo;
  - o desfazer não devolve o agendamento a um estado que a escrita recusaria: **ressuscitar** (cancelado ou falta volta a ocupar o horário) confere tudo, como o criar (paciente, profissional, tipo e salas); **voltar horário ou profissional** (o desfazer de um mover) confere o paciente, como o mover; fora isso, só o que a reversão traz de volta diferente do que está agora (profissional, tipo, salas): a sala que já estava pode ficar desativada, como no PATCH. Recusa com o mesmo 409 da escrita, a transação inteira volta e o token continua valendo; o desfazer de uma criação apaga sem conferir nada.
- **D25 Conflito agregado** (A1, `regras/conflitos.ts`):
  - conflito de lista sai um por tipo: `professional-overlap`, `room-overlap` (um por sala do candidato), `pet-double-book`, `block-invasion` e `pedido-pendente`, com `quantidade` (todos) e no máximo 5 ids (`agendamentoIds`, `bloqueioIds`, `reservaIds`, `MAX_IDS_POR_CONFLITO`); os outros `params` descrevem o primeiro, o mais cedo. Sai `agendamentoId`/`bloqueioId`/`reservaId` no singular desses (o `lunch-overlap` de bloqueio de almoço continua com o `bloqueioId` do primeiro, um só). `block-invasion` conta séries distintas (a mesma série em duas ocorrências seguidas conta uma vez);
  - no máximo **15 conflitos por linha** (`MAX_CONFLITOS_POR_LINHA`), qualquer que seja a agenda;
  - a hora de parede de cada agendamento vem calculada uma vez por linha (`noContexto`), não a cada sobreposição;
  - índice por contexto, calculado uma vez: agendamentos por profissional, paciente e sala, ordenados por início (busca binária no começo, parada no primeiro que começa depois do fim do candidato); bloqueios por profissional, sala e clínica toda, cortados por (profissional, salas, dia); a carga do dia pré-somada por profissional, com o grupo contado uma vez. Um teste de equivalência compara o índice com a conta ingênua em 300 agendas sorteadas;
  - a leitura (dia, semana, intervalo) cede o event loop (`setImmediate`) a cada 200 linhas (`agendamentosComConflitos`), como a D19 da E3-01;
  - **sem teto de sobreposição na escrita**: é decisão de produto (Q1 abaixo).
- **D26 Sugestões com teto** (M1, `agenda-leitura.service.ts`, `regras/slots.ts`):
  - no máximo **20.000 horários avaliados** por requisição (`MAX_AVALIACOES_POR_BUSCA`); passou, devolve o que achou com `buscaInterrompida: true`;
  - dentro do dia, para ao achar a quantidade (`proximosHorariosLivres`: sem preferência, a mesma ordem do `horariosLivres`, do mais cedo, empate pelo profissional);
  - dia tomado não é avaliado (`diaTomado`): dia especial fechado, sem faixa, ou um bloqueio da clínica toda ou do profissional cobrindo a faixa inteira;
  - sem `profissionalId`, no máximo **30 profissionais** (`MAX_PROFISSIONAIS_NA_BUSCA`, a ordem da agenda: nome e id), com `profissionaisAvaliados` e `profissionaisLimitados` na resposta; quem ficou de fora se acha com `profissionalId`;
  - **300 buscas por usuário por hora** no balde do Postgres (`agenda-sugestoes:<usuario>`): 429 `AGENDA_SUGESTOES_TAXA_EXCEDIDA` com `limite` e `tenteDeNovoEmSegundos`, antes de qualquer conferência.
- **D27 Óbito, inativação e anonimização** (B2):
  - o contador `agendamentosSemConfirmacao` (D21) ignora paciente inativo ou com óbito (o mesclado fica inativo);
  - na anonimização do cliente (E2-01, D8), na mesma transação: o `DesfazerDaAgenda` dos agendamentos dos pacientes dele é apagado nos dois caminhos (o retrato guardava a observação), e no ANONIMIZADO a `observacao` dos agendamentos sai, com versão nova; no EXCLUIDO a agenda já sai em cascata;
  - **o óbito não cancela os agendamentos futuros** (decisão de produto, Q2 abaixo): eles ficam na agenda, saem do contador, e a recepção cancela (o cancelar não confere paciente).
- **D28 Datas da agenda de 2000 a 2100** (B3, `configuracao/dto/data-da-agenda.ts`): `@IsDataDaAgenda()` nas datas civis da E3-02 (`data`, `de`, `ate`, `aPartirDe`) e da E3-01 (`de`, `ate`, `somenteEm`, `repeteAte`, `excecoes`); fora, 400 `AGENDA_DATA_FORA_DO_LIMITE` com `campo`, `anoMinimo` e `anoMaximo`. O `@Transform` roda na conversão, antes do class-validator, e a exceção sobe com `codigo` (o 400 do class-validator não leva). Forma errada segue com o 400 do validador. Os instantes do criar e do mover já tinham o horizonte (D16).
- **D29 Família e pet inativo** (M2, `vinculo-clinico/regras/vinculos-legiveis.ts`): para quem não é o dono, pet com `ativo === false` sai antes de `podeLerPetPelaFamilia` (que olha só a política e a delegação); o dono continua vendo o vínculo do pet inativo (D6 da E2-02). Vale para a lista do app (sem `petId`) e para "Minhas clínicas"; o detalhe e o filtro por `petId` já cortavam.
- **D30 Defesa em profundidade:** `linhasDoGrupo`, `travarGrupo`, a trava do desfazer e o `travar` do responsável filtram também por `parceiroId`.

Medição (funções puras, a mesma máquina; scripts `medir-conflitos-dia.ts`, `medir-sugestoes.ts` e `medir-sugestoes-depois.ts` no scratchpad da sessão):

| Cenário | Antes | Depois |
|---|---|---|
| Dia com 1.000 agendamentos sobrepostos (mesma profissional, sala e paciente) | 16,7 s de CPU síncrona, 2.242.000 conflitos, 330 MB de JSON | 0,19 s (0,22 a 0,39 s dentro do jest), 4 conflitos por linha, 1,8 MB |
| Dia com 250 sobrepostos | 1,06 s, 20,6 MB | 0,05 s, 0,4 MB |
| Semana no teto (3.000 sobrepostos num dia) | (não medido: acima do caso de 1.000) | 0,95 s no total, em lotes de 200 linhas |
| Semana legítima no teto (3.000 sem sobreposição, 2.100 ocorrências de bloqueio) | 0,49 s | 0,26 s |
| Sugestões, 40 profissionais, passo 5, 2.000 agendamentos por semana, nada livre | 17,1 s | 0,18 s (30 profissionais, teto de 20.000; bloco síncrono máximo 99 ms) |
| Sugestões, 20 profissionais, passo 5, dia coberto por bloqueio da clínica | 1,9 s | 0,06 s (dia pulado, 0 avaliações) |
| Sugestões, 20 profissionais, passo 10, 08:00 a 18:00, nada livre | 0,46 s | 0,13 s (teto de 20.000) |

Pelo banco de dev: o `dia` com 40 atendimentos segue com p95 de 117 ms (integração); pelo HTTP na porta 3100 (smoke), 13 profissionais sem horário livre param no teto em ~0,93 s.

## Modelo de dados (aditivo)

```prisma
enum StatusAgendamento { AGENDADO CONFIRMADO AGUARDANDO EM_ATENDIMENTO FINALIZADO FALTA CANCELADO }
enum OrigemAgendamento { RECEPCAO APP LINK TELEFONE ENCAIXE RETORNO FILA }
enum MotivoCancelamento { RESPONSAVEL_DESMARCOU CLINICA_REMARCOU PACIENTE_INDISPONIVEL DUPLICADO OUTRO }
enum QuemConfirmou { APP RECEPCAO }

model Agendamento {
  id                 String              @id @default(cuid())
  parceiroId         String
  pacienteId         String
  profissionalId     String
  tipoId             String
  inicio             DateTime
  fim                DateTime
  status             StatusAgendamento   @default(AGENDADO)
  origem             OrigemAgendamento
  encaixe            Boolean             @default(false)
  observacao         String?             // até 500
  grupoId            String?             // D3
  salaIds            String[]
  confirmadoEm       DateTime?
  confirmadoPor      QuemConfirmou?
  chegadaEm          DateTime?
  iniciadoEm         DateTime?
  finalizadoEm       DateTime?
  canceladoEm        DateTime?
  motivoCancelamento MotivoCancelamento?
  atendimentoId      String?             // E4-01
  pedidoId           String?             // E3-05
  remarcadoDeId      String?
  versao             Int                 @default(1)
  criadoPorId        String?             // null quando nasce de canal online
  criadoEm           DateTime            @default(now())
  atualizadoEm       DateTime            @updatedAt
  @@index([parceiroId, inicio])
  @@index([profissionalId, inicio])
  @@index([pacienteId, inicio])
}

model ReservaDeHorario {
  id             String   @id @default(cuid())
  parceiroId     String
  profissionalId String
  inicio         DateTime
  fim            DateTime
  expiraEm       DateTime
  donoTipo       String   // PEDIDO_APP | PEDIDO_LINK | FILA
  donoId         String?
  @@index([parceiroId, profissionalId, inicio])
}

model DesfazerDaAgenda {
  token        String   @id
  usuarioId    String
  agendamentoIds String[]
  versoes      Int[]
  estadoAnterior Json
  expiraEm     DateTime
}
```

## Rotas do parceiro (`@ExigeModulo(CLINICA)`; leitura `agenda.ler`, escrita `agenda.escrever`)

| Método e rota | Descrição |
|---|---|
| `GET /parceiro/portal/clinica/agenda/dia?data=&agrupar=PROFISSIONAL\|SALA` | `AgendaDia`: expediente, almoço, feriado, profissionais, agendamentos com conflitos, bloqueios materializados, reservas ativas |
| `GET /parceiro/portal/clinica/agenda/semana?data=` | `DiaCarga[]` com `porProfissional` (manhã e tarde, capacidade de 8 h por profissional, `CAPACIDADE_MINUTOS_POR_PROFISSIONAL`) |
| `GET /parceiro/portal/clinica/agenda/intervalo?de=&ate=&profissionalId=` | Para a gaveta de pedidos e o retorno |
| `POST /parceiro/portal/clinica/agendamentos/simular` | Mesmo corpo do criar; devolve só conflitos e alternativas (o diálogo avisa antes de gravar) |
| `POST /parceiro/portal/clinica/agendamentos` | Cria (um ou grupo); `Idempotency-Key` |
| `PATCH /parceiro/portal/clinica/agendamentos/:id` | Edita tipo, observação, salas (`versao`) |
| `POST /parceiro/portal/clinica/agendamentos/:id/mover` | `{ inicio, destino: { profissionalId?, salaIds? }, versao, avisarResponsavel?, mensagem? }` |
| `POST /parceiro/portal/clinica/agendamentos/:id/cancelar` | `{ motivo, versao, avisarResponsavel?, mensagem? }`; libera a vaga e chama a fila (E3-04) |
| `POST /parceiro/portal/clinica/agendamentos/:id/confirmar-presenca` | Recepção confirmou por telefone |
| `POST /parceiro/portal/clinica/agendamentos/:id/chegada` | `AGUARDANDO` |
| `POST /parceiro/portal/clinica/agendamentos/:id/iniciar` | Abre atendimento (E4-01) |
| `POST /parceiro/portal/clinica/agenda/desfazer` | `{ token }` |
| `GET /parceiro/portal/clinica/agenda/sugestoes?pacienteId=&tipoId=&profissionalId=&aPartirDe=&quantidade=` | Próximos horários livres (porte de `buscarAlternativas`/`slotsLivres`), avançando dias fechados |

## Rotas do responsável (`/tutor/clinica`, JWT, dono ou família)

| Método e rota | Descrição |
|---|---|
| `GET /tutor/clinica/agendamentos?petId=&cursor=` | `Agendamento` do contrato: clínica, profissional, serviço, início com offset da clínica, status, `podeConfirmar`, `podeCancelar`, `cancelarAte`, `podeRemarcar`, pré-consulta resumida |
| `GET /tutor/clinica/agendamentos/:id` | Detalhe |
| `POST /tutor/clinica/agendamentos/:id/confirmar` | 409 `AGENDAMENTO_ENCERRADO` fora da janela |
| `POST /tutor/clinica/agendamentos/:id/cancelar` | `{ motivo? }`; 409 `FORA_DO_PRAZO_DE_CANCELAMENTO` |

Remarcar pelo app é um pedido com `remarcaAgendamentoId` (E3-05); o horário antigo continua até a clínica aceitar.

## Acceptance Criteria

- [x] **Given** dois agendamentos da mesma profissional sobrepostos **Then** os dois voltam com `professional-overlap` e nenhum é recusado. *Golden em `regras/conflitos.spec.ts` (o caso do `conflicts.spec` do portal, 15 min); integração no Postgres de dev ("AC1", e dois pedidos ao mesmo tempo para a mesma profissional: os dois gravam e o dia acusa os dois); smoke HTTP.*
- [x] **Given** feriado fechado **When** cria sem `confirmarConflitos` **Then** 409 `CONFLITO_BLOQUEANTE` com a lista; com `confirmarConflitos:['holiday-closed']` **Then** cria. *`agendamentos.service.spec.ts` (nada gravado no 409), integração e smoke (com a mensagem em en-GB).*
- [x] **Given** mover no agrupamento por sala para outra sala **Then** só a sala de origem é trocada no `salaIds` e o profissional não muda (defeito D1 do doc 01 como teste). *`destino.trocarSala { de, para }` (D16): unit, integração e smoke.*
- [x] **Given** duas recepções movendo o mesmo agendamento com a mesma `versao` **Then** uma grava e a outra recebe 409 `AGENDAMENTO_ALTERADO` com o estado atual. *Integração com os dois pedidos ao mesmo tempo (um 200, um 409 com `atual` na versão nova); unit e smoke (inclusive a recepção com a versão de antes do cancelamento pelo app).*
- [x] **Given** uma mutação e o desfazer em 10 s **Then** o estado volta; depois de outra mutação no mesmo agendamento **Then** 409 `DESFAZER_EXPIRADO`. *Integração (10 s, token gasto, outra mutação depois, token de outro usuário e 16 s), unit e smoke.*
- [x] **Given** um horário segurado por pedido online **When** a recepção cria por cima **Then** cria com o conflito `pedido-pendente`. *Golden e integração (a reserva é gravada direto no banco: quem grava reserva é a E3-05).*
- [ ] **Given** agendamento às 10:00 e política de 2 h **When** o responsável cancela às 08:01 **Then** 409 `FORA_DO_PRAZO_DE_CANCELAMENTO`; às 07:59 **Then** cancela e a fila é chamada. *Parcial: o prazo está pronto e testado (golden em `regras/prazo.spec.ts`, `agenda-responsavel.service.spec.ts`, integração com o relógio às 08:01 e às 07:59, smoke a 1 h do horário). "A fila é chamada" é da E3-04, que ainda não existe: o ponto de chamada está marcado pelo log `VAGA_LIBERADA` (recepção e app).*
- [x] **Given** a clínica em `America/Sao_Paulo` e o aparelho em `Europe/Lisbon` **Then** o app recebe `inicio` com `-03:00`. *Smoke com `X-Timezone: Europe/Lisbon`; integração (`datasEmUtc` vazio) e unit.*
- [x] Paciente de outro parceiro em `pacienteId` dá 403; família com LEITURA não confirma nem cancela (403 `SOMENTE_LEITURA`). *Integração (paciente, sala, tipo e profissional de outro parceiro; família de verdade com `FamiliaPet` LEITURA), unit e smoke.*
- [x] Os 40 atendimentos do "dia âncora" do portal (`data/seed.ts`, `casosDoDiaAncora`) carregam em `GET .../dia` em menos de 300 ms p95 (seed de teste). *Integração com 40 atendimentos de 3 profissionais num dia, 20 leituras do `dia()` contra o Postgres de dev a partir da máquina local: p50 124 ms, p95 134 ms, máximo 137 ms (2026-10-21).*

## Estratégia de Testes

- Unit: conflitos (golden tests do `conflicts.spec` do portal), slots e alternativas, carga, prazo do responsável, grupo ligado, desfazer.
- Integration: corrida de versão, reserva online versus encaixe.
- Cenários: outro parceiro, outro tutor, família LEITURA.

## Arquivos Impactados

| Arquivo | Ação |
|---|---|
| `prisma/schema.prisma` + `prisma/migrations/20261021150000_agenda_e_agendamentos/` | Modificar / criar |
| `src/agenda/agendamentos/` (`agenda-parceiro.controller.ts`, `agenda-responsavel.controller.ts`, `agenda-leitura.service.ts`, `agendamentos.service.ts`, `agenda-responsavel.service.ts`, `contexto-da-agenda.service.ts`, `agenda-apoio.ts`, `contadores-da-agenda.ts`, `agenda.module.ts`, `dto/`, `regras/conflitos.ts`, `regras/slots.ts`, `regras/carga.ts`, `regras/prazo.ts`, `regras/transicoes.ts`, `regras/desfazer.ts`, `regras/expediente-do-dia.ts`, testes) | Criar |
| `test/agenda/clinica-de-teste.ts` | A clínica dos golden tests (a mesma do `conflicts.spec` do portal) |
| `src/auth/services/ownership.service.ts` + `ownership.agenda-agendamento.spec.ts` | `assertAgendamentoDoParceiro`, `assertAgendamentoDoTutor`; `atendeNaAgenda` no select do profissional e `duracaoMinutos` no do tipo |
| `src/vinculo-clinico/regras/vinculos-legiveis.ts`, `vinculo-clinico.service.ts` | A regra "vínculos que a pessoa lê", agora dividida com a agenda |
| `src/pacientes-parceiro/regras/historico.ts` | A agenda no registro de históricos (mesclar) |
| `src/common/errors/error-catalog.ts`, `codigos-clinicos.ts` | 11 chaves novas nos 6 locales; 9 novas em `codigos-clinicos.ts` (`FORA_DO_PRAZO_DE_CANCELAMENTO` e `AGENDAMENTO_ENCERRADO` já estavam lá, vindas do contrato do portal) |
| `src/agenda/configuracao/dto/bloqueio.dto.ts` | Exporta o padrão do instante com offset |
| `src/app.module.ts` | `AgendaModule` |
| `scripts/smoke-agenda.ts`, `package.json` | Smoke HTTP (`npm run script:smoke-agenda`) |
| `qa/cenarios/portal-parceiro.json` | 23 cenários `REG-AGENDA-*` novos |
| `contrato/openapi.json` | 17 rotas |
| `docs/frontend/novembro-2026/portal-parceiro-e3.md`, `README.md` | Handoff do portal e do app |
| `src/agenda/agendamentos/regras/conflitos.ts`, `regras/slots.ts`, `agenda-leitura.service.ts`, `agenda-apoio.ts`, `agendamentos.service.ts`, `agenda-responsavel.service.ts`, `contadores-da-agenda.ts`, `agenda-parceiro.controller.ts`, `dto/agenda.dto.ts` + testes (`regras/conflitos-custo.spec.ts`, `agenda-leitura.service.spec.ts`) | Revisão v0.3: conflito agregado, índice, sugestões com teto, reconferência sob a trava, contador sem óbito |
| `src/agenda/configuracao/dto/data-da-agenda.ts` (+ spec), `configuracao/dto/bloqueio.dto.ts` | Revisão v0.3: datas da agenda de 2000 a 2100 (E3-01 e E3-02) |
| `src/vinculo-clinico/regras/vinculos-legiveis.ts` (+ spec), `vinculo-clinico.integration.spec.ts` | Revisão v0.3: família não lê pet inativo |
| `src/pacientes-parceiro/clientes-parceiro.service.ts` (+ spec e integração) | Revisão v0.3: anonimização limpa a observação da agenda e o desfazer guardado |
| `src/common/errors/error-catalog.ts`, `codigos-clinicos.ts` | Revisão v0.3: `AGENDA_SUGESTOES_TAXA_EXCEDIDA` e `AGENDA_DATA_FORA_DO_LIMITE` nos 6 locales |
| `qa/cenarios/portal-parceiro.json`, `qa/seguranca/achados.json` | Revisão v0.3: 6 cenários `REG-AGENDA-*` e 4 achados |

## Tasks

- [x] **T1** Migration (`20261021150000_agenda_e_agendamentos`, aplicada no dev, diff vazio depois)
- [x] **T2** Porte das regras com golden tests *(T1)* (conflitos, slots, carga, prazo, transições e desfazer: 47 testes)
- [x] **T3** Leituras de dia, semana, intervalo, sugestões *(T2)*
- [x] **T4** Escritas com versão, grupo, idempotência e desfazer *(T2)*
- [x] **T5** Rotas do responsável com prazos prontos *(T4)*
- [x] **T6** Cenários, contadores registrados na E1-06 (agendamentos sem confirmação nas próximas 48 h), handoff

## Perguntas em Aberto

- [ ] **Q1** Teto de sobreposição na escrita? Hoje nada bloqueia (D-E3.1): a recepção grava quantos agendamentos quiser no mesmo horário, e a v0.3 tornou a leitura barata para isso (conflito agregado, D25), sem limitar a escrita. Um teto (ex.: N agendamentos ativos do mesmo profissional no mesmo intervalo, 409 com código) seguraria um script ou um erro de importação, mas é regra de produto: encaixe em massa (vacinação, mutirão) pode querer mais de 10 no mesmo horário. Responsável: Nicolas.
- [ ] **Q2** O óbito do paciente cancela sozinho os agendamentos futuros? Hoje não (D27): eles ficam na agenda, saem do contador `agendamentosSemConfirmacao`, a escrita nova recusa o paciente (409 `PACIENTE_INATIVO`) e a recepção cancela à mão. Cancelar sozinho evitaria a vaga presa e o lembrete (E3-06) para o pet que morreu, mas apaga a decisão da clínica (avisar a família antes, por exemplo) e precisa de motivo de cancelamento próprio. Responsável: Nicolas, antes da E3-06 (avisos).

## Rollout / Rollback

Aditivo, atrás do módulo. Rollback reverte o código.

## Riscos e Mitigações

| Nível | Risco | Mitigação |
|---|---|---|
| Alto | Duas recepções gravando o mesmo agendamento e uma sobrescrevendo a outra | Versão otimista (D4) com 409 e o estado atual |
| Médio | Dia carregado ficar lento com 40 atendimentos, bloqueios e conflitos | Conflitos calculados em memória sobre o dia carregado uma vez; meta de 300 ms p95 no AC |
| Médio | Fuso do aparelho diferente do da clínica confundir o responsável | Data-hora sempre com o offset da clínica; o app mostra "horário da clínica" |

## Change Log

| Data | Versão | Mudança | Autor |
|---|---|---|---|
| 2026-10-20 | 0.1 | Criação | Nicolas (via Claude) |
| 2026-10-21 | 0.2 | Implementação da API (T1 a T6) em dev: migration `20261021150000_agenda_e_agendamentos`, 17 rotas (13 da clínica, 4 do app), regras portadas com golden tests, integração no Postgres de dev (22 testes, p95 do dia com 40 atendimentos em 134 ms), smoke HTTP 44/44, 23 cenários `REG-AGENDA-*`, contador da E1-06 e handoff. Decidido na implementação: D9 a D23 (prazos gravados no agendamento, grupo pelo id da principal, trava do parceiro, conflitos com o expediente do profissional, sugestões só sem aviso, desfazer com hash e versão nova, tetos, Q2 da E3-01, contrato do app, avisos para a E3-06). AC do prazo parcial (a fila é da E3-04) | Claude |
| 2026-10-21 | 0.3 | Revisão de segurança (achado ALTO dos conflitos quadráticos, MÉDIOS das sugestões sem teto e da família lendo pet inativo, e baixos): D24 a D30 (reconferência sob a trava com `FOR SHARE` e o desfazer que confere o que devolveria; conflito agregado com `quantidade` e até 5 ids, no máximo 15 por linha, hora uma vez por linha, índice e leitura em lotes de 200; sugestões com teto de 20.000 avaliações, 30 profissionais e 300 por hora; contador sem óbito e anonimização limpando a agenda; datas de 2000 a 2100; família sem pet inativo; `parceiroId` nos filtros internos). Medição antes e depois (1.000 sobrepostos: 16,7 s e 330 MB para 0,19 s e 1,8 MB; sugestões: 17,1 s para 0,18 s). Perguntas Q1 (teto de sobreposição na escrita) e Q2 (óbito cancela agendamentos futuros?). Integração no dev (agenda 24/24, configuração 21/21, vínculo 15/15, pacientes 11/11, resíduo zero), smoke 51/51 na 3100, `qa:cenarios` tudo certo, 6 cenários `REG-AGENDA-*` novos, contrato e handoff atualizados | Claude |
| 2026-10-21 | 0.4 | Fechada do lado da API depois da revisão de segurança (achados corrigidos e conferidos: `npm test` 6573, integração da agenda 24/24 no dev, smoke 51/51). Seguem com o Nicolas a Q1 (teto de sobreposição) e a Q2 (óbito cancela agendamentos futuros); fila, avisos e atendimento ficam para a E3-04, a E3-06 e a E4-01 | Claude |
