/* Template-style presentation tools for the existing canvas simulations. */
document.addEventListener('DOMContentLoaded', () => {
    const body = document.body;
    const main = document.querySelector('.main-container');
    if (!main) return;
    body.classList.add('demo-classroom');
    if (body.classList.contains('rutherford-classroom')) {
        const deck = main.querySelector('.control-deck');
        const stage = main.querySelector('.experiment-stage');
        const layout = document.createElement('div');
        layout.className = 'demo-layout';
        const visual = document.createElement('section');
        visual.className = 'demo-visual';
        visual.setAttribute('aria-label', 'Alpha 粒子散射演示');
        const panel = document.createElement('aside');
        panel.className = 'demo-parameters';
        panel.setAttribute('aria-label', '實驗參數');
        deck.before(layout);
        visual.append(deck.querySelector('.control-topline'), stage, deck.querySelector('.readout-grid'));
        panel.append(deck.querySelector('.control-grid'));
        layout.append(visual, panel);
        deck.remove();
    }
    const panels = [...main.querySelectorAll('.sim-layout-left, .tablet-controls, .demo-parameters')];
    panels.forEach((panel, i) => { if (!panel.id) panel.id = `demo-parameters-${i}`; });
    const toolbar = document.createElement('div');
    toolbar.className = 'demo-toolbar';
    toolbar.setAttribute('role', 'group');
    toolbar.setAttribute('aria-label', '課堂演示工具列');
    toolbar.innerHTML = '<button type="button" data-demo="presentation" aria-pressed="false">課堂演示</button><button type="button" data-demo="parameters" aria-expanded="true">參數</button><button type="button" data-demo="large" aria-pressed="false">大字</button><button type="button" data-demo="fullscreen">全螢幕</button>';
    main.querySelector('.page-header').after(toolbar);
    const button = name => toolbar.querySelector(`[data-demo="${name}"]`);
    button('parameters').setAttribute('aria-controls', panels.map(panel => panel.id).join(' '));
    const resize = () => requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
    const present = active => {
        body.classList.toggle('demo-presenting', active);
        button('presentation').textContent = active ? '詳細說明' : '課堂演示';
        button('presentation').setAttribute('aria-pressed', String(active));
        resize();
    };
    button('presentation').onclick = () => present(!body.classList.contains('demo-presenting'));
    button('parameters').onclick = () => {
        const hide = body.classList.toggle('demo-controls-hidden');
        panels.forEach(panel => { panel.hidden = hide; });
        button('parameters').setAttribute('aria-expanded', String(!hide));
        resize();
    };
    button('large').onclick = () => {
        const large = body.classList.toggle('demo-large');
        button('large').setAttribute('aria-pressed', String(large));
        resize();
    };
    button('fullscreen').onclick = async () => {
        try {
            if (document.fullscreenElement) await document.exitFullscreen();
            else if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
            else throw new Error('unsupported');
        } catch {
            present(true);
            button('fullscreen').textContent = '使用演示模式';
        }
    };
    document.addEventListener('fullscreenchange', () => {
        button('fullscreen').textContent = document.fullscreenElement ? '離開全螢幕' : '全螢幕';
        resize();
    });
});