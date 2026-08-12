# Spec App: Partes 11 a 13 - Prontuario no Acesso Temporario (lado do tutor)

**Status:** Draft (depende do backend das Partes 11 a 13, hoje In Review)
**Autor:** Nicolas (via /spec-driven com Claude)
**Criado em:** 2026-08-05
**Plataforma alvo:** **App do tutor** (`petjourney-app`, Expo/RN)
**Specs backend:** [11-prontuario-no-acesso-temporario.md](11-prontuario-no-acesso-temporario.md), [12-ficha-de-encaminhamento.md](12-ficha-de-encaminhamento.md), [13-handoff-do-acesso.md](13-handoff-do-acesso.md)
**Specs irmas de front:** [web](11-13-prontuario-acesso-temporario-web.md), [portal](11-13-prontuario-acesso-temporario-portal.md), [cms](11-13-prontuario-acesso-temporario-cms.md)

> Auto-suficiente: quem fizer o app implementa 100% a partir daqui.

---

## 0. O que muda para o tutor (em 3 linhas)

Hoje o tutor escolhe 7 categorias e manda um link. Passa a poder mandar tambem **o que aconteceu com o pet** (os dias com sintoma, com data e foto) e **quais exames e receitas** o prestador pode ver, escolhidos um a um. Passa a poder dizer **por que** esta levando o pet, e a entregar tudo pelo WhatsApp com a mensagem ja escrita.

---

## 1. Estado atual (o que ja existe e nao muda de lugar)

| Peca | Caminho | Estado |
|---|---|---|
| Lista de acessos | `app/(fullscreen)/compartilhamento-prestador/index.tsx` | Pronta, integrada |
| Criacao | `app/(fullscreen)/compartilhamento-prestador/novo.tsx` | Pronta: pet, tipo de servico, empresa, duracao, categorias, mensagem |
| Detalhe | `app/(fullscreen)/compartilhamento-prestador/detalhe.tsx` | Pronto: codigo, link, snapshot, anotacoes, anexos, revogar |
| Contrato e tipos | `src/features/compartilhamento-prestador/types.ts` | Union `CategoriaInfoCompartilhada` e `CATEGORIAS_INFO_PADRAO` |
| Metadata visual | `src/features/compartilhamento-prestador/meta.ts` | `CATEGORIA_INFO_META` |
| Chamadas | `src/features/compartilhamento-prestador/service.ts` | Padrao do modulo |

> **Alavanca de compilador:** `CATEGORIA_INFO_META` e um `Record<CategoriaInfoCompartilhada, MetaVisual>` completo. Ao adicionar `DIARIO` e `DOCUMENTOS` ao union em `types.ts`, o TypeScript **exige** as duas entradas novas de metadata. Comece por aI e siga os erros; nao existe caminho em que o chip novo apareca sem icone.

---

## 2. Contrato (o que a API passa a aceitar e devolver)

```ts
type CategoriaInfoCompartilhada =
  | "ALERGIAS" | "VACINAS" | "MEDICAMENTOS" | "PESO"
  | "COMPORTAMENTO" | "DIAGNOSTICOS" | "OBSERVACOES"
  | "DIARIO"        // Parte 11
  | "DOCUMENTOS";   // Parte 11

type MotivoVisita =
  | "CHECKUP" | "SINTOMA" | "RETORNO" | "EXAME" | "VACINA" | "EMERGENCIA" | "OUTRO";
```

**`POST tutor/compartilhamentos-prestador`** ganha campos opcionais:

```jsonc
{
  "petId": "...", "tipoServico": "CONSULTA", "duracaoHoras": 48,
  "categorias": ["ALERGIAS", "DIARIO", "DOCUMENTOS"],
  "documentoIds": ["doc_1", "doc_2"],   // obrigatorio se categorias inclui DOCUMENTOS
  "motivoVisita": "SINTOMA",             // opcional
  "motivoDescricao": null,               // obrigatorio se motivoVisita = OUTRO
  "sintomasQueixa": ["VOMITO"],          // so aceito junto com DIARIO
  "mensagemTutor": "..."
}
```

**Rotas novas:**

| Rota | Uso |
|---|---|
| `POST tutor/compartilhamentos-prestador/:id/atualizar-resumo` | Regera o resumo de um acesso ATIVO |
| `GET tutor/compartilhamentos-prestador/:id/handoff?incluirAlertas=&telefone=` | Mensagem pronta e link `wa.me` |
| `GET tutor/compartilhamentos-prestador/:id/arquivos/:arquivoId/url` | Abre arquivo do acesso (URL assinada com TTL) |

