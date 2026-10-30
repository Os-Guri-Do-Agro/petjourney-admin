<script setup lang="ts">
/**
 * Uma linha da caixa de pedidos: para quando, quem, o quê, quanto falta — e a resposta a um clique.
 *
 * A linha tem o que decide a triagem, e só isso. À esquerda, grande, o dia e a hora pedidos
 * ("para quando?" antes de qualquer leitura); depois o pet e quem pede, o serviço e com quem, o
 * prazo de resposta como contagem regressiva e os botões. A queixa, o histórico liberado, o
 * telefone de quem veio pelo link e a escolha de outro horário moram na gaveta que "Responder"
 * abre.
 *
 * A ação cheia é o próximo passo natural, e ela muda com o caso: "Aceitar" quando o horário
 * escolhido continua livre; "Marcar 13:00" quando a clínica precisa escolher — o melhor horário,
 * ou a alternativa ao escolhido que sumiu. Assim a pessoa nunca aceita às cegas um horário que já
 * não existe: o botão diz o horário que vai gravar.
 *
 * O prazo tem tom: risco quando passou ou falta meia hora, atenção nas duas horas seguintes,
 * neutro no resto. O tom pinta a contagem e a marca na borda; a palavra ("para responder", "de
 * atraso") diz o mesmo para quem não vê a cor.
 */
import Button from 'primevue/button'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import PetAvatar from '@/features/hotel/components/base/PetAvatar.vue'

import { useClinicFormat } from '../../composables/useClinicFormat'
import { useRotulosDoPedido } from '../../composables/useRotulosDoPedido'
import type { PedidoNaCaixa } from '../../data/agendamento-online'
import { aparenciaDoTipo } from '../../domain/appointment-kind'
import { situacaoDoPrazo, TIPO_DO_MOTIVO } from '../../domain/pedidos'
import { clinicClock, useClinicoStore } from '../../stores/clinico'

import PedidoQuando from './PedidoQuando.vue'

const props = defineProps<{
  linha: PedidoNaCaixa
  respondendo: boolean
  /** Outra linha está sendo respondida: os botões desta esperam. */
  ocupado: boolean
  /** A gaveta está aberta nesta linha. */
  aberta: boolean
}>()

const emit = defineEmits<{
  aceitar: [escolha: { professionalId: string; inicio: string } | null]
  abrir: []
}>()

const { t } = useI18n()
const clinico = useClinicoStore()
const formato = useClinicFormat()
const rotulos = useRotulosDoPedido()

/** Até duas horas para vencer, o prazo pede atenção: é a manhã de quem abriu a caixa agora. */
const MINUTOS_DE_ATENCAO = 120

const primeiro = computed(() => props.linha.pedidos[0]!)
const tipo = computed(() => clinico.tipo(primeiro.value.typeId))
const aparencia = computed(() => aparenciaDoTipo(tipo.value?.kind))

/** Cada pet do grupo, com o que a clínica sabe dele — ou o que o cadastro mínimo trouxe. */
const pets = computed(() =>
  props.linha.pedidos.map((pedido) => {
    const pet = pedido.petId ? clinico.pet(pedido.petId) : null
    const nome = pet?.nome ?? pedido.novoCadastro?.petNome ?? ''

    return {
      id: pedido.id,
      nome,
      iniciais: pet?.iniciais ?? nome.slice(0, 2).toUpperCase(),
      especie: pet?.especie ?? pedido.novoCadastro?.especie ?? null,
      fotoUrl: pet?.fotoUrl ?? '',
    }
  }),
)

const nomeDoResponsavel = computed(() => {
  const tutor = primeiro.value.tutorId ? clinico.tutor(primeiro.value.tutorId) : null

  return tutor?.nome ?? primeiro.value.novoCadastro?.nome ?? ''
})

/** Primeira vez: o pet não está no cadastro da clínica — veio do link, ou do app sem vínculo. */
const primeiraVez = computed(() =>
  props.linha.pedidos.some(
    (pedido) => pedido.novoCadastro !== null && !(pedido.petId && clinico.pet(pedido.petId)),
  ),
)

const escolheu = computed(() => primeiro.value.modo === 'horario-escolhido')

/** Para quando: o dia escolhido com a hora, ou a janela em que pode com o período. */
const quando = computed(() => {
  const pedido = primeiro.value

  if (escolheu.value && pedido.inicio) {
    return {
      dia: clinicClock.dateOf(pedido.inicio),
      ate: null,
      principal: formato.hora(pedido.inicio),
      hora: true,
      extra: props.linha.pedidos.length > 1 ? `+${props.linha.pedidos.length - 1}` : '',
      riscada: !props.linha.horarioLivre,
    }
  }

  if (pedido.preferencia) {
    const periodos = pedido.preferencia.periodos

    return {
      dia: pedido.preferencia.de,
      ate: pedido.preferencia.ate,
      principal:
        periodos.length === 1
          ? t(`clinico.pedidos.periodoTitulo.${periodos[0]}`)
          : t('clinico.pedidos.tela.qualquerHora'),
      hora: false,
      extra: '',
      riscada: false,
    }
  }

  return null
})

