<script setup lang="ts">
/**
 * O envio da identidade (E1-08), numa gaveta ao lado de Configurações: documento com foto, selfie
 * segurando o documento e o CPF. Com um envio em análise, a gaveta mostra o envio e deixa
 * cancelar; aprovado, só mostra.
 *
 * O texto antes do botão é o aviso de privacidade da API, na versão que o envio manda
 * (`consentimentoVersaoAtual`), no idioma da sessão: nada dele mora no front. Também é da API o
 * texto do botão ("Li e entendi, enviar"). É um aviso, não um consentimento: sem caixa de "aceito".
 */
import Button from 'primevue/button'
import Drawer from 'primevue/drawer'
import InputMask from 'primevue/inputmask'
import InputText from 'primevue/inputtext'
import Skeleton from 'primevue/skeleton'
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { useSidePanelOffset } from '@/composables/useSidePanelOffset'
import { useTelaLarga } from '@/composables/useTelaLarga'
import { INTL_LOCALE, isRTLLocale, type Locale } from '@/i18n/locales'
import { ApiError } from '@/service/api'
import {
  cancelarIdentidade,
  enviarIdentidade,
  obterAvisoDaIdentidade,
  TAMANHO_MAXIMO,
  TIPOS_DA_FOTO,
  TIPOS_DO_DOCUMENTO,
  type AvisoDaIdentidade,
  type IdentidadeDaPessoa,
} from '@/service/parceiro/identidade-service'
import { isValidCpf } from '@/utils/validation/cpf'

import '@/components/parceiro/estabelecimento/gaveta.css'

type Campo = 'documento' | 'documentoVerso' | 'selfie'

const props = defineProps<{
  identidade: IdentidadeDaPessoa | null
  nomeSugerido: string
  cpfSugerido: string
}>()

const emit = defineEmits<{ atualizada: [identidade: IdentidadeDaPessoa | null] }>()

const visible = defineModel<boolean>('visible', { default: false })

const LARGURA = '30rem'

const { t, locale } = useI18n()
const telaLarga = useTelaLarga()

useSidePanelOffset(
  computed(() => visible.value && telaLarga.value),
  LARGURA,
)

const posicao = computed(() => (isRTLLocale(locale.value as Locale) ? 'left' : 'right'))
const intl = computed(() => INTL_LOCALE[locale.value as Locale])

const verificacao = computed(() => props.identidade?.verificacao ?? null)
const status = computed(() => verificacao.value?.status ?? null)

/** Enviar de novo é para quem nunca enviou e para o envio que acabou sem aprovação. */
const podeEnviar = computed(
  () => status.value === null || ['RECUSADA', 'CANCELADA', 'REVOGADA'].includes(status.value),
)

/* ------------------------------------------------------------------------------- o aviso */

const aviso = ref<AvisoDaIdentidade | null>(null)
const carregandoAviso = ref(false)
const erroDoAviso = ref(false)

async function carregarAviso() {
  const versao = props.identidade?.consentimentoVersaoAtual
  if (!versao) return

  carregandoAviso.value = true
  erroDoAviso.value = false

  try {
    aviso.value = await obterAvisoDaIdentidade(versao)
  } catch {
    erroDoAviso.value = true
  } finally {
    carregandoAviso.value = false
  }
}

/* O aviso vem no idioma da sessão: trocar o idioma pede o texto de novo. */
watch(locale, () => {
  if (visible.value && podeEnviar.value) void carregarAviso()
})

/* ------------------------------------------------------------------------------- o formulário */

const form = reactive({
  nome: '',
  cpf: '',
  documento: null as File | null,
  documentoVerso: null as File | null,
  selfie: null as File | null,
})

const erros = reactive<Partial<Record<'nome' | 'cpf' | Campo, string>>>({})
const erroGeral = ref('')
const enviando = ref(false)
const tentouEnviar = ref(false)

/* O erro de um campo sai assim que a pessoa mexe nele: o aviso velho não fica sobre o valor novo. */
watch(
  () => form.nome,
  () => {
    erros.nome = ''
  },
)
watch(
  () => form.cpf,
  () => {
    erros.cpf = ''
  },
)

const entradas: Partial<Record<Campo, HTMLInputElement | null>> = {}

function guardarEntrada(campo: Campo) {
  return (elemento: unknown) => {
    entradas[campo] = elemento as HTMLInputElement | null
  }
}

function aceitos(campo: Campo) {
  return campo === 'selfie' ? TIPOS_DA_FOTO : TIPOS_DO_DOCUMENTO
}

