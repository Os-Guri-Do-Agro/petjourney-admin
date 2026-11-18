# Registro de uso da plataforma

Pedido do Luís em 18/11/2026: a equipe PetJourney acompanhar, pelo CMS, o que cada pessoa faz na
plataforma, filtrando por `usuarioId`: se entrou, quando, de onde e quais telas abriu.

## Decisão

- **Tudo fica na nossa API**, sem serviço de fora (PostHog e parecidos ficaram de fora): a consulta é
  pelo CMS, o dado não sai de casa e o registro de acesso com IP é obrigação do Marco Civil (6 meses).
- **Login, saída, troca de perfil e troca de senha** são gravados pela API. Só o servidor sabe se a
  senha conferiu.
- **Telas abertas** são enviadas pelo front, em lote, só com o molde da rota
  (`/clinica/paciente/:petId/resumo`) e um nome legível. Nunca ID, busca digitada ou dado clínico.
- **Só a equipe lê** (SystemAdmin), no CMS. Registros ficam 180 dias.

O contrato completo, com modelo, rotas, regras e critérios de aceite, está em
[plano-backend.md](plano-backend.md), escrito para o Nicolas.

## Fases

| Fase | O quê | Onde | Estado |
| --- | --- | --- | --- |
| 1 | Tabela `EventoDeUso`, gravação no `auth`, `POST /uso/eventos`, `GET /admin/uso/*`, retenção | API | plano pronto, espera o Nicolas |
| 1 | Envio das telas abertas | portal | feito, desligado sozinho até a rota existir |
| 1 | Tela "Uso da plataforma" com filtros, resumo da pessoa e lista por dia | CMS | feita, mostra aviso até a rota existir |
| 1 | Link "Ver uso" na lista de usuários | CMS | feito |
| 2 | Envio das telas abertas do app (`superficie: APP`) | app | depois da fase 1 no ar |
| 2 | Texto da política de privacidade citando o registro | site | espera o texto do jurídico |

Enquanto o app não manda telas, o uso dele já aparece pelo `LOGIN` e pelo `SESSAO_RETOMADA` (quem
abre o app já logado faz refresh, e o refresh depois de 30 min parado vira "voltou a usar").

## Portal (feito)

- `src/service/uso/registro-de-uso.ts`: fila, envio em lote, regras de erro.
- `src/service/uso/titulos-das-telas.ts`: nome de cada tela. Um teste falha quando entra tela nova sem
  nome, para o mapa não envelhecer calado.
- Instalado no `main.ts` (`instalarRegistroDeUso`), olhando o `router.afterEach`.

Regras:

- Só com sessão aberta. Fora: login, cadastro, páginas públicas (`/agendar`, `/reservar`), a página
  de "não encontrada" e a demonstração com dados locais.
- Troca só de query ou hash não conta como tela nova. Outro paciente na mesma tela conta.
- Envia a cada 10 s, ou quando a fila chega a 20, ou quando a aba some (`keepalive`).
- 404 (rota ainda não publicada) desliga o envio até recarregar a página. 401 e 400 descartam o lote
  sem derrubar a sessão. Erro de rede, 429 e 5xx guardam a fila (até 200) para o próximo ciclo.
- Evento de uma pessoa nunca sai com o token de outra (troca de conta na mesma aba descarta a fila).

## CMS (feito)

- Tela `/uso-da-plataforma`, item "Uso da plataforma" no menu, logo abaixo de Usuários.
- Filtros: usuário (ID ou e-mail), o quê (tudo, entradas e saídas, telas abertas, logins
  recusados), onde (portal, app, site, CMS) e período (padrão: últimos 7 dias; no máximo 92). Os
  filtros ficam na URL, então o link pode ser mandado para alguém da equipe.
- Com uma pessoa no filtro: cartão com último acesso, último login (aparelho e IP), contagens dos
  30 dias, telas mais abertas e aparelhos.
- Lista por dia, mais recente primeiro, com "Carregar mais". Clicar no nome de alguém filtra por ela.
- Na lista de usuários, o botão "Ver uso" de cada linha abre a tela já filtrada.
- Sem a rota na API, a tela explica que o registro ainda não foi publicado, em vez de dar erro.

## Como testar quando a API subir no dev

1. Entrar no portal de dev com uma conta de QA e abrir algumas telas (Agenda, um paciente, Equipe).
2. Esperar 10 s ou trocar de aba.
3. No CMS de dev, Uso da plataforma, filtrar pelo e-mail da conta: o login e as telas aparecem, na
   ordem, com o nome de cada tela.
4. Errar a senha uma vez no portal e conferir o "Login recusado".
5. Abrir o app já logado depois de 30 min parado e conferir o "Voltou a usar" com superfície App.

## Pendências

- Endereços reais do CMS e do site para a variável `ORIGENS_DAS_SUPERFICIES` da API.
- IP nos logins do CMS (o proxy do Next esconde o IP; ver seção 7.2 do plano do backend).
- Política de privacidade.
