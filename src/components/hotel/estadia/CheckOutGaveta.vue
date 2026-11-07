<script setup lang="ts">
/**
 * O check-out da reserva (E7-04b, guia e7 41): os dois animais saem juntos. Antes, cada pertence é
 * conferido (devolvido, ou não devolvido com o porquê) e cada animal é pesado (ou fica o motivo de
 * não pesar; uma variação acima de 30% pede confirmação mostrando os dois números). Depois, quem
 * retira: o responsável (mostrando o documento), alguém da lista da reserva, ou outra pessoa (com o
 * documento; fica marcada fora da lista). Só os 4 últimos caracteres do documento.
 *
 * O total pago é o acumulado e o saldo não trava a saída. A saída informada ("esqueci de dar
 * saída") é da gestão, até 72 h para trás. O servidor confere tudo e responde `SAIDA_BLOQUEADA`
 * com o que falta; nada é gravado. A estadia encerrada não muda mais.
 */
import Button from 'primevue/button'
import DatePicker from 'primevue/datepicker'
import InputMask from 'primevue/inputmask'
import InputNumber from 'primevue/inputnumber'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import SelectButton from 'primevue/selectbutton'
import Textarea from 'primevue/textarea'
import ToggleSwitch from 'primevue/toggleswitch'
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import CadastroGaveta from '@/components/cadastro/CadastroGaveta.vue'
import { lerErroDoCadastro } from '@/components/cadastro/erros-do-cadastro'
import { useRotulosDasReservas } from '@/components/hotel/reservas/useRotulosDasReservas'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { ApiError } from '@/service/api'
import { criarChaveadorDeIdempotencia } from '@/service/idempotencia'
import {
  conferirPertence,
  DOCUMENTOS_DE_RETIRADA,
  fazerCheckOut,
  lerEstadia,
  OBSERVACAO_DO_PERTENCE_MAX,
  OBSERVACAO_DO_PERTENCE_MIN,
  pesarNaSaida,
  PESO_MAX,
  PESO_MIN,
  SEM_PESO_MAX,
  SEM_PESO_MIN,
  type DocumentoDeRetirada,
  type Hospedagem,
  type Pertence,
} from '@/service/parceiro/hotel-estadia-service'
import type { ReservaDetalhe } from '@/service/parceiro/hotel-reservas-service'
import { instanteComOffset } from '@/service/parceiro/internacao-service'

const props = defineProps<{ reserva: ReservaDetalhe }>()
const aberta = defineModel<boolean>('visible', { default: false })
const emit = defineEmits<{ feito: [recado: string] }>()

const { t } = useI18n()
const rotulos = useRotulosDasReservas()
const { store, parceiroQuery } = useParceiroPortal()
const chaveador = criarChaveadorDeIdempotencia()

const veDinheiro = computed(() => store.temPermissao('hotel.valores'))
const gestao = computed(() => store.temPermissao('estabelecimento.editar'))

const hospedagens = ref<Hospedagem[]>([])
const versao = ref(0)
const carregando = ref(false)
const erro = ref('')
const impedimentos = ref<string[]>([])
const salvando = ref(false)
const mexendo = ref<string | null>(null)

/* O que se digita por animal: a observação do pertence não devolvido e o peso. */
const naoDevolvido = reactive<Record<string, string>>({})
const peso = reactive<Record<string, number | null>>({})
const semPeso = reactive<Record<string, boolean>>({})
const semPesoMotivo = reactive<Record<string, string>>({})
const pesoFora = reactive<Record<string, string>>({})
const erroDoAnimal = reactive<Record<string, string>>({})

const forma = ref<'RESPONSAVEL' | 'AUTORIZADO' | 'OUTRA'>('RESPONSAVEL')
const autorizadoId = ref<string | null>(null)
const nome = ref('')
const documentoTipo = ref<DocumentoDeRetirada>('RG')
const documentoFinal = ref('')
const pago = ref<number | null>(null)
const informar = ref(false)
const saidaDia = ref<Date | null>(null)
const saidaHora = ref('')
const saidaMotivo = ref('')
const tentou = ref(false)

async function carregar() {
  carregando.value = true
  try {
    const estadia = await lerEstadia(props.reserva.id, parceiroQuery())
    hospedagens.value = estadia.hospedagens
    versao.value = estadia.versao
  } catch (err) {
    erro.value = lerErroDoCadastro(err, t('estadiaDoHotel.checkout.erro')).mensagem
  } finally {
    carregando.value = false
  }
}

