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
import Dialog from 'primevue/dialog'
import Select from 'primevue/select'
import Textarea from 'primevue/textarea'
import { computed, ref, watch } from 'vue'
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
    class="clinic-dialog"
    :style="{ width: 'min(44rem, 96vw)' }"
    :content-style="{ maxHeight: '68vh', overflowY: 'auto' }"
    :header="t('clinico.internacao.passagem.titulo')"
    dismissable-mask
  >
    <div v-if="passagem" class="passagem clinic-scope">
      <p class="passagem__turno">
        <strong>
          {{ t(`clinico.internacao.plantao.${passagem.plantao.kind}`) }}
          {{ formato.intervalo(passagem.plantao.inicio, passagem.plantao.fim) }}
        </strong>
        <span>
          {{ clinico.profissional(passagem.plantao.responsavelId)?.nome }}
          →
          {{ t(`clinico.internacao.plantao.${passagem.seguinte.kind}`) }}
        </span>
      </p>

      <!-- A lista que trava a entrega vem primeiro, e diz por que trava. -->
      <section v-if="naTroca.length > 0" class="lista lista--troca">
        <h4 class="lista__titulo">
          <i class="pi pi-arrow-right-arrow-left" aria-hidden="true" />
          {{ t('clinico.internacao.passagem.emCimaDaTroca') }}
        </h4>
        <p class="lista__ajuda">{{ t('clinico.internacao.passagem.emCimaDaTrocaAjuda') }}</p>

        <ul class="lista__itens">
          <li v-for="item in naTroca" :key="item.administracao.id" class="linha">
            <label class="linha__decisao">
              <input
                type="checkbox"
                :checked="decididas.has(item.administracao.id)"
                @change="alternarDecisao(item.administracao.id)"
              />
              <span class="linha__texto">
                <strong class="clinic-value">
                  {{ formato.hora(item.administracao.previstaPara) }}
                </strong>
                {{ item.descricao }}
                <em>{{ item.petNome }} · {{ item.leitoNome }}</em>
              </span>
            </label>
            <Button
              :label="t('clinico.internacao.passagem.abrir')"
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
          <i class="pi pi-clock" aria-hidden="true" />
          {{ t('clinico.internacao.passagem.atrasadas') }}
        </h4>

        <ul class="lista__itens">
          <li v-for="item in atrasadas" :key="item.administracao.id" class="linha">
            <span class="linha__texto">
              <strong class="clinic-value">
                {{ formato.hora(item.administracao.previstaPara) }}
              </strong>
              {{ item.descricao }}
              <em>{{ item.petNome }} · {{ item.leitoNome }}</em>
            </span>
            <Button
              :label="t('clinico.internacao.passagem.abrir')"
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
          <i class="pi pi-file-edit" aria-hidden="true" />
          {{ t('clinico.internacao.passagem.semEvolucao') }}
        </h4>

        <ul class="lista__itens">
          <li v-for="item in semEvolucao" :key="item.internacaoId" class="linha">
            <span class="linha__texto">{{ item.petNome }} · {{ item.leitoNome }}</span>
            <Button
              :label="t('clinico.internacao.passagem.abrir')"
              severity="secondary"
              text
              size="small"
              @click="emit('irPara', item.internacaoId)"
            />
          </li>
        </ul>
      </section>

      <p v-if="nada" class="passagem__limpo">
        <i class="pi pi-check-circle" aria-hidden="true" />
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
      <span v-if="faltaDecidir.length > 0" class="trava">
        {{ t('clinico.internacao.passagem.trava', { total: faltaDecidir.length }) }}
      </span>

      <Button
        :label="t('clinico.internacao.passagem.cancelar')"
        severity="secondary"
        text
        @click="emit('fechar')"
      />
      <Button
        :label="t('clinico.internacao.passagem.entregar')"
        icon="pi pi-sign-out"
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
  gap: var(--clinic-space-4);
}

.passagem__turno {
  display: grid;
  margin: 0;
  gap: 0.1rem;
}

.passagem__turno strong {
  font-size: var(--clinic-font-title);
  font-weight: 750;
}

.passagem__turno span {
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
}

.lista {
  display: grid;
  gap: var(--clinic-space-2);
  padding: var(--clinic-space-3);
  border: 1px solid var(--clinic-line);
  border-radius: var(--clinic-radius-control);
  background: var(--clinic-surface-soft);
}

/* A lista que trava a entrega é a única com tratamento de atenção. */
.lista--troca {
  border-color: var(--clinic-attention-line);
  background: var(--clinic-attention-bg);
}

.lista__titulo {
  display: flex;
  align-items: center;
  margin: 0;
  gap: var(--clinic-space-2);
  font-size: var(--clinic-font-body);
  font-weight: 750;
}

.lista__ajuda {
  margin: 0;
  color: var(--clinic-muted);
  font-size: var(--clinic-font-label);
  line-height: 1.5;
}

.lista__itens {
  display: grid;
  margin: 0;
  padding: 0;
  gap: var(--clinic-space-1);
  list-style: none;
}

.linha {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--clinic-space-3);
}

.linha__decisao {
  display: flex;
  min-width: 0;
  align-items: flex-start;
  gap: var(--clinic-space-2);
  cursor: pointer;
}

/*
 * A caixa é nativa — aqui a escolha é múltipla, e o `ClinicToggleGroup` do módulo é de escolha
 * única. O que ela não pode é ficar sem tratamento nenhum: sem `accent-color` ela desenhava o
 * azul do sistema no meio de uma tela inteira de tokens sálvia.
 */
.linha__decisao input {
  width: 1.05rem;
  height: 1.05rem;
  margin: 0.15rem 0 0;
  accent-color: var(--clinic-accent-strong);
  cursor: pointer;
}

.linha__texto {
  min-width: 0;
  font-size: var(--clinic-font-label);
  line-height: 1.5;
}

.linha__texto strong {
  margin-right: var(--clinic-space-2);
  font-weight: 750;
}

.linha__texto em {
  color: var(--clinic-faint);
  font-style: normal;
}

.linha__texto em::before {
  content: ' · ';
}

.passagem__limpo {
  display: flex;
  align-items: center;
  margin: 0;
  padding: var(--clinic-space-3);
  border-radius: var(--clinic-radius-control);
  gap: var(--clinic-space-2);
  background: var(--clinic-ok-bg);
  color: var(--clinic-ok-text);
  font-size: var(--clinic-font-label);
  font-weight: 700;
}

.trava {
  margin-right: auto;
  color: var(--clinic-attention-text);
  font-size: var(--clinic-font-label);
  font-weight: 700;
}
</style>
