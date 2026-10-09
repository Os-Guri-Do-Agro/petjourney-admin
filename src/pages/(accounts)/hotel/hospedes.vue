<script setup lang="ts">
/**
 * Hóspedes na casa.
 *
 * Era uma tabela, e tabela era a forma errada. Esta tela não é um inventário para varrer por
 * coluna: é a pergunta **"como está cada um dos meus cinco?"** — e a resposta é um rosto, um
 * estado e o que falta fazer. Quem quer a lista fria — nome, acomodação, noites — tem o mapa de
 * ocupação, que é a tela feita para isso.
 *
 * ## Por que bandas, e não uma grade uniforme
 *
 * A grade anterior dava o mesmo cartão para quem tinha quatro tarefas atrasadas e para quem estava
 * dormindo, e deixava metade da tela em branco embaixo. Uma tela onde tudo tem o mesmo peso obriga
 * a ler tudo para descobrir o que importa — e, com cinco hóspedes numa tela larga, a grade ainda
 * saía 4 + 1, com uma fileira órfã.
 *
 * Agora a página tem três respirações, e cada hóspede cai em **exatamente uma**: quem cobra ação,
 * quem sai hoje, e quem está em dia. Quem sai hoje **e** cobra ação fica na primeira — e não perde
 * a informação da saída, porque ela está no pé de todo cartão.
 *
 * As réguas que nomeiam as faixas só aparecem quando há **mais de uma** faixa com gente. Régua
 * serve para separar uma coisa de outra; com todo mundo cobrando ação, a régua "PRECISAM DE VOCÊ"
 * ficava dois centímetros abaixo da aba "Precisam de mim" dizendo o mesmo de outro jeito, e não
 * separava nada.
 *
 * A banda fria é recolhível, e **nasce aberta quando a primeira tem dois hóspedes ou menos**: é
 * exatamente o caso em que a página ficaria curta, e é o conteúdo de verdade que preenche o espaço
 * em vez de um enfeite inventado para ocupar viewport.
 *
 * ## Por que os recortes continuam
 *
 * Os três recortes são uma decisão anterior aprovada, e bandas e recortes respondem a perguntas
 * diferentes: o recorte é quem eu quero ver, a banda é em que ordem. As bandas aparecem em
 * "Todos"; nos outros dois recortes a lista já está filtrada e uma banda só repetiria o título do
 * filtro.
 */
import {
  PhDoorOpen,
  PhListChecks,
  PhMagnifyingGlass,
  PhMoon,
  PhPawPrint,
  PhWarningCircle,
} from '@phosphor-icons/vue'
import Button from 'primevue/button'
import IconField from 'primevue/iconfield'
import InputText from 'primevue/inputtext'
import SelectButton from 'primevue/selectbutton'
import { computed, onMounted, ref, watch, type Component } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRouter } from 'vue-router'

import PartnerPageFrame from '@/components/parceiro/PartnerPageFrame.vue'
import HotelDevPanel from '@/features/hotel/components/base/HotelDevPanel.vue'
import HotelTour from '@/features/hotel/components/base/HotelTour.vue'
import type { PassoDoTour } from '@/features/hotel/components/base/tour-types'
import HospedeCard from '@/features/hotel/components/hospedes/HospedeCard.vue'
import HospedeFileira from '@/features/hotel/components/hospedes/HospedeFileira.vue'
import type { HospedeNaCasa } from '@/features/hotel/data/repositories'
import { useHospedagemStore } from '@/features/hotel/stores/hospedagem'
import { useHotelStore } from '@/features/hotel/stores/hotel'

const { t } = useI18n()
const router = useRouter()
const hotelStore = useHotelStore()
const hospedagem = useHospedagemStore()

/**
 * Três recortes, e não uma barra de filtros.
 *
 * Cinco a vinte hóspedes não pedem busca nem facetas: pedem "me mostre só os que precisam de
 * mim". Uma barra de filtros aqui seria a mesma peça de interface das outras telas — de novo — e
 * resolveria um problema que esta lista não tem.
 */
type Recorte = 'todos' | 'precisam' | 'saem'

const recorte = ref<Recorte>('todos')

/**
 * O desenho de cada recorte.
 *
 * Mapa `Record<Recorte, …>` de propósito: recorte novo sem ícone passa a ser erro de compilação.
 * E os três repetem o glifo da faixa correspondente lá embaixo — a aba e a régua que ela filtra
 * precisam ser a mesma coisa no olho, senão o filtro parece levar a outro lugar.
 */
