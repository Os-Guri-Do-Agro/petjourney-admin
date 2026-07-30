# Contrato: medicamentos e documentos na importação da anotação

**Para:** quem integra o app (petjourney-app)
**Status:** backend pronto, aguardando app
**Data:** 2026-07-29

> Nota: `docs/` está no `.gitignore` deste repo. Este arquivo existe no disco e não vai para o GitHub.

---

## O que mudou

A rota de importação continua a mesma:

```
POST /tutor/compartilhamentos-prestador/{id}/anotacoes/{anotacaoId}/importar
```

Ela já criava consulta, prescrição, lembrete de exame, peso e anexo de consulta. Agora ela **também pode** criar duas coisas que o tutor vê em tela própria:

- **Medicamento do pet** (`TratamentoFixo`), a partir de cada item de prescrição
- **Documento do pet**, a partir de cada anexo

As duas são **opt-in por chamada**, com default desligado. Quem não mandar as flags continua com o comportamento exato de antes.

## Request

Dois campos novos, ambos opcionais e booleanos:

```json
{
  "data": "2026-07-28T09:00:00.000Z",
  "dataPrevistaExames": "2026-08-04T09:00:00.000Z",
  "criarMedicamentos": true,
  "salvarAnexosNosDocumentos": true
}
```

| Campo | Default | Efeito |
|---|---|---|
| `criarMedicamentos` | `false` | Cada item de prescrição **com frequência** também vira Medicamento do pet |
| `salvarAnexosNosDocumentos` | `false` | Cada anexo também vira Documento do pet |

## Response

O objeto `criados` ganhou dois contadores:

```json
{
  "jaImportado": false,
  "tipoServico": "CONSULTA",
  "consultaId": "cm...",
  "servicoRealizadoId": null,
  "criados": {
    "consultaExame": false,
    "prescricaoItens": 2,
    "lembretesExame": ["cm..."],
    "pesoRegistroId": "cm...",
    "anexosCopiados": 1,
    "anexosComFalha": 0,
    "medicamentos": 1,
    "documentos": 1
  }
}
```

---

## A ARMADILHA, e é o motivo deste documento existir

O app compara a prévia com `criados` e avisa o tutor quando entra menos do que foi prometido. Isso está certo. Mas:

**`medicamentos` pode ser MENOR que `prescricaoItens`, e isso NÃO é falha.**

Item de prescrição sem frequência não pode virar Medicamento: a regra clínica exige frequência, e o prestador pode ter deixado o campo vazio. Nesse caso o item **entra como prescrição** (o dado não se perde) e **é pulado** como Medicamento.

Exemplo real: uma anotação com "Omeprazol, 1x ao dia" e "Ondansetrona, se vomitar de novo" devolve `prescricaoItens: 2` e `medicamentos: 1`. Está correto.

Se o app tratar isso como importação parcial, vai avisar o tutor de um problema que não existe, em todo atendimento em que o vet não preencheu frequência.

**O que fazer:** para calcular a expectativa de `medicamentos`, conte apenas os itens de prescrição **que têm frequência preenchida**. Esse número é conhecido pelo app, porque a prévia já lista os itens com seus campos.

## Outros comportamentos que o app precisa refletir

**`documentos` conta anexo que já estava salvo.** Se o tutor apertou Salvar naquele arquivo antes de importar, o backend trata como "já está lá" e conta como sucesso. Não é duplicata e não é erro.

**Reimportar é no-op.** Com `jaImportado: true`, os contadores vêm zerados (exceto reprocessamento de anexo que falhou antes). Não interprete zero como falha nesse caso.

**Falha de documento não desfaz a consulta.** O upload roda fora da transação. Se o storage falhar, a consulta permanece e `documentos` vem menor. O registro clínico nunca é revertido por causa de arquivo.

**Tratamento sem data de fim.** Item sem `duracaoDias` gera Medicamento sem data de término, igual ao fluxo próprio do tutor. Ele encerra quando quiser.

---

## O que o app precisa construir

**Duas chavinhas na tela de confirmação da importação**, ambas desligadas por padrão. Sugestão de copy, ajuste ao tom do app:

- "Adicionar os remédios à lista de Medicamentos do pet"
- "Salvar os arquivos nos Documentos do pet"

Por que desligado por padrão, e por que a decisão é do tutor: um antibiótico de 7 dias virando Medicamento ativo continua aparecendo na lista depois de terminar, e se o tutor já tinha aquele remédio cadastrado passa a ter dois. Só ele sabe se quer isso.

**Vale desabilitar a chavinha de medicamentos** quando nenhum item da prescrição tiver frequência, já que nesse caso ela não teria efeito. Opcional, mas evita a confusão de ligar e não ver nada.

## Sobre `tipoDocumento`

Não precisa mandar. O backend usa o `tipoDocumento` que o próprio anexo já tem (o prestador pode ter classificado como laudo ou receita) e cai em "Outro" só quando ele não informou nada.

Se você quiser dar ao tutor a chance de **corrigir** essa classificação na tela de confirmação, faz sentido, mas como edição do valor que já veio, não como campo vazio.

---

## Como validar contra o backend

O Swagger reflete o contrato:

```
GET https://petjourney-api-dev.up.railway.app/api-json
```

Procure `ImportarAnotacaoDto`: precisa listar `criarMedicamentos` e `salvarAnexosNosDocumentos`.

Estado da verificação no backend: typecheck e lint limpos, 108 suítes e 1423 testes passando, com 19 testes novos cobrindo as duas flags. As duas foram desligadas de propósito para confirmar que 5 desses testes falham sem a implementação.

Não exercitado ainda: o fluxo contra o Postgres real. Existe `scripts/smoke-importacao-anotacao.ts` para isso.
