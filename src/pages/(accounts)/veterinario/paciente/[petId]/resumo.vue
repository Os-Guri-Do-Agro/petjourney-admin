<script setup lang="ts">
/**
 * Este pet em 30 segundos — o que o vet lê antes de entrar na sala.
 *
 * O critério de pronto é cronometrado: alguém que nunca viu o paciente entende a situação dele
 * em menos de trinta segundos. A página é organizada na ordem dessa leitura:
 *
 * 1. **Quem é** — a capa da ficha (`FichaCabeca`), com a ação da vez à direita (abrir o
 *    atendimento) e a frase que diz o veredito: quantos sinais, ou "nada fora do comum".
 * 2. **O que chama atenção** — os sinais numa faixa de avisos, risco primeiro, cada um com a
 *    marca e a palavra da gravidade.
 * 3. **Quando ele entra** — a consulta de hoje, com a hora grande.
 * 4. **O que aconteceu em casa** (diário e remédio de casa), à esquerda, e **o essencial do
 *    prontuário** com **para onde vai o peso**, à direita.
 *
 * Redesenho total (19/10/2026): a página saiu do `PartnerPageFrame` para o `UiPagina`, volta a
 * "Pacientes" pelo `#voltar`, e os blocos viraram seções com o título no fundo e o conteúdo numa
 * folha — nada de cartão dentro de cartão. No acabamento de 20/10/2026 cada bloco virou um cartão
 * com cabeçalho próprio (ladrilho, título, ação), e a consulta de hoje ganhou a marca do lugar.
 *
 * O botão de abrir o atendimento leva o resumo junto: a anamnese já abre com o que o diário
 * registrou, as medicações em uso e as alergias — só nos campos ainda vazios. Quem assina o
 * prontuário continua sendo o vet, e o texto diz de onde veio.
 */
import Button from 'primevue/button'
import ToggleSwitch from 'primevue/toggleswitch'
import { computed, onMounted, ref, useId, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRoute, useRouter } from 'vue-router'

import UiPagina from '@/components/ui/UiPagina.vue'
import FichaCabeca from '@/features/clinico/components/pacientes/ficha/FichaCabeca.vue'
import ResumoEmCasa from '@/features/clinico/components/pacientes/resumo/ResumoEmCasa.vue'
import ResumoEssencial from '@/features/clinico/components/pacientes/resumo/ResumoEssencial.vue'
import ResumoPeso from '@/features/clinico/components/pacientes/resumo/ResumoPeso.vue'
import ResumoPrimeiraConsulta from '@/features/clinico/components/pacientes/resumo/ResumoPrimeiraConsulta.vue'
import ResumoSinais from '@/features/clinico/components/pacientes/resumo/ResumoSinais.vue'
import ResumoTratamentos from '@/features/clinico/components/pacientes/resumo/ResumoTratamentos.vue'
import { useClinicFormat } from '@/features/clinico/composables/useClinicFormat'
import { useClinicPrefs } from '@/features/clinico/composables/useClinicPrefs'
import { useRotulosDoDiario } from '@/features/clinico/composables/useRotulosDoDiario'
import { useRotulosDoTratamento } from '@/features/clinico/composables/useRotulosDoTratamento'
import { patientRepository } from '@/features/clinico/data/repositories'
import type { Anamnese, Antecedente, Appointment, Pet, Tutor } from '@/features/clinico/data/types'
import {
  apetiteDaAnamnese,
  evacuacaoDaAnamnese,
  miccaoDaAnamnese,
} from '@/features/clinico/domain/pre-consulta'
import {
  montarResumoDoPaciente,
  ultimoDoCampo,
  type ResumoDoPaciente,
} from '@/features/clinico/domain/resumo-do-paciente'
import { clinicClock, useClinicoStore } from '@/features/clinico/stores/clinico'
import { useProntuarioStore } from '@/features/clinico/stores/prontuario'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const clinico = useClinicoStore()
const prontuario = useProntuarioStore()
const formato = useClinicFormat()
const rotulos = useRotulosDoDiario()
const rotulosDoTratamento = useRotulosDoTratamento()
/** A sugestão do histórico se religa aqui: é onde quem a desligou vem procurar. */
const { sugerirResumo } = useClinicPrefs()
const idDaPreferencia = useId()

