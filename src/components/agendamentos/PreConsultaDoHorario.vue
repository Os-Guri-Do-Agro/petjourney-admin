<script setup lang="ts">
/**
 * A pré-consulta do horário, na gaveta da agenda (E3-07, PJ-OKGQZP; guia e3 7.7).
 *
 * Recolhida até alguém pedir: cada leitura com resposta entra na trilha que o responsável vê em
 * Acessos, então abrir a gaveta não lê sozinho. Lida, mostra o que o servidor deixou ver: com
 * `prontuario.ler`, tudo (o "do diário" por campo, o peso de casa como sugestão, as fotos com URL
 * de 15 minutos e o "editada"); na recepção, só a situação, o motivo e a queixa.
 */
import Button from 'primevue/button'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { lerErroDaAgenda } from '@/components/agendamentos/useFrasesDaAgenda'
import { useRotulosDoCadastro } from '@/components/cadastro/useRotulosDoCadastro'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { ApiError } from '@/service/api'
import {
  CAMPOS_DE_CASA,
  foiEditada,
  fotosVencidas,
  lerPreConsulta,
  type PreConsultaDaClinica,
} from '@/service/parceiro/pre-consulta-service'

const props = defineProps<{ agendamentoId: string; fuso: string }>()

const { t } = useI18n()
const rotulos = useRotulosDoCadastro()
const { parceiroQuery } = useParceiroPortal()

const lida = ref<PreConsultaDaClinica | null>(null)
const carregando = ref(false)
const erro = ref('')
const semPermissao = ref(false)

async function carregar() {
  carregando.value = true
  erro.value = ''
  try {
    lida.value = await lerPreConsulta(props.agendamentoId, parceiroQuery())
  } catch (err) {
    if (err instanceof ApiError && err.statusCode === 403) {
      semPermissao.value = true
    } else {
      erro.value = lerErroDaAgenda(err, t('agendamentos.preConsulta.erro')).mensagem
    }
  } finally {
    carregando.value = false
  }
}

watch(
  () => props.agendamentoId,
  () => {
    lida.value = null
    erro.value = ''
    semPermissao.value = false
  },
)

function momento(iso: string) {
  try {
    return new Intl.DateTimeFormat(rotulos.intl(), {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: props.fuso,
    }).format(new Date(iso))
  } catch {
    return iso.slice(0, 16).replace('T', ' ')
  }
}

function dia(data: string) {
  const [a, m, d] = data.split('-').map(Number)
  if (!a || !m || !d) return data
  return new Intl.DateTimeFormat(rotulos.intl(), { day: '2-digit', month: '2-digit' }).format(
    new Date(a, m - 1, d),
  )
}

function peso(kg: number) {
  return new Intl.NumberFormat(rotulos.intl(), { maximumFractionDigits: 2 }).format(kg)
}

const respondida = computed(() => Boolean(lida.value?.respondidaEm))

/** A frase de cima: respondida (e editada), ou em que pé está a janela. */
const situacao = computed(() => {
  const pre = lida.value
  if (!pre) return ''
  if (pre.respondidaEm) {
    return t('agendamentos.preConsulta.respondidaEm', { quando: momento(pre.respondidaEm) })
  }
  if (pre.situacao === 'AINDA_NAO_ABRIU') {
    return pre.abreEm
      ? t('agendamentos.preConsulta.abreEm', { quando: momento(pre.abreEm) })
      : t('agendamentos.preConsulta.naoAbriu')
  }
  if (pre.situacao === 'FECHADA') return t('agendamentos.preConsulta.naoRespondeu')
  return t('agendamentos.preConsulta.aindaNao')
})

const editada = computed(() =>
  lida.value && foiEditada(lida.value) && lida.value.atualizadaEm
    ? t('agendamentos.preConsulta.editada', { quando: momento(lida.value.atualizadaEm) })
    : '',
)

