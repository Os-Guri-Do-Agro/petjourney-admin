# Épico E7: Hotel

**Status:** In Review
**Autor:** Nicolas (via Claude)
**Criado em:** 2026-10-20
**Versão:** 0.1
**Épico pai:** [portal-do-parceiro.md](portal-do-parceiro.md)
**Partes (cada uma entregável sozinha):**
1. [01-casa-acomodacoes-e-tarifas.md](../2026/q4/q4-1/portal-parceiro/e7-hotel/01-casa-acomodacoes-e-tarifas.md): blocos, tipos, acomodações, tarifas por porte, temporadas, serviços, política e exigências de admissão
2. [02-reservas-e-disponibilidade.md](../2026/q4/q4-1/portal-parceiro/e7-hotel/02-reservas-e-disponibilidade.md): grade de ocupação, vaga por instante com higienização, orçamento no servidor, sinal, cancelamento, não comparecimento, comprovantes e dispensas, autorizados a retirar e lista de espera
3. [03-reserva-online.md](../2026/q4/q4-1/portal-parceiro/e7-hotel/03-reserva-online.md): pedido de hospedagem pelo app e pela página pública, caixa do balcão e aceite que cria reserva pendente de sinal
4. [04-check-in-estadia-e-check-out.md](../2026/q4/q4-1/portal-parceiro/e7-hotel/04-check-in-estadia-e-check-out.md): admissão com a carteirinha do app, pertences, plano alimentar, medicações, autorizações, veterinário do pet pelo vínculo; estadia; saída com conferência
5. [05-rotina-turnos-e-boletim.md](../2026/q4/q4-1/portal-parceiro/e7-hotel/05-rotina-turnos-e-boletim.md): rotina padrão versionada, ajustes por hóspede, prancheta em rondas, diário, ocorrências, passagem de turno e boletim ao responsável
6. [06-resumo-do-hotel.md](../2026/q4/q4-1/portal-parceiro/e7-hotel/06-resumo-do-hotel.md): ocupação, retorno, cancelamento, não comparecimento e receita do período

---

## Visão Geral

O hotel do portal (docs `hotel/01` a `03`, nove telas, mais de 200 testes) tem a reserva como entidade central: período futuro numa acomodação, orçamento, sinal e cancelamento. A porta de entrada é sanitária, e a rotina é de animal saudável que precisa continuar bem. As quatro regras (R1 a R4) "são regra de servidor, nunca na apresentação".

## Decisões do épico

- **D-E7.1 Hotel não é internação** (doc `hotel/01`): reserva, preço e admissão sanitária mudam o modelo. Compartilham o cadastro (E2-01), a ponte (E2), o `Turno` (E5-02) e o padrão de boletim retido.
- **D-E7.2 A carteirinha do app é o comprovante.** Com vínculo ativo, a R1 lê as vacinas do app (as publicadas por clínica trazem lote e são "comprovadas"; as lançadas pelo responsável são "declaradas"). Sem vínculo, vale o comprovante que o balcão registra. É o diferencial do ecossistema: "chega hoje sem a vacina da tosse" deixa de ser descoberta no balcão.
- **D-E7.3 Veterinário do pet pelo vínculo.** O `VeterinarioDoPet` em texto livre do mock dá lugar às clínicas com vínculo ativo daquele pet (nome e contato público, E1-01); texto livre fica só para quem não está no PetJourney.
- **D-E7.4 Preço é do servidor.** Orçamento, meia diária, temporada, acompanhante e sinal são calculados pela API (porte de `domain/tarifas.ts`); o balcão nunca grava total digitado.
- **D-E7.5 Estadia encerrada vai para o app** como `ServicoRealizado` HOSPEDAGEM, pela E2-04 (revoga a D1 da anotação só com vínculo, como o resto), e o peso de saída como pesagem publicada.
- **D-E7.6 Fora desta rodada** (doc `hotel/01`): emissão fiscal, processamento de pagamento, câmera ao vivo, creche (o modelo recebe, mas não entra), adestramento com plano, transporte com rota.

## Change Log

| Data | Versão | Mudança | Autor |
|---|---|---|---|
| 2026-10-20 | 0.1 | Criação | Nicolas (via Claude) |
