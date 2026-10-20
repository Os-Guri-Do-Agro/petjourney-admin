<script setup lang="ts">
/**
 * Uma linha da prancheta.
 *
 * Três decisões, e todas vêm de a tela ser usada **em pé, com uma mão, no corredor do canil**:
 *
 * 1. **Marcar custa um toque.** "Feita" é o botão da linha, grande o bastante para o polegar, e
 *    fica sempre na ponta do grupo — cai no mesmo lugar em toda linha. As outras duas saídas ficam
 *    ao lado, mais leves, porque são raras.
 * 2. **Recusar não é pular.** Pular é decisão da casa; recusar é o animal não ter comido, e isso é
 *    informação clínica que alimenta o boletim. Duas ações separadas, nunca um menu com as duas.
 * 3. **O atraso é calculado, não gravado.** A cor muda sozinha com o relógio, e volta ao normal no
 *    instante em que alguém marca.
 *
 * ## As duas formas (redesenho total, 19/10/2026)
 *
 * - **Sozinha** (a tarefa de um animal só, e a rotina da estadia): abre com o ícone do serviço num
 *   disco que diz a situação — lavanda na hora, âmbar atrasada, vermelho cheio para remédio
 *   atrasado, apagado quando já foi feita. Embaixo, o que fazer e o rosto do animal com a
 *   acomodação. A marca na borda e o selo com a palavra repetem a situação: nunca só cor.
 * - **Dentro de uma ronda**: o cabeçalho da ronda já disse o serviço, a hora e quantas atrasaram.
 *   A linha abre com o **rosto** do animal — a única coisa que muda de uma linha para a outra — e
 *   o nome sobe a título.
 *
 * "Feita" é cheio quando a tarefa cobra ação agora (na hora ou atrasada) e contornado quando ainda
 * vai chegar: o botão cheio diz "é a vez desta", e uma coluna de botões cheios até as 22h deixaria
 * de dizer.
 */
import Button from 'primevue/button'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import HotelSelo from '../base/HotelSelo.vue'
import IconeDeTarefa from '../base/IconeDeTarefa.vue'
import PetAvatar from '../base/PetAvatar.vue'
import { useHotelFormat } from '../../composables/useHotelFormat'
import type { PetSpecies, SituacaoDaTarefa, TarefaDeRotina, TarefaStatus } from '../../data/types'

const props = withDefaults(
  defineProps<{
    tarefa: TarefaDeRotina
    situacao: SituacaoDaTarefa
    /** Nome do hóspede e da acomodação. Vazios na aba da estadia, onde já se sabe de quem é. */
    petNome?: string
    petIniciais?: string
    petEspecie?: PetSpecies | null
    petFotoUrl?: string
    acomodacaoNome?: string
    salvando?: boolean
    /**
     * O horário previsto, quando é esta linha que precisa dizê-lo. Na prancheta a hora mora na
     * coluna da linha do tempo e isto fica vazio; serve a quem usa a linha fora dela.
     */
    hora?: string
    /**
     * Esta linha vive dentro de uma ronda que já tem cabeçalho: o serviço, o disco e o selo de
     * atraso saem (o cabeçalho já disse), e quem abre a linha é o rosto do animal.
     *
     * O selo de **recusa nunca sai**: recusa é por animal, varia dentro da mesma ronda, e é
     * justamente a informação que ninguém pode perder de vista.
     */
    dentroDaRonda?: boolean
  }>(),
  {
    petNome: '',
    petIniciais: '',
    petEspecie: null,
    petFotoUrl: '',
    acomodacaoNome: '',
    salvando: false,
    hora: '',
    dentroDaRonda: false,
  },
)

const emit = defineEmits<{
  marcar: [payload: { tarefaId: string; status: TarefaStatus }]
}>()

const { t } = useI18n()
const formato = useHotelFormat()

const resolvida = computed(() => props.tarefa.status !== 'pendente')

/** Cobra ação agora: é o que deixa o "Feita" cheio. */
const daVez = computed(() => props.situacao === 'na-janela' || props.situacao === 'atrasada')

/** Remédio atrasado é o único atraso em vermelho; o resto atrasado é atenção. */
const remedioAtrasado = computed(
  () => props.situacao === 'atrasada' && props.tarefa.kind === 'medicacao',
)

