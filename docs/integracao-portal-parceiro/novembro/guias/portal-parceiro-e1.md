<!-- doc cmvtxvj9x00yqulbu7bwk · "Handoff E1-07: portal-parceiro-e1.md" · atualizado 2026-10-30T17:16:44.902Z · card PJ-2OPCOW -->

# Guia do front: Portal do parceiro, onda 1 (perfil do estabelecimento e módulos)

**Para:** o Luís. Portal web do parceiro (`petjourney-admin`), o CMS (`petjourney-cms`) e, para as notificações novas, o app (`petjourney-app`).
**Backend:** pronto e validado em dev em 2026-10-21. **Não está em produção.**
**Specs de origem:**
- `docs/specs/2026/q4/q4-1/portal-parceiro/e1-fundacao/01-perfil-publico-do-estabelecimento.md` (v0.2)
- `docs/specs/2026/q4/q4-1/portal-parceiro/e1-fundacao/02-modulos-do-parceiro.md`

**Contrato:** `contrato/openapi.json`; gere os tipos dele. Convenções iguais às da onda 0 ([portal-parceiro-e0.md](portal-parceiro-e0.md), seção 1):
- envelope `{ statusCode, message, data }`;
- erro com `codigo` e `message` localizada;
- `?parceiroId=` quando o usuário tem mais de um parceiro.

---

## 1. Perfil do estabelecimento (E1-01)

### 1.1 Tela "Meu estabelecimento" (portal)

`GET /parceiro/portal/estabelecimento` (qualquer membro):

```json
{
  "perfil": { "nomePublico": "...", "descricao": null, "idiomaDosTextos": "pt-BR", "fusoHorario": "America/Cuiaba",
              "telefonePublico": "6533334444", "whatsappPublico": null, "telefonePlantao": null, "emailPublico": "...",
              "site": null, "cep": "78000000", "logradouro": "...", "numero": "10", "complemento": null, "bairro": "...",
              "cidade": "Cuiabá", "uf": "MT", "pais": "BR", "latitude": -15.6014, "longitude": -56.0979, "mostrarMapa": true,
              "mensagemForaDoHorario": null, "orientacaoEmergencia": null, "publicado": true, "publicadoEm": "..." },
  "slug": "clinica-boa-vista",
  "horarios": [{ "diaSemana": 0, "fechado": true, "abre": null, "fecha": null, "intervaloInicio": null, "intervaloFim": null }, ...],
  "diasEspeciais": [{ "id": "...", "data": "2026-12-25", "nome": "Natal", "fechado": true, "abre": null, "fecha": null }],
  "visivelPublicamente": true,
  "pendenciasParaPublicar": [],
  "funcionamento": { "abertoAgora": true, "fechaEm": "2026-10-21T18:00:00-04:00", "proximaAbertura": null },
  "podeEditar": true
}
```

**Campos do retorno:**
- `perfil` é `null` antes do primeiro salvamento.
- `pendenciasParaPublicar` lista o que impede publicar:
  - `APROVACAO` (cadastro ainda não aprovado);
  - `nomePublico`;
  - `fusoHorario`;
  - `telefone` (vale qualquer um dos três).
- `podeEditar` vem pronto. É `false` para OPERADOR e para parceiro suspenso: a tela fica só leitura, com o botão de despublicar.

**Rotas de escrita** (só DONO):

| Ação | Rota | Observação |
|---|---|---|
| Salvar perfil | `PUT /parceiro/portal/estabelecimento` | Corpo inteiro (o que não vier vira null). `fusoHorario` IANA de uma lista (use `Intl.supportedValuesOf('timeZone')`); nunca offset fixo. Na primeira vez a API cria o slug a partir do nome |
| Horários | `PUT /parceiro/portal/estabelecimento/horarios` `{ dias: [7 itens] }` | Um item por dia (0 domingo a 6 sábado). Dia fechado: `fechado: true`. 24 h: `00:00` a `24:00`. Virar a meia-noite: dois dias |
| Dia especial | `POST .../dias-especiais` `{ data: 'YYYY-MM-DD', nome, fechado, abre?, fecha? }` | 201; mesma data de novo dá 409 |
| Remover dia | `DELETE .../dias-especiais/:id` | 204 |
| Feriados nacionais | `POST .../dias-especiais/feriados-nacionais` `{ ano }` | `{ copiados, jaExistiam }`. Hoje há 2026 e 2027 (Brasil); outro ano dá 404 `ESTABELECIMENTO_FERIADOS_INDISPONIVEIS` |
| Trocar endereço da página | `PUT .../slug` `{ slug }` | 3 a 60 caracteres `a-z 0-9 -`; o antigo continua abrindo a página |
| Publicar | `POST .../publicar` | 409 `ESTABELECIMENTO_NAO_APROVADO`; 400 `ESTABELECIMENTO_INCOMPLETO` com `faltando` |
| Despublicar | `POST .../despublicar` | Vale mesmo com o parceiro suspenso |

**Validação no formulário** (a API valida igual e responde 400):
- telefone com DDD ou E.164 (a API guarda só os dígitos);
- CEP com 8 dígitos;
- UF com 2 letras;
- site com `https://`;
- latitude de -90 a 90 e longitude de -180 a 180.

**Revisão de segurança (2026-10-21):**
- **Endereço na página pública:** campo `mostrarEndereco` (boolean) no `PUT /parceiro/portal/estabelecimento`, que também volta em `perfil.mostrarEndereco`.
  - Rótulo sugerido: "Mostrar rua e número na página pública". Ajuda: "Desligado, a página mostra só bairro, cidade e UF, sem mapa."
  - Vet autônomo começa com o campo desligado.
  - Omitido no PUT, o valor gravado se mantém.
- **Slug só depois da aprovação:**
  - até lá, `slug: null`, e `PUT .../slug` responde 409 `ESTABELECIMENTO_NAO_APROVADO`;
  - com o cadastro em análise, desabilite a troca com: "O endereço da página fica disponível depois que o cadastro for aprovado.";
  - ao trocar, avise: "O endereço antigo continua levando à página. Guardamos os 5 últimos." O sexto libera o mais antigo.
- **Datas:** dia especial e feriado com data que não existe (`2026-13-01`, `2026-02-31`) dão 400.

**Troca de fuso:** troque o `utcOffset` fixo do mock pelo fuso IANA em toda tela que mostra horário do estabelecimento. A API devolve os instantes com o offset do dia (`-03:00`, `-04:00`, `+01:00` no verão de Londres): mostre como vierem, sem converter para o fuso do navegador.

### 1.2 Página pública (no site; Q2 decidida em 22/10)

**Decisão do Nicolas (Q2):** a página pública fica no **site**, e a gestão fica no **portal**.
- **Site (`petjourney.health`):** `/agendar/<slug>` (clínica) e `/reservar/<slug>` (hotel). É a página que hoje está no portal (`src/components/publico/PaginaPublica.vue`), levada para o Next. O pedido de horário e de reserva sem conta e o acompanhamento por token (`/pedido/<token>`, `/reserva/<token>`) também ficam no site, quando a E3-05 e a E7-03 saírem na API.
- **Portal:** a tela "Meu estabelecimento" (1.1) e um bloco "Sua página pública" com o link e o QR, que apontam para o site. As páginas `/agendar` e `/reservar` do portal saem quando as do site estiverem no ar, ou viram a pré-visualização dentro do editor.

**Novo em 22/10, atenção: ponte para o app.** Quem já tem a PetJourney deve pedir pelo app: o pedido pelo app usa o pet do app e ativa o vínculo com a clínica; o pedido pelo site cria um cadastro solto lá.
- **Site:** na página, o botão "Já usa a PetJourney? Peça pelo app". Ele abre `petjourneyapp://agendar/<slug>` (ou `petjourneyapp://reservar/<slug>`); se o app não abrir em uns 2 s, leva a `/baixar-app`. Não use `https://petjourney.health/...` no botão: o iOS não abre o app a partir de um link do mesmo domínio em que a pessoa já está.
- **App:** rotas `agendar/[slug]` e `reservar/[slug]` que abrem a tela de pedido daquela clínica ou hotel, pelas rotas `GET /tutor/clinica/estabelecimentos/:slug/agendamento-online` e `GET /tutor/hotel/estabelecimentos/:slug/reserva-online`. Deslogado: entra e volta para o pedido. No perfil de parceiro: pede para trocar para o de responsável. Slug que não existe: mensagem e volta para a home, nunca "rota não encontrada".
- **Ainda não:** `/agendar/*` e `/reservar/*` nos links que abrem o app sozinho (`apple-app-site-association` do site e `intentFilters` do `app.json`). Quem tiver uma versão antiga do app cairia em "rota não encontrada". Fica para quando a versão nova estiver na loja há algumas semanas.

`GET /public/estabelecimentos/:slug`, sem login, 30 por minuto por IP:

