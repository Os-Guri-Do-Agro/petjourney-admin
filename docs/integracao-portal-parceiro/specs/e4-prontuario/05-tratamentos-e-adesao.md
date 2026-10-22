# Spec: Tratamentos em casa e adesão (receita que vira lembrete, dose dada ou pulada, alerta para a clínica)

**Status:** In Review
**Autor:** Nicolas (via Claude)
**Criado em:** 2026-10-20
**Versão:** 0.1
**Épico:** [E4 prontuário](../../../../../epicos/portal-parceiro-e4-prontuario.md)
**Depende de:** [E4-03 receituário](03-receituario-digital.md), [E2-04 publicação](../e2-pacientes-e-ponte/04-publicacao-no-app.md)

---

## Visão Geral

O ciclo fechado entre a receita e a casa:
1. O responsável toca "Criar lembretes" no resumo, e cada item vira `LembreteSerie` MEDICAMENTO, ou `TratamentoFixo` + série no uso contínuo.
2. A tela diz que a clínica vai ver os registros, e a chave vem ligada por tratamento.
3. Em casa, alguém toca "Dei", ou "Pulei" com motivo (esqueci, cuspiu, acabou).
4. A clínica vê a faixa de doses e um alerta quando um tratamento marcado como crítico perde o ritmo.
5. A conversa registrada apaga o alerta.

## Motivação

"É o ciclo que muda desfecho clínico e o mais difícil de copiar, porque exige os dois lados" (doc 15 do portal). O lado do app já tem a base:
- lembretes com `INTERVALO_HORAS` de 1 a 72 h;
- dose dada fora do horário (`administradoEm`, `remarcadaDe`);
- calendário de medicação (`GET /lembrete/calendario-medicacao`), dose retroativa, encerrar série (inventário 2.7).

O que falta é ligar a receita da clínica ao lembrete, registrar quem deu e a dose pulada com motivo, e a leitura agregada para a clínica.

---

## Research Findings

- **Portal** (`domain/adesao.ts`, `data/repositories/tratamento-repository.ts`, contrato "Adesão ao tratamento" `ROTAS_DA_ADESAO` em `contrato/responsavel.ts:1724-1736`):
  - motivos `esqueci`, `cuspiu`, `acabou`;
  - o registro abre 60 min antes e fecha na dose seguinte; a dose que passa sem registro fecha calada como "sem registro";
  - alerta sobre doses fechadas nas últimas 72 h: 2 ou mais puladas, **ou** queda abaixo de 50% em quem deu 80% ou mais nos 7 dias anteriores, com pelo menos 4 doses de base;
  - o primeiro horário sugerido poupa a madrugada (0 a 6 h, adiamento até 8 h);
  - a faixa cobre 42 a 90 dias;
  - "o primeiro que registra fecha a dose para todos" (`DOSE_JA_REGISTRADA`);
  - só quem tem edição registra (`SOMENTE_LEITURA`).
- **Decisões do portal que viram regra:**
  - sem registro não é dose perdida;
  - nenhuma porcentagem na tela;
  - a pulada não é vermelha;
  - crítico é decisão do veterinário na receita;
  - a conversa apaga o alerta.
- **Mapa de frequência** (doc 09 do portal, seção 2): 24 h vira `DIARIO`; 1 a 72 h, `INTERVALO_HORAS`; 168 h, `SEMANAL`; 336 h, `QUINZENAL`; 720 h, `MENSAL`; o resto é recusado. `repetirAte` = primeira dose + `duracaoDias`. No uso contínuo, `TratamentoFixo` + série com origem `TRATAMENTO_FIXO`.
- **API:**
  - `LembreteOcorrencia` (status `PENDENTE`, `CONCLUIDO`, `CANCELADO`; `concluidoEm`; `administradoEm`; `remarcadaDe`; `medicamentoId`) **não guarda quem concluiu nem dose pulada com motivo** (`prisma/schema.prisma:834-874`);
  - `ConsultaPrescricaoItem` tem `tratamentoFixoId` e `lembreteSerieId` (`:685-712`).

**Breaking changes:** nenhuma; colunas aditivas em `LembreteOcorrencia`.

## Decisões

