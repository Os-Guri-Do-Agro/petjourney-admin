# Visão de produto e auditoria do que existe hoje

Este documento tem duas metades que não devem ser lidas como uma só.

A **primeira** é a visão: o que o PetJourney precisa ter para bater de frente com SimplesVet,
Vetsmart e afins, e o que ele precisa ter que ninguém tem. É norte de produto, escrito por quem
decide o produto. Não é estimativa nem cronograma.

A **segunda** é a auditoria: item por item, o que já existe no código hoje, o que existe pela
metade e o que não existe. Foi levantada lendo `petjourney-api/prisma/schema.prisma` (todos os
modelos), os 362 endpoints dos controllers e as 29 páginas de `petjourney-admin`. Onde está
escrito "não existe", foi verificado — não deduzido pelo nome do módulo.

**A regra que vale para tudo o que sair daqui:** a API pode ter mais do que está descrito aqui,
mas não pode ter menos.

## A regra de evolução — nada é removido

> **O que já existe não sai. Adapta, melhora e acrescenta o que faltou.**

Isto não é preferência de estilo, é restrição de projeto, e vale sobre qualquer sugestão feita
neste documento. Onde a auditoria disser que um modelo está mal formado para o uso clínico, a
saída **nunca** é apagar e refazer: é manter o que existe servindo quem já depende dele, criar o
que falta ao lado, e ligar os dois.

Três consequências práticas que valem para todo o resto do documento:

1. **Campo novo nasce opcional.** Nenhuma coluna existente vira obrigatória e nenhuma é
   derrubada. Linha antiga continua válida sem preencher nada.
2. **Texto livre não é apagado quando o estruturado chega.** Os dois convivem: o estruturado
   passa a ser a fonte de verdade para o que é novo, o texto continua sendo o que é para o
   histórico que já foi escrito assim. Retrocompatibilidade não é migração pela metade — é o
   contrato.
3. **Retrocarga é oportunista, nunca destrutiva.** Onde der para inferir a ligação (por exemplo,
   `clinicaNome` que casa exatamente com uma `Clinica.nome`), preenche a chave nova **e mantém a
   string**. Onde não der, deixa nulo. Nunca chuta, nunca sobrescreve.

O app do responsável está em produção e depende dos modelos de hoje. Toda entidade clínica nova
nasce **ao lado** dele e **projeta** de volta para o que ele já lê — o responsável não pode
perceber a mudança a não ser por passar a ver mais coisa.

> **Nota de terminologia.** O texto original desta visão usa "tutor". Em **texto visível em
> português** o termo obrigatório é **"responsável"** — é exigência legal, não preferência de
> escrita. "Tutor" sobrevive apenas como identificador de código e campo de API (`tutorId`,
> `model Tutor`, claim `TUTOR`, rota `/tutor`), onde já está e onde renomear custaria mais do que
> entrega. Ao escrever tela, e-mail, push ou documento clínico: **responsável**.

---

## Legenda de status

| Status | Significa |
| --- | --- |
| **Pronto** | Existe na API e tem tela. Funciona ponta a ponta. |
| **Parcial** | Existe parte. A coluna diz exatamente qual parte falta. |
| **Só no front** | Desenhado, tipado e testado no módulo clínico do admin, **sobre dados mocados**. Não existe endpoint. |
| **Não existe** | Nem modelo, nem endpoint, nem tela. |

O status **"Só no front"** é o mais importante deste documento e o mais fácil de ler errado. O
módulo `src/features/clinico` do admin tem domínio completo — agenda, conflitos, prontuário,
bulário, doses, faltas, fila — com 118 testes passando. Nada disso toca a API. É **especificação
executável**, não sistema entregue: quando a API for moldada, os tipos em
`src/features/clinico/data/types.ts` são o contrato que já foi pensado, não um rascunho.

---

## Bloco 1 — Paridade: o que eles têm, feito melhor

### 1.1 Agenda inteligente

Multi-vet, multi-sala, bloqueios, encaixe, agenda online pública (responsável agenda pelo
app/link), confirmação automática por WhatsApp, fila de espera com aviso quando abre horário,
controle de falta com política de reagendamento.

| Item | Status | Onde está / o que falta |
| --- | --- | --- |
| Multi-vet e multi-sala | Só no front | `Professional`, `Room` (`consultorio`/`cirurgia`/`banho`/`internacao`/`exame`), grade por coluna. **Não há modelo `Agendamento` na API.** |
| Bloqueios com recorrência | Só no front | `Block`, `BlockRecurrence`, almoço/reunião/manutenção/férias, validação de janela. |
| Encaixe | Só no front | `Appointment.origin = 'encaixe'`, diálogo dedicado, nada bloqueia — conflito avisa e o botão vira "Agendar mesmo assim". |
| Conflitos | Só no front | `domain/conflicts.ts` + `overlap.ts` + `load.ts`. Conflito viaja como `kind` + `params`, nunca texto pronto. |
| Fila de espera com oferta | Só no front | `WaitlistEntry` com `status`, `priority`, `WaitlistWindow`, expiração de oferta. Tela `/veterinario/fila`. |
| Controle de falta | Só no front | `NoShowSummary`, tela `/veterinario/faltas`. **Política de reagendamento não existe** nem no front. |
| Agenda online pública | **Não existe** | Nenhum endpoint público de disponibilidade, nenhuma reserva pelo app do responsável. |
| Confirmação automática por WhatsApp | **Não existe** | Há `OutreachTemplateWhatsapp` e `StatusContatoWhatsapp`, mas são do funil B2B de captação, não de confirmação de consulta. |
| Reserva provisória do horário | **Não existe** | `Hold` está tipado e `criarReserva`/`liberarReserva` existem no repositório mocado, **sem uso**. Duas recepcionistas podem chegar ao mesmo horário. |

**O buraco aqui é estrutural, não de acabamento:** a API não tem agenda. Nenhum modelo, nenhum
endpoint. É o maior item isolado deste documento.

### 1.2 Prontuário eletrônico estruturado

