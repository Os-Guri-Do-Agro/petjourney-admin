# Passeio pelo hotel — o documento visual

Para **quem nunca viu um sistema de hospedagem**. Conta o que acontece num hotel ao longo de uma
semana e mostra, em cada momento, a tela que responde — com capturas do sistema rodando de
verdade, não maquetes.

| Arquivo | Para quem | Para quê |
|---|---|---|
| `Passeio-Pelo-Hotel.pdf` | Quem vai **decidir ou testar** | 9 telas, o fluxo em quatro momentos e o que ainda não existe |
| `Passeio-Pelo-Hotel.html` | — | **A fonte.** O PDF é gerado dela, nunca editado |
| `telas/*.png` | — | Capturas do sistema em execução, geradas por script |

## Por que existe

A primeira entrega deste módulo foi recusada, e a frase foi esta: *"olhei as telas e não entendi
nada, parece que você só joga informação sem sentido, além de várias telas parecerem a mesma coisa
visualmente."*

As duas críticas estavam certas e são de desenho, não de entendimento de quem leu. As telas foram
refeitas — cada uma com forma própria e com a pergunta que responde escrita nela — e este
documento existe para que ninguém mais precise ler código para saber o que o módulo faz.

A régua que ele obedece: **em nenhum momento aparece um termo de sistema sem que a frase anterior
já tenha dito o que acontece no mundo real.** Primeiro "toca o telefone e alguém pergunta se tem
vaga", depois a tela que responde. Nunca o contrário.

## Regenerar as capturas

Elas saem do sistema rodando, então precisam do servidor de desenvolvimento de pé:

```bash
npm run dev            # numa aba; anote a porta que ele imprime
node docs/hotel/apresentacao/capturar.mjs 5173
```

O script escreve uma página temporária em `public/`, que semeia a sessão no navegador e liga o
interruptor do módulo, captura as nove telas com o Edge em modo headless, e **apaga a página no
fim** — inclusive se a captura falhar no meio.

Sobre a sessão semeada: as telas do hotel rodam inteiras sobre a camada mocada e não chamam API
nenhuma, mas a casca do portal exige sessão para montar. O token é gerado pelo próprio script,
não vale em servidor nenhum, e a API de desenvolvimento é apontada para um endereço morto durante
a captura. Sem isso, o token levaria 401 na primeira chamada do portal, o interceptador limparia a
sessão, e o menu desapareceria no meio das imagens.

### Capture em horário de expediente

O dataset é ancorado no **relógio de verdade**, e três telas mostram o que está acontecendo agora:
a rotina do turno separa "para agora" do resto, o painel marca o instante na linha do dia, e a
estadia mostra a prancheta de hoje.

Capturado de madrugada, o passeio fica honesto e inútil ao mesmo tempo: a rotina abre em *"nada
pendente neste momento"* e a prancheta aparece inteira por fazer, porque de fato ainda é. Capture
entre as 9h e as 17h — é quando essas telas mostram para que servem.

### Enquadramento

A altura da janela de cada tela é escolhida à mão em `capturar.mjs`, e errar para mais é silencioso:
sobra uma faixa vazia embaixo, que no PDF parece erro de diagramação. Errar para menos corta o
conteúdo. Depois de regerar, **abra as imagens** — a conferência é visual, porque o que se procura
("a última seção fechou?") é uma pergunta de leitura, não de pixel.

## Regenerar o PDF

Não depende de nada instalado além do Edge, que já vem no Windows:

```powershell
$edge = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
$dir  = "<caminho>\docs\hotel\apresentacao"

& $edge --headless=new --disable-gpu --no-pdf-header-footer `
  --print-to-pdf="$dir\Passeio-Pelo-Hotel.pdf" `
  "file:///$($dir -replace '\\','/')/Passeio-Pelo-Hotel.html"
```

`--no-pdf-header-footer` remove o cabeçalho automático do navegador — sem ele, cada página ganha o
caminho do arquivo no rodapé, que é a marca de documento improvisado.

## Conferir o layout antes de encaminhar

O navegador em janela cheia **não** mostra o que a impressão vai mostrar: as margens de `@page` só
valem na impressão. Para ver a caixa de verdade, dê ao `body` a largura útil — A4 menos as
margens, `180mm`, que é o que o CSS já faz — e tire uma captura estreita:

```powershell
& $edge --headless=new --disable-gpu --window-size=700,1180 `
  --screenshot="$env:TEMP\previa.png" "file:///.../Passeio-Pelo-Hotel.html"
```

O que se procura: imagem cortada ao meio entre páginas, título sozinho no pé de uma página, e a
fileira dos quatro momentos quebrando em 3+1.

## Ao mudar uma tela

As capturas envelhecem em silêncio: um botão que muda de lugar não quebra teste nenhum e deixa o
documento mentindo. Depois de mexer em qualquer tela do hotel, rode o `capturar.mjs` de novo e
regere o PDF. São dois comandos.
