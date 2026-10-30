<script setup lang="ts">
/**
 * O Hoje da Clínica no **design do app** (perfil de parceiro), escolhido em 26/10/2026.
 *
 * A tela é a home do parceiro no app, trazida para a tela grande: a barra lateral de sempre,
 * vestida como o menu do app (o destaque sálvia em cima, os ícones em véu, o item aberto em
 * pílula cheia), e na folha branca o destaque na mesma cor. Nele, dois cartões de papel branco
 * lado a lado: o paciente da vez e o resumo do dia (a frase, a data, o andamento e os três
 * números). Embaixo, a fila numa lista lisa e, ao lado, o que pede ação num painel em véu. Tudo
 * na largura inteira da folha.
 *
 * Regras do app (`docs/design/padrao-tutor.md`, no petjourney-app): tela branca e lisa, sem
 * sombra nem degradê; destaque na cor do perfil com texto branco; marinho só como tinta; cor em
 * véu; atenção é marinho sobre cinza frio, nunca pêssego; Readex, peso máximo 700, título 26,
 * seção 17, linha 15,5. Os tokens moram em `components/layout/moldura-app.css`.
 */
import { PhInfo, PhWarning, PhWarningOctagon } from '@phosphor-icons/vue'
import Button from 'primevue/button'
import Carousel from 'primevue/carousel'
import Skeleton from 'primevue/skeleton'
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

import UiPagina from '@/components/ui/UiPagina.vue'
import { useClinicFormat } from '@/features/clinico/composables/useClinicFormat'
import type { MeuDia } from '@/features/clinico/composables/useMeuDia'
import type { Appointment } from '@/features/clinico/data/types'
import PetAvatar from '@/features/hotel/components/base/PetAvatar.vue'

const props = defineProps<{ dia: MeuDia }>()

const { t } = useI18n()
const formato = useClinicFormat()

/** Quantos da fila aparecem antes do "mostrar mais": o que cabe numa tela de 900 px. */
const LIMITE_DA_FILA = 7
const LIMITE_DE_PENDENCIAS = 6

const filaAberta = ref(false)
const pendenciasAbertas = ref(false)

/**
 * Os pacientes do cartão do destaque, um por vez num carrossel: todos os que estão em sala. Sem
 * ninguém em sala, o da vez (o primeiro da recepção, ou o próximo horário), como antes.
 */
const noCartao = computed<Appointment[]>(() => {
  if (props.dia.emConsulta.length) {
    return props.dia.emConsulta
  }

  return props.dia.destaque ? [props.dia.destaque] : []
})

const pagina = ref(0)

/* Alguém saiu da sala com o último cartão aberto: volta para um que ainda existe. */
watch(
  () => noCartao.value.length,
  (total) => {
    if (pagina.value >= total) {
      pagina.value = Math.max(0, total - 1)
    }
  },
)

const carrossel = ref<HTMLElement | null>(null)

/**
 * Anda em roda: do último volta ao primeiro. Cada cartão tem a sua paginação, e o que sai fica
 * inerte; então o foco passa para o mesmo controle no cartão que entrou, senão quem navega pelo
 * teclado perde o lugar a cada troca.
 */
function irPara(indice: number, controle: string) {
  const total = noCartao.value.length

  pagina.value = total ? (indice + total) % total : 0

  void nextTick(() => {
    carrossel.value
      ?.querySelector<HTMLElement>(`.cartao:not([inert]) [data-controle="${controle}"]`)
      ?.focus()
  })
}

type Entrada = { item: Appointment; estado: 'espera' | 'marcado' }

/** A recepção e depois os horários, sem repetir quem já está no cartão. */
const fila = computed<Entrada[]>(() => {
  const noDestaque = new Set(noCartao.value.map((item) => item.id))

  return [
    ...props.dia.naRecepcao
      .filter((item) => !noDestaque.has(item.id))
      .map((item) => ({ item, estado: 'espera' as const })),
    ...props.dia.aSeguir
      .filter((item) => !noDestaque.has(item.id))
      .map((item) => ({ item, estado: 'marcado' as const })),
  ]
})

const filaVisivel = computed(() =>
  filaAberta.value ? fila.value : fila.value.slice(0, LIMITE_DA_FILA),
)
const filaEscondida = computed(() => Math.max(0, fila.value.length - LIMITE_DA_FILA))

const pendenciasVisiveis = computed(() =>
  pendenciasAbertas.value
    ? props.dia.linhasDaPauta
    : props.dia.linhasDaPauta.slice(0, LIMITE_DE_PENDENCIAS),
)
const pendenciasEscondidas = computed(() =>
  Math.max(0, props.dia.linhasDaPauta.length - LIMITE_DE_PENDENCIAS),
)

