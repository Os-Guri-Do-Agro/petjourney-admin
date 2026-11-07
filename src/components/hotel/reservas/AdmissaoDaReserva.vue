<script setup lang="ts">
/**
 * A documentação da reserva (E7-02b, guia e7 29 e 30): um bloco por animal, com cada exigência,
 * a situação (em dia, vence durante, vencido, ausente, dispensado), o comprovante que conta (de
 * onde veio, quem registrou, até quando vale) e, quando o mais recente não conta, a dica com o
 * caminho: anexar o documento ou pedir a dispensa à gestão.
 *
 * "Vence durante" só avisa: quem barra é o check-in. A dispensa é por animal; a exigência que
 * bloqueia só a gestão dispensa (`estabelecimento.editar`), e o botão some para os outros. O
 * documento abre pela URL assinada, na hora (vale 15 minutos).
 */
import Button from 'primevue/button'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { lerErroDoCadastro } from '@/components/cadastro/erros-do-cadastro'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import {
  anularComprovante,
  dispensarExigencia,
  lerReserva,
  MOTIVO_MAX,
  MOTIVO_MIN,
  revogarDispensa,
  type ComprovanteDaAdmissao,
  type ItemDaAdmissao,
  type ReservaDetalhe,
} from '@/service/parceiro/hotel-reservas-service'
import { abrirAbaVazia, levarAoArquivo } from '@/utils/arquivo-assinado'

import ComprovanteGaveta from './ComprovanteGaveta.vue'
import MotivoGaveta from './MotivoGaveta.vue'
import { TOM_DA_SITUACAO, useRotulosDasReservas } from './useRotulosDasReservas'
import '@/components/hotel/casa/casa.css'

const props = defineProps<{ reserva: ReservaDetalhe; podeMexer: boolean; gestao: boolean }>()
const emit = defineEmits<{ mudou: [] }>()

const { t } = useI18n()
const rotulos = useRotulosDasReservas()
const { parceiroQuery } = useParceiroPortal()

const erro = ref('')
const nomeDe = computed(() => new Map(props.reserva.animais.map((a) => [a.pacienteId, a.nome])))

function comprovante(c: ComprovanteDaAdmissao) {
  return [
    t('reservasDoHotel.admissao.apresentado', { data: rotulos.dia(c.apresentadoEm) }),
    c.validoAte
      ? t('reservasDoHotel.admissao.valeAte', { data: rotulos.dia(c.validoAte) })
      : t('reservasDoHotel.admissao.naoVence'),
    t(`reservasDoHotel.admissao.origem.${c.origem}`),
    c.registradoPorNome ? t('reservasDoHotel.admissao.por', { nome: c.registradoPorNome }) : '',
    c.referencia ?? '',
  ]
    .filter(Boolean)
    .join(' · ')
}

function folga(item: ItemDaAdmissao) {
  if (item.situacao !== 'VENCE_DURANTE' || item.diasDeFolga === null) return ''
  const n = Math.abs(item.diasDeFolga)
  return t('reservasDoHotel.admissao.venceAntes', { n }, n)
}

/* ------------------------------------------------------------------------------ ações */

const comprovanteAberto = ref(false)
const alvo = ref<{ pacienteId: string; item: ItemDaAdmissao } | null>(null)

function registrar(pacienteId: string, item: ItemDaAdmissao) {
  alvo.value = { pacienteId, item }
  comprovanteAberto.value = true
}

const anularAberto = ref(false)
const paraAnular = ref<string | null>(null)

function anular(c: ComprovanteDaAdmissao) {
  paraAnular.value = c.id
  anularAberto.value = true
}

const dispensaAberta = ref(false)

function dispensar(pacienteId: string, item: ItemDaAdmissao) {
  alvo.value = { pacienteId, item }
  dispensaAberta.value = true
}

const podeDispensar = (item: ItemDaAdmissao) => props.podeMexer && (!item.bloqueia || props.gestao)

