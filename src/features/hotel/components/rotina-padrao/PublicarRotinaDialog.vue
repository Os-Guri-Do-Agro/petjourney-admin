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
    :style="{ width: 'min(34rem, 96vw)' }"
    class="clinic-dialog hc-tema pj-lugar--hotel"
    dismissable-mask
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
          @update:model-value="(valor: 'amanha' | 'agora') => emit('atualizar:vigencia', valor)"
        />
        <!-- A dica acompanha a escolha: "Amanhã não mexe no turno" ao lado de "Agora" marcado confundia. -->
        <p class="campo__dica">
          {{
            vigencia === 'agora'
              ? t('hotel.rotinaPadrao.vigenciaDicaAgora')
              : t('hotel.rotinaPadrao.vigenciaDica')
          }}
        </p>
      </div>

      <section class="previsao">
        <h3 class="previsao__titulo">{{ t('hotel.rotinaPadrao.previsao') }}</h3>

        <p v-if="calculando" class="previsao__estado" role="status">
          <i class="ph ph-spin ph-circle-notch" aria-hidden="true" />
        </p>

        <p v-else-if="nadaMuda" class="previsao__estado">
          {{ t('hotel.rotinaPadrao.semMudanca') }}
        </p>

        <!--
          Os números falam pelo ícone e pela cor do texto, nunca por fundo pintado — menos o que
          cai no turno de agora, que é o número que assusta, e deve assustar.
        -->
        <ul v-else-if="previsao" class="numeros">
          <li v-if="previsao.criadas > 0" class="numero numero--cria">
            <i class="ph ph-plus-circle" aria-hidden="true" />
            {{ t('hotel.rotinaPadrao.criadas', { total: previsao.criadas }, previsao.criadas) }}
          </li>

          <li v-if="previsao.retiradas > 0" class="numero numero--retira">
            <i class="ph ph-minus-circle" aria-hidden="true" />
            {{
              t('hotel.rotinaPadrao.retiradas', { total: previsao.retiradas }, previsao.retiradas)
            }}
          </li>

          <li class="numero">
            <i class="ph ph-lock-simple" aria-hidden="true" />
            {{
              t(
                'hotel.rotinaPadrao.preservadas',
                { total: previsao.preservadas },
                previsao.preservadas,
              )
            }}
          </li>

          <li v-if="previsao.hoje > 0" class="numero numero--turno">
            <i class="ph ph-warning-circle" aria-hidden="true" />
            {{ t('hotel.rotinaPadrao.noTurno', { total: previsao.hoje }, previsao.hoje) }}
          </li>
        </ul>

        <p class="previsao__nota">{{ t('hotel.rotinaPadrao.preservadasDica') }}</p>
      </section>

      <p v-if="erro" class="erro" role="alert">{{ erro }}</p>
    </div>

    <template #footer>
      <Button
        type="button"
        :label="t('hotel.rotinaPadrao.cancelar')"
        severity="secondary"
        text
        @click="emit('fechar')"
      />
      <Button
        type="button"
        :label="t('hotel.rotinaPadrao.publicar')"
        icon="ph ph-paper-plane-tilt"
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
  gap: 20px;
}

.campo {
  display: grid;
  justify-items: start;
  gap: 8px;
}

.campo__rotulo {
  color: var(--tinta-2);
  font-size: 12.5px;
  font-weight: 550;
}

.campo__dica,
.previsao__nota {
  margin: 0;
  color: var(--tinta-2);
  font-size: 13px;
  line-height: 1.45;
}

.previsao {
  display: grid;
  gap: 10px;
  padding: 14px 16px;
  border: 1px solid var(--linha);
  border-radius: 12px;
}

.previsao__titulo {
  margin: 0;
  color: var(--tinta);
  font-size: 15px;
  font-weight: 600;
}

.previsao__estado {
  margin: 0;
  color: var(--tinta-2);
  font-size: 14px;
}

.numeros {
  display: grid;
  margin: 0;
  padding: 0;
  gap: 4px;
  list-style: none;
}

.numero {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 34px;
  color: var(--tinta-2);
  font-size: 14.5px;
}

.numero i {
  font-size: 18px;
}

.numero--cria {
  color: var(--ok-tinta);
  font-weight: 600;
}

.numero--retira {
  color: var(--tinta);
  font-weight: 600;
}

.numero--turno {
  margin-top: 4px;
  padding: 8px 12px;
  border-radius: var(--raio-controle);
  background: var(--risco-fundo);
  color: var(--risco-tinta);
  font-weight: 600;
}

.erro {
  margin: 0;
  padding: 10px 12px;
  border-radius: var(--raio-controle);
  background: var(--risco-fundo);
  color: var(--risco-tinta);
  font-size: 13.5px;
  font-weight: 600;
}
</style>
