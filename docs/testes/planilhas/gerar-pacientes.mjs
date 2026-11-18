/**
 * Planilha de teste da importação de pacientes (Clínica › Pacientes › Trazer pacientes de outro
 * sistema): 100 animais de 67 responsáveis, no formato do export do SimplesVet, que a tela
 * reconhece sozinha. Gerada com semente fixa: rodar de novo dá o mesmo arquivo.
 *
 *   node docs/testes/planilhas/gerar-pacientes.mjs
 *
 * O xlsx é montado aqui mesmo (zip + XML), sem biblioteca: o portal também lê sem biblioteca.
 * Os dados são inventados. CPF com dígito verificador certo, e-mail em @petjourney.test (domínio
 * de teste: nenhum convite chega a alguém de verdade), telefone e CEP só no formato.
 *
 * O que a planilha tem de propósito, para a tela mostrar cada caso:
 * - responsáveis com dois e três animais (as linhas se juntam no mesmo cadastro);
 * - espécies além de cão e gato: ave, roedor, réptil e coelho (o coelho entra como palpite, e a
 *   tela pergunta);
 * - um responsável só com telefone fixo, sem celular nem e-mail;
 * - dois animais sem data de nascimento e dois com "Inativo - Óbito".
 */
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { crc32, deflateRawSync } from 'node:zlib'

const aqui = dirname(fileURLToPath(import.meta.url))
const SAIDA = join(aqui, 'pacientes-100.xlsx')

/* ----------------------------------------------------------------------------- sorteio */

