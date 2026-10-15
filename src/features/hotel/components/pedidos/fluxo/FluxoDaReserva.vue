<script setup lang="ts">
/**
 * As etapas da reserva online do hotel, no celular do app e na página pública.
 *
 * Um componente só, com uma etapa por bloco: as etapas do hotel são curtas e dividem quase tudo
 * (as datas, a disponibilidade, a estimativa), e espalhá-las em doze arquivos esconderia o fluxo.
 * O acabamento é o mesmo do fluxo da clínica (`fluxo.css`): quem usa os dois no mesmo app não pode
 * sentir que trocou de produto.
 */
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import SelectButton from 'primevue/selectbutton'
import Textarea from 'primevue/textarea'
import { useToast } from 'primevue/usetoast'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import CalendarioDoPedido from '@/features/clinico/components/pedidos/CalendarioDoPedido.vue'
import FolhaDoDia from '@/features/clinico/components/pedidos/FolhaDoDia.vue'
import '@/features/clinico/components/pedidos/fluxo/fluxo.css'
import { DEFAULT_LOCALE, INTL_LOCALE, isLocale } from '@/i18n/locales'

import PetAvatar from '../../base/PetAvatar.vue'
import { useHotelFormat } from '../../../composables/useHotelFormat'
import { addDays } from '@/features/clinico/domain/clinic-time'
import { hojeIso } from '../../../data/store'
import type { PetPorte } from '../../../data/types'

import { useFluxoDaReserva, type EtapaDaReserva } from './fluxo-da-reserva'

const props = defineProps<{
  enderecoDoLink?: string
}>()

const { t, locale } = useI18n()
const fluxo = useFluxoDaReserva()
const formato = useHotelFormat()
const toast = useToast()

const etapa = computed<EtapaDaReserva>(() => fluxo.etapa.value)

const titulo = computed(() => {
  if (etapa.value === 'porte' && fluxo.petSemPorte.value) {
    return t('hotel.pedidos.app.etapa.porte', { nome: fluxo.petSemPorte.value.nome })
  }

  return t(`hotel.pedidos.app.etapa.${etapa.value}`)
})

/*
 * A estadia num calendário de período: o primeiro toque é a entrada, o segundo a saída, e as noites
 * aparecem pintadas entre os dois. Os dois campos de data soltos que existiam antes escondiam a
 * duração — a pessoa só via "3 diárias" depois de abrir e fechar dois calendários.
 */
const hoje = hojeIso()
const ultimoDia = computed(() => addDays(hoje, fluxo.hotel.value?.horizonteDias ?? 90))