**Erros novos que a UI precisa tratar:**

| Chave | HTTP | Quando | O que a UI faz |
|---|---|---|---|
| `DOCUMENTOS_SELECAO_OBRIGATORIA` | 400 | Marcou a categoria e nao escolheu documento | Volta ao passo de documentos e destaca |
| `COMPARTILHAMENTO_JA_ENCERRADO` | 409 | Atualizar resumo ou handoff em acesso encerrado | "Este acesso ja terminou", recarrega |
| Teto de arquivos ou de bytes | 400 | Passou de 10 documentos, 30 arquivos ou 50 MB | Mostra o teto atingido e o que remover |

---

## 3. Tela: Novo acesso

### 3.1 Os dois chips novos

`DIARIO` e `DOCUMENTOS` entram na grade de categorias existente.

- **Diario do pet.** Sublabel: "Os dias em que ele passou mal, com data e foto". Icone coerente com o modulo de diario.
- **Exames e receitas.** Sublabel: "Voce escolhe quais". Icone de documento.

**Nao entram em `CATEGORIAS_INFO_PADRAO`.** As categorias marcadas por default sao as de identidade clinica; diario e documento carregam muito mais dado pessoal e a escolha precisa ser deliberada.

### 3.2 Seletor de documentos (aparece ao marcar `DOCUMENTOS`)

Sem escolher documento, a categoria nao vale e a API recusa. Entao marcar o chip **abre o seletor na hora**, e nao no fim do formulario.

Lista os documentos do pet (nome, tipo, data, quantidade de arquivos), com selecao multipla, ate **10**.

**Aviso obrigatorio, sempre visivel** (nao e um tooltip, nao e um "saiba mais"):

> Exames e receitas costumam ter os seus dados pessoais no cabecalho, como nome completo, CPF e endereco. Escolha so o que o prestador precisa ver.

**Motivo:** este e o unico ponto do produto em que o tutor entrega PII **dele proprio**, e o destinatario pode ser um hotel de pet. O aviso e a mitigacao do risco Alto da Parte 11 e nao pode ser escondido atras de interacao.

Estado vazio: "Este pet ainda nao tem documentos", com atalho para adicionar.

### 3.3 Motivo da visita (Parte 12)

Aparece quando `tipoServico` for `CONSULTA` ou `EXAME`. Opcional.

Seletor de `MotivoVisita`. Em `OUTRO`, campo de texto obrigatorio.

Com `SINTOMA` ou `RETORNO` **e** `DIARIO` marcado, aparece o seletor de **sintomas da queixa** (ate 5), alimentado por `GET /diario-pet/enums`. A copy explica o ganho: "O vet vai ver os dias em que isso aconteceu, com data".

Se `DIARIO` nao estiver marcado, o seletor de sintomas nao aparece: a API recusa queixa sem o diario que a sustenta.

### 3.4 Ordem dos passos

Pet, tipo de servico, empresa, duracao, **motivo** (quando aplicavel), categorias, **documentos** (quando aplicavel), mensagem. Motivo antes de categorias porque ele contextualiza a escolha: quem esta indo por sintoma tende a querer o diario.

---

## 4. Tela: Detalhe do acesso

### 4.1 O que o prestador esta vendo

Bloco novo, para o tutor conferir o que entregou: chips das categorias, lista dos documentos escolhidos, contagem de entradas do diario e o periodo coberto. Arquivos abrem por `GET :id/arquivos/:arquivoId/url`.

### 4.2 Atualizar resumo

Botao **Atualizar resumo**, visivel apenas com `status = ATIVO`.

Explicacao curta: "O prestador passa a ver o que voce registrou ate agora. As categorias e os documentos escolhidos continuam os mesmos."

Depois de atualizar, mostrar `snapshotAtualizadoEm` ("Atualizado hoje as 14h"). Limite de 10 por acesso; ao estourar, desabilitar com a razao visivel.

**Nao oferecer** quando encerrado: o botao some, nao fica cinza sem explicacao.

### 4.3 Handoff por WhatsApp (Parte 13)

Substitui o share do link cru como acao primaria. "Copiar link" permanece como secundaria.

Fluxo: toca em **Enviar pro vet**, o app chama `GET :id/handoff`, mostra **preview do texto** e abre o `linkWhatsApp` no share nativo.

O preview nao e enfeite: o tutor precisa ver o que vai sair antes de sair.

**Toggle "Incluir alertas de saude na mensagem"**, desligado por default, com a razao ao lado:

> A mensagem fica salva na conversa e pode ser encaminhada. O link ja leva tudo, com prazo.

Ao ligar, o preview atualiza mostrando os alertas que entram (maximo 3).

---

## 5. Regras de UI

1. Categoria nao marcada nunca aparece no detalhe, nem como bloco vazio.
2. Arquivo abre sempre por URL assinada obtida na hora. **Nunca** cachear a URL, nunca persistir em estado global: ela expira.
3. Ao remover o ultimo documento do seletor com `DOCUMENTOS` marcado, desmarcar o chip e avisar, em vez de deixar o usuario chegar no 400.
4. Contagem de arquivos e de MB visivel no seletor conforme seleciona ("5 de 30 arquivos, 12 MB de 50 MB"). O tutor descobre o teto antes de submeter.
5. Sem em-dash em nenhuma copy.
6. Todo texto novo passa por i18n, com en-GB explicito.

---

## 6. Acceptance Criteria

- [ ] **AC1 Given** a tela de novo acesso **Then** existem os chips Diario e Exames e receitas, e nenhum dos dois vem marcado por default.
- [ ] **AC2 Given** o tutor marca Exames e receitas **Then** o seletor de documentos abre imediatamente, com o aviso de dados pessoais visivel sem interacao.
- [ ] **AC3 Given** o tutor marca a categoria e nao escolhe documento **When** tenta criar **Then** o app bloqueia antes da chamada e destaca o passo.
- [ ] **AC4 Given** o tutor seleciona 11 documentos **Then** o 11o e recusado com o teto explicado.
- [ ] **AC5 Given** `tipoServico = BANHO` **Then** o seletor de motivo da visita nao aparece.
- [ ] **AC6 Given** `tipoServico = CONSULTA` e motivo `SINTOMA` com `DIARIO` marcado **Then** o seletor de sintomas da queixa aparece e aceita ate 5.
- [ ] **AC7 Given** motivo `SINTOMA` sem `DIARIO` marcado **Then** o seletor de sintomas nao aparece.
- [ ] **AC8 Given** motivo `OUTRO` sem descricao **Then** o app bloqueia e destaca o campo.
- [ ] **AC9 Given** um acesso ATIVO **When** o tutor toca em Atualizar resumo **Then** o detalhe recarrega e mostra a data da atualizacao.
- [ ] **AC10 Given** um acesso EXPIRADO **Then** o botao Atualizar resumo nao aparece.
- [ ] **AC11 Given** o tutor toca em Enviar pro vet **Then** ve o preview do texto antes de qualquer share.
- [ ] **AC12 Given** o toggle de alertas desligado **Then** o preview nao cita alergia, medicacao nem sintoma.
- [ ] **AC13 Given** o toggle ligado **Then** o preview passa a citar no maximo 3 alertas.
- [ ] **AC14 Given** o detalhe de um acesso com documentos **When** o tutor abre um arquivo **Then** o app busca a URL assinada na hora e nao reusa URL anterior.
- [ ] **AC15 Given** um acesso encerrado **When** o tutor pede o handoff **Then** recebe 409 e ve "Este acesso ja terminou".
- [ ] **AC16** Nenhuma copy nova contem em-dash, verificado por teste.
- [ ] **AC17** Todas as strings novas existem em pt-BR, en-US, en-GB e es-ES.

---

## 7. Definition of Done

- [ ] Todos os AC verificados um a um
- [ ] `CATEGORIA_INFO_META` completo (o compilador prova)
- [ ] Typecheck e lint limpos
- [ ] Fluxo real exercitado: criar acesso com diario e 2 documentos, abrir o link em aba anonima no celular, conferir, atualizar resumo, enviar por WhatsApp de verdade
- [ ] Teste de em-dash e de completude de i18n passando
- [ ] Nenhuma URL assinada persistida em estado ou storage

## 8. Perguntas em Aberto

- [ ] **1** O seletor de documentos deve permitir criar documento novo ali mesmo (camera ou arquivo), ou so escolher entre os existentes? Escolher-apenas e o escopo desta leva. Responsavel: Nicolas.
- [ ] **2** Vale mostrar ao tutor quantas vezes o prestador abriu cada arquivo? O backend tera a trilha (ver spec do CMS). Aumenta confianca e tambem ansiedade. Responsavel: Nicolas.

## Change Log

| Data | Versao | Mudanca | Autor |
|---|---|---|---|
| 2026-08-05 | 0.1 | Criacao | Nicolas via Claude |
