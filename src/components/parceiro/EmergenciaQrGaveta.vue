<script setup lang="ts">
/**
 * Emergência pelo QR da coleira (PJ-4NARE1, L6), numa gaveta ao lado de Acessos.
 *
 * O pet chega sem o responsável. O veterinário cola o endereço que o QR abre (ou o código),
 * escreve o motivo e abre a ficha curta: alergias, remédios contínuos, condições e peso. O
 * responsável é avisado na hora e lê o motivo no app, por isso o motivo é escrito para ele.
 *
 * Os erros vêm pelo código: sem o selo do CRMV, a explicação com o caminho para Profissionais;
 * QR que não abre, "Ficha indisponível" sem dizer o motivo (a API devolve o mesmo 404 para tudo);
 * e o limite do dia. A ficha não traz nada do responsável: quem liga é ele.
 *
 * Ler pela câmera fica de fora por ora: o QR aponta para o link curto do serviço de QR, que não
 * traz o slug da carteirinha (lacuna N19).
 */
import Button from 'primevue/button'
import Drawer from 'primevue/drawer'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { useSidePanelOffset } from '@/composables/useSidePanelOffset'
import { useTelaLarga } from '@/composables/useTelaLarga'
import PetAvatar from '@/features/hotel/components/base/PetAvatar.vue'
import { INTL_LOCALE, isRTLLocale, type Locale } from '@/i18n/locales'
import { ApiError } from '@/service/api'
import {
  abrirFichaDeEmergencia,
  lerQr,
  MOTIVO_MAX,
  MOTIVO_MIN,
  motivoValido,
  type FichaDeEmergencia,
} from '@/service/parceiro/emergencia-service'
import { ESPECIE_DO_AVATAR } from '@/utils/parceiro/acesso-na-lista'
import { doseComUnidade } from '@/utils/parceiro/anotacao-estruturada'

import '@/components/parceiro/estabelecimento/gaveta.css'

const visible = defineModel<boolean>('visible', { default: false })

const LARGURA = '30rem'

const { t, locale } = useI18n()
const telaLarga = useTelaLarga()
const { parceiroQuery } = useParceiroPortal()

useSidePanelOffset(
  computed(() => visible.value && telaLarga.value),
  LARGURA,
)

const posicao = computed(() => (isRTLLocale(locale.value as Locale) ? 'left' : 'right'))
const intl = computed(() => INTL_LOCALE[locale.value as Locale])

/* ------------------------------------------------------------------------------- o pedido */

const qr = ref('')
const motivo = ref('')
const tentou = ref(false)
const abrindo = ref(false)

type Erro = 'semSelo' | 'indisponivel' | 'limite' | 'motivo' | 'generico'
const erro = ref<Erro | null>(null)
const erroGenerico = ref('')

const ficha = ref<FichaDeEmergencia | null>(null)

const leitura = computed(() => lerQr(qr.value))
const problemaDoQr = computed(() => ('problema' in leitura.value ? leitura.value.problema : null))
const motivoOk = computed(() => motivoValido(motivo.value))

watch(visible, (aberta) => {
  if (aberta) recomecar()
})

function recomecar() {
  qr.value = ''
  motivo.value = ''
  tentou.value = false
  erro.value = null
  erroGenerico.value = ''
  ficha.value = null
}

const CODIGOS: Record<string, Erro> = {
  EMERGENCIA_SEM_CRMV_CONFERIDO: 'semSelo',
  EMERGENCIA_FICHA_INDISPONIVEL: 'indisponivel',
  EMERGENCIA_LIMITE: 'limite',
}

async function abrir() {
  tentou.value = true
  erro.value = null

  const atual = leitura.value
  if (!('slug' in atual) || !motivoOk.value) return

  abrindo.value = true

  try {
    ficha.value = await abrirFichaDeEmergencia(
      { publicSlug: atual.slug, motivo: motivo.value },
      parceiroQuery(),
    )
  } catch (err) {
    const codigo = err instanceof ApiError ? (err.codigo ?? '') : ''

    if (CODIGOS[codigo]) {
      erro.value = CODIGOS[codigo]
    } else if (err instanceof ApiError && err.statusCode === 400) {
      erro.value = 'motivo'
    } else {
      erro.value = 'generico'
      erroGenerico.value = err instanceof Error ? err.message : ''
    }
  } finally {
    abrindo.value = false
  }
}