/**
 * O selo desta linha, se algum, com a palavra e o tom.
 *
 * Resolvida, diz o desfecho — feita, pulada, recusou. Pendente e sozinha, diz o atraso ou que é
 * a hora. Dentro de uma ronda o atraso sai: as pendentes de uma ronda partilham o horário, logo a
 * situação, e o cabeçalho conta quantas são uma vez só.
 */
type Selo = {
  rotulo: string
  tom: 'atencao' | 'risco' | 'acento' | 'positivo' | 'neutro'
  icone: string
}

const selo = computed<Selo | null>(() => {
  const rotulo = formato.situacaoDaTarefa(props.situacao)

  if (props.situacao === 'recusada') return { rotulo, tom: 'atencao', icone: 'ph ph-hand-palm' }
  if (props.situacao === 'feita') return { rotulo, tom: 'positivo', icone: 'ph ph-check' }

  if (props.situacao === 'pulada') {
    return { rotulo, tom: 'neutro', icone: 'ph ph-arrow-bend-up-right' }
  }

  if (props.dentroDaRonda) return null

  if (props.situacao === 'atrasada') {
    return {
      rotulo,
      tom: remedioAtrasado.value ? 'risco' : 'atencao',
      icone: 'ph ph-clock-countdown',
    }
  }

  return props.situacao === 'na-janela' ? { rotulo, tom: 'acento', icone: '' } : null
})

/** A marca de gravidade na borda: só na linha sozinha e pendente. A ronda leva a dela. */
const marca = computed(() => {
  if (props.dentroDaRonda || resolvida.value) return ''
  if (remedioAtrasado.value) return 'ui-marca ui-marca--risco'
  if (props.situacao === 'atrasada') return 'ui-marca ui-marca--atencao'

  return props.situacao === 'na-janela' ? 'ui-marca ui-marca--lugar' : ''
})

/** O ícone do disco: o do serviço enquanto falta; o do desfecho quando já foi resolvida. */
const iconeDoDesfecho = computed(() => {
  if (props.tarefa.status === 'feita') return 'ph ph-check'
  if (props.tarefa.status === 'recusada') return 'ph ph-hand-palm'

  return props.tarefa.status === 'pulada' ? 'ph ph-arrow-bend-up-right' : ''
})

/**
 * A hora em que foi marcada, e **só quando ela discorda da hora prevista**. A ração das 07:00
 * servida às 09:40 conta uma manhã atribulada; a das 07:00 servida às 07:00 não conta nada.
 */
const horaFora = computed(() => {
  if (!resolvida.value || !props.tarefa.executadaEm) return ''

  const marcada = formato.hora(props.tarefa.executadaEm)

  return marcada === formato.hora(props.tarefa.previstaPara) ? '' : marcada
})

/** Dentro da ronda, a acomodação e o que fazer dividem a linha de baixo. */
const metaNaRonda = computed(() =>
  [props.acomodacaoNome, props.tarefa.descricao].filter(Boolean).join(' · '),
)
</script>

