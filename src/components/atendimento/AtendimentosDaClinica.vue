<script setup lang="ts">
/**
 * Atendimentos pela API (E4-01, PJ-QQT1WN; guia e4 5.3). A lista não traz texto clínico: paciente,
 * tipo, quem responde, a situação e as datas.
 *
 * Duas perguntas, nesta ordem, como na demonstração: **o que falta assinar** (os rascunhos, do mais
 * velho, numa caixa com o cabeçalho de atenção) e **o que já foi feito** (os registros, por dia).
 * O filtro (`?status=`) troca as duas caixas por uma só; o contador do menu abre em
 * `?status=RASCUNHO`. O rascunho de quem saiu da clínica aparece aqui: outro veterinário abre,
 * assume e finaliza com confirmação.
 *
 * O atendimento nasce no "Iniciar" da agenda ou avulso, na ficha do paciente.
 */
import SelectButton from 'primevue/selectbutton'
import Button from 'primevue/button'
import ToggleSwitch from 'primevue/toggleswitch'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRoute, useRouter } from 'vue-router'

import { lerErroDoCadastro } from '@/components/cadastro/erros-do-cadastro'
import { iniciais, useRotulosDoCadastro } from '@/components/cadastro/useRotulosDoCadastro'
import UiPagina from '@/components/ui/UiPagina.vue'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import PetAvatar from '@/features/hotel/components/base/PetAvatar.vue'
import {
  listarAtendimentos,
  type ItemDaLista,
  type StatusDoAtendimento,
} from '@/service/parceiro/atendimentos-service'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const rotulos = useRotulosDoCadastro()
const { store, parceiroQuery } = useParceiroPortal()

const STATUS: readonly StatusDoAtendimento[] = ['RASCUNHO', 'FINALIZADO', 'ANULADO']

const status = computed<StatusDoAtendimento | null>(() => {
  const valor = route.query.status
  return STATUS.find((item) => item === valor) ?? null
})

/* O SelectButton não marca a opção de valor `null`: "Todos" tem um valor próprio. */
const TODOS = 'TODOS'

function trocarStatus(valor: StatusDoAtendimento | typeof TODOS) {
  const query = { ...route.query }
  if (valor !== TODOS) query.status = valor
  else delete query.status
  void router.replace({ query })
}

const opcoesDeStatus = computed(() => [
  { valor: TODOS, rotulo: t('atendimento.lista.todos') },
  ...STATUS.map((valor) => ({ valor, rotulo: t(`atendimento.lista.status.${valor}`) })),
])

/** "Só os meus": quem atende tem ficha de profissional. */
const meuId = computed(() => store.eu?.profissional?.id ?? null)
const soMeus = ref(false)

/* ------------------------------------------------------------------------------ leitura */

const rascunhos = ref<ItemDaLista[]>([])
const registros = ref<ItemDaLista[]>([])
const cursor = ref<string | null>(null)
const carregando = ref(false)
const lido = ref(false)
const erro = ref('')

const profissionalId = computed(() => (soMeus.value ? meuId.value : null))

async function carregar(mais = false) {
  carregando.value = true
  erro.value = ''
  const query = parceiroQuery()
  try {
    if (status.value) {
      const pagina = await listarAtendimentos(
        {
          status: status.value,
          profissionalId: profissionalId.value,
          cursor: mais ? cursor.value : null,
        },
        query,
      )
      registros.value = mais ? [...registros.value, ...pagina.itens] : pagina.itens
      rascunhos.value = []
      cursor.value = pagina.proximoCursor
    } else {
      const [abertos, pagina] = await Promise.all([
        mais
          ? Promise.resolve(null)
          : listarAtendimentos(
              { status: 'RASCUNHO', profissionalId: profissionalId.value, limit: 50 },
              query,
            ),
        listarAtendimentos(
          { profissionalId: profissionalId.value, cursor: mais ? cursor.value : null },
          query,
        ),
      ])
      if (abertos) rascunhos.value = abertos.itens
      /* Sem filtro, a lista também traz os rascunhos: eles já estão na caixa de cima. */
      const fechados = pagina.itens.filter((item) => item.status !== 'RASCUNHO')
      registros.value = mais ? [...registros.value, ...fechados] : fechados
      cursor.value = pagina.proximoCursor
    }
    lido.value = true
  } catch (err) {
    erro.value = lerErroDoCadastro(err, t('atendimento.lista.erro')).mensagem
  } finally {
    carregando.value = false
  }
}

watch([status, soMeus], () => void carregar())
onMounted(() => void carregar())

/* ------------------------------------------------------------------------------ leitura */

/** Do mais velho: o esquecido é o que pede a vez. */
const rascunhosEmOrdem = computed(() =>
  status.value === 'RASCUNHO'
    ? [...registros.value].sort((a, b) => a.abertoEm.localeCompare(b.abertoEm))
    : [...rascunhos.value].sort((a, b) => a.abertoEm.localeCompare(b.abertoEm)),
)

