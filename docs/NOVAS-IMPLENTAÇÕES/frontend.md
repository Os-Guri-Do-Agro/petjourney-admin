# Spec Frontend: Acesso, Compartilhamento e Parcerias

**Status:** Backend implementado no repo (service layer das Partes 1-4 pronto). Partes 3/4 e a leitura de prontuário por família ficam atrás de flags (ver secao 8). Contrato pronto para integrar.
**Criado em:** 2026-06-29
**Plataformas consumidoras:** App tutor (Expo / React Native) + Portal do parceiro (web) + Telas admin (CMS).
**Epico backend:** [epicos/acesso-compartilhamento-e-parcerias.md](../epicos/acesso-compartilhamento-e-parcerias.md)
**Specs backend (fonte da verdade do codigo):**
- [00-fundacao-papeis-e-codigo.md](00-fundacao-papeis-e-codigo.md)
- [01-compartilhamento-prestador.md](01-compartilhamento-prestador.md)
- [02-plano-familia.md](02-plano-familia.md)
- [03-parceiro-portal-auditado.md](03-parceiro-portal-auditado.md)
- [04-indicacao-comissoes-carteira.md](04-indicacao-comissoes-carteira.md)
**Contratos originais do front (mock):** [compartilhament-temporario.txt](../epicos/compartilhament-temporario.txt), [compartilhamento-plano-familia.txt](../epicos/compartilhamento-plano-familia.txt)

---

## 0. Como usar este documento

Este `.md` e auto-suficiente: descreve **todo** o contrato de API que o frontend precisa para as quatro frentes do epico, no estado real do backend (extraido dos controllers/services, nao dos rascunhos). Se voce e uma IA de codigo do front (Cursor, Copilot, etc), pode tratar cada tabela de endpoint e cada interface TypeScript como contrato literal.

Regras de leitura:

1. **Leia a secao 2 primeiro.** Envelope de resposta, auth, erros, i18n, flags e dinheiro valem para TODAS as rotas. Nao repito isso em cada endpoint.
2. **Cada parte e independente.** Parte 1 (prestador) e Parte 2 (familia) sao do **app tutor**. Parte 3 e 4 sao do **portal do parceiro** (web) + **admin**. O resgate de cupom (3.x) e do app tutor.
3. **Tipos enum sao literais.** Os valores de enum (ex: `'Receita Medica'` sem acento) precisam casar **exatamente**. Onde o backend divergiu do mock original, ha um aviso. Ver tambem a secao 7 (divergencias).
4. **Onde diz "confirmar no dev", o codigo nao deixou explicito.** Trate como ponto a validar contra o ambiente, nao como garantia.

---

## 1. Panorama: as 4 frentes

| Parte | Feature | Quem consome | Telas-chave |
|---|---|---|---|
| **1** | Compartilhamento temporario com prestador | App tutor + portal publico do prestador (web, sem login) | Lista, Novo, Detalhe, Portal do prestador (link) |
| **2** | Plano Familia | App tutor | Tela Familia (abas Usuarios / Pets), sheets de convite/solicitacao/delegacao |
| **3** | Parceiro: identidade, login, equipe, auditoria | Portal do parceiro (web) + admin (CMS) + app tutor (resgate de cupom) | Dashboard parceiro, Equipe, Indicacao, Fila de auditoria (admin) |
| **4** | Carteira e Comissoes | Portal do parceiro (web) + admin (CMS) + app tutor (codigo de indicacao no signup) | Carteira, Extrato, Saque, Liquidacao (admin) |

Os tres mecanismos sao **distintos** (decisao D1 do epico): prestador e um **snapshot congelado** (nao acesso vivo); familia e **membership vivo**; parceiro e **identidade**. Nao tente unificar no client.

---

## 2. Convencoes transversais (LEIA ANTES)

### 2.1 Base URL e ambientes

- A API e a mesma do resto do app/portal (Fastify, NestJS). Use o `api.ts` / cliente HTTP que ja existe.
- Dominios dos **links publicos** (prestador, convite de familia, indicacao) sao montados no servidor via env. Hoje os placeholders sao:
  - `PRESTADOR_BASE_URL` = `https://petjourney.health` -> link do prestador: `{base}/prestador/{codigo}`
  - `FAMILIA_INVITE_BASE_URL` = `https://petjourney.health` -> link de convite: `{base}/familia/convite/{codigo}`
  - `PARCEIRO_INDICACAO_BASE_URL` = `https://app.petjourney.com.br` -> link de indicacao: `{base}/r/{codigoIndicacao}`
- **O front nao monta esses links.** O backend ja devolve o campo `link` pronto. So exiba/compartilhe.

### 2.2 Autenticacao

- Toda rota autenticada usa `Authorization: Bearer {access_token}` (fluxo padrao do `api.ts`).
- O servidor resolve `userId` / `tutorId` / `parceiroId` / `isSystemAdmin` a partir do token. **O client nunca envia esses ids no body.**
- Sem token / token invalido -> **401**.
- Rotas do **portal do parceiro** (`/parceiro/portal/*` e `/admin/parceiro/*`): ver 2.7 (resolucao de parceiro + papel + admin).
- Rotas do **portal publico do prestador** (`/prestador/acesso/*`): **sem JWT**, acesso so por codigo de 6 digitos (ver 2.6).

### 2.3 Envelope de resposta (sucesso)

Toda resposta de sucesso passa pelo `TransformInterceptor` global e sai como:

```jsonc
{
  "statusCode": 200,
  "message": "Operation successful",   // string fixa, exceto familia (ver abaixo)
  "data": { /* ...o payload de fato... */ }
}
```

O corpo util esta sempre em `response.data.data` (a chave `data` do envelope). Listas paginadas vem como `data: { items|data: [...], meta|nextCursor }` (o nome do campo varia por modulo, documentado em cada rota).

**Excecao Familia:** as rotas de **mutacao** de familia devolvem uma `message` customizada e o snapshot em `data`:

```jsonc
{ "statusCode": 201, "message": "Pet adicionado ao plano.", "data": { /* FamiliaSnapshot */ } }
```

As rotas de **leitura** de familia seguem a `message` fixa `"Operation successful"`.

### 2.4 Envelope de erro

Erros NAO sao embrulhados em `data`. O `HttpExceptionFilter` global devolve:

```jsonc
{
  "statusCode": 409,
  "timestamp": "2026-06-29T12:00:00.000Z",
  "path": "/tutor/familia/convites",
  "message": "Familia sem vagas para novos membros."   // localizada (ver 2.5)
}
```

Campos sempre presentes: `statusCode`, `timestamp`, `path`, `message`.

