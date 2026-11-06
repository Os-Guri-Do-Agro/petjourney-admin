<script setup lang="ts">
/**
 * Um documento clínico (E4-06, PJ-0EK0TY; guia e4 8.1 a 8.3 e 9.1): escolher o tipo, preencher o
 * molde, salvar o rascunho e emitir com a senha da conta. Os campos são os do conteúdo do tipo; a
 * identidade (paciente, responsável, quem assina) o servidor lê do cadastro na emissão. Campo vazio
 * sai como linha para preencher à mão.
 *
 * Nos termos de consentimento e de recusa, "pedir o aceite pelo app" avisa o dono; a eutanásia é
 * só no balcão. O 422 do campo que falta destaca o campo.
 */
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import DatePicker from 'primevue/datepicker'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import Textarea from 'primevue/textarea'
import ToggleSwitch from 'primevue/toggleswitch'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import SenhaDaAssinatura from '@/components/atendimento/SenhaDaAssinatura.vue'
import { useSenhaDaAssinatura } from '@/components/atendimento/useSenhaDaAssinatura'
import CadastroGaveta from '@/components/cadastro/CadastroGaveta.vue'
import { lerErroDoCadastro } from '@/components/cadastro/erros-do-cadastro'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { motivoDaRecusa, useSeloDeAssinatura } from '@/composables/useSeloDeAssinatura'
import { ApiError } from '@/service/api'
import { novaChaveDeIdempotencia } from '@/service/idempotencia'
import {
  criarDocumento,
  editarDocumento,
  emitirDocumento,
  TIPOS_QUE_EMITEM,
  type ConteudoDoDocumento,
  type Documento,
  type TipoDeDocumento,
} from '@/service/parceiro/documentos-service'

const props = defineProps<{
  pacienteId: string
  atendimentoId?: string | null
  /** O rascunho a continuar; `null` começa um documento novo. */
  documento: Documento | null
  podeEmitir: boolean
}>()
const aberta = defineModel<boolean>('visible', { default: false })
const emit = defineEmits<{ gravado: [documento: Documento]; emitido: [documento: Documento] }>()

const { t } = useI18n()
const { parceiroQuery } = useParceiroPortal()
const senha = useSenhaDaAssinatura()
const selo = useSeloDeAssinatura()

/** Emitir pede o CRMV conferido: o botão fica, com o que falta (a regra do selo). */
const aguardaSelo = computed(() => props.podeEmitir && selo.atoAguarda('EMITIR_DOCUMENTO'))

/* ------------------------------------------------------------------------- os moldes */

type Campo = {
  nome: string
  tipo: 'texto' | 'textoLongo' | 'data' | 'sim' | 'destinacao' | 'exames'
  obrigatorio?: boolean
}

/** Os campos de cada molde, na ordem da folha (`Conteudo*Dto`). */
const MOLDES: Partial<Record<TipoDeDocumento, Campo[]>> = {
  ATESTADO_SAUDE: [
    { nome: 'dataDoExame', tipo: 'data', obrigatorio: true },
    { nome: 'semAlteracoes', tipo: 'sim' },
    { nome: 'constatacoes', tipo: 'textoLongo' },
    { nome: 'recomendacoes', tipo: 'textoLongo' },
    { nome: 'finalidade', tipo: 'texto' },
  ],
  ATESTADO_VIAGEM: [
    { nome: 'dataDoExame', tipo: 'data', obrigatorio: true },
    { nome: 'antirrabica', tipo: 'texto' },
    { nome: 'vermifugacao', tipo: 'texto' },
    { nome: 'validadeExigida', tipo: 'texto' },
    { nome: 'destino', tipo: 'texto' },
    { nome: 'finalidade', tipo: 'texto' },
  ],
  DECLARACAO_OBITO: [
    { nome: 'causaProvavel', tipo: 'textoLongo' },
    { nome: 'necropsiaRealizada', tipo: 'sim' },
    { nome: 'destinacao', tipo: 'destinacao' },
    { nome: 'observacoes', tipo: 'textoLongo' },
  ],
  COMPROVANTE_VACINACAO: [{ nome: 'observacoes', tipo: 'textoLongo' }],
  PEDIDO_EXAME: [
    { nome: 'exames', tipo: 'exames', obrigatorio: true },
    { nome: 'indicacao', tipo: 'textoLongo' },
    { nome: 'orientacoesDeColeta', tipo: 'textoLongo' },
  ],
  ENCAMINHAMENTO: [
    { nome: 'destinatario', tipo: 'texto' },
    { nome: 'motivo', tipo: 'textoLongo', obrigatorio: true },
    { nome: 'historico', tipo: 'textoLongo' },
    { nome: 'achados', tipo: 'textoLongo' },
    { nome: 'diagnostico', tipo: 'textoLongo' },
    { nome: 'medicacaoEmUso', tipo: 'textoLongo' },
    { nome: 'solicitacao', tipo: 'textoLongo', obrigatorio: true },
  ],
  TERMO_CONSENTIMENTO: [
    { nome: 'objeto', tipo: 'textoLongo', obrigatorio: true },
    { nome: 'detalhamento', tipo: 'textoLongo' },
  ],
  TERMO_RECUSA: [
    { nome: 'objeto', tipo: 'textoLongo', obrigatorio: true },
    { nome: 'detalhamento', tipo: 'textoLongo' },
  ],
  TERMO_EUTANASIA: [
    { nome: 'objeto', tipo: 'textoLongo', obrigatorio: true },
    { nome: 'detalhamento', tipo: 'textoLongo' },
  ],
}

