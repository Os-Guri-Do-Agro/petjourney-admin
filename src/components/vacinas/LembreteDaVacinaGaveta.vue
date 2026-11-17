<script setup lang="ts">
/**
 * Ligar o lembrete de uma vacina da lista de chamada (pedido do Luís, 17/11/2026): antes de ligar,
 * a gaveta mostra quem recebe, o que chega no celular e quando sai. Ligado, ela mostra desde quando
 * e deixa desligar.
 *
 * A notificação segue a regra do push da clínica (guia e4 4.3, P8): sem o nome da vacina nem o da
 * clínica; o responsável vê os detalhes ao abrir a carteirinha.
 *
 * Enquanto a API não tem a rota (`LEMBRETE_NA_API`), a gaveta diz que o lembrete fica só neste
 * navegador: ninguém da clínica pode achar que o responsável foi avisado sem ter sido.
 */
import Button from 'primevue/button'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import CadastroGaveta from '@/components/cadastro/CadastroGaveta.vue'
import { lerErroDoCadastro } from '@/components/cadastro/erros-do-cadastro'
import { useRotulosDoCadastro } from '@/components/cadastro/useRotulosDoCadastro'
import { LEMBRETE_NA_API } from '@/service/parceiro/lembrete-de-vacina-service'
import type { Chamada } from '@/service/parceiro/vacinacao-service'

import { useLembretesDaChamada } from './useLembretesDaChamada'

const props = defineProps<{ item: Chamada | null }>()
const aberta = defineModel<boolean>('visible', { default: false })

const { t, locale } = useI18n()
const rotulos = useRotulosDoCadastro()
const lembretes = useLembretesDaChamada()

const salvando = ref(false)
const erro = ref('')

/* Com a gaveta aberta, outra vacina da lista troca o conteúdo (não só o abrir). */
watch([aberta, () => props.item?.aplicacaoId] as const, ([agora]) => {
  if (!agora) return
  erro.value = ''
  lembretes.ler()
})

const lembrete = computed(() => (props.item ? lembretes.doItem(props.item.aplicacaoId) : null))
const atrasada = computed(() => (props.item?.diasParaVencer ?? 0) < 0)
const diaDaDose = computed(() => (props.item ? rotulos.dia(props.item.proximaDoseEm) : ''))

const push = computed(() => {
  const qual = atrasada.value ? 'atrasada' : 'chegando'
  const pet = props.item?.paciente.nome ?? ''
  return {
    titulo: t(`vacinas.lembrete.push.${qual}.titulo`, { pet }),
    texto: t(`vacinas.lembrete.push.${qual}.texto`, { dia: diaDaDose.value }),
  }
})

const regras = computed(() => [
  { icone: 'ph ph-paper-plane-tilt', texto: t('vacinas.lembrete.regra.agora') },
  {
    icone: 'ph ph-arrow-clockwise',
    texto:
      (props.item?.diasParaVencer ?? 0) > 0
        ? t('vacinas.lembrete.regra.deNovoNoDia', { dia: diaDaDose.value })
        : t('vacinas.lembrete.regra.deNovoEm7'),
  },
  { icone: 'ph ph-check-circle', texto: t('vacinas.lembrete.regra.para') },
])