/** Os números do resumo: os três que dizem como está a clínica agora. */
const numeros = computed(() =>
  props.dia.indicadores.filter((indicador) => indicador.id !== 'a-seguir'),
)

/**
 * "Esperando há 4 min", e no primeiro minuto "Chegou agora": "há 0 min" lia como conta errada, e
 * a lista "O que pede ação" ao lado já dizia "esperando agora".
 */
function tempoDesde(desde: string | null, chave: 'sala' | 'espera') {
  const minutos = props.dia.minutosDesde(desde) ?? 0

  return minutos < 1
    ? t(`clinico.meuDia.estado.${chave}Agora`)
    : t(`clinico.meuDia.estado.${chave}`, { tempo: formato.duracao(minutos) })
}

/** O estado do paciente do cartão, na pílula em véu ao lado do nome. */
function estadoDe(item: Appointment) {
  if (item.status === 'em-atendimento') {
    return tempoDesde(item.iniciadoEm ?? item.inicio, 'sala')
  }

  if (item.status === 'aguardando') {
    return tempoDesde(item.chegadaEm, 'espera')
  }

  return t('clinico.meuDia.estado.marcado', { hora: formato.hora(item.inicio) })
}

function fatosDe(item: Appointment) {
  return [
    { icone: 'ph ph-stethoscope', texto: props.dia.linhaDoAtendimento(item) },
    { icone: 'ph ph-door', texto: props.dia.salasDe(item) },
    { icone: 'ph ph-user', texto: props.dia.tutor(item.tutorId)?.nome ?? '' },
  ].filter((fato) => fato.texto)
}

/** O rótulo do botão, sem o nome: o nome já é o título do cartão, e nome longo estourava o botão. */
function acaoCurtaDe(item: Appointment) {
  return item.status === 'em-atendimento'
    ? t('clinico.meuDia.carrossel.continuar')
    : t('clinico.hoje.chamar')
}

/** Quem está na sala se continua; quem espera ou vem, se atende. Para o leitor de tela, com o nome. */
function acaoDe(item: Appointment) {
  const pet = props.dia.pet(item.petId)?.nome ?? ''

  return item.status === 'em-atendimento'
    ? t('clinico.meuDia.continuarCom', { pet })
    : t('clinico.meuDia.atenderCom', { pet })
}

const ICONE_DO_TOM = { risco: PhWarningOctagon, atencao: PhWarning, neutro: PhInfo }
</script>