| Item | Status | Onde está / o que falta |
| --- | --- | --- |
| Anamnese estruturada | Só no front | `Anamnese` com queixa, duração, evolução, apetite, hidratação. |
| Exame físico com referência por espécie | Só no front | `ExameFisico`, `Measurement`, `VitalKey`, `ReferenceRange` por espécie/porte, `RangeStatus`. |
| Diagnóstico diferencial | Só no front | `Diagnosis` com `kind` = presuntivo / definitivo / **diferencial**. |
| Condutas e evolução | Só no front | `CarePlan`, `Encounter` com `status` rascunho/finalizado e `EncounterLock`. |
| Diagnóstico crônico do pet | **Parcial** | `model Diagnostico` existe na API com enum `CategoriaDiagnostico` e `TratamentoFixo` ligado. É condição crônica do pet, **não** o diagnóstico de um atendimento. |
| Histórico de consulta na API | **Parcial — e é o problema** | `model Consulta` existe, mas `clinicaNome String?`, `veterinarioNome String?`, `diagnostico String?` e `prescricao String?` são **texto livre**. Não há FK para `Clinica` nem para `Veterinario`. |

**A filosofia declarada é "estruturado de nascença, nunca texto livre como fonte de verdade", e o
`model Consulta` de hoje é exatamente o contrário disso.** Ele nasceu como histórico que o
responsável preenche, não como prontuário que a clínica assina.

**`Consulta` não é reescrito nem removido** — pela regra de evolução, ele continua sendo o
histórico do lado do responsável, que é o papel que sempre teve e que o app em produção usa. O
prontuário clínico nasce ao lado, como `Atendimento`, e projeta de volta para `Consulta` quando é
finalizado. O caminho completo está em **Plano de evolução, item 1**.

O que não dá para adiar é a existência do lado estruturado: tudo do Bloco 2 (IA, score preditivo)
depende dele, e nenhum funciona sobre `diagnostico String?`.

### 1.3 Receituário digital

| Item | Status | Onde está / o que falta |
| --- | --- | --- |
| Prescrição estruturada | **Parcial** | Front: `Prescription` + `DoseCalc` + `PrescriptionRoute`. API: `ConsultaPrescricaoItem` e `AnotacaoPrescricaoItem` existem — este é um dos poucos pontos já estruturados dos dois lados. |
| Cálculo de dose por peso | Só no front | `domain/dose.ts`, faixa por espécie, começa pelo mínimo da faixa. Testado. |
| Bulário integrado | Só no front | 16 medicamentos com classe, princípio ativo, dose por espécie, contraindicação, cuidados (renal, hepático, filhote, idoso, gestante), interações. Ligado ao prontuário pelo `BularioPicker`. |
| Receituário em A4 e receita de controle especial | Só no front | `DocumentoReceituario`, duas vias para controlado, impressão do navegador. |
| **Assinatura eletrônica padrão CFMV** | **Não existe** | Zero ocorrências de "CFMV" ou "assinatura eletrônica" nos dois repositórios. Sem isso o receituário não tem valor legal. |
| Envio direto ao responsável no app | **Não existe** | O documento é impresso/salvo pelo navegador; não há entrega pelo app. |

### 1.4 Exames

| Item | Status | Onde está / o que falta |
| --- | --- | --- |
| Pedido estruturado | **Parcial** | `AnotacaoExameSolicitado` na API, `ExamCatalogItem` no front. |
| Resultado no prontuário | **Parcial** | `ConsultaExame`, `AnexoPrestador`, `laudoTexto String?` — laudo é texto livre e anexo é arquivo. |
| Resultado na timeline do responsável | **Parcial** | Módulo `timeline` existe; a ligação exame → timeline não está fechada. |
| **Integração com laboratório** (Labclin, Vetscan) | **Não existe** | Nenhuma integração, nenhum conector. |
| Hemograma fora da referência destacado | **Não existe** | Depende de resultado estruturado, que não existe. |

### 1.5 Vacinas e protocolos

| Item | Status | Onde está / o que falta |
| --- | --- | --- |
| Carteirinha do responsável | **Pronto** | `model Vacina` + `LembreteSerie` com `gerouLembrete`. |
| **Carteirinha da clínica é a mesma entidade** | **Parcial** | `Vacina` é do pet, não da clínica: não tem lote, fabricante, aplicador, nem CRMV de quem aplicou. Os dois lados existem; a carteirinha oficial ainda não. |
| Protocolo por espécie com próxima dose automática | **Parcial** | `ProtocoloAdmin` e `ProtocoloSequencia` existem. Falta amarrar a protocolo por espécie e agendar (e agendar depende da agenda, que não existe). |

### 1.6 Internação

| Item | Status | Onde está / o que falta |
| --- | --- | --- |
| Registro de internação | **Parcial — e não é o que a visão pede** | `model Internacao` está pendurado em `LembreteSerie`: comeu / urinou / defecou / intercorrência / observações. É diário de acompanhamento do lado do responsável. |
| Mapa de leitos | **Não existe** | Não há modelo `Leito`. `RoomKind` do front tem `'internacao'` como tipo de sala, o que é outra coisa. |
| Prescrição por horário | **Não existe** | — |
| Checklist de enfermagem | **Não existe** | — |
| Evolução por plantão | **Não existe** | — |
| Boletim automático ao responsável | **Não existe** | É citado na visão como diferencial absurdo e hoje não tem nada. |

### 1.7 Financeiro, 1.8 PDV e estoque, 1.9 Fiscal

| Item | Status | Observação |
| --- | --- | --- |
| Contas a pagar / a receber | **Não existe** | — |
| Fluxo de caixa, DRE | **Não existe** | — |
| Conciliação de cartão, split de pagamento | **Não existe** | Há `Subscription`, `ProdutoGateway` e `WebhookEvent` — é cobrança de assinatura do app, não caixa de clínica. |
| Comissionamento por vet | **Parcial** | `ParceiroCarteira`, `ParceiroTransacao`, `ParceiroSaque`, `OrigemComissao`, `PeriodicidadeComissao`, módulo `comissao` com portal de carteira. **Existe para parceiro, não para veterinário dentro de uma clínica.** |
| PDV, estoque, lote, validade, curva ABC, código de barras | **Não existe** | Nenhum modelo. `ProdutoGateway` é produto de gateway de pagamento, não item de estoque. Controle de lote e validade é crítico para vacina — e é justamente o que falta para a carteirinha oficial de 1.5. |
| NFS-e / NF-e | **Não existe** | Verificado: as ocorrências de "NFe" no código são falso positivo (`Confere`, `INFECCAO`). Trava adoção; avaliar parceiro (Focus NFe, eNotas) em vez de construir. |

