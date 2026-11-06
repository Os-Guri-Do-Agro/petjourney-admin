<script setup lang="ts">
/**
 * Tratamentos em casa da clínica pela API (E4-05b, PJ-LU09N7; guia e4 7b.1 e 7b.3): para quem a
 * clínica precisa ligar. Abre em "Pedem atenção" (os críticos com alerta aberto, o mesmo número do
 * contador do menu, `?filtro=PEDEM_ATENCAO`); "Todos" traz o resto, do mais novo.
 *
 * A lista é o que o cron gravou (até 30 minutos de atraso); a ficha do paciente é ao vivo, e é lá
 * que a faixa de doses e o contato moram. Cada linha abre a ficha.
 */
import Button from 'primevue/button'
import SelectButton from 'primevue/selectbutton'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRoute, useRouter } from 'vue-router'

import { lerErroDoCadastro } from '@/components/cadastro/erros-do-cadastro'
import { useRotulosDoCadastro } from '@/components/cadastro/useRotulosDoCadastro'
import UiPagina from '@/components/ui/UiPagina.vue'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { listarTratamentos, type TratamentoNaLista } from '@/service/parceiro/adesao-service'

import { useFrasesDaAdesao } from './useFrasesDaAdesao'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const rotulos = useRotulosDoCadastro()
const frases = useFrasesDaAdesao()
const { parceiroQuery } = useParceiroPortal()

type Recorte = 'PEDEM_ATENCAO' | 'TODOS'

/** Sem filtro na rota, abre em "Pedem atenção": é a pergunta de quem abre o dia. */
const recorte = computed<Recorte>(() =>
  route.query.filtro === 'TODOS' ? 'TODOS' : 'PEDEM_ATENCAO',
)

function trocarRecorte(valor: Recorte) {
  void router.replace({ query: { ...route.query, filtro: valor } })
}

const opcoes = computed(() => [
  { valor: 'PEDEM_ATENCAO', rotulo: t('clinico.adesao.lista.recorte.atencao') },
  { valor: 'TODOS', rotulo: t('adesao.lista.todos') },
])

const itens = ref<TratamentoNaLista[]>([])
const cursor = ref<string | null>(null)
const carregando = ref(false)
const lido = ref(false)
const erro = ref('')

async function carregar(mais = false) {
  carregando.value = true
  erro.value = ''
  try {
    const pagina = await listarTratamentos(
      { pedemAtencao: recorte.value === 'PEDEM_ATENCAO', cursor: mais ? cursor.value : null },
      parceiroQuery(),
    )
    itens.value = mais ? [...itens.value, ...pagina.itens] : pagina.itens
    cursor.value = pagina.proximoCursor
    lido.value = true
  } catch (err) {
    erro.value = lerErroDoCadastro(err, t('adesao.erro')).mensagem
  } finally {
    carregando.value = false
  }
}

watch(recorte, () => void carregar())
onMounted(() => void carregar())

function meta(item: TratamentoNaLista) {
  return [
    item.medicamento,
    item.situacao === 'ENCERRADO'
      ? t('clinico.adesao.lista.situacaoEncerrado')
      : item.situacao === 'NAO_COMPARTILHADO'
        ? t('adesao.lista.naoCompartilhado')
        : t('adesao.inicio', { data: rotulos.data(item.inicioEm) }),
    item.contatoEm ? t('adesao.lista.contatoEm', { data: rotulos.data(item.contatoEm) }) : '',
  ]
    .filter(Boolean)
    .join(' · ')
}

const resumo = computed(() => {
  if (!lido.value) return ''
  if (recorte.value !== 'PEDEM_ATENCAO') return t('clinico.adesao.subtitulo')
  return itens.value.length
    ? t('adesao.lista.resumo', { n: itens.value.length }, itens.value.length)
    : t('adesao.lista.resumoEmDia')
})
</script>

<template>
  <UiPagina
    :resumo="resumo"
    :carregando="carregando && !lido"
    :erro="lido ? '' : erro"
    @tentar-de-novo="carregar"
  >
    <div class="tc">
      <SelectButton
        :model-value="recorte"
        :options="opcoes"
        option-label="rotulo"
        option-value="valor"
        :allow-empty="false"
        :aria-label="t('adesao.lista.filtro')"
        class="tc__filtro"
        @update:model-value="trocarRecorte"
      />

      <p v-if="erro && lido" class="tc__erro" role="alert">{{ erro }}</p>

      <section class="ui-folha ui-lista" :aria-busy="carregando">
        <ul v-if="itens.length" class="ui-lista">
          <li v-for="item in itens" :key="item.tratamentoId">
            <RouterLink class="ui-linha" :to="`/clinica/ficha/${item.pacienteId}`">
              <span class="ui-linha__texto">
                <strong class="ui-linha__titulo tc__nome">
                  {{ item.pacienteNome }}
                  <span v-if="item.critico" class="ui-selo ui-selo--atencao">{{
                    t('clinico.adesao.critico.selo')
                  }}</span>
                </strong>
                <span class="ui-linha__meta">{{ meta(item) }}</span>
                <span v-if="item.alerta" class="tc__alerta">
                  <i class="ph ph-warning" aria-hidden="true" />
                  {{ frases.alerta(item.alerta) }}
                  <template v-if="item.alertaDesde">
                    · {{ t('adesao.lista.desde', { data: rotulos.data(item.alertaDesde) }) }}
                  </template>
                </span>
              </span>
              <i class="ph ph-caret-right ui-linha__seta" aria-hidden="true" />
            </RouterLink>
          </li>
        </ul>
        <p v-else-if="lido && !carregando" class="ui-vazio tc__vazio">
          {{
            recorte === 'PEDEM_ATENCAO'
              ? t('adesao.lista.vazioAtencao')
              : t('clinico.adesao.lista.vazioDescricao')
          }}
        </p>
      </section>

      <Button
        v-if="cursor"
        type="button"
        severity="secondary"
        outlined
        class="tc__mais"
        :label="t('adesao.lista.verMais')"
        :loading="carregando"
        @click="carregar(true)"
      />
    </div>
  </UiPagina>
</template>

<style scoped>
.tc {
  display: grid;
  gap: 16px;
}

.tc__filtro {
  justify-self: start;
}

.tc__erro {
  margin: 0;
  color: var(--risco-tinta);
  font-size: 13.5px;
}

.tc__nome {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.tc__alerta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 6px;
  color: var(--tinta);
  font-size: 13.5px;
}

.tc__alerta i {
  color: var(--atencao-tinta);
}

.tc__vazio {
  margin: 0;
  padding: 24px 16px;
  color: var(--tinta-2);
}

.tc__mais {
  justify-self: start;
}
</style>
