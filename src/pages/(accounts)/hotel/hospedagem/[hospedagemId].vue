<script setup lang="ts">
/**
 * A estadia — o trabalho de dias sobre um animal.
 *
 * Quem assume o turno precisa entender o hóspede em trinta segundos, e é isso que decide o que
 * fica acima da dobra: **o que trava**, depois quem ele é, depois a rotina de hoje. O diário, o
 * boletim e a ficha vêm abaixo, porque são consultados e não executados.
 *
 * As duas regras aparecem aqui inteiras:
 *
 * - **R3**: a ocorrência grave sem contato é a primeira coisa da página, com o botão que registra
 *   a ligação. Enquanto ela existe, o boletim fica retido e o turno não passa.
 * - **R4**: o check-out abre um diálogo de conferência, e não um botão de confirmar.
 */
import Button from 'primevue/button'
import SelectButton from 'primevue/selectbutton'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import PartnerPageFrame from '@/components/parceiro/PartnerPageFrame.vue'
import ClinicStat from '@/features/clinico/components/base/ClinicStat.vue'
import HotelDevPanel from '@/features/hotel/components/base/HotelDevPanel.vue'
import HotelTour from '@/features/hotel/components/base/HotelTour.vue'
import type { PassoDoTour } from '@/features/hotel/components/base/tour-types'
import HotelSelo from '@/features/hotel/components/base/HotelSelo.vue'
import PetAvatar from '@/features/hotel/components/base/PetAvatar.vue'
import CheckOutDialog from '@/features/hotel/components/estadia/CheckOutDialog.vue'
import DiarioDialog from '@/features/hotel/components/estadia/DiarioDialog.vue'
import OcorrenciaDialog from '@/features/hotel/components/estadia/OcorrenciaDialog.vue'
import PlanoDaEstadia from '@/features/hotel/components/estadia/PlanoDaEstadia.vue'
import PropostaDeRotinaDialog from '@/features/hotel/components/rotina/PropostaDeRotinaDialog.vue'
import TarefaLinha from '@/features/hotel/components/rotina/TarefaLinha.vue'
import { useHotelFormat } from '@/features/hotel/composables/useHotelFormat'
import type { Adaptacao, TarefaStatus } from '@/features/hotel/data/types'
import { tomDaAdaptacao, tomDaGravidade } from '@/features/hotel/domain/estadia'
import {
  ajustesDoHospede,
  hospedesParaRotina,
  propostaRepository,
  type HospedeParaRotina,
} from '@/features/hotel/data/repositories'
import { useHospedagemStore } from '@/features/hotel/stores/hospedagem'
import { useHotelStore } from '@/features/hotel/stores/hotel'

/** A escada, do melhor para o pior — é a ordem em que a pessoa pensa no hóspede. */
const ADAPTACOES: Adaptacao[] = ['tranquilo', 'em-adaptacao', 'estressado']

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const formato = useHotelFormat()
const hotelStore = useHotelStore()
const hospedagem = useHospedagemStore()

const hospedagemId = computed(() => String(route.params.hospedagemId ?? ''))

const ocorrenciaAberta = ref(false)

/* O plano deste animal: o que a casa faz por todos, menos o que muda para ele. */
const propostaAberta = ref(false)
const ajustes = ref<ReturnType<typeof ajustesDoHospede>>([])
const hospedes = ref<HospedeParaRotina[]>([])

function recarregarAjustes() {
  ajustes.value = ajustesDoHospede(hospedagemId.value)
  hospedes.value = hospedesParaRotina()
}

async function abrirProposta() {
  recarregarAjustes()
  propostaAberta.value = true
  await hospedagem.proporRotina(hospedagemId.value)
}

async function aprovarProposta(payload: Parameters<typeof hospedagem.aprovarProposta>[0]) {
  if (await hospedagem.aprovarProposta(payload)) {
    propostaAberta.value = false
    recarregarAjustes()
  }
}

