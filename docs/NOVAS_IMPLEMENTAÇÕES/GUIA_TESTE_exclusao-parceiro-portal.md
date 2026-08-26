# Guia de teste: efeitos da exclusão lógica no Portal do Parceiro

**Escopo:** front `petjourney-admin`, implementação da spec
[protocolo-motivo-acoes-admin-parceiro-portal.md](protocolo-motivo-acoes-admin-parceiro-portal.md).
**Criado em:** 2026-08-05

A exclusão em si é do backend. Aqui se testa **como o portal reage** quando a porta fecha.

---

## 0. O que foi implementado (para saber o que observar)

| Comportamento | Onde vive |
| --- | --- |
| Decisão entre "escolher parceiro", "retentar sem o id", "acesso encerrado" e "sem acesso" | `src/utils/parceiro/acesso-portal.ts` |
| Retentativa automática quando o `parceiroId` guardado morre | `src/stores/parceiro.ts` (`carregarContexto`) |
| Revalidação de 403 vindo de painel (permissão de OPERADOR vs acesso encerrado) | `src/stores/parceiro.ts` (`revalidarAcesso`) |
| Tela de saída "Seu acesso ao portal foi encerrado" | `src/components/parceiro/PartnerPageFrame.vue` |
| Sair a partir da tela de saída | `src/composables/useLogout.ts` |

Sinal-chave: **`semAcessoParceiro`** = sem acesso (403). **`acessoEncerrado`** = o acesso existia nesta
sessão e caiu. Os dois juntos trocam a composição da tela; só `semAcessoParceiro` mantém a tela antiga
de "portal ainda não liberado", que é a certa para quem nunca teve parceiro.

---

## 1. Automatizado (rode primeiro)

```sh
npm run test:unit    # inclui acesso-portal.spec.ts e stores/__tests__/parceiro.spec.ts
npm run build
npm run lint
npm run check:i18n
```

Os testes cobrem: 400 pede seleção, 403 com id guardado retenta sem o id, 403 na retentativa vira
"sem acesso", 403 depois de contexto carregado vira "acesso encerrado", e `revalidarAcesso`
distinguindo 403 de permissão de 403 de acesso encerrado.

---

## 2. Preparação para os testes manuais

1. `npm run dev` apontando para a API de dev (`VITE_API_URL`).
2. Duas contas úteis:
   - **A:** membro de **um** parceiro aprovado.
   - **B:** membro de **dois** parceiros aprovados (para o cenário 3.3).
3. Um token de admin para chamar a exclusão:

```bash
curl -X DELETE "$API/parceiro/<parceiroId>" \
  -H "Authorization: Bearer $TOKEN_ADMIN" \
  -H "Content-Type: application/json" \
  -d '{"motivo":"teste de exclusao no portal"}'
```

> Não existe rota de restaurar. Use parceiro de teste descartável.

---

## 3. Cenários

### 3.1 Exclusão no meio da sessão (spec §2.1)

1. Logue com a conta **A** e fique em `/inicio`.
2. Rode o `DELETE` acima no parceiro dela.
3. Navegue para `/parceiro/carteira` (ou clique em recarregar em qualquer tela do portal).

**Esperado**
- [ ] Aparece **"Seu acesso ao portal foi encerrado"**, com cadeado, e não um erro cru nem um toast.
- [ ] Os três CTAs aparecem: **Falar com o suporte** (abre o WhatsApp em nova aba),
      **Cadastrar nova empresa** (vai para `/settings?aba=empresa`) e **Sair**.
- [ ] O motivo interno da exclusão **não** aparece em lugar nenhum da tela.
- [ ] Nenhum redirect automático para o login, e nenhum loop.
- [ ] **Sair** limpa a sessão e leva ao login; voltar no histórico não devolve o portal.

Repita entrando por `/parceiro/divulgacao`, `/parceiro/programas`, `/parceiro/acessos` e
`/parceiro/carteira?aba=extrato`: todas devem cair na mesma tela.

