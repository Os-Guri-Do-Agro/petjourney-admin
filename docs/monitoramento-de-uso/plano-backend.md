# Registro de uso da plataforma: plano do backend

**Para:** Nicolas (petjourney-api)
**De:** Luís (portal e CMS), 18/11/2026
**Estado:** o portal já envia as telas abertas e o CMS já tem a tela de consulta, os dois esperando
as rotas deste plano. Até lá, o portal recebe 404 uma vez, para de enviar e não incomoda ninguém, e
o CMS mostra o aviso "registro de uso ainda não publicado na API".

---

## 1. O que a equipe pediu

A equipe PetJourney quer acompanhar, **pelo CMS**, o que cada pessoa faz na plataforma:

- se entrou, quando e de onde (portal, app, site, CMS; aparelho; IP);
- se errou a senha ou foi barrada;
- quais telas abriu no portal (e, numa segunda fase, no app);
- tudo filtrável por `usuarioId` (ou e-mail), tipo de evento, superfície e período.

Não é a trilha clínica (E1-05). A `TrilhaClinica` responde "quem leu ou mexeu no prontuário" e é
lida pelo dono da clínica. Este registro responde "quem usou a plataforma, quando e onde" e é lido
só pela equipe PetJourney (SystemAdmin). Os dois continuam separados.

## 2. O que já existe e é reaproveitado

| Já existe | Onde | Uso aqui |
| --- | --- | --- |
| `Usuario.ultimoAcessoEm` (uma gravação por dia, no login e no refresh) | `auth.service.ts`, `registrarAcesso` | continua como está; o resumo do CMS mostra o valor |
| `ContextoCliente`: canal, plataforma, versão do app, ID do aparelho | `sinais-cliente/helpers/classificar-cliente.helper.ts` | o canal e a plataforma do evento saem daqui |
| `ipParaSinal` e o `trustProxy` validado em 14/08 | `influencer/helpers/sinais.helper.ts`, `main.ts` | a regra do IP (seção 7.2) segue o mesmo raciocínio |
| Retenção de 180 dias com cron diário | `SinaisClienteService.limparRetencao` | mesmo molde, mesma janela |
| Guards `JwtAuthGuard` + `SystemAdminGuard` na classe | `sinais-cliente-admin.controller.ts` | mesmo molde para as rotas do CMS |
| Advisory lock para cron com 3 réplicas | `notificacao/helpers/advisory-lock.helper` | a limpeza diária roda numa réplica só |

## 3. Decisões

- **D1. Uma tabela nova, `EventoDeUso`, só de gravação.** Nenhuma linha é editada. Sai só pela
  retenção.
- **D2. Login, saída e troca de senha são gravados pela API, nunca pelo front.** Só o servidor sabe
  com certeza se a senha conferiu. O front só pode mandar `TELA_ABERTA`; qualquer outro tipo vindo
  do corpo é 400.
- **D3. Sem chave estrangeira para `Usuario`**, como na `TrilhaClinica`. O Marco Civil da Internet
  (Lei 12.965/2014, art. 15) obriga o provedor de aplicação a guardar o registro de acesso (data,
  hora e IP) por 6 meses, e a LGPD (art. 16, I) permite manter o dado para cumprir obrigação legal.
  Se a conta for apagada, o registro fica até vencer os 180 dias.
- **D4. Retenção de 180 dias** pelo campo `em`, cron diário com advisory lock, apagando em lotes.
- **D5. A tela vai como molde de rota, nunca com ID nem busca.** O front manda
  `/clinica/paciente/:petId/resumo`, e não `/clinica/paciente/cmw2.../resumo?busca=Bolota`. A API
  recusa `rota` com `?` ou `#`. O registro diz **o quê**, não **de quem**: quem leu qual paciente já
  está na `TrilhaClinica`.
- **D6. Nunca gravar User-Agent cru.** Igual à `SinalCliente`. O evento guarda só o resumo
  ("Chrome 131 · Windows"), feito na API (seção 7.3).
- **D7. A superfície (PORTAL, APP, SITE, CMS) sai do `Origin` da requisição**, por um mapa em
  variável de ambiente. Nenhum front muda cabeçalho e o CORS não muda. No `TELA_ABERTA` vale a
  superfície que o corpo declara.
- **D8. Refresh vira `SESSAO_RETOMADA` só depois de 30 min parado.** O access token dura 15 min:
  gravar todo refresh encheria a tabela sem dizer nada. Com a janela de 30 min, o evento quer dizer
  "voltou a usar", e é o único sinal de uso do app enquanto o app não manda telas (quem abre o app
  já logado não faz login, faz refresh).
