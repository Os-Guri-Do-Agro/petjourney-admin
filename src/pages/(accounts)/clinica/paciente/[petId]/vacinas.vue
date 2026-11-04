<script setup lang="ts">
/**
 * Vacinas do paciente — a carteira da clínica e a do app.
 *
 * É a tela que prova a frase do requisito: **mesma entidade, dois lados**. À esquerda, o que a
 * clínica trabalha — o protocolo por espécie e idade, com onde o animal está nele, e o histórico
 * com quem aplicou e onde. À direita, a carteirinha que o responsável já usa no celular, montada
 * só com o que o contrato entrega. Aplicar à esquerda muda a direita na mesma hora; é esse o
 * momento que a demonstração inteira existe para mostrar, e ele cabe em cinco segundos.
 *
 * ## A forma (redesenho de 19/10/2026)
 *
 * Embaixo da capa do paciente, três blocos, na ordem da pergunta de quem abre a vista:
 *
 * 1. **Agora** — a resposta direta: o que está vencido ou pode ser aplicado hoje, em frase
 *    ("Antirrábica: atrasada há 16 dias", "Antirrábica: pode começar hoje"), cada um com o atalho
 *    para aplicar; e depois, a próxima dose do calendário. Sem nada pendente, "Vacinas em dia".
 * 2. **Protocolo** — uma linha por vacina, com o estado em selo com palavra (em dia, vence em,
 *    atrasada, série aberta) e a sequência de doses onde a série está aberta.
 * 3. **Histórico de aplicações** — a tabela: quando, vacina, lote, quem e onde.
 *
 * Uma ação principal só, cheia, à direita da capa: **Aplicar vacina**. Registrar a dose de outro
 * lugar é a segunda, contornada — é o que se faz uma vez por paciente, na primeira visita, com a
 * carteirinha do pet shop na mão. A carteirinha do app fica no título do protocolo, de texto: é o
 * mesmo protocolo, visto do celular.
 *
 * O atraso aparece nos dois lados com a mesma regra (a carência de três dias da API e do app), e o
 * protocolo diz isso em voz alta: quem liga para o responsável precisa saber que ele está vendo o
 * mesmo aviso.
 *
 * A carteirinha do celular mora numa gaveta sem máscara. Lado a lado, ela repetia o protocolo e o
 * histórico pela terceira vez na mesma tela. Aberta, a ficha continua à vista e a carteirinha muda
 * na hora em que alguém aplica — a demonstração continua cabendo em cinco segundos.
 */
import Button from 'primevue/button'
import Drawer from 'primevue/drawer'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRoute } from 'vue-router'

import UiPagina from '@/components/ui/UiPagina.vue'
import ClinicDataTable from '@/features/clinico/components/base/ClinicDataTable.vue'
import type { ColunaTabela } from '@/features/clinico/components/base/table-types'
import FichaCabeca from '@/features/clinico/components/pacientes/ficha/FichaCabeca.vue'
import '@/features/clinico/components/pacientes/ficha/ficha.css'
import AplicarVacinaDialog from '@/features/clinico/components/vacinas/AplicarVacinaDialog.vue'
import CarteirinhaNoApp from '@/features/clinico/components/vacinas/CarteirinhaNoApp.vue'
import PlanoVacinalLista from '@/features/clinico/components/vacinas/PlanoVacinalLista.vue'
import VacinaExternaDialog from '@/features/clinico/components/vacinas/VacinaExternaDialog.vue'
import { useClinicFormat } from '@/features/clinico/composables/useClinicFormat'
import { useRotulosDaVacina } from '@/features/clinico/composables/useRotulosDaVacina'
import {
  patientRepository,
  vacinaRepository,
  type CarteirinhaNoApp as Carteirinha,
} from '@/features/clinico/data/repositories'
import type { AplicacaoVacina, Pet, Tutor } from '@/features/clinico/data/types'
import { diffDays } from '@/features/clinico/domain/clinic-time'
import type { DoseNoPlano, PlanoVacinal } from '@/features/clinico/domain/protocolo-vacinal'
import { clinicClock, useClinicoStore } from '@/features/clinico/stores/clinico'

const { t } = useI18n()
const route = useRoute()
const clinico = useClinicoStore()
const formato = useClinicFormat()
const rotulos = useRotulosDaVacina()

