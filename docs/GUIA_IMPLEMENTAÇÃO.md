# Guia de Implementação — Web Admin Veterinário

Status: guia inicial para construção do painel administrativo veterinário.
Escopo inicial: veterinário, clínica, pacientes, agenda, prontuário e acompanhamento clínico.
Fora do escopo inicial: tradução, escolha de base técnica, telas de tutor completas e gestão financeira avançada.

---

## 1. Direção do Produto

O web admin deve ser a extensão operacional do perfil veterinário do PetJourney. O app mobile hoje é mais forte para o tutor: cadastro de pets, prontuário pessoal, carteirinha, lembretes, diário, saúde estruturada e compartilhamento temporário. A área veterinária já aponta o caminho, mas ainda é pequena: dashboard, agenda, pacientes, atividade e um prontuário no modelo SOAP.

A primeira versão do admin deve transformar esse rascunho em uma ferramenta de rotina clínica:

- ver o dia de trabalho;
- localizar paciente e tutor rapidamente;
- abrir histórico clínico do pet;
- registrar atendimento;
- acompanhar pendências;
- consultar informações compartilhadas pelo tutor;
- manter uma experiência visual coerente com o PetJourney.

O painel não deve tentar replicar todo o app de tutor. O foco inicial é o veterinário trabalhando: agenda, pacientes, prontuário e tarefas.

---

## 2. Leitura da Estrutura Atual

### Perfis

O produto separa dois perfis principais:

- Tutor: azul, foco em cuidado diário, registro de saúde, lembretes e plano.
- Veterinário: verde, foco em agenda, pacientes, atividade clínica e prontuário.

O web admin deve nascer como ambiente veterinário. Por isso, a cor principal deve ser sempre a paleta verde do perfil vet, não a paleta azul do tutor.

### Núcleo de domínio existente

Os módulos mais importantes já presentes no produto são:

- Pets e tutores.
- Perfil completo do pet.
- Prontuário geral.
- Vacinas.
- Consultas.
- Medicamentos.
- Lembretes.
- Peso.
- Documentos.
- Carteirinha.
- Diário do pet.
- Saúde estruturada: diagnósticos, alergias e tratamentos contínuos.
- Compartilhamento temporário com prestador.
- Artigos e conteúdos.
- Planos, benefícios e cupons.

Para o admin veterinário inicial, os módulos prioritários são:

- Dashboard veterinário.
- Agenda.
- Pacientes.
- Prontuário clínico.
- Atividades e pendências.
- Compartilhamentos recebidos.
- Cadastro/edição de dados da clínica e do veterinário.

Planos, cupons, ebooks e artigos podem ficar fora da primeira entrega veterinária, salvo se o painel também acumular função de administração geral do negócio.

---

## 3. Paleta Oficial

A paleta é a parte mais importante da implementação visual. O admin deve parecer PetJourney, mas com personalidade clínica e veterinária.

### Cores de marca

| Uso                   | Cor        | Hex       |
| --------------------- | ---------- | --------- |
| Marca institucional   | Navy       | `#1D3557` |
| Fundo quente de marca | Cream      | `#FFEDD8` |
| Texto sobre cor forte | White warm | `#FAF9F6` |

O navy deve aparecer como apoio institucional: logotipo, títulos especiais, rodapé institucional ou navegação secundária. Ele não deve competir com o verde veterinário.

### Perfil veterinário

| Uso                    | Cor           | Hex       |
| ---------------------- | ------------- | --------- |
| Primária veterinária   | Vet primary   | `#84C1B4` |
| Secundária veterinária | Vet secondary | `#B8CDC9` |

Essa dupla é a base do admin. Use `#84C1B4` para ações principais, itens ativos, foco de navegação, gráficos principais e elementos de destaque. Use `#B8CDC9` para fundos suaves, gradientes, áreas de apoio e estados selecionados leves.

### Perfil tutor

| Uso              | Cor             | Hex       |
| ---------------- | --------------- | --------- |
| Primária tutor   | Tutor primary   | `#457B9D` |
| Secundária tutor | Tutor secondary | `#6BA3C3` |