### 1.10 a 1.14

| Item | Status | Onde está / o que falta |
| --- | --- | --- |
| Pacotes e planos **da clínica** com recorrência | **Parcial** | `Plano`, `PlanoBeneficio`, `Beneficio`, `Subscription`, `TipoPlano` existem — são planos **do PetJourney para o responsável**. Plano vendido pela clínica (banho e tosa, preventivo anual) não existe. |
| Lembrete de retorno | **Parcial** | `LembreteSerie` / `LembreteOcorrencia` / `TipoLembrete` / `FrequenciaLembrete` são robustos. Falta o gatilho vindo do atendimento. No front, `domain/follow-up.ts` calcula retorno vencido e a tela `/veterinario/atividades` mostra. |
| Aniversário do pet, campanha de vermífugo | **Parcial** | A régua existe em `lembrete` e `notificacao` (+ `DeviceToken`, `NotificacaoEntrega`, `StatusEntregaPush`). Falta a campanha clínica em cima. |
| **Régua por WhatsApp oficial (API Meta)** | **Parcial — e do lado errado** | Toda a máquina de WhatsApp (`OutreachTemplateWhatsapp`, `OutreachEnvio`, `OutreachEvento`, `MotivoSupressao`) está no funil **B2B de captação de clínica**, não na comunicação com o responsável. A infraestrutura serve; o uso ainda não existe. |
| Multi-unidade e permissões | **Parcial** | `ClinicaRole` + `ClinicaPermission` + `ClinicasEquipe` dão RBAC por clínica. Auditoria de acesso existe (`AberturaArquivoCompartilhado`, `StatusAuditoriaParceiro`, `TipoAcaoAdmin`). **Rede de clínicas (matriz → unidades) não existe:** `Clinica` não tem pai. |
| Relatórios e dashboard do dono | **Parcial / Só no front** | `/veterinario/resumo` entrega movimento por dia, ocupação, comparecimento, por tipo, por profissional, mapa de horário e diagnósticos mais frequentes — **sobre dados mocados**. Faturamento, ticket médio e rentabilidade por procedimento **não existem**, porque não há financeiro. |
| Telemedicina | **Não existe** | Zero ocorrências. |

---

## Bloco 2 — O que ninguém faz

Este bloco é onde o produto está **mais adiantado**, e é a inversão que vale registrar: a
paridade está atrasada, o diferencial está em pé.

### 2.1 Prontuário portátil do pet — **a maior força que já existe**

| Item | Status | Onde está |
| --- | --- | --- |
| O dado é do responsável e viaja com ele | **Pronto** | `CompartilhamentoPrestador`: código de acesso, `duracaoHoras`, `expiraEm`, `revogadoEm`, `snapshot Json`, `CategoriaInfoCompartilhada` (o responsável escolhe o que compartilha), `EscopoAcessoPet`, `DelegacaoPet`. |
| Trocou de clínica, o histórico vai junto com consentimento | **Pronto** | É exatamente o que o compartilhamento por código faz. O prestador se vincula (`vinculadoEm`, `parceiroId`) e escreve de volta via `AnotacaoPrestador`. |
| Auditoria de quem abriu o quê | **Pronto** | `AberturaArquivoCompartilhado` com `CanalAberturaArquivo`. |
| QR da coleira abre ficha de emergência | **Parcial — e diverge da visão de propósito** | Existe e funciona (`public-pet.controller.ts`, `GET /:slug` e `GET /tutor/:slug`, + `Microchip`). **Mas entrega bem menos do que a visão pede — deliberadamente.** Ver abaixo. |

**A ficha pública é mínima por decisão, não por esquecimento.** O endpoint traz identificação
(nome, foto, espécie, raça, porte, castrado, microchip), o nome do responsável e `alertasCriticos`
— que são **só o gatilho das alergias marcadas como `GRAVE`**. O código registra que saíram de lá,
numa mudança marcada como "D2": `vacinas`, `diagnosticos`, `tratamentosFixos`, as alergias
completas e a data de nascimento. E é explícito quanto ao responsável: *"sem CPF, sem email, sem
telefones"*.

A visão pede "alergias, **medicação** e **contato** pra qualquer vet do mundo". Hoje não há
medicação e não há contato. **Os dois lados têm razão** e é por isso que isto não se resolve
acrescentando campo ao payload público: a URL do QR é aberta e não autenticada — quem achar a
coleira vê tudo o que estiver lá. Lista de medicação contínua é dado de saúde; telefone é dado
pessoal. Publicar os dois numa URL que qualquer um lê é exposição real, e quem escreveu "D2"
estava certo em tirar.

O caminho está no **Plano de evolução, item 14**: manter a ficha pública exatamente como está e
acrescentar um degrau acima dela, não alargar o degrau que existe.

**O modelo de dado inteiro já está invertido a favor do responsável.** Nenhum concorrente pode
copiar isso sem quebrar o próprio lock-in. Vale tratar como o eixo, não como uma feature da
lista.

### 2.2 Continuidade bidirecional

| Item | Status | Onde está / o que falta |
| --- | --- | --- |
| O vet vê o diário do responsável antes da consulta | **Pronto** | `DiarioPet` + `DiarioPetFoto` com `SintomaPet`, `VitalidadePet`, `ConsumoDiario`, `AspectoFezes`, `EstadoUrina`, `DoencaDiario`, `CicloCio` — muito estruturado. `PesoRegistro` para peso em casa. `incluirNotasDiario` no compartilhamento. |
| O responsável vê a conduta depois | **Pronto** | `AnotacaoPrestador` volta para o lado dele; `timeline` entrega. |
| **Adesão a tratamento monitorada** | **Parcial** | `TratamentoFixo` + `LembreteSerie`/`LembreteOcorrencia` dão a cobrança na hora certa. **Falta o retorno para o vet:** não há como o vet ver se o responsável deu o remédio. É o argumento de venda mais forte da visão e falta a última perna. |

