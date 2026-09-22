<script setup lang="ts">
/**
 * Rotina do turno — a prancheta.
 *
 * Esta tela é usada **em pé, com uma mão, no corredor do canil**, e a forma dela vem disso: um
 * trilho vertical de horários à esquerda e as tarefas daquele horário à direita, como uma
 * prancheta de papel. A hora é o eixo porque às 8h alguém alimenta os dezoito — a pergunta não é
 * "o que falta para o Thor", é "o que é para agora".
 *
 * Duas coisas que a primeira versão errava e esta corrige:
 *
 * - **Era mais uma fileira de números e uma lista**, igual às outras oito telas. Agora tem o eixo
 *   do tempo desenhado, que é o que separa uma prancheta de um relatório.
 * - **Abria mostrando o dia inteiro.** O que se precisa em pé no corredor é o bloco de **agora**;
 *   o resto do dia fica abaixo, e o que passou fica recolhido.
 */
import { PhCat, PhListChecks } from '@phosphor-icons/vue'
import Button from 'primevue/button'
import Select from 'primevue/select'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import PartnerPageFrame from '@/components/parceiro/PartnerPageFrame.vue'
import HotelDevPanel from '@/features/hotel/components/base/HotelDevPanel.vue'
import HotelTour from '@/features/hotel/components/base/HotelTour.vue'
import IconeDeTarefa from '@/features/hotel/components/base/IconeDeTarefa.vue'
import type { PassoDoTour } from '@/features/hotel/components/base/tour-types'
import PassagemDialog from '@/features/hotel/components/rotina/PassagemDialog.vue'
import RondaDoHorario from '@/features/hotel/components/rotina/RondaDoHorario.vue'
import { useHotelFormat } from '@/features/hotel/composables/useHotelFormat'
import type { TarefaKind, TarefaStatus } from '@/features/hotel/data/types'
import type { TempoDaPrancheta } from '@/features/hotel/domain/rotina'
import {
  agruparEmRondas,
  repartirPorTempo,
  RONDA_ABRE_ATE,
} from '@/features/hotel/domain/rotina'
import { useHospedagemStore } from '@/features/hotel/stores/hospedagem'
import { useHotelStore } from '@/features/hotel/stores/hotel'

const { t } = useI18n()
const router = useRouter()
const formato = useHotelFormat()
const hotelStore = useHotelStore()
const hospedagem = useHospedagemStore()

const passagemAberta = ref(false)
const filtroKind = ref<TarefaKind | 'todas'>('todas')
const mostrarPassado = ref(false)

const KINDS: TarefaKind[] = [
  'refeicao',
  'medicacao',
  'passeio',
  'higiene',
  'agua',
  /* Os serviços vendidos: quem vai dar o banho da tarde filtra por banho e desce a lista. */
  'banho',
  'tosa',
  'recreacao',
  'adestramento',
]

onMounted(async () => {
  await hospedagem.carregarPrancheta()
  await hospedagem.carregarPassagem()
})

watch(
  () => hotelStore.revisao,
  () => void hospedagem.carregarPrancheta(),
)

/**
 * O filtro oferece **só os tipos que existem hoje**, com quantos são.
 *
 * Os nove tipos fixos davam nove botões de peso igual ocupando 739 px de barra — medido na tela —,
 * e num dia comum quatro deles não têm uma única tarefa: ninguém contratou adestramento, e mesmo
 * assim "Adestramento" disputava espaço com "Refeição". Espremidos, os rótulos encostavam uns nos
 * outros e a fileira virava uma tira de texto corrido.
 *
 * O primeiro item é "Todas", escrito. Antes o estado "sem filtro" era a ausência de seleção — e
 * ausência de seleção não é um lugar que se saiba como alcançar; quem filtrou por banho ficava
 * procurando o botão de voltar.
 */
