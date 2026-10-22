<script setup lang="ts">
/**
 * Uma parte do perfil do estabelecimento, numa gaveta: o perfil e os contatos, o endereço, ou as
 * mensagens ao responsável. Uma parte por vez, para a gaveta ter um assunto só.
 *
 * O `PUT` da API recebe o perfil inteiro (o que não vier vira `null`), então a gaveta parte do perfil
 * gravado e troca só os campos da parte aberta. `mostrarEndereco` é a exceção: omitido, a API
 * mantém o que está gravado, e no primeiro salvamento escolhe pela categoria (o veterinário autônomo
 * começa sem a rua na página).
 *
 * As conferências são as mesmas da API, para o erro aparecer no campo antes de enviar.
 */
import Button from 'primevue/button'
import Drawer from 'primevue/drawer'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import Textarea from 'primevue/textarea'
import ToggleSwitch from 'primevue/toggleswitch'
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { useSidePanelOffset } from '@/composables/useSidePanelOffset'
import { useTelaLarga } from '@/composables/useTelaLarga'
import { isRTLLocale, type Locale } from '@/i18n/locales'
import type {
  DadosDoEstabelecimento,
  IdiomaDosTextos,
  PerfilDoEstabelecimento,
} from '@/service/parceiro/estabelecimento-service'
import { UFS } from '@/utils/brasil/ufs'

import { fusoDoNavegador, fusosDisponiveis, nomeDoFuso, offsetDoFuso } from './horario'
import './gaveta.css'

export type ParteDoPerfil = 'perfil' | 'endereco' | 'mensagens'

const props = defineProps<{
  parte: ParteDoPerfil
  perfil: PerfilDoEstabelecimento | null
  /** O nome que o perfil novo sugere: o da empresa. */
  nomeSugerido: string
  salvando: boolean
  erro: Error | null
}>()

const emit = defineEmits<{ salvar: [dados: DadosDoEstabelecimento] }>()

const visible = defineModel<boolean>('visible', { default: false })

const LARGURA = '30rem'

/** A mesma régua da API: nacional com DDD ou E.164. */
const TELEFONE = /^\+?[\d\s().-]{10,20}$/
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const CEP = /^\d{5}-?\d{3}$/

const IDIOMAS: IdiomaDosTextos[] = ['pt-BR', 'en-US', 'en-GB', 'es-419', 'sr-Latn', 'ar']

const IDIOMA_DA_SESSAO: Record<Locale, IdiomaDosTextos> = {
  pt: 'pt-BR',
  en: 'en-US',
  'en-GB': 'en-GB',
  es: 'es-419',
  sr: 'sr-Latn',
  ar: 'ar',
}

const ICONE_DA_PARTE: Record<ParteDoPerfil, string> = {
  perfil: 'ph ph-identification-card',
  endereco: 'ph ph-map-pin',
  mensagens: 'ph ph-chat-text',
}

const { t, locale } = useI18n()
const telaLarga = useTelaLarga()

useSidePanelOffset(
  computed(() => visible.value && telaLarga.value),
  LARGURA,
)

const drawerPosition = computed(() => (isRTLLocale(locale.value as Locale) ? 'left' : 'right'))

type Formulario = {
  nomePublico: string
  descricao: string
  idiomaDosTextos: IdiomaDosTextos
  fusoHorario: string
  telefonePublico: string
  whatsappPublico: string
  telefonePlantao: string
  emailPublico: string
  site: string
  cep: string
  logradouro: string
  numero: string
  complemento: string
  bairro: string
  cidade: string
  uf: string | null
  pais: string
  latitude: string
  longitude: string
  mostrarMapa: boolean
  mostrarEndereco: boolean
  mensagemForaDoHorario: string
  orientacaoEmergencia: string
}

const form = reactive<Formulario>(formularioDe(null))
const tentouSalvar = ref(false)

