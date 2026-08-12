# Spec Web: Partes 11 a 13 - Pagina Publica do Prestador

**Status:** Draft (depende do backend das Partes 11 a 13, hoje In Review)
**Autor:** Nicolas (via /spec-driven com Claude)
**Criado em:** 2026-08-05
**Plataforma alvo:** **Landing e paginas publicas** (`petjourney-web`, Next.js)
**Specs backend:** [11-prontuario-no-acesso-temporario.md](11-prontuario-no-acesso-temporario.md), [12-ficha-de-encaminhamento.md](12-ficha-de-encaminhamento.md), [13-handoff-do-acesso.md](13-handoff-do-acesso.md)
**Specs irmas de front:** [app](11-13-prontuario-acesso-temporario-app.md), [portal](11-13-prontuario-acesso-temporario-portal.md), [cms](11-13-prontuario-acesso-temporario-cms.md)

> Auto-suficiente. Esta e a superficie **mais importante** das tres partes: e onde o profissional le. Tudo o que o backend construiu passa por aqui, para alguem que nao tem conta, nao instalou nada e esta com o animal na frente.

---

## 0. O que muda (em 3 linhas)

A pagina hoje mostra a identidade do pet e ate 7 blocos de categoria. Passa a abrir com uma **ficha de encaminhamento** (o que nao pode passar batido, e por que o pet esta ali), e ganha dois blocos: **os dias em que o pet passou mal**, com data e foto, e os **exames e receitas** que o tutor liberou.

---

## 1. Estado atual

| Peca | Caminho | Papel |
|---|---|---|
| Entrada por codigo | `src/app/(public)/prestador/page.tsx` | Formulario do codigo de 6 digitos |
| Pagina do acesso | `src/app/(public)/prestador/[codigo]/page.tsx` | Casca, delega para o componente |
| Orquestrador | `src/components/prestador/PrestadorPortal.tsx` | Busca e monta a pagina |
| Blocos de categoria | `src/components/prestador/PetSnapshot.tsx` | Renderiza por `has("CATEGORIA")` |
| Anotacao | `src/components/prestador/{AnotacaoForm,AnotacoesList,AnotacaoEstruturadaFields}.tsx` | Retorno do prestador |
| Contrato | `src/service/prestador/{prestador-service.ts,types.ts}` | Chamadas e tipos |

O padrao de gating por categoria ja existe em `PetSnapshot.tsx` (`const has = (cat) => data.categorias.includes(cat)`). Os blocos novos entram nesse mesmo mecanismo. **Categoria ausente nao renderiza nada**, nem titulo, nem vazio.

---

## 2. Contrato

`GET prestador/acesso/:codigo` passa a devolver, alem do que ja devolve:

```ts
interface FichaEncaminhamento {
  alertas: { tipo: TipoAlertaFicha; texto: string }[];
  motivo?: { tipo: MotivoVisita; tipoLabel: string; descricao?: string | null };
  evidencias: {
    sintoma: string; ocorrencias: number;
    primeiraEm: string; ultimaEm: string; fotoIds: string[];
  }[];
  resumoPeso?: string | null;
}

interface EntradaDiarioCompartilhada {
  data: string;
  sintomas: string[]; doencas: string[];
  vitalidade?: string | null; alimentacao?: string | null; hidratacao?: string | null;
  fezes?: string | null; urina?: string | null; cicloCio?: string | null;
  observacoes?: string | null; remedios?: string | null;
  fotoIds: string[];
}

interface DocumentoCompartilhado {
  origemId: string; nome: string; tipo: string;
  dataEmissao?: string | null; dataExpiracao?: string | null;
  arquivoIds: string[];
}

// no payload:
//   ficha?: FichaEncaminhamento              (ausente quando nao ha o que dizer)
//   snapshot.diario: EntradaDiarioCompartilhada[]
//   snapshot.documentos: DocumentoCompartilhado[]
```

**Todos os labels ja chegam localizados.** A pagina nunca traduz enum: `sintomas` e `doencas` vem como texto no idioma do request. Mande `Accept-Language` e renderize.

**Arquivo:** o payload traz **id, nunca URL**. Para abrir:

`GET prestador/acesso/:codigo/arquivos/:arquivoId/url` responde `{ signedUrl, expiresIn }`.

---

## 3. Ordem da pagina

```
1. Identidade do pet (existe)
2. FICHA DE ENCAMINHAMENTO            <- novo, primeiro conteudo
3. Blocos de categoria (existe) + Diario e Documentos   <- novos
4. Anotacoes e formulario de retorno (existe)
5. Rodape de responsabilidade         <- novo
```

A ficha vem antes de tudo porque o profissional le em pe, com o animal na mao. Se a informacao que evita erro estiver no quarto acordeao, ela nao existe.

---

## 4. Bloco: Ficha de encaminhamento

Renderiza apenas se `ficha` vier no payload.

**Alertas.** Lista curta, ja ordenada pelo backend por prioridade (alergia, tratamento continuo, diagnostico ativo, sintoma recorrente, variacao de peso). Nao reordene. Destaque visual coerente com a severidade **da categoria**, nunca inventado por palavra-chave do texto.

**Motivo.** "Motivo: vomito recorrente", com a descricao livre quando houver.

**Evidencias.** Uma linha por sintoma: nome, contagem, periodo. Exemplo de renderizacao:

> Vomito: 3 episodios entre 23/07 e 26/07

Quando `fotoIds` nao estiver vazio, miniaturas clicaveis (secao 6).

**Peso.** `resumoPeso` como linha simples.

### Regra de copy (nao negociavel)

A ficha **descreve, nunca conclui**. Nao acrescente adjetivo, nao agrupe sob titulo como "Risco", "Gravidade" ou "Diagnostico", nao pinte de vermelho o que o backend nao marcou. O texto vem pronto e passou por teste de vocabulario proibido no backend; **a pagina nao pode reintroduzir juizo clinico pela via do design**. O cabecalho da secao e "Atencao".

---

## 5. Bloco: Diario do pet

So com `DIARIO` em `categorias`.

Lista cronologica decrescente, uma entrada por dia registrado. Cada entrada:

- **Data** em destaque (e o dado mais valioso: o tutor nao lembra, o registro lembra).
- **Sintomas** e **doencas** como chips, texto ja localizado.
- Campos clinicos presentes (vitalidade, alimentacao, hidratacao, fezes, urina, ciclo de cio), omitindo os nulos.
- **Observacoes** e **remedios** como texto.
- **Fotos** quando houver.

Titulo com o alcance: "Dias com sintoma registrado (15 entradas, 08/07 a 05/08)". Sem o alcance, o profissional nao sabe se esta vendo tudo ou uma amostra.

> Entrada sem sintoma nem doenca nao chega aqui, por decisao do backend (D11.4). Nao apresente como "historico completo": e o registro das anormalidades.

---

## 6. Bloco: Exames e receitas

So com `DOCUMENTOS` em `categorias`.

Um card por documento: nome, tipo, data de emissao, quantidade de arquivos. Cada arquivo abre por demanda.

### Abertura de arquivo (o ponto sensivel)

1. Usuario clica.
2. Chama `GET prestador/acesso/:codigo/arquivos/:arquivoId/url`.
3. Abre `signedUrl` em nova aba, ou renderiza inline quando imagem.

**Regras:**

- **Nunca** peca a URL em lote no carregamento da pagina. Uma URL por clique. Pedir todas de uma vez transformaria um acesso em coleta de todos os arquivos, que e exatamente o que o cofre privado da Parte 11 existe para impedir.
- **Nunca** cacheie a `signedUrl` entre navegacoes. Ela expira; clicar de novo pede de novo.
- Se a chamada devolver 404, o acesso morreu (expirou ou foi revogado) enquanto a aba estava aberta. Trate como sessao encerrada: mostre o estado de acesso invalido da pagina inteira, nao um erro no card.

---

## 7. Rodape de responsabilidade

Fixo ao fim do conteudo, sempre que houver ficha ou diario:

> As informacoes desta pagina foram registradas pelo tutor no PetJourney e nao constituem avaliacao veterinaria.

E a mitigacao do risco Alto da Parte 12 (a ficha ser lida como parecer clinico). Nao esconda em modal, nao reduza a tamanho ilegivel.

