<script setup lang="ts">
/**
 * Registrar atendimento do piloto com a Subea (Ofício 002/2026): o que a equipe do Consultório
 * Móvel faz "em cerca de 1 minuto", numa gaveta em três passos.
 * 1. **O animal**: nome, espécie, quem leva (o tutor ou uma ONG), o celular e o documento, com o
 *    aceite dos avisos (LGPD). O documento é o CPF do tutor ou o CNPJ da ONG, os dois opcionais:
 *    em branco passa; preenchido, tem de conferir.
 * 2. **O que foi feito**: castração, antirrábica, coleira, consulta, microchip. Cada um marca o
 *    próximo cuidado, que vira aviso.
 * 3. **QR Code**: o QR que o tutor leva, o botão de imprimir a etiqueta e a ficha que ele abre no
 *    celular.
 *
 * O relógio corre desde que a gaveta abre, e o aviso do fim diz quanto levou: é a prova do "1
 * minuto" na frente de quem decide. Nada é enviado: é protótipo, e o QR abre o site da PetJourney.
 */
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import InputText from 'primevue/inputtext'
import { useToast } from 'primevue/usetoast'
import { computed, nextTick, ref, watch } from 'vue'

import CadastroGaveta from '@/components/cadastro/CadastroGaveta.vue'
import { iniciais } from '@/components/cadastro/useRotulosDoCadastro'
import { imagemDoQr } from '@/components/parceiro/estabelecimento/qr-da-pagina'
import EtiquetaDoAtendimento from '@/features/saude-publica/components/EtiquetaDoAtendimento.vue'
import FichaNoCelular from '@/features/saude-publica/components/FichaNoCelular.vue'
import {
  PERIODO,
  PROCEDIMENTOS,
  proximosCuidados,
  type AtendimentoDoPiloto,
  type Procedimento,
} from '@/features/saude-publica/dados'
import { useEstadoDoPrototipo, type QuemLeva } from '@/features/saude-publica/estado'
import { SITE_PUBLICO } from '@/utils/parceiro/pagina-publica'
import { formatCnpj, isValidCnpj, stripCnpj } from '@/utils/validation/cnpj'
import { formatCpf, isValidCpf, stripCpf } from '@/utils/validation/cpf'

const aberta = defineModel<boolean>('visible', { default: false })
/** O atendimento entrou na lista: a tela abre ele, para o tutor ler o QR na frente de todos. */
const emit = defineEmits<{ registrado: [id: string] }>()

const toast = useToast()
const { registrarAtendimento } = useEstadoDoPrototipo()

const PASSOS = ['O animal', 'O que foi feito', 'QR Code']
const ESPECIES: { id: AtendimentoDoPiloto['especie']; rotulo: string; icone: string }[] = [
  { id: 'CACHORRO', rotulo: 'Cachorro', icone: 'ph ph-dog' },
  { id: 'GATO', rotulo: 'Gato', icone: 'ph ph-cat' },
]
const QUEM_LEVA: { id: QuemLeva; rotulo: string; icone: string }[] = [
  { id: 'tutor', rotulo: 'Tutor', icone: 'ph ph-user' },
  { id: 'ong', rotulo: 'ONG', icone: 'ph ph-hand-heart' },
]

const passo = ref(0)
const animal = ref('')
const especie = ref<AtendimentoDoPiloto['especie']>('CACHORRO')
const quem = ref<QuemLeva>('tutor')
/** O nome do tutor ou, quando o animal é de ONG, o nome dela. */
const tutor = ref('')
const celular = ref('')
const cpf = ref('')
const cnpj = ref('')
const aceite = ref(false)
const feitos = ref<Procedimento[]>([])
const tentou = ref(false)
/** Saiu do campo do documento: o aviso de "não confere" aparece já, sem esperar o Continuar. */
const conferirDocumento = ref(false)
const qr = ref('')
const abertaEm = ref(0)
const levou = ref('')

watch(aberta, (agora) => {
  if (!agora) return
  passo.value = 0
  animal.value = ''
  especie.value = 'CACHORRO'
  quem.value = 'tutor'
  tutor.value = ''
  celular.value = ''
  cpf.value = ''
  cnpj.value = ''
  aceite.value = false
  feitos.value = []
  tentou.value = false
  conferirDocumento.value = false
  levou.value = ''
  abertaEm.value = Date.now()
})

