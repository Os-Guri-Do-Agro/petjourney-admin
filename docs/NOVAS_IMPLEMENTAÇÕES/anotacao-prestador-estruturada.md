# Spec: Anotação do Prestador Estruturada por Tipo de Serviço

**Status:** In Review
**Autor:** Nicolas (via /spec-driven com Claude)
**Criado em:** 2026-07-28
**Última atualização:** 2026-07-29
**Versão:** 0.7
**Relacionadas:** [acesso-compartilhamento-e-parcerias/01-compartilhamento-prestador.md](acesso-compartilhamento-e-parcerias/01-compartilhamento-prestador.md), [acesso-compartilhamento-e-parcerias/08-prestador-com-conta.md](acesso-compartilhamento-e-parcerias/08-prestador-com-conta.md), [epicos/evolucao-registro-consulta.md](epicos/evolucao-registro-consulta.md)

---

## Visão Geral

> Quando o prestador registra o que fez no Acesso Temporário, ele preenche dois campos de texto livre (`servicoRealizado` e `texto`) e pode anexar até 3 arquivos. O vet que fez um ultrassom na Lili escreve um parágrafo, anexa o laudo, e nada disso vira dado clínico: o tutor recebe prosa. Esta spec substitui o formulário genérico por **campos direcionados ao tipo de serviço** e permite que o tutor **importe** o resultado para o prontuário como registro estruturado.

## Motivação / Contexto de Negócio

O projeto tem uma regra explícita: dado de saúde do pet é estruturado, com entidade e enums, nunca texto livre como fonte de verdade. O prontuário do tutor já cumpre isso (`Consulta` com `ConsultaExame`, `ConsultaPrescricaoItem`, `ConsultaAnexo`, `Diagnostico`). A anotação do prestador é o único ponto do fluxo de saúde que ainda viola a regra, e é justamente o ponto onde entra informação de um profissional.

Custo de não fazer: o histórico do pet fica com buracos exatamente nos eventos que mais importam (exame, consulta), e o tutor precisa redigitar à mão o que o vet já escreveu.

---

## Research Findings

