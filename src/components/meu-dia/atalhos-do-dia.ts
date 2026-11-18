/**
 * O que dá para fazer no Hoje quando o dia está calmo (pedido do Luís, 17/11/2026: "nada pode
 * simplesmente ficar vazio, indique ao usuário o que ele pode fazer"). As mesmas regras das Ações
 * rápidas do Início: a tela está no menu da pessoa (módulo ligado, permissão de ler) e, para criar,
 * a Clínica com escrita e a permissão da ação. Na demonstração, tudo aparece.
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { RouteLocationRaw } from 'vue-router'

import { useModoDemonstracao } from '@/composables/useModoDemonstracao'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { useEspacos } from '@/navegacao/espacos'

export type AtalhoDoDia = {
  id: 'marcar' | 'chamada' | 'pedidos' | 'espera' | 'paciente'
  rotulo: string
  dica: string
  icone: string
  to: RouteLocationRaw
}

/** Até quatro: é um empurrão para o dia calmo, não outro menu. */
const LIMITE = 4

export function useAtalhosDoDia() {
  const { t } = useI18n()
  const { store } = useParceiroPortal()
  const { espacos } = useEspacos()
  const { ativo: demonstracao } = useModoDemonstracao()

  function temTela(to: string) {
    return espacos.value.some((espaco) =>
      espaco.destinos.some((destino) => destino.abas.some((aba) => aba.to === to)),
    )
  }

  type Permissao = Parameters<typeof store.temPermissao>[0]

  function pode(permissao: Permissao) {
    return (
      demonstracao.value ||
      (Boolean(store.modulo('CLINICA')?.podeEscrever) && store.temPermissao(permissao))
    )
  }

  const podeMarcar = computed(() => temTela('/clinica/agenda') && pode('agenda.escrever'))

  const atalhos = computed<AtalhoDoDia[]>(() => {
    const atalho = (id: AtalhoDoDia['id'], icone: string, to: RouteLocationRaw): AtalhoDoDia => ({
      id,
      icone,
      to,
      rotulo: t(`clinico.meuDia.vazio.adiantar.${id}.rotulo`),
      dica: t(`clinico.meuDia.vazio.adiantar.${id}.dica`),
    })

    /* Marcar horário já está no cartão do alto e no guia da fila: aqui, o que mais dá para adiantar. */
    const lista: AtalhoDoDia[] = []
    if (temTela('/clinica/vacinas')) {
      lista.push(atalho('chamada', 'ph ph-syringe', '/clinica/vacinas'))
    }
    if (temTela('/clinica/pedidos')) {
      lista.push(atalho('pedidos', 'ph ph-tray-arrow-down', '/clinica/pedidos'))
    }
    if (temTela('/clinica/fila')) {
      lista.push(atalho('espera', 'ph ph-hourglass-medium', '/clinica/fila'))
    }
    if (temTela('/clinica/pacientes') && pode('paciente.escrever')) {
      lista.push(
        atalho('paciente', 'ph ph-paw-print', {
          path: '/clinica/pacientes',
          query: { novo: '1' },
        }),
      )
    }

    return lista.slice(0, LIMITE)
  })

  return { podeMarcar, atalhos }
}
