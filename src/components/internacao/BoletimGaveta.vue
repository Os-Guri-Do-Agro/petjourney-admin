<script setup lang="ts">
/**
 * Escrever o boletim ao responsável (E5-03a, guia e5 17.1). As sugestões vêm no idioma do
 * responsável; o que a enfermagem observou é texto **interno**: serve de ponto de partida, nunca
 * vai sem uma pessoa revisar. O boletim nasce rascunho, ou retido quando a ligação ainda é devida
 * (a piora ou a entrada crítica): aí só sai depois da ligação.
 */
import Button from 'primevue/button'
import Textarea from 'primevue/textarea'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import CadastroGaveta from '@/components/cadastro/CadastroGaveta.vue'
import { lerErroDoCadastro } from '@/components/cadastro/erros-do-cadastro'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { criarChaveadorDeIdempotencia } from '@/service/idempotencia'
import {
  comporBoletim,
  lerModelosDoBoletim,
  TEXTO_DO_BOLETIM_MAX,
  type Boletim,
  type ModelosDoBoletim,
} from '@/service/parceiro/boletins-da-internacao-service'

const props = defineProps<{ internacaoId: string; paciente: string }>()
const aberta = defineModel<boolean>('visible', { default: false })
const emit = defineEmits<{ escrito: [boletim: Boletim] }>()

const { t, locale } = useI18n()
const { parceiroQuery } = useParceiroPortal()
const chaveador = criarChaveadorDeIdempotencia()

const modelos = ref<ModelosDoBoletim | null>(null)
const texto = ref('')
const tentou = ref(false)
const salvando = ref(false)
const erro = ref('')

watch(aberta, async (agora) => {
  if (!agora) return
  texto.value = ''
  tentou.value = false
  erro.value = ''
  modelos.value = null
  chaveador.concluir()
  try {
    modelos.value = await lerModelosDoBoletim(props.internacaoId, parceiroQuery())
  } catch {
    modelos.value = null
  }
})

function usar(valor: string) {
  texto.value = texto.value.trim() ? `${texto.value.trim()}\n\n${valor}` : valor
}

const desde = computed(() =>
  modelos.value
    ? new Date(modelos.value.periodoDesde).toLocaleString(locale.value, {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '',
)

const valido = computed(() => texto.value.trim().length > 0)

async function escrever() {
  tentou.value = true
  erro.value = ''
  if (!valido.value) return
  const corpo = {
    texto: texto.value.trim(),
    ...(modelos.value ? { idioma: modelos.value.idioma } : {}),
  }
  salvando.value = true
  try {
    const boletim = await comporBoletim(
      props.internacaoId,
      corpo,
      chaveador.para(corpo),
      parceiroQuery(),
    )
    chaveador.concluir()
    aberta.value = false
    emit('escrito', boletim)
  } catch (err) {
    erro.value = lerErroDoCadastro(err, t('internacao.boletim.erroEscrever')).mensagem
  } finally {
    salvando.value = false
  }
}
</script>

<template>
  <CadastroGaveta
    v-model:visible="aberta"
    :titulo="t('internacao.boletim.escrever')"
    icone="ph ph-chat-text"
    largura="38rem"
  >
    <form id="boletim-form" class="eg" novalidate @submit.prevent="escrever">
      <p class="eg__dica">{{ t('internacao.boletim.escreverDica', { pet: paciente }) }}</p>

      <p v-if="modelos?.exigeLigacao" class="eg__aviso">
        <i class="ph ph-phone" aria-hidden="true" />
        <span>{{ t('internacao.boletim.vaiRetido') }}</span>
      </p>

      <section v-if="modelos?.sugestoes.length" class="eg__secao">
        <span class="eg__rotulo">{{ t('internacao.boletim.sugestoes') }}</span>
        <ul class="bg__sugestoes">
          <li v-for="item in modelos.sugestoes" :key="item.chave">
            <p>{{ item.texto }}</p>
            <Button
              type="button"
              size="small"
              severity="secondary"
              outlined
              :label="t('internacao.boletim.usar')"
              :disabled="salvando"
              @click="usar(item.texto)"
            />
          </li>
        </ul>
      </section>

      <section v-if="modelos?.observadoDaUltimaEvolucao" class="eg__secao bg__interno">
        <span class="eg__rotulo">{{ t('internacao.boletim.observadoInterno') }}</span>
        <p>{{ modelos.observadoDaUltimaEvolucao }}</p>
        <small class="eg__dica">{{ t('internacao.boletim.observadoDica') }}</small>
        <Button
          type="button"
          size="small"
          severity="secondary"
          outlined
          class="bg__usar"
          :label="t('internacao.boletim.usarComoBase')"
          :disabled="salvando"
          @click="usar(modelos.observadoDaUltimaEvolucao)"
        />
      </section>

      <p v-if="modelos" class="eg__dica">
        {{
          t(
            'internacao.boletim.doses',
            { n: modelos.dosesDadasNoPeriodo, desde },
            modelos.dosesDadasNoPeriodo,
          )
        }}
      </p>

      <section class="eg__secao">
        <label class="eg__rotulo" for="bg-texto">{{ t('internacao.boletim.texto') }}</label>
        <Textarea
          id="bg-texto"
          v-model="texto"
          rows="6"
          auto-resize
          :maxlength="TEXTO_DO_BOLETIM_MAX"
          :invalid="tentou && !valido"
          :disabled="salvando"
        />
        <small class="eg__dica">{{ t('internacao.boletim.textoDica') }}</small>
      </section>

      <p v-if="erro" class="eg__erro" role="alert">
        <i class="ph ph-warning-circle" aria-hidden="true" />
        <span>{{ erro }}</span>
      </p>
    </form>
    <template #pe>
      <Button
        type="button"
        severity="secondary"
        outlined
        :label="t('cadastro.cancelar')"
        :disabled="salvando"
        @click="aberta = false"
      />
      <Button
        type="submit"
        form="boletim-form"
        icon="ph ph-check"
        :label="t('internacao.boletim.salvar')"
        :loading="salvando"
      />
    </template>
  </CadastroGaveta>
</template>

<style scoped>
.bg__sugestoes {
  display: grid;
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.bg__sugestoes li {
  display: grid;
  gap: 8px;
  justify-items: start;
  padding: 10px 12px;
  border: 1px solid var(--linha);
  border-radius: var(--raio-controle);
}

.bg__sugestoes p,
.bg__interno p {
  margin: 0;
  color: var(--tinta);
  font-size: 14px;
  line-height: 1.5;
  white-space: pre-line;
}

.bg__interno {
  padding: 10px 12px;
  border: 1px dashed var(--linha-forte);
  border-radius: var(--raio-controle);
}

.bg__usar {
  justify-self: start;
}
</style>