const DESTINACOES = [
  'CREMACAO_INDIVIDUAL',
  'CREMACAO_COLETIVA',
  'SEPULTAMENTO',
  'RETIRADO_PELO_RESPONSAVEL',
] as const

/* ------------------------------------------------------------------------------ estado */

const tipo = ref<TipoDeDocumento | null>(null)
const valores = ref<Record<string, unknown>>({})
const exames = ref<string[]>([])
const novoExame = ref('')
const aceitePeloApp = ref(false)
const atual = ref<Documento | null>(null)
const faltando = ref<string[]>([])
const salvando = ref(false)
const erro = ref('')
let chave: string | null = null

watch(aberta, (agora) => {
  if (!agora) {
    senha.limpar()
    return
  }
  atual.value = props.documento
  tipo.value = props.documento?.tipo ?? null
  const conteudo = (props.documento?.conteudo ?? {}) as Record<string, unknown>
  valores.value = { ...conteudo }
  exames.value = Array.isArray(conteudo.exames)
    ? (conteudo.exames as { nome?: string }[]).map((item) => item.nome ?? '').filter(Boolean)
    : []
  if (typeof conteudo.dataDoExame === 'string') {
    const [a, m, d] = conteudo.dataDoExame.split('-').map(Number)
    valores.value.dataDoExame = new Date(a!, (m ?? 1) - 1, d ?? 1)
  }
  novoExame.value = ''
  aceitePeloApp.value = false
  faltando.value = []
  erro.value = ''
  chave = null
  senha.pedindo.value = props.podeEmitir
})

const campos = computed(() => (tipo.value ? (MOLDES[tipo.value] ?? []) : []))
const ehTermo = computed(() => tipo.value?.startsWith('TERMO_') ?? false)
const aceiteNoApp = computed(
  () => tipo.value === 'TERMO_CONSENTIMENTO' || tipo.value === 'TERMO_RECUSA',
)

const opcoesDeTipo = computed(() =>
  TIPOS_QUE_EMITEM.map((valor) => ({ valor, rotulo: t(`documentos.tipo.${valor}`) })),
)
const opcoesDeDestinacao = computed(() =>
  DESTINACOES.map((valor) => ({ valor, rotulo: t(`documentos.destinacao.${valor}`) })),
)

const hoje = new Date()

