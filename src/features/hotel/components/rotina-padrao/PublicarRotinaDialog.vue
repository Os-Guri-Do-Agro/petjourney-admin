<script setup lang="ts">
/**
 * A confirmação de publicar a rotina da casa.
 *
 * Publicar é a única operação deste módulo que mexe no trabalho de **todos os hóspedes de uma vez**.
 * Trocar um horário de água numa casa de quarenta altera quarenta tarefas de animais que estão lá
 * dentro agora, e um botão "salvar" sozinho pede um ato de fé que ninguém deveria ter de dar.
 *
 * Por isso o diálogo mostra três números antes — quantas nascem, quantas saem, quantas ficam
 * intocadas — e eles **não são estimativa**: vêm de rodar exatamente o mesmo caminho da publicação,
 * sem gravar. Se o número mente, a publicação também mentiria.
 *
 * A vigência é a outra metade. O padrão é **amanhã**, porque começar agora troca a lista debaixo
 * da mão de quem está no corredor marcando tarefa. Quem escolhe agora vê, em separado, quantas
 * caem no turno corrente — que é o número que assusta, e deve assustar.
 */
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import SelectButton from 'primevue/selectbutton'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { PrevisaoDaPublicacao } from '../../domain/rotina-padrao'

const props = defineProps<{
  aberto: boolean
  vigencia: 'amanha' | 'agora'
  previsao: PrevisaoDaPublicacao | null
  calculando: boolean
  salvando: boolean
  erro: string
}>()

const emit = defineEmits<{
  fechar: []
  'atualizar:vigencia': [valor: 'amanha' | 'agora']
  publicar: []
}>()

const { t } = useI18n()

const opcoes = computed(() => [
  { valor: 'amanha' as const, rotulo: t('hotel.rotinaPadrao.vigenciaAmanha') },
  { valor: 'agora' as const, rotulo: t('hotel.rotinaPadrao.vigenciaAgora') },
])

const nadaMuda = computed(
  () => !!props.previsao && props.previsao.criadas === 0 && props.previsao.retiradas === 0,
)
</script>

<template>
  <Dialog
    :visible="aberto"
    modal
    :header="t('hotel.rotinaPadrao.publicarTitulo')"
    :style="{ width: 'min(32rem, 94vw)' }"
    class="clinic-dialog hc-tema"
    @update:visible="emit('fechar')"
  >
    <div class="publicar">
      <div class="campo">
        <span class="campo__rotulo">{{ t('hotel.rotinaPadrao.vigencia') }}</span>
        <SelectButton
          :model-value="vigencia"
          :options="opcoes"
          option-label="rotulo"
          option-value="valor"
          :allow-empty="false"
          size="small"
          @update:model-value="(valor: 'amanha' | 'agora') => emit('atualizar:vigencia', valor)"
        />
        <p class="campo__dica">{{ t('hotel.rotinaPadrao.vigenciaDica') }}</p>
      </div>

      <section class="previsao">
        <h3 class="previsao__titulo">{{ t('hotel.rotinaPadrao.previsao') }}</h3>

        <p v-if="calculando" class="previsao__estado">
          <i class="pi pi-spin pi-spinner" aria-hidden="true" />
        </p>

        <p v-else-if="nadaMuda" class="previsao__estado">
          {{ t('hotel.rotinaPadrao.semMudanca') }}
        </p>

        <ul v-else-if="previsao" class="numeros">
          <li v-if="previsao.criadas > 0" class="numero numero--cria">
            <i class="pi pi-plus-circle" aria-hidden="true" />
            {{ t('hotel.rotinaPadrao.criadas', { total: previsao.criadas }, previsao.criadas) }}
          </li>

          <li v-if="previsao.retiradas > 0" class="numero numero--retira">
            <i class="pi pi-minus-circle" aria-hidden="true" />
            {{ t('hotel.rotinaPadrao.retiradas', { total: previsao.retiradas }, previsao.retiradas) }}
          </li>

          <li class="numero">
            <i class="pi pi-lock" aria-hidden="true" />
            {{
              t(
                'hotel.rotinaPadrao.preservadas',
                { total: previsao.preservadas },
                previsao.preservadas,
              )
            }}
          </li>

          <!--
            O número que assusta, e deve assustar: mudanças que caem no turno de quem está
            trabalhando agora fazem a lista mudar debaixo da mão dele.
          -->
          <li v-if="previsao.hoje > 0" class="numero numero--turno">
            <i class="pi pi-exclamation-circle" aria-hidden="true" />
            {{ t('hotel.rotinaPadrao.noTurno', { total: previsao.hoje }, previsao.hoje) }}
          </li>
        </ul>

        <p class="previsao__nota">{{ t('hotel.rotinaPadrao.preservadasDica') }}</p>
      </section>

      <p v-if="erro" class="erro">{{ erro }}</p>
    </div>

    <template #footer>
      <Button
        :label="t('hotel.rotinaPadrao.cancelar')"
        severity="secondary"
        text
        size="small"
        @click="emit('fechar')"
      />
      <Button
        :label="t('hotel.rotinaPadrao.publicar')"
        icon="pi pi-check"
        size="small"
        :loading="salvando"
        :disabled="calculando"
        @click="emit('publicar')"
      />
    </template>
  </Dialog>
</template>

<style scoped>
.publicar {
  display: grid;
  gap: var(--clinic-space-4);
}

.campo {
  display: grid;
  justify-items: start;
  gap: var(--clinic-space-2);
}

.campo__rotulo {
  color: var(--clinic-muted);
  font-size: var(--clinic-font-label);
  font-weight: 700;
}

.campo__dica,
.previsao__nota {
  margin: 0;
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
}

.previsao {
  display: grid;
  padding: var(--clinic-space-3) var(--clinic-space-4);
  border: 1px solid var(--clinic-line);
  border-radius: var(--clinic-radius-card);
  gap: var(--clinic-space-2);
  background: var(--clinic-surface-soft);
}

.previsao__titulo {
  margin: 0;
  color: var(--clinic-text);
  font-size: 0.9375rem;
  font-weight: 650;
  letter-spacing: -0.01em;
}

.previsao__estado {
  margin: 0;
  color: var(--clinic-muted);
  font-size: var(--clinic-font-base);
}

.numeros {
  display: grid;
  margin: 0;
  padding: 0;
  gap: 0.2rem;
  list-style: none;
}

/*
 * Os números falam pelo ícone e pela cor do texto, nunca por fundo pintado. É a regra da casa:
 * urgência mora no ícone, e um cartão de confirmação com três faixas coloridas vira enfeite.
 */
.numero {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  color: var(--clinic-muted);
  font-size: var(--clinic-font-base);
  font-variant-numeric: tabular-nums;
}

.numero .pi {
  font-size: 0.75rem;
}

.numero--cria {
  color: var(--clinic-accent-strong);
  font-weight: 700;
}

.numero--retira {
  color: var(--clinic-text);
  font-weight: 700;
}

.numero--turno {
  color: var(--clinic-risk-text);
  font-weight: 700;
}

.erro {
  margin: 0;
  color: var(--clinic-risk-text);
  font-size: var(--clinic-font-label);
  font-weight: 700;
}
</style>
