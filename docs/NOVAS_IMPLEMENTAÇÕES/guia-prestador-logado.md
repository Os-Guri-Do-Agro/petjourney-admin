# Spec Frontend: Parte 8 — Prestador com Conta (compartilhamento no app do vet e no painel do vet)

**Status:** Backend LIVE em dev (migration aplicada; smoke 22/22). Pronto pra integrar.
**Criado em:** 2026-07-14
**Spec backend:** [08-prestador-com-conta.md](08-prestador-com-conta.md)
**Contrato geral do épico:** [frontend.md](frontend.md) (envelope, auth, erros, i18n)
**Plataformas alvo:** **app do vet** (`petjourney-app`, aba `(tabs)/veterinario`) e **painel web do parceiro** (`web.petjourney.health`). Mais um aditivo pequeno no **app do tutor** (seção 7).

> Este doc é auto-suficiente: uma IA de código pode implementar a UI a partir daqui. As duas superfícies (app do vet e painel web) consomem exatamente as mesmas rotas.

---

## 0. O que é a feature (em 3 linhas)

O tutor gera um compartilhamento temporário do pet (código de 6 dígitos, Parte 1). Hoje o prestador abre por link público sem login. Agora o prestador **com conta de parceiro** pode **vincular** esse código a si: o compartilhamento passa a aparecer na lista dele (app do vet / painel web), com detalhe, histórico e **anotações autenticadas** (a empresa sai do cadastro, sem digitar). O link público continua funcionando igual para quem não tem conta.

Regra de ouro (D8.2): **login não amplia dado**. O vet logado vê exatamente o que o link público mostra; os ganhos são organização (lista/histórico), autoria automática e não depender do link no WhatsApp.

---

## 1. Convenções (vale pra todas as rotas)

- **Auth:** `Authorization: Bearer {token}` (conta normal de Usuario). Rotas exigem JWT + ser membro **ACEITO e ativo** de um parceiro (mesmo guard do portal).
- **`?parceiroId=<id>`:** opcional, mas **obrigatório se o usuário é membro de 2+ parceiros**. Com 1 só, pode omitir. Com 2+ omitido → **400** (`parceiroId obrigatorio quando ha mais de um parceiro`).
- **Papel:** DONO e OPERADOR podem tudo nesta feature (vincular, ver, anotar). Não há ação exclusiva de DONO.
- **Envelope de sucesso:** `{ statusCode, message, data }` → o corpo útil está em `response.data.data`.
- **Envelope de erro:** `{ statusCode, timestamp, path, message }`. A `message` vem **localizada** pelo `Accept-Language` (pt-BR, en-US, en-GB, es-419); trate pelo **statusCode + contexto da rota**, não por string.
- **Datas:** ISO 8601 UTC.

---

## 2. Enums e tipos (literais — casar exatamente)

```ts
type StatusCompartilhamento = 'ATIVO' | 'EXPIRADO' | 'REVOGADO'

type TipoServicoPrestador = 'BANHO' | 'TOSA' | 'CONSULTA' | 'EXAME' | 'HOTEL' | 'OUTRO'

type CategoriaInfoCompartilhada =
  | 'ALERGIAS'
  | 'VACINAS'
  | 'MEDICAMENTOS'
  | 'PESO'
  | 'COMPORTAMENTO'
  | 'DIAGNOSTICOS'
  | 'OBSERVACOES'

// Tipos de documento aceitos no anexo (ou null = sem classificação):
type TipoDocumentoAnexo = 'Receita Medica' | 'Exame de Sangue' | 'Raio-X' | 'Ultrassom' | 'Outro'

interface ItemSnapshot {
  titulo: string
  detalhe?: string
  destaque?: boolean
}

/** Snapshot CONGELADO na criação, já filtrado pelas categorias que o tutor escolheu.
 *  Campo ausente = categoria não compartilhada (não renderizar a seção). */
interface SnapshotPetCompartilhado {
  pesoKg?: number | null
  alergias: ItemSnapshot[]
  vacinas: ItemSnapshot[]
  medicamentos: ItemSnapshot[]
  comportamento: ItemSnapshot[]
  diagnosticos: ItemSnapshot[]
  observacoesTutor?: string | null
}

interface AnexoAnotacao {
  id: string
  tipoDocumento: string | null
  nome: string
  mimeType: string
  tamanhoBytes: number
  salvoNosDocumentos: boolean // relevante só pro tutor
  documentoId: string | null
}

interface Anotacao {
  id: string
  empresaNome: string
  profissionalNome: string | null
  servicoRealizado: string
  texto: string
  criadaEm: string
  anexos: AnexoAnotacao[]
}
```

