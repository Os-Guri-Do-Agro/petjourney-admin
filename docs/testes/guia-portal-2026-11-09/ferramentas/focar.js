// Foca o campo pelo rótulo (para digitar com type_text). Uso: window.__focar('Peso')
window.__focar = (rotulo, n = 0) => {
  const norm = (s) => (s || '').replace(/\s+/g, ' ').trim()
  const cs = [...document.querySelectorAll('input,textarea')].filter((c) => {
    const r = c.getBoundingClientRect()
    if (r.width < 1) return false
    const lab = c.id ? document.querySelector(`label[for="${CSS.escape(c.id)}"]`) : null
    return [norm(lab?.innerText), norm(c.getAttribute('aria-label')), norm(c.placeholder)].some((x) => x && x.startsWith(norm(rotulo)))
  })
  const c = cs[n]
  if (!c) return 'nao achei ' + rotulo
  c.scrollIntoView({ block: 'center' })
  c.focus()
  c.select?.()
  return 'foco ' + rotulo + ' ' + (document.activeElement === c)
}
'ok'
