<script setup lang="ts">
/**
 * Pacientes pela API (E2-01, PJ-ECWI3Z): a lista que Clínica e Hotel dividem, fora da
 * demonstração.
 *
 * A busca é a do balcão: nome do pet, nome de quem responde por ele ou, só com números (3 ou
 * mais), telefone, CPF ou microchip. Quem filtra é a API, sem acento e sem caixa; o termo curto
 * demais nem vai. A espécie e "Ativos | Inativos" ficam ao lado. A lista vem em páginas, pelo
 * cursor, e cada linha abre a ficha do cadastro (`/clinica/ficha/:id`).
 *
 * Cadastrar só aparece para quem escreve (`paciente.escrever` e módulo que não está só para
 * consulta). As colunas de atendimento da demonstração (último e próximo) ficam de fora: elas
 * vêm com a agenda e o prontuário (E3 e E4).
 */
import Button from 'primevue/button'
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import SelectButton from 'primevue/selectbutton'
import Skeleton from 'primevue/skeleton'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRouter } from 'vue-router'

import {
  alertasPorGravidade,
  ICONE_DO_ALERTA,
  iniciais,
  TOM_DA_SEVERIDADE,
  useRotulosDoCadastro,
} from '@/components/cadastro/useRotulosDoCadastro'
import UiPagina from '@/components/ui/UiPagina.vue'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import PetAvatar from '@/features/hotel/components/base/PetAvatar.vue'
import { ApiError } from '@/service/api'
import {
  ESPECIES,
  listarPacientes,
  telefoneNaTela,
  termoDaBusca,
  type Especie,
  type PacienteNaLista,
} from '@/service/parceiro/pacientes-service'
import { listarPendencias } from '@/service/parceiro/pendencias-service'
import { ESPECIE_DO_AVATAR } from '@/utils/parceiro/acesso-na-lista'

const { t } = useI18n()
const router = useRouter()
const { store, parceiroQuery } = useParceiroPortal()
const rotulos = useRotulosDoCadastro()

const PAGINA = 30

const termo = ref('')
const especie = ref<Especie | null>(null)
const situacao = ref<'ativos' | 'inativos'>('ativos')

const itens = ref<PacienteNaLista[]>([])
const proximoCursor = ref<string | null>(null)
const carregando = ref(true)
const carregandoMais = ref(false)
const jaCarregou = ref(false)
const erro = ref('')

/** Quem escreve: a permissão e um dos dois módulos que não esteja só para consulta. */
const podeCadastrar = computed(
  () =>
    store.temPermissao('paciente.escrever') &&
    Boolean(store.modulo('CLINICA')?.podeEscrever || store.modulo('HOTEL')?.podeEscrever),
)

/* "Todas" é o texto de espera, e o x do Select limpa a escolha: o PrimeVue lê `null` como vazio. */
const opcoesDeEspecie = computed(() =>
  ESPECIES.map((valor) => ({ valor, rotulo: t(`cadastro.especie.${valor}`) })),
)

const opcoesDeSituacao = computed(() => [
  { valor: 'ativos', rotulo: t('cadastro.lista.ativos') },
  { valor: 'inativos', rotulo: t('cadastro.lista.inativos') },
])

const filtrando = computed(() => Boolean(termoDaBusca(termo.value) || especie.value))

/** Cada busca nova invalida a anterior: a resposta que chega atrasada não pisa na nova. */
let pedido = 0

async function buscar() {
  const atual = ++pedido
  carregando.value = true
  erro.value = ''

  try {
    const pagina = await listarPacientes(
      {
        q: termo.value,
        especie: especie.value,
        ativo: situacao.value === 'ativos',
        limit: PAGINA,
      },
      parceiroQuery(),
    )

    if (atual !== pedido) return

    itens.value = pagina.itens
    proximoCursor.value = pagina.proximoCursor
    jaCarregou.value = true
  } catch (err) {
    if (atual !== pedido) return

    erro.value = err instanceof Error ? err.message : t('cadastro.lista.erro')
  } finally {
    if (atual === pedido) carregando.value = false
  }
}

