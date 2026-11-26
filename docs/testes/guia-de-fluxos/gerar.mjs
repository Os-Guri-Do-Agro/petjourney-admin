// Guia de fluxos (25/11/2026): a comunicação entre a clínica no portal web e o responsável com o pet no app.
// Cada fluxo foi rodado de verdade na API de dev, dos dois lados, e virou um JSON em ./fluxos (passos, prints
// e recortes). Os prints ficam em ./prints, fora do git.
// Uso: node gerar.mjs  ->  guia.html
// PDF: msedge --headless=new --no-pdf-header-footer --print-to-pdf=<saida.pdf> guia.html
import fs from 'node:fs'

const AQUI = new URL('./', import.meta.url)
const VERSAO = JSON.parse(fs.readFileSync(new URL('../../../package.json', AQUI), 'utf8')).version
const APP = process.env.APP_VERSAO ?? 'develop 8a8d9c95'
const LADOS = { P: ['Portal', 'p'], A: ['App', 'a'] }

/** A ordem de um dia de uso: ligar o pet, agenda, consulta, depois da consulta, internação, documentos, acessos. */
const ETAPAS = [
  ['Ligar o pet à clínica', ['F01', 'F02']],
  ['Agenda', ['F04', 'F05', 'F07', 'F06', 'F14']],
  ['Consulta e depois dela', ['F08', 'F10', 'F11', 'F12', 'F13', 'F09']],
  ['Internação e documentos', ['F15', 'F16']],
  ['Acessos', ['F17', 'F03']],
]

/** Texto do JSON com "..." viram o texto da tela em azul. */
const tela = (t = '') =>
  String(t)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/"([^"]{1,140})"/g, '<span class="q">"$1"</span>')

/** Largura e altura de um JPEG, lidas do cabeçalho. */
function medida(arquivo) {
  const buf = fs.readFileSync(new URL(`prints/${arquivo}.jpg`, AQUI))
  let i = 2
  while (i < buf.length) {
    if (buf[i] !== 0xff) {
      i++
      continue
    }
    const marca = buf[i + 1]
    if (marca >= 0xc0 && marca <= 0xc3) return [buf.readUInt16BE(i + 7), buf.readUInt16BE(i + 5)]
    i += 2 + buf.readUInt16BE(i + 2)
  }
  throw new Error(`sem medida: ${arquivo}`)
}

/** Recorte de um print: x, y, w, h em pixels do original; mm é a largura no papel. */
function corte(arq, { x = 0, y = 0, w, h } = {}, mm) {
  const [largura, altura] = medida(arq)
  const cw = Math.min(w ?? largura - x, largura - x)
  const ch = Math.min(h ?? altura - y, altura - y)
  const pc = (n) => ((n / cw) * 100).toFixed(3)
  return `<div class="corte" style="width:${mm}mm;height:${((mm * ch) / cw).toFixed(2)}mm"><img src="prints/${arq}.jpg" style="width:${pc(largura)}%;margin-left:-${pc(x)}%;margin-top:-${pc(y)}%"></div>`
}

/** A figura de um passo: o portal recortado no que importa, o app na tela do celular. */
function figura(p, n) {
  if (!p.print || !fs.existsSync(new URL(`prints/${p.print}.jpg`, AQUI))) return ''
  const r = p.recorte ?? null
  let mm
  if (p.lado === 'A') mm = 37
  else {
    const [largura, altura] = medida(p.print)
    const w = r?.w ?? largura
    const h = r?.h ?? altura
    mm = w / h > 2.6 ? 116 : w / h > 1.5 ? 86 : 66
  }
  return `<figure class="fig fig-${LADOS[p.lado][1]}"><figcaption><b>${n}</b> ${LADOS[p.lado][0]}</figcaption>${corte(p.print, r ?? {}, mm)}</figure>`
}

const passo = (p) =>
  `<li><span class="lado lado-${LADOS[p.lado][1]}">${LADOS[p.lado][0]}</span>${tela(p.faz)}${p.ve ? ` <span class="ve">→ ${tela(p.ve)}</span>` : ''}</li>`

function blocoDoFluxo(f, numero, etapa) {
  const falhou = /^(FALHOU|PARCIAL)/.test(f.resultado ?? '')
  return `<section class="fluxo">
  <div class="cabeca"><div class="topo"><span class="num">${numero}</span><div class="tit"><h2>${tela(f.titulo)}</h2><div class="sub">${tela(f.sub)}</div></div><span class="marca">☐ Passou ☐ Falhou</span></div>
  <div class="meta"><span class="etapa">${etapa}</span> <b>Contas:</b> ${tela(f.contas)}</div>${f.antes ? `<div class="antes"><b>Antes de começar:</b> ${tela(f.antes)}</div>` : ''}</div>
  <ol>${f.passos.map(passo).join('')}</ol>
  <div class="figs">${f.passos.map((p, i) => figura(p, i + 1)).join('')}</div>
  ${f.naoConferido?.length ? `<div class="cel"><b>Só no celular:</b> ${f.naoConferido.map(tela).join('; ')}.</div>` : ''}
  ${f.obs ? `<div class="obs">${tela(f.obs)}</div>` : ''}
  ${falhou ? `<div class="bug"><b>No preparo de 25/11:</b> ${tela(f.resultado)}</div>` : ''}
</section>`
}

