package com.example.client;

import com.example.hud.HudConfig;
import com.example.hud.HudConfig.Widget;
import com.mojang.blaze3d.platform.InputConstants;
import net.fabricmc.fabric.api.client.gametest.v1.FabricClientGameTest;
import net.fabricmc.fabric.api.client.gametest.v1.context.ClientGameTestContext;
import net.fabricmc.loader.api.FabricLoader;
import java.nio.file.Path;

/** Runs against a real, isolated development world; never included in the shipped mod. */
public final class HudEditorGameTest implements FabricClientGameTest {
    private static void require(boolean condition, String message) {
        if (!condition) throw new AssertionError(message);
    }

    private static void cursor(ClientGameTestContext context, double x, double y) {
        double[] pixels = context.computeOnClient(client -> new double[]{
            x * client.getWindow().getScreenWidth() / client.getWindow().getGuiScaledWidth(),
            y * client.getWindow().getScreenHeight() / client.getWindow().getGuiScaledHeight()
        });
        context.getInput().setCursorPos(pixels[0], pixels[1]);
    }

    @Override
    public void runTest(ClientGameTestContext context) {
        context.getInput().resizeWindow(1280, 720);
        context.runOnClient(client -> org.lwjgl.sdl.SDLVideo.SDL_SetWindowPosition(client.getWindow().handle(), 1980, 80));
        try (var world = context.worldBuilder().create()) {
            world.getConnection().waitForChunksRender();
            context.runOnClient(client -> {
                try { NovaHudClient.save(new HudConfig()); }
                catch (java.io.IOException error) { throw new AssertionError(error); }
            });
            var input = context.getInput();
            input.pressKey(InputConstants.KEY_RSHIFT);
            context.waitForScreen(HudEditorScreen.class);
            context.waitTicks(3);
            context.takeScreenshot("nova-hud-editor");
            context.clickScreenButton("+");
            input.pressKey(InputConstants.KEY_RIGHT);
            cursor(context, 12, 12);
            input.holdMouse(InputConstants.MOUSE_BUTTON_LEFT);
            context.waitTick();
            cursor(context, 92, 62);
            context.waitTicks(2);
            input.releaseMouse(InputConstants.MOUSE_BUTTON_LEFT);
            input.scroll(1);
            context.clickScreenButton("Uhrzeit");
            double[] clockToggle = context.computeOnClient(client -> {
                var screen = client.gui.screen();
                int row = Math.min(22, Math.max(17, (screen.height - 102) / Widget.values().length));
                return new double[]{screen.width - 27, 67 + Widget.CLOCK.ordinal() * row + (row - 1) / 2.0};
            });
            cursor(context, clockToggle[0], clockToggle[1]);
            input.pressMouse(InputConstants.MOUSE_BUTTON_LEFT);
            context.clickScreenButton("Design");
            context.clickScreenButton("Farbe: Salbei");
            context.takeScreenshot("nova-hud-design");
            input.pressKey(InputConstants.KEY_H);
            context.waitTicks(2);
            context.takeScreenshot("nova-hud-free-view");
            input.pressKey(InputConstants.KEY_RSHIFT);
            context.waitFor(client -> client.gui.screen() == null);
            Path file = FabricLoader.getInstance().getConfigDir().resolve("nova-hud.json");
            HudConfig saved = HudConfig.load(file);
            require(Math.abs(saved.elements.get(Widget.FPS).scale - 1.15f) < 0.001, "Button and mousewheel scaling were not saved");
            require(saved.elements.get(Widget.FPS).x > 0.15 && saved.elements.get(Widget.FPS).y > 0.15, "Mouse dragging was not saved");
            require(saved.elements.get(Widget.CLOCK).enabled, "Widget toggle was not saved");
            require(saved.colorIndex == 1, "Design color was not saved");
            input.pressKey(InputConstants.KEY_RSHIFT);
            context.waitForScreen(HudEditorScreen.class);
            input.resizeWindow(640, 480);
            context.waitTicks(3);
            context.takeScreenshot("nova-hud-small-window");
            context.clickScreenButton("+");
            context.clickScreenButton("Abbrechen");
            context.waitFor(client -> client.gui.screen() == null);
            input.pressKey(InputConstants.KEY_RSHIFT);
            context.waitForScreen(HudEditorScreen.class);
            context.clickScreenButton("Fertig");
            require(Math.abs(HudConfig.load(file).elements.get(Widget.FPS).scale - 1.15f) < 0.001, "Cancel changed active or saved settings");
            input.resizeWindow(1280, 720);
            context.waitTicks(3);
            context.takeScreenshot("nova-hud-in-game");
            System.out.println("NOVA HUD GAME TEST PASSED: Right Shift, mouse drag, button and wheel scaling, widget toggle, design, resize, save and cancel");
        }
    }
}
