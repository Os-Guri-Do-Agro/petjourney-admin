<script setup lang="ts">
/**
 * Hóspedes — quem está na casa, corredor por corredor.
 *
 * A pergunta é **"como está cada um dos meus cinco?"**, e a resposta tem a forma da casa: a lista
 * anda pelos corredores (blocos) na ordem física deles, e cada linha é uma acomodação ocupada —
 * a placa, o rosto (e o do acompanhante), as noites e a saída, o responsável com telefone, o que a
 * rotina pede agora e quanto do dia já foi feito. Ocorrência, boletim e pesagem que travam
 * aparecem em selo, com a marca de gravidade na borda. A linha abre a estadia.
 *
 * ## A forma (redesenho total, 19/10/2026)
 *
 * Uma folha só, com o cabeçalho das colunas no alto e os corredores como divisórias: a mesma
 * coluna se lê de cima a baixo em toda a casa. As faixas de antes ("Precisam de você", "Saem
 * hoje", "Em dia") saíram: a gravidade agora mora na própria linha, e a ordem é a do corredor —
 * que é como o cuidador anda.
 *
 * ## Por que os recortes continuam
 *
 * Os três recortes são uma decisão anterior aprovada: "Todos", "Precisam de mim" e "Saem hoje".
 * O recorte é quem eu quero ver; o corredor é em que ordem. A busca procura no nome do animal, do
 * acompanhante **e** do responsável — quem atende o telefone ouve "aqui é a Luciana, queria saber
 * da Mel" e não sabe de antemão qual dos nomes vai lembrar primeiro.
 */
import Button from 'primevue/button'
import IconField from 'primevue/iconfield'
import InputText from 'primevue/inputtext'
import SelectButton from 'primevue/selectbutton'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRouter } from 'vue-router'

import UiPagina from '@/components/ui/UiPagina.vue'
import HotelDevPanel from '@/features/hotel/components/base/HotelDevPanel.vue'
import HotelTour from '@/features/hotel/components/base/HotelTour.vue'
import type { PassoDoTour } from '@/features/hotel/components/base/tour-types'
import HospedeCard from '@/features/hotel/components/hospedes/HospedeCard.vue'
import type { HospedeNaCasa } from '@/features/hotel/data/repositories'
import type { Bloco, IconeDeAcomodacao } from '@/features/hotel/data/types'
import { useHospedagemStore } from '@/features/hotel/stores/hospedagem'
import { useHotelStore } from '@/features/hotel/stores/hotel'

const { t } = useI18n()
const router = useRouter()
const hotelStore = useHotelStore()
const hospedagem = useHospedagemStore()

/**
 * Três recortes, e não uma barra de filtros.
 *
 * Cinco a vinte hóspedes não pedem busca facetada: pedem "me mostre só os que precisam de mim".
 */
type Recorte = 'todos' | 'precisam' | 'saem'

const recorte = ref<Recorte>('todos')

/** `Record<Recorte, …>`: recorte novo sem ícone passa a ser erro de compilação. */
const ICONE_DO_RECORTE: Record<Recorte, string> = {
  todos: 'ph ph-paw-print',
  precisam: 'ph ph-warning-circle',
  saem: 'ph ph-sign-out',
}

/*
 * O slot `#option` do `SelectButton` entrega a opção como `any`; o acessor recebe esse `any` num
 * parâmetro tipado, o que mantém o mapa exaustivo.
 */
function iconeDoRecorte(valor: Recorte) {
  return ICONE_DO_RECORTE[valor]
}

/**
 * A busca por nome — do animal, do acompanhante e do responsável.
 *
 * `NFD` mais a faixa de acentos combinantes: quem digita apressado escreve "jose" e "tofu", e uma
 * busca que exige o acento certo é uma busca que falha justamente no turno cheio.
 */
const busca = ref('')

