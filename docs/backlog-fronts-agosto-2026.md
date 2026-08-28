# Backlog de front: o que a API entregou e falta consumir

**Status:** Pronto para atribuição · **Criado em:** 2026-08-27 · **Janela:** agosto/2026
**Backend:** implementado, testado e com as migrations aplicadas em dev. 200 suítes, 2961 testes, typecheck limpo.

Este documento é a lista fechada do que **cada repositório de front** precisa fazer para consumir o que a API passou a entregar. Cada item foi verificado por busca no código do repositório em questão, não deduzido.

**Ordem de deploy: a API sobe primeiro, sempre.** Campo novo é ignorado por cliente antigo; o inverso não vale.

---

## Resumo por repositório

| Repositório | Precisa mexer? | Itens |
|---|---|---|
| `petjourney-app` | **Não** | Já consome tudo. Verificado: `HandoffSheet.tsx`, `MotivoVisitaSection.tsx`, badge, rótulo, vacina, capabilities |
| `petjourney-web` | **Sim** | 3 itens |
| `petjourney-admin` | **Sim** | 4 itens |
| `petjourney-cms` | **Sim** | 2 itens |

---

## petjourney-app: nada a fazer

Confirmado por busca. O app já tem `HandoffSheet.tsx` e `MotivoVisitaSection.tsx`, já envia `motivoVisita`/`sintomasQueixa`, já lê `tratamentosContinuos`, `statusVisual`, `concluidoEm`, `gerouLembrete`, as capabilities de escrita e o `naoLidas` do badge.

**Uma mudança que já foi feita e vale saber:** a variável `EXPO_PUBLIC_PRONTUARIO_COMPARTILHADO` e o arquivo `flags.ts` **foram removidos**. Eles existiam porque a rota de criação recusa campo desconhecido com 400, e o app precisava declarar o que sabia mandar. Com as Partes 11, 12, 13 e 16 todas implementadas, a API aceita tudo e a flag virou código morto. O app agora manda sempre, e numa recusa de servidor antigo ele refaz a criação sem a peça recusada, em vez de o tutor perder o acesso.

---

## petjourney-web (página pública do prestador)

A `FichaEncaminhamento.tsx` **já existe**, então a Parte 12 está adiantada aqui. Os três itens abaixo não estão.

### W1. Motivo `REMOVIDO_PELO_TUTOR` (prioridade alta)

Busca por `REMOVIDO_PELO_TUTOR` no `src/`: **zero ocorrências**. Hoje `snapshot-blocos.ts` conhece só `SEM_REGISTRO` e `FILTRADO_JANELA` (ver `snapshot-blocos.test.ts:35,48,58`).

```ts
type MotivoBlocoVazio = 'SEM_REGISTRO' | 'FILTRADO_JANELA' | 'REMOVIDO_PELO_TUTOR';
```

O tutor ganhou o poder de **remover uma categoria de um acesso já criado**. Sem tratar o valor novo, um bloco que ele retirou fica idêntico a um que nunca teve dado, e **o veterinário conclui que o pet não tem vacina quando na verdade a permissão foi retirada**. É a diferença entre "não há registro" e "você não tem mais acesso a isso".

Copy sugerida, nos 4 locales, en-GB explícito, sem em-dash:

- `SEM_REGISTRO`: "O tutor não tem registro nesta categoria."
- `FILTRADO_JANELA`: "Não há registro no período compartilhado."
- `REMOVIDO_PELO_TUTOR`: "O tutor removeu esta categoria do acesso."

### W2. Bloco de tratamento contínuo (prioridade alta)

Busca por `tratamentosContinuos`: **zero ocorrências**. O dado chega no snapshot e é ignorado.

```ts
snapshot.tratamentosContinuos?: {
  titulo: string;              // nome do medicamento, texto livre do tutor
  detalhe?: string | null;     // "2 mg · 1x ao dia · oral"
  detalheLabel?: string | null;
  destaque: boolean;           // sempre true
  motivo?: string | null;      // texto livre: "para a dor"
  diagnostico?: string | null; // JÁ LOCALIZADO: "Hepática", nunca "HEPATICA"
  desde?: string | null;       // ISO 8601
  observacoes?: string | null; // "dar junto com a comida"
}
```