### 2.3 IA clínica — **não existe nada**

| Item | Status |
| --- | --- |
| Anamnese por voz com SOAP automático | **Não existe** |
| Resumo instantâneo do histórico | **Não existe** |
| Sugestão de diferenciais e exames | **Não existe** |
| Leitura assistida de exames | **Não existe** |
| Rascunho de boletim e de mensagem | **Não existe** |

Zero ocorrências de `openai`, `anthropic` ou transcrição nos dois repositórios. **Pré-requisito
duro:** todos os cinco dependem de prontuário estruturado (1.2) e os dois últimos de resultado de
exame estruturado (1.4) e internação (1.6). Enquanto `Consulta.diagnostico` for `String?`, não
há sobre o que a IA trabalhar.

### 2.4 a 2.11

| Item | Status | Onde está / o que falta |
| --- | --- | --- |
| Score de saúde e prevenção preditiva | **Não existe** | Depende de dado estruturado em massa. `SaudeDica` e `saude-dica` são conteúdo editorial, não predição. |
| Rede credenciada estilo plano de saúde | **Parcial — a base está pronta** | `Parceiro`, `ParceiroEquipe`, `Cupom`, `CupomResgate`, `CodigoIndicacao`, `Beneficio`, carteira, saque, comissão, portal do parceiro com dashboard e métricas. O posicionamento "participação, não comissão" já está codificado. |
| Marketplace de demanda | **Não existe** | Nenhuma busca por serviço/proximidade, nenhuma disponibilidade pública. Depende da agenda (1.1). |
| Segunda opinião / encaminhamento / comunidade | **Não existe** | Nenhum modelo. Mais perto: `CompartilhamentoPrestador` já sabe entregar prontuário a um terceiro — o encaminhamento seria uma variante dele. |
| Emergência SOS | **Parcial** | `public-pet` e `qr` dão a ficha na frente. Faltam plantão 24h, proximidade e o botão. |
| Farmácia conectada / recorrência de medicamento | **Não existe** | `TratamentoFixo` guarda o contínuo; não vira pedido. |
| Ciclo completo: neonatal → memorial | **Parcial** | O fim de vida está tratado com cuidado: `PetInativacaoLog`, `PetInativacaoMotivo`, `PetInativacaoAcao`, `PetInativacaoOrigem`, `InactivationLog`, `InactiveReason`. **Memorial na timeline não existe.** Protocolo neonatal não existe. |
| Offline-first no balcão | **Não existe** | As 9 ocorrências de "offline" no admin são estado de conexão em tela, não fila de escrita. |
| **Migrador (SimplesVet, Vetsmart, planilha)** | **Não existe** | `OutreachImportacao` importa **lead**, não prontuário. A visão chama isso de feature de guerra e trata como produto; hoje é zero. |

---

## Bloco 3 — Modelo de negócio

| Item | Status | Onde está / o que falta |
| --- | --- | --- |
| SaaS por vet ativo/mês | **Não existe** | `Subscription`, `Plano`, `TipoPlano`, `TipoAssinatura`, `StatusAssinatura` e `ProdutoGateway` cobram **o responsável**. Não há assinatura B2B por vet ativo. |
| Take rate em agendamento, pagamento, farmácia | **Não existe** | Depende de agenda, pagamento e farmácia. |
| Rede credenciada com mensalidade | **Parcial** | Credenciamento, auditoria (`StatusAuditoriaParceiro`) e repasse existem. Mensalidade de credenciamento não. |
| Freemium para vet autônomo/domiciliar | **Parcial** | Há `seed-freemium-tutores.ts` — freemium do lado do responsável. Do lado do vet autônomo, não. |
| App do responsável gratuito alimenta o funil B2B | **Pronto** | `outreach` completo: `OutreachLead`, `OutreachCampanha`, `OutreachEnvio`, `OutreachTemplate` + variantes, `OutreachSupressao`, `OutreachEvento`, `StatusValidacaoLead`, `CategoriaOutreachLead`, `OrigemLead`. Também `Influencer` com carteira, saque e transação. |
| Lead "minha clínica não está no PetJourney" | **Não existe** | A máquina de outreach existe e o app existe; **o gatilho que liga um no outro, não**. É barato e está faltando. |

---

## O que este documento acrescenta à visão

Cinco coisas que não estavam na lista e que a API vai precisar de qualquer jeito. Não são ideias
novas de produto — são consequências do que já foi pedido.

**1. Ligar `Clinica` e `Parceiro` sem fundir nem escolher entre eles.** Hoje são duas árvores
organizacionais paralelas e desconexas. `Clinica` tem `ClinicaRole`, `ClinicaPermission`,
`ClinicasEquipe`, `ClinicasPacientes`. `Parceiro` tem `ParceiroEquipe`, carteira, transações e
portal. E `Veterinario` não aponta para nenhuma das duas — só para `Usuario`. Não existe vínculo
empregatício no modelo. Toda a agenda multi-vet do Bloco 1 precisa saber quem trabalha onde, e
hoje não há como responder. As duas árvores **permanecem**, cada uma servindo o que já serve; o
que falta é a ponte entre elas e o vínculo do profissional. **É a primeira coisa a construir,
antes de qualquer endpoint novo** — ver Plano de evolução, item 2.

**2. `Atendimento` (ato clínico) nasce ao lado de `Consulta` (histórico do responsável).** São
coisas diferentes, com donos, permissões e ciclos de vida diferentes. Tentar servir as duas com
um modelo só é o que produziu o `clinicaNome String?` de hoje. `Consulta` fica onde está e como
está; o que muda é que ela passa a poder **apontar** para um atendimento, sem nunca ser obrigada
a isso.

**3. Identidade profissional além do CRMV.** `Veterinario` tem `crmv` único, o que é bom. Falta
UF do conselho, situação (ativo/suspenso) e responsável técnico da clínica — sem isso não há
receituário com validade legal (1.3) nem controlado.

