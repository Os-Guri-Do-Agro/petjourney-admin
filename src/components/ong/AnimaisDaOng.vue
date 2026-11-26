<script setup lang="ts">
/**
 * Os animais da ONG pela API (PJ-TJ07TW, guia 2.5 itens 3 e o menu "Entregas").
 *
 * - `animais`: a lista com o filtro (Em cuidado, Entregues, Encerrados), a busca por nome (2 a 60
 *   caracteres, quem filtra é a API) e o contador "N de M sob cuidado" do perfil. "Cadastrar animal"
 *   abre a gaveta aqui mesmo, para quem escreve.
 * - `entregas`: só os entregues, com o que o perfil conta (convites aguardando, entregues no mês).
 *   A API não tem a lista de convites da ONG inteira: cada convite mora na ficha do animal.
 *
 * Cada linha abre a ficha (`/ong/animal/:id`). A lista vem em páginas, pelo cursor.
 */
import Button from 'primevue/button'
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import InputText from 'primevue/inputtext'
import SelectButton from 'primevue/selectbutton'
import Skeleton from 'primevue/skeleton'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRouter } from 'vue-router'

import { iniciais, useRotulosDoCadastro } from '@/components/cadastro/useRotulosDoCadastro'
import AnimalGaveta from '@/components/ong/AnimalGaveta.vue'
import { diaDoInstante, lerErroDaOng } from '@/components/ong/regras-da-ong'
import { useAcessoDaOng } from '@/components/ong/useAcessoDaOng'
import UiPagina from '@/components/ui/UiPagina.vue'
import type { PassoDoGuia } from '@/components/ui/UiPassos.vue'
import UiVazioIlustrado from '@/components/ui/UiVazioIlustrado.vue'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import PetAvatar from '@/features/hotel/components/base/PetAvatar.vue'
import { ApiError } from '@/service/api'
import {
  listarAnimaisDaOng,
  obterPerfilDaOng,
  STATUS_DO_ANIMAL,
  termoDaBuscaDaOng,
  type AnimalDaOng,
  type AnimalDaOngNaLista,
  type PerfilDaOng,
  type StatusDoAnimal,
} from '@/service/parceiro/ong-service'
import { ESPECIE_DO_AVATAR } from '@/utils/parceiro/acesso-na-lista'

const props = withDefaults(defineProps<{ modo?: 'animais' | 'entregas' }>(), { modo: 'animais' })

const { t } = useI18n()
const router = useRouter()
const { parceiroQuery } = useParceiroPortal()
const rotulos = useRotulosDoCadastro()
const { podeEscrever } = useAcessoDaOng()

const PAGINA = 30

const termo = ref('')
const status = ref<StatusDoAnimal>(props.modo === 'entregas' ? 'ENTREGUE' : 'EM_CUIDADO')

const itens = ref<AnimalDaOngNaLista[]>([])
const proximoCursor = ref<string | null>(null)
const carregando = ref(true)
const carregandoMais = ref(false)
const jaCarregou = ref(false)
const erro = ref('')
const perfil = ref<PerfilDaOng | null>(null)

const opcoesDeStatus = computed(() =>
  STATUS_DO_ANIMAL.map((valor) => ({ valor, rotulo: t(`ong.animais.filtro.${valor}`) })),
)

const filtrando = computed(() => Boolean(termoDaBuscaDaOng(termo.value)))

/** Cada busca nova invalida a anterior: a resposta que chega atrasada não pisa na nova. */
let pedido = 0

async function buscar() {
  const atual = ++pedido
  carregando.value = true
  erro.value = ''

  try {
    const pagina = await listarAnimaisDaOng(
      { status: status.value, busca: termo.value, limit: PAGINA },
      parceiroQuery(),
    )

    if (atual !== pedido) return

    itens.value = pagina.itens
    proximoCursor.value = pagina.proximoCursor
    jaCarregou.value = true
  } catch (err) {
    if (atual !== pedido) return

    erro.value = lerErroDaOng(err, t, t('ong.animais.erro')).mensagem
  } finally {
    if (atual === pedido) carregando.value = false
  }
}