---

## 3. Endpoints — parceiro logado (`parceiro/portal/compartilhamentos`)

### 3.1 Vincular (claim) pelo código

```http
POST /parceiro/portal/compartilhamentos/vincular?parceiroId={id}
Content-Type: application/json

{ "codigo": "123456" }
```

O código aceita espaços/hífens (`"123-456"`, `" 123 456 "`); o backend normaliza. **Idempotente**: re-vincular o mesmo código pelo mesmo parceiro devolve 200 de novo.

Resposta **200** (`data`): o **detalhe completo** (mesmo shape da 3.3, caso ATIVO).

| Status                           | Quando                                                                                             | UI                                                              |
| -------------------------------- | -------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| 400                              | código não tem 6 dígitos (validação de DTO)                                                        | erro inline no input                                            |
| 404                              | código inexistente, **expirado** ou **revogado** (resposta genérica de propósito, anti-enumeração) | "Código inválido ou expirado. Confira com o tutor."             |
| 409                              | código já vinculado a **outra** empresa                                                            | "Este acesso já está vinculado a outra empresa."                |
| 403 (`PARCEIRO_NAO_OPERACIONAL`) | parceiro não APROVADO na auditoria ou inativo                                                      | "Seu cadastro de parceiro ainda não está aprovado para operar." |
| 403 (guard)                      | usuário não é membro do parceiro / `parceiroId` de terceiro                                        | não deve acontecer pela UI                                      |
| 429                              | throttle: **10 tentativas/min**                                                                    | desabilitar o botão por ~1min; "muitas tentativas, aguarde"     |

### 3.2 Listar vinculados (ativos + histórico)

```http
GET /parceiro/portal/compartilhamentos?status=ATIVO&cursor={id}&limit=20&parceiroId={id}
```

`status` opcional (`ATIVO` | `EXPIRADO` | `REVOGADO`; omitido = todos). `limit` 1..50 (default 20). Paginação por cursor: mande `cursor` = último `id` da página anterior.

Resposta (`data`):

```ts
{
  data: Array<{
    id: string;
    petNome: string;
    especie: string;          // enum cru (ex.: 'CACHORRO')
    especieLabel: string;     // já traduzido pelo Accept-Language (ex.: 'Cachorro')
    petFoto: string | null;
    tipoServico: TipoServicoPrestador;
    servicoOutroLabel: string | null;   // preencher quando tipoServico='OUTRO'
    status: StatusCompartilhamento;
    expiraEm: string;
    vinculadoEm: string;
    criadoEm: string;
    totalAnotacoes: number;
  }>;
  meta: { proximoCursor?: string };   // ausente = acabou
}
```

**Sem snapshot na lista** (por design). Ordenação: mais recente primeiro.

### 3.3 Detalhe

```http
GET /parceiro/portal/compartilhamentos/{id}?parceiroId={id}
```

**Caso ATIVO** (`data`) — mesmo payload do link público + `status`/`vinculadoEm`:

```ts
{
  id: string;
  codigo: string;
  petNome: string;
  especie: string;
  especieLabel: string;
  petFoto: string | null;
  petCastrado: boolean | null;        // header de identidade, sempre presente
  tipoServico: TipoServicoPrestador;
  servicoOutroLabel: string | null;
  empresaNome: string | null;         // texto livre que o TUTOR digitou ao criar
  mensagemTutor: string | null;
  categorias: CategoriaInfoCompartilhada[];
  criadoEm: string;
  expiraEm: string;
  snapshot: SnapshotPetCompartilhado; // renderizar só as seções presentes
  anotacoes: Anotacao[];              // TODAS (inclusive as feitas pelo canal público)
  status: 'ATIVO';
  vinculadoEm: string;
}
```