const pet = ref<Pet | null>(null)
const tutor = ref<Tutor | null>(null)
const plano = ref<PlanoVacinal | null>(null)
const historico = ref<AplicacaoVacina[]>([])
const carteirinha = ref<Carteirinha | null>(null)
const carregando = ref(false)
const erro = ref('')

const aplicando = ref(false)
const registrandoExterna = ref(false)
const vacinaDaLinha = ref<string | null>(null)

const petId = computed(() => String(route.params.petId ?? ''))

/** A espécie tem protocolo? Réptil e roedor não têm vacina no catálogo da clínica. */
const temProtocolo = computed(
  () =>
    pet.value !== null &&
    vacinaRepository.catalogo().some((vacina) => vacina.especies.includes(pet.value!.especie)),
)

async function carregar() {
  carregando.value = true
  erro.value = ''

  try {
    await clinico.carregar()

    const dados = await patientRepository.obter(petId.value)

    pet.value = dados?.pet ?? null
    tutor.value = dados?.tutor ?? null
    await recarregarVacinas()
  } catch {
    erro.value = t('clinico.erros.prontuario')
  } finally {
    carregando.value = false
  }
}

/**
 * Os três lados de uma vez: protocolo, histórico e carteirinha.
 *
 * Recarregados juntos depois de cada registro, e não um de cada vez: a demonstração é justamente
 * ver os dois lados mudarem no mesmo instante. Um lado atualizado e o outro não, nem que por um
 * quarto de segundo, é o que a plateia lembraria.
 */
async function recarregarVacinas() {
  const [aplicacoes, noApp] = await Promise.all([
    vacinaRepository.doPaciente(petId.value),
    vacinaRepository.naCarteirinha(petId.value),
  ])

  plano.value = vacinaRepository.plano(petId.value)
  historico.value = aplicacoes
  carteirinha.value = noApp
}

onMounted(carregar)
watch(petId, carregar)

function abrirAplicar(vacinaId: string | null = null) {
  vacinaDaLinha.value = vacinaId
  aplicando.value = true
}

/** A gaveta da carteirinha do celular. Fechada por padrão: a ficha é a tela de todo dia. */
const appAberto = ref(false)

// ------------------------------------------------------------------ a frase de cima

const atrasadas = computed(() =>
  (plano.value?.vacinas ?? []).filter((item) => item.situacao === 'atrasada'),
)

const devidas = computed(() =>
  (plano.value?.vacinas ?? []).filter((item) => item.situacao === 'devida'),
)

/**
 * O estado das vacinas numa frase, no lugar do resumo da Visão geral.
 *
 * Na ordem do que pede ação: o atraso (nomeando a vacina quando é uma só), a dose de hoje, a
 * próxima dose que já cabe, e só então "em dia". A frase não pinta de vermelho: a urgência mora no
 * bloco do ícone da linha do protocolo, logo abaixo.
 */
const frase = computed(() => {
  if (!pet.value) {
    return ''
  }

  if (!temProtocolo.value) {
    return t('clinico.ficha.vacinas.semProtocolo', { especie: formato.especie(pet.value.especie) })
  }

  const [primeiraAtrasada] = atrasadas.value

  if (atrasadas.value.length === 1 && primeiraAtrasada?.proxima) {
    const dias = Math.abs(diffDays(clinicClock.today(), primeiraAtrasada.proxima.em))

    return t('clinico.ficha.vacinas.atrasada', { vacina: primeiraAtrasada.vacina.nome, dias }, dias)
  }

  if (atrasadas.value.length > 1) {
    return t(
      'clinico.ficha.vacinas.atrasadas',
      { total: atrasadas.value.length },
      atrasadas.value.length,
    )
  }

  if (devidas.value.length === 1) {
    return t('clinico.ficha.vacinas.hoje', { vacina: devidas.value[0]!.vacina.nome })
  }

  if (devidas.value.length > 1) {
    return t(
      'clinico.ficha.vacinas.hojeVarias',
      { total: devidas.value.length },
      devidas.value.length,
    )
  }

  const proximas = (plano.value?.vacinas ?? [])
    .map((item) => item.proxima)
    .filter((dose) => dose !== null && (dose.dias ?? 0) >= 0)
    .sort((a, b) => a!.em.localeCompare(b!.em))
  const proxima = proximas[0]

  if (proxima) {
    const dias = diffDays(clinicClock.today(), proxima.em)

    return dias === 0
      ? t('clinico.ficha.vacinas.proximaHoje')
      : t('clinico.ficha.vacinas.proxima', { dias }, dias)
  }

  return t('clinico.ficha.vacinas.emDia')
})

