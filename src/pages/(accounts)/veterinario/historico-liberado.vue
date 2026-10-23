<script setup lang="ts">
/**
 * Histórico liberado — o histórico que viaja com o pet, visto da clínica (doc 19).
 *
 * O histórico é do responsável: ele libera para a clínica o que quer, por um prazo, e encerra
 * quando quiser. Aqui moram os pacientes que chegaram assim — o que vale em cima, o que terminou
 * embaixo — e as duas portas de entrada da recepção: o código que o responsável mostra no balcão e
 * o QR da coleira, para a emergência sem ninguém por perto.
 *
 * A linha só tem o que decide: quem, o que a clínica vê, até quando e quem da clínica abriu por
 * último. O histórico mora na gaveta. O celular do responsável abre ao lado, como nos pedidos:
 * encerrar lá some com o histórico aqui na hora, e abrir aqui aparece lá em "Quem abriu".
 */
import Button from 'primevue/button'
import Drawer from 'primevue/drawer'
import SelectButton from 'primevue/selectbutton'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import UiPagina from '@/components/ui/UiPagina.vue'
import { useSidePanelOffset } from '@/composables/useSidePanelOffset'
import { useTelaLarga } from '@/composables/useTelaLarga'
import PetAvatar from '@/features/hotel/components/base/PetAvatar.vue'
import EmergenciaGaveta from '@/features/clinico/components/historico/EmergenciaGaveta.vue'
import HistoricoGaveta from '@/features/clinico/components/historico/HistoricoGaveta.vue'
import HistoricoNoApp from '@/features/clinico/components/historico/HistoricoNoApp.vue'
import ReceberCodigoGaveta from '@/features/clinico/components/historico/ReceberCodigoGaveta.vue'
import { useClinicFormat } from '@/features/clinico/composables/useClinicFormat'
import { useRotulosDoHistorico } from '@/features/clinico/composables/useRotulosDoHistorico'
import type { LinhaDoHistorico } from '@/features/clinico/data/historico-compartilhado'
import {
  RESPONSAVEL_DO_CONFLITO,
  RESPONSAVEL_DO_PRAZO,
} from '@/features/clinico/data/seed-historico'
import { RESPONSAVEL_SEM_VINCULO } from '@/features/clinico/data/seed-pedidos'
import { useClinicoStore } from '@/features/clinico/stores/clinico'
import { useHistoricoLiberadoStore } from '@/features/clinico/stores/historico'

const { t } = useI18n()
const clinico = useClinicoStore()
const historico = useHistoricoLiberadoStore()
const formato = useClinicFormat()
const rotulos = useRotulosDoHistorico()

async function carregar() {
  await clinico.carregar()
  await historico.carregar()
}

onMounted(carregar)

const fraseDoResumo = computed(() => {
  if (!historico.carregado) {
    return ''
  }

  const n = historico.valendo.length

  return n === 0
    ? t('clinico.historicoLiberado.resumo.nenhum')
    : t('clinico.historicoLiberado.resumo.valendo', { n }, n)
})

// ------------------------------------------------------------------ as gavetas
// Uma de cada vez, todas do mesmo lado: abrir uma guarda a outra.

type Gaveta = 'historico' | 'receber' | 'coleira' | 'celular' | null

const gaveta = ref<Gaveta>(null)
const acessoAberto = ref<string | null>(null)

function abrir(qual: Exclude<Gaveta, null>) {
  gaveta.value = gaveta.value === qual ? null : qual
}

function abrirHistorico(linha: LinhaDoHistorico) {
  acessoAberto.value = linha.acessoId
  gaveta.value = 'historico'
}

watch(gaveta, (atual) => {
  if (atual !== 'historico') {
    acessoAberto.value = null
  }
})

/*
 * Recebido: a gaveta do histórico abre na hora com o que chegou, e a linha aparece em "Valendo".
 * Sem toast — ele cairia em cima do cabeçalho da gaveta e tamparia o fechar; a gaveta aberta já é
 * a confirmação.
 */
