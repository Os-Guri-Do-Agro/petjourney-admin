---
version: 7
slug: "src-pages-accounts-veterinario-meu-dia-vue"
primary_target: "src/pages/(accounts)/veterinario/meu-dia.vue"
related_targets: ["src/features/clinico/components/meu-dia/MeuDiaFoco.vue","src/components/layout/moldura-app.css","src/features/clinico/composables/useMeuDia.ts"]
---

# Hoje da Clínica (`/veterinario/meu-dia`)

Modo: Operate. Quem usa: recepção e veterinário, na estação do balcão e no consultório, o expediente
inteiro; em demonstração, cliente vendo pela primeira vez. Pergunta da tela: o que é agora e o que
não pode esperar. Ações: chamar quem espera, voltar ao prontuário de quem está na sala, ver quem
vem, resolver o que pede ação.

**Escolhido em 26/10/2026: o design e o layout do app** (`MeuDiaFoco`, antes a versão `foco` da
branch `layouts-meu-dia`). As outras versões (Cartões e salas, Três números e uma lista, Atual), o
seletor `?versao=` e o relógio da avaliação (`?relogio=`) foram apagados. Próximo passo combinado
com o usuário: só melhorias pontuais nesta versão.

Recusadas no caminho: Linha do dia e Mesa; Bilhete e Caderneta; Polaris e Fluent; Material 3 e Apple;
Radar e Turno; O próximo passo; Cartões e salas; Três números e uma lista.

## Direction contract

THESIS: a home do parceiro no app, trazida para a tela grande. A moldura do app (`usarMoldura('app')`):
a barra lateral de sempre vestida como o menu do app, o destaque sálvia em cima com os rabiscos, sem a
fita do dia. Na folha branca, o destaque na mesma cor com dois cartões de papel branco lado a lado
(26/10, do rascunho do usuário): à esquerda o paciente da vez; à direita o resumo do dia (a frase,
a data, o andamento e os três números em véu). Empilham, o resumo em cima, quando o destaque tem
menos de 1060 px. Embaixo, a fila numa lista lisa e, ao lado, o que pede ação num painel em véu.
Largura total da tela. Na barra, cada seção (Clínica, Hotel, Portal) recolhe e abre pelo título, e a
escolha fica no navegador (`petjourney-barra-espacos-recolhidos`).

O cartão do paciente é um carrossel (Carousel do PrimeVue) com todos os que estão em sala; sem
ninguém em sala, o da vez sozinho. Paginação = os rostos de quem está na sala, no canto do pé, com
setas que andam em roda; arrastar passa no tablet; não passa sozinho; 200 ms; o cartão que sai fica
`inert` e o foco segue para o mesmo controle no que entra. Os títulos de seção da barra levam o
ícone da área no quadradinho cheio (cor da área = categoria), e os destinos ficam recuados numa guia.

REGRAS DO APP (`docs/design/padrao-tutor.md`, no petjourney-app): tela branca e lisa, sem sombra nem
degradê; destaque na cor do perfil; marinho só como tinta; cor em véu; atenção é marinho sobre cinza
frio, nunca pêssego; Readex, peso máximo 700. Tokens em `components/layout/moldura-app.css`. Claro e
escuro sempre.

STORY: quem chega ao balcão vê na hora quem está na sala e há quanto tempo, quem espera e o que é
urgente, e age (chamar, abrir prontuário) sem sair da tela.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the
verdict, DESIGN.md, and every shipping raster carrying its provenance
