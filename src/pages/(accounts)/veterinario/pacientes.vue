<script setup lang="ts">
/**
 * Pacientes.
 *
 * A busca é a mesma que a recepção faz no balcão: nome do paciente, nome de quem responde por
 * ele ou telefone. Acento não é barreira — quem digita "acai" acha "Açaí".
 *
 * Os filtros respondem às perguntas que a lista sozinha não responde: "quais gatos?", "quem
 * tem alerta de risco?", "quem está sem retorno marcado?". Ficam atrás de um botão só, com as
 * escolhas visíveis em fichas — filtro escondido é como alguém conclui que a lista sumiu.
 *
 * **Cadastrar é ação desta tela, e não só do agendamento.** Até agora o único caminho para um
 * paciente novo era abrir a agenda, começar a marcar um horário e descobrir o atalho no rodapé
 * da lista de pacientes — um lugar que só encontra quem já estava marcando. Quem chega no balcão
 * com um filhote e nenhuma consulta marcada estava na tela certa e não tinha por onde começar.
 * O botão está aqui em dois lugares: encostado no título, e dentro da lista vazia — que é
 * exatamente onde alguém para quando procurou o paciente e ele não existe. Os dois levam à
 * página de cadastro: a ficha inteira tem mais de vinte campos e não cabe num diálogo sem criar
 * uma rolagem dentro da outra.
 *
 * **Trazer a base de outro sistema também começa aqui**, pelo mesmo motivo: é outro jeito de
 * cadastrar, muitos de uma vez. Enquanto uma importação estiver em andamento ou pausada, a
 * lista avisa em cima — é por esse aviso que "continuar depois" é achável depois.
 */
import Button from 'primevue/button'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import PartnerPageFrame from '@/components/parceiro/PartnerPageFrame.vue'
import ClinicAlertChip from '@/features/clinico/components/base/ClinicAlertChip.vue'
import ClinicDataTable from '@/features/clinico/components/base/ClinicDataTable.vue'
import ClinicFilterBar from '@/features/clinico/components/base/ClinicFilterBar.vue'
import type { GrupoDeFiltro } from '@/features/clinico/components/base/filter-types'
import type { ColunaTabela } from '@/features/clinico/components/base/table-types'
import { useClinicFormat } from '@/features/clinico/composables/useClinicFormat'
import { patientRepository, type PacienteResumo } from '@/features/clinico/data/repositories'
import type { PetSpecies } from '@/features/clinico/data/types'
import { useClinicoStore } from '@/features/clinico/stores/clinico'
import { useMigracaoStore } from '@/features/clinico/stores/migracao'

const { t } = useI18n()
const router = useRouter()
const clinico = useClinicoStore()
const migracao = useMigracaoStore()
const formato = useClinicFormat()

const termo = ref('')
const selecionados = ref<Record<string, string[]>>({})
const linhas = ref<PacienteResumo[]>([])
const carregando = ref(false)
const erro = ref('')

const colunas = computed<ColunaTabela[]>(() => [
  { id: 'paciente', rotulo: t('clinico.pacientes.colunaPaciente'), largura: 'minmax(0, 1.8fr)' },
  {
    id: 'responsavel',
    rotulo: t('clinico.pacientes.colunaResponsavel'),
    largura: 'minmax(0, 1.5fr)',
    ocultarEmTelaEstreita: true,
  },
  { id: 'ultimo', rotulo: t('clinico.pacientes.colunaUltimo'), largura: '9rem' },
  { id: 'proximo', rotulo: t('clinico.pacientes.colunaProximo'), largura: '9rem' },
  { id: 'alertas', rotulo: t('clinico.pacientes.colunaAlertas'), largura: 'minmax(0, 1fr)' },
])

/** Predicados nomeados: o filtro fica legível e a contagem usa exatamente a mesma regra. */
const REGRAS: Record<string, (item: PacienteResumo) => boolean> = {
  'alerta:risco': (item) => item.pet.alertas.some((alerta) => alerta.severidade === 'risco'),
  'alerta:algum': (item) => item.pet.alertas.length > 0,
  'alerta:nenhum': (item) => item.pet.alertas.length === 0,
  'agenda:com': (item) => item.proximoAtendimentoEm !== null,
  'agenda:sem': (item) => item.proximoAtendimentoEm === null,
}