```json
{
  "slug": "clinica-boa-vista", "slugAtual": null,
  "nome": "...", "descricao": "...", "idiomaDosTextos": "pt-BR", "fusoHorario": "America/Cuiaba",
  "contatos": { "telefone": "...", "whatsapp": null, "telefonePlantao": null, "email": "...", "site": null },
  "endereco": { "cep": "...", "logradouro": "...", "numero": "...", "complemento": null, "bairro": "...", "cidade": "...", "uf": "MT", "pais": "BR" },
  "localizacao": { "latitude": -15.6014, "longitude": -56.0979 },
  "mensagemForaDoHorario": null, "orientacaoEmergencia": null,
  "horarios": [...7 dias...],
  "diasEspeciais": [...só os próximos 60 dias...],
  "abertoAgora": true, "fechaEm": "...", "proximaAbertura": null
}
```

- **`slugAtual` preenchido:** a página foi aberta por um endereço antigo. Redirecione para `/<slugAtual>` com `replace`.
- **`localizacao: null`:** a clínica escolheu não mostrar o mapa, ou não tem coordenadas.
- **`abertoAgora: null`:** não há horário cadastrado. Não mostre "fechado" nesse caso.
- **404 genérico:** slug desconhecido, página não publicada ou parceiro suspenso. A tela é a mesma nos três casos.
- **Troca de rota:** `/publico/...` vira `/public/...`.
- **Cache no site (Next):** renderizar no servidor faz todo pedido sair do mesmo IP e bater no limite de 30 por minuto. Use ISR ou cache de 60 s no site; a API já guarda 60 s.
- **Idiomas:** os rótulos da página nos 6 idiomas, com o en-GB explícito.
- **Textos livres** (`descricao`, `mensagemForaDoHorario`, `orientacaoEmergencia`) vêm no idioma em que a clínica escreveu (`idiomaDosTextos`). Não traduza.

### 1.3 Códigos de erro (E1-01)

| `codigo` | Status | Tela |
|---|---|---|
| `ESTABELECIMENTO_APENAS_DONO` | 403 | Esconder a edição para OPERADOR (`podeEditar`) |
| `PARCEIRO_CADASTRO_SUSPENSO` | 409 | Parceiro suspenso: só leitura |
| `ESTABELECIMENTO_FUSO_INVALIDO` | 400 | Fuso fora da lista |
| `ESTABELECIMENTO_HORARIO_INVALIDO` | 400 | O corpo traz `diaSemana` (ou `data`) e `problema`: `ABRE_DEPOIS_DE_FECHA`, `INTERVALO_FORA_DO_EXPEDIENTE`, `INTERVALO_INCOMPLETO`, `ABRE_E_FECHA_OBRIGATORIOS`, `HORA_INVALIDA`, `SEMANA_INCOMPLETA`. Marque o dia certo |
| `ESTABELECIMENTO_DIA_ESPECIAL_JA_EXISTE` | 409 | Já há dia especial na data |
| `ESTABELECIMENTO_DIA_ESPECIAL_NAO_ENCONTRADO` | 404 | Recarregar |
| `ESTABELECIMENTO_FERIADOS_INDISPONIVEIS` | 404 | Ano ou país sem catálogo |
| `ESTABELECIMENTO_SLUG_INVALIDO` | 400 | Formato ou palavra reservada |
| `ESTABELECIMENTO_SLUG_EM_USO` | 409 | Escolher outro |
| `ESTABELECIMENTO_NAO_APROVADO` | 409 | "Publica depois da aprovação do cadastro" |
| `ESTABELECIMENTO_INCOMPLETO` | 400 | O corpo traz `faltando`: destaque os campos |
| `PUBLIC_PAGE_NOT_FOUND` | 404 | Página pública indisponível |

---

## 2. Módulos do parceiro (E1-02)

Clínica e Hotel passam a ser ligados no servidor. Acaba o interruptor `?clinico=on` / `?hotel=on`, que abria as telas para qualquer conta.

### 2.1 Portal: menu e pedido de módulo

- **Menu:** `GET /parceiro/portal/modulos` (`?parceiroId=` quando houver mais de um parceiro). Também vem dentro do `GET /parceiro/portal/eu` (seção 4.3).
  - Resposta: `{ parceiroId, modulos, elegiveis }`. `modulos` traz sempre CLINICA e HOTEL, nessa ordem; módulo nunca pedido vem com `status: null`.
  - Cada item: `modulo, status, ativoAte, podeLer, podeEscrever, motivoSomenteLeitura, podeSolicitar`.
  - Mostre Clínica ou Hotel quando `podeLer`.
  - Com `podeLer` e sem `podeEscrever`, mostre o aviso de "só consulta" conforme `motivoSomenteLeitura`: `MODULO_SUSPENSO`, `MODULO_DESLIGADO`, `PRAZO_VENCIDO` ou `PARCEIRO_NAO_OPERACIONAL`.
  - O botão "pedir módulo" aparece só com `podeSolicitar`; não recalcule no front.
  - `elegiveis` é sugestão pela categoria do cadastro, para destacar um módulo. Não é trava.
- **Pedir módulo** (só DONO): `POST /parceiro/portal/modulos/{clinica|hotel}/solicitar` responde 201 `{ modulo, status: 'SOLICITADO' }`. Erros, sempre com `codigo` no corpo:
  - 403 `MODULO_APENAS_DONO`;
  - 409 `MODULO_JA_SOLICITADO`, `MODULO_JA_ATIVO`, `MODULO_REATIVACAO_PELO_SUPORTE` ou `PARCEIRO_NAO_OPERACIONAL`.
- **Rotas de Clínica e Hotel:** 403 `MODULO_INATIVO` (sem módulo) ou `MODULO_SOMENTE_LEITURA` (com `reason`). O corpo traz `codigo`, `reason` e `modulo`.
- **Remover do portal:**
  - `useModuloOculto`, `useModuloClinico` e `useModuloHotel`;
  - o parâmetro `?clinico=on` / `?hotel=on` e a guarda do `router/index.ts` baseada nele (a guarda passa a usar o mesmo GET);
  - `CLINICAL_MENU_DEMO` / `HOTEL_MENU_DEMO`;
  - o `hasVeterinarioProfile()` como critério de menu.
- **Mock:** `features/clinico/data` e `features/hotel/data` saem do build de produção (só dev ou conta de demonstração).

### 2.2 CMS: ligar, suspender e desligar

- **Tela de módulos na ficha do parceiro:** `GET /admin/parceiro/{id}/modulos`. Mostra status, origem, prazo, quem pediu e quando, a última decisão e o motivo, além de `podeLer`/`podeEscrever`, `operacional` e `elegiveis`.
- **Decidir:** `POST /admin/parceiro/{id}/modulos/{clinica|hotel}` `{ status, origem?, ativoAte?, motivo }`.
  - `status`: `TESTE`, `ATIVO`, `SUSPENSO`, `DESLIGADO` ou `REJEITADO`.
  - `origem`: `ADMIN` ou `TESTE_GRATUITO`, obrigatória em TESTE e ATIVO.
  - `ativoAte`: ISO no futuro; sem ele, o módulo fica sem prazo.
  - `motivo`: 5 a 500 caracteres.
  - Resposta 200 `{ modulo, status, origem, ativoAte, protocolo }`, protocolo `MOD-AAAA-NNNNNN` (o `toastProtocolo` existente serve). Transição que não vale: 409 `MODULO_TRANSICAO_INVALIDA`.
- **Vet autônomo:** ligar a Clínica de um parceiro de categoria `VETERINARIO` já cria a ficha de profissional do DONO (seção 4.3). Avise isso na tela de decisão.
- Ainda não há fila de pedidos entre parceiros. Se o CMS precisar, a rota é nova (pedir à API).

### 2.3 App: dois avisos novos no inbox

- Tipos `PARCEIRO_MODULO_VENCENDO` e `PARCEIRO_MODULO_SUSPENSO`.
- Em `services/notificacao/rotas-notificacao.ts`, acrescente os dois ao union `TipoNotificacao` e aos mapas:
  - `ROTA_POR_TIPO`: `ROTA_INBOX` (`/screens/notifications`). O módulo vive no portal web; o app não tem tela dele;
  - `AFETA_HOME_POR_TIPO`: `false`;
  - `PERFIL_POR_TIPO`: `null` (o inbox abre nos dois perfis).
- Em `app/screens/notifications.tsx`, `ICONES_POR_TIPO`: sugestão `HourglassIcon` (vencendo) e `PauseCircleIcon` (suspenso).
- A copy vem pronta do backend nos 6 idiomas. `dados` = `{ parceiroId, parceiroNome, modulo, ativoAte, diasRestantes? }`.
- O `audit:notificacao-rotas` da API reprova até o app ganhar os dois tipos.
- Os dois avisos também saem por e-mail para o DONO, porque o portal web não tem inbox nem push.

