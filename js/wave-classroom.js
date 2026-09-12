/* Presentation controls shared by the wave lessons. */
document.addEventListener('DOMContentLoaded', () => {
    const menu = document.querySelector('.menu-wrap');
    const openMenu = document.getElementById('open-button');
    const closeMenu = document.getElementById('close-button');
    if (menu && openMenu && closeMenu) {
        menu.id = 'lesson-menu';
        menu.inert = true;
        openMenu.setAttribute('aria-label', '開啟網站選單');
        openMenu.setAttribute('aria-controls', menu.id);
        openMenu.setAttribute('aria-expanded', 'false');
        closeMenu.setAttribute('aria-label', '關閉網站選單');
        function setMenu(open) {
            document.body.classList.toggle('show-menu', open);
            menu.inert = !open;
            openMenu.setAttribute('aria-expanded', String(open));
            (open ? closeMenu : openMenu).focus();
        }
        openMenu.addEventListener('click', () => setMenu(!document.body.classList.contains('show-menu')));
        closeMenu.addEventListener('click', () => setMenu(false));
        document.addEventListener('keydown', event => {
            if (event.key === 'Escape' && document.body.classList.contains('show-menu')) setMenu(false);
        });
    }
    const heading = document.querySelector('.page-header');
    if (document.fullscreenEnabled && heading) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'fullscreen-button';
        button.textContent = '⛶ 全螢幕';
        button.addEventListener('click', async () => {
            try {
                if (document.fullscreenElement) await document.exitFullscreen();
                else await document.documentElement.requestFullscreen();
            } catch { button.textContent = '請使用 F11'; }
        });
        document.addEventListener('fullscreenchange', () => {
            button.textContent = document.fullscreenElement ? '⛶ 離開全螢幕' : '⛶ 全螢幕';
        });
        heading.append(button);
    }
    const tabs = [...document.querySelectorAll('[role="tab"]')];
    function selectTab(selected) {
        (window.waveDemos || []).forEach(demo => demo.pause());
        tabs.forEach(tab => {
            const active = tab === selected;
            tab.setAttribute('aria-selected', String(active));
            tab.tabIndex = active ? 0 : -1;
            document.getElementById(tab.getAttribute('aria-controls')).hidden = !active;
        });
    }
    tabs.forEach((tab, index) => {
        tab.addEventListener('click', () => selectTab(tab));
        tab.addEventListener('keydown', event => {
            let next;
            if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
            if (event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length;
            if (event.key === 'Home') next = 0;
            if (event.key === 'End') next = tabs.length - 1;
            if (next === undefined) return;
            event.preventDefault();
            tabs[next].focus();
            selectTab(tabs[next]);
        });
    });
    if (tabs.length) selectTab(tabs[0]);
});
