# PetJourney — Sistema clínico veterinário · Resumo de design

Sistema web desktop para clínicas veterinárias. Entrega atual: **Login** (dividido) e **Dashboard** (Operação), apresentados lado a lado em um canvas para comparação.

## Direção visual

Tom **acolhedor + clínico clean + moderno**. Muito espaço em branco, cartões suaves, verde-sálvia como cor de confiança e acentos quentes apenas para sinalizar risco/urgência.

## Paleta

| Função                       | Cor                       | Contraste            |
| ---------------------------- | ------------------------- | -------------------- |
| Primária (sálvia)            | `#84C1B4`                 | —                    |
| Primária escura (texto/ação) | `#4F756B` / `#6E9189`     | 4,7:1 no cartão      |
| Tinta primária (fundos)      | `#E5EEEA`                 | —                    |
| Texto principal              | `#1F2F2B`                 | 11,6:1 na página     |
| Texto secundário             | `#616C69`                 | 4,5:1 — AA           |
| Ícone de navegação           | `#6B7371`                 | 4,0:1                |
| Texto suave                  | `#727B79`                 | 3,6:1                |
| Labels / divisor             | `#7D8583`                 | 3,1:1                |
| Linha sutil                  | `#C9D2D0`                 | 1,45:1 no cartão     |
| Linha padrão (borda)         | `#AEBBB8`                 | 1,86:1 no cartão     |
| Linha estrutural forte       | `#84A59D`                 | 2,52:1 no cartão     |
| Página / fundo do app        | `#E1ECE9`                 | lum 81,9%            |
| Bloco interno ao cartão      | `#EAF3F0`                 | lum 87,9%            |
| Superfície de cartão         | `#F4F9F8`                 | lum 93,8%            |
| Alerta alto (terracota)      | `#A2503A` sobre `#FBEEE8` | 4,94:1 — AA          |
| Alerta médio (âmbar)         | `#856112` sobre `#F7F0E0` | 4,98:1 — AA          |
| Sucesso / confirmado         | `#4B776B` sobre `#EAF4F0` | 4,51:1 — AA          |
| Neutro / pendente            | `#716C61` sobre `#F0EFEC` | 4,54:1 — AA          |

Regra: sálvia para tudo que é institucional e positivo; quente **só** para risco, pendência e urgência. Nada de cor decorativa.

### Como o claro foi resolvido

"Muito espaço em branco" é sobre respiro, não sobre luminosidade. A primeira versão do tema
tratava as duas coisas como a mesma: página, cartão e bloco interno ficavam dentro de três
pontos de luminosidade um do outro, todos encostados em `#FFFFFF`. Duas consequências, e a
segunda é a que de fato cansava a vista:

1. **O pico de luz era alto demais.** A maior área clara da tela estava em 97,1% de
   luminância. Hoje está em **93,8%** — continua claro, sem a chapa de branco puro.
2. **As linhas não existiam.** `line` ficava em 1,28:1 contra o cartão e `lineSoft` em 1,18:1.
   Sem borda, a única coisa que separava um bloco do outro era o salto de brilho — a tela
   *precisava* ofuscar para ser legível. Com linha de verdade (1,86:1), o brilho pôde baixar.

Os três degraus de superfície são iguais em **OKLCH**, que é perceptualmente uniforme; passos
iguais em hexadecimal não se leem iguais no olho. Todos no matiz 178,5°, o mesmo medido nas
cores de marca — antes disso o cartão era um verde puro de 120°, fora da família.

A tinta auxiliar foi resolvida ao contrário: partindo do piso de contraste que cada papel
exige contra a **página** (a superfície mais dura), e não escolhendo um tom e conferindo
depois. Isso importa porque contraste é razão, não distância: baixar a superfície *reduz* a
razão do texto escuro. Antes deste passe, texto suave, labels e placeholder estavam em
2,1–2,7:1, abaixo de qualquer piso.

O branco puro segue existindo, mas só como **tinta** — texto e ícone sobre sálvia cheia (token
`text.inverse`) — e como quiet zone de QR.

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