async function revogarAjuste(ajusteId: string) {
  await propostaRepository.revogar(ajusteId)
  recarregarAjustes()
  await hospedagem.carregarEstadia(hospedagemId.value)
}
const diarioAberto = ref(false)
const checkOutAberto = ref(false)

onMounted(async () => {
  await hospedagem.carregarEstadia(hospedagemId.value)
  recarregarAjustes()
})

watch(
  () => hotelStore.revisao,
  () => void hospedagem.carregarEstadia(hospedagemId.value),
)

const estadia = computed(() => hospedagem.estadia)
const registro = computed(() => estadia.value?.hospedagem ?? null)
const pet = computed(() => (registro.value ? hotelStore.pet(registro.value.petId) : null))
const tutor = computed(() => (registro.value ? hotelStore.tutor(registro.value.tutorId) : null))
const acomodacao = computed(() =>
  registro.value ? hotelStore.acomodacao(registro.value.acomodacaoId) : null,
)

const encerrada = computed(() => registro.value?.status === 'encerrada')

const boletimRetido = computed(
  () => (estadia.value?.boletins ?? []).find((item) => item.status === 'retido') ?? null,
)

const ultimoBoletim = computed(() => estadia.value?.boletins[0] ?? null)

async function marcar(payload: { tarefaId: string; status: TarefaStatus }) {
  await hospedagem.marcarTarefa(payload.tarefaId, payload.status)
}

async function registrarContato(ocorrenciaId: string) {
  await hospedagem.registrarContato(ocorrenciaId, hospedagemId.value)
}

async function fecharEstadia(retiradoPor: string) {
  const encerradaAgora = await hospedagem.checkOut(hospedagemId.value, retiradoPor)

  if (encerradaAgora) {
    checkOutAberto.value = false
  }
}
/**
 * O tutorial desta tela, na ordem em que se lê a página.
 *
 * Os passos ficam aqui, e não num catálogo central, porque cada um carrega um seletor do próprio
 * template: separá-los faria o roteiro apontar para uma classe renomeada sem ninguém notar.
 */
const tourAberto = ref(false)

const passosDoTour = computed<PassoDoTour[]>(() => [
  {
    titulo: t('hotel.tour.estadia.pergunta.titulo'),
    texto: t('hotel.tour.estadia.pergunta.texto'),
  },
  {
    alvo: '.lista',
    titulo: t('hotel.tour.estadia.rotina.titulo'),
    texto: t('hotel.tour.estadia.rotina.texto'),
  },
  {
    alvo: '.boletim',
    titulo: t('hotel.tour.estadia.ocorrencias.titulo'),
    texto: t('hotel.tour.estadia.ocorrencias.texto'),
  },
  {
    alvo: '.ficha',
    titulo: t('hotel.tour.estadia.ficha.titulo'),
    texto: t('hotel.tour.estadia.ficha.texto'),
  },
  {
    alvo: '.trava',
    titulo: t('hotel.tour.estadia.checkout.titulo'),
    texto: t('hotel.tour.estadia.checkout.texto'),
  },
])
</script>

