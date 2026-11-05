# Plano de implementação: tarefas do Luís em novembro (Q4)

**Feito em:** 04/11/2026, depois de ler os 15 cards do Luís no quadro de novembro do Nevo, as 72
subtarefas, os guias anexados e os comentários do Nicolas até 04/11.
**Onde está o material:** `cards-do-nevo.md` (descrição e comentários de cada card) e `guias/` (a
versão mais nova de cada guia de front). O Nevo continua sendo a fonte da verdade: antes de começar
um card, reconfira se o guia dele foi reanexado.

## Andamento

| Data | Item | Commit | Status no Nevo |
|---|---|---|---|
| 04/11 | Contrato da API de 03/11 (762 rotas) | `f56f34e` | (sem card) |
| 04/11 | Teste da Pérola que falhava de manhã | `3b016d1` | (sem card) |
| 04/11 | 0.1 PJ-VK5P13 convite com a conta errada | `f867aa4` | Em teste (fluxo de equipe e envio já testado pelo Luís; roteiro em `testes.md`) |
| 04/11 | 0.2 PJ-XOI9HR merge da `redesign/portal` | já estava no `main` | Em teste |
| 04/11 | 0.3 PJ-RWQBMT `/veterinario` vira `/clinica` | `14da2a4`, `b3c297b` (só formatação) | Em teste |
| 04/11 | 0.4 PJ-TYT5JY docs do lado do responsável | `c2f0d35` | Em teste |
| 04/11 | 0.5 PJ-49U4QS Idempotency-Key e código do erro (E1-04) | `e291e95` | Em teste |
| 04/11 | 0.6 PJ-IWQ1F4 módulos pelo servidor (E1-02) | `7e8646a` | Em teste |
| 04/11 | 0.7 PJ-2VAFXX profissionais e funções (E1-03) | `846c6b1` | Em teste |
| 04/11 | 0.8 PJ-2OPCOW parte do portal (E1-07c) | `bb4debe` | Em andamento (faltam app e CMS) |
| 04/11 | 1.1 PJ-DXT9T5 Meu estabelecimento (E1-01) | `779153a`; melhorias `2f02761`, `e75462c`, `5537d33`, `a080ac2`, `c01a0c5`, `379d51c`, `3d57a85`, `fdd6c6a`, `dbd091e` | **Concluído** (testado pelo Luís em 04/11; a rota de lote dos dias especiais é a PJ-I98ATI, do Nicolas) |
| 04/11 | 1.2 PJ-KE667M parte do portal (link e QR) | `779153a`, QR com PNG, SVG e folha do balcão | Em andamento (portal testado pelo Luís em 04/11; falta a página no site) |
| 04/11 | 1.3 PJ-UFRXH6 auditoria da equipe (E1-05) | `fccd243` | Em teste |
| 04/11 | 1.4 PJ-1HX14U selos, pauta do Início e sino pela API (E1-06) | `420ae3e` | Em teste |
| 04/11 | 1.5 PJ-W8TOBS identidade da pessoa, selo e CNPJ alfanumérico (E1-08) | `e4ce0fc` | Em teste desde 04/11 (o aviso nos botões de assinar entra com as telas de assinar, ondas 4 e 5; lacuna N11) |
| 04/11 | E1 no site (`petjourney-web`): PJ-KE667M página pública `/agendar` e `/reservar`, PJ-BY8ULR CNPJ no cadastro | `d78562d`, `bd2e2ce` (no develop do site) | Em teste (KE667M completo: portal e site) |
| 04/11 | E1 no CMS (`petjourney-cms`): PJ-IPL2CL módulos, PJ-9OAGFK conferir CRMV, PJ-DYEN21 fila de identidade, PJ-2OPCOW parte do CMS | `a208af2`, `f4d7134`, `903b841`, `c43fdd3` (no develop do CMS) | Em teste (2OPCOW completo: portal, app e CMS) |
| 04/11 | E1 no app (`petjourney-app`): PJ-80M7IL avisos de módulo, PJ-K49ST6 tipos e erro pelo código, PJ-A5TIS6 "Quem viu", PJ-2OPCOW parte do app | `10cc287`, `3b76917`, `521d6a9`, `79e3918` (no develop do app; não gerar build de loja antes da API de develop ir para produção) | Em teste |
| 05/11 | PJ-HZC7C6 "Apagar vários" num pedido só (`POST .../dias-especiais/remover`, até 500 por pedido); contrato de 04/11 (`7e194ba`, 763 rotas) | (este commit) | Em teste (3 dias num POST só e o dia já apagado em outra aba vistos no dev; OPERADOR e mais de 500 só em teste de unidade) |
| 05/11 | 1.7 PJ-4NARE1 ficha de emergência pelo QR: "Emergência pelo QR" em Acessos, gaveta com o endereço do QR e o motivo, ficha curta e erros pelo código | (este commit) | Em teste (403 real visto na conta do Daniel, sem o selo; ficha aberta, 404 e 429 vistos com a resposta simulada, para não avisar o responsável de um pet real; câmera fora, lacuna N19) |
| 05/11 | 2.1 PJ-ECWI3Z pacientes e clientes pela API: lista com busca, espécie e inativos; ficha do cadastro (`/clinica/ficha/:id`) com dados, foto, alertas (teto de 50), responsável, autorizados, óbito, inativar, reativar, mesclar e exclusão a pedido do titular; cadastro novo com cliente da casa ou novo | (este commit) | Em teste (tudo visto no dev na Bem-Estar, com cadastros de teste já excluídos; o mesclar de paciente dá 500 na API, lacuna N20; mesclar responsável e o 409 de CPF repetido não vistos) |
| 05/11 | 2.2 PJ-HD8PAB propor vínculo: "Ligar ao app" na ficha (código de balcão em dois blocos com impressão, e-mail e QR da carteirinha), propostas com o estado e cancelar, o vínculo com o consentimento e encerrar, pedidos de correção (aba Correções e na ficha), "Ligar ao cadastro" no acesso temporário e os avisos de vínculo no sino | (este commit) | Em teste (código e QR gerados e cancelados no dev na Bolota; e-mail não enviado de propósito, o cadastro é de teste; por acesso e o vínculo ativo só em teste de unidade, sem acesso ativo nem pet ligado no dev) |
| 05/11 | E4 no CMS: PJ-R4HBGA curadoria do catálogo clínico global | `ae1325f` (no develop do CMS) | Em teste |
| 05/11 | 3.1 PJ-GL3IVL configuração da agenda pela API: Clínica › Configuração com Salas (criar, renomear, tipo, reordenar, desativar e reativar), Tipos de atendimento (duração, salas compatíveis, encaixe, online desligado para cirurgia e emergência), Bloqueios (único, período ou semanal, da clínica, do profissional ou da sala; editar e apagar "só neste dia" ou a série) e Política (faixas da API); expediente e sala padrão na ficha do profissional (Equipe › Profissionais › Expediente) | (este commit) | Em teste (tudo visto no dev na Bem-Estar: salas e tipos criados ficam como dado de teste, a política ficou com cancelar até 4 h; bloqueios e o expediente de teste foram desfeitos; o profissional "Teste Expediente" ficou desativado) |
| 05/11 | 3.5 PJ-SVL85R parte do portal: Pedidos de horário pela API (a caixa por situação, com o prazo e a folhinha riscada; a gaveta de resposta com a queixa e o telefone, o horário pedido, outro horário pelas sugestões, o melhor horário, recusar com motivo e mensagem, o 409 `HORARIO_JA_TOMADO` levando às sugestões ou ao encaixe; os avisos ao responsável) e "Como recebemos pedidos" (ligar, caminhos, site, quem atende, aceitar sozinho só de quem já é cliente, serviços, profissionais, prazos e o link do site) | (este commit) | Em teste (card completo: site em `e53dfeb`, portal aqui). Visto no dev na Bem-Estar com 5 pedidos criados pela rota pública do site: aceitar o pedido, outro horário, melhor horário, recusar, o horário tomado. O encaixe de propósito dá 400 na API (N23); a lista e as sugestões não aceitam `parceiroId` (N22); a hora de um aceito antigo não vem (N24) |
| 05/11 | 2.4 PJ-AI84L1 "Este pet em 30 segundos" e o diário pela API: na ficha do cadastro (`/clinica/ficha/:id`), para quem tem `prontuario.ler`, o que chama atenção (risco primeiro), em casa pelo Diário Pet, o peso de 6 meses, a medicação e a carteirinha do app; "Ver o diário" com as entradas rotuladas, o "desde" até 90 dias e a foto pela URL de 15 minutos; os estados sem ligação, não liberado, sem diário no plano e o 429 | `228196a` | Em teste (sem ligação visto no dev na Bolota; o resumo, o diário e as fotos em HEIC e indisponível vistos com a resposta simulada, sem pet ligado ao app no dev; a foto aberta pela URL de verdade não foi vista). O `resumo-do-paciente.ts` segue só para a demonstração; a adesão (E4-05) fica para o PJ-LU09N7 |
| 05/11 | 3.4 PJ-07YV9I fila de espera pela API: Clínica › Fila de espera com as ativas na ordem do servidor (posição, janelas agrupadas, prioridade, oferta com o prazo, a automática e o sem canal) e a aba "não responderam"; "Adicionar à fila" com paciente, serviço, profissional, prioridade, janelas e observação interna, com os 409 no campo; "Vagas para a fila" com os primeiros candidatos e o "Ofertar" com a mensagem revista e o prazo da política; o sim e o não do telefone e o remover | (este commit) | Em teste (visto no dev na Bem-Estar: a Bolota entrou na fila de sexta 08:00 a 12:00, o cancelamento das 09:00 virou vaga, a oferta saiu com "sem canal no app" e o sim pelo telefone marcou 06/11 09:00). A regra de `domain/waitlist.ts` segue só para a demonstração |

