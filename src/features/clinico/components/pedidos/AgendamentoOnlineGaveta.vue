<script setup lang="ts">
/**
 * Como a clínica recebe pedidos pela internet.
 *
 * Configuração rara, por isso recolhida numa gaveta lateral e não espalhada pela tela de trabalho
 * — nem num diálogo no meio dela, que tapava a caixa que a configuração muda.
 *
 * Em cima, a chave-mestra num cartão: é a única coisa aqui que muda tudo, e desligada apaga o resto
 * (que fica à vista, travado). Embaixo, uma seção por pergunta, separadas por fio e não por caixa:
 * por quais caminhos o responsável pede, quais serviços, quem atende, os prazos, e o que dizer a
 * quem tem uma emergência. Cada controle no feitio da pergunta: os caminhos em dois cartões de
 * escolha, os serviços em fichas, as pessoas em lista (o nome inteiro cabe), os prazos em linhas
 * com o número à direita.
 *
 * O aceite automático nasce desligado e diz o que faz em uma frase: é a única chave aqui que tira a
 * recepção do caminho, e ninguém deveria ligá-la sem entender isso.
 */
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import Drawer from 'primevue/drawer'
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import InputNumber from 'primevue/inputnumber'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import ToggleSwitch from 'primevue/toggleswitch'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { ESPECIALIDADE_NO_APP } from '../../data/projecao-do-responsavel'
import type { AgendamentoOnline } from '../../data/types'
import { useClinicoStore } from '../../stores/clinico'

const props = defineProps<{
  visivel: boolean
  configuracao: AgendamentoOnline | null
  salvando: boolean
}>()

const emit = defineEmits<{
  'update:visivel': [valor: boolean]
  salvar: [configuracao: AgendamentoOnline]
}>()

const { t, te } = useI18n()
const clinico = useClinicoStore()

/**
 * A especialidade com o rótulo que o responsável vê no app: a chave do portal (`clinicaGeral`) vira
 * a da lista do app (`CLINICO_GERAL`); a que não está na lista vem por extenso.
 */
function especialidade(chave: string) {
  const noApp = ESPECIALIDADE_NO_APP[chave] ?? chave
  const rotulo = `clinico.pedidos.app.especialidade.${noApp}`

  return te(rotulo) ? t(rotulo) : noApp
}

const rascunho = ref<AgendamentoOnline | null>(null)

/** Cópia funda e sem reatividade: o `structuredClone` recusa o proxy do Vue. */
function copia<T>(valor: T): T {
  return JSON.parse(JSON.stringify(valor)) as T
}

watch(
  () => [props.visivel, props.configuracao] as const,
  ([visivel, configuracao]) => {
    if (visivel && configuracao) {
      rascunho.value = copia(configuracao)
    }
  },
  { immediate: true },
)

const aberto = computed({
  get: () => props.visivel,
  set: (valor: boolean) => emit('update:visivel', valor),
})

/** Cirurgia e emergência nunca entram: são as que pedem conversa antes de horário. */
const servicos = computed(() =>
  clinico.tipos.filter((tipo) => tipo.kind !== 'cirurgia' && tipo.kind !== 'emergencia'),
)

const profissionais = computed(() => clinico.profissionais.filter((item) => item.ativo))

/** Sem nenhum caminho ligado, o app não teria o que oferecer: o segundo não desliga se o primeiro já está. */
const algumCaminho = computed(
  () =>
    rascunho.value !== null &&
    (rascunho.value.permiteEscolherHorario || rascunho.value.permiteMelhorHorario),
)

const valido = computed(
  () =>
    rascunho.value !== null &&
    (!rascunho.value.ativo ||
      (algumCaminho.value &&
        rascunho.value.typeIds.length > 0 &&
        rascunho.value.professionalIds.length > 0)) &&
    rascunho.value.emergencia.telefone.trim().length > 0,
)

function salvar() {
  if (rascunho.value && valido.value) {
    emit('salvar', copia(rascunho.value))
  }
}
</script>

