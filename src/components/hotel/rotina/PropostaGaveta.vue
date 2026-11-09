<script setup lang="ts">
/**
 * A proposta de rotina de um hóspede (E7-05b, guia e7 43): regras, não IA, e nada é gravado até
 * aprovar. Em cima, o que **já vale** (a rotina da casa, a refeição do plano e as doses transcritas),
 * só leitura. Embaixo, as **sugestões** (só água, higiene, passeio e pesagem), cada uma com o porquê
 * citando o dado (a frase da inspeção, a adaptação, as noites). O sistema não propõe medicação nem
 * muda refeição.
 *
 * Aprovar manda os ids marcados; o servidor recalcula, e uma sugestão que deixou de valer (409
 * `SUGESTAO_DESCONHECIDA`) não grava nada: a gaveta relê a proposta.
 */
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import CadastroGaveta from '@/components/cadastro/CadastroGaveta.vue'
import { lerErroDoCadastro } from '@/components/cadastro/erros-do-cadastro'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { criarChaveadorDeIdempotencia } from '@/service/idempotencia'
import {
  aprovarProposta,
  lerProposta,
  type AjustesDoHospede,
  type PropostaDeRotina,
  type SugestaoDeRotina,
} from '@/service/parceiro/hotel-rotina-service'

const props = defineProps<{ hospedagemId: string; podeAprovar: boolean }>()
const aberta = defineModel<boolean>('visible', { default: false })
const emit = defineEmits<{ aprovada: [rotina: AjustesDoHospede, texto: string] }>()

const { t, te } = useI18n()
const { parceiroQuery } = useParceiroPortal()
const chaveador = criarChaveadorDeIdempotencia()

const proposta = ref<PropostaDeRotina | null>(null)
const marcadas = ref<string[]>([])
const lendo = ref(false)
const salvando = ref(false)
const erro = ref('')

async function ler() {
  lendo.value = true
  erro.value = ''
  try {
    proposta.value = await lerProposta(props.hospedagemId, parceiroQuery())
    marcadas.value = proposta.value.sugestoes
      .filter((item) => !item.jaAprovada)
      .map((item) => item.id)
  } catch (err) {
    proposta.value = null
    erro.value = lerErroDoCadastro(err, t('rotinaDoHotel.proposta.erro')).mensagem
  } finally {
    lendo.value = false
  }
}

watch(aberta, (agora) => {
  if (!agora) return
  proposta.value = null
  marcadas.value = []
  chaveador.concluir()
  void ler()
})

function horarios(item: SugestaoDeRotina) {
  return item.horarios.length ? item.horarios.join(', ') : t('rotinaDoHotel.ajuste.suspenso')
}

function porque(item: SugestaoDeRotina) {
  return item.porque
    .map((motivo) => {
      const chave = `rotinaDoHotel.proposta.fonte.${motivo.fonte}`
      /* A adaptação vem como o valor gravado (ESTRESSADO): escrita como a estadia a mostra. */
      const adaptacao = `estadiaDoHotel.adaptacao.${motivo.valor}`
      const valor = motivo.fonte === 'ADAPTACAO' && te(adaptacao) ? t(adaptacao) : motivo.valor
      return `${te(chave) ? t(chave) : motivo.fonte}: ${valor}`
    })
    .join(' · ')
}

const pendentes = computed(() => proposta.value?.sugestoes.filter((item) => !item.jaAprovada) ?? [])

async function aprovar() {
  erro.value = ''
  if (!marcadas.value.length) return
  const ids = [...marcadas.value].sort()
  salvando.value = true
  try {
    const feita = await aprovarProposta(
      props.hospedagemId,
      ids,
      chaveador.para({ ids }),
      parceiroQuery(),
    )
    chaveador.concluir()
    aberta.value = false
    emit(
      'aprovada',
      feita.rotina,
      t('rotinaDoHotel.proposta.aprovadas', { n: feita.aprovadas.length }, feita.aprovadas.length),
    )
  } catch (err) {
    const lido = lerErroDoCadastro(err, t('rotinaDoHotel.proposta.erroAprovar'))
    if (lido.codigo === 'SUGESTAO_DESCONHECIDA') {
      chaveador.concluir()
      await ler()
      erro.value = t('rotinaDoHotel.proposta.mudou')
      return
    }
    erro.value = lido.mensagem
  } finally {
    salvando.value = false
  }
}
</script>

