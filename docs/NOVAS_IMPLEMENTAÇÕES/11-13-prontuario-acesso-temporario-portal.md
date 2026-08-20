# Spec Portal: Partes 11 a 13 - Prontuario no Acesso Temporario (parceiro logado)

**Status:** Implementada em 2026-08-14, menos o que depende da Parte 12 (ficha de encaminhamento), que nao existe no backend. Ver secao 6.1
**Autor:** Nicolas (via /spec-driven com Claude)
**Criado em:** 2026-08-05
**Plataforma alvo:** **Portal do parceiro** (repo proprio, `web.petjourney.health`). Nao existe tutor nesta superficie.
**Specs backend:** [11-prontuario-no-acesso-temporario.md](11-prontuario-no-acesso-temporario.md), [12-ficha-de-encaminhamento.md](12-ficha-de-encaminhamento.md), [13-handoff-do-acesso.md](13-handoff-do-acesso.md)
**Specs irmas de front:** [web](11-13-prontuario-acesso-temporario-web.md), [app](11-13-prontuario-acesso-temporario-app.md), [cms](11-13-prontuario-acesso-temporario-cms.md)

> **Sem ancoras de codigo:** o repo do portal nao estava disponivel na maquina quando esta spec foi escrita. Tudo aqui e contrato de API e regra de produto, verificado contra o backend. Quem implementar deve conferir os nomes de componente e rota do portal e ajustar so a camada de UI.

---

## 0. O que muda (em 2 linhas)

O parceiro com conta ve **exatamente o mesmo conteudo** que a pagina publica mostra, dentro do painel dele. O que o login acrescenta nao e dado: e **organizacao**, ou seja, a lista de pacientes com os indicadores certos para priorizar o atendimento.

---

## 1. A regra que rege esta superficie inteira

**Login organiza, nunca amplia** (D8.2 da Parte 8). O parceiro autenticado recebe o mesmo payload do canal publico: mesmo header de identidade, mesmas categorias consentidas, mesma ficha, mesmo diario, mesmos documentos. Nenhuma categoria extra, nenhum dado do tutor alem do que o publico ja expoe.

**Motivo:** o consentimento do tutor foi dado por categoria, na criacao do acesso. Ter conta no PetJourney nao e consentimento novo. Se o portal mostrasse mais, o tutor teria compartilhado algo que nao escolheu compartilhar.

**Consequencia pratica:** se voce esta implementando algo no portal que a pagina publica nao mostra, pare. Ou e um bug de escopo, ou e uma decisao de produto que precisa de spec propria e de novo consentimento.

**Nao ha canal publico sendo substituido.** O prestador sem conta continua sendo cidadao de primeira classe: ninguem e obrigado a se cadastrar para atender um tutor do PetJourney. O portal e conveniencia para quem ja tem conta, nunca requisito.

---

## 2. Contrato

Rotas parceiro-scoped, com `JwtAuthGuard + ParceiroGuard`. Toda rota aceita `?parceiroId=`, obrigatorio quando o usuario tem mais de uma membership e auto-resolvido quando tem uma so.

| Rota | Uso |
|---|---|
| `GET parceiro/portal/compartilhamentos` | Lista de pacientes (ja existe, Partes 8 e 10) |
| `GET parceiro/portal/compartilhamentos/:id` | Detalhe, agora com `ficha`, `snapshot.diario` e `snapshot.documentos` |
| `GET parceiro/portal/compartilhamentos/:id/arquivos/:arquivoId/url` | **Rota nova.** URL assinada do arquivo |
| `POST prestador/acesso/:codigo/anotacoes` | Retorno do prestador (ja existe) |

Os shapes de `FichaEncaminhamento`, `EntradaDiarioCompartilhada` e `DocumentoCompartilhado` sao **identicos** aos da [spec do web](11-13-prontuario-acesso-temporario-web.md), secao 2. Use aquela secao como fonte.

---

## 3. Delta de UI sobre a pagina publica