function quando(valor: string) {
  return new Date(valor).toLocaleString(locale.value, {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

async function mudar(ligar: boolean) {
  if (!props.item) return
  salvando.value = true
  erro.value = ''
  try {
    if (ligar) await lembretes.ligar(props.item.aplicacaoId)
    else await lembretes.desligar(props.item.aplicacaoId)
    if (ligar) aberta.value = false
  } catch (err) {
    const lido = lerErroDoCadastro(err, t('vacinas.lembrete.erro.generico'))
    erro.value =
      lido.codigo === 'SEM_CANAL_NO_APP'
        ? t('vacinas.lembrete.erro.semApp', { responsavel: props.item.cliente.nome })
        : lido.mensagem
  } finally {
    salvando.value = false
  }
}
</script>

<template>
  <CadastroGaveta
    v-model:visible="aberta"
    :titulo="t('vacinas.lembrete.titulo')"
    icone="ph ph-bell-simple"
  >
    <template v-if="item">
      <p class="lv__sobre">
        <strong>{{ item.vacina.nome }}</strong>
        <span>{{ t('vacinas.lembrete.de', { pet: item.paciente.nome, dia: diaDaDose }) }}</span>
      </p>

      <section class="eg__secao">
        <h3 class="eg__rotulo lv__titulo">
          {{ t('vacinas.lembrete.quem', { responsavel: item.cliente.nome }) }}
        </h3>
        <!-- A notificação como ela chega: o app, a hora, o título e o texto. -->
        <div class="lv__push" aria-hidden="true">
          <span class="lv__app"><i class="ph ph-paw-print" /></span>
          <span class="lv__push-texto">
            <span class="lv__push-topo">
              <span>PetJourney</span>
              <span>{{ t('vacinas.lembrete.agora') }}</span>
            </span>
            <strong>{{ push.titulo }}</strong>
            <span>{{ push.texto }}</span>
          </span>
        </div>
        <p class="eg__dica">{{ t('vacinas.lembrete.semNomes') }}</p>
      </section>

      <section class="eg__secao">
        <h3 class="eg__rotulo lv__titulo">{{ t('vacinas.lembrete.quando') }}</h3>
        <ul class="lv__regras">
          <li v-for="regra in regras" :key="regra.icone">
            <i :class="regra.icone" aria-hidden="true" />
            <span>{{ regra.texto }}</span>
          </li>
        </ul>
      </section>

      <p v-if="lembrete" class="lv__ligado">
        <i class="ph ph-bell-ringing" aria-hidden="true" />
        <span>{{ t('vacinas.lembrete.ligadoEm', { quando: quando(lembrete.ligadoEm) }) }}</span>
      </p>

      <p v-if="!LEMBRETE_NA_API" class="eg__aviso">
        <i class="ph ph-info" aria-hidden="true" />
        <span>{{ t('vacinas.lembrete.soNesteNavegador') }}</span>
      </p>

      <p v-if="erro" class="eg__erro" role="alert">
        <i class="ph ph-warning-circle" aria-hidden="true" />
        <span>{{ erro }}</span>
      </p>
    </template>

    <template #pe>
      <Button
        type="button"
        severity="secondary"
        outlined
        :label="lembrete ? t('vacinas.lembrete.fechar') : t('cadastro.cancelar')"
        :disabled="salvando"
        @click="aberta = false"
      />
      <Button
        v-if="lembrete"
        type="button"
        severity="danger"
        outlined
        icon="ph ph-bell-slash"
        :label="t('vacinas.lembrete.desligar')"
        :loading="salvando"
        @click="mudar(false)"
      />
      <Button
        v-else
        type="button"
        icon="ph ph-bell-simple"
        :label="t('vacinas.lembrete.ativar')"
        :loading="salvando"
        :disabled="!item"
        @click="mudar(true)"
      />
    </template>
  </CadastroGaveta>
</template>

<style scoped>
.lv__sobre {
  display: grid;
  gap: 2px;
  margin: 0;
  color: var(--tinta-2);
  font-size: 13.5px;
}

.lv__sobre strong {
  color: var(--tinta);
  font-size: 16px;
  font-weight: 650;
}

.lv__titulo {
  margin: 0;
}

/* A notificação: o mesmo desenho de uma notificação de celular, sem enfeite. */
.lv__push {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 14px;
  border: 1px solid var(--linha);
  border-radius: 14px;
  background: var(--superficie-2);
}

.lv__app {
  display: grid;
  width: 34px;
  height: 34px;
  flex: none;
  place-items: center;
  border-radius: 9px;
  background: var(--pj-lugar, var(--musgo));
  color: var(--pj-lugar-tinta, #10302a);
  font-size: 18px;
}

.lv__push-texto {
  display: grid;
  min-width: 0;
  gap: 2px;
  color: var(--tinta-2);
  font-size: 13px;
  line-height: 1.45;
}

.lv__push-texto strong {
  color: var(--tinta);
  font-size: 13.5px;
  font-weight: 650;
}

.lv__push-topo {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  color: var(--tinta-3);
  font-size: 12px;
}

.lv__regras {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.lv__regras li {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  color: var(--tinta);
  font-size: 13.5px;
  line-height: 1.45;
}

.lv__regras i {
  margin-top: 2px;
  color: var(--tinta-2);
  font-size: 16px;
}

.lv__ligado {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  color: var(--ok-tinta);
  font-size: 13.5px;
  font-weight: 600;
}

.lv__ligado i {
  font-size: 17px;
}
</style>