Lacunas e decisões provisórias: `lacunas.md`.

---

## 1. O quadro em números

| | Portal (`petjourney-admin`) | App | Site | CMS | Total |
|---|---|---|---|---|---|
| Itens | 45 | 24 | 7 | 5 | 81 itens de trabalho em 87 cards e subtarefas |

Card de duas superfícies conta uma vez em cada. Os cards pai dos épicos e o card geral não contam:
eles andam com as subtarefas.

- **A API de tudo está pronta.** Os 8 épicos de API de outubro (E0 a E7) estão "Concluído", e todo
  guia de novembro foi reanexado em 29 e 30/10 na versão final. Nenhum card espera o Nicolas para
  começar.
- **Mas a API nova só existe na API de dev**, não em produção. Daí a regra 2.1 abaixo.
- **Os prazos são sugeridos** (os próprios cards dizem "ajustar com o Nicolas"): vão de 06/11 a
  30/11. São muitos itens para quatro semanas; a ordem abaixo põe primeiro o que destrava o resto e o
  que vence antes.

## 2. Como vamos trabalhar

### 2.1 Ramo

- Tudo do portal num ramo só, **`feat/portal-novembro`**, criado do `develop` no próprio repositório
  (sem worktree). O `develop` e o `main` ficam livres: o `main` vai para produção, e a produção não
  tem as rotas novas.