// ------------------------------------------------------------------ agora

/** "Pode começar hoje" no meio da frase: "Antirrábica: pode começar hoje". */
function minuscula(texto: string): string {
  return texto ? texto.charAt(0).toLocaleLowerCase() + texto.slice(1) : texto
}

type ItemDoAgora = {
  vacinaId: string
  titulo: string
  meta: string
  obrigatoria: boolean
  marcada: string
  tom: 'risco' | 'atencao'
  icone: string
}

/** A dose, na data em que cabe: "Reforço anual · prevista para 03/10". */
function metaDaDose(dose: DoseNoPlano): string {
  return [
    rotulos.numero(dose),
    dose.estado === 'atrasada' || dose.estado === 'devida'
      ? t('clinico.ficha.vacinas.agora.eraPara', { data: rotulos.data(dose.em) })
      : '',
  ]
    .filter(Boolean)
    .join(' · ')
}

function marcadaDa(dose: DoseNoPlano): string {
  return dose.agendamento
    ? t('clinico.vacinas.plano.marcadaPara', {
        data: rotulos.data(dose.agendamento.inicio.slice(0, 10)),
        hora: formato.hora(dose.agendamento.inicio),
      })
    : ''
}

/**
 * O que pede ação hoje, na ordem do protocolo (atrasada, de hoje, a que pode começar): é a
 * resposta direta do alto da vista. Cada item leva o atalho que abre o diálogo na vacina dele.
 */
const pedeAcao = computed<ItemDoAgora[]>(() =>
  (plano.value?.vacinas ?? [])
    .filter((item) => ['atrasada', 'devida', 'nao-iniciada'].includes(item.situacao))
    .flatMap((item) => {
      const dose = item.proxima

      if (!dose) {
        return []
      }

      const prazo =
        item.situacao === 'devida' && diffDays(clinicClock.today(), dose.em) === 0
          ? rotulos.situacao('devida')
          : rotulos.quando(dose)

      return [
        {
          vacinaId: item.vacina.id,
          titulo: t('clinico.ficha.vacinas.agora.linha', {
            vacina: item.vacina.nome,
            prazo: minuscula(prazo),
          }),
          meta: metaDaDose(dose),
          obrigatoria: item.vacina.obrigatoria,
          marcada: marcadaDa(dose),
          tom: item.situacao === 'atrasada' ? ('risco' as const) : ('atencao' as const),
          icone: item.situacao === 'atrasada' ? 'ph ph-warning-circle' : 'ph ph-syringe',
        },
      ]
    }),
)

/** A próxima dose do calendário, fora o que já pede ação: o "depois" de quem aplica hoje. */
const proximaDoCalendario = computed(() => {
  const candidatas = (plano.value?.vacinas ?? [])
    .filter((item) => ['a-vencer', 'em-dia', 'aguarda-idade'].includes(item.situacao))
    .flatMap((item) => (item.proxima ? [{ item, dose: item.proxima }] : []))
    .sort((a, b) => a.dose.em.localeCompare(b.dose.em))
  const primeira = candidatas[0]

  if (!primeira) {
    return null
  }

  /* Longe, o prazo já é a data ("11/05/2027"): a linha de baixo não a repete. */
  const prazo = rotulos.quando(primeira.dose)
  const data = rotulos.data(primeira.dose.em)

  return {
    titulo: t(
      pedeAcao.value.length > 0
        ? 'clinico.ficha.vacinas.agora.depois'
        : 'clinico.ficha.vacinas.agora.proxima',
      { vacina: primeira.item.vacina.nome, prazo: minuscula(prazo) },
    ),
    meta: [rotulos.numero(primeira.dose), prazo === data ? '' : data].filter(Boolean).join(' · '),
    marcada: marcadaDa(primeira.dose),
  }
})

const tutorNome = computed(() => tutor.value?.nome ?? '')

// ------------------------------------------------------------------ histórico

