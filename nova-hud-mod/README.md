# Nova HUD

Nova HUD 0.2.0 is a client-side Fabric mod bundled with Nova Client for Minecraft 26.3. It displays FPS, block coordinates, direction and dimension, with optional ping, horizontal speed, local clock and held-tool durability.

## In-game editor

Press **Right Shift** while playing to open the editor. The binding is listed under Nova HUD in Minecraft's Controls menu and can be changed.

- Select or drag a display to move it. Scroll or use the +/- buttons to resize the selected display.
- Toggle each of the eight displays independently. Disabled displays remain dimmed in the editor.
- Use Design to choose colors, background opacity, text shadow and a four-pixel snap grid, or reset all settings.
- Press H to hide the sidebar and arrange displays across the entire window.
- Arrow keys move the selection one pixel, or four pixels while holding Shift.
- Done, Esc or Right Shift saves and closes. Cancel discards the current edits.

Settings are stored in `config/nova-hud.json` inside the current game profile. Positions use relative coordinates so they remain on screen after a window resize. This editor controls Nova HUD only; other mods have separate settings.

## Build

Use Java 25 and run `gradlew.bat build`. The compiled jar is written to `build/libs/`. The build runs configuration and layout checks. Run `gradlew.bat runClientGameTest` for the isolated Minecraft test world, input interactions and screenshots in `build/run/clientGameTest/screenshots/`. Test classes are kept outside the shipped mod.

Nova HUD targets Minecraft 26.3 and Fabric Loader. The project is based on Fabric's CC0 example template.
