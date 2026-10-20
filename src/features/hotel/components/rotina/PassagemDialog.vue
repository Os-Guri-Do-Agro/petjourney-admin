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
    :style="{ width: 'min(52rem, 96vw)' }"
    class="clinic-dialog hc-tema"
    dismissable-mask
    @update:visible="emit('fechar')"
  >
    <div v-if="passagem" class="passagem">
      <!-- Quem entrega e quem recebe: é o cabeçalho do documento, não uma linha de apoio. -->
      <p class="turno">
        <span class="turno__icone" aria-hidden="true"><i class="ph ph-arrows-left-right" /></span>

        <span class="turno__lado">
          <small>{{ t('hotel.turno.sai') }}</small>
          <strong>{{ formato.turno(passagem.turno.kind) }}</strong>
          <span class="ui-num">
            {{ formato.hora(passagem.turno.inicio) }}–{{ formato.hora(passagem.turno.fim) }}
          </span>
        </span>

        <!-- Ícone, e não o caractere "→": seta de texto não espelha no árabe. -->
        <i class="ph ph-arrow-right turno__seta" aria-hidden="true" />

        <span class="turno__lado">
          <small>{{ t('hotel.turno.entra') }}</small>
          <strong>{{ formato.turno(passagem.seguinte.kind) }}</strong>
          <!-- A janela de quem assume: é o que ele está aceitando ao assinar. -->
          <span class="ui-num">
            {{ formato.hora(passagem.seguinte.inicio) }}–{{ formato.hora(passagem.seguinte.fim) }}
          </span>
        </span>
      </p>

      <!--
        A trava abre a lista. Não é um aviso no rodapé: é o motivo pelo qual o botão não vai
        funcionar, e cada linha leva ao lugar onde se resolve.
      -->
      <section v-if="travadas.length > 0" class="lista lista--trava">
        <h4 class="lista__titulo">
          <i class="ph ph-lock-simple" aria-hidden="true" />
          {{ t('hotel.turno.travado') }}
          <span class="ui-contagem">{{ travadas.length }}</span>
        </h4>

        <ul class="ui-lista lista__itens">
          <li v-for="ocorrencia in travadas" :key="ocorrencia.id" class="linha">
            <i class="ph ph-warning-circle linha__alerta" aria-hidden="true" />

            <span class="linha__texto">
              <strong>{{ formato.ocorrenciaKind(ocorrencia.kind) }}</strong>
              <span>{{ ocorrencia.descricao }}</span>
            </span>

            <Button
              type="button"
              :label="t('hotel.turno.resolver')"
              icon="ph ph-phone"
              severity="secondary"
              outlined
              size="small"
              @click="emit('irPara', ocorrencia.hospedagemId)"
            />
          </li>
        </ul>
      </section>

      <section v-if="passagem.pendencias.boletinsRetidos.length > 0" class="lista">
        <h4 class="lista__titulo">
          <i class="ph ph-envelope-simple" aria-hidden="true" />
          {{ t('hotel.turno.boletinsRetidos') }}
          <span class="ui-contagem">{{ passagem.pendencias.boletinsRetidos.length }}</span>
        </h4>
        <p class="lista__ajuda">
          {{
            t(
              'hotel.turno.boletinsRetidosTexto',
              { total: passagem.pendencias.boletinsRetidos.length },
              passagem.pendencias.boletinsRetidos.length,
            )
          }}
        </p>
      </section>

      <section class="lista">
        <h4 class="lista__titulo">
          <i class="ph ph-list-checks" aria-hidden="true" />
          {{
            t(
              'hotel.turno.pendencias',
              { total: passagem.pendencias.tarefas.length },
              passagem.pendencias.tarefas.length,
            )
          }}
        </h4>

        <p v-if="passagem.pendencias.tarefas.length === 0" class="limpo">
          <i class="ph ph-check-circle" aria-hidden="true" />
          {{ t('hotel.turno.semPendencias') }}
        </p>

        <!--
          Um inventário, em grade: em coluna única treze tarefas davam mil pixels de altura e
          empurravam a assinatura para fora da vista. Em grade o olho varre, que é o que se faz
          com inventário.
        -->
        <ul v-else class="grade">
          <li v-for="linha in passagem.pendencias.tarefas" :key="linha.tarefa.id" class="pendente">
            <span class="pendente__quando">
              <!-- A data só aparece quando não é hoje: a dívida de ontem não é o trabalho do dia. -->
              <span v-if="diaDaPendencia(linha.tarefa.previstaPara)" class="pendente__dia ui-num">
                {{ diaDaPendencia(linha.tarefa.previstaPara) }}
              </span>
              <span class="ui-hora">{{ formato.hora(linha.tarefa.previstaPara) }}</span>
            </span>

            <PetAvatar
              :nome="linha.petNome"
              :iniciais="linha.petIniciais"
              :especie="linha.petEspecie"
              :foto-url="linha.petFotoUrl"
              tamanho="sm"
            />

            <span class="pendente__corpo">
              <strong>{{ formato.tarefaKind(linha.tarefa.kind) }}</strong>
              <span class="pendente__onde">{{ linha.petNome }} · {{ linha.acomodacaoNome }}</span>
              <span v-if="linha.tarefa.descricao" class="pendente__detalhe">
                {{ linha.tarefa.descricao }}
              </span>
            </span>
          </li>
        </ul>
      </section>

      <!-- A assinatura, separada do inventário: é o gesto que fecha tudo o que está acima. -->
      <section class="entrega">
        <div class="campo">
          <label :for="`${idCampo}-quem`">{{ t('hotel.turno.recebidoPor') }}</label>
          <Select
            v-model="recebidoPor"
            :input-id="`${idCampo}-quem`"
            :options="cuidadores.map((item) => ({ valor: item.id, rotulo: item.nome }))"
            option-label="rotulo"
            option-value="valor"
            fluid
            :pt="{ overlay: { class: 'clinic-overlay' } }"
          />
        </div>

        <div class="campo">
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
      <span v-if="travadas.length > 0" class="rodape__trava" role="status">
        <i class="ph ph-lock-simple" aria-hidden="true" />
        {{ t('hotel.turno.travaEntrega', { total: travadas.length }, travadas.length) }}
      </span>

      <Button
        type="button"
        :label="t('hotel.comum.fechar')"
        severity="secondary"
        text
        @click="emit('fechar')"
      />
      <Button
        type="button"
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
  gap: 20px;
}

