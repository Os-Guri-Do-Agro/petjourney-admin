<script setup lang="ts">
/**
 * Como os bichos estão, agora — e o remédio de hoje.
 *
 * ## Por que este bloco existe
 *
 * O painel responde "quem chega, quem está, quem sai, o que trava" — tudo movimento e papelada.
 * O domínio sabe mais três coisas que justificam um hotel de animais: **quem está estressado**,
 * **que medicação vence hoje** e **que cuidado está em aberto**.
 *
 * ## A forma (redesenho total, 19/10/2026)
 *
 * Uma seção calma, no pé do painel: título no fundo, dois cartões lado a lado. À esquerda a
 * adaptação — estressado e em adaptação viram **nome, acomodação e caminho**; tranquilo vira só um
 * número, para que o total feche sem ocupar a tela com ausência de notícia. À direita a medicação
 * e os cuidados do dia, em ordem de relógio, cada linha com a situação em palavra.
 *
 * ## Por que a medicação sai da prancheta, e não da estadia
 *
 * `MedicacaoDaEstadia` mora em `EstadiaDetalhada`, carregada **uma estadia por vez**. A prancheta
 * do dia já está carregada, já é por casa, e a dose que ela mostra é a mesma que o canil executa:
 * ler de outro lugar seria arriscar divergência entre o que o painel promete e o que a prancheta
 * cobra.
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

import UiSecao from '@/components/ui/UiSecao.vue'

import PetAvatar from '../base/PetAvatar.vue'
import { useHotelFormat } from '../../composables/useHotelFormat'
import type { HospedeNaCasa, TarefaNaPrancheta } from '../../data/repositories'
import type { Adaptacao, ISODateTime, SituacaoDaTarefa } from '../../data/types'
import { situacaoDaTarefa } from '../../domain/rotina'

const props = defineProps<{
  hospedes: HospedeNaCasa[]
  prancheta: TarefaNaPrancheta[]
  /** Instante de agora, para separar a dose que passou da que ainda vem. */
  agora: ISODateTime
}>()

const { t } = useI18n()
const formato = useHotelFormat()

/**
 * Os estados que ganham nome na tela, na ordem em que importam.
 *
 * `tranquilo` fica de fora de propósito: ele é contado no rodapé, não listado.
 */
const ESTADOS_DE_ATENCAO = ['estressado', 'em-adaptacao'] as const satisfies readonly Adaptacao[]

type EstadoDeAtencao = (typeof ESTADOS_DE_ATENCAO)[number]

/**
 * O rótulo de cada estado, com a chave escrita por inteiro dentro do `t()`: chave montada por
 * interpolação some do varredor de traduções, e a varredura de plurais só reconhece a chave
 * dentro da própria chamada.
 */
function rotuloDoEstado(estado: EstadoDeAtencao, total: number) {
  return estado === 'estressado'
    ? t('hotel.painel.bemEstar.estado.estressado', {}, total)
    : t('hotel.painel.bemEstar.estado.em-adaptacao', {}, total)
}

type GrupoDeAdaptacao = { estado: EstadoDeAtencao; hospedes: HospedeNaCasa[] }

const adaptacao = computed<GrupoDeAdaptacao[]>(() =>
  ESTADOS_DE_ATENCAO.map((estado) => ({
    estado,
    hospedes: props.hospedes.filter((h) => h.hospedagem.adaptacao === estado),
  })).filter((grupo) => grupo.hospedes.length > 0),
)

const tranquilos = computed(
  () => props.hospedes.filter((h) => h.hospedagem.adaptacao === 'tranquilo').length,
)

/**
 * As doses de hoje, em ordem de relógio.
 *
 * Recusada e pulada entram: a dose que alguém decidiu não dar é informação clínica, e sumir com
 * ela do painel é o mesmo que fingir que o dia correu limpo.
 */
const doses = computed(() =>
  props.prancheta
    .filter((linha) => linha.tarefa.kind === 'medicacao')
    .slice()
    .sort((a, b) => a.tarefa.previstaPara.localeCompare(b.tarefa.previstaPara)),
)

const dosesPendentes = computed(
  () => doses.value.filter((linha) => linha.tarefa.status === 'pendente').length,
)

/** Cuidado é o que não é remédio nem serviço: curativo, compressa, observação de ferida. */
const cuidados = computed(() =>
  props.prancheta.filter(
    (linha) => linha.tarefa.kind === 'cuidado' && linha.tarefa.status === 'pendente',
  ),
)

/** A situação em palavra e em tom. Feita é verde; atrasada, vermelha; na hora, âmbar. */
const TOM_DA_SITUACAO: Record<SituacaoDaTarefa, string> = {
  feita: 'ui-selo--ok',
  atrasada: 'ui-selo--risco',
  'na-janela': 'ui-selo--atencao',
  futura: 'ui-selo--contorno',
  recusada: '',
  pulada: '',
}

function situacao(linha: TarefaNaPrancheta) {
  return situacaoDaTarefa(linha.tarefa, props.agora)
}

