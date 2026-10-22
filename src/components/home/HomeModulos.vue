<script setup lang="ts">
/**
 * Clínica e Hotel no Início, pelo que o servidor diz (E1-02): o que dá para pedir, o que está em
 * análise, o que está em teste e o que ficou só para consulta. Módulo ativo e sem prazo não
 * aparece aqui: ele já está no menu e nos espaços.
 *
 * Quem decide se o botão de pedir existe é a API (`podeSolicitar`: DONO, parceiro operável, módulo
 * nunca pedido ou recusado). O portal não recalcula. `elegiveis` só destaca o módulo que combina
 * com a categoria do cadastro; não é trava.
 */
import { PhBed, PhStethoscope } from '@phosphor-icons/vue'
import Button from 'primevue/button'
import { useToast } from 'primevue/usetoast'
import { computed, ref, type Component } from 'vue'
import { useI18n } from 'vue-i18n'

import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { INTL_LOCALE, type Locale } from '@/i18n/locales'
import { ApiError } from '@/service/api'
import {
  solicitarModulo,
  type ModuloDoPortal,
  type NomeDoModulo,
} from '@/service/parceiro/acesso-service'

type Linha = {
  modulo: NomeDoModulo
  icone: Component
  situacao: 'pedir' | 'solicitado' | 'teste' | 'somenteLeitura'
  frase: string
  sugerido: boolean
}

const ICONE: Record<NomeDoModulo, Component> = { CLINICA: PhStethoscope, HOTEL: PhBed }

/** Códigos em que o estado na tela ficou velho: alguém pediu ou ligou antes. */
const CODIGOS_DE_ESTADO_VELHO = new Set(['MODULO_JA_SOLICITADO', 'MODULO_JA_ATIVO'])

const { t, locale } = useI18n()
const toast = useToast()
const { store, ensureContext, parceiroQuery } = useParceiroPortal()
const pedindo = ref<NomeDoModulo | null>(null)

function formatarData(iso: string) {
  return new Date(iso).toLocaleDateString(INTL_LOCALE[locale.value as Locale], {
    day: 'numeric',
    month: 'long',
  })
}

function linhaDe(modulo: ModuloDoPortal): Linha | null {
  const base = {
    modulo: modulo.modulo,
    icone: ICONE[modulo.modulo],
    sugerido: store.eu?.elegiveis.includes(modulo.modulo) ?? false,
  }

  if (modulo.podeLer && !modulo.podeEscrever && modulo.motivoSomenteLeitura) {
    return {
      ...base,
      situacao: 'somenteLeitura',
      frase: t(`inicio.modulos.somenteLeitura.${modulo.motivoSomenteLeitura}`),
    }
  }

  if (modulo.status === 'TESTE' && modulo.ativoAte) {
    return {
      ...base,
      situacao: 'teste',
      frase: t('inicio.modulos.teste', { data: formatarData(modulo.ativoAte) }),
    }
  }

  if (modulo.status === 'SOLICITADO') {
    return { ...base, situacao: 'solicitado', frase: t('inicio.modulos.solicitado') }
  }

  if (modulo.podeSolicitar) {
    return { ...base, situacao: 'pedir', frase: t(`inicio.modulos.${modulo.modulo}.descricao`) }
  }

  return null
}

const linhas = computed(() =>
  (store.eu?.modulos ?? []).map(linhaDe).filter((linha): linha is Linha => linha !== null),
)

const SELO: Record<Exclude<Linha['situacao'], 'pedir'>, { classe: string; icone: string }> = {
  solicitado: { classe: 'ui-selo--lugar', icone: 'ph ph-hourglass' },
  teste: { classe: 'ui-selo--lugar', icone: 'ph ph-flask' },
  somenteLeitura: { classe: 'ui-selo--atencao', icone: 'ph ph-eye' },
}

async function pedir(modulo: NomeDoModulo) {
  pedindo.value = modulo

  try {
    await solicitarModulo(modulo, parceiroQuery())
    toast.add({
      severity: 'success',
      summary: t('inicio.modulos.pedidoEnviado'),
      detail: t('inicio.modulos.pedidoEnviadoDetalhe'),
      life: 4000,
    })
    await ensureContext(true)
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: t('inicio.modulos.erro'),
      detail: err instanceof Error ? err.message : undefined,
      life: 6000,
    })

    if (err instanceof ApiError && err.codigo && CODIGOS_DE_ESTADO_VELHO.has(err.codigo)) {
      await ensureContext(true)
    }
  } finally {
    pedindo.value = null
  }
}
</script>

<template>
  <section v-if="linhas.length" class="modulos" :aria-label="t('inicio.modulos.rotulo')">
    <ul class="ui-lista ui-folha">
      <li v-for="linha in linhas" :key="linha.modulo" class="ui-linha modulo">
        <span class="ui-ladrilho ui-ladrilho--lugar" aria-hidden="true">
          <component :is="linha.icone" :size="20" weight="duotone" />
        </span>

        <span class="ui-linha__texto">
          <span class="ui-linha__titulo modulo__nome">
            {{ t(`inicio.modulos.${linha.modulo}.nome`) }}
            <span
              v-if="linha.situacao === 'pedir' && linha.sugerido"
              class="ui-selo ui-selo--contorno"
            >
              {{ t('inicio.modulos.sugerido') }}
            </span>
          </span>
          <span class="ui-linha__meta">{{ linha.frase }}</span>
        </span>

        <span class="ui-linha__fim">
          <Button
            v-if="linha.situacao === 'pedir'"
            type="button"
            icon="ph ph-paper-plane-tilt"
            :label="t('inicio.modulos.pedir')"
            severity="secondary"
            outlined
            size="small"
            :loading="pedindo === linha.modulo"
            :disabled="pedindo !== null"
            @click="pedir(linha.modulo)"
          />
          <span v-else class="ui-selo" :class="SELO[linha.situacao].classe">
            <i :class="SELO[linha.situacao].icone" aria-hidden="true" />
            {{ t(`inicio.modulos.selo.${linha.situacao}`) }}
          </span>
        </span>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.modulos {
  display: grid;
}

.modulo__nome {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

@media (max-width: 40rem) {
  .modulo {
    flex-wrap: wrap;
  }
}
</style>
