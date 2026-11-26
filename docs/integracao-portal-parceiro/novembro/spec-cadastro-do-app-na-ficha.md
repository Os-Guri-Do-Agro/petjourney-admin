# Spec: o cadastro do pet no app preenche a ficha da clínica

Pedido do Luís em 25/11/2026, achado no teste do guia de fluxos (lacuna N65).

## 1. O problema

Quando o responsável liga um pet do app a uma clínica, a ficha da clínica continua com "Não informado" em
"Dados do paciente": nascimento, castrado, porte, peso, microchip e pelagem. Isso acontece mesmo com tudo
preenchido no pet do app. O print anexado ao card é do Thor (conta `luis.qa.tutor`, Clínica e Hotel Demo):
o pet foi ligado pelo app e a ficha seguiu vazia.

Hoje os dados só andam em um sentido:

- **Da clínica para o app:** o `CRIAR` da resposta à proposta cria o pet no app com nome, espécie, raça,
  sexo, nascimento, porte e castração da clínica (guia e2, 2.3).
- **Do app para a clínica:** no `LIGAR`, nada do cadastro do pet vai para a clínica. Nenhuma rota do portal
  devolve esses dados: o `GET .../pacientes/:id/vinculo` não traz o pet, e o `GET .../app/carteirinha` traz
  só vacinas, alergias, diagnósticos e tratamentos.

A recepção precisa digitar de novo o que o responsável já cadastrou no app.

## 2. O que o Luís quer

Com o vínculo ativo, a API preenche o cadastro do paciente da clínica com o cadastro do pet no app, sem
nunca apagar ou trocar o que a clínica digitou.

## 3. Regras

### 3.1 Quais campos

| Ficha da clínica (`PacienteDto`) | Pet do app | Observação |
|---|---|---|
| `nascimento` | `dataNascimento` | Só a data (AAAA-MM-DD). `nascimentoEstimado` fica `false`. |
| `sexo` | `sexo` | `MACHO` ou `FEMEA`. |
| `raca` | `dogInfo.raca`, `catInfo.raca` e os `*Info.raca` das outras espécies | Texto como veio. |
| `castrado` | `dogInfo.castrado`, `catInfo.castrado` | Só as espécies que têm o campo no app. |
| `porte` | `dogInfo.porte` | `PEQUENO`, `MEDIO` e `GRANDE` são os mesmos valores nos dois lados. |
| `pelagem` | `cor` | Texto como veio. |
| `microchip` | `microchip.codigo` | Decisão D1. |
| `pesoKg` | o último `peso-registro` do responsável | Decisão D2. |

Nome e espécie não entram: o nome é o da clínica, e o `LIGAR` já exige a mesma espécie.

### 3.2 Quando preencher

1. **Ao ligar:** no `POST /tutor/clinica/vinculos-propostos/:id/responder` com `LIGAR`, e no aceite das propostas
   por QR e por acesso temporário. Isso vale para cada pet que ficou ligado.
2. **Quando o responsável muda o pet no app:** se ele muda um desses campos no `PATCH /pet/:id` com o vínculo ativo,
   o novo valor chega a cada clínica ligada a esse pet, segundo a regra 3.3.
3. **Uma vez para os vínculos que já existem:** um script (ou migration de dados) preenche os vínculos ativos hoje, para a
   ficha do Thor e das outras ligadas antes desta entrega não precisar de um vínculo novo.

### 3.3 Nunca trocar o que a clínica digitou

Cada campo da lista guarda de onde veio o valor atual: `CLINICA` ou `APP`.

- **Campo vazio na clínica:** recebe o valor do app e fica `APP`.
- **Campo `APP`:** acompanha o app enquanto o vínculo estiver ativo. Se o responsável corrige a castração no app, a ficha muda.
- **Campo `CLINICA`:** o app nunca mexe. Isso vale para o que a clínica preencheu no cadastro, na importação ou no `PATCH`.
- **A clínica edita um campo `APP`** pelo `PATCH /parceiro/portal/pacientes/:id`, inclusive para limpar: ele passa a
  `CLINICA` e o app não mexe mais nele.
- **O app limpa um campo:** um campo `APP` fica vazio; um campo `CLINICA` não muda.
- **O vínculo acaba** (encerrado por um dos lados, pet transferido, conta em exclusão, paciente mesclado ou com óbito):
  o que já veio fica na ficha e para de atualizar.