<template>
  <UiPagina
    class="app-pj"
    :carregando="dia.carregando"
    :erro="dia.erro"
    bloquear-se-suspenso
    @tentar-de-novo="dia.carregar"
  >
    <!--
      Na faixa do app (a do `UiPagina`), dois cartões brancos em vez do cartão do título. O resumo
      vem primeiro no documento (é o título da página), mas fica à direita na tela larga; o
      paciente da vez, à esquerda, é onde a mão vai.
    -->
    <template #destaque>
      <div class="destaque">
        <!--
          A faixa aparece antes dos dados (é do `UiPagina`, que só troca o corpo pelo "Carregando").
          Sem isto ela dizia "Nada parado" e três zeros até o dia chegar: os dois cartões ficam
          em esqueleto, na mesma forma, e a troca não pula.
        -->
        <div v-if="dia.carregando" class="destaque__miolo" aria-hidden="true">
          <div class="cartao resumo cartao--esqueleto">
            <Skeleton width="70%" height="1.4rem" border-radius="8px" />
            <Skeleton width="40%" height="0.9rem" border-radius="6px" />
            <Skeleton height="3.6rem" border-radius="16px" />
          </div>
          <div class="cartao paciente cartao--esqueleto">
            <Skeleton shape="circle" size="3.5rem" />
            <Skeleton width="60%" height="0.9rem" border-radius="6px" />
            <Skeleton width="12rem" height="3rem" border-radius="16px" />
          </div>
        </div>

        <div v-else class="destaque__miolo">
          <!--
            O resumo do dia, de cima para baixo e sem vão: a frase, a data, o andamento numa barra e
            os três números numa fileira. A altura sobra no meio, não num canto vazio.
          -->
          <section class="cartao resumo" aria-labelledby="foco-resumo">
            <div class="resumo__textos">
              <h1 id="foco-resumo">{{ dia.fraseDoResumo }}</h1>
              <p>{{ dia.dataDeHoje }}</p>
            </div>

            <div v-if="dia.progressoDoDia.total" class="resumo__andamento">
              <span class="resumo__barra" aria-hidden="true">
                <span
                  :style="{
                    width: `${(dia.progressoDoDia.feitos / dia.progressoDoDia.total) * 100}%`,
                  }"
                />
              </span>
              <span>{{ dia.andamentoDoDia }}</span>
            </div>

            <ul class="numeros" :aria-label="t('clinico.meuDia.abertura.indicadores')">
              <li v-for="numero in numeros" :key="numero.id">
                <RouterLink class="numero" :to="numero.to ?? '/veterinario/agenda'">
                  <span class="numero__icone" aria-hidden="true"><i :class="numero.icone" /></span>
                  <span class="numero__textos">
                    <strong>{{ numero.valor }}</strong>
                    <span class="numero__rotulo">{{ numero.rotulo }}</span>
                  </span>
                  <span
                    v-if="numero.tom"
                    class="numero__ponto"
                    :class="`numero__ponto--${numero.tom}`"
                    aria-hidden="true"
                  />
                </RouterLink>
              </li>
            </ul>
          </section>

          <!--
            Os pacientes em sala, um cartão por vez. Os rostos no pé do cartão são a paginação: dizem
            quem mais está lá dentro e levam até ele; as setas andam em roda. Sem passar sozinho:
            tela de trabalho não troca o que a pessoa está lendo. No tablet, arrastar também passa.
          -->
          <section
            v-if="noCartao.length"
            ref="carrossel"
            class="paciente carrossel"
            :aria-label="t('clinico.meuDia.carrossel.grupo')"
          >
            <Carousel
              v-model:page="pagina"
              :value="noCartao"
              :num-visible="1"
              :num-scroll="1"
              :show-navigators="false"
              :show-indicators="false"
              class="carrossel__trilho"
            >
              <template #item="{ data: item, index }">
                <article
                  class="cartao"
                  :aria-labelledby="`foco-agora-${item.id}`"
                  :inert="index !== pagina || undefined"
                >
                  <div class="cartao__quem">
                    <span class="cartao__rosto">
                      <PetAvatar
                        :nome="dia.pet(item.petId)?.nome ?? ''"
                        :iniciais="dia.pet(item.petId)?.iniciais ?? ''"
                        :especie="dia.pet(item.petId)?.especie ?? null"
                        :foto-url="dia.pet(item.petId)?.fotoUrl ?? ''"
                        tamanho="lg"
                      />
                    </span>
                    <div class="cartao__nome">
                      <h2 :id="`foco-agora-${item.id}`">{{ dia.pet(item.petId)?.nome }}</h2>
                      <p v-if="dia.pet(item.petId)">
                        {{ dia.linhaDoPaciente(dia.pet(item.petId)!) }}
                      </p>
                    </div>
                    <span class="cartao__estado">
                      <i class="ph ph-clock" aria-hidden="true" />
                      {{ estadoDe(item) }}
                    </span>
                  </div>

                  <!-- Os fatos numa linha de texto com ícone: pouco texto, sem uma pílula por fato. -->
                  <ul class="cartao__fatos">
                    <li v-for="fato in fatosDe(item)" :key="fato.icone" :title="fato.texto">
                      <i :class="fato.icone" aria-hidden="true" />
                      <span>{{ fato.texto }}</span>
                    </li>
                  </ul>

                  <!-- O alerta em selo pastel: é a única coisa do cartão que não pode sumir. -->
                  <ul
                    v-if="dia.alertasRelevantes(dia.pet(item.petId)).length"
                    class="cartao__alertas"
                  >
                    <li
                      v-for="alerta in dia.alertasRelevantes(dia.pet(item.petId))"
                      :key="alerta.id"
                      class="cartao__alerta"
                      :class="`cartao__alerta--${alerta.severidade}`"
                    >
                      <i class="ph ph-warning" aria-hidden="true" />
                      {{ dia.textoDoAlerta(alerta) }}
                    </li>
                  </ul>

                  <div class="cartao__acoes">
                    <Button
                      type="button"
                      class="cartao__principal"
                      icon="ph ph-stethoscope"
                      :label="acaoCurtaDe(item)"
                      :aria-label="acaoDe(item)"
                      @click="dia.abrirProntuario(item)"
                    />
                    <RouterLink class="cartao__secundario" :to="dia.rotaDoResumo(item)">
                      <i class="ph ph-notepad" aria-hidden="true" />
                      {{ t('clinico.resumoDoPaciente.verResumo') }}
                    </RouterLink>

                    <div v-if="noCartao.length > 1" class="carrossel__paginas">
                      <Button
                        type="button"
                        text
                        rounded
                        class="carrossel__seta"
                        icon="ph ph-caret-left"
                        data-controle="anterior"
                        :aria-label="t('clinico.meuDia.carrossel.anterior')"
                        @click="irPara(pagina - 1, 'anterior')"
                      />
                      <Button
                        v-for="(outro, posicao) in noCartao"
                        :key="outro.id"
                        type="button"
                        text
                        rounded
                        class="carrossel__rosto"
                        :class="{ 'carrossel__rosto--atual': posicao === pagina }"
                        :aria-label="
                          t('clinico.meuDia.carrossel.ver', { pet: dia.pet(outro.petId)?.nome })
                        "
                        :aria-current="posicao === pagina || undefined"
                        :data-controle="`rosto-${posicao}`"
                        @click="irPara(posicao, `rosto-${posicao}`)"
                      >
                        <PetAvatar
                          :nome="dia.pet(outro.petId)?.nome ?? ''"
                          :iniciais="dia.pet(outro.petId)?.iniciais ?? ''"
                          :especie="dia.pet(outro.petId)?.especie ?? null"
                          :foto-url="dia.pet(outro.petId)?.fotoUrl ?? ''"
                          tamanho="sm"
                        />
                      </Button>
                      <Button
                        type="button"
                        text
                        rounded
                        class="carrossel__seta"
                        icon="ph ph-caret-right"
                        data-controle="proximo"
                        :aria-label="t('clinico.meuDia.carrossel.proximo')"
                        @click="irPara(pagina + 1, 'proximo')"
                      />
                    </div>
                  </div>
                </article>
              </template>
            </Carousel>

            <p v-if="noCartao.length > 1" class="so-leitor" aria-live="polite">
              {{
                t('clinico.meuDia.carrossel.posicao', { atual: pagina + 1, total: noCartao.length })
              }}
            </p>
          </section>

          <p v-else class="cartao paciente cartao--vazio">{{ t('clinico.meuDia.ninguemAgora') }}</p>
        </div>
      </div>
    </template>

    <div class="corpo">
      <!-- A fila: recepção e depois horários, de ponta a ponta, sem caixa. -->
      <section class="secao" aria-labelledby="foco-fila">
        <header class="secao__cabeca">
          <h2 id="foco-fila">{{ t('clinico.meuDia.fila') }}</h2>
          <span v-if="fila.length" class="contagem">{{ fila.length }}</span>
          <RouterLink class="secao__acao" to="/veterinario/agenda">
            {{ t('clinico.fila.aceite.verNaAgenda') }}
            <i class="ph ph-caret-right" aria-hidden="true" />
          </RouterLink>
        </header>

        <ul v-if="fila.length" class="lista">
          <li
            v-for="{ item, estado } in filaVisivel"
            :key="item.id"
            class="linha"
            :class="`linha--${estado}`"
          >
            <RouterLink
              class="linha__toque"
              :to="estado === 'espera' ? dia.rotaDoProntuario(item) : dia.focoNaAgenda(item.id)"
            >
              <PetAvatar
                :nome="dia.pet(item.petId)?.nome ?? ''"
                :iniciais="dia.pet(item.petId)?.iniciais ?? ''"
                :especie="dia.pet(item.petId)?.especie ?? null"
                :foto-url="dia.pet(item.petId)?.fotoUrl ?? ''"
                tamanho="md"
              />
              <span class="linha__texto">
                <strong>{{ dia.pet(item.petId)?.nome }}</strong>
                <span>{{ dia.linhaDoAtendimento(item) }}</span>
                <span
                  v-if="dia.alertasRelevantes(dia.pet(item.petId)).length"
                  class="linha__alerta"
                >
                  <i class="ph ph-warning" aria-hidden="true" />
                  {{
                    dia.alertasRelevantes(dia.pet(item.petId)).map(dia.textoDoAlerta).join(' · ')
                  }}
                </span>
              </span>

              <span v-if="estado === 'espera'" class="pilula-fria">
                {{ tempoDesde(item.chegadaEm, 'espera') }}
              </span>
              <!-- A hora no quadradinho em véu, como a lista de consultas da home do app. -->
              <span v-else class="linha__hora" :title="formato.status(item.status)">
                {{ formato.hora(item.inicio) }}
                <i
                  v-if="item.status === 'confirmado'"
                  class="ph ph-check"
                  :aria-label="formato.status(item.status)"
                />
              </span>
            </RouterLink>

            <Button
              v-if="estado === 'espera'"
              type="button"
              size="small"
              severity="secondary"
              class="linha__chamar"
              icon="ph ph-door-open"
              :label="t('clinico.hoje.chamar')"
              @click="dia.abrirProntuario(item)"
            />
          </li>
        </ul>
        <p v-else class="vazio">{{ t('clinico.meuDia.semProximo') }}</p>

        <Button
          v-if="filaEscondida > 0"
          type="button"
          class="mais"
          text
          :icon="filaAberta ? 'ph ph-caret-up' : 'ph ph-caret-down'"
          :label="
            filaAberta
              ? t('clinico.meuDia.pauta.mostrarMenos')
              : t('clinico.meuDia.pauta.mostrarMais', { total: filaEscondida })
          "
          :aria-expanded="filaAberta"
          @click="filaAberta = !filaAberta"
        />
      </section>

      <!-- O que pede ação: um painel em véu, o único bloco com fundo da tela. -->
      <aside class="secao lado" aria-labelledby="foco-pendencias">
        <header class="secao__cabeca">
          <h2 id="foco-pendencias">{{ t('inicio.pauta.titulo') }}</h2>
          <span v-if="dia.linhasDaPauta.length" class="contagem">
            {{ dia.linhasDaPauta.length }}
          </span>
        </header>

        <div class="painel">
          <ul v-if="dia.linhasDaPauta.length" class="lista">
            <li v-for="linha in pendenciasVisiveis" :key="linha.id" class="linha">
              <RouterLink class="linha__toque" :to="linha.to">
                <span class="icone-veu" :class="`icone-veu--${linha.tom}`" aria-hidden="true">
                  <component :is="ICONE_DO_TOM[linha.tom]" :size="22" weight="duotone" />
                </span>
                <span class="linha__texto">
                  <strong>
                    <span class="so-leitor">{{ t(`inicio.pauta.gravidade.${linha.tom}`) }}:</span>
                    {{ linha.frase }}
                  </strong>
                  <span class="linha__duas">
                    {{ [linha.detalhe, linha.onde].filter(Boolean).join(' · ') }}
                  </span>
                </span>
                <i class="ph ph-caret-right linha__seta" aria-hidden="true" />
              </RouterLink>
            </li>
          </ul>
          <p v-else class="vazio">{{ t('inicio.pauta.calma') }}</p>

          <Button
            v-if="pendenciasEscondidas > 0"
            type="button"
            class="mais"
            text
            :icon="pendenciasAbertas ? 'ph ph-caret-up' : 'ph ph-caret-down'"
            :label="
              pendenciasAbertas
                ? t('clinico.meuDia.pauta.mostrarMenos')
                : t('clinico.meuDia.pauta.mostrarMais', { total: pendenciasEscondidas })
            "
            :aria-expanded="pendenciasAbertas"
            @click="pendenciasAbertas = !pendenciasAbertas"
          />
        </div>
      </aside>
    </div>

    <template #sempre>
      <slot name="sempre" />
    </template>
  </UiPagina>
