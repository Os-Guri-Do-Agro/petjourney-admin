---
target: src/pages/(accounts)/inicio.vue
total_score: 22
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 3
target_identity: "file:D:\\PROJETOS\\petjourney-admin\\src\\pages\\(accounts)\\inicio.vue"
target_fingerprint: "sha256:3616a7d00a3de319e773b7117b2f5a21899148ab8952f3dd34c30e84da09b2be"
target_path: "D:\\PROJETOS\\petjourney-admin\\src\\pages\\(accounts)\\inicio.vue"
timestamp: 2026-09-28T19-03-48Z
slug: src-pages-accounts-inicio-vue
---
# Crítica: /inicio (Visão geral)

Method: dual-agent (A: revisão de design · B: detector + navegador)

## Nota de saúde do design

| # | Heurística | Nota | Problema principal |
|---|---|---|---|
| 1 | Visibilidade do status | 2 | "Olá, Parceiro" e contador 4→5 durante a carga; pendências clínicas não chegam à home |
| 2 | Correspondência com o mundo real | 2 | "Abrir carteira"→Financeiro, "Ver indicação"→Divulgação |
| 3 | Controle e liberdade | 3 | Tudo é link; nada destrutivo |
| 4 | Consistência e padrões | 1 | Quatro linguagens de cartão; "Visão geral" ×4; 30 raios/tamanhos fora da escala |
| 5 | Prevenção de erros | 2 | Frase do saldo contradiz o número |
| 6 | Reconhecer em vez de lembrar | 3 | Atalhos repetem o painel visível |
| 7 | Flexibilidade e eficiência | 2 | Filtro para 5 itens; nenhum atalho para a tarefa do dia |
| 8 | Estética e minimalismo | 2 | Sálvia cheia com brilho decorativo; sombra em repouso em 3 blocos |
| 9 | Recuperação de erros | 3 | Estados de erro/suspenso bons; mensagem crua do backend |
| 10 | Ajuda e documentação | 2 | Nada explica "sacável" ou "janela de segurança" |
| **Total** | | **22/40** | Aceitável, com problemas estruturais |

## Veredito de especificidade
Tela intercambiável com qualquer SaaS de afiliados. Para conta vet/hotel a home é a mesma: dinheiro no topo e ~24 atalhos sem contador; as pendências existem (useClinicoPendencias, AppNavLink.vue:61) mas HomeNavigationShortcuts.vue não renderiza item.badge. Detector: 38 achados consultivos (20 fonte, 18 raio; 7 falsos positivos) + overlay com 24 (9 texto pequeno, 12 contraste — 3 falsos positivos no gradiente —, 3 "cyan gradient", 4 transição de layout, 1 eyebrow sobre título). Rótulos do trilho a 1,72:1 (achado só do detector).

## Problemas prioritários
- [P0] Cartão de indicação quebra em 1024×768: .referral-card__main com 55px para 150px de conteúdo; código cortado, copiar sobre o QR, "Ver indicação" vaza. Fix: container queries em .dash-focus/.referral-card (PortalParceiroDashboard.vue). → adapt
- [P1] A home não serve a equipe que opera o dia: sem fila/pendências, ~24 atalhos que repetem o menu. Fix: resumo do dia por módulo ativo, carteira compacta, atalhos recolhidos. → shape, distill
- [P1] Cartão de comissão fere Tinta Não Papel e Plano por Padrão: sálvia cheia 639×252 em gradiente, glow, círculo decorativo, sombras em repouso em 4 blocos. Fix: Linho Claro + Costura, valor 750 tnum, sem glow/selo/sombras. → quieter
- [P1] Piso de acessibilidade: sem focus-visible em 3 CTAs; eyebrows/labels 10–12px em Tinta Apagada 3,2–3,6:1; Exportar QR 3,75; "5 disponíveis" 3,88; Ver indicação 4,41; Em breve 2,9; trilho 1,72. Fix: anel de foco padrão, Tinta Secundária com piso de 11px. → harden
- [P2] Copy do saldo contraditória (metaHold fixo) e fallback "Parceiro" sem i18n (stores/parceiro.ts:43); nomes duplos para destinos. → clarify

## Alertas por persona
- Dono de clínica na demo: jargão "Participação · Afiliado ativo"; saldo confuso; atalhos = menu; tablet quebrado.
- Recepção/vet às 8h: sem fila, agenda ou pendência; Fila escondida entre 9 atalhos.
- Tablet/toque: filtro no limite de 32px; QR órfão em 768; "Validar cupom" sem rótulo.
- Usuário avançado: filtro enfeite; sem atalho de teclado; cabeçalho nobre com data e explicações.

## Observações menores
Cartão dentro de cartão (QR, atalhos); Exportar QR preenchido compete com CTA; ícones de domínio em PrimeIcons (pi-building ×3); hover com translateY; transições de width/padding no shell; ~155px vazios em 1440; sr "afilijejt program".

## Perguntas
- O que a home sabe que o menu não sabe?
- Um herói só, ou um por módulo ativo?
- Às 8h o dinheiro de indicação importa para a clínica ou para a PetJourney?
- O que a tela responde a "cadê meus pacientes?"
