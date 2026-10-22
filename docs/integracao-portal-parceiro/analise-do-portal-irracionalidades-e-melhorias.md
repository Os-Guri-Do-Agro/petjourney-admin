# Análise do portal do parceiro: irracionalidades, melhorias e o que falta

**Para:** Nicolas e o frontender do `petjourney-admin`
**Data:** 2026-10-20
**O que foi lido:**
- o `petjourney-admin` depois de `git fetch`: `origin/main` em `cd813e7` (16/10, igual ao `develop`) e `origin/redesign/portal` em `290f279` (20/10, 42 commits à frente, 325 arquivos);
- os 21 documentos de requisito em `docs/clinico/` e `docs/hotel/`;
- os tipos e regras de `src/features/*`, os serviços reais em `src/service/`, o roteador e a autenticação;
- o schema e as rotas da API (`petjourney-api`, `develop` `6367d58`).

Nenhum arquivo do portal foi editado.

**Documentos irmãos:** o [épico guarda-chuva](../../../../epicos/portal-do-parceiro.md) com as 41 specs de backend.

---

## 1. Em uma tela

1. **O trabalho do frontender é bom e está bem documentado.** Os docs `clinico/01` a `18` e `hotel/01` a `03` auditam o próprio código, registram decisões com motivo e cobrem casos difíceis com teste. Boa parte das regras de produto deste épico saiu deles. As irracionalidades abaixo são de **arquitetura e de contrato**, quase nunca de cuidado.
2. **O problema central é de fronteira.** O portal construiu, sem API, um sistema clínico e de hotel inteiro, com as regras de negócio dentro do navegador e um contrato de rotas escrito à mão e copiado à mão para o app. Quando a API existir, tudo isso vira segunda fonte da verdade, a menos que a gente porte as regras para o servidor e o portal as apague.
3. **Quatro riscos pedem ação antes de qualquer cliente real:**
   - o módulo mock alcançável em produção por qualquer conta;
   - o áudio da consulta indo ao Google pelo microfone do navegador;
   - a receita que diz "assinada" sem assinatura de verdade;
   - a equipe que só se administra com ID passado pelo suporte.
4. **O que falta não está no portal:** financeiro, cobrança, nota fiscal e WhatsApp, que são o que a concorrência vende junto com agenda e prontuário (épico [E9](../../../../epicos/portal-parceiro-e9-lacunas.md)).

---

## 2. O que está bom (e deve ficar)

- **Regras ditas em voz alta, com o porquê:**
  - "nada bloqueia, tudo avisa" na agenda;
  - "atraso é lido, nunca gravado";
  - "boletim de piora retido até a ligação";
  - "sem registro não é dose perdida";
  - "dado errado é pior que dado em branco" no migrador;
  - "assinar congela".

  Todas viraram decisão das specs.
- **Testes de domínio de verdade**, mais de 300 entre clínico e hotel. Eles viram os golden tests do porte para a API.
- **Acessibilidade e i18n levados a sério:** cor nunca sozinha, `prefers-reduced-motion`, RTL, plural em sérvio e árabe.
- **Cuidado com o responsável:** óbito nunca por push, pulada em pêssego e não em vermelho, consentimento separado para notas do diário.

---

## 3. Irracionalidades, por severidade

Formato: **onde** · o que está errado · por que importa · melhoria · dono.

### Crítico e Alto

**A1. Módulo mock alcançável em produção por qualquer conta.**
- **Onde:** `src/composables/useModuloOculto.ts`, `src/router/index.ts` (guarda de navegação), `?clinico=on` e `?hotel=on`.
- **Errado:** quem liga as telas é o cliente, gravando no `localStorage`. Pet shop, farmácia e operador sem papel veem o módulo clínico e o hotel com dados fictícios. O próprio comentário do arquivo conta que as telas apareceram para uma conta recém-criada em produção.
- **Importa:** cliente real pode tomar demonstração por produto; quando as rotas forem reais, o gate precisa existir no servidor.
- **Melhoria:** módulo ligado pela API (E1-02, `GET /parceiro/portal/modulos`); o mock só no build de desenvolvimento ou numa conta de demonstração com dados do seed da API.
- **Dono:** back (E1-02) + front.

