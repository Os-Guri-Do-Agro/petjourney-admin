<script setup lang="ts">
/**
 * Depois de finalizar o atendimento (pedido do Luís, 17/11/2026: "deveria aparecer algo avisando,
 * um modal, com ações como liberar resumo, adendo"). No lugar do toast que sumia em 4 s, uma janela
 * curta diz que o registro fechou e mostra os próximos passos, cada um com o seu botão:
 *
 * - **Resumo para o responsável**: liberar, ou o estado (no app desde tal dia, ou por que não foi).
 * - **Retorno**, quando o veterinário definiu os dias: marcar agora, ou "já marcado".
 * - **Adendo**: o caminho para corrigir o que ficou de fora (o registro fechado não muda).
 *
 * As ações são da tela (`AtendimentoDaClinica`): a janela só pede. O resultado aparece aqui mesmo
 * (o passo vira feito, ou o aviso embaixo), sem toast por cima do X.
 */
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import { useI18n } from 'vue-i18n'
import { RouterLink, type RouteLocationRaw } from 'vue-router'

defineProps<{
  pet: string
  resumo: { publicado: boolean; frase: string; temMotivo: boolean }
  podeLiberar: boolean
  liberando: boolean
  retorno: { dias: number | null; marcado: boolean }
  podeMarcarRetorno: boolean
  marcando: boolean
  podeAdendo: boolean
  voltar: { to: RouteLocationRaw; rotulo: string }
  aviso: string
}>()

const aberta = defineModel<boolean>('visible', { default: false })
const emit = defineEmits<{ liberar: []; marcarRetorno: []; adendo: []; fechou: [] }>()

const { t } = useI18n()
</script>

<template>
  <Dialog
    v-model:visible="aberta"
    modal
    :draggable="false"
    class="fz"
    :style="{ width: 'min(34rem, calc(100vw - 2rem))' }"
    @after-hide="emit('fechou')"
  >
    <template #header>
      <span class="fz__cabeca">
        <span class="fz__selo" aria-hidden="true"><i class="ph ph-seal-check" /></span>
        <span class="fz__titulos">
          <strong class="fz__titulo">{{ t('atendimento.concluido.titulo') }}</strong>
          <span class="fz__texto">{{ t('atendimento.concluido.texto', { pet }) }}</span>
        </span>
      </span>
    </template>

    <ul class="fz__passos">
      <!-- O resumo para o app do responsável. -->
      <li class="fz__passo" :class="{ 'fz__passo--feito': resumo.publicado }">
        <span class="fz__icone" aria-hidden="true"><i class="ph ph-device-mobile" /></span>
        <span class="fz__corpo">
          <strong>{{ t('atendimento.concluido.resumoTitulo') }}</strong>
          <small>
            {{
              resumo.publicado || resumo.temMotivo
                ? resumo.frase
                : t('atendimento.concluido.resumoDica')
            }}
          </small>
        </span>
        <i v-if="resumo.publicado" class="ph ph-check-circle fz__feito" aria-hidden="true" />
        <Button
          v-else-if="podeLiberar"
          type="button"
          size="small"
          icon="ph ph-paper-plane-tilt"
          :label="t('atendimento.resumo.liberar')"
          :loading="liberando"
          :disabled="resumo.temMotivo"
          @click="emit('liberar')"
        />
      </li>

      <!-- O retorno, quando o veterinário definiu os dias. -->
      <li v-if="retorno.dias" class="fz__passo" :class="{ 'fz__passo--feito': retorno.marcado }">
        <span class="fz__icone" aria-hidden="true"><i class="ph ph-calendar-plus" /></span>
        <span class="fz__corpo">
          <strong>{{ t('atendimento.concluido.retornoTitulo') }}</strong>
          <small>
            {{
              retorno.marcado
                ? t('atendimento.conduta.retornoMarcado')
                : t('atendimento.concluido.retornoEm', { n: retorno.dias }, retorno.dias)
            }}
          </small>
        </span>
        <i v-if="retorno.marcado" class="ph ph-check-circle fz__feito" aria-hidden="true" />
        <Button
          v-else-if="podeMarcarRetorno"
          type="button"
          size="small"
          severity="secondary"
          outlined
          icon="ph ph-calendar-plus"
          :label="t('atendimento.conduta.marcarAgora')"
          :loading="marcando"
          @click="emit('marcarRetorno')"
        />
      </li>

      <!-- O adendo: o caminho para corrigir depois de fechado. -->
      <li v-if="podeAdendo" class="fz__passo">
        <span class="fz__icone" aria-hidden="true"><i class="ph ph-note-pencil" /></span>
        <span class="fz__corpo">
          <strong>{{ t('atendimento.concluido.adendoTitulo') }}</strong>
          <small>{{ t('atendimento.adendo.dica') }}</small>
        </span>
        <Button
          type="button"
          size="small"
          severity="secondary"
          outlined
          icon="ph ph-note"
          :label="t('atendimento.concluido.adendoAcao')"
          @click="emit('adendo')"
        />
      </li>
    </ul>

    <p v-if="aviso" class="eg__erro fz__aviso" role="alert">
      <i class="ph ph-warning-circle" aria-hidden="true" />
      <span>{{ aviso }}</span>
    </p>

    <template #footer>
      <Button
        :as="RouterLink"
        :to="voltar.to"
        severity="secondary"
        outlined
        icon="ph ph-arrow-left"
        :label="voltar.rotulo"
        @click="aberta = false"
      />
      <Button
        type="button"
        severity="secondary"
        outlined
        :label="t('atendimento.concluido.ficar')"
        @click="aberta = false"
      />
    </template>
  </Dialog>
