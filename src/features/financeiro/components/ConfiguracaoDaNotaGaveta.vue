<script setup lang="ts">
/**
 * Configuração da emissão da nota fiscal (protótipo): o que a clínica combina uma vez com o
 * contador e não mexe mais. Tudo ilustrativo e guardado só no estado do protótipo.
 *
 * No desenho das gavetas de configuração (`AgendamentoOnlineGaveta`): a chave-mestra em um
 * cartão no alto, porque é a única coisa que muda o dia a dia (a nota sai sozinha no receber, ou
 * as contas esperam em "A emitir"); embaixo, um assunto por seção, separadas por fio, com o que
 * cada campo faz escrito ao lado dele.
 *
 * 1. **Prefeitura:** a cidade, o padrão (a NFS-e nacional ou o sistema próprio da prefeitura) e a
 *    inscrição municipal.
 * 2. **Imposto:** o regime, o código do serviço da lista da Lei Complementar 116 e a alíquota do ISS.
 * 3. **Numeração:** a série e o próximo número do RPS, o pedido que a clínica numera.
 * 4. **Certificado digital:** o A1 que assina o pedido, com a validade à vista.
 */
import Button from 'primevue/button'
import InputNumber from 'primevue/inputnumber'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import SelectButton from 'primevue/selectbutton'
import ToggleSwitch from 'primevue/toggleswitch'
import { useToast } from 'primevue/usetoast'
import { computed, ref, watch } from 'vue'

import CadastroGaveta from '@/components/cadastro/CadastroGaveta.vue'
import { diffDays } from '@/features/clinico/domain/clinic-time'

import { useFinanceiro } from '../estado'
import {
  CODIGOS_DE_SERVICO,
  dataCompleta,
  MUNICIPIOS,
  PADROES,
  REGIMES,
  type ConfiguracaoDaNota,
  type PadraoDaNota,
  type RegimeTributario,
} from '../notas'
import { usePrestador } from '@/features/financeiro/prestador'

const prestador = usePrestador()
const aberta = defineModel<boolean>('visible', { default: false })

const fin = useFinanceiro()
const toast = useToast()

const rascunho = ref<ConfiguracaoDaNota | null>(null)
const tentou = ref(false)

watch(aberta, (agora) => {
  if (!agora) return
  tentou.value = false
  const atual = fin.configDaNota.value
  rascunho.value = { ...atual, certificado: { ...atual.certificado } }
})

const opcoesDeMunicipio = MUNICIPIOS.map((m) => ({ valor: m.id, rotulo: m.nome }))
const opcoesDePadrao = (Object.keys(PADROES) as PadraoDaNota[]).map((p) => ({
  valor: p,
  rotulo: PADROES[p],
}))
const opcoesDeRegime = (Object.keys(REGIMES) as RegimeTributario[]).map((r) => ({
  valor: r,
  rotulo: REGIMES[r],
}))
const opcoesDeServico = CODIGOS_DE_SERVICO.map((c) => ({
  valor: c.codigo,
  rotulo: `${c.codigo} – ${c.descricao}`,
}))

const diasDoCertificado = computed(() =>
  rascunho.value ? diffDays(fin.hoje.value, rascunho.value.certificado.validoAte) : 0,
)

const erros = computed(() => {
  const r = rascunho.value
  const lista: string[] = []
  if (!r) return lista
  if (!r.inscricaoMunicipal.trim()) lista.push('Falta a inscrição municipal da clínica.')
  if (!r.serieRps.trim()) lista.push('Falta a série do RPS.')
  if (r.aliquota <= 0) lista.push('A alíquota do ISS precisa ser maior que zero.')
  return lista
})

function salvar() {
  tentou.value = true
  if (!rascunho.value || erros.value.length) return
  fin.salvarConfiguracaoDaNota({
    ...rascunho.value,
    inscricaoMunicipal: rascunho.value.inscricaoMunicipal.trim(),
    serieRps: rascunho.value.serieRps.trim().toUpperCase(),
  })
  toast.add({
    severity: 'success',
    summary: 'Emissão da nota configurada',
    detail: 'Vale para as próximas notas; as já emitidas não mudam.',
    life: 4000,
  })
  aberta.value = false
}

