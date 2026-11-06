<script setup lang="ts">
/**
 * O histórico clínico do paciente na ficha (E4-01, guia e4 5.9): atendimentos, atos, vacinas,
 * faltas, cirurgias e internações, do mais recente, por cursor. Só os tipos que a pessoa lê (a
 * recepção não vê esta caixa: ela pede `prontuario.ler`).
 *
 * Recolhida em dez linhas; o filtro é a contagem de cada tipo (com "1000+" acima do teto). O
 * atendimento abre o prontuário; a falta, o horário na agenda. O avulso (atendimento fora da
 * agenda) nasce aqui, no cabeçalho, para quem escreve no prontuário.
 */
import Button from 'primevue/button'
import SelectButton from 'primevue/selectbutton'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRouter } from 'vue-router'

import { lerErroDoCadastro } from '@/components/cadastro/erros-do-cadastro'
import { useRotulosDoCadastro } from '@/components/cadastro/useRotulosDoCadastro'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { criarChaveadorDeIdempotencia } from '@/service/idempotencia'
import {
  abrirAvulso,
  lerLinhaDoTempo,
  type ItemDaLinhaDoTempo,
  type LinhaDoTempo,
  type TipoNaLinhaDoTempo,
} from '@/service/parceiro/atendimentos-service'

const props = defineProps<{ pacienteId: string; ativo: boolean; obito: boolean }>()

const { t, te } = useI18n()
const router = useRouter()
const rotulos = useRotulosDoCadastro()
const { store, parceiroQuery } = useParceiroPortal()
const chaveador = criarChaveadorDeIdempotencia()

const ICONE: Record<TipoNaLinhaDoTempo, string> = {
  ATENDIMENTO: 'ph ph-stethoscope',
  CIRURGIA: 'ph ph-scissors',
  ATO: 'ph ph-bandaids',
  VACINA: 'ph ph-syringe',
  FALTA: 'ph ph-user-minus',
  INTERNACAO: 'ph ph-bed',
}

/* O SelectButton não marca a opção de valor `null`: "Tudo" tem um valor próprio. */
const TUDO = 'TUDO'
const filtro = ref<TipoNaLinhaDoTempo | typeof TUDO>(TUDO)
const itens = ref<ItemDaLinhaDoTempo[]>([])
const contagens = ref<LinhaDoTempo['contagens']>(null)
const cursor = ref<string | null>(null)
const carregando = ref(false)
const erro = ref('')
const lida = ref(false)

async function carregar(mais = false) {
  carregando.value = true
  erro.value = ''
  try {
    const pagina = await lerLinhaDoTempo(
      props.pacienteId,
      {
        tipos: filtro.value !== TUDO ? [filtro.value] : undefined,
        cursor: mais ? cursor.value : null,
      },
      parceiroQuery(),
    )
    itens.value = mais ? [...itens.value, ...pagina.itens] : pagina.itens
    cursor.value = pagina.proximoCursor
    /* A contagem só vem na primeira página sem filtro: é ela que monta as opções do filtro. */
    if (!mais && filtro.value === TUDO) contagens.value = pagina.contagens
    lida.value = true
  } catch (err) {
    erro.value = lerErroDoCadastro(err, t('atendimento.linha.erro')).mensagem
  } finally {
    carregando.value = false
  }
}

watch(filtro, () => void carregar())
watch(
  () => props.pacienteId,
  () => {
    filtro.value = TUDO
    contagens.value = null
    void carregar()
  },
)
onMounted(() => void carregar())

const opcoesDeFiltro = computed(() => [
  { valor: TUDO, rotulo: t('atendimento.linha.tudo') },
  ...(contagens.value ?? [])
    .filter((item) => item.total > 0)
    .map((item) => ({
      valor: item.tipo,
      rotulo: `${t(`atendimento.linha.tipo.${item.tipo}`)} ${item.maisDe ? `${item.total}+` : item.total}`,
    })),
])

function titulo(item: ItemDaLinhaDoTempo) {
  if (item.tipo === 'ATENDIMENTO' && te(`agenda.config.tipo.kind.${item.titulo}`)) {
    return t(`agenda.config.tipo.kind.${item.titulo}`)
  }
  return item.titulo
}

function meta(item: ItemDaLinhaDoTempo) {
  return [
    `${rotulos.dia(item.em.slice(0, 10))} ${item.em.slice(11, 16)}`,
    item.profissionalNome,
    item.detalhe,
  ]
    .filter(Boolean)
    .join(' · ')
}

