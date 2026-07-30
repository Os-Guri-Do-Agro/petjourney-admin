# Integração: anotação estruturada no portal do parceiro

**Para:** time do portal do parceiro (`web.petjourney.health` / `admin.petjourney.health`)
**De:** backend (petjourney-api)
**Data:** 2026-07-29
**Status:** backend no ar em produção. App mobile e canal público já integrados. Portal pendente.

> `docs/` está no `.gitignore` deste repo, então este arquivo não vai para o GitHub. Repasse o conteúdo.

---

## O que aconteceu, e por que isso chega para vocês

A anotação que o prestador escreve num Acesso Temporário era **dois campos de texto livre** (`servicoRealizado` e `texto`) mais até 3 anexos. O vet fazia um ultrassom, escrevia um parágrafo, anexava o laudo, e nada daquilo virava dado clínico no prontuário do pet.

Agora a anotação aceita **campos direcionados ao tipo de serviço** do acesso, e o tutor pode **importar** o resultado para o prontuário (vira consulta, prescrição, lembrete de exame, registro de peso, documento).

Isso já foi integrado em dois canais:

- **App mobile**, na tela do parceiro autenticado
- **Site público** (`petjourney.health/prestador`), onde o vet sem conta entra com código de 6 dígitos

O **portal do parceiro não foi integrado**, porque é outro repositório e não temos acesso. É o que este documento pede.

**Nada quebra se vocês não fizerem nada.** A mudança é retrocompatível: quem manda só os dois campos antigos continua funcionando, recebe 201, e a anotação aparece para o tutor. A consequência de não integrar é outra: o parceiro que usa o portal entrega prosa, enquanto o que usa o app entrega dado estruturado que o tutor consegue importar com um toque. Mesma empresa, qualidade diferente conforme o canal.

---

## As rotas que vocês já consomem

Base: `/parceiro/portal/compartilhamentos`
Auth: JWT + guard de parceiro. Nada muda aqui.

| Método | Caminho | O que faz |
|---|---|---|
| POST | `/vincular` | Reivindica o acesso pelo código de 6 dígitos |
| GET | `/` | Lista os acessos vinculados à empresa |
| GET | `/:id` | Detalhe do acesso, com o snapshot do pet e as anotações |
| POST | `/:id/anotacoes` | **Cria a anotação. É aqui que muda.** |
| GET | `/:id/anexos/:anexoId/url` | Signed URL temporária do anexo |

---

## A mudança: `POST /:id/anotacoes`

O corpo é **multipart/form-data** (por causa dos anexos). Os campos antigos continuam iguais:

```
empresaNome         texto, até 200
profissionalNome    texto, até 200, opcional
servicoRealizado    texto, até 1000
texto               texto, até 10000
files               até 3 arquivos
tiposDocumento      JSON string, array paralelo aos arquivos
```

**O que é novo:** campos estruturados, todos opcionais, cujo conjunto válido depende do `tipoServico` do acesso (você já recebe esse campo no `GET /:id`).

### Campos por tipo de serviço

| `tipoServico` | Campos aceitos |
|---|---|
| `EXAME` | `tipoExame`, `laudoTexto`, `dataResultado` |
| `CONSULTA` | `motivo`, `diagnostico`, `pesoKg`, `prescricaoItens`, `examesSolicitados` |
| `BANHO` | `produtos`, `condicaoPele`, `comportamento` |
| `TOSA` | `produtos`, `condicaoPele`, `comportamento` |
| `HOTEL` | `dataEntrada`, `dataSaida`, `alimentacao`, `comportamento`, `intercorrencias` |
| `OUTRO` | nenhum. Segue só com o formulário livre |

**Campo enviado para o tipo errado é rejeitado com 400**, não ignorado. Mandar `pesoKg` num acesso de banho significa formulário errado, e engolir o dado esconderia o bug.

### Formato dos campos no multipart, e a armadilha

Esta é a parte que mais dá errado, então está explícita:

**Escalares vão como texto simples.** `motivo`, `diagnostico`, `pesoKg`, `tipoExame`, `laudoTexto`, `dataResultado`, `produtos`, `condicaoPele`, `comportamento`, `dataEntrada`, `dataSaida`, `alimentacao`, `intercorrencias`.

**As duas listas vão como JSON string**, com `JSON.stringify`. São `prescricaoItens` e `examesSolicitados`.

```js
// CERTO
form.append('motivo', 'Vomito ha 2 dias');
form.append('pesoKg', '12.4');
form.append('prescricaoItens', JSON.stringify([
  { nome: 'Omeprazol', dose: '10', unidade: 'mg', frequencia: '1x ao dia', duracaoDias: 7 },
  { nome: 'Ondansetrona', instrucoes: 'Se vomitar de novo' },
]));
form.append('examesSolicitados', JSON.stringify([
  { nome: 'Hemograma', observacao: 'Em jejum' },
]));

// ERRADO, e falha em SILÊNCIO: responde 201 e a lista não é salva
form.append('prescricaoItens[0][nome]', 'Omeprazol');
form.append('prescricaoItens', { nome: 'Omeprazol' });
```