async function carregarMais() {
  if (!proximoCursor.value) return

  carregandoMais.value = true

  try {
    const pagina = await listarAnimaisDaOng(
      { status: status.value, busca: termo.value, cursor: proximoCursor.value, limit: PAGINA },
      parceiroQuery(),
    )

    itens.value = [...itens.value, ...pagina.itens]
    proximoCursor.value = pagina.proximoCursor
  } catch (err) {
    /* Cursor que a API não reconhece mais: a lista recomeça. */
    if (err instanceof ApiError && err.codigo === 'CURSOR_INVALIDO') {
      void buscar()
    } else {
      erro.value = lerErroDaOng(err, t, t('ong.animais.erro')).mensagem
    }
  } finally {
    carregandoMais.value = false
  }
}

/** O contador do alto: um erro aqui não derruba a lista, só some o número. */
async function lerPerfil() {
  try {
    perfil.value = await obterPerfilDaOng(parceiroQuery())
  } catch {
    perfil.value = null
  }
}

/* A busca espera a pessoa parar de digitar; o filtro busca na hora. */
let espera: ReturnType<typeof setTimeout> | undefined

watch(termo, (agora, antes) => {
  /* Um caractere não vai para a API: só busca quando o termo efetivo muda. */
  if (termoDaBuscaDaOng(agora) === termoDaBuscaDaOng(antes)) return
  clearTimeout(espera)
  espera = setTimeout(() => void buscar(), 300)
})

watch(status, () => void buscar())

onMounted(() => {
  void buscar()
  void lerPerfil()
})

onUnmounted(() => clearTimeout(espera))

function meta(animal: AnimalDaOngNaLista) {
  return [
    rotulos.especie(animal),
    animal.sexo ? t(`cadastro.sexo.${animal.sexo}`) : '',
    animal.status !== 'ENTREGUE' ? rotulos.idade(animal.nascimento) : '',
  ]
    .filter(Boolean)
    .join(' · ')
}

function quando(animal: AnimalDaOngNaLista) {
  if (animal.status === 'ENTREGUE' && animal.entregueEm) {
    return t('ong.animais.entregueEm', { data: diaDoInstante(animal.entregueEm, rotulos.intl()) })
  }

  return t('ong.animais.chegouEm', { data: rotulos.dia(animal.entradaEm) })
}

const fraseDoResumo = computed(() => {
  const atual = perfil.value
  if (!atual) return ''

  if (props.modo === 'entregas') {
    return [
      t('ong.entregas.pendentes', { n: atual.entregasPendentes }, atual.entregasPendentes),
      t('ong.entregas.noMes', { n: atual.entreguesNoMes }, atual.entreguesNoMes),
    ].join(' · ')
  }

  return t('ong.animais.contador', {
    emCuidado: rotulos.numero(atual.emCuidado),
    limite: rotulos.numero(atual.limiteDeAnimais),
  })
})

/* --------------------------------------------------------------------------- cadastrar */

const novoAberto = ref(false)

function cadastrar() {
  novoAberto.value = true
}

function aoCadastrar(animal: AnimalDaOng) {
  void router.push(`/ong/animal/${encodeURIComponent(animal.id)}`)
}

/*
 * O vazio que ensina: sem animal sob cuidado, o caminho em três etapas, com "Cadastrar animal" na
 * primeira para quem escreve. A busca sem resultado fica só com o recado.
 */
const passosDoGuia = computed<PassoDoGuia[]>(() => {
  const passo = (id: string, icone: string, acao?: PassoDoGuia['acao']): PassoDoGuia => ({
    id,
    icone,
    titulo: t(`ong.animais.guia.${id}.titulo`),
    texto: t(`ong.animais.guia.${id}.texto`),
    acao,
  })

  return [
    passo(
      'cadastrar',
      'ph ph-paw-print',
      podeEscrever.value
        ? { rotulo: t('ong.animais.cadastrar'), icone: 'ph ph-plus', aoClicar: cadastrar }
        : undefined,
    ),
    passo('saude', 'ph ph-syringe'),
    passo('convite', 'ph ph-hand-heart'),
  ]
})

