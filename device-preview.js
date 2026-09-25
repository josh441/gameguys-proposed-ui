(function () {
  'use strict';
  const nested = window.self !== window.top;
  const embeddedPurchasing = new URLSearchParams(location.search).get('embed') === '1';
  document.documentElement.dataset.screen = location.pathname.split('/').pop().replace('.html', '') || 'index';
  if (nested) document.documentElement.classList.add('device-embed');

  function labelTables() {
    document.querySelectorAll('table:not(.ptable):not(.rtable)').forEach(table => {
      const headers = Array.from(table.querySelectorAll(':scope > thead > tr:first-child > th'));
      if (!headers.length) return;
      table.classList.add('device-card-table');
      // Do not style the whole card: it also contains toolbars and headings.
      if (table.parentElement.matches('.tw,.stock-table-wrap,.history-table-wrap,.edit-table,.receipt-table')) {
        table.parentElement.classList.add('device-card-wrap');
      }
      table.querySelectorAll(':scope > tbody > tr').forEach(row => {
        Array.from(row.cells).forEach((cell, index) => {
          if (cell.dataset.responsiveReady) return;
          cell.dataset.responsiveReady = 'true';
          cell.dataset.deviceLabel = (headers[index]?.textContent || '').replace(/\s+/g, ' ').trim();
          if (cell.colSpan > 1) cell.classList.add('device-card-wide');
          const value = document.createElement('div');
          value.className = 'responsive-cell-value';
          while (cell.firstChild) value.appendChild(cell.firstChild);
          cell.appendChild(value);
        });
      });
    });
  }

  function prepareFilters() {
    document.querySelectorAll('.stock-toolbar,.history-toolbar').forEach((toolbar, index) => {
      const search = toolbar.querySelector('.stock-search,.history-search');
      if (!search) return;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'responsive-filter-toggle';
      button.textContent = 'Filters & sort';
      button.setAttribute('aria-expanded', 'false');
      const panel = document.createElement('div');
      panel.className = 'responsive-filter-panel';
      panel.id = 'responsive-filters-' + index;
      button.setAttribute('aria-controls', panel.id);
      Array.from(toolbar.children).filter(child => child !== search).forEach(child => panel.appendChild(child));
      toolbar.append(button, panel);
      button.addEventListener('click', () => {
        const open = button.getAttribute('aria-expanded') !== 'true';
        button.setAttribute('aria-expanded', String(open));
        toolbar.classList.toggle('filters-open', open);
      });
      panel.addEventListener('change', () => {
        const count = Array.from(panel.querySelectorAll('select')).filter(select => select.selectedIndex > 0).length;
        button.textContent = count ? 'Filters & sort (' + count + ')' : 'Filters & sort';
      });
    });
  }

  function preparePreview() {
    if (nested) return;
    const switcher = document.createElement('div');
    switcher.className = 'device-preview-switch';
    switcher.setAttribute('role', 'group');
    switcher.setAttribute('aria-label', 'Responsive preview');
    const modes = { Desktop: 0, Tablet: 768, Mobile: 390 };
    let stage, frame;
    const content = document.querySelector('.app') || document.querySelector('.wrap');
    function select(name) {
      switcher.querySelectorAll('button').forEach(button => button.setAttribute('aria-pressed', String(button.textContent === name)));
      if (!modes[name]) {
        stage?.remove();
        stage = frame = null;
        if (content) content.inert = false;
        document.body.classList.remove('device-preview-active');
        return;
      }
      if (!stage) {
        stage = document.createElement('section');
        stage.className = 'device-preview-stage';
        stage.setAttribute('aria-label', 'Responsive page preview');
        const shell = document.createElement('div');
        shell.className = 'device-preview-frame';
        frame = document.createElement('iframe');
        const url = new URL(location.href);
        url.searchParams.set('deviceEmbed', '1');
        frame.src = url.href;
        shell.append(frame);
        stage.append(shell);
        document.body.append(stage);
        if (content) content.inert = true;
        document.body.classList.add('device-preview-active');
      }
      stage.style.setProperty('--preview-width', modes[name] + 'px');
      frame.title = name + ' preview — ' + modes[name] + ' pixels wide';
    }
    Object.keys(modes).forEach(name => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = name;
      button.setAttribute('aria-pressed', String(name === 'Desktop'));
      button.addEventListener('click', () => select(name));
      switcher.append(button);
    });
    document.body.append(switcher);
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && stage) { select('Desktop'); switcher.querySelector('button').focus(); }
    });
    const narrow = matchMedia('(max-width: 860px)');
    narrow.addEventListener('change', () => { if (narrow.matches) select('Desktop'); });
  }

  function prepareEmbeddedDialogs() {
    const purchasing = document.getElementById('purchasing-frame');
    if (purchasing) {
      const sendViewport = () => {
        const box = purchasing.getBoundingClientRect();
        if (box.width === 0) return;
        const container = purchasing.closest('.content').getBoundingClientRect();
        let visibleTop = Math.max(0, container.top);
        let visibleBottom = Math.min(innerHeight, container.bottom);
        const tabs = document.querySelector('.subtabs');
        const nav = document.querySelector('.side .nav');
        if (tabs && getComputedStyle(tabs).position === 'sticky') visibleTop = Math.max(visibleTop, tabs.getBoundingClientRect().bottom);
        if (nav && getComputedStyle(nav).position === 'fixed') visibleBottom = Math.min(visibleBottom, nav.getBoundingClientRect().top);
        const top = Math.max(0, visibleTop - box.top);
        const available = Math.min(visibleBottom, box.bottom) - Math.max(visibleTop, box.top);
        purchasing.contentWindow.postMessage({ type: 'gameguys:host-viewport', top, height: Math.max(120, available) }, location.origin);
      };
      purchasing.addEventListener('load', sendViewport);
      document.addEventListener('scroll', sendViewport, true);
      window.addEventListener('resize', sendViewport);
      new ResizeObserver(sendViewport).observe(purchasing);
    }
    if (embeddedPurchasing) {
      window.addEventListener('message', event => {
        if (event.source !== parent || event.origin !== location.origin || event.data?.type !== 'gameguys:host-viewport') return;
        document.documentElement.style.setProperty('--host-top', Math.max(0, Number(event.data.top) || 0) + 'px');
        document.documentElement.style.setProperty('--host-height', Math.max(120, Number(event.data.height) || 0) + 'px');
      });
    }
  }

  function preparePurchasing() {
    if (document.documentElement.dataset.screen !== 'purchasing-flow') return;
    const compact = matchMedia('(max-width:860px)');
    document.querySelectorAll('#v-plan > .set-card').forEach((card, index) => {
      const table = card.querySelector('.tw');
      table.id = 'buy-products-' + index;
      card.classList.toggle('set-collapsed', index > 0);
      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'set-toggle';
      toggle.setAttribute('aria-controls', table.id);
      const update = () => {
        const open = !card.classList.contains('set-collapsed');
        toggle.setAttribute('aria-expanded', String(open));
        toggle.textContent = open ? 'Hide products −' : 'Show products +';
      };
      toggle.addEventListener('click', () => { card.classList.toggle('set-collapsed'); update(); });
      card.querySelector('.set-head').append(toggle);
      update();
    });
    const disclosures = [];
    function fold(node, title) {
      if (!node) return;
      const details = document.createElement('details');
      details.className = 'purchasing-disclosure';
      details.open = !compact.matches;
      const summary = document.createElement('summary');
      summary.textContent = title;
      node.before(details);
      details.append(summary, node);
      disclosures.push(details);
    }
    fold(document.querySelector('#supplier-check'), 'Optional · Check supplier stock');
    fold(document.querySelector('#v-orders > .grid2'), 'Tracking & order details');
    fold(document.querySelector('#v-receive > .grid2 > div:nth-child(2)'), 'Shipping & tax · Cost breakdown');
    fold(document.querySelector('#v-receive > .card'), 'Order history · 6 updates');
    compact.addEventListener('change', () => disclosures.forEach(details => { details.open = !compact.matches; }));
    document.querySelectorAll('[data-target="supplier-check"]').forEach(button => {
      button.addEventListener('click', () => { document.querySelector('#supplier-check').parentElement.open = true; });
    });
  }

  function start() {
    labelTables();
    prepareFilters();
    preparePreview();
    prepareEmbeddedDialogs();
    preparePurchasing();
    document.querySelectorAll('.subtabs,.machine-tabs').forEach(tabs => {
      tabs.addEventListener('click', event => {
        if (event.target.closest('button') && matchMedia('(max-width:860px)').matches) {
          requestAnimationFrame(() => tabs.scrollIntoView({ block: 'start' }));
        }
      });
    });
    // Label new PO lines, buying-round products and stock movements after insertion.
    new MutationObserver(records => {
      if (records.some(record => Array.from(record.addedNodes).some(node => node.nodeType === 1 && (node.matches('tr,table') || node.querySelector('tr'))))) labelTables();
    }).observe(document.body, { childList: true, subtree: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
