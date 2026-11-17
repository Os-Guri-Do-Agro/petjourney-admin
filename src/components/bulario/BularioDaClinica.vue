<script setup lang="ts">
/**
 * Bulário pela API (E4-02, PJ-7JRYWN; guia e4 1.4 e 1.5).
 *
 * Lista à esquerda (a busca do servidor: nome, princípio, sinônimo ou indicação, com erro de
 * digitação, debounce de 250 ms), ficha à direita. Aberto com `?paciente=`, a lista vem pela
 * espécie dele, a ficha destaca a dose da espécie e, para quem prescreve (com CRMV), traz a conta
 * da dose pelo servidor.
 *
 * Hoje o bulário da PetJourney inteiro está em revisão pelo responsável técnico, e a busca traz só
 * o que a clínica acrescentou (D2): a tela diz isso, em vez de parecer quebrada.
 */
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRoute, useRouter } from 'vue-router'

import DoseDoPaciente from '@/components/bulario/DoseDoPaciente.vue'
import { lerErroDaAgenda } from '@/components/agendamentos/useFrasesDaAgenda'
import UiPagina from '@/components/ui/UiPagina.vue'
import type { PassoDoGuia } from '@/components/ui/UiPassos.vue'
import UiVazioIlustrado from '@/components/ui/UiVazioIlustrado.vue'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { ApiError } from '@/service/api'
import {
  buscarMedicamentos,
  doseDaEspecie,
  ESPECIES_DO_CATALOGO,
  type EspecieDoCatalogo,
  type Medicamento,
} from '@/service/parceiro/catalogos-service'
import { obterPaciente } from '@/service/parceiro/pacientes-service'

const { t, te } = useI18n()
const route = useRoute()
const router = useRouter()
const { store, parceiroQuery } = useParceiroPortal()

const busca = ref('')
const especie = ref<EspecieDoCatalogo | null>(null)
const classe = ref<string | null>(null)
const lista = ref<Medicamento[]>([])
const selecionadoId = ref<string | null>(null)
const carregando = ref(false)
const lido = ref(false)
const erro = ref('')
const paciente = ref<{ id: string; nome: string; especie: EspecieDoCatalogo | null } | null>(null)

const pacienteDaRota = computed(() => {
  const valor = route.query.paciente
  return typeof valor === 'string' && valor ? valor : null
})

const podeCalcular = computed(() => store.temPermissao('prontuario.escrever'))
/* Acrescentar ao catálogo: quem gere o catálogo, com a Clínica para escrever (como na Configuração). */
const podeAcrescentar = computed(
  () => Boolean(store.modulo('CLINICA')?.podeEscrever) && store.temPermissao('catalogo.gerir'),
)

function rotuloDaClasse(codigo: string) {
  const chave = `clinico.bulario.classe.${codigo.toLowerCase().replace(/_/g, '-')}`
  return te(chave) ? t(chave) : t('clinico.bulario.api.classeOutra')
}

const opcoesDeEspecie = computed(() => [
  { valor: null, rotulo: t('clinico.bulario.api.todasEspecies') },
  ...ESPECIES_DO_CATALOGO.map((valor) => ({ valor, rotulo: t(`cadastro.especie.${valor}`) })),
])

/** A classe filtra no navegador: a rota não recebe classe, e a busca devolve poucos itens. */
const opcoesDeClasse = computed(() => [
  { valor: null, rotulo: t('clinico.bulario.api.todasClasses') },
  ...[...new Set(lista.value.map((item) => item.classe))].map((valor) => ({
    valor,
    rotulo: rotuloDaClasse(valor),
  })),
])

const visiveis = computed(() =>
  classe.value ? lista.value.filter((item) => item.classe === classe.value) : lista.value,
)

const selecionado = computed(
  () => lista.value.find((item) => item.id === selecionadoId.value) ?? visiveis.value[0] ?? null,
)

/*
 * O vazio que ensina (o desenho de Acessos, 17/11/2026), dentro do cartão da lista: sem busca e sem
 * nada achado, o porquê (D2, o bulário da PetJourney em revisão) e como o bulário anda (a clínica
 * acrescenta, a busca, a ficha). Cada etapa que se faz tem o botão dela: "Acrescentar
 * medicamento" para quem gere o catálogo (abre a gaveta na Configuração) e o "Buscar", apagado até
 * haver o que achar. A ficha só se lê: sem botão. Com busca, é filtro: fica a frase curta.
 */
