import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { baseCompile } from '@intlify/message-compiler'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dir = path.join(__dirname, '..', 'src', 'locales')
const base = 'pt'
const locales = ['en', 'en-GB', 'es', 'sr', 'ar']

const { expectedPluralForms } = await import(
  pathToFileURL(path.join(__dirname, '..', 'src', 'i18n', 'plural.ts')).href
)

/**
 * Chaves sem plural na origem que têm plural em sr/ar: a concordância com o número muda nesses
 * idiomas. Toda chamada `t()` delas passa o número como 3º argumento (inofensivo em pt/en/es).
 * Ao acrescentar uma chave aqui, confira as chamadas.
 */
const PLURAL_ONLY_IN_SR_AR = new Set([
  'inicio.shortcuts.countAvailable',
  'acessos.list.anotacoes',
  'acessos.list.documentos',
  'acessos.snapshot.sectionsCount',
  'acessos.snapshot.itemsCount',
  'acessos.tratamentos.count',
  'acessos.documentos.count',
  'acessos.diario.count',
  'acessos.diario.fotos',
  'acessos.anotacoes.count',
  'acessos.anotacao.maxAnexos',
  'divulgacao.cupons.usos',
  'divulgacao.metricas.barraAria',
  'clinico.documentos.orientacoes.retornoEm',
  'clinico.fila.oferta.prazo',
  'clinico.formato.anos',
  'clinico.formato.meses',
  'clinico.internacao.app.retido',
  'clinico.internacao.boletim.custoAtual',
  'clinico.internacao.leito.atrasadas',
  'clinico.internacao.stat.vagas',
  'clinico.internacao.stat.atrasadas',
  'clinico.internacao.prescricao.feitas',
  'clinico.internacao.paciente.naTroca',
  'clinico.vacinas.filtro.ultimosDias',
  'clinico.prontuario.conduta.porDias',
  'clinico.prontuario.passos.prescricoes',
  'clinico.fila.oferta.mensagemPadrao',
  'clinico.internacao.passagem.trava',
])

/** `|` aqui separa itens de lista (lidos com `tm()` + split), não formas de plural. */
const isListKey = (key) => /^clinico\.documentos\.termo\.[^.]+\.itens$/.test(key)

/** Símbolo de "sem valor" (igual em todo idioma): única exceção ao em-dash em sr/ar. */
const DASH_SYMBOL_KEYS = new Set(['clinico.formato.semvalor'])

const flatten = (o, p = '', out = {}) => {
  for (const [k, v] of Object.entries(o)) {
    if (v && typeof v === 'object' && !Array.isArray(v)) flatten(v, `${p}${k}.`, out)
    else out[`${p}${k}`] = v
  }
  return out
}

const load = (loc) => flatten(JSON.parse(fs.readFileSync(path.join(dir, `${loc}.json`), 'utf8')))
const named = (s) => [...s.matchAll(/\{\s*([A-Za-z_]\w*)\s*\}/g)].map((m) => m[1])
const sameSet = (a, b) => {
  const x = new Set(a)
  const y = new Set(b)
  return x.size === y.size && [...x].every((v) => y.has(v))
}
const literals = (s) =>
  [...s.matchAll(/\{'([^']*)'\}/g)]
    .map((m) => m[1])
    .sort()
    .join('')
const count = (s, sub) => s.split(sub).length - 1

const ref = load(base)
const en = load('en')
const refKeys = new Set(Object.keys(ref))
let ok = true

const report = (loc, title, items) => {
  if (!items.length) return
  ok = false
  console.log(`\n[${loc}] ${title}: ${items.length}`)
  items.slice(0, 30).forEach((line) => console.log(`  - ${line}`))
}

for (const loc of locales) {
  const cur = load(loc)
  const curKeys = new Set(Object.keys(cur))
  report(
    loc,
    'faltando',
    [...refKeys].filter((k) => !curKeys.has(k)),
  )
  report(
    loc,
    'sobrando',
    [...curKeys].filter((k) => !refKeys.has(k)),
  )

  if (loc !== 'sr' && loc !== 'ar') continue

  const problems = []
  for (const key of refKeys) {
    const value = cur[key]
    const source = en[key]
    if (typeof value !== 'string' || typeof source !== 'string') continue

    if (!sameSet(named(value), named(source)))
      problems.push(`${key}: placeholders diferentes do en`)
    if (literals(value) !== literals(source))
      problems.push(`${key}: literais {'x'} diferentes do en`)
    if (count(value, 'PetJourney') !== count(source, 'PetJourney'))
      problems.push(`${key}: "PetJourney" em quantidade diferente do en`)
    if (DASH_SYMBOL_KEYS.has(key) ? value !== source : value.includes('—'))
      problems.push(`${key}: em-dash (—) proibido`)
    if (loc === 'sr' && /[\u0400-\u04FF]/.test(value)) problems.push(`${key}: cirílico no sérvio`)
    if (loc === 'ar' && /[\u200B-\u200F\u202A-\u202E\u2066-\u2069\u061C\uFEFF]/.test(value))
      problems.push(`${key}: marca de direção / caractere invisível`)

    const compileErrors = []
    baseCompile(value, { onError: (error) => compileErrors.push(error.message) })
    if (compileErrors.length) problems.push(`${key}: não compila (${compileErrors[0]})`)

    const forms = value.split('|').length
    if (isListKey(key)) {
      const expected = source.split('|').length
      if (forms !== expected) problems.push(`${key}: lista com ${forms} itens, en tem ${expected}`)
      continue
    }
    const sourceForms = PLURAL_ONLY_IN_SR_AR.has(key) ? 2 : source.split('|').length
    const expected = sourceForms > 1 ? expectedPluralForms(loc, sourceForms) : 1
    if (forms !== expected)
      problems.push(`${key}: ${forms} forma(s) de plural, ${loc} precisa de ${expected}`)
  }
  report(loc, 'regras de sr/ar', problems)
}

console.log(ok ? '\n✅ paridade OK' : '\n❌ paridade quebrada')
process.exit(ok ? 0 : 1)
