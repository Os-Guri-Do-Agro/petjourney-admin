<script setup lang="ts">
/**
 * Receber o histórico pelo código que o responsável mostra na recepção.
 *
 * Dois passos, e nenhum às cegas: a recepção confere primeiro (de quem é, o que vem e até quando)
 * e só então recebe. Receber cria a ficha do pet que só existia no app — é o paciente novo
 * chegando com o histórico completo — ou junta o histórico à ficha que já existe.
 *
 * O código vale uma vez e só para quem o recebe primeiro: usado por outra clínica e encerrado pelo
 * responsável dizem a mesma coisa, "não vale mais". Quem tem o código não precisa saber de quem foi.
 */
import Button from 'primevue/button'
import Drawer from 'primevue/drawer'
import InputText from 'primevue/inputtext'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { useSidePanelOffset } from '@/composables/useSidePanelOffset'
import { useTelaLarga } from '@/composables/useTelaLarga'
import PetAvatar from '@/features/hotel/components/base/PetAvatar.vue'

import { useClinicFormat } from '../../composables/useClinicFormat'
import { useRotulosDoHistorico } from '../../composables/useRotulosDoHistorico'
import {
  ErroDoHistorico,
  historicoLiberadoRepository,
  type CodigoConferido,
} from '../../data/historico-compartilhado'
import { codigoCompleto, CODIGO_TAMANHO } from '../../domain/historico-compartilhado'

const props = defineProps<{
  aberta: boolean
}>()

const emit = defineEmits<{
  fechar: []
  recebido: [payload: { acessoId: string; petNome: string }]
}>()

const { t } = useI18n()
const formato = useClinicFormat()
const rotulos = useRotulosDoHistorico()

const LARGURA = '28rem'

const visivel = computed({
  get: () => props.aberta,
  set: (valor: boolean) => {
    if (!valor) {
      emit('fechar')
    }
  },
})

const telaLarga = useTelaLarga()

useSidePanelOffset(
  computed(() => visivel.value && telaLarga.value),
  LARGURA,
)

const codigo = ref('')
const conferido = ref<CodigoConferido | null>(null)
const erro = ref('')
const trabalhando = ref(false)
const esperando = ref<Array<{ codigo: string; petNome: string; tutorNome: string }>>([])

watch(
  () => props.aberta,
  (aberta) => {
    if (aberta) {
      codigo.value = ''
      conferido.value = null
      erro.value = ''
      esperando.value = historicoLiberadoRepository.codigosEsperando()
    }
  },
  { immediate: true },
)

function mensagemDoErro(causa: unknown): string {
  if (causa instanceof ErroDoHistorico) {
    return t(`clinico.historicoLiberado.receber.erros.${causa.codigo}`)
  }

  return t('clinico.historicoLiberado.receber.erros.generico')
}

async function conferir() {
  if (!codigoCompleto(codigo.value)) {
    erro.value = t('clinico.historicoLiberado.receber.incompleto', { n: CODIGO_TAMANHO })
    return
  }

  trabalhando.value = true
  erro.value = ''

  try {
    conferido.value = await historicoLiberadoRepository.conferirCodigo(codigo.value)
  } catch (causa) {
    erro.value = mensagemDoErro(causa)
  } finally {
    trabalhando.value = false
  }
}

async function receber() {
  if (!conferido.value) {
    return
  }

  trabalhando.value = true
  erro.value = ''

  try {
    const recebido = await historicoLiberadoRepository.receber(conferido.value.codigo)

    emit('recebido', { acessoId: recebido.acessoId, petNome: conferido.value.petNome })
  } catch (causa) {
    conferido.value = null
    erro.value = mensagemDoErro(causa)
  } finally {
    trabalhando.value = false
  }
}

function usarCodigo(valor: string) {
  codigo.value = valor
  conferido.value = null
  erro.value = ''
}

function outroCodigo() {
  conferido.value = null
  codigo.value = ''
}
</script>