<template>
  <PartnerPageFrame
    class="hc-tema"
    :title="pet?.nome ?? t('hotel.estadia.titulo')"
    :subtitle="t('hotel.estadia.subtitulo')"
    tour
    @tour="tourAberto = true"
    :loading="hospedagem.carregando && !estadia"
    :error="hospedagem.erro ? t(hospedagem.erro) : ''"
    @retry="hospedagem.carregarEstadia(hospedagemId)"
  >
    <div v-if="estadia && registro" class="estadia clinic-scope">
      <!--
        O que trava abre a página. A ocorrência grave sem ligação não é um item do histórico: é a
        razão pela qual o boletim não saiu e o turno não passa, e o botão que a resolve tem de
        estar aqui, não três cliques abaixo.
      -->
      <section
        v-for="ocorrencia in hospedagem.ocorrenciasTravadasDaEstadia"
        :key="ocorrencia.id"
        class="trava"
        role="alert"
      >
        <div class="trava__texto">
          <strong>
            <i class="pi pi-phone" aria-hidden="true" />
            {{ t('hotel.estadia.precisaLigar', { nome: tutor?.nome ?? '' }) }}
          </strong>
          <span> {{ formato.ocorrenciaKind(ocorrencia.kind) }} · {{ ocorrencia.descricao }} </span>
          <span class="trava__telefone">{{ tutor?.telefone }}</span>
        </div>

        <Button
          :label="t('hotel.estadia.registrarLigacao')"
          icon="pi pi-check"
          :loading="hospedagem.salvando"
          @click="registrarContato(ocorrencia.id)"
        />
      </section>

      <section class="topo">
        <PetAvatar
          v-if="pet"
          :nome="pet.nome"
          :iniciais="pet.iniciais"
          :especie="pet.especie"
          :foto-url="pet.fotoUrl"
          tamanho="lg"
        />

        <div class="topo__quem">
          <h2 class="topo__nome">{{ pet?.nome }}</h2>
          <p class="topo__linha">
            {{ acomodacao?.nome }} ·
            {{ pet ? formato.especie(pet.especie) : '' }}
            <template v-if="pet?.porte"> · {{ formato.porte(pet.porte) }}</template>
          </p>
          <p class="topo__linha">{{ tutor?.nome }} · {{ tutor?.telefone }}</p>
        </div>

        <div class="topo__selos">
          <!--
            A adaptação deixou de ser só um selo.
            Ela nascia "em adaptação" no check-in e não tinha como mudar: quem sossegava no segundo
            dia ficava em adaptação até ir embora, e quem começava a estranhar não tinha como ser
            marcado. A tela de Hóspedes é construída em volta deste selo.
          -->
          <SelectButton
            v-if="!encerrada"
            :model-value="registro.adaptacao"
            :options="ADAPTACOES.map((item) => ({ valor: item, rotulo: formato.adaptacao(item) }))"
            option-label="rotulo"
            option-value="valor"
            :allow-empty="false"
            size="small"
            :aria-label="t('hotel.estadia.comoEstaSeAdaptando')"
            @update:model-value="(valor) => hospedagem.ajustarAdaptacao(hospedagemId, valor)"
          />

          <HotelSelo
            v-else
            :rotulo="formato.adaptacao(registro.adaptacao)"
            :tom="tomDaAdaptacao(registro.adaptacao)"
          />
          <HotelSelo
            v-if="encerrada"
            :rotulo="t('hotel.estadia.encerrada')"
            tom="neutro"
            icone="pi pi-check"
          />
        </div>
      </section>

      <section class="numeros">
        <ClinicStat
          :rotulo="t('hotel.estadia.stat.entrada')"
          :valor="formato.quando(registro.entradaEm)"
          :detalhe="
            t('hotel.estadia.stat.recebidoPor', {
              nome: hotelStore.cuidador(registro.recebidoPor)?.nome ?? '',
            })
          "
          icone="pi pi-sign-in"
        />
        <ClinicStat
          :rotulo="t('hotel.estadia.stat.saida')"
          :valor="formato.quando(registro.saidaEm ?? registro.saidaPrevistaEm)"
          :detalhe="
            registro.saidaEm ? t('hotel.estadia.stat.saiu') : t('hotel.estadia.stat.prevista')
          "
          icone="pi pi-sign-out"
          :tom="estadia.acrescimoDeSaida > 0 ? 'atencao' : 'neutro'"
        />
        <ClinicStat
          :rotulo="t('hotel.estadia.stat.peso')"
          :valor="formato.peso(registro.pesoEntradaKg)"
          :detalhe="
            registro.pesoSaidaKg === null
              ? t('hotel.estadia.stat.semPesagem')
              : t('hotel.estadia.stat.saidaPeso', { valor: formato.peso(registro.pesoSaidaKg) })
          "
          icone="pi pi-chart-bar"
        />
        <ClinicStat
          :rotulo="t('hotel.estadia.stat.saldo')"
          :valor="formato.moeda(estadia.saldoCentavos)"
          :detalhe="t('hotel.estadia.stat.saldoDetalhe')"
          icone="pi pi-wallet"
        />
      </section>

      <div class="colunas">
        <div class="coluna">
          <section class="cartao">
            <header class="cartao__topo">
              <h3 class="cartao__titulo">{{ t('hotel.estadia.rotinaHoje') }}</h3>
            </header>

            <p v-if="hospedagem.checklistDaEstadia.length === 0" class="cartao__vazio">
              {{ t('hotel.estadia.semRotina') }}
            </p>

            <ul v-else class="lista lista--rotina">
              <TarefaLinha
                v-for="item in hospedagem.checklistDaEstadia"
                :key="item.tarefa.id"
                :tarefa="item.tarefa"
                :situacao="item.situacao"
                :salvando="hospedagem.salvando"
                @marcar="marcar"
              />
            </ul>
          </section>

          <!--
            Logo abaixo de "Rotina de hoje", e a posição é o argumento: a de cima responde o que
            falta hoje, esta responde por que é isso que falta.
          -->
          <PlanoDaEstadia
            :ajustes="ajustes"
            :salvando="hospedagem.salvando"
            @propor="abrirProposta"
            @revogar="revogarAjuste"
          />

          <section class="cartao">
            <header class="cartao__topo">
              <h3 class="cartao__titulo">{{ t('hotel.estadia.diario') }}</h3>
              <Button
                v-if="!encerrada"
                :label="t('hotel.estadia.registrar')"
                icon="pi pi-plus"
                severity="secondary"
                outlined
                size="small"
                @click="diarioAberto = true"
              />
            </header>

            <p v-if="estadia.diario.length === 0" class="cartao__vazio">
              {{ t('hotel.estadia.semDiario') }}
            </p>

            <ul v-else class="diario">
              <li v-for="item in estadia.diario" :key="item.id">
                <span v-if="item.foto" class="diario__foto" aria-hidden="true">{{
                  item.foto
                }}</span>
                <div class="diario__corpo">
                  <strong>{{ formato.registroKind(item.kind) }}</strong>
                  <p>{{ item.texto }}</p>
                  <small>
                    {{ formato.quando(item.registradoEm) }} ·
                    {{ hotelStore.cuidador(item.registradoPor)?.nome ?? '' }}
                  </small>
                </div>
              </li>
            </ul>
          </section>
        </div>

        <div class="coluna">
          <section class="cartao">
            <header class="cartao__topo">
              <h3 class="cartao__titulo">{{ t('hotel.estadia.ocorrencias') }}</h3>
              <Button
                v-if="!encerrada"
                :label="t('hotel.estadia.registrarOcorrencia')"
                icon="pi pi-flag"
                severity="secondary"
                outlined
                size="small"
                @click="ocorrenciaAberta = true"
              />
            </header>

            <p v-if="estadia.ocorrencias.length === 0" class="cartao__vazio">
              {{ t('hotel.estadia.semOcorrencias') }}
            </p>

            <ul v-else class="lista lista--ocorrencias">
              <li v-for="item in estadia.ocorrencias" :key="item.id">
                <div class="ocorrencia__topo">
                  <strong>{{ formato.ocorrenciaKind(item.kind) }}</strong>
                  <HotelSelo
                    :rotulo="formato.gravidade(item.gravidade)"
                    :tom="tomDaGravidade(item.gravidade)"
                  />
                  <HotelSelo
                    v-if="item.exigeContato"
                    :rotulo="
                      item.contatoEm
                        ? t('hotel.estadia.comunicado', { hora: formato.hora(item.contatoEm) })
                        : t('hotel.estadia.semContato')
                    "
                    :tom="item.contatoEm ? 'positivo' : 'risco'"
                    icone="pi pi-phone"
                  />
                </div>

                <p>{{ item.descricao }}</p>
                <p class="ocorrencia__conduta">{{ item.conduta }}</p>
                <small>
                  {{ formato.quando(item.registradaEm) }} ·
                  {{ hotelStore.cuidador(item.registradaPor)?.nome ?? '' }}
                </small>
              </li>
            </ul>
          </section>

          <section class="cartao">
            <header class="cartao__topo">
              <h3 class="cartao__titulo">{{ t('hotel.estadia.boletim') }}</h3>
              <Button
                v-if="!encerrada"
                :label="t('hotel.estadia.gerarBoletim')"
                icon="pi pi-comment"
                severity="secondary"
                outlined
                size="small"
                :loading="hospedagem.salvando"
                @click="hospedagem.gerarBoletim(hospedagemId)"
              />
            </header>

            <!--
              O boletim retido é mostrado com o motivo do travamento, e não como um erro. Quem lê
              precisa entender que **falta uma ligação** — não que o sistema quebrou.
            -->
            <p v-if="boletimRetido" class="aviso aviso--risco">
              <i class="pi pi-lock" aria-hidden="true" />
              {{ t('hotel.estadia.boletimRetido') }}
            </p>

            <article v-if="ultimoBoletim" class="boletim">
              <p>{{ ultimoBoletim.texto }}</p>
              <footer>
                <small>{{ formato.quando(ultimoBoletim.geradoEm) }}</small>
                <Button
                  v-if="ultimoBoletim.status !== 'enviado'"
                  :label="t('hotel.estadia.enviarBoletim')"
                  icon="pi pi-send"
                  size="small"
                  :disabled="Boolean(boletimRetido)"
                  :loading="hospedagem.salvando"
                  @click="hospedagem.enviarBoletim(ultimoBoletim.id, hospedagemId)"
                />
                <HotelSelo
                  v-else
                  :rotulo="t('hotel.estadia.enviado')"
                  tom="positivo"
                  icone="pi pi-check"
                />
              </footer>
            </article>

            <p v-else class="cartao__vazio">{{ t('hotel.estadia.semBoletim') }}</p>
          </section>

          <section class="cartao">
            <h3 class="cartao__titulo">{{ t('hotel.estadia.ficha') }}</h3>

            <dl class="ficha">
              <dt>{{ t('hotel.estadia.alimentacao') }}</dt>
              <dd>
                {{ registro.planoAlimentar.marca || t('hotel.estadia.racaoDaCasa') }} ·
                {{ registro.planoAlimentar.porcaoGramas }} g ·
                {{ registro.planoAlimentar.horarios.join(', ') }}
                <template v-if="registro.planoAlimentar.restricoes">
                  <br />{{ registro.planoAlimentar.restricoes }}
                </template>
              </dd>

              <dt>{{ t('hotel.estadia.medicacao') }}</dt>
              <dd>
                <template v-if="estadia.medicacoes.length === 0">
                  {{ t('hotel.estadia.semMedicacao') }}
                </template>
                <template v-else>
                  <span v-for="med in estadia.medicacoes" :key="med.id" class="ficha__med">
                    {{ med.descricao }} · {{ med.doseTexto }} · {{ formato.via(med.via) }} ·
                    {{ med.horarios.join(', ') }}
                  </span>
                </template>
              </dd>

              <dt>{{ t('hotel.estadia.pertences') }}</dt>
              <dd>
                <span v-for="item in registro.pertences" :key="item.id" class="ficha__pertence">
                  {{ item.descricao }}
                  <HotelSelo
                    v-if="item.devolvido"
                    :rotulo="t('hotel.checkout.devolvido')"
                    tom="positivo"
                    plano
                  />
                </span>
              </dd>

              <dt>{{ t('hotel.estadia.autorizacoes') }}</dt>
              <dd>
                <span
                  v-for="item in registro.autorizacoes.filter((auth) => auth.concedida)"
                  :key="item.kind"
                  class="ficha__autorizacao"
                >
                  {{ formato.autorizacao(item.kind) }}
                </span>
              </dd>

              <!--
                Quem pode buscar fica na ficha, e não só no check-out: é a pergunta que chega por
                telefone no meio da estadia — "minha irmã pode passar aí amanhã?" — e quem atende
                precisa da resposta sem abrir a saída.
              -->
              <dt>{{ t('hotel.estadia.quemBusca') }}</dt>
              <dd>
                <span class="ficha__linha">
                  {{
                    [tutor?.nome, t('hotel.quemBusca.responsavel'), tutor?.telefone]
                      .filter(Boolean)
                      .join(' · ')
                  }}
                </span>
                <span
                  v-for="pessoa in estadia.autorizadosARetirar"
                  :key="pessoa.id"
                  class="ficha__linha"
                >
                  {{ [pessoa.nome, pessoa.relacao, pessoa.telefone].filter(Boolean).join(' · ') }}
                </span>
              </dd>

              <dt>{{ t('hotel.estadia.emergencia') }}</dt>
              <!-- Uma linha por contato: sem o do responsável, o veterinário sobe para a primeira. -->
              <dd>
                <span v-if="registro.contatoEmergencia" class="ficha__linha">
                  {{ registro.contatoEmergencia }}
                </span>
                <span v-if="registro.veterinario" class="ficha__linha">
                  {{
                    [
                      registro.veterinario.nome,
                      registro.veterinario.clinica,
                      registro.veterinario.telefone,
                    ]
                      .filter(Boolean)
                      .join(' · ')
                  }}
                </span>
              </dd>

              <dt v-if="registro.inspecaoDeEntrada">{{ t('hotel.estadia.inspecao') }}</dt>
              <dd v-if="registro.inspecaoDeEntrada">{{ registro.inspecaoDeEntrada }}</dd>
            </dl>
          </section>

          <section v-if="!encerrada" class="cartao cartao--acao">
            <p v-if="estadia.impedimentos.length > 0" class="aviso aviso--atencao">
              <i class="pi pi-exclamation-triangle" aria-hidden="true" />
              {{ t(`hotel.erros.saida.${estadia.impedimentos[0]}`) }}
            </p>

            <Button
              :label="t('hotel.estadia.fazerCheckOut')"
              icon="pi pi-sign-out"
              @click="checkOutAberto = true"
            />
          </section>
        </div>
      </div>
    </div>

    <OcorrenciaDialog
      :aberto="ocorrenciaAberta"
      :pet-nome="pet?.nome ?? ''"
      :salvando="hospedagem.salvando"
      :erro="hospedagem.erroDeAcao"
      @fechar="ocorrenciaAberta = false"
      @confirmar="
        async (payload) => {
          await hospedagem.registrarOcorrencia({ ...payload, hospedagemId })
          ocorrenciaAberta = false
        }
      "
    />

    <DiarioDialog
      :aberto="diarioAberto"
      :pet-nome="pet?.nome ?? ''"
      :pet-iniciais="pet?.iniciais ?? ''"
      :salvando="hospedagem.salvando"
      :erro="hospedagem.erroDeAcao"
      @fechar="diarioAberto = false"
      @confirmar="
        async (payload) => {
          await hospedagem.registrarNoDiario({ ...payload, hospedagemId })
          diarioAberto = false
        }
      "
    />

    <CheckOutDialog
      :aberto="checkOutAberto"
      :hospedagem="registro"
      :pet-nome="pet?.nome ?? ''"
      :saldo-centavos="estadia?.saldoCentavos ?? 0"
      :acrescimo-de-saida="estadia?.acrescimoDeSaida ?? 0"
      :ocorrencias-travadas="hospedagem.ocorrenciasTravadasDaEstadia"
      :responsavel-nome="tutor?.nome ?? ''"
      :responsavel-telefone="tutor?.telefone ?? ''"
      :responsavel-documento="tutor?.documento ?? ''"
      :autorizados-a-retirar="estadia?.autorizadosARetirar ?? []"
      :salvando="hospedagem.salvando"
      :erro="hospedagem.erroDeAcao"
      @fechar="checkOutAberto = false"
      @conferir="(payload) => hospedagem.conferirPertence({ ...payload, hospedagemId })"
      @pesar="(peso) => hospedagem.pesarNaSaida(hospedagemId, peso)"
      @confirmar="fecharEstadia"
    />

    <PropostaDeRotinaDialog
      :aberto="propostaAberta"
      :hospedes="hospedes"
      :hospedagem-id="hospedagemId"
      :proposta="hospedagem.proposta"
      :gerando="hospedagem.gerandoProposta"
      :salvando="hospedagem.salvando"
      :erro="hospedagem.erroDeAcao ? t(hospedagem.erroDeAcao) : ''"
      @fechar="propostaAberta = false"
      @aprovar="aprovarProposta"
    />

    <HotelDevPanel />

    <HotelTour v-model:aberto="tourAberto" :passos="passosDoTour" />

    <template #actions>
      <span class="clinic-scope clinic-acoes">
        <Button
          :label="t('hotel.estadia.voltar')"
          icon="pi pi-arrow-left"
          severity="secondary"
          outlined
          size="small"
          @click="router.push('/hotel/hospedes')"
        />
      </span>
    </template>
  </PartnerPageFrame>
