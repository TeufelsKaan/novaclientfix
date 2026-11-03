package com.example.client;

import com.example.NovaHudMod;
import net.fabricmc.api.ClientModInitializer;
import net.fabricmc.fabric.api.client.rendering.v1.hud.HudElementRegistry;
import net.fabricmc.fabric.api.client.rendering.v1.hud.VanillaHudElements;
import net.minecraft.client.DeltaTracker;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.GuiGraphicsExtractor;

public class NovaHudClient implements ClientModInitializer {
	@Override
	public void onInitializeClient() {
		HudElementRegistry.attachElementBefore(VanillaHudElements.CHAT,
				NovaHudMod.id("info_panel"), NovaHudClient::render);
	}

	private static void render(GuiGraphicsExtractor graphics, DeltaTracker tickCounter) {
		Minecraft client = Minecraft.getInstance();
		if (client.player == null || client.level == null) return;

		var player = client.player;
		String[] lines = {
				"NOVA HUD  ·  " + client.getFps() + " FPS",
				"XYZ  " + player.getBlockX() + "  /  " + player.getBlockY() + "  /  " + player.getBlockZ(),
				"AUSRICHTUNG  " + player.getDirection().getName().toUpperCase(),
				"WELT  " + client.level.dimension().identifier().getPath().toUpperCase()
		};
		int x = 10;
		int y = 10;
		int width = 164;
		graphics.fill(x, y, x + width, y + 58, 0xB80B1119);
		graphics.fill(x, y, x + 2, y + 58, 0xFFB9F66A);
		for (int i = 0; i < lines.length; i++) {
			graphics.text(client.font, lines[i], x + 8, y + 6 + i * 12,
					i == 0 ? 0xFFB9F66A : 0xFFE7EDF5);
		}
	}
}