const colunas = computed<ColunaTabela<AplicacaoVacina>[]>(() => [
  {
    id: 'quando',
    rotulo: t('clinico.paciente.atos.colunaQuando'),
    largura: '7.5rem',
    ordenarPor: (linha) => linha.aplicadaEm,
    ordemInicial: 'desc',
  },
  {
    id: 'vacina',
    rotulo: t('clinico.vacinas.colunaVacina'),
    largura: 'minmax(0, 1.3fr)',
  },
  {
    id: 'lote',
    rotulo: t('clinico.vacinas.lote'),
    largura: 'minmax(0, 1fr)',
    ocultarEmTelaEstreita: true,
  },
  {
    id: 'quem',
    rotulo: t('clinico.vacinas.carteira.quemEOnde'),
    largura: 'minmax(0, 1.3fr)',
  },
])

function nomeDaVacina(id: string): string {
  return vacinaRepository.catalogo().find((item) => item.id === id)?.nome ?? id
}

function numeroDaDose(aplicacao: AplicacaoVacina): string {
  return aplicacao.dosesNaSerie > 1
    ? t('clinico.vacinas.doseDeTotal', { dose: aplicacao.dose, total: aplicacao.dosesNaSerie })
    : t('clinico.vacinas.plano.doseUnica')
}
</script>

