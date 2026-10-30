<script setup lang="ts">
/**
 * O convite para a equipe, numa gaveta ao lado da lista: o e-mail, o papel escolhido em cartão e
 * o envio. O convite vai para qualquer e-mail, com ou sem conta; a API responde igual nos dois
 * casos, então a tela nunca diz "usuário não encontrado".
 *
 * Erro é decidido pelo `codigo`: `CONVITE_JA_PENDENTE` oferece reenviar o convite que já existe
 * para o endereço, em vez de só avisar. O texto mostrado é a `message` da API, já traduzida.
 */
import Button from 'primevue/button'
import Drawer from 'primevue/drawer'
import InputText from 'primevue/inputtext'
import RadioButton from 'primevue/radiobutton'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { useSidePanelOffset } from '@/composables/useSidePanelOffset'
import { useTelaLarga } from '@/composables/useTelaLarga'
import { ApiError } from '@/service/api'
import type { PapelParceiro } from '@/service/parceiro/types'

const props = defineProps<{
  enviando: boolean
  /** O erro do último envio, já com o código da API. */
  erro: ApiError | Error | null
}>()

const emit = defineEmits<{
  enviar: [payload: { email: string; papel: PapelParceiro }]
  reenviarPendente: [email: string]
}>()

const visible = defineModel<boolean>('visible', { default: false })

const LARGURA = '26.5rem'
const PAPEIS: PapelParceiro[] = ['OPERADOR', 'DONO']
const ICONE_DO_PAPEL: Record<PapelParceiro, string> = {
  OPERADOR: 'ph ph-user',
  DONO: 'ph ph-crown-simple',
}

const { t } = useI18n()
const telaLarga = useTelaLarga()

useSidePanelOffset(
  computed(() => visible.value && telaLarga.value),
  LARGURA,
)

/* "right" é o fim da linha nos dois sentidos de leitura: o árabe espelha no `main.css`. */
const drawerPosition = 'right'

const email = ref('')
const papel = ref<PapelParceiro>('OPERADOR')
const tentouEnviar = ref(false)

/* O mesmo filtro grosso do navegador: a API confere de verdade. */
const emailValido = computed(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim()))
const mostrarEmailInvalido = computed(() => tentouEnviar.value && !emailValido.value)

const jaPendente = computed(
  () => props.erro instanceof ApiError && props.erro.codigo === 'CONVITE_JA_PENDENTE',
)

function enviar() {
  tentouEnviar.value = true

  if (!emailValido.value || props.enviando) {
    return
  }

  emit('enviar', { email: email.value.trim(), papel: papel.value })
}

watch(visible, (aberta) => {
  if (aberta) {
    email.value = ''
    papel.value = 'OPERADOR'
    tentouEnviar.value = false
  }
})
</script>

