# Roteiro de apresentação — módulo clínico

Documento para **quem apresenta o produto a uma clínica**, não para quem o constrói. Dez
páginas, demonstração de doze minutos.

| Arquivo | Para quê |
|---|---|
| `Roteiro-Apresentacao-Modulo-Clinico.docx` | O que se entrega a quem vai apresentar — editável |
| `Roteiro-Apresentacao-Modulo-Clinico.pdf` | Para imprimir ou mandar por e-mail |
| `gerar-roteiro.mjs` | A fonte. **O Word é gerado, não editado à mão** |

## O que ele contém

Sete atos em ordem — a promessa, hoje na clínica, agenda, a falta que vira ligação, o
atendimento, a receita, vacinas, documentos —, cada um com o que fazer na tela, a fala sugerida
e o argumento comercial. Mais três seções que valem tanto quanto o roteiro: **perguntas que o
cliente costuma fazer**, **o que é real e o que é demonstração**, e **plano B**.

A seção de honestidade existe para proteger quem apresenta. O produto é protótipo navegável, sem
integração com servidor, e prometer o que não existe custa a próxima reunião.

## Regenerar

O script depende de `docx`, que **não é dependência do portal** — este documento não faz parte
do build. Instale fora do projeto:

```sh
mkdir -p /tmp/docgen && cd /tmp/docgen
npm init -y && npm install docx
node <caminho>/gerar-roteiro.mjs <caminho>/Roteiro-Apresentacao-Modulo-Clinico.docx
```

O PDF sai do próprio Word, no Windows:

```powershell
$w = New-Object -ComObject Word.Application; $w.Visible = $false
$d = $w.Documents.Open('<caminho>\Roteiro-Apresentacao-Modulo-Clinico.docx')
$d.SaveAs([ref]'<caminho>\Roteiro-Apresentacao-Modulo-Clinico.pdf', [ref]17)
$d.Close($false); $w.Quit()
```

## Ao mudar uma tela do fluxo clínico

Revise os **dois** documentos: este e o [05](../05-roteiro-de-demonstracao.md), que é o
levantamento técnico do mesmo percurso. Eles já divergiram uma vez — o 05 listava vacinação e
digitação por teclado como inexistentes depois de as duas terem sido construídas.
