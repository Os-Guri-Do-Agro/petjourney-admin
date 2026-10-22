# Épico E2: Clientes, pacientes e a ponte com o app do responsável

**Status:** In Review
**Autor:** Nicolas (via Claude)
**Criado em:** 2026-10-20
**Versão:** 0.1
**Épico pai:** [portal-do-parceiro.md](portal-do-parceiro.md) (decisões A1 e A2)
**Partes (cada uma entregável sozinha):**
1. [01-clientes-e-pacientes.md](../2026/q4/q4-1/portal-parceiro/e2-pacientes-e-ponte/01-clientes-e-pacientes.md): o cadastro da clínica (responsável e paciente), com busca, alertas e espécie mapeada para o enum da API
2. [02-vinculo-e-consentimento.md](../2026/q4/q4-1/portal-parceiro/e2-pacientes-e-ponte/02-vinculo-e-consentimento.md): o vínculo entre o paciente da clínica e o pet do app, como nasce (app, convite, acesso temporário, QR), o consentimento por chave e o encerramento
3. [03-leitura-do-app-pela-clinica.md](../2026/q4/q4-1/portal-parceiro/e2-pacientes-e-ponte/03-leitura-do-app-pela-clinica.md): diário, peso de casa e carteirinha lidos pela clínica com consentimento, e o "Este pet em 30 segundos"
4. [04-publicacao-no-app.md](../2026/q4/q4-1/portal-parceiro/e2-pacientes-e-ponte/04-publicacao-no-app.md): o escritor único que leva atendimento liberado, vacina aplicada e peso aferido para o app, com autoria, anulação e remoção pelo responsável
5. [05-migrador-de-dados.md](../2026/q4/q4-1/portal-parceiro/e2-pacientes-e-ponte/05-migrador-de-dados.md): importação da base da clínica em lotes, com revalidação no servidor, relatório por linha, retomada e desfazer

---

## Visão Geral

É a ponte da decisão A1. De um lado, o cadastro da clínica: `ClienteDoParceiro` e `PacienteDoParceiro`, isolados por parceiro, que existem mesmo quando o responsável não tem o app. Do outro, o `Pet` e o `Tutor` do app. No meio, o `VinculoPacientePet` com consentimento. Por ele, a clínica lê o que o responsável liberou e publica o que ela libera.

## Motivação

- O portal assume uma carteira de pacientes própria da clínica (`Pet.tutorId` obrigatório, `PacienteResumo`, migrador) e um vínculo proposto ao responsável (`VinculoProposto`, `ROTAS_DO_VINCULO` em `petjourney-admin/src/features/clinico/contrato/responsavel.ts:1295-1402`). O frontender registrou no doc 06 que "não existe vínculo pet e clínica no banco" e que o acesso da clínica hoje é "temporário e consentido".
- A API tem um embrião que não serve para isso: o pet órfão (`Pet.tutorId` nulo com `responsavel*`, `prisma/schema.prisma:569-573`), que qualquer conta cria por `POST /pet` e que depois só o admin lê (inventário, achado 1).

## Decisões do épico

- **D-E2.1 Paciente da clínica não é `Pet`.** O cadastro da clínica vive em `PacienteDoParceiro`. Nenhuma linha de `Pet` nasce do balcão ou da importação. `Pet` só nasce quando o responsável aceita o vínculo escolhendo "criar no meu app". Isso aposenta, para o módulo clínico, a ideia de "pet órfão cadastrado por clínica" de `regras.md` 3.3 (o pet órfão do `POST /pet` segue como está, fora deste épico, com o achado registrado).
- **D-E2.2 O vínculo é o consentimento.** Aceitar o vínculo autoriza a publicação (A2). A leitura de dado do app tem chaves próprias (`diarioCompleto`, `peso`, `notas`, `tratamentos`), todas desligadas por padrão, menos o compartilhamento por tratamento, que nasce ligado na criação do lembrete com a frase dita na tela (decisão 6 do doc 15 do portal).
- **D-E2.3 Pedir horário pelo app é aceitar o vínculo.** A tela de pedido diz que a clínica passa a acompanhar o pet. Os outros caminhos (balcão, importação, acesso temporário, QR da carteirinha) nascem como proposta que o responsável aceita no app.
- **D-E2.4 Um escritor da clínica para o app.** Toda escrita no domínio do app vinda de parceiro passa pelo `PublicadorClinicoService` (E2-04), que chama os escritores únicos que já existem (`ConsultaService.createWithTx`, P5 da receita com IA).
- **D-E2.5 O que foi publicado é do responsável.** Ele não edita (é registro de outro profissional), mas pode remover a cópia do app dele. O registro da clínica não muda. Encerrar o vínculo não apaga o que já foi publicado.
- **D-E2.6 Quarto mecanismo, separado.** O vínculo não reaproveita `CompartilhamentoPrestador` (D1 do épico de acesso: três mecanismos distintos). Ele pode **nascer** de um acesso temporário, mas é outra tabela, com outra vida.

## Riscos do épico

| Nível | Risco | Mitigação |
|---|---|---|
| Alto | Proposta de vínculo usada como spam ou para descobrir se alguém tem conta | A resposta da clínica é a mesma com ou sem conta; teto de propostas por parceiro por dia; o responsável pode bloquear propostas de uma clínica |
| Alto | Publicação no pet errado (dois "Rex" do mesmo responsável) | O responsável escolhe o pet no aceite (LIGAR a um pet existente ou CRIAR); a clínica nunca escolhe o `petId` do app |
| Alto | Clínica lendo dado do app depois da revogação | Toda leitura confere o consentimento na hora (sem cache); revogar tem efeito imediato; trilha `LER_DADO_DO_APP` (E1-05) |

## Change Log

| Data | Versão | Mudança | Autor |
|---|---|---|---|
| 2026-10-20 | 0.1 | Criação | Nicolas (via Claude) |