const pet = ref<Pet | null>(null)
const tutor = ref<Tutor | null>(null)
const resumo = ref<ResumoDoPaciente | null>(null)
const atendimentoDeHoje = ref<Appointment | null>(null)
const carregando = ref(false)
const erro = ref('')
const abrindo = ref(false)
const erroAoAbrir = ref('')

const petId = computed(() => String(route.params.petId ?? ''))

async function carregar() {
  carregando.value = true
  erro.value = ''

  try {
    await clinico.carregar()

    const [dados, fonte] = await Promise.all([
      patientRepository.obter(petId.value),
      patientRepository.paraOResumo(petId.value),
    ])

    pet.value = dados?.pet ?? null
    tutor.value = dados?.tutor ?? null
    atendimentoDeHoje.value = fonte.atendimentoDeHoje
    resumo.value = dados
      ? montarResumoDoPaciente({
          pet: dados.pet,
          consultas: fonte.consultas,
          diario: fonte.diario,
          tratamentos: fonte.tratamentos,
          agora: fonte.agora,
        })
      : null
  } catch {
    erro.value = t('clinico.erros.prontuario')
  } finally {
    carregando.value = false
  }
}

const perdaEmRisco = computed(
  () =>
    resumo.value?.sinais.some(
      (sinal) => sinal.tipo === 'perda-de-peso' && sinal.severidade === 'risco',
    ) ?? false,
)

/**
 * O estado do resumo numa frase, no lugar da saudação da Visão geral: quantos sinais pedem atenção,
 * ou que não há nada fora do comum. Primeira vez é o caso próprio — sem consulta anterior, não há
 * "desde a última consulta" para comparar.
 */
const frase = computed(() => {
  const dados = resumo.value

  if (!dados) {
    return ''
  }

  if (dados.sinais.length > 0) {
    return t('clinico.ficha.resumo.sinais', { total: dados.sinais.length }, dados.sinais.length)
  }

  return dados.primeiraVez ? t('clinico.ficha.resumo.primeiraVez') : t('clinico.ficha.resumo.nada')
})

const mostrarDiario = computed(
  () =>
    resumo.value !== null &&
    (!resumo.value.primeiraVez ||
      resumo.value.diario.entradas.length > 0 ||
      !resumo.value.diario.liberado),
)

const mostrarPeso = computed(
  () => resumo.value !== null && (!resumo.value.primeiraVez || resumo.value.peso.serie.length > 0),
)

/** A consulta de hoje: a hora grande e, ao lado, o que é e com quem. */
const consultaDeHoje = computed(() => {
  const appointment = atendimentoDeHoje.value

  if (!appointment) {
    return null
  }

  return {
    hora: formato.hora(appointment.inicio),
    descricao: [
      clinico.tipo(appointment.typeId)?.nome,
      clinico.profissional(appointment.professionalId)?.nome,
    ]
      .filter(Boolean)
      .join(' · '),
  }
})

// ------------------------------------------------------------------ anamnese

function kg(valor: number): string {
  return formato.numero(valor, Number.isInteger(Math.round(valor * 100) / 10) ? 1 : 2)
}

/**
 * O parágrafo que entra na história da anamnese.
 *
 * Começa dizendo de onde veio — "do Diário Pet, registrado pelo responsável" — porque o vet vai
 * assinar em cima dele, e texto sem procedência vira afirmação da clínica. Só o que tem
 * alteração entra; "tudo normal" vira uma frase só.
 */