</template>

<style scoped>
/* Os botões do app moram no tema (`moldura-app.css`); aqui só o tamanho dos pequenos. */
.app-pj {
  /* Readex nos números também, como no app. */
  --font-dados: var(--font-texto);

  color: var(--app-tinta);
  font-family: var(--font-texto);
}

.app-pj .p-button {
  min-height: 44px;
  border-width: 0;
}

.app-pj .p-button.p-button-sm {
  min-height: 38px;
  border-radius: 12px;
}

/* ------------------------------------------------------------------------------ destaque */

/* A faixa (cor, desenhos, cantos) é a do `UiPagina`: aqui só o miolo dela. */
.destaque {
  min-width: 0;
}

/* Os dois cartões lado a lado e da mesma altura: o paciente à esquerda, o resumo à direita. */
.destaque__miolo {
  display: grid;
  align-items: stretch;
  gap: 18px;
  grid-template-areas: 'paciente resumo';
  grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr);
}

.paciente {
  grid-area: paciente;
}

.resumo {
  grid-area: resumo;
}

/*
 * O resumo do dia, em coluna: a frase e a data, o andamento, os números. Juntos e no meio do
 * cartão: quando o paciente ao lado é mais alto, a sobra vira margem igual em cima e embaixo, nunca
 * um vão entre os blocos nem um canto vazio.
 */