- Um commit por card (ou por subtarefa), mensagem em português (`feat:`/`fix:`), com a chave do Nevo
  no fim. Sem push: quem sobe é o Luís.
- Nos outros repositórios (site, CMS, app), o mesmo nome de ramo, criado do `develop` de cada um,
  pelo mesmo motivo.
- O ramo antigo `feat/integracao-portal-parceiro-novembro` (22/10) tem E1-01 a E1-06, a troca de
  `/veterinario` por `/clinica` e os docs do M13 prontos, mas no desenho de antes da migração e 45
  commits atrás. Ele é a base de partida desses cards: traz-se a lógica (serviços, testes,
  composables) e refaz-se a tela no desenho atual. O guia da E1 mudou depois dele (seções 8 e 9),
  então cada um desses cards também ganha o que o guia acrescentou.

### 2.2 Status no Nevo

- Ao começar uma subtarefa: ela vai para **Em andamento**, e o card pai também (se ainda não estiver).
- Ao terminar: a subtarefa vai para **Em teste**. O card pai vai para Em teste quando todas as
  subtarefas dele estiverem em teste. Quem conclui é o time.
- Card que mexe em mais de uma superfície (ex.: KE667M, site e portal) só vai para Em teste quando as
  duas partes estiverem feitas.

### 2.3 Pronto, para cada card

