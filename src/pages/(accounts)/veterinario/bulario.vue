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
 */
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import PartnerPageFrame from '@/components/parceiro/PartnerPageFrame.vue'
import ClinicPatientHeader from '@/features/clinico/components/base/ClinicPatientHeader.vue'
import BularioDetalhe from '@/features/clinico/components/bulario/BularioDetalhe.vue'
import BularioLista from '@/features/clinico/components/bulario/BularioLista.vue'
import { patientRepository } from '@/features/clinico/data/repositories'
import type { Medication, Pet, Tutor } from '@/features/clinico/data/types'
import { FILTRO_VAZIO, type BularioFiltro } from '@/features/clinico/domain/bulario'
import { useClinicoStore } from '@/features/clinico/stores/clinico'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const clinico = useClinicoStore()

const filtro = ref<BularioFiltro>({ ...FILTRO_VAZIO })
const selecionadoId = ref<string | null>(null)
const pet = ref<Pet | null>(null)
const tutor = ref<Tutor | null>(null)
const carregando = ref(false)
const erro = ref('')

const petIdDaRota = computed(() => {
  const valor = route.query.paciente

  return typeof valor === 'string' && valor ? valor : null
})

const selecionado = computed(
  () => clinico.medicamentos.find((item) => item.id === selecionadoId.value) ?? null,
)

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

function selecionar(medicamento: Medication) {
  selecionadoId.value = medicamento.id
}

function limparPaciente() {
  void router.replace({ path: '/veterinario/bulario' })
}

watch(petIdDaRota, carregar)

onMounted(carregar)
</script>

<template>
  <PartnerPageFrame
    :subtitle="t('clinico.bulario.subtitulo')"
    :title="t('clinico.bulario.titulo')"
    :loading="carregando && clinico.medicamentos.length === 0"
    :error="erro"
    block-when-suspended
    @retry="carregar"
  >
    <div class="bulario clinic-scope">
      <div v-if="pet" class="bulario__paciente">
        <ClinicPatientHeader :pet="pet" :tutor="tutor" />
        <button type="button" class="bulario__sair clinic-focusable" @click="limparPaciente">
          <i class="pi pi-times" aria-hidden="true" />
          {{ t('clinico.bulario.semPaciente') }}
        </button>
      </div>

      <div class="bulario__corpo">
        <section class="bulario__coluna">
          <BularioLista
            :medicamentos="clinico.medicamentos"
            :filtro="filtro"
            :selecionado-id="selecionadoId"
            :pet="pet"
            @update:filtro="filtro = $event"
            @selecionar="selecionar"
          />
        </section>

        <section class="bulario__ficha">
          <BularioDetalhe v-if="selecionado" :medicamento="selecionado" :pet="pet" />
          <p v-else class="bulario__vazio">{{ t('clinico.bulario.escolha') }}</p>
        </section>
      </div>
    </div>
  </PartnerPageFrame>
</template>

<style scoped>
.bulario {
  display: grid;
  gap: var(--clinic-space-4);
}

.bulario__paciente {
  display: grid;
  align-items: center;
  gap: var(--clinic-space-3);
  grid-template-columns: minmax(0, 1fr) auto;
}

.bulario__sair {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.4rem 0.7rem;
  border: 1px solid var(--clinic-line);
  border-radius: var(--clinic-radius-control);
  background: var(--clinic-surface);
  color: var(--clinic-muted);
  cursor: pointer;
  font: inherit;
  font-size: var(--clinic-font-label);
  font-weight: 650;
}

.bulario__sair:hover {
  border-color: var(--clinic-line-strong);
  color: var(--clinic-text);
}

.bulario__corpo {
  display: grid;
  align-items: start;
  gap: var(--clinic-space-4);
  grid-template-columns: minmax(16rem, 22rem) minmax(0, 1fr);
}

.bulario__coluna,
.bulario__ficha {
  padding: var(--clinic-space-4);
  border: 1px solid var(--clinic-line);
  border-radius: var(--clinic-radius-card);
  background: var(--clinic-surface);
  box-shadow: var(--clinic-shadow-card);
}

.bulario__vazio {
  margin: 0;
  color: var(--clinic-faint);
  text-align: center;
}

@media (max-width: 900px) {
  .bulario__corpo {
    grid-template-columns: minmax(0, 1fr);
  }

  .bulario__paciente {
    grid-template-columns: minmax(0, 1fr);
  }

  .bulario__sair {
    justify-self: start;
  }
}
</style>
