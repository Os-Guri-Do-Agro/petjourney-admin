<!-- doc cmvkfnms9000taod2aghcgrnz · "Handoff: lacunas L1 a L6 e a Q2 (rotas e formatos)" · atualizado 2026-10-23T04:14:30.972Z · card PJ-49U4QS -->

# Handoff: lacunas L1 a L6 e a Q2 (respostas aos cards de 22/10)

**Para:** Luís (portal, app e site)
**API:** no `develop` e na API de dev desde 22/10 (commit `b8d5c2b`, CI verde). Produção só quando o Nicolas subir o `develop` para o `master`.
**Contrato:** `contrato/openapi.json` do `develop` do `petjourney-api`. Copie para o front e gere os tipos de novo.
**Specs (anexadas nos cards):**
- `contrato-openapi-completo.md` (L1 a L4)
- `acesso-temporario-aberturas-para-o-responsavel.md` (L5)
- `ficha-de-emergencia-por-qr.md` (L6)

Os cards da board dizem o que fazer. Este documento diz como, com as rotas e os formatos.

---

## L1. Erros pelo código, no contrato (portal e app)

- O contrato passa a ter o schema `ErroDaApiDto` (em `components.schemas`, mesmo sem rota que o cite) e o enum `CodigoClinico`.
- O enum junta os códigos clínicos e os do portal: `EQUIPE_*`, `CONVITE_*`, `ESTABELECIMENTO_*`, `MODULO_*`, `PARCEIRO_*`, `PROFISSIONAL_*`, `LIMITE_PETS_PLANO` e os 3 novos da emergência.
- Decida a tela por `codigo` (o corpo do erro é `{ statusCode, message, error, codigo, timestamp, path }`), nunca pelo texto de `message`, que vem traduzido.
- Um teste na API reprova código novo que não entre no enum, então a lista não volta a ficar para trás.

## L2. Campos que podem ser nulos (portal e app)

- Os campos `string | null`, `number | null` e `boolean | null` agora saem com o tipo certo. Antes saíam como `{ "type": "object" }` e viravam `Record<string, never> | null`.
- Exemplos: `CriarPacienteDto.especieOutra`, `.raca`, `EntradaDiarioCompartilhadaDto.nota`, `SnapshotPetCompartilhadoDto.pesoKg`, `DocumentoCompartilhadoDto.dataEmissao`.
- Gere os tipos de novo e apague os contornos (`as string`, tipos à mão). O `openapi:conferir` do CI da API reprova campo nulo sem forma daqui em diante.

## L3. Rotas do portal com resposta tipada (portal)

- As 30 rotas de `/parceiro/portal` que saíam sem schema agora têm. Exemplos: `GET /compartilhamentos` e `/{id}`, `/dashboard`, `/status`, `/cadastro`, `/saques`, `/carteira/extrato`, `/indicados`, `/compartilhamentos/reivindicacoes`.
- O detalhe do acesso (`AcessoParceiroDetalheDto`) é uma classe só para as duas formas, decididas por `status`:
  - **ATIVO:** traz `snapshot`, `ficha` (só quando há o que dizer), `categorias`, `mensagemTutor`, `petCastrado`, `snapshotAtualizadoEm` e todas as anotações.
  - **EXPIRADO ou REVOGADO:** traz `snapshot: null` e `revogadoEm`, e só as anotações da própria empresa.
- `POST .../{id}/leitura-receita` responde 202 (leitura nova) ou 200 (reaproveitada), nunca 201.
- Rota nova do portal sem schema de resposta passa a reprovar o CI da API.

## L4. O tipo do pet OUTRO no acesso temporário (portal, site e app do vet)

- Campo novo `tipoEspecie` (texto ou `null`): o que o responsável digitou para um pet `OUTRO` (por exemplo, "furão"). `especie` e `especieLabel` não mudaram.
- Aparece em:
  - `GET /parceiro/portal/compartilhamentos` (lista) e `GET /parceiro/portal/compartilhamentos/{id}` (detalhe);
  - `GET /prestador/acesso/{codigo}` (a página do acesso no site e o app do vet);
  - a ficha de emergência (L6).
- Como mostrar: quando `especie === 'OUTRO'` e `tipoEspecie` vier preenchido, mostre `tipoEspecie` no lugar de `especieLabel`; senão, `especieLabel`.
- Acessos criados antes de 22/10 de pet OUTRO já vêm preenchidos (a migration copiou).

## L5. Quem abriu o acesso temporário (app do responsável)

`GET /tutor/compartilhamentos-prestador/{id}/aberturas`. Só o dono do acesso; outro usuário recebe 403.

