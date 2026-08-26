/**
 * Bulário: o que o medicamento diz sobre **este** paciente.
 *
 * A função deste módulo não é listar remédio — é responder três perguntas que a tela precisa
 * fazer antes de deixar prescrever:
 *
 * 1. **Qual a dose desta espécie?** Uma faixa única de mg/kg trata gato como cachorro pequeno.
 *    Meloxicam felino de manutenção é um quinto do canino; carprofeno em gato não tem dose
 *    repetida segura. A faixa da espécie tem precedência sobre a faixa geral, sempre.
 * 2. **Algum alerta do prontuário encosta neste princípio ativo?** Alergia já era tratada; aqui
 *    entram também condição crônica renal, cardiopatia, gestação e idade.
 * 3. **A espécie é proibida?** Betalactâmico oral em roedor herbívoro e ivermectina em quelônio
 *    não são "dose alta": são contraindicação de espécie, e a tela precisa dizer isso.
 *
 * Nada aqui bloqueia a prescrição — a decisão é do responsável técnico. O que o módulo garante
 * é que ninguém decide **sem ver**.
 */

import type {
  Medication,
  MedicationCaution,
  MedicationDose,
  Pet,
  PetSpecies,
} from '../data/types'

/** Meses de vida abaixo dos quais o paciente conta como filhote para efeito de cuidado. */
const MESES_FILHOTE = 12
/** Anos de vida a partir dos quais o paciente conta como idoso. */
const ANOS_IDOSO = 8

export type BularioAviso = {
  kind: 'especie-proibida' | 'cuidado' | 'alergia' | 'sem-dose-da-especie'
  /** Cuidado específico quando `kind` é `cuidado`; nulo nos demais. */
  cuidado: MedicationCaution | null
  /** Texto já escrito na fixture — nota da espécie ou detalhe do alerta do paciente. */
  detalhe: string
}

/**
 * Faixa de dose da espécie do paciente, quando existe.
 *
 * Devolve `null` quando o bulário não traz a espécie: é diferente de "pode qualquer dose". A
 * tela mostra a faixa geral e avisa que ela não é específica.
 */
export function doseDaEspecie(
  medicamento: Medication,
  especie: PetSpecies,
): MedicationDose | null {
  return medicamento.doses.find((dose) => dose.especie === especie) ?? null
}

export function especieProibida(medicamento: Medication, especie: PetSpecies): boolean {
  return doseDaEspecie(medicamento, especie)?.proibido === true
}

/**
 * Dose inicial sugerida ao abrir a prescrição.
 *
 * É o **mínimo** da faixa da espécie, não a média nem o máximo: subir dose é decisão
 * consciente, e começar pelo teto transforma o campo pré-preenchido em recomendação.
 */
export function sugestaoDePrescricao(medicamento: Medication, pet: Pet | null) {
  const dose = pet ? doseDaEspecie(medicamento, pet.especie) : null

  if (!dose || dose.proibido) {
    return {
      mgPorKg: medicamento.doseUsualMgKg.min,
      frequenciaHoras: 12,
      duracaoDias: 7,
    }
  }

  return {
    mgPorKg: dose.mgPorKg.min,
    frequenciaHoras: dose.frequenciaHoras,
    duracaoDias: Math.max(1, dose.duracaoUsualDias),
  }
}

/** Nulo quando o cadastro não traz a data — diferente de "recém-nascido". */
export function idadeEmMeses(pet: Pet, hoje: Date): number | null {
  if (!pet.nascimento) {
    return null
  }

  const nascimento = new Date(`${pet.nascimento}T00:00:00Z`)
  const meses =
    (hoje.getUTCFullYear() - nascimento.getUTCFullYear()) * 12 +
    (hoje.getUTCMonth() - nascimento.getUTCMonth())

  return Math.max(0, meses)
}

/**
 * Casa os cuidados do medicamento com o que o prontuário sabe do paciente.
 *
 * O encontro é por **texto do alerta**, não por código: a clínica escreve "Doença renal
 * crônica" no alerta, e é essa palavra que liga ao cuidado `renal` do bulário. Um dicionário de
 * termos por cuidado é grosseiro de propósito — errar para mais aqui custa um aviso a mais na
 * tela; errar para menos custa uma prescrição sem conferência.
 */
