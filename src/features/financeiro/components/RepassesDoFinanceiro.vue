<script setup lang="ts">
/**
 * Financeiro › Repasses (protótipo): quanto cada veterinário tem a receber, e por quê.
 *
 * Para a gestão, uma linha por veterinário: o vínculo e a regra, a produção do mês, o repasse e a
 * situação (mês aberto, fechado a pagar, pago). O extrato abre na gaveta. "Fechar o mês" congela
 * os valores e cria as contas a pagar do dia 5 (a "conferência e fechamento de comissões").
 *
 * No "Ver como" de um veterinário, a mesma aba vira **Meus repasses**: só o extrato dele, mês a
 * mês. É a resposta à pergunta que todo volante faz no fim do mês, sem precisar pedir a planilha.
 */
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import SelectButton from 'primevue/selectbutton'
import { useToast } from 'primevue/usetoast'
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import UiPagina from '@/components/ui/UiPagina.vue'

import {
  dataCurta,
  descreverRegra,
  mesAnterior,
  nomeDoMes,
  profissional,
  reais,
  reaisCurtos,
} from '../dados'
import { useFinanceiro } from '../estado'

import AvisoDoFinanceiro from './AvisoDoFinanceiro.vue'
import ExtratoDoRepasse from './ExtratoDoRepasse.vue'
import RepasseGaveta from './RepasseGaveta.vue'
import SoParaQuemPode from './SoParaQuemPode.vue'

const fin = useFinanceiro()
const toast = useToast()
const route = useRoute()
const router = useRouter()

const meses = computed(() => [0, 1, 2, 3].map((k) => mesAnterior(fin.mesAtual.value, k)))

const mes = computed<string>({
  get: () => {
    const pedido = route.query.mes
    return typeof pedido === 'string' && meses.value.includes(pedido) ? pedido : fin.mesAtual.value
  },
  set: (novo) => {
    const query = { ...route.query }
    if (novo === fin.mesAtual.value) delete query.mes
    else query.mes = novo
    void router.replace({ query })
  },
})

const opcoesDeMes = computed(() =>
  meses.value.map((m) => ({
    valor: m,
    rotulo: `${nomeDoMes(m).charAt(0).toUpperCase()}${nomeDoMes(m).slice(1)}${m === fin.mesAtual.value ? ' (aberto)' : ''}`,
  })),
)

const perfil = computed(() => fin.perfil.value)
const veterinario = computed(() => (perfil.value.tipo === 'veterinario' ? perfil.value.id : null))
const bloqueado = computed(() => perfil.value.tipo === 'recepcao')

const linhas = computed(() =>
  fin.regras.value.map((regra) => {
    const r = fin.repasse(regra.profissionalId, mes.value)!
    const valor = r.fechamento ? r.fechamento.valor : r.calculo.aReceber
    const despesa = fin.mundo.value.despesas.find(
      (d) =>
        d.origem?.tipo === 'repasse' &&
        d.origem.profissionalId === regra.profissionalId &&
        d.origem.mes === mes.value,
    )
    return {
      id: regra.profissionalId,
      pessoa: profissional(regra.profissionalId),
      regra,
      calculo: r.calculo,
      fechamento: r.fechamento,
      valor,
      situacao: !r.fechamento ? 'aberto' : r.fechamento.pagoEm ? 'pago' : 'a-pagar',
      vence: despesa?.vencimento ?? null,
    }
  }),
)

const total = computed(() => linhas.value.reduce((s, l) => s + l.valor, 0))
const producao = computed(() => linhas.value.reduce((s, l) => s + l.calculo.producao, 0))
const aPagar = computed(() => linhas.value.filter((l) => l.situacao === 'a-pagar'))
const mesFechado = computed(() => linhas.value.every((l) => l.fechamento))

const resumo = computed(() => {
  if (veterinario.value)
    return `O que ${profissional(veterinario.value).curto} tem a receber, mês a mês`
  if (bloqueado.value) return 'Quanto cada veterinário tem a receber'
  const partes = [
    `${mes.value === fin.mesAtual.value ? `${nomeDoMes(mes.value)} até hoje` : nomeDoMes(mes.value)}`,
    `${reaisCurtos(total.value)} em repasses para ${linhas.value.length} veterinários`,
  ]
  if (aPagar.value.length) partes.push(`${aPagar.value.length} a pagar`)
  return partes.join(' · ').replace(/^./, (c) => c.toUpperCase())
})