No admin veterinário, azul deve ser reservado para contexto de tutor, não para estrutura principal. Exemplos: chip "Tutor", detalhes de responsável, link para dados do tutor ou origem de informação enviada pelo tutor.

### Semânticas e categorias

| Uso                         | Cor        | Hex       |
| --------------------------- | ---------- | --------- |
| Sucesso / resolvido         | Success    | `#A8DADC` |
| Sucesso forte / saúde       | Green      | `#84C1B4` |
| Atenção / pendência         | Orange     | `#FFB7A1` |
| Perigo / crítico            | Danger     | `#ff4444` |
| Vermelho suave              | Red        | `#F28482` |
| Informação / destaque frio  | Purple     | `#BDB2FF` |
| Banho/tosa/serviço leve     | Pink       | `#FAD2E1` |
| Observações / neutro quente | Brown      | `#D5BDAF` |
| Internação / caso complexo  | Internação | `#5B6B8C` |

Regras de uso:

- Não inventar novos tons no primeiro ciclo.
- Não criar modo escuro.
- Não usar gradientes coloridos fora da combinação veterinária `#84C1B4` → `#B8CDC9`.
- Usar vermelho apenas para risco real, erro, alergia grave, diagnóstico crítico ou exclusão.
- Usar laranja para atenção, retorno pendente, vacina próxima, exame para revisar ou tarefa atrasada.
- Usar roxo para informação, comportamento, atividade e comunicação.
- Usar azul apenas quando o assunto for tutor ou origem externa do tutor.

### Texto, superfícies e bordas

| Uso                 | Cor         | Hex       |
| ------------------- | ----------- | --------- |
| Texto principal     | Ink 900     | `#1a1a1a` |
| Texto secundário    | Ink 600     | `#666`    |
| Texto discreto      | Ink 400     | `#999`    |
| Texto desabilitado  | Ink 300     | `#CBD5E1` |
| Fundo base          | White warm  | `#FAF9F6` |
| Fundo de tela       | Surface 50  | `#f8f9fa` |
| Fundo de card suave | Surface 100 | `#f0f0f0` |
| Borda sutil         | Surface 200 | `#eee`    |

O admin deve ser claro, quente e limpo. Evitar branco puro excessivo quando houver grandes áreas vazias; preferir fundos levemente quentes e cards brancos.

### Transparências recomendadas

Quando precisar de variações claras, derivar da própria cor:

- Destaque leve: 8% a 10% da cor principal.
- Fundo de ícone: 12% a 15% da cor principal.
- Borda selecionada: cor sólida ou 35% a 45% em casos leves.

Exemplos práticos:

- Card ativo: fundo verde muito leve, borda verde e ícone verde.
- Alerta crítico: fundo vermelho suave, borda vermelha e texto forte.
- Pendência: fundo laranja suave, ícone laranja e texto escuro.

---

## 4. Identidade Visual do Admin

### Sensação desejada

O admin deve transmitir:

- confiança clínica;
- organização;
- leveza;
- rapidez de leitura;
- cuidado com tutor e pet;
- menos "sistema hospitalar frio", mais "painel premium de cuidado".

### Assinatura visual

O app usa uma assinatura recorrente: topo em gradiente de perfil e área branca com cantos arredondados por cima. No admin, a adaptação recomendada é:

- barra lateral ou topo com verde veterinário;
- área de conteúdo clara;
- cards brancos com raio alto;
- sombras suaves;
- ícones lineares;
- badges compactos;
- dados clínicos em blocos bem separados.

### Densidade

O admin pode ser mais denso que o app mobile, mas não deve virar planilha visual. A leitura deve priorizar:

- informação crítica no topo;
- listas escaneáveis;
- filtros próximos da lista;
- ações principais visíveis;
- detalhes só quando o usuário entra no paciente ou atendimento.

---

## 5. Estrutura Recomendada do Web Admin

### Navegação principal

Menu inicial recomendado:

1. Dashboard
2. Agenda
3. Pacientes
4. Prontuários
5. Atividades
6. Compartilhamentos
7. Clínica
8. Configurações

Para o primeiro ciclo, os itens 1 a 5 são obrigatórios. Compartilhamentos deve entrar se o fluxo de acesso temporário com prestador/veterinário for priorizado.

### Dashboard

Objetivo: responder "o que preciso fazer hoje?".

Blocos recomendados:

- Agenda de hoje.
- Pacientes do dia.
- Pendências clínicas.
- Retornos aguardando revisão.
- Alertas de saúde.
- Atalhos rápidos.
- Conteúdos recentes, se fizer sentido para veterinários.

Métricas iniciais:

- consultas hoje;
- pacientes atendidos;
- pendências abertas;
- retornos pendentes;
- pacientes em atenção.

Cards do dashboard devem usar o verde como cor principal e laranja/vermelho apenas para exceções.

### Agenda

Objetivo: organizar o dia clínico.

Componentes funcionais:

- faixa de dias;
- agrupamento por turno;
- card de atendimento;
- status: confirmado, pendente, concluído, cancelado;
- tipo: consulta, vacina, retorno, exame, cirurgia;
- sala/unidade;
- tutor responsável;
- ação rápida para abrir prontuário.

Estados obrigatórios:

- carregando agenda;
- sem atendimentos no dia;
- erro ao carregar;
- atendimento atualizado com sucesso.

### Pacientes

Objetivo: localizar pet/tutor rapidamente e entender risco.

Campos mínimos:

- nome do pet;
- espécie;
- raça;
- idade;
- tutor;
- última consulta;
- status de risco;
- tags clínicas relevantes;
- foto ou avatar.

Filtros iniciais:

- todos;
- cães;
- gatos;
- atenção;
- sem consulta recente;
- com pendência.

Busca:

- por pet;
- por tutor;
- por telefone/e-mail se disponível;
- por documento interno se existir.

### Prontuário Clínico

Objetivo: dar ao veterinário uma visão segura e acionável do pet.

Abas recomendadas:

- Resumo.
- Linha do tempo.
- Consultas.
- Vacinas.
- Medicamentos.
- Peso.
- Documentos.
- Diagnósticos.
- Alergias.
- Tratamentos contínuos.
- Diário do tutor.

O resumo deve destacar primeiro:

- alergias graves;
- diagnósticos ativos;
- tratamentos contínuos;
- últimos atendimentos;
- próximas ações;
- documentos recentes;
- sinais do diário do tutor.

### Registro de Atendimento

O modelo atual aponta para SOAP. O admin deve manter esse caminho:

- S: subjetivo, relato do tutor e queixa principal.
- O: objetivo, exame físico, sinais, medidas.
- A: avaliação, hipótese, diagnóstico.
- P: plano, conduta, medicação, retorno, exames.

Além disso:

- permitir anexos;
- gerar retorno/lembrete quando aplicável;
- vincular documentos;
- marcar tarefa para revisão;
- registrar profissional responsável.

### Atividades

Objetivo: ser a fila de trabalho do veterinário.

Colunas iniciais:

- Urgente.
- Acompanhar.
- Resolvido.

Tipos de atividade:

- revisar exame;
- responder tutor;
- checar retorno;
- completar prontuário;
- validar documento;
- acompanhar paciente de risco.

Cada item deve ter:

- pet;
- tutor;
- título;
- prazo;
- prioridade;
- origem;
- ação primária.

### Compartilhamentos

O produto já tem o conceito de compartilhamento temporário: o tutor escolhe categorias de dados, gera código/link e o prestador vê um snapshot com prazo. No admin veterinário, esse módulo pode virar "Acessos recebidos" ou "Compartilhamentos".

Funções recomendadas:

- listar acessos ativos;
- abrir snapshot do pet;
- registrar anotação de atendimento/serviço;
- anexar retorno;
- indicar se o tutor já leu;
- encerrar ou expirar acesso conforme permissão.