- **D9. Gravação best-effort.** Como o `registrarAcesso`: erro ao gravar vira `logger.warn` e o
  login segue. Não espera a gravação para responder (`void`).
- **D10. Só a equipe lê.** As rotas de leitura ficam em `/admin/uso/*` com `JwtAuthGuard` +
  `SystemAdminGuard` na classe.

## 4. Modelo de dados

Migration nova, sem mexer em tabela existente. Nenhuma leitura atual passa a pedir coluna nova,
então não tem a armadilha de ordem do `ultimoAcessoEm` (a API pode subir junto com a migration,
desde que a migration rode antes).

```prisma
/// Registro de uso da plataforma, lido pela equipe no CMS (docs/monitoramento-de-uso).
/// Sem FK de propósito (D3): o registro de acesso fica os 180 dias do Marco Civil
/// mesmo que a conta seja apagada. Só gravação; sai só pela retenção.
model EventoDeUso {
  id          String           @id @default(cuid())
  usuarioId   String
  tipo        TipoEventoDeUso
  superficie  SuperficieDeUso  @default(DESCONHECIDA)
  canal       CanalCliente
  /// Perfil ativo no token ("TUTOR", "PARCEIRO"). null no login, que ainda não tem perfil.
  perfil      String?
  /// Empresa em que a pessoa estava. Só grava se ela é da equipe (ACEITO e ativa).
  parceiroId  String?
  /// TELA_ABERTA: molde da rota, sem ID nem query (D5).
  rota        String?
  /// TELA_ABERTA: nome da tela que o front manda ("Paciente · Resumo").
  titulo      String?
  /// LOGIN_RECUSADO: SENHA_ERRADA ou CONTA_BANIDA.
  motivo      String?
  /// UUID da aba (front). Agrupa uma visita. Nunca o token.
  sessaoId    String?
  /// UUID do evento gerado pelo front: o reenvio não duplica.
  idCliente   String?
  /// Seção 7.2. null quando a requisição passou pelo proxy do Next (site, CMS).
  ip          String?
  /// "Chrome 131 · Windows" ou "App 2.4.1 · Android" (D6).
  dispositivo String?
  plataforma  PlataformaDevice?
  /// Versão do app (X-App-Version) ou do portal (corpo do lote).
  versao      String?
  /// Quando aconteceu. Servidor nos eventos da API; hora do front, limitada, no TELA_ABERTA.
  em          DateTime         @default(now())
  recebidoEm  DateTime         @default(now())

  @@unique([usuarioId, idCliente])
  @@index([usuarioId, em])
  @@index([em])
  @@index([tipo, em])
  @@index([parceiroId, em])
}

enum TipoEventoDeUso {
  LOGIN
  LOGIN_RECUSADO
  LOGOUT
  SESSAO_RETOMADA
  PERFIL_TROCADO
  SENHA_TROCADA
  TELA_ABERTA
}

enum SuperficieDeUso {
  PORTAL
  APP
  SITE
  CMS
  DESCONHECIDA
}
```

No Postgres, a `@@unique([usuarioId, idCliente])` aceita vários `idCliente` nulos, então os eventos
da própria API (sem `idCliente`) não colidem.

**Volume esperado:** o portal manda uma linha por tela aberta. Com algumas centenas de pessoas na
equipe das clínicas e uns 100 cliques de tela por pessoa por dia, são dezenas de milhares de linhas
por dia e alguns milhões no teto dos 180 dias. Os índices acima seguram isso sem partição. Quando o
app mandar telas (fase 2), refazer a conta.

## 5. O que a API grava sozinha

Os controllers de `auth` passam a receber a requisição (`@Req() req: FastifyRequest`) para montar o
contexto (seção 7). O serviço novo é chamado com `void` depois que a resposta já está decidida.