const tiposDoDia = computed(() => {
  const contagem = new Map<TarefaKind, number>()

  for (const linha of hospedagem.prancheta) {
    contagem.set(linha.tarefa.kind, (contagem.get(linha.tarefa.kind) ?? 0) + 1)
  }

  return [
    {
      valor: 'todas' as const,
      /* `kind` nulo é o que diz à linha para desenhar a lista em vez do ícone de um serviço. */
      kind: null,
      rotulo: t('hotel.rotina.todas'),
      total: hospedagem.prancheta.length,
    },
    ...KINDS.filter((kind) => contagem.has(kind)).map((kind) => ({
      valor: kind,
      kind,
      rotulo: formato.tarefaKind(kind),
      total: contagem.get(kind) ?? 0,
    })),
  ]
})

/*
 * A opção escolhida, inteira — o `#value` do Select recebe só o valor cru, e o que o recolhido
 * precisa mostrar é o ícone e a contagem que moram ao lado dele.
 */
const tipoSelecionado = computed(() =>
  tiposDoDia.value.find((tipo) => tipo.valor === filtroKind.value),
)

/*
 * Se o tipo filtrado sumir do dia — a última medicação foi marcada, a prancheta recarregou —, o
 * filtro volta para "Todas". Sem isto a tela fica vazia apontando para um botão que não existe
 * mais, e parece defeito de carregamento.
 */
watch(tiposDoDia, (tipos) => {
  if (!tipos.some((tipo) => tipo.valor === filtroKind.value)) {
    filtroKind.value = 'todas'
  }
})

const blocos = computed(() =>
  hospedagem.blocosDaPrancheta.map((bloco) => ({
    ...bloco,
    linhas:
      filtroKind.value === 'todas'
        ? bloco.linhas
        : bloco.linhas.filter((linha) => linha.tarefa.kind === filtroKind.value),
  })),
)

/*
 * Os três tempos da prancheta, cada horário já repartido em rondas. As duas regras moram no
 * domínio, junto dos testes que as guardam — ver `repartirPorTempo` e `agruparEmRondas`.
 */
function emRondas(tempo: TempoDaPrancheta) {
  return repartirPorTempo(blocos.value, tempo).map((bloco) => {
    /*
     * Todas as tarefas daquele horário, e não só as deste tempo: é delas que sai quantas da ronda
     * já foram resolvidas. Sem esse número, quem marca doze de quarenta vê a ronda encolher para
     * vinte e oito sem nada dizendo que as doze foram suas — e num hotel grande é aí que se perde
     * a conta e se marca de novo o que já estava feito.
     */
    const todasDoHorario = blocos.value.find((item) => item.hora === bloco.hora)?.linhas ?? []

    return {
      ...bloco,
      rondas: agruparEmRondas(bloco.hora, bloco.linhas).map((ronda) => ({
        ...ronda,
        resolvidas:
          todasDoHorario.filter((linha) => linha.tarefa.kind === ronda.kind).length -
          ronda.linhas.length,
      })),
    }
  })
}

const agora = computed(() => emRondas('agora'))
const adiante = computed(() => emRondas('adiante'))
const passado = computed(() => emRondas('passado'))

const feitasNoDia = computed(
  () => hospedagem.prancheta.filter((linha) => linha.tarefa.status !== 'pendente').length,
)

/**
 * A data e, ao lado dela, **qual turno é este e até que horas ele vai**.
 *
 * A tela se chama "Rotina do turno" e não dizia de que turno: o cabeçalho trazia só a data, e as
 * tarefas listadas iam até o fim do dia sem marcar onde acaba a responsabilidade de quem está
 * lendo. Saber que são 14:00–22:00 muda o que se faz com a lista — o passeio das 21:00 é seu, o
 * das 23:00 é de quem entra depois e vai chegar na passagem.
 *
 * Cai no subtítulo que já existe, em vez de virar bloco novo: é a mesma classe de informação que
 * a data, e a data já mora lá.
 */
