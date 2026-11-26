<script setup lang="ts">
/**
 * A ficha do animal da ONG pela API (PJ-TJ07TW, guia 2.3 e 2.5 item 4).
 *
 * Duas colunas. À esquerda, o animal: a identidade com a foto e o bloco "Saúde" (vacinas,
 * vermífugos e pesos, com adicionar e remover e a próxima dose opcional). À direita, os convites de
 * adoção e as duas observações, com o destino de cada uma no rótulo.
 *
 * - Em cuidado: tudo se edita (quem escreve), e "Entregar para adoção" gera o convite (quem entrega).
 * - Entregue: tudo somente leitura, com "O que foi entregue em <data>": a fotografia que a ONG
 *   guardou (identidade e saúde da entrega), o primeiro nome que ela anotou e "Registrar retorno".
 *   Nada do pet depois da entrega aparece, nem o id dele.
 * - Encerrada: somente leitura, com o motivo.
 *
 * Ficha de outra ONG e id que não existe dão o mesmo 403: a tela diz "não encontramos".
 */
import Button from 'primevue/button'
import Menu from 'primevue/menu'
import { useToast } from 'primevue/usetoast'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRouter } from 'vue-router'

import { iniciais, useRotulosDoCadastro } from '@/components/cadastro/useRotulosDoCadastro'
import AnimalGaveta from '@/components/ong/AnimalGaveta.vue'
import ConviteDeAdocaoGaveta from '@/components/ong/ConviteDeAdocaoGaveta.vue'
import ConvitesDoAnimal from '@/components/ong/ConvitesDoAnimal.vue'
import EncerrarGaveta from '@/components/ong/EncerrarGaveta.vue'
import RegistroDeSaudeGaveta from '@/components/ong/RegistroDeSaudeGaveta.vue'
import RetornoGaveta from '@/components/ong/RetornoGaveta.vue'
import { diaDoInstante, lerErroDaOng, temConviteValendo } from '@/components/ong/regras-da-ong'
import { useAcessoDaOng } from '@/components/ong/useAcessoDaOng'
import UiPagina from '@/components/ui/UiPagina.vue'
import UiVazioIlustrado from '@/components/ui/UiVazioIlustrado.vue'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import PetAvatar from '@/features/hotel/components/base/PetAvatar.vue'
import {
  enviarFotoDoAnimal,
  FOTO_DO_ANIMAL_MAX,
  FOTO_DO_ANIMAL_TIPOS,
  obterAnimalDaOng,
  registrarRetorno,
  removerRegistro,
  type AnimalDaOng,
  type ConviteDaOng,
  type TipoDeRegistro,
} from '@/service/parceiro/ong-service'
import { ESPECIE_DO_AVATAR } from '@/utils/parceiro/acesso-na-lista'

const props = defineProps<{ animalId: string }>()

const { t } = useI18n()
const toast = useToast()
const router = useRouter()
const rotulos = useRotulosDoCadastro()
const { parceiroQuery } = useParceiroPortal()
const { podeEscrever, podeEntregar } = useAcessoDaOng()

const animal = ref<AnimalDaOng | null>(null)
const carregando = ref(true)
const erro = ref('')
const semAcesso = ref(false)

async function carregar() {
  carregando.value = true
  erro.value = ''

  try {
    animal.value = await obterAnimalDaOng(props.animalId, parceiroQuery())
    semAcesso.value = false
  } catch (err) {
    const lido = lerErroDaOng(err, t, t('ong.erros.carregar'))

    if (lido.codigo === 'OWNERSHIP_FORBIDDEN') {
      semAcesso.value = true
      animal.value = null
    } else {
      erro.value = lido.mensagem
    }
  } finally {
    carregando.value = false
  }
}

watch(
  () => props.animalId,
  () => void carregar(),
  { immediate: true },
)

const emCuidado = computed(() => animal.value?.status === 'EM_CUIDADO')
const entregue = computed(() => animal.value?.status === 'ENTREGUE')
const editavel = computed(() => emCuidado.value && podeEscrever.value)

