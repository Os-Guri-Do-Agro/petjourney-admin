# 04 · Receituário digital

> Prescrever com bulário, dose calculada pelo peso, assinatura eletrônica e entrega ao
> responsável dentro do app.

## Por que existe

A receita é o artefato que mais circula entre clínica, responsável e farmácia, e hoje sai em
papel ou PDF solto. Digital e conectada, ela vira o começo da adesão ao tratamento e da
recorrência de medicamento contínuo.

## Pronto quando

A receita sai correta e assinada, chega no app do responsável e vira lembrete sem ninguém
digitar nada duas vezes.

---

## Entregue

| O que o requisito pede | Situação |
|---|---|
| Busca de medicamento com apresentação e concentração | Já existia — bulário com classe, cuidados e dose por espécie |
| **Cálculo de dose com a conta visível** | Feito — três passos numerados, conferíveis de cabeça |
| Posologia (intervalo e duração) | Já existia; agora aceita **uso contínuo** |
| Alerta forte de alergia ao princípio ativo | Já existia — confirmação explícita obrigatória, casa por sinônimo nos 4 idiomas |
| Pet sem peso: não calcula às cegas | Já existia — `avaliarDose` devolve `peso-ausente` |
| **Assinatura eletrônica com CRMV** | Feito — nome e conselho congelados, código verificador |
| **Validade da receita** | Feito — 30 dias, impressa no documento |
| Receita de controle especial | Já existia — folha separada, 1ª e 2ª via (Portaria 344/98); agora marcada também na emissão |
| Imprimir | Já existia — `DocumentoReceituario.vue` |
| **Envio ao responsável** | Feito — registro de entrega com data |
| **Repetir receita anterior em um toque** | Feito — copia com ids novos, sem herdar confirmação de alergia |

### Casos difíceis

| Caso | Situação |
|---|---|
| **Dose que exige fracionar comprimido** | Feito — "meio comprimido", não "0,5". Quando a conta não cai numa fração partível, a tela **avisa** em vez de imprimir 0,37 |
| **Medicamento de uso contínuo, sem data de fim** | Feito — `duracaoDias: null`. Não é duração longa: é a ausência de fim |
| **Alergia registrada** | Já existia |
| **Pet sem peso recente** | Já existia |

---

## Decisões

- **Assinar congela.** A receita é cópia da conduta no instante da assinatura, não espelho
  dela. Se apontasse para a conduta viva, mudar a dose depois de assinar alteraria em silêncio
  um papel que já está na farmácia — com a assinatura anterior ainda no rodapé.
- **Uso contínuo não é 365 dias.** Representá-lo como número faria a receita vencer sozinha e o
  lembrete do responsável parar num dia arbitrário. Num anti-hipertensivo, parar é o efeito
  adverso.
- **A conta é do vet; a instrução é do responsável.** O painel mostra as duas leituras do mesmo
  dado, lado a lado. `12,4 kg × 10 mg/kg = 124 mg` para conferir; "meio comprimido de 12 em 12
  horas" para executar.
- **O arredondamento é decisão do veterinário.** O algoritmo encaixa na fração partível mais
  próxima e **marca como aproximado**; o que ele não faz é arredondar em silêncio.
- **O código verificador não usa `I` nem `O`.** Ele é ditado ao telefone, e "I" vira "1" e "O"
  vira "0" na hora de repetir.

---

## Fora deste repositório

A subtarefa 3 — *"Receita chegando no app do tutor"* — é majoritariamente do **app**, que é
outro projeto. O que cabe ao portal está feito: a prescrição vira instrução legível, o envio é
registrado, e o painel mostra ao vet **exatamente o que o responsável vai ler**, incluindo o
lembrete que nasce da posologia. A tela do app em si é do repositório dele.

---

## Pendente

- [ ] **Lembrete de fato disparado** — hoje a tela mostra que a posologia vira lembrete; quem
      dispara é o app.
- [ ] **PDF assinado** — a impressão existe; a assinatura eletrônica ainda não vai embutida num
      arquivo com verificação externa. Na API real, o código verificador vira resumo
      criptográfico do documento.