watch(aberta, (agora) => {
  if (!agora) return
  erro.value = ''
  impedimentos.value = []
  tentou.value = false
  forma.value = 'RESPONSAVEL'
  autorizadoId.value = null
  nome.value = ''
  documentoTipo.value = 'RG'
  documentoFinal.value = ''
  pago.value =
    typeof props.reserva.pagoCentavos === 'number' ? props.reserva.pagoCentavos / 100 : null
  informar.value = false
  saidaDia.value = null
  saidaHora.value = ''
  saidaMotivo.value = ''
  chaveador.concluir()
  void carregar()
})

const abertas = computed(() => hospedagens.value.filter((h) => h.status === 'HOSPEDADO'))

function trocar(h: Hospedagem) {
  hospedagens.value = hospedagens.value.map((x) => (x.id === h.id ? h : x))
}

async function conferir(h: Hospedagem, p: Pertence, devolvido: boolean) {
  erroDoAnimal[h.id] = ''
  const observacao = (naoDevolvido[p.id] ?? '').trim()
  if (
    !devolvido &&
    (observacao.length < OBSERVACAO_DO_PERTENCE_MIN ||
      observacao.length > OBSERVACAO_DO_PERTENCE_MAX)
  ) {
    erroDoAnimal[h.id] = t('estadiaDoHotel.checkout.observacaoDoPertence', {
      min: OBSERVACAO_DO_PERTENCE_MIN,
    })
    return
  }
  mexendo.value = p.id
  try {
    trocar(
      await conferirPertence(
        h.id,
        p.id,
        devolvido ? { devolvido } : { devolvido, observacao },
        parceiroQuery(),
      ),
    )
  } catch (err) {
    erroDoAnimal[h.id] = lerErroDoCadastro(err, t('cadastro.erros.salvar')).mensagem
  } finally {
    mexendo.value = null
  }
}

async function pesar(h: Hospedagem, confirmarPesoFora = false) {
  erroDoAnimal[h.id] = ''
  pesoFora[h.id] = ''
  const motivo = (semPesoMotivo[h.id] ?? '').trim()
  const kg = peso[h.id]
  if (semPeso[h.id] && motivo.length < SEM_PESO_MIN) {
    erroDoAnimal[h.id] = t('estadiaDoHotel.checkout.semPesoMinimo', { min: SEM_PESO_MIN })
    return
  }
  if (!semPeso[h.id] && typeof kg !== 'number') return
  const corpo = semPeso[h.id]
    ? { semPesoMotivo: motivo }
    : { pesoKg: kg as number, ...(confirmarPesoFora ? { confirmarPesoFora: true } : {}) }
  mexendo.value = h.id
  try {
    trocar(await pesarNaSaida(h.id, corpo, parceiroQuery()))
  } catch (err) {
    const lido = lerErroDoCadastro(err, t('cadastro.erros.salvar'))
    if (lido.codigo === 'PESO_FORA_DO_ESPERADO' && err instanceof ApiError)
      pesoFora[h.id] = t('estadiaDoHotel.checkout.pesoFora', {
        entrada: rotulos.numero(Number(err.detalhes.pesoEntradaKg), 2),
        saida: rotulos.numero(Number(err.detalhes.pesoSaidaKg), 2),
      })
    else erroDoAnimal[h.id] = lido.mensagem
  } finally {
    mexendo.value = null
  }
}

const opcoesDeForma = computed(() => [
  { valor: 'RESPONSAVEL', rotulo: t('estadiaDoHotel.checkout.responsavel') },
  ...(props.reserva.autorizados?.length
    ? [{ valor: 'AUTORIZADO', rotulo: t('estadiaDoHotel.checkout.daLista') }]
    : []),
  { valor: 'OUTRA', rotulo: t('estadiaDoHotel.checkout.outraPessoa') },
])
const opcoesDeAutorizado = computed(() =>
  (props.reserva.autorizados ?? []).map((a) => ({
    valor: a.id,
    rotulo: [a.nome, a.relacao].filter(Boolean).join(' · '),
  })),
)
const opcoesDeDocumento = computed(() =>
  DOCUMENTOS_DE_RETIRADA.map((valor) => ({
    valor,
    rotulo: t(`estadiaDoHotel.documento.${valor}`),
  })),
)