/** Com quem: o profissional escolhido, o preferido na janela, ou qualquer um. */
const comQuem = computed(() => {
  const pedido = primeiro.value
  const id = escolheu.value ? pedido.professionalId : (pedido.preferencia?.professionalId ?? null)

  return id
    ? t('clinico.pedidos.comProfissional', { nome: clinico.profissional(id)?.nome ?? '' })
    : t('clinico.pedidos.qualquerProfissional')
})

const sugestao = computed(() => props.linha.sugestao)

// ------------------------------------------------------------------ o prazo

const prazo = computed(() => situacaoDoPrazo(primeiro.value, clinicClock.nowIso()))

const minutosAteOPrazo = computed(() =>
  Math.round(
    (Date.parse(primeiro.value.responderAte) - Date.parse(clinicClock.nowIso())) / 60_000,
  ),
)

const tom = computed(() => {
  if (prazo.value !== 'no-prazo') {
    return 'risco'
  }

  return minutosAteOPrazo.value <= MINUTOS_DE_ATENCAO ? 'atencao' : 'neutro'
})

/** O número grande: quanto falta, ou quanto passou. */
const contagem = computed(() => formato.distancia(minutosAteOPrazo.value))

const legendaDoPrazo = computed(() => {
  const ate = primeiro.value.responderAte
  /* Prazo de outro dia diz o dia: "até 08:26" lido às 18h parece daqui a pouco. */
  const quandoVence = clinicClock.dateOf(ate) === clinicClock.today() ? formato.hora(ate) : rotulos.quando(ate)

  return prazo.value === 'atrasado'
    ? t('clinico.pedidos.tela.prazoPassou', { quando: quandoVence })
    : t('clinico.pedidos.tela.prazoNoTempo', { quando: quandoVence })
})

/** O botão cheio: aceita o escolhido, ou marca o melhor horário que a clínica tem. */
const acaoPrincipal = computed(() => {
  if (props.linha.horarioLivre) {
    return { rotulo: t('clinico.pedidos.aceitar'), titulo: undefined, escolha: null }
  }

  if (sugestao.value) {
    /*
     * A hora sozinha só basta quando o dia é o que o responsável pediu. Na janela "30/10 a 02/11",
     * "Marcar 08:00" não dizia em qual dos quatro dias: o botão leva o dia junto.
     */
    const inicio = sugestao.value.inicio
    const dia = clinicClock.dateOf(inicio)
    const mesmoDia = quando.value?.ate === null && dia === quando.value.dia

    return {
      rotulo: t('clinico.pedidos.marcarEm', {
        hora: mesmoDia
          ? formato.hora(inicio)
          : `${formato.diaDaSemanaCurto(dia)} ${formato.hora(inicio)}`,
      }),
      titulo: rotulos.quando(inicio),
      escolha: { professionalId: sugestao.value.professionalId, inicio: sugestao.value.inicio },
    }
  }

  return null
})

const rotuloDoCanal = computed(() => t(`clinico.pedidos.canal.${primeiro.value.canal}`))
</script>

