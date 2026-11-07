<script setup lang="ts">
/**
 * Os movimentos do estoque (E6-01b, guia e6 11 e 6): entradas e baixas, da mais recente, com quem
 * registrou (só o nome) e, na baixa estornada, quando, quem e por quê, riscada e à vista (é a trilha
 * do desvio). Estornar é do DONO e do GESTOR, com motivo. A aplicação de vacina tem lista própria.
 *
 * O período padrão são os últimos 30 dias; o cursor guarda o período da primeira página.
 */
import Button from 'primevue/button'
import SelectButton from 'primevue/selectbutton'
import Textarea from 'primevue/textarea'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import CadastroGaveta from '@/components/cadastro/CadastroGaveta.vue'
import { lerErroDoCadastro } from '@/components/cadastro/erros-do-cadastro'
import { useRotulosDoCadastro } from '@/components/cadastro/useRotulosDoCadastro'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { invalidarPendenciasDoPortal } from '@/composables/usePendenciasDoPortal'
import { INTL_LOCALE, type Locale } from '@/i18n/locales'
import {
  estornarBaixa,
  listarMovimentos,
  MOTIVO_DO_ESTORNO_MAX,
  MOTIVO_DO_ESTORNO_MIN,
  type Movimento,
} from '@/service/parceiro/estoque-service'
import { formatCentavosToBrl } from '@/utils/format/money'

const { t, locale } = useI18n()
const rotulos = useRotulosDoCadastro()
const { store, parceiroQuery } = useParceiroPortal()

const planeja = computed(
  () => Boolean(store.modulo('CLINICA')?.podeEscrever) && store.temPermissao('estoque.planejar'),
)

const TODOS = 'TODOS'
type Filtro = typeof TODOS | Movimento['tipo']

const filtro = ref<Filtro>(TODOS)
const itens = ref<Movimento[]>([])
const cursor = ref<string | null>(null)
const periodo = ref<{ de: string; ate: string } | null>(null)
const carregando = ref(false)
const erro = ref('')

async function carregar(mais = false) {
  carregando.value = true
  erro.value = ''
  try {
    const pagina = await listarMovimentos(
      { tipo: filtro.value === TODOS ? null : filtro.value, cursor: mais ? cursor.value : null },
      parceiroQuery(),
    )
    itens.value = mais ? [...itens.value, ...pagina.itens] : pagina.itens
    cursor.value = pagina.proximoCursor
    periodo.value = { de: pagina.de, ate: pagina.ate }
  } catch (err) {
    erro.value = lerErroDoCadastro(err, t('estoque.movimentos.erro')).mensagem
  } finally {
    carregando.value = false
  }
}

onMounted(() => void carregar())
watch(filtro, () => void carregar())

const opcoes = computed(() => [
  { valor: TODOS, rotulo: t('estoque.movimentos.todos') },
  { valor: 'ENTRADA', rotulo: t('estoque.movimentos.entradas') },
  { valor: 'BAIXA', rotulo: t('estoque.movimentos.baixas') },
])

function titulo(item: Movimento) {
  return item.tipo === 'ENTRADA'
    ? t(
        'estoque.movimentos.entrou',
        { n: item.quantidade, vacina: item.vacina.nome },
        item.quantidade,
      )
    : t(
        'estoque.movimentos.saiu',
        { n: item.quantidade, vacina: item.vacina.nome },
        item.quantidade,
      )
}

function meta(item: Movimento) {
  return [
    rotulos.dia(item.em),
    item.codigo,
    item.motivo ? t(`estoque.baixa.motivo.${item.motivo}`) : '',
    item.fornecedor ?? '',
    item.notaFiscal ?? '',
    item.quemNome ?? '',
    typeof item.valorCentavos === 'number'
      ? formatCentavosToBrl(item.valorCentavos, INTL_LOCALE[locale.value as Locale])
      : '',
  ]
    .filter(Boolean)
    .join(' · ')
}

function estorno(item: Movimento) {
  if (!item.estorno) return ''
  return t('estoque.movimentos.estornada', {
    quem: item.estorno.quemNome ?? '',
    motivo: item.estorno.motivo,
  })
}

/* ----------------------------------------------------------------------------- estorno */

const estornoAberto = ref(false)
const alvo = ref<Movimento | null>(null)
const motivo = ref('')
const tentou = ref(false)
const salvando = ref(false)
const erroDoEstorno = ref('')

function abrirEstorno(item: Movimento) {
  alvo.value = item
  motivo.value = ''
  tentou.value = false
  erroDoEstorno.value = ''
  estornoAberto.value = true
}

const motivoValido = computed(() => {
  const tamanho = motivo.value.trim().length
  return tamanho >= MOTIVO_DO_ESTORNO_MIN && tamanho <= MOTIVO_DO_ESTORNO_MAX
})

