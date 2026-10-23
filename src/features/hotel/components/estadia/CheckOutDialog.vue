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
import { computed, ref, useId, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import HotelSelo from '../base/HotelSelo.vue'
import { useHotelFormat } from '../../composables/useHotelFormat'
import { variacaoDePeso } from '../../domain/estadia'
import type { Hospedagem, Ocorrencia, PessoaAutorizada } from '../../data/types'
import { INTL_LOCALE, type Locale } from '@/i18n/locales'

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
  responsavelTelefone: string
  /** O documento do cadastro do responsável. Vazio quando a clínica não tem. */
  responsavelDocumento: string
  /** Quem mais pode retirar nesta estadia, com telefone e documento. Vazio significa "só ele". */
  autorizadosARetirar: PessoaAutorizada[]
  salvando: boolean
  erro: string
}>()

const emit = defineEmits<{
  fechar: []
  conferir: [payload: { pertenceId: string; devolvido: boolean; observacao: string }]
  pesar: [pesoKg: number]
  confirmar: [retiradoPor: string]
}>()

const { t, locale } = useI18n()
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
 * A lista vem da estadia; "outra pessoa" continua possível, porque a vida acontece — mas então o
 * nome é digitado, e fica gravado que não era ninguém da lista.
 *
 * A escolha é guardada pela **chave** da pessoa e não pelo nome: o que se grava é o nome, mas o
 * que a tela mostra embaixo — telefone e documento a conferir — é da pessoa escolhida, e dois
 * "Marcos" na mesma família não podem trocar de documento.
 */
const escolhida = ref('responsavel')
const nomeDeOutraPessoa = ref('')
const outraPessoa = ref(false)

const quemPodeRetirar = computed(() => [
  {
    chave: 'responsavel',
    nome: props.responsavelNome,
    rotulo: `${props.responsavelNome} · ${t('hotel.quemBusca.responsavel')}`,
    telefone: props.responsavelTelefone,
    documento: props.responsavelDocumento,
  },
  ...props.autorizadosARetirar.map((pessoa) => ({
    chave: pessoa.id,
    nome: pessoa.nome,
    rotulo: pessoa.relacao ? `${pessoa.nome} · ${pessoa.relacao}` : pessoa.nome,
    telefone: pessoa.telefone,
    documento: pessoa.documento,
  })),
])

const pessoaEscolhida = computed(
  () => quemPodeRetirar.value.find((item) => item.chave === escolhida.value) ?? null,
)

/** O nome que fica gravado na estadia. É texto, de propósito: é o que o balcão viu e conferiu. */
const retiradoPor = computed(() =>
  outraPessoa.value ? nomeDeOutraPessoa.value.trim() : (pessoaEscolhida.value?.nome ?? ''),
)