const subtitulo = computed(() => {
  const data = formato.dataLonga(hospedagem.dia)
  const turno = hospedagem.passagem?.turno

  if (!turno) return data

  const janela = `${formato.hora(turno.inicio)}–${formato.hora(turno.fim)}`

  return `${data} · ${formato.turno(turno.kind)} ${janela}`
})

/** As duas fatias da barra, em porcentagem do dia. O resto da pista é o que ainda vem. */
const fatia = computed(() => {
  const total = hospedagem.prancheta.length || 1

  return {
    feitas: (feitasNoDia.value / total) * 100,
    atrasadas: (hospedagem.atrasadasNaPrancheta / total) * 100,
  }
})

/**
 * O horário em que o turno acaba, e o primeiro bloco de "mais tarde" que já cai fora dele.
 *
 * "Mais tarde hoje" vai até a meia-noite, mas o turno não. Sem a fronteira desenhada, quem lê a
 * lista às 13h vê o passeio das 16:00 como coisa sua e planeja o resto da tarde em cima de uma
 * tarefa que vai entregar na passagem. A régua está em `HH:MM` porque é a mesma forma das
 * etiquetas do eixo, e nesse formato comparar texto é comparar hora.
 */
const fimDoTurno = computed(() =>
  hospedagem.passagem ? formato.hora(hospedagem.passagem.turno.fim) : '',
)

const primeiroDepoisDoTurno = computed(() =>
  fimDoTurno.value
    ? (adiante.value.find((bloco) => bloco.hora >= fimDoTurno.value)?.hora ?? '')
    : '',
)

const vazio = computed(
  () => !hospedagem.carregando && !hospedagem.erro && hospedagem.prancheta.length === 0,
)

async function marcar(payload: { tarefaId: string; status: TarefaStatus }) {
  await hospedagem.marcarTarefa(payload.tarefaId, payload.status)
}

/**
 * Marca de uma vez as tarefas de uma ronda.
 *
 * Existe porque o trabalho real acontece em ronda: às 08:00 alguém serve os comedouros todos e só
 * depois pega o telefone. Marcar vinte linhas uma a uma, em pé, é a razão de a prancheta ser
 * preenchida de memória no fim do turno — e prancheta preenchida de memória não vale nada.
 *
 * O lote é **da ronda, não do horário**. A primeira versão marcava tudo de um horário: às 18:00,
 * com a casa cheia, isso eram 29 tarefas de dois tipos num toque — e num horário com medicação,
 * marcaria medicação junto. Ronda é um serviço só, que é o escopo que a pessoa de fato executou.
 *
 * Só marca "feita", nunca "recusou" nem "pulou": recusa é observação de um animal específico e
 * não é coisa que se aplique em lote. E vai uma por vez, parando na primeira que falhar, porque
 * disparar vinte em paralelo deixaria a lista num estado que ninguém consegue reler no corredor —
 * metade marcada, metade não, sem dizer qual metade.
 */
async function marcarRonda(ids: string[]) {
  for (const id of ids) {
    if (!(await hospedagem.marcarTarefa(id, 'feita'))) return
  }
}

/**
 * Quais rondas estão abertas.
 *
 * O mapa guarda **só o que alguém decidiu**; o resto responde pelo tamanho, via `RONDA_ABRE_ATE`.
 * Guardar o estado de todas faria a tela nascer com quarenta entradas iguais e perder a regra que
 * a torna útil nos dois tamanhos de hotel.
 */
const rondasAbertas = ref(new Map<string, boolean>())

function rondaAberta(chave: string, tamanho: number) {
  return rondasAbertas.value.get(chave) ?? tamanho <= RONDA_ABRE_ATE
}

function alternarRonda(chave: string, tamanho: number) {
  rondasAbertas.value = new Map(rondasAbertas.value).set(
    chave,
    !rondaAberta(chave, tamanho),
  )
}