const FINAL = /^[A-Za-z0-9]{4}$/
const retiradaValida = computed(() => {
  if (forma.value === 'AUTORIZADO') return Boolean(autorizadoId.value)
  if (forma.value === 'OUTRA' && !nome.value.trim()) return false
  return FINAL.test(documentoFinal.value.trim())
})
const HORA = /^([01]\d|2[0-3]):[0-5]\d$/
const saidaValida = computed(
  () =>
    !informar.value ||
    (Boolean(saidaDia.value) && HORA.test(saidaHora.value) && saidaMotivo.value.trim().length > 0),
)

async function sair() {
  tentou.value = true
  erro.value = ''
  impedimentos.value = []
  if (!retiradaValida.value || !saidaValida.value) return
  const retirada =
    forma.value === 'AUTORIZADO'
      ? { autorizadoId: autorizadoId.value! }
      : forma.value === 'OUTRA'
        ? {
            nome: nome.value.trim(),
            documentoTipo: documentoTipo.value,
            documentoFinal: documentoFinal.value.trim(),
          }
        : {
            peloResponsavel: true as const,
            documentoTipo: documentoTipo.value,
            documentoFinal: documentoFinal.value.trim(),
          }
  let em: string | null = null
  if (informar.value && saidaDia.value) {
    const [h, m] = saidaHora.value.split(':').map(Number)
    const d = new Date(saidaDia.value)
    d.setHours(h ?? 0, m ?? 0, 0, 0)
    em = instanteComOffset(d)
  }
  const novoPago = pago.value === null ? null : Math.round(pago.value * 100)
  const corpo = {
    versao: versao.value,
    retirada,
    ...(veDinheiro.value && novoPago !== null && novoPago !== props.reserva.pagoCentavos
      ? { pagoCentavos: novoPago }
      : {}),
    ...(em ? { saidaInformada: { em, motivo: saidaMotivo.value.trim() } } : {}),
  }
  salvando.value = true
  try {
    const feita = await fazerCheckOut(
      props.reserva.id,
      corpo,
      chaveador.para(corpo),
      parceiroQuery(),
    )
    chaveador.concluir()
    aberta.value = false
    const partes = [t('estadiaDoHotel.checkout.feito')]
    if (feita.encerramento?.noitesNaoUsadas)
      partes.push(
        t(
          'estadiaDoHotel.checkout.noitesNaoUsadas',
          { n: feita.encerramento.noitesNaoUsadas },
          feita.encerramento.noitesNaoUsadas,
        ),
      )
    if (feita.financeiro)
      partes.push(
        t('estadiaDoHotel.checkout.saldo', {
          total: rotulos.dinheiro(feita.financeiro.totalFinalCentavos),
          saldo: rotulos.dinheiro(feita.financeiro.saldoCentavos),
        }),
      )
    emit('feito', partes.join(' '))
  } catch (err) {
    const lido = lerErroDoCadastro(err, t('cadastro.erros.salvar'))
    erro.value = lido.mensagem
    if (
      lido.codigo === 'SAIDA_BLOQUEADA' &&
      err instanceof ApiError &&
      Array.isArray(err.detalhes.impedimentos)
    ) {
      impedimentos.value = (
        err.detalhes.impedimentos as { kind: string; hospedagemId: string }[]
      ).map(
        (i) =>
          `${hospedagens.value.find((h) => h.id === i.hospedagemId)?.pacienteNome ?? ''} · ${t(`estadiaDoHotel.checkout.impedimento.${i.kind}`)}`,
      )
    }
    if (lido.codigo === 'RESERVA_ALTERADA') void carregar()
  } finally {
    salvando.value = false
  }
}

const hoje = new Date()
const tresDiasAtras = new Date(Date.now() - 72 * 3600 * 1000)
</script>

