<!-- doc cmvu0dblvgryy6a3sp7r · "Handoff E7-02: portal-parceiro-e7.md" · atualizado 2026-10-30T13:33:32.060Z · card PJ-28JU4U -->

# Guia do front: Portal do parceiro, E7 (hotel)

**Para:** o Luís. Portal web do parceiro (`petjourney-admin`). O app (`petjourney-app`), o site e o CMS **não ganham tela nem mudam** com a casa do hotel: o responsável só enxerga o hotel pela página pública (E7-03) e pela reserva (E7-02).
**Backend:**
- E7-01a (a casa do hotel, primeira fatia: blocos, tipos de acomodação, tarifas e acomodações, com a permissão nova `hotel.valores`) pronta e validada em dev em 2026-10-28: unit, integração contra o Postgres de dev (inclui as corridas de nome, de teto e de ordem) e smoke por HTTP (`npx tsx scripts/smoke-hotel-casa.ts`). **Não está em produção** e ainda não passou pela auditoria. Seções 1 a 6.
- E7-01b (temporadas, serviços, política da casa e exigências de admissão) pronta e validada em dev em 2026-10-29: unit, integração contra o Postgres de dev (CHECKs, índices únicos, teto de 30 sob corrida, política em duas gravações juntas) e smoke por HTTP (`npx tsx scripts/smoke-hotel-casa-b.ts`, 87 passos, com o `ETag` e o `304` de verdade). **Não está em produção.** A auditoria da E7-01 (01a e 01b) não achou nada crítico nem alto, e as correções dela entraram em 2026-10-29 (temporadas só com `hotel.valores`, `ETag` e `304`, balde de leitura de 300 por hora). O `GET /catalogos` agora traz `temporadas` (só com `hotel.valores`), `servicos`, `politica` e `exigencias`. Seções 7 a 11 (a regra da temporada que vira o ano, a que **não empilha**, e o campo `sobrepoe`).

**Spec de origem:** `docs/specs/2026/q4/q4-1/portal-parceiro/e7-hotel/01-casa-acomodacoes-e-tarifas.md` (decisões do gerente de 2026-10-28, itens 1 a 19).

**Contrato:** `contrato/openapi.json`; gere os tipos dele. Convenções iguais às da onda 0 ([portal-parceiro-e0.md](portal-parceiro-e0.md), seção 1): envelope `{ statusCode, message, data }`; erro com `codigo` (para decidir a tela) e `message` localizada (para mostrar); `?parceiroId=` quando o usuário tem mais de um parceiro. **Dinheiro é inteiro em centavos** (nunca reais com casa decimal). Instantes (`inativaDesde`) vêm em ISO com o offset do fuso da casa.

Substitui, no portal: `acomodacaoRepository` e `catalogoRepository` (blocos, tipos, tarifas) de `features/hotel/data/repositories`.

---

## 1. Quem entra

Todas as rotas exigem o módulo **Hotel** (sem ele: 403 `MODULO_INATIVO`; suspenso: lê, mas a escrita dá 403 `MODULO_SOMENTE_LEITURA`). Sem a permissão: 403 `SEM_PERMISSAO` com `permissao`.

| O quê | Permissão | Quem tem |
|---|---|---|
| Ler a casa (`GET /catalogos`) | `hotel.ler` | DONO, GESTOR, RECEPÇÃO, CUIDADOR, BANHISTA, ADESTRADOR, VETERINÁRIO |
| **Ver dinheiro** (tarifas e o que depende delas) | **`hotel.valores`** (nova) | DONO, GESTOR, RECEPÇÃO |
| Criar, editar e apagar bloco, tipo, tarifa, temporada, serviço, exigência e acomodação; reativar; salvar a política | `estabelecimento.editar` | DONO, GESTOR |
| Ler a política (`GET /politica`) | `hotel.ler` | os mesmos de ler a casa |
| **Desativar** uma acomodação | `estabelecimento.editar` **ou** `hotel.rotina` | DONO, GESTOR, RECEPÇÃO, CUIDADOR, BANHISTA, ADESTRADOR |

- **`hotel.valores` é nova.** Ela vem no `GET /parceiro/portal/eu` (lista `permissoes`). Use-a para esconder, no menu e nas telas, tudo o que mostra preço. O FINANCEIRO **não** a tem e também não lê a casa (sem `hotel.ler`) até a E7-06.
- **Quem não tem `hotel.valores` recebe a casa sem o dinheiro: o campo não vem (não vem zerado, não vem vazio, **não vem**).** Na prática o cuidador, o banhista, o adestrador e o veterinário recebem o `GET /catalogos` **sem a chave `tarifas`** e as acomodações **sem `tarifaId` e `tarifaNome`**. Não renderize coluna ou campo de tarifa quando o valor for `undefined`.
- Quem edita sempre tem `hotel.valores` (um teste da API trava isso). Por isso o formulário de acomodação, que pede a tarifa, só abre para quem a vê. Temporada (acréscimo), serviço (preço) e política (percentuais e prazo) também são dinheiro: a API pede `hotel.valores` além de `estabelecimento.editar` para escrever neles (403 `SEM_PERMISSAO` se faltar).
- **Bloco, tipo, tarifa, acomodação, temporada, serviço ou exigência de outra casa, ou id que não existe:** 403 `OWNERSHIP_FORBIDDEN`, sempre o mesmo corpo. O mesmo vale para o `blocoId`, `tipoId` e `tarifaId` **dentro do corpo** de uma acomodação e para o `vacinaDoCatalogoId` de uma exigência (a vacina global ou da própria casa passa).
- Ações: 200 por hora por pessoa; leituras: **300 por hora** (o `GET /catalogos` e o `GET /politica` são de configuração, não de polling; o mapa em tempo real terá rota enxuta própria na E7-02). Estourou: 429 `CASA_TAXA_EXCEDIDA` com `limite` e `tenteDeNovoEmSegundos`.

---

## 2. Ler a casa

`GET /parceiro/portal/hotel/catalogos`

```json
{
  "blocos":  [ { "id": "...", "nome": "Ala A", "icone": "CASA", "ordem": 0, "quantidadeDeAcomodacoes": 12 } ],
  "tipos":   [ { "id": "...", "nome": "Suíte", "icone": "CAMA", "ordem": 0, "quantidadeDeAcomodacoes": 5 } ],
  "acomodacoes": [ AcomodacaoDto ],
  "tarifas": [ TarifaDto ],
  "temporadas": [ TemporadaDto ],
  "servicos": [ ServicoDto ],
  "politica": PoliticaDto,
  "exigencias": [ ExigenciaDto ],
  "limites": { "acomodacoes": 300, "blocos": 30, "tipos": 30, "tarifas": 20, "temporadas": 30 }
}
```

- `tarifas` **só vem com `hotel.valores`**. `servicos`, `politica` e `exigencias` vêm para todos, mas **sem o dinheiro** quando falta `hotel.valores`; **`temporadas` só vem com `hotel.valores`** (a chave não existe sem ele, seções 7 a 10).
- Pior caso de tamanho (o máximo que os limites permitem): 300 acomodações, 30 temporadas etc. Casa realista no teto: ~170 KB. Todo texto no limite, em emoji, com as 300 acomodações inativas: ~757 KB. Não pagine no cliente; uma leitura só.
- **`ETag` e 304.** A resposta leva `ETag` (forte), `Cache-Control: private, no-cache` e `Vary: Authorization`. O navegador **revalida sozinho** com `If-None-Match` e entrega ao seu código o corpo guardado quando a API responde `304` (sem corpo): o `fetch` do portal não precisa de código novo. Só um cliente que não passe pelo cache do navegador (SSR, teste) trata o `304` à mão. O `ETag` cobre o corpo **e** quem pergunta (a casa e as permissões do hotel, `hotel.valores` entre elas): o `ETag` de quem vê o dinheiro nunca dá `304` para quem não vê. O `304` poupa a banda e o JSON, não a consulta: ele **conta** nas 300 leituras por hora. Não releia a casa em laço; leia ao abrir a tela e depois de cada gravação.
- `blocos` e `tipos` na ordem do mapa (`ordem` crescente; pode ter buracos depois de apagar, não conte com 0, 1, 2...).
- `acomodacoes`: todas, **inclusive as inativas**, agrupáveis por `blocoId` (a lista já vem por bloco, na ordem do mapa, e dentro do bloco por nome sem acento).
- `AcomodacaoDto`:

```json
{
  "id": "...", "nome": "A1",
  "blocoId": "...", "blocoNome": "Ala A",
  "tipoId": "...",  "tipoNome": "Suíte",
  "tarifaId": "...", "tarifaNome": "Padrão",
  "capacidade": 2, "porteMaximo": "GRANDE",
  "especiesAceitas": ["CACHORRO", "GATO"],
  "recursos": ["CAMERA", "JANELA"],
  "higienizacaoMinutos": 60,
  "ativa": true, "motivoInativa": null, "detalheInativa": null, "inativaDesde": null,
  "jaRecebeuHospede": false,
  "ocupadaAgora": false,
  "podeApagar": true
}
```

  - `tarifaId` e `tarifaNome` **ausentes sem `hotel.valores`**.
  - `porteMaximo`: `MINI`, `PEQUENO`, `MEDIO`, `GRANDE`, `GIGANTE`. `especiesAceitas`: `CACHORRO`, `GATO`, `AVE`, `ROEDOR`, `COELHO`, `PEIXE`, `REPTIL`, `OUTRO` (**`OUTRO` é espécie aceita de verdade**, para o hotel de furão). Pelo menos uma. Lista vazia **não** significa "qualquer".
  - `recursos`: `CAMERA`, `CLIMATIZACAO`, `AREA_EXTERNA`, `PISO_AQUECIDO`, `JANELA` (o mapa dos `RecursoDaAcomodacao` do portal: `camera` vira `CAMERA`, `area-externa` vira `AREA_EXTERNA`, e assim por diante).
  - `motivoInativa`: `MANUTENCAO`, `DESINFECCAO`, `REFORMA`, `EQUIPAMENTO`, `OUTRO`. `detalheInativa` é obrigatório com `OUTRO`. `inativaDesde` é gravado **pelo servidor** (nunca vem do corpo).
  - `ocupadaAgora` e `podeApagar` vêm da reserva (E7-02). **Até a E7-02 existir, `ocupadaAgora` é sempre `false` e `podeApagar` só é `false` se `jaRecebeuHospede`.** Não esconda a lógica: ela passa a valer sozinha quando a reserva entrar. Não há nome de hóspede aqui (o cadastro da casa não lê prontuário nem cliente).
- `TarifaDto`:

```json
{
  "id": "...", "nome": "Padrão",
  "diariaPorPorte": { "MINI": 6000, "PEQUENO": 8000, "MEDIO": 10000, "GRANDE": 13000, "GIGANTE": 16000 },
  "acompanhantePercentual": 50,
  "quantidadeDeAcomodacoes": 7
}
```

  `diariaPorPorte` em **centavos**, de 0 a 2.000.000 (R$ 20.000). É o mesmo formato do `Tarifa.diariaPorPorte` do portal, com as chaves em maiúsculas.

---

## 3. Blocos e tipos de acomodação

O hotel dá o nome e escolhe o desenho; o sistema não impõe "canil" nem "suíte". `icone`: `CASA`, `CAMA`, `GATO`, `CAO`, `GRUPO`, `ESCUDO`, `ARVORE`, `PASSARO`, `COELHO` (os 9 do portal).

| Rota | Corpo | Resposta |
|---|---|---|
| `POST /parceiro/portal/hotel/blocos` | `{ nome, icone }` | 201 `BlocoDto` (`ordem` no fim da fila, `quantidadeDeAcomodacoes: 0`) |
| `PATCH /blocos/:id` | `{ nome?, icone? }` | 200 `BlocoDto` |
| `DELETE /blocos/:id` | | 204 |
| `POST /blocos/:id/mover` | `{ direcao: "SOBE" \| "DESCE" }` | 200 `{ itens: BlocoDto[] }` já na nova ordem; no extremo nada muda (200) |
| `POST /tipos`, `PATCH /tipos/:id`, `DELETE /tipos/:id`, `POST /tipos/:id/mover` | iguais | `TipoDto` / `{ itens: TipoDto[] }` |

- `nome`: de 1 a 60 caracteres, **ao menos uma letra ou número**, único na casa **ignorando caixa, acento e espaços das pontas** ("Suíte", "suite " e "SUITE" são o mesmo nome): 409 `NOME_EM_USO` com `recurso` (`BLOCO`, `TIPO`, `TARIFA`, `ACOMODACAO`). A API guarda o nome como foi digitado (só apara as pontas e colapsa espaços).
- Teto: 30 blocos e 30 tipos por casa: 409 `CASA_NO_LIMITE` com `recurso` e `limite`.
- **Apagar com acomodação ligada dá 409** `BLOCO_EM_USO` / `TIPO_EM_USO` com `quantidade`. O **último** bloco ou tipo **pode** ser apagado (a proteção é "em uso", não "sobrar um"). Use `quantidadeDeAcomodacoes` para já desabilitar o botão e dizer por quê.
- `null` num campo do `PATCH`: 400.

---

## 4. Tarifas

| Rota | Corpo | Resposta |
|---|---|---|
| `POST /parceiro/portal/hotel/tarifas` | `{ nome, diariaPorPorte, acompanhantePercentual }` | 201 `TarifaDto` |
| `PATCH /tarifas/:id` | qualquer subconjunto; **`diariaPorPorte` vai inteira** (os 5 portes) | 200 `TarifaDto` |
| `DELETE /tarifas/:id` | | 204 |

- `POST` aceita `Idempotency-Key`: o duplo toque devolve a **mesma** tarifa, não `NOME_EM_USO`.
- Centavos **inteiros** de 0 a 2.000.000 por porte: `1.5`, `-1`, `2000001` e `"R$ 10,00"` dão 400. Converta reais para centavos no portal antes de enviar. `acompanhantePercentual` de 0 a 100, inteiro.
- Mudar a tarifa **em uso** é permitido e vale para os orçamentos **novos**: a reserva já orçada não muda (a reserva congela o orçamento, E7-02). Avise isso na tela.
- **Apagar tarifa que alguma acomodação usa dá 409 `TARIFA_EM_USO`** (`quantidade`).
- Teto: 20 tarifas por casa (409 `CASA_NO_LIMITE`).
- Exige `estabelecimento.editar` e `hotel.valores`.

---

## 5. Acomodações

| Rota | Corpo | Resposta |
|---|---|---|
| `POST /parceiro/portal/hotel/acomodacoes` | `{ nome, blocoId, tipoId, tarifaId, capacidade, porteMaximo, especiesAceitas, recursos?, higienizacaoMinutos }` | 201 `AcomodacaoDto` |
| `PATCH /acomodacoes/:id` | qualquer subconjunto | 200 `AcomodacaoDto` |
| `POST /acomodacoes/:id/desativar` | `{ motivo, detalhe? }` | 200 `AcomodacaoDto` |
| `POST /acomodacoes/:id/reativar` | | 200 `AcomodacaoDto` |
| `DELETE /acomodacoes/:id` | | 204 |

- `POST` aceita `Idempotency-Key`. `capacidade` de 1 a 20 (animais **da mesma casa** que cabem juntos). `higienizacaoMinutos` de 0 a 1440 (zero vale, para coletiva). `recursos` é opcional (padrão vazio). `especiesAceitas` **vazia dá 422 `ESPECIES_OBRIGATORIAS`**; repetida ou fora do enum, 400.
- Teto de **300 acomodações** por casa: 409 `ACOMODACAO_LIMITE` (`limite`).
- **Com reserva viva em cima** (hospedada agora ou por chegar) o `PATCH` não deixa a acomodação encolher: **capacidade, porte e espécies só crescem** e o **tipo não muda**; senão 409 `ACOMODACAO_COM_RESERVAS` com `reason` (`CAPACIDADE`, `PORTE`, `ESPECIES`, `TIPO`), `quantidade` e `primeiraEntrada`. **Higienização e tarifa mudam** e valem só para reservas novas. Antes da E7-02 isso nunca dispara.
- **Desativar** (o cuidador faz às 3 da manhã com a baia quebrada): `motivo` obrigatório; `OUTRO` exige `detalhe` (400 sem ele). Já inativa: 200, o motivo original fica. **Hospedada agora: 409 `ACOMODACAO_OCUPADA`** (sem o nome do hóspede). **Com reserva por chegar: 409 `ACOMODACAO_COM_RESERVAS`** com `reason: "DESATIVAR"`, `quantidade` e `primeiraEntrada` (mostre "mude as reservas de acomodação antes"). Quem desativou fica gravado na trilha.
- **Reativar** e **apagar** só para quem tem `estabelecimento.editar` (o cuidador desativa, mas não reativa nem apaga). Já ativa: 200.
- **Apagar** só a que nunca recebeu hóspede e nunca teve reserva (de qualquer status): senão 409 `ACOMODACAO_COM_HISTORICO`, e a tela oferece **desativar**. `podeApagar` já diz.
- `nome` único na casa (mesma regra da seção 3): `NOME_EM_USO` com `recurso: "ACOMODACAO"`.
- `null` num campo do `PATCH`: 400. Mandar `parceiroId` ou `inativaDesde` no corpo: 400.

---

## 6. Erros novos (para decidir a tela)

| `codigo` | Status | Quando |
|---|---|---|
| `NOME_EM_USO` | 409 | nome repetido na casa; `recurso`: `BLOCO`, `TIPO`, `TARIFA`, `ACOMODACAO` |
| `BLOCO_EM_USO` | 409 | apagar bloco com acomodação (`quantidade`) |
| `TIPO_EM_USO` | 409 | apagar tipo com acomodação (`quantidade`) |
| `TARIFA_EM_USO` | 409 | apagar tarifa que acomodação usa (`quantidade`) |
| `ACOMODACAO_OCUPADA` | 409 | desativar acomodação com hóspede agora |
| `ACOMODACAO_COM_RESERVAS` | 409 | desativar ou encolher com reserva por chegar (`reason`: `DESATIVAR`, `CAPACIDADE`, `PORTE`, `ESPECIES`, `TIPO`; `quantidade`; `primeiraEntrada`) |
| `ACOMODACAO_COM_HISTORICO` | 409 | apagar acomodação que já recebeu hóspede ou teve reserva |
| `ACOMODACAO_LIMITE` | 409 | a 301ª acomodação (`limite: 300`) |
| `CASA_NO_LIMITE` | 409 | 31º bloco, 31º tipo, 21ª tarifa ou 31ª temporada (`recurso`: `BLOCO`, `TIPO`, `TARIFA`, `TEMPORADA`; `limite`) |
| `ESPECIES_OBRIGATORIAS` | 422 | acomodação sem nenhuma espécie aceita |
| `TEMPORADA_INVALIDA` | 422 | `MM-DD` que não existe no calendário (`02-30`, `04-31`): `reason: "DIA_INEXISTENTE"`, `campo` (`inicioMesDia` ou `fimMesDia`) |
| `SERVICO_DUPLICADO` | 409 | já existe o serviço deste tipo na casa |
| `EXIGENCIA_DUPLICADA` | 409 | já existe a exigência deste tipo na casa |
| `EXIGENCIA_INVALIDA` | 422 | `reason`: `VACINA_EM_KIND_QUE_NAO_E_VACINA` (vacina do catálogo numa exigência que não é de vacina) ou `VACINA_INATIVA` |
| `POLITICA_INVALIDA` | 422 | `reason: "SAIDA_DEPOIS_DO_LIMITE"`: o horário de saída vem depois do limite da meia diária |
| `CASA_TAXA_EXCEDIDA` | 429 | `limite`, `tenteDeNovoEmSegundos` |

Os de sempre: 403 `OWNERSHIP_FORBIDDEN`, 403 `SEM_PERMISSAO`, 403 `MODULO_INATIVO`, 403 `MODULO_SOMENTE_LEITURA`, 400 de forma.

---

## 7. Temporadas

Faixas **recorrentes**, sem ano: "Fim de ano" vale de 20/12 a 05/01 **todo ano**. A API guarda e devolve `MM-DD`.

| Rota | Corpo | Resposta |
|---|---|---|
| `POST /parceiro/portal/hotel/temporadas` | `{ nome, inicioMesDia, fimMesDia, acrescimoPercentual }` | 201 `TemporadaDto` |
| `PATCH /temporadas/:id` | qualquer subconjunto | 200 `TemporadaDto` |
| `DELETE /temporadas/:id` | | 204 |

```json
{ "id": "...", "nome": "Fim de ano", "inicioMesDia": "12-20", "fimMesDia": "01-05",
  "acrescimoPercentual": 20, "sobrepoe": ["<id da Pico de Natal>"] }
```

- **A que vira o ano é UMA faixa.** `inicioMesDia: "12-20"` e `fimMesDia: "01-05"` (o fim menor que o início atravessa a virada). Não parta em duas, e mostre como uma linha só. O fim é **inclusivo** (a noite de 05/01 conta).
- `MM-DD` com zero à esquerda (`"02-01"`, nunca `"2-1"`). Forma errada (`13-01`, `2-1`, com ano): 400. **Dia que não existe** (`02-30`, `04-31`): 422 `TEMPORADA_INVALIDA` com `campo`. `02-29` é aceito (vale só nos anos bissextos).
- `acrescimoPercentual`: inteiro de 0 a 300. `nome`: de 1 a 60, ao menos uma letra ou número, **pode repetir** (é rótulo; a chave é o `id`).
- **Sobreposição é permitida e NÃO empilha.** Em cada noite vale **só** a temporada de maior acréscimo (no empate, a mais antiga). Se "Fim de ano" é 20% e "Pico de Natal" é 35% e as duas cobrem o dia 25, a noite paga **35%**, não 55%. **O portal hoje soma: essa regra muda aí.** A leitura marca `sobrepoe` (os `id`s das outras faixas que dividem pelo menos um dia com esta, nas duas pontas) para a tela mostrar o aviso "nos dias em comum vale a de maior acréscimo".
- **Sem `hotel.valores` a temporada inteira some do `GET /catalogos`** (a chave `temporadas` não vem: nem nome, nem datas, nem `sobrepoe`), porque o nome é texto livre da casa e pode dizer "Natal +40%". O cuidador, o banhista, o adestrador e o veterinário não têm tela de temporada; o gate do menu por `hotel.valores` já a esconde.
- Teto: 30 por casa (409 `CASA_NO_LIMITE`, `recurso: "TEMPORADA"`).
- Mudar ou apagar a temporada não mexe em reserva já orçada (a reserva congela o orçamento, E7-02).
- `null` em campo do `PATCH`: 400.
- O orçamento (E7-02) usa a regra por noite: a estadia de 28/12 a 03/01 tem 6 noites e todas pegam a faixa de fim de ano.

## 8. Serviços

| Rota | Corpo | Resposta |
|---|---|---|
| `POST /parceiro/portal/hotel/servicos` | `{ kind, precoCentavos, porDiaria }` | 201 `ServicoDto` |
| `PATCH /servicos/:id` | `{ precoCentavos?, porDiaria?, ativo? }` | 200 `ServicoDto` |

```json
{ "id": "...", "kind": "BANHO", "precoCentavos": 4500, "porDiaria": false, "ativo": true }
```

- `kind`: `BANHO`, `TOSA`, `PASSEIO_EXTRA`, `RECREACAO_INDIVIDUAL`, `TRANSPORTE`, `ADESTRAMENTO`, `MEDICACAO_ASSISTIDA`. **Um por tipo na casa**: o segundo dá 409 `SERVICO_DUPLICADO`. O `kind` não muda (campo desconhecido no `PATCH` dá 400).
- **O serviço NÃO se apaga: não existe `DELETE`.** Para tirar de venda: `PATCH { ativo: false }`; o `id` continua estável no orçamento e no resumo. A leitura devolve também os inativos (a tela precisa para reativar). O orçamento (E7-02) só oferece os ativos.
- `precoCentavos` inteiro de 0 a 2.000.000. `1.5`, `-1`, `"R$ 45,00"` dão 400.
- **`precoCentavos` é ausente sem `hotel.valores`** (o cuidador vê quais serviços existem e se são por diária, sem preço).
- `porDiaria: true` cobra por noite; `false`, uma vez por estadia.

## 9. Política da casa

| Rota | Corpo | Resposta |
|---|---|---|
| `GET /parceiro/portal/hotel/politica` | | 200 `PoliticaDto` |
| `PUT /parceiro/portal/hotel/politica` | os 6 campos, **todos obrigatórios** | 200 `PoliticaDto` |

```json
{ "padrao": false, "horarioDeEntrada": "08:00", "horarioDeSaida": "12:00", "limiteMeiaDiaria": "18:00",
  "meiaDiariaPercentual": 50, "sinalPercentual": 30, "cancelamentoSemCustoDias": 7 }
```

- **Casa que nunca salvou:** a API devolve o padrão do sistema (entrada 08:00, saída 12:00, limite da meia diária 18:00, meia diária 50%, sinal 30%, cancelamento sem custo com 7 dias) com **`padrao: true`**. Mostre o formulário preenchido com isso e um aviso "padrão, ainda não salvo". Nada é gravado só por ler.
- `PUT` é a política **inteira** (não há `PATCH`): `null` ou campo omitido dá 400. Mande de volta os valores que a tela mostra.
- Horários `HH:mm` de 24 horas (`"09:00"`; `"9:00"` e `"24:00"` dão 400). **A saída não pode vir depois do limite da meia diária:** 422 `POLITICA_INVALIDA` (`reason: "SAIDA_DEPOIS_DO_LIMITE"`); saída igual ao limite vale. Percentuais inteiros de 0 a 100; `cancelamentoSemCustoDias` de 0 a 365.
- **`PUT` do mesmo corpo de novo é seguro:** devolve 200 sem regravar (duplo toque, retry de rede).
- **Sem `hotel.valores`** (cuidador, veterinário...) a resposta traz **só os três horários** (e `padrao`). `meiaDiariaPercentual`, `sinalPercentual` e `cancelamentoSemCustoDias` ficam ausentes.
- Mudar a política não reescreve reserva: a E7-02 congela sinal, cancelamento e orçamento na reserva.
- Não há `antecedenciaMinimaHoras` aqui: é da configuração de reserva online (E7-03).

## 10. Exigências de admissão

O que o hóspede apresenta na entrada, por tipo e por espécie. É dado da casa (varia entre hotéis e com a legislação local).

| Rota | Corpo | Resposta |
|---|---|---|
| `POST /parceiro/portal/hotel/exigencias` | `{ kind, bloqueia, especies?, validadeMeses?, vacinaDoCatalogoId? }` | 201 `ExigenciaDto` |
| `PATCH /exigencias/:id` | `{ bloqueia?, especies?, validadeMeses?, vacinaDoCatalogoId? }` | 200 `ExigenciaDto` |
| `DELETE /exigencias/:id` | | 204 |

```json
{ "id": "...", "kind": "VACINA_ANTIRRABICA", "especies": ["CACHORRO", "GATO"], "validadeMeses": 12,
  "bloqueia": true, "vacinaDoCatalogoId": "..." }
```