<template>
  <UiPagina
    class="tela-ficha"
    :titulo="pet?.nome ?? t('clinico.vacinas.titulo')"
    :carregando="carregando && !pet"
    :erro="erro"
    bloquear-se-suspenso
    @tentar-de-novo="carregar"
  >
    <template #voltar>
      <RouterLink to="/clinica/pacientes">
        <i class="ph ph-arrow-left" aria-hidden="true" />
        {{ t('clinico.pacientes.titulo') }}
      </RouterLink>
    </template>

    <template v-if="pet" #cabecalho>
      <FichaCabeca :pet="pet" :tutor="tutor" atual="vacinas" :frase="frase">
        <!-- Uma ação cheia: aplicar. A dose de fora vem antes, contornada. -->
        <template v-if="temProtocolo" #acoes>
          <Button
            type="button"
            icon="ph ph-map-pin"
            :label="t('clinico.vacinas.externa.abrir')"
            severity="secondary"
            outlined
            @click="registrandoExterna = true"
          />
          <Button
            type="button"
            icon="ph ph-syringe"
            :label="t('clinico.vacinas.aplicar.abrir')"
            @click="abrirAplicar()"
          />
        </template>
      </FichaCabeca>
    </template>

    <div v-if="pet" class="ficha-vacinas">
      <p v-if="!temProtocolo" class="ui-folha ui-vazio">
        <strong>{{ frase }}</strong>
        {{ t('clinico.vacinas.carteira.historicoVazio') }}
      </p>

      <template v-else-if="plano">
        <!--
          Agora: a resposta direta. O que está vencido ou cabe hoje, em frase, com o atalho de
          aplicar; e depois a próxima dose do calendário. É o que se lê antes de qualquer tabela.
        -->
        <section class="agora ui-folha" :aria-label="t('clinico.ficha.vacinas.agora.rotulo')">
          <ul class="agora__lista">
            <li
              v-for="item in pedeAcao"
              :key="item.vacinaId"
              class="agora__item ui-marca"
              :class="`ui-marca--${item.tom}`"
            >
              <span class="agora__icone" :class="`agora__icone--${item.tom}`" aria-hidden="true">
                <i :class="item.icone" />
              </span>
              <div class="agora__texto">
                <p class="agora__titulo">{{ item.titulo }}</p>
                <p class="agora__meta">
                  <span class="ui-num">{{ item.meta }}</span>
                  <span v-if="item.obrigatoria" class="ui-selo ui-selo--contorno agora__selo">
                    {{ t('clinico.vacinas.obrigatoria') }}
                  </span>
                </p>
                <p v-if="item.marcada" class="agora__marcada">
                  <i class="ph ph-calendar-check" aria-hidden="true" />
                  {{ item.marcada }}
                </p>
                <p v-if="item.tom === 'risco'" class="agora__app">
                  <i class="ph ph-device-mobile" aria-hidden="true" />
                  {{ t('clinico.vacinas.carteira.mesmoNoApp', { responsavel: tutorNome }) }}
                </p>
              </div>
              <Button
                type="button"
                icon="ph ph-syringe"
                :label="t('clinico.ficha.vacinas.agora.aplicar')"
                :aria-label="`${t('clinico.ficha.vacinas.agora.aplicar')}: ${item.titulo}`"
                severity="secondary"
                outlined
                class="agora__aplicar"
                @click="abrirAplicar(item.vacinaId)"
              />
            </li>

            <li v-if="pedeAcao.length === 0" class="agora__item ui-marca ui-marca--ok">
              <span class="agora__icone agora__icone--ok" aria-hidden="true">
                <i class="ph ph-check-circle" />
              </span>
              <div class="agora__texto">
                <p class="agora__titulo">{{ t('clinico.ficha.vacinas.emDia') }}</p>
                <p v-if="proximaDoCalendario" class="agora__meta">
                  {{ proximaDoCalendario.titulo }}
                </p>
              </div>
            </li>

            <li
              v-if="pedeAcao.length > 0 && proximaDoCalendario"
              class="agora__item agora__item--depois"
            >
              <span class="agora__icone" aria-hidden="true"><i class="ph ph-calendar-blank" /></span>
              <div class="agora__texto">
                <p class="agora__depois">{{ proximaDoCalendario.titulo }}</p>
                <p class="agora__meta ui-num">{{ proximaDoCalendario.meta }}</p>
                <p v-if="proximaDoCalendario.marcada" class="agora__marcada">
                  <i class="ph ph-calendar-check" aria-hidden="true" />
                  {{ proximaDoCalendario.marcada }}
                </p>
              </div>
            </li>
          </ul>
        </section>

        <section class="ficha-cartao ui-folha" :aria-labelledby="`${petId}-protocolo-titulo`">
          <header class="ficha-cartao__cabeca">
            <span class="ui-ladrilho" aria-hidden="true"><i class="ph ph-list-checks" /></span>
            <div class="ficha-cartao__titulos">
              <h2 :id="`${petId}-protocolo-titulo`" class="ficha-cartao__titulo">
                {{ t('clinico.vacinas.carteira.protocolo') }}
                <span class="ui-contagem">{{ plano.vacinas.length }}</span>
              </h2>
              <p class="ficha-cartao__descricao">
                {{
                  t(`clinico.vacinas.carteira.protocoloAjuda.${plano.faixa}`, {
                    especie: formato.especie(pet.especie),
                    idade: pet.nascimento
                      ? formato.idade(pet.nascimento)
                      : t('clinico.vacinas.carteira.semIdade'),
                  })
                }}
              </p>
            </div>
            <!-- O mesmo protocolo, como o responsável o vê: a carteirinha do app, numa gaveta. -->
            <div v-if="carteirinha" class="ficha-cartao__acoes">
              <Button
                type="button"
                icon="ph ph-device-mobile"
                :label="t('clinico.ficha.vacinas.carteirinha')"
                severity="secondary"
                outlined
                size="small"
                :aria-expanded="appAberto"
                aria-haspopup="dialog"
                @click="appAberto = !appAberto"
              />
            </div>
          </header>

          <div class="ficha-vacinas__plano">
            <PlanoVacinalLista :plano="plano" folha @aplicar="abrirAplicar" />
          </div>
        </section>

        <section class="ficha-cartao ui-folha" :aria-labelledby="`${petId}-aplicacoes-titulo`">
          <header class="ficha-cartao__cabeca">
            <span class="ui-ladrilho" aria-hidden="true">
              <i class="ph ph-clock-counter-clockwise" />
            </span>
            <div class="ficha-cartao__titulos">
              <h2 :id="`${petId}-aplicacoes-titulo`" class="ficha-cartao__titulo">
                {{ t('clinico.vacinas.carteira.historicoTitulo') }}
                <span class="ui-contagem">{{ historico.length }}</span>
              </h2>
              <p class="ficha-cartao__descricao">
                {{ t('clinico.vacinas.carteira.historicoAjuda') }}
              </p>
            </div>
          </header>

          <ClinicDataTable
            class="ficha-vacinas__tabela"
            :colunas="colunas"
            :linhas="historico"
            :chave="(linha) => linha.id"
            :carregando="carregando"
            :vazio-titulo="t('clinico.vacinas.carteira.historicoVazio')"
            :rotulo="t('clinico.vacinas.carteira.historicoTitulo')"
          >
            <template #celula-quando="{ linha }">
              <span class="celula__forte ui-num">
                {{ formato.dataCurta(clinicClock.dateOf(linha.aplicadaEm)) }}
              </span>
              <span class="celula__meta ui-num">{{ linha.aplicadaEm.slice(0, 4) }}</span>
            </template>

            <template #celula-vacina="{ linha }">
              <span class="celula__forte">{{ nomeDaVacina(linha.vacinaId) }}</span>
              <span class="celula__meta">
                {{ numeroDaDose(linha) }}
                <template v-if="linha.via"> · {{ rotulos.via(linha.via) }}</template>
              </span>
            </template>

            <!--
              Lote e validade juntos, e nunca só o lote: é o par que a farmacovigilância pede. A
              dose de fora não tem lote, e a célula diz isso em vez de ficar vazia.
            -->
            <template #celula-lote="{ linha }">
              <template v-if="linha.origem === 'externa'">
                <span class="celula__forte">{{ t('clinico.vacinas.externa.semLote') }}</span>
                <span class="celula__meta">
                  {{ t('clinico.vacinas.externa.naoAplicadaAqui') }}
                </span>
              </template>
              <template v-else>
                <span class="celula__forte ui-num">{{ linha.lote }}</span>
                <span v-if="linha.validadeLote" class="celula__meta ui-num">
                  {{ t('clinico.vacinas.validade', { data: rotulos.data(linha.validadeLote) }) }}
                </span>
              </template>
            </template>

            <!--
              Quem e onde, na mesma célula: na dose daqui, o nome de quem aplicou; na de fora, o
              lugar e a procedência — e quem daqui transcreveu, que é quem responde pela linha.
            -->
            <template #celula-quem="{ linha }">
              <template v-if="linha.externa">
                <span class="celula__forte celula__lugar">
                  <i class="ph ph-map-pin" aria-hidden="true" />
                  {{ linha.externa.local }}
                </span>
                <span
                  class="celula__meta"
                  :class="{ 'celula__meta--relato': linha.externa.procedencia === 'relato' }"
                >
                  {{
                    t(`clinico.vacinas.externa.procedenciaCurta.${linha.externa.procedencia}`, {
                      nome: clinico.profissional(linha.externa.registradaPor)?.nome ?? '',
                    })
                  }}
                </span>
              </template>
              <template v-else>
                <span class="celula__forte">
                  {{ clinico.profissional(linha.professionalId)?.nome }}
                </span>
                <span class="celula__meta">{{ t('clinico.vacinas.carteira.nestaClinica') }}</span>
              </template>
            </template>
          </ClinicDataTable>
        </section>
      </template>
    </div>

    <template #sempre>
      <template v-if="pet && plano && temProtocolo">
        <!-- A carteirinha do celular numa gaveta sem máscara: a ficha continua à vista e muda na hora. -->
        <Drawer
          v-model:visible="appAberto"
          position="right"
          :modal="false"
          class="gaveta-celular clinic-overlay"
          :style="{ width: 'min(26rem, 94vw)' }"
        >
          <template #header>
            <div class="gaveta__cabeca">
              <span class="gaveta__icone" aria-hidden="true">
                <i class="ph ph-device-mobile" />
              </span>
              <span class="gaveta__texto">
                <h2 class="gaveta__titulo">
                  {{ t('clinico.vacinas.carteira.noApp', { responsavel: tutorNome }) }}
                </h2>
                <span class="gaveta__meta">{{ t('clinico.vacinas.carteira.noAppAjuda') }}</span>
              </span>
            </div>
          </template>

          <div class="gaveta__corpo clinic-scope">
            <CarteirinhaNoApp v-if="carteirinha" :carteirinha="carteirinha" />
          </div>
        </Drawer>

        <AplicarVacinaDialog
          v-model:visivel="aplicando"
          :pet="pet"
          :plano="plano"
          :vacina-inicial="vacinaDaLinha"
          ficha
          @aplicada="recarregarVacinas"
        />

        <VacinaExternaDialog
          v-model:visivel="registrandoExterna"
          :pet="pet"
          :plano="plano"
          ficha
          @registrada="recarregarVacinas"
        />
      </template>
    </template>
  </UiPagina>