watch(
  () => props.aberto,
  (aberto) => {
    if (aberto) {
      peso.value = props.hospedagem?.pesoSaidaKg ?? null
      escolhida.value = 'responsavel'
      nomeDeOutraPessoa.value = ''
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
  nomeDeOutraPessoa.value = ''
  escolhida.value = 'responsavel'
}

function pesar() {
  if ((peso.value ?? 0) > 0) {
    emit('pesar', peso.value ?? 0)
  }
}

/** Pertences que já têm desfecho: devolvidos, ou com o que houve escrito. */
const conferidos = computed(
  () => (props.hospedagem?.pertences.length ?? 0) - pendentes.value.length,
)

const pesado = computed(() => props.hospedagem?.pesoSaidaKg !== null)

/**
 * O que ainda falta, numa frase só, no alto do diálogo: quem chega ao balcão com o responsável na
 * frente precisa saber de relance se já pode entregar — e, se não, o quê.
 */
const fraseDoQueFalta = computed(() => {
  const faltas: string[] = []

  if (props.ocorrenciasTravadas.length > 0) {
    faltas.push(t('hotel.checkout.nova.falta.ligar'))
  }

  if (!pesado.value) {
    faltas.push(t('hotel.checkout.nova.falta.pesar'))
  }

  if (pendentes.value.length > 0) {
    faltas.push(
      t('hotel.checkout.nova.falta.pertences', { total: pendentes.value.length }, pendentes.value.length),
    )
  }

  if (retiradoPor.value.trim() === '') {
    faltas.push(t('hotel.checkout.nova.falta.quem'))
  }

  if (faltas.length === 0) {
    return ''
  }

  const lista = new Intl.ListFormat(INTL_LOCALE[locale.value as Locale], {
    style: 'long',
    type: 'conjunction',
  }).format(faltas)

  return t('hotel.checkout.nova.falta.frase', { lista })
})
</script>

<template>
  <Dialog
    :visible="aberto"
    modal
    :header="t('hotel.checkout.titulo', { pet: petNome })"
    :style="{ width: 'min(46rem, 94vw)' }"
    class="clinic-scope pj-lugar--hotel"
    @update:visible="emit('fechar')"
  >
    <div v-if="hospedagem" class="saida">
      <!-- De relance: já pode entregar? Se não, o que falta. -->
      <p class="resumo" :class="podeFechar ? 'resumo--pronto' : 'resumo--falta'" aria-live="polite">
        <i :class="podeFechar ? 'ph ph-check-circle' : 'ph ph-list-checks'" aria-hidden="true" />
        {{ podeFechar ? t('hotel.checkout.nova.pronto', { pet: petNome }) : fraseDoQueFalta }}
      </p>

      <!--
        A ocorrência sem contato aparece primeiro e não é conferível aqui: resolvê-la exige pegar o
        telefone, não marcar uma caixa. O que o diálogo faz é dizer isso antes de alguém tentar
        fechar.
      -->
      <p v-if="ocorrenciasTravadas.length > 0" class="trava" role="alert">
        <i class="ph ph-phone-call" aria-hidden="true" />
        {{
          t(
            'hotel.checkout.ocorrenciaTravada',
            { total: ocorrenciasTravadas.length },
            ocorrenciasTravadas.length,
          )
        }}
      </p>

      <ol class="passos">
        <!-- 1. pesar -->
        <li class="passo" :class="{ 'passo--feito': pesado }">
          <span class="passo__marca" aria-hidden="true">
            <i v-if="pesado" class="ph ph-check" />
            <span v-else class="ui-num">1</span>
          </span>

          <div class="passo__corpo">
            <h3 class="passo__titulo">
              {{ t('hotel.checkout.pesagem') }}
              <span class="passo__meta">
                {{ t('hotel.checkout.pesoEntrada', { valor: formato.peso(hospedagem.pesoEntradaKg) }) }}
              </span>
            </h3>

            <div class="pesagem">
              <InputNumber
                :input-id="`${idCampo}-peso`"
                v-model="peso"
                :min="0"
                :max-fraction-digits="1"
                suffix=" kg"
                :placeholder="t('hotel.checkout.pesoSaida')"
                :aria-label="t('hotel.checkout.pesoSaida')"
              />
              <Button
                type="button"
                :label="t('hotel.checkout.registrarPeso')"
                icon="ph ph-scales"
                severity="secondary"
                outlined
                :disabled="!peso"
                @click="pesar"
              />

              <HotelSelo
                v-if="hospedagem.pesoSaidaKg !== null"
                :rotulo="formato.variacao(variacao)"
                :tom="perdaRelevante ? 'atencao' : 'positivo'"
                icone="ph ph-chart-line"
              />
            </div>

            <p v-if="perdaRelevante && hospedagem.pesoSaidaKg !== null" class="passo__aviso">
              <i class="ph ph-warning" aria-hidden="true" />
              {{ t('hotel.checkout.perdaRelevante') }}
            </p>
          </div>
        </li>

        <!-- 2. conferir os pertences -->
        <li class="passo" :class="{ 'passo--feito': pendentes.length === 0 }">
          <span class="passo__marca" aria-hidden="true">
            <i v-if="pendentes.length === 0" class="ph ph-check" />
            <span v-else class="ui-num">2</span>
          </span>

          <div class="passo__corpo">
            <h3 class="passo__titulo">
              {{ t('hotel.checkout.pertences') }}
              <span class="passo__meta ui-num">
                {{
                  t('hotel.estadia.nova.saida.conferidos', {
                    feitos: conferidos,
                    total: hospedagem.pertences.length,
                  })
                }}
              </span>
            </h3>

            <p v-if="hospedagem.pertences.length === 0" class="passo__vazio">
              {{ t('hotel.estadia.nova.saida.semPertences') }}
            </p>

            <ul v-else class="pertences">
              <li
                v-for="item in hospedagem.pertences"
                :key="item.id"
                :class="{ 'pertences__item--ok': item.devolvido }"
              >
                <div class="pertences__linha">
                  <Checkbox
                    :input-id="`${idCampo}-${item.id}`"
                    :model-value="item.devolvido"
                    binary
                    @update:model-value="alternar(item.id, Boolean($event))"
                  />
                  <label :for="`${idCampo}-${item.id}`">
                    {{ item.descricao }}
                    <span v-if="item.quantidade > 1" class="ui-num">× {{ item.quantidade }}</span>
                  </label>

                  <HotelSelo
                    v-if="item.devolvido"
                    :rotulo="t('hotel.checkout.devolvido')"
                    tom="positivo"
                    icone="ph ph-check"
                  />
                </div>

                <!--
                  O campo de observação só aparece para o que não foi devolvido: oferecê-lo em
                  toda linha convidaria a escrever onde não é preciso, e a conferência perderia o
                  sinal. Escrito o que houve, o item conta como conferido.
                -->
                <InputText
                  v-if="!item.devolvido"
                  v-model="observacoes[item.id]"
                  class="pertences__obs"
                  size="small"
                  fluid
                  :placeholder="t('hotel.checkout.oQueHouve')"
                  :aria-label="t('hotel.checkout.oQueHouve')"
                  @blur="anotar(item.id)"
                />
              </li>
            </ul>

            <!--
              O que foi visto na chegada volta aqui, ao lado do animal saindo: é exatamente a
              informação que decide "ele já chegou com isso" quando a reclamação chega por telefone.
            -->
            <div v-if="hospedagem.inspecaoDeEntrada" class="chegada">
              <p class="chegada__titulo">
                <i class="ph ph-eye" aria-hidden="true" />
                {{ t('hotel.checkout.comoChegou') }}
              </p>
              <p class="chegada__texto">{{ hospedagem.inspecaoDeEntrada }}</p>
              <p class="chegada__lede">{{ t('hotel.checkout.comoChegouLede') }}</p>
            </div>
          </div>
        </li>

        <!-- 3. receber o saldo -->
        <li class="passo" :class="{ 'passo--feito': saldoCentavos <= 0 }">
          <span class="passo__marca" aria-hidden="true">
            <i v-if="saldoCentavos <= 0" class="ph ph-check" />
            <span v-else class="ui-num">3</span>
          </span>

          <div class="passo__corpo">
            <h3 class="passo__titulo">{{ t('hotel.checkout.saldo') }}</h3>

            <p class="saldo">
              <strong class="ui-num">{{ formato.moeda(saldoCentavos) }}</strong>
              <span v-if="saldoCentavos <= 0">{{ t('hotel.estadia.nova.saida.quitado') }}</span>
              <span v-else>{{ t('hotel.estadia.nova.saida.saldoNoBalcao') }}</span>
            </p>

            <p v-if="acrescimoDeSaida > 0" class="passo__aviso">
              <i class="ph ph-clock" aria-hidden="true" />
              {{ t('hotel.checkout.saidaTardia', { percentual: acrescimoDeSaida }) }}
            </p>
          </div>
        </li>

        <!-- 4. quem leva -->
        <!-- Não fica "feito" sozinho: o responsável vem marcado, e conferir quem leva é o gesto. -->
        <li class="passo">
          <span class="passo__marca" aria-hidden="true">
            <span class="ui-num">4</span>
          </span>

          <div class="passo__corpo">
            <h3 class="passo__titulo">{{ t('hotel.checkout.quemRetira') }}</h3>

            <div class="retirada">
              <Select
                v-if="!outraPessoa"
                v-model="escolhida"
                :options="quemPodeRetirar"
                option-label="rotulo"
                option-value="chave"
                :aria-label="t('hotel.checkout.quemRetira')"
                :aria-describedby="pessoaEscolhida ? `${idCampo}-conferir` : undefined"
                fluid
              />

              <InputText
                v-else
                v-model="nomeDeOutraPessoa"
                :placeholder="t('hotel.checkout.outraPessoaDica')"
                :aria-label="t('hotel.checkout.quemRetira')"
                fluid
              />

              <Button
                type="button"
                :label="
                  outraPessoa ? t('hotel.checkout.voltarALista') : t('hotel.checkout.outraPessoa')
                "
                severity="secondary"
                text
                @click="alternarQuemRetira"
              />
            </div>

            <!--
              O que conferir, embaixo de quem foi escolhido: o documento é a diferença entre "disse
              que era a Clara" e "era a Clara". Sem documento no cadastro, pede um com foto.
            -->
            <p v-if="!outraPessoa && pessoaEscolhida" :id="`${idCampo}-conferir`" class="conferir">
              <i class="ph ph-identification-card" aria-hidden="true" />
              <span>
                <template v-if="pessoaEscolhida.telefone">
                  <span class="ui-num">{{ pessoaEscolhida.telefone }}</span> ·
                </template>
                <strong v-if="pessoaEscolhida.documento">
                  {{ t('hotel.checkout.confiraDocumento', { documento: pessoaEscolhida.documento }) }}
                </strong>
                <template v-else>{{ t('hotel.checkout.semDocumento') }}</template>
              </span>
            </p>

            <!-- Entregar a quem não está na lista é decisão de quem atende, e fica registrada. -->
            <p v-if="outraPessoa" class="passo__aviso">
              <i class="ph ph-warning" aria-hidden="true" />
              {{ t('hotel.checkout.foraDaLista') }}
            </p>
          </div>
        </li>
      </ol>

      <p v-if="erro" class="erro" role="alert">
        <i class="ph ph-warning-circle" aria-hidden="true" />
        {{ t(erro) }}
      </p>
    </div>

    <template #footer>
      <Button
        type="button"
        :label="t('hotel.comum.cancelar')"
        severity="secondary"
        text
        @click="emit('fechar')"
      />
      <Button
        type="button"
        :label="t('hotel.checkout.confirmar')"
        icon="ph ph-sign-out"
        :loading="salvando"
        :disabled="!podeFechar"
        @click="emit('confirmar', retiradoPor)"
      />
    </template>
  </Dialog>
</template>

<style scoped>
.saida {
  display: grid;
  gap: 16px;
}

.resumo {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0;
  padding: 12px 14px;
  border-radius: 12px;
  font-size: 14.5px;
  font-weight: 600;
  line-height: 1.4;
}

.resumo i {
  flex: none;
  font-size: 20px;
}

.resumo--pronto {
  background: var(--ok-fundo);
  color: var(--ok-tinta);
}

.resumo--falta {
  background: var(--superficie-2);
  color: var(--tinta);
}

.resumo--falta i {
  color: var(--hotel-tinta);
}

.trava {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0;
  padding: 12px 14px;
  border-radius: 12px;
  background: var(--risco-fundo);
  color: var(--risco-tinta);
  font-size: 14px;
  font-weight: 600;
}

.trava i {
  flex: none;
  font-size: 18px;
}

/* Os passos, numa coluna com o número à esquerda: a ordem é a do balcão. */
.passos {
  display: grid;
  margin: 0;
  padding: 0;
  list-style: none;
}

.passo {
  display: grid;
  gap: 14px;
  padding: 16px 0;
  grid-template-columns: 34px minmax(0, 1fr);
}

.passo + .passo {
  border-top: 1px solid var(--linha-suave);
}

/* O número do passo num ladrilho no tom da casa; feito, ele vira o visto verde. */
.passo__marca {
  display: grid;
  width: 32px;
  height: 32px;
  place-items: center;
  border-radius: 10px;
  background: var(--pj-lugar-fundo, var(--hotel-fundo));
  color: var(--pj-lugar-tinta, var(--hotel-tinta));
  font-size: 14px;
  font-weight: 650;
}

.passo--feito .passo__marca {
  border-color: transparent;
  background: var(--ok-fundo);
  color: var(--ok-tinta);
  font-size: 17px;
}

.passo__corpo {
  display: grid;
  min-width: 0;
  gap: 10px;
  padding-top: 4px;
}

.passo__titulo {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 2px 10px;
  margin: 0;
  color: var(--tinta);
  font-size: 15.5px;
  font-weight: 650;
}

.passo__meta {
  color: var(--tinta-2);
  font-size: 13px;
  font-weight: 500;
}

.passo__vazio {
  margin: 0;
  color: var(--tinta-2);
  font-size: 13.5px;
}

.passo__aviso {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 0;
  color: var(--atencao-tinta);
  font-size: 13.5px;
  font-weight: 600;
  line-height: 1.45;
}

.passo__aviso i {
  margin-top: 1px;
  font-size: 16px;
}

.pesagem {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}

.pesagem :deep(.p-inputnumber) {
  width: 9rem;
}

.pesagem :deep(.p-inputnumber input) {
  width: 100%;
}

.pertences {
  display: grid;
  margin: 0;
  padding: 0;
  overflow: hidden;
  border: 1px solid var(--linha);
  border-radius: 12px;
  list-style: none;
}

.pertences li {
  display: grid;
  gap: 8px;
  padding: 10px 12px;
}

.pertences li + li {
  border-top: 1px solid var(--linha);
}

.pertences__item--ok {
  background: color-mix(in oklab, var(--ok-fundo) 60%, transparent);
}

.pertences__linha {
  display: flex;
  min-height: 28px;
  align-items: center;
  gap: 10px;
}

.pertences__linha label {
  flex: 1;
  color: var(--tinta);
  cursor: pointer;
  font-size: 14px;
}

.pertences__obs {
  margin-inline-start: 30px;
  width: calc(100% - 30px);
}

.chegada {
  display: grid;
  gap: 4px;
  padding: 12px 14px;
  border-radius: 12px;
  background: var(--superficie-2);
}

.chegada__titulo {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0;
  color: var(--tinta);
  font-size: 13.5px;
  font-weight: 600;
}

.chegada__titulo i {
  color: var(--hotel-tinta);
  font-size: 16px;
}

.chegada__texto {
  margin: 0;
  color: var(--tinta);
  font-size: 14px;
  line-height: 1.45;
}

.chegada__lede {
  margin: 0;
  color: var(--tinta-2);
  font-size: 12.5px;
}

.saldo {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px 12px;
  margin: 0;
}

.saldo strong {
  color: var(--tinta);
  font-size: 26px;
  font-weight: 650;
  letter-spacing: -0.02em;
}

.saldo span {
  color: var(--tinta-2);
  font-size: 13.5px;
}

.retirada {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.retirada :deep(.p-select),
.retirada :deep(.p-inputtext) {
  min-width: 0;
  flex: 1 1 16rem;
}

.conferir {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 0;
  color: var(--tinta-2);
  font-size: 13.5px;
  line-height: 1.45;
}

.conferir i {
  margin-top: 1px;
  color: var(--tinta-2);
  font-size: 17px;
}

.conferir strong {
  color: var(--tinta);
  font-weight: 600;
}

.erro {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  padding: 10px 14px;
  border-radius: 12px;
  background: var(--risco-fundo);
  color: var(--risco-tinta);
  font-size: 14px;
  font-weight: 500;
}

.erro i {
  flex: none;
  font-size: 18px;
}
</style>