1. Lidos por inteiro: a descrição, a seção do guia e os comentários do card.
2. `npm run contrato:gerar` se o `develop` da API andou.
3. Implementado só o que o guia pede, no padrão do repositório; regra local que a API passou a
   calcular é apagada (P2 do épico).
4. Mock só em desenvolvimento e na conta de demonstração.
5. Textos nos 6 idiomas, sem travessão e sem "tutor".
6. `vue-tsc`, `vitest`, `check:i18n` e lint nos arquivos tocados, limpos.
7. Tela vista contra a API de dev, nos dois temas, em 1440, 1024 e 768.
8. Erro ou lacuna da API: anotado em `lacunas.md` (nesta pasta) e virando tarefa "🔴 NICOLAS
   RESPONDE" no Nevo. Erro da API não se conserta no front.

---

## 3. Portal, em ondas

Na tabela, "guia" é a seção do guia em `guias/`. "Base" diz o que já existe para aproveitar.

### Onda 0: o que vence primeiro e o que todo o resto usa (até 11/11)

| # | Card | O quê | Prazo | Guia | Base |
|---|---|---|---|---|---|
| 0.1 | **PJ-VK5P13** | Convite aberto com a conta errada: estado "Este convite é para outra conta", entrar com outra conta sem perder o token, `jaEraMembro` | **07/11** | `convite-equipe-conta-conectada.md` | tela de 08e0b23 no develop |
| 0.2 | PJ-XOI9HR | Mesclar a `redesign/portal` no main | 04/11 | (sem guia) | **Já está feito**: a `redesign/portal` inteira está no `main`. Só mover o status |
| 0.3 | PJ-RWQBMT | `/veterinario/*` vira `/clinica/*`, com redirect | 11/11 | análise, M2 | 07433f0 (ramo antigo). Vem antes de tudo do clínico: depois dele, cada card mexe nos caminhos novos |
| 0.4 | PJ-TYT5JY | Docs `clinico/09`, `12`, `14` e `16` apontam para o OpenAPI | 11/11 | análise, M13 | 149ac9c (ramo antigo) |
| 0.5 | PJ-49U4QS | E1-04: tipos gerados (já há), erro pelo `codigo` (já há), `Idempotency-Key` nas criações, captcha nas páginas públicas | 11/11 | e1 §3 e `front-lacunas-l1-a-l6.md` | e353120 (ramo antigo) |
| 0.6 | PJ-IWQ1F4 | E1-02: menu e módulos pelo servidor; `?clinico=on` e mock fora do build de produção | 11/11 | e1 §2.1 | 03a50cc (ramo antigo) |
| 0.7 | PJ-2VAFXX | E1-03: profissionais com CRMV, funções na equipe, menu pelo `/parceiro/portal/eu`; mais o de 30/10: selo efetivo na lista, `selosVencendo`, aviso antes de salvar que o selo sai, `usuarioId: null` | 11/11 | e1 §4 e §9.1 | 8babab4 (ramo antigo) |
| 0.8 | PJ-2OPCOW (parte do portal) | E1-07c: `login.vue` e `auth-session.ts` decidem pelo `/auth/perfis`; Configurações sem CRMV e especialidade | 30/11 | e1 §8.3 e §8.8 | novo |

### Onda 1: fundação com tela (até 18/11)