const fluxos = Object.fromEntries(
  fs
    .readdirSync(new URL('./fluxos/', AQUI))
    .filter((a) => a.endsWith('.json'))
    // Fluxo ainda sendo preparado (sem passos) fica de fora.
    .filter((a) => Array.isArray(JSON.parse(fs.readFileSync(new URL(`./fluxos/${a}`, AQUI), 'utf8')).passos))
    .map((a) => {
      const f = JSON.parse(fs.readFileSync(new URL(`./fluxos/${a}`, AQUI), 'utf8'))
      return [f.id, f]
    }),
)
const ordem = []
for (const [etapa, ids] of ETAPAS) for (const id of ids) if (fluxos[id]) ordem.push([fluxos[id], etapa])
for (const id of Object.keys(fluxos)) if (!ordem.some(([f]) => f.id === id)) ordem.push([fluxos[id], 'Outros'])

const contas = [
  ['portal-demo@petjourney.test', 'Portal', 'Dona da Clínica e Hotel Demo, com o CRMV conferido; assina receita e documento com a senha.'],
  ['qa-vacina-enfermagem@petjourney.test', 'Portal', 'Enfermagem da mesma clínica (recebe o plantão).'],
  ['qa-bruna@petjourney.test', 'App', 'Bruna Castro, responsável da Fubá.'],
  ['qa-marina@petjourney.test', 'App', 'Marina Souza, responsável da Mel e da Pipoca.'],
  ['qa-rafael@petjourney.test', 'App', 'Rafael Lima, responsável do Nino.'],
  ['qa-julia@petjourney.test', 'App', 'Júlia QA, responsável do Bisteca.'],
  ['qa-premium@petjourney.test', 'App', 'Responsável da Luna (acesso temporário; a Luna não é paciente da clínica).'],
  ['luis.qa.tutor@petjourney.test', 'App', 'A sua conta: Thor (paciente, sem vínculo; o fluxo 1 liga) e Espeto.'],
]

const css = `
@page { size: A4; margin: 10mm 11mm; }
* { box-sizing: border-box; }
body { font-family: "Segoe UI", system-ui, sans-serif; color: #1F2A2E; font-size: 9.2pt; line-height: 1.36; margin: 0; }
h1 { color: #2E5A4C; font-size: 19pt; margin: 0 0 .5mm; }
h2 { font-size: 11.5pt; margin: 0; }
h3 { color: #2E5A4C; font-size: 11pt; margin: 0 0 1.5mm; }
.sub1 { color: #5B6B70; margin-bottom: 3mm; }
.q { color: #2B5E9C; font-weight: 600; }
.caixa { border: 1px solid #DCE3E1; border-radius: 8px; padding: 3mm 4mm; margin-bottom: 3mm; break-inside: avoid; }
.caixa ul { margin: 0; padding-left: 4.5mm; } .caixa li { margin: .6mm 0; }
table { width: 100%; border-collapse: collapse; font-size: 8.7pt; }
th { background: #EEF2F1; text-align: left; padding: 1.2mm 1.8mm; }
td { border-top: 1px solid #E3E8E6; padding: .8mm 1.8mm; vertical-align: top; }
.res td:nth-child(n+3) { white-space: nowrap; width: 1%; }
.res { font-size: 8.2pt; } .res td { padding: .35mm 1.8mm; } .res th { padding: .8mm 1.8mm; }
.contas td { padding: .5mm 1.8mm; }
.fluxo { border: 1px solid #DCE3E1; border-radius: 8px; padding: 2.6mm 3.5mm 3mm; margin-bottom: 3.5mm; }
.topo, .meta { break-after: avoid; }
ol li { break-inside: avoid; }
.topo { display: flex; align-items: center; gap: 2.5mm; border-bottom: 1.5px solid #2E5A4C; padding-bottom: 1.5mm; margin-bottom: 1.5mm; }
.tit { flex: 1; } .sub { color: #5B6B70; font-size: 8.6pt; }
.num { width: 8mm; height: 8mm; border-radius: 50%; background: #2E5A4C; color: #fff; font-weight: 700; font-size: 10.5pt; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.marca { font-size: 8.4pt; color: #2E5A4C; white-space: nowrap; border: 1px solid #C9D6D2; border-radius: 5px; padding: .3mm 2mm; }
.meta { font-size: 8.5pt; color: #3D4B50; margin-bottom: 1.2mm; }
.antes { background: #FBF1DC; color: #4A3A12; border-radius: 5px; padding: 1.2mm 2.5mm; font-size: 8.4pt; margin-bottom: 1.8mm; }
.etapa { font-size: 7.4pt; font-weight: 700; color: #6A4A8C; background: #EEE6F6; border-radius: 3px; padding: .2mm 1.6mm; margin-right: 1mm; }
ol { margin: 0 0 2mm; padding-left: 4.6mm; } ol li { margin: 0 0 1mm; padding-left: .5mm; }
.ve { color: #2E6B47; }
.lado { display: inline-block; font-size: 7pt; font-weight: 700; text-transform: uppercase; letter-spacing: .3px; border-radius: 3px; padding: 0 1.4mm; margin-right: 1.5mm; vertical-align: 1px; }
.lado-p { background: #DCEBE6; color: #2E5A4C; } .lado-a { background: #DDE8F4; color: #2B5E9C; }
.figs { display: flex; flex-wrap: wrap; gap: 2.5mm; align-items: flex-start; }
.fig { margin: 0; break-inside: avoid; }
.fig figcaption { font-size: 7.6pt; color: #3D4B50; margin-bottom: .6mm; }
.fig figcaption b { display: inline-flex; width: 4mm; height: 4mm; border-radius: 50%; background: #E5484D; color: #fff; font-size: 7pt; align-items: center; justify-content: center; margin-right: .8mm; }
.fig-a .corte { border-radius: 9px; border-color: #B8C4C9; }
.corte { overflow: hidden; border-radius: 5px; border: 1px solid #CBD5D2; }
.corte img { display: block; }
.cel { background: #DDE8F4; color: #1F3F66; border-radius: 5px; padding: 1.2mm 2.5mm; font-size: 8.4pt; margin-top: 2mm; }
.obs { background: #F3F6F8; border-radius: 5px; padding: 1.2mm 2.5mm; font-size: 8.4pt; margin-top: 1.2mm; color: #3D4B50; }
.bug { background: #FBEAEA; border-radius: 5px; padding: 1.2mm 2.5mm; font-size: 8.4pt; margin-top: 1.2mm; }
.quebra { break-before: page; }
.cabeca { break-inside: avoid; break-after: avoid; }
`