function escolher(campo: Campo) {
  entradas[campo]?.click()
}

function aoEscolher(campo: Campo, evento: Event) {
  const entrada = evento.target as HTMLInputElement
  const arquivo = entrada.files?.[0] ?? null
  entrada.value = ''

  if (!arquivo) return

  if (!aceitos(campo).split(',').includes(arquivo.type)) {
    erros[campo] = t(
      campo === 'selfie'
        ? 'settings.identidade.erros.tipoFoto'
        : 'settings.identidade.erros.tipoDocumento',
    )
    return
  }

  if (arquivo.size > TAMANHO_MAXIMO) {
    erros[campo] = t('settings.identidade.erros.tamanho')
    return
  }

  erros[campo] = ''
  form[campo] = arquivo
}

function remover(campo: Campo) {
  form[campo] = null
  erros[campo] = ''
}

function tamanho(arquivo: File) {
  const mb = arquivo.size / (1024 * 1024)

  return mb >= 1
    ? `${mb.toLocaleString(intl.value, { maximumFractionDigits: 1 })} MB`
    : `${Math.max(1, Math.round(arquivo.size / 1024)).toLocaleString(intl.value)} KB`
}

function validar() {
  erros.nome = form.nome.trim().length >= 3 ? '' : t('settings.identidade.erros.nome')
  erros.cpf = isValidCpf(form.cpf) ? '' : t('settings.identidade.erros.cpf')
  erros.documento = form.documento ? erros.documento : t('settings.identidade.erros.faltando')
  erros.selfie = form.selfie ? erros.selfie : t('settings.identidade.erros.faltando')

  return !Object.values(erros).some(Boolean)
}

/** O erro da API no campo dele; o que não é de campo vai para o pé do formulário. */
function mostrarErro(erro: unknown) {
  const mensagem = erro instanceof Error ? erro.message : t('settings.identidade.erros.enviar')

  if (erro instanceof ApiError) {
    if (
      erro.codigo === 'IDENTIDADE_CPF_INVALIDO' ||
      erro.codigo === 'IDENTIDADE_CPF_DIFERENTE_DA_CONTA'
    ) {
      erros.cpf = mensagem
      return
    }

    if (erro.codigo === 'IDENTIDADE_NOME_INVALIDO') {
      erros.nome = mensagem
      return
    }

    const campo = erro.detalhes.campo

    if (
      erro.codigo === 'IDENTIDADE_ARQUIVO_INVALIDO' &&
      (campo === 'documento' || campo === 'documentoVerso' || campo === 'selfie')
    ) {
      erros[campo] = mensagem
      return
    }

    /* O aviso mudou de versão entre a leitura e o envio: o texto novo vem, e a pessoa lê de novo. */
    if (erro.codigo === 'IDENTIDADE_CONSENTIMENTO_OBRIGATORIO') {
      emit('atualizada', props.identidade)
      void carregarAviso()
    }
  }

  erroGeral.value = mensagem
}

async function enviar() {
  tentouEnviar.value = true
  erroGeral.value = ''

  if (!validar() || !aviso.value || !form.documento || !form.selfie) return

  enviando.value = true

  try {
    const resposta = await enviarIdentidade({
      cpf: form.cpf,
      nomeCompleto: form.nome,
      consentimentoVersao: aviso.value.versao,
      documento: form.documento,
      documentoVerso: form.documentoVerso,
      selfie: form.selfie,
    })

    form.documento = null
    form.documentoVerso = null
    form.selfie = null
    tentouEnviar.value = false
    emit('atualizada', resposta)
  } catch (erro) {
    mostrarErro(erro)
  } finally {
    enviando.value = false
  }
}

/* ------------------------------------------------------------------------------- cancelar */

const confirmandoCancelamento = ref(false)
const cancelando = ref(false)

async function cancelar() {
  cancelando.value = true
  erroGeral.value = ''

  try {
    await cancelarIdentidade()
    confirmandoCancelamento.value = false
    emit('atualizada', null)
  } catch (erro) {
    erroGeral.value = erro instanceof Error ? erro.message : t('settings.identidade.erros.enviar')
  } finally {
    cancelando.value = false
  }
}

/* ------------------------------------------------------------------------------- leitura */

