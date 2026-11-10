/**
 * Confere se o que subiu já está no ar (Regra 5 do CLAUDE.md).
 *
 * Lê a etiqueta `<meta name="versao-do-portal">` do `index.html` publicado (o build a escreve, ver
 * `vite.config.ts`) e compara com a versão do `package.json` e o commit do ramo que subiu.
 *
 *   npm run conferir:publicacao                        # produção (main), uma conferência
 *   npm run conferir:publicacao -- --esperar           # repete a cada 30 s, até 60 min
 *   npm run conferir:publicacao -- --esperar=120       # até 120 min
 *   npm run conferir:publicacao -- https://outro.endereco --ramo=develop
 *
 * Sai com 0 quando o endereço mostra a versão e o commit esperados, 1 quando não (ou o tempo acabou).
 */
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const argumentos = process.argv.slice(2)
const opcao = (nome) => argumentos.find((a) => a === `--${nome}` || a.startsWith(`--${nome}=`))
const valor = (nome) => opcao(nome)?.split('=')[1]

const endereco = (
  argumentos.find((a) => !a.startsWith('--')) ?? 'https://portal.petjourney.health'
).replace(/\/+$/, '')
const ramo = valor('ramo') ?? 'main'
const esperar = Boolean(opcao('esperar'))
const minutos = Number(valor('esperar') ?? 60)

const versaoEsperada = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
).version

function commitEsperado() {
  try {
    return execFileSync('git', ['rev-parse', '--short=7', `origin/${ramo}`], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
  } catch {
    return ''
  }
}

const atributo = (etiqueta, nome) => etiqueta.match(new RegExp(`${nome}="([^"]*)"`))?.[1] ?? ''

async function noAr() {
  const resposta = await fetch(`${endereco}/?conferencia=${Date.now()}`, {
    headers: { 'cache-control': 'no-cache' },
  })
  const html = await resposta.text()
  const etiqueta = html.match(/<meta[^>]*name="versao-do-portal"[^>]*>/)?.[0]
  if (!etiqueta) return null
  return {
    versao: atributo(etiqueta, 'content'),
    commit: atributo(etiqueta, 'data-commit'),
    build: atributo(etiqueta, 'data-build'),
  }
}

function quando(iso) {
  const data = new Date(iso)
  if (Number.isNaN(data.getTime())) return iso || '?'
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(data)
}

async function conferir() {
  const commit = commitEsperado()
  let publicado
  try {
    publicado = await noAr()
  } catch (erro) {
    return { ok: false, texto: `sem resposta de ${endereco} (${erro.message})` }
  }

  if (!publicado) {
    return { ok: false, texto: 'ainda está num build sem versão (anterior à 0.1.0).' }
  }

  const descricao = `${publicado.versao} (commit ${publicado.commit || '?'}, build ${quando(publicado.build)})`
  const versaoOk = publicado.versao === versaoEsperada
  const commitOk = !commit || !publicado.commit || publicado.commit === commit
  if (versaoOk && commitOk) {
    return { ok: true, texto: `no ar: ${descricao}. Confere com o que subiu.` }
  }

  const esperado = `${versaoEsperada}${commit ? ` (commit ${commit} do origin/${ramo})` : ''}`
  return { ok: false, texto: `no ar: ${descricao}; esperado ${esperado}.` }
}

const limite = Date.now() + minutos * 60_000
for (;;) {
  const { ok, texto } = await conferir()
  const hora = new Date().toLocaleTimeString('pt-BR')
  console.log(`[${hora}] ${endereco}: ${texto}`)
  if (ok) process.exit(0)
  if (!esperar || Date.now() > limite) {
    if (esperar) console.log(`Passaram ${minutos} min e a publicação não apareceu.`)
    process.exit(1)
  }
  await new Promise((pronto) => setTimeout(pronto, 30_000))
}