const linhas = ordem
  .map(([f], i) => `<tr><td><b>${i + 1}</b></td><td>${tela(f.titulo)}</td><td>☐ Web</td><td>☐ iOS ☐ Android</td><td>☐ Passou ☐ Falhou</td></tr>`)
  .join('')

const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Guia de fluxos: clínica e app (25/11)</title><style>${css}</style></head><body>
<h1>Guia de fluxos: a clínica no portal e o responsável no app</h1>
<div class="sub1">Toda a comunicação entre a clínica e o responsável com o pet, rodada de verdade na API de dev em 25/11 · portal develop de 25/11 (depois da ${VERSAO}) · app ${APP}</div>

<div class="caixa"><h3>Como usar</h3><ul>
<li>Antes de cada fluxo, leia o quadro amarelo "Antes de começar": ele diz como os dados precisam estar (estão prontos para o fluxo 1).</li>
<li>Cada fluxo começa de um lado e termina do outro. A etiqueta <span class="lado lado-p">Portal</span> é o portal web da clínica (admin-dev, no computador) e <span class="lado lado-a">App</span> é o app do responsável no celular. Faça os passos na ordem e confira o que vem depois da seta; o texto entre aspas azuis é o que está escrito na tela.</li>
<li>Os prints são do preparo: o número vermelho é o do passo, e a caixa vermelha dentro dele mostra onde olhar. Os do app foram tirados com o app aberto no navegador, do tamanho de um celular.</li>
<li>O push só aparece no celular: no preparo, o aviso foi conferido na caixa de notificações do app (o sino). O que ficou só para o celular está no quadro azul de cada fluxo.</li>
<li>Os consertos feitos durante o preparo estão no develop do portal e do app ("Corrigido em 25/11" em cada fluxo). O portal só os mostra depois da próxima publicação do admin-dev (hoje na ${VERSAO}); o app, num build novo.</li>
<li>A leitura de receita com IA ficou fora: ela gasta tokens da rota. A senha das contas é <b>Teste@123</b>; na API de dev, cada gravação leva de 2 a 5 segundos.</li>
</ul></div>

<div class="caixa"><h3>Contas</h3>
<table class="contas"><tr><th style="width:36%">Conta</th><th style="width:9%">Onde</th><th>Quem é</th></tr>${contas.map(([c, o, p]) => `<tr><td><b>${c}</b></td><td>${o}</td><td>${p}</td></tr>`).join('')}</table></div>

<div class="caixa"><h3>Resultado</h3>
<table class="res"><tr><th></th><th>Fluxo</th><th>Portal</th><th>App</th><th>Resultado</th></tr>${linhas}</table></div>

<div class="quebra"></div>
${ordem.map(([f, etapa], i) => blocoDoFluxo(f, i + 1, etapa)).join('\n')}
</body></html>`

fs.writeFileSync(new URL('./guia.html', AQUI), html)
const nPrints = ordem.reduce((s, [f]) => s + f.passos.filter((p) => p.print).length, 0)
console.log('guia.html gerado:', ordem.length, 'fluxos,', ordem.reduce((s, [f]) => s + f.passos.length, 0), 'passos,', nPrints, 'prints')