**Caso EXPIRADO/REVOGADO** — histórico enxuto (D8.5):

```ts
{
  id, codigo, petNome, especie, especieLabel, petFoto,
  tipoServico, servicoOutroLabel, empresaNome,
  status: 'EXPIRADO' | 'REVOGADO',
  criadoEm, expiraEm, revogadoEm: string | null, vinculadoEm,
  snapshot: null,                     // o dado clínico morre com o acesso
  anotacoes: Anotacao[],              // SÓ as criadas pela própria empresa (autenticadas)
}
```

Sem `petCastrado`, sem `mensagemTutor`, sem `categorias` no encerrado. 403 = compartilhamento de outra empresa; 404 = id inexistente.

### 3.4 Criar anotação autenticada

```http
POST /parceiro/portal/compartilhamentos/{id}/anotacoes?parceiroId={id}
Content-Type: multipart/form-data
```

Campos do multipart:

| Campo              | Obrigatório  | Observação                                                                                                           |
| ------------------ | ------------ | -------------------------------------------------------------------------------------------------------------------- |
| `servicoRealizado` | sim          | texto curto ("Banho e tosa")                                                                                         |
| `texto`            | sim          | corpo da anotação                                                                                                    |
| `profissionalNome` | não          | **default = nome do usuário logado** (vazio/whitespace também cai no default)                                        |
| `anexos`           | não          | até **3 arquivos**; `image/jpeg`, `image/png`, `image/webp`, `image/heic`, `application/pdf`; máx 10MB cada          |
| `tiposDocumento`   | não          | JSON string: array com o MESMO length de `anexos`, valores `TipoDocumentoAnexo` ou `null`. Ex.: `'["Raio-X", null]'` |
| `empresaNome`      | **ignorado** | a empresa sai do cadastro do parceiro (D8.4); não mande                                                              |

Resposta **201** (`data`): a `Anotacao` criada (com `compartilhamentoId` e `lida: false`).

| Status | Quando                                                                                 | UI                                         |
| ------ | -------------------------------------------------------------------------------------- | ------------------------------------------ |
| 400    | campo obrigatório faltando, >3 anexos, MIME/tipo inválido, `tiposDocumento` malformado | validação inline antes de enviar           |
| 409    | compartilhamento EXPIRADO/REVOGADO                                                     | esconder o form quando `status != 'ATIVO'` |
| 403    | de outra empresa, ou parceiro não operacional                                          | idem 3.1                                   |

### 3.5 Signed URL de anexo (abrir/baixar arquivo)

```http
GET /parceiro/portal/compartilhamentos/{id}/anexos/{anexoId}/url?parceiroId={id}
```

Resposta (`data`): `{ signedUrl: string, expiresIn: 900 }` (15 min; gere on-demand a cada abertura, **não** persista a URL).
Após encerrado, só anexos de anotações da própria empresa; os demais retornam 404. Anexos não salvos pelo tutor podem ter sido expurgados após revogação (LGPD): trate falha de download com tolerância ("arquivo não está mais disponível").

---

## 4. As telas — app do vet (`petjourney-app`, aba veterinario)

### 4.1 "Pacientes" (lista) — slot natural: `app/(tabs)/veterinario/pacientes.tsx` (hoje mock)

- Carrega `GET /parceiro/portal/compartilhamentos` (segmento padrão: `status=ATIVO`; segundo segmento "Histórico" = sem filtro ou EXPIRADO+REVOGADO em duas chamadas).
- Card por item: foto + `petNome` + `especieLabel`, chip do `tipoServico` (usar `servicoOutroLabel` quando OUTRO), badge de status, **countdown de `expiraEm`** (ex.: "expira em 5h"), contador `totalAnotacoes`.
- Infinite scroll com `meta.proximoCursor`.
- Empty state: CTA "Vincular um código".

### 4.2 Modal "Vincular código"

