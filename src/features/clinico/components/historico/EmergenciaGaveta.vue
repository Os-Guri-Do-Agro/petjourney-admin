<script setup lang="ts">
/**
 * Ler o QR da coleira — a emergência em dois degraus (visão de produto, item 14).
 *
 * O primeiro degrau é a ficha pública de hoje, a mesma que qualquer pessoa vê ao ler o QR:
 * identificação, microchip, quem cuida e o alerta de alergia grave. Não muda — é o que serve a
 * quem achou um cachorro na rua.
 *
 * O segundo degrau é o que o profissional precisa antes de medicar: o uso contínuo, as alergias,
 * o que está em tratamento e o último peso. Só abre para quem tem CRMV e com um motivo, fica
 * registrado com nome e conselho, e o responsável recebe o aviso na hora — sem precisar estar
 * por perto para dizer sim. Nenhum dado de saúde fica numa URL aberta.
 *
 * Como a spec L6 decidiu (e a API fez em 22/10): a ficha não traz nada do responsável, nem nome
 * nem telefone. O contato vai no sentido contrário: ele recebe o aviso e liga para a clínica.
 */
import Button from 'primevue/button'
import Drawer from 'primevue/drawer'
import Select from 'primevue/select'
import Textarea from 'primevue/textarea'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { useSidePanelOffset } from '@/composables/useSidePanelOffset'
import { useTelaLarga } from '@/composables/useTelaLarga'
import PetAvatar from '@/features/hotel/components/base/PetAvatar.vue'

import { useClinicFormat } from '../../composables/useClinicFormat'
import { useRotulosDoHistorico } from '../../composables/useRotulosDoHistorico'
import { ErroDoHistorico, historicoLiberadoRepository } from '../../data/historico-compartilhado'
import type { PetSpecies } from '../../data/types'
import {
  conselhoValidoParaEmergencia,
  MOTIVO_DA_EMERGENCIA,
  motivoDaEmergenciaValido,
  type AberturaDoHistorico,
  type FichaDeEmergencia,
  type FichaPublica,
} from '../../domain/historico-compartilhado'
import { useClinicoStore } from '../../stores/clinico'
import ClinicToggleGroup from '../base/ClinicToggleGroup.vue'

const props = defineProps<{
  aberta: boolean
}>()

const emit = defineEmits<{
  fechar: []
  /** A ficha de emergência foi aberta: o celular do responsável recebe o aviso. */
  abriu: []
}>()

const { t } = useI18n()
const clinico = useClinicoStore()
const formato = useClinicFormat()
const rotulos = useRotulosDoHistorico()

const LARGURA = '30rem'
const RECEPCAO = 'recepcao'

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

/** Na demonstração, escolher a coleira faz as vezes de apontar a câmera. */
const opcoesDeColeira = computed(() =>
  historicoLiberadoRepository
    .coleirasDeDemonstracao()
    .map((item) => ({ valor: item.codigo, rotulo: item.petNome, icone: 'ph ph-qr-code' })),
)

const coleira = ref<string | null>(null)
const publica = ref<FichaPublica | null>(null)
const completa = ref<FichaDeEmergencia | null>(null)
const abertura = ref<AberturaDoHistorico | null>(null)
const erro = ref('')
const trabalhando = ref(false)

/** Quem abre o segundo degrau. A recepção aparece na lista de propósito: é ela que não pode. */
const quemAbre = ref<string>(RECEPCAO)

const opcoesDeQuem = computed(() => [
  ...clinico.profissionais
    .filter((item) => item.ativo)
    .map((item) => ({ valor: item.id, rotulo: `${item.nome} · ${item.conselho}` })),
  { valor: RECEPCAO, rotulo: t('clinico.historicoLiberado.emergencia.recepcao') },
])

const podeAbrir = computed(() => {
  const profissional = clinico.profissionais.find((item) => item.id === quemAbre.value)

  return conselhoValidoParaEmergencia(profissional?.conselho)
})

/** O responsável lê este motivo no app: por isso é obrigatório, e escrito para ele entender. */
const motivo = ref('')
const motivoOk = computed(() => motivoDaEmergenciaValido(motivo.value))

watch(
  () => props.aberta,
  (aberta) => {
    if (aberta) {
      coleira.value = null
      publica.value = null
      completa.value = null
      abertura.value = null
      erro.value = ''
      motivo.value = ''
      quemAbre.value = clinico.profissionais.find((item) => item.ativo)?.id ?? RECEPCAO
    }
  },
  { immediate: true },
)

