<script setup lang="ts">
/**
 * Escrever o boletim ao responsável (E7-05c, guia e7 44). As sugestões vêm no idioma do
 * responsável; as contagens do período ajudam a contar o dia (e a medicação atrasada pede
 * conferência antes de dizer que está tudo bem); o diário é texto **interno** da equipe, ponto de
 * partida para editar, nunca enviado sozinho. Até 3 fotos do diário desta estadia.
 *
 * Nasce rascunho, ou retido quando há ocorrência grave sem contato (só sai depois da ligação). Um
 * aberto por estadia (409 `BOLETIM_HOTEL_JA_ABERTO`); o texto não muda depois de gravado.
 */
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import Textarea from 'primevue/textarea'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import CadastroGaveta from '@/components/cadastro/CadastroGaveta.vue'
import { lerErroDoCadastro } from '@/components/cadastro/erros-do-cadastro'
import { useRotulosDasReservas } from '@/components/hotel/reservas/useRotulosDasReservas'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { criarChaveadorDeIdempotencia } from '@/service/idempotencia'
import {
  comporBoletimDoHotel,
  FOTOS_DO_BOLETIM_MAX,
  lerModelosDoBoletimDoHotel,
  TEXTO_DO_BOLETIM_DO_HOTEL_MAX,
  type BoletimDoHotel,
  type ModelosDoBoletimDoHotel,
} from '@/service/parceiro/hotel-boletim-service'

const props = defineProps<{ hospedagemId: string; paciente: string }>()
const aberta = defineModel<boolean>('visible', { default: false })
const emit = defineEmits<{ escrito: [boletim: BoletimDoHotel]; jaAberto: [texto: string] }>()

const { t, te } = useI18n()
const rotulos = useRotulosDasReservas()
const { parceiroQuery } = useParceiroPortal()
const chaveador = criarChaveadorDeIdempotencia()

const modelos = ref<ModelosDoBoletimDoHotel | null>(null)
const texto = ref('')
const fotos = ref<string[]>([])
const tentou = ref(false)
const salvando = ref(false)
const erro = ref('')

watch(aberta, async (agora) => {
  if (!agora) return
  texto.value = ''
  fotos.value = []
  tentou.value = false
  erro.value = ''
  modelos.value = null
  chaveador.concluir()
  try {
    modelos.value = await lerModelosDoBoletimDoHotel(props.hospedagemId, parceiroQuery())
  } catch (err) {
    erro.value = lerErroDoCadastro(err, t('boletimDoHotel.erroModelos')).mensagem
  }
})

function usar(valor: string) {
  texto.value = texto.value.trim() ? `${texto.value.trim()}\n\n${valor}` : valor
}

const CONTAGENS = [
  'refeicoesAceitas',
  'refeicoesRecusadas',
  'agua',
  'passeios',
  'higiene',
  'banhoETosa',
  'adestramento',
  'medicacoesDadas',
  'medicacoesNaoDadas',
  'cuidados',
] as const

const contagens = computed(() => {
  const tarefas = modelos.value?.tarefas
  if (!tarefas) return ''
  return CONTAGENS.filter((chave) => tarefas[chave] > 0)
    .map((chave) => t(`boletimDoHotel.contagem.${chave}`, { n: tarefas[chave] }, tarefas[chave]))
    .join(' · ')
})

function rotuloDoKind(prefixo: string, kind: string) {
  const chave = `${prefixo}.${kind}`
  return te(chave) ? t(chave) : kind
}

const ocorrencias = computed(() =>
  (modelos.value?.ocorrencias ?? [])
    .map(
      (item) =>
        `${rotuloDoKind('rotinaDoHotel.ocorrencia.kind', item.kind)} (${t(`rotinaDoHotel.ocorrencia.gravidade.${item.gravidade}`)}): ${item.quantidade}`,
    )
    .join(' · '),
)

const comFoto = computed(() => modelos.value?.diario.filter((item) => item.fotoDisponivel) ?? [])
const valido = computed(() => texto.value.trim().length > 0)

