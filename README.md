# Nova Client

**0.5.0:** A compact desktop interface with Minecraft and loader selection on the home screen, a persistent play bar, searchable mod rows and local system fonts. Import feedback stays visible until the next action.

**0.4.0:** Adds all official Minecraft Java versions, Vanilla/Fabric/Quilt/Forge/NeoForge choices, and Modrinth/CurseForge modpack import. CurseForge exports that list file IDs still need an approved CurseForge API key to download those files. **0.3.3:** Adds the Nova icon, makes website downloads public and restores the public GitHub update channel. See `CHANGELOG.md`.

## Automatic launcher updates (0.3.0 and later)

The Windows launcher checks for public GitHub releases at startup and every 30 minutes, downloads verified updates in the background, and installs them when quitting. Settings → Updates also offers a manual check and **Neustarten & installieren**. Installation waits while Minecraft is running or starting. Closing Nova during a running game defers installation until a later launcher session. Accounts, settings and game files live outside the installation directory. The website download is public and does not require an access code.

The update channel is `https://github.com/TeufelsKaan/novaclientfix/releases/latest/download/`, configured in `updates.config.json` at build time. Release assets must be publicly downloadable without signing in. Existing versions 0.1 and 0.2 have no updater, and 0.3.0 points to the old unavailable channel: their users need to install version 0.3.1 once manually. A local installer alone does not publish a release.

To publish a new update after uploading this source to the repository:

1. Increment the version in `package.json` and `package-lock.json` (`npm version patch --no-git-tag-version`), and update version labels in the HTML.
2. Run `npm test`, `npm run check:ui`, `npm run check:updater` and `npm run package:win`.
3. Commit and push source changes, then create and push the matching version tag, for example `v0.3.2`.
4. `.github/workflows/release.yml` builds on Windows, runs the checks, uploads the installer, blockmap, `latest.yml` and a stable website installer alias to a public GitHub release. The workflow fails if the tag and version do not match or the repository is private.
5. Confirm the published release and public download URLs. Installed clients pick it up on their next check; open clients check every 30 minutes. Offline clients receive it after reconnecting and checking again.

For manual publishing, upload `release/Nova-Client-Setup-<version>.exe`, its `.blockmap`, a copy named `Nova-Client-Setup.exe`, and **last** `release/latest.yml` to the same public release. Never replace an already released version's installer with different bytes. Use a higher version for fixes or rollbacks. Keep the repository and update URL stable after clients have installed it.

`NOVA_UPDATE_URL` can override the public HTTPS directory at build time for another static host. This creates a separate channel, so all subsequent releases must be uploaded there as well. No publishing credentials are included in the installer. `npm run check:updater` exercises the actual updater against an isolated local server: a valid download is accepted, a modified download fails its SHA-512 check, and no installer is executed.

Version 0.2.0 brings a redesigned launcher with larger text, more contrast, larger controls and responsive cards. Use **Einstellungen → Darstellung** to choose 16 px or 18 px base text. The mod library supports search, category filters, an enabled-only filter and **Ctrl + K** to open search. Launch errors now have a visible return button.

Nova Client is a Windows desktop launcher for Minecraft Java Edition with a companion website. The launcher uses Microsoft sign-in, installs Java and the selected loader on first start, and downloads compatible client-side mods from Modrinth. It does not provide a Minecraft account or game licence.

## Run the desktop app

```powershell
npm install
npm run dev
```

Sign in with a Microsoft account that owns Minecraft: Java Edition, choose a Minecraft version and loader on **Spielen**, then select **Spielen** in the bottom bar. Version and loader selections are saved immediately. Nova loads the official Mojang version catalog and compatible loader metadata. The first launch downloads game files and the matching Java runtime.

The home screen and **Einstellungen → Spiel** accept Modrinth project links and `.mrpack` files, plus CurseForge export `.zip` files or direct `.zip` links. CurseForge manifests commonly reference mod files by ID. Exports that require the approved CurseForge API are reported as unsupported; Nova does not bundle or configure a CurseForge API key.

## Build the Windows installer

```powershell
npm run package:win
```

The NSIS installer, blockmap and `latest.yml` are written to `release/`. The website points to the stable installer alias on the GitHub release; it becomes available after publishing the first release.

## Website and hosting

- Local website preview: `npm run web:dev`
- Website build: `npm run web:build`
- Cloudflare Workers static assets: sign in with Wrangler, then run `npm run deploy:cloudflare`
- Vercel: link `website/` to a Vercel project once, then run `npm run deploy:vercel`

The optional GitHub Actions workflow in `.github/workflows/deploy.yml` can deploy both providers. Add repository secrets `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `VERCEL_TOKEN`, `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID` before running it. Those account connections and public deployment have not been performed by this local build.

## Profiles

- **Nova Performance** — rendering, game-logic and HUD essentials
- **Nova PvP** — clean performance setup with food HUD and zoom
- **Nova Explore** — map and exploration HUD with optional shaders

Nova verifies downloaded mod files against their Modrinth SHA-1 hashes. Required Modrinth dependencies are resolved automatically. It tracks only the jar files it installed, so worlds, screenshots and settings are kept.

Nova also includes its own Fabric mod, **Nova HUD**, with FPS, coordinates, facing direction and dimension information. It is built from `nova-hud-mod/` and bundled into the Windows installer. The development build needs Java 25; `npm run package:win` builds and bundles the mod automatically. Nova opens on the secondary display when one is connected.

## Tests

```powershell
npm test
npm run check:ui
```

The unit tests cover Mojang version lists, Vanilla/Fabric/Forge loader metadata, Modrinth package verification and safe archive paths, as well as compatible mod version selection. The game launch still requires a licensed Microsoft Minecraft account and a first-run download.

The Electron UI checks use an isolated temporary account store and verify mod search, empty results, enabled-only filtering, text preferences, error dismissal and layouts at 1000 px and 1440 px with large text. Screenshots are saved to `release/previews/`. For website checks, start `npm run web:dev -- --port 4175`, then run `npx electron scripts/check-site.cjs` in another terminal. The checks cover 390 px and 1440 px widths, readable hero text and decorative background containment.

## Project notes

### Source access and reuse

The Nova Client launcher source is public for inspection. All rights are reserved; no permission is granted to copy, modify, distribute, or reuse the launcher source without prior written permission. This notice does not change the separate CC0 license for the bundled Nova HUD mod in `nova-hud-mod/LICENSE` or the licenses of third-party software.

Nova Client is an independent community project, not affiliated with Mojang Studios or Microsoft. Minecraft is a trademark of Mojang Studios.
