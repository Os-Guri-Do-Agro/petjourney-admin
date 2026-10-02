---
target: src/pages/(accounts)/inicio.vue
total_score: 26
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
target_identity: "file:D:\\PROJETOS\\petjourney-admin\\src\\pages\\(accounts)\\inicio.vue"
target_fingerprint: "sha256:8cfbbb9cd6bd28d14ceca802a671f8c397bf0d1c8fdcc93a36d8a71bca1aca93"
target_path: "D:\\PROJETOS\\petjourney-admin\\src\\pages\\(accounts)\\inicio.vue"
timestamp: 2026-09-28T20-53-24Z
slug: src-pages-accounts-inicio-vue
closed: true
---
# Crítica: /inicio (Visão geral), segunda rodada

Method: dual-agent (A: revisão de design · B: detector + navegador)

## Nota de saúde do design

| # | Heurística | Nota | Problema principal |
|---|---|---|---|
| 1 | Visibilidade do status | 2 | "Conferido às" existe, mas sem reconferir; contagem não se refaz com o tempo; falha vira "Nada pedindo ação agora" |
| 2 | Correspondência com o mundo real | 3 | Linguagem de domínio boa; "Financeiro" para comissão de afiliado lê como caixa da clínica |
| 3 | Controle e liberdade | 3 | Links e controles reversíveis; sem atualizar a pauta nem recolher o dinheiro |
| 4 | Consistência e padrões | 3 | "Título + Abrir X →" consistente; carregamentos mistos; títulos desalinhados 5px |
| 5 | Prevenção de erros | 2 | "disponível para saque" ignora bloqueio, mínimo de R$ 50,00, chave PIX e papel de dono |
| 6 | Reconhecer em vez de lembrar | 3 | Linha diz número e trabalho; motivo da urgência exige clicar |
| 7 | Flexibilidade e eficiência | 3 | Linhas são atalhos diretos; ordem do menu, não da gravidade |
| 8 | Estética e minimalismo | 3 | Quieta e fiel; R$ 164,00 duas vezes; só-portal com metade vazia |
| 9 | Recuperação de erros | 2 | Saldo e código com "Tentar de novo"; pauta engole a falha |
| 10 | Ajuda e documentação | 2 | Duas frases de apoio, uma com jargão "pauta"; botão de explicações a 3,17:1 |
| **Total** | | **26/40** | Aceitável (1ª rodada: 22/40) |

## Veredito de especificidade
Detalhe autoral, composição de categoria. A pauta (régua dos selos do menu, zero não vira linha, urgência no ícone e no rótulo, chegadas/saídas como contexto) e o extrato (linhas de razão, retido só quando existe) são deste produto. A moldura é a home SaaS padrão e o maior texto da tela é a comissão (R$ 164,00 em 36px).
Detector: 22 achados consultivos (saída 0). Home: 3 (1 falso positivo — valor do saldo; 2 válidos — chips em 12px). PartnerPageFrame: 11 (3 FP em ícones; válidos: título até 1,85rem = 28,5px; botão de explicações 0,76rem). Banner + QR: 8, quase todos em estados não renderizados. Overlay: 16, nenhum na home (trilho 9,3px, eyebrow 10,2px, "Ctrl+K" 3,7:1, "4 telas" 4,1:1, transições de largura; FP: cyan gradient do trilho, Vue DevTools). Medido: todo texto de main passa contraste exceto "Mostrar explicações" (3,17:1); sem estouro em 1440/1024/768; nenhum alvo < 32px; 13/13 paradas de Tab com anel visível.

## Problemas prioritários
- [P1] A pauta pode dizer "tudo em dia" sem ter conferido: fontes que falham viram lista vazia e mesmo assim gravam conferidoEm; "Conferido às" aparece enquanto a Clínica ainda carrega; contagem só refaz em mutação; sem reconferir. Fix: estados ok/parcial/falhou, conferido só após todos os módulos, reconferir a cada 5 min e ao focar, botão de atualizar. → harden
- [P1] O dinheiro é o herói de uma tela que existe para o trabalho parado: 560px vs 509px em 1440; em 1024 o bloco Hotel fica abaixo da dobra (linha urgente em y=842 com 768 de altura); Tab vai e volta entre colunas. Decisão do usuário na rodada anterior: saldo em destaque. Fix que preserva a decisão: pauta primeiro na coluna única, ou troca de lados com módulos ligados. → layout
- [P1] O bloco de dinheiro não diz o que é nem se dá para sacar: "Financeiro" lê como caixa da clínica; "disponível para saque" ignora mínimo de R$ 50,00 (PortalCarteiraVisaoPanel.vue:46), chave PIX e isDono; bloqueado mostra "disponível" em 36px acima de "Saque bloqueado"; R$ 164,00 duplicado. Fix: nome sem ambiguidade (também no menu), rótulo pela capacidade real com link, "Saldo total" some quando igual. → clarify
- [P2] Linhas urgentes não dizem o que é urgente (boletim retido, medicação atrasada); "12 pendências em Atividades" nomeia o lugar. Fix: segunda linha com o detalhe que os contadores já têm; ordenar por gravidade. → clarify
- [P2] Acessibilidade e sistema: "Mostrar explicações" 3,17:1 (moldura compartilhada); divisores internos #DDCDC4 a 1,45:1 abaixo da regra "Linha Separa" (1,5:1); moeda em árabe "$R 164.00" sem isolamento bidi. Fix: tinta secundária; Costura #C8B5A8 ou exceção na regra; <bdi>. → harden

## Alertas por persona
- Recepção às 8h: sem "conferir agora"; "Conferido às 08:12" às 15h; ordem do menu, não da gravidade.
- Dono de clínica na demo: "Financeiro" lido como receita; "12 pendências em Atividades" opaco; página termina em "Compartilhe e ganhe".
- Cuidadora no tablet (1024): Hotel abaixo da dobra atrás de 265px de dinheiro; links e botões com 36px.
- Veterinário às 8h: primeira coisa na tela é dinheiro; urgência exige clicar.
- Parceiro sem afiliação (simulado): "não ativo" duas vezes na primeira tela.

## Observações menores
Só-portal com metade da tela vazia e extrato sem lançamentos; título troca "Olá" → "Olá, Clinica DEV"; indicação carrega com texto vs skeleton; ícone só em dois títulos de bloco; caret nas linhas vs regra seta = ir a outro lugar; chegadas/saídas não são link; lede usa "pauta"; fonte renderizada é system-ui (Segoe UI), DESIGN.md diz DM Sans — documento errado; "Pulso da rede" sem lugar na nova home; shell: "Light" sem tradução em pt/es (lightLabel, linha 317), cabeçalho quebra em 4 linhas em 1024, busca "B…" em 768.

## Perguntas para considerar
- Se a pauta é a razão de a home existir com módulos ligados, por que o maior número é a comissão do dono? Por que a recepcionista precisa vê-lo?
- Se a regra é "um número em um lugar só", a home não deveria ser onde esse número se abre?
- Numa estação aberta 8 horas, quem reconfere: a tela ou a pessoa?
- Na conta só-portal, o que a home sabe que Financeiro e Divulgação não sabem?