**A2. O contrato é escrito à mão no portal e copiado à mão para o app.**
- **Onde:** `src/features/clinico/contrato/responsavel.ts` (2196 linhas) e `hotel/contrato/responsavel.ts`; doc `clinico/09`: "Copie o contrato como está... se o contrato precisar mudar, a mudança começa no admin e é recopiada".
- **Errado:** a fonte da verdade do contrato fica no cliente, sem pacote compartilhado; 69 rotas que a API não tem, com prefixo `/publico` (a API usa `/public`).
- **Importa:** três cópias divergem no primeiro ajuste. A API já versiona `contrato/openapi.json` e espera que os fronts gerem tipos dele.
- **Melhoria:** decisão A3 (a API é dona). O portal e o app geram os tipos do OpenAPI (por exemplo com `openapi-typescript`); o `responsavel.ts` vira histórico.
- **Dono:** back + front.

**A3. As regras de negócio moram no navegador.**
- **Onde:** cerca de 40 arquivos em `src/features/*/domain/`:
  - conflitos e slots da agenda;
  - prazo de cancelamento, posição na fila;
  - prazo em expediente dos pedidos;
  - protocolo vacinal, lote vencido;
  - preço, meia diária e sinal do hotel;
  - disponibilidade da acomodação;
  - alerta de adesão;
  - retenção do boletim, que o próprio doc chama de "regra do servidor", mas que mora no repositório mock;
  - `service/parceiro/regras-de-saque.ts`.
- **Importa:** regra no cliente é contornada pela próxima tela ou por uma chamada direta à API; dois lugares para a mesma regra divergem.
- **Melhoria:** portar cada regra para a API como função pura, usando os testes do portal como golden tests (P2 do épico pai); quando a rota existir, o portal apaga a regra local e só exibe o que o servidor calculou (`podeCancelar`, `posicao`, `situacao`, `capacidadeDeSaque`).
- **Dono:** back (porte) + front (apagar).

**A4. A anamnese por voz manda o áudio da consulta ao Google.**
- **Onde:** `data/fontes-da-escuta.ts` e doc `clinico/10` ("No Chrome, o áudio passa pelo serviço de voz do Google").
- **Errado:** a voz do responsável e o relato clínico saem para um terceiro sem contrato de operador da PetJourney.
- **Importa:** LGPD. A clínica é controladora do dado e a PetJourney é operadora, e o operador não pode mandar dado para um suboperador sem contrato.
- **Melhoria:** só o modo demonstração (áudio roteirizado) até a E4-07 entregar transcrição no servidor com provedor contratado, bench e LIA.
- **Dono:** produto + back.

**A5. O receituário promete o que não cumpre.**
- **Onde:** `AssinaturaEletronica` com código "derivado de forma determinística" (`data/types.ts:1329-1349`); "Portaria 344/98" em todo controle especial (`types.ts:1325-1375`, doc `clinico/04`).
- **Errado:**
  - o código não é assinatura (nem avançada nem qualificada, nos termos da Res. CFMV 1.465/2022);
  - produto controlado de uso veterinário segue o MAPA (Portaria 837/2025), não a 344;
  - as listas que exigem Notificação de Receita usam talonário oficial e não saem por sistema.
- **Importa:** documento clínico com aparência de válido circulando sem validade jurídica.
- **Melhoria:** E4-03 (PDF no servidor, hash, assinatura avançada declarada no rodapé, folha por regime, gate jurídico); até lá, a demonstração não diz "assinada".
- **Dono:** produto e jurídico + back.

