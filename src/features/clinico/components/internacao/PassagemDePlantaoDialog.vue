<script setup lang="ts">
/**
 * Passagem de plantão.
 *
 * A tela existe para tornar **explícito** o que hoje é dito no corredor e esquecido no caminho.
 * Três listas, e elas não são a mesma coisa:
 *
 * - **Em cima da troca** — a dose prevista para o minuto da passagem. Não é de ninguém por
 *   padrão, e é assim que ela some. Aqui alguém precisa dizer quem dá, antes de o botão liberar.
 * - **Atrasadas** — o que este turno não fechou. Quem sai explica; quem entra herda sabendo.
 * - **Sem evolução** — o paciente de quem ninguém escreveu nada no turno. É a outra metade do
 *   que se perde na troca, e não aparece em lista de medicação nenhuma.
 *
 * O botão de entregar fica travado enquanto houver dose em cima da troca sem decisão. É a única
 * trava da tela, e ela é deliberada: uma passagem que se conclui com um clique enquanto a dose
 * das 19h paira sem dono é exatamente o processo que o papel já fazia mal.
 */
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import Dialog from 'primevue/dialog'
import Select from 'primevue/select'
import Textarea from 'primevue/textarea'
import { computed, ref, useId, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import ClinicField from '../base/ClinicField.vue'
import type { PassagemDePlantao } from '../../data/repositories'
import { useClinicFormat } from '../../composables/useClinicFormat'
import { useClinicoStore } from '../../stores/clinico'

const props = defineProps<{
  aberto: boolean
  passagem: PassagemDePlantao | null
  salvando: boolean
}>()

const emit = defineEmits<{
  fechar: []
  entregar: [nota: string, recebidoPor: string]
  irPara: [internacaoId: string]
}>()

const { t } = useI18n()
const formato = useClinicFormat()
const clinico = useClinicoStore()

const nota = ref('')
const recebidoPor = ref('')
/** Doses em cima da troca já decididas — a decisão é do par que passa o turno, não do sistema. */
const decididas = ref<Set<string>>(new Set())

watch(
  () => props.passagem,
  (valor) => {
    recebidoPor.value = valor?.seguinte.responsavelId ?? ''
    nota.value = ''
    decididas.value = new Set()
  },
  { immediate: true },
)

const visivel = computed({
  get: () => props.aberto,
  set: (valor: boolean) => {
    if (!valor) {
      emit('fechar')
    }
  },
})

const opcoesDeProfissional = computed(() =>
  clinico.profissionais
    .filter((profissional) => profissional.ativo)
    .map((profissional) => ({ valor: profissional.id, rotulo: profissional.nome })),
)

const naTroca = computed(() => props.passagem?.pendencias.emCimaDaTroca ?? [])
const atrasadas = computed(() => props.passagem?.pendencias.atrasadas ?? [])
const semEvolucao = computed(() => props.passagem?.pendencias.semEvolucao ?? [])

const faltaDecidir = computed(() =>
  naTroca.value.filter((item) => !decididas.value.has(item.administracao.id)),
)

const podeEntregar = computed(
  () => faltaDecidir.value.length === 0 && recebidoPor.value.length > 0 && !props.salvando,
)

const nada = computed(
  () =>
    naTroca.value.length === 0 && atrasadas.value.length === 0 && semEvolucao.value.length === 0,
)

const idDecisao = useId()

function alternarDecisao(id: string) {
  const proxima = new Set(decididas.value)

  if (proxima.has(id)) {
    proxima.delete(id)
  } else {
    proxima.add(id)
  }

  decididas.value = proxima
}

function entregar() {
  if (!podeEntregar.value) {
    return
  }

  emit('entregar', nota.value, recebidoPor.value)
}
</script>

<template>
  <Dialog
    v-model:visible="visivel"
    modal
    class="clinic-dialog hc-tema"
    :style="{ width: 'min(46rem, 96vw)' }"
    :content-style="{ maxHeight: '68vh', overflowY: 'auto' }"
    :header="t('clinico.internacao.passagem.titulo')"
    dismissable-mask
  >
    <div v-if="passagem" class="passagem clinic-scope">
      <!-- Quem entrega e para quem: o turno que sai, a hora, e o turno que entra. -->
      <p class="passagem__turno">
        <span class="passagem__icone" aria-hidden="true"><i class="ph ph-arrows-left-right" /></span>
        <span class="passagem__turno-texto">
          <strong>
            {{ t(`clinico.internacao.plantao.${passagem.plantao.kind}`) }}
            <span class="ui-num">
              {{ formato.intervalo(passagem.plantao.inicio, passagem.plantao.fim) }}
            </span>
          </strong>
          <span>
            {{ clinico.profissional(passagem.plantao.responsavelId)?.nome }}
            <!-- Ícone, e não o caractere "→": seta de texto não espelha no árabe. -->
            <i class="ph ph-arrow-right passagem__seta" aria-hidden="true" />
            {{ t(`clinico.internacao.plantao.${passagem.seguinte.kind}`) }}
          </span>
        </span>
      </p>

      <!-- A lista que trava a entrega vem primeiro, e diz por que trava. -->
      <section v-if="naTroca.length > 0" class="lista lista--troca">
        <h4 class="lista__titulo">
          <i class="ph ph-arrows-left-right" aria-hidden="true" />
          {{ t('clinico.internacao.passagem.emCimaDaTroca') }}
          <span class="ui-contagem">{{ naTroca.length }}</span>
        </h4>
        <p class="lista__ajuda">{{ t('clinico.internacao.passagem.emCimaDaTrocaAjuda') }}</p>

        <ul class="ui-lista lista__itens">
          <li
            v-for="item in naTroca"
            :key="item.administracao.id"
            class="linha"
            :class="{ 'linha--decidida': decididas.has(item.administracao.id) }"
          >
            <div class="linha__decisao">
              <Checkbox
                binary
                :input-id="`${idDecisao}-${item.administracao.id}`"
                :model-value="decididas.has(item.administracao.id)"
                @update:model-value="alternarDecisao(item.administracao.id)"
              />
              <label class="linha__texto" :for="`${idDecisao}-${item.administracao.id}`">
                <span class="linha__principal">
                  <strong class="ui-hora">{{ formato.hora(item.administracao.previstaPara) }}</strong>
                  {{ item.descricao }}
                </span>
                <span class="linha__meta">{{ item.petNome }} · {{ item.leitoNome }}</span>
              </label>
            </div>
            <Button
              type="button"
              :label="t('clinico.internacao.passagem.abrir')"
              icon="ph ph-arrow-square-out"
              severity="secondary"
              text
              size="small"
              @click="emit('irPara', item.internacaoId)"
            />
          </li>
        </ul>
      </section>

      <section v-if="atrasadas.length > 0" class="lista">
        <h4 class="lista__titulo">
          <i class="ph ph-clock-countdown" aria-hidden="true" />
          {{ t('clinico.internacao.passagem.atrasadas') }}
          <span class="ui-contagem">{{ atrasadas.length }}</span>
        </h4>

        <ul class="ui-lista lista__itens">
          <li v-for="item in atrasadas" :key="item.administracao.id" class="linha">
            <span class="linha__texto">
              <span class="linha__principal">
                <strong class="ui-hora">{{ formato.hora(item.administracao.previstaPara) }}</strong>
                {{ item.descricao }}
              </span>
              <span class="linha__meta">{{ item.petNome }} · {{ item.leitoNome }}</span>
            </span>
            <Button
              type="button"
              :label="t('clinico.internacao.passagem.abrir')"
              icon="ph ph-arrow-square-out"
              severity="secondary"
              text
              size="small"
              @click="emit('irPara', item.internacaoId)"
            />
          </li>
        </ul>
      </section>

      <section v-if="semEvolucao.length > 0" class="lista">
        <h4 class="lista__titulo">
          <i class="ph ph-note-pencil" aria-hidden="true" />
          {{ t('clinico.internacao.passagem.semEvolucao') }}
          <span class="ui-contagem">{{ semEvolucao.length }}</span>
        </h4>

        <ul class="ui-lista lista__itens">
          <li v-for="item in semEvolucao" :key="item.internacaoId" class="linha">
            <span class="linha__texto">
              <span class="linha__principal">
                <strong>{{ item.petNome }}</strong>
              </span>
              <span class="linha__meta">{{ item.leitoNome }}</span>
            </span>
            <Button
              type="button"
              :label="t('clinico.internacao.passagem.abrir')"
              icon="ph ph-arrow-square-out"
              severity="secondary"
              text
              size="small"
              @click="emit('irPara', item.internacaoId)"
            />
          </li>
        </ul>
      </section>

      <p v-if="nada" class="passagem__limpo">
        <i class="ph ph-check-circle" aria-hidden="true" />
        {{ t('clinico.internacao.passagem.nada') }}
      </p>

      <ClinicField :rotulo="t('clinico.internacao.passagem.recebidoPor')">
        <template #default="{ id }">
          <Select
            :id="id"
            v-model="recebidoPor"
            :options="opcoesDeProfissional"
            option-label="rotulo"
            option-value="valor"
            fluid
            :pt="{ overlay: { class: 'clinic-overlay' } }"
          />
        </template>
      </ClinicField>

      <ClinicField
        :rotulo="t('clinico.internacao.passagem.nota')"
        :dica="t('clinico.internacao.passagem.notaDica')"
      >
        <template #default="{ id }">
          <Textarea
            :id="id"
            v-model="nota"
            :placeholder="t('clinico.internacao.passagem.notaExemplo')"
            rows="3"
            auto-resize
            fluid
          />
        </template>
      </ClinicField>
    </div>

    <template #footer>
      <span v-if="faltaDecidir.length > 0" class="trava" role="status">
        <i class="ph ph-lock-simple" aria-hidden="true" />
        {{
          t(
            'clinico.internacao.passagem.trava',
            { total: faltaDecidir.length },
            faltaDecidir.length,
          )
        }}
      </span>

      <Button
        type="button"
        :label="t('clinico.internacao.passagem.cancelar')"
        severity="secondary"
        text
        @click="emit('fechar')"
      />
      <Button
        type="button"
        :label="t('clinico.internacao.passagem.entregar')"
        icon="ph ph-sign-out"
        :disabled="!podeEntregar"
        :loading="salvando"
        @click="entregar"
      />
    </template>
  </Dialog>
</template>

<style scoped>
.passagem {
  display: grid;
  gap: 20px;
}

.passagem__turno {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 0;
  padding: 12px 14px;
  border-radius: 12px;
  background: var(--superficie-2);
}

.passagem__icone {
  display: grid;
  width: 40px;
  height: 40px;
  flex: none;
  place-items: center;
  border-radius: 10px;
  background: var(--clinica-fundo);
  color: var(--clinica-tinta);
  font-size: 20px;
}

.passagem__turno-texto {
  display: grid;
  gap: 2px;
}

.passagem__turno-texto strong {
  color: var(--tinta);
  font-size: 16px;
  font-weight: 600;
}

.passagem__turno-texto > span {
  color: var(--tinta-2);
  font-size: 13.5px;
}

.passagem__seta {
  margin-inline: 4px;
  font-size: 12px;
}

[dir='rtl'] .passagem__seta {
  scale: -1 1;
}

/* ----------------------------------------------------------------- listas */

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

/* A lista que trava a entrega é a única com tratamento de atenção. */
.lista--troca .lista__titulo i {
  color: var(--atencao-tinta);
}

.lista__ajuda {
  margin: 0;
  color: var(--tinta-2);
  font-size: 13.5px;
  line-height: 1.5;
}

.lista__itens {
  border: 1px solid var(--linha);
  border-radius: 12px;
}

.lista--troca .lista__itens {
  border-color: color-mix(in oklab, var(--atencao) 45%, var(--linha));
}

.linha {
  display: flex;
  min-height: 56px;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 8px 8px 14px;
}

.lista--troca .linha:not(.linha--decidida) {
  background: color-mix(in oklab, var(--atencao-fundo) 45%, transparent);
}

.lista--troca .linha:first-child {
  border-radius: 11px 11px 0 0;
}

.lista--troca .linha:last-child {
  border-radius: 0 0 11px 11px;
}

.lista--troca .linha:only-child {
  border-radius: 11px;
}

.linha__decisao {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 12px;
}

.linha__decisao label {
  cursor: pointer;
}

.linha__texto {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.linha__principal {
  color: var(--tinta);
  font-size: 14px;
  font-weight: 500;
  line-height: 1.4;
}

.linha__principal .ui-hora {
  margin-inline-end: 8px;
  font-size: 14px;
}

.linha__principal strong:not(.ui-hora) {
  font-weight: 600;
}

.linha__meta {
  color: var(--tinta-2);
  font-size: 13px;
}

.passagem__limpo {
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

.trava {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-inline-end: auto;
  color: var(--atencao-tinta);
  font-size: 13.5px;
  font-weight: 600;
}
</style>