</template>

<style scoped>
.estadia {
  display: grid;
  gap: var(--clinic-space-4);
}

/*
 * Um cartão branco como os outros (redesenho de 30/09/2026), e não uma faixa pintada de coral de
 * ponta a ponta: a urgência mora no título e no ícone, e o resto do texto fica na tinta.
 */
.trava {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  padding: 1.1rem 1.35rem;
  border: 1px solid var(--clinic-line);
  border-radius: var(--clinic-radius-card);
  gap: var(--clinic-space-3);
  background: var(--clinic-surface);
  box-shadow: var(--clinic-shadow-card);
  color: var(--clinic-muted);
}

.trava__texto strong {
  color: var(--clinic-risk-text);
}

.trava__texto {
  display: grid;
  gap: 0.15rem;
}

.trava__texto strong {
  display: flex;
  align-items: center;
  gap: var(--clinic-space-2);
  font-weight: 800;
}

.trava__texto span {
  font-size: var(--clinic-font-label);
}

.trava__telefone {
  font-weight: 750;
  font-variant-numeric: tabular-nums;
}

.topo {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  padding: var(--clinic-space-4);
  border: 1px solid var(--clinic-line);
  border-radius: var(--clinic-radius-card);
  gap: var(--clinic-space-3);
  background: var(--clinic-surface);
}