</template>

<style scoped>
.ficha-vacinas {
  display: grid;
  gap: 24px;
}

/* ------------------------------------------------------------------ agora */

.agora__lista {
  display: grid;
  margin: 0;
  padding: 0;
  list-style: none;
}

.agora__lista > li + li {
  border-top: 1px solid var(--linha-suave);
}

.agora__item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 16px;
  min-height: 76px;
  padding: 16px 24px;
}

.agora__icone {
  display: grid;
  width: 44px;
  height: 44px;
  flex: none;
  align-self: flex-start;
  place-items: center;
  border-radius: 13px;
  background: var(--superficie-2);
  color: var(--tinta-2);
  font-size: 22px;
}

.agora__icone--risco {
  background: var(--risco);
  color: var(--superficie);
}

.agora__icone--atencao {
  background: var(--atencao-fundo);
  color: var(--atencao-tinta);
}

.agora__icone--ok {
  background: var(--ok-fundo);
  color: var(--ok-tinta);
}

.agora__texto {
  display: grid;
  flex: 1;
  min-width: 0;
  gap: 3px;
}

/* A frase-resposta, grande: é o que se lê de pé, com o animal na mesa. */
.agora__titulo {
  margin: 0;
  color: var(--tinta);
  font-size: 20px;
  font-weight: 600;
  letter-spacing: -0.015em;
  line-height: 1.25;
}