function destino(item: ItemDaLinhaDoTempo) {
  if (item.tipo === 'ATENDIMENTO') return `/clinica/atendimento/${item.id}`
  if (item.tipo === 'FALTA') {
    return { path: '/clinica/agenda', query: { data: item.em.slice(0, 10), horario: item.id } }
  }
  return null
}

const anulado = (item: ItemDaLinhaDoTempo) => item.situacao === 'ANULADO'

/* ------------------------------------------------------------------------------ avulso */

const podeAbrir = computed(
  () =>
    store.temPermissao('prontuario.escrever') &&
    Boolean(store.modulo('CLINICA')?.podeEscrever) &&
    (props.ativo || props.obito),
)
const abrindo = ref(false)

async function abrir() {
  abrindo.value = true
  erro.value = ''
  const corpo = { pacienteId: props.pacienteId }
  try {
    const atendimento = await abrirAvulso(corpo, chaveador.para(corpo), parceiroQuery())
    chaveador.concluir()
    void router.push(`/clinica/atendimento/${atendimento.id}`)
  } catch (err) {
    erro.value = lerErroDoCadastro(err, t('atendimento.linha.erroAvulso')).mensagem
  } finally {
    abrindo.value = false
  }
}
</script>

<template>
  <section class="ui-folha ui-cartao lt" aria-labelledby="lt-titulo" :aria-busy="carregando">
    <header class="ui-cartao__cabeca">
      <span class="ui-ladrilho" aria-hidden="true"
        ><i class="ph ph-clock-counter-clockwise"
      /></span>
      <span class="ui-cartao__titulos">
        <h2 id="lt-titulo" class="ui-cartao__titulo">{{ t('atendimento.linha.titulo') }}</h2>
        <p class="ui-cartao__descricao">{{ t('atendimento.linha.descricao') }}</p>
      </span>
      <Button
        v-if="podeAbrir"
        type="button"
        size="small"
        icon="ph ph-plus"
        :label="t('atendimento.linha.avulso')"
        :loading="abrindo"
        @click="abrir"
      />
    </header>

    <SelectButton
      v-if="opcoesDeFiltro.length > 2"
      v-model="filtro"
      class="lt__filtro"
      :options="opcoesDeFiltro"
      option-label="rotulo"
      option-value="valor"
      :allow-empty="false"
      :aria-label="t('atendimento.linha.filtro')"
    />

    <p v-if="erro" class="lt__nota lt__erro" role="alert">{{ erro }}</p>

    <ul v-if="itens.length" class="ui-lista">
      <li
        v-for="item in itens"
        :key="`${item.tipo}-${item.id}`"
        class="lt__item"
        :class="{ 'lt__item--anulado': anulado(item) }"
      >
        <component
          :is="destino(item) ? RouterLink : 'div'"
          :to="destino(item) ?? undefined"
          class="ui-linha lt__linha"
        >
          <i :class="ICONE[item.tipo]" class="lt__icone" aria-hidden="true" />
          <span class="ui-linha__texto">
            <strong class="ui-linha__titulo lt__titulo">
              <span class="lt__nome">{{ titulo(item) }}</span>
              <span v-if="item.situacao === 'RASCUNHO'" class="ui-selo ui-selo--atencao">{{
                t('atendimento.situacao.RASCUNHO')
              }}</span>
              <span v-else-if="anulado(item)" class="ui-selo">{{
                t('atendimento.situacao.ANULADO')
              }}</span>
            </strong>
            <span class="ui-linha__meta">{{ meta(item) }}</span>
          </span>
          <i v-if="destino(item)" class="ph ph-caret-right ui-linha__seta" aria-hidden="true" />
        </component>
      </li>
    </ul>
    <p v-else-if="lida && !carregando && !erro" class="lt__nota">
      {{ t('atendimento.linha.vazio') }}
    </p>

    <Button
      v-if="cursor"
      type="button"
      severity="secondary"
      outlined
      size="small"
      class="lt__mais"
      :label="t('atendimento.linha.verMais')"
      :loading="carregando"
      @click="carregar(true)"
    />
  </section>
</template>

<style scoped>
.lt__filtro {
  flex-wrap: wrap;
}

.lt__nota {
  margin: 0;
  color: var(--tinta-2);
  font-size: 13.5px;
}

.lt__erro {
  color: var(--risco-tinta);
}

.lt__linha {
  color: inherit;
  text-decoration: none;
}

.lt__icone {
  flex: none;
  color: var(--tinta-2);
  font-size: 18px;
}

.lt__titulo {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.lt__item--anulado .lt__nome,
.lt__item--anulado .ui-linha__meta {
  text-decoration: line-through;
}

.lt__mais {
  justify-self: start;
}
</style>
