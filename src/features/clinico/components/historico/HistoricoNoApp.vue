<script setup lang="ts">
/**
 * O lado do responsável: quem vê o histórico do pet, na prévia do celular.
 *
 * "Pronto quando" do requisito: o responsável entende sozinho o que está compartilhando e desfaz
 * em dois toques. Por isso cada clínica com acesso diz, em linha, o que vê, desde quando, até
 * quando e quantas vezes abriu; e "Encerrar" pede uma confirmação só — ali mesmo, com a frase do
 * que acontece com o que a clínica já viu, sem termo para ler.
 *
 * Liberar para uma clínica nova escolhe o que vai e por quanto tempo, com o consentimento dito em
 * uma frase, e devolve o código que a recepção digita. "Quem abriu e quando" é o registro de
 * auditoria lido por gente: o nome, o conselho, a clínica, o que abriu e a hora.
 */
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import SelectButton from 'primevue/selectbutton'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import PetAvatar from '@/features/hotel/components/base/PetAvatar.vue'

import { useClinicFormat } from '../../composables/useClinicFormat'
import { useRotulosDoHistorico } from '../../composables/useRotulosDoHistorico'
import {
  historicoDoResponsavel,
  type AcessoNoCelular,
  type AvisoNoCelular,
} from '../../data/historico-compartilhado'
import {
  CATEGORIAS_DO_HISTORICO,
  CATEGORIAS_PADRAO,
  PRAZOS_DO_ACESSO,
  type AberturaDoHistorico,
  type CategoriaDoHistorico,
} from '../../domain/historico-compartilhado'
import { addDays } from '../../domain/clinic-time'
import { clinicClock } from '../../stores/clinico'
import { useHistoricoLiberadoStore } from '../../stores/historico'

const props = defineProps<{
  tutorId: string
}>()

const emit = defineEmits<{
  /** O celular mudou algo (encerrou, liberou): a clínica relê. */
  mudou: []
}>()

const { t } = useI18n()
const formato = useClinicFormat()
const rotulos = useRotulosDoHistorico()
const historicoStore = useHistoricoLiberadoStore()

type Tela = 'lista' | 'liberar' | 'codigo' | 'quemAbriu'

const tela = ref<Tela>('lista')
const pets = computed(() => historicoDoResponsavel.pets(props.tutorId))
const petId = ref<string | null>(null)
const pet = computed(() => pets.value.find((item) => item.id === petId.value) ?? null)

const acessos = ref<AcessoNoCelular[]>([])
const aberturas = ref<AberturaDoHistorico[]>([])
const avisos = ref<AvisoNoCelular[]>([])
const avisoFechado = ref<string | null>(null)
const erro = ref('')

/** O acesso esperando a segunda batida de "Encerrar". */
const confirmando = ref<string | null>(null)
const encerrando = ref(false)

const doPet = computed(() => acessos.value.filter((acesso) => acesso.petId === petId.value))

const comAcesso = computed(() =>
  doPet.value.filter((acesso) => acesso.estado === 'ativo' || acesso.estado === 'aguardando'),
)

const semAcesso = computed(() =>
  doPet.value.filter((acesso) => acesso.estado === 'encerrado' || acesso.estado === 'expirado'),
)

const avisoRecente = computed(() => avisos.value[0] ?? null)

/**
 * A ficha de emergência não passa por um acesso: sem este caminho, quem fechou o aviso não acharia
 * mais quem abriu.
 */
const emergencias = computed(
  () => aberturas.value.filter((abertura) => abertura.canal === 'EMERGENCIA').length,
)

async function recarregar() {
  erro.value = ''

  try {
    const [todos, recebidos] = await Promise.all([
      historicoDoResponsavel.acessos(props.tutorId),
      historicoDoResponsavel.avisos(props.tutorId),
    ])

    acessos.value = todos
    avisos.value = recebidos
    aberturas.value = petId.value
      ? await historicoDoResponsavel.aberturas(props.tutorId, petId.value)
      : []
  } catch {
    erro.value = t('clinico.historicoLiberado.app.erro')
  }
}

watch(
  () => props.tutorId,
  () => {
    tela.value = 'lista'
    confirmando.value = null
    petId.value = pets.value[0]?.id ?? null
    void recarregar()
  },
  { immediate: true },
)

watch(petId, () => {
  confirmando.value = null
  void recarregar()
})

/* A clínica abriu ou recebeu: o celular busca, como o push faria. */
watch(
  () => historicoStore.versao,
  () => void recarregar(),
)

// ------------------------------------------------------------------ encerrar