async function entregarTurno(nota: string, recebidoPor: string) {
  if (await hospedagem.entregarTurno(nota, recebidoPor)) {
    passagemAberta.value = false
  }
}
/**
 * O tutorial desta tela, na ordem em que se lê a página.
 *
 * Os passos ficam aqui, e não num catálogo central, porque cada um carrega um seletor do próprio
 * template: separá-los faria o roteiro apontar para uma classe renomeada sem ninguém notar.
 */
const tourAberto = ref(false)

const passosDoTour = computed<PassoDoTour[]>(() => [
  {
    titulo: t('hotel.tour.rotina.pergunta.titulo'),
    texto: t('hotel.tour.rotina.pergunta.texto'),
  },
  {
    alvo: '.progresso',
    titulo: t('hotel.tour.rotina.progresso.titulo'),
    texto: t('hotel.tour.rotina.progresso.texto'),
  },
  {
    alvo: '.barra',
    titulo: t('hotel.tour.rotina.filtros.titulo'),
    texto: t('hotel.tour.rotina.filtros.texto'),
  },
  {
    alvo: '.tempo',
    titulo: t('hotel.tour.rotina.tempo.titulo'),
    texto: t('hotel.tour.rotina.tempo.texto'),
  },
  {
    alvo: '.ronda',
    titulo: t('hotel.tour.rotina.ronda.titulo'),
    texto: t('hotel.tour.rotina.ronda.texto'),
  },
  {
    alvo: '.horario',
    titulo: t('hotel.tour.rotina.marcar.titulo'),
    texto: t('hotel.tour.rotina.marcar.texto'),
  },
])
</script>