/** "3 a 7 dias · Piorando". */
const curso = computed(() => {
  const pre = lida.value
  if (!pre) return ''
  return [
    pre.desdeQuando ? t(`clinico.preConsulta.desdeQuando.${pre.desdeQuando}`) : '',
    pre.evolucao ? t(`agendamentos.preConsulta.evolucao.${pre.evolucao}`) : '',
  ]
    .filter(Boolean)
    .join(' · ')
})

/** Os campos de casa respondidos, com a marca do diário. */
const emCasa = computed(() => {
  const pre = lida.value
  if (!pre?.completa) return []
  const doDiario = new Set(pre.camposDoDiario ?? [])
  return CAMPOS_DE_CASA.flatMap((campo) => {
    const valor =
      campo === 'sintomas'
        ? (pre.sintomas ?? []).map((s) => t(`clinico.diario.sintomas.${s}`)).join(', ')
        : pre[campo]
          ? t(`clinico.diario.${campo}.${pre[campo]}`)
          : ''
    return valor
      ? [
          {
            campo,
            rotulo: t(`clinico.diario.campo.${campo}`),
            valor,
            doDiario: doDiario.has(campo),
          },
        ]
      : []
  })
})

const pesoDeCasa = computed(() => {
  const pre = lida.value
  if (!pre?.completa || pre.pesoKg == null) return ''
  return pre.pesadoEm
    ? t('agendamentos.preConsulta.pesoEm', { peso: peso(pre.pesoKg), dia: dia(pre.pesadoEm) })
    : t('agendamentos.preConsulta.peso', { peso: peso(pre.pesoKg) })
})

/** A URL de 15 minutos venceu: pede de novo (uma vez por leitura) antes de abrir a foto. */
let releuPelasFotos = false
async function abrirFoto(indice: number) {
  if (lida.value && fotosVencidas(lida.value) && !releuPelasFotos) {
    releuPelasFotos = true
    await carregar()
  }
  const url = lida.value?.fotos?.[indice]?.url
  if (url) window.open(url, '_blank', 'noopener')
}

function fotoQuebrou() {
  if (releuPelasFotos) return
  releuPelasFotos = true
  void carregar()
}
</script>

<template>
  <section v-if="!semPermissao" class="eg__secao pcv" :aria-busy="carregando">
    <span class="eg__rotulo">{{ t('agendamentos.preConsulta.titulo') }}</span>

    <!-- Antes de ler: uma linha e o botão. Ler deixa rastro para o responsável. -->
    <template v-if="!lida">
      <p class="pcv__dica">{{ t('agendamentos.preConsulta.dica') }}</p>
      <p v-if="erro" class="pcv__erro" role="alert">{{ erro }}</p>
      <Button
        type="button"
        :label="t('agendamentos.preConsulta.ver')"
        icon="ph ph-clipboard-text"
        size="small"
        severity="secondary"
        outlined
        class="pcv__ver"
        :loading="carregando"
        @click="carregar"
      />
    </template>

    <template v-else>
      <p class="pcv__situacao">
        <i :class="respondida ? 'ph ph-check-circle' : 'ph ph-clock'" aria-hidden="true" />
        <span>{{ situacao }}</span>
        <span v-if="editada" class="ui-selo">{{ editada }}</span>
      </p>

      <template v-if="respondida">
        <div class="pcv__queixa">
          <span class="pcv__motivo">{{
            lida.motivo ? t(`clinico.diario.motivo.${lida.motivo}`) : ''
          }}</span>
          <blockquote v-if="lida.queixaPrincipal">{{ lida.queixaPrincipal }}</blockquote>
          <small v-if="curso">{{ curso }}</small>
        </div>

        <template v-if="lida.completa">
          <dl v-if="emCasa.length || pesoDeCasa" class="pcv__casa">
            <div v-for="linha in emCasa" :key="linha.campo">
              <dt>{{ linha.rotulo }}</dt>
              <dd>
                {{ linha.valor }}
                <span v-if="linha.doDiario" class="pcv__diario">{{
                  t('clinico.preConsulta.doDiario')
                }}</span>
              </dd>
            </div>
            <div v-if="pesoDeCasa">
              <dt>{{ t('agendamentos.preConsulta.pesoDeCasa') }}</dt>
              <dd>
                {{ pesoDeCasa }}
                <span v-if="lida.camposDoDiario?.includes('pesoKg')" class="pcv__diario">{{
                  t('clinico.preConsulta.doDiario')
                }}</span>
              </dd>
            </div>
          </dl>
          <p v-if="pesoDeCasa" class="pcv__aviso">
            <i class="ph ph-scales" aria-hidden="true" />
            {{ t('agendamentos.preConsulta.pesoNaoVaiAosVitais') }}
          </p>

          <ul v-if="lida.fotos?.length" class="pcv__fotos">
            <li v-for="(foto, indice) in lida.fotos" :key="foto.fotoId">
              <a
                v-if="foto.url"
                :href="foto.url"
                target="_blank"
                rel="noopener"
                class="pcv__foto"
                :aria-label="t('agendamentos.preConsulta.abrirFoto', { n: indice + 1 })"
                @click.prevent="abrirFoto(indice)"
              >
                <img :src="foto.url" alt="" loading="lazy" @error="fotoQuebrou" />
              </a>
              <span
                v-else
                class="pcv__foto pcv__foto--sem"
                role="img"
                :aria-label="t('agendamentos.preConsulta.fotoIndisponivel')"
              >
                <i class="ph ph-image-broken" aria-hidden="true" />
              </span>
            </li>
          </ul>

          <div v-if="lida.observacao" class="pcv__queixa">
            <small>{{ t('agendamentos.preConsulta.observacao') }}</small>
            <p class="pcv__observacao">{{ lida.observacao }}</p>
          </div>
        </template>

        <p v-else class="pcv__dica">{{ t('agendamentos.preConsulta.recorte') }}</p>
      </template>
    </template>
  </section>
