<script setup lang="ts">
/**
 * Hoje — o layout de antes, guardado para comparação com as versões novas.
 *
 * O painel de abertura e, embaixo, o caminho que o paciente faz lá dentro: **Recepção** (quem já
 * chegou e espera), **Em consulta** (quem está nas salas agora) e **A seguir** (os próximos
 * horários). Por último, **o que pede ação**, da mais grave para a menos.
 */
import Button from 'primevue/button'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

import UiAbertura from '@/components/ui/UiAbertura.vue'
import UiPagina from '@/components/ui/UiPagina.vue'
import UiPauta from '@/components/ui/UiPauta.vue'
import UiSecao from '@/components/ui/UiSecao.vue'
import { useClinicFormat } from '@/features/clinico/composables/useClinicFormat'
import type { MeuDia } from '@/features/clinico/composables/useMeuDia'
import PetAvatar from '@/features/hotel/components/base/PetAvatar.vue'

defineProps<{ dia: MeuDia }>()

const { t } = useI18n()
const formato = useClinicFormat()
</script>

<template>
  <UiPagina
    class="atual"
    :carregando="dia.carregando"
    :erro="dia.erro"
    bloquear-se-suspenso
    @tentar-de-novo="dia.carregar"
  >
    <template #cabecalho>
      <UiAbertura
        class="hoje__abertura"
        :sobre="dia.dataDeHoje"
        :titulo="dia.fraseDoResumo"
        :resumo="dia.andamentoDoDia"
        :indicadores="dia.indicadores"
        :rotulo-dos-indicadores="t('clinico.meuDia.abertura.indicadores')"
      >
        <template #acoes>
          <Button
            v-if="dia.acaoPrincipal"
            type="button"
            icon="ph ph-stethoscope"
            :label="dia.acaoPrincipal.rotulo"
            @click="dia.abrirProntuario(dia.acaoPrincipal.item)"
          />
          <RouterLink class="p-button p-component p-button-secondary" to="/veterinario/agenda">
            <i class="ph ph-calendar-blank" aria-hidden="true" />
            {{ t('clinico.meuDia.agendaCompleta') }}
          </RouterLink>
        </template>
      </UiAbertura>
    </template>

    <div class="hoje">
      <!-- O caminho do paciente dentro da clínica: recepção, sala, e quem vem depois. -->
      <div class="andar">
        <section class="posto posto--recepcao ui-folha" aria-labelledby="posto-recepcao">
          <header class="posto__cabeca">
            <span class="ui-ladrilho ui-ladrilho--atencao" aria-hidden="true">
              <i class="ph ph-door-open" />
            </span>
            <h2 id="posto-recepcao">{{ t('clinico.hoje.recepcao') }}</h2>
            <span class="posto__total ui-num">{{ dia.naRecepcao.length }}</span>
          </header>

          <ul v-if="dia.naRecepcao.length" class="ui-lista">
            <li v-for="item in dia.naRecepcao" :key="item.id" class="posto__item">
              <div class="posto__quem">
                <PetAvatar
                  :nome="dia.pet(item.petId)?.nome ?? ''"
                  :iniciais="dia.pet(item.petId)?.iniciais ?? ''"
                  :especie="dia.pet(item.petId)?.especie ?? null"
                  :foto-url="dia.pet(item.petId)?.fotoUrl ?? ''"
                  tamanho="md"
                />
                <span class="ui-linha__texto">
                  <strong class="ui-linha__titulo">{{ dia.pet(item.petId)?.nome }}</strong>
                  <span class="ui-linha__meta">{{ dia.linhaDoAtendimento(item) }}</span>
                </span>
                <span class="posto__tempo">
                  <strong class="ui-num">{{ dia.minutosDesde(item.chegadaEm) ?? 0 }}</strong>
                  <small>{{ t('clinico.hoje.minEsperando') }}</small>
                </span>
              </div>

              <ul
                v-if="dia.alertasRelevantes(dia.pet(item.petId)).length"
                class="posto__alertas"
                :aria-label="t('clinico.hoje.alertas')"
              >
                <li
                  v-for="alerta in dia.alertasRelevantes(dia.pet(item.petId))"
                  :key="alerta.id"
                  class="ui-selo"
                  :class="`ui-selo--${alerta.severidade}`"
                >
                  <i class="ph ph-warning" aria-hidden="true" />
                  {{ dia.textoDoAlerta(alerta) }}
                </li>
              </ul>

              <div class="posto__acoes">
                <Button
                  type="button"
                  size="small"
                  icon="ph ph-door-open"
                  :label="t('clinico.hoje.chamar')"
                  @click="dia.abrirProntuario(item)"
                />
                <RouterLink class="ui-mais" :to="dia.rotaDoResumo(item)">
                  {{ t('clinico.resumoDoPaciente.verResumo') }}
                </RouterLink>
              </div>
            </li>
          </ul>
          <p v-else class="ui-vazio">{{ t('clinico.hoje.recepcaoVazia') }}</p>
        </section>

        <section class="posto posto--sala ui-folha" aria-labelledby="posto-sala">
          <header class="posto__cabeca">
            <span class="ui-ladrilho" aria-hidden="true">
              <i class="ph ph-stethoscope" />
            </span>
            <h2 id="posto-sala">{{ t('clinico.hoje.emConsulta') }}</h2>
            <span class="posto__total ui-num">{{ dia.emConsulta.length }}</span>
          </header>

          <ul v-if="dia.emConsulta.length" class="ui-lista">
            <li v-for="item in dia.emConsulta" :key="item.id">
              <RouterLink class="ui-linha posto__linha" :to="dia.rotaDoProntuario(item)">
                <PetAvatar
                  :nome="dia.pet(item.petId)?.nome ?? ''"
                  :iniciais="dia.pet(item.petId)?.iniciais ?? ''"
                  :especie="dia.pet(item.petId)?.especie ?? null"
                  :foto-url="dia.pet(item.petId)?.fotoUrl ?? ''"
                  tamanho="md"
                />
                <span class="ui-linha__texto">
                  <strong class="ui-linha__titulo">{{ dia.pet(item.petId)?.nome }}</strong>
                  <span class="ui-linha__meta">{{ dia.linhaDoAtendimento(item) }}</span>
                </span>
                <span class="posto__tempo">
                  <strong class="ui-num">{{
                    dia.minutosDesde(item.iniciadoEm ?? item.inicio)
                  }}</strong>
                  <small>{{ t('clinico.hoje.minNaSala') }}</small>
                </span>
                <i class="ph ph-caret-right ui-linha__seta" aria-hidden="true" />
              </RouterLink>
            </li>
          </ul>
          <p v-else class="ui-vazio">{{ t('clinico.hoje.salaVazia') }}</p>
        </section>

        <section class="posto posto--seguir ui-folha" aria-labelledby="posto-seguir">
          <header class="posto__cabeca">
            <span class="ui-ladrilho ui-ladrilho--neutro" aria-hidden="true">
              <i class="ph ph-clock" />
            </span>
            <h2 id="posto-seguir">{{ t('clinico.meuDia.aSeguir') }}</h2>
            <span class="posto__total ui-num">{{ dia.aSeguir.length }}</span>
          </header>

          <ul v-if="dia.proximos.length" class="ui-lista posto__linha-do-tempo">
            <li v-for="item in dia.proximos" :key="item.id">
              <RouterLink
                class="ui-linha posto__linha posto__marco"
                :to="dia.focoNaAgenda(item.id)"
              >
                <span class="ui-hora posto__hora">{{ formato.hora(item.inicio) }}</span>
                <span class="posto__no" aria-hidden="true" />
                <PetAvatar
                  :nome="dia.pet(item.petId)?.nome ?? ''"
                  :iniciais="dia.pet(item.petId)?.iniciais ?? ''"
                  :especie="dia.pet(item.petId)?.especie ?? null"
                  :foto-url="dia.pet(item.petId)?.fotoUrl ?? ''"
                  tamanho="sm"
                />
                <span class="ui-linha__texto">
                  <strong class="ui-linha__titulo">{{ dia.pet(item.petId)?.nome }}</strong>
                  <span class="ui-linha__meta">{{ dia.linhaDoAtendimento(item) }}</span>
                </span>
              </RouterLink>
            </li>
          </ul>
          <p v-else class="ui-vazio">{{ t('clinico.meuDia.semProximo') }}</p>

          <footer class="posto__pe">
            <RouterLink class="ui-mais" to="/veterinario/agenda">
              {{ t('clinico.meuDia.agendaCompleta') }}
              <i class="ph ph-arrow-right" aria-hidden="true" />
            </RouterLink>
          </footer>
        </section>
      </div>

      <UiSecao
        id="hoje-pauta"
        :titulo="t('inicio.pauta.titulo')"
        :contagem="dia.linhasDaPauta.length || null"
      >
        <UiPauta v-if="dia.linhasDaPauta.length" :linhas="dia.linhasDaPauta" />
        <p v-else class="ui-folha ui-vazio">
          <strong>{{ t('inicio.pauta.calma') }}</strong>
        </p>
      </UiSecao>
    </div>

    <template #sempre>
      <slot name="sempre" />
    </template>
  </UiPagina>