**A6. A equipe não se administra.**
- **Onde:** `components/parceiro/sections/PortalEquipeSection.vue:140-160` ("Informe o ID do usuário (fornecido pelo suporte)"), `pages/(accounts)/parceiro/convite.vue` (ID do parceiro digitado).
- **Causa na API:** não há listagem (`parceiro-portal.controller.ts:152-170`), o convite exige conta e responde 404 sem ela, o que revela quais e-mails têm conta, e nenhum e-mail é enviado.
- **Melhoria:** E0-01.
- **Dono:** back + front.

**A7. O migrador baixa a base inteira da clínica para o navegador.**
- **Onde:** `migracaoRepository.base()` (`data/repositories/migracao-repository.ts:121-126`).
- **Errado:** para achar duplicados, o planejador recebe todos os clientes e pacientes, com CPF e telefone.
- **Importa:** com base real (15 mil pacientes), é PII inteira exposta no cliente e um payload pesado.
- **Melhoria:** E2-05 (duplicados contra a base no servidor; o portal só manda as linhas e responde as dúvidas).
- **Dono:** back + front.

**A8. Tokens no `localStorage`.**
- **Onde:** `service/auth/auth-session.ts:95-115`.
- **Errado:** com "lembrar acesso", o access token e o refresh token (rotativo, de 30 dias na API) ficam no `localStorage`.
- **Importa:** qualquer XSS no portal (que vai mostrar texto livre de clínica e de responsável) rouba uma sessão de 30 dias com acesso a prontuário.
- **Melhoria:** refresh em cookie `httpOnly; Secure; SameSite=Strict` emitido pela API, com o access só em memória. Exige mudar o CORS para `credentials: true` com origens explícitas.
- **Dono:** back + front. Proponho spec própria depois da onda 1 (não está nas 41 specs).

### Médio