Renderizar em `PetSnapshot.tsx`, no padrão dos blocos existentes (`ItemListSection` com `estadoDe`), **acima de Medicamentos**: é o item cuja falha tem dano imediato. O motivo do produto foi literal: *"tratamento contínuo é todo dia pra sempre, importante para o pet não morrer se ele ficar num hotel uma semana"*.

**A armadilha, e ela é séria:**

```ts
// certo
if (snap.tratamentosContinuos !== undefined) { /* abre o bloco */ }

// errado: esconde o remédio de TODO acesso criado antes do deploy
const itens = snap.tratamentosContinuos ?? [];
```

Chave **ausente** significa "acesso criado antes da Parte 16", e ali o tratamento sai fundido dentro de `medicamentos`, como sempre esteve. `[]` significa outra coisa: o acesso fala sobre tratamento e não há nenhum em curso. Tratar ausente como vazio esconde o remédio de todo acesso antigo.

`motivo` e `diagnostico` são **independentes**, não um fallback do outro. O caso comum é os dois preenchidos ("para a dor" mais "Artrose"), e mostrar só um entrega ao prestador menos do que o tutor viu ao compartilhar.

### W3. Especialidade do profissional na anotação

Busca por `profissionalEspecialidade`: **zero ocorrências**. A web é onde o prestador **sem conta** escreve a anotação, então é a ponta que gera o dado.

| Arquivo | O que fazer |
|---|---|
| `src/service/prestador/anotacao-multipart.ts` (~linha 38, onde monta `profissionalNome`) | Acrescentar `profissionalEspecialidade` ao `FormData` |
| `src/service/prestador/types.ts` (linhas 227 e 276) | Campo no tipo de leitura e no de escrita |
| `src/components/prestador/AnotacoesList.tsx` (~linha 103, onde monta `notes.by`) | Mostrar a área junto do autor: "Dra. Ana (Cardiologia)" |
| Formulário de anotação | Chips com a lista, mais "Outra" com texto livre |

O valor guardado é a **chave** do enum quando é uma das opções, ou **texto livre** quando é "Outra". Limite de 60 caracteres. **Quem traduz é o cliente**: nunca imprima `CARDIOLOGIA` na tela.

A lista, para montar os chips:

```
CLINICO_GERAL | CARDIOLOGIA | DERMATOLOGIA | ORTOPEDIA | OFTALMOLOGIA |
ODONTOLOGIA | NEUROLOGIA | ONCOLOGIA | ENDOCRINOLOGIA | GASTROENTEROLOGIA |
CIRURGIA | ANIMAIS_EXOTICOS | <texto livre>
```

**Não é enum fechado no banco, e isso é decisão.** "Fisioterapia" e "Acupuntura" são casos legítimos, e um enum fechado transformaria cada um deles num 400.

**Atenção ao mecanismo de detecção:** a rota de anotação é multipart e **não roda `ValidationPipe`**, então campo desconhecido é ignorado em silêncio, sem erro. Não existe 400 para escutar. O jeito de saber se o servidor guardou é **comparar o que você mandou com o que voltou** na resposta do POST, e a API devolve o campo justamente para isso.

### W4. A ficha já existe, mas está no shape antigo

`FichaEncaminhamento.tsx` e o tipo `FichaEncaminhamento` em `src/service/prestador/types.ts:150` já existem, então a Parte 12 está adiantada aqui. Mas o backend subiu com **dois campos a mais** do que o tipo da web declara, e os dois são aditivos (a página ignora e não quebra), então ninguém vai perceber sem olhar:

| Campo que a API emite | Onde | Por que ele existe |
|---|---|---|
| `motivo.sintomasQueixa[]` | dentro de `ficha.motivo` | Sem ele, a queixa que o tutor **declarou** some do payload quando o diário não a sustenta. O tutor diz "está vomitando", o diário não tem registro daquele sintoma, e o prestador não fica sabendo que ele declarou |
| `sintomaChave` e `declaradoPeloTutor` | dentro de cada `EvidenciaFicha` | `sintomaChave` é a chave do enum ao lado do label (mesma convenção `titulo`/`tituloLabel`), e `declaradoPeloTutor` separa o que ele apontou do que o diário mostrou sozinho |

**O que fazer:** acrescentar os três campos ao tipo e decidir como exibir. O mais importante é o `sintomasQueixa`: é a diferença entre o vet saber e não saber o que o tutor foi lá dizer.

### W5. Comportamentos novos que a página precisa aguentar

O acesso deixou de ser imutável. Três coisas podem mudar entre dois carregamentos:

| Operação do tutor | O que a página vê |
|---|---|
| Remover categoria | Bloco fica vazio, com o motivo do W1 |
| Remover documento do cofre | O link assinado para de funcionar e o binário sai do bucket |
| Encurtar validade | `expiraEm` **diminui** |

Para o arquivo removido, trate o erro do link como "este arquivo não está mais disponível", e não como erro de sistema: hoje uma tela de erro genérica faz o prestador achar que o PetJourney caiu. Para a validade, releia na navegação; se a página cacheia `expiraEm` no boot e mostra contador, o contador mente.

**Ressalva que precisa estar na copy:** encurtar validade **não apaga** o que o prestador já baixou. É subtração de acesso futuro, não de dado passado.

---

## petjourney-admin (portal do parceiro)

Busca pelos quatro termos no `src/`: **zero ocorrências de todos**.

### A1. Tratamento contínuo no tipo e na tela

`src/service/parceiro/types.ts` (o snapshot está por volta da linha 279, hoje com `medicamentos?: ItemSnapshot[]`). Mesmo shape e mesma armadilha da chave ausente descritos em W2.

### A2. Especialidade do profissional

O parceiro **com conta** escreve por aqui. Mesma mudança de W3, outros arquivos:

| Arquivo | O que fazer |
|---|---|
| `src/service/parceiro/compartilhamentos-service.ts` (~linha 126, onde faz `form.set('profissionalNome', ...)`) | Enviar o campo |
| `src/service/parceiro/types.ts` (linhas 337 e 421) | Campo no tipo de leitura e no de escrita |
| Tela de anotação | Chips e exibição do autor com a área |

### A3. Motivo `REMOVIDO_PELO_TUTOR`

O portal consome o mesmo snapshot da web, então o item W1 vale aqui igual.

### A4. Trilha de consentimento para o suporte

A API passou a registrar tudo que o tutor **retirou** de um acesso (categoria removida, documento removido, validade encurtada, acesso revogado), em tabela append-only, e ganhou rota de leitura. A revogação feita pelo próprio suporte também entra na trilha.

Isso existe para responder a pergunta que a Parte 14 prometeu: *"o que estava compartilhado quando o vet leu, às 14:32"*. Sem tela, a trilha grava e ninguém lê.

### Uma coisa que NÃO vai acontecer, e é decisão

**Não haverá notificação quando o tutor mexer no acesso.** O canal público é anônimo por desenho, e a trilha de abertura proíbe gravar identificador de quem o tutor escolheu confiar. Avisar só o parceiro com conta criaria um sistema em que a mesma operação é visível para um e invisível para outro.

**Consequência prática:** o estado do acesso pode mudar sem aviso entre dois carregamentos. Não assuma que o que está na tela ainda vale ao clicar.

---

## petjourney-cms

### C1. Apagar a derivação de en-GB

O CMS derivava `en-GB` a partir de `en-US` em **um** formulário (benefícios de plano). Artigo, categoria e saúde-dica saíam sem en-GB e a leitura caía num fallback silencioso.

Isso subiu para a API: `parseTraducoes` agora deriva no ponto único por onde passam os 7 serviços de conteúdo, campo a campo (quem traduziu só o título mantém o título britânico e recebe o corpo do en-US, em vez de perder o corpo).

