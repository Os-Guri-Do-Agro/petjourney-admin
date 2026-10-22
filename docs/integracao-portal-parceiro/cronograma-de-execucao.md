# Cronograma de execução: Portal do parceiro (API)

**Criado em:** 2026-10-21 · **Guarda-chuva:** [portal-do-parceiro.md](../../../../epicos/portal-do-parceiro.md) · **Onde acompanhar:** workflow, PetJourney, Q4, outubro (cards "Portal do parceiro")

## Como o prazo foi calculado

| Premissa | Valor | Por quê |
|---|---|---|
| Início | 21/10, 08:00 (Cuiabá) | Depois de o board estar pronto e o cron ligado |
| Agentes em paralelo | 2 | Teto pedido pelo Nicolas; 8 em paralelo estouraram a cota em 2026-10-20 |
| Janela de cota | 5 h, com o PC ligado 24 h e o cron retomando a cada reset | A cota da sessão volta a cada 5 h |
| Vazão por agente | 2.5 pontos por janela | Referência: a leitura de receita (3 partes grandes) saiu em cerca de 1 dia com 1 agente |
| Fator de segurança | 1.25 | Teste que falha, gate que reprova, retomada depois do reset |
| Horas por ponto | 2.5 h de agente | 5 h ÷ 2.5 pontos × 1.25 |
| Tokens por ponto | cerca de 0.6 M | Leitura do código, escrita, testes e gates, com cache |
| Tamanho | P = 1, M = 2, G = 3, GG = 5, gate = 1 | Pela quantidade de modelo, rota, regra portada e teste de cada spec |

**Total:** 105 pontos ≈ 263 h de agente ≈ 63 M tokens. Com 2 agentes e as dependências, o último item termina em **28/10, 07:30**.

**O que não está no prazo (de propósito):** os gates de produção, que dependem de gente de fora:
- pareceres jurídicos Q-JUR1 a Q-JUR4;
- revisão clínica do bulário;
- conta do provedor de voz e gold set;
- a F4 da E1-07, que espera 30 dias sem uso;
- a aprovação e o commit, que são do Nicolas.

O código fica pronto e testado em dev; ligar para cliente real espera esses itens.

**Regra de cada onda:** a onda seguinte só começa depois do gate da anterior verde.

## Fronts (novembro, Luís)

Este cronograma é só da API. Cada spec termina com a API pronta e o handoff do front escrito em `docs/implementacao-por-superficie/front-portal-parceiro-e<N>.md`. As telas (portal, app, CMS e site) estão no workflow em novembro, no nome do Luís, um card por épico, com uma subtarefa por spec e superfície, cada uma apontando para o card da API de que depende. A E0-03 é só de front (a API já entrega) e por isso não entra nesta tabela.

Os prazos de novembro são sugestões por semana, na ordem das ondas da API, para combinar com o Luís: ritmo de gente não se calcula por token.

## Tabela

