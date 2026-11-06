<script setup lang="ts">
/**
 * O aceite do termo no balcão (E4-06b, guia e4 9.1): quem responde, o documento dela, aceito ou
 * recusado e a assinatura desenhada no tablet (PNG). Vale a primeira resposta, do balcão ou do app.
 *
 * Documento diferente do CPF do cadastro: a equipe confere a pessoa e confirma a diferença (fica no
 * registro e no PDF). O aceite gera um PDF de registro à parte; o do termo não muda.
 */
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import InputText from 'primevue/inputtext'
import SelectButton from 'primevue/selectbutton'
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import CadastroGaveta from '@/components/cadastro/CadastroGaveta.vue'
import { lerErroDoCadastro } from '@/components/cadastro/erros-do-cadastro'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { registrarAceiteNoBalcao, type Documento } from '@/service/parceiro/documentos-service'

const props = defineProps<{ documento: Documento | null }>()
const aberta = defineModel<boolean>('visible', { default: false })
const emit = defineEmits<{ registrado: [] }>()

const { t } = useI18n()
const { parceiroQuery } = useParceiroPortal()

const nome = ref('')
const documentoDaPessoa = ref('')
const situacao = ref<'ACEITO' | 'RECUSADO'>('ACEITO')
const divergente = ref(false)
const confirmoDivergencia = ref(false)
const assinou = ref(false)
const tentou = ref(false)
const salvando = ref(false)
const erro = ref('')

const opcoesDeSituacao = computed(() => [
  { valor: 'ACEITO', rotulo: t('documentos.aceite.ACEITO') },
  { valor: 'RECUSADO', rotulo: t('documentos.aceite.RECUSADO') },
])

/* ------------------------------------------------------------------------ a assinatura */

const quadro = ref<HTMLCanvasElement | null>(null)
let desenhando = false

/** O quadro tem a largura da gaveta e 200 px de altura (cabe no teto de 2000 x 1000). */
function prepararQuadro() {
  const canvas = quadro.value
  if (!canvas) return
  const largura = Math.min(1000, Math.round(canvas.getBoundingClientRect().width)) || 480
  canvas.width = largura
  canvas.height = 200
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.lineWidth = 2.5
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.strokeStyle = '#10302a'
  assinou.value = false
}

function ponto(evento: PointerEvent) {
  const canvas = quadro.value!
  const caixa = canvas.getBoundingClientRect()
  return {
    x: ((evento.clientX - caixa.left) / caixa.width) * canvas.width,
    y: ((evento.clientY - caixa.top) / caixa.height) * canvas.height,
  }
}

function comecar(evento: PointerEvent) {
  const ctx = quadro.value?.getContext('2d')
  if (!ctx || salvando.value) return
  desenhando = true
  quadro.value!.setPointerCapture(evento.pointerId)
  const { x, y } = ponto(evento)
  ctx.beginPath()
  ctx.moveTo(x, y)
}

function mover(evento: PointerEvent) {
  if (!desenhando) return
  const ctx = quadro.value?.getContext('2d')
  if (!ctx) return
  const { x, y } = ponto(evento)
  ctx.lineTo(x, y)
  ctx.stroke()
  assinou.value = true
}

function terminar() {
  desenhando = false
}

watch(aberta, async (agora) => {
  if (!agora) return
  nome.value = ''
  documentoDaPessoa.value = ''
  situacao.value = 'ACEITO'
  divergente.value = false
  confirmoDivergencia.value = false
  tentou.value = false
  erro.value = ''
  await nextTick()
  /* A gaveta entra deslizando: o quadro mede a largura quando já está no lugar. */
  setTimeout(prepararQuadro, 250)
})

onBeforeUnmount(() => {
  desenhando = false
})

const valido = computed(
  () => nome.value.trim().length > 1 && documentoDaPessoa.value.trim().length > 3 && assinou.value,
)