**4. Unidade de medida e apresentação de dose como contrato da API, não da tela.** O front já
tem `DoseCalc` e `domain/dose.ts` testados. Se a API devolver dose como texto, esse trabalho é
jogado fora e volta o erro de vírgula/ponto que já apareceu ("17.54 mg" sem dizer de que
remédio). Dose atravessa a API como número + unidade + via + frequência + duração.

**5. Idempotência e reserva em tudo que agenda.** O `Hold` tipado e não usado no front é o aviso
antecipado: sem reserva provisória e sem chave de idempotência, duas recepcionistas fecham o
mesmo horário. Isso não aparece com dado mocado e aparece no primeiro dia com API real.

---

## Plano de evolução — como chegar lá sem remover nada

Um item por lacuna, na ordem em que destravam uns aos outros. Cada um diz **o que se adapta** (o
que já existe e ganha capacidade) e **o que nasce ao lado** (o que não existe e é acrescentado).
Nenhum item apaga modelo, coluna ou endpoint.

### 1. Prontuário: `Atendimento` ao lado de `Consulta`

**Adapta.** `Consulta` ganha três campos, todos opcionais: `atendimentoId String? @unique`,
`clinicaId String?` e `veterinarioId String?`. `clinicaNome` e `veterinarioNome` **continuam
onde estão** — passam a ser o que sempre foram na prática (o nome digitado quando não há
cadastro), e não são apagados nem quando a chave é preenchida. Nenhum campo existente vira
obrigatório.

**Nasce ao lado.** `Atendimento`, o ato clínico com dono: FK obrigatória para `Clinica`,
`Veterinario` e `Pet`, com `status` (rascunho/finalizado), trava de edição e carimbo de
finalização. Pendurados nele, espelhando os tipos já testados em
`src/features/clinico/data/types.ts`: anamnese, exame físico com aferições e faixa de referência
por espécie, diagnósticos do atendimento (presuntivo / definitivo / **diferencial**), prescrições
com dose estruturada e plano de conduta.

**Como os dois se ligam.** Ao finalizar um `Atendimento`, a API **projeta** uma `Consulta` (ou
atualiza a que já existe) preenchendo os campos de texto que o app do responsável já lê hoje. O
app não muda: ele continua lendo `Consulta` e passa a ver conteúdo melhor. Quem quiser o
estruturado pede `Atendimento`.

**Retrocarga.** Onde `clinicaNome` casar exatamente com uma `Clinica.nome`, preenche `clinicaId`
e mantém a string. Onde não casar, deixa nulo. Consulta antiga nunca ganha `Atendimento`
inventado — ela é histórico declarado pelo responsável e continua sendo exatamente isso.

### 2. Organização: a ponte entre `Clinica` e `Parceiro`, e o vínculo do profissional

**Adapta.** `Clinica` ganha dois campos opcionais: `parceiroId String?` (a clínica **também** é
um parceiro credenciado, quando for) e `matrizId String?` (auto-relação, para rede de clínicas —
resolve o "multi-unidade" de 1.14). `ClinicaRole`, `ClinicaPermission`, `ClinicasEquipe`,
`ParceiroEquipe` e todo o portal do parceiro ficam intactos.

**Nasce ao lado.** `VinculoProfissional`, ligando `Veterinario` a `Clinica` com período, papel e
se entra na agenda. É deliberadamente **outra coisa** que `ClinicasEquipe`: aquele diz quem tem
acesso ao sistema, este diz quem pode ser agendado e assina ato clínico. Um recepcionista tem o
primeiro e não o segundo; um vet plantonista pode ter o segundo sem o primeiro.

**Por que primeiro.** Sem responder "quem trabalha onde", não há coluna de agenda, não há
comissão por vet e não há responsável técnico para o receituário.

### 3. Agenda: adição pura, contrato já escrito

**Nasce ao lado.** `Agendamento`, `Sala`, `Bloqueio` (com recorrência), `Reserva` e `FilaEspera`
— um para um com `Appointment`, `Room`, `Block`/`BlockRecurrence`, `Hold` e `WaitlistEntry`, que
já estão tipados e testados no admin. O domínio de conflito, sobreposição e carga
(`domain/conflicts.ts`, `overlap.ts`, `load.ts`) é regra de negócio e sobe para a API; o front
mantém a mesma checagem para resposta imediata.

**Dois pontos que só aparecem com API real:**

- **`Reserva` entra desde o primeiro dia**, não depois. O `Hold` tipado e não usado no front é o
  aviso antecipado: sem reserva provisória, duas recepcionistas fecham o mesmo horário.
- **Toda rota que cria ou move agendamento aceita chave de idempotência.** Retrofitar isso depois
  custa muito mais, e é também o alicerce do offline-first (item 11).

**Conflito atravessa a API como `kind` + `params`, nunca como frase pronta** — senão o texto não
tem tradução e o front não consegue destacar o que importa.

### 4. Vacina: a carteirinha oficial por enriquecimento

**Adapta.** `Vacina` ganha campos opcionais: `lote`, `fabricante`, `validade`, `clinicaId`,
`aplicadaPorVeterinarioId`, `viaAplicacao`. Nada mais. É isso que transforma "a carteirinha do
responsável" na "carteirinha oficial da clínica" **sendo a mesma entidade**, que é exatamente o
que a visão pede em 1.5 — dois lados, um modelo. Vacina antiga, sem lote, continua válida.

**Nasce ao lado.** `ProtocoloVacinal` por espécie, ligando-se a `ProtocoloSequencia` (que já
existe) e gerando a próxima dose na agenda quando ela existir.

**Dependência honesta:** lote e validade só ficam confiáveis com estoque (item 8). Até lá são
campo digitado — melhor que nada, e sem mentir que foi conferido.

### 5. Exames: laudo estruturado ao lado do laudo escrito

**Adapta.** `AnotacaoExameSolicitado`, `ConsultaExame`, `AnexoPrestador` e `laudoTexto` ficam.
Laudo em texto e PDF anexado continuam sendo o que o laboratório manda hoje.