/* ------------------------------------------------------------------ o turno */

.turno {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px 16px;
  margin: 0;
  padding: 12px 16px;
  border-radius: 12px;
  background: var(--superficie-2);
}

.turno__icone {
  display: grid;
  width: 40px;
  height: 40px;
  flex: none;
  place-items: center;
  border-radius: 10px;
  background: var(--hotel-fundo);
  color: var(--hotel-tinta);
  font-size: 20px;
}

.turno__lado {
  display: grid;
  gap: 0;
  line-height: 1.3;
}

.turno__lado small {
  color: var(--tinta-2);
  font-size: 12.5px;
}

.turno__lado strong {
  color: var(--tinta);
  font-size: 16px;
  font-weight: 600;
}

.turno__lado .ui-num {
  color: var(--tinta-2);
  font-size: 13.5px;
}

.turno__seta {
  color: var(--tinta-3);
  font-size: 16px;
}

[dir='rtl'] .turno__seta {
  scale: -1 1;
}

/* ------------------------------------------------------------------ listas */

.lista {
  display: grid;
  gap: 8px;
}

.lista__titulo {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  color: var(--tinta);
  font-size: 15px;
  font-weight: 600;
}

.lista__titulo i {
  color: var(--tinta-2);
  font-size: 18px;
}

.lista--trava .lista__titulo,
.lista--trava .lista__titulo i {
  color: var(--risco-tinta);
}

.lista__ajuda {
  margin: 0;
  color: var(--tinta-2);
  font-size: 13.5px;
  line-height: 1.5;
}

.lista__itens {
  border: 1px solid color-mix(in oklab, var(--risco) 40%, var(--linha));
  border-radius: 12px;
}

.linha {
  display: flex;
  min-height: 56px;
  align-items: center;
  gap: 12px;
  padding: 8px 10px 8px 14px;
}

.linha__alerta {
  flex: none;
  color: var(--risco-tinta);
  font-size: 20px;
}

.linha__texto {
  display: grid;
  min-width: 0;
  flex: 1;
  gap: 2px;
}

.linha__texto strong {
  color: var(--risco-tinta);
  font-size: 14px;
  font-weight: 600;
}

.linha__texto span {
  color: var(--tinta-2);
  font-size: 13px;
  line-height: 1.4;
}

.limpo {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0;
  padding: 12px 14px;
  border-radius: 12px;
  background: var(--ok-fundo);
  color: var(--ok-tinta);
  font-size: 14px;
  font-weight: 600;
}

/* ------------------------------------------------------------------ inventário */

/*
 * A grade tem teto para o dia ruim: vinte e cinco pendências não podem empurrar a assinatura para
 * fora da vista. Todas as fileiras com a mesma altura, ditada pela mais alta.
 */
.grade {
  display: grid;
  max-height: 15.5rem;
  margin: 0;
  padding: 0;
  gap: 8px;
  grid-auto-rows: 1fr;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 15rem), 1fr));
  list-style: none;
  overflow-y: auto;
  overscroll-behavior: contain;
}

.pendente {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid var(--linha);
  border-radius: var(--raio-controle);
  background: var(--superficie);
}

/* A hora em coluna fixa: é o que alinha a grade na vertical. */
.pendente__quando {
  display: grid;
  width: 44px;
  flex: none;
  padding-top: 4px;
}

.pendente__quando .ui-hora {
  font-size: 14px;
}

/* A dívida de ontem em âmbar: não é urgência de agora, mas também não é trabalho do dia. */
.pendente__dia {
  color: var(--atencao-tinta);
  font-size: 11.5px;
  font-weight: 600;
}

.pendente__corpo {
  display: grid;
  min-width: 0;
  gap: 1px;
}

.pendente__corpo strong {
  color: var(--tinta);
  font-size: 14px;
  font-weight: 600;
}

.pendente__onde,
.pendente__detalhe {
  overflow: hidden;
  font-size: 12.5px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pendente__onde {
  color: var(--tinta-2);
}

.pendente__detalhe {
  color: var(--tinta-3);
}

/* ------------------------------------------------------------------ entrega */

.entrega {
  display: grid;
  gap: 14px;
  padding: 16px;
  border-radius: 12px;
  background: var(--superficie-2);
  grid-template-columns: minmax(12rem, 1fr) minmax(16rem, 2fr);
}

.campo {
  display: grid;
  align-content: start;
  gap: 6px;
}

.campo label {
  color: var(--tinta-2);
  font-size: 12.5px;
  font-weight: 550;
}

.rodape__trava {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-inline-end: auto;
  color: var(--risco-tinta);
  font-size: 13.5px;
  font-weight: 600;
}

@media (max-width: 640px) {
  .entrega {
    grid-template-columns: 1fr;
  }
}
</style>