function rotaDaEstadia(hospedagemId: string): string {
  return `/hotel/hospedagem/${hospedagemId}`
}
</script>

<template>
  <UiSecao :titulo="t('hotel.painel.bemEstar.titulo')" icone="ph ph-heart">
    <div class="bem">
      <!-- ------------------------------------------------------------------ adaptação -->
      <section class="assunto ui-folha" aria-labelledby="bem-adaptacao">
        <header class="assunto__cabeca">
          <span class="ui-ladrilho" aria-hidden="true">
            <i class="ph ph-smiley" />
          </span>
          <h3 id="bem-adaptacao" class="assunto__titulo">
            {{ t('hotel.painel.bemEstar.adaptacao') }}
          </h3>
        </header>

        <div class="assunto__corpo">
          <p v-if="adaptacao.length === 0" class="assunto__calmo">
            <i class="ph ph-smiley" aria-hidden="true" />
            {{ t('hotel.painel.bemEstar.todosTranquilos', { total: tranquilos }, tranquilos) }}
          </p>

          <template v-else>
            <div v-for="grupo in adaptacao" :key="grupo.estado" class="grupo">
              <p class="grupo__estado" :class="`grupo__estado--${grupo.estado}`">
                <span class="grupo__ponto" aria-hidden="true" />
                <strong class="ui-num">{{ grupo.hospedes.length }}</strong>
                {{ rotuloDoEstado(grupo.estado, grupo.hospedes.length) }}
              </p>

              <ul class="bichos">
                <li v-for="hospede in grupo.hospedes" :key="hospede.hospedagem.id">
                  <RouterLink class="bicho" :to="rotaDaEstadia(hospede.hospedagem.id)">
                    <PetAvatar
                      :nome="hospede.petNome"
                      :iniciais="hospede.petIniciais"
                      :especie="hospede.petEspecie"
                      :foto-url="hospede.petFotoUrl"
                      tamanho="sm"
                    />
                    <span class="bicho__nome">{{ hospede.petNome }}</span>
                    <span class="bicho__onde">{{ hospede.acomodacaoNome }}</span>
                  </RouterLink>
                </li>
              </ul>
            </div>

            <p v-if="tranquilos > 0" class="assunto__rodape">
              <i class="ph ph-smiley" aria-hidden="true" />
              {{ t('hotel.painel.bemEstar.demaisTranquilos', { total: tranquilos }, tranquilos) }}
            </p>
          </template>
        </div>
      </section>

      <!--
        Medicação e cuidado dividem o cartão da direita porque nascem da mesma fonte — a prancheta
        do dia — e se leem do mesmo jeito: hora, quem, o quê, e a situação.
      -->
      <section class="assunto ui-folha" aria-labelledby="bem-medicacao">
        <header class="assunto__cabeca">
          <span class="ui-ladrilho" aria-hidden="true">
            <i class="ph ph-pill" />
          </span>
          <h3 id="bem-medicacao" class="assunto__titulo">
            {{ t('hotel.painel.bemEstar.medicacao') }}
          </h3>
          <span v-if="doses.length" class="assunto__contagem">
            {{
              t('hotel.painel.bemEstar.dosesPendentes', { total: dosesPendentes }, dosesPendentes)
            }}
          </span>
        </header>

        <ul v-if="doses.length" class="doses">
          <li v-for="linha in doses" :key="linha.tarefa.id">
            <RouterLink
              class="dose"
              :class="`dose--${situacao(linha)}`"
              :to="rotaDaEstadia(linha.hospedagemId)"
            >
              <span class="ui-hora dose__hora">{{ formato.hora(linha.tarefa.previstaPara) }}</span>
              <PetAvatar
                :nome="linha.petNome"
                :iniciais="linha.petIniciais"
                :especie="linha.petEspecie"
                :foto-url="linha.petFotoUrl"
                tamanho="sm"
              />
              <span class="dose__texto">
                <strong>{{ linha.petNome }}</strong>
                <span>{{ linha.tarefa.descricao }}</span>
              </span>
              <span class="ui-selo" :class="TOM_DA_SITUACAO[situacao(linha)]">
                {{ formato.situacaoDaTarefa(situacao(linha)) }}
              </span>
            </RouterLink>
          </li>
        </ul>
        <p v-else class="assunto__calmo assunto__calmo--lista">
          {{ t('hotel.hoje.bemEstar.semMedicacao') }}
        </p>

        <template v-if="cuidados.length > 0">
          <h4 class="assunto__subtitulo">
            {{ t('hotel.painel.bemEstar.cuidados') }}
          </h4>

          <ul class="doses">
            <li v-for="linha in cuidados" :key="linha.tarefa.id">
              <RouterLink class="dose" :to="rotaDaEstadia(linha.hospedagemId)">
                <span class="ui-hora dose__hora">{{
                  formato.hora(linha.tarefa.previstaPara)
                }}</span>
                <PetAvatar
                  :nome="linha.petNome"
                  :iniciais="linha.petIniciais"
                  :especie="linha.petEspecie"
                  :foto-url="linha.petFotoUrl"
                  tamanho="sm"
                />
                <span class="dose__texto">
                  <strong>{{ linha.petNome }}</strong>
                  <span>{{ linha.tarefa.descricao }}</span>
                </span>
                <span class="ui-selo" :class="TOM_DA_SITUACAO[situacao(linha)]">
                  {{ formato.situacaoDaTarefa(situacao(linha)) }}
                </span>
              </RouterLink>
            </li>
          </ul>
        </template>
      </section>
    </div>
  </UiSecao>