- **O mesmo pet ligado a duas clínicas:** cada ficha é preenchida à parte, com a mesma regra.

### 3.4 Trilha

Cada preenchimento ou atualização vindo do app fica na auditoria do paciente (`GET .../pacientes/:pacienteId/auditoria`).
Grave um evento por gravação, por exemplo `DADOS_DO_APP`, com os campos, o valor de antes e o de depois. O autor é
"app do responsável", e não um membro da equipe.

## 4. Contrato

- **`PacienteDto` ganha `camposDoApp`:** `Array<'nascimento' | 'sexo' | 'raca' | 'castrado' | 'porte' | 'pelagem' | 'microchip' | 'pesoKg'>`,
  com os campos que hoje são `APP`. O portal usa isso para marcar "do app" ao lado do valor. Lista vazia quando não há
  nenhum.
- **Com D2 aceita:** `pesoDoAppEm` (data do registro) quando `pesoKg` é `APP`, para o portal mostrar "de casa, 25/11".
- **Sem rota nova para o portal:** a ficha (`GET .../pacientes/:id`) já devolve os valores preenchidos.
- **Nenhum código de erro novo:** o preenchimento não pode fazer o `responder`, o `PATCH /pet/:id` ou o `peso-registro`
  falhar. Se o preenchimento der erro, registre no log e siga; o script da regra 3.2.3 pode rodar de novo.
- Atualizar o `contrato/openapi.json`.

## 5. Decisões

- **D1, microchip.** No `CRIAR` ele fica só na clínica. Do app para a clínica, a recomendação é **trazer**: o
  responsável cadastrou para ser encontrado, e a clínica busca paciente por microchip.
- **D2, peso.** O `pesoKg` da ficha é usado na dose por peso (bulário). A recomendação é **trazer só com a chave `peso`
  ligada e só quando o campo estiver vazio ou for `APP`**, e mandar `pesoDoAppEm`. Peso aferido na clínica (atendimento
  ou edição) vira `CLINICA` e ganha sempre. Se preferir não mexer no peso, deixe `pesoKg` fora: o peso de casa já
  aparece no resumo do app.
- **D3, aviso ao responsável.** Ao ligar, a tela de aceite do app diz o que a clínica passa a receber. A frase sugerida
  para o app (o Luís faz) é: "A clínica recebe também o cadastro do pet: nascimento, sexo, raça, castração, porte,
  pelagem e microchip." Nenhuma chave de consentimento nova: é o mesmo nível da carteirinha, que só pede o vínculo.

## 6. Testes

- **Given** pet no app com nascimento, sexo, raça, castrado, porte, cor e microchip, e paciente da clínica vazio,
  **When** o responsável liga, **Then** a ficha traz os sete campos, `camposDoApp` lista os sete e a auditoria tem `DADOS_DO_APP`.
- **Given** paciente com `castrado: false` digitado pela clínica e pet com `castrado: true` no app, **When** liga,
  **Then** a ficha segue `false` e `castrado` não está em `camposDoApp`.
- **Given** campo `APP`, **When** o responsável muda o valor no app, **Then** a ficha muda.
- **Given** campo `APP`, **When** a clínica edita pelo `PATCH`, **Then** ele sai de `camposDoApp` e a próxima mudança
  no app não chega.
- **Given** vínculo encerrado, **When** o responsável muda o pet, **Then** a ficha não muda e mantém o que já veio.
- **Given** o mesmo pet ligado a duas clínicas, uma com `porte` digitado, **When** o responsável muda o porte,
  **Then** só a ficha da outra clínica muda.
- **Given** vínculo ativo de antes da entrega, **When** o script roda, **Then** os campos vazios são preenchidos, e
  rodar de novo não muda nada.
- **(D2) Given** chave `peso` desligada, **Then** `pesoKg` não vem do app; **When** liga a chave, **Then** o último peso
  de casa preenche o campo vazio.
- **Given** um erro no preenchimento, **Then** o `responder` e o `PATCH /pet/:id` respondem como antes.

## 7. Pronto quando

- O preenchimento e a atualização estão no dev, com `camposDoApp` no `contrato/openapi.json`.
- O script rodou no dev, e a ficha do Thor (paciente `cmwwk2cyv012h0prvd68xix9w`, na hora ainda sem vínculo) se
  preenche ao ligar de novo pelo app.
- Depois disso, o Luís marca "do app" no portal e põe a frase da D3 na tela de aceite do app.