- **D1 Um toque, por item.** `POST /tutor/clinica/atendimentos/:id/receita/lembretes` com os itens escolhidos, o horário da primeira dose (sugerido pelo servidor) e `compartilharComAClinica` (default `true`, dito na tela). Nada nasce sem o toque (P1 da receita com IA, que vale aqui também).
- **D2 Registro de dose reusa o lembrete do app.** "Dei" conclui a `LembreteOcorrencia` (fluxo atual); "Pulei" é estado novo `PULADA` com `motivoPulada`. Os dois gravam `registradoPorUsuarioId`. Concluir uma ocorrência já registrada por outra pessoa da família dá 409 `DOSE_JA_REGISTRADA` com quem e quando.
- **D3 Janela do registro** de 60 min antes até a dose seguinte. Fora dela, 409 `DOSE_FORA_DA_JANELA`. A dose retroativa que já existe continua valendo para o responsável corrigir o passado.
- **D4 A clínica só vê o que foi compartilhado**, por tratamento (`compartilhadoComAClinica`); desligar corta a leitura na hora. Só o dono muda.
- **D5 Alerta calculado no servidor** com as constantes do portal num `adesao.config.ts`; nunca dispara em quem simplesmente não registra (mede queda em relação ao próprio padrão).
- **D6 Crítico e contato.** O veterinário marca `critico` na prescrição (E4-03) e pode mudar na ficha. Registrar contato (`{ nota }`) apaga o alerta até a próxima dose que não aparecer como dada.
- **D7 Notificação de alerta para a equipe** (`ADESAO_EM_QUEDA`, categoria PARCEIRO, para quem tem `prontuario.ler`), uma por tratamento e janela (marcador).

## Modelo de dados (aditivo)

```prisma
// LembreteOcorrencia (aditivo)
status                 // novo valor no enum: PULADA
motivoPulada           String?   // ESQUECI | CUSPIU | ACABOU
registradoPorUsuarioId String?

model TratamentoDaClinica {
  id                       String    @id @default(cuid())
  parceiroId               String
  pacienteId               String
  petId                    String
  atendimentoId            String?
  prescricaoId             String?   // PrescricaoDoAtendimento
  consultaPrescricaoItemId String?   // publicado no app
  lembreteSerieId          String?
  tratamentoFixoId         String?
  medicamento              String    // copiado
  posologia                Json      // quantidade, unidade, via, instrução, frequência, duração (copiada, decisão 8 do doc 15)
  inicioEm                 DateTime
  encerradoEm              DateTime?
  critico                  Boolean   @default(false)
  compartilhadoComAClinica Boolean   @default(true)
  contatoEm                DateTime?
  contatoProfissionalId    String?
  contatoNota              String?
  @@index([parceiroId, critico])
  @@index([petId])
}
```

## Rotas

**Responsável** (contrato `ROTAS_DA_ADESAO`, adaptado):

| Método e rota | Descrição |
|---|---|
| `POST /tutor/clinica/atendimentos/:id/receita/lembretes` | D1 → `LembreteCriadoDaReceita[]`; 422 `FREQUENCIA_NAO_SUPORTADA` |
| `GET /tutor/clinica/tratamentos?petId=` | Remédios da clínica com a grade do dia, quem deu, e se a clínica vê |
| `GET /tutor/clinica/tratamentos/:id/doses?desde=&ate=` | Até 90 dias por pedido |
| `POST /tutor/clinica/tratamentos/:id/doses` | `{ numero, situacao: 'DADA'\|'PULADA', motivo? }`; 409 `DOSE_JA_REGISTRADA` / `DOSE_FORA_DA_JANELA`; 403 `SOMENTE_LEITURA` |
| `POST /tutor/clinica/tratamentos/doses` | Várias do mesmo aviso de uma vez (as já registradas voltam como estão) |
| `DELETE /tutor/clinica/tratamentos/:id/doses/:numero` | Desfazer, só quem registrou, dentro da janela |
| `PATCH /tutor/clinica/tratamentos/:id` | `{ compartilhadoComAClinica }` (dono) |

**Clínica** (`prontuario.ler`):

