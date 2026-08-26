# Agosto no portal do parceiro

**Período:** 5 a 18 de agosto de 2026
**Repositório:** `petjourney-admin` (portal do parceiro, `web.petjourney.health`)
**Levantado em:** 18/08/2026, a partir do histórico de commits desde 05/08, das alterações não versionadas na árvore de trabalho e das 14 specs desta pasta.

> Duas semanas em que o portal deixou de ser só uma agenda de códigos e passou a mostrar o prontuário que o responsável liberou.

| | |
|---|---|
| Entregas que o parceiro percebe na tela | **10** |
| Commits de conteúdo (todos em 12/08) | **4** |
| Linhas prontas e ainda não commitadas | **2.174** |
| Specs escritas no período | **14** |

---

## 1. O que o parceiro consegue fazer agora

Cada bloco é um slide possível: o que ele enfrentava antes e o que a tela faz hoje. A etiqueta diz se já está versionado no repositório ou se está pronto na máquina, aguardando commit.

### 1.1 O prontuário chega junto do atendimento
**Estado:** pronto, não commitado

**Antes.** O parceiro via a identidade do pet e as listas clínicas resumidas. Exame, laudo e o diário que o responsável mantém no app não existiam nessa tela: para ver um raio-x, era pedir por WhatsApp.

**Agora.** O detalhe do atendimento tem duas seções novas. **Documentos** abre e baixa cada arquivo autorizado. **Diário do pet** mostra os dias com anormalidade dentro da janela liberada, com vitalidade, alimentação, hidratação, fezes, urina, ciclo de cio, remédios, observações e fotos.

> Cada arquivo pede uma URL assinada nova no clique, nunca no carregamento da página e nunca reaproveitada. Se o responsável revogar o acesso enquanto o profissional lê, o clique devolve "Acesso encerrado" e a tela se atualiza sozinha em vez de mostrar erro cru.

### 1.2 A lista de pacientes vira triagem
**Estado:** pronto, não commitado

**Antes.** Todas as linhas pareciam iguais. Só abrindo uma por uma dava para saber quais tinham material clínico para ler antes de atender.

**Agora.** Cada linha mostra quantos documentos vieram, se há diário e a data em que o resumo foi atualizado pelo responsável. Um filtro **Com prontuário** deixa na tela só quem exige leitura prévia.

> O marcador de resumo atualizado é o que mais rende em atendimento com estadia: hotel e internação, onde o quadro muda no meio e o que o parceiro leu ontem pode não valer mais.

### 1.3 Seção vazia passou a explicar por que está vazia
**Estado:** pronto, não commitado

**Antes.** Bloco sem itens simplesmente sumia. O profissional não sabia se o responsável não compartilhou aquilo, ou se compartilhou e não há registro — duas situações clínicas bem diferentes.

**Agora.** Categoria não compartilhada continua sem seção. Categoria compartilhada e vazia aparece com a frase certa: "O responsável não registrou alergias para este pet" ou, no diário, "Acompanhamento sem anormalidade registrada na janela compartilhada".

> Quando o motivo não vem do backend, a tela usa uma frase genérica em vez de deduzir. Afirmar que alguém não registrou algo no prontuário é uma acusação silenciosa; errar nela é pior do que ser vago.

### 1.4 O portal inteiro passou a falar o idioma da sessão
**Estado:** pronto, não commitado

**Antes.** A interface trocava de idioma, mas o conteúdo vindo da API continuava em português. Um parceiro no Reino Unido via os menus em inglês e o diagnóstico do pet em pt-BR, na mesma tela.

**Agora.** Toda chamada ao backend leva o idioma da sessão. Trocar o idioma no portal muda também espécie, diagnóstico e comportamento, sem precisar gerar o acesso de novo.

> É o achado mais "invisível" da leva e provavelmente o de maior alcance: valia para todo conteúdo traduzido do portal, não só para o prontuário. O portal atende Emirados Árabes, Reino Unido, Israel e Sérvia.

