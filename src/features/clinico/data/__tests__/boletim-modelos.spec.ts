/**
 * Os textos prontos do boletim.
 *
 * O modo de falhar aqui não é uma exceção na tela: é uma mensagem errada saindo com a assinatura
 * da clínica, para o celular de quem está esperando notícia do animal. Um `{nome}` que não foi
 * substituído, um "3 de 4" que envelheceu, uma temperatura sem o que ela significa — nada disso
 * quebra nada, e tudo isso chega ao responsável.
 *
 * Por isso os testes cobrem o **conteúdo** e não a forma: que o nome do paciente esteja lá, que
 * não sobre lacuna, e que número nunca apareça sozinho.
 */

import { beforeEach, describe, expect, it } from 'vitest'

import { montarModelos, type FatosDoModelo } from '../boletim-texto'
import { setMockConfig } from '../mock-runtime'
import { internacaoRepository } from '../repositories'
import { getDataset, resetDataset } from '../store'

const FATOS: FatosDoModelo = {
  petNome: 'Tofu',
  gravidade: 'estavel',
  feitas: 3,
  previstas: 4,
  temperatura: 38.4,
  diasInternado: 2,
}

beforeEach(() => {
  resetDataset()
  setMockConfig({ latenciaMs: 0, jitterMs: 0 })
})

