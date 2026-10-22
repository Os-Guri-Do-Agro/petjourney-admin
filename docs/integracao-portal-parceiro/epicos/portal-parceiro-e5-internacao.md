# Épico E5: Internação

**Status:** In Review
**Autor:** Nicolas (via Claude)
**Criado em:** 2026-10-20
**Versão:** 0.1
**Épico pai:** [portal-do-parceiro.md](portal-do-parceiro.md)
**Partes (cada uma entregável sozinha):**
1. [01-leitos-e-internacao.md](../2026/q4/q4-1/portal-parceiro/e5-internacao/01-leitos-e-internacao.md): cadastro de leitos, internar, mapa de leitos por urgência, gravidade, previsão de alta e os três desfechos (alta, óbito, transferência)
2. [02-prescricao-enfermagem-e-plantoes.md](../2026/q4/q4-1/portal-parceiro/e5-internacao/02-prescricao-enfermagem-e-plantoes.md): prescrição por horário materializada, checklist de enfermagem, evolução por plantão e passagem de turno
3. [03-boletim-ao-responsavel.md](../2026/q4/q4-1/portal-parceiro/e5-internacao/03-boletim-ao-responsavel.md): boletim com frequência configurável e silêncio noturno, retido até a ligação quando piora, e o lado do app

---

## Visão Geral

"Internação é o momento de maior angústia do responsável, e hoje ele liga para a clínica quatro vezes por dia. O boletim automático resolve dos dois lados" (doc 07 do portal). O protótipo encena um plantão inteiro:
- mapa de leitos;
- prescrição por horário com checklist e registro de quem executou;
- recusa como desfecho próprio;
- evolução por plantão;
- passagem de turno com pendências congeladas;
- boletim com frequência de 1 a 24 h, foto, silêncio noturno que junta, retenção por piora até a ligação;
- alta com três desfechos.

## Decisões do épico

- **D-E5.1 Internação não é agendamento** (decisão do doc 07): entidade própria, com entrada e alta sem hora marcada; o leito é a unidade de ocupação.
- **D-E5.2 Atraso é lido, nunca gravado** (`AdministracaoStatus` sem "atrasada"); os horários são **materializados** na prescrição, porque o registro de quem executou precisa de uma linha para morar, e a auditoria de um óbito procura as doses de ontem.
- **D-E5.3 A regra do boletim retido é do servidor.** "Se vivesse na tela, bastaria outra tela, ou uma rota de API amanhã, para a notícia grave escapar por push" (doc 07). `enviarBoletim` recusa sem a ligação.
- **D-E5.4 Óbito e transferência não saem por mensagem** e exigem `avisadoPorTelefone` (P5 do épico pai).
- **D-E5.5 Não vira a `Internacao` do app.** A `Internacao` do app é o registro que o responsável escreve, pendurado num lembrete; a da clínica tem tela própria no app (doc 09 do portal, seção 2). Só o boletim de alta pode virar `Consulta` publicada, se o veterinário liberar o resumo da alta.

## Change Log

| Data | Versão | Mudança | Autor |
|---|---|---|---|
| 2026-10-20 | 0.1 | Criação | Nicolas (via Claude) |