async function estornar() {
  tentou.value = true
  erroDoEstorno.value = ''
  if (!alvo.value || !motivoValido.value) return
  salvando.value = true
  try {
    await estornarBaixa(alvo.value.id, motivo.value.trim(), parceiroQuery())
    estornoAberto.value = false
    invalidarPendenciasDoPortal()
    void carregar()
  } catch (err) {
    erroDoEstorno.value = lerErroDoCadastro(err, t('estoque.movimentos.erroEstorno')).mensagem
  } finally {
    salvando.value = false
  }
}
</script>

<template>
  <div class="mv">
    <div class="mv__filtros">
      <SelectButton
        v-model="filtro"
        :options="opcoes"
        option-label="rotulo"
        option-value="valor"
        :allow-empty="false"
        :aria-label="t('estoque.movimentos.filtro')"
      />
      <span v-if="periodo" class="mv__periodo">{{
        t('estoque.movimentos.periodo', {
          de: rotulos.dia(periodo.de),
          ate: rotulos.dia(periodo.ate),
        })
      }}</span>
    </div>

    <p v-if="erro" class="mv__erro" role="alert">{{ erro }}</p>

    <section class="ui-folha ui-lista" :aria-busy="carregando">
      <ul v-if="itens.length" class="ui-lista">
        <li
          v-for="item in itens"
          :key="`${item.tipo}-${item.id}`"
          class="ui-linha"
          :class="{ mv__estornada: item.estorno }"
        >
          <span class="ui-ladrilho ui-ladrilho--p" aria-hidden="true">
            <i
              :class="item.tipo === 'ENTRADA' ? 'ph ph-arrow-down-left' : 'ph ph-arrow-up-right'"
            />
          </span>
          <span class="ui-linha__texto">
            <strong class="ui-linha__titulo mv__titulo">{{ titulo(item) }}</strong>
            <span class="ui-linha__meta">{{ meta(item) }}</span>
            <span v-if="item.observacao" class="ui-linha__meta">{{ item.observacao }}</span>
            <span v-if="item.estorno" class="ui-linha__meta mv__nota-estorno">{{
              estorno(item)
            }}</span>
          </span>
          <span v-if="planeja && item.tipo === 'BAIXA' && !item.estorno" class="ui-linha__fim">
            <Button
              type="button"
              size="small"
              severity="secondary"
              outlined
              icon="ph ph-arrow-counter-clockwise"
              :label="t('estoque.movimentos.estornar')"
              @click="abrirEstorno(item)"
            />
          </span>
        </li>
      </ul>
      <p v-else-if="!carregando" class="ui-vazio">{{ t('estoque.movimentos.vazio') }}</p>
    </section>

    <Button
      v-if="cursor"
      type="button"
      severity="secondary"
      outlined
      class="mv__mais"
      :label="t('estoque.movimentos.verMais')"
      :loading="carregando"
      @click="carregar(true)"
    />

    <CadastroGaveta
      v-model:visible="estornoAberto"
      :titulo="t('estoque.movimentos.estornarTitulo')"
      icone="ph ph-arrow-counter-clockwise"
    >
      <form id="estornar-baixa" class="eg" novalidate @submit.prevent="estornar">
        <p class="eg__dica">{{ t('estoque.movimentos.estornarDica') }}</p>
        <section class="eg__secao">
          <label class="eg__rotulo" for="es-motivo">{{ t('estoque.movimentos.motivo') }}</label>
          <Textarea
            id="es-motivo"
            v-model="motivo"
            rows="3"
            auto-resize
            :maxlength="MOTIVO_DO_ESTORNO_MAX"
            :invalid="tentou && !motivoValido"
            :disabled="salvando"
          />
          <small class="eg__dica">{{
            t('estoque.movimentos.motivoDica', { min: MOTIVO_DO_ESTORNO_MIN })
          }}</small>
        </section>
        <p v-if="erroDoEstorno" class="eg__erro" role="alert">
          <i class="ph ph-warning-circle" aria-hidden="true" />
          <span>{{ erroDoEstorno }}</span>
        </p>
      </form>
      <template #pe>
        <Button
          type="button"
          severity="secondary"
          outlined
          :label="t('cadastro.cancelar')"
          :disabled="salvando"
          @click="estornoAberto = false"
        />
        <Button
          type="submit"
          form="estornar-baixa"
          icon="ph ph-arrow-counter-clockwise"
          :label="t('estoque.movimentos.estornar')"
          :loading="salvando"
        />
      </template>
    </CadastroGaveta>
  </div>
</template>

<style scoped>
.mv {
  display: grid;
  gap: 16px;
}

.mv__filtros {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}

.mv__periodo {
  color: var(--tinta-2);
  font-size: 13.5px;
}

.mv__erro {
  margin: 0;
  color: var(--risco-tinta);
  font-size: 13.5px;
}

.mv__estornada .mv__titulo {
  text-decoration: line-through;
}

.mv__nota-estorno {
  color: var(--atencao-tinta);
}

.mv__mais {
  justify-self: start;
}
</style>
