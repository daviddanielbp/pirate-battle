# Extras

Everything in this file goes beyond the brief. Each extra was designed so the required behavior stays intact: the default cannon is still a single front projectile with three parallel broadside shots, `Play` still starts a full match, the whole arena stays visible, options still expose session time and spawn interval, and abandoned matches still record nothing.

## Random arenas

Every match generates its own island layout from the match seed (`src/game/core/arenaGenerator.ts`). The arena is 29 × 16 cells (1856 × 1024 logical pixels, about 15% larger than the original layout) and always fully visible. The generator places 4–8 islands of varied shapes, keeps them away from the borders and from each other, keeps a clear zone around the player start, and rejects layouts whose water is not fully connected, so no pocket of the map is unreachable for the player or the enemies. The same seed always produces the same arena, which keeps the end-to-end tests deterministic (`?seed=`).

## Mouse steering

`Options → Steering` chooses how the ship is steered:

| Mode | Turning | Sailing | Cannons |
| --- | --- | --- | --- |
| Keyboard (default) | `A`/`D` or arrows | `W` / arrow up | `Space`, `Q`, `E` |
| Mouse | the ship turns toward the cursor, limited by the same rotation speed; `A`/`D` are disabled | `W` | left click or `Space` for the front cannon, `Q`, `E` for the broadsides |

The front cannon always fires along the ship's heading, so aiming still means positioning the ship; the mouse replaces the turn keys and doubles as a fire button. Touch controls are unchanged. Pointer coordinates are mapped back to arena space through the same letterbox transform used to fit the canvas (`BattleRuntime.toArenaPoint`).

## Progression: coins, experience and levels

Completed matches (never abandoned ones) grant rewards, shown on the result screen and stored locally (`pirate-battle.progress.v1`):

- 1 coin per enemy sunk;
- 1 XP per Chaser and 2 XP per Shooter sunk;
- level 2 needs 30 XP, and each next level needs 10 XP more than the previous one (40, 50, …);
- every level above 1 makes enemy hulls 10% tougher (Chaser 50 → 55 → 60 HP, Shooter 80 → 88 → 96 HP, rounded).

The loadout used in a match (level, hull, cannon, upgrade levels) is recorded with the match and shown in the match history. The ranking still compares battles by session time and spawn interval, as the brief requires; the loadout is informative only.

## Shipyard

The Shipyard is reachable from the main menu and spends the coins above:

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

Hull traits and purchases apply to the next match through the same configuration snapshot mechanism as the options (`applyLoadout` in `src/game/progression/progression.ts`), so systems never read progression state directly.

## In-canvas HUD

Score, time and the player's health bar are drawn in PixiJS from the provided HUD sprites, positioned in screen space over the letterboxed arena. The React layer keeps the pause button and a visually hidden semantic copy of the same values (with a polite live region for phase changes), so assistive technology and the end-to-end tests read the state without per-frame React rendering.

## Presentation

Screens and dialogs fade and rise into place, the result screen celebrates a survived battle with a banner and an animated score, and it links straight to the Shipyard so rewards can be spent immediately. Motion is disabled when the system asks for reduced motion.

## Sound options

Options also hold volume and mute. The browser's audio context is unlocked by the first click or key press on the main menu, so sound effects play from the first battle onward.

## Interface languages

English is the default interface language and every English string is unchanged. `Options → Language` switches the interface to Português (Brasil), Português (Portugal) or Español; the choice is saved with the other options (`pirate-battle.options.v1`, the `language` field is omitted while English is active) and applies immediately to every screen, dialog, HUD live region and touch control label. The dictionaries live in `src/i18n/messages/`: `en.ts` is the typed source of truth and every other language is checked against its keys at compile time, so a missing translation is a type error and falls back to English at runtime. Keyboard key names, the game name, shipyard item names and network-lab scenario descriptions stay in English.