.resumo.resumo {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 16px;
}

.resumo__textos {
  display: grid;
  min-width: 0;
  gap: 4px;
}

.resumo__textos h1 {
  margin: 0;
  color: var(--app-tinta);
  font-size: 22px;
  font-weight: 700;
  letter-spacing: -0.4px;
  line-height: 1.25;
  text-wrap: balance;
}

.resumo__textos p {
  margin: 0;
  color: var(--app-texto-2);
  font-size: 14.5px;
  line-height: 1.4;
}

/* O andamento do dia: a barra fina na sálvia e a frase ao lado, numa linha. */
.resumo__andamento {
  display: flex;
  align-items: center;
  gap: 12px;
  color: var(--app-tinta);
  font-size: 14px;
  font-weight: 600;
}

.resumo__barra {
  display: block;
  overflow: hidden;
  width: 120px;
  height: 8px;
  flex: none;
  border-radius: 999px;
  background: var(--app-veu-forte);
}

.resumo__barra span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--app-salvia);
}

/* Os números numa fileira que ocupa a largura do cartão: ícone ao lado do valor, baixos. */
.numeros {
  display: grid;
  gap: 8px;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  margin: 0;
  padding: 0;
  list-style: none;
}

.numeros li {
  display: flex;
  min-width: 0;
}