const vazioDoFiltro = computed(() => ({
  icone:
    status.value === 'ENTREGUE'
      ? 'ph ph-hand-heart'
      : status.value === 'ENCERRADO'
        ? 'ph ph-archive'
        : 'ph ph-paw-print',
  titulo: t(`ong.animais.vazio.${status.value}.titulo`),
  texto: t(`ong.animais.vazio.${status.value}.texto`),
}))
</script>

<template>
  <UiPagina
    class="tela-ong"
    :carregando="carregando && !jaCarregou"
    :erro="erro && !jaCarregou ? erro : ''"
    @tentar-de-novo="buscar"
  >
    <template v-if="fraseDoResumo" #resumo>
      <span class="ui-num" aria-live="polite">{{ fraseDoResumo }}</span>
    </template>

    <template v-if="podeEscrever && modo === 'animais'" #acoes>
      <Button
        type="button"
        icon="ph ph-plus"
        :label="t('ong.animais.cadastrar')"
        @click="cadastrar"
      />
    </template>

    <p v-if="modo === 'entregas'" class="oa__dica">
      <i class="ph ph-info" aria-hidden="true" />
      <span>{{ t('ong.entregas.dica') }}</span>
    </p>

    <section class="oa ui-folha" :aria-label="t(`espacos.ong.${modo}`)">
      <div class="oa__procura" role="search">
        <IconField class="oa__busca">
          <InputIcon class="ph ph-magnifying-glass" />
          <InputText
            v-model="termo"
            type="search"
            maxlength="60"
            :aria-label="t('ong.animais.buscar')"
            :placeholder="t('ong.animais.buscar')"
          />
        </IconField>
        <SelectButton
          v-if="modo === 'animais'"
          v-model="status"
          :options="opcoesDeStatus"
          option-label="rotulo"
          option-value="valor"
          :allow-empty="false"
          :aria-label="t('ong.animais.filtro.rotulo')"
        />
      </div>

      <p v-if="erro && jaCarregou" class="oa__erro" role="alert">
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
        <li v-for="n in 4" :key="n" class="ui-linha oa__esqueleto">
          <Skeleton shape="circle" size="2.75rem" />
          <span class="ui-linha__texto">
            <Skeleton width="10rem" height="0.95rem" />
            <Skeleton width="14rem" height="0.8rem" />
          </span>
        </li>
      </ul>

      <UiVazioIlustrado
        v-else-if="!itens.length && filtrando"
        aninhado
        icone="ph ph-magnifying-glass"
        :titulo="t('ong.animais.vazio.busca')"
      />

      <!-- Sem animal sob cuidado: o caminho em etapas, com o botão de cada uma. -->
      <UiVazioIlustrado
        v-else-if="!itens.length && modo === 'animais' && status === 'EM_CUIDADO'"
        aninhado
        icone="ph ph-paw-print"
        :titulo="t('ong.animais.vazio.EM_CUIDADO.titulo')"
        :texto="t('ong.animais.vazio.EM_CUIDADO.texto')"
        :guia-titulo="t('ong.animais.guia.titulo')"
        :passos="passosDoGuia"
      />

      <UiVazioIlustrado
        v-else-if="!itens.length && modo === 'entregas'"
        aninhado
        icone="ph ph-hand-heart"
        :titulo="t('ong.entregas.vazio.titulo')"
        :texto="t('ong.entregas.vazio.texto')"
      >
        <template #acao>
          <Button
            :as="RouterLink"
            to="/ong/animais"
            icon="ph ph-paw-print"
            :label="t('ong.entregas.vazio.acao')"
          />
        </template>
      </UiVazioIlustrado>

      <UiVazioIlustrado
        v-else-if="!itens.length"
        aninhado
        :icone="vazioDoFiltro.icone"
        :titulo="vazioDoFiltro.titulo"
        :texto="vazioDoFiltro.texto"
      />

      <ul v-else class="ui-lista oa__lista" :class="{ 'oa__lista--velha': carregando }">
        <li v-for="animal in itens" :key="animal.id">
          <RouterLink
            class="ui-linha ui-linha--clicavel oa__linha"
            :to="`/ong/animal/${encodeURIComponent(animal.id)}`"
          >
            <PetAvatar
              :nome="animal.nome"
              :iniciais="iniciais(animal.nome)"
              :especie="ESPECIE_DO_AVATAR[animal.especie] ?? null"
              :foto-url="animal.fotoUrl"
              tamanho="md"
            />

            <span class="ui-linha__texto">
              <strong class="ui-linha__titulo">{{ animal.nome }}</strong>
              <span class="ui-linha__meta">{{ meta(animal) }}</span>
            </span>

            <span class="oa__quando">{{ quando(animal) }}</span>

            <span class="ui-linha__fim oa__fim">
              <span v-if="animal.status === 'ENCERRADO'" class="ui-selo ui-selo--contorno">
                <i class="ph ph-archive" aria-hidden="true" />
                {{ t('ong.status.ENCERRADO') }}
              </span>
              <span
                v-else-if="animal.status === 'ENTREGUE' && modo === 'animais'"
                class="ui-selo ui-selo--ok"
              >
                <i class="ph ph-hand-heart" aria-hidden="true" />
                {{ t('ong.status.ENTREGUE') }}
              </span>
              <span v-if="animal.origemDaEntrada === 'RETORNO_DE_ADOCAO'" class="ui-selo">
                <i class="ph ph-arrow-u-down-left" aria-hidden="true" />
                {{ t('ong.origem.RETORNO_DE_ADOCAO') }}
              </span>
              <i class="ph ph-caret-right ui-linha__seta" aria-hidden="true" />
            </span>
          </RouterLink>
        </li>
      </ul>

      <div v-if="proximoCursor && itens.length" class="oa__mais">
        <Button
          type="button"
          severity="secondary"
          outlined
          :label="t('ong.animais.carregarMais')"
          :loading="carregandoMais"
          @click="carregarMais"
        />
      </div>
    </section>

    <template #sempre>
      <AnimalGaveta v-if="podeEscrever" v-model:visible="novoAberto" @salvo="aoCadastrar" />
    </template>
  </UiPagina>
