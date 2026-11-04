# Roteiro de testes dos cards de novembro

Um bloco por card, na ordem em que ficam prontos. Cada um diz o que preparar, os passos e o que
tem que aparecer. Tudo no ramo `feat/portal-novembro`, com `npm run dev` (a API é a de dev).

---

## PJ-VK5P13 · Convite aberto com a conta errada

**Preparar:** duas contas na API de dev. A **A** é DONO de uma empresa. A **B** é qualquer outra
conta, com um e-mail que você lê.

1. **Conta errada.** Entre como A. Em Equipe, convide o e-mail da B como Operador. Abra o link do
   e-mail **no mesmo navegador, ainda como A**.
   - Título "Este convite é para outra conta", com o nome da empresa no texto.
   - A linha do convite diz "Convite como operador", sem "convidou você".
   - **Não** há "Aceitar convite". Há "Entrar com outra conta" e "Ir para o portal".
2. **Trocar de conta.** Clique em "Entrar com outra conta".
   - Vai para o login, com o aviso de convite pendente.
   - Entre como B: a tela do convite volta sozinha, com Recusar e Aceitar, sem abrir o e-mail de
     novo.
3. **Aceitar.** Clique em "Aceitar convite".
   - Aviso "Convite aceito" / "Agora você faz parte da equipe da {empresa}".
   - O portal abre nessa empresa.
4. **Lado do dono.** Entre como A e abra Equipe: o convite saiu dos pendentes e a B está na lista.
5. **Já faz parte.** Como B, abra o mesmo link de novo.
   - Pelo card: "Você já faz parte da equipe da {empresa}" com o selo "Já está na equipe".
     "Ir para o portal" mostra "Já está na equipe" / "Você já fazia parte desta equipe. O convite
     foi fechado e seu acesso continua o mesmo." e vai para o portal.
   - Se aparecer "Este convite não vale mais", é a API tratando o link usado como vencido: anote,
     porque o card espera a outra tela.
6. **Idiomas.** Repita o passo 1 em inglês e em árabe: o texto acompanha o idioma e, em árabe, a
   tela inteira vira da direita para a esquerda.

---

## PJ-RWQBMT · Clínica em `/clinica`

**Preparar:** conta com o módulo Clínica ligado (ou `?clinico=on` na demonstração).

1. **Menu.** Abra cada item da Clínica pelo menu (Hoje, Agenda, Pacientes, Internação, Pendências,
   Relatórios): a barra de endereço mostra `/clinica/...` e o item fica marcado.
2. **Endereço antigo.** Cole na barra `/veterinario/agenda?agrupar=sala`: abre `/clinica/agenda`
   com o agrupamento por sala. Teste também um caminho fundo, como
   `/veterinario/paciente/<id de um paciente>/historico`.
3. **Exceção de antes.** `/veterinario/compartilhamentos` continua levando a Portal › Acessos.
4. **Entrar por link.** Saia da conta, abra `/veterinario/agenda` e entre: depois do login cai em
   `/clinica/agenda`.
5. **Caminhos dentro das telas.** Do Hoje, "Continuar atendimento" e "Resumo em 30 s"; da lista de
   pacientes, abrir um histórico; da internação, abrir um leito: todos em `/clinica/...`.