<template>
  <CadastroGaveta
    v-model:visible="aberta"
    :titulo="t('estadiaDoHotel.checkout.titulo')"
    icone="ph ph-sign-out"
    largura="42rem"
  >
    <form id="check-out" class="eg" novalidate @submit.prevent="sair">
      <p v-if="carregando" class="eg__dica">{{ t('estadiaDoHotel.checkin.lendo') }}</p>

      <section v-for="h in abertas" :key="h.id" class="eg__grupo co__animal">
        <h3 class="eg__grupo-titulo">{{ h.pacienteNome }} · {{ h.acomodacaoNome }}</h3>

        <div v-if="h.pertences.length" class="co__pertences">
          <span class="eg__rotulo">{{ t('estadiaDoHotel.checkin.pertences') }}</span>
          <div v-for="p in h.pertences" :key="p.id" class="co__pertence">
            <span class="co__item">
              <strong>{{ p.quantidade }}× {{ p.descricao }}</strong>
              <small v-if="p.conferidoEm">{{
                p.devolvido
                  ? t('estadiaDoHotel.checkout.devolvido')
                  : t('estadiaDoHotel.checkout.naoDevolvido', { obs: p.observacao ?? '' })
              }}</small>
              <small v-else class="co__pendente">{{
                t('estadiaDoHotel.checkout.aConferir')
              }}</small>
            </span>
            <InputText
              v-model="naoDevolvido[p.id]"
              :placeholder="t('estadiaDoHotel.checkout.porQueNao')"
              :aria-label="t('estadiaDoHotel.checkout.porQueNao')"
              :disabled="salvando"
              class="co__obs"
            />
            <span class="co__acoes">
              <Button
                type="button"
                size="small"
                :severity="p.conferidoEm && p.devolvido ? undefined : 'secondary'"
                :outlined="!(p.conferidoEm && p.devolvido)"
                :label="t('estadiaDoHotel.checkout.devolvidoAcao')"
                :loading="mexendo === p.id"
                @click="conferir(h, p, true)"
              />
              <Button
                type="button"
                size="small"
                severity="secondary"
                outlined
                :label="t('estadiaDoHotel.checkout.naoDevolvidoAcao')"
                :disabled="mexendo !== null"
                @click="conferir(h, p, false)"
              />
            </span>
          </div>
        </div>

        <div class="eg__secao">
          <span class="eg__rotulo">{{
            t('estadiaDoHotel.checkout.pesoSaida', { entrada: rotulos.numero(h.pesoEntradaKg, 2) })
          }}</span>
          <p v-if="h.pesoSaidaKg !== null || h.semPesoMotivo" class="eg__dica">
            {{
              h.pesoSaidaKg !== null
                ? t('estadiaDoHotel.checkout.pesado', { kg: rotulos.numero(h.pesoSaidaKg, 2) })
                : t('estadiaDoHotel.checkout.semPesoRegistrado', { motivo: h.semPesoMotivo })
            }}
          </p>
          <label class="co__chave">
            <ToggleSwitch v-model="semPeso[h.id]" :disabled="salvando" />
            <span>{{ t('estadiaDoHotel.checkout.naoDaParaPesar') }}</span>
          </label>
          <div class="co__peso">
            <Textarea
              v-if="semPeso[h.id]"
              v-model="semPesoMotivo[h.id]"
              rows="2"
              auto-resize
              :maxlength="SEM_PESO_MAX"
              :aria-label="t('estadiaDoHotel.checkout.motivoSemPeso')"
              :disabled="salvando"
            />
            <InputNumber
              v-else
              v-model="peso[h.id]"
              :min="PESO_MIN"
              :max="PESO_MAX"
              :max-fraction-digits="2"
              suffix=" kg"
              :aria-label="t('estadiaDoHotel.checkout.pesoSaidaRotulo')"
              :disabled="salvando"
            />
            <Button
              type="button"
              size="small"
              severity="secondary"
              outlined
              :label="t('estadiaDoHotel.checkout.registrarPeso')"
              :loading="mexendo === h.id"
              @click="pesar(h)"
            />
          </div>
          <p v-if="pesoFora[h.id]" class="eg__aviso">
            <i class="ph ph-warning" aria-hidden="true" />
            <span>{{ pesoFora[h.id] }}</span>
            <Button
              type="button"
              size="small"
              severity="secondary"
              outlined
              :label="t('estadiaDoHotel.checkout.confirmarPeso')"
              @click="pesar(h, true)"
            />
          </p>
        </div>
        <p v-if="erroDoAnimal[h.id]" class="eg__erro" role="alert">
          <i class="ph ph-warning-circle" aria-hidden="true" />
          <span>{{ erroDoAnimal[h.id] }}</span>
        </p>
      </section>

      <section class="eg__grupo">
        <h3 class="eg__grupo-titulo">{{ t('estadiaDoHotel.checkout.quemRetira') }}</h3>
        <SelectButton
          v-model="forma"
          :options="opcoesDeForma"
          option-label="rotulo"
          option-value="valor"
          :allow-empty="false"
          :aria-label="t('estadiaDoHotel.checkout.quemRetira')"
          :disabled="salvando"
        />
        <Select
          v-if="forma === 'AUTORIZADO'"
          v-model="autorizadoId"
          :options="opcoesDeAutorizado"
          option-label="rotulo"
          option-value="valor"
          :aria-label="t('estadiaDoHotel.checkout.daLista')"
          :invalid="tentou && !autorizadoId"
          :disabled="salvando"
        />
        <template v-else>
          <div v-if="forma === 'OUTRA'" class="eg__secao">
            <label class="eg__rotulo" for="co-nome">{{ t('estadiaDoHotel.checkout.nome') }}</label>
            <InputText
              id="co-nome"
              v-model="nome"
              :invalid="tentou && !nome.trim()"
              :disabled="salvando"
            />
          </div>
          <div class="eg__linha">
            <div class="eg__secao">
              <label class="eg__rotulo" for="co-doc">{{
                t('estadiaDoHotel.checkout.documento')
              }}</label>
              <Select
                v-model="documentoTipo"
                input-id="co-doc"
                :options="opcoesDeDocumento"
                option-label="rotulo"
                option-value="valor"
                :disabled="salvando"
              />
            </div>
            <div class="eg__secao">
              <label class="eg__rotulo" for="co-final">{{
                t('estadiaDoHotel.checkout.final')
              }}</label>
              <InputText
                id="co-final"
                v-model="documentoFinal"
                maxlength="4"
                :invalid="tentou && !FINAL.test(documentoFinal.trim())"
                :disabled="salvando"
              />
            </div>
          </div>
          <small class="eg__dica">{{ t('estadiaDoHotel.checkout.finalDica') }}</small>
        </template>
      </section>

      <section v-if="veDinheiro && reserva.orcamento" class="eg__secao">
        <label class="eg__rotulo" for="co-pago">{{
          t('reservasDoHotel.pagamento.totalPago')
        }}</label>
        <InputNumber
          v-model="pago"
          input-id="co-pago"
          mode="currency"
          currency="BRL"
          :locale="rotulos.intl()"
          :min="0"
          :disabled="salvando"
        />
        <small class="eg__dica">{{ t('estadiaDoHotel.checkout.pagoDica') }}</small>
      </section>

      <section v-if="gestao" class="eg__grupo">
        <label class="co__chave">
          <ToggleSwitch v-model="informar" :disabled="salvando" />
          <span>{{ t('estadiaDoHotel.checkout.informar') }}</span>
        </label>
        <template v-if="informar">
          <DatePicker
            v-model="saidaDia"
            inline
            :min-date="tresDiasAtras"
            :max-date="hoje"
            :aria-label="t('estadiaDoHotel.checkout.informar')"
            :invalid="tentou && !saidaDia"
            :disabled="salvando"
          />
          <div class="eg__linha">
            <div class="eg__secao">
              <label class="eg__rotulo" for="co-hora">{{
                t('estadiaDoHotel.checkout.hora')
              }}</label>
              <InputMask
                id="co-hora"
                v-model="saidaHora"
                mask="99:99"
                :invalid="tentou && !HORA.test(saidaHora)"
                :disabled="salvando"
              />
            </div>
          </div>
          <div class="eg__secao">
            <label class="eg__rotulo" for="co-motivo">{{
              t('estadiaDoHotel.checkout.motivo')
            }}</label>
            <InputText
              id="co-motivo"
              v-model="saidaMotivo"
              :invalid="tentou && !saidaMotivo.trim()"
              :disabled="salvando"
            />
          </div>
        </template>
      </section>

      <p v-if="erro" class="eg__erro" role="alert">
        <i class="ph ph-warning-circle" aria-hidden="true" />
        <span>{{ erro }}</span>
      </p>
      <ul v-if="impedimentos.length" class="co__impedimentos">
        <li v-for="i in impedimentos" :key="i">{{ i }}</li>
      </ul>
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
        form="check-out"
        icon="ph ph-sign-out"
        :label="t('estadiaDoHotel.checkout.confirmar')"
        :loading="salvando"
        :disabled="!abertas.length"
      />
    </template>
  </CadastroGaveta>
</template>

<style scoped>
.co__animal {
  padding-bottom: 14px;
  border-bottom: 1px solid var(--linha);
}

.co__pertences {
  display: grid;
  gap: 8px;
}

.co__pertence {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
}

.co__item {
  display: grid;
  gap: 2px;
  font-size: 14px;
}

.co__item small {
  color: var(--tinta-2);
  font-size: 12.5px;
}

.co__item .co__pendente {
  color: var(--atencao-tinta);
}

.co__acoes {
  display: inline-flex;
  gap: 6px;
}

.co__chave {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--tinta);
  font-size: 14px;
  cursor: pointer;
}

.co__peso {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
}

.co__impedimentos {
  margin: -10px 0 0;
  padding-inline-start: 22px;
  color: var(--tinta);
  font-size: 13.5px;
}
</style>
