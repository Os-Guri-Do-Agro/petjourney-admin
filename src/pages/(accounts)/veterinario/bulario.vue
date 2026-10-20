<script setup lang="ts">
/**
 * Bulário eletrônico.
 *
 * Lista à esquerda, ficha à direita. O padrão mestre-detalhe existe aqui por um motivo prático:
 * consultar bula é comparar — "qual dos dois antibióticos serve para este caso" — e navegar
 * para uma página por medicamento perde a lista a cada volta.
 *
 * A tela aceita `?paciente=` na URL. Aberta a partir de um atendimento, ela carrega o paciente e
 * a ficha passa a mostrar os avisos dele e a destacar a dose da espécie certa. Sem o parâmetro,
 * é um bulário de consulta comum.
 *
 * ## A forma (redesenho de 19/10/2026)
 *
 * A frase de estado diz o que esta consulta é: o bulário inteiro, ou a consulta **para um
 * paciente** — e, nesse caso, que a lista abriu filtrada pela espécie dele e que a ficha traz a
 * dose calculada para o peso. O paciente aparece logo abaixo, na capa compacta da casa, com a
 * saída ("Sair do paciente") ao lado do peso, que é de onde sai a dose.
 *
 * Embaixo, duas colunas: a lista com a busca grande e os filtros, e a ficha, presa ao lado
 * enquanto a lista rola. Em tela estreita a ficha desce para baixo da lista, e escolher um
 * remédio leva a página até ela.
 */
import Button from 'primevue/button'
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import UiPagina from '@/components/ui/UiPagina.vue'
import ClinicPatientHeader from '@/features/clinico/components/base/ClinicPatientHeader.vue'
import BularioDetalhe from '@/features/clinico/components/bulario/BularioDetalhe.vue'
import BularioLista from '@/features/clinico/components/bulario/BularioLista.vue'
import { useClinicFormat } from '@/features/clinico/composables/useClinicFormat'
import { patientRepository } from '@/features/clinico/data/repositories'
import type { Medication, Pet, Tutor } from '@/features/clinico/data/types'
import { FILTRO_VAZIO, type BularioFiltro } from '@/features/clinico/domain/bulario'
import { useClinicoStore } from '@/features/clinico/stores/clinico'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const clinico = useClinicoStore()
const formato = useClinicFormat()

const filtro = ref<BularioFiltro>({ ...FILTRO_VAZIO })
const selecionadoId = ref<string | null>(null)
const pet = ref<Pet | null>(null)
const tutor = ref<Tutor | null>(null)
const carregando = ref(false)
const erro = ref('')
const ficha = ref<HTMLElement | null>(null)

const petIdDaRota = computed(() => {
  const valor = route.query.paciente

  return typeof valor === 'string' && valor ? valor : null
})

const selecionado = computed(
  () => clinico.medicamentos.find((item) => item.id === selecionadoId.value) ?? null,
)

/** O que esta consulta é: o bulário inteiro, ou a consulta para um paciente — com ou sem peso. */
const fraseDoResumo = computed(() => {
  if (carregando.value && clinico.medicamentos.length === 0) {
    return ''
  }

  if (pet.value) {
    return pet.value.pesoKg !== null && pet.value.pesoKg > 0
      ? t('clinico.bulario.resumo.paciente', {
          pet: pet.value.nome,
          peso: formato.peso(pet.value.pesoKg),
        })
      : t('clinico.bulario.resumo.pacienteSemPeso', { pet: pet.value.nome })
  }

  const total = clinico.medicamentos.length

  return t('clinico.bulario.resumo.geral', { total }, total)
})

async function carregar() {
  carregando.value = true
  erro.value = ''

  try {
    await clinico.carregar()

    /** Abrir com a ficha vazia desperdiça metade da tela; o primeiro da lista já ensina o formato. */
    selecionadoId.value ??= clinico.medicamentos[0]?.id ?? null

    if (petIdDaRota.value) {
      const dados = await patientRepository.obter(petIdDaRota.value)

      pet.value = dados?.pet ?? null
      tutor.value = dados?.tutor ?? null

      /** Com paciente na tela, a lista já abre limitada ao que tem dose para a espécie dele. */
      if (pet.value) {
        filtro.value = { ...filtro.value, especie: pet.value.especie }
      }
    } else {
      pet.value = null
      tutor.value = null
    }
  } catch {
    erro.value = t('clinico.erros.catalogos')
  } finally {
    carregando.value = false
  }
}

/**
 * Em tela estreita a ficha fica embaixo da lista, fora da vista de quem tocou no remédio: a página
 * desce até ela. Lado a lado ela já está à vista, e nada se mexe.
 */