function atendeGrupo(item: PacienteResumo, grupoId: string, valores: string[]) {
  if (valores.length === 0) {
    return true
  }

  if (grupoId === 'especie') {
    return valores.includes(item.pet.especie)
  }

  /** Dentro de um grupo as opções somam (OU); entre grupos, restringem (E). */
  return valores.some((valor) => REGRAS[valor]?.(item) ?? true)
}

const visiveis = computed(() =>
  linhas.value.filter((item) =>
    Object.entries(selecionados.value).every(([grupoId, valores]) =>
      atendeGrupo(item, grupoId, valores),
    ),
  ),
)

/** Contagem por opção sobre a lista já buscada — antes de clicar já se sabe se vale. */
function contar(regra: (item: PacienteResumo) => boolean) {
  return linhas.value.filter(regra).length
}

const especiesPresentes = computed(() => {
  const vistas = new Set(linhas.value.map((item) => item.pet.especie))

  return [...vistas].sort() as PetSpecies[]
})

const grupos = computed<GrupoDeFiltro[]>(() => [
  {
    id: 'especie',
    rotulo: t('clinico.pacientes.filtro.especie'),
    opcoes: especiesPresentes.value.map((especie) => ({
      valor: especie,
      rotulo: formato.especie(especie),
      contagem: contar((item) => item.pet.especie === especie),
    })),
  },
  {
    id: 'alerta',
    rotulo: t('clinico.pacientes.colunaAlertas'),
    opcoes: [
      {
        valor: 'alerta:risco',
        rotulo: t('clinico.severidade.risco'),
        contagem: contar(REGRAS['alerta:risco']!),
      },
      {
        valor: 'alerta:algum',
        rotulo: t('clinico.pacientes.filtro.comAlerta'),
        contagem: contar(REGRAS['alerta:algum']!),
      },
      {
        valor: 'alerta:nenhum',
        rotulo: t('clinico.pacientes.filtro.semAlerta'),
        contagem: contar(REGRAS['alerta:nenhum']!),
      },
    ],
  },
  {
    id: 'agenda',
    rotulo: t('clinico.pacientes.filtro.agenda'),
    opcoes: [
      {
        valor: 'agenda:com',
        rotulo: t('clinico.pacientes.filtro.comProximo'),
        contagem: contar(REGRAS['agenda:com']!),
      },
      {
        valor: 'agenda:sem',
        rotulo: t('clinico.pacientes.filtro.semProximo'),
        contagem: contar(REGRAS['agenda:sem']!),
      },
    ],
  },
])

let atrasoDaBusca: ReturnType<typeof setTimeout> | null = null

function cancelarBuscaAtrasada() {
  if (atrasoDaBusca) {
    clearTimeout(atrasoDaBusca)
    atrasoDaBusca = null
  }
}

function cadastrar() {
  void router.push('/veterinario/paciente/novo')
}

function importar() {
  void router.push('/veterinario/paciente/importar')
}

async function buscar() {
  carregando.value = true
  erro.value = ''

  try {
    linhas.value = await patientRepository.buscar(termo.value)
  } catch {
    erro.value = t('clinico.erros.agenda')
  } finally {
    carregando.value = false
  }
}

watch(termo, () => {
  cancelarBuscaAtrasada()
  atrasoDaBusca = setTimeout(() => void buscar(), 250)
})

onMounted(async () => {
  await clinico.carregar()
  await buscar()
})
</script>