Campos extras por modulo (use para logica programatica, ja que `message` muda de idioma):
- **Familia (negocio):** erros de negocio carregam tambem `reason` com a chave estavel do erro (ex: `"reason": "FEATURE_NOT_INCLUDED"`). **Faca switch no `reason`, nao na `message`.**
- **Validacao de DTO (class-validator):** `statusCode: 400`, `message` pode ser um array de strings com os erros de campo, mais `error: "Bad Request"`.
- **Comissao/saque:** alguns erros trazem um codigo curto no payload (ex: `VALOR_ABAIXO_MINIMO`, `SALDO_INSUFICIENTE`). Confirmar a chave exata no dev antes de depender dela; o estavel e o par `statusCode` + significado descrito na tabela.

### 2.5 Internacionalizacao (i18n)

- Mensagens de erro de negocio sao traduzidas server-side via catalogo (`pt-BR`, `en-US`, `en-GB`, `es-419`). O default e `pt-BR`.
- Para escolher o idioma, mande **um** dos dois (ja deve existir no `api.ts`):
  - query `?lang=en-US`, ou
  - header `Accept-Language: en-US`.
- Idioma nao suportado -> cai em `pt-BR`.
- A rota publica do prestador (`GET /prestador/acesso/:codigo`) tambem respeita o locale e devolve `especieLabel` traduzido.

### 2.6 Codigos publicos de 6 digitos (prestador + convite de familia)

- Codigo e sempre `^\d{6}$`. A rota publica normaliza espacos/hifens antes de validar (`"123 456"` -> `"123456"`).
- Codigo invalido, expirado ou revogado retorna **404 generico** (anti-enumeracao). Nunca vaza se o codigo "existe mas expirou".
- **Rate-limit por IP** nas rotas publicas do prestador (ver tabela na 3.4). Ao estourar -> **429**. Faca backoff/retry com cautela.
- Defesa adicional por codigo (lockout) existe nos convites de familia: **10 req/min por codigo** (nao por IP) em `POST /tutor/familia/convites` e `POST /tutor/familia/convites/:codigo/aceitar`.

### 2.7 Resolucao de parceiro e papel (Partes 3 e 4)

Todas as rotas `/parceiro/portal/*` exigem JWT + ser membro ativo (`ParceiroEquipe` com `status=ACEITO` e `ativo=true`) de um parceiro.

- **`?parceiroId=<id>`** e um query param **opcional**, mas **obrigatorio quando o usuario e membro de mais de um parceiro**. Com 1 so parceiro, pode omitir. Com 2+ e voce omite -> **400** (`parceiroId obrigatorio quando ha mais de um parceiro`).
- O **papel** (`DONO` | `OPERADOR`) vem nos payloads (ex: `dashboard.papel`). Acoes de gestao (convidar/remover membro, PIX, saque, ajuste) exigem `DONO` -> senao **403** (`Apenas o dono pode...`).
- Acesso a parceiro do qual voce nao e membro -> **403** (`Acesso negado a este parceiro`).
- Rotas **admin** (`/admin/parceiro/*` e `/parceiro/auditoria/*`, `/parceiro/:id/auditoria/*`) exigem `isSystemAdmin=true` no token.

### 2.8 Dinheiro: sempre em centavos (Parte 4)

**Todo valor monetario da Parte 4 e `Int` em centavos.** Para exibir em reais: `valor / 100`, formatado com 2 casas (ex: `5000` -> `R$ 50,00`). Nunca assuma float em reais. Campos afetados: `saldoTotalCentavos`, `saldoSacavelCentavos`, `totalSacadoCentavos`, `valorCentavos`, `baseCentavos`.

---

## 3. Parte 1 - Compartilhamento com Prestador

App tutor cria um acesso temporario; o prestador (banho/tosa/consulta/exame/hotel) abre um link com codigo de 6 digitos e ve um **snapshot congelado** das infos escolhidas, devolvendo anotacoes + anexos.

### 3.1 Enums (literais)

```ts
type TipoServicoPrestador = 'BANHO' | 'TOSA' | 'CONSULTA' | 'EXAME' | 'HOTEL' | 'OUTRO';

type CategoriaInfoCompartilhada =
  | 'ALERGIAS' | 'VACINAS' | 'MEDICAMENTOS' | 'PESO'
  | 'COMPORTAMENTO' | 'DIAGNOSTICOS' | 'OBSERVACOES';

type StatusCompartilhamento = 'ATIVO' | 'EXPIRADO' | 'REVOGADO';

type DuracaoHoras = 24 | 48 | 72 | 168;   // valores fixos aceitos

type Especie = 'CACHORRO' | 'GATO' | 'AVE' | 'ROEDOR' | 'COELHO' | 'PEIXE' | 'REPTIL';

// Tipos de documento do anexo. ATENCAO: 'Receita Medica' SEM acento (literal do backend).
type TipoDocumentoAnexo = 'Receita Medica' | 'Exame de Sangue' | 'Raio-X' | 'Ultrassom' | 'Outro';

// MIME aceitos no upload de anexo do prestador:
//   'image/jpeg' | 'image/png' | 'image/webp' | 'image/heic' | 'application/pdf'
```

### 3.2 Modelos

```ts
interface ItemSnapshot { titulo: string; detalhe?: string; destaque?: boolean; }

interface SnapshotPetCompartilhado {
  // Header de identidade: SEMPRE presente (nunca filtrado por categoria)
  // (no objeto raiz do compartilhamento, nao dentro de snapshot, ver shape abaixo)
  pesoKg?: number | null;        // presente se PESO em categorias
  alergias: ItemSnapshot[];      // presente se ALERGIAS
  vacinas: ItemSnapshot[];       // presente se VACINAS  -> detalhe: "Aplicada em DD/MM/YYYY"
  medicamentos: ItemSnapshot[];  // presente se MEDICAMENTOS (fixos com destaque=true primeiro)
  comportamento: ItemSnapshot[]; // presente se COMPORTAMENTO (temperamentos do diario recente)
  diagnosticos: ItemSnapshot[];  // presente se DIAGNOSTICOS (destaque=true)
  observacoesTutor?: string | null; // presente se OBSERVACOES (copia da mensagemTutor)
}

interface CompartilhamentoPet {
  id: string;
  petId: string;
  petNome: string;
  petEspecie: Especie;
  petFoto: string | null;
  petCastrado: boolean | null;   // header de identidade
  codigo: string;                // 6 digitos
  link: string;                  // pronto, ex: https://petjourney.health/prestador/482917
  tipoServico: TipoServicoPrestador;
  servicoOutroLabel: string | null;
  empresaNome: string | null;
  duracaoHoras: number;
  categorias: CategoriaInfoCompartilhada[];
  mensagemTutor: string | null;
  status: StatusCompartilhamento;
  criadoEm: string;              // ISO 8601
  expiraEm: string;              // ISO 8601
  revogadoEm: string | null;
  snapshot: SnapshotPetCompartilhado;
  anotacoes: AnotacaoPrestadorTutor[];
}

interface AnotacaoPrestadorTutor {
  id: string;
  compartilhamentoId: string;
  empresaNome: string;
  profissionalNome: string | null;
  servicoRealizado: string;
  texto: string;
  criadaEm: string;
  lida: boolean;                 // so na visao do tutor
  anexos: AnexoPrestador[];
}

interface AnexoPrestador {
  id: string;
  tipoDocumento: string | null;  // pode vir null (foto solta)
  nome: string;
  mimeType: string;
  tamanhoBytes: number;
  salvoNosDocumentos: boolean;
  documentoId: string | null;
  // NB: o binario NAO vem aqui. Para baixar/preview, peca a signed URL (rota .../url).
}
```