<template>
  <li
    class="pedido"
    :class="[
      tom !== 'neutro' ? `ui-marca ui-marca--${tom}` : '',
      { 'pedido--respondendo': respondendo, 'pedido--aberta': aberta },
    ]"
    :aria-busy="respondendo"
    @click="emit('abrir')"
  >
    <PedidoQuando
      v-if="quando"
      class="pedido__quando"
      :dia="quando.dia"
      :ate="quando.ate"
      :principal="quando.principal"
      :hora="quando.hora"
      :extra="quando.extra"
      :riscada="quando.riscada"
    />
    <span v-else class="pedido__quando" />

    <!-- Quem -->
    <div class="pedido__quem">
      <span class="pedido__rostos" :class="{ 'pedido__rostos--grupo': pets.length > 1 }">
        <PetAvatar
          v-for="pet in pets"
          :key="pet.id"
          :nome="pet.nome"
          :iniciais="pet.iniciais"
          :especie="pet.especie"
          :foto-url="pet.fotoUrl"
          tamanho="md"
        />
      </span>

      <span class="pedido__identidade">
        <span class="pedido__nomes">
          <strong>{{ rotulos.nomes(pets.map((pet) => pet.nome)) }}</strong>
          <span v-if="primeiraVez" class="ui-selo ui-selo--clinica">
            <i class="ph ph-sparkle" aria-hidden="true" />
            {{ t('clinico.pedidos.primeiraVez') }}
          </span>
        </span>
        <span class="pedido__meta">
          <i
            class="ph"
            :class="primeiro.canal === 'app' ? 'ph-device-mobile' : 'ph-globe-simple'"
            :title="rotuloDoCanal"
            aria-hidden="true"
          />
          <span class="sr-only">{{ rotuloDoCanal }}:</span>
          <span class="pedido__responsavel">{{ nomeDoResponsavel }}</span>
        </span>
      </span>
    </div>

    <!-- O pedido -->
    <div class="pedido__oque">
      <span class="pedido__servico">
        <i
          v-if="aparencia.icone"
          :class="['pedido__tipo', aparencia.icone]"
          :style="{ color: aparencia.tinta }"
          aria-hidden="true"
        />
        <strong>{{ tipo?.nome }}</strong>
        <!-- O motivo só quando diz mais que o serviço: "Consulta, sintoma", nunca "Retorno, retorno". -->
        <span v-if="TIPO_DO_MOTIVO[primeiro.motivo] === 'consulta'" class="pedido__motivo">
          · {{ t(`clinico.pedidos.motivo.${primeiro.motivo}`) }}
        </span>
        <i
          v-if="primeiro.remarcaAppointmentId"
          class="ph ph-arrows-clockwise pedido__remarca"
          :title="t('clinico.pedidos.remarcacao')"
          :aria-label="t('clinico.pedidos.remarcacao')"
        />
      </span>

      <!-- O horário que sumiu: dito em palavra, no lugar de "com quem". O botão já oferece outro. -->
      <span v-if="escolheu && !linha.horarioLivre" class="pedido__detalhe pedido__detalhe--atencao">
        <i class="ph ph-warning-circle" aria-hidden="true" />
        {{ t('clinico.pedidos.linha.ocupado') }}
      </span>
      <span v-else-if="!escolheu && !sugestao" class="pedido__detalhe pedido__detalhe--atencao">
        <i class="ph ph-calendar-x" aria-hidden="true" />
        {{ t('clinico.pedidos.semSugestao') }}
      </span>
      <span v-else class="pedido__detalhe">{{ comQuem }}</span>
    </div>

    <!-- O prazo, contando -->
    <p class="pedido__prazo" :class="`pedido__prazo--${tom}`">
      <strong class="ui-num">
        <i
          class="ph"
          :class="tom === 'neutro' ? 'ph-clock' : 'ph-clock-countdown'"
          aria-hidden="true"
        />
        {{ contagem }}
      </strong>
      <small>{{ legendaDoPrazo }}</small>
    </p>

    <div class="pedido__botoes">
      <Button
        type="button"
        size="small"
        :severity="acaoPrincipal ? 'secondary' : undefined"
        :outlined="Boolean(acaoPrincipal)"
        :label="t('clinico.pedidos.linha.responder')"
        :aria-expanded="aberta"
        :disabled="ocupado && !aberta"
        @click.stop="emit('abrir')"
      />
      <Button
        v-if="acaoPrincipal"
        type="button"
        size="small"
        icon="ph ph-check"
        :label="acaoPrincipal.rotulo"
        :title="acaoPrincipal.titulo"
        :loading="respondendo"
        :disabled="ocupado && !respondendo"
        @click.stop="emit('aceitar', acaoPrincipal.escolha)"
      />
    </div>
  </li>
</template>

<style scoped>
.pedido {
  position: relative;
  display: grid;
  min-height: 88px;
  align-items: center;
  gap: 10px 22px;
  /* Larguras fixas no começo e no fim: cada linha é uma grade própria, e colunas medidas pelo
     conteúdo desalinhavam as horas e os botões de uma linha para a outra. */
  /* Os botões cabem inteiros com o dia no "Marcar sex. 08:00" ao lado de "Responder". */
  grid-template-columns: 6.5rem minmax(0, 1.15fr) minmax(0, 1fr) 11.5rem 17rem;
  padding: 14px 24px 14px 18px;
  cursor: pointer;
  transition: background-color var(--pj-tempo-curto) ease-out;
}

/*
 * O "para quando" num ladrilho de calendário, rente: o dia pequeno em cima, a hora grande
 * embaixo. É o primeiro ponto em que o olho para em cada linha.
 */
.pedido__quando:not(:empty) {
  justify-items: center;
  padding: 9px 8px 10px;
  border: 1px solid var(--linha-suave);
  border-radius: var(--raio-cartao-pequeno);
  background: var(--superficie-2);
  text-align: center;
}

.pedido--aberta .pedido__quando:not(:empty) {
  border-color: color-mix(in oklab, var(--clinica) 25%, var(--linha));
  background: var(--superficie);
}

