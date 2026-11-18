<script setup lang="ts">
/**
 * O mapa na lateral: Início, e cada espaço com os seus destinos.
 *
 * O título de cada espaço é o botão que o abre e o recolhe, em todos os formatos do menu, também
 * na barra só de ícones (pedido do Luís, 16/11/2026: antes, no modo "Só o da tela" e na barra de
 * ícones, o título era um link e a seta não recolhia nada). Recolhido, o espaço fica numa linha só,
 * com o total de pendências dele — ninguém precisa abrir o Hotel para saber que lá há sete coisas
 * paradas.
 *
 * O que muda com "Espaços na barra" (Configurações → Aparência) é o resto:
 * - "Um de cada vez": abrir um recolhe o que estava aberto, e ir para uma tela abre o espaço dela.
 *   Nada fica guardado.
 * - "Você escolhe": cada espaço fica como a pessoa deixou, lembrado no navegador. Espaço em que ela
 *   nunca mexeu segue a tela: aberto quando se está nele, recolhido quando se sai.
 *
 * Os destinos do espaço aberto ficam num painel de vidro, e o destino atual acende na cor do
 * espaço. Abrir e fechar um espaço desliza.
 *
 * Desde 16/11/2026 os destinos vêm agrupados pelas seções do espaço ("Dia a dia", "Atendimento",
 * "Gestão"), cada uma com o título dela: a barra deixou de ser uma pilha de nove linhas iguais.
 */
import Button from 'primevue/button'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRoute } from 'vue-router'

import type { Espaco, Localizacao } from '@/navegacao/espacos'

const props = defineProps<{
  espacos: Espaco[]
  aqui: Localizacao
  recolhida: boolean
  /** "Você escolhe": cada espaço abre e recolhe por si, e a escolha fica lembrada. */
  voceEscolhe: boolean
}>()

const emit = defineEmits<{ navegou: [] }>()

const { t } = useI18n()
const route = useRoute()

const noInicio = computed(() => route.path === '/inicio')

/** A chave de antes: só a lista dos espaços recolhidos. Lida uma vez, para não perder a escolha. */
const CHAVE_RECOLHIDOS = 'petjourney-barra-espacos-recolhidos'
const CHAVE_ESCOLHAS = 'petjourney-barra-espacos-escolhas'

type Escolha = 'aberto' | 'fechado'

/**
 * O que a pessoa escolheu para cada espaço, neste navegador. Espaço sem escolha segue a tela: abre
 * quando se está nele e recolhe quando se sai. Com os três espaços sempre abertos o menu tinha
 * 1.262 px numa barra de 655 (análise de 16/11/2026), e metade ficava abaixo da dobra sem aviso.
 */
function lerEscolhas(): Record<string, Escolha> {
  try {
    const salvo: unknown = JSON.parse(window.localStorage.getItem(CHAVE_ESCOLHAS) ?? 'null')

    if (salvo && typeof salvo === 'object' && !Array.isArray(salvo)) {
      return Object.fromEntries(
        Object.entries(salvo).filter(([, valor]) => valor === 'aberto' || valor === 'fechado'),
      ) as Record<string, Escolha>
    }

    const recolhidos: unknown = JSON.parse(window.localStorage.getItem(CHAVE_RECOLHIDOS) ?? '[]')

    return Array.isArray(recolhidos)
      ? Object.fromEntries(recolhidos.map((id) => [String(id), 'fechado' as const]))
      : {}
  } catch {
    return {}
  }
}

const escolhas = ref(lerEscolhas())

/**
 * "Um de cada vez": o espaço aberto agora. Começa no da tela e segue a navegação: ir para uma tela
 * abre o espaço dela (no Início e na Conta, nenhum). Entre uma tela e outra, a pessoa abre e
 * recolhe à vontade.
 */
const abertoAgora = ref<string | null>(props.aqui.espaco?.id ?? null)

watch(
  () => [route.path, props.aqui.espaco?.id] as const,
  ([, id]) => {
    abertoAgora.value = id ?? null
  },
)

/** Sem escolha: aberto o espaço da tela atual; no Início e na Conta, o primeiro. */
function abertoPorPadrao(espaco: Espaco) {
  const atual = props.aqui.espaco?.id

  return atual ? atual === espaco.id : props.espacos[0]?.id === espaco.id
}

