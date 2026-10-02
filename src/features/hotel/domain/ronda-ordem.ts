/**
 * A ordem em que uma ronda se executa: a ordem física da casa.
 *
 * A prancheta devolve as tarefas na ordem em que o repositório as encontrou, que não é ordem
 * nenhuma — é a ordem de criação dos registros. Para ler uma lista isso é indiferente; para
 * **andar um corredor** não é. Quem serve vinte comedouros sai do primeiro canil, vai até o fim
 * dele, atravessa para o gatil e volta. Uma lista que alterna canil, gatil, canil, externo obriga
 * a pessoa a reordenar de cabeça a cada linha, ou a atravessar a casa de ida e volta vinte vezes.
 *
 * A casa já sabe a própria ordem: `Bloco.ordem` existe e é o que o mapa de acomodações usa para
 * desenhar. Aqui ela passa a valer também para o trabalho.
 *
 * ## Por que `Intl.Collator` e não `localeCompare` solto
 *
 * Dentro do bloco a ordem é o nome da acomodação, e nome de acomodação é quase sempre um prefixo
 * mais um número: "Baia A2", "Baia A10". Em comparação de texto pura, "Baia A10" vem **antes** de
 * "Baia A2", porque `1` < `2` no segundo caractere. Numa casa de cinco baias ninguém nota; numa de
 * quarenta, a lista manda a pessoa andar o corredor fora de ordem exatamente onde a ordem passou a
 * importar. O coletor com `numeric` compara o número como número.
 *
 * Ele é criado **uma vez**, fora da função: construir um `Intl.Collator` é caro, e uma ronda de
 * quarenta animais chamaria o construtor a cada comparação.
 */

/** Um grupo de linhas que partilham o bloco da casa. */
export type GrupoDaCasa<Linha> = {
  blocoId: string
  /** O nome do bloco. Vazio quando o bloco não está no catálogo — ver `agruparPelaCasa`. */
  nome: string
  linhas: Linha[]
}

/** O que `agruparPelaCasa` precisa saber de um bloco. Menos que `Bloco`, de propósito. */
type BlocoDaOrdem = { nome: string; ordem: number }

const porNome = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })

/**
 * Agrupa as linhas de uma ronda pelos blocos da casa, na ordem de andar.
 *
 * Um bloco que não está no catálogo não some e não vai para o fim arbitrariamente: entra num grupo
 * de nome vazio, depois dos conhecidos. Sumir seria perder uma tarefa de um animal — o pior
 * desfecho possível numa prancheta —, e a tela sabe desenhar um grupo sem nome.
 */
export function agruparPelaCasa<Linha extends { blocoId: string; acomodacaoNome: string }>(
  linhas: Linha[],
  blocos: ReadonlyMap<string, BlocoDaOrdem>,
): GrupoDaCasa<Linha>[] {
  const grupos = new Map<string, Linha[]>()

  for (const linha of linhas) {
    grupos.set(linha.blocoId, [...(grupos.get(linha.blocoId) ?? []), linha])
  }

  return [...grupos]
    .map(([blocoId, doBloco]) => ({
      blocoId,
      nome: blocos.get(blocoId)?.nome ?? '',
      /*
       * `ordem` ausente vira `Infinity`, e não `0`: com zero, um bloco desconhecido se enfiaria
       * **antes** do primeiro canil da casa, que é o oposto do que "não sei onde isto fica" pede.
       */
      ordem: blocos.get(blocoId)?.ordem ?? Number.POSITIVE_INFINITY,
      linhas: [...doBloco].sort((a, b) => porNome.compare(a.acomodacaoNome, b.acomodacaoNome)),
    }))
    /*
     * Desempate pelo nome do bloco: numa casa que nunca preencheu `ordem`, todos os blocos valem o
     * mesmo, e sem desempate a ordem passaria a ser a de inserção — que volta a ser a ordem de
     * criação dos registros, exatamente o que este arquivo existe para corrigir.
     */
    .sort((a, b) => a.ordem - b.ordem || porNome.compare(a.nome, b.nome))
    .map(({ blocoId, nome, linhas: ordenadas }) => ({ blocoId, nome, linhas: ordenadas }))
}
