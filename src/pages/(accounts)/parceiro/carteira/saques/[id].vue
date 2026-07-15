<script setup lang="ts">
import { onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()

onMounted(() => {
  const id = typeof route.params.id === 'string' ? route.params.id : ''

  void router.replace({
    path: '/parceiro/carteira',
    query: {
      aba: 'saques',
      ...(id ? { saque: id } : {}),
    },
  })
})
</script>

<template>
  <div class="saque-detail-redirect" aria-hidden="true" />
</template>