const resumo = computed(() => {
  const atual = animal.value
  if (!atual) return ''

  if (atual.status === 'ENTREGUE' && atual.entregueEm) {
    return t('ong.ficha.resumo.ENTREGUE', { data: diaDoInstante(atual.entregueEm, rotulos.intl()) })
  }

  if (atual.status === 'ENCERRADO') {
    return t('ong.ficha.resumo.ENCERRADO', {
      data: atual.encerradoEm ? diaDoInstante(atual.encerradoEm, rotulos.intl()) : '',
      motivo: atual.encerradoMotivo ? t(`ong.encerramento.${atual.encerradoMotivo}`) : '',
    })
  }

  return t('ong.ficha.resumo.EM_CUIDADO', { data: rotulos.dia(atual.entradaEm) })
})

/* ------------------------------------------------------------------------ a identidade */

/** A identidade de agora (em cuidado, encerrada) ou a da entrega (entregue), num formato só. */
const identidade = computed(() => {
  const atual = animal.value
  if (!atual) return null

  if (atual.status === 'ENTREGUE') {
    const foto = atual.entregue?.identidade

    return {
      especie: foto?.especie ?? atual.especie,
      especieOutra: foto?.especieOutra ?? atual.especieOutra,
      sexo: foto?.sexo ?? atual.sexo,
      nascimento: foto?.nascimento ?? atual.nascimento,
      raca: foto?.raca ?? null,
      cor: foto?.cor ?? null,
      castrado: foto?.castrado ?? null,
      porte: foto?.porte ?? null,
      microchip: foto?.microchip ?? null,
      avisosDeManejo: [] as string[],
      fotoUrl: null as string | null,
    }
  }

  return {
    especie: atual.especie,
    especieOutra: atual.especieOutra,
    sexo: atual.sexo,
    nascimento: atual.nascimento,
    raca: atual.identidade?.raca ?? null,
    cor: atual.identidade?.cor ?? null,
    castrado: atual.identidade?.castrado ?? null,
    porte: atual.identidade?.porte ?? null,
    microchip: atual.identidade?.microchip ?? null,
    avisosDeManejo: [...(atual.identidade?.avisosDeManejo ?? [])] as string[],
    fotoUrl: atual.identidade?.fotoUrl ?? atual.fotoUrl,
  }
})

const dados = computed(() => {
  const atual = animal.value
  const id = identidade.value
  if (!atual || !id) return []

  const castrado = id.castrado === null ? '' : id.castrado ? t('cadastro.sim') : t('cadastro.nao')
  const nascimento = id.nascimento
    ? [rotulos.dia(id.nascimento), rotulos.idade(id.nascimento)].filter(Boolean).join(' · ')
    : ''

  return [
    { rotulo: t('cadastro.campos.especie'), valor: rotulos.especie(id) },
    { rotulo: t('cadastro.campos.sexo'), valor: id.sexo ? t(`cadastro.sexo.${id.sexo}`) : '' },
    { rotulo: t('cadastro.campos.nascimento'), valor: nascimento, num: true },
    { rotulo: t('cadastro.campos.raca'), valor: id.raca ?? '' },
    { rotulo: t('ong.campos.cor'), valor: id.cor ?? '' },
    { rotulo: t('cadastro.campos.castrado'), valor: castrado },
    { rotulo: t('cadastro.campos.porte'), valor: id.porte ? t(`cadastro.porte.${id.porte}`) : '' },
    { rotulo: t('cadastro.campos.microchip'), valor: id.microchip ?? '', num: true },
    { rotulo: t('ong.campos.entradaEm'), valor: rotulos.dia(atual.entradaEm), num: true },
    { rotulo: t('ong.campos.origem'), valor: t(`ong.origem.${atual.origemDaEntrada}`) },
  ]
})

/* ---------------------------------------------------------------------------- a saúde */

type ItemDaSaude = { id: string | null; titulo: string; meta: string }

