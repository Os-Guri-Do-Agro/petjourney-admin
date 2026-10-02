/**
 * Leitura de arquivo sem biblioteca: o xlsx é montado aqui mesmo, byte a byte, com as três
 * armadilhas do Excel que mudam conteúdo (data guardada como número, número longo em notação
 * científica, célula mesclada) — e o csv em Windows-1252, que é o que sistema antigo grava.
 */
import { describe, expect, it } from 'vitest'

import { FalhaNaLeitura, lerBytes } from '../leitura-de-planilha'

const codificar = (texto: string) => new TextEncoder().encode(texto)

async function deflate(dados: Uint8Array): Promise<Uint8Array> {
  const fluxo = new ReadableStream<Uint8Array>({
    start(controle) {
      controle.enqueue(dados)
      controle.close()
    },
  }).pipeThrough(
    new CompressionStream('deflate-raw') as unknown as TransformStream<Uint8Array, Uint8Array>,
  )

  const pedacos: Uint8Array[] = []
  const leitor = fluxo.getReader()

  for (;;) {
    const { done, value } = await leitor.read()

    if (done) {
      break
    }

    pedacos.push(value)
  }

  const saida = new Uint8Array(pedacos.reduce((total, pedaco) => total + pedaco.length, 0))
  let posicao = 0

  for (const pedaco of pedacos) {
    saida.set(pedaco, posicao)
    posicao += pedaco.length
  }

  return saida
}

/** Zip mínimo: cabeçalho local, diretório central e registro final. O leitor não confere CRC. */
async function zip(arquivos: Record<string, string>, comprimir: boolean): Promise<Uint8Array> {
  const partes: Uint8Array[] = []
  const diretorio: Uint8Array[] = []
  let deslocamento = 0

  for (const [nome, conteudo] of Object.entries(arquivos)) {
    const nomeEmBytes = codificar(nome)
    const cru = codificar(conteudo)
    const dados = comprimir ? await deflate(cru) : cru
    const metodo = comprimir ? 8 : 0

    const local = new DataView(new ArrayBuffer(30))
    local.setUint32(0, 0x04034b50, true)
    local.setUint16(8, metodo, true)
    local.setUint32(18, dados.length, true)
    local.setUint32(22, cru.length, true)
    local.setUint16(26, nomeEmBytes.length, true)

    const central = new DataView(new ArrayBuffer(46))
    central.setUint32(0, 0x02014b50, true)
    central.setUint16(10, metodo, true)
    central.setUint32(20, dados.length, true)
    central.setUint32(24, cru.length, true)
    central.setUint16(28, nomeEmBytes.length, true)
    central.setUint32(42, deslocamento, true)

    partes.push(new Uint8Array(local.buffer), nomeEmBytes, dados)
    diretorio.push(new Uint8Array(central.buffer), nomeEmBytes)
    deslocamento += 30 + nomeEmBytes.length + dados.length
  }

  const tamanhoDoDiretorio = diretorio.reduce((total, parte) => total + parte.length, 0)
  const fim = new DataView(new ArrayBuffer(22))
  fim.setUint32(0, 0x06054b50, true)
  fim.setUint16(8, Object.keys(arquivos).length, true)
  fim.setUint16(10, Object.keys(arquivos).length, true)
  fim.setUint32(12, tamanhoDoDiretorio, true)
  fim.setUint32(16, deslocamento, true)

  const todas = [...partes, ...diretorio, new Uint8Array(fim.buffer)]
  const saida = new Uint8Array(todas.reduce((total, parte) => total + parte.length, 0))
  let posicao = 0

  for (const parte of todas) {
    saida.set(parte, posicao)
    posicao += parte.length
  }

  return saida
}