| # | Card | O quê | Prazo | Guia | Base |
|---|---|---|---|---|---|
| 1.1 | PJ-DXT9T5 | E1-01: "Meu estabelecimento": perfil, horários, feriados, slug, publicar; fuso IANA | 11/11 | e1 §1.1 e §1.3 | 67499fc (ramo antigo); tela refeita em gaveta, no desenho atual |
| 1.2 | PJ-KE667M (parte do portal) | Bloco "Sua página pública" com link e QR para o site | 11/11 | e1 §1.2 | 67499fc |
| 1.3 | PJ-UFRXH6 | E1-05: tela de auditoria da equipe | 11/11 | e1 §5 | ab4f572 (ramo antigo) |
| 1.4 | PJ-1HX14U | E1-06: selos do menu, números do Início e inbox por parceiro pela API | 11/11 | e1 §6.1 e §6.2 | 907132a (ramo antigo) |
| 1.5 | PJ-W8TOBS | **E1-08: identidade da pessoa e aviso do selo nos botões de assinar.** Sem ele ninguém novo assina receita, prontuário ou prescrição | 18/11 | e1 §9.1 | novo |
| 1.6 | PJ-QDDJOQ (já Em teste) | Trazer ao ramo o protótipo do histórico que viaja com o pet, que ficou só no ramo de integração e nunca chegou ao develop | 14/11 | `ficha-de-emergencia-por-qr.md`, `acesso-temporario-aberturas-...md` | d3de901 e 4cd31a7 |
| 1.7 | PJ-4NARE1 | Ficha de emergência pelo QR da coleira: motivo, ficha curta, os 4 erros pelo código | 13/11 | `front-lacunas-l1-a-l6.md` (L6, Portal) | novo; troca a parte de emergência do protótipo 1.6 |
| 1.8 | PJ-NLA4JS | Protótipo do pedido pelo app em poucos passos: pet único já escolhido, motivo que sugere a duração | 14/11 | `docs/clinico/18` | protótipo de `/veterinario/pedidos` |

### Onda 2: clientes, pacientes e a ponte com o app (até 25/11)

| # | Card | O quê | Prazo | Guia |
|---|---|---|---|---|
| 2.1 | PJ-ECWI3Z | E2-01: busca, ficha, alertas (teto de 50), autorizados, mesclar, óbito, anonimizar e exclusão com prontuário bloqueado 5 anos; espécie no enum da API | 11/11 | e2 §1 e §6 |
| 2.2 | PJ-HD8PAB | E2-02: propor vínculo por e-mail, código de balcão, acesso temporário e QR; caixa de pedidos de correção | 11/11 | e2 §2 |
| 2.3 | PJ-NSCETD | E2-05: migrador em lotes, dúvidas do servidor, acompanhar o job e desfazer | 18/11 | e2 §4 |
| 2.4 | PJ-AI84L1 | E2-03: "Este pet em 30 segundos" e diário pela API; apagar `resumo-do-paciente.ts` | 25/11 | e2 §5 |

E2-01 é a base de quase tudo do clínico daqui em diante (agenda, prontuário, internação).

### Onda 3: agenda e recepção (até 25/11)

| # | Card | O quê | Prazo | Guia |
|---|---|---|---|---|
| 3.1 | PJ-GL3IVL | E3-01: salas, tipos de atendimento, expediente por profissional, bloqueios, política | 18/11 | e3 §1 |
| 3.2 | PJ-4BS8TK | E3-02: dia, semana, criar, mover, cancelar, desfazer, chegada, versão e conflitos do servidor; apagar `conflicts.ts`, `slots.ts`, `load.ts` | 18/11 | e3 §2 |
| 3.3 | PJ-MVMNOZ | E3-03: faltas, em lote, justificar, painel, histórico, reagendar | 18/11 | e3 §3 |
| 3.4 | PJ-07YV9I | E3-04: fila de espera, posição, elegíveis, oferta com prévia | 18/11 | e3 §5 |
| 3.5 | PJ-SVL85R (parte do portal) | E3-05: caixa de pedidos (aceitar, outro horário, recusar; 409 `HORARIO_JA_TOMADO`) e configuração (`aceitarSozinho` só para cliente da casa) | 18/11 | e3 §6 e §6.12 |
| 3.6 | PJ-OKGQZP | E3-07: pré-consulta na anamnese, só em campo vazio, marcada "do diário" | 25/11 | e3 §7 |
| 3.7 | PJ-W2RB1D | E3-08: Meu dia, Atividades, resumo e Início pelas rotas de painel; apagar `resumo.ts` | 25/11 | e3 §8 e e5 §6 |