<template>
  <Drawer
    v-model:visible="aberto"
    position="right"
    class="hc-tema config-gaveta"
    :style="{ width: 'min(36rem, 96vw)' }"
    :header="t('clinico.pedidos.config.titulo')"
  >
    <div v-if="rascunho" class="config clinic-scope">
      <!-- A chave-mestra: o único cartão da gaveta, porque é a única coisa que muda tudo. -->
      <label class="config__mestre" :class="{ 'config__mestre--ligado': rascunho.ativo }">
        <span class="config__mestre-icone" aria-hidden="true">
          <i class="ph" :class="rascunho.ativo ? 'ph-broadcast' : 'ph-pause'" />
        </span>
        <span class="config__texto">
          <strong>{{ t('clinico.pedidos.config.ativo') }}</strong>
          <span>{{ t('clinico.pedidos.config.ativoAjuda') }}</span>
        </span>
        <ToggleSwitch v-model="rascunho.ativo" />
      </label>

      <!-- Desligada a chave, tudo aqui fica à vista e travado: o `fieldset` desabilita de uma vez. -->
      <fieldset class="config__pedidos" :disabled="!rascunho.ativo">
        <section class="config__secao">
          <h3 class="config__titulo">
            <i class="ph ph-signpost" aria-hidden="true" />
            {{ t('clinico.pedidos.config.caminhos') }}
          </h3>

          <div class="config__caminhos">
            <label
              class="config__caminho"
              :class="{ 'config__caminho--ligado': rascunho.permiteEscolherHorario }"
            >
              <span class="config__caminho-topo">
                <i class="ph ph-calendar-check" aria-hidden="true" />
                <Checkbox
                  v-model="rascunho.permiteEscolherHorario"
                  binary
                  :disabled="!rascunho.permiteMelhorHorario && rascunho.permiteEscolherHorario"
                />
              </span>
              <strong>{{ t('clinico.pedidos.config.escolherHorario') }}</strong>
              <span>{{ t('clinico.pedidos.config.escolherHorarioAjuda') }}</span>
            </label>

            <label
              class="config__caminho"
              :class="{ 'config__caminho--ligado': rascunho.permiteMelhorHorario }"
            >
              <span class="config__caminho-topo">
                <i class="ph ph-hand-tap" aria-hidden="true" />
                <Checkbox
                  v-model="rascunho.permiteMelhorHorario"
                  binary
                  :disabled="!rascunho.permiteEscolherHorario && rascunho.permiteMelhorHorario"
                />
              </span>
              <strong>{{ t('clinico.pedidos.config.melhorHorario') }}</strong>
              <span>{{ t('clinico.pedidos.config.melhorHorarioAjuda') }}</span>
            </label>
          </div>

          <label class="config__linha">
            <span class="config__texto">
              <strong>{{ t('clinico.pedidos.config.aceitarSozinho') }}</strong>
              <span>{{ t('clinico.pedidos.config.aceitarSozinhoAjuda') }}</span>
            </span>
            <ToggleSwitch
              v-model="rascunho.aceitarSozinho"
              :disabled="!rascunho.permiteEscolherHorario"
            />
          </label>
        </section>

        <section class="config__secao">
          <h3 class="config__titulo">
            <i class="ph ph-list-checks" aria-hidden="true" />
            {{ t('clinico.pedidos.config.servicos') }}
          </h3>

          <div class="config__fichas">
            <label
              v-for="tipo in servicos"
              :key="tipo.id"
              class="config__ficha"
              :class="{ 'config__ficha--ligada': rascunho.typeIds.includes(tipo.id) }"
            >
              <Checkbox v-model="rascunho.typeIds" :value="tipo.id" />
              {{ tipo.nome }}
            </label>
          </div>
        </section>

        <section class="config__secao">
          <h3 class="config__titulo">
            <i class="ph ph-users" aria-hidden="true" />
            {{ t('clinico.pedidos.config.profissionais') }}
          </h3>

          <ul class="config__pessoas">
            <li v-for="profissional in profissionais" :key="profissional.id">
              <label class="config__pessoa">
                <span class="config__rosto" aria-hidden="true">{{ profissional.iniciais }}</span>
                <span class="config__texto">
                  <strong>{{ profissional.nome }}</strong>
                  <span>{{ especialidade(profissional.especialidade) }}</span>
                </span>
                <Checkbox v-model="rascunho.professionalIds" :value="profissional.id" />
              </label>
            </li>
          </ul>
        </section>

        <section class="config__secao">
          <h3 class="config__titulo">
            <i class="ph ph-clock" aria-hidden="true" />
            {{ t('clinico.pedidos.config.prazos') }}
          </h3>

          <div class="config__prazos">
            <label class="config__prazo">
              <span class="config__texto">
                <strong>{{ t('clinico.pedidos.config.prazo') }}</strong>
                <span>{{ t('clinico.pedidos.config.prazoAjuda') }}</span>
              </span>
              <InputNumber
                v-model="rascunho.prazoDeRespostaHoras"
                class="config__passo"
                :min="1"
                :max="48"
                show-buttons
                button-layout="horizontal"
                increment-button-icon="ph ph-plus"
                decrement-button-icon="ph ph-minus"
                :suffix="` ${t('clinico.pedidos.config.horas')}`"
              />
            </label>
            <label class="config__prazo">
              <span class="config__texto">
                <strong>{{ t('clinico.pedidos.config.antecedencia') }}</strong>
                <span>{{ t('clinico.pedidos.config.antecedenciaAjuda') }}</span>
              </span>
              <InputNumber
                v-model="rascunho.antecedenciaMinimaHoras"
                class="config__passo"
                :min="0"
                :max="72"
                show-buttons
                button-layout="horizontal"
                increment-button-icon="ph ph-plus"
                decrement-button-icon="ph ph-minus"
                :suffix="` ${t('clinico.pedidos.config.horas')}`"
              />
            </label>
            <label class="config__prazo">
              <span class="config__texto">
                <strong>{{ t('clinico.pedidos.config.horizonte') }}</strong>
                <span>{{ t('clinico.pedidos.config.horizonteAjuda') }}</span>
              </span>
              <InputNumber
                v-model="rascunho.horizonteDias"
                class="config__passo"
                :min="7"
                :max="90"
                show-buttons
                button-layout="horizontal"
                increment-button-icon="ph ph-plus"
                decrement-button-icon="ph ph-minus"
                :suffix="` ${t('clinico.pedidos.config.dias')}`"
              />
            </label>
          </div>
        </section>
      </fieldset>

      <!-- A emergência vale mesmo com os pedidos pausados: é o contato, não o pedido. -->
      <section class="config__secao">
        <h3 class="config__titulo">
          <i class="ph ph-first-aid" aria-hidden="true" />
          {{ t('clinico.pedidos.config.emergencia') }}
        </h3>
        <p class="config__ajuda">{{ t('clinico.pedidos.config.emergenciaAjuda') }}</p>

        <div class="config__prazos">
          <label class="config__prazo config__prazo--contato">
            <span class="config__texto">
              <strong>{{ t('clinico.pedidos.config.telefone') }}</strong>
            </span>
            <IconField>
              <InputIcon class="ph ph-phone" />
              <InputText v-model="rascunho.emergencia.telefone" inputmode="tel" fluid />
            </IconField>
          </label>
          <label class="config__prazo config__prazo--contato">
            <span class="config__texto">
              <strong>{{ t('clinico.pedidos.config.whatsapp') }}</strong>
            </span>
            <IconField>
              <InputIcon class="ph ph-whatsapp-logo" />
              <InputText
                :model-value="rascunho.emergencia.whatsapp ?? ''"
                inputmode="tel"
                fluid
                @update:model-value="rascunho.emergencia.whatsapp = $event || null"
              />
            </IconField>
          </label>
          <label class="config__prazo config__prazo--contato">
            <span class="config__texto">
              <strong>{{ t('clinico.pedidos.config.plantao') }}</strong>
            </span>
            <IconField>
              <InputIcon class="ph ph-siren" />
              <InputText
                :model-value="rascunho.emergencia.telefoneDePlantao ?? ''"
                :placeholder="t('clinico.pedidos.config.semPlantao')"
                inputmode="tel"
                fluid
                @update:model-value="rascunho.emergencia.telefoneDePlantao = $event || null"
              />
            </IconField>
          </label>
        </div>

        <label class="config__campo">
          <span>{{ t('clinico.pedidos.config.orientacao') }}</span>
          <Textarea v-model="rascunho.emergencia.orientacao" rows="3" auto-resize fluid />
        </label>
      </section>
    </div>

    <template #footer>
      <div class="config__rodape">
        <Button
          :label="t('clinico.agenda.mover.cancelar')"
          severity="secondary"
          outlined
          @click="aberto = false"
        />
        <Button
          class="config__salvar"
          :label="t('clinico.pedidos.config.salvar')"
          icon="ph ph-check"
          :disabled="!valido"
          :loading="salvando"
          @click="salvar"
        />
      </div>
    </template>
  </Drawer>
