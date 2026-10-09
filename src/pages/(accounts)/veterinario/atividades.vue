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

import PetAvatar from '@/features/hotel/components/base/PetAvatar.vue'
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

const total = computed(() => rascunhos.value.length + retornos.value.length + fila.ofertadas.length)

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
    class="hc-tema"
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
    <template #cabecalho>
      <div class="hc-saudacao">
        <p class="hc-saudacao__data">{{ t('clinico.faltas.subtitulo') }}</p>
        <h1 class="hc-saudacao__titulo">{{ t('clinico.atividades.titulo') }}</h1>

        <div class="hc-saudacao__linha">
          <p v-if="!carregando || total > 0" class="hc-saudacao__resumo" aria-live="polite">
            {{ t('clinico.atividades.saudacao', { n: total }, total) }}
          </p>
        </div>
      </div>
    </template>

    <div class="atividades clinic-scope">
      <section v-if="rascunhos.length > 0" class="pilha">
        <h2 class="pilha__titulo">
          <span class="pilha__marca" aria-hidden="true"><i class="ph ph-note-pencil" /></span>
          {{ t('clinico.atividades.rascunhos') }}
          <span class="pilha__contagem clinic-value">{{ rascunhos.length }}</span>
        </h2>

        <ul class="pilha__lista">
          <li v-for="encounter in rascunhos" :key="encounter.id">
            <Button
              type="button"
              class="item clinic-focusable"
              text
              @click="router.push(`/veterinario/atendimento/${encounter.id}`)"
            >
              <PetAvatar
                class="item__avatar"
                :nome="clinico.pet(encounter.petId)?.nome ?? ''"
                :iniciais="clinico.pet(encounter.petId)?.iniciais ?? ''"
                :especie="clinico.pet(encounter.petId)?.especie ?? null"
                :foto-url="clinico.pet(encounter.petId)?.fotoUrl ?? ''"
                tamanho="md"
              />
              <span class="item__corpo">
                <strong>{{ clinico.pet(encounter.petId)?.nome }}</strong>
                <small>
                  {{ encounter.anamnese.queixaPrincipal || '—' }} ·
                  {{ formato.relativo(encounter.abertoEm) }}
                </small>
              </span>
              <i class="ph ph-caret-right" aria-hidden="true" />
            </Button>
          </li>
        </ul>
      </section>

      <section v-if="retornos.length > 0" class="pilha">
        <h2 class="pilha__titulo">
          <span class="pilha__marca" aria-hidden="true"><i class="ph ph-clock-counter-clockwise" /></span>
          {{ t('clinico.atividades.retornos') }}
          <span class="pilha__contagem clinic-value">{{ retornos.length }}</span>
        </h2>

        <ul class="pilha__lista">
          <li v-for="item in retornos" :key="item.encounter.id">
            <div class="item item--estatico">
              <PetAvatar
                class="item__avatar"
                :nome="clinico.pet(item.encounter.petId)?.nome ?? ''"
                :iniciais="clinico.pet(item.encounter.petId)?.iniciais ?? ''"
                :especie="clinico.pet(item.encounter.petId)?.especie ?? null"
                :foto-url="clinico.pet(item.encounter.petId)?.fotoUrl ?? ''"
                tamanho="md"
              />
              <span class="item__corpo">
                <strong>{{ clinico.pet(item.encounter.petId)?.nome }}</strong>
                <small>
                  {{ clinico.diagnosticoPrincipal(item.encounter) || '—' }} ·
                  {{
                    t('clinico.formato.haTempo', {
                      valor: t(
                        'clinico.formato.dias',
                        { valor: item.diasDeAtraso },
                        item.diasDeAtraso,
                      ),
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
          <span class="pilha__marca" aria-hidden="true"><i class="ph ph-hourglass" /></span>
          {{ t('clinico.atividades.ofertasDaFila') }}
          <span class="pilha__contagem clinic-value">{{ fila.ofertadas.length }}</span>
        </h2>

        <ul class="pilha__lista">
          <li v-for="entrada in fila.ofertadas" :key="entrada.id">
            <Button
              type="button"
              class="item clinic-focusable"
              text
              @click="router.push('/veterinario/fila')"
            >
              <PetAvatar
                class="item__avatar"
                :nome="clinico.pet(entrada.petId)?.nome ?? ''"
                :iniciais="clinico.pet(entrada.petId)?.iniciais ?? ''"
                :especie="clinico.pet(entrada.petId)?.especie ?? null"
                :foto-url="clinico.pet(entrada.petId)?.fotoUrl ?? ''"
                tamanho="md"
              />
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
              <i class="ph ph-caret-right" aria-hidden="true" />
            </Button>
          </li>
        </ul>
      </section>
    </div>
  </PartnerPageFrame>
</template>

<style scoped>
/*
 * As três pendências empilhadas, cada uma na largura toda. Lado a lado, a coluna de retornos
 * espremia o diagnóstico em "Doença do disco…" e o botão tomava metade da linha; empilhadas, a
 * linha diz o que é e a ação fica na ponta, onde o olho termina de ler.
 */
.atividades {
  display: grid;
  align-items: start;
  gap: var(--clinic-space-4);
  grid-template-columns: minmax(0, 1fr);
}

/* O cartão e o título dos cartões da Visão geral (`.hc`): título em caixa normal, na tinta. */
.pilha {
  display: grid;
  gap: var(--clinic-space-3);
  padding: 1.2rem 1.35rem 1.35rem;
  border: 1px solid var(--clinic-line);
  border-radius: var(--clinic-radius-card);
  background: var(--clinic-surface);
  box-shadow: var(--clinic-shadow-card);
}

.pilha__titulo {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  margin: 0;
  color: var(--clinic-text);
  font-size: 1rem;
  font-weight: 650;
  letter-spacing: -0.01em;
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

/* A linha clicável é `Button`; a de retorno (com ação própria) é `div`. As duas leem igual. */
.item,
.item.p-button {
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: flex-start;
  gap: var(--clinic-space-3);
  min-height: var(--clinic-row-height);
  padding: var(--clinic-cell-padding-y) var(--clinic-space-2);
  border: none;
  border-radius: var(--clinic-radius-control);
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: start;
}

.item.p-button:not(:disabled):hover,
.item.p-button:not(:disabled):active {
  border: none;
  background: var(--clinic-surface-soft);
  color: inherit;
}

.item.p-button:focus-visible {
  outline: none;
  box-shadow: var(--clinic-focus-ring);
}

.item__avatar {
  flex-shrink: 0;
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

/* Até duas linhas: o diagnóstico é o que decide a ordem do dia, e cortado em uma não se lia. */
.item__corpo small {
  display: -webkit-box;
  overflow: hidden;
  color: var(--hc-tinta-2);
  font-size: 0.8125rem;
  line-height: 1.4;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
}

.item i {
  color: var(--clinic-faint);
  font-size: 0.7rem;
}
</style>