const passosDoBulario = computed<PassoDoGuia[]>(() => {
  const passo = (id: string, icone: string, acao?: PassoDoGuia['acao']): PassoDoGuia => ({
    id,
    icone,
    titulo: t(`clinico.bulario.api.guia.${id}.titulo`),
    texto: t(`clinico.bulario.api.guia.${id}.texto`),
    acao,
  })

  return [
    passo(
      'acrescentar',
      'ph ph-plus-circle',
      podeAcrescentar.value
        ? {
            rotulo: t('clinico.bulario.api.guia.acrescentarMedicamento'),
            icone: 'ph ph-plus',
            to: { path: '/clinica/configuracao', query: { aba: 'catalogo', novo: 'medicamentos' } },
          }
        : undefined,
    ),
    passo('buscar', 'ph ph-magnifying-glass', {
      rotulo: t('clinico.bulario.api.guia.buscarMedicamento'),
      icone: 'ph ph-magnifying-glass',
      bloqueada: true,
    }),
    passo('ficha', 'ph ph-book-open'),
  ]
})

let espera: ReturnType<typeof setTimeout> | undefined
let pedido = 0

async function procurar() {
  const numero = ++pedido
  carregando.value = true
  erro.value = ''
  try {
    const achados = await buscarMedicamentos(
      { q: busca.value, especie: especie.value },
      parceiroQuery(),
    )
    if (numero !== pedido) return
    lista.value = achados
    lido.value = true
    if (!achados.some((item) => item.id === selecionadoId.value)) selecionadoId.value = null
  } catch (err) {
    if (numero !== pedido) return
    erro.value =
      err instanceof ApiError && err.statusCode === 403
        ? t('clinico.bulario.api.semPermissao')
        : lerErroDaAgenda(err, t('clinico.bulario.api.erro')).mensagem
  } finally {
    if (numero === pedido) carregando.value = false
  }
}

watch([busca, especie], () => {
  if (espera) clearTimeout(espera)
  espera = setTimeout(() => void procurar(), 250)
})

async function carregarPaciente(id: string) {
  try {
    const lido = await obterPaciente(id, parceiroQuery())
    paciente.value = {
      id: lido.id,
      nome: lido.nome,
      especie: (ESPECIES_DO_CATALOGO as readonly string[]).includes(lido.especie)
        ? (lido.especie as EspecieDoCatalogo)
        : null,
    }
    especie.value = paciente.value.especie
  } catch {
    paciente.value = null
  }
}

function sairDoPaciente() {
  const query = { ...route.query }
  delete query.paciente
  paciente.value = null
  especie.value = null
  void router.replace({ query })
}

onMounted(async () => {
  if (pacienteDaRota.value) await carregarPaciente(pacienteDaRota.value)
  void procurar()
})

/* ------------------------------------------------------------------------------- ficha */

const doses = computed(() =>
  (selecionado.value?.doses ?? []).map((dose) => ({
    ...dose,
    doPaciente: paciente.value?.especie === dose.especie,
  })),
)

const proibidoParaOPaciente = computed(() => {
  const med = selecionado.value
  if (!med || !paciente.value?.especie) return false
  return doseDaEspecie(med, paciente.value.especie).proibido
})

function faixa(min: number, max: number) {
  return min === max ? `${min} mg/kg` : `${min} a ${max} mg/kg`
}

function apresentacao(med: Medicamento) {
  return [
    med.apresentacao,
    `${med.concentracao} mg/${t(`clinico.bulario.api.unidade.${med.unidadeApresentacao}`, 1)}`,
  ]
    .filter(Boolean)
    .join(' · ')
}

const listasDaFicha = computed(() => {
  const med = selecionado.value
  if (!med) return []
  return [
    { id: 'indicacoes', titulo: t('clinico.bulario.indicacoes'), itens: med.indicacoes },
    {
      id: 'contraindicacoes',
      titulo: t('clinico.bulario.contraindicacoes'),
      itens: med.contraindicacoes,
    },
    { id: 'efeitos', titulo: t('clinico.bulario.efeitosAdversos'), itens: med.efeitosAdversos },
    { id: 'interacoes', titulo: t('clinico.bulario.interacoes'), itens: med.interacoes },
  ].filter((lista) => lista.itens.length)
})

const resumo = computed(() =>
  paciente.value
    ? t('clinico.bulario.api.resumoPaciente', { pet: paciente.value.nome })
    : t('clinico.bulario.api.resumo'),
)
</script>