.numero {
  position: relative;
  display: flex;
  min-width: 0;
  flex: 1;
  align-items: center;
  gap: 8px;
  padding: 10px;
  border-radius: 16px;
  background: var(--app-veu);
  color: var(--app-tinta);
  text-decoration: none;
  transition: background-color 150ms ease-out;
}

.numero:hover {
  background: var(--app-veu-forte);
}

.numero:focus-visible {
  outline: 2px solid var(--app-salvia-texto);
  outline-offset: 2px;
}

.numero__icone {
  display: grid;
  width: 34px;
  height: 34px;
  flex: none;
  place-items: center;
  border-radius: 11px;
  background: var(--app-fundo);
  color: var(--app-salvia-texto);
  font-size: 18px;
}

.numero__textos {
  display: grid;
  min-width: 0;
}

.numero strong {
  font-size: 22px;
  font-variant-numeric: tabular-nums;
  font-weight: 700;
  line-height: 1.1;
}

/*
 * O rótulo quebra em vez de cortar: com três números lado a lado no cartão do resumo, "Na
 * recepção" e "Em consulta" viravam "Na recepç…" e "Em consu…" já em 1440.
 */
.numero .numero__rotulo {
  color: var(--app-texto-2);
  font-size: 12.5px;
  font-weight: 600;
  line-height: 1.25;
  overflow-wrap: break-word;
}

/* Número que é alerta: um ponto no canto, na cor do estado (o rótulo diz o que é). */
.numero .numero__ponto {
  position: absolute;
  top: 9px;
  right: 9px;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--app-tinta);
}

.numero .numero__ponto--risco {
  background: var(--risco-tinta);
}

/* O paciente da vez: papel branco dentro do destaque, com a tinta do app. */
.cartao {
  display: grid;
  gap: 14px;
  margin: 0;
  padding: 20px 22px;
  border-radius: 22px;
  background: var(--app-cartao);
  color: var(--app-tinta);
}

.cartao--vazio {
  font-size: 15px;
}

.cartao--esqueleto {
  min-height: 210px;
  align-content: center;
}

/* O nome numa linha só (nome longo corta), a idade embaixo e o tempo de sala à direita. */
.cartao__quem {
  display: flex;
  align-items: center;
  gap: 14px;
}

.cartao__rosto {
  display: grid;
  flex: none;
  padding: 3px;
  border-radius: 50%;
  background: var(--app-veu-forte);
}

.cartao__nome {
  display: grid;
  min-width: 0;
  flex: 1;
  gap: 2px;
}