const deOng = computed(() => quem.value === 'ong')

/* O documento é opcional: vazio passa; preenchido, tem de conferir (dígitos verificadores). */
const erroNoCpf = computed(() =>
  !deOng.value && stripCpf(cpf.value) && !isValidCpf(cpf.value)
    ? 'Este CPF não confere. Corrija ou deixe em branco.'
    : '',
)
const erroNoCnpj = computed(() =>
  deOng.value && stripCnpj(cnpj.value) && !isValidCnpj(cnpj.value)
    ? 'Este CNPJ não confere. Corrija ou deixe em branco.'
    : '',
)
const mostrarErroDoDocumento = computed(() => tentou.value || conferirDocumento.value)

function escreverCpf(valor: string | undefined) {
  cpf.value = formatCpf(valor ?? '')
}

function escreverCnpj(valor: string | undefined) {
  cnpj.value = formatCnpj(valor ?? '')
}

function escolherQuem(id: QuemLeva) {
  quem.value = id
  conferirDocumento.value = false
}

const ultimo = computed(() => passo.value === PASSOS.length - 1)

/** O documento que não confere já fala embaixo do campo: no pé, só o resto. */
const faltasNoPe = computed(() =>
  faltas.value.filter((falta) => falta !== erroNoCpf.value && falta !== erroNoCnpj.value),
)

const faltas = computed(() => {
  if (passo.value === 0) {
    return [
      animal.value.trim() ? '' : 'Diga o nome do animal.',
      tutor.value.trim() ? '' : deOng.value ? 'Diga o nome da ONG.' : 'Diga o nome do tutor.',
      celular.value.replace(/\D/g, '').length >= 10 ? '' : 'Diga o celular com DDD.',
      deOng.value ? erroNoCnpj.value : erroNoCpf.value,
      aceite.value
        ? ''
        : deOng.value
          ? 'Confirme que a ONG aceita receber os avisos.'
          : 'Confirme que o tutor aceita receber os avisos.',
    ].filter(Boolean)
  }
  if (passo.value === 1) return feitos.value.length ? [] : ['Marque o que foi feito.']
  return []
})

function marcar(id: Procedimento) {
  feitos.value = feitos.value.includes(id)
    ? feitos.value.filter((item) => item !== id)
    : [...feitos.value, id]
}

/** Na ordem da lista, para a ficha sair igual não importa a ordem do toque. */
const feitosNaOrdem = computed(() =>
  PROCEDIMENTOS.filter((item) => feitos.value.includes(item.id)).map((item) => item.id),
)

const cuidados = computed(() => proximosCuidados(PERIODO.hoje, feitosNaOrdem.value))

function tempoDesde(inicio: number) {
  const segundos = Math.max(1, Math.round((Date.now() - inicio) / 1000))
  return `${Math.floor(segundos / 60)}:${String(segundos % 60).padStart(2, '0')}`
}

async function avancar() {
  tentou.value = true
  if (faltas.value.length) return
  tentou.value = false

  if (!ultimo.value) {
    passo.value += 1
    if (ultimo.value) {
      levou.value = tempoDesde(abertaEm.value)
      qr.value = await imagemDoQr(SITE_PUBLICO, 320).catch(() => '')
    }
    return
  }

  registrar()
}

/** Quem sai com o QR: o primeiro nome do tutor, ou a ONG pelo nome. */
const quemSai = computed(() =>
  deOng.value ? `A ONG ${tutor.value.trim()}` : tutor.value.trim().split(' ')[0],
)

function registrar() {
  const nome = animal.value.trim()
  const id = registrarAtendimento(
    {
      animal: nome,
      especie: especie.value,
      tutor: iniciais(tutor.value.trim())
        .split('')
        .map((letra) => `${letra}.`)
        .join(' '),
      data: PERIODO.hoje,
      procedimentos: feitosNaOrdem.value,
      situacao: 'nao-abriu',
      sinpatinhas: false,
    },
    deOng.value
      ? { quem: 'ong', ong: tutor.value.trim(), cnpj: stripCnpj(cnpj.value) || undefined }
      : { quem: 'tutor', cpf: stripCpf(cpf.value) || undefined },
  )

  const proximo = cuidados.value[0]
  toast.add({
    severity: 'success',
    summary: `Atendimento de ${nome} registrado em ${levou.value}`,
    detail: proximo
      ? `${quemSai.value} sai com o QR Code e recebe o aviso de ${proximo.rotulo.toLowerCase()} no celular. No protótipo, nada é enviado.`
      : `${quemSai.value} sai com o QR Code da ficha. No protótipo, nada é enviado.`,
    life: 6000,
  })
  aberta.value = false
  emit('registrado', id)
}

