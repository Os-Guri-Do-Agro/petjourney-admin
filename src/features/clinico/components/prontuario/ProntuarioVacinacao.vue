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
 *
 * Na tela nova é uma folha própria embaixo da conduta, com o estado do protocolo em selo (cor e
 * palavra) logo abaixo do título.
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
  <section class="vacinacao ui-folha" :aria-labelledby="`vacinacao-${encounter.id}`">
    <header class="vacinacao__topo">
      <span class="vacinacao__icone" aria-hidden="true"><i class="ph ph-syringe" /></span>

      <div class="vacinacao__titulos">
        <h3 :id="`vacinacao-${encounter.id}`" class="vacinacao__titulo">
          {{ t('clinico.prontuario.timeline.kind.vacina') }}
        </h3>
        <p class="vacinacao__estado">
          <span class="ui-selo" :class="`ui-selo--${estado.tom}`">
            <i
              :class="estado.tom === 'ok' ? 'ph ph-check-circle' : 'ph ph-warning-circle'"
              aria-hidden="true"
            />
            {{ t('clinico.vacinas.carteira.protocolo') }}: {{ estado.texto }}
          </span>
        </p>
      </div>

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
          type="button"
          :label="t('clinico.vacinas.carteira.verCarteira')"
          icon="ph ph-device-mobile"
          severity="secondary"
          outlined
          size="small"
          @click="abrirCarteira"
        />
        <Button
          v-if="!somenteLeitura && pet && plano"
          type="button"
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
    <div v-show="protocoloAberto" :id="`protocolo-${encounter.id}`" class="vacinacao__protocolo">
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
          <span class="vacinacao__dados">
            {{
              [
                aplicacao.dosesNaSerie > 1
                  ? t('clinico.vacinas.doseDeTotal', {
                      dose: aplicacao.dose,
                      total: aplicacao.dosesNaSerie,
                    })
                  : t('clinico.vacinas.plano.doseUnica'),
                `${t('clinico.vacinas.lote')} ${aplicacao.lote}`,
                rotulos.via(aplicacao.via),
              ].join(' · ')
            }}
          </span>
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
/* O cartão com cabeçalho: o topo separado do corpo por um fio suave, como as folhas das etapas. */
.vacinacao {
  display: grid;
  gap: 16px;
  padding: 0 22px 20px;
}

.vacinacao__topo {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px 14px;
  margin-inline: -22px;
  padding: 18px 22px 16px;
  border-bottom: 1px solid var(--linha-suave);
}

/* Sem corpo embaixo (nada a mostrar ainda), o topo é o cartão inteiro: sem fio sobrando. */
.vacinacao__topo:last-child {
  margin-bottom: -20px;
  border-bottom: 0;
}

/* O ladrilho do assunto, no tom do lugar — o mesmo das folhas das etapas. */
.vacinacao__icone {
  display: grid;
  width: 40px;
  height: 40px;
  flex: none;
  place-items: center;
  border-radius: 12px;
  background: var(--pj-lugar-fundo, var(--clinica-fundo));
  color: var(--pj-lugar-tinta, var(--clinica-tinta));
  font-size: 20px;
}

.vacinacao__titulos {
  display: grid;
  min-width: 0;
  flex: 1 1 220px;
  gap: 4px;
}

.vacinacao__titulo {
  margin: 0;
  color: var(--tinta);
  font-size: 17px;
  font-weight: 600;
  letter-spacing: -0.005em;
}

.vacinacao__estado {
  margin: 0;
}

.vacinacao__estado .ui-selo {
  height: auto;
  min-height: 24px;
  padding-block: 3px;
  white-space: normal;
}

.vacinacao__acoes {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.vacinacao__protocolo {
  min-width: 0;
}

.vacinacao__agora {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 12px 0 0;
  border-top: 1px solid var(--linha);
  list-style: none;
}

.vacinacao__agora li {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  font-size: 14px;
  line-height: 1.45;
}

.vacinacao__agora li > .ph {
  margin-top: 2px;
  color: var(--ok-tinta);
  font-size: 16px;
}

.vacinacao__agora strong {
  margin-inline-end: 8px;
  color: var(--tinta);
  font-weight: 600;
}

.vacinacao__dados {
  color: var(--tinta-2);
  font-size: 13.5px;
}

@media (max-width: 640px) {
  .vacinacao {
    padding: 0 16px 16px;
  }

  .vacinacao__topo {
    margin-inline: -16px;
    padding: 16px 16px 14px;
  }

  .vacinacao__topo:last-child {
    margin-bottom: -16px;
  }
}
</style>
