import { downloadUrl } from './site-config.js';
const button=document.querySelector('#download-button');
const heroButton=document.querySelector('#hero-download');
const note=document.querySelector('#download-note');
if(downloadUrl){button.href=downloadUrl;button.target='_blank';button.rel='noopener noreferrer';heroButton.href=downloadUrl;heroButton.target='_blank';heroButton.rel='noopener noreferrer';note.textContent='Windows 10 / 11 · Minecraft Java Edition erforderlich · Download öffnet sicher über HTTPS';}
else{button.addEventListener('click',event=>{event.preventDefault();note.textContent='Installer-Link fehlt noch. Nach dem Build die öffentliche HTTPS-URL in website/site-config.js eintragen.';note.classList.add('note-active');});heroButton.addEventListener('click',event=>{event.preventDefault();document.querySelector('#download').scrollIntoView({behavior:'smooth'});});}
const anchors=[...document.querySelectorAll('a[href^="#"]')];anchors.forEach(link=>{if(link.hash==='#top')return;link.addEventListener('click',event=>{const section=document.querySelector(link.hash);if(section){event.preventDefault();section.scrollIntoView({behavior:'smooth',block:'start'});}});});
