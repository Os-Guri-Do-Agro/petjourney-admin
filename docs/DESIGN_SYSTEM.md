# PetJourney — Sistema clínico veterinário · Resumo de design

Sistema web desktop para clínicas veterinárias. Entrega atual: **Login** (dividido) e **Dashboard** (Operação), apresentados lado a lado em um canvas para comparação.

## Direção visual

Tom **acolhedor + clínico clean + moderno**. Muito espaço em branco, cartões suaves, verde-sálvia como cor de confiança e acentos quentes apenas para sinalizar risco/urgência.

## Paleta

| Função                       | Cor                       |
| ---------------------------- | ------------------------- |
| Primária (sálvia)            | `#84C1B4`                 |
| Secundária (sálvia clara)    | `#B8CDC9`                 |
| Primária escura (texto/ação) | `#4F756B` / `#6E9189`     |
| Tinta primária (fundos)      | `#EEF3F1`                 |
| Texto principal              | `#28332F`                 |
| Texto secundário             | `#6B7A75`                 |
| Texto suave / labels         | `#8A9A94` · `#A3B0AB`     |
| Linhas / bordas              | `#EAF0EE`                 |
| Fundo do app                 | `#F4F7F6`                 |
| Alerta alto (terracota)      | `#C5715A` sobre `#FBEEE8` |
| Alerta médio (âmbar)         | `#B68A3E` sobre `#F7F0E0` |
| Sucesso / confirmado         | `#3E7355` sobre `#E4F0E9` |

Regra: sálvia para tudo que é institucional e positivo; quente **só** para risco, pendência e urgência. Nada de cor decorativa.

## Tipografia

- Família única: **DM Sans** (sans-serif neutra, legível e amigável).
- Títulos 700, com `letter-spacing` levemente negativo; corpo 400/500; labels em 600 caixa-alta com tracking aberto.
- Escalas: número de métrica 34px · título de seção 18–30px · corpo 13–15px · label 11–12px.

## Componentes

- **Sidebar** (256px): logo (marca pata + wordmark), grupo "Operação" com navegação, cartão de plano, configurações e sair. Item ativo em tinta sálvia.
- **Topbar**: contexto (Painel parceiro / Operação), **relógio + data ao vivo** (atualiza a cada segundo), busca, notificações, conta.
- **Cartão "Próximo atendimento"**: destaque em gradiente sálvia, hora grande, paciente e CTA de prontuário.
- **Cartões de métrica**: 4 colunas, ícone em chip, número grande, sub-rótulo e _pill_ de tendência.
- **Agenda do dia**: linhas com bloco de horário, avatar, espécie/tipo, nota clínica, status (Em sala / Confirmado / Triagem / Pendente) e sala/profissional. Borda esquerda colorida sinaliza prioridade.
- **Risco clínico**: cartões por paciente com nível (Alto/Médio), nota e rodapé de status + horário.

## Princípios aplicados

- Hierarquia por tamanho e peso, não por cor.
- Raio de canto consistente (cartões 16–18px, controles 11–12px), sombras sutis.
- Estados de _hover_ em toda ação navegável.
- Acentos quentes reservados para significado clínico, mantendo o painel calmo.

## Logo

Marca composta: badge arredondado com **pata** (gradiente sálvia) + wordmark "PetJourney" em DM Sans 700.

## Próximos passos sugeridos

- Telas de Agenda (calendário) e Prontuário.
- Estados vazios, carregamento e modais (novo atendimento).
- Versão responsiva / tablet e modo escuro.
- Tokens em CSS variables para handoff de engenharia.
