<script setup lang="ts">
/**
 * O check-in da reserva (E7-04a, guia e7 27): a admissão em cima (quem pode entrar, o que trava, a
 * carteirinha do app lida ou não, as alergias que o app conhece) e uma ficha por animal: peso e
 * inspeção, alimentação, remédios trazidos de casa (com receita ou o motivo de não ter), cuidados,
 * as seis autorizações (pré-marcadas pelo que foi vendido), o contato de emergência, o veterinário
 * do pet (uma clínica do PetJourney ou escrito à mão, nunca os dois), os pertences, a adaptação e
 * a observação interna.
 *
 * Os horários vão como "08:00, 18:00". O hotel não calcula dose: a dose é texto. Só reserva
 * confirmada, a partir do dia da entrada; o instante é do servidor. Aceita o duplo toque.
 */
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
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
import { criarChaveadorDeIdempotencia } from '@/service/idempotencia'
import {
  ADAPTACOES,
  AUTORIZACOES,
  fazerCheckIn,
  HORARIOS_MAX,
  ITENS_MAX,
  lerAdmissao,
  lerVeterinariosDoPet,
  MOTIVO_SEM_RECEITA_MAX,
  MOTIVO_SEM_RECEITA_MIN,
  PERTENCE_DESCRICAO_MAX,
  PERTENCES_MAX,
  PESO_MAX,
  PESO_MIN,
  PORCAO_MAX,
  QUANTIDADE_MAX,
  TEXTO_MAX,
  VIAS,
  type Adaptacao,
  type AdmissaoDaReserva,
  type AnimalDoCheckin,
  type Autorizacao,
  type VeterinariosDoPet,
  type Via,
} from '@/service/parceiro/hotel-estadia-service'
import type { ReservaDetalhe } from '@/service/parceiro/hotel-reservas-service'

const props = defineProps<{ reserva: ReservaDetalhe }>()
const aberta = defineModel<boolean>('visible', { default: false })
const emit = defineEmits<{ feito: [recado: string] }>()

const { t } = useI18n()
const rotulos = useRotulosDasReservas()
const { parceiroQuery } = useParceiroPortal()
const chaveador = criarChaveadorDeIdempotencia()

type Remedio = {
  descricao: string
  via: Via
  doseTexto: string
  horarios: string
  receita: string
  semReceita: boolean
  motivoSemReceita: string
}
type CuidadoNovo = { descricao: string; horarios: string; observacao: string }
type Ficha = {
  pacienteId: string
  nome: string
  peso: number | null
  inspecao: string
  racaoPropria: boolean
  marca: string
  porcao: number | null
  horariosDaRacao: string
  restricoes: string
  petiscos: string
  remedios: Remedio[]
  cuidados: CuidadoNovo[]
  autorizacoes: Record<Autorizacao, boolean>
  limiteVeterinario: number | null
  contatoNome: string
  contatoTelefone: string
  contatoRelacao: string
  veterinario: string | null
  vetNome: string
  vetTelefone: string
  vetClinica: string
  pertences: { descricao: string; quantidade: number | null }[]
  adaptacao: Adaptacao
  observacao: string
}

const ESCRITO = 'ESCRITO'
const admissao = ref<AdmissaoDaReserva | null>(null)
const veterinarios = reactive<Record<string, VeterinariosDoPet>>({})
const fichas = ref<Ficha[]>([])
const atual = ref<string | null>(null)
const carregando = ref(false)
const tentou = ref(false)
const salvando = ref(false)
const erro = ref('')

function fichaDe(pacienteId: string, nome: string, pre: Autorizacao[]): Ficha {
  return {
    pacienteId,
    nome,
    peso: null,
    inspecao: '',
    racaoPropria: true,
    marca: '',
    porcao: null,
    horariosDaRacao: '08:00, 18:00',
    restricoes: '',
    petiscos: '',
    remedios: [],
    cuidados: [],
    autorizacoes: Object.fromEntries(AUTORIZACOES.map((a) => [a, pre.includes(a)])) as Record<
      Autorizacao,
      boolean
    >,
    limiteVeterinario: null,
    contatoNome: props.reserva.responsavel?.nome ?? '',
    contatoTelefone: props.reserva.responsavel?.telefone ?? '',
    contatoRelacao: '',
    veterinario: null,
    vetNome: '',
    vetTelefone: '',
    vetClinica: '',
    pertences: [],
    adaptacao: 'EM_ADAPTACAO',
    observacao: '',
  }
}