</template>

<style scoped>
/* A folha na largura inteira da tela: nada de coluna centralizada com as bordas vazias. */
.atual.atual {
  max-width: none;
}

.hoje {
  display: grid;
  gap: 40px;
}

.hoje__abertura {
  flex: 1;
  min-width: 0;
}

/*
 * As três colunas são o caminho do paciente: da esquerda (chegou) para a direita (vem depois). Um
 * nó entre elas diz que é um caminho, e não três listas soltas.
 */
.andar {
  display: grid;
  align-items: start;
  gap: 28px;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.posto {
  position: relative;
  display: flex;
  flex-direction: column;
}

.andar > .posto:not(:last-child)::after {
  position: absolute;
  z-index: 1;
  top: 30px;
  right: -23px;
  display: grid;
  width: 18px;
  height: 18px;
  place-items: center;
  border: 1px solid var(--linha);
  border-radius: 50%;
  background: var(--superficie);
  box-shadow: var(--sombra-xs);
  content: '';
}

.andar > .posto:not(:last-child)::before {
  position: absolute;
  z-index: 2;
  top: 36px;
  right: -16px;
  width: 5px;
  height: 5px;
  border-top: 1.5px solid var(--tinta-3);
  border-right: 1.5px solid var(--tinta-3);
  content: '';
  transform: rotate(45deg);
}

.posto__cabeca {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 18px 24px 16px;
  border-radius: var(--raio-cartao) var(--raio-cartao) 0 0;
}

.posto--recepcao .posto__cabeca {
  background: linear-gradient(
    180deg,
    color-mix(in oklab, var(--atencao-fundo) 70%, var(--superficie)),
    var(--superficie)
  );
}

.posto--sala .posto__cabeca {
  background: linear-gradient(
    180deg,
    color-mix(in oklab, var(--clinica-fundo) 70%, var(--superficie)),
    var(--superficie)
  );
}

.posto__cabeca h2 {
  flex: 1;
  margin: 0;
  font-size: 15.5px;
  font-weight: 650;
  letter-spacing: -0.01em;
}

.posto__total {
  color: var(--tinta);
  font-size: 22px;
  font-weight: 650;
  letter-spacing: -0.02em;
}

.posto > .ui-lista {
  border-top: 1px solid var(--linha-suave);
}

.posto__item {
  display: grid;
  gap: 12px;
  padding: 16px 24px 18px;
}

.posto__quem {
  display: flex;
  align-items: center;
  gap: 12px;
}

/* O número grande: quanto tempo esperando, quanto tempo na sala. */
.posto__tempo {
  display: grid;
  flex: none;
  justify-items: end;
  line-height: 1.05;
}

.posto__tempo strong {
  color: var(--tinta);
  font-size: 24px;
  font-weight: 650;
  letter-spacing: -0.02em;
}

.posto--recepcao .posto__tempo strong {
  color: var(--atencao-tinta);
}

.posto--sala .posto__tempo strong {
  color: var(--clinica-tinta);
}

.posto__tempo small {
  color: var(--tinta-3);
  font-size: 11.5px;
}

.posto__alertas {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 0;
  padding: 0 0 0 52px;
  list-style: none;
}

.posto__alertas .ui-selo {
  flex: 0 1 auto;
  max-width: 100%;
  height: auto;
  min-height: 24px;
  padding-block: 4px;
  white-space: normal;
}

.posto__acoes {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 16px;
  padding-left: 52px;
}

.posto__linha {
  padding-inline: 20px;
}

.posto .ui-vazio {
  flex: 1;
  align-content: center;
  justify-items: center;
  border-top: 1px solid var(--linha-suave);
  color: var(--tinta-3);
  text-align: center;
}

/*
 * "A seguir" como linha do tempo: a hora à esquerda, um nó numa linha vertical, e o paciente. A
 * linha liga os nós de cima a baixo, então a coluna se lê como o resto do dia, e não como uma
 * lista de nomes.
 */
.posto__linha-do-tempo > li + li {
  border-top: 0;
}

.posto__marco {
  min-height: 60px;
  gap: 12px;
}

.posto__hora {
  width: 44px;
  flex: none;
}

.posto__no {
  position: relative;
  align-self: stretch;
  width: 10px;
  flex: none;
}

.posto__no::before {
  position: absolute;
  top: -12px;
  bottom: -12px;
  left: 4px;
  width: 2px;
  background: var(--linha);
  content: '';
}

.posto__linha-do-tempo > li:first-child .posto__no::before {
  top: 50%;
}

.posto__linha-do-tempo > li:last-child .posto__no::before {
  bottom: 50%;
}

.posto__no::after {
  position: absolute;
  top: 50%;
  left: 0;
  width: 10px;
  height: 10px;
  border: 2px solid var(--clinica);
  border-radius: 50%;
  background: var(--superficie);
  content: '';
  transform: translateY(-50%);
}

.posto__linha-do-tempo > li:first-child .posto__no::after {
  background: var(--clinica);
  box-shadow: 0 0 0 4px color-mix(in oklab, var(--clinica) 18%, transparent);
}

.posto__pe {
  margin-top: auto;
  padding: 14px 24px 18px;
  border-top: 1px solid var(--linha-suave);
}

@media (max-width: 1240px) {
  .andar {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .posto--seguir {
    grid-column: 1 / -1;
  }

  .andar > .posto:nth-child(2)::before,
  .andar > .posto:nth-child(2)::after {
    display: none;
  }
}

@media (max-width: 760px) {
  .andar {
    grid-template-columns: minmax(0, 1fr);
  }

  .andar > .posto::before,
  .andar > .posto::after {
    display: none;
  }
}
</style>