function isoDa(data: Date) {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(
    data.getDate(),
  ).padStart(2, '0')}`
}

function dataDoIso(iso: string) {
  return new Date(`${iso}T12:00:00`)
}

/** O primeiro toque marca só a entrada; a estadia vale no segundo. */
const rascunhoDasDatas = ref<{ de: string; ate: string | null } | null>(null)

const estadia = computed({
  get: () =>
    rascunhoDasDatas.value ??
    (fluxo.pedido.entrada && fluxo.pedido.saida
      ? { de: isoDa(fluxo.pedido.entrada), ate: isoDa(fluxo.pedido.saida) }
      : null),
  set: (nova: { de: string; ate: string | null } | null) => {
    if (!nova || !nova.ate) {
      rascunhoDasDatas.value = nova

      return
    }

    rascunhoDasDatas.value = null
    fluxo.pedido.entrada = dataDoIso(nova.de)
    fluxo.pedido.saida = dataDoIso(nova.ate)
  },
})

const horas = Array.from({ length: 13 }, (_, indice) => `${String(8 + indice).padStart(2, '0')}:00`)

const PORTES: PetPorte[] = ['mini', 'pequeno', 'medio', 'grande', 'gigante']

const portes = computed(() =>
  PORTES.map((porte) => ({ valor: porte, rotulo: t(`hotel.porte.${porte}`) })),
)

const portesDoLink = computed(() =>
  PORTES.map((porte) => ({ valor: fluxo.PORTE_NO_FIO[porte], rotulo: t(`hotel.porte.${porte}`) })),
)

const especies = computed(() => [
  { valor: 'CANINA', rotulo: t('hotel.pedidos.app.cao') },
  { valor: 'FELINA', rotulo: t('hotel.pedidos.app.gato') },
])

const RECURSO: Record<string, string> = {
  CAMERA: 'camera',
  CLIMATIZACAO: 'climatizacao',
  AREA_EXTERNA: 'area-externa',
  PISO_AQUECIDO: 'piso-aquecido',
  JANELA: 'janela',
}

const SITUACAO: Record<string, string> = {
  OK: 'ok',
  VENCE_DURANTE: 'vence-durante',
  VENCIDO: 'vencido',
  AUSENTE: 'ausente',
}

const SERVICO: Record<string, string> = {
  BANHO: 'banho',
  TOSA: 'tosa',
  PASSEIO_EXTRA: 'passeio-extra',
}

const todosEsgotados = computed(
  () =>
    (fluxo.disponibilidade.value?.tipos.length ?? 0) > 0 &&
    fluxo.disponibilidade.value!.tipos.every((tipo) => tipo.livres === 0),
)

/** O que falta na carteira, por pet. O que está em dia não ocupa a tela. */
const pendenciasDeCarteira = computed(() =>
  (fluxo.disponibilidade.value?.exigencias ?? [])
    .map((item) => ({
      nome: fluxo.petsEscolhidos.value.find((pet) => pet.id === item.petId)?.nome ?? '',
      itens: item.itens.filter((exigencia) => exigencia.situacao !== 'OK'),
    }))
    .filter((item) => item.itens.length > 0),
)

const nomesDosPets = computed(() =>
  fluxo.canal === 'link'
    ? fluxo.pedido.visitante.petNome
    : new Intl.ListFormat(INTL_LOCALE[isLocale(locale.value) ? locale.value : DEFAULT_LOCALE], {
        type: 'conjunction',
      }).format(fluxo.petsEscolhidos.value.map((pet) => pet.nome)),
)

const acompanhar = computed(() =>
  fluxo.enviado.value && 'token' in fluxo.enviado.value && props.enderecoDoLink
    ? `${props.enderecoDoLink}?pedido=${fluxo.enviado.value.token}`
    : '',
)

async function copiar() {
  try {
    await navigator.clipboard.writeText(acompanhar.value)
    toast.add({ severity: 'success', summary: t('hotel.pedidos.link.copiado'), life: 2000 })
  } catch {
    /* Sem área de transferência: o endereço continua à vista. */
  }
}

function soDigitos(valor: string) {
  return valor.replace(/\D/g, '')
}

function iniciais(nome: string) {
  return nome.slice(0, 2).toUpperCase()
}

const sinal = computed(() =>
  fluxo.estimativa.value !== null && fluxo.hotel.value
    ? Math.round((fluxo.estimativa.value * fluxo.hotel.value.sinalPercentual) / 100)
    : null,
)

function trocarParaHotelEscolhe() {
  fluxo.pedido.aceitaMudarUmDia = true
  fluxo.voltar()
  fluxo.escolherModo('HOTEL_ESCOLHE')
}
</script>

<template>
  <div class="fx">
    <header v-if="etapa !== 'enviado'" class="fx-topo">
      <Button
        v-if="fluxo.podeVoltar.value"
        class="fx-topo__voltar"
        icon="ph ph-arrow-left"
        text
        rounded
        :aria-label="t('hotel.pedidos.app.voltar')"
        @click="fluxo.voltar()"
      />
      <h3 class="fx-topo__titulo">{{ titulo }}</h3>
    </header>

    <p
      v-if="fluxo.erro.value && fluxo.erro.value !== 'SEM_VAGA_NO_TIPO'"
      class="fx-linha fx-linha--risco"
      role="alert"
    >
      <i class="ph ph-warning-circle" aria-hidden="true" />
      {{ t(`hotel.pedidos.app.erro.${fluxo.erro.value}`) }}
    </p>

    <Transition name="fx-etapa" mode="out-in">
      <!-- ============================================================ início (app) -->
      <div v-if="etapa === 'inicio'" key="inicio" class="fx-etapa">
        <div class="fx-corpo">
          <header class="reserva__hotel">
            <span class="fx-opcao__icone" aria-hidden="true"><i class="ph ph-house-line" /></span>
            <span class="fx-opcao__texto">
              <strong>{{ fluxo.hotel.value?.hotel.nome }}</strong>
              <span v-if="fluxo.hotel.value">
                {{
                  t('hotel.pedidos.app.balcao', {
                    abre: fluxo.hotel.value.balcao.abre,
                    fecha: fluxo.hotel.value.balcao.fecha,
                  })
                }}
              </span>
            </span>
          </header>

          <p class="fx-rotulo">{{ t('hotel.pedidos.app.proximas') }}</p>
          <ul v-if="fluxo.estadias.value.length > 0" class="fx-lista">
            <li
              v-for="estadia in fluxo.estadias.value"
              :key="estadia.reservaId"
              class="reserva__item"
            >
              <span class="fx-opcao__texto">
                <strong>{{ estadia.petNomes.join(' · ') }} · {{ estadia.acomodacao }}</strong>
                <span>{{ formato.periodo(estadia.entrada, estadia.saida) }}</span>
              </span>
              <span
                class="fx-selo"
                :class="estadia.aguardaSinal ? 'fx-selo--atencao' : 'fx-selo--marca'"
              >
                {{
                  estadia.aguardaSinal
                    ? t('hotel.pedidos.app.faltaSinal', {
                        valor: formato.moeda(estadia.sinalCentavos),
                      })
                    : t('hotel.pedidos.app.confirmada')
                }}
              </span>
            </li>
          </ul>
          <p v-else class="fx-ajuda">{{ t('hotel.pedidos.app.nadaMarcado') }}</p>

          <template
            v-if="
              fluxo.pedidos.value.some(
                (item) => item.status === 'AGUARDANDO_HOTEL' || item.status === 'RECUSADO',
              )
            "
          >
            <p class="fx-rotulo">{{ t('hotel.pedidos.app.pedidos') }}</p>
            <ul class="fx-lista">
              <li
                v-for="item in fluxo.pedidos.value.filter(
                  (pedido) => pedido.status === 'AGUARDANDO_HOTEL' || pedido.status === 'RECUSADO',
                )"
                :key="item.id"
                class="reserva__item reserva__item--coluna"
              >
                <span class="fx-opcao__texto">
                  <strong>{{ item.pets.map((pet) => pet.nome).join(' · ') }}</strong>
                  <span>{{ formato.periodo(item.entrada, item.saida) }}</span>
                  <span v-if="item.status === 'AGUARDANDO_HOTEL'">
                    {{
                      t('hotel.pedidos.app.aguardando', {
                        quando: formato.quando(item.responderAte),
                      })
                    }}
                  </span>
                  <span v-else>{{ t('hotel.pedidos.app.recusado') }}</span>
                </span>
                <blockquote v-if="item.recusa" class="reserva__mensagem">
                  {{ item.recusa.mensagemDoHotel }}
                </blockquote>
                <div class="reserva__acoes">
                  <Button
                    v-if="item.podeCancelar"
                    size="small"
                    severity="secondary"
                    outlined
                    :label="t('hotel.pedidos.app.desistir')"
                    :loading="fluxo.carregando.value"
                    @click="fluxo.desistirDoPedido(item.id)"
                  />
                  <Button
                    v-if="item.status === 'RECUSADO'"
                    size="small"
                    severity="secondary"
                    outlined
                    icon="ph ph-calendar-plus"
                    :label="t('hotel.pedidos.app.pedirDeNovo')"
                    @click="fluxo.pedirDeNovo(item)"
                  />
                </div>
              </li>
            </ul>
          </template>
        </div>
        <div class="fx-rodape">
          <Button
            icon="ph ph-calendar-plus"
            :label="t('hotel.pedidos.app.pedirHospedagem')"
            :disabled="!fluxo.hotel.value"
            @click="fluxo.comecarPedido()"
          />
          <Button
            severity="secondary"
            outlined
            icon="ph ph-phone"
            :label="t('hotel.pedidos.app.paraHoje')"
            @click="fluxo.irPara('urgente')"
          />
        </div>
      </div>

      <!-- ============================================================ pets (app) -->
      <div v-else-if="etapa === 'pets'" key="pets" class="fx-etapa">
        <div class="fx-corpo">
          <p class="fx-ajuda">{{ t('hotel.pedidos.app.petsAjuda') }}</p>
          <ul class="fx-lista">
            <li v-for="pet in fluxo.petsDaConta.value" :key="pet.id">
              <label
                class="fx-opcao"
                :class="{ 'fx-opcao--escolhida': fluxo.pedido.petIds.includes(pet.id) }"
              >
                <Checkbox
                  :model-value="fluxo.pedido.petIds.includes(pet.id)"
                  binary
                  @update:model-value="fluxo.alternarPet(pet.id)"
                />
                <PetAvatar
                  :nome="pet.nome"
                  :iniciais="iniciais(pet.nome)"
                  :especie="pet.especie"
                  :foto-url="pet.fotoUrl ?? ''"
                  tamanho="sm"
                />
                <span class="fx-opcao__texto">
                  <strong>{{ pet.nome }}</strong>
                  <span v-if="pet.faltaPorte">
                    <span class="fx-selo fx-selo--atencao">{{
                      t('hotel.pedidos.app.faltaPorte')
                    }}</span>
                  </span>
                  <span v-else-if="pet.hospedadoAgora">{{
                    t('hotel.pedidos.app.hospedadoAgora')
                  }}</span>
                  <span v-else-if="pet.primeiraEstadia">
                    <span class="fx-selo fx-selo--novo">{{
                      t('hotel.pedidos.app.primeiraEstadia')
                    }}</span>
                  </span>
                  <span v-else-if="pet.porte">{{ t(`hotel.porte.${pet.porte}`) }}</span>
                </span>
              </label>
            </li>
          </ul>
          <p v-if="fluxo.naoDividem.value" class="fx-linha fx-linha--atencao">
            <i class="ph ph-warning-circle" aria-hidden="true" />
            {{ t('hotel.pedidos.app.naoDividem') }}
          </p>
          <p v-else-if="fluxo.pedido.petIds.length > 1" class="fx-linha fx-linha--suave">
            <i class="ph ph-users-three" aria-hidden="true" />
            {{ t('hotel.pedidos.app.juntos') }}
          </p>
        </div>
        <div class="fx-rodape">
          <Button
            :label="t('hotel.pedidos.app.continuar')"
            icon="ph ph-arrow-right"
            icon-pos="right"
            :disabled="fluxo.pedido.petIds.length === 0 || fluxo.naoDividem.value"
            @click="fluxo.confirmarPets()"
          />
        </div>
      </div>

      <!-- ============================================================ porte (app) -->
      <div v-else-if="etapa === 'porte' && fluxo.petSemPorte.value" key="porte" class="fx-etapa">
        <div class="fx-corpo">
          <p class="fx-ajuda">
            {{ t('hotel.pedidos.app.porteAjuda', { nome: fluxo.petSemPorte.value.nome }) }}
          </p>
          <ul class="fx-lista">
            <li v-for="porte in portes" :key="porte.valor">
              <Button
                class="fx-opcao"
                text
                :loading="fluxo.carregando.value"
                @click="fluxo.completarPorte(porte.valor)"
              >
                <span class="fx-opcao__texto">
                  <strong>{{ porte.rotulo }}</strong>
                  <span>{{ t(`hotel.pedidos.app.pesoDoPorte.${porte.valor}`) }}</span>
                </span>
                <i class="ph ph-caret-right fx-opcao__fim" aria-hidden="true" />
              </Button>
            </li>
          </ul>
          <p class="fx-linha fx-linha--suave">
            <i class="ph ph-floppy-disk" aria-hidden="true" />
            {{ t('hotel.pedidos.app.porteSalva', { nome: fluxo.petSemPorte.value.nome }) }}
          </p>
        </div>
      </div>

      <!-- ============================================================ pet (link) -->
      <div v-else-if="etapa === 'pet-do-link'" key="pet-do-link" class="fx-etapa">
        <div class="fx-corpo">
          <div class="fx-campo">
            <span id="link-especie">{{ t('hotel.pedidos.app.especie') }}</span>
            <SelectButton
              v-model="fluxo.pedido.visitante.especie"
              :options="especies"
              option-label="rotulo"
              option-value="valor"
              :allow-empty="false"
              aria-labelledby="link-especie"
            />
          </div>
          <div v-if="fluxo.pedido.visitante.especie === 'CANINA'" class="fx-campo">
            <span id="link-porte">{{ t('hotel.pedidos.app.porte') }}</span>
            <SelectButton
              v-model="fluxo.pedido.visitante.porte"
              :options="portesDoLink"
              option-label="rotulo"
              option-value="valor"
              :allow-empty="false"
              aria-labelledby="link-porte"
              class="reserva__trilho"
            />
          </div>
          <p class="fx-linha fx-linha--suave">
            <i class="ph ph-info" aria-hidden="true" />
            {{ t('hotel.pedidos.link.petAjuda') }}
          </p>
        </div>
        <div class="fx-rodape">
          <Button
            :label="t('hotel.pedidos.app.continuar')"
            icon="ph ph-arrow-right"
            icon-pos="right"
            @click="fluxo.confirmarPetDoLink()"
          />
        </div>
      </div>

      <!-- ============================================================ datas -->
      <div v-else-if="etapa === 'datas'" key="datas" class="fx-etapa">
        <div class="fx-corpo">
          <CalendarioDoPedido
            v-model:periodo="estadia"
            modo="periodo"
            :min="hoje"
            :max="ultimoDia"
            :rotulo="t('hotel.pedidos.app.estadia')"
          />

          <p v-if="rascunhoDasDatas" class="fx-linha fx-linha--suave" aria-live="polite">
            <i class="ph ph-hand-tap" aria-hidden="true" />
            {{ t('hotel.pedidos.app.toqueSaida') }}
          </p>

          <div v-else class="reserva__horas">
            <label class="fx-campo">
              <span>
                {{ t('hotel.pedidos.app.entrada') }}
                <strong v-if="fluxo.pedido.entrada"
                  >· {{ formato.data(isoDa(fluxo.pedido.entrada)) }}</strong
                >
              </span>
              <Select v-model="fluxo.pedido.horaEntrada" :options="horas" fluid />
            </label>
            <label class="fx-campo">
              <span>
                {{ t('hotel.pedidos.app.saida') }}
                <strong v-if="fluxo.pedido.saida"
                  >· {{ formato.data(isoDa(fluxo.pedido.saida)) }}</strong
                >
              </span>
              <Select v-model="fluxo.pedido.horaSaida" :options="horas" fluid />
            </label>
          </div>

          <template v-if="!rascunhoDasDatas">
            <p v-if="fluxo.datasValidas.value" class="fx-linha">
              <i class="ph ph-moon" aria-hidden="true" />
              {{ t('hotel.pedidos.diarias', { n: fluxo.diarias.value }, fluxo.diarias.value) }}
            </p>
            <p v-else class="fx-linha fx-linha--atencao">
              <i class="ph ph-warning-circle" aria-hidden="true" />
              {{ t('hotel.pedidos.app.datasInvalidas') }}
            </p>
          </template>

          <p v-if="fluxo.hotel.value" class="fx-linha fx-linha--suave">
            <i class="ph ph-clock" aria-hidden="true" />
            {{
              t('hotel.pedidos.app.regraSaida', {
                entrada: fluxo.hotel.value.horarioDeEntrada,
                saida: fluxo.hotel.value.horarioDeSaida,
              })
            }}
          </p>

          <!-- Antes da antecedência: não é pedido, é telefonema. Dito antes do botão. -->
          <p v-if="fluxo.urgente.value" class="fx-linha fx-linha--atencao reserva__urgente">
            <i class="ph ph-phone-call" aria-hidden="true" />
            {{
              t('hotel.pedidos.app.urgenteAviso', {
                horas: fluxo.hotel.value?.antecedenciaMinimaHoras ?? 0,
              })
            }}
          </p>
        </div>
        <div class="fx-rodape">
          <Button
            :label="
              fluxo.urgente.value
                ? t('hotel.pedidos.app.verContato')
                : t('hotel.pedidos.app.verVagas')
            "
            :icon="fluxo.urgente.value ? 'ph ph-phone' : 'ph ph-arrow-right'"
            :icon-pos="fluxo.urgente.value ? 'left' : 'right'"
            :disabled="!fluxo.datasValidas.value || rascunhoDasDatas !== null"
            :loading="fluxo.carregando.value"
            @click="fluxo.confirmarDatas()"
          />
        </div>
      </div>

      <!-- ============================================================ modo -->
      <div v-else-if="etapa === 'modo'" key="modo" class="fx-etapa">
        <div class="fx-corpo">
          <ul class="fx-lista">
            <li v-if="fluxo.hotel.value?.modos.includes('ACOMODACAO_ESCOLHIDA')">
              <Button class="fx-opcao" text @click="fluxo.escolherModo('ACOMODACAO_ESCOLHIDA')">
                <span class="fx-opcao__icone" aria-hidden="true"
                  ><i class="ph ph-squares-four"
                /></span>
                <span class="fx-opcao__texto">
                  <strong>{{ t('hotel.pedidos.app.modo.ACOMODACAO_ESCOLHIDA') }}</strong>
                  <span>{{ t('hotel.pedidos.app.modoAjuda.ACOMODACAO_ESCOLHIDA') }}</span>
                </span>
                <i class="ph ph-caret-right fx-opcao__fim" aria-hidden="true" />
              </Button>
            </li>
            <li v-if="fluxo.hotel.value?.modos.includes('HOTEL_ESCOLHE')">
              <Button class="fx-opcao" text @click="fluxo.escolherModo('HOTEL_ESCOLHE')">
                <span class="fx-opcao__icone" aria-hidden="true"><i class="ph ph-hand-tap" /></span>
                <span class="fx-opcao__texto">
                  <strong>{{ t('hotel.pedidos.app.modo.HOTEL_ESCOLHE') }}</strong>
                  <span>{{ t('hotel.pedidos.app.modoAjuda.HOTEL_ESCOLHE') }}</span>
                </span>
                <i class="ph ph-caret-right fx-opcao__fim" aria-hidden="true" />
              </Button>
            </li>
          </ul>
          <p class="fx-linha fx-linha--suave">
            <i class="ph ph-clock" aria-hidden="true" />
            {{
              t('hotel.pedidos.app.prazoDoHotel', {
                horas: fluxo.hotel.value?.prazoDeRespostaHoras ?? 0,
              })
            }}
          </p>
        </div>
      </div>

      <!-- ============================================================ acomodação -->
      <div v-else-if="etapa === 'acomodacao'" key="acomodacao" class="fx-etapa">
        <div class="fx-corpo">
          <p
            v-if="fluxo.tipoSumiu.value !== null"
            class="fx-linha fx-linha--atencao reserva__urgente"
            role="alert"
          >
            <i class="ph ph-user-switch" aria-hidden="true" />
            {{ t('hotel.pedidos.app.tipoSumiu', { tipo: fluxo.tipoSumiu.value }) }}
          </p>

          <p v-if="fluxo.entradaIso.value && fluxo.saidaIso.value" class="fx-linha fx-linha--suave">
            <i class="ph ph-calendar-blank" aria-hidden="true" />
            {{ formato.periodo(fluxo.entradaIso.value, fluxo.saidaIso.value) }}
          </p>

          <ul class="fx-lista">
            <li v-for="tipo in fluxo.disponibilidade.value?.tipos ?? []" :key="tipo.tipoId">
              <Button
                class="fx-opcao"
                :class="{ 'fx-opcao--apagada': tipo.livres === 0 }"
                text
                :disabled="tipo.livres === 0"
                @click="fluxo.escolherTipo(tipo.tipoId)"
              >
                <span class="fx-opcao__texto">
                  <strong>{{ tipo.nome }}</strong>
                  <span>
                    {{
                      tipo.livres === 0
                        ? t('hotel.pedidos.app.esgotado')
                        : t('hotel.pedidos.app.livres', { n: tipo.livres }, tipo.livres)
                    }}
                    ·
                    {{
                      t('hotel.pedidos.app.estimativaDe', {
                        valor: formato.moeda(tipo.estimativaCentavos),
                      })
                    }}
                  </span>
                  <span class="reserva__recursos">
                    {{
                      tipo.recursos
                        .map((recurso) => t(`hotel.recurso.${RECURSO[recurso]}`))
                        .join(' · ')
                    }}
                  </span>
                </span>
                <i
                  v-if="tipo.livres > 0"
                  class="ph ph-caret-right fx-opcao__fim"
                  aria-hidden="true"
                />
              </Button>
            </li>
          </ul>

          <p v-if="todosEsgotados" class="fx-ajuda">{{ t('hotel.pedidos.app.tudoEsgotado') }}</p>
        </div>
        <div v-if="fluxo.hotel.value?.modos.includes('HOTEL_ESCOLHE')" class="fx-rodape">
          <Button
            severity="secondary"
            outlined
            icon="ph ph-hand-tap"
            :label="t('hotel.pedidos.app.deixarHotelEscolher')"
            @click="trocarParaHotelEscolhe"
          />
        </div>
      </div>

      <!-- ============================================================ extras -->
      <div v-else-if="etapa === 'extras'" key="extras" class="fx-etapa">
        <div class="fx-corpo">
          <label v-if="fluxo.pedido.modo === 'HOTEL_ESCOLHE'" class="reserva__marca">
            <Checkbox v-model="fluxo.pedido.aceitaMudarUmDia" binary />
            <span>
              <strong>{{ t('hotel.pedidos.app.aceitaMudar') }}</strong>
              <span>{{ t('hotel.pedidos.app.aceitaMudarAjuda') }}</span>
            </span>
          </label>

          <p class="fx-rotulo">{{ t('hotel.pedidos.app.extras') }}</p>
          <ul class="fx-lista">
            <li v-for="item in fluxo.hotel.value?.servicos ?? []" :key="item.servico">
              <label class="fx-opcao">
                <Checkbox v-model="fluxo.pedido.servicos" :value="item.servico" />
                <span class="fx-opcao__texto">
                  <strong>{{ t(`hotel.servico.${SERVICO[item.servico]}`) }}</strong>
                  <span>
                    {{ formato.moeda(item.precoCentavos) }}
                    <template v-if="item.porDiaria">
                      {{ t('hotel.pedidos.app.porDiaria') }}</template
                    >
                  </span>
                </span>
              </label>
            </li>
          </ul>

          <label class="fx-campo">
            <span>{{ t('hotel.pedidos.app.observacao') }}</span>
            <Textarea
              v-model="fluxo.pedido.observacao"
              rows="3"
              auto-resize
              fluid
              :maxlength="500"
            />
          </label>
        </div>
        <div class="fx-rodape">
          <Button
            :label="t('hotel.pedidos.app.continuar')"
            icon="ph ph-arrow-right"
            icon-pos="right"
            @click="fluxo.confirmarExtras()"
          />
        </div>
      </div>

      <!-- ============================================================ seus dados (link) -->
      <div v-else-if="etapa === 'seus-dados'" key="seus-dados" class="fx-etapa">
        <div class="fx-corpo">
          <p class="fx-ajuda">{{ t('hotel.pedidos.link.dadosAjuda') }}</p>
          <label class="fx-campo">
            <span>{{ t('hotel.pedidos.link.nome') }}</span>
            <InputText v-model="fluxo.pedido.visitante.nome" autocomplete="name" fluid />
          </label>
          <label class="fx-campo">
            <span>{{ t('hotel.pedidos.link.telefone') }}</span>
            <InputText
              v-model="fluxo.pedido.visitante.telefone"
              inputmode="tel"
              autocomplete="tel"
              placeholder="(11) 98765-4321"
              fluid
            />
          </label>
          <label class="fx-campo">
            <span>{{ t('hotel.pedidos.link.petNome') }}</span>
            <InputText v-model="fluxo.pedido.visitante.petNome" fluid />
          </label>
        </div>
        <div class="fx-rodape">
          <Button
            :label="t('hotel.pedidos.app.continuar')"
            icon="ph ph-arrow-right"
            icon-pos="right"
            :disabled="!fluxo.visitanteValido.value"
            @click="fluxo.confirmarDados()"
          />
        </div>
      </div>

      <!-- ============================================================ revisar -->
      <div v-else-if="etapa === 'revisar'" key="revisar" class="fx-etapa">
        <div class="fx-corpo">
          <!-- O bilhete: a folhinha das noites ao lado de onde e de quem — o resumo de relance. -->
          <section class="fx-bloco reserva__bilhete">
            <div v-if="fluxo.entradaIso.value && fluxo.saidaIso.value" class="reserva__topo">
              <FolhaDoDia
                tamanho="lg"
                :dia="fluxo.entradaIso.value.slice(0, 10)"
                :ate="fluxo.saidaIso.value.slice(0, 10)"
                :rodape="
                  t('hotel.pedidos.diarias', { n: fluxo.diarias.value }, fluxo.diarias.value)
                "
              />
              <div class="reserva__oque">
                <strong>
                  {{
                    fluxo.pedido.modo === 'ACOMODACAO_ESCOLHIDA'
                      ? fluxo.tipoEscolhido.value?.nome
                      : t('hotel.pedidos.app.modo.HOTEL_ESCOLHE')
                  }}
                </strong>
                <span>{{ nomesDosPets }}</span>
                <span class="reserva__periodo">
                  {{ formato.periodo(fluxo.entradaIso.value, fluxo.saidaIso.value) }}
                </span>
              </div>
            </div>
            <dl class="fx-resumo">
              <div v-if="fluxo.pedido.servicos.length > 0">
                <dt>{{ t('hotel.pedidos.app.resumo.extras') }}</dt>
                <dd>
                  {{
                    fluxo.pedido.servicos
                      .map((servico) => t(`hotel.servico.${SERVICO[servico]}`))
                      .join(' · ')
                  }}
                </dd>
              </div>
              <div v-if="fluxo.estimativa.value !== null">
                <dt>{{ t('hotel.pedidos.app.resumo.estimativa') }}</dt>
                <dd>
                  {{ formato.moeda(fluxo.estimativa.value) }}
                  <span v-if="sinal !== null" class="reserva__sinal">
                    {{
                      t('hotel.pedidos.app.sinal', {
                        percentual: fluxo.hotel.value?.sinalPercentual ?? 0,
                        valor: formato.moeda(sinal),
                      })
                    }}
                  </span>
                </dd>
              </div>
            </dl>
          </section>

          <!-- A carteira: o que falta aparece antes de enviar, não no balcão com a mala na mão. -->
          <section v-if="pendenciasDeCarteira.length > 0" class="fx-bloco">
            <p class="fx-rotulo">{{ t('hotel.pedidos.app.carteira') }}</p>
            <div v-for="item in pendenciasDeCarteira" :key="item.nome" class="reserva__carteira">
              <strong
                v-if="pendenciasDeCarteira.length > 1 || fluxo.petsEscolhidos.value.length > 1"
                >{{ item.nome }}</strong
              >
              <p
                v-for="exigencia in item.itens"
                :key="exigencia.exigencia"
                class="fx-linha"
                :class="exigencia.bloqueia ? 'fx-linha--atencao' : 'fx-linha--suave'"
              >
                <i
                  class="ph"
                  :class="exigencia.bloqueia ? 'ph-warning-circle' : 'ph-info'"
                  aria-hidden="true"
                />
                {{ t(`hotel.exigencia.${exigencia.exigencia}`) }} ·
                {{ t(`hotel.situacaoExigencia.${SITUACAO[exigencia.situacao]}`) }}
              </p>
            </div>
            <p class="fx-linha fx-linha--suave">
              <i class="ph ph-identification-card" aria-hidden="true" />
              {{ t('hotel.pedidos.app.carteiraAjuda') }}
            </p>
          </section>
          <p v-else-if="fluxo.canal === 'link'" class="fx-linha fx-linha--suave">
            <i class="ph ph-identification-card" aria-hidden="true" />
            {{ t('hotel.pedidos.link.carteira') }}
          </p>

          <ul class="reserva__regras">
            <li class="fx-linha fx-linha--suave">
              <i class="ph ph-clock" aria-hidden="true" />
              {{
                t('hotel.pedidos.app.prazoDoHotel', {
                  horas: fluxo.hotel.value?.prazoDeRespostaHoras ?? 0,
                })
              }}
            </li>
            <li class="fx-linha fx-linha--suave">
              <i class="ph ph-calendar-x" aria-hidden="true" />
              {{
                t('hotel.pedidos.app.regraCancelar', {
                  dias: fluxo.hotel.value?.cancelamentoSemCustoDias ?? 0,
                })
              }}
            </li>
            <li v-if="fluxo.canal === 'link'" class="fx-linha fx-linha--suave">
              <i class="ph ph-chat-circle-text" aria-hidden="true" />
              {{
                t('hotel.pedidos.link.confirmacaoPor', {
                  telefone: fluxo.pedido.visitante.telefone,
                })
              }}
            </li>
          </ul>
        </div>
        <div class="fx-rodape">
          <Button
            :label="t('hotel.pedidos.app.enviar')"
            icon="ph ph-paper-plane-tilt"
            :loading="fluxo.carregando.value"
            @click="fluxo.enviar()"
          />
        </div>
      </div>

      <!-- ============================================================ enviado -->
      <div v-else-if="etapa === 'enviado' && fluxo.enviado.value" key="enviado" class="fx-etapa">
        <div class="fx-corpo">
          <div class="reserva__selo" aria-hidden="true">
            <i
              class="ph"
              :class="
                fluxo.enviado.value.status === 'ACEITO'
                  ? 'ph-calendar-check'
                  : 'ph-paper-plane-tilt'
              "
            />
          </div>
          <h4 class="reserva__titulo">
            {{
              fluxo.enviado.value.status === 'ACEITO'
                ? t('hotel.pedidos.app.aceitoTitulo')
                : t('hotel.pedidos.app.enviadoTitulo')
            }}
          </h4>
          <ol class="reserva__passos">
            <li class="reserva__passo reserva__passo--feito">
              <i class="ph ph-check-circle" aria-hidden="true" />
              <span>
                <strong>{{ t('hotel.pedidos.app.passoPediu') }}</strong>
                <span>{{ formato.quando(fluxo.enviado.value.criadoEm) }}</span>
              </span>
            </li>
            <li
              class="reserva__passo"
              :class="{ 'reserva__passo--feito': fluxo.enviado.value.reserva !== null }"
            >
              <i
                class="ph"
                :class="fluxo.enviado.value.reserva ? 'ph-check-circle' : 'ph-circle-dashed'"
                aria-hidden="true"
              />
              <span v-if="fluxo.enviado.value.reserva">
                <strong>{{ fluxo.enviado.value.reserva.acomodacao }}</strong>
                <span>{{
                  formato.periodo(
                    fluxo.enviado.value.reserva.entrada,
                    fluxo.enviado.value.reserva.saida,
                  )
                }}</span>
              </span>
              <span v-else>
                <strong>
                  {{
                    fluxo.enviado.value.tipoPedido
                      ? t('hotel.pedidos.app.passoHotelConfirma', {
                          tipo: fluxo.enviado.value.tipoPedido.nome,
                        })
                      : t('hotel.pedidos.app.passoHotel')
                  }}
                </strong>
                <span>{{
                  t('hotel.pedidos.app.ate', {
                    quando: formato.quando(fluxo.enviado.value.responderAte),
                  })
                }}</span>
              </span>
            </li>
            <li class="reserva__passo">
              <i class="ph ph-currency-circle-dollar" aria-hidden="true" />
              <span>
                <strong>{{ t('hotel.pedidos.app.passoSinal') }}</strong>
                <span>{{ t('hotel.pedidos.app.passoSinalAjuda') }}</span>
              </span>
            </li>
          </ol>

          <section v-if="acompanhar" class="fx-bloco">
            <p class="fx-rotulo">{{ t('hotel.pedidos.link.acompanhe') }}</p>
            <div class="reserva__link">
              <InputText
                :model-value="acompanhar"
                readonly
                fluid
                :aria-label="t('hotel.pedidos.link.acompanhe')"
              />
              <Button
                severity="secondary"
                outlined
                icon="ph ph-copy"
                :aria-label="t('hotel.pedidos.link.copiar')"
                @click="copiar"
              />
            </div>
          </section>
        </div>
        <div class="fx-rodape">
          <Button
            severity="secondary"
            outlined
            :label="
              fluxo.canal === 'app'
                ? t('hotel.pedidos.app.verMinhas')
                : t('hotel.pedidos.link.outroPedido')
            "
            @click="fluxo.recomecar()"
          />
        </div>
      </div>

      <!-- ============================================================ urgente -->
      <div v-else-if="etapa === 'urgente' && fluxo.hotel.value" key="urgente" class="fx-etapa">
        <div class="fx-corpo">
          <p class="fx-ajuda">
            {{
              t('hotel.pedidos.app.urgenteAjuda', {
                horas: fluxo.hotel.value.antecedenciaMinimaHoras,
              })
            }}
          </p>
          <section class="fx-bloco">
            <p class="fx-rotulo">{{ t('hotel.pedidos.app.ligueParaHotel') }}</p>
            <strong class="reserva__numero"
              ><bdi dir="ltr">{{ fluxo.hotel.value.urgencia.telefone }}</bdi></strong
            >
            <Button
              as="a"
              :href="`tel:${soDigitos(fluxo.hotel.value.urgencia.telefone)}`"
              icon="ph ph-phone-call"
              :label="t('hotel.pedidos.app.ligarAgora')"
              class="reserva__acao"
            />
            <Button
              v-if="fluxo.hotel.value.urgencia.whatsapp"
              as="a"
              :href="`https://wa.me/55${soDigitos(fluxo.hotel.value.urgencia.whatsapp)}`"
              target="_blank"
              rel="noopener"
              severity="secondary"
              outlined
              icon="ph ph-whatsapp-logo"
              :label="t('hotel.pedidos.app.whatsapp')"
              class="reserva__acao"
            />
          </section>
          <section class="fx-bloco">
            <p class="fx-linha">
              <i class="ph ph-map-pin" aria-hidden="true" />
              <span>{{ fluxo.hotel.value.hotel.endereco }}</span>
            </p>
            <p class="fx-rotulo">{{ t('hotel.pedidos.app.mensagemDoHotel') }}</p>
            <p class="reserva__orientacao">{{ fluxo.hotel.value.urgencia.orientacao }}</p>
          </section>
        </div>
        <div class="fx-rodape">
          <Button
            severity="secondary"
            outlined
            :label="t('hotel.pedidos.app.outraData')"
            @click="fluxo.voltar()"
          />
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.reserva__hotel {
  display: flex;
  align-items: center;
  gap: 0.7rem;
}

