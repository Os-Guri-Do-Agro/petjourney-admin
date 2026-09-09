# 08 · Orientação do fluxo clínico

> O módulo tem doze telas e nenhuma delas dizia onde estava o trabalho nem como se chegava a um
> paciente. Este requisito é sobre **encontrar** — não sobre acrescentar tela.

## Por que existe

Um usuário descreveu o fluxo clínico como confuso. A auditoria que se seguiu não encontrou tela
faltando nem tela sobrando: encontrou **uma lista plana de dez destinos**, todos aparentemente
vazios, sem nenhuma indicação de qual responde à pergunta do momento.

O sintoma não é estético. Ele custa trabalho real, três vezes por dia:

- Para saber se havia alguém na fila, uma dose atrasada ou um rascunho sem fecho, era preciso
  **abrir as dez telas** e conferir uma a uma.
- Para chegar ao Bento, era preciso saber *por onde* se chega ao Bento — Pacientes se veio ontem,
  Internação se está no leito, Agenda se tem horário hoje, Prontuários se ficou em rascunho. Quem
  opera a clínica sabe o nome do animal; quase nunca sabe em qual das quatro listas ele está.
- A internação não aparecia em lugar nenhum fora do próprio menu. Um veterinário com cinco
  internados abria a landing do perfil dele e não via nenhum: o portal parecia **dois sistemas**.

## Pronto quando

Quem abre o portal responde "onde está o trabalho?" sem clicar, e chega a qualquer paciente ou
tela em um gesto, de onde quer que esteja.

---

## Entregue

| O que faltava | Situação |
|---|---|
| **O menu não dizia onde estava o trabalho** | Feito — selo de pendência por tela, com número, tom e frase própria |
| **Dez destinos numa lista plana** | Feito — quatro blocos rotulados: Agora, Em curso, Pendências, Análise |
| **A seção clínica se chamava `clinico.modulo`** | Feito — defeito de i18n; a chave apontava para um objeto e o `t()` devolvia o caminho |
| **Não havia como buscar nada** | Feito — busca global em `Ctrl/⌘ + K`, telas e pacientes na mesma lista |
| **A busca de pacientes não filtrava** | Feito — defeito no repositório; termo sem dígito casava com todo telefone |
| **A internação não existia fora do próprio menu** | Feito — bloco em "Meu dia", faixa de boletim retido no topo, elo com o histórico do paciente |
| **O boletim retido não dizia de quem era** | Feito — selo no cartão do leito, com ícone de telefone |
| **O painel de casos difíceis sumia em build publicado** | Feito — segue o desbloqueio do módulo, não `import.meta.env.DEV` |

---

## Decisões

- **Os blocos do menu são as quatro perguntas da clínica, na ordem em que ela as faz.** *Agora* é
  o que está acontecendo neste minuto e onde cabe mais alguém; *Em curso* é o trabalho aberto que
  atravessa o dia; *Pendências* é o que ficou para trás e envelhece calado; *Análise* é o que só
  faz sentido depois que o dia acabou. A ordem anterior era a de construção — o Resumo, que se
  olha uma vez por semana, ficava em segundo lugar, acima da Agenda.

- **Nada saiu da lista.** Os dez destinos continuam os dez, com os mesmos nomes e as mesmas rotas.
  O que mudou é que a lista deixou de exigir leitura inteira.

- **O selo conta só o que alguém precisa fazer.** "38 atendimentos hoje" não é pendência, é
  rotina; "2 doses atrasadas" é. Um contador que soma rotina ensina a ignorar contador — e aí ele
  para de funcionar justamente no dia em que o número importa.

- **Cada número aparece em um lugar só.** O rascunho de prontuário é pendência de *Atividades* e
  não também de *Prontuários*: o mesmo trabalho contado duas vezes faz a clínica procurar duas
  vezes e achar uma.

- **Zero não vira selo.** Um "0" ao lado de cada tela é ruído que ensina a não olhar para a
  coluna.

- **Três tons, e cada um sobe um canal além da cor.** Neutro sem moldura, atenção com moldura
  âmbar, risco com moldura, peso e cor cheia. Em escala de cinza — ou para quem não distingue
  vermelho de âmbar — a diferença entre "há gente na fila" e "há um boletim preso" continua de pé.
  O número nunca fica sozinho para o leitor de tela: `badgeTitulo` é a frase que diz o que os três
  são, e ela é **por tela**, porque "3" ao lado de Fila e "3" ao lado de Vacinas são três coisas
  diferentes.

- **A contagem é um singleton de módulo, não uma store.** O consumidor é o shell, que monta uma
  vez. Uma store por componente refaria cinco chamadas a cada clique de menu para reescrever os
  mesmos quatro números. A carga acontece uma vez e é refeita quando `invalidarTudo()` avisa que o
  mundo mudou — que é exatamente quando um desses números pode ter mudado.