function formularioDe(perfil: PerfilDoEstabelecimento | null): Formulario {
  return {
    nomePublico: perfil?.nomePublico ?? props.nomeSugerido,
    descricao: perfil?.descricao ?? '',
    idiomaDosTextos: perfil?.idiomaDosTextos ?? IDIOMA_DA_SESSAO[locale.value as Locale] ?? 'pt-BR',
    fusoHorario: perfil?.fusoHorario ?? fusoDoNavegador(),
    telefonePublico: perfil?.telefonePublico ?? '',
    whatsappPublico: perfil?.whatsappPublico ?? '',
    telefonePlantao: perfil?.telefonePlantao ?? '',
    emailPublico: perfil?.emailPublico ?? '',
    site: perfil?.site ?? '',
    cep: perfil?.cep ?? '',
    logradouro: perfil?.logradouro ?? '',
    numero: perfil?.numero ?? '',
    complemento: perfil?.complemento ?? '',
    bairro: perfil?.bairro ?? '',
    cidade: perfil?.cidade ?? '',
    uf: perfil?.uf ?? null,
    pais: perfil?.pais ?? 'BR',
    latitude: perfil?.latitude != null ? String(perfil.latitude) : '',
    longitude: perfil?.longitude != null ? String(perfil.longitude) : '',
    mostrarMapa: perfil?.mostrarMapa ?? true,
    mostrarEndereco: perfil?.mostrarEndereco ?? true,
    mensagemForaDoHorario: perfil?.mensagemForaDoHorario ?? '',
    orientacaoEmergencia: perfil?.orientacaoEmergencia ?? '',
  }
}

watch(visible, (aberta) => {
  if (aberta) {
    Object.assign(form, formularioDe(props.perfil))
    tentouSalvar.value = false
  }
})

/* ------------------------------------------------------------------------- opções */

const fusoOptions = computed(() => {
  const fusos = fusosDisponiveis()
  /* O fuso gravado aparece mesmo que o navegador não o conheça. */
  const lista = fusos.includes(form.fusoHorario) ? fusos : [form.fusoHorario, ...fusos]

  return lista.map((fuso) => ({
    valor: fuso,
    rotulo: `${nomeDoFuso(fuso)} (${offsetDoFuso(fuso)})`,
  }))
})

const idiomaOptions = computed(() =>
  IDIOMAS.map((idioma) => ({
    valor: idioma,
    rotulo: t(`parceiro.estabelecimento.idioma.${idioma.replace('-', '')}`),
  })),
)

/* ------------------------------------------------------------------------- conferência */

function texto(valor: string) {
  return valor.trim()
}

function numero(valor: string) {
  const limpo = valor.trim().replace(',', '.')

  return limpo === '' ? null : Number(limpo)
}

function telefoneInvalido(valor: string) {
  return texto(valor) !== '' && !TELEFONE.test(texto(valor))
}

const latitude = computed(() => numero(form.latitude))
const longitude = computed(() => numero(form.longitude))

const problemas = computed(() => {
  const lista: Partial<Record<keyof Formulario | 'coordenadas', string>> = {}

  if (props.parte === 'perfil') {
    const nome = texto(form.nomePublico)

    if (nome.length < 2 || nome.length > 120) {
      lista.nomePublico = t('parceiro.estabelecimento.gaveta.invalido.nome')
    }

    if (!form.fusoHorario) lista.fusoHorario = t('parceiro.estabelecimento.gaveta.invalido.fuso')

    for (const campo of ['telefonePublico', 'whatsappPublico', 'telefonePlantao'] as const) {
      if (telefoneInvalido(form[campo])) {
        lista[campo] = t('parceiro.estabelecimento.gaveta.invalido.telefone')
      }
    }

    if (texto(form.emailPublico) && !EMAIL.test(texto(form.emailPublico))) {
      lista.emailPublico = t('parceiro.estabelecimento.gaveta.invalido.email')
    }

    if (texto(form.site) && !/^https?:\/\/\S+\.\S+/.test(texto(form.site))) {
      lista.site = t('parceiro.estabelecimento.gaveta.invalido.site')
    }
  }

  if (props.parte === 'endereco') {
    if (texto(form.cep) && !CEP.test(texto(form.cep))) {
      lista.cep = t('parceiro.estabelecimento.gaveta.invalido.cep')
    }

    const lat = latitude.value
    const lon = longitude.value
    const umSo = (lat === null) !== (lon === null)
    const foraDaFaixa =
      (lat !== null && (Number.isNaN(lat) || lat < -90 || lat > 90)) ||
      (lon !== null && (Number.isNaN(lon) || lon < -180 || lon > 180))

    if (umSo || foraDaFaixa) {
      lista.coordenadas = t('parceiro.estabelecimento.gaveta.invalido.coordenadas')
    }
  }

  return lista
})