async function recebido(payload: { acessoId: string; petNome: string }) {
  /* O pet que só existia no app acabou de virar paciente: o catálogo relê antes de abrir. */
  await clinico.carregar(true)
  await historico.avisarMudanca()
  acessoAberto.value = payload.acessoId
  gaveta.value = 'historico'
}

// ------------------------------------------------------------------ o celular

const celularAberto = computed({
  get: () => gaveta.value === 'celular',
  set: (valor: boolean) => {
    gaveta.value = valor ? 'celular' : null
  },
})

/* O celular empurra a página só com largura para isso; em 1024 px passa por cima, sem véu. */
const telaLarga = useTelaLarga()

useSidePanelOffset(
  computed(() => celularAberto.value && telaLarga.value),
  '27rem',
)

const pessoa = ref<string>(RESPONSAVEL_DO_CONFLITO)

const pessoas = computed(() => [
  { valor: RESPONSAVEL_DO_CONFLITO, rotulo: t('clinico.historicoLiberado.ensaio.eduardo') },
  { valor: RESPONSAVEL_SEM_VINCULO, rotulo: t('clinico.historicoLiberado.ensaio.renata') },
  { valor: RESPONSAVEL_DO_PRAZO, rotulo: t('clinico.historicoLiberado.ensaio.camila') },
])

async function mudou() {
  await historico.avisarMudanca()
}

function quandoAbriu(linha: LinhaDoHistorico): string {
  return linha.ultimaAbertura
    ? t('clinico.historicoLiberado.linha.ultimaAbertura', {
        nome: linha.ultimaAbertura.profissionalNome,
        quando: formato.relativo(linha.ultimaAbertura.em),
      })
    : t('clinico.historicoLiberado.linha.nuncaAberto')
}
</script>

