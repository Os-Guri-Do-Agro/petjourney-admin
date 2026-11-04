# Spec: remover dias especiais em lote

**Para:** Nicolas (API) · **De:** Luís (portal) · **Card de origem:** E1-01 (Estabelecimento) ·
**Data:** 04/11/2026

## 1. O que o portal precisa

Na aba **Horários** do Estabelecimento, a lista de dias especiais acumula rápido: os feriados
nacionais de dois anos já são uns 20 dias, mais os dias avulsos da casa, e todo ano os que já
passaram ficam na lista. O dono pediu um **"Apagar vários"**: marcar os dias (ou "os que já
passaram", de uma vez) e apagar numa ação só.

Hoje a API só tem a remoção de um dia por vez:

```
DELETE /parceiro/portal/estabelecimento/dias-especiais/:id   → 204
```

Até a rota de lote existir, o portal manda **um DELETE por dia, quatro de cada vez**
(`removerDiasEspeciais` em `src/service/parceiro/estabelecimento-service.ts`). Funciona, mas:

- apagar 20 dias são 20 requisições, cada uma com sua checagem de dono e seu evento de auditoria
  soltos no tempo;
- se a conexão cai no meio, parte sai e parte fica, e a tela tem de contar "15 saíram, 5 não";
- encosta no limite de requisições por minuto de quem apaga muitos dias.

## 2. A rota pedida

```
POST /parceiro/portal/estabelecimento/dias-especiais/remover?parceiroId=<id>
Content-Type: application/json

{ "ids": ["cmx1...", "cmx2...", "cmx3..."] }
```

**Por que `POST .../remover` e não `DELETE` com corpo:** `DELETE` com corpo é ignorado por alguns
proxies e CDNs e não tem semântica garantida no HTTP. `DELETE ?ids=a,b,c` esbarra no tamanho da URL
com algumas centenas de ids. O `POST` com verbo no caminho é o mesmo padrão de
`.../dias-especiais/feriados-nacionais` e `.../publicar`.

### Resposta 200

No envelope de sempre (`{ statusCode, message, data }`):

```json
{
  "removidos": ["cmx1...", "cmx3..."],
  "naoEncontrados": ["cmx2..."]
}
```

- `removidos`: os ids que existiam neste estabelecimento e saíram agora.
- `naoEncontrados`: os ids que não existem, que já tinham saído, ou que são de outro parceiro. **Não
  é erro**: o resultado que a pessoa queria (o dia fora da lista) já é verdade.

## 3. Regras

| Regra | Comportamento |
|---|---|
| Quem pode | Só o DONO, como o `DELETE` de um dia. OPERADOR: 403 `ESTABELECIMENTO_APENAS_DONO`. |
| Cadastro suspenso | 409 `PARCEIRO_CADASTRO_SUSPENSO`, como as outras escritas do Estabelecimento. |
| Parceiro | Só os dias do parceiro do contexto (`?parceiroId=`). Id de outro parceiro vai para `naoEncontrados` e **não é apagado**, sem revelar que existe. |
| Corpo | `ids`: array de 1 a 500 strings não vazias. Vazio, mais de 500 ou item que não é string: 400 do validador (o mesmo formato dos outros 400 sem `codigo`). |
| Repetidos | Ids repetidos contam uma vez só (deduplicar antes). |
| Atomicidade | Uma transação: buscar os ids do parceiro que existem, apagar esses (`deleteMany` com `id in` **e** o parceiro), devolver os dois grupos. Ou sai tudo o que existe, ou nada. |
| Idempotência | Repetir o mesmo pedido devolve 200 com tudo em `naoEncontrados`. O duplo clique não dá erro. |
| Auditoria (E1-05) | Um evento por dia removido, igual ao do `DELETE` de um dia, para a trilha da Equipe listar cada dia que saiu. Se a auditoria do `DELETE` grava `ALTERAR` com `campos: ['excluido']` (ver lacuna N7), manter o mesmo aqui. |
| Efeitos | Os mesmos do `DELETE` de um dia: o "aberto agora" e a página pública (cache de 60 s) passam a seguir a semana nessas datas. |
| Limite de requisições | O mesmo das outras escritas do Estabelecimento. |

## 4. Contrato (`contrato/openapi.json`)

Para o portal gerar os tipos em vez de escrever à mão:

```ts
// corpo
class RemoverDiasEspeciaisDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(500)
  @IsString({ each: true }) @IsNotEmpty({ each: true })
  ids: string[]
}

// resposta (dentro do envelope)
class RemocaoDeDiasEspeciaisDto {
  removidos: string[]
  naoEncontrados: string[]
}
```

Com `summary` no padrão das vizinhas: "Remove varios dias especiais de uma vez (DONO); os que nao
existem voltam em naoEncontrados".

Nenhum `codigo` novo, então nenhuma mensagem nova nos 6 idiomas.

## 5. Testes sugeridos (API)

1. DONO remove 3 dias do próprio parceiro: 200, `removidos` com os 3, `naoEncontrados` vazio, e os
   3 somem do `GET /parceiro/portal/estabelecimento`.
2. Um id que não existe no meio: ele volta em `naoEncontrados`, os outros saem.
3. Id de um dia de **outro** parceiro: volta em `naoEncontrados` e o dia do outro parceiro continua lá.
4. Ids repetidos: removidos uma vez, sem erro.
5. Mesmo pedido duas vezes: a segunda devolve tudo em `naoEncontrados`.
6. OPERADOR: 403 `ESTABELECIMENTO_APENAS_DONO`, nada removido.
7. Cadastro suspenso: 409 `PARCEIRO_CADASTRO_SUSPENSO`, nada removido.
8. `ids: []`, 501 ids, `ids: [1]`: 400.
9. Auditoria: um evento por dia removido, com o mesmo formato do `DELETE` de um dia.

## 6. O que muda no portal quando a rota existir

Só a função `removerDiasEspeciais` (`src/service/parceiro/estabelecimento-service.ts`): em vez dos
DELETE em paralelo, um `POST .../dias-especiais/remover` com os ids. O retorno dela já tem a forma
certa (`removidos` e o que não saiu), então a tela, os avisos e os testes de tela não mudam. O
`naoEncontrados` da API conta como removido, como o 404 conta hoje.

## 7. Fora deste pedido

- Remover "todos os que já passaram" sem mandar ids (`{ antesDe: 'AAAA-MM-DD' }`). O portal já marca
  os passados na tela; se o volume crescer, vale como segunda rota.
- Editar vários dias de uma vez (trocar o horário de vários feriados). Ninguém pediu.