---

## 3. Contrato das rotas novas (E1-04), para portal e app

Vale para toda rota nova de Clínica e Hotel, a partir da onda 2.

- **Erro:**
  - decida a tela pelo `codigo` (enum `CodigoClinico` no contrato, schema `ErroDaApiDto`);
  - a `message` é só para mostrar, já no idioma do `Accept-Language`;
  - os 13 códigos do `CodigoDeErroClinico` do portal estão lá, com os mesmos nomes, mais os da infraestrutura (`MODULO_*`, idempotência, taxa, captcha).
- **Datas:**
  - entrada `YYYY-MM-DD` e `HH:mm` é horário da parede do estabelecimento;
  - data-hora sai em ISO com o offset daquele dia no fuso do estabelecimento (`2026-10-20T08:00:00-03:00`), nunca com "Z";
  - mostre como vier;
  - `X-Timezone` só serve para o app dizer "horário da clínica" quando o aparelho estiver em outro fuso.
- **`Idempotency-Key`:** em toda criação que a pessoa pode repetir (duplo toque, rede caindo), mande um UUID v4 novo por ação e reuse o mesmo nos retries dessa ação.
  - Mesma chave e mesmo corpo em 24 h: a API não cria de novo. Nas rotas de cadastro com dado pessoal (paciente, alerta, autorizado) ela devolve o recurso já criado no estado atual; nas outras, a resposta guardada.
  - A chave vale por rota concreta e por parceiro: a mesma chave em outro paciente ou em outro parceiro é outra ação. Ainda assim, gere uma chave nova por ação.
  - Corpo diferente: 422 `CHAVE_DE_IDEMPOTENCIA_REUSADA` (bug do cliente).
  - 409 `IDEMPOTENCIA_EM_ANDAMENTO`: a primeira ainda está rodando; espere e repita.
  - Chave fora do formato: 400 `IDEMPOTENCIA_CHAVE_INVALIDA`.
- **Captcha (Cloudflare Turnstile)** nas escritas públicas, a partir da E3-05 e da E7-03:
  - o widget gera o token, que vai no header `X-Captcha-Token`;
  - 400 `CAPTCHA_INVALIDO`: refaça o widget;
  - 503 `CAPTCHA_INDISPONIVEL`: "tente de novo".
  - Em dev a API usa a chave de teste da Cloudflare (aprova qualquer token). No front de dev, use a site key de teste `1x00000000000000000000AA`.
- **Limite das escritas públicas:** 429 `TAXA_PUBLICA_EXCEDIDA`, com `Retry-After` (segundos) e `tenteDeNovoEmSegundos` no corpo.
- **CORS:** `Idempotency-Key`, `X-Captcha-Token` e `X-Timezone` já passam no preflight.

---

## 4. Profissionais, papéis e permissão (E1-03)

### 4.1 Papéis na equipe (portal)

- **Lista da equipe:** `GET /parceiro/portal/equipe` passa a trazer `papeisOperacionais` em cada membro.
- **Definir papéis** (só DONO): `PUT /parceiro/portal/equipe/:usuarioId/papeis` `{ papeisOperacionais: [...] }`.
  - Substitui a lista inteira.
  - Valores: `RECEPCAO`, `VETERINARIO`, `ENFERMAGEM`, `CUIDADOR`, `BANHISTA`, `ADESTRADOR`, `GESTOR`, `FINANCEIRO`.
  - Resposta: `{ usuarioId, papel, papeisOperacionais }`.
- **OPERADOR sem papel:** continua vendo só o portal comercial, como hoje.

### 4.2 Profissionais (portal)

| Ação | Rota | Quem |
|---|---|---|
| Listar | `GET /parceiro/portal/profissionais?ativo=true&atendeNaAgenda=true` | Qualquer membro |
| Cadastrar | `POST /parceiro/portal/profissionais` `{ nome, conselho?, registro?, uf?, especialidades?, corIndice?, atendeNaAgenda?, usuarioId? }` | `equipe.gerir` (DONO) |
| Atualizar | `PATCH /parceiro/portal/profissionais/:id` | DONO; o próprio profissional só `corIndice` e `especialidades` |
| Desativar | `POST /parceiro/portal/profissionais/:id/desativar` | DONO (nunca apaga) |

**Regras:**
- `conselho`:
  - `CRMV` ou `OUTRO` exigem `registro` e `uf` (400 `PROFISSIONAL_REGISTRO_INCOMPLETO`);
  - `NENHUM` não guarda nenhum dos dois;
  - o `registro` volta só com os dígitos.
- O mesmo CRMV na mesma UF, ou o mesmo usuário duas vezes, dá 409 `PROFISSIONAL_DUPLICADO`.
- `usuarioId` precisa ser membro ativo (400 `PROFISSIONAL_USUARIO_FORA_DA_EQUIPE`).
- `corIndice` vai de 0 a 5 (índice da paleta, nunca cor literal).
- `crmvConferidoEm` é o selo dado pelo admin. Trocar o número ou a UF tira o selo.
- **Revisão de segurança (2026-10-21):**
  - trocar o login de uma ficha com CRMV que já tem login dá 409 com `reason: FICHA_LIGADA_A_OUTRO_LOGIN`. Mensagem: "Esta ficha é de outra pessoa. Cadastre uma ficha nova para este login.";
  - ligar uma ficha sem login a um login tira o selo. Avise: "O CRMV volta para a conferência da PetJourney.";
  - quem saiu da equipe e voltou vem sem papéis e com a ficha desativada. Ofereça "Reativar ficha" (`PATCH { ativo: true }`, só `equipe.gerir`); se o login não estiver na equipe, 400 `PROFISSIONAL_USUARIO_FORA_DA_EQUIPE`;
  - parceiro suspenso ou em análise: papéis e profissionais respondem 409 `PARCEIRO_NAO_OPERACIONAL`;
  - vet autônomo: a ficha nasce sem CRMV (o do cadastro não prova de quem é). Use `aguardandoCrmv` do `GET /parceiro/portal/eu` para pedir o número.

### 4.3 Permissão

- **Toda rota de Clínica e Hotel** declara uma permissão da matriz. Sem ela, 403 `SEM_PERMISSAO` com `permissao` no corpo.
- **Ato de veterinário** (assinar receita, prescrever internação, finalizar prontuário) exige um profissional ativo com CRMV, número e UF; senão, 403 `CRMV_OBRIGATORIO`.
- **Escrever prontuário e liberar resumo** também exigem CRMV, de qualquer papel (DONO ou VETERINARIO). Antes, só do DONO.
- **Cuidador, banhista e adestrador** não têm `paciente.ler` até o E7 (que traz a leitura recortada para hóspedes).
- **Menu:** `GET /parceiro/portal/eu` (qualquer membro; `?parceiroId=` quando o usuário tem mais de um parceiro) entrega:
  - `parceiroId`, `papel`, `papeisOperacionais`;
  - `profissional`: a ficha deste login neste parceiro (ativa ou não), ou `null`;
  - `permissoes`: as da matriz para o papel. Esconda o que não estiver aqui;
  - `aguardandoCrmv`: das `permissoes`, as que a API ainda recusa com `CRMV_OBRIGATORIO`. Mostre o botão com o aviso "cadastre seu CRMV", não esconda;
  - `modulos` e `elegiveis`: os mesmos de `GET /parceiro/portal/modulos` (seção 2).
- **Menu do módulo** = permissão em `permissoes` **e** módulo com `podeLer`. Botão de criar ou alterar também exige `podeEscrever`.
- **Vet autônomo:** parceiro de categoria `VETERINARIO` que tem a Clínica ligada já nasce com a ficha do DONO, com o CRMV do cadastro quando o texto tem número e UF legíveis, e com o papel `VETERINARIO`. Se o CRMV do cadastro não der para ler, a ficha vem sem conselho e o `aguardandoCrmv` lista o que falta.

### 4.4 CMS: conferir CRMV

- `POST /admin/parceiro/:parceiroId/profissionais/:id/conferir-crmv` `{ motivo }` (10 a 500 caracteres; SystemAdmin) devolve o profissional com `crmvConferidoEm` e `protocolo` (`CRM-AAAA-NNNNNN`).
- Só vale para ficha com conselho `CRMV`, número e UF; senão, 400 `PROFISSIONAL_REGISTRO_INCOMPLETO`. Profissional de outro parceiro: 403.
- O protocolo entra nas rotas que o CMS já usa: `GET /admin/parceiro/:parceiroId/protocolos` e `GET /admin/protocolo/:codigo`.
- Mostre o número exatamente como foi cadastrado.
- Se o registro mudou desde que a tela abriu: 409 com `reason: REGISTRO_MUDOU`. Mensagem: "O registro mudou desde que a tela abriu. Atualize e confira o número novo."

---

## 5. Trilha de auditoria (E1-05)