### 1.5 Programas escolhidos junto do credenciamento
**Estado:** pronto, não commitado

**Antes.** O parceiro enviava o cadastro, esperava a análise e só depois pedia o Programa Afiliado ou o Participativo — cada um virando um pedido novo, com nova espera.

**Agora.** O formulário tem uma aba de **Programas**: ele marca o que quer e vai tudo numa submissão só, decidido na mesma revisão. A tela de espera lista o que está em análise, cadastro e programas lado a lado.

> Programa já ativo ou suspenso não é alterado por aqui. Em caso de recusa, o formulário volta com os programas remarcados e um aviso de que os pedidos abertos foram cancelados — sem isso, o parceiro reenviaria sem programa nenhum sem perceber.

### 1.6 Trocar de empresa sem digitar identificador
**Estado:** no repositório

**Antes.** Quem atendia por mais de uma empresa precisava colar à mão o identificador interno do parceiro numa caixa de texto para trocar de contexto.

**Agora.** "Trocar de empresa" no menu lista as empresas da conta com nome, papel (Seu negócio / Equipe) e o status quando não estiver aprovado. Um clique troca, e nada da empresa anterior sobra na tela.

> O convite para cadastrar nova empresa some quando já existe um negócio próprio pendente ou aprovado, porque a API recusa o segundo. Se a membership for removida com o portal aberto, a tela avisa e recarrega em vez de travar do lado de fora.

### 1.7 Suspensão não apaga mais o atendimento em curso
**Estado:** pronto, não commitado

**Antes.** Cadastro suspenso batia num bloqueio de página inteira. O parceiro perdia o acesso à leitura de um prontuário que o responsável tinha autorizado, no meio de um atendimento já iniciado.

**Agora.** A leitura continua liberada, com um aviso explicando a situação. O que trava é o que muda dados: vincular códigos novos e registrar anotações ficam bloqueados até a suspensão ser resolvida.

> A regra vem do consentimento, não do cadastro: quem autorizou o acesso foi o responsável, e a suspensão é um assunto entre a empresa e a PetJourney.

### 1.8 Vincular código em seis caixas
**Estado:** pronto, não commitado

**Antes.** Um campo de texto comum aceitando até doze caracteres, com aviso de que espaços e hífens seriam ignorados.

**Agora.** Seis caixas em dois grupos de três, com foco automático na primeira ao abrir e leitura do código por SMS quando o navegador oferece. O formato do código virou parte da tela em vez de instrução escrita.

### 1.9 Contagem regressiva que não mente
**Estado:** no repositório

**Antes.** O prazo de expiração era um texto congelado no instante em que a página abriu. Portal deixado aberto o dia todo seguia anunciando "expira em 3d 2h" muito depois de o acesso ter fechado.

**Agora.** O rótulo se atualiza sozinho a cada minuto e é calculado em instantes absolutos, então vale igual em qualquer fuso e atravessa horário de verão sem pular hora.

> Arredonda para baixo de propósito: num acesso prestes a fechar, prometer mais tempo do que existe é pior do que prometer menos.

### 1.10 Tela de entrada redesenhada
**Estado:** no repositório

**Antes.** Uma foto de fundo com sobreposições, anel e patas desenhadas em código empilhadas por cima.

**Agora.** Arte de fundo própria, uma para o tema claro e outra para o escuro, com a diagonal verde e a pata já na imagem. O formulário fica sobre a área lisa e o texto sobre o verde.

---

## 2. Onde cada coisa está

### 2.1 Verificação (rodada em 18/08/2026)

| Checagem | Resultado |
|---|---|
| Testes automatizados | **189 / 189** passando, em 24 arquivos |
| Verificação de tipos | **limpo**, projeto inteiro |
| Idiomas com todos os textos presentes | **4 / 4** (pt, en, en-GB, es) |
| Itens em produção | **0** — nada foi publicado |