**O que fazer:** remover a derivação local. Mandar sem `en-GB` passou a ser seguro. Se continuar derivando, nada quebra (é idempotente), mas é código morto mantendo uma regra que agora tem dono.

### C2. Barrar em-dash no editor de benefício

Os títulos de benefício **deixaram de ser catálogo interno**: a assinatura do tutor passou a devolvê-los, então viraram copy de tela. Três tinham em-dash e foram corrigidos no seed e no banco de dev.

Sem barrar na entrada, o próximo benefício cadastrado reintroduz o caractere numa tela de usuário.

### C3. Uma ressalva honesta sobre o cache

`beneficios-plano` não invalidava o cache do catálogo de planos, então editar um benefício não aparecia até o TTL de 10 minutos vencer. As 5 escritas passaram a invalidar.

**Mas o cache é um `Map` em memória do processo.** A invalidação vale na réplica que atendeu a escrita. Com 3 réplicas, as outras servem valor velho por até 10 minutos. Se o editor salvar, recarregar e ver o valor antigo, é isso, e não erro dele. Cache compartilhado é follow-up.

---

## Checklist de aceite

| # | Verificação | Onde |
|---|---|---|
| 1 | Tutor remove a categoria VACINAS de um acesso ativo. A página mostra a frase de "removido pelo tutor", e não a de "sem registro" | web + admin |
| 2 | Acesso novo com `TRATAMENTOS` marcado mostra o bloco próprio, com posologia, motivo, diagnóstico, "desde quando" e observação | web + admin |
| 3 | O mesmo remédio **não** aparece também em Medicamentos | web + admin |
| 4 | Acesso criado **antes** do deploy: nenhum bloco novo, e o remédio contínuo continua dentro de Medicamentos | web + admin |
| 5 | Diagnóstico aparece traduzido, nunca como `HEPATICA` ou `FELV` | web + admin |
| 6 | Tutor remove um documento: o link responde erro e a página diz "não está mais disponível", sem tela de erro genérica | web + admin |
| 7 | Escrever anotação com especialidade da lista: a resposta do POST devolve o campo | web + admin |
| 8 | Escrever com "Outra" e texto livre ("Acupuntura"): aceito, sem erro | web + admin |
| 9 | Anotação antiga sem o campo: a linha do autor sai sem parênteses, e não com "(null)" | web + admin |
| 10 | Suporte consegue ver o que foi retirado de um acesso e quando | admin |
| 11 | Editar benefício e recarregar a mesma réplica mostra o valor novo | cms |
| 12 | Benefício com em-dash no título é barrado na entrada | cms |
| 13 | A ficha mostra a queixa declarada pelo tutor mesmo quando o diário não tem registro daquele sintoma | web |
| 14 | Criar artigo sem preencher en-GB e ler em en-GB devolve o texto derivado, gravado e não por fallback | cms |

---

## Documentos de referência

| Arquivo | Conteúdo |
|---|---|
| `integracao-clientes-leva-quatro-frentes.md` | Detalhe completo dos contratos, com os shapes |
| `ativacao-parte16-e-acesso-por-que-nao-aparece.md` | Parte 16: prova de funcionamento e ordem de ativação |
| `leva-quatro-frentes-api.md` | Spec-mãe: decisões, trade-offs e o que ficou de fora |
| `prontidao-clientes-reais.md` | Auditoria de prontidão, 69 achados |

---

## Pendências que são do backend, não do front

Listadas aqui só para ninguém esperar por elas achando que são de front:

1. **Sete migrations não aplicadas em produção.** O deploy não aplica sozinho: o `postinstall` roda apenas `prisma generate`. Sem elas a API serve código que espera colunas inexistentes.
2. **`JWT_ACCESS_TTL` ausente no painel**, e o código cai em `'30d'`. O `.env.example` diz `15m`.
3. **`DB_POOL_MAX` no default de 20**, que com 3 réplicas vira até 60 conexões.