function data(iso: string | null | undefined) {
  if (!iso) return ''

  return new Date(iso).toLocaleDateString(intl.value, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

/* Ao abrir: o nome e o CPF do perfil de partida, e o aviso da versão que o envio vai mandar. */
watch(
  visible,
  (aberta) => {
    if (!aberta) return

    form.nome = form.nome || props.nomeSugerido
    form.cpf = form.cpf || props.cpfSugerido
    erroGeral.value = ''
    confirmandoCancelamento.value = false

    if (podeEnviar.value && !aviso.value) void carregarAviso()
  },
  { immediate: true },
)

/* Pelo link direto, a gaveta abre antes de o perfil chegar: o nome e o CPF entram quando vierem. */
watch(
  () => [props.nomeSugerido, props.cpfSugerido] as const,
  ([nome, cpf]) => {
    form.nome = form.nome || nome
    form.cpf = form.cpf || cpf
  },
)

/* O envio em análise foi cancelado com a gaveta aberta: o formulário volta, e o aviso com ele. */
watch(podeEnviar, (pode) => {
  if (pode && visible.value && !aviso.value) void carregarAviso()
})

const campos = computed(() => [
  {
    campo: 'documento' as const,
    rotulo: t('settings.identidade.gaveta.documento'),
    dica: t('settings.identidade.gaveta.documentoDica'),
    formatos: t('settings.identidade.gaveta.formatosDocumento'),
    opcional: false,
  },
  {
    campo: 'documentoVerso' as const,
    rotulo: t('settings.identidade.gaveta.verso'),
    dica: t('settings.identidade.gaveta.versoDica'),
    formatos: t('settings.identidade.gaveta.formatosDocumento'),
    opcional: true,
  },
  {
    campo: 'selfie' as const,
    rotulo: t('settings.identidade.gaveta.selfie'),
    dica: t('settings.identidade.gaveta.selfieDica'),
    formatos: t('settings.identidade.gaveta.formatosFoto'),
    opcional: false,
  },
])
</script>

<template>
  <Drawer
    v-model:visible="visible"
    :position="posicao"
    :modal="false"
    :dismissable="false"
    :block-scroll="false"
    class="identidade-gaveta"
    :style="{ width: `min(${LARGURA}, 100vw)` }"
  >
    <template #header>
      <h2 class="eg-titulo">
        <span class="ui-ladrilho ui-ladrilho--lugar" aria-hidden="true">
          <i class="ph ph-identification-card" />
        </span>
        {{ (podeEnviar && aviso?.titulo) || t('settings.identidade.titulo') }}
      </h2>
    </template>

    <div class="eg">
      <!-- O envio que existe: em análise, aprovado ou o que acabou sem aprovação. -->
      <section v-if="verificacao" class="ig__envio" :class="`ig__envio--${verificacao.status}`">
        <p class="ig__estado">
          <i
            :class="{
              'ph ph-hourglass-medium': verificacao.status === 'EM_ANALISE',
              'ph ph-seal-check': verificacao.status === 'APROVADA',
              'ph ph-x-circle': ['RECUSADA', 'REVOGADA'].includes(verificacao.status),
              'ph ph-clock-counter-clockwise': verificacao.status === 'CANCELADA',
            }"
            aria-hidden="true"
          />
          <span>{{ t(`settings.identidade.status.${verificacao.status}`) }}</span>
        </p>
        <dl class="ig__dados">
          <div v-if="verificacao.nomeCompleto">
            <dt>{{ t('settings.identidade.gaveta.nome') }}</dt>
            <dd>{{ verificacao.nomeCompleto }}</dd>
          </div>
          <div v-if="verificacao.cpfMascarado">
            <dt>{{ t('settings.identidade.gaveta.cpf') }}</dt>
            <dd dir="ltr" class="ui-num">{{ verificacao.cpfMascarado }}</dd>
          </div>
          <div>
            <dt>{{ t('settings.identidade.gaveta.enviadaEm') }}</dt>
            <dd>{{ data(verificacao.enviadaEm) }}</dd>
          </div>
          <div v-if="verificacao.status === 'EM_ANALISE' && verificacao.analiseExpiraEm">
            <dt>{{ t('settings.identidade.gaveta.prazo') }}</dt>
            <dd>{{ data(verificacao.analiseExpiraEm) }}</dd>
          </div>
          <div v-if="verificacao.decididaEm && verificacao.status !== 'EM_ANALISE'">
            <dt>{{ t('settings.identidade.gaveta.decididaEm') }}</dt>
            <dd>{{ data(verificacao.decididaEm) }}</dd>
          </div>
        </dl>

        <p v-if="verificacao.status === 'RECUSADA' && verificacao.motivoDecisao" class="ig__motivo">
          {{ t('settings.identidade.motivo', { motivo: verificacao.motivoDecisao }) }}
        </p>
        <p
          v-if="verificacao.status === 'REVOGADA' && verificacao.motivoRevogacao"
          class="ig__motivo"
        >
          {{ t('settings.identidade.motivo', { motivo: verificacao.motivoRevogacao }) }}
        </p>
        <p v-if="verificacao.motivoDoSistema === 'EXPIRADA'" class="ig__motivo">
          {{ t('settings.identidade.expirada') }}
        </p>
        <p v-if="verificacao.status === 'EM_ANALISE'" class="eg__dica">
          {{ t('settings.identidade.gaveta.emAnaliseDica') }}
        </p>
      </section>

      <form v-if="podeEnviar" id="identidade-envio" class="eg" novalidate @submit.prevent="enviar">
        <h3 v-if="verificacao" class="eg__grupo-titulo">
          {{ t('settings.identidade.gaveta.novoEnvio') }}
        </h3>

        <section class="eg__secao">
          <label class="eg__rotulo" for="identidade-nome">
            {{ t('settings.identidade.gaveta.nome') }}
          </label>
          <InputText
            id="identidade-nome"
            v-model="form.nome"
            autocomplete="name"
            maxlength="120"
            :invalid="tentouEnviar && Boolean(erros.nome)"
            :disabled="enviando"
          />
          <small v-if="tentouEnviar && erros.nome" class="eg__invalido">{{ erros.nome }}</small>
        </section>

        <section class="eg__secao">
          <label class="eg__rotulo" for="identidade-cpf">
            {{ t('settings.identidade.gaveta.cpf') }}
          </label>
          <InputMask
            id="identidade-cpf"
            v-model="form.cpf"
            mask="999.999.999-99"
            inputmode="numeric"
            :auto-clear="false"
            :invalid="tentouEnviar && Boolean(erros.cpf)"
            :disabled="enviando"
          />
          <small v-if="tentouEnviar && erros.cpf" class="eg__invalido">{{ erros.cpf }}</small>
          <small v-else class="eg__dica">{{ t('settings.identidade.gaveta.cpfDica') }}</small>
        </section>

        <section v-for="item in campos" :key="item.campo" class="eg__secao">
          <span :id="`identidade-${item.campo}-rotulo`" class="eg__rotulo">
            {{ item.rotulo }}
            <span v-if="item.opcional" class="eg__opcional">
              {{ t('settings.identidade.gaveta.opcional') }}
            </span>
          </span>
          <p class="eg__dica">{{ item.dica }}</p>

          <div v-if="form[item.campo]" class="ig__arquivo">
            <i
              :class="
                form[item.campo]?.type === 'application/pdf' ? 'ph ph-file-pdf' : 'ph ph-image'
              "
              aria-hidden="true"
            />
            <span class="ig__arquivo-nome">{{ form[item.campo]?.name }}</span>
            <span class="ig__arquivo-tamanho ui-num">{{ tamanho(form[item.campo]!) }}</span>
            <Button
              icon="ph ph-x"
              severity="secondary"
              outlined
              size="small"
              :aria-label="t('settings.identidade.gaveta.remover', { arquivo: item.rotulo })"
              :disabled="enviando"
              @click="remover(item.campo)"
            />
          </div>
          <Button
            v-else
            icon="ph ph-upload-simple"
            :label="t('settings.identidade.gaveta.escolher')"
            severity="secondary"
            outlined
            class="ig__escolher"
            :aria-describedby="`identidade-${item.campo}-rotulo`"
            :disabled="enviando"
            @click="escolher(item.campo)"
          />
          <small v-if="erros[item.campo]" class="eg__invalido">{{ erros[item.campo] }}</small>
          <small v-else class="eg__dica">{{ item.formatos }}</small>

          <!--
            Nativo e escondido, como a foto do perfil: o botão acima é o controle. O `accept` não lista
            HEIC, e o Safari do iPhone entrega JPEG.
          -->
          <input
            :ref="guardarEntrada(item.campo)"
            class="ig__entrada"
            type="file"
            :accept="aceitos(item.campo)"
            tabindex="-1"
            aria-hidden="true"
            @change="aoEscolher(item.campo, $event)"
          />
        </section>

        <section class="ig__aviso" aria-live="polite">
          <template v-if="carregandoAviso">
            <Skeleton height="1rem" width="60%" />
            <Skeleton height="4.5rem" />
            <Skeleton height="4.5rem" />
          </template>
          <p v-else-if="erroDoAviso" class="eg__erro">
            <i class="ph ph-warning-circle" aria-hidden="true" />
            <span>{{ t('settings.identidade.erros.aviso') }}</span>
            <Button
              :label="t('settings.identidade.acoes.tentarDeNovo')"
              severity="secondary"
              outlined
              size="small"
              @click="carregarAviso"
            />
          </p>
          <p v-else-if="aviso" class="ig__aviso-texto">{{ aviso.texto }}</p>
        </section>
      </form>

      <p v-if="erroGeral" class="eg__erro" role="alert">
        <i class="ph ph-warning-circle" aria-hidden="true" />
        <span>{{ erroGeral }}</span>
      </p>

      <p v-if="confirmandoCancelamento" class="eg__aviso" role="alert">
        <i class="ph ph-warning" aria-hidden="true" />
        <span>{{ t('settings.identidade.acoes.confirmarCancelamento') }}</span>
      </p>
    </div>

    <template #footer>
      <div class="eg__pe">
        <template v-if="podeEnviar">
          <Button
            type="button"
            :label="t('settings.identidade.acoes.fechar')"
            severity="secondary"
            outlined
            :disabled="enviando"
            @click="visible = false"
          />
          <Button
            type="submit"
            form="identidade-envio"
            icon="ph ph-paper-plane-tilt"
            :label="aviso?.botao || t('settings.identidade.acoes.enviar')"
            :loading="enviando"
            :disabled="!aviso"
          />
        </template>
        <template v-else-if="status === 'EM_ANALISE'">
          <template v-if="confirmandoCancelamento">
            <Button
              type="button"
              :label="t('settings.identidade.acoes.voltar')"
              severity="secondary"
              outlined
              :disabled="cancelando"
              @click="confirmandoCancelamento = false"
            />
            <Button
              type="button"
              icon="ph ph-trash"
              :label="t('settings.identidade.acoes.cancelarEnvio')"
              severity="danger"
              :loading="cancelando"
              @click="cancelar"
            />
          </template>
          <template v-else>
            <Button
              type="button"
              icon="ph ph-x"
              :label="t('settings.identidade.acoes.cancelarEnvio')"
              severity="danger"
              outlined
              @click="confirmandoCancelamento = true"
            />
            <Button
              type="button"
              :label="t('settings.identidade.acoes.fechar')"
              @click="visible = false"
            />
          </template>
        </template>
        <Button
          v-else
          type="button"
          :label="t('settings.identidade.acoes.fechar')"
          @click="visible = false"
        />
      </div>
    </template>
  </Drawer>
</template>

<style scoped>
.ig__envio {
  display: grid;
  gap: 12px;
  padding: 16px;
  border-radius: 16px;
  background: var(--superficie-2);
}

.ig__estado {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  color: var(--tinta);
  font-size: 15px;
  font-weight: 650;
}

.ig__estado i {
  font-size: 20px;
}

.ig__envio--EM_ANALISE .ig__estado i {
  color: var(--atencao-tinta);
}

.ig__envio--APROVADA .ig__estado i {
  color: var(--ok-tinta);
}

.ig__envio--RECUSADA .ig__estado i,
.ig__envio--REVOGADA .ig__estado i {
  color: var(--risco-tinta);
}

.ig__envio--CANCELADA .ig__estado i {
  color: var(--tinta-2);
}

.ig__dados {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
  gap: 10px 16px;
  margin: 0;
}

.ig__dados dt {
  color: var(--tinta-2);
  font-size: 12.5px;
}

.ig__dados dd {
  margin: 2px 0 0;
  color: var(--tinta);
  font-size: 14px;
  font-weight: 600;
}

.ig__motivo {
  margin: 0;
  color: var(--tinta);
  font-size: 13.5px;
  line-height: 1.5;
}

.ig__arquivo {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  padding: 8px 8px 8px 12px;
  border: 1px solid var(--linha);
  border-radius: 12px;
}

.ig__arquivo > i {
  color: var(--tinta-2);
  font-size: 20px;
}

.ig__arquivo-nome {
  overflow: hidden;
  flex: 1;
  min-width: 0;
  color: var(--tinta);
  font-size: 13.5px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ig__arquivo-tamanho {
  color: var(--tinta-2);
  font-size: 12.5px;
}

.ig__escolher {
  justify-self: start;
}

.ig__entrada {
  display: none;
}

.ig__aviso {
  display: grid;
  gap: 10px;
  padding-top: 16px;
  border-top: 1px solid var(--linha-suave);
}

/* Os parágrafos do aviso vêm separados por linha em branco: a quebra é do texto da API. */
.ig__aviso-texto {
  margin: 0;
  color: var(--tinta);
  font-size: 13.5px;
  line-height: 1.55;
  white-space: pre-line;
}
</style>