</template>

<style scoped>
.config {
  display: grid;
  gap: 1.5rem;
}

.config__rodape {
  display: flex;
  gap: 0.5rem;
}

.config__salvar.p-button {
  flex: 1;
}

/* Texto de duas linhas, repetido em toda escolha: o nome em cima, o que ele faz embaixo. */
.config__texto {
  display: grid;
  min-width: 0;
  gap: 0.1rem;
}

.config__texto strong {
  color: var(--hc-tinta);
  font-size: 0.875rem;
  font-weight: 650;
  line-height: 1.35;
}

.config__texto > span,
.config__ajuda {
  color: var(--hc-tinta-2);
  font-size: 0.8125rem;
  line-height: 1.45;
}

.config__ajuda {
  margin: -0.35rem 0 0;
}

/* ------------------------------------------------------------------ a chave-mestra */

.config__mestre {
  display: grid;
  align-items: center;
  padding: 1rem 1.1rem;
  border: 1px solid var(--hc-borda);
  border-radius: 1rem;
  background: var(--hc-fundo);
  cursor: pointer;
  gap: 0.9rem;
  grid-template-columns: auto minmax(0, 1fr) auto;
  transition:
    background-color 160ms ease-out,
    border-color 160ms ease-out;
}

.config__mestre--ligado {
  border-color: color-mix(in srgb, var(--hc-marca) 35%, var(--hc-borda));
  background: var(--hc-marca-clara);
}