function alternar(espaco: Espaco) {
  if (!props.voceEscolhe) {
    abertoAgora.value = aberto(espaco) ? null : espaco.id
    return
  }

  const proximas: Record<string, Escolha> = {
    ...escolhas.value,
    [espaco.id]: aberto(espaco) ? 'fechado' : 'aberto',
  }

  escolhas.value = proximas

  try {
    window.localStorage.setItem(CHAVE_ESCOLHAS, JSON.stringify(proximas))
  } catch {
    /* Sem armazenamento (janela anônima bloqueada): vale só nesta visita. */
  }
}

function aberto(espaco: Espaco) {
  if (!props.voceEscolhe) {
    return abertoAgora.value === espaco.id
  }

  const escolha = escolhas.value[espaco.id]

  return escolha ? escolha === 'aberto' : abertoPorPadrao(espaco)
}

/*
 * Quando o menu não cabe na altura (notebook baixo, tablet deitado), ele rola, e a barra de rolagem
 * fica escondida. O lado que continua fora da vista esmaece, para dizer que há mais: sem isso o
 * Portal sumia abaixo da dobra e ninguém sabia que estava lá.
 */
const mapa = ref<HTMLElement | null>(null)
const cortaInicio = ref(false)
const cortaFim = ref(false)

function medirRolagem() {
  const el = mapa.value

  if (!el) {
    return
  }

  const sobra = el.scrollHeight - el.clientHeight

  cortaInicio.value = el.scrollTop > 2
  cortaFim.value = el.scrollTop < sobra - 2
}

let observadorDoMapa: ResizeObserver | null = null

onMounted(() => {
  medirRolagem()

  if (mapa.value && typeof ResizeObserver !== 'undefined') {
    observadorDoMapa = new ResizeObserver(medirRolagem)
    observadorDoMapa.observe(mapa.value)

    /* Abrir e recolher um espaço muda a altura do conteúdo, não a da barra. */
    for (const filho of Array.from(mapa.value.children)) {
      observadorDoMapa.observe(filho)
    }
  }
})

onBeforeUnmount(() => observadorDoMapa?.disconnect())

watch(
  () => [route.path, props.recolhida, props.espacos.length],
  () => nextTick(medirRolagem),
)

function idDaGaveta(espaco: Espaco) {
  return `gaveta-do-espaco-${espaco.id}`
}

function idDaSecao(espaco: Espaco, secao: string) {
  return `secao-${espaco.id}-${secao}`
}

function destinoAtivo(id: string, espaco: Espaco) {
  return props.aqui.espaco?.id === espaco.id && props.aqui.destino?.id === id
}
</script>