<template>
  <PartnerPageFrame
    :title="t('hotel.rotina.titulo')"
    :subtitle="subtitulo"
    tour
    @tour="tourAberto = true"
    :loading="hospedagem.carregando && hospedagem.prancheta.length === 0"
    :error="hospedagem.erro ? t(hospedagem.erro) : ''"
    :empty="vazio"
    :empty-title="t('hotel.rotina.vazioTitulo')"
    :empty-description="t('hotel.rotina.vazioDescricao')"
    @retry="hospedagem.carregarPrancheta()"
  >
    <div class="rotina clinic-scope">
      <!-- O progresso do dia numa frase e numa pista, e o filtro por tipo. -->
      <div class="barra">
        <div class="progresso">
          <p class="progresso__frase">
            <strong class="clinic-value">{{ feitasNoDia }}</strong>
            {{
              t(
                'hotel.rotina.de',
                { total: hospedagem.prancheta.length },
                hospedagem.prancheta.length,
              )
            }}
            <span v-if="hospedagem.atrasadasNaPrancheta > 0" class="progresso__alerta">
              ·
              {{
                t(
                  'hotel.rotina.atrasadas',
                  { total: hospedagem.atrasadasNaPrancheta },
                  hospedagem.atrasadasNaPrancheta,
                )
              }}
            </span>
          </p>

          <!--
            A pista repete em forma o que a frase diz em número, e é a forma que se lê de longe:
            de relance dá para ver se o dia está em dia. `aria-hidden` porque a frase logo acima
            já anuncia o mesmo — duas leituras seguidas do mesmo fato atrapalham quem ouve.
          -->
          <span class="pista" aria-hidden="true">
            <span class="pista__feitas" :style="{ width: `${fatia.feitas}%` }" />
            <span class="pista__atrasadas" :style="{ width: `${fatia.atrasadas}%` }" />
          </span>
        </div>

        <Select
          v-model="filtroKind"
          :options="tiposDoDia"
          option-label="rotulo"
          option-value="valor"
          :aria-label="t('hotel.rotina.filtroTipo')"
          :pt="{ overlay: { class: 'clinic-overlay' } }"
          class="filtro"
          scroll-height="22rem"
        >
          <!--
            O valor recolhido mostra o mesmo que a linha do painel: ícone, nome e quantos. Sem o
            ícone aqui, abrir a lista trocava a forma do que se estava lendo, e sem a contagem
            quem filtrou por "Refeição" perdia de vista quantas são — que é o número que fez
            escolher aquele filtro.
          -->
          <template #value>
            <span v-if="tipoSelecionado" class="filtro__opcao">
              <IconeDeTarefa
                v-if="tipoSelecionado.kind"
                :kind="tipoSelecionado.kind"
                class="filtro__icone"
              />
              <PhListChecks v-else class="filtro__icone" weight="duotone" aria-hidden="true" />

              <span class="filtro__rotulo">{{ tipoSelecionado.rotulo }}</span>
              <span class="filtro__conta">{{ tipoSelecionado.total }}</span>
            </span>
          </template>

          <!--
            Rótulo, ícone e contagem num invólucro próprio, e não soltos: o painel do Select é
            teleportado para fora da página, então `:deep` a partir daqui não alcança a linha
            dele. O que alcança é o conteúdo do slot, que carrega o atributo de escopo consigo —
            então a fileira é montada dentro do que é meu.
          -->
          <template #option="{ option }">
            <span class="filtro__opcao">
              <IconeDeTarefa v-if="option.kind" :kind="option.kind" class="filtro__icone" />
              <PhListChecks v-else class="filtro__icone" weight="duotone" aria-hidden="true" />

              <span class="filtro__rotulo">{{ option.rotulo }}</span>
              <span class="filtro__conta">{{ option.total }}</span>
            </span>
          </template>
        </Select>
      </div>

      <!-- ------------------------------------------------------------ para agora -->
      <section v-if="agora.length > 0" class="tempo tempo--agora">
        <h2 class="tempo__titulo">
          <i class="pi pi-clock" aria-hidden="true" />
          {{ t('hotel.rotina.paraAgora') }}
        </h2>

        <div v-for="bloco in agora" :key="bloco.hora" class="horario">
          <div class="horario__eixo">
            <span class="horario__hora clinic-value">{{ bloco.hora }}</span>
            <span class="horario__linha" aria-hidden="true" />
          </div>

          <ul class="horario__rondas">
            <RondaDoHorario
              v-for="ronda in bloco.rondas"
              :key="ronda.chave"
              :kind="ronda.kind"
              :linhas="ronda.linhas"
              :resolvidas="ronda.resolvidas"
              :aberta="rondaAberta(ronda.chave, ronda.linhas.length)"
              :salvando="hospedagem.salvando"
              @alternar="alternarRonda(ronda.chave, ronda.linhas.length)"
              @marcar="marcar"
              @marcar-todas="marcarRonda"
            />
          </ul>
        </div>
      </section>

      <!--
        O momento em que não há nada pendente é o único da tela em que ninguém está com pressa, e
        é o único que pode ser bonito sem atrapalhar. Um gato grande e macio em vez do ícone de
        confirmação de sempre: a tela passa a ter um lugar onde respira.
      -->
      <p v-else class="emDia">
        <PhCat class="emDia__bicho" weight="duotone" aria-hidden="true" />
        {{ t('hotel.rotina.tudoEmDia') }}
      </p>

      <!-- ------------------------------------------------------------ mais tarde -->
      <section v-if="adiante.length > 0" class="tempo">
        <h2 class="tempo__titulo tempo__titulo--calmo">
          <i class="pi pi-forward" aria-hidden="true" />
          {{ t('hotel.rotina.maisTarde') }}
        </h2>

        <template v-for="bloco in adiante" :key="bloco.hora">
          <!-- Onde o turno acaba. Daqui para baixo a lista é de quem assume, e isso muda o que
               quem está lendo agora precisa planejar. -->
          <p v-if="bloco.hora === primeiroDepoisDoTurno" class="fronteira">
            <i class="pi pi-sign-out" aria-hidden="true" />
            {{ t('hotel.rotina.depoisDoTurno', { hora: fimDoTurno }) }}
          </p>

          <div class="horario horario--adiante">
            <div class="horario__eixo">
              <span class="horario__hora clinic-value">{{ bloco.hora }}</span>
              <span class="horario__linha" aria-hidden="true" />
            </div>

            <div class="horario__conteudo">
              <ul class="horario__rondas">
                <RondaDoHorario
                  v-for="ronda in bloco.rondas"
                  :key="ronda.chave"
                  :kind="ronda.kind"
                  :linhas="ronda.linhas"
              :resolvidas="ronda.resolvidas"
                  :aberta="rondaAberta(ronda.chave, ronda.linhas.length)"
                  :salvando="hospedagem.salvando"
                  @alternar="alternarRonda(ronda.chave, ronda.linhas.length)"
                  @marcar="marcar"
                  @marcar-todas="marcarRonda"
                />
              </ul>
            </div>
          </div>
        </template>
      </section>

      <!-- ------------------------------------------------------------ o que já passou -->
      <section v-if="passado.length > 0" class="tempo">
        <button type="button" class="recolhido" @click="mostrarPassado = !mostrarPassado">
          <i
            :class="mostrarPassado ? 'pi pi-chevron-down' : 'pi pi-chevron-right'"
            aria-hidden="true"
          />
          {{ t('hotel.rotina.jaPassou', { total: passado.length }, passado.length) }}
        </button>

        <template v-if="mostrarPassado">
          <div v-for="bloco in passado" :key="bloco.hora" class="horario horario--passado">
            <div class="horario__eixo">
              <span class="horario__hora clinic-value">{{ bloco.hora }}</span>
              <span class="horario__linha" aria-hidden="true" />
            </div>

            <div class="horario__conteudo">
              <ul class="horario__rondas">
                <RondaDoHorario
                  v-for="ronda in bloco.rondas"
                  :key="ronda.chave"
                  :kind="ronda.kind"
                  :linhas="ronda.linhas"
              :resolvidas="ronda.resolvidas"
                  :aberta="rondaAberta(ronda.chave, ronda.linhas.length)"
                  :salvando="hospedagem.salvando"
                  @alternar="alternarRonda(ronda.chave, ronda.linhas.length)"
                  @marcar="marcar"
                  @marcar-todas="marcarRonda"
                />
              </ul>
            </div>
          </div>
        </template>
      </section>
    </div>

    <PassagemDialog
      :aberto="passagemAberta"
      :passagem="hospedagem.passagem"
      :cuidadores="hotelStore.cuidadores"
      :salvando="hospedagem.salvando"
      :erro="hospedagem.erroDeAcao"
      @fechar="passagemAberta = false"
      @entregar="({ nota, recebidoPor }) => entregarTurno(nota, recebidoPor)"
      @ir-para="(id) => router.push(`/hotel/hospedagem/${id}`)"
    />

    <HotelDevPanel />

    <HotelTour v-model:aberto="tourAberto" :passos="passosDoTour" />

    <template #actions>
      <Button
        :label="t('hotel.turno.passar')"
        icon="pi pi-sign-out"
        severity="secondary"
        outlined
        size="small"
        @click="passagemAberta = true"
      />
    </template>
  </PartnerPageFrame>