function trocarCertificado() {
  toast.add({
    severity: 'info',
    summary: 'Trocar o certificado',
    detail:
      'Aqui entraria o arquivo do certificado A1 (.pfx) com a senha que a certificadora entrega. No protótipo, nenhum arquivo é enviado.',
    life: 5500,
  })
}
</script>

<template>
  <CadastroGaveta
    v-model:visible="aberta"
    titulo="Configuração da nota fiscal"
    icone="ph ph-gear-six"
    largura="38rem"
  >
    <form v-if="rascunho" id="configuracao-da-nota" class="cn" novalidate @submit.prevent="salvar">
      <!-- A chave-mestra: o único cartão da gaveta, porque é a única coisa que muda o balcão. -->
      <label class="cn__mestre" :class="{ 'cn__mestre--ligado': rascunho.emitirAoReceber }">
        <span class="cn__mestre-icone" aria-hidden="true">
          <i
            class="ph"
            :class="rascunho.emitirAoReceber ? 'ph-lightning' : 'ph-hourglass-medium'"
          />
        </span>
        <span class="cn__texto">
          <strong>Emitir a nota ao receber</strong>
          <span>
            Ligado, a nota sai na hora em que a recepção recebe. Desligado, as contas pagas esperam
            em A emitir, para emitir todas de uma vez.
          </span>
        </span>
        <ToggleSwitch v-model="rascunho.emitirAoReceber" />
      </label>

      <section class="cn__secao" aria-labelledby="cn-prefeitura">
        <h3 id="cn-prefeitura" class="cn__titulo">
          <span class="ui-ladrilho ui-ladrilho--p" aria-hidden="true"
            ><i class="ph ph-buildings"
          /></span>
          Prefeitura
        </h3>
        <div class="cn__campo">
          <span class="cn__texto">
            <strong id="cn-municipio-rotulo">Cidade</strong>
            <span>Onde a clínica está registrada: é para essa prefeitura que a nota vai.</span>
          </span>
          <Select
            v-model="rascunho.municipio"
            :options="opcoesDeMunicipio"
            option-label="rotulo"
            option-value="valor"
            aria-labelledby="cn-municipio-rotulo"
          />
        </div>
        <div class="cn__campo cn__campo--largo">
          <span class="cn__texto">
            <strong id="cn-padrao-rotulo">Padrão</strong>
            <span>
              A NFS-e nacional vale em todo o país; o sistema da prefeitura é o próprio da cidade. O
              contador diz qual a cidade usa.
            </span>
          </span>
          <SelectButton
            v-model="rascunho.padrao"
            :options="opcoesDePadrao"
            option-label="rotulo"
            option-value="valor"
            :allow-empty="false"
            aria-labelledby="cn-padrao-rotulo"
            class="cn__segmento"
          />
        </div>
        <div class="cn__campo">
          <label class="cn__texto" for="cn-inscricao">
            <strong>Inscrição municipal</strong>
            <span>O cadastro da clínica na prefeitura (CCM, em São Paulo).</span>
          </label>
          <InputText
            id="cn-inscricao"
            v-model="rascunho.inscricaoMunicipal"
            maxlength="20"
            :invalid="tentou && !rascunho.inscricaoMunicipal.trim()"
          />
        </div>
      </section>

      <section class="cn__secao" aria-labelledby="cn-imposto">
        <h3 id="cn-imposto" class="cn__titulo">
          <span class="ui-ladrilho ui-ladrilho--p" aria-hidden="true"
            ><i class="ph ph-percent"
          /></span>
          Imposto
        </h3>
        <div class="cn__campo">
          <span class="cn__texto">
            <strong id="cn-regime-rotulo">Regime tributário</strong>
            <span>No Simples Nacional, o ISS já vai na guia do mês: a nota só informa.</span>
          </span>
          <Select
            v-model="rascunho.regime"
            :options="opcoesDeRegime"
            option-label="rotulo"
            option-value="valor"
            aria-labelledby="cn-regime-rotulo"
          />
        </div>
        <div class="cn__campo cn__campo--largo">
          <span class="cn__texto">
            <strong id="cn-servico-rotulo">Código do serviço</strong>
            <span>Da lista da Lei Complementar 116. Clínica que atende é o 5.01.</span>
          </span>
          <Select
            v-model="rascunho.codigoDoServico"
            :options="opcoesDeServico"
            option-label="rotulo"
            option-value="valor"
            aria-labelledby="cn-servico-rotulo"
          />
        </div>
        <div class="cn__campo">
          <label class="cn__texto" for="cn-aliquota">
            <strong>Alíquota do ISS</strong>
            <span>
              {{
                rascunho.regime === 'simples'
                  ? 'A parte do ISS na faixa do Simples da clínica: 2,01% na primeira faixa.'
                  : 'A alíquota da cidade para o serviço: de 2% a 5%.'
              }}
            </span>
          </label>
          <InputNumber
            input-id="cn-aliquota"
            :model-value="Math.round(rascunho.aliquota * 10000) / 100"
            :min="0"
            :max="5"
            :min-fraction-digits="2"
            :max-fraction-digits="2"
            :step="0.01"
            suffix="%"
            locale="pt-BR"
            show-buttons
            button-layout="horizontal"
            increment-button-icon="ph ph-plus"
            decrement-button-icon="ph ph-minus"
            :invalid="tentou && rascunho.aliquota <= 0"
            class="cn__passo"
            @update:model-value="rascunho.aliquota = Math.round(($event ?? 0) * 100) / 10000"
          />
        </div>
      </section>

      <section class="cn__secao" aria-labelledby="cn-numeracao">
        <h3 id="cn-numeracao" class="cn__titulo">
          <span class="ui-ladrilho ui-ladrilho--p" aria-hidden="true"
            ><i class="ph ph-hash"
          /></span>
          Numeração do RPS
        </h3>
        <p class="cn__ajuda">
          O RPS é o pedido de nota que a clínica numera; o número da nota vem da prefeitura. Só mude
          se o contador pedir: número repetido faz a prefeitura recusar.
        </p>
        <div class="cn__campo">
          <label class="cn__texto" for="cn-serie">
            <strong>Série</strong>
            <span>Uma letra ou número curto, até 5.</span>
          </label>
          <InputText
            id="cn-serie"
            v-model="rascunho.serieRps"
            maxlength="5"
            :invalid="tentou && !rascunho.serieRps.trim()"
          />
        </div>
        <div class="cn__campo">
          <label class="cn__texto" for="cn-proximo">
            <strong>Próximo número</strong>
            <span>O da próxima nota que sair.</span>
          </label>
          <InputNumber
            v-model="rascunho.proximoRps"
            input-id="cn-proximo"
            :min="1"
            :use-grouping="false"
          />
        </div>
      </section>

      <section class="cn__secao" aria-labelledby="cn-certificado">
        <h3 id="cn-certificado" class="cn__titulo">
          <span class="ui-ladrilho ui-ladrilho--p" aria-hidden="true"
            ><i class="ph ph-certificate"
          /></span>
          Certificado digital
        </h3>
        <div class="cn__certificado">
          <span class="cn__texto">
            <strong>{{ rascunho.certificado.tipo }} · {{ rascunho.certificado.titular }}</strong>
            <span>CNPJ {{ prestador.cnpj }} · assina cada pedido de nota.</span>
          </span>
          <span
            class="ui-selo"
            :class="diasDoCertificado <= 30 ? 'ui-selo--atencao' : 'ui-selo--ok'"
          >
            <i
              :class="diasDoCertificado <= 30 ? 'ph ph-warning' : 'ph ph-seal-check'"
              aria-hidden="true"
            />
            Válido até {{ dataCompleta(rascunho.certificado.validoAte) }}
          </span>
        </div>
        <p class="cn__ajuda">
          O A1 vale um ano. Trinta dias antes de vencer, o aviso aparece aqui e na tela das notas;
          vencido, a prefeitura não aceita mais nenhuma nota.
        </p>
        <Button
          type="button"
          severity="secondary"
          outlined
          size="small"
          icon="ph ph-upload-simple"
          label="Trocar certificado"
          class="cn__trocar"
          @click="trocarCertificado"
        />
      </section>

      <ul v-if="tentou && erros.length" class="eg__erro cn__erros" role="alert">
        <li v-for="erro in erros" :key="erro">{{ erro }}</li>
      </ul>
    </form>

    <template #pe>
      <Button
        type="button"
        severity="secondary"
        outlined
        label="Cancelar"
        @click="aberta = false"
      />
      <Button type="submit" form="configuracao-da-nota" icon="ph ph-check" label="Salvar" />
    </template>
  </CadastroGaveta>
