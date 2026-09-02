# 06 · Perguntas ao time do app — **respondidas**

O time do app respondeu (`docs/RESPOSTA-06-perguntas-time-app.md`, no repositório do app).m,,,,,,,3
Este documento guarda o que ficou **verificado**, o que ficou **inconclusivo**, e a lista de
divergências que o módulo clínico precisa fechar.

Verifiquei as respostas contra o `petjourney-api` em disco. O clone local estava 8 commits
atrás, então **todas as conferências abaixo foram feitas contra `origin/develop`**, não contra
o checkout.

O prompt original está preservado no fim, em [Apêndice](#apêndice--o-prompt-enviado).

---

## O achado que reordena tudo

O elo app ↔ clínica não só existe: **o portal já o implementa**, e não foi no módulo clínico.

| Onde                                                                                         | O quê                                                             |
| -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| [parceiro/acessos/](<../../src/pages/(accounts)/parceiro/acessos/>)                          | Lista e detalhe dos compartilhamentos vinculados                  |
| [AnotacaoEstruturadaFields.vue](../../src/components/parceiro/AnotacaoEstruturadaFields.vue) | O formulário que escreve no prontuário do pet                     |
| [utils/parceiro/anotacao-estruturada.ts](../../src/utils/parceiro/anotacao-estruturada.ts)   | Espelho literal do contrato: limites e campos por tipo de serviço |

Ou seja: existem **duas** implementações dos mesmos conceitos dentro deste repositório. A de
`/parceiro/acessos` fala o contrato real e está no ar. A de `/veterinario/*` — o módulo clínico
— inventou o formato do zero e diverge dela.

Isso não invalida o módulo clínico: ele é mais rico de propósito, e o requisito pedia protótipo.
Mas muda a pergunta de "que API vai existir?" para "**como o módulo clínico desagua no contrato
que já existe?**".

---

## Respostas, por seção

### 1 · Identidade — ✅ confirmado, e é pior do que eu supunha

`tutorId` **não** é `userId`: o JWT carrega os dois separados, mais `veterinarioId` e
`parceiroAtivoId`, porque uma conta pode ter vários perfis. Ids são `cuid` do Prisma, não `uuid`.

**Onde supus errado:** o módulo clínico trata `petId`/`tutorId` como um par global e estável.
Não existe vínculo pet ↔ clínica no banco. O acesso da clínica a um pet é **temporário e
consentido** (`CompartilhamentoPrestador`), com escopo por tipo de serviço e prazo — não uma
carteira de pacientes permanente.

Isso atinge a agenda e a lista de pacientes do módulo clínico, que assumem carteira própria.

### 2 · Pré-consulta — ✅ não existe, mas quatro campos têm forma pronta

Dos nove campos que inventei em `PreConsulta`, quatro já são **enum fechado** no Diário Pet do
app: apetite → `ConsumoDiario`, evacuação → `AspectoFezes` (11 valores), micção → `EstadoUrina`
(8), evolução → `VitalidadePet` (8). Peso existe, decimal, 0.01–500 kg.

**Duração da queixa não existe** em lugar nenhum.

**Onde supus errado:** inventei escalas próprias (`MucosaStatus`, `HidratacaoGrau`,
`EvolucaoDoQuadro`) onde o app já tem enums fechados. Adotá-los custa pouco agora e evita
tradução na integração.

O que mais se parece com pré-consulta hoje é o wizard do compartilhamento: `motivoVisita` +
até 5 sintomas + recado.

### 3 · Agendamento pelo app — ✅ não existe. Nem um pouco

Grep por `agendar|agendamento` no app inteiro devolve uma linha, e é comentário sobre outra
coisa. `Consulta` é registro **posterior**, escrito pelo responsável, com `clinicaNome` /
`veterinarioNome` como string livre.

**Onde supus errado:** `origem: 'app'` está no drawer da agenda e **não tem quem produza**.
Não é dado atrasado; é dado sem fonte.

### 4 · Receita — ✅ contínuo é representável, e conferi na linha

A melhor notícia da rodada, e a única que verifiquei no código do destino:

```ts
// anotacao-importacao.service.ts:439
const dataFim =
  item.duracaoDias != null ? new Date(data.getTime() + item.duracaoDias * MS_POR_DIA) : null
```

`duracaoDias` ausente → `dataFim: null` → tratamento sem data de fim. O anti-hipertensivo não
para num dia arbitrário. **Mas a forma no fio é omitir o campo**, não mandar `null`: o DTO
declara `@IsInt() @Min(1) @Max(3650)`.

Confirmada também a armadilha que o app apontou, na linha 459: item **sem `frequencia`** vira
prescrição mas **não** vira medicamento — `medicamentos < prescricaoItens` é correto, não é bug.

`dose` é string livre de 200 caracteres, então "meio comprimido" chega intacto.

**Código verificador e CRMV não existem no contrato.** A identidade do profissional que viaja é
`profissionalNome` (200) + `profissionalEspecialidade` (60), e só.

### 5 · Avisos — ✅ existe canal, com um custo que eu não tinha visto

Push e inbox são sólidos: preferências por categoria, 3 canais Android, `X-Timezone`. Countdown
de 15 minutos já tem padrão pronto.

**Os dois custos reais:**

- `ROTA_POR_TIPO` é `Record` fechado de propósito → cada tipo de aviso novo custa **uma release
  do app**, não só rota na API.
- Hoje a fonte do texto é sempre o backend, já resolvido no locale. **Texto escrito pela clínica
  não passa por tradução** num app que roda em 4 locales.

O segundo é o que atinge o módulo clínico: os quatro avisos que o portal grava como comprovante
são escritos pela clínica, em pt.

### 6 · Vacinação — ✅ confirmado, e o schema é a prova

Conferi direto no Prisma de `origin/develop`. `model Vacina` inteiro:

```prisma
model Vacina {
  id              String    @id @default(cuid())
  nome            String
  aplicadaEm      DateTime?
  petId           String
  gerouLembreteId String?   @unique   // FK pro LembreteSerie da próxima dose
}
```

**Lote, fabricante, validade e dose da série não existem** — nem no clone, nem na branch viva.
"Próxima dose" não é campo: é um `LembreteSerie` derivado.

É a maior lacuna comercial do módulo clínico e a que tem menos onde aterrissar. E o alerta do
app é justo: registro da clínica sem fechar a série existente = vacina duplicada na carteira.

### 7 · Documentos — ✅ existe, e o caminho de entrega já está no ar

Por pet, 8 tipos contra os 15 do portal, PDF (1) **ou** fotos (até 6), mix proibido. Não existe
"meus documentos" global.

`salvarAnexosNosDocumentos: true` na importação já faz anexo virar documento do pet — o
"enviar ao responsável" tem destino.

### 8 · O caminho inverso — ⚠️ uma correção para devolver ao app

O app disse que `veterinarioEspecialidade` "está declarada esperando a API subir o campo".
**A API já subiu.** Em `origin/develop`:

- `anotacao-multipart.util.ts:37` — o campo é parseado
- `compartilhamento-prestador-parceiro.service.ts:427` — é persistido
- `anotacao-importacao.service.ts:406` — vira `veterinarioEspecialidade` na consulta do pet

O portal também já o envia (`LIMITES_CAMPOS_LIVRES.profissionalEspecialidade = 60`). Se a tela
do app está esperando, ela pode parar de esperar.

---

## Divergências do módulo clínico contra o contrato real

O que precisa mudar quando `/veterinario/*` for desaguar em
`POST /parceiro/portal/compartilhamentos/:id/anotacoes`.

| Contrato real                                           | Módulo clínico hoje                                 | Consequência se subir assim                                    |
| ------------------------------------------------------- | --------------------------------------------------- | -------------------------------------------------------------- |
| `prescricaoItens` **máx. 10**                           | `CarePlan.prescricoes` sem teto                     | 400 na anotação inteira                                        |
| `examesSolicitados` **máx. 10**, `{nome, observacao}`   | `examesSolicitados: string[]` de **ids**            | 400 por volume; id no lugar de nome                            |
| Item: `nome/dose/unidade/frequencia/instrucoes` (texto) | `DoseCalc` numérico (`mgPorKg`, `frequenciaHoras`)  | precisa renderizar para texto; os números não têm receptor     |
| **Não existe campo de via**                             | `PrescriptionRoute` (6 vias)                        | via tem de caber em `instrucoes`                               |
| `diagnostico`: uma string ≤ 10000                       | `Diagnosis[]` com `codigo` e `kind`                 | código e tipo não têm onde cair; precisa achatar               |
| `duracaoDias`: int 1–3650, **omitir** = contínuo        | `number \| null`                                    | compatível — desde que `null` serialize como campo **ausente** |
| Campo fora do `tipoServico` → **400**                   | módulo não conhece `tipoServico` do acesso          | anotação recusada inteira                                      |
| `profissionalNome` + `profissionalEspecialidade`        | `AssinaturaEletronica` + CRMV + código verificador  | CRMV e verificador não viajam                                  |
| `pesoKg` 0.01–500                                       | idem                                                | ✅ já bate                                                     |
| Sem campos de vacinação                                 | cadeia completa (lote, fabricante, validade, série) | sem destino                                                    |
| Sem pré-consulta de entrada                             | `PreConsulta`, 9 campos                             | sem fonte                                                      |

## O adaptador

A tabela acima está resolvida em código:
[features/clinico/domain/anotacao.ts](../../src/features/clinico/domain/anotacao.ts).

Ele **não repete o contrato**. Limites, campos por tipo de serviço, validação e montagem
continuam morando só em
[utils/parceiro/anotacao-estruturada.ts](../../src/utils/parceiro/anotacao-estruturada.ts) —
dois lugares para o mesmo teto seriam dois lugares para divergir, e divergir é 400 com a
anotação inteira perdida. A saída do adaptador é o **formulário** que aquele módulo já valida e
monta, e o teste que importa é justamente esse: o resultado da conversão passa em
`validarAnotacaoEstruturada` sem ajuste.

O que ele faz de próprio é a parte que só o módulo clínico sabe — traduzir prontuário rico para
campos pobres — e **dizer em voz alta o que não coube**. Onze tipos de aviso (`kind` + `params`,
traduzíveis na borda), entre eles: prescrição acima do teto de dez, nomeando as descartadas;
item sem frequência, que do lado de lá vira prescrição mas não vira medicamento; peso não
aferido; via e assinatura sem campo de destino.

Uso contínuo é o caso que o teste trava com mais cuidado: `duracaoDias: null` atravessa como
`null` no formulário e vira **chave ausente** no `JSON.stringify` do multipart — que é onde a
omissão de fato acontece. A asserção é no JSON, não no objeto.

Sai como formulário, e não como payload pronto, de propósito: quem atendeu revisa o que sai da
clínica antes de sair. O prontuário é da clínica; a anotação é do responsável.

**Nenhuma tela o chama ainda** — o módulo segue oculto atrás do interruptor, e não há acesso
real para vincular. Ele existe para que o dia da integração seja ligar um botão, não redescobrir
o contrato.

## Não verificado

`VACINA_ATRASO_DIAS = 3`, que o app descreve como duplicado de propósito com o backend, **não
aparece em `origin/develop`** por esse nome. Pode viver com outro nome, ou só no app. O argumento
de fundo continua de pé de qualquer forma: uma lista de chamada no portal seria o terceiro
relógio da mesma regra.

---

## Apêndice — o prompt enviado

<details>
<summary>Texto do prompt, mantido para rastrear de onde veio cada resposta</summary>

```
Você é o agente do app do responsável (PetJourney). Estou do outro lado: trabalho no
petjourney-admin, o portal da clínica, no módulo clínico (agenda, prontuário, receituário,
vacinação).

Construí o lado da clínica de vários elos com o app. Como não havia contrato, inventei o
formato em cada um. Preciso saber o que o app realmente faz hoje, para eu corrigir o que
supus errado antes de a API existir e congelar o engano.

Responda com base no CÓDIGO do app, não em intenção de produto. Para cada resposta, aponte o
arquivo. Se algo não existe, diga "não existe" — é uma resposta tão útil quanto a outra, e
muito mais barata que descobrir depois.

## 1. Identidade — a pergunta que decide todas as outras
- Como um pet e um responsável são identificados no app? Qual o formato do id?
- Esse id é o mesmo que a API usa, ou o app tem id próprio e mapeia?
- Um responsável pode ter o mesmo pet cadastrado em duas clínicas?
- Existe algum pacote/tipo compartilhado entre app, web e admin?

## 2. Pré-consulta
- O app coleta alguma coisa antes da consulta? O quê, quando?
- O responsável informa peso? Em que unidade e precisão?
- Existe questionário de triagem/sintomas? Quais campos?

## 3. Agendamento vindo do app
- O app agenda hoje? Escolhe profissional? Motivo vira duração?
- O que envia no ato? O que acontece quando o horário some?
- Pode cancelar/remarcar? Onde mora a regra de prazo?

## 4. Receita e lembrete de medicação
- Existe lembrete de medicação? Intervalo em horas, horários fixos, ou os dois?
- Sabe lidar com uso contínuo sem data de fim?
- Precisa do código verificador e do CRMV na tela?

## 5. Avisos que a clínica dispara
- Que canais existem? Push, in-app, e-mail, WhatsApp?
- A oferta de vaga tem prazo de 15 min — dá para contar e capturar aceite na janela?
- Quem é a fonte da verdade do texto — a clínica escreve, ou é template do app?

## 6. Vacinação e recall
- O app mostra carteira? De onde vêm os dados? Existe lembrete de reforço?
- Se a clínica registra a aplicação, aparece no app automaticamente?

## 7. Documentos
- Quais dos 15 fazem sentido no app? Existe tela de "meus documentos"?

## 8. O caminho inverso
- O que o app precisa do portal e hoje não recebe?
- Existe tela do app travada esperando dado clínico?

Formato: por seção, o que existe (com arquivo), o que não existe, e onde eu supus errado.
Prefiro uma lista curta e verdadeira a um panorama completo e otimista.
```

</details>