> **Privacidade:** o snapshot e montado **no servidor** so com as categorias selecionadas. O backend nao envia dado de categoria nao escolhida (nao confie so no filtro do client). O snapshot e **congelado na criacao**: mudar peso/vacina do pet depois NAO altera acessos ja emitidos.

### 3.3 Rotas do tutor (autenticadas, prefixo `/tutor/compartilhamentos-prestador`)

| # | Metodo + Path | Status ok | Body | Resposta (`data`) |
|---|---|---|---|---|
| 1 | `GET /tutor/compartilhamentos-prestador` | 200 | - | `{ data: CompartilhamentoPet[], meta }` |
| 2 | `GET /tutor/compartilhamentos-prestador/:id` | 200 | - | `CompartilhamentoPet` |
| 3 | `POST /tutor/compartilhamentos-prestador` | 201 | `CriarCompartilhamento` | `CompartilhamentoPet` (anotacoes vazias) |
| 4 | `DELETE /tutor/compartilhamentos-prestador/:id` | 200 | - | `CompartilhamentoPet` (status REVOGADO) |
| 5 | `PATCH /tutor/compartilhamentos-prestador/:id/anotacoes/lidas` | 200 | - | `CompartilhamentoPet` (todas `lida=true`) |
| 6 | `GET /tutor/compartilhamentos-prestador/:id/anexos/:anexoId/url` | 200 | - | `{ signedUrl, expiresIn: 900 }` |
| 7 | `POST /tutor/compartilhamentos-prestador/:id/anotacoes/:anotacaoId/anexos/:anexoId/salvar-documento` | 201 | `SalvarAnexo` | `{ documentoId, compartilhamento: CompartilhamentoPet }` |

**Query params da rota 1 (todos opcionais):** `status` (`ATIVO`|`EXPIRADO`|`REVOGADO`|`ENCERRADO`), `petNome`, `empresaNome`.

**`meta` da rota 1:** `{ ativos: number, encerrados: number, anotacoesNaoLidas: number, anexosNaoSalvos: number }` (use para badges da home/hero).

**`CriarCompartilhamento` (rota 3):**
```ts
{
  petId: string;                 // obrigatorio, do tutor logado
  tipoServico: TipoServicoPrestador;  // obrigatorio
  servicoOutroLabel?: string;    // obrigatorio SE tipoServico === 'OUTRO'
  empresaNome?: string;          // opcional (trim no server)
  duracaoHoras: 24 | 48 | 72 | 168;   // obrigatorio
  categorias: CategoriaInfoCompartilhada[];  // obrigatorio, min 1
  mensagemTutor?: string;        // opcional (trim); viaja no snapshot se OBSERVACOES
}
```
Limites: max **10** compartilhamentos ATIVO por pet e **50** por tutor.

**`SalvarAnexo` (rota 7):**
```ts
{
  tipoDocumento?: string;  // default: anexo.tipoDocumento ?? 'Outro'
  nome?: string;           // default: anexo.nome
}
```
Cria um documento real no modulo de Documentos do pet, marca `salvoNosDocumentos=true` e preenche `documentoId`. Apos sucesso, invalide o cache de documentos/infos do pet (`invalidatePetInfo(petId)`). Roteamento "maleavel": quando o anexo tem `tipoDocumento`, sugira essa categoria; o tutor sempre confirma na hora de salvar.

**Erros do tutor:**

| Status | Significado |
|---|---|
| 400 | DTO invalido (categorias vazia, duracao fora de {24,48,72,168}, `OUTRO` sem label) |
| 403 | Compartilhamento/pet de outro tutor (ownership) |
| 409 | `PET_INATIVO_COMPARTILHAMENTO` (pet inativo) / `LIMITE_COMPARTILHAMENTOS_ATIVOS` (teto 10/pet ou 50/tutor) / `COMPARTILHAMENTO_JA_ENCERRADO` (revogar item ja encerrado) / `ANEXO_JA_SALVO` / `PET_INDISPONIVEL_SALVAR` |

> Obs: o lookup de recurso de terceiro pelo tutor segue o padrao do repo (403 via OwnershipService). O contrato original sugeria 404 para nao vazar; trate 403/404 como "sem acesso, volte" na UI. Confirmar no dev se algum endpoint especifico devolve 404.

### 3.4 Rotas do prestador (PUBLICAS, sem JWT, prefixo `/prestador/acesso`)

| Metodo + Path | Status ok | Rate-limit (por IP) | Resposta (`data`) |
|---|---|---|---|
| `GET /prestador/acesso/:codigo` | 200 | **20/min** | `SnapshotPublico` (ver abaixo) |
| `GET /prestador/acesso/:codigo/anexos/:anexoId/url` | 200 | **30/min** | `{ signedUrl, expiresIn: 900 }` |
| `POST /prestador/acesso/:codigo/anotacoes` | 201 | **12/min** | `AnotacaoPublica` |

**`SnapshotPublico` (GET por codigo):**
```ts
{
  id: string;
  codigo: string;
  petNome: string;
  especie: Especie;
  especieLabel: string;          // traduzido por locale
  petFoto: string | null;
  petCastrado: boolean | null;
  tipoServico: TipoServicoPrestador;
  servicoOutroLabel: string | null;
  empresaNome: string | null;
  mensagemTutor: string | null;
  categorias: CategoriaInfoCompartilhada[];
  criadoEm: string;
  expiraEm: string;
  snapshot: SnapshotPetCompartilhado;
  anotacoes: Array<{
    id: string; empresaNome: string; profissionalNome: string | null;
    servicoRealizado: string; texto: string; criadaEm: string;
    anexos: Array<{ id; tipoDocumento: string | null; nome; mimeType; tamanhoBytes; salvoNosDocumentos; documentoId }>;
    // NB: a visao publica NAO inclui `lida`.
  }>;
}
```
Nunca retorna `tutorId`, dados do tutor, outros pets, ou categorias nao selecionadas.