O parser lê a lista com `JSON.parse` do valor do campo. Se vier em campos repetidos ou como objeto, ele não encontra o campo, **não** dá erro, e a lista chega vazia no banco. A anotação é criada sem a prescrição e ninguém percebe. JSON malformado, por outro lado, devolve 400 com o nome do campo.

**Campo ausente não deve ir no form.** É assim que o backend distingue "não mandou" (cliente antigo) de "mandou vazio". Se o valor for vazio, nulo ou lista sem itens, omita o campo.

### Formato dos itens das listas

`prescricaoItens[]`:

```
nome          obrigatório, até 200
dose          opcional, até 200
unidade       opcional, até 50
frequencia    opcional, texto livre ("12/12h", "1x ao dia")
duracaoDias   opcional, inteiro
instrucoes    opcional, até 1000
```

`examesSolicitados[]`:

```
nome          obrigatório, até 200
observacao    opcional, até 1000
```

**Sobre `frequencia`, e vale explicar para a UI:** quando o tutor importa a anotação, ele pode escolher transformar cada remédio em Medicamento ativo do pet. Item **sem frequência não pode** virar Medicamento (a regra clínica exige) e é silenciosamente pulado nessa etapa, embora a prescrição entre normalmente. Ou seja: preencher frequência aumenta o valor do que vocês enviam. Vale destacar o campo na tela.

### Limites e validações

```
anexos             máximo 3 por anotação
MIME aceito        image/jpeg, image/png, image/webp, image/heic, application/pdf
tiposDocumento     'Receita Medica', 'Exame de Sangue', 'Raio-X', 'Ultrassom', 'Outro'
pesoKg             0.01 a 500
datas              ISO 8601
```

---

## O que ler no `GET /:id`

O payload da anotação **sempre** devolve os campos estruturados e as duas listas, mesmo vazias. Vocês não precisam de branch entre anotação antiga e nova.

```json
{
  "id": "cm...",
  "empresaNome": "CenterVet",
  "profissionalNome": "Dra. Ana",
  "servicoRealizado": "Consulta de rotina",
  "texto": "Retorno em 15 dias.",
  "motivo": "Vomito ha 2 dias",
  "diagnostico": "Gastrite",
  "pesoKg": 12.4,
  "tipoExame": null,
  "laudoTexto": null,
  "dataResultado": null,
  "prescricaoItens": [ { "nome": "Omeprazol", "dose": "10", "unidade": "mg", "frequencia": "1x ao dia", "duracaoDias": 7, "instrucoes": null } ],
  "examesSolicitados": [ { "nome": "Hemograma", "observacao": "Em jejum" } ],
  "anexos": [ { "id": "cm...", "nome": "laudo.pdf", "mimeType": "application/pdf", "tipoDocumento": "Ultrassom" } ]
}
```

Anotação criada antes desta mudança vem com os escalares em `null` e as listas vazias. Renderize sem quebrar.

---

## O que construir no portal

**1. Formulário que muda conforme o `tipoServico`.** Você já recebe o tipo no detalhe do acesso. Mostre só os campos daquele tipo, e nenhum campo clínico em banho, tosa ou hotel.

**2. Listas dinâmicas** para prescrição e exames solicitados: adicionar e remover item. Sem limite artificial baixo.

**3. Todos os campos novos opcionais.** O que é obrigatório hoje continua sendo o único obrigatório. O prestador com pressa precisa conseguir salvar rápido, como sempre fez.

**4. Nada de campo clínico em `OUTRO`.** Mantenha o formulário livre atual.

Referência de implementação, se ajudar: no app mobile o formulário está em `src/features/compartilhamento-prestador/AnotacaoEstruturadaForm.tsx`, e a montagem do multipart em `services/compartilhamento-parceiro/compartilhamento-parceiro-service.ts`, na função `appendEstruturado`. É a versão que já funciona contra este backend.

---

## Como validar a integração

**Contrato:** `GET https://petjourney-api-dev.up.railway.app/api-json`. Procure o DTO da anotação e confira os campos.

**Teste real que pega o erro mais comum:** crie uma anotação de acesso `CONSULTA` com 2 itens de prescrição, e depois releia com `GET /:id`. Se `prescricaoItens` voltar vazio, o multipart está no formato errado, mesmo tendo recebido 201. Esse é o único jeito de detectar, porque não há erro.

**Não confie na tela para isso.** Se o formulário exibir os itens a partir do estado local, ele mostra o que você digitou independentemente do que o servidor salvou. A verificação tem que ser a releitura.

---

## Estado do backend

Em produção: schema completo (as três tabelas novas e as colunas da anotação), validação por tipo, e a rota de importação do tutor.

Verificação: 108 suítes e 1423 testes passando, typecheck e lint limpos.

Dúvidas de contrato podem vir para cá. O que ainda não existe é ambiente de teste dedicado ao portal: hoje a validação é contra a API de dev.