O detalhe do paciente no portal renderiza os mesmos blocos, na mesma ordem, com as mesmas regras: ficha primeiro, categoria ausente nao renderiza nada, arquivo aberto um a um por clique, URL assinada nunca cacheada, rodape de responsabilidade presente. Reaproveite integralmente as decisoes das secoes 3 a 8 da spec do web.

O que e proprio do portal:

### 3.1 Lista de pacientes: indicadores novos

A lista existente ganha, por linha:

- **Motivo da visita**, quando houver. E o que permite triagem antes de abrir.
- **Indicador de prontuario**: quantos documentos e quantas entradas de diario vieram junto.
- **Marcador de resumo atualizado**, quando `snapshotAtualizadoEm` estiver preenchido. Significa que o tutor mexeu depois de entregar, e o que o parceiro leu ontem pode estar desatualizado.

O terceiro item e o mais importante dos tres em atendimento com estadia (hotel, internacao), onde o quadro muda no meio.

### 3.2 Filtro novo

Somar aos filtros ja existentes: **com prontuario compartilhado** (`DIARIO` ou `DOCUMENTOS` presentes). Um acesso com prontuario pede leitura antes do atendimento; um acesso so de identidade, nao.

### 3.3 Continuidade do atendimento

O parceiro ja registra anotacao estruturada por tipo de servico. Com a ficha disponivel, a tela de anotacao deve manter o **motivo da visita e as evidencias visiveis enquanto ele escreve**, em coluna lateral ou cabecalho fixo. Escrever o retorno sem ver a queixa e o que produz laudo que nao responde a pergunta do tutor.

---

## 4. Gate operacional (cuidado conhecido)

O gate de parceiro operacional (`ativo = true` e `statusAuditoria = APROVADO`) se aplica a **mutacoes**: reivindicar codigo e criar anotacao. **Leitura nao e gated**: parceiro suspenso depois do claim continua lendo ate o acesso expirar, e o tutor pode revogar a qualquer momento.

Isso e comportamento aceito e registrado na Parte 8, nao um bug a corrigir no front. A rota nova de arquivo (secao 2) **segue a mesma regra das demais leituras**: nao aplicar gate de auditoria nela, sob pena de divergir das outras tres e criar um caso em que a pagina abre mas o exame nao.

---

## 5. Acceptance Criteria

- [ ] **AC1 Given** o mesmo acesso aberto no canal publico e no portal **Then** ficha, diario e documentos sao identicos, campo a campo.
- [ ] **AC2 Given** o portal **Then** nenhuma informacao do tutor ou do pet aparece alem do que o canal publico expoe.
- [ ] **AC3 Given** um paciente com motivo da visita **Then** a lista mostra o motivo sem exigir abrir o detalhe.
- [ ] **AC4 Given** um acesso cujo tutor atualizou o resumo **Then** a linha exibe o marcador de atualizado com a data.
- [ ] **AC5 Given** o filtro "com prontuario compartilhado" **Then** a lista traz apenas acessos com `DIARIO` ou `DOCUMENTOS`.
- [ ] **AC6 Given** o detalhe carregado **Then** nenhuma URL de arquivo foi solicitada antes do primeiro clique.
- [ ] **AC7 Given** um clique em arquivo **Then** a URL vem de `parceiro/portal/compartilhamentos/:id/arquivos/:arquivoId/url` e nao e reaproveitada em cliques seguintes.
- [ ] **AC8 Given** um parceiro suspenso apos o claim **When** abre um arquivo de um acesso ainda ativo **Then** consegue abrir (secao 4), mas nao consegue criar anotacao.
- [ ] **AC9 Given** a tela de anotacao **Then** motivo e evidencias permanecem visiveis enquanto o profissional escreve.
- [ ] **AC10 Given** um acesso revogado pelo tutor **When** o parceiro tenta abrir arquivo **Then** recebe erro de acesso encerrado e a tela reflete isso.
- [ ] **AC11 Given** usuario com duas memberships e sem `parceiroId` na query **Then** a chamada e recusada e a UI pede a selecao de parceiro.
- [ ] **AC12** Nenhuma copy contem em-dash; textos proprios do portal existem nos 4 locales com en-GB explicito.

