<script setup lang="ts">
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import Textarea from 'primevue/textarea'
import { useToast } from 'primevue/usetoast'
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import PartnerPageFrame from '@/components/parceiro/PartnerPageFrame.vue'
import PartnerSectionTabs from '@/components/parceiro/PartnerSectionTabs.vue'
import PartnerStatusBadge from '@/components/parceiro/PartnerStatusBadge.vue'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { usePartnerTabs } from '@/composables/usePartnerTabs'
import { INTL_LOCALE, type Locale } from '@/i18n/locales'
import { ApiError } from '@/service/api'
import {
  criarAnotacao,
  getAnexoSignedUrl,
  getCompartilhamentoDetalhe,
} from '@/service/parceiro/compartilhamentos-service'
import type {
  CompartilhamentoDetalhe,
  ItemSnapshot,
  StatusCompartilhamento,
  TipoDocumentoAnexo,
} from '@/service/parceiro/types'

const DETALHE_TABS = ['resumo', 'anotacoes'] as const
type DetalheTab = (typeof DETALHE_TABS)[number]

const { t, locale } = useI18n()
const route = useRoute()
const router = useRouter()
const toast = useToast()
const { store, ensureContext, parceiroQuery } = useParceiroPortal()
const { activeTab, setTab } = usePartnerTabs(DETALHE_TABS, 'resumo')

const detalhe = ref<CompartilhamentoDetalhe | null>(null)
const loading = ref(true)
const error = ref('')

const MAX_ANEXOS = 3
const MAX_ANEXO_BYTES = 10 * 1024 * 1024
const MIMES_ACEITOS = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf']

const TIPOS_DOCUMENTO: TipoDocumentoAnexo[] = [
  'Receita Medica',
  'Exame de Sangue',
  'Raio-X',
  'Ultrassom',
  'Outro',
]

type AnexoForm = {
  file: File
  tipoDocumento: TipoDocumentoAnexo | null
}

const anotacaoForm = reactive({
  servicoRealizado: '',
  texto: '',
  profissionalNome: '',
})
const anexosForm = ref<AnexoForm[]>([])
const formError = ref('')
const submittingAnotacao = ref(false)
const abrindoAnexoId = ref<string | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)

const compartilhamentoId = computed(() =>
  typeof route.params.id === 'string' ? route.params.id : '',
)

const isAtivo = computed(() => detalhe.value?.status === 'ATIVO')

const anotacoesOrdenadas = computed(() =>
  [...(detalhe.value?.anotacoes ?? [])].sort(
    (a, b) => new Date(b.criadaEm).getTime() - new Date(a.criadaEm).getTime(),
  ),
)

/** Encerrado não tem snapshot: só a aba de anotações faz sentido. */
const tabs = computed(() => {
  const resumo = {
    id: 'resumo',
    label: t('atendimentos.detalhe.tabs.resumo.label'),
    description: t('atendimentos.detalhe.tabs.resumo.description'),
  }
  const anotacoes = {
    id: 'anotacoes',
    label: `${t('atendimentos.detalhe.tabs.anotacoes.label')} (${anotacoesOrdenadas.value.length})`,
    description: t('atendimentos.detalhe.tabs.anotacoes.description'),
  }

  return isAtivo.value ? [resumo, anotacoes] : [anotacoes]
})

const displayTab = computed<DetalheTab>(() => (isAtivo.value ? activeTab.value : 'anotacoes'))

const tabsAriaLabel = computed(() =>
  t('frame.tabs.aria', { labels: tabs.value.map((tab) => tab.label).join(', ') }),
)

const servicoLabel = computed(() => {
  if (!detalhe.value) {
    return ''
  }

  if (detalhe.value.tipoServico === 'OUTRO' && detalhe.value.servicoOutroLabel) {
    return detalhe.value.servicoOutroLabel
  }

  return t(`atendimentos.servico.${detalhe.value.tipoServico}`)
})

function normalizeTutorText(value: string | null | undefined) {
  return value?.replace(/\s+/g, ' ').trim() ?? ''
}

const mensagemTutor = computed(() => normalizeTutorText(detalhe.value?.mensagemTutor))

const observacoesTutor = computed(() =>
  normalizeTutorText(detalhe.value?.snapshot?.observacoesTutor),
)

/** Evita dois blocos iguais quando a API espelha a mesma frase nos dois campos. */
const showObservacoesTutor = computed(() => {
  if (!observacoesTutor.value) {
    return false
  }

  return observacoesTutor.value.localeCompare(mensagemTutor.value, undefined, {
    sensitivity: 'accent',
  }) !== 0
})

type SnapshotListSection = {
  id: string
  title: string
  icon: string
  tone: 'warm' | 'default'
  items: ItemSnapshot[]
}

const snapshotListSections = computed<SnapshotListSection[]>(() => {
  const snapshot = detalhe.value?.snapshot

  if (!snapshot) {
    return []
  }

  const defs: Array<{
    id: keyof typeof snapshot & string
    key: string
    icon: string
    tone: 'warm' | 'default'
  }> = [
    { id: 'alergias', key: 'alergias', icon: 'pi pi-exclamation-triangle', tone: 'warm' },
    { id: 'vacinas', key: 'vacinas', icon: 'pi pi-shield', tone: 'default' },
    { id: 'medicamentos', key: 'medicamentos', icon: 'pi pi-inbox', tone: 'default' },
    { id: 'comportamento', key: 'comportamento', icon: 'pi pi-eye', tone: 'default' },
    { id: 'diagnosticos', key: 'diagnosticos', icon: 'pi pi-file-edit', tone: 'default' },
  ]

  return defs
    .map((def) => ({
      id: def.id,
      title: t(`atendimentos.snapshot.${def.key}`),
      icon: def.icon,
      tone: def.tone,
      items: (snapshot[def.id] as ItemSnapshot[] | undefined) ?? [],
    }))
    .filter((section) => section.items.length > 0)
})

/** Seções abertas: alergias sempre; demais só se a lista for curta. */
const openSections = ref<Record<string, boolean>>({})

watch(
  snapshotListSections,
  (sections) => {
    const next = { ...openSections.value }

    for (const section of sections) {
      if (!(section.id in next)) {
        next[section.id] = section.id === 'alergias' || section.items.length <= 2
      }
    }

    openSections.value = next
  },
  { immediate: true },
)

