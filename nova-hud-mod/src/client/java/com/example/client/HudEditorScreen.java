package com.example.client;

import com.example.NovaHudMod;
import com.example.hud.HudConfig;
import com.example.hud.HudConfig.Widget;
import net.minecraft.client.gui.GuiGraphicsExtractor;
import net.minecraft.client.gui.components.Button;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.client.input.KeyEvent;
import net.minecraft.client.input.MouseButtonEvent;
import net.minecraft.network.chat.Component;
import com.mojang.blaze3d.platform.InputConstants;
import java.io.IOException;

public final class HudEditorScreen extends Screen {
    private HudConfig working;
    private final Screen parent;
    private Widget selected = Widget.FPS;
    private Widget dragging;
    private double grabX, grabY;
    private boolean designTab;
    private boolean freeView;
    private String error = "";
    private int panelX, panelWidth;

    public HudEditorScreen(HudConfig config, Screen parent) {
        super(Component.literal("Nova HUD"));
        this.working = config.copy();
        this.parent = parent;
    }

    private void button(String label, int x, int y, int width, int height, Runnable action) {
        addRenderableWidget(Button.builder(Component.literal(label), ignored -> action.run()).bounds(x, y, width, height).build());
    }

    @Override
    protected void init() {
        panelWidth = Math.min(212, Math.max(152, width / 2));
        panelX = width - panelWidth;
        int left = panelX + 8, inner = panelWidth - 16;
        if (!freeView) {
            int half = (inner - 4) / 2;
            button(designTab ? "Elemente" : "> Elemente", left, 41, half, 20, () -> { designTab = false; rebuildWidgets(); });
            button(designTab ? "> Design" : "Design", left + half + 4, 41, half, 20, () -> { designTab = true; rebuildWidgets(); });
            if (!designTab) {
                int row = Math.min(22, Math.max(17, (height - 102) / Widget.values().length));
                for (Widget widget : Widget.values()) {
                    int y = 67 + widget.ordinal() * row;
                    var element = working.elements.get(widget);
                    button((selected == widget ? "> " : "") + widget.title, left, y, inner - 41, row - 1, () -> { selected = widget; rebuildWidgets(); });
                    button(element.enabled ? "AN" : "AUS", left + inner - 38, y, 38, row - 1, () -> { selected = widget; element.enabled = !element.enabled; rebuildWidgets(); });
                }
            } else {
                button("HUD: " + (working.enabled ? "AN" : "AUS"), left, 67, inner, 20, () -> { working.enabled = !working.enabled; rebuildWidgets(); });
                button("Hintergrund: " + Math.round(working.opacity / 255f * 100) + "%", left, 89, inner, 20, () -> {
                    int next = 0;
                    for (int value : new int[]{0, 70, 130, 180, 230}) if (value > working.opacity) { next = value; break; }
                    working.opacity = next; rebuildWidgets();
                });
                button("Farbe: " + HudConfig.COLOR_NAMES[working.colorIndex], left, 111, inner, 20, () -> { working.colorIndex = (working.colorIndex + 1) % HudConfig.COLORS.length; rebuildWidgets(); });
                button("Textschatten: " + (working.shadow ? "AN" : "AUS"), left, 133, inner, 20, () -> { working.shadow = !working.shadow; rebuildWidgets(); });
                button("4-Pixel-Raster: " + (working.snapToGrid ? "AN" : "AUS"), left, 155, inner, 20, () -> { working.snapToGrid = !working.snapToGrid; rebuildWidgets(); });
                button("Alles zurücksetzen", left, 177, inner, 20, () -> { working = new HudConfig(); rebuildWidgets(); });
            }
            button("Fertig", left, height - 27, half, 20, this::onClose);
            button("Abbrechen", left + half + 4, height - 27, half, 20, () -> minecraft.gui.setScreen(parent));
        } else {
            button("Menü (H)", width - 86, 8, 78, 20, () -> { freeView = false; rebuildWidgets(); });
            button("Fertig", width - 86, height - 27, 78, 20, this::onClose);
        }
        button("-", 10, height - 47, 32, 20, () -> scale(-0.1f));
        button("+", 46, height - 47, 32, 20, () -> scale(0.1f));
        button("Position", 82, height - 47, 62, 20, () -> {
            var original = HudConfig.defaultElement(selected);
            var element = working.elements.get(selected);
            element.x = original.x; element.y = original.y;
        });
    }

    private void scale(float amount) {
        var element = working.elements.get(selected);
        element.scale = Math.clamp(Math.round((element.scale + amount) * 100) / 100f, HudConfig.MIN_SCALE, HudConfig.MAX_SCALE);
    }