| Rota | Quando | Evento | Campos além do contexto |
| --- | --- | --- | --- |
| `POST /auth/login` | senha conferiu e conta ativa | `LOGIN` | |
| `POST /auth/login` | conta existe, senha errada | `LOGIN_RECUSADO` | `motivo: SENHA_ERRADA` |
| `POST /auth/login` | senha certa, `ativo = false` | `LOGIN_RECUSADO` | `motivo: CONTA_BANIDA` |
| `POST /auth/login` | e-mail ou CPF sem conta | nada | não há `usuarioId`; não gravar o que foi digitado |
| `POST /auth/refresh` | sucesso e nenhum evento do usuário na mesma superfície nos últimos 30 min | `SESSAO_RETOMADA` | `perfil` pedido, se houver |
| `POST /auth/logout` | o refresh token existia | `LOGOUT` | `usuarioId` sai da linha do `RefreshToken` |
| `POST /auth/trocar-perfil` | sucesso | `PERFIL_TROCADO` | `perfil`, `parceiroId` resolvido |
| `POST /auth/reset-password` | sucesso | `SENHA_TROCADA` | `motivo: RECUPERACAO` |
| `POST /auth/reset-password-authenticated` | sucesso | `SENHA_TROCADA` | `motivo: TROCA_LOGADO` |

Detalhes:

- **`LOGIN_RECUSADO` não muda a resposta.** Continua 401 "Credenciais inválidas" igual para conta
  inexistente e senha errada; o registro é só interno. A banida continua com a mensagem dela.
- **A conta da senha errada precisa existir** para gravar. Não gravar o e-mail digitado (seria dado
  pessoal de quem talvez nem é cliente).
- **`SESSAO_RETOMADA`**: uma consulta pelo índice `(usuarioId, em)`:
  `findFirst({ where: { usuarioId, superficie, em: { gte: agora - 30 min } }, select: { id: true } })`.
  Se achou, não grava. Com 3 réplicas, dois refresh no mesmo segundo podem gravar dois eventos: é
  aceitável, não precisa de lock.
- **`perfil` e `parceiroId` dos eventos autenticados** (`TELA_ABERTA`, `PERFIL_TROCADO`): vêm do
  token (`perfilAtivo`, `parceiroAtivoId`) quando presentes.

## 6. Rotas

### 6.1 `POST /uso/eventos` (front envia as telas)

`JwtAuthGuard`. Qualquer perfil logado. Limite de 30 chamadas por minuto por IP (`@Throttle`): o
portal envia no máximo a cada 10 s.

```json
{
  "versao": "0.6.1",
  "eventos": [
    {
      "idCliente": "6f0d2c1e-8a8b-4a3e-9d55-2a8f4b1c9e10",
      "tipo": "TELA_ABERTA",
      "superficie": "PORTAL",
      "rota": "/clinica/paciente/:petId/resumo",
      "titulo": "Paciente · Resumo",
      "sessaoId": "1d7c2b9a-0f3e-4c55-8a61-7b9e0d2f4a33",
      "ocorreuEm": "2026-11-18T14:03:11.120Z",
      "parceiroId": "cmw2biy4500910pp46rm10bk4"
    }
  ]
}
```

Validação (DTO com `class-validator`, `whitelist` e `forbidNonWhitelisted`):

| Campo | Regra |
| --- | --- |
| `eventos` | 1 a 50 itens |
| `versao` | opcional, até 32 caracteres, `^[0-9A-Za-z.+-]+$` |
| `idCliente`, `sessaoId` | UUID |
| `tipo` | só `TELA_ABERTA` (D2) |
| `superficie` | `PORTAL`, `APP`, `SITE` ou `CMS` |
| `rota` | até 200 caracteres, `^/[A-Za-z0-9/_:.()*-]*$` (sem `?`, sem `#`, D5) |
| `titulo` | até 80 caracteres, texto simples |
| `ocorreuEm` | ISO 8601. Fora de `[agora - 24 h, agora + 2 min]` vira `agora` (não recusa) |
| `parceiroId` | opcional. Só grava se a pessoa é da equipe do parceiro (ACEITO e ativa). Se não for, grava `null`, sem recusar o lote |

O que a API faz:

1. `usuarioId` sempre do token, nunca do corpo.
2. Uma consulta para conferir os `parceiroId` distintos do lote contra `ParceiroEquipe`.
3. Monta o contexto (seção 7) uma vez por lote: canal, IP, dispositivo, plataforma.
4. `createMany({ data, skipDuplicates: true })`. O reenvio (o front reenvia depois de erro de rede)
   não duplica, por causa da `@@unique([usuarioId, idCliente])`.

Respostas:

- **202** `{ "recebidos": 1 }` no envelope de sempre.
- **400** com `codigo: "USO_LOTE_INVALIDO"` para corpo fora das regras. O front descarta o lote e não
  tenta de novo.
- **401** sessão vencida. O front descarta o lote **sem derrubar a sessão** (o próximo refresh
  resolve).
- **429** limite. O front segura a fila e tenta no próximo ciclo.