async function encerrar(acesso: AcessoNoCelular) {
  encerrando.value = true

  try {
    await historicoDoResponsavel.encerrar(props.tutorId, acesso.id)
    confirmando.value = null
    await recarregar()
    emit('mudou')
  } catch {
    erro.value = t('clinico.historicoLiberado.app.erro')
  } finally {
    encerrando.value = false
  }
}

function quemTemAcesso(acesso: AcessoNoCelular): string {
  return (
    acesso.parceiroNome ?? t('clinico.historicoLiberado.app.aguardando', { codigo: acesso.codigo })
  )
}

// ------------------------------------------------------------------ liberar

const categorias = ref<CategoriaDoHistorico[]>([...CATEGORIAS_PADRAO])
const prazo = ref<number>(30)
const liberando = ref(false)
const gerado = ref<AcessoNoCelular | null>(null)

const opcoesDePrazo = computed(() =>
  PRAZOS_DO_ACESSO.map((dias) => ({
    valor: dias,
    rotulo: t(`clinico.historicoLiberado.app.prazos.${dias}`),
  })),
)

const ate = computed(() => formato.dataCurtaComAno(addDays(clinicClock.today(), prazo.value)))

function abrirLiberar() {
  categorias.value = [...CATEGORIAS_PADRAO]
  prazo.value = 30
  tela.value = 'liberar'
}

async function liberar() {
  if (!petId.value || categorias.value.length === 0) {
    return
  }

  liberando.value = true

  try {
    gerado.value = await historicoDoResponsavel.liberar(
      props.tutorId,
      petId.value,
      categorias.value,
      prazo.value,
    )
    tela.value = 'codigo'
    await recarregar()
    emit('mudou')
  } catch {
    erro.value = t('clinico.historicoLiberado.app.erro')
  } finally {
    liberando.value = false
  }
}

async function verQuemAbriu() {
  await recarregar()
  tela.value = 'quemAbriu'
}
</script>