</template>

<style scoped>
.rotina {
  display: grid;
  gap: var(--clinic-space-4);
}

.barra {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--clinic-space-3);
}

/*
 * A pista não cresce sem limite. Sem a largura de base, ela é o único item elástico da barra e
 * viraria uma fita de mil pixels num monitor largo — e uma barra de progresso muito longa deixa
 * de ser lida de relance, que é a única coisa que ela sabe fazer.
 */
.progresso {
  display: grid;
  min-width: 14rem;
  flex: 0 1 26rem;
  gap: 0.35rem;
}

.progresso__frase {
  margin: 0;
  color: var(--clinic-muted);
  font-size: var(--clinic-font-body);
}

.progresso__frase strong {
  margin-inline-end: 0.2rem;
  color: var(--clinic-text);
  font-size: 1.3rem;
  font-weight: 800;
}

.progresso__alerta {
  color: var(--clinic-risk-text);
  font-weight: 750;
}

/* ------------------------------------------------------------------ a pista do dia */

.pista {
  display: flex;
  overflow: hidden;
  height: 0.4rem;
  border-radius: 0.2rem;
  background: var(--clinic-surface-sunken);
}

.pista__feitas {
  background: var(--clinic-accent-deep);
}

.pista__atrasadas {
  background: var(--clinic-risk-text);
}

