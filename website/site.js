import { version } from '../package.json';

document.querySelectorAll('[data-version]').forEach(node => { node.textContent = version; });

const views = {
  play: { image: '/images/nova-play.webp', alt: 'Nova Client: Startseite mit Auswahl für Minecraft-Version, Mod-Loader und Modpack-Import.', caption: 'Version, Loader und Modpacks direkt auf der Startseite.' },
  mods: { image: '/images/nova-mods.webp', alt: 'Nova Client: durchsuchbare Mod-Liste mit Beschreibung und Schaltern zum Auswählen von Mods.', caption: 'Mods durchsuchen, auswählen und beim nächsten Start einrichten.' },
  settings: { image: '/images/nova-settings.webp', alt: 'Nova Client: Spieleinstellungen mit Versions- und Loader-Auswahl sowie Modpack-Import.', caption: 'Dein Spiel, Arbeitsspeicher und Microsoft-Konto an einem Ort.' },
};
const tabs = [...document.querySelectorAll('[data-view]')];
const image = document.querySelector('#launcher-preview');
function showView(tab) {
  const view = views[tab.dataset.view];
  if (!view) return;
  tabs.forEach(item => { const selected = item === tab; item.setAttribute('aria-selected', String(selected)); item.tabIndex = selected ? 0 : -1; });
  image.src = view.image;
  image.alt = view.alt;
  document.querySelector('#preview-image-link').href = view.image;
  document.querySelector('#preview-enlarge').href = view.image;
  document.querySelector('#preview-caption').textContent = view.caption;
  document.querySelector('#preview-panel').setAttribute('aria-labelledby', tab.id);
}
tabs.forEach((tab, index) => {
  tab.addEventListener('click', () => showView(tab));
  tab.addEventListener('keydown', event => {
    const nextIndex = event.key === 'ArrowRight' ? (index + 1) % tabs.length : event.key === 'ArrowLeft' ? (index + tabs.length - 1) % tabs.length : event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : null;
    if (nextIndex === null) return;
    event.preventDefault();
    tabs[nextIndex].focus();
    showView(tabs[nextIndex]);
  });
});