<template>
  <li
    class="tarefa"
    :class="[
      `tarefa--${situacao}`,
      `tarefa--kind-${tarefa.kind}`,
      marca,
      {
        'tarefa--resolvida': resolvida,
        'tarefa--na-ronda': dentroDaRonda,
        'tarefa--remedio-atrasado': remedioAtrasado,
      },
    ]"
  >
    <div class="tarefa__linha" :class="{ 'tarefa__linha--com-hora': !!hora }">
      <span v-if="hora" class="tarefa__hora ui-hora">{{ hora }}</span>

      <!-- Dentro da ronda abre o rosto; sozinha, o serviço num disco que diz a situação. -->
      <span v-if="dentroDaRonda && petNome" class="tarefa__rosto">
        <PetAvatar
          :nome="petNome"
          :iniciais="petIniciais"
          :especie="petEspecie"
          :foto-url="petFotoUrl"
          tamanho="md"
        />
      </span>
      <span v-else class="tarefa__icone" aria-hidden="true">
        <i v-if="iconeDoDesfecho" :class="iconeDoDesfecho" />
        <IconeDeTarefa v-else :kind="tarefa.kind" />
      </span>

      <div class="tarefa__corpo">
        <p class="tarefa__titulo">
          <strong>{{
            dentroDaRonda && petNome ? petNome : formato.tarefaKind(tarefa.kind)
          }}</strong>
          <HotelSelo v-if="selo" :rotulo="selo.rotulo" :tom="selo.tom" :icone="selo.icone" />
        </p>

        <template v-if="dentroDaRonda && petNome">
          <p v-if="metaNaRonda" class="tarefa__meta">{{ metaNaRonda }}</p>
        </template>

        <template v-else>
          <p v-if="tarefa.descricao" class="tarefa__oque">{{ tarefa.descricao }}</p>

          <p v-if="petNome" class="tarefa__pet">
            <PetAvatar
              :nome="petNome"
              :iniciais="petIniciais"
              :especie="petEspecie"
              :foto-url="petFotoUrl"
              tamanho="sm"
            />
            <span class="tarefa__pet-nome">{{ petNome }}</span>
            <span v-if="acomodacaoNome" class="tarefa__onde">{{ acomodacaoNome }}</span>
          </p>
        </template>

        <p v-if="tarefa.observacao" class="tarefa__observacao">
          <i class="ph ph-note" aria-hidden="true" />
          {{ tarefa.observacao }}
        </p>

        <p v-if="horaFora" class="tarefa__quando ui-num">
          {{ t('hotel.rotina.marcadaAs', { hora: horaFora }) }}
        </p>
      </div>

      <div class="tarefa__acoes">
        <template v-if="!resolvida">
          <Button
            type="button"
            class="tarefa__botao tarefa__pular"
            :label="t('hotel.rotina.pular')"
            severity="secondary"
            text
            :disabled="salvando"
            @click="emit('marcar', { tarefaId: tarefa.id, status: 'pulada' })"
          />

          <!--
            Recusou é botão próprio, e não uma opção escondida: "não comeu" é o primeiro sinal de
            que algo está errado com um animal saudável longe de casa.
          -->
          <Button
            v-if="tarefa.kind === 'refeicao' || tarefa.kind === 'medicacao'"
            type="button"
            class="tarefa__botao"
            :label="t('hotel.rotina.recusou')"
            icon="ph ph-hand-palm"
            severity="secondary"
            outlined
            :disabled="salvando"
            @click="emit('marcar', { tarefaId: tarefa.id, status: 'recusada' })"
          />

          <!-- "Feita" por último: encostado na ponta, cai sempre no mesmo lugar. -->
          <Button
            type="button"
            class="tarefa__botao tarefa__feita"
            :class="{ 'tarefa__feita--adiante': !daVez }"
            :label="t('hotel.rotina.feita')"
            icon="ph ph-check"
            :severity="daVez ? undefined : 'secondary'"
            :outlined="!daVez"
            :disabled="salvando"
            @click="emit('marcar', { tarefaId: tarefa.id, status: 'feita' })"
          />
        </template>

        <!-- Desfazer existe porque o toque errado no corredor é frequente e barato de corrigir. -->
        <Button
          v-else
          type="button"
          class="tarefa__botao"
          :label="t('hotel.rotina.desfazer')"
          icon="ph ph-arrow-counter-clockwise"
          severity="secondary"
          text
          :disabled="salvando"
          @click="emit('marcar', { tarefaId: tarefa.id, status: 'pendente' })"
        />
      </div>
    </div>
  </li>
</template>

<style scoped>
/*
 * A linha é o próprio contêiner: as ações descem para uma fileira só delas quando a linha fica
 * estreita, e quem decide é a largura da linha, não a da janela — a mesma linha vive na coluna
 * larga da prancheta, na lateral da estadia e no telefone.
 */
.tarefa {
  position: relative;
  container-type: inline-size;
  list-style: none;
}

.tarefa__linha {
  display: grid;
  align-items: center;
  gap: 4px 12px;
  padding: 12px 14px 12px 16px;
  grid-template-columns: auto minmax(0, 1fr) auto;
}

.tarefa__linha--com-hora {
  grid-template-columns: auto auto minmax(0, 1fr) auto;
}

.tarefa--na-ronda .tarefa__linha {
  padding-block: 10px;
}

/* ------------------------------------------------------------------ hora */

.tarefa__hora {
  min-width: 44px;
  color: var(--tinta-2);
}

