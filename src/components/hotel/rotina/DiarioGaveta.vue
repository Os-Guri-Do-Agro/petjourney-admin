<script setup lang="ts">
/**
 * Escrever no diário da estadia (E7-05b, guia e7 43): o tipo, o texto (1 a 500) e se o boletim
 * pode citar. O texto vai primeiro; a foto, se houver, vai depois noutra chamada: se ela falhar, o
 * texto já está gravado e a gaveta diz isso. Uma foto por entrada (JPEG, PNG ou WebP até 8 MB).
 */
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import FileUpload from 'primevue/fileupload'
import Select from 'primevue/select'
import Textarea from 'primevue/textarea'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import CadastroGaveta from '@/components/cadastro/CadastroGaveta.vue'
import { lerErroDoCadastro } from '@/components/cadastro/erros-do-cadastro'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { criarChaveadorDeIdempotencia } from '@/service/idempotencia'
import {
  enviarFotoDoDiario,
  escreverNoDiario,
  FOTO_DO_DIARIO_ACEITA,
  FOTO_DO_DIARIO_MAX_BYTES,
  KINDS_DO_DIARIO,
  TEXTO_DO_DIARIO_MAX,
  type KindDoDiario,
  type RegistroDoDiario,
} from '@/service/parceiro/hotel-ocorrencias-service'

const props = defineProps<{ hospedagemId: string }>()
const aberta = defineModel<boolean>('visible', { default: false })
const emit = defineEmits<{ escrito: [] }>()

const { t } = useI18n()
const { parceiroQuery } = useParceiroPortal()
const chaveador = criarChaveadorDeIdempotencia()

const kind = ref<KindDoDiario>('OBSERVACAO')
const texto = ref('')
const incluirNoBoletim = ref(true)
const arquivo = ref<File | null>(null)
const envio = ref<{ clear: () => void } | null>(null)
/** O texto já gravado quando a foto falhou: tentar de novo manda só a foto. */
const gravado = ref<RegistroDoDiario | null>(null)
const tentou = ref(false)
const salvando = ref(false)
const erro = ref('')

watch(aberta, (agora) => {
  if (!agora) return
  kind.value = 'OBSERVACAO'
  texto.value = ''
  incluirNoBoletim.value = true
  arquivo.value = null
  envio.value?.clear()
  gravado.value = null
  tentou.value = false
  erro.value = ''
  chaveador.concluir()
})

const opcoesDeKind = computed(() =>
  KINDS_DO_DIARIO.map((valor) => ({ valor, rotulo: t(`rotinaDoHotel.diario.kind.${valor}`) })),
)

function escolher(evento: { files: File[] }) {
  arquivo.value = evento.files[0] ?? null
  erro.value = ''
}

const valido = computed(() => gravado.value !== null || texto.value.trim().length > 0)

async function salvar() {
  tentou.value = true
  erro.value = ''
  if (!valido.value) return
  salvando.value = true
  try {
    if (!gravado.value) {
      const corpo = {
        kind: kind.value,
        texto: texto.value.trim(),
        incluirNoBoletim: incluirNoBoletim.value,
      }
      gravado.value = await escreverNoDiario(
        props.hospedagemId,
        corpo,
        chaveador.para(corpo),
        parceiroQuery(),
      )
      chaveador.concluir()
    }
    if (arquivo.value) {
      try {
        await enviarFotoDoDiario(
          props.hospedagemId,
          gravado.value.id,
          arquivo.value,
          parceiroQuery(),
        )
      } catch (err) {
        erro.value = t('rotinaDoHotel.diario.fotoFalhou', {
          motivo: lerErroDoCadastro(err, t('rotinaDoHotel.diario.erroFoto')).mensagem,
        })
        emit('escrito')
        return
      }
    }
    aberta.value = false
    emit('escrito')
  } catch (err) {
    const lido = lerErroDoCadastro(err, t('rotinaDoHotel.diario.erro'))
    erro.value =
      lido.codigo === 'PROFISSIONAL_OBRIGATORIO' ? t('rotinaDoHotel.semFicha') : lido.mensagem
  } finally {
    salvando.value = false
  }
}
</script>

<template>
  <CadastroGaveta
    v-model:visible="aberta"
    :titulo="t('rotinaDoHotel.diario.escrever')"
    icone="ph ph-notebook"
  >
    <form id="diario-hotel" class="eg" novalidate @submit.prevent="salvar">
      <template v-if="!gravado">
        <section class="eg__secao">
          <label class="eg__rotulo" for="dg-kind">{{ t('rotinaDoHotel.diario.tipo') }}</label>
          <Select
            v-model="kind"
            input-id="dg-kind"
            :options="opcoesDeKind"
            option-label="rotulo"
            option-value="valor"
            :disabled="salvando"
          />
        </section>
        <section class="eg__secao">
          <label class="eg__rotulo" for="dg-texto">{{ t('rotinaDoHotel.diario.texto') }}</label>
          <Textarea
            id="dg-texto"
            v-model="texto"
            rows="4"
            auto-resize
            :maxlength="TEXTO_DO_DIARIO_MAX"
            :invalid="tentou && !texto.trim()"
            :disabled="salvando"
          />
        </section>
        <label class="dg__marcar" for="dg-boletim">
          <Checkbox v-model="incluirNoBoletim" input-id="dg-boletim" binary :disabled="salvando" />
          <span>{{ t('rotinaDoHotel.diario.incluirNoBoletim') }}</span>
        </label>
      </template>
      <p v-else class="eg__dica">{{ t('rotinaDoHotel.diario.textoGravado') }}</p>

      <section class="eg__secao">
        <span class="eg__rotulo">
          {{ t('rotinaDoHotel.diario.foto') }}
          <span class="eg__opcional">{{ t('cadastro.opcional') }}</span>
        </span>
        <p class="eg__aviso">
          <i class="ph ph-users-three" aria-hidden="true" />
          <span>{{ t('rotinaDoHotel.diario.avisoDaFoto') }}</span>
        </p>
        <FileUpload
          ref="envio"
          mode="basic"
          :accept="FOTO_DO_DIARIO_ACEITA"
          :max-file-size="FOTO_DO_DIARIO_MAX_BYTES"
          :choose-label="arquivo ? arquivo.name : t('rotinaDoHotel.diario.escolherFoto')"
          choose-icon="ph ph-camera"
          custom-upload
          :disabled="salvando"
          @select="escolher"
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
        :label="gravado ? t('rotinaDoHotel.diario.semFoto') : t('cadastro.cancelar')"
        :disabled="salvando"
        @click="aberta = false"
      />
      <Button
        type="submit"
        form="diario-hotel"
        icon="ph ph-check"
        :label="gravado ? t('rotinaDoHotel.diario.enviarFoto') : t('cadastro.salvar')"
        :loading="salvando"
      />
    </template>
  </CadastroGaveta>
</template>

<style scoped>
.dg__marcar {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  color: var(--tinta);
  font-size: 14px;
  cursor: pointer;
}
</style>