- Input de 6 dígitos (aceitar colar "123-456"), botão Vincular → `POST /vincular`.
- 200 → navegar direto pro detalhe (a resposta JÁ é o detalhe; não precisa refetch).
- Tabela de erros da 3.1. Em 429, desabilitar por 60s.

### 4.3 Detalhe do paciente

- ATIVO: header de identidade (foto, nome, `especieLabel`, castrado quando não-null), aviso de expiração, seções do `snapshot` **só quando presentes** (peso, alergias com `destaque` em vermelho, vacinas, medicamentos, comportamento, diagnósticos, observações do tutor), stream de `anotacoes` (mais recente primeiro) e form de nova anotação (3.4).
- EXPIRADO/REVOGADO: header + "acesso encerrado", sem snapshot; mostrar só as anotações da própria empresa (é o que a API devolve).
- Anexo: tocar → `GET .../url` → abrir `signedUrl`.

### 4.4 Multi-parceiro

Se o usuário tem 2+ memberships, resolver o `parceiroId` do contexto atual (mesmo seletor que o resto do portal usa) e mandar em TODAS as chamadas.

## 5. As telas — painel web do parceiro

Mesmas rotas e regras. Sugestão: item de menu "Atendimentos" com tabela (colunas: pet, serviço, status, expira em, anotações), busca do vínculo por código no topo, drawer/página de detalhe com o snapshot e o form de anotação. Nada além do que o app do vet mostra.

---

## 6. Erros e i18n

As mensagens de erro já chegam localizadas (`Accept-Language`). Não mapear por string; usar statusCode + rota. Copy das chaves novas (pt-BR): 409 vínculo = "Este acesso ja esta vinculado a outra empresa."; 403 operacional = "Seu cadastro de parceiro ainda nao esta aprovado para operar."; 404 código = "Acesso nao encontrado ou expirado.".

## 7. Aditivo no app do TUTOR (pequeno)

`GET /tutor/compartilhamentos-prestador` (lista e detalhe) agora incluem:

```ts
parceiroVinculado: { id: string; nome: string; logoUrl: string | null } | null
```

- `null` = ninguém vinculou ainda (fluxo só por link, como antes).
- Preenchido = mostrar badge/linha "Vinculado a {nome}" (com logo) no card e no detalhe do compartilhamento. Reforça pro tutor QUEM está com o acesso; a revogação existente já corta o parceiro junto.
- Campo aditivo: nenhuma tela atual quebra se ignorar.

---

## 8. Checklist de integração

### App do vet

- [ ] Service `services/compartilhamento-parceiro/` (padrão `services/<mod>/<mod>-service.ts`): `vincular(codigo)`, `listar({status, cursor, limit})`, `detalhe(id)`, `criarAnotacao(id, form)`, `anexoUrl(id, anexoId)` — todos aceitando `parceiroId` opcional.
- [ ] Aba Pacientes: lista real no lugar do mock; segmentos Ativos/Histórico; infinite scroll por `proximoCursor`.
- [ ] Modal de vincular com normalização de input e tratamento 404/409/403/429.
- [ ] Detalhe: renderizar snapshot só com seções presentes; form de anotação escondido quando `status != 'ATIVO'`; upload multipart com até 3 anexos + `tiposDocumento` como JSON string.
- [ ] Anexos via signed URL on-demand (nunca cachear a URL).
- [ ] `?parceiroId` quando 2+ memberships.

### Painel web

- [ ] Mesmo service/contrato; tela "Atendimentos" + busca por código + detalhe.

### App do tutor

- [ ] Exibir `parceiroVinculado` no card e no detalhe do compartilhamento (null-safe).

## 9. Fora do escopo desta entrega

- Tutor escolher o parceiro na criação do compartilhamento (busca de credenciados) — follow-up da spec backend (Pergunta 3).
- Notificação push ao tutor quando um parceiro vincula (Pergunta 4).
- Vincular por QR/deep-link direto (hoje é colar o código; o link público continua sendo a landing).
- Qualquer dado além do payload público no detalhe do vet (D8.2 é regra de produto, não limitação temporária).
