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
    'trips/trip1.html',
    'trips/trip2.html',
    'trips/trip3.html',
    'trips/trip4.html',
    'trips/trip5.html'
  ];

  let cards = [];
  let maxDays = 30;
  let maxBudget = 100000;

  // Create basic filter controls inside the filtersInner container
  function createFilterControls(){
    filtersInner.innerHTML = `
      <h3>Szűrők</h3>
      <label class="field"><strong>Kontinens</strong>
        <div id="continentList" class="checkbox-list" aria-label="Kontinensek"></div>
      </label>
      <label class="field"><strong>Ország</strong><input type="text" id="countryInput" placeholder="pl. Magyarország, Japán"></label>
      <label class="field"><strong>Napok</strong><div id="daysSlider" class="range"></div><div class="range-values"><span id="daysMin">0</span> – <span id="daysMax">30+</span></div></label>
      <label class="field"><strong>Költség (Ft)</strong><div id="budgetSlider" class="range"></div><div class="range-values"><span id="budgetMin">0</span> – <span id="budgetMax">0</span> Ft</div></label>
      <div class="actions"><button id="clearFilters" class="btn">Szűrők törlése</button></div>
    `;

    // assign refs
    // continentSelect is replaced with checkbox list container
    const continentList = document.getElementById('continentList');
    countryInput = document.getElementById('countryInput');
    daysSliderEl = document.getElementById('daysSlider');
    budgetSliderEl = document.getElementById('budgetSlider');
    daysMinEl = document.getElementById('daysMin');
    daysMaxEl = document.getElementById('daysMax');
    budgetMinEl = document.getElementById('budgetMin');
    budgetMaxEl = document.getElementById('budgetMax');
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
    const cover = document.createElement('div'); cover.className='card-cover'; cover.style.backgroundImage = `url('${trip.cover || "../images/placeholder.jpg"}')`;
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

    // compute ranges
    const daysValues = cards.map(c=>parseInt(c.dataset.days||0,10));
    maxDays = Math.max(30, ...daysValues);
    const budgets = cards.map(c=>parseInt(c.dataset.budget||0,10));
    maxBudget = Math.max(100000, ...budgets);

    // create sliders (use noUiSlider if available, otherwise create a minimal fallback)
    if(typeof noUiSlider !== 'undefined'){
      noUiSlider.create(daysSliderEl, {
        start: [0, maxDays], connect: true, step:1, range:{min:0,max:maxDays}, tooltips:[true,true], format:{to: v=>Math.round(v), from: v=>Number(v)}
      });
      noUiSlider.create(budgetSliderEl, {
        start: [0, maxBudget], connect: true, step:1000, range:{min:0,max:maxBudget}, tooltips:[true,true], format:{to: v=>Math.round(v), from: v=>Number(v)}
      });

      daysSliderEl.noUiSlider.on('update', function(values){ daysMinEl.textContent = values[0]; daysMaxEl.textContent = (values[1] >= maxDays ? values[1] + '+' : values[1]); filterCards(); });
      budgetSliderEl.noUiSlider.on('update', function(values){ budgetMinEl.textContent = formatNumber(values[0]); budgetMaxEl.textContent = formatNumber(values[1]); filterCards(); });
    } else {
      // fallback: two number inputs (min / max)
      daysSliderEl.innerHTML = '';
      const dMin = document.createElement('input'); dMin.type='number'; dMin.value=0; dMin.min=0; dMin.max=maxDays; dMin.style.width='48%';
      const dMax = document.createElement('input'); dMax.type='number'; dMax.value=maxDays; dMax.min=0; dMax.max=maxDays; dMax.style.width='48%';
      daysSliderEl.appendChild(dMin); daysSliderEl.appendChild(dMax);
      daysMinEl.textContent = dMin.value; daysMaxEl.textContent = dMax.value + '+';
      const updDays = debounce(()=>{ daysMinEl.textContent = dMin.value; daysMaxEl.textContent = dMax.value; filterCards(); }, 150);
      dMin.addEventListener('input', updDays); dMax.addEventListener('input', updDays);

      budgetSliderEl.innerHTML = '';
      const bMin = document.createElement('input'); bMin.type='number'; bMin.value=0; bMin.min=0; bMin.max=maxBudget; bMin.step=1000; bMin.style.width='48%';
      const bMax = document.createElement('input'); bMax.type='number'; bMax.value=maxBudget; bMax.min=0; bMax.max=maxBudget; bMax.step=1000; bMax.style.width='48%';
      budgetSliderEl.appendChild(bMin); budgetSliderEl.appendChild(bMax);
      budgetMinEl.textContent = formatNumber(bMin.value); budgetMaxEl.textContent = formatNumber(bMax.value);
      const updBudget = debounce(()=>{ budgetMinEl.textContent = formatNumber(bMin.value); budgetMaxEl.textContent = formatNumber(bMax.value); filterCards(); }, 150);
      bMin.addEventListener('input', updBudget); bMax.addEventListener('input', updBudget);

      // store fallback elements for getters
      daysSliderEl._fallback = {minInput:dMin, maxInput:dMax};
      budgetSliderEl._fallback = {minInput:bMin, maxInput:bMax};
    }

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
      if(daysSliderEl.noUiSlider){ daysSliderEl.noUiSlider.set([0, maxDays]); }
      else if(daysSliderEl._fallback){ daysSliderEl._fallback.minInput.value = 0; daysSliderEl._fallback.maxInput.value = maxDays; daysMinEl.textContent = 0; daysMaxEl.textContent = maxDays; }
    }
    if(budgetSliderEl){
      if(budgetSliderEl.noUiSlider){ budgetSliderEl.noUiSlider.set([0, maxBudget]); }
      else if(budgetSliderEl._fallback){ budgetSliderEl._fallback.minInput.value = 0; budgetSliderEl._fallback.maxInput.value = maxBudget; budgetMinEl.textContent = formatNumber(0); budgetMaxEl.textContent = formatNumber(maxBudget); }
    }
    filterCards();
  }

  function getSelectedContinents(){
    return Array.from(document.querySelectorAll('input[name="continent"]:checked')).map(i=>i.value.toLowerCase());
  }

  function filterCards(){
    const selectedContinents = getSelectedContinents();
    const countryQuery = (countryInput && countryInput.value?countryInput.value:'').split(',').map(s=>s.trim().toLowerCase()).filter(Boolean);
    // days range getter (support fallback)
    let daysRange = [0, maxDays];
    if(daysSliderEl){
      if(daysSliderEl.noUiSlider){ daysRange = daysSliderEl.noUiSlider.get().map(v=>Number(v)); }
      else if(daysSliderEl._fallback){ daysRange = [Number(daysSliderEl._fallback.minInput.value||0), Number(daysSliderEl._fallback.maxInput.value||maxDays)]; }
    }
    let budgetRange = [0, maxBudget];
    if(budgetSliderEl){
      if(budgetSliderEl.noUiSlider){ budgetRange = budgetSliderEl.noUiSlider.get().map(v=>Number(v)); }
      else if(budgetSliderEl._fallback){ budgetRange = [Number(budgetSliderEl._fallback.minInput.value||0), Number(budgetSliderEl._fallback.maxInput.value||maxBudget)]; }
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

      if(ok){ const d = Number(card.dataset.days||0); ok = d >= daysRange[0] && d <= daysRange[1]; }
      if(ok){ const b = Number(card.dataset.budget||0); ok = b >= budgetRange[0] && b <= budgetRange[1]; }

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
