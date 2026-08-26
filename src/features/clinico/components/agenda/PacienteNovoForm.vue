<script setup lang="ts">
/**
 * Cadastro de paciente feito **dentro** do agendamento.
 *
 * Não é um segundo modal empilhado: é o mesmo diálogo trocando de conteúdo. Modal sobre modal
 * esconde o contexto ("eu estava marcando para quando mesmo?") e, no fechar, é comum voltar dois
 * passos em vez de um.
 *
 * O formulário pede **o mínimo para o atendimento acontecer**: nome, espécie e alguém por quem
 * chamar. Data de nascimento e peso ficam opcionais de propósito — quem liga para marcar
 * raramente tem os dois na mão, e campo obrigatório que ninguém sabe responder é campo que a
 * recepção preenche com qualquer coisa. Peso entra na consulta, quando o animal sobe na balança.
 *
 * O responsável pode ser um já cadastrado: cliente antigo com bicho novo é o caso comum, e
 * recadastrar a pessoa criaria um segundo cadastro com o mesmo telefone.
 */
import Button from 'primevue/button'
import InputNumber from 'primevue/inputnumber'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import ClinicField from '../base/ClinicField.vue'
import ClinicToggleGroup from '../base/ClinicToggleGroup.vue'
import { useClinicFormat } from '../../composables/useClinicFormat'
import { patientRepository } from '../../data/repositories'
import type { ISODate, Pet, PetSex, PetSpecies } from '../../data/types'
import { useClinicoStore } from '../../stores/clinico'

const emit = defineEmits<{
  criado: [pet: Pet]
  cancelar: []
}>()

const { t } = useI18n()
const clinico = useClinicoStore()
const formato = useClinicFormat()

const ESPECIES: PetSpecies[] = ['canina', 'felina', 'ave', 'roedor', 'reptil', 'equina']

const nome = ref('')
const especie = ref<PetSpecies>('canina')
const raca = ref('')
const sexo = ref<PetSex>('macho')
const nascimento = ref('')
const pesoKg = ref<number | null>(null)
const castrado = ref(false)

const responsavelExistente = ref<string | null>(null)
const novoNome = ref('')
const novoTelefone = ref('')
const novoDocumento = ref('')
const novoEmail = ref('')

const salvando = ref(false)
const erro = ref('')

const opcoesEspecie = computed(() =>
  ESPECIES.map((valor) => ({ valor, rotulo: formato.especie(valor) })),
)

const opcoesSexo = computed(() => [
  { valor: 'macho' as PetSex, rotulo: t('clinico.sexo.macho') },
  { valor: 'femea' as PetSex, rotulo: t('clinico.sexo.femea') },
])

const opcoesResponsavel = computed(() => [
  { valor: null, rotulo: t('clinico.paciente.novo.responsavelNovo') },
  ...clinico.tutores
    .map((tutor) => ({
      valor: tutor.id,
      rotulo: tutor.nome,
      detalhe: tutor.telefone,
    }))
    .sort((a, b) => a.rotulo.localeCompare(b.rotulo)),
])

const usaResponsavelNovo = computed(() => responsavelExistente.value === null)

const completo = computed(() => {
  if (!nome.value.trim()) {
    return false
  }

  if (usaResponsavelNovo.value) {
    return Boolean(novoNome.value.trim() && novoTelefone.value.trim())
  }

  return true
})

/** Trocar para responsável existente limpa o rascunho do novo — senão ele volta sozinho. */
watch(responsavelExistente, (valor) => {
  if (valor !== null) {
    novoNome.value = ''
    novoTelefone.value = ''
    novoDocumento.value = ''
    novoEmail.value = ''
  }
})

async function salvar() {
  if (!completo.value || salvando.value) {
    return
  }

  salvando.value = true
  erro.value = ''

  try {
    const { pet } = await patientRepository.criarPaciente({
      nome: nome.value,
      especie: especie.value,
      raca: raca.value,
      sexo: sexo.value,
      nascimento: (nascimento.value || null) as ISODate | null,
      pesoKg: pesoKg.value,
      castrado: castrado.value,
      tutorId: responsavelExistente.value,
      novoTutor: usaResponsavelNovo.value
        ? {
            nome: novoNome.value,
            telefone: novoTelefone.value,
            documento: novoDocumento.value,
            email: novoEmail.value,
          }
        : null,
    })

    /** O catálogo em memória precisa enxergar o paciente novo antes de a agenda o selecionar. */
    await clinico.carregar(true)

    emit('criado', pet)
  } catch {
    erro.value = t('clinico.paciente.novo.erro')
  } finally {
    salvando.value = false
  }
}
</script>