.topo__nome {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 800;
  letter-spacing: -0.02em;
}

.topo__linha {
  margin: 0.1rem 0 0;
  color: var(--clinic-muted);
  font-size: var(--clinic-font-label);
}

.topo__selos {
  display: flex;
  flex-wrap: wrap;
  gap: var(--clinic-space-2);
}

.numeros {
  display: grid;
  gap: var(--clinic-space-3);
  grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
}

.colunas {
  display: grid;
  gap: var(--clinic-space-4);
  grid-template-columns: repeat(auto-fit, minmax(22rem, 1fr));
}

.coluna {
  display: grid;
  gap: var(--clinic-space-4);
  align-content: start;
}

.cartao {
  display: grid;
  gap: var(--clinic-space-3);
  padding: var(--clinic-space-4);
  border: 1px solid var(--clinic-line);
  border-radius: var(--clinic-radius-card);
  background: var(--clinic-surface);
}

.cartao--acao {
  justify-items: start;
}

.cartao__topo {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--clinic-space-2);
}

.cartao__titulo {
  margin: 0;
  color: var(--clinic-text);
  font-size: 0.9375rem;
  font-weight: 650;
  letter-spacing: -0.01em;
}

.cartao__vazio {
  margin: 0;
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
}

.lista {
  display: grid;
  gap: var(--clinic-space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}

/*
 * A rotina da estadia usa a mesma `TarefaLinha` da prancheta, e lá ela deixou de ser cartão para
 * virar fileira: sem borda, sem fundo, sem raio. Quem separa uma da outra passou a ser o filete
 * que o pai desenha — na prancheta é o cartão da ronda, e aqui é este bloco.
 *
 * Sem isto, a lista desta aba viraria um bolo de texto sem divisão nenhuma no mesmo commit em que
 * a prancheta melhorou. O sangramento lateral leva o filete até as bordas do cartão, que é o que
 * faz a divisão parecer estrutura e não um traço solto no meio do texto.
 */
.lista--rotina {
  gap: 0;
  margin-inline: calc(var(--clinic-space-4) * -1);
}

.lista--rotina > li + li {
  border-block-start: 1px solid var(--clinic-line-soft);
}

.lista--ocorrencias li {
  display: grid;
  gap: 0.2rem;
  padding: var(--clinic-space-3);
  border: 1px solid var(--clinic-line-soft);
  border-radius: var(--clinic-radius-control);
  background: var(--clinic-surface-soft);
}

.lista--ocorrencias p {
  margin: 0;
  font-size: var(--clinic-font-label);
}

.ocorrencia__topo {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--clinic-space-2);
}