/* ------------------------------------------------------------------ a etiqueta impressa */

const imprimindo = ref(false)
/** O QR da etiqueta, maior que o da tela: no papel, 46 mm sem borrar. */
const qrDoPapel = ref('')

/**
 * Imprime a etiqueta (QR, animal, quem leva, próximos cuidados) pela regra de impressão do portal:
 * a etiqueta entra no `body` como `clinic-print-root` só agora e sai depois do `afterprint`. O
 * título da aba vira o nome do PDF salvo.
 */
async function imprimir() {
  if (imprimindo.value) return
  imprimindo.value = true
  qrDoPapel.value = await imagemDoQr(SITE_PUBLICO, 720).catch(() => qr.value)
  await nextTick()
  await Promise.all(
    [...document.querySelectorAll<HTMLImageElement>('.clinic-print-root img')].map((img) =>
      img.complete ? Promise.resolve() : img.decode().catch(() => undefined),
    ),
  )

  const tituloAntes = document.title
  document.title = `${animal.value.trim()} - QR Code`
  window.addEventListener(
    'afterprint',
    () => {
      document.title = tituloAntes
      imprimindo.value = false
    },
    { once: true },
  )
  window.print()
}
</script>

<template>
  <CadastroGaveta
    v-model:visible="aberta"
    titulo="Registrar atendimento"
    icone="ph ph-qr-code"
    largura="36rem"
  >
    <ol class="rat__passos" aria-label="Passos do atendimento">
      <li
        v-for="(nome, indice) in PASSOS"
        :key="nome"
        class="rat__passo"
        :class="{ 'rat__passo--feito': indice < passo, 'rat__passo--agora': indice === passo }"
      >
        <button
          type="button"
          class="rat__ir"
          :disabled="indice >= passo"
          :aria-current="indice === passo ? 'step' : undefined"
          @click="passo = indice"
        >
          <span class="rat__numero" aria-hidden="true">
            <i v-if="indice < passo" class="ph ph-check" />
            <template v-else>{{ indice + 1 }}</template>
          </span>
          <span class="rat__nome">{{ nome }}</span>
        </button>
      </li>
    </ol>

    <form id="registrar-atendimento" class="eg rat" novalidate @submit.prevent="avancar">
      <!-- 1. O animal e o tutor. -->
      <template v-if="passo === 0">
        <p class="rat__dica">
          <i class="ph ph-timer" aria-hidden="true" />
          No balcão do Consultório Móvel, o registro leva cerca de 1 minuto.
        </p>

        <section class="eg__secao">
          <label class="eg__rotulo" for="rat-animal">Nome do animal</label>
          <InputText id="rat-animal" v-model="animal" autocomplete="off" maxlength="60" />
        </section>

        <section class="eg__secao">
          <span id="rat-especie" class="eg__rotulo">Espécie</span>
          <div class="rat__especies" role="radiogroup" aria-labelledby="rat-especie">
            <button
              v-for="item in ESPECIES"
              :key="item.id"
              type="button"
              role="radio"
              class="rat__escolha"
              :class="{ 'rat__escolha--marcada': especie === item.id }"
              :aria-checked="especie === item.id"
              @click="especie = item.id"
            >
              <i :class="item.icone" aria-hidden="true" />
              {{ item.rotulo }}
            </button>
          </div>
        </section>

        <!-- Quem leva: o tutor (com CPF) ou uma ONG (com CNPJ). O documento nunca é obrigatório. -->
        <section class="eg__secao">
          <span id="rat-quem" class="eg__rotulo">Quem leva o animal</span>
          <div class="rat__especies" role="radiogroup" aria-labelledby="rat-quem">
            <button
              v-for="item in QUEM_LEVA"
              :key="item.id"
              type="button"
              role="radio"
              class="rat__escolha"
              :class="{ 'rat__escolha--marcada': quem === item.id }"
              :aria-checked="quem === item.id"
              :data-quem="item.id"
              @click="escolherQuem(item.id)"
            >
              <i :class="item.icone" aria-hidden="true" />
              {{ item.rotulo }}
            </button>
          </div>
        </section>

        <section class="eg__secao">
          <label class="eg__rotulo" for="rat-tutor">
            {{ deOng ? 'Nome da ONG' : 'Nome do tutor' }}
          </label>
          <InputText id="rat-tutor" v-model="tutor" autocomplete="off" maxlength="80" />
        </section>

        <div class="rat__dupla">
          <section class="eg__secao">
            <label class="eg__rotulo" for="rat-celular">Celular</label>
            <InputText
              id="rat-celular"
              v-model="celular"
              inputmode="tel"
              autocomplete="off"
              placeholder="(67) 99999-9999"
              maxlength="16"
            />
          </section>

          <section v-if="deOng" class="eg__secao">
            <label class="eg__rotulo" for="rat-cnpj">
              CNPJ da ONG <span class="eg__opcional">(opcional)</span>
            </label>
            <InputText
              id="rat-cnpj"
              :model-value="cnpj"
              autocomplete="off"
              autocapitalize="characters"
              placeholder="00.000.000/0000-00"
              maxlength="18"
              :invalid="mostrarErroDoDocumento && Boolean(erroNoCnpj)"
              :aria-describedby="mostrarErroDoDocumento && erroNoCnpj ? 'rat-cnpj-erro' : undefined"
              @update:model-value="escreverCnpj"
              @blur="conferirDocumento = true"
            />
            <small
              v-if="mostrarErroDoDocumento && erroNoCnpj"
              id="rat-cnpj-erro"
              class="eg__invalido"
            >
              {{ erroNoCnpj }}
            </small>
          </section>

          <section v-else class="eg__secao">
            <label class="eg__rotulo" for="rat-cpf">
              CPF do tutor <span class="eg__opcional">(opcional)</span>
            </label>
            <InputText
              id="rat-cpf"
              :model-value="cpf"
              inputmode="numeric"
              autocomplete="off"
              placeholder="000.000.000-00"
              maxlength="14"
              :invalid="mostrarErroDoDocumento && Boolean(erroNoCpf)"
              :aria-describedby="mostrarErroDoDocumento && erroNoCpf ? 'rat-cpf-erro' : undefined"
              @update:model-value="escreverCpf"
              @blur="conferirDocumento = true"
            />
            <small
              v-if="mostrarErroDoDocumento && erroNoCpf"
              id="rat-cpf-erro"
              class="eg__invalido"
            >
              {{ erroNoCpf }}
            </small>
          </section>
        </div>

        <label class="rat__aceite">
          <Checkbox v-model="aceite" binary input-id="rat-aceite" />
          <span>
            {{ deOng ? 'A ONG aceita' : 'O tutor aceita' }} receber no celular os avisos dos
            próximos cuidados. Os dados seguem a Lei nº 13.709/2018 e não são cedidos a ninguém.
          </span>
        </label>
      </template>

      <!-- 2. O que foi feito. -->
      <template v-else-if="passo === 1">
        <p class="rat__dica">Marque tudo o que foi feito. Cada cuidado com data vira um aviso.</p>
        <div class="rat__feitos" role="group" aria-label="O que foi feito">
          <button
            v-for="item in PROCEDIMENTOS"
            :key="item.id"
            type="button"
            role="checkbox"
            class="rat__feito"
            :class="{ 'rat__feito--marcado': feitos.includes(item.id) }"
            :aria-checked="feitos.includes(item.id)"
            @click="marcar(item.id)"
          >
            <span class="rat__feito-icone" aria-hidden="true"><i :class="item.icone" /></span>
            <span class="rat__feito-texto">
              <strong>{{ item.rotulo }}</strong>
              <small v-if="item.proximo">
                {{ item.proximo.rotulo }} em
                {{
                  item.proximo.dias >= 365
                    ? '1 ano'
                    : item.proximo.dias >= 30
                      ? `${Math.round(item.proximo.dias / 30)} meses`
                      : `${item.proximo.dias} dias`
                }}
              </small>
              <small v-else>Não marca cuidado</small>
            </span>
            <i
              class="rat__marca"
              :class="feitos.includes(item.id) ? 'ph ph-check-square' : 'ph ph-square'"
              aria-hidden="true"
            />
          </button>
        </div>
      </template>

      <!-- 3. O QR Code e a ficha. -->
      <template v-else>
        <section class="rat__qr" aria-labelledby="rat-qr">
          <img
            v-if="qr"
            :src="qr"
            width="132"
            height="132"
            class="rat__qr-imagem"
            alt="QR Code da ficha (exemplo)"
          />
          <span class="rat__qr-texto">
            <strong id="rat-qr">
              {{
                deOng
                  ? `Entregue o QR Code à ONG ${tutor.trim()}`
                  : `Entregue o QR Code a ${tutor.trim().split(' ')[0]}`
              }}
            </strong>
            <span>
              Impresso na etiqueta, com os próximos cuidados. Ele abre a ficha de
              {{ animal.trim() }} no celular.
            </span>
            <small>No protótipo, o QR abre o site da PetJourney.</small>
            <span class="rat__qr-acoes">
              <Button
                type="button"
                size="small"
                severity="secondary"
                outlined
                class="rat__imprimir"
                icon="ph ph-printer"
                label="Imprimir QR Code"
                :loading="imprimindo"
                @click="imprimir"
              />
              <span class="ui-selo ui-selo--ok rat__tempo">
                <i class="ph ph-timer" aria-hidden="true" />
                Registrado em {{ levou }}
              </span>
            </span>
          </span>
        </section>

        <FichaNoCelular
          :animal="animal"
          :especie="especie"
          :data="PERIODO.hoje"
          :procedimentos="feitosNaOrdem"
        />
      </template>

      <ul v-if="tentou && faltasNoPe.length" class="eg__erro rat__faltas" role="alert">
        <li v-for="falta in faltasNoPe" :key="falta">{{ falta }}</li>
      </ul>
    </form>

    <template #pe>
      <Button
        v-if="passo === 0"
        type="button"
        severity="secondary"
        outlined
        label="Cancelar"
        @click="aberta = false"
      />
      <Button
        v-else
        type="button"
        severity="secondary"
        outlined
        icon="ph ph-arrow-left"
        label="Voltar"
        @click="passo -= 1"
      />
      <Button
        type="submit"
        form="registrar-atendimento"
        :icon="ultimo ? 'ph ph-check' : passo === 1 ? 'ph ph-qr-code' : 'ph ph-arrow-right'"
        :icon-pos="ultimo || passo === 1 ? 'left' : 'right'"
        :label="ultimo ? 'Concluir atendimento' : passo === 1 ? 'Gerar QR Code' : 'Continuar'"
      />
    </template>
  </CadastroGaveta>

  <!-- Só existe durante a impressão: no papel, só ela (`clinic-print-root`). -->
  <EtiquetaDoAtendimento
    v-if="imprimindo && qrDoPapel"
    :animal="animal.trim()"
    :especie="especie"
    :data="PERIODO.hoje"
    :procedimentos="feitosNaOrdem"
    :quem="quem"
    :responsavel="tutor.trim()"
    :cpf="stripCpf(cpf)"
    :cnpj="stripCnpj(cnpj)"
    :imagem="qrDoPapel"
  />