<template>
  <nav
    ref="mapa"
    class="mapa"
    :class="{
      'mapa--recolhida': recolhida,
      'mapa--corta-inicio': cortaInicio,
      'mapa--corta-fim': cortaFim,
    }"
    :aria-label="t('shell.barra.navegacao')"
    @scroll.passive="medirRolagem"
  >
    <RouterLink
      class="mapa__inicio"
      :class="{ 'mapa__inicio--ativo': noInicio }"
      to="/inicio"
      :aria-current="noInicio ? 'page' : undefined"
      :title="recolhida ? t('shell.barra.inicio') : undefined"
      @click="emit('navegou')"
    >
      <span class="mapa__ladrilho" aria-hidden="true"><i class="ph ph-house-simple" /></span>
      <span class="mapa__rotulo shell-rotulo">{{ t('shell.barra.inicio') }}</span>
    </RouterLink>

    <section
      v-for="espaco in espacos"
      :key="espaco.id"
      class="espaco"
      :class="[`pj-lugar--${espaco.lugar}`, { 'espaco--aberto': aberto(espaco) }]"
    >
      <!-- O título abre e recolhe o espaço, em todos os formatos; só de ícones, o nome vai no title. -->
      <Button
        unstyled
        type="button"
        class="espaco__cabeca espaco__cabeca--alterna"
        :aria-expanded="aberto(espaco)"
        :aria-controls="idDaGaveta(espaco)"
        :aria-label="recolhida ? espaco.rotulo : undefined"
        :title="recolhida ? espaco.rotulo : undefined"
        @click="alternar(espaco)"
      >
        <span class="mapa__ladrilho espaco__icone" aria-hidden="true"
          ><i :class="espaco.icone"
        /></span>
        <span class="mapa__rotulo espaco__nome shell-rotulo">{{ espaco.rotulo }}</span>
        <span
          v-if="espaco.selo && !aberto(espaco)"
          class="mapa__selo"
          :class="`mapa__selo--${espaco.tom ?? 'neutro'}`"
        >
          {{ espaco.selo }}
        </span>
        <i class="ph ph-caret-right espaco__seta shell-rotulo" aria-hidden="true" />
      </Button>

      <!--
        A gaveta do espaço fica montada mesmo fechada: assim ela abre e fecha deslizando (a linha
        da grade vai de 0 a 1fr). Fechada, sai da ordem do Tab e do leitor de tela.
      -->
      <div
        :id="idDaGaveta(espaco)"
        class="espaco__gaveta"
        :inert="!aberto(espaco) || undefined"
        :aria-hidden="!aberto(espaco) || undefined"
      >
        <!--
          Os destinos por seção, cada uma com o título dela: quem bate o olho sabe o que mora ali
          antes de ler a lista. Espaço de uma seção só não repete o título; só de ícones, o título
          vira um fio entre os grupos.
        -->
        <div class="espaco__dobra">
          <div class="espaco__destinos">
            <div
              v-for="secao in espaco.secoes"
              :key="secao.id"
              class="secao"
              role="group"
              :aria-labelledby="espaco.secoes.length > 1 ? idDaSecao(espaco, secao.id) : undefined"
              :aria-label="espaco.secoes.length > 1 ? undefined : espaco.rotulo"
            >
              <span
                v-if="espaco.secoes.length > 1"
                :id="idDaSecao(espaco, secao.id)"
                class="secao__titulo shell-rotulo"
              >
                {{ secao.rotulo }}
              </span>
              <ul class="secao__lista">
                <li v-for="destino in secao.destinos" :key="destino.id">
                  <RouterLink
                    class="destino"
                    :class="{
                      'destino--ativo': destinoAtivo(destino.id, espaco),
                      'destino--bloqueado': destino.bloqueado,
                    }"
                    :to="destino.to"
                    active-class=""
                    exact-active-class=""
                    :aria-current="destinoAtivo(destino.id, espaco) ? 'page' : undefined"
                    :title="recolhida ? destino.rotulo : (destino.tituloDoSelo ?? undefined)"
                    @click="emit('navegou')"
                  >
                    <i class="destino__icone" :class="destino.icone" aria-hidden="true" />
                    <span class="mapa__rotulo shell-rotulo">{{ destino.rotulo }}</span>
                    <i
                      v-if="destino.bloqueado"
                      class="ph ph-lock-simple destino__cadeado shell-rotulo"
                      aria-hidden="true"
                    />
                    <span
                      v-else-if="destino.selo"
                      class="mapa__selo"
                      :class="`mapa__selo--${destino.tom ?? 'neutro'}`"
                      :aria-label="destino.tituloDoSelo"
                    >
                      {{ destino.selo }}
                    </span>
                  </RouterLink>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  </nav>
</template>