const saude = computed<Record<TipoDeRegistro, ItemDaSaude[]>>(() => {
  const atual = animal.value
  const vazio = { vacinas: [], vermifugos: [], pesos: [] }
  if (!atual) return vazio

  const fonte = atual.status === 'ENTREGUE' ? atual.entregue : atual.saude
  if (!fonte) return vazio

  const dose = (valor: number | null | undefined, total?: number | null) =>
    valor
      ? total
        ? t('ong.saude.dose', { dose: valor, total })
        : t('ong.saude.doseSo', { dose: valor })
      : ''

  return {
    vacinas: fonte.vacinas.map((vacina) => ({
      id: 'id' in vacina ? (vacina.id as string) : null,
      titulo: vacina.nome,
      meta: [
        vacina.aplicadaEm
          ? t('ong.saude.aplicadaEm', { data: rotulos.dia(vacina.aplicadaEm) })
          : '',
        dose(vacina.dose, 'dosesNaSerie' in vacina ? (vacina.dosesNaSerie as number | null) : null),
        vacina.lote ? t('ong.saude.lote', { lote: vacina.lote }) : '',
        vacina.fabricante ?? '',
      ]
        .filter(Boolean)
        .join(' · '),
    })),
    vermifugos: fonte.vermifugos.map((vermifugo) => ({
      id: 'id' in vermifugo ? (vermifugo.id as string) : null,
      titulo: vermifugo.nome,
      meta: t('ong.saude.administradoEm', { data: rotulos.dia(vermifugo.administradoEm) }),
    })),
    pesos: fonte.pesos.map((peso) => ({
      id: 'id' in peso ? (peso.id as string) : null,
      titulo: rotulos.peso(peso.pesoKg),
      meta: rotulos.dia(peso.data),
    })),
  }
})

const TIPOS: TipoDeRegistro[] = ['vacinas', 'vermifugos', 'pesos']

const ICONE_DO_TIPO: Record<TipoDeRegistro, string> = {
  vacinas: 'ph ph-syringe',
  vermifugos: 'ph ph-pill',
  pesos: 'ph ph-scales',
}

const registroAberto = ref(false)
const tipoDoRegistro = ref<TipoDeRegistro>('vacinas')

function adicionar(tipo: TipoDeRegistro) {
  tipoDoRegistro.value = tipo
  registroAberto.value = true
}

const confirmandoRemocao = ref<string | null>(null)
const removendo = ref<string | null>(null)

async function remover(tipo: TipoDeRegistro, registroId: string) {
  const atual = animal.value
  if (!atual) return

  removendo.value = registroId

  try {
    await removerRegistro(atual.id, tipo, registroId, parceiroQuery())
    toast.add({ severity: 'success', summary: t('ong.saude.removido'), life: 3000 })
    await carregar()
  } catch (err) {
    const lido = lerErroDaOng(err, t, t('ong.erros.salvar'))
    toast.add({ severity: lido.recarregar ? 'warn' : 'error', summary: lido.mensagem, life: 6000 })
    if (lido.recarregar) void carregar()
  } finally {
    removendo.value = null
    confirmandoRemocao.value = null
  }
}

/* ------------------------------------------------------------------------------ a foto */

const entradaDaFoto = ref<HTMLInputElement | null>(null)
const enviandoFoto = ref(false)
const fotoFalhou = ref(false)

watch(
  () => identidade.value?.fotoUrl,
  () => (fotoFalhou.value = false),
)

async function aoEscolherFoto(evento: Event) {
  const entrada = evento.target as HTMLInputElement
  const arquivo = entrada.files?.[0]
  entrada.value = ''

  const atual = animal.value
  if (!arquivo || !atual) return

  if (arquivo.size > FOTO_DO_ANIMAL_MAX) {
    toast.add({ severity: 'warn', summary: t('ong.ficha.fotoGrande'), life: 5000 })
    return
  }

  enviandoFoto.value = true

  try {
    animal.value = await enviarFotoDoAnimal(atual.id, arquivo, parceiroQuery())
  } catch (err) {
    const lido = lerErroDaOng(err, t, t('ong.erros.salvar'))
    toast.add({ severity: 'error', summary: lido.mensagem, life: 6000 })
    if (lido.recarregar) void carregar()
  } finally {
    enviandoFoto.value = false
  }
}

/* ------------------------------------------------------------------- o menu e as gavetas */

const menu = ref<InstanceType<typeof Menu> | null>(null)
const editando = ref(false)
const encerrando = ref(false)
const entregando = ref(false)

const itensDoMenu = computed(() => [
  {
    label: identidade.value?.fotoUrl ? t('ong.ficha.trocarFoto') : t('ong.ficha.porFoto'),
    icon: 'ph ph-camera',
    command: () => entradaDaFoto.value?.click(),
  },
  {
    label: t('ong.ficha.encerrar'),
    icon: 'ph ph-archive',
    command: () => (encerrando.value = true),
  },
])

function aoSalvar(salvo: AnimalDaOng) {
  animal.value = salvo
}

/* --------------------------------------------------------------------------- os convites */

const versaoDosConvites = ref(0)
const convites = ref<ConviteDaOng[]>([])

