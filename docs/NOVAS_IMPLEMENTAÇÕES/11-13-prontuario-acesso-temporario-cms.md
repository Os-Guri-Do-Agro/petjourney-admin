# Spec CMS: Partes 11 a 13 - Suporte e Conformidade do Acesso Temporario

**Status:** Draft (depende do backend das Partes 11 a 13, hoje In Review)
**Autor:** Nicolas (via /spec-driven com Claude)
**Criado em:** 2026-08-05
**Plataforma alvo:** **CMS/backoffice** (`petjourney-cms`)
**Specs backend:** [11-prontuario-no-acesso-temporario.md](11-prontuario-no-acesso-temporario.md), [12-ficha-de-encaminhamento.md](12-ficha-de-encaminhamento.md), [13-handoff-do-acesso.md](13-handoff-do-acesso.md)
**Specs irmas de front:** [app](11-13-prontuario-acesso-temporario-app.md), [web](11-13-prontuario-acesso-temporario-web.md), [portal](11-13-prontuario-acesso-temporario-portal.md)

> Auto-suficiente: quem fizer o CMS implementa 100% a partir daqui. Todas as rotas sao ADMIN da mesma API (JWT de usuario `isSystemAdmin`; sem a flag, 403).

---

## 0. O que o admin faz (em 3 linhas)

O tutor compartilha o prontuario do pet com um prestador por link temporario. Quando isso da errado (mandou o exame errado, mandou pro numero errado, o prestador vazou), **o tutor tem o botao de revogar no app, mas o suporte nao tem nada**. Esta secao da ao admin o minimo para agir num incidente: **achar** o acesso, **revogar** com motivo registrado, e **provar quem abriu qual arquivo** quando o titular pergunta.

Nao e uma tela de leitura de prontuario. Ver secao 2.

---

## 1. Por que isso existe (e o furo que ele fecha)

A Parte 11 classifica como risco **Alto** o vazamento de PII do tutor via exame (documento clinico costuma trazer nome, CPF, endereco e telefone do humano no cabecalho) e lista como mitigacao um log estruturado de cada abertura de arquivo.

**Log em Pino nao atende pedido de titular.** Quando o tutor pergunta "quem abriu o exame do meu pet e quando", o suporte precisa de uma resposta consultavel, com retencao previsivel, ligada ao acesso. Grep em log de plataforma nao e trilha de auditoria: some na rotacao, nao pagina, e ninguem do suporte tem acesso.

Logo esta spec **muda a mitigacao da Parte 11**: a abertura de arquivo passa a ser **persistida**, e nao apenas logada. Ver secao 6 (Backend requerido) e a nota que precisa entrar na Parte 11.

Custo de nao fazer: o unico caminho de revogacao e o proprio tutor, no app dele. Tutor sem o celular na mao, com o app desinstalado ou com a conta em recuperacao fica sem saida, e o acesso continua vivo ate 30 dias. Em incidente de privacidade, o tempo de resposta e o produto.

---

## 2. Decisao que rege a tela inteira: metadado sim, conteudo clinico nao

**O CMS mostra que existe, nunca o que diz.** O admin ve: quais categorias o tutor marcou, quantos documentos entraram, o nome e o tipo de cada documento, quantas entradas de diario, quantos arquivos, quantas aberturas e por quem. O admin **nao** ve o snapshot clinico, **nao** ve a ficha de encaminhamento, **nao** ve sintoma, **nao** ve o motivo da visita e **nao abre arquivo nenhum**.

**Motivo:** o consentimento do tutor foi dado a um prestador nomeado, por um prazo, por categoria. Admin nao estava nesse contrato. Uma tela de backoffice que abre o exame de qualquer pet transforma cada conta de admin numa chave-mestra do prontuario da base inteira, e o incidente que essa spec existe para remediar passaria a ter uma segunda porta. Suporte precisa **identificar e cortar**, e isso se faz por metadado.

**Consequencia pratica:** nao existe botao de download, preview, nem link para o arquivo em lugar nenhum do CMS. A rota admin nunca devolve `signedUrl`. Se o suporte precisa confirmar o conteudo de um documento com o tutor, ele pede ao tutor, que ve tudo no app dele.

**Alternativa rejeitada:** espelhar a pagina publica do prestador dentro do CMS. Resolveria a duvida "o que foi compartilhado?" em um clique e criaria exposicao permanente e nao consentida de PII de saude para toda a equipe de backoffice.

---

## 3. Convencoes