watch(aberta, async (agora) => {
  if (!agora) return
  erro.value = ''
  tentou.value = false
  chaveador.concluir()
  carregando.value = true
  try {
    admissao.value = await lerAdmissao(props.reserva.id, parceiroQuery())
    const pre = admissao.value.autorizacoesPreMarcadas
    fichas.value = props.reserva.animais.map((a) => fichaDe(a.pacienteId, a.nome, pre))
    atual.value = fichas.value[0]?.pacienteId ?? null
    for (const a of props.reserva.animais) {
      lerVeterinariosDoPet(props.reserva.id, a.pacienteId, parceiroQuery())
        .then((v) => (veterinarios[a.pacienteId] = v))
        .catch(() => undefined)
    }
  } catch (err) {
    erro.value = lerErroDoCadastro(err, t('estadiaDoHotel.checkin.erroAdmissao')).mensagem
  } finally {
    carregando.value = false
  }
})

const ficha = computed(() => fichas.value.find((f) => f.pacienteId === atual.value) ?? null)
const animalDaAdmissao = computed(
  () => admissao.value?.animais.find((a) => a.pacienteId === atual.value) ?? null,
)
const opcoesDeAnimal = computed(() =>
  fichas.value.map((f) => ({ valor: f.pacienteId, rotulo: f.nome })),
)
const opcoesDeVia = computed(() =>
  VIAS.map((valor) => ({ valor, rotulo: t(`estadiaDoHotel.via.${valor}`) })),
)
const opcoesDeAdaptacao = computed(() =>
  ADAPTACOES.map((valor) => ({ valor, rotulo: t(`estadiaDoHotel.adaptacao.${valor}`) })),
)
const opcoesDeVeterinario = computed(() => [
  ...(veterinarios[atual.value ?? '']?.clinicas ?? []).map((c) => ({
    valor: c.id,
    rotulo: [c.nome, c.telefone].filter(Boolean).join(' · '),
  })),
  { valor: ESCRITO, rotulo: t('estadiaDoHotel.checkin.vetEscrito') },
])

const HORA = /^([01]\d|2[0-3]):[0-5]\d$/
function horarios(texto: string) {
  const lista = [
    ...new Set(
      texto
        .split(/[\s,;]+/)
        .map((h) => h.trim())
        .filter(Boolean),
    ),
  ]
  return lista.length && lista.length <= HORARIOS_MAX && lista.every((h) => HORA.test(h))
    ? lista
    : null
}

function problemas(f: Ficha) {
  const p: string[] = []
  if (f.peso === null) p.push('peso')
  if (f.porcao === null || !horarios(f.horariosDaRacao)) p.push('racao')
  if (!f.contatoNome.trim() || !f.contatoTelefone.trim()) p.push('contato')
  if (
    f.remedios.some(
      (r) =>
        !r.descricao.trim() ||
        !r.doseTexto.trim() ||
        !horarios(r.horarios) ||
        (r.semReceita
          ? r.motivoSemReceita.trim().length < MOTIVO_SEM_RECEITA_MIN
          : !r.receita.trim()),
    )
  )
    p.push('remedios')
  if (f.cuidados.some((c) => !c.descricao.trim() || !horarios(c.horarios))) p.push('cuidados')
  if (f.veterinario === ESCRITO && !f.vetNome.trim()) p.push('veterinario')
  if (f.pertences.some((x) => !x.descricao.trim() || !x.quantidade)) p.push('pertences')
  return p
}