| Item | O quê | Onda | Tam. | Pontos | Agente | Início | Fim |
|---|---|---|---|---|---|---|---|
| E0-01 | Equipe do parceiro completa (listar, convidar por e-mail, aceitar pela lista, trocar papel, sair) | 0 | M | 2 | A | 21/10, 08:00 | 21/10, 13:00 |
| E0-02 | Capacidade de saque calculada pela API | 0 | P | 1 | B | 21/10, 08:00 | 21/10, 10:30 |
| G0 | Gate da onda 0 | 0 | GATE | 1 | A | 21/10, 13:00 | 21/10, 15:30 |
| E1-01 | Perfil público do estabelecimento | 1 | M | 2 | A | 21/10, 15:30 | 21/10, 20:30 |
| E1-02 | Módulos do parceiro (Clínica e Hotel) ligados no servidor | 1 | M | 2 | B | 21/10, 15:30 | 21/10, 20:30 |
| E1-03 | Profissionais com CRMV, papéis operacionais e permissão por recurso | 1 | G | 3 | A | 21/10, 20:30 | 22/10, 04:00 |
| E1-04 | Contrato das rotas novas (erros com código, fuso, idempotência) e proteção das rotas públicas | 1 | G | 3 | B | 21/10, 20:30 | 22/10, 04:00 |
| E1-05 | Trilha de auditoria clínica (quem leu, escreveu, publicou ou exportou) | 1 | M | 2 | A | 22/10, 04:00 | 22/10, 09:00 |
| E1-06 | Avisos à equipe do parceiro e contadores de pendência | 1 | M | 2 | B | 22/10, 04:00 | 22/10, 09:00 |
| E2-01 | Clientes e pacientes do parceiro | 1 | M | 2 | A | 22/10, 09:00 | 22/10, 14:00 |
| E2-02 | Vínculo entre paciente da clínica e pet do app, com consentimento | 1 | G | 3 | A | 22/10, 14:00 | 22/10, 21:30 |
| E2-04 | Publicação no app (o escritor único da clínica para o pet do responsável) | 1 | G | 3 | A | 22/10, 21:30 | 23/10, 05:00 |
| G1 | Gate da onda 1 | 1 | GATE | 1 | A | 23/10, 05:00 | 23/10, 07:30 |
| E3-01 | Configuração da agenda (tipos de atendimento, salas, expediente, bloqueios e política) | 2 | M | 2 | A | 23/10, 07:30 | 23/10, 12:30 |
| E4-02 | Catálogos clínicos (faixas de referência, diagnósticos, exames, bulário, vacinas) | 2 | G | 3 | B | 23/10, 07:30 | 23/10, 15:00 |
| E3-02 | Agenda e agendamentos | 2 | G | 3 | A | 23/10, 12:30 | 23/10, 20:00 |
| E4-04 | Vacinação conectada (aplicação com lote, protocolo, lista de chamada e carteirinha do app) | 2 | G | 3 | B | 23/10, 15:00 | 23/10, 22:30 |
| E3-03 | Faltas (marcar, justificar, painel, reincidência e reagendar) | 2 | M | 2 | A | 23/10, 20:00 | 24/10, 01:00 |
| E3-06 | Avisos clínicos ao responsável (tipos da agenda, véspera, comprovante e quem não tem app) | 2 | M | 2 | B | 23/10, 22:30 | 24/10, 03:30 |
| E2-05 | Migrador da base da clínica (importação em lotes, com relatório e desfazer) | 2 | G | 3 | A | 24/10, 01:00 | 24/10, 08:30 |
| E3-04 | Fila de espera com oferta de vaga | 2 | M | 2 | B | 24/10, 03:30 | 24/10, 08:30 |
| E3-05 | Agendamento online (pedido pelo app e pela página pública, caixa da recepção) | 2 | G | 3 | A | 24/10, 08:30 | 24/10, 16:00 |
| G2 | Gate da onda 2 | 2 | GATE | 1 | A | 24/10, 16:00 | 24/10, 18:30 |
| E2-03 | A clínica lê o app com consentimento (diário, peso de casa, carteirinha) e o "Este pet em 30 segundos" | 3 | M | 2 | A | 24/10, 18:30 | 24/10, 23:30 |
| E4-01 | Atendimento e prontuário eletrônico estruturado | 3 | G | 3 | B | 24/10, 18:30 | 25/10, 02:00 |
| E3-07 | Pré-consulta (o responsável responde antes, preenchida pelo diário) | 3 | M | 2 | A | 24/10, 23:30 | 25/10, 04:30 |
| E4-03 | Receituário digital (receita congelada, controle por regime, PDF, assinatura e verificação) | 3 | G | 3 | B | 25/10, 02:00 | 25/10, 09:30 |
| E3-08 | Painel do dia ("Meu dia", "Atividades") e resumo da clínica | 3 | M | 2 | A | 25/10, 04:30 | 25/10, 09:30 |
| E4-05 | Tratamentos em casa e adesão (receita que vira lembrete, dose dada ou pulada, alerta para a clínica) | 3 | G | 3 | A | 25/10, 09:30 | 25/10, 17:00 |
| E4-06 | Documentos clínicos (atestados, termos, pedidos de exame, laudos e cópia do prontuário) | 3 | G | 3 | B | 25/10, 09:30 | 25/10, 17:00 |
| G3 | Gate da onda 3 | 3 | GATE | 1 | A | 25/10, 17:00 | 25/10, 19:30 |
| E5-01 | Leitos e internação (mapa, internar, gravidade, alta, óbito e transferência) | 4 | M | 2 | A | 25/10, 19:30 | 26/10, 00:30 |
| E6-01 | Lotes de vacina e movimentos de estoque | 4 | M | 2 | B | 25/10, 19:30 | 26/10, 00:30 |
| E5-02 | Prescrição de internação, checklist de enfermagem, evolução e passagem de plantão | 4 | G | 3 | A | 26/10, 00:30 | 26/10, 08:00 |
| E6-02 | Metas do mês e pedido de compra | 4 | P | 1 | B | 26/10, 00:30 | 26/10, 03:00 |
| E4-07 | Anamnese por voz (transcrição no servidor e estruturação com citação) | 4 | GG | 5 | B | 26/10, 03:00 | 26/10, 15:30 |
| E5-03 | Boletim da internação ao responsável | 4 | G | 3 | A | 26/10, 08:00 | 26/10, 15:30 |
| G4 | Gate da onda 4 | 4 | GATE | 1 | A | 26/10, 15:30 | 26/10, 18:00 |
| E7-01 | A casa do hotel (acomodações, tarifas, temporadas, serviços, política e exigências) | 5 | M | 2 | A | 26/10, 18:00 | 26/10, 23:00 |
| E7-02 | Reservas e disponibilidade do hotel | 5 | G | 3 | A | 26/10, 23:00 | 27/10, 06:30 |
| E7-03 | Reserva online do hotel (pedido pelo app e pela página pública) | 5 | M | 2 | A | 27/10, 06:30 | 27/10, 11:30 |
| E7-04 | Check-in, estadia e check-out | 5 | G | 3 | B | 27/10, 06:30 | 27/10, 14:00 |
| E7-05 | Rotina do hotel, prancheta, ocorrências, passagem de turno e boletim | 5 | G | 3 | A | 27/10, 14:00 | 27/10, 21:30 |
| E7-06 | Resumo do hotel | 5 | P | 1 | B | 27/10, 14:00 | 27/10, 16:30 |
| G5 | Gate da onda 5 | 5 | GATE | 1 | A | 27/10, 21:30 | 28/10, 00:00 |
| E1-07 | Aposentar o legado Veterinario, Clinica e ClinicasPacientes | 6 | M | 2 | A | 28/10, 00:00 | 28/10, 05:00 |
| G6 | Gate da onda 6 | 6 | GATE | 1 | A | 28/10, 05:00 | 28/10, 07:30 |
