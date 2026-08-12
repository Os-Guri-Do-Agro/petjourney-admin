# Spec: Parte 11 - Prontuario no Acesso Temporario (Diario e Documentos)

**Status:** In Review
**Autor:** Nicolas (via /spec-driven com Claude)
**Criado em:** 2026-08-05
**Ultima atualizacao:** 2026-08-05
**Versao:** 0.1
**Epico:** [acesso-compartilhamento-e-parcerias](../../../../epicos/acesso-compartilhamento-e-parcerias.md)
**Depende de:** [01-compartilhamento-prestador.md](01-compartilhamento-prestador.md) (Concluido, em prod)
**Habilita:** [12-ficha-de-encaminhamento.md](12-ficha-de-encaminhamento.md), [13-handoff-do-acesso.md](13-handoff-do-acesso.md)

---

## Visao Geral

Adicionar duas categorias compartilhaveis ao acesso temporario: **`DIARIO`** (resumo dos dias em que o pet teve sintoma ou doenca registrada, com data, evidencia e foto) e **`DOCUMENTOS`** (exames e receitas escolhidos um a um pelo tutor). Os binarios dessas categorias sao **copiados para um cofre privado por acesso** e servidos so por URL assinada escopada pelo codigo, de modo que expirar o acesso realmente corte o arquivo.

## Motivacao / Contexto de Negocio