**Nasce ao lado.** `ResultadoExame` com analitos estruturados: nome, valor, unidade, faixa de
referência por espécie e situação (abaixo / dentro / acima). É sobre isto que se destaca
hemograma fora da faixa (1.4) e é isto que a leitura assistida da IA (2.3) lê. O conector de
laboratório escreve aqui; enquanto não houver conector, o vet digita ou a IA extrai do PDF — e
nos dois casos fica marcado de onde veio.

### 6. Anotação do prestador: continua servindo quem não é clínica

**Adapta.** `AnotacaoPrestador` ganha `atendimentoId String?` opcional. Quando quem escreve é uma
clínica vinculada, a anotação passa a ser a face visível de um `Atendimento` estruturado. Quando
é banho e tosa, hotel ou adestrador, **continua exatamente como é hoje** — texto livre é a forma
certa ali, e tirar isso quebraria o compartilhamento que já funciona.

### 7. Internação: o boletim que já existe vira a saída do que falta

**Adapta.** `Internacao` (pendurado em `LembreteSerie`, com comeu/urinou/defecou/intercorrência)
**não muda**. Ele é o acompanhamento do lado do responsável e é bom nisso.

**Nasce ao lado.** `Estadia` com `Leito`, prescrição por horário, checklist de enfermagem e
evolução por plantão. Ao fechar um plantão, a `Estadia` **projeta** um boletim para o
`Internacao` que o responsável já acompanha — é assim que o "boletim automático pro tutor" da
visão sai de graça, reusando a tela que ele já conhece, em vez de inventar uma segunda.

### 8. Financeiro, PDV, estoque e fiscal: adição, reusando o que já sabe cobrar

**Nasce ao lado.** Contas a pagar/receber, caixa, `Produto`/`Lote`/`MovimentoEstoque`, venda e
emissão fiscal. Nada a preservar aqui — não existe.

**Mas adapta em três pontos, para não erguer uma pilha paralela:**

- **Pagamento** reusa `ProdutoGateway` e `WebhookEvent`, que já resolvem gateway e conciliação
  de assinatura. Não nasce um segundo stack de pagamento.
- **Comissão por vet** estende a máquina que já existe (`ParceiroCarteira`, `ParceiroTransacao`,
  `ParceiroSaque`, `OrigemComissao`, `PeriodicidadeComissao`) com um novo valor de origem, em vez
  de duplicar carteira e saque.
- **Fiscal** é integração, não construção: Focus NFe ou eNotas atrás de uma interface própria.

### 9. Comunicação: uma máquina de WhatsApp, dois usos

**Adapta.** Toda a infraestrutura de envio (`OutreachTemplateWhatsapp`, `OutreachEnvio`,
`OutreachEvento`, `MotivoSupressao`, `OutreachSupressao`) fica e passa a atender também a
comunicação com o responsável: confirmação de consulta (1.1), lembrete de retorno, aniversário e
campanha (1.11). O funil B2B continua usando exatamente o que usa.

**Ponto que não é detalhe:** `OutreachSupressao` — o opt-out — **vale para os dois usos**. Quem
pediu para não receber não recebe, e não importa de qual lado do produto o envio nasceu. Erguer
um segundo canal de WhatsApp sem passar pela mesma supressão é o jeito mais rápido de ser
bloqueado pela Meta e de tratar mal quem já disse não.

### 10. Documento clínico com validade legal

**Adapta.** `Veterinario` ganha `crmvUf`, `situacao` e o que marca responsável técnico da
clínica. `crmv` continua único e onde está.

**Nasce ao lado.** `AssinaturaDocumento` sobre receituário, atestado e laudo, no padrão CFMV. Os
quatro documentos A4 já existem no front (`DocumentoReceituario`, `DocumentoAtestado` e os
demais) e hoje são impressos pelo navegador — passam a ser assinados e entregues no app do
responsável, que é o que falta em 1.3.

### 11. Offline-first e migrador

**Adapta.** O migrador reusa a forma de `OutreachImportacao`, que já modela lote de importação
com status e erro por linha — muda o que se importa, não como. Offline-first se apoia nas chaves
de idempotência do item 3.

**Nasce ao lado.** `ImportacaoClinica` (SimplesVet, Vetsmart, planilha) e a fila de escrita no
cliente. A visão trata migrador como feature de guerra e produto próprio; este documento
concorda: sem ela, ninguém troca de sistema.

### 12. IA clínica

**Nasce ao lado**, e só depois de 1, 5 e 7 — não por prudência, por dependência: transcrição de
anamnese precisa de `Atendimento` para escrever, leitura de exame precisa de `ResultadoExame`
para ler, rascunho de boletim precisa de `Estadia`. Tudo que a IA gera nasce **marcado como
gerado e como rascunho**, e só vira registro depois que um profissional assina. Apoio à decisão,
nunca decisão — é o que a própria visão diz.

### 13. Os menores, que já têm quase tudo

| Lacuna | Adapta | Nasce ao lado |
| --- | --- | --- |
| Memorial (2.10) | `PetInativacaoLog` e afins ficam intactos — o fim de vida já é tratado com cuidado | Evento de memorial na `timeline` |
| Emergência SOS (2.8) | `public-pet` e `qr` já entregam a ficha na frente | Plantão 24h, proximidade e o botão |
| Encaminhamento (2.7) | `CompartilhamentoPrestador` já sabe entregar prontuário a um terceiro com consentimento | Uma variante dele com destino profissional e motivo |
| Lead "minha clínica não está aqui" (Bloco 3) | A máquina de outreach existe e o app existe | Só o gatilho que liga um no outro — é o item mais barato do documento |
| Plano da clínica (1.10) | `Plano`/`Subscription` continuam sendo PetJourney→responsável, sem risco à cobrança viva | `PlanoClinica` como segundo eixo, clínica→responsável |

### 14. Emergência em dois degraus, sem alargar o degrau público

O conflito está descrito em 2.1: a visão quer medicação e contato no QR, e a ficha pública hoje
não tem nem um nem outro, por decisão de privacidade que está certa.

**Adapta.** A ficha pública **não muda**. Continua com identificação, microchip e gatilho de
alergia grave — é o que faz sentido para quem achou um cachorro na rua, que é o caso de uso real
do QR na coleira.

