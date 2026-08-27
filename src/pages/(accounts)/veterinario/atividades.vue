<script setup lang="ts">
/**
 * Atividades — a caixa de pendências da clínica.
 *
 * Três pilhas que costumam ficar invisíveis até virarem problema: prontuário em rascunho,
 * retorno indicado sem horário e oferta da fila esperando resposta. Nenhuma delas aparece na
 * grade do dia, e é justamente por isso que envelhecem.
 */
import Button from 'primevue/button'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import PartnerPageFrame from '@/components/parceiro/PartnerPageFrame.vue'
import { useClinicFormat } from '@/features/clinico/composables/useClinicFormat'
import { encounterRepository } from '@/features/clinico/data/repositories'
import type { Encounter } from '@/features/clinico/data/types'
import { retornosVencidos, type RetornoPendente } from '@/features/clinico/domain/follow-up'
import { clinicClock, useClinicoStore } from '@/features/clinico/stores/clinico'
import { useFilaStore } from '@/features/clinico/stores/fila'

const { t } = useI18n()
const router = useRouter()
const clinico = useClinicoStore()
const fila = useFilaStore()
const formato = useClinicFormat()

const rascunhos = ref<Encounter[]>([])
const retornos = ref<RetornoPendente[]>([])
const carregando = ref(false)
const erro = ref('')

const total = computed(
  () => rascunhos.value.length + retornos.value.length + fila.ofertadas.length,
)

const vazio = computed(() => !carregando.value && !erro.value && total.value === 0)

async function carregar() {
  carregando.value = true
  erro.value = ''

  try {
    await clinico.carregar()

    const [emRascunho, pendentes] = await Promise.all([
      encounterRepository.listarRascunhos(null),
      encounterRepository.listarRetornosPendentes(),
    ])

    rascunhos.value = emRascunho
    retornos.value = retornosVencidos(pendentes, clinicClock, clinicClock.today())

    await fila.carregar()
  } catch {
    erro.value = t('clinico.erros.prontuario')
  } finally {
    carregando.value = false
  }
}

onMounted(carregar)
</script>

<template>
  <PartnerPageFrame
    :subtitle="t('clinico.atividades.subtitulo')"
    :title="t('clinico.atividades.titulo')"
    :loading="carregando && total === 0"
    :error="erro"
    :empty="vazio"
    :empty-title="t('clinico.atividades.vazioTitulo')"
    :empty-description="t('clinico.atividades.vazioDescricao')"
    block-when-suspended
    @retry="carregar"
  >
    <div class="atividades clinic-scope">
      <section v-if="rascunhos.length > 0" class="pilha">
        <h2 class="pilha__titulo">
          <span class="pilha__marca" aria-hidden="true"><i class="pi pi-file-edit" /></span>
          {{ t('clinico.atividades.rascunhos') }}
          <span class="pilha__contagem clinic-value">{{ rascunhos.length }}</span>
        </h2>

        <ul class="pilha__lista">
          <li v-for="encounter in rascunhos" :key="encounter.id">
            <button
              type="button"
              class="item clinic-focusable"
              @click="router.push(`/veterinario/atendimento/${encounter.id}`)"
            >
              <span class="item__corpo">
                <strong>{{ clinico.pet(encounter.petId)?.nome }}</strong>
                <small>
                  {{ encounter.anamnese.queixaPrincipal || '—' }} ·
                  {{ formato.relativo(encounter.abertoEm) }}
                </small>
              </span>
              <i class="pi pi-chevron-right" aria-hidden="true" />
            </button>
          </li>
        </ul>
      </section>

      <section v-if="retornos.length > 0" class="pilha">
        <h2 class="pilha__titulo">
          <span class="pilha__marca" aria-hidden="true"><i class="pi pi-history" /></span>
          {{ t('clinico.atividades.retornos') }}
          <span class="pilha__contagem clinic-value">{{ retornos.length }}</span>
        </h2>

        <ul class="pilha__lista">
          <li v-for="item in retornos" :key="item.encounter.id">
            <div class="item item--estatico">
              <span class="item__corpo">
                <strong>{{ clinico.pet(item.encounter.petId)?.nome }}</strong>
                <small>
                  {{ clinico.diagnosticoPrincipal(item.encounter) || '—' }} ·
                  {{
                    t('clinico.formato.haTempo', {
                      valor: t('clinico.formato.dias', { valor: item.diasDeAtraso }, item.diasDeAtraso),
                    })
                  }}
                </small>
              </span>
              <Button
                :label="t('clinico.meuDia.marcarRetorno')"
                size="small"
                severity="secondary"
                outlined
                @click="router.push('/veterinario/agenda')"
              />
            </div>
          </li>
        </ul>
      </section>

      <section v-if="fila.ofertadas.length > 0" class="pilha">
        <h2 class="pilha__titulo">
          <span class="pilha__marca" aria-hidden="true"><i class="pi pi-hourglass" /></span>
          {{ t('clinico.atividades.ofertasDaFila') }}
          <span class="pilha__contagem clinic-value">{{ fila.ofertadas.length }}</span>
        </h2>

        <ul class="pilha__lista">
          <li v-for="entrada in fila.ofertadas" :key="entrada.id">
            <button
              type="button"
              class="item clinic-focusable"
              @click="router.push('/veterinario/fila')"
            >
              <span class="item__corpo">
                <strong>{{ clinico.pet(entrada.petId)?.nome }}</strong>
                <small v-if="entrada.ofertaExpiraEm">
                  {{
                    t('clinico.fila.ofertaExpiraEm', {
                      valor: formato.relativo(entrada.ofertaExpiraEm),
                    })
                  }}
                </small>
              </span>
              <i class="pi pi-chevron-right" aria-hidden="true" />
            </button>
          </li>
        </ul>
      </section>
    </div>
  </PartnerPageFrame>