</template>

<style scoped>
.fz__cabeca {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  min-width: 0;
}

/* O selo de concluído: o verde de "ok" no disco, não na janela inteira. */
.fz__selo {
  display: grid;
  flex: none;
  width: 44px;
  height: 44px;
  place-items: center;
  border-radius: 50%;
  background: var(--ok-fundo);
  color: var(--ok-tinta);
  font-size: 24px;
}

.fz__titulos {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.fz__titulo {
  color: var(--tinta);
  font-size: 18px;
  font-weight: 700;
}

.fz__texto {
  color: var(--tinta-2);
  font-size: 13.5px;
}

.fz__passos {
  display: grid;
  margin: 0;
  padding: 0;
  list-style: none;
}

/* Cada passo: o ícone, o que é e o botão; feito, o botão vira o visto. */
.fz__passo {
  display: grid;
  align-items: center;
  gap: 4px 12px;
  padding: 14px 0;
  grid-template-columns: auto minmax(0, 1fr) auto;
}

.fz__passo + .fz__passo {
  border-top: 1px solid var(--linha-suave);
}

.fz__icone {
  display: grid;
  width: 36px;
  height: 36px;
  place-items: center;
  border-radius: 11px;
  background: var(--superficie-2);
  color: var(--tinta);
  font-size: 18px;
}

.fz__passo--feito .fz__icone {
  background: var(--ok-fundo);
  color: var(--ok-tinta);
}

.fz__corpo {
  display: grid;
  min-width: 0;
  gap: 1px;
}

.fz__corpo strong {
  color: var(--tinta);
  font-size: 14.5px;
}

.fz__corpo small {
  color: var(--tinta-2);
  font-size: 12.5px;
  line-height: 1.4;
}

.fz__feito {
  color: var(--ok-tinta);
  font-size: 22px;
}

.fz__aviso {
  margin: 4px 0 0;
}

@media (max-width: 560px) {
  .fz__passo {
    grid-template-columns: auto minmax(0, 1fr);
  }

  .fz__passo > :deep(.p-button),
  .fz__passo > .fz__feito {
    grid-column: 2;
    justify-self: start;
  }
}
</style>