**Nasce ao lado.** Um segundo degrau, por cima do mesmo `slug`, que revela medicação contínua,
alergias completas, diagnósticos ativos e telefone do responsável — aberto por uma destas duas
portas, nunca por URL adivinhável:

- **Profissional identificado:** vet autenticado com CRMV válido. Fica registrado quem abriu, e
  isso já tem forma pronta em `AberturaArquivoCompartilhado`.
- **O próprio responsável libera na hora:** ele recebe o aviso de que o QR do pet dele foi lido e
  abre o degrau dois com um toque — que é, aliás, como ele descobre que o pet foi encontrado.

**Por que assim.** A visão está certa no objetivo (o vet precisa saber o que o pet toma antes de
medicar) e a implementação de hoje está certa no meio (não publicar isso). Dois degraus atendem
os dois: emergência de rua resolve no primeiro, emergência clínica resolve no segundo, e nenhum
dado de saúde fica em URL aberta. O botão SOS de 2.8 usa o mesmo degrau dois.

### 15. Base de consentimento para o score preditivo e para a IA

Este item não estava na visão e **não é opcional** — é o que decide se 2.4 (score de saúde e
prevenção preditiva) pode existir.

O produto inteiro é vendido sobre "o dado é do responsável". O score preditivo precisa de "dado
estruturado de milhares de pets". As duas frases só convivem com uma resposta explícita sobre
**com que base o dado de um pet vira estatística de população**, e é melhor responder antes de
acumular o dado do que depois.

**Nasce ao lado.** Registro de consentimento por finalidade — atendimento, compartilhamento com
prestador, comunicação, e **uso agregado para prevenção** como finalidade separada e recusável
sem perder o resto. `CompartilhamentoPrestador` já provou que o modelo de consentimento
granular funciona aqui; isto é o mesmo padrão numa finalidade nova.

**Duas consequências de projeto, não de jurídico:**

- **Score que a clínica vê é sobre paciente dela** ("17 pacientes seus têm risco alto de X"), o
  que é uso dentro da relação de atendimento. **Modelo treinado sobre a base inteira** é outra
  coisa, e é a que precisa de anonimização real — não pseudonimização com `petId` no meio.
- **A comunidade clínica de 2.7** ("caso real e anonimizado") tem exatamente o mesmo problema:
  raça + idade + região + diagnóstico raro identifica paciente. Anonimizar caso clínico é mais
  difícil do que parece e merece decisão própria, não um `delete pet.nome`.

### Ordem sugerida

**2 → 1 → 3** é a espinha: sem vínculo profissional não há atendimento com dono, e sem
atendimento a agenda não tem no que se pendurar. Depois, **4, 5, 6, 10** enriquecem o que já
existe e são relativamente baratos. **8** é o maior bloco isolado e não bloqueia nada clínico —
mas bloqueia o dashboard do dono (1.13), que é argumento de venda. **12** vem por último por
dependência, não por importância.

**Duas exceções à ordem, que não são de construção e sim de decisão:**

- **15 (consentimento) vem antes de acumular dado**, não antes de escrever código. Decidir a
  finalidade depois de dois anos de prontuário guardado é decidir tarde: ou se pede consentimento
  retroativo a toda a base, ou não se usa o que já se tem.
- **14 (emergência em dois degraus)** pode entrar a qualquer momento e é barato, mas enquanto não
  entrar, **a promessa de marketing do QR precisa descrever o que ele faz hoje** — identificação e
  alerta de alergia grave — e não medicação e contato. Prometer numa coleira algo que a ficha não
  entrega é o tipo de coisa que só se descobre na emergência.

## Resumo honesto

**O que está de pé e é difícil de copiar:** o prontuário portátil com consentimento e auditoria,
o diário estruturado do responsável, a régua de lembrete e notificação, a rede de parceiros com
carteira e repasse, e a máquina de outreach B2B. O Bloco 2 — a parte que a visão diz que ninguém
faz — é justamente a que já tem fundação.

**O que está desenhado e não existe:** todo o módulo clínico. Agenda, prontuário estruturado,
bulário, doses, fila, faltas e resumo estão tipados e testados no admin, sobre dados mocados,
com 118 testes. É especificação executável esperando API.

**O que não existe de forma alguma:** agenda na API, financeiro, PDV, estoque, fiscal,
internação de verdade, telemedicina, integração com laboratório, assinatura CFMV, IA clínica,
marketplace, migrador e offline-first.

**A dívida que trava mais coisa que qualquer outra:** `Consulta` com diagnóstico, prescrição,
clínica e veterinário como texto livre. Ela sozinha bloqueia o Bloco 2 inteiro de IA e o score
preditivo, e contradiz a filosofia declarada de "estruturado de nascença".

**E ela não se paga apagando nada.** `Consulta` continua sendo o histórico do responsável, que é
o papel que sempre teve; o que falta é `Atendimento` nascer ao lado e projetar de volta. Vale
para todo o resto: o que já existe fica servindo quem depende dele, o que falta nasce ao lado, e
os dois se ligam por campo opcional. O plano item a item está em **Plano de evolução**; a espinha
é **vínculo profissional → atendimento → agenda**, nessa ordem, porque cada um é o chão do
seguinte.

---

# Anexo — a visão como foi escrita

Texto original, **sem edição**. As tabelas acima comprimem esta lista para poder auditá-la item a
item; onde houver divergência entre a paráfrase e este anexo, **vale este anexo**. É a fonte de
verdade do que a API precisa ter.

## Bloco 1: Paridade (o que eles têm, feito melhor)

**Agenda inteligente:** multi-vet, multi-sala, bloqueios, encaixe, agenda online pública (tutor
agenda pelo app/link), confirmação automática por WhatsApp, fila de espera com aviso quando abre
horário, no-show tracking com política de reagendamento.

**Prontuário eletrônico (PEP) estruturado:** anamnese, exame físico com valores de referência por
espécie/raça/idade, diagnóstico diferencial, condutas, evolução. Estruturado de nascença (você já
tem essa filosofia: entidade + enums, nunca texto livre como fonte de verdade). Isso vira ouro de
dados depois.

