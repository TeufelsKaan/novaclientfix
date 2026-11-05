package com.example.hud;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.AtomicMoveNotSupportedException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.EnumMap;

/** Profile-local settings. Positions are fractions of the available screen space. */
public final class HudConfig {
    private static final Gson JSON = new GsonBuilder().setPrettyPrinting().create();
    public static final int[] COLORS = {0xFFB4C6A6, 0xFFE8E9EB, 0xFF91C8DD, 0xFFE4BA7A, 0xFFD6A7BB};
    public static final String[] COLOR_NAMES = {"Salbei", "Weiß", "Blau", "Amber", "Rosa"};
    public static final float MIN_SCALE = 0.65f;
    public static final float MAX_SCALE = 2.0f;
    public boolean enabled = true;
    public boolean shadow = true;
    public boolean snapToGrid = true;
    public int opacity = 150;
    public int colorIndex = 0;
    public EnumMap<Widget, Element> elements = new EnumMap<>(Widget.class);

    public enum Widget {
        FPS("FPS"), COORDINATES("Koordinaten"), DIRECTION("Blickrichtung"),
        DIMENSION("Dimension"), PING("Ping"), SPEED("Geschwindigkeit"),
        CLOCK("Uhrzeit"), DURABILITY("Haltbarkeit");
        public final String title;
        Widget(String title) { this.title = title; }
    }

    public static final class Element {
        public boolean enabled = true;
        public double x = 0.015;
        public double y = 0.02;
        public float scale = 1.0f;
        public Element() {}
        public Element(boolean enabled, double x, double y, float scale) {
            this.enabled = enabled; this.x = x; this.y = y; this.scale = scale;
        }
        public Element copy() { return new Element(enabled, x, y, scale); }
    }

    public record Box(int x, int y, int width, int height) {
        public boolean contains(double mouseX, double mouseY) {
            return mouseX >= x && mouseX < x + width && mouseY >= y && mouseY < y + height;
        }
    }

    public HudConfig() {
        for (Widget widget : Widget.values()) elements.put(widget, defaultElement(widget));
    }

    public static Element defaultElement(Widget widget) {
        return new Element(widget.ordinal() < 4, 0.015, 0.02 + widget.ordinal() * 0.09, 1.0f);
    }

    public void normalize() {
        opacity = Math.clamp(opacity, 0, 230);
        colorIndex = Math.floorMod(colorIndex, COLORS.length);
        if (elements == null) elements = new EnumMap<>(Widget.class);
        for (Widget widget : Widget.values()) {
            Element element = elements.get(widget);
            if (element == null) { elements.put(widget, defaultElement(widget)); continue; }
            element.x = finiteClamp(element.x, 0, 1, 0.015);
            element.y = finiteClamp(element.y, 0, 1, defaultElement(widget).y);
            element.scale = (float) finiteClamp(element.scale, MIN_SCALE, MAX_SCALE, 1.0);
        }
    }

    private static double finiteClamp(double value, double min, double max, double fallback) {
        return Double.isFinite(value) ? Math.clamp(value, min, max) : fallback;
    }

    public HudConfig copy() {
        HudConfig copy = new HudConfig();
        copy.enabled = enabled; copy.shadow = shadow; copy.snapToGrid = snapToGrid;
        copy.opacity = opacity; copy.colorIndex = colorIndex;
        for (Widget widget : Widget.values()) copy.elements.put(widget, elements.get(widget).copy());
        return copy;
    }

    public static HudConfig load(Path file) {
        if (!Files.isRegularFile(file)) return new HudConfig();
        try {
            if (Files.size(file) > 128 * 1024) return new HudConfig();
            HudConfig config = JSON.fromJson(Files.readString(file, StandardCharsets.UTF_8), HudConfig.class);
            if (config == null) return new HudConfig();
            config.normalize();
            return config;
        } catch (IOException | RuntimeException error) {
            // Keep the original file until the user explicitly saves a new configuration.
            return new HudConfig();
        }
    }

    public void save(Path file) throws IOException {
        normalize();
        Files.createDirectories(file.toAbsolutePath().getParent());
        Path temporary = file.resolveSibling(file.getFileName() + ".tmp");
        Files.writeString(temporary, JSON.toJson(this), StandardCharsets.UTF_8);
        try {
            Files.move(temporary, file, StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING);
        } catch (AtomicMoveNotSupportedException error) {
            Files.move(temporary, file, StandardCopyOption.REPLACE_EXISTING);
        }
    }

    public static Box bounds(Element element, int contentWidth, int contentHeight, int screenWidth, int screenHeight) {
        int width = (int) Math.ceil(contentWidth * element.scale);
        int height = (int) Math.ceil(contentHeight * element.scale);
        int availableX = Math.max(0, screenWidth - width);
        int availableY = Math.max(0, screenHeight - height);
        return new Box((int) Math.round(element.x * availableX), (int) Math.round(element.y * availableY), width, height);
    }

    public static void move(Element element, double x, double y, Box box, int screenWidth, int screenHeight, boolean snap) {
        if (snap) { x = Math.round(x / 4.0) * 4; y = Math.round(y / 4.0) * 4; }
        element.x = Math.clamp(x / Math.max(1, screenWidth - box.width), 0, 1);
        element.y = Math.clamp(y / Math.max(1, screenHeight - box.height), 0, 1);
    }
}
