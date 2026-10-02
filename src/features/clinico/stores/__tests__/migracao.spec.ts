/**
 * Store do migrador, de ponta a ponta sobre a camada mocada.
 *
 * O que estes testes guardam são as promessas que a tela faz e que nenhum teste de domínio vê:
 *
 * 1. **Nada é gravado antes do botão**, e o botão não anda com decisão pendente.
 * 2. **Cada linha que entrou existe de verdade** na base depois — e juntar não duplica.
 * 3. **Pausar e continuar não perde nem repete linha.**
 * 4. **Lote que falha não grava**, e continuar retoma do mesmo lote.
 * 5. O plano **congela** no começo: o relatório conta o que foi feito, não o que a base virou.
 * 6. **As colunas se ligam sozinhas.** Só o obrigatório que o sistema não achou vira pergunta, e
 *    sem pergunta nenhuma o arquivo vai direto para o resumo.
 */

import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { resetMockConfig, setMockConfig } from '../../data/mock-runtime'
import { patientRepository } from '../../data/repositories'
import { resetDataset } from '../../data/store'
import { useMigracaoStore } from '../migracao'

/** O mínimo de `File` que a leitura usa: nome e bytes. */
function arquivo(nome: string, linhas: string[]): File {
  const bytes = new TextEncoder().encode(linhas.join('\n'))

  return { name: nome, arrayBuffer: async () => bytes.buffer } as unknown as File
}

async function ate(condicao: () => boolean, limite = 4_000) {
  const inicio = Date.now()

  while (!condicao()) {
    if (Date.now() - inicio > limite) {
      throw new Error('condição não chegou')
    }

    await new Promise((resolver) => setTimeout(resolver, 2))
  }
}

function prontaParaImportar() {
  const migracao = useMigracaoStore()

  migracao.usarDemonstracao('clinica')
  responderTudo(migracao)

  return migracao
}

/** A resposta de quem não quer perder nada: espécie desconhecida fica de fora, o resto junta. */
function responderTudo(migracao: ReturnType<typeof useMigracaoStore>) {
  for (const pergunta of migracao.perguntas) {
    if (pergunta.tipo === 'especie') {
      migracao.escolherEspecie(pergunta.chave, 'fora')
    }
  }

  for (const decisao of migracao.plano!.decisoes) {
    if (decisao.escolha === null) {
      migracao.escolher(decisao.id, decisao.tipo === 'mesma-pessoa' ? 'manter' : 'juntar')
    }
  }
}

