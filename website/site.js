const anchors = [...document.querySelectorAll('a[href^="#"]')];
anchors.forEach(link => {
  if (link.hash === '#top') return;
  link.addEventListener('click', event => {
    const section = document.querySelector(link.hash);
    if (section) {
      event.preventDefault();
      section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
});
