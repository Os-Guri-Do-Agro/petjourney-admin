<!-- doc cmstsa7z8004d1hqf4sx2xgxd · "2026 08 14 carteirinha campos vet e diagnostico" · atualizado 2026-08-15T02:55:40.772Z · card PJ-VZEBKP -->

# Task — Carteirinha: campos pedidos pelo veterinário + diagnóstico de uma palavra

**Origem:** veterinário usuário do app mandou a lista de campos que ele preenche na ficha de cadastro dele, e apontou que o diagnóstico na carteirinha "aparece só uma palavra, fica meio sem sentido".
**Status:** não iniciada — levantamento feito, implementação não começou.
**Depende de:** backend (2 campos novos no pet) + decisão de produto (3 itens na §4).
**Arquivo-fonte do PDF:** [`utils/carteirinha-pdf.ts`](../../utils/carteirinha-pdf.ts)
**Preview sem device:** `npm run preview:carteirinha`
**Spec viva do PDF:** [`2026-07-17-carteirinha-pdf-refino.md`](./2026-07-17-carteirinha-pdf-refino.md)

---

## 1. Parte A — campos da ficha do veterinário

Lista que ele mandou, conferida um a um contra o que a carteirinha já imprime hoje:

| Campo pedido | Situação | Onde está / o que falta |
|---|---|---|
| Nome completo do responsável | ✅ já sai | `tutor.usuario.nome`. Ver §4.1: o app não garante nome **completo**. |
| **Endereço** | ⚠️ existe, mas não chega no PDF | `GET /endereco?usuarioId=` já existe e tem flag `principal`. É endereço **do tutor**, não do pet, e hoje `petCard.tsx` não carrega. Trabalho é de app, não de backend. |
| Nome do paciente | ✅ já sai | capa + letterhead |
| Espécie | ✅ já sai | grade de identificação |
| Sexo | ✅ já sai | grade de identificação |
| Idade / data nascimento | ✅ já sai | os dois, em campos separados |
| Raça | ✅ já sai | vem de `dogInfo.raca` / `catInfo.raca` / `*.tipoEspecie` |
| **Cor** | ❌ não existe | não existe no modelo do pet. Precisa de backend. |
| **Temperamento** | ❌ não existe | idem. Ver §4.2, é decisão de produto antes de ser campo. |
| Castrado(a)? | ✅ já sai | grade de identificação |
| Peso aproximado | ✅ já sai | "Peso atual" |

**8 dos 11 já saem.** O trabalho real são 3: `cor`, `temperamento` e `endereço`.

### 1.1 Brinde de custo quase zero: `porte`

`porte` (`dogInfo.porte`, valores tipo `GRANDE`) **já existe no modelo, já é preenchido no cadastro e já tem chave de i18n nos 4 idiomas** (`pet.carteirinha.fields.size`), mas nunca foi renderizado no PDF. Mesma coisa vale para os campos por espécie que também têm chave e nunca aparecem: `band` (anilha), `wingClipped` (asa cortada), `livesInCage`, `waterType`, `aquarium`.

Vale entrar junto: é dado clínico útil (dose por porte) e não custa backend nenhum.

---

## 2. Parte B — o diagnóstico de uma palavra

### O que acontece

O subtipo é **opcional** no formulário ("Mais detalhe (opcional)"). Quando o tutor não preenche, o título do diagnóstico vira só o rótulo da categoria:

| O que o tutor escolheu | O que a carteirinha mostra |
|---|---|
| `DERMATOLOGICA` sem subtipo | **"Pele"** |
| `CARDIO` sem subtipo | **"Coração"** |
| `RENAL` sem subtipo | **"Rim"** |
| `HEPATICA` sem subtipo | **"Fígado"** |
| `ENDOCRINA` sem subtipo | **"Hormonal"** |
| `OUTRA` sem subtipo | **"Outra"** ← não informa absolutamente nada |

Numa carteirinha entregue a um veterinário, "Pele" não é um diagnóstico: é um sistema do corpo. E "Outra" é literalmente ausência de informação ocupando uma linha do documento.

### Onde o texto é montado (o mesmo bug em 5 telas)

Duas funções produzem esse título, e **as duas precisam do mesmo tratamento** — corrigir só o PDF deixa o app inconsistente:

- `src/features/saude-estruturada/format.ts` → `formatDiagnosticoTitulo()` — usada por `DiagnosticoCard`, `DiagnosticoSheet`, `TratamentoFixoSheet`
- `utils/carteirinha-pdf.ts` → `diagnosticoTitulo()` — usada pelo PDF
- `app/carteirinha/[slug].tsx` (carteirinha pública) e `app/screens/petCard.tsx` também exibem diagnóstico