</template>

<style scoped>
/**
 * Três pilhas independentes, lado a lado enquanto couberem.
 *
 * Empilhadas numa coluna só, a tela larga jogava o botão "Marcar retorno" a um palmo do nome do
 * paciente — o olho perdia a ligação entre a linha e a ação dela. Em coluna estreita os dois
 * voltam a andar juntos, e as três pendências ficam visíveis de uma vez, sem rolagem.
 */
.atividades {
  display: grid;
  align-items: start;
  gap: var(--clinic-space-4);
  grid-template-columns: repeat(auto-fit, minmax(21rem, 1fr));
}

.pilha {
  display: grid;
  gap: var(--clinic-space-2);
  padding: var(--clinic-space-4);
  border: 1px solid var(--clinic-line);
  border-radius: var(--clinic-radius-card);
  background: var(--clinic-surface);
  box-shadow: var(--clinic-shadow-card);
}

.pilha__titulo {
  display: flex;
  align-items: center;
  gap: var(--clinic-space-2);
  margin: 0;
  color: var(--clinic-muted);
  font-size: var(--clinic-font-label);
  font-weight: 750;
  letter-spacing: 0.09em;
  text-transform: uppercase;
}

.pilha__marca {
  display: grid;
  width: 1.75rem;
  height: 1.75rem;
  place-items: center;
  border-radius: 0.6rem;
  background: var(--clinic-accent-tint);
  color: var(--clinic-accent-strong);
  font-size: 0.72rem;
}

.pilha__contagem {
  padding: 0 0.4rem;
  border-radius: var(--clinic-radius-chip);
  background: var(--clinic-accent-tint);
  color: var(--clinic-accent-strong);
  font-weight: 800;
  letter-spacing: 0;
}

.pilha__lista {
  display: grid;
  gap: 0.15rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.item {
  display: flex;
  width: 100%;
  align-items: center;
  gap: var(--clinic-space-3);
  min-height: var(--clinic-row-height);
  padding: var(--clinic-cell-padding-y) var(--clinic-space-2);
  border: none;
  border-radius: var(--clinic-radius-control);
  background: transparent;
  color: inherit;
  cursor: pointer;
  font: inherit;
  text-align: left;
}

.item:hover {
  background: var(--clinic-surface-soft);
}

.item--estatico {
  cursor: default;
}

.item--estatico:hover {
  background: transparent;
}

.item__corpo {
  display: grid;
  min-width: 0;
  flex: 1;
  gap: 0.1rem;
}

.item__corpo strong {
  overflow: hidden;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item__corpo small {
  overflow: hidden;
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item i {
  color: var(--clinic-faint);
  font-size: 0.7rem;
}
</style>