</template>

<style scoped>
.cn {
  display: grid;
  gap: 22px;
}

/* Texto de duas linhas, repetido em todo campo: o nome em cima, o que ele faz embaixo. */
.cn__texto {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.cn__texto strong {
  color: var(--tinta);
  font-size: 14px;
  font-weight: 600;
  line-height: 1.35;
}

.cn__texto > span,
.cn__ajuda {
  color: var(--tinta-2);
  font-size: 13px;
  line-height: 1.45;
}

.cn__ajuda {
  margin: -4px 0 0;
}

/* ------------------------------------------------------------------ a chave-mestra */

.cn__mestre {
  display: grid;
  align-items: center;
  padding: 16px 18px;
  border: 1px solid var(--linha);
  border-radius: var(--raio-cartao-pequeno);
  background: var(--superficie-2);
  cursor: pointer;
  gap: 14px;
  grid-template-columns: auto minmax(0, 1fr) auto;
  transition:
    background-color 160ms ease-out,
    border-color 160ms ease-out;
}

.cn__mestre--ligado {
  border-color: color-mix(in srgb, var(--musgo) 35%, var(--linha));
  background: var(--musgo-fundo);
}

.cn__mestre-icone {
  display: grid;
  width: 40px;
  height: 40px;
  place-items: center;
  border-radius: 12px;
  background: var(--superficie);
  color: var(--tinta-2);
  font-size: 19px;
}

.cn__mestre--ligado .cn__mestre-icone {
  background: var(--musgo);
  color: var(--sobre-musgo);
}

/* ------------------------------------------------------------------ as seções */

/* Um fio entre as seções, e não uma caixa para cada. */
.cn__secao {
  display: grid;
  gap: 14px;
  padding-top: 22px;
  border-top: 1px solid var(--linha);
}

.cn__titulo {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0;
  color: var(--tinta);
  font-size: 15.5px;
  font-weight: 650;
  letter-spacing: -0.01em;
}

/* O que o campo faz à esquerda, o campo à direita, todos na mesma coluna. */
.cn__campo {
  display: grid;
  align-items: center;
  gap: 8px 16px;
  grid-template-columns: minmax(0, 1fr) 14rem;
}

.cn__campo :deep(.p-select),
.cn__campo :deep(.p-inputtext),
.cn__campo :deep(.p-inputnumber) {
  width: 100%;
}

/* A lista da LC 116 tem nomes longos: o campo desce para a linha de baixo, na largura toda. */
.cn__campo--largo {
  grid-template-columns: minmax(0, 1fr);
}

.cn__segmento {
  justify-self: start;
  flex-wrap: wrap;
}

.cn__passo :deep(input) {
  text-align: center;
}

.cn__certificado {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px 14px;
}

.cn__trocar {
  justify-self: start;
}

.cn__erros {
  display: grid;
  gap: 2px;
  margin: 0;
  padding-inline-start: 18px;
}

@media (max-width: 560px) {
  .cn__campo {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