function historiaDoDiario(dados: ResumoDoPaciente): string {
  const diario = dados.diario

  if (diario.entradas.length === 0) {
    return ''
  }

  const linhas: string[] = []

  for (const sinal of dados.sinais) {
    if (sinal.tipo === 'perda-de-peso') {
      linhas.push(
        t('clinico.resumoDoPaciente.anamnese.perda', {
          de: kg(sinal.variacao.deKg),
          para: kg(sinal.variacao.paraKg),
          percentual: formato.numero(sinal.variacao.percentual, 1),
          semanas: sinal.variacao.semanas,
        }),
      )
    }

    if (sinal.tipo === 'alarme') {
      const achados = rotulos.lista(sinal.achados.map(rotulos.achado)).toLocaleLowerCase()
      const relato = [sinal.relato, sinal.texto].filter(Boolean).join(' — ')

      linhas.push(
        relato
          ? t('clinico.resumoDoPaciente.anamnese.alarme', {
              sintomas: achados,
              data: formato.dataCurta(clinicClock.dateOf(sinal.em)),
              nota: relato,
            })
          : t('clinico.resumoDoPaciente.anamnese.alarmeSemTexto', {
              sintomas: achados,
              data: formato.dataCurta(clinicClock.dateOf(sinal.em)),
            }),
      )
    }
  }

  if (diario.peso) {
    linhas.push(
      t('clinico.resumoDoPaciente.anamnese.pesoCasa', {
        de: kg(diario.peso.deKg),
        para: kg(diario.peso.paraKg),
      }),
    )
  }

  for (const contagem of diario.campos) {
    if (contagem.alterados > 0 && contagem.predominante) {
      linhas.push(
        t('clinico.resumoDoPaciente.anamnese.campo', {
          campo: rotulos.campo(contagem.campo).toLocaleLowerCase(),
          valor: rotulos.valor(contagem.campo, contagem.predominante).toLocaleLowerCase(),
          alterados: contagem.alterados,
          total: contagem.total,
        }),
      )
    }
  }

  const comuns = diario.sintomas.filter((item) => !item.alarme)

  if (comuns.length > 0) {
    linhas.push(
      t('clinico.resumoDoPaciente.anamnese.sintomas', {
        lista: comuns
          .map((item) => `${rotulos.sintoma(item.sintoma).toLocaleLowerCase()} (${item.vezes}×)`)
          .join(', '),
      }),
    )
  }

  if (diario.doencas.length > 0) {
    linhas.push(
      t('clinico.resumoDoPaciente.anamnese.doencas', {
        lista: diario.doencas
          .map((item) => rotulos.doenca(item.doenca).toLocaleLowerCase())
          .join(', '),
      }),
    )
  }

  const cabecalho = t('clinico.resumoDoPaciente.anamnese.cabecalho', {
    data: formato.dataCurta(clinicClock.dateOf(diario.desde)),
    total: diario.entradas.length,
  })

  if (linhas.length === 0) {
    return `${cabecalho} ${t('clinico.resumoDoPaciente.anamnese.semAlteracao')}`
  }

  return [cabecalho, ...linhas.map((linha) => `- ${linha}`)].join('\n')
}

/** Só acrescenta: campo que alguém já preencheu fica como está. */
function preencherAnamnese(atual: Anamnese, dados: ResumoDoPaciente): Partial<Anamnese> {
  const acrescimo: Partial<Anamnese> = {}
  const historia = historiaDoDiario(dados)

  if (historia && !atual.historia.trim()) {
    acrescimo.historia = historia
  }

  /*
   * O último registro de cada campo, traduzido para o vocabulário da anamnese — o mesmo mapa da
   * pré-consulta. O que não tem tradução (fezes com sangue) fica fora: já está na história, e o
   * vet decide.
   */
  const { campos } = dados.diario
  const apetite = apetiteDaAnamnese(ultimoDoCampo(campos, 'alimentacao'))
  const evacuacao = evacuacaoDaAnamnese(ultimoDoCampo(campos, 'fezes'))
  const miccao = miccaoDaAnamnese(ultimoDoCampo(campos, 'urina'))

  if (!atual.apetite && apetite) {
    acrescimo.apetite = apetite
  }

  if (!atual.evacuacao && evacuacao) {
    acrescimo.evacuacao = evacuacao
  }

  if (!atual.miccao && miccao) {
    acrescimo.miccao = miccao
  }

  const jaListados = new Set(atual.antecedentes.map((item) => item.descricao.trim().toLowerCase()))
  const novos: Antecedente[] = []

  const acrescentar = (kind: Antecedente['kind'], descricao: string) => {
    if (descricao && !jaListados.has(descricao.trim().toLowerCase())) {
      jaListados.add(descricao.trim().toLowerCase())
      novos.push({ id: `ant-resumo-${novos.length + 1}`, kind, descricao, quando: '' })
    }
  }

  for (const medicacao of dados.medicacoes) {
    if (medicacao.origem === 'continua') {
      acrescentar('medicacao-continua', medicacao.descricao)
      continue
    }

    const prescricao = t('clinico.resumoDoPaciente.anamnese.prescricao', {
      nome: clinico.medicamento(medicacao.medicamentoId)?.nome ?? medicacao.medicamentoId,
      data: medicacao.ate
        ? formato.dataCurta(clinicClock.dateOf(medicacao.ate))
        : t('clinico.resumoDoPaciente.essencial.usoContinuo'),
    })

    /*
     * Com lembrete no app, a adesão vai junto, com a procedência: é o dado que responde "foi
     * dado?" antes da pergunta, e o vet assina em cima sabendo de onde ele veio.
     */
    const emCasa = dados.tratamentos.find(
      (item) =>
        item.medicamentoId === medicacao.medicamentoId &&
        item.compartilhado &&
        item.periodo.fechadas > 0,
    )

    acrescentar(
      'medicacao-continua',
      emCasa
        ? t('clinico.resumoDoPaciente.anamnese.prescricaoComAdesao', {
            prescricao,
            data: formato.dataCurta(clinicClock.dateOf(emCasa.periodo.desde)),
            contagem: rotulosDoTratamento.contagem(emCasa.periodo),
          })
        : prescricao,
    )
  }

  for (const alerta of dados.alertas.filter((item) => item.kind === 'alergia')) {
    acrescentar('alergia', alerta.detalhe)
  }

  if (novos.length > 0) {
    acrescimo.antecedentes = [...atual.antecedentes, ...novos]
  }

  return acrescimo
}