function toggleSection(id: string) {
  openSections.value = {
    ...openSections.value,
    [id]: !openSections.value[id],
  }
}

function isSectionOpen(id: string) {
  return Boolean(openSections.value[id])
}

const tiposDocumentoOptions = computed(() =>
  TIPOS_DOCUMENTO.map((value) => ({ value, label: value })),
)

function statusBadge(status: StatusCompartilhamento) {
  const map: Record<StatusCompartilhamento, 'ATIVO' | 'SUSPENSO' | 'REJEITADO'> = {
    ATIVO: 'ATIVO',
    EXPIRADO: 'SUSPENSO',
    REVOGADO: 'REJEITADO',
  }

  return map[status]
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString(INTL_LOCALE[locale.value as Locale], {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function expiraLabel(value: string) {
  const diffMs = new Date(value).getTime() - Date.now()

  if (Number.isNaN(diffMs) || diffMs <= 0) {
    return t('atendimentos.expira.expirado')
  }

  const totalMinutes = Math.floor(diffMs / 60_000)
  const days = Math.floor(totalMinutes / 1440)
  const hours = Math.floor((totalMinutes % 1440) / 60)
  const minutes = totalMinutes % 60

  if (days > 0) {
    return t('atendimentos.expira.dias', { d: days, h: hours })
  }

  if (hours > 0) {
    return t('atendimentos.expira.horas', { h: hours, m: minutes })
  }

  return t('atendimentos.expira.minutos', { m: Math.max(minutes, 1) })
}

function resetAnotacaoForm() {
  anotacaoForm.servicoRealizado = ''
  anotacaoForm.texto = ''
  anotacaoForm.profissionalNome = ''
  anexosForm.value = []
  formError.value = ''

  if (fileInput.value) {
    fileInput.value.value = ''
  }
}

async function loadDetalhe() {
  const id = compartilhamentoId.value

  if (!id) {
    void router.replace('/parceiro/atendimentos')
    return
  }

  loading.value = true
  error.value = ''
  detalhe.value = null

  try {
    await ensureContext()
    detalhe.value = await getCompartilhamentoDetalhe(id, parceiroQuery())
  } catch (err) {
    error.value = err instanceof Error ? err.message : t('atendimentos.detalhe.errorLoad')
  } finally {
    loading.value = false
  }
}

function voltar() {
  void router.push('/parceiro/atendimentos')
}

function onAnexosSelected(event: Event) {
  const input = event.target as HTMLInputElement
  const files = Array.from(input.files ?? [])
  formError.value = ''

  for (const file of files) {
    if (anexosForm.value.length >= MAX_ANEXOS) {
      formError.value = t('atendimentos.anotacao.maxAnexos', { n: MAX_ANEXOS })
      break
    }

    if (!MIMES_ACEITOS.includes(file.type)) {
      formError.value = t('atendimentos.anotacao.tipoInvalido', { nome: file.name })
      continue
    }

    if (file.size > MAX_ANEXO_BYTES) {
      formError.value = t('atendimentos.anotacao.tamanhoInvalido', { nome: file.name })
      continue
    }

    anexosForm.value.push({ file, tipoDocumento: null })
  }

  input.value = ''
}

function removeAnexo(index: number) {
  anexosForm.value.splice(index, 1)
}

async function submitAnotacao() {
  if (!detalhe.value) {
    return
  }

  const servico = anotacaoForm.servicoRealizado.trim()
  const texto = anotacaoForm.texto.trim()

  if (!servico || !texto) {
    formError.value = t('atendimentos.anotacao.camposObrigatorios')
    return
  }

  submittingAnotacao.value = true
  formError.value = ''

  try {
    const nova = await criarAnotacao(
      detalhe.value.id,
      {
        servicoRealizado: servico,
        texto,
        profissionalNome: anotacaoForm.profissionalNome.trim() || undefined,
        anexos: anexosForm.value.map((a) => a.file),
        tiposDocumento: anexosForm.value.map((a) => a.tipoDocumento),
      },
      parceiroQuery(),
    )

    detalhe.value = {
      ...detalhe.value,
      anotacoes: [nova, ...detalhe.value.anotacoes],
    }
    resetAnotacaoForm()
    toast.add({
      severity: 'success',
      summary: t('atendimentos.anotacao.criada'),
      life: 3500,
    })
  } catch (err) {
    if (err instanceof ApiError && err.statusCode === 409) {
      formError.value = t('atendimentos.anotacao.encerrado')
    } else {
      formError.value = err instanceof Error ? err.message : t('atendimentos.anotacao.erro')
    }
  } finally {
    submittingAnotacao.value = false
  }
}

async function abrirAnexo(anexoId: string) {
  if (!detalhe.value || abrindoAnexoId.value) {
    return
  }

  abrindoAnexoId.value = anexoId

  try {
    const { signedUrl } = await getAnexoSignedUrl(detalhe.value.id, anexoId, parceiroQuery())
    window.open(signedUrl, '_blank', 'noopener')
  } catch {
    toast.add({
      severity: 'warn',
      summary: t('atendimentos.anexo.indisponivel'),
      detail: t('atendimentos.anexo.indisponivelDetail'),
      life: 4500,
    })
  } finally {
    abrindoAnexoId.value = null
  }
}

function formatBytes(bytes: number) {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return `${Math.max(1, Math.round(bytes / 1024))} KB`
}

watch(compartilhamentoId, (id, oldId) => {
  if (id && id !== oldId) {
    resetAnotacaoForm()
    void loadDetalhe()
  }
})

onMounted(() => {
  void loadDetalhe()
})
</script>

<template>
  <PartnerPageFrame
    :subtitle="t('atendimentos.detalhe.subtitle')"
    :title="detalhe?.petNome ?? t('atendimentos.detalhe.title')"
    :loading="loading"
    :error="error"
    :no-partner-access="store.semAcessoParceiro"
    block-when-suspended
    @retry="loadDetalhe"
  >
    <template #actions>
      <Button
        :label="t('atendimentos.detalhe.back')"
        icon="pi pi-arrow-left"
        severity="secondary"
        @click="voltar"
      />
    </template>

    <template v-if="detalhe">
      <!-- Identidade do pet -->
      <section class="atd-hero" :data-status="detalhe.status">
        <div class="atd-hero__pet">
          <img
            v-if="detalhe.petFoto"
            :src="detalhe.petFoto"
            :alt="detalhe.petNome"
            class="atd-hero__foto"
          />
          <span v-else class="atd-hero__foto atd-hero__foto--empty" aria-hidden="true">
            <i class="pi pi-heart" />
          </span>

          <div class="atd-hero__identity">
            <div class="atd-hero__title-row">
              <strong>{{ detalhe.petNome }}</strong>
              <PartnerStatusBadge :status="statusBadge(detalhe.status)" />
            </div>

            <p class="atd-hero__subtitle">
              {{ detalhe.especieLabel }}
              <template v-if="isAtivo && detalhe.petCastrado != null">
                · {{ detalhe.petCastrado ? t('atendimentos.pet.castrado') : t('atendimentos.pet.naoCastrado') }}
              </template>
            </p>

            <div class="atd-hero__tags" :aria-label="t('atendimentos.detalhe.metaAria')">
              <span class="atd-hero__tag atd-hero__tag--service">
                <i class="pi pi-briefcase" aria-hidden="true" />
                {{ servicoLabel }}
              </span>
              <span v-if="isAtivo" class="atd-hero__tag atd-hero__tag--expiry">
                <i class="pi pi-clock" aria-hidden="true" />
                {{ expiraLabel(detalhe.expiraEm) }}
              </span>
            </div>
          </div>
        </div>
      </section>

      <!-- Encerrado -->
      <section v-if="!isAtivo" class="atd-closed" role="status">
        <i class="pi pi-lock" aria-hidden="true" />
        <div>
          <strong>{{ t('atendimentos.encerrado.title') }}</strong>
          <p>
            {{
              detalhe.status === 'REVOGADO'
                ? t('atendimentos.encerrado.revogado')
                : t('atendimentos.encerrado.expirado')
            }}
          </p>
        </div>
      </section>

      <PartnerSectionTabs
        :tabs="tabs"
        :active-tab="displayTab"
        :aria-label="tabsAriaLabel"
        @select="setTab($event as DetalheTab)"
      />

      <!-- Aba: resumo do pet -->
      <div v-if="displayTab === 'resumo' && detalhe.snapshot" class="atd-panel atd-resumo" role="tabpanel">
        <div class="atd-resumo__context">
          <section v-if="mensagemTutor" class="atd-callout">
            <header class="atd-callout__head">
              <span class="atd-callout__icon" aria-hidden="true">
                <i class="pi pi-comment" />
              </span>
              <h3>{{ t('atendimentos.detalhe.mensagemTutor') }}</h3>
            </header>
            <p>{{ mensagemTutor }}</p>
          </section>

          <section
            v-if="detalhe.snapshot.pesoKg != null"
            class="atd-fact"
            :aria-label="t('atendimentos.snapshot.peso')"
          >
            <span class="atd-fact__icon" aria-hidden="true">
              <i class="pi pi-chart-line" />
            </span>
            <div>
              <small>{{ t('atendimentos.snapshot.peso') }}</small>
              <strong>{{ detalhe.snapshot.pesoKg }} kg</strong>
            </div>
          </section>

          <section v-if="showObservacoesTutor" class="atd-callout atd-callout--soft">
            <header class="atd-callout__head">
              <span class="atd-callout__icon" aria-hidden="true">
                <i class="pi pi-info-circle" />
              </span>
              <h3>{{ t('atendimentos.snapshot.observacoes') }}</h3>
            </header>
            <p>{{ observacoesTutor }}</p>
          </section>
        </div>

        <section
          v-if="snapshotListSections.length"
          class="atd-clinical"
          aria-labelledby="atd-clinical-title"
        >
          <header class="atd-clinical__head">
            <div>
              <h2 id="atd-clinical-title">{{ t('atendimentos.snapshot.clinicalTitle') }}</h2>
              <p>{{ t('atendimentos.snapshot.clinicalLede') }}</p>
            </div>
            <span class="atd-clinical__count">{{
              t('atendimentos.snapshot.sectionsCount', { n: snapshotListSections.length })
            }}</span>
          </header>

          <div class="atd-folds">
            <section
              v-for="section in snapshotListSections"
              :key="section.id"
              class="atd-fold"
              :data-tone="section.tone"
              :data-open="isSectionOpen(section.id) ? 'true' : 'false'"
            >
              <h3 class="atd-fold__heading">
                <button
                  type="button"
                  class="atd-fold__trigger"
                  :aria-expanded="isSectionOpen(section.id)"
                  :aria-controls="`atd-fold-${section.id}`"
                  @click="toggleSection(section.id)"
                >
                  <span class="atd-fold__icon" aria-hidden="true">
                    <i :class="section.icon" />
                  </span>
                  <span class="atd-fold__copy">
                    <strong>{{ section.title }}</strong>
                    <small>{{
                      t('atendimentos.snapshot.itemsCount', { n: section.items.length })
                    }}</small>
                  </span>
                  <i
                    class="pi atd-fold__chevron"
                    :class="isSectionOpen(section.id) ? 'pi-chevron-up' : 'pi-chevron-down'"
                    aria-hidden="true"
                  />
                </button>
              </h3>

              <div
                v-show="isSectionOpen(section.id)"
                :id="`atd-fold-${section.id}`"
                class="atd-fold__body"
              >
                <div class="atd-fold__scroll" tabindex="0">
                  <ul
                    class="atd-items"
                    :class="{
                      'atd-items--grid': section.items.length > 3 && section.tone !== 'warm',
                    }"
                  >
                    <li
                      v-for="(item, index) in section.items"
                      :key="`${section.id}-${index}`"
                      :class="{ 'atd-item--destaque': item.destaque }"
                    >
                      <strong>{{ item.titulo }}</strong>
                      <span v-if="item.detalhe" class="atd-item__meta">{{ item.detalhe }}</span>
                    </li>
                  </ul>
                </div>
              </div>
            </section>
          </div>
        </section>
      </div>

      <!-- Aba: anotações -->
      <div v-else class="atd-panel atd-notes" role="tabpanel">
        <div class="atd-notes__layout" :class="{ 'atd-notes__layout--with-form': isAtivo }">
          <section class="atd-notes__feed" aria-labelledby="atd-notes-title">
            <header class="atd-notes__head">
              <div>
                <h2 id="atd-notes-title">{{ t('atendimentos.anotacoes.title') }}</h2>
                <p>{{ t('atendimentos.anotacoes.lede') }}</p>
              </div>
              <span v-if="anotacoesOrdenadas.length" class="atd-notes__count">{{
                t('atendimentos.anotacoes.count', { n: anotacoesOrdenadas.length })
              }}</span>
            </header>

            <div v-if="anotacoesOrdenadas.length === 0" class="atd-notes__empty">
              <span class="atd-notes__empty-icon" aria-hidden="true">
                <i class="pi pi-pencil" />
              </span>
              <strong>{{ t('atendimentos.anotacoes.empty') }}</strong>
              <p>
                {{
                  isAtivo
                    ? t('atendimentos.anotacoes.emptyHint')
                    : t('atendimentos.anotacoes.emptyHintClosed')
                }}
              </p>
            </div>

            <ol v-else class="atd-timeline">
              <li v-for="anotacao in anotacoesOrdenadas" :key="anotacao.id" class="atd-timeline__item">
                <span class="atd-timeline__rail" aria-hidden="true">
                  <span class="atd-timeline__dot" />
                </span>

                <article class="atd-note">
                  <header class="atd-note__head">
                    <div class="atd-note__title">
                      <span class="atd-note__service">{{ anotacao.servicoRealizado }}</span>
                      <time class="atd-note__time" :datetime="anotacao.criadaEm">{{
                        formatDateTime(anotacao.criadaEm)
                      }}</time>
                    </div>
                    <p class="atd-note__byline">
                      <i class="pi pi-building" aria-hidden="true" />
                      <span>{{ anotacao.empresaNome }}</span>
                      <template v-if="anotacao.profissionalNome">
                        <span class="atd-note__sep" aria-hidden="true">·</span>
                        <i class="pi pi-user" aria-hidden="true" />
                        <span>{{ anotacao.profissionalNome }}</span>
                      </template>
                    </p>
                  </header>

                  <p class="atd-note__body">{{ anotacao.texto }}</p>

                  <div v-if="anotacao.anexos.length" class="atd-note__files">
                    <p class="atd-note__files-label">
                      {{ t('atendimentos.anotacoes.anexosLabel') }}
                      <span>{{ anotacao.anexos.length }}</span>
                    </p>
                    <ul class="atd-note__attachments">
                      <li v-for="anexo in anotacao.anexos" :key="anexo.id">
                        <button
                          type="button"
                          class="atd-note__file"
                          :disabled="abrindoAnexoId === anexo.id"
                          :aria-label="`${t('atendimentos.anotacoes.abrirAnexo')}: ${anexo.nome}`"
                          @click="abrirAnexo(anexo.id)"
                        >
                          <span class="atd-note__file-icon" aria-hidden="true">
                            <i
                              :class="
                                abrindoAnexoId === anexo.id
                                  ? 'pi pi-spin pi-spinner'
                                  : 'pi pi-paperclip'
                              "
                            />
                          </span>
                          <span class="atd-note__file-copy">
                            <strong>{{ anexo.nome }}</strong>
                            <small>
                              <template v-if="anexo.tipoDocumento">
                                {{ anexo.tipoDocumento }} ·
                              </template>
                              {{ formatBytes(anexo.tamanhoBytes) }}
                            </small>
                          </span>
                          <i class="pi pi-external-link atd-note__file-go" aria-hidden="true" />
                        </button>
                      </li>
                    </ul>
                  </div>
                </article>
              </li>
            </ol>
          </section>

          <aside v-if="isAtivo" class="atd-composer" aria-labelledby="atd-composer-title">
            <header class="atd-composer__head">
              <span class="atd-composer__badge" aria-hidden="true">
                <i class="pi pi-plus" />
              </span>
              <div>
                <h3 id="atd-composer-title">{{ t('atendimentos.anotacao.title') }}</h3>
                <p>{{ t('atendimentos.anotacao.lede') }}</p>
              </div>
            </header>

            <p v-if="formError" class="atd-composer__error" role="alert">{{ formError }}</p>

            <div class="atd-composer__fields">
              <div class="atd-field">
                <label for="anot-servico">{{ t('atendimentos.anotacao.servico') }}</label>
                <InputText
                  id="anot-servico"
                  v-model="anotacaoForm.servicoRealizado"
                  :placeholder="t('atendimentos.anotacao.servicoPlaceholder')"
                />
              </div>

              <div class="atd-field">
                <label for="anot-texto">{{ t('atendimentos.anotacao.texto') }}</label>
                <Textarea
                  id="anot-texto"
                  v-model="anotacaoForm.texto"
                  rows="5"
                  auto-resize
                  :placeholder="t('atendimentos.anotacao.textoPlaceholder')"
                />
              </div>

              <div class="atd-field">
                <label for="anot-profissional">{{ t('atendimentos.anotacao.profissional') }}</label>
                <InputText
                  id="anot-profissional"
                  v-model="anotacaoForm.profissionalNome"
                  :placeholder="t('atendimentos.anotacao.profissionalPlaceholder')"
                />
              </div>

              <div class="atd-field atd-field--files">
                <span class="atd-field__label">
                  {{ t('atendimentos.anotacao.anexos', { n: MAX_ANEXOS }) }}
                </span>

                <ul v-if="anexosForm.length" class="atd-anexo-list">
                  <li v-for="(anexo, index) in anexosForm" :key="`${anexo.file.name}-${index}`">
                    <div class="atd-anexo-list__top">
                      <div class="atd-anexo-list__info">
                        <i class="pi pi-file" aria-hidden="true" />
                        <span>{{ anexo.file.name }}</span>
                        <small>{{ formatBytes(anexo.file.size) }}</small>
                      </div>
                      <Button
                        icon="pi pi-times"
                        severity="secondary"
                        text
                        rounded
                        :aria-label="t('atendimentos.anotacao.removerAnexo')"
                        @click="removeAnexo(index)"
                      />
                    </div>

                    <div class="atd-anexo-list__type">
                      <label :for="`anexo-tipo-${index}`">{{
                        t('atendimentos.anotacao.tipoDocumento')
                      }}</label>
                      <Select
                        :id="`anexo-tipo-${index}`"
                        v-model="anexo.tipoDocumento"
                        class="atd-anexo-list__select"
                        :options="tiposDocumentoOptions"
                        option-label="label"
                        option-value="value"
                        :placeholder="t('atendimentos.anotacao.tipoDocumentoPlaceholder')"
                        show-clear
                        size="small"
                      />
                    </div>
                  </li>
                </ul>

                <label v-if="anexosForm.length < MAX_ANEXOS" class="atd-file-cta">
                  <input
                    ref="fileInput"
                    type="file"
                    multiple
                    accept="image/jpeg,image/png,image/webp,image/heic,application/pdf"
                    @change="onAnexosSelected"
                  />
                  <i class="pi pi-paperclip" aria-hidden="true" />
                  {{ t('atendimentos.anotacao.adicionarAnexo') }}
                </label>
                <small class="atd-file-hint">
                  {{ t('atendimentos.anotacao.anexoHint') }}
                </small>
              </div>
            </div>

            <footer class="atd-composer__footer">
              <Button
                :label="t('atendimentos.anotacao.enviar')"
                icon="pi pi-check"
                :loading="submittingAnotacao"
                @click="submitAnotacao"
              />
            </footer>
          </aside>
        </div>
      </div>
    </template>
  </PartnerPageFrame>
</template>

<style scoped>
.atd-hero {
  padding: 1.1rem 1.2rem;
  border: 1px solid color-mix(in srgb, var(--partner-primary) 22%, var(--partner-line));
  border-radius: 1.1rem;
  background:
    linear-gradient(
      145deg,
      color-mix(in srgb, var(--partner-primary-soft) 35%, var(--partner-card)),
      var(--partner-card) 62%
    );
}

.atd-hero[data-status='EXPIRADO'],
.atd-hero[data-status='REVOGADO'] {
  border-color: var(--partner-line);
  background: var(--partner-surface);
}

.atd-hero__pet {
  display: flex;
  align-items: flex-start;
  gap: 0.95rem;
  min-width: 0;
}

.atd-hero__foto {
  width: 4rem;
  height: 4rem;
  flex: 0 0 auto;
  border-radius: 1.1rem;
  object-fit: cover;
}

.atd-hero__foto--empty {
  display: grid;
  place-items: center;
  background: color-mix(in srgb, var(--partner-primary) 16%, var(--partner-card));
  color: var(--partner-primary-strong);
  font-size: 1.35rem;
}

.atd-hero__identity {
  display: grid;
  gap: 0.35rem;
  min-width: 0;
  flex: 1;
}

.atd-hero__title-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.55rem 0.7rem;
}

.atd-hero__title-row strong {
  color: var(--partner-text);
  font-size: 1.2rem;
  letter-spacing: -0.02em;
  line-height: 1.2;
}

.atd-hero__subtitle {
  margin: 0;
  color: var(--partner-muted);
  font-size: 0.88rem;
  line-height: 1.35;
}

.atd-hero__tags {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem;
  margin-top: 0.2rem;
}

.atd-hero__tag {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  min-height: 1.7rem;
  padding: 0.28rem 0.65rem;
  border: 1px solid transparent;
  border-radius: 999px;
  font-size: 0.76rem;
  font-weight: 700;
  line-height: 1.2;
}

.atd-hero__tag i {
  font-size: 0.72rem;
}

.atd-hero__tag--service {
  border-color: color-mix(in srgb, var(--partner-primary) 22%, var(--partner-line));
  background: color-mix(in srgb, var(--partner-primary) 14%, var(--partner-card));
  color: var(--partner-primary-strong);
}

.atd-hero__tag--expiry {
  border-color: color-mix(in srgb, var(--partner-amber-text) 28%, var(--partner-line));
  background: color-mix(in srgb, var(--partner-amber-bg) 70%, var(--partner-card));
  color: var(--partner-amber-text);
}

.atd-closed {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 0.75rem;
  padding: 0.95rem 1.1rem;
  border: 1px solid var(--partner-line);
  border-radius: 0.95rem;
  background: var(--partner-surface);
  color: var(--partner-muted);
}

.atd-closed i {
  margin-top: 0.15rem;
}

.atd-closed strong {
  display: block;
  margin-bottom: 0.2rem;
  color: var(--partner-text);
  font-size: 0.9rem;
}

.atd-closed p {
  margin: 0;
  font-size: 0.86rem;
  line-height: 1.5;
}

.atd-panel {
  display: grid;
  gap: 1rem;
  grid-template-columns: minmax(0, 1fr);
}

.atd-resumo {
  gap: 1.15rem;
}

.atd-resumo__context {
  display: grid;
  gap: 0.75rem;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: start;
}

.atd-resumo__context:not(:has(.atd-fact)) {
  grid-template-columns: minmax(0, 1fr);
}

.atd-callout {
  display: grid;
  gap: 0.55rem;
  min-width: 0;
  padding: 0.95rem 1.05rem;
  border: 1px solid color-mix(in srgb, var(--partner-primary) 18%, var(--partner-line));
  border-radius: 1rem;
  background:
    linear-gradient(
      145deg,
      color-mix(in srgb, var(--partner-primary-soft) 28%, var(--partner-card)),
      var(--partner-card) 70%
    );
}

.atd-callout--soft {
  grid-column: 1 / -1;
  border-color: var(--partner-line);
  background: var(--partner-card);
}

.atd-callout__head {
  display: flex;
  align-items: center;
  gap: 0.55rem;
}

.atd-callout__icon {
  display: grid;
  width: 1.85rem;
  height: 1.85rem;
  place-items: center;
  border-radius: 0.65rem;
  background: color-mix(in srgb, var(--partner-primary) 16%, transparent);
  color: var(--partner-primary-strong);
  font-size: 0.85rem;
}

.atd-callout h3 {
  margin: 0;
  color: var(--partner-text);
  font-size: 0.84rem;
  font-weight: 750;
}

.atd-callout p {
  margin: 0;
  color: var(--partner-text);
  font-size: 0.95rem;
  font-weight: 500;
  line-height: 1.55;
  white-space: pre-line;
}

.atd-fact {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  min-width: 9.5rem;
  padding: 0.9rem 1rem;
  border: 1px solid var(--partner-line);
  border-radius: 1rem;
  background: var(--partner-card);
}

.atd-fact__icon {
  display: grid;
  width: 2.35rem;
  height: 2.35rem;
  place-items: center;
  border-radius: 0.75rem;
  background: color-mix(in srgb, var(--partner-primary) 16%, transparent);
  color: var(--partner-primary-strong);
}

.atd-fact small {
  display: block;
  color: var(--partner-faint);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.atd-fact strong {
  display: block;
  margin-top: 0.15rem;
  color: var(--partner-text);
  font-size: 1.2rem;
  font-weight: 750;
  letter-spacing: -0.02em;
}

.atd-clinical {
  display: grid;
  gap: 0.75rem;
}

.atd-clinical__head {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 0.65rem;
  padding-bottom: 0.55rem;
  border-bottom: 1px solid color-mix(in srgb, var(--partner-line) 85%, transparent);
}

.atd-clinical__head h2 {
  margin: 0;
  color: var(--partner-text);
  font-size: 1rem;
  font-weight: 750;
  letter-spacing: -0.02em;
}

.atd-clinical__head p {
  margin: 0.2rem 0 0;
  color: var(--partner-muted);
  font-size: 0.82rem;
  line-height: 1.4;
}

.atd-clinical__count {
  display: inline-flex;
  align-items: center;
  min-height: 1.7rem;
  padding: 0.2rem 0.55rem;
  border-radius: 999px;
  background: color-mix(in srgb, var(--partner-primary) 14%, transparent);
  color: var(--partner-primary-strong);
  font-size: 0.72rem;
  font-weight: 750;
}

.atd-folds {
  display: grid;
  gap: 0.55rem;
}

.atd-fold {
  border: 1px solid var(--partner-line);
  border-radius: 1rem;
  background: var(--partner-card);
  overflow: clip;
}

.atd-fold[data-tone='warm'] {
  border-color: color-mix(in srgb, var(--partner-warm-text) 28%, var(--partner-line));
}

.atd-fold[data-open='true'] {
  box-shadow: 0 10px 24px rgb(var(--partner-shadow-rgb) / 0.04);
}

.atd-fold__heading {
  margin: 0;
}

.atd-fold__trigger {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 0.75rem;
  padding: 0.85rem 0.95rem;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.atd-fold__trigger:hover,
.atd-fold__trigger:focus-visible {
  background: color-mix(in srgb, var(--partner-surface) 70%, transparent);
  outline: none;
}

.atd-fold__trigger:focus-visible {
  box-shadow: inset 0 0 0 2px color-mix(in srgb, var(--partner-primary) 45%, transparent);
}

.atd-fold__icon {
  display: grid;
  width: 2.2rem;
  height: 2.2rem;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 0.7rem;
  background: color-mix(in srgb, var(--partner-primary) 16%, transparent);
  color: var(--partner-primary-strong);
  font-size: 0.9rem;
}

.atd-fold[data-tone='warm'] .atd-fold__icon {
  background: color-mix(in srgb, var(--partner-warm-text) 16%, transparent);
  color: var(--partner-warm-text);
}

.atd-fold__copy {
  display: grid;
  gap: 0.1rem;
  min-width: 0;
  flex: 1;
}

.atd-fold__copy strong {
  color: var(--partner-text);
  font-size: 0.92rem;
  font-weight: 750;
  letter-spacing: -0.01em;
}

.atd-fold__copy small {
  color: var(--partner-faint);
  font-size: 0.74rem;
  font-weight: 600;
}

.atd-fold__chevron {
  color: var(--partner-faint);
  font-size: 0.78rem;
}

.atd-fold__body {
  padding: 0 0.55rem 0.75rem 0.85rem;
}

.atd-fold__scroll {
  max-height: min(14.5rem, 42vh);
  overflow-x: hidden;
  overflow-y: auto;
  padding: 0.1rem 0.45rem 0.15rem 0;
  border-radius: 0.75rem;
  overscroll-behavior: contain;
  scrollbar-width: thin;
  scrollbar-color: color-mix(in srgb, var(--partner-primary) 42%, transparent) transparent;
}

.atd-fold__scroll:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--partner-primary) 45%, transparent);
  outline-offset: 2px;
}

