# Spec Portal: Parte 15 - Contrato do snapshot no portal do parceiro

**Status:** Em implementacao no portal (backend Concluido)
**Autor:** Nicolas via Claude
**Criado em:** 2026-08-12
**Plataforma alvo:** **Portal do parceiro** (`petjourney-admin`, `web.petjourney.health`). Nao existe tutor nesta superficie.
**Spec backend:** `15-contrato-do-snapshot-compartilhado.md` (repo `petjourney-api`)
**Specs irmas de front:** `15-contrato-do-snapshot-compartilhado-web.md`, `15-contrato-do-snapshot-compartilhado-app.md`
**Spec anterior desta tela:** [11-13-prontuario-acesso-temporario-portal.md](11-13-prontuario-acesso-temporario-portal.md)

> A spec original foi escrita **sem ancoras de codigo** porque o repo do portal nao estava na maquina. Este arquivo e a mesma spec com as ancoras preenchidas e as decisoes de implementacao registradas na secao 8.

---

## 0. O que muda (em 2 linhas)

O parceiro logado le o **mesmo snapshot** do canal publico, porque o backend reusa `mapPublico` no detalhe do parceiro. Entao tudo que vale para a pagina publica vale aqui: labels traduzidos, motivo do bloco vazio e carimbo do resumo.

## 1. Como o payload chega no portal

O detalhe do acesso vinculado devolve `mapPublico` mais dois campos proprios:

```ts
{
  ...tudo do canal publico,   // inclui os campos novos da Parte 15
  status: StatusCompartilhamento,
  vinculadoEm: string,
}
```

**Atencao ao acesso ENCERRADO.** Por D8.5 o historico e enxuto: `snapshot: null`, sem `petCastrado`, sem `categorias` e sem mensagem do tutor. Portanto **toda leitura de snapshot no portal precisa tolerar `null`**, e nada da Parte 15 se aplica nesse estado. Isso ja era verdade antes desta parte; esta escrito aqui porque a logica nova de "bloco vazio com motivo" nao pode rodar sobre `null`.

## 2. Contrato novo

Identico ao da spec da web (secao 2), sem diferenca. Resumo:

- `snapshotAtualizadoEm: string | null` na raiz. `null` = vale `criadoEm`.
- `tituloLabel` em `diagnosticos` e `comportamento`; `detalheLabel` em `alergias`. Ambos no locale da request.
- `snapshot.motivos`: `SEM_REGISTRO` em qualquer bloco, `FILTRADO_JANELA` so em `diario`.
- `snapshot.diario` e `snapshot.documentos` existem desde a Parte 11. Confirme que o tipo local do portal os declara: os dois outros frontends estavam sem eles.

Fonte oficial do schema: Swagger em `/reference`, `SnapshotPetCompartilhadoDto` e `AcessoPrestadorPublicoResponseDto`.

## 3. Regra de renderizacao

Mesma ordem da web:

1. `status` encerrado ou `snapshot === null` -> historico enxuto, nao renderize prontuario.
2. Categoria fora de `categorias` -> nao compartilhado, sem secao.
3. Bloco com conteudo -> renderiza.
4. Bloco vazio com `motivos[bloco]` -> secao com a frase do motivo.
5. Bloco vazio sem `motivos` -> frase generica, **sem inferir** (acesso anterior a Parte 15).

## 4. Copy

Quem le e um profissional, nao o dono do pet, entao a voz e a mesma da web: "o responsavel nao registrou", nunca "voce nao registrou".

> **Desvio consciente do pt-BR:** a spec da web escreve "o tutor". No portal o texto visivel em portugues usa **"responsavel"**, por exigencia legal ja aplicada em toda esta superficie. O termo "tutor" sobrevive so em identificador de codigo e campo de API (`mensagemTutor`, `observacoesTutor`). Em `es` o termo segue sendo "tutor" e em `en` "pet parent", como no resto dos locales do portal.

