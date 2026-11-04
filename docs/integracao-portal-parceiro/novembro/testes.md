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

---

## PJ-TYT5JY · Docs do lado do responsável

Só leitura: `docs/clinico/09`, `12`, `14` e `16` começam com a nota de que o contrato é o OpenAPI
da API e não citam mais caminhos `D:\PROJETOS\...` nem "copie o `responsavel.ts`".

---

## PJ-49U4QS · Idempotency-Key e o código do erro (E1-04)

Nada novo na tela: é a base que as telas de Clínica e Hotel usam a partir da E2-01. Os testes
automáticos cobrem a chave repetida nos retries e trocada quando o corpo muda. O captcha ficou com o
site (lacuna N5).

---

## PJ-IWQ1F4 · Clínica e Hotel ligados pelo servidor (E1-02)

**Preparar:** uma conta DONO na API de dev. Ver os módulos dela no CMS (Parceiro › Módulos).

1. **Sem demonstração.** Entre e abra o Início.
   - O menu **não** tem Clínica nem Hotel: nenhuma tela deles fala com a API ainda (entram card a
     card, da E2 em diante).
   - No Início, o bloco "Módulos da Clínica e do Hotel" mostra o estado de cada um: "Pedir o
     módulo", pedido em análise, "Em teste até {data}", ativo ou só consulta.
2. **Pedir o módulo.** Com um módulo nunca pedido, clique em "Pedir o módulo": vira "pedido em
   análise". Como OPERADOR, o botão não aparece.
3. **Endereço direto.** Cole `/clinica/agenda` ou `/hotel/painel` na barra: volta ao Início. O
   `?clinico=on` não liga mais nada.
4. **Demonstração (só no `npm run dev`).** Menu da conta › "Demonstração (dados locais)": Clínica e
   Hotel voltam ao menu e ao Início com os dados de exemplo, como antes. Desligue e eles somem.
5. **Build de produção.** `npm run build` + `npm run preview`: o menu da conta não tem a chave da
   demonstração.

---

## PJ-2VAFXX · Profissionais e funções da equipe (E1-03)

**Preparar:** conta DONO na API de dev, com pelo menos mais uma pessoa na equipe.

1. **Funções.** Equipe › Pessoas › "…" de um membro › funções: marque Veterinário e Recepção e
   salve. A linha passa a mostrar as funções.
2. **Ficha nova.** Equipe › Profissionais › "Cadastrar profissional": CRMV com número e UF, uma
   especialidade, uma cor e o login de alguém da equipe. A ficha aparece com "CRMV a conferir".
   - CRMV sem número ou sem UF: o campo pede antes de salvar.
   - O mesmo CRMV e UF de novo: a mensagem de duplicado.
3. **Selo.** Uma ficha conferida no CMS mostra "CRMV conferido"; uma conferida há mais de 365
   dias, "Conferência vencida".
4. **Aviso antes de salvar.** Numa ficha conferida: trocar o número ou a UF avisa que o selo sai;
   trocar o login para "Sem login" avisa "Desligar o login desta ficha tira o selo de conferido".
5. **Desativar e reativar.** "…" › Desativar: a ficha vai para a lista recolhida, de onde volta com
   "Reativar ficha".
6. **Como OPERADOR.** Entre com a outra conta: vê a lista, edita só a cor e as especialidades da
   própria ficha e não cadastra fichas.

---

## PJ-2OPCOW (parte do portal) · Sem o perfil veterinário antigo (E1-07c)

1. **Login.** Entre com uma conta que tinha perfil de veterinário: cai no portal normalmente.
2. **Configurações › Perfil.** Não há mais CRMV nem especialidade; a seção "CRMV" diz que eles
   ficam na ficha e tem "Abrir as fichas da equipe". O selo "Veterinário" aparece só para quem tem
   essa função na equipe.
3. **Foto.** Troque a foto e recarregue: ela fica (inclusive numa conta criada agora).
4. **Configurações › Conta.** O selo "Veterinário" segue a mesma regra do Perfil.