</template>

<style scoped>
.pcv__dica,
.pcv__erro,
.pcv__aviso,
.pcv__observacao {
  margin: 0;
  color: var(--tinta-2);
  font-size: 13.5px;
}

.pcv__erro {
  color: var(--risco-tinta);
}

.pcv__ver {
  justify-self: start;
}

.pcv__situacao {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 8px;
  margin: 0;
  color: var(--tinta);
  font-size: 14px;
}

.pcv__situacao i {
  color: var(--tinta-2);
  font-size: 16px;
}

.pcv__queixa {
  display: grid;
  gap: 4px;
}

.pcv__motivo {
  color: var(--tinta);
  font-size: 14px;
  font-weight: 600;
}

.pcv__queixa blockquote {
  margin: 0;
  padding-left: 10px;
  border-left: 2px solid var(--linha);
  color: var(--tinta);
  font-size: 14px;
  white-space: pre-line;
}

.pcv__queixa small {
  color: var(--tinta-2);
  font-size: 12.5px;
}

.pcv__casa {
  display: grid;
  gap: 10px 16px;
  margin: 0;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.pcv__casa div {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.pcv__casa dt {
  color: var(--tinta-2);
  font-size: 12.5px;
}

.pcv__casa dd {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 6px;
  margin: 0;
  color: var(--tinta);
  font-size: 14px;
}

.pcv__diario {
  color: var(--tinta-2);
  font-size: 12px;
  font-style: italic;
}

.pcv__aviso {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12.5px;
}

.pcv__fotos {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.pcv__foto {
  display: grid;
  overflow: hidden;
  width: 72px;
  height: 72px;
  place-items: center;
  border: 1px solid var(--linha-suave);
  border-radius: 10px;
  background: var(--superficie-2);
  color: var(--tinta-2);
  cursor: pointer;
}

.pcv__foto img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.pcv__foto--sem {
  cursor: default;
  font-size: 20px;
}

.pcv__foto:focus-visible {
  outline: 2px solid var(--tinta);
  outline-offset: 2px;
}

.pcv__observacao {
  color: var(--tinta);
  white-space: pre-line;
}
</style>