<template>
  <CadastroGaveta
    v-model:visible="aberta"
    :titulo="t('rotinaDoHotel.proposta.titulo')"
    icone="ph ph-lightbulb"
    largura="34rem"
  >
    <div class="pp">
      <p class="eg__dica">{{ t('rotinaDoHotel.proposta.recusas') }}</p>

      <section v-if="proposta?.jaNaRotina.length" class="eg__secao">
        <span class="eg__rotulo">{{ t('rotinaDoHotel.proposta.jaVale') }}</span>
        <ul class="pp__lista">
          <li v-for="item in proposta.jaNaRotina" :key="item.id" class="pp__item">
            <strong>{{ t(`rotinaDoHotel.kind.${item.kind}`) }} · {{ horarios(item) }}</strong>
            <small>{{ t(`rotinaDoHotel.proposta.estado.${item.estado}`) }}</small>
          </li>
        </ul>
      </section>

      <section class="eg__secao">
        <span class="eg__rotulo">{{ t('rotinaDoHotel.proposta.sugestoes') }}</span>
        <p v-if="proposta && !proposta.sugestoes.length" class="eg__dica">
          {{ t('rotinaDoHotel.proposta.nada') }}
        </p>
        <ul v-else class="pp__lista">
          <li v-for="item in proposta?.sugestoes ?? []" :key="item.id" class="pp__item">
            <label class="pp__marcar" :for="`pp-${item.id}`">
              <Checkbox
                v-model="marcadas"
                :input-id="`pp-${item.id}`"
                :value="item.id"
                :disabled="item.jaAprovada || !podeAprovar || salvando"
              />
              <span>
                <strong>{{ t(`rotinaDoHotel.kind.${item.kind}`) }} · {{ horarios(item) }}</strong>
                <small>{{ porque(item) }}</small>
                <small v-if="item.jaAprovada" class="pp__ja">{{
                  t('rotinaDoHotel.proposta.jaAprovada')
                }}</small>
              </span>
            </label>
          </li>
        </ul>
      </section>

      <p v-if="erro" class="eg__erro" role="alert">
        <i class="ph ph-warning-circle" aria-hidden="true" />
        <span>{{ erro }}</span>
      </p>
    </div>
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
        v-if="podeAprovar && pendentes.length"
        type="button"
        icon="ph ph-check"
        :label="t('rotinaDoHotel.proposta.aprovar', { n: marcadas.length }, marcadas.length)"
        :loading="salvando || lendo"
        :disabled="!marcadas.length"
        @click="aprovar"
      />
    </template>
  </CadastroGaveta>
</template>

<style scoped>
.pp {
  display: grid;
  gap: 18px;
}

.pp__lista {
  display: grid;
  margin: 0;
  padding: 0;
  list-style: none;
}

/* Um item por linha, com o fio entre eles: a caixa é da gaveta, não do item. */
.pp__item {
  display: grid;
  gap: 2px;
  padding: 10px 0;
  color: var(--tinta);
  font-size: 14px;
}

.pp__item + .pp__item {
  border-top: 1px solid var(--app-regua, var(--linha-suave));
}

.pp__item small {
  color: var(--tinta-2);
  font-size: 13px;
  line-height: 1.45;
}

.pp__marcar {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  cursor: pointer;
}

.pp__marcar span {
  display: grid;
  gap: 2px;
}

.pp__ja {
  color: var(--ok-tinta) !important;
  font-weight: 600;
}
</style>
