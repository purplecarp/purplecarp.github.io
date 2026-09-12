/* Template teaching tools for the existing Mechanics I simulation engines. */
(() => {
  'use strict';
  const init = () => {
    const controls = document.getElementById('controls');
    const toolbar = document.querySelector('.lesson-toolbar');
    const grid = document.querySelector('.lesson-grid');
    const button = (id, text, action) => {
      const b = document.createElement('button');
      b.type = 'button'; b.id = id; b.textContent = text; b.addEventListener('click', action);
      return b;
    };
    controls.querySelectorAll('input[type=range]').forEach(input => {
      const row = document.createElement('div'); row.className = 'range-controls';
      input.before(row);
      const label = controls.querySelector(`label[for="${input.id}"]`);
      for (const direction of [-1, 1]) {
        const b = button(`${input.id}-${direction < 0 ? 'less' : 'more'}`, direction < 0 ? '−' : '+', () => {
          if (input.disabled) return;
          direction < 0 ? input.stepDown() : input.stepUp();
          input.dispatchEvent(new Event('input', { bubbles: true }));
        });
        b.setAttribute('aria-label', `${direction < 0 ? '減少' : '增加'}${label?.childNodes[0]?.textContent || input.id}`);
        row.append(b);
        if (direction < 0) row.append(input);
      }
    });
    const tools = document.createElement('div'); tools.className = 'tools';
    const presentation = button('presentation', '課堂演示', () => {
      const active = document.body.classList.toggle('is-presenting');
      presentation.textContent = active ? '詳細說明' : '課堂演示';
      presentation.setAttribute('aria-pressed', String(active));
      window.dispatchEvent(new Event('resize'));
    });
    presentation.setAttribute('aria-pressed', 'false');
    const toggle = button('controlToggle', '參數', () => {
      controls.hidden = !controls.hidden;
      grid.classList.toggle('controls-hidden', controls.hidden);
      toggle.setAttribute('aria-expanded', String(!controls.hidden));
      window.dispatchEvent(new Event('resize'));
    });
    toggle.setAttribute('aria-controls', 'controls'); toggle.setAttribute('aria-expanded', 'true');
    const large = button('large', '大字', () => {
      const active = document.body.classList.toggle('large-type');
      large.setAttribute('aria-pressed', String(active));
      window.dispatchEvent(new Event('resize'));
    });
    large.setAttribute('aria-pressed', 'false');
    const fullscreen = button('fullscreen', '全螢幕', async () => {
      try {
        if (document.fullscreenElement) await document.exitFullscreen();
        else if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
        else throw new Error('unsupported');
      } catch {
        if (!document.body.classList.contains('is-presenting')) presentation.click();
        fullscreen.textContent = '使用演示模式';
      }
    });
    document.addEventListener('fullscreenchange', () => {
      fullscreen.textContent = document.fullscreenElement ? '離開全螢幕' : '全螢幕';
    });
    tools.append(presentation, toggle, large, fullscreen); toolbar.append(tools);
    const toolbarSize = new ResizeObserver(() => {
      document.body.style.setProperty('--mechanics-toolbar-height', `${toolbar.getBoundingClientRect().height}px`);
    });
    toolbarSize.observe(toolbar);
    // Use the existing input handlers so +/- and reset preserve each physical model.
    const defaults = button('defaults', '恢復預設', () => {
      for (const input of controls.querySelectorAll('input')) {
        if (input.type === 'checkbox') input.checked = input.defaultChecked;
        else input.value = input.defaultValue;
        input.dispatchEvent(new Event(input.type === 'checkbox' ? 'change' : 'input', { bubbles: true }));
      }
      document.getElementById('viewFixed')?.click();
      (document.getElementById('reset') || document.getElementById('resetBtn')).click();
    });
    const presets = controls.querySelector('.lesson-presets') || controls;
    presets.append(defaults);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
