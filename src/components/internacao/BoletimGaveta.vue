<script setup lang="ts">
/**
 * Escrever o boletim ao responsável (E5-03a, guia e5 17.1). As sugestões vêm no idioma do
 * responsável; o que a enfermagem observou é texto **interno**: serve de ponto de partida, nunca
 * vai sem uma pessoa revisar. O boletim nasce rascunho, ou retido quando a ligação ainda é devida
 * (a piora ou a entrada crítica): aí só sai depois da ligação.
 */
import Button from 'primevue/button'
import Skeleton from 'primevue/skeleton'
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
import { formatarNaParede, intlDe } from '@/utils/format/parede'

const props = defineProps<{ internacaoId: string; paciente: string }>()
const aberta = defineModel<boolean>('visible', { default: false })
const emit = defineEmits<{ escrito: [boletim: Boletim] }>()

const { t, locale } = useI18n()
const { parceiroQuery } = useParceiroPortal()
const chaveador = criarChaveadorDeIdempotencia()

const modelos = ref<ModelosDoBoletim | null>(null)
/*
 * As sugestões levam uns 2 s para chegar (26/11/2026, API de dev): sem nada no lugar, parecia que
 * não havia sugestão ou que tinha quebrado. Enquanto lê, o lugar delas já aparece, com o esqueleto
 * e "Preparando as sugestões"; se a leitura falha, um aviso com "Tentar de novo" (antes, sumia).
 */
const lendoModelos = ref(false)
const falhouModelos = ref(false)
/** A leitura que vale: abrir de novo antes da resposta descarta a anterior. */
let leitura = 0

const texto = ref('')
const tentou = ref(false)
const salvando = ref(false)
const erro = ref('')

async function lerModelos() {
  const minha = ++leitura
  lendoModelos.value = true
  falhouModelos.value = false
  modelos.value = null
  try {
    const lidos = await lerModelosDoBoletim(props.internacaoId, parceiroQuery())
    if (minha === leitura) modelos.value = lidos
  } catch {
    if (minha === leitura) falhouModelos.value = true
  } finally {
    if (minha === leitura) lendoModelos.value = false
  }
}

watch(aberta, (agora) => {
  if (!agora) return
  texto.value = ''
  tentou.value = false
  erro.value = ''
  chaveador.concluir()
  void lerModelos()
})

function usar(valor: string) {
  texto.value = texto.value.trim() ? `${texto.value.trim()}\n\n${valor}` : valor
}

const desde = computed(() =>
  modelos.value
    ? formatarNaParede(modelos.value.periodoDesde, intlDe(locale.value), {
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

      <!-- Lendo: o lugar das sugestões já aparece, com o desenho delas. -->
      <section v-if="lendoModelos" class="eg__secao" aria-busy="true">
        <span class="eg__rotulo">{{ t('internacao.boletim.sugestoes') }}</span>
        <ul class="bg__sugestoes" aria-hidden="true">
          <li v-for="n in 2" :key="n" class="bg__esqueleto">
            <Skeleton width="100%" height="0.9rem" />
            <Skeleton :width="n === 1 ? '62%' : '48%'" height="0.9rem" />
            <Skeleton width="4.25rem" height="2rem" border-radius="999px" />
          </li>
        </ul>
        <small class="eg__dica bg__preparando" role="status">
          <i class="ph ph-spinner-gap" aria-hidden="true" />
          {{ t('internacao.boletim.preparando') }}
        </small>
      </section>

      <div v-else-if="falhouModelos" class="eg__aviso bg__falhou" role="alert">
        <i class="ph ph-warning-circle" aria-hidden="true" />
        <span>{{ t('internacao.boletim.semSugestoes') }}</span>
        <Button
          type="button"
          size="small"
          severity="secondary"
          outlined
          icon="ph ph-arrow-clockwise"
          :label="t('internacao.boletim.tentarDeNovo')"
          :disabled="salvando"
          @click="lerModelos"
        />
      </div>

      <section v-else-if="modelos?.sugestoes.length" class="eg__secao">
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

/* O esqueleto tem a altura de uma sugestão de duas linhas: o campo de texto não pula quando chegam. */
.bg__esqueleto {
  gap: 9px;
  padding-block: 12px;
}

.bg__preparando {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.bg__preparando i {
  animation: ph-giro 1s linear infinite;
}

.bg__falhou {
  align-items: center;
  flex-wrap: wrap;
}

.bg__falhou span {
  flex: 1 1 14rem;
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