- **Nada é importado no topo de `useClinicoPendencias`.** O arquivo é lido pelo menu do portal,
  que existe para **toda** conta. Um `import` estático de `../data/repositories` arrastaria o
  dataset inteiro de demonstração para o primeiro carregamento de todo mundo, para calcular quatro
  números que a maioria das contas nunca vê. O mesmo vale para a busca global, montada com
  `defineAsyncComponent`.

- **A busca mistura telas e pacientes, com as telas primeiro.** Separar em abas obrigaria a
  escolher antes de procurar — exatamente a escolha que quem está perdido não consegue fazer. As
  telas vêm primeiro porque a lista é fixa e curta: o olho a descarta num relance quando não é o
  que se procura.

- **A busca abre mostrando as telas, sem digitar nada.** Uma paleta vazia é uma pergunta feita a
  quem não sabe a resposta. Com a lista à vista, ela também é o mapa do módulo — que é o segundo
  uso dela, e o que ensina o menu a quem chegou hoje.

- **`Ctrl/⌘ + K` atravessa campo de texto.** É a única tecla do portal que precisa funcionar
  *enquanto* alguém digita: quem está no meio de uma anamnese e precisa conferir o histórico não
  vai clicar fora antes. Não colide com os atalhos de uma letra da agenda, cujo ouvinte ignora
  tudo o que vem com `Ctrl`, `Alt` ou `Meta`.

- **A busca é botão no cabeçalho, e não campo.** Um campo permanente promete busca em toda tela do
  portal, e a promessa vale só dentro da clínica.

- **O bloco de internação em "Meu dia" mostra só quem cobra ação.** Quem quer a lista completa tem
  o mapa de leitos; quem abre a landing às oito da manhã quer saber o que não pode esperar. Um
  bloco que repete o mapa inteiro é um bloco que ninguém lê duas vezes.

- **O boletim retido sobe acima de tudo, e é um botão.** No mapa de leitos ele é texto — quem está
  lá já chegou ao lugar onde se resolve. Em "Meu dia" ele aparece três telas antes, e um aviso que
  diz "ligue para alguém" sem levar a lugar nenhum transfere para quem lê o trabalho de descobrir
  onde é esse lugar.

---

## Defeitos encontrados durante a execução

### D1 · A seção clínica se chamava "clinico.modulo" — **corrigido**

`t('clinico.modulo')` era usado como rótulo da seção no trilho e no cabeçalho da página. A chave
existe, mas resolve para um **objeto** — `{ visivel, oculto }`, as duas frases do interruptor do
módulo —, e o `vue-i18n` devolve o próprio caminho quando não encontra texto. A seção mais usada
do portal se anunciava com um caminho de código.

Passou por revisão de tipos, build e teste porque nenhum dos três olha para o **valor** da chave.
O teste que pegaria isto já existia — `chaves-de-traducao.spec.ts`, com a asserção "não usa como
texto nada que seja um grupo" — mas varre apenas os arquivos da internação.

**Corrigido** com `clinico.navegacao.secao`.

### D2 · A busca de pacientes não filtrava — **corrigido**

`patientRepository.buscar` comparava telefone assim:

```ts
(tutor?.telefone ?? '').replace(/\D/g, '').includes(alvo.replace(/\D/g, ''))
```

Um termo **sem nenhum dígito** vira string vazia, e qualquer texto contém string vazia. Buscar
"Rita" casava com o telefone de todo mundo e devolvia o cadastro inteiro.

O defeito era invisível na tela justamente porque não perdia nada: o paciente procurado estava
sempre na lista, junto de outros vinte e três, ordenados por nome. Quem usava concluía que a busca
era ruim — não que estava quebrada. Foi encontrado ao escrever o teste da busca global, que
esperava zero resultados para um termo inventado.

**Corrigido**, com a guarda de dígitos, e coberto por `paciente-busca.spec.ts`.

### D3 · Um byte nulo dentro de um arquivo de teste — **corrigido**

`render.spec.ts` tinha `expect(...).not.toContain(retido.texto || '\0')`, com um NUL cru na fonte.
Fazia o `grep` tratar o arquivo como binário, e a guarda não afirmava coisa alguma. Substituído por
`expect(retido.texto.length).toBeGreaterThan(0)` seguido da asserção de verdade.

---

## Fora do código

- [ ] Rodada com alguém que opera clínica de verdade, olhando o menu novo — **gate de processo**,
      não entregável de código. O que se quer ouvir é se os quatro rótulos são as quatro perguntas
      que essa pessoa faz, e não as que nós achamos que ela faz.