- `kind`: `VACINA_POLIVALENTE`, `VACINA_ANTIRRABICA`, `VACINA_TOSSE_CANIS`, `VACINA_GIARDIA`, `VERMIFUGO`, `ANTIPULGAS`, `EXAME_PARASITOLOGICO`, `TERMO_RESPONSABILIDADE`. **Uma por tipo na casa** (409 `EXIGENCIA_DUPLICADA`); o `kind` não muda (para trocar, apague e crie).
- **`especies` vazia (ou ausente) significa TODAS as espécies.** É o contrário da acomodação, onde vazio é recusado. Máximo 8, sem repetir.
- `validadeMeses`: de 1 a 60, ou **`null` = não vence** (o termo de responsabilidade nasce assim). No `PATCH`, `null` **limpa**.
- **`bloqueia` é obrigatório e explícito** no `POST` (`true`: sem o comprovante o hóspede não entra; `false`: só avisa). No `PATCH`, `null` dá 400.
- `vacinaDoCatalogoId`: só nos tipos `VACINA_*` (senão 422 `EXIGENCIA_INVALIDA`, `reason: "VACINA_EM_KIND_QUE_NAO_E_VACINA"`). Aceita a vacina global ou da própria casa, **ativa** (inativa: 422, `reason: "VACINA_INATIVA"`; de outra casa ou inexistente: 403 igual). É por ela que a admissão (E7-04) lê a carteirinha. No `PATCH`, `null` limpa.
- Pode apagar: a reserva e o comprovante guardam o **tipo**, não uma ligação com a exigência.
- Todo papel com `hotel.ler` lê as exigências (não há dinheiro nelas). Escrever pede `estabelecimento.editar`.

## 11. O que o portal troca

- Mapa e cadastro da casa (blocos, tipos, acomodações): lê `GET /catalogos` em vez do dataset do mock; as regras `impedimentoParaNomear`, `reservasVivas` e as recusas `CadastroRecusadoError` (`nome-repetido`, `ocupada`, `tem-reserva`, `tem-reserva-inativar`, `tem-historico`, `em-uso`) viram os códigos da seção 6. A regra `ultimo` **sai**: o último bloco ou tipo pode ser apagado.
- O gate do menu da tela "Casa" por `hotel.valores` (a tabela de preços, as temporadas, o preço dos serviços e os percentuais da política somem para o cuidador).
- **Temporadas:** o portal soma as que se sobrepõem; a API usa a de maior acréscimo por noite. Troque a regra do cálculo e mostre o aviso a partir de `sobrepoe`. A que vira o ano deixa de ser "duas linhas": é uma, `12-20` a `01-05`.
- **Serviços:** o botão "excluir serviço" vira "tirar de venda" (`ativo: false`).
- **Política:** o padrão vem da API (`padrao: true`); o `PUT` leva os 6 campos.
- **Exigências:** o `kind` mapeia para o nome da vacina do catálogo; mande o `vacinaDoCatalogoId` quando a casa escolher a vacina.
- Reservas: seguem no mock até a E7-02.

## 12. Para quem consome pela API (E7-02)

Não é tarefa do front. A reserva usa `CasaLeituraService.carregarParaCalculo` (acomodações, tarifas, temporadas, serviços ativos por tipo, política efetiva e exigências, em objetos simples) e as funções puras de `src/hotel/casa/regras/temporada.ts`: **`escolherPorNoite(noites, temporadas)`** (a temporada que vale em cada noite, com a contagem) e **`acrescimoVigenteEm(data, temporadas)`** (o acréscimo da temporada vigente numa data, 0 se nenhuma); `noitesDe(entrada, saida)` gera as noites a partir de datas civis. A reserva registra o provedor de ocupação no `GanchosDaCasa`; a ordem de travas é Parceiro, Acomodação, Reserva (`src/hotel/casa/casa-apoio.ts`).

---

# E7-02a: as reservas do hotel (o núcleo)

**Backend:** pronta e validada em dev em 2026-10-29 (pasta `wt/e7-02`, commit sem push, **em auditoria**): unit (golden das regras do portal), integração contra o Postgres de dev (a corrida de 20 reservas na mesma baia, as duas exclusion constraints, os triggers, o livro, os ganchos do cadastro) e smoke por HTTP (`npx tsx scripts/smoke-hotel-reservas.ts`, 24 passos). **Não está em produção** (falta criar a extensão `btree_gist` lá, ação do Nicolas). A E7-02b (comprovantes, dispensas, autorizados, grade, lista, espera, rota do app, contadores) vem depois.

**Spec de origem:** `docs/specs/2026/q4/q4-1/portal-parceiro/e7-hotel/02-reservas-e-disponibilidade.md` (decisões do gerente de 2026-10-28, itens 1 a 25).

Substitui, no portal: `reservaRepository` (`mapa`, `simular`, `vaga`, `criar`, `editar`, `confirmar`, `cancelar`) e as regras de `domain/disponibilidade.ts` e `domain/tarifas.ts`. A grade, a lista, os comprovantes, as dispensas e a espera seguem no mock até a E7-02b.

## 13. Quem faz o quê

| Ação | Permissão | Observação |
|---|---|---|
| Mapa e ler reserva | `hotel.ler` | Veterinário, cuidador, banhista, adestrador, recepção, gestor, dono |
| Simular, criar, editar, cancelar, não comparecimento | `hotel.reserva` | O cuidador cria e edita, mas **não vê dinheiro** |
| Registrar pagamento (`confirmar`) | `hotel.valores` | Dono, gestor, recepção. O cuidador leva 403 `SEM_PERMISSAO` |

**Dinheiro some da resposta sem `hotel.valores`** (ausente, nunca zerado): `orcamento`, `pagoCentavos`, `saldoCentavos`, `abaixoDoSinal`, `precoUnitarioCentavos` dos serviços, os percentuais e o prazo da política, `diferenca` da edição e `sinalReembolsavel` do cancelamento. O cuidador vê a reserva, as datas, a baia, os serviços (sem preço) e a observação.

## 14. Data e hora (sempre na parede da casa)

- O corpo leva **`entradaData`/`saidaData`** (`AAAA-MM-DD`) e **`entradaHora`/`saidaHora`** (`HH:mm`, opcionais; faltando, valem o `horarioDeEntrada` e o `horarioDeSaida` da política). **Nenhum offset**: o servidor converte no fuso da casa.
- Tudo volta em ISO com o offset da casa (`2026-12-20T14:00:00-03:00`).
- **Diárias** contam meia-noite atravessada, com piso de 1 (o day use paga uma diária, sem saída tardia). Nunca divida por 24 h: na troca de horário uma estadia de 46 h tem 2 diárias.
- Limites: entrada não pode ficar antes do início de hoje na casa, até 120 noites, entrada até 730 dias à frente (`PERIODO_INVALIDO` com `reason`).

## 15. Rotas (prefixo `/parceiro/portal/hotel`)

| Rota | Corpo ou query | Resposta |
|---|---|---|
| `GET /mapa` | `entradaData`, `saidaData`, `entradaHora?`, `saidaHora?`, **`pacienteId` OU `porte` + `especie`** (os dois ou nenhum: 400), `ocupantes?` | `{ entrada, saida, diarias, truncado, vagas: [{ acomodacaoId, nome, blocoId, tipoId, situacao, impedimentos[], conflitos[] (até 3) }] }`. `situacao`: `LIVRE`, `OCUPADA` (hóspede), `RESERVADA`, `HIGIENIZACAO`, `FORA_DE_OPERACAO`. `impedimentos`: **todos** os que valem (`INATIVA`, `PORTE`, `ESPECIE`, `CAPACIDADE`, `OCUPADA`, `HIGIENIZACAO`). Conflito com `atrasada: true` é hóspede que passou da saída prevista. **Use esta rota no polling do mapa** (balde próprio), não o `GET /catalogos` |
| `POST /reservas/simular` | o mesmo do criar (com `pacienteId` ou `porte` + `especie`; acompanhante por `acompanhantePacienteId` ou `porteAcompanhante` + `especieAcompanhante`), `reservaId?` para simular a edição | `{ entrada, saida, diarias, impedimentos, petJaHospedado, disponivel, orcamento?, diferenca? }` |
| `POST /reservas` | `pacienteId`, `acompanhantePacienteId?`, `acomodacaoId`, datas e horas, `origem` (`BALCAO`, `TELEFONE`, `WHATSAPP`, `RETORNO`, `INDICACAO`), `servicos?: [{ servico, quantidade 1..99, observacao?, dia?, hora? }]` (até 20), `observacao?` (até 500) | `ReservaDto`, 201, `PENDENTE`. **Mande sempre `Idempotency-Key`** (UUID v4): repetir devolve a mesma reserva |
| `GET /reservas/:id` | | `ReservaDto` |
| `PATCH /reservas/:id` | **`versao`** e o que mudou. `acompanhantePacienteId: null` tira o acompanhante; `observacao: null` limpa | `ReservaDto` com `reprecificada` e `diferenca?` |
| `POST /reservas/:id/confirmar` | `{ pagoCentavos, versao, motivo? }` | `ReservaDto` |
| `POST /reservas/:id/cancelar` | `{ motivo }` | `ReservaDto` com `diasParaAEntrada` e `sinalReembolsavel?` |
| `POST /reservas/:id/nao-compareceu` | sem corpo (**sem** `Content-Type`) | `ReservaDto` |

`ReservaDto`: `id`, `status` (`PENDENTE`, `CONFIRMADA`, `HOSPEDADO`, `ENCERRADA`, `CANCELADA`, `NAO_COMPARECEU`), `origem`, `pacienteId`, `acompanhantePacienteId`, `acomodacaoId`, `entradaPrevista`, `saidaPrevista`, `diarias`, `higienizacaoMinutos`, `servicos`, `observacao`, `politica` (`horarioDeSaida`, `limiteMeiaDiaria` e, com valores, os percentuais e `cancelamentoSemCustoDias`), `orcamento?` (`linhas`, `totalCentavos`, `sinalCentavos`), `pagoCentavos?`, `saldoCentavos?`, `abaixoDoSinal?`, `pendenteHaHoras` (só PENDENTE), `canceladaEm`, `motivoCancelamento`, `naoCompareceuEm`, `versao`, `criadoEm`.

Linhas do orçamento (`tipo`): `DIARIA`, `ACOMPANHANTE` (com `percentual`), `TEMPORADA` (uma por temporada, `temporadaNome`, `percentual`; em cada noite vale a de maior acréscimo), `SERVICO` (`servico`, `porDiaria`), **`SAIDA_TARDIA`** (com `percentual` 50 ou 100: o portal hoje rotula "meia diária" mesmo cobrando uma inteira; mostre o percentual). O total é **sempre** o do servidor: o corpo não tem campo de total nem de preço (400 se mandar).

## 16. As regras que mudam no portal

- **Higienização simétrica.** A baia precisa da higienização depois de **qualquer** saída, inclusive a da reserva nova. O portal só somava a da reserva que já existia, e o resultado dependia da ordem de criação. Agora: saída 18:00 com 2 h, a entrada às 19:00 é recusada (`HIGIENIZACAO`) nas duas ordens; às 20:00 passa.
- **O mesmo animal em duas baias** é recusado (`PET_JA_HOSPEDADO_NO_PERIODO`), como principal ou acompanhante. A resposta não traz o id da outra reserva.
- **Paciente sem porte não reserva** (422 `PORTE_NAO_INFORMADO`): corrija o porte na ficha. Para a pergunta do telefone ("tem vaga para um labrador?") use o mapa e o simular com `porte` + `especie` soltos.
- **Confirmar manda o TOTAL PAGO ACUMULADO**, não o valor desta vez (o portal soma). Ex.: pagou 105,00 de sinal e depois mais 50,00: mande `10500` e depois `15500`. Repetir o mesmo número não muda nada. A reserva só vira `CONFIRMADA` com o pago cobrindo o sinal (409 `CONFIRMACAO_SEM_SINAL`). Baixar o total pede `motivo` (10 a 300); depois de confirmada, baixar não desconfirma e `abaixoDoSinal` avisa.
- **Editar só a observação não muda o preço.** Mudar datas, baia, acompanhante ou serviços recalcula (o serviço que já estava fica com o preço da venda; o novo entra pelo preço de hoje) e a resposta traz `diferenca`. Para mostrar antes, chame o simular com `reservaId`. Com o hóspede na casa (`HOSPEDADO`) só a saída, os serviços e a observação mudam.
- **Cancelar** só `PENDENTE` e `CONFIRMADA`. O instante é do servidor (não mande data). `sinalReembolsavel` usa o prazo **congelado na reserva** (o prometido na venda) e os dias civis da casa entre o cancelamento e a entrada. É só indicador: o reembolso é do balcão.
- **Não comparecimento** só a partir do fim do dia da entrada (00:00 do dia seguinte na casa): antes, 409 `NAO_COMPARECEU_CEDO` com `aPartirDe`. Solta a baia na hora.
- **PENDENTE não expira sozinha** (o cliente pode ter pago e o balcão não registrou). Mostre `pendenteHaHoras`.
- **O fuso da casa não muda** com reserva pendente, confirmada ou hóspede (409 `FUSO_COM_RESERVAS_VIVAS` no salvar do perfil, E1-01).
- No cadastro (E2-01): inativar paciente com reserva viva dá 409 `PACIENTE_COM_RESERVAS`; óbito com o animal hospedado dá 409 `PACIENTE_HOSPEDADO`, e o óbito cancela as reservas futuras (motivo `OBITO_DO_ANIMAL`, sem aviso ao responsável); juntar dois cadastros com reservas no mesmo período dá 409 `RESERVAS_SOBREPOSTAS_NO_MESCLAR`; a exclusão a pedido do titular com reserva viva dá 409 `PACIENTE_COM_RESERVAS` (cancele antes).

## 17. Erros novos (decidir a tela pelo `codigo`)

| Código | HTTP | Extra |
|---|---|---|
| `ACOMODACAO_OCUPADA_NO_PERIODO` | 409 | `reason`: `OCUPADA`, `HIGIENIZACAO` |
| `PET_JA_HOSPEDADO_NO_PERIODO` | 409 | |
| `ACOMODACAO_INATIVA` | 409 | |
| `ACOMODACAO_INCOMPATIVEL` | 409 | `reason` (o primeiro) e `reasons`: `PORTE`, `ESPECIE`, `CAPACIDADE` |
| `PERIODO_INVALIDO` | 422 | `reason`: `ORDEM`, `PASSADO`, `LONGO`, `LONGE`; `noitesMax`, `diasAFrenteMax` |
| `PORTE_NAO_INFORMADO` | 422 | |
| `ACOMPANHANTE_INVALIDO` | 409 | `reason`: `IGUAL`, `OUTRA_CASA` (outro cliente) |
| `SERVICO_INATIVO` | 409 | `servico` |
| `SERVICO_INVALIDO` | 422 | `reason`: `REPETIDO`, `DIA`; `servico` |
| `ORCAMENTO_ACIMA_DO_LIMITE` | 422 | `limiteCentavos` |
| `RESERVA_ALTERADA` | 409 | `versaoAtual` (releia e tente de novo) |
| `RESERVA_NAO_EDITAVEL` | 409 | `reason`: `STATUS`, `HOSPEDADO_SO_SAIDA`, `CONGELADA`; `status` |
| `CONFIRMACAO_SEM_SINAL` | 409 | `sinalCentavos` |
| `PAGAMENTO_INVALIDO` | 422 | `reason`: `MOTIVO_OBRIGATORIO` |
| `NAO_COMPARECEU_CEDO` | 409 | `aPartirDe` (ISO com offset) |
| `PACIENTE_COM_RESERVAS` | 409 | `quantidade` (cadastro) |
| `PACIENTE_HOSPEDADO` | 409 | (cadastro) |
| `RESERVAS_SOBREPOSTAS_NO_MESCLAR` | 409 | `quantidade` (cadastro) |
| `FUSO_COM_RESERVAS_VIVAS` | 409 | `quantidade` (perfil, E1-01) |
| `HOTEL_TAXA_EXCEDIDA` | 429 | `limite`, `tenteDeNovoEmSegundos` |

Recurso de outra casa ou inexistente: o 403 `OWNERSHIP_FORBIDDEN` de sempre. Reaproveitados: `PACIENTE_INATIVO`, `PACIENTE_COM_OBITO`, `CADASTRO_MESCLADO`, `SEM_PERMISSAO`.

## 18. App do responsável e notificações

Nada nesta fatia: a lista de reservas do app é da E7-02b e os avisos (cancelamento pelo hotel, mudança de baia) entram com a E7-03 e a E7-04. **Nenhum tipo de notificação novo** nesta entrega, então nada muda no `rotas-notificacao.ts`.

## 19. Para quem consome pela API (E7-03, E7-04, E7-06)

Não é tarefa do front. Contratos pedidos e entregues:
- **`ReservasService.criarNaTransacao(tx, quem, dados, { origem, pedidoId, criadoPorId, antesDeCriar })`**: o aceite do pedido online (E7-03) cria a reserva dentro da própria transação. Tudo é conferido sob as travas (paciente FOR SHARE, acomodação, perfil, relógio, `antesDeCriar`, vaga, INSERT). O `23P01` aborta a transação: **quem embrulha o `$transaction` traduz** (`naTransacaoDaReserva` ou `traduzirViolacaoDeReserva`, de `src/hotel/reservas/reservas-apoio.ts`).
- **Política congelada na reserva** (E7-04): `horarioDeSaida`, `limiteMeiaDiaria`, `meiaDiariaPercentual`, `sinalPercentual`, `cancelamentoSemCustoDias` e `higienizacaoMinutos` são colunas da reserva; `politicaDaReserva(reserva)` os devolve. O check-out recalcula só quantidades com esses valores e os preços unitários das linhas.
- **`registrarPagamentoNaTransacao(tx, ...)`** (E7-04): o livro com o delta, quem e quando, e o cache `pagoCentavos`.
- **Dispensa por animal** (E7-04): a tabela `DispensaDeExigencia` já existe com `pacienteId` e o índice único parcial `(reservaId, pacienteId, kind) WHERE revogadaEm IS NULL`; o serviço e as rotas são da E7-02b.
- **`orcamento.linhas[]`** (E7-06b): tipo exportado `LinhaDoOrcamento` (`src/hotel/reservas/regras/orcamento.ts`) e CHECK no banco `jsonb_typeof(orcamento->'linhas') = 'array'`. Os escalares `totalCentavos`, `sinalCentavos` e `pagoCentavos` ficam ao lado do Json.
- **`DisponibilidadeService.contarPorTipo(db, parceiroId, { entrada, saida, porte, especie, ocupantes, agora })`** (E7-03): livres por tipo numa consulta agregada, sem id nem nome de acomodação. A E7-03 lê o mesmo `livres` na consulta única dela, e o pedido online não muda esse número (decisão 23 da spec 03: o pedido não segura vaga; só a reserva ocupa).
- Ordem de travas no topo de `reservas-apoio.ts`: (Parceiro, só quem já o pega) -> Paciente FOR SHARE -> Acomodação FOR NO KEY UPDATE -> Perfil FOR SHARE -> Reserva.


## 20. Resumo do hotel (E7-06a, sem dinheiro)

`GET /parceiro/portal/hotel/resumo?periodo=&de=&ate=&parceiroId=`. Permissão `hotel.ler` (dono, gestor, recepção, veterinário, cuidador, banhista, adestrador; **financeiro e enfermagem: 403**). Módulo HOTEL ligado (suspenso ainda lê). Só leitura. O dinheiro (receita, diária média, serviços, sinal retido) é da E7-06b, na **seção 20.1**: o bloco `receita` só vem para quem tem `hotel.faturamento`, e a chave **não vem** para os outros.

**Período.** Sem nada, vale os **últimos 30 dias terminando hoje** (diferente do resumo da clínica, cujo padrão é HOJE). Atalhos: `hoje` → `HOJE`, `semana` → `SEMANA`, `semana-passada` → `SEMANA_PASSADA`, `trinta-dias` → `TRINTA_DIAS`. Ou `de` e `ate` (`AAAA-MM-DD`, na parede da casa, ano de 2000 a 2100), **no máximo 90 dias**. `periodo` junto com `de`/`ate`, `de` sem `ate` ou mais de 90 dias: 400 `RESUMO_PERIODO_INVALIDO` (`motivo`: `PERIODO_E_DATAS`, `DATA_FALTANDO`, `DATA_INVERTIDA`, `MUITOS_DIAS`, `PERIODO_DESCONHECIDO`). `de` e `ate` no futuro valem: os dias depois de hoje vêm `prevista: true` e **ficam fora da média**.

**Resposta (campos novos, tudo em contagens e razões 0..1).**

| Campo | O que é |
|---|---|
| `periodo` | `{ de, ate, dias, origem }` (`origem` é o atalho pedido ou `LIVRE`) |
| `fuso`, `geradoEm`, `emCache` | fuso IANA da casa; ISO com offset; `true` só quando veio da memória (período fechado: 5 min; aberto: 45 s) |
| `ocupacao.media` | `{ valor, de }`: `noitesOcupadas / noitesDisponiveis`. **Toda taxa vem com o denominador ao lado** (`de`): mostre "50% (10 de 20 noites)", e "sem dados" quando `de` for 0 |
| `ocupacao.noitesOcupadas`, `noitesDisponiveis` | só dias até hoje com acomodação operando |
| `ocupacao.noitesPendentes` | noites seguradas só por reserva `PENDENTE` (sem sinal). **Não é ocupação**; mostre à parte |
| `ocupacao.porDia[]` | `{ data, ocupadas, operando, pendentes, taxa, prevista }`. `operando` é a capacidade **daquele dia** (acomodação desativada não conta, criada depois não conta) |
| `diariasVendidas` | diárias das estadias `ENCERRADA`, pelo dia do encerramento |
| `cancelamento` | `{ taxa: { valor, de }, canceladas, dentroDoPrazo, foraDoPrazo, perdasEmDiarias, canceladasPorObito }`. A reserva cancelada por óbito do animal **fica fora da taxa e das perdas**; mostre `canceladasPorObito` numa linha própria |
| `naoComparecimento` | `{ taxa: { valor, de }, quantidade, perdasEmDiarias }` |
| `porOrigem[]` | `{ origem, reservas }` das estadias `ENCERRADA` no período, da maior para a menor (origens com zero não vêm) |
| `retorno` | `{ atendidos, queVoltaram, taxa: { valor, de }, historicoDesde }`. **Por cliente**, não por animal. Com `atendidos` 0 ou casa nova, diga "dados desde `historicoDesde`" em vez de "ninguém voltou" |
| `semDesfecho` | reservas `PENDENTE` ou `CONFIRMADA` com entrada antes de hoje: o que ficou sem fechar. Indicador, não soma em nada |
| `capacidadeExata` | `false` quando o período começa antes do histórico de capacidade e há acomodação mais antiga: mostre o aviso "capacidade estimada" |
| `ocupacaoUsaDatasPrevistas` | `true` até o check-out real existir (E7-04): a ocupação de uma estadia encerrada antes do previsto sai um pouco acima do real |
| `criterios` | o critério de cada número (dia da entrada, do encerramento, por noite, por cliente). Use para o texto de ajuda; **não decida regra pelo valor** |
| `ocorrenciasDisponiveis` | `false` enquanto a E7-05 não está no ar. Com `true`: `ocorrencias[]` = `{ kind, leve, moderada, grave }` (só contagens, até 50 tipos) ou `ocorrenciasFalhou: true` (o resto da resposta vale) |

**Regras de coorte (para a legenda da tela).** Ocupação é **por noite**; diárias vendidas e origem, pelo **dia do encerramento**; cancelamento e não comparecimento, pelo **dia da entrada prevista**. Por isso a estadia que atravessa a virada do mês tem noites nos dois meses e as diárias no mês em que termina.

**Erros novos** (decidir a tela pelo `codigo`):

| Código | HTTP | Extra |
|---|---|---|
| `RESUMO_DO_HOTEL_TAXA_EXCEDIDA` | 429 | `limite`, `janela` (`HORA` 300/h ou `MINUTO` 10/min), `tenteDeNovoEmSegundos` |
| `RESUMO_DO_HOTEL_EM_ANDAMENTO` | 429 | `tenteDeNovoEmSegundos: 2` (outro período da mesma casa em cálculo: espere e repita; o **mesmo** pedido não dá esse erro) |
| `RESUMO_DO_HOTEL_LEITURA_EXCEDIDA` | 400 | `limite` (`RESERVAS`, `ACOMODACOES` ou `PERIODOS_DE_INATIVIDADE`), `maxDias` e, em `RESERVAS`, `maxReservas` (20.000) e `diasQueCabem` (sugira esse período); em `ACOMODACOES` e `PERIODOS_DE_INATIVIDADE` vem `teto` (1.000 e 5.000) e **não** vem `diasQueCabem`: um período menor não resolve a casa de baias demais, mostre só o aviso |

Reaproveitados: `RESUMO_PERIODO_INVALIDO`, `PAINEL_OCUPADO` (503), `SEM_PERMISSAO`, `MODULO_INATIVO`. **Não deixe a tela repetir o pedido sozinha a cada poucos segundos**: o limite é de 10 por minuto por pessoa e a mesma casa calcula um período por vez; trocar de período rápido demais devolve 429.

**App, site, CMS: nada. Nenhum tipo de notificação novo** (nada muda no `rotas-notificacao.ts`).

### 20.1 O faturamento do hotel (E7-06b, 2026-10-29)

No `develop` depois da correção da auditoria (29/10). **Não está em produção.** A correção mudou o contrato: veja "O que mudou na correção da auditoria" no fim desta seção.

**Permissão nova `hotel.faturamento`**: DONO, GESTOR e FINANCEIRO. Ela vem no `GET /parceiro/portal/eu` (lista `permissoes`). A RECEPÇÃO continua com `hotel.valores` para orçar ao telefone, mas **não** vê o faturamento da casa. O FINANCEIRO **não** ganhou `hotel.valores` nem `hotel.ler`: ele não lê a casa, só o faturamento.

**Qual chamada a tela faz, pela lista `permissoes`:**

| Tem | Chamada | O que vem |
|---|---|---|
| `hotel.ler` e `hotel.faturamento` (dono, gestor) | `GET /resumo` | o resumo da seção 20 **com** o bloco `receita` |
| `hotel.ler` sem `hotel.faturamento` (recepção, veterinário, cuidador, banhista, adestrador) | `GET /resumo` | o resumo **sem** a chave `receita` (não vem zerada: **não vem**). Não renderize card de dinheiro quando `receita` for `undefined` |
| só `hotel.faturamento` (financeiro) | `GET /resumo/receita` | só o bloco de dinheiro (abaixo). `GET /resumo` dá 403 para ele |

**`GET /parceiro/portal/hotel/resumo/receita?periodo=&de=&ate=&parceiroId=`** (permissão `hotel.faturamento`, mesmo módulo, mesmos `periodo`, `de` e `ate` da seção 20, padrão de 30 dias, até 90 dias). Resposta: `{ periodo, fuso, geradoEm, emCache, receita }`. O dono e o gestor também podem chamá-la; o cálculo e o cache são os mesmos da rota 1.

**O bloco `receita`** (tudo inteiro em **centavos**):

