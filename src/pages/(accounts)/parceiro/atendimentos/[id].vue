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

type SnapshotListSection = {
  id: string
  title: string
  icon: string
  items: ItemSnapshot[]
}

const snapshotListSections = computed<SnapshotListSection[]>(() => {
  const snapshot = detalhe.value?.snapshot

  if (!snapshot) {
    return []
  }

  const defs: Array<{ id: keyof typeof snapshot & string; key: string; icon: string }> = [
    { id: 'alergias', key: 'alergias', icon: 'pi pi-exclamation-triangle' },
    { id: 'vacinas', key: 'vacinas', icon: 'pi pi-shield' },
    { id: 'medicamentos', key: 'medicamentos', icon: 'pi pi-inbox' },
    { id: 'comportamento', key: 'comportamento', icon: 'pi pi-eye' },
    { id: 'diagnosticos', key: 'diagnosticos', icon: 'pi pi-file-edit' },
  ]

  return defs
    .map((def) => ({
      id: def.id,
      title: t(`atendimentos.snapshot.${def.key}`),
      icon: def.icon,
      items: (snapshot[def.id] as ItemSnapshot[] | undefined) ?? [],
    }))
    .filter((section) => section.items.length > 0)
})

const tiposDocumentoOptions = computed(() => [
  { value: null, label: t('atendimentos.anotacao.semClassificacao') },
  ...TIPOS_DOCUMENTO.map((value) => ({ value, label: value })),
])

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
          <div>
            <strong>{{ detalhe.petNome }}</strong>
            <p>
              {{ detalhe.especieLabel }}
              <template v-if="isAtivo && detalhe.petCastrado != null">
                · {{ detalhe.petCastrado ? t('atendimentos.pet.castrado') : t('atendimentos.pet.naoCastrado') }}
              </template>
            </p>
          </div>
        </div>

        <div class="atd-hero__meta">
          <span class="atd-hero__chip">{{ servicoLabel }}</span>
          <span v-if="isAtivo" class="atd-hero__expira">
            <i class="pi pi-clock" aria-hidden="true" />
            {{ expiraLabel(detalhe.expiraEm) }}
          </span>
          <PartnerStatusBadge :status="statusBadge(detalhe.status)" />
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
      <div v-if="displayTab === 'resumo' && detalhe.snapshot" class="atd-panel" role="tabpanel">
        <section v-if="detalhe.mensagemTutor" class="atd-card atd-card--wide">
          <h3>{{ t('atendimentos.detalhe.mensagemTutor') }}</h3>
          <p class="atd-mensagem">{{ detalhe.mensagemTutor }}</p>
        </section>

        <div class="atd-grid">
          <section v-if="detalhe.snapshot.pesoKg != null" class="atd-card">
            <h3><i class="pi pi-chart-line" aria-hidden="true" /> {{ t('atendimentos.snapshot.peso') }}</h3>
            <p class="atd-peso">{{ detalhe.snapshot.pesoKg }} kg</p>
          </section>

          <section
            v-for="section in snapshotListSections"
            :key="section.id"
            class="atd-card"
          >
            <h3><i :class="section.icon" aria-hidden="true" /> {{ section.title }}</h3>
            <ul class="atd-items">
              <li
                v-for="(item, index) in section.items"
                :key="`${section.id}-${index}`"
                :class="{ 'atd-item--destaque': item.destaque }"
              >
                <strong>{{ item.titulo }}</strong>
                <span v-if="item.detalhe">{{ item.detalhe }}</span>
              </li>
            </ul>
          </section>
        </div>

        <section v-if="detalhe.snapshot.observacoesTutor" class="atd-card atd-card--wide">
          <h3>{{ t('atendimentos.snapshot.observacoes') }}</h3>
          <p class="atd-mensagem">{{ detalhe.snapshot.observacoesTutor }}</p>
        </section>
      </div>

      <!-- Aba: anotações -->
      <div v-else class="atd-panel" role="tabpanel">
        <div class="atd-anotacoes" :class="{ 'atd-anotacoes--com-form': isAtivo }">
          <section class="atd-anotacoes__lista">
            <p v-if="anotacoesOrdenadas.length === 0" class="atd-empty-note">
              {{ t('atendimentos.anotacoes.empty') }}
            </p>

            <article
              v-for="anotacao in anotacoesOrdenadas"
              :key="anotacao.id"
              class="atd-anotacao"
            >
              <header>
                <strong>{{ anotacao.servicoRealizado }}</strong>
                <time :datetime="anotacao.criadaEm">{{ formatDateTime(anotacao.criadaEm) }}</time>
              </header>
              <p class="atd-anotacao__autor">
                {{ anotacao.empresaNome }}
                <template v-if="anotacao.profissionalNome"> · {{ anotacao.profissionalNome }}</template>
              </p>
              <p class="atd-anotacao__texto">{{ anotacao.texto }}</p>

              <ul v-if="anotacao.anexos.length" class="atd-anexos">
                <li v-for="anexo in anotacao.anexos" :key="anexo.id">
                  <button
                    type="button"
                    :disabled="abrindoAnexoId === anexo.id"
                    @click="abrirAnexo(anexo.id)"
                  >
                    <i
                      :class="abrindoAnexoId === anexo.id ? 'pi pi-spin pi-spinner' : 'pi pi-paperclip'"
                      aria-hidden="true"
                    />
                    <span>{{ anexo.nome }}</span>
                    <small>
                      <template v-if="anexo.tipoDocumento">{{ anexo.tipoDocumento }} · </template>
                      {{ formatBytes(anexo.tamanhoBytes) }}
                    </small>
                  </button>
                </li>
              </ul>
            </article>
          </section>

          <!-- Nova anotação (só ATIVO) -->
          <section v-if="isAtivo" class="atd-card atd-form">
            <h3>{{ t('atendimentos.anotacao.title') }}</h3>

            <p v-if="formError" class="atd-form__error" role="alert">{{ formError }}</p>

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
                rows="4"
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

            <div class="atd-field">
              <span class="atd-field__label">
                {{ t('atendimentos.anotacao.anexos', { n: MAX_ANEXOS }) }}
              </span>

              <ul v-if="anexosForm.length" class="atd-anexo-list">
                <li v-for="(anexo, index) in anexosForm" :key="`${anexo.file.name}-${index}`">
                  <div class="atd-anexo-list__info">
                    <i class="pi pi-file" aria-hidden="true" />
                    <span>{{ anexo.file.name }}</span>
                    <small>{{ formatBytes(anexo.file.size) }}</small>
                  </div>
                  <div class="atd-anexo-list__actions">
                    <Select
                      v-model="anexo.tipoDocumento"
                      :options="tiposDocumentoOptions"
                      option-label="label"
                      option-value="value"
                      :aria-label="t('atendimentos.anotacao.tipoDocumento')"
                      size="small"
                    />
                    <Button
                      icon="pi pi-times"
                      severity="secondary"
                      text
                      rounded
                      :aria-label="t('atendimentos.anotacao.removerAnexo')"
                      @click="removeAnexo(index)"
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

            <Button
              :label="t('atendimentos.anotacao.enviar')"
              :loading="submittingAnotacao"
              @click="submitAnotacao"
            />
          </section>
        </div>
      </div>
    </template>
  </PartnerPageFrame>