- **Auth:** `Authorization: Bearer {token}` de usuario com `isSystemAdmin: true` (login normal `POST /auth/login`). Sem a flag, 403 em todas.
- **Envelope de sucesso:** `{ statusCode, message, data }`, corpo util em `response.data.data`.
- **Envelope de erro:** `{ statusCode, timestamp, path, message, error }`.
- **Paginacao:** page-based, igual a grid de parceiros e de usuarios: query `?page=1&limit=20`, resposta `{ data: [...], meta: { total, page, limit, totalPages } }`.
- **Copy:** em-dash (`—`) proibido.
- **Datas:** ISO8601 UTC. A UI formata no fuso do navegador.

---

## 4. Telas

Secao nova no shell do CMS. Sugestao de posicionamento: dentro de `(section-pets)`, porque o objeto e o prontuario do pet, e nao o parceiro.

### 4.1 Lista: Acessos temporarios

Rota sugerida: `/acessos-temporarios`.

**Busca** (o suporte chega com um destes na mao, nunca com o id):

| Campo | Uso tipico no atendimento |
|---|---|
| `codigo` | "o codigo que eu mandei pro vet e 482913" |
| `tutorEmail` | o tutor abriu o chamado pelo e-mail dele |
| `petNome` | "o acesso da Lili" |
| `empresaNome` | "mandei pra clinica X" |

**Filtros:** `status` (`ATIVO`, `EXPIRADO`, `REVOGADO`), `temDocumentos` (booleano), `temDiario` (booleano), periodo de criacao (`from`/`to`).

O par `temDocumentos`/`temDiario` existe porque sao exatamente os acessos das Partes 11 a 13 que carregam PII e prontuario. Em incidente, esse e o primeiro corte.

**Colunas:** codigo, pet, tutor (nome e e-mail), empresa, status com chip, categorias como chips, quantidade de documentos, quantidade de arquivos, aberturas, criado em, expira em.

**Ordenacao default:** `createdAt desc`.

**Acao de linha:** abrir detalhe. Revogar so no detalhe, nunca na lista: acao destrutiva exige contexto e motivo.

### 4.2 Detalhe do acesso

Rota sugerida: `/acessos-temporarios/[id]`.

Quatro blocos:

**Identificacao.** Codigo, status, pet, tutor, empresa informada, tipo de servico, criado em, expira em, revogado em, quem revogou e o protocolo, quando houver. Se o acesso foi reivindicado por um parceiro com conta, mostrar qual (Parte 8) com link para a ficha dele.

**O que foi compartilhado (metadado).** Chips das categorias marcadas. Quando `DOCUMENTOS` estiver presente, a lista dos documentos escolhidos com **nome, tipo, data de emissao e quantidade de arquivos**, sem preview e sem link. Quando `DIARIO` estiver presente, apenas a **contagem** de entradas e o intervalo de datas coberto ("15 entradas, 08/07 a 05/08"), nunca o sintoma. Se o resumo foi atualizado (D11.3), mostrar `snapshotAtualizadoEm`.

**Trilha de aberturas.** Tabela paginada: quando, qual arquivo (nome e origem `DOCUMENTO` ou `DIARIO_FOTO`), por qual canal (`publico`, `tutor`, `parceiro`) e, no canal do parceiro, qual parceiro e qual membro. Vazio e resposta valida e importante: "nenhum arquivo foi aberto" e exatamente o que tranquiliza o titular.

**Acoes.** Revogar (secao 4.3).

### 4.3 Revogar acesso (acao administrativa auditada)

Botao **Revogar acesso**, visivel apenas com `status = ATIVO`.

Modal com **motivo obrigatorio** (texto livre, minimo 10 caracteres) e confirmacao explicita. O motivo nao e decorativo: ele entra na trilha e e o que justifica a acao numa auditoria.

Ao confirmar, a UI mostra o **codigo do protocolo** devolvido (formato `<PREFIXO>-<ANO>-<SEQ6>`) e o suporte informa esse codigo ao tutor. E o mesmo padrao ja adotado na exclusao de parceiro.

Efeito: o link publico para de abrir, o parceiro perde a leitura, os binarios do cofre sao apagados, e o registro do acesso e preservado com `revogadoEm`.

**Estados de erro:**

| Situacao | Resposta | O que a UI faz |
|---|---|---|
| Acesso ja expirado ou ja revogado | 409 `COMPARTILHAMENTO_JA_ENCERRADO` | "Este acesso ja esta encerrado", recarrega a linha |
| Motivo ausente ou curto demais | 400 | Destaca o campo |
| Sem `isSystemAdmin` | 403 | Nao deveria acontecer: esconder a secao inteira do menu |

### 4.4 Dashboard: adocao e exposicao