.cartao__nome h2,
.cartao__nome p {
  overflow: hidden;
  margin: 0;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cartao__nome h2 {
  font-size: 22px;
  font-weight: 700;
  letter-spacing: -0.4px;
  line-height: 1.2;
}

.cartao__nome p {
  color: var(--app-texto-2);
  font-size: 14px;
}

.cartao__estado {
  display: inline-flex;
  min-height: 32px;
  flex: none;
  align-items: center;
  gap: 7px;
  padding: 0 13px;
  border-radius: 999px;
  background: var(--app-veu-forte);
  color: var(--app-salvia-texto);
  font-size: 13.5px;
  font-variant-numeric: tabular-nums;
  font-weight: 700;
  white-space: nowrap;
}

/* Os fatos: uma linha de texto com ícone, sem pílula. Cada um corta antes de empurrar o outro. */
.cartao__fatos {
  display: flex;
  min-width: 0;
  flex-wrap: wrap;
  gap: 4px 18px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.cartao__fatos li {
  display: inline-flex;
  min-width: 0;
  max-width: 100%;
  align-items: center;
  gap: 7px;
  color: var(--app-texto-2);
  font-size: 14px;
}

.cartao__fatos li i {
  flex: none;
  color: var(--app-salvia-texto);
  font-size: 16px;
}

.cartao__fatos li span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cartao__alertas {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}

/* O alerta em selo pastel: atenção em âmbar claro, risco em rosa claro, com a tinta da família. */
.cartao__alerta {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 30px;
  padding: 3px 12px;
  border-radius: 999px;
  background: var(--atencao-fundo);
  color: var(--atencao-tinta);
  font-size: 13.5px;
  font-weight: 700;
}

.cartao__alerta--risco {
  background: var(--risco-fundo);
  color: var(--risco-tinta);
}

.cartao__acoes {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}

/* A ação principal é o botão cheio do app; a de apoio, o mesmo tamanho em véu. */
.app-pj .cartao__principal {
  min-height: 48px;
  padding-inline: 20px;
  font-size: 15px;
}

.cartao__secundario {
  display: inline-flex;
  min-height: 48px;
  flex: none;
  align-items: center;
  gap: 8px;
  padding: 0 18px;
  border-radius: 16px;
  background: var(--app-veu);
  color: var(--app-salvia-texto);
  font-size: 15px;
  font-weight: 700;
  text-decoration: none;
  transition: background-color 150ms ease-out;
}

.cartao__secundario:hover {
  background: var(--app-veu-forte);
}

.cartao__secundario:focus-visible {
  outline: 2px solid var(--app-tinta);
  outline-offset: 2px;
}

.cartao__secundario i {
  font-size: 18px;
}

/* -------------------------------------------------------------------------- carrossel */

/*
 * O carrossel ocupa a célula inteira, e cada cartão a altura do maior: trocar de paciente não faz
 * o destaque pular. A viewport corta nos cantos do cartão.
 */
.carrossel {
  display: flex;
  min-width: 0;
  flex-direction: column;
}

.carrossel__trilho,
.carrossel :deep(.p-carousel-content-container),
.carrossel :deep(.p-carousel-content),
.carrossel :deep(.p-carousel-viewport) {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
}

.carrossel :deep(.p-carousel-content-container) {
  overflow: hidden;
}

.carrossel :deep(.p-carousel-viewport) {
  border-radius: 22px;
}

.carrossel :deep(.p-carousel-item-list) {
  flex: 1;
  align-items: stretch;

  /* O PrimeVue anda em 500 ms: aqui é a troca de um cartão, 200 ms bastam. */
  transition-duration: 200ms !important;
  transition-timing-function: ease-out !important;
}

.carrossel :deep(.p-carousel-item) {
  display: flex;
}

/*
 * A altura é a do paciente aberto, não a do mais alto do carrossel: o cartão fechado não ocupa
 * altura (só a largura, para o deslize). Assim quem tem pouco a dizer não fica com um vão no meio.
 * Ao lado do resumo o cartão estica até a altura da fileira; a pouca sobra fica antes das ações.
 */
.carrossel .cartao {
  display: flex;
  flex: 1;
  flex-direction: column;
}

.carrossel .cartao[inert] {
  max-height: 0;
  padding-block: 0;
  overflow: hidden;
}

.carrossel .cartao__acoes {
  margin-top: auto;
}

/* Os rostos de quem está na sala, no canto do pé: a paginação diz quem mais está lá dentro. */
.carrossel__paginas {
  display: flex;
  align-items: center;
  gap: 2px;
  margin-inline-start: auto;
}

.app-pj .carrossel__seta {
  width: 36px;
  min-height: 36px;
  height: 36px;
  color: var(--app-salvia-texto);
}

.app-pj .carrossel__rosto {
  width: 40px;
  min-height: 40px;
  height: 40px;
  padding: 0;
  opacity: 0.55;
  transition: opacity 150ms ease-out;
}

.app-pj .carrossel__rosto:hover {
  opacity: 0.85;
}

/* O rosto aberto: inteiro e com o anel na cor do perfil (a forma marca, não só a cor). */
.app-pj .carrossel__rosto--atual,
.app-pj .carrossel__rosto--atual:hover {
  box-shadow:
    0 0 0 2px var(--app-cartao),
    0 0 0 4px var(--app-destaque) !important;
  opacity: 1;
}

@media (prefers-reduced-motion: reduce) {
  .carrossel :deep(.p-carousel-item-list) {
    transition: none !important;
  }
}

/* -------------------------------------------------------------------------------- corpo */

.corpo {
  display: grid;
  align-items: start;
  gap: 36px 40px;
  grid-template-columns: minmax(0, 1fr) clamp(320px, 32%, 560px);
  padding: 12px 0 0;
}

.secao {
  display: grid;
  min-width: 0;
  gap: 6px;
}

.secao__cabeca {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 34px;
}

.secao__cabeca h2 {
  margin: 0;
  color: var(--app-tinta);
  font-size: 17px;
  font-weight: 700;
}

.secao__acao {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-inline-start: auto;
  border-radius: 8px;
  color: var(--app-salvia-texto);
  font-size: 14px;
  font-weight: 700;
  text-decoration: none;
}

.secao__acao:hover {
  text-decoration: underline;
  text-underline-offset: 3px;
}

.secao__acao:focus-visible {
  outline: 2px solid var(--app-salvia-texto);
  outline-offset: 2px;
}

.contagem {
  display: inline-grid;
  min-width: 26px;
  height: 24px;
  padding: 0 8px;
  place-items: center;
  border-radius: 999px;
  background: var(--app-veu);
  color: var(--app-salvia-texto);
  font-size: 13px;
  font-weight: 700;
}

.lado {
  position: sticky;
  top: 20px;
}

/* ------------------------------------------------------------------- lista de ponta a ponta */

.lista {
  display: grid;
  margin: 0;
  padding: 0;
  list-style: none;
}

.linha {
  position: relative;
  display: flex;
  align-items: center;
}

/* A régua do app começa no texto, não na borda: avatar de 40 mais o vão de 14. */
.linha + .linha::before {
  position: absolute;
  top: 0;
  right: 0;
  left: 54px;
  height: 1px;
  background: var(--app-regua);
  content: '';
}

.painel .linha + .linha::before {
  left: 54px;
}

.linha__toque {
  display: flex;
  min-width: 0;
  min-height: 72px;
  flex: 1;
  align-items: center;
  gap: 14px;
  padding: 12px 0;
  border-radius: 14px;
  color: var(--app-tinta);
  text-decoration: none;
  transition: background-color 150ms ease-out;
}

.linha__toque:hover {
  background: var(--app-toque);
}

.linha__toque:focus-visible {
  outline: 2px solid var(--app-salvia-texto);
  outline-offset: 2px;
}

.linha__texto {
  display: grid;
  min-width: 0;
  flex: 1;
  gap: 2px;
}

.linha__texto strong {
  overflow: hidden;
  color: var(--app-tinta);
  font-size: 15.5px;
  font-weight: 600;
  line-height: 1.3;
  text-overflow: ellipsis;
}

.linha__texto > span {
  overflow: hidden;
  color: var(--app-texto-2);
  font-size: 13px;
  line-height: 1.4;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Alerta na linha: marinho, a cor de "atenção" do app; nunca pêssego. */
.linha .linha__alerta {
  color: var(--app-tinta);
  font-weight: 600;
}

.linha__alerta i {
  margin-inline-end: 4px;
  vertical-align: -2px;
}

.linha__duas {
  display: -webkit-box !important;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  white-space: normal !important;
}

/* A hora no quadradinho em véu, como a lista de consultas da home do app. */
.linha__hora {
  display: inline-flex;
  min-width: 64px;
  height: 40px;
  flex: none;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 0 10px;
  border-radius: 13px;
  background: var(--app-veu);
  color: var(--app-salvia-texto);
  font-size: 14px;
  font-variant-numeric: tabular-nums;
  font-weight: 700;
}

.linha__seta {
  flex: none;
  color: var(--app-texto-2);
  font-size: 18px;
}

/* Quem espera: a pílula fria do app (marinho sobre cinza frio) no lugar da hora. */
.pilula-fria {
  display: inline-flex;
  min-height: 30px;
  flex: none;
  align-items: center;
  padding: 0 12px;
  border-radius: 999px;
  background: var(--app-fria);
  color: var(--app-tinta);
  font-size: 13px;
  font-variant-numeric: tabular-nums;
  font-weight: 700;
}

.linha__chamar {
  flex: none;
  margin-inline-start: 12px;
}

.mais {
  justify-self: start;
}

.vazio {
  margin: 0;
  padding: 22px 0;
  color: var(--app-texto-2);
  font-size: 14.5px;
}

/* ------------------------------------------------------------------------ painel em véu */

.painel {
  display: grid;
  padding: 6px 16px 8px;
  border-radius: 22px;
  background: var(--app-veu);
}

.painel .linha__toque {
  min-height: 0;
  align-items: flex-start;
  padding: 14px 0;
}

.painel .linha__seta {
  align-self: center;
}

.painel .vazio {
  padding: 18px 4px;
}

/* O quadradinho de ícone do app: 40 px, cantos de 13, ícone duotone sobre o véu do estado. */
.icone-veu {
  display: grid;
  width: 40px;
  height: 40px;
  flex: none;
  place-items: center;
  border-radius: 13px;
  background: var(--app-fundo);
  color: var(--app-salvia-texto);
}

.icone-veu--risco {
  background: var(--app-risco-veu);
  color: var(--app-risco);
}

.icone-veu--atencao {
  background: var(--app-fria);
  color: var(--app-tinta);
}

.so-leitor {
  position: absolute;
  overflow: hidden;
  width: 1px;
  height: 1px;
  clip-path: inset(50%);
  white-space: nowrap;
}

/* ---------------------------------------------------------------------------- estreito */

/*
 * Cada cartão precisa de uns 480 px: abaixo disso eles empilham, o resumo em cima. A conta é pela
 * largura do destaque, não da janela: com a barra recolhida cabe lado a lado mais cedo.
 */
@container faixa (max-width: 1060px) {
  .destaque__miolo {
    grid-template-areas:
      'resumo'
      'paciente';
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 1180px) {
  .corpo {
    grid-template-columns: minmax(0, 1fr);
  }

  .lado {
    position: static;
    order: -1;
  }
}
</style>