/* ------------------------------------------------------------------------------- a ficha */

function iniciais(nome: string) {
  return nome
    .split(/\s+/)
    .map((parte) => parte[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

const especie = computed(() => {
  const atual = ficha.value
  if (!atual) return ''
  if (atual.especie === 'OUTRO') return atual.tipoEspecie || t('acessos.emergencia.especieOutra')

  return t(`acessos.especie.${atual.especie}`)
})

/** "6 anos", "8 meses": a idade de hoje, pela data de nascimento (`AAAA-MM-DD`). */
function idade(nascimento: string) {
  const [ano, mes, dia] = nascimento.split('-').map(Number)
  if (!ano || !mes || !dia) return ''

  const hoje = new Date()
  let meses = (hoje.getFullYear() - ano) * 12 + (hoje.getMonth() + 1 - mes)
  if (hoje.getDate() < dia) meses -= 1
  if (meses < 0) return ''

  return meses >= 12
    ? t('acessos.emergencia.idadeAnos', { n: Math.floor(meses / 12) }, Math.floor(meses / 12))
    : t('acessos.emergencia.idadeMeses', { n: meses }, meses)
}

const resumo = computed(() => {
  const atual = ficha.value
  if (!atual) return ''

  const partes = [especie.value]
  if (atual.sexo) partes.push(t(`acessos.emergencia.sexo.${atual.sexo}`))
  if (atual.castrado !== null) {
    partes.push(atual.castrado ? t('acessos.pet.castrado') : t('acessos.pet.naoCastrado'))
  }
  if (atual.nascimento) partes.push(idade(atual.nascimento))

  return partes.filter(Boolean).join(' · ')
})

const peso = computed(() => {
  const atual = ficha.value?.peso
  if (!atual) return ''

  const kg = new Intl.NumberFormat(intl.value, { maximumFractionDigits: 2 }).format(atual.kg)
  const quando = new Date(atual.em).toLocaleDateString(intl.value, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })

  return t('acessos.emergencia.pesoEm', { kg, data: quando })
})

/** Grave e anafilática pedem o olho antes de medicar: o ícone de risco, e não a linha pintada. */
function alergiaSeria(severidade: string | null) {
  return severidade === 'GRAVE' || severidade === 'ANAFILATICA'
}

function dose(item: FichaDeEmergencia['tratamentosContinuos'][number]) {
  return [doseComUnidade(item.dose, item.unidade), item.frequencia, item.via]
    .filter(Boolean)
    .join(' · ')
}
</script>

<template>
  <Drawer
    v-model:visible="visible"
    :position="posicao"
    :modal="false"
    :dismissable="false"
    :block-scroll="false"
    class="emergencia-gaveta"
    :style="{ width: `min(${LARGURA}, 100vw)` }"
  >
    <template #header>
      <h2 class="eg-titulo">
        <span class="ui-ladrilho ui-ladrilho--lugar" aria-hidden="true">
          <i class="ph ph-first-aid-kit" />
        </span>
        {{ t('acessos.emergencia.titulo') }}
      </h2>
    </template>

    <!-- A ficha aberta. -->
    <div v-if="ficha" class="eg em">
      <p class="em__avisado" role="status">
        <i class="ph ph-bell-ringing" aria-hidden="true" />
        <span>{{ t('acessos.emergencia.avisado') }}</span>
      </p>

      <header class="em__pet">
        <PetAvatar
          :nome="ficha.petNome"
          :iniciais="iniciais(ficha.petNome)"
          :especie="ESPECIE_DO_AVATAR[ficha.especie] ?? null"
          :foto-url="ficha.foto ?? ''"
          tamanho="lg"
        />
        <div class="em__identidade">
          <strong class="em__nome">{{ ficha.petNome }}</strong>
          <span class="em__resumo">{{ resumo }}</span>
          <span v-if="peso" class="em__peso">{{ peso }}</span>
        </div>
      </header>

      <section class="em__bloco" aria-labelledby="em-alergias">
        <h3 id="em-alergias" class="eg__grupo-titulo">{{ t('acessos.snapshot.alergias') }}</h3>
        <ul v-if="ficha.alergias.length" class="em__lista">
          <li v-for="(item, i) in ficha.alergias" :key="i" class="em__item">
            <i
              :class="
                alergiaSeria(item.severidade)
                  ? 'ph ph-warning-octagon em__marca em__marca--risco'
                  : 'ph ph-dot-outline em__marca'
              "
              aria-hidden="true"
            />
            <span class="em__texto">
              <strong>{{ item.gatilho }}</strong>
              <span>
                {{ t(`acessos.emergencia.categoriaAlergia.${item.categoria}`) }}
                <template v-if="item.severidade">
                  · {{ t(`acessos.emergencia.severidade.${item.severidade}`) }}
                </template>
                <template v-if="item.reacao"> · {{ item.reacao }}</template>
              </span>
            </span>
          </li>
        </ul>
        <p v-else class="eg__dica">{{ t('acessos.emergencia.nenhumaAlergia') }}</p>
      </section>

      <section class="em__bloco" aria-labelledby="em-tratamentos">
        <h3 id="em-tratamentos" class="eg__grupo-titulo">
          {{ t('acessos.emergencia.tratamentos') }}
        </h3>
        <ul v-if="ficha.tratamentosContinuos.length" class="em__lista">
          <li v-for="(item, i) in ficha.tratamentosContinuos" :key="i" class="em__item">
            <i class="ph ph-pill em__marca" aria-hidden="true" />
            <span class="em__texto">
              <strong>{{ item.medicamento }}</strong>
              <span>{{ dose(item) }}</span>
            </span>
          </li>
        </ul>
        <p v-else class="eg__dica">{{ t('acessos.emergencia.nenhumTratamento') }}</p>
      </section>

      <section class="em__bloco" aria-labelledby="em-condicoes">
        <h3 id="em-condicoes" class="eg__grupo-titulo">{{ t('acessos.emergencia.condicoes') }}</h3>
        <ul v-if="ficha.condicoes.length" class="em__lista">
          <li v-for="(item, i) in ficha.condicoes" :key="i" class="em__item">
            <i class="ph ph-heartbeat em__marca" aria-hidden="true" />
            <span class="em__texto">
              <strong>{{ t(`acessos.emergencia.categoriaCondicao.${item.categoria}`) }}</strong>
              <span v-if="item.subtipo">{{ item.subtipo }}</span>
            </span>
          </li>
        </ul>
        <p v-else class="eg__dica">{{ t('acessos.emergencia.nenhumaCondicao') }}</p>
      </section>

      <p class="eg__dica">{{ t('acessos.emergencia.semContato') }}</p>
    </div>

    <!-- O pedido: o QR e o motivo. -->
    <form v-else id="emergencia-form" class="eg" novalidate @submit.prevent="abrir">
      <p class="eg__dica">{{ t('acessos.emergencia.lede') }}</p>

      <section class="eg__secao">
        <label class="eg__rotulo" for="emergencia-qr">{{ t('acessos.emergencia.qrRotulo') }}</label>
        <InputText
          id="emergencia-qr"
          v-model="qr"
          autocomplete="off"
          spellcheck="false"
          :placeholder="t('acessos.emergencia.qrExemplo')"
          :invalid="tentou && problemaDoQr !== null"
          :disabled="abrindo"
        />
        <small v-if="tentou && problemaDoQr" class="eg__invalido">
          {{ t(`acessos.emergencia.qrProblema.${problemaDoQr}`) }}
        </small>
        <small v-else class="eg__dica">{{ t('acessos.emergencia.qrDica') }}</small>
      </section>

      <section class="eg__secao">
        <label class="eg__rotulo" for="emergencia-motivo">
          {{ t('acessos.emergencia.motivoRotulo') }}
        </label>
        <Textarea
          id="emergencia-motivo"
          v-model="motivo"
          rows="3"
          auto-resize
          :maxlength="MOTIVO_MAX"
          :placeholder="t('acessos.emergencia.motivoExemplo')"
          :invalid="tentou && !motivoOk"
          :disabled="abrindo"
        />
        <small v-if="tentou && !motivoOk" class="eg__invalido">
          {{ t('acessos.emergencia.motivoTamanho', { min: MOTIVO_MIN, max: MOTIVO_MAX }) }}
        </small>
        <small v-else class="eg__dica">
          {{ t('acessos.emergencia.motivoDica') }}
          <span class="em__contador ui-num">{{ motivo.trim().length }}/{{ MOTIVO_MAX }}</span>
        </small>
      </section>

      <div v-if="erro === 'semSelo'" class="em__bloqueio" role="alert">
        <p class="eg__erro">
          <i class="ph ph-seal-warning" aria-hidden="true" />
          <span>{{ t('acessos.emergencia.erros.semSelo') }}</span>
        </p>
        <RouterLink
          class="p-button p-component p-button-secondary p-button-outlined p-button-sm em__caminho"
          to="/parceiro/profissionais"
        >
          <i class="ph ph-stethoscope" aria-hidden="true" />
          {{ t('acessos.emergencia.abrirProfissionais') }}
        </RouterLink>
      </div>
      <p v-else-if="erro" class="eg__erro" role="alert">
        <i class="ph ph-warning-circle" aria-hidden="true" />
        <span>
          {{
            erro === 'generico'
              ? erroGenerico || t('acessos.emergencia.erros.generico')
              : t(`acessos.emergencia.erros.${erro}`, { min: MOTIVO_MIN, max: MOTIVO_MAX })
          }}
        </span>
      </p>
    </form>

    <template #footer>
      <div class="eg__pe">
        <template v-if="ficha">
          <Button
            type="button"
            :label="t('acessos.emergencia.outra')"
            icon="ph ph-arrow-counter-clockwise"
            severity="secondary"
            outlined
            @click="recomecar"
          />
          <Button type="button" :label="t('acessos.emergencia.fechar')" @click="visible = false" />
        </template>
        <template v-else>
          <Button
            type="button"
            :label="t('acessos.emergencia.cancelar')"
            severity="secondary"
            outlined
            :disabled="abrindo"
            @click="visible = false"
          />
          <Button
            type="submit"
            form="emergencia-form"
            icon="ph ph-first-aid-kit"
            :label="t('acessos.emergencia.abrir')"
            :loading="abrindo"
          />
        </template>
      </div>
    </template>
  </Drawer>
</template>

<style scoped>
.em__avisado {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0;
  padding: 12px 14px;
  border-radius: 12px;
  background: var(--superficie-2);
  color: var(--tinta);
  font-size: 14px;
  font-weight: 600;
}

.em__avisado i {
  color: var(--tinta-2);
  font-size: 19px;
}

.em__pet {
  display: flex;
  align-items: center;
  gap: 14px;
  min-width: 0;
}

.em__identidade {
  display: grid;
  gap: 3px;
  min-width: 0;
}

.em__nome {
  color: var(--tinta);
  font-size: 18px;
  font-weight: 650;
}

.em__resumo,
.em__peso {
  color: var(--tinta-2);
  font-size: 13.5px;
}

.em__bloco {
  display: grid;
  gap: 10px;
}

.em__lista {
  display: grid;
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.em__item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

.em__marca {
  flex: none;
  margin-top: 2px;
  color: var(--tinta-2);
  font-size: 17px;
}

.em__marca--risco {
  color: var(--risco-tinta);
}

.em__texto {
  display: grid;
  gap: 2px;
  min-width: 0;
  color: var(--tinta-2);
  font-size: 13.5px;
  line-height: 1.45;
}

.em__texto strong {
  color: var(--tinta);
  font-size: 14px;
  font-weight: 600;
}

.em__contador {
  float: inline-end;
  color: var(--tinta-3);
}

.em__bloqueio {
  display: grid;
  justify-items: start;
  gap: 10px;
}

.em__caminho {
  gap: 8px;
  text-decoration: none;
}
</style>