</template>

<style scoped>
.oa {
  display: grid;
  gap: 4px;
  padding: 12px;
  container-type: inline-size;
}

.oa__dica {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 12px;
  color: var(--tinta-2);
  font-size: 14px;
}

.oa__dica > i {
  font-size: 17px;
}

.oa__procura {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  padding: 4px 4px 12px;
}

.oa__busca {
  flex: 1 1 18rem;
  min-width: 0;
}

.oa__busca :deep(.p-inputtext) {
  width: 100%;
}

.oa__erro {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin: 0;
  padding: 8px 12px;
  color: var(--tinta);
  font-size: 14px;
}

.oa__erro > i {
  color: var(--risco-tinta);
  font-size: 18px;
}

.oa__lista--velha {
  opacity: 0.6;
  transition: opacity 150ms ease-out;
}

.oa__linha {
  text-decoration: none;
}

/*
 * A data e os selos em colunas de largura fixa: começam no mesmo ponto em todas as linhas. O nome
 * fica com o resto; com a lista estreita (a gaveta aberta ao lado), a data sai e os selos encolhem.
 */
.oa__linha .ui-linha__texto {
  flex: 1 1 12rem;
}

.oa__quando {
  flex: 0 1 13rem;
  min-width: 0;
  color: var(--tinta-2);
  font-size: 13.5px;
}

.oa__fim {
  display: flex;
  flex: 0 0 12rem;
  flex-wrap: wrap;
  justify-content: flex-end;
  align-items: center;
  gap: 6px;
}

.oa__mais {
  display: flex;
  justify-content: center;
  padding: 12px;
}

.oa__esqueleto {
  pointer-events: none;
}

@container (max-width: 760px) {
  .oa__quando {
    display: none;
  }

  .oa__fim {
    flex-basis: auto;
  }
}

@media (prefers-reduced-motion: reduce) {
  .oa__lista--velha {
    transition: none;
  }
}
</style>