describe('store do migrador', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    resetDataset()
    setMockConfig({ latenciaMs: 0, jitterMs: 0 })
  })

  afterEach(() => {
    useMigracaoStore().$limpar()
    resetMockConfig()
  })

  it('não grava nada antes do botão, e o botão não anda com decisão pendente', async () => {
    const migracao = useMigracaoStore()
    const antes = patientRepository.todosOsPets().length

    /* Sem etapa de colunas: o arquivo abre direto nas dúvidas. */
    migracao.usarDemonstracao('clinica')
    expect(migracao.etapa).toBe('duvidas')
    expect(migracao.pendentes).toBe(5)
    /* Cinco decisões e duas espécies: "Peixe" e a espécie em branco que nem a raça resolve. */
    expect(migracao.perguntas.map((pergunta) => pergunta.tipo)).toEqual([
      'especie',
      'especie',
      'decisao',
      'decisao',
      'decisao',
      'decisao',
      'decisao',
    ])
    expect(migracao.semResposta).toBe(7)

    migracao.abrirResumo()
    expect(migracao.etapa).toBe('duvidas')

    await migracao.importar()

    expect(migracao.estado).toBe('parada')
    expect(patientRepository.todosOsPets()).toHaveLength(antes)
  })

  it('importa: o que entrou existe, o que juntou não duplica, e o relatório não muda depois', async () => {
    const migracao = prontaParaImportar()
    const petsAntes = patientRepository.todosOsPets().length
    const tutoresAntes = patientRepository.todosOsTutores().length
    const contagem = migracao.plano!.contagem

    await migracao.importar()
    await ate(() => migracao.estado === 'concluida')

    expect(patientRepository.todosOsPets()).toHaveLength(petsAntes + contagem.animaisNovos)
    expect(patientRepository.todosOsTutores()).toHaveLength(
      tutoresAntes + contagem.responsaveisNovos,
    )

    /* A Frida da linha 5 é a que já existia: juntar não criou uma segunda. */
    const fridas = patientRepository.todosOsPets().filter((pet) => pet.nome === 'Frida')
    expect(fridas).toHaveLength(1)

    /* O Thor do Eduardo ganhou a alergia da planilha, sem perder o que tinha. */
    const thor = patientRepository.todosOsPets().find((pet) => pet.id === 'pet-thor')!
    expect(thor.alertas.some((alerta) => alerta.detalhe === 'Dipirona')).toBe(true)

    /* Cada linha tem resultado, e as que entraram apontam para um paciente de verdade. */
    expect(migracao.resultados).toHaveLength(migracao.plano!.itens.length)
    for (const resultado of migracao.resultados.filter((item) => item.situacao === 'entra')) {
      expect(patientRepository.todosOsPets().some((pet) => pet.id === resultado.petId)).toBe(true)
    }

    /* As duas linhas do Bob apontam para o mesmo paciente. */
    const bob = migracao.resultados.filter((item) => item.linha === 6 || item.linha === 18)
    expect(new Set(bob.map((item) => item.petId)).size).toBe(1)

    /* Congelado: a base mudou, a contagem do plano não. */
    expect(migracao.plano!.contagem).toEqual(contagem)
  })

  it('pausa entre lotes e continua de onde parou, sem repetir linha', async () => {
    const migracao = useMigracaoStore()

    migracao.usarDemonstracao('vetus')
    expect(migracao.pendentes).toBe(0)
    /* A única pergunta do export grande: o que é "OUTROS". */
    expect(migracao.perguntas).toHaveLength(1)
    responderTudo(migracao)
    migracao.abrirResumo()
    expect(migracao.etapa).toBe('importar')

    const petsAntes = patientRepository.todosOsPets().length
    const novos = migracao.plano!.contagem.animaisNovos

    void migracao.importar()
    await ate(() => migracao.cursor >= 160)
    migracao.pausar()
    await ate(() => !migracao.loteEmVoo)

    const parado = migracao.cursor
    expect(migracao.estado).toBe('pausada')
    expect(parado).toBeLessThan(migracao.total)

    await new Promise((resolver) => setTimeout(resolver, 20))
    expect(migracao.cursor).toBe(parado)

    void migracao.continuar()
    await ate(() => migracao.estado === 'concluida', 20_000)

    expect(patientRepository.todosOsPets()).toHaveLength(petsAntes + novos)
    expect(new Set(migracao.resultados.map((item) => item.linha)).size).toBe(
      migracao.resultados.length,
    )
  })

  it('lote que falha não grava, e continuar retoma do mesmo lote', async () => {
    const migracao = prontaParaImportar()
    const petsAntes = patientRepository.todosOsPets().length
    const novos = migracao.plano!.contagem.animaisNovos

    setMockConfig({ erroPorOperacao: { 'migracao.importar': 1 } })
    await migracao.importar()

    expect(migracao.estado).toBe('falhou')
    expect(migracao.erroDaImportacao).toBe('falha-servidor')
    expect(migracao.cursor).toBe(0)
    expect(patientRepository.todosOsPets()).toHaveLength(petsAntes)

    setMockConfig({ erroPorOperacao: { 'migracao.importar': 0 } })
    await migracao.continuar()
    await ate(() => migracao.estado === 'concluida')

    expect(patientRepository.todosOsPets()).toHaveLength(petsAntes + novos)
  })

  it('sem pergunta nenhuma, o arquivo vai direto para o resumo', async () => {
    const migracao = useMigracaoStore()

    await migracao.abrirArquivo(
      arquivo('fichas.csv', [
        'Animal;Espécie;Tutor;Telefone',
        'Quindim;Cão;Olívia Barreto Nunes;(11) 98123-4567',
        'Pirulito;Gato;Teodoro Assis Prado;(11) 97234-5678',
      ]),
    )

    expect(migracao.faltas).toEqual([])
    expect(migracao.perguntas).toEqual([])
    expect(migracao.etapa).toBe('importar')
  })

  it('pergunta só pela coluna obrigatória que não achou, e volta a perguntar se ela sumir', async () => {
    const migracao = useMigracaoStore()

    await migracao.abrirArquivo(
      arquivo('fichas.csv', [
        'Ficha;Bicho;Quem traz;Espécie;Fone',
        '1;Quindim;Olívia Barreto Nunes;Cão;(11) 98123-4567',
        '2;Pirulito;Teodoro Assis Prado;Gato;(11) 97234-5678',
      ]),
    )

    /* Espécie e telefone foram pelo nome da coluna; os dois nomes, não. Só eles viram pergunta. */
    expect(migracao.etapa).toBe('duvidas')
    expect(migracao.perguntas.map((pergunta) => pergunta.id)).toEqual([
      'coluna:petNome',
      'coluna:responsavelNome',
    ])

    migracao.responderColuna('petNome', 1)
    migracao.responderColuna('responsavelNome', 2)

    /* Respondidas, continuam na fila: é o que deixa voltar e mudar de ideia. */
    expect(migracao.faltas).toEqual([])
    expect(migracao.semResposta).toBe(0)
    expect(migracao.perguntas.slice(0, 2).map((pergunta) => pergunta.resposta)).toEqual([1, 2])

    migracao.abrirResumo()
    expect(migracao.etapa).toBe('importar')
    expect(migracao.plano!.contagem.animaisNovos).toBe(2)

    /* Pelo painel de colunas, alguém tira o nome do animal: o resumo devolve a pergunta. */
    migracao.mapear(1, null)
    migracao.abrirResumo()
    expect(migracao.etapa).toBe('duvidas')
    expect(migracao.semResposta).toBe(1)

    /* Responder com a coluna do outro obrigatório faz o outro faltar — e ele vira a pergunta. */
    migracao.responderColuna('petNome', 2)
    expect(migracao.faltas).toEqual(['responsavelNome'])
    expect(
      migracao.perguntas.find((pergunta) => pergunta.id === 'coluna:responsavelNome')?.resposta,
    ).toBeNull()
  })

  it('não troca de arquivo no meio de uma importação pausada', async () => {
    const migracao = useMigracaoStore()

    migracao.usarDemonstracao('vetus')
    responderTudo(migracao)
    void migracao.importar()
    migracao.pausar()
    await ate(() => !migracao.loteEmVoo)

    migracao.usarDemonstracao('clinica')
    migracao.recomecar()

    expect(migracao.demonstracao).toBe('vetus')
    expect(migracao.etapa).toBe('importar')
    expect(migracao.emAndamento).toBe(true)
  })
})