<template>
  <PartnerPageFrame
    class="hc-tema"
    :subtitle="t('clinico.pacientes.subtitulo')"
    :title="t('clinico.pacientes.titulo')"
    :loading="carregando && linhas.length === 0"
    :error="erro"
    block-when-suspended
    @retry="buscar"
  >
    <template #actions>
      <Button
        severity="secondary"
        outlined
        class="pacientes__importar"
        icon="pi pi-file-import"
        :label="t('clinico.migracao.atalho')"
        @click="importar"
      />
      <Button
        icon="pi pi-user-plus"
        :label="t('clinico.paciente.novo.atalho')"
        @click="cadastrar"
      />
    </template>

    <div class="pacientes clinic-scope">
      <p v-if="migracao.emAndamento" class="pacientes__importacao" role="status">
        <i
          class="pi"
          :class="migracao.estado === 'rodando' ? 'pi-spin pi-spinner' : 'pi-pause-circle'"
          aria-hidden="true"
        />
        <span>
          {{
            t(`clinico.migracao.aviso.lista.${migracao.estado}`, {
              feitas: formato.numero(migracao.cursor, 0),
              total: formato.numero(migracao.total, 0),
            })
          }}
        </span>
        <Button
          link
          size="small"
          :label="t(migracao.estado === 'rodando' ? 'clinico.migracao.aviso.lista.ver' : 'clinico.migracao.aviso.lista.continuar')"
          @click="importar"
        />
      </p>
      <ClinicFilterBar
        v-model:busca="termo"
        v-model:selecionados="selecionados"
        :grupos="grupos"
        :placeholder-busca="t('clinico.pacientes.buscar')"
        :resultado="visiveis.length"
      />

      <ClinicDataTable
        :colunas="colunas"
        :linhas="visiveis"
        :chave="(linha) => linha.pet.id"
        :carregando="carregando"
        :vazio-titulo="t('clinico.pacientes.vazioTitulo')"
        :vazio-descricao="t('clinico.pacientes.vazioDescricao')"
        :rotulo="t('clinico.pacientes.titulo')"
        @ativar="(linha) => router.push(`/veterinario/paciente/${linha.pet.id}/historico`)"
      >
        <template #vazio-acao>
          <Button
            icon="pi pi-user-plus"
            severity="secondary"
            outlined
            :label="t('clinico.paciente.novo.atalho')"
            @click="cadastrar"
          />
        </template>

        <template #celula-paciente="{ linha }">
          <strong class="pacientes__nome">{{ linha.pet.nome }}</strong>
          <span class="pacientes__meta">
            {{ formato.especie(linha.pet.especie) }} · {{ linha.pet.raca }} ·
            {{ formato.idade(linha.pet.nascimento) }} · {{ formato.peso(linha.pet.pesoKg) }}
          </span>
        </template>

        <template #celula-responsavel="{ linha }">
          <span class="pacientes__nome">{{ linha.tutor?.nome }}</span>
          <span class="pacientes__meta"><bdi dir="ltr">{{ linha.tutor?.telefone }}</bdi></span>
        </template>

        <template #celula-ultimo="{ linha }">
          <span v-if="linha.ultimoAtendimentoEm" class="clinic-value">
            {{ formato.dataCurta(linha.ultimoAtendimentoEm.slice(0, 10)) }}
          </span>
          <span v-else class="pacientes__meta">{{ t('clinico.pacientes.semRegistro') }}</span>
        </template>

        <template #celula-proximo="{ linha }">
          <span v-if="linha.proximoAtendimentoEm" class="clinic-value pacientes__proximo">
            {{ formato.dataCurta(linha.proximoAtendimentoEm.slice(0, 10)) }}
          </span>
          <span v-else class="pacientes__meta">—</span>
        </template>

        <template #celula-alertas="{ linha }">
          <span v-if="linha.pet.alertas.length === 0" class="pacientes__meta">—</span>
          <div v-else class="pacientes__alertas">
            <ClinicAlertChip
              v-for="alerta in linha.pet.alertas"
              :key="alerta.id"
              :severidade="alerta.severidade"
              :rotulo="formato.alerta(alerta.kind)"
              :detalhe="alerta.detalhe"
            />
          </div>
        </template>
      </ClinicDataTable>
    </div>
  </PartnerPageFrame>
</template>

<style scoped>
.pacientes {
  display: grid;
  gap: var(--clinic-space-3);
}

/*
 * O contornado da casa escreve em cinza (#797F7F sobre o linho, ~3,3:1) — o "botão que quase não
 * se vê" do retorno do migrador. Esta entrada leva a tinta do texto e a borda em Régua de Sálvia.
 */
.pacientes__importar.p-button {
  border-color: var(--clinic-line-strong);
  color: var(--clinic-text);
}

.pacientes__importar.p-button :deep(.p-button-icon) {
  color: var(--clinic-accent-strong);
}

.pacientes__importacao {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  margin: 0;
  padding: var(--clinic-space-2) var(--clinic-space-4);
  border: 1px solid var(--clinic-line);
  border-radius: var(--clinic-radius-control);
  background: var(--clinic-surface);
  color: var(--clinic-muted);
  gap: var(--clinic-space-2);
}

.pacientes__importacao .pi {
  color: var(--clinic-accent-strong);
}

.pacientes__importacao .p-button-link {
  padding: 0;
  color: var(--clinic-accent-strong);
  font-weight: 700;
}

.pacientes__nome {
  display: block;
  overflow: hidden;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pacientes__meta {
  display: block;
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
}

.pacientes__proximo {
  color: var(--clinic-accent-strong);
  font-weight: 700;
}

.pacientes__alertas {
  display: flex;
  flex-wrap: wrap;
  gap: 0.2rem;
}
</style>
