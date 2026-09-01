/**
 * Store raiz do módulo clínico: catálogos, relógio da clínica e invalidação.
 *
 * A disciplina que importa neste domínio: **quase toda escrita mexe em mais de uma leitura**.
 * Marcar uma falta muda a grade do dia, a carga da semana, os horários livres, a fila de
 * espera e o painel de faltas. Por isso toda mutação chama `invalidarTudo()`, por um helper
 * único. Invalidar só o pedaço óbvio deixa metade da tela desatualizada — e é o tipo de bug
 * que ninguém percebe até a recepção marcar duas pessoas no mesmo horário.
 *
 * A exceção é o autosave do prontuário, que grava direto no registro em edição sem invalidar
 * nada; senão a tela pisca a cada pausa de digitação.
 */

import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import i18n from '@/i18n'
import type { Locale } from '@/i18n/locales'

import { CLINIC_UTC_OFFSET } from '../data/fixtures'
import { TEXTO_DO_CATALOGO } from '../data/fixtures/catalog-text'
import { catalogRepository, type CatalogosClinicos } from '../data/repositories'
import type {
  AppointmentType,
  Clinic,
  Diagnosis,
  DiagnosisCatalogItem,
  ExamCatalogItem,
  Medication,
  Pet,
  PetSpecies,
  Professional,
  ReferenceRange,
  Room,
  Tutor,
  VitalKey,
} from '../data/types'
import { patientRepository } from '../data/repositories'
import {
  traduzirDiagnosticos,
  traduzirExames,
  traduzirMedicamentos,
} from '../domain/catalog-i18n'
import { createClinicClock } from '../domain/clinic-time'
import { faixaEtariaDoPaciente, porteDoPaciente } from '../domain/porte'
import { encontrarFaixa } from '../domain/ranges'

export const clinicClock = createClinicClock(CLINIC_UTC_OFFSET)

/** Reexportado do domínio: a agenda já o importava daqui. */
export { CAPACIDADE_MINUTOS_POR_PROFISSIONAL } from '../domain/load'

