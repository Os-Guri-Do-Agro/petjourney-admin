<script setup lang="ts">
/**
 * A ligação da ocorrência GRAVE (E7-05b, guia e7 43, a R3): a notícia grave vai por voz.
 *
 * - **O telefone só depois de um toque** ("Ver telefone para ligar"): cada leitura fica gravada com
 *   quem e quando, e tem limite por pessoa. Depois de visto, o número fica na tela até a pessoa
 *   registrar a ligação (para não gastar leitura); a tela não o guarda em lugar nenhum.
 * - **Falei com o responsável**: o contato (quem ligou, quando, o canal por voz). O primeiro vale.
 * - **Não atendeu**: uma tentativa. Três sem resposta, com 30 minutos entre a primeira e a última,
 *   e a ligação ao contato de emergência deixam o gestor registrar o "sem resposta".
 * - **Contato de emergência**: tentativa que atendeu ou não; não substitui a voz do responsável.
 *
 * É autodeclaração: a tela não promete verificação. O portal não liga: a ligação é do telefone da
 * casa, e a tela só registra.
 */
import Button from 'primevue/button'
import DatePicker from 'primevue/datepicker'
import RadioButton from 'primevue/radiobutton'
import Select from 'primevue/select'
import SelectButton from 'primevue/selectbutton'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import CadastroGaveta from '@/components/cadastro/CadastroGaveta.vue'
import { lerErroDoCadastro } from '@/components/cadastro/erros-do-cadastro'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { criarChaveadorDeIdempotencia } from '@/service/idempotencia'
import {
  CANAIS_DE_CONTATO,
  lerContatoDoResponsavel,
  registrarContato,
  registrarTentativa,
  type CanalDeContato,
  type ContatoDoResponsavel,
  type Ocorrencia,
} from '@/service/parceiro/hotel-ocorrencias-service'
import { instanteComOffset } from '@/service/parceiro/internacao-service'
import type { Profissional } from '@/service/parceiro/profissionais-service'

const props = defineProps<{ ocorrencia: Ocorrencia | null; profissionais: Profissional[] }>()
const aberta = defineModel<boolean>('visible', { default: false })
/** O telefone já lido desta ocorrência (o pai segura até a ligação ser registrada). */
const telefone = defineModel<ContatoDoResponsavel | null>('telefone', { default: null })
const emit = defineEmits<{ registrada: [ocorrencia: Ocorrencia]; releia: [] }>()

const { t } = useI18n()
const { store, parceiroQuery } = useParceiroPortal()
const chaveador = criarChaveadorDeIdempotencia()

type Resultado = 'CONTATO' | 'NAO_ATENDEU' | 'EMERGENCIA'
const AGORA = 'AGORA'
const MAIS_CEDO = 'MAIS_CEDO'

const resultado = ref<Resultado>('CONTATO')
const atendeu = ref(true)
const canal = ref<CanalDeContato>('TELEFONE')
const quemLigou = ref<string | null>(null)
const quando = ref<typeof AGORA | typeof MAIS_CEDO>(AGORA)
const em = ref<Date | null>(null)
const lendoTelefone = ref(false)
const erroDoTelefone = ref('')
const tentou = ref(false)
const salvando = ref(false)
const erro = ref('')

watch(aberta, (agora) => {
  if (!agora) return
  resultado.value = 'CONTATO'
  atendeu.value = true
  canal.value = 'TELEFONE'
  quemLigou.value = store.eu?.profissional?.id ?? null
  quando.value = AGORA
  em.value = null
  erroDoTelefone.value = ''
  tentou.value = false
  erro.value = ''
  chaveador.concluir()
})

async function verTelefone() {
  const ocorrencia = props.ocorrencia
  if (!ocorrencia) return
  lendoTelefone.value = true
  erroDoTelefone.value = ''
  try {
    telefone.value = await lerContatoDoResponsavel(ocorrencia.id, parceiroQuery())
  } catch (err) {
    const lido = lerErroDoCadastro(err, t('rotinaDoHotel.ligacao.erroTelefone'))
    erroDoTelefone.value =
      lido.codigo === 'PROFISSIONAL_OBRIGATORIO' ? t('rotinaDoHotel.semFicha') : lido.mensagem
    if (
      lido.codigo === 'OCORRENCIA_JA_COMUNICADA' ||
      lido.codigo === 'OCORRENCIA_NAO_EXIGE_CONTATO'
    )
      emit('releia')
  } finally {
    lendoTelefone.value = false
  }
}