**`POST .../anotacoes` e `multipart/form-data`** (parsing raw via Fastify):

| Campo | Tipo | Obrigatorio |
|---|---|---|
| `empresaNome` | text | sim |
| `profissionalNome` | text | nao |
| `servicoRealizado` | text | sim |
| `texto` | text | sim |
| `anexos` | file[] | nao (max **3**) |
| `tiposDocumento` | text (JSON string) | nao; se enviado, **array com length == anexos.length**; cada item em `TipoDocumentoAnexo` ou `null` |

Cada arquivo deve ter MIME em `MIME_ANEXO_PERMITIDOS`. Anotacao nasce `lida=false`; anexos nascem `salvoNosDocumentos=false`.

**Erros publicos:** `400` `ANEXOS_INVALIDOS` (sem body, campo obrigatorio faltando, >3 anexos, MIME/tipo invalido, `tiposDocumento` com length divergente); `404` `PRESTADOR_ACESSO_INVALIDO` (codigo invalido/expirado/revogado ou anexo inexistente); `429` (rate-limit).

### 3.5 Expiracao e estados (front)

- Lazy-expire: ao ler, se `expiraEm <= now` e status ainda `ATIVO`, vira `EXPIRADO`. Codigo expirado/revogado nao abre o portal nem aceita anotacao.
- Historico preservado: compartilhamento encerrado continua na lista do tutor, com anotacoes/anexos visiveis. Detalhe encerrado mostra codigo/link como historico, sem acoes de compartilhar/revogar.
- Estados de tela: loading, empty ativos, empty historico, empty filtrado, error+retry. Notas novas: badge `NOVA` (use `anotacoes[].lida === false`). Anexo nao salvo: CTA para salvar nos documentos.

---

## 4. Parte 2 - Plano Familia

Lider Premium compartilha o plano com ate 4 convidados (max 5 membros). Convite por **codigo** (lider digita o codigo do convidado) e por **link** (convidado abre o link do lider). Convidado herda Pro enquanto membro ativo. Todos os membros leem todos os pets do plano; mutacao fica no dono, salvo **delegacao temporaria** (escrita create-only).

App tutor, prefixo `/tutor/familia`. Todas as rotas exigem JWT. A maioria passa pelo `FamiliaGatingGuard` (403 se nao elegivel).

### 4.1 Enums e limites

```ts
type FamiliaRole = 'LIDER' | 'CONVIDADO';
type FamiliaStatus = 'ATIVA' | 'SUSPENSA';   // SUSPENSA = lider caiu de Premium (em carencia)
type ConviteTipo = 'LINK_LIDER' | 'CODIGO_CONVIDADO';  // link = multi-uso; codigo = uso unico
type SolicitacaoStatus = 'PENDENTE' | 'APROVADA' | 'RECUSADA';

// Limites (default; backend e a fonte da verdade, vem em snapshot.limites):
//   maxMembros = 5 (inclui o lider)
//   maxPetsLider = 5
//   maxPetsConvidado = 2   <- ATENCAO: backend usa 2, o mock original dizia 3
// Carencia apos queda do lider: 7 dias (FAMILIA_CARENCIA_DIAS). TTL de convite: 30 dias.
// Duracoes de delegacao aceitas (horas): 24 | 72 | 168 | 336.
```

### 4.2 Snapshot da familia (a tela inteira sai daqui)

`GET /tutor/familia` -> 200, `data`:

```ts
interface FamiliaSnapshot {
  id: string;
  liderId: string | null;             // MembroFamilia.id do lider
  status: FamiliaStatus;
  suspensaEm: string | null;
  carenciaAte: string | null;         // ISO; durante carencia o convidado ainda herda Pro
  viewer: {
    membroId: string | null;
    role: FamiliaRole | null;
    isLider: boolean;
    podeConvidar: boolean;
  };
  limites: { maxMembros: number; maxPetsLider: number; maxPetsConvidado: number; };
  membros: Array<{
    id: string; usuarioId: string; tutorId: string;
    nome: string;
    contato: string;                  // email do membro (PII visivel a membros; ver nota)
    foto: string | null;             // placeholder, hoje sempre null
    role: FamiliaRole;
    entrouEm: string;
    pets: Array<{
      id: string;                     // petId real (navegavel para o perfil do pet)
      nome: string; especie: string; foto: string | null;
      donoId: string;                 // MembroFamilia.id do dono
      donoNome: string;
      vinculadoEm: string;
    }>;
  }>;
  solicitacoes: Array<{               // somente PENDENTE no snapshot
    id: string; membroId: string; membroNome: string;
    petId: string; petNome: string; petEspecie: string; petFoto: string | null;
    status: SolicitacaoStatus;
    criadaEm: string; respondidaEm: string | null; respondidaPorMembroId: string | null;
  }>;
  delegacoes: Array<{                 // somente ativas (revogadaEm null)
    id: string; petId: string;
    donoMembroId: string; delegadoMembroId: string;
    expiraEm: string | null;          // null = indefinida
    ativa: boolean;
  }>;
  meta: {
    totalMembros: number; totalPets: number;
    solicitacoesPendentes: number; vagasMembrosRestantes: number;
  };
}
```

> O snapshot e a unica fonte: nao faca queries paralelas. Toda **mutacao** devolve o snapshot atualizado em `data` (substitua o estado local direto).

### 4.3 As 12 rotas

| # | Metodo + Path | Status ok | Body | Quem pode |
|---|---|---|---|---|
| 2.1 | `GET /tutor/familia` | 200 | - | membro / Premium elegivel |
| 2.2 | `GET /tutor/familia/convite` | 200 | - | qualquer (gera/reusa codigo+link) |
| 2.3 | `POST /tutor/familia/convites` | 201 | `{ codigo: string }` (`^\d{6}$`) | lider (gating) |
| 2.4 | `POST /tutor/familia/convites/:codigo/aceitar` | 201 | - | convidado |
| 2.5 | `POST /tutor/familia/pets` | 201 (lider) / 202 (convidado) | `{ petId: string }` | membro |
| 2.6 | `GET /tutor/familia/pets-disponiveis` | 200 | - | membro |
| 2.7 | `PATCH /tutor/familia/solicitacoes/:id/aprovar` | 200 | - | lider |
| 2.8 | `PATCH /tutor/familia/solicitacoes/:id/recusar` | 200 | - | lider |
| 2.9 | `DELETE /tutor/familia/pets/:petId` | 200 | - | dono do pet ou lider |
| 2.10 | `DELETE /tutor/familia/membros/:membroId` | 200 | - | lider (nao pode remover lider) |
| 2.11 | `POST /tutor/familia/pets/:petId/delegacoes` | 201 | `CriarDelegacao` | dono do pet |
| 2.12 | `DELETE /tutor/familia/pets/:petId/delegacoes/:delegacaoId` | 200 | - | dono ou lider |

