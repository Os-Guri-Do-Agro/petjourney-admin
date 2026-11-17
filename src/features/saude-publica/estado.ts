/**
 * O que a apresentação cria durante a sessão: campanhas novas, adoções registradas e atendimentos
 * do piloto com a Subea. Fica na memória da aba (recarregar volta ao começo), para a demonstração
 * poder ser repetida do zero.
 *
 * No piloto, o que o tutor faz na ficha (abrir pelo QR, tocar em "Já fiz", informar o SinPatinhas)
 * muda o atendimento, e as metas se recalculam a partir dele: quem apresenta faz o papel do tutor e
 * vê o painel da Subea andar.
 */
import { computed, ref } from 'vue'

import {
  ADOCOES,
  ATENDIMENTOS_DO_PILOTO,
  CAMPANHAS,
  META_DO_PROCEDIMENTO,
  METAS_DO_PILOTO,
  proximosCuidados,
  type Adocao,
  type AtendimentoDoPiloto,
  type Campanha,
  type MetaDoPiloto,
} from '@/features/saude-publica/dados'

const campanhas = ref<Campanha[]>([...CAMPANHAS])
const adocoes = ref<Adocao[]>([...ADOCOES])
/** Os animais que já foram adotados na sessão, para sair da lista de quem espera. */
const adotados = ref<string[]>([])
const atendimentos = ref<AtendimentoDoPiloto[]>([...ATENDIMENTOS_DO_PILOTO])
/** Os lembretes reenviados da caixa de cada meta: a hora e para quantos. */
const lembretes = ref<Partial<Record<MetaDoPiloto['id'], { hora: string; para: number }>>>({})

const NO_COMECO = new Map(ATENDIMENTOS_DO_PILOTO.map((item) => [item.id, item]))

export function useEstadoDoPrototipo() {
  function criarCampanha(campanha: Omit<Campanha, 'id'>) {
    campanhas.value = [{ ...campanha, id: `n${campanhas.value.length + 1}` }, ...campanhas.value]
  }

  function registrarAdocao(adocao: Omit<Adocao, 'id'>, animalId: string) {
    adocoes.value = [{ ...adocao, id: `n${adocoes.value.length + 1}` }, ...adocoes.value]
    adotados.value = [...adotados.value, animalId]
  }

  function registrarAtendimento(atendimento: Omit<AtendimentoDoPiloto, 'id'>) {
    const id = `n${atendimentos.value.length + 1}`
    atendimentos.value = [{ ...atendimento, id }, ...atendimentos.value]
    return id
  }

  function atualizarAtendimento(
    id: string,
    mudanca: Partial<Pick<AtendimentoDoPiloto, 'situacao' | 'sinpatinhas'>>,
  ) {
    atendimentos.value = atendimentos.value.map((item) =>
      item.id === id ? { ...item, ...mudanca } : item,
    )
  }

  function reenviarLembrete(meta: MetaDoPiloto['id'], para: number) {
    const hora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    lembretes.value = { ...lembretes.value, [meta]: { hora, para } }
  }

  return {
    campanhas,
    adocoes,
    adotados,
    atendimentos,
    lembretes,
    criarCampanha,
    registrarAdocao,
    registrarAtendimento,
    atualizarAtendimento,
    reenviarLembrete,
  }
}

/** O cuidado que a ficha cobra primeiro: o mais perto do atendimento. */
function primeiroCuidado(atendimento: AtendimentoDoPiloto) {
  return proximosCuidados(atendimento.data, atendimento.procedimentos)[0]
}

/**
 * As metas do piloto com o que mudou na sessão. Os números do período ficam como estão; cada
 * atendimento novo entra na base da ficha e do SinPatinhas, e o que mudou nos atendimentos da lista
 * (abriu, informou, cumpriu) soma ou tira do feito. O cuidado cumprido antes da data entra na conta
 * do "no prazo" ao ser confirmado.
 */
export function useMetasDoPiloto() {
  return computed(() =>
    METAS_DO_PILOTO.map((meta) => {
      let feitos = meta.feitos
      let base = meta.base

      for (const agora of atendimentos.value) {
        const antes = NO_COMECO.get(agora.id)

        if (meta.id === 'ficha' || meta.id === 'sinpatinhas') {
          const conta = (item?: AtendimentoDoPiloto) =>
            item ? (meta.id === 'ficha' ? item.situacao !== 'nao-abriu' : item.sinpatinhas) : false
          if (!antes) base += 1
          feitos += Number(conta(agora)) - Number(conta(antes))
          continue
        }

        const cuidado = primeiroCuidado(agora)
        if (!cuidado || META_DO_PROCEDIMENTO[cuidado.procedimento] !== meta.id) continue
        if (agora.situacao === 'cumpriu' && antes?.situacao !== 'cumpriu') {
          feitos += 1
          base += 1
        }
      }

      const valor = Math.round((feitos / base) * 100)
      return { ...meta, feitos, base, valor, atingida: valor >= meta.meta }
    }),
  )
}

export type MetaCalculada = ReturnType<typeof useMetasDoPiloto>['value'][number]
