import { writeFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { gerarDataset } from '../seed'

describe('contagem temporaria', () => {
  it('conta tarefas do dia por kind e status', () => {
    const ds: any = gerarDataset()
    const linhas: string[] = ['CHAVES ' + Object.keys(ds).join(',')]
    const tarefas: any[] = ds.tarefas ?? []
    const porDia = new Map<string, any[]>()

    for (const t of tarefas) {
      const dia = String(t.previstaPara).slice(0, 10)
      porDia.set(dia, [...(porDia.get(dia) ?? []), t])
    }

    linhas.push('DIAS ' + [...porDia].map(([d, l]) => `${d}=${l.length}`).join(' '))

    const maior = [...porDia].sort((a, b) => b[1].length - a[1].length)[0]
    const doDia = maior?.[1] ?? []
    const porKind = new Map<string, { total: number; pendentes: number }>()

    for (const t of doDia) {
      const atual = porKind.get(t.kind) ?? { total: 0, pendentes: 0 }
      atual.total += 1
      if (t.status === 'pendente') atual.pendentes += 1
      porKind.set(t.kind, atual)
    }

    linhas.push(`DIA ${maior?.[0]} TOTAL ${doDia.length}`)
    linhas.push(...[...porKind].map(([k, v]) => `${k}: ${v.total} (pendentes ${v.pendentes})`))

    const porHorario = new Map<string, Map<string, number>>()

    for (const t of doDia) {
      const hora = String(t.previstaPara).slice(11, 16)
      const m = porHorario.get(hora) ?? new Map<string, number>()
      m.set(t.kind, (m.get(t.kind) ?? 0) + 1)
      porHorario.set(hora, m)
    }

    linhas.push('RONDAS:')
    linhas.push(
      ...[...porHorario]
        .sort()
        .map(([h, m]) => `${h} -> ${[...m].map(([k, n]) => `${k}:${n}`).join(', ')}`),
    )

    writeFileSync(
      'C:/Users/darkb/AppData/Local/Temp/claude/d--PROJETOS-petjourney-admin/d22b0586-04a2-4946-b775-ded81ed12c58/scratchpad/contagem.txt',
      linhas.join('\n'),
    )
    expect(true).toBe(true)
  })
})
