<script setup lang="ts">
/**
 * Vacinação, dentro do atendimento.
 *
 * Fecha o beat que o roteiro de demonstração pede — "atende, prescreve, **vacina**". Até aqui era
 * um formulário solto: lote e validade digitados, via fixa em subcutânea, e nenhuma ideia de em
 * que ponto do protocolo o animal estava. Agora é o **protocolo do paciente** — o mesmo da carteira
 * — e o mesmo diálogo de aplicação, que já abre com a vacina da vez, a dose certa e o lote que
 * vence primeiro.
 *
 * Quem aplica no atendimento é, por padrão, quem está atendendo; o diálogo deixa trocar, porque na
 * clínica cheia quem dá a vacina é muitas vezes outra pessoa.
 */
import Button from 'primevue/button'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import AplicarVacinaDialog from '../vacinas/AplicarVacinaDialog.vue'
import PlanoVacinalLista from '../vacinas/PlanoVacinalLista.vue'
import { useRotulosDaVacina } from '../../composables/useRotulosDaVacina'
import { vacinaRepository } from '../../data/repositories'
import type { AplicacaoVacina, Encounter, Pet } from '../../data/types'
import type { PlanoVacinal } from '../../domain/protocolo-vacinal'

const props = defineProps<{
  encounter: Encounter
  pet: Pet | null
  somenteLeitura: boolean
}>()

const emit = defineEmits<{
  registrada: [aplicacao: AplicacaoVacina]
}>()

const { t } = useI18n()
const router = useRouter()
const rotulos = useRotulosDaVacina()

const plano = ref<PlanoVacinal | null>(null)
const aplicadas = ref<AplicacaoVacina[]>([])
const aplicando = ref(false)
const vacinaDaLinha = ref<string | null>(null)

/** Só as deste atendimento: o resto da carteira está no protocolo, logo acima. */
const nesteAtendimento = computed(() =>
  aplicadas.value.filter((item) => item.encounterId === props.encounter.id),
)

async function carregar() {
  if (!props.pet) {
    return
  }

  plano.value = vacinaRepository.plano(props.pet.id)
  aplicadas.value = await vacinaRepository.doPaciente(props.pet.id)
}

onMounted(carregar)
watch(() => props.pet?.id, carregar)

function abrir(vacinaId: string | null = null) {
  vacinaDaLinha.value = vacinaId
  aplicando.value = true
}

async function aplicada(aplicacao: AplicacaoVacina) {
  await carregar()
  emit('registrada', aplicacao)
}

function nomeDaVacina(id: string) {
  return vacinaRepository.catalogo().find((item) => item.id === id)?.nome ?? id
}

function abrirCarteira() {
  if (props.pet) {
    void router.push(`/veterinario/paciente/${props.pet.id}/vacinas`)
  }
}
</script>

<template>
  <section class="vacinacao">
    <header class="vacinacao__topo">
      <h4 class="clinic-label">{{ t('clinico.vacinas.carteira.protocolo') }}</h4>
      <div class="vacinacao__acoes">
        <Button
          :label="t('clinico.vacinas.carteira.verCarteira')"
          icon="pi pi-mobile"
          severity="secondary"
          outlined
          size="small"
          @click="abrirCarteira"
        />
        <Button
          v-if="!somenteLeitura && pet && plano"
          :label="t('clinico.vacinas.aplicar.abrir')"
          icon="pi pi-plus"
          size="small"
          class="clinic-acao-principal"
          @click="abrir()"
        />
      </div>
    </header>

    <PlanoVacinalLista
      v-if="plano"
      :plano="plano"
      :somente-leitura="somenteLeitura"
      @aplicar="abrir"
    />

    <!-- O que saiu deste atendimento, para quem fecha a conduta conferir antes de assinar. -->
    <ul v-if="nesteAtendimento.length > 0" class="vacinacao__agora">
      <li v-for="aplicacao in nesteAtendimento" :key="aplicacao.id">
        <i class="pi pi-check-circle" aria-hidden="true" />
        <span>
          <strong>{{ nomeDaVacina(aplicacao.vacinaId) }}</strong>
          ·
          {{
            aplicacao.dosesNaSerie > 1
              ? t('clinico.vacinas.doseDeTotal', {
                  dose: aplicacao.dose,
                  total: aplicacao.dosesNaSerie,
                })
              : t('clinico.vacinas.plano.doseUnica')
          }}
          · {{ t('clinico.vacinas.lote') }} {{ aplicacao.lote }} · {{ rotulos.via(aplicacao.via) }}
        </span>
      </li>
    </ul>

    <AplicarVacinaDialog
      v-if="pet && plano"
      v-model:visivel="aplicando"
      :pet="pet"
      :plano="plano"
      :vacina-inicial="vacinaDaLinha"
      :profissional-inicial="encounter.professionalId"
      :encounter-id="encounter.id"
      @aplicada="aplicada"
    />
  </section>
</template>

<style scoped>
.vacinacao {
  display: grid;
  gap: var(--clinic-space-3);
  padding: var(--clinic-space-4);
  border: 1px solid var(--clinic-line);
  border-radius: var(--clinic-radius-card);
  background: var(--clinic-surface);
}

.vacinacao__topo {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--clinic-space-2);
}

.vacinacao__topo h4 {
  margin: 0;
}

.vacinacao__acoes {
  display: flex;
  flex-wrap: wrap;
  gap: var(--clinic-space-2);
}

.vacinacao__agora {
  display: grid;
  margin: 0;
  padding: var(--clinic-space-3) 0 0;
  border-top: 1px solid var(--clinic-line-soft);
  gap: 0.3rem;
  list-style: none;
}

.vacinacao__agora li {
  display: flex;
  align-items: baseline;
  gap: 0.4rem;
  font-size: var(--clinic-font-label);
}

.vacinacao__agora .pi {
  color: var(--clinic-ok-text);
}
</style>