**O tipo de serviço já existe e já é escolhido.** `TipoServicoPrestador` ([schema.prisma:1563](../../prisma/schema.prisma#L1563)) tem `BANHO`, `TOSA`, `CONSULTA`, `EXAME`, `HOTEL`, `OUTRO`, definido na criação do acesso. O app já sabe o contexto, apenas não o usa para adaptar o formulário.

**O destino estruturado já existe.** [schema.prisma:542-660](../../prisma/schema.prisma#L542-L660):
- `Consulta` (tipo, clinicaNome, veterinarioNome, motivo, diagnostico, prescricao, observacoes, pesoNaConsulta)
- `ConsultaExame` 1:1 (`laudoTexto`, `tipoExame`, `dataResultado`)
- `ConsultaCirurgia` 1:1
- `ConsultaPrescricaoItem[]` (nome, dose, unidade, frequencia, duracaoDias, instrucoes; opcionalmente deriva `TratamentoFixo` e `LembreteSerie`)
- `ConsultaAnexo[]` com `categoria` (`CategoriaAnexoConsulta`)

**O padrão de importação já existe e está implementado.** [compartilhamento-prestador.service.ts:266-303](../../src/compartilhamento-prestador/compartilhamento-prestador.service.ts#L266-L303): o tutor salva um anexo do prestador nos próprios documentos; o service checa `salvoNosDocumentos || documentoId` para ser idempotente, cria o `Documento` e grava o rastreio de volta no `AnexoPrestador`. **Esta spec estende esse mesmo padrão para os dados clínicos**, em vez de criar mecanismo novo.

**O que falta.** `AnotacaoPrestador` ([schema.prisma:1643](../../prisma/schema.prisma#L1643)) tem apenas `servicoRealizado: String`, `texto: String` e os anexos. Nenhum campo estruturado, nenhum vínculo com `Consulta`.

**Breaking Changes:** Nenhuma. Todos os campos novos são nullable e o formulário livre continua existindo como fallback (`OUTRO` e qualquer tipo sem preenchimento estruturado).

---

## Decisões já tomadas pelo Nicolas (2026-07-28)

- **D1: o tutor revisa e importa.** O prestador preenche estruturado, e o dado só entra no prontuário quando o tutor confirma. O acesso do prestador continua sendo temporário e o prontuário permanente continua sendo do tutor.
  **Alternativa rejeitada:** o prestador escrever direto em `Consulta`/`Diagnostico`. Daria a um acesso temporário, concedido por código de 6 dígitos, o poder de escrever permanentemente na saúde do pet.
- **D2: os seis tipos de serviço entram nesta entrega.** Não só Consulta e Exame.

- **D3: exame solicitado numa consulta vira lembrete.** Na importação, cada exame solicitado pelo vet cria um `LembreteSerie` tipo `EXAME` ([schema.prisma:1275-1286](../../prisma/schema.prisma#L1275-L1286)), para o tutor agendar. Encaixa no que já existe: `Consulta` já tem `gerouLembreteId` e o repo já deriva lembrete a partir de registro clínico (`ConsultaPrescricaoItem` deriva lembrete de dose, `PesoRegistro` deriva lembrete de pesagem).

- **D4: peso aferido pelo prestador entra no histórico.** Na importação, vira `PesoRegistro` ([schema.prisma:651](../../prisma/schema.prisma#L651)) com `petId`, `peso`, `data` e `observacoes` indicando a origem. O campo `Consulta.pesoNaConsulta` também é preenchido quando a importação for de consulta.

- **D5: serviço não clínico ganha entidade própria, `ServicoRealizado`.** Hoje `BANHO` e `TOSA` só existem como tipo de lembrete (agendamento futuro) e como categoria comercial; não há registro de serviço realizado, e `HOTEL` não existe em lugar nenhum. A entidade nova preenche essa lacuna e abre espaço para hospedagem, creche e adestramento, que já existem em `CategoriaParceiro`.
  **Alternativa rejeitada:** concluir uma `LembreteOcorrencia` para representar o serviço feito. Distorce a semântica de lembrete (que é agendamento) e não guarda os detalhes do serviço.
  **Consequência de escopo:** a `Timeline` do pet agrega hoje Consulta, Vacina, Peso, Documento e Diário ([timeline.service.ts](../../src/timeline/timeline.service.ts)). Sem adicionar `ServicoRealizado` lá, o registro existe mas não aparece no histórico. **A entrega inclui a fonte nova na timeline.**

---

## Riscos e Mitigações

| Nível | Risco | Mitigação |
|---|---|---|
| Alto | Dado clínico importado errado vira histórico permanente equivocado | A importação é sempre revisada pelo tutor (D1) e a tela mostra o que será criado antes de confirmar. Importação idempotente e rastreada, espelhando o padrão já usado nos anexos |
| Alto | Prestador mal-intencionado envia conteúdo abusivo em campo que vira prontuário | O conteúdo continua passando pela revisão do tutor. Nenhum campo novo aceita HTML; validação de tamanho por campo. Anotação já é atribuída a `parceiroId`/`autorUsuarioId` quando autenticada |
| Médio | Formulário por tipo aumenta a fricção para banho, tosa e hotel, que hoje são rápidos | Campos desses tipos são todos opcionais e curtos; o botão de salvar nunca depende deles |
| Médio | Importar duas vezes gera consulta duplicada | Rastreio `consultaId` na anotação e checagem antes de criar, igual `salvoNosDocumentos` faz hoje para anexo |
| Médio | Prestador preenche estruturado e o tutor nunca importa: dado morre na anotação | A anotação continua legível como hoje. A importação é ganho, não pré-requisito para ver a informação |
| Baixo | Tipos de exame em texto livre geram sujeira | `ConsultaExame.tipoExame` já é `String?` hoje; manter o mesmo grau de estruturação, sem inventar catálogo novo nesta spec |

---

## Requisitos Não-Funcionais

- **Segurança:** o prestador escreve apenas em `AnotacaoPrestador` e suas filhas, nunca em `Consulta`, `Pet` ou `Diagnostico`. A importação é rota do tutor, com ownership por `tutorId` via `OwnershipService`.
- **Privacidade:** anexos continuam em bucket privado com signed URL e TTL; `caminhoArquivo` nunca sai no payload.
- **Internacionalização:** todo texto novo nos 4 locales do app, en-GB explícito. Mensagens de erro novas via catálogo i18n.
- **Compatibilidade:** anotações antigas (só texto livre) continuam renderizando. App publicado hoje continua conseguindo criar anotação sem os campos novos.

---

## User Stories

- Como **vet que fez um ultrassom**, quero registrar tipo de exame, resultado e anexar o laudo em campos próprios, para não escrever tudo num parágrafo.
- Como **vet em consulta**, quero registrar diagnóstico, prescrição e solicitação de exames em campos separados, para o tutor receber informação utilizável.
- Como **tutor**, quero transformar o que o prestador registrou em consulta do meu pet com um toque, sem redigitar.
- Como **tutor**, quero continuar decidindo o que entra no prontuário do meu pet.
- Como **prestador de banho ou hotel**, quero um formulário curto, sem campos clínicos que não me dizem respeito.

---

## Campos por tipo de serviço

| Tipo | Campos estruturados | Destino na importação |
|---|---|---|
| `EXAME` | tipo de exame, resultado/laudo, data do resultado, anexo (laudo) | `Consulta` tipo EXAME + `ConsultaExame` + `ConsultaAnexo` categoria laudo |
| `CONSULTA` | motivo, diagnóstico, prescrição (itens: nome, dose, frequência, duração), exames solicitados, peso aferido, anexo (receita) | `Consulta` tipo CONSULTA + `ConsultaPrescricaoItem[]` + `ConsultaAnexo` categoria receita + `Diagnostico` |
| `BANHO` / `TOSA` | serviços realizados, produtos usados, condição de pele e pelo, comportamento | `ServicoRealizado` tipo BANHO/TOSA, campos de estética (D5) |
| `HOTEL` | entrada, saída, alimentação, comportamento, intercorrências | `ServicoRealizado` tipo HOSPEDAGEM, campos de hospedagem (D5) |
| `OUTRO` | formulário livre atual | Sem importação estruturada |

### Modelo implementado (Decisão A revisada, ver Considerações de Arquitetura)

Migrations `20260728200800_anotacao_prestador_estruturada` e `20260728214500_anotacao_prestador_estetica_hospedagem`, ambas aplicadas em dev. Três tabelas novas e quinze colunas nullable, tudo aditivo.

```prisma
// 1. AnotacaoPrestador ganha colunas nullable (nenhuma obrigatória)
motivo             String?    // CONSULTA -> Consulta.motivo
diagnostico        String?    // CONSULTA -> Consulta.diagnostico
pesoKg             Float?     // CONSULTA -> PesoRegistro + Consulta.pesoNaConsulta (D4)
tipoExame          String?    // EXAME    -> ConsultaExame.tipoExame
laudoTexto         String?    // EXAME    -> ConsultaExame.laudoTexto
dataResultado      DateTime?  // EXAME    -> ConsultaExame.dataResultado
// 2ª leva (migration 20260728214500). Nomes idênticos aos de ServicoRealizado:
// a importação é cópia 1:1. Sem estas colunas o formulário de BANHO, TOSA e
// HOTEL não teria onde persistir e a importação D5 não teria fonte.
produtos           String?    // BANHO/TOSA   -> ServicoRealizado.produtos
condicaoPele       String?    // BANHO/TOSA   -> ServicoRealizado.condicaoPele
comportamento      String?    // BANHO/TOSA/HOTEL -> ServicoRealizado.comportamento
dataEntrada        DateTime?  // HOTEL        -> ServicoRealizado.dataEntrada
dataSaida          DateTime?  // HOTEL        -> ServicoRealizado.dataSaida
alimentacao        String?    // HOTEL        -> ServicoRealizado.alimentacao
intercorrencias    String?    // HOTEL        -> ServicoRealizado.intercorrencias
consultaId         String?  @unique  // rastreio da importação clínica
servicoRealizadoId String?  @unique  // rastreio da importação não clínica
prescricaoItens    AnotacaoPrescricaoItem[]
examesSolicitados  AnotacaoExameSolicitado[]

// 2. Filha 1:N, espelha ConsultaPrescricaoItem (destino na importação)
model AnotacaoPrescricaoItem {
  id, anotacaoId (FK Cascade), nome (obrigatório),
  dose?, unidade?, frequencia?, duracaoDias? Int, instrucoes?, createdAt
  @@index([anotacaoId])
}

// 3. Filha 1:N, cada item vira um LembreteSerie tipo EXAME na importação (D3)
model AnotacaoExameSolicitado {
  id, anotacaoId (FK Cascade), nome (obrigatório), observacao?, createdAt
  @@index([anotacaoId])
}

// 4. Registro permanente de serviço não clínico no histórico do pet
enum TipoServicoRealizado { BANHO TOSA HOSPEDAGEM CRECHE ADESTRAMENTO OUTRO }

model ServicoRealizado {
  id, petId (FK Pet), tipo, data,
  prestadorNome?, profissionalNome?, observacoes?,
  // estética (BANHO/TOSA)
  produtos?, condicaoPele?, comportamento?,
  // hospedagem (HOSPEDAGEM/CRECHE)
  dataEntrada? DateTime, dataSaida? DateTime, alimentacao?, intercorrencias?,
  anotacaoId String? @unique,  // rastreio, idempotência
  createdAt, updatedAt
  @@index([petId, data])
}
```

Todos os campos novos são opcionais. Os únicos obrigatórios continuam sendo os que já eram (`servicoRealizado`, `texto`), então app publicado hoje continua criando anotação sem nada disso (AC6).

**Rastreio sem FK, de propósito.** `AnotacaoPrestador.consultaId`, `AnotacaoPrestador.servicoRealizadoId` e `ServicoRealizado.anotacaoId` são colunas soltas com `@unique`, exatamente como `AnexoPrestador.documentoId` já é hoje. Uma FK real acoplaria o registro permanente do tutor ao ciclo de vida do acesso temporário do prestador (a anotação morre por Cascade quando o compartilhamento é apagado), e a D1 diz o oposto: o prontuário é do tutor e sobrevive ao fim do acesso.
**Consequência aceita:** se o tutor apagar a `Consulta` importada, o `consultaId` fica apontando para nada e a reimportação segue bloqueada pelo rastreio. O service deve checar a existência do destino antes de tratar como já importado.

### Escrita: campos aceitos por tipo de serviço

A anotação chega por **multipart** nos dois canais (público por código e parceiro autenticado), e multipart não passa pela `ValidationPipe` global. Por isso o `AnotacaoEstruturadaDto` é executado à mão (`validateSync`) dentro de `helpers/anotacao-estruturada.helper.ts`, chamado pelo service, que é o único ponto que conhece o `tipoServico` do acesso. Mesmo padrão de `consulta/utils/tipo-payload-validation.util.ts`.

| Tipo do acesso | Campos aceitos |
|---|---|
| `CONSULTA` | `motivo`, `diagnostico`, `pesoKg`, `prescricaoItens[]`, `examesSolicitados[]` |
| `EXAME` | `tipoExame`, `laudoTexto`, `dataResultado` |
| `BANHO` / `TOSA` | `produtos`, `condicaoPele`, `comportamento` |
| `HOTEL` | `dataEntrada`, `dataSaida`, `alimentacao`, `comportamento`, `intercorrencias` |
| `OUTRO` | nenhum (só o formulário livre) |

Campo fora da lista do tipo é **rejeitado com 400**, nunca ignorado em silêncio: quem manda peso num acesso de banho está com o formulário errado, e engolir o dado esconderia o bug. Duas chaves novas no `ERROR_CATALOG`, ambas 400 e ambas com `campo` no payload para o app destacar o campo certo na tela:

- `ANOTACAO_CAMPO_TIPO_INCOMPATIVEL` (também carrega `tipoServico`)
- `ANOTACAO_CAMPO_INVALIDO` (formato, limite de tamanho, JSON malformado, chave fora do contrato)

**Formato de fio.** Escalares vão como campos de texto do multipart; `prescricaoItens` e `examesSolicitados` viajam como JSON num campo de texto, no mesmo padrão do `tiposDocumento` que já existe. Campo em branco ou só com espaço conta como **não enviado**, não como erro de tipo: assim um cliente pode mandar o formulário inteiro com os campos que não usa vazios.

**Ordem das checagens.** Tipo primeiro, formato depois, e as duas antes de qualquer upload: um 400 de campo estruturado não pode deixar binário órfão no bucket privado.

**Atomicidade.** A anotação, os anexos e as duas listas 1:N nascem num único `create` com nested create, ou seja, na mesma transação. Não existe estado intermediário com anotação sem prescrição.

**Limite dos campos livres.** `empresaNome` (200), `profissionalNome` (200), `servicoRealizado` (1000) e `texto` (10000) ganharam teto no parser do multipart (`LIMITES_CAMPOS_LIVRES`), 400 `ANOTACAO_CAMPO_INVALIDO` com `campo` e `maxLength` no payload. Antes o teto efetivo era o `fieldSize` default do busboy (~1 MB por campo), e esta feature passou a copiar esse conteúdo para o prontuário permanente (`Consulta.motivo`/`observacoes`/`clinicaNome`, `ServicoRealizado.observacoes`/`prestadorNome`), que não tem limite de coluna e volta em toda listagem de consulta e em toda página da timeline. Os números espelham os do destino, mesmo critério dos campos estruturados.

### Leitura: adição pura ao payload

Os três payloads que expõem anotação (`mapTutor`, `mapPublico` e o histórico enxuto do parceiro) ganham o mesmo bloco estruturado, sempre com o mesmo shape: anotação antiga devolve tudo `null` e as listas vazias (AC9), então o cliente não precisa de branch por versão. Nada foi removido nem renomeado.

O rastreio da importação (`importada`, `consultaId`, `servicoRealizadoId`) sai **só no payload do tutor**: o prontuário é dele e o prestador não precisa saber o que virou registro permanente. `importada` significa **destino vivo**, não "ponteiro preenchido" (Decisão E): a listagem resolve em 2 queries em lote quais `Consulta`/`ServicoRealizado` ainda existem e devolve `importada: false` com ids `null` quando o tutor apagou o registro. Devolver um `consultaId` apontando para registro apagado faria o app navegar para o vazio.

---

## Rota de importação (implementada)

`POST /tutor/compartilhamentos-prestador/:id/anotacoes/:anotacaoId/importar` (200, não 201: a segunda chamada não cria recurso novo). Body opcional `ImportarAnotacaoDto`: `data` (data do evento no prontuário) e `dataPrevistaExames`. Todo o conteúdo vem da própria anotação; o body existe só para os dois ajustes que o tutor decide na hora de confirmar.

**Autorização em dois passos.** `JwtAuthGuard` + `assertCompartilhamentoPrestadorOwnership` (dono do acesso, 403 e nunca 404) e depois `assertPetCreateAccess` (escrita no prontuário: dono ou co-tutor pleno, pet ativo, sem seleção de pets pendente). Prestador autenticado nunca é `criadoPorUsuarioId`, então cai no primeiro passo com 403 (AC8).

**Mapa por tipo do acesso** (`MAPA_IMPORTACAO` em `anotacao-importacao.service.ts`):

| Acesso | Destino |
|---|---|
| `EXAME` | `Consulta` tipo EXAME + `ConsultaExame` + anexos como `ConsultaAnexo` categoria LAUDO |
| `CONSULTA` | `Consulta` tipo CONSULTA (motivo, diagnóstico, `pesoNaConsulta`) + `ConsultaPrescricaoItem[]` + um `LembreteSerie` tipo EXAME por exame solicitado (D3) + `PesoRegistro` (D4) + anexos como `ConsultaAnexo` categoria RECEITA |
| `BANHO` / `TOSA` | `ServicoRealizado` BANHO / TOSA (cópia 1:1 dos campos de estética) |
| `HOTEL` | `ServicoRealizado` HOSPEDAGEM (cópia 1:1 dos campos de hospedagem) |
| `OUTRO` | Sem importação: 400 `ANOTACAO_IMPORTACAO_NAO_SUPORTADA` |

Detalhes que a implementação fixou:

- **Zero perda de texto.** `motivo` cai no `servicoRealizado` (o texto obrigatório do prestador) quando o campo estruturado veio vazio; `texto` vira `Consulta.observacoes` e, no serviço não clínico, entra em `observacoes` junto do `servicoRealizado`.
- **Data do evento.** Escolha do tutor > `dataResultado` (exame) ou `dataEntrada` (hospedagem) > `createdAt` da anotação.
- **Lembrete de exame solicitado.** Nasce com `origemTipoEntidade = CONSULTA`, o que exigiu relaxar `validarOrigemPolimorfica` para aceitar o par CONSULTA+EXAME. Efeito colateral desejado: lembrete com origem preenchida **não** vira evento próprio na timeline (ele aparece sob a consulta), igual ao lembrete de dose.
- **Prescrição importada não deriva `TratamentoFixo` nem lembrete de dose.** Isso é opt-in por item no fluxo do tutor e o prestador não tem esse poder (D1).
- **Idempotência com destino vivo.** Rastreio preenchido só conta se a `Consulta`/`ServicoRealizado` ainda existe; se o tutor apagou o registro, o ponteiro órfão é limpo e a reimportação volta a ser possível. **Essa regra é uma só, em `helpers/importacao-rastreio.helper.ts`**, usada pela rota de importação e pelo `importada` do payload do tutor (ver Decisão E).
- **Double-tap concorrente: bloqueio pessimista da linha** (`SELECT ... FOR UPDATE` na `AnotacaoPrestador`, dentro da transação, antes de qualquer escrita). O `@unique` do rastreio **não** fecha a corrida no caminho clínico: `AnotacaoPrestador.consultaId` é coluna da MESMA linha, então duas transações concorrentes gravam valores diferentes em sequência e o índice nunca conflita (o resultado eram duas `Consulta`, com prescrição, peso e lembretes próprios, a primeira órfã). Com o lock, a segunda transação só acorda depois do commit da primeira, relê o rastreio e devolve o mesmo no-op. O `@unique` de `ServicoRealizado.anotacaoId` (P2002) continua tratado como defesa em profundidade.
- **Transação única** para consulta + sub-registro + itens + lembretes + peso + rastreio. Anexo fica fora dela de propósito (I/O de storage nunca dentro de transação): falha de arquivo vira WARN e não desfaz o registro clínico.
- **Derivados não são recriados na reimportação (Decisão F).** `PesoRegistro` e `LembreteSerie` não têm FK para a `Consulta` e sobrevivem ao delete dela (o lembrete vira avulso com `cascadeLembrete=false`, o default). Quando o ponteiro órfão libera a reimportação, o service reaproveita o derivado equivalente em vez de criar outro: peso com o mesmo `(petId, data, peso)` e lembrete com o mesmo `(petId, tipo EXAME, titulo)` e ocorrência **pendente** na mesma `dataPrevista`. Sem isso o pet ficava com dois pontos iguais no gráfico de peso e dois lembretes idênticos do mesmo exame.
- **Texto gravado no prontuário é neutro de idioma (Decisão G).** `PesoRegistro.observacoes` recebe só o nome do prestador (era `Aferido em <empresa>`) e o `LembreteSerie` de exame nasce com `titulo` = nome do exame (era `Exame solicitado: <nome>`). O `tipo` do lembrete já diz que é exame. Dado permanente não pode nascer preso ao pt-BR: um tutor en-GB leria a frase em português para sempre, e trocar o idioma do app depois não corrige.

**Anexo é copiado, não referenciado.** O binário é baixado do bucket do prestador e regravado no bucket de consulta, exatamente como o `salvar-anexo` já faz para documento, por dois motivos concretos: o `GET /consulta/:id/anexos/:anexoId/url` assina no bucket de consulta (reaproveitar o caminho do outro bucket geraria URL para objeto inexistente), e revogar o acesso expurga do bucket todo anexo não salvo, o que apagaria o arquivo por baixo do prontuário do tutor.

**Anexo importado passa pela mesma validação clínica.** A cópia executa `validarAnexoConsulta` (whitelist de MIME + **magic bytes** + tamanho), o mesmo controle de toda outra escrita no bucket `anexos-consulta`. O canal do prestador só confere o mimetype **declarado**, então quem tem o código de 6 dígitos podia enviar binário arbitrário dizendo `image/png` e vê-lo servido de volta por signed URL de 3600s. Anexo reprovado **não é copiado** e entra na contagem de falhas.

**Cópia idempotente e reprocessável.** Cada anexo cai numa pasta própria dentro da consulta (`uploads/consulta/<consultaId>/anotacao-<anexoId>/`), então a chamada seguinte pergunta ao banco o que já foi gravado e copia só o que falta. É o caminho de recuperação quando o storage falha na primeira importação: antes, a segunda chamada parava no `jaImportado` e devolvia `anexosComFalha: 0`, escondendo a falha (e o laudo ficava fora do prontuário de forma definitiva assim que o tutor revogasse o acesso). O reprocessamento é escrita, então passa pelo `assertPetCreateAccess`; se o gate barrar (pet inativo, seleção pendente), o no-op continua respondendo e reporta os pendentes como falha, sem inventar sucesso.

**Timeline.** `ServicoRealizado` entrou como oitava fonte (`TipoTimelineEvento.SERVICO`), com `SERVICO_LIST_SELECT`/`SERVICO_DETAIL_SELECT` e mapper próprio. Título vem do tipo (Banho, Tosa, Hospedagem, Creche, Adestramento, Serviço), resumo junta prestador e profissional, e o detalhe expõe estética, hospedagem e o `anotacaoId` de origem (null = registrado pelo próprio tutor).
O detalhe usa `assertPodeLerRecursoPorId('servicoRealizado')`, o assert de **leitura** (família/delegação-aware): `assertServicoRealizadoOwnership` é gate de **mutação** e nega com 403 quando o pet está inativo ou o tutor tem seleção de pets pendente, o que tirava do tutor a leitura do próprio histórico de um item que a lista já tinha devolvido. A regra do projeto é 403 na escrita e leitura livre. `assertServicoRealizadoOwnership` continua existindo para quando houver mutação de `ServicoRealizado`.
Recurso novo, 404 novo: `SERVICO_REALIZADO_NAO_ENCONTRADO` no `ERROR_CATALOG` (4 locales, en-GB explícito), em vez da string pt-BR fixa dos 7 irmãos do mesmo switch (dívida herdada, fora do escopo desta correção).

---

## Acceptance Criteria

### Comportamentais

- [ ] **AC1** - **Given** um acesso do tipo `EXAME` **When** o prestador abre a nova anotação **Then** vê campos de tipo de exame, resultado e data, e não vê campos de prescrição.
- [ ] **AC2** - **Given** um acesso do tipo `CONSULTA` **When** o prestador preenche diagnóstico e dois itens de prescrição **Then** a anotação é salva com os itens estruturados, não concatenados em texto.
- [ ] **AC3** - **Given** um acesso do tipo `BANHO` **When** o prestador abre a anotação **Then** não vê nenhum campo clínico.
- [ ] **AC4** - **Given** uma anotação estruturada de exame **When** o tutor toca em adicionar ao prontuário **Then** é criada uma `Consulta` tipo EXAME com `ConsultaExame` preenchido e o anexo vira `ConsultaAnexo`.
- [ ] **AC5** - **Given** uma anotação já importada **When** o tutor tenta importar de novo **Then** a operação é idempotente, não duplica consulta, e a UI mostra que já foi importada.
- [ ] **AC6** - **Given** um app publicado antigo, que envia só `servicoRealizado` e `texto` **When** cria uma anotação **Then** continua funcionando, sem campo obrigatório novo.

### Observáveis

- [ ] **AC7** - `AnotacaoPrestador` guarda os dados estruturados e o rastreio da importação (`consultaId`), sem que o prestador consiga escrever em `Consulta`.
- [ ] **AC8** - A rota de importação exige JWT do tutor e valida ownership do pet; prestador autenticado que tentar chamá-la recebe 403.
- [ ] **AC9** - Anotações antigas (sem campos estruturados) continuam sendo listadas e abertas sem erro.
- [ ] **AC10** - Todo texto novo existe nos 4 locales, com en-GB explícito, e sem em-dash.

---

## Estratégia de Testes

### Unitários (backend)
- [ ] DTO por tipo: campos clínicos rejeitados em `BANHO`; aceitos em `CONSULTA`.
- [ ] Importação: cria `Consulta` + sub-registro correto por tipo; segunda chamada é no-op.
- [ ] Ownership: tutor de outro pet recebe 403; prestador recebe 403.
- [ ] Anotação legada sem campos estruturados continua serializando.

### Integração
- [x] Fluxo completo contra Postgres real: criar acesso EXAME, prestador anota estruturado com anexo, tutor importa, conferir `Consulta`, `ConsultaExame` e `ConsultaAnexo` gravados e o anexo acessível por signed URL.
  `npm run script:smoke-importacao-anotacao` (Postgres de dev, 43 checagens, inclui o double-tap **concorrente de verdade** e a reimportação após ponteiro órfão) e `npm run script:smoke-importacao-anexo` (Postgres + **Supabase Storage de dev**, 15 checagens: PDF copiado e baixado por signed URL byte a byte, binário que mente o mimetype recusado, idempotência por anexo e reprocessamento).
  O smoke da concorrência é o teste de regressão do lock: sem o `SELECT ... FOR UPDATE` ele reprova com 2 consultas, 2 pesos e 2 lembretes.

### Manuais
- [ ] Percorrer os 6 tipos no app e conferir que cada formulário mostra só o que faz sentido.
- [ ] Importar uma consulta com 2 itens de prescrição e conferir que viram `ConsultaPrescricaoItem`.

---

## Arquivos Impactados (estimativa)

| Arquivo | Ação |
|---|---|
| `prisma/schema.prisma` | Feito. 15 colunas nullable em `AnotacaoPrestador` + `AnotacaoPrescricaoItem` + `AnotacaoExameSolicitado` + `ServicoRealizado` + enum `TipoServicoRealizado` |
| `prisma/migrations/20260728200800_anotacao_prestador_estruturada` | Feito. Aditiva, tudo nullable, aplicada em dev |
| `prisma/migrations/20260728214500_anotacao_prestador_estetica_hospedagem` | Feito. Aditiva, 7 colunas de estética e hospedagem, aplicada em dev |
| `src/timeline/timeline.service.ts` | `ServicoRealizado` como fonte nova da timeline (D5) |
| `src/compartilhamento-prestador/dto/anotacao-estruturada.dto.ts` | Feito. DTO da anotação + mapa de campos aceitos por tipo |
| `src/compartilhamento-prestador/helpers/anotacao-estruturada.helper.ts` | Feito. Validação por tipo, normalização e bloco estruturado da leitura |
| `src/compartilhamento-prestador/helpers/importacao-rastreio.helper.ts` | Feito (v0.7). Regra única de "já está no prontuário" (destino vivo), usada pela leitura do tutor e pela rota de importação |
| `src/auth/services/ownership.service.ts` | Feito. `assertServicoRealizadoOwnership` (mutação) + `servicoRealizado` no `assertPodeLerRecursoPorId` (leitura, v0.7) |
| `scripts/smoke-importacao-anotacao.ts` / `scripts/smoke-importacao-anexo.ts` | Feito (v0.7). Postgres real; o de anexo também usa o Supabase Storage real |
| `src/compartilhamento-prestador/anotacao-multipart.util.ts` | Feito. Coleta dos campos estruturados do multipart (listas como JSON) |
| `src/compartilhamento-prestador/compartilhamento-prestador.service.ts` | Feito (persistência estruturada + leitura). Rota de importação à parte |
| `src/compartilhamento-prestador/*.controller.ts` | Rota de importação (tutor, JWT + ownership) |
| `petjourney-app/app/(fullscreen)/compartilhamento-prestador/detalhe.tsx` | Feito. Leitura estruturada + ação de importar com prévia e estado pós-importação |
| `petjourney-app/src/features/compartilhamento-prestador/importacao.ts` | Feito. Helper puro da prévia (espelha o `MAPA_IMPORTACAO`) |
| `petjourney-app/src/features/compartilhamento-prestador/{types,service,hooks,components,format}.ts(x)` | Feito. Bloco estruturado no tipo/normalizador, rota de importação no service, ação no hook, `AnotacaoEstruturada` + `ImportarAnotacaoSheet` |
| `petjourney-app/src/locales/*.json` | 4 locales |

---

## Considerações de Arquitetura

- **Decisão A (revisada em 2026-07-28, v0.3): colunas nullable na tabela principal, filhas só onde há cardinalidade 1:N.**
  A versão 0.2 previa seis sub-registros 1:1 por tipo (`AnotacaoConsulta`, `AnotacaoExame`, `ServicoEstetica`, `ServicoHospedagem`...). A implementação usa **três tabelas novas** em vez de seis: `AnotacaoPrescricaoItem` e `AnotacaoExameSolicitado` (que são genuinamente 1:N e por isso precisam de tabela) e `ServicoRealizado` com os campos de estética e hospedagem inline.
  **Motivo:** o dado fica igualmente estruturado, com o mesmo grau de tipagem forte, e a superfície cai pela metade. Um sub-registro 1:1 só se paga quando o bloco cresce ou tem ciclo de vida próprio, que é o caso de `ConsultaExame`/`ConsultaCirurgia` (preenchidos dias depois via PATCH) e não o caso de três campos de texto de banho preenchidos junto com o resto.
  **Alternativa rejeitada:** um campo JSON `dadosEstruturados`. Flexível, mas sem tipo, sem validação no banco e contraria a regra de dado de saúde estruturado.
  **Alternativa rejeitada:** manter os seis sub-registros 1:1 da v0.2. Seis tabelas, seis migrations de manutenção e seis joins para ler uma anotação, sem nenhum ganho de integridade em relação a colunas nullable na mesma linha.

- **Decisão B: a importação espelha o fluxo de anexo já existente.**
  **Motivo:** `salvoNosDocumentos` + `documentoId` já resolvem idempotência e rastreio para arquivo. Repetir a forma reduz superfície nova e código a manter.
  **Desvio consciente:** o anexo devolve 409 `ANEXO_JA_SALVO` na segunda chamada; a importação devolve **200 com `jaImportado: true`** e o registro existente. Salvar anexo duas vezes é engano do usuário (duplicaria documento); reimportar é retry inofensivo do app, e um erro ali só faria a tela mentir sobre um estado que já é o desejado.

- **Decisão C: a importação vive em service próprio (`AnotacaoImportacaoService`), não dentro do `CompartilhamentoPrestadorService`.**
  **Motivo:** o service de compartilhamento é sobre o acesso temporário; a importação escreve em quatro tabelas de prontuário que nada têm a ver com ele (`Consulta`, `ConsultaPrescricaoItem`, `LembreteSerie`, `PesoRegistro`). Misturar deixaria um arquivo de 900 linhas com duas responsabilidades e dois conjuntos de dependências.

- **Decisão E (2026-07-29): "importada" é uma regra só, com destino vivo, compartilhada pelos dois caminhos.**
  O rastreio não tem FK de propósito, então o ponteiro pode ficar órfão. Havia duas leituras discordantes: a listagem do tutor derivava `importada` só de "ponteiro preenchido" e a rota de importação tratava órfão como não importado. O card dizia "já no prontuário" para sempre, sem CTA, e o auto-heal ficava inalcançável pela UI (só roda dentro de `importar()`, rota que o app não chamava mais).
  **Motivo da forma escolhida:** helper puro (`helpers/importacao-rastreio.helper.ts`) + resolução em lote na leitura (2 queries por listagem, independentemente do número de anotações). O auto-heal (limpar a coluna) continua só no caminho de escrita: GET não escreve.

- **Decisão F (2026-07-29): reimportação reaproveita o derivado equivalente em vez de rastreá-lo.**
  **Alternativa rejeitada:** colunas novas de rastreio para `PesoRegistro` e `LembreteSerie` na `AnotacaoPrestador`. Exigiria migration e ainda deixaria o caso do tutor que apagou só o derivado. A chave natural (mesmo pet + mesma data + mesmo valor; mesmo pet + mesmo exame + mesma data prevista pendente) já identifica "o mesmo fato" e não recria nada.
  **Consequência aceita:** um pedido legítimo do mesmo exame, para o mesmo pet e com a mesma data prevista pendente, é tratado como o mesmo lembrete. É o desfecho desejado (não existem dois pedidos idênticos).

- **Decisão D: `ServicoRealizado` entra na timeline como fonte de 1a classe, não como lembrete concluído.**
  **Motivo:** ele já tem `data` própria e ordena como Consulta/Peso/Diário, sem filtro extra. A alternativa (representar serviço feito como `LembreteOcorrencia` concluída) foi rejeitada na D5 por distorcer a semântica de lembrete.

---

## Plano de Rollout

- [ ] Migration aditiva primeiro (nullable, sem efeito para quem não usa).
- [ ] Backend com os campos aceitos e a rota de importação.
- [ ] App: formulário por tipo e card de importação.
- [ ] Anotações antigas seguem funcionando durante toda a transição.

## Plano de Rollback

- Campos e tabelas novas são aditivos e nullable: reverter código não exige reverter schema.
- Consultas já importadas pelo tutor são registros normais do prontuário e **permanecem** (são dele). Rollback não as remove.

---

## Definition of Done

- [ ] AC1 a AC10 verificados.
- [ ] Testes da Estratégia implementados e passando.
- [ ] `npx tsc --noEmit` e lint limpos nos dois repos.
- [ ] `/code-review` e agente `security-auditor` rodados (a spec toca rota, ownership e dado de saúde).
- [ ] Fluxo exercitado ponta a ponta em pelo menos um tipo clínico.
- [ ] Spec com status `Concluído` + Change Log; `/spec-sync` rodado.

## Pendências conhecidas fora do backend (registradas em 2026-07-29)

Estas NÃO foram corrigidas na v0.7 (que é backend) e bloqueiam marcar os AC correspondentes como verificados:

- **App, timeline (bloqueante).** O backend passou a devolver o 8o tipo de evento (`SERVICO`) e o app não foi atualizado: `TIMELINE_EVENT_META` (`src/features/timeline/colors.ts`) só tem os 7 tipos antigos e `getEventoMeta` não tem fallback, então o card do serviço importado quebra a tela inteira da timeline com o filtro padrão. Faltam também o chip em `TIMELINE_FILTER_TIPOS` e a chave `timeline.eventTypes.SERVICO` nos 4 locales.
- **Web, canal público do prestador (AC1/AC3).** `petjourney-web` (`AnotacaoForm.tsx` + `service/prestador/prestador-service.ts`) continua mandando só os campos livres. O backend aceita `estruturado` nos dois canais, mas o vet sem conta, que é o caso mais comum do acesso por código, segue vendo o formulário antigo. AC1 e AC3 valem hoje só para o canal do parceiro autenticado.

## Perguntas em Aberto

- [x] ~~Exames solicitados na consulta~~ **RESOLVIDO (D3):** viram `LembreteSerie` tipo `EXAME`.
- [x] ~~Peso aferido pelo prestador~~ **RESOLVIDO (D4):** entra no histórico como `PesoRegistro`.
- [x] ~~Banho, tosa e hotel~~ **RESOLVIDO (D5):** entidade `ServicoRealizado` com sub-registros por tipo, mais a fonte nova na timeline.

- [ ] **`ServicoRealizado` criado direto pelo tutor?** A entidade nasce para receber importação do prestador, mas nada impede o tutor querer registrar um banho que ele mesmo levou. Entra nesta onda (CRUD completo) ou só a importação? Responsável: Nicolas.

## Change Log

| Data | Versão | Mudança | Autor |
|---|---|---|---|
| 2026-07-29 | 0.7 | **Correções do review adversarial (backend).** (1) **Corrida do double-tap fechada de verdade**: `SELECT ... FOR UPDATE` na linha da anotação dentro da transação, nos dois caminhos. O `@unique` de `AnotacaoPrestador.consultaId` nunca conflitava (coluna da mesma linha), então duas confirmações simultâneas criavam duas `Consulta` com peso, prescrição e lembretes próprios; o `catch` de P2002 era código morto no caminho clínico e o teste que "cobria" o caso injetava P2002 por mock. Regressão coberta por teste de concorrência real (unit com mutex por linha) e pelo smoke contra Postgres. (2) **Anexo importado passa por `validarAnexoConsulta`** (whitelist + magic bytes + tamanho): binário arbitrário declarando `image/png` não entra mais no bucket clínico. (3) **Cópia idempotente por anexo + reprocessamento**: pasta `anotacao-<anexoId>` dentro da consulta; a segunda chamada copia o que faltou em vez de devolver `anexosComFalha: 0`. (4) **`importada` unificada** com a regra da importação (destino vivo), em helper único: ponteiro órfão volta a ser importável em vez de travar o card em "já no prontuário". (5) **Derivados não duplicam na reimportação** (`PesoRegistro` e `LembreteSerie`, Decisão F). (6) **Detalhe SERVICO da timeline usa o assert de LEITURA**: pet inativo e seleção de pets pendente não bloqueiam mais ler o próprio histórico. (7) **Sem string pt-BR fixa**: `SERVICO_REALIZADO_NAO_ENCONTRADO` no catálogo (4 locales) e dado permanente gravado neutro (peso guarda só a origem, lembrete só o nome do exame). (8) **Limite nos 4 campos livres** (antes o teto era o ~1 MB do busboy). Verificado com 108 suites / 1403 testes verdes, `tsc --noEmit` limpo, `smoke-importacao-anotacao` (43 checagens, Postgres real) e o novo `smoke-importacao-anexo` (15 checagens, Postgres + Supabase Storage reais). | Nicolas/Claude |
| 2026-07-28 | 0.6 | **App, tela do tutor** (`app/(fullscreen)/compartilhamento-prestador/detalhe.tsx`): a anotação passou a renderizar o bloco estruturado por tipo do acesso (`AnotacaoEstruturada`), com prescrição e exames solicitados em lista; anotação legada continua renderizando só o texto livre (AC9). Ação de importar com prévia obrigatória num sheet (`ImportarAnotacaoSheet` + helper puro `resumoImportacao`, que espelha o `MAPA_IMPORTACAO` do backend): o tutor vê "1 consulta, 2 medicamentos, 1 lembrete de exame, 1 registro de peso" antes de confirmar. Pós-importação o card vira "já adicionado ao prontuário" (badge não clicável, sem convite a duplicar), e a resposta da rota já atualiza o cache sem segunda chamada. Erro vira Toast com a mensagem do backend (nunca `Alert.alert`), e os 3 hooks de cache do pet caem no sucesso. 4 locales com en-GB explícito. **Ajuste de contrato observado:** o `HttpExceptionFilter` remove `errorKey` do payload, então o app usa `message` (já resolvida por `Accept-Language`) com fallback por status. Verificado com harness ponta a ponta rodando o service real do app contra API + Postgres de dev (30 checagens: leitura, prévia, importação, idempotência, legado, 400 de OUTRO, 403 de outro tutor). | Nicolas/Claude |
| 2026-07-28 | 0.5 | Rota de importação e timeline implementadas. `POST /tutor/compartilhamentos-prestador/:id/anotacoes/:anotacaoId/importar` em `AnotacaoImportacaoService` (Decisão C): mapa por tipo do acesso, transação única, idempotência com checagem de destino vivo, anexo copiado para o bucket de consulta fora da transação. `validarOrigemPolimorfica` passou a aceitar CONSULTA+EXAME (D3). `ServicoRealizado` virou a oitava fonte da timeline (Decisão D) com mapper próprio e `assertServicoRealizadoOwnership`. Duas chaves novas no `ERROR_CATALOG` (`ANOTACAO_IMPORTACAO_NAO_SUPORTADA`, `ANOTACAO_IMPORTACAO_PET_INDISPONIVEL`), 4 locales com en-GB explícito. Verificado com 22 testes unitários novos e smoke contra o Postgres de dev (`npm run script:smoke-importacao-anotacao`, 32 checagens). | Nicolas/Claude |
| 2026-07-28 | 0.4 | Persistência da anotação estruturada implementada no backend: `AnotacaoEstruturadaDto` + validação por tipo de serviço (`helpers/anotacao-estruturada.helper.ts`), escrita atômica das duas listas 1:N junto com a anotação, e o bloco estruturado adicionado aos três payloads de leitura. Duas chaves novas no `ERROR_CATALOG` (`ANOTACAO_CAMPO_TIPO_INCOMPATIVEL`, `ANOTACAO_CAMPO_INVALIDO`), 4 locales com en-GB explícito. **Complemento de schema:** a v0.3 deixou os campos de estética e hospedagem só em `ServicoRealizado`, e sem eles em `AnotacaoPrestador` o formulário de BANHO, TOSA e HOTEL não teria onde persistir nem a importação D5 teria fonte; migration aditiva `20260728214500_anotacao_prestador_estetica_hospedagem` cobre as 7 colunas nullable, aplicada em dev. | Nicolas/Claude |
| 2026-07-28 | 0.3 | Decisão A revisada: 3 tabelas novas em vez de 6 sub-registros 1:1 (campos de estética e hospedagem inline em `ServicoRealizado`; filhas só para o que é 1:N). Rastreio de importação (`consultaId`, `servicoRealizadoId`, `anotacaoId`) fica sem FK de propósito, espelhando `AnexoPrestador.documentoId`. Schema e migration `20260728200800_anotacao_prestador_estruturada` implementados e aplicados em dev. | Nicolas/Claude |
| 2026-07-28 | 0.2 | D3 (exame solicitado vira lembrete), D4 (peso vira PesoRegistro) e D5 (entidade ServicoRealizado com sub-registros, mais fonte nova na timeline). Levantamento mostrou que BANHO e TOSA so existiam como tipo de lembrete e categoria comercial, nunca como servico realizado. | Nicolas/Claude |
| 2026-07-28 | 0.1 | Criação após research. Achados: o tipo de serviço e o destino estruturado já existem; o padrão de importação idempotente já está implementado para anexos e será estendido. D1 (tutor revisa e importa) e D2 (seis tipos) decididos pelo Nicolas. | Nicolas/Claude |
