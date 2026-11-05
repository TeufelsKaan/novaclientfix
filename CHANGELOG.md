# Nova Client 0.5.0

- Replaces the promotional dashboard with a compact desktop interface, restrained colors, local system fonts and consistent line icons.
- Moves Minecraft version and loader selection onto the home screen and saves changes immediately.
- Keeps the play button and active installation visible across every page.
- Presents mods as a searchable list and adds persistent feedback for modpack imports.
- Shows the actual selected profile and launcher version consistently, and ignores stale loader metadata responses.

# Nova Client 0.4.0

- Adds the official Minecraft Java version list, including releases and snapshots, with Vanilla, Fabric, Quilt, Forge and NeoForge loader selection.
- Stores each game version and loader in its own profile folder and applies the chosen settings before launch.
- Adds Modrinth modpack link and `.mrpack` imports with HTTPS downloads, hash verification and safe override extraction.
- Adds CurseForge exported `.zip` imports. Some packs need a CurseForge-approved API key to retrieve their referenced mod files; Nova reports that requirement instead of pretending the pack was installed.
- Skips Nova's Fabric-only HUD setup on other loaders and versions where it is not compatible.

# Nova Client 0.3.3

- Adds a custom Nova icon to the Windows app and installer.
- Makes the website installer download public without an access code.
- Restores automatic updates from the public GitHub release channel.
- Keeps the email-protected admin page for release management.

# Nova Client 0.3.2

- Adds the bundled Nova HUD Fabric mod with FPS, coordinates, facing direction and dimension.
- Opens the launcher on the secondary display when available.
- Adds Nova HUD to all three profiles and the HUD settings page.

# Nova Client 0.3.1

- Update-Fehler unterscheiden einen nicht erreichbaren Update-Kanal, Verbindungsprobleme und beschädigte Downloads.
- Der letzte Prüfversuch wird auch nach einem Fehler angezeigt. Ein erneuter Versuch bleibt möglich.
- Der öffentliche Release-Kanal liegt jetzt unter `TeufelsKaan/novaclientfix`.
- Update-Dateien werden vor der Veröffentlichung gegen den fertigen Windows-Installer geprüft.

## Wechsel von älteren Versionen

Version 0.3.0 verwendet `TeufelsKaan/Nova-Client`, das aktuell nicht öffentlich erreichbar ist. Ohne eine Weiterleitung oder Veröffentlichung am alten Kanal können diese Installationen den neuen Kanal nicht finden. Installiere 0.3.1 deshalb einmal manuell über die bestehende Installation. Konten, Einstellungen und Welten bleiben erhalten. Ab 0.3.1 erfolgen Updates über `TeufelsKaan/novaclientfix`.