function semente(a) {
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const sorte = semente(20261118)
const entre = (min, max) => min + Math.floor(sorte() * (max - min + 1))
const um = (lista) => lista[Math.floor(sorte() * lista.length)]
const dois = (n) => String(n).padStart(2, '0')

/* ------------------------------------------------------------------------------ nomes */

const NOMES_F = ['Ana', 'Beatriz', 'Camila', 'Daniela', 'Eduarda', 'Fernanda', 'Gabriela', 'Helena', 'Isabela', 'Júlia', 'Larissa', 'Mariana', 'Natália', 'Patrícia', 'Renata', 'Sofia', 'Tatiane', 'Vanessa', 'Aline', 'Bruna', 'Carolina', 'Débora', 'Elaine', 'Flávia', 'Giovana', 'Lívia', 'Marta', 'Priscila', 'Raquel', 'Simone']
const NOMES_M = ['André', 'Bruno', 'Carlos', 'Diego', 'Eduardo', 'Fábio', 'Gustavo', 'Henrique', 'Igor', 'João', 'Leonardo', 'Marcelo', 'Nicolas', 'Otávio', 'Paulo', 'Rafael', 'Sérgio', 'Thiago', 'Vinícius', 'Wagner', 'Alexandre', 'Caio', 'Felipe', 'Lucas', 'Mateus', 'Rodrigo']
const SOBRENOMES = ['Almeida', 'Barbosa', 'Cardoso', 'Costa', 'Dias', 'Fernandes', 'Ferreira', 'Gomes', 'Lima', 'Lopes', 'Martins', 'Melo', 'Moreira', 'Nogueira', 'Oliveira', 'Pereira', 'Ribeiro', 'Rocha', 'Santos', 'Silva', 'Souza', 'Teixeira', 'Vieira', 'Azevedo', 'Batista', 'Campos', 'Freitas', 'Moura', 'Pinto', 'Ramos']

const PETS = ['Thor', 'Luna', 'Mel', 'Bob', 'Nina', 'Fred', 'Mia', 'Max', 'Belinha', 'Toby', 'Lola', 'Simba', 'Amora', 'Pipoca', 'Zeca', 'Pandora', 'Bidu', 'Kiara', 'Pingo', 'Jade', 'Rex', 'Lili', 'Theo', 'Maya', 'Pretinha', 'Chico', 'Frida', 'Ozzy', 'Cacau', 'Duque', 'Estrela', 'Fumaça', 'Gaia', 'Hulk', 'Iris', 'Jujuba', 'Kiko', 'Leona', 'Marley', 'Nescau', 'Olívia', 'Paçoca', 'Quindim', 'Romeu', 'Sushi', 'Tequila', 'Ursula', 'Vito', 'Wally', 'Xodó', 'Yoda', 'Zara', 'Bento', 'Canela', 'Dora', 'Elvis', 'Flor', 'Guga', 'Hana', 'Jack', 'Laika', 'Mike', 'Nala', 'Oreo', 'Pérola', 'Ruby', 'Sansão', 'Tieta', 'Batata', 'Biscoito', 'Brigadeiro', 'Coragem', 'Docinho', 'Faísca', 'Gordo', 'Juca', 'Lupi', 'Meg', 'Neguinho', 'Peteca']

const CIDADES = [
  { cidade: 'São Paulo', uf: 'SP', ddd: '11', cep: '04', bairros: ['Vila Mariana', 'Moema', 'Pinheiros', 'Tatuapé', 'Santana', 'Butantã'] },
  { cidade: 'Campo Grande', uf: 'MS', ddd: '67', cep: '79', bairros: ['Centro', 'Tiradentes', 'Coronel Antonino', 'Aero Rancho', 'Monte Castelo'] },
  { cidade: 'Campinas', uf: 'SP', ddd: '19', cep: '13', bairros: ['Cambuí', 'Taquaral', 'Barão Geraldo', 'Guanabara'] },
  { cidade: 'Curitiba', uf: 'PR', ddd: '41', cep: '80', bairros: ['Batel', 'Água Verde', 'Bigorrilho', 'Portão'] },
]
const RUAS = ['Rua das Acácias', 'Rua dos Ipês', 'Avenida Brasil', 'Rua Sete de Setembro', 'Rua da Paz', 'Alameda Santos', 'Rua Bahia', 'Rua Goiás', 'Avenida Afonso Pena', 'Rua XV de Novembro', 'Rua Marechal Deodoro', 'Rua do Comércio']

/* ----------------------------------------------------------------------------- espécies */

const ESPECIES = [
  { especie: 'Canina', peso: [3, 38], racas: ['SRD', 'SRD', 'SRD', 'Shih Tzu', 'Poodle', 'Labrador', 'Golden Retriever', 'Yorkshire', 'Spitz Alemão', 'Bulldog Francês', 'Beagle', 'Border Collie', 'Lhasa Apso', 'Pinscher', 'Dachshund'], pelagens: ['Caramelo', 'Preto', 'Branco', 'Marrom', 'Preto e branco', 'Tricolor', 'Dourado'] },
  { especie: 'Felina', peso: [2.5, 7], racas: ['SRD', 'SRD', 'SRD', 'Siamês', 'Persa', 'Maine Coon', 'Angorá', 'Ragdoll', 'Bengal'], pelagens: ['Tigrado', 'Preto', 'Branco', 'Cinza', 'Laranja', 'Frajola', 'Escaminha'] },
  { especie: 'Ave', peso: [0.03, 0.45], racas: ['Calopsita', 'Periquito-australiano', 'Agapornis', 'Papagaio-verdadeiro'], pelagens: [''] },
  { especie: 'Roedor', peso: [0.08, 1.1], racas: ['Hamster sírio', 'Porquinho-da-índia', 'Chinchila', 'Twister'], pelagens: [''] },
  { especie: 'Coelho', peso: [1.2, 3.5], racas: ['Mini Lop', 'Fuzzy Lop', 'SRD'], pelagens: ['Branco', 'Cinza', 'Malhado'] },
  { especie: 'Réptil', peso: [0.6, 5.5], racas: ['Jabuti-piranga', 'Iguana-verde', 'Gecko-leopardo'], pelagens: [''] },
]
/* 100 animais: 58 cães, 29 gatos, 5 aves, 4 roedores, 2 coelhos, 2 répteis. */
const SORTEIO_DE_ESPECIE = [
  ...Array(58).fill(0),
  ...Array(29).fill(1),
  ...Array(5).fill(2),
  ...Array(4).fill(3),
  ...Array(2).fill(4),
  ...Array(2).fill(5),
]
for (let i = SORTEIO_DE_ESPECIE.length - 1; i > 0; i--) {
  const j = Math.floor(sorte() * (i + 1))
  ;[SORTEIO_DE_ESPECIE[i], SORTEIO_DE_ESPECIE[j]] = [SORTEIO_DE_ESPECIE[j], SORTEIO_DE_ESPECIE[i]]
}

const ALERGIAS = ['Dipirona', 'Frango (alimentar)', 'Picada de pulga', 'Amoxicilina', 'Corante alimentar']

/* -------------------------------------------------------------------------- documentos */

function cpf() {
  let base
  do {
    base = Array.from({ length: 9 }, () => entre(0, 9))
  } while (base.every((d) => d === base[0]))
  const dv = (digitos) => {
    const soma = digitos.reduce((total, d, i) => total + d * (digitos.length + 1 - i), 0)
    const resto = (soma * 10) % 11
    return resto === 10 ? 0 : resto
  }
  const d1 = dv(base)
  const d2 = dv([...base, d1])
  const n = [...base, d1, d2].join('')
  return `${n.slice(0, 3)}.${n.slice(3, 6)}.${n.slice(6, 9)}-${n.slice(9)}`
}

const semAcento = (texto) =>
  texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()

/* ----------------------------------------------------------------------------- linhas */

const CABECALHO = [
  'Código', 'Cliente', 'CPF/CNPJ', 'Celular', 'Telefone', 'E-mail', 'CEP', 'Endereço', 'Número',
  'Bairro', 'Cidade', 'UF', 'Animal', 'Espécie', 'Raça', 'Sexo', 'Castrado',
  'Data de nascimento', 'Peso (kg)', 'Pelagem', 'Microchip', 'Alergias', 'Situação',
]

/* 67 responsáveis: 40 com um animal, 21 com dois, 6 com três = 100 animais. */
const QUANTOS = [...Array(40).fill(1), ...Array(21).fill(2), ...Array(6).fill(3)]
for (let i = QUANTOS.length - 1; i > 0; i--) {
  const j = Math.floor(sorte() * (i + 1))
  ;[QUANTOS[i], QUANTOS[j]] = [QUANTOS[j], QUANTOS[i]]
}

const linhas = [CABECALHO]
const emailsUsados = new Set()
let animal = 0

QUANTOS.forEach((quantos, indice) => {
  const feminino = sorte() < 0.55
  const primeiro = um(feminino ? NOMES_F : NOMES_M)
  const sobrenome = `${um(SOBRENOMES)} ${um(SOBRENOMES)}`
  const nome = `${primeiro} ${sobrenome}`
  const lugar = um(CIDADES)
  const soFixo = indice === 23
  let email = `${semAcento(primeiro)}.${semAcento(sobrenome.split(' ')[1])}@petjourney.test`
  while (emailsUsados.has(email)) email = email.replace('@', `${entre(1, 99)}@`)
  emailsUsados.add(email)
  const cliente = {
    codigo: 1001 + indice,
    nome,
    cpf: cpf(),
    celular: soFixo ? '' : `(${lugar.ddd}) 9${entre(6000, 9999)}-${String(entre(0, 9999)).padStart(4, '0')}`,
    fixo: soFixo || sorte() < 0.15 ? `(${lugar.ddd}) 3${entre(100, 999)}-${String(entre(0, 9999)).padStart(4, '0')}` : '',
    email: soFixo ? '' : email,
    cep: `${lugar.cep}${entre(100, 999)}-${String(entre(0, 999)).padStart(3, '0')}`,
    endereco: um(RUAS),
    numero: String(entre(12, 2400)),
    bairro: um(lugar.bairros),
    cidade: lugar.cidade,
    uf: lugar.uf,
  }

  const nomesDoTutor = new Set()
  for (let k = 0; k < quantos; k++) {
    const tipo = ESPECIES[SORTEIO_DE_ESPECIE[animal]]
    let pet = um(PETS)
    while (nomesDoTutor.has(pet)) pet = um(PETS)
    nomesDoTutor.add(pet)
    const peso = tipo.peso[0] + sorte() * (tipo.peso[1] - tipo.peso[0])
    const casas = peso < 1 ? 3 : peso < 10 ? 1 : 0
    const ehCaoOuGato = tipo.especie === 'Canina' || tipo.especie === 'Felina'
    const semNascimento = animal === 17 || animal === 64
    const obito = animal === 41 || animal === 88
    linhas.push([
      cliente.codigo,
      cliente.nome,
      cliente.cpf,
      cliente.celular,
      cliente.fixo,
      cliente.email,
      cliente.cep,
      cliente.endereco,
      cliente.numero,
      cliente.bairro,
      cliente.cidade,
      cliente.uf,
      pet,
      tipo.especie,
      um(tipo.racas),
      sorte() < 0.5 ? 'Macho' : 'Fêmea',
      ehCaoOuGato ? (sorte() < 0.6 ? 'Sim' : 'Não') : 'Não',
      semNascimento ? '' : `${dois(entre(1, 28))}/${dois(entre(1, 12))}/${entre(2010, 2025)}`,
      Number(peso.toFixed(casas)),
      um(tipo.pelagens),
      ehCaoOuGato && sorte() < 0.3 ? `9820${String(entre(0, 99999999)).padStart(8, '0')}${entre(100, 999)}` : '',
      sorte() < 0.08 ? um(ALERGIAS) : '',
      obito ? 'Inativo - Óbito' : 'Ativo',
    ])
    animal += 1
  }
})

/* ------------------------------------------------------------------------------- xlsx */

const escapar = (texto) =>
  String(texto).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

function coluna(i) {
  let nome = ''
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) nome = String.fromCharCode(65 + ((n - 1) % 26)) + nome
  return nome
}