.reserva__item {
  display: flex;
  align-items: center;
  padding: 0.7rem 0.8rem;
  gap: 0.6rem;
}

.reserva__item--coluna {
  display: grid;
}

.reserva__acoes {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.reserva__acoes:empty {
  display: none;
}

.reserva__mensagem {
  margin: 0;
  padding: 0.5rem 0.65rem;
  border-radius: 0.6rem;
  background: var(--hc-fundo);
  color: var(--hc-tinta-2);
  font-size: 0.8125rem;
  line-height: 1.45;
}

.reserva__trilho {
  display: flex;
  flex-wrap: wrap;
}

.reserva__bilhete {
  gap: 0.75rem;
}

.reserva__topo {
  display: flex;
  align-items: center;
  gap: 0.85rem;
}

.reserva__oque {
  display: grid;
  min-width: 0;
  gap: 0.15rem;
}

.reserva__oque strong {
  color: var(--hc-tinta);
  font-size: 1rem;
  line-height: 1.3;
}

.reserva__oque > span {
  color: var(--hc-tinta-2);
  font-size: 0.875rem;
}

.reserva__periodo {
  font-size: 0.8125rem !important;
  font-variant-numeric: tabular-nums;
}

.reserva__horas {
  display: grid;
  gap: 0.5rem;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
}

.reserva__horas strong {
  color: var(--hc-tinta);
}

.reserva__urgente {
  font-weight: 650;
}

.reserva__recursos {
  color: var(--hc-tinta-3) !important;
  font-size: 0.75rem !important;
}

.reserva__marca {
  display: flex;
  align-items: flex-start;
  gap: 0.6rem;
  cursor: pointer;
}

.reserva__marca > span {
  display: grid;
  gap: 0.1rem;
}

.reserva__marca > span > span {
  color: var(--hc-tinta-2);
  font-size: 0.8125rem;
  line-height: 1.4;
}

.reserva__sinal {
  display: block;
  color: var(--hc-tinta-2);
  font-size: 0.8125rem;
  font-weight: 500;
}

.reserva__carteira {
  display: grid;
  gap: 0.2rem;
}

.reserva__regras {
  display: grid;
  margin: 0;
  padding: 0;
  gap: 0.35rem;
  list-style: none;
}

.reserva__selo {
  display: grid;
  width: 3rem;
  height: 3rem;
  margin-top: 0.5rem;
  border-radius: 50%;
  background: var(--hc-marca-clara);
  color: var(--hc-marca-forte);
  font-size: 1.4rem;
  place-items: center;
}

.reserva__titulo {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 750;
}

.reserva__passos {
  display: grid;
  margin: 0;
  padding: 0;
  gap: 0.75rem;
  list-style: none;
}

.reserva__passo {
  display: flex;
  align-items: flex-start;
  gap: 0.6rem;
  color: var(--hc-tinta-2);
}

.reserva__passo > i {
  font-size: 1.1rem;
}

.reserva__passo > span {
  display: grid;
  gap: 0.05rem;
}

.reserva__passo strong {
  color: var(--hc-tinta);
}

.reserva__passo--feito > i {
  color: var(--hc-marca);
}

.reserva__link {
  display: flex;
  gap: 0.4rem;
}

.reserva__numero {
  font-size: 1.5rem;
  font-variant-numeric: tabular-nums;
  font-weight: 800;
}

.reserva__acao {
  min-height: 2.9rem;
  justify-content: center;
  text-decoration: none;
}

.reserva__orientacao {
  margin: 0;
  color: var(--hc-tinta-2);
  line-height: 1.5;
}

[dir='rtl'] .fx-topo__voltar :deep(.ph) {
  transform: scaleX(-1);
}
</style>