<template>
  <div class="celular">
    <div class="celular__moldura">
      <!-- O aviso da ficha de emergência aberta: chega na hora, com nome e conselho. -->
      <Transition name="aviso">
        <div
          v-if="avisoRecente && avisoRecente.id !== avisoFechado"
          :key="avisoRecente.id"
          class="push"
          role="status"
        >
          <span class="push__marca" aria-hidden="true"><i class="ph ph-first-aid-kit" /></span>
          <span class="push__texto">
            <small>PetJourney</small>
            <strong>{{ t('clinico.historicoLiberado.app.push.titulo') }}</strong>
            <span>
              {{
                t('clinico.historicoLiberado.app.push.corpo', {
                  nome: avisoRecente.abertura.profissionalNome,
                  conselho: avisoRecente.abertura.conselho,
                  pet: avisoRecente.petNome,
                  hora: formato.hora(avisoRecente.em),
                  clinica: avisoRecente.abertura.parceiroNome,
                })
              }}
            </span>
          </span>
          <Button
            icon="ph ph-x"
            severity="secondary"
            text
            rounded
            size="small"
            class="push__fechar"
            :aria-label="t('clinico.historicoLiberado.app.push.fechar')"
            @click="avisoFechado = avisoRecente.id"
          />
        </div>
      </Transition>

      <header class="topo">
        <Button
          v-if="tela !== 'lista'"
          icon="ph ph-caret-left"
          severity="secondary"
          text
          rounded
          size="small"
          :aria-label="t('clinico.historicoLiberado.app.voltar')"
          @click="tela = 'lista'"
        />
        <span v-if="pet" class="topo__avatar">
          <PetAvatar :nome="pet.nome" :iniciais="pet.iniciais" :foto-url="pet.fotoUrl" />
        </span>
        <span class="topo__identidade">
          <strong>
            {{
              tela === 'liberar' || tela === 'codigo'
                ? t('clinico.historicoLiberado.app.liberarTitulo')
                : tela === 'quemAbriu'
                  ? t('clinico.historicoLiberado.app.quemAbriu.titulo')
                  : t('clinico.historicoLiberado.app.titulo')
            }}
          </strong>
          <span v-if="pet">{{ t('clinico.historicoLiberado.app.de', { pet: pet.nome }) }}</span>
        </span>
      </header>

      <SelectButton
        v-if="pets.length > 1 && tela === 'lista'"
        v-model="petId"
        :options="pets"
        option-label="nome"
        option-value="id"
        :allow-empty="false"
        class="pets"
      />

      <p v-if="erro" class="nota nota--erro" role="alert">{{ erro }}</p>

      <div class="tela">
        <!-- ------------------------------------------------ quem vê agora -->
        <template v-if="tela === 'lista'">
          <section class="secao">
            <h3 class="secao__titulo">{{ t('clinico.historicoLiberado.app.comAcesso') }}</h3>
            <p v-if="comAcesso.length === 0" class="nota">
              {{ t('clinico.historicoLiberado.app.ninguem') }}
            </p>
            <article v-for="acesso in comAcesso" :key="acesso.id" class="acesso">
              <div class="acesso__cabeca">
                <strong>{{ quemTemAcesso(acesso) }}</strong>
                <span v-if="acesso.estado === 'aguardando'" class="ui-selo ui-selo--contorno">
                  {{ t('clinico.historicoLiberado.app.esperando') }}
                </span>
              </div>
              <span class="acesso__linha">
                {{
                  t('clinico.historicoLiberado.app.ve', {
                    lista: rotulos.categorias(acesso.categorias),
                  })
                }}
              </span>
              <span class="acesso__linha">
                {{
                  t('clinico.historicoLiberado.app.periodo', {
                    desde: rotulos.data(acesso.liberadoEm),
                    ate: rotulos.data(acesso.expiraEm),
                  })
                }}
              </span>
              <template v-if="acesso.estado === 'ativo'">
                <Button
                  v-if="acesso.aberturas > 0"
                  type="button"
                  link
                  class="acesso__abriu"
                  :label="
                    t(
                      'clinico.historicoLiberado.app.aberturas',
                      { n: acesso.aberturas },
                      acesso.aberturas,
                    )
                  "
                  @click="verQuemAbriu"
                />
                <span v-else class="acesso__linha">{{
                  t('clinico.historicoLiberado.app.ninguemAbriu')
                }}</span>
              </template>

              <!-- Segundo toque: a confirmação mora na própria linha, com o que acontece depois. -->
              <div v-if="confirmando === acesso.id" class="confirmar" role="group">
                <p>
                  {{
                    t('clinico.historicoLiberado.app.confirmar.corpo', {
                      clinica: quemTemAcesso(acesso),
                      pet: acesso.petNome,
                    })
                  }}
                </p>
                <div class="confirmar__acoes">
                  <Button
                    type="button"
                    severity="danger"
                    size="small"
                    :label="t('clinico.historicoLiberado.app.confirmar.sim')"
                    :loading="encerrando"
                    @click="encerrar(acesso)"
                  />
                  <Button
                    type="button"
                    severity="secondary"
                    outlined
                    size="small"
                    :label="t('clinico.historicoLiberado.app.confirmar.nao')"
                    :disabled="encerrando"
                    @click="confirmando = null"
                  />
                </div>
              </div>
              <Button
                v-else
                type="button"
                severity="secondary"
                outlined
                size="small"
                icon="ph ph-prohibit"
                class="acesso__encerrar"
                :label="t('clinico.historicoLiberado.app.encerrar')"
                @click="confirmando = acesso.id"
              />
            </article>
          </section>

          <section v-if="semAcesso.length" class="secao">
            <h3 class="secao__titulo">{{ t('clinico.historicoLiberado.app.semAcesso') }}</h3>
            <article v-for="acesso in semAcesso" :key="acesso.id" class="acesso acesso--passado">
              <strong>{{ quemTemAcesso(acesso) }}</strong>
              <span class="acesso__linha">
                {{
                  acesso.estado === 'encerrado'
                    ? t('clinico.historicoLiberado.app.encerradoEm', {
                        data: rotulos.data(acesso.encerradoEm ?? acesso.expiraEm),
                      })
                    : t('clinico.historicoLiberado.app.venceuEm', {
                        data: rotulos.data(acesso.expiraEm),
                      })
                }}
              </span>
            </article>
          </section>

          <Button
            v-if="emergencias > 0"
            type="button"
            link
            icon="ph ph-first-aid-kit"
            class="emergencias"
            :label="t('clinico.historicoLiberado.app.emergencias', { n: emergencias }, emergencias)"
            @click="verQuemAbriu"
          />
        </template>

        <!-- ------------------------------------------------ liberar -->
        <template v-else-if="tela === 'liberar'">
          <section class="secao">
            <h3 class="secao__titulo">{{ t('clinico.historicoLiberado.app.oQue') }}</h3>
            <label v-for="categoria in CATEGORIAS_DO_HISTORICO" :key="categoria" class="marcar">
              <Checkbox v-model="categorias" :value="categoria" />
              <span>{{ rotulos.categoria(categoria) }}</span>
            </label>
            <p v-if="categorias.length === 0" class="nota nota--erro" role="status">
              {{ t('clinico.historicoLiberado.app.nenhumaCategoria') }}
            </p>
          </section>

          <section class="secao">
            <h3 class="secao__titulo">{{ t('clinico.historicoLiberado.app.prazo') }}</h3>
            <SelectButton
              v-model="prazo"
              :options="opcoesDePrazo"
              option-label="rotulo"
              option-value="valor"
              :allow-empty="false"
              class="prazos"
            />
          </section>

          <p class="consentimento">
            <i class="ph ph-info" aria-hidden="true" />
            {{ t('clinico.historicoLiberado.app.comoFunciona', { data: ate }) }}
          </p>

          <Button
            type="button"
            icon="ph ph-key"
            :label="t('clinico.historicoLiberado.app.gerar')"
            :disabled="categorias.length === 0"
            :loading="liberando"
            @click="liberar"
          />
        </template>

        <!-- ------------------------------------------------ o código -->
        <template v-else-if="tela === 'codigo' && gerado">
          <section class="codigo">
            <span class="codigo__rotulo">{{ t('clinico.historicoLiberado.app.codigo') }}</span>
            <strong class="codigo__valor">{{ gerado.codigo }}</strong>
            <p class="nota">
              {{
                t('clinico.historicoLiberado.app.codigoAjuda', {
                  data: rotulos.data(gerado.expiraEm),
                })
              }}
            </p>
          </section>
          <Button
            type="button"
            :label="t('clinico.historicoLiberado.app.pronto')"
            @click="tela = 'lista'"
          />
        </template>

        <!-- ------------------------------------------------ quem abriu -->
        <template v-else-if="tela === 'quemAbriu'">
          <p v-if="aberturas.length === 0" class="nota">
            {{ t('clinico.historicoLiberado.app.quemAbriu.vazio') }}
          </p>
          <ul class="aberturas">
            <li v-for="abertura in aberturas" :key="abertura.id" class="abertura">
              <i
                :class="abertura.canal === 'EMERGENCIA' ? 'ph ph-first-aid-kit' : 'ph ph-eye'"
                aria-hidden="true"
              />
              <span class="abertura__texto">
                <strong>{{ abertura.profissionalNome }} · {{ abertura.conselho }}</strong>
                <span>{{ abertura.parceiroNome }}</span>
                <span>{{ rotulos.oQueAbriu(abertura) }} · {{ formato.relativo(abertura.em) }}</span>
              </span>
            </li>
          </ul>
        </template>
      </div>

      <Button
        v-if="tela === 'lista' && pet"
        type="button"
        icon="ph ph-share-network"
        class="liberar"
        :label="t('clinico.historicoLiberado.app.liberar')"
        @click="abrirLiberar"
      />
    </div>
  </div>
