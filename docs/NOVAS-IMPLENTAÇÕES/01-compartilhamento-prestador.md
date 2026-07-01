# Spec: Parte 1 - Compartilhamento Temporario com Prestador

**Status:** In Review | **Autor:** Claude + Nicolas | **Criado em:** 2026-06-23 | **Atualizado em:** 2026-06-24 | **Versao:** 0.5

> Parte filha do epico [Acesso, Compartilhamento e Parcerias](../epicos/acesso-compartilhamento-e-parcerias.md). Fonte do contrato: [compartilhament-temporario.txt](../epicos/compartilhament-temporario.txt). Depende da Parte 0 (util de codigo publico + **catalogo i18n de mensagens de erro/sucesso**, em redacao).

> **Decisoes D15 (Nicolas, 2026-06-24, autoritativas) ja dobradas neste corpo.** O que cabe a esta parte: **(D15-throttle)** o throttler atual e in-memory e nao e cross-instancia no Railway, logo o requisito de defesa anti-brute-force das rotas publicas por codigo (Redis no throttler **OU** lockout/segundo balde por codigo) e **bloqueante no DoD** desta parte, nao mais uma "Pergunta em Aberto menor" (ver Task 0d, Regra 14, AC36, DoD e [epico D15:132](../epicos/acesso-compartilhamento-e-parcerias.md#L132)); **(D15-dominios)** o dominio do link vem da env `PRESTADOR_BASE_URL` (ja dobrado, Regra 13). As demais decisoes do D15 (comissao anual/mensal, clawback via `CANCELLATION`+`cancel_reason`, `codigoIndicacao` na Parte 3, carencia de familia, leitura de prontuario atras de flag, anti-laranja) sao das **Partes 2/3/4** e nao impactam esta parte; ficam registradas no epico.

---

## Visao Geral

Tutor (dono do pet) gera um acesso temporario para um prestador comercial (banho, tosa, consulta, exame, hotel). O backend cria um `CompartilhamentoPrestador`, gera codigo de 6 digitos + link publico, calcula `expiraEm` e congela um **snapshot** das infos do pet limitado as categorias que o tutor selecionou. O prestador abre o link sem login, ve so o snapshot e registra **anotacoes** (stream em tempo real, varias por dia) com ate 3 anexos. O tutor acompanha pelo app, marca anotacoes como lidas e, opcionalmente, salva um anexo nos documentos do pet (vira `Documents` real).

Tres entidades novas e auto-contidas: `CompartilhamentoPrestador`, `AnotacaoPrestador`, `AnexoPrestador`. Modulo `compartilhamento-prestador` shippable sozinho. Nenhum endpoint existente muda de forma (aditivo, D8 do epico).

Distincao explicita: **isto nao e Familia**. Familia (Parte 2) e membership permanente vivo; aqui e snapshot congelado para terceiro comercial, acesso por codigo publico.

> Nota sobre "membro da familia que e dono do pet": esta parte autoriza criacao **apenas** para quem e o tutor dono do pet (`pet.tutor.usuarioId === userId`). Membership de familia (acesso de quem nao e o tutor dono) e Parte 2 e esta **fora de escopo** aqui. Ver Regras de Negocio 3 e Autorizacao.

> **Bloqueio de dependencia (atualizado v0.5):** esta parte tem **tres** dependencias duras da Parte 0 que ainda nao existem no repo: (a) o util de codigo publico, (b) o **catalogo de mensagens de erro/sucesso i18n** (D14), e (c) a **interface da defesa anti-brute-force por codigo** das rotas publicas (D15-throttle: Redis no throttler **ou** o segundo balde de throttle chaveado por `:codigo` + a constante `PUBLIC_CODE_THROTTLE` que a Parte 0 expoe como ponto unico de config; ver Regra 14). O que existe hoje em `src/common/i18n/` e **somente** overlay de traducao de **conteudo de entidade** (JSONB `traducoes` sobre artigo/cupom/especie via `traducao.util.ts`); **nao existe catalogo de mensagens de erro/HTTP**, e a infra de conteudo atual resolve `en-GB` **por fallback para `en-US`** (`LOCALE_FALLBACK` em [locales.ts:18-20](../../src/common/i18n/locales.ts#L18-L20)), o que **colide com a regra travada do Nicolas** (en-GB sempre explicito, nunca via fallback). Consequencias e plano em Riscos, i18n e Perguntas em Aberto 4/8.

---

## Motivacao / Contexto de Negocio

- O Premium ja vende "Compartilhamento com cuidadores parceiros" e o front das telas (`/(fullscreen)/compartilhamento-prestador/*`) ja esta pronto com mock local. Backend e o gargalo ([compartilhament-temporario.txt:3-6](../epicos/compartilhament-temporario.txt#L3-L6)).
- Decisao locked do epico: **sem gating de plano** - qualquer tutor cria ([acesso-compartilhamento-e-parcerias.md:134](../epicos/acesso-compartilhamento-e-parcerias.md#L134), [:133](../epicos/acesso-compartilhamento-e-parcerias.md#L133)).
- Privacidade tem que ser garantida no servidor, nao so no front: o snapshot so pode conter as categorias selecionadas ([compartilhament-temporario.txt:178-181](../epicos/compartilhament-temporario.txt#L178-L181)).

---

## Research Findings (com ancoras arquivo:linha reais)

### Pet e fontes do snapshot (verificado contra schema)

`Pet` **nao tem** campo `pesoKg` nem `castrado` diretos. O contrato do front pede `snapshot.pesoKg` e `snapshot.castrado` ([compartilhament-temporario.txt:166-175](../epicos/compartilhament-temporario.txt#L166-L175)). As fontes reais sao:

| Campo do snapshot | Fonte real no schema | Ancora |
|---|---|---|
| `petNome` | `Pet.nome` | [schema.prisma:316](../../prisma/schema.prisma#L316) |
| `petEspecie` | `Pet.especiePet` (enum `Especie`) | [schema.prisma:318](../../prisma/schema.prisma#L318), [:898-906](../../prisma/schema.prisma#L898-L906) |
| `petFoto` | `Pet.foto` | [schema.prisma:317](../../prisma/schema.prisma#L317) |
| `pesoKg` | ultimo `PesoRegistro.peso` por `data desc, createdAt desc` (tiebreaker, ver nota) | [schema.prisma:381-394](../../prisma/schema.prisma#L381-L394) |
| `castrado` | `DogInfo.castrado` / `CatInfo.castrado` / `RabbitInfo.castrado` (so esses 3 tem o campo) | [schema.prisma:654](../../prisma/schema.prisma#L654), [:664](../../prisma/schema.prisma#L664), [:695](../../prisma/schema.prisma#L695) |
| `alergias[]` | `Pet.alergiasEstruturadas` (model `Alergia`, `where ativo=true`) + fallback texto livre `Pet.alergias` | [schema.prisma:352](../../prisma/schema.prisma#L352), [:1134-1151](../../prisma/schema.prisma#L1134-L1151), [:330-331](../../prisma/schema.prisma#L330-L331) |
| `vacinas[]` | `Vacina` (`nome`, `aplicadaEm`) | [schema.prisma:525-539](../../prisma/schema.prisma#L525-L539) |
| `medicamentos[]` | `TratamentoFixo` (`ativo=true`, medicacao cronica) + `Medicamento` (administrado) | [schema.prisma:1156-1183](../../prisma/schema.prisma#L1156-L1183), [:492-511](../../prisma/schema.prisma#L492-L511) |
| `comportamento[]` | `DiarioPet.temperamento` recente (enum `TemperamentoPet`) | [schema.prisma:611](../../prisma/schema.prisma#L611), [:1099-1111](../../prisma/schema.prisma#L1099-L1111) |
| `diagnosticos[]` | `Diagnostico` (`ativo=true`) | [schema.prisma:1115-1130](../../prisma/schema.prisma#L1115-L1130) |
| `observacoesTutor` | `mensagemTutor` do request (texto livre do tutor) | [compartilhament-temporario.txt:174](../epicos/compartilhament-temporario.txt#L174) |

> **Tiebreaker do peso (corrigido v0.4):** `PesoRegistro.data` e um `DateTime` preenchido pelo usuario (pode ter empates ou datas digitadas no futuro). "Ultimo peso por `data desc`" sozinho e ambiguo. O helper de snapshot usa `orderBy: [{ data: 'desc' }, { createdAt: 'desc' }]`, espelhando o padrao ja adotado em Documents ([documents.service.ts:166-169](../../src/documents/documents.service.ts#L166-L169)).

> **Forma e nome do campo de especie no payload (corrigido v0.5).** O snapshot/header de identidade persiste o **enum cru** `petEspecie Especie` (coluna), mas o **payload publico** expoe a especie sob a chave `especie` (alinhada a Spec 02-familia, que tambem mapeia `especie = pet.especiePet` e expoe `especie`, [02-plano-familia:65](../acesso-compartilhamento-e-parcerias/02-plano-familia.md#L65), [:423](../acesso-compartilhamento-e-parcerias/02-plano-familia.md#L423)) **acompanhada do label traduzido** `especieLabel`, resolvido por `traduzEspecie(petEspecie, locale)` do helper ja existente no repo ([especie.labels.ts:12-25](../../src/common/i18n/especie.labels.ts#L12-L25), com `en-GB` explicito por entrada). O payload de P1 carrega **os dois**: `especie` (enum, contrato estavel/maquinavel) e `especieLabel` (string ja localizada pro prestador, que nao recebe o enum em portugues-maiusculo cru). O label segue o `Accept-Language` do request, igual ao resto da feature. Isso evita divergencia com a Spec 02 e nao deixa o front decidir como humanizar o enum. (Resolve o achado de mapeamento de especie nao especificado.)

> A montagem do snapshot e uma funcao pura testavel em `helpers/montar-snapshot.helper.ts`. O snapshot **persistido** ja vem filtrado pelas categorias; o servidor nunca grava categoria nao-selecionada (privacidade no servidor). **Excecao (D14):** `castrado` NAO e gated por categoria. Ele viaja no **header de identidade** do snapshot (junto de `petNome/petEspecie/petFoto`), sempre presente, independente das categorias selecionadas. Motivo: `castrado` ja e publico sem autenticacao na carteirinha `/public/:slug` ([public-pet.controller.ts:30-114](../../src/public-pet/public-pet.controller.ts#L30-L114)) e e dado de identidade clinica basica que o prestador precisa. Logo deixa de ser um campo do bloco PESO e passa a campo de cabecalho. `pesoKg` continua gated por PESO. **Nota de staleness (ver Regras de Negocio 12):** `petCastrado` e congelado na criacao, igual ao resto do snapshot.

### Upload / download / signed URL: o que o repo REALMENTE oferece (corrigido v0.4 apos furos)

**Furo critico encontrado na revisao adversarial: o reuso descrito na v0.3 estava quebrado.** Verificacao linha-a-linha:

- `UploadFilePets.uploadFilePets(file, pathName)` **HARDCODA** `const bucket = 'bucketFotos'`, usa o 2o argumento **apenas como sub-path** (`uploads/pets/<pathName>/...`) e retorna `getPublicUrl` (**URL publica**) ([uploadFilePets.service.ts:17-45](../../src/upload/uploadFilePets.service.ts#L17-L45)). O comentario do proprio metodo diz que o bucket "deve ser publico". `removeFilePets` idem (bucket fixo `bucketFotos`, [uploadFilePets.service.ts:47-54](../../src/upload/uploadFilePets.service.ts#L47-L54)). **Conclusao:** `uploadFilePets` NAO aceita nome de bucket e NAO grava em bucket privado. A v0.3 inteira (que mandava `uploadFilePets(file, '<bucket privado>')`) era inexecutavel e teria mandado o anexo pro bucket publico de fotos de pet, **furando o pilar D14** (bucket privado + signed URL).
- O metodo correto para bucket privado e **`UploadFile.uploadFile(file, pathFolder, pathName, bucket)`** ([uploadFile.service.ts:18-40](../../src/upload/uploadFile.service.ts#L18-L40)), que **aceita `bucket` como 4o argumento** e grava nele. Retorna `{ url, path }` (a `url` de `getPublicUrl` em bucket privado nao e util; descartamos, guardamos so `path`). **Esta parte usa `uploadFile`, NAO `uploadFilePets`, para o anexo.**
- `UploadFile.createSignedUrl(path, bucket, expiresInSeconds)` retorna **`Promise<string>`** (a signed URL crua), **NAO** `{ signedUrl }` ([uploadFile.service.ts:42-52](../../src/upload/uploadFile.service.ts#L42-L52)). O embrulho `{ signedUrl, expiresIn }` e montado **manualmente** pelo `EbookService.getSignedUrl` ([ebook.service.ts:110-112](../../src/ebook/ebook.service.ts#L110-L112)). Logo o **service desta feature** e quem monta o objeto: `const signedUrl = await this.uploadFile.createSignedUrl(path, bucket, ttl); return { signedUrl, expiresIn: ttl };`.
- **Nao ha helper de download** no repo. O `SupabaseClient` so existe como membro **privado** dentro de `UploadFile`/`UploadFilePets` (cada um instancia o seu via `createClient(SUPABASE_URL, SUPABASE_KEY)`, [uploadFile.service.ts:9-14](../../src/upload/uploadFile.service.ts#L9-L14)). Para o T6 baixar o proprio arquivo do bucket privado, **adicionamos um metodo `download(path, bucket)` em `UploadFile`** (expoe `supabase.storage.from(bucket).download(path)` retornando o `Blob`/`Buffer`), em vez de instanciar um 3o client solto. Isso e uma **alteracao no `src/upload`** (sai do "sem alterar" da secao Reuso, ver Arquivos Impactados e Pergunta 1).

> **Implicacao em cascata: onde o `Documents` real e gravado.** `DocumentsService.adicionarArquivo` tambem chama `uploadFilePets(file, 'documents')` ([documents.service.ts:384](../../src/documents/documents.service.ts#L384)), ou seja, **o proprio `Documents` do app grava em `bucketFotos` (publico)** hoje. Isso e estado pre-existente do repo (nao introduzido por esta parte). O T6 (salvar anexo como `Documents`) **reusa `adicionarArquivo` como esta** e portanto o `Documents` resultante mora no bucket publico de documentos do app, como qualquer outro `Documents`. O bucket privado e exclusivo do **anexo do prestador** (canal publico sem auth), nao do `Documents` salvo. Trade-off consciente registrado em Regras de Negocio 8 e Riscos.

### Padrao de rota publica + rate-limit (reuso direto, com ressalva de infra)

`PublicPetController` e o molde exato: controller **sem** `JwtAuthGuard`, `@Throttle({ default: { limit, ttl } })` por rota, `select` minimalista, erro generico ([public-pet.controller.ts:16-25](../../src/public-pet/public-pet.controller.ts#L16-L25)). `@nestjs/throttler` ja esta instalado e o `ThrottlerGuard` e `APP_GUARD` global com default 60/min ([app.module.ts:47](../../src/app.module.ts#L47), [:89](../../src/app.module.ts#L89)).

**Ressalva critica (anti-enumeracao) - ampliada na v0.4, fechada por D15 na v0.5:** o `ThrottlerModule` esta configurado **em memoria** (`ThrottlerModule.forRoot([{ ttl, limit }])`, sem storage Redis, [app.module.ts:47](../../src/app.module.ts#L47)). Isso significa que o contador (a) **zera em restart e nao e compartilhado entre instancias** (multi-instancia em Railway fura o limite), e (b) **rastreia por IP**. **Furo D14 confirmado:** `main.ts` instancia `new FastifyAdapter()` **sem `{ trustProxy: true }`** ([main.ts:30-33](../../src/main.ts#L30-L33)), e `trustProxy` nao existe em lugar nenhum do repo. **Sem `trustProxy`, atras do proxy do Railway `req.ip` e o IP do proxy, nao do cliente** - o rate-limit por IP vira efetivamente **um unico balde global** para todos os atacantes e usuarios. Logo a defesa "rate-limit por IP" da v0.3 nem por IP funciona em prod sem o fix. D14 (epico [acesso-compartilhamento-e-parcerias.md:124](../epicos/acesso-compartilhamento-e-parcerias.md#L124)) atribui explicitamente a **Parte 1** a tarefa de habilitar e validar `trustProxy`. Tratamento: Task 0c (habilitar `trustProxy`), Riscos, AC13/AC33.

> **D15-throttle (defesa por codigo agora e BLOQUEANTE, v0.5).** `trustProxy` so conserta o *primeiro balde* (por IP). Ele **nao** protege o espaco de 10^6 codigos contra brute-force distribuido (botnet com 1 request por IP nunca estoura o balde por IP). D15 torna isso explicito: as rotas publicas por codigo (P1/P2/P3) **exigem no DoD** uma de **(a) Redis no `ThrottlerModule`** (contador cross-instancia, persistente) **ou (b) um segundo balde de throttle chaveado pelo `:codigo`** - named bucket `codigo` com `generateKey` derivando a chave do parametro `:codigo` da rota, batendo o contador por codigo, nao por IP. A Parte 0 (00-fundacao Regra 14) expoe a constante **`PUBLIC_CODE_THROTTLE = { default: { limit: 10, ttl: 60_000 } }`** como ponto unico de config desse balde por codigo (D2: extrair helper unico, nao duplicar). **Esta parte consome `PUBLIC_CODE_THROTTLE`** no balde `codigo` das tres rotas publicas; os limites por IP de P1/P2/P3 (20/12/30) sao **override nomeado por rota** do balde `default`, declarados em cima da constante, nao no lugar dela. Logo o limite por codigo (10/min) e centralizado na Parte 0 e identico ao da Parte 2; so o teto por IP diverge por rota, justificado pelo perfil de cada rota (P1 leitura, P2 escrita mais estrita, P3 re-visualizacao). Tratamento: Task 0d, Regra 14, AC36, DoD. Se Nicolas optar por adiar, e **derrogacao explicita de D15 registrada**, nao item menor (ver Pergunta 6, agora condicional).

### Multipart no Fastify NAO passa pela ValidationPipe global (e bufferiza em memoria)

`uploadDocument` mostra o padrao real: o controller le `req.body as any`, cada campo vem como `{ value }` (ou o proprio valor) e e extraido na mao via helper `getValue` ([documents.controller.ts:57-78](../../src/documents/documents.controller.ts#L57-L78)). A `ValidationPipe` global so valida `@Body()` JSON; em multipart ela **nao roda**. Consequencia para P2 (`POST anotacoes`): nao da pra confiar em DTO class-validator pra validar os campos do multipart. O DTO de anotacao vira **type** (forma) e a validacao e **manual** no controller/service (campos obrigatorios, contagem de anexos, MIME, tipos). Ver Tasks 6/10/11.

> **Furo de memoria/DoS (novo v0.4):** o multipart e registrado com **`attachFieldsToBody: true`** e **somente `limits.fileSize` (10MB)**, **sem `limits.files`** ([main.ts:38-43](../../src/main.ts#L38-L43)). Com `attachFieldsToBody: true`, **todos os arquivos do multipart sao bufferizados em memoria (`file.toBuffer`) ANTES** do handler rodar. Logo "contar antes de qualquer upload" so vale para o upload **no Supabase**: o servidor **ja recebeu e segurou N arquivos de ate 10MB em RAM** antes de o codigo poder rejeitar. No canal **publico sem auth** (P2), isso e vetor de exaustao de memoria (N grande de 10MB). Mitigacao: configurar **`limits.files`** no `@fastify/multipart` (ex.: `4`, um a mais que o limite de negocio de 3 pra distinguir "3 ok" de "passou do limite") pra o Fastify cortar **no nivel do stream** antes de bufferizar tudo, retornando erro de limite (`413`/`FST_FILES_LIMIT`). A checagem de negocio "max 3" continua no codigo (o Fastify so impede o abuso extremo). Ver Task 0c, Risco e AC15/AC34.

### OwnershipService

15 metodos `assert*Ownership`, todos binarios `tutor.usuarioId === userId` ou admin ([ownership.service.ts:46-330](../../src/auth/services/ownership.service.ts#L46-L330)). `assertPetOwnership(petId, userId, isAdmin)` busca o pet com `tutor.usuarioId` e lanca `ForbiddenException` se `pet.tutor?.usuarioId !== userId` ([ownership.service.ts:46-59](../../src/auth/services/ownership.service.ts#L46-L59)). Importante: ele valida **apenas** o tutor dono do pet; **nao** ha logica de membro-de-familia hoje. Vamos **reusar** esse pra criar (T3) e **adicionar** um `assertCompartilhamentoPrestadorOwnership` novo para detalhe/revogar/marcar-lidas/salvar-anexo. As rotas do prestador **nao** passam pelo OwnershipService (snapshot + codigo publico, D4 do epico, [:66](../epicos/acesso-compartilhamento-e-parcerias.md#L66)).

> **Furo i18n do `deny` (corrigido v0.4):** o helper `deny` (compartilhado pelos 15 metodos) faz `console.warn(...)` + `throw new ForbiddenException('Acesso negado a este recurso')` com **mensagem literal fixa** ([ownership.service.ts:23-28](../../src/auth/services/ownership.service.ts#L23-L28)), e os `NotFoundException` desses metodos tambem sao **pt-BR hardcoded**. A v0.3 afirmava que "mensagens de `ForbiddenException`/`NotFoundException` passam pelo catalogo i18n" - **isso e falso para o caminho do `deny`** sem alterar metodo compartilhado por 15 callsites. **Decisao (v0.4): NAO tocar `deny`** (alteracao de blast radius alto, fora do escopo desta parte). Consequencia aceita: o **403 de dono-errado** (T2-T7) sai com a mensagem fixa do `deny` (`"Acesso negado a este recurso"`), **nao** traduzida; idem o `NotFoundException` de id inexistente do `assertCompartilhamentoPrestadorOwnership`. **Apenas as mensagens proprias da feature** (sucessos + erros de validacao/negocio gerados nos controllers/services desta parte, ex.: `409`, `400` de multipart, `404` publico generico) passam pelo catalogo i18n. Isso esta refletido na secao i18n, na tabela de Autorizacao e na DoD. Tambem: `deny` usa `console.warn`, nao o `Logger` Pino - divergencia pre-existente do repo, **nao** corrigida aqui (fora de escopo); registrada como nota.

### Integracao com Documents (limites reais que mudam o desenho do T6)

`DocumentsService.create(dto, userId, isAdmin)` cria `Documents` (valida ownership do pet via `assertPetOwnership`) mas **nao faz upload** ([documents.service.ts:96-159](../../src/documents/documents.service.ts#L96-L159)). `DocumentsService.adicionarArquivo(documentoId, BufferedFile, userId, isAdmin)` faz upload (via `uploadFilePets`, bucket `bucketFotos`) + persiste `DocumentoArquivo` ([documents.service.ts:340-421](../../src/documents/documents.service.ts#L340-L421)). **Dois limites do `adicionarArquivo` que impactam T6:**

1. **Exige `BufferedFile` com `.buffer`** ([buffered-file.interface.ts:1-8](../../src/upload/buffered-file.interface.ts#L1-L8)). O anexo do prestador so guarda o `caminhoArquivo` no bucket privado, nao o buffer. Por isso o T6 precisa baixar do bucket privado (via `UploadFile.download`, metodo novo) pra reconstruir o `BufferedFile`.
2. **Proibe mix PDF+imagem** e limita **1 PDF OU 6 imagens** por documento ([documents.service.ts:368-382](../../src/documents/documents.service.ts#L368-L382)). Lanca `BadRequestException` com copy voltada ao tutor.

Consequencia: a abordagem original (reusar `create` passando `url: anexo.uri` + `adicionarArquivo`) esta **quebrada** - `create` ignora `url` no fluxo de arquivo, e `adicionarArquivo` precisa do buffer e re-uparia. Decisao de desenho corrigida em Regras de Negocio 8 e no contrato de T6: **1 anexo salvo = 1 `Documents` independente** (1 anexo nunca estoura mix nem limite), e o arquivo e baixado do bucket privado a partir de `anexo.caminhoArquivo` pra um `BufferedFile` via **`UploadFile.download(caminhoArquivo, '<bucket privado de anexos>')` (metodo novo)** antes de `adicionarArquivo`. Upload do anexo (P2) usa **`UploadFile.uploadFile(file, '<pathFolder>', '<pathName>', '<bucket privado de anexos>')`** retornando `{ url, path }`; persistimos so `path` como `caminhoArquivo`, descartamos a `url`. Multipart Fastify ja registrado com limite 10MB global ([main.ts:38-43](../../src/main.ts#L38-L43)); helper `toBufferedFile` converte o field Fastify ([file-upload.utils.ts:3-13](../../src/common/utils/file-upload.utils.ts#L3-L13)).

### Signed URL e bucket privado (padrao do repo, verificado)

O repo ja tem o padrao de **signed URL com TTL gerada on-demand**, que e o que esta parte adota para `caminhoArquivo` do anexo (D14):
- `UploadFile.createSignedUrl(path, bucket, expiresInSeconds)` retorna a **string** da signed URL; lanca `BadRequestException` em erro ([uploadFile.service.ts:42-52](../../src/upload/uploadFile.service.ts#L42-L52)). **O service da feature monta o `{ signedUrl, expiresIn }`**, igual ao ebook.
- `EbookService.getSignedUrl` e o molde de endpoint: valida acesso, entao `const signedUrl = await this.uploadFile.createSignedUrl(ebook.caminhoArquivo, 'ebooks-pdfs', 1500); return { signedUrl, expiresIn: 1500 }` ([ebook.service.ts:84-112](../../src/ebook/ebook.service.ts#L84-L112)); rota dedicada `GET :id/signed-url` ([ebook.controller.ts:117-126](../../src/ebook/ebook.controller.ts#L117-L126)).
- `security-4` ja define a politica: bucket privado para documentos sensiveis, **nao** embutir a signed URL no payload principal (scraper coleta URLs frescas), e sim um **endpoint dedicado** que gera a URL on-demand por arquivo, TTL 1h ([security-4-public-endpoints-storage.md:57](../security-4-public-endpoints-storage.md#L57), [:181-183](../security-4-public-endpoints-storage.md#L181-L183)).

Consequencia para esta parte: o anexo guarda so `caminhoArquivo` (bucket privado), nunca uma `uri` publica persistida. A leitura do binario pelo tutor e pelo prestador passa por uma rota dedicada que retorna `{ signedUrl, expiresIn }` (ver P3 e T7). Isso fecha o TODO de signed URL que o `public-pet` ainda carrega ([public-pet.controller.ts:156](../../src/public-pet/public-pet.controller.ts#L156)) em vez de herda-lo.

### Envelope de resposta

`TransformInterceptor` global empacota `{ statusCode, message, data }` ([main.ts:125-128](../../src/main.ts#L125-L128)). O contrato do front espera exatamente isso ([compartilhament-temporario.txt:612](../epicos/compartilhament-temporario.txt#L612)). Os exemplos JSON abaixo mostram so o `data`. Em **erro**, o `HttpExceptionFilter` global responde `{ statusCode, timestamp, path, message, error }` (sem `data`).

### JWT

`req.user` carrega `{ userId, tutorId, tutorActive, veterinarioId, isSystemAdmin, email, nome }` ([jwt.strategy.ts:31-41](../../src/auth/strategies/jwt.strategy.ts#L31-L41)). Resolvemos sempre por `userId` (nunca confiar em `tutorId` do body).

---

## Modelo de Dados (diff Prisma por entidade)

Todas as tabelas sao **novas** (aditivo puro, D8). Zero alteracao em models existentes. Nao ha breaking change, logo nenhum consumidor (`petjourney-app`, `petjourney-cms`) quebra.

> **Audit grep obrigatorio da relacao reversa (Task 2/15):** adicionar `compartilhamentosPrestador CompartilhamentoPrestador[]` em `model Pet` e seguro por default no Prisma (relacao so aparece se `include`/`select` pedir). Mas o CLAUDE.md exige audit grep antes de declarar aditivo. Rodar `grep` por `include:` e `select:` em queries de `Pet` (`pet.service`, `public-pet`, `timeline`, serializadores) confirmando que **nenhuma** puxa a nova relacao por engano (ex.: `include: { _count: true }` ou serializacao do Pet inteiro) e **registrar o resultado** na task antes de marcar aditivo. Ver Tasks 2 e 15.

> **Audit do fluxo de delecao de Pet (Task 2, obrigatorio antes de declarar aditivo).** `PetService.remove` faz **hard delete** (`prisma.pet.delete`, [pet.service.ts:293-296](../../src/pet/pet.service.ts#L293-L296)) - nao e soft-delete por `ativo`. Logo a FK `CompartilhamentoPrestador.petId -> Pet` **precisa** de `onDelete: SetNull` (com `petId` nullable), senao a relacao obrigatoria vira `Restrict`/`NoAction` no Prisma e qualquer pet que tenha um compartilhamento (ativo, expirado ou revogado - todos preservados) passa a **falhar com P2003** na delecao, introduzindo um bloqueio silencioso num fluxo que hoje funciona. Confirmar no audit que (a) `remove` continua deletando sem erro apos a migration e (b) nenhum outro caminho deleta Pet sem passar por `remove`. Ver Regra 14b e AC37/AC38.

### Enums novos

```prisma
enum TipoServicoPrestador {
  BANHO
  TOSA
  CONSULTA
  EXAME
  HOTEL
  OUTRO
}

enum CategoriaInfoCompartilhada {
  ALERGIAS
  VACINAS
  MEDICAMENTOS
  PESO
  COMPORTAMENTO
  DIAGNOSTICOS
  OBSERVACOES
}

enum StatusCompartilhamento {
  ATIVO
  EXPIRADO
  REVOGADO
}
```

`duracaoHoras` nao vira enum (Prisma nao tem enum de Int); fica `Int` validado no DTO em `{24, 48, 72, 168}`.

### Model CompartilhamentoPrestador (novo)

```prisma
/// Acesso temporario por codigo de 6 digitos a um snapshot CONGELADO do pet,
/// concedido a um prestador comercial. Snapshot e dados do pet sao
/// denormalizados na criacao e NAO mudam se o pet mudar depois.
/// Spec: docs/specs/acesso-compartilhamento-e-parcerias/01-compartilhamento-prestador.md
model CompartilhamentoPrestador {
  id                String                       @id @default(cuid())
  /// Codigo publico de 6 digitos. Unico entre registros realmente acessiveis
  /// (status=ATIVO E expiraEm > now). Index parcial cobre o status; a checagem
  /// de expiraEm e feita na geracao com retry. Ver migration + Riscos.
  codigo            String
  /// Nullable + onDelete: SetNull (decisao v0.5, ver Regra 14b). Deletar um Pet
  /// que tenha QUALQUER CompartilhamentoPrestador (mesmo EXPIRADO/REVOGADO, que
  /// sao preservados por design) NAO pode falhar com P2003 nem cascatear a perda
  /// do historico congelado. Como o pet hoje e HARD-deleted (pet.service.ts:295
  /// `prisma.pet.delete`), a FK obrigatoria sem onDelete viraria Restrict e
  /// bloquearia silenciosamente a delecao de pet. SetNull preserva o snapshot
  /// legivel (petNome/petEspecie/petFoto/petCastrado denormalizados) mesmo sem o
  /// pet vivo. A autorizacao do dono nao depende de petId (usa criadoPorUsuarioId).
  petId             String?
  pet               Pet?                         @relation(fields: [petId], references: [id], onDelete: SetNull)
  /// usuarioId do criador (tutor dono do pet). Resolve BOLA.
  criadoPorUsuarioId String
  tipoServico       TipoServicoPrestador
  /// Obrigatorio quando tipoServico = OUTRO (validado no DTO + service).
  servicoOutroLabel String?
  empresaNome       String?
  duracaoHoras      Int
  /// Postgres array de enum. >= 1 item.
  categorias        CategoriaInfoCompartilhada[]
  mensagemTutor     String?
  status            StatusCompartilhamento       @default(ATIVO)
  /// Dados do pet denormalizados na criacao (evita quebra visual se o pet mudar).
  /// Estes sao o HEADER DE IDENTIDADE: sempre presentes, NAO gated por categoria (D14).
  petNome           String
  petEspecie        Especie
  petFoto           String?
  /// castrado viaja no header de identidade (D14), nunca gated por categoria.
  /// CONGELADO na criacao (staleness aceita, ver Regra 12). Nullable porque a
  /// fonte (DogInfo/CatInfo/RabbitInfo.castrado) pode nao existir.
  petCastrado       Boolean?
  /// Snapshot CONGELADO, ja filtrado pelas categorias. Forma = SnapshotPetCompartilhado.
  snapshot          Json
  expiraEm          DateTime
  /// Preenchido no momento da revogacao manual.
  revogadoEm        DateTime?
  createdAt         DateTime                     @default(now())
  updatedAt         DateTime                     @updatedAt
  anotacoes         AnotacaoPrestador[]

  /// Unicidade parcial do codigo entre ativos: aplicada via migration SQL crua
  /// (Prisma nao gera unique parcial declarativo). Ver Tasks.
  @@index([criadoPorUsuarioId])
  @@index([petId])
  @@index([codigo])
  @@index([status, expiraEm])
}
```

Migration manual adicional (unicidade parcial, mesma garantia D2 do epico):

```sql
CREATE UNIQUE INDEX "uniq_codigo_compartilhamento_ativo"
  ON "CompartilhamentoPrestador" ("codigo")
  WHERE "status" = 'ATIVO';
```

> **Limitacao conhecida do index parcial (corrigida na geracao).** O index so filtra `status = 'ATIVO'`; ele **nao** consegue filtrar `expiraEm > now` (predicado nao-imutavel, Postgres recusa em index parcial). Logo um registro ATIVO ja vencido **ainda ocupa** o codigo no index ate o lazy-expire roda-lo. O contrato exige codigo livre quando o acesso nao e mais acessivel ([compartilhament-temporario.txt:71](../epicos/compartilhament-temporario.txt#L71)). Mitigacao: a geracao com retry (util Parte 0) **checa em query** `status=ATIVO AND expiraEm > now` antes de aceitar o codigo, e regenera se houver colisao com um ATIVO ainda valido. Um ATIVO-vencido que segure o codigo e lazy-expirado no primeiro read que o tocar; a chance de colisao real (1M de espaco, poucos ativos por usuario) e desprezivel. Documentar isso no comentario da migration.

### Model AnotacaoPrestador (novo)

```prisma
/// Anotacao de retorno do prestador. Stream em tempo real (varias por dia).
/// Nasce com lida=false. So pode ser criada enquanto o compartilhamento esta ATIVO.
model AnotacaoPrestador {
  id                  String                    @id @default(cuid())
  compartilhamentoId  String
  compartilhamento    CompartilhamentoPrestador @relation(fields: [compartilhamentoId], references: [id], onDelete: Cascade)
  empresaNome         String
  profissionalNome    String?
  servicoRealizado    String
  texto               String
  lida                Boolean                   @default(false)
  createdAt           DateTime                  @default(now())
  anexos              AnexoPrestador[]

  @@index([compartilhamentoId, createdAt])
}
```

### Model AnexoPrestador (novo)

```prisma
/// Anexo de uma anotacao do prestador (max 3 por anotacao). Pode vir SEM tipo
/// (foto solta). Salvar nos documentos do pet preenche documentoId/salvoNosDocumentos.
/// Arquivo fica em bucket PRIVADO do Supabase; o cliente nunca recebe URL publica.
/// O acesso ao binario e sempre via SIGNED URL com TTL gerada on-demand (D14).
model AnexoPrestador {
  id                  String            @id @default(cuid())
  anotacaoId          String
  anotacao            AnotacaoPrestador @relation(fields: [anotacaoId], references: [id], onDelete: Cascade)
  /// Tipo sugerido pelo prestador (Receita Medica, Exame de Sangue, Raio-X,
  /// Ultrassom, Outro). Nullable: anexo pode vir sem classificacao (foto solta).
  tipoDocumento       String?
  nome                String
  mimeType            String
  tamanhoBytes        Int
  /// Caminho interno no Supabase Storage (bucket privado). FONTE DE VERDADE do
  /// arquivo. Usado para gerar SIGNED URL on-demand (TTL) e para o download do T6.
  /// NUNCA exposto direto ao cliente; so o caminho fica no banco (D14, padrao
  /// security-4 / ebook). Obrigatorio: todo anexo gravado tem caminho.
  caminhoArquivo      String
  salvoNosDocumentos  Boolean           @default(false)
  /// FK pro Documents criado ao salvar nos documentos do pet (idempotencia).
  /// UNIQUE (parcial, where not null) garante 1 Documents por anexo mesmo sob
  /// double-tap concorrente (ver T6 + Riscos). Migration SQL crua.
  documentoId         String?
  createdAt           DateTime          @default(now())

  @@index([anotacaoId])
}
```

Migration manual adicional (idempotencia anti-corrida do salvar, ver T6/Riscos):

```sql
CREATE UNIQUE INDEX "uniq_anexo_prestador_documento"
  ON "AnexoPrestador" ("documentoId")
  WHERE "documentoId" IS NOT NULL;
```

> **Cascade do DB NAO limpa o Supabase Storage (registrado v0.5).** `onDelete: Cascade` em `AnexoPrestador` deleta a **linha do banco** quando a anotacao/compartilhamento e deletado, mas **nao toca o objeto no bucket privado** (`caminhoArquivo` aponta pra um binario que vira orfao). O mesmo vale quando o compartilhamento expira/e revogado: hoje o registro e preservado por design e o binario **nunca** sai do bucket, acumulando custo e PII de pet indefinidamente (componente LGPD). Esta parte **nao** apaga o compartilhamento, entao na pratica os anexos de compartilhamentos EXPIRADO/REVOGADO ficam retidos. Politica de retencao/expurgo do bucket privado e tratada na Regra 15 (delete best-effort na revogacao + divida explicita de job de limpeza) e na Pergunta em Aberto 10.

> Relacao reversa: adicionar `compartilhamentosPrestador CompartilhamentoPrestador[]` em `model Pet` (linha aditiva, sem mudar forma do Pet pra consumidores; audit grep na Task 2/15).

### Forma do `snapshot` (Json), persistida ja filtrada

```ts
interface ItemSnapshot { titulo: string; detalhe?: string; destaque?: boolean; }

interface SnapshotPetCompartilhado {
  pesoKg?: number | null;        // so se categorias inclui PESO
  // NOTA: castrado NAO fica aqui. Viaja no header de identidade (coluna
  // CompartilhamentoPrestador.petCastrado), sempre presente, nao gated por categoria (D14).
  alergias: ItemSnapshot[];      // [] se categoria ALERGIAS nao selecionada
  vacinas: ItemSnapshot[];       // [] se VACINAS nao selecionada
  medicamentos: ItemSnapshot[];  // [] se MEDICAMENTOS nao selecionada
  comportamento: ItemSnapshot[]; // [] se COMPORTAMENTO nao selecionada
  diagnosticos: ItemSnapshot[];  // [] se DIAGNOSTICOS nao selecionada
  observacoesTutor?: string | null; // so se OBSERVACOES selecionada (= mensagemTutor)
}
```

> Nota sobre `castrado` ser `boolean | null`: o front usa `castrado` como booleano nao-nullable. O backend modela `boolean | null` (coluna `petCastrado`) porque a fonte (`DogInfo/CatInfo/RabbitInfo.castrado`) pode nao existir (especie sem o campo, ou info nunca preenchida). **`castrado` agora vive no header de identidade `CompartilhamentoPrestador.petCastrado`, nao no Json do snapshot, e nunca e gated por categoria (D14).** Alinhamento do tipo nao-nullable com o front continua em Pergunta em Aberto 3.

---

## Contrato dos Endpoints

Envelope de sucesso global `{ statusCode, message, data }` (exemplos mostram so `data`); envelope de erro `{ statusCode, timestamp, path, message, error }` (sem `data`), via `HttpExceptionFilter`. **Escopo do i18n (corrigido v0.4):** as `message` **proprias da feature** (sucessos + erros de negocio/validacao gerados nos controllers/services desta parte) sao resolvidas pelo **catalogo i18n** (pt-BR/en-US/en-GB/es-419, en-GB explicito, D14, ver secao i18n). **Excecao:** o **403 de dono-errado** e o **404 de id inexistente** que sobem do `OwnershipService.deny`/`assert*` saem com as mensagens **fixas hardcoded** do `OwnershipService` (nao tocadas, blast radius de 15 callsites) - ver Research e secao i18n. As strings literais abaixo sao a forma pt-BR de cada chave da feature. Sem em-dash em nenhum locale.

### Rotas do tutor (autenticadas) - `@UseGuards(JwtAuthGuard)`, base `/tutor/compartilhamentos-prestador`

#### T1. GET /tutor/compartilhamentos-prestador
Lista os compartilhamentos do usuario logado (todos que ele criou).

- **Guard:** `JwtAuthGuard`.
- **Query (DTO):** `status?: ATIVO|EXPIRADO|REVOGADO|ENCERRADO` (ENCERRADO = EXPIRADO ou REVOGADO), `petNome?: string`, `empresaNome?: string`.
- **Comportamento:** antes de responder, lazy-expire (status=ATIVO e expiraEm<=now vira EXPIRADO, persistido via `updateMany` batch). Filtra `criadoPorUsuarioId = req.user.userId`. O `meta` (contadores) e calculado via **query agregada batch** (`groupBy`/`count` por status + counts de anotacoes nao lidas e anexos nao salvos), nunca iterando registro a registro - sem N+1. Ver Task 8.
- **200:** `{ data: CompartilhamentoPet[], meta: { ativos, encerrados, anotacoesNaoLidas, anexosNaoSalvos } }`.
- **Erros:** `401` sem token.

#### T2. GET /tutor/compartilhamentos-prestador/:id
- **Guard:** `JwtAuthGuard`.
- **Autorizacao:** `assertCompartilhamentoPrestadorOwnership(id, userId, isAdmin)` (novo).
- **Comportamento:** lazy-expire antes de responder. Retorna `CompartilhamentoPet` completo (snapshot + anotacoes + anexos via `include` unico, sem N+1).
- **200:** `CompartilhamentoPet`.
- **Erros:** `401`; em recurso de outro usuario, **403** (D14, rota autenticada, ver Autorizacao); `404` se id inexistente.

#### T3. POST /tutor/compartilhamentos-prestador
- **Guard:** `JwtAuthGuard`. Sem gating de plano (decisao locked).
- **Body (DTO `CriarCompartilhamentoDto`, JSON - passa pela ValidationPipe global):**
```ts
{
  petId: string;                    // @IsString @IsNotEmpty
  tipoServico: TipoServicoPrestador;// @IsEnum
  servicoOutroLabel?: string;       // @ValidateIf(o => o.tipoServico==='OUTRO') @IsNotEmpty
  empresaNome?: string;             // @IsOptional @Transform(trim)
  duracaoHoras: 24|48|72|168;       // @IsIn([24,48,72,168])
  categorias: CategoriaInfoCompartilhada[]; // @IsEnum each, @ArrayMinSize(1)
  mensagemTutor?: string;           // @IsOptional @Transform(trim)
}
```
- **Autorizacao:** `assertPetOwnership(petId, userId, isAdmin)` - valida que `pet.tutor.usuarioId === userId` (dono do pet) OU admin. Membro de familia que **nao** e o tutor dono e negado aqui de proposito (acesso de familia e Parte 2).
- **Comportamento:** gera `codigo` (util Parte 0, unico entre acessiveis), monta `link = ${PRESTADOR_BASE_URL}/prestador/{codigo}` (dominio via env, ver abaixo), calcula `expiraEm = now + duracaoHoras`, denormaliza `petNome/petEspecie/petFoto/petCastrado`, monta snapshot **filtrado pelas categorias** e persiste tudo numa transaction. O `link` e **derivado** (codigo + env), nao persistido como coluna: muda se o dominio mudar, e o codigo e a unica chave duravel.
- **201:** `CompartilhamentoPet` completo.
- **message:** `"Compartilhamento criado com sucesso"` (catalogo i18n).
- **Erros:** `400` payload invalido / OUTRO sem label / categorias vazias / duracao invalida; pet de outro usuario -> **403** (D14, mensagem fixa do `deny`); `404` pet inexistente (mensagem fixa do `assertPetOwnership`).

#### T4. DELETE /tutor/compartilhamentos-prestador/:id (revogar)
- **Guard:** `JwtAuthGuard`. **Autorizacao:** `assertCompartilhamentoPrestadorOwnership`.
- **Comportamento:** se status=ATIVO vira REVOGADO + `revogadoEm=now`. Nao apaga registro nem anotacoes.
- **200:** `CompartilhamentoPet` atualizado. (Nota: 200 com corpo, nao 204, porque o front re-renderiza o detalhe; excecao consciente a convencao REST de DELETE=204. Verbo em revisao - ver Pergunta 9.)
- **message:** `"Acesso revogado"` (catalogo i18n).
- **Erros:** `401`; dono-errado **403** (D14, mensagem fixa do `deny`); `404`; `409` se ja EXPIRADO ou REVOGADO (`"Este acesso ja foi encerrado."`, catalogo i18n).

#### T5. PATCH /tutor/compartilhamentos-prestador/:id/anotacoes/lidas
- **Guard:** `JwtAuthGuard`. **Autorizacao:** `assertCompartilhamentoPrestadorOwnership`.
- **Comportamento:** marca todas as anotacoes do compartilhamento como `lida=true` (`updateMany`).
- **200:** `CompartilhamentoPet` atualizado.
- **message:** `"Anotacoes marcadas como lidas"` (catalogo i18n).
- **Erros:** `401`; dono-errado **403** (D14); `404`.

#### T6. POST /tutor/compartilhamentos-prestador/:id/anotacoes/:anotacaoId/anexos/:anexoId/salvar-documento
Salva o anexo do prestador como `Documents` real do pet.

- **Guard:** `JwtAuthGuard`. **Autorizacao:** `assertCompartilhamentoPrestadorOwnership(id,...)` + valida que `anotacaoId`/`anexoId` pertencem a esse compartilhamento (senao `404`).
- **Body (DTO opcional `SalvarAnexoDto`, JSON):** `{ tipoDocumento?: string; nome?: string }`. Maleavel: o tutor confirma/decide o tipo na hora. Se omitido, default = `anexo.tipoDocumento ?? "Outro"`.
- **Comportamento (corrigido):** idempotente por anexo, **com lock anti-corrida**. Em transaction:
  1. **`SELECT ... FOR UPDATE` na linha do `AnexoPrestador`** e recheck `salvoNosDocumentos`. Se ja `true`/`documentoId` setado, `409` (`"Este anexo ja foi salvo nos documentos."`). O `FOR UPDATE` + o `UNIQUE` parcial em `documentoId` fecham a janela de double-tap concorrente sob READ COMMITTED (sem o lock, dois requests passariam o check de `false` e criariam 2 `Documents` - mesmo gap que P2 corrige). Ver Riscos.
  2. **Cada anexo salvo vira um `Documents` independente** (1 anexo nunca estoura o limite "1 PDF OU 6 imagens" nem o mix PDF+imagem do `adicionarArquivo`). Cria `Documents` do pet via `DocumentsService.create({ petId, nome, tipo, url: '' })` (a `url` e sincronizada pelo `adicionarArquivo` ao virar capa).
     > **Acoplamento ao pet vivo no `create` (registrado v0.5).** `DocumentsService.create` **re-executa `assertPetOwnership(petId, userId, isAdmin)`** ([documents.service.ts:96-99](../../src/documents/documents.service.ts#L96-L99)), ou seja, salvar-anexo **depende do pet ainda existir e ainda pertencer ao tutor** no momento do salvar - o que **contradiz o pilar "snapshot congelado, desacoplado do pet vivo"**. Com o `onDelete: SetNull` (Regra 14b), `compartilhamento.petId` pode ser **null** (pet hard-deleted) e `create` lancaria `NotFoundException` -> mapeado para **`409 PET_INDISPONIVEL_PARA_SALVAR`** (`"O pet associado nao esta mais disponivel para salvar este anexo."`, catalogo i18n), nao 404 cru. Idem se o pet foi **transferido** e `criadoPorUsuarioId` (dono do compartilhamento, ja validado por `assertCompartilhamentoPrestadorOwnership` no passo 0) divergir de `pet.tutor.usuarioId` (dono atual): `create` daria `403` inesperado mesmo o tutor sendo dono do compartilhamento. **Decisao (v0.5):** o passo 0 ja autorizou via `criadoPorUsuarioId`; o `create` aqui revalida pet vivo so como pre-condicao tecnica (precisa de `petId` valido pra atrelar o `Documents`). Se o pet nao estiver disponivel/for de outro tutor agora, **nao** vaza 403/404 cru: o service captura e devolve `409 PET_INDISPONIVEL_PARA_SALVAR`. As **leituras** do compartilhamento (T2, P1) seguem funcionando pelos dados denormalizados, sem o pet. Coberto por AC40/AC41 e Regra 8.
  3. **Baixa o arquivo do bucket privado a partir de `anexo.caminhoArquivo` para um `BufferedFile`** via **`UploadFile.download(caminhoArquivo, '<bucket privado de anexos>')` (metodo novo, ver Research)**, porque `adicionarArquivo` exige `.buffer` e o anexo so guarda o caminho no storage. Acesso server-side ao bucket privado com a service-role key (`SUPABASE_KEY`), sem signed URL para o proprio backend. O download respeita MIME whitelist + limite 10MB.
  4. Chama `DocumentsService.adicionarArquivo(doc.id, bufferedFile, userId, isAdmin)` (reupa via `uploadFilePets` no bucket `bucketFotos` - igual a qualquer `Documents` do app hoje, ver Research; persiste `DocumentoArquivo`, sincroniza `Documents.url`).
  5. Seta `anexo.salvoNosDocumentos=true`, `anexo.documentoId=doc.id`.
  - **Nota de desenho:** o re-upload (novo objeto no Supabase) e intencional. O `Documents` precisa de um arquivo proprio com seu `caminhoArquivo`, independente do ciclo de vida do anexo do prestador. **Trade-off de bucket (v0.4):** o `Documents` resultante mora no `bucketFotos` (publico), porque e isso que `adicionarArquivo` faz hoje pra todo `Documents` do app - o anexo original e que fica no bucket privado. Nao alteramos `adicionarArquivo` nesta parte.
- **200:** `{ documentoId, compartilhamento: CompartilhamentoPet }`.
- **message:** `"Anexo salvo nos documentos"` (catalogo i18n).
- **Erros:** `401`; dono-errado **403** (Autorizacao, mensagem fixa); `404` (compartilhamento/anotacao/anexo - nesting invalido); `409` ja salvo (`"Este anexo ja foi salvo nos documentos."`); **`409` pet indisponivel** (pet hard-deleted -> `compartilhamento.petId IS NULL`, ou pet transferido a outro tutor: `"O pet associado nao esta mais disponivel para salvar este anexo."`, catalogo i18n - NAO 404/403 cru do `create`, ver passo 2); `400` se o arquivo baixado falhar validacao de MIME/tamanho do Documents (mapeado pro contexto do salvar via catalogo i18n, nao a copy crua do `adicionarArquivo`).

#### T7. GET /tutor/compartilhamentos-prestador/:id/anexos/:anexoId/url
Gera signed URL com TTL para o tutor visualizar/baixar um anexo do prestador.

- **Guard:** `JwtAuthGuard`. **Autorizacao:** `assertCompartilhamentoPrestadorOwnership(id, userId, isAdmin)` + valida que `anexoId` pertence a uma anotacao **desse** compartilhamento (senao `404`).
- **Comportamento:** `const signedUrl = await this.uploadFile.createSignedUrl(anexo.caminhoArquivo, '<bucket privado de anexos>', 900); return { signedUrl, expiresIn: 900 }` (TTL **15 min**, alinhado ao P3 - ver nota de coerencia de TTL abaixo). O service monta o objeto (o helper retorna **string**). Nao persiste a URL.
- **200:** `{ signedUrl, expiresIn: 900 }`.
- **message:** `"URL gerada"` (catalogo i18n).
- **Erros:** `401`; dono-errado **403** (Autorizacao, mensagem fixa); `404` (compartilhamento ou anexo de outro compartilhamento - nesting invalido).

> **Coerencia de TTL e sobrevivencia da signed URL a revogacao (registrado v0.5).** T7 (tutor) e P3 (prestador) geram signed URL sobre o **mesmo** `caminhoArquivo` no mesmo bucket. Ambos usam **TTL 900s (15 min)** pra que o mesmo anexo nao tenha janelas de exposicao divergentes entre canais. **Limitacao do Supabase, documentada:** o Supabase **nao revoga signed URLs ja emitidas** - uma URL gerada antes da revogacao/expiracao do compartilhamento **continua resolvendo o binario ate o TTL acabar** (max 15 min), mesmo depois de o tutor revogar o acesso. Ou seja, "revogado nao abre portal" vale para gerar **novas** URLs (P3 passa a 404), mas uma URL ja emitida segue viva ate 15 min. O TTL curto e exatamente a mitigacao desse buraco (era ate 1h na v0.4). Nao ha como invalidar a URL antes do TTL sem rotacionar o objeto/bucket. Coberto por AC39. (Resolve o achado de conflito de TTL/revogacao.)

### Rotas do prestador (publicas por codigo) - controller `compartilhamento-prestador-publico`, SEM JwtAuthGuard, `@Throttle`

#### P1. GET /prestador/acesso/:codigo
- **Guard:** nenhum. **Throttle (dois baldes, D15-throttle):** `@Throttle({ default: { limit: 20, ttl: 60_000 }, codigo: PUBLIC_CODE_THROTTLE.default })` - balde `default` por IP (20/min, override por rota), balde `codigo` consumindo `PUBLIC_CODE_THROTTLE` da Parte 0 (10/min por codigo via `generateKey` do `:codigo`). **Limitacao:** in-memory zera em restart e nao e cross-instancia; o balde por IP so funciona com `trustProxy` ligado; **a defesa de verdade contra brute-force distribuido e o balde por codigo OU Redis** (D15, ver Riscos + Task 0c/0d + AC36).
- **Comportamento:** localiza compartilhamento por `codigo` e status=ATIVO. Lazy-expire (se expiraEm<=now, vira EXPIRADO e responde 404). Retorna so o snapshot ja filtrado + metadados nao-sensiveis.
- **200:** subset (`id, codigo, petNome, especie, especieLabel, petFoto, petCastrado, tipoServico, servicoOutroLabel, empresaNome, mensagemTutor, categorias, criadoEm, expiraEm, snapshot`). `especie` = enum cru (coluna `petEspecie`); `especieLabel` = label localizado via `traduzEspecie` (Accept-Language), alinhado a Spec 02 (ver Research). `petCastrado` sempre presente (header de identidade, D14), independente de PESO estar nas categorias.
- **NUNCA retorna:** `criadoPorUsuarioId`, `tutorId`, `petId`, dados do tutor, dados de outros pets, categorias nao selecionadas, **`caminhoArquivo` de anexo**.
- **404 (generico):** codigo inexistente, expirado ou revogado. **message:** `"Acesso nao encontrado ou expirado."` (catalogo i18n).
- **429:** rate-limit estourado.

#### P2. POST /prestador/acesso/:codigo/anotacoes
- **Guard:** nenhum. **Throttle (dois baldes, D15-throttle):** `@Throttle({ default: { limit: 12, ttl: 60_000 }, codigo: PUBLIC_CODE_THROTTLE.default })` - IP 12/min (override por rota, escrita mais estrita) + balde `codigo` (10/min) consumindo `PUBLIC_CODE_THROTTLE`. Mesma limitacao in-memory/trustProxy do balde por IP; o balde por codigo (ou Redis) e a defesa anti-brute-force exigida por D15.
- **Consumes:** `multipart/form-data`.
- **Parse/validacao MANUAL (multipart nao passa pela ValidationPipe, ver Research):** o controller le `req.body as any` (padrao `getValue` de `documents.controller.ts`). O "DTO" de anotacao e apenas **type** (forma), nao validador.
- **Campos:** `empresaNome` (obrigatorio), `profissionalNome?`, `servicoRealizado` (obrigatorio), `texto` (obrigatorio), `anexos?: File[]` (max 3), `tiposDocumento?` (**JSON unico** string-encoded com array paralelo a anexos por indice; ver nota).
  > **`tiposDocumento` como JSON unico, nao campo-por-indice.** Multipart com N campos `tiposDocumento` paralelos a N arquivos e fragil (ordem nao garantida, sem amarracao por indice). Enviar como **um** campo de texto `tiposDocumento` contendo JSON (`["Raio-X", null, "Outro"]`), parseado e validado na mao. Se `tiposDocumento.length !== anexos.length`, `400`.
- **Validacoes (todas manuais):**
  - compartilhamento ATIVO (senao `409`);
  - **contagem de anexos: o `@fastify/multipart` corta no `limits.files` (4, ver Task 0c) no nivel do stream; o codigo recheck `> 3 -> 400` antes de qualquer upload no Supabase e nenhum upload feito.** Os dois niveis sao necessarios: `limits.files` impede o abuso de memoria (canal publico sem auth, `attachFieldsToBody` bufferiza); o recheck no codigo aplica a regra de negocio "max 3" e devolve `400` semantico em vez de erro cru do Fastify;
  - `tipoDocumento` (por item do array), se enviado, tem que estar em `["Receita Medica","Exame de Sangue","Raio-X","Ultrassom","Outro"]`;
  - MIME aceito = imagens + `application/pdf` (whitelist no codigo);
  - tamanho por arquivo <= 10MB (limite Fastify global; recheck no codigo se o stream nao truncou).
  - Anotacao nasce `lida=false`; anexos `salvoNosDocumentos=false`, `documentoId=null`.
- **201:** `AnotacaoPrestador` completa (com `anexos[]`). Cada anexo retorna `id, tipoDocumento, nome, mimeType, tamanhoBytes` mas **nunca** `caminhoArquivo` nem `uri` publica: o binario so e obtido via P3 (`GET .../anexos/:anexoId/url`, signed URL). Mesma regra de serializacao em P1.
- **message:** `"Anotacao registrada"` (catalogo i18n).
- **Erros:** `404` codigo invalido/expirado/revogado (generico); `400` campos obrigatorios faltando / tipo invalido / >3 anexos / MIME invalido / `tiposDocumento` desalinhado; `409` compartilhamento expirado/revogado; `413` (ou erro de limite do Fastify) arquivo acima de 10MB OU acima de `limits.files`; `429` rate-limit.

#### P3. GET /prestador/acesso/:codigo/anexos/:anexoId/url
Gera signed URL com TTL para um anexo, on-demand (o prestador re-visualiza o que ele mesmo subiu).

- **Guard:** nenhum. **Throttle (dois baldes, D15-throttle):** `@Throttle({ default: { limit: 30, ttl: 60_000 }, codigo: PUBLIC_CODE_THROTTLE.default })` - IP 30/min (override por rota, re-visualizacao) + balde `codigo` (10/min) consumindo `PUBLIC_CODE_THROTTLE`. Mesma limitacao in-memory/trustProxy do balde por IP; balde por codigo (ou Redis) e a defesa exigida por D15.
- **Comportamento:** localiza compartilhamento por `codigo` ATIVO (lazy-expire; expirado/revogado -> `404` generico). Valida que `anexoId` pertence a uma anotacao **desse** compartilhamento (nesting; senao `404` generico). `const signedUrl = await this.uploadFile.createSignedUrl(anexo.caminhoArquivo, '<bucket privado de anexos>', 900); return { signedUrl, expiresIn: 900 }` (TTL 15 min, mais curto que o do ebook por ser canal publico). A signed URL **nunca** e persistida nem embutida no payload de P1: e gerada so neste endpoint dedicado (padrao security-4, anti-scraping).
- **200:** `{ signedUrl, expiresIn: 900 }`.
- **message:** `"URL gerada"` (catalogo i18n).
- **404 (generico):** codigo invalido/expirado/revogado OU anexo de outro compartilhamento. **message:** `"Acesso nao encontrado ou expirado."` (catalogo i18n).
- **429:** rate-limit estourado.

> **Sem `uri` publica persistida (D14).** Diferente do mock antigo que mostrava `uri` direto, esta parte NAO persiste URL publica em lugar nenhum. O binario do anexo so e acessivel via signed URL com TTL gerada on-demand (P3 para o prestador, T7 para o tutor), seguindo o padrao do ebook/security-4.

---

## Regras de Negocio

1. **Snapshot congelado:** montado uma vez na criacao, persistido em `CompartilhamentoPrestador.snapshot`. Mudar peso/vacina/medicamento do pet depois NAO altera o acesso ja emitido ([compartilhament-temporario.txt:178](../epicos/compartilhament-temporario.txt#L178)).
2. **Privacidade no servidor:** o snapshot persistido contem `[]`/`null` para qualquer categoria nao selecionada. O servidor nunca grava nem envia dado fora de `categorias` ([compartilhament-temporario.txt:180-181](../epicos/compartilhament-temporario.txt#L180-L181)). PESO controla apenas `pesoKg`; OBSERVACOES controla `observacoesTutor` (= `mensagemTutor`). **`castrado` (coluna `petCastrado`) NAO e gated por categoria (D14):** viaja sempre no header de identidade, mesmo sem PESO selecionado. Ver Pergunta em Aberto 3 so para o tipo nao-nullable do front.
   > **Limite do "filtro de privacidade".** Esta filtragem protege o canal do prestador. Ela **nao** substitui nem se sobrepoe a carteirinha publica `/public/:slug`, que ja expoe sem autenticacao nome, foto, raca, **castrado**, vacinas, diagnosticos, alergias e tratamentos fixos ([public-pet.controller.ts:30-114](../../src/public-pet/public-pet.controller.ts#L30-L114)). Logo, esconder `castrado`/`vacinas` aqui nao os torna secretos no produto. O ganho real e: nao vazar PII do tutor e nao acoplar o prestador ao estado vivo do pet (snapshot congelado). Sem ilusao de sigilo absoluto.
3. **Sem gating de plano, mas so o tutor dono cria:** qualquer usuario com perfil tutor cria, **desde que seja o dono do pet** (`pet.tutor.usuarioId === userId`, validado por `assertPetOwnership`). Membro de familia que **nao** e o tutor dono e negado nesta parte; acesso de familia e Parte 2 (D4). A frase original "membros da familia tambem criam" era circular e foi corrigida (decisao locked do epico = sem gating de **plano**, nao "qualquer membro").
   > **Pet inativo nao compartilha (derivado, v0.5).** `Pet.ativo Boolean @default(true)` ([schema.prisma:323](../../prisma/schema.prisma#L323)) marca pet arquivado/inativado, mas `assertPetOwnership` **nao** checa `ativo`. Criar um compartilhamento (T3) de um pet que o tutor ja arquivou geraria um portal publico mostrando dados de um pet que o proprio dono considerou inativo, sem decisao consciente. **Regra:** T3 **rejeita** pet com `ativo=false` com **`409 PET_INATIVO`** (`"Nao e possivel compartilhar um pet inativo."`, catalogo i18n). Se um pet for **inativado durante a vigencia** de um compartilhamento ja emitido, o acesso **continua ativo e congelado** (coerente com o snapshot; inativar pet nao revoga acessos), ate expirar/ser revogado. Coberto por AC42/AC43.
4. **Codigo de 6 digitos:** gerado pelo util da Parte 0; unico entre registros **acessiveis** (`status=ATIVO AND expiraEm > now`), garantido por index parcial em `status=ATIVO` + checagem de `expiraEm` na geracao com retry (ver nota da migration). Rate-limit **por IP** (in-memory hoje, **so funciona por IP com `trustProxy` ligado**, ver Riscos); **erro 404 generico** em invalido/expirado/revogado (D2/D14 do epico) - lookup por codigo publico nunca usa 403 nem revela existencia. **Nota:** o texto original prometia "rate-limit por codigo" - isso nao e o que o `ThrottlerGuard` in-memory entrega; corrigido aqui e tratado em Pergunta em Aberto 6.
5. **Expiracao lazy (ATIVO -> EXPIRADO no read):** em T1, T2, P1, P2, P3, se status=ATIVO e `expiraEm <= now`, persiste EXPIRADO antes de prosseguir ([compartilhament-temporario.txt:550-551](../epicos/compartilhament-temporario.txt#L550-L551)). Sem cron - lazy basta.
6. **Revogacao preserva historico:** REVOGADO mantem registro, anotacoes e anexos visiveis ao tutor ([compartilhament-temporario.txt:377](../epicos/compartilhament-temporario.txt#L377)).
7. **Anotacoes sao stream:** varias por dia enquanto ATIVO; nascem `lida=false`; bloqueadas apos EXPIRADO/REVOGADO (`409`).
8. **Salvar anexo: 1 anexo = 1 Documents independente.** Evita o mix PDF+imagem e o limite "1 PDF OU 6 imagens" do `adicionarArquivo` (que valem por documento). Se uma anotacao tem 1 PDF + 1 foto e o tutor salva os dois, sao criados **2 `Documents` distintos**. Sugere `tipoDocumento` quando o prestador classificou; o tutor sempre confirma/decide o tipo no salvar (default `"Outro"` quando sem tipo). Idempotente por anexo (`409` se ja salvo), com `SELECT FOR UPDATE` + `UNIQUE` parcial em `documentoId` fechando double-tap concorrente. O arquivo e baixado do bucket privado via `anexo.caminhoArquivo` (`UploadFile.download`, metodo novo) e re-upado via `adicionarArquivo` (bucket `bucketFotos`, como todo `Documents`; ver T6 + Research).
   > **Dependencia do pet vivo no SALVAR (registrada, contraria o que a v0.4 negava).** Diferente das **leituras** (T2/P1, que rodam so sobre dados denormalizados e funcionam sem o pet), o **salvar-anexo (T6)** depende do pet ainda existir e ainda ser do tutor, porque `DocumentsService.create` re-executa `assertPetOwnership` ([documents.service.ts:96-99](../../src/documents/documents.service.ts#L96-L99)) e o `Documents` precisa de um `petId` valido pra ser atrelado. Logo: se o pet foi **hard-deleted** (`compartilhamento.petId` virou null por `SetNull`, Regra 14b) ou **transferido** a outro tutor, o salvar retorna **`409 PET_INDISPONIVEL_PARA_SALVAR`** (catalogo i18n), nao 404/403 cru do `create`. A autorizacao do salvar continua sendo por `criadoPorUsuarioId` (passo 0 do T6); o `create` revalida o pet so como pre-condicao tecnica. Esta e a unica operacao da feature acoplada ao pet vivo; tudo o mais e desacoplado pelo snapshot. (Resolve o achado que dizia que a spec negava a dependencia.)
9. **`servicoOutroLabel` obrigatorio quando `tipoServico=OUTRO`** ([compartilhament-temporario.txt:99](../epicos/compartilhament-temporario.txt#L99)).
10. **`duracaoHoras` so 24/48/72/168.** `categorias` >= 1 item. `empresaNome`/`mensagemTutor` trimados.
11. **Binario do anexo so via signed URL com TTL (D14).** O anexo nunca expoe URL publica. Tutor (T7) e prestador (P3) obtem o binario por endpoint dedicado que gera signed URL on-demand de `anexo.caminhoArquivo` (bucket privado, via `UploadFile.createSignedUrl` + embrulho `{ signedUrl, expiresIn }` montado no service), **ambos com TTL 15 min** (coerencia entre canais, ver nota apos T7). A URL nunca e persistida nem embutida nos payloads de listagem/detalhe (padrao ebook/security-4, anti-scraping). **Signed URL ja emitida sobrevive a revogacao ate o TTL (limitacao do Supabase, ver nota apos T7 e AC39).**
12. **`petCastrado` e congelado, igual ao snapshot (staleness aceita, decisao explicita v0.4).** `castrado` e estado clinico que pode mudar (o pet pode ser castrado durante a validade do acesso, ate 168h/7 dias). Mesmo assim ele e **denormalizado e congelado** na criacao (`petCastrado`), nao lido ao vivo. **Decisao consciente:** dado que a janela maxima e 7 dias e castracao e evento raro nesse intervalo, o risco de exibir um `castrado` desatualizado e baixo e aceitavel em troca da coerencia "tudo no snapshot e congelado" e do desacoplamento do estado vivo do pet. Se no futuro se quiser leitura ao vivo de `castrado`, e mudanca de desenho a registrar; por ora, **congelado e a decisao**. (Resolve o furo de coerencia identidade-vs-snapshot.)
13. **Dominio do link via env `PRESTADOR_BASE_URL` (D14).** O `link` retornado ao tutor e `${PRESTADOR_BASE_URL}/prestador/{codigo}`. O dominio nunca e hardcoded no codigo; vem da env. **Placeholder ate confirmar: `https://petjourney.health`** ([acesso-compartilhamento-e-parcerias.md:126](../epicos/acesso-compartilhamento-e-parcerias.md#L126), [:239](../epicos/acesso-compartilhamento-e-parcerias.md#L239)). O `link` e derivado (nao coluna no banco), entao trocar o dominio nao exige migration nem reescrita de registros: so muda a env. Se `PRESTADOR_BASE_URL` faltar no boot, falhar rapido (config invalida) em vez de montar link quebrado.
14. **Defesa anti-brute-force por codigo e BLOQUEANTE (D15-throttle, v0.5).** As rotas publicas por codigo (P1/P2/P3) sao protegidas por **dois baldes de throttle**: (a) o balde por IP (`default`, 20/12/30 por rota, so efetivo com `trustProxy`) e (b) **o balde por codigo** (`codigo`, consumindo `PUBLIC_CODE_THROTTLE` da Parte 0 = 10/min, chaveado pelo `:codigo` via `generateKey`). O balde por codigo (ou, alternativamente, **Redis no `ThrottlerModule`** pra contador cross-instancia/persistente) e o **requisito de D15** contra brute-force distribuido do espaco de 10^6 codigos - um atacante com 1 request por IP nunca estoura o balde por IP, mas estoura o balde por codigo. **Isto e item do DoD, nao "Pergunta em Aberto menor"** (AC36). Os limites por IP por rota sao **override nomeado** em cima de `PUBLIC_CODE_THROTTLE`, nao duplicacao da config (D2: ponto unico de config na Parte 0). Se Nicolas adiar, e derrogacao explicita de D15, registrada (ver Pergunta 6).
14b. **`onDelete: SetNull` na FK Pet do compartilhamento (derivado, v0.5).** `Pet` e **hard-deleted** (`prisma.pet.delete`, [pet.service.ts:293-296](../../src/pet/pet.service.ts#L293-L296)). Como o compartilhamento e **preservado por design** (EXPIRADO/REVOGADO ficam), uma FK obrigatoria sem `onDelete` viraria `Restrict` e **bloquearia silenciosamente** a delecao de qualquer pet que ja teve compartilhamento. Decisao: **`petId` nullable + `onDelete: SetNull`** - deletar o pet zera `petId` mas preserva o historico congelado (`petNome/petEspecie/petFoto/petCastrado` denormalizados + snapshot). As **leituras** (T2, P1) seguem legiveis sem o pet; so o **salvar-anexo** (T6) fica indisponivel (Regra 8, `409 PET_INDISPONIVEL_PARA_SALVAR`). A autorizacao nunca dependeu de `petId` (usa `criadoPorUsuarioId`). Auditar o fluxo de delete de Pet antes de declarar aditivo (Task 2). Coberto por AC37/AC38.
15. **Retencao/expurgo do bucket privado de anexos (derivado de LGPD + padrao do repo, v0.5).** `onDelete: Cascade` do Postgres deleta a **linha** de `AnexoPrestador`, mas **nao** apaga o objeto no Supabase Storage (Cascade do DB nao toca storage), e compartilhamentos EXPIRADO/REVOGADO sao preservados, retendo o binario indefinidamente (custo + PII de pet). **Regra:** na **revogacao** (T4), tentar **delete best-effort** dos objetos dos anexos **nao salvos** (`salvoNosDocumentos=false`) do compartilhamento no bucket privado (via **`UploadFile.remove(path, bucket)`, metodo novo** - `UploadFile` hoje so tem `uploadFile`/`createSignedUrl`, [uploadFile.service.ts:18-52](../../src/upload/uploadFile.service.ts#L18-L52); falha de delete nao bloqueia a revogacao, so loga WARN), espelhando o padrao best-effort de `removeFilePets` em Documents. **Divida explicita registrada:** um job de limpeza periodico para anexos de compartilhamentos EXPIRADO/REVOGADO ha mais de N dias (e para o objeto orfao apos Cascade) fica como follow-up com prazo, dado o componente LGPD (ver Pergunta em Aberto 10). Anexos **ja salvos nos documentos** (`salvoNosDocumentos=true`) tem copia propria em `bucketFotos` (o `Documents`), entao expurgar o anexo original nao perde o que o tutor salvou.
16. **Geracao de codigo: lazy-expire antes de inserir + retry no INSERT (derivado, v0.5).** O index parcial `WHERE status='ATIVO'` **nao** filtra `expiraEm`, entao um registro **ATIVO-mas-vencido** ainda ocupa o codigo no banco ate ser lazy-expirado. O util de geracao considera esse codigo "acessivel = false" (reusavel), mas o **INSERT com ele violaria o unique parcial** (que so olha `status='ATIVO'`), estourando `P2002`. **Regra (janela real, nao teorica):** a geracao, dentro da transaction de criacao, **(1)** faz `updateMany` lazy-expire (`status=ATIVO AND expiraEm<=now -> EXPIRADO`) **antes** de checar/inserir, e **(2)** captura `P2002` do INSERT e **regenera** (retry no nivel do insert, nao so do `isTaken`), nunca deixa estourar `500`. Os dois niveis fecham a corrida: o lazy-expire libera o codigo do vencido; o catch+retry cobre corrida concorrente. Coberto por AC44 (integracao: ATIVO-vencido segurando codigo X, nova criacao sorteia X -> insere apos expirar ou regenera, nunca 500).
17. **Teto de compartilhamentos ATIVOS por pet e por tutor (derivado, anti-abuso, v0.5).** Sem gating de plano (decisao locked) e sem limite, um tutor (ou conta comprometida) poderia criar milhares de compartilhamentos ATIVOS, degradando a densidade de codigos vivos (interage com o limite de geracao da Parte 0, que lanca 503 `PUBLIC_CODE_GEN_EXHAUSTED` sob centenas de milhares de codigos vivos) e o custo. **Regra:** teto de **`MAX_COMPARTILHAMENTOS_ATIVOS_POR_PET = 10`** simultaneos por pet e **`MAX_COMPARTILHAMENTOS_ATIVOS_POR_TUTOR = 50`** no total (constantes, ajustaveis); criar acima do teto retorna **`409 LIMITE_COMPARTILHAMENTOS_ATIVOS`** (`"Voce atingiu o limite de compartilhamentos ativos. Revogue um acesso antes de criar outro."`, catalogo i18n). Adicionalmente, **`@Throttle` no T3** (POST autenticado de criacao, ex.: 30/min por usuario) para travar criacao em rajada. Os valores sao defaults de seguranca, nao decisao de produto fechada (ver Pergunta em Aberto 11 caso Nicolas queira outro teto). Coberto por AC45.
18. **`tipoDocumento` no salvar do tutor (T6) e texto livre (derivado, consistencia de contrato).** O prestador (P2) so pode mandar `tipoDocumento` da whitelist `["Receita Medica","Exame de Sangue","Raio-X","Ultrassom","Outro"]` (validacao manual do multipart). Mas o tutor, no salvar (`SalvarAnexoDto.tipoDocumento`), pode passar **string livre**, consistente com `Documents.tipo` que e string livre no repo - o tutor decide a categoria final do seu proprio documento (decisao locked do epico: "salvar = sugestao automatica + decisao final do tutor"). **Nao** ha validacao contra a whitelist no T6 (so trim). Registrado pra nao parecer omissao: o prestador e restrito (entrada de terceiro), o tutor e livre (dono decide).

---

## Autorizacao / BOLA (por rota)

> **Decisao de status code RESOLVIDA por D14.** Distincao por canal, nao mais em aberto ([acesso-compartilhamento-e-parcerias.md:123](../epicos/acesso-compartilhamento-e-parcerias.md#L123)):
> - **Rotas autenticadas do tutor (T2-T7)** que acessam recurso de terceiro retornam **403** (padrao do repo, `assert*Ownership` lanca `ForbiddenException`). Isso supera o "404" que o contrato fonte sugeria: D14 padroniza 403 para rota autenticada porque o tutor logado ja prova identidade e o recurso pertence a outro usuario conhecido (BOLA classico).
> - **Lookup por codigo publico do prestador (P1-P3)** retorna **404 generico anti-enumeracao**: nunca revela se o codigo existe, expirou ou foi revogado.
>
> O contrato fonte que pedia 404 em recurso alheio ([compartilhament-temporario.txt:594-595](../epicos/compartilhament-temporario.txt#L594-L595), [:307](../epicos/compartilhament-temporario.txt#L307)) e sobrescrito por D14 para as rotas autenticadas; o app mobile deve esperar **403** nessas. Comunicar ao consumidor mobile no rollout (era a unica divergencia).

> **Mensagem do 403/404 de ownership (corrigido v0.4):** o **403 de dono-errado** e o **404 de id inexistente** sobem do `OwnershipService` (`deny` -> `ForbiddenException('Acesso negado a este recurso')` fixo; `NotFoundException('Compartilhamento nao encontrado')` fixo). Essas duas mensagens **NAO** passam pelo catalogo i18n nesta parte (nao tocamos `deny`, compartilhado por 15 metodos; ver Research/i18n). Apenas as mensagens **proprias** da feature (sucessos + `409`/`400`/`404 publico generico` gerados aqui) sao traduzidas.

| Rota | Recebe id de recurso? | Check | assert usado / criar | Status dono-errado |
|---|---|---|---|---|
| T1 GET lista | nao (filtra por userId) | filtra `criadoPorUsuarioId = req.user.userId` no `where` | - | n/a |
| T2 GET :id | sim | dono do compartilhamento | **criar** `assertCompartilhamentoPrestadorOwnership(id, userId, isAdmin)` | **403** (D14) |
| T3 POST | sim (`petId` no body) | dono do pet (`pet.tutor.usuarioId === userId`) | reusar `assertPetOwnership(petId, userId, isAdmin)` | **403** (D14) |
| T4 DELETE :id | sim | dono | `assertCompartilhamentoPrestadorOwnership` | **403** (D14) |
| T5 PATCH lidas | sim | dono | `assertCompartilhamentoPrestadorOwnership` | **403** (D14) |
| T6 POST salvar-documento | sim (id + anotacaoId + anexoId) | dono + nesting valido | `assertCompartilhamentoPrestadorOwnership(id,...)` e verificar `anotacao.compartilhamentoId===id` e `anexo.anotacaoId===anotacaoId` (senao `404`) | **403** dono-errado; **404** nesting invalido |
| T7 GET :id/anexos/:anexoId/url | sim (id + anexoId) | dono + nesting valido | `assertCompartilhamentoPrestadorOwnership(id,...)` e verificar que `anexo` pertence a uma anotacao desse `id` (senao `404`) | **403** dono-errado; **404** nesting invalido |
| P1 GET /prestador/acesso/:codigo | sim (codigo publico) | nenhum (snapshot + codigo publico, D4) | so lazy-expire + throttle; **nao** passa por OwnershipService | **404 generico** (D14) |
| P2 POST /prestador/acesso/:codigo/anotacoes | sim (codigo publico) | nenhum | so lazy-expire + status ATIVO + throttle | **404 generico** (D14) |
| P3 GET /prestador/acesso/:codigo/anexos/:anexoId/url | sim (codigo publico + anexoId) | nenhum; valida nesting do anexo no compartilhamento do codigo | so lazy-expire + throttle; gera signed URL | **404 generico** (D14) |

**Novo metodo no `OwnershipService`** (segue o padrao dos existentes, [ownership.service.ts:272-290](../../src/auth/services/ownership.service.ts#L272-L290)). Lanca **403** via `deny` no ramo dono-errado (mensagem fixa, ver acima), conforme D14:

```ts
async assertCompartilhamentoPrestadorOwnership(id: string, userId: string, isAdmin = false) {
  const c = await this.prisma.compartilhamentoPrestador.findUnique({
    where: { id },
    select: { id: true, criadoPorUsuarioId: true },
  });
  if (!c) throw new NotFoundException('Compartilhamento nao encontrado'); // mensagem fixa, nao i18n
  if (isAdmin) return c;
  if (c.criadoPorUsuarioId !== userId) this.deny(userId, 'compartilhamento-prestador', id); // -> ForbiddenException (403), mensagem fixa
  return c;
}
```

Decisao consciente: nesta parte o "dono" e `criadoPorUsuarioId` (quem criou), nao a cadeia pet->tutor. Como o criador so consegue criar para pet que e dele (T3 valida `assertPetOwnership`), os dois coincidem hoje. Usar `criadoPorUsuarioId` evita re-resolver a cadeia e mantem o snapshot desacoplado do estado atual do pet.

**Contraste 404 publico:** o portal publico (P1-P3) **sempre** retorna `404` generico (D2/D14): nao revela se o codigo existe. As rotas autenticadas do tutor usam 403 (D14).

`security-auditor` deve rodar nesta parte (toca rota + query filtrada por user), conforme CLAUDE.md.

---

## Riscos e Mitigacoes

| Nivel | Risco | Mitigacao |
|---|---|---|
| Alto | **Reuso de upload/signed-url quebrado (furo v0.4).** `uploadFilePets` hardcoda `bucketFotos`, ignora bucket no 2o arg e retorna URL publica; `createSignedUrl` retorna **string**, nao `{ signedUrl }`; nao ha helper de download. A v0.3 era inexecutavel e furava D14. | Usar **`UploadFile.uploadFile(file, pathFolder, pathName, bucket)`** (aceita bucket) pro anexo no bucket privado; **service monta `{ signedUrl, expiresIn }`** em volta da string de `createSignedUrl` (como o ebook); **adicionar `UploadFile.download(path, bucket)`** pro T6. Confirmar que o bucket privado existe no Supabase e que a service-role key tem upload/download/signed nele antes do ship. Ver Research + Tasks 0b/0c/9/9b. |
| Alto | **Rate-limit por IP nao funciona atras do proxy Railway sem `trustProxy` (furo D14).** `new FastifyAdapter()` sem `trustProxy` -> `req.ip` e o IP do proxy -> throttle vira **balde global**, pior que "por IP". | **Task 0c:** `new FastifyAdapter({ trustProxy: true })` + validar `req.ip` real em staging Railway (AC33). Sem isso, AC13 e enganoso. Ainda assim in-memory (nao cross-instancia) - ver Pergunta 6. |
| Alto | **DoS de memoria no P2 publico:** `attachFieldsToBody:true` + sem `limits.files` bufferiza N arquivos de 10MB em RAM antes do handler poder rejeitar (canal sem auth). | **Task 0c:** configurar `limits.files` (4) no `@fastify/multipart` pro Fastify cortar no stream antes de bufferizar; recheck "max 3" no codigo pra `400` semantico. Risco redimensionado. AC34. |
| Alto | Enumeracao de codigos de 6 digitos no portal publico (1M espaco). `ThrottlerGuard` in-memory (zera em restart, nao cross-instancia) + por IP (so com trustProxy). | Curto prazo: `@Throttle` estrito (20/min P1, 12/min P2, 30/min P3) + 404 generico + `trustProxy`. **Limitacao aceita e registrada como follow-up** (Pergunta 6): Redis no Throttler e/ou lockout por codigo e/ou mais entropia. **Nao bloqueia ship**, mas precisa de decisao antes de tratar como anti-enumeracao forte. |
| Alto | Vazamento de PII do tutor no endpoint publico | `select` explicito que exclui `criadoPorUsuarioId/petId/tutor`; snapshot ja filtrado; **`caminhoArquivo` nunca no payload publico** (so signed URL on-demand); teste de leak dedicado. Lembrar: dado nao-PII (castrado/vacinas) ja e publico via carteirinha; o foco do leak-test e PII do tutor + identificadores internos + caminho de storage. |
| Alto | URL de anexo vazada/scrapeada | **Signed URL com TTL on-demand (D14)**, nunca persistida nem embutida no payload (padrao security-4). Bucket privado; TTL curto no canal publico (P3 15 min). Throttle no P3. |
| Alto | Snapshot enviando categoria nao selecionada (privacidade) | Filtragem no servidor na criacao (helper puro), nao no front; snapshot persistido ja vem com `[]`/`null`; teste por categoria. |
| Alto | T6 quebrar reuso de Documents (buffer ausente, mix PDF+imagem, limite, sobrescrita de url) | Desenho corrigido: 1 anexo = 1 `Documents`; download via `UploadFile.download(caminhoArquivo)`; re-upload proprio (via `adicionarArquivo`); sem mix nunca (1 arquivo). Ver Regra 8 + T6. |
| Medio | **Double-tap concorrente no salvar (T6) cria 2 Documents** (mesmo gap READ COMMITTED que P2 corrige): dois requests passam o check `salvoNosDocumentos=false` antes de qualquer um setar `true`. | `SELECT ... FOR UPDATE` na linha do `AnexoPrestador` no inicio da transaction + recheck sob lock + **`UNIQUE` parcial em `documentoId`** (constraint de banco como rede de seguranca). `409` de idempotencia deixa de ter janela de corrida. |
| Medio | Colisao de codigo em corrida de duas criacoes simultaneas | Geracao com retry (util Parte 0) checando `status=ATIVO AND expiraEm>now` + unique parcial garante atomicidade no insert; on conflict, regenera. |
| Medio | Anotacao criada apos expiracao/revogacao por janela de corrida (lazy-expire) sob READ COMMITTED. **Canal publico sem auth:** um prestador cujo acesso o tutor acabou de cortar ainda gravaria dados na janela. | **Obrigatorio (v0.5, nao mais opcional):** na transaction de P2, `SELECT ... FOR UPDATE` na linha do compartilhamento antes do INSERT, recheck `status=ATIVO AND expiraEm>now` sob o lock, entao inserir. **A alternativa "best-effort, aceitar a janela" foi removida** - sendo fronteira de seguranca/privacidade num canal publico, o lock e requisito (mesmo padrao do T6). Ver Task 10, AC16/AC46, DoD. |
| Medio | Upload de arquivo malicioso/grande pelo portal publico | MIME whitelist (imagens + pdf) + `limits.fileSize` 10MB + **`limits.files` (4)** do Fastify; contagem "max 3" rechecada no codigo antes do upload. |
| Medio | Salvar anexo duplicado (double-tap do tutor) | Idempotencia por `anexo.salvoNosDocumentos`/`documentoId` + `SELECT FOR UPDATE` + `UNIQUE` parcial; `409` se ja salvo; tudo em transaction. |
| Medio | **i18n: catalogo de erros nao existe e infra atual resolve en-GB por fallback** (colide com regra do Nicolas) | Dependencia dura da Parte 0 (catalogo de **mensagens** com en-GB **explicito**, sem `LOCALE_FALLBACK`). Se Parte 0 nao existir no merge, criar as chaves desta feature ja no formato do catalogo (4 locales, en-GB literal). 403/404 de ownership ficam com mensagem fixa (nao i18n, decisao). Ver i18n + Pergunta 4/8. |
| Alto | **Delecao de pet quebra com P2003 (furo v0.5).** Pet e hard-deleted; FK obrigatoria sem `onDelete` viraria `Restrict` e bloquearia silenciosamente a delecao de qualquer pet com compartilhamento (ativo ou nao). | **`petId` nullable + `onDelete: SetNull`** (Regra 14b): delecao zera `petId`, preserva historico congelado. Auditar `PetService.remove` antes de declarar aditivo (Task 2). AC37/AC38. |
| Medio | **Orfaos de storage + PII retida (LGPD).** Cascade do DB nao apaga objeto no Supabase; anexos de compartilhamentos EXPIRADO/REVOGADO ficam no bucket privado indefinidamente. | Delete best-effort dos objetos na revogacao (T4, falha so loga WARN) + divida explicita de job de limpeza periodico (Regra 15, Pergunta 10). Anexos ja salvos tem copia propria no `Documents`. |
| Medio | **Signed URL ja emitida sobrevive a revogacao ate o TTL.** Supabase nao revoga signed URL; uma URL gerada antes da revogacao resolve o binario por ate 15 min depois. | TTL curto (15 min em T7 e P3) e a mitigacao; limitacao documentada (Regra 11, nota apos T7, AC39). Sem como invalidar antes do TTL sem rotacionar o objeto. |
| Medio | **Salvar-anexo acoplado ao pet vivo.** `DocumentsService.create` re-roda `assertPetOwnership`; pet deletado (petId null) ou transferido faria 404/403 cru. | Mapear pra `409 PET_INDISPONIVEL_PARA_SALVAR` (Regra 8, T6 passo 2, AC40/AC41); leituras seguem funcionando pelo snapshot. |
| Medio | **Brute-force distribuido do espaco 10^6 (1 req por IP nao estoura balde por IP).** | Balde de throttle por `:codigo` (`PUBLIC_CODE_THROTTLE` da Parte 0) **ou** Redis no Throttler - **bloqueante por D15** (Regra 14, Task 0d, AC36, DoD). |
| Medio | **Geracao de codigo: ATIVO-vencido segurando codigo -> P2002 no INSERT.** Util considera o vencido reusavel, mas o unique parcial so olha `status='ATIVO'`. | Lazy-expire (`updateMany`) antes de inserir + catch `P2002` com retry no INSERT (Regra 16, AC44), nunca 500. |
| Medio | **Abuso: tutor cria milhares de compartilhamentos ativos** (sem gating de plano), degradando densidade de codigos + custo. | Teto por pet (10) e por tutor (50) -> `409 LIMITE_COMPARTILHAMENTOS_ATIVOS`; `@Throttle` no T3 autenticado (Regra 17, AC45). |
| Baixo | **Pet inativo compartilhado sem decisao consciente.** `assertPetOwnership` nao checa `ativo`. | T3 rejeita `ativo=false` com `409 PET_INATIVO`; pet inativado durante a vigencia mantem o acesso congelado (Regra 3, AC42/AC43). |
| Baixo | Historico inconsistente apos pet ser deletado | Denormalizacao de `petNome/petEspecie/petFoto/petCastrado` + snapshot congelado preservam a visualizacao mesmo com `petId` null (SetNull, Regra 14b). |
| Baixo | `petCastrado` congelado ficar clinicamente desatualizado em ate 7 dias | Decisao explicita (Regra 12): aceito por ser evento raro na janela e por coerencia "tudo no snapshot e congelado". |
| Baixo | `meta` de T1 causar N+1 | Query agregada batch (`count`/`groupBy`), nunca loop por registro. Ver Task 8. |
| Baixo | Relacao reversa em Pet vazar em consumidor existente | Audit grep de `include:`/`select:` em queries de Pet antes de declarar aditivo (Tasks 2/15). |

---

## Requisitos Nao-Funcionais

- **Rate-limit:** P1 20/min/IP, P2 12/min/IP, P3 30/min/IP (via `@Throttle`, ThrottlerGuard global). **Depende de `trustProxy` ligado** pra ser por IP em prod (Task 0c). **Hoje in-memory** (nao persistente, nao multi-instancia) - follow-up de Redis em Pergunta 6.
- **Privacidade:** endpoint publico nunca expoe PII do tutor nem `caminhoArquivo`; snapshot filtrado por categoria; **anexo so via signed URL com TTL (D14)** - bucket privado, `caminhoArquivo` no banco, signed URL gerada on-demand (**T7 e P3 ambos 15 min**, coerentes), nunca persistida/embutida. Sem `uri` publica em lugar nenhum. **Limitacao: signed URL ja emitida sobrevive a revogacao ate o TTL (Supabase nao revoga signed URL); TTL curto e a mitigacao (AC39).**
- **Memoria/DoS:** `@fastify/multipart` com `limits.files` (4) + `limits.fileSize` (10MB) pra cortar abuso no canal publico antes de bufferizar (Task 0c).
- **Performance:** queries com `select` minimalista; lazy-expire em `updateMany` batch; `meta` via agregacao batch; sem N+1 (anotacoes+anexos via `include` unico no detalhe).
- **Observabilidade:** log WARN em DENY (ja no `OwnershipService.deny`, via `console.warn` - divergencia pre-existente do repo, nao corrigida aqui); log INFO em criacao/revogacao/salvar-anexo/geracao de signed URL (sem PII, sem logar URL/token), via `Logger` do `@nestjs/common` nos services novos.
- **i18n:** ver secao dedicada abaixo.

### i18n

Locales do projeto: `pt-BR`, `en-US`, `en-GB`, `es-419`, com `en-GB` **sempre explicito** (regra do Nicolas, nunca via fallback).

> **Estado real da infra (verificado v0.4) e impacto.** O que existe em `src/common/i18n/` e **somente** overlay de traducao de **conteudo de entidade** (`traducao.util.ts` aplica o JSONB `traducoes` sobre campos de artigo/cupom/especie). **Nao existe catalogo de mensagens de erro/HTTP.** Pior: `LOCALE_FALLBACK` ([locales.ts:18-20](../../src/common/i18n/locales.ts#L18-L20)) define `en-GB -> en-US`, e `cadeiaDeLocales` resolve en-GB **por fallback** quando falta a entrada britanica - o **oposto** da regra travada do Nicolas. Logo o catalogo de **mensagens** desta parte **NAO** pode reusar essa cadeia de fallback de conteudo; precisa de en-GB **literal**.

- **Dependencia DURA da Parte 0.** O **catalogo de mensagens de erro/sucesso** (D14) e dependencia bloqueante que **ainda nao existe** (Parte 0 em redacao). Plano: (a) se a Parte 0 mergear o catalogo antes, consumir dela; (b) se nao, **criar as chaves desta feature ja no formato do catalogo** nos 4 locales com **en-GB escrito a mao** (sem usar `LOCALE_FALLBACK`), pra nao gerar string hardcoded a migrar depois. **Nao** fazer ship pt-BR-only hardcoded.
- **Escopo do que e traduzido (corrigido v0.4, ampliado v0.5):** passam pelo catalogo as `message` **proprias da feature** - sucessos (`"Compartilhamento criado com sucesso"`, `"Acesso revogado"`, `"Anotacoes marcadas como lidas"`, `"Anexo salvo nos documentos"`, `"Anotacao registrada"`, `"URL gerada"`) e erros de negocio/validacao gerados aqui (`"Acesso nao encontrado ou expirado."`, `"Este acesso ja foi encerrado."`, `"Este anexo ja foi salvo nos documentos."`, **`"O pet associado nao esta mais disponivel para salvar este anexo."`** (PET_INDISPONIVEL_PARA_SALVAR), **`"Nao e possivel compartilhar um pet inativo."`** (PET_INATIVO), **`"Voce atingiu o limite de compartilhamentos ativos. Revogue um acesso antes de criar outro."`** (LIMITE_COMPARTILHAMENTOS_ATIVOS) + os erros de validacao manual do multipart). Todas sem em-dash, en-GB literal.
- **Fora do catalogo (decisao explicita):** o **403 de dono-errado** (`"Acesso negado a este recurso"`, do `deny`) e o **404 de id inexistente** (`"Compartilhamento nao encontrado"`, do `assert`) saem **hardcoded em pt-BR**, porque vem do `OwnershipService` compartilhado por 15 callsites e **nao** sera alterado nesta parte (blast radius). Isso e divida conhecida, registrada; nao bloqueia ship.
- O snapshot, dados do pet e o conteudo livre digitado pelo prestador/tutor (`texto`, `mensagemTutor`, `servicoRealizado`) **nao** sao traduzidos (sao dados, nao copy de UI).
- A resolucao do locale segue o pipeline da Parte 0 (ex.: `Accept-Language`).
- **Sem em-dash** em nenhuma mensagem (regra override), em nenhum locale.

---

## Acceptance Criteria

Cada AC e binario/Given-When-Then.

> **AC5/AC22 resolvidos por D14:** rota autenticada do tutor acessando recurso de terceiro retorna **403**; lookup por codigo publico do prestador retorna **404 generico**. Os testes assertam esses codigos diretamente.

**Criacao e snapshot**
- AC1. Given tutor dono do pet, When `POST` com `tipoServico=BANHO`, `duracaoHoras=48`, `categorias=[ALERGIAS,VACINAS]`, Then retorna 201 com `codigo` de 6 digitos numericos, `expiraEm = criadoEm + 48h`, e `snapshot.medicamentos=[]`, `snapshot.diagnosticos=[]`, `snapshot.comportamento=[]`, `snapshot.pesoKg=null`, e `petCastrado` reflete o valor da fonte (`DogInfo/CatInfo/RabbitInfo.castrado`) **mesmo sem PESO** nas categorias (header de identidade, D14).
- AC2. Given `tipoServico=OUTRO` sem `servicoOutroLabel`, When `POST`, Then 400.
- AC3. Given `duracaoHoras=10`, When `POST`, Then 400.
- AC4. Given `categorias=[]`, When `POST`, Then 400.
- AC5. Given pet de OUTRO tutor, When tutor `POST` com aquele `petId`, Then **403** (D14, rota autenticada) e nenhum registro criado.
- AC6. Given compartilhamento criado, When o tutor altera `Pet.nome` e adiciona uma vacina depois, Then `GET :id` retorna o `petNome` e `snapshot.vacinas` originais (congelado).

**Expiracao e revogacao**
- AC7. Given compartilhamento ATIVO com `expiraEm` no passado, When `GET :id`, Then status persiste EXPIRADO e o body reflete EXPIRADO.
- AC8. Given compartilhamento ATIVO, When `DELETE :id`, Then status vira REVOGADO, `revogadoEm` setado, registro e anotacoes preservados, 200.
- AC9. Given compartilhamento ja REVOGADO, When `DELETE :id`, Then 409.

**Portal publico**
- AC10. Given codigo de compartilhamento ATIVO, When `GET /prestador/acesso/:codigo`, Then 200 com snapshot e SEM `criadoPorUsuarioId`, `petId`, `tutorId`, `caminhoArquivo` ou qualquer PII do tutor no body.
- AC11. Given codigo inexistente OR expirado OR revogado, When `GET /prestador/acesso/:codigo`, Then 404 generico com a chave de mensagem `"Acesso nao encontrado ou expirado."` resolvida pelo catalogo i18n da feature (mesma chave para os 3 casos, sem revelar qual ocorreu). **Com `Accept-Language: en-GB`, retorna a traducao en-GB que existe LITERALMENTE no catalogo (entrada en-GB escrita a mao, nao via `LOCALE_FALLBACK` de conteudo).**
- AC12. Given categorias `[ALERGIAS]` apenas, When prestador faz `GET`, Then `snapshot.vacinas=[]` e nenhum dado de vacina aparece no payload do prestador (privacidade servidor; o mesmo dado pode existir na carteirinha publica - canais distintos).
- AC13. Given `trustProxy` ligado e single-instance, Given >20 requests/min do mesmo IP em P1 na mesma janela, Then 429. (Limitacao: in-memory; nao garante bloqueio cross-instancia - ver Pergunta 6. Testar em ambiente controlado, ver Estrategia de Testes.)
- AC33. Given a API atras do proxy Railway com `trustProxy: true`, When chega request, Then `req.ip` reflete o IP real do cliente (header `X-Forwarded-For`), nao o IP do proxy. (Valida o fix do D14; sem isso o rate-limit por IP nao distingue clientes.)

**Anotacoes e anexos**
- AC14. Given compartilhamento ATIVO, When `POST .../anotacoes` (multipart) com `empresaNome,servicoRealizado,texto` e 1 PDF, Then 201, anotacao `lida=false`, anexo `salvoNosDocumentos=false`, `documentoId=null`, `caminhoArquivo` preenchido (bucket privado), e **nenhuma `uri` publica** retornada no payload.
- AC15. Given 4 anexos no `POST` de anotacao, Then 400 (contagem de negocio rejeitada no codigo antes de qualquer upload no Supabase; nenhuma anotacao nem anexo criado).
- AC34. Given um numero de anexos acima de `limits.files` (ex.: 10 arquivos) no `POST` publico de anotacao, Then o Fastify corta no nivel do stream (erro de limite/`413`) **antes** de bufferizar todos em memoria, e nenhuma anotacao e criada. (Valida a defesa de memoria/DoS do canal publico.)
- AC16. Given compartilhamento EXPIRADO ou REVOGADO, When `POST .../anotacoes`, Then 409 e nenhuma anotacao criada.
- AC17. Given anotacao sem `texto`, When `POST`, Then 400.
- AC23. Given `POST .../anotacoes` com 2 anexos e `tiposDocumento` JSON com 3 itens (desalinhado), Then 400.
- AC24. Given `POST .../anotacoes` com anexo de MIME fora da whitelist (ex.: `application/zip`), Then 400 e nenhum anexo criado.

**Marcar lidas e salvar documento**
- AC18. Given compartilhamento com 3 anotacoes nao lidas do dono, When tutor `PATCH .../anotacoes/lidas`, Then todas viram `lida=true` e body atualizado.
- AC19. Given anexo nao salvo (1 PDF), When tutor `POST .../salvar-documento` (sem body), Then cria `Documents` do pet com `tipo="Outro"`, baixa o arquivo do bucket privado via `anexo.caminhoArquivo` (`UploadFile.download`) e cria `DocumentoArquivo` (via `adicionarArquivo`), retorna `documentoId`, e o anexo fica `salvoNosDocumentos=true`/`documentoId` setado.
- AC20. Given anexo ja salvo, When `POST .../salvar-documento` de novo, Then 409.
- AC21. Given `anexoId` que pertence a outra anotacao, When `POST .../salvar-documento`, Then 404.
- AC22. Given compartilhamento de outro usuario, When tutor `GET/DELETE/PATCH/salvar-documento/anexos-url`, Then **403** (D14, rota autenticada).
- AC25. Given uma anotacao com 1 PDF + 1 foto, When o tutor salva os dois anexos, Then sao criados **2 `Documents` independentes** (sem erro de mix PDF+imagem), cada um com seu `DocumentoArquivo`.
- AC35. Given dois `POST .../salvar-documento` concorrentes para o MESMO anexo, Then exatamente **um** cria o `Documents` e o outro recebe `409` (ou viola o `UNIQUE` parcial em `documentoId` e e mapeado pra `409`); **nunca** 2 `Documents` para o mesmo anexo.

**Snapshot fisico**
- AC26. Given `categorias` inclui PESO e o pet tem `DogInfo.castrado=true` e um `PesoRegistro` recente, When `POST`, Then `snapshot.pesoKg` = ultimo peso (por `data desc, createdAt desc`) e `petCastrado=true`.
- AC27. Given `categorias` NAO inclui PESO e o pet tem `DogInfo.castrado=true`, When `POST`, Then `snapshot.pesoKg=null` mas `petCastrado=true` (header de identidade nao gated, D14); no `GET /prestador/acesso/:codigo`, `petCastrado=true` aparece no payload.

**Signed URL de anexo (sem uri publica)**
- AC28. Given anexo de um compartilhamento ATIVO, When prestador `GET /prestador/acesso/:codigo/anexos/:anexoId/url`, Then 200 com `{ signedUrl, expiresIn: 900 }`, `signedUrl` contendo `token`/`expires` (signed, nao publica), e nenhum payload de P1/P2 contem `uri` publica do anexo.
- AC29. Given anexo que pertence a OUTRO compartilhamento, When `GET /prestador/acesso/:codigo/anexos/:anexoId/url`, Then 404 generico (`"Acesso nao encontrado ou expirado."`).
- AC30. Given codigo expirado ou revogado, When `GET /prestador/acesso/:codigo/anexos/:anexoId/url`, Then 404 generico.
- AC31. Given tutor dono, When `GET /tutor/compartilhamentos-prestador/:id/anexos/:anexoId/url`, Then 200 com `{ signedUrl, expiresIn: 900 }` (signed, TTL 15 min, coerente com P3), montado pelo service em volta da string de `createSignedUrl`.
- AC32. Given compartilhamento de OUTRO usuario, When tutor `GET .../anexos/:anexoId/url`, Then **403** (rota autenticada). Given `anexoId` de outro compartilhamento do proprio tutor, Then 404 (nesting invalido).

**Defesa por codigo, pet deletado/inativo, retencao e corridas (v0.5)**
- AC36. Given o balde de throttle por codigo ativo (`PUBLIC_CODE_THROTTLE`, 10/min) **ou** Redis no Throttler, Given >10 requests/min para o **mesmo `:codigo`** em P1 (mesmo que de IPs distintos), Then 429 a partir do 11o - a defesa anti-brute-force por codigo (D15) corta independentemente do IP. (Se a decisao for adiar, este AC vira derrogacao explicita de D15 registrada.)
- AC37. Given um pet com 1 compartilhamento EXPIRADO e 1 REVOGADO, When `DELETE` do pet (fluxo `PetService.remove`, hard delete), Then a delecao **conclui sem P2003**, `compartilhamento.petId` vira `null` (`SetNull`) e `GET :id` continua retornando `petNome/petEspecie/petFoto/petCastrado` e `snapshot` congelados (legivel sem o pet).
- AC38. Given um compartilhamento cujo `petId` virou `null` (pet deletado), When `GET /prestador/acesso/:codigo` (se ainda ATIVO antes da delecao) ou `GET :id`, Then o snapshot/header denormalizado e servido normalmente, sem erro de pet ausente.
- AC39. Given uma signed URL de anexo emitida (T7 ou P3) e, **logo depois, o compartilhamento revogado**, When a URL e acessada dentro do TTL (15 min), Then o binario **ainda resolve** (limitacao do Supabase, documentada); apos o TTL, nao resolve; e novas chamadas a P3 retornam 404 generico (revogado).
- AC40. Given um anexo de compartilhamento cujo pet foi **deletado** (`petId` null), When tutor `POST .../salvar-documento`, Then **`409 PET_INDISPONIVEL_PARA_SALVAR`** (catalogo i18n), nao 404/403 cru, e nenhum `Documents` criado.
- AC41. Given um anexo de compartilhamento cujo pet foi **transferido** a outro tutor, When o tutor criador `POST .../salvar-documento`, Then **`409 PET_INDISPONIVEL_PARA_SALVAR`** (nao 403 cru do `create`), e nenhum `Documents` criado.
- AC42. Given um pet `ativo=false`, When tutor `POST` compartilhamento daquele pet, Then **`409 PET_INATIVO`** (catalogo i18n) e nenhum registro criado.
- AC43. Given um compartilhamento ATIVO e o pet **inativado depois** (`ativo=false`) durante a vigencia, When `GET /prestador/acesso/:codigo`, Then o acesso **continua ATIVO** e o snapshot congelado e servido (inativar pet nao revoga acesso).
- AC44. Given um registro ATIVO-mas-vencido segurando o codigo `X` (nao lazy-expirado ainda), When uma nova criacao sorteia `X`, Then a criacao **lazy-expira o vencido e insere** (ou regenera no catch de `P2002`), **nunca retorna 500**.
- AC45. Given um pet ja com `MAX_COMPARTILHAMENTOS_ATIVOS_POR_PET` (10) compartilhamentos ATIVOS, When tutor `POST` mais um, Then **`409 LIMITE_COMPARTILHAMENTOS_ATIVOS`** (catalogo i18n) e nenhum registro criado. Idem ao exceder o teto por tutor (50).
- AC46. Given um `POST .../anotacoes` publico concorrente com um `DELETE` (revogar) do tutor sobre o mesmo compartilhamento, When ambos correm, Then com `SELECT FOR UPDATE` + recheck a anotacao e **rejeitada com 409** se a revogacao venceu o lock (nunca grava anotacao em compartilhamento revogado). (Lock obrigatorio, nao best-effort.)

---

## Estrategia de Testes

**Unit (`*.spec.ts`, Prisma mockado)**
- `montar-snapshot.helper.spec.ts`: para cada subconjunto de categorias, assert que so os blocos pedidos sao preenchidos (cobre AC1, AC12, AC26, AC27 a nivel de funcao pura). Caso PESO -> `pesoKg` (com tiebreaker `data desc, createdAt desc`); OBSERVACOES -> `observacoesTutor`; sem PESO -> `pesoKg=null`. **`petCastrado` e resolvido sempre** (header de identidade, fora do Json) e nao depende de categoria; o helper retorna `petCastrado` ao lado do snapshot (assert que com e sem PESO o valor da fonte aparece).
- `compartilhamento-prestador.service.spec.ts`: criar (happy + OUTRO sem label + duracao invalida + categorias vazias + pet de outro tutor=403 + `link` derivado de `PRESTADOR_BASE_URL` + `petCastrado` resolvido sem PESO), lazy-expire, revogar (happy + ja encerrado=409), marcar lidas, salvar anexo (happy 1 arquivo via `UploadFile.download` mockado + ja salvo=409 + nesting invalido=404 + PDF+foto = 2 docs AC25), gerar signed URL tutor (happy: service embrulha string de `createSignedUrl` em `{ signedUrl, expiresIn: 900 }` + nesting=404). Inclui caso "tutor errado" (AC22) por metodo, assertando **403**.
- `ownership.service.spec.ts`: novo `assertCompartilhamentoPrestadorOwnership` happy + falha (dono errado -> **Forbidden/403** com mensagem fixa do `deny`) + inexistente -> NotFound (mensagem fixa).
- Portal publico service: 404 generico para invalido/expirado/revogado; assert que o objeto serializado nao contem chaves proibidas (`criadoPorUsuarioId`, `petId`, `tutor`, **`caminhoArquivo`**) nem `uri` publica; parse manual do multipart (contagem >3 -> 400, MIME invalido -> 400, `tiposDocumento` desalinhado -> 400). Signed URL (P3): nesting invalido -> 404 generico, codigo expirado/revogado -> 404 generico, happy -> `{ signedUrl, expiresIn: 900 }` (mock de `createSignedUrl` retornando string).
- Signed URL tutor (T7): happy -> `{ signedUrl, expiresIn: 900 }`; dono-errado -> 403; anexo de outro compartilhamento -> 404.
- i18n: assert que as `message` **da feature** saem via chave do catalogo (mock do resolver) e que `Accept-Language: en-GB` resolve a variante en-GB **literal** (entrada existe no catalogo, NAO fallback). Assert tambem que 403/404 de ownership saem com a mensagem **fixa** (nao passam pelo resolver) - documenta a decisao.

**Integration (`*.integration.spec.ts`, Postgres real, sem mock de banco)**
- Fluxo end-to-end: criar -> GET publico (assert payload sem `caminhoArquivo`/PII) -> POST anotacao (multipart) com 1 PDF + 1 foto reais (upload via `UploadFile.uploadFile` no bucket privado, so `caminhoArquivo` persistido) -> prestador `GET .../anexos/:anexoId/url` (assert signed URL com `token`/`expires`) -> tutor marca lidas -> tutor `GET .../anexos/:anexoId/url` (signed URL TTL 15 min) -> salvar os 2 anexos (download do bucket privado via `UploadFile.download` + reupload; assert **2** `Documents` + 2 `DocumentoArquivo`, sem mix) -> revogar -> POST anotacao bloqueado (409) e `GET .../anexos/:anexoId/url` publico bloqueado (404 generico).
- Concorrencia de codigo: dois inserts ATIVO com mesmo codigo violam o unique parcial (assert geracao com retry resolve); incluir caso de ATIVO-vencido segurando codigo e geracao detectando via checagem `expiraEm>now`.
- **Concorrencia de salvar (AC35):** dois `salvar-documento` concorrentes pro mesmo anexo -> exatamente 1 `Documents`; o segundo bate `409`/`UNIQUE` parcial. Com `SELECT FOR UPDATE`.
- Lazy-expire persistente: setar `expiraEm` no passado direto no banco, `GET :id`, assert linha virou EXPIRADO.
- Corrida revogar vs criar anotacao: com `SELECT FOR UPDATE`, assert que revogacao concorrente bloqueia a anotacao (ou documentar a janela aceita se a decisao for sem lock).

**Smoke (`scripts/test-*.ts`, tsx)**
- `scripts/test-compartilhamento-prestador-smoke.ts`: dispara o fluxo HTTP real (criar como tutor, abrir como prestador, anotar com anexo multipart, salvar documento) contra DB de teste. Valida envelope `{ statusCode, message, data }` e ausencia de PII/`caminhoArquivo` no payload publico.
- **Rate-limit/trustProxy (AC13/AC33):** binario so em ambiente controlado (single-instance, `trustProxy` on, IP de teste fixo). Onde nao houver esse controle (multi-worker), rebaixar para smoke/manual e validar `req.ip` real em staging Railway. Evita o anti-pattern "passou em mock, quebrou em prod".

---

## Arquivos Impactados

| Arquivo | Acao | Descricao |
|---|---|---|
| `prisma/schema.prisma` | editar | 3 models novos + 3 enums novos + relacao reversa em `Pet` (`onDelete: SetNull`, `petId` nullable); nenhum campo existente alterado (audit grep + audit de `PetService.remove` antes de declarar aditivo) |
| `prisma/migrations/<ts>_compartilhamento_prestador/` | criar | migration aditiva + SQL crua do index unique parcial `WHERE status='ATIVO'` (comentario sobre `expiraEm`) + index unique parcial `WHERE documentoId IS NOT NULL` (anti-corrida do salvar) |
| `src/compartilhamento-prestador/compartilhamento-prestador.module.ts` | criar | Nest module (imports `PrismaModule`, `AuthModule`/`OwnershipService`, `UploadModule`, `DocumentsModule`, `ConfigModule`) |
| `src/compartilhamento-prestador/compartilhamento-prestador.controller.ts` | criar | rotas T1-T7 (tutor, `JwtAuthGuard`; T7 signed URL on-demand) |
| `src/compartilhamento-prestador/compartilhamento-prestador-publico.controller.ts` | criar | rotas P1-P3 (publicas, `@Throttle`; parse manual do multipart; P3 signed URL on-demand) |
| `src/compartilhamento-prestador/compartilhamento-prestador.service.ts` | criar | regra: criar/listar/detalhe/revogar/lidas/salvar-anexo + lazy-expire + meta agregada + gerar signed URL de anexo (T7/P3: chama `UploadFile.createSignedUrl` e **monta `{ signedUrl, expiresIn }`**) |
| `src/compartilhamento-prestador/helpers/montar-snapshot.helper.ts` | criar | funcao pura: monta snapshot filtrado por categorias (peso com tiebreaker `data desc, createdAt desc`) |
| `src/upload/uploadFile.service.ts` | **editar** | **adicionar `download(path, bucket)`** (expoe `supabase.storage.from(bucket).download(path)` -> Buffer; sai do "sem alterar") para o T6 baixar do bucket privado, **e `remove(path, bucket)`** (expoe `supabase.storage.from(bucket).remove([path])`) para o delete best-effort na revogacao (Regra 15). Confirmar service-role key tem download/remove no bucket |
| `src/compartilhamento-prestador/helpers/baixar-anexo.helper.ts` | criar | helper que usa `UploadFile.download(caminhoArquivo, '<bucket privado>')` -> `BufferedFile` (valida MIME + 10MB) pro T6 |
| `src/compartilhamento-prestador/dto/criar-compartilhamento.dto.ts` | criar | DTO criacao JSON (class-validator, passa pela ValidationPipe) |
| `src/compartilhamento-prestador/dto/query-compartilhamento.dto.ts` | criar | DTO query (status/petNome/empresaNome) |
| `src/compartilhamento-prestador/types/anotacao-multipart.type.ts` | criar | **type** (nao DTO validador) da forma do multipart; validacao manual |
| `src/compartilhamento-prestador/dto/salvar-anexo.dto.ts` | criar | DTO opcional JSON (`tipoDocumento` **texto livre**, Regra 18 / `nome`) |
| `src/compartilhamento-prestador/compartilhamento-prestador.constants.ts` | criar | `MAX_COMPARTILHAMENTOS_ATIVOS_POR_PET=10`, `MAX_COMPARTILHAMENTOS_ATIVOS_POR_TUTOR=50`, TTL de signed URL (900), MIME whitelist, whitelist de `tipoDocumento`. Consome `PUBLIC_CODE_THROTTLE` da Parte 0 (nao redefine) |
| `src/auth/services/ownership.service.ts` | editar | + `assertCompartilhamentoPrestadorOwnership` (mensagens 403/404 ficam fixas, `deny` NAO alterado) |
| `src/main.ts` | **editar** | `new FastifyAdapter({ trustProxy: true })` (D14) + `limits.files: 4` no `@fastify/multipart` (DoS de memoria) |
| `src/app.module.ts` | editar | registrar `CompartilhamentoPrestadorModule` |
| `.env` / config (`PRESTADOR_BASE_URL`) + `CLAUDE.md` secao Variaveis de ambiente | editar | adicionar env `PRESTADOR_BASE_URL` (placeholder `https://petjourney.health`); ler via `ConfigService`, fail-fast se ausente |
| catalogo i18n (Parte 0) | editar/criar | adicionar chaves de **mensagem desta feature** nos 4 locales (en-GB **literal**, sem `LOCALE_FALLBACK`), sem em-dash. Inclui `PET_INDISPONIVEL_PARA_SALVAR`, `PET_INATIVO`, `LIMITE_COMPARTILHAMENTOS_ATIVOS` (novas v0.5) |
| `src/compartilhamento-prestador/*.spec.ts` | criar | unit tests (service, helper) |
| `src/compartilhamento-prestador/*.integration.spec.ts` | criar | integration (DB real) |
| `scripts/test-compartilhamento-prestador-smoke.ts` | criar | smoke HTTP+DB |
| `docs/CHANGELOG.md` | editar | entry da feature |

> Reuso (sem alterar): `DocumentsService.create`/`adicionarArquivo`, `UploadFile.createSignedUrl`, `toBufferedFile`, catalogo i18n + util de codigo + **`PUBLIC_CODE_THROTTLE`** da Parte 0, `OwnershipService.assertPetOwnership`, `traduzEspecie`/`ESPECIE_LABELS`. **Alterado** (sai do reuso puro): `UploadFile.uploadFile` (usado com bucket privado - ja aceita bucket, sem alteracao), **`UploadFile.download` e `UploadFile.remove`** (metodos novos), `main.ts` (`trustProxy` + `limits.files`), `OwnershipService` (+1 metodo). **NAO usar `uploadFilePets` pro anexo** (hardcoda `bucketFotos` publico).

---

## Tasks Tecnicas

Checklist ordenado. Dependencias explicitas entre colchetes.

1. [ ] **(dep: Parte 0 mergeada)** Confirmar assinatura do util de codigo publico (`gerarCodigo6Digitos` + unicidade entre **acessiveis**: `status=ATIVO AND expiraEm > now`) **e do catalogo i18n de mensagens** (D14). Se Parte 0 nao existir, criar helper local provisorio em `src/common/` e as chaves i18n ja no formato do catalogo (4 locales, **en-GB literal**, sem `LOCALE_FALLBACK`); marcar pra consolidar.
0b. [ ] Adicionar env `PRESTADOR_BASE_URL` (placeholder `https://petjourney.health`) ao config, ler via `ConfigService` com fail-fast se ausente; documentar em `CLAUDE.md`. **Definir/criar o bucket privado de anexos** (recomendado dedicado, ex.: `anexos-prestador`) e **confirmar que a service-role key (`SUPABASE_KEY`) tem upload/download/createSignedUrl nele**.
0c. [ ] **(infra D14)** `main.ts`: `new FastifyAdapter({ trustProxy: true })` e **`limits.files: 4`** no `@fastify/multipart`. Validar `req.ip` real em staging Railway (AC33). Sem trustProxy, o rate-limit por IP nao distingue clientes; sem `limits.files`, P2 bufferiza N arquivos em RAM.
0d. [ ] **(infra D15-throttle, BLOQUEANTE)** **(dep: Parte 0)** Aplicar o segundo balde de throttle por codigo em P1/P2/P3: `@Throttle({ default: {...por rota}, codigo: PUBLIC_CODE_THROTTLE.default })` consumindo a constante `PUBLIC_CODE_THROTTLE` da Parte 0 (10/min) com `generateKey` chaveando pelo `:codigo`, **OU** configurar Redis no `ThrottlerModule` (contador cross-instancia). Os limites por IP (20/12/30) sao override nomeado por rota. Sem isso, brute-force distribuido do espaco 10^6 passa. Validar com AC36. Se Nicolas adiar, registrar derrogacao explicita de D15 (Pergunta 6).
2. [ ] Editar `schema.prisma`: 3 enums + 3 models + relacao reversa em `Pet`. **`petId` nullable + `onDelete: SetNull`** na FK Pet (Regra 14b). **Audit grep** de `include:`/`select:` em queries de Pet (pet.service, public-pet, timeline, serializadores) confirmando que nenhuma puxa a nova relacao; registrar resultado. **Auditar `PetService.remove`** (hard delete, [pet.service.ts:293-296](../../src/pet/pet.service.ts#L293-L296)) confirmando que a delecao de pet com compartilhamento NAO quebra apos a migration e que nenhum outro caminho deleta Pet sem passar por `remove`. `prisma migrate status` antes.
3. [ ] **(dep: 2)** `npx prisma migrate dev` (Postgres local) gerando a migration; adicionar a mao **dois** index unique parciais: `... WHERE status='ATIVO'` (com comentario que `expiraEm` nao entra no predicado, tratado na geracao) e `... ("documentoId") WHERE "documentoId" IS NOT NULL` (anti-corrida do salvar). Confirmar que a migration emite `ON DELETE SET NULL` na FK Pet. `prisma generate`.
4. [ ] **(dep: 3)** `assertCompartilhamentoPrestadorOwnership` no `OwnershipService` (**403** no ramo dono-errado via `deny` - **mensagem fixa, NAO i18n**; `NotFound` fixo) + spec (happy/falha 403/inexistente 404). **Nao** alterar `deny`.
5. [ ] Helper puro `montar-snapshot.helper.ts` + spec por categoria (privacidade no servidor). Fontes do snapshot Json (gated por categoria): ultimo `PesoRegistro` por `data desc, createdAt desc` (PESO), `Alergia(ativo)` (ALERGIAS), `Vacina` (VACINAS), `TratamentoFixo(ativo)`+`Medicamento` (MEDICAMENTOS), `DiarioPet.temperamento` (COMPORTAMENTO), `Diagnostico(ativo)` (DIAGNOSTICOS), `mensagemTutor` (OBSERVACOES). **`petCastrado` resolvido SEMPRE** de `DogInfo/CatInfo/RabbitInfo.castrado`, retornado fora do Json, nunca gated (D14).
6. [ ] DTOs JSON (criar/query/salvar-anexo) com class-validator (`@IsIn([24,48,72,168])`, `@ValidateIf` OUTRO, `@ArrayMinSize(1)`, `@Transform` trim). **Type** do multipart de anotacao (sem class-validator) + funcao de parse/validacao manual (campos obrigatorios, contagem <=3, MIME whitelist, `tiposDocumento` JSON alinhado).
7. [ ] **(dep: 3,4,5,6)** Service: `criar` (transaction: **rejeita pet `ativo=false` com `409 PET_INATIVO`**; **valida teto de compartilhamentos ATIVOS por pet (10) e por tutor (50) -> `409 LIMITE_COMPARTILHAMENTOS_ATIVOS`** (Regra 17); **lazy-expire `updateMany` ANTES de gerar** e gera codigo com retry checando acessiveis + **catch `P2002` no INSERT regenerando** (Regra 16); denormaliza `petNome/petEspecie/petFoto/petCastrado`, monta snapshot, resolve `especieLabel`, calcula expiraEm, monta `link = ${PRESTADOR_BASE_URL}/prestador/{codigo}` derivado da env) + lazy-expire helper interno. **`@Throttle` no T3** (criacao autenticada em rajada, Regra 17).
8. [ ] Service: `listar` (filtra por `criadoPorUsuarioId`, lazy-expire batch via `updateMany`, `meta` via **query agregada batch** `count`/`groupBy` - sem N+1), `detalhe` (`include` unico), `revogar` (transicao ATIVO->REVOGADO + `revogadoEm` + **delete best-effort dos objetos dos anexos NAO salvos no bucket privado via `UploadFile.remove` (metodo novo)**, falha so loga WARN, Regra 15), `marcarLidas`.
9. [ ] **(dep: 7, 0b)** Service: `salvarAnexoNoDocumento` - **1 anexo = 1 Documents**, com **`SELECT FOR UPDATE`** na linha do anexo + recheck idempotencia: `DocumentsService.create` + helper `baixarParaBufferedFile(anexo.caminhoArquivo)` (usa `UploadFile.download` do bucket privado) + `DocumentsService.adicionarArquivo`; idempotente (409 + `UNIQUE` parcial); valida nesting; **mapeia o `NotFoundException`/`ForbiddenException` do `assertPetOwnership` re-rodado por `create` (pet null por `SetNull` ou pet transferido) para `409 PET_INDISPONIVEL_PARA_SALVAR`** (Regra 8, nao 404/403 cru); mapeia erro de MIME/limite do Documents pro contexto do salvar (catalogo i18n). **Adicionar `UploadFile.download(path, bucket)`** (Task em `src/upload`).
9b. [ ] **(dep: 7, 0b)** Service: `gerarUrlAnexoTutor` (T7) e `gerarUrlAnexoPublico` (P3), **ambos TTL 900** (coerencia entre canais, ver nota apos T7): `const signedUrl = await this.uploadFile.createSignedUrl(anexo.caminhoArquivo, '<bucket privado>', 900); return { signedUrl, expiresIn: 900 }`. O helper retorna **string**; o **service monta o objeto**. Valida nesting do anexo; **nunca** persiste/embute a URL.
10. [ ] **(dep: 7, 0c)** Service: portal publico `verSnapshotPorCodigo` (select sem PII e **sem `caminhoArquivo`**, expõe `especie`+`especieLabel` via `traduzEspecie`) + `criarAnotacao` (parse manual multipart, contagem <=3 antes do upload, MIME whitelist, **upload via `UploadFile.uploadFile(file, pathFolder, pathName, '<bucket privado>')`** guardando so `path` como `caminhoArquivo`, **`SELECT FOR UPDATE` + recheck `status=ATIVO AND expiraEm>now`** na transaction pra fechar revogar-vs-anotar - **obrigatorio, nao best-effort**, por ser canal publico, Regra/Risco v0.5).
11. [ ] Controllers tutor (T1-T7, `JwtAuthGuard`) e publico (P1-P3, `@Throttle` 20/12/30, leitura manual de `req.body` no multipart) + Swagger (`@ApiTags`, `@ApiOperation`, `@ApiBearerAuth` so no tutor, `@ApiConsumes('multipart/form-data')` no P2). `message` da feature via catalogo i18n.
12. [ ] Registrar modulo no `app.module.ts`.
13. [ ] **(dep: 4-11)** Unit + integration specs cobrindo AC1-AC35. `npm test` verde.
14. [ ] Smoke script HTTP+DB. Rodar contra DB de teste.
15. [ ] **(dep: tudo)** Rodar `security-auditor`. `npm run lint`. Entry no `docs/CHANGELOG.md`. **Audit grep** dos callsites (`assertCompartilhamentoPrestadorOwnership`, `montarSnapshot`, `baixarParaBufferedFile`, `UploadFile.download`, `UploadFile.remove`, `UploadFile.uploadFile`, `createSignedUrl`, `traduzEspecie`, `PUBLIC_CODE_THROTTLE`, `PRESTADOR_BASE_URL`, `trustProxy`, `limits.files`, `MAX_COMPARTILHAMENTOS_ATIVOS_POR_PET/POR_TUTOR`, relacao reversa em Pet, fluxo `PetService.remove`) antes de marcar concluido.

---

## Consideracoes de Arquitetura

- **Modulo auto-contido:** `compartilhamento-prestador` nao acopla outros services por DI alem de `PrismaService`, `OwnershipService`, `DocumentsService`, `UploadFile` (upload bucket privado + download + signed URL), `ConfigService` (env do link) e o resolver i18n da Parte 0. Helpers de snapshot e download sao puros/utilitarios. **Nao usa `UploadFilePets` pro anexo** (bucket hardcoded publico).
- **Snapshot como Json vs tabelas normalizadas:** Json porque o snapshot e imutavel, lido inteiro e nunca consultado por campo. Normalizar criaria 5+ tabelas filhas sem ganho. Forma validada na escrita pelo helper tipado.
- **Codigo via util compartilhado (D2):** mesma geracao/unicidade/erro generico que a Parte 2. Unicidade entre **acessiveis** (status + expiraEm) tratada na geracao porque o index parcial sozinho nao cobre `expiraEm`.
- **Lazy-expire vs cron:** lazy no read cobre T1/T2/P1/P2/P3 sem job. Status persistido, nao so calculado.
- **Dois controllers, um service:** separar o controller publico do autenticado deixa a fronteira de seguranca explicita.
- **Reuso de upload corrigido (v0.4):** o repo so tem `UploadFile.uploadFile` aceitando bucket; `uploadFilePets` e fixo em `bucketFotos` publico e foi descartado pro anexo. Download nao existia -> `UploadFile.download` novo. `createSignedUrl` retorna string -> service embrulha. Estado pre-existente (Documents grava em `bucketFotos`) nao alterado.
- **Anexo via signed URL on-demand (D14):** bucket privado + `caminhoArquivo` + endpoint dedicado (T7 1h, P3 15 min), alinhado a ebook/security-4. Para o backend baixar o proprio arquivo (T6), `UploadFile.download` direto no bucket privado com service-role key.
- **trustProxy + limits.files (infra D14):** sem `trustProxy` o rate-limit por IP vira global atras do Railway; sem `limits.files` o canal publico bufferiza N arquivos. Ambos corrigidos no `main.ts` (Task 0c).
- **Defesa por codigo, nao so por IP (D15-throttle):** o balde por IP nao protege contra brute-force distribuido do espaco 10^6 (1 req por IP nunca estoura). Por isso o segundo balde chaveado pelo `:codigo` (`PUBLIC_CODE_THROTTLE` da Parte 0) ou Redis no Throttler e bloqueante (Task 0d). Config centralizada na Parte 0 (D2), so o teto por IP por rota e override local.
- **Retencao de storage (LGPD):** Cascade do DB nao limpa o Supabase; delete best-effort na revogacao (`UploadFile.remove`) cobre o caminho feliz; job de expurgo por tempo + orfaos de Cascade fica como divida (Pergunta 10). Anexo salvo tem copia propria no `Documents`.
- **Acoplamento minimo ao pet vivo:** so o salvar-anexo (T6) depende do pet existir/ser do tutor (porque `DocumentsService.create` revalida ownership); todo o resto (leitura, snapshot, autorizacao por `criadoPorUsuarioId`) e desacoplado, e `onDelete: SetNull` mantem o historico legivel sem o pet.
- **Especie no payload publico:** enum cru (`especie`) + label localizado (`especieLabel` via `traduzEspecie`), alinhado a Spec 02; o front nao humaniza o enum.
- **i18n parcial consciente (v0.4):** mensagens da feature via catalogo (en-GB literal); 403/404 de ownership ficam com mensagem fixa do `OwnershipService` (nao alterado). Divida registrada.

---

## Plano de Rollout / Rollback

**Rollout**
1. Merge da migration aditiva via `npx prisma migrate deploy` (staging -> prod). Tabelas novas + 2 index parciais, zero impacto em tabelas existentes.
2. Deploy da API com o modulo novo + `main.ts` (`trustProxy`, `limits.files`). Endpoints novos so passam a existir; nenhum contrato antigo muda (D8). **Validar `req.ip` real em staging Railway** (AC33) antes de prod.
3. App mobile habilita as telas (front ja pronto com mock) apontando pra API real. **Comunicar ao mobile (D14):** dono-errado em rota autenticada e **403** (nao 404 do mock); anexo nao tem `uri` publica - usar T7 (`GET .../anexos/:anexoId/url`) pra signed URL; lookup de codigo invalido/expirado/revogado e **404 generico**.
4. Configurar `PRESTADOR_BASE_URL` em cada ambiente (placeholder `https://petjourney.health`). Confirmar dominio final antes do deploy de prod. Como o `link` e derivado da env, trocar o dominio depois e so atualizar a env e redeploy.
5. Criar o bucket privado `anexos-prestador` no Supabase e validar permissoes da service-role key (upload/download/signed) antes do ship.

**Rollback**
- Reverter o deploy da API remove as rotas. As tabelas novas ficam (aditivo). `trustProxy`/`limits.files` no `main.ts` sao melhorias de seguranca - manter mesmo no rollback do modulo (nao quebram nada).
- Se necessario dropar: migration reversa dropando as 3 tabelas + 3 enums + a relacao reversa em Pet + os 2 index parciais; sem perda de dado de outras features.

---

## Observabilidade

- Log INFO (sem PII) via `Logger` do `@nestjs/common` nos services novos: criacao (`compartilhamentoId`, `petId`, `tipoServico`, `duracaoHoras`), revogacao, salvar-anexo (`anexoId` -> `documentoId`), geracao de signed URL (`anexoId`, canal tutor/publico, TTL - **sem logar a URL nem o token**).
- Log WARN em DENY (ja emitido por `OwnershipService.deny` via `console.warn`, [ownership.service.ts:23-28](../../src/auth/services/ownership.service.ts#L23-L28)) - divergencia pre-existente (`console.warn`, nao Pino) nao corrigida aqui.
- Log WARN em 404 do portal publico com contagem por IP, util pra detectar enumeracao (sem logar o codigo tentado em claro - hash/redact). Util **limitado** enquanto o Throttler for in-memory e so confiavel se `trustProxy` distinguir IPs; correlacionar com metricas externas (follow-up Redis).
- Metricas de negocio (epico): % de tutores com >=1 compartilhamento, % de anotacoes recebidas.
- Throttler 429 ja contabilizado pelo guard global.

---

## Definition of Done

- [ ] Migration aditiva aplicada (`migrate deploy`); 2 index unique parciais presentes (`status='ATIVO'` com comentario sobre `expiraEm`; `documentoId IS NOT NULL`); FK Pet com **`ON DELETE SET NULL`** (`petId` nullable); `migrate status` limpo.
- [ ] **Delecao de pet com compartilhamento NAO quebra** (audit de `PetService.remove` registrado): `petId` vira null, historico congelado segue legivel (AC37/AC38).
- [ ] 7 rotas do tutor (T1-T7) + 3 do prestador (P1-P3) implementadas com os payloads/erros do contrato.
- [ ] Snapshot congelado na criacao e filtrado por categoria no servidor (teste de leak por categoria verde); `petCastrado` no header de identidade, presente mesmo sem PESO (D14); peso com tiebreaker `data desc, createdAt desc`.
- [ ] Portal publico nao retorna PII do tutor nem `caminhoArquivo` (teste de leak verde), rate-limited (in-memory documentada), erro **404 generico** (D14).
- [ ] Anexo sem `uri` publica: gravado via `UploadFile.uploadFile` em bucket privado, `caminhoArquivo` no banco, binario so via signed URL on-demand (T7 1h, P3 15 min, service embrulha a string de `createSignedUrl`); URL nunca persistida/embutida (D14).
- [ ] **`trustProxy: true` no FastifyAdapter e `req.ip` real validado em staging Railway (AC33); `limits.files` configurado no multipart (AC34).**
- [ ] **(D15-throttle, BLOQUEANTE) Defesa anti-brute-force por codigo nas rotas publicas:** balde de throttle por `:codigo` consumindo `PUBLIC_CODE_THROTTLE` da Parte 0 **ou** Redis no `ThrottlerModule` (cross-instancia). 429 por codigo validado (AC36). Se adiado, **derrogacao explicita de D15 registrada** (nao item menor).
- [ ] **Corrida revogar-vs-anotar fechada com `SELECT FOR UPDATE` + recheck (obrigatorio, nao best-effort)** no P2 (AC46).
- [ ] **Salvar-anexo com pet deletado/transferido -> `409 PET_INDISPONIVEL_PARA_SALVAR`** (nao 404/403 cru), AC40/AC41.
- [ ] **Pet inativo rejeitado na criacao (`409 PET_INATIVO`)**; pet inativado na vigencia mantem acesso congelado (AC42/AC43).
- [ ] **Teto de compartilhamentos ATIVOS por pet/tutor** (`409 LIMITE_COMPARTILHAMENTOS_ATIVOS`) + `@Throttle` no T3 (AC45).
- [ ] **Geracao de codigo nao estoura 500 com ATIVO-vencido segurando codigo** (lazy-expire antes de inserir + catch `P2002` com retry), AC44.
- [ ] **Retencao do bucket privado:** delete best-effort dos anexos nao salvos na revogacao (T4); divida de job de limpeza registrada (Pergunta 10); nota de que Cascade do DB nao limpa o Supabase.
- [ ] Lazy-expire ATIVO->EXPIRADO persistente nos pontos de leitura (T1/T2/P1/P2/P3).
- [ ] Salvar anexo: 1 anexo = 1 `Documents`+`DocumentoArquivo` reais (download do bucket privado via `UploadFile.download` + reupload), idempotente com `SELECT FOR UPDATE` + `UNIQUE` parcial (AC35), PDF+foto = 2 docs (AC25).
- [ ] Multipart de anotacao parseado/validado manualmente (contagem <=3, MIME whitelist, `tiposDocumento` alinhado).
- [ ] Geracao de codigo unica entre **acessiveis** (status+expiraEm), testada com ATIVO-vencido segurando codigo.
- [ ] Corrida revogar-vs-anotar tratada com `SELECT FOR UPDATE` + recheck (**obrigatorio**, sem alternativa best-effort; canal publico, AC46).
- [ ] `link` derivado de `PRESTADOR_BASE_URL` (env, fail-fast se ausente), nao hardcoded (D14).
- [ ] `assertCompartilhamentoPrestadorOwnership` com spec; caso "tutor errado" coberto com **403** (mensagem fixa, decisao registrada); lookup publico com **404 generico** (i18n).
- [ ] `npm test` verde (unit + integration), `npm run lint` sem erro, smoke rodado contra DB real.
- [ ] Swagger atualizado pras 10 rotas (`@ApiConsumes` no P2).
- [ ] `security-auditor` rodado e sem achado aberto.
- [ ] Audit grep registrado: relacao reversa em Pet nao vaza em consumidores; callsites dos helpers/`UploadFile.download`/`uploadFile` conferidos.
- [ ] Entry no `docs/CHANGELOG.md`.
- [ ] Nenhuma copy visivel com em-dash (em nenhum locale).
- [ ] **i18n (D14):** mensagens **da feature** via catalogo nos 4 locales (en-GB **literal**, sem `LOCALE_FALLBACK`); nenhuma string da feature hardcoded; teste de resolucao en-GB verde. 403/404 de ownership documentados como mensagem fixa (nao i18n).

---

## Perguntas em Aberto

> Apenas itens que exigem **decisao de produto/seguranca do Nicolas** ou de outra parte. Furos tecnicos foram corrigidos no corpo.

1. **`UploadFile.download` em `src/upload` (alteracao fora do reuso puro).** Confirmar a abordagem de adicionar `download(path, bucket)` em `UploadFile` (expondo `supabase.storage...download`) vs alternativa. Recomendado: adicionar o metodo (1 ponto, reusa o client existente) em vez de instanciar um 3o `SupabaseClient`. Decisao de design - confirmar com Nicolas que pode-se tocar `src/upload`.
2. **Bucket privado de anexos: criar dedicado `anexos-prestador` vs reusar existente; TTL do canal publico.** Recomendado bucket dedicado. O **TTL do P3** esta proposto em 15 min - confirmar se 5/10/15 atende o fluxo do prestador sem reabrir scraping. Tambem confirmar que a service-role key tem upload/download/createSignedUrl no bucket.
3. **Tipo de `castrado` (nao-nullable no front vs `boolean | null` no backend).** Gating resolvido (D14, header de identidade, congelado - Regra 12). Resta alinhar o **tipo**: o front usa booleano nao-nullable; o backend modela `boolean | null` (fonte pode nao existir). Decidir se o front aceita `null` ou se mapeamos `null -> false` na borda. Afeta AC1, AC26, AC27.
4. **Catalogo de mensagens de erro/sucesso i18n (Parte 0) NAO existe ainda e e dependencia dura.** A unica infra i18n do repo e overlay de conteudo e resolve en-GB **por fallback** (colide com a regra do Nicolas). Decisao: (a) bloquear a Parte 1 ate a Parte 0 entregar o catalogo de mensagens com en-GB **literal**, ou (b) esta parte cria as chaves no formato do catalogo (4 locales, en-GB a mao) e a Parte 0 consolida depois. Tambem definir o mecanismo final de deteccao de locale (Accept-Language puro vs header proprio) - vem da Parte 0.
5. **Caminho vet-com-conta** (Open do epico, [acesso-compartilhamento-e-parcerias.md:135](../epicos/acesso-compartilhamento-e-parcerias.md#L135)) - fora desta parte; follow-up quando as telas de conta-de-vet existirem.
6. **Anti-enumeracao forte: forma da defesa por codigo e (opcional) mais entropia.** **Resolvido por D15 quanto a SER bloqueante:** o corpo agora exige (Regra 14, Task 0d, AC36, DoD) o **balde de throttle por codigo** (`PUBLIC_CODE_THROTTLE` da Parte 0) **ou Redis no Throttler** - nao e mais "Pergunta menor". O que resta de decisao: **(a)** qual das duas formas adotar (segundo balde por codigo via `@Throttle` named bucket, mais simples e sem infra nova, **recomendado** para o ship; vs Redis no Throttler, mais robusto mas exige provisionar Redis no Railway) - se Nicolas optar por **adiar ambas**, isso e **derrogacao explicita de D15** a registrar, nao item menor; **(b)** opcional/futuro: mais entropia no codigo (mais digitos/alfanumerico), que **impacta a Parte 0 + o contrato do front** e por isso fica como follow-up coordenado, nao desta parte.
7. **Dominio do link publico** - resolvido para a env `PRESTADOR_BASE_URL` (D14), placeholder `https://petjourney.health`; falta confirmar o dominio final antes do deploy de prod (troca de env, sem migration).
8. **Mensagem do 403/404 de ownership fica fora do i18n (decisao a ratificar).** O `OwnershipService.deny`/`assert*` tem mensagem fixa pt-BR compartilhada por 15 callsites; nesta parte **nao** alteramos. Ratificar que e aceitavel o dono-errado/inexistente sair em pt-BR fixo, OU agendar um follow-up dedicado pra i18n-izar o `OwnershipService` inteiro (alteracao transversal com auditoria dos 15 callsites). Mesma decisao vale pro `console.warn` do `deny` (nao-Pino).
9. **Verbo de revogar: `DELETE :id` (200 com corpo) vs `PATCH :id/revogar`.** A revogacao e transicao de estado (ATIVO->REVOGADO) que **preserva** o registro - semanticamente um PATCH, nao um delete fisico, e a convencao do repo e DELETE=204. Confirmar com o **contrato do front** qual verbo ele ja chama. Se o front espera DELETE, manter (desvio documentado); se for indiferente, preferir `PATCH :id/revogar` (200 com corpo natural, sem violar a convencao). Afeta T4/AC8/AC9.
10. **Job de limpeza/expurgo do bucket privado de anexos (LGPD).** O corpo ja resolve o **delete best-effort na revogacao** (Regra 15, T4) e registra que o Cascade do DB nao limpa o Supabase. O que **exige decisao de produto/seguranca**: criar um **job periodico** que expurgue (a) anexos de compartilhamentos EXPIRADO/REVOGADO ha mais de N dias (definir N) e (b) objetos orfaos deixados por Cascade. Decisao: implementar nesta onda como cron simples vs registrar divida com prazo. Recomendado: registrar divida com prazo (o best-effort na revogacao ja cobre o caminho feliz; o orfao de Cascade e o expurgo por tempo sao o resto). Componente LGPD: PII de pet retida em storage.
11. **Tetos de compartilhamentos ATIVOS por pet/tutor (valores).** O corpo deriva e fixa defaults de seguranca (`MAX_..._POR_PET=10`, `MAX_..._POR_TUTOR=50`, Regra 17) pra travar abuso sem gating de plano. Sao **defaults de seguranca, nao numero de produto fechado** - se Nicolas quiser outro teto (ou tornar configuravel por plano, como os limites de familia da Parte 2), ajustar. Nao bloqueia ship (o default protege); so confirmar se os numeros servem ao uso real do produto.

---

## Change Log

| Data | Versao | Mudanca | Autor |
|---|---|---|---|
| 2026-06-23 | 0.1 | Criacao da spec filha apos research (schema verificado, fontes reais do snapshot, reuso de public-pet/Documents/Ownership) | Claude + Nicolas |
| 2026-06-23 | 0.2 | Revisao adversarial: T6 redesenhado, throttler in-memory corrigido, multipart manual, escopo Parte 2, 403-vs-404, unicidade de codigo, castrado/PESO, corrida revogar-vs-anotar, meta agregada, i18n com follow-up | Claude (revisao) |
| 2026-06-24 | 0.3 | Deltas D14: `castrado` no header de identidade; `uri` virou signed URL com TTL (T7/P3); dominio via `PRESTADOR_BASE_URL`; 403-vs-404 resolvido; mensagens via catalogo i18n; AC27-AC32 | Claude (revisao D14) |
| 2026-06-24 | 0.4 | Revisao adversarial 2 (furos alta/media). **Furos de reuso corrigidos contra codigo real:** `uploadFilePets` hardcoda `bucketFotos`/URL publica -> trocado por `UploadFile.uploadFile(...,bucket)` pro anexo; `createSignedUrl` retorna **string** -> service monta `{ signedUrl, expiresIn }`; **`UploadFile.download` novo** pro T6 (nao havia helper de download). **Infra D14:** `trustProxy: true` (sem ele rate-limit por IP vira global no Railway) + `limits.files` no multipart (DoS de memoria via `attachFieldsToBody`). **i18n:** reconhecido que catalogo de erros NAO existe e que infra atual resolve en-GB por fallback (colide com regra do Nicolas) -> dependencia dura da Parte 0, en-GB literal; 403/404 de ownership ficam FORA do i18n (mensagem fixa do `deny`, nao tocado). **Concorrencia:** `SELECT FOR UPDATE` + `UNIQUE` parcial em `documentoId` no T6 (double-tap). **Peso:** tiebreaker `data desc, createdAt desc`. **`petCastrado` congelado:** staleness aceita explicitamente (Regra 12). Audit grep da relacao reversa em Pet. ACs novos AC33/AC34/AC35. Perguntas reorganizadas (1/8/9 novas, 4 ampliada) | Claude (revisao furos) |
| 2026-06-24 | 0.5 | **Reconciliacao com D15 + furos alta/media da auditoria 3.** **D15-throttle dobrado no corpo (bloqueante):** segundo balde de throttle por `:codigo` consumindo `PUBLIC_CODE_THROTTLE` da Parte 0 (ou Redis) em P1/P2/P3 - Regra 14, Task 0d, AC36, DoD; Pergunta 6 virou condicional (derrogacao explicita se adiar). **FK Pet:** `petId` nullable + `onDelete: SetNull` (pet e hard-deleted; FK obrigatoria sem onDelete bloquearia delecao com P2003) - Regra 14b, audit de `PetService.remove`, AC37/AC38. **T6 acoplado ao pet vivo:** `DocumentsService.create` re-roda `assertPetOwnership` -> pet deletado/transferido mapeado pra `409 PET_INDISPONIVEL_PARA_SALVAR` (nao 404/403 cru) - Regra 8, AC40/AC41. **Corrida revogar-vs-anotar:** `SELECT FOR UPDATE` + recheck agora **obrigatorio** (removida alternativa best-effort), canal publico - AC46. **TTL signed URL:** T7 caiu de 1h pra 15 min (coerencia com P3); registrado que signed URL emitida sobrevive a revogacao ate o TTL (limitacao Supabase) - AC39. **Retencao de storage (LGPD):** delete best-effort na revogacao via `UploadFile.remove` (novo) + divida de job de expurgo - Regra 15, Pergunta 10. **Geracao de codigo:** lazy-expire antes de inserir + catch `P2002` com retry (ATIVO-vencido segurando codigo) - Regra 16, AC44. **Anti-abuso:** teto de compartilhamentos ATIVOS por pet (10)/tutor (50) + `@Throttle` no T3 - Regra 17, AC45, Pergunta 11. **Pet inativo:** T3 rejeita `ativo=false` (`409 PET_INATIVO`); inativado na vigencia mantem acesso congelado - Regra 3, AC42/AC43. **Especie no payload:** `especie` (enum) + `especieLabel` (`traduzEspecie`), alinhado a Spec 02. **`tipoDocumento` do tutor e texto livre** (consistencia com `Documents.tipo`) - Regra 18. ACs novos AC36-AC46; 3 chaves i18n novas | Claude (reconciliacao D15) |