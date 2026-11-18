/**
 * Modo demonstração: as telas de verdade do portal sobre uma clínica de exemplo cheia de dados.
 *
 * Não existe tela de demonstração: com o modo ligado, toda chamada à API (`apiFetch`) é respondida
 * aqui no navegador, pelas rotas de `rotas/`, com dados na forma do contrato. O portal monta como
 * se falasse com o servidor; o que aparece é exatamente a estrutura que o usuário real vê hoje.
 *
 * - **Quem:** a dona da "Vila Madalena Pet" (`base/clinica.ts`), com a Clínica ligada e o Hotel
 *   desligado, como está no portal hoje.
 * - **Quando:** o relógio começa às 10:40 de hoje (`relogio.ts`; `?hora=HH:MM` muda), para o dia
 *   sair cheio a qualquer hora.
 * - **O que muda nos dados** (criar, confirmar, finalizar) vale até recarregar a página: tudo mora
 *   na memória e nasce igual a cada carga.
 * - **Onde:** só fora da produção (`npm run dev` e o build do `develop`). Liga e desliga pelo menu
 *   da conta; ao ligar, a sessão de verdade fica guardada e volta ao desligar (`sessao.ts`).
 */
import { interceptarApi } from '@/service/api'

import { instalarRelogio } from './relogio'
import { despachar } from './roteador'
import { garantirSessaoDaDemonstracao } from './sessao'

export async function instalarDemonstracao() {
  instalarRelogio()
  garantirSessaoDaDemonstracao()
  /* Os dados nascem no import, já com o relógio deslocado. */
  const { registrarRotas } = await import('./rotas')
  registrarRotas()
  interceptarApi(despachar)
}