function aoMudarConvites() {
  versaoDosConvites.value += 1
}

/** A ficha mudou na API (entregue, encerrada, convite novo): lê tudo de novo. */
function aoMudarFicha() {
  void carregar()
  versaoDosConvites.value += 1
}

/* ---------------------------------------------------------------------------- o retorno */

const confirmandoRetorno = ref(false)
const registrandoRetorno = ref(false)
const erroDoRetorno = ref('')

async function retornar() {
  const atual = animal.value
  if (!atual) return

  registrandoRetorno.value = true
  erroDoRetorno.value = ''

  try {
    const novo = await registrarRetorno(atual.id, parceiroQuery())

    toast.add({ severity: 'success', summary: t('ong.ficha.retorno.feito'), life: 4000 })
    if (!novo.microchipNoPet && novo.identidade?.microchip) {
      toast.add({ severity: 'warn', summary: t('ong.ficha.retorno.microchipFora'), life: 8000 })
    }

    confirmandoRetorno.value = false
    await router.push(`/ong/animal/${encodeURIComponent(novo.id)}`)
  } catch (err) {
    erroDoRetorno.value = lerErroDaOng(err, t, t('ong.erros.salvar')).mensagem
  } finally {
    registrandoRetorno.value = false
  }
}
</script>

<template>
  <UiPagina
    class="tela-ficha-ong"
    :titulo="animal?.nome ?? ''"
    :resumo="resumo"
    icone="ph ph-paw-print"
    :carregando="carregando && !animal"
    :erro="erro && !animal ? erro : ''"
    @tentar-de-novo="carregar"
  >
    <template #voltar>
      <Button
        :as="RouterLink"
        to="/ong/animais"
        size="small"
        severity="secondary"
        outlined
        icon="ph ph-arrow-left"
        :label="t('ong.ficha.voltar')"
      />
    </template>

    <template v-if="animal" #acoes>
      <template v-if="editavel">
        <Button
          v-if="podeEntregar"
          type="button"
          icon="ph ph-hand-heart"
          :label="t('ong.ficha.entregar')"
          @click="entregando = true"
        />
        <Button
          type="button"
          icon="ph ph-pencil-simple"
          :label="t('ong.ficha.editar')"
          severity="secondary"
          outlined
          @click="editando = true"
        />
        <Button
          type="button"
          icon="ph ph-dots-three"
          :label="t('ong.ficha.mais')"
          severity="secondary"
          outlined
          aria-haspopup="menu"
          :loading="enviandoFoto"
          @click="menu?.toggle($event)"
        />
        <Menu ref="menu" :model="itensDoMenu" popup />
      </template>
      <Button
        v-else-if="entregue && podeEscrever"
        type="button"
        icon="ph ph-arrow-u-down-left"
        :label="t('ong.ficha.retorno.botao')"
        :loading="registrandoRetorno"
        @click="confirmandoRetorno = true"
      />
    </template>

    <UiVazioIlustrado
      v-if="semAcesso"
      icone="ph ph-lock"
      :titulo="t('ong.ficha.naoEncontrado.titulo')"
      :texto="t('ong.ficha.naoEncontrado.texto')"
    >
      <template #acao>
        <Button
          :as="RouterLink"
          to="/ong/animais"
          severity="secondary"
          outlined
          icon="ph ph-arrow-left"
          :label="t('ong.ficha.naoEncontrado.voltar')"
        />
      </template>
    </UiVazioIlustrado>

    <div v-else-if="animal && identidade" class="fa">
      <p v-if="animal.retornoDeId" class="fa__faixa" role="status">
        <i class="ph ph-arrow-u-down-left" aria-hidden="true" />
        <span>{{ t('ong.ficha.retornoDe') }}</span>
        <RouterLink :to="`/ong/animal/${encodeURIComponent(animal.retornoDeId)}`">
          {{ t('ong.ficha.verAnterior') }}
        </RouterLink>
      </p>

      <!-- Entregue: a fotografia do que foi entregue, somente leitura. -->
      <section v-if="entregue" class="fa__entregue" aria-labelledby="fa-entregue">
        <span class="ui-ladrilho ui-ladrilho--ok" aria-hidden="true">
          <i class="ph ph-hand-heart" />
        </span>
        <span class="fa__entregue-texto">
          <h2 id="fa-entregue" class="fa__entregue-titulo">
            {{
              t('ong.ficha.entregue.titulo', {
                data: animal.entregueEm ? diaDoInstante(animal.entregueEm, rotulos.intl()) : '',
              })
            }}
          </h2>
          <strong class="fa__entregue-para">
            {{
              animal.adotantePrimeiroNome
                ? t('ong.ficha.entregue.para', { nome: animal.adotantePrimeiroNome })
                : t('ong.ficha.entregue.semNome')
            }}
          </strong>
          <span class="fa__entregue-meta">{{ t('ong.ficha.entregue.descricao') }}</span>
        </span>
      </section>

      <div class="fa__colunas">
        <div class="fa__coluna">
          <!-- A identidade e a foto. -->
          <section class="ui-folha ui-cartao fa__cartao" aria-labelledby="fa-identidade">
            <header class="fa__pet">
              <img
                v-if="identidade.fotoUrl && !fotoFalhou"
                class="fa__foto"
                :src="identidade.fotoUrl"
                :alt="t('ong.ficha.fotoAlt', { nome: animal.nome })"
                @error="fotoFalhou = true"
              />
              <PetAvatar
                v-else
                :nome="animal.nome"
                :iniciais="iniciais(animal.nome)"
                :especie="ESPECIE_DO_AVATAR[animal.especie] ?? null"
                tamanho="xl"
              />
              <span class="fa__pet-texto">
                <h2 id="fa-identidade" class="fa__titulo">
                  {{ t('ong.ficha.identidade.titulo') }}
                </h2>
                <span class="fa__meta">{{ t('ong.ficha.identidade.descricao') }}</span>
                <span v-if="animal.status === 'ENCERRADO'" class="ui-selo ui-selo--contorno">
                  <i class="ph ph-archive" aria-hidden="true" />
                  {{ t('ong.status.ENCERRADO') }}
                </span>
              </span>
            </header>

            <dl class="fa__dados">
              <div v-for="linha in dados" :key="linha.rotulo" class="fa__dado">
                <dt>{{ linha.rotulo }}</dt>
                <dd :class="{ 'ui-num': linha.num, fa__vazio: !linha.valor }">
                  {{ linha.valor || t('cadastro.naoInformado') }}
                </dd>
              </div>
            </dl>

            <div v-if="identidade.avisosDeManejo.length" class="fa__manejo">
              <span class="fa__manejo-rotulo">{{ t('ong.campos.manejo') }}</span>
              <span
                v-for="aviso in identidade.avisosDeManejo"
                :key="aviso"
                class="ui-selo ui-selo--atencao"
              >
                <i class="ph ph-warning" aria-hidden="true" />
                {{ t(`ong.manejo.${aviso}`) }}
              </span>
            </div>
          </section>

          <!-- A saúde: vacinas, vermífugos e pesos. -->
          <section class="ui-folha ui-cartao fa__cartao" aria-labelledby="fa-saude">
            <header class="ui-cartao__cabeca">
              <span class="ui-ladrilho" aria-hidden="true"><i class="ph ph-heartbeat" /></span>
              <span class="ui-cartao__titulos">
                <h2 id="fa-saude" class="ui-cartao__titulo">{{ t('ong.saude.titulo') }}</h2>
                <p class="ui-cartao__descricao">
                  {{
                    entregue
                      ? t('ong.saude.descricaoEntregue')
                      : emCuidado
                        ? t('ong.saude.descricao')
                        : t('ong.saude.descricaoEncerrado')
                  }}
                </p>
              </span>
            </header>

            <div v-for="tipo in TIPOS" :key="tipo" class="fa__grupo">
              <div class="fa__grupo-cabeca">
                <h3 class="fa__grupo-titulo">
                  <i :class="ICONE_DO_TIPO[tipo]" aria-hidden="true" />
                  {{ t(`ong.saude.${tipo}`) }}
                  <span v-if="saude[tipo].length" class="ui-contagem">{{
                    saude[tipo].length
                  }}</span>
                </h3>
                <Button
                  v-if="editavel"
                  type="button"
                  size="small"
                  severity="secondary"
                  outlined
                  icon="ph ph-plus"
                  :label="t(`ong.saude.adicionar.${tipo}`)"
                  @click="adicionar(tipo)"
                />
              </div>

              <ul v-if="saude[tipo].length" class="ui-lista">
                <li
                  v-for="(item, indice) in saude[tipo]"
                  :key="item.id ?? `${tipo}-${indice}`"
                  class="ui-linha fa__item"
                >
                  <span class="ui-linha__texto">
                    <strong class="ui-linha__titulo" :class="{ 'ui-num': tipo === 'pesos' }">
                      {{ item.titulo }}
                    </strong>
                    <span class="ui-linha__meta">{{ item.meta }}</span>
                  </span>
                  <span v-if="editavel && item.id" class="ui-linha__fim fa__acoes">
                    <template v-if="confirmandoRemocao === item.id">
                      <span class="fa__pergunta">{{ t('ong.saude.confirmarRemocao') }}</span>
                      <Button
                        type="button"
                        size="small"
                        severity="secondary"
                        outlined
                        :label="t('ong.saude.manter')"
                        :disabled="removendo === item.id"
                        @click="confirmandoRemocao = null"
                      />
                      <Button
                        type="button"
                        size="small"
                        severity="danger"
                        icon="ph ph-trash"
                        :label="t('ong.saude.remover')"
                        :loading="removendo === item.id"
                        @click="remover(tipo, item.id)"
                      />
                    </template>
                    <Button
                      v-else
                      type="button"
                      size="small"
                      severity="secondary"
                      outlined
                      icon="ph ph-trash"
                      :aria-label="t('ong.saude.removerDe', { nome: item.titulo })"
                      @click="confirmandoRemocao = item.id"
                    />
                  </span>
                </li>
              </ul>
              <p v-else class="fa__nenhum">{{ t(`ong.saude.nenhum.${tipo}`) }}</p>
            </div>
          </section>
        </div>

        <div class="fa__coluna">
          <ConvitesDoAnimal
            :animal-id="animal.id"
            :pode-entregar="editavel && podeEntregar"
            :entregue="!emCuidado"
            :versao="versaoDosConvites"
            @gerar="entregando = true"
            @lidos="(lidos) => (convites = lidos)"
            @mudou="aoMudarConvites"
          />

          <!-- As duas observações, com o destino no rótulo. -->
          <section class="ui-folha ui-cartao fa__cartao" aria-labelledby="fa-observacoes">
            <header class="ui-cartao__cabeca">
              <span class="ui-ladrilho" aria-hidden="true"><i class="ph ph-note" /></span>
              <span class="ui-cartao__titulos">
                <h2 id="fa-observacoes" class="ui-cartao__titulo">
                  {{ t('ong.ficha.observacoes.titulo') }}
                </h2>
                <p class="ui-cartao__descricao">{{ t('ong.ficha.observacoes.descricao') }}</p>
              </span>
            </header>

            <dl class="fa__dados fa__dados--uma">
              <div class="fa__dado">
                <dt>
                  <i class="ph ph-lock-simple" aria-hidden="true" />
                  {{ t('ong.campos.observacaoInterna') }}
                </dt>
                <dd class="fa__texto" :class="{ fa__vazio: !animal.observacaoInterna }">
                  {{ animal.observacaoInterna || t('ong.ficha.observacoes.vazia') }}
                </dd>
              </div>
              <div class="fa__dado">
                <dt>
                  <i class="ph ph-device-mobile" aria-hidden="true" />
                  {{ t('ong.campos.recado') }}
                </dt>
                <dd class="fa__texto" :class="{ fa__vazio: !animal.observacaoParaAdotante }">
                  {{ animal.observacaoParaAdotante || t('ong.ficha.observacoes.vazia') }}
                </dd>
              </div>
            </dl>
          </section>
        </div>
      </div>

      <!-- Nativo e escondido: o item "Trocar foto" do menu é o controle. -->
      <input
        ref="entradaDaFoto"
        class="fa__entrada"
        type="file"
        :accept="FOTO_DO_ANIMAL_TIPOS.join(',')"
        tabindex="-1"
        aria-hidden="true"
        @change="aoEscolherFoto"
      />
    </div>

    <template #sempre>
      <template v-if="animal">
        <AnimalGaveta
          v-model:visible="editando"
          :animal="animal"
          @salvo="aoSalvar"
          @mudou="aoMudarFicha"
        />
        <RegistroDeSaudeGaveta
          v-model:visible="registroAberto"
          :animal-id="animal.id"
          :tipo="tipoDoRegistro"
          @salvo="carregar"
          @mudou="aoMudarFicha"
        />
        <EncerrarGaveta
          v-model:visible="encerrando"
          :animal="animal"
          @salvo="(salvo) => (aoSalvar(salvo), aoMudarConvites())"
          @mudou="aoMudarFicha"
        />
        <ConviteDeAdocaoGaveta
          v-model:visible="entregando"
          :animal="animal"
          :tem-convite-valendo="temConviteValendo(convites)"
          @mudou="aoMudarFicha"
        />
        <RetornoGaveta
          v-model:visible="confirmandoRetorno"
          :nome="animal.nome"
          :registrando="registrandoRetorno"
          :erro="erroDoRetorno"
          @confirmar="retornar"
        />
      </template>
    </template>
  </UiPagina>