.atd-fold__scroll::-webkit-scrollbar {
  width: 0.4rem;
}

.atd-fold__scroll::-webkit-scrollbar-track {
  margin: 0.2rem 0;
  background: transparent;
}

.atd-fold__scroll::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: color-mix(in srgb, var(--partner-primary) 38%, var(--partner-line));
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--partner-card) 55%, transparent);
}

.atd-fold__scroll::-webkit-scrollbar-thumb:hover {
  background: color-mix(in srgb, var(--partner-primary-strong) 55%, var(--partner-line));
}

.atd-fold__scroll::-webkit-scrollbar-corner {
  background: transparent;
}

.atd-items {
  display: grid;
  gap: 0.4rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.atd-items--grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.atd-items li {
  display: grid;
  gap: 0.28rem;
  align-content: start;
  padding: 0.65rem 0.75rem;
  border: 1px solid color-mix(in srgb, var(--partner-line) 90%, transparent);
  border-radius: 0.8rem;
  background: color-mix(in srgb, var(--partner-surface) 72%, var(--partner-card));
}

.atd-items strong {
  color: var(--partner-text);
  font-size: 0.86rem;
  font-weight: 700;
  line-height: 1.3;
}

.atd-item__meta {
  display: inline-flex;
  width: fit-content;
  max-width: 100%;
  padding: 0.18rem 0.45rem;
  border-radius: 999px;
  background: color-mix(in srgb, var(--partner-primary) 12%, transparent);
  color: var(--partner-muted);
  font-size: 0.72rem;
  font-weight: 650;
  line-height: 1.35;
  overflow-wrap: anywhere;
}

.atd-item--destaque {
  border-color: color-mix(in srgb, var(--partner-warm-text) 35%, var(--partner-line));
  background: color-mix(in srgb, var(--partner-warm-bg) 55%, var(--partner-card));
}

.atd-item--destaque strong {
  color: var(--partner-warm-text);
}

.atd-item--destaque .atd-item__meta {
  background: color-mix(in srgb, var(--partner-warm-text) 14%, transparent);
  color: var(--partner-warm-text);
}

.atd-card {
  display: grid;
  gap: 0.6rem;
  grid-template-columns: minmax(0, 1fr);
  padding: 1rem 1.1rem;
  border: 1px solid var(--partner-line);
  border-radius: 1rem;
  background: var(--partner-card);
}

.atd-card h3 {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  margin: 0;
  color: var(--partner-text);
  font-size: 0.84rem;
  font-weight: 750;
  letter-spacing: 0.02em;
}

.atd-card h3 i {
  color: var(--partner-primary-strong);
  font-size: 0.82rem;
}

.atd-notes__layout {
  display: grid;
  gap: 1rem;
  grid-template-columns: minmax(0, 1fr);
  align-items: start;
}

.atd-notes__layout--with-form {
  grid-template-columns: minmax(0, 1.2fr) minmax(18rem, 0.85fr);
}

.atd-notes__feed,
.atd-composer {
  min-width: 0;
}

.atd-notes__head {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 0.65rem;
  margin-bottom: 0.85rem;
  padding-bottom: 0.65rem;
  border-bottom: 1px solid color-mix(in srgb, var(--partner-line) 85%, transparent);
}

.atd-notes__head h2 {
  margin: 0;
  color: var(--partner-text);
  font-size: 1rem;
  font-weight: 750;
  letter-spacing: -0.02em;
}

.atd-notes__head p {
  margin: 0.2rem 0 0;
  color: var(--partner-muted);
  font-size: 0.82rem;
  line-height: 1.4;
}

.atd-notes__count {
  display: inline-flex;
  align-items: center;
  min-height: 1.7rem;
  padding: 0.2rem 0.55rem;
  border-radius: 999px;
  background: color-mix(in srgb, var(--partner-primary) 14%, transparent);
  color: var(--partner-primary-strong);
  font-size: 0.72rem;
  font-weight: 750;
}

.atd-notes__empty {
  display: grid;
  justify-items: center;
  gap: 0.4rem;
  padding: 2.2rem 1.25rem;
  border: 1px dashed color-mix(in srgb, var(--partner-primary) 28%, var(--partner-line));
  border-radius: 1.1rem;
  background: color-mix(in srgb, var(--partner-surface) 55%, var(--partner-card));
  text-align: center;
}

.atd-notes__empty-icon {
  display: grid;
  width: 2.6rem;
  height: 2.6rem;
  margin-bottom: 0.25rem;
  place-items: center;
  border-radius: 0.85rem;
  background: color-mix(in srgb, var(--partner-primary) 16%, transparent);
  color: var(--partner-primary-strong);
  font-size: 1.05rem;
}

.atd-notes__empty strong {
  color: var(--partner-text);
  font-size: 0.95rem;
}

.atd-notes__empty p {
  margin: 0;
  max-width: 22rem;
  color: var(--partner-muted);
  font-size: 0.84rem;
  line-height: 1.45;
}

.atd-timeline {
  display: grid;
  gap: 0;
  margin: 0;
  padding: 0;
  list-style: none;
}

.atd-timeline__item {
  display: grid;
  grid-template-columns: 1.25rem minmax(0, 1fr);
  gap: 0.75rem;
  align-items: stretch;
}

.atd-timeline__rail {
  position: relative;
  display: flex;
  justify-content: center;
  padding-top: 1.15rem;
}

.atd-timeline__rail::before {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: 50%;
  width: 2px;
  transform: translateX(-50%);
  background: color-mix(in srgb, var(--partner-primary) 22%, var(--partner-line));
}

.atd-timeline__item:first-child .atd-timeline__rail::before {
  top: 1.15rem;
}

.atd-timeline__item:last-child .atd-timeline__rail::before {
  bottom: calc(100% - 1.35rem);
}

.atd-timeline__dot {
  position: relative;
  z-index: 1;
  width: 0.7rem;
  height: 0.7rem;
  border: 2px solid var(--partner-card);
  border-radius: 999px;
  background: var(--partner-primary-strong);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--partner-primary) 28%, transparent);
}