/* ------------------------------------------------------------------ o filtro */

/*
 * Um Select recolhido, e não uma barra de seis segmentos.
 *
 * A barra ocupava 566 px do topo e pesava mais que a lista que filtra. E filtrar é ação rara
 * aqui: o que se faz nesta tela é marcar tarefa. Recolhido, o controle sai do caminho e o topo
 * volta a ser a frase do dia; o preço são dois toques em vez de um, cobrados só de quem filtra.
 *
 * De quebra some um efeito colateral que a barra tinha: em fileira única ela fixava um piso de
 * largura que, por ser irmã da lista na mesma grade, virava a largura de toda a tela — num
 * telefone de 420 px a prancheta saía com 566 e era cortada.
 */
.filtro {
  width: 15.5rem;
}

.filtro__opcao {
  display: flex;
  width: 100%;
  min-width: 0;
  align-items: center;
  gap: var(--clinic-space-2);
}

/*
 * O ícone tem tamanho próprio aqui, e não o do disco das tarefas: numa fileira de lista ele
 * acompanha o texto, não uma pastilha. A classe pousa na raiz do componente do ícone, e o
 * atributo de escopo vai junto — por isso o seletor alcança mesmo com o painel teleportado.
 */
.filtro__icone {
  width: 1.15rem;
  height: 1.15rem;
  flex: 0 0 auto;
  color: var(--clinic-accent-strong);
}

