<script setup lang="ts">
/**
 * A etiqueta que o Consultório Móvel imprime no fim do atendimento do piloto: o QR Code da ficha,
 * o animal, quem leva (tutor ou ONG, com o documento se informado) e os próximos cuidados. O tutor
 * leva no bolso; a equipe recorta na linha tracejada.
 *
 * Não é tela: mora no `body` marcada `clinic-print-root` e só existe enquanto a gaveta imprime (a
 * regra de impressão do portal mostra só ela, como no Relatório de 90 dias). Papel branco nos dois
 * temas, cores escritas por extenso: no tema escuro os tokens da tela seriam os do escuro.
 *
 * O CPF sai mascarado (só os dígitos do meio): a etiqueta pode ficar esquecida no balcão. O CNPJ é
 * público e sai inteiro.
 */
import { computed } from 'vue'

import logoEmCreme from '@/assets/Logos/logo-pata-e-nome-creme.png'
import {
  dataCurta,
  procedimento,
  proximosCuidados,
  type AtendimentoDoPiloto,
  type Procedimento,
} from '@/features/saude-publica/dados'
import type { QuemLeva } from '@/features/saude-publica/estado'
import { formatCnpj } from '@/utils/validation/cnpj'

const props = defineProps<{
  animal: string
  especie: AtendimentoDoPiloto['especie']
  data: string
  procedimentos: readonly Procedimento[]
  quem: QuemLeva
  /** O nome do tutor ou da ONG. */
  responsavel: string
  /** Só os dígitos; vazio quando não foi informado. */
  cpf: string
  /** Sem máscara; vazio quando não foi informado. */
  cnpj: string
  /** O QR já gerado, em PNG. */
  imagem: string
}>()

const cuidados = computed(() => proximosCuidados(props.data, props.procedimentos))

function cpfMascarado(digitos: string) {
  return `***.${digitos.slice(3, 6)}.${digitos.slice(6, 9)}-**`
}
</script>

<template>
  <Teleport to="body">
    <div class="clinic-print-root et" aria-hidden="true">
      <article class="et__cartao">
        <header class="et__faixa">
          <img :src="logoEmCreme" alt="PetJourney" class="et__marca" />
          <span>Piloto com a Subea · Consultório Móvel</span>
        </header>

        <div class="et__corpo">
          <div class="et__animal">
            <strong>{{ animal }}</strong>
            <span>
              {{ especie === 'GATO' ? 'Gato' : 'Cachorro' }} · atendido em {{ dataCurta(data) }}
            </span>
          </div>

          <img :src="imagem" alt="" class="et__qr" />
          <p class="et__chamada">
            Aponte a câmera do celular para o QR Code: a ficha de {{ animal }} abre sem baixar app
            nem criar senha.
          </p>

          <dl class="et__dados">
            <div>
              <dt>{{ quem === 'ong' ? 'ONG' : 'Tutor' }}</dt>
              <dd>{{ responsavel }}</dd>
            </div>
            <div v-if="quem === 'tutor' && cpf">
              <dt>CPF</dt>
              <dd>{{ cpfMascarado(cpf) }}</dd>
            </div>
            <div v-if="quem === 'ong' && cnpj">
              <dt>CNPJ</dt>
              <dd>{{ formatCnpj(cnpj) }}</dd>
            </div>
            <div>
              <dt>O que foi feito</dt>
              <dd>{{ procedimentos.map((id) => procedimento(id).rotulo).join(' · ') }}</dd>
            </div>
          </dl>

          <section v-if="cuidados.length" class="et__cuidados">
            <h2>Próximos cuidados</h2>
            <ul>
              <li v-for="cuidado in cuidados" :key="cuidado.procedimento">
                <span>{{ cuidado.rotulo }}</span>
                <b>{{ dataCurta(cuidado.data) }}</b>
              </li>
            </ul>
          </section>

          <p class="et__pe">Protótipo: o QR Code abre o site da PetJourney.</p>
        </div>
      </article>

      <p class="et__recorte">
        <i class="ph ph-scissors" aria-hidden="true" />
        Recorte na linha tracejada
      </p>
    </div>
  </Teleport>
</template>

<style scoped>
/* A etiqueta em milímetros: do tamanho de um bolso, no alto da folha. */
.et__cartao {
  width: 96mm;
  box-sizing: border-box;
  overflow: hidden;
  border: 0.4mm dashed #7d8b87;
  border-radius: 4mm;
  background: #fff;
  color: #10302a;
  font-family: var(--font-texto, system-ui, sans-serif);
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}

.et__faixa {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 3mm;
  padding: 3mm 4mm;
  background: #76938d;
  color: #fff;
  font-size: 8.5pt;
  font-weight: 600;
}

.et__marca {
  height: 6mm;
  width: auto;
}

.et__corpo {
  display: grid;
  justify-items: center;
  gap: 2.6mm;
  padding: 4mm 5mm 4mm;
}

.et__animal {
  display: grid;
  justify-items: center;
  gap: 0.6mm;
  text-align: center;
}

.et__animal strong {
  font-size: 17pt;
  line-height: 1.1;
}

.et__animal span {
  color: #3d524d;
  font-size: 9pt;
}

.et__qr {
  width: 46mm;
  height: 46mm;
  image-rendering: pixelated;
}

.et__chamada {
  max-width: 76mm;
  margin: 0;
  color: #3d524d;
  font-size: 8.5pt;
  line-height: 1.35;
  text-align: center;
}

.et__dados {
  display: grid;
  width: 100%;
  gap: 1.4mm;
  margin: 0;
  padding: 2.6mm 0 0;
  border-top: 0.3mm solid #d5dedb;
}

.et__dados div {
  display: flex;
  justify-content: space-between;
  gap: 4mm;
  font-size: 9pt;
}

.et__dados dt {
  flex: none;
  color: #3d524d;
}

.et__dados dd {
  margin: 0;
  font-weight: 650;
  text-align: end;
}

.et__cuidados {
  width: 100%;
  padding: 2.6mm 3mm;
  box-sizing: border-box;
  border-radius: 2.4mm;
  background: #e9f1ee;
}

.et__cuidados h2 {
  margin: 0 0 1.4mm;
  font-size: 9pt;
  font-weight: 700;
}

.et__cuidados ul {
  display: grid;
  gap: 1mm;
  margin: 0;
  padding: 0;
  list-style: none;
}

.et__cuidados li {
  display: flex;
  justify-content: space-between;
  gap: 4mm;
  font-size: 9pt;
}

.et__pe {
  margin: 0;
  color: #5b6b67;
  font-size: 7.5pt;
}

.et__recorte {
  display: flex;
  width: 96mm;
  align-items: center;
  justify-content: center;
  gap: 1.5mm;
  margin: 2mm 0 0;
  color: #7d8b87;
  font-family: var(--font-texto, system-ui, sans-serif);
  font-size: 7.5pt;
}
</style>
