(() => {
  const openButton = document.getElementById('open-button');
  const closeButton = document.getElementById('close-button');
  const menu = document.getElementById('site-menu');
  function setMenu(open) {
    document.body.classList.toggle('show-menu', open);
    menu.inert = !open;
    openButton.setAttribute('aria-expanded', String(open));
    if (open) menu.querySelector('a').focus();
    else openButton.focus();
  }
  openButton.addEventListener('click', () => setMenu(!document.body.classList.contains('show-menu')));
  closeButton.addEventListener('click', () => setMenu(false));
  document.querySelector('.content-wrap').addEventListener('click', () => {
    if (document.body.classList.contains('show-menu')) setMenu(false);
  });
  document.addEventListener('keydown', event => {
    if (!document.body.classList.contains('show-menu')) return;
    if (event.key === 'Escape') setMenu(false);
    if (event.key === 'Tab') {
      const first = menu.querySelector('a');
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); closeButton.focus(); }
      else if (!event.shiftKey && document.activeElement === closeButton) { event.preventDefault(); first.focus(); }
    }
  });
})();