- **Portal** (`auditoria.ler`: DONO e GESTOR):
  - `GET /parceiro/portal/auditoria?pacienteId=&usuarioId=&profissionalId=&acao=&de=&ate=&cursor=&limit=` responde `{ eventos: [...], proximoCursor }`;
  - por paciente: `GET /parceiro/portal/pacientes/:pacienteId/auditoria`.
  - Cada evento traz `em`, `ator` (`EQUIPE`, `SUPORTE`, `SISTEMA`), `acao`, `recursoTipo`, `recursoId`, `campos` (só os nomes), `protocolo`, `usuario` (quem clicou) e `profissional` (em nome de quem).
  - Nunca há conteúdo clínico.
- **App** (dono do pet): `GET /tutor/clinica/clinicas/:parceiroId/acessos?petId=` responde `[{ em, acao, recursoTipo, profissionalNome }]`.
  - Só leitura de dado do app (diário, peso, carteirinha) e publicação.
  - Tela "Quem viu", em Minhas clínicas.
- **CMS** (suporte): `GET /admin/parceiro/:parceiroId/trilha?motivo=...` mostra a trilha.
  - O motivo é obrigatório (10 caracteres ou mais) e vira o protocolo `SUP-...`.
  - A própria leitura fica na trilha do parceiro como `ator=SUPORTE`.
- **Evento de suporte no portal:** vem com `usuario.nome: null`. Mostre "Suporte PetJourney" e o `protocolo`.
- **Trilha do paciente** (`GET /parceiro/portal/pacientes/:pacienteId/auditoria`): exige Clínica ou Hotel (403 `MODULO_*` sem módulo). Com o módulo suspenso, a leitura continua.

---

## 6. Avisos à equipe e contadores de pendência (E1-06)

### 6.1 Portal: selos do menu e números do Início

`GET /parceiro/portal/pendencias?parceiroId=<id>[&modulo=CLINICA|HOTEL|PORTAL]` devolve `[{ chave, modulo, valor, tom, rota }]`.
- **Substitui a conta feita no navegador:** `useClinicoPendencias`, `useHotelPendencias` e os números de `HomeEspacoClinica`, `HomeEspacoHotel` e `HomeEspacoPortal`.
- **Uma chamada só:** sem `modulo`, vem o menu inteiro; agrupe por `modulo`.
- **`valor`:**
  - `0` vem na lista, e quem omite o selo é o front;
  - `null` quer dizer que o contador falhou: mostre sem selo, nunca "0".
- **`tom`:** `NEUTRO`, `ATENCAO` ou `RISCO`. Mapeie para o estilo do selo.
- **`chave`:** chave do texto no catálogo i18n do portal.
- **Contadores de hoje:**
  - `convitesPendentes`: só DONO, rota `/parceiro/equipe`;
  - `acessosTemporariosAtivos`: todo membro, rota `/parceiro/acessos`.
  - Os de Clínica e Hotel aparecem quando cada módulo registrar os seus.
- **Filtro:** o servidor já filtra por permissão e por módulo; não filtre no cliente.
- **Cache:** o servidor guarda 30 s. Polling mais frequente que isso não traz número novo.
- **Pronto quando:** o menu e o Início mostram os selos vindos dessa rota, e nenhum número de pendência é calculado no navegador.

### 6.2 Portal: inbox por parceiro

- `GET /notificacao?parceiroId=<id>` (cursor e limit como antes) traz só os avisos daquele parceiro.
- No sino do portal, use `naoLidasDoParceiro`; `naoLidas` continua sendo o total da conta.
- `PATCH /notificacao/read-all` continua marcando a conta inteira, não só o parceiro.
- **Pronto quando:** quem é membro de dois parceiros vê no sino de cada um só os avisos dele.

### 6.3 App: aviso de convite para a equipe

- **Tipo:** `PARCEIRO_CONVITE_EQUIPE`. Vai para quem já tem conta com o e-mail convidado para a equipe de um parceiro (o DONO que convidou não fica sabendo se a conta existe). O reenvio do convite também avisa.
- **É só aviso.** O convite continua sendo aceito apenas pelo link do e-mail (regra da E0-01: ter uma conta com o endereço não prova a posse dele). O aviso não traz token nem link de aceite, e o toque não leva a tela de aceite.
- **Em `services/notificacao/rotas-notificacao.ts`**, acrescente ao union `TipoNotificacao` e aos mapas:
  - `ROTA_POR_TIPO`: `ROTA_INBOX` (`/screens/notifications`);
  - `AFETA_HOME_POR_TIPO`: `false`;
  - `PERFIL_POR_TIPO`: `null` (o inbox abre nos dois perfis, e o convidado pode nem ser parceiro ainda).
- **Em `app/screens/notifications.tsx`**, `ICONES_POR_TIPO.PARCEIRO_CONVITE_EQUIPE`: `EnvelopeSimpleIcon` (o próximo passo é abrir o e-mail).
- **Preferência e canais:** categoria `PARCEIRO`, canal Android `conta`. Não tem e-mail próprio, porque o e-mail do convite já sai pela E0-01, com o link.
- **Copy:** título e corpo vêm prontos do backend nos 6 idiomas. São fixos: não leem o nome do parceiro, que o DONO pode trocar depois de aprovado e viraria phishing com o nosso remetente.
- **`dados`:** `{ parceiroId, parceiroNome, conviteId, papel ('DONO' | 'OPERADOR'), expiraEm (ISO) }`. Não use `parceiroNome` como título, pelo mesmo motivo.
- O `audit:notificacao-rotas` da API reprova até o app ganhar este tipo e os dois da seção 2.3. Os três ainda não estão no `origin/develop` do app.
- **Pronto quando:** tocar nos três avisos novos (2.3 e 6.3) abre o inbox nos dois perfis, com ícone, e o `audit:notificacao-rotas` passa.

---

## 7. Aposentar o perfil "veterinário" antigo (E1-07a: medição e F1)

**Spec:** `docs/specs/2026/q4/q4-1/portal-parceiro/e1-fundacao/07-aposentar-legado-clinica-veterinario.md` (decisões do gerente de 29/10). **Backend:** pronto em dev em 2026-10-29. **Não está em produção.**

**A chave.** Tudo o que muda abaixo depende da chave `legado.veterinarioParouDeGravar` (tabela `ConfiguracaoSistema`): **ligada no dev**, **desligada em produção** até o Nicolas ligar. Desligada, a API responde exatamente como hoje. Por isso o app da loja e o portal de produção continuam funcionando sem mudança nenhuma.

### 7.1 O que a API faz com a chave ligada

- **`POST /usuario` e `PATCH /usuario/:id` continuam aceitando o bloco `veterinario`** e respondem 200 por causa dele (nunca 400). Só a **foto** grava, numa coluna nova da conta. `crmv`, `especialidade`, `bio` e `numeroComercial` são ignorados, e a linha antiga de veterinário não é mais criada nem alterada.
- **A foto** precisa ser a URL que o `POST /upload/file-usuario` devolve (storage do PetJourney, pasta `bucketFotos/uploads/usuarios/`) e ter até 2048 caracteres (acima disso, 400 no campo `veterinario.foto`, nas duas posições da chave). Qualquer outra coisa (o `file://` de um upload que falhou, um link de outro site) responde 200, mas é ignorada e a foto anterior fica. `foto: ""` limpa a foto. Suba a foto pelo upload antes de mandar o PATCH.
- **`veterinarioPerfil.foto`** nas respostas de `GET /usuario/:id`, `GET /usuario/allInformations/:id`, `POST /usuario` e `PATCH /usuario/:id` passa a mostrar a foto nova. Quem não tem a linha antiga e tem foto recebe `veterinarioPerfil: { foto }` (só a foto, sem `id`, `crmv` nem `bio`). Quem tem a linha antiga continua recebendo `crmv` e `especialidade` dela por enquanto (saem na E1-07c).
- **Cadastro do parceiro** (`POST /parceiro/portal/cadastro`): sem `crmv` no corpo, deixa de copiar o CRMV do perfil antigo. O `crmv` do corpo continua valendo.
- **Token:** sem mudança nesta entrega. Quem tem a linha antiga segue com `veterinarioId` no token; conta nova nunca ganha a linha, então vem com `veterinarioId: null`.
- **Diretório** `GET /clinica*` e `GET /veterinario*`: sem mudança (só passam a ser contados).

Estas duas valem **com a chave ligada ou desligada** (nenhum front chama):
- `GET /subscription/veterinario/:id` (admin): **410** `LEGADO_DESLIGADO`, `reason: "VETERINARIO"`. Conta comum continua levando 403.
- `POST /endereco` e `PATCH /endereco/:id` com `clinicaId` (admin): **410** `LEGADO_DESLIGADO`, `reason: "CLINICA"`. Não-admin continua 403. `clinicaId: null` no PATCH do admin (desvincular) segue aceito.