const ICONE_DO_RECORTE: Record<Recorte, Component> = {
  todos: PhPawPrint,
  precisam: PhWarningCircle,
  saem: PhDoorOpen,
}

/*
 * O slot `#option` do `SelectButton` entrega a opção como `any` — o componente não propaga o tipo
 * da lista. O acessor recebe esse `any` num parâmetro tipado, o que mantém o mapa exaustivo: quem
 * acrescentar um recorte continua obrigado a dar ícone a ele.
 */
function iconeDoRecorte(valor: Recorte) {
  return ICONE_DO_RECORTE[valor]
}

/**
 * A busca por nome.
 *
 * Procura no nome do animal **e** no do responsável, e é de propósito que os dois caiam no mesmo
 * campo: quem atende o telefone ouve "aqui é a Luciana, queria saber da Mel" e não sabe de
 * antemão qual dos dois nomes vai lembrar primeiro. Buscando pelo responsável, todos os animais
 * dele aparecem juntos — que é a pergunta que ele está fazendo.
 *
 * `NFD` mais a faixa de acentos combinantes: quem digita apressado escreve "jose" e "tofu", e uma
 * busca que exige o acento certo é uma busca que falha justamente no turno cheio.
 */
const busca = ref('')

function normalizar(texto: string) {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
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
      /* O segundo animal da estadia também é hóspede: procurar por ele tem de achar o cartão. */
      (hospede.acompanhante ? normalizar(hospede.acompanhante.nome).includes(termo.value) : false),
  )
})

/**
 * O responsável, quando a busca encontrou **ele** e ele tem mais de um animal na casa.
 *
 * Sem esta linha, procurar "Luciana" devolve dois cartões sem dizer por quê — e dois cartões de
 * animais diferentes lado a lado parecem um erro de busca, não a resposta certa.
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

  return normalizar(nome).includes(termo.value)
    ? { nome, total: encontrados.value.length }
    : null
})

/** A banda fria começa fechada; o `onMounted` decide pela ocupação real assim que ela chega. */
const emDiaAberta = ref(false)

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
 * A partição. Primeira banda que aceita vence, e por isso a ordem destes três `computed` é a
 * regra: sem a exclusão, quem sai hoje com tarefa atrasada apareceria duas vezes e a contagem das
 * réguas somaria mais que o total da casa.
 */
const precisam = computed(() => visiveis.value.filter(precisaDeAlguem))

const saem = computed(() =>
  visiveis.value.filter((hospede) => hospede.saiHoje && !precisaDeAlguem(hospede)),
)

const emDia = computed(() =>
  visiveis.value.filter((hospede) => !precisaDeAlguem(hospede) && !hospede.saiHoje),
)

/** As bandas só organizam o "todos": nos outros recortes a lista já vem filtrada. */
const porBandas = computed(() => recorte.value === 'todos')

/**
 * A régua da faixa só aparece quando há mais de uma faixa com gente.
 *
 * Com todo mundo cobrando ação, a régua "PRECISAM DE VOCÊ 5" ficava dois centímetros abaixo da aba
 * "Precisam de mim 5" dizendo a mesma coisa de outro jeito. Régua serve para separar uma coisa de
 * outra; quando só existe uma coisa, ela não separa nada e vira ruído.
 */
const bandasComGente = computed(
  () => [precisam.value, saem.value, emDia.value].filter((banda) => banda.length > 0).length,
)

const mostrarReguas = computed(() => bandasComGente.value > 1)

/*
 * A faixa fria abre sozinha quando a página seria curta.
 *
 * A regra olha as duas faixas quentes somadas, e não só a primeira: com quatro hóspedes cobrando
 * ação e nenhum saindo, a versão anterior mantinha "Em dia" recolhida e deixava metade da tela em
 * branco — recolher para poupar espaço, exatamente onde espaço sobrava.
 */
watch(
  [precisam, saem],
  ([cobram, saindo]) => {
    emDiaAberta.value = cobram.length + saindo.length <= 6
  },
  { immediate: true },
)

/*
 * As contagens das abas seguem a busca, e não o total da casa.
 *
 * Aba dizendo "Todos (5)" com um cartão na tela é aba mentindo: a busca já recortou, e o número
 * precisa contar o que a aba vai mostrar se for clicada.
 */
