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

/**
 * `matchMedia` cai na mesma categoria, e chegou pelo mesmo caminho.
 *
 * O `Select` do PrimeVue consulta a orientação da tela ao montar, para decidir se abre a lista
 * como overlay ou em tela cheia. No jsdom não há tela, a função não existe e a montagem inteira
 * morre com `matchMedia is not a function` — um erro sobre viewport num teste que está afirmando
 * regra de cadastro.
 *
 * O dublê responde "não casa" e não notifica ninguém: sem layout, não há mudança de orientação
 * para ouvir.
 *
 * A guarda testa `typeof`, e não `in`: o jsdom **declara** `matchMedia` e a deixa `undefined`, de
 * modo que `'matchMedia' in globalThis` é verdadeiro e o dublê nunca seria instalado.
 */
if (typeof globalThis.matchMedia !== 'function') {
  globalThis.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent: () => false,
  })) as unknown as typeof matchMedia
}
