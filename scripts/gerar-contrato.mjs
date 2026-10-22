import { execFileSync, execSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Gera os tipos do portal a partir do contrato da API (decisão A3 do épico do portal do parceiro:
 * a API é dona do contrato; o portal só gera os tipos dele, nunca escreve à mão).
 *
 * Fonte, nesta ordem:
 *   1. caminho ou URL passado como argumento:
 *      `npm run contrato:gerar -- ../petjourney-api/contrato/openapi.json`
 *   2. `contrato/openapi.json` do `origin/develop` do repo irmão `../petjourney-api`, lido com
 *      `git show` (sem checkout: o clone pode estar em outro branch).
 *
 * O `openapi-typescript` roda pelo npx com versão fixa porque declara TypeScript 5 como par e o
 * projeto está no 6: instalado como dependência, quebraria o `npm install`. O que ele gera são só
 * tipos, que o TypeScript 6 lê sem problema.
 */

const OPENAPI_TYPESCRIPT = 'openapi-typescript@7.13.0'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const raiz = path.join(__dirname, '..')
const saida = path.join(raiz, 'src', 'service', 'contrato', 'openapi.ts')
const repoDaApi = path.join(raiz, '..', 'petjourney-api')

function git(...args) {
  return execFileSync('git', ['-C', repoDaApi, ...args], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  })
}

async function lerContrato(argumento) {
  if (argumento && /^https?:\/\//.test(argumento)) {
    const resposta = await fetch(argumento)

    if (!resposta.ok) {
      throw new Error(`${argumento} respondeu ${resposta.status}`)
    }

    return { json: await resposta.text(), origem: argumento }
  }

  if (argumento) {
    return { json: fs.readFileSync(argumento, 'utf8'), origem: path.relative(raiz, argumento) }
  }

  if (!fs.existsSync(repoDaApi)) {
    throw new Error(`sem argumento e sem ${repoDaApi}: passe o caminho ou a URL do openapi.json`)
  }

  /* Rede fora não impede gerar: segue com o que o clone já tem, e o cabeçalho diz qual commit. */
  try {
    git('fetch', 'origin', 'develop', '--quiet')
  } catch {
    console.warn('git fetch falhou; usando o origin/develop que o clone já tem')
  }

  const commit = git('log', '-1', '--format=%h %cs', 'origin/develop').trim()

  return {
    json: git('show', 'origin/develop:contrato/openapi.json'),
    origem: `petjourney-api origin/develop ${commit}`,
  }
}

const { json, origem } = await lerContrato(process.argv[2])
const contrato = JSON.parse(json)
const temporario = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'contrato-')), 'openapi.json')

fs.writeFileSync(temporario, json)
fs.mkdirSync(path.dirname(saida), { recursive: true })

/*
 * Linha de comando inteira, e não execFileSync com lista: no Windows o npx é um .cmd, que só roda
 * por shell, e o Node reprova (DEP0190) lista de argumentos junto com shell.
 */
execSync(
  [
    'npx --yes',
    OPENAPI_TYPESCRIPT,
    `"${temporario}"`,
    '--output',
    `"${saida}"`,
    '--root-types --root-types-no-schema-prefix',
  ].join(' '),
  { stdio: 'inherit' },
)

const cabecalho = [
  '/**',
  ' * Gerado por `scripts/gerar-contrato.mjs`. Não edite: rode `npm run contrato:gerar`.',
  ` * Origem: ${origem} (${contrato.info?.title} ${contrato.info?.version}).`,
  ' */',
  '',
].join('\n')

fs.writeFileSync(saida, cabecalho + fs.readFileSync(saida, 'utf8'))
console.log(
  `${path.relative(raiz, saida)}: ${Object.keys(contrato.paths).length} rotas, de ${origem}`,
)