### 7.2 App (`petjourney-app`)

- **`login.tsx`: decida a tela pelo `GET /auth/perfis`, não pelo `veterinarioId` do token.** O claim vai ficar `null` para todo mundo na E1-07c. Mudança de comportamento aceita pelo gerente: quem tem tutor e o perfil antigo passa a entrar direto no tutor, e o parceiro fica no `account-switch` (é o que já acontece com todo parceiro novo).
- **`editProfile.tsx`: a foto do parceiro deixa de depender do CRMV.** Com a chave ligada, o app pode mandar só `veterinario: { foto }` (sem `crmv`), e o aviso `account.partnerPhotoNeedsCrmv` deixa de fazer sentido. **Atenção:** com a chave desligada (produção hoje), mandar o bloco sem `crmv` ainda dá 500, como sempre deu. Então essa parte só pode ir para a loja **depois que o Nicolas ligar a chave em produção**. Até lá, teste no dev, onde a chave já está ligada. Pare também de montar `crmv`, `especialidade`, `bio` e `numeroComercial` no bloco: não gravam mais.
- **`UserAvatar.tsx` e `hydrateUser.ts`:** nada muda, continuam lendo `veterinarioPerfil.foto`.
- **`add-profile.tsx` (ramo `veterinario`, só por deep link):** com a chave ligada, ele não cria mais o perfil (`veterinarioPerfil.id` não vem). Pode apagar o ramo.
- **Notificação nova:** nenhuma. Nada muda em `rotas-notificacao.ts`.

### 7.3 Portal (`petjourney-admin`)

- **`SettingsPerfilPanel.vue`:** a foto continua indo em `PATCH /usuario/:id` com `veterinario.foto`. CRMV e especialidade param de gravar com a chave ligada. O CRMV do profissional vai na ficha (`PATCH /parceiro/portal/profissionais/:id`, E1-03), e o CRMV do parceiro no cadastro (`PATCH /parceiro/portal/cadastro`, campo `crmv`). A mesma ressalva do app vale para mandar a foto sem `crmv`: só depois da chave ligada em produção.
- **`login.vue` e `auth-session.ts` (`getVeterinarioId`):** decida pelo `/auth/perfis`.
- **`PortalParceiroCadastroForm.vue`:** o cadastro não copia mais o CRMV do perfil antigo. Quem quiser CRMV no cadastro manda `crmv` no corpo. Ajuste o comentário da linha 73.

### 7.4 CMS (`petjourney-cms`)

- `veterinarioPerfil` no tipo gerado fica `deprecated` e pode ser `null`. Com a chave ligada, quem só tem foto de parceiro vem com `veterinarioPerfil: { foto }`. Para o rótulo "Veterinário" da lista de usuários, use `veterinarioPerfil?.id` (só a linha antiga tem `id`), não a presença do objeto.
- O filtro `GET /usuario?perfil=VETERINARIO` não muda nesta entrega.
- **Rota nova, opcional:** `GET /admin/legado/uso?de=AAAA-MM-DD&ate=AAAA-MM-DD` (admin). Padrão: os últimos 30 dias; até 90 dias e 2000 linhas. Devolve `{ de, ate, truncado, porChave: { CHAVE: total }, linhas: [{ chave, dia, canal, plataforma, versaoApp, total, ultimaEm }] }`. Só contagem: nenhum dado de pessoa. O número chega com até 1 minuto de atraso.

### 7.5 Erro novo

| Código | HTTP | Quando | Campos |
|---|---|---|---|
| `LEGADO_DESLIGADO` | 410 | rota do modelo antigo que não responde mais | `codigo`, `reason` (`VETERINARIO` ou `CLINICA`), `message` localizada |

Está no enum de códigos do contrato (`contrato/openapi.json`); gere os tipos de novo.

### 7.6 Pronto quando

- O login do app e do portal decide a tela pelo `/auth/perfis` e funciona para uma conta com `veterinarioId: null` no token.
- Com a chave ligada (dev), o parceiro troca a foto no app e no portal sem informar CRMV, e a foto aparece no avatar depois de fechar e abrir o app.
- Nenhuma tela grava CRMV ou especialidade pelo `PATCH /usuario/:id`.

---

## 8. Aposentar o perfil "veterinário" antigo, parte 2 (E1-07c: a API para de ler)

**Spec:** a mesma da seção 7 (decisão 14 do gerente, 29/10). **Backend:** no `develop` em `10773d2` e `9dce058` (auditoria sem ALTO, correções incluídas), 2026-10-29. **Não está em produção.**

**A chave.** Uma segunda chave, `legado.paraDeLerVeterinario` (tabela `ConfiguracaoSistema`): **ligada no dev desde 29/10**, **desligada em produção** até o Nicolas ligar, depois de copiar as fotos antigas (F2) e rodar a conferência. Desligada, a API responde como na seção 7. Ligada, a API não lê mais o perfil antigo de veterinário em lugar nenhum, e tudo abaixo vale. Teste no dev, onde as duas chaves estão ligadas.

### 8.1 O que muda com a chave ligada

| Onde | Antes (seção 7) | Com a chave ligada |
|---|---|---|
| Token (`POST /auth/login`, `/auth/refresh`, `/auth/trocar-perfil`, token do cadastro) | `veterinarioId` com o id do perfil antigo de quem tinha | `veterinarioId: null` para todo mundo. O campo continua no token (no token que o `POST /usuario` devolve ele nem vem, como já era para conta nova) |
| `GET /auth/perfis` | `veterinario: { id }` de quem tinha | `veterinario: null` sempre. O campo continua na resposta |
| `POST /auth/trocar-perfil` com `perfil: "VETERINARIO"` | trocava para quem tinha o perfil antigo | 403 `PERFIL_NAO_DISPONIVEL` para todo mundo. Para o parceiro, use `perfil: "PARCEIRO"` |
| `veterinarioPerfil` em `GET /usuario/:id`, `GET /usuario/allInformations/:id`, `POST /usuario`, `PATCH /usuario/:id` e na lista do CMS | perfil antigo inteiro (`id`, `crmv`, `especialidade`, `bio`...) com a foto nova por cima | **só `{ foto }` ou `null`**. Nunca `id`, `crmv`, `especialidade`, `bio` nem `numeroComercial` |
| `PATCH /usuario/:id` com o bloco `veterinario` | só a foto grava | igual: 200, só a foto grava, o resto é ignorado |
| CMS: `GET /usuario?perfil=VETERINARIO` | quem tem o perfil antigo | quem é **profissional ativo** de um parceiro não excluído, ou **membro aceito e ativo** de parceiro `VETERINARIO` ou `CLINICA_VETERINARIA` não excluído. O valor do parâmetro não muda |
| `GET /endereco?clinicaId=` (admin) | filtro por clínica antiga | `[]` |
| Diretório `GET /clinica*` e `GET /veterinario*` | sem mudança | sem mudança |

**Mudança de comportamento aceita pelo gerente (decisão 7).** O app da loja decide a tela do login pelo `veterinarioId` do token. Com a chave ligada, quem tem perfil de responsável **e** o perfil antigo de veterinário passa a entrar direto no perfil de responsável, e o parceiro fica no `account-switch`. É o que já acontece com todo parceiro novo. No dev, 11 contas estão nesse caso.

**Foto, com qualquer combinação das duas chaves** (correção da auditoria, 29/10). Depois que a foto nova foi gravada uma vez, ela vale por cima da foto antiga em todas as respostas, mesmo que alguém desligue as chaves depois. Quem limpou a foto (`foto: ""`) recebe `veterinarioPerfil.foto: null` (ou `veterinarioPerfil: null`, se não tiver o perfil antigo), e a foto velha não volta.

**Foto com a chave ligada.** O avatar do parceiro sai só da foto nova. Quem tem foto no perfil antigo e nunca teve a foto copiada fica sem avatar. Por isso a chave só liga em produção depois da cópia (a conferência do Nicolas exige zero casos). No dev, 9 contas de teste ficaram sem avatar porque a foto delas é de outro projeto do Supabase (dado copiado de produção); é esperado.

### 8.2 App (`petjourney-app`)

- **`login.tsx`:** o pedido da seção 7.2 fica obrigatório. Com a chave ligada, o claim `veterinarioId` é sempre `null`; a tela vem do `GET /auth/perfis`.
- **`AuthContext.tsx`** (`applyProfileIdsFromApi`, `setActiveProfile`): não dependa de `veterinarioId` para nada. Ele vem `null` no token e no `/auth/perfis`.
- **`editProfile.tsx`:** o pré-preenchimento de CRMV, especialidade, bio e número comercial vinha de `veterinarioPerfil`. Com a chave ligada esses campos vêm vazios (só `foto` existe). Tire esses campos da tela do parceiro. O CRMV do profissional fica na ficha (E1-03), no portal.
- **`UserAvatar.tsx` e `hydrateUser.ts`:** sem mudança, continuam lendo `veterinarioPerfil.foto`.
- **`add-profile.tsx`** (ramo `veterinario`) e as telas órfãs `veterinaryClinics.tsx` e `list-veterinarians.tsx`: o ramo não cria nada e a troca para `VETERINARIO` dá 403. Pode apagar o ramo. As telas do diretório continuam respondendo, mas nenhuma navegação leva a elas.
- **Notificação nova:** nenhuma. Nada muda em `rotas-notificacao.ts`.