Os 4 locales com en-GB explicito valem aqui tambem. O portal atende UAE, UK, Israel e Servia.

## 5. Acceptance Criteria

- [x] **AC-P1** O tipo local do snapshot no portal inclui `diario`, `documentos`, `motivos` e `snapshotAtualizadoEm`. **Conferencia contra o Swagger pendente:** o checkout local de `petjourney-api` ainda nao tem a Parte 15 (ver 8.7), entao o tipo foi escrito contra a spec, com todo campo novo opcional.
- [x] **AC-P2** Diagnostico e comportamento renderizam `tituloLabel` com fallback para `titulo`.
- [x] **AC-P3** Alergia renderiza gatilho sem traducao e `detalheLabel` com fallback para `detalhe`.
- [x] **AC-P4** O locale da sessao do parceiro vai na request, e trocar o idioma do portal muda os labels sem regerar o acesso.
- [x] **AC-P5** Bloco vazio de categoria compartilhada renderiza a frase do motivo; `FILTRADO_JANELA` usa a frase de acompanhamento sem anormalidade.
- [x] **AC-P6** `motivos` ausente renderiza frase generica sem afirmar ausencia de registro.
- [x] **AC-P7** Acesso ENCERRADO com `snapshot: null` nao quebra a tela e nao tenta ler `motivos`.
- [x] **AC-P8** O carimbo do resumo aparece no detalhe do acesso: `snapshotAtualizadoEm` quando presente, `criadoEm` quando `null`.
- [x] **AC-P9** Copy nos 4 locales com en-GB escrito e sem em-dash.

## 6. Testes

- [x] Unit do montador de blocos com `snapshot: null` (AC-P7). Este e o caso que mais provavelmente quebra.
- [x] Matriz categoria x vazio x motivo (AC-P5, AC-P6).
- [x] Fallback de label (AC-P2, AC-P3).
- [ ] Manual: abrir um acesso vinculado em en-GB e conferir diagnostico traduzido e carimbo.

## 7. Ordem de deploy

Backend pronto e aditivo. O portal sobe quando quiser.

---

## 8. Ancoras e decisoes de implementacao (portal)

### 8.1 Arquivos

| Arquivo | Papel |
|---|---|
| `src/service/parceiro/types.ts` | Tipos do contrato: `MotivoBlocoVazio`, `MotivosSnapshot`, `EntradaDiarioCompartilhada`, `DocumentoCompartilhado`, campos novos em `ItemSnapshot` e `CompartilhamentoDetalhe` |
| `src/utils/parceiro/snapshot-compartilhado.ts` | **Nucleo puro** das regras da secao 3. Sem Vue, sem i18n: devolve chave de motivo, nao frase |
| `src/utils/parceiro/__tests__/snapshot-compartilhado.spec.ts` | Cobre AC-P2, AC-P3, AC-P5, AC-P6, AC-P7 |
| `src/pages/(accounts)/parceiro/atendimentos/[id].vue` | Consome o nucleo e traduz. Secoes novas: diario, documentos, carimbo |
| `src/service/api.ts` | `Accept-Language` na request (AC-P4) |
| `src/locales/{pt,en,en-GB,es}.json` | Copy (AC-P9) |

### 8.2 Por que a logica saiu da tela

A regra de renderizacao tem cinco ramos e dois deles so aparecem em dado que hoje nenhum ambiente produz (`motivos` ainda nao veio em nenhuma resposta observada). Testar isso dentro de um `computed` de SFC exigiria montar a pagina inteira com PrimeVue, i18n e router. O nucleo em `snapshot-compartilhado.ts` e funcao pura de `(snapshot, categorias, status)` para lista de blocos, entao a matriz da secao 6 vira tabela de teste direta.

O nucleo devolve **chave** (`SEM_REGISTRO`, `FILTRADO_JANELA`, `GENERICO`), nunca texto. Quem traduz e a tela. Isso mantem o teste independente dos 4 locales.

