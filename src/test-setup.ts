/**
 * O que o jsdom não tem e a biblioteca de componentes assume.
 *
 * `ResizeObserver` é API de navegador que o jsdom não implementa. Nenhum teste precisava dela até
 * o diálogo de alta usar um `Textarea` com `auto-resize` — que a mede no `mounted` e derruba a
 * montagem inteira com `ResizeObserver is not defined`, um erro que não tem relação nenhuma com o
 * que o teste está afirmando.
 *
 * O dublê não observa nada, e é isso mesmo: em teste de jsdom não há layout para observar, e o
 * que se quer provar é o comportamento do formulário, não a altura do campo. Deixar o
 * comportamento real exigiria um navegador de verdade — que é outro tipo de teste.
 */

if (!('ResizeObserver' in globalThis)) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
}