Cards no `(dashboard)`, alimentados por uma rota de metricas:

- Acessos criados no periodo, e quantos por categoria (com destaque para `DIARIO` e `DOCUMENTOS`).
- Percentual de acessos que tiveram ao menos uma abertura de arquivo (o prestador realmente usou).
- Percentual entregue por handoff (Parte 13) contra link cru.
- Acessos revogados por admin no periodo. **Este numero subindo e sinal de incidente recorrente, nao de produtividade do suporte.**

---

## 5. Contrato das rotas admin

Todas sob `admin/compartilhamentos`, com `JwtAuthGuard + SystemAdminGuard`.

### 5.1 `GET admin/compartilhamentos`

Query: `page`, `limit`, `codigo`, `tutorEmail`, `petNome`, `empresaNome`, `status`, `temDocumentos`, `temDiario`, `from`, `to`.

```jsonc
{
  "data": [
    {
      "id": "ckx...",
      "codigo": "482913",
      "status": "ATIVO",
      "petNome": "Lili",
      "tutor": { "id": "u1", "nome": "Ana", "email": "ana@x.com" },
      "empresaNome": "CenterVet",
      "tipoServico": "CONSULTA",
      "categorias": ["ALERGIAS", "DIARIO", "DOCUMENTOS"],
      "totalDocumentos": 2,
      "totalArquivos": 5,
      "totalAberturas": 3,
      "parceiroVinculado": { "id": "p1", "nome": "CenterVet" },
      "criadoEm": "2026-08-01T12:00:00.000Z",
      "expiraEm": "2026-08-03T12:00:00.000Z",
      "revogadoEm": null
    }
  ],
  "meta": { "total": 1, "page": 1, "limit": 20, "totalPages": 1 }
}
```

Sem `snapshot`, sem `ficha`, sem `mensagemTutor`, sem `motivoVisita` (secao 2).

### 5.2 `GET admin/compartilhamentos/:id`

Tudo da lista, mais:

```jsonc
{
  "documentos": [
    { "nome": "Hemograma", "tipo": "EXAME", "dataEmissao": "2026-07-20", "totalArquivos": 3 }
  ],
  "diario": { "totalEntradas": 15, "de": "2026-07-08", "ate": "2026-08-05" },
  "snapshotAtualizadoEm": "2026-08-02T09:00:00.000Z",
  "revogadoPor": { "id": "adm1", "nome": "Suporte" },
  "protocoloRevogacao": "RVG-2026-000042"
}
```

`documentos[]` traz nome e tipo porque e o que permite ao suporte confirmar com o tutor **qual** documento tirar do ar. Nao traz id de arquivo nem caminho.

### 5.3 `GET admin/compartilhamentos/:id/aberturas`

Paginado. Cada item: `abertoEm`, `arquivoNome`, `origem`, `canal`, e `parceiro` mais `usuario` quando o canal for autenticado.

### 5.4 `DELETE admin/compartilhamentos/:id`

Body: `{ "motivo": "string (min 10)" }`. Resposta: `{ "id", "revogadoEm", "protocolo" }`.

### 5.5 `GET admin/compartilhamentos/metricas`

Query `from`/`to`. Resposta com os contadores da secao 4.4.

---

## 6. Backend requerido (nao existe hoje)

Esta spec **nao e implementavel** sem estas mudancas na API. Elas nao estao nas Partes 11 a 13 e precisam entrar como parte desta leva.

- [ ] **B1** Controller admin `admin/compartilhamentos` com `JwtAuthGuard + SystemAdminGuard`, com as 5 rotas da secao 5. Hoje o modulo so tem superficie tutor-scoped, parceiro-scoped e publica: **nao ha nenhuma rota admin**.
- [ ] **B2** Model `AberturaArquivoCompartilhado` (ou equivalente) persistindo cada geracao de URL assinada: `arquivoCompartilhadoId`, `compartilhamentoId`, `canal`, `parceiroId?`, `usuarioId?`, `abertoEm`. Substitui a mitigacao "log estruturado" da Parte 11 por trilha consultavel. **Sem PII no registro**: so ids e o nome do arquivo ja denormalizado.
- [ ] **B3** Revogacao administrativa reusando `ProtocoloService.emitir`. O `ProtocoloAdmin` ja e polimorfico por design (`entidade` e string livre "pra estender sem migration"), entao basta `entidade = "CompartilhamentoPrestador"` mais um valor novo no enum de acao com prefixo proprio (sugestao: `REVOGACAO_COMPARTILHAMENTO`, prefixo `RVG`). Atencao: o enum se chama `TipoAcaoAdminParceiro` e o `PREFIXO_POR_ACAO` e um `Record` completo, entao o compilador vai exigir o prefixo novo, que e o comportamento desejado. O nome do enum fica semanticamente apertado (a acao nao e sobre parceiro); renomear e opcional e fora do escopo.
- [ ] **B4** Filtros `temDocumentos` e `temDiario` na query, resolvidos por `categorias has DOCUMENTOS` e `categorias has DIARIO`.
- [ ] **B5** Retencao da trilha de aberturas definida e documentada (proposta: 24 meses), porque trilha de auditoria sem prazo vira passivo de LGPD.

