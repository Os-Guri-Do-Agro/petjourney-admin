<script setup lang="ts">
/**
 * O gerenciamento de rotina, **ao lado da prancheta**.
 *
 * ## Por que ao lado, e não atrás de um botão
 *
 * A rotina e o gerenciamento dela são a mesma conversa: quem decide mudar o horário da água está
 * olhando a água atrasada das 07:00; quem aprova um passeio a mais está vendo que o passeio de hoje
 * não foi feito. Uma camada modal por cima da lista esconderia exatamente o que a pessoa precisa
 * consultar para decidir. Lado a lado, a linha do tempo é o **que está acontecendo** e esta coluna
 * é o **que se pode mudar**. No telefone a coluna desce para baixo da prancheta.
 *
 * ## O que este painel não faz
 *
 * Não edita os horários da casa. Publicar mexe no trabalho de todos os hóspedes de uma vez, e essa
 * decisão pede a previsão do que ela vai fazer — que é uma tela inteira. Aqui a rotina da casa
 * aparece em **leitura**, com o caminho até onde ela se edita.
 */
import { PhSparkle } from '@phosphor-icons/vue'
import Button from 'primevue/button'
import Select from 'primevue/select'
import { computed, useId } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

import PropostaDeRotina from './PropostaDeRotina.vue'
import IconeDeTarefa from '../base/IconeDeTarefa.vue'
import PetAvatar from '../base/PetAvatar.vue'
import { useHotelFormat } from '../../composables/useHotelFormat'
import type { HospedeParaRotina } from '../../data/repositories'
import type { ClockTime, ItemDeRotina, TarefaDaCasaKind } from '../../data/types'
import type { PropostaDeRotina as Proposta } from '../../domain/rotina-sugerida'

const props = defineProps<{
  /** A rotina que a casa faz por todos. Aqui é só leitura. */
  rotinaDaCasa: ItemDeRotina[]
  hospedes: HospedeParaRotina[]
  /** Vazio enquanto ninguém escolheu de quem se está falando. */
  hospedagemId: string
  proposta: Proposta | null
  gerando: boolean
  salvando: boolean
  erro: string
}>()

const emit = defineEmits<{
  'atualizar:hospedagemId': [id: string]
  propor: []
  medicacao: []
  descartar: []
  aprovar: [
    payload: {
      hospedagemId: string
      sugestoes: { kind: TarefaDaCasaKind; horarios: ClockTime[]; motivo: string }[]
    },
  ]
}>()

const { t } = useI18n()
const formato = useHotelFormat()
const idCampo = useId()

const ativos = computed(() =>
  props.rotinaDaCasa.filter((item) => item.ativo && item.horarios.length > 0),
)

const escolhido = computed(() =>
  props.hospedes.find((item) => item.hospedagemId === props.hospedagemId),
)

/**
 * Há proposta em cena? Com ela, a rotina da casa sai — a proposta já a mostra em "a casa já faz",
 * e dizer a mesma lista duas vezes na mesma coluna custa justamente a altura que falta à revisão.
 */
const temProposta = computed(
  () => Boolean(props.hospedagemId) && (Boolean(props.proposta) || props.gerando),
)
</script>

