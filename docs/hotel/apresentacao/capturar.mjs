/**
 * Captura as telas do hotel a partir do **sistema rodando**, não de maquete.
 *
 * Existe porque a primeira entrega deste módulo foi recusada com uma frase que não deixa dúvida:
 * "olhei as telas e não entendi nada". O documento de apresentação precisa mostrar as telas de
 * verdade, e capturas feitas à mão envelhecem na primeira mudança de layout — ninguém refaz dez
 * imagens porque um botão mudou de lugar.
 *
 * Uso:
 *
 *   npm run dev                       # numa aba, anote a porta
 *   node docs/hotel/apresentacao/capturar.mjs 5173
 *
 * ## O que este script faz com a sessão, e por quê
 *
 * As telas do hotel rodam inteiras sobre a camada mocada e não chamam API nenhuma — mas a casca
 * do portal exige sessão para montar. O script escreve **temporariamente** uma página em
 * `public/`, que grava um token local no navegador e liga o interruptor do módulo, e a apaga no
 * fim. O token é gerado aqui e não vale em servidor nenhum: nada é verificado no navegador, e o
 * hotel não tem back-end para enganar.
 *
 * A API real é apontada para um endereço morto (`--host-resolver-rules`). Sem isso, o token
 * forjado leva 401 na primeira chamada do portal, o interceptador limpa a sessão, e a casca
 * desaparece no meio da captura.
 */

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const AQUI = path.dirname(fileURLToPath(import.meta.url))
const RAIZ = path.resolve(AQUI, '..', '..', '..')
const DESTINO = path.join(AQUI, 'telas')
const PAGINA = path.join(RAIZ, 'public', '__captura.html')

const porta = process.argv[2] ?? '5173'
const base = `http://localhost:${porta}`

/** O host da API de desenvolvimento, lido do `.env` para não ficar fixo aqui. */
function hostDaApi() {
  const env = path.join(RAIZ, '.env.development')

  if (!fs.existsSync(env)) {
    return null
  }

  const url = /VITE_API_URL=(.+)/.exec(fs.readFileSync(env, 'utf8'))?.[1]?.trim()

  try {
    return url ? new URL(url).host : null
  } catch {
    return null
  }
}

const NAVEGADORES = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
]

const navegador = NAVEGADORES.find((caminho) => fs.existsSync(caminho))

if (!navegador) {
  console.error('Nenhum navegador encontrado. Este script usa o Edge, que já vem no Windows.')
  process.exit(1)
}

/**
 * As telas, com a altura de janela que enquadra cada uma.
 *
 * A altura é escolhida à mão: a captura é da página inteira, e uma janela muito alta deixa faixa
 * vazia embaixo — que num documento impresso parece erro de diagramação.
 */
const TELAS = [
  { arquivo: '01-mapa', rota: '/hotel/mapa', altura: 1600 },
  { arquivo: '02-painel', rota: '/hotel/painel', altura: 800 },
  /*
   * 1300: as duas colunas de tarefas fecham juntas em 1116, 1295 e 1358 — alturas entre esses
   * valores cortam uma fileira ao meio, que num PDF lê como erro de diagramação. Esta altura
   * precisa ser reconferida sempre que a forma da tela mudar; foi reajustada três vezes.
   */
  { arquivo: '03-rotina', rota: '/hotel/rotina', altura: 1300 },
  /*
   * 1120: o cartão de hóspede passou de três linhas soltas para quatro faixas com a barra do dia,
   * e ficou quase duas vezes mais alto. Com os 640 de antes a captura cortava a segunda fileira ao
   * meio.
   */
  { arquivo: '04-hospedes', rota: '/hotel/hospedes', altura: 1120 },
  { arquivo: '05-reservas', rota: '/hotel/reservas', altura: 1400 },
  { arquivo: '06-reserva', rota: '/hotel/reserva/res-bidu', altura: 980 },
  { arquivo: '07-estadia', rota: '/hotel/hospedagem/hosp-tofu', altura: 1670 },
  { arquivo: '08-acomodacoes', rota: '/hotel/acomodacoes', altura: 1340 },
  { arquivo: '09-resumo', rota: '/hotel/resumo', altura: 920 },
  /* A régua de 24 h tem altura previsível: quatro faixas e o rodapé da parede. */
  { arquivo: '10-rotina-padrao', rota: '/hotel/rotina-padrao', altura: 620 },
]

const SEMEADOR = `<!doctype html>
<html lang="pt-BR">
  <head><meta charset="utf-8" /><title>Preparando captura</title></head>
  <body>
    <script>
      /* Arquivo temporário, escrito e apagado por docs/hotel/apresentacao/capturar.mjs. */
      const b64 = (o) =>
        btoa(JSON.stringify(o)).replace(/\\+/g, '-').replace(/\\//g, '_').replace(/=+$/, '')

      const agora = Math.floor(Date.now() / 1000)
      const token =
        b64({ alg: 'none', typ: 'JWT' }) +
        '.' +
        b64({
          userId: 'user-captura',
          email: 'captura@local',
          nome: 'Captura',
          perfilAtivo: 'PARCEIRO',
          parceiroAtivoId: 'parceiro-captura',
          iat: agora,
          exp: agora + 21600,
        }) +
        '.captura'

      localStorage.setItem('access_token', token)
      localStorage.setItem('refresh_token', token)
      localStorage.setItem('hotel.moduleUnlocked', 'user-captura')
      localStorage.setItem('APP_LOCALE', 'pt')

      location.replace(new URLSearchParams(location.search).get('ir') || '/hotel/painel')
    </script>
  </body>
</html>
`

fs.mkdirSync(DESTINO, { recursive: true })
fs.writeFileSync(PAGINA, SEMEADOR, 'utf8')

const perfil = path.join(RAIZ, 'node_modules', '.cache', 'captura-hotel')
const api = hostDaApi()

try {
  for (const tela of TELAS) {
    const saida = path.join(DESTINO, `${tela.arquivo}.png`)

    execFileSync(
      navegador,
      [
        '--headless=new',
        '--disable-gpu',
        '--no-first-run',
        `--user-data-dir=${perfil}`,
        ...(api ? [`--host-resolver-rules=MAP ${api} 127.0.0.1:9`] : []),
        `--window-size=1560,${tela.altura}`,
        /* O orçamento de tempo virtual espera o Vue montar e a camada mocada responder. */
        '--virtual-time-budget=11000',
        `--screenshot=${saida}`,
        `${base}/__captura.html?ir=${tela.rota}`,
      ],
      { stdio: 'ignore' },
    )

    const bytes = fs.existsSync(saida) ? fs.statSync(saida).size : 0

    console.log(`${bytes > 20_000 ? 'ok  ' : 'FALHOU'} ${tela.arquivo} (${bytes} bytes)`)
  }
} finally {
  /* A página semeadora nunca fica no repositório, nem quando a captura falha no meio. */
  fs.rmSync(PAGINA, { force: true })
  fs.rmSync(perfil, { recursive: true, force: true })
}

console.log(`\nTelas em ${path.relative(RAIZ, DESTINO)}`)
console.log('Para regerar o PDF, ver o README desta pasta.')
