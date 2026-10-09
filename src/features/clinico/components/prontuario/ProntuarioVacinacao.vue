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
 *
 * O protocolo nasce recolhido numa linha de estado ("1 vacina para hoje", "Vacinas em dia"), e o
 * "Aplicar vacina" é contornado: a conduta já tem a ação cheia da etapa, e o protocolo aberto com
 * uma segunda ação cheia era a parte da consulta que a auditoria marcou no limite. O que foi
 * aplicado neste atendimento continua sempre à vista, para conferir antes de assinar.
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
const protocoloAberto = ref(false)

/** O estado do protocolo numa frase curta, na ordem do que pede ação. */
const estado = computed(() => {
  const vacinas = plano.value?.vacinas ?? []
  const atrasadas = vacinas.filter((item) => item.situacao === 'atrasada').length
  const devidas = vacinas.filter((item) => item.situacao === 'devida').length

  if (atrasadas > 0) {
    return {
      texto: t('clinico.ficha.vacinas.atrasadas', { total: atrasadas }, atrasadas),
      tom: 'risco',
    }
  }

  if (devidas > 0) {
    return {
      texto: t('clinico.ficha.vacinas.hojeVarias', { total: devidas }, devidas),
      tom: 'atencao',
    }
  }

  return { texto: t('clinico.ficha.vacinas.emDia'), tom: 'ok' }
})

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
      <p class="vacinacao__estado" :class="`vacinacao__estado--${estado.tom}`">
        <i
          class="ph"
          :class="estado.tom === 'ok' ? 'ph-check-circle' : 'ph-warning-circle'"
          aria-hidden="true"
        />
        <span>
          <strong>{{ t('clinico.vacinas.carteira.protocolo') }}:</strong>
          {{ estado.texto }}
        </span>
      </p>

      <div class="vacinacao__acoes">
        <Button
          v-if="plano"
          type="button"
          :label="
            protocoloAberto
              ? t('clinico.vacinas.carteira.ocultarProtocolo')
              : t('clinico.vacinas.carteira.verProtocolo')
          "
          :icon="protocoloAberto ? 'ph ph-caret-up' : 'ph ph-caret-down'"
          icon-pos="right"
          severity="secondary"
          text
          size="small"
          :aria-expanded="protocoloAberto"
          :aria-controls="`protocolo-${encounter.id}`"
          @click="protocoloAberto = !protocoloAberto"
        />
        <Button
          :label="t('clinico.vacinas.carteira.verCarteira')"
          icon="ph ph-device-mobile"
          severity="secondary"
          outlined
          size="small"
          @click="abrirCarteira"
        />
        <Button
          v-if="!somenteLeitura && pet && plano"
          :label="t('clinico.vacinas.aplicar.abrir')"
          icon="ph ph-plus"
          severity="secondary"
          outlined
          size="small"
          @click="abrir()"
        />
      </div>
    </header>

    <!-- v-show, não v-if: o alvo do `aria-controls` precisa existir sempre. -->
    <div v-show="protocoloAberto" :id="`protocolo-${encounter.id}`">
      <PlanoVacinalLista
        v-if="plano"
        :plano="plano"
        :somente-leitura="somenteLeitura"
        @aplicar="abrir"
      />
    </div>

    <!-- O que saiu deste atendimento, para quem fecha a conduta conferir antes de assinar. -->
    <ul v-if="nesteAtendimento.length > 0" class="vacinacao__agora">
      <li v-for="aplicacao in nesteAtendimento" :key="aplicacao.id">
        <i class="ph ph-check-circle" aria-hidden="true" />
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

.vacinacao__estado {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  margin: 0;
  color: var(--clinic-text);
  font-size: 0.875rem;
}

.vacinacao__estado strong {
  font-weight: 650;
}

/* A urgência mora no ícone: a frase continua na tinta do texto. */
.vacinacao__estado .ph {
  color: var(--clinic-ok-text);
  font-size: 0.85rem;
}

.vacinacao__estado--atencao .ph {
  color: var(--hc-pessego-tinta);
}

.vacinacao__estado--risco .ph {
  color: var(--hc-coral-tinta);
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

.vacinacao__agora .ph {
  color: var(--clinic-ok-text);
}
</style>
