# Épico E9: O que falta para vencer (backlog fora do desenho do portal)

**Status:** Draft (backlog: cada item vira épico ou spec própria quando entrar em onda)
**Autor:** Nicolas (via Claude)
**Criado em:** 2026-10-20
**Versão:** 0.1
**Épico pai:** [portal-do-parceiro.md](portal-do-parceiro.md)

---

## Visão Geral

O portal desenhou o atendimento clínico e o hotel com uma profundidade que os concorrentes não têm. Mas ele não desenhou **dinheiro, nota fiscal e canais de mensagem**, e clínica nenhuma troca de sistema sem eles: SimplesVet e Vetsmart vendem exatamente agenda + prontuário + **financeiro + PDV + estoque + fiscal**. Este épico lista o que falta, em ordem de prioridade sugerida, com o mínimo de desenho para cada item virar spec depois.

Nada aqui tem tela no portal hoje. Cada item cita o que já existe na API para reaproveitar.

## Ordem sugerida

| # | Item | Por que nesta posição | Reaproveita |
|---|---|---|---|
| 1 | **Planos do parceiro e cobrança B2B** | Sem isso a plataforma não tem receita própria (Q1 do épico pai). O parceiro web não passa por loja de app | `ModuloDoParceiro` (E1-02) com `origem=PLANO`; `WebhookEvent` (dedup de webhook) |
| 2 | **Pix e link de pagamento** (sinal do hotel, orçamento aprovado pelo app, cobrança de consulta) | Tira o "registra-se o que foi pago" do hotel e do orçamento | Webhook com dedup, `ParceiroTransacao` como modelo de ledger append-only |
| 3 | **WhatsApp oficial** (Meta Cloud API) | Véspera, oferta de vaga e aviso a quem veio pelo link não chegam em quem não tem app | Interface `CanalNotificacao` (D6 do épico de notificações), `AvisoAoResponsavel` (E3-06) |
| 4 | **Financeiro da clínica** (caixa, contas a receber e a pagar, repasse por profissional, DRE simples, conciliação de cartão) | Paridade com SimplesVet e Vetsmart; é o que o dono olha todo dia | Papel FINANCEIRO e permissão `financeiro.*` (E1-03) |
| 5 | **PDV e estoque geral** (produtos, medicamentos e insumos, com lote e validade; baixa pela venda e pela prescrição da internação) | O estoque de hoje é só de vacina (doc 17 do portal) | E6 (saldo derivado, lote, validade), E5-02 (administrações) |
| 6 | **Fiscal** (NFS-e e NF-e por provedor, com o certificado A1 do cliente) | Exigência legal de quem vende; trava a adoção sem ela | Financeiro (item 4) |
| 7 | **Banho e tosa** | Reuso quase total: agenda (E3) com salas e tipos BANHO, ficha estética publicada como `ServicoRealizado` | E3, E2-04, `AnotacaoPrestador` (campos de estética) |
| 8 | **App do veterinário** (perfil parceiro no app: agenda do dia, prontuário rápido, internação no tablet) | O app já tem Agenda, MRP e Atividade do parceiro atrás de `PARTNER_HOME_CLINICAL_NAV_ENABLED=false` | As mesmas rotas `/parceiro/portal/*` |
| 9 | **Exames de laboratório integrados** (pedido estruturado ao laboratório parceiro e resultado com valores voltando ao prontuário e ao app) | Fecha o ciclo do pedido de exame (E4-06); a leitura de laudo por IA estende a porta `ExtratorReceita` "por tipo de documento" | E4-02 (catálogo de exames), leitura de receita |
| 10 | **Assinatura qualificada ICP-Brasil** (provedor em nuvem) | Receita controlada e telemedicina podem exigir (Q-JUR2) | E4-03 (o PDF e o hash já existem) |
| 11 | **Telemedicina e teleorientação** (vídeo com prontuário e cobrança, dentro da Res. CFMV de telemedicina) | Diferencial e receita nova para o vet autônomo | Agenda (tipo novo), E4-01, item 2 |
| 12 | **Multiunidade** (rede de clínicas sob um grupo, paciente compartilhado entre unidades, relatório consolidado) | Clínicas maiores e redes | `Parceiro` + entidade de grupo; vínculo por unidade |
| 13 | **Encaminhamento entre parceiros** (referência e contrarreferência com o prontuário junto, consentido) | "Prontuário que viaja com o pet" do PRODUCT.md do portal | Vínculo (E2-02), cópia do prontuário (E4-06) |
| 14 | **Campanhas e CRM da clínica** (régua de recall de vacina, aniversário, retorno, check-up anual) | Receita recorrente da clínica | Lista de chamada (E4-04), categoria `ENGAJAMENTO` e preferências LGPD |
| 15 | **Farmácia conectada** (a receita vira pedido em farmácia parceira; recorrência do remédio contínuo) | Ecossistema e receita por participação | Receita (E4-03), tratamento contínuo (E4-05) |
| 16 | **Prevenção preditiva** (score de risco por raça, idade, peso e região sobre dado estruturado) | "IA clínica" do posicionamento do portal; só possível porque tudo é estruturado (D-E4.1) | Toda a base estruturada; exige base legal e anonimização |
| 17 | **Diretório e marketplace** (o responsável acha clínica e hotel perto e agenda) | Aquisição de clientes para o parceiro; SEO no site | Perfil público (E1-01), agendamento e reserva online (E3-05, E7-03), `PrestadorDiretorioService` |
| 18 | **Creche (daycare)** | O modelo do hotel foi desenhado para receber (doc `hotel/01`) | E7 |
| 19 | **Conferência automática de CRMV e CNPJ** | Hoje é manual no admin (E1-03) | Cadastro do parceiro |
| 20 | **Balcão offline** (fila de gravações com sincronização) | "A internet da clínica cai" | Idempotência (E1-04), versão otimista (E3-02, E4-01) |
| 21 | **Documentos privados no app** | Follow-up do risco aceito na D-DOC da receita; tudo o que a clínica entrega e o responsável salva em Documentos cai no bucket público | `CofreArquivosService`, URL assinada |

## Riscos a lembrar quando cada item entrar

- **Pagamento e fiscal:** PCI (nunca guardar cartão), contrato com o provedor, conciliação, webhook idempotente.
- **WhatsApp:** opt-in explícito, modelos aprovados pela Meta, custo por conversa, nunca conteúdo clínico.
- **Preditiva e campanhas:** base legal LGPD por finalidade e opção de sair; nada de score mostrado ao responsável como diagnóstico.
- **Copy:** "repasse" ao profissional (financeiro interno da clínica) não é a "participação" do programa de parceiros da PetJourney. O texto da API não diz "comissão" em nenhum dos dois.

## Change Log

| Data | Versão | Mudança | Autor |
|---|---|---|---|
| 2026-10-20 | 0.1 | Criação | Nicolas (via Claude) |