### 8.3 Portal (`petjourney-admin`)

- **`login.vue` e `auth-session.ts`** (`getVeterinarioId`): sempre `null` com a chave ligada. Decida pelo `/auth/perfis`.
- **`SettingsContaPanel.vue`:** a dica de papel por `sessionUser.veterinarioId` nunca aparece mais. Use os perfis.
- **`SettingsPerfilPanel.vue`:** o pré-preenchimento de CRMV e especialidade de `veterinarioPerfil` vem vazio. O CRMV do profissional fica na ficha (`PATCH /parceiro/portal/profissionais/:id`, E1-03) e o do parceiro no cadastro (`PATCH /parceiro/portal/cadastro`, campo `crmv`). A foto continua indo em `PATCH /usuario/:id` com `veterinario.foto`.

### 8.4 CMS (`petjourney-cms`)

- **Rótulo "Veterinário" da lista de usuários** (`users/page.tsx`): com a chave ligada, ninguém tem `veterinarioPerfil.id`. Para saber quem é veterinário, use o filtro `perfil=VETERINARIO` (que agora segue a regra da tabela acima). O avatar continua em `veterinarioPerfil?.foto`.
- **Tipo `VeterinarioPerfil`** (`services/usuario.service.ts`): trate tudo como opcional; só `foto` chega.

### 8.5 Site (`petjourney-web`)

- Nada em runtime. Só o comentário de `service/parceiro/types.ts` ("o backend copia do `veterinarioPerfil.crmv`") deixou de ser verdade: o cadastro não copia mais o CRMV antigo.

### 8.6 Contrato

- `contrato/openapi.json` **não muda**: nenhuma rota e nenhum campo saem, e a resposta de usuário não está tipada no contrato (o bloco `veterinario` de entrada segue `deprecated`, igual). Os tipos de `veterinarioPerfil` que o app e o CMS têm são escritos à mão: trate todos os campos como opcionais, só `foto` chega. Nenhum código de erro novo (o `LEGADO_DESLIGADO` é o da seção 7.5).

### 8.7 Pronto quando

- No dev, uma conta com perfil de responsável e perfil antigo de veterinário entra no app e no portal, e chega ao parceiro pelo `account-switch`, com `veterinarioId: null` no token.
- O avatar do parceiro aparece no app, no portal e no CMS a partir de `veterinarioPerfil.foto`, sem nenhum outro campo do perfil antigo.
- Nenhuma tela mostra ou pede CRMV, especialidade ou bio a partir de `veterinarioPerfil`.
- O CMS rotula e filtra veterinário sem depender de `veterinarioPerfil.id`.

### 8.8 Sem chave e sem as tabelas antigas (E1-07d e F4, decisão 15, 30/10)

**Backend:** no `develop` desde 30/10 (`f77c6c0f` E1-07d, `383af010` e `173a32de` migration da cópia, `774006a1` F4; a F4 aplicada no banco de dev depois do deploy). **Não está em produção.**

- **As duas chaves saíram.** O que a tabela da 8.1 diz para "chave ligada" agora vale sempre, no dev e em produção. A chave também some da tela de configuração do CMS (`GET /admin/configuracao`), que já mostrava as duas como só leitura.
- **As tabelas antigas saíram** (F4): `Veterinario`, `Clinica`, `ClinicaRole`, `ClinicaPermission`, `ClinicasEquipe`, `ClinicasPacientes` e a coluna `Endereco.clinicaId`. Antes de apagar, uma migration própria (sem DROP, antes do deploy) copia para os lugares novos a foto (para `veterinarioPerfil.foto`), o CRMV do dono (para o campo `crmv` do cadastro do parceiro, só quando estava vazio) e a especialidade (para a ficha do profissional, só quando estava vazia).
- **Para o app e o CMS, nada muda no contrato.** O token segue com `veterinarioId: null` (agora também no token do `POST /usuario`), o `GET /auth/perfis` segue com `veterinario: null`, o `veterinarioPerfil` segue `{ foto }` ou `null`, o bloco `veterinario` do `PATCH /usuario/:id` segue aceito (200, só a foto grava). Os 410 `LEGADO_DESLIGADO` da seção 7.5 continuam. `contrato/openapi.json` sem mudança de conteúdo.
- **Endereço:** `GET /endereco` deixa de trazer o campo `clinicaId` (vinha sempre `null`). `POST`/`PATCH /endereco` com `clinicaId` seguem: 403 para conta comum, 410 para admin, e `clinicaId: null` do admin é aceito e ignorado.
- **Notificação nova:** nenhuma. Os pedidos das seções 8.2 a 8.5 continuam os mesmos.

---

## 9. Verificação de identidade e o selo do CRMV (E1-08)

**Spec:** `docs/specs/2026/q4/q4-1/portal-parceiro/e1-fundacao/08-verificacao-de-identidade.md` (v0.7, Aprovada). **Backend:** no `develop` desde 30/10 (commits `b9f13b3d`, `8eeba582` e `ad60f0c8`). Produção só com o master. **Não está em produção**, e o bucket privado de produção ainda não existe.

**O que muda em uma frase.** Assinar (receita, prontuário finalizado, resumo liberado, prescrição de internação e todo ato legal) passa a exigir o **selo**: o CRMV conferido pela PetJourney nos últimos 365 dias **e** a identidade do login aprovada (documento com foto, selfie e CPF) **antes** da conferência. O CRMV só digitado continua valendo para o rascunho.

**No dev:** os veterinários de QA (das clínicas com o módulo Clínica ativo) já têm uma identidade de teste aprovada e o CRMV conferido de novo (`scripts/preparar-identidade-dev.ts`). Conta nova precisa passar pelo envio e pela conferência no CMS.

### 9.1 Portal (`petjourney-admin`)

**O 403 novo.** As rotas de `receita.assinar`, `prontuario.finalizar`, `resumo.liberar` e `internacao.prescrever` (e o serviço de todo ato legal, na transação) devolvem:

| Código | Quando | O que mostrar |
|---|---|---|
| `CRMV_OBRIGATORIO` | sem ficha ativa com CRMV, número e UF (como antes) | a `message` e o caminho para a ficha |
| `CRMV_NAO_CONFERIDO` com `reason: SEM_SELO` | CRMV em dia, mas sem conferência (ou a conferência é anterior à identidade aprovada) | "aguardando a conferência da PetJourney" |
| `CRMV_NAO_CONFERIDO` com `reason: VENCIDO` | a conferência tem 365 dias ou mais | "a conferência venceu" |
| `CRMV_NAO_CONFERIDO` com `reason: SEM_IDENTIDADE` | o login não tem identidade aprovada (nunca enviou, recusada, revogada) | o botão para a tela de identidade |

**`GET /parceiro/portal/eu`** ganha quatro campos (aditivos):
- `aguardandoConferencia: Permissao[]`: das `permissoes`, as que dariam `CRMV_NAO_CONFERIDO` agora (a mesma regra do guard). Mostre o botão com o aviso, não esconda;
- `atosAguardandoConferencia: AtoLegal[]`: **todos** os atos que dariam `CRMV_NAO_CONFERIDO` agora, inclusive os que ficam atrás de permissão que também serve para o rascunho: `INICIAR_ESCUTA`, `ATO_AVULSO` e `ANULAR_ATO` (em `prontuario.escrever`), `PRORROGAR_COPIA` e `RECUSAR_COPIA` (em `copia.gerir`). Use no botão do ato (iniciar a escuta, ato avulso, prorrogar e recusar a cópia); o resto da tela segue liberado;
- `motivoDaConferencia`: `SEM_SELO`, `VENCIDO`, `SEM_IDENTIDADE` ou `null` (o `reason` que o 403 traria);
- `identidade: { status }` ou `null`: o envio mais recente da pessoa.
- `aguardandoCrmv` continua igual (falta CRMV). Uma permissão nunca aparece nos dois.

**Tela nova: identidade da pessoa** (qualquer membro ativo de parceiro, inclusive de parceiro PENDENTE; sem membership, 403):

