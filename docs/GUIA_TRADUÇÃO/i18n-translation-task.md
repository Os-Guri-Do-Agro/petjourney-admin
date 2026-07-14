# Tarefa: Internacionalização (pt-BR → en / es) da Landing Page (Next.js)

> Documento de execução para o Claude. Siga as etapas **em ordem**, marcando cada uma como concluída antes de avançar. Não pule a fase de descoberta nem a de verificação.

---

## 0. Contexto do projeto (preencher antes de começar)

- **Público-alvo:** tutores, veterinários, pet lovers e clínicas veterinárias
- **Tom da marca:** formal, profissional e confiável — porém humano e natural.
- **Idiomas:** origem `pt-BR` → destino `en-[US/UK]` e `es-[neutro LatAm / ES]`
- **Tratamento:** inglês neutro ("you"); espanhol [formal "usted" / informal "tú"]
- **Stack i18n:** next-intl
- **Onde ficam os textos:** [Necessário adicionar no projeto, ainda não foi instalado nem criado os caminhos, além do mais, quero que tudo seja super organizado de forma profissional (Analisar o projeto com cuidado antes de criar para não acontecer nenhum conflito.)]
- **Termos que NÃO traduzir:** [nome da marca (nomes próprios), features próprias, termos técnicos]

---

## Princípios de tradução (valem para todas as etapas)

- **Localize, não traduza ao pé da letra.** Reescreva cada frase como um nativo escreveria do zero para vender o produto.
- **Soe natural.** Proibido: tradução literal, falsos cognatos, jargão corporativo vazio e qualquer construção "robotizada" que denuncie máquina.
- **Formal, mas humano.** Registro profissional sem rigidez nem rebuscamento.
- Preserve a **intenção e o impacto**, não a sintaxe. Pode reordenar, dividir ou unir frases.
- **Headlines e CTAs:** curtos, idiomáticos e persuasivos no idioma de destino — nunca palavra por palavra.
- Respeite convenções de cada idioma: capitalização de títulos em inglês, pontuação, números, datas, moeda, plurais e gênero/concordância (atenção redobrada no espanhol).

---

## Etapa 1 — Descoberta e mapeamento

**Objetivo:** entender a estrutura antes de tocar em qualquer coisa.

- [ ] Localizar todos os arquivos/objetos de tradução em pt-BR.
- [ ] Identificar a biblioteca i18n e como as chaves são consumidas (`useTranslations`, `t()`, etc.).
- [ ] Mapear placeholders e sintaxe especial em uso: `{name}`, `{{count}}`, ICU plural/select, tags `<b>`, markdown, `\n`.
- [ ] Listar quantas chaves existem e agrupá-las por seção da página (hero, features, pricing, footer, CTAs…).
- [ ] **Entregar:** `i18n-discovery.md` com o inventário (arquivos, nº de chaves, sintaxe especial encontrada, riscos).

⛔ Não avançar sem confirmar a estrutura comigo se algo estiver ambíguo.

---

## Etapa 2 — Glossário e guia de estilo

**Objetivo:** garantir consistência antes de traduzir em volume.

- [ ] Extrair termos recorrentes (produto, features, botões) e definir a tradução fixa em en e es.
- [ ] Definir tom e tratamento por idioma (decisão única, aplicada em tudo).
- [ ] Listar termos a manter em inglês / não traduzir.
- [ ] **Entregar:** `i18n-glossary.md` (tabela: termo pt | en | es | observação).

---

## Etapa 3 — Tradução para inglês

- [ ] Traduzir todas as chaves para `en`, aplicando os princípios e o glossário.
- [ ] Preservar **exatamente** chaves de JSON, placeholders, tags, markdown e quebras de linha — traduzir só o texto visível.
- [ ] Manter a mesma estrutura/keys do arquivo de origem.
- [ ] Sinalizar strings ambíguas com alternativas, em vez de adivinhar.
- [ ] **Entregar:** arquivo `en` no mesmo formato do original.

---

## Etapa 4 — Tradução para espanhol

- [ ] Repetir o processo da Etapa 3 para `es`.
- [ ] Atenção extra: concordância de gênero/número e tratamento formal/informal consistente.
- [ ] **Entregar:** arquivo `es` no mesmo formato do original.

---

## Etapa 5 — Verificação (não pular)

- [ ] **Paridade de chaves:** en e es têm exatamente as mesmas keys do pt (sem faltar/sobrar). Validar via script/diff.
- [ ] **Integridade técnica:** todos os placeholders, tags e markdown preservados em cada idioma.
- [ ] **JSON válido** (se aplicável): parse sem erro.
- [ ] **Revisão de naturalidade:** reler headlines e CTAs em voz de nativo; ajustar o que soar traduzido.
- [ ] **Consistência de glossário:** termos-chave traduzidos sempre igual.
- [ ] **Entregar:** `i18n-review.md` com o checklist preenchido e a lista de strings que pedem minha decisão.

---

## Etapa 6 — Integração e fechamento

- [ ] Confirmar que a config do i18n reconhece os novos locales (`en`, `es`) — roteamento, `locales`, `defaultLocale`.
- [ ] Indicar o que falta no código (ex: seletor de idioma) se não existir.
- [ ] Resumo final: o que foi traduzido, decisões tomadas e pendências para mim.

---

## Formato de entrega

Para cada locale, gerar o arquivo espelhando a estrutura do `pt`. Não alterar o arquivo de origem além do necessário. Toda decisão de tom/termo que não estiver clara → perguntar antes de assumir.