<template>
  <Drawer
    v-model:visible="visivel"
    position="right"
    :modal="false"
    :dismissable="false"
    class="receber-gaveta clinic-overlay"
    :style="{ width: `min(${LARGURA}, 96vw)` }"
  >
    <template #header>
      <h2 class="rg-titulo">
        <i class="ph ph-key" aria-hidden="true" />
        {{ t('clinico.historicoLiberado.acoes.receber') }}
      </h2>
    </template>

    <div class="rg clinic-scope">
      <p class="rg__ajuda">{{ t('clinico.historicoLiberado.receber.ajuda') }}</p>

      <template v-if="!conferido">
        <form class="rg__campo" @submit.prevent="conferir">
          <label for="historico-codigo" class="rg__rotulo">
            {{ t('clinico.historicoLiberado.receber.campo') }}
          </label>
          <div class="rg__linha">
            <InputText
              id="historico-codigo"
              v-model="codigo"
              class="rg__codigo"
              autocomplete="off"
              spellcheck="false"
              inputmode="numeric"
              maxlength="9"
              :invalid="Boolean(erro)"
              aria-describedby="historico-codigo-erro"
            />
            <Button
              type="submit"
              :label="t('clinico.historicoLiberado.receber.conferir')"
              :loading="trabalhando"
            />
          </div>
          <small v-if="erro" id="historico-codigo-erro" class="rg__erro" role="alert">{{
            erro
          }}</small>
        </form>

        <!-- Só na demonstração: os códigos que esperam, inclusive o que o celular acabou de gerar. -->
        <div v-if="esperando.length" class="rg__demo">
          <span class="rg__demo-rotulo">{{ t('clinico.historicoLiberado.receber.demo') }}</span>
          <div class="rg__demo-codigos">
            <Button
              v-for="item in esperando"
              :key="item.codigo"
              type="button"
              severity="secondary"
              outlined
              size="small"
              :label="`${item.codigo} · ${item.petNome}`"
              @click="usarCodigo(item.codigo)"
            />
          </div>
        </div>
      </template>

      <template v-else>
        <section class="rg__previa ui-folha">
          <div class="rg__quem">
            <PetAvatar
              :nome="conferido.petNome"
              :iniciais="conferido.petIniciais"
              :especie="conferido.especie"
            />
            <span class="rg__quem-texto">
              <strong>{{ conferido.petNome }}</strong>
              <span>
                {{
                  [formato.especie(conferido.especie), conferido.raca].filter(Boolean).join(' · ')
                }}
              </span>
              <span>{{
                t('clinico.historicoLiberado.linha.deQuem', { nome: conferido.tutorNome })
              }}</span>
            </span>
          </div>

          <dl class="rg__fatos">
            <div>
              <dt>{{ t('clinico.historicoLiberado.receber.vem') }}</dt>
              <dd>{{ rotulos.categorias(conferido.categorias) }}</dd>
            </div>
            <div>
              <dt>{{ t('clinico.historicoLiberado.receber.vale') }}</dt>
              <dd>{{ rotulos.data(conferido.expiraEm) }}</dd>
            </div>
          </dl>

          <p class="rg__nota">
            {{
              conferido.jaEPaciente
                ? t('clinico.historicoLiberado.receber.jaPaciente')
                : t('clinico.historicoLiberado.receber.novo')
            }}
          </p>
        </section>

        <small v-if="erro" class="rg__erro" role="alert">{{ erro }}</small>

        <div class="rg__acoes">
          <Button
            type="button"
            icon="ph ph-download-simple"
            :label="t('clinico.historicoLiberado.receber.receber')"
            :loading="trabalhando"
            @click="receber"
          />
          <Button
            type="button"
            severity="secondary"
            outlined
            :label="t('clinico.historicoLiberado.receber.outro')"
            :disabled="trabalhando"
            @click="outroCodigo"
          />
        </div>
      </template>
    </div>
  </Drawer>
</template>

<style scoped>
.rg-titulo {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  color: var(--tinta);
  font-size: 17px;
  font-weight: 600;
}

.rg-titulo i {
  color: var(--clinica-tinta);
  font-size: 20px;
}

.rg {
  display: grid;
  gap: 18px;
}

.rg__ajuda,
.rg__nota {
  margin: 0;
  color: var(--tinta-2);
  font-size: 13.5px;
  line-height: 1.5;
}

.rg__campo {
  display: grid;
  gap: 6px;
}

.rg__rotulo {
  color: var(--tinta);
  font-size: 13.5px;
  font-weight: 550;
}

.rg__linha {
  display: flex;
  gap: 8px;
}

.rg__codigo {
  flex: 1;
  min-width: 0;
  font-family: var(--fonte-mono, ui-monospace, monospace);
  font-size: 18px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.rg__erro {
  color: var(--risco-tinta);
  font-size: 13px;
}

.rg__demo {
  display: grid;
  padding: 12px 14px;
  border-radius: 14px;
  background: var(--superficie-2);
  gap: 8px;
}

.rg__demo-rotulo {
  color: var(--tinta-2);
  font-size: 12.5px;
  font-weight: 550;
}

.rg__demo-codigos {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.rg__previa {
  display: grid;
  padding: 16px;
  gap: 14px;
}

.rg__quem {
  display: flex;
  align-items: center;
  gap: 12px;
}

.rg__quem-texto {
  display: grid;
  min-width: 0;
  color: var(--tinta-2);
  font-size: 13px;
}

.rg__quem-texto strong {
  color: var(--tinta);
  font-size: 16px;
  font-weight: 650;
}

.rg__fatos {
  display: grid;
  margin: 0;
  gap: 8px;
}

.rg__fatos div {
  display: grid;
  gap: 1px;
}

.rg__fatos dt {
  color: var(--tinta-3);
  font-size: 12px;
  font-weight: 550;
}

.rg__fatos dd {
  margin: 0;
  color: var(--tinta);
  font-size: 14px;
}

.rg__acoes {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
</style>
