# Guia de teste: seletor de empresa (multi-perfil no portal)

**Escopo:** front `petjourney-admin`. Implementa a Tela A de [multi-perfil.md](multi-perfil.md)
na parte que cabe ao portal.
**Backend:** `GET /auth/perfis` e `POST /auth/trocar-perfil` confirmados no ar em dev
(`/api-json`).

---

## O que mudou

Antes, `/parceiro/selecionar` pedia o **cuid do parceiro digitado à mão**. Agora lista as empresas
da conta, vindas de `GET /auth/perfis`, e a troca emite um token novo com `parceiroAtivoId`.

| Peça | Onde |
| --- | --- |
| `getPerfis()` e `trocarParaParceiro()` | `src/service/auth/auth-service.ts` |
| Montagem das opções e regra do CTA de cadastro | `src/utils/parceiro/perfis-parceiro.ts` |
| Tela | `src/pages/(accounts)/parceiro/selecionar.vue` |
| Entrada no menu ("Trocar de empresa") | `src/components/layout/AppShell.vue` |

O portal **não** lista o perfil de tutor: não existe tela de tutor nesta superfície. O campo
`veterinario` do payload é ignorado de propósito (legado dormente, conforme o doc).

---

## Automatizado

```sh
npm run test:unit   # perfis-parceiro.spec.ts cobre ordenação, badge, item ativo e regra do 409
npm run build ; npm run lint ; npm run check:i18n
```

## Manual

Conta ideal: membro de **dois** parceiros (um como DONO, outro como OPERADOR).

### 1. Lista

1. Menu do usuário (canto superior direito) > **Trocar de empresa**.

- [ ] As duas empresas aparecem com nome, papel ("Seu negócio" / "Equipe") e badge de status
      quando não estiverem `APROVADO`.
- [ ] A empresa em uso mostra "Em uso" e o clique nela não faz nada.
- [ ] Nenhum campo de digitar identificador aparece.

### 2. Troca

2. Clique na outra empresa.

- [ ] Spinner no item clicado, depois vai para `/inicio` já com o nome da nova empresa no topo.
- [ ] Nenhum dado da empresa anterior sobra na tela (dashboard, carteira, divulgação).
- [ ] No console: `localStorage.getItem('petjourney-parceiro-id')` é o id novo, e o
      `access_token` decodificado traz `parceiroAtivoId` igual a ele.

### 3. Lista velha (403)

3. Peça para removerem sua membership em uma das empresas enquanto a tela está aberta, e clique nela.

- [ ] Toast neutro "Esta empresa não está mais disponível" e a lista recarrega sozinha.
- [ ] Sem crash e sem logout.

### 4. CTA de cadastro

- [ ] Com um negócio próprio em `PENDENTE` ou `APROVADO`, o bloco "Cadastrar outra empresa"
      **não** aparece (o backend recusaria com 409).
- [ ] Sem negócio próprio (só equipes), o bloco aparece e leva a `/settings?aba=empresa`.

### 5. Transversais

- [ ] Claro e escuro; foco visível ao navegar por teclado (os itens são `button`).
- [ ] `en`, `en-GB` e `es` sem pt cru e sem estourar a largura dos itens.

---

## Limites conhecidos

- **O refresh não preserva o perfil ativo.** `POST /auth/refresh` do portal ainda não manda
  `{ perfil, parceiroId }`, então o token renovado perde o claim `parceiroAtivoId`. Sem impacto
  hoje porque o portal manda `?parceiroId=` em todas as chamadas, mas fecha o checklist do doc.
- **Perfil de tutor não é oferecido aqui** (decisão desta superfície, ver acima).