Hoje o prestador recebe um cartao de identidade do pet, nao um encaminhamento. As sete categorias existentes ([schema.prisma:1577](../../../../../../prisma/schema.prisma#L1577)) respondem "quem e esse pet". Nenhuma responde "o que esta acontecendo com ele".

O dado que mais importa clinicamente e o que menos sai do servidor:

- O `DiarioPet` guarda 21 sintomas, 13 doencas, vitalidade, fezes, urina, texto livre e ate 6 fotos por dia. Do compartilhamento sai **somente `temperamento` da ultima entrada** ([montar-snapshot.helper.ts:111-114](../../../../../../src/compartilhamento-prestador/helpers/montar-snapshot.helper.ts#L111-L114)).
- Documentos (exame, receita, laudo) **nao tem categoria nenhuma**. O tutor que quer mostrar o ultimo hemograma sai do PetJourney e manda foto por WhatsApp.

Custo de nao fazer: o produto vende "compartilhamento com veterinario" e entrega uma ficha cadastral. O tutor continua sendo o transportador manual do proprio prontuario, que e exatamente o problema que o app existe para resolver. Alem disso, sem esta parte as Partes 12 e 13 nao tem materia-prima.

Metrica: percentual de acessos criados com `DIARIO` ou `DOCUMENTOS` marcados; numero de arquivos abertos pelo prestador por acesso.

---

## Research Findings (ancoras verificadas em 2026-08-05)

**Stack:** NestJS 11 (Fastify) + Prisma 7 + Postgres 16 + Supabase Storage. Sem dependencia nova.

### O que ja existe e vai ser reusado

| Peca | Estado | Ancora |
|---|---|---|
| Snapshot congelado filtrado por categoria | Funcao pura testavel, servidor nunca grava categoria nao selecionada | [montar-snapshot.helper.ts:59-129](../../../../../../src/compartilhamento-prestador/helpers/montar-snapshot.helper.ts#L59-L129) |
| Cofre privado + URL assinada por codigo | `ANEXOS_BUCKET` (privado) + `createSignedUrl` + rota publica escopada pelo codigo | [compartilhamento-prestador.service.ts:30](../../../../../../src/compartilhamento-prestador/compartilhamento-prestador.service.ts#L30), [:354-359](../../../../../../src/compartilhamento-prestador/compartilhamento-prestador.service.ts#L354-L359) |
| Upload em bucket nomeado | `UploadFile.uploadFile(file, pathFolder, pathName, bucket)` aceita bucket como 4o argumento | [uploadFile.service.ts:18-40](../../../../../../src/upload/uploadFile.service.ts#L18-L40) |
| Download do bucket privado | Metodo `download` ja adicionado pela Parte 1 para o fluxo de salvar anexo | [uploadFile.service.ts](../../../../../../src/upload/uploadFile.service.ts) |
| Erro i18n | `LocalizedException` + `ERROR_CATALOG` com 4 locales e en-GB explicito | [error-catalog.ts:12-40](../../../../../../src/common/errors/error-catalog.ts#L12-L40) |
| Label i18n de enum | `ESPECIE_LABELS` e o molde: constante estatica, en-GB explicito por entrada | [especie.labels.ts:12-25](../../../../../../src/common/i18n/especie.labels.ts#L12-L25) |
| Ownership | `assertPetOwnership` e `assertCompartilhamentoPrestadorOwnership` | [ownership.service.ts:46-59](../../../../../../src/auth/services/ownership.service.ts#L46-L59) |
| Lazy expire | Toda leitura passa por `expirarVencidos()` antes | [compartilhamento-prestador.service.ts:386](../../../../../../src/compartilhamento-prestador/compartilhamento-prestador.service.ts#L386) |

### Achado critico 1: os binarios do prontuario moram em bucket PUBLICO

`DocumentoArquivo` e `DiarioPetFoto` sao gravados via `uploadFilePets`, que **hardcoda** `bucket = 'bucketFotos'` e persiste a **URL publica** no banco:

- Documentos: [documents.service.ts:342](../../../../../../src/documents/documents.service.ts#L342)
- Fotos do diario: [diario-pet.service.ts:267](../../../../../../src/diario-pet/diario-pet.service.ts#L267)
- Bucket hardcoded e publico por design: [uploadFilePets.service.ts:16](../../../../../../src/upload/uploadFilePets.service.ts#L16)

Consequencia direta: **referenciar esses arquivos no compartilhamento entregaria uma URL permanente**. O acesso expiraria em 48h e o exame continuaria aberto para sempre para quem tivesse o endereco. Gerar `createSignedUrl` sobre um bucket publico e teatro de seguranca: a URL publica original continua valida em paralelo.

Isso e divida pre-existente, ja registrada no repo como `TODO(security-4)` em [public-pet.controller.ts:189](../../../../../../src/public-pet/public-pet.controller.ts#L189), onde a carteirinha publica hoje devolve a URL crua do documento. Esta spec **nao** conserta a divida (blast radius: todo upload do app), mas **nao pode herda-la**. Ver D11.2.

### Achado critico 2: os labels do diario existem so em pt-BR

`GET /diario-pet/enums` serve `EnumOption { value, label }` com `label` em portugues, pre-computado ([diario-pet.enums.ts:24-40](../../../../../../src/diario-pet/diario-pet.enums.ts#L24-L40)). Nao existe traducao de `SintomaPet`, `DoencaDiario`, `VitalidadePet`, `AspectoFezes`, `EstadoUrina` nem `ConsumoDiario`.

O prestador que abre o link nao e necessariamente lusofono (o produto opera em UAE, UK, Israel e Servia, ver `preco-internacional-planos.md`). Mandar `SECRECAO_OCULAR` cru ou o label pt-BR fixo quebra a regra travada de en-GB explicito. Precisa de catalogo i18n proprio (T2).

### Achado critico 3: `Documents.tipo` e String livre

[schema.prisma:826](../../../../../../prisma/schema.prisma#L826) declara `tipo String`, sem enum. Nao existe `TipoDocumento` no schema. Logo **nao da para filtrar documentos por tipo de forma confiavel** ("todos os exames") e a selecao explicita pelo tutor deixa de ser so a opcao mais segura: e a unica implementavel sem inventar taxonomia. Confirma a D11.1.

### Consumidores

- **`petjourney-app`**: `src/features/compartilhamento-prestador/` (tela pronta, integrada). Ganha dois chips de categoria novos, um seletor de documentos e o bloco de diario no detalhe. Nao quebra: categorias novas so aparecem se marcadas.
- **`petjourney-web`** (pagina publica do prestador, `PRESTADOR_BASE_URL`): renderiza os blocos novos. Sem eles, ignora chaves desconhecidas.
- **`petjourney-cms`**: nao consome este modulo.

**Breaking Changes:** Nenhuma. Dois valores novos no enum `CategoriaInfoCompartilhada` (aditivo), uma tabela nova, colunas novas nullable, rota nova. Payloads existentes ganham chaves adicionais; nenhuma chave muda de forma ou some.

---

## Decisoes desta parte

### D11.1 - Documento entra por selecao explicita, item a item
O tutor marca a categoria `DOCUMENTOS` **e** escolhe quais documentos entram (`documentoIds[]` no request). Categoria sem selecao e 400.

**Motivo:** exame veterinario costuma trazer nome completo, CPF, endereco e telefone do tutor no cabecalho. As outras sete categorias sao dados do pet; documento e o unico que carrega PII do humano. "Marcou, mandou tudo" entregaria a pasta inteira a um hotel de pet. Alem disso `Documents.tipo` e String livre (Achado 3), entao filtro automatico por tipo seria fragil.

**Alternativa rejeitada:** categoria filtrada por tipo (fragil, ver Achado 3) e categoria = todos os documentos (consistente com o modelo atual, e o mais arriscado dos tres). Decisao do Nicolas em 2026-08-05.

### D11.2 - Cofre por acesso: binario e COPIADO para bucket privado, nunca referenciado
Ao criar (ou atualizar) um acesso com `DIARIO` ou `DOCUMENTOS`, o backend **copia** os binarios selecionados de `bucketFotos` para `ANEXOS_BUCKET` (privado) sob o prefixo do codigo do acesso, registra cada copia em `ArquivoCompartilhado` e serve **exclusivamente** por URL assinada gerada on-demand na rota escopada pelo codigo. A URL publica de origem nunca aparece em nenhum payload desta feature.

**Motivo:** e o unico desenho em que "o acesso expira" vale tambem para o arquivo. Reusa integralmente o padrao que a Parte 1 ja implementou para anexo do prestador (bucket privado + `createSignedUrl` + rota por codigo). Como bonus, congela o arquivo de verdade: trocar o PDF do documento depois nao altera o que o vet recebeu, coerente com o pilar do snapshot congelado.

**Alternativa rejeitada:** referenciar `DocumentoArquivo.url` (barato, mas entrega URL publica permanente e faz a expiracao virar ficcao) e migrar `bucketFotos` para privado agora (conserta a raiz, mas o blast radius e todo upload do app: pet, usuario, documento, diario, artigo, ebook; vira spec propria, ver Follow-up).

**Custo aceito:** storage duplicado durante a vida do acesso. Contido por cap de arquivos e de bytes (Regra 4) e por limpeza no encerramento (T9).

### D11.3 - Congela, com atualizacao explicita do tutor
O resumo do diario e a copia dos arquivos sao congelados na criacao. O tutor pode chamar `POST :id/atualizar-resumo` num acesso **ATIVO** para regerar o snapshot e o cofre com o estado atual, gravando `snapshotAtualizadoEm`.

**Motivo:** mantem o pilar da foto congelada e o consentimento por instante, e ainda cobre o caso real do hotel onde o pet piora no meio da estadia. Atualizar e ato deliberado do tutor, nao efeito colateral.

**Alternativa rejeitada:** janela viva (clinicamente melhor, mas o consentimento deixaria de ser por instante e o prestador passaria a ler dado que o tutor nao revisou) e congelar sem escapatoria (simples, mas deixa o vet lendo dado velho justamente quando o quadro muda). Decisao do Nicolas em 2026-08-05.

**Escopo do que atualiza:** somente **conteudo**. Categorias e `documentoIds` selecionados **nao** mudam, porque sao o consentimento. Mudar o que e compartilhado exige acesso novo.

### D11.4 - So entra dia que teve sintoma ou doenca
O resumo do diario inclui apenas entradas com `sintomas` nao vazio **ou** `doencas` nao vazio, nos ultimos 30 dias, no maximo 15 entradas, mais recentes primeiro.

**Motivo:** o valor clinico esta na anormalidade. Mandar 30 dias de "tudo normal" enterra o sinal em ruido e multiplica o volume de dado pessoal exposto sem ganho. Dia normal nao e informacao para o prestador; e vigilancia.

### D11.5 - `nota` fica de fora
Da entrada selecionada saem os campos clinicos (vitalidade, alimentacao, hidratacao, fezes, urina, ciclo de cio, sintomas, doencas, os respectivos `*Outro(s)`) mais `observacoes` ("Sintomas extras, graus de febre", [create-diario-pet.dto.ts:159-163](../../../../../../src/diario-pet/dto/create-diario-pet.dto.ts#L159-L163)) e `remedios` ("Remedios administrados nesse momento", [:165-169](../../../../../../src/diario-pet/dto/create-diario-pet.dto.ts#L165-L169)). O campo `nota` ("Mais algum detalhe?", [:171-175](../../../../../../src/diario-pet/dto/create-diario-pet.dto.ts#L171-L175)) **nao** sai.

**Motivo:** `observacoes` e `remedios` tem semantica clinica declarada no proprio contrato. `nota` e caixa livre sem semantica, onde o tutor escreve o que quiser, inclusive coisa que nao imagina estar compartilhando. Menos dado exposto por default. Ver Perguntas em Aberto 1.

### D11.6 - Sem gating de plano
Consistente com a decisao travada do epico para a Parte 1: qualquer tutor cria acesso e marca qualquer categoria ([acesso-compartilhamento-e-parcerias.md:134](../../../../epicos/acesso-compartilhamento-e-parcerias.md#L134)).

---

## Modelo de Dados

Aditivo puro. Zero alteracao destrutiva.

### Enum estendido

```prisma
enum CategoriaInfoCompartilhada {
  ALERGIAS
  VACINAS
  MEDICAMENTOS
  PESO
  COMPORTAMENTO
  DIAGNOSTICOS
  OBSERVACOES
  DIARIO       // Parte 11
  DOCUMENTOS   // Parte 11
}
```

> **Atencao na migration:** Postgres executa `ALTER TYPE ... ADD VALUE` fora de bloco transacional e o valor novo **nao pode ser usado na mesma transacao** que o adiciona. A migration precisa ser **so o `ALTER TYPE`**, separada de qualquer `INSERT`/`UPDATE` que use os valores novos. Ver T1 e Riscos.

### Model ArquivoCompartilhado (novo)

```prisma
/// Copia privada de um binario do prontuario, feita no momento em que o acesso
/// foi criado ou atualizado. Fonte de verdade do que o prestador pode abrir.
/// O arquivo vive no bucket PRIVADO (ANEXOS_BUCKET), sob o prefixo do codigo.
/// A URL publica de origem NUNCA e exposta (D11.2).
/// Spec: docs/specs/2026/q2/q2-3/acesso-compartilhamento-e-parcerias/11-prontuario-no-acesso-temporario.md
model ArquivoCompartilhado {
  id                 String                    @id @default(cuid())
  compartilhamentoId String
  compartilhamento   CompartilhamentoPrestador @relation(fields: [compartilhamentoId], references: [id], onDelete: Cascade)
  /// DOCUMENTO ou DIARIO_FOTO. Define em que bloco do snapshot o arquivo aparece.
  origem             OrigemArquivoCompartilhado
  /// Id da entidade de origem (Documents.id ou DiarioPet.id). Sem FK: o acesso
  /// e uma copia congelada e nao pode quebrar nem sumir se o tutor apagar a
  /// origem depois. Serve so para agrupar o arquivo no bloco certo.
  origemId           String
  /// Ordem dentro do documento ou da entrada do diario (espelha DocumentoArquivo.ordem).
  ordem              Int                       @default(0)
  nome               String
  mimeType           String
  tamanhoBytes       Int
  /// Caminho no bucket privado. Nunca exposto ao cliente; so alimenta a URL assinada.
  caminhoArquivo     String
  createdAt          DateTime                  @default(now())

  @@index([compartilhamentoId, origem])
  @@index([compartilhamentoId, origemId])
}

enum OrigemArquivoCompartilhado {
  DOCUMENTO
  DIARIO_FOTO
}
```

### Colunas novas em CompartilhamentoPrestador

```prisma
  /// Documentos que o tutor escolheu expor (D11.1). Vazio quando DOCUMENTOS nao
  /// esta em `categorias`. Guardado como lista de ids para auditoria e para o
  /// atualizar-resumo saber o que recopiar; o conteudo legivel vive no snapshot.
  documentoIds          String[]
  /// Preenchido quando o tutor regera o resumo de um acesso ativo (D11.3).
  snapshotAtualizadoEm  DateTime?
  arquivos              ArquivoCompartilhado[]
```

> **Audit grep obrigatorio (T1):** a relacao reversa `arquivos` em `CompartilhamentoPrestador` e a ausencia de FK em `ArquivoCompartilhado.origemId` foram escolhidas para nao tocar `Documents` nem `DiarioPet`. Confirmar por grep que nenhuma query de `Documents`/`DiarioPet` usa `include: { _count: true }` ou serializa a entidade inteira de forma que a relacao nova apareca sem ser pedida, e registrar o resultado na task antes de declarar aditivo.

### Forma do snapshot (extensao de `SnapshotPetCompartilhado`)

```ts
export interface EntradaDiarioCompartilhada {
  /** ISO8601 da data da entrada (imutavel apos criacao no DiarioPet). */
  data: string;
  /** Labels ja localizados. O prestador nunca recebe o enum cru. */
  sintomas: string[];
  doencas: string[];
  vitalidade?: string | null;
  alimentacao?: string | null;
  hidratacao?: string | null;
  fezes?: string | null;
  urina?: string | null;
  cicloCio?: string | null;
  /** `observacoes` e `remedios` do diario. `nota` nao entra (D11.5). */
  observacoes?: string | null;
  remedios?: string | null;
  /** Ids de ArquivoCompartilhado (origem=DIARIO_FOTO). Nunca URL. */
  fotoIds: string[];
}

export interface DocumentoCompartilhado {
  /** Id de Documents na origem. Serve so como rastro; nao e endereco de leitura. */
  origemId: string;
  nome: string;
  tipo: string;
  dataEmissao?: string | null;
  dataExpiracao?: string | null;
  /** Ids de ArquivoCompartilhado (origem=DOCUMENTO), na ordem original. */
  arquivoIds: string[];
}

export interface SnapshotPetCompartilhado {
  // ... campos existentes inalterados
  diario: EntradaDiarioCompartilhada[];        // [] quando DIARIO nao selecionado
  documentos: DocumentoCompartilhado[];        // [] quando DOCUMENTOS nao selecionado
}
```

O snapshot carrega **id de arquivo, nunca URL**. Ler o binario e sempre uma chamada dedicada, no mesmo padrao que a Parte 1 adotou para anexo e que `security-4` exige ([security-4-public-endpoints-storage.md:181-183](../security-4-public-endpoints-storage.md#L181-L183)).

---

## Contrato de API

### Alteracao em `POST tutor/compartilhamentos-prestador`

Request ganha campo opcional, obrigatorio por condicao:

```jsonc
{
  "petId": "...",
  "tipoServico": "CONSULTA",
  "duracaoHoras": 48,
  "categorias": ["ALERGIAS", "DIARIO", "DOCUMENTOS"],
  "documentoIds": ["doc_1", "doc_2"],   // obrigatorio se categorias inclui DOCUMENTOS
  "mensagemTutor": "..."
}
```

### Rota nova (tutor): atualizar resumo

`POST tutor/compartilhamentos-prestador/:id/atualizar-resumo` -> 200

Regera snapshot e cofre com o estado atual do pet. So em acesso `ATIVO` e nao vencido. Devolve o detalhe atualizado (mesma forma do `GET :id`).

### Rota nova (publica): abrir arquivo

`GET prestador/acesso/:codigo/arquivos/:arquivoId/url` -> `{ signedUrl, expiresIn }`

Throttle no mesmo padrao da rota de anexo (30/min por IP, mais o balde por `:codigo`). 404 generico anti-enumeracao quando o codigo e invalido, vencido ou revogado, ou quando o `arquivoId` nao pertence aquele acesso.

### Rota nova (tutor): abrir arquivo

`GET tutor/compartilhamentos-prestador/:id/arquivos/:arquivoId/url` -> `{ signedUrl, expiresIn }`

Espelha a rota publica para o tutor conferir o que entregou. Ownership por `assertCompartilhamentoPrestadorOwnership`.

### Rota nova (parceiro): abrir arquivo

`GET parceiro/portal/compartilhamentos/:id/arquivos/:arquivoId/url` -> `{ signedUrl, expiresIn }`

Segue a Parte 8: login organiza, nunca amplia (D8.2). Mesmo payload, so o canal muda.

---

## Regras de Negocio

1. `DOCUMENTOS` em `categorias` sem `documentoIds` nao vazio e **400** (`DOCUMENTOS_SELECAO_OBRIGATORIA`). `documentoIds` com `DOCUMENTOS` ausente tambem e **400**: consentimento incoerente nao passa silenciosamente.
2. Todo id em `documentoIds` precisa pertencer ao pet do acesso. Um id de documento de outro pet ou de outro tutor e **403** via ownership, nunca 404 (nao vazar existencia).
3. Cap por acesso: **10 documentos**, **15 entradas de diario**, **3 fotos por entrada**, **30 arquivos no total** e **50 MB somados**. Estourar qualquer teto e **400** com a chave que identifica o teto atingido. Os caps existem porque cada arquivo e uma copia real no storage (D11.2).
4. A janela do diario e de **30 dias corridos** contados de `now()` na criacao (ou na atualizacao, D11.3), com no maximo 15 entradas mais recentes.
5. Categoria nao selecionada **nao sai do servidor**: `diario` e `documentos` nascem `[]` e o servidor nunca copia arquivo de categoria nao marcada. Mesma garantia da Parte 1.
6. `atualizar-resumo` so opera em `status=ATIVO` e `expiraEm > now`. Em acesso encerrado e **409** (`COMPARTILHAMENTO_JA_ENCERRADO`, chave ja existente). Limite de **10 atualizacoes por acesso**, para o endpoint nao virar canal de upload gratuito.
7. Atualizar substitui: os `ArquivoCompartilhado` antigos sao removidos do banco e do bucket na mesma operacao, e o cofre e reconstruido. Uma URL assinada emitida antes segue valida ate o TTL vencer (limitacao aceita, TTL curto).
8. Documento apagado pelo tutor depois da criacao **continua visivel** no acesso, porque o acesso carrega uma copia congelada (D11.2). Para cortar, o tutor revoga o acesso. Isso e explicito na copy do app.
9. Ao revogar, expirar ou deletar o acesso, os binarios do cofre sao apagados (T9). O registro do compartilhamento e preservado, como ja e hoje.
10. Todo label de enum do diario sai **localizado** pelo `Accept-Language` do request, com en-GB explicito, nunca por fallback.

---

## Riscos e Mitigacoes

| Nivel | Risco | Mitigacao |
|---|---|---|
| **Alto** | **Vazamento de PII do tutor via exame.** Exame e receita costumam trazer nome, CPF, endereco e telefone do humano no cabecalho, e o destinatario pode ser um hotel de pet sem obrigacao profissional de sigilo. | Selecao item a item (D11.1) com a consequencia explicita na copy do app; nunca filtro automatico por tipo; log de auditoria de cada abertura de arquivo (Observabilidade); cap de 10 documentos por acesso. O tutor decide arquivo por arquivo, com contexto na tela. |
| **Alto** | **URL publica permanente.** Referenciar `DocumentoArquivo.url` ou `DiarioPetFoto.url` entregaria endereco que sobrevive a expiracao do acesso (Achado 1). | D11.2: copia para bucket privado + URL assinada on-demand + rota escopada pelo codigo. Teste explicito (AC16) garantindo que nenhum payload da feature contem `bucketFotos` nem qualquer URL de origem. |
| **Alto** | **Migration de enum em Postgres.** `ALTER TYPE ... ADD VALUE` nao pode compartilhar transacao com uso do valor novo; migration mal montada falha em deploy e trava o release. | Migration isolada contendo somente o `ALTER TYPE` dos dois valores, gerada por `migrate diff` e aplicada por `migrate deploy` (ver [project-prisma7-migration-sem-shadow](../../../../../../CLAUDE.md)); nenhuma seed ou backfill na mesma migration; `prisma migrate status` antes e depois; validacao em dev contra Postgres real antes de subir. |
| **Medio** | **Custo e crescimento do storage.** Cada acesso copia binarios; acesso de 30 dias com 10 documentos pesados multiplica o armazenamento. | Caps da Regra 3 (30 arquivos, 50 MB por acesso); limpeza no encerramento (T9) rodando junto do `expirarVencidos` ja existente; metrica de bytes no cofre para acompanhar. |
| **Medio** | **Falha parcial na copia.** Se a copia do arquivo 7 de 10 falhar, o acesso pode nascer com cofre incompleto e o vet ve documento faltando sem saber. | Copiar **antes** de criar o compartilhamento; qualquer falha aborta a operacao inteira, limpa o que ja subiu e devolve erro. Acesso nunca nasce com cofre parcial. Mesmo principio que a Parte 1 aplica ao validar campo estruturado antes de subir binario ([compartilhamento-prestador.service.ts:382-384](../../../../../../src/compartilhamento-prestador/compartilhamento-prestador.service.ts#L382-L384)). |
| **Medio** | **Latencia na criacao.** Baixar e subir ate 30 arquivos deixa o `POST` lento e pode estourar timeout do proxy. | Copia em paralelo com concorrencia limitada; cap de 50 MB; medir p95 do endpoint (Observabilidade). Se ultrapassar o alvo, a copia vira job assincrono com estado `PREPARANDO` no acesso, registrado como Follow-up e nao implementado especulativamente agora. |
| **Baixo** | Divergencia de traducao dos enums do diario entre `GET /diario-pet/enums` (pt-BR) e o catalogo novo. | O catalogo novo passa a ser a fonte unica; `diario-pet.enums.ts` migra para consumi-lo em locale pt-BR (T2), com teste garantindo que os dois nunca divergem. |

---

## Requisitos Nao-Funcionais

- **Seguranca:** binario servido so por URL assinada com TTL, gerada on-demand em rota escopada pelo codigo do acesso. Nenhuma URL de bucket publico em nenhum payload da feature. 404 generico anti-enumeracao no canal publico; 403 no canal autenticado.
- **Privacidade e LGPD:** dado de saude do pet e PII do tutor embutida em documento. O servidor so copia e so expoe o que foi explicitamente selecionado. Categoria nao marcada nao sai do servidor. Encerrar o acesso apaga os binarios do cofre.
- **Performance:** `POST` de criacao com 10 arquivos responde abaixo de 5s em p95; leitura publica (`GET :codigo`) mantem o mesmo perfil de hoje, porque o snapshot ja vem montado e nao faz query nova.
- **Internacionalizacao:** `SintomaPet`, `DoencaDiario`, `VitalidadePet`, `AspectoFezes`, `EstadoUrina`, `ConsumoDiario` e `CicloCio` com os 4 locales e **en-GB explicito por entrada**, nunca por fallback.
- **Observabilidade:** ver secao propria.

---

## User Stories

- Como **tutor**, quero mandar pro vet os dias em que meu pet passou mal, com data e foto, para nao depender da minha memoria na consulta.
- Como **tutor**, quero escolher exatamente quais exames o prestador ve, para nao entregar documento com meu CPF a um hotel de pet.
- Como **tutor**, quero atualizar o resumo de um acesso que ja entreguei, para o hotel ver que o quadro mudou ontem.
- Como **prestador**, quero abrir o exame e a foto do sintoma direto na pagina do acesso, para nao pedir que o tutor mande por WhatsApp.
- Como **prestador**, quero ler os sintomas no meu idioma, para atender sem traduzir enum na cabeca.

---

## Acceptance Criteria

### Comportamentais

- [ ] **AC1 Given** um pet com 3 entradas de diario com sintoma nos ultimos 30 dias e 2 sem sintoma **When** o tutor cria acesso com `DIARIO` **Then** `snapshot.diario` tem exatamente 3 entradas, ordenadas por data decrescente.
- [ ] **AC2 Given** um pet com entrada de diario com sintoma ha 45 dias **When** o tutor cria acesso com `DIARIO` **Then** essa entrada nao aparece em `snapshot.diario`.
- [ ] **AC3 Given** um pet com 20 entradas com sintoma nos ultimos 30 dias **When** o tutor cria acesso com `DIARIO` **Then** `snapshot.diario` tem 15 entradas, as mais recentes.
- [ ] **AC4 Given** `categorias` inclui `DOCUMENTOS` e `documentoIds` esta vazio ou ausente **When** o tutor cria o acesso **Then** responde 400 com chave `DOCUMENTOS_SELECAO_OBRIGATORIA` e nada e persistido.
- [ ] **AC5 Given** `documentoIds` presente e `categorias` sem `DOCUMENTOS` **When** o tutor cria o acesso **Then** responde 400 e nada e persistido.
- [ ] **AC6 Given** `documentoIds` contem documento de outro pet **When** o tutor cria o acesso **Then** responde 403 e nenhum arquivo e copiado.
- [ ] **AC7 Given** um acesso criado sem `DIARIO` **When** o prestador abre `GET prestador/acesso/:codigo` **Then** `snapshot.diario` e `[]` e nenhum `ArquivoCompartilhado` com origem `DIARIO_FOTO` existe no banco para aquele acesso.
- [ ] **AC8 Given** um acesso com `DOCUMENTOS` **When** o prestador chama `GET prestador/acesso/:codigo/arquivos/:arquivoId/url` com arquivo daquele acesso **Then** responde `{ signedUrl, expiresIn }` e a URL aponta para o bucket privado.
- [ ] **AC9 Given** um `arquivoId` de outro acesso **When** o prestador pede a URL **Then** responde 404 generico, identico ao de codigo inexistente.
- [ ] **AC10 Given** um acesso `REVOGADO` **When** o prestador pede a URL de um arquivo dele **Then** responde 404 generico.
- [ ] **AC11 Given** um acesso `ATIVO` com resumo de 3 dias **When** o tutor registra um sintoma novo hoje e chama `POST :id/atualizar-resumo` **Then** `snapshot.diario` passa a ter 4 entradas e `snapshotAtualizadoEm` e preenchido.
- [ ] **AC12 Given** um acesso `EXPIRADO` **When** o tutor chama `atualizar-resumo` **Then** responde 409 com `COMPARTILHAMENTO_JA_ENCERRADO`.
- [ ] **AC13 Given** um acesso com 4 arquivos no cofre **When** o tutor chama `atualizar-resumo` e o pet agora tem 5 **Then** os 4 registros antigos sao removidos do banco e do bucket e existem exatamente 5 novos.
- [ ] **AC14 Given** `documentoIds` com 11 documentos **When** o tutor cria o acesso **Then** responde 400 informando o teto e nenhum arquivo e copiado.
- [ ] **AC15 Given** a copia do terceiro de cinco arquivos falha **When** o tutor cria o acesso **Then** responde erro, nenhum `CompartilhamentoPrestador` e criado e nenhum binario fica orfao no bucket.
- [ ] **AC16 Given** um acesso com `DIARIO` e `DOCUMENTOS` **When** o prestador abre `GET prestador/acesso/:codigo` **Then** o corpo da resposta nao contem a substring `bucketFotos` nem nenhuma URL de storage.
- [ ] **AC17 Given** `Accept-Language: en-GB` **When** o prestador abre um acesso com `DIARIO` **Then** os sintomas vem em ingles britanico vindos do catalogo, nunca do fallback en-US e nunca como enum cru.
- [ ] **AC18 Given** um acesso `ATIVO` **When** ele expira pelo lazy expire **Then** os `ArquivoCompartilhado` sao apagados do bucket e o registro do compartilhamento e preservado.
- [ ] **AC19 Given** um parceiro que reivindicou o acesso **When** ele pede a URL de um arquivo pelo portal **Then** recebe a mesma `signedUrl` que o canal publico entregaria, sem categoria extra nenhuma (D8.2).

### Observaveis

- [ ] **AC20** `CategoriaInfoCompartilhada` tem exatamente 9 valores apos a migration.
- [ ] **AC21** A migration que adiciona os valores de enum nao contem nenhum `INSERT` nem `UPDATE`.
- [ ] **AC22** `snapshot.diario[].fotoIds` e `snapshot.documentos[].arquivoIds` contem ids de `ArquivoCompartilhado`, nunca URL.
- [ ] **AC23** `snapshot.diario[]` nunca contem o campo `nota` (D11.5).
- [ ] **AC24** Todo enum do diario no catalogo i18n tem entrada explicita para `pt-BR`, `en-US`, `en-GB` e `es-ES`, verificado por teste de completude.
- [ ] **AC25** Nenhuma string do catalogo i18n do diario contem em-dash.
- [ ] **AC26** Cada abertura de arquivo emite log estruturado com `compartilhamentoId`, `arquivoId`, `canal` e origem, sem PII.

---

## Estrategia de Testes

### Unitarios

- [ ] `montar-snapshot.helper` bloco `diario`: filtra por sintoma ou doenca; respeita janela de 30 dias; corta em 15; ordena por data desc; omite `nota`; devolve `[]` sem a categoria.
- [ ] `montar-snapshot.helper` bloco `documentos`: monta so os ids selecionados; preserva a ordem dos arquivos; devolve `[]` sem a categoria.
- [ ] `CriarCompartilhamentoDto`: `DOCUMENTOS` sem `documentoIds` invalida; `documentoIds` sem `DOCUMENTOS` invalida; acima de 10 ids invalida.
- [ ] Catalogo i18n do diario: completude de locale por enum, en-GB distinto de en-US onde a grafia difere, ausencia de em-dash.
- [ ] Calculo de caps: 30 arquivos e 50 MB, com caso no limite exato e um acima.
- [ ] Service `atualizar-resumo`: rejeita status encerrado; rejeita acima de 10 atualizacoes; nao altera `categorias` nem `documentoIds`.

### Integracao (Postgres real, sem mock de banco)

- [ ] Criar acesso com `DIARIO` e `DOCUMENTOS`: `ArquivoCompartilhado` persistidos, binarios presentes no bucket privado, snapshot coerente.
- [ ] Rota publica de URL: arquivo do proprio acesso responde 200; de outro acesso responde 404; acesso revogado responde 404.
- [ ] `atualizar-resumo`: substitui cofre por completo, sem orfao no banco nem no bucket.
- [ ] Expiracao pelo lazy expire remove os binarios e preserva o registro.
- [ ] Ownership: `documentoIds` de outro tutor responde 403.
- [ ] Rollback de falha parcial: forcar erro na copia do terceiro arquivo e verificar que nao sobrou compartilhamento nem binario.

### Manuais (happy path, exercitando o fluxo real)

- [ ] Criar acesso pelo app com `DIARIO` e 2 documentos, abrir o link publico em aba anonima, conferir os dias com sintoma e abrir um exame.
- [ ] Copiar a URL assinada, esperar o TTL vencer e confirmar que deixa de abrir.
- [ ] Revogar o acesso e confirmar que a pagina publica e a URL param de funcionar.
- [ ] Repetir com `Accept-Language: en-GB` e conferir os labels.

### Regressao

- [ ] Acesso criado antes da migration (sem as categorias novas) continua abrindo e renderizando igual.
- [ ] `GET /diario-pet/enums` continua devolvendo os mesmos labels pt-BR apos a migracao para o catalogo.
- [ ] Suite do modulo `compartilhamento-prestador` inteira verde.

---

## Arquivos Impactados

| Arquivo | Acao | Descricao |
|---|---|---|
| `prisma/schema.prisma` | Modificar | 2 valores no enum, model `ArquivoCompartilhado`, enum `OrigemArquivoCompartilhado`, 2 colunas e 1 relacao em `CompartilhamentoPrestador` |
| `prisma/migrations/<ts>_categoria_diario_documentos/` | Criar | Somente `ALTER TYPE ... ADD VALUE` (isolada) |
| `prisma/migrations/<ts>_arquivo_compartilhado/` | Criar | Tabela, enum de origem, colunas e indices |
| `src/common/i18n/diario.labels.ts` | Criar | Catalogo i18n dos 7 enums do diario, 4 locales, en-GB explicito |
| `src/common/i18n/diario.labels.spec.ts` | Criar | Completude, en-GB, ausencia de em-dash |
| `src/diario-pet/diario-pet.enums.ts` | Modificar | Consumir o catalogo novo como fonte unica dos labels pt-BR |
| `src/common/errors/error-catalog.ts` | Modificar | Chaves novas de erro nos 4 locales |
| `src/compartilhamento-prestador/helpers/montar-snapshot.helper.ts` | Modificar | Blocos `diario` e `documentos` na funcao pura |
| `src/compartilhamento-prestador/helpers/cofre-arquivos.helper.ts` | Criar | Selecao, caps, copia e limpeza dos binarios |
| `src/compartilhamento-prestador/dto/criar-compartilhamento.dto.ts` | Modificar | `documentoIds` com validacao condicional |
| `src/compartilhamento-prestador/compartilhamento-prestador.service.ts` | Modificar | Include do diario e documentos, copia no criar, `atualizarResumo`, URL de arquivo, limpeza no encerrar |
| `src/compartilhamento-prestador/compartilhamento-prestador-tutor.controller.ts` | Modificar | Rotas `atualizar-resumo` e URL de arquivo |
| `src/compartilhamento-prestador/compartilhamento-prestador-publico.controller.ts` | Modificar | Rota publica de URL de arquivo com throttle |
| `src/compartilhamento-prestador/compartilhamento-prestador-parceiro.controller.ts` | Modificar | Rota de URL de arquivo no portal |
| `src/upload/uploadFile.service.ts` | Modificar (se necessario) | Metodo de remocao em bucket nomeado para a limpeza do cofre |
| `docs/CHANGELOG.md` | Modificar | Entry da mudanca |

---

## Tasks Tecnicas

- [ ] **T1** Schema e migrations: enum estendido em migration isolada, depois `ArquivoCompartilhado` e colunas novas. Rodar `prisma migrate status` antes, aplicar por `migrate deploy` e executar o audit grep da relacao reversa, registrando o resultado aqui.
- [ ] **T2** Criar `src/common/i18n/diario.labels.ts` com os 7 enums nos 4 locales (en-GB explicito) e migrar `diario-pet.enums.ts` para consumi-lo. *(independente de T1)*
- [ ] **T3** Adicionar as chaves de erro novas ao `ERROR_CATALOG` nos 4 locales. *(independente)*
- [ ] **T4** `cofre-arquivos.helper.ts`: selecionar entradas e documentos, aplicar caps, copiar binarios para o bucket privado com concorrencia limitada, e limpar em caso de falha. *(depende de: T1)*
- [ ] **T5** Estender `montar-snapshot.helper.ts` com os blocos `diario` e `documentos` a partir dos arquivos ja copiados. *(depende de: T2, T4)*
- [ ] **T6** `documentoIds` no DTO com validacao condicional e cap. *(depende de: T3)*
- [ ] **T7** Service: include do diario e dos documentos no `criar`, orquestrar copia antes da criacao, persistir `documentoIds`. *(depende de: T4, T5, T6)*
- [ ] **T8** Service e controllers: `atualizarResumo` e as tres rotas de URL de arquivo (publica, tutor, parceiro), com throttle e 404 generico. *(depende de: T7)*
- [ ] **T9** Limpeza do cofre em revogar, expirar (dentro de `expirarVencidos`) e deletar. *(depende de: T7)*
- [ ] **T10** Testes unitarios e de integracao conforme a Estrategia. *(depende de: T8, T9)*
- [ ] **T11** Observabilidade: logs de auditoria e metrica de bytes no cofre. *(depende de: T8)*
- [ ] **T12** Atualizar `docs/CHANGELOG.md`, o README da pasta e o contrato em `frontend.md` com as rotas e campos novos. *(depende de: T10)*

---

## Plano de Rollout

- [ ] Aplicar as migrations em dev (Postgres real) e rodar o smoke do modulo.
- [ ] Deploy do backend. Nao breaking: sem cliente marcando as categorias novas, o comportamento e identico ao de hoje.
- [ ] Validar em dev criando acesso com as duas categorias e abrindo o link publico em aba anonima.
- [ ] Liberar os chips novos no app so depois do backend em prod.

## Plano de Rollback

- **Codigo:** reverter o commit e redeploy. Sem cliente usando as categorias novas, nada quebra.
- **Migration de tabela:** `ArquivoCompartilhado` e aditiva. Reverter o codigo a deixa orfa e inofensiva. Drop so se necessario, com `DROP TABLE` explicito depois de confirmar que nenhum acesso ativo depende dela.
- **Migration de enum:** Postgres **nao permite** remover valor de enum. `DIARIO` e `DOCUMENTOS` ficam no tipo para sempre. Rollback real e garantir que nenhum registro os use: `UPDATE "CompartilhamentoPrestador" SET categorias = array_remove(array_remove(categorias, 'DIARIO'), 'DOCUMENTOS')` e limpar o bucket do cofre. **Este e o motivo de a migration de enum ser isolada e ir primeiro:** ela e a unica parte irreversivel.
- **Storage:** binarios copiados sao removiveis por prefixo do codigo do acesso.

---

## Observabilidade

- **Log:** `[Compartilhamento] ARQUIVO_ABERTO comp=<id> arquivo=<id> canal=<publico|tutor|parceiro> origem=<DOCUMENTO|DIARIO_FOTO>`. Sem nome de arquivo, sem nome do pet, sem PII.

> **Correcao da mitigacao (2026-08-05, vinda da [spec do CMS](11-13-prontuario-acesso-temporario-cms.md)).** Log **nao basta** como mitigacao do risco Alto de PII. Quando o titular pergunta "quem abriu o exame do meu pet e quando", a resposta precisa ser consultavel, paginavel e com retencao definida; log de plataforma some na rotacao e o suporte nao tem acesso a ele. A abertura de arquivo passa a ser **persistida** em tabela propria (`AberturaArquivoCompartilhado`: arquivo, compartilhamento, canal, parceiro e usuario quando autenticado, data), e o log continua existindo apenas para operacao. Ver secao 6 (Backend requerido, item B2) e a retencao no item B5 da spec do CMS.
- **Log:** `COFRE_COPIA_FALHOU comp=<id> arquivo=<origemId> erro=<code>` em nivel error.
- **Metrica:** contador de acessos criados por categoria; bytes totais no cofre; p95 do `POST` de criacao.
- **Alerta:** taxa de `COFRE_COPIA_FALHOU` acima de 5% em 15 minutos.

---

## Definition of Done

- [ ] Todos os acceptance criteria atendidos e verificados um a um
- [ ] Testes da Estrategia implementados e passando (unit + integracao contra Postgres real)
- [ ] `npx tsc --noEmit` e `npm run lint` limpos
- [ ] `/code-review` rodado e findings de correcao resolvidos
- [ ] Agent `security-auditor` rodado (a parte cria rota publica que serve arquivo, e obrigatorio pelo CLAUDE.md)
- [ ] `/verify`: acesso criado no app, link aberto em aba anonima, exame e foto abertos, revogacao cortando o acesso
- [ ] Audit grep da relacao reversa registrado na T1
- [ ] `prisma migrate status` limpo em dev e em prod
- [ ] Sem breaking change nao documentada
- [ ] Observabilidade implementada
- [ ] Spec com status `Concluido` + data + Change Log
- [ ] `/spec-sync` rodado

## Perguntas em Aberto

- [ ] **1** O campo `nota` do diario fica fora por default (D11.5). Faz sentido, ou o tutor deveria poder incluir marcando uma opcao? Responsavel: Nicolas.
- [ ] **2** Cap de 50 MB por acesso e suficiente para exame de imagem (ultrassom e raio-x em PDF passam facil de 10 MB)? Responsavel: Nicolas.
- [ ] **3** Documento apagado pelo tutor continua visivel no acesso por ser copia congelada (Regra 8). Confirmar que e o comportamento desejado, ou apagar tambem do cofre ao deletar a origem. Responsavel: Nicolas.

## Follow-up (fora do escopo, viram spec propria)

- **Migrar `bucketFotos` para privado.** Divida pre-existente que afeta documentos, fotos do diario, fotos de pet e a carteirinha publica (`TODO(security-4)` em [public-pet.controller.ts:189](../../../../../../src/public-pet/public-pet.controller.ts#L189)). Esta parte se protege com cofre proprio, mas a raiz continua aberta.
- **Copia assincrona** com estado `PREPARANDO`, caso o p95 do `POST` estoure o alvo.

## Change Log

| Data | Versao | Mudanca | Autor |
|---|---|---|---|
| 2026-08-05 | 0.1 | Criacao apos research e as 4 decisoes do Nicolas | Nicolas via Claude |