### Caminhos possíveis (escolher na §4.3, não decididos aqui)

1. **Rótulos que já são frase.** "Pele" → "Problema de pele", "Coração" → "Problema no coração". Resolve em todas as telas de uma vez, sem tocar em dado nem em backend. **Custo:** os rótulos são compartilhados com chips, filtros e o seletor do formulário, onde "Problema de pele" fica comprido demais. Talvez precise de par curto/longo.
2. **Subtipo obrigatório quando a categoria é genérica** (`OUTRA` no mínimo, talvez `DERMATOLOGICA`/`ENDOCRINA` também). Resolve o dado na origem, mas só para registros novos — o legado continua com uma palavra.
3. **Fallback de exibição:** sem subtipo, usar a primeira linha de `observacoes` como complemento do título. Barato, não muda dado, mas depende de o tutor ter escrito observação.
4. **Combinação:** 1 para o legado + 2 para o novo.

> Seja qual for a escolha, ela mexe em copy visível → 4 locales (pt, en, en-GB, es) e revisão de tom para público leigo.

---

## 3. Escopo por camada

### Backend (bloqueia a Parte A)
- [ ] `cor` no pet — texto livre ou lista fechada? (§4.2)
- [ ] `temperamento` no pet — idem
- [ ] Decidir se ficam no pet base ou nos `*Info` por espécie (hoje `raca`/`porte` moram nos `*Info`)
- [ ] Expor em `GET /pet/:id/all-info`, que é o que a carteirinha consome

### App
- [ ] Formulários: `addPet.tsx` e `editPetProfile.tsx`
- [ ] Exibição: `petProfile.tsx`, `petCard.tsx`
- [ ] PDF: grade de identificação em `utils/carteirinha-pdf.ts` (+ `porte`, §1.1)
- [ ] Endereço do tutor: carregar em `petCard.tsx` e passar para `exportAsPDF` (endereço `principal`)
- [ ] Carteirinha pública `app/carteirinha/[slug].tsx` — decidir se endereço entra (§4.4)
- [ ] Snapshot do prestador (`compartilhamento-prestador`) — decidir se os campos novos vão junto
- [ ] Parte B nas duas funções de título + i18n nos 4 locales

---

## 4. Decisões pendentes (produto)

1. **"Nome completo".** O cadastro não obriga sobrenome; o PDF imprime o que existe. Passa a exigir nome completo no cadastro, ou aceita o que tem?
2. **Temperamento é texto livre ou aviso de manejo?** Para o veterinário, o valor clínico está em "morde / precisa de focinheira / precisa de sedação", não em "brincalhão". Se for aviso de manejo, o lugar dele na carteirinha é junto do alerta de alergia, não na grade de identificação. Isso muda o desenho e o tipo do campo.
3. **Qual caminho para o diagnóstico** (§2, opções 1 a 4).
4. **Endereço na carteirinha pública.** A carteirinha pública é acessível por QR, por qualquer um que escaneie. Endereço residencial do tutor ali é exposição de dado pessoal. Proposta: endereço **só no PDF** (que o tutor compartilha deliberadamente), nunca na página pública nem no snapshot do prestador. Precisa de confirmação.

---

## 5. Critérios de aceite

- [ ] Os 11 campos da lista do veterinário aparecem no PDF, ou têm recusa registrada com motivo
- [ ] Campo sem valor mostra "Não informado" (regra que já vale na grade), nunca em branco
- [ ] Nenhum diagnóstico exibido como palavra solta em nenhuma das 5 telas
- [ ] `OUTRA` sem subtipo nunca é exibido como "Outra"
- [ ] Paridade de i18n nos 4 locales, 0 em-dash em texto visível
- [ ] `npm run preview:carteirinha` nas 4 fixtures × 4 locales: nenhuma folha vazia nova, sem regressão na contagem de páginas (a grade de identificação vai de 8 para até 11 campos, o que empurra a paginação)
- [ ] Typecheck no baseline de 11 erros, lint limpo, `pj-audit.sh` limpo
- [ ] Exportado em device (iOS e Android) — o harness não substitui isso

---

## 6. Notas de risco

- A grade de identificação cresce de 8 para até 11 campos (12 com `porte`). São 2 linhas a mais na primeira folha do miolo, o que muda onde as seções seguintes quebram. Rodar o preview **antes e depois** e comparar a contagem de páginas.
- Qualquer campo novo do pet tem que entrar em **6 superfícies**: cadastro, edição, perfil, PDF, carteirinha pública e snapshot do prestador. Auditar todas antes de fechar — campo que só entra no PDF vira dado invisível no app.