> **Nota que precisa entrar na Parte 11:** a linha de Observabilidade que hoje promete apenas `[Compartilhamento] ARQUIVO_ABERTO ...` em log passa a exigir persistencia (B2). O log continua util para operacao, mas a mitigacao do risco Alto de PII depende da trilha consultavel.

---

## 7. Acceptance Criteria

- [ ] **AC1 Given** um admin busca por codigo `482913` **Then** a lista devolve o acesso correspondente com as contagens de documentos, arquivos e aberturas.
- [ ] **AC2 Given** um usuario sem `isSystemAdmin` **When** chama qualquer rota `admin/compartilhamentos` **Then** recebe 403 e a secao nao aparece no menu.
- [ ] **AC3 Given** o detalhe de um acesso com `DIARIO` **Then** a tela mostra a contagem de entradas e o intervalo de datas, e **nao** mostra nenhum sintoma, observacao ou foto.
- [ ] **AC4 Given** o detalhe de um acesso com `DOCUMENTOS` **Then** a tela lista nome e tipo dos documentos e **nao** oferece nenhum link, preview ou download.
- [ ] **AC5 Given** qualquer resposta das rotas admin **Then** o corpo nao contem `signedUrl`, `snapshot`, `ficha`, `caminhoArquivo` nem `mensagemTutor` (verificavel por teste de contrato).
- [ ] **AC6 Given** um acesso `ATIVO` **When** o admin revoga com motivo valido **Then** recebe o protocolo, o link publico para de abrir e o status vira `REVOGADO`.
- [ ] **AC7 Given** um acesso ja `REVOGADO` **When** o admin tenta revogar **Then** recebe 409 e a UI recarrega a linha.
- [ ] **AC8 Given** motivo com menos de 10 caracteres **When** o admin confirma **Then** 400 e o campo e destacado, sem chamada de revogacao efetivada.
- [ ] **AC9 Given** um acesso cujo arquivo foi aberto 3 vezes **When** o admin abre a trilha **Then** ve 3 linhas com data, arquivo, origem e canal.
- [ ] **AC10 Given** um acesso sem nenhuma abertura **Then** a trilha mostra estado vazio explicito ("nenhum arquivo foi aberto"), e nao um erro.
- [ ] **AC11 Given** a revogacao administrativa **Then** existe `ProtocoloAdmin` com `entidade = "CompartilhamentoPrestador"`, o `motivo` gravado e o `adminId` correto.
- [ ] **AC12 Given** o filtro `temDocumentos=true` **Then** a lista traz apenas acessos com `DOCUMENTOS` em `categorias`.
- [ ] **AC13** Nenhuma copy da secao contem em-dash.

---

## 8. Definition of Done

- [ ] Todos os AC verificados um a um
- [ ] Rotas admin com teste de contrato garantindo ausencia de conteudo clinico (AC5)
- [ ] `security-auditor` rodado: a secao cria rota admin que le dado de qualquer tutor
- [ ] Typecheck e lint limpos nos dois repos
- [ ] Fluxo exercitado ponta a ponta: criar acesso no app, achar no CMS, revogar, confirmar que o link publico morreu
- [ ] Retencao da trilha (B5) definida e escrita nesta spec
- [ ] Nota da secao 6 incorporada a Parte 11

## 9. Perguntas em Aberto

- [ ] **1** Retencao de 24 meses para a trilha de aberturas serve, ou o juridico tem numero proprio? Responsavel: Nicolas.
- [ ] **2** A revogacao administrativa deve notificar o tutor por e-mail? Ele nao pediu a acao e o acesso e dele. Proposta: sim, com o protocolo. Responsavel: Nicolas.
- [ ] **3** O admin deve conseguir revogar **todos** os acessos ativos de um pet de uma vez (botao de panico em vazamento)? Fora do escopo desta leva. Responsavel: Nicolas.

## Change Log

| Data | Versao | Mudanca | Autor |
|---|---|---|---|
| 2026-08-05 | 0.1 | Criacao | Nicolas via Claude |
