# Spec: Painel do dia ("Meu dia", "Atividades") e resumo da clínica

**Status:** In Review
**Autor:** Nicolas (via Claude)
**Criado em:** 2026-10-20
**Versão:** 0.1
**Épico:** [E3 agenda](../../../../../epicos/portal-parceiro-e3-agenda.md)
**Depende de:** [E3-02 agenda](02-agenda-e-agendamentos.md), [E1-06 pendências](../e1-fundacao/06-avisos-ao-parceiro-e-pendencias.md); cresce com E4 e E5

---

## Visão Geral

Três leituras agregadas, calculadas no servidor:
1. **"Meu dia"** do profissional logado: os atendimentos dele, a sala de espera, rascunhos de prontuário abertos, retornos pendentes, internados que cobram ação.
2. **"Atividades"** da clínica: as pilhas do que ficou para trás.
3. **Resumo da clínica** por período (hoje, semana, semana passada, 30 dias) e profissional: finalizados, previstos, faltas, cancelados, encaixes, comparecimento, ocupação média, horas atendidas, novos pacientes; séries por dia, tipo, profissional, origem, hora da semana e diagnóstico.

## Motivação

- O doc 08 do portal reorganizou o menu nas quatro perguntas da clínica ("Agora, Em curso, Pendências, Análise") e pôs a internação em "Meu dia".
- A `redesign/portal` trocou o dashboard por "espaços" com "números do agora" (`components/home/espaco-da-home.ts`, `HomeEspacoClinica.vue`).
- O resumo é `domain/resumo.ts` do portal: "número de painel que ninguém consegue verificar é número que ninguém deveria mostrar"; "cancelado não conta como falta"; comparecimento = finalizados ÷ (finalizados + faltas).

---

## Decisões

- **D1 Uma função, todos os números.** O porte de `resumirClinica` (golden tests) é a única fonte. O cartão do topo e o gráfico saem da mesma conta.
- **D2 "Meu dia" é por profissional ligado ao usuário** (E1-03). Usuário sem profissional (recepção) vê a versão da clínica.
- **D3 Cada bloco é contador registrado na E1-06** quando ele é pendência; o resto é leitura.
- **D4 Cálculo sob demanda com cache de 5 min** para o resumo (período fechado não muda) e sem cache para "Meu dia".

## Rotas (`@ExigeModulo(CLINICA)`)

| Método e rota | Permissão | Descrição |
|---|---|---|
| `GET /parceiro/portal/clinica/meu-dia` | `agenda.ler` | Atendimentos de hoje do profissional (ou da clínica), sala de espera (`AGUARDANDO` com espera em minutos), rascunhos abertos (E4-01), retornos pendentes, internados com ação (E5), pré-consultas novas |
| `GET /parceiro/portal/clinica/atividades` | `agenda.ler` | Pilhas: rascunhos sem fecho, retornos vencidos, faltas sem justificativa, pedidos atrasados, tratamentos em queda (E4-05), vacinas atrasadas da lista de chamada (E4-04) |
| `GET /parceiro/portal/clinica/resumo?periodo=&profissionalId=` | `agenda.ler` (diagnósticos só com `prontuario.ler`) | `ResumoDaClinica` |

## Acceptance Criteria

- [ ] **Given** um dia com 10 finalizados, 2 faltas e 3 cancelados **Then** `comparecimento = 10/12` e os cancelados não entram (golden test).
- [ ] **Given** período "semana" que alcança o futuro **Then** `previstos` conta só o que ainda não aconteceu.
- [ ] **Given** recepção sem `prontuario.ler` **Then** o resumo vem sem `diagnosticos`.
- [ ] Os números do resumo batem com a soma dos agendamentos do período no banco (teste de propriedade com seed aleatório).
- [ ] p95 de `meu-dia` abaixo de 300 ms com o seed do dia âncora.

## Estratégia de Testes

- Unit: porte de `resumo.ts` (golden), meu-dia por profissional e por clínica.
- Propriedade: soma do resumo contra o banco.

## Arquivos Impactados

| Arquivo | Ação |
|---|---|
| `src/agenda/painel/` (controller, service, `regras/resumo.ts`) | Criar |

## Tasks

- [ ] **T1** Porte do resumo + golden tests
- [ ] **T2** Meu dia e atividades (crescem com E4 e E5: cada spec acrescenta seu bloco)
- [ ] **T3** Cache, permissões, handoff (Início da redesign lendo daqui)

## Riscos e Mitigações

| Nível | Risco | Mitigação |
|---|---|---|
| Médio | Número do painel divergir do banco | Função única (D1) e teste de propriedade contra o banco |
| Baixo | Resumo pesado em período longo | Cache de 5 min para período fechado; período máximo de 90 dias por chamada |

## Rollout / Rollback

Somente leitura, atrás do módulo. Rollback é reverter o código.

## Change Log

| Data | Versão | Mudança | Autor |
|---|---|---|---|
| 2026-10-20 | 0.1 | Criação | Nicolas (via Claude) |