.agora__depois {
  margin: 0;
  color: var(--tinta);
  font-size: 15px;
  font-weight: 550;
}

.agora__meta,
.agora__app,
.agora__marcada {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  margin: 0;
  gap: 4px 8px;
  color: var(--tinta-2);
  font-size: 13.5px;
  line-height: 1.45;
}

.agora__marcada {
  color: var(--musgo);
  font-weight: 600;
}

/* O ícone fica ao lado da frase, e a frase quebra ao lado dele — não embaixo. */
.agora__app,
.agora__marcada {
  flex-wrap: nowrap;
  align-items: flex-start;
}

.agora__app > i,
.agora__marcada > i {
  flex: none;
  margin-top: 3px;
}

.agora__selo.ui-selo {
  height: 20px;
  padding-inline: 7px;
  font-size: 11.5px;
}

.agora__item--depois {
  min-height: 64px;
  background: color-mix(in oklab, var(--superficie-2) 55%, var(--superficie));
}

.agora__item--depois .agora__icone {
  width: 36px;
  height: 36px;
  margin-inline: 4px;
  border-radius: 11px;
  background: var(--superficie);
  font-size: 18px;
}

.agora__lista > li:last-child {
  border-bottom-left-radius: calc(var(--raio-cartao) - 1px);
  border-bottom-right-radius: calc(var(--raio-cartao) - 1px);
}

.agora__aplicar.p-button {
  flex: none;
  min-height: 38px;
  white-space: nowrap;
}

/* ------------------------------------------------------------------ protocolo e histórico */

.ficha-vacinas__plano {
  overflow: hidden;
  border-radius: 0 0 calc(var(--raio-cartao) - 1px) calc(var(--raio-cartao) - 1px);
}

/* Tabela larga rola dentro de si no estreito, nunca a página. */
.ficha-vacinas__tabela :deep(.tabela__grade) {
  width: min-content;
  min-width: 100%;
}

.celula__forte {
  display: flex;
  overflow: hidden;
  align-items: center;
  gap: 5px;
  color: var(--tinta);
  font-size: 14px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.celula__lugar i {
  flex: none;
  color: var(--tinta-3);
  font-size: 15px;
}

.celula__meta {
  display: block;
  color: var(--tinta-2);
  font-size: 13px;
}

.celula__meta--relato {
  color: var(--atencao-tinta);
  font-weight: 600;
}

/* ------------------------------------------------------------------ gaveta */

.gaveta__cabeca {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 12px;
}

.gaveta__icone {
  display: grid;
  width: 40px;
  height: 40px;
  flex: none;
  place-items: center;
  border-radius: 12px;
  background: var(--clinica-fundo);
  color: var(--clinica-tinta);
  font-size: 20px;
}

.gaveta__texto {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.gaveta__titulo {
  margin: 0;
  color: var(--tinta);
  font-size: 17px;
  font-weight: 600;
  letter-spacing: -0.01em;
  line-height: 1.25;
}

.gaveta__meta {
  color: var(--tinta-2);
  font-size: 13px;
  line-height: 1.4;
}

.gaveta__corpo {
  display: grid;
  gap: 14px;
}

@media (max-width: 760px) {
  .agora__item {
    flex-wrap: wrap;
    padding: 14px 16px;
  }

  .agora__texto {
    flex-basis: calc(100% - 60px);
  }

  .agora__titulo {
    font-size: 17px;
  }

  .agora__aplicar.p-button {
    margin-inline-start: 60px;
  }
}
</style>