<template>
  <aside class="painel" :class="{ 'painel--proposta': temProposta }">
    <!-- ------------------------------------------------------------ a rotina da casa -->
    <section v-if="!temProposta" class="bloco ui-folha" :aria-labelledby="`${idCampo}-casa`">
      <header class="bloco__cabeca">
        <span class="bloco__icone" aria-hidden="true"><i class="ph ph-house-line" /></span>
        <div class="bloco__titulos">
          <h2 :id="`${idCampo}-casa`">{{ t('hotel.gerenciar.padrao') }}</h2>
          <p>{{ t('hotel.rotina.nova.padraoDica') }}</p>
        </div>
      </header>

      <ul class="casa">
        <li v-for="item in ativos" :key="item.id" class="casa__linha">
          <span class="casa__icone" aria-hidden="true"><IconeDeTarefa :kind="item.kind" /></span>
          <span class="casa__nome">{{ formato.tarefaKind(item.kind) }}</span>
          <span class="casa__horarios">
            <span v-for="hora in item.horarios" :key="hora" class="casa__hora ui-hora">
              {{ hora }}
            </span>
          </span>
        </li>
      </ul>

      <footer class="bloco__pe">
        <RouterLink class="ui-mais" to="/hotel/rotina-padrao">
          {{ t('hotel.rotina.nova.editarPadrao') }}
          <i class="ph ph-arrow-right ui-mais__seta" aria-hidden="true" />
        </RouterLink>
      </footer>
    </section>

    <!-- ------------------------------------------------------------ o que muda por hóspede -->
    <section
      class="bloco ui-folha"
      :class="{ 'bloco--proposta': temProposta }"
      :aria-labelledby="`${idCampo}-gerenciar`"
    >
      <header class="bloco__cabeca">
        <span class="bloco__icone" aria-hidden="true"><i class="ph ph-sliders-horizontal" /></span>
        <div class="bloco__titulos">
          <h2 :id="`${idCampo}-gerenciar`">{{ t('hotel.gerenciar.titulo') }}</h2>
        </div>
      </header>

      <div class="bloco__corpo">
        <!--
          Escolhido o hóspede e aberta a proposta, o seletor vira uma linha: rosto, nome e um
          caminho de volta. Manter o campo aberto repetiria uma escolha que já foi feita.
        -->
        <div v-if="temProposta && escolhido" class="atual">
          <PetAvatar
            :nome="escolhido.petNome"
            :iniciais="escolhido.petIniciais"
            :especie="escolhido.petEspecie"
            :foto-url="escolhido.petFotoUrl"
            tamanho="md"
          />
          <span class="atual__texto">
            <strong>{{ escolhido.petNome }}</strong>
            <span>{{ escolhido.acomodacaoNome }}</span>
          </span>

          <Button
            type="button"
            :label="t('hotel.gerenciar.trocar')"
            icon="ph ph-arrows-clockwise"
            severity="secondary"
            text
            size="small"
            @click="emit('atualizar:hospedagemId', '')"
          />
        </div>

        <p v-if="!temProposta" class="bloco__dica">{{ t('hotel.rotina.nova.proporDica') }}</p>

        <div v-if="!temProposta" class="campo">
          <label :for="`${idCampo}-hospede`">{{ t('hotel.proposta.escolherHospede') }}</label>

          <Select
            :input-id="`${idCampo}-hospede`"
            :model-value="hospedagemId"
            :options="hospedes"
            option-label="petNome"
            option-value="hospedagemId"
            fluid
            :pt="{ overlay: { class: 'clinic-overlay' } }"
            @update:model-value="(id: string) => emit('atualizar:hospedagemId', id)"
          >
            <!--
              O painel do Select é teleportado para fora da página, então `:deep` daqui não
              alcança a linha dele. O que alcança é o conteúdo do slot, que leva o escopo junto.
            -->
            <template #value>
              <span v-if="escolhido" class="opcao">
                <PetAvatar
                  :nome="escolhido.petNome"
                  :iniciais="escolhido.petIniciais"
                  :especie="escolhido.petEspecie"
                  :foto-url="escolhido.petFotoUrl"
                  tamanho="sm"
                />
                <span class="opcao__nome">{{ escolhido.petNome }}</span>
                <span class="opcao__onde">{{ escolhido.acomodacaoNome }}</span>
              </span>

              <span v-else class="opcao opcao--vazia">
                {{ t('hotel.proposta.escolherHospede') }}
              </span>
            </template>

            <template #option="{ option }">
              <span class="opcao">
                <PetAvatar
                  :nome="option.petNome"
                  :iniciais="option.petIniciais"
                  :especie="option.petEspecie"
                  :foto-url="option.petFotoUrl"
                  tamanho="sm"
                />
                <span class="opcao__nome">{{ option.petNome }}</span>
                <span class="opcao__onde">{{ option.acomodacaoNome }}</span>
              </span>
            </template>
          </Select>
        </div>

        <!--
          Com a proposta aberta, "Propor" sai (já está proposto), mas "Acrescentar" fica: é comum
          revisar a proposta e lembrar do remédio que chegou com o responsável.
        -->
        <div class="acoes">
          <Button
            v-if="!temProposta"
            type="button"
            class="acoes__botao"
            :label="t('hotel.gerenciar.propor')"
            severity="secondary"
            outlined
            :disabled="!hospedagemId || gerando"
            @click="emit('propor')"
          >
            <template #icon>
              <PhSparkle class="acoes__icone" weight="duotone" aria-hidden="true" />
            </template>
          </Button>

          <!--
            Também depende do hóspede escolhido: as quatro portas dele (remédio, ajuste, serviço,
            cuidado) precisam de um animal, e o seletor está logo acima — duas listas do mesmo
            hóspede na mesma tela é a forma de registrar a medicação no animal errado.
          -->
          <Button
            type="button"
            class="acoes__botao"
            :label="t('hotel.acrescentar.titulo')"
            icon="ph ph-plus-circle"
            severity="secondary"
            outlined
            :disabled="!hospedagemId"
            @click="emit('medicacao')"
          />
        </div>

        <!--
          Com proposta, ela ocupa o resto do bloco — ao lado da lista que vai alterar, e não por
          cima dela: revisar com a rotina de hoje à vista, e não de memória.
        -->
        <PropostaDeRotina
          v-if="temProposta"
          class="bloco__proposta"
          sem-hospede
          :hospedes="hospedes"
          :hospedagem-id="hospedagemId"
          :proposta="proposta"
          :gerando="gerando"
          :salvando="salvando"
          :erro="erro"
          @fechar="emit('descartar')"
          @atualizar:hospedagem-id="(id: string) => emit('atualizar:hospedagemId', id)"
          @aprovar="(payload) => emit('aprovar', payload)"
        />
      </div>
    </section>
  </aside>
