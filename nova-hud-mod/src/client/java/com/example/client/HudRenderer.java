package com.example.client;

import com.example.hud.HudConfig;
import com.example.hud.HudConfig.Widget;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.GuiGraphicsExtractor;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.Locale;

final class HudRenderer {
    private static final DateTimeFormatter CLOCK = DateTimeFormatter.ofPattern("HH:mm");
    private static double lastX, lastZ;
    private static Object lastLevel;
    private static double speed;

    static void tick(Minecraft client) {
        if (client.player == null || client.level == null) { lastLevel = null; speed = 0; return; }
        double x = client.player.getX(), z = client.player.getZ();
        if (lastLevel == client.level) {
            double distance = Math.hypot(x - lastX, z - lastZ);
            speed = distance > 8 ? 0 : speed * 0.4 + distance * 20 * 0.6;
        } else { speed = 0; }
        lastX = x; lastZ = z; lastLevel = client.level;
    }

    static String text(Widget widget, Minecraft client) {
        if (client.player == null || client.level == null) return switch (widget) {
            case FPS -> "144 FPS";
            case COORDINATES -> "XYZ  128 / 64 / -32";
            case DIRECTION -> "Blick  Norden";
            case DIMENSION -> "Welt  Overworld";
            case PING -> "Ping  28 ms";
            case SPEED -> "Tempo  4.3 Bl/s";
            case CLOCK -> "Uhr  " + LocalTime.now().format(CLOCK);
            case DURABILITY -> "Werkzeug  210 / 512";
        };
        var player = client.player;
        return switch (widget) {
            case FPS -> client.getFps() + " FPS";
            case COORDINATES -> "XYZ  " + player.getBlockX() + " / " + player.getBlockY() + " / " + player.getBlockZ();
            case DIRECTION -> "Blick  " + switch (player.getDirection()) {
                case NORTH -> "Norden"; case EAST -> "Osten"; case SOUTH -> "Süden"; case WEST -> "Westen";
                default -> player.getDirection().getName();
            };
            case DIMENSION -> "Welt  " + client.level.dimension().identifier().getPath();
            case PING -> {
                var info = client.getConnection() == null ? null : client.getConnection().getPlayerInfo(player.getUUID());
                yield info == null ? "Ping  --" : "Ping  " + info.getLatency() + " ms";
            }
            case SPEED -> String.format(Locale.ROOT, "Tempo  %.1f Bl/s", speed);
            case CLOCK -> "Uhr  " + LocalTime.now().format(CLOCK);
            case DURABILITY -> {
                var item = player.getMainHandItem();
                yield item.isEmpty() || !item.isDamageableItem() ? "Werkzeug  --" : "Werkzeug  " + Math.max(0, item.getMaxDamage() - item.getDamageValue()) + " / " + item.getMaxDamage();
            }
        };
    }

    static HudConfig.Box bounds(Widget widget, HudConfig config, Minecraft client, int width, int height) {
        return HudConfig.bounds(config.elements.get(widget), client.font.width(text(widget, client)) + 14, 19, width, height);
    }

    static void draw(GuiGraphicsExtractor graphics, HudConfig config, boolean editor, Widget selected) {
        if (!editor && !config.enabled) return;
        Minecraft client = Minecraft.getInstance();
        for (Widget widget : Widget.values()) {
            var element = config.elements.get(widget);
            if (!editor && !element.enabled) continue;
            var box = bounds(widget, config, client, graphics.guiWidth(), graphics.guiHeight());
            int accent = HudConfig.COLORS[config.colorIndex];
            boolean active = config.enabled && element.enabled;
            if (editor) {
                int border = widget == selected ? accent : active ? 0xFF67705F : 0xFF565A60;
                graphics.fill(box.x() - 1, box.y() - 1, box.x() + box.width() + 1, box.y() + box.height() + 1, border);
            }
            graphics.pose().pushMatrix();
            graphics.pose().translate(box.x(), box.y());
            graphics.pose().scale(element.scale, element.scale);
            int contentWidth = client.font.width(text(widget, client)) + 14;
            int opacity = editor ? Math.max(config.opacity, 150) : config.opacity;
            graphics.fill(0, 0, contentWidth, 19, (opacity << 24) | 0x171A1E);
            if (config.opacity > 0 || editor) graphics.fill(0, 0, 2, 19, active ? accent : 0xFF737780);
            graphics.text(client.font, text(widget, client), 7, 6, active ? accent : 0xFF92969C, config.shadow);
            graphics.pose().popMatrix();
        }
    }
}