async function carregarMais() {
  if (!proximoCursor.value) return

  carregandoMais.value = true

  try {
    const pagina = await listarPacientes(
      {
        q: termo.value,
        especie: especie.value,
        ativo: situacao.value === 'ativos',
        cursor: proximoCursor.value,
        limit: PAGINA,
      },
      parceiroQuery(),
    )

    itens.value = [...itens.value, ...pagina.itens]
    proximoCursor.value = pagina.proximoCursor
  } catch (err) {
    /* Cursor que a API não reconhece mais: a lista recomeça (seção 1.2). */
    if (err instanceof ApiError && err.codigo === 'CURSOR_INVALIDO') {
      void buscar()
    } else {
      erro.value = err instanceof Error ? err.message : t('cadastro.lista.erro')
    }
  } finally {
    carregandoMais.value = false
  }
}

/* A busca espera a pessoa parar de digitar; espécie e situação buscam na hora. */
let espera: ReturnType<typeof setTimeout> | undefined

watch(termo, () => {
  clearTimeout(espera)
  espera = setTimeout(() => void buscar(), 300)
})

watch([especie, situacao], () => void buscar())

onMounted(() => {
  void buscar()
  void lerImportacaoParada()
})

/** Quem importa (DONO e GESTOR): o migrador da base (E2-05). */
const podeImportar = computed(() => store.temPermissao('importacao.executar'))

/*
 * A importação pausada ou parada (o contador `importacoesPausadas` da E1-06, tom de atenção, só
 * para quem importa): a lista avisa, para ela não ficar esquecida no meio.
 */
const importacoesParadas = ref(0)

async function lerImportacaoParada() {
  if (!podeImportar.value) return
  try {
    const pendencias = await listarPendencias(parceiroQuery())
    importacoesParadas.value =
      pendencias.find((item) => item.chave === 'importacoesPausadas')?.valor ?? 0
  } catch {
    importacoesParadas.value = 0
  }
}
onUnmounted(() => clearTimeout(espera))

function meta(paciente: PacienteNaLista) {
  return [
    rotulos.especie(paciente),
    paciente.raca,
    paciente.ativo ? rotulos.idade(paciente.nascimento, paciente.nascimentoEstimado) : '',
  ]
    .filter(Boolean)
    .join(' · ')
}

const fraseDoResumo = computed(() => {
  if (!jaCarregou.value) return ''

  const total = itens.value.length
  const mais = proximoCursor.value ? '+' : ''

  return filtrando.value
    ? t('cadastro.lista.encontrados', { n: `${total}${mais}` }, total)
    : t(
        situacao.value === 'ativos' ? 'cadastro.lista.totalAtivos' : 'cadastro.lista.totalInativos',
        { n: `${total}${mais}` },
        total,
      )
})

function cadastrar() {
  void router.push('/clinica/paciente/novo')
}
</script>