const textos = []
const indiceDoTexto = new Map()
function texto(valor) {
  if (!indiceDoTexto.has(valor)) {
    indiceDoTexto.set(valor, textos.length)
    textos.push(valor)
  }
  return indiceDoTexto.get(valor)
}

const ultima = coluna(CABECALHO.length - 1)
const LARGURAS = [8, 26, 16, 17, 16, 32, 11, 24, 8, 18, 15, 5, 12, 10, 22, 8, 9, 18, 10, 14, 18, 18, 15]

const linhasXml = linhas
  .map((linha, l) => {
    const celulas = linha
      .map((valor, c) => {
        const ref = `${coluna(c)}${l + 1}`
        if (valor === '' || valor === null || valor === undefined) return ''
        const estilo = l === 0 ? 1 : typeof valor === 'number' ? 0 : 2
        if (typeof valor === 'number') return `<c r="${ref}" s="${estilo}"><v>${valor}</v></c>`
        return `<c r="${ref}" s="${estilo}" t="s"><v>${texto(String(valor))}</v></c>`
      })
      .join('')
    return `<row r="${l + 1}">${celulas}</row>`
  })
  .join('')

const cabecaXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
const arquivos = {
  '[Content_Types].xml': `${cabecaXml}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`,
  '_rels/.rels': `${cabecaXml}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`,
  'docProps/core.xml': `${cabecaXml}<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>Pacientes para testar a importação</dc:title><dc:creator>PetJourney</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">2026-11-18T12:00:00Z</dcterms:created></cp:coreProperties>`,
  'docProps/app.xml': `${cabecaXml}<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Microsoft Excel</Application></Properties>`,
  'xl/workbook.xml': `${cabecaXml}<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView/></bookViews><sheets><sheet name="Pacientes" sheetId="1" r:id="rId1"/></sheets><definedNames><definedName name="_xlnm._FilterDatabase" localSheetId="0" hidden="1">Pacientes!$A$1:$${ultima}$${linhas.length}</definedName></definedNames></workbook>`,
  'xl/_rels/workbook.xml.rels': `${cabecaXml}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/></Relationships>`,
  'xl/styles.xml': `${cabecaXml}<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="10"/><name val="Arial"/><family val="2"/></font><font><b/><sz val="10"/><name val="Arial"/><family val="2"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFDFE8E5"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/><xf numFmtId="49" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`,
  'xl/worksheets/sheet1.xml': `${cabecaXml}<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><dimension ref="A1:${ultima}${linhas.length}"/><sheetViews><sheetView tabSelected="1" workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A2" sqref="A2"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="13.2"/><cols>${LARGURAS.map((largura, i) => `<col min="${i + 1}" max="${i + 1}" width="${largura}" customWidth="1"/>`).join('')}</cols><sheetData>${linhasXml}</sheetData><autoFilter ref="A1:${ultima}${linhas.length}"/></worksheet>`,
}
arquivos['xl/sharedStrings.xml'] = `${cabecaXml}<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${textos.length}" uniqueCount="${textos.length}">${textos.map((t) => `<si><t xml:space="preserve">${escapar(t)}</t></si>`).join('')}</sst>`