.atd-note {
  display: grid;
  gap: 0.7rem;
  margin-bottom: 0.75rem;
  padding: 1rem 1.05rem 1.05rem;
  border: 1px solid var(--partner-line);
  border-radius: 1.05rem;
  background:
    linear-gradient(
      160deg,
      color-mix(in srgb, var(--partner-primary-soft) 18%, var(--partner-card)),
      var(--partner-card) 42%
    );
  box-shadow: 0 10px 22px rgb(var(--partner-shadow-rgb) / 0.04);
}

.atd-note__head {
  display: grid;
  gap: 0.4rem;
}

.atd-note__title {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.45rem 0.75rem;
}

.atd-note__service {
  display: inline-flex;
  align-items: center;
  min-height: 1.7rem;
  padding: 0.25rem 0.65rem;
  border-radius: 999px;
  background: color-mix(in srgb, var(--partner-primary) 16%, transparent);
  color: var(--partner-primary-strong);
  font-size: 0.78rem;
  font-weight: 750;
}

.atd-note__time {
  color: var(--partner-faint);
  font-size: 0.76rem;
  font-weight: 600;
  white-space: nowrap;
}

.atd-note__byline {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.3rem 0.4rem;
  margin: 0;
  color: var(--partner-muted);
  font-size: 0.78rem;
  font-weight: 600;
}