function corpoDe(f: Ficha): AnimalDoCheckin {
  return {
    pacienteId: f.pacienteId,
    pesoKg: f.peso!,
    ...(f.inspecao.trim() ? { inspecaoDeEntrada: f.inspecao.trim() } : {}),
    ...(f.pertences.length
      ? {
          pertences: f.pertences.map((x) => ({
            descricao: x.descricao.trim(),
            quantidade: x.quantidade!,
          })),
        }
      : {}),
    planoAlimentar: {
      racaoPropria: f.racaoPropria,
      ...(f.marca.trim() ? { marca: f.marca.trim() } : {}),
      porcaoGramas: f.porcao!,
      horarios: horarios(f.horariosDaRacao)!,
      ...(f.restricoes.trim() ? { restricoes: f.restricoes.trim() } : {}),
      ...(f.petiscos.trim() ? { petiscos: f.petiscos.trim() } : {}),
    },
    ...(f.remedios.length
      ? {
          medicacoes: f.remedios.map((r) => ({
            descricao: r.descricao.trim(),
            via: r.via,
            doseTexto: r.doseTexto.trim(),
            horarios: horarios(r.horarios)!,
            ...(r.semReceita
              ? { semReceita: true, motivoSemReceita: r.motivoSemReceita.trim() }
              : { receita: r.receita.trim() }),
          })),
        }
      : {}),
    ...(f.cuidados.length
      ? {
          cuidados: f.cuidados.map((c) => ({
            descricao: c.descricao.trim(),
            horarios: horarios(c.horarios)!,
            ...(c.observacao.trim() ? { observacao: c.observacao.trim() } : {}),
          })),
        }
      : {}),
    autorizacoes: AUTORIZACOES.map((kind) => ({
      kind,
      concedida: f.autorizacoes[kind],
      ...(kind === 'ATENDIMENTO_VETERINARIO' && f.autorizacoes[kind] && f.limiteVeterinario !== null
        ? { limiteCentavos: Math.round(f.limiteVeterinario * 100) }
        : {}),
    })),
    contatoEmergencia: {
      nome: f.contatoNome.trim(),
      telefone: f.contatoTelefone.trim(),
      ...(f.contatoRelacao.trim() ? { relacao: f.contatoRelacao.trim() } : {}),
    },
    ...(f.veterinario && f.veterinario !== ESCRITO ? { veterinarioId: f.veterinario } : {}),
    ...(f.veterinario === ESCRITO
      ? {
          veterinarioTexto: {
            nome: f.vetNome.trim(),
            ...(f.vetTelefone.trim() ? { telefone: f.vetTelefone.trim() } : {}),
            ...(f.vetClinica.trim() ? { clinica: f.vetClinica.trim() } : {}),
          },
        }
      : {}),
    adaptacao: f.adaptacao,
    ...(f.observacao.trim() ? { observacao: f.observacao.trim() } : {}),
  }
}

async function confirmar() {
  tentou.value = true
  erro.value = ''
  const comProblema = fichas.value.find((f) => problemas(f).length)
  if (comProblema) {
    atual.value = comProblema.pacienteId
    erro.value = t('estadiaDoHotel.checkin.faltaAlgo', { nome: comProblema.nome })
    return
  }
  const corpo = { versao: props.reserva.versao, animais: fichas.value.map(corpoDe) }
  salvando.value = true
  try {
    await fazerCheckIn(props.reserva.id, corpo, chaveador.para(corpo), parceiroQuery())
    chaveador.concluir()
    aberta.value = false
    emit('feito', t('estadiaDoHotel.checkin.feito'))
  } catch (err) {
    erro.value = lerErroDoCadastro(err, t('cadastro.erros.salvar')).mensagem
  } finally {
    salvando.value = false
  }
}

const invalido = (campo: string) =>
  Boolean(tentou.value && ficha.value && problemas(ficha.value).includes(campo))
</script>