<template>
  <UiPagina :resumo="resumo" :carregando="carregando && !lido" :erro="lido ? '' : erro">
    <div class="bul">
      <!-- O paciente da consulta: a espécie dele filtra a lista e a dose sai para ele. -->
      <p v-if="paciente" class="bul__paciente ui-poco">
        <i class="ph ph-paw-print" aria-hidden="true" />
        <span>
          <strong>{{ paciente.nome }}</strong>
          <template v-if="paciente.especie">
            · {{ t(`cadastro.especie.${paciente.especie}`) }}</template
          >
        </span>
        <RouterLink class="bul__sair" :to="{ query: {} }" @click.prevent="sairDoPaciente">
          {{ t('clinico.bulario.semPaciente') }}
        </RouterLink>
      </p>

      <div class="bul__colunas">
        <section class="ui-folha ui-cartao bul__lista" aria-labelledby="bul-lista-titulo">
          <header class="ui-cartao__cabeca">
            <span class="ui-ladrilho" aria-hidden="true"><i class="ph ph-pill" /></span>
            <span class="ui-cartao__titulos">
              <h2 id="bul-lista-titulo" class="ui-cartao__titulo">
                {{ t('clinico.bulario.titulo') }}
              </h2>
            </span>
          </header>

          <div class="bul__filtros" role="search">
            <IconField>
              <InputIcon class="ph ph-magnifying-glass" />
              <InputText
                v-model="busca"
                type="search"
                :maxlength="60"
                :placeholder="t('clinico.bulario.buscaPlaceholder')"
                :aria-label="t('clinico.bulario.buscaPlaceholder')"
              />
            </IconField>
            <div class="bul__selects">
              <Select
                v-model="especie"
                :options="opcoesDeEspecie"
                option-label="rotulo"
                option-value="valor"
                :placeholder="t('clinico.bulario.api.todasEspecies')"
                :aria-label="t('clinico.bulario.filtro.especie')"
              />
              <Select
                v-model="classe"
                :options="opcoesDeClasse"
                option-label="rotulo"
                option-value="valor"
                :placeholder="t('clinico.bulario.api.todasClasses')"
                :aria-label="t('clinico.bulario.filtro.classe')"
              />
            </div>
          </div>

          <p v-if="erro" class="bul__erro" role="alert">{{ erro }}</p>

          <ul v-if="visiveis.length" class="ui-lista" :aria-busy="carregando">
            <li v-for="item in visiveis" :key="item.id">
              <RouterLink
                class="ui-linha bul__item"
                :class="{ 'bul__item--atual': selecionado?.id === item.id }"
                :to="{ query: { ...$route.query } }"
                :aria-current="selecionado?.id === item.id || undefined"
                @click.prevent="selecionadoId = item.id"
              >
                <span class="ui-linha__texto">
                  <strong class="ui-linha__titulo bul__nome">
                    {{ item.nome }}
                    <span v-if="item.origem === 'PARCEIRO'" class="ui-selo">{{
                      t('clinico.bulario.api.daClinica')
                    }}</span>
                    <span v-if="item.controle !== 'NENHUM'" class="ui-selo ui-selo--atencao">{{
                      t('clinico.bulario.controlado')
                    }}</span>
                  </strong>
                  <span class="ui-linha__meta"
                    >{{ item.principioAtivo }} · {{ apresentacao(item) }}</span
                  >
                </span>
              </RouterLink>
            </li>
          </ul>

          <!-- Nada achado: com busca, a frase de sempre; sem busca, o porquê (D2) e o guia. -->
          <p v-else-if="lido && !carregando && busca.trim()" class="bul__vazio">
            {{ t('clinico.bulario.semResultado') }}
          </p>
          <UiVazioIlustrado
            v-else-if="lido && !carregando && !erro"
            aninhado
            icone="ph ph-pill"
            :titulo="t('clinico.bulario.api.vazioTitulo')"
            :texto="t('clinico.bulario.api.emRevisao')"
            :guia-titulo="t('clinico.bulario.api.guia.titulo')"
            :passos="passosDoBulario"
          />
        </section>

        <section class="ui-folha ui-cartao bul__ficha" aria-live="polite">
          <template v-if="selecionado">
            <!-- Os selos vão na linha do nome, como na lista: a mesma leitura dos dois lados. -->
            <header class="ui-cartao__cabeca">
              <span class="ui-cartao__titulos">
                <h2 class="ui-cartao__titulo bul__titulo">
                  {{ selecionado.nome }}
                  <span v-if="selecionado.origem === 'PARCEIRO'" class="ui-selo">{{
                    t('clinico.bulario.api.daClinica')
                  }}</span>
                  <span v-else-if="!selecionado.revisado" class="ui-selo">{{
                    t('clinico.bulario.api.naoRevisado')
                  }}</span>
                  <span v-if="selecionado.controle !== 'NENHUM'" class="ui-selo ui-selo--atencao">
                    {{ t(`clinico.bulario.api.controle.${selecionado.controle}`) }}
                    <template v-if="selecionado.listaControle">
                      · {{ selecionado.listaControle }}</template
                    >
                  </span>
                  <span v-if="selecionado.manipulado" class="ui-selo">{{
                    t('clinico.bulario.api.manipulado')
                  }}</span>
                </h2>
                <p class="ui-cartao__descricao">
                  {{ selecionado.principioAtivo }} · {{ apresentacao(selecionado) }} ·
                  {{ rotuloDaClasse(selecionado.classe) }}
                </p>
              </span>
            </header>

            <div class="bul__miolo">
              <p v-if="proibidoParaOPaciente" class="bul__proibido" role="alert">
                <i class="ph ph-prohibit" aria-hidden="true" />
                {{ t('clinico.bulario.doseProibida') }}
              </p>

              <dl class="bul__dados">
                <div>
                  <dt>{{ t('clinico.bulario.api.doseUsual') }}</dt>
                  <dd class="ui-num">
                    {{ faixa(selecionado.doseUsualMgKg.min, selecionado.doseUsualMgKg.max) }}
                  </dd>
                </div>
                <div>
                  <dt>{{ t('clinico.bulario.vias') }}</dt>
                  <dd>
                    {{
                      selecionado.viasPermitidas
                        .map((via) => t(`clinico.bulario.api.via.${via}`))
                        .join(', ')
                    }}
                  </dd>
                </div>
              </dl>

              <!-- A dose de cada espécie, com a do paciente em destaque. -->
              <div v-if="doses.length" class="bul__tabela">
                <h3>{{ t('clinico.bulario.doseTitulo') }}</h3>
                <table>
                  <thead>
                    <tr>
                      <th scope="col">{{ t('clinico.bulario.doseEspecie') }}</th>
                      <th scope="col">{{ t('clinico.bulario.doseFaixa') }}</th>
                      <th scope="col">{{ t('clinico.bulario.doseIntervalo') }}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      v-for="dose in doses"
                      :key="dose.id"
                      :class="{ 'bul__dose--paciente': dose.doPaciente }"
                    >
                      <th scope="row">
                        {{ t(`cadastro.especie.${dose.especie}`) }}
                        <small v-if="dose.doPaciente">{{
                          t('clinico.bulario.destePaciente')
                        }}</small>
                      </th>
                      <td class="ui-num">
                        <template v-if="dose.proibido">{{
                          t('clinico.bulario.doseProibida')
                        }}</template>
                        <template v-else>{{ faixa(dose.mgKgMin, dose.mgKgMax) }}</template>
                        <small v-if="dose.nota">{{ dose.nota }}</small>
                      </td>
                      <td class="ui-num">
                        {{ t('clinico.bulario.cadaHoras', { horas: dose.frequenciaHoras }) }}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <DoseDoPaciente
                v-if="paciente && podeCalcular && !proibidoParaOPaciente"
                :medicamento="selecionado"
                :paciente="paciente"
              />

              <div v-for="bloco in listasDaFicha" :key="bloco.id" class="bul__bloco">
                <h3>{{ bloco.titulo }}</h3>
                <ul>
                  <li v-for="(item, indice) in bloco.itens" :key="indice">{{ item }}</li>
                </ul>
              </div>

              <p v-if="selecionado.observacao" class="bul__obs">{{ selecionado.observacao }}</p>
              <p class="bul__isencao">{{ t('clinico.bulario.isencao') }}</p>
            </div>
          </template>
          <p v-else class="bul__escolha">{{ t('clinico.bulario.escolha') }}</p>
        </section>
      </div>
    </div>
  </UiPagina>
