# Spec: lembrete de vacina pedido pela clínica

**Para:** Nicolas (API) · **De:** Luís (portal) · **Card de origem:** E4-04 (lista de chamada) ·
**Data:** 17/11/2026 · **Lacuna:** N42

## 1. O que o portal precisa

Na **lista de chamada** (Vacinas → Lista de chamada), cada pet é um cartão com uma caixa por vacina
que falta. Em cada caixa há um botão **"Ativar lembrete"**: a recepção liga, e o responsável é
lembrado **no app** de que aquela vacina venceu ou está para vencer. O cartão passa a mostrar
"Lembrete ativo", e a mesma gaveta deixa desligar.

Hoje a API não deixa a clínica pedir isso. O que existe:

- `VACINA_REFORCO_PROXIMO` (guia e4 4.3): o cron diário avisa **uma vez por aplicação**, quando o
  reforço de uma dose **aplicada na clínica** entra nos 30 dias. A clínica não pede, não vê se saiu,
  e ele não cobre a vacina **vencida**, a dose de **outro lugar** nem a repetição.
- Ao aplicar, a publicação cria no app o lembrete da próxima dose com a data da clínica (E2-04).
  Isso é do app do responsável; a clínica não liga nem desliga.
- Os avisos da clínica (`AvisoDaClinicaDto`) cobrem só agenda, fila e pré-consulta.

**O que o portal faz até a rota existir** (`src/service/parceiro/lembrete-de-vacina-service.ts`,
`LEMBRETE_NA_API = false`): o lembrete fica marcado **só no navegador** de quem ligou, e a gaveta
diz isso com todas as letras ("o envio pelo app começa quando a API tiver a rota"). Nada sai para o
app. A rota abaixo já está escrita no serviço, atrás da constante.

## 2. As rotas pedidas

```
POST   /parceiro/portal/clinica/aplicacoes/:id/lembrete?parceiroId=<id>   → 201 LembreteDaVacinaDto
DELETE /parceiro/portal/clinica/aplicacoes/:id/lembrete?parceiroId=<id>   → 204
```

- `:id` é a `aplicacaoId` do item da lista de chamada (a dose vigente que está cobrando).
- Corpo do `POST`: `{}` (sem opções nesta primeira versão; ver seção 6).
- Mesmo padrão de `.../aplicacoes/:id/anular`: o recurso é a aplicação, o verbo no caminho.
- `POST` de novo com o lembrete já ligado: **200** com o mesmo lembrete (idempotente, sem envio novo).
- `DELETE` sem lembrete ligado: **204** (o resultado que a pessoa queria já é verdade).

### `LembreteDaVacinaDto`

```json
{
  "aplicacaoId": "cmw7a0jem00010pp8m2ak1qvg",
  "ligadoEm": "2026-11-17T11:05:31-03:00",
  "ligadoPorId": "usr_...",
  "ultimoEnvioEm": "2026-11-17T11:05:40-03:00",
  "proximoEnvioEm": "2026-12-06T09:00:00-03:00",
  "envios": 1,
  "entrega": "ENTREGUE"
}
```

- `ultimoEnvioEm`: nulo até o primeiro sair.
- `proximoEnvioEm`: nulo quando não há mais envio previsto.
- `entrega`: o mesmo enum do `AvisoDaClinicaDto.entrega` (`PENDENTE`, `SO_NA_CAIXA`, `ENVIADO`,
  `ENTREGUE`, `FALHOU`), do último envio; nulo antes do primeiro.

## 3. Na leitura da lista de chamada

`ChamadaDto` (em `GET /parceiro/portal/clinica/vacinas/chamada`) ganha dois campos:

| Campo | Tipo | Para quê |
|---|---|---|
| `lembrete` | `LembreteDaVacinaDto \| null` | O cartão mostra "Lembrete ativo" e o último envio sem outra leitura. |
| `responsavelNoApp` | `boolean` | Sem canal no app, o portal troca o botão por "Ligue para o telefone do cadastro" em vez de deixar ligar e dar 409. |

Quando os dois entrarem, o portal troca `LEMBRETE_NA_API` para `true` e lê o estado daqui (some o
estado do navegador).

## 4. Regras

