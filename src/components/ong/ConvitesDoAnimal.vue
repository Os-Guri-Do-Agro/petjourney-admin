<script setup lang="ts">
/**
 * Os convites de adoção de um animal (guia 2.4): os 20 mais novos, com o status (Aguardando, Aceita,
 * Recusada, Vencida, Cancelada), quem gerou e quando. "Cancelar convite" só no que está aguardando,
 * para quem entrega (`ong.entregar`). Depois do aceite, só o primeiro nome que a ONG anotou e a
 * data; o telefone some quando o convite fecha.
 *
 * O status muda fora da tela (quem adota aceita no app): a lista é lida de novo quando a aba volta
 * a ficar visível e quando a ficha pede (`recarregar`).
 */
import Button from 'primevue/button'
import Skeleton from 'primevue/skeleton'
import { useToast } from 'primevue/usetoast'
import { onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { useRotulosDoCadastro } from '@/components/cadastro/useRotulosDoCadastro'
import { lerErroDaOng, podeCancelarConvite, seloDoConvite } from '@/components/ong/regras-da-ong'
import UiVazioIlustrado from '@/components/ui/UiVazioIlustrado.vue'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { useRevalidarAoVoltar } from '@/composables/useRevalidarAoVoltar'
import { cancelarConvite, listarConvites, type ConviteDaOng } from '@/service/parceiro/ong-service'

const props = withDefaults(
  defineProps<{
    animalId: string
    /** Em cuidado e com `ong.entregar`: o botão de gerar e o de cancelar aparecem. */
    podeEntregar?: boolean
    entregue?: boolean
    /** Muda quando a ficha quer a lista lida de novo (um convite novo, por exemplo). */
    versao?: number
  }>(),
  { podeEntregar: false, entregue: false, versao: 0 },
)

const emit = defineEmits<{ gerar: []; lidos: [convites: ConviteDaOng[]]; mudou: [] }>()

const { t } = useI18n()
const toast = useToast()
const rotulos = useRotulosDoCadastro()
const { parceiroQuery } = useParceiroPortal()

const convites = ref<ConviteDaOng[]>([])
const carregando = ref(true)
const erro = ref('')
const confirmando = ref<string | null>(null)
const cancelando = ref<string | null>(null)

async function carregar() {
  erro.value = ''

  try {
    convites.value = await listarConvites(props.animalId, parceiroQuery())
    emit('lidos', convites.value)
  } catch (err) {
    erro.value = lerErroDaOng(err, t, t('ong.convites.erro')).mensagem
  } finally {
    carregando.value = false
  }
}

onMounted(() => void carregar())
watch(
  () => [props.animalId, props.versao],
  () => void carregar(),
)
useRevalidarAoVoltar(() => void carregar())

function dataHora(instante: string) {
  return new Date(instante).toLocaleString(rotulos.intl(), {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function linhaDoStatus(convite: ConviteDaOng) {
  if (convite.status === 'PENDENTE') {
    return t('ong.convites.venceEm', { data: dataHora(convite.expiraEm) })
  }

  if (convite.status === 'EXPIRADA') {
    return t('ong.convites.vencidoEm', { data: dataHora(convite.expiraEm) })
  }

  return convite.respondidaEm
    ? t('ong.convites.respondidoEm', { data: dataHora(convite.respondidaEm) })
    : ''
}

function quemGerou(convite: ConviteDaOng) {
  return convite.criadaPor?.nome
    ? t('ong.convites.geradoPor', {
        data: dataHora(convite.criadaEm),
        nome: convite.criadaPor.nome,
      })
    : t('ong.convites.geradoEm', { data: dataHora(convite.criadaEm) })
}

async function cancelar(convite: ConviteDaOng) {
  cancelando.value = convite.id

  try {
    await cancelarConvite(convite.id, parceiroQuery())
    toast.add({ severity: 'success', summary: t('ong.convites.cancelado'), life: 3500 })
    emit('mudou')
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: lerErroDaOng(err, t, t('ong.erros.salvar')).mensagem,
      life: 6000,
    })
  } finally {
    cancelando.value = null
    confirmando.value = null
    void carregar()
  }
}
</script>

<template>
  <section class="ui-folha ui-cartao cv-ong" aria-labelledby="cv-ong-titulo">
    <header class="ui-cartao__cabeca">
      <span class="ui-ladrilho" aria-hidden="true"><i class="ph ph-hand-heart" /></span>
      <span class="ui-cartao__titulos">
        <h2 id="cv-ong-titulo" class="ui-cartao__titulo">{{ t('ong.convites.titulo') }}</h2>
        <p class="ui-cartao__descricao">
          {{ entregue ? t('ong.convites.descricaoEntregue') : t('ong.convites.descricao') }}
        </p>
      </span>
      <Button
        v-if="podeEntregar && !entregue"
        type="button"
        size="small"
        icon="ph ph-link"
        :label="convites.length ? t('ong.convites.gerarOutro') : t('ong.convites.gerar')"
        @click="emit('gerar')"
      />
    </header>

    <div v-if="carregando" class="cv-ong__esqueleto" aria-busy="true">
      <Skeleton width="12rem" height="0.95rem" />
      <Skeleton width="16rem" height="0.8rem" />
    </div>

    <p v-else-if="erro" class="eg__erro cv-ong__erro" role="alert">
      <i class="ph ph-warning-circle" aria-hidden="true" />
      <span>{{ erro }}</span>
      <Button
        type="button"
        size="small"
        severity="secondary"
        outlined
        :label="t('cadastro.tentarDeNovo')"
        @click="carregar"
      />
    </p>

    <UiVazioIlustrado
      v-else-if="!convites.length"
      aninhado
      icone="ph ph-link"
      :titulo="t('ong.convites.nenhum')"
    />

    <ul v-else class="ui-lista">
      <li v-for="convite in convites" :key="convite.id" class="ui-linha cv-ong__linha">
        <span class="ui-linha__texto">
          <strong class="ui-linha__titulo cv-ong__titulo">
            <span class="ui-selo" :class="seloDoConvite(convite.status).classe">
              <i :class="seloDoConvite(convite.status).icone" aria-hidden="true" />
              {{ t(seloDoConvite(convite.status).chave) }}
            </span>
            <span v-if="convite.adotanteNome">
              {{ t('ong.convites.para', { nome: convite.adotanteNome }) }}
            </span>
          </strong>
          <span class="ui-linha__meta">{{ quemGerou(convite) }}</span>
          <span v-if="linhaDoStatus(convite)" class="ui-linha__meta">{{
            linhaDoStatus(convite)
          }}</span>
        </span>

        <span v-if="podeEntregar && podeCancelarConvite(convite.status)" class="ui-linha__fim">
          <template v-if="confirmando === convite.id">
            <span class="cv-ong__pergunta">{{ t('ong.convites.confirmarCancelar') }}</span>
            <Button
              type="button"
              size="small"
              severity="secondary"
              outlined
              :label="t('ong.convites.manter')"
              :disabled="cancelando === convite.id"
              @click="confirmando = null"
            />
            <Button
              type="button"
              size="small"
              severity="danger"
              icon="ph ph-prohibit"
              :label="t('ong.convites.cancelar')"
              :loading="cancelando === convite.id"
              @click="cancelar(convite)"
            />
          </template>
          <Button
            v-else
            type="button"
            size="small"
            severity="secondary"
            outlined
            icon="ph ph-prohibit"
            :label="t('ong.convites.cancelar')"
            @click="confirmando = convite.id"
          />
        </span>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.cv-ong {
  display: grid;
  gap: 12px;
}

.cv-ong__esqueleto {
  display: grid;
  gap: 8px;
  padding: 4px 0;
}

.cv-ong__erro {
  flex-wrap: wrap;
}

.cv-ong__linha {
  align-items: flex-start;
}

.cv-ong__titulo {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.cv-ong__pergunta {
  color: var(--tinta);
  font-size: 13.5px;
}

.cv-ong .ui-linha__fim {
  display: inline-flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  align-items: center;
  gap: 6px;
}
</style>
