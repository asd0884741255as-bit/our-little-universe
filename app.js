(() => {
  'use strict';
  const memories = Array.isArray(window.MEMORIES) ? window.MEMORIES : [];
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => Array.from(root.querySelectorAll(s));
  const img = id => `assets/${String(id).replace(/\.jpg$/i, '')}.jpg`;
  const mediaItems = memory => Array.isArray(memory.media) && memory.media.length ? memory.media : (memory.photos || []).map(id => ({ id, type: 'image', asset: `${id}.jpg` }));
  const mediaAsset = item => `assets/${item.asset || `${item.id}.jpg`}`;
  const createMedia = (item, alt, controls = false, autoplay = true) => {
    if (item.type === 'video') {
      const video = document.createElement('video');
      video.src = mediaAsset(item); video.autoplay = autoplay; video.loop = true; video.muted = true; video.playsInline = true; video.preload = autoplay ? 'auto' : 'metadata';
      video.setAttribute('playsinline', ''); video.setAttribute('aria-label', alt); if (controls) video.controls = true;
      if (autoplay) { video.addEventListener('canplay', () => video.play().catch(() => {}), { once: true }); video.play().catch(() => {}); }
      return video;
    }
    const picture = document.createElement('img'); picture.src = mediaAsset(item); picture.alt = alt; picture.loading = 'lazy';
    return picture;
  };
  const fadeTokens = new WeakMap();
  const fadeAudioVolume = (audio, target, duration = 180, done) => {
    if (!audio) return;
    const previous = fadeTokens.get(audio);
    if (previous) previous.cancelled = true;
    const token = { cancelled: false };
    fadeTokens.set(audio, token);
    const start = Math.max(0, Math.min(1, Number(audio.volume) || 0));
    const targetVolume = Math.max(0, Math.min(1, Number(target) || 0));
    const started = performance.now();
    const tick = now => {
      if (token.cancelled) return;
      const progress = Math.min(1, Math.max(0, (now - started) / Math.max(1, duration)));
      audio.volume = Math.max(0, Math.min(1, start + (targetVolume - start) * (1 - Math.pow(1 - progress, 3))));
      if (progress < 1) requestAnimationFrame(tick);
      else { if (fadeTokens.get(audio) === token) fadeTokens.delete(audio); if (done) done(); }
    };
    requestAnimationFrame(tick);
  };
  const ambientMusic = new Audio('assets/our-little-us-bed.wav?v=music-soft-1');
  ambientMusic.loop = true;
  ambientMusic.preload = 'auto';
  ambientMusic.volume = 0;
  let ambientMusicEnabled = true;
  let ambientMusicUnlocked = false;
  let ambientHighlightActive = false;
  let catMusicDucked = false;
  let catDuckTimer;
  const ambientMusicTarget = () => {
    if (!ambientMusicEnabled) return 0;
    if (ambientHighlightActive) return .035;
    if (catMusicDucked) return .045;
    return .16;
  };
  const refreshAmbientMusic = (duration = 700) => {
    if (!ambientMusicUnlocked) return;
    const target = ambientMusicTarget();
    if (target > 0) ambientMusic.play().catch(() => {});
    fadeAudioVolume(ambientMusic, target, duration, target === 0 ? () => ambientMusic.pause() : undefined);
  };
  const startAmbientMusic = () => {
    if (!ambientMusicEnabled) return;
    ambientMusicUnlocked = true;
    ambientMusic.play().then(() => refreshAmbientMusic(900)).catch(() => { ambientMusicUnlocked = false; });
  };
  const setAmbientMusicEnabled = enabled => {
    ambientMusicEnabled = Boolean(enabled);
    const toggle = $('#musicToggle');
    if (toggle) {
      toggle.setAttribute('aria-pressed', String(ambientMusicEnabled));
      toggle.textContent = ambientMusicEnabled ? '♫' : '◌';
      toggle.title = ambientMusicEnabled ? 'ปิดเพลงโรแมนติกเบา ๆ' : 'เปิดเพลงโรแมนติกเบา ๆ';
    }
    if (ambientMusicEnabled) { startAmbientMusic(); refreshAmbientMusic(700); }
    else refreshAmbientMusic(420);
  };
  const duckAmbientMusic = (duration = 1400) => {
    if (!ambientMusicUnlocked) return;
    catMusicDucked = true;
    refreshAmbientMusic(110);
    clearTimeout(catDuckTimer);
    catDuckTimer = setTimeout(() => { catMusicDucked = false; refreshAmbientMusic(360); }, duration);
  };
  window.addEventListener('pointerdown', () => { if (ambientMusicEnabled) startAmbientMusic(); }, { passive: true });
  window.addEventListener('keydown', () => { if (ambientMusicEnabled) startAmbientMusic(); }, { passive: true });
  const musicToggle = $('#musicToggle');
  musicToggle?.addEventListener('click', () => setAmbientMusicEnabled(!ambientMusicEnabled));
  setAmbientMusicEnabled(true);
  const playCatSound = kind => {
    try {
      startAmbientMusic();
      duckAmbientMusic(1450);
      const audio = new Audio(`assets/cat-meow-2.wav?v=meow-2`);
      audio.volume = 0;
      audio.playbackRate = kind === 'play' ? 1.12 : kind === 'treat' ? .98 : 1;
      const target = kind === 'play' ? .72 : .82;
      const fadeOut = () => fadeAudioVolume(audio, 0, 220, () => audio.pause());
      audio.addEventListener('loadedmetadata', () => { window.setTimeout(fadeOut, Math.max(0, (audio.duration - .24) * 1000)); }, { once: true });
      audio.addEventListener('ended', () => { audio.volume = 0; }, { once: true });
      audio.play().then(() => fadeAudioVolume(audio, target, 150)).catch(() => {});
    } catch (_) {}
  };
  const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const motionDisabled = () => reduced || document.documentElement.classList.contains('reduced');
  const storage = { get(k, fallback) { try { const v = localStorage.getItem(k); return v == null ? fallback : JSON.parse(v); } catch (_) { return fallback; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} } };
  const favorites = new Set(storage.get('love-favorites', []));
  let year = 'all', category = 'all', storyCount = 6, galleryCount = 12, viewerIndex = 0;
  const viewer = $('#viewer'), gameDialog = $('#gameDialog'), toast = $('#toast');
  let toastTimer;
  const notify = message => { if (!toast) return; toast.textContent = message; toast.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove('show'), 2300); };
  const openDialog = d => { if (!d) return; if (typeof d.showModal === 'function') d.showModal(); else d.setAttribute('open', ''); };
  const closeDialog = d => { if (!d) return; if (typeof d.close === 'function') d.close(); else d.removeAttribute('open'); };
  const formatDate = date => { if (!date) return 'ไม่ทราบวันที่'; const [y, m, d] = date.split('-'); return `${d}/${m}/${y}`; };
  const visibleMemories = () => memories.filter(m => (year === 'all' || (m.date || '').startsWith(year)) && (category === 'all' || m.category === category) && (category !== 'favorite' || favorites.has(m.id)));

  function renderTimeline() {
    const list = memories.filter(m => year === 'all' || (m.date || '').startsWith(year)).slice(0, storyCount);
    const root = $('#timeline'); if (!root) return;
    root.textContent = '';
    if (!list.length) { root.innerHTML = '<p class="empty">ยังไม่มีบันทึกช่วงนี้</p>'; return; }
    list.forEach(memory => {
      const button = document.createElement('button'); button.className = 'memory'; button.type = 'button'; button.dataset.id = memory.id;
      const picture = createMedia(mediaItems(memory)[0], memory.title);
      const date = document.createElement('small'); date.textContent = formatDate(memory.date);
      const title = document.createElement('h3'); title.textContent = memory.title;
      const text = document.createElement('p'); text.textContent = memory.memory || 'เก็บภาพนี้ไว้ในสมุดของเรา';
      button.append(picture, date, title, text); button.addEventListener('click', () => openViewer(memory)); root.append(button);
    });
    const more = $('#more'); if (more) more.hidden = list.length >= memories.filter(m => year === 'all' || (m.date || '').startsWith(year)).length;
  }

  function renderGallery() {
    const list = visibleMemories(); const root = $('#grid'); if (!root) return;
    root.textContent = '';
    if (!list.length) { root.innerHTML = '<p class="empty">ยังไม่มีรูปที่เลือกไว้</p>'; return; }
    list.slice(0, galleryCount).forEach(memory => {
      mediaItems(memory).forEach((item, mediaIndex) => {
        const button = document.createElement('button'); button.type = 'button'; button.dataset.id = memory.id; button.dataset.photo = mediaIndex; button.setAttribute('aria-label', `เปิด${item.type === 'video' ? 'วิดีโอ' : 'รูป'} ${memory.title}`);
        const picture = createMedia(item, memory.title); button.append(picture); button.addEventListener('click', () => openViewer(memory, mediaIndex)); root.append(button);
      });
    });
    const more = $('#galleryMore'); if (more) more.hidden = galleryCount >= list.length;
  }

  function renderHighlight() {
    const years = $('#years');
    if (!years || $('#highlight')) return;
    const memory = memories.find(item => item.id === 'E060');
    const videoIndex = memory ? mediaItems(memory).findIndex(item => item.type === 'video') : -1;
    if (!memory || videoIndex < 0) return;
    const videoItem = mediaItems(memory)[videoIndex];
    const highlight = document.createElement('article');
    highlight.id = 'highlight';
    highlight.className = 'highlight';
    const copy = document.createElement('div');
    copy.className = 'highlight-copy';
    const eyebrow = document.createElement('p');
    eyebrow.className = 'eyebrow';
    eyebrow.textContent = 'HIGHLIGHT / A DAY TO KEEP';
    const heading = document.createElement('h3');
    heading.textContent = 'คลิปไฮไลท์จากกาญจนบุรี';
    const text = document.createElement('p');
    text.textContent = 'ทริปที่ครอบครัวอัยย์พาเราไปเที่ยวด้วยกัน — ทักตัดคลิปนี้ไว้เป็นความทรงจำสวย ๆ';
    const open = document.createElement('button');
    open.type = 'button';
    open.textContent = 'เปิดความทรงจำทั้งหมด ↗';
    open.addEventListener('click', () => openViewer(memory, videoIndex));
    copy.append(eyebrow, heading, text, open);
    const video = createMedia(videoItem, 'คลิปไฮไลท์ทริปกาญจนบุรี', false, true);
    video.className = 'highlight-media';
    video.volume = 0;
    video.muted = true;
    let highlightVisible = false;
    let musicUnlocked = false;
    const fadeMusicTo = target => {
      if (target > 0) {
        ambientHighlightActive = true;
        refreshAmbientMusic(760);
        video.muted = false;
        video.play().catch(() => {});
        fadeAudioVolume(video, target, 760);
      } else {
        ambientHighlightActive = false;
        refreshAmbientMusic(760);
        fadeAudioVolume(video, 0, 760, () => { video.muted = true; });
      }
    };
    const unlockMusic = () => {
      musicUnlocked = true;
      if (highlightVisible) fadeMusicTo(.62);
    };
    window.addEventListener('pointerdown', unlockMusic, { once: true, passive: true });
    window.addEventListener('scroll', unlockMusic, { once: true, passive: true });
    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver(entries => {
        highlightVisible = Boolean(entries[0]?.isIntersecting && entries[0].intersectionRatio >= .3);
        if (highlightVisible) {
          video.play().catch(() => {});
          if (musicUnlocked) fadeMusicTo(.62);
        }
        if (!highlightVisible) fadeMusicTo(0);
      }, { threshold: [0, .3, .7] });
      observer.observe(highlight);
    }
    video.addEventListener('click', () => openViewer(memory, videoIndex));
    video.setAttribute('title', 'คลิกเพื่อดูรูปและคลิปของทริปนี้ทั้งหมด');
    highlight.append(copy, video);
    years.parentNode.insertBefore(highlight, years);
  }

  function openViewer(memory, photoIndex = 0) {
    const items = mediaItems(memory);
    if (!items.length) return;
    viewerIndex = Math.max(0, Math.min(photoIndex, items.length - 1));
    const body = $('#viewerBody'); if (!body) return;
    body.textContent = '';

    const deck = document.createElement('div');
    deck.className = `media-stack${items.length > 1 ? ' has-stack' : ''}`;
    deck.setAttribute('role', 'group');
    deck.setAttribute('aria-label', items.length > 1 ? 'คลิกรูปเพื่อดูใบถัดไป' : memory.title);
    const advance = () => { if (items.length > 1) openViewer(memory, (viewerIndex + 1) % items.length); };

    items.forEach((item, index) => {
      const depth = (index - viewerIndex + items.length) % items.length;
      const card = document.createElement('div');
      card.className = `stack-card${depth === 0 ? ' is-active' : ''}`;
      card.dataset.depth = String(Math.min(depth, 3));
      card.setAttribute('aria-hidden', String(depth !== 0));
      const media = createMedia(item, memory.title, false, depth === 0);
      media.classList.add('viewer-media');
      card.append(media);
      if (depth === 0 && items.length > 1) {
        card.setAttribute('role', 'button');
        card.setAttribute('tabindex', '0');
        card.setAttribute('aria-label', 'ดูสื่อถัดไป');
        card.addEventListener('click', advance);
        card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); advance(); } });
      }
      deck.append(card);
    });

    const heading = document.createElement('h2'); heading.textContent = memory.title;
    const text = document.createElement('p'); text.textContent = memory.memory || 'ความทรงจำเล็ก ๆ ของเรา';
    const meta = document.createElement('p'); meta.textContent = `${formatDate(memory.date)} · สื่อที่ ${viewerIndex + 1}/${items.length}${items.length > 1 ? ' · คลิกรูปเพื่อดูใบถัดไป' : ''}`;
    const actions = document.createElement('div'); actions.className = 'dialog-actions';
    const fav = document.createElement('button'); fav.type = 'button'; fav.textContent = favorites.has(memory.id) ? '♥ เก็บแล้ว' : '♡ เก็บไว้';
    fav.addEventListener('click', () => { favorites.has(memory.id) ? favorites.delete(memory.id) : favorites.add(memory.id); storage.set('love-favorites', [...favorites]); fav.textContent = favorites.has(memory.id) ? '♥ เก็บแล้ว' : '♡ เก็บไว้'; renderGallery(); notify(favorites.has(memory.id) ? 'เก็บความทรงจำนี้ไว้แล้ว ♡' : 'เอาออกจากรายการที่เก็บไว้แล้ว'); });
    actions.append(fav); body.append(deck, heading, text, meta, actions); openDialog(viewer);
  }
  $$('.close').forEach(b => b.addEventListener('click', () => closeDialog(b.closest('dialog'))));
  [viewer, gameDialog].forEach(d => d && d.addEventListener('click', e => { if (e.target === d) closeDialog(d); }));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeDialog(viewer); closeDialog(gameDialog); } });

  $$('#years button').forEach(button => button.addEventListener('click', () => { $$('#years button').forEach(b => b.classList.remove('active')); button.classList.add('active'); year = button.dataset.year; storyCount = 6; renderTimeline(); }));
  $$('#filters button').forEach(button => button.addEventListener('click', () => { $$('#filters button').forEach(b => b.classList.remove('active')); button.classList.add('active'); category = button.dataset.filter; galleryCount = 12; renderGallery(); }));
  $('#more')?.addEventListener('click', () => { storyCount += 6; renderTimeline(); });
  $('#galleryMore')?.addEventListener('click', () => { galleryCount += 12; renderGallery(); });
  $('#random')?.addEventListener('click', () => { if (memories.length) openViewer(memories[Math.floor(Math.random() * memories.length)]); });

  function game(title, content) { const body = $('#gameBody'); body.textContent = ''; const h = document.createElement('h2'); h.textContent = title; body.append(h, content); openDialog(gameDialog); }
  function showGameFeedback(kind) {
    const stage = document.createElement('div');
    stage.className = `game-feedback-stage game-feedback-stage-${kind}`;
    stage.setAttribute('aria-hidden', 'true');
    const main = document.createElement('span');
    main.className = 'game-feedback-main';
    main.textContent = kind === 'correct' ? '♥' : '😡';
    const label = document.createElement('strong');
    label.className = 'game-feedback-label';
    label.textContent = kind === 'correct' ? 'ถูกต้อง! ♡' : 'ยังไม่ใช่นะ!';
    stage.append(main, label);
    const particles = kind === 'correct' ? ['♥', '♡', '♥', '♡', '♥'] : ['💢', '😤', '💢'];
    particles.forEach((symbol, index) => {
      const particle = document.createElement('span');
      particle.className = `game-feedback-particle game-feedback-particle-${index + 1}`;
      particle.textContent = symbol;
      particle.setAttribute('aria-hidden', 'true');
      stage.append(particle);
    });
    const host = gameDialog && gameDialog.open ? gameDialog : document.body;
    host.append(stage);
    setTimeout(() => stage.remove(), motionDisabled() ? 1000 : 2700);
  }
  function startQuiz() {
    const questions = [{ q: 'สีที่อัยย์ชอบคือชุดไหน?', choices: ['เหลือง ขาว ดำ', 'ชมพู ฟ้า เขียว', 'แดง ส้ม ม่วง'], answer: 0 }, { q: 'ดอกไม้ที่อัยย์ชอบคืออะไร?', choices: ['กุหลาบ', 'ทานตะวัน', 'ทิวลิป'], answer: 1 }, { q: 'วันเริ่มคบของเราคือวันไหน?', choices: ['06.09.2024', '06.09.2025', '09.06.2024'], answer: 0 }, { q: 'อัยย์ชอบเส้นแบบไหน?', choices: ['เส้นหมี่', 'เส้นเล็ก', 'วุ้นเส้น'], answer: 0 }];
    let score = 0, at = 0;
    const finish = () => { const wrap = document.createElement('div'); wrap.className = 'room'; const h = document.createElement('h3'); h.textContent = `ได้ ${score}/${questions.length} คะแนน ♡`; const p = document.createElement('p'); p.textContent = score === questions.length ? 'รู้ใจอัยย์ที่สุดเลย!' : 'ค่อย ๆ จำไปด้วยกันนะ'; wrap.append(h, p); $('#gameBody').append(wrap); };
    const render = () => {
      const wrap = document.createElement('div'); wrap.className = 'quiz'; const q = questions[at];
      const p = document.createElement('p'); p.textContent = `คำถาม ${at + 1}/${questions.length}`;
      const h = document.createElement('h3'); h.textContent = q.q; const choices = document.createElement('div'); choices.className = 'choices';
      q.choices.forEach((choice, index) => {
        const b = document.createElement('button'); b.type = 'button'; b.textContent = choice;
        b.addEventListener('click', () => {
          if (b.disabled) return;
          choices.querySelectorAll('button').forEach(button => { button.disabled = true; });
          const correct = index === q.answer;
          b.classList.add(correct ? 'answer-correct' : 'answer-wrong');
          if (!correct) choices.children[q.answer].classList.add('answer-correct');
          showGameFeedback(correct ? 'correct' : 'wrong', b);
          notify(correct ? 'ถูกต้องเลย ♡' : 'ยังไม่ใช่นะ 😤');
          if (correct) score++;
          setTimeout(() => { at++; if (at < questions.length) { $('#gameBody').textContent = ''; render(); } else finish(); }, motionDisabled() ? 100 : 1900);
        });
        choices.append(b);
      });
      wrap.append(p, h, choices); $('#gameBody').append(wrap);
    };
    game('รู้ใจอัยย์แค่ไหน?', document.createElement('div')); render();
  }
  function startMatch() {
    const source = memories.filter(m => mediaItems(m)[0]).sort(() => Math.random() - .5).slice(0, 4); const cards = [...source, ...source].sort(() => Math.random() - .5); let open = [], matched = 0, locked = false; const board = document.createElement('div'); board.className = 'match-board';
    cards.forEach(memory => {
      const b = document.createElement('button'); b.className = 'match-card'; b.type = 'button'; b.dataset.memory = memory.id; b.textContent = '?';
      b.addEventListener('click', () => {
        if (locked || b.classList.contains('matched') || open.includes(b)) return;
        b.textContent = ''; const picture = document.createElement('img'); picture.src = img(mediaItems(memory)[0].id); picture.alt = memory.title; b.append(picture); open.push(b);
        if (open.length === 2) {
          locked = true;
          const same = open[0].dataset.memory === open[1].dataset.memory;
          open.forEach(card => card.classList.add(same ? 'match-correct' : 'match-wrong'));
          showGameFeedback(same ? 'correct' : 'wrong', open[1]);
          notify(same ? 'จับคู่ถูกแล้ว ♡' : 'ยังไม่ใช่คู่นี้นะ 😤');
          setTimeout(() => { if (same) { open.forEach(c => { c.classList.remove('match-correct'); c.classList.add('matched'); }); matched++; if (matched === source.length) notify('จับคู่ครบแล้ว เก่งมาก ♡'); } else open.forEach(c => { c.classList.remove('match-wrong'); c.textContent = '?'; }); open = []; locked = false; }, motionDisabled() ? 100 : 1800);
        }
      });
      board.append(b);
    });
    game('ความทรงจำคู่กัน', board);
  }
  function startZoom() { const memory = memories[Math.floor(Math.random() * memories.length)]; const wrap = document.createElement('div'); const box = document.createElement('div'); box.className = 'zoom-box'; const picture = document.createElement('img'); picture.src = img(mediaItems(memory)[0].id); picture.alt = 'ภาพความทรงจำ'; picture.style.transform = 'scale(2.5)'; box.append(picture); const button = document.createElement('button'); button.type = 'button'; button.textContent = 'ค่อย ๆ เปิดภาพ'; let level = 2.5; button.addEventListener('click', () => { level = Math.max(1, level - .3); picture.style.transform = `scale(${level})`; if (level <= 1) { button.textContent = memory.title; button.onclick = () => { const p = document.createElement('p'); p.textContent = `${formatDate(memory.date)} · ${memory.memory || 'ภาพนี้ทำให้นึกถึงวันของเรา'}`; wrap.append(p); }; } }); wrap.append(box, button); game('ภาพนี้ วันไหนกันนะ?', wrap); }
  $$('.games > button').forEach(b => b.addEventListener('click', () => ({ quiz: startQuiz, match: startMatch, zoom: startZoom }[b.dataset.game])()));

  function setupLoveLetter() {
    const footer = $('footer');
    if (!footer || $('#letterTrigger')) return;
    const trigger = document.createElement('button');
    trigger.id = 'letterTrigger';
    trigger.className = 'letter-trigger';
    trigger.type = 'button';
    trigger.hidden = true;
    trigger.innerHTML = '<span aria-hidden="true">✉</span><b>มีจดหมายถึงเบบี้</b><small>เลื่อนมาถึงข้างล่างสุดแล้ว เปิดอ่านได้เลย</small>';

    const openLetter = () => {
      const paper = document.createElement('article');
      paper.className = 'love-letter';
      const mark = document.createElement('span'); mark.className = 'letter-mark'; mark.textContent = '♡ 02';
      const heading = document.createElement('h3'); heading.textContent = 'ถึงเบบี้';
      const message = document.createElement('p');
      message.textContent = 'ขอบคุณเบบี้ที่อยู่ด้วยกันมา 2 ปีแล้ว บางครั้งเราอาจทะเลาะกันบ่อย แต่เชื่อไหม เค้ายังรักเบบี้เหมือนเดิม และรักขึ้นไปเรื่อย ๆ เลย อดใจที่จะรอปีต่อไปไม่ไหวแล้ววว';
      paper.append(mark, heading, message);
      game('จดหมายจากทัก', paper);
    };
    trigger.addEventListener('click', openLetter);
    footer.parentNode.insertBefore(trigger, footer);

    const revealAtBottom = () => {
      const distance = document.documentElement.scrollHeight - (window.scrollY + window.innerHeight);
      if (distance <= 18) {
        trigger.hidden = false;
        requestAnimationFrame(() => trigger.classList.add('is-visible'));
        window.removeEventListener('scroll', revealAtBottom);
        window.removeEventListener('resize', revealAtBottom);
      }
    };
    window.addEventListener('scroll', revealAtBottom, { passive: true });
    window.addEventListener('resize', revealAtBottom);
    revealAtBottom();
  }

  let hearts = Math.min(5, Math.max(0, Number(storage.get('love-hearts', 0)) || 0)); const heartsLabel = $('#hearts'); const updateHearts = () => { if (heartsLabel) heartsLabel.textContent = `♡ ${hearts} / 5`; storage.set('love-hearts', hearts); };
  const cat = $('#cat'), pupils = $('#pupils'), bubble = $('#bubble'); let petTimer, bubbleTimer;
  const spawnCatHearts = () => {
    if (!cat) return;
    const rect = cat.getBoundingClientRect();
    const heartsToShow = [{ dx: -25, dy: -4, size: 28, delay: 0 }, { dx: 8, dy: -10, size: 36, delay: 90 }, { dx: 42, dy: -2, size: 24, delay: 170 }];
    heartsToShow.forEach((item, index) => {
      const heart = document.createElement('span');
      heart.className = `cat-heart cat-heart-${index + 1}`;
      heart.textContent = '♥';
      heart.setAttribute('aria-hidden', 'true');
      heart.style.left = `${rect.left + rect.width / 2 + item.dx}px`;
      heart.style.top = `${rect.top + item.dy}px`;
      heart.style.fontSize = `${item.size}px`;
      heart.style.animationDelay = `${item.delay}ms`;
      heart.style.setProperty('--drift', `${item.dx * .7}px`);
      document.body.append(heart);
      setTimeout(() => heart.remove(), 1700);
    });
  };
  const pet = () => { if (!cat) return; playCatSound('pet'); cat.classList.remove('pet'); void cat.offsetWidth; cat.classList.add('pet'); clearTimeout(petTimer); petTimer = setTimeout(() => cat.classList.remove('pet'), 850); spawnCatHearts(); if (hearts < 5) hearts++; updateHearts(); clearTimeout(bubbleTimer); if (bubble) { bubble.textContent = 'งื้อ~ อ้อนแล้วนะ ♡'; bubbleTimer = setTimeout(() => { bubble.textContent = hearts >= 5 ? 'เปิดห้องแมวดำได้แล้ว! เหมียว!' : 'เหมียว~ ลูบอีกนิดนะ'; }, 900); } if (hearts === 5) notify('เก็บหัวใจครบ 5 ดวงแล้ว ♡'); };
  // A click is emitted for keyboard, mouse, and a completed touch, so one pet
  // gesture always earns one heart on mobile as well.
  cat?.addEventListener('click', pet);
  document.addEventListener('pointermove', e => { if (!pupils || !window.innerWidth) return; const x = (e.clientX / window.innerWidth - .5) * 8, y = (e.clientY / window.innerHeight - .5) * 4; pupils.style.transform = `translate(${x}px,${y}px)`; }, { passive: true });
  $('#catRoom')?.addEventListener('click', () => { if (hearts < 5) { notify(`ลูบหัวแมวให้ครบอีก ${5 - hearts} ดวงนะ`); return; } const wrap = document.createElement('div'); wrap.className = 'room'; const catText = document.createElement('div'); catText.className = 'room-cat room-cat-sprite'; catText.setAttribute('role', 'img'); catText.setAttribute('aria-label', 'แมวดำกำลังกระพริบตาและแกว่งหางแบบเฟรมบายเฟรม'); const p = document.createElement('p'); p.textContent = 'ห้องเล็ก ๆ สำหรับพักใจของเรา'; const feed = document.createElement('button'); feed.type = 'button'; feed.textContent = 'ให้ขนม 🍣'; const play = document.createElement('button'); play.type = 'button'; play.textContent = 'เล่นด้วย 🧶'; const response = document.createElement('p'); let catMotionTimer; const framePosition = frame => `${(frame / 4) * 100}% 50%`; const animateCat = sequence => { clearInterval(catMotionTimer); const frames = [...sequence, 0]; let index = 0; const showFrame = () => { catText.style.backgroundPosition = framePosition(frames[index]); index += 1; if (index >= frames.length) { clearInterval(catMotionTimer); catText.style.backgroundPosition = framePosition(0); } }; showFrame(); catMotionTimer = setInterval(showFrame, 225); }; feed.addEventListener('click', () => { playCatSound('treat'); animateCat([0, 1, 2, 1]); response.textContent = 'เหมียว! ขอบคุณสำหรับขนมนะ'; }); play.addEventListener('click', () => { playCatSound('play'); animateCat([0, 3, 4, 3]); response.textContent = 'แมววิ่งไล่ลูกไหมพรมอย่างมีความสุข'; }); wrap.append(catText, p, feed, play, response); game('ห้องแมวดำ', wrap); });
  $('#heartSecret')?.addEventListener('click', e => { e.currentTarget.textContent = '♥'; spawnHeart(e.clientX, e.clientY); notify('หัวใจลับของเรา ♡'); });
  function spawnHeart(x, y) { const heart = document.createElement('span'); heart.className = 'floating-heart'; heart.textContent = '♥'; heart.style.left = `${x || innerWidth / 2}px`; heart.style.top = `${y || innerHeight - 50}px`; document.body.append(heart); setTimeout(() => heart.remove(), motionDisabled() ? 0 : 1400); }
  const motion = $('#motion'); motion?.addEventListener('click', () => { document.documentElement.classList.toggle('reduced'); const on = document.documentElement.classList.contains('reduced'); motion.setAttribute('aria-pressed', String(on)); motion.textContent = on ? '○' : '◐'; storage.set('love-reduced', on); }); if (storage.get('love-reduced', false)) motion?.click();
  updateHearts(); renderTimeline(); renderHighlight(); renderGallery(); setupLoveLetter();
})();