const quantosPrecisam = computed(() => encontrados.value.filter(precisaDeAlguem).length)
const quantosSaem = computed(() => encontrados.value.filter((item) => item.saiHoje).length)

/**
 * A frase da saudação (redesenho de 30/09/2026): quantos da casa **inteira** precisam de alguém.
 * Não segue a busca — quem busca um nome não quer que o estado da casa vire "1 de 1".
 */
const fraseDaCasa = computed(() => {
  const total = hospedagem.hospedes.length
  const precisam = hospedagem.hospedes.filter(precisaDeAlguem).length

  if (total === 0 || precisam === 0) {
    return t('hotel.hospedes.resumoEmDia')
  }

  return t('hotel.hospedes.resumo', { precisam, total }, precisam)
})

/*
 * O rótulo e a contagem entram separados, e não "Todos (5)" numa string só.
 *
 * Costurados, os dois saíam com o mesmo peso e o mesmo tamanho, e os parênteses eram a única coisa
 * distinguindo o nome da aba do número dela. Separados, o número vira uma pastilha tabular ao lado
 * do rótulo — e é o número que muda toda vez que alguém marca uma tarefa.
 */
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

const vazio = computed(
  () => !hospedagem.carregando && !hospedagem.erro && hospedagem.hospedes.length === 0,
)

/** O corredor de cada hóspede, pelo nome. O `blocoId` já chegava e era jogado fora. */
function blocoNome(hospede: HospedeNaCasa) {
  return hotelStore.blocoPorId.get(hospede.blocoId)?.nome ?? ''
}

function abrir(hospedagemId: string) {
  void router.push(`/hotel/hospedagem/${hospedagemId}`)
}

/**
 * O tutorial desta tela, na ordem em que se lê a página.
 *
 * Os passos ficam aqui, e não num catálogo central, porque cada um carrega um seletor do próprio
 * template: separá-los faria o roteiro apontar para uma classe renomeada sem ninguém notar — que
 * é exatamente o que aconteceu quando a grade deixou de se chamar `.grade` e o tour passou a
 * descartar dois passos em silêncio.
 */
const tourAberto = ref(false)

const passosDoTour = computed<PassoDoTour[]>(() => [
  {
    titulo: t('hotel.tour.hospedes.pergunta.titulo'),
    texto: t('hotel.tour.hospedes.pergunta.texto'),
  },
  {
    alvo: '.barra',
    titulo: t('hotel.tour.hospedes.recortes.titulo'),
    texto: t('hotel.tour.hospedes.recortes.texto'),
  },
  {
    alvo: '.foco',
    titulo: t('hotel.tour.hospedes.cartao.titulo'),
    texto: t('hotel.tour.hospedes.cartao.texto'),
  },
  {
    alvo: '.banda--emdia',
    titulo: t('hotel.tour.hospedes.linhas.titulo'),
    texto: t('hotel.tour.hospedes.linhas.texto'),
  },
])
</script>

