# Épico E1: Fundação do estabelecimento

**Status:** In Review
**Autor:** Nicolas (via Claude)
**Criado em:** 2026-10-20
**Versão:** 0.1
**Épico pai:** [portal-do-parceiro.md](portal-do-parceiro.md)
**Partes (cada uma entregável sozinha):**
1. [01-perfil-publico-do-estabelecimento.md](../2026/q4/q4-1/portal-parceiro/e1-fundacao/01-perfil-publico-do-estabelecimento.md): slug, endereço, fuso, horários, feriados, contatos e a página pública, publicada pelo dono campo a campo
2. [02-modulos-do-parceiro.md](../2026/q4/q4-1/portal-parceiro/e1-fundacao/02-modulos-do-parceiro.md): módulo Clínica e módulo Hotel ligados no servidor, com guard próprio (substitui o `?clinico=on`)
3. [03-profissionais-e-papeis.md](../2026/q4/q4-1/portal-parceiro/e1-fundacao/03-profissionais-e-papeis.md): profissional com CRMV como entidade, papéis operacionais e matriz de permissão por recurso
4. [04-contrato-erros-e-rotas-publicas.md](../2026/q4/q4-1/portal-parceiro/e1-fundacao/04-contrato-erros-e-rotas-publicas.md): código de erro estável, datas no fuso do estabelecimento, idempotência, limite de taxa distribuído, captcha e CORS para as rotas novas
5. [05-trilha-de-auditoria-clinica.md](../2026/q4/q4-1/portal-parceiro/e1-fundacao/05-trilha-de-auditoria-clinica.md): quem leu, escreveu, publicou ou exportou o quê, para o parceiro e para o responsável
6. [06-avisos-ao-parceiro-e-pendencias.md](../2026/q4/q4-1/portal-parceiro/e1-fundacao/06-avisos-ao-parceiro-e-pendencias.md): notificação para a equipe por permissão e os contadores do menu e do Início
7. [07-aposentar-legado-clinica-veterinario.md](../2026/q4/q4-1/portal-parceiro/e1-fundacao/07-aposentar-legado-clinica-veterinario.md): parar de gravar e depois remover `Veterinario`, `Clinica`, `ClinicasPacientes` e afins

---

## Visão Geral

Hoje o `Parceiro` é uma entidade comercial (cadastro, auditoria, indicação, carteira). Para ser uma clínica ou um hotel ele precisa de quatro coisas que não tem: **identidade pública** (onde fica, que horas abre, em que fuso), **módulos** ligados no servidor, **pessoas com função** (o veterinário com CRMV, a recepção, a enfermagem, o cuidador do hotel) e **regras de contrato** que as rotas novas sigam (erro com código, data com fuso, idempotência, proteção das rotas públicas). E tudo o que for clínico precisa de trilha.

## Motivação

- Sem perfil, as páginas públicas `/agendar/:slug` e `/reservar/:slug` do portal não têm de onde ler, e o receituário controlado não tem o endereço do prescritor (o mock guarda em `Clinic.endereco`, `petjourney-admin/src/features/clinico/data/types.ts:55-72`).
- Sem módulo no servidor, qualquer parceiro (pet shop, farmácia) abre a clínica pelo `?clinico=on` (`src/router/index.ts` do portal, guarda só no cliente), e a rota de API atrás do `ParceiroGuard` também abriria, porque ele não olha categoria (inventário, achado 3).
- Sem profissional, nenhum ato clínico tem o "nome e CRMV de cada profissional responsável" que a Res. CFMV 1.321/2020 (art. 9) exige.

## Decisões do épico

- **D-E1.1 Perfil separado do cadastro.** `EstabelecimentoPerfil` é tabela própria, preenchida e publicada pelo DONO. A **D9.14** continua valendo para o cadastro (cnpj, crmv, telefone comercial nunca saem em superfície pública); o perfil público é outro dado, que o dono decidiu mostrar.
- **D-E1.2 Fuso IANA do estabelecimento.** Toda regra de horário (slot, prazo em expediente, rotina do hotel, véspera) usa `EstabelecimentoPerfil.fusoHorario`. O header `X-Timezone` do navegador não manda no horário da clínica (e o CORS de prod nem o deixa passar, `main.ts:151`).
- **D-E1.3 Módulo é por parceiro.** `ModuloDoParceiro` (CLINICA, HOTEL) com status no servidor. Categoria sugere o módulo; não o liga. Uma clínica com hotel liga os dois.
- **D-E1.4 Profissional é entidade; papel é função na equipe.** `Profissional` existe com ou sem login (o plantonista que não usa o sistema ainda aparece na agenda e assina o que fez com o CRMV dele). Papéis operacionais somam-se ao DONO/OPERADOR na `ParceiroEquipe`.
- **D-E1.5 Permissão por recurso, em código.** A matriz papel x permissão é constante versionada (é regra de segurança, não configuração de produto), aplicada por um guard único `PermissaoParceiroGuard` sobre a membership.
- **D-E1.6 Leitura do próprio registro sobrevive à suspensão.** Parceiro suspenso ou com módulo suspenso lê e exporta o que é dele (dever de operador da LGPD), mas não escreve nem publica. Mesmo espírito da D8.3.

## Riscos do épico

| Nível | Risco | Mitigação |
|---|---|---|
| Alto | Matriz de permissão errada abrir prontuário para recepção ou cuidador | Matriz com teste de tabela verdade (cada papel x cada permissão), cenários `qa/cenarios/` por papel, `security-auditor` |
| Médio | Perfil público usado para se passar por outra clínica | Publicar exige auditoria APROVADO; slug não pode ser igual a nome de outro parceiro aprovado sem revisão do admin |
| Médio | Remover o legado quebrar app antigo | E1-07 em fases, com a remoção de tabela só depois de zero leitura medida em log por 30 dias |

## Change Log

| Data | Versão | Mudança | Autor |
|---|---|---|---|
| 2026-10-20 | 0.1 | Criação | Nicolas (via Claude) |
