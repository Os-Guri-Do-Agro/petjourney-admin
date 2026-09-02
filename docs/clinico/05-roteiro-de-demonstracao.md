# 05 · Roteiro de demonstração ponta a ponta

> Costurar os protótipos numa história única de dez minutos, com dados coerentes, apresentável
> a uma clínica de verdade.

**Recorte deste documento: a visão da clínica.** O lado do responsável (app) é outro
repositório; onde o elo aparece, o roteiro mostra o que a clínica vê e diz o que acontece do
outro lado, sem fingir que a tela existe aqui.

## Pronto quando

A demonstração roda inteira, sem travar, na frente de alguém que trabalha em clínica, e essa
pessoa consegue dizer onde isso ajudaria no dia dela.

---

## Antes de começar

1. **Ligue o módulo.** Ele nasce oculto. Abra qualquer rota do portal com `?clinico=on`, ou
   digite `clinico` fora de um campo de texto. Confirme que "Clínico" e "Pets" apareceram no
   menu antes de a plateia entrar.
2. **Não apresente em domingo.** O fixture da clínica tem `weekday: 0` fechado, e a âncora do
   dataset pula para segunda: "Hoje na clínica" e a Agenda abrem **vazias**. O deslocamento de
   relógio do painel de dev é de ±12 h e não salva. Se a data for domingo, abra a clínica de
   demonstração aos domingos no fixture antes — é dado, não lógica.
3. **Confira a largura.** A agenda mostra cinco colunas de profissional. Em projetor 4:3 elas
   apertam; use o painel de exibição para filtrar dois ou três profissionais antes de começar.

---

## O roteiro — dez minutos

### 1 · A clínica hoje  ·  `/veterinario/meu-dia`  ·  1 min

Abre no que a recepção olha ao chegar: quem já está esperando, quem está em atendimento, o que
vem a seguir.

> "Esta é a primeira tela do dia. Antes de abrir qualquer prontuário, a clínica sabe onde está."

### 2 · A agenda  ·  `/veterinario/agenda`  ·  2 min

O coração da demonstração e onde a clínica decide se troca de sistema.

- **Mostre a legenda** e clique num tipo: a grade filtra. Diga que a cor nunca vem sozinha —
  tem ícone e nome, e o filtro é a própria legenda.
- **Arraste um atendimento** para outro horário. A caixa de confirmação mostra de → para, os
  avisos, e **o texto que sai para o responsável**. Não confirme ainda: mostre que arrastar
  nunca salva sozinho.
- **Alterne para "por sala"** e volte. Mesmo horário, outro eixo.
- **Marque uma falta** pelo botão no próprio card. Três coisas acontecem juntas: o status muda,
  a fila de espera é consultada e o **reagendamento abre na hora**, com horários já buscados e o
  telefone clicável.

> "Falta é dinheiro perdido. Aqui ela vira uma ligação, não uma linha num relatório."

### 3 · O atendimento  ·  abrir o prontuário do paciente em atendimento  ·  4 min

O trecho mais longo, e o que justifica o produto.

- **Cabeçalho**: alergia e comorbidade aparecem **sem clicar**. Aponte isso.
- **Anamnese**: se o atendimento tiver pré-consulta, o painel do app está no topo — respostas do
  responsável como **sugestão**, com "Usar respostas". Diga que nada entra sozinho.
- **Exame físico**: aferir o peso. **A dose recalcula e o cabeçalho acompanha**, com a marca
  "hoje". Depois um vital fora da faixa: seta, palavra e a faixa da espécie, porte e idade.
- **Diagnóstico**: buscar no catálogo, marcar um diferencial.
- **Conduta**: prescrever pelo bulário. Mostre **a conta aberta** (peso × mg/kg = dose), o
  fracionamento em palavra ("meio comprimido"), e o **alerta de alergia** exigindo confirmação
  explícita — sem impedir.

> "A conta aparece porque o veterinário confere de cabeça. Número pronto num campo não se
> confere."

### 4 · A receita  ·  mesma tela, painel de receita  ·  2 min

- **Assinar e emitir**: sai o código verificador, o CRMV e a validade.
- Mostre o bloco **"Como o responsável vê"**: a mesma prescrição em linguagem de quem
  administra, e o lembrete que nasce da posologia.
- **Enviar ao responsável**: fica registrado com data.
- Se houver receita anterior, **Repetir** traz tudo com um toque.

> "É aqui que o elo aparece: a mesma prescrição, sem ninguém digitar duas vezes."

### 5 · Os documentos  ·  etapa "Resumo"  ·  1 min

Os sugeridos aparecem em cartão — o que **este** atendimento implica. Abra "Outros documentos"
e mostre a lista: termos, declarações, encaminhamento, orçamento.