### Onda 4: prontuário, receita, vacinas e adesão (até 25/11)

| # | Card | O quê | Prazo | Guia |
|---|---|---|---|---|
| 4.1 | PJ-7JRYWN | E4-02: bulário, catálogos e dose pela API (teto de 2.000 medicamentos, `manipulado`) | 18/11 | e4 §1 |
| 4.2 | PJ-QQT1WN | E4-01: prontuário com autosave, edição exclusiva, finalizar e anular com senha e selo, adendo, liberar resumo, retorno, linha do tempo | 25/11 | e4 §5, §11 e §15 |
| 4.3 | PJ-L3V7JK | E4-03: receita assinada com senha e selo, faixa de dose, peso, controlados fora do PDF, PDF, cancelar, repetir; tirar "assinada" da demonstração | 25/11 | e4 §6 |
| 4.4 | PJ-VQVQ0C | E4-04: aplicar com lote, dose de outro lugar, plano, lista de chamada, anular | 18/11 | e4 §3 (e e6 §8 quando o estoque entrar) |
| 4.5 | PJ-LU09N7 | E4-05: faixa de doses, "pedem atenção", crítico, registrar contato | 25/11 | e4 §7b e `spec-e4-05-...md` |
| 4.6 | PJ-0EK0TY | E4-06: documentos, termos, laudos, cópia do prontuário (com internações e `ENCERRADO_NA_EXCLUSAO`) | 25/11 | e4 §8, §9, §10 e §14 |

4.2, 4.3 e 4.6 dependem da 1.5 (selo): sem ela, os botões de assinar não sabem avisar.

### Onda 5: internação e estoque (até 27/11)

| # | Card | O quê | Prazo | Guia |
|---|---|---|---|---|
| 5.1 | PJ-7G0NQI | E5-01: leitos, internar, mapa por urgência, encerrar nos três desfechos | 27/11 | e5 §1 a §12, §22 |
| 5.2 | PJ-2HGJUX | E5-02: prescrição (com selo), checklist, evolução, passagem de plantão | 27/11 | e5 §13 a §16, §20 |
| 5.3 | PJ-XW4PBB | E5-03: boletim retido até a ligação, fila de boletins pendentes, registrar ligação, automático | 27/11 | e5 §17 a §19, §21 |
| 5.4 | PJ-RFFOKT | E6-01: geladeira, receber lote, baixa, mínimo, movimentos, análise | 27/11 | e6 §1 a §14 |
| 5.5 | PJ-ZXGZ7P | E6-02: metas do mês, sugestão e pedido de compra | 27/11 | e6 §15 e §16 |

### Onda 6: hotel (até 30/11)

| # | Card | O quê | Prazo | Guia |
|---|---|---|---|---|
| 6.1 | PJ-OG9YPX | E7-01: blocos, tipos, acomodações, tarifas (`hotel.valores`), temporadas, serviços, política, exigências | 30/11 | e7 §1 a §11 |
| 6.2 | PJ-28JU4U | E7-02: grade, mapa, simular, criar, confirmar, cancelar, comprovantes, espera; apagar `tarifas.ts` e `disponibilidade.ts` | 30/11 | e7 §12 a §20, §27 a §34, §45 |
| 6.3 | PJ-6B946W (parte do portal) | E7-03: caixa do balcão (409 `SEM_VAGA_NO_ACEITE`) e configuração da reserva online | 30/11 | e7 §21, §22, §35, §38 a §40 |
| 6.4 | PJ-GLOYC4 | E7-04: check-in com a carteirinha do app, estadia, check-out (`SAIDA_BLOQUEADA`, óbito) | 30/11 | e7 §27, §41, §45 |
| 6.5 | PJ-21T3ER | E7-05: prancheta, rotina da casa, ocorrências com contato, turno, boletim | 30/11 | e7 §42 a §44 |
| 6.6 | PJ-62YZHU | E7-06: resumo do hotel e faturamento (`hotel.faturamento`) | 30/11 | e7 §20 e §20.1 |
| 6.7 | PJ-IVVK7O | Nome único para "Cuidador": família no clínico, equipe no hotel | 27/11 | análise, M6 |