function mensagemDoErro(causa: unknown): string {
  if (causa instanceof ErroDoHistorico) {
    return t(`clinico.historicoLiberado.emergencia.erros.${causa.codigo}`)
  }

  return t('clinico.historicoLiberado.emergencia.erros.generico')
}

async function ler(codigo: string) {
  coleira.value = codigo
  completa.value = null
  abertura.value = null
  erro.value = ''
  trabalhando.value = true

  try {
    publica.value = await historicoLiberadoRepository.lerColeira(codigo)
  } catch (causa) {
    publica.value = null
    erro.value = mensagemDoErro(causa)
  } finally {
    trabalhando.value = false
  }
}

async function abrirSegundoDegrau() {
  if (!coleira.value) {
    return
  }

  erro.value = ''
  trabalhando.value = true

  try {
    const resultado = await historicoLiberadoRepository.abrirEmergencia(
      coleira.value,
      quemAbre.value === RECEPCAO ? null : quemAbre.value,
      motivo.value,
    )

    completa.value = resultado.ficha
    abertura.value = resultado.abertura
    emit('abriu')
  } catch (causa) {
    erro.value = mensagemDoErro(causa)
  } finally {
    trabalhando.value = false
  }
}

const especie = computed(() => (publica.value?.especie ?? 'canina') as PetSpecies)
</script>

