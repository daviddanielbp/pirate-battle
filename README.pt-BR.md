# Pirate Battle

[![CI](https://github.com/daviddanielbp/pirate-battle/actions/workflows/ci.yml/badge.svg)](https://github.com/daviddanielbp/pirate-battle/actions/workflows/ci.yml)

[English](README.md) · **Português**

Um jogo de batalha naval com visão de cima que roda no navegador. Você navega entre ilhas, afunda Chasers e Shooters antes do tempo acabar, e a sua melhor partida vai para um ranking. O React desenha os menus, o PixiJS desenha o mar, e a batalha é uma simulação em TypeScript puro que não pertence a nenhum dos dois.

**Jogar:** https://pirate-battle-nine.vercel.app

![Gameplay: o navio do jogador afunda inimigos entre as ilhas](docs/media/gameplay.gif)

## Contexto

Fiz este projeto para um desafio técnico da Jungle Gaming em setembro de 2026. O enunciado, mantido sem alterações em [docs/CHALLENGE.md](docs/CHALLENGE.md), pedia um jogo completo numa stack fixa (React, TypeScript estrito, PixiJS, TanStack Query, Axios, MSW, Playwright), uma API de ranking simulada com cenários de falha, acessibilidade, relatório de performance e deploy público. Não passei para a última etapa. Deixo o repositório público porque é o trabalho de front-end mais completo que tenho para mostrar, e porque o que eu faria diferente vale ser registrado (veja [O que eu mudaria](#o-que-eu-mudaria)).

## O que tem

- **Gameplay:** aceleração e rotação, um canhão frontal e dois disparos laterais de três balas, dois tipos de inimigo (o Chaser, que te abalroa, e o Shooter, que mantém distância e atira quando tem linha de visão), ilhas que bloqueiam navios e balas, um mapa novo gerado a partir da seed de cada partida, pausa automática quando a aba perde o foco.
- **Ranking e histórico** servidos por uma API mock em MSW que roda também no build publicado, com 14 cenários de rede (lentidão, latência variável, respostas fora de ordem, timeout, 4xx/5xx, envio que dá timeout depois de gravado, entre outros). O registro é idempotente pelo id da partida e sobrevive a um refresh.
- **Desktop e mobile:** teclado, direção pelo mouse (opcional) e botões de toque. Em retrato a arena gira 90° para continuar inteira na tela.
- **Extras além do enunciado** ([EXTRAS.md](EXTRAS.md)): moedas, XP e níveis, um Estaleiro com cascos, canhões e upgrades, quatro idiomas na interface. Todos são opcionais ou não mexem nas regras pedidas.

| Menu | Batalha | Mobile (paisagem, toque) |
| --- | --- | --- |
| ![Menu principal](docs/media/menu.jpg) | ![Batalha](docs/media/battle.jpg) | ![Batalha no celular com controles de toque](docs/media/mobile-battle.jpg) |

## Decisões técnicas

**A simulação é dona da batalha.** `MatchSimulation` ([src/game/core/simulation.ts](src/game/core/simulation.ts)) não importa Pixi nem React. Ela avança em passos fixos de 1/60 s a partir de um acumulador, então movimento, cooldowns e spawns não dependem da taxa de quadros, e a mesma seed com os mesmos comandos gera a mesma partida. O Pixi lê a simulação a cada frame e desenha; o React nunca vê um frame.

**O React renderiza mais ou menos uma vez por segundo.** O runtime publica um snapshot pequeno do HUD via `useSyncExternalStore` e só notifica quando muda algo que o React mostra (segundos inteiros, pontuação, vida, estado). Pontuação, tempo e vida são desenhados no canvas; uma cópia visualmente oculta, com live region educada, atende leitores de tela e os testes.

**Todo número de balanceamento fica numa config tipada.** [gameplayConfig.ts](src/game/config/gameplayConfig.ts) concentra velocidades, dano, cooldowns, regras de spawn e alcances. As opções e os upgrades do Estaleiro geram uma cópia modificada quando a partida começa, então mudar qualquer um deles não afeta a batalha em andamento nem o código dos sistemas.

**O ciclo de vida dos recursos é explícito.** Um `Application` do Pixi por partida, destruído na saída junto com o ticker, os listeners e os sprites em pool. A montagem dupla do React Strict Mode é tratada com uma flag `disposed` checada depois do `init` assíncrono. Os atlas ficam em cache no `Assets`, então reiniciar não reenvia texturas para a GPU. Depois de cinco ciclos de iniciar, jogar e sair, o heap de JS estabiliza em torno de 10,8 MB ([docs/PERFORMANCE.md](docs/PERFORMANCE.md)).

**O registro de partidas passa pelo TanStack Query, não por fora dele.** Cada envio roda num `MutationObserver` com escopo no id da partida, com uma única promise em andamento por id, fila de pendentes no `localStorage` e novas tentativas ao abrir o app ou sob demanda. As consultas de lista são canceladas antes da invalidação, para que uma resposta atrasada não sobrescreva uma mais nova.

**Os testes jogam o jogo de verdade.** Com `?test=1&clock=manual` o app expõe uma API de teste que aperta os mesmos controles do jogador e avança o relógio manualmente. O Playwright usa isso para verificar movimento, colisões, dano, cooldowns, spawns, pausa e fim de partida de forma determinística, além dos fluxos de interface, da regressão visual e da auditoria com axe-core.

Mais detalhes: [ARCHITECTURE.md](ARCHITECTURE.md), [SOLUTION.md](SOLUTION.md) (setup, controles, cenários de rede, como reproduzir falhas) e [docs/DEVELOPMENT_NOTES.md](docs/DEVELOPMENT_NOTES.md) (como foi construído, bugs achados jogando e revisando). Esses documentos estão em inglês, como o enunciado pedia.

## Como rodar

Requisitos: Node.js 20+ e pnpm 10 (`corepack enable` usa a versão fixada no `package.json`).

```bash
pnpm install
pnpm dev            # http://localhost:5173
pnpm build          # checagem de tipos + build de produção em dist/
pnpm preview        # serve dist/ em http://localhost:4173
pnpm lint
pnpm typecheck
```

Não há backend nem variável de ambiente obrigatória: a API mock roda no navegador. O `.env.example` lista as duas opcionais.

Controles: `W`/`↑` navega, `A`/`D` ou `←`/`→` vira, `Espaço` canhão frontal, `Q`/`E` disparos laterais, `Esc`/`P` pausa. Os botões de toque aparecem em telas sensíveis ao toque (ou com `?touch=1`).

## Testes

```bash
pnpm test:unit                            # Vitest: regras da simulação, gerador de arena, progressão
pnpm exec playwright install chromium     # uma vez
pnpm test:e2e                             # faz o build, sobe o preview e roda o Playwright
pnpm test:report                          # abre o relatório HTML
```

| Suíte | Tamanho | Onde roda |
| --- | --- | --- |
| Unitários (Vitest) | 216 testes em 3 arquivos (200 são uma checagem por seed de arena), menos de 1 s. `pnpm test:unit:coverage` gera a cobertura de `src/game/core` e da progressão | CI e local |
| End-to-end (Playwright) | 202 testes em 17 arquivos: 101 specs × Chromium desktop e mobile, 2 pulados de propósito (só toque). Cerca de 17 min localmente com 3 workers | CI (um job por projeto) e local |
| Regressão visual | 3 telas × 2 viewports, baselines em `e2e/__screenshots__/` | Local. As baselines foram gravadas no macOS e o Linux rasteriza fontes e WebGL de outro jeito, então o CI roda com `--ignore-snapshots` |
| Acessibilidade | axe-core, WCAG 2.0/2.1 A e AA, todas as telas e diálogos | Dentro da suíte do Playwright |

O CI ([.github/workflows/ci.yml](.github/workflows/ci.yml)) roda lint, typecheck, testes unitários, build e os dois projetos do Playwright, e publica o relatório HTML e os traces de falha como artefatos.

## Números

| O quê | Resultado |
| --- | --- |
| Batalha de 3 minutos, build de produção, MacBook Air M3, DPR 2 | 60 FPS de média, p95 do tempo de frame 17,6 ms, pico de 11 entidades ([relatório](docs/PERFORMANCE.md)) |
| Heap de JS após 5 ciclos de iniciar, jogar e sair | 9,9 → 10,8 MB, com incrementos cada vez menores |
| Lighthouse no deploy (mobile / desktop) | Performance 79 / 98, Acessibilidade 94, Boas práticas 100. Com a batalha carregada sob demanda (abaixo), uma medição local em mobile foi de 78–80 para 89 |
| JavaScript antes da primeira tela (gzip) | 291 KB. O PixiJS (170 KB) agora carrega quando você aperta Play, e não no menu; antes dessa mudança eram 475 KB. O chunk de entrada ainda leva o MSW, que um produto real não mandaria para o usuário |

## O que eu mudaria

- **Muita regra testada só pelo navegador.** A simulação é pura e determinística, mas na entrega eu testei tudo via Playwright, uma ida e volta à página por vez; alguns testes de combate levam quase um minuto. Os testes com Vitest em `tests/unit/` vieram depois. A divisão certa é a maior parte das regras em teste unitário e uma camada E2E mais fina para fluxos de interface e integração.
- **Um dia foi pouco para esse escopo.** Construí tudo num dia longo, com um assistente de IA escrevendo a maior parte dos primeiros rascunhos (o [DEVELOPMENT_NOTES](docs/DEVELOPMENT_NOTES.md) registra isso). Os extras (Estaleiro, idiomas, arenas aleatórias) consumiram tempo que deveria ter ido para as partes obrigatórias e para um histórico legível.
- **O histórico de commits não mostra o processo.** A maioria dos commits tem o mesmo horário porque reorganizei o histórico antes de entregar. Commits pequenos feitos ao longo do trabalho contariam a história melhor.
- **Pontas soltas na entrega:** a documentação apontava para um relatório do Playwright que não estava no repositório, e faltaram as notas de licença dos assets que o enunciado pedia.

## Créditos

A arte e os efeitos sonoros vieram junto com o enunciado do desafio (`assets/`); `pnpm assets:build` empacota esses arquivos nos atlas e áudios de `public/assets/`. Código de David Daniel.