<template>
  <form class="novo clinic-scope" @submit.prevent="salvar">
    <header class="novo__topo">
      <h3>{{ t('clinico.paciente.novo.titulo') }}</h3>
      <p>{{ t('clinico.paciente.novo.ajuda') }}</p>
    </header>

    <ClinicField :rotulo="t('clinico.paciente.novo.nome')">
      <template #default="{ id }">
        <InputText :id="id" v-model="nome" fluid autofocus />
      </template>
    </ClinicField>

    <div class="novo__linha">
      <ClinicField :rotulo="t('clinico.pacientes.filtro.especie')">
        <template #default="{ id }">
          <Select
            :input-id="id"
            v-model="especie"
            fluid
            option-label="rotulo"
            option-value="valor"
            :options="opcoesEspecie"
            :pt="{ overlay: { class: 'clinic-overlay' } }"
          />
        </template>
      </ClinicField>

      <ClinicField :rotulo="t('clinico.paciente.novo.raca')">
        <template #default="{ id }">
          <InputText :id="id" v-model="raca" fluid />
        </template>
      </ClinicField>
    </div>

    <ClinicField :rotulo="t('clinico.paciente.novo.sexo')">
      <ClinicToggleGroup
        v-model="sexo"
        :opcoes="opcoesSexo"
        :rotulo="t('clinico.paciente.novo.sexo')"
      />
    </ClinicField>

    <!-- Opcionais e rotulados como tal: campo em branco aqui é resposta honesta. -->
    <div class="novo__linha">
      <ClinicField :rotulo="t('clinico.paciente.novo.nascimento')">
        <template #default="{ id }">
          <InputText :id="id" v-model="nascimento" type="date" fluid />
        </template>
      </ClinicField>

      <ClinicField :rotulo="t('clinico.paciente.novo.peso')">
        <template #default="{ id }">
          <InputNumber
            :input-id="id"
            v-model="pesoKg"
            fluid
            suffix=" kg"
            :min-fraction-digits="1"
            :max-fraction-digits="2"
          />
        </template>
      </ClinicField>
    </div>

    <label class="novo__castrado">
      <input v-model="castrado" type="checkbox" />
      <span>{{ t('clinico.paciente.novo.castrado') }}</span>
    </label>

    <section class="responsavel">
      <h4 class="clinic-label">{{ t('clinico.paciente.responsavel') }}</h4>

      <Select
        v-model="responsavelExistente"
        filter
        fluid
        option-label="rotulo"
        option-value="valor"
        :options="opcoesResponsavel"
        :filter-placeholder="t('clinico.paciente.novo.buscarResponsavel')"
        :placeholder="t('clinico.paciente.novo.responsavelNovo')"
        :pt="{ overlay: { class: 'clinic-overlay' } }"
      >
        <template #option="{ option }">
          <span class="opcao">
            <strong>{{ option.rotulo }}</strong>
            <small v-if="option.detalhe">{{ option.detalhe }}</small>
          </span>
        </template>
      </Select>

      <template v-if="usaResponsavelNovo">
        <div class="novo__linha">
          <ClinicField :rotulo="t('clinico.paciente.novo.nomeResponsavel')">
            <template #default="{ id }">
              <InputText :id="id" v-model="novoNome" fluid />
            </template>
          </ClinicField>

          <ClinicField :rotulo="t('clinico.paciente.novo.telefone')">
            <template #default="{ id }">
              <InputText :id="id" v-model="novoTelefone" fluid inputmode="tel" />
            </template>
          </ClinicField>
        </div>

        <div class="novo__linha">
          <ClinicField :rotulo="t('clinico.paciente.novo.documento')">
            <template #default="{ id }">
              <InputText :id="id" v-model="novoDocumento" fluid />
            </template>
          </ClinicField>

          <ClinicField :rotulo="t('clinico.paciente.novo.email')">
            <template #default="{ id }">
              <InputText :id="id" v-model="novoEmail" fluid inputmode="email" />
            </template>
          </ClinicField>
        </div>
      </template>
    </section>

    <p v-if="erro" class="novo__erro">{{ erro }}</p>

    <footer class="novo__rodape">
      <Button
        severity="secondary"
        text
        :label="t('clinico.comum.cancelar')"
        @click="emit('cancelar')"
      />
      <Button
        :disabled="!completo || salvando"
        :loading="salvando"
        :label="t('clinico.paciente.novo.salvar')"
        @click="salvar"
      />
    </footer>
  </form>
</template>

<style scoped>
.novo {
  display: grid;
  gap: var(--clinic-space-3);
}

.novo__topo h3 {
  margin: 0;
  color: var(--clinic-text);
  font-size: var(--clinic-font-value);
  font-weight: 750;
}

.novo__topo p {
  margin: 0.15rem 0 0;
  color: var(--clinic-muted);
  font-size: var(--clinic-font-label);
  line-height: 1.45;
}

.novo__linha {
  display: grid;
  gap: var(--clinic-space-3);
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
}

.novo__castrado {
  display: flex;
  align-items: center;
  gap: var(--clinic-space-2);
  color: var(--clinic-text);
  cursor: pointer;
  font-size: var(--clinic-font-base);
}

.responsavel {
  display: grid;
  gap: var(--clinic-space-3);
  padding: var(--clinic-space-3);
  border: 1px solid var(--clinic-line);
  border-radius: var(--clinic-radius-card);
  background: var(--clinic-surface-soft);
}

.opcao {
  display: grid;
  gap: 0.05rem;
}

.opcao small {
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
}

.novo__erro {
  margin: 0;
  color: var(--clinic-risk-text);
  font-size: var(--clinic-font-label);
  font-weight: 650;
}

.novo__rodape {
  display: flex;
  justify-content: flex-end;
  gap: var(--clinic-space-2);
}

@media (max-width: 620px) {
  .novo__linha {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