```json
{
  "visitas": { "total": 3, "primeiraEm": "2026-10-22T13:02:11.000Z", "ultimaEm": "2026-10-22T18:40:03.000Z" },
  "arquivos": [
    {
      "arquivoNome": "Hemograma.pdf",
      "origem": "DOCUMENTO",
      "canal": "PARCEIRO",
      "abertoEm": "2026-10-22T18:41:00.000Z",
      "parceiro": { "nome": "Clínica Boa Vista" }
    }
  ]
}
```

- `visitas` conta quantas vezes a página do acesso foi aberta por quem **não** é o responsável: pelo código (site ou app do vet) ou pelo detalhe do portal. Não guarda IP nem quem foi.
- `arquivos` lista até 100 pedidos de arquivo, os mais novos primeiro.
  - `canal: "PUBLICO"` é o prestador sem conta, pelo código: não há nome para mostrar.
  - `canal: "PARCEIRO"` é pelo portal, e aí vem `parceiro.nome`.
- **Texto:** o registro prova que o arquivo foi **pedido**, não que alguém leu. Escreva "pediu o arquivo", nunca "leu" ou "viu".
- Acesso criado antes de 22/10 começa com `total: 0`.

**Onde entra:** no detalhe do acesso temporário do app, uma seção "Quem abriu", com:
- a linha das visitas ("Aberto 3 vezes, a última hoje às 15:40");
- a lista dos arquivos pedidos ("Clínica Boa Vista pediu Hemograma.pdf, hoje às 15:41"; no canal público, "Pelo código: pediu Hemograma.pdf").

## L6. Ficha de emergência pelo QR

### Portal (o veterinário)

`POST /parceiro/portal/emergencia/ficha` (`?parceiroId=` quando o usuário está em mais de um parceiro), corpo `{ "publicSlug": "...", "motivo": "..." }`. Responde 200 com:

```json
{
  "acessoId": "cmh2k9...",
  "petNome": "Rex",
  "foto": null,
  "especie": "CACHORRO",
  "tipoEspecie": null,
  "sexo": "MACHO",
  "castrado": true,
  "nascimento": "2020-05-10",
  "peso": { "kg": 12.4, "em": "2026-10-01T12:00:00.000Z" },
  "alergias": [{ "gatilho": "Dipirona", "categoria": "MEDICAMENTOSA", "reacao": "edema", "severidade": "GRAVE" }],
  "tratamentosContinuos": [{ "medicamento": "Fenobarbital", "dose": "30", "unidade": "mg", "frequencia": "12/12h", "via": "oral" }],
  "condicoes": [{ "categoria": "NEUROLOGICA", "subtipo": "epilepsia" }]
}
```

- **De onde vem o `publicSlug`:** do QR da coleira. É o mesmo slug da carteirinha pública, o final da URL que o QR abre.
- **Motivo:** obrigatório, de 10 a 300 caracteres (por exemplo, "atropelamento, chegou inconsciente"). O responsável lê esse motivo, então peça um texto que ele entenda.
- **Quem pode:** só quem tem um profissional ligado ao próprio login, com CRMV conferido pelo admin. O selo é o mesmo da tela de profissionais (E1-03).
- **Erros, por `codigo`:**

| Status | `codigo` | Tela |
|---|---|---|
| 403 | `EMERGENCIA_SEM_CRMV_CONFERIDO` | Explicar que precisa do CRMV conferido, com o caminho para a tela de profissionais |
| 404 | `EMERGENCIA_FICHA_INDISPONIVEL` | "Ficha indisponível para este QR". Não diga o motivo: a API devolve o mesmo 404 para QR inexistente, pet inativo, ficha desligada pelo responsável, pet sem responsável e clínica bloqueada |
| 429 | `EMERGENCIA_LIMITE` | Limite do dia (10 por pessoa e 30 por clínica em 24 h) |
| 400 | (validação) | Motivo curto ou longo demais |

- A ficha não traz nada do responsável (nem nome, nem contato). Quem liga é ele: a API avisa na hora e mostra o telefone da clínica no app dele.
- **Fluxo sugerido:**
  1. "Emergência pelo QR" no portal;
  2. ler o QR com a câmera ou colar o link;
  3. escrever o motivo;
  4. "Abrir ficha";
  5. mostrar a ficha, com a nota "O responsável foi avisado agora".

### App (o responsável)

- **Primeiro passo, que pode ir já (4 linhas em `services/notificacao/rotas-notificacao.ts`):**
  - acrescente `"EMERGENCIA_FICHA_ABERTA"` ao tipo `TipoNotificacao`;
  - nos três mapas, ponha `ROTA_POR_TIPO: ROTA_INBOX` (até a tela existir), `AFETA_HOME_POR_TIPO: false` e `PERFIL_POR_TIPO: "tutor"`.
  - O app publicado já cai na caixa de entrada pela `url` que a API manda, mas o mapa é um `Record` completo. O hook `audit-rotas-notificacao` da API acusa esse tipo, e os 12 da onda do portal, até entrarem.