</template>

<style scoped>
/*
 * Dois cartões lado a lado, cada um com o cabeçalho do assunto: como os bichos estão, e o que a
 * prancheta pede de remédio e cuidado hoje.
 */
.bem {
  display: grid;
  align-items: start;
  gap: 20px;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 380px), 1fr));
}

.assunto {
  display: flex;
  min-width: 0;
  flex-direction: column;
}

.assunto__cabeca {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 20px 14px;
  border-bottom: 1px solid var(--linha-suave);
}

.assunto__titulo {
  flex: 1;
  margin: 0;
  color: var(--tinta);
  font-size: 15.5px;
  font-weight: 650;
  letter-spacing: -0.01em;
}

.assunto__corpo {
  display: grid;
  gap: 16px;
  padding: 16px 20px 20px;
}

.assunto__contagem {
  color: var(--tinta-2);
  font-size: 13px;
  font-weight: 500;
}

.assunto__subtitulo {
  margin: 0;
  padding: 14px 20px 6px;
  border-top: 1px solid var(--linha-suave);
  color: var(--tinta-2);
  font-size: 13.5px;
  font-weight: 600;
}

.assunto__rodape,
.assunto__calmo {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  color: var(--tinta-2);
  font-size: 13.5px;
}

.assunto__rodape i,
.assunto__calmo i {
  color: var(--ok-tinta);
  font-size: 18px;
}

.assunto__calmo--lista {
  padding: 20px;
}

/* ------------------------------------------------------------------ adaptação */

.grupo {
  display: grid;
  gap: 10px;
}

.grupo__estado {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin: 0;
  font-size: 13.5px;
  font-weight: 600;
}

/* O ponto carrega o estado; a palavra ao lado diz qual. */
.grupo__ponto {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: currentColor;
  box-shadow: 0 0 0 3px color-mix(in oklab, currentColor 16%, transparent);
}

.grupo__estado--estressado {
  color: var(--risco-tinta);
}

.grupo__estado--em-adaptacao {
  color: var(--atencao-tinta);
}

.bichos {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.bicho {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 40px;
  padding: 5px 14px 5px 6px;
  border: 1px solid var(--linha);
  border-radius: 999px;
  background: var(--superficie);
  box-shadow: var(--sombra-xs);
  color: var(--tinta);
  text-decoration: none;
  transition:
    background-color var(--pj-tempo-curto) ease,
    border-color var(--pj-tempo-curto) ease;
}

.bicho:hover {
  border-color: var(--linha-media);
  background: var(--superficie-2);
}

.bicho:focus-visible {
  outline: 2px solid var(--pj-lugar, var(--hotel));
  outline-offset: 2px;
}

.bicho__nome {
  font-size: 14px;
  font-weight: 600;
}

.bicho__onde {
  color: var(--tinta-2);
  font-size: 13px;
}

/* ------------------------------------------------------------------ doses e cuidados */

.doses {
  display: grid;
  margin: 0;
  padding: 0;
  list-style: none;
}

.doses > li + li {
  border-top: 1px solid var(--linha-suave);
}

.dose {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 60px;
  padding: 8px 20px;
  color: var(--tinta);
  text-decoration: none;
  transition: background-color var(--pj-tempo-curto) ease;
}

.doses:last-child > li:last-child .dose {
  border-radius: 0 0 calc(var(--raio-cartao) - 1px) calc(var(--raio-cartao) - 1px);
}

.dose:hover {
  background: var(--superficie-2);
}

.dose:focus-visible {
  outline: 2px solid var(--pj-lugar, var(--hotel));
  outline-offset: -2px;
}

.dose__hora {
  width: 44px;
  flex: none;
}

.dose__texto {
  display: grid;
  flex: 1;
  min-width: 0;
  gap: 1px;
}

.dose__texto strong {
  font-size: 14px;
  font-weight: 600;
}

.dose__texto span {
  overflow: hidden;
  color: var(--tinta-2);
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* A dose que já saiu do caminho perde o peso: às 14h o olho procura a próxima, não relê a das 8h. */
.dose--feita .dose__hora,
.dose--feita .dose__texto strong {
  color: var(--tinta-2);
  font-weight: 500;
}

@media (prefers-reduced-motion: reduce) {
  .bicho,
  .dose {
    transition: none;
  }
}
</style>