<template>
  <Drawer
    v-model:visible="visible"
    :position="drawerPosition"
    :modal="false"
    :dismissable="false"
    :block-scroll="false"
    class="convite-gaveta"
    :style="{ width: `min(${LARGURA}, 100vw)` }"
  >
    <template #header>
      <h2 class="cg-titulo">
        <span class="ui-ladrilho ui-ladrilho--lugar" aria-hidden="true">
          <i class="ph ph-user-plus" />
        </span>
        {{ t('parceiro.equipe.gaveta.titulo') }}
      </h2>
    </template>

    <form id="convite-equipe" class="cg" novalidate @submit.prevent="enviar">
      <section class="cg__secao">
        <label class="cg__rotulo" for="convite-email">{{
          t('parceiro.equipe.gaveta.email')
        }}</label>
        <InputText
          id="convite-email"
          v-model="email"
          type="email"
          autocomplete="off"
          spellcheck="false"
          :invalid="mostrarEmailInvalido"
          :disabled="enviando"
          aria-describedby="convite-email-dica"
        />
        <small v-if="mostrarEmailInvalido" id="convite-email-dica" class="cg__invalido">
          {{ t('parceiro.equipe.gaveta.emailInvalido') }}
        </small>
        <small v-else id="convite-email-dica" class="cg__dica">
          {{ t('parceiro.equipe.gaveta.emailDica') }}
        </small>
      </section>

      <section class="cg__secao" role="radiogroup" aria-labelledby="convite-papel-rotulo">
        <span id="convite-papel-rotulo" class="cg__rotulo">{{
          t('parceiro.equipe.gaveta.papel')
        }}</span>
        <label
          v-for="opcao in PAPEIS"
          :key="opcao"
          class="cg__opcao"
          :class="{ 'cg__opcao--ativa': papel === opcao }"
        >
          <RadioButton
            v-model="papel"
            :input-id="`convite-papel-${opcao}`"
            name="convite-papel"
            :value="opcao"
            :disabled="enviando"
          />
          <span class="cg__opcao-texto">
            <strong>
              <i :class="ICONE_DO_PAPEL[opcao]" aria-hidden="true" />
              {{ t(`parceiro.equipe.papel.${opcao}`) }}
            </strong>
            <small>{{ t(`parceiro.equipe.papelDica.${opcao}`) }}</small>
          </span>
        </label>
      </section>

      <p class="cg__como">
        <i class="ph ph-envelope-simple" aria-hidden="true" />
        {{ t('parceiro.equipe.gaveta.comoFunciona') }}
      </p>

      <div v-if="erro" class="cg__erro" role="alert">
        <i class="ph ph-warning-circle" aria-hidden="true" />
        <span>
          {{ erro.message }}
          <Button
            v-if="jaPendente"
            type="button"
            class="cg__erro-acao"
            icon="ph ph-paper-plane-tilt"
            :label="t('parceiro.equipe.gaveta.reenviarPendente')"
            severity="secondary"
            outlined
            size="small"
            :disabled="enviando"
            @click="emit('reenviarPendente', email.trim())"
          />
        </span>
      </div>
    </form>

    <template #footer>
      <div class="cg__pe">
        <Button
          type="button"
          :label="t('parceiro.equipe.gaveta.cancelar')"
          severity="secondary"
          outlined
          :disabled="enviando"
          @click="visible = false"
        />
        <Button
          type="submit"
          form="convite-equipe"
          icon="ph ph-paper-plane-tilt"
          :label="t('parceiro.equipe.gaveta.enviar')"
          :loading="enviando"
        />
      </div>
    </template>
  </Drawer>
</template>

<style scoped>
.cg-titulo {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  margin: 0;
  color: var(--tinta);
  font-size: 18px;
  font-weight: 650;
  letter-spacing: -0.01em;
}

.cg {
  display: grid;
  gap: 22px;
  padding-bottom: 8px;
}

.cg__secao {
  display: grid;
  gap: 8px;
}

.cg__secao :deep(.p-inputtext) {
  width: 100%;
}

.cg__rotulo {
  color: var(--tinta);
  font-size: 13.5px;
  font-weight: 600;
}

.cg__dica,
.cg__invalido {
  font-size: 13px;
  line-height: 1.45;
}

.cg__dica {
  color: var(--tinta-2);
}

.cg__invalido {
  color: var(--risco-tinta);
}

/* O papel em cartão: a escolha muda o que a pessoa pode fazer, então a consequência fica à vista. */
.cg__opcao {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 14px 16px;
  border: 1px solid var(--linha);
  border-radius: 14px;
  background: var(--superficie);
  cursor: pointer;
}

.cg__opcao:hover {
  border-color: var(--linha-forte);
}

.cg__opcao--ativa,
.cg__opcao--ativa:hover {
  border-color: var(--musgo);
  box-shadow: 0 0 0 1px var(--musgo);
}

.cg__opcao:has(.p-radiobutton-input:focus-visible) {
  outline: 2px solid var(--musgo);
  outline-offset: 3px;
}

.cg__opcao :deep(.p-radiobutton) {
  flex: none;
  margin-top: 2px;
}

.cg__opcao-texto {
  display: grid;
  min-width: 0;
  gap: 3px;
}

.cg__opcao-texto strong {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--tinta);
  font-size: 14.5px;
  font-weight: 600;
}

.cg__opcao-texto strong i {
  color: var(--tinta-2);
  font-size: 16px;
}

.cg__opcao-texto small {
  color: var(--tinta-2);
  font-size: 13px;
  line-height: 1.45;
}

.cg__como {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin: 0;
  color: var(--tinta-2);
  font-size: 13.5px;
  line-height: 1.5;
}

.cg__como i {
  margin-top: 2px;
  color: var(--tinta-3);
  font-size: 16px;
}

.cg__erro {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  color: var(--tinta);
  font-size: 14px;
  line-height: 1.5;
}

.cg__erro > i {
  margin-top: 2px;
  color: var(--risco-tinta);
  font-size: 18px;
}

.cg__erro span {
  display: grid;
  justify-items: start;
  gap: 10px;
}

.cg__pe {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}
</style>