### 6.2 `GET /admin/uso/eventos` (lista do CMS)

`JwtAuthGuard` + `SystemAdminGuard` na classe, controller `admin/uso`.

| Parâmetro | Regra |
| --- | --- |
| `usuarioId` | exato |
| `email` | exato, sem diferença de maiúsculas. Sem conta: lista vazia, não 404 |
| `tipo` | um ou mais, separados por vírgula: `LOGIN,LOGIN_RECUSADO` |
| `superficie` | `PORTAL`, `APP`, `SITE`, `CMS` ou `DESCONHECIDA` |
| `parceiroId` | exato |
| `de`, `ate` | `AAAA-MM-DD` (dia inteiro no fuso de Brasília) ou ISO. Sem `de`: `ate - 7 dias`. Sem `ate`: agora |
| `cursor` | opaco, o `proximoCursor` da página anterior |
| `limit` | padrão 50, máximo 200 |

Janela maior que 92 dias: 400 `codigo: "USO_PERIODO_EXCEDIDO"`. `de` depois de `ate` ou data
inválida: 400 `codigo: "USO_PERIODO_INVALIDO"`. Cursor que não decodifica: 400
`codigo: "USO_CURSOR_INVALIDO"`.

Ordem `em desc, id desc`. O cursor carrega os dois (base64 de `em|id`), para não pular nem repetir
evento com o mesmo `em`.

```json
{
  "eventos": [
    {
      "id": "cmx0a1b2c0000",
      "em": "2026-11-18T14:03:11.120Z",
      "tipo": "TELA_ABERTA",
      "superficie": "PORTAL",
      "canal": "WEB",
      "perfil": "PARCEIRO",
      "rota": "/clinica/paciente/:petId/resumo",
      "titulo": "Paciente · Resumo",
      "motivo": null,
      "ip": "177.12.34.56",
      "dispositivo": "Chrome 131 · Windows",
      "plataforma": null,
      "versao": "0.6.1",
      "sessaoId": "1d7c2b9a-0f3e-4c55-8a61-7b9e0d2f4a33",
      "usuario": { "id": "cmw2bh...", "nome": "Daniel Rocha", "email": "dr10572931@gmail.com" },
      "parceiro": { "id": "cmw2biy4500910pp46rm10bk4", "nome": "Clínica Veterinária Bem-Estar" }
    }
  ],
  "proximoCursor": "MjAyNi0xMS0xOFQxNDowMzoxMS4xMjBafGNteDBhMWIyYzAwMDA="
}
```

`usuario` vem `null` quando a conta já foi apagada (D3). `parceiro` vem `null` sem `parceiroId`.
Buscar nome e e-mail com um `findMany` dos ids da página (sem relação no Prisma, por causa da D3).

### 6.3 `GET /admin/uso/usuarios/:usuarioId/resumo` (cartão do topo no CMS)

Mesmos guards. `?dias=30` (1 a 180, padrão 30).

```json
{
  "usuario": {
    "id": "cmw2bh...",
    "nome": "Daniel Rocha",
    "email": "dr10572931@gmail.com",
    "ativo": true,
    "isSystemAdmin": false,
    "criadoEm": "2026-11-04T12:00:00.000Z",
    "ultimoAcessoEm": "2026-11-18T13:58:00.000Z"
  },
  "janelaDias": 30,
  "ultimoLogin": {
    "em": "2026-11-18T13:58:00.000Z",
    "superficie": "PORTAL",
    "ip": "177.12.34.56",
    "dispositivo": "Chrome 131 · Windows"
  },
  "ultimaAtividade": { "em": "2026-11-18T14:03:11.120Z", "tipo": "TELA_ABERTA", "superficie": "PORTAL" },
  "contagem": { "logins": 12, "loginsRecusados": 1, "sessoesRetomadas": 30, "telasAbertas": 418 },
  "superficies": [{ "superficie": "PORTAL", "eventos": 440, "ultimoEm": "2026-11-18T14:03:11.120Z" }],
  "telasMaisAbertas": [
    { "superficie": "PORTAL", "rota": "/clinica/agenda", "titulo": "Agenda", "vezes": 96, "ultimaEm": "2026-11-18T14:01:00.000Z" }
  ],
  "dispositivos": [
    { "dispositivo": "Chrome 131 · Windows", "ultimoIp": "177.12.34.56", "logins": 11, "ultimoEm": "2026-11-18T13:58:00.000Z" }
  ]
}
```