| # | Onde | O que está errado | Melhoria | Dono |
|---|---|---|---|---|
| M1 | `pages/(shared)/auth/login.vue:164`, `components/parceiro/PartnerPageFrame.vue:97`, `composables/useAppNavigation.ts:10` | `veterinarioId` e `hasVeterinarioProfile()` decidem rota e menu, contra a regra "veterinário não é perfil" | Menu pelo `GET /parceiro/portal/eu` (E1-03) e módulos (E1-02); E0-03 item 5 | front |
| M2 | `pages/(accounts)/veterinario/*` | O módulo da clínica mora em `/veterinario/*`, mas é usado por recepção e enfermagem, e o produto não tem perfil veterinário | Renomear para `/clinica/*` com redirect | front |
| M3 | contrato do portal | `/publico/...` contra `/public/...` da API | Seguir o OpenAPI | front |
| M4 | `Clinic.utcOffset`, `Hotel.utcOffset`, `clinic-time.ts` | Offset fixo (`-04:00`) em vez de fuso IANA: quebra com horário de verão e com parceiro no exterior (o portal fala en-GB, sr e ar) | Fuso IANA do estabelecimento (E1-01), datas com o offset do instante | back + front |
| M5 | `PetSpecies` do portal | `canina`, `felina`, `ave`, `roedor`, `reptil`, `equina` contra `CACHORRO`, `GATO`, `AVE`, `ROEDOR`, `COELHO`, `PEIXE`, `REPTIL`, `OUTRO` da API: falta coelho e peixe, sobra equino | Enum da API + `especieOutra` (E2-01, D1) | front |
| M6 | `features/clinico` e `features/hotel` | Domínio duplicado: `Clinic`, `Hotel` e o `Parceiro` real; `Professional` e o `Cuidador` (equipe) do hotel; `Plantao` e `Turno`; dois boletins; `clinic-time` e `hotel-time`; dois `mock-runtime`. E **`Cuidador` quer dizer duas coisas**: família do responsável no clínico (`types.ts:1021`) e funcionário no hotel (`hotel/data/types.ts:299`) | No backend: um `Profissional`, um `Turno`, um padrão de boletim. No front: nomes únicos | front (back já unificado nas specs) |
| M7 | hotel, check-in | `VeterinarioDoPet` em texto livre e exigências só por comprovante digitado | Ler a carteirinha do app e as clínicas com vínculo (E7-04, D1 e D4): é o diferencial do ecossistema | back + front |
| M8 | `src/locales/*.json` e templates | Travessão longo: 51 linhas no `pt.json` (45 no `en`, `en-GB` e `es`, 2 no `sr` e `ar`) e cerca de 40 ocorrências direto em `<template>` (`CheckInDialog.vue` 5, `rotina-padrao.vue` 3, `NovaReservaDialog.vue` 3, `GradeDeOcupacao.vue` 3, `CarteirinhaNoApp.vue` 3...). A regra do produto proíbe, e viram texto visível ao ligar o módulo. A `redesign/portal` não melhorou | Trocar por ponto, dois-pontos ou reescrita; incluir o travessão no `check:i18n` e um lint para templates | front |
| M9 | `pages/(accounts)/parceiro/equipe.vue:34`, `PortalEquipeSection.vue:96-164`, `auth-session.ts:99` | Texto fixo em português fora do i18n, num produto com 6 idiomas | Chaves nos 6 locales | front |
| M10 | repo do portal | Sem CI (não há `.github/workflows`): typecheck, testes e `check:i18n` dependem de alguém rodar. Há teste conhecido falhando por data (`estoque-dataset.spec.ts`, registrado no README do hotel) | CI com `vue-tsc`, `vitest`, `check:i18n` e lint; datas fixas nos seeds | front |
| M11 | `redesign/portal` | 42 commits, vários "wip", +75 mil e -44 mil linhas, sem merge; o `main` está parado desde 16/10 | Mesclar já (é avanço direto: 0 commits atrás do `main`) antes que as telas novas de API entrem no `main` e conflitem | front |
| M12 | arquivos | `acessos/[id].vue` com 2936 linhas, `AppShell.vue` 1954, `PortalDivulgacaoPanel.vue` 1693, `estoque.vue` 1531, `AnotacaoEstruturadaFields.vue` 1480, `seed.ts` 3114 | Quebrar por seção quando cada tela for ligada à API | front |
| M13 | docs `clinico/09`, `12`, `14`, `16` | Endereçados "ao agente do app" com caminhos antigos (`D:\PROJETOS\...`) e com o protocolo "a mudança começa no admin" | Atualizar para "o contrato é o OpenAPI da API"; os handoffs da API em `docs/implementacao-por-superficie/` passam a ser a referência | front |
| M14 | `/parceiro/acessos` e o módulo clínico | Duas implementações do mesmo conceito (reconhecido no doc `clinico/06`); o adaptador `domain/anotacao.ts` existe e nenhuma tela o chama | Com a API, o prontuário da clínica (E4) fica para quem tem vínculo e o acesso temporário segue para quem não tem; o adaptador sai | front |
| M15 | `useClinicoPendencias.ts`, `HomeEspacoClinica.vue` | Selos do menu e números do Início calculados no cliente | `GET /parceiro/portal/pendencias` (E1-06) | back + front |
| M16 | `data/boletim-texto.ts` | O boletim é montado em português, embora o doc diga "no idioma dele"; notificações em sr e ar caem em português | Molde por idioma no servidor (E5-03, D4) | back |
| M17 | `data/fixtures/clinic.ts:74` e doc `clinico/06` | Prazo da oferta de vaga: 30 min no fixture e "countdown de 15 minutos" na conversa com o app | Política em tabela por clínica (E3-01) | back |

### Baixo