| Campo | O que é |
|---|---|
| `receitaCentavos` | soma do total das estadias `ENCERRADA`, pelo **dia do encerramento**. Hóspede ainda na casa (`HOSPEDADO`) **não** entra |
| `diariasVendidas` | a base das médias (as diárias dessas estadias) |
| `diariaMediaCentavos` | **só a hospedagem** (diária, acompanhante e temporada) por diária vendida, arredondado; `0` sem diárias (mostre "sem dados"). **Pode não vir**: ver `porServicoFalhou` |
| `receitaPorDiariaCentavos` | a receita **inteira** (hospedagem, serviços e saída tardia) por diária vendida. Sempre vem |
| `porOrigem[]` | `{ origem, reservas, receitaCentavos }`, da maior receita para a menor |
| `porServico[]` | `{ servico, vezes, receitaCentavos }`: os serviços mais vendidos (`ServicoHotelKind`), da maior receita para a menor. `vezes` já vem multiplicado pelas diárias quando o serviço é por diária. **Pode não vir**: ver `porServicoFalhou` |
| `porServicoFalhou` | `true` quando a leitura das linhas do orçamento passou de 2 s (casa muito grande, período longo): **não vêm** `porServico` nem `diariaMediaCentavos`; o resto do dinheiro vale. Mostre "serviços indisponíveis agora, tente um período menor" e, no lugar da diária média, a `receitaPorDiariaCentavos` com o rótulo dela. Não repita o pedido sozinho |
| `sinalRetido` | `{ retidoCentavos, reservas, aDevolverCentavos, reservasADevolver, pagoEmNaoCompareceuCentavos, reservasNaoCompareceu }`. `retido`: nas canceladas **fora** do prazo, o que está pago **até o valor do sinal** da reserva. `aDevolver`: o que o balcão deve devolver: o pago das canceladas **dentro** do prazo, o que passou do sinal nas canceladas **fora** do prazo e, em reserva que segue ou encerrou, o que passou do total (o total que caiu com o óbito de um dos dois animais). `pagoEmNaoCompareceu`: à parte, o sistema não decide |
| `canceladasPorObito` | `{ reservas, valorParadoCentavos }`: canceladas por óbito do animal **com dinheiro pago**, **fora** do retido e do a devolver. Linha própria, texto neutro. A contagem de todas (com ou sem dinheiro) é `cancelamento.canceladasPorObito`, na seção 20 |
| `criterios` | o critério de cada número (`informativo: true`, `receita: 'ORCAMENTO_CONGELADO'`). Use para o texto de ajuda; **não decida regra pelo valor** |

**Coortes, para a legenda:** receita, diária média, origem e serviços pelo **dia do encerramento**; sinal retido, a devolver, não comparecimento e óbito pelo **dia da entrada prevista** (as mesmas coortes do cancelamento na seção 20).

**Textos obrigatórios na tela:**
- O sinal retido, o a devolver e o pago em não comparecimento são **informativos**: o sistema não cobra nem devolve dinheiro. Ex.: "Valores registrados no balcão. O PetJourney não cobra nem devolve."
- Enquanto `criterios.receita` for `ORCAMENTO_CONGELADO`, a receita é o **valor vendido na reserva** (o check-out com o valor final ainda não existe). Ex.: "Receita pelo valor da reserva."
- **O "a devolver" de reserva já cancelada não baixa pelo sistema hoje**: não existe rota para registrar a devolução numa reserva cancelada (lacuna da E7-02/E9). Diga isso na ajuda do card: "A devolução é feita no balcão; o valor continua aqui até existir o registro de devolução."
- Nada de "comissão"; nada de "tutor" (use "responsável"); nada de travessão.

**Erros** (nenhum código novo):

| Código | HTTP | Quando |
|---|---|---|
| `SEM_PERMISSAO` | 403 | `GET /resumo/receita` sem `hotel.faturamento`; vem `permissao: 'hotel.faturamento'` (a recepção cai aqui) |
| `MODULO_INATIVO` | 403 | módulo HOTEL nunca ligado |
| `RESUMO_PERIODO_INVALIDO`, `RESUMO_DO_HOTEL_LEITURA_EXCEDIDA` | 400 | os mesmos da seção 20 |
| `RESUMO_DO_HOTEL_TAXA_EXCEDIDA`, `RESUMO_DO_HOTEL_EM_ANDAMENTO` | 429 | os mesmos da seção 20. **O limite é o mesmo para as duas rotas** (10 por minuto por pessoa, somadas) |
| `PAINEL_OCUPADO` | 503 | o mesmo da seção 20 |

**O que mudou na correção da auditoria (29/10)** (gere os tipos de novo do `contrato/openapi.json`):
- `diariaMediaCentavos` mudou de conta: agora é só a hospedagem por diária. A conta antiga (receita inteira por diária) virou `receitaPorDiariaCentavos`. `diariaMediaCentavos` e `porServico` passaram a **opcionais**.
- Campo novo `porServicoFalhou`.
- `sinalRetido.retidoCentavos` não passa mais do sinal; o que passa vai para `aDevolverCentavos`, que também soma o pago acima do total em reserva viva ou encerrada.
- `canceladasPorObito.reservas` conta só as que têm dinheiro pago.
- Na ocupação (seção 20), quem está `HOSPEDADO` depois da saída prevista segue ocupando a acomodação até hoje (`criterios.hospedadoDepoisDaSaidaOcupaAteAgora`).

**App, site, CMS: nada. Nenhum tipo de notificação novo.**


# E7-03a: reserva online do hotel (pedido pelo app e pela página do site)

Spec: `docs/specs/2026/q4/q4-1/portal-parceiro/e7-hotel/03-reserva-online.md` (decisões do gerente de 29/10). Esta parte (03a) deixa a pessoa **pedir** a hospedagem pelo app e pelo site e acompanhar/cancelar o pedido. A **caixa do balcão, o aceite que cria a reserva, a recusa, os avisos ao responsável, o contador e o e-mail ao visitante** chegam na **E7-03b**: até lá o pedido fica PENDENTE e expira sozinho quando a data de entrada chega. Tudo atrás do módulo HOTEL e de `ativo=false` na configuração.

## 21. Datas, horas e o que o pedido promete (nada: sujeito à confirmação do hotel)

- Datas no corpo e na query sempre `YYYY-MM-DD` (data civil da casa). A hora é a da **política do hotel** (`horarioDeEntrada`, `horarioDeSaida`), e a resposta traz `entrada`/`saida` em ISO com o offset da casa. Nunca mande hora nem offset do navegador.
- Pelo menos 1 noite (`saida > entrada`), até 120 noites, dentro de `horizonteDias` (contado em dias civis da casa).
- **Urgência:** entrada antes de `antecedenciaMinimaHoras` não vira pedido. A disponibilidade devolve `urgente: true` e o `contato` (telefone, WhatsApp, `orientacaoDeUrgencia` no idioma do hotel); o POST dá 409 `FORA_DA_ANTECEDENCIA` com o mesmo `contato`. A tela leva para ligar/mandar mensagem.
- **O pedido não segura vaga (decisão 23 da spec 03, 29/10).** A disponibilidade do app e do site conta só as reservas, que só o hotel cria; nenhum pedido tira vaga de ninguém. A vaga só fica garantida no **aceite do balcão**. Dois clientes podem ver "disponível" para a última unidade: o hotel aceita um e recusa o outro com o motivo `SEM_VAGA` (o mesmo que acontece com a venda por telefone).
- **Copy obrigatória:** a tela diz **"Sujeito à confirmação do hotel"** antes de enviar (na disponibilidade e no resumo do pedido) e na confirmação do pedido criado. Nenhum texto do pedido diz "vaga reservada", "reserva confirmada" ou "garantida" enquanto ele estiver `PENDENTE`. Os 6 locales, com o en-GB explícito:

  | Locale | Texto |
  |---|---|
  | pt-BR | Sujeito à confirmação do hotel. |
  | en-US | Subject to confirmation by the hotel. |
  | en-GB | Subject to confirmation by the hotel. |
  | es-419 | Sujeto a la confirmación del hotel. |
  | sr-Latn | Podložno potvrdi hotela. |
  | ar | يخضع لتأكيد الفندق. |
- **Escolher acomodação** (`ACOMODACAO_ESCOLHIDA` + `tipoId`): exige acomodação livre do tipo nas datas. Sem nenhuma (o balcão reservou): 409 `SEM_VAGA_NO_TIPO`, **releia a disponibilidade**.
- **Teto da caixa:** com 30 pedidos pela internet do mesmo tipo nas mesmas noites (janela de 24 h), 30 "hotel escolhe" ou, no site, 30 do link, o POST dá 409 `HOTEL_PEDIDOS_NO_LIMITE` com `escopo: HOTEL` e o `contato` (telefone e WhatsApp). A disponibilidade avisa antes: `pedidosNoLimite` no tipo e `hotelEscolheNoLimite`. Mostre "o hotel já tem muitos pedidos pela internet para estas datas" com os botões de telefone e WhatsApp, e deixe o tipo visível (a vaga existe). **O cliente da casa** (no app, `clienteDaCasa: true`: vínculo ativo de dono atual ou pedido aceito antes) não entra nesses tetos e recebe os avisos como `false`.
- **O hotel escolhe** (`HOTEL_ESCOLHE`, sem `tipoId`): exige vaga em algum tipo nas datas ou, com `aceitaMudarUmDia: true`, um dia antes ou depois (as duas pontas). Sem vaga: 409 `SEM_VAGA_NO_PERIODO`. O pedido guarda as datas pedidas; quem mexe a data é o aceite (03b, só -1 ou +1).
- `responderAte` conta só a janela diária do balcão (`balcaoAbre`..`balcaoFecha`, no fuso da casa). Ex.: pedido às 21:00, prazo de 3 h, balcão 08:00 a 20:00 = 11:00 do dia seguinte.
- Até **2 animais da mesma casa e da mesma espécie** (cão e gato: 409 `NAO_DIVIDEM_ACOMODACAO`). O maior porte decide a vaga.

## 22. Portal: a configuração (`/parceiro/portal/hotel`)

| Rota | Permissão | O que faz |
|---|---|---|
| `GET /reserva-online` | `hotel.ler` | A configuração (nasce desligada), `slug`, `perfilPublicado`, `tiposQueServem` (tipos da configuração com acomodação ativa) |
| `PUT /reserva-online` | `estabelecimento.editar` (dono e gestor) | Corpo inteiro: `ativo`, `permiteEscolherAcomodacao`, `permiteHotelEscolhe`, `aceitaPeloLink`, `mostrarValores`, `tipoIds` (até 30, na ordem), `antecedenciaMinimaHoras` (0 a 720), `horizonteDias` (1 a 365), `prazoDeRespostaHoras` (1 a 72), `balcaoAbre`/`balcaoFecha` (`HH:mm`, pelo menos 60 min), `orientacaoDeUrgencia` (até 300, opcional) |

- Ligar exige: página publicada, módulo HOTEL escrevendo, um modo, ao menos um tipo com acomodação ativa e o balcão válido. Senão 400 `RESERVA_ONLINE_INVALIDA` com `reason`: `BALCAO`, `PERFIL_NAO_PUBLICADO`, `MODULO`, `SEM_MODO`, `SEM_TIPO`, `TIPO_SEM_ACOMODACAO`. Tipo de outra casa no corpo: 403 (o mesmo de sempre).
- **`mostrarValores` fica desligado por padrão** e o texto de "estimativa" passa pelo parecer antes de alguém ligar. Na tela, deixe o interruptor com o aviso de que preço, sinal e prazo de cancelamento passam a aparecer para o público.
- Desligar não apaga pedido: os pendentes seguem e expiram sozinhos; a página pública passa a dar o 404 único.

## 23. App (`/tutor/hotel`, só o dono pede; a família lê)

| Rota | O que faz |
|---|---|
| `GET /estabelecimentos/:slug/reserva-online` | O que o hotel publicou + `pets` do dono: `porte` (o da ficha do hotel vence o declarado, `porteDoHotel`), `semPorte`, `porteSugerido` (de `DogInfo.porte`, só sugestão), `jaAcompanhado` |
| `GET /estabelecimentos/:slug/disponibilidade?petIds=a,b&entrada=&saida=` | Tipos com `disponivel` e `livres` (**cortado em 3**: mostre "3 ou mais"; só as reservas contam), `pedidosNoLimite`, `urgente`, `contato`, `diarias`, `hotelEscolheDisponivel`, `hotelEscolheComUmDia`, `hotelEscolheNoLimite`, `clienteDaCasa`; `estimativaCentavos` só com `mostrarValores`. Mostre "Sujeito à confirmação do hotel" |
| `POST /pedidos` (com `Idempotency-Key`) | `{ slug, petIds[1..2], modo, entrada, saida, tipoId?, aceitaMudarUmDia?, servicos?[kinds], observacao? (até 500, interna do hotel) }` |
| `GET /pedidos?petId=` | Abertos e os últimos 30 dias (até 20). Com `petId`, a família que lê o pet também vê |
| `GET /pedidos/:id` | Um pedido (dono, ou família com leitura do pet) |
| `POST /pedidos/:id/cancelar` | Só o dono, só PENDENTE (409 `PEDIDO_JA_RESPONDIDO` com `status`). **Cancelar não devolve a vez:** o pedido cancelado continua contando no teto de 3 da pessoa naquele hotel até a data de **saída** dele. Antes de confirmar o cancelamento, avise que ele não libera um pedido novo nesse hotel até essa data |
| `POST /pets/:petId/porte` `{ porte }` | Só o dono. Grava o porte declarado no pet (`MINI`, `PEQUENO`, `MEDIO`, `GRANDE`, `GIGANTE`); idempotente |

- **Sem porte:** o POST dá 422 `PORTE_OBRIGATORIO` com `petId`. Mostre a escolha de porte (com a sugestão), grave em `POST /pets/:petId/porte` e repita.
- O deep link do site é `petjourneyapp://reservar/<slug>`.
- **Texto da tela de pedir (decisão 11):** diga que o **estabelecimento** passa a acompanhar o pet quando o hotel aceitar (o vínculo nasce no aceite, 03b). O parecer jurídico valida o texto.
- A resposta não traz id do parceiro, do dono, da reserva, hash do token nem a observação. `hotel` vem com `slug`, `nome`, `telefone`, `whatsapp`, `fuso`.
- Família: `somenteLeitura: true`, `podeCancelar: false`, sem o texto da recusa; cancelar dá 403 `SOMENTE_LEITURA`.
- Status: `PENDENTE`, `ACEITO`, `RECUSADO`, `DESISTIU`, `EXPIRADO` (o pendente cuja entrada chegou já aparece EXPIRADO).

## 24. Site (`petjourney.health/reservar/<slug>` e `/reserva/<token>`)

**Chame a API pelo navegador do visitante, nunca pelo proxy do Next (`/api/proxy`, o padrão do `apiClient` do site).** O pedido tem um balde diário por ORIGEM (10 por dia, por IPv4 ou /64, sem o hotel na chave) e um balde da rota por IP. Pelo proxy, todo visitante chega com o IP do servidor do site: o balde de 10 por dia vira um só para todos os hotéis, e o 11º pedido do dia, somando todos, recebe 409 (`ORIGEM`). Com 10 captchas, alguém fecharia o canal de reserva de todos os hotéis por um dia. Use `fetch` direto para a API no componente do cliente (o `ALLOWED_ORIGINS` de produção precisa ter `https://petjourney.health`).

| Rota | Proteção | O que faz |
|---|---|---|
| `GET /public/estabelecimentos/:slug/hotel` | balde por origem | O que o hotel publicou, sem id e sem pets |
| `GET /public/estabelecimentos/:slug/hotel/disponibilidade?especie=&porte=&ocupantes=&entrada=&saida=` | balde por origem | `disponivel` por tipo (**sem contagem**; só as reservas contam), `pedidosNoLimite`, `urgente`, `contato`, `hotelEscolheNoLimite`. Com 30 pedidos do link nas mesmas noites, tudo vem com `pedidosNoLimite: true` e `hotelEscolheNoLimite: true` (o POST recusaria), sem tirar a vaga: mostre o `contato`. Mostre "Sujeito à confirmação do hotel" |
| `POST /public/estabelecimentos/:slug/hotel/pedidos` | captcha (`X-Captcha-Token`, Turnstile), balde, `Idempotency-Key` | `{ modo, entrada, saida, tipoId?, aceitaMudarUmDia?, servicos?, observacao?, responsavel: { nome, telefone, email? }, animais[1..2]: { nome, especie, especieOutra?, porte }, idioma? }`. Devolve `{ id, token, link, responderAte, status }` |
| `GET /public/reservas/:token` | balde, `Cache-Control: no-store`, `Referrer-Policy: no-referrer` | A página de acompanhamento, sem dado pessoal |
| `POST /public/reservas/:token/cancelar` | balde | Desiste do pendente |

- O **token só existe na primeira resposta** (no banco fica o hash). Repetir com a mesma `Idempotency-Key` devolve o mesmo `id` com `token: null`. Guarde o link na tela de sucesso. O e-mail com o link chega na 03b.
- Porte é **obrigatório** por animal no site. `especie: OUTRO` exige `especieOutra`.
- Hotel inexistente, não publicado, sem o módulo, com o online desligado ou sem o link: **o mesmo 404** `HOTEL_NAO_RESERVA_PELO_APP`, também no POST do pedido (correção da auditoria, 29/10). Mostre "este hotel não recebe pedidos online agora" sem distinguir.
- A página do token não pode ter analytics nem mandar `Referer`.
- Sem captcha: 400 `CAPTCHA_INVALIDO`. Em produção, sem captcha configurado, 503 `CAPTCHA_NAO_CONFIGURADO` (o Railway precisa de `PUBLIC_CAPTCHA_ENABLED` e `TURNSTILE_SECRET`).

## 25. Erros novos (decidir a tela pelo `codigo`)

| Código | Status | Quando | Campos |
|---|---|---|---|
| `HOTEL_NAO_RESERVA_PELO_APP` | 404 | O hotel não recebe pedido online (todo motivo) | |
| `SEM_VAGA_NO_TIPO` | 409 | Não há acomodação livre do tipo nas datas (o balcão reservou). O pedido de outra pessoa nunca causa este erro | `tipoId` |
| `SEM_VAGA_NO_PERIODO` | 409 | O hotel escolhe, mas não há vaga (nem a um dia, se aceitou) | |
| `FORA_DA_ANTECEDENCIA` | 409 | Entrada perto demais | `antecedenciaHoras`, `contato` |
| `NAO_DIVIDEM_ACOMODACAO` | 409 | Espécies diferentes | `reason: ESPECIE` |
| `PORTE_OBRIGATORIO` | 422 | Pet sem porte | `petId` |
| `HOTEL_MODO_INDISPONIVEL` | 409 | Modo que o hotel não ligou, ou o link desligado | `modo` |
| `HOTEL_PEDIDOS_NO_LIMITE` | 409 | Tetos: 3 pedidos por pessoa no hotel, **contando os que ela cancelou, os que o hotel recusou e os que expiraram sem resposta**, até a **saída** de cada um; 10 pendentes no total; os **tetos da caixa** (janela de 24 h; o cliente da casa, pelo app, não entra): **30 pedidos do mesmo tipo nas mesmas noites** (app e link juntos; vem com `tipoId`), **30 "hotel escolhe" nas mesmas noites** (sem `tipoId`), **30 do link nas mesmas noites** (só o site); 3 por telefone por hotel por dia, 10 no total; 10 por origem por dia. Com `escopo: HOTEL` a mensagem é "o hotel já tem muitos pedidos pela internet para estas datas", com o `contato`: mostre os botões de telefone e WhatsApp (com `tipoId`, ofereça também outro tipo ou o "hotel escolhe"). A disponibilidade avisa antes (`pedidosNoLimite`, `hotelEscolheNoLimite`), sem tirar a vaga | `limite`, `escopo` (`PESSOA`, `HOTEL`, `TELEFONE`, `ORIGEM`), `tipoId`; com `escopo: PESSOA` ou `HOTEL`, `contato` (`telefone`, `whatsapp`, `orientacaoDeUrgencia`, `idiomaDosTextos`, o mesmo da página pública): mostre "fale com o hotel" com esses botões |
| `HOTEL_BLOQUEADO_PELO_RESPONSAVEL` | 409 | O dono bloqueou o estabelecimento | |
| `PEDIDO_RESERVA_JA_ABERTO` | 409 | O mesmo pet já tem pedido pendente neste hotel que cruza as datas | |
| `RESERVA_ONLINE_INVALIDA` | 400 | Configuração (ver 22) | `reason` |
| `HOTEL_PEDIDO_TAXA_EXCEDIDA` | 429 | 30 ações e 300 leituras por pessoa por hora (app); criar pedido pelo app também 20 por origem (rede) por hora; 600 na configuração | `limite`, `tenteDeNovoEmSegundos` |

Reaproveitados: `PERIODO_INVALIDO` (422, `reason`: `ORDEM`, `LONGO`, `PASSADO`, `JANELA` com `horizonteDias`), `PEDIDO_JA_RESPONDIDO`, `PEDIDO_NAO_ENCONTRADO`, `PEDIDO_INVALIDO` (`reason`: `TIPO_OBRIGATORIO`, `TIPO_FORA_DO_ONLINE`, `TIPO_SO_NA_ACOMODACAO_ESCOLHIDA`, `PETS_INVALIDOS`, `ANIMAIS_INVALIDOS`), `PET_INATIVO`, `SOMENTE_LEITURA`, `PET_JA_HOSPEDADO_NO_PERIODO`, `SERVICO_INATIVO` (`servico`), `TELEFONE_INVALIDO`, `ESPECIE_OUTRA_OBRIGATORIA`, `CAPTCHA_INVALIDO`, `CAPTCHA_NAO_CONFIGURADO`.

## 26. Notificações novas (app: `rotas-notificacao.ts`)

Os 6 tipos já existem no enum e no catálogo (copy fixa, sem nome de pet nem do hotel). Todos abrem **`/screens/notifications`** até o app ter a tela do pedido de hospedagem (decisão 16): sem a entrada no `rotas-notificacao.ts`, o toque cai em Unmatched Route.

| Tipo | Quem recebe | Sai quando |
|---|---|---|
| `PEDIDO_RESERVA_RECEBIDO` | Equipe com `hotel.valores` (recepção, gestor, dono), no portal | Já sai: cada pedido novo (até 20 por hotel por hora) |
| `RESERVA_PEDIDO_ACEITO` | O dono que pediu | E7-03b (aceite) |
| `RESERVA_PEDIDO_ALOCADO` | O dono que pediu | E7-03b (aceite com outra acomodação ou um dia de diferença) |
| `RESERVA_PEDIDO_RECUSADO` | O dono que pediu | E7-03b (recusa; o texto do hotel fica na tela, nunca no push) |
| `RESERVA_CANCELADA_PELO_HOTEL` | O dono atual com vínculo | E7-03b (gancho do cancelar da E7-02) |
| `RESERVA_BAIA_MUDOU` | O dono atual com vínculo | E7-04 (mudança de baia) |

Canal Android: `cuidado` para os do responsável, `conta` para o da equipe. Sem e-mail para nenhum.

## 20. Correção da auditoria da E7-02a (2026-10-29)

O que muda para o front:
- **Óbito de um dos dois animais:** a reserva **não é mais cancelada**. O animal que morreu sai, e o outro fica com a baia, as datas, o status e o pagamento. Se morreu o principal, o acompanhante vira o principal. O total cai: sai a linha `ACOMPANHANTE` e a temporada é recalculada. Se o pago passar do total novo, o saldo aparece negativo (a devolver), como no editar. A resposta da falta com óbito (`obito` em `FaltaMarcadaDto`) traz `reservasCanceladas` e `reservasAjustadas`, só com os ids. O animal que estava sozinho continua com a reserva cancelada (`OBITO_DO_ANIMAL`).
- **Exclusão a pedido do titular:** a reserva pendente ou confirmada **sem nenhum pagamento registrado** é cancelada (`RESPONSAVEL_DESISTIU`) e sai junto. A resposta (`ClienteAnonimizadoDto`) traz `reservasCanceladas` (ids). Com pagamento registrado, continua o 409 `PACIENTE_COM_RESERVAS`. Com o animal hospedado, `PACIENTE_HOSPEDADO`.
- **Cancelar:** `diasParaAEntrada` e `sinalReembolsavel` agora são os valores gravados no momento do cancelamento. A forma da resposta é a mesma.
- **Mapa:** no pior caso a resposta tem cerca de 297 KB (300 acomodações). Peça só o período da tela.

Para quem consome pela API (E7-03, E7-04):
- `registrarPagamentoNaTransacao(tx, { parceiroId, reservaId, novoTotalCentavos, motivo, usuarioId })`: **o `pagoAntesCentavos` saiu da entrada**. A função lê o pago com `FOR NO KEY UPDATE` e devolve `{ deltaCentavos, pagoAntesCentavos }`.
- `criarNaTransacao` traduz o `23P01` lá dentro (num savepoint). O chamador recebe `PET_JA_HOSPEDADO_NO_PERIODO` ou `ACOMODACAO_OCUPADA_NO_PERIODO`, nunca o erro cru.
- `animalOcupado(db, ids, entrada, saida, agora, ignorar?)` ganhou `agora`: o animal hospedado além da saída prevista ocupa até agora.
- Ordem de travas do check-in, da mudança de baia e do prorrogar: Paciente FOR SHARE, Acomodação FOR NO KEY UPDATE, Reserva FOR NO KEY UPDATE (topo de `reservas-apoio.ts`).
- A reserva terminada congela também quem cancelou, o motivo, o sinal, as diárias, os serviços, a higienização e a política. Quem escreve na reserva ENCERRADA (o orçamento final da E7-04) precisa gravar antes de mudar o status, ou acrescentar a sua coluna à lista do trigger na migration dela.

## 27. Check-in e estadia (E7-04a, 2026-10-29)

Spec: `docs/specs/2026/q4/q4-1/portal-parceiro/e7-hotel/04-check-in-estadia-e-check-out.md` (decisões do gerente de 29/10). O check-out, o peso de saída, os pertences na saída, a publicação no app, mudar de baia e as fotos são da **E7-04b** (ainda não existem). Tudo sob `/parceiro/portal/hotel`, módulo HOTEL (SUSPENSO: leitura passa, escrita 403).

### Quem faz o quê

| Ação | Permissão | Quem tem |
|---|---|---|
| Admissão, veterinários do pet, check-in | `hotel.checkin` | dono, gestor, recepção, cuidador, banhista, adestrador |
| Medicação, cuidado, adaptação | `hotel.rotina` | idem |
| Acrescentar serviço | `hotel.reserva` | idem (a diferença de preço só sai com `hotel.valores`) |
| Hóspedes, estadia, vacinas do catálogo | `hotel.ler` | idem, mais o veterinário |

O contato de emergência só aparece com `hotel.checkout` (o veterinário não vê). Não há dinheiro na estadia.

### Rotas