<template>
  <PartnerPageFrame
    class="hc-tema"
    :title="t('hotel.hospedes.titulo')"
    :subtitle="t('hotel.hospedes.subtitulo')"
    tour
    @tour="tourAberto = true"
    :loading="hospedagem.carregando && hospedagem.hospedes.length === 0"
    :error="hospedagem.erro ? t(hospedagem.erro) : ''"
    :empty="vazio"
    :empty-title="t('hotel.hospedes.vazioTitulo')"
    :empty-description="t('hotel.hospedes.vazioDescricao')"
    @retry="hospedagem.carregarHospedes()"
  >
    <div class="hospedes clinic-scope">
      <div class="barra">
        <SelectButton
          v-model="recorte"
          class="abas"
          :options="opcoes"
          option-label="rotulo"
          option-value="valor"
          :allow-empty="false"
          :aria-label="t('hotel.hospedes.recorteRotulo')"
        >
          <template #option="{ option }">
            <component
              :is="iconeDoRecorte(option.valor)"
              class="aba__icone"
              weight="duotone"
              aria-hidden="true"
            />
            <span class="aba__rotulo">{{ option.rotulo }}</span>
            <span class="aba__conta clinic-value">{{ option.total }}</span>
          </template>
        </SelectButton>

        <!--
          O resumo da casa subiu para a frase da saudação. Aqui, no vão entre os dois controles,
          fica só o que a busca precisa explicar.
        -->
        <p class="barra__resumo">
          <!--
            Quando a busca casou com o responsável e ele tem mais de um na casa, a tela diz por que
            está mostrando vários — dois animais diferentes lado a lado parecem erro de busca.
          -->
          <span v-if="tutorEncontrado" class="barra__tutor">
            <i class="ph ph-user" aria-hidden="true" />
            {{
              t(
                'hotel.hospedes.busca.doTutor',
                { total: tutorEncontrado.total, tutor: tutorEncontrado.nome },
                tutorEncontrado.total,
              )
            }}
          </span>
        </p>

        <IconField class="busca">
          <PhMagnifyingGlass class="busca__lupa" weight="duotone" aria-hidden="true" />
          <InputText
            v-model="busca"
            class="busca__campo"
            type="search"
            :placeholder="t('hotel.hospedes.busca.dica')"
            :aria-label="t('hotel.hospedes.busca.rotulo')"
          />
        </IconField>
      </div>

      <div v-if="visiveis.length === 0" class="nada">
        <component
          :is="termo ? PhMagnifyingGlass : PhMoon"
          class="nada__icone"
          weight="duotone"
          aria-hidden="true"
        />

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

      <!-- O recorte "Todos" ganha as três bandas; os outros já vêm filtrados. -->
      <template v-else-if="porBandas">
        <section v-if="precisam.length > 0" class="banda">
          <h2 v-if="mostrarReguas" class="banda__titulo">
            <PhWarningCircle weight="duotone" aria-hidden="true" />
            {{ t('hotel.hospedes.banda.precisam') }}
            <span class="banda__conta clinic-value">{{ precisam.length }}</span>
          </h2>

          <ul class="pilha">
            <HospedeCard
              v-for="hospede in precisam"
              :key="hospede.hospedagem.id"
              :hospede="hospede"
              :agora="hospedagem.agora"
              :bloco-nome="blocoNome(hospede)"
              @abrir="abrir"
            />
          </ul>
        </section>

        <section v-if="saem.length > 0" class="banda">
          <h2 v-if="mostrarReguas" class="banda__titulo">
            <PhDoorOpen weight="duotone" aria-hidden="true" />
            {{ t('hotel.hospedes.banda.saem') }}
            <span class="banda__conta clinic-value">{{ saem.length }}</span>
          </h2>

          <ul class="pilha">
            <HospedeCard
              v-for="hospede in saem"
              :key="hospede.hospedagem.id"
              :hospede="hospede"
              :agora="hospedagem.agora"
              :bloco-nome="blocoNome(hospede)"
              @abrir="abrir"
            />
          </ul>
        </section>

        <section v-if="emDia.length > 0" class="banda banda--emdia">
          <button
            type="button"
            class="banda__titulo banda__recolher"
            :aria-expanded="emDiaAberta"
            @click="emDiaAberta = !emDiaAberta"
          >
            <PhMoon weight="duotone" aria-hidden="true" />
            {{ t('hotel.hospedes.banda.emDia') }}
            <span class="banda__conta clinic-value">{{ emDia.length }}</span>
            <i
              class="ph banda__chevron"
              :class="emDiaAberta ? 'ph-caret-down' : 'ph-caret-right'"
              aria-hidden="true"
            />
          </button>

          <ul v-if="emDiaAberta" class="grupo">
            <HospedeFileira
              v-for="hospede in emDia"
              :key="hospede.hospedagem.id"
              :hospede="hospede"
              @abrir="abrir"
            />
          </ul>
        </section>
      </template>

      <ul v-else class="pilha">
        <HospedeCard
          v-for="hospede in visiveis"
          :key="hospede.hospedagem.id"
          :hospede="hospede"
          :agora="hospedagem.agora"
          :bloco-nome="blocoNome(hospede)"
          @abrir="abrir"
        />
      </ul>
    </div>

    <template #cabecalho>
      <div class="hc-saudacao">
        <p class="hc-saudacao__data">{{ t('hotel.hospedes.subtitulo') }}</p>
        <h1 class="hc-saudacao__titulo">{{ t('hotel.hospedes.titulo') }}</h1>

        <div class="hc-saudacao__linha">
          <p v-if="hospedagem.hospedes.length > 0" class="hc-saudacao__resumo" aria-live="polite">
            {{ fraseDaCasa }}
          </p>

          <nav class="hc-acoes" :aria-label="t('hotel.hospedes.titulo')">
            <RouterLink class="hc-pilula hc-pilula--cheia" to="/hotel/rotina">
              <PhListChecks class="hc-pilula__icone" weight="fill" aria-hidden="true" />
              {{ t('hotel.hospedes.irParaRotina') }}
            </RouterLink>
          </nav>
        </div>
      </div>
    </template>

    <HotelDevPanel />

    <HotelTour v-model:aberto="tourAberto" :passos="passosDoTour" />
  </PartnerPageFrame>