const listaDeRegistros = computed(() => (status.value === 'RASCUNHO' ? [] : registros.value))

/** Os registros por dia do atendimento, do mais recente. */
const dias = computed(() => {
  const grupos = new Map<string, ItemDaLista[]>()
  for (const item of listaDeRegistros.value) {
    const lista = grupos.get(item.dataDoAtendimento) ?? []
    lista.push(item)
    grupos.set(item.dataDoAtendimento, lista)
  }
  return [...grupos.entries()].map(([dia, itens]) => ({ dia, itens }))
})

const agora = ref(Date.now())

function horasAberto(item: ItemDaLista) {
  return Math.max(0, (agora.value - new Date(item.abertoEm).getTime()) / 3_600_000)
}

/** O tom do contador do menu: neutro até 12 h, atenção até 24 h, risco depois (guia 5.11). */
function idade(item: ItemDaLista): { texto: string; tom: string } | null {
  if (item.nuncaAberto) return { texto: t('atendimento.lista.nuncaAberto'), tom: '' }
  const horas = horasAberto(item)
  if (horas >= 24) {
    const dias = Math.floor(horas / 24)
    return { texto: t('atendimento.lista.abertoHaDias', { n: dias }, dias), tom: 'risco' }
  }
  if (horas >= 12) {
    const inteiras = Math.floor(horas)
    return {
      texto: t('atendimento.lista.abertoHaHoras', { n: inteiras }, inteiras),
      tom: 'atencao',
    }
  }
  return null
}

function tipo(item: ItemDaLista) {
  return t(`agenda.config.tipo.kind.${item.tipo}`)
}

const maisAntigo = computed(() => rascunhosEmOrdem.value[0] ?? null)

const resumo = computed(() => {
  if (!lido.value) return ''
  const abertos = rascunhosEmOrdem.value.length
  if (status.value && status.value !== 'RASCUNHO') return t('atendimento.lista.resumoFiltro')
  return abertos
    ? t('atendimento.lista.resumoAbertos', { n: abertos }, abertos)
    : t('atendimento.lista.resumoEmDia')
})

const vazio = computed(
  () => lido.value && !rascunhosEmOrdem.value.length && !listaDeRegistros.value.length,
)

function rotuloDoDia(dia: string) {
  return rotulos.dia(dia)
}
</script>

