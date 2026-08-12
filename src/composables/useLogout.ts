import { useRouter } from 'vue-router'

import { clearAuthSession } from '@/service/auth/auth-session'
import { useParceiroStore } from '@/stores/parceiro'
import { useUsuarioPerfilStore } from '@/stores/usuario-perfil'

/** Saída da conta em um lugar só: shell e tela de acesso encerrado limpam o mesmo estado. */
export function useLogout() {
  const router = useRouter()
  const parceiroStore = useParceiroStore()
  const usuarioPerfilStore = useUsuarioPerfilStore()

  async function logout() {
    parceiroStore.reset()
    usuarioPerfilStore.clear()
    clearAuthSession()
    await router.replace('/auth/login')
  }

  return { logout }
}