/* --------------------------------------------------------------------------------- zip */

function zip(entradas) {
  const locais = []
  const centrais = []
  let deslocamento = 0
  for (const [nome, conteudo] of Object.entries(entradas)) {
    const nomeBytes = Buffer.from(nome, 'utf8')
    const dados = Buffer.from(conteudo, 'utf8')
    const comprimido = deflateRawSync(dados)
    const crc = crc32(dados)
    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4)
    local.writeUInt16LE(0x0800, 6)
    local.writeUInt16LE(8, 8)
    local.writeUInt16LE(0, 10)
    local.writeUInt16LE(0x5b72, 12)
    local.writeUInt32LE(crc, 14)
    local.writeUInt32LE(comprimido.length, 18)
    local.writeUInt32LE(dados.length, 22)
    local.writeUInt16LE(nomeBytes.length, 26)
    local.writeUInt16LE(0, 28)
    locais.push(local, nomeBytes, comprimido)

    const central = Buffer.alloc(46)
    central.writeUInt32LE(0x02014b50, 0)
    central.writeUInt16LE(20, 4)
    central.writeUInt16LE(20, 6)
    central.writeUInt16LE(0x0800, 8)
    central.writeUInt16LE(8, 10)
    central.writeUInt16LE(0, 12)
    central.writeUInt16LE(0x5b72, 14)
    central.writeUInt32LE(crc, 16)
    central.writeUInt32LE(comprimido.length, 20)
    central.writeUInt32LE(dados.length, 24)
    central.writeUInt16LE(nomeBytes.length, 28)
    central.writeUInt32LE(deslocamento, 42)
    centrais.push(central, nomeBytes)
    deslocamento += local.length + nomeBytes.length + comprimido.length
  }
  const diretorio = Buffer.concat(centrais)
  const fim = Buffer.alloc(22)
  fim.writeUInt32LE(0x06054b50, 0)
  fim.writeUInt16LE(Object.keys(entradas).length, 8)
  fim.writeUInt16LE(Object.keys(entradas).length, 10)
  fim.writeUInt32LE(diretorio.length, 12)
  fim.writeUInt32LE(deslocamento, 16)
  return Buffer.concat([...locais, diretorio, fim])
}

writeFileSync(SAIDA, zip(arquivos))
const responsaveis = new Set(linhas.slice(1).map((linha) => linha[2])).size
const porEspecie = {}
for (const linha of linhas.slice(1)) porEspecie[linha[13]] = (porEspecie[linha[13]] ?? 0) + 1
console.log(`${SAIDA}: ${linhas.length - 1} animais, ${responsaveis} responsáveis`, porEspecie)