### 3.2 Login novo depois da exclusão (spec §2.3)

1. Depois de 3.1, faça login de novo com a conta **A**.

**Esperado**
- [ ] Cai em "Portal do parceiro ainda não liberado" (a tela de quem não tem vínculo), com o CTA de
      cadastrar empresa. Não é erro nem tela vazia.
- [ ] Sem loop de redirect entre `/inicio` e `/auth/login`.

> É esperado que aqui **não** apareça "acesso encerrado": numa sessão nova o portal não tem como
> distinguir "foi excluído" de "nunca teve", e a spec aceita a tela existente.

### 3.3 Dois parceiros, um excluído (spec §2.2)

1. Logue com a conta **B** e opere o parceiro **P1** (confirme no `localStorage` que
   `petjourney-parceiro-id` está em P1).
2. Exclua **P1** pelo admin.
3. Recarregue o portal.

**Esperado**
- [ ] O portal **não** trava: a retentativa sem `parceiroId` acontece sozinha e P2 é resolvido.
- [ ] O nome do parceiro no cabeçalho passa a ser o de P2.
- [ ] `petjourney-parceiro-id` no `localStorage` passa a apontar para P2.
- [ ] Se a conta tiver 3+ parceiros e sobrar mais de um, cai em `/parceiro/selecionar` pedindo
      escolha explícita, sem erro.

**Atalho sem admin:** no console, `localStorage.setItem('petjourney-parceiro-id','id-que-nao-existe')`
e recarregue. Exercita exatamente a mesma retentativa.

### 3.4 Cadastro novo continua funcionando (spec §2.4)

1. Com a conta **A** (parceiro excluído), vá em **Configurações > Empresa**.

**Esperado**
- [ ] O formulário de cadastro de empresa aparece e aceita envio.
- [ ] O envio entra como `PENDENTE`; o parceiro excluído não bloqueia com `PARCEIRO_CADASTRO_JA_EXISTE`.
- [ ] Configurações **não** é sequestrada pela tela de saída (ela é o caminho de volta).

### 3.5 403 de permissão não vira falso "acesso encerrado"

1. Logue com uma conta **OPERADOR** de um parceiro **ativo**.
2. Tente uma ação de DONO (salvar chave PIX ou solicitar saque na carteira).

**Esperado**
- [ ] Aparece o erro/toast normal da ação.
- [ ] **Não** aparece a tela de acesso encerrado, e o portal continua navegável.

Este é o cenário que mais importa: 403 é ambíguo, e a revalidação existe justamente para não
expulsar um OPERADOR legítimo.

### 3.6 Parceiro suspenso continua diferente de excluído (spec §3)

1. Com um parceiro `SUSPENSO` (não excluído), abra `/inicio`.

**Esperado**
- [ ] Continua na tela de suspensão, com os canais de contato e o motivo da auditoria.
- [ ] **Não** aparece "acesso encerrado".

---

## 4. Transversais

- [ ] **Claro e escuro:** a tela de saída legível nos dois modos (`toggleColorMode`), sem hex fixo.
- [ ] **Idiomas:** trocar para `en`, `en-GB` e `es` na tela de saída; nada em pt cru, nada estourando
      a largura dos botões.
- [ ] **Teclado:** tab alcança suporte, cadastrar nova empresa e Sair, com foco visível.
- [ ] **Tablet (≈768px):** os CTAs empilham sem cortar texto.

---

## 5. Limites conhecidos

- **Sessão nova não distingue exclusão de "nunca teve parceiro".** A API responde 403 igual nos dois
  casos e não manda `reason`. Se o backend passar a mandar algo como `PARCEIRO_EXCLUIDO`, dá para
  refinar `decidirAcessoPortal` e mostrar a tela de saída também no 3.2.
- **A membership da equipe continua no banco** por decisão do backend, então ela não serve de sinal.
  O portal se guia só por 403 mais contexto de sessão.
- **Só as telas do portal reagem.** Configurações e as telas clínicas seguem acessíveis de propósito.
