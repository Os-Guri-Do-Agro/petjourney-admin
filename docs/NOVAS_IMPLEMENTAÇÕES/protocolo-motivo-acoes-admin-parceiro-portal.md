# Spec Frontend (Portal do Parceiro): Efeitos da Exclusão Lógica

**Status:** Backend LIVE em dev (2026-08-05). Pronto para integrar.
**Autor:** Claude + Nicolas
**Criado em:** 2026-08-05
**Superfície:** portal do parceiro (web, onde o parceiro/prestador opera; não tem tutor aqui)
**Spec de backend:** [protocolo-motivo-acoes-admin-parceiro.md](protocolo-motivo-acoes-admin-parceiro.md)

> **Nota de contexto:** o repositório do portal não estava disponível na máquina quando esta spec foi escrita. Então ela descreve **contrato e comportamento esperado**, sem citar arquivos ou componentes do portal. Quem for implementar precisa mapear os pontos de entrada reais.

---

## 0. O que mudou, em 3 linhas

O admin passou a poder **excluir** um parceiro, e a exclusão é lógica: a conta continua no banco, mas perde todo o acesso. Do lado do portal, isso é um estado novo de "sem acesso" que precisa ser tratado com uma tela decente, e não com um erro cru ou um loop de login.

Nenhuma tela nova. Nenhum campo novo. O trabalho aqui é **tratar bem uma porta que fechou**.

---

## 1. O que acontece com um parceiro excluído

Assim que o admin exclui, e sem nenhuma ação do portal:

| Superfície | Comportamento |
|---|---|
| Login / troca de perfil | O parceiro **some da lista de perfis** do usuário. Se era o único, a conta deixa de ter papel de parceiro |
| Guard do portal | Toda rota do portal responde **403** |
| Carteira e extrato | 403 (o dado continua no banco, só não é acessível) |
| Solicitar saque, PIX, modos | 403 |
| Código e QR de indicação | QR revogado no WFQR: quem escanear o QR impresso não cai mais no redirect |
| Cupons do parceiro | A exclusão é **bloqueada** se houver cupom vinculado, então este caso não existe na prática |

Um detalhe que importa: a **membership da equipe continua ativa no banco**, de propósito (o dia em que existir "restaurar parceiro", ela volta inteira). Ou seja, não confie em "o usuário perdeu a membership" para detectar o estado. O sinal é o parceiro sumir da lista de perfis e as rotas responderem 403.

---

## 2. Cenários que a UI precisa cobrir

### 2.1 Parceiro excluído no meio da sessão

O caso mais provável: o parceiro está com o portal aberto e o admin exclui.

**Comportamento esperado:** na primeira chamada que responder 403, o portal mostra uma tela de saída explicando, e **não** um toast genérico de erro nem um redirect silencioso para o login (que faria o usuário tentar entrar de novo em loop).

```
┌──────────────────────────────────────────────┐
│                                              │
│   Seu acesso ao portal foi encerrado         │
│                                              │
│   Este cadastro de parceiro não está mais    │
│   ativo. Se você acha que houve um engano,   │
│   fale com a gente.                          │
│                                              │
│           [ Falar com o suporte ]            │
│           [ Sair ]                           │
│                                              │
└──────────────────────────────────────────────┘
```

Copy sem em-dash. Não expor o motivo da exclusão: ele é interno, escrito pelo admin para o admin.

### 2.2 Usuário com mais de um parceiro

Se a pessoa é membro de dois parceiros e só um foi excluído, o outro segue normal. O seletor de parceiro simplesmente não lista mais o excluído. Nenhuma mensagem especial: para o usuário, aquele cadastro deixou de existir.

Ponto de atenção: se o parceiro excluído estava **selecionado** (o claim `parceiroAtivoId` do token), o backend ignora o claim e cai na regra normal (auto-resolve se sobrou um, ou pede escolha explícita). O portal precisa aguentar o parceiro ativo mudar sozinho entre uma requisição e outra.

### 2.3 Login novo depois da exclusão

Se era o único parceiro, o usuário loga e **não tem mais papel de parceiro**. O portal deve mostrar a mesma tela de 2.1 (ou a tela de "esta conta não tem acesso ao portal", se ela já existir), nunca uma tela vazia ou um erro de carregamento.

### 2.4 Login novo, mas o usuário quer se cadastrar de novo

Isso **funciona**: quem teve o parceiro excluído pode fazer um auto-cadastro novo do zero, que entra na fila `PENDENTE` como qualquer outro. O parceiro excluído não bloqueia o novo cadastro.

Se o portal tem o fluxo de auto-cadastro, ele deve continuar acessível para esse usuário.

---

## 3. O que NÃO muda

- Nenhuma rota do portal mudou de contrato.
- Nenhum campo novo em nenhum response do portal.
- Parceiro **suspenso** (auditoria) continua se comportando como antes: entra no portal em modo leitura. Suspensão e exclusão são coisas diferentes, e só a exclusão fecha a porta.
- O parceiro nunca vê protocolo nem motivo: a trilha é 100% admin.

---

## 4. Checklist de aceite (portal)

- [ ] 403 em rota do portal por parceiro excluído mostra a tela de acesso encerrado, não um erro cru.
- [ ] Não há loop de redirect para o login quando o parceiro foi excluído.
- [ ] Usuário com 2 parceiros, um excluído: o seletor lista só o vivo e a navegação segue normal.
- [ ] Usuário cujo parceiro selecionado foi excluído não fica preso numa tela quebrada (o parceiro ativo é reresolvido).
- [ ] Login com o único parceiro excluído cai na tela de acesso encerrado.
- [ ] O fluxo de auto-cadastro continua acessível para quem teve o parceiro excluído.
- [ ] Nenhuma copy nova com em-dash, e nenhuma expõe o motivo interno da exclusão.

---

## 5. Como testar sem esperar o admin

Peça para alguém com acesso admin (CMS ou chamada direta) rodar, num parceiro de teste:

```bash
curl -X DELETE "$API/parceiro/<parceiroId>" \
  -H "Authorization: Bearer $TOKEN_ADMIN" \
  -H "Content-Type: application/json" \
  -d '{"motivo":"teste de exclusao no portal"}'
```

Repare que o parceiro **não some do banco**: dá para conferir que carteira e extrato continuam lá. Não existe rota de restaurar, então use um parceiro de teste descartável.

---

## 6. Fora do escopo

- Tela de "meu cadastro foi excluído, quero recorrer" com fluxo formal de recurso.
- Mostrar ao parceiro o motivo da exclusão (o motivo é interno).
- Restauração de parceiro excluído (não existe no backend).