const TERMOS: Record<MedicationCaution, string[]> = {
  gestante: ['gestante', 'gestação', 'prenhez'],
  lactante: ['lactante', 'amamentando', 'lactação'],
  filhote: ['filhote', 'neonato'],
  idoso: ['idoso', 'geriátrico'],
  renal: ['renal', 'rim', 'nefro', 'creatinina'],
  hepatico: ['hepát', 'fígado', 'figado'],
  cardiaco: ['cardio', 'cardíac', 'cardiac', 'valva', 'insuficiência cardíaca'],
  gastrico: ['gástric', 'gastric', 'úlcera', 'ulcera', 'gastrite'],
}

function alertaCasaComCuidado(texto: string, cuidado: MedicationCaution): boolean {
  const normalizado = texto.toLowerCase()

  return TERMOS[cuidado].some((termo) => normalizado.includes(termo))
}

/**
 * Todos os avisos que a tela precisa mostrar para este par medicamento × paciente.
 *
 * A ordem é de gravidade: espécie proibida primeiro, alergia depois, cuidados por último.
 */
export function avisosDoMedicamento(
  medicamento: Medication,
  pet: Pet | null,
  hoje: Date,
): BularioAviso[] {
  if (!pet) {
    return []
  }

  const avisos: BularioAviso[] = []
  const dose = doseDaEspecie(medicamento, pet.especie)

  if (dose?.proibido) {
    avisos.push({
      kind: 'especie-proibida',
      cuidado: null,
      detalhe: dose.nota ?? '',
    })
  } else if (!dose) {
    avisos.push({ kind: 'sem-dose-da-especie', cuidado: null, detalhe: '' })
  }

  const principio = medicamento.principioAtivo.trim().toLowerCase()
  const alergia = pet.alertas.find(
    (alerta) => alerta.kind === 'alergia' && alerta.detalhe.toLowerCase().includes(principio),
  )

  if (alergia) {
    avisos.push({ kind: 'alergia', cuidado: null, detalhe: alergia.detalhe })
  }

  const meses = idadeEmMeses(pet, hoje)

  for (const cuidado of medicamento.cuidados) {
    /*
     * Filhote e idoso saem da data de nascimento; os demais, do texto dos alertas. Sem data, o
     * módulo **não afirma nem nega** — cuidado inventado a partir de idade desconhecida é pior
     * que cuidado ausente, porque parece conferido.
     */
    if (cuidado === 'filhote' && meses !== null && meses < MESES_FILHOTE) {
      avisos.push({ kind: 'cuidado', cuidado, detalhe: '' })
      continue
    }

    if (cuidado === 'idoso' && meses !== null && meses >= ANOS_IDOSO * 12) {
      avisos.push({ kind: 'cuidado', cuidado, detalhe: '' })
      continue
    }

    const alerta = pet.alertas.find(
      (item) =>
        item.kind !== 'alergia' && alertaCasaComCuidado(item.detalhe || item.kind, cuidado),
    )

    if (alerta) {
      avisos.push({ kind: 'cuidado', cuidado, detalhe: alerta.detalhe })
    }
  }

  return avisos
}

export type BularioFiltro = {
  busca: string
  classes: string[]
  /** Só os que têm faixa de dose para esta espécie. */
  especie: PetSpecies | null
  /** Só os de receituário de controle especial. */
  somenteControlados: boolean
}

export const FILTRO_VAZIO: BularioFiltro = {
  busca: '',
  classes: [],
  especie: null,
  somenteControlados: false,
}

/**
 * Busca por nome comercial, princípio ativo **e indicação**.
 *
 * A indicação entra de propósito: quem está com um cão com otite procura "otite", não
 * "enrofloxacina". Bulário que só casa pelo nome do remédio serve a quem já sabe a resposta.
 */
export function filtrarMedicamentos(
  medicamentos: Medication[],
  filtro: BularioFiltro,
): Medication[] {
  const busca = filtro.busca.trim().toLowerCase()

  return medicamentos.filter((medicamento) => {
    if (filtro.somenteControlados && !medicamento.controlado) {
      return false
    }

    if (filtro.classes.length > 0 && !filtro.classes.includes(medicamento.classe)) {
      return false
    }

    if (filtro.especie && !doseDaEspecie(medicamento, filtro.especie)) {
      return false
    }

    if (!busca) {
      return true
    }

    return (
      medicamento.nome.toLowerCase().includes(busca) ||
      medicamento.principioAtivo.toLowerCase().includes(busca) ||
      medicamento.indicacoes.some((indicacao) => indicacao.toLowerCase().includes(busca))
    )
  })
}
