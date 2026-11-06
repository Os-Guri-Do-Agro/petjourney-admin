<script setup lang="ts">
/**
 * O pedido de cópia feito no balcão (E4-06c, guia e4 10.2): o paciente, quem pede e o documento
 * dela (que nunca volta da API) e, se quiser, um período. Já havia um pedido aberto do mesmo
 * paciente, período e documento: a API devolve o mesmo (`jaExistia`), e a gaveta diz isso.
 *
 * O prazo de 5 dias úteis o servidor conta; a gaveta do pedido abre em seguida e o mostra.
 */
import AutoComplete from 'primevue/autocomplete'
import Button from 'primevue/button'
import DatePicker from 'primevue/datepicker'
import InputText from 'primevue/inputtext'
import SelectButton from 'primevue/selectbutton'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import CadastroGaveta from '@/components/cadastro/CadastroGaveta.vue'
import { lerErroDoCadastro } from '@/components/cadastro/erros-do-cadastro'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { registrarPedidoDeCopia, type PedidoDeCopia } from '@/service/parceiro/copias-service'
import { listarPacientes, type PacienteNaLista } from '@/service/parceiro/pacientes-service'

const aberta = defineModel<boolean>('visible', { default: false })
const emit = defineEmits<{ registrado: [pedido: PedidoDeCopia, jaExistia: boolean] }>()

const { t } = useI18n()
const { parceiroQuery } = useParceiroPortal()

/* O SelectButton não marca a opção de valor nulo: o "todo o histórico" é uma palavra. */
type Alcance = 'TUDO' | 'PERIODO'

const paciente = ref<PacienteNaLista | null>(null)
const sugestoes = ref<PacienteNaLista[]>([])
const nome = ref('')
const documento = ref('')
const alcance = ref<Alcance>('TUDO')
const intervalo = ref<Date[] | null>(null)
const tentou = ref(false)
const salvando = ref(false)
const erro = ref('')
const campoComErro = ref('')

const hoje = new Date()

watch(aberta, (agora) => {
  if (!agora) return
  paciente.value = null
  nome.value = ''
  documento.value = ''
  alcance.value = 'TUDO'
  intervalo.value = null
  tentou.value = false
  erro.value = ''
  campoComErro.value = ''
})

const opcoesDeAlcance = computed(() => [
  { valor: 'TUDO', rotulo: t('copias.periodo.tudo') },
  { valor: 'PERIODO', rotulo: t('copias.novo.umPeriodo') },
])

async function buscar(evento: { query: string }) {
  try {
    const pagina = await listarPacientes({ q: evento.query, limit: 10 }, parceiroQuery())
    sugestoes.value = pagina.itens
  } catch {
    sugestoes.value = []
  }
}

function rotuloDoPaciente(item: PacienteNaLista) {
  return `${item.nome} · ${item.cliente.nome}`
}

const pacienteValido = computed(() => Boolean(paciente.value && typeof paciente.value === 'object'))
const nomeValido = computed(() => nome.value.trim().length >= 2)
const documentoValido = computed(() => documento.value.trim().length >= 4)
const periodoValido = computed(
  () => alcance.value === 'TUDO' || Boolean(intervalo.value?.[0] && intervalo.value?.[1]),
)

function dia(data: Date) {
  const mes = String(data.getMonth() + 1).padStart(2, '0')
  const d = String(data.getDate()).padStart(2, '0')
  return `${data.getFullYear()}-${mes}-${d}`
}