const PLANILHA_XLSX = {
  'xl/workbook.xml': `<?xml version="1.0" encoding="UTF-8"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets><sheet name="Clientes" sheetId="1" r:id="rId1"/></sheets>
</workbook>`,
  'xl/_rels/workbook.xml.rels': `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
</Relationships>`,
  'xl/sharedStrings.xml': `<?xml version="1.0" encoding="UTF-8"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <si><t>Cliente</t></si><si><t>Animal</t></si><si><t>Nasc.</t></si><si><t>Chip</t></si>
  <si><r><t>João </t></r><r><t>Lima</t></r></si><si><t>Rex</t></si><si><t>Mia</t></si>
</sst>`,
  'xl/styles.xml': `<?xml version="1.0" encoding="UTF-8"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <numFmts count="1"><numFmt numFmtId="164" formatCode="dd/mm/yyyy;@"/></numFmts>
  <cellXfs count="3"><xf numFmtId="0"/><xf numFmtId="14"/><xf numFmtId="164"/></cellXfs>
</styleSheet>`,
  'xl/worksheets/sheet1.xml': `<?xml version="1.0" encoding="UTF-8"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>
    <row r="1"><c r="A1" t="inlineStr"><is><t>CADASTRO DE CLIENTES</t></is></c></row>
    <row r="3"><c r="A3" t="s"><v>0</v></c><c r="B3" t="s"><v>1</v></c><c r="C3" t="s"><v>2</v></c><c r="D3" t="s"><v>3</v></c></row>
    <row r="4"><c r="A4" t="s"><v>4</v></c><c r="B4" t="s"><v>5</v></c><c r="C4" s="1"><v>43891</v></c><c r="D4"><v>9.82000123456789E+14</v></c></row>
    <row r="5"><c r="B5" t="s"><v>6</v></c><c r="C5" s="2"><v>44197</v></c><c r="D5"><v>4.5000000000000009</v></c></row>
  </sheetData>
  <mergeCells count="1"><mergeCell ref="A4:A5"/></mergeCells>
</worksheet>`,
}

describe('leitura de xlsx', () => {
  for (const comprimir of [false, true]) {
    it(`lê o Excel ${comprimir ? 'comprimido' : 'sem compressão'}: título, data, número longo e mescla`, async () => {
      const planilha = await lerBytes(await zip(PLANILHA_XLSX, comprimir), 'clientes.xlsx')

      expect(planilha.formato).toBe('xlsx')
      expect(planilha.linhaDoCabecalho).toBe(3)
      expect(planilha.cabecalhos).toEqual(['Cliente', 'Animal', 'Nasc.', 'Chip'])
      expect(planilha.linhas).toEqual([
        ['João Lima', 'Rex', '2020-03-01', '982000123456789'],
        ['João Lima', 'Mia', '2021-01-01', '4.5'],
      ])
      /* A2 da grade virou a linha de dado 1, coluna 0 — é a célula que a mescla preencheu. */
      expect([...planilha.mescladas]).toEqual(['1:0'])
    })
  }

  it('zip quebrado é dito como quebrado', async () => {
    await expect(lerBytes(codificar('PK nada disso'), 'x.xlsx')).rejects.toMatchObject({
      kind: 'corrompido',
    })
  })
})

describe('leitura de csv e o que não é lido', () => {
  it('Windows-1252: "João" chega como João, e a planilha diz a codificação', async () => {
    /* "Nome;Animal\nJoão;Rex" em cp1252: o ã é um byte só, 0xE3. */
    const bytes = new Uint8Array([...codificar('Nome;Animal\nJo'), 0xe3, ...codificar('o;Rex\n')])
    const planilha = await lerBytes(bytes, 'clientes.csv')

    expect(planilha.codificacao).toBe('windows-1252')
    expect(planilha.linhas).toEqual([['João', 'Rex']])
  })

  it('xls antigo pede para salvar de novo; arquivo vazio e sem linhas não passam', async () => {
    await expect(
      lerBytes(new Uint8Array([0xd0, 0xcf, 0x11, 0xe0]), 'base.xls'),
    ).rejects.toBeInstanceOf(FalhaNaLeitura)
    await expect(
      lerBytes(new Uint8Array([0xd0, 0xcf, 0x11, 0xe0]), 'base.xls'),
    ).rejects.toMatchObject({
      kind: 'xls-antigo',
    })
    await expect(lerBytes(new Uint8Array(), 'x.csv')).rejects.toMatchObject({ kind: 'vazio' })
    await expect(lerBytes(codificar('Nome;Animal\n'), 'x.csv')).rejects.toMatchObject({
      kind: 'sem-linhas',
    })
    await expect(lerBytes(codificar('oi'), 'foto.png')).rejects.toMatchObject({
      kind: 'formato-desconhecido',
    })
  })
})
