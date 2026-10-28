# Roteiro de apresentação do portal

Para **quem apresenta** o portal a uma empresa: clínica veterinária, hotel e creche, ou as demais
empresas da rede (pet shop, banho e tosa, adestramento, farmácia). Fica na mão de quem fala, não
na parede.

| Arquivo | Para quê |
|---|---|
| `Roteiro-de-Apresentacao.pdf` | O roteiro: 40 páginas, um tronco comum de 10 min e um percurso por tipo de empresa |
| `Roteiro-de-Apresentacao.html` | **A fonte.** O PDF é gerado dela, nunca editado |
| `telas/*.png` | Capturas do sistema rodando, não maquetes |
| `sessao-de-captura.js` | O que roda antes do app para as capturas saírem cheias e iguais |
| `faixa-capa.png`, `faixa-secao.png` | A faixa sálvia com os desenhos de traço, tirada do próprio portal (capa e divisórias) |
| `fontes/`, `logo-branca.png` | Readex Pro e Instrument Sans (as do portal) e a marca em branco, para o PDF não depender da máquina |

O documento veste o design do portal (o do app, 26/10/2026): a faixa sálvia de ponta a ponta no
alto, título branco direto na cor, painéis em véu sálvia, a cor de cada módulo só em pastel com a
tinta dele por cima, e nenhuma tarja colorida na borda. Refeito em 27/10/2026, com todas as
capturas no design novo.

## O que tem no roteiro

1. **Como usar** e **Escolha o percurso**: a tabela de atos por tipo de empresa, com o tempo.
2. **Antes de entrar na sala**: conta, pet compartilhado, módulos ligados, horário, checklist.
3. **Tronco comum** (todas as empresas): a promessa, a entrada, o Início, Acessos, Divulgação e
   Ganhos.
4. **Percursos**: Clínica (C1–C9), Hotel (H1–H7) e Rede (R1–R3). Cada ato tem passos, fala
   sugerida, o argumento de venda e os avisos.
5. **Apoio**: o fecho, as perguntas do cliente, o que é real e o que é demonstração, o plano B e
   uma cola com endereços e nomes.

A seção **"O que é real e o que é demonstração"** não é opcional. O Portal do parceiro fala com
o servidor; Clínica e Hotel são protótipos sobre dados de demonstração. Prometer o que não existe
custa a próxima reunião.

## Regenerar o PDF

Só precisa do Edge, que já vem no Windows:

```powershell
$edge = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
$dir  = "<caminho>\docs\apresentacao"

& $edge --headless=new --disable-gpu --no-pdf-header-footer --virtual-time-budget=5000 `
  --print-to-pdf="$dir\Roteiro-de-Apresentacao.pdf" `
  "file:///$($dir -replace '\\','/')/Roteiro-de-Apresentacao.html"
```

O rodapé (nome do documento e "página / total") vem do `@page` do próprio HTML; o
`--no-pdf-header-footer` tira o cabeçalho do navegador, que poria o caminho do arquivo em toda
página.

**Confira as páginas antes de mandar.** Cada ato foi acertado para caber numa página; uma linha
a mais num passo pode empurrar o aviso do fim para uma página sozinha. Nesta máquina o `Read` não
abre PDF: renderize com o pdf.js no navegador (folha de contato), como descrito na memória do
projeto.

## Regenerar as capturas

Foram tiradas pelo Chrome DevTools MCP, em **1440 × 900**, com o servidor de desenvolvimento no
ar. Antes de cada navegação roda o `sessao-de-captura.js` (como `initScript`, ou guardado no
`localStorage` e avaliado por um `initScript` curto). Ele:

- prende o relógio às **10:40** de hoje (`?hora=HH:MM` muda): Clínica e Hotel montam o dia pela
  hora da carga, e de madrugada as telas saem vazias;
- grava uma sessão local e liga Clínica e Hotel; `?sair=1` apaga a sessão (entrada e páginas
  públicas), `?idioma=ar` e `?tema=dark` trocam idioma e tema;
- responde a API do Portal com uma empresa de exemplo, a **Vila Madalena Pet** (aprovada,
  afiliado ativo, saldo, QR, quatro acessos). Rota sem resposta falha como rede: um 401
  deslogaria.

Antes de capturar, espere a tela sossegar (sem `.p-skeleton`, sem animação, ~800 ms sem
mutação) e esconda o botão do painel de demonstração (`.dev__gatilho`). O prontuário leva uns
segundos a mais para montar: espere o `h1` com o nome do pet, não só o silêncio do DOM. Ele rola
dentro de `main.palco__conteudo`, não na janela.

| Captura | Tela | Estado |
|---|---|---|
| `01-entrada`, `01-entrada-arabe` | `/auth/login?sair=1` | `&idioma=ar` na segunda |
| `02-inicio`, `03-inicio-escuro` | `/inicio` | `?tema=dark` na segunda |
| `10`–`12` | `/veterinario/meu-dia`, `/agenda`, `/pedidos` | — |
| `13-agendar-publico` | `/agendar/petjourney-vila-madalena?clinico=on&sair=1` | Vacina → Escolher dia e horário → Qualquer profissional |
| `14`–`16` | `/veterinario/atendimento/enc-apt-alergia?etapa=conduta` | topo; a prescrição (`scrollTop` 855); o bloco Receita |
| `23-clinica-finalizado` | a mesma | Finalizar atendimento → Finalizar mesmo assim; só o diálogo, sem foco no X |
| `17`–`20` | `/veterinario/internacao`, `/vacinas`, `/resumo`, `/paciente/importar` | no importador, "Usar este" na planilha da clínica |
| `21`, `22` | `/veterinario/paciente/pet-perola/resumo` e `/vacinas` | "Carteirinha no app" aberta (gaveta à direita) |
| `30`, `31`, `33` | `/hotel/painel`, `/rotina`, `/hospedagem/hosp-tofu` | — |
| `32-hotel-proposta` | `/hotel/rotina` | Tofu em "Gerenciar rotina"; só o painel, em janela de 1500 de altura |
| `34-hotel-mapa` | `/hotel/mapa` | janela de 1120 de altura |
| `35`, `37`, `39` | `/hotel/pedidos`, `/reserva/res-zeus`, `/resumo` | — |
| `36-reservar-publico` | `/reservar/petjourney-hotel?hotel=on&sair=1` | Cão médio → datas → Escolher a acomodação |
| `40`–`44` | `/parceiro/divulgacao`, `/programas`, `/acessos`, `/acessos/c1`, `/carteira` | no `c1`, serviço e anotação preenchidos |

As faixas (`faixa-capa.png`, `faixa-secao.png`) saem de qualquer tela com `UiPagina`, em
`deviceScaleFactor` 2: esconda o `.faixa__miolo` (`visibility: hidden`) e ponha a
`section.faixa` em `position: fixed; inset: 0; width: 100vw; height: 100vh; border-radius: 0`,
numa janela de 1050 × 750 (capa) ou 1200 × 340 (divisória). Os desenhos são os do
`UiRabiscos`, os mesmos do app; nada é desenhado à mão.

## Ao mudar uma tela

As capturas envelhecem em silêncio, e o texto do roteiro cita rótulos de botão. Mudou uma tela
de um percurso: refaça a captura dela, confira o ato no HTML e regenere o PDF. Mudou o que é
real (uma tela da Clínica ligou ao servidor, o cupom saiu do "em breve"): atualize as seções
"Perguntas" e "O que é real e o que é demonstração".
