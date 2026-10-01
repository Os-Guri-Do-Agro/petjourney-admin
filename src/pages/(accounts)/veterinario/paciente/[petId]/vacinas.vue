<script setup lang="ts">
/**
 * Vacinas do paciente — a carteira da clínica e a do app, lado a lado.
 *
 * É a tela que prova a frase do requisito: **mesma entidade, dois lados**. À esquerda, o que a
 * clínica trabalha — o protocolo por espécie e idade, com onde o animal está nele, e o histórico
 * com quem aplicou e onde. À direita, a carteirinha que o responsável já usa no celular, montada
 * só com o que o contrato entrega. Aplicar à esquerda muda a direita na mesma hora; é esse o
 * momento que a demonstração inteira existe para mostrar, e ele cabe em cinco segundos.
 *
 * O acabamento é o da Visão geral, como o resto da ficha do paciente (`ficha/ficha.css`): o nome
 * no lugar da saudação, a frase do estado das vacinas em degradê, e as ações em pílula. Uma ação
 * principal só, cheia: **aplicar**. Registrar a dose de outro lugar é a segunda, contornada — é o
 * que se faz uma vez por paciente, na primeira visita, com a carteirinha do pet shop na mão.
 *
 * O atraso aparece nos dois lados com a mesma regra (a carência de três dias da API e do app), e o
 * cartão do celular diz isso em voz alta: quem liga para o responsável precisa saber que ele está
 * vendo o mesmo aviso.
 */
import Button from 'primevue/button'
import {
  PhClockCounterClockwise,
  PhDeviceMobile,
  PhListChecks,
  PhMapPin,
  PhSyringe,
} from '@phosphor-icons/vue'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'

