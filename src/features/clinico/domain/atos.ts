/**
 * O que o paciente recebeu, e quando — a história inteira, num lugar só.
 *
 * A pergunta que este arquivo existe para responder é a que um veterinário faz antes de
 * prescrever e depois de uma reação adversa: *este animal já tomou isso? quando?* Até aqui ela
 * não tinha resposta em tela nenhuma, porque a resposta estava partida em três registros que
 * nunca se encontravam — a carteira de vacinas, o checklist da internação e a receita da
 * consulta, que nem sequer é execução: é ordem.
 *
 * **Junta, não copia.** Vacina aplicada e dose de internação já têm registro próprio, e mais
 * rico que este: a aplicação carrega lote e validade porque a farmacovigilância os exige, e a
 * administração carrega o plantão em que caiu a execução. Gravar uma segunda cópia aqui criaria
 * duas versões do mesmo fato, que divergem no primeiro acerto feito de um lado só. Elas entram
 * **derivadas**, na leitura. O que se grava é só o que não tinha casa: o procedimento realizado
 * e a medicação aplicada na clínica.
 *
 * **Só o que o animal de fato recebeu.** Dose recusada e dose pulada ficam de fora — elas são
 * informação valiosa, e continuam no checklist da internação, onde a pergunta é outra ("o turno
 * cumpriu o aprazamento?"). Aqui a pergunta é "o que entrou neste animal", e listar uma dose que
 * o gato cuspiu como recebida faria a conta de exposição sair errada justamente no caso em que
 * alguém está contando.
 */

import type {
  AdministracaoAgendada,
  AplicacaoVacina,
  AtoClinico,
  Internacao,
  PrescricaoDeInternacao,
  Vacina,
} from '../data/types'

export type FonteDosAtos = {
  petId: string
  /** Os atos gravados: procedimento realizado e medicação aplicada na clínica. */
  atos: AtoClinico[]
  aplicacoes: AplicacaoVacina[]
  vacinas: Vacina[]
  administracoes: AdministracaoAgendada[]
  prescricoes: PrescricaoDeInternacao[]
  internacoes: Internacao[]
}

/**
 * A dose de internação vira ato quando **foi dada**.
 *
 * `feita` é o único status que descreve algo que entrou no animal. `pendente` ainda não
 * aconteceu; `suspensa` foi cancelada antes; `pulada` e `recusada` são tentativas que não
 * chegaram ao paciente.
 */
function administracoesRecebidas(fonte: FonteDosAtos): AtoClinico[] {
  const daClinica = new Map(fonte.internacoes.map((item) => [item.id, item]))
  const porPrescricao = new Map(fonte.prescricoes.map((item) => [item.id, item]))

  return fonte.administracoes
    .filter((item) => item.status === 'feita' && item.executadaEm !== null)
    .filter((item) => daClinica.get(item.internacaoId)?.petId === fonte.petId)
    .map((item) => {
      const prescricao = porPrescricao.get(item.prescricaoId) ?? null

      return {
        id: `ato-adm-${item.id}`,
        petId: fonte.petId,
        /*
         * O `kind` vem do item prescrito: a internação prescreve curativo e fisioterapia pelo
         * mesmo caminho por onde prescreve dipirona, e no histórico do paciente os dois não são
         * a mesma coisa.
         */
        kind:
          prescricao?.kind === 'medicamento' || prescricao?.kind === 'fluido'
            ? ('medicamento' as const)
            : ('procedimento' as const),
        origem: 'internacao' as const,
        encounterId: null,
        internacaoId: item.internacaoId,
        medicamentoId: prescricao?.medicamentoId ?? null,
        descricao: prescricao?.descricao ?? '',
        via: prescricao?.via ?? null,
        doseTexto: prescricao?.doseTexto ?? '',
        realizadoEm: item.executadaEm as string,
        professionalId: item.executadaPor ?? '',
        observacao: item.observacao,
      }
    })
}

/**
 * Vacina é procedimento, e não medicamento.
 *
 * Quem procura "o que este animal já tomou de antibiótico" não quer a antirrábica no meio, e
 * quem procura a antirrábica tem a carteira de vacinas, que diz muito mais. Aqui ela entra para
 * que a linha do tempo não tenha buraco — um animal que passou seis meses sem nada, exceto duas
 * vacinas, não teve seis meses sem nada.
 */
function vacinasAplicadas(fonte: FonteDosAtos): AtoClinico[] {
  const catalogo = new Map(fonte.vacinas.map((item) => [item.id, item]))

  return fonte.aplicacoes
    .filter((item) => item.petId === fonte.petId)
    .map((item) => ({
      id: `ato-vac-${item.id}`,
      petId: fonte.petId,
      kind: 'procedimento' as const,
      origem: 'vacina' as const,
      encounterId: null,
      internacaoId: null,
      medicamentoId: null,
      descricao: catalogo.get(item.vacinaId)?.nome ?? '',
      via: item.via,
      doseTexto: '',
      realizadoEm: item.aplicadaEm,
      professionalId: item.professionalId,
      /* A dose de fora diz onde foi dada: sem isso, "sem profissional" pareceria registro faltando. */
      observacao: item.externa
        ? [item.externa.local, item.observacao].filter(Boolean).join(': ')
        : item.observacao,
    }))
}

/**
 * Tudo o que o paciente recebeu, do mais recente para o mais antigo.
 *
 * O empate de instante é desfeito pelo `id` para que a ordem seja **estável**: duas doses dadas
 * no mesmo minuto trocando de lugar a cada carregamento fazem quem confere a lista duas vezes
 * desconfiar do registro.
 */
export function historicoDeAtos(fonte: FonteDosAtos): AtoClinico[] {
  const gravados = fonte.atos.filter((item) => item.petId === fonte.petId)

  return [...gravados, ...administracoesRecebidas(fonte), ...vacinasAplicadas(fonte)].sort(
    (a, b) => b.realizadoEm.localeCompare(a.realizadoEm) || a.id.localeCompare(b.id),
  )
}

/**
 * Quantas vezes este paciente já recebeu este princípio ativo, e quando foi a última.
 *
 * É a pergunta do bulário na hora de prescrever — "já usou antes? reagiu bem?" — e a da
 * farmacovigilância depois de uma reação. Conta pelo `medicamentoId` porque é o que o catálogo
 * garante; ato digitado à mão sem medicamento do bulário não entra na conta, e é melhor assim:
 * somar "dipirona" escrito de três jeitos diferentes produziria um número que parece exato.
 */
export function jaRecebeu(
  atos: AtoClinico[],
  medicamentoId: string,
): { vezes: number; ultimaEm: string | null } {
  const doMedicamento = atos.filter((item) => item.medicamentoId === medicamentoId)

  const ultimaEm = doMedicamento.reduce<string | null>(
    (maior, item) => (maior === null || item.realizadoEm > maior ? item.realizadoEm : maior),
    null,
  )

  return { vezes: doMedicamento.length, ultimaEm }
}