.config__mestre-icone {
  display: grid;
  width: 2.5rem;
  height: 2.5rem;
  place-items: center;
  border-radius: 0.75rem;
  background: var(--hc-cartao);
  color: var(--hc-tinta-2);
  font-size: 1.2rem;
}

.config__mestre--ligado .config__mestre-icone {
  background: var(--hc-degrade-botao);
  color: #ffffff;
}

/* ------------------------------------------------------------------ as seções */

.config__pedidos {
  display: grid;
  margin: 0;
  padding: 0;
  border: 0;
  gap: 1.5rem;
  transition: opacity 160ms ease-out;
}

.config__pedidos:disabled {
  opacity: 0.5;
}

/* Um fio entre as seções, e não uma caixa para cada. */
.config__secao {
  display: grid;
  padding-top: 1.5rem;
  border-top: 1px solid var(--hc-linha);
  gap: 0.85rem;
}

.config__pedidos > .config__secao:first-child {
  padding-top: 0;
  border-top: 0;
}

.config__titulo {
  display: flex;
  align-items: center;
  margin: 0;
  gap: 0.5rem;
  color: var(--hc-tinta);
  font-size: 0.9375rem;
  font-weight: 750;
}

.config__titulo .ph {
  color: var(--hc-marca);
  font-size: 1.1rem;
}