    @Override
    public void extractBackground(GuiGraphicsExtractor graphics, int mouseX, int mouseY, float delta) {
        // The actual game remains visible while arranging the HUD.
    }

    @Override
    public void extractRenderState(GuiGraphicsExtractor graphics, int mouseX, int mouseY, float delta) {
        graphics.fill(0, 0, width, height, 0x33000000);
        HudRenderer.draw(graphics, working, true, selected);
        if (!freeView) {
            graphics.fill(panelX, 0, width, height, 0xF21D2126);
            graphics.fill(panelX, 0, panelX + 1, height, 0xFF485047);
            graphics.text(font, "NOVA HUD", panelX + 10, 12, 0xFFCFDCC4, false);
            graphics.text(font, "H: Menü ausblenden", panelX + 10, 27, 0xFFA6ADB5, false);
        }
        int leftWidth = freeView ? width - 96 : panelX;
        graphics.fill(5, height - 66, Math.min(leftWidth - 4, 224), height - 4, 0xDD1D2126);
        graphics.text(font, selected.title + "  " + Math.round(working.elements.get(selected).scale * 100) + "%", 10, height - 61, 0xFFE8E9EB, false);
        graphics.text(font, "Ziehen / Mausrad: Größe", 10, height - 22, 0xFFB4B9C0, false);
        graphics.text(font, error.isEmpty() ? "Esc: Speichern" : error, 10, height - 12, error.isEmpty() ? 0xFF939BA5 : 0xFFFFB89B, false);
        super.extractRenderState(graphics, mouseX, mouseY, delta);
    }

    @Override
    public boolean mouseClicked(MouseButtonEvent event, boolean doubleClick) {
        if (super.mouseClicked(event, doubleClick)) return true;
        if (event.button() != InputConstants.MOUSE_BUTTON_LEFT || (!freeView && event.x() >= panelX)) return false;
        Widget[] widgets = Widget.values();
        for (int i = widgets.length - 1; i >= 0; i--) {
            var box = HudRenderer.bounds(widgets[i], working, minecraft, width, height);
            if (box.contains(event.x(), event.y())) {
                selected = widgets[i]; dragging = selected;
                grabX = event.x() - box.x(); grabY = event.y() - box.y();
                rebuildWidgets();
                return true;
            }
        }
        return false;
    }

    @Override
    public boolean mouseDragged(MouseButtonEvent event, double dx, double dy) {
        if (dragging != null) {
            var box = HudRenderer.bounds(dragging, working, minecraft, width, height);
            HudConfig.move(working.elements.get(dragging), event.x() - grabX, event.y() - grabY, box, width, height, working.snapToGrid);
            return true;
        }
        return super.mouseDragged(event, dx, dy);
    }

    @Override
    public boolean mouseReleased(MouseButtonEvent event) {
        if (dragging != null) { dragging = null; return true; }
        return super.mouseReleased(event);
    }

    @Override
    public boolean mouseScrolled(double x, double y, double horizontal, double vertical) {
        if (vertical == 0) return super.mouseScrolled(x, y, horizontal, vertical);
        scale(vertical > 0 ? 0.05f : -0.05f);
        return true;
    }

    @Override
    public boolean keyPressed(KeyEvent event) {
        if (event.isEscape() || NovaHudClient.openMenuKey.matches(event)) { onClose(); return true; }
        if (event.key() == InputConstants.KEY_H) { freeView = !freeView; rebuildWidgets(); return true; }
        if (event.key() == InputConstants.KEY_MINUS) { scale(-0.1f); return true; }
        if (event.key() == InputConstants.KEY_EQUALS || event.key() == InputConstants.KEY_ADD) { scale(0.1f); return true; }
        int dx = event.key() == InputConstants.KEY_LEFT ? -1 : event.key() == InputConstants.KEY_RIGHT ? 1 : 0;
        int dy = event.key() == InputConstants.KEY_UP ? -1 : event.key() == InputConstants.KEY_DOWN ? 1 : 0;
        if ((dx != 0 || dy != 0) && !event.isCycleFocus()) {
            var box = HudRenderer.bounds(selected, working, minecraft, width, height);
            int step = event.hasShiftDown() ? 4 : 1;
            HudConfig.move(working.elements.get(selected), box.x() + dx * step, box.y() + dy * step, box, width, height, false);
            return true;
        }
        return super.keyPressed(event);
    }

    @Override
    public void onClose() {
        try { NovaHudClient.save(working); minecraft.gui.setScreen(parent); }
        catch (IOException failure) {
            error = "Speichern fehlgeschlagen.";
            NovaHudMod.LOGGER.error("Could not save Nova HUD settings", failure);
        }
    }

    @Override
    public boolean isPauseScreen() { return false; }
}