.pedido:hover {
  background: var(--superficie-2);
}

/* A linha que está na gaveta: tingida na cor da clínica, para o olho voltar a ela ao fechar. */
.pedido--aberta,
.pedido--aberta:hover {
  background: color-mix(in oklab, var(--clinica-fundo) 70%, var(--superficie));
}

.pedido--respondendo {
  opacity: 0.6;
}

/* ------------------------------------------------------------------ quem */

.pedido__quem {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 12px;
}

.pedido__rostos {
  display: inline-flex;
  flex: none;
}

/* Dois pets da mesma casa: os rostos se sobrepõem, como uma ficha só. */
.pedido__rostos--grupo > * + * {
  margin-inline-start: -12px;
  border-radius: 50%;
  box-shadow: 0 0 0 2px var(--superficie);
}

.pedido__identidade,
.pedido__oque {
  display: grid;
  min-width: 0;
  gap: 3px;
}

.pedido__nomes {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 8px;
}

.pedido__nomes strong {
  color: var(--tinta);
  font-size: 15px;
  font-weight: 600;
  line-height: 1.3;
}

.pedido__nomes .ui-selo {
  height: 22px;
  font-size: 12px;
}

.pedido__meta {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 6px;
  color: var(--tinta-2);
  font-size: 13px;
}

.pedido__meta > i {
  flex: none;
  color: var(--tinta-3);
  font-size: 15px;
}

.pedido__responsavel {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ------------------------------------------------------------------ o pedido */

.pedido__servico {
  display: flex;
  min-width: 0;
  align-items: baseline;
  gap: 6px;
  font-size: 14px;
}

.pedido__servico strong {
  color: var(--tinta);
  font-weight: 600;
}

.pedido__tipo {
  font-size: 15px;
}

.pedido__motivo {
  overflow: hidden;
  color: var(--tinta-2);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pedido__remarca {
  color: var(--tinta-3);
}

.pedido__detalhe {
  overflow: hidden;
  color: var(--tinta-2);
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pedido__detalhe--atencao {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: var(--atencao-tinta);
  font-weight: 550;
}

/* ------------------------------------------------------------------ o prazo */

.pedido__prazo {
  display: grid;
  min-width: 0;
  gap: 2px;
  margin: 0;
  line-height: 1.15;
}

.pedido__prazo strong {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--tinta);
  font-size: 20px;
  font-weight: 650;
  letter-spacing: -0.01em;
  white-space: nowrap;
}

.pedido__prazo strong i {
  color: var(--tinta-3);
  font-size: 17px;
}

.pedido__prazo small {
  color: var(--tinta-2);
  font-size: 12.5px;
  line-height: 1.35;
}

.pedido__prazo--risco strong,
.pedido__prazo--risco strong i {
  color: var(--risco-tinta);
}

.pedido__prazo--atencao strong,
.pedido__prazo--atencao strong i {
  color: var(--atencao-tinta);
}

/* ------------------------------------------------------------------ botões */

.pedido__botoes {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

/* Botão de linha no tamanho pequeno, mas com o alvo de toque de 36 px. */
.pedido__botoes :deep(.p-button) {
  min-height: 36px;
  white-space: nowrap;
}

/*
 * Pela largura da lista, não da janela: com a gaveta aberta a página perde 30 rem, e uma linha
 * medida pela janela continuava em cinco colunas espremidas. O pedido desce para baixo de quem, e
 * a resposta para baixo do prazo — o "quando" fica à esquerda, ocupando a altura.
 */
@container (max-width: 62rem) {
  .pedido {
    align-items: start;
    grid-template-columns: 5.75rem minmax(0, 1fr) auto;
  }

  .pedido__quando {
    grid-row: span 2;
    align-self: center;
  }

  .pedido__oque {
    grid-column: 2;
  }

  .pedido__prazo {
    grid-column: 3;
    grid-row: 1;
    justify-items: end;
    text-align: end;
  }

  .pedido__botoes {
    grid-column: 3;
    grid-row: 2;
    align-self: end;
  }

  .pedido__detalhe {
    white-space: normal;
  }
}

@container (max-width: 36rem) {
  .pedido {
    grid-template-columns: 5rem minmax(0, 1fr);
    padding-inline: 14px 14px;
  }

  .pedido__quando {
    grid-row: span 4;
    align-self: start;
  }

  .pedido__prazo,
  .pedido__botoes {
    grid-column: 2;
    grid-row: auto;
    justify-items: start;
    justify-content: flex-start;
    text-align: start;
  }

  .pedido__botoes {
    flex-wrap: wrap;
  }
}

@media (prefers-reduced-motion: reduce) {
  .pedido {
    transition: none;
  }
}
</style>
