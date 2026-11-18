/**
 * O que a moldura pede antes de qualquer tela: entrada, troca de perfil, `/eu`, dashboard e status
 * do credenciamento. A clínica de exemplo está aprovada, com os dois programas ativos e a Clínica
 * ligada; quem entra é a dona.
 */
import type { PerfisConta } from '@/service/auth/auth-service'
import type { EuNoParceiro } from '@/service/parceiro/acesso-service'
import type { PortalDashboard, PortalStatus } from '@/service/parceiro/types'

import {
  CNPJ,
  modulos,
  PARCEIRO_ID,
  PARCEIRO_NOME,
  PERMISSOES,
  profissional,
  USUARIO_ID,
} from '../base/clinica'
import { CUPONS, RESGATES } from '../dados/portal'
import { agora } from '../relogio'
import { ok, rota, vazio } from '../roteador'
import { tokensDaDemonstracao } from '../sessao'

export function registrarNucleo() {
  /* Qualquer e-mail e senha entram, como a dona da clínica de exemplo. */
  rota('POST', '/auth/login', () => ok(tokensDaDemonstracao()))
  rota('POST', '/auth/refresh', () => ok(tokensDaDemonstracao()))
  rota('POST', '/auth/trocar-perfil', () => ok(tokensDaDemonstracao()))
  rota('POST', '/auth/logout', () => vazio())

  rota('GET', '/auth/perfis', () =>
    ok<PerfisConta>({
      usuarioId: USUARIO_ID,
      tutor: null,
      parceiros: [
        { parceiroId: PARCEIRO_ID, nome: PARCEIRO_NOME, papel: 'DONO', status: 'APROVADO' },
      ],
    }),
  )

  rota('GET', '/parceiro/portal/eu', () =>
    ok<EuNoParceiro>({
      parceiroId: PARCEIRO_ID,
      papel: 'DONO',
      papeisOperacionais: ['VETERINARIO', 'GESTOR'],
      profissional: profissional('demo-prof-marina'),
      permissoes: PERMISSOES,
      aguardandoCrmv: [],
      aguardandoConferencia: [],
      atosAguardandoConferencia: [],
      motivoDaConferencia: null,
      identidade: { status: 'APROVADA' },
      modulos: modulos(),
      elegiveis: ['CLINICA'],
    }),
  )

  rota('GET', '/parceiro/portal/dashboard', () =>
    ok<PortalDashboard>({
      parceiro: {
        id: PARCEIRO_ID,
        nome: PARCEIRO_NOME,
        logoUrl: null,
        statusAuditoria: 'APROVADO',
        motivoAuditoria: null,
        cnpj: CNPJ,
      },
      papel: 'DONO',
      totais: {
        cuponsAtivos: CUPONS.filter((c) => c.ativo).length,
        resgatesTotal: RESGATES.length,
        resgatesUltimos30d: RESGATES.filter(
          (r) => Date.parse(r.resgatadoEm) >= agora().getTime() - 30 * 86_400_000,
        ).length,
      },
    }),
  )

  rota('GET', '/parceiro/portal/status', () => {
    const ativo = {
      status: 'ATIVO' as const,
      motivo: null,
      decididoEm: '2025-03-14T15:20:00-03:00',
      podeSolicitar: false,
    }
    return ok<PortalStatus>({
      statusAuditoria: 'APROVADO',
      auditadoEm: '2025-03-14T15:20:00-03:00',
      podeOperar: true,
      afiliado: ativo,
      participativo: ativo,
      statusAfiliado: 'ATIVO',
      statusParticipativo: 'ATIVO',
    })
  })
}
