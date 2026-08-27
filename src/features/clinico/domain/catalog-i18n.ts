/**
 * Aplica a tradução do catálogo clínico sobre as fixtures em português.
 *
 * A tradução é **sobreposição, nunca substituição**: cada campo traduzido entra no lugar do
 * português, e o que a sobreposição não traz continua vindo da base. Um medicamento novo, ainda
 * sem tradução, aparece inteiro em português em vez de aparecer pela metade — que é o modo de
 * falhar que importa aqui, porque um bulário com a contraindicação em branco lê como
 * "não há contraindicação".
 *
 * Pelo mesmo motivo, lista de tamanho diferente da original é **descartada** em vez de
 * mesclada. Sobrepor item a item uma lista de três contraindicações traduzidas sobre uma de
 * quatro deixaria a quarta em português no meio do inglês — ou, pior, sumida. O teste de
 * paridade impede que isso chegue à tela; esta regra é a rede embaixo dele.
 */

import {
  TEXTO_DO_CATALOGO,
  type TextoDoCatalogo,
  type TextoDoMedicamento,
} from '../data/fixtures/catalog-text'
import type { DiagnosisCatalogItem, ExamCatalogItem, Medication } from '../data/types'

/** Lista traduzida só vale se disser o mesmo número de coisas que a original. */
function lista(base: string[], traduzida: string[] | undefined): string[] {
  return traduzida && traduzida.length === base.length ? traduzida : base
}

/**
 * Todas as grafias do princípio ativo, em todos os idiomas — não só no da tela.
 *
 * O alerta de alergia é texto livre escrito por quem atendeu, e fica no idioma em que foi
 * escrito para sempre. Cruzá-lo só com a grafia do idioma atual faz o aviso sumir na troca de
 * idioma. Com o conjunto inteiro, "Alergia a amoxicilina" continua casando com *Amoxicillin*.
 */
function sinonimosDoPrincipio(medicamentoId: string, base: string): string[] {
  const grafias = Object.values(TEXTO_DO_CATALOGO)
    .map((catalogo) => catalogo.medicamentos[medicamentoId]?.principioAtivo)
    .filter((grafia): grafia is string => Boolean(grafia))

  return [...new Set([base, ...grafias])]
}

export function traduzirDiagnosticos(
  base: DiagnosisCatalogItem[],
  texto: TextoDoCatalogo | undefined,
): DiagnosisCatalogItem[] {
  if (!texto) {
    return base
  }

  return base.map((item) => ({
    ...item,
    descricao: texto.diagnosticos[item.codigo] ?? item.descricao,
  }))
}

export function traduzirExames(
  base: ExamCatalogItem[],
  texto: TextoDoCatalogo | undefined,
): ExamCatalogItem[] {
  if (!texto) {
    return base
  }

  return base.map((item) => ({ ...item, nome: texto.exames[item.id] ?? item.nome }))
}

function traduzirMedicamento(base: Medication, texto: TextoDoMedicamento): Medication {
  return {
    ...base,
    nome: texto.nome || base.nome,
    principioAtivo: texto.principioAtivo || base.principioAtivo,
    sinonimosDoPrincipio: sinonimosDoPrincipio(base.id, base.principioAtivo),
    apresentacao: texto.apresentacao || base.apresentacao,
    indicacoes: lista(base.indicacoes, texto.indicacoes),
    contraindicacoes: lista(base.contraindicacoes, texto.contraindicacoes),
    efeitosAdversos: lista(base.efeitosAdversos, texto.efeitosAdversos),
    interacoes: lista(base.interacoes, texto.interacoes),
    observacao: texto.observacao || base.observacao,
    /*
     * A nota é casada por espécie, não por posição: a ordem das faixas de dose é do arquivo de
     * conteúdo clínico e pode mudar quando alguém acrescenta uma espécie no meio.
     */
    doses: base.doses.map((dose) => {
      const nota = texto.notas?.[dose.especie]

      return nota ? { ...dose, nota } : dose
    }),
  }
}

export function traduzirMedicamentos(
  base: Medication[],
  texto: TextoDoCatalogo | undefined,
): Medication[] {
  /*
   * Em português não há o que traduzir, mas os sinônimos entram do mesmo jeito: o alerta de
   * alergia pode ter sido escrito em qualquer idioma, e é a tela em português que precisa
   * reconhecer "Allergy to amoxicillin" tanto quanto a inglesa reconhece o inverso.
   */
  return base.map((medicamento) => {
    const traduzido = texto?.medicamentos[medicamento.id]

    return traduzido
      ? traduzirMedicamento(medicamento, traduzido)
      : {
          ...medicamento,
          sinonimosDoPrincipio: sinonimosDoPrincipio(
            medicamento.id,
            medicamento.principioAtivo,
          ),
        }
  })
}
