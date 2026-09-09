<script setup lang="ts">
/**
 * O que o responsável vê no celular.
 *
 * Existe porque **é o produto**. Todo o resto do módulo é ferramenta de clínica; isto é a coisa
 * que a Rita abre às 11 da noite em vez de ligar. Quem está construindo a tela da clínica precisa
 * ver, ao lado, o que sai do outro lado — senão o boletim vira mais um campo de formulário e
 * ninguém percebe que ele saiu seco, ou grande demais, ou tarde.
 *
 * É uma **prévia fiel, não um enfeite**: mesma ordem, mesmo agrupamento por dia e a mesma
 * distinção entre o que já chegou e o que ainda está na clínica. O boletim retido aparece aqui
 * como ausência — e é essa ausência que torna a regra da ligação compreensível de olhar.
 */
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import type { BoletimAoTutor } from '../../data/types'
import { useClinicFormat } from '../../composables/useClinicFormat'

const props = defineProps<{
  boletins: BoletimAoTutor[]
  petNome: string
  petIniciais: string
  clinicaNome: string
}>()

const { t } = useI18n()
const formato = useClinicFormat()

const conversa = ref<HTMLElement | null>(null)

/** Só o que de fato chegou ao celular. Retido e liberado ainda estão na clínica. */
const enviados = computed(() =>
  [...props.boletins]
    .filter((item) => item.status === 'enviado')
    .sort((a, b) => (a.enviadoEm ?? a.geradoEm).localeCompare(b.enviadoEm ?? b.geradoEm)),
)

const emEspera = computed(() => props.boletins.filter((item) => item.status === 'retido').length)

type Dia = { data: string; rotulo: string; itens: BoletimAoTutor[] }

const porDia = computed<Dia[]>(() => {
  const mapa = new Map<string, BoletimAoTutor[]>()

  for (const boletim of enviados.value) {
    const data = (boletim.enviadoEm ?? boletim.geradoEm).slice(0, 10)

    mapa.set(data, [...(mapa.get(data) ?? []), boletim])
  }

  return [...mapa.entries()].map(([data, itens]) => ({
    data,
    rotulo: formato.dataCurta(data),
    itens,
  }))
})

/**
 * A conversa abre na mensagem **mais recente**, como qualquer aplicativo de mensagem.
 *
 * Aberta no topo, a prévia mostrava o boletim mais antigo da internação e escondia justamente o
 * que acabou de sair — que é o que a clínica quer conferir depois de enviar.
 */
watch(
  () => enviados.value.length,
  async () => {
    await nextTick()

    if (conversa.value) {
      conversa.value.scrollTop = conversa.value.scrollHeight
    }
  },
  { immediate: true },
)
</script>

<template>
  <div class="celular">
    <div class="celular__moldura">
      <header class="celular__topo">
        <span class="celular__avatar" aria-hidden="true">{{ petIniciais }}</span>
        <span class="celular__identidade">
          <strong>{{ petNome }}</strong>
          <span>{{ clinicaNome }}</span>
        </span>
      </header>

      <div ref="conversa" class="celular__conversa">
        <p v-if="enviados.length === 0" class="celular__vazio">
          {{ t('clinico.internacao.app.vazio') }}
        </p>

        <template v-for="dia in porDia" :key="dia.data">
          <p class="celular__dia">{{ dia.rotulo }}</p>

          <article v-for="boletim in dia.itens" :key="boletim.id" class="balao">
            <p class="balao__texto">{{ boletim.texto }}</p>

            <figure v-if="boletim.foto" class="balao__foto">
              <span class="balao__fotoMarca" aria-hidden="true">{{ boletim.foto }}</span>
              <figcaption v-if="boletim.fotoLegenda">{{ boletim.fotoLegenda }}</figcaption>
              <figcaption v-else>{{ t('clinico.internacao.app.foto') }}</figcaption>
            </figure>

            <footer class="balao__rodape">
              <span>{{ formato.hora(boletim.enviadoEm ?? boletim.geradoEm) }}</span>
              <!--
                A ligação aparece no celular, e não só na clínica: quando a notícia é grave, o
                responsável precisa reconhecer a mensagem como o registro da conversa que já
                teve — não como a forma pela qual ele ficou sabendo.
              -->
              <span v-if="boletim.ligacaoEm" class="balao__ligacao">
                <i class="pi pi-phone" aria-hidden="true" />
                {{ t('clinico.internacao.app.aposLigacao') }}
              </span>
            </footer>
          </article>
        </template>
      </div>

      <p v-if="emEspera > 0" class="celular__retido">
        {{ t('clinico.internacao.app.retido', { total: emEspera }) }}
      </p>
    </div>
  </div>