async function mostrarFicha() {
  await nextTick()

  const alvo = ficha.value

  if (!alvo) {
    return
  }

  /* Presa ao lado da lista, a ficha rola dentro de si: o remédio novo começa do nome. */
  alvo.scrollTop = 0

  if (alvo.getBoundingClientRect().top < window.innerHeight - 160) {
    return
  }

  const calmo = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

  alvo.scrollIntoView({ behavior: calmo ? 'auto' : 'smooth', block: 'start' })
}

function selecionar(medicamento: Medication) {
  selecionadoId.value = medicamento.id
  void mostrarFicha()
}

function limparPaciente() {
  void router.replace({ path: '/veterinario/bulario' })
}

watch(petIdDaRota, carregar)

onMounted(carregar)
</script>

<template>
  <UiPagina
    class="tela-bulario"
    :carregando="carregando && clinico.medicamentos.length === 0"
    :erro="erro"
    bloquear-se-suspenso
    @tentar-de-novo="carregar"
  >
    <template v-if="fraseDoResumo" #resumo>
      <span aria-live="polite">{{ fraseDoResumo }}</span>
    </template>

    <div class="bulario">
      <!-- O paciente da consulta: é dele a espécie da lista e o peso da dose. -->
      <ClinicPatientHeader v-if="pet" class="bulario__paciente" :pet="pet" :tutor="tutor">
        <template #acoes>
          <Button
            type="button"
            severity="secondary"
            outlined
            size="small"
            icon="ph ph-x"
            :label="t('clinico.bulario.semPaciente')"
            @click="limparPaciente"
          />
        </template>
      </ClinicPatientHeader>

      <div class="bulario__corpo">
        <section class="bulario__lista" :aria-label="t('clinico.bulario.titulo')">
          <BularioLista
            :medicamentos="clinico.medicamentos"
            :filtro="filtro"
            :selecionado-id="selecionadoId"
            :pet="pet"
            @update:filtro="filtro = $event"
            @selecionar="selecionar"
          />
        </section>

        <section ref="ficha" class="bulario__ficha ui-folha">
          <BularioDetalhe
            v-if="selecionado"
            :medicamento="selecionado"
            :pet="pet"
            com-dose-do-peso
          />
          <div v-else class="bulario__vazio">
            <span class="bulario__vazio-icone" aria-hidden="true">
              <i class="ph ph-book-open" />
            </span>
            <p>{{ t('clinico.bulario.escolha') }}</p>
          </div>
        </section>
      </div>
    </div>
  </UiPagina>
</template>

<style scoped>
.bulario {
  display: grid;
  gap: 20px;
  container: bulario / inline-size;
}

.bulario__corpo {
  display: grid;
  align-items: start;
  gap: 24px;
  grid-template-columns: minmax(0, 1fr);
}

.bulario__lista {
  min-width: 0;
}

.bulario__ficha {
  min-width: 0;
  padding: 26px 28px 24px;
  scroll-margin-top: 16px;
}

/* Lado a lado quando cabe: a lista à esquerda, a ficha presa ao lado enquanto a lista rola. */
@container bulario (min-width: 860px) {
  .bulario__corpo {
    grid-template-columns: minmax(320px, 400px) minmax(0, 1fr);
  }

  /*
   * A ficha rola dentro de si. A sombra no pé só aparece quando ainda há conteúdo embaixo: a capa
   * de fundo rola junto com o texto (`local`) e cobre a sombra (`scroll`) quando se chega ao fim.
   */
  /*
   * Em tela larga quem rola é a folha (`main#conteudo`), com a fita do dia fora dela: o topo da
   * ficha presa é o respiro da folha, e a altura é a da janela menos a fita e esse respiro.
   */
  .bulario__corpo > .bulario__ficha {
    position: sticky;
    top: 16px;
    max-height: calc(100dvh - 128px);
    overflow-y: auto;
    background:
      linear-gradient(transparent, var(--superficie) 70%) center bottom / 100% 36px no-repeat local,
      radial-gradient(
          farthest-side at 50% 100%,
          color-mix(in oklab, var(--tinta) 16%, transparent),
          transparent
        )
        center bottom / 100% 14px no-repeat scroll,
      var(--superficie);
    overscroll-behavior: contain;
  }
}

/* Nada escolhido ainda: centrado, o ladrilho do assunto e a frase. */
.bulario__vazio {
  display: grid;
  justify-items: center;
  gap: 10px;
  padding: 48px 16px;
  text-align: center;
}

.bulario__vazio-icone {
  display: grid;
  width: 44px;
  height: 44px;
  place-items: center;
  border-radius: 13px;
  background: var(--pj-lugar-fundo, var(--superficie-2));
  color: var(--pj-lugar-tinta, var(--tinta-2));
  font-size: 22px;
}

.bulario__vazio p {
  margin: 0;
  color: var(--tinta-2);
  font-size: 14px;
}

@media (max-width: 900px) {
  .bulario__ficha {
    scroll-margin-top: 124px;
  }
}

@media (max-width: 760px) {
  .bulario__ficha {
    padding: 18px 16px;
  }
}
</style>