import '@/components/home/home-card.css'
import '@/features/clinico/components/pacientes/ficha/ficha.css'
import PartnerPageFrame from '@/components/parceiro/PartnerPageFrame.vue'
import ClinicDataTable from '@/features/clinico/components/base/ClinicDataTable.vue'
import type { ColunaTabela } from '@/features/clinico/components/base/table-types'
import FichaCabeca from '@/features/clinico/components/pacientes/ficha/FichaCabeca.vue'
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
import type { PlanoVacinal } from '@/features/clinico/domain/protocolo-vacinal'
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

    return t('clinico.ficha.vacinas.proxima', { dias }, dias)
  }

  return t('clinico.ficha.vacinas.emDia')
})

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
  <PartnerPageFrame
    class="ficha-tema hc-tema"
    :title="pet?.nome ?? t('clinico.vacinas.titulo')"
    :loading="carregando && !pet"
    :error="erro"
    block-when-suspended
    @retry="carregar"
  >
    <template v-if="pet" #cabecalho>
      <FichaCabeca :pet="pet" :tutor="tutor" atual="vacinas" :frase="frase">
        <template v-if="temProtocolo" #acoes>
          <Button
            class="hc-pilula hc-pilula--cheia"
            :label="t('clinico.vacinas.aplicar.abrir')"
            @click="abrirAplicar()"
          >
            <template #icon>
              <PhSyringe class="hc-pilula__icone" weight="fill" aria-hidden="true" />
            </template>
          </Button>
          <Button
            class="hc-pilula"
            :label="t('clinico.vacinas.externa.abrir')"
            @click="registrandoExterna = true"
          >
            <template #icon>
              <PhMapPin class="hc-pilula__icone" weight="duotone" aria-hidden="true" />
            </template>
          </Button>
        </template>
      </FichaCabeca>
    </template>

    <div v-if="pet" class="ficha-conteudo clinic-scope">
      <template v-if="temProtocolo && plano">
        <div class="ficha-grade carteira__grade">
          <div class="ficha-coluna">
            <section class="hc" :aria-labelledby="`${petId}-protocolo`">
              <header class="hc__cabeca">
                <h2 :id="`${petId}-protocolo`" class="hc__titulo">
                  <PhListChecks class="hc__icone" weight="duotone" aria-hidden="true" />
                  {{ t('clinico.vacinas.carteira.protocolo') }}
                </h2>
              </header>
              <p class="ficha-ajuda">
                {{
                  t(`clinico.vacinas.carteira.protocoloAjuda.${plano.faixa}`, {
                    especie: formato.especie(pet.especie),
                    idade: pet.nascimento
                      ? formato.idade(pet.nascimento)
                      : t('clinico.vacinas.carteira.semIdade'),
                  })
                }}
              </p>

              <PlanoVacinalLista :plano="plano" @aplicar="abrirAplicar" />
            </section>

            <section class="hc" :aria-labelledby="`${petId}-aplicacoes`">
              <header class="hc__cabeca">
                <h2 :id="`${petId}-aplicacoes`" class="hc__titulo">
                  <PhClockCounterClockwise class="hc__icone" weight="duotone" aria-hidden="true" />
                  {{ t('clinico.vacinas.carteira.historicoTitulo') }}
                </h2>
              </header>
              <p class="ficha-ajuda">{{ t('clinico.vacinas.carteira.historicoAjuda') }}</p>

              <ClinicDataTable
                :colunas="colunas"
                :linhas="historico"
                :chave="(linha) => linha.id"
                :carregando="carregando"
                :vazio-titulo="t('clinico.vacinas.carteira.historicoVazio')"
                :rotulo="t('clinico.vacinas.carteira.historicoTitulo')"
              >
                <template #celula-quando="{ linha }">
                  <strong class="clinic-value">
                    {{ formato.dataCurta(clinicClock.dateOf(linha.aplicadaEm)) }}
                  </strong>
                  <span class="carteira__meta">{{ linha.aplicadaEm.slice(0, 4) }}</span>
                </template>

                <template #celula-vacina="{ linha }">
                  <span class="carteira__nome">{{ nomeDaVacina(linha.vacinaId) }}</span>
                  <span class="carteira__meta">
                    {{ numeroDaDose(linha) }}
                    <template v-if="linha.via"> · {{ rotulos.via(linha.via) }}</template>
                  </span>
                </template>

                <template #celula-lote="{ linha }">
                  <template v-if="linha.origem === 'externa'">
                    <span class="carteira__nome">{{ t('clinico.vacinas.externa.semLote') }}</span>
                    <span class="carteira__meta">
                      {{ t('clinico.vacinas.externa.naoAplicadaAqui') }}
                    </span>
                  </template>
                  <template v-else>
                    <span class="carteira__nome clinic-value">{{ linha.lote }}</span>
                    <span v-if="linha.validadeLote" class="carteira__meta">
                      {{
                        t('clinico.vacinas.validade', { data: rotulos.data(linha.validadeLote) })
                      }}
                    </span>
                  </template>
                </template>

                <!--
                  Quem e onde, na mesma célula: na dose daqui, o nome de quem aplicou; na de fora, o
                  lugar e a procedência — e quem daqui transcreveu, que é quem responde pela linha.
                -->
                <template #celula-quem="{ linha }">
                  <template v-if="linha.externa">
                    <span class="carteira__nome">
                      <PhMapPin class="carteira__lugar" weight="duotone" aria-hidden="true" />
                      {{ linha.externa.local }}
                    </span>
                    <span
                      class="carteira__meta"
                      :class="{ 'carteira__meta--relato': linha.externa.procedencia === 'relato' }"
                    >
                      {{
                        t(`clinico.vacinas.externa.procedenciaCurta.${linha.externa.procedencia}`, {
                          nome: clinico.profissional(linha.externa.registradaPor)?.nome ?? '',
                        })
                      }}
                    </span>
                  </template>
                  <template v-else>
                    <span class="carteira__nome">
                      {{ clinico.profissional(linha.professionalId)?.nome }}
                    </span>
                    <span class="carteira__meta">{{
                      t('clinico.vacinas.carteira.nestaClinica')
                    }}</span>
                  </template>
                </template>
              </ClinicDataTable>
            </section>
          </div>

          <!--
            O celular do responsável. Fica preso ao topo ao rolar a coluna da clínica: a
            demonstração é olhar os dois ao mesmo tempo, e um celular que sobe junto com a tabela
            some justamente quando alguém aplica.
          -->
          <div class="ficha-coluna carteira__app">
            <section class="hc" :aria-labelledby="`${petId}-app`">
              <header class="hc__cabeca">
                <h2 :id="`${petId}-app`" class="hc__titulo">
                  <PhDeviceMobile class="hc__icone" weight="duotone" aria-hidden="true" />
                  {{ t('clinico.vacinas.carteira.noApp', { responsavel: tutor?.nome ?? '' }) }}
                </h2>
              </header>
              <p class="ficha-ajuda">
                {{
                  atrasadas.length > 0
                    ? t('clinico.vacinas.carteira.mesmoNoApp', { responsavel: tutor?.nome ?? '' })
                    : t('clinico.vacinas.carteira.noAppAjuda')
                }}
              </p>

              <CarteirinhaNoApp v-if="carteirinha" :carteirinha="carteirinha" />
            </section>
          </div>
        </div>

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
    </div>
  </PartnerPageFrame>
</template>

<style scoped>
/* A clínica mais larga, o celular do lado; em uma coluna, o celular desce. */
@container (min-width: 62rem) {
  .carteira__grade {
    grid-template-columns: minmax(0, 1.65fr) minmax(22rem, 1fr);
  }

  .carteira__app {
    position: sticky;
    top: 1rem;
  }
}

.carteira__nome {
  display: flex;
  overflow: hidden;
  align-items: center;
  gap: 0.3rem;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.carteira__lugar {
  flex-shrink: 0;
  width: 0.95rem;
  height: 0.95rem;
  color: var(--hc-marca);
}

.carteira__meta {
  display: block;
  color: var(--hc-tinta-2);
  font-size: 0.8125rem;
}

.carteira__meta--relato {
  color: var(--hc-pessego-tinta);
  font-weight: 600;
}
</style>