<template>
  <UiPagina
    class="tela-cadastro"
    :carregando="carregando && !jaCarregou"
    :erro="erro && !jaCarregou ? erro : ''"
    @tentar-de-novo="buscar"
  >
    <template v-if="fraseDoResumo" #resumo>
      <span aria-live="polite">{{ fraseDoResumo }}</span>
    </template>

    <template v-if="podeCadastrar || podeImportar" #acoes>
      <Button
        v-if="podeImportar"
        type="button"
        severity="secondary"
        outlined
        icon="ph ph-file-arrow-up"
        :label="t('cadastro.lista.importar')"
        @click="router.push('/clinica/paciente/importar')"
      />
      <Button
        v-if="podeCadastrar"
        type="button"
        icon="ph ph-plus"
        :label="t('cadastro.lista.cadastrar')"
        @click="cadastrar"
      />
    </template>

    <p v-if="importacoesParadas > 0" class="cl__importacao" role="status">
      <i class="ph ph-pause-circle" aria-hidden="true" />
      <span>{{
        t('cadastro.lista.importacaoParada', { n: importacoesParadas }, importacoesParadas)
      }}</span>
      <Button
        type="button"
        size="small"
        severity="secondary"
        outlined
        :label="t('cadastro.lista.verImportacao')"
        @click="router.push('/clinica/paciente/importar')"
      />
    </p>

    <section class="cl ui-folha" :aria-label="t('cadastro.lista.titulo')">
      <div class="cl__procura" role="search">
        <IconField class="cl__busca">
          <InputIcon class="ph ph-magnifying-glass" />
          <InputText
            v-model="termo"
            type="search"
            :aria-label="t('cadastro.lista.buscar')"
            :placeholder="t('cadastro.lista.buscar')"
          />
        </IconField>
        <Select
          v-model="especie"
          class="cl__especie"
          :options="opcoesDeEspecie"
          option-label="rotulo"
          option-value="valor"
          :placeholder="t('cadastro.lista.todasAsEspecies')"
          show-clear
          :aria-label="t('cadastro.lista.especie')"
        />
        <SelectButton
          v-model="situacao"
          :options="opcoesDeSituacao"
          option-label="rotulo"
          option-value="valor"
          :allow-empty="false"
          :aria-label="t('cadastro.lista.situacao')"
        />
      </div>

      <p v-if="erro && jaCarregou" class="cl__erro" role="alert">
        <i class="ph ph-warning-circle" aria-hidden="true" />
        <span>{{ erro }}</span>
        <Button
          type="button"
          size="small"
          severity="secondary"
          outlined
          :label="t('cadastro.tentarDeNovo')"
          @click="buscar"
        />
      </p>

      <ul v-if="carregando && !itens.length" class="ui-lista" aria-busy="true">
        <li v-for="n in 5" :key="n" class="ui-linha cl__esqueleto">
          <Skeleton shape="circle" size="2.75rem" />
          <span class="ui-linha__texto">
            <Skeleton width="10rem" height="0.95rem" />
            <Skeleton width="14rem" height="0.8rem" />
          </span>
        </li>
      </ul>

      <div v-else-if="!itens.length" class="ui-vazio cl__vazio">
        <i class="ph ph-paw-print" aria-hidden="true" />
        <strong>
          {{
            filtrando
              ? t('cadastro.lista.vazioBusca')
              : situacao === 'ativos'
                ? t('cadastro.lista.vazio')
                : t('cadastro.lista.vazioInativos')
          }}
        </strong>
        <span v-if="situacao === 'ativos'">{{ t('cadastro.lista.vazioDica') }}</span>
        <Button
          v-if="podeCadastrar && situacao === 'ativos'"
          type="button"
          icon="ph ph-plus"
          severity="secondary"
          outlined
          :label="t('cadastro.lista.cadastrar')"
          @click="cadastrar"
        />
      </div>

      <ul v-else class="ui-lista cl__lista" :class="{ 'cl__lista--velha': carregando }">
        <li v-for="paciente in itens" :key="paciente.id">
          <RouterLink
            class="ui-linha ui-linha--clicavel cl__linha"
            :to="`/clinica/ficha/${paciente.id}`"
          >
            <PetAvatar
              :nome="paciente.nome"
              :iniciais="iniciais(paciente.nome)"
              :especie="ESPECIE_DO_AVATAR[paciente.especie] ?? null"
              tamanho="md"
            />

            <span class="ui-linha__texto">
              <strong class="ui-linha__titulo">{{ paciente.nome }}</strong>
              <span class="ui-linha__meta">{{ meta(paciente) }}</span>
            </span>

            <span class="cl__responsavel">
              <span class="cl__responsavel-nome">{{ paciente.cliente.nome }}</span>
              <span v-if="paciente.cliente.telefone" class="cl__telefone ui-num">
                <i class="ph ph-phone" aria-hidden="true" />
                <bdi dir="ltr">{{ telefoneNaTela(paciente.cliente.telefone) }}</bdi>
              </span>
            </span>

            <span class="ui-linha__fim cl__fim">
              <span v-if="!paciente.ativo" class="ui-selo">
                <i
                  :class="
                    paciente.inativoMotivo === 'OBITO' ? 'ph ph-flower-lotus' : 'ph ph-archive'
                  "
                  aria-hidden="true"
                />
                {{ rotulos.situacao(paciente) }}
              </span>
              <template v-else>
                <span
                  v-for="alerta in alertasPorGravidade(paciente.alertas).slice(0, 2)"
                  :key="alerta.id"
                  class="ui-selo"
                  :class="TOM_DA_SEVERIDADE[alerta.severidade]"
                  :title="alerta.detalhe"
                >
                  <i :class="ICONE_DO_ALERTA[alerta.tipo]" aria-hidden="true" />
                  {{ rotulos.alerta(alerta.tipo) }}
                </span>
                <span
                  v-if="alertasPorGravidade(paciente.alertas).length > 2"
                  class="cl__mais-alertas"
                >
                  {{
                    t('cadastro.lista.maisAlertas', {
                      n: alertasPorGravidade(paciente.alertas).length - 2,
                    })
                  }}
                </span>
              </template>
              <i class="ph ph-caret-right ui-linha__seta" aria-hidden="true" />
            </span>
          </RouterLink>
        </li>
      </ul>

      <div v-if="proximoCursor && itens.length" class="cl__mais">
        <Button
          type="button"
          severity="secondary"
          outlined
          :label="t('cadastro.lista.carregarMais')"
          :loading="carregandoMais"
          @click="carregarMais"
        />
      </div>
    </section>
  </UiPagina>