function problemaDe(campo: keyof Formulario | 'coordenadas') {
  return tentouSalvar.value ? problemas.value[campo] : undefined
}

/* ------------------------------------------------------------------------- envio */

function ouNulo(valor: string) {
  const limpo = texto(valor)

  return limpo === '' ? null : limpo
}

function salvar() {
  tentouSalvar.value = true

  if (Object.keys(problemas.value).length > 0 || props.salvando) return

  const dados: DadosDoEstabelecimento = {
    nomePublico: texto(form.nomePublico),
    descricao: ouNulo(form.descricao),
    idiomaDosTextos: form.idiomaDosTextos,
    fusoHorario: form.fusoHorario,
    telefonePublico: ouNulo(form.telefonePublico),
    whatsappPublico: ouNulo(form.whatsappPublico),
    telefonePlantao: ouNulo(form.telefonePlantao),
    emailPublico: ouNulo(form.emailPublico),
    site: ouNulo(form.site),
    cep: ouNulo(form.cep),
    logradouro: ouNulo(form.logradouro),
    numero: ouNulo(form.numero),
    complemento: ouNulo(form.complemento),
    bairro: ouNulo(form.bairro),
    cidade: ouNulo(form.cidade),
    uf: form.uf,
    pais: form.pais,
    latitude: latitude.value,
    longitude: longitude.value,
    mostrarMapa: form.mostrarMapa,
    mensagemForaDoHorario: ouNulo(form.mensagemForaDoHorario),
    orientacaoEmergencia: ouNulo(form.orientacaoEmergencia),
  }

  /* Só a gaveta do endereço decide; nas outras, a API mantém o que está gravado. */
  if (props.parte === 'endereco') {
    dados.mostrarEndereco = form.mostrarEndereco
  }

  emit('salvar', dados)
}
</script>

