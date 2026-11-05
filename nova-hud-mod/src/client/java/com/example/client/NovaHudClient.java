package com.example.client;

import com.example.NovaHudMod;
import com.example.hud.HudConfig;
import com.mojang.blaze3d.platform.InputConstants;
import net.fabricmc.api.ClientModInitializer;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;
import net.fabricmc.fabric.api.client.keymapping.v1.KeyMappingHelper;
import net.fabricmc.fabric.api.client.rendering.v1.hud.HudElementRegistry;
import net.fabricmc.fabric.api.client.rendering.v1.hud.VanillaHudElements;
import net.fabricmc.loader.api.FabricLoader;
import net.minecraft.client.KeyMapping;
import net.minecraft.client.Minecraft;
import java.io.IOException;
import java.nio.file.Path;

public class NovaHudClient implements ClientModInitializer {
    static KeyMapping openMenuKey;
    private static HudConfig config;
    private static final Path CONFIG_FILE = FabricLoader.getInstance().getConfigDir().resolve("nova-hud.json");

    @Override
    public void onInitializeClient() {
        config = HudConfig.load(CONFIG_FILE);
        var category = KeyMapping.Category.register(NovaHudMod.id("controls"));
        openMenuKey = KeyMappingHelper.registerKeyMapping(new KeyMapping(
                "key.nova_hud.editor", InputConstants.Type.KEYBOARD, InputConstants.KEY_RSHIFT, category));
        ClientTickEvents.END_CLIENT_TICK.register(client -> {
            HudRenderer.tick(client);
            while (openMenuKey.consumeClick()) {
                if (client.player != null && client.gui.screen() == null) {
                    client.gui.setScreen(new HudEditorScreen(config, null));
                }
            }
        });
        HudElementRegistry.attachElementBefore(VanillaHudElements.CHAT, NovaHudMod.id("info_panel"), (graphics, tickCounter) -> {
            Minecraft client = Minecraft.getInstance();
            if (client.player == null || client.level == null || client.gui.screen() instanceof HudEditorScreen) return;
            HudRenderer.draw(graphics, config, false, null);
        });
    }

    static void save(HudConfig updated) throws IOException {
        HudConfig next = updated.copy();
        next.save(CONFIG_FILE);
        config = next;
    }
}