---

## 8. Impressao

O produto nao gera PDF (decisao D13.3): a pagina imprime. Folha de estilo de impressao com:

- Ficha, identidade, categorias e diario visiveis, acordeoes **expandidos**.
- Formulario de anotacao, botoes e navegacao ocultos.
- Codigo do acesso e validade no rodape impresso.
- Sem quebra de pagina no meio de uma entrada de diario.

Arquivo nao imprime (e URL assinada com prazo). Liste os documentos por nome e tipo na versao impressa.

---

## 9. i18n

O prestador nao e necessariamente lusofono: o produto opera em UAE, UK, Israel e Servia. Mande `Accept-Language` em toda chamada. Os labels de sintoma, doenca, motivo e alerta ja vem prontos. O que a pagina traduz por conta propria sao apenas os seus proprios titulos e microcopy, com **en-GB explicito**, nunca por fallback de en-US.

---

## 10. Acceptance Criteria

- [ ] **AC1 Given** um acesso com `ficha` **Then** ela e o primeiro conteudo depois da identidade do pet, com heading proprio.
- [ ] **AC2 Given** um acesso sem `ficha` no payload **Then** nenhuma area vazia ou titulo orfao aparece.
- [ ] **AC3 Given** alertas no payload **Then** a ordem renderizada e identica a do array recebido.
- [ ] **AC4 Given** o texto de um alerta **Then** a pagina nao adiciona nenhum termo de gravidade ou diagnostico ao redor dele.
- [ ] **AC5 Given** `DIARIO` na categoria **Then** o titulo do bloco declara a contagem e o intervalo de datas.
- [ ] **AC6 Given** uma entrada de diario com campos nulos **Then** os nulos nao viram linhas vazias.
- [ ] **AC7 Given** `DIARIO` ausente **Then** nenhum vestigio do bloco aparece no DOM.
- [ ] **AC8 Given** a pagina carregada com documentos **Then** nenhuma chamada de URL de arquivo foi disparada antes do primeiro clique.
- [ ] **AC9 Given** o usuario clica em um arquivo **Then** a URL e obtida na hora e aberta, e um segundo clique dispara nova chamada.
- [ ] **AC10 Given** o acesso foi revogado com a aba aberta **When** o usuario clica em um arquivo **Then** a pagina inteira passa ao estado de acesso invalido.
- [ ] **AC11 Given** ficha ou diario presentes **Then** o rodape de responsabilidade esta visivel sem interacao.
- [ ] **AC12 Given** o comando de impressao **Then** acordeoes saem expandidos e o formulario de anotacao nao sai.
- [ ] **AC13 Given** `Accept-Language: en-GB` **Then** sintomas e motivos aparecem em ingles britanico, e os textos proprios da pagina tambem.
- [ ] **AC14 Given** leitor de tela **Then** a ordem de leitura comeca por identidade, depois ficha, e a ficha tem heading semantico.
- [ ] **AC15** Nenhuma copy contem em-dash.
- [ ] **AC16** Nenhuma `signedUrl` e persistida em storage, estado global ou URL da pagina.

---

## 11. Definition of Done

- [ ] Todos os AC verificados um a um
- [ ] Testado em celular real: o prestador abre pelo link do WhatsApp, no navegador do celular
- [ ] Impressao conferida em uma folha A4 de verdade
- [ ] Auditoria de rede: nenhuma chamada de arquivo no load, nenhuma URL assinada em cache
- [ ] Teste de em-dash e de completude de i18n passando
- [ ] Typecheck e lint limpos

## 12. Perguntas em Aberto

- [ ] **1** Foto do diario deve abrir em lightbox na propria pagina ou em nova aba? Lightbox e melhor de usar e mantem o contexto; nova aba e trivial. Responsavel: Nicolas.
- [ ] **2** O rodape de responsabilidade e copy juridica. Precisa de revisao antes de publicar? Responsavel: Nicolas.

## Change Log

| Data | Versao | Mudanca | Autor |
|---|---|---|---|
| 2026-08-05 | 0.1 | Criacao | Nicolas via Claude |