.atd-note__byline i {
  color: var(--partner-primary-strong);
  font-size: 0.72rem;
}

.atd-note__sep {
  color: var(--partner-faint);
}

.atd-note__body {
  margin: 0;
  color: var(--partner-text);
  font-size: 0.92rem;
  font-weight: 500;
  line-height: 1.55;
  white-space: pre-line;
}

.atd-note__files {
  display: grid;
  gap: 0.45rem;
  padding-top: 0.15rem;
  border-top: 1px solid color-mix(in srgb, var(--partner-line) 88%, transparent);
}

.atd-note__files-label {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin: 0;
  color: var(--partner-faint);
  font-size: 0.72rem;
  font-weight: 750;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.atd-note__files-label span {
  display: inline-flex;
  min-width: 1.2rem;
  justify-content: center;
  padding: 0.08rem 0.35rem;
  border-radius: 999px;
  background: color-mix(in srgb, var(--partner-primary) 14%, transparent);
  color: var(--partner-primary-strong);
  letter-spacing: 0;
  text-transform: none;
}

.atd-note__attachments {
  display: grid;
  gap: 0.4rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.atd-note__file {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 0.65rem;
  padding: 0.55rem 0.7rem;
  border: 1px solid color-mix(in srgb, var(--partner-line) 90%, transparent);
  border-radius: 0.8rem;
  background: color-mix(in srgb, var(--partner-surface) 70%, var(--partner-card));
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition:
    border-color 150ms ease,
    background 150ms ease;
}

.atd-note__file:hover,
.atd-note__file:focus-visible {
  border-color: color-mix(in srgb, var(--partner-primary) 36%, var(--partner-line));
  background: color-mix(in srgb, var(--partner-primary-soft) 22%, var(--partner-card));
  outline: none;
}

.atd-note__file:disabled {
  cursor: wait;
  opacity: 0.72;
}

.atd-note__file-icon {
  display: grid;
  width: 2rem;
  height: 2rem;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 0.65rem;
  background: color-mix(in srgb, var(--partner-primary) 16%, transparent);
  color: var(--partner-primary-strong);
  font-size: 0.85rem;
}

.atd-note__file-copy {
  display: grid;
  gap: 0.1rem;
  min-width: 0;
  flex: 1;
}

.atd-note__file-copy strong {
  overflow: hidden;
  color: var(--partner-text);
  font-size: 0.82rem;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.atd-note__file-copy small {
  color: var(--partner-muted);
  font-size: 0.72rem;
}

.atd-note__file-go {
  color: var(--partner-faint);
  font-size: 0.72rem;
}

.atd-composer {
  position: sticky;
  top: calc(var(--pj-shell-header-height, 4.25rem) + 1rem);
  display: grid;
  gap: 0.9rem;
  padding: 1.1rem 1.1rem 1.15rem;
  border: 1px solid color-mix(in srgb, var(--partner-primary) 20%, var(--partner-line));
  border-radius: 1.15rem;
  background:
    linear-gradient(
      165deg,
      color-mix(in srgb, var(--partner-primary-soft) 32%, var(--partner-card)),
      var(--partner-card) 48%
    );
  box-shadow: 0 14px 28px rgb(var(--partner-shadow-rgb) / 0.05);
}

.atd-composer__head {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
}

.atd-composer__badge {
  display: grid;
  width: 2.35rem;
  height: 2.35rem;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 0.8rem;
  background: color-mix(in srgb, var(--partner-primary) 18%, transparent);
  color: var(--partner-primary-strong);
  font-size: 0.95rem;
}

.atd-composer__head h3 {
  margin: 0;
  color: var(--partner-text);
  font-size: 0.98rem;
  font-weight: 750;
  letter-spacing: -0.02em;
}

.atd-composer__head p {
  margin: 0.25rem 0 0;
  color: var(--partner-muted);
  font-size: 0.8rem;
  line-height: 1.4;
}

.atd-composer__error {
  margin: 0;
  padding: 0.7rem 0.85rem;
  border-radius: 0.75rem;
  background: var(--partner-warm-bg);
  color: var(--partner-warm-text);
  font-size: 0.82rem;
}

.atd-composer__fields {
  display: grid;
  gap: 0.8rem;
}

.atd-composer__footer :deep(.p-button) {
  width: 100%;
}

.atd-field {
  display: grid;
  gap: 0.35rem;
}

.atd-field label,
.atd-field__label {
  color: var(--partner-text);
  font-size: 0.78rem;
  font-weight: 700;
}

.atd-anexo-list {
  display: grid;
  gap: 0.45rem;
  grid-template-columns: minmax(0, 1fr);
  margin: 0;
  padding: 0;
  list-style: none;
}

.atd-anexo-list li {
  display: grid;
  gap: 0.55rem;
  padding: 0.7rem 0.75rem;
  border: 1px solid var(--partner-line);
  border-radius: 0.85rem;
  background: var(--partner-card);
}

.atd-anexo-list__top {
  display: flex;
  align-items: flex-start;
  gap: 0.45rem;
}

.atd-anexo-list__info {
  display: flex;
  flex: 1;
  align-items: center;
  gap: 0.45rem;
  min-width: 0;
  color: var(--partner-text);
  font-size: 0.8rem;
}

.atd-anexo-list__info span {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 650;
}

.atd-anexo-list__info small {
  color: var(--partner-muted);
  font-weight: 600;
  white-space: nowrap;
}

.atd-anexo-list__type {
  display: grid;
  gap: 0.28rem;
}

.atd-anexo-list__type label {
  color: var(--partner-muted);
  font-size: 0.72rem;
  font-weight: 700;
}

.atd-anexo-list__select {
  width: 100%;
}

.atd-anexo-list__type :deep(.atd-anexo-list__select.p-select) {
  width: 100%;
  border-color: color-mix(in srgb, var(--partner-primary) 22%, var(--partner-line));
  background: color-mix(in srgb, var(--partner-surface) 70%, var(--partner-card));
}

.atd-anexo-list__type :deep(.atd-anexo-list__select .p-select-label) {
  color: var(--partner-text);
  font-size: 0.82rem;
  font-weight: 600;
}

.atd-anexo-list__type :deep(.atd-anexo-list__select .p-select-label.p-placeholder) {
  color: var(--partner-muted);
  font-weight: 500;
}

.atd-anexo-list__type :deep(.atd-anexo-list__select .p-select-dropdown) {
  color: var(--partner-primary-strong);
}

.atd-file-cta {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  justify-self: start;
  padding: 0.5rem 0.85rem;
  border: 1px dashed color-mix(in srgb, var(--partner-primary) 45%, var(--partner-line));
  border-radius: 0.75rem;
  color: var(--partner-primary-strong);
  font-size: 0.8rem;
  font-weight: 650;
  cursor: pointer;
}

.atd-file-cta input {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}

.atd-file-cta:hover {
  background: color-mix(in srgb, var(--partner-primary-soft) 28%, transparent);
}

.atd-file-cta:focus-within {
  outline: 2px solid var(--partner-primary);
  outline-offset: 2px;
}

.atd-file-hint {
  color: var(--partner-faint);
  font-size: 0.72rem;
  line-height: 1.4;
}

@media (max-width: 960px) {
  .atd-resumo__context,
  .atd-notes__layout--with-form,
  .atd-items--grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .atd-fact {
    min-width: 0;
  }

  .atd-composer {
    position: static;
    order: -1;
  }

  .atd-notes__layout--with-form {
    display: flex;
    flex-direction: column;
  }
}
</style>