</template>

<style scoped>
.atd-hero {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1.15rem 1.25rem;
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
  align-items: center;
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

.atd-hero__pet strong {
  color: var(--partner-text);
  font-size: 1.2rem;
  letter-spacing: -0.02em;
}

.atd-hero__pet p {
  margin: 0.2rem 0 0;
  color: var(--partner-muted);
  font-size: 0.88rem;
}

.atd-hero__meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.6rem;
}

.atd-hero__chip {
  display: inline-flex;
  padding: 0.3rem 0.68rem;
  border-radius: 999px;
  background: color-mix(in srgb, var(--partner-primary) 16%, var(--partner-card));
  color: var(--partner-primary-strong);
  font-size: 0.76rem;
  font-weight: 700;
}

.atd-hero__expira {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  color: var(--partner-amber-text);
  font-size: 0.8rem;
  font-weight: 650;
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
  gap: 0.85rem;
  grid-template-columns: minmax(0, 1fr);
}

.atd-grid {
  display: grid;
  gap: 0.85rem;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  align-items: start;
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

.atd-mensagem {
  margin: 0;
  padding: 0.85rem 0.95rem;
  border-radius: 0.9rem;
  background: color-mix(in srgb, var(--partner-primary-soft) 26%, var(--partner-card));
  color: var(--partner-muted);
  font-size: 0.88rem;
  line-height: 1.55;
}

.atd-peso {
  margin: 0;
  color: var(--partner-text);
  font-size: 1.3rem;
  font-weight: 750;
}

.atd-items {
  display: grid;
  gap: 0.45rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.atd-items li {
  display: grid;
  gap: 0.15rem;
  padding: 0.7rem 0.85rem;
  border: 1px solid var(--partner-line);
  border-radius: 0.85rem;
  background: var(--partner-surface);
}

.atd-items strong {
  color: var(--partner-text);
  font-size: 0.87rem;
}

.atd-items span {
  color: var(--partner-muted);
  font-size: 0.81rem;
  line-height: 1.4;
}

.atd-item--destaque {
  border-color: color-mix(in srgb, var(--partner-warm-text) 35%, var(--partner-line));
  background: color-mix(in srgb, var(--partner-warm-bg) 55%, var(--partner-card));
}

.atd-item--destaque strong {
  color: var(--partner-warm-text);
}

.atd-anotacoes {
  display: grid;
  gap: 0.85rem;
  grid-template-columns: minmax(0, 1fr);
  align-items: start;
}

.atd-anotacoes--com-form {
  grid-template-columns: minmax(0, 1.35fr) minmax(0, 1fr);
}

.atd-anotacoes__lista {
  display: grid;
  gap: 0.6rem;
  grid-template-columns: minmax(0, 1fr);
}

.atd-empty-note {
  margin: 0;
  padding: 1.6rem 1rem;
  border: 1px dashed var(--partner-line);
  border-radius: 1rem;
  color: var(--partner-faint);
  font-size: 0.86rem;
  text-align: center;
}

.atd-anotacao {
  display: grid;
  gap: 0.4rem;
  grid-template-columns: minmax(0, 1fr);
  padding: 0.9rem 1rem;
  border: 1px solid var(--partner-line);
  border-radius: 0.95rem;
  background: var(--partner-card);
}

.atd-anotacao header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.75rem;
}

.atd-anotacao header strong {
  color: var(--partner-text);
  font-size: 0.9rem;
}

.atd-anotacao time {
  color: var(--partner-faint);
  font-size: 0.74rem;
  white-space: nowrap;
}

.atd-anotacao__autor {
  margin: 0;
  color: var(--partner-primary-strong);
  font-size: 0.76rem;
  font-weight: 650;
}

.atd-anotacao__texto {
  margin: 0;
  color: var(--partner-muted);
  font-size: 0.86rem;
  line-height: 1.5;
  white-space: pre-line;
}

.atd-anexos {
  display: grid;
  gap: 0.35rem;
  grid-template-columns: minmax(0, 1fr);
  margin: 0.2rem 0 0;
  padding: 0;
  list-style: none;
}

.atd-anexos li {
  min-width: 0;
}

.atd-anexos button {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.7rem;
  border: 1px solid var(--partner-line);
  border-radius: 0.7rem;
  background: var(--partner-surface);
  color: var(--partner-text);
  font: inherit;
  font-size: 0.8rem;
  text-align: left;
  cursor: pointer;
}

.atd-anexos button:hover,
.atd-anexos button:focus-visible {
  border-color: var(--partner-primary-strong);
}

.atd-anexos button span {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.atd-anexos button small {
  color: var(--partner-faint);
  white-space: nowrap;
}

.atd-form {
  position: sticky;
  top: calc(var(--pj-shell-header-height, 4.25rem) + 1rem);
  background: color-mix(in srgb, var(--partner-surface) 65%, var(--partner-card));
}

.atd-form > :deep(.p-button) {
  width: 100%;
}

.atd-form__error {
  margin: 0;
  padding: 0.7rem 0.85rem;
  border-radius: 0.75rem;
  background: var(--partner-warm-bg);
  color: var(--partner-warm-text);
  font-size: 0.82rem;
}

.atd-field {
  display: grid;
  gap: 0.3rem;
}

.atd-field label,
.atd-field__label {
  color: var(--partner-text);
  font-size: 0.78rem;
  font-weight: 650;
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
  gap: 0.4rem;
  padding: 0.55rem 0.7rem;
  border: 1px solid var(--partner-line);
  border-radius: 0.75rem;
  background: var(--partner-card);
}

.atd-anexo-list__info {
  display: flex;
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
}

.atd-anexo-list__info small {
  color: var(--partner-faint);
}

.atd-anexo-list__actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
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
  .atd-grid,
  .atd-anotacoes--com-form {
    grid-template-columns: minmax(0, 1fr);
  }

  .atd-form {
    position: static;
  }
}
</style>
