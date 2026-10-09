<script setup lang="ts">
/**
 * Passagem de turno.
 *
 * O momento em que a informação mais se perde numa hospedagem — e por isso o diálogo é um
 * **inventário do que fica**, não um campo de texto livre com um botão. O texto existe, e vem
 * depois: ele serve para o que a lista não alcança.
 *
 * A regra R3 fecha a porta aqui. Ocorrência grave sem contato **não passa adiante**: quem entra às
 * 22h não pode herdar uma notícia que o responsável ainda não recebeu, porque a partir dali ninguém
 * mais sabe que ela não foi dada. O botão de entregar fica desabilitado, e ao lado de cada
 * ocorrência travada há o caminho para resolvê-la.
 *
 * ## Por que o inventário é em colunas
 *
 * Treze tarefas numa coluna só produziam um diálogo de mil pixels de altura, com rolagem e com o
 * campo de assinatura empurrado para fora da vista. O inventário é uma **grade**: duas ou três
 * colunas conforme a largura, e a mesma lista cabe em cinco linhas.
 *
 * É possível porque cada item foi reduzido ao que se lê de relance — hora, rosto, o que é e onde.
 * A grade também muda a leitura: em coluna única o olho percorre; em grade ele varre, que é o que
 * se faz com um inventário.
 */
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import Message from 'primevue/message'
import Select from 'primevue/select'
import Textarea from 'primevue/textarea'
import { computed, ref, useId, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import PetAvatar from '../base/PetAvatar.vue'
import { useHotelFormat } from '../../composables/useHotelFormat'
import type { PassagemDeTurno } from '../../data/repositories'
import type { Cuidador } from '../../data/types'

const props = defineProps<{
  aberto: boolean
  passagem: PassagemDeTurno | null
  cuidadores: Cuidador[]
  salvando: boolean
  erro: string
}>()

const emit = defineEmits<{
  fechar: []
  entregar: [payload: { nota: string; recebidoPor: string }]
  irPara: [hospedagemId: string]
}>()

const { t } = useI18n()
const formato = useHotelFormat()
const idCampo = useId()

const nota = ref('')
const recebidoPor = ref('')

const travadas = computed(() => props.passagem?.pendencias.ocorrencias ?? [])

/**
 * A pendência que sobrou de um dia anterior.
 *
 * A lista mostra só `HH:MM`, e na prática ela mistura dois dias: a água que ninguém trocou ontem
 * às 07:00 aparecia idêntica à que vence hoje às 07:00. Numa passagem de turno essa diferença é a
 * informação inteira — uma é o trabalho do dia, a outra é uma dívida de vinte e quatro horas.
 *
 * O dia sai da própria data do turno corrente, e não do relógio: o diálogo já recebe o turno, e
 * consultar o relógio aqui criaria um segundo "hoje" que pode discordar do primeiro.
 */
function diaDaPendencia(iso: string): string {
  const hoje = props.passagem?.turno.inicio.slice(0, 10) ?? ''

  return iso.slice(0, 10) < hoje ? formato.data(iso.slice(0, 10)) : ''
}
const podeEntregar = computed(() => travadas.value.length === 0 && recebidoPor.value !== '')

watch(
  () => props.aberto,
  (aberto) => {
    if (aberto) {
      nota.value = ''
      recebidoPor.value = props.passagem?.seguinte.responsavelId ?? ''
    }
  },
)
</script>

<template>
  <Dialog
    :visible="aberto"
    modal
    :header="t('hotel.turno.titulo')"
    :style="{ width: 'min(58rem, 94vw)' }"
    class="clinic-scope hc-tema"
    @update:visible="emit('fechar')"
  >
    <div v-if="passagem" class="passagem">
      <!-- Quem entrega, quem recebe. É o cabeçalho do documento, não uma linha de apoio. -->
      <p class="turno">
        <span class="turno__lado">
          <span class="turno__rotulo">{{ t('hotel.turno.sai') }}</span>
          <strong>{{ formato.turno(passagem.turno.kind) }}</strong>
          <span class="turno__hora">
            {{ formato.hora(passagem.turno.inicio) }}–{{ formato.hora(passagem.turno.fim) }}
          </span>
        </span>

        <i class="ph ph-arrow-right" aria-hidden="true" />

        <span class="turno__lado">
          <span class="turno__rotulo">{{ t('hotel.turno.entra') }}</span>
          <strong>{{ formato.turno(passagem.seguinte.kind) }}</strong>
          <!-- A janela de quem assume: é o que ele está aceitando ao assinar. -->
          <span class="turno__hora">
            {{ formato.hora(passagem.seguinte.inicio) }}–{{ formato.hora(passagem.seguinte.fim) }}
          </span>
        </span>
      </p>

      <!--
        A trava abre a lista. Não é um aviso no rodapé: é o motivo pelo qual o botão não vai
        funcionar, e cada linha leva ao lugar onde se resolve — um alerta que diz "ligue para
        alguém" sem levar a lugar nenhum transfere o trabalho de descobrir onde é esse lugar.
      -->
      <section v-if="travadas.length > 0" class="bloco bloco--trava">
        <h3 class="bloco__titulo bloco__titulo--trava">
          <i class="ph ph-lock" aria-hidden="true" />
          {{ t('hotel.turno.travado') }}
        </h3>

        <ul class="lista">
          <li v-for="ocorrencia in travadas" :key="ocorrencia.id" class="trava">
            <i class="ph ph-warning-circle" aria-hidden="true" />

            <div class="lista__texto">
              <strong>{{ formato.ocorrenciaKind(ocorrencia.kind) }}</strong>
              <span>{{ ocorrencia.descricao }}</span>
            </div>

            <Button
              :label="t('hotel.turno.resolver')"
              icon="ph ph-phone"
              size="small"
              @click="emit('irPara', ocorrencia.hospedagemId)"
            />
          </li>
        </ul>
      </section>

      <section v-if="passagem.pendencias.boletinsRetidos.length > 0" class="bloco">
        <h3 class="bloco__titulo">{{ t('hotel.turno.boletinsRetidos') }}</h3>
        <p class="bloco__texto">
          {{
            t(
              'hotel.turno.boletinsRetidosTexto',
              { total: passagem.pendencias.boletinsRetidos.length },
              passagem.pendencias.boletinsRetidos.length,
            )
          }}
        </p>
      </section>

      <section class="bloco">
        <h3 class="bloco__titulo">
          {{
            t(
              'hotel.turno.pendencias',
              { total: passagem.pendencias.tarefas.length },
              passagem.pendencias.tarefas.length,
            )
          }}
        </h3>

        <p v-if="passagem.pendencias.tarefas.length === 0" class="bloco__texto">
          {{ t('hotel.turno.semPendencias') }}
        </p>

        <ul v-else class="grade">
          <li v-for="linha in passagem.pendencias.tarefas" :key="linha.tarefa.id" class="tarefa">
            <span class="tarefa__quando">
              <!-- A data só aparece quando não é hoje: repeti-la em toda linha seria ruído. -->
              <span v-if="diaDaPendencia(linha.tarefa.previstaPara)" class="tarefa__dia">
                {{ diaDaPendencia(linha.tarefa.previstaPara) }}
              </span>
              <span class="tarefa__hora clinic-value">
                {{ formato.hora(linha.tarefa.previstaPara) }}
              </span>
            </span>

            <PetAvatar
              :nome="linha.petNome"
              :iniciais="linha.petIniciais"
              :especie="linha.petEspecie"
              :foto-url="linha.petFotoUrl"
              tamanho="xs"
            />

            <span class="tarefa__corpo">
              <strong>{{ formato.tarefaKind(linha.tarefa.kind) }}</strong>
              <span class="tarefa__onde"> {{ linha.petNome }} · {{ linha.acomodacaoNome }} </span>
              <!-- A dose e a porção só aparecem quando existem: linha vazia é ruído numa grade. -->
              <span v-if="linha.tarefa.descricao" class="tarefa__detalhe">
                {{ linha.tarefa.descricao }}
              </span>
            </span>
          </li>
        </ul>
      </section>

      <!--
        A assinatura fica num bloco à parte, separada do inventário.
        Solta logo abaixo da lista, ela parecia mais um item dela — e é o oposto: é o gesto que
        fecha tudo o que está acima.
      -->
      <section class="entrega">
        <div class="campo">
          <label :for="`${idCampo}-quem`">{{ t('hotel.turno.recebidoPor') }}</label>
          <Select
            :input-id="`${idCampo}-quem`"
            v-model="recebidoPor"
            :options="cuidadores.map((item) => ({ valor: item.id, rotulo: item.nome }))"
            option-label="rotulo"
            option-value="valor"
            fluid
          />
        </div>

        <div class="campo campo--nota">
          <label :for="`${idCampo}-nota`">{{ t('hotel.turno.nota') }}</label>
          <Textarea
            :id="`${idCampo}-nota`"
            v-model="nota"
            rows="2"
            auto-resize
            fluid
            :placeholder="t('hotel.turno.notaDica')"
          />
        </div>
      </section>

      <Message v-if="erro" severity="error" :closable="false">{{ t(erro) }}</Message>
    </div>

    <template #footer>
      <Button :label="t('hotel.comum.fechar')" severity="secondary" text @click="emit('fechar')" />
      <Button
        :label="t('hotel.turno.entregar')"
        icon="ph ph-sign-out"
        :loading="salvando"
        :disabled="!podeEntregar"
        @click="emit('entregar', { nota, recebidoPor })"
      />
    </template>
  </Dialog>
</template>

<style scoped>
.passagem {
  display: grid;
  gap: var(--clinic-space-4);
}

/* ------------------------------------------------------------------ o turno */

.turno {
  display: flex;
  align-items: center;
  margin: 0;
  padding: var(--clinic-space-3) var(--clinic-space-4);
  border: 1px solid var(--clinic-line);
  border-radius: var(--clinic-radius-control);
  gap: var(--clinic-space-4);
  background: var(--clinic-surface-soft);
}

.turno__lado {
  display: flex;
  align-items: baseline;
  gap: 0.4rem;
}

.turno__rotulo {
  color: var(--clinic-faint);
  font-size: 0.75rem;
  font-weight: 600;
}

.turno__lado strong {
  font-size: var(--clinic-font-body);
  font-weight: 750;
}

.turno__hora {
  color: var(--clinic-muted);
  font-size: var(--clinic-font-label);
  font-variant-numeric: tabular-nums;
}

.turno > .ph-arrow-right {
  color: var(--clinic-accent-strong);
  font-size: 0.75rem;
}

/* ------------------------------------------------------------------ blocos */

.bloco {
  display: grid;
  gap: var(--clinic-space-2);
}

/*
 * O impedimento segue o mesmo padrão do painel do dia: cartão branco, urgência num disco cheio.
 * Preenchimento rosa de ponta a ponta era o que deixava a tela agressiva — e um módulo com dois
 * jeitos de desenhar a mesma gravidade ensina que a cor não quer dizer nada.
 */
.bloco__titulo--trava {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  color: var(--clinic-risk-text);
}

.bloco__titulo--trava .ph {
  font-size: 0.7rem;
}

.trava {
  padding: var(--clinic-space-3) var(--clinic-space-4);
  border: 1px solid var(--clinic-line);
  border-radius: var(--clinic-radius-control);
  background: var(--clinic-surface);
}

.trava > .ph-warning-circle {
  display: grid;
  width: 1.6rem;
  height: 1.6rem;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 50%;
  background: var(--clinic-risk-text);
  color: var(--clinic-surface);
  font-size: 0.76rem;
}

.trava .lista__texto strong {
  color: var(--clinic-risk-text);
}

.trava .lista__texto {
  flex: 1;
}

.bloco__titulo {
  margin: 0;
  color: var(--clinic-text);
  font-size: 0.9375rem;
  font-weight: 650;
  letter-spacing: -0.01em;
}

.bloco__texto {
  margin: 0;
  color: var(--clinic-muted);
  font-size: var(--clinic-font-label);
}

/* ------------------------------------------------------------------ travas */

.lista {
  display: grid;
  gap: var(--clinic-space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}

.lista li {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--clinic-space-2);
}

.lista__texto {
  display: grid;
  min-width: 0;
  gap: 0.05rem;
}

.lista__texto strong {
  font-size: var(--clinic-font-label);
  font-weight: 750;
}

.lista__texto span {
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
}

/* ------------------------------------------------------------------ inventário */

/*
 * O inventário é uma grade, não uma coluna.
 *
 * Treze tarefas empilhadas davam mil pixels de altura e empurravam a assinatura para fora da
 * vista. Em duas ou três colunas a mesma lista cabe em cinco linhas — e o olho varre, que é o que
 * se faz com inventário, em vez de percorrer.
 *
 * O teto com rolagem existe para o dia ruim: vinte e cinco pendências não podem transformar o
 * diálogo num documento sem fim.
 */
.grade {
  display: grid;
  /*
   * O teto existe para o dia ruim: vinte e cinco pendências não podem transformar o diálogo num
   * documento sem fim, e a assinatura precisa continuar à vista.
   *
   * Vinte e seis rem e não vinte: com os cartões de altura igual, cinco fileiras dão 322 px e o
   * teto anterior cortava por **dois pixels** — a lista inteira ganhava barra de rolagem para
   * esconder nada. O teto agora cai depois de seis fileiras, que é quando ele de fato serve.
   */
  max-height: 26rem;
  margin: 0;
  padding: 0;
  gap: var(--clinic-space-2);
  /*
   * Todas as fileiras com a mesma altura, ditada pela mais alta.
   *
   * Um piso em `rem` no cartão não resolve: ele depende da base de fonte, e a altura natural de um
   * cartão de três linhas passou por cima dele — a grade voltou a ter degraus de 2 px. `1fr` mede
   * a fileira mais alta e dá o mesmo a todas, sem depender de número nenhum escrito à mão.
   */
  grid-auto-rows: 1fr;
  grid-template-columns: repeat(auto-fill, minmax(15.5rem, 1fr));
  list-style: none;
  overflow-y: auto;
  overscroll-behavior: contain;
}

/*
 * Cada pendência é um cartão, e não uma célula de tabela.
 *
 * A primeira versão desenhava as divisórias com um truque conhecido — fundo escuro no contêiner e
 * um vão de 1px entre os itens. Funciona enquanto a grade está cheia: na última fileira, as
 * células que sobram viram **buracos cinzas**, e buraco emparelhado com conteúdo lê como algo que
 * faltou carregar. Cartão independente não tem última fileira.
 */
.tarefa {
  display: flex;
  align-items: flex-start;
  padding: var(--clinic-space-2) var(--clinic-space-3);
  border: 1px solid var(--clinic-line-soft);
  border-radius: var(--clinic-radius-control);
  gap: var(--clinic-space-2);
  background: var(--clinic-surface);
}

/*
 * A hora em coluna fixa e numeral tabular.
 * É o que alinha a grade na vertical: sem largura fixa, "07:00" e "22:00" deslocam o rosto e o
 * nome de cada célula, e a grade deixa de parecer uma grade.
 */
.tarefa__quando {
  display: grid;
  width: 2.9rem;
  flex: 0 0 auto;
  padding-block-start: 0.05rem;
  gap: 0;
  text-align: start;
}

.tarefa__hora {
  color: var(--clinic-text);
  font-size: 0.76rem;
  font-variant-numeric: tabular-nums;
  font-weight: 800;
}

/* A dívida de ontem fica em âmbar: não é urgência de agora, mas também não é trabalho do dia. */
.tarefa__dia {
  color: var(--clinic-attention-text);
  font-size: 0.58rem;
  font-variant-numeric: tabular-nums;
  font-weight: 800;
}

.tarefa__corpo {
  display: grid;
  min-width: 0;
  gap: 0.02rem;
}

.tarefa__corpo strong {
  font-size: var(--clinic-font-label);
  font-weight: 750;
}

.tarefa__onde,
.tarefa__detalhe {
  overflow: hidden;
  font-size: 0.68rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tarefa__onde {
  color: var(--clinic-muted);
}

.tarefa__detalhe {
  color: var(--clinic-faint);
}

/* ------------------------------------------------------------------ entrega */

.entrega {
  display: grid;
  padding: var(--clinic-space-4);
  border: 1px solid var(--clinic-line);
  border-radius: var(--clinic-radius-control);
  gap: var(--clinic-space-3);
  grid-template-columns: minmax(12rem, 1fr) minmax(16rem, 2fr);
  background: var(--clinic-surface-soft);
}

@media (max-width: 640px) {
  .entrega {
    grid-template-columns: 1fr;
  }
}

.campo {
  display: grid;
  /* Linhas no topo: sem isto, o campo ao lado de um mais alto desce e a fileira sai torta. */
  align-content: start;
  gap: 0.25rem;
}

.campo label {
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
  font-weight: 700;
}
</style>