</template>

<style scoped>
.cl {
  display: grid;
  gap: 4px;
  padding: 12px;
}

/* Um aviso de uma linha, sem painel: o ícone de atenção diz que algo ficou no meio. */
.cl__importacao {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 10px;
  margin: 0 0 12px;
  color: var(--tinta);
  font-size: 14px;
}

.cl__importacao > i {
  color: var(--atencao-tinta);
  font-size: 18px;
}

.cl__procura {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  padding: 4px 4px 12px;
}

.cl__busca {
  flex: 1 1 18rem;
  min-width: 0;
}

.cl__busca :deep(.p-inputtext) {
  width: 100%;
}

.cl__especie {
  flex: 0 1 12rem;
}

.cl__erro {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin: 0;
  padding: 8px 12px;
  color: var(--tinta);
  font-size: 14px;
}

.cl__erro > i {
  color: var(--risco-tinta);
  font-size: 18px;
}

.cl__lista--velha {
  opacity: 0.6;
  transition: opacity 150ms ease-out;
}

.cl__linha {
  text-decoration: none;
}

.cl__responsavel {
  display: grid;
  gap: 2px;
  flex: 0 1 14rem;
  min-width: 0;
  color: var(--tinta-2);
  font-size: 13.5px;
}

.cl__responsavel-nome {
  overflow: hidden;
  color: var(--tinta);
  font-weight: 550;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cl__telefone {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
}

.cl__fim {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  align-items: center;
  gap: 6px;
}

.cl__mais-alertas {
  color: var(--tinta-2);
  font-size: 12.5px;
}

.cl__mais {
  display: flex;
  justify-content: center;
  padding: 12px;
}

.cl__vazio {
  justify-items: center;
  padding: 40px 16px;
  text-align: center;
}

.cl__vazio > i {
  color: var(--tinta-3);
  font-size: 26px;
}

.cl__esqueleto {
  pointer-events: none;
}

@container (max-width: 640px) {
  .cl__responsavel {
    display: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .cl__lista--velha {
    transition: none;
  }
}
</style>