| Método e rota | Descrição |
|---|---|
| `GET /parceiro/portal/pacientes/:id/tratamentos` | `AdesaoParaClinica[]`: faixa de doses (dada, pulada, sem registro, aberta, prevista), resumo desde a última consulta ("39 dadas, 1 pulada (acabou o remédio), 1 sem registro"), quem registrou, horário que destoa, alerta |
| `GET /parceiro/portal/clinica/tratamentos?filtro=PEDEM_ATENCAO` | Lista da clínica |
| `PATCH /parceiro/portal/clinica/tratamentos/:id` | `{ critico }` (`prontuario.escrever`) |
| `POST /parceiro/portal/clinica/tratamentos/:id/contato` | `{ nota }` (D6) |

## Acceptance Criteria

- [ ] **Given** item de 8 em 8 h por 10 dias **When** cria lembrete **Then** nasce `LembreteSerie` `INTERVALO_HORAS=8` com `repetirAte` = primeira dose + 10 dias, ligado ao item publicado.
- [ ] **Given** item de uso contínuo **Then** nasce `TratamentoFixo` ativo sem `dataFim` e série com origem `TRATAMENTO_FIXO`.
- [ ] **Given** frequência de 96 h **Then** 422 `FREQUENCIA_NAO_SUPORTADA`.
- [ ] **Given** Fátima deu a dose das 08:00 **When** Rafael tenta registrar a mesma **Then** 409 `DOSE_JA_REGISTRADA` com "Fátima, 08:02".
- [ ] **Given** Clara com acesso de leitura **When** registra **Then** 403 `SOMENTE_LEITURA`.
- [ ] **Given** tratamento crítico com 2 puladas em 72 h **Then** alerta `puladas` e `ADESAO_EM_QUEDA` para a equipe uma vez; com contato registrado **Then** o alerta some.
- [ ] **Given** tratamento em que a casa nunca registrou **Then** nenhum alerta (casos de `adesao.spec` do portal).
- [ ] **Given** `compartilhadoComAClinica=false` **Then** a clínica vê que o lembrete existe e não vê doses (403 `SEM_CONSENTIMENTO` no detalhe).
- [ ] Sem porcentagem em nenhuma resposta.

## Estratégia de Testes

- Unit: mapa de frequência, janela, alerta (golden tests de `adesao.spec`), sugestão de primeira dose, "sem registro" fora das contas.
- Regressão: suíte de lembretes, dose fora do horário e calendário de medicação verde.
- Cenários: outro tutor registrando (403), outro parceiro lendo (403).

## Arquivos Impactados

| Arquivo | Ação |
|---|---|
| `prisma/schema.prisma` + migration | `PULADA`, colunas em `LembreteOcorrencia`, `TratamentoDaClinica` |
| `src/lembrete/lembrete.service.ts` | Modificar: `registradoPorUsuarioId`, pular com motivo, janela para ocorrência ligada a tratamento da clínica |
| `src/adesao-clinica/` (controllers, service, `regras/adesao.ts`, detector de alerta) | Criar |

## Tasks

- [ ] **T1** Migration
- [ ] **T2** Criar lembretes da receita (frequência, contínuo, primeira dose)
- [ ] **T3** Registrar dada e pulada com autoria e janela (sem mudar o fluxo atual de lembrete comum)
- [ ] **T4** Leitura da clínica, alerta, contato, crítico
- [ ] **T5** Notificação e contador (`tratamentosEmQueda`), handoff do app (Dei/Pulei no aviso)

## Riscos e Mitigações

| Nível | Risco | Mitigação |
|---|---|---|
| Alto | Mudar o fluxo de lembrete existente e quebrar o app em produção | Colunas aditivas; `PULADA` só para ocorrência ligada a tratamento da clínica; suítes de lembrete, dose fora do horário e calendário como regressão obrigatória |
| Médio | Alerta virar cobrança ao responsável | Alerta só para a equipe, nunca para o app; sem porcentagem; "sem registro" fora das contas |

## Rollout / Rollback

Aditivo. O valor novo `PULADA` não aparece para lembretes comuns. Rollback: reverter o código; ocorrências `PULADA` já gravadas aparecem na build antiga como não concluídas (aceitável, documentado no handoff).

## Change Log

| Data | Versão | Mudança | Autor |
|---|---|---|---|
| 2026-10-20 | 0.1 | Criação | Nicolas (via Claude) |