describe('modelos de boletim', () => {
  it('todos trazem o nome do paciente', () => {
    /* É o dado que o responsável procura primeiro, e o que uma lacuna não preenchida apagaria. */
    for (const modelo of montarModelos(FATOS)) {
      expect(modelo.texto, modelo.id).toContain('Tofu')
    }
  })

  it('nenhum deixa lacuna para preencher à mão', () => {
    /*
     * Gabarito com `[nome]` no meio da frase é o que acaba enviado por engano: quem tem pressa
     * lê o texto como pronto. Aqui o texto **é** pronto.
     */
    for (const modelo of montarModelos(FATOS)) {
      expect(modelo.texto, modelo.id).not.toMatch(/[[{<]\s*\w+\s*[\]}>]/)
    }
  })

  it('todos trazem as medicações do período e a temperatura com significado', () => {
    for (const modelo of montarModelos(FATOS)) {
      expect(modelo.texto, modelo.id).toContain('3 de 4')
      expect(modelo.texto, modelo.id).toContain('38,4 °C')
      /* Número solto assusta sem informar — a leitura vem junto, sempre. */
      expect(modelo.texto, modelo.id).toContain('dentro do normal')
    }
  })

  it('todos terminam com a promessa de avisar', () => {
    for (const modelo of montarModelos(FATOS)) {
      expect(modelo.texto.trim(), modelo.id).toMatch(/avisamos imediatamente\.$/)
    }
  })

  it('cala sobre o que não sabe, em vez de inventar', () => {
    /* Sem temperatura aferida e sem medicação no período, as duas frases somem. */
    const semDados = montarModelos({
      ...FATOS,
      temperatura: null,
      feitas: 0,
      previstas: 0,
    })

    for (const modelo of semDados) {
      expect(modelo.texto, modelo.id).not.toContain('Temperatura')
      expect(modelo.texto, modelo.id).not.toContain('0 de 0')
      /* E continua sendo uma mensagem inteira, não um fragmento. */
      expect(modelo.texto, modelo.id).toContain('Tofu')
    }
  })

  it('nenhum promete alta, horário ou resultado', () => {
    /*
     * Texto pronto é exatamente o que faz alguém enviar um compromisso sem pensar. Nenhum modelo
     * pode dizer quando o animal sai nem o que o exame vai mostrar.
     */
    for (const modelo of montarModelos(FATOS)) {
      expect(modelo.texto.toLowerCase(), modelo.id).not.toContain('receberá alta')
      expect(modelo.texto.toLowerCase(), modelo.id).not.toContain('amanhã')
      expect(modelo.texto.toLowerCase(), modelo.id).not.toContain('não se preocupe')
    }
  })

  it('só o de melhora fala do tempo de internação', () => {
    /* Nos outros, "há 2 dias" seria contagem sem pergunta — e soa a cobrança. */
    const comDias = montarModelos(FATOS).filter((modelo) => modelo.texto.includes('2 dias'))

    expect(comDias.map((modelo) => modelo.id)).toEqual(['melhora'])
  })

  it('no primeiro dia, nem o de melhora conta os dias', () => {
    const primeiroDia = montarModelos({ ...FATOS, diasInternado: 0 })
    const melhora = primeiroDia.find((modelo) => modelo.id === 'melhora')!

    expect(melhora.texto).not.toContain('internado conosco há')
  })

  it('o padrão vem primeiro, porque serve a qualquer paciente', () => {
    expect(montarModelos(FATOS)[0]!.id).toBe('padrao')
  })

  it('os identificadores não se repetem', () => {
    /* O id é a chave do `v-for` e a marcação do botão escolhido. */
    const ids = montarModelos(FATOS).map((modelo) => modelo.id)

    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('modelos vindos do repositório', () => {
  function algumaInternacao() {
    const internacao = getDataset().internacao.internacoes.find(
      (item) => item.status === 'internado',
    )

    expect(internacao, 'o dataset precisa ter paciente internado').toBeDefined()

    return internacao!
  }

  it('chegam preenchidos com o paciente de verdade', async () => {
    const internacao = algumaInternacao()
    const petNome = getDataset().pets.find((pet) => pet.id === internacao.petId)!.nome

    const modelos = await internacaoRepository.modelosDeBoletim(internacao.id)

    expect(modelos.length).toBeGreaterThan(0)

    for (const modelo of modelos) {
      expect(modelo.texto, modelo.id).toContain(petNome)
    }
  })

  it('a contagem de medicações bate com a do boletim composto', async () => {
    /*
     * As duas leituras saem da mesma função de fatos. Se divergirem, o modelo mostra um número na
     * tela e o boletim envia outro — e ninguém descobre até o responsável perguntar.
     */
    const internacao = algumaInternacao()
    const modelos = await internacaoRepository.modelosDeBoletim(internacao.id)
    const padrao = modelos.find((modelo) => modelo.id === 'padrao')!

    const boletim = await internacaoRepository.gerarBoletim({
      internacaoId: internacao.id,
      autorId: 'prof-ana',
      observado: '',
    })

    const contagem = /(\d+) de (\d+) realizados/
    const noModelo = padrao.texto.match(contagem)
    const noBoletim = boletim.texto.match(contagem)

    expect(noModelo?.[0] ?? null).toBe(noBoletim?.[0] ?? null)
  })

  it('recusa internação inexistente', async () => {
    await expect(internacaoRepository.modelosDeBoletim('int-fantasma')).rejects.toThrow(
      'não existe',
    )
  })
})

describe('o texto editado não compra liberdade', () => {
  it('boletim de piora continua retido, mesmo escrito à mão', async () => {
    /*
     * É a regra que dá nome ao repositório da internação: notícia grave não sai por aplicativo
     * antes de alguém ligar. Ela nasce da gravidade, não do texto — e precisa continuar assim
     * agora que o plantão escreve a mensagem inteira, senão bastaria digitar para escapar dela.
     */
    const dataset = getDataset()
    const internacao = dataset.internacao.internacoes.find((item) => item.status === 'internado')!

    /* Um boletim estável antes, para haver piora a detectar. */
    await internacaoRepository.gerarBoletim({
      internacaoId: internacao.id,
      autorId: 'prof-ana',
      observado: '',
      texto: 'Tudo bem por aqui.',
    })

    internacao.gravidade = 'critico'

    const boletim = await internacaoRepository.gerarBoletim({
      internacaoId: internacao.id,
      autorId: 'prof-ana',
      observado: '',
      texto: 'Está tudo ótimo, pode ficar tranquilo.',
    })

    expect(boletim.status).toBe('retido')
    expect(boletim.exigeLigacao).toBe(true)
    /* E o texto escrito é preservado: reter não é reescrever. */
    expect(boletim.texto).toBe('Está tudo ótimo, pode ficar tranquilo.')
  })
})

describe('o texto editado é o que sai', () => {
  it('o boletim guarda exatamente o que o plantão escreveu', async () => {
    /*
     * A regra que a mudança introduziu: com o modelo pronto no campo, quem escreve está vendo a
     * mensagem inteira. Embrulhá-la de novo na moldura automática repetiria o estado do paciente
     * e a temperatura que o próprio modelo já trouxe.
     */
    const internacao = getDataset().internacao.internacoes.find(
      (item) => item.status === 'internado',
    )!
    const escrito = 'Tofu comeu sozinho e dormiu a tarde toda. Qualquer mudança, avisamos.'

    const boletim = await internacaoRepository.gerarBoletim({
      internacaoId: internacao.id,
      autorId: 'prof-ana',
      observado: '',
      texto: escrito,
    })

    expect(boletim.texto).toBe(escrito)
  })
})