async function registrar() {
  tentou.value = true
  erro.value = ''
  if (!valido.value || !props.documento || !quadro.value) return
  if (divergente.value && !confirmoDivergencia.value) {
    erro.value = t('documentos.aceite.confirmeDivergencia')
    return
  }
  salvando.value = true
  try {
    await registrarAceiteNoBalcao(
      props.documento.id,
      {
        nome: nome.value.trim(),
        documento: documentoDaPessoa.value.trim(),
        situacao: situacao.value,
        assinaturaPng: quadro.value.toDataURL('image/png'),
        ...(confirmoDivergencia.value ? { confirmoDivergencia: true } : {}),
      },
      parceiroQuery(),
    )
    aberta.value = false
    emit('registrado')
  } catch (err) {
    const lido = lerErroDoCadastro(err, t('documentos.aceite.erro'))
    if (lido.codigo === 'ACEITE_DOCUMENTO_DIVERGENTE') {
      divergente.value = true
      erro.value = t('documentos.aceite.divergente')
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
    :titulo="t('documentos.aceite.titulo')"
    icone="ph ph-signature"
    largura="36rem"
  >
    <form id="aceite-balcao" class="eg" novalidate @submit.prevent="registrar">
      <p class="eg__dica">{{ t('documentos.aceite.dica') }}</p>

      <div class="eg__linha">
        <section class="eg__secao">
          <label class="eg__rotulo" for="ac-nome">{{ t('documentos.aceite.nome') }}</label>
          <InputText
            id="ac-nome"
            v-model="nome"
            autocomplete="off"
            :invalid="tentou && nome.trim().length < 2"
            :disabled="salvando"
          />
        </section>
        <section class="eg__secao">
          <label class="eg__rotulo" for="ac-doc">{{ t('documentos.aceite.documento') }}</label>
          <InputText
            id="ac-doc"
            v-model="documentoDaPessoa"
            autocomplete="off"
            :invalid="tentou && documentoDaPessoa.trim().length < 4"
            :disabled="salvando"
          />
        </section>
      </div>

      <section class="eg__secao">
        <span id="ac-situacao" class="eg__rotulo">{{ t('documentos.aceite.resposta') }}</span>
        <SelectButton
          v-model="situacao"
          :options="opcoesDeSituacao"
          option-label="rotulo"
          option-value="valor"
          :allow-empty="false"
          aria-labelledby="ac-situacao"
          :disabled="salvando"
        />
      </section>

      <section class="eg__secao">
        <span id="ac-assinatura" class="eg__rotulo">{{ t('documentos.aceite.assinatura') }}</span>
        <canvas
          ref="quadro"
          class="ac__quadro"
          :class="{ 'ac__quadro--invalido': tentou && !assinou }"
          role="img"
          aria-labelledby="ac-assinatura"
          @pointerdown="comecar"
          @pointermove="mover"
          @pointerup="terminar"
          @pointercancel="terminar"
          @pointerleave="terminar"
        />
        <div class="ac__acoes">
          <small class="eg__dica">{{ t('documentos.aceite.assinaturaDica') }}</small>
          <Button
            type="button"
            size="small"
            severity="secondary"
            outlined
            icon="ph ph-eraser"
            :label="t('documentos.aceite.limpar')"
            :disabled="salvando || !assinou"
            @click="prepararQuadro"
          />
        </div>
      </section>

      <label v-if="divergente" class="ac__confirmar" for="ac-divergencia">
        <Checkbox
          v-model="confirmoDivergencia"
          input-id="ac-divergencia"
          binary
          :disabled="salvando"
        />
        <span>{{ t('documentos.aceite.confirmoDivergencia') }}</span>
      </label>

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
        form="aceite-balcao"
        icon="ph ph-check"
        :label="t('documentos.aceite.confirmar')"
        :loading="salvando"
      />
    </template>
  </CadastroGaveta>
</template>

<style scoped>
.ac__quadro {
  width: 100%;
  height: 200px;
  border: 1px dashed var(--linha-forte);
  border-radius: var(--raio-controle);
  background: #ffffff;
  touch-action: none;
  cursor: crosshair;
}

.ac__quadro--invalido {
  border-color: var(--risco);
}

.ac__acoes {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.ac__confirmar {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  color: var(--tinta);
  font-size: 14px;
  line-height: 1.45;
  cursor: pointer;
}
</style>