</template>

<style scoped>
/* Os passos no alto da gaveta, no mesmo desenho da nova campanha e do cadastro de paciente. */
.rat__passos {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  list-style: none;
}

.rat__passo {
  min-width: 0;
}

.rat__passo:not(:last-child) .rat__ir::after {
  flex: 1 0 10px;
  height: 2px;
  border-radius: 2px;
  background: var(--linha);
  content: '';
}

.rat__ir {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 8px;
  padding: 2px 6px 2px 2px;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--tinta-3);
  font: inherit;
  font-size: 13.5px;
  font-weight: 600;
  cursor: default;
}

.rat__passo--feito .rat__ir {
  color: var(--tinta-2);
  cursor: pointer;
}

.rat__passo--agora .rat__ir {
  color: var(--tinta);
  font-weight: 700;
}

.rat__numero {
  display: grid;
  flex: none;
  width: 28px;
  height: 28px;
  place-items: center;
  border: 1.5px solid var(--linha);
  border-radius: 50%;
  font-size: 13px;
  font-weight: 700;
}

.rat__passo--agora .rat__numero {
  border-color: var(--p-primary-color);
  background: var(--p-primary-color);
  color: var(--p-primary-contrast-color);
}

.rat__passo--feito .rat__numero {
  border-color: color-mix(in oklab, var(--p-primary-color) 55%, var(--linha));
  background: color-mix(in oklab, var(--p-primary-color) 18%, transparent);
  color: var(--tinta);
}