- `ultimoLogin`, `ultimaAtividade`: `null` sem evento.
- `contagem` e `superficies`: `groupBy` dentro da janela.
- `telasMaisAbertas`: os 10 primeiros de `groupBy(['superficie', 'rota'])` em `TELA_ABERTA`; o
  `titulo` é o do evento mais recente daquela rota.
- `dispositivos`: os 5 primeiros dos eventos `LOGIN`, agrupados por `dispositivo`.
- **404** `codigo: "USO_USUARIO_INEXISTENTE"` quando não há conta nem evento com esse id. Conta
  apagada com evento ainda guardado responde 200 com `usuario: null`.

## 7. Contexto de cada evento

Helper novo `src/uso/helpers/contexto-de-uso.ts`, chamado com a requisição Fastify. Nunca lança.

### 7.1 Superfície

Variável nova `ORIGENS_DAS_SUPERFICIES`, lista `origem=SUPERFICIE` separada por vírgula:

```
ORIGENS_DAS_SUPERFICIES=https://portal.petjourney.health=PORTAL,https://portal-dev.petjourney.health=PORTAL,https://cms.petjourney.health=CMS,https://petjourney.health=SITE,https://www.petjourney.health=SITE
```

No dev, acrescentar `http://localhost:5173=PORTAL` (o CMS e o site locais dividem a porta 3000:
deixar de fora, cai em `DESCONHECIDA`). Confira os endereços reais do CMS e do site antes de
publicar; os acima são exemplo.

Ordem:

1. `Origin` no mapa: a superfície dele.
2. Sem `Origin`, o `Referer`, reduzido à origem (`new URL(referer).origin`), no mapa.
3. Canal `APP` (classificador atual): `APP`.
4. Nada disso: `DESCONHECIDA`.

### 7.2 IP

- **Portal e app** falam direto com a API: `req.ip`, que já é confiável pelo `trustProxy` validado em
  14/08.
- **Site e CMS** passam pelo proxy do Next (`/api/proxy`): o `req.ip` é o do servidor do Next, igual
  para todo mundo. Gravar `null`, pelo mesmo motivo do `ipParaSinal`.
- Regra: grava `req.ip` quando a superfície é `PORTAL` ou `APP`; senão `null`.

Fica para depois (não bloqueia): o proxy do CMS repassar o IP de quem chamou num cabeçalho assinado,
se a equipe quiser IP também nos logins do CMS.

### 7.3 Dispositivo

Função pura `resumirDispositivo(userAgent, plataforma, versaoApp)` sem dependência nova:

- App (canal `APP`): `App <versão> · Android|iOS` a partir de `X-App-Version` e `X-Platform`.
- Navegador: família e versão principal (Edge, Chrome, Firefox, Safari, Opera, Samsung Internet),
  nessa ordem de teste (o UA do Edge contém "Chrome"; o do Chrome contém "Safari"), e o sistema
  (Windows, macOS, Android, iOS, iPadOS, Linux).
- Não reconheceu: `null`. O UA cru nunca é gravado nem logado (D6). Limitar a 512 caracteres antes
  de testar, como `TAMANHO_MAXIMO_UA`.

## 8. Retenção e LGPD

- **Cron diário** (`@Cron('15 4 * * *')`, fora do pico), com `comLock` do advisory lock. Apaga
  `em < agora - 180 dias` em lotes de 5.000 (`deleteMany` por `id in (select ... limit 5000)`) até
  não sobrar, para não segurar a tabela.
- **Base legal:** registro de acesso com IP por obrigação legal (Marco Civil, art. 15; LGPD, art. 7º,
  II) e o resto (telas, aparelho) por legítimo interesse: segurança da conta, suporte e melhoria do
  produto (LGPD, art. 7º, IX). Nenhum dado clínico, nenhum nome de paciente, nenhuma busca digitada.
- **Política de privacidade:** precisa citar o registro de acesso e de navegação. O texto fica com
  quem cuida do jurídico; o site só publica.
- **Pedido do titular** (acesso aos próprios dados): a rota 6.2 filtrada por `usuarioId` já responde.

## 9. Segurança e desempenho

- Nenhuma rota de leitura sem `SystemAdminGuard`. Teste de acesso no estilo de `roles.guard.spec.ts`:
  tutor e parceiro levam 403.
- `logger` nunca recebe IP, e-mail nem User-Agent (o `vazamentos-pii.spec.ts` já confere os
  padrões).
- A gravação do login roda depois de decidir a resposta e não espera; uma falha no banco não muda o
  login.