| Método e rota | O que faz |
|---|---|
| `GET /reservas/:id/admissao` | A R1 por animal contra o **último dia** da estadia, com a fonte de cada item. Lê a carteirinha do app (vacinas e alergias, só leitura) quando o pet tem vínculo válido. Devolve `podeEntrar`, `impedimentos` e `autorizacoesPreMarcadas` (pelo que foi vendido). Não grava nada |
| `GET /reservas/:id/veterinarios?pacienteId=` | As clínicas que atendem o pet no PetJourney (vínculo ativo do dono atual). Responde `{ leituraDoApp, clinicas }`: cada clínica com `id` (opaco), `nome`, `telefone`, `telefonePlantao`. Sem vínculo: `LIDA` com lista vazia. Reserva que não aguarda entrada: `NAO_LIDA` com lista vazia (seção 27.1) |
| `POST /reservas/:id/check-in` | Corpo `{ versao, animais: [...] }`, **um item por animal da reserva** (principal e acompanhante). Aceita `Idempotency-Key`. 201 com `EstadiaDaReservaDto` (`id` é o id da reserva, `status`, `versao`, `hospedagens[]`) |
| `GET /reservas/:id/estadia` | As hospedagens da reserva |
| `GET /hospedes?cursor=&limit=` | Quem está na casa: `hospedagemId`, animal, baia, `entradaEm`, `saidaPrevista`, `adaptacao`, `atrasado`, `tom` (`OK`, `ATENCAO`, `RISCO`), `alertas` (`ATRASADO`, `ESTRESSADO`, `MEDICACAO`, `TAREFAS_ATRASADAS`) e `tarefas` (nulo até a E7-05 ligar a rotina). `proximoCursor` |
| `GET /hospedagens/:id` | A estadia detalhada: plano, autorizações, pertences, medicações, cuidados, veterinário, o snapshot da admissão (`admissao`), `leituraDoApp` e `avisos` |
| `POST /hospedagens/:id/medicacoes` | Medicação trazida de casa (201) |
| `POST /hospedagens/:id/medicacoes/:medicacaoId/suspender` | 200; repetir devolve igual |
| `POST /hospedagens/:id/cuidados` | Cuidado (curativo, escovação) (201) |
| `POST /hospedagens/:id/cuidados/:cuidadoId/encerrar` | 200; repetir devolve igual |
| `PATCH /hospedagens/:id/adaptacao` | `{ adaptacao }`: `TRANQUILO`, `EM_ADAPTACAO` ou `ESTRESSADO` |
| `POST /hospedagens/:id/servicos` | `{ versao, servico, quantidade, observacao?, dia?, hora? }` com a **versão da reserva**. Responde a reserva editada (`ReservaEditadaDto`) |
| `GET /vacinas-do-catalogo?especie=` | Para escolher a vacina da exigência: `id`, `nome`, `especies`, `propria`, `ativo` (até 200) |

### O corpo de cada animal no check-in

- `pacienteId`, `pesoKg` (0,05 a 250, até 2 casas), `inspecaoDeEntrada?` (até 500).
- `pertences?`: até 20 de `{ descricao (até 80), quantidade (1 a 99), observacao? }`.
- `planoAlimentar`: `{ racaoPropria, marca?, porcaoGramas (1 a 5000), horarios (HH:mm, 1 a 12), restricoes?, petiscos? }`.
- `medicacoes?` (até 10): `{ descricao, via (ORAL, TOPICA, OTOLOGICA, OFTALMICA, SUBCUTANEA), doseTexto, horarios, inicio?, fim?, receita? }` ou, sem receita, `semReceita: true` com `motivoSemReceita` (10 a 300). O hotel não calcula dose: `doseTexto` é texto.
- `cuidados?` (até 10): `{ descricao, horarios, inicio?, fim?, observacao? }`.
- `autorizacoes`: **as seis**, uma por tipo, sempre no corpo: `BANHO`, `PASSEIO_EXTERNO`, `RECREACAO_EM_GRUPO`, `FOTO_EM_REDE_SOCIAL`, `ATENDIMENTO_VETERINARIO` (com `limiteCentavos?`) e `TRANSPORTE`, cada uma `{ kind, concedida }`. A tela pré-marca com `autorizacoesPreMarcadas`, mas manda as seis.
- `contatoEmergencia`: `{ nome, telefone, relacao? }` (obrigatório).
- `veterinarioParceiroId?` (da lista de veterinários) **ou** `veterinarioTexto?` com `{ nome, telefone?, clinica? }`, nunca os dois.
- `adaptacao?` (padrão `EM_ADAPTACAO`), `observacao?` (interna, até 500).
- Não mande `entradaEm`, `status` nem `acomodacaoId`: 400. O instante é do servidor.

### Regras que a tela precisa mostrar

- Check-in só de reserva **CONFIRMADA**, a partir do dia da entrada (na parede da casa). Antes do horário, só com a baia livre agora.
- A admissão aceita, por exigência: comprovante do balcão (E7-02b), vacina do app publicada por clínica (`APP_COMPROVADA`) e vacina lançada pelo responsável (`APP_DECLARADA`, só se a exigência tiver `aceitaDeclarada`). Nome de vacina ambíguo não casa. `declaradaNaoAceita: true` é a dica "o responsável lançou, mas a casa não aceita declarada".
- **Comprovante do balcão sem documento (ligado com a E7-02b em 29/10).** Numa exigência que bloqueia e não tem `aceitaDeclarada`, o "visto no balcão" sem foto nem PDF **não conta**. O item vem com **`balcaoSemDocumento: true`**, e a dica é "visto no balcão, sem documento: anexe a foto ou o PDF, ou peça a dispensa à gestão". O anexo é a rota `POST /reservas/:id/comprovantes/com-documento` (seção 30). Como o `aceitaDeclarada` só existe nos tipos `VACINA_*`, nos outros tipos que bloqueiam o balcão sem documento nunca conta. O snapshot gravado antes de 29/10 volta com `balcaoSemDocumento: false`.
- `vence-durante` em exigência que bloqueia **impede** a entrada, como `vencido` e `ausente`. A dispensa é **por animal**: a do principal não libera o acompanhante.
- `leituraDoApp`: `LIDA`, `SEM_VINCULO` ou `INDISPONIVEL` (o app não respondeu; vale o balcão).
- Avisos (não travam): `AUTORIZACAO_NEGADA_COM_SERVICO` (serviço vendido com a autorização negada), `EXIGENCIA` (exigência que não bloqueia, ou dispensada) e `ALERGIA_POSSIVEL` (a medicação cita uma alergia do app; só na resposta do check-in).
- Exigência: o cadastro ganhou `aceitaDeclarada` (padrão falso; só nos tipos `VACINA_*`).

### Erros novos (decidir a tela pelo `codigo`)

| Código | Status | Extra |
|---|---|---|
| `ADMISSAO_BLOQUEADA` | 409 | `impedimentos: [{ pacienteId, kind, situacao }]` |
| `MEDICACAO_SEM_HORARIO` | 409 | `pacienteId`, `indice` |
| `RESERVA_NAO_CONFIRMADA` | 409 | |
| `CHECKIN_CEDO` | 409 | `aPartirDe` (ISO) |
| `CHECKIN_DEPOIS_DA_SAIDA` | 409 | |
| `BAIA_AINDA_OCUPADA` | 409 | |
| `ANIMAIS_DIFERENTES_DA_RESERVA` | 400 | |
| `HOSPEDAGEM_ENCERRADA` | 409 | |
| `AUTORIZACOES_INCOMPLETAS` | 422 | `reason`: `FALTANDO`, `REPETIDA`, `LIMITE_FORA_DA_VETERINARIA` |
| `CONTATO_DE_EMERGENCIA_OBRIGATORIO` | 422 | `pacienteId` |
| `VETERINARIO_INVALIDO` | 400 | `reason`: `FORA_DA_LISTA`, `DOIS` |
| `ITEM_DA_ESTADIA_INVALIDO` | 422 | `reason`: `RECEITA_OBRIGATORIA`, `MOTIVO_SEM_RECEITA_OBRIGATORIO`, `RECEITA_E_SEM_RECEITA`, `MOTIVO_SEM_RECEITA_SO_SEM_RECEITA`, `INICIO_FORA_DA_ESTADIA`, `FIM_ANTES_DO_INICIO` |
| `ITENS_DA_ESTADIA_NO_LIMITE` | 409 | `reason`: `MEDICACOES`, `CUIDADOS`; `limite` |
| `HOTEL_ESTADIA_TAXA_EXCEDIDA` | 429 | `limite`, `tenteDeNovoEmSegundos` |

Reaproveitados: `RESERVA_ALTERADA` (`versaoAtual`), `RESERVA_NAO_EDITAVEL`, `PACIENTE_COM_OBITO`, `PACIENTE_INATIVO`, `CADASTRO_MESCLADO`, `CURSOR_INVALIDO`, `OWNERSHIP_FORBIDDEN`, `SEM_PERMISSAO`.

### App do responsável e notificações

Nada novo na E7-04a: nenhum tipo de notificação, nenhuma tela. A leitura da carteirinha fica na trilha que o responsável já vê (acessos da clínica, `LER_DADO_DO_APP`).

### Para quem consome pela API (E7-05, E7-02b)

- `GanchosDaEstadia` (`src/hotel/estadia/ganchos-da-estadia.ts`): a E7-05 registra `aoIniciarEstadia`, `aoMudarARotina` (com `motivo: { tipo, origemId? }`, tipo em `MEDICACAO`, `CUIDADO`, `SERVICO`, `PLANO`, `AUTORIZACAO`, `ADAPTACAO`, `SAIDA`, `BAIA`), `impedimentosDeSaida` (a ocorrência com `SEM_RESPOSTA` libera), `resumoParaPublicar` (`{ intercorrencias: { kind, quantidade }[] | null }`), `aoEncerrarEstadia` e `resumoDeTarefasPorHospedagem(db, ids, agora)`. Cada parte pode vir de uma entrega diferente; registrar a mesma duas vezes é erro.
- A E7-02b registra `registrarComprovantes({ comprovantes(db, parceiroId, pacienteIds) })` com o mais recente não anulado de cada `kind` (`{ kind, apresentadoEm, validoAte }`). Sem registro, a admissão não conta comprovante de balcão (o hóspede sem prova não entra).
- O tipo `PrepararEGravarFoto` (miolo de foto) está declarado; a implementação é da E7-04b.

---

# E7-02b: admissão, autorizados, grade, lista, espera e o app

**Backend:** pronta e validada em dev em 2026-10-29 (pasta `wt/e7-02b`, commits sem push; a correção da auditoria está em **re-auditoria**): unit, integração contra o Postgres de dev e smoke por HTTP (`npx tsx scripts/smoke-hotel-reservas.ts`). **Não está em produção.** As seções 28 a 33 já descrevem o contrato depois da correção. O que mudou em relação à primeira versão está na seção 34.

Substitui, no portal: `reservaRepository.grade`, `registrarComprovante`, `dispensar` e `espera`; as regras de `domain/admissao.ts`. As rotas abaixo têm o prefixo `/parceiro/portal/hotel` (como na seção 15), menos a do app (seção 33).

## 28. Grade e lista

- `GET /parceiro/portal/hotel/grade?de=AAAA-MM-DD&ate=AAAA-MM-DD&comSelo=true|false`: até 45 dias (senão, 422 `PERIODO_INVALIDO`).
  - A resposta traz `{ de, ate, acomodacoes: [{ acomodacaoId, nome, blocoId, tipoId, ativa }], animais: [{ pacienteId, nome, especie, porte }], barras: [...], truncado, seloTruncado }`.
  - Cada barra: `{ reservaId, acomodacaoId, status, inicio, fim, comecaAntes, terminaDepois, atrasada, animais: [{ pacienteId, papel }], selo? }`. **Nome, espécie e porte vêm uma vez só em `animais`, no topo**: monte um mapa por `pacienteId`.
  - A barra já vem cortada nas bordas do intervalo; `comecaAntes` e `terminaDepois` dizem se ela continua fora dele.
  - **O selo da R1 só vem com `comSelo=true`**: custa cerca de 165 ms. Peça o selo na tela de chegadas, não no polling.
  - O selo é avaliado em no máximo 300 barras PENDENTE e CONFIRMADA, as que entram primeiro. Acima disso, `seloTruncado: true`, e as outras barras vêm sem selo: mostre "sem avaliação", nunca "ok".
  - Sem dinheiro e sem o responsável.
  - Até 1500 barras (`truncado`). Com 45 dias numa casa cheia, a resposta tem cerca de 660 KB: prefira janelas de 14 dias.
- `GET /parceiro/portal/hotel/reservas?de=&ate=&status=PENDENTE,CONFIRMADA&pacienteId=&historico=true&cursor=&limit=`:
  - **abre em "a partir de ontem"** na casa; `historico=true` tira esse piso;
  - `limit` até 50; `de` a `ate` até 366 dias;
  - o `proximoCursor` só vale para o mesmo filtro (cursor de outro filtro ou de outra casa: 400 com `errorKey` `CURSOR_INVALIDO`, o mesmo das outras listas do portal: recarregue a lista do começo);
  - cada item: `{ id, status, origem, entradaPrevista, saidaPrevista, diarias, acomodacao: { id, nome }, animais, pendenteHaHoras, motivoCancelamento }`, mais `totalCentavos`, `sinalCentavos` e `pagoCentavos` só com `hotel.valores`.

## 29. Detalhe da reserva (`GET /reservas/:id`)

O `ReservaDto` de antes, mais:
- `animais` e `acomodacao: { id, nome, blocoNome, tipoNome }`;
- `admissao`: **um bloco por animal**, `{ pacienteId, papel, liberada, selo, itens: [{ kind, bloqueia, situacao, diasDeFolga, dica, comprovante, naoConta, dispensa }] }`.
  - `situacao`: `AUSENTE`, `VENCIDO`, `VENCE_DURANTE`, `DISPENSADO`, `OK`.
  - `VENCE_DURANTE` vale hoje e vence antes da saída. **Só avisa**: `liberada` continua `true`, e quem bloqueia é o check-in (E7-04).
  - `diasDeFolga` negativo: quantos dias antes da saída vence.
  - `comprovante` é o mais recente **que conta**. `naoConta` é o mais recente quando ele não conta, e `dica` diz por quê:
    - `BALCAO_SEM_DOCUMENTO`: "visto no balcão, sem documento" numa exigência que bloqueia;
    - `DECLARADA_NAO_ACEITA`: declarada no app e a casa não aceita declarado.
    - Mostre a dica com o caminho: anexar o documento, ou pedir a dispensa à gestão.
  - Cada comprovante traz sempre `origem` (`BALCAO_COM_DOCUMENTO`, `BALCAO_SEM_DOCUMENTO`, `APP_COMPROVADA`, `APP_DECLARADA`), `temDocumento` e `registradoPorNome` (quem registrou).
  - Só para quem tem `hotel.reserva`: `referencia` (lote, número) e `documento: { url, mime, bytes }`. A `url` é assinada e dura 15 minutos: abra na hora, não guarde. O veterinário vê a situação e a origem, sem o documento. O app nunca recebe.
- `responsavel: { nome, telefone }` só com `paciente.ler`: recepção, gestor, dono e veterinário. O cuidador não vê.
- `autorizados` só com `hotel.checkout`.
- `pagamentos` (o livro: delta, total depois, motivo, quando) só com `hotel.valores`.

## 30. Comprovantes e dispensas

- **Regra do documento** (decisão do gerente): numa exigência que **bloqueia**, o comprovante do balcão só conta **com documento** (foto ou PDF). A exceção é a exigência em que a gestão ligou `aceitaDeclarada` (o campo vem com a E7-04a). Sem documento e sem `aceitaDeclarada`, só a dispensa do gestor libera. Na exigência que não bloqueia, o documento é opcional.
- `POST /reservas/:id/comprovantes/com-documento` (**multipart**): o arquivo no campo `file` e os campos `kind`, `apresentadoEm: 'AAAA-MM-DD'`, `pacienteId?`, `referencia?` (lote, número) e `observacao?`.
  - O arquivo pode ser foto JPG, PNG ou WEBP, ou PDF, até 8 MB. O tipo é lido do conteúdo, e outro tipo dá 400 `UPLOAD_TIPO_NAO_PERMITIDO`. HEIC não entra: converta antes, ou peça PDF.
  - Arquivo que não serve dá 422 **`COMPROVANTE_DOCUMENTO_INVALIDO`**, com `reason`:
    - `TAMANHO`: acima de 8 MB;
    - `PIXELS`: imagem grande demais em pixels;
    - `ILEGIVEL`: imagem corrompida.
  - A foto é guardada reduzida: JPEG com no máximo 1.600 px no maior lado, girada na posição certa e sem metadados (sem GPS). O `documento.mime` da foto volta `image/jpeg`, mesmo quando a foto foi enviada em PNG ou WEBP. O PDF é guardado como veio.
  - Anexar depois é registrar de novo: o comprovante só recebe linhas novas, e vale o mais recente que conta.
- `POST /reservas/:id/comprovantes` (JSON, sem arquivo), com `{ kind, apresentadoEm, pacienteId?, referencia?, observacao? }`: o "visto no balcão". Numa exigência que bloqueia (sem `aceitaDeclarada`), dá 422 **`COMPROVANTE_EXIGE_DOCUMENTO`**: leve a pessoa para o anexo ou para a dispensa.
- Nas duas rotas:
  - o padrão é o animal principal;
  - **a validade é calculada no servidor** (meses de calendário), e o corpo não tem `validoAte` nem `fonte`;
  - data no futuro ou com mais de 5 anos: 422 `COMPROVANTE_INVALIDO`;
  - exigência que a casa não pede para a espécie: 409 `EXIGENCIA_INEXISTENTE`;
  - o comprovante é **do animal**: vale também para as próximas estadias.
  - A resposta (`ComprovanteDto`) traz `referencia`, `origem`, `temDocumento`, `documentoMime` e `registradoPorNome`. O campo de texto que se chamava `documento` agora se chama **`referencia`**: o documento é o arquivo.
- `POST /comprovantes/:id/anular` com `{ motivo }` (10 a 300): o comprovante errado deixa de contar. Anular de novo dá 409 `COMPROVANTE_JA_ANULADO`.
- `POST /reservas/:id/dispensas`, com `{ kind, pacienteId?, motivo }`:
  - a dispensa é **por animal**: com acompanhante, dispensar a vacina de um não libera a do outro;
  - **a exigência que bloqueia só pode ser dispensada por quem tem `estabelecimento.editar`** (gestor e dono); recepção e cuidador recebem 403 `DISPENSA_NAO_PERMITIDA`, então esconda o botão para eles;
  - a exigência que não bloqueia, qualquer um com `hotel.reserva` dispensa;
  - uma vigente por animal e exigência: a segunda dá 409 `DISPENSA_JA_VIGENTE`.
- `POST /dispensas/:id/revogar` segue a mesma regra de quem pode.
- Animal que não está na reserva: 422 `ANIMAL_FORA_DA_RESERVA`.

## 31. Autorizados a retirar

- No `POST /reservas` e no `PATCH /reservas/:id`: `autorizados: [{ pessoaAutorizadaId } | { nome, telefone?, documento?, relacao? }]`, até 5 (o sexto dá 409 `AUTORIZADOS_DEMAIS`).
- `pessoaAutorizadaId` vem do cadastro do cliente (E2-01). Os dados são **copiados** para a reserva; pessoa de outro cliente dá 403.
- No `PATCH`, a lista vai inteira (`[]` tira todos) e **não muda o preço**.
- **O documento de quem retira guarda só os 4 últimos caracteres** (letras e números): o balcão pode digitar o documento inteiro, e a resposta devolve só o final (`123.456.789-01` vira `8901`). Mostre como "final 8901".
- **Reserva com dois animais não fica com dois donos.** Trocar o responsável de **um só** dos dois animais de uma reserva viva (PENDENTE, CONFIRMADA ou HOSPEDADO), pelo PATCH do paciente ou pelo mesclar com o cadastro de outro cliente, dá **409 `PACIENTE_COM_RESERVAS` com `reason: ACOMPANHANTE`** (e `quantidade`). Na tela: "Este animal divide uma reserva do hotel com outro animal do responsável atual. Tire o acompanhante da reserva, ou cancele a reserva, antes de trocar o responsável."
- **Trocar o responsável do animal** (o `clienteId` do paciente) ou mesclar com o cadastro de outro cliente **zera os autorizados das reservas vivas** do animal. A `versao` da reserva sobe: a tela aberta precisa reler. Avise na tela da troca: "as pessoas autorizadas a buscar o animal nas reservas do hotel saem".
- Na exclusão a pedido do titular, sai tudo o que veio dele: na reserva viva a linha some; na terminada fica "Removido", sem telefone nem documento. Isso vale mesmo em reserva de um animal que já mudou de dono.

## 32. Lista de espera

- `GET /espera?status=`: as vivas por entrada desejada. A oferta vencida aparece como `EXPIRADA`, calculada na leitura.
- `POST /espera`, com `{ pacienteId, entradaDesejada, saidaDesejada, tiposAceitos?, observacao? }`:
  - até 500 vivas por casa;
  - recusas: período inválido dá 422 `ESPERA_INVALIDA` (`reason` `PERIODO`); paciente inativo ou com óbito dá 409 (`reason` `PACIENTE`); passar do teto dá 409 (`reason` `LIMITE`).
- `POST /espera/:id/ofertar` `{ validadeHoras? }` (1 a 72, padrão 24): **não segura a baia**; o primeiro que reservar leva.
- `DELETE /espera/:id`: desistiu. A linha fica e repetir dá 204.
- **Para converter, crie a reserva com `esperaId`** no `POST /reservas`. A espera vira `CONVERTIDA` na mesma transação. Espera já resolvida dá 409 `ESPERA_JA_RESOLVIDA`.

## 33. App do responsável e contadores do menu

- `GET /tutor/hotel/reservas?petId=&quando=PROXIMAS|PASSADAS&cursor=&limit=` (só login):
  - Item: `{ id, petId, papel, status, entradaPrevista, saidaPrevista, diarias, hotel: { nome, telefone }, tipoDeAcomodacao, politica: { horarioDeSaida, limiteMeiaDiaria, cancelamentoSemCustoDias }, pendenteDeSinal, exigenciasPendentes: [{ kind, situacao, bloqueia }] }`.
  - `dinheiro: { orcamento, pagoCentavos, saldoCentavos, sinalReembolsavelHoje }` **só para o dono do pet**; a família vê a reserva sem valores. O `orcamento` do app tem tipo próprio (`OrcamentoDoAppDto`). As linhas trazem `tipo`, `quantidade`, `unitarioCentavos`, `totalCentavos`, `percentual?`, `temporadaNome?`, `servico?` e `porDiaria?`, sem os ids internos da casa.
  - A estadia que terminou antes do vínculo atual com o hotel não aparece: era de outro dono. Com dois pets na mesma reserva, o item mostra o pet cujo vínculo vale para ela.
  - Nunca vem o número da baia, a observação interna, os autorizados, as dispensas nem os comprovantes.
  - `petId` de outra pessoa: 403.
  - **Nenhum tipo de notificação novo**: nada muda no `rotas-notificacao.ts`.
- Contadores de `GET /parceiro/portal/pendencias`, ambos com rota `/hotel/reservas`:
  - `chegadasSemDocumentacao` (para quem tem `hotel.reserva`): reservas que chegam em até 3 dias com exigência que bloqueia ausente, vencida ou que **vence durante** a estadia (o check-in recusa). O comprovante do balcão sem documento conta como ausente. Fica `RISCO` se alguma chega hoje ou amanhã;
  - `reservasPendentesDeSinal` (para quem tem `hotel.valores`): `RISCO` se alguma entra em até 2 dias.
  - O item de pendência pode vir com **`truncado: true`**: o contador parou no teto dele (200 reservas lidas), e o número é "pelo menos". Mostre `200+`. Sem o campo, o número é exato.
- Erros novos (`codigo`):
  - 409: `EXIGENCIA_INEXISTENTE`, `COMPROVANTE_JA_ANULADO`, `DISPENSA_JA_VIGENTE`, `AUTORIZADOS_DEMAIS`, `ESPERA_JA_RESOLVIDA`;
  - 403: `DISPENSA_NAO_PERMITIDA`;
  - 422: `ANIMAL_FORA_DA_RESERVA`, `COMPROVANTE_INVALIDO` (só a data: `reason` `FUTURO` ou `ANTIGO`), `COMPROVANTE_DOCUMENTO_INVALIDO` (o arquivo: `reason` `TAMANHO`, `PIXELS` ou `ILEGIVEL`), `COMPROVANTE_EXIGE_DOCUMENTO` (`kind`: "Para esta exigência, anexe a foto ou o PDF do comprovante. Sem documento, só a gestão pode dispensar.");
  - `ESPERA_INVALIDA` (409 ou 422, com `reason`).
  - 400 `UPLOAD_TIPO_NAO_PERMITIDO` (`errorKey`, de upload) no anexo de tipo que não é imagem nem PDF.

### Para quem consome pela API (E7-04a, E7-06)

- **Ligações com a E7-04a: feitas em 29/10 pela 02b, que chegou depois ao develop** (`src/hotel/reservas/ligacoes-com-a-estadia.ts`, `LigacoesComAEstadia`, no `onModuleInit`).
  - **Comprovantes do balcão no check-in.** `comprovantesDoBalcaoPorAnimal` é o `ProvedorDeComprovantes` do `GanchosDaEstadia`. Por animal e por `kind`, devolve o mais recente com documento e o mais recente sem documento, cada um com `temDocumento`. A R1 do check-in (`avaliarAnimal`) passa cada um pelo `comprovanteConta` da 02b, a mesma regra da admissão da reserva, e marca `balcaoSemDocumento`.
  - **`aceitaDeclarada`.** Lido da coluna nos dois `select` da 02b. Na R1 da 02b, o campo passou a ser obrigatório.
  - **O `editar` avisa a rotina.** Com `SAIDA` ou `BAIA`, depois do commit, as hospedagens HOSPEDADO da reserva são travadas em ordem de id (`travarHospedagensDaReserva`, o molde do serviço acrescentado). Cada uma recebe `aoMudarARotina` com o motivo. Sem rotina registrada, nada acontece. A E7-05 só registra a rotina no `GanchosDaEstadia`. A falha vira log (`ROTINA_DA_RESERVA_ADIADA`) e não desfaz a edição.
- **Reconciliação da rotina no `editar` (ALTO da auditoria da E7-05a).** A reserva HOSPEDADO que muda a saída, a baia ou os serviços chama `pedirReconciliacao(tx, parceiroId, { reservaId })` dentro da transação do PATCH. O ponto de encaixe é `GanchosDaReserva.registrarReconciliacao(fn)`, que a E7-05a registra no `onModuleInit`. Sem a E7-05a, nada acontece. A falha da marca desfaz a edição.
- **Redução da foto a 1.600 px.** Já ligada. `reduzirDocumentoDoComprovante` chama o `reduzirFoto` da E5-03b (`src/upload/reduzir-imagem.ts`).
- `ExigenciasDaReservaService.avaliar(db, parceiroId, reservas, fuso, hoje)` devolve a admissão por animal em lote (uma ida por tabela), para o resumo do hotel.

## 34. Correção da auditoria da E7-02b (2026-10-29): o que mudou para o front