<template>
  <UiPagina
    class="tela-historico"
    :carregando="!historico.carregado && !historico.erro"
    :erro="historico.erro && !historico.carregado ? t(historico.erro) : ''"
    :vazio="historico.carregado && historico.linhas.length === 0"
    :vazio-titulo="t('clinico.historicoLiberado.vazio.titulo')"
    :vazio-descricao="t('clinico.historicoLiberado.vazio.corpo')"
    :vazio-acao="t('clinico.historicoLiberado.acoes.receber')"
    vazio-icone="ph ph-share-network"
    bloquear-se-suspenso
    @tentar-de-novo="carregar"
    @acao-do-vazio="abrir('receber')"
  >
    <template v-if="fraseDoResumo" #resumo>
      <span aria-live="polite">{{ fraseDoResumo }}</span>
    </template>

    <template #acoes>
      <div class="topo-acoes clinic-scope">
        <Button
          type="button"
          severity="secondary"
          text
          icon="ph ph-device-mobile"
          :label="t('clinico.historicoLiberado.acoes.verComoVe')"
          :aria-expanded="celularAberto"
          @click="abrir('celular')"
        />
        <Button
          type="button"
          severity="secondary"
          outlined
          icon="ph ph-qr-code"
          :label="t('clinico.historicoLiberado.acoes.coleira')"
          aria-haspopup="dialog"
          @click="abrir('coleira')"
        />
        <Button
          type="button"
          icon="ph ph-key"
          :label="t('clinico.historicoLiberado.acoes.receber')"
          aria-haspopup="dialog"
          @click="abrir('receber')"
        />
      </div>
    </template>

    <div class="historico clinic-scope">
      <section v-if="historico.valendo.length" class="bloco ui-folha" aria-labelledby="hl-valendo">
        <header class="bloco__cabeca">
          <h2 id="hl-valendo">{{ t('clinico.historicoLiberado.secoes.valendo') }}</h2>
          <span class="bloco__conta">{{ historico.valendo.length }}</span>
        </header>
        <ul class="linhas">
          <li
            v-for="linha in historico.valendo"
            :key="linha.acessoId"
            class="linha"
            :class="{ 'linha--aberta': acessoAberto === linha.acessoId }"
          >
            <PetAvatar
              :nome="linha.petNome"
              :iniciais="linha.petIniciais"
              :especie="linha.especie"
              :foto-url="linha.petFotoUrl"
            />
            <span class="linha__quem">
              <strong>{{ linha.petNome }}</strong>
              <span>{{
                t('clinico.historicoLiberado.linha.deQuem', { nome: linha.tutorNome })
              }}</span>
            </span>
            <span class="linha__o-que">
              <span>{{
                t('clinico.historicoLiberado.linha.ve', {
                  lista: rotulos.categorias(linha.categorias),
                })
              }}</span>
              <span v-if="linha.clinicasDeOrigem.length" class="linha__fraco">
                {{
                  t('clinico.historicoLiberado.linha.veioDe', {
                    lista: rotulos.lista(linha.clinicasDeOrigem),
                  })
                }}
              </span>
            </span>
            <span class="linha__quando">
              <span>{{
                t('clinico.historicoLiberado.linha.valeAte', { data: rotulos.data(linha.expiraEm) })
              }}</span>
              <span class="linha__fraco">{{ quandoAbriu(linha) }}</span>
            </span>
            <Button
              type="button"
              severity="secondary"
              outlined
              :label="t('clinico.historicoLiberado.linha.abrir')"
              @click="abrirHistorico(linha)"
            />
          </li>
        </ul>
      </section>

      <!-- Terminados: recolhidos embaixo, sem dizer se foi o prazo ou o responsável. -->
      <section
        v-if="historico.terminados.length"
        class="bloco bloco--terminados"
        aria-labelledby="hl-terminados"
      >
        <header class="bloco__cabeca">
          <h2 id="hl-terminados">{{ t('clinico.historicoLiberado.secoes.terminados') }}</h2>
          <span class="bloco__conta">{{ historico.terminados.length }}</span>
        </header>
        <ul class="linhas">
          <li
            v-for="linha in historico.terminados"
            :key="linha.acessoId"
            class="linha linha--terminou"
          >
            <PetAvatar
              :nome="linha.petNome"
              :iniciais="linha.petIniciais"
              :especie="linha.especie"
              :foto-url="linha.petFotoUrl"
            />
            <span class="linha__quem">
              <strong>{{ linha.petNome }}</strong>
              <span>{{
                t('clinico.historicoLiberado.linha.deQuem', { nome: linha.tutorNome })
              }}</span>
            </span>
            <span class="linha__o-que linha__fraco">
              {{
                t('clinico.historicoLiberado.linha.terminouEm', {
                  data: rotulos.data(linha.terminouEm ?? linha.expiraEm),
                })
              }}
            </span>
            <span class="linha__quando" />
            <Button
              type="button"
              severity="secondary"
              outlined
              :label="t('clinico.historicoLiberado.linha.abrir')"
              @click="abrirHistorico(linha)"
            />
          </li>
        </ul>
      </section>
    </div>

    <template #sempre>
      <HistoricoGaveta
        :acesso-id="gaveta === 'historico' ? acessoAberto : null"
        @fechar="gaveta = null"
        @abriu="historico.avisarMudanca()"
      />
      <ReceberCodigoGaveta
        :aberta="gaveta === 'receber'"
        @fechar="gaveta = null"
        @recebido="recebido"
      />
      <EmergenciaGaveta
        :aberta="gaveta === 'coleira'"
        @fechar="gaveta = null"
        @abriu="historico.avisarMudanca()"
      />

      <!--
        O celular do responsável, numa gaveta que empurra a página: os dois lados à vista.
        Encerrar lá e ver o histórico sumir aqui é a demonstração.
      -->
      <Drawer
        v-model:visible="celularAberto"
        position="right"
        :modal="false"
        :dismissable="false"
        class="historico-celular clinic-overlay"
        :style="{ width: 'min(27rem, 94vw)' }"
      >
        <template #header>
          <h2 class="celular-titulo">
            <i class="ph ph-device-mobile" aria-hidden="true" />
            {{ t('clinico.historicoLiberado.acoes.verComoVe') }}
          </h2>
        </template>

        <div class="celular-corpo clinic-scope">
          <div class="ensaio">
            <span id="ensaio-historico" class="ensaio__rotulo">
              {{ t('clinico.historicoLiberado.ensaio.quem') }}
            </span>
            <SelectButton
              v-model="pessoa"
              :options="pessoas"
              option-label="rotulo"
              option-value="valor"
              :allow-empty="false"
              aria-labelledby="ensaio-historico"
              class="ensaio__pessoas"
            />
          </div>

          <HistoricoNoApp :tutor-id="pessoa" @mudou="mudou" />
        </div>
      </Drawer>
    </template>
  </UiPagina>
