---
version: 6
slug: "src-pages-accounts-veterinario-meu-dia-vue"
primary_target: "src/pages/(accounts)/veterinario/meu-dia.vue"
related_targets: ["src/features/clinico/components/meu-dia/MeuDiaFoco.vue","src/features/clinico/components/meu-dia/MeuDiaCartoes.vue","src/features/clinico/components/meu-dia/MeuDiaLista.vue"]
---

# Hoje da Clínica (`/veterinario/meu-dia`)

Modo: Operate. Quem usa: recepção e veterinário, na estação do balcão e no consultório, o expediente
inteiro; em demonstração, cliente vendo pela primeira vez. Pergunta da tela: o que é agora e o que
não pode esperar. Ações: chamar quem espera, voltar ao prontuário de quem está na sala, ver quem
vem, resolver o que pede ação.

Em avaliação na branch `layouts-meu-dia`, comparadas pelo seletor `?versao=` (a avaliação abre numa
manhã de movimento; `?relogio=real` volta à hora real). Regra para todas: largura total da tela.

Recusadas até aqui: Linha do dia e Mesa; Bilhete e Caderneta; Polaris e Fluent; Material 3 e Apple;
Radar e Turno ("totalmente poluídos", um deles com um tema só); O próximo passo, trocado em 25/10.
As duas do meio vêm de imagens de referência do usuário.

- **App** (`foco`): o design do app PetJourney, perfil de parceiro.
- **Cartões e salas** (`cartoes`): três cartões e as salas ao longo do dia.
- **Três números e uma lista** (`lista`): três filtros e o dia numa lista.
- **Atual** (`atual`).

## Direction contract

THESIS (Cartões e salas, da referência do usuário em 25/10): trilho de ícones flutuante no lugar da
barra; título com uma frase do momento, busca e as telas da Clínica em abas. Três cartões: quem está
na sala (sálvia, tinta escura por cima), quem espera (anel do tempo de espera, âmbar depois de 15
min, botão de iniciar) e o que pede ação (rosa, a ação de cada um). Embaixo, as salas ao longo de
quatro horas, por sala ou por profissional, com a linha do agora.
THESIS (Lista, refeita da referência do usuário em 25/10): a mesa da recepção. Navegação no topo;
dois cartões (números da recepção com as próximas quatro horas; a sala de agora com os lugares e o
continuar); filtros (profissional, serviço, período, busca); a folha com abas presas na borda (em
sala, internação, fila do dia), a lista e o paciente escolhido num cartão escuro com os atalhos da
ficha e a ação. A folha é clara nos dois temas; abas, linha escolhida e cartão do paciente são a
"noite".

DENSIDADE: as duas versões de referência seguem a densidade da imagem que o usuário mandou. Claro e escuro sempre.

STORY: quem chega ao balcão vê na hora quem está na sala e há quanto tempo, quem espera e o que é
urgente, e age (chamar, abrir prontuário) sem sair da tela.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the
verdict, DESIGN.md, and every shipping raster carrying its provenance