- Comprovante: o texto `documento` virou **`referencia`**. O documento agora é o arquivo, pela rota nova `POST /reservas/:id/comprovantes/com-documento` (multipart). A foto é guardada reduzida e sem GPS, e o arquivo que não serve dá 422 `COMPROVANTE_DOCUMENTO_INVALIDO`. Numa exigência que bloqueia, o "visto no balcão" sem arquivo dá 422 `COMPROVANTE_EXIGE_DOCUMENTO` (seção 30).
- Admissão: cada item ganhou `dica` e `naoConta`; cada comprovante ganhou `origem`, `temDocumento`, `registradoPorNome` e, para `hotel.reserva`, `documento: { url, mime, bytes }` (seção 29).
- Grade: os animais vêm uma vez em `animais`; a barra traz só `{ pacienteId, papel }`; `seloTruncado` (seção 28).
- Autorizados: o documento volta só com os 4 últimos caracteres. A troca de responsável e o mesclar entre clientes zeram a lista das reservas vivas (seção 31).
- App: o orçamento tem tipo próprio, sem ids internos (seção 33).
- Pendências: `truncado` no item, e `chegadasSemDocumentacao` passa a contar o que vence durante a estadia (seção 33).

### 27.1 Correção da auditoria da E7-04a (2026-10-29)

O que muda para o front:
- **Veterinário do pet:** `GET /reservas/:id/veterinarios` devolve `id` (opaco, amarrado a este hotel e a este animal) no lugar de `parceiroId`. No check-in, o campo do corpo passou a se chamar **`veterinarioId`** e leva esse `id`. O `parceiroId` de outra clínica não sai mais.
- **Veterinário do pet, resposta em objeto (re-auditoria, antes do push):** a rota responde **`{ leituraDoApp, clinicas }`**, não mais uma lista solta. `leituraDoApp` é `LIDA` (o app foi consultado; `clinicas` pode vir vazia, sem vínculo ou sem outra clínica) ou `NAO_LIDA` (a reserva não aguarda entrada: hospedada, encerrada, cancelada ou não compareceu; `clinicas` vem vazia e nada é lido). É a mesma regra da admissão. Na tela do check-in, a lista vem de `clinicas`. Animal que não é da reserva continua 400 `ANIMAIS_DIFERENTES_DA_RESERVA`; reserva de outra casa, 403.
- **Admissão:** `leituraDoApp` ganhou o valor **`NAO_LIDA`**: a reserva não está aguardando entrada (hospedada, encerrada, cancelada ou não compareceu), e o app não é lido. Só reserva PENDENTE ou CONFIRMADA lê a carteirinha.
- **Medicação e cuidado sem `inicio`:** começam hoje na casa (antes começavam no dia da entrada).
- **Detalhe da estadia:** as medicações e os cuidados ativos vêm primeiro; o teto de 30 vale por animal.
- **Cadastro:** mesclar paciente hospedado dá **409 `PACIENTE_HOSPEDADO`** (já era o caso do óbito, do inativar e da exclusão). A estadia encerrada segue o paciente que fica no mesclar. A exclusão a pedido do titular com estadia vira anonimização: a estadia fica, sem o contato de emergência, o veterinário escrito à mão, a observação interna e os dados de quem retirou.

# E7-03b: caixa do balcão, aceite, recusa, avisos e cancelar pelo app

Spec: `docs/specs/2026/q4/q4-1/portal-parceiro/e7-hotel/03-reserva-online.md` (decisões do gerente de 29/10, inclusive a 13 e a 22). Fecha o ciclo da 03a: o hotel vê os pedidos, aceita (nasce a reserva PENDENTE, à espera do sinal) ou recusa, e o responsável é avisado. Tudo atrás do módulo HOTEL e de `ativo=false` na configuração.

## 35. Portal: a caixa (`/parceiro/portal/hotel/pedidos`)

| Rota | Permissão | O que faz |
|---|---|---|
| `GET /?status=&cursor=&limit=` | `hotel.reserva` | `status`: `PENDENTES` (padrão, do mais antigo), `ACEITOS`, `RECUSADOS`, `ENCERRADOS` (desistiu ou expirou), estes do mais recente. `limit` até 50; `proximoCursor` opaco, só vale no mesmo filtro e na mesma casa (senão 400 `CURSOR_INVALIDO`) |
| `GET /:id` | `hotel.reserva` | O detalhe: observação, contato do visitante, `porteDivergente`, a vaga do tipo agora (`vaga.livres`), os outros pendentes nas mesmas noites, a idade da conta de quem pediu (só com `paciente.ler`), a recusa e os avisos enviados |
| `GET /:id/sugestoes?limite=` | `hotel.reserva` | Até 10 acomodações livres que servem: o tipo pedido primeiro, a menor folga de porte, o nome. Sem vaga e com `aceitaMudarUmDia`, vêm as de um dia antes ou depois (`mudouAData: -1` ou `1`). `totalCentavos` só com `hotel.valores` |
| `GET /:id/noites?de=&ate=` | `hotel.reserva` | O calendário do tipo pedido, noite a noite (até 31; padrão: de 3 dias antes da entrada, 14 noites). `livres` conta só as reservas: pedido nenhum tira vaga (decisão 23). Serve para oferecer outra data na mensagem da recusa. Pedido sem tipo: 400 `PEDIDO_INVALIDO` `reason: SEM_TIPO` |
| `GET /:id/estimativa?acomodacaoId=&entradaData=&saidaData=` | `hotel.valores` | O orçamento que o aceite gravaria, sem gravar, e `servicosRemovidos` |
| `POST /:id/aceitar` (com `Idempotency-Key`) | `hotel.reserva` | `{ acomodacaoId, entradaData?, saidaData?, copiarObservacao? }`. Cria a reserva PENDENTE (orçamento do servidor), o cadastro na primeira vez e, pelo app, o vínculo. Repetir com a mesma chave devolve a mesma resposta |
| `POST /:id/recusar` | `hotel.reserva` | `{ motivo: SEM_VAGA, EXIGENCIAS, PERFIL ou OUTRO, mensagem? }`. `mensagem` até 500, obrigatória em `OUTRO` (400 `PEDIDO_INVALIDO` `reason: MENSAGEM_OBRIGATORIA`). Devolve o detalhe |

**Item da caixa:**
- `id`, `status`, `canal` (`APP` ou `LINK`), `modo`.
- `tipo`: `{ id, nome }`. O `id` vem nulo quando o tipo foi apagado; o `nome` é o gravado no pedido.
- `animais[]`: `nome`, `especie`, `porteDeclarado`, `pacienteId`.
- `ocupantes`, `porteMaior`, `entrada`, `saida`, `diarias`, `aceitaMudarUmDia`, `servicos`, `criadoEm`, `responderAte`.
- `prazo`: `NO_PRAZO`, `VENCENDO` (últimos 30 min) ou `ATRASADO`.
- `quemPede` (só com `paciente.ler`), `temObservacao`, `reservaId`.
- **Saíram `garantiaAte` e `vagaGarantida`** (decisão 23 da spec 03): o pedido não segura vaga, e a caixa mostra os pendentes em ordem de chegada, como informação, sem promessa. Se a tela já usava esses campos, tire.

**Detalhe** (o item, mais):
- `observacao`, `telefone`, `email`: os três só com `paciente.ler`.
- `porteDivergente`.
- `vaga`: `{ tipoId, livres }`, só no pendente de tipo escolhido. `livres` conta só as reservas.
- **Novo: `pedidosPendentesNasMesmasNoites`** (número ou `null`), para todo `hotel.reserva`: quantos **outros** pedidos pendentes do mesmo tipo cruzam estas noites. Só informação: nenhum deles tira vaga, e quem o balcão aceitar primeiro leva a unidade. Vem `null` fora do pendente de tipo escolhido.
- **Novo: `contaCriadaHaDias`** (número ou `null`), **só com `paciente.ler`** (ausente sem ela, como o contato): há quantos dias existe a conta de quem pediu pelo app, para o balcão enxergar conta recém-criada (0 = criada hoje). Vem `null` no pedido do link, que não tem conta. Nunca vai ao app nem ao site.
- `recusa`: `{ motivo, mensagem }`; `mensagem` vem nula sem `paciente.ler`.
- `respondidoEm`.
- `avisos[]`: `tipo`, `canal`, `situacao`, `criadoEm`.

**Quem vê o quê:**
- Cuidador, banhista e adestrador abrem a caixa e respondem. Não veem nome, telefone, e-mail e observação do visitante, nem a idade da conta (`contaCriadaHaDias`), nem dinheiro: os campos vêm **ausentes** (não vazios), e a resposta do aceite vem sem `totalCentavos` e `sinalCentavos`. Veem `pedidosPendentesNasMesmasNoites`.
- Recepção, gestor e dono veem tudo.
- Veterinário, enfermagem e financeiro não abrem a caixa (403).
- Módulo suspenso: lê, não responde.

### O que a tela precisa mostrar

- **Sem garantia (decisão 23 da spec 03).** O pedido não segura vaga: a vaga só fica garantida no aceite. O aceite reconfere sob a trava e pode dar **409 `SEM_VAGA_NO_ACEITE`** quando a unidade já foi vendida pelo balcão ou aceita para outro pedido. Nesse caso, ofereça outra acomodação pelas sugestões (`GET /pedidos/:id/sugestoes`), outra data pelas noites (`GET /pedidos/:id/noites`) ou a recusa com mensagem. Nenhuma copy da tela diz "vaga reservada" ou "garantida" para pedido; o aceite é o momento em que a vaga fica garantida.
- **`pedidosPendentesNasMesmasNoites` e `contaCriadaHaDias`** ajudam o balcão a decidir, sem promessa: mostre "outros N pedidos para estas noites" e, para quem tem `paciente.ler`, "conta criada há N dias" (0: "conta criada hoje").
- **Aceite:**
  - `aviso` diz o que o responsável vai receber: `RESERVA_PEDIDO_ACEITO`, ou `RESERVA_PEDIDO_ALOCADO` quando o hotel escolheu, mudou o tipo ou andou um dia.
  - A data só muda **-1 ou +1 nas duas pontas**, e só com `aceitaMudarUmDia` (senão 400 `PEDIDO_INVALIDO` `reason: DATA_FORA_DO_PEDIDO`). Para outra data, recuse com mensagem.
  - A reserva nasce **PENDENTE** e segue o fluxo da E7-02: o balcão registra o sinal e confirma.
- **`porteDivergente: true`:** a ficha do hotel tem outro porte que o declarado pelo responsável. O preço e a vaga usam o da ficha; avise antes de aceitar.
- **`servicosRemovidos`:** serviços que a pessoa pediu e o hotel desativou. Saem da reserva; avise.
- **`copiarObservacao`:** a observação do responsável é interna e só vai para a reserva se a tela marcar. **Exige `paciente.ler`** (correção da auditoria da 03b): sem ela, 403 `SEM_PERMISSAO` com `permissao: paciente.ler`. Para o cuidador, esconda a opção. Copiada por quem pode, vira nota da reserva.
- **Recusa:** o texto vai para a página do token e para o e-mail do visitante, **nunca** para o push. Escreva no idioma do hotel (o servidor anota o idioma).

## 36. App do responsável (`/tutor/hotel`)

- `GET /pedidos/:id` e a lista ganharam:
  - `tipo`: `{ id, nome, icone }`, com o `nome` gravado no pedido. Se o hotel apagou o tipo depois, vêm `id` e `icone` nulos e o nome fica.
  - `reserva`, só no ACEITO: `{ status, entrada, saida, diarias, podeCancelar, totalCentavos?, sinalCentavos? }`. O dinheiro só vem com `mostrarValores` do hotel e nunca para a família.
- **Novo: `POST /pedidos/:id/cancelar-reserva`** (decisão 13).
  - Só o dono, só com a reserva `PENDENTE` e **nada pago**. Cancela com o motivo `RESPONSAVEL_DESISTIU` e devolve o pedido com `reserva.status: CANCELADA`. Repetir devolve o mesmo resultado.
  - Mostre o botão só com `reserva.podeCancelar`.
  - **409 `RESERVA_SO_PELO_HOTEL`**: `reason: PAGAMENTO` (já tem pagamento) ou `STATUS` (já confirmada ou em outro estado), com `contato: { telefone, whatsapp }`. Leve a pessoa a falar com o hotel.
  - 409 `PEDIDO_JA_RESPONDIDO` quando o pedido não foi aceito.
  - 403 `SOMENTE_LEITURA` para a família.
- **Pushes** (os 6 tipos da seção 26). Agora saem de verdade:
  - `RESERVA_PEDIDO_ACEITO`, `RESERVA_PEDIDO_ALOCADO` e `RESERVA_PEDIDO_RECUSADO` vão para o dono que pediu, com `{ pedidoId }`.
  - `RESERVA_CANCELADA_PELO_HOTEL` vai para o dono atual com vínculo quando o hotel cancela por indisponibilidade. O `dados` leva `ref` (um texto opaco: não use, não mostre, não mande de volta) e, quando a reserva nasceu de um pedido do app do mesmo dono, `pedidoId`. **Não leva `reservaId`** (correção da auditoria da 03b). Com `pedidoId`, o toque pode abrir o pedido; sem ele, a lista de avisos.
  - `RESERVA_BAIA_MUDOU` vai para o dono atual quando o hotel muda o pet de baia durante a estadia (E7-04b), depois da mudança e sem o motivo nem o nome da baia. O `dados` é o mesmo do cancelado pelo hotel: `ref` e, quando a reserva nasceu de pedido do app do mesmo dono, `pedidoId`.
  - Só recebe o dono cujo vínculo com o hotel é anterior à reserva (ou o que pediu pelo app). Quem ficou com o pet depois não recebe notícia da reserva do dono anterior.
  - O push desses 5 tipos é conferido de novo na hora de sair, inclusive o adiado da madrugada: se o animal morreu, se o pet mudou de dono ou se a conta está em exclusão, o celular não toca (a notificação fica na lista).
  - Nenhum leva texto do hotel nem id do parceiro. A rota segue `/screens/notifications` no `rotas-notificacao.ts`.
- O texto da tela de pedir continua o da seção 23: no aceite pelo app nasce o **vínculo** (origem `RESERVA_HOTEL`), e o estabelecimento passa a acompanhar o pet.

## 37. Site (página do token e e-mail)

- A página `/reserva/<token>` mostra:
  - o `tipo` com o nome gravado;
  - a `reserva`, quando ACEITO (sem dinheiro com `mostrarValores` desligado);
  - a recusa, com o motivo e o texto do hotel.
- **E-mail ao visitante**, só para quem deixou o endereço (que não é verificado):
  - a confirmação com o link, logo depois do pedido. Ela diz que o pedido **está sujeito à confirmação do hotel** (decisão 23), nos 6 idiomas;
  - a resposta do hotel: aceito, alocado ou recusado, com o texto da recusa.
  - Sai no idioma do pedido, no máximo 5 por endereço por dia, e não muda nada na tela.
- **Retenção:** 90 dias depois do fim do pedido, saem o nome, o telefone, o e-mail, a observação e o texto da recusa, e o link passa a dar o 404 `PEDIDO_NAO_ENCONTRADO`. O fim é a resposta, a desistência ou a entrada; no aceito, a saída da estadia. Mostre "este link não está mais disponível".

## 38. Apagar tipo que teve pedido (decisão 22)

`DELETE /parceiro/portal/hotel/tipos/:id` (E7-01) responde 409 `TIPO_EM_USO` com **`motivo`** e `quantidade`:
- `ACOMODACOES`: tem acomodação ligada (como antes);
- `PEDIDOS_PENDENTES`: tem pedido de reserva aguardando resposta. Use o `message` ("Responda os pedidos antes de apagar") e leve à caixa.

Com só pedidos terminados, o tipo sai. Os pedidos ficam com o nome gravado (`tipo.id` nulo), e o id sai da configuração da reserva online.

## 39. Erros novos e reaproveitados (decidir a tela pelo `codigo`)

| Código | Status | Quando | Campos |
|---|---|---|---|
| `SEM_VAGA_NO_ACEITE` | 409 | No aceite, a vaga reconferida sob a trava acabou: o balcão vendeu antes (reserva direta), outro pedido foi aceito para a unidade, ou o destino é outro tipo ou outra data sem vaga. Nenhum pedido pendente causa este erro (decisão 23) | `tipoId` |
| `RESERVA_SO_PELO_HOTEL` | 409 | Cancelar pelo app a reserva com pagamento ou já confirmada | `reason` (`PAGAMENTO`, `STATUS`), `contato` |
| `TIPO_EM_USO` | 409 | Apagar o tipo (seção 38) | `motivo`, `quantidade` |
| `HOTEL_PEDIDO_TAXA_EXCEDIDA` | 429 | No balcão, 600 leituras e 600 respostas por pessoa por hora | `limite`, `tenteDeNovoEmSegundos` |

Reaproveitados no balcão:
- `PEDIDO_JA_RESPONDIDO` (409, com `status`). O `DESISTIU` aparece quando, sob a trava do aceite, o pet mudou de dono ou foi apagado, o dono bloqueou o hotel, entrou em exclusão ou encerrou o vínculo. Nada nasce.
- `PEDIDO_INVALIDO` (`reason`: `DATA_FORA_DO_PEDIDO`, `MENSAGEM_OBRIGATORIA`, `SEM_TIPO`).
- `CURSOR_INVALIDO`, `PERIODO_INVALIDO`.
- Os da E7-02 que o aceite herda: `ACOMODACAO_OCUPADA_NO_PERIODO`, `ACOMODACAO_INATIVA`, `ACOMODACAO_INCOMPATIVEL`, `PET_JA_HOSPEDADO_NO_PERIODO`, `PACIENTE_INATIVO`, `PACIENTE_COM_OBITO`, `SERVICO_INATIVO`, `VINCULO_JA_ATIVO`, `PET_INATIVO`.
- `OWNERSHIP_FORBIDDEN` (403): pedido ou acomodação de outra casa, ou inexistente, com o mesmo corpo.

## 40. Contadores do menu (E1-06)

| Chave | Permissão | Rota | O que conta |
|---|---|---|---|
| `pedidosDeReserva` | `hotel.valores` | `/hotel/pedidos` | Pedidos PENDENTES cuja entrada não chegou. Tom `ATENCAO`; `RISCO` quando algum passou do `responderAte` |
| `reservasCanceladasPeloApp` | `hotel.valores` | `/hotel/reservas` | Reservas que o próprio responsável cancelou pelo app nas últimas 48 h (a baia ficou livre). É o aviso da decisão 13, sem push |

O cuidador não vê os dois (não vende).

## 41. Saída do hotel: check-out, peso, pertences, mudar de baia e fotos (E7-04b, 2026-10-29)

Spec: `docs/specs/2026/q4/q4-1/portal-parceiro/e7-hotel/04-check-in-estadia-e-check-out.md` (decisões do gerente de 29/10). Tudo sob `/parceiro/portal/hotel`, módulo HOTEL (SUSPENSO: leitura passa, escrita 403). **O check-out é da RESERVA** (os dois animais de uma vez), não da hospedagem.

### Quem faz o quê

| Ação | Permissão | Quem tem |
|---|---|---|
| Conferir pertence, pesar, check-out | `hotel.checkout` | dono, gestor, recepção, cuidador, banhista, adestrador |
| Registrar pagamento no check-out (`pagoCentavos`) | `hotel.valores` | dono, gestor, recepção (o cuidador manda sem o campo) |
| Saída informada (`saidaInformada`, "esqueci de dar saída") | `estabelecimento.editar` | dono, gestor |
| Mudar de baia | `hotel.rotina` | os mesmos do check-out; a cortesia de tarifa (`manterOrcamento`) pede `hotel.valores` |
| Enviar e apagar foto | `hotel.checkin` | idem |
| Ver foto (URL assinada) | `hotel.ler` | idem, mais o veterinário |
| Anular a estadia publicada no app | `estabelecimento.editar` | dono, gestor |

Sem a permissão do campo, a resposta é 403 `SEM_PERMISSAO` com `permissao`. O dinheiro do encerramento (`financeiro`) **não existe** na resposta sem `hotel.valores` (a chave some, não vem zerada). Quem retirou o animal (`retirada`) só aparece com `hotel.checkout`.

### Rotas

| Método e rota | O que faz |
|---|---|
| `POST /hospedagens/:id/pertences/:pertenceId/conferir` | `{ devolvido, observacao? }`. Não devolvido exige observação de 5 a 200 caracteres. Conferir de novo substitui. 200 com `HospedagemDto` |
| `POST /hospedagens/:id/pesar-na-saida` | `{ pesoKg }` (0,05 a 250, 2 casas) **ou** `{ semPesoMotivo }` (10 a 300: balança quebrada, animal que não deixa pesar). Variação maior que 30% da entrada dá 409 `PESO_FORA_DO_ESPERADO` com `pesoEntradaKg`, `pesoSaidaKg` e `variacaoDecimos`: mostre os dois números e reenvie com `confirmarPesoFora: true`. Repetir substitui até o check-out. 200 com `HospedagemDto` |
| `POST /reservas/:id/check-out` | Corpo abaixo. Aceita `Idempotency-Key`. 200 com `EstadiaDaReservaDto` (`status: ENCERRADA`, `encerramento`, e `financeiro` só com `hotel.valores`). Repetir **igual** (sem `pagoCentavos`, ou com o mesmo já registrado, e sem `saidaInformada`) devolve a mesma estadia, sem publicar de novo. Repetir com **outro** `pagoCentavos` ou com `saidaInformada` dá 409 `RESERVA_NAO_EDITAVEL` (`reason: STATUS`, `status: ENCERRADA`): a reserva encerrada não muda pelo check-out (correção da auditoria, 29/10) |
| `POST /reservas/:id/mudar-de-baia` | `{ acomodacaoId, motivo (5 a 200), versao, manterOrcamento? }` com a **versão da reserva**. 200 com `{ reservaId, acomodacaoId, acomodacaoNome, versao, mudou, manteveOrcamento }`. Para a mesma baia: `mudou: false`, nada grava |
| `POST /reservas/:id/anular-estadia-publicada` | `{ motivo (10 a 300) }`. Tira do app a estadia e o peso de cada animal. 200 com `{ reservaId, anuladas }` |
| `POST /hospedagens/:id/fotos` | Multipart: `file`, `momento` (`ENTRADA`, `ESTADIA`, `SAIDA`) e `legenda?` (até 120). JPEG, PNG ou WebP até 8 MB. A foto volta regravada em JPEG de até 1.600 px, sem EXIF nem GPS. Até 6 por momento. 201 com `{ id, momento, legenda, largura, altura, registradaEm }` |
| `GET /hospedagens/:id/fotos/:fotoId/url` | `{ url, expiraEm }`: URL assinada de 5 minutos. Peça de novo ao abrir a foto; não guarde a URL |
| `DELETE /hospedagens/:id/fotos/:fotoId` | 204. Só com a estadia em curso |

### O corpo do check-out

```json
{
  "versao": 7,
  "retirada": { "peloResponsavel": true, "documentoTipo": "RG", "documentoFinal": "4821" },
  "pagoCentavos": 35000,
  "saidaInformada": { "em": "2026-11-03T18:40:00-03:00", "motivo": "Esqueci de registrar na hora" }
}
```

- `retirada`: **exatamente um** de `{ peloResponsavel: true, documentoTipo, documentoFinal }`, `{ autorizadoId }` (um autorizado **desta** reserva, a lista da seção 31) ou `{ nome, documentoTipo, documentoFinal }` para quem não está na lista. `documentoTipo` é `RG`, `CPF`, `CNH` ou `OUTRO`; o `documentoFinal` são **só os últimos 4** letras ou números. **O responsável também mostra o documento** (decisão do gerente na auditoria de 29/10: o balcão confere quem leva o animal, seja quem for); sem o tipo ou o final, 400 da validação. O autorizado da lista **não** manda documento (o documento já está na lista): mandar dá 422 `RETIRADA_INVALIDA` com `reason: DOCUMENTO_DO_AUTORIZADO`. Fora da lista é marcado pelo servidor (`retirada.foraDaLista`); não mande `retiradoForaDaLista`: 400.
- `pagoCentavos?`: o **total pago acumulado** (não o valor de agora). Nunca menor que o já registrado (400 `PAGAMENTO_ABAIXO_DO_PAGO`). O saldo **não trava** a saída.
- `saidaInformada?`: só quando a saída já aconteceu e não foi registrada. Entre a entrada e agora, até 72 h para trás, com o offset no ISO.
- Não mande `saidaEm`, `entreguePorId`, `status` nem total: 400. O instante é do servidor.

### Regras que a tela precisa mostrar

- **R4 no servidor**: 409 `SAIDA_BLOQUEADA` com `impedimentos: [{ kind, hospedagemId, ids }]`. `PERTENCE` (os ids dos pertences não conferidos, ou não devolvidos sem a observação), `PESO_DE_SAIDA` (sem peso e sem o motivo) e `OCORRENCIA_SEM_CONTATO` (ocorrência grave sem contato com o responsável, da rotina da E7-05). Leve a tela até o item. Nada é gravado.
- Cada pertence agora traz `pendente` (verdadeiro trava a saída).
- **Reserva com dois animais de clientes diferentes**: a exclusão a pedido do titular de um deles pode fechar antes a estadia só daquele animal (`encerradaPelaExclusao`). O check-out da reserva fecha só a estadia que continua hospedada; a tela lista as duas e trava só a que falta.
- **Orçamento final** (com `hotel.valores`, em `financeiro`): os preços são os da venda; só mudam as quantidades. Saída depois do dia previsto soma as diárias. No dia previsto, a saída tardia é pela hora real (ex.: 16:30 com saída 12:00 e limite 18:00 = meia diária; depois do limite, diária inteira). **Saída antecipada não devolve noites**: `encerramento.noitesNaoUsadas` mostra quantas sobraram, e o desconto é decisão do balcão. `financeiro` traz `linhas`, `totalVendidoCentavos`, `totalFinalCentavos`, `diferencaCentavos`, `sinalCentavos`, `saidaTardiaPercentual`, `pagoCentavos` e `saldoCentavos` (negativo = crédito).
- `GET /reservas/:id` ganhou `encerradaEm`, `diariasFinais` e, com `hotel.valores`, `orcamentoFinal` e `totalFinalCentavos`. O `saldoCentavos` passa a ser contra o total final depois do check-out. O `orcamento` e o `totalCentavos` continuam sendo os da venda.
- A estadia (`HospedagemDto`) ganhou: `pesoSaidaKg`, `pesoSaidaConfirmadoFora`, `semPesoMotivo`, `variacaoDePesoDecimos` (-52 = -5,2%), `perdaRelevante` (perda de 5% ou mais: destaque), `entreguePorNome`, `encerradaPelaExclusao` (verdadeiro quando a estadia foi fechada pela exclusão a pedido do titular com o Hotel só para consulta: ninguém entregou no balcão, `entreguePorNome` vem nulo e não há check-out; mostre "Encerrada pela exclusão do cadastro"), `retirada` (com `hotel.checkout`: `forma` RESPONSAVEL, AUTORIZADO ou FORA_DA_LISTA, `foraDaLista`, `nome`, `documentoTipo`, `documentoFinal`), `saidaInformada` (`{ motivo, registradaEm }` ou nulo) e `fotos` (sem caminho).
- **Mudar de baia**: a reserva guarda uma baia só, e a grade mostra a nova para a estadia inteira. O histórico fica no servidor (não há rota de leitura do histórico nesta entrega). Baia de outra tarifa: 409 `BAIA_DE_OUTRA_TARIFA`; quem tem `hotel.valores` pode mandar `manterOrcamento: true` (cortesia: o orçamento não muda). O orçamento **nunca** é recalculado ao mudar de baia.
- Foto da estadia encerrada é só leitura (enviar e apagar dão 409 `HOSPEDAGEM_ENCERRADA`).
- **A estadia encerrada fica congelada no banco**: peso de saída, quem retirou e a hora da saída não mudam depois do check-out (só a anonimização a pedido do titular apaga o nome, o documento e os motivos). Não há rota para corrigir a saída depois do check-out: a tela de check-out confirma peso e quem retira antes de enviar.
- **O total final nunca fica abaixo do vendido** (CHECK no banco). O desconto da saída antecipada é decisão do balcão, fora do orçamento.
- O nome publicado no app é o nome público do hotel; nenhum nome de pessoa da equipe vai ao app.

