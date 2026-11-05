package com.example.hud;

import java.nio.file.Files;
import java.nio.file.Path;
import com.example.hud.HudConfig.Widget;

/** Checks persistence and screen-space math without launching the game. */
public final class HudConfigTest {
    private static void check(boolean value, String message) {
        if (!value) throw new AssertionError(message);
        System.out.println("PASS " + message);
    }
    public static void main(String[] args) throws Exception {
        Path directory = Files.createTempDirectory("nova-hud-config-");
        Path file = directory.resolve("config/nova-hud.json");
        HudConfig original = new HudConfig();
        original.elements.get(Widget.PING).enabled = true;
        original.elements.get(Widget.FPS).x = 0.75;
        original.elements.get(Widget.FPS).scale = 1.35f;
        original.opacity = 180; original.colorIndex = 3;
        original.save(file);
        HudConfig loaded = HudConfig.load(file);
        check(loaded.elements.get(Widget.PING).enabled && loaded.opacity == 180 && loaded.colorIndex == 3, "HUD options survive a saved profile reload");
        check(loaded.elements.get(Widget.FPS).x == 0.75 && loaded.elements.get(Widget.FPS).scale == 1.35f, "position and per-widget scale survive reload");
        HudConfig editing = loaded.copy();
        editing.elements.get(Widget.FPS).enabled = false;
        editing.elements.get(Widget.FPS).x = 0;
        check(loaded.elements.get(Widget.FPS).enabled && loaded.elements.get(Widget.FPS).x == 0.75, "cancelled edits do not change the original configuration");
        loaded.elements.get(Widget.FPS).x = Double.NaN;
        loaded.elements.get(Widget.FPS).y = 7;
        loaded.elements.get(Widget.FPS).scale = Float.POSITIVE_INFINITY;
        loaded.opacity = -50; loaded.colorIndex = -1;
        loaded.elements.remove(Widget.SPEED);
        loaded.normalize();
        check(Double.isFinite(loaded.elements.get(Widget.FPS).x) && loaded.elements.get(Widget.FPS).y == 1 && loaded.elements.get(Widget.FPS).scale == 1, "invalid coordinates and non-finite scales are repaired");
        check(loaded.opacity == 0 && loaded.colorIndex == HudConfig.COLORS.length - 1 && loaded.elements.get(Widget.SPEED) != null, "invalid style values and missing modules are repaired");
        var element = new HudConfig.Element(true, 1, 1, 2);
        var box = HudConfig.bounds(element, 80, 19, 320, 240);
        check(box.x() + box.width() == 320 && box.y() + box.height() == 240, "normalized positions stay inside a smaller game window");
        HudConfig.move(element, -30, 999, box, 320, 240, true);
        check(element.x == 0 && element.y == 1, "dragging outside the screen is clamped");
        HudConfig.move(element, 13, 13, box, 320, 240, true);
        box = HudConfig.bounds(element, 80, 19, 320, 240);
        check(box.x() == 12 && box.y() == 12, "optional grid snapping aligns to four pixels");
        Files.writeString(file, "{broken config");
        HudConfig recovered = HudConfig.load(file);
        check(recovered.elements.size() == Widget.values().length && Files.readString(file).equals("{broken config"), "damaged configuration recovers without deleting the source file");
        Files.delete(file); Files.delete(file.getParent()); Files.delete(directory);
    }
}