### 8.3 Motivo desconhecido cai em generico

`normalizarMotivo` aceita `SEM_REGISTRO` em qualquer bloco e `FILTRADO_JANELA` **so** em `diario`. Qualquer outro valor, inclusive um enum novo que o backend passe a mandar depois, vira `GENERICO`.

**Motivo:** a regra 5 manda nao inferir. Um valor que o portal nao conhece nao autoriza afirmar "o responsavel nao registrou" - essa frase e uma afirmacao sobre o prontuario de alguem, e errar nela e pior do que ser vago. Frase generica nao mente em nenhum caso.

### 8.4 Peso e observacoes ficam fora de `motivos`

`pesoKg` e `observacoesTutor` sao campos escalares, nao blocos de lista: nao tem secao propria (peso vive no cabecalho, observacoes vive num callout) e a spec so nomeia bloco. Quando a categoria foi compartilhada e o valor veio vazio, eles seguem simplesmente ausentes da tela, como antes desta parte.

Se o backend passar a emitir `motivos.pesoKg` ou `motivos.observacoesTutor`, a chave e ignorada sem quebrar nada, e ai vale abrir um delta desta spec.

### 8.5 `Accept-Language` no `apiFetch` e global

AC-P4 pedia o locale na request do detalhe. A mudanca foi feita no `apiFetch` inteiro, nao so nessa chamada.

**Motivo:** o header ja era o contrato do `@Locale()` do backend em toda rota localizada, e o portal nunca o mandava - ou seja, **todo** conteudo localizado do portal vinha em pt-BR mesmo com a sessao em outro idioma (o comentario "Ja traduzido pelo Accept-Language" em `CompartilhamentoResumo.especieLabel` era falso). Consertar so o detalhe deixaria a lista de pacientes ao lado, na mesma tela, em outro idioma.

O valor sai de `INTL_LOCALE`, que ja mapeia os 4 locales do portal para as tags que o `normalizeLocale` do backend entende (`pt` -> `pt-BR`, `en` -> `en-US`, `en-GB` -> `en-GB`, `es` -> `es`, normalizado para `es-419`). Chamador que ja definiu o header manda o dele.

### 8.6 Diario passou a ser renderizado

O diario existe no snapshot desde a Parte 11 e nunca foi exibido no portal. Sem ele, a metade `FILTRADO_JANELA` do AC-P5 seria intestavel: e o unico bloco onde esse motivo aparece.

### 8.7 Foto de diario abre, nao baixa

Documento tem nome de arquivo real (`javascript.pdf`), entao o botao Baixar manda esse nome no `?download=` da URL assinada e o storage responde com `Content-Disposition: attachment`. Foto de diario e so um id do cofre: nao ha nome nem extensao no payload, e forcar download com nome inventado salva arquivo sem extensao. Por isso foto de diario tem so **Abrir** - a partir da aba aberta o navegador salva com o nome e o tipo certos.

### 8.8 Sobre a idade dos dados em dev

A resposta de dev observada em 2026-08-12 (acesso `cmsqqbaq1000m19of1crebrt4`) nao traz `snapshotAtualizadoEm`, nao traz `motivos` e traz enum cru em diagnostico (`"HEPATICA"`) e em alergia (`"ALIMENTAR"`). Ou o ambiente ainda nao subiu a Parte 15, ou o acesso e anterior a ela. Nos dois casos o portal cai na regra 5 e no fallback de label, que e exatamente o comportamento especificado - **nao** e bug de portal.

## Change Log

| Data | Versao | Mudanca | Autor |
|---|---|---|---|
| 2026-08-12 | 0.1 | Criacao junto do backend da Parte 15 | Nicolas via Claude |
| 2026-08-12 | 0.2 | Ancoras do portal preenchidas, secao 8 com as decisoes de implementacao | Claude |