**2.2 resposta:** `{ codigo, link, tipo: ConviteTipo, expiraEm }`. `tipo=LINK_LIDER` para lider (multi-uso, nao consome no aceite); `tipo=CODIGO_CONVIDADO` para o resto (uso unico, consumido no `POST /convites`).

**2.5 `POST /pets`:** lider -> 201 `{ message, data, pendente: false }`; convidado -> **202** `{ message, data, pendente: true }` (cria solicitacao). O front deve ramificar no `pendente`.

**2.6 `pets-disponiveis` resposta:** `Array<{ id, nome, especie, foto }>` (pets ativos do tutor ainda nao vinculados nem com solicitacao pendente).

**2.11 `CriarDelegacao`:**
```ts
{
  delegadoMembroId: string;            // membro da familia que recebe a escrita
  duracaoHoras?: 24 | 72 | 168 | 336;  // opcional; default 24 se nada vier
  indefinida?: boolean;                // se true, ignora duracaoHoras (expiraEm = null)
}
```
A delegacao da **create-only**: o delegado pode CRIAR registros novos (diario, medicamento, vacina, peso, documento) do pet. Nao edita nem deleta existentes, nao deleta o pet, nao mexe na familia. Revogavel a qualquer momento (2.12). Indicacao visual sugerida: "Acesso concedido por {donoNome}, expira em {data}".

### 4.4 Heranca de plano (convidado herda Pro)

- Convidado de familia **ATIVA** (ou **SUSPENSA** dentro da carencia) com lider Premium herda **Pro (nivel 2)**, resolvido server-side em `subscription.getNivelForTutor`. Nao ha cobranca extra, nao toca a assinatura de loja.
- **Nao existe campo explicito "nivelHerdado" no snapshot.** O front deduz pela combinacao: `viewer.role === 'CONVIDADO'` + `status === 'ATIVA'` -> Pro herdado. O nivel efetivo chega pelo mesmo canal de subscription que o resto do app ja usa (`level = 2`).
- **Carencia:** se o lider perde Premium, `status` vira `SUSPENSA` e `carenciaAte = now + 7d`. Durante a carencia o convidado mantem Pro. Apos `carenciaAte`, rebaixa. UI sugerida: banner "Plano familiar suspenso, acesso Pro expira em {carenciaAte}".

### 4.5 Leitura de prontuario por familia (atras de flag)

- Com `FAMILIA_LEITURA_PRONTUARIO=true`, membros de familia ATIVA (ou em carencia) leem (read-only) o prontuario dos pets do plano: `GET /pet/:id`, e os GET de vacina/consulta/diario/medicamento/peso/documento/etc do pet.
- Mutacao continua restrita ao dono (ou delegado via 2.11, que nao e gated por essa flag).
- **Default em prod: `false`.** Enquanto off, o membro nao-dono recebe 403 nesses GETs. So construa a UI de "ver prontuario do pet da familia" assumindo que a flag pode estar off (degrade para "sem acesso").
- **PII:** o email do dono aparece em `snapshot.membros[].contato` e e visivel a todos os membros (nao ha redacao automatica nesse campo). Decida no front como exibir.

### 4.6 Erros da familia (todos trazem `reason` estavel)

Switch no `reason` (a `message` e localizada):

| Status | `reason` | Quando |
|---|---|---|
| 403 | `FEATURE_NOT_INCLUDED` | Freemium / sem membership tenta acessar familia |
| 403 | `LEADER_NOT_PREMIUM` | aceitar link de lider suspenso fora da carencia |
| 403 | `NOT_LEADER` | convidado tenta acao de lider (aprovar, remover membro) |
| 404 | `INVITE_NOT_FOUND` | codigo/link invalido, expirado ou consumido (generico) |
| 404 | `REQUEST_NOT_FOUND` / `MEMBER_NOT_FOUND` / `FAMILY_PET_NOT_FOUND` / `DELEGATION_NOT_FOUND` | alvo inexistente no plano |
| 409 | `ALREADY_MEMBER` / `ALREADY_IN_ANOTHER_FAMILY` | convidado ja na familia / ja em outra |
| 409 | `CANNOT_INVITE_SELF` / `CANNOT_REMOVE_LEADER` / `DELEGATION_TO_SELF` | regra de papel |
| 409 | `FAMILY_FULL` / `PET_LIMIT_REACHED` | sem vaga de membro / limite de pets (vinculados+pendentes) |
| 409 | `PET_ALREADY_LINKED` / `PET_REQUEST_PENDING` | pet ja no plano / ja tem solicitacao |
| 409 | `REQUEST_NOT_PENDING` / `DELEGATION_ALREADY_ACTIVE` | solicitacao ja respondida / delegacao duplicada |
| 429 | (throttle) | 10 req/min por codigo em convidar/aceitar |

---

## 5. Parte 3 - Parceiro: Portal, Equipe, Auditoria e Resgate de Cupom

Portal do parceiro (web) para o parceiro logado; telas admin (CMS) para auditoria; e o resgate de cupom no app tutor. Ver 2.7 para resolucao de parceiro/papel/admin.

### 5.1 Enums

```ts
type StatusAuditoriaParceiro = 'PENDENTE' | 'APROVADO' | 'REJEITADO' | 'SUSPENSO';
type PapelParceiro = 'DONO' | 'OPERADOR';
type StatusConviteEquipe = 'PENDENTE' | 'ACEITO' | 'RECUSADO';
type CupomCategoria = 'PETSHOP' | 'VETERINARIO' | 'FARMACIA' | 'BANHO_TOSA' | 'NUTRICAO';
type CanalResgate = 'QR' | 'CODIGO_MANUAL';
```

### 5.2 Portal do parceiro (JWT + ParceiroGuard, prefixo `/parceiro/portal`)

| Metodo + Path | Status ok | Resposta (`data`) |
|---|---|---|
| `GET /parceiro/portal/dashboard` | 200 | `{ parceiro: { id, nome, logoUrl, statusAuditoria, motivoAuditoria, cnpj }, papel, totais: { cuponsAtivos, resgatesTotal, resgatesUltimos30d } }` |
| `GET /parceiro/portal/status` | 200 | `{ statusAuditoria, motivoAuditoria?, auditadoEm?, podeOperar }` |
| `GET /parceiro/portal/indicacao` | 200 | `{ codigoIndicacao, link, qrCodeDataUrl, podeIndicar, aviso? }` |
| `GET /parceiro/portal/cupons` | 200 | `{ data: CupomParceiro[], meta: { proximoCursor? } }` |
| `GET /parceiro/portal/resgates` | 200 | `{ data: ResgateParceiro[], meta: { proximoCursor? } }` |
| `POST /parceiro/portal/equipe/convites` | 201 | `{ parceiroId, usuarioId, papel, status: 'PENDENTE' }` |
| `PATCH /parceiro/portal/equipe/convites/aceitar` | 200 | `{ parceiroId, status: 'ACEITO' }` |
| `DELETE /parceiro/portal/equipe/:usuarioId` | 204 | - |