/* Os caminhos: dois cartões de escolha lado a lado, o ícone e a marca em cima. */
.config__caminhos {
  display: grid;
  gap: 0.6rem;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.config__caminho {
  display: grid;
  align-content: start;
  padding: 0.85rem 0.9rem 0.95rem;
  border: 1px solid var(--hc-borda);
  border-radius: 0.9rem;
  background: var(--hc-cartao);
  cursor: pointer;
  gap: 0.3rem;
  transition:
    background-color 160ms ease-out,
    border-color 160ms ease-out;
}

.config__caminho--ligado {
  border-color: var(--hc-marca);
  background: var(--hc-marca-clara);
}

.config__caminho-topo {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.35rem;
}

.config__caminho-topo .ph {
  color: var(--hc-marca);
  font-size: 1.4rem;
}

.config__caminho strong {
  color: var(--hc-tinta);
  font-size: 0.875rem;
  font-weight: 650;
  line-height: 1.35;
}

.config__caminho > span:last-child {
  color: var(--hc-tinta-2);
  font-size: 0.8125rem;
  line-height: 1.45;
}

.config__linha {
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
  gap: 1rem;
}

/* Os serviços: fichas que se pintam quando entram. */
.config__fichas {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.config__ficha {
  display: inline-flex;
  align-items: center;
  padding: 0.45rem 0.85rem 0.45rem 0.6rem;
  border: 1px solid var(--hc-borda);
  border-radius: 999px;
  background: var(--hc-cartao);
  color: var(--hc-tinta);
  cursor: pointer;
  font-size: 0.875rem;
  font-weight: 600;
  gap: 0.45rem;
  transition:
    background-color 160ms ease-out,
    border-color 160ms ease-out;
}

.config__ficha--ligada {
  border-color: var(--hc-marca);
  background: var(--hc-marca-clara);
  color: var(--hc-marca-forte);
}

/* As pessoas: uma lista, para o nome inteiro caber; a marca fica na ponta. */
.config__pessoas {
  display: grid;
  margin: 0;
  padding: 0;
  overflow: hidden;
  border: 1px solid var(--hc-borda);
  border-radius: 0.9rem;
  list-style: none;
}

.config__pessoas li + li {
  border-top: 1px solid var(--hc-linha);
}

.config__pessoa {
  display: grid;
  align-items: center;
  padding: 0.6rem 0.9rem;
  cursor: pointer;
  gap: 0.75rem;
  grid-template-columns: auto minmax(0, 1fr) auto;
  transition: background-color 160ms ease-out;
}

.config__pessoa:hover {
  background: var(--hc-fundo);
}

.config__rosto {
  display: grid;
  width: 2.1rem;
  height: 2.1rem;
  place-items: center;
  border-radius: 999px;
  background: var(--hc-marca-clara);
  color: var(--hc-marca-forte);
  font-size: 0.75rem;
  font-weight: 750;
}

/* Os prazos: o que é à esquerda, o número com − e + à direita, todos na mesma coluna. */
.config__prazos {
  display: grid;
  gap: 0.85rem;
}

.config__prazo {
  display: grid;
  align-items: center;
  gap: 1rem;
  grid-template-columns: minmax(0, 1fr) 9.5rem;
}

/* O passo é um controle só: uma caixa arredondada, o − e o + num fundo claro, o número no meio. */
.config__passo {
  display: flex;
  overflow: hidden;
  border: 1px solid var(--hc-borda);
  border-radius: 0.75rem;
  background: var(--hc-cartao);
  transition:
    border-color 150ms ease-out,
    box-shadow 150ms ease-out;
}

.config__passo:focus-within {
  border-color: var(--hc-marca);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--hc-marca) 20%, transparent);
}

.config__passo :deep(.p-inputnumber-input) {
  width: 100%;
  min-width: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
  font-variant-numeric: tabular-nums;
  font-weight: 650;
  text-align: center;
}

.config__passo :deep(.p-inputnumber-button) {
  width: 2.4rem;
  flex: 0 0 auto;
  border: 0;
  border-radius: 0;
  background: var(--hc-fundo);
  color: var(--hc-tinta);
}

.config__passo :deep(.p-inputnumber-button:not(:disabled):hover) {
  background: var(--hc-marca-clara);
  color: var(--hc-marca-forte);
}

/* A emergência: os três números nas mesmas linhas dos prazos, com o ícone dentro do campo. */
.config__prazo--contato {
  grid-template-columns: minmax(0, 1fr) 14rem;
}

.config__prazo--contato :deep(.p-inputicon) {
  color: var(--hc-marca);
}

/* A mensagem, na largura toda. */
.config__campo {
  display: grid;
  gap: 0.3rem;
}

.config__campo > span {
  color: var(--hc-tinta);
  font-size: 0.875rem;
  font-weight: 650;
}

@media (prefers-reduced-motion: reduce) {
  .config__mestre,
  .config__pedidos,
  .config__caminho,
  .config__ficha,
  .config__pessoa {
    transition: none;
  }
}
</style>
