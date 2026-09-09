# Relatório de novidades — módulo clínico

Documento para **quem decide e para quem apresenta**: o que mudou no fluxo clínico, por quê, o que
foi encontrado quebrado no caminho e o que recomendo a seguir. Oito páginas, A4.

São **dois documentos**, com públicos diferentes e a mesma linguagem visual — de propósito: eles
circulam juntos, e duas identidades para o mesmo assunto fazem quem recebe procurar a diferença
onde não há.

| Arquivo | Para quem | Para quê |
|---|---|---|
| `Novidades-Fluxo-Clinico.pdf` | Quem vai **abrir e testar** | O que há de novo em linguagem de produto, com roteiro de teste de dez minutos e a lista do que ainda não existe — 7 páginas |
| `Relatorio-Novidades-Modulo-Clinico.pdf` | Quem **constrói e revisa** | O detalhamento das mudanças, os defeitos encontrados e o backlog priorizado — 8 páginas |
| `*.html` | — | **As fontes.** Os PDFs são gerados a partir delas, nunca editados |

A divisão importa: o documento de novidades é o que se encaminha para aprovação antes de liberar
para teste, e a seção "o que ainda não existe" é a metade que protege quem for mostrar isto
adiante. O relatório é o registro técnico da rodada.

## Por que HTML, e não Word

O [roteiro de apresentação](../apresentacao/) é gerado por script para `.docx` porque o público
dele é quem apresenta ao cliente, e essa pessoa precisa poder editar a fala. Este relatório é
diferente: ele é um registro do que foi feito numa rodada, e registro se **revisa em diff**. Word
não se lê em diff; HTML se lê.

O ganho secundário é de controle: a paginação, as caixas de "antes → depois" e a tabela de
prioridades são decisões de layout que o CSS de impressão expressa diretamente.

## Regenerar o PDF

Não depende de nada instalado além do Edge, que já vem no Windows:

```powershell
$edge = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
$dir  = "<caminho>\docs\clinico\relatorio"

foreach ($nome in 'Novidades-Fluxo-Clinico', 'Relatorio-Novidades-Modulo-Clinico') {
  & $edge --headless --disable-gpu --no-pdf-header-footer `
    --print-to-pdf="$dir\$nome.pdf" `
    "file:///$($dir -replace '\\','/')/$nome.html"
}
```

`--no-pdf-header-footer` remove o cabeçalho automático do navegador — sem ele, cada página ganha o
caminho do arquivo no rodapé, que é a marca de documento improvisado.

## Conferir o layout antes de encaminhar

O navegador em janela cheia **não** mostra o que a impressão vai mostrar: as margens de `@page` só
valem na impressão. Para ver a caixa de verdade, dê ao `body` a largura útil — A4 menos as margens,
`180mm` — e tire uma captura:

```powershell
& $edge --headless --disable-gpu --window-size=700,1180 `
  --screenshot="$env:TEMP\relatorio.png" "file:///.../Relatorio-...html"
```

O que se procura na conferência: fileira de indicadores que não quebra em 3+1, tabela que não
estoura a largura, e nenhum título sozinho no pé de uma página.

Uma armadilha já encontrada, que vale conferir: `display: block` num seletor genérico como
`.passos strong` atinge **também** o destaque no meio de uma frase, e cada palavra em negrito vira
um parágrafo solto — "Vá à aba / Boletim / : a mensagem existe". Bloco só onde é linha própria.

## Ao mudar o fluxo clínico de novo

Este relatório é de **uma rodada** e não se atualiza: ele descreve o que mudou entre um estado e o
seguinte. A próxima rodada ganha o próprio arquivo, com a própria data. O que se mantém vivo são os
requisitos numerados em [`docs/clinico/`](../) — é lá que mora o estado atual.