Query params comuns: `parceiroId?` (ver 2.7); paginacao cursor-based em `cupons`/`resgates`: `cursor?`, `limit?` (default 20, max 50).

```ts
interface CupomParceiro {
  id: string; codigo: string; titulo: string; descontoPercentual: number;
  categoria: CupomCategoria; validoAte: string; ativo: boolean; usoUnico: boolean;
  totalResgates: number; usosRestantes?: number;  // usosRestantes omitido se ilimitado ou usoUnico
}
interface ResgateParceiro {
  resgateId: string; cupomCodigo: string; canal: CanalResgate;
  descontoPercentualSnapshot?: number; resgatadoEm: string;
  // SEM PII de tutor por design.
}
```

**Indicacao (identidade, D15):** `codigoIndicacao` e um codigo de ~10 chars base32 (alfabeto `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`, sem 0/O/1/I/L), gerado **lazy** na primeira leitura, imutavel. `link = {PARCEIRO_INDICACAO_BASE_URL}/r/{codigoIndicacao}`. `qrCodeDataUrl` e um data URL (PNG) ou `null` se a geracao falhar. `podeIndicar=true` so se `statusAuditoria=APROVADO` e ativo; senao vem `aviso` ("Seu cadastro ainda esta em analise..."). O **consumo/comissao** dessa indicacao e a Parte 4.

**Equipe:**
- `POST .../equipe/convites` exige `DONO` e parceiro operavel. Body: `{ email: string, papel: PapelParceiro }`. Conflitos -> 409 (`Parceiro nao operavel`, `Parceiro ja tem esse membro`); usuario inexistente -> 404.
- `PATCH .../equipe/convites/aceitar` e fora do ParceiroGuard (o convidado ainda esta PENDENTE): `parceiroId` e **obrigatorio** aqui. 404 se nao ha convite PENDENTE.
- `DELETE .../equipe/:usuarioId` (DONO): soft-delete; **409 se for o ultimo DONO** (`Parceiro precisa de pelo menos um dono`).

### 5.3 Admin: auditoria de parceiro (JWT + SystemAdmin)

Prefixo no modulo de cupom (`/parceiro`):

| Metodo + Path | Status ok | Body | Resposta |
|---|---|---|---|
| `GET /parceiro/auditoria/fila` | 200 | - (query `status?`) | `ParceiroAdmin[]` (orderby createdAt desc, sem paginacao) |
| `POST /parceiro/:id/auditoria/aprovar` | 201 | - | `ParceiroAdmin` (APROVADO) |
| `POST /parceiro/:id/auditoria/rejeitar` | 201 | `{ motivo: string }` (min 3) | `ParceiroAdmin` (REJEITADO) |
| `POST /parceiro/:id/auditoria/suspender` | 201 | `{ motivo: string }` (min 3) | `ParceiroAdmin` (SUSPENSO) |

`ParceiroAdmin` inclui `statusAuditoria`, `motivoAuditoria`, `auditadoPorId`, `auditadoEm`, `cnpj`, `codigoIndicacao`, `comissaoPercentual`. Aprovar exige >= 1 DONO ACEITO ativo, senao 409.

### 5.4 Resgate de cupom (app tutor)

`POST /tutor/cupons/:id/resgatar` -> 201, body `{ canal: CanalResgate }`.

Resposta `data`:
```ts
{ resgateId: string; cupomId: string; codigo: string; descontoPercentual: number;
  parceiro: string; jaResgatado: false; usosRestantes?: number; }
```
- Decrementa estoque atomicamente. Cupom esgotado -> **409** (`Cupom esgotado`). Cupom de uso unico ja resgatado pelo mesmo tutor -> **409** (`Cupom de uso unico ja resgatado`). Cupom inexistente/inelegivel -> **404**.
- Cupom e so desconto de loja: **nao gera comissao** (comissao vem de indicacao, Parte 4). O resgate fica atribuido ao parceiro (visivel em `GET /parceiro/portal/resgates`).

---

## 6. Parte 4 - Carteira e Comissoes

Programa de indicacao: tutor que se cadastra com o codigo de um parceiro fica atribuido; quando assina (apos trial), o parceiro ganha 5% por ate 18 meses. Carteira estilo banco (saldo + extrato), saque PIX liquidado pelo admin. **Tudo em centavos (2.8).**

Portal do parceiro (JWT + ParceiroGuard, prefixo `/parceiro/portal`); admin (JWT + SystemAdmin, prefixo `/admin/parceiro`); atribuicao no signup (`POST /usuario`).

### 6.1 Enums

```ts
type TipoTransacaoParceiro = 'CREDITO_COMISSAO' | 'ESTORNO' | 'DEBITO_SAQUE' | 'AJUSTE';
type OrigemComissao = 'INITIAL_PURCHASE' | 'RENEWAL' | 'UPGRADE' | 'REFUND';
type PeriodicidadeComissao = 'MENSAL' | 'ANUAL';
type StatusSaque = 'PENDENTE' | 'PAGO' | 'FALHA';
```

### 6.2 Carteira e saque (portal do parceiro)

| Metodo + Path | Status ok | Body | Resposta (`data`) |
|---|---|---|---|
| `GET /parceiro/portal/carteira` | 200 | - | `Carteira` |
| `GET /parceiro/portal/carteira/extrato` | 200 | - (`cursor?`, `limit?`) | `{ items: Transacao[], nextCursor: string \| null }` |
| `PATCH /parceiro/portal/carteira/pix` | 200 | `{ chavePix: string }` | `{ parceiroId, chavePix }` |
| `POST /parceiro/portal/saques` | 201 | `{ valorCentavos: number }` | `{ id, valorCentavos, status: 'PENDENTE', createdAt }` |
| `GET /parceiro/portal/saques` | 200 | - | `SaqueResumo[]` |
| `GET /parceiro/portal/saques/:id` | 200 | - | `SaqueDetalhe` |

