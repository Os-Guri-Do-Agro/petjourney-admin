#!/usr/bin/env node
// Lint de copy para os fronts do PetJourney (app, portal, site). Copie para
// `scripts/lint-copy.mjs` no repo e rode no CI:
//
//   node scripts/lint-copy.mjs src/locales      # app e portal
//   node scripts/lint-copy.mjs messages         # site (next-intl)
//
// Regras do Nicolas, iguais as da API (petjourney-api/scripts/lint-copy.ts):
//   1. travessao longo (U+2014) proibido em qualquer idioma;
//   2. "tutor" proibido em portugues (use "responsável").
// So os VALORES contam: chave de JSON pode ter "tutor" (ex.: "tutor.home").
// Sai com 1 se houver violacao. Sem dependencia.
import fs from 'node:fs'
import path from 'node:path'

const pasta = process.argv[2]
if (!pasta || !fs.existsSync(pasta)) {
  console.error('uso: node scripts/lint-copy.mjs <pasta com os JSON de idioma>')
  process.exit(2)
}

// Escapado de proposito: o caractere literal aqui faria este arquivo aparecer em
// qualquer busca por travessao no repo.
const TRAVESSAO = String.fromCharCode(0x2014)
const TUTOR = /\btutor(es|a|as)?\b/i
const violacoes = []

function percorrer(valor, chave, arquivo, ehPt) {
  if (typeof valor === 'string') {
    if (valor.includes(TRAVESSAO)) violacoes.push(`${arquivo} ${chave}: travessão -> ${valor.slice(0, 100)}`)
    // `{tutor}` e variavel de interpolacao (vue-i18n, next-intl), nao texto na tela.
    const visivel = valor.replace(/\{[^{}]*\}/g, '')
    if (ehPt && TUTOR.test(visivel)) violacoes.push(`${arquivo} ${chave}: "tutor" em pt -> ${valor.slice(0, 100)}`)
    return
  }
  if (valor && typeof valor === 'object') {
    for (const [k, v] of Object.entries(valor)) percorrer(v, chave ? `${chave}.${k}` : k, arquivo, ehPt)
  }
}

for (const nome of fs.readdirSync(pasta).filter((f) => f.endsWith('.json'))) {
  const ehPt = /^pt([-_]|\.|$)/i.test(nome)
  const conteudo = JSON.parse(fs.readFileSync(path.join(pasta, nome), 'utf8'))
  percorrer(conteudo, '', nome, ehPt)
}

if (violacoes.length === 0) {
  console.log('[lint:copy] ok')
  process.exit(0)
}
console.error(`[lint:copy] ${violacoes.length} violação(ões):`)
for (const v of violacoes) console.error(`  - ${v}`)
console.error('Troque o travessão por ponto, vírgula ou dois-pontos, e "tutor" por "responsável".')
process.exit(1)