---

## 4. Site, CMS e app

Ficam depois do portal, com uma exceção: quando o "pronto quando" de um card do portal só se prova
com a outra superfície, a parte dela vem logo em seguida.

| Junto de | Item | Repositório | Por quê |
|---|---|---|---|
| 1.5 (identidade) | PJ-DYEN21 + PJ-9OAGFK: fila de identidade e conferir CRMV | CMS | Sem a fila ninguém ganha o selo; ela expira em 14 dias, então sobe junto com a tela de envio |
| 1.2 (página pública) | PJ-KE667M, parte do site: `/agendar/<slug>` e `/reservar/<slug>` | site | O QR do portal precisa abrir a página |
| 1.7 (emergência) | PJ-3GVTOI: ficha de emergência no app | app | O pronto quando do portal é "o celular do responsável apita" |
| 3.5 (caixa de pedidos) | PJ-SVL85R, parte do site: pedido e `/pedido/<token>` | site | O pedido nasce no site |
| 6.3 (caixa do hotel) | PJ-6B946W, parte do site: pedido e `/reserva/<token>` | site | Idem |

Depois, por repositório, na ordem dos prazos:

- **Site:** PJ-BY8ULR (dígito do CNPJ), PJ-D5VP8X (link da proposta de vínculo abre o app), PJ-PLOD6B
  (verificação da receita pelo QR), PJ-FCP48H (verificação de documentos).
- **CMS:** PJ-IPL2CL (ligar e suspender módulo), PJ-R4HBGA (curadoria do catálogo), PJ-2OPCOW
  (filtro `VETERINARIO`).
- **App:** PJ-7M2VNJ (quem abriu o acesso temporário, **vence 06/11**), PJ-80M7IL, PJ-K49ST6,
  PJ-A5TIS6, PJ-2OPCOW, PJ-54B2YO, PJ-8BWAPV, PJ-KEDUBV, PJ-O5A3ME, PJ-KTCYO2, PJ-36ORD4, PJ-6W6XHY,
  PJ-1RTR5T, PJ-B4VSDJ, PJ-E3OKDS, PJ-XV0VW7, PJ-401I65, PJ-AEIQ9E, PJ-IZ4UNN, PJ-BFYEFS, PJ-N8E9AS,
  PJ-57E3MH.

---

## 5. Pontos de atenção

1. **PJ-7M2VNJ (app) vence em 06/11** e o PJ-3GVTOI (app) em 13/11. Seguindo "portal primeiro" à
   risca, os dois atrasam. São pequenos; vale encaixá-los logo depois da onda 0 se o prazo pesar.
2. **PJ-VZEBKP (carteirinha, app e API, com o Nicolas)** tem 4 decisões de produto pendentes na spec,
   a principal sobre o endereço na carteirinha pública. Fica parado até o Nicolas decidir.
3. **Anamnese por voz (E4-07):** o guia da E4 tem as seções 12, 13 e 15, mas não há card dela para o
   Luís. Ou falta o card, ou ela ficou fora de novembro. Pergunta para o Nicolas antes da onda 4.
4. **Fora deste quadro, mas parado:** o PJ-PSSZ28 (travessão, outubro, Em teste) também ficou só no
   ramo de integração. E o PJ-W8IZOX (Maestro, outubro) está com o sinal "Precisa de ajuste" do
   Nicolas desde 03/11.
5. **Testar convite e vínculo de verdade pede e-mail que chega.** As contas de teste usam
   `@example.com`; o link com o token só sai por e-mail. Para o PJ-VK5P13 e o E2-02 o teste real
   precisa de uma caixa de e-mail do Luís.
6. **O guia da E1 cresceu depois do ramo antigo:** a lista da equipe, o aviso do selo e o login pelo
   `/auth/perfis` mudam telas que o ramo antigo já fez. Cada card da onda 0 e 1 confere a seção 9.

## Change Log

| Data | Mudança |
|---|---|
| 04/11/2026 | Criação, depois da leitura de todos os cards de novembro |