</template>

<style scoped>
.painel {
  display: grid;
  align-content: start;
  gap: 20px;
}

.bloco {
  display: grid;
  overflow: hidden;
}

.bloco__cabeca {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 18px 14px;
  border-bottom: 1px solid var(--linha);
}

.bloco__icone {
  display: grid;
  width: 36px;
  height: 36px;
  flex: none;
  place-items: center;
  border-radius: 10px;
  background: var(--superficie-2);
  color: var(--tinta-2);
  font-size: 18px;
}

.bloco__titulos {
  display: grid;
  min-width: 0;
  gap: 1px;
}

.bloco__titulos h2 {
  margin: 0;
  color: var(--tinta);
  font-size: 15px;
  font-weight: 600;
}

.bloco__titulos p {
  margin: 0;
  color: var(--tinta-2);
  font-size: 13px;
  line-height: 1.4;
}

.bloco__dica {
  margin: 0;
  color: var(--tinta-2);
  font-size: 13.5px;
  line-height: 1.45;
}

.bloco__corpo {
  display: grid;
  gap: 14px;
  padding: 16px 18px 18px;
}

.bloco__pe {
  padding: 4px 18px 16px;
}

.ui-mais__seta {
  font-size: 13px;
}

[dir='rtl'] .ui-mais__seta {
  scale: -1 1;
}

/* ------------------------------------------------------------------ a rotina da casa */

.casa {
  display: grid;
  margin: 0;
  padding: 6px 0;
  list-style: none;
}

.casa__linha {
  display: grid;
  align-items: center;
  gap: 10px;
  min-height: 46px;
  padding: 6px 18px;
  grid-template-columns: auto auto minmax(0, 1fr);
}

.casa__linha + .casa__linha {
  border-top: 1px solid var(--linha);
}

.casa__icone {
  display: grid;
  width: 28px;
  height: 28px;
  place-items: center;
  border-radius: 8px;
  background: var(--superficie-2);
  color: var(--tinta-2);
  font-size: 12px;
}

.casa__nome {
  color: var(--tinta);
  font-size: 14px;
  font-weight: 600;
}

/* Os horários encostam no fim: viram uma coluna de números que se confere de cima a baixo. */
.casa__horarios {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 4px 10px;
}

.casa__hora.ui-hora {
  color: var(--tinta-2);
  font-size: 14px;
  font-weight: 550;
}

/* ------------------------------------------------------------------ o hóspede e as ações */

.campo {
  display: grid;
  gap: 6px;
}

.campo label {
  color: var(--tinta-2);
  font-size: 12.5px;
  font-weight: 550;
}

.opcao {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 10px;
}

.opcao--vazia {
  color: var(--tinta-3);
}

.opcao__nome {
  overflow: hidden;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.opcao__onde {
  margin-inline-start: auto;
  color: var(--tinta-2);
  font-size: 13px;
}

.acoes {
  display: grid;
  gap: 8px;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 150px), 1fr));
}

.acoes__botao.p-button {
  min-height: 40px;
}

.acoes__icone {
  width: 18px;
  height: 18px;
}

.atual {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--linha);
}

.atual__texto {
  display: grid;
  min-width: 0;
  flex: 1;
  gap: 1px;
}

.atual__texto strong {
  overflow: hidden;
  color: var(--tinta);
  font-size: 15px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.atual__texto span {
  color: var(--tinta-2);
  font-size: 13px;
}
</style>