</template>

<style scoped>
.topo-acoes {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

/* A lista decide a quebra pela largura dela, não da janela: as gavetas empurram a página. */
.historico {
  display: grid;
  gap: 24px;
  container-type: inline-size;
}

.bloco {
  display: grid;
  padding: 6px 0;
}

.bloco--terminados {
  padding: 0;
}

.bloco__cabeca {
  display: flex;
  align-items: baseline;
  padding: 12px 20px 6px;
  gap: 10px;
}

.bloco__cabeca h2 {
  margin: 0;
  color: var(--tinta);
  font-size: 15px;
  font-weight: 650;
}

.bloco__conta {
  color: var(--tinta-3);
  font-size: 13px;
}

.linhas {
  display: grid;
  margin: 0;
  padding: 0;
  list-style: none;
}

.linha {
  display: grid;
  align-items: center;
  padding: 14px 20px;
  border-top: 1px solid var(--linha);
  gap: 14px;
  grid-template-columns: auto minmax(10rem, 1.1fr) minmax(12rem, 1.6fr) minmax(11rem, 1.2fr) auto;
  transition: background-color 160ms ease-out;
}

.linha:first-child {
  border-top: 0;
}

/* A linha aberta na gaveta fica tingida: a lista continua à vista. */
.linha--aberta {
  background: var(--clinica-fundo);
}

.linha--terminou {
  color: var(--tinta-2);
}

.linha__quem,
.linha__o-que,
.linha__quando {
  display: grid;
  min-width: 0;
  gap: 2px;
  color: var(--tinta-2);
  font-size: 13.5px;
  line-height: 1.4;
}

.linha__quem strong {
  color: var(--tinta);
  font-size: 15px;
  font-weight: 650;
}

.linha--terminou .linha__quem strong {
  color: var(--tinta-2);
  font-weight: 600;
}

.linha__o-que > span:first-child,
.linha__quando > span:first-child {
  color: var(--tinta);
}

.linha__fraco,
.linha__o-que > .linha__fraco {
  color: var(--tinta-3);
  font-size: 12.5px;
}

@media (prefers-reduced-motion: reduce) {
  .linha {
    transition: none;
  }
}

@container (max-width: 860px) {
  .linha {
    grid-template-columns: auto minmax(0, 1fr) auto;
  }

  .linha__o-que,
  .linha__quando {
    grid-column: 2;
  }

  .linha > :last-child {
    grid-row: 1;
    grid-column: 3;
  }
}

/* ------------------------------------------------------------------ gaveta do celular */

.celular-titulo {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  color: var(--tinta);
  font-size: 17px;
  font-weight: 600;
}

.celular-titulo i {
  color: var(--clinica-tinta);
  font-size: 20px;
}

.celular-corpo {
  display: grid;
  gap: 14px;
}

.ensaio {
  display: grid;
  gap: 8px;
  padding: 12px 14px;
  border-radius: 14px;
  background: var(--superficie-2);
}

.ensaio__rotulo {
  color: var(--tinta-2);
  font-size: 12.5px;
  font-weight: 550;
}

.ensaio__pessoas {
  display: flex;
  flex-wrap: wrap;
}

.ensaio :deep(.p-togglebutton-checked .p-togglebutton-content) {
  background: var(--superficie);
  color: var(--tinta);
}
</style>