Ponto importante: snapshot compartilhado deve ser congelado no momento da criação. Se dados do pet mudarem depois, o acesso antigo não deve mudar silenciosamente.

---

## 6. Hierarquia de Informação Clínica

O admin deve organizar dados por risco e uso real, não por ordem técnica.

### Prioridade máxima

- alergia anafilática;
- diagnóstico ativo grave;
- medicamento contínuo;
- sinal de alerta recente;
- retorno atrasado;
- documento crítico;
- observação do tutor marcada como importante.

### Prioridade média

- próxima vacina;
- consulta recente;
- peso fora de tendência;
- exame pendente;
- tratamento em andamento;
- anotações não lidas.

### Prioridade baixa

- histórico antigo;
- documentos arquivados;
- registros informativos;
- conteúdo educacional.

---

## 7. Padrões de Componentes

### Cards

Cards devem ser a base da interface:

- fundo claro;
- borda sutil;
- raio alto;
- sombra leve;
- título forte;
- subtítulo legível;
- ícone em container colorido;
- badge quando houver status.

Tipos de card:

- card de métrica;
- card de paciente;
- card de atendimento;
- card de atividade;
- card clínico;
- card de documento.

### Badges

Badges devem ser curtos e objetivos:

- "Atenção"
- "Crítico"
- "Pendente"
- "Confirmado"
- "Concluído"
- "Nova nota"
- "Alergia grave"
- "Tratamento ativo"

Evitar badges longos. O conteúdo detalhado entra no corpo do card.

### Filtros

Filtros devem ficar próximos da lista afetada.

Para poucos filtros, usar chips. Para muitos filtros, usar busca + filtros avançados.

### Formulários

Formulários clínicos devem:

- separar seções;
- mostrar validação inline;
- preservar o texto digitado em erro;
- ter botão principal claro;
- destacar campos obrigatórios;
- evitar confirmação nativa genérica;
- usar confirmação destrutiva para exclusões.

### Estados

Toda tela precisa responder:

- o que aparece enquanto carrega;
- o que aparece se não há dados;
- o que aparece se falha;
- o que aparece quando a ação dá certo.

Empty state sem ação é fraco. Sempre que fizer sentido, oferecer CTA.

---

## 8. Dados Necessários

### Veterinário

- id;
- nome;
- foto;
- especialidades;
- registro profissional;
- clínicas vinculadas;
- horários;
- status ativo/inativo.

### Clínica

- id;
- nome;
- endereço;
- contato;
- especialidades;
- profissionais;
- salas/unidades;
- horários;
- status.

### Tutor

- id;
- nome;
- contato;
- pets vinculados;
- observações relevantes;
- consentimentos/compartilhamentos.

### Pet

- id;
- nome;
- espécie;
- raça;
- idade;
- sexo;
- castrado;
- foto;
- tutor;
- alergias;
- diagnósticos;
- tratamentos;
- vacinas;
- consultas;
- medicamentos;
- peso;
- documentos;
- diário;
- timeline.

### Atendimento

- id;
- pet;
- tutor;
- veterinário;
- clínica;
- data/hora;
- tipo;
- status;
- sala;
- SOAP;
- anexos;
- lembretes/retornos derivados;
- tarefas criadas.

### Atividade

- id;
- tipo;
- título;
- descrição;
- pet;
- tutor;
- responsável;
- prioridade;
- prazo;
- status;
- origem;

---

## 9. Permissões e Segurança de Produto

O admin veterinário deve respeitar separação clara de papéis:

- Veterinário vê pacientes e dados autorizados.
- Clínica pode gerenciar agenda e equipe quando tiver permissão.
- Administração geral pode criar clínica, editar veterinário, revisar cadastros e gerenciar conteúdo.
- Tutor controla compartilhamentos temporários quando o dado veio dele.

Regras importantes:

- Não expor dados de pet sem vínculo ou autorização.
- Dado compartilhado temporariamente deve respeitar expiração.
- Registro clínico não deve ser apagado sem confirmação forte.
- Excluir deve diferenciar "remover registro" de "remover também lembrete/derivados" quando existir vínculo.
- Erros de permissão devem ser claros, sem vazar dados.

