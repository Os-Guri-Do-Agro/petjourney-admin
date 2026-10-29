#!/usr/bin/env node
// Confere se toda chamada HTTP do front existe no contrato da API.
// Copie para `scripts/conferir-rotas-no-contrato.mjs` no repo e rode no CI:
//
//   node scripts/conferir-rotas-no-contrato.mjs contrato/openapi.json src services app
//
// O contrato e o `contrato/openapi.json` do petjourney-api (gerado do codigo da
// API por `npm run openapi:exportar`). Copie o arquivo para o repo do front a
// cada release da API; e ele que diz o que existe em producao.
//
// Acha chamadas no formato `<cliente>.get|post|put|patch|delete('/rota', ...)`,
// com aspas ou crase. Trecho `${...}` vira parametro. Rota que nao bate com
// nenhum caminho do contrato (mesmo metodo) e reportada, e o script sai com 1.
// Rota montada de outro jeito (concatenacao, variavel) nao e vista: prefira a
// forma literal.
import fs from 'node:fs'
import path from 'node:path'

const [contratoPath, ...pastas] = process.argv.slice(2)
if (!contratoPath || pastas.length === 0) {
  console.error('uso: node scripts/conferir-rotas-no-contrato.mjs <contrato/openapi.json> <pasta> [pasta...]')
  process.exit(2)
}

const contrato = JSON.parse(fs.readFileSync(contratoPath, 'utf8'))
const caminhos = Object.entries(contrato.paths).map(([rota, ops]) => ({
  regex: new RegExp(`^${rota.replace(/[.*+?^$()|[\]\\]/g, '\\$&').replace(/\\?\{[^}]+\\?\}/g, '[^/]+')}$`),
  rota,
  metodos: new Set(Object.keys(ops)),
}))

// Estilo axios: `api.get('/rota')`, `api.post<T>(\`/rota/${id}\`)`.
const CHAMADA = /\.(get|post|put|patch|delete)\s*(?:<[^()]*>)?\(\s*(['"`])(\/[^'"`]*)\2/g
// Estilo fetch (portal `apiFetch`, CMS `fetchClient`): o metodo vem nas opcoes
// (`{ method: 'POST' }`), GET quando nao vem; o caminho pode nao ter barra.
const CHAMADA_FETCH = /\b(apiFetch|fetchClient)\s*(?:<[^()]*>)?\(\s*(['"`])(\/?[A-Za-z][^'"`]*)\2/g

/** Argumentos da chamada que comeca em `abre` (o `(`), ate o `)` que fecha ela. */
function argumentosDaChamada(texto, abre) {
  let profundidade = 0
  for (let i = abre; i < texto.length && i < abre + 2000; i++) {
    const c = texto[i]
    if (c === '(') profundidade++
    else if (c === ')' && --profundidade === 0) return texto.slice(abre + 1, i)
  }
  return texto.slice(abre + 1, abre + 400)
}

/** Metodo HTTP nas opcoes: literal (`method: 'POST'`) ou constante do arquivo (`postSemCorpo`). */
function metodoDasOpcoes(opcoes, texto) {
  const literal = /method:\s*['"`](GET|POST|PUT|PATCH|DELETE)['"`]/i.exec(opcoes)
  if (literal) return literal[1].toLowerCase()
  for (const [nome] of opcoes.matchAll(/\b[A-Za-z_$][\w$]*\b/g)) {
    const decl = new RegExp(`(?:const|let|var)\\s+${nome}\\b[^=]*=\\s*\\{[^}]*method:\\s*['"\`](GET|POST|PUT|PATCH|DELETE)['"\`]`, 'i').exec(texto)
    if (decl) return decl[1].toLowerCase()
  }
  return 'get'
}
const EXT = /\.(ts|tsx|js|jsx|vue|mjs)$/
const IGNORAR = /node_modules|\.next|dist|build|\.expo|coverage/

function arquivos(dir) {
  if (!fs.existsSync(dir) || IGNORAR.test(dir)) return []
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) return arquivos(p)
    return EXT.test(e.name) && !/\.(spec|test)\./.test(e.name) ? [p] : []
  })
}

/**
 * Troca cada `${...}` (com chaves aninhadas, como `${f({ a })}`) por `\u0000`.
 * Expressao sem fechamento (template aninhado que cortou a string) some.
 */
function marcarExpressoes(s) {
  let saida = ''
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '$' && s[i + 1] === '{') {
      let profundidade = 0
      let j = i + 1
      for (; j < s.length; j++) {
        if (s[j] === '{') profundidade++
        else if (s[j] === '}' && --profundidade === 0) break
      }
      if (j < s.length) saida += '\u0000'
      i = j
    } else saida += s[i]
  }
  return saida
}

// `${...}` grudado no fim de um segmento (`/home-bundle${query}`) e a query
// montada antes; `${...}` sozinho no segmento (`/pet/${id}`) e parametro.
function normalizar(bruta) {
  const caminho = marcarExpressoes(bruta.startsWith('/') ? bruta : `/${bruta}`)
  return (
    caminho
      .split('?')[0]
      .replace(/([^/\u0000])\u0000+/g, '$1')
      .replace(/\u0000+/g, 'X')
      .replace(/\/+$/, '') || '/'
  )
}

const desconhecidas = []
let total = 0
function conferir(arquivo, texto, indice, metodo, bruta) {
  if (bruta.includes('://')) return // URL absoluta (outro servico)
  total++
  const rota = normalizar(bruta)
  if (caminhos.some((c) => c.regex.test(rota) && c.metodos.has(metodo))) return
  const linha = texto.slice(0, indice).split('\n').length
  desconhecidas.push(`${arquivo}:${linha}  ${metodo.toUpperCase()} ${bruta}`)
}

for (const arquivo of pastas.flatMap(arquivos)) {
  const texto = fs.readFileSync(arquivo, 'utf8')
  for (const m of texto.matchAll(CHAMADA)) conferir(arquivo, texto, m.index, m[1], m[3])
  for (const m of texto.matchAll(CHAMADA_FETCH)) {
    // Opcoes so da MESMA chamada (ate o `)` que fecha ela), para nao pegar o
    // `method` da chamada seguinte.
    const abre = texto.indexOf('(', m.index + m[1].length)
    const args = argumentosDaChamada(texto, abre)
    const opcoes = args.slice(args.indexOf(m[3]) + m[3].length)
    conferir(arquivo, texto, m.index, metodoDasOpcoes(opcoes, texto), m[3])
  }
}

if (desconhecidas.length === 0) {
  console.log(`[contrato] ok: ${total} chamadas, todas no contrato.`)
  process.exit(0)
}
console.error(`[contrato] ${desconhecidas.length} de ${total} chamadas NAO existem no contrato da API:`)
for (const d of desconhecidas) console.error(`  - ${d}`)
console.error('Ou a rota ainda nao existe na API (combine com o backend antes), ou o caminho ou o metodo estao errados.')
process.exit(1)
