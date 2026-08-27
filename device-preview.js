(function(){
  'use strict';

  var params = new URLSearchParams(window.location.search);
  var isEmbedded = params.get('deviceEmbed') === '1' || params.get('embed') === '1';
  if (isEmbedded) {
    document.documentElement.classList.add('device-embed');
  }

  function icon(path){
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + path + '"/></svg>';
  }

  var switcher = document.createElement('div');
  switcher.className = 'device-preview-switch';
  switcher.setAttribute('role','group');
  switcher.setAttribute('aria-label','Preview this proposal by device');
  switcher.innerHTML =
    '<button type="button" data-device="desktop" aria-pressed="true">' + icon('M4 5h16v11H4zM8 20h8M12 16v4') + 'Desktop</button>' +
    '<button type="button" data-device="mobile" aria-pressed="false">' + icon('M8 2h8a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zM11 18h2') + 'Mobile</button>';

  var desktopButton = switcher.querySelector('[data-device="desktop"]');
  var mobileButton = switcher.querySelector('[data-device="mobile"]');
  var stage = null;

  function setPressed(mode){
    desktopButton.setAttribute('aria-pressed', mode === 'desktop' ? 'true' : 'false');
    mobileButton.setAttribute('aria-pressed', mode === 'mobile' ? 'true' : 'false');
  }

  function closeMobile(){
    if (stage) stage.remove();
    stage = null;
    document.body.classList.remove('device-preview-active');
    setPressed('desktop');
  }

  function openMobile(){
    if (stage) return;
    var mobileUrl = new URL(window.location.href);
    mobileUrl.searchParams.set('deviceEmbed','1');

    stage = document.createElement('div');
    stage.className = 'device-preview-stage';
    stage.setAttribute('aria-label','Mobile preview at 390 pixels wide');
    stage.innerHTML =
      '<div class="device-preview-frame"><iframe title="Mobile proposal preview" src="' + mobileUrl.href.replace(/&/g,'&amp;') + '"></iframe></div>' +
      '<div class="device-preview-caption"><b>Mobile view · 390 px</b>The same proposal, using its phone navigation, stacked controls, scrollable tables, and touch-friendly dialogs.</div>';
    document.body.appendChild(stage);
    document.body.classList.add('device-preview-active');
    setPressed('mobile');
  }

  desktopButton.addEventListener('click',closeMobile);
  mobileButton.addEventListener('click',openMobile);
  document.addEventListener('keydown',function(event){
    if (event.key === 'Escape' && stage) closeMobile();
  });
  function prepareMobileTables(){
    var tables = document.querySelectorAll('table.stock-table, table.history-table, .tw > table, table.dtable.work');
    tables.forEach(function(table){
      var headings = Array.from(table.querySelectorAll(':scope > thead > tr:first-child > th')).map(function(th){
        return th.textContent.replace(/\s+/g,' ').trim();
      });
      if (!headings.length) return;
      table.classList.add('device-card-table');
      if (table.parentElement) table.parentElement.classList.add('device-card-wrap');
      table.querySelectorAll(':scope > tbody > tr').forEach(function(row){
        Array.from(row.children).forEach(function(cell,index){
          if (cell.tagName !== 'TD') return;
          if (Number(cell.getAttribute('colspan') || 1) > 1) cell.classList.add('device-card-wide');
          if (!cell.hasAttribute('data-device-label')) cell.setAttribute('data-device-label',headings[index] || 'Details');
        });
      });
    });
  }
  document.addEventListener('DOMContentLoaded',function(){
    prepareMobileTables();
    if (!isEmbedded) document.body.appendChild(switcher);
  });
})();