<template>
  <Drawer
    v-model:visible="visivel"
    position="right"
    :modal="false"
    :dismissable="false"
    class="emergencia-gaveta clinic-overlay"
    :style="{ width: `min(${LARGURA}, 96vw)` }"
  >
    <template #header>
      <h2 class="eg-titulo">
        <i class="ph ph-qr-code" aria-hidden="true" />
        {{ t('clinico.historicoLiberado.acoes.coleira') }}
      </h2>
    </template>

    <div class="eg clinic-scope">
      <section class="eg__ler">
        <p class="eg__ajuda">{{ t('clinico.historicoLiberado.emergencia.ajuda') }}</p>
        <ClinicToggleGroup
          :model-value="coleira"
          :opcoes="opcoesDeColeira"
          :rotulo="t('clinico.historicoLiberado.emergencia.demo')"
          @update:model-value="(valor) => valor && ler(valor)"
        />
      </section>

      <small v-if="erro" class="eg__erro" role="alert">{{ erro }}</small>

      <!-- Primeiro degrau: o que qualquer pessoa vê. -->
      <section v-if="publica" class="eg__publica ui-folha" aria-labelledby="eg-publica">
        <div class="eg__degrau">
          <span id="eg-publica">{{ t('clinico.historicoLiberado.emergencia.publica') }}</span>
          <small>{{ t('clinico.historicoLiberado.emergencia.publicaExplica') }}</small>
        </div>
        <div class="eg__pet">
          <PetAvatar
            :nome="publica.nome"
            :iniciais="publica.iniciais"
            :especie="especie"
            :foto-url="publica.fotoUrl"
          />
          <span class="eg__pet-texto">
            <strong>{{ publica.nome }}</strong>
            <span>{{ [formato.especie(especie), publica.raca].filter(Boolean).join(' · ') }}</span>
            <span>
              {{
                publica.microchip
                  ? t('clinico.historicoLiberado.emergencia.microchip', {
                      numero: publica.microchip,
                    })
                  : t('clinico.historicoLiberado.emergencia.semMicrochip')
              }}
            </span>
            <span>
              {{
                t('clinico.historicoLiberado.emergencia.responsavel', {
                  nome: publica.responsavelNome,
                })
              }}
            </span>
          </span>
        </div>
        <p v-if="publica.alertasCriticos.length" class="eg__alerta">
          <i class="ph ph-warning-octagon" aria-hidden="true" />
          {{
            t('clinico.historicoLiberado.emergencia.alergiaGrave', {
              lista: rotulos.lista(publica.alertasCriticos),
            })
          }}
        </p>
        <p v-else class="eg__nota">{{ t('clinico.historicoLiberado.emergencia.semAlerta') }}</p>
      </section>

      <!-- Segundo degrau: só com CRMV, registrado e avisado. -->
      <section v-if="publica && !completa" class="eg__segundo" aria-labelledby="eg-segundo">
        <div class="eg__degrau">
          <span id="eg-segundo">{{ t('clinico.historicoLiberado.emergencia.segundo') }}</span>
          <small>{{ t('clinico.historicoLiberado.emergencia.segundoExplica') }}</small>
        </div>
        <div class="eg__quem">
          <span id="eg-quem">{{ t('clinico.historicoLiberado.emergencia.quemAbre') }}</span>
          <Select
            v-model="quemAbre"
            :options="opcoesDeQuem"
            option-label="rotulo"
            option-value="valor"
            aria-labelledby="eg-quem"
            class="eg__select"
          />
        </div>
        <p v-if="!podeAbrir" class="eg__nota" role="status">
          <i class="ph ph-lock-simple" aria-hidden="true" />
          {{ t('clinico.historicoLiberado.emergencia.semCrmv') }}
        </p>
        <div v-else class="eg__quem">
          <label for="eg-motivo">{{ t('clinico.historicoLiberado.emergencia.motivo') }}</label>
          <Textarea
            id="eg-motivo"
            v-model="motivo"
            rows="2"
            auto-resize
            :maxlength="MOTIVO_DA_EMERGENCIA.max"
            :placeholder="t('clinico.historicoLiberado.emergencia.motivoExemplo')"
            aria-describedby="eg-motivo-ajuda"
            class="eg__select"
          />
          <small id="eg-motivo-ajuda" class="eg__ajuda-campo">
            {{
              t('clinico.historicoLiberado.emergencia.motivoAjuda', {
                min: MOTIVO_DA_EMERGENCIA.min,
              })
            }}
          </small>
        </div>
        <Button
          type="button"
          icon="ph ph-first-aid-kit"
          :label="t('clinico.historicoLiberado.emergencia.abrir')"
          :disabled="!podeAbrir || !motivoOk"
          :loading="trabalhando"
          @click="abrirSegundoDegrau"
        />
      </section>

      <section v-if="completa && abertura" class="eg__completa" aria-labelledby="eg-completa">
        <div class="eg__degrau">
          <span id="eg-completa">{{ t('clinico.historicoLiberado.emergencia.segundo') }}</span>
        </div>

        <div class="eg__bloco">
          <h3>{{ t('clinico.historicoLiberado.emergencia.medicacao') }}</h3>
          <ul v-if="completa.medicacaoContinua.length">
            <li v-for="item in completa.medicacaoContinua" :key="item.id">
              <strong>{{ item.titulo }}</strong>
              <span>{{ item.detalhe }}</span>
            </li>
          </ul>
          <p v-else class="eg__nota">{{ t('clinico.historicoLiberado.emergencia.nada') }}</p>
        </div>

        <div class="eg__bloco">
          <h3>{{ t('clinico.historicoLiberado.emergencia.alergias') }}</h3>
          <ul v-if="completa.alergias.length">
            <li v-for="item in completa.alergias" :key="item.id">
              <strong>
                {{ item.titulo }}
                <span v-if="item.marcador === 'grave'" class="ui-selo ui-selo--risco">
                  {{ rotulos.marcador(item) }}
                </span>
              </strong>
              <span>{{ item.detalhe }}</span>
            </li>
          </ul>
          <p v-else class="eg__nota">{{ t('clinico.historicoLiberado.emergencia.nada') }}</p>
        </div>

        <div class="eg__bloco">
          <h3>{{ t('clinico.historicoLiberado.emergencia.diagnosticos') }}</h3>
          <ul v-if="completa.diagnosticosAtivos.length">
            <li v-for="item in completa.diagnosticosAtivos" :key="item.id">
              <strong>{{ item.titulo }}</strong>
              <span>{{ item.detalhe }}</span>
            </li>
          </ul>
          <p v-else class="eg__nota">{{ t('clinico.historicoLiberado.emergencia.nada') }}</p>
        </div>

        <dl class="eg__fatos">
          <div>
            <dt>{{ t('clinico.historicoLiberado.emergencia.peso') }}</dt>
            <dd>
              {{
                completa.ultimoPeso
                  ? `${completa.ultimoPeso.titulo} · ${rotulos.quandoDoItem(completa.ultimoPeso)}`
                  : t('clinico.historicoLiberado.emergencia.nada')
              }}
            </dd>
          </div>
          <div>
            <dt>{{ t('clinico.historicoLiberado.emergencia.motivo') }}</dt>
            <dd>{{ abertura.motivo }}</dd>
          </div>
        </dl>

        <p class="eg__registro" role="status">
          <i class="ph ph-eye" aria-hidden="true" />
          {{
            t('clinico.historicoLiberado.emergencia.registro', {
              nome: abertura.profissionalNome,
              conselho: abertura.conselho,
              hora: formato.hora(abertura.em),
            })
          }}
        </p>
      </section>
    </div>
  </Drawer>
