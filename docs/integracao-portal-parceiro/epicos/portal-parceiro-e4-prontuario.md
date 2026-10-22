# Épico E4: Prontuário, receita, vacinas e adesão

**Status:** In Review
**Autor:** Nicolas (via Claude)
**Criado em:** 2026-10-20
**Versão:** 0.1
**Épico pai:** [portal-do-parceiro.md](portal-do-parceiro.md)
**Partes (cada uma entregável sozinha):**
1. [01-atendimento-e-prontuario.md](../2026/q4/q4-1/portal-parceiro/e4-prontuario/01-atendimento-e-prontuario.md): o atendimento estruturado (anamnese, exame físico, diagnósticos, conduta), autosave com edição por um dispositivo, finalizar, adendo, anular, liberar resumo, retorno e linha do tempo do paciente
2. [02-catalogos-clinicos.md](../2026/q4/q4-1/portal-parceiro/e4-prontuario/02-catalogos-clinicos.md): faixas de referência por espécie, porte e idade; diagnósticos; exames; bulário com doses por espécie; vacinas e protocolos
3. [03-receituario-digital.md](../2026/q4/q4-1/portal-parceiro/e4-prontuario/03-receituario-digital.md): receita congelada na assinatura, regime de controle por item, PDF no servidor, assinatura avançada com verificação pública e entrega ao responsável
4. [04-vacinacao-conectada.md](../2026/q4/q4-1/portal-parceiro/e4-prontuario/04-vacinacao-conectada.md): aplicação com lote, dose da série e próxima dose; dose de outro lugar; protocolo e lista de chamada; carteirinha do app atualizando na hora
5. [05-tratamentos-e-adesao.md](../2026/q4/q4-1/portal-parceiro/e4-prontuario/05-tratamentos-e-adesao.md): receita que vira lembrete por um toque, dose dada ou pulada com motivo, a faixa de doses para o veterinário e o alerta de tratamento crítico
6. [06-documentos-clinicos.md](../2026/q4/q4-1/portal-parceiro/e4-prontuario/06-documentos-clinicos.md): atestados, termos com aceite do responsável, pedidos de exame, encaminhamento, laudos, comprovante de vacinação e a cópia do prontuário em 5 dias úteis
7. [07-anamnese-por-voz.md](../2026/q4/q4-1/portal-parceiro/e4-prontuario/07-anamnese-por-voz.md): transcrição no servidor e estruturação com IA, com citação por campo, revisão item a item e LIA antes de produção

---

## Visão Geral

É onde o veterinário passa o dia e onde o produto vence ou perde: prontuário estruturado de nascença (porque é isso que permite score de risco, prevenção preditiva e integração com laboratório depois, doc 03 do portal), receita que chega ao app e vira lembrete, vacina que aparece na carteirinha na hora, e a adesão em casa voltando para o retorno.

## Decisões do épico

- **D-E4.1 Estruturado em tabelas, não em JSON.** Segue a D7 de `evolucao-registro-consulta` ("sub-tabelas 1:1 por tipo, nunca Json"): anamnese e exame físico em colunas, achados por sistema, diagnósticos, antecedentes, prescrições e exames solicitados em tabelas filhas. Texto livre convive ao lado.
- **D-E4.2 O prontuário é da clínica; o resumo é do responsável.** Finalizar fecha o registro da clínica. Liberar o resumo publica no app (E2-04), num passo separado: "o vet pode querer revisar a orientação antes de ela chegar num celular" (doc 09 do portal, seção 8).
- **D-E4.3 Finalizado não se edita** (P4 do épico pai): adendo com autor e hora; anulação com motivo, que retira a publicação.
- **D-E4.4 Status clínico é recalculado.** Faixa de referência, atraso de vacina e situação de dose são derivados na leitura, nunca gravados (decisões dos docs 03, 07 e 13 do portal).
- **D-E4.5 A IA só propõe com citação.** A anamnese por voz (E4-07) segue a P2 e a P7 da receita com IA: nada aplicado sem o profissional, nenhum conselho clínico.
- **D-E4.6 Bulário é conteúdo curado com fonte.** Doses e cuidados vêm de catálogo revisado por veterinário responsável, com fonte e data por item; o sistema calcula a conta, não decide a dose.

## Change Log

| Data | Versão | Mudança | Autor |
|---|---|---|---|
| 2026-10-20 | 0.1 | Criação | Nicolas (via Claude) |