</template>

<style scoped>
.hospedes {
  display: grid;
  gap: var(--clinic-space-5);
}

.hospedes {
  gap: var(--clinic-space-4);
}

/*
 * Os controles numa peça só.
 *
 * Soltos na página, a aba ficava numa ponta, a busca na outra e o vão entre elas lia como defeito
 * de alinhamento. Dentro de uma moldura, o mesmo vão vira respiro — e os três elementos passam a
 * se ler como um painel de controle, que é o que eles são.
 */
.barra {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  padding: var(--clinic-space-3);
  border: 1px solid var(--clinic-line-soft);
  border-radius: var(--clinic-radius-card);
  gap: var(--clinic-space-3);
  background: var(--clinic-surface);
}

/* ---------------------------------------------------------------- as abas */

/*
 * O segmento ganha ícone, rótulo e contagem — nessa ordem, que é a ordem da leitura: o desenho
 * localiza, a palavra confirma, o número informa. O desenho de cada aba é o mesmo da régua da
 * faixa que ela filtra, para o filtro não parecer levar a outro lugar.
 */
.abas :deep(.p-togglebutton-content) {
  gap: 0.4rem;
}

.aba__icone {
  width: 1.05rem;
  height: 1.05rem;
  flex: 0 0 auto;
}

.aba__rotulo {
  white-space: nowrap;
}

/*
 * A contagem é pastilha, não parêntese.
 *
 * Costurada no rótulo ela saía com o mesmo peso e o mesmo tamanho da palavra, e os parênteses eram
 * a única coisa separando o nome da aba do número dela. Tabular porque é número que muda a cada
 * tarefa marcada, e dígito que dança na horizontal obriga a reler.
 */
.aba__conta {
  padding-inline: 0.4rem;
  border-radius: var(--clinic-radius-chip);
  background: var(--clinic-surface-sunken);
  color: var(--clinic-muted);
  font-size: var(--clinic-font-label);
  font-variant-numeric: tabular-nums;
  font-weight: 800;
}

.abas :deep(.p-togglebutton-checked) .aba__conta {
  background: var(--clinic-accent-deep);
  color: var(--clinic-on-accent);
}

/* --------------------------------------------------------------- a busca */

/*
 * O `position` é declarado aqui e não herdado do `IconField`: o estilo do PrimeVue 4 é injetado em
 * tempo de execução, e quando essa injeção falta a lupa — que é absoluta — escapa para o canto da
 * página. É a mesma armadilha que já obrigou este projeto a reescrever a caixa do segmento.
 */
.busca {
  position: relative;
  min-width: 17rem;
}

/* No estreito a busca desce para a própria linha: ocupa a largura, em vez de ficar à direita. */
@media (max-width: 640px) {
  .busca {
    min-width: 0;
    flex: 1 1 100%;
  }
}

.busca__lupa {
  position: absolute;
  inset-inline-start: 0.7rem;
  top: 50%;
  width: 1.05rem;
  height: 1.05rem;
  color: var(--clinic-faint);
  pointer-events: none;
  transform: translateY(-50%);
}

.busca__campo {
  width: 100%;
  padding-inline-start: 2.3rem;
}

/*
 * O `type="search"` do WebKit desenha um "x" próprio, fora de qualquer token da casa e sem par no
 * Firefox. O limpar desta tela é o botão do estado vazio, que é onde ele é preciso.
 */
.busca__campo::-webkit-search-cancel-button {
  appearance: none;
}

/* ------------------------------------------------------------- o resumo */

/*
 * O resumo é uma frase em peso normal, e não um número grande com barra.
 *
 * A prancheta do turno já abre com número grande + barra, e repetir a peça aqui refaria, no nível
 * da página, a mesma "fileira-de-números-mais-lista" que derrubou a primeira versão desta tela.
 * O que a pessoa precisa saber ao chegar cabe numa linha.
 */
