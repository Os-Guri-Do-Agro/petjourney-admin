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

### 1.2 Página pública (portal ou site, conforme a Q2)

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
- **Se a Q2 levar a página para o site (Next):** renderizar no servidor faz todo pedido sair do mesmo IP e bater no limite de 30 por minuto. Use ISR ou cache de 60 s no site; a API já guarda 60 s.
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