**Receituário digital com assinatura eletrônica** (padrão CFMV), envio direto pro tutor no app,
bulário integrado, cálculo de dose por peso automático.

**Solicitação e recebimento de exames:** pedido estruturado, integração com laboratórios
(Labclin, Vetscan etc.), resultado cai direto no prontuário E na timeline do tutor.

**Vacinas e protocolos:** carteirinha digital oficial da clínica que É a carteirinha do tutor no
app (mesma entidade, dois lados). Protocolos por espécie com agendamento automático da próxima
dose.

**Internação:** mapa de leitos, prescrição por horário, checklist de enfermagem, evolução por
plantão, boletim automático pro tutor (diferencial absurdo: tutor recebe atualização do pet
internado no app).

**Financeiro completo:** contas a pagar/receber, fluxo de caixa, comissionamento por vet, DRE
simples, conciliação de cartão, split de pagamento.

**PDV + estoque:** venda de produtos/serviços, controle de lote e validade (crítico pra vacina),
curva ABC, alerta de reposição, código de barras.

**Fiscal:** NFS-e e NF-e (isso trava adoção se não tiver; avaliar parceiro tipo Focus NFe/eNotas).

**Pacotes e planos próprios da clínica:** banho e tosa, plano preventivo anual, pacote de
vacinas, com recorrência de cobrança.

**CRM e retenção:** lembrete de retorno, aniversário do pet, campanha de vermífugo/antipulgas,
régua de comunicação por WhatsApp oficial (API Meta).

**Multi-unidade e permissões:** rede de clínicas, papéis (recepção, vet, gestor, financeiro),
auditoria de acesso (você já tem a base de provider access sharing e auditoria).

**Relatórios e dashboard do dono:** faturamento, ticket médio, retorno de clientes, produtividade
por vet, procedimentos mais rentáveis.

**Telemedicina/teleorientação:** vídeo integrado ao prontuário, cobrança embutida, dentro das
normas do CFMV.

## Bloco 2: O que ninguém faz

**Prontuário portátil do pet (o "pet leva o histórico"):** o dado é do tutor, viaja com ele.
Trocou de clínica? O histórico inteiro vai junto com consentimento. Nenhum concorrente faz porque
o modelo deles prende o dado na clínica. Você inverte: o lock-in é no pet, não na clínica. QR da
coleira abre a ficha de emergência (alergias, medicação, contato) pra qualquer vet do mundo.

**Continuidade de cuidado bidirecional:** o vet vê o diário do tutor (sintomas, apetite, peso em
casa) antes da consulta; o tutor vê a conduta do vet depois. Adesão a tratamento monitorada: o vet
prescreve, o app cobra o tutor na hora certa, o vet vê se o tutor deu o remédio. Isso muda
desfecho clínico. É o argumento de venda mais forte que existe.

**IA clínica de verdade (aqui você pulveriza todo mundo):**

- Anamnese por voz: o vet conversa com o tutor, a IA transcreve e estrutura o prontuário sozinha
  (SOAP automático). Economiza 10 min por consulta.
- Resumo instantâneo do histórico: "esse pet em 30 segundos" antes de entrar na sala.
- Sugestão de diferenciais e exames com base em sinais + raça + idade (apoio à decisão, nunca
  decisão).
- Leitura assistida de exames (hemograma fora da referência destacado e interpretado).
- Rascunho de boletim de internação e de mensagens pro tutor.

**Score de saúde e prevenção preditiva:** com dado estruturado de milhares de pets, você prevê
risco por raça/idade/região (obesidade, doença renal, dermatite sazonal) e gera receita pra
clínica: "17 pacientes seus têm risco alto de X, chame para check-up". O vet fatura mais, o pet
vive mais, você tem o dado que ninguém tem.

**Rede credenciada estilo plano de saúde** (já é o posicionamento da casa: participação, não
comissão): tutor Premium tem benefícios na rede, clínica credenciada recebe fluxo de clientes
qualificados. Você vira canal de aquisição pra clínica, não só custo de software. Clínica paga
feliz por sistema que TRAZ cliente.

**Marketplace de demanda:** tutor busca "vacina V10 perto de mim", vê agenda real das clínicas
credenciadas, agenda e paga no app. Petlove/Petz fazem versões disso mas viciadas no e-commerce
deles; você faz neutro, a favor da clínica independente (que odeia Petlove/Petz por competirem
com ela; use esse ressentimento a favor: "somos o anti-Petz, nós não vendemos ração por baixo de
você").

**Segunda opinião e rede entre vets:** caso complexo? Encaminhamento estruturado pra especialista
da rede com o prontuário completo junto. Comunidade clínica (tipo o fórum do Vetsmart, mas ligado
a caso real e anonimizado).

**Emergência:** botão SOS do tutor acha plantão 24h credenciado mais próximo com a ficha do pet
já enviada na frente.

**Farmácia/petshop com receita conectada:** receita digital vira pedido em farmácia veterinária
parceira com um toque. Recorrência de medicamento contínuo (renal, cardíaco) automática.

**Memorial e ciclo completo:** do filhote (protocolo neonatal) ao luto (apoio, memorial na
timeline). Ninguém trata o fim de vida com dignidade em software. Fideliza pra vida inteira e pro
próximo pet.

**Modo offline-first no balcão** (internet de clínica cai) **e onboarding por importação:**
migrador que engole export do SimplesVet/Vetsmart e planilhas. Sem migração fácil ninguém troca
de sistema. Isso é feature de guerra, trate como produto.

## Bloco 3: Modelo de negócio

SaaS por vet ativo/mês (paridade de preço ou abaixo do SimplesVet na entrada) + take rate nos
fluxos (agendamento vindo do marketplace, pagamento, farmácia) + rede credenciada (mensalidade de
credenciamento com fluxo garantido de tutores).

Freemium agressivo pra vet autônomo/domiciliar (nicho mal atendido, entra fácil, cresce com
você).

O app do tutor gratuito alimenta o funil: cada tutor que pede "minha clínica não tá no
PetJourney" é um lead B2B (e você já tem a máquina de cold email B2B do outreach + 494k CNPJs pet
coletados; conecte as duas coisas).