- O `POST /uso/eventos` não passa pelo `apiFetch` do portal: o portal usa `fetch` com `keepalive`
  para mandar a fila quando a aba fecha. O CORS atual já libera `Authorization` e `Content-Type`.

## 10. Critérios de aceite

1. Login com senha certa grava `LOGIN` com superfície, canal, IP (portal e app) e dispositivo.
2. Senha errada de conta existente grava `LOGIN_RECUSADO` `SENHA_ERRADA`; a resposta continua igual
   à de conta inexistente (mesmo status, mesma mensagem).
3. Conta inexistente não grava nada.
4. Conta banida com senha certa grava `LOGIN_RECUSADO` `CONTA_BANIDA`.
5. Refresh grava `SESSAO_RETOMADA` só sem evento do mesmo usuário e superfície nos 30 min anteriores.
6. Logout com refresh token válido grava `LOGOUT`; token desconhecido não grava e responde igual.
7. Troca de perfil grava `PERFIL_TROCADO` com `perfil` e `parceiroId`.
8. As duas trocas de senha gravam `SENHA_TROCADA` com o `motivo` certo.
9. Falha do banco ao gravar não muda a resposta de nenhuma rota de `auth` (teste com o mock
   rejeitando).
10. `POST /uso/eventos` recusa `tipo` diferente de `TELA_ABERTA`, `rota` com `?` ou `#`, e lote com
    mais de 50 itens (400 `USO_LOTE_INVALIDO`).
11. O mesmo lote enviado duas vezes grava uma vez só.
12. `usuarioId` do corpo é ignorado (vale o do token); `parceiroId` de empresa da qual a pessoa não
    é da equipe vira `null`.
13. `ocorreuEm` fora da janela vira a hora do servidor.
14. `GET /admin/uso/eventos` filtra por cada parâmetro, pagina pelo cursor sem pular nem repetir
    evento com o mesmo `em`, e recusa janela de mais de 92 dias.
15. `GET /admin/uso/usuarios/:id/resumo` responde 404 para id sem conta e sem evento, e 200 com
    `usuario: null` para conta apagada com evento.
16. Tutor e parceiro levam 403 nas duas rotas de `/admin/uso`.
17. A retenção apaga o que tem mais de 180 dias e nada mais novo.
18. `resumirDispositivo` reconhece Edge, Chrome, Firefox e Safari no Windows, macOS, Android e iOS,
    e devolve `null` para texto desconhecido.

## 11. Ordem do release

1. Migration (tabela e enums novos; nada existente muda).
2. API com as rotas e os pontos de gravação. A variável `ORIGENS_DAS_SUPERFICIES` antes do deploy,
   senão tudo sai `DESCONHECIDA` (não quebra, só fica pobre).
3. `npm run openapi:exportar` e o `contrato/openapi.json` novo para o portal e o CMS (o CI dos dois
   confere as rotas).
4. Avisar o Luís: o portal começa a enviar sozinho na próxima carga de página; o CMS mostra os dados
   na hora.

## 12. O que os fronts já fizeram

- **Portal** (`petjourney-admin`, `src/service/uso/`): a cada troca de tela com sessão aberta, põe na
  fila `{ idCliente, tipo: TELA_ABERTA, superficie: PORTAL, rota, titulo, sessaoId, ocorreuEm,
  parceiroId }` e manda em lote a cada 10 s, com 20 na fila ou quando a aba some (`keepalive`). Não
  registra login, página pública nem a demonstração. 404 desliga o envio até recarregar a página.
- **CMS** (`petjourney-cms`, item "Uso da plataforma" do menu, logo abaixo de Usuários,
  `/uso-da-plataforma`): filtros
  (usuário por ID ou e-mail, tipo, superfície, período), cartão de resumo da pessoa, lista por dia
  com "Carregar mais" e link "Ver uso" na lista de usuários. Consome 6.2 e 6.3 exatamente como
  acima.
- **App** (fase 2, ainda não feito): o mesmo `POST /uso/eventos` com `superficie: APP`, a partir do
  `onStateChange` da navegação. Até lá, o uso do app aparece pelo `LOGIN` e pelo `SESSAO_RETOMADA`.

## 13. Perguntas abertas

1. Os endereços reais do CMS e do site para a `ORIGENS_DAS_SUPERFICIES`.
2. A equipe quer IP nos logins do CMS? Se sim, o proxy do Next precisa repassar o IP (seção 7.2).
3. O texto da política de privacidade: quem escreve e quando publica.