</template>

<style scoped>
.celular {
  display: flex;
  justify-content: center;
}

/* O aparelho: o mesmo desenho dos outros celulares da prévia. */
.celular__moldura {
  position: relative;
  display: flex;
  overflow: hidden;
  width: min(22rem, 100%);
  height: min(44rem, calc(100vh - 13rem));
  min-height: 30rem;
  flex-direction: column;
  padding: 14px;
  border: 1px solid var(--linha-forte);
  border-radius: 28px;
  gap: 12px;
  background: var(--superficie-3);
}

/* ------------------------------------------------------------------ aviso */

.push {
  display: flex;
  flex: 0 0 auto;
  align-items: flex-start;
  padding: 10px 8px 10px 12px;
  border: 1px solid var(--linha);
  border-radius: 16px;
  background: var(--superficie);
  box-shadow: var(--sombra-2);
  gap: 10px;
}

.push__fechar {
  flex: 0 0 auto;
  margin-inline-start: auto;
}

.push__marca {
  display: grid;
  width: 28px;
  height: 28px;
  flex: 0 0 auto;
  border-radius: 8px;
  background: var(--musgo);
  color: var(--sobre-musgo);
  font-size: 14px;
  place-items: center;
}

.push__texto {
  display: grid;
  min-width: 0;
  gap: 1px;
  color: var(--tinta);
  font-size: 13px;
  line-height: 1.35;
}

.push__texto small {
  color: var(--tinta-3);
  font-size: 11.5px;
}

.push__texto span {
  color: var(--tinta-2);
}

.aviso-enter-active,
.aviso-leave-active {
  transition:
    opacity 180ms ease-out,
    transform 180ms ease-out;
}

.aviso-enter-from,
.aviso-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

@media (prefers-reduced-motion: reduce) {
  .aviso-enter-active,
  .aviso-leave-active {
    transition: none;
  }
}

/* ------------------------------------------------------------------ topo */

.topo {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 2px 4px;
}

.topo__avatar {
  flex: 0 0 auto;
}