.ocorrencia__conduta {
  color: var(--clinic-muted);
}

.lista--ocorrencias small {
  color: var(--clinic-faint);
  font-size: 0.7rem;
}

.diario {
  display: grid;
  gap: var(--clinic-space-3);
  margin: 0;
  padding: 0;
  list-style: none;
}

.diario li {
  display: flex;
  align-items: flex-start;
  gap: var(--clinic-space-3);
}

.diario__foto {
  display: grid;
  width: 2.4rem;
  height: 2.4rem;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 0.6rem;
  background: var(--clinic-accent-tint);
  color: var(--clinic-accent-strong);
  font-size: 0.75rem;
  font-weight: 800;
}

.diario__corpo {
  display: grid;
  gap: 0.1rem;
  min-width: 0;
}

.diario__corpo strong {
  font-size: var(--clinic-font-label);
  font-weight: 750;
}

.diario__corpo p {
  margin: 0;
  font-size: var(--clinic-font-label);
}

.diario__corpo small {
  color: var(--clinic-faint);
  font-size: 0.7rem;
}

/* O motivo do travamento é uma linha com ícone na cor do estado — a faixa pintada não volta. */
.aviso {
  display: flex;
  align-items: center;
  margin: 0;
  gap: var(--clinic-space-2);
  font-size: var(--clinic-font-label);
  font-weight: 700;
}

