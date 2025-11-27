document.addEventListener('DOMContentLoaded', function(){
  const panel = document.getElementById('filterPanel');
  const toggle = document.getElementById('panelToggle');
  const filtersInner = document.getElementById('filtersInner');
  const cardsContainer = document.getElementById('cards');
  const backToTop = document.getElementById('backToTop');

  // Elements that will be created inside filtersInner
  let continentSelect, countryInput, daysSliderEl, budgetSliderEl, daysMinEl, daysMaxEl, budgetMinEl, budgetMaxEl, clearBtn;

  // We'll load trip pages and create cards dynamically
  const tripPages = [
    'trips/oresund-szoros-kortura.html',
    'trips/vadkaland-belgiumban.html',
    'trips/japan-korut.html',
    'trips/afrikai-szafari.html',
    'trips/fjordok-es-eszaki-feny.html'
  ];

  let cards = [];
  // Slider visual maximums (user-specified)
  const sliderMaxDays = 14; // 14+
  const sliderMaxBudget = 500000; // 500000+
  // Data-derived maxima (used for other purposes / fallback limits)
  let dataMaxDays = 30;
  let dataMaxBudget = 100000;

  // Create basic filter controls inside the filtersInner container
    function createFilterControls(){
    filtersInner.innerHTML = `
      <label class="field"><strong>Kontinens</strong>
        <div id="continentList" class="checkbox-list" aria-label="Kontinensek"></div>
      </label>
      <label class="field"><strong>Ország</strong><input type="text" id="countryInput" placeholder="pl. Magyarország, Japán"></label>
      <label class="field"><strong>Napok</strong><div id="daysSlider" class="range"></div></label>
      <label class="field"><strong>Költség (Ft/fő)</strong><div id="budgetSlider" class="range"></div></label>
      <div class="actions"><button id="clearFilters" class="btn">Szűrők törlése</button></div>
    `;

    // assign refs
    // continentSelect is replaced with checkbox list container
    const continentList = document.getElementById('continentList');
    countryInput = document.getElementById('countryInput');
    daysSliderEl = document.getElementById('daysSlider');
    budgetSliderEl = document.getElementById('budgetSlider');
    clearBtn = document.getElementById('clearFilters');
  }

  // load trips, parse embedded JSON and build cards
  Promise.all(tripPages.map(p => fetch(p).then(r => r.text()).catch(()=>null)))
    .then(htmls => {
      const parsed = [];
      htmls.forEach((html, i) => {
        if(!html) return;
        const m = html.match(/<script[^>]*id=["']trip-data["'][^>]*>([\s\S]*?)<\/script>/i);
        if(m && m[1]){
          try{ parsed.push(JSON.parse(m[1])); }catch(e){}
        }
      });

      // build cards (if any)
      parsed.forEach(trip => {
        const card = buildCardFromTrip(trip);
        cardsContainer.appendChild(card);
        cards.push(card);
      });

      // create filter controls AFTER we know cards (even if there are none)
        createFilterControls();
          initFiltersAndSliders();
          // build country suggestion source
          buildCountrySuggestions();
    });

  function formatNumber(n){ return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " "); }

  function buildCardFromTrip(trip){
    const a = document.createElement('a'); a.className='card-link'; a.href = trip.url || '#';
    const article = document.createElement('article'); article.className='trip-card';
    article.dataset.continents = (trip.continents||[]).join(',');
    article.dataset.countries = (trip.countries||[]).join(',');
    article.dataset.days = trip.days||0;
    article.dataset.budget = trip.budget||0;
    article.dataset.tags = (trip.tags||[]).join(',');
    const cover = document.createElement('div'); cover.className='card-cover';
    // try to load provided cover; if it 404s, fall back to an inline SVG placeholder
    (function setCoverImage(url){
      const placeholder = `data:image/svg+xml;utf8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="600"><rect fill="%23e5e7eb" width="100%" height="100%"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="36" fill="%236b7280">Kép hiányzik</text></svg>')}`;
      if(!url){ cover.style.backgroundImage = `url('${placeholder}')`; return; }
      const img = new Image(); img.onload = function(){ cover.style.backgroundImage = `url('${url}')`; }; img.onerror = function(){ cover.style.backgroundImage = `url('${placeholder}')`; };
      img.src = url;
    })(trip.cover);
    // overlay title/meta on the cover so text fits on the picture
    const overlay = document.createElement('div'); overlay.className = 'cover-overlay';
    const h = document.createElement('h4'); h.className='trip-title'; h.textContent = trip.title;
    const meta = document.createElement('div'); meta.className='trip-meta'; meta.innerHTML = `<span class="budget">${formatNumber(trip.budget||0)} Ft</span> • <span class="days">${trip.days} nap</span>`;
    overlay.appendChild(h); overlay.appendChild(meta);
    cover.appendChild(overlay);

    const body = document.createElement('div'); body.className='card-body';
    const countries = document.createElement('div'); countries.className='countries'; countries.dataset.list = (trip.countries||[]).join(',');
    const tags = document.createElement('div'); tags.className='tags'; tags.textContent = (trip.tags||[]).map(t=>`#${t}`).join(' ');
    body.appendChild(countries); body.appendChild(tags);
    a.appendChild(cover); a.appendChild(body); article.appendChild(a);
    return article;
  }

  function initFiltersAndSliders(){
    // populate continent checkbox list from cards
    const allContinents = new Set();
    cards.forEach(c => (c.dataset.continents||'').split(',').map(s=>s.trim()).filter(Boolean).forEach(x=>allContinents.add(x)));
    const continentList = document.getElementById('continentList');
    continentList.innerHTML = '';
    Array.from(allContinents).sort().forEach(ct => {
      const id = 'ct-' + ct.replace(/\s+/g,'-');
      const label = document.createElement('label'); label.htmlFor = id; label.title = ct;
      const cb = document.createElement('input'); cb.type='checkbox'; cb.id = id; cb.name='continent'; cb.value = ct;
      label.appendChild(cb);
      const span = document.createElement('span'); span.textContent = ct; label.appendChild(span);
      continentList.appendChild(label);
      // clicking label will toggle and trigger filter
      cb.addEventListener('change', filterCards);
    });

    // compute data-derived maxima
    const daysValues = cards.map(c=>parseInt(c.dataset.days||0,10));
    dataMaxDays = Math.max(1, ...daysValues);
    const budgets = cards.map(c=>parseInt(c.dataset.budget||0,10));
    dataMaxBudget = Math.max(0, ...budgets);

    // createDoubleSlider: builds [min span] [slider (two range inputs)] [max span]
    function createDoubleSlider(containerEl, opts){
      // opts: min, max, startMin, startMax, step, format (value->string)
      containerEl.innerHTML = '';
      // left label
      const left = document.createElement('span'); left.className = 'slider-label slider-label-min'; left.style.color = '#000';
      // wrapper for slider track and inputs
      const wrapper = document.createElement('div'); wrapper.className = 'dual-range';
      // right label
      const right = document.createElement('span'); right.className = 'slider-label slider-label-max'; right.style.color = '#000';

      // inputs operate over the numeric range [opts.min .. opts.max]
      const a = document.createElement('input'); a.type='range';
      const b = document.createElement('input'); b.type='range';
      a.className = 'range-min'; b.className = 'range-max';
      a.min = opts.min; a.max = opts.max; a.step = opts.step || 1; a.value = opts.startMin;
      b.min = opts.min; b.max = opts.max; b.step = opts.step || 1; b.value = opts.startMax;
      // append
      wrapper.appendChild(a); wrapper.appendChild(b);
      containerEl.appendChild(left); containerEl.appendChild(wrapper); containerEl.appendChild(right);

      // ensure visual colors are set
      containerEl.style.setProperty('--active', opts.fillColor || '#D9775B');
      containerEl.style.setProperty('--inactive', opts.inactiveColor || '#D1D5DB');

      // ensure wrapper width is half of panel: implemented in CSS (.dual-range width:50%)

      let last = null;
      function clampAndSync(){
        let v1 = Number(a.value); let v2 = Number(b.value);
        if(v1 > v2){ if(last === 'min'){ b.value = v1; v2 = v1; } else { a.value = v2; v1 = v2; } }
        const pct1 = ((v1 - opts.min) / (opts.max - opts.min)) * 100;
        const pct2 = ((v2 - opts.min) / (opts.max - opts.min)) * 100;
        containerEl.style.setProperty('--p1', pct1 + '%');
        containerEl.style.setProperty('--p2', pct2 + '%');
        // update labels
        left.textContent = opts.format ? opts.format(v1) : String(v1);
        right.textContent = (v2 >= opts.max) ? (opts.format ? opts.format(v2) + '+' : String(v2) + '+') : (opts.format ? opts.format(v2) : String(v2));
      }

      a.addEventListener('pointerdown', (e)=>{ last='min'; try{ a.setPointerCapture(e.pointerId);}catch(e){}; a.style.cursor='grabbing'; });
      a.addEventListener('pointerup', (e)=>{ try{ a.releasePointerCapture(e.pointerId);}catch(e){}; a.style.cursor='grab'; last=null; clampAndSync(); if(opts.onChange) opts.onChange([Number(a.value), Number(b.value)]);});
      b.addEventListener('pointerdown', (e)=>{ last='max'; try{ b.setPointerCapture(e.pointerId);}catch(e){}; b.style.cursor='grabbing'; });
      b.addEventListener('pointerup', (e)=>{ try{ b.releasePointerCapture(e.pointerId);}catch(e){}; b.style.cursor='grab'; last=null; clampAndSync(); if(opts.onChange) opts.onChange([Number(a.value), Number(b.value)]);});

      a.addEventListener('input', ()=>{ last='min'; clampAndSync(); if(opts.onChange) opts.onChange([Number(a.value), Number(b.value)]); });
      b.addEventListener('input', ()=>{ last='max'; clampAndSync(); if(opts.onChange) opts.onChange([Number(a.value), Number(b.value)]); });

      // expose API
      clampAndSync();
      return {minInput:a, maxInput:b, updateFill:clampAndSync};
    }

    // create days slider (Napok) — range 1..14 displayed with 14+
    const daysObj = createDoubleSlider(daysSliderEl, {min:1, max:14, startMin:1, startMax:14, step:1,
      format: v => String(v), fillColor:'#D9775B', inactiveColor:'#D1D5DB', onChange: ()=>filterCards()});
    daysSliderEl._ranges = daysObj;
    // update displayed text containers if present
    if(daysMinEl && daysMaxEl){
      daysSliderEl._ranges.minInput.addEventListener('input', ()=> daysMinEl.textContent = daysSliderEl._ranges.minInput.value);
      daysSliderEl._ranges.maxInput.addEventListener('input', ()=> daysMaxEl.textContent = (Number(daysSliderEl._ranges.maxInput.value) >= 14 ? daysSliderEl._ranges.maxInput.value + '+' : daysSliderEl._ranges.maxInput.value));
      // init
      daysMinEl.textContent = daysSliderEl._ranges.minInput.value;
      daysMaxEl.textContent = (Number(daysSliderEl._ranges.maxInput.value) >= 14 ? daysSliderEl._ranges.maxInput.value + '+' : daysSliderEl._ranges.maxInput.value);
    }

    // create budget slider (Költség) — use thousands as units (1..500 => display 1k..500k)
    function fmtK(v){ return (v >= 1000 ? (v/1000)+'k' : (v + '')); }
    // We'll operate budget slider in 'k' units: min 1, max 500
    const budgetObj = createDoubleSlider(budgetSliderEl, {min:1, max:500, startMin:1, startMax:500, step:1,
      format: v => String(v) + 'k', fillColor:'#D9775B', inactiveColor:'#D1D5DB', onChange: ()=>filterCards()});
    budgetSliderEl._ranges = budgetObj;
    if(budgetMinEl && budgetMaxEl){
      budgetSliderEl._ranges.minInput.addEventListener('input', ()=> budgetMinEl.textContent = String(budgetSliderEl._ranges.minInput.value) + 'k');
      budgetSliderEl._ranges.maxInput.addEventListener('input', ()=> budgetMaxEl.textContent = (Number(budgetSliderEl._ranges.maxInput.value) >= 500 ? String(budgetSliderEl._ranges.maxInput.value) + 'k+' : String(budgetSliderEl._ranges.maxInput.value) + 'k'));
      // init
      budgetMinEl.textContent = String(budgetSliderEl._ranges.minInput.value) + 'k';
      budgetMaxEl.textContent = (Number(budgetSliderEl._ranges.maxInput.value) >= 500 ? String(budgetSliderEl._ranges.maxInput.value) + 'k+' : String(budgetSliderEl._ranges.maxInput.value) + 'k');
    }

    // No dynamic label offset calculation needed — layout is handled with flex and fixed track width.

    // continent checkboxes already wired above
    countryInput.addEventListener('input', onCountryInput);
    clearBtn.addEventListener('click', resetFilters);
  }

  // Autocomplete support for country input (comma separated tokens)
  let countrySuggestions = [];
  const suggestionBox = document.createElement('div'); suggestionBox.className='suggestions';
  function buildCountrySuggestions(){
    const set = new Set();
    cards.forEach(c => (c.dataset.countries||'').split(',').map(s=>s.trim()).filter(Boolean).forEach(x=>set.add(x)));
    countrySuggestions = Array.from(set).sort();
    // attach suggestion box under the country input
    if(countryInput){
      const parent = countryInput.parentElement;
      suggestionBox.innerHTML = '';
      suggestionBox.appendChild(countryInput.cloneNode(true));
      parent.replaceChild(suggestionBox, countryInput);
      countryInput = suggestionBox.querySelector('input');
      countryInput.addEventListener('input', onCountryInput);
    }
  }

  function onCountryInput(e){
    // show suggestions based on last token
    const val = e.target.value;
    const parts = val.split(',');
    const last = parts[parts.length-1].trim().toLowerCase();
    removeSuggestionsList();
    if(!last){ return; }
    const matches = countrySuggestions.filter(c=>c.toLowerCase().includes(last)).slice(0,8);
    if(matches.length===0) return;
    const list = document.createElement('div'); list.className='suggestions-list';
    matches.forEach(m => {
      const btn = document.createElement('button'); btn.type='button'; btn.textContent = m;
      btn.addEventListener('click', ()=>{ selectSuggestion(m); });
      list.appendChild(btn);
    });
    suggestionBox.appendChild(list);
  }

  function selectSuggestion(text){
    const val = countryInput.value;
    const parts = val.split(',');
    parts[parts.length-1] = ' ' + text;
    countryInput.value = parts.map(p=>p.trim()).filter(Boolean).join(', ');
    removeSuggestionsList();
    countryInput.focus();
    filterCards();
  }

  function removeSuggestionsList(){
    const existing = suggestionBox.querySelector('.suggestions-list');
    if(existing) existing.remove();
  }

  // close suggestions when clicking outside
  document.addEventListener('click', (e)=>{
    if(!suggestionBox.contains(e.target)) removeSuggestionsList();
  });


  // Remove earlier duplicate handlers: all event wiring is done after controls are created

  function resetFilters(){
    // uncheck continent checkboxes
    const boxes = document.querySelectorAll('input[name="continent"]');
    boxes.forEach(b=>b.checked=false);
    // clear country
    if(countryInput) countryInput.value='';
    // reset sliders
    if(daysSliderEl){
      if(daysSliderEl.noUiSlider){ daysSliderEl.noUiSlider.set([1, sliderMaxDays]); }
      else if(daysSliderEl._ranges){ daysSliderEl._ranges.minInput.value = 1; daysSliderEl._ranges.maxInput.value = 14; daysSliderEl._ranges.updateFill(); }
    }
    if(budgetSliderEl){
      if(budgetSliderEl.noUiSlider){ budgetSliderEl.noUiSlider.set([0, sliderMaxBudget]); }
      else if(budgetSliderEl._ranges){ budgetSliderEl._ranges.minInput.value = 1; budgetSliderEl._ranges.maxInput.value = 500; budgetSliderEl._ranges.updateFill(); }
    }
    filterCards();
  }

  function getSelectedContinents(){
    return Array.from(document.querySelectorAll('input[name="continent"]:checked')).map(i=>i.value.toLowerCase());
  }

  function filterCards(){
    const selectedContinents = getSelectedContinents();
    const countryQuery = (countryInput && countryInput.value?countryInput.value:'').split(',').map(s=>s.trim().toLowerCase()).filter(Boolean);
    // days range getter (support our dual-range implementation)
    let daysRange = [1, sliderMaxDays];
    if(daysSliderEl){
      if(daysSliderEl.noUiSlider){ daysRange = daysSliderEl.noUiSlider.get().map(v=>Number(v)); }
      else if(daysSliderEl._ranges){ daysRange = [Number(daysSliderEl._ranges.minInput.value||1), Number(daysSliderEl._ranges.maxInput.value||sliderMaxDays)]; }
    }
    let budgetRange = [0, sliderMaxBudget];
    if(budgetSliderEl){
      if(budgetSliderEl.noUiSlider){ budgetRange = budgetSliderEl.noUiSlider.get().map(v=>Number(v)); }
      else if(budgetSliderEl._ranges){
        // budget slider values are in 'k' units (1..500). Convert to full Ft for comparison.
        const minK = Number(budgetSliderEl._ranges.minInput.value||1);
        const maxK = Number(budgetSliderEl._ranges.maxInput.value||(sliderMaxBudget/1000));
        budgetRange = [minK * 1000, maxK * 1000];
      }
    }

    cards.forEach(card => {
      let ok = true;

      if(selectedContinents.length>0){
        const c = (card.dataset.continents||'').toLowerCase();
        ok = selectedContinents.some(sc => c.includes(sc.toLowerCase()));
      }

      if(ok && countryQuery.length>0){
        const cardCountries = (card.dataset.countries||'').toLowerCase();
        ok = countryQuery.some(q => cardCountries.includes(q));
      }

      if(ok){ const d = Number(card.dataset.days||0); const daysUpper = daysRange[1] >= sliderMaxDays ? Infinity : daysRange[1]; ok = d >= daysRange[0] && d <= daysUpper; }
      if(ok){ const b = Number(card.dataset.budget||0); const budgetUpper = budgetRange[1] >= sliderMaxBudget ? Infinity : budgetRange[1]; ok = b >= budgetRange[0] && b <= budgetUpper; }

      card.style.display = ok ? '' : 'none';
    });
  }

  function debounce(fn, wait){
    let t;
    return function(...a){ clearTimeout(t); t=setTimeout(()=>fn.apply(this,a), wait); }
  }

  // panel toggle (works regardless of fetch success)
  toggle.addEventListener('click', ()=>{
    const open = panel.classList.toggle('open');
    const backdrop = document.getElementById('panelBackdrop');
    if(open){
      document.body.style.overflowX = 'hidden';
      panel.setAttribute('aria-hidden','false');
      if(backdrop) backdrop.classList.add('visible');
    } else {
      document.body.style.overflowX = '';
      panel.setAttribute('aria-hidden','true');
      if(backdrop) backdrop.classList.remove('visible');
    }
    toggle.setAttribute('aria-expanded', String(open));
  });

  // close panel on backdrop click or Escape
  const backdropEl = document.getElementById('panelBackdrop');
  if(backdropEl){
    backdropEl.addEventListener('click', ()=>{
      panel.classList.remove('open');
      backdropEl.classList.remove('visible');
      document.body.style.overflowX = '';
      toggle.setAttribute('aria-expanded','false');
      panel.setAttribute('aria-hidden','true');
    });
  }
  document.addEventListener('keydown', (e)=>{
    if(e.key === 'Escape' && panel.classList.contains('open')){
      panel.classList.remove('open');
      if(backdropEl) backdropEl.classList.remove('visible');
      document.body.style.overflowX = '';
      toggle.setAttribute('aria-expanded','false');
      panel.setAttribute('aria-hidden','true');
    }
  });

  // back to top behaviour (not fixed so scrolls with page)
  if(backToTop){
    backToTop.addEventListener('click', ()=>window.scrollTo({top:0,behavior:'smooth'}));
  }

  // initial filter (in case)
  // filterCards will be called after cards and sliders are created
});