const opcoesDeResultado = computed(() =>
  (['CONTATO', 'NAO_ATENDEU', 'EMERGENCIA'] as const).map((valor) => ({
    valor,
    rotulo: t(`rotinaDoHotel.ligacao.resultado.${valor}`),
  })),
)
const opcoesDeCanal = computed(() =>
  CANAIS_DE_CONTATO.map((valor) => ({ valor, rotulo: t(`rotinaDoHotel.ligacao.canal.${valor}`) })),
)
const opcoesDeAtendeu = computed(() => [
  { valor: true, rotulo: t('rotinaDoHotel.ligacao.atendeu') },
  { valor: false, rotulo: t('rotinaDoHotel.ligacao.naoAtendeu') },
])
const opcoesDeQuando = computed(() => [
  { valor: AGORA, rotulo: t('rotinaDoHotel.tarefa.agora') },
  { valor: MAIS_CEDO, rotulo: t('rotinaDoHotel.tarefa.maisCedo') },
])
const opcoesDePessoas = computed(() =>
  props.profissionais
    .filter((item) => item.ativo)
    .map((item) => ({ valor: item.id, rotulo: item.nome })),
)

const desde = () =>
  props.ocorrencia ? new Date(props.ocorrencia.registradaEm) : new Date(Date.now() - 3600_000)
const agora = () => new Date()

const valido = computed(() => quando.value === AGORA || Boolean(em.value))

async function registrar() {
  tentou.value = true
  erro.value = ''
  const ocorrencia = props.ocorrencia
  if (!ocorrencia || !valido.value) return
  const quandoFoi =
    quando.value === MAIS_CEDO && em.value ? { em: instanteComOffset(em.value) } : {}
  salvando.value = true
  try {
    let salva: Ocorrencia
    if (resultado.value === 'CONTATO') {
      const meu = store.eu?.profissional?.id ?? null
      salva = await registrarContato(
        ocorrencia.id,
        {
          canal: canal.value,
          ...quandoFoi,
          ...(quemLigou.value && quemLigou.value !== meu
            ? { porProfissionalId: quemLigou.value }
            : {}),
        },
        parceiroQuery(),
      )
    } else {
      const corpo = {
        canal: canal.value,
        destino:
          resultado.value === 'EMERGENCIA'
            ? ('CONTATO_DE_EMERGENCIA' as const)
            : ('RESPONSAVEL' as const),
        atendeu: resultado.value === 'EMERGENCIA' ? atendeu.value : false,
        ...quandoFoi,
      }
      salva = await registrarTentativa(ocorrencia.id, corpo, chaveador.para(corpo), parceiroQuery())
    }
    chaveador.concluir()
    telefone.value = null
    aberta.value = false
    emit('registrada', salva)
  } catch (err) {
    const lido = lerErroDoCadastro(err, t('rotinaDoHotel.ligacao.erro'))
    switch (lido.codigo) {
      case 'CONTATO_ANTES_DA_GRAVIDADE':
        quando.value = AGORA
        em.value = null
        erro.value = t('rotinaDoHotel.ligacao.antesDaGravidade')
        break
      case 'PROFISSIONAL_OBRIGATORIO':
        erro.value = t('rotinaDoHotel.semFicha')
        break
      case 'OCORRENCIA_JA_COMUNICADA':
        erro.value = lido.mensagem
        emit('releia')
        break
      default:
        erro.value = lido.mensagem
    }
  } finally {
    salvando.value = false
  }
}
</script>