.barra__resumo {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  margin: 0;
  gap: var(--clinic-space-2) var(--clinic-space-3);
  color: var(--clinic-muted);
  font-size: var(--clinic-font-label);
}

.barra__tutor {
  display: inline-flex;
  align-items: center;
  padding: 0.1rem 0.5rem;
  border: 1px solid var(--clinic-accent-soft);
  border-radius: var(--clinic-radius-chip);
  gap: 0.3rem;
  background: var(--clinic-accent-tint);
  color: var(--clinic-accent-strong);
  font-weight: 700;
}

.barra__tutor .ph {
  font-size: 0.7em;
}

/* --------------------------------------------------------- o estado vazio */

.nada {
  display: grid;
  justify-items: center;
  margin: 0;
  padding: var(--clinic-space-6) var(--clinic-space-5);
  border: 1px solid var(--clinic-line-strong);
  border-radius: var(--clinic-radius-card);
  gap: var(--clinic-space-3);
  background: var(--clinic-surface);
  color: var(--clinic-muted);
  text-align: center;
}

.nada__texto {
  margin: 0;
}

.nada__icone {
  width: 3rem;
  height: 3rem;
  color: var(--clinic-line-strong);
}

/* ------------------------------------------------------------------ bandas */

.banda {
  display: grid;
  gap: var(--clinic-space-3);
}

/*
 * A régua da banda, com o filete correndo até a borda. É o mesmo desenho que separa os tempos na
 * prancheta: quebra a página em respirações sem custar uma caixa.
 */
.banda__titulo {
  display: flex;
  align-items: center;
  width: 100%;
  margin: 0;
  padding: 0;
  border: 0;
  gap: var(--clinic-space-2);
  background: transparent;
  color: var(--clinic-text);
  font-family: inherit;
  font-size: 0.9375rem;
  font-weight: 650;
  letter-spacing: -0.01em;
  text-align: start;
}

.banda__titulo::after {
  height: 1px;
  flex: 1;
  background: var(--clinic-line-soft);
  content: '';
}

.banda__titulo :deep(svg),
.banda__titulo > svg {
  width: 1.05rem;
  height: 1.05rem;
  flex: 0 0 auto;
}

.banda__conta {
  color: var(--clinic-text);
  font-weight: 800;
  letter-spacing: 0;
}

.banda__recolher {
  cursor: pointer;
}

.banda__recolher:hover {
  color: var(--clinic-text);
}

.banda__recolher:focus-visible {
  border-radius: var(--clinic-radius-control);
  box-shadow: var(--clinic-focus-ring);
  outline: none;
}

.banda__chevron {
  order: 1;
  font-size: 0.7rem;
}

/* O chevron de "fechado" é direcional: em árabe ele aponta para o outro lado. */
[dir='rtl'] .ph-caret-right {
  transform: scaleX(-1);
}

/* ------------------------------------------------------------------- grades */

/*
 * Teto **explícito** de duas colunas, e não `auto-fill`.
 *
 * O `auto-fill` da versão anterior oscilava entre três e quatro colunas com cinco pixels de
 * diferença de janela, e com cinco hóspedes sempre sobrava uma fileira órfã. Duas colunas dão ao
 * cartão a largura que a linha de foco precisa e enchem a página com conteúdo de verdade.
 */
.pilha {
  display: grid;
  margin: 0;
  padding: 0;
  gap: var(--clinic-space-4);
  grid-template-columns: minmax(0, 1fr);
  list-style: none;
}

@media (min-width: 1200px) {
  .pilha {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

/* A banda fria: uma moldura para o grupo, irmãs separadas por filete. */
.grupo {
  margin: 0;
  padding: 0;
  border: 1px solid var(--clinic-line);
  border-radius: var(--clinic-radius-card);
  background: var(--clinic-surface);
  box-shadow: var(--clinic-shadow-card);
  list-style: none;
  overflow: hidden;
}

.grupo > li + li {
  border-block-start: 1px solid var(--clinic-line-soft);
}

/* Caixa-alta rastreada não roda em árabe: o `letter-spacing` desconecta as ligaduras. */
[dir='rtl'] .banda__titulo {
  letter-spacing: normal;
  text-transform: none;
}
</style>