### 2.2 O maior risco não é técnico

Sete dos dez itens da seção 1 estão apenas na máquina de desenvolvimento: 18 arquivos alterados e 7 novos, cerca de **2.174 linhas, sem commit**. Passam nos testes, nos tipos e na conferência de idiomas, mas não existem no repositório.

**Ação sugerida:** commitar antes da apresentação, para que "pronto" e "versionado" signifiquem a mesma coisa quando alguém perguntar.

### 2.3 Ficou pela metade ou não entrou

**Ficha de encaminhamento não existe no backend.**
É a peça que traria o *motivo da visita* e as evidências que o responsável anexou ao pedido. Sem ela, três critérios de aceite continuam abertos: o motivo na lista de pacientes, o motivo visível enquanto o profissional escreve o retorno, e a comparação campo a campo com a página pública. O espaço na tela já está reservado — a coluna lateral do editor de anotações é fixa e sobra só encaixar o conteúdo quando ele existir.

**A lista diz que há diário, não quantas entradas.**
A quantidade só existe dentro do resumo clínico, e a listagem não o carrega de propósito: contar exigiria abrir o conteúdo clínico de cada linha da página. Para triagem, saber *que* existe diário já decide a ordem de leitura. Contagem exata pede uma coluna dedicada no banco, com migração.

**Foto do diário abre, mas não tem botão de baixar.**
Documento tem nome de arquivo real e baixa com o nome certo. Foto de diário chega só como um identificador, sem nome nem extensão: forçar o download salvaria um arquivo que o sistema do usuário não sabe abrir. Por isso ela só abre em aba, e de lá o navegador salva corretamente.

**O ambiente de teste ainda não devolve os dados novos.**
Em 12/08 o ambiente de desenvolvimento ainda não enviava a data de atualização do resumo nem os motivos de bloco vazio, e devolvia códigos crus onde deveria haver texto traduzido. A tela cai no comportamento de segurança previsto — não é defeito do portal —, mas significa que a **demonstração ao vivo dessas duas funcionalidades depende de o ambiente ser atualizado**.

**Teste manual em inglês britânico pendente.**
Falta abrir um acesso real com a sessão em en-GB e conferir o diagnóstico traduzido e a data do resumo. É o último item do roteiro de validação do contrato do resumo compartilhado.

---

## 3. Depende de decisão do cliente

Registradas nas specs escritas no período, cada uma com responsável definido. As três primeiras afetam diretamente o que o portal mostra; as demais decidem o comportamento do produto ao redor dele.