function normalizar(texto: string) {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

const termo = computed(() => normalizar(busca.value))

const encontrados = computed(() => {
  if (!termo.value) {
    return hospedagem.hospedes
  }

  return hospedagem.hospedes.filter(
    (hospede) =>
      normalizar(hospede.petNome).includes(termo.value) ||
      normalizar(hospede.tutorNome).includes(termo.value) ||
      /* O segundo animal da estadia também é hóspede: procurar por ele tem de achar a linha. */
      (hospede.acompanhante ? normalizar(hospede.acompanhante.nome).includes(termo.value) : false),
  )
})

/**
 * O responsável, quando a busca encontrou **ele** e ele tem mais de um animal na casa.
 *
 * Sem esta frase, procurar "Luciana" devolve duas linhas sem dizer por quê — e dois animais
 * diferentes lado a lado parecem um erro de busca, não a resposta certa.
 */
const tutorEncontrado = computed(() => {
  if (!termo.value || encontrados.value.length < 2) {
    return null
  }

  const tutores = new Set(encontrados.value.map((hospede) => hospede.tutorNome))

  if (tutores.size !== 1) {
    return null
  }

  const nome = encontrados.value[0]!.tutorNome

  return normalizar(nome).includes(termo.value) ? { nome, total: encontrados.value.length } : null
})

onMounted(async () => {
  await hospedagem.carregarHospedes()
})

watch(
  () => hotelStore.revisao,
  () => void hospedagem.carregarHospedes(),
)

function precisaDeAlguem(hospede: HospedeNaCasa) {
  return (
    hospede.ocorrenciaTravada ||
    hospede.boletimRetido ||
    hospede.atrasadas > 0 ||
    (hospede.saiHoje && hospede.hospedagem.pesoSaidaKg === null)
  )
}

const visiveis = computed(() => {
  if (recorte.value === 'precisam') {
    return encontrados.value.filter(precisaDeAlguem)
  }

  if (recorte.value === 'saem') {
    return encontrados.value.filter((hospede) => hospede.saiHoje)
  }

  return encontrados.value
})

/*
 * As contagens dos recortes seguem a busca, e não o total da casa: recorte dizendo "Todos 5" com
 * uma linha na tela é recorte mentindo.
 */
const quantosPrecisam = computed(() => encontrados.value.filter(precisaDeAlguem).length)
const quantosSaem = computed(() => encontrados.value.filter((item) => item.saiHoje).length)

const opcoes = computed(() => [
  {
    valor: 'todos' as const,
    rotulo: t('hotel.hospedes.recorte.todos'),
    total: encontrados.value.length,
  },
  {
    valor: 'precisam' as const,
    rotulo: t('hotel.hospedes.recorte.precisam'),
    total: quantosPrecisam.value,
  },
  {
    valor: 'saem' as const,
    rotulo: t('hotel.hospedes.recorte.saem'),
    total: quantosSaem.value,
  },
])

// ------------------------------------------------------------------------------ os corredores

/** O desenho de cada corredor, o mesmo que a casa escolheu no cadastro. */
const ICONE_DO_BLOCO: Record<IconeDeAcomodacao, string> = {
  casa: 'ph ph-house-line',
  cama: 'ph ph-bed',
  gato: 'ph ph-cat',
  cao: 'ph ph-dog',
  grupo: 'ph ph-users-three',
  escudo: 'ph ph-shield-check',
  arvore: 'ph ph-tree',
  passaro: 'ph ph-bird',
  coelho: 'ph ph-rabbit',
}

type Corredor = { id: string; bloco: Bloco | null; hospedes: HospedeNaCasa[] }

/**
 * Os hóspedes visíveis, por corredor, na ordem física da casa (`Bloco.ordem`); dentro do
 * corredor, pela placa da porta ("Baia A1" antes de "Baia A3").
 */
const corredores = computed<Corredor[]>(() => {
  const porBloco = new Map<string, HospedeNaCasa[]>()

  for (const hospede of visiveis.value) {
    porBloco.set(hospede.blocoId, [...(porBloco.get(hospede.blocoId) ?? []), hospede])
  }

  return [...porBloco.entries()]
    .map(([id, hospedes]) => ({
      id,
      bloco: hotelStore.blocoPorId.get(id) ?? null,
      hospedes: hospedes.sort((um, outro) =>
        um.acomodacaoNome.localeCompare(outro.acomodacaoNome, undefined, { numeric: true }),
      ),
    }))
    .sort(
      (um, outro) =>
        (um.bloco?.ordem ?? Number.MAX_SAFE_INTEGER) -
        (outro.bloco?.ordem ?? Number.MAX_SAFE_INTEGER),
    )
})

/**
 * A frase da casa **inteira**: quantos precisam de alguém. Não segue a busca — quem busca um nome
 * não quer que o estado da casa vire "1 de 1".
 */
const fraseDaCasa = computed(() => {
  const total = hospedagem.hospedes.length
  const precisam = hospedagem.hospedes.filter(precisaDeAlguem).length

  if (total === 0 || precisam === 0) {
    return t('hotel.hospedes.resumoEmDia')
  }

  return t('hotel.hospedes.resumo', { precisam, total }, precisam)
})

const vazio = computed(
  () => !hospedagem.carregando && !hospedagem.erro && hospedagem.hospedes.length === 0,
)

function blocoNome(hospede: HospedeNaCasa) {
  return hotelStore.blocoPorId.get(hospede.blocoId)?.nome ?? ''
}

function abrir(hospedagemId: string) {
  void router.push(`/hotel/hospedagem/${hospedagemId}`)
}

// ------------------------------------------------------------------------------ o tutorial

/**
 * O tutorial desta tela, na ordem em que se lê a página. Cada passo carrega um seletor do próprio
 * template; o `HotelTour` descarta, na abertura, o passo cujo alvo não está na tela.
 */
const tourAberto = ref(false)

const passosDoTour = computed<PassoDoTour[]>(() => [
  {
    titulo: t('hotel.hoje.hospedes.tour.pergunta.titulo'),
    texto: t('hotel.hoje.hospedes.tour.pergunta.texto'),
  },
  {
    alvo: '.barra',
    titulo: t('hotel.hoje.hospedes.tour.recortes.titulo'),
    texto: t('hotel.hoje.hospedes.tour.recortes.texto'),
  },
  {
    alvo: '.corredor__titulo',
    titulo: t('hotel.hoje.hospedes.tour.corredores.titulo'),
    texto: t('hotel.hoje.hospedes.tour.corredores.texto'),
  },
  {
    alvo: '.casa .cartao',
    titulo: t('hotel.hoje.hospedes.tour.linha.titulo'),
    texto: t('hotel.hoje.hospedes.tour.linha.texto'),
  },
  {
    alvo: '.casa .foco',
    titulo: t('hotel.hoje.hospedes.tour.foco.titulo'),
    texto: t('hotel.hoje.hospedes.tour.foco.texto'),
  },
  {
    alvo: '.casa .dia',
    titulo: t('hotel.hoje.hospedes.tour.dia.titulo'),
    texto: t('hotel.hoje.hospedes.tour.dia.texto'),
  },
])
</script>

<template>
  <UiPagina
    :carregando="hospedagem.carregando && hospedagem.hospedes.length === 0"
    :erro="hospedagem.erro ? t(hospedagem.erro) : ''"
    :vazio="vazio"
    :vazio-titulo="t('hotel.hospedes.vazioTitulo')"
    :vazio-descricao="t('hotel.hospedes.vazioDescricao')"
    vazio-icone="ph ph-paw-print"
    tour
    @tour="tourAberto = true"
    @tentar-de-novo="hospedagem.carregarHospedes()"
  >
    <template #resumo>
      <span aria-live="polite">{{ fraseDaCasa }}</span>
    </template>

    <template #acoes>
      <Button
        :as="RouterLink"
        to="/hotel/rotina"
        icon="ph ph-list-checks"
        :label="t('hotel.hospedes.irParaRotina')"
      />
    </template>

    <div class="hospedes">
      <div class="barra">
        <SelectButton
          v-model="recorte"
          class="recortes"
          :options="opcoes"
          option-label="rotulo"
          option-value="valor"
          :allow-empty="false"
          :aria-label="t('hotel.hospedes.recorteRotulo')"
        >
          <template #option="{ option }">
            <i :class="iconeDoRecorte(option.valor)" class="recorte__icone" aria-hidden="true" />
            <span class="recorte__rotulo">{{ option.rotulo }}</span>
            <span class="ui-contagem recorte__conta">{{ option.total }}</span>
          </template>
        </SelectButton>

        <!--
          Quando a busca casou com o responsável e ele tem mais de um na casa, a tela diz por que
          está mostrando vários — dois animais diferentes lado a lado parecem erro de busca.
        -->
        <p v-if="tutorEncontrado" class="barra__tutor ui-selo ui-selo--lugar" aria-live="polite">
          <i class="ph ph-user" aria-hidden="true" />
          {{
            t(
              'hotel.hospedes.busca.doTutor',
              { total: tutorEncontrado.total, tutor: tutorEncontrado.nome },
              tutorEncontrado.total,
            )
          }}
        </p>

        <IconField class="busca">
          <i class="ph ph-magnifying-glass busca__lupa" aria-hidden="true" />
          <InputText
            v-model="busca"
            class="busca__campo"
            type="search"
            :placeholder="t('hotel.hospedes.busca.dica')"
            :aria-label="t('hotel.hospedes.busca.rotulo')"
          />
        </IconField>
      </div>

      <div v-if="visiveis.length === 0" class="nada ui-folha">
        <span class="nada__icone" aria-hidden="true">
          <i :class="termo ? 'ph ph-magnifying-glass' : 'ph ph-moon-stars'" />
        </span>

        <p class="nada__texto">
          <template v-if="termo">
            {{ t('hotel.hospedes.busca.semResultado', { termo: busca.trim() }) }}
          </template>
          <template v-else-if="recorte === 'precisam'">
            {{ t('hotel.hospedes.ninguemPrecisa') }}
          </template>
          <template v-else>{{ t('hotel.hospedes.ninguemSai') }}</template>
        </p>

        <Button
          v-if="termo"
          :label="t('hotel.hospedes.busca.limpar')"
          icon="ph ph-x"
          severity="secondary"
          outlined
          size="small"
          @click="busca = ''"
        />
      </div>

      <div v-else class="casa ui-folha">
        <!-- O cabeçalho das colunas: o mesmo desenho de grade das linhas, para baterem. -->
        <div class="casa__cabeca" aria-hidden="true">
          <span>{{ t('hotel.hoje.hospedes.coluna.acomodacao') }}</span>
          <span>{{ t('hotel.hoje.hospedes.coluna.hospede') }}</span>
          <span>{{ t('hotel.hoje.hospedes.coluna.responsavel') }}</span>
          <span>{{ t('hotel.hoje.hospedes.coluna.agora') }}</span>
          <span>{{ t('hotel.hospedes.dia.rotulo') }}</span>
        </div>

        <section
          v-for="corredor in corredores"
          :key="corredor.id"
          class="corredor"
          :aria-labelledby="`corredor-${corredor.id}`"
        >
          <h2 :id="`corredor-${corredor.id}`" class="corredor__titulo">
            <i
              :class="corredor.bloco ? ICONE_DO_BLOCO[corredor.bloco.icone] : 'ph ph-house-line'"
              aria-hidden="true"
            />
            {{ corredor.bloco?.nome ?? t('hotel.hoje.hospedes.semCorredor') }}
            <span class="ui-contagem">{{ corredor.hospedes.length }}</span>
          </h2>

          <ul class="ui-lista corredor__lista">
            <HospedeCard
              v-for="hospede in corredor.hospedes"
              :key="hospede.hospedagem.id"
              :hospede="hospede"
              :agora="hospedagem.agora"
              :bloco-nome="blocoNome(hospede)"
              @abrir="abrir"
            />
          </ul>
        </section>
      </div>
    </div>

    <template #sempre>
      <HotelDevPanel />

      <HotelTour v-model:aberto="tourAberto" :passos="passosDoTour" />
    </template>
  </UiPagina>
</template>

<style scoped>
/* `minmax(0, 1fr)`: sem ele, a largura mínima dos recortes alargava a coluna e a lista inteira
   vazava da tela no celular. */
.hospedes {
  display: grid;
  gap: 16px;
  grid-template-columns: minmax(0, 1fr);
}

/* ------------------------------------------------------------------ a barra */

/* Os controles no fundo, sem caixa: o recorte à esquerda, a busca à direita. */
.barra {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px 16px;
}

.recortes :deep(.p-togglebutton-content) {
  gap: 7px;
}

.recorte__icone {
  font-size: 16px;
}

.recorte__rotulo {
  white-space: nowrap;
}

.recorte__conta {
  min-width: 22px;
  height: 20px;
  padding-inline: 6px;
  font-size: 11.5px;
}

.recortes :deep(.p-togglebutton-checked) .recorte__conta {
  background: var(--pj-lugar-fundo);
  color: var(--pj-lugar-tinta);
}

.barra__tutor {
  margin: 0;
}

/*
 * O `position` é declarado aqui e não herdado do `IconField`: quando o estilo injetado do PrimeVue
 * falta, a lupa — que é absoluta — escapa para o canto da página.
 */
.busca {
  position: relative;
  width: min(100%, 340px);
  margin-inline-start: auto;
}

.busca__lupa {
  position: absolute;
  top: 50%;
  inset-inline-start: 12px;
  color: var(--tinta-3);
  font-size: 17px;
  pointer-events: none;
  transform: translateY(-50%);
}

.busca__campo {
  width: 100%;
  padding-inline-start: 38px;
}

/* O "x" próprio do WebKit fica fora dos tokens da casa; o limpar mora no estado vazio. */
.busca__campo::-webkit-search-cancel-button {
  appearance: none;
}

/* ------------------------------------------------------------------ o vazio */

.nada {
  display: grid;
  justify-items: center;
  gap: 10px;
  padding: 36px 24px;
  color: var(--tinta-2);
  text-align: center;
}

.nada__icone {
  display: grid;
  width: 48px;
  height: 48px;
  place-items: center;
  border-radius: 14px;
  background: var(--superficie-2);
  color: var(--tinta-2);
  font-size: 22px;
}

.nada__texto {
  margin: 0;
}

/* ------------------------------------------------------------------ a casa */

/*
 * Uma folha só, e as colunas definidas aqui: o cabeçalho e as linhas de todos os corredores
 * usam a mesma grade, e a lista inteira se lê por coluna.
 */
.casa {
  --hospede-colunas: 84px minmax(0, 1.7fr) minmax(0, 1fr) minmax(0, 1.15fr) 112px 16px;

  overflow: hidden;
  container: casa / inline-size;
}

.casa__cabeca {
  display: grid;
  align-items: end;
  gap: 16px;
  min-height: 40px;
  padding: 10px 18px 8px 20px;
  border-bottom: 1px solid var(--linha);
  color: var(--tinta-2);
  font-size: 12.5px;
  font-weight: 550;
  grid-template-columns: var(--hospede-colunas);
}

.casa__cabeca span:nth-child(2) {
  padding-inline-start: 50px;
}

.casa__cabeca span:nth-child(4) {
  padding-inline-start: 44px;
}

/* O corredor é uma divisória com nome, não um cartão: a folha continua uma só. */
.corredor + .corredor {
  border-top: 1px solid var(--linha);
}

.corredor__titulo {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  padding: 10px 20px;
  border-bottom: 1px solid var(--linha);
  background: var(--superficie-2);
  color: var(--tinta);
  font-size: 14px;
  font-weight: 600;
}

.corredor__titulo i {
  color: var(--pj-lugar-tinta);
  font-size: 17px;
}

/* A primeira e a última linha não arredondam: quem arredonda é a folha. */
.corredor__lista :deep(.cartao) {
  border-radius: 0;
}

@container casa (max-width: 820px) {
  .casa__cabeca {
    display: none;
  }
}

@media (max-width: 640px) {
  .busca {
    width: 100%;
    margin-inline-start: 0;
  }

  .recortes {
    width: 100%;
  }

  .recortes :deep(.p-togglebutton) {
    min-width: 0;
    flex: 1;
  }

  .recortes :deep(.p-togglebutton-content) {
    height: 100%;
    justify-content: center;
    padding-inline: 6px;
  }

  /* No estreito o rótulo quebra em duas linhas em vez de empurrar o recorte para fora da tela. */
  .recorte__rotulo {
    line-height: 1.2;
    text-align: center;
    white-space: normal;
  }

  .recorte__icone {
    display: none;
  }
}
</style>