.rat__nome {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rat__dica {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  color: var(--tinta-2);
  font-size: 13px;
}

.rat__dica i {
  color: var(--pets-tinta);
  font-size: 16px;
}

/* Alinhada no alto: o aviso embaixo do documento não estica o campo do lado. */
.rat__dupla {
  display: grid;
  align-items: start;
  gap: 14px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

/* Espécie e procedimentos: cartões de escolha, no desenho da gaveta da campanha. */
.rat__especies {
  display: grid;
  gap: 10px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.rat__escolha,
.rat__feito {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 11px 14px;
  border: 1.5px solid var(--linha);
  border-radius: 14px;
  background: var(--superficie);
  color: var(--tinta);
  cursor: pointer;
  font: inherit;
  font-weight: 650;
  text-align: start;
}

.rat__escolha i {
  color: var(--tinta-2);
  font-size: 20px;
}

.rat__escolha:hover,
.rat__feito:hover {
  border-color: var(--linha-media);
}

.rat__escolha:focus-visible,
.rat__feito:focus-visible {
  outline: 2px solid var(--p-primary-color);
  outline-offset: 2px;
}

.rat__escolha--marcada,
.rat__escolha--marcada:hover,
.rat__feito--marcado,
.rat__feito--marcado:hover {
  border-color: var(--pets);
  background: color-mix(in oklab, var(--pets-fundo) 35%, var(--superficie));
}

.rat__escolha--marcada i {
  color: var(--pets-tinta);
}

.rat__aceite {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  color: var(--tinta-2);
  font-size: 13px;
  line-height: 1.45;
  cursor: pointer;
}

.rat__feitos {
  display: grid;
  gap: 8px;
}

.rat__feito-icone {
  display: grid;
  width: 36px;
  height: 36px;
  flex: none;
  place-items: center;
  border-radius: 11px;
  background: var(--pets-fundo);
  color: var(--pets-tinta);
  font-size: 18px;
}

.rat__feito-texto {
  display: grid;
  flex: 1;
  min-width: 0;
  gap: 1px;
}

.rat__feito-texto small {
  color: var(--tinta-2);
  font-size: 12.5px;
  font-weight: 500;
}

.rat__marca {
  flex: none;
  color: var(--tinta-3);
  font-size: 21px;
}

.rat__feito--marcado .rat__marca {
  color: var(--pets-tinta);
}

/* O QR que o tutor leva: papel branco nos dois temas, para ler na câmera. */
.rat__qr {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 14px;
  border: 1px solid var(--linha);
  border-radius: 16px;
  background: color-mix(in oklab, var(--pets-fundo) 30%, var(--superficie));
}

.rat__qr-imagem {
  flex: none;
  padding: 6px;
  border-radius: 12px;
  background: #fff;
}

.rat__qr-texto {
  display: grid;
  justify-items: start;
  gap: 4px;
  color: var(--tinta-2);
  font-size: 13px;
  line-height: 1.45;
}

.rat__qr-texto strong {
  color: var(--tinta);
  font-size: 15px;
}

.rat__qr-texto small {
  color: var(--tinta-3);
  font-size: 12px;
}

/* Imprimir e o tempo, lado a lado embaixo do texto. O botão leva o papel por baixo: sobre o
 * cartão tingido, o contorno sozinho ficava transparente. */
.rat__qr-acoes {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 10px;
  margin-top: 6px;
}

.rat__imprimir.p-button {
  background: var(--superficie);
}

.rat__tempo {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.rat__faltas {
  display: grid;
  gap: 2px;
  margin: 0;
  padding-inline-start: 18px;
}
</style>