<style scoped>
/* O lado do menu que continua fora da vista esmaece nos últimos 40 px. */
.mapa--corta-fim {
  mask-image: linear-gradient(to bottom, #000 calc(100% - 40px), transparent);
}

.mapa--corta-inicio {
  mask-image: linear-gradient(to top, #000 calc(100% - 40px), transparent);
}

.mapa--corta-inicio.mapa--corta-fim {
  mask-image: linear-gradient(
    to bottom,
    transparent,
    #000 40px,
    #000 calc(100% - 40px),
    transparent
  );
}

/*
 * A barra no acabamento novo (20/10/2026): cada espaço é uma linha com o ladrilho da cor dele; o
 * espaço aberto mostra os destinos num painel de vidro, como um cartão dentro da moldura verde, e o
 * destino atual acende na cor do espaço. Abrir e fechar desliza, e recolher a barra deixa só os
 * ícones, numa coluna.
 */
/* A coluna não cresce com as palavras: recolhida, elas somem mas ainda ocupariam lugar. */
.mapa {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  align-content: start;
  gap: 4px;
  padding: 4px 12px 14px;
}

.mapa__inicio,
.espaco__cabeca,
.destino {
  position: relative;
  display: flex;
  align-items: center;
  border-radius: 12px;
  color: var(--sobre-rail-2);
  text-decoration: none;
  white-space: nowrap;
  transition:
    background-color var(--pj-tempo-curto) var(--pj-curva-chega),
    color var(--pj-tempo-curto) var(--pj-curva-chega);
}

.mapa__inicio,
.espaco__cabeca {
  min-height: 46px;
  gap: 12px;
  padding: 0 10px 0 8px;
  font-size: 14.5px;
  font-weight: 550;
}

.mapa__inicio:hover,
.espaco__cabeca:hover,
.destino:hover {
  background: rgb(255 255 255 / 6%);
  color: var(--sobre-rail);
}

.mapa__inicio:focus-visible,
.espaco__cabeca:focus-visible,
.destino:focus-visible {
  outline: 2px solid var(--sobre-rail);
  outline-offset: -2px;
}

.mapa__inicio {
  margin-bottom: 8px;
}

.mapa__inicio--ativo {
  background: rgb(255 255 255 / 9%);
  color: var(--sobre-rail);
  font-weight: 650;
}

/*
 * O ladrilho: o mesmo quadrado macio das telas, aqui em vidro sobre o verde. Ícone de tamanho par
 * no quadrado par: com 17 px sobrava meio pixel, e o desenho caía para baixo e para a direita.
 */
.mapa__ladrilho {
  display: grid;
  flex: none;
  width: 32px;
  height: 32px;
  place-items: center;
  border-radius: 10px;
  background: rgb(255 255 255 / 7%);
  color: var(--sobre-rail);
  font-size: 18px;
  transition:
    background var(--pj-tempo-medio) var(--pj-curva-chega),
    box-shadow var(--pj-tempo-medio) var(--pj-curva-chega),
    color var(--pj-tempo-medio) var(--pj-curva-chega);
}

.mapa__inicio--ativo .mapa__ladrilho {
  background: linear-gradient(145deg, var(--pets-claro), var(--salvia));
  box-shadow: 0 6px 14px -6px rgb(0 0 0 / 55%);
  color: var(--rail);
}

.mapa__rotulo {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ------------------------------------------------------------------------------- espaço */

.espaco {
  --lugar-na-barra: var(--pj-lugar-claro);
}

.espaco__cabeca {
  color: var(--sobre-rail);
}

/* O título que recolhe é botão: herda a linha do link, sem o desenho de botão. */
.espaco__cabeca--alterna {
  width: 100%;
  margin: 0;
  border: 0;
  background: transparent;
  font-family: inherit;
  text-align: start;
  cursor: pointer;
}

.espaco__icone {
  background: color-mix(in oklab, var(--lugar-na-barra) 18%, transparent);
  color: var(--lugar-na-barra);
}

.espaco--aberto .espaco__icone {
  background: var(--pj-lugar-degrade);
  box-shadow:
    0 6px 14px -6px rgb(0 0 0 / 60%),
    inset 0 1px 0 rgb(255 255 255 / 22%);
  color: #fff;
}

.espaco--aberto .espaco__cabeca {
  font-weight: 650;
}

.espaco__seta {
  flex: none;
  color: var(--sobre-rail-2);
  font-size: 12px;
  transition: transform var(--pj-tempo-medio) var(--pj-curva-chega);
}

.espaco--aberto .espaco__seta {
  transform: rotate(90deg);
}

/* A gaveta desliza: a linha da grade vai de 0 a 1fr, e o miolo corta o que ainda não cabe. */
.espaco__gaveta {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  grid-template-rows: 0fr;
  opacity: 0;
  transition:
    grid-template-rows 280ms var(--pj-curva-chega),
    opacity 200ms var(--pj-curva-chega);
}

.espaco--aberto .espaco__gaveta {
  grid-template-rows: 1fr;
  opacity: 1;
}

.espaco__dobra {
  min-height: 0;
  overflow: hidden;
}

/* O painel de vidro com os destinos: um cartão dentro da moldura. */
.espaco__destinos {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 2px;
  margin: 4px 0 8px;
  padding: 6px;
  border: 1px solid rgb(255 255 255 / 7%);
  border-radius: 14px;
  background: rgb(255 255 255 / 4%);
}

/* ------------------------------------------------------------------------------- seção */

.secao {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
}

.secao + .secao {
  margin-top: 8px;
}

/* O título da seção: a etiqueta baixa e apagada que diz o assunto, sem disputar com as telas. */
.secao__titulo {
  overflow: hidden;
  padding: 6px 10px 4px;
  color: var(--sobre-rail-2);
  font-size: 12px;
  font-weight: 650;
  letter-spacing: 0.01em;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.secao__lista {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 2px;
  margin: 0;
  padding: 0;
  list-style: none;
}

/*
 * Só de ícones: o título sai (sem palavra, ele só ocuparia altura) e um fio curto separa os
 * grupos, no eixo da coluna.
 */
.mapa--recolhida .secao__titulo {
  display: none;
}

.mapa--recolhida .secao + .secao::before {
  display: block;
  width: 22px;
  height: 1px;
  margin: 5px auto;
  background: rgb(255 255 255 / 12%);
  content: '';
}

.destino {
  min-height: 38px;
  gap: 11px;
  padding: 0 10px;
  border-radius: 10px;
  font-size: 13.5px;
  font-weight: 450;
}

.destino__icone {
  flex: none;
  width: 20px;
  font-size: 18px;
  text-align: center;
  opacity: 0.9;
}

.destino--ativo,
.destino--ativo:hover {
  background: color-mix(in oklab, var(--lugar-na-barra) 17%, transparent);
  color: #fff;
  font-weight: 600;
}

.destino--ativo::before {
  position: absolute;
  top: 9px;
  bottom: 9px;
  inset-inline-start: -6px;
  width: 3px;
  border-radius: 0 3px 3px 0;
  background: var(--lugar-na-barra);
  content: '';
}

.destino--ativo .destino__icone {
  color: var(--lugar-na-barra);
  opacity: 1;
}

.destino--bloqueado {
  opacity: 0.7;
}

.destino__cadeado {
  font-size: 13px;
}

/*
 * Os selos da barra têm cor própria: os tons de estado foram feitos para a folha clara, e sobre
 * o verde-floresta da barra precisam ser mais claros para continuar lidos como o mesmo aviso.
 */
.mapa__selo {
  display: inline-grid;
  flex: none;
  min-width: 22px;
  height: 20px;
  padding: 0 6px;
  place-items: center;
  border-radius: 999px;
  font-family: var(--font-dados);
  font-size: 11.5px;
  font-variant-numeric: tabular-nums;
  font-weight: 650;
  line-height: 1;
  transition:
    transform var(--pj-tempo-medio) var(--pj-curva-chega),
    opacity var(--pj-tempo-curto) ease;
}

.mapa__selo--neutro {
  background: rgb(255 255 255 / 14%);
  color: var(--sobre-rail);
}

.mapa__selo--atencao {
  background: #f0b77c;
  color: #2b1703;
}

.mapa__selo--risco {
  background: #f39b90;
  color: #3a0d09;
}

/*
 * Recolhida: as palavras somem (a moldura cuida do esmaecer) e sobram os ícones, todos no eixo da
 * coluna de 48 px — os destinos chegam o ícone para o mesmo centro dos ladrilhos. O selo vai para
 * o canto do ícone.
 */
.mapa--recolhida .mapa__selo {
  position: absolute;
  top: 3px;
  inset-inline-start: 30px;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  font-size: 10px;
}

.mapa--recolhida .destino {
  padding-inline: 7px;
}

.mapa--recolhida .destino .mapa__selo {
  inset-inline-start: 19px;
}

.mapa--recolhida .destino--ativo::before {
  display: none;
}

/* Densidade compacta (Configurações → Aparência): mais destinos à vista sem rolar a barra. */
.shell--densa .mapa__inicio,
.shell--densa .espaco__cabeca {
  min-height: 38px;
}

.shell--densa .destino {
  min-height: 32px;
  font-size: 13px;
}

.shell--densa .mapa__ladrilho {
  width: 28px;
  height: 28px;
  font-size: 16px;
}

.shell--densa .espaco__destinos {
  margin-block: 2px 6px;
  padding: 4px;
}

@media (prefers-reduced-motion: reduce) {
  .mapa__inicio,
  .espaco__cabeca,
  .destino,
  .espaco__seta,
  .espaco__gaveta,
  .mapa__ladrilho,
  .mapa__selo {
    transition: none;
  }
}
</style>
