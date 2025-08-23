
(function(){
  // ===== Utilities =====
  const pad = n => String(n).padStart(2,'0');
  const fmtKey = (y,m,d) => `${y}-${pad(m+1)}-${pad(d)}`; // m is 0-based
  const monthNames = new Intl.DateTimeFormat(undefined, { month: 'long' });
  const weekdayNames = (() => {
    const fmt = new Intl.DateTimeFormat(undefined, { weekday: 'short' });
    const base = new Date(Date.UTC(2023, 0, 1)); // Sun
    return Array.from({length:7}, (_,i)=> fmt.format(new Date(base.getTime() + i*86400000)));
  })();

  // ===== State =====
  let view = (() => {
    const now = new Date();
    return { y: now.getFullYear(), m: now.getMonth(), selected: null };
  })();
  const notes = JSON.parse(localStorage.getItem('flipCalendarNotes') || '{}');

  // ===== Elements =====
  const front = document.getElementById('front');
  const back  = document.getElementById('back');
  const flipInner = document.getElementById('flipInner');
  const flipCard  = document.getElementById('flipCard');
  const title = document.getElementById('titleText');
  const subtitle = document.getElementById('subtitle');
  const metaText = document.getElementById('metaText');

  const prevBtn = document.getElementById('prevBtn');
  const nextBtn = document.getElementById('nextBtn');
  const flipBtn = document.getElementById('flipBtn');
  const todayBtn = document.getElementById('todayBtn');
  const clearNotesBtn = document.getElementById('clearNotesBtn');

  const monthPicker = document.getElementById('monthPicker');
  const yearPicker  = document.getElementById('yearPicker');
  const jumpBtn     = document.getElementById('jumpBtn');

  // ===== Build static UI bits =====
  function buildWeekdayHeader(){
    const header = document.createElement('div');
    header.className = 'weekdays';
    weekdayNames.forEach(w => {
      const d = document.createElement('div');
      d.textContent = w;
      header.appendChild(d);
    });
    return header;
  }

  function buildGrid(y,m){
    // Compute first day and number of days in month
    const first = new Date(y, m, 1);
    const startWeekday = (first.getDay()+7)%7; // 0=Sunday
    const daysInMonth = new Date(y, m+1, 0).getDate();

    // Days from previous month to fill grid
    const prevDays = startWeekday;
    const prevMonthDate = new Date(y, m, 0);
    const prevMonthDays = prevMonthDate.getDate();

    // Build 6 weeks (42 cells) grid
    const totalCells = 42;
    const grid = document.createElement('div');
    grid.className = 'grid';

    for(let i=0;i<totalCells;i++){
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'day';
      let dayNum, displayMonth = m, displayYear = y, other = false;

      if(i < prevDays){
        dayNum = prevMonthDays - (prevDays - 1 - i);
        displayMonth = (m + 11) % 12;
        displayYear = (m === 0) ? (y - 1) : y;
        other = true;
      } else if(i >= prevDays + daysInMonth){
        dayNum = i - (prevDays + daysInMonth) + 1;
        displayMonth = (m + 1) % 12;
        displayYear = (m === 11) ? (y + 1) : y;
        other = true;
      } else {
        dayNum = i - prevDays + 1;
      }

      const key = fmtKey(displayYear, displayMonth, dayNum);
      const isToday = (() => {
        const now = new Date();
        return displayYear === now.getFullYear() &&
               displayMonth === now.getMonth() &&
               dayNum === now.getDate();
      })();

      if(other) cell.classList.add('other-month');
      if(isToday) cell.classList.add('today');

      cell.dataset.key = key;
      cell.dataset.y = displayYear;
      cell.dataset.m = displayMonth;
      cell.dataset.d = dayNum;

      const top = document.createElement('div');
      top.className = 'num';
      const n = document.createElement('span');
      n.textContent = dayNum;

      top.appendChild(n);

      // Today badge
      if(isToday){
        const badge = document.createElement('span');
        badge.className = 'badge';
        badge.textContent = 'Today';
        top.appendChild(badge);
      }

      // Note dot
      if(notes[key] && notes[key].trim()){
        const dot = document.createElement('span');
        dot.className = 'dot';
        top.appendChild(dot);
      }

      const note = document.createElement('div');
      note.className = 'note';
      note.textContent = notes[key] || '';

      cell.appendChild(top);
      if(note.textContent) cell.appendChild(note);

      // Events
      cell.addEventListener('click', () => {
        document.querySelectorAll('.day.selected').forEach(el=>el.classList.remove('selected'));
        cell.classList.add('selected');
        view.selected = { y: +cell.dataset.y, m:+cell.dataset.m, d:+cell.dataset.d };
        updateMeta();
      });

      cell.addEventListener('dblclick', () => {
        const existing = notes[key] || '';
        const entered = prompt(`Add/edit note for ${new Date(+cell.dataset.y, +cell.dataset.m, +cell.dataset.d).toDateString()}:`, existing);
        if(entered === null) return;
        const trimmed = entered.trim();
        if(trimmed){
          notes[key] = trimmed;
        } else {
          delete notes[key];
        }
        localStorage.setItem('flipCalendarNotes', JSON.stringify(notes));
        renderInto(cell.closest('.face'), +cell.dataset.y, +cell.dataset.m); // quick refresh face
      });

      grid.appendChild(cell);
    }

    return grid;
  }

  function faceContent(y,m){
    const frag = document.createDocumentFragment();
    const header = buildWeekdayHeader();
    frag.appendChild(header);
    frag.appendChild(buildGrid(y,m));
    return frag;
  }

  function renderInto(faceEl, y, m){
    faceEl.innerHTML = '';
    faceEl.appendChild(faceContent(y,m));
    const monthLabel = monthNames.format(new Date(y,m,1));
    faceEl.setAttribute('aria-label', `${monthLabel} ${y}`);
    updateTitle(y,m);
    updateMeta();
  }

  function updateTitle(y,m){
    title.textContent = `${monthNames.format(new Date(y,m,1))} ${y}`;
    const now = new Date();
    const sameMonth =
      y === now.getFullYear() && m === now.getMonth();
    subtitle.textContent = sameMonth ? 'Current month' : '';
  }

  function updateMeta(){
    const totalNotes = Object.keys(notes).length;
    if(view.selected){
      const {y,m,d} = view.selected;
      const label = new Date(y,m,d).toDateString();
      const key = fmtKey(y,m,d);
      const has = !!(notes[key] && notes[key].trim());
      metaText.textContent =
        `${label} — ${has ? 'has a note' : 'no note'}. Total notes: ${totalNotes}.`;
    } else {
      metaText.textContent = `Total notes: ${totalNotes}. Tip: double-click a day to add one.`;
    }
  }

  // ===== Flip logic =====
  let frontIsCurrent = true;
  function queueFlip(direction = +1){
    // direction: +1 next month, -1 previous month
    const src = frontIsCurrent ? front : back;
    const dst = frontIsCurrent ? back : front;

    // Compute target y/m
    let y = view.y, m = view.m + direction;
    if(m < 0){ m = 11; y--; }
    if(m > 11){ m = 0; y++; }

    // Render target into hidden face
    renderInto(dst, y, m);

    // Perform flip
    requestAnimationFrame(() => {
      // rotate to show dst
      flipInner.style.transform = frontIsCurrent
        ? 'rotateY(180deg)'
        : 'rotateY(0deg)';

      // After transition, swap state
      const onDone = () => {
        flipInner.removeEventListener('transitionend', onDone);
        frontIsCurrent = !frontIsCurrent;
        view.y = y; view.m = m;
        updateTitle(view.y, view.m);
        // Ensure the now-front face shows the exact current month
        const showing = frontIsCurrent ? front : back;
        renderInto(showing, view.y, view.m);
      };
      flipInner.addEventListener('transitionend', onDone, { once:true });
    });
  }

  // ===== Controls =====
  prevBtn.addEventListener('click', () => queueFlip(-1));
  nextBtn.addEventListener('click', () => queueFlip(+1));
  flipBtn.addEventListener('click', (e) => {
    const backward = e.shiftKey ? -1 : +1;
    queueFlip(backward);
  });

  todayBtn.addEventListener('click', () => {
    const now = new Date();
    // If already on today's month, just highlight today
    if(view.y === now.getFullYear() && view.m === now.getMonth()){
      const key = fmtKey(now.getFullYear(), now.getMonth(), now.getDate());
      const el = document.querySelector(`.day[data-key="${key}"]`);
      if(el){
        document.querySelectorAll('.day.selected').forEach(x=>x.classList.remove('selected'));
        el.classList.add('selected');
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        view.selected = { y: now.getFullYear(), m: now.getMonth(), d: now.getDate() };
        updateMeta();
      }
    } else {
      // Jump with flip animation in the appropriate direction
      // Determine shortest direction (rough)
      const delta = (now.getFullYear() - view.y)*12 + (now.getMonth() - view.m);
      const step = delta >= 0 ? +1 : -1;
      // Flip step-by-step quickly (bounded to avoid long loops)
      const flips = Math.min(Math.abs(delta), 24); // cap to 24 flips
      let done = 0;
      function stepFlip(){
        queueFlip(step);
        done++;
        if(done < flips){
          // chain after transition ends
          flipInner.addEventListener('transitionend', stepFlip, { once:true });
        }
      }
      stepFlip();
    }
  });

  monthPicker.innerHTML = Array.from({length:12}, (_,i) =>
    `<option value="${i}">${new Date(2000,i,1).toLocaleString(undefined,{month:'long'})}</option>`
  ).join('');

  // Years range: current year ± 50
  const CY = new Date().getFullYear();
  const years = [];
  for(let y=CY-50; y<=CY+50; y++) years.push(`<option value="${y}">${y}</option>`);
  yearPicker.innerHTML = years.join('');

  jumpBtn.addEventListener('click', () => {
    const targetY = +yearPicker.value;
    const targetM = +monthPicker.value;
    const delta = (targetY - view.y)*12 + (targetM - view.m);
    if(delta === 0) return;
    const step = delta > 0 ? +1 : -1;
    const flips = Math.min(Math.abs(delta), 24);
    let done = 0;
    function stepFlip(){
      queueFlip(step);
      done++;
      if(done < flips){
        flipInner.addEventListener('transitionend', stepFlip, { once:true });
      }
    }
    stepFlip();
  });

  clearNotesBtn.addEventListener('click', () => {
    if(confirm('Clear ALL saved notes? This cannot be undone.')){
      for(const k in notes) delete notes[k];
      localStorage.removeItem('flipCalendarNotes');
      // Refresh current face
      const showing = frontIsCurrent ? front : back;
      renderInto(showing, view.y, view.m);
      updateMeta();
    }
  });

  // Sync pickers to current view before rendering
  function syncPickers(){ monthPicker.value = String(view.m); yearPicker.value = String(view.y); }

  // ===== Init =====
  function init(){
    syncPickers();
    renderInto(front, view.y, view.m);
    renderInto(back, view.y, (view.m+1)%12); // pre-render next for nicer first flip
    updateTitle(view.y, view.m);
    updateMeta();
  }
  init();

  // Keyboard: Left/Right navigate; T for today; F to flip
  window.addEventListener('keydown', (e) => {
    if(e.target.closest('input,textarea,select')) return;
    if(e.key === 'ArrowLeft'){ e.preventDefault(); queueFlip(-1); }
    if(e.key === 'ArrowRight'){ e.preventDefault(); queueFlip(+1); }
    if(e.key.toLowerCase() === 't'){ e.preventDefault(); todayBtn.click(); }
    if(e.key.toLowerCase() === 'f'){ e.preventDefault(); flipBtn.click(); }
  });

})();