---

## 6. Definition of Done

- [ ] Todos os AC verificados um a um
- [ ] Comparacao lado a lado com a pagina publica feita e registrada (AC1 e AC2)
- [ ] Auditoria de rede: nenhuma URL assinada no load, nenhuma em cache
- [ ] Fluxo exercitado: parceiro reivindica codigo, abre o paciente, le a ficha, abre um exame, registra anotacao
- [ ] Typecheck e lint limpos no repo do portal
- [ ] Ancoras de codigo desta spec preenchidas por quem implementar (ver aviso do topo)

---

## 6.1 Ancoras de codigo (preenchido na implementacao, 2026-08-14)

| O que | Onde |
|---|---|
| Rota de arquivo do prontuario | `src/service/parceiro/compartilhamentos-service.ts` (`getArquivoSignedUrl`) |
| Uma URL por clique, nada cacheado | `src/pages/(accounts)/parceiro/atendimentos/[id].vue` (`comArquivoUrl`) |
| 409 vira acesso encerrado e recarrega a tela | `src/utils/parceiro/arquivo-compartilhado.ts` + o mesmo `comArquivoUrl` |
| Blocos do snapshot, diario e documentos | `src/utils/parceiro/snapshot-compartilhado.ts` |
| Indicadores e filtro da lista | `src/pages/(accounts)/parceiro/atendimentos/index.vue` |
| Leitura nao gated, anotacao gated | `PartnerOperabilityBanner.vue` (`cover-suspended`) + `podeAnotar` no detalhe |
| Backend da lista | `petjourney-api`: `compartilhamento-prestador-parceiro.service.ts` (`listar`) e `dto/query-compartilhamento-parceiro.dto.ts` |

### Estado dos AC

Fechados: **AC2, AC4, AC5, AC6, AC7, AC8, AC10, AC11, AC12**.

Abertos, todos pelo mesmo motivo: **a Parte 12 nao existe no backend**. Nao ha `ficha`
no schema, no service nem no controller, entao nao ha o que renderizar.

- **AC1** fecha para diario e documentos; a comparacao campo a campo com a pagina
  publica so termina quando a ficha existir nos dois canais.
- **AC3** (motivo da visita na lista) depende da ficha.
- **AC9** (motivo e evidencias visiveis enquanto escreve) depende da ficha. O
  composer ja e coluna lateral fixa, entao sobra encaixar o conteudo quando ele existir.

### Desvio consciente do contrato da secao 3.1

A lista devolve **`temDiario: boolean`**, nao a contagem de entradas de diario que a
spec pede. A quantidade so existe dentro do snapshot, e a listagem nao carrega
snapshot de proposito (D8.2/D8.5): conta-la custaria carregar o JSON clinico de cada
linha da pagina. Para triagem, saber QUE ha diario ja decide a ordem de leitura.
Contagem exata pede uma coluna denormalizada, com migration e backfill.

`totalDocumentos` e contagem de verdade, vinda de `documentoIds`.

## 7. Perguntas em Aberto

- [ ] **1** A aba `veterinario` no `petjourney-app` e o portal web convivem, ou uma esta sendo descontinuada? Se convivem, esta spec vale para as duas e a lista precisa dos indicadores nos dois lugares. Responsavel: Nicolas.
- [ ] **2** O portal deve marcar visualmente o que ja foi lido pelo profissional? A trilha de aberturas passa a existir no backend (ver spec do CMS). Responsavel: Nicolas.

## Change Log

| Data | Versao | Mudanca | Autor |
|---|---|---|---|
| 2026-08-05 | 0.1 | Criacao | Nicolas via Claude |
| 2026-08-14 | 0.2 | Implementacao no portal e na lista do backend. Ancoras preenchidas, AC pendentes isolados na Parte 12 | Claude |