</template>

<style scoped>
.celular {
  display: flex;
  justify-content: center;
}

/*
 * A moldura é sóbria de propósito: uma casquinha de telefone desenhada com brilho e reflexo
 * roubaria a atenção do conteúdo, que é o que precisa ser julgado aqui.
 */
.celular__moldura {
  display: flex;
  width: min(20rem, 100%);
  max-height: 34rem;
  flex-direction: column;
  padding: var(--clinic-space-3);
  border: 1px solid var(--clinic-line-strong);
  border-radius: 1.6rem;
  gap: var(--clinic-space-3);
  background: var(--clinic-surface-sunken);
  box-shadow: var(--clinic-shadow-card);
}

.celular__topo {
  display: flex;
  align-items: center;
  padding-bottom: var(--clinic-space-3);
  border-bottom: 1px solid var(--clinic-line);
  gap: var(--clinic-space-3);
}

.celular__avatar {
  display: grid;
  width: 2rem;
  height: 2rem;
  flex: 0 0 auto;
  border-radius: 50%;
  background: var(--clinic-accent-tint);
  color: var(--clinic-accent-strong);
  font-size: var(--clinic-font-label);
  font-weight: 750;
  place-items: center;
}

.celular__identidade {
  display: grid;
  min-width: 0;
  gap: 0.05rem;
}

.celular__identidade strong {
  overflow-wrap: anywhere;
  font-size: var(--clinic-font-body);
  font-weight: 750;
}

.celular__identidade span {
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
}

.celular__conversa {
  display: grid;
  overflow-y: auto;
  flex: 1;
  align-content: start;
  gap: var(--clinic-space-2);
}

.celular__vazio {
  margin: auto 0;
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
  text-align: center;
}

.celular__dia {
  margin: var(--clinic-space-2) 0 0;
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
  text-align: center;
}

.balao {
  padding: var(--clinic-space-3);
  border-radius: 0.9rem 0.9rem 0.9rem 0.2rem;
  background: var(--clinic-surface);
}

.balao__texto {
  margin: 0;
  font-size: var(--clinic-font-label);
  line-height: 1.5;
}

.balao__foto {
  display: grid;
  margin: var(--clinic-space-2) 0 0;
  gap: 0.2rem;
  justify-items: center;
}

/* Sem foto de verdade no protótipo: um retângulo honesto com as iniciais do paciente. */
.balao__fotoMarca {
  display: grid;
  width: 100%;
  height: 5rem;
  border-radius: var(--clinic-radius-control);
  background: var(--clinic-accent-tint);
  color: var(--clinic-accent-strong);
  font-size: var(--clinic-font-title);
  font-weight: 750;
  place-items: center;
}

.balao__foto figcaption {
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
}

.balao__rodape {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  margin-top: var(--clinic-space-2);
  gap: var(--clinic-space-2);
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
}

.balao__ligacao {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  color: var(--clinic-accent-strong);
  font-weight: 700;
}

.celular__retido {
  margin: 0;
  padding: var(--clinic-space-2) var(--clinic-space-3);
  border: 1px dashed var(--clinic-attention-line);
  border-radius: var(--clinic-radius-control);
  background: var(--clinic-attention-bg);
  color: var(--clinic-attention-text);
  font-size: var(--clinic-font-label);
  text-align: center;
}
</style>