</template>

<style scoped>
.bul {
  display: grid;
  gap: 20px;
}

.bul__paciente {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
  margin: 0;
  padding: 10px 14px;
  color: var(--tinta);
  font-size: 14px;
}

.bul__sair {
  margin-inline-start: auto;
  color: var(--tinta);
  font-weight: 600;
  text-decoration: underline;
  text-underline-offset: 3px;
}

/* Lista e ficha na mesma largura: os dois filtros cabem lado a lado sem cortar o texto. */
.bul__colunas {
  display: grid;
  align-items: start;
  gap: 20px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

/*
 * O cartão já dá o respiro dos lados: os filtros alinham com o título, e o respiro de cima afasta
 * a busca do fio do cabeçalho.
 */
.bul__filtros {
  display: grid;
  gap: 10px;
  padding: 16px 0 12px;
}

/* Lado a lado quando os dois cabem inteiros ("Todas as espécies"); senão, um embaixo do outro. */
.bul__selects {
  display: grid;
  gap: 10px;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 228px), 1fr));
}

.bul__filtros :deep(.p-iconfield),
.bul__filtros :deep(.p-inputtext),
.bul__filtros :deep(.p-select) {
  width: 100%;
}

.bul__item--atual {
  background: var(--superficie-2);
}

.bul__nome {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

/* Na lista, o texto alinha com o das linhas (que têm 10 px por dentro). */
.bul__erro,
.bul__vazio,
.bul__escolha {
  margin: 0;
  padding: 8px 10px 0;
  color: var(--tinta-2);
  font-size: 13.5px;
}

.bul__escolha {
  padding: 0;
}

.bul__erro {
  color: var(--risco-tinta);
}

.bul__ficha {
  position: sticky;
  top: 16px;
}

.bul__titulo {
  flex-wrap: wrap;
  gap: 6px 8px;
}

.bul__miolo {
  display: grid;
  gap: 18px;
  padding-top: 16px;
}

.bul__proibido {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  color: var(--risco-tinta);
  font-weight: 600;
}

.bul__dados {
  display: grid;
  gap: 10px 16px;
  margin: 0;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.bul__dados div {
  display: grid;
  gap: 2px;
}

.bul__dados dt {
  color: var(--tinta-2);
  font-size: 12.5px;
}

.bul__dados dd {
  margin: 0;
  color: var(--tinta);
  font-size: 14px;
}

.bul__tabela h3,
.bul__bloco h3 {
  margin: 0 0 8px;
  color: var(--tinta);
  font-size: 14px;
  font-weight: 650;
}

/* A tabela na largura da ficha: o texto e os fios alinham com o título e a régua de cima. */
.bul__tabela table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13.5px;
}

.bul__tabela th,
.bul__tabela td {
  padding: 8px 12px 8px 0;
  border-bottom: 1px solid var(--linha-suave);
  color: var(--tinta);
  text-align: start;
  vertical-align: top;
}

.bul__tabela thead th {
  color: var(--tinta-2);
  font-size: 12.5px;
  font-weight: 600;
}

.bul__tabela :is(th, td):last-child {
  padding-inline-end: 0;
  white-space: nowrap;
}

.bul__tabela small {
  display: block;
  color: var(--tinta-2);
  font-size: 12px;
}

/* A linha da espécie do paciente ganha fundo que passa 10 px para cada lado, sem mexer no texto. */
.bul__dose--paciente > * {
  background: var(--superficie-2);
}

.bul__dose--paciente > :first-child {
  box-shadow: -10px 0 0 var(--superficie-2);
}

.bul__dose--paciente > :last-child {
  box-shadow: 10px 0 0 var(--superficie-2);
}

.bul__dose--paciente > :first-child:dir(rtl) {
  box-shadow: 10px 0 0 var(--superficie-2);
}

.bul__dose--paciente > :last-child:dir(rtl) {
  box-shadow: -10px 0 0 var(--superficie-2);
}

/* Marcador pendurado: a bolinha alinha com o título do bloco e o texto fica logo depois. */
.bul__bloco ul {
  display: grid;
  gap: 4px;
  margin: 0;
  padding-inline-start: 16px;
  color: var(--tinta);
  font-size: 13.5px;
  line-height: 1.45;
  list-style: disc;
}

.bul__bloco li::marker {
  color: var(--tinta-3);
}

.bul__obs,
.bul__isencao {
  margin: 0;
  color: var(--tinta-2);
  font-size: 12.5px;
}

@media (max-width: 1100px) {
  .bul__colunas {
    grid-template-columns: minmax(0, 1fr);
  }

  .bul__ficha {
    position: static;
  }
}
</style>
