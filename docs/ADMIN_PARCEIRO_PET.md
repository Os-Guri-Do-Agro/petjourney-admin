# Admin Parceiro PetJourney

## Direção

O painel admin deve evoluir como uma ferramenta profissional para veterinários e parceiros da indústria pet acessarem informações autorizadas dos pets. O foco é consulta, rotina operacional e tomada de decisão, não uma experiência de tutor.

## Modelo de Navegação

- O app usa um shell autenticado global.
- O navegador lateral é dividido em seções.
- Cada seção é representada por um ícone na rail esquerda.
- Ao selecionar uma seção, o painel ao lado lista as páginas disponíveis daquela seção.
- O header é fixo apenas na área de conteúdo à direita e não cobre o navegador.
- O header possui modo foco/fullscreen para esconder o navegador e destacar a página atual.

## Seções Iniciais

- Operação: dashboard, agenda e atividades.
- Pets: pacientes, prontuários e compartilhamentos.
- Parceiro: empresa, equipe e integrações.
- Conta: perfil e configurações.

## Regras Visuais

- Layout deve seguir padrão SaaS profissional: sidebar estruturada, header limpo, cards brancos e superfície principal cinza-clara.
- `Colors.primary` é texto forte, títulos e marca institucional.
- A cor principal do perfil logado vira o acento visual do sistema.
- Não usar `border-left` como recurso visual.
- Preferir badges, dots, fundos sutis, bordas completas e hierarquia tipográfica.

## Contexto de Produto

O parceiro/veterinário acessa dados do pet para atendimento, revisão de histórico, prontuário, agenda, pendências e compartilhamentos autorizados. As próximas telas devem sempre responder: qual informação do pet/parceiro ajuda a agir com segurança agora?