<template>
  <Drawer
    v-model:visible="visible"
    :position="drawerPosition"
    :modal="false"
    :dismissable="false"
    :block-scroll="false"
    class="estabelecimento-gaveta"
    :style="{ width: `min(${LARGURA}, 100vw)` }"
  >
    <template #header>
      <h2 class="eg-titulo">
        <span class="ui-ladrilho ui-ladrilho--lugar" aria-hidden="true">
          <i :class="ICONE_DA_PARTE[parte]" />
        </span>
        {{ t(`parceiro.estabelecimento.gaveta.titulo.${parte}`) }}
      </h2>
    </template>

    <form id="estabelecimento-perfil" class="eg" novalidate @submit.prevent="salvar">
      <!-- ------------------------------------------------------------ perfil e contatos -->
      <template v-if="parte === 'perfil'">
        <div class="eg__grupo">
          <section class="eg__secao">
            <label class="eg__rotulo" for="est-nome">{{
              t('parceiro.estabelecimento.campo.nomePublico')
            }}</label>
            <InputText
              id="est-nome"
              v-model="form.nomePublico"
              maxlength="120"
              autocomplete="organization"
              :invalid="!!problemaDe('nomePublico')"
              :disabled="salvando"
            />
            <p v-if="problemaDe('nomePublico')" class="eg__invalido">
              {{ problemaDe('nomePublico') }}
            </p>
          </section>

          <section class="eg__secao">
            <label class="eg__rotulo" for="est-descricao">
              {{ t('parceiro.estabelecimento.campo.descricao') }}
              <span class="eg__opcional">{{ t('parceiro.estabelecimento.gaveta.opcional') }}</span>
            </label>
            <Textarea
              id="est-descricao"
              v-model="form.descricao"
              rows="3"
              auto-resize
              maxlength="2000"
              :disabled="salvando"
            />
          </section>

          <section class="eg__secao">
            <span id="est-fuso-rotulo" class="eg__rotulo">{{
              t('parceiro.estabelecimento.campo.fusoHorario')
            }}</span>
            <Select
              v-model="form.fusoHorario"
              :options="fusoOptions"
              option-label="rotulo"
              option-value="valor"
              filter
              :filter-placeholder="t('parceiro.estabelecimento.gaveta.buscarFuso')"
              aria-labelledby="est-fuso-rotulo"
              :invalid="!!problemaDe('fusoHorario')"
              :disabled="salvando"
            />
            <p class="eg__dica">{{ t('parceiro.estabelecimento.gaveta.fusoDica') }}</p>
          </section>

          <section class="eg__secao">
            <span id="est-idioma-rotulo" class="eg__rotulo">{{
              t('parceiro.estabelecimento.campo.idiomaDosTextos')
            }}</span>
            <Select
              v-model="form.idiomaDosTextos"
              :options="idiomaOptions"
              option-label="rotulo"
              option-value="valor"
              aria-labelledby="est-idioma-rotulo"
              :disabled="salvando"
            />
            <p class="eg__dica">{{ t('parceiro.estabelecimento.gaveta.idiomaDica') }}</p>
          </section>
        </div>

        <div class="eg__grupo">
          <h3 class="eg__grupo-titulo">{{ t('parceiro.estabelecimento.gaveta.contatos') }}</h3>
          <p class="eg__dica">{{ t('parceiro.estabelecimento.gaveta.contatosDica') }}</p>

          <section
            v-for="campo in ['telefonePublico', 'whatsappPublico', 'telefonePlantao'] as const"
            :key="campo"
            class="eg__secao"
          >
            <label class="eg__rotulo" :for="`est-${campo}`">
              {{ t(`parceiro.estabelecimento.campo.${campo}`) }}
              <span class="eg__opcional">{{ t('parceiro.estabelecimento.gaveta.opcional') }}</span>
            </label>
            <InputText
              :id="`est-${campo}`"
              v-model="form[campo]"
              type="tel"
              inputmode="tel"
              maxlength="20"
              autocomplete="off"
              :invalid="!!problemaDe(campo)"
              :disabled="salvando"
            />
            <p v-if="problemaDe(campo)" class="eg__invalido">{{ problemaDe(campo) }}</p>
            <p v-else-if="campo === 'telefonePlantao'" class="eg__dica">
              {{ t('parceiro.estabelecimento.gaveta.plantaoDica') }}
            </p>
          </section>

          <section class="eg__secao">
            <label class="eg__rotulo" for="est-email">
              {{ t('parceiro.estabelecimento.campo.emailPublico') }}
              <span class="eg__opcional">{{ t('parceiro.estabelecimento.gaveta.opcional') }}</span>
            </label>
            <InputText
              id="est-email"
              v-model="form.emailPublico"
              type="email"
              autocomplete="off"
              spellcheck="false"
              :invalid="!!problemaDe('emailPublico')"
              :disabled="salvando"
            />
            <p v-if="problemaDe('emailPublico')" class="eg__invalido">
              {{ problemaDe('emailPublico') }}
            </p>
            <p v-else class="eg__dica">{{ t('parceiro.estabelecimento.gaveta.emailDica') }}</p>
          </section>

          <section class="eg__secao">
            <label class="eg__rotulo" for="est-site">
              {{ t('parceiro.estabelecimento.campo.site') }}
              <span class="eg__opcional">{{ t('parceiro.estabelecimento.gaveta.opcional') }}</span>
            </label>
            <InputText
              id="est-site"
              v-model="form.site"
              type="url"
              inputmode="url"
              maxlength="300"
              placeholder="https://"
              autocomplete="off"
              spellcheck="false"
              :invalid="!!problemaDe('site')"
              :disabled="salvando"
            />
            <p v-if="problemaDe('site')" class="eg__invalido">{{ problemaDe('site') }}</p>
          </section>
        </div>
      </template>

      <!-- ------------------------------------------------------------------- endereço -->
      <template v-else-if="parte === 'endereco'">
        <div class="eg__grupo">
          <section class="eg__secao">
            <label class="eg__rotulo" for="est-cep">{{
              t('parceiro.estabelecimento.campo.cep')
            }}</label>
            <InputText
              id="est-cep"
              v-model="form.cep"
              inputmode="numeric"
              maxlength="9"
              autocomplete="postal-code"
              :invalid="!!problemaDe('cep')"
              :disabled="salvando"
            />
            <p v-if="problemaDe('cep')" class="eg__invalido">{{ problemaDe('cep') }}</p>
          </section>

          <section class="eg__secao">
            <label class="eg__rotulo" for="est-logradouro">{{
              t('parceiro.estabelecimento.campo.logradouro')
            }}</label>
            <InputText
              id="est-logradouro"
              v-model="form.logradouro"
              maxlength="200"
              autocomplete="address-line1"
              :disabled="salvando"
            />
          </section>

          <div class="eg__linha">
            <section class="eg__secao">
              <label class="eg__rotulo" for="est-numero">{{
                t('parceiro.estabelecimento.campo.numero')
              }}</label>
              <InputText
                id="est-numero"
                v-model="form.numero"
                maxlength="20"
                autocomplete="off"
                :disabled="salvando"
              />
            </section>
            <section class="eg__secao">
              <label class="eg__rotulo" for="est-complemento">
                {{ t('parceiro.estabelecimento.campo.complemento') }}
                <span class="eg__opcional">{{
                  t('parceiro.estabelecimento.gaveta.opcional')
                }}</span>
              </label>
              <InputText
                id="est-complemento"
                v-model="form.complemento"
                maxlength="100"
                autocomplete="address-line2"
                :disabled="salvando"
              />
            </section>
          </div>

          <section class="eg__secao">
            <label class="eg__rotulo" for="est-bairro">{{
              t('parceiro.estabelecimento.campo.bairro')
            }}</label>
            <InputText
              id="est-bairro"
              v-model="form.bairro"
              maxlength="100"
              autocomplete="off"
              :disabled="salvando"
            />
          </section>

          <div class="eg__linha">
            <section class="eg__secao">
              <label class="eg__rotulo" for="est-cidade">{{
                t('parceiro.estabelecimento.campo.cidade')
              }}</label>
              <InputText
                id="est-cidade"
                v-model="form.cidade"
                maxlength="100"
                autocomplete="address-level2"
                :disabled="salvando"
              />
            </section>
            <section class="eg__secao">
              <span id="est-uf-rotulo" class="eg__rotulo">{{
                t('parceiro.estabelecimento.campo.uf')
              }}</span>
              <Select
                v-model="form.uf"
                :options="UFS"
                filter
                show-clear
                aria-labelledby="est-uf-rotulo"
                :disabled="salvando"
              />
            </section>
          </div>
        </div>

        <div class="eg__grupo">
          <h3 class="eg__grupo-titulo">{{ t('parceiro.estabelecimento.gaveta.naPagina') }}</h3>

          <section class="eg__secao">
            <div class="eg__chave">
              <label class="eg__rotulo" for="est-mostrar-endereco">{{
                t('parceiro.estabelecimento.campo.mostrarEndereco')
              }}</label>
              <ToggleSwitch
                v-model="form.mostrarEndereco"
                input-id="est-mostrar-endereco"
                :disabled="salvando"
              />
            </div>
            <p class="eg__dica">{{ t('parceiro.estabelecimento.gaveta.mostrarEnderecoDica') }}</p>
          </section>

          <section class="eg__secao">
            <div class="eg__chave">
              <label class="eg__rotulo" for="est-mostrar-mapa">{{
                t('parceiro.estabelecimento.campo.mostrarMapa')
              }}</label>
              <ToggleSwitch
                v-model="form.mostrarMapa"
                input-id="est-mostrar-mapa"
                :disabled="salvando || !form.mostrarEndereco"
              />
            </div>
            <p class="eg__dica">{{ t('parceiro.estabelecimento.gaveta.mostrarMapaDica') }}</p>
          </section>

          <div class="eg__linha">
            <section class="eg__secao">
              <label class="eg__rotulo" for="est-latitude">{{
                t('parceiro.estabelecimento.campo.latitude')
              }}</label>
              <InputText
                id="est-latitude"
                v-model="form.latitude"
                inputmode="decimal"
                maxlength="20"
                placeholder="-15.6014"
                :invalid="!!problemaDe('coordenadas')"
                :disabled="salvando"
              />
            </section>
            <section class="eg__secao">
              <label class="eg__rotulo" for="est-longitude">{{
                t('parceiro.estabelecimento.campo.longitude')
              }}</label>
              <InputText
                id="est-longitude"
                v-model="form.longitude"
                inputmode="decimal"
                maxlength="20"
                placeholder="-56.0979"
                :invalid="!!problemaDe('coordenadas')"
                :disabled="salvando"
              />
            </section>
          </div>
          <p v-if="problemaDe('coordenadas')" class="eg__invalido">
            {{ problemaDe('coordenadas') }}
          </p>
          <p v-else class="eg__dica">{{ t('parceiro.estabelecimento.gaveta.coordenadasDica') }}</p>
        </div>
      </template>

      <!-- ------------------------------------------------------------------ mensagens -->
      <template v-else>
        <section class="eg__secao">
          <label class="eg__rotulo" for="est-fora">
            {{ t('parceiro.estabelecimento.campo.mensagemForaDoHorario') }}
            <span class="eg__opcional">{{ t('parceiro.estabelecimento.gaveta.opcional') }}</span>
          </label>
          <Textarea
            id="est-fora"
            v-model="form.mensagemForaDoHorario"
            rows="3"
            auto-resize
            maxlength="500"
            :disabled="salvando"
          />
          <p class="eg__dica">{{ t('parceiro.estabelecimento.gaveta.foraDoHorarioDica') }}</p>
        </section>

        <section class="eg__secao">
          <label class="eg__rotulo" for="est-emergencia">
            {{ t('parceiro.estabelecimento.campo.orientacaoEmergencia') }}
            <span class="eg__opcional">{{ t('parceiro.estabelecimento.gaveta.opcional') }}</span>
          </label>
          <Textarea
            id="est-emergencia"
            v-model="form.orientacaoEmergencia"
            rows="4"
            auto-resize
            maxlength="1000"
            :disabled="salvando"
          />
          <p class="eg__dica">{{ t('parceiro.estabelecimento.gaveta.emergenciaDica') }}</p>
        </section>

        <p class="eg__aviso">
          <i class="ph ph-translate" aria-hidden="true" />
          {{ t('parceiro.estabelecimento.gaveta.semTraducao') }}
        </p>
      </template>

      <p v-if="erro" class="eg__erro" role="alert">
        <i class="ph ph-warning-circle" aria-hidden="true" />
        {{ erro.message }}
      </p>
    </form>

    <template #footer>
      <div class="eg__pe">
        <Button
          type="button"
          :label="t('parceiro.estabelecimento.gaveta.cancelar')"
          severity="secondary"
          outlined
          :disabled="salvando"
          @click="visible = false"
        />
        <Button
          type="submit"
          form="estabelecimento-perfil"
          icon="ph ph-check"
          :label="t('parceiro.estabelecimento.gaveta.salvar')"
          :loading="salvando"
        />
      </div>
    </template>
  </Drawer>
</template>