| Rota | Uso |
|---|---|
| `GET /parceiro/portal/eu/identidade` | `{ verificacao, exigencias, consentimentoVersaoAtual }`. `verificacao`: `{ status, cpfMascarado, nomeCompleto, enviadaEm, decididaEm, motivoDecisao, revogadaEm, motivoRevogacao, motivoDoSistema, analiseExpiraEm }` do envio mais recente, ou `null`. `motivoDoSistema` = `EXPIRADA` quando o próprio sistema cancelou (14 dias sem conferência); `analiseExpiraEm` só vem em EM_ANALISE (o prazo da conferência). `exigencias`: para cada parceiro em que a pessoa é DONO, `{ parceiroId, nome, categoria, itens }`, cada item `{ item, obrigatorio, ok }` com `item` = `IDENTIDADE`, `CNPJ` ou `CRMV` |
| `POST /parceiro/portal/eu/identidade` | multipart: `cpf`, `nomeCompleto` (3 a 120), `consentimentoVersao` (igual a `consentimentoVersaoAtual`), arquivos `documento`, `documentoVerso` (opcional) e `selfie`. Devolve o mesmo corpo do GET (201) |
| `DELETE /parceiro/portal/eu/identidade` | cancela o envio EM_ANALISE (os arquivos saem na hora). Reenviar cria outro |
| `GET /parceiro/portal/eu/identidade/consentimento/:versao` | `{ versao, vigente, tipo, titulo, botao, idioma, finalidade, texto }`: o texto exato daquela versão, no idioma do pedido (`Accept-Language`, os 6). Mostre o da `consentimentoVersaoAtual` antes do envio, sem texto fixo no front. `tipo` = `AVISO` desde `2026-10-31` (`CONSENTIMENTO` nas antigas, com `titulo` e `botao` nulos). `texto` vem em parágrafos separados por linha em branco: mostre com quebra de linha (`white-space: pre-line`). Versão que não existe: 404 `IDENTIDADE_CONSENTIMENTO_NAO_ENCONTRADO` |

Arquivos: foto **JPG, PNG ou WEBP** (o documento e o verso também **PDF**, como a CNH digital), até **8 MB** cada, o tipo é lido do conteúdo. **Sem HEIC**: use `accept="image/jpeg,image/png,image/webp,application/pdf"` no input (o Safari do iPhone já entrega JPEG quando o `accept` não tem HEIC) ou converta no navegador. A API regrava a foto em JPEG sem EXIF nem GPS.

Estados: `EM_ANALISE` (mostre o prazo `analiseExpiraEm`), `APROVADA`, `RECUSADA` (mostre o `motivoDecisao` e o botão de reenviar), `CANCELADA` (com `motivoDoSistema: EXPIRADA`: "o envio ficou 14 dias sem conferência e as fotos foram apagadas; envie de novo"), `REVOGADA` (mostre o `motivoRevogacao`; reenviar cria outro). A pessoa também recebe e-mail na aprovação, na recusa, na revogação e na expiração, no idioma em que enviou.

Erros do envio:

| Código | Status | `reason` e extra |
|---|---|---|
| `IDENTIDADE_CONSENTIMENTO_OBRIGATORIO` | 400 | `versaoAtual`. A `message` agora é "Leia o aviso antes de enviar." (o nome do código ficou) |
| `IDENTIDADE_CPF_INVALIDO` | 400 | |
| `IDENTIDADE_CPF_DIFERENTE_DA_CONTA` | 400 | a `message` manda corrigir o CPF do perfil (`PATCH /usuario/:id`) ou falar com o suporte |
| `IDENTIDADE_NOME_INVALIDO` | 400 | |
| `IDENTIDADE_ARQUIVO_INVALIDO` | 400 | `reason`: `TIPO`, `TAMANHO` (com `maxBytes`), `FALTANDO`, `PIXELS` ou `ILEGIVEL`; `campo`: `documento`, `documentoVerso` ou `selfie` |
| `IDENTIDADE_JA_EM_ANALISE`, `IDENTIDADE_JA_APROVADA` | 409 | |
| `IDENTIDADE_CPF_INDISPONIVEL` | 409 | o CPF não pode ser usado por esta conta (a resposta não diz por quê); mostre a `message` (falar com o suporte). Substitui o `IDENTIDADE_CPF_EM_OUTRA_CONTA` no envio |
| `IDENTIDADE_SEM_ENVIO_EM_ANALISE` | 409 | só no DELETE |
| `IDENTIDADE_TAXA_EXCEDIDA` | 429 | `janela` (`PESSOA`: 5 por dia; `ORIGEM`: 10 por dia; `LEITURA`; `CANCELAMENTO`) e `tenteDeNovoEmSegundos` |
| `IDENTIDADE_FILA_CHEIA` | 429 | |
| `IDENTIDADE_ARMAZENAMENTO_INDISPONIVEL` | 503 | nada foi guardado; tente de novo |

**Aviso de privacidade** (versão `2026-10-31`, parecer interno de 30/10; P3 da spec respondida). Não é mais consentimento: a base legal é a prevenção à fraude e a segurança do titular (LGPD, art. 11, II, g), então o texto **informa e não pede permissão**.
- Título da tela: o `titulo` da API ("Aviso sobre a verificação de identidade").
- Botão que envia: o `botao` da API (**"Li e entendi, enviar"**). **Sem caixa de seleção de "aceito"** e sem "concordo".
- Os nomes de campo não mudam: o envio continua mandando `consentimentoVersao` igual a `consentimentoVersaoAtual` (agora `2026-10-31`), e o 400 continua `IDENTIDADE_CONSENTIMENTO_OBRIGATORIO`. Não fixe a versão no front: leia `consentimentoVersaoAtual`.
- Quem já enviou com a `2026-10-30` não precisa enviar de novo: mostre o aviso novo no próximo acesso à tela de identidade, só para leitura.
- A API serve o texto por versão nos 6 idiomas (rota acima); não copie o texto para o front. Em pt-BR (5 parágrafos):

> Para representar o parceiro e assinar atos pela PetJourney, como receitas e prontuários, você precisa confirmar quem é. Para isso, envie uma foto do seu documento com foto, uma selfie segurando esse documento e o seu CPF. Prefira a CNH ou a carteira de identidade nova, e não envie outros documentos.
>
> Por que pedimos. Para impedir que alguém use o seu nome ou o seu registro profissional e para que quem recebe um documento assinado saiba quem o assinou. A base legal é a prevenção à fraude e a sua segurança na identificação do cadastro (Lei 13.709/2018, art. 11, II, g), e por isso não depende de consentimento. Sem essa verificação, você continua usando o portal, mas não pode assinar os atos que pedem a conferência.
>
> Como conferimos. Uma pessoa da equipe PetJourney compara as fotos e o CPF. Não usamos reconhecimento facial automático nem criamos um modelo do seu rosto. Só a equipe que faz a conferência vê os arquivos, e cada abertura fica registrada.
>
> Por quanto tempo. As fotos são apagadas 30 dias depois da decisão. Se o envio ficar 14 dias sem conferência, ele é cancelado e as fotos são apagadas na hora. Ficam guardados o seu CPF e o seu nome, o resultado, a data, quem conferiu, a impressão digital (hash) de cada arquivo e o registro de quem abriu o envio, até a exclusão da sua conta. Quando a conta é excluída, o CPF e o nome saem; o resto fica, sem eles, como registro dos atos assinados.
>
> Seus direitos. Você pode cancelar o envio enquanto ele estiver em análise. Também pode pedir acesso e correção dos seus dados e tirar dúvidas com o nosso encarregado de proteção de dados pelo e-mail privacidade@petjourney.health. Saiba mais na Política de Privacidade da PetJourney.
>
> [ Li e entendi, enviar ]

Se o portal tiver link para a Política de Privacidade ou contato de privacidade em outra tela, o canal do encarregado é `privacidade@petjourney.health`.

**Tela da equipe (profissionais):** o contador novo `selosVencendo` (módulo Clínica, para quem tem `equipe.gerir`, rota `/parceiro/equipe`) conta as fichas ativas com o selo vencendo em 30 dias (tom `ATENCAO`) ou já vencido (`RISCO`). Na ficha, `crmvConferidoEm` mais 365 dias é o vencimento. Desde a auditoria final (30/10), a lista da equipe devolve o selo EFETIVO: com a identidade do login revogada (ou aprovada depois do selo), `crmvConferidoEm` vem nulo (sem selo); o vencido continua com a data. O contador conta só o selo efetivo. Trocar o CRMV, a UF ou o login da ficha, ou **desligar o login** (`usuarioId: null`, novo na E1-08), tira o selo: avise antes de salvar.

**Cadastro e PATCH do parceiro** (`POST` e `PATCH /parceiro/portal/cadastro`): CNPJ com dígito verificador errado dá 400 `CNPJ_INVALIDO` (aceita o CNPJ alfanumérico novo, com letras nos 12 primeiros caracteres). No `PATCH`, o CNPJ igual ao gravado (com ou sem máscara) não é validado de novo nem zera a consulta da Receita: o cadastro antigo com DV errado segue editável no resto.

### 9.2 CMS (`petjourney-cms`), só SystemAdmin

