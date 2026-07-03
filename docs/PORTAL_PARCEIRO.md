# Portal do Parceiro — Guia de Implementação (este repositório)

**Última atualização:** 2026-07-01  
**Público:** desenvolvedores e IAs trabalhando neste front.

---

## 1. O que é (e o que NÃO é)

| É | Não é |
|---|---|
| Portal web logado para **empresas parceiras** operarem indicação, cupons, programas e carteira | CMS / backoffice / admin (`/admin/*`, fila de auditoria, liquidação) |
| Área de **prestação de serviços e parceria comercial** do parceiro | Painel clínico do veterinário (fica em **Operação** / **Pets**) |
| Consumidor das rotas `GET/POST /parceiro/portal/*` | Cadastro inicial da empresa (feito no sistema admin, outro projeto) |

**Regra de ouro:** se a rota começa com `/admin/` ou exige `isSystemAdmin`, **não implemente aqui**.

Contas podem acumular perfis (vet + parceiro). O mesmo usuário vê o **Portal** e, se tiver `veterinarioId`, também **Operação** e **Pets**.

---

## 2. Arquitetura de informação (menu lateral)

O painel tem **um único dashboard** em `/inicio`. Drawer com **rail de ícones** + painel de links da seção ativa.

### Seções do rail

| Seção | Itens no painel | Quem vê |
|---|---|---|
| **Início** (ícone home) | Atalhos para cada área | Todos |
| **Portal** | Programas, Divulgação, Financeiro*, Equipe | Todos (parceiro) |
| **Clínica** | Agenda, Atividades | Só com `veterinarioId` |
| **Pets** | Pacientes, Prontuários, Compartilhamentos | Só veterinário |
| **Conta** | Perfil, Configurações | Todos |

\* Financeiro só com `statusAfiliado === 'ATIVO'`.

Detalhes de portal ficam em **abas** (`?aba=`) dentro das telas.

### Redirects legados

| Rota antiga | Nova destino |
|---|---|
| `/parceiro` | `/inicio` |
| `/veterinario` | `/inicio` |
| `/parceiro/status` | `/parceiro/programas?aba=credenciamento` |
| `/parceiro/indicacao` | `/parceiro/divulgacao?aba=indicacao` |
| `/parceiro/cupons` | `/parceiro/divulgacao?aba=cupons` |
| `/parceiro/resgates` | `/parceiro/divulgacao?aba=resgates` |
| `/parceiro/carteira/extrato` | `/parceiro/carteira?aba=extrato` |
| `/parceiro/carteira/saques` | `/parceiro/carteira?aba=saques` |

---

## 3. Separação de domínios na UI

```
Início (/inicio)                     Portal + Clínica (se vet)
────────────────                     ───────────────────────────
Dashboard unificado                  Programas, divulgação, financeiro, equipe
Blocos Parceria + Clínica            Agenda, atividades, pacientes, prontuários
```

Não misturar copy de “auditoria CMS” com fluxos do portal. Aprovação de credenciamento e modos é **feita no admin**; aqui só **acompanhamos status** e **solicitamos** (DONO).

---

## 4. Contratos técnicos (resumo)

- HTTP: `apiFetch` + envelope `{ statusCode, message, data }`.
- `?parceiroId=` obrigatório com 2+ parceiros → `/parceiro/selecionar`.
- Papel `DONO` vs `OPERADOR`: esconder ações de gestão para operador.
- Dinheiro em **centavos** — `formatCentavosToBrl` / `parseBrlToCentavos`.
- Indicação: backend devolve `link` pronto; front **não monta URL**.
- Cupom ≠ comissão.

Fontes detalhadas: `docs/NOVAS-IMPLENTAÇÕES/03`, `04`, `05`, `frontend.md`, `regras.md`, `GUIA_CADASTRO_PARCEIRO_VETERINARIO.md`.

---

## 5. Estrutura de código

```
src/
  components/layout/
    AppShell.vue
  components/parceiro/
    PartnerPageFrame.vue
    PartnerSectionTabs.vue
    panels/
  composables/
    useAppNavigation.ts       # seções e itens do drawer
    useParceiroPortal.ts
    usePartnerTabs.ts
  components/home/
    PartnerHomeOverview.vue
    ClinicalHomeOverview.vue
  pages/(accounts)/
    inicio.vue                # dashboard único
    parceiro/...
    divulgacao.vue            # Indicação + cupons + resgates (abas)
    carteira/index.vue        # Financeiro (abas)
    equipe.vue
    selecionar.vue
  stores/parceiro.ts
  service/parceiro/
```

---

## 6. Padrão de abas

- Query param: `?aba=<id>` (`usePartnerTabs`).
- Aba padrão omite o query param (URL limpa).
- Componente `PartnerSectionTabs` usa tokens `currentColors` → CSS vars.
- Cada painel carrega seus dados no `onMounted` ou quando a aba fica ativa (`watch`).

---

## 7. Estados que a UI deve tratar

| Contexto | Estados / gates |
|---|---|
| Credenciamento | `PENDENTE`, `APROVADO`, `REJEITADO`, `SUSPENSO`; `podeOperar` |
| Modos | `NAO_SOLICITADO` → `SOLICITADO` → `ATIVO` (ou rejeitado/suspenso) |
| Carteira | Gate `statusAfiliado === 'ATIVO'`; saque mín. R$ 50; PIX obrigatório |
| Indicação | `podeIndicar`, `aviso` do backend |
| Multi-parceiro | 400 → `/parceiro/selecionar` |

---

## 8. Definition of Done (portal)

- [ ] Menu Portal com ≤ 5 itens; sem rotas admin.
- [ ] Telas irmãs agrupadas por abas, não por itens de menu.
- [ ] Tokens de cor (`currentColors` / `var(--partner-*)`); modo claro e escuro.
- [ ] Redirects legados funcionando.
- [ ] `npm run build`, `npm run lint`, testes relevantes verdes.
