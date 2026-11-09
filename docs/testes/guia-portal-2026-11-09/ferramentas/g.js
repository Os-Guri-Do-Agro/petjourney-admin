// Atalhos para andar pelo portal durante o preparo do guia (rodar com format "script").
window.__g = (() => {
  const norm = (s) => (s || '').replace(/\s+/g, ' ').trim()
  const vis = (e) => {
    const r = e.getBoundingClientRect()
    if (r.width < 1 || r.height < 1) return false
    const s = getComputedStyle(e)
    return s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity) > 0.05
  }
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  const CLICAVEL =
    'button,a,[role=button],[role=tab],[role=menuitem],[role=option],[role=switch],[role=checkbox],[role=radio],label,summary,li[data-p-index],.p-select-option,[tabindex="0"]'

  function achar(txt, { exato = true, n = 0, dentro = null } = {}) {
    const alvo = norm(txt)
    const raiz = dentro ? document.querySelector(dentro) : document
    if (!raiz) return null
    const els = [...raiz.querySelectorAll(CLICAVEL)].filter(vis).filter((e) => {
      const t = norm(e.innerText ?? e.textContent)
      const a = norm(e.getAttribute('aria-label'))
      return exato ? t === alvo || a === alvo : t.includes(alvo) || a.includes(alvo)
    })
    // o mais interno que ainda é clicável
    const folhas = els.filter((e) => !els.some((o) => o !== e && e.contains(o)))
    return folhas[n] ?? null
  }

  function disparar(e) {
    e.scrollIntoView({ block: 'center' })
    const r = e.getBoundingClientRect()
    const o = { bubbles: true, cancelable: true, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2, button: 0 }
    e.dispatchEvent(new PointerEvent('pointerdown', o))
    e.dispatchEvent(new MouseEvent('mousedown', o))
    e.dispatchEvent(new PointerEvent('pointerup', o))
    e.dispatchEvent(new MouseEvent('mouseup', o))
    e.click()
  }

  async function clicar(txt, opts = {}) {
    const t0 = Date.now()
    let e = null
    while (Date.now() - t0 < (opts.espera ?? 6000)) {
      e = achar(txt, opts)
      if (e) break
      await sleep(150)
    }
    if (!e) return `NÃO ACHEI "${txt}"`
    disparar(e)
    await pronto(opts.pronto ?? 8000)
    return `ok ${e.tagName} "${norm(e.innerText).slice(0, 50)}"`
  }

  async function pronto(max = 10000) {
    const t0 = Date.now()
    const ocupado = () =>
      document.querySelector('.p-skeleton, [aria-busy="true"], .p-progressspinner, .p-button-loading')
    while (Date.now() - t0 < max && ocupado()) await sleep(120)
    let ultimo = Date.now()
    const mo = new MutationObserver(() => (ultimo = Date.now()))
    mo.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true })
    while (Date.now() - t0 < max) {
      const animando = document.getAnimations().some((a) => a.playState === 'running' && a.effect?.getTiming?.().iterations !== Infinity)
      if (!animando && Date.now() - ultimo > 600) break
      await sleep(100)
    }
    mo.disconnect()
    document.querySelectorAll('[id*="vue-devtools"], .vue-devtools__anchor').forEach((e) => (e.style.display = 'none'))
    return Date.now() - t0
  }

  // Campo por rótulo (label for / aria-label / placeholder) e valor, com evento de input.
  function campo(rotulo, valor, { n = 0 } = {}) {
    const alvo = norm(rotulo)
    const campos = [...document.querySelectorAll('input,textarea')].filter(vis)
    const casa = campos.filter((c) => {
      const lab = c.id ? document.querySelector(`label[for="${CSS.escape(c.id)}"]`) : null
      return [norm(lab?.innerText), norm(c.getAttribute('aria-label')), norm(c.placeholder)].some(
        (x) => x && (x === alvo || x.startsWith(alvo)),
      )
    })
    const c = casa[n]
    if (!c) return `NÃO ACHEI campo "${rotulo}"`
    c.focus()
    const proto = c.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(c, valor)
    c.dispatchEvent(new Event('input', { bubbles: true }))
    c.dispatchEvent(new Event('change', { bubbles: true }))
    return `ok campo "${rotulo}" = ${valor}`
  }

  const texto = (sel, max = 3000) => norm((sel ? document.querySelector(sel) : document.body)?.innerText).slice(0, max)
  const textoLinhas = (sel, max = 4000) => ((sel ? document.querySelector(sel) : document.body)?.innerText ?? '').replace(/\n{2,}/g, '\n').slice(0, max)
  const botoes = (sel) =>
    [...(sel ? document.querySelector(sel) : document).querySelectorAll('button,a,[role=tab],[role=switch],[role=checkbox]')]
      .filter(vis)
      .map((e) => norm(e.getAttribute('aria-label') || e.innerText).slice(0, 60))
      .filter(Boolean)
      .join(' | ')
  const campos = () =>
    [...document.querySelectorAll('input,textarea')]
      .filter(vis)
      .map((c) => {
        const lab = c.id ? document.querySelector(`label[for="${CSS.escape(c.id)}"]`) : null
        return `[${norm(lab?.innerText) || c.getAttribute('aria-label') || c.placeholder || c.name || c.type}=${c.value}]`
      })
      .join(' ')

  return { achar, clicar, pronto, campo, texto, textoLinhas, botoes, campos, sleep, norm, disparar }
})()
'__g pronto'