async function registrar() {
  tentou.value = true
  erro.value = ''
  campoComErro.value = ''
  if (!pacienteValido.value || !nomeValido.value || !documentoValido.value || !periodoValido.value)
    return
  const [de, ate] = alcance.value === 'PERIODO' ? (intervalo.value ?? []) : []
  salvando.value = true
  try {
    const resposta = await registrarPedidoDeCopia(
      {
        pacienteId: paciente.value!.id,
        solicitanteNome: nome.value.trim(),
        solicitanteDocumento: documento.value.trim(),
        ...(de && ate ? { de: dia(de), ate: dia(ate) } : {}),
      },
      parceiroQuery(),
    )
    aberta.value = false
    /* O recado vai na gaveta do pedido, que abre em seguida (o toast taparia o fechar dela). */
    emit('registrado', resposta.pedido, resposta.jaExistia)
  } catch (err) {
    const lido = lerErroDoCadastro(err, t('copias.novo.erro'))
    campoComErro.value = lido.codigo === 'COPIA_PERIODO_INVALIDO' ? 'periodo' : (lido.campo ?? '')
    erro.value = lido.mensagem
  } finally {
    salvando.value = false
  }
}
</script>

<template>
  <CadastroGaveta
    v-model:visible="aberta"
    :titulo="t('copias.novo.titulo')"
    icone="ph ph-copy"
    largura="34rem"
  >
    <form id="novo-pedido-de-copia" class="eg" novalidate @submit.prevent="registrar">
      <p class="eg__dica">{{ t('copias.novo.dica') }}</p>

      <section class="eg__secao">
        <label class="eg__rotulo" for="np-paciente">{{ t('copias.novo.paciente') }}</label>
        <AutoComplete
          v-model="paciente"
          input-id="np-paciente"
          :suggestions="sugestoes"
          :option-label="rotuloDoPaciente"
          :placeholder="t('fila.buscarPaciente')"
          :invalid="tentou && !pacienteValido"
          :disabled="salvando"
          force-selection
          @complete="buscar"
        />
        <small v-if="tentou && !pacienteValido" class="eg__invalido">{{
          t('fila.pacienteObrigatorio')
        }}</small>
      </section>

      <div class="eg__linha">
        <section class="eg__secao">
          <label class="eg__rotulo" for="np-nome">{{ t('copias.novo.nome') }}</label>
          <InputText
            id="np-nome"
            v-model="nome"
            autocomplete="off"
            :invalid="tentou && !nomeValido"
            :disabled="salvando"
          />
        </section>
        <section class="eg__secao">
          <label class="eg__rotulo" for="np-documento">{{ t('copias.novo.documento') }}</label>
          <InputText
            id="np-documento"
            v-model="documento"
            autocomplete="off"
            :invalid="tentou && !documentoValido"
            :disabled="salvando"
          />
        </section>
      </div>
      <small class="eg__dica np__dica">{{ t('copias.novo.documentoDica') }}</small>

      <section class="eg__secao">
        <span id="np-alcance" class="eg__rotulo">{{ t('copias.fato.periodo') }}</span>
        <SelectButton
          v-model="alcance"
          :options="opcoesDeAlcance"
          option-label="rotulo"
          option-value="valor"
          :allow-empty="false"
          aria-labelledby="np-alcance"
          :disabled="salvando"
        />
        <DatePicker
          v-if="alcance === 'PERIODO'"
          v-model="intervalo"
          inline
          selection-mode="range"
          :manual-input="false"
          :max-date="hoje"
          aria-labelledby="np-alcance"
          :invalid="(tentou && !periodoValido) || campoComErro === 'periodo'"
          :disabled="salvando"
        />
        <small v-if="tentou && !periodoValido" class="eg__invalido">{{
          t('copias.periodoObrigatorio')
        }}</small>
      </section>

      <p v-if="erro" class="eg__erro" role="alert">
        <i class="ph ph-warning-circle" aria-hidden="true" />
        <span>{{ erro }}</span>
      </p>
    </form>

    <template #pe>
      <Button
        type="button"
        severity="secondary"
        outlined
        :label="t('cadastro.cancelar')"
        :disabled="salvando"
        @click="aberta = false"
      />
      <Button
        type="submit"
        form="novo-pedido-de-copia"
        icon="ph ph-check"
        :label="t('copias.novo.confirmar')"
        :loading="salvando"
      />
    </template>
  </CadastroGaveta>
</template>

<style scoped>
.np__dica {
  margin-top: -14px;
}
</style>