<template>
  <CadastroGaveta
    v-model:visible="aberta"
    :titulo="t('rotinaDoHotel.ligacao.titulo')"
    icone="ph ph-phone-call"
  >
    <form id="ligacao-hotel" class="eg" novalidate @submit.prevent="registrar">
      <p v-if="ocorrencia" class="eg__dica">
        {{
          [
            t(`rotinaDoHotel.ocorrencia.kind.${ocorrencia.kind}`),
            t(`rotinaDoHotel.ocorrencia.gravidade.${ocorrencia.gravidade}`),
            ocorrencia.descricao,
          ].join(' · ')
        }}
      </p>

      <!-- O número só depois do toque; visto, fica até a ligação ser registrada. -->
      <section class="eg__secao lg__telefone">
        <template v-if="telefone">
          <p class="lg__quem">
            <strong>{{ telefone.responsavel.nome }}</strong>
            <span>{{
              [telefone.responsavel.telefone, telefone.responsavel.telefoneSecundario]
                .filter(Boolean)
                .join(' · ') || t('rotinaDoHotel.ligacao.semTelefone')
            }}</span>
          </p>
          <p v-if="telefone.contatoDeEmergencia" class="lg__quem">
            <strong>{{
              [
                t('rotinaDoHotel.ligacao.emergencia'),
                telefone.contatoDeEmergencia.nome,
                telefone.contatoDeEmergencia.relacao ?? '',
              ]
                .filter(Boolean)
                .join(' · ')
            }}</strong>
            <span>{{ telefone.contatoDeEmergencia.telefone }}</span>
          </p>
        </template>
        <template v-else>
          <p class="eg__dica">{{ t('rotinaDoHotel.ligacao.telefoneDica') }}</p>
          <Button
            type="button"
            severity="secondary"
            outlined
            icon="ph ph-phone"
            class="lg__ver"
            :label="t('rotinaDoHotel.ligacao.verTelefone')"
            :loading="lendoTelefone"
            @click="verTelefone"
          />
        </template>
        <p v-if="erroDoTelefone" class="eg__erro" role="alert">
          <i class="ph ph-warning-circle" aria-hidden="true" />
          <span>{{ erroDoTelefone }}</span>
        </p>
      </section>

      <fieldset class="eg__secao lg__opcoes">
        <legend class="eg__rotulo">{{ t('rotinaDoHotel.ligacao.comoFoi') }}</legend>
        <label
          v-for="opcao in opcoesDeResultado"
          :key="opcao.valor"
          class="lg__opcao"
          :for="`lg-${opcao.valor}`"
        >
          <RadioButton
            v-model="resultado"
            :input-id="`lg-${opcao.valor}`"
            :value="opcao.valor"
            name="lg-resultado"
            :disabled="salvando"
          />
          <span>{{ opcao.rotulo }}</span>
        </label>
      </fieldset>

      <section v-if="resultado === 'EMERGENCIA'" class="eg__secao">
        <span id="lg-atendeu" class="eg__rotulo">{{
          t('rotinaDoHotel.ligacao.atendeuRotulo')
        }}</span>
        <SelectButton
          v-model="atendeu"
          :options="opcoesDeAtendeu"
          option-label="rotulo"
          option-value="valor"
          :allow-empty="false"
          aria-labelledby="lg-atendeu"
          :disabled="salvando"
        />
      </section>

      <section class="eg__secao">
        <label class="eg__rotulo" for="lg-canal">{{
          t('rotinaDoHotel.ligacao.canalRotulo')
        }}</label>
        <Select
          v-model="canal"
          input-id="lg-canal"
          :options="opcoesDeCanal"
          option-label="rotulo"
          option-value="valor"
          :disabled="salvando"
        />
      </section>

      <section v-if="resultado === 'CONTATO' && opcoesDePessoas.length" class="eg__secao">
        <label class="eg__rotulo" for="lg-quem">{{ t('rotinaDoHotel.ligacao.quemLigou') }}</label>
        <Select
          v-model="quemLigou"
          input-id="lg-quem"
          :options="opcoesDePessoas"
          option-label="rotulo"
          option-value="valor"
          filter
          :disabled="salvando"
        />
      </section>

      <section class="eg__secao">
        <span id="lg-quando" class="eg__rotulo">{{ t('rotinaDoHotel.ligacao.quando') }}</span>
        <SelectButton
          v-model="quando"
          :options="opcoesDeQuando"
          option-label="rotulo"
          option-value="valor"
          :allow-empty="false"
          aria-labelledby="lg-quando"
          :disabled="salvando"
        />
        <DatePicker
          v-if="quando === MAIS_CEDO"
          v-model="em"
          inline
          show-time
          hour-format="24"
          :step-minute="5"
          :min-date="desde()"
          :max-date="agora()"
          aria-labelledby="lg-quando"
          :invalid="tentou && !em"
          :disabled="salvando"
        />
      </section>

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
        form="ligacao-hotel"
        icon="ph ph-check"
        :label="t('rotinaDoHotel.ligacao.registrar')"
        :loading="salvando"
      />
    </template>
  </CadastroGaveta>
</template>

<style scoped>
.lg__telefone {
  padding: 12px 14px;
  border: 1px solid var(--linha);
  border-radius: var(--raio-controle);
}

.lg__quem {
  display: grid;
  gap: 2px;
  margin: 0;
  color: var(--tinta);
  font-size: 14px;
}

.lg__quem span {
  font-size: 16px;
  font-variant-numeric: tabular-nums;
  font-weight: 600;
}

.lg__ver {
  justify-self: start;
}

.lg__opcoes {
  margin: 0;
  padding: 0;
  border: 0;
}

.lg__opcao {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--tinta);
  font-size: 14px;
  cursor: pointer;
}
</style>