- **B1** `v-html` em `LanguageSwitcher.vue:195,203` com o SVG da bandeira da biblioteca `country-flag-icons`. Risco baixo, mas vale um comentário dizendo que a origem é estática.
- **B2** Desfazer de 8 s só no cliente. Vira token no servidor (E3-02, D5).
- **B3** O migrador reconhece SimplesVet e Vetus por cabeçalhos **presumidos** (doc `clinico/11`). Não usar "importa do SimplesVet" em material comercial antes de testar com export real.
- **B4** Hotel: o acompanhante é cobrado e não é operado (README do hotel). A recomendação é uma estadia por animal (E7-04, D8).
- **B5** O doc `clinico/06` chama `AnotacaoEstruturadaFields.vue` de "o formulário que escreve no prontuário do pet". Ele escreve na **anotação**, que o responsável importa (D1). Corrigir para não induzir a próxima pessoa.
- **B6** Do nosso lado: o README dos handoffs da API cita a flag `FAMILIA_LEITURA_PRONTUARIO`, que não existe mais em `src/`.

---

## 4. Melhorias de produto que a ponte com o app destrava

São as coisas que nenhum concorrente consegue copiar sem ter o app do responsável com base instalada:

1. **A carteirinha do app como comprovante do hotel.** "Chega hoje sem a vacina da tosse" vira aviso na reserva, não surpresa no balcão (E7-04).
2. **"Minhas clínicas" com quem viu o quê.** Transparência de acesso como argumento de confiança (E1-05 e E2-02).
3. **QR da carteirinha propõe o vínculo.** A clínica lê o QR na recepção, e o dono aceita no app sem a clínica saber quem ele é antes do aceite (E2-02).
4. **Pré-consulta preenchida pelo diário** e o "Este pet em 30 segundos" com o que aconteceu em casa (E2-03 e E3-07).
5. **Boletim de internação e de hotel** sem ligação, com a regra de notícia grave por voz (E5-03 e E7-05).
6. **Adesão real no retorno**, sem tom de julgamento (E4-05).
7. **Uma página pública por estabelecimento**: clínica e hotel no mesmo slug, com agendamento e reserva (E1-01).

---

## 5. O que falta

**Na API** (são as 41 specs do épico): tudo do módulo clínico e do hotel. Hoje nenhuma rota existe.

**No portal, com API já pronta** (spec de integração [E0-03](e0-consertos/03-pendencias-de-front-com-api-pronta.md)):
- indicados do parceiro;
- categoria `VETERINARIO` no cadastro;
- escolha granular do acesso temporário;
- espécie OUTRO;
- tirar o `veterinarioId` da UI.

**Fora do desenho dos dois** ([E9](../../../../epicos/portal-parceiro-e9-lacunas.md)):
- planos do parceiro e cobrança B2B;
- Pix;
- WhatsApp;
- financeiro, PDV e estoque geral;
- fiscal;
- banho e tosa;
- app do veterinário;
- laboratório;
- ICP-Brasil e telemedicina;
- multiunidade, encaminhamento, campanhas, farmácia conectada, prevenção preditiva, diretório, creche, conferência de CRMV, balcão offline;
- Documentos privados no app.

---

## 6. Ordem recomendada para o portal, acompanhando as ondas da API

| Onda da API | O que o portal faz |
|---|---|
| 0 (E0) | Equipe pela lista, caixa de convites, capacidade de saque da API; os itens da E0-03; CI no repo; mesclar a `redesign/portal` |
| 1 (E1 e E2) | Menu e módulos pelo servidor; gerar tipos do OpenAPI; trocar os repositórios de paciente e cliente pela API; migrador com dúvidas do servidor; travessão e textos fixos fora |
| 2 (E3, E4-02, E4-04) | Agenda, pedidos, fila, faltas e vacinação pela API; apagar as regras locais correspondentes; páginas públicas em `/public` |
| 3 a 5 | Prontuário, receita, adesão, documentos, internação, estoque, hotel; cada tela troca o mock pela rota assim que ela existir, e o mock vira só demonstração |

## Change Log

| Data | Versão | Mudança | Autor |
|---|---|---|---|
| 2026-10-20 | 0.1 | Criação | Nicolas (via Claude) |