const mexendo = ref<string | null>(null)
async function revogar(id: string) {
  erro.value = ''
  mexendo.value = id
  try {
    await revogarDispensa(id, parceiroQuery())
  } catch (err) {
    erro.value = lerErroDoCadastro(err, t('cadastro.erros.salvar')).mensagem
  } finally {
    mexendo.value = null
    emit('mudou')
  }
}

/** A URL assinada dura 15 minutos: relê a reserva na hora do toque, com a aba já aberta. */
async function abrirDocumento(pacienteId: string, item: ItemDaAdmissao) {
  const janela = abrirAbaVazia()
  try {
    const nova = await lerReserva(props.reserva.id, parceiroQuery())
    const url = nova.admissao
      .find((a) => a.pacienteId === pacienteId)
      ?.itens.find((i) => i.kind === item.kind)?.comprovante?.documento?.url
    if (url) levarAoArquivo(janela, url)
    else janela?.close()
  } catch (err) {
    janela?.close()
    erro.value = lerErroDoCadastro(err, t('cadastro.erros.salvar')).mensagem
  }
}
</script>

<template>
  <section class="ui-folha ui-cartao" aria-labelledby="admissao-titulo">
    <header class="ui-cartao__cabeca">
      <span class="ui-ladrilho" aria-hidden="true"><i class="ph ph-identification-card" /></span>
      <span class="ui-cartao__titulos">
        <h2 id="admissao-titulo" class="ui-cartao__titulo">
          {{ t('reservasDoHotel.admissao.titulo') }}
        </h2>
        <p class="ui-cartao__descricao">{{ t('reservasDoHotel.admissao.descricao') }}</p>
      </span>
    </header>

    <p v-if="erro" class="ca__erro" role="alert">{{ erro }}</p>
    <p v-if="!reserva.admissao.some((a) => a.itens.length)" class="ca__nota">
      {{ t('reservasDoHotel.admissao.semExigencias') }}
    </p>

    <template v-for="animal in reserva.admissao" :key="animal.pacienteId">
      <h3 v-if="animal.itens.length" class="ad__animal">
        {{ nomeDe.get(animal.pacienteId) }}
        <span class="ui-selo" :class="animal.liberada ? 'ui-selo--ok' : 'ui-selo--risco'">{{
          animal.liberada
            ? t('reservasDoHotel.admissao.liberada')
            : t('reservasDoHotel.admissao.travada')
        }}</span>
      </h3>
      <ul v-if="animal.itens.length" class="ui-lista">
        <li v-for="item in animal.itens" :key="item.kind" class="ui-linha">
          <span class="ui-linha__texto">
            <span class="ca__nome">
              <strong class="ui-linha__titulo">{{ rotulos.exigencia(item.kind) }}</strong>
              <span
                class="ui-selo"
                :class="
                  TOM_DA_SITUACAO[item.situacao] ? `ui-selo--${TOM_DA_SITUACAO[item.situacao]}` : ''
                "
                >{{ rotulos.situacao(item.situacao) }}</span
              >
              <span v-if="!item.bloqueia" class="ui-linha__meta">{{
                t('reservasDoHotel.admissao.soAvisa')
              }}</span>
            </span>
            <span v-if="item.comprovante" class="ui-linha__meta">{{
              comprovante(item.comprovante)
            }}</span>
            <span v-if="folga(item)" class="ui-linha__meta">{{ folga(item) }}</span>
            <span v-if="item.dica" class="ui-linha__meta ad__dica">
              <i class="ph ph-info" aria-hidden="true" />
              {{ t(`reservasDoHotel.admissao.dica.${item.dica}`) }}
            </span>
            <span v-if="item.naoConta" class="ui-linha__meta">{{
              t('reservasDoHotel.admissao.naoConta', { detalhe: comprovante(item.naoConta) })
            }}</span>
            <span v-if="item.dispensa" class="ui-linha__meta">{{
              t('reservasDoHotel.admissao.dispensada', {
                nome: item.dispensa.autorizadaPorNome,
                data: rotulos.dia(item.dispensa.autorizadaEm),
                motivo: item.dispensa.motivo,
              })
            }}</span>
          </span>
          <span class="ui-linha__fim ca__acoes">
            <Button
              v-if="item.comprovante?.temDocumento && item.comprovante.documento"
              type="button"
              size="small"
              severity="secondary"
              outlined
              icon="ph ph-file"
              :aria-label="t('reservasDoHotel.admissao.verDocumento')"
              @click="abrirDocumento(animal.pacienteId, item)"
            />
            <template v-if="podeMexer">
              <Button
                v-if="item.situacao !== 'OK' && item.situacao !== 'DISPENSADO'"
                type="button"
                size="small"
                severity="secondary"
                outlined
                :label="t('reservasDoHotel.admissao.registrar')"
                @click="registrar(animal.pacienteId, item)"
              />
              <Button
                v-if="item.comprovante && item.comprovante.fonte === 'BALCAO'"
                type="button"
                size="small"
                severity="secondary"
                outlined
                icon="ph ph-prohibit"
                :aria-label="t('reservasDoHotel.admissao.anular')"
                @click="anular(item.comprovante)"
              />
              <Button
                v-if="item.dispensa && podeDispensar(item)"
                type="button"
                size="small"
                severity="secondary"
                outlined
                :label="t('reservasDoHotel.admissao.revogar')"
                :loading="mexendo === item.dispensa.id"
                @click="revogar(item.dispensa.id)"
              />
              <Button
                v-else-if="!item.dispensa && item.situacao !== 'OK' && podeDispensar(item)"
                type="button"
                size="small"
                severity="secondary"
                outlined
                :label="t('reservasDoHotel.admissao.dispensar')"
                @click="dispensar(animal.pacienteId, item)"
              />
            </template>
          </span>
        </li>
      </ul>
    </template>

    <ComprovanteGaveta
      v-model:visible="comprovanteAberto"
      :reserva-id="reserva.id"
      :paciente-id="alvo?.pacienteId ?? ''"
      :animal="alvo ? (nomeDe.get(alvo.pacienteId) ?? '') : ''"
      :item="alvo?.item ?? null"
      @registrado="emit('mudou')"
    />
    <MotivoGaveta
      v-model:visible="anularAberto"
      :titulo="t('reservasDoHotel.admissao.anularTitulo')"
      icone="ph ph-prohibit"
      :dica="t('reservasDoHotel.admissao.anularDica')"
      :rotulo="t('reservasDoHotel.admissao.motivo')"
      :confirmar="t('reservasDoHotel.admissao.anular')"
      :min="MOTIVO_MIN"
      :max="MOTIVO_MAX"
      :acao="(motivo) => anularComprovante(paraAnular!, motivo, parceiroQuery())"
      @feito="emit('mudou')"
    />
    <MotivoGaveta
      v-model:visible="dispensaAberta"
      :titulo="
        alvo
          ? t('reservasDoHotel.admissao.dispensarTitulo', {
              exigencia: rotulos.exigencia(alvo.item.kind),
              animal: nomeDe.get(alvo.pacienteId) ?? '',
            })
          : ''
      "
      icone="ph ph-seal-check"
      :dica="t('reservasDoHotel.admissao.dispensarDica')"
      :rotulo="t('reservasDoHotel.admissao.motivo')"
      :confirmar="t('reservasDoHotel.admissao.dispensar')"
      :acao="
        (motivo) =>
          dispensarExigencia(
            reserva.id,
            { kind: alvo!.item.kind, pacienteId: alvo!.pacienteId, motivo },
            parceiroQuery(),
          )
      "
      @feito="emit('mudou')"
    />
  </section>
</template>

<style scoped>
.ad__animal {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin: 12px 0 4px;
  padding-inline: 10px;
  color: var(--tinta);
  font-size: 14.5px;
  font-weight: 650;
}

.ad__dica i {
  margin-inline-end: 4px;
  vertical-align: -2px;
  color: var(--atencao-tinta);
}
</style>