<template>
  <CadastroGaveta
    v-model:visible="aberta"
    :titulo="t('estadiaDoHotel.checkin.titulo')"
    icone="ph ph-sign-in"
    largura="44rem"
  >
    <form id="check-in" class="eg" novalidate @submit.prevent="confirmar">
      <p v-if="carregando" class="eg__dica">{{ t('estadiaDoHotel.checkin.lendo') }}</p>

      <template v-if="admissao">
        <p class="eg__aviso" :class="{ ci__ok: admissao.podeEntrar }">
          <i
            :class="admissao.podeEntrar ? 'ph ph-check-circle' : 'ph ph-warning'"
            aria-hidden="true"
          />
          <span>{{
            admissao.podeEntrar
              ? t('estadiaDoHotel.checkin.podeEntrar')
              : t('estadiaDoHotel.checkin.naoPodeEntrar')
          }}</span>
        </p>
        <ul v-if="admissao.impedimentos.length" class="ci__impedimentos">
          <li v-for="(imp, i) in admissao.impedimentos" :key="i">
            {{ fichas.find((f) => f.pacienteId === imp.pacienteId)?.nome }} ·
            {{ rotulos.exigencia(imp.kind) }} ·
            {{ t(`estadiaDoHotel.situacao.${imp.situacao}`) }}
          </li>
        </ul>

        <SelectButton
          v-if="opcoesDeAnimal.length > 1"
          v-model="atual"
          :options="opcoesDeAnimal"
          option-label="rotulo"
          option-value="valor"
          :allow-empty="false"
          :aria-label="t('estadiaDoHotel.checkin.animal')"
        />
      </template>

      <template v-if="ficha && animalDaAdmissao">
        <p class="eg__dica">
          {{ t(`estadiaDoHotel.leitura.${animalDaAdmissao.leituraDoApp}`) }}
          <template v-if="animalDaAdmissao.alergias.length">
            ·
            {{
              t('estadiaDoHotel.checkin.alergias', {
                lista: animalDaAdmissao.alergias.map((a) => a.gatilho).join(', '),
              })
            }}
          </template>
        </p>

        <section class="eg__grupo">
          <h3 class="eg__grupo-titulo">{{ t('estadiaDoHotel.checkin.chegada') }}</h3>
          <div class="eg__linha">
            <div class="eg__secao">
              <label class="eg__rotulo" for="ci-peso">{{ t('estadiaDoHotel.checkin.peso') }}</label>
              <InputNumber
                v-model="ficha.peso"
                input-id="ci-peso"
                :min="PESO_MIN"
                :max="PESO_MAX"
                :max-fraction-digits="2"
                suffix=" kg"
                :invalid="invalido('peso')"
                :disabled="salvando"
              />
            </div>
            <div class="eg__secao">
              <label class="eg__rotulo" for="ci-adaptacao">{{
                t('estadiaDoHotel.checkin.adaptacao')
              }}</label>
              <Select
                v-model="ficha.adaptacao"
                input-id="ci-adaptacao"
                :options="opcoesDeAdaptacao"
                option-label="rotulo"
                option-value="valor"
                :disabled="salvando"
              />
            </div>
          </div>
          <div class="eg__secao">
            <label class="eg__rotulo" for="ci-inspecao"
              >{{ t('estadiaDoHotel.checkin.inspecao') }}
              <span class="eg__opcional">{{ t('cadastro.opcional') }}</span></label
            >
            <Textarea
              id="ci-inspecao"
              v-model="ficha.inspecao"
              rows="2"
              auto-resize
              :maxlength="TEXTO_MAX"
              :disabled="salvando"
            />
          </div>
        </section>

        <section class="eg__grupo">
          <h3 class="eg__grupo-titulo">{{ t('estadiaDoHotel.checkin.alimentacao') }}</h3>
          <label class="ci__chave">
            <ToggleSwitch v-model="ficha.racaoPropria" :disabled="salvando" />
            <span>{{ t('estadiaDoHotel.checkin.racaoPropria') }}</span>
          </label>
          <div class="eg__linha">
            <div class="eg__secao">
              <label class="eg__rotulo" for="ci-marca"
                >{{ t('estadiaDoHotel.checkin.marca') }}
                <span class="eg__opcional">{{ t('cadastro.opcional') }}</span></label
              >
              <InputText id="ci-marca" v-model="ficha.marca" :disabled="salvando" />
            </div>
            <div class="eg__secao">
              <label class="eg__rotulo" for="ci-porcao">{{
                t('estadiaDoHotel.checkin.porcao')
              }}</label>
              <InputNumber
                v-model="ficha.porcao"
                input-id="ci-porcao"
                :min="1"
                :max="PORCAO_MAX"
                suffix=" g"
                :invalid="invalido('racao') && ficha.porcao === null"
                :disabled="salvando"
              />
            </div>
          </div>
          <div class="eg__secao">
            <label class="eg__rotulo" for="ci-horarios">{{
              t('estadiaDoHotel.checkin.horarios')
            }}</label>
            <InputText
              id="ci-horarios"
              v-model="ficha.horariosDaRacao"
              :invalid="invalido('racao') && !horarios(ficha.horariosDaRacao)"
              :disabled="salvando"
            />
            <small class="eg__dica">{{ t('estadiaDoHotel.checkin.horariosDica') }}</small>
          </div>
          <div class="eg__linha">
            <div class="eg__secao">
              <label class="eg__rotulo" for="ci-restricoes"
                >{{ t('estadiaDoHotel.checkin.restricoes') }}
                <span class="eg__opcional">{{ t('cadastro.opcional') }}</span></label
              >
              <InputText id="ci-restricoes" v-model="ficha.restricoes" :disabled="salvando" />
            </div>
            <div class="eg__secao">
              <label class="eg__rotulo" for="ci-petiscos"
                >{{ t('estadiaDoHotel.checkin.petiscos') }}
                <span class="eg__opcional">{{ t('cadastro.opcional') }}</span></label
              >
              <InputText id="ci-petiscos" v-model="ficha.petiscos" :disabled="salvando" />
            </div>
          </div>
        </section>

        <section class="eg__grupo">
          <h3 class="eg__grupo-titulo">{{ t('estadiaDoHotel.checkin.remedios') }}</h3>
          <div v-for="(r, i) in ficha.remedios" :key="i" class="ci__item">
            <div class="eg__linha">
              <div class="eg__secao">
                <label class="eg__rotulo" :for="`ci-rem-${i}`">{{
                  t('estadiaDoHotel.checkin.remedio')
                }}</label>
                <InputText
                  :id="`ci-rem-${i}`"
                  v-model="r.descricao"
                  :invalid="invalido('remedios') && !r.descricao.trim()"
                  :disabled="salvando"
                />
              </div>
              <div class="eg__secao">
                <label class="eg__rotulo" :for="`ci-via-${i}`">{{
                  t('estadiaDoHotel.checkin.via')
                }}</label>
                <Select
                  v-model="r.via"
                  :input-id="`ci-via-${i}`"
                  :options="opcoesDeVia"
                  option-label="rotulo"
                  option-value="valor"
                  :disabled="salvando"
                />
              </div>
            </div>
            <div class="eg__linha">
              <div class="eg__secao">
                <label class="eg__rotulo" :for="`ci-dose-${i}`">{{
                  t('estadiaDoHotel.checkin.dose')
                }}</label>
                <InputText
                  :id="`ci-dose-${i}`"
                  v-model="r.doseTexto"
                  :invalid="invalido('remedios') && !r.doseTexto.trim()"
                  :disabled="salvando"
                />
              </div>
              <div class="eg__secao">
                <label class="eg__rotulo" :for="`ci-remh-${i}`">{{
                  t('estadiaDoHotel.checkin.horarios')
                }}</label>
                <InputText
                  :id="`ci-remh-${i}`"
                  v-model="r.horarios"
                  :invalid="invalido('remedios') && !horarios(r.horarios)"
                  :disabled="salvando"
                />
              </div>
            </div>
            <label class="ci__chave">
              <Checkbox v-model="r.semReceita" binary :disabled="salvando" />
              <span>{{ t('estadiaDoHotel.checkin.semReceita') }}</span>
            </label>
            <div class="eg__secao">
              <label class="eg__rotulo" :for="`ci-rec-${i}`">{{
                r.semReceita
                  ? t('estadiaDoHotel.checkin.motivoSemReceita')
                  : t('estadiaDoHotel.checkin.receita')
              }}</label>
              <InputText
                v-if="!r.semReceita"
                :id="`ci-rec-${i}`"
                v-model="r.receita"
                :invalid="invalido('remedios') && !r.receita.trim()"
                :disabled="salvando"
              />
              <Textarea
                v-else
                :id="`ci-rec-${i}`"
                v-model="r.motivoSemReceita"
                rows="2"
                auto-resize
                :maxlength="MOTIVO_SEM_RECEITA_MAX"
                :invalid="
                  invalido('remedios') && r.motivoSemReceita.trim().length < MOTIVO_SEM_RECEITA_MIN
                "
                :disabled="salvando"
              />
            </div>
            <Button
              type="button"
              size="small"
              severity="secondary"
              outlined
              icon="ph ph-x"
              :label="t('estadiaDoHotel.checkin.tirar')"
              class="ci__tirar"
              @click="ficha.remedios.splice(i, 1)"
            />
          </div>
          <Button
            v-if="ficha.remedios.length < ITENS_MAX"
            type="button"
            size="small"
            severity="secondary"
            outlined
            icon="ph ph-plus"
            :label="t('estadiaDoHotel.checkin.acrescentarRemedio')"
            class="ci__mais"
            :disabled="salvando"
            @click="
              ficha.remedios.push({
                descricao: '',
                via: 'ORAL',
                doseTexto: '',
                horarios: '',
                receita: '',
                semReceita: false,
                motivoSemReceita: '',
              })
            "
          />
          <small class="eg__dica">{{ t('estadiaDoHotel.checkin.remediosDica') }}</small>
        </section>

        <section class="eg__grupo">
          <h3 class="eg__grupo-titulo">{{ t('estadiaDoHotel.checkin.cuidados') }}</h3>
          <div v-for="(c, i) in ficha.cuidados" :key="i" class="ci__item">
            <div class="eg__linha">
              <div class="eg__secao">
                <label class="eg__rotulo" :for="`ci-cui-${i}`">{{
                  t('estadiaDoHotel.checkin.cuidado')
                }}</label>
                <InputText
                  :id="`ci-cui-${i}`"
                  v-model="c.descricao"
                  :invalid="invalido('cuidados') && !c.descricao.trim()"
                  :disabled="salvando"
                />
              </div>
              <div class="eg__secao">
                <label class="eg__rotulo" :for="`ci-cuih-${i}`">{{
                  t('estadiaDoHotel.checkin.horarios')
                }}</label>
                <InputText
                  :id="`ci-cuih-${i}`"
                  v-model="c.horarios"
                  :invalid="invalido('cuidados') && !horarios(c.horarios)"
                  :disabled="salvando"
                />
              </div>
            </div>
            <Button
              type="button"
              size="small"
              severity="secondary"
              outlined
              icon="ph ph-x"
              :label="t('estadiaDoHotel.checkin.tirar')"
              class="ci__tirar"
              @click="ficha.cuidados.splice(i, 1)"
            />
          </div>
          <Button
            v-if="ficha.cuidados.length < ITENS_MAX"
            type="button"
            size="small"
            severity="secondary"
            outlined
            icon="ph ph-plus"
            :label="t('estadiaDoHotel.checkin.acrescentarCuidado')"
            class="ci__mais"
            :disabled="salvando"
            @click="ficha.cuidados.push({ descricao: '', horarios: '', observacao: '' })"
          />
        </section>

        <section class="eg__grupo">
          <h3 class="eg__grupo-titulo">{{ t('estadiaDoHotel.checkin.autorizacoes') }}</h3>
          <label v-for="a in AUTORIZACOES" :key="a" class="ci__chave">
            <ToggleSwitch v-model="ficha.autorizacoes[a]" :disabled="salvando" />
            <span>{{ t(`estadiaDoHotel.autorizacao.${a}`) }}</span>
          </label>
          <div v-if="ficha.autorizacoes.ATENDIMENTO_VETERINARIO" class="eg__secao">
            <label class="eg__rotulo" for="ci-limite"
              >{{ t('estadiaDoHotel.checkin.limiteVeterinario') }}
              <span class="eg__opcional">{{ t('cadastro.opcional') }}</span></label
            >
            <InputNumber
              v-model="ficha.limiteVeterinario"
              input-id="ci-limite"
              mode="currency"
              currency="BRL"
              :locale="rotulos.intl()"
              :min="0"
              :disabled="salvando"
            />
          </div>
        </section>

        <section class="eg__grupo">
          <h3 class="eg__grupo-titulo">{{ t('estadiaDoHotel.checkin.emergencia') }}</h3>
          <div class="eg__linha">
            <div class="eg__secao">
              <label class="eg__rotulo" for="ci-cnome">{{
                t('estadiaDoHotel.checkin.contatoNome')
              }}</label>
              <InputText
                id="ci-cnome"
                v-model="ficha.contatoNome"
                :invalid="invalido('contato') && !ficha.contatoNome.trim()"
                :disabled="salvando"
              />
            </div>
            <div class="eg__secao">
              <label class="eg__rotulo" for="ci-ctel">{{
                t('estadiaDoHotel.checkin.contatoTelefone')
              }}</label>
              <InputText
                id="ci-ctel"
                v-model="ficha.contatoTelefone"
                :invalid="invalido('contato') && !ficha.contatoTelefone.trim()"
                :disabled="salvando"
              />
            </div>
          </div>
          <div class="eg__secao">
            <label class="eg__rotulo" for="ci-crel"
              >{{ t('estadiaDoHotel.checkin.contatoRelacao') }}
              <span class="eg__opcional">{{ t('cadastro.opcional') }}</span></label
            >
            <InputText id="ci-crel" v-model="ficha.contatoRelacao" :disabled="salvando" />
          </div>
          <div class="eg__secao">
            <label class="eg__rotulo" for="ci-vet"
              >{{ t('estadiaDoHotel.checkin.veterinario') }}
              <span class="eg__opcional">{{ t('cadastro.opcional') }}</span></label
            >
            <Select
              v-model="ficha.veterinario"
              input-id="ci-vet"
              :options="opcoesDeVeterinario"
              option-label="rotulo"
              option-value="valor"
              show-clear
              :disabled="salvando"
            />
          </div>
          <div v-if="ficha.veterinario === ESCRITO" class="eg__linha">
            <div class="eg__secao">
              <label class="eg__rotulo" for="ci-vnome">{{
                t('estadiaDoHotel.checkin.vetNome')
              }}</label>
              <InputText
                id="ci-vnome"
                v-model="ficha.vetNome"
                :invalid="invalido('veterinario')"
                :disabled="salvando"
              />
            </div>
            <div class="eg__secao">
              <label class="eg__rotulo" for="ci-vtel">{{
                t('estadiaDoHotel.checkin.contatoTelefone')
              }}</label>
              <InputText id="ci-vtel" v-model="ficha.vetTelefone" :disabled="salvando" />
            </div>
            <div class="eg__secao">
              <label class="eg__rotulo" for="ci-vcli">{{
                t('estadiaDoHotel.checkin.vetClinica')
              }}</label>
              <InputText id="ci-vcli" v-model="ficha.vetClinica" :disabled="salvando" />
            </div>
          </div>
        </section>

        <section class="eg__grupo">
          <h3 class="eg__grupo-titulo">{{ t('estadiaDoHotel.checkin.pertences') }}</h3>
          <div v-for="(x, i) in ficha.pertences" :key="i" class="ci__pertence">
            <InputText
              v-model="x.descricao"
              :maxlength="PERTENCE_DESCRICAO_MAX"
              :aria-label="t('estadiaDoHotel.checkin.pertence')"
              :invalid="invalido('pertences') && !x.descricao.trim()"
              :disabled="salvando"
            />
            <InputNumber
              v-model="x.quantidade"
              :min="1"
              :max="QUANTIDADE_MAX"
              show-buttons
              :aria-label="t('estadiaDoHotel.checkin.quantidade')"
              :disabled="salvando"
            />
            <Button
              type="button"
              icon="ph ph-x"
              severity="secondary"
              outlined
              rounded
              size="small"
              :aria-label="t('estadiaDoHotel.checkin.tirar')"
              @click="ficha.pertences.splice(i, 1)"
            />
          </div>
          <Button
            v-if="ficha.pertences.length < PERTENCES_MAX"
            type="button"
            size="small"
            severity="secondary"
            outlined
            icon="ph ph-plus"
            :label="t('estadiaDoHotel.checkin.acrescentarPertence')"
            class="ci__mais"
            :disabled="salvando"
            @click="ficha.pertences.push({ descricao: '', quantidade: 1 })"
          />
        </section>

        <div class="eg__secao">
          <label class="eg__rotulo" for="ci-obs"
            >{{ t('estadiaDoHotel.checkin.observacao') }}
            <span class="eg__opcional">{{ t('cadastro.opcional') }}</span></label
          >
          <Textarea
            id="ci-obs"
            v-model="ficha.observacao"
            rows="2"
            auto-resize
            :maxlength="TEXTO_MAX"
            :disabled="salvando"
          />
        </div>
      </template>

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
        form="check-in"
        icon="ph ph-sign-in"
        :label="t('estadiaDoHotel.checkin.confirmar')"
        :loading="salvando"
        :disabled="!admissao"
      />
    </template>
  </CadastroGaveta>
</template>

<style scoped>
.ci__ok i {
  color: var(--ok-tinta);
}

.ci__impedimentos {
  margin: -10px 0 0;
  padding-inline-start: 22px;
  color: var(--tinta);
  font-size: 13.5px;
  line-height: 1.6;
}

.ci__chave {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--tinta);
  font-size: 14px;
  cursor: pointer;
}

.ci__item {
  display: grid;
  gap: 10px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--linha);
}

.ci__tirar,
.ci__mais {
  justify-self: start;
}

.ci__pertence {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 8rem auto;
  align-items: center;
  gap: 10px;
}
</style>