<template>
  <UiPagina
    :resumo="resumo"
    :carregando="carregando && !lido"
    :erro="lido ? '' : erro"
    bloquear-se-suspenso
    @tentar-de-novo="carregar"
  >
    <template v-if="maisAntigo" #acoes>
      <Button
        type="button"
        icon="ph ph-note-pencil"
        :label="t('atendimento.lista.continuar', { pet: maisAntigo.pacienteNome })"
        @click="router.push(`/clinica/atendimento/${maisAntigo.id}`)"
      />
    </template>

    <div class="at">
      <div class="at__filtros">
        <SelectButton
          :model-value="status ?? TODOS"
          :options="opcoesDeStatus"
          option-label="rotulo"
          option-value="valor"
          :allow-empty="false"
          :aria-label="t('atendimento.lista.filtro')"
          @update:model-value="trocarStatus"
        />
        <label v-if="meuId" class="at__meus">
          <ToggleSwitch v-model="soMeus" input-id="at-meus" />
          <span>{{ t('atendimento.lista.soMeus') }}</span>
        </label>
      </div>

      <p v-if="erro && lido" class="at__erro" role="alert">{{ erro }}</p>

      <p v-if="vazio" class="ui-folha ui-vazio">
        <strong>{{ t('atendimento.lista.vazioTitulo') }}</strong>
        <span>{{ t('atendimento.lista.vazioDica') }}</span>
      </p>

      <!-- O que falta assinar: a única coisa desta tela que pede ação. -->
      <section
        v-if="rascunhosEmOrdem.length"
        class="ui-folha ui-cartao"
        aria-labelledby="at-rascunhos"
        :aria-busy="carregando"
      >
        <header class="ui-cartao__cabeca ui-cartao__cabeca--atencao">
          <span class="ui-ladrilho ui-ladrilho--atencao" aria-hidden="true">
            <i class="ph ph-note-pencil" />
          </span>
          <span class="ui-cartao__titulos">
            <h2 id="at-rascunhos" class="ui-cartao__titulo">
              {{ t('atendimento.lista.paraAssinar') }}
            </h2>
            <p class="ui-cartao__descricao">{{ t('atendimento.lista.paraAssinarDica') }}</p>
          </span>
          <span class="ui-contagem">{{ rascunhosEmOrdem.length }}</span>
        </header>

        <ul class="ui-lista">
          <li v-for="item in rascunhosEmOrdem" :key="item.id">
            <RouterLink
              class="ui-linha ui-linha--clicavel at__linha"
              :class="idade(item)?.tom ? `ui-marca ui-marca--${idade(item)?.tom}` : ''"
              :to="`/clinica/atendimento/${item.id}`"
            >
              <span class="at__quando">
                <span class="ui-hora">{{ item.abertoEm.slice(11, 16) }}</span>
                <small class="ui-num">{{ rotuloDoDia(item.dataDoAtendimento) }}</small>
              </span>
              <PetAvatar
                :nome="item.pacienteNome"
                :iniciais="iniciais(item.pacienteNome)"
                :especie="null"
                foto-url=""
                tamanho="md"
              />
              <span class="ui-linha__texto">
                <strong class="ui-linha__titulo">{{ item.pacienteNome }}</strong>
                <span class="ui-linha__meta">{{ tipo(item) }} · {{ item.profissionalNome }}</span>
              </span>
              <span v-if="idade(item)" class="ui-linha__fim">
                <span
                  class="ui-selo"
                  :class="idade(item)?.tom ? `ui-selo--${idade(item)?.tom}` : ''"
                >
                  <i class="ph ph-clock" aria-hidden="true" />
                  {{ idade(item)?.texto }}
                </span>
              </span>
              <i class="ph ph-caret-right ui-linha__seta" aria-hidden="true" />
            </RouterLink>
          </li>
        </ul>
      </section>

      <!-- O que já foi feito: uma caixa, um bloco por dia. -->
      <section
        v-if="listaDeRegistros.length"
        class="ui-folha ui-cartao"
        aria-labelledby="at-registros"
        :aria-busy="carregando"
      >
        <header class="ui-cartao__cabeca">
          <span class="ui-ladrilho ui-ladrilho--ok" aria-hidden="true">
            <i class="ph ph-seal-check" />
          </span>
          <span class="ui-cartao__titulos">
            <h2 id="at-registros" class="ui-cartao__titulo">
              {{
                status === 'ANULADO'
                  ? t('atendimento.lista.status.ANULADO')
                  : t('atendimento.lista.registros')
              }}
            </h2>
            <p class="ui-cartao__descricao">{{ t('atendimento.lista.registrosDica') }}</p>
          </span>
        </header>

        <section v-for="grupo in dias" :key="grupo.dia" class="at__dia">
          <h3 class="at__dia-titulo">
            {{ rotuloDoDia(grupo.dia) }}
            <span class="ui-contagem">{{ grupo.itens.length }}</span>
          </h3>
          <ul class="ui-lista">
            <li v-for="item in grupo.itens" :key="item.id">
              <RouterLink
                class="ui-linha ui-linha--clicavel at__linha"
                :class="{ 'at__linha--anulada': item.status === 'ANULADO' }"
                :to="`/clinica/atendimento/${item.id}`"
              >
                <span class="at__quando">
                  <span class="ui-hora">{{
                    (item.finalizadoEm ?? item.abertoEm).slice(11, 16)
                  }}</span>
                </span>
                <PetAvatar
                  :nome="item.pacienteNome"
                  :iniciais="iniciais(item.pacienteNome)"
                  :especie="null"
                  foto-url=""
                  tamanho="md"
                />
                <span class="ui-linha__texto">
                  <strong class="ui-linha__titulo at__nome">{{ item.pacienteNome }}</strong>
                  <span class="ui-linha__meta">{{ tipo(item) }} · {{ item.profissionalNome }}</span>
                </span>
                <span v-if="item.status === 'ANULADO'" class="ui-linha__fim">
                  <span class="ui-selo">{{ t('atendimento.situacao.ANULADO') }}</span>
                </span>
                <i class="ph ph-caret-right ui-linha__seta" aria-hidden="true" />
              </RouterLink>
            </li>
          </ul>
        </section>
      </section>

      <Button
        v-if="cursor"
        type="button"
        severity="secondary"
        outlined
        class="at__mais"
        :label="t('atendimento.lista.verMais')"
        :loading="carregando"
        @click="carregar(true)"
      />
    </div>
  </UiPagina>
</template>

<style scoped>
.at {
  display: grid;
  gap: 16px;
}

.at__filtros {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px 20px;
}

.at__meus {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--tinta-2);
  font-size: 14px;
  cursor: pointer;
}

.at__erro {
  margin: 0;
  color: var(--risco-tinta);
  font-size: 13.5px;
}

.at__linha {
  color: inherit;
  text-decoration: none;
}

.at__quando {
  display: grid;
  flex: none;
  min-width: 52px;
  gap: 2px;
}

.at__quando small {
  color: var(--tinta-2);
  font-size: 12px;
}

.at__dia + .at__dia {
  border-top: 1px solid var(--linha-suave);
}

.at__dia-titulo {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  padding: 14px 24px 2px;
  color: var(--tinta-2);
  font-size: 13px;
  font-weight: 600;
}

.at__linha--anulada .at__nome,
.at__linha--anulada .ui-linha__meta {
  text-decoration: line-through;
}

.at__mais {
  justify-self: start;
}
</style>