- **Aviso:** notificação nova `EMERGENCIA_FICHA_ABERTA`, com `dados: { petId, petNome, acessoId }`.
  - Ela fura o opt-out de lembretes e a janela da noite, porque é o controle da abertura.
  - Hoje ela abre `/screens/notifications`. Quando a tela abaixo existir, mande a rota para o Nicolas trocar na API (`ROTA_POR_TIPO`).
- **Lista de acessos de emergência do pet:** `GET /tutor/emergencia/pets/{petId}/acessos`. Só o dono do pet; família e outros recebem 403.

```json
{
  "liberada": true,
  "acessos": [
    {
      "id": "cmh2k9...",
      "abertoEm": "2026-10-22T03:12:00.000Z",
      "motivo": "atropelamento, chegou inconsciente",
      "clinica": { "parceiroId": "cmgx7f...", "nome": "Clínica Boa Vista", "telefone": "6533334444", "bloqueada": false },
      "profissionalNome": "Dra. Ana",
      "profissionalCrmv": "CRMV-MT 12345"
    }
  ]
}
```

- `clinica.nome` e `clinica.telefone` são os da hora da abertura: a clínica não consegue trocar depois.
- Ponha um botão "Ligar" no telefone.
- **Desligar ou religar a ficha do pet:** `PUT /tutor/emergencia/pets/{petId}/ficha` com `{ "liberada": false }` ou `true`. A ficha nasce ligada.
  - Explique o que desligar significa: nenhuma clínica abre, nem numa emergência de verdade.
- **Bloquear uma clínica:** use a rota que já existe do vínculo, `POST /tutor/clinica/clinicas/{parceiroId}/bloquear` (e `DELETE` para desbloquear), com o `parceiroId` da lista.
  - O bloqueio vale para a ficha e para propostas de vínculo dessa clínica.
  - Depois de bloquear, recarregue a lista: `bloqueada` vem `true`.
  - É a saída para "não quero que esta clínica abra de novo", sem desligar a ficha para todas.
- **Onde entra:** na tela do pet, "Ficha de emergência". Ela mostra o interruptor, a lista e, em cada linha, os botões "Ligar" e "Bloquear clínica".

---

## Q2. Aviso no campo do código de indicação (app e site)

O Nicolas decidiu: **sim**. A pessoa que usa o código de um parceiro é avisada de que ele vai ver o nome dela e se ela assinou.

- **Onde:**
  - app: `app/(auth)/register.tsx`, logo abaixo do campo "Código de indicação";
  - site: `src/components/cadastro/SignupForm.tsx`, no mesmo lugar.
- **Quando:** sempre que o campo aparece, e não só depois que a pessoa digita.
- Sem mudança na API e sem aceite a registrar.

| Idioma | Texto |
|---|---|
| pt-BR | O parceiro dono deste código vai ver seu nome e se você assinou um plano. |
| en-US | The partner who owns this code will see your name and whether you subscribe to a plan. |
| en-GB | The partner who owns this code will see your name and whether you subscribe to a plan. |
| es-419 | El socio dueño de este código verá tu nombre y si contrataste un plan. |
| sr-Latn | Partner kome pripada ovaj kod videće vaše ime i da li ste se pretplatili na plan. |
| ar | سيرى الشريك صاحب هذا الرمز اسمك وما إذا كنت قد اشتركت في خطة. |

Com o aviso publicado, a tela de indicados do app e a do portal podem ir para todos.

---

## Mudanças da API que não pedem tela nova

- **`POST .../anotacoes`** (portal e app do vet) passou a devolver `profissionalEspecialidade`.
  - O app avisava "especialidade indisponível" mesmo com ela salva (`compartilhamento-detalhe.tsx:1219`).
  - O aviso para de aparecer sozinho, com a API nova.
- **Anexo visto pelo prestador** (canal público, portal e resposta da anotação): não traz mais `salvoNosDocumentos` nem `documentoId`, que dizem o que o responsável fez com o arquivo.
  - O app do vet só converte esses campos com valor padrão, e nenhuma tela do prestador os mostra.
  - Pode apagar dos tipos do prestador.
  - O payload do responsável segue com os dois.
- **`GET /parceiro/portal/saques/{id}`:** o OPERADOR passa a receber a chave PIX com só os 4 últimos caracteres, como já era no `GET /carteira`.
- **Página do acesso no site** (`GET /prestador/acesso/{codigo}`): o contrato agora documenta `anotacoes`.
- **Item do snapshot:** o contrato agora documenta `tituloLabel` (diagnósticos e comportamento) e `detalheLabel` (alergias).