| Rota | Uso |
|---|---|
| `GET /admin/verificacoes-identidade?status=EM_ANALISE&cursor=` | fila sem imagem, do mais antigo para o mais novo, 50 por página; `total`, `maisAntigaEm`, `idadeDaMaisAntigaHoras` e `proximoCursor` |
| `GET /admin/verificacoes-identidade/:id` | detalhe: `cpf` inteiro, `nomeCompleto`, `nomeDaConta`, `arquivos` com `documento`, `documentoVerso` e `selfie` (URLs de **5 minutos**; `null` se o arquivo já saiu), `parceiros`, `fichas` (CRMV e UF em cada parceiro), `mesmoCpfEmOutrasContas`, `historicoDoCpf` (`{ recusadas, revogadas }` do mesmo CPF em qualquer conta: destaque em vermelho quando `revogadas > 0`), `anterioresDaConta` (até 20 envios anteriores da conta, com `status`, `cpfMascarado`, `mesmoCpf: false` quando a conta tentou com outro CPF, motivos e `motivoDoSistema`) e `buscaPublicaDoCrmv`. Cada abertura fica registrada com o admin; 120 por hora por admin (429 `IDENTIDADE_LEITURA_EXCEDIDA`) |
| `POST /admin/verificacoes-identidade/recusar-em-lote` | `{ ids (1 a 50), motivo }`: recusa várias EM_ANALISE com o mesmo motivo (fila cheia de envios falsos). Devolve `{ itens: [{ id, recusada, protocolo, codigo }] }`: a que não pôde ser recusada vem com o `codigo` (ex.: `IDENTIDADE_TRANSICAO_INVALIDA`, `CONFERENCIA_DE_SI_MESMO`) e não derruba as outras. Seleção múltipla na fila |
| `POST .../:id/aprovar` e `.../:id/recusar` | `{ motivo }` (10 a 500). Só de EM_ANALISE; devolve o `protocolo` IDT |
| `POST .../:id/revogar` | `{ motivo }`. Só de APROVADA. Vale na hora para todos os atos da pessoa |
| `GET /admin/verificacoes-identidade/selos-vencendo?ate=AAAA-MM-DD` | fichas ativas com o selo vencendo de hoje até a data (padrão: o fim do mês), com `identidadeAprovada`; teto de 200 (`truncado`) |
| `POST /admin/parceiro/:id/cnpj/reconsultar` | consulta a Receita agora (BrasilAPI): `cnpjSituacao`, `cnpjCnaePrincipal`, `cnpjRazaoSocial` e `alertaCnae` (clínica com CNAE principal diferente de 7500-1/00). Nunca reprova |
| `GET /admin/configuracao` e `PUT /admin/configuracao/:chave` | as chaves da configuração em tabela, com `editavelPeloCms`; `PUT` com `{ valor, motivo }` (`valor` verdadeiro ou falso) e protocolo CFG, **só nas chaves `aprovacao.*`** (as outras são só leitura no CMS: 400 `CONFIGURACAO_CHAVE_INVALIDA` com `reason: FORA_DO_CMS`). Mostre o interruptor só onde `editavelPeloCms` |

**Conta excluída:** a verificação de quem excluiu a conta fica sem CPF e sem nome, e o motivo escrito pelo admin vira o texto fixo `MOTIVO_REMOVIDO` (mostre "removido com a conta", não o código).

Erros: `IDENTIDADE_DECISAO_PROPRIA` (403: o admin não decide a própria), `CONFERENCIA_DE_SI_MESMO` (403, `reason` `CPF_DO_ADMIN` ou `REGISTRO_DO_ADMIN`: a verificação ou a ficha é do próprio admin, por outra conta; peça a outro admin), `IDENTIDADE_TRANSICAO_INVALIDA` (409, com o `status` atual: outro admin decidiu antes, ou o sistema expirou), `IDENTIDADE_CPF_EM_OUTRA_CONTA` (409 na aprovação), `IDENTIDADE_NAO_ENCONTRADA` (404), `PARCEIRO_SEM_CNPJ` (409), `CONFIGURACAO_CHAVE_INVALIDA` e `CONFIGURACAO_VALOR_INVALIDO` (400).

**A fila expira:** a verificação EM_ANALISE há mais de 14 dias é cancelada pelo cron diário (`motivoDoSistema: EXPIRADA`, as fotos saem, a pessoa recebe e-mail). Na fila, mostre a idade e um aviso a partir de 10 dias.

**Conferir o CRMV** (`POST /admin/parceiro/:parceiroId/profissionais/:id/conferir-crmv`, existente): mostre, lado a lado, o CRMV e a UF da ficha, o nome do documento aprovado (o detalhe da identidade) e a busca pública do conselho. Erros novos: 400 `PROFISSIONAL_SEM_LOGIN` (ficha sem login: o selo é da pessoa), 400 `PROFISSIONAL_SEM_IDENTIDADE` (confira a identidade antes), 403 `PROFISSIONAL_CONFERENCIA_PROPRIA` e 403 `CONFERENCIA_DE_SI_MESMO` (o login da ficha tem o CPF do admin, ou o admin tem ficha com o mesmo registro e UF, com ou sem zeros à esquerda).

**Aprovar o parceiro** (`POST /parceiro/:id/auditoria/aprovar`, existente): nada muda enquanto as chaves `aprovacao.exigirIdentidadeDoDono` e `aprovacao.recusarCnpjInativo` estiverem desligadas (o padrão). Ligadas, 400 com o primeiro que falta e a lista inteira em `faltando`: `PARCEIRO_IDENTIDADE_DO_DONO_PENDENTE`, `PARCEIRO_CNPJ_OBRIGATORIO` (clínica e farmácia), `PARCEIRO_CRMV_OBRIGATORIO` (veterinário autônomo) e `PARCEIRO_CNPJ_INATIVO` (com `situacao`). Com `recusarCnpjInativo` ligada e o CNPJ nunca consultado, o `aprovar` consulta a Receita na hora (pode levar até 5 s); se não conseguir, 409 `PARCEIRO_CNPJ_NAO_CONSULTADO` (`reason` `FALHOU` ou `NAO_ENCONTRADO`): mostre o botão de reconsultar.

**Editar o CNPJ do parceiro** (`PATCH /parceiro/:id`): mande **só os campos alterados**. O CNPJ igual ao gravado não é validado de novo (o legado com DV errado segue editável no resto) e não zera a consulta; permita limpar o campo (`''`) e mantenha as letras do CNPJ alfanumérico (não force só dígitos na máscara). A grid de parceiros ganha `cnpjSituacao`, `cnpjConsultadoEm` e `cnpjConsultaFalhouEm` (`null` = não consultado). As chaves só ligam depois desta tela no ar.

### 9.3 App (`petjourney-app`)

- **Carteirinha de vacina:** o CRMV do profissional só aparece quando o aplicador tinha o selo no ato (`profissional.crmv` vem `null` caso contrário; o nome continua). Aplicações antigas do dev ficaram sem o CRMV. A tela já trata `crmv: null`.
- **Notificação nova:** nenhuma (a decisão vai por e-mail). Nada muda em `rotas-notificacao.ts`.

### 9.4 Site (`petjourney-web`)

- O cadastro do parceiro pelo site passa a receber 400 `CNPJ_INVALIDO` para CNPJ de dígito errado. **Valide o dígito verificador no formulário antes de enviar** (o mesmo cálculo da Receita, inclusive o alfanumérico: letras valem o código ASCII menos 48) e mostre a `message` no campo quando a API recusar.

### 9.5 Contrato

- `contrato/openapi.json` ganha 14 rotas e 31 esquemas, todos aditivos (a correção da auditoria somou `GET .../eu/identidade/consentimento/{versao}`, `POST /admin/verificacoes-identidade/recusar-em-lote`, os esquemas do lote, do consentimento e do histórico, e o enum `AtoLegal`). `EuNoParceiroDto` ganha 4 campos, `VerificacaoDaPessoaDto` ganha `motivoDoSistema` e `analiseExpiraEm`, `ChaveDaConfiguracaoDto` ganha `editavelPeloCms`, e o enum `CodigoClinico` ganha os 31 códigos da E1-08. Nenhuma rota some e nenhum campo muda de tipo.

### 9.6 Pronto quando

- No dev, uma conta nova com CRMV na ficha vê os 4 atos com o aviso de conferência, envia documento e selfie, o CMS aprova e confere o CRMV, e a pessoa assina uma receita.
- A fila do CMS mostra a idade do envio mais antigo; o detalhe abre as três imagens, e as URLs param de abrir depois de 5 minutos.
- A recusa e a revogação aparecem na tela da pessoa com o motivo, e o reenvio funciona.
- O contador `selosVencendo` aparece só para quem tem `equipe.gerir`.
- O cadastro com CNPJ de dígito errado mostra o erro no campo.
