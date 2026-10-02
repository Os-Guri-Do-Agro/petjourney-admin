# Novidades de 16 a 30 de setembro de 2026

Apresentação para a **gestão e os sócios**: o que entrou no portal nessas duas semanas (Hotel,
Clínico, Portal), o que está em andamento, o que pede decisão e o que ainda não existe.

| Arquivo | Para quê |
|---|---|
| `Novidades-16-a-30-de-setembro.pdf` | O que se apresenta: 21 slides em 16:9 |
| `Novidades-16-a-30-de-setembro.html` | **A fonte.** O PDF é gerado dela, nunca editado |
| `telas/*.png` | Capturas do sistema rodando em 30/09, com dados de demonstração |

As capturas são do Hotel (painel, mapa, rotina, reservas, estadia) e da Visão geral. O nome
"Clínica Sálvia" e os ganhos de indicação na Visão geral são de demonstração: a sessão de captura
respondeu às três chamadas da API do parceiro com dados fictícios. Os slides do Clínico são só
texto.

## Regenerar o PDF

```powershell
$edge = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
$dir  = "<caminho>\docs\novidades\setembro-2026"

& $edge --headless=new --disable-gpu --no-pdf-header-footer `
  --print-to-pdf="$dir\Novidades-16-a-30-de-setembro.pdf" `
  "file:///$($dir -replace '\\','/')/Novidades-16-a-30-de-setembro.html"
```

## Conferir antes de encaminhar

Cada slide mede 1280 × 720. Para ver quatro de cada vez sem abrir o PDF, `?de=N` esconde os slides
anteriores ao N:

```powershell
& $edge --headless=new --disable-gpu --hide-scrollbars --window-size=1280,2880 `
  --screenshot="$env:TEMP\previa.png" "file:///.../Novidades-16-a-30-de-setembro.html?de=5"
```

O que se procura: texto encostando no rodapé, captura cortada, e slide com metade vazia.