| Regra | Comportamento |
|---|---|
| Quem pode | Módulo CLÍNICA com escrita e `agenda.escrever` (quem chama de volta: DONO, GESTOR, RECEPÇÃO, VETERINÁRIO). Sem a permissão: 403 `SEM_PERMISSAO` com `permissao: "agenda.escrever"`. |
| Qual dose | Só a aplicação **vigente** que está na lista de chamada (`VENCIDO`, `SERIE_INCOMPLETA`, `PROXIMO`), da origem `CLINICA` ou `EXTERNA`. Fora disso (em dia, anulada, não vigente): 409 `LEMBRETE_FORA_DA_CHAMADA`. |
| Sem canal | Pet sem vínculo ativo com um responsável que tem o app: 409 `SEM_CANAL_NO_APP` (o mesmo motivo dos avisos da agenda). |
| Primeiro envio | Na hora, pelo mesmo despacho dos avisos da clínica. Se o `VACINA_REFORCO_PROXIMO` da mesma aplicação saiu nas últimas 24 h, o primeiro envio não sai de novo (o responsável acabou de receber) e conta como feito. |
| Repetição | **Uma** vez mais, se a dose ainda faltar: no dia da próxima dose (`proximaDoseEm`), quando ela ainda está no futuro; se já venceu, 7 dias depois do primeiro envio. Máximo de 2 envios por lembrete. |
| Para sozinho | Dose da mesma vacina aplicada ou registrada no paciente; aplicação anulada; paciente inativo, com óbito ou mesclado; vínculo encerrado. O lembrete sai da lista junto com o item. |
| Desligar | Para os próximos envios; o que já saiu fica no aparelho do responsável. |
| Teto | Entra no teto de 6 avisos de vacina por pet por dia (guia e4 4.3). Passou do teto: não sai, e `entrega` diz por quê no rastro. |
| Rastro | Cada envio entra no rastro de avisos da clínica (`GET /parceiro/portal/clinica/avisos`) com tipo novo `VACINA_LEMBRETE_DA_CLINICA`, `automatico: false` no primeiro e `true` na repetição, `enviadoPorId` de quem ligou e um campo `aplicacaoId`. |
| Auditoria | Ligar e desligar entram na trilha do paciente (quem, quando), sem conteúdo. |

## 5. A notificação

| Tipo | Quando | Copy (pt) | Rota no app |
|---|---|---|---|
| `VACINA_LEMBRETE_DA_CLINICA` (novo) | A clínica ligou o lembrete (e a repetição) | Vencida: "Vacina de {pet} atrasada" / "Uma vacina registrada pela clínica passou da data. Abra a carteirinha para ver." · A vencer: "Vacina de {pet} chegando" / "Uma vacina registrada pela clínica vence em {dia}. Abra a carteirinha para ver." | `/screens/vacina/lista`, com `?petId=` na `url` dos dados |

- **Sem nome de vacina nem de clínica no push** (P8 da receita, como o `VACINA_REFORCO_PROXIMO`).
  A prévia na gaveta do portal já mostra exatamente esse texto.
- `dados`: `{ parceiroId, petId, petNome, aplicacaoId, proximaDoseEm, url }`.
- No app, o tipo novo entra em `rotas-notificacao.ts` nos três mapas, como o `VACINA_REFORCO_PROXIMO`
  (`AFETA_HOME_POR_TIPO: false`, `PERFIL_POR_TIPO: "tutor"`).
- Textos nos 6 idiomas (os do portal, em `vacinas.lembrete.push.*`, servem de base).

## 6. Erros

| `codigo` | Status | Quando | Extra |
|---|---|---|---|
| `SEM_PERMISSAO` | 403 | Sem `agenda.escrever` | `permissao` |
| `LEMBRETE_FORA_DA_CHAMADA` | 409 | A dose não está cobrando (em dia, anulada, não vigente) | `situacao` |
| `SEM_CANAL_NO_APP` | 409 | Pet sem responsável com o app | |
| (sem `codigo`) | 403 | Aplicação de outra clínica ou inexistente | |

## 7. Fora desta versão (para decidir depois)

- **Escolher quando avisar** (`antecedenciaDias` no corpo, ex. 7 ou 3 dias antes). Hoje o portal
  não pede; o corpo vazio deixa espaço.
- **Ligar em lote** ("lembrar todos os vencidos"). Se vier, o mesmo padrão de
  `spec-dias-especiais-em-lote.md` (`POST .../lembretes/ligar` com `{ aplicacaoIds }`).

## 8. E o "Editar registro"?

O mesmo cartão ganhou um menu "…" com **Ver detalhes**, **Editar registro** e **Apagar registro**.
A API não edita uma aplicação (guia e4 3.5: "nada se apaga"), então o portal faz assim, sem rota
nova:

- **Ver detalhes**: lê `GET /parceiro/portal/pacientes/:id/vacinas` e mostra a dose (quem aplicou,
  lote, via, se foi ao app, observação) e as anteriores.
- **Apagar registro**: `POST .../aplicacoes/:id/anular` com o motivo, como na ficha.
- **Editar registro**: anula com o motivo e leva à ficha com a gaveta de aplicar aberta na mesma
  vacina (`?aplicar=vacina&vacina=<id>`), para registrar a certa. O responsável vê "Registro
  corrigido pela clínica" (`CLINICA_ANULOU_REGISTRO`).

**Pergunta para o produto:** vale ter uma edição de verdade para o que não muda a conta (observação,
via, código do lote digitado à mão)? Se sim: `PATCH /parceiro/portal/clinica/aplicacoes/:id`
`{ observacao?, via?, motivo }` (motivo de 5 a 500, na trilha), e vacina, dose, data e lote do
estoque continuam só por anular e registrar de novo. Sem isso, o "Editar registro" fica como está.