</template>

<style scoped>
.fa {
  display: grid;
  gap: 16px;
  container-type: inline-size;
}

.fa__colunas {
  display: grid;
  gap: 16px;
}

@container (min-width: 960px) {
  .fa__colunas {
    grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr);
    align-items: start;
  }
}

.fa__coluna {
  display: grid;
  gap: 16px;
}

.fa__cartao {
  display: grid;
  gap: 14px;
}

.fa__pet {
  display: flex;
  align-items: center;
  gap: 16px;
  min-width: 0;
}

.fa__foto {
  flex: none;
  width: 72px;
  height: 72px;
  border-radius: 50%;
  object-fit: cover;
}

.fa__pet-texto {
  display: grid;
  justify-items: start;
  gap: 4px;
  min-width: 0;
}

.fa__titulo {
  margin: 0;
  color: var(--tinta);
  font-size: 20px;
  font-weight: 650;
}

.fa__meta {
  color: var(--tinta-2);
  font-size: 14px;
}

.fa__dados {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(11rem, 1fr));
  gap: 12px 20px;
  margin: 0;
}

.fa__dados--uma {
  grid-template-columns: minmax(0, 1fr);
}

.fa__dado dt {
  color: var(--tinta-2);
  font-size: 12.5px;
}

.fa__dado dt > i {
  margin-inline-end: 4px;
  font-size: 14px;
  vertical-align: -2px;
}