/* O rótulo estica e empurra a contagem para a borda: a coluna de números fica alinhada. */
.filtro__rotulo {
  overflow: hidden;
  flex: 1;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Quantas são, de cada tipo: é o que decide se vale a pena filtrar antes de filtrar. */
.filtro__conta {
  color: var(--clinic-faint);
  font-size: 0.78rem;
  font-variant-numeric: tabular-nums;
  font-weight: 700;
}

/* ------------------------------------------------------------------ tempos */

.tempo {
  display: grid;
  gap: var(--clinic-space-2);
}

.tempo__titulo {
  display: flex;
  align-items: center;
  margin: 0;
  gap: 0.4rem;
  color: var(--clinic-accent-strong);
  font-size: var(--clinic-font-label);
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.tempo__titulo--calmo {
  color: var(--clinic-faint);
}

.emDia {
  display: flex;
  align-items: center;
  margin: 0;
  padding: var(--clinic-space-5) var(--clinic-space-4);
  border: 1px solid var(--clinic-accent-soft);
  border-radius: var(--clinic-radius-card);
  gap: var(--clinic-space-3);
  background: var(--clinic-accent-tint);
  color: var(--clinic-accent-strong);
  font-weight: 700;
}

.emDia__bicho {
  width: 2.6rem;
  height: 2.6rem;
  flex: 0 0 auto;
}

/* ------------------------------------------------------------------ o eixo do tempo */

/*
 * `minmax(0, 1fr)` e não `1fr`.
 *
 * `1fr` é atalho para `minmax(auto, 1fr)`, e esse `auto` é um piso de largura mínima do conteúdo:
 * a coluna se recusa a encolher abaixo do que as tarefas medem, e num telefone de 420 px a linha
 * saía com 510 e era **cortada** pelo `overflow: clip` do quadro da página — medido: da borda
 * esquerda em 70 até 580. O que ficava de fora eram justamente os botões, encostados à direita.
 * Numa tela cuja premissa é ser usada em pé e com uma mão, isso é a tela inteira sem serventia.
 */
.horario {
  display: grid;
  gap: var(--clinic-space-3);
  grid-template-columns: 3.6rem minmax(0, 1fr);
}

/*
 * Duas fileiras declaradas, e é isto que conserta o eixo.
 *
 * Sem `grid-template-rows`, as duas fileiras automáticas herdavam o `align-content: normal` da
 * grade — que em grid se comporta como `stretch` — e cresciam para preencher a altura do bloco.
 * A etiqueta da hora, que é um chip de 22 px, esticava junto: medida na tela, **220 px** de
 * verde-escuro descendo ao lado das tarefas. Com `auto 1fr`, a hora fica do tamanho da hora e
 * quem cresce é o fio, que é o que deve mesmo crescer.
 */
.horario__eixo {
  display: grid;
  justify-items: center;
  gap: 0.3rem;
  grid-template-rows: auto 1fr;
}

.horario__hora {
  padding: 0.15rem 0.4rem;
  border-radius: 0.4rem;
  background: var(--clinic-accent-deep);
  color: var(--clinic-on-accent);
  font-size: 0.78rem;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
}

.horario--adiante .horario__hora {
  background: transparent;
  color: var(--clinic-muted);
  box-shadow: inset 0 0 0 1px var(--clinic-line);
}

.horario--passado .horario__hora {
  background: transparent;
  color: var(--clinic-faint);
  box-shadow: inset 0 0 0 1px var(--clinic-line-soft);
}

/* A linha que desce ligando um horário ao seguinte: é ela que faz o eixo parecer um eixo. */
.horario__linha {
  width: 2px;
  height: 100%;
  min-height: 0.6rem;
  border-radius: 1px;
  background: var(--clinic-line);
}

.horario--adiante .horario__linha,
.horario--passado .horario__linha {
  background: var(--clinic-line-soft);
}

/*
 * A fronteira do turno: uma régua com a frase no meio, não um cartão.
 *
 * Cartão pesaria como se fosse mais uma tarefa, e não é tarefa nenhuma — é uma mudança de dono
 * da lista. Régua é o que se usa para dizer "daqui para lá é outra coisa" sem pedir a vez.
 */
.fronteira {
  display: flex;
  align-items: center;
  margin: var(--clinic-space-3) 0 var(--clinic-space-2);
  gap: 0.45rem;
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
  font-weight: 650;
}

.fronteira::after {
  height: 1px;
  flex: 1;
  background: var(--clinic-line-soft);
  content: '';
}

.horario__conteudo {
  display: grid;
  gap: var(--clinic-space-1);
  padding-bottom: var(--clinic-space-3);
}

/*
 * As rondas de um horário, empilhadas.
 *
 * A grade de colunas desceu um nível: mora dentro da ronda, onde as tarefas de fato se repetem
 * (ver `RondaDoHorario`). Aqui em cima são duas ou três linhas por horário, e empilhar é o certo
 * — "Refeição" e "Água" lado a lado leriam como duas colunas de uma tabela que não existe.
 */
.horario__rondas {
  display: grid;
  gap: var(--clinic-space-3);
  margin: 0;
  padding: 0;
  list-style: none;
}

.horario--passado .horario__rondas {
  opacity: 0.75;
}

.recolhido {
  display: flex;
  align-items: center;
  justify-self: start;
  padding: 0.25rem 0;
  border: 0;
  gap: 0.4rem;
  background: transparent;
  color: var(--clinic-faint);
  cursor: pointer;
  font: inherit;
  font-size: var(--clinic-font-label);
  font-weight: 700;
}

.recolhido:hover {
  color: var(--clinic-accent-strong);
}

@media (max-width: 720px) {
  .horario {
    grid-template-columns: 2.9rem minmax(0, 1fr);
  }
}
</style>