async function abrirAtendimento() {
  const appointment = atendimentoDeHoje.value
  const dados = resumo.value

  if (!appointment || !dados || abrindo.value) {
    return
  }

  abrindo.value = true
  erroAoAbrir.value = ''

  const encounterId = await prontuario.abrirComAnamnese(appointment.id, (atual) =>
    preencherAnamnese(atual, dados),
  )

  abrindo.value = false

  if (!encounterId) {
    erroAoAbrir.value = t('clinico.resumoDoPaciente.erroAoAbrir')

    return
  }

  void router.push({
    path: `/veterinario/atendimento/${encounterId}`,
    query: { etapa: 'anamnese' },
  })
}

onMounted(carregar)
watch(petId, carregar)
</script>

<template>
  <UiPagina
    :titulo="pet?.nome ?? t('clinico.resumoDoPaciente.titulo')"
    :carregando="carregando && !pet"
    :erro="erro"
    :vazio="!carregando && !erro && !pet"
    :vazio-titulo="t('clinico.resumoDoPaciente.naoEncontrado')"
    vazio-icone="ph ph-paw-print"
    bloquear-se-suspenso
    @tentar-de-novo="carregar"
  >
    <template #voltar>
      <RouterLink to="/veterinario/pacientes" class="voltar">
        <i class="ph ph-arrow-left" aria-hidden="true" />
        {{ t('clinico.pacientes.titulo') }}
      </RouterLink>
    </template>

    <template v-if="pet" #cabecalho>
      <FichaCabeca :pet="pet" :tutor="tutor" atual="resumo" :frase="frase">
        <template v-if="atendimentoDeHoje" #acoes>
          <Button
            type="button"
            icon="ph ph-stethoscope"
            :label="t('clinico.resumoDoPaciente.abrirAtendimento')"
            :loading="abrindo"
            @click="abrirAtendimento"
          />
        </template>
      </FichaCabeca>
    </template>

    <div v-if="pet && resumo" class="resumo">
      <p v-if="erroAoAbrir" class="resumo__erro" role="alert">
        <i class="ph ph-warning-circle" aria-hidden="true" />
        {{ erroAoAbrir }}
      </p>

      <!-- O que chama atenção vem primeiro: uma faixa de avisos, risco no alto. -->
      <ResumoSinais v-if="resumo.sinais.length > 0" :sinais="resumo.sinais" />

      <!-- Quando ele entra: a hora grande, e o que o botão da capa vai abrir. -->
      <section
        v-if="consultaDeHoje"
        class="hoje ui-folha ui-marca ui-marca--lugar"
        :aria-label="t('clinico.ficha.resumo.consultaDeHoje')"
      >
        <span class="ui-ladrilho ui-ladrilho--g" aria-hidden="true">
          <i class="ph ph-calendar-check" />
        </span>
        <span class="hoje__hora">
          <strong class="ui-num">{{ consultaDeHoje.hora }}</strong>
          <small>{{ t('clinico.ficha.resumo.hoje') }}</small>
        </span>
        <span class="hoje__texto">
          <strong>{{ consultaDeHoje.descricao }}</strong>
          <span>{{ t('clinico.ficha.resumo.dica') }}</span>
        </span>
      </section>

      <div class="resumo__corpo">
        <div class="resumo__coluna">
          <ResumoPrimeiraConsulta v-if="resumo.primeiraVez" :pet="pet" />
          <ResumoEmCasa
            v-if="mostrarDiario"
            :diario="resumo.diario"
            :tem-consulta="!resumo.primeiraVez"
          />
          <ResumoTratamentos
            v-if="resumo.tratamentos.length > 0"
            :pet-id="pet.id"
            :tratamentos="resumo.tratamentos"
          />
        </div>

        <div class="resumo__coluna resumo__lado">
          <ResumoEssencial :resumo="resumo" />
          <ResumoPeso v-if="mostrarPeso" :peso="resumo.peso" :em-risco="perdaEmRisco" />
        </div>
      </div>

      <div class="resumo__preferencia ui-poco">
        <ToggleSwitch v-model="sugerirResumo" :input-id="idDaPreferencia" />
        <label :for="idDaPreferencia">{{ t('clinico.resumoDoPaciente.preferencia') }}</label>
      </div>
    </div>
  </UiPagina>