| # | Pergunta | Por que importa | Superfície |
|---|---|---|---|
| 1 | A aba de veterinário dentro do aplicativo e o portal web vão conviver, ou uma será descontinuada? | Se convivem, os indicadores de prontuário e o filtro precisam existir nos dois lugares, e toda melhoria futura dobra de custo. É a decisão mais cara desta lista. | Portal + App |
| 2 | O portal deve marcar visualmente o que o profissional já leu? | O backend passa a registrar cada abertura de arquivo. Dá para transformar isso em "já visto" na tela do parceiro, o que ajuda em plantão com troca de turno. | Portal |
| 3 | Foto do diário deve abrir dentro da própria página ou em aba nova? | Abrir na própria página mantém o profissional no contexto do atendimento e é melhor de usar; aba nova já está feito e é trivial. Vale definir antes de padronizar entre portal e página pública. | Portal + Web |
| 4 | O campo de nota livre do diário deve poder ser compartilhado? | Hoje fica fora por padrão: é caixa livre, onde o responsável escreve o que quiser, inclusive coisa que não imagina estar compartilhando. A alternativa é deixá-lo incluir marcando uma opção. | App + Backend |
| 5 | O limite de 50 MB por acesso é suficiente? | Ultrassom e raio-x em PDF passam de 10 MB com facilidade. Se o limite for baixo demais, o responsável descobre isso na hora errada — na recepção da clínica. | Backend |
| 6 | Documento apagado pelo responsável deve continuar visível no acesso já entregue? | Hoje sim, porque o acesso guarda uma cópia congelada. É defensável clinicamente, mas precisa ser uma decisão consciente e não um efeito colateral. | Backend |
| 7 | O texto de responsabilidade no rodapé do prontuário precisa passar pelo jurídico antes de publicar? | É a única copy da leva com peso jurídico e aparece em toda visualização de prontuário compartilhado. | Portal + Web |
| 8 | Retenção de 24 meses para a trilha de aberturas serve, ou o jurídico tem número próprio? | A trilha registra quem abriu qual arquivo e quando. O prazo define por quanto tempo essa prova existe em caso de contestação. | Backend + CMS |
| 9 | A revogação feita pela administração deve avisar o responsável por e-mail? | O acesso é dele e ele não pediu a ação. A proposta registrada é sim, com o número de protocolo junto. | CMS + Backend |
| 10 | Deve existir um botão que revoga de uma vez todos os acessos ativos de um pet? | É o procedimento de emergência para suspeita de vazamento. Está fora do escopo desta leva; a proposta é abrir spec própria só se o caso real aparecer. | CMS |
| 11 | Parceiro excluído pode ser restaurado? | Tecnicamente sim, a exclusão é lógica e o dado permanece. Nenhuma rota faz isso hoje. Se for desejado, vira uma ação própria com motivo e protocolo. | CMS + Backend |
| 12 | Pagamento de saque entra na trilha de protocolo? | Ficou de fora porque não exige motivo hoje, mas é a ação que mais mexe em dinheiro real do parceiro. | CMS + Backend |

**Responsável por todas:** Nicolas.

---

## Anexo: âncoras de código

| Entrega | Onde |
|---|---|
| Documentos e diário no detalhe | `src/pages/(accounts)/parceiro/acessos/[id].vue` |
| Regras de bloco vazio, motivo e carimbo | `src/utils/parceiro/snapshot-compartilhado.ts` |
| Acesso encerrado no clique do arquivo (409) | `src/utils/parceiro/arquivo-compartilhado.ts` |
| URL assinada por clique | `src/service/parceiro/compartilhamentos-service.ts` (`getArquivoSignedUrl`) |
| Indicadores e filtro da lista | `src/pages/(accounts)/parceiro/acessos/index.vue` |
| Idioma da sessão em toda chamada | `src/service/api.ts` |
| Escolha de programas no cadastro | `src/components/parceiro/PortalParceiroProgramasPicker.vue`, `src/utils/parceiro/modo-participacao.ts` |
| Leitura liberada com cadastro suspenso | `src/components/parceiro/PartnerOperabilityBanner.vue` (`cover-suspended`) |
| Código em seis caixas | `src/components/parceiro/VincularCodigoDialog.vue` |
| Seletor de empresa | `src/pages/(accounts)/parceiro/selecionar.vue`, `src/utils/parceiro/perfis-parceiro.ts` |
| Contagem regressiva | `src/utils/format/expiracao.ts`, `src/composables/useAgora.ts` |

## Specs de referência

- [11-13-prontuario-acesso-temporario-portal.md](11-13-prontuario-acesso-temporario-portal.md) — prontuário no acesso temporário
- [15-contrato-do-snapshot-compartilhado-portal.md](15-contrato-do-snapshot-compartilhado-portal.md) — carimbo, motivos e idioma
- [protocolo-motivo-acoes-admin-parceiro-portal.md](protocolo-motivo-acoes-admin-parceiro-portal.md) — efeitos da exclusão lógica
- [GUIA_TESTE_seletor-empresa-portal.md](../GUIA_TESTE_seletor-empresa-portal.md) — roteiro do seletor de empresa

## Change Log

| Data | Versão | Mudança | Autor |
|---|---|---|---|
| 2026-08-18 | 0.1 | Criação, cobrindo 05/08 a 18/08 | Claude |