> "Quinze documentos, mas a tela só oferece os três ou quatro que este atendimento pede."

---

## Coerência dos dados

O dataset é determinístico: mesma semente, mesmo dia âncora, os mesmos 40 atendimentos. O que
a demonstração precisa manter alinhado:

| Dado | Como se mantém coerente |
|---|---|
| **Mesmo pet** | Um id só (`pet-nina`, `pet-luna`…) atravessa agenda, prontuário, histórico e documentos |
| **Mesmo peso** | O cabeçalho recebe o **peso vigente** do atendimento, não o do cadastro; quando difere, marca "hoje" |
| **Mesma data** | Tudo passa por `clinicClock`, e o dia âncora nasce em "hoje" |
| **Mesma clínica** | Uma só: PetJourney Clínica Veterinária, com endereço e telefone usados nos documentos |

**Equipe**: cinco veterinários (clínica geral, cirurgia, dermatologia, cardiologia,
anestesiologia) — mais que os três do enunciado. Não é defeito, mas cinco colunas apertam em
projeção; filtre antes.

---

## O que é protótipo e o que é real

A lista honesta, para não prometer o que não existe.

### Funciona de verdade nesta tela

- Agenda multi-profissional e multi-sala, encaixe, bloqueio, arraste com confirmação e desfazer
- Detecção de conflito (sobreposição, sala ocupada, invasão de bloqueio, fora do expediente)
- Prontuário completo com autosave, rascunho local e disputa entre dispositivos
- Faixas de referência por espécie, **porte e idade**, com o realce independente de cor
- Cálculo de dose com a conta aberta, fracionamento e aviso de alergia por princípio ativo
- Emissão dos quinze documentos em folha A4, com impressão pelo navegador
- Fila de espera com posição, oferta e prazo

### É protótipo — a forma está certa, o motor não existe

| O que a tela mostra | O que ainda não acontece |
|---|---|
| Assinatura eletrônica com código verificador | O código é resumo simples; na API vira assinatura criptográfica |
| "Enviar ao responsável" | Registra o envio; **quem entrega é o app**, que é outro projeto |
| Lembrete de medicação | Nasce da posologia e é mostrado; **quem dispara é o app** |
| Aviso de remarcação e oferta de vaga | O texto é gravado como comprovante; **não sai mensagem** |
| Pré-consulta respondida no app | O dado é plantado no dataset; a coleta é do app |

### Não existe — não prometa

- **Nenhuma API.** Tudo roda sobre a camada mocada; recarregar com outra semente recria o mundo
- **Preços**: o orçamento sai com os itens e os valores em branco
- **Plano de saúde do paciente**: operadora e apólice são preenchidos à mão no relatório
- **Microchip**

> Duas linhas saíram desta lista depois que foram construídas: **lote, fabricante e validade de
> vacina** (hoje o registro existe, e o comprovante sai preenchido) e o **modo de digitação
> rápida no prontuário**. O que continua sem destino é o outro lado: nenhum desses campos de
> vacina tem onde aterrissar na API — `model Vacina` guarda só nome e data
> ([06-perguntas-ao-app.md](./06-perguntas-ao-app.md)).

---

## Buracos conhecidos no percurso

Onde a demonstração exige que o apresentador navegue à mão. **Cada um destes é buraco de
produto, não de apresentação** — que é exatamente o que este requisito existe para revelar.

1. **Depois de "Finalizar atendimento", a tela fica onde está.** Ela vira somente leitura, mas
   não devolve à agenda; o passo seguinte da história é um clique no menu.
2. **O painel de casos difíceis é só de desenvolvimento** (`import.meta.env.DEV`). Num build
   publicado, os atalhos para os doze casos plantados somem — e alcançá-los passa a exigir
   navegar até cada um.
3. ~~**Vacinação não fecha o ciclo.**~~ **Fechado.** O registro de aplicação (lote, fabricante,
   validade, dose da série) e a lista de chamada de reforço em `/veterinario/vacinas` foram
   construídos depois deste levantamento.
4. **O consentimento não nasce onde deveria.** Ele é assinado antes do procedimento, e o lugar
   dele é a agenda, quando o tipo é cirurgia — hoje só existe para reimpressão no fim.

---

## Verificação desta rodada

Conferido contra o código em 2026-09-02:

- [x] Massa de dados coerente: uma clínica, cinco vets, 24 pacientes com histórico, 40
      atendimentos no dia âncora e 12 casos difíceis plantados
- [x] Coerência de pet, peso e data entre telas — **o peso foi corrigido nesta rodada**
- [x] Roteiro escrito
- [x] Lista honesta de protótipo × real
- [ ] Transições sem buracos — quatro buracos listados acima
- [ ] Rodada com alguém que opera clínica — **gate de processo**, não entregável de código