```ts
interface Carteira {
  saldoTotalCentavos: number;      // inclui credito em hold
  saldoSacavelCentavos: number;    // total menos creditos em hold (14 dias)
  chavePix: string | null;
  totalSacadoCentavos: number;
  bloqueadoParaSaque: boolean;     // true se em revisao antifraude OU saldo < 0
}
interface Transacao {              // allow-list, sem PII/auditoria interna
  id: string; tipo: TipoTransacaoParceiro; valorCentavos: number;  // negativo = debito
  periodicidade: PeriodicidadeComissao | null; origem: OrigemComissao | null;
  createdAt: string;
}
interface SaqueResumo { id; valorCentavos; status: StatusSaque; createdAt; liquidadoEm: string | null; motivoFalha: string | null; }
interface SaqueDetalhe extends SaqueResumo { chavePixSnapshot: string; comprovante: string | null; }
```

**`POST /saques` (DONO):** valida, em ordem, `valorCentavos >= 5000` (R$50), chave PIX cadastrada, sem revisao antifraude, saldo nao-negativo, e `valorCentavos <= saldoSacavelCentavos`. Debita atomicamente e cria saque `PENDENTE`. Erros mapeaveis (todos contexto de saque): `400` valor abaixo do minimo / PIX nao cadastrado / saldo insuficiente / saldo negativo a compensar; `403` saque bloqueado para revisao.

> **Ciclo do saque:** corte dia 27, pagamento ate dia 5. Hoje e **orientacional/UI** (admin liquida manual); o backend nao bloqueia por data. Hold de **14 dias** por credito (janela de chargeback) ja esta refletido em `saldoSacavelCentavos`.

UI de bloqueio: avise quando `bloqueadoParaSaque=true`, `saldoSacavelCentavos=0` (tudo em hold/vazio), ou `chavePix=null`.

### 6.3 Admin: liquidacao e ajustes (prefixo `/admin/parceiro`)

| Metodo + Path | Body | Resposta |
|---|---|---|
| `GET /admin/parceiro/saques` | - (`status?`) | `ParceiroSaque[]` (fila) |
| `POST /admin/parceiro/saques/:id/pagar` | `{ comprovante?: string }` | `{ id, status: 'PAGO', liquidadoEm }` |
| `POST /admin/parceiro/saques/:id/falhar` | `{ motivoFalha: string }` | `{ id, status: 'FALHA' }` (estorna o debito) |
| `POST /admin/parceiro/:parceiroId/carteira/ajuste` | `{ valorCentavos: number, motivo: string }` | `{ parceiroId, valorCentavos, refEvento }` |
| `POST /admin/parceiro/:parceiroId/carteira/revisao` | `{ emRevisao: boolean, motivo: string }` | `{ parceiroId, emRevisaoAntifraude }` |

`pagar` exige saque `PENDENTE` (409 senao) e bloqueia se saldo do parceiro < 0. `falhar` estorna o valor de volta a carteira. `ajuste` tem guard-rails: `valorCentavos != 0` e `abs <= AJUSTE_MAX_CENTAVOS` (default R$10.000). `revisao` liga/desliga o bloqueio antifraude de saque.

### 6.4 Atribuicao no signup (`POST /usuario`)

O cadastro aceita um campo opcional novo:

```ts
// adicione ao body de POST /usuario:
codigoIndicacao?: string;   // opcional, maxLength 20; o server faz trim + UPPERCASE
```
- Lookup best-effort: se o codigo casa um `Parceiro` APROVADO, grava `referidoPorParceiroId` (unico, imutavel). **Codigo invalido NAO quebra o cadastro** (segue normal).
- Nao valide client-side alem de `maxLength=20`. Nao ha endpoint de "validar codigo" antes do signup nesta versao.
- A resposta de `/usuario` NAO expoe `referidoPorParceiroId`.

### 6.5 Constantes que o front exibe

| Constante | Valor default | Observacao |
|---|---|---|
| Percentual de comissao | 5% | por parceiro pode variar (`comissaoPercentual`); o credito ja vem calculado |
| Minimo de saque | R$50 (5000 centavos) | fixo |
| Hold de credito | 14 dias | ja refletido em `saldoSacavelCentavos` |
| Janela de elegibilidade | 18 meses | desde a primeira conversao paga |
| Teto de ajuste admin | R$10.000 | guard-rail |

---

## 7. Divergencias vs. os contratos originais (.txt)

O front montou os mocks a partir dos `.txt`. O backend divergiu nos pontos abaixo. **Ajuste o client a estes:**

**Prestador:**
- Tipo de documento `'Receita Medica'` e **sem acento** no backend (o `.txt` usava "Receita Médica"). Idem use exatamente `'Exame de Sangue'`, `'Raio-X'`, `'Ultrassom'`, `'Outro'`.
- O binario do anexo **nao vem** no payload (`AnexoPrestador` nao tem `uri`). Para baixar/preview, chame a rota `.../anexos/:anexoId/url` e use a `signedUrl` (TTL 900s).
- A visao publica das anotacoes nao inclui `lida`.
- Header de identidade do pet inclui `petCastrado` (alem de nome/especie/foto).
- Limites concretos: 10 ativos por pet, 50 por tutor.

**Familia:**
- `maxPetsConvidado = 2` (o `.txt` dizia 3).
- Familia e beneficio **exclusivo do Premium**; Freemium nao pode ser lider. Gating retorna 403 `FEATURE_NOT_INCLUDED`.
- O snapshot tem campos extras nao previstos no mock: `status`, `suspensaEm`, `carenciaAte`, `delegacoes[]`. Use-os para carencia e delegacao.
- Convite tem **tipo** (`LINK_LIDER` multi-uso vs `CODIGO_CONVIDADO` uso unico). O endpoint de aceite por link nao consome o codigo.
- Existe **delegacao temporaria** (rotas 2.11/2.12), inexistente no `.txt`.
- `GET /tutor/familia/convite` nao retorna so codigo: retorna `{ codigo, link, tipo, expiraEm }`.

**Parceiro / Carteira:** nao havia `.txt` (frente nova). Tudo nas secoes 5 e 6.

---

## 8. Estado de rollout / flags / pendencias

| Item | Flag / env | Default | Efeito no front |
|---|---|---|---|
| Leitura de prontuario por familia | `FAMILIA_LEITURA_PRONTUARIO` | `false` | Enquanto off, membro nao-dono recebe 403 nos GET de prontuario do pet da familia |
| Credito de comissao (indicacao) | `COMISSAO_INDICACAO_ENABLED` | `false` | Enquanto off, nenhum credito e gerado; carteira fica zerada mesmo com indicacoes |
| Comissao anual | `COMISSAO_ANUAL_ENABLED` | `false` | so afeta base de calculo (server-side) |
| Clawback (estorno) | `COMISSAO_CLAWBACK_ENABLED` | `false` | estorno de reembolso so com a flag on |
| Dominios dos links publicos | `PRESTADOR_BASE_URL` / `FAMILIA_INVITE_BASE_URL` / `PARCEIRO_INDICACAO_BASE_URL` | placeholders | o backend ja devolve `link` pronto; confirmar dominio real antes do deploy publico |

