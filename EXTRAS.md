# Extras

Everything in this document is an addition on top of the brief. Each extra follows the same rule: the default behavior is exactly what the brief describes (single-shot front cannon, three-shot broadsides, keyboard steering, English interface, one match started from `Play`, the whole arena visible, ranking and history served by MSW), and the extra is either opt-in or invisible to the rules. This file explains what each extra is, why it exists and where it lives in the code.

## Random arenas

**What:** every match generates its own island layout instead of reusing one hand-made map.

**Why:** with a fixed map the second battle already feels like the first; a new layout per match keeps navigation and enemy approaches interesting without touching the rules.

**How it works:** `src/game/core/arenaGenerator.ts` builds an `ArenaDefinition` from the match seed. The arena is a grid of 29 × 16 cells of 64 px (1856 × 1024 logical pixels). The generator places 4–8 islands of varied shapes, keeps them one cell away from the borders and two cells away from each other, keeps a 7 × 7-cell clear zone around the player start, and runs a breadth-first search over the water cells to reject any layout where part of the sea is unreachable. Because the layout is a pure function of the seed, `?seed=<value>` reproduces the same arena, which is what the end-to-end tests rely on. Enemies path around islands with a navigation grid (`src/game/core/navigation.ts`) when the straight line to the player is blocked.

## Mouse steering

**What:** `Options → Steering` lets the player choose how the ship is steered.

| Mode | Turning | Sailing | Cannons |
| --- | --- | --- | --- |
| Keyboard (default) | `A`/`D` or arrows | `W` / arrow up | `Space`, `Q`, `E` |
| Mouse | the ship turns toward the cursor, limited by the ship's rotation speed; `A`/`D` are ignored | `W` | left click or `Space` for the front cannon, `Q` / `E` for the broadsides |

**Why:** some players find it more natural to point than to steer with keys. The front cannon still fires along the ship's heading, so aiming is still about positioning the ship; the mouse only replaces the turn keys and doubles as a fire button.

**How it works:** `src/game/input/pointerSteering.ts` converts pointer positions to arena coordinates through the same transform that letterboxes (or rotates, in portrait) the canvas — `BattleRuntime.toArenaPoint` uses Pixi's `Container.toLocal` — and feeds a target heading to the shared `ControlState`. The simulation rotates the player toward that heading with the configured rotation speed, so mouse and keyboard produce the same turn rate. Touch controls are unchanged.

## Progression: coins, experience and levels

**What:** completed matches grant coins and experience; levels make enemies tougher.

- 1 coin per enemy sunk;
- 1 XP per Chaser and 2 XP per Shooter sunk;
- level 2 needs 30 XP, and each next level needs 10 XP more than the previous one (40, 50, …);
- every level above 1 makes enemy hulls 10% tougher (Chaser 50 → 55 → 60 HP, Shooter 80 → 88 → 96 HP, rounded).

**Why:** it gives the score-attack loop a reason to come back, and the level scaling keeps later battles challenging for a player whose ship has been upgraded.

**How it works:** `src/game/progression/progression.ts` holds the rules and `src/storage/progressStore.ts` persists them (`pirate-battle.progress.v1`). Rewards are computed from the kill counts the simulation tracks and are granted only when a match ends; an abandoned match grants nothing, mirroring the rule that abandoned matches are not recorded. The result screen shows the rewards, and the loadout used in a match (level, hull, cannon, upgrade levels) is stored with the match record and shown in the match history. The ranking still compares battles by session time and spawn interval, as the brief requires; the loadout is informative only.

## Shipyard

**What:** a shop reachable from the main menu where coins buy hulls, cannons and upgrades.

| Item | Effect | Price |
| --- | --- | --- |
| Black Skull | Balanced hull, no modifiers (default) | owned |
| White Sails | +15% speed, −15% health | 20 coins |
| Crimson Cross | +20% damage, −15% health, −10% speed | 30 coins |
| Jade Blades | Repairs 2 health per second while sailing | 30 coins |
| Azure Steed | Cannons reload 25% faster | 40 coins |
| Golden Bones | Each enemy sunk has a 35% chance to drop double coins | 60 coins |
| Twin Cannon | Two cannonballs per front shot, 1.5× the damage of a single shot in total (0.75× each) | 50 coins |
| Broadside Cannon | Fires ahead and to both sides at once, three cannonballs at 0.7× damage each | 90 coins |
| Reinforced hull | +10% max health per level, up to +40% | 20 / 35 / 50 / 70 |
| Heavy shot | +10% cannon damage per level (front and broadsides), up to +40% | 25 / 40 / 60 / 80 |
| Silk sails | +10% speed and acceleration per level, up to +40% | 20 / 35 / 50 / 70 |

**Why:** it turns coins into meaningful choices and gives each hull a personality instead of being a recolor.

**How it works:** hull traits, cannons and upgrades never touch the game systems directly. `applyLoadout` in `src/game/progression/progression.ts` produces a modified `GameplayConfig` at match start, through the same snapshot mechanism the options use, so a purchase applies to the next match and the simulation keeps reading one typed config. The hull sprite is chosen by `HULL_SPRITE_INDEX`, including its damaged states. The shop page is `src/ui/pages/ShipyardScreen.tsx`.

## Interface languages

**What:** `Options → Language` switches the interface between English (default), Português (Brasil), Português (Portugal) and Español.

**Why:** the game is meant to be shared with players who do not read English; the default stays English so the delivery matches the brief.

**How it works:** dictionaries live in `src/i18n/messages/`. `en.ts` is the typed source of truth (`MessageKey` is derived from its keys), and every other language is a `Record<MessageKey, string>`, so a missing translation is a compile-time error; at runtime a missing key falls back to English. The choice is saved with the other options and applied through `useTranslation()`; `document.documentElement.lang` follows it. Keyboard key names, the game name, shipyard item names and network-scenario descriptions stay in English.

## In-canvas HUD

**What:** score, time, the player's health bar and three cannon cooldown bars are drawn inside the PixiJS canvas with the provided HUD sprites.

**Why:** the brief provides HUD sprites and asks for score and time in the HUD; drawing them in the canvas keeps the arena and its indicators in one rendering pipeline and lets the layout follow the canvas (it stacks on narrow screens and stays in screen space when the world is rotated for portrait).

**How it works:** `src/game/render/hudLayer.ts` is a Pixi layer placed on the stage in screen coordinates, updated by the runtime only when values change. The React layer keeps the pause button and a visually hidden semantic copy of the same values with a polite live region for phase changes, so assistive technology and the tests read the state without per-frame React rendering.

## Presentation and feedback

- Screens and dialogs fade and rise into place; motion is disabled when the system asks for reduced motion.
- Surviving a battle shows a victory banner and an animated score, and the result screen links to the Shipyard so rewards can be spent immediately.
- Transient confirmations (options saved, purchases, network scenario applied) appear as toasts in the top-right corner above every layer, so they never move the buttons the player is about to press.
- Taking damage shakes the camera briefly; the HUD shows when each cannon is ready.
- Options also hold volume and mute; the browser's audio context is unlocked by the first click or key press on the menu.
