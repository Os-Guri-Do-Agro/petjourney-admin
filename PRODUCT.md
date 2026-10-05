# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Dois usuários principais, e cada módulo decide seus próprios empates de design:

- **Equipe que opera o dia** (módulos Clínica, Pets, Hotel): veterinário, recepção e equipe do
  hotel usando a ferramenta como estação de trabalho durante o expediente inteiro. Agenda,
  prontuário, receituário, internação, rotina de hospedagem. A pergunta de toda tela: *qual
  informação do pet ajuda a agir com segurança agora?*
- **Quem gere o negócio parceiro** (módulo Portal): dono ou equipe da empresa parceira
  operando programas, divulgação (indicação, cupons, resgates), financeiro/carteira e equipe.

Uma mesma conta pode acumular os dois papéis (vet é um Parceiro com categoria
`CLINICA_VETERINARIA` + `crmv`), e o menu mostra só as seções que o perfil permite.

**Quem avalia as telas hoje:** clientes e stakeholders em demonstração. Os módulos Clínico e
Hotel são protótipos navegáveis sobre dados mocados; a tela precisa se explicar sozinha para
quem a vê pela primeira vez, sem narração.

## Product Purpose

Portal web do parceiro PetJourney: reúne num só lugar o que hoje o mercado veterinário e pet
espalha em várias ferramentas (gestão clínica, hospedagem, relação comercial com a rede) e
entrega isso de forma organizada, profissional e bonita.

Sucesso agora: o cliente em demonstração entende o que cada tela faz e para que serve sem
precisar de explicação, e reconhece ali algo melhor que o que já usa. Sucesso depois: a mesma
tela aguenta o uso diário de quem opera.

## Positioning

A ambição é superar SimplesVet, Vetsmart e afins em paridade **e** somar o que nenhum deles
tem, tudo num lugar só. As três frentes que o produto reivindica juntas:

- **Prontuário que viaja com o pet.** O histórico pertence ao pet e ao responsável (o app do
  responsável já está em produção); prestadores autorizados leem e escrevem, com continuidade
  entre clínicas, hotel e outros parceiros.
- **Ecossistema parceiro + responsável.** Clínicas, hotéis e indústria pet ligados ao app do
  responsável, com indicação, cupons e compartilhamento autorizado.
- **IA clínica.** Anamnese por voz, proposta de rotina, score preditivo. Hoje em protótipo.

Norte detalhado: `docs/NOVAS_IMPLEMENTAÇÕES/visao-produto-e-auditoria.md`.

## Operating Context

- Shell autenticado com rail de ícones + painel de links da seção ativa; header fixo só na área
  de conteúdo, com modo foco. Seções: Início, Portal, Clínica, Pets, Hotel, Conta.
- Ferramenta densa, usada horas seguidas: movimento e ornamento competem com o trabalho.
- Dispositivos: **desktop e tablet** são os cenários que as telas devem priorizar (estação na
  clínica/recepção; tablet no canil, internação e recepção). Celular não é alvo principal.
- Demonstração é um ritual real do produto: `docs/apresentacao/` (o roteiro do portal inteiro)
  e `docs/hotel/apresentacao/` geram PDF a partir do sistema rodando (`capturar.mjs` em cada
  pasta). Mudou uma tela do fluxo, as apresentações precisam ser revistas.
- Módulo hotel liga com `?hotel=on`; telas do hotel têm botão **Como usar**.

## Capabilities and Constraints

- **Stack:** Vue 3 + TypeScript, Vite, PrimeVue 4, Tailwind 4, Pinia, vue-i18n, Vitest.
- **Clínico e Hotel são especificação executável sobre mocks** (`src/features/*/data/`), com
  os tipos como contrato do backend futuro. Nenhum componente conhece `fixtures`.
- **Nada é removido.** O que existe não sai: adapta, melhora e acrescenta. Campo novo nasce
  opcional; texto livre convive com o estruturado.
- **Fronteira do repositório:** rotas `/admin/*` ou que exigem `isSystemAdmin` pertencem a
  outro projeto (CMS/backoffice) e não entram aqui.
- **Terminologia:** em texto visível em português, **"responsável"**, nunca "tutor"
  (exigência legal). `tutorId`, `Tutor` etc. sobrevivem só como identificadores de código/API.
- **Veterinário não é perfil:** o campo `veterinario` de `GET /auth/perfis` é legado e nunca
  é renderizado.
- **Idiomas:** 6 locales (`pt` origem, `en`, `en-GB`, `es`, `sr`, `ar` em RTL), com paridade
  verificada por `npm run check:i18n`.

## Brand Commitments

- Nome: **PetJourney**. Logos em `src/assets/Logos/` (versão clara em linha e versão para tema
  escuro).
- Voz: profissional, clara, sem jargão de código em texto visível. Tom por idioma é
  obrigatório: `pt` informal ("você"), `en`/`en-GB` neutro, `es` formal ("usted"), glossário
  em `docs/GUIA_TRADUÇÃO/`.
- A tela deve dizer para que serve: a primeira entrega do hotel foi recusada por "jogar
  informação sem sentido" e por telas diferentes parecerem a mesma coisa. Cada tela tem forma
  própria, que corresponde ao que ela faz.

## Evidence on Hand

- Apresentações geradas do sistema rodando: `docs/apresentacao/Roteiro-de-Apresentacao.pdf`
  (o portal de ponta a ponta, 30 min) e `docs/hotel/apresentacao/Passeio-Pelo-Hotel.pdf`.
- Requisitos e auditorias por módulo em `docs/clinico/` e `docs/hotel/`.
- **Não existe ainda:** clientes nomeados, depoimentos, métricas de uso ou casos reais dos
  módulos Clínico e Hotel. Os dados das telas são mocados; não apresentar números de demo
  como fatos.

## Product Principles

1. **A tela diz para que serve.** Quem vê pela primeira vez entende a pergunta que ela
   responde pela forma, não por inferência a partir dos dados.
2. **Tudo num lugar, sem virar um amontoado.** Integrar módulos não pode achatar a
   hierarquia: cada área tem forma própria e o menu mostra só o que o perfil usa.
3. **Segurança antes de velocidade.** Informação clínica e de hospedagem aparece para agir
   com segurança agora; urgência é sinal, não decoração.
4. **Evolui sem remover.** Toda mudança acrescenta ao que já serve alguém, na tela e no dado.
5. **Pronto para demonstrar, construído para operar.** A tela precisa convencer na demo e
   continuar boa na oitava hora de uso.

## Accessibility & Inclusion

- Contraste de texto em WCAG AA como piso (as cores do sistema já foram medidas contra isso
  em `docs/DESIGN_SYSTEM.md`).
- `prefers-reduced-motion` sempre respeitado.
- Layout funciona em RTL (`ar`) e com textos mais longos de outros idiomas (`sr`, `es`).
- Alvos de toque adequados a tablet, que é cenário prioritário.