const gavetaAberta = ref(false)
const emFoco = ref<string | null>(null)

function abrir(id: string) {
  emFoco.value = id
  gavetaAberta.value = true
}

const confirmarFechamento = ref(false)

function fechar() {
  fin.fecharMes(mes.value)
  confirmarFechamento.value = false
  toast.add({
    severity: 'success',
    summary: `${nomeDoMes(mes.value).replace(/^./, (c) => c.toUpperCase())} fechado`,
    detail: `${reais(total.value)} em repasses viraram contas a pagar em Contas. Cada veterinário vê o extrato fechado em Meus repasses.`,
    life: 5500,
  })
}
</script>

<template>
  <UiPagina :resumo="resumo">
    <template v-if="perfil.tipo === 'gestao' && !mesFechado" #acoes>
      <Button
        type="button"
        icon="ph ph-lock-key"
        :label="`Fechar ${nomeDoMes(mes)}`"
        @click="confirmarFechamento = true"
      />
    </template>

    <div class="fin">
      <AvisoDoFinanceiro />

      <SoParaQuemPode v-if="bloqueado" />

      <template v-else>
        <SelectButton
          v-model="mes"
          :options="opcoesDeMes"
          option-label="rotulo"
          option-value="valor"
          :allow-empty="false"
          aria-label="Mês"
          class="rp__meses"
        />

        <!-- Meus repasses: o veterinário vê só o dele -->
        <section v-if="veterinario" class="ui-folha ui-cartao" aria-labelledby="rp-meus">
          <header class="ui-cartao__cabeca">
            <span class="ui-ladrilho rp__iniciais" aria-hidden="true">{{
              profissional(veterinario).iniciais
            }}</span>
            <span class="ui-cartao__titulos">
              <h2 id="rp-meus" class="ui-cartao__titulo">Meus repasses</h2>
              <p class="ui-cartao__descricao">
                {{ profissional(veterinario).nome }} · {{ fin.regraDe(veterinario)?.vinculo }}
              </p>
            </span>
          </header>
          <div class="ui-cartao__corpo">
            <ExtratoDoRepasse :profissional-id="veterinario" :mes="mes" />
          </div>
        </section>

        <!-- A gestão vê todos -->
        <template v-else>
          <section class="ui-folha ui-cartao" aria-labelledby="rp-lista">
            <header class="ui-cartao__cabeca">
              <span class="ui-ladrilho" aria-hidden="true"><i class="ph ph-hand-coins" /></span>
              <span class="ui-cartao__titulos">
                <h2 id="rp-lista" class="ui-cartao__titulo">Veterinários</h2>
                <p class="ui-cartao__descricao">
                  Produção de {{ reais(producao) }} em {{ nomeDoMes(mes) }}. Cada um com a regra
                  combinada.
                </p>
              </span>
              <span class="ui-cartao__total ui-num">{{ reais(total) }}</span>
            </header>
            <ul class="ui-lista">
              <li v-for="l in linhas" :key="l.id">
                <button type="button" class="ui-linha rp__linha" @click="abrir(l.id)">
                  <span class="ui-ladrilho rp__iniciais" aria-hidden="true">{{
                    l.pessoa.iniciais
                  }}</span>
                  <span class="ui-linha__texto">
                    <span class="ui-linha__titulo">{{ l.pessoa.nome }}</span>
                    <span class="ui-linha__meta"
                      >{{ l.regra.vinculo }} · {{ descreverRegra(l.regra) }}</span
                    >
                    <span class="ui-linha__meta rp__producao">
                      {{ l.calculo.atendimentos }}
                      {{ l.calculo.atendimentos === 1 ? 'atendimento' : 'atendimentos' }} ·
                      {{ reais(l.calculo.producao) }} de produção
                      <template v-if="l.calculo.adiantado">
                        · {{ reais(l.calculo.adiantado) }} adiantados</template
                      >
                      <template v-if="l.calculo.aguardando && !l.fechamento">
                        · {{ reais(l.calculo.aguardando) }} esperando o cliente pagar</template
                      >
                    </span>
                  </span>
                  <span class="ui-linha__fim">
                    <!-- No mês aberto o seletor já diz "aberto": o selo só aparece quando a linha difere. -->
                    <span
                      v-if="l.situacao !== 'aberto'"
                      class="ui-selo"
                      :class="{
                        'ui-selo--ok': l.situacao === 'pago',
                        'ui-selo--atencao': l.situacao === 'a-pagar',
                      }"
                    >
                      <template v-if="l.situacao === 'pago'"
                        ><i class="ph ph-check" aria-hidden="true" /> Pago em
                        {{ dataCurta(l.fechamento!.pagoEm!) }}</template
                      >
                      <template v-else
                        ><i class="ph ph-clock" aria-hidden="true" /> A pagar{{
                          l.vence ? ` até ${dataCurta(l.vence)}` : ''
                        }}</template
                      >
                    </span>
                    <strong class="rp__valor ui-num">{{ reais(l.valor) }}</strong>
                    <i class="ph ph-caret-right ui-linha__seta" aria-hidden="true" />
                  </span>
                </button>
              </li>
            </ul>
          </section>

          <p class="rp__como ui-poco">
            <i class="ph ph-info" aria-hidden="true" />
            <span>
              O repasse sai do que a clínica de fato recebeu: conta em aberto entra quando o cliente
              pagar, e a taxa do cartão sai antes da porcentagem (dá para mudar por veterinário).
              Adiantamento sai do próprio mês. Fechar o mês congela os valores e cria as contas a
              pagar do dia 5.
            </span>
          </p>
        </template>
      </template>
    </div>

    <template #sempre>
      <RepasseGaveta v-model:visible="gavetaAberta" :profissional-id="emFoco" :mes="mes" />
      <Dialog
        v-model:visible="confirmarFechamento"
        modal
        :header="`Fechar ${nomeDoMes(mes)}?`"
        :style="{ width: 'min(30rem, 92vw)' }"
      >
        <p class="rp__dialogo">
          <template v-if="mes === fin.mesAtual.value">
            O mês ainda não terminou. Fechar agora congela os repasses com os atendimentos até hoje,
            {{ dataCurta(fin.hoje.value) }}; o que vier depois entra no mês seguinte.
          </template>
          <template v-else>Os repasses de {{ nomeDoMes(mes) }} ficam congelados.</template>
          São {{ reais(total) }} para {{ linhas.length }} veterinários, que viram contas a pagar.
        </p>
        <template #footer>
          <Button
            type="button"
            severity="secondary"
            outlined
            label="Agora não"
            @click="confirmarFechamento = false"
          />
          <Button
            type="button"
            icon="ph ph-lock-key"
            :label="`Fechar ${nomeDoMes(mes)}`"
            @click="fechar"
          />
        </template>
      </Dialog>
    </template>
  </UiPagina>
</template>

<style scoped>
/* As linhas seguem a largura do conteúdo (a gaveta aberta estreita a página), não a da janela. */
.fin {
  display: grid;
  gap: 20px;
  container-type: inline-size;
}

@container (max-width: 760px) {
  .rp__linha {
    flex-wrap: wrap;
  }

  .rp__linha .ui-linha__fim {
    width: 100%;
    justify-content: flex-end;
  }
}

.rp__meses {
  justify-self: start;
  flex-wrap: wrap;
}

.rp__iniciais {
  font-size: 13px;
  font-weight: 700;
}

.rp__linha {
  align-items: center;
}

.rp__producao {
  font-size: 12.5px;
}

.rp__valor {
  min-width: 7rem;
  color: var(--tinta);
  font-size: 15px;
  font-weight: 650;
  text-align: end;
}

.rp__como {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin: 0;
  padding: 14px 18px;
  color: var(--tinta-2);
  font-size: 13.5px;
  line-height: 1.5;
}

.rp__como i {
  margin-top: 2px;
  color: var(--app-salvia-texto, var(--musgo));
  font-size: 17px;
}

.rp__dialogo {
  margin: 0;
  color: var(--tinta-2);
  font-size: 14px;
  line-height: 1.55;
}
</style>