</template>

<style scoped>
.eg-titulo {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  color: var(--tinta);
  font-size: 17px;
  font-weight: 600;
}

.eg-titulo i {
  color: var(--clinica-tinta);
  font-size: 20px;
}

.eg {
  display: grid;
  gap: 18px;
}

.eg__ler {
  display: grid;
  gap: 10px;
}

.eg__ajuda,
.eg__nota {
  margin: 0;
  color: var(--tinta-2);
  font-size: 13.5px;
  line-height: 1.5;
}

.eg__nota i {
  margin-inline-end: 4px;
}

.eg__erro {
  color: var(--risco-tinta);
  font-size: 13px;
}

.eg__publica {
  display: grid;
  padding: 16px;
  gap: 14px;
}

/* Toma o lugar do segundo degrau, no mesmo alinhamento: só a ficha pública é folha. */
.eg__completa {
  display: grid;
  padding-top: 16px;
  border-top: 1px solid var(--linha);
  gap: 14px;
}

.eg__degrau {
  display: grid;
  gap: 2px;
}

.eg__degrau span {
  color: var(--tinta);
  font-size: 14px;
  font-weight: 650;
}

.eg__degrau small {
  color: var(--tinta-2);
  font-size: 12.5px;
  line-height: 1.45;
}

.eg__pet {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.eg__pet-texto {
  display: grid;
  min-width: 0;
  color: var(--tinta-2);
  font-size: 13px;
  line-height: 1.45;
}

.eg__pet-texto strong {
  color: var(--tinta);
  font-size: 16px;
  font-weight: 650;
}

.eg__alerta {
  display: flex;
  align-items: flex-start;
  margin: 0;
  padding: 10px 12px;
  border-radius: 12px;
  background: var(--risco-fundo);
  color: var(--risco-tinta);
  font-size: 13.5px;
  font-weight: 600;
  gap: 8px;
}

.eg__alerta i {
  margin-top: 2px;
}

.eg__segundo {
  display: grid;
  padding-top: 16px;
  border-top: 1px solid var(--linha);
  gap: 12px;
}

.eg__quem {
  display: grid;
  color: var(--tinta);
  font-size: 13.5px;
  font-weight: 550;
  gap: 6px;
}

.eg__select {
  width: 100%;
}

.eg__ajuda-campo {
  color: var(--tinta-2);
  font-size: 12.5px;
  font-weight: 400;
  line-height: 1.45;
}

.eg__bloco {
  display: grid;
  gap: 6px;
}

.eg__bloco h3 {
  margin: 0;
  color: var(--tinta-2);
  font-size: 12.5px;
  font-weight: 600;
  letter-spacing: 0.02em;
  text-transform: uppercase;
}

.eg__bloco ul {
  display: grid;
  margin: 0;
  padding: 0;
  list-style: none;
  gap: 8px;
}

.eg__bloco li {
  display: grid;
  gap: 1px;
}

.eg__bloco strong {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  color: var(--tinta);
  font-size: 14.5px;
  font-weight: 600;
  gap: 6px;
}

.eg__bloco li > span {
  color: var(--tinta-2);
  font-size: 13.5px;
  line-height: 1.45;
}

.eg__fatos {
  display: grid;
  margin: 0;
  gap: 8px;
}

.eg__fatos div {
  display: grid;
  gap: 1px;
}

.eg__fatos dt {
  color: var(--tinta-3);
  font-size: 12px;
  font-weight: 550;
}

.eg__fatos dd {
  margin: 0;
  color: var(--tinta);
  font-size: 14px;
}

.eg__registro {
  display: flex;
  align-items: flex-start;
  margin: 0;
  padding-top: 12px;
  border-top: 1px solid var(--linha);
  color: var(--tinta-2);
  font-size: 13px;
  line-height: 1.45;
  gap: 8px;
}

.eg__registro i {
  margin-top: 2px;
}
</style>