.topo__identidade {
  display: grid;
  min-width: 0;
}

.topo__identidade strong {
  color: var(--tinta);
  font-size: 16px;
  font-weight: 650;
}

.topo__identidade span {
  color: var(--tinta-2);
  font-size: 13px;
}

.pets {
  align-self: start;
}

/* ------------------------------------------------------------------ miolo que rola */

.tela {
  display: grid;
  overflow-y: auto;
  flex: 1;
  align-content: start;
  gap: 14px;
  scrollbar-width: none;
}

.tela::-webkit-scrollbar {
  display: none;
}

.secao {
  display: grid;
  gap: 8px;
}

.secao__titulo {
  margin: 0;
  color: var(--tinta-2);
  font-size: 12.5px;
  font-weight: 600;
}

.acesso {
  display: grid;
  padding: 12px 14px;
  border-radius: 16px;
  background: var(--superficie);
  gap: 3px;
}

.acesso--passado {
  background: transparent;
  border: 1px dashed var(--linha);
}

.acesso__cabeca {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 8px;
}

.acesso strong {
  color: var(--tinta);
  font-size: 14.5px;
  font-weight: 650;
}

.acesso__linha {
  color: var(--tinta-2);
  font-size: 13px;
  line-height: 1.4;
}

/* O link alinha com o texto de cima: sem o respiro lateral do botão. */
.acesso .acesso__abriu.p-button {
  justify-self: start;
  padding: 2px 0;
  font-size: 13px;
}

.acesso__encerrar {
  justify-self: start;
  margin-top: 6px;
}

.tela .emergencias.p-button {
  justify-self: start;
  padding: 2px 0;
  font-size: 13px;
}

.confirmar {
  display: grid;
  margin-top: 8px;
  padding: 10px 12px;
  border-radius: 12px;
  background: var(--superficie-2);
  gap: 8px;
}

.confirmar p {
  margin: 0;
  color: var(--tinta);
  font-size: 13px;
  line-height: 1.45;
}

.confirmar__acoes {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.marcar {
  display: flex;
  align-items: center;
  color: var(--tinta);
  font-size: 14px;
  gap: 10px;
  cursor: pointer;
}

/* Os cinco prazos da API numa linha só: quebrar deixava o "30 dias" sozinho embaixo. */
/* `.celular` na frente para passar o controle segmentado do tema (`html.trilha .p-selectbutton`). */
.celular .prazos.p-selectbutton {
  flex-wrap: nowrap;
  gap: 2px;
}

.celular .prazos.p-selectbutton :deep(.p-togglebutton) {
  flex: 1 1 auto;
  min-width: 0;
}

.celular .prazos.p-selectbutton :deep(.p-togglebutton .p-togglebutton-content) {
  justify-content: center;
  padding-inline: 4px;
  white-space: nowrap;
}

.consentimento {
  display: flex;
  align-items: flex-start;
  margin: 0;
  padding: 10px 12px;
  border-radius: 12px;
  background: var(--superficie);
  color: var(--tinta);
  font-size: 13px;
  line-height: 1.45;
  gap: 8px;
}

.consentimento i {
  margin-top: 2px;
  color: var(--clinica-tinta);
}

.codigo {
  display: grid;
  justify-items: center;
  padding: 18px 14px;
  border-radius: 16px;
  background: var(--superficie);
  gap: 6px;
  text-align: center;
}

.codigo__rotulo {
  color: var(--tinta-2);
  font-size: 12.5px;
  font-weight: 600;
}

.codigo__valor {
  color: var(--tinta);
  font-family: var(--fonte-mono, ui-monospace, monospace);
  font-size: 30px;
  font-weight: 700;
  letter-spacing: 0.16em;
}

.aberturas {
  display: grid;
  margin: 0;
  padding: 0;
  list-style: none;
  gap: 8px;
}

.abertura {
  display: flex;
  align-items: flex-start;
  padding: 10px 12px;
  border-radius: 14px;
  background: var(--superficie);
  gap: 10px;
}

.abertura i {
  margin-top: 2px;
  color: var(--clinica-tinta);
}

.abertura__texto {
  display: grid;
  min-width: 0;
  color: var(--tinta-2);
  font-size: 12.5px;
  line-height: 1.4;
}

.abertura__texto strong {
  color: var(--tinta);
  font-size: 13.5px;
  font-weight: 600;
}

.nota {
  margin: 0;
  color: var(--tinta-2);
  font-size: 13px;
  line-height: 1.45;
}

.nota--erro {
  color: var(--risco-tinta);
}

.liberar {
  flex: 0 0 auto;
}
</style>