async function escrever() {
  tentou.value = true
  erro.value = ''
  if (!valido.value) return
  const corpo = {
    texto: texto.value.trim(),
    ...(modelos.value ? { idioma: modelos.value.idioma } : {}),
    ...(fotos.value.length ? { fotoDiarioIds: [...fotos.value] } : {}),
  }
  salvando.value = true
  try {
    const boletim = await comporBoletimDoHotel(
      props.hospedagemId,
      corpo,
      chaveador.para(corpo),
      parceiroQuery(),
    )
    chaveador.concluir()
    aberta.value = false
    emit('escrito', boletim)
  } catch (err) {
    const lido = lerErroDoCadastro(err, t('boletimDoHotel.erroEscrever'))
    if (lido.codigo === 'BOLETIM_HOTEL_JA_ABERTO') {
      aberta.value = false
      emit('jaAberto', t('boletimDoHotel.jaAberto'))
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
    :titulo="t('boletimDoHotel.escrever')"
    icone="ph ph-chat-text"
    largura="38rem"
  >
    <form id="boletim-hotel" class="eg" novalidate @submit.prevent="escrever">
      <p class="eg__dica">{{ t('boletimDoHotel.escreverDica', { pet: paciente }) }}</p>

      <p v-if="modelos?.exigeContato" class="eg__aviso">
        <i class="ph ph-phone-call" aria-hidden="true" />
        <span>{{ t('boletimDoHotel.vaiRetido') }}</span>
      </p>
      <p v-if="modelos?.medicacoesAtrasadas" class="eg__aviso">
        <i class="ph ph-pill" aria-hidden="true" />
        <span>{{
          t(
            'boletimDoHotel.medicacoesAtrasadas',
            { n: modelos.medicacoesAtrasadas },
            modelos.medicacoesAtrasadas,
          )
        }}</span>
      </p>

      <section v-if="modelos" class="eg__secao">
        <span class="eg__rotulo">{{
          t('boletimDoHotel.periodo', { desde: rotulos.quando(modelos.periodoDesde) })
        }}</span>
        <p class="bh__resumo">{{ contagens || t('boletimDoHotel.semRegistros') }}</p>
        <p v-if="ocorrencias" class="bh__resumo">
          {{ t('boletimDoHotel.ocorrencias', { lista: ocorrencias }) }}
        </p>
      </section>

      <section v-if="modelos?.sugestoes.length" class="eg__secao">
        <span class="eg__rotulo">{{ t('boletimDoHotel.sugestoes') }}</span>
        <ul class="bh__lista">
          <li v-for="item in modelos.sugestoes" :key="item.chave">
            <p>{{ item.texto }}</p>
            <Button
              type="button"
              size="small"
              severity="secondary"
              outlined
              :label="t('boletimDoHotel.usar')"
              :disabled="salvando"
              @click="usar(item.texto)"
            />
          </li>
        </ul>
      </section>

      <section v-if="modelos?.diario.length" class="eg__secao">
        <span class="eg__rotulo">{{ t('boletimDoHotel.diarioInterno') }}</span>
        <small class="eg__dica">{{ t('boletimDoHotel.diarioDica') }}</small>
        <ul class="bh__lista">
          <li v-for="item in modelos.diario" :key="item.id">
            <p>
              <strong>{{ rotuloDoKind('rotinaDoHotel.diario.kind', item.kind) }}</strong> ·
              {{ item.texto }}
            </p>
            <Button
              type="button"
              size="small"
              severity="secondary"
              outlined
              :label="t('boletimDoHotel.usarComoBase')"
              :disabled="salvando"
              @click="usar(item.texto)"
            />
          </li>
        </ul>
      </section>

      <section class="eg__secao">
        <label class="eg__rotulo" for="bh-texto">{{ t('boletimDoHotel.texto') }}</label>
        <Textarea
          id="bh-texto"
          v-model="texto"
          rows="6"
          auto-resize
          :maxlength="TEXTO_DO_BOLETIM_DO_HOTEL_MAX"
          :invalid="tentou && !valido"
          :disabled="salvando"
        />
        <small class="eg__dica">{{ t('boletimDoHotel.textoDica') }}</small>
      </section>

      <section v-if="comFoto.length" class="eg__secao">
        <span class="eg__rotulo">
          {{ t('boletimDoHotel.fotos', { n: FOTOS_DO_BOLETIM_MAX }) }}
          <span class="eg__opcional">{{ t('cadastro.opcional') }}</span>
        </span>
        <p class="eg__aviso">
          <i class="ph ph-users-three" aria-hidden="true" />
          <span>{{ t('rotinaDoHotel.diario.avisoDaFoto') }}</span>
        </p>
        <label
          v-for="item in comFoto"
          :key="item.id"
          class="bh__marcar"
          :for="`bh-foto-${item.id}`"
        >
          <Checkbox
            v-model="fotos"
            :input-id="`bh-foto-${item.id}`"
            :value="item.id"
            :disabled="
              salvando || (fotos.length >= FOTOS_DO_BOLETIM_MAX && !fotos.includes(item.id))
            "
          />
          <span>{{
            [
              rotuloDoKind('rotinaDoHotel.diario.kind', item.kind),
              rotulos.quando(item.registradoEm),
            ].join(' · ')
          }}</span>
        </label>
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
        form="boletim-hotel"
        icon="ph ph-check"
        :label="t('boletimDoHotel.salvar')"
        :loading="salvando"
      />
    </template>
  </CadastroGaveta>
</template>

<style scoped>
.bh__resumo {
  margin: 0;
  color: var(--tinta);
  font-size: 14px;
  line-height: 1.5;
}

.bh__lista {
  display: grid;
  margin: 0;
  padding: 0;
  list-style: none;
}

.bh__lista li {
  display: grid;
  justify-items: start;
  gap: 8px;
  padding: 10px 0;
}

.bh__lista li + li {
  border-top: 1px solid var(--app-regua, var(--linha-suave));
}

.bh__lista p {
  margin: 0;
  color: var(--tinta);
  font-size: 14px;
  line-height: 1.5;
  white-space: pre-line;
}

.bh__marcar {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--tinta);
  font-size: 14px;
  cursor: pointer;
}
</style>