</template>

<style scoped>
.voltar .ph {
  font-size: 13px;
}

[dir='rtl'] .voltar .ph {
  scale: -1 1;
}

/* As colunas são decididas pela largura do conteúdo, não da janela. */
.resumo {
  display: grid;
  gap: 24px;
  container-type: inline-size;
}

.resumo__erro {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0;
  padding: 12px 16px;
  border-radius: 12px;
  background: var(--risco-fundo);
  color: var(--risco-tinta);
  font-size: 14px;
  font-weight: 550;
}

.resumo__erro i {
  flex: none;
  font-size: 18px;
}

/* ------------------------------------------------------------------ a consulta de hoje */

.hoje {
  position: relative;
  display: flex;
  align-items: center;
  gap: 18px;
  padding: 16px 22px;
}

.hoje__hora {
  display: grid;
  flex: none;
  justify-items: start;
  line-height: 1.05;
}

.hoje__hora strong {
  color: var(--pj-lugar-tinta, var(--tinta));
  font-size: 28px;
  font-weight: 650;
  letter-spacing: -0.02em;
}

.hoje__hora small {
  color: var(--tinta-2);
  font-size: 12px;
}

.hoje__texto {
  display: grid;
  min-width: 0;
  gap: 2px;
  padding-inline-start: 18px;
  border-inline-start: 1px solid var(--linha);
}

.hoje__texto strong {
  color: var(--tinta);
  font-size: 15px;
  font-weight: 600;
  line-height: 1.35;
}

.hoje__texto span {
  color: var(--tinta-2);
  font-size: 13.5px;
  line-height: 1.4;
}

/* ------------------------------------------------------------------ as duas colunas */

.resumo__corpo {
  display: grid;
  align-items: start;
  gap: 24px;
}

.resumo__coluna {
  display: grid;
  min-width: 0;
  align-content: start;
  gap: 24px;
}

/* O essencial ao lado, mais estreito; em uma coluna, ele sobe — é mais curto e responde antes. */
@container (min-width: 880px) {
  .resumo__corpo {
    grid-template-columns: minmax(0, 1fr) minmax(330px, 400px);
  }
}

@container (max-width: 879px) {
  .resumo__lado {
    order: -1;
  }
}

.resumo__preferencia {
  display: flex;
  align-items: center;
  gap: 10px;
  justify-self: start;
  padding: 10px 16px 10px 12px;
  color: var(--tinta-2);
  font-size: 13.5px;
}

.resumo__preferencia label {
  cursor: pointer;
}

@media (max-width: 520px) {
  .hoje {
    flex-wrap: wrap;
  }

  .hoje__texto {
    flex-basis: 100%;
    padding-inline-start: 0;
    border-inline-start: 0;
  }
}
</style>