Pendencias conhecidas (nao bloqueiam a integracao, mas alinhe expectativa):
- Convite/membership/heranca de familia funcionam **independente** da flag de prontuario.
- Defesa por codigo cross-instancia (Redis/lockout) das rotas publicas e DoD antes de prod; o rate-limit por IP ja vale.
- Saque e liquidado manualmente por admin nesta onda (sem integracao bancaria automatica).

---

## 9. Checklists de integracao por superficie

**App tutor - Prestador (Parte 1):**
- [ ] Service: listar/detalhe/criar/revogar/marcar-lidas/salvar-anexo + (portal publico do prestador, se for tela web separada).
- [ ] Tratar envelope (`response.data.data`), `meta` da lista para badges.
- [ ] Enviar `CriarCompartilhamento` com `duracaoHoras` em {24,48,72,168} e >=1 categoria; `OUTRO` exige `servicoOutroLabel`.
- [ ] Download de anexo: pedir `signedUrl` (TTL 900s), nao guardar o link.
- [ ] Tipos de documento literais (`'Receita Medica'` sem acento).
- [ ] Apos salvar anexo nos documentos: invalidar infos/documentos do pet.

**App tutor - Familia (Parte 2):**
- [ ] Toda tela sai do `FamiliaSnapshot`; toda mutacao devolve snapshot atualizado.
- [ ] Ramificar `POST /pets` por `pendente` (201 lider vs 202 convidado).
- [ ] Convite: usar `tipo` + `link` prontos; tratar throttle por codigo (429).
- [ ] Erros: switch no `reason`, nao na `message`.
- [ ] Carencia: banner quando `status='SUSPENSA'` e `now < carenciaAte`.
- [ ] Delegacao (2.11/2.12) se a tela cobrir "deixei o pet com fulano".
- [ ] Prontuario do pet da familia: degrade para "sem acesso" se a flag estiver off (403).

**Portal do parceiro (Partes 3 e 4):**
- [ ] Mandar `parceiroId` quando o usuario tem 2+ parceiros (senao 400).
- [ ] Gatekeep de acoes por `papel === 'DONO'`.
- [ ] Indicacao: exibir `codigoIndicacao`, `link`, `qrCodeDataUrl`; respeitar `podeIndicar`/`aviso`.
- [ ] Carteira/extrato/saque: TODO valor em **centavos** (dividir por 100). Paginacao por `nextCursor`/`proximoCursor`.
- [ ] Saque: bloquear UI por `bloqueadoParaSaque`, `saldoSacavelCentavos=0`, `chavePix=null`; minimo R$50.

**App tutor - signup (Parte 4):**
- [ ] Campo opcional `codigoIndicacao` no `POST /usuario` (capturar de deep link `/r/{codigo}` se houver). Nao bloquear cadastro por codigo invalido.

**Admin (CMS):**
- [ ] Fila de auditoria + aprovar/rejeitar/suspender (motivo min 3).
- [ ] Fila de saques + pagar (comprovante)/falhar (motivo)/ajuste/revisao.

---

## 10. Mapa rapido de rotas (referencia)

```
# Parte 1 - Prestador (app tutor)
GET    /tutor/compartilhamentos-prestador
GET    /tutor/compartilhamentos-prestador/:id
POST   /tutor/compartilhamentos-prestador
DELETE /tutor/compartilhamentos-prestador/:id
PATCH  /tutor/compartilhamentos-prestador/:id/anotacoes/lidas
GET    /tutor/compartilhamentos-prestador/:id/anexos/:anexoId/url
POST   /tutor/compartilhamentos-prestador/:id/anotacoes/:anotacaoId/anexos/:anexoId/salvar-documento
# Parte 1 - Prestador (publico, sem JWT)
GET    /prestador/acesso/:codigo
GET    /prestador/acesso/:codigo/anexos/:anexoId/url
POST   /prestador/acesso/:codigo/anotacoes        (multipart)

# Parte 2 - Familia (app tutor)
GET    /tutor/familia
GET    /tutor/familia/convite
POST   /tutor/familia/convites
POST   /tutor/familia/convites/:codigo/aceitar
POST   /tutor/familia/pets
GET    /tutor/familia/pets-disponiveis
PATCH  /tutor/familia/solicitacoes/:id/aprovar
PATCH  /tutor/familia/solicitacoes/:id/recusar
DELETE /tutor/familia/pets/:petId
DELETE /tutor/familia/membros/:membroId
POST   /tutor/familia/pets/:petId/delegacoes
DELETE /tutor/familia/pets/:petId/delegacoes/:delegacaoId

# Parte 3 - Parceiro portal (JWT + ParceiroGuard)
GET    /parceiro/portal/dashboard
GET    /parceiro/portal/status
GET    /parceiro/portal/indicacao
GET    /parceiro/portal/cupons
GET    /parceiro/portal/resgates
POST   /parceiro/portal/equipe/convites
PATCH  /parceiro/portal/equipe/convites/aceitar
DELETE /parceiro/portal/equipe/:usuarioId
# Parte 3 - Admin auditoria (JWT + SystemAdmin)
GET    /parceiro/auditoria/fila
POST   /parceiro/:id/auditoria/aprovar
POST   /parceiro/:id/auditoria/rejeitar
POST   /parceiro/:id/auditoria/suspender
# Parte 3 - Resgate de cupom (app tutor)
POST   /tutor/cupons/:id/resgatar

# Parte 4 - Carteira (JWT + ParceiroGuard)
GET    /parceiro/portal/carteira
GET    /parceiro/portal/carteira/extrato
PATCH  /parceiro/portal/carteira/pix
POST   /parceiro/portal/saques
GET    /parceiro/portal/saques
GET    /parceiro/portal/saques/:id
# Parte 4 - Admin saque (JWT + SystemAdmin)
GET    /admin/parceiro/saques
POST   /admin/parceiro/saques/:id/pagar
POST   /admin/parceiro/saques/:id/falhar
POST   /admin/parceiro/:parceiroId/carteira/ajuste
POST   /admin/parceiro/:parceiroId/carteira/revisao
# Parte 4 - Atribuicao no signup
POST   /usuario   (campo opcional: codigoIndicacao)
```

---

## Change Log

| Data | Versao | Mudanca | Autor |
|---|---|---|---|
| 2026-06-29 | 1.0 | Contrato frontend consolidado das Partes 1-4 a partir do codigo real (controllers/services), com divergencias vs. os .txt originais e estado de flags | Claude + Nicolas |