### Erros novos (decidir a tela pelo `codigo`)

| Código | Status | Extra |
|---|---|---|
| `SAIDA_BLOQUEADA` | 409 | `impedimentos: [{ kind, hospedagemId, ids }]` |
| `PESO_FORA_DO_ESPERADO` | 409 | `pesoEntradaKg`, `pesoSaidaKg`, `variacaoDecimos` |
| `PESO_DE_SAIDA_INVALIDO` | 422 | `reason`: `NENHUM`, `DOIS`, `CONFIRMACAO_SEM_PESO` |
| `PERTENCE_SEM_OBSERVACAO` | 422 | `min` |
| `RETIRADA_INVALIDA` | 422 | `reason`: `FORMA`, `DOCUMENTO_OBRIGATORIO`, `DOCUMENTO_DO_AUTORIZADO` |
| `SAIDA_INFORMADA_INVALIDA` | 422 | `reason`: `NO_FUTURO`, `ANTES_DA_ENTRADA`, `MAIS_DE_72_HORAS` (`maxHoras`) |
| `PAGAMENTO_ABAIXO_DO_PAGO` | 400 | `pagoCentavos` (o já registrado) |
| `BAIA_DE_OUTRA_TARIFA` | 409 | |
| `FOTOS_NO_LIMITE` | 409 | `momento`, `limite` |
| `FOTO_DA_ESTADIA_INVALIDA` | 400 | `reason`: `TIPO`, `TAMANHO`, `PIXELS`, `ILEGIVEL`, `LEGENDA` |
| `ESTADIA_SEM_PUBLICACAO` | 409 | |

Reaproveitados: `RESERVA_NAO_EDITAVEL` (`reason: STATUS`, reserva que não está hospedada, ou o check-out repetido com outro pagamento ou com saída informada), `RESERVA_ALTERADA` (`versaoAtual`), `HOSPEDAGEM_ENCERRADA`, `ORCAMENTO_ACIMA_DO_LIMITE`, `ACOMODACAO_OCUPADA_NO_PERIODO`, `ACOMODACAO_INCOMPATIVEL`, `ACOMODACAO_INATIVA`, `SEM_PERMISSAO` (`permissao`), `OWNERSHIP_FORBIDDEN`, `UPLOAD_PROCESSAMENTO_OCUPADO` (503, tente de novo), `HOTEL_ESTADIA_TAXA_EXCEDIDA` (o envio de foto tem um balde próprio de 60 por pessoa por hora).

### Contador do menu (E1-06)

| Chave | Permissão | Rota | O que conta |
|---|---|---|---|
| `hospedesAtrasados` | `hotel.checkout` | `/hotel/hospedes` | Hóspedes que passaram da saída prevista mais a higienização e continuam na casa (a baia pode ser vendida em cima). Tom `RISCO` |

O veterinário não vê. O texto do selo é do catálogo do portal (chave `hospedesAtrasados`).

### App do responsável e notificações

- O check-out com vínculo ativo do dono atual (conta viva) publica no app, na linha do tempo do pet: um **serviço realizado de hospedagem** (datas de entrada e saída, o resumo da alimentação sem a marca da ração, as ocorrências leves contadas a partir da ativação do vínculo atual e o nome público do hotel, sem nome de pessoa) e o **peso de saída**. O app já mostra os dois tipos; não há tela nova. Dono antigo, conta em exclusão e visitante sem vínculo não recebem nada, e o check-out fecha do mesmo jeito.
- **Nenhum tipo de notificação novo** nesta entrega: a publicação da estadia não dispara push (o boletim de saída é da E7-05). Anular usa o `CLINICA_ANULOU_REGISTRO`, que já existe, e só avisa o dono do vínculo que vale (o dono atual do pet, com a conta viva); se o pet mudou de dono, a cópia sai sem aviso a ninguém. O aviso da mudança de baia é o `RESERVA_BAIA_MUDOU` da E7-03 (o tipo, o texto e a rota do toque vêm com ela, seção 26); ele só sai depois que a E7-03b registrar o gancho (abaixo).

### Para quem consome pela API (E7-02b, E7-03b, E7-05, E7-06b)

- **E7-02b (ligado na correção de 29/10)**: o `LigacoesComAEstadia` registra `registrarAutorizados` com `autorizadoDaReservaNoCheckout`: `{ id, nome }` do `AutorizadoNaReserva` desta reserva desta casa, menos o que a exclusão a pedido do titular trocou por "Removido". O `autorizadoId` da retirada é o `id` da lista da seção 31; de outra reserva, removido ou inexistente: 403 `OWNERSHIP_FORBIDDEN`. A troca de responsável zera a lista da reserva viva e sobe a `versao`: a tela aberta recebe 409 `RESERVA_ALTERADA` e relê. A exclusão de quem forneceu a lista também apaga a cópia do nome na estadia já retirada (fica "Removido", com a forma AUTORIZADO).
- **E7-05a**: a mudança de baia chama `GanchosDaReserva.pedirReconciliacaoNaTransacao` na transação dela (o mesmo ponto do `editar`); a E7-05a registra o provedor.
- **E7-03b**: registrar `ganchos.registrarAvisoDeBaia(e => avisos.avisarResponsavelDaReserva(e.reservaId, 'RESERVA_BAIA_MUDOU'))`, chamado depois do commit da mudança de baia.
- **E7-05**: `FotosDaEstadiaService.prepararEGravar()` é o miolo da foto (exportado pelo `HotelModule`): devolve `{ caminho, bucket, mimetype, tamanho, largura, altura, apagar() }`; quem chama grava a linha e chama `apagar()` se a linha falhar. O check-out chama `impedimentosDeSaida`, `resumoParaPublicar(tx, hospedagemId, desde)` (o `desde` é a ativação do vínculo atual ou a entrada, a mais tarde: conte as ocorrências só a partir dele) e `aoEncerrarEstadia` (com `saidaEm`, que pode ser a saída informada, `variacaoDePeso` e `perdaRelevante`) na transação dele; a mudança de baia chama `aoMudarARotina` com `BAIA`.
- **E7-06b**: `ReservaDeHotel.orcamentoFinal` (mesmo formato do `orcamento`, CHECK nas linhas), `totalFinalCentavos`, `diariasFinais` e `encerradaEm` (a saída real) nascem juntos no check-out e congelam com a reserva ENCERRADA. **Já ligado** nesta entrega (correção de 29/10, depois do rebase sobre a E7-06b): `colunas-do-encerramento.ts` tem `ENCERRAMENTO_REAL = true` e usa `COALESCE(r."totalFinalCentavos", r."totalCentavos")`, `COALESCE(r."orcamentoFinal", r."orcamento")`, `COALESCE(r."encerradaEm", r."saidaPrevista")` e `COALESCE(r."diariasFinais", r."diarias")`; a ocupação da HOSPEDADO que passou da saída conta até agora. A reserva encerrada pela exclusão do titular sem check-out (G4) deixa as quatro colunas nulas de propósito: o resumo cai no vendido.
- **Estadia encerrada congelada (trigger `Hospedagem_encerrada_congelada`)**: UPDATE de peso, retirada ou saída numa hospedagem ENCERRADA dá `HOSPEDAGEM_CONGELADA` (PJ001), menos a anonimização (flag `petjourney.anonimizacao_lgpd`) e o expurgo clínico. Quem precisar escrever na estadia encerrada precisa de decisão escrita e de uma migration.

## 42. Rotina do hotel: prancheta, marcar, ronda e desfazer (E7-05a, 2026-10-29)

Spec: `docs/specs/2026/q4/q4-1/portal-parceiro/e7-hotel/05-rotina-turnos-e-boletim.md` (decisões do gerente de 29/10). Esta fatia traz a **prancheta** que substitui a folha de papel do canil. A rotina padrão da casa (publicar, prévia, desfazer), os ajustes por hóspede, a proposta de rotina, o diário, as ocorrências, o turno do hotel e o boletim são da **E7-05b** e da **E7-05c** (ainda não existem). Tudo sob `/parceiro/portal/hotel`, módulo HOTEL (SUSPENSO: leitura passa, escrita 403).

### De onde vêm as tarefas

- A tarefa é **registro do servidor**, nunca calculada na tela. Ela nasce no **check-in** (hoje e amanhã, na parede da casa) e um processo de hora em hora mantém sempre **hoje e amanhã** prontos. A tela só lê.
- Entram na prancheta: as refeições do plano alimentar, as doses de cada medicação, os cuidados, os serviços vendidos (banho 14:00, tosa 14:30, passeio extra 17:00, recreação individual 11:00, adestramento 16:30; o comprado uma vez cai no dia combinado) e a rotina da casa (por enquanto a inicial: água 07, 12, 18 e 22 h; higiene 09 e 16 h; passeio 10 e 15 h **só para quem autorizou passeio externo**). Serviço cuja autorização foi negada no check-in não vira tarefa.
- Medicação suspensa ou cuidado encerrado: **toda** tarefa pendente dele, inclusive a atrasada, vira `SUSPENSA` na hora (com o registro de quem e quando). `SUSPENSA` não se marca nem se desfaz.
- Mudar a medicação, o cuidado, a adaptação ou acrescentar serviço pela estadia (E7-04a) reorganiza na hora só o **futuro ainda pendente**. Feita, recusada, pulada e atrasada nunca mudam. Se uma hora suspensa volta a valer, nasce uma tarefa nova; a prancheta mostra uma linha só por hora de cada coisa (a viva).
- Prorrogar ou antecipar a saída (ou trocar a baia, os serviços) pelo `PATCH /reservas/:id` de uma reserva hospedada também reorganiza a rotina na hora. Se esse aviso falhar, o processo da hora seguinte acerta.
- **O animal que ficou além da saída prevista** (o responsável atrasou, a prorrogação ainda não foi feita) continua recebendo **remédio, cuidado, comida e água** até o fim de amanhã, por no máximo **72 h depois da saída prevista**. Higiene, passeio e os serviços vendidos param na saída. Depois das 72 h nada mais nasce: o cartão do hóspede vem com o alerta `ROTINA_PARADA_SAIDA_VENCIDA` (urgente) até o balcão prorrogar a reserva ou fazer o check-out.

### Quem faz o quê

| Ação | Permissão | Quem tem |
|---|---|---|
| Ler a prancheta | `hotel.ler` | dono, gestor, recepção, cuidador, banhista, adestrador, **veterinário** |
| Marcar, ronda, desfazer | `hotel.rotina` | dono, gestor, recepção, cuidador, banhista, adestrador |

Para marcar, o login precisa de **ficha de profissional ativa** na casa (decisão 11 do gerente): sem ela, 403 `PROFISSIONAL_OBRIGATORIO`. A tela mostra "Peça ao gestor para cadastrar a sua ficha na equipe". **Pedido para a tela da equipe:** ao convidar alguém com papel do hotel, ofereça criar a ficha de profissional na mesma hora. Quem fez vem da sessão e da ficha, nunca do corpo.

### Rotas

| Método e rota | O que faz |
|---|---|
| `GET /prancheta?dia=AAAA-MM-DD&de=HH:mm&ate=HH:mm` | O dia (padrão: hoje na casa; de hoje-7 a hoje+2) em rondas, mais as pendentes atrasadas de antes da janela (até 7 dias). `de` (inclusive) e `ate` (exclusive) recortam o dia por hora; sem eles, o dia inteiro. Até 2.000 linhas no total: até 500 do atraso (medicação primeiro) e o resto da janela |
| `POST /tarefas/:id/marcar` | `{ status: FEITA \| RECUSADA \| PULADA, motivo?, observacao?, executadaEm?, confirmarAntecipada?, confirmarIntervalo? }`. Aceita `Idempotency-Key` (a repetição devolve a tarefa como está agora). 200 com a tarefa |
| `POST /tarefas/ronda` | `{ tarefaIds: [...], status: 'FEITA' }`, de 1 a 60 ids. Aceita `Idempotency-Key`. 200 com `{ marcadas, falhou, restantes }` |
| `POST /tarefas/:id/desfazer` | Volta a `PENDENTE`. 200 com a tarefa |

### A resposta da prancheta (`PranchetaDto`)

- `dia`, `agora` (o relógio do servidor, ISO com o offset da casa), `truncado` (a janela passou do teto e veio cortada no fim), `atrasoTruncado` (mais de 500 pendentes atrasadas de antes da janela: vieram as medicações e as mais recentes; o total está no contador do menu), `progresso: { total, resolvidas }` (o atraso de ontem conta como trabalho de hoje), `atrasadas`, `medicacoesAtrasadas`, `tom` (`RISCO` com medicação atrasada, `ATENCAO` com outra coisa atrasada, `NEUTRO`), `proxima` (a próxima tarefa pendente).
- `rondas[]`: `{ chave, dia, hora, kind, total, pendentes, aceitaLote, grupos[] }`. A ronda é o mesmo tipo no mesmo horário para vários animais. `aceitaLote` é `false` para medicação (a tela não oferece "marcar a ronda inteira"). `grupos[]` vem na **ordem de andar a casa**: bloco pela ordem cadastrada e baia pelo nome natural ("Baia 2" antes de "Baia 10"); cada grupo tem `{ blocoId, nome, linhas[] }`.
- Cada linha (`TarefaDaPranchetaDto`): `id`, `hospedagemId`, `pacienteNome`, `especie`, `acomodacaoId`, `acomodacaoNome`, `blocoId`, `kind`, `descricao` (a dose escrita, a refeição com marca e porção; congelada), `previstaPara` (ISO com offset), `dia`, `hora` (`HH:mm`), `status`, `situacao`, `tempo`, `motivo`, `observacao`, `executadaEm`, `executadaPorNome` (o nome da ficha de quem registrou, nunca o id).
- `situacao`: `FUTURA` (mais de 30 min à frente), `NA_JANELA` (de 30 min antes a 30 min depois, inclusive), `ATRASADA` (depois), ou o próprio status (`FEITA`, `RECUSADA`, `PULADA`, `SUSPENSA`). `tempo`: `AGORA` (na janela ou atrasada), `ADIANTE` (futura) ou `PASSADO` (resolvida). **Apague a regra local de atraso**: o servidor manda tudo pronto.
- `hospedes[]`: **um cartão por animal na casa**, com ou sem tarefa no que veio: `{ hospedagemId, pacienteNome, especie, acomodacaoNome, focoId, progresso, saidaPrevista, alertas, urgencia }`. O `focoId` é o id da tarefa que decide o cartão (a atrasada mais antiga ou, sem atraso, a próxima; nulo sem tarefa); a linha dela está nas rondas (monte um mapa por `id`). Ordem: os urgentes primeiro, depois a ordem de andar a casa.
  - `alertas`: `SAIDA_VENCIDA` (passou da saída prevista e o animal continua na casa; `urgencia: ATENCAO`) ou `ROTINA_PARADA_SAIDA_VENCIDA` (passou 72 h da saída: nada mais nasce, nem dose nem comida; `urgencia: URGENTE`). Sem alerta, `[]` e `NENHUMA`. Mostre no urgente: "A rotina deste animal parou. Prorrogue a reserva ou faça o check-out." (texto do front, sem travessão).
  - `rotinasParadas` (no topo da resposta): quantos cartões urgentes. Com algum, o `tom` da prancheta é `RISCO`.
- A prancheta nunca leva telefone, CPF nem dado do responsável.

### Regras que a tela precisa mostrar

- **Antes da hora:** feito mais de 30 min antes do horário dá 409 `TAREFA_FORA_DA_JANELA`. Pergunte "Foi feito antes da hora?" e mande de novo com `confirmarAntecipada: true`. **Medicação antes da hora, mesmo 5 min, sempre pede a confirmação.** Conta o horário em que foi feito (`executadaEm`, quando a tela manda), não o do registro: "dei às 7h50 a dose das 8h", registrado às 9h, também pede a confirmação.
- **Dose perto da anterior:** a mesma medicação feita há menos da metade do menor intervalo entre os horários dá 409 `TAREFA_INTERVALO_CURTO` (`ultimaEm`, `minimoMinutos`). Mostre "A dose anterior foi às HH:mm. Confirmar mesmo assim?" e mande com `confirmarIntervalo: true`.
- **Recusou ou pulou:** `motivo` obrigatório (`RECUSOU`, `NAO_COMEU`, `ANIMAL_DOENTE`, `SEM_CONDICAO_DO_TEMPO`, `ORDEM_DO_RESPONSAVEL`, `ORDEM_VETERINARIA`, `OUTRO`); `OUTRO` pede a `observacao` (até 300 caracteres).
- **Feito há pouco:** `executadaEm` (ISO) aceita até 12 h para trás e 5 min para a frente. Sem ele, vale o relógio do servidor.
- **Duas pessoas na mesma tarefa:** a segunda recebe 409 `TAREFA_JA_REGISTRADA` com `status`, `em` e `porNome`. Mostre "Já registrada por {porNome} às {hora}" e atualize a prancheta.
- **Ronda:** mande **só os ids que a tela mostrou** (nunca "o que estiver pendente agora": tarefa que nasceu depois não pode virar FEITA sem ninguém ter visto). Mesmo tipo, mesmo horário, já na janela, nunca medicação. As tarefas são marcadas uma por vez; na primeira que não pega, a ronda **para** e as anteriores **ficam marcadas**. A resposta diz `marcadas` (ids), `falhou: { id, status, porNome, codigo }` (`TAREFA_JA_REGISTRADA`, `TAREFA_SUSPENSA` ou `HOSPEDAGEM_ENCERRADA`) e `restantes` (as que não foram tentadas). Com medicação, 409 `MEDICACAO_NAO_ACEITA_LOTE` e **nenhuma** marcada.
- **Desfazer:** só quem registrou, no mesmo turno do hotel e até 12 h depois. O registro original fica no histórico. Depois de desfeita, se o horário já passou, ela volta como atrasada (é a verdade).
- **Recorte por hora:** a prancheta de uma casa grande passa de 1 MB no dia inteiro (medido: ver "Números medidos" abaixo). No tablet que atualiza sozinho, peça o turno ou as próximas horas (`de`, `ate`) e o dia inteiro só quando a pessoa pedir. As pendentes atrasadas de antes do recorte (de hoje ou de até 7 dias) vêm sempre: o recorte nunca esconde a dose esquecida. Com recorte, o `progresso` é o do recorte.
- **Estadia encerrada:** marcar, ronda e desfazer dão 409 `HOSPEDAGEM_ENCERRADA`. Na prancheta, da estadia encerrada fica só o **trabalho registrado** (feita, recusada, pulada), no dia em que aconteceu: a prancheta de ontem continua mostrando quem deu o remédio do animal que já foi embora. A tarefa que ficou sem registro antes da saída e a suspensa no check-out não aparecem, nem entram em atraso, contador ou resumo. Cartão de hóspede, só para quem está na casa.
- **Prancheta ocupada:** a leitura tem prazo. Com o banco carregado, vem 503 `ROTINA_OCUPADA` com `tenteDeNovoEmSegundos`: no tablet que atualiza sozinho, espere esse tempo e tente de novo, sem mostrar erro na primeira vez.

### Erros novos (decidir a tela pelo `codigo`)

| Código | Status | Quando | Campos |
|---|---|---|---|
| `TAREFA_JA_REGISTRADA` | 409 | Outra pessoa registrou antes | `status`, `em`, `porNome` |
| `TAREFA_FORA_DA_JANELA` | 409 | Mais de 30 min antes (medicação: qualquer antecipação) sem confirmar | `reason: ANTECIPADA`, `previstaPara` |
| `TAREFA_SUSPENSA` | 409 | A medicação foi suspensa, o cuidado encerrado ou a hora deixou de valer | |
| `TAREFA_EXECUCAO_INVALIDA` | 400 | `executadaEm` no futuro ou mais de 12 h atrás | `reason`: `FUTURO`, `ANTIGA` |
| `TAREFA_INTERVALO_CURTO` | 409 | Dose da mesma medicação perto demais da anterior | `ultimaEm`, `minimoMinutos` |
| `MEDICACAO_NAO_ACEITA_LOTE` | 409 | Medicação na ronda (nada marcado) | |
| `RONDA_INCONSISTENTE` | 409 | Dois tipos, dois horários, adiantada ou uma tarefa sumiu (a tela está velha); nada marcado | `reason`: `TIPOS`, `HORARIOS`, `ANTECIPADA`, `ALTERADA` |
| `PRANCHETA_DIA_INVALIDO` | 400 | Dia fora de hoje-7 a hoje+2 | `de`, `ate` (as datas da faixa) |
| `PRANCHETA_HORARIO_INVALIDO` | 400 | Recorte com `de` igual ou depois de `ate` | `de`, `ate` |
| `PLANTAO_DO_HOTEL_TROCOU` | 409 | O turno do hotel foi entregue no mesmo instante | (tente de novo) |
| `ROTINA_TAXA_EXCEDIDA` | 429 | 1.200 ações ou 1.200 leituras por pessoa por hora | `limite`, `tenteDeNovoEmSegundos` |
| `ROTINA_OCUPADA` | 503 | A leitura (prancheta, resumo) não coube no prazo, ou a casa já tem 3 leituras ao mesmo tempo | `motivo` (`FILA_CHEIA`, `ESPERA_ESGOTADA`, `CASA_NO_TETO`, `PRAZO`), `tenteDeNovoEmSegundos` |

Reaproveitados: `HOSPEDAGEM_ENCERRADA` (409), `PROFISSIONAL_OBRIGATORIO` (403), `DESFAZER_NEGADO` (403, `reason`: `OUTRO_AUTOR`, `OUTRO_TURNO`, `PRAZO`, `OUTRO_PLANTAO`), `MOTIVO_OBRIGATORIO` (400, `campo`: `motivo`, `observacao`), `OWNERSHIP_FORBIDDEN` (403: tarefa de outra casa ou inexistente, o mesmo corpo; na ronda, um id alheio nega o lote inteiro).

### Contador do menu e lista de hóspedes

- `GET /parceiro/portal/pendencias` ganha **`tarefasAtrasadas`** (para quem tem `hotel.rotina`; o veterinário não vê), rota `/hotel/prancheta`: tarefas pendentes que passaram da janela de 30 min, **dos últimos 7 dias**, de quem está na casa. `RISCO` se há medicação entre elas, senão `ATENCAO`.
- E **`rotinasParadas`** (para quem tem `hotel.reserva`, o balcão), rota `/hotel/prancheta`, sempre `RISCO`: animais na casa há mais de 72 h depois da saída prevista, com a rotina parada. Texto do selo: "Animais com a rotina parada: prorrogue ou faça o check-out".
- `GET /hospedes` (E7-04a): o campo `tarefas` (`atrasadas`, `pendentesHoje`, `proxima`) e o alerta `TAREFAS_ATRASADAS` passam a vir preenchidos.

### App do responsável e notificações

Nada muda no app nesta fatia. **Nenhum tipo de notificação novo** (o `HOTEL_BOLETIM` é da E7-05c).

### Para quem consome pela API (E7-02b, E7-04, E7-06)

- **O PATCH da reserva (E7-02b, ligado):** dois caminhos. (1) Dentro da transação do `editar` de uma reserva HOSPEDADO que muda a saída, a baia ou os serviços, a E7-02b chama `GanchosDaReserva.pedirReconciliacaoNaTransacao`; a rotina registra `registrarReconciliacao(...)` com `pedirReconciliacao` (`src/hotel/rotina/pedir-reconciliacao.ts`, sem Nest): o horizonte da hospedagem volta a nulo junto com a edição (falhou, a edição volta). (2) Depois do commit, o `LigacoesComAEstadia` da E7-02b chama `aoMudarARotina` (SAÍDA, BAIA), que reconcilia na hora. A rotina **não** registra o `aoMudarAReserva`: ele é da ligação com a estadia. Se (2) falhar, ou só os serviços mudaram, o processo da hora seguinte refaz hoje e amanhã.
- **`pedirReconciliacao(db, parceiroId, { reservaId } | { hospedagemIds })`:** devolve o horizonte; o processo de hora em hora refaz. **Pedido à E7-04:** no `catch` do "acrescentar serviço" (`ROTINA_DO_SERVICO_ADIADA`), chamar `pedirReconciliacao(this.prisma, parceiroId, { reservaId })`.
- **Leituras com prazo:** a prancheta, os contadores e o resumo da lista de hóspedes rodam com `statement_timeout` e fila própria por casa (`lerDaRotinaComOrcamento`, em `rotina-apoio.ts`). O resumo que não cabe no prazo devolve vazio: a lista sai com `tarefas: null`, nunca 500.
- **Ganchos da estadia registrados:** `aoIniciarEstadia` (o check-in materializa hoje e amanhã), `aoMudarARotina` (reconcilia a hospedagem inteira, qualquer `motivo`), `aoEncerrarEstadia` (o pendente depois da `saidaEm` vira `SUSPENSA`, e só a rotina da casa intocada e ainda no futuro sai; a `saidaEm` informada no passado funciona: o que venceu entre ela e agora vira `SUSPENSA`, nunca é apagado) e `resumoDeTarefasPorHospedagem`. `impedimentosDeSaida` e `resumoParaPublicar` vêm na E7-05b.
- **A tarefa no banco:** `TarefaDoHotel` com `origemChave` (= `origemId` ou vazio). O único `(hospedagemId, kind, origemChave, previstaPara)` vale só para a tarefa **viva** (índice parcial `status <> 'SUSPENSA'`). Quem lê tarefas para contar ou resumir ignora `SUSPENSA` e filtra hospedagem `HOSPEDADO`. Índice `(parceiroId, previstaPara, id)` para ler por casa. A pendente que venceu antes da saída de uma estadia encerrada continua `PENDENTE` (ninguém registrou: é a verdade) e fica fora de toda contagem pelo filtro de `HOSPEDADO`. O registro feito não se reescreve no banco (quando, quem, a ficha, o turno, o motivo e a observação).
- **A descrição da dose** ("nome · dose") cabe em 200 caracteres cortando o **nome** com reticências, nunca a dose.
- **`pendentesDaCasa` (regra para a E7-05b, a E7-05c e qualquer export):** toda contagem ou lista de tarefas pendentes passa por `src/hotel/rotina/pendentes-da-casa.ts`: `pendentesDaCasa(...)` (o `where` do Prisma) ou `pendentesDaCasaSql(...)` (agregação). Ela já aplica a hospedagem `HOSPEDADO` e o piso de 7 dias, que é calculado no JS com o fuso da casa (`pisoDoAtraso`) e vai como parâmetro, para entrar no índice. A **passagem de turno do hotel (E7-05b)**, o **boletim (E7-05c)** e qualquer **export** de pendências usam essa função. Nunca escreva `status = 'PENDENTE'` à mão numa consulta nova. O teste "estadia encerrada não entra" (`pendentes-da-casa.spec.ts` e a integração) é o molde.