.fa__dado dd {
  margin: 2px 0 0;
  color: var(--tinta);
  font-size: 14px;
  font-weight: 550;
  overflow-wrap: anywhere;
}

.fa__texto {
  font-weight: 450 !important;
  line-height: 1.5;
  white-space: pre-line;
}

.fa__vazio {
  color: var(--tinta-3) !important;
  font-weight: 450 !important;
}

.fa__manejo {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 8px;
}

.fa__manejo-rotulo {
  color: var(--tinta-2);
  font-size: 12.5px;
}

/* Vacinas, vermífugos e pesos: três grupos na mesma caixa, separados pelo fio suave. */
.fa__grupo {
  display: grid;
  gap: 8px;
  padding-top: 12px;
  border-top: 1px solid var(--linha);
}

.fa__grupo-cabeca {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.fa__grupo-titulo {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  color: var(--tinta);
  font-size: 15px;
  font-weight: 650;
}

.fa__grupo-titulo > i {
  color: var(--tinta-2);
  font-size: 17px;
}

.fa__nenhum {
  margin: 0;
  color: var(--tinta-3);
  font-size: 13.5px;
}

.fa__acoes {
  display: inline-flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  align-items: center;
  gap: 6px;
}

.fa__pergunta {
  color: var(--tinta);
  font-size: 13.5px;
}

.fa__faixa {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin: 0;
  padding: 12px 16px;
  border-radius: 14px;
  background: var(--superficie-2);
  color: var(--tinta);
  font-size: 14px;
}

/* Entregue: a linha que diz o que a ficha mostra, no tom de "ok". */
.fa__entregue {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 18px;
  border: 1px solid var(--linha);
  border-radius: var(--raio-cartao);
  background: var(--superficie);
  box-shadow: var(--sombra-cartao);
}

.fa__entregue-texto {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.fa__entregue-titulo {
  margin: 0;
  color: var(--tinta);
  font-size: 17px;
  font-weight: 650;
}

.fa__entregue-para {
  color: var(--tinta);
  font-size: 14.5px;
  font-weight: 600;
}

.fa__entregue-meta {
  color: var(--tinta-2);
  font-size: 13.5px;
}

.fa__entrada {
  display: none;
}
</style>
