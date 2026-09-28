# 10 · Anamnese por voz

> O vet conversa com o responsável normalmente; a escuta transcreve e devolve a anamnese
> estruturada para revisão — cada campo com o trecho da conversa de onde veio.

## Por que existe

É o efeito imediato mais forte da demonstração e ataca a dor número um do vet: tempo de
digitação. E só funciona porque o prontuário é estruturado (requisito 03): a escuta preenche
campos, não escreve um textão.

## Pronto quando

Uma conversa de consulta gravada vira anamnese estruturada revisável, e o vet confia no que vê
porque rastreia cada campo até o que foi dito.

---

## Como usar

1. Anamnese → **Gravar consulta** (cabeçalho do formulário).
2. Ler para o responsável o texto do diálogo e registrar a autorização.
3. Escolher a fonte: **Microfone** (Chrome/Edge) ou **Consulta de demonstração**. A escolha fica
   lembrada no navegador (`clinic.escuta.fonte`).
4. Conversar. **Encerrar e revisar** quando acabar.
5. Marcar o que entra, corrigir o que precisar, **Aplicar ao prontuário**.

Para apresentar: use a demonstração. "Adiantar a conversa" toca o resto de uma vez.

## Como a seção se organiza

- **Cabeçalho que fica.** Estado, relógio, quem autorizou e o resumo da fase ("9 de 10 campos ·
  3 para conferir"; na revisão, "Marcados: 0 de 12"). A seta recolhe o resto em qualquer fase —
  recolhida, a seção continua dizendo que o microfone está aberto, e as ações de pausar e encerrar
  continuam ali.
- **Conversa que entra e sai.** Ouvindo, fica ao lado. Na revisão sai de cena (cada campo já traz
  a citação); volta pelo botão "Mostrar conversa" ou pela citação de qualquer campo, que a abre
  na fala certa sem tirar o campo da vista.
- **Campos nos grupos do formulário** — O que trouxe o paciente · Sinais gerais · Prevenção ·
  Antecedentes · Ouvido e não preenchido —, em duas colunas quando há largura. Cada grupo diz o
  que ainda não apareceu.
- **Vista padrão por fase**, que a pessoa muda dentro da fase: ouvindo aberta com conversa;
  revisão aberta sem conversa; aplicada recolhida numa linha.

Medido na largura padrão (1480 px com o menu): a revisão caiu de 1465 px para 1049 px de altura,
e recolhida ocupa 69 px — o formulário da anamnese sobe de 1901 px para 505 px da página.

## O que é real e o que é encenado

| Parte | Microfone | Demonstração |
|---|---|---|
| Transcrição | `SpeechRecognition` do navegador, pt-BR. No Chrome, o áudio passa pelo serviço de voz do Google; ao produto só volta texto | Conversa roteirizada (`data/fixtures/consulta-gravada.ts`), tocada 3× mais rápido |
| Quem falou | Não separa vozes — todo trecho é `nao-identificado` | Autoria no roteiro |
| Estruturação | **Motor local de regras** (`domain/escuta.ts`), sem modelo de linguagem e sem rede — **o mesmo nos dois** | idem |
| Medidor de nível | Volume real do microfone (Web Audio) | Simulado pela fala em curso |

A tela diz qual é qual numa nota sempre visível, como a proposta de rotina do hotel.

## Onde está

| O quê | Arquivo |
|---|---|
| Motor, verificação e aplicação | `domain/escuta.ts` — 31 testes em `domain/__tests__/escuta.spec.ts` |
| Tipo do trecho da conversa | `data/types.ts` → `TrechoDaConversa` |
| Fontes (microfone e demonstração) | `data/fontes-da-escuta.ts` |
| Sessão, autorização, revisão, vista por fase | `stores/escuta.ts` — 6 testes de ponta a ponta em `stores/__tests__/escuta.spec.ts` |
| Tela | `components/escuta/` — painel, conversa, campo, autorização, gatilho, indicador |
| Cor "a máquina propôs" | `theme/clinic-tokens.css` → `--clinic-maquina*` (periwinkle da paleta) |

## Casos difíceis — todos acontecem na demonstração

| Caso | O que a tela faz |
|---|---|
| Cachorro latindo | O latido cobre "dois" e a transcrição ouve "dez": a proposta sai **10 dias**, marcada "Latido no trecho", com o trecho sublinhado na conversa. O vet corrige para 2 sem regravar |
| Duas pessoas falando juntas | Mãe e filha discordam sobre as fezes: o trecho sai como "Duas vozes", a proposta mostra **as duas versões** |
| A máquina inventa | "A vacina da raiva ela tomou em março" vira "vacinação em dia" marcado **Deduzido, não foi dito** |
| Decisão clínica | "Pode ser uma gastroenterite" é ouvido e **não** preenchido — nota "Ouvido e não preenchido" manda para a etapa de diagnóstico |
| Peso de casa | "Tá com uns seis quilos" não vira vital (mesma regra da pré-consulta) |

## Decisões

- **Nada nasce marcado.** Aprovar é gesto item a item; corrigir já marca.
- **Toda proposta carrega citação** (trecho, início, fim). `alertasDaProposta` marca interferência,
  confiança baixa, divergência, dedução — e `sem-origem`, que é o que pega um modelo que inventa
  citação. Trocar o motor de regras por um modelo é trocar `extrairDaConversa`; a verificação fica.
- **Campo simples substitui** (a revisão mostra o valor atual), **história soma**, **antecedente
  soma sem repetir**.
- **O áudio não é guardado; a conversa também não vai para o atendimento.** Vive na memória da
  aba. Sair do prontuário fecha o microfone e guarda o que foi ouvido para a revisão.
- **A gravação continua fora da anamnese**, com indicador junto do stepper e caminho de volta.
- **O painel fica fora do modo teclado** (`data-fora-do-teclado`): o `Enter` que avança campo não
  atravessa a revisão, e o foco da etapa continua caindo na queixa.

## O que ainda não existe

- **Aviso no app do responsável.** O consentimento é o da sala, dito e registrado com nome e hora.
  Mostrar "sua consulta está sendo gravada" no celular exige campo novo no contrato
  (`contrato/responsavel.ts`, doc 09) — não foi acrescentado.
- **Persistir a conversa no atendimento** (rastro depois de recarregar, impressão, auditoria).
- **Separar vozes ao vivo** e **outros idiomas**: as regras do motor são de português.
- **Modelo de linguagem de verdade**, atrás da API — a verificação de citação já está pronta
  para ele.