.tarefa--atrasada .tarefa__hora {
  color: var(--atencao-tinta);
}

.tarefa--remedio-atrasado .tarefa__hora {
  color: var(--risco-tinta);
}

/* ------------------------------------------------------------------ disco e rosto */

.tarefa__icone {
  display: grid;
  width: 38px;
  height: 38px;
  flex: none;
  align-self: start;
  place-items: center;
  border-radius: 11px;
  background: var(--superficie-2);
  color: var(--tinta-2);
  font-size: 15px;
}

.tarefa__icone i {
  font-size: 19px;
}

.tarefa--na-janela .tarefa__icone {
  background: var(--hotel-fundo);
  color: var(--hotel-tinta);
}

.tarefa--atrasada .tarefa__icone {
  background: var(--atencao-fundo);
  color: var(--atencao-tinta);
}

/* Só o remédio atrasado enche: no meio da água que atrasou meia hora, ele não pode se perder. */
.tarefa--remedio-atrasado .tarefa__icone {
  background: var(--risco);
  color: var(--superficie);
}

.tarefa--resolvida .tarefa__icone {
  background: var(--superficie-2);
  color: var(--tinta-3);
}

.tarefa--feita .tarefa__icone {
  color: var(--ok-tinta);
}

.tarefa__rosto {
  display: grid;
  align-self: start;
}

.tarefa--resolvida .tarefa__rosto {
  opacity: 0.55;
}

/* ------------------------------------------------------------------ texto */

.tarefa__corpo {
  display: grid;
  min-width: 0;
  gap: 3px;
}

.tarefa__titulo {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 8px;
  margin: 0;
  line-height: 1.35;
}

.tarefa__titulo strong {
  overflow-wrap: anywhere;
  color: var(--tinta);
  font-size: 15px;
  font-weight: 600;
}

/* Resolvida é história: o texto apaga, a linha continua legível. */
.tarefa--resolvida .tarefa__titulo strong {
  color: var(--tinta-2);
}

.tarefa__oque {
  margin: 0;
  color: var(--tinta);
  font-size: 14px;
  line-height: 1.4;
}

.tarefa--resolvida .tarefa__oque {
  color: var(--tinta-2);
}

.tarefa__meta {
  margin: 0;
  overflow: hidden;
  color: var(--tinta-2);
  font-size: 13px;
  line-height: 1.4;
  text-overflow: ellipsis;
}

.tarefa__pet {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 2px 8px;
  margin: 3px 0 0;
  font-size: 13.5px;
  line-height: 1.3;
}

.tarefa__pet-nome {
  color: var(--tinta);
  font-weight: 600;
}

.tarefa__onde {
  color: var(--tinta-2);
}

.tarefa--resolvida .tarefa__pet {
  opacity: 0.7;
}

.tarefa__observacao {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  margin: 2px 0 0;
  color: var(--atencao-tinta);
  font-size: 13px;
  font-weight: 550;
  line-height: 1.4;
}

.tarefa__observacao i {
  margin-top: 1px;
  font-size: 14px;
}

.tarefa__quando {
  margin: 0;
  color: var(--tinta-3);
  font-size: 12.5px;
}

/* ------------------------------------------------------------------ ações */

.tarefa__acoes {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
}

/* Alvo de canil: 40 px de altura, mais que o controle comum, para o polegar não errar a linha. */
.tarefa__botao.p-button {
  min-height: 40px;
  padding-inline: 14px;
  white-space: nowrap;
}

.tarefa__pular.p-button {
  padding-inline: 10px;
}

.tarefa__feita.p-button {
  min-width: 104px;
  font-weight: 600;
}

/*
 * Estreita, a linha vira duas fileiras: quem é em cima, as ações embaixo, com o "Feita" esticado
 * até a borda — o maior alvo da linha, onde o polegar alcança.
 */
@container (max-width: 520px) {
  .tarefa__linha,
  .tarefa__linha--com-hora {
    grid-template-columns: auto minmax(0, 1fr);
  }

  .tarefa__hora {
    grid-column: 1 / -1;
  }

  .tarefa__acoes {
    grid-column: 1 / -1;
    flex-wrap: nowrap;
    justify-content: stretch;
    padding-top: 6px;
  }

  .tarefa__feita.p-button {
    flex: 1 1 auto;
  }
}
</style>