### Números medidos (29/10, `scripts/medir-hotel-rotina.ts`)

Casa de 300 baias cheia (300 hóspedes, 40 tarefas por dia cada, 3.000 atrasadas), do dev local até o banco de dev:
- prancheta do dia inteiro com 2.000 linhas: cerca de **1 MB** de JSON e 0,65 s; com o recorte de 4 horas, 1.700 linhas (500 do atraso e 1.200 da janela), 907 KB e 0,46 s. Por isso o recorte `de`/`ate` no tablet;
- ronda de 60: 0,6 s;
- contador `tarefasAtrasadas`: 120 ms; resumo da lista de 300 hóspedes: 80 ms (medido de novo depois da correção da auditoria, 29/10).

## 43. Rotina da casa, ajustes, proposta, diário, ocorrências (R3) e o turno do hotel (E7-05b, 2026-10-29)

Spec: `docs/specs/2026/q4/q4-1/portal-parceiro/e7-hotel/05-rotina-turnos-e-boletim.md` (decisões do gerente de 29/10). Tudo sob `/parceiro/portal/hotel`, módulo HOTEL (SUSPENSO: leitura passa, escrita 403). O boletim ao responsável é da **E7-05c** (ainda não existe).

### Quem faz o quê

| Ação | Permissão | Quem tem |
|---|---|---|
| Ler a rotina da casa, os ajustes, o diário, as ocorrências e a URL da foto | `hotel.ler` | dono, gestor, recepção, cuidador, banhista, adestrador, **veterinário** |
| Prever, publicar e desfazer a **rotina da casa** | `estabelecimento.editar` | dono, gestor (decisão 6). O cuidador recebe 403 |
| Ajustar a rotina de **um hóspede**, ver e aprovar a proposta, escrever no diário, registrar ocorrência, contato, tentativa, mudar a gravidade, pedir o telefone, turno do hotel | `hotel.rotina` | dono, gestor, recepção, cuidador, banhista, adestrador |
| Registrar que o responsável **não atendeu** (`SEM_RESPOSTA`) e **descer** uma ocorrência GRAVE | `estabelecimento.editar` | dono, gestor (decisões 8 e 9) |

Escrever no diário, registrar ocorrência, tentativa e contato, e o turno pedem **ficha de profissional ativa** (403 `PROFISSIONAL_OBRIGATORIO`, como na prancheta).

### Rotas

| Método e rota | O que faz |
|---|---|
| `GET /rotina-padrao` | A rotina vigente: `{ versao, padrao, origem, vigenteDesde, publicadaEm, publicadaPorNome, itens[4], tarefasPorDia, podeDesfazer }`. Versão 0 e `padrao: true` enquanto a casa nunca publicou (a inicial do sistema) |
| `POST /rotina-padrao/previsao` | `{ itens }`. Não grava. Devolve `{ criadas, retiradas, suspensas, preservadas, hoje, hospedagens, tarefasPorDia }` |
| `POST /rotina-padrao/publicar` | `{ itens, versaoBase }` com `Idempotency-Key`. Devolve os mesmos números e `{ versao, nadaMudou }` |
| `POST /rotina-padrao/desfazer` | `{ versaoBase }` com `Idempotency-Key`. Só a última publicação, uma vez |
| `GET /hospedagens/:id/ajustes` | `{ ajustes[] (os vigentes, um por tipo), rotinaEfetiva[] (a da casa com os ajustes por cima) }` |
| `POST /hospedagens/:id/ajustes` | `{ kind: AGUA\|HIGIENE\|PASSEIO\|PESAGEM, acao: SUBSTITUI\|SUSPENDE, horarios?, motivo (10 a 300) }`. 201 com a lista acima |
| `DELETE /hospedagens/:id/ajustes/:aid` | Revoga. 204 (de novo, 204) |
| `GET /hospedagens/:id/proposta-de-rotina` | A proposta por regras (`motor: 'REGRAS'`, nada gravado) |
| `POST /hospedagens/:id/proposta-de-rotina/aprovar` | `{ sugestaoIds: [...] }` com `Idempotency-Key`. Devolve `{ aprovadas, jaVigentes, rotina }` |
| `POST /hospedagens/:id/diario` | **JSON** `{ kind, texto (1 a 500), incluirNoBoletim? }` com `Idempotency-Key`. 201 com a entrada |
| `POST /hospedagens/:id/diario/:rid/foto` | **multipart**, campo `file` (JPEG, PNG ou WebP até 8 MB). Só quem escreveu, uma vez. 200 com a entrada (`temFoto: true`) |
| `GET /hospedagens/:id/diario/:rid/foto/url` | URL assinada de 5 min `{ url, expiraEm }` |
| `GET /hospedagens/:id/diario?cursor=` | 30 por página, do mais recente ao mais antigo: `{ itens[], proximoCursor }` |
| `POST /hospedagens/:id/ocorrencias` | `{ kind, gravidade: LEVE\|MODERADA\|GRAVE, descricao (1 a 500), conduta (1 a 300, obrigatória), encaminhadaAoVeterinario? }` com `Idempotency-Key`. 201 |
| `GET /hospedagens/:id/ocorrencias` | As da estadia (até 200, a mais recente primeiro) |
| `GET /ocorrencias/:id` | Uma |
| `GET /ocorrencias/:id/contato-do-responsavel` | O telefone para ligar (ver "R3" abaixo) |
| `POST /ocorrencias/:id/contato` | `{ canal: TELEFONE\|CHAMADA_PELO_APP\|PRESENCIAL, em?, porProfissionalId? }`. 200 |
| `POST /ocorrencias/:id/tentativas` | `{ canal, destino: RESPONSAVEL\|CONTATO_DE_EMERGENCIA, atendeu, em? }` com `Idempotency-Key`. 201 |
| `POST /ocorrencias/:id/sem-resposta` | `{ nota (10 a 300) }`. 200 |
| `POST /ocorrencias/:id/gravidade` | `{ gravidade, motivo? }`. 200 |
| `GET /turnos/atual` | O turno do hotel, as pendências, a R3 e a passagem recebida (ver abaixo) |
| `POST /turnos/assumir` | Com `Idempotency-Key`. 201 com o turno |
| `POST /turnos/:id/entregar` | `{ recebidoPorId (id da ficha de quem recebe), nota (1 a 1000) }` com `Idempotency-Key`. 200 `{ entregue, novo, pendenciasCongeladas }` |

### Rotina da casa (publicar, prévia, desfazer)

- A tela edita **quatro linhas**: água, higiene, passeio, pesagem. Cada uma tem `horarios` (`HH:mm`, até 12) e `ativo`. Linha que não vier vai gravada **desligada**. Horários repetidos saem e a lista volta ordenada.
- **O passeio da casa sempre exige a autorização de passeio externo do check-in**: o corpo não escolhe (`exigeAutorizacao` vem na resposta só para a tela mostrar).
- Linha **ligada sem horário**, 13 horários ou tipo repetido: 422 `ROTINA_ITEM_INVALIDO` com `kind` e `reason`. Horário `9:00` ou `24:00`: 400.
- **Antes de salvar, mostre a prévia**: "Nascem {criadas}, saem {retiradas}, ficam {preservadas}. {hoje} mudanças caem hoje." O `hoje` é o número que assusta: são as mudanças no turno de quem trabalha agora.
- **O passado não se reescreve**: feita, recusada, pulada e **atrasada** nunca saem. Só o futuro ainda intocado (hoje e amanhã) se reorganiza. A tarefa que já foi registrada e desfeita vira `SUSPENSA` (não some).
- `versaoBase` é a `versao` que a tela leu (0 enquanto a casa nunca publicou). Outra pessoa publicou antes: 409 `ROTINA_ALTERADA` com `versaoAtual`; recarregue e revise.
- Itens iguais aos vigentes: 200 com `nadaMudou: true` e nenhuma versão nova.
- **Casa cheia (correção da auditoria, 29/10):** a publicação grava a versão primeiro e reorganiza as tarefas em lotes de 20 hóspedes (cada lote segura só aqueles 20, por pouco mais de um segundo: o check-out e a mudança de baia não esperam a publicação inteira). A resposta ganha **`aoCron`**: quantos hóspedes ficaram para a rodada da próxima hora (um lote falhou ou alguém estava com a estadia na mão). Com `aoCron > 0`, mostre "A rotina nova já vale. A prancheta de {aoCron} hóspedes se ajusta em até uma hora." Com 1.000 hóspedes e 48 horários por dia a publicação leva cerca de 1 minuto (300 hóspedes com a rotina comum, poucos segundos): mantenha o botão em "Publicando..." até a resposta, com tempo de espera da requisição de pelo menos 2 minutos, e não deixe publicar de novo enquanto isso.
- **Desfazer**: só a última publicação, uma vez (`podeDesfazer`). Volta os itens anteriores numa versão nova, tira o futuro intocado que ela criou e recria o que a anterior previa. Depois disso, `podeDesfazer: false`.

### Ajustes e proposta (a rotina de um hóspede)

- O ajuste **substitui a lista inteira** do tipo (nunca soma) ou **suspende**. Um vigente por tipo: o novo revoga o anterior. Motivo obrigatório (10 a 300). `SUBSTITUI` liga o tipo para este hóspede mesmo que a casa não o faça (ex.: pesagem). O passeio continua exigindo a autorização.
- Refeição, medicação e serviço **não se ajustam aqui** (400).
- **Proposta** (regras, não IA): `jaNaRotina[]` é o que já vale (a rotina da casa `HERDADA`, a refeição do plano e as doses `TRANSCRITA`s da ficha: **só leitura**, nunca editáveis aqui) e `sugestoes[]` é o que se propõe (`SUGERIDA`, só água, higiene, passeio e pesagem: **nunca medicação nem refeição**). Cada item: `{ id, kind, horarios, estado, porque: [{ fonte, valor }], jaAprovada }`. `recusas: ['MEDICACAO_NAO_SE_PROPOE', 'REFEICAO_COMBINA_COM_RESPONSAVEL']` vem sempre: mostre "O sistema não propõe medicação nem muda refeição: isso é com o responsável."
- As quatro sugestões: água às 15:00 para quem está estressado; passeio às 18:30 para quem se adapta (só com a autorização); higiene às 08:00 quando a inspeção de entrada fala em sujeira, barro, lama, fezes, mau cheiro, carrapato, pulga ou parasita (só em português; outro idioma não sugere); pesagem às 07:30 em estadia de 5 noites ou mais. O `porque.valor` cita o dado (a frase da inspeção, a adaptação, as noites): **mostre o porquê**.
- **Aprovar** manda os ids (`sug-AGUA`, `sug-HIGIENE`...). O servidor recalcula a proposta: id que ela não reconhece mais (o animal ficou tranquilo, a inspeção mudou) dá 409 `SUGESTAO_DESCONHECIDA` e **nada** é gravado. O que já vale volta em `jaVigentes`.

### Diário

- Texto em JSON primeiro; a foto depois, em outra chamada **multipart** (o diário não perde o texto se a foto falhar). Uma foto por entrada, só de quem escreveu (403 `DIARIO_FOTO_NEGADA`), uma vez (409 `DIARIO_JA_TEM_FOTO`). A foto é regravada em até 1.600 px sem EXIF nem GPS, no armazenamento privado; a tela recebe só `temFoto` e pede a URL assinada (5 min) para mostrar. **Aviso na tela de enviar foto:** "A foto pode mostrar pessoas e outros animais." (texto do front).
- A leitura junta as **entradas do diário e as ocorrências LEVES e MODERADAS** (uma fonte por fato: a ocorrência não é copiada para o diário). Cada item: `{ tipo: REGISTRO\|OCORRENCIA, id, em, kind, texto, temFoto, gravidade, conduta, porNome }`. A ocorrência GRAVE fica na tela de ocorrências. `proximoCursor` só vale para a mesma estadia (de outra: 400 `CURSOR_INVALIDO`).
- Estadia encerrada: lê, não escreve (409 `HOSPEDAGEM_ENCERRADA`).

### Ocorrências e a R3 (ocorrência grave exige contato por voz)

- **Só a gravidade decide.** Ocorrência `GRAVE` nasce com `exigeContato: true`. Enquanto não houver contato:
  - a **passagem do turno** dá 409 `OCORRENCIA_SEM_CONTATO` (`ocorrenciaIds`, `total`) e o turno **continua aberto**;
  - o **check-out** (E7-04b) dá 409 `SAIDA_BLOQUEADA` com o impedimento `OCORRENCIA_SEM_CONTATO`;
  - o boletim (E7-05c) fica retido.
- Cada ocorrência vem com `semContato` (GRAVE sem contato de verdade: o boletim segura) e `travaAPassagem` (GRAVE sem contato nem `SEM_RESPOSTA`: a passagem e o check-out seguram). Pinte a ocorrência pelo `travaAPassagem`.
- **O telefone para ligar** (decisão 7): `GET /ocorrencias/:id/contato-do-responsavel` devolve `{ responsavel: { nome, telefone, telefoneSecundario }, contatoDeEmergencia: { nome, telefone, relacao } \| null }`. Só de ocorrência GRAVE ainda sem contato, de estadia em andamento (senão 409 `OCORRENCIA_NAO_EXIGE_CONTATO`, `OCORRENCIA_JA_COMUNICADA` ou `HOSPEDAGEM_ENCERRADA`). **Cada leitura fica gravada** com quem e quando, antes de o número sair. Limites por pessoa (429 `ROTINA_TAXA_EXCEDIDA` com `limite` e `tenteDeNovoEmSegundos`): 10 por hora, **10 por dia** e **3 por dia na mesma ocorrência** (correção da auditoria). Mostre o número só depois de um toque ("Ver telefone para ligar"), não o guarde na tela e, depois de ver, deixe o número na tela até a pessoa registrar a ligação (para não gastar leitura).
- **Contato**: quem ligou (`porProfissionalId`, um profissional da casa; padrão: quem registra), quando (`em`, padrão agora; entre a ocorrência e 5 min à frente) e o canal **por voz**. É autodeclaração: a tela não promete verificação. **Quem digita também precisa ter ficha de profissional** (403 `PROFISSIONAL_OBRIGATORIO`), mesmo informando quem ligou. O primeiro vale; registrar de novo devolve o registrado.
- **Tentativas**: até **10 sem resposta** e 20 no total (409 `TENTATIVAS_NO_LIMITE` com `limite`). A tentativa ao contato de emergência que **atendeu** não gasta as 10. Tentativa ao responsável que **atendeu** já registra o contato junto. Tentativa ao contato de emergência que atendeu fica só como tentativa (a R3 é a voz do responsável), mas **conta como a ligação ao contato de emergência** do `SEM_RESPOSTA`. A hora de cada tentativa que vale para o `SEM_RESPOSTA` é a do servidor no registro (o `em` informado não conta).
- **O responsável não atende** (decisão 8, revista na auditoria): o gestor ou o dono registra `SEM_RESPOSTA` com uma nota, depois de **3 tentativas sem resposta, com pelo menos 30 minutos entre a primeira e a última**, e de **uma ligação ao contato de emergência, atendida ou não**, quando a estadia tem um (senão 409 `SEM_RESPOSTA_INSUFICIENTE` com `tentativasSemResposta`, `minimo`, `faltaContatoDeEmergencia`, `intervaloMinimoMinutos` e `liberaEm`). Com `liberaEm`, mostre "Tente de novo às {hora de liberaEm}: entre a primeira e a terceira ligação precisam passar 30 minutos." Dez tentativas em poucos minutos não prendem a casa: passados 30 minutos da primeira, mais uma entra. O `SEM_RESPOSTA` **libera a passagem e o check-out**; o boletim continua retido até o contato de verdade, que ainda pode ser registrado depois.
- **Gravidade**: subir é livre (`hotel.rotina`). Descer pede `motivo` (400 `MOTIVO_OBRIGATORIO`); descer uma GRAVE só gestor ou dono (403 `SEM_PERMISSAO`), **só antes da primeira tentativa de ligação** (409 `OCORRENCIA_GRAVE_COM_TENTATIVA` com `tentativas`) e nunca depois do contato ou do `SEM_RESPOSTA` (409 `OCORRENCIA_GRAVIDADE_INVALIDA`). Esconda o "rebaixar" da GRAVE assim que houver tentativa. A ocorrência não se apaga nem se reescreve: só muda de gravidade, com o histórico.
- A ocorrência **não avisa o responsável pelo app** (a ligação é humana).

### Turno do hotel e a passagem

- O turno é o mesmo modelo da internação, outro contexto: rotas próprias aqui, grade 07 a 13, 13 a 19, 19 a 07 no fuso da casa. Registrar no diário, ocorrência ou marcar tarefa sem turno aberto abre um `AUTOMATICO` com quem registrou.
- `GET /turnos/atual`: `{ agora, atual \| null, sugerido \| null, seguinte: { kind, inicio, fimPrevisto }, pendencias[], pendenciasTruncado, ocorrenciasSemContato[] (até 50), ocorrenciasSemContatoTotal, passagemRecebida \| null }`.
  - `pendencias[]`: **em ordem de relógio**, até o fim do turno, com o atraso de até 7 dias, **só de quem está na casa** (a estadia encerrada não entra). Cada uma: `{ tarefaId, hospedagemId, pacienteNome, acomodacaoNome, kind, descricao, previstaPara, dia, hora, deOutroDia, situacao: futura\|na-janela\|atrasada, medicacao }`. Com `deOutroDia`, **mostre a data** ("ontem 22:00"). Medicação vem marcada (não trava a passagem na v1).
  - `ocorrenciasSemContato[]`: `{ id, hospedagemId, pacienteNome, kind, registradaEm, tentativas }`. É o que vai travar a entrega: mostre no topo.
  - `passagemRecebida`: `{ turnoId, entregueEm, entreguePor, nota, destravadoPeloDono, pendencias[] }`. Com `destravadoPeloDono: true`, mostre "Turno encerrado pelo dono" no lugar de "Entregue por {nome}": o dono sem ficha de profissional entrega em nome do responsável do turno, que não fez a passagem. A lista é **congelada** na entrega e não muda; cada item traz `statusAgora` (o status de agora da tarefa, `RETIRADA` se a rotina da casa republicada a tirou, ou `NAO_REGISTRADA` se a estadia terminou sem registro).
- **Assumir**: abre o turno da grade com quem assume (faltando menos de 1 h para acabar, o seguinte). Com um aberto, 409 `TURNO_DO_HOTEL_JA_ABERTO` (`turnoId`): a troca de mãos é pela passagem.
- **Entregar**: só quem está com o turno (o dono destrava o turno vencido ou o de quem perdeu o acesso, **mesmo sem ficha de profissional**: a passagem fica em nome do responsável do turno e a trilha guarda o dono; 403 `PASSAGEM_DO_HOTEL_NEGADA` com `reason` e `vencido`). Quem recebe é a **ficha** de alguém da casa com `hotel.rotina` (o veterinário não recebe), diferente de quem está com ele (409 `PASSAGEM_DO_HOTEL_PARA_SI_MESMO`). **A lista congelada leva só a atrasada e a da janela de 30 minutos** (correção da auditoria): a futura do próximo turno fica na prancheta de quem recebe. Tarefa atrasada **não** trava: ela vai para a lista. Mais de 600 atrasadas e na janela: 409 `PASSAGEM_DO_HOTEL_GRANDE_DEMAIS` ("Registre as tarefas atrasadas antes de passar o turno"). Já entregue: 409 `TURNO_DO_HOTEL_ENCERRADO`.

### Erros novos (decidir a tela pelo `codigo`)

| Código | Status | Quando | Campos |
|---|---|---|---|
| `ROTINA_ALTERADA` | 409 | `versaoBase` velha | `versaoAtual` |
| `ROTINA_ITEM_INVALIDO` | 422 | Linha ligada sem horário, 13 horários, tipo repetido | `kind`, `reason`: `SEM_HORARIO`, `HORARIOS_DEMAIS`, `HORARIO_INVALIDO`, `KIND_FORA_DA_CASA`, `KIND_REPETIDO` |
| `ROTINA_SEM_PUBLICACAO_PARA_DESFAZER` | 409 | Nada a desfazer (ou já desfeita) | |
| `ROTINA_GRANDE_DEMAIS` | 409 | Mais de 1.000 hóspedes na casa | `limite` |
| `AJUSTE_INVALIDO` | 422 | Suspender com horários, substituir sem horários ou com mais de 12 | `reason`: `SUSPENDE_COM_HORARIOS`, `SUBSTITUI_SEM_HORARIOS`, `HORARIOS_DEMAIS` |
| `SUGESTAO_DESCONHECIDA` | 409 | A proposta recalculada não tem a sugestão (nada gravado) | `sugestaoIds` |
| `DIARIO_FOTO_NEGADA` | 403 | Foto na entrada de outra pessoa | `reason: OUTRO_AUTOR` |
| `DIARIO_JA_TEM_FOTO` | 409 | A entrada já tem foto | |
| `DIARIO_SEM_FOTO` | 409 | URL de entrada sem foto | |
| `OCORRENCIA_NAO_EXIGE_CONTATO` | 409 | Contato, tentativa, sem resposta ou telefone de ocorrência que não é GRAVE | |
| `OCORRENCIA_JA_COMUNICADA` | 409 | Telefone, tentativa ou sem resposta depois do contato | |
| `CONTATO_INVALIDO` | 400 | `em` antes da ocorrência ou no futuro | `reason`: `ANTES_DA_OCORRENCIA`, `NO_FUTURO` |
| `OCORRENCIAS_NO_LIMITE` | 409 | A estadia já tem 500 ocorrências registradas | `limite` |
| `CONTATO_ANTES_DA_GRAVIDADE` | 422 | `em` de antes da hora em que a ocorrência virou GRAVE (a que subiu às 15:00 não aceita "liguei às 11:00"; vale no contato e na tentativa atendida). Mostre "Ligue de novo para o responsável" e deixe registrar o contato de agora | `graveDesde` (no fuso da casa) |
| `TENTATIVAS_NO_LIMITE` | 409 | A 11ª sem resposta (ou a 21ª no total) | `limite` |
| `SEM_RESPOSTA_INSUFICIENTE` | 409 | Menos de 3 tentativas sem resposta, menos de 30 min entre a primeira e a última, ou nenhuma ao contato de emergência | `tentativasSemResposta`, `minimo`, `faltaContatoDeEmergencia`, `intervaloMinimoMinutos`, `liberaEm` (ISO ou nulo) |
| `OCORRENCIA_GRAVIDADE_INVALIDA` | 409 | Descer depois do contato | `reason: JA_COMUNICADA` |
| `OCORRENCIA_GRAVE_COM_TENTATIVA` | 409 | Descer uma GRAVE depois da primeira tentativa de ligação | `tentativas` |
| `OCORRENCIA_SEM_CONTATO` | 409 | Entregar o turno com GRAVE sem contato | `ocorrenciaIds` (até 50), `total` |
| `TURNO_DO_HOTEL_JA_ABERTO` | 409 | Assumir com um aberto | `turnoId` |
| `TURNO_DO_HOTEL_ENCERRADO` | 409 | Entregar turno já entregue | `turnoId` |
| `PASSAGEM_DO_HOTEL_NEGADA` | 403 | Entregar o turno de outra pessoa | `reason: NAO_E_O_RESPONSAVEL`, `vencido` |
| `PASSAGEM_DO_HOTEL_PARA_SI_MESMO` | 409 | Quem recebe é quem está com o turno | |
| `PASSAGEM_DO_HOTEL_GRANDE_DEMAIS` | 409 | Mais de 600 pendências | `limite` |
| `TAREFA_RETIRADA` | 409 | Na prancheta (marcar, desfazer): a rotina da casa foi republicada e tirou a tarefa entre a tela e o registro (antes vinha 403). Atualize a prancheta | |

Reaproveitados: `HOSPEDAGEM_ENCERRADA` (409), `PROFISSIONAL_OBRIGATORIO` (403), `SEM_PERMISSAO` (403, `permissao`), `MOTIVO_OBRIGATORIO` (400, `campo`), `CURSOR_INVALIDO` (400), `FOTO_DA_ESTADIA_INVALIDA` (400, `reason`: `TIPO`, `TAMANHO`, `PIXELS`, `ILEGIVEL`), `ROTINA_TAXA_EXCEDIDA` (429; baldes novos: prévia 120/h, telefone 10/h e 10/dia, 3/dia na mesma ocorrência, foto 60/h por pessoa), `ROTINA_OCUPADA` (503 na leitura do turno e na prévia), `PLANTAO_DO_HOTEL_TROCOU` (409), `OWNERSHIP_FORBIDDEN` (403: hospedagem, ajuste, entrada do diário, ocorrência ou turno de outra casa, de outra hospedagem ou inexistente, o mesmo corpo; o turno da internação pela rota do hotel também).

### Contador do menu e resumo

- `GET /parceiro/portal/pendencias` ganha **`ocorrenciasSemContato`** (para quem tem `hotel.rotina`; o veterinário não vê), rota `/hotel/passagem`, sempre `RISCO`: ocorrências GRAVES sem contato nem `SEM_RESPOSTA`, de quem está na casa. Texto do selo: "Ocorrências graves esperando a ligação ao responsável".
- O resumo do hotel (E7-06) passa a trazer o bloco de ocorrências (`ocorrenciasDisponiveis: true`): contagens por tipo e gravidade no período. Cada tipo ganha **`graveDoProprioAutor`** (opcional): das graves, quantas foram criadas e comunicadas pela mesma pessoa em menos de 10 minutos. Com valor acima de zero, mostre ao gestor um aviso discreto: "{n} ocorrências graves foram registradas e comunicadas pela mesma pessoa em menos de 10 minutos. Vale conferir."

### App do responsável e notificações

Nada muda no app nesta fatia. **Nenhum tipo de notificação novo** (o `HOTEL_BOLETIM` é da E7-05c). Na publicação da estadia ao fim (E7-04b), as intercorrências passam a vir preenchidas: só as ocorrências **LEVES**, por tipo e quantidade, nunca texto.

### Para quem consome pela API (E7-04b, E7-06, E7-05c, cadastro)