.aviso--risco {
  color: var(--clinic-risk-text);
}

.aviso--atencao {
  color: var(--clinic-attention-text);
}

.boletim {
  display: grid;
  gap: var(--clinic-space-2);
  padding: var(--clinic-space-3);
  border: 1px solid var(--clinic-line-soft);
  border-radius: var(--clinic-radius-control);
  background: var(--clinic-surface-soft);
}

.boletim p {
  margin: 0;
  font-size: var(--clinic-font-label);
  line-height: 1.5;
}

.boletim footer {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--clinic-space-2);
}

.boletim footer small {
  color: var(--clinic-faint);
  font-size: 0.7rem;
}

.ficha {
  display: grid;
  gap: 0.2rem 0.75rem;
  margin: 0;
  grid-template-columns: minmax(6rem, auto) 1fr;
}

.ficha dt {
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
  font-weight: 700;
}

.ficha dd {
  margin: 0;
  font-size: var(--clinic-font-label);
}

.ficha__med,
.ficha__pertence,
.ficha__autorizacao {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
}

.ficha__med,
.ficha__linha {
  display: block;
}

.ficha__pertence:not(:last-child)::after,
.ficha__autorizacao:not(:last-child)::after {
  content: '·';
  margin-inline-start: 0.3rem;
  color: var(--clinic-faint);
}
/* O nome cresce; o retrato à esquerda e os selos à direita ficam onde estão. */
.topo__quem {
  flex: 1;
  min-width: 12rem;
}
</style>