function iso(data: Date) {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`
}

/** O conteúdo do molde: texto vazio fica de fora (sai como linha para preencher à mão). */
function conteudo(): ConteudoDoDocumento {
  const saida: ConteudoDoDocumento = {}
  for (const campo of campos.value) {
    const valor = valores.value[campo.nome]
    if (campo.tipo === 'exames') {
      if (exames.value.length) saida.exames = exames.value.map((nome) => ({ nome }))
    } else if (campo.tipo === 'data') {
      if (valor instanceof Date) saida[campo.nome] = iso(valor)
    } else if (campo.tipo === 'sim') {
      if (valor === true) saida[campo.nome] = true
    } else if (typeof valor === 'string' && valor.trim()) {
      saida[campo.nome] = valor.trim()
    }
  }
  /* "Sem alterações" e constatações não andam juntas (CONTRADIZ_CONSTATACOES). */
  if (saida.semAlteracoes) delete saida.constatacoes
  return saida
}

function adicionarExame() {
  const nome = novoExame.value.trim()
  if (!nome || exames.value.length >= 20) return
  exames.value = [...exames.value, nome]
  novoExame.value = ''
}

function removerExame(indice: number) {
  exames.value = exames.value.filter((_, i) => i !== indice)
}

/* ---------------------------------------------------------------------------- gravar */

async function salvar(): Promise<Documento | null> {
  if (!tipo.value) return null
  if (atual.value) {
    atual.value = await editarDocumento(atual.value.id, { conteudo: conteudo() }, parceiroQuery())
  } else {
    atual.value = await criarDocumento(
      {
        tipo: tipo.value,
        pacienteId: props.pacienteId,
        ...(props.atendimentoId ? { atendimentoId: props.atendimentoId } : {}),
        conteudo: conteudo(),
      },
      parceiroQuery(),
    )
  }
  return atual.value
}

async function salvarRascunho() {
  erro.value = ''
  salvando.value = true
  try {
    const documento = await salvar()
    if (documento) {
      emit('gravado', documento)
      aberta.value = false
    }
  } catch (err) {
    erro.value = lerErroDoCadastro(err, t('documentos.erro.salvar')).mensagem
  } finally {
    salvando.value = false
  }
}

async function emitir() {
  erro.value = ''
  faltando.value = []
  if (!senha.senha.value) return
  salvando.value = true
  try {
    const documento = await salvar()
    if (!documento) return
    chave ??= novaChaveDeIdempotencia()
    const emitido = await emitirDocumento(
      documento.id,
      {
        senha: senha.senha.value,
        ...(aceiteNoApp.value && aceitePeloApp.value ? { aceitePeloApp: true } : {}),
      },
      chave,
      parceiroQuery(),
    )
    chave = null
    senha.concluir()
    aberta.value = false
    emit('emitido', emitido)
  } catch (err) {
    if (senha.tratar(err)) {
      chave = null
      return
    }
    chave = null
    const recusa = motivoDaRecusa(err)
    if (recusa) {
      erro.value = t(`documentos.selo.${recusa}`)
      return
    }
    const lido = lerErroDoCadastro(err, t('documentos.erro.emitir'))
    const detalhes = err instanceof ApiError ? (err.detalhes ?? {}) : {}
    if (lido.codigo === 'DOCUMENTO_CAMPO_OBRIGATORIO') {
      faltando.value = Array.isArray(detalhes.faltando) ? (detalhes.faltando as string[]) : []
      erro.value = t('documentos.erro.faltando')
      return
    }
    erro.value = lido.mensagem
  } finally {
    salvando.value = false
  }
}

const falta = (nome: string) => faltando.value.includes(nome)

/** O valor de um campo de data (o DatePicker quer Date ou nulo). */
function dataDe(nome: string) {
  const valor = valores.value[nome]
  return valor instanceof Date ? valor : null
}
</script>

<template>
  <CadastroGaveta
    v-model:visible="aberta"
    :titulo="atual ? t(`documentos.tipo.${atual.tipo}`) : t('documentos.novo')"
    icone="ph ph-file-text"
    largura="38rem"
  >
    <form id="documento-form" class="eg" novalidate @submit.prevent="emitir">
      <section v-if="!atual" class="eg__secao">
        <label class="eg__rotulo" for="doc-tipo">{{ t('documentos.qualTipo') }}</label>
        <Select
          v-model="tipo"
          input-id="doc-tipo"
          :options="opcoesDeTipo"
          option-label="rotulo"
          option-value="valor"
          :placeholder="t('documentos.escolherTipo')"
          :disabled="salvando"
        />
      </section>

      <p v-if="tipo" class="eg__dica">{{ t('documentos.identidade') }}</p>

      <template v-for="campo in campos" :key="campo.nome">
        <section v-if="campo.tipo === 'data'" class="eg__secao">
          <span :id="`doc-${campo.nome}`" class="eg__rotulo">{{
            t(`documentos.campo.${campo.nome}`)
          }}</span>
          <DatePicker
            :model-value="dataDe(campo.nome)"
            @update:model-value="valores[campo.nome] = $event"
            inline
            :max-date="hoje"
            :aria-labelledby="`doc-${campo.nome}`"
            :invalid="falta(campo.nome)"
            :disabled="salvando"
          />
        </section>
        <label v-else-if="campo.tipo === 'sim'" class="dg__sim" :for="`doc-${campo.nome}`">
          <Checkbox
            :model-value="valores[campo.nome] === true"
            @update:model-value="valores[campo.nome] = $event"
            :input-id="`doc-${campo.nome}`"
            binary
            :disabled="salvando"
          />
          <span>{{ t(`documentos.campo.${campo.nome}`) }}</span>
        </label>
        <section v-else-if="campo.tipo === 'destinacao'" class="eg__secao">
          <label class="eg__rotulo" :for="`doc-${campo.nome}`">{{
            t(`documentos.campo.${campo.nome}`)
          }}</label>
          <Select
            v-model="valores[campo.nome]"
            :input-id="`doc-${campo.nome}`"
            :options="opcoesDeDestinacao"
            option-label="rotulo"
            option-value="valor"
            show-clear
            :placeholder="t('documentos.destinacaoAMao')"
            :disabled="salvando"
          />
        </section>
        <section v-else-if="campo.tipo === 'exames'" class="eg__secao">
          <label class="eg__rotulo" for="doc-exame">{{ t('documentos.campo.exames') }}</label>
          <ul v-if="exames.length" class="dg__exames">
            <li v-for="(nome, indice) in exames" :key="`${nome}-${indice}`">
              <span>{{ nome }}</span>
              <Button
                type="button"
                size="small"
                severity="secondary"
                outlined
                icon="ph ph-x"
                :aria-label="t('documentos.removerExame', { nome })"
                @click="removerExame(indice)"
              />
            </li>
          </ul>
          <div class="dg__novo-exame">
            <InputText
              id="doc-exame"
              v-model="novoExame"
              :placeholder="t('documentos.exameDica')"
              :invalid="falta('exames') && !exames.length"
              :disabled="salvando"
              @keydown.enter.prevent="adicionarExame"
            />
            <Button
              type="button"
              severity="secondary"
              outlined
              icon="ph ph-plus"
              :label="t('documentos.adicionarExame')"
              :disabled="!novoExame.trim()"
              @click="adicionarExame"
            />
          </div>
        </section>
        <section v-else class="eg__secao">
          <label class="eg__rotulo" :for="`doc-${campo.nome}`">
            {{ t(`documentos.campo.${campo.nome}`) }}
            <span v-if="!campo.obrigatorio" class="eg__opcional">{{ t('cadastro.opcional') }}</span>
          </label>
          <Textarea
            v-if="campo.tipo === 'textoLongo'"
            :id="`doc-${campo.nome}`"
            :model-value="(valores[campo.nome] as string | undefined) ?? ''"
            @update:model-value="valores[campo.nome] = $event"
            rows="3"
            auto-resize
            :invalid="falta(campo.nome)"
            :disabled="
              salvando || (campo.nome === 'constatacoes' && valores.semAlteracoes === true)
            "
          />
          <InputText
            v-else
            :id="`doc-${campo.nome}`"
            :model-value="(valores[campo.nome] as string | undefined) ?? ''"
            @update:model-value="valores[campo.nome] = $event"
            :invalid="falta(campo.nome)"
            :disabled="salvando"
          />
        </section>
      </template>

      <template v-if="tipo && podeEmitir">
        <label v-if="aceiteNoApp" class="dg__app" for="doc-app">
          <ToggleSwitch v-model="aceitePeloApp" input-id="doc-app" :disabled="salvando" />
          <span>
            <strong>{{ t('documentos.aceitePeloApp') }}</strong>
            <small>{{ t('documentos.aceitePeloAppDica') }}</small>
          </span>
        </label>
        <p v-else-if="ehTermo" class="eg__dica">{{ t('documentos.eutanasiaNoBalcao') }}</p>

        <p v-if="aguardaSelo" class="eg__aviso">
          <i class="ph ph-seal-warning" aria-hidden="true" />
          <span>{{ t(`documentos.selo.${selo.motivo.value ?? 'SEM_SELO'}`) }}</span>
        </p>

        <SenhaDaAssinatura
          id="doc-senha"
          v-model="senha.senha.value"
          :erro="senha.erroDaSenha.value"
          :sem-senha-propria="senha.semSenhaPropria.value"
          :desabilitado="salvando"
          :dica="t('documentos.senhaDica')"
        />
      </template>

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
        :label="t('documentos.salvarRascunho')"
        :disabled="!tipo || salvando"
        @click="salvarRascunho"
      />
      <Button
        v-if="podeEmitir"
        type="submit"
        form="documento-form"
        icon="ph ph-signature"
        :label="t('documentos.emitir')"
        :disabled="!tipo || !senha.senha.value || senha.semSenhaPropria.value"
        :loading="salvando"
      />
    </template>
  </CadastroGaveta>
</template>

<style scoped>
.dg__sim {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--tinta);
  font-size: 14px;
  cursor: pointer;
}

.dg__exames {
  display: grid;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.dg__exames li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  color: var(--tinta);
  font-size: 14px;
}

.dg__novo-exame {
  display: flex;
  gap: 8px;
}

.dg__novo-exame .p-inputtext {
  flex: 1 1 auto;
}

.dg__app {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  cursor: pointer;
}

.dg__app span {
  display: grid;
  gap: 2px;
}

.dg__app strong {
  color: var(--tinta);
  font-size: 14px;
  font-weight: 600;
}

.dg__app small {
  color: var(--tinta-2);
  font-size: 13px;
  line-height: 1.45;
}
</style>