---

## 10. Primeira Entrega Recomendada

### Fase 1 — Base visual e navegação

- Shell do admin com identidade veterinária.
- Menu principal.
- Dashboard com métricas mockadas ou reais, conforme disponibilidade.
- Agenda do dia.
- Lista de pacientes.
- Estado vazio, carregando e erro.

### Fase 2 — Paciente e prontuário

- Página de paciente.
- Resumo clínico.
- Abas de consultas, vacinas, medicamentos, peso e documentos.
- Destaque de alergias, diagnósticos e tratamentos ativos.
- Abertura de detalhe clínico.

### Fase 3 — Atendimento

- Registro SOAP.
- Criação de retorno.
- Anexos.
- Tarefas derivadas.
- Conclusão de atendimento.

### Fase 4 — Atividades e compartilhamentos

- Kanban ou lista de atividades.
- Compartilhamentos recebidos.
- Notas do prestador/veterinário.
- Histórico de ações.

### Fase 5 — Clínica e operação

- Cadastro/edição de clínica.
- Profissionais.
- Salas/unidades.
- Horários.
- Configurações de agenda.

---

## 11. Checklist Visual

- [ ] O verde `#84C1B4` é a cor principal do admin.
- [ ] O verde claro `#B8CDC9` aparece como apoio, não como texto principal.
- [ ] O navy `#1D3557` é institucional, não a cor dominante.
- [ ] Azul tutor só aparece quando o assunto é tutor.
- [ ] Vermelho só aparece em erro, perigo, alergia grave, crítico ou exclusão.
- [ ] Laranja comunica atenção ou pendência.
- [ ] Cards têm raio alto, borda sutil e respiro consistente.
- [ ] A tela não depende de modo escuro.
- [ ] Ícones são lineares e consistentes.
- [ ] Tabelas grandes não substituem cards onde há decisão clínica.
- [ ] Toda lista tem busca, filtro ou ambos.
- [ ] Toda tela tem loading, empty, error e success.

---

## 12. Checklist Funcional

- [ ] Dashboard responde o que o veterinário precisa fazer hoje.
- [ ] Agenda permite abrir paciente/atendimento sem fricção.
- [ ] Pacientes são buscáveis por pet e tutor.
- [ ] Prontuário mostra risco antes de histórico longo.
- [ ] SOAP está disponível no atendimento.
- [ ] Alergias graves são impossíveis de ignorar.
- [ ] Tratamentos contínuos aparecem no resumo.
- [ ] Documentos e exames recentes são fáceis de abrir.
- [ ] Diário do tutor aparece como contexto, não como fonte clínica absoluta.
- [ ] Atividades têm prazo, prioridade e responsável.
- [ ] Compartilhamento temporário respeita escopo, expiração e snapshot.
- [ ] Exclusões e ações destrutivas pedem confirmação clara.

---

## 13. Decisões Para Não Tomar Agora

Para manter a primeira entrega focada:

- Não decidir base técnica neste guia.
- Não criar tema escuro.
- Não desenhar fluxo completo de tutor no admin.
- Não resolver tradução.
- Não incluir módulo financeiro avançado.
- Não criar paleta nova.
- Não reclassificar todos os módulos do app mobile como obrigatórios no admin.

---

## 14. Resumo Executivo

O web admin veterinário deve começar como painel de rotina clínica: dashboard, agenda, pacientes, prontuário, atendimento SOAP e atividades. A identidade deve ser verde-veterinário, clara, premium e consistente com o PetJourney. A paleta não deve ser reinterpretada: `#84C1B4` é a cor principal, `#B8CDC9` é apoio, `#1D3557` é marca institucional, azul é contexto de tutor, laranja é atenção e vermelho é risco real.

A implementação deve priorizar leitura rápida, segurança clínica e ação direta. O veterinário precisa entender em segundos quem atende agora, quais pets exigem atenção, quais pendências existem e qual é o histórico relevante antes de registrar a conduta.