- **Ganchos da estadia registrados** (`GanchosDasOcorrencias`): `impedimentosDeSaida` (as GRAVES sem resultado das hospedagens do check-out; o `SEM_RESPOSTA` libera) e `resumoParaPublicar` (`{ intercorrencias: [{ kind, quantidade }] \| null }`, só LEVE desde `desde`). O bloco `ocorrencias` do resumo do hotel e o contador `ocorrenciasSemContato` também.
- **R3 para a E7-05c** (`src/hotel/rotina/regras/r3.ts`): `travaOBoletim(o)` = GRAVE sem `contatoEm` (o `SEM_RESPOSTA` não cobre); `travaAPassagem(o)` = GRAVE sem resultado. O contato mora na ocorrência (`OcorrenciaDoHotel.contatoEm`, `resultadoDoContato`): o boletim deriva, não guarda. `gravidadeMudadaEm` é gravado em toda mudança de gravidade, nos dois sentidos (o trigger exige o evento com o mesmo instante); "GRAVE sem contato da estadia" tem o índice parcial `OcorrenciaDoHotel_grave_sem_contato_idx` (`hospedagemId, registradaEm` onde `exigeContato` e `contatoEm` nulo).
- **O encaixe com a E7-05c, pronto deste lado** (`src/hotel/rotina/fonte-do-boletim-da-rotina.ts`): `FONTE_DO_BOLETIM_DA_ROTINA` (`ocorrencias`, `diario`, `fotosDoDiario`, na forma da `FonteDoBoletimDoHotel` da 05c, com `graveDesde = GREATEST(registradaEm, gravidadeMudadaEm)`) e `AvisoDoContatoDaOcorrencia.registrar(fn)`, chamado na transação do contato (rota `contato` e tentativa ao responsável que atendeu), depois da trava da ocorrência. No rebase, a 05c registra `encaixe.registrarFonte(FONTE_DO_BOLETIM_DA_ROTINA)` e `aviso.registrar((tx, e) => encaixe.aoRegistrarContato(tx, e))`.
- **Rotina da casa e materialização:** a publicação e o desfazer pegam o advisory **exclusivo** da rotina da casa depois de travar as hospedagens; toda materialização (check-in, ganchos, cron) pega o **compartilhado** antes de ler a versão (`travarRotinaDaCasaParaLer`). Quem materializar por outro caminho usa `MaterializacaoDaRotinaService.materializar` (que já pega).
- **A passagem e o turno** usam `pendentesDaCasa` (HOSPEDADO, piso de 7 dias como parâmetro) e as primitivas da E5-02c (`turnoAbertoOuAutomatico`, `profissionalDoExecutor`, `plantaoQueAbre`, `situacaoNaEntrega`). `OwnershipService.executoresDoHotel` / `assertExecutorDoHotel` são o par de `executoresDaInternacao` com `hotel.rotina`.
- **LGPD (cadastro, E2-01; decisão do gerente no G5):** a exclusão a pedido do titular (que vira anonimização quando há estadia) chama `anonimizarRotinaDosPacientes` (`src/hotel/rotina/ganchos-do-cadastro-da-rotina.ts`): diário, descrição e conduta da ocorrência, nota do `SEM_RESPOSTA`, motivo da mudança de gravidade, motivo do ajuste e observação da tarefa viram "Removido a pedido do titular"; a foto do diário **é apagada do bucket** depois do commit, como a foto da estadia da E7-04b. O fato fica (gravidade, contato, quem, quando). Correção da auditoria: também o texto **copiado** (a descrição da tarefa de cuidado ou de serviço fica vazia; a pendência congelada na passagem fica só com o animal e a baia; a nota de passagem dos turnos do hotel que cruzam a estadia vira o texto fixo), e a GRAVE ainda sem contato de uma estadia que a exclusão encerra fica como está (o pedido do titular vence a R3) com uma linha na trilha (`semContatoNaExclusao`).


## 44. Boletim do hotel ao responsável (E7-05c, 2026-10-29)

Spec: `docs/specs/2026/q4/q4-1/portal-parceiro/e7-hotel/05-rotina-turnos-e-boletim.md` (decisões do gerente de 29/10). O mesmo mecanismo do boletim da internação (E5-03): a casa compõe, o servidor decide se pode sair, o push vai **sem conteúdo** e o app lê o texto na tela. A diferença é o que retém: aqui é a **R3**, ocorrência GRAVE do período sem contato por voz com o responsável. Portal sob `/parceiro/portal/hotel` (módulo HOTEL; SUSPENSO: leitura passa, escrita 403); app sob `/tutor/hotel`.

### Quem faz o quê

| Ação | Permissão | Quem tem |
|---|---|---|
| Ler a conversa, os modelos e a preferência; compor, descartar, enviar; gravar a preferência pelo balcão | `hotel.rotina` | dono, gestor, recepção, cuidador, banhista, adestrador |
| Veterinário (só `hotel.ler`) | nada do boletim | 403 `SEM_PERMISSAO` |

Quem compôs, quem enviou e quem descartou vêm da sessão, nunca do corpo.

### Portal: rotas

| Método e rota | O que faz |
|---|---|
| `GET /hospedagens/:id/boletins?cursor=` | A conversa da casa: todos os boletins da estadia (rascunho, retido, liberado, enviado, cancelado), do mais recente, 30 por página. Topo: `fuso`, `semCanalNoApp` (sem vínculo ativo do dono atual: nada sai, avise por telefone) |
| `GET /hospedagens/:id/boletins/modelos` | Só leitura: `sugestoes` (`DIA_TRANQUILO`, `DETALHE_DA_ROTINA`, `APOS_CONTATO`) no idioma do responsável, `tarefas` registradas do período (refeições aceitas e recusadas, água, passeios, higiene, banho e tosa, adestramento, medicações dadas e **não dadas**, cuidados), `medicacoesAtrasadas` agora, `ocorrencias` leves e moderadas por tipo, `diario` do período (até 20; o texto é interno, sugestão para editar; `fotoDisponivel` diz se pode ir em `fotoDiarioIds`) e `exigeContato` |
| `POST /hospedagens/:id/boletins` | `{ texto (1 a 2000), idioma?, fotoDiarioIds? (até 3) }`. Aceita `Idempotency-Key`. 201 com o boletim: `RASCUNHO`, ou `RETIDO` se há grave do período sem contato |
| `POST /boletins/:id/enviar` | Aceita `Idempotency-Key`. 200 `{ id, entregue, motivo, boletim }`. Repetir devolve o mesmo comprovante, **um push só** |
| `POST /boletins/:id/descartar` | 200, `CANCELADO` (`DESCARTADO`). Fica na conversa e nunca vai ao app. Repetir não muda nada |
| `GET` e `PUT /hospedagens/:id/preferencias` | `{ frequenciaHoras: 12 \| 24 \| 48, fotoSempre? }`. O PUT grava `definidaPor: HOTEL` (o responsável pediu no balcão) |

**Um aberto por estadia:** compor com um rascunho, retido ou liberado esperando dá 409 `BOLETIM_HOTEL_JA_ABERTO` com o `boletimId` do existente. Para corrigir o texto, descarte e escreva de novo (o texto não muda depois de gravado).

### O boletim na conversa (`BoletimDoHotelDaCasaDto`)

`id`, `hospedagemId`, `tipo` (`ROTINA` ou `SAIDA`), `origem` (`MANUAL` ou `AUTOMATICO`), `status`, `texto`, `idioma`, `fotos` (quantas), `fotoDiarioIds` (abra pela rota da foto do diário, seção 43), `janelaInicio` (o início do período: o último enviado ou a entrada), `geradoEm`, `atualizadoEm`, `autorUsuarioId` (nulo: o sistema), `exigeContato` (foi retido alguma vez), **`contatoPendente`** (relido agora: ainda falta o contato para este aberto sair), `retidoDesde` (a grave mais antiga que segurou), `liberadoEm`, `enviadoEm`, `canceladoEm`, `motivoCancelamento` (`DESCARTADO`, `ENCERRAMENTO`, `SUPERADO`: um rascunho esquecido que o automático substituiu), `entrega` (o comprovante da última tentativa: `situacao`, `canal`, `motivo`, `destinatarios`, `soInbox`, `em`).

### Regras que a tela precisa mostrar

- **R3, a notícia grave é por voz:** com qualquer ocorrência GRAVE da estadia (de quando for, inclusive uma leve de antes do último boletim que subiu para grave depois) sem contato registrado depois dela, o envio dá 409 `BOLETIM_EXIGE_CONTATO` (`ocorrencias`: quantas seguram, `desde`) e **nada sai**; o rascunho passa a `RETIDO`. Mostre "Ligue para o responsável e registre o contato na ocorrência antes de enviar" e leve à ocorrência (seção 43). O `SEM_RESPOSTA` do gestor libera a passagem e o check-out, **nunca o boletim**. Registrado o contato, o retido vira `LIBERADO` e o envio passa.
- **Escrito antes da grave:** ocorrência que **virou** GRAVE depois que o boletim foi escrito (registrada grave depois, ou registrada antes e com a gravidade subida depois; mesmo já com contato) dá 409 `BOLETIM_HOTEL_DESATUALIZADO`. Descarte e escreva de novo.
- **Sem app:** sem vínculo ativo do dono atual (ou dono sem conta viva, paciente com óbito), o envio devolve 200 `entregue: false` com `motivo` (`SEM_CANAL_NO_APP`, `NAO_AVISAR`) e o comprovante com canal `NENHUM`. O boletim fica como estava. Mostre "Este responsável não tem o app: avise por telefone".
- **Fotos:** até 3 entradas do diário **desta** estadia, com foto. De outra estadia, de outra casa, sem foto ou inexistente: 403 `FOTO_DE_OUTRA_HOSPEDAGEM` (o mesmo para todo caso). Aviso fixo na tela: a foto pode mostrar pessoas e outros animais.
- **Teto do push:** no máximo 4 pushes de boletim por responsável por dia da casa, somando as estadias dele. Acima, o boletim chega só no inbox do app (`entrega.soInbox: true`).
- **Frequência:** 12 h (07:00 e 19:00), 24 h (07:00) ou 48 h (07:00, dia sim, dia não), sempre no relógio da casa. O boletim de rotina nunca nasce nem sai entre 22:00 e 07:00; o das 07:00 começa com "Bom dia". `mensagensPorDia` (48 h: 0,5) e `proximoBoletimEm` vêm prontos.

### O automático e o de saída

- **Automático (de 15 em 15 min):** no horário da preferência, com vínculo ativo, o servidor compõe um **molde fechado** (só contagens do período: refeições, água, passeios, higiene, banho e tosa, medicações dadas, cuidados; nunca texto da equipe, nome de remédio, dose, ocorrência nem pessoa). Ele **só sai sozinho** quando o período não teve ocorrência de nenhuma gravidade e nenhuma dose ficou sem dar (recusada, pulada ou atrasada agora). Senão nasce `RASCUNHO` (`origem: AUTOMATICO`) para uma pessoa revisar: o portal mostra na conversa, a pessoa envia como está ou descarta e escreve. Com grave sem contato nasce `RETIDO` (texto "A equipe conversou com você sobre {pet}..."). Com um aberto recente da casa, o automático não compete. **O automático nunca anexa foto** (foto só quando uma pessoa escolhe no compor) e **não roda em estadia esquecida** (a saída prevista passou há mais de 72 h sem check-out).
- **Rascunho esquecido:** um rascunho mais velho que a frequência da estadia (12, 24 ou 48 h; sem preferência, 24) deixa de calar o automático e passa a contar no selo do menu. No horário seguinte: se o período está limpo, o rascunho velho vira `CANCELADO` (`SUPERADO`) e o automático sai; se há grave sem contato, o rascunho velho vira `RETIDO`; se o período pede revisão, o rascunho velho fica para uma pessoa. Mostre o `SUPERADO` na conversa como "Substituído pelo boletim automático".
- **Saída (check-out):** no check-out (entrega no balcão, paciente vivo, vínculo ativo) nasce o boletim `SAIDA` ("{pet} voltou para casa. Um resumo da estadia...", com as contagens e, se o peso caiu 5% ou mais, uma frase neutra sem número). Sai em até 1 minuto. Os abertos de rotina viram `CANCELADO` (`ENCERRAMENTO`).
- **Encerramento pelo sistema (G5):** a estadia encerrada sem entrega no balcão (óbito encerrado pela internação, exclusão a pedido do titular) ou com o paciente com óbito: nada nasce, os abertos cancelam, e toda notificação do boletim daquela estadia fica lida e sem push adiado. Nunca "voltou para casa" nem "passou a noite" depois do óbito.
- **Animal internado na clínica do mesmo parceiro (auditoria final, 30/10):** a estadia segue HOSPEDADO (decisão A2 do G5), mas o hotel não manda boletim: o automático não compõe (só remarca o próximo horário), o check-out não cria o de saída (ele não voltou para casa), o push adiado do hotel não toca e nenhum envio do hotel toca o celular (o manual fica ENVIADO na conversa, sem push). Quem fala com o responsável é o boletim da internação.

### Erros novos (decidir a tela pelo `codigo`)

| Código | Status | Quando | Campos |
|---|---|---|---|
| `BOLETIM_EXIGE_CONTATO` | 409 | Grave do período sem contato por voz | `boletimId`, `ocorrencias`, `desde` (ou `reason: NO_BANCO` quando foi o banco) |
| `BOLETIM_HOTEL_DESATUALIZADO` | 409 | Grave registrada depois da composição | `boletimId` |
| `BOLETIM_HOTEL_JA_ABERTO` | 409 | Compor com um aberto | `boletimId` |
| `BOLETIM_HOTEL_CONGELADO` | 409 | O banco recusou (o boletim mudou no meio) | |
| `FOTO_DE_OUTRA_HOSPEDAGEM` | 403 | Foto que não é do diário desta estadia | |
| `PREFERENCIA_DO_HOTEL_INVALIDA` | 400 | Frequência fora de 12, 24, 48 | `permitidas` |

Reaproveitados: `BOLETIM_JA_ENVIADO` (409, descartar um enviado), `BOLETIM_CANCELADO` (409, enviar um cancelado), `HOSPEDAGEM_ENCERRADA` (409 nas escritas da estadia encerrada), `ROTINA_TAXA_EXCEDIDA` (429 no portal), `BOLETIM_TAXA_EXCEDIDA` (429 no app, 600 por hora por pessoa), `SOMENTE_LEITURA` (403, família no PUT), `SEM_PERMISSAO` (403), `OWNERSHIP_FORBIDDEN` (403: estadia ou boletim de outra casa ou inexistente, o mesmo corpo).

### Contador do menu

`GET /parceiro/portal/pendencias` ganha **`boletinsDoHotelRetidos`** (para quem tem `hotel.rotina`; o veterinário não vê), rota `/hotel/boletins`, `RISCO` com algum: boletins de rotina de quem está na casa `RETIDO` (falta o contato), `LIBERADO` ainda sem tentativa de envio ou `RASCUNHO` mais velho que a frequência da estadia (o esquecido). Texto do selo: "Boletins esperando o contato ou o envio".

### App do responsável (`/tutor/hotel`)

| Método e rota | O que faz |
|---|---|
| `GET /hospedagens?petId=` | As estadias do pet (em andamento e encerradas há até 30 dias), das casas com vínculo ativo do dono atual e o módulo de hotel: `{ id, situacao (HOSPEDADO, ENCERRADA), entradaEm, saidaEm, petId, petNome, hotel { id, nome, telefone, fuso }, podeAjustarPreferencias }` |
| `GET /hospedagens/:id/boletins?cursor=` | Só os **enviados**, do mais recente, 30 por página: `{ id, tipo (ROTINA, SAIDA), texto, idioma, enviadoEm, fotos }` |
| `GET /hospedagens/:id/boletins/:boletimId` | Um enviado (o toque na notificação) |
| `GET /hospedagens/:id/boletins/:boletimId/fotos/:n` | A URL assinada (10 min) da foto `n` (1 a `fotos`). Peça a cada exibição: o acesso é conferido de novo. `url: null`: a foto saiu |
| `GET` e `PUT /hospedagens/:id/preferencias` | O dono grava `{ frequenciaHoras: 12 \| 24 \| 48, fotoSempre? }` (estadia em andamento); a família lê e recebe 403 `SOMENTE_LEITURA` no PUT |

- O app **nunca** recebe ocorrência, gravidade, retenção, status interno, contagem de retidos, tarefa, baia nem nome da equipe. Não mostre "sem notícias há X horas" nem "boletim aguardando": o silêncio não é sinal.
- O texto vem no idioma em que a casa escreveu (`idioma`): mostre o rótulo do idioma quando for diferente do do aparelho. A PetJourney não traduz texto de saúde.
- Responsável errado, dono antigo (o pet passou a outra conta), vínculo encerrado, conta em exclusão, estadia anterior ao vínculo atual, casa sem o módulo: o mesmo 403.

### Notificação nova para o app: `HOTEL_BOLETIM`

- Copy fixa nos 6 locales: "Notícias de {pet}" / "A hospedagem mandou uma atualização. Toque para ler no app." Nenhum texto, ocorrência, motivo nem nome da casa. Categoria `CLINICO` (canal Android `CUIDADO`, nunca e-mail). Ao dono e à família (`dados.paraMembro: true`). Respeita a noite do aparelho (fora de `TIPOS_QUE_FURAM_A_NOITE`).
- `dados`: `{ hospedagemId, boletimId, petId, petNome, paraMembro? }`. Depois do fim da estadia ou do vínculo, a notificação fica lida, sem push, com `dados.encerrada: true`: abra a estadia encerrada, não o boletim. O push adiado pela noite do aparelho também não toca se, depois do envio, surgiu (ou subiu) uma ocorrência grave sem contato: a notícia grave vai por voz; a notificação segue no inbox.
- **Para o Luís (app):** acrescentar `HOTEL_BOLETIM` em `services/notificacao/rotas-notificacao.ts` (`ROTA_POR_TIPO`: até a tela de estadias existir, `/screens/notifications`, como no backend), em `AFETA_HOME_POR_TIPO`, `PERFIL_POR_TIPO` (perfil do responsável) e `CATEGORIA_POR_TIPO` (`CLINICO`), e os textos nos 6 locales. Sem isso o toque cai em Unmatched Route e o `audit:notificacao-rotas` local fica vermelho. A tela: "Hospedagem" no perfil do pet (lista de estadias), a conversa só leitura com os boletins e as fotos, e a preferência (só o dono).

### Para quem consome pela API (E7-05b e o G5)

- **O encaixe** (`src/hotel/rotina/fonte-do-boletim.ts`, `EncaixeDoBoletimDoHotel`, no `HotelModule`): o `GanchosDoBoletimDoHotel` registra a **fonte** da E7-05b (`FONTE_DO_BOLETIM_DA_ROTINA`, de `src/hotel/rotina/fonte-do-boletim-da-rotina.ts`: as ocorrências, o diário e as fotos) e escuta o `AvisoDoContatoDaOcorrencia` dela: o contato por voz (direto ou a tentativa atendida pelo responsável) chama `aoRegistrarContato(tx, { parceiroId, hospedagemId })` dentro da transação do contato, e o retido coberto vira LIBERADO na mesma hora. O trigger do banco segura a R3 por SQL estático (migration `20261030150000_hotel_boletim_r3_estatica`), lendo a tabela `OcorrenciaDoHotel` pelo índice parcial das graves sem contato. Sem a fonte (só em teste), o automático deixa rascunho e o boot avisa (`FONTE_DO_BOLETIM_AUSENTE`).
- **Fim da estadia:** o `aoEncerrarEstadia` da rotina chama o boletim (`EncaixeDoBoletimDoHotel.aoEncerrarEstadia`). Todo encerramento que passa por `GanchosDaEstadia.aoEncerrarEstadia` (check-out, exclusão, óbito do G5) já cancela os abertos e suprime os pushes; o de saída só nasce com entrega no balcão e paciente sem óbito.
- **LGPD:** a anonimização do titular chama `anonimizarBoletinsDoHotelDosPacientes` (`src/hotel/rotina/boletim/ganchos-do-cadastro-do-boletim.ts`): o texto vira "Removido a pedido do titular" e as fotos deixam de ser apontadas; a preferência gravada pelo app perde a conta de quem gravou (`definidaPorUsuarioId` nulo; a frequência fica); o resto (quando, quem enviou, o comprovante, os números do molde) fica.
- **Fonte da E7-05b (correção da auditoria, 29/10):** `ocorrencias(...).graves` traz **todas** as graves da estadia (não só as do período), cada uma com `graveDesde` = `GREATEST(registradaEm, gravidadeMudadaEm)`; a R3 do boletim não tem janela.

## 45. Correção do G5 (29/10): exclusão com reserva paga, óbito do hospedado e o dinheiro do hotel

No `develop` em `2916ae20` (30/10), depois da re-auditoria. **Não está em produção.** Nada de rota nova e nenhum tipo de notificação novo. Mudam respostas, um valor de enum, um código de erro (`TAREFA_ANIMAL_INTERNADO`) e algumas regras de tela.

### Exclusão a pedido do titular com o módulo do hotel só para consulta (portal, cadastro)

- `POST /parceiro/portal/clientes/:id/anonimizar` (a mesma rota do E2-01): com o módulo HOTEL **sem escrita** (suspenso, desligado, prazo vencido), a reserva viva **com pagamento registrado** não trava mais o pedido. Ela é cancelada pelo sistema e o dinheiro fica no livro. A resposta ganha:
  - `comPagamento: string[]`: as reservas canceladas que têm dinheiro registrado. Mostre um aviso ao DONO: "Há pagamento registrado nestas reservas. Acerte a devolução no balcão quando o módulo do hotel voltar." O sistema não devolve nada;
  - `reservasAjustadas: string[]`: a reserva em que o outro animal é de outro cliente continua para ele, sem o animal do titular.
- Com o módulo escrevendo, nada muda: 409 `PACIENTE_COM_RESERVAS` (cancele as reservas antes).
- **Motivo novo do cancelamento:** `EXCLUSAO_DO_TITULAR` (só o sistema grava; não entra no seletor do cancelar). Rótulo nos 6 locales:

| Locale | Rótulo |
|---|---|
| pt-BR | Cancelada pelo pedido de exclusão de dados |
| en-US | Cancelled by a data deletion request |
| en-GB | Cancelled by a data deletion request |
| es-419 | Cancelada por la solicitud de eliminación de datos |
| sr-Latn | Otkazano zbog zahteva za brisanje podataka |
| ar | أُلغيت بسبب طلب حذف البيانات |

### Óbito do animal hospedado (portal)

- O óbito registrado na internação (encerrar com `OBITO`), no cadastro (inativar com `OBITO`) ou na falta (justificativa `OBITO`) **não dá mais 409 `PACIENTE_HOSPEDADO`**. A estadia daquele animal é encerrada pelo sistema: sem retirada, sem peso de saída, sem publicação no app e sem aviso. O outro animal da mesma reserva continua hospedado e sai pelo check-out de sempre.
- A estadia (`GET .../hospedagens/:id`, a estadia da reserva) ganha **`encerradaPeloObito: boolean`**. Com ela verdadeira, mostre "Encerrada pelo óbito" e esconda a retirada, o documento e o peso de saída (vêm nulos). Não ofereça check-out para ela.
- Se era o único animal, a reserva vai a `ENCERRADA` sem o orçamento final (`orcamentoFinal`, `totalFinalCentavos`, `diariasFinais` e `encerradaEm` nulos): mostre o orçamento vendido.
- A resposta do encerrar da internação ganha `encerramento.obito.hospedagensEncerradas` (número). A da falta com óbito ganha `obito.hospedagensEncerradas` (ids).
- Internar um animal hospedado **não pede confirmação**. O check-in de um animal internado também continua permitido.

### Prancheta (`GET /parceiro/portal/hotel/prancheta`)

- O cartão do hóspede (`hospedes[]`) ganha **`naInternacao: boolean`**: o animal está internado na clínica da mesma casa. Mostre o selo "Na internação". Enquanto isso, a medicação e o cuidado da estadia não nascem na prancheta; com a alta, voltam no ciclo seguinte (até 1 h).

| Locale | Selo |
|---|---|
| pt-BR | Na internação |
| en-US | In hospital care |
| en-GB | In hospital care |
| es-419 | En internación |
| sr-Latn | Na hospitalizaciji |
| ar | في الاستشفاء |

### Dinheiro da estadia (portal)

- **Acrescentar serviço e prorrogar uma reserva `HOSPEDADO`** (`POST .../hospedagens/:id/servicos`, `PATCH /reservas/:id`, `POST /reservas/simular` com `reservaId`): o total passa a mudar só pelas quantidades, com os preços da venda. A cortesia de baia melhor não é mais desfeita. A `diferenca` e o `simular` mostram a mesma conta.
- **Registrar pagamento** (`POST /reservas/:id/confirmar`, só `hotel.valores`) passa a aceitar `HOSPEDADO` e `ENCERRADA`. Mostre o botão "Registrar pagamento" também na reserva encerrada (o cuidador faz o check-out sem valores, e o balcão registra depois). Na `ENCERRADA` o `motivo` (10 a 300) é obrigatório: sem ele, 422 `PAGAMENTO_INVALIDO` com `reason: MOTIVO_OBRIGATORIO`. Só o pago muda; o check-out repetido com outro pagamento continua 409.

### App do responsável (`GET /tutor/hotel/reservas`)

- `dinheiro.saldoCentavos` agora é **`number | null`** e segue o status:
  - `PENDENTE`, `CONFIRMADA`, `HOSPEDADO`: o vendido menos o pago;
  - `ENCERRADA`: o total final menos o pago, e `dinheiro.orcamento` é o orçamento final;
  - `CANCELADA`: negativo é o que volta ao responsável (no prazo, todo o pago; fora dele, o que passou do sinal), e `sinalReembolsavelHoje` diz se o sinal voltava no dia do cancelamento;
  - `NAO_COMPARECEU`: `null`. Não mostre saldo; mostre "Fale com a hospedagem".
- A família deixa de ver as reservas do pet cujo dono pediu a exclusão da conta.

### Re-auditoria do G5 (29/10): a medicação do hotel passa para a internação

- **Prancheta:** com o animal internado na clínica da mesma casa (`naInternacao: true` no cartão), a medicação e os cuidados do hotel dele somem da prancheta na hora (viram SUSPENSA, com o evento do sistema), inclusive os atrasados. Marcar uma dessas tarefas dá **409 `TAREFA_ANIMAL_INTERNADO`** (código novo). Mostre a copy do catálogo (pt-BR: "Este animal está internado na clínica. A medicação e os cuidados do hotel ficam com a equipe da internação até a alta.") e recarregue a prancheta. A refeição, a água e o resto da rotina continuam. Na alta, a medicação volta no ciclo seguinte (até 1 h).
- **Internação (portal, clínica):** o detalhe (`GET /parceiro/portal/clinica/internacoes/:id`) e a lista do prescrever (`GET .../internacoes/:id/prescricoes`) ganham **`medicacaoDaEstadia`**: `null` sem estadia em curso; senão `{ medicacoes: [{ descricao, via, doseTexto, horarios, ultimaDose: { em, porNome } | null }], truncado }`. Mostre como bloco só leitura "O que ele tomava no hotel", perto das prescrições (é a referência para o veterinário não repetir a dose). Sem botão de ação: o hotel não marca mais essas doses.

| Locale | Título do bloco |
|---|---|
| pt-BR | O que ele tomava no hotel |
| en-US | What it was taking at the hotel |
| en-GB | What it was taking at the hotel |
| es-419 | Lo que tomaba en el hotel |
| sr-Latn | Šta je uzimao u hotelu |
| ar | ما كان يتناوله في الفندق |