export const useClinicoStore = defineStore('clinico', () => {
  const clinic = ref<Clinic | null>(null)
  const profissionais = ref<Professional[]>([])
  const salas = ref<Room[]>([])
  const tipos = ref<AppointmentType[]>([])
  /*
   * Bulário, diagnósticos e exames guardam o **português** e são traduzidos na leitura.
   *
   * A tradução mora aqui, e não em cada tela, porque o nome de um exame aparece em cinco
   * lugares — conduta, resumo, impressão, documento e painel — e traduzir na tela significa
   * cinco chances de esquecer um. Sendo computado, o catálogo inteiro também reage à troca de
   * idioma sem recarregar nada.
   */
  const medicamentosBase = ref<Medication[]>([])
  const diagnosticosBase = ref<DiagnosisCatalogItem[]>([])
  const examesBase = ref<ExamCatalogItem[]>([])
  const faixas = ref<ReferenceRange[]>([])

  const textoDoCatalogo = computed(
    () => TEXTO_DO_CATALOGO[i18n.global.locale.value as Locale],
  )

  const medicamentos = computed(() =>
    traduzirMedicamentos(medicamentosBase.value, textoDoCatalogo.value),
  )
  const diagnosticos = computed(() =>
    traduzirDiagnosticos(diagnosticosBase.value, textoDoCatalogo.value),
  )
  const exames = computed(() => traduzirExames(examesBase.value, textoDoCatalogo.value))
  const pets = ref<Pet[]>([])
  const tutores = ref<Tutor[]>([])

  const carregando = ref(false)
  const erro = ref('')
  const pronto = ref(false)

  /**
   * Contador de invalidação. Quem deriva dado do módulo observa isto e recarrega — é o
   * equivalente pobre e suficiente da invalidação central do React Query.
   */
  const revisao = ref(0)

  const petsPorId = computed(() => new Map(pets.value.map((pet) => [pet.id, pet])))
  const tutoresPorId = computed(() => new Map(tutores.value.map((tutor) => [tutor.id, tutor])))
  const profissionaisPorId = computed(
    () => new Map(profissionais.value.map((professional) => [professional.id, professional])),
  )
  const salasPorId = computed(() => new Map(salas.value.map((sala) => [sala.id, sala])))
  const tiposPorId = computed(() => new Map(tipos.value.map((tipo) => [tipo.id, tipo])))
  const medicamentosPorId = computed(
    () => new Map(medicamentos.value.map((medicamento) => [medicamento.id, medicamento])),
  )
  const diagnosticosPorCodigo = computed(
    () => new Map(diagnosticos.value.map((item) => [item.codigo, item.descricao])),
  )

  function aplicar(catalogos: CatalogosClinicos) {
    clinic.value = catalogos.clinic
    profissionais.value = catalogos.profissionais
    salas.value = catalogos.salas
    tipos.value = catalogos.tipos
    medicamentosBase.value = catalogos.medicamentos
    diagnosticosBase.value = catalogos.diagnosticos
    examesBase.value = catalogos.exames
    faixas.value = catalogos.faixas
  }

  async function carregar(forcar = false) {
    if (pronto.value && !forcar) {
      return
    }

    carregando.value = true
    erro.value = ''

    try {
      const catalogos = await catalogRepository.carregar()

      aplicar(catalogos)
      pets.value = patientRepository.todosOsPets()
      tutores.value = patientRepository.todosOsTutores()
      pronto.value = true
    } catch {
      erro.value = 'clinico.erros.catalogos'
    } finally {
      carregando.value = false
    }
  }

  /** Ponto único de invalidação. Toda mutação do módulo passa por aqui. */
  function invalidarTudo() {
    revisao.value += 1
  }

  function pet(petId: string): Pet | null {
    return petsPorId.value.get(petId) ?? null
  }

  function tutor(tutorId: string): Tutor | null {
    return tutoresPorId.value.get(tutorId) ?? null
  }

  function profissional(professionalId: string): Professional | null {
    return profissionaisPorId.value.get(professionalId) ?? null
  }

  function sala(roomId: string): Room | null {
    return salasPorId.value.get(roomId) ?? null
  }

  function tipo(typeId: string): AppointmentType | null {
    return tiposPorId.value.get(typeId) ?? null
  }

  function medicamento(medicationId: string): Medication | null {
    return medicamentosPorId.value.get(medicationId) ?? null
  }

  /**
   * Descrição do diagnóstico de um prontuário, no idioma da tela.
   *
   * O registro guarda o código **e** a descrição do momento em que foi lançado — é assim que um
   * diagnóstico permanece legível mesmo se o catálogo mudar depois. Só que uma descrição
   * congelada em português continuaria em português numa tela em inglês; por isso o catálogo
   * tem precedência, e o texto gravado fica de reserva para o código que o catálogo não conhece
   * (importado de outro sistema, digitado à mão, aposentado desde então).
   */
  function descricaoDoDiagnostico(diagnostico: { codigo: string; descricao: string }): string {
    return diagnosticosPorCodigo.value.get(diagnostico.codigo) ?? diagnostico.descricao
  }

  /**
   * Diagnóstico principal de um atendimento — o primeiro da lista, que é a ordem em que o
   * profissional os lançou. Vazio quando não há nenhum; quem chama decide o que mostrar no
   * lugar (a queixa principal, em geral).
   */
  function diagnosticoPrincipal(atendimento: { diagnosticos: Diagnosis[] }): string {
    const principal = atendimento.diagnosticos[0]

    return principal ? descricaoDoDiagnostico(principal) : ''
  }

  /**
   * Faixa de referência para uma espécie, sem qualificar porte nem idade.
   *
   * Continua existindo para quem só tem a espécie na mão. Quando há paciente, `faixaDoPaciente`
   * é o caminho certo — é ele que distingue o yorkshire do são-bernardo.
   */
  function faixaDe(vital: VitalKey, especie: PetSpecies): ReferenceRange | null {
    return encontrarFaixa(faixas.value, vital, especie)
  }

  /**
   * Faixa de referência do vital **para este paciente**, qualificada por porte e idade.
   *
   * A faixa etária é derivada aqui, do relógio da clínica, e não lida de campo: paciente que
   * envelhece só quando alguém edita a ficha julgaria o vital pela régua errada por anos.
   */
  function faixaDoPaciente(vital: VitalKey, pet: Pet | null): ReferenceRange | null {
    if (!pet) {
      return null
    }

    return encontrarFaixa(faixas.value, vital, pet.especie, {
      porte: porteDoPaciente(pet),
      faixaEtaria: faixaEtariaDoPaciente(pet, clinicClock.today()),
    })
  }

  /** Cor de coluna do profissional — índice, nunca literal: o token resolve claro e escuro. */
  function corDaColuna(professionalId: string): string {
    const indice = profissional(professionalId)?.corIndice ?? 0

    return `var(--clinic-col-${indice % 6})`
  }

  function $resetModulo() {
    pronto.value = false
    erro.value = ''
    invalidarTudo()
  }

  return {
    clinic,
    profissionais,
    salas,
    tipos,
    medicamentos,
    diagnosticos,
    exames,
    faixas,
    pets,
    tutores,
    carregando,
    erro,
    pronto,
    revisao,
    carregar,
    invalidarTudo,
    pet,
    tutor,
    profissional,
    sala,
    tipo,
    medicamento,
    descricaoDoDiagnostico,
    diagnosticoPrincipal,
    faixaDe,
    faixaDoPaciente,
    corDaColuna,
    $resetModulo,
  }
})
