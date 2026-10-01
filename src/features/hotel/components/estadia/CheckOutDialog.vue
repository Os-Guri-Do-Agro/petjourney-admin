<script setup lang="ts">
/**
 * Check-out — a regra R4 na tela.
 *
 * O diálogo é uma **conferência**, não um formulário: o que ele faz é pôr lado a lado o que
 * entrou e o que sai, com uma caixa por item. O botão de fechar só acende quando a lista está
 * resolvida e a balança foi usada.
 *
 * "Resolvido" inclui **não devolvido com observação**: a coleira que se perdeu, e alguém escreveu
 * que se perdeu, é um check-out honesto. O que não pode é o item em branco, porque em branco
 * significa que ninguém olhou — e é aí que a reclamação nasce, três dias depois, por telefone.
 */
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import Dialog from 'primevue/dialog'
import InputNumber from 'primevue/inputnumber'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import Message from 'primevue/message'
import { computed, ref, useId, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import HotelSelo from '../base/HotelSelo.vue'
import { useHotelFormat } from '../../composables/useHotelFormat'
import { variacaoDePeso } from '../../domain/estadia'
import type { Hospedagem, Ocorrencia } from '../../data/types'

const props = defineProps<{
  aberto: boolean
  hospedagem: Hospedagem | null
  petNome: string
  saldoCentavos: number
  acrescimoDeSaida: number
  /** Ocorrências graves sem contato: elas travam a saída tanto quanto o pertence esquecido. */
  ocorrenciasTravadas: Ocorrencia[]
  /** O responsável, sempre autorizado — é dele o animal. */
  responsavelNome: string
  /** Quem mais o responsável autorizou na reserva. Vazio significa "só ele". */
  autorizadosARetirar: string[]
  salvando: boolean
  erro: string
}>()

const emit = defineEmits<{
  fechar: []
  conferir: [payload: { pertenceId: string; devolvido: boolean; observacao: string }]
  pesar: [pesoKg: number]
  confirmar: [retiradoPor: string]
}>()

const { t } = useI18n()
const formato = useHotelFormat()
const idCampo = useId()

const peso = ref<number | null>(null)
const observacoes = ref<Record<string, string>>({})

/**
 * Quem está levando o animal.
 *
 * O sistema sabia qual atendente entregou e **não sabia a quem**. Entregar um animal a quem
 * aparecer é o erro que não tem desfazer, e o momento de conferir é este, com o animal ainda na
 * coleira do hotel.
 *
 * A lista vem da reserva; "outra pessoa" continua possível, porque a vida acontece — mas então o
 * nome é digitado, e fica gravado que não era ninguém da lista.
 */
const retiradoPor = ref('')
const outraPessoa = ref(false)

const quemPodeRetirar = computed(() => [props.responsavelNome, ...props.autorizadosARetirar])

watch(
  () => props.aberto,
  (aberto) => {
    if (aberto) {
      peso.value = props.hospedagem?.pesoSaidaKg ?? null
      retiradoPor.value = props.responsavelNome
      outraPessoa.value = false
      observacoes.value = Object.fromEntries(
        (props.hospedagem?.pertences ?? []).map((item) => [item.id, item.observacao]),
      )
    }
  },
)

const pendentes = computed(() =>
  (props.hospedagem?.pertences ?? []).filter(
    (item) => !item.devolvido && !(observacoes.value[item.id] ?? '').trim(),
  ),
)

const variacao = computed(() =>
  props.hospedagem ? variacaoDePeso({ ...props.hospedagem, pesoSaidaKg: peso.value }) : null,
)

/**
 * Cinco por cento: abaixo disso cabe na diferença entre duas balanças e no fato de o animal ter
 * acabado de comer. Acima, é a estadia que não correu bem — e o responsável vai perguntar.
 */
const perdaRelevante = computed(() => (variacao.value ?? 0) <= -0.05)

const podeFechar = computed(
  () =>
    pendentes.value.length === 0 &&
    props.ocorrenciasTravadas.length === 0 &&
    props.hospedagem?.pesoSaidaKg !== null &&
    retiradoPor.value.trim() !== '',
)

function alternar(pertenceId: string, devolvido: boolean) {
  emit('conferir', {
    pertenceId,
    devolvido,
    observacao: observacoes.value[pertenceId] ?? '',
  })
}

function anotar(pertenceId: string) {
  emit('conferir', {
    pertenceId,
    devolvido: false,
    observacao: observacoes.value[pertenceId] ?? '',
  })
}

/**
 * Alterna entre a lista de autorizados e o campo livre.
 *
 * Função e não duas instruções no `@click`: o template do Vue aceita **uma** expressão, e duas
 * linhas ali passam pelo typecheck e quebram no build — foi o que aconteceu.
 */
function alternarQuemRetira() {
  outraPessoa.value = !outraPessoa.value
  retiradoPor.value = outraPessoa.value ? '' : props.responsavelNome
}

function pesar() {
  if ((peso.value ?? 0) > 0) {
    emit('pesar', peso.value ?? 0)
  }
}
</script>

<template>
  <Dialog
    :visible="aberto"
    modal
    :header="t('hotel.checkout.titulo', { pet: petNome })"
    :style="{ width: 'min(44rem, 94vw)' }"
    class="clinic-scope hc-tema"
    @update:visible="emit('fechar')"
  >
    <div v-if="hospedagem" class="saida">
      <!--
        A ocorrência sem contato aparece primeiro e não é conferível aqui: resolvê-la exige pegar
        o telefone, não marcar uma caixa. O que a tela faz é dizer isso em voz alta antes de
        alguém tentar fechar.
      -->
      <Message v-if="ocorrenciasTravadas.length > 0" severity="error" :closable="false">
        {{
          t(
            'hotel.checkout.ocorrenciaTravada',
            { total: ocorrenciasTravadas.length },
            ocorrenciasTravadas.length,
          )
        }}
      </Message>

      <section class="bloco">
        <h3 class="bloco__titulo">{{ t('hotel.checkout.pertences') }}</h3>

        <ul class="pertences">
          <li v-for="item in hospedagem.pertences" :key="item.id">
            <div class="pertences__linha">
              <Checkbox
                :input-id="`${idCampo}-${item.id}`"
                :model-value="item.devolvido"
                binary
                @update:model-value="alternar(item.id, Boolean($event))"
              />
              <label :for="`${idCampo}-${item.id}`">{{ item.descricao }}</label>

              <HotelSelo
                v-if="item.devolvido"
                :rotulo="t('hotel.checkout.devolvido')"
                tom="positivo"
              />
            </div>

            <!--
              O campo de observação só aparece para o que não foi devolvido: oferecê-lo em toda
              linha convidaria a escrever onde não é preciso, e a conferência perderia o sinal.
            -->
            <InputText
              v-if="!item.devolvido"
              v-model="observacoes[item.id]"
              size="small"
              fluid
              :placeholder="t('hotel.checkout.oQueHouve')"
              :aria-label="t('hotel.checkout.oQueHouve')"
              @blur="anotar(item.id)"
            />
          </li>
        </ul>
      </section>

      <section class="bloco">
        <h3 class="bloco__titulo">{{ t('hotel.checkout.pesagem') }}</h3>

        <div class="pesagem">
          <InputNumber
            :input-id="`${idCampo}-peso`"
            v-model="peso"
            :min="0"
            :max-fraction-digits="1"
            suffix=" kg"
            :aria-label="t('hotel.checkout.pesoSaida')"
          />
          <Button
            :label="t('hotel.checkout.registrarPeso')"
            severity="secondary"
            outlined
            :disabled="!peso"
            @click="pesar"
          />

          <span class="pesagem__entrada">
            {{ t('hotel.checkout.pesoEntrada', { valor: formato.peso(hospedagem.pesoEntradaKg) }) }}
          </span>

          <HotelSelo
            v-if="hospedagem.pesoSaidaKg !== null"
            :rotulo="formato.variacao(variacao)"
            :tom="perdaRelevante ? 'atencao' : 'neutro'"
            icone="pi pi-chart-line"
          />
        </div>

        <p v-if="perdaRelevante && hospedagem.pesoSaidaKg !== null" class="pesagem__aviso">
          {{ t('hotel.checkout.perdaRelevante') }}
        </p>
      </section>

      <!--
        O que foi visto na chegada volta aqui, ao lado do animal saindo.
        Era registrado no check-in e nunca mais mostrado — e é exatamente a informação que decide
        "ele já chegou com isso" quando a reclamação chega por telefone três dias depois.
      -->
      <section v-if="hospedagem.inspecaoDeEntrada" class="bloco">
        <h3 class="bloco__titulo">{{ t('hotel.checkout.comoChegou') }}</h3>

        <p class="entrada">
          <i class="pi pi-eye" aria-hidden="true" />
          <span>{{ hospedagem.inspecaoDeEntrada }}</span>
        </p>

        <p class="entrada__lede">{{ t('hotel.checkout.comoChegouLede') }}</p>
      </section>

      <section class="bloco">
        <h3 class="bloco__titulo">{{ t('hotel.checkout.fechamento') }}</h3>

        <p v-if="acrescimoDeSaida > 0" class="saida__tardia">
          <i class="pi pi-clock" aria-hidden="true" />
          {{ t('hotel.checkout.saidaTardia', { percentual: acrescimoDeSaida }) }}
        </p>

        <p class="saida__saldo">
          <span>{{ t('hotel.checkout.saldo') }}</span>
          <strong class="clinic-value">{{ formato.moeda(saldoCentavos) }}</strong>
        </p>
      </section>

      <section class="bloco">
        <h3 class="bloco__titulo">{{ t('hotel.checkout.quemRetira') }}</h3>

        <div class="retirada">
          <Select
            v-if="!outraPessoa"
            v-model="retiradoPor"
            :options="quemPodeRetirar.map((nome) => ({ valor: nome, rotulo: nome }))"
            option-label="rotulo"
            option-value="valor"
            :aria-label="t('hotel.checkout.quemRetira')"
            fluid
          />

          <InputText
            v-else
            v-model="retiradoPor"
            :placeholder="t('hotel.checkout.outraPessoaDica')"
            :aria-label="t('hotel.checkout.quemRetira')"
            fluid
          />

          <Button
            :label="
              outraPessoa ? t('hotel.checkout.voltarALista') : t('hotel.checkout.outraPessoa')
            "
            severity="secondary"
            text
            size="small"
            @click="alternarQuemRetira"
          />
        </div>

        <!-- Entregar a quem não está na lista é decisão de quem atende, e ela fica registrada. -->
        <Message v-if="outraPessoa" severity="warn" :closable="false">
          {{ t('hotel.checkout.foraDaLista') }}
        </Message>
      </section>

      <Message v-if="erro" severity="error" :closable="false">{{ t(erro) }}</Message>
    </div>

    <template #footer>
      <Button
        :label="t('hotel.comum.cancelar')"
        severity="secondary"
        text
        @click="emit('fechar')"
      />
      <Button
        :label="t('hotel.checkout.confirmar')"
        icon="pi pi-sign-out"
        :loading="salvando"
        :disabled="!podeFechar"
        @click="emit('confirmar', retiradoPor.trim())"
      />
    </template>
  </Dialog>
</template>

<style scoped>
.saida {
  display: grid;
  gap: var(--clinic-space-4);
}

.bloco {
  display: grid;
  gap: var(--clinic-space-3);
  padding-top: var(--clinic-space-3);
  border-top: 1px solid var(--clinic-line-soft);
}

.bloco:first-of-type {
  padding-top: 0;
  border-top: none;
}

.bloco__titulo {
  margin: 0;
  color: var(--clinic-text);
  font-size: 0.9375rem;
  font-weight: 650;
  letter-spacing: -0.01em;
}

.pertences {
  display: grid;
  gap: var(--clinic-space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}

.pertences li {
  display: grid;
  gap: 0.3rem;
  padding: var(--clinic-space-2);
  border: 1px solid var(--clinic-line-soft);
  border-radius: var(--clinic-radius-control);
  background: var(--clinic-surface-soft);
}

.pertences__linha {
  display: flex;
  align-items: center;
  gap: var(--clinic-space-2);
}

.pertences__linha label {
  flex: 1;
  font-size: var(--clinic-font-body);
}

.pesagem {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--clinic-space-3);
}

.pesagem__entrada {
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
}

.pesagem__aviso {
  margin: 0;
  color: var(--clinic-attention-text);
  font-size: var(--clinic-font-label);
  font-weight: 650;
}

.saida__tardia {
  display: flex;
  align-items: center;
  margin: 0;
  gap: var(--clinic-space-2);
  color: var(--clinic-attention-text);
  font-size: var(--clinic-font-label);
  font-weight: 700;
}

.saida__saldo {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin: 0;
  gap: var(--clinic-space-3);
}

.saida__saldo span {
  color: var(--clinic-faint);
  font-size: 0.75rem;
  font-weight: 600;
}

.saida__saldo strong {
  color: var(--clinic-accent-strong);
  font-size: 1.3rem;
  font-weight: 800;
}
.retirada {
  display: flex;
  align-items: center;
  gap: var(--clinic-space-2);
}

.retirada :deep(.p-select),
.retirada :deep(.p-inputtext) {
  flex: 1;
}

.entrada {
  display: flex;
  align-items: flex-start;
  margin: 0;
  gap: var(--clinic-space-2);
  color: var(--clinic-text);
  font-size: var(--clinic-font-label);
}

.entrada__lede {
  margin: 0.2rem 0 0;
  color: var(--clinic-faint);
  font-size: 0.7rem;
}
</style>
