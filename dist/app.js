(() => {
  'use strict';

  const memories = Array.isArray(window.MEMORIES) ? window.MEMORIES : [];
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => Array.from(root.querySelectorAll(s));
  const img = id => `assets/${String(id).replace(/\.jpg$/i, '')}.jpg`;
  const mediaItems = memory =>
    Array.isArray(memory.media) && memory.media.length
      ? memory.media
      : (memory.photos || []).map(id => ({ id, type: 'image', asset: `${id}.jpg` }));
  const mediaAsset = item => `assets/${item.asset || `${item.id}.jpg`}`;

  const storage = {
    get(k, fallback) {
      try {
        const v = localStorage.getItem(k);
        return v == null ? fallback : JSON.parse(v);
      } catch (_) {
        return fallback;
      }
    },
    set(k, v) {
      try {
        localStorage.setItem(k, JSON.stringify(v));
      } catch (_) {}
    }
  };

  // --- Media Element Factory ---
  const createMedia = (item, alt, controls = false, autoplay = true) => {
    if (item.type === 'video') {
      const video = document.createElement('video');
      video.src = mediaAsset(item);
      video.poster = img(item.id);
      video.autoplay = autoplay;
      video.loop = true;
      video.muted = true;
      video.playsInline = true;
      video.preload = autoplay ? 'metadata' : 'none';
      video.setAttribute('playsinline', '');
      video.setAttribute('webkit-playsinline', '');
      video.setAttribute('muted', '');
      video.setAttribute('aria-label', alt);
      if (controls) video.controls = true;
      if (autoplay) {
        video.addEventListener('canplay', () => video.play().catch(() => {}), { once: true });
        video.play().catch(() => {});
      }
      return video;
    }
    const picture = document.createElement('img');
    picture.src = mediaAsset(item);
    picture.alt = alt;
    picture.loading = 'lazy';
    return picture;
  };

  // --- Audio & Ambient Music System ---
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
      audio.volume = Math.max(
        0,
        Math.min(1, start + (targetVolume - start) * (1 - Math.pow(1 - progress, 3)))
      );
      if (progress < 1) requestAnimationFrame(tick);
      else {
        if (fadeTokens.get(audio) === token) fadeTokens.delete(audio);
        if (done) done();
      }
    };
    requestAnimationFrame(tick);
  };

  const ambientMusic = new Audio('assets/our-little-us-bed.wav?v=music-soft-1');
  ambientMusic.loop = true;
  ambientMusic.preload = 'auto';
  ambientMusic.volume = 0;

  let ambientMusicEnabled = storage.get('love-music-enabled', true);
  let ambientMusicUnlocked = false;
  let ambientHighlightActive = false;
  let viewerAudioActive = false;
  let catMusicDucked = false;
  let catDuckTimer;

  const ambientMusicTarget = () => {
    if (!ambientMusicEnabled) return 0;
    if (viewerAudioActive || ambientHighlightActive) return 0.03;
    if (catMusicDucked) return 0.045;
    return 0.16;
  };

  const refreshAmbientMusic = (duration = 700) => {
    if (!ambientMusicUnlocked) return;
    const target = ambientMusicTarget();
    if (target > 0) ambientMusic.play().catch(() => {});
    fadeAudioVolume(
      ambientMusic,
      target,
      duration,
      target === 0 ? () => ambientMusic.pause() : undefined
    );
  };

  const startAmbientMusic = () => {
    if (!ambientMusicEnabled) return;
    ambientMusicUnlocked = true;
    ambientMusic
      .play()
      .then(() => refreshAmbientMusic(900))
      .catch(() => {
        ambientMusicUnlocked = false;
      });
  };

  const setAmbientMusicEnabled = enabled => {
    ambientMusicEnabled = Boolean(enabled);
    storage.set('love-music-enabled', ambientMusicEnabled);
    const toggle = $('#musicToggle');
    if (toggle) {
      toggle.setAttribute('aria-pressed', String(ambientMusicEnabled));
      toggle.textContent = ambientMusicEnabled ? '♫' : '◌';
      toggle.title = ambientMusicEnabled ? 'ปิดเพลงโรแมนติกเบา ๆ' : 'เปิดเพลงโรแมนติกเบา ๆ';
    }
    if (ambientMusicEnabled) {
      startAmbientMusic();
      refreshAmbientMusic(700);
    } else {
      refreshAmbientMusic(420);
    }
  };

  const duckAmbientMusic = (duration = 1400) => {
    if (!ambientMusicUnlocked) return;
    catMusicDucked = true;
    refreshAmbientMusic(110);
    clearTimeout(catDuckTimer);
    catDuckTimer = setTimeout(() => {
      catMusicDucked = false;
      refreshAmbientMusic(360);
    }, duration);
  };

  window.addEventListener('pointerdown', () => { if (ambientMusicEnabled) startAmbientMusic(); }, { passive: true });
  window.addEventListener('keydown', () => { if (ambientMusicEnabled) startAmbientMusic(); }, { passive: true });

  $('#musicToggle')?.addEventListener('click', () => setAmbientMusicEnabled(!ambientMusicEnabled));
  setAmbientMusicEnabled(ambientMusicEnabled);

  const playCatSound = kind => {
    try {
      startAmbientMusic();
      duckAmbientMusic(1450);
      const file = kind === 'purr' ? 'cat-meow.wav' : 'cat-meow-2.wav';
      const audio = new Audio(`assets/${file}?v=meow-2`);
      audio.volume = 0;
      audio.playbackRate = kind === 'play' ? 1.12 : kind === 'treat' ? 0.98 : kind === 'purr' ? 0.88 : 1;
      const target = kind === 'play' ? 0.72 : 0.82;
      const fadeOut = () => fadeAudioVolume(audio, 0, 220, () => audio.pause());
      audio.addEventListener(
        'loadedmetadata',
        () => {
          window.setTimeout(fadeOut, Math.max(0, (audio.duration - 0.24) * 1000));
        },
        { once: true }
      );
      audio.addEventListener('ended', () => { audio.volume = 0; }, { once: true });
      audio.play().then(() => fadeAudioVolume(audio, target, 150)).catch(() => {});
    } catch (_) {}
  };

  // --- Theme Mode (Daylight Paper / Starry Night) ---
  const themeToggle = $('#themeToggle');
  const themeMeta = $('#themeColorMeta');
  let currentTheme = storage.get('love-theme', 'day');

  const applyTheme = theme => {
    currentTheme = theme === 'night' ? 'night' : 'day';
    if (currentTheme === 'night') {
      document.documentElement.setAttribute('data-theme', 'night');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
    if (themeToggle) {
      const isNight = currentTheme === 'night';
      themeToggle.setAttribute('aria-pressed', String(isNight));
      themeToggle.textContent = isNight ? '☀' : '☾';
      themeToggle.title = isNight ? 'สลับกลับโหมดกระดาษกลางวัน' : 'สลับโหมดดูดาวกลางคืน';
    }
    if (themeMeta) {
      themeMeta.setAttribute('content', currentTheme === 'night' ? '#171820' : '#f6f0e2');
    }
    storage.set('love-theme', currentTheme);
  };

  themeToggle?.addEventListener('click', () => {
    const next = currentTheme === 'night' ? 'day' : 'night';
    applyTheme(next);
    notify(next === 'night' ? 'เข้าสู่โหมดดูดาวกลางคืน ☾' : 'กลับมาโหมดสมุดบันทึกกลางวัน ☀');
  });
  applyTheme(currentTheme);

  // --- Reduced Motion ---
  const motionDisabled = () => document.documentElement.classList.contains('reduced');

  const motionBtn = $('#motion');
  motionBtn?.addEventListener('click', () => {
    document.documentElement.classList.toggle('reduced');
    const on = document.documentElement.classList.contains('reduced');
    motionBtn.setAttribute('aria-pressed', String(on));
    motionBtn.textContent = on ? '○' : '◐';
    storage.set('love-reduced', on);
    notify(on ? 'ปิดแอนิเมชันและลดการเคลื่อนไหวแล้ว' : 'เปิดแอนิเมชันปกติแล้ว');
  });
  if (storage.get('love-reduced', false)) {
    document.documentElement.classList.add('reduced');
    motionBtn?.setAttribute('aria-pressed', 'true');
    if (motionBtn) motionBtn.textContent = '○';
  }

  // --- Live Relationship Counter (Since 06 Sep 2024 00:00:00+07:00) ---
  const START_DATE = new Date('2024-09-06T00:00:00+07:00');
  const updateLiveClock = () => {
    const now = new Date();
    const diffMs = Math.max(0, now.getTime() - START_DATE.getTime());
    const totalSeconds = Math.floor(diffMs / 1000);
    const totalDays = Math.floor(totalSeconds / 86400);

    let years = now.getFullYear() - START_DATE.getFullYear();
    let months = now.getMonth() - START_DATE.getMonth();
    let days = now.getDate() - START_DATE.getDate();

    if (days < 0) {
      months -= 1;
      const prevMonth = new Date(now.getFullYear(), now.getMonth(), 0);
      days += prevMonth.getDate();
    }
    if (months < 0) {
      years -= 1;
      months += 12;
    }

    const hours = now.getHours();
    const minutes = now.getMinutes();
    const seconds = now.getSeconds();

    const setTxt = (id, val) => {
      const el = $(id);
      if (el) el.textContent = String(val);
    };
    setTxt('#clockYears', Math.max(0, years));
    setTxt('#clockMonths', Math.max(0, months));
    setTxt('#clockDays', Math.max(0, days));
    setTxt('#clockHours', String(hours).padStart(2, '0'));
    setTxt('#clockMinutes', String(minutes).padStart(2, '0'));
    setTxt('#clockSeconds', String(seconds).padStart(2, '0'));

    const sub = $('#liveCounterSub');
    if (sub) {
      sub.textContent = `เริ่มคบ 06.09.2024 · วันนี้เราเดินมาด้วยกัน ${totalDays.toLocaleString('th-TH')} วันแล้ว ♡`;
    }
  };
  updateLiveClock();
  setInterval(updateLiveClock, 1000);

  // --- Ribbon Stats ---
  const updateRibbonStats = () => {
    const totalEvents = memories.length;
    const totalMedia = memories.reduce((sum, m) => sum + mediaItems(m).length, 0);
    const el = $('#ribbonStats');
    if (el) el.textContent = `${totalEvents} บทความทรงจำ · ${totalMedia} รูปและคลิป`;
  };
  updateRibbonStats();

  // --- Toast & Dialog Helpers ---
  const favorites = new Set(storage.get('love-favorites', []));
  let year = 'all';
  let category = 'all';
  let searchQuery = '';
  let sortOrder = 'chronological';
  let storyCount = 6;
  let galleryCount = 12;
  let viewerIndex = 0;
  let slideshowTimer = null;
  let lastFocusedTrigger = null;

  const viewer = $('#viewer');
  const gameDialog = $('#gameDialog');
  const toast = $('#toast');
  let toastTimer;

  const notify = message => {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 2400);
  };

  const stopSlideshow = () => {
    if (slideshowTimer) {
      clearInterval(slideshowTimer);
      slideshowTimer = null;
    }
  };

  const pauseAllDialogVideos = dialogEl => {
    if (!dialogEl) return;
    $$('video', dialogEl).forEach(v => {
      try {
        v.pause();
        v.muted = true;
      } catch (_) {}
    });
    viewerAudioActive = false;
    refreshAmbientMusic(500);
  };

  const openDialog = d => {
    if (!d) return;
    if (!d.open) {
      lastFocusedTrigger = document.activeElement;
      if (typeof d.showModal === 'function') d.showModal();
      else d.setAttribute('open', '');
    }
  };

  const closeDialog = d => {
    if (!d) return;
    stopSlideshow();
    pauseAllDialogVideos(d);
    if (typeof d.close === 'function' && d.open) d.close();
    else d.removeAttribute('open');
    if (lastFocusedTrigger && typeof lastFocusedTrigger.focus === 'function') {
      lastFocusedTrigger.focus();
      lastFocusedTrigger = null;
    }
  };

  const formatDate = date => {
    if (!date) return 'ไม่ระบุวันที่';
    const [y, m, d] = date.split('-');
    return `${d}/${m}/${y}`;
  };

  // --- Filtering & Sorting Memories ---
  const filterTimelineMemories = () => {
    const q = searchQuery.trim().toLowerCase();
    const filtered = memories.filter(m => {
      const dateStr = m.date || '';
      const matchYear =
        year === 'all'
          ? true
          : year === 'undated'
          ? !dateStr
          : dateStr.startsWith(year);
      if (!matchYear) return false;
      if (!q) return true;
      const hay = `${m.title || ''} ${m.memory || ''} ${m.date || ''} ${formatDate(m.date)}`.toLowerCase();
      return hay.includes(q);
    });

    if (sortOrder === 'newest') {
      return [...filtered].sort((a, b) => {
        if (!a.date && !b.date) return 0;
        if (!a.date) return 1;
        if (!b.date) return -1;
        return b.date.localeCompare(a.date);
      });
    }
    if (sortOrder === 'oldest') {
      return [...filtered].sort((a, b) => {
        if (!a.date && !b.date) return 0;
        if (!a.date) return 1;
        if (!b.date) return -1;
        return a.date.localeCompare(b.date);
      });
    }
    return filtered;
  };

  const visibleGalleryMemories = () =>
    memories.filter(m => {
      if (category === 'all') return true;
      if (category === 'favorite') return favorites.has(m.id);
      if (category === 'video') return mediaItems(m).some(item => item.type === 'video');
      return m.category === category;
    });

  // --- Render Timeline ---
  function renderTimeline() {
    const fullList = filterTimelineMemories();
    const list = fullList.slice(0, storyCount);
    const root = $('#timeline');
    if (!root) return;
    root.textContent = '';

    const metaEl = $('#storyResultMeta');
    if (metaEl) {
      metaEl.textContent =
        fullList.length > 0
          ? `แสดง ${list.length} จาก ${fullList.length} บทความทรงจำ`
          : 'ไม่พบความทรงจำที่ตรงกับคำค้นหา';
    }

    if (!list.length) {
      root.innerHTML = '<p class="empty">ยังไม่มีบันทึกที่ตรงกับเงื่อนไขนี้ ลองเปลี่ยนปีหรือคำค้นหาดูนะ</p>';
    } else {
      list.forEach(memory => {
        const items = mediaItems(memory);
        const button = document.createElement('button');
        button.className = 'memory';
        button.type = 'button';
        button.dataset.id = memory.id;

        const mediaWrap = document.createElement('div');
        mediaWrap.className = 'memory-media-wrap';
        const picture = createMedia(items[0], memory.title, false, true);
        mediaWrap.append(picture);

        const hasVideo = items.some(it => it.type === 'video');
        if (items.length > 1 || hasVideo) {
          const badge = document.createElement('span');
          badge.className = 'media-badge';
          badge.textContent = `${hasVideo ? '🎬 ' : ''}${items.length} สื่อ`;
          mediaWrap.append(badge);
        }

        if (favorites.has(memory.id)) {
          const favBadge = document.createElement('span');
          favBadge.className = 'fav-indicator';
          favBadge.textContent = '♥';
          favBadge.setAttribute('aria-label', 'เก็บไว้ในรายการโปรดแล้ว');
          mediaWrap.append(favBadge);
        }

        const date = document.createElement('small');
        date.textContent = formatDate(memory.date);
        const title = document.createElement('h3');
        title.textContent = memory.title;
        const text = document.createElement('p');
        text.textContent = memory.memory || 'เก็บภาพนี้ไว้ในสมุดของเรา';

        button.append(mediaWrap, date, title, text);
        button.addEventListener('click', () => openViewer(memory, 0));
        root.append(button);
      });
    }

    const more = $('#more');
    const showAll = $('#showAllStory');
    const hasMore = list.length < fullList.length;
    if (more) more.hidden = !hasMore;
    if (showAll) showAll.hidden = !hasMore || fullList.length <= 6;
  }

  // --- Render Gallery ---
  function renderGallery() {
    const list = visibleGalleryMemories();
    const root = $('#grid');
    if (!root) return;
    root.textContent = '';

    const sliced = list.slice(0, galleryCount);
    const metaEl = $('#galleryResultMeta');
    if (metaEl) {
      const totalMediaCount = list.reduce((acc, m) => acc + mediaItems(m).length, 0);
      metaEl.textContent =
        list.length > 0
          ? `หมวดนี้มี ${list.length} เหตุการณ์ (${totalMediaCount} รูปและคลิป)`
          : '';
    }

    if (!list.length) {
      root.innerHTML =
        category === 'favorite'
          ? '<p class="empty">ยังไม่มีรูปที่กดหัวใจเก็บไว้ ลองเปิดดูรูปแล้วกด "♡ เก็บไว้" ดูนะ</p>'
          : '<p class="empty">ยังไม่มีรูปในหมวดนี้</p>';
    } else {
      sliced.forEach(memory => {
        mediaItems(memory).forEach((item, mediaIndex) => {
          if (category === 'video' && item.type !== 'video') return;
          const button = document.createElement('button');
          button.type = 'button';
          button.className = 'gallery-item';
          button.dataset.id = memory.id;
          button.dataset.photo = String(mediaIndex);
          button.setAttribute(
            'aria-label',
            `เปิด${item.type === 'video' ? 'วิดีโอ' : 'รูป'} ${memory.title}`
          );

          const picture = createMedia(item, memory.title, false, true);
          const overlay = document.createElement('span');
          overlay.className = 'gallery-caption-overlay';
          overlay.textContent = `${memory.title} (${formatDate(memory.date)})`;

          if (item.type === 'video') {
            const vBadge = document.createElement('span');
            vBadge.className = 'media-badge';
            vBadge.textContent = '🎬 วิดีโอ';
            button.append(vBadge);
          }

          button.append(picture, overlay);
          button.addEventListener('click', () => openViewer(memory, mediaIndex));
          root.append(button);
        });
      });
    }

    const more = $('#galleryMore');
    const showAll = $('#showAllGallery');
    const hasMore = galleryCount < list.length;
    if (more) more.hidden = !hasMore;
    if (showAll) showAll.hidden = !hasMore || list.length <= 12;
  }

  // --- Render Highlight Video ---
  function renderHighlight() {
    const toolbar = $('.story-toolbar');
    if (!toolbar || $('#highlight')) return;
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
    eyebrow.setAttribute('lang', 'en');
    eyebrow.textContent = 'HIGHLIGHT / A DAY TO KEEP';
    const heading = document.createElement('h3');
    heading.textContent = 'คลิปไฮไลท์จากกาญจนบุรี';
    const text = document.createElement('p');
    text.textContent =
      'ทริปที่ครอบครัวอัยย์พาเราไปเที่ยวด้วยกัน — ทักตัดคลิปนี้ไว้เป็นความทรงจำสวย ๆ';

    const actions = document.createElement('div');
    actions.className = 'highlight-actions';
    const open = document.createElement('button');
    open.type = 'button';
    open.textContent = 'เปิดความทรงจำทั้งหมด ↗';
    open.addEventListener('click', () => openViewer(memory, videoIndex));

    const muteBtn = document.createElement('button');
    muteBtn.type = 'button';
    muteBtn.textContent = '🔊 เปิดเสียงคลิป';

    actions.append(open, muteBtn);
    copy.append(eyebrow, heading, text, actions);

    const video = createMedia(videoItem, 'คลิปไฮไลท์ทริปกาญจนบุรี', false, true);
    video.className = 'highlight-media';
    video.volume = 0;
    video.muted = true;

    let highlightVisible = false;
    let musicUnlocked = false;
    let userMutedHighlight = false;

    const updateMuteButton = () => {
      muteBtn.textContent = video.muted || video.volume === 0 ? '🔊 เปิดเสียงคลิป' : '🔇 ปิดเสียงคลิป';
    };

    const fadeMusicTo = target => {
      if (target > 0 && !userMutedHighlight) {
        ambientHighlightActive = true;
        refreshAmbientMusic(760);
        video.muted = false;
        video.play().catch(() => {});
        fadeAudioVolume(video, target, 760, updateMuteButton);
      } else {
        ambientHighlightActive = false;
        refreshAmbientMusic(760);
        fadeAudioVolume(video, 0, 500, () => {
          video.muted = true;
          updateMuteButton();
        });
      }
    };

    muteBtn.addEventListener('click', () => {
      musicUnlocked = true;
      if (video.muted || video.volume === 0) {
        userMutedHighlight = false;
        fadeMusicTo(0.65);
      } else {
        userMutedHighlight = true;
        fadeMusicTo(0);
      }
    });

    const unlockMusic = () => {
      musicUnlocked = true;
      if (highlightVisible && !userMutedHighlight) fadeMusicTo(0.62);
    };
    window.addEventListener('pointerdown', unlockMusic, { once: true, passive: true });

    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver(
        entries => {
          highlightVisible = Boolean(
            entries[0]?.isIntersecting && entries[0].intersectionRatio >= 0.35
          );
          if (highlightVisible) {
            video.play().catch(() => {});
            if (musicUnlocked && !userMutedHighlight) fadeMusicTo(0.62);
          } else {
            fadeMusicTo(0);
          }
        },
        { threshold: [0, 0.35, 0.7] }
      );
      observer.observe(highlight);
    }

    video.addEventListener('click', () => openViewer(memory, videoIndex));
    video.setAttribute('title', 'คลิกเพื่อดูรูปและคลิปของทริปนี้ทั้งหมด');
    highlight.append(copy, video);
    toolbar.parentNode.insertBefore(highlight, toolbar);
  }

  // --- Upgraded Media Viewer (Prev/Next, Keyboard, Swipe, Thumbs, Slideshow) ---
  let currentViewerMemory = null;

  function openViewer(memory, photoIndex = 0, keepSlideshow = false) {
    if (!keepSlideshow) stopSlideshow();
    const items = mediaItems(memory);
    if (!items.length) return;
    currentViewerMemory = memory;
    viewerIndex = (photoIndex + items.length) % items.length;

    const body = $('#viewerBody');
    if (!body) return;
    pauseAllDialogVideos(viewer);
    body.textContent = '';

    const stage = document.createElement('div');
    stage.className = 'viewer-stage';

    const deck = document.createElement('div');
    deck.className = `media-stack${items.length > 1 ? ' has-stack' : ''}`;
    deck.setAttribute('role', 'group');
    deck.setAttribute(
      'aria-label',
      items.length > 1 ? 'คลิกรูปหรือปัดซ้ายขวาเพื่อดูใบถัดไป' : memory.title
    );

    const stepMedia = delta => {
      if (items.length > 1) {
        openViewer(memory, (viewerIndex + delta + items.length) % items.length, Boolean(slideshowTimer));
      }
    };

    items.forEach((item, index) => {
      const depth = (index - viewerIndex + items.length) % items.length;
      const card = document.createElement('div');
      card.className = `stack-card${depth === 0 ? ' is-active' : ''}`;
      card.dataset.depth = String(Math.min(depth, 3));
      card.setAttribute('aria-hidden', String(depth !== 0));

      const isTop = depth === 0;
      const media = createMedia(item, memory.title, isTop && item.type === 'video', isTop);
      media.classList.add('viewer-media');

      if (isTop && item.type === 'video') {
        media.addEventListener('volumechange', () => {
          viewerAudioActive = !media.muted && media.volume > 0;
          refreshAmbientMusic(400);
        });
      }

      card.append(media);
      if (isTop && items.length > 1 && item.type !== 'video') {
        card.setAttribute('role', 'button');
        card.setAttribute('tabindex', '0');
        card.setAttribute('aria-label', 'ดูสื่อถัดไป');
        card.addEventListener('click', () => stepMedia(1));
        card.addEventListener('keydown', e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            stepMedia(1);
          }
        });
      }
      deck.append(card);
    });

    // Touch Swipe Support
    let touchStartX = 0;
    deck.addEventListener(
      'touchstart',
      e => {
        touchStartX = e.changedTouches[0]?.screenX || 0;
      },
      { passive: true }
    );
    deck.addEventListener(
      'touchend',
      e => {
        const diff = (e.changedTouches[0]?.screenX || 0) - touchStartX;
        if (Math.abs(diff) > 42 && items.length > 1) {
          stepMedia(diff < 0 ? 1 : -1);
        }
      },
      { passive: true }
    );

    if (items.length > 1) {
      const prevBtn = document.createElement('button');
      prevBtn.type = 'button';
      prevBtn.className = 'viewer-nav-btn viewer-nav-prev';
      prevBtn.setAttribute('aria-label', 'รูปก่อนหน้า');
      prevBtn.textContent = '‹';
      prevBtn.addEventListener('click', () => stepMedia(-1));

      const nextBtn = document.createElement('button');
      nextBtn.type = 'button';
      nextBtn.className = 'viewer-nav-btn viewer-nav-next';
      nextBtn.setAttribute('aria-label', 'รูปถัดไป');
      nextBtn.textContent = '›';
      nextBtn.addEventListener('click', () => stepMedia(1));

      stage.append(prevBtn, deck, nextBtn);
    } else {
      stage.append(deck);
    }

    body.append(stage);

    // Thumbnail Strip for Multi-media Events
    if (items.length > 1) {
      const thumbs = document.createElement('div');
      thumbs.className = 'viewer-thumbs';
      items.forEach((item, idx) => {
        const tBtn = document.createElement('button');
        tBtn.type = 'button';
        tBtn.className = `viewer-thumb${idx === viewerIndex ? ' is-active' : ''}`;
        tBtn.setAttribute('aria-label', `เลือกสื่อที่ ${idx + 1}`);
        const tImg = document.createElement('img');
        tImg.src = img(item.id);
        tImg.alt = `${memory.title} (${idx + 1})`;
        tBtn.append(tImg);
        tBtn.addEventListener('click', () => openViewer(memory, idx, Boolean(slideshowTimer)));
        thumbs.append(tBtn);
      });
      body.append(thumbs);
    }

    const heading = document.createElement('h2');
    heading.textContent = memory.title;
    const text = document.createElement('p');
    text.textContent = memory.memory || 'ความทรงจำเล็ก ๆ ของเรา';
    const meta = document.createElement('p');
    meta.className = 'viewer-meta';
    meta.textContent = `${formatDate(memory.date)} · สื่อที่ ${viewerIndex + 1}/${items.length}${
      items.length > 1 ? ' · ใช้ปุ่มลูกศรซ้าย/ขวา หรือคลิกรูปเพื่อเลื่อนดู' : ''
    }`;

    const actions = document.createElement('div');
    actions.className = 'dialog-actions';

    // Favorite Button
    const fav = document.createElement('button');
    fav.type = 'button';
    fav.textContent = favorites.has(memory.id) ? '♥ เก็บแล้ว' : '♡ เก็บไว้';
    fav.addEventListener('click', () => {
      favorites.has(memory.id) ? favorites.delete(memory.id) : favorites.add(memory.id);
      storage.set('love-favorites', [...favorites]);
      fav.textContent = favorites.has(memory.id) ? '♥ เก็บแล้ว' : '♡ เก็บไว้';
      renderTimeline();
      renderGallery();
      notify(
        favorites.has(memory.id)
          ? 'เก็บความทรงจำนี้ไว้ในรายการโปรดแล้ว ♡'
          : 'นำออกจากรายการที่เก็บไว้แล้ว'
      );
    });

    // Next / Prev Event Buttons
    const memIdx = memories.findIndex(m => m.id === memory.id);
    const nextEventBtn = document.createElement('button');
    nextEventBtn.type = 'button';
    nextEventBtn.textContent = 'ความทรงจำถัดไป →';
    nextEventBtn.addEventListener('click', () => {
      const nextMem = memories[(memIdx + 1) % memories.length];
      openViewer(nextMem, 0, Boolean(slideshowTimer));
    });

    // Slideshow Button
    const slideBtn = document.createElement('button');
    slideBtn.type = 'button';
    const updateSlideBtn = () => {
      slideBtn.textContent = slideshowTimer ? '⏸ หยุดสไลด์โชว์' : '▷ เล่นสไลด์โชว์';
    };
    updateSlideBtn();
    slideBtn.addEventListener('click', () => {
      if (slideshowTimer) {
        stopSlideshow();
        updateSlideBtn();
        notify('หยุดเล่นสไลด์โชว์แล้ว');
      } else {
        startSlideshowFromCurrent();
        updateSlideBtn();
        notify('กำลังเล่นสไลด์โชว์ความทรงจำอัตโนมัติ ♡');
      }
    });

    actions.append(fav, slideBtn, nextEventBtn);
    body.append(heading, text, meta, actions);
    openDialog(viewer);
  }

  function startSlideshowFromCurrent(initialList = memories) {
    stopSlideshow();
    const pool = initialList.length ? initialList : memories;
    if (!pool.length) return;
    if (!viewer.open || !currentViewerMemory) {
      openViewer(pool[0], 0, true);
    }
    slideshowTimer = setInterval(() => {
      if (!viewer.open || !currentViewerMemory) {
        stopSlideshow();
        return;
      }
      const items = mediaItems(currentViewerMemory);
      if (viewerIndex + 1 < items.length) {
        openViewer(currentViewerMemory, viewerIndex + 1, true);
      } else {
        const idx = pool.findIndex(m => m.id === currentViewerMemory.id);
        const nextMem = pool[(idx + 1) % pool.length];
        openViewer(nextMem, 0, true);
      }
    }, 3600);
  }

  $('#startSlideshowHero')?.addEventListener('click', () => {
    startSlideshowFromCurrent(memories);
    notify('เริ่มเล่นสไลด์โชว์สมุดความทรงจำ ♡');
  });

  $('#startSlideshowGallery')?.addEventListener('click', () => {
    const list = visibleGalleryMemories();
    if (!list.length) {
      notify('ยังไม่มีรูปในหมวดนี้ให้เล่นสไลด์โชว์');
      return;
    }
    startSlideshowFromCurrent(list);
    notify('เริ่มเล่นสไลด์โชว์หมวดที่เลือก ♡');
  });

  // Hero Polaroid Click
  const heroPolaroid = $('#heroPolaroid');
  const openAnniversaryMemory = () => {
    const target = memories.find(m => m.id === 'E079') || memories[memories.length - 1];
    if (target) openViewer(target, 0);
  };
  heroPolaroid?.addEventListener('click', openAnniversaryMemory);
  heroPolaroid?.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openAnniversaryMemory();
    }
  });

  // Interactive Milestone Cards
  $$('.milestone-card').forEach(card => {
    const activate = () => {
      const jumpId = card.dataset.jumpId;
      const jumpYear = card.dataset.jumpYear;
      if (jumpId) {
        const mem = memories.find(m => m.id === jumpId);
        if (mem) openViewer(mem, 0);
        return;
      }
      if (jumpYear) {
        const yearBtn = $(`#years button[data-year="${jumpYear}"]`);
        yearBtn?.click();
        $('#timeline')?.scrollIntoView({ behavior: motionDisabled() ? 'auto' : 'smooth' });
      }
    };
    card.addEventListener('click', activate);
    card.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        activate();
      }
    });
  });

  // Dialog Closing & Keyboard Navigation
  $$('.close').forEach(b => b.addEventListener('click', () => closeDialog(b.closest('dialog'))));
  [viewer, gameDialog].forEach(
    d =>
      d &&
      d.addEventListener('click', e => {
        if (e.target === d) closeDialog(d);
      })
  );
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      if (viewer?.open) closeDialog(viewer);
      if (gameDialog?.open) closeDialog(gameDialog);
      return;
    }
    if (viewer?.open && currentViewerMemory) {
      const items = mediaItems(currentViewerMemory);
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (items.length > 1) {
          openViewer(currentViewerMemory, (viewerIndex + 1) % items.length, Boolean(slideshowTimer));
        } else {
          const idx = memories.findIndex(m => m.id === currentViewerMemory.id);
          openViewer(memories[(idx + 1) % memories.length], 0, Boolean(slideshowTimer));
        }
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (items.length > 1) {
          openViewer(
            currentViewerMemory,
            (viewerIndex - 1 + items.length) % items.length,
            Boolean(slideshowTimer)
          );
        } else {
          const idx = memories.findIndex(m => m.id === currentViewerMemory.id);
          openViewer(
            memories[(idx - 1 + memories.length) % memories.length],
            0,
            Boolean(slideshowTimer)
          );
        }
      }
    }
  });

  // --- Toolbar Controls (Years, Search, Sort, Filters) ---
  $$('#years button').forEach(button =>
    button.addEventListener('click', () => {
      $$('#years button').forEach(b => b.classList.remove('active'));
      button.classList.add('active');
      year = button.dataset.year;
      storyCount = 6;
      renderTimeline();
    })
  );

  const searchInput = $('#storySearch');
  const clearSearchBtn = $('#clearSearch');
  searchInput?.addEventListener('input', () => {
    searchQuery = searchInput.value || '';
    if (clearSearchBtn) clearSearchBtn.hidden = !searchQuery;
    storyCount = 12;
    renderTimeline();
  });
  clearSearchBtn?.addEventListener('click', () => {
    if (!searchInput) return;
    searchInput.value = '';
    searchQuery = '';
    clearSearchBtn.hidden = true;
    storyCount = 6;
    renderTimeline();
    searchInput.focus();
  });

  $('#storySort')?.addEventListener('change', e => {
    sortOrder = e.target.value;
    renderTimeline();
  });

  $$('#filters button').forEach(button =>
    button.addEventListener('click', () => {
      $$('#filters button').forEach(b => b.classList.remove('active'));
      button.classList.add('active');
      category = button.dataset.filter;
      galleryCount = 12;
      renderGallery();
    })
  );

  $('#more')?.addEventListener('click', () => {
    storyCount += 6;
    renderTimeline();
  });
  $('#showAllStory')?.addEventListener('click', () => {
    storyCount = memories.length;
    renderTimeline();
  });
  $('#galleryMore')?.addEventListener('click', () => {
    galleryCount += 12;
    renderGallery();
  });
  $('#showAllGallery')?.addEventListener('click', () => {
    galleryCount = memories.length;
    renderGallery();
  });
  $('#random')?.addEventListener('click', () => {
    if (memories.length) openViewer(memories[Math.floor(Math.random() * memories.length)], 0);
  });

  // --- Mini Games Suite ---
  function game(title, content) {
    const body = $('#gameBody');
    if (!body) return;
    body.textContent = '';
    const h = document.createElement('h2');
    h.textContent = title;
    body.append(h, content);
    openDialog(gameDialog);
  }

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
    setTimeout(() => stage.remove(), motionDisabled() ? 700 : 2100);
  }

  // Game 1: Quiz (Expanded with verified facts from data.js & milestones)
  function startQuiz() {
    const questionBank = [
      {
        q: 'สีที่อัยย์ชอบคือชุดไหน?',
        choices: ['เหลือง ขาว ดำ', 'ชมพู ฟ้า เขียว', 'แดง ส้ม ม่วง'],
        answer: 0
      },
      {
        q: 'ดอกไม้ที่อัยย์ชอบคืออะไร?',
        choices: ['กุหลาบ', 'ทานตะวัน', 'ทิวลิป'],
        answer: 1
      },
      {
        q: 'วันเริ่มคบของเราคือวันไหน?',
        choices: ['06.09.2024', '06.09.2025', '09.06.2024'],
        answer: 0
      },
      {
        q: 'อัยย์ชอบเส้นก๋วยเตี๋ยวแบบไหน?',
        choices: ['เส้นหมี่', 'เส้นเล็ก', 'วุ้นเส้น'],
        answer: 0
      },
      {
        q: 'ในวันเริ่มคบกัน (06.09.2024) อัยย์ทำเมนูอะไรให้กิน?',
        choices: ['ไก่ต้มน้ำปลา', 'ก๋วยเตี๋ยวเรือ', 'ข้าวผัดกระเทียม'],
        answer: 0
      },
      {
        q: 'ทริปเที่ยวด้วยกันครั้งแรกของเราคือที่งานนิทรรศการอะไร?',
        choices: ['พาใจกลับบ้าน (Homecoming)', 'ท้องฟ้าจำลองกรุงเทพ', 'งานโชว์สัตว์น้ำ เซ็นทรัลเวิลด์'],
        answer: 0
      },
      {
        q: 'ในวันครบรอบ 1 ปี (06.09.2025) เราไปกินมื้อพิเศษกันที่ไหน?',
        choices: ['ร้านเย็นตาโฟ โต้รุ่ง', 'ฮาจิบัง เดอะมอลล์บางกะปิ', 'KFC เสรีไทยซอย 41'],
        answer: 0
      },
      {
        q: 'วันวาเลนไทน์ปี 2025 อัยย์ซื้ออะไรให้ทักเป็นของขวัญคู่กับช่อดอกไม้?',
        choices: ['เมาส์', 'หูฟัง', 'คีย์บอร์ด'],
        answer: 0
      }
    ];

    const questions = [...questionBank].slice(0, 6);
    let score = 0;
    let at = 0;
    const bestScore = Number(storage.get('love-quiz-best', 0)) || 0;

    const finish = () => {
      if (score > bestScore) storage.set('love-quiz-best', score);
      const wrap = document.createElement('div');
      wrap.className = 'room';
      const h = document.createElement('h3');
      h.textContent = `ได้ ${score}/${questions.length} คะแนน ♡`;
      const p = document.createElement('p');
      p.textContent =
        score === questions.length
          ? 'รู้ใจอัยย์และจำเรื่องของเราได้แม่นที่สุดเลย!'
          : 'ค่อย ๆ จำเรื่องราวของเราไปด้วยกันนะ';
      const retry = document.createElement('button');
      retry.type = 'button';
      retry.className = 'primary';
      retry.textContent = 'เล่นอีกครั้ง ↻';
      retry.addEventListener('click', startQuiz);
      wrap.append(h, p, retry);
      const body = $('#gameBody');
      if (body) {
        body.textContent = '';
        const title = document.createElement('h2');
        title.textContent = 'สรุปคะแนน: รู้ใจอัยย์แค่ไหน?';
        body.append(title, wrap);
      }
    };

    const render = () => {
      const host = $('#gameBody');
      if (!host) return;
      host.textContent = '';
      const title = document.createElement('h2');
      title.textContent = 'รู้ใจอัยย์แค่ไหน?';

      const wrap = document.createElement('div');
      wrap.className = 'quiz';
      const q = questions[at];
      const p = document.createElement('p');
      p.textContent = `คำถามข้อที่ ${at + 1}/${questions.length} · คะแนนตอนนี้ ${score}`;
      const h = document.createElement('h3');
      h.textContent = q.q;
      const choices = document.createElement('div');
      choices.className = 'choices';

      q.choices.forEach((choice, index) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = choice;
        b.addEventListener('click', () => {
          if (b.disabled) return;
          choices.querySelectorAll('button').forEach(button => {
            button.disabled = true;
          });
          const correct = index === q.answer;
          b.classList.add(correct ? 'answer-correct' : 'answer-wrong');
          if (!correct && choices.children[q.answer]) {
            choices.children[q.answer].classList.add('answer-correct');
          }
          showGameFeedback(correct ? 'correct' : 'wrong');
          notify(correct ? 'ถูกต้องเลย ♡' : 'ยังไม่ใช่นะ 😤');
          if (correct) score++;
          setTimeout(() => {
            at++;
            if (at < questions.length) render();
            else finish();
          }, motionDisabled() ? 250 : 1550);
        });
        choices.append(b);
      });
      wrap.append(p, h, choices);
      host.append(title, wrap);
    };

    openDialog(gameDialog);
    render();
  }

  // Game 2: Memory Match
  function startMatch() {
    const source = memories
      .filter(m => mediaItems(m)[0])
      .sort(() => Math.random() - 0.5)
      .slice(0, 4);
    const cards = [...source, ...source].sort(() => Math.random() - 0.5);
    let open = [];
    let matched = 0;
    let moves = 0;
    let locked = false;

    const wrap = document.createElement('div');
    const status = document.createElement('p');
    status.textContent = `จับคู่แล้ว 0/${source.length} คู่ · เปิดการ์ดไป 0 ครั้ง`;

    const board = document.createElement('div');
    board.className = 'match-board';

    cards.forEach(memory => {
      const b = document.createElement('button');
      b.className = 'match-card';
      b.type = 'button';
      b.dataset.memory = memory.id;
      b.setAttribute('aria-label', 'การ์ดความทรงจำที่ยังคว่ำอยู่');
      b.textContent = '?';

      b.addEventListener('click', () => {
        if (locked || b.classList.contains('matched') || open.includes(b)) return;
        b.textContent = '';
        const picture = document.createElement('img');
        picture.src = img(mediaItems(memory)[0].id);
        picture.alt = memory.title;
        b.append(picture);
        open.push(b);

        if (open.length === 2) {
          locked = true;
          moves++;
          const same = open[0].dataset.memory === open[1].dataset.memory;
          open.forEach(card => card.classList.add(same ? 'match-correct' : 'match-wrong'));
          showGameFeedback(same ? 'correct' : 'wrong');
          notify(same ? `จับคู่สำเร็จ: ${memory.title} ♡` : 'ยังไม่ใช่คู่นี้นะ 😤');

          setTimeout(() => {
            if (same) {
              open.forEach(c => {
                c.classList.remove('match-correct');
                c.classList.add('matched');
              });
              matched++;
              status.textContent = `จับคู่แล้ว ${matched}/${source.length} คู่ · เปิดการ์ดไป ${moves} ครั้ง`;
              if (matched === source.length) {
                notify('จับคู่ครบทุกใบแล้ว เก่งมาก ♡');
                const replay = document.createElement('button');
                replay.type = 'button';
                replay.className = 'primary';
                replay.style.marginTop = '16px';
                replay.textContent = 'สุ่มชุดใหม่เล่นอีกครั้ง ↻';
                replay.addEventListener('click', startMatch);
                wrap.append(replay);
              }
            } else {
              open.forEach(c => {
                c.classList.remove('match-wrong');
                c.textContent = '?';
              });
              status.textContent = `จับคู่แล้ว ${matched}/${source.length} คู่ · เปิดการ์ดไป ${moves} ครั้ง`;
            }
            open = [];
            locked = false;
          }, motionDisabled() ? 250 : 1400);
        }
      });
      board.append(b);
    });

    wrap.append(status, board);
    game('ความทรงจำคู่กัน', wrap);
  }

  // Game 3: Zoom Out (Interactive Multiple-Choice Picture Guess)
  function startZoom() {
    const datedMemories = memories.filter(m => m.title && mediaItems(m)[0]);
    const target = datedMemories[Math.floor(Math.random() * datedMemories.length)];
    const distractors = datedMemories
      .filter(m => m.id !== target.id)
      .sort(() => Math.random() - 0.5)
      .slice(0, 2);
    const options = [target, ...distractors].sort(() => Math.random() - 0.5);

    const wrap = document.createElement('div');
    const hintText = document.createElement('p');
    hintText.textContent = 'ลองทายจากภาพที่ซูมอยู่ หรือกด "ซูมออกอีกนิด" เพื่อดูมุมกว้างขึ้น';

    const box = document.createElement('div');
    box.className = 'zoom-box';
    const picture = document.createElement('img');
    picture.src = img(mediaItems(target)[0].id);
    picture.alt = 'ภาพความทรงจำปริศนา';
    let level = 2.6;
    picture.style.transform = `scale(${level})`;
    box.append(picture);

    const controls = document.createElement('div');
    controls.className = 'dialog-actions';
    const zoomBtn = document.createElement('button');
    zoomBtn.type = 'button';
    zoomBtn.textContent = '🔍 ซูมออกอีกนิด';
    zoomBtn.addEventListener('click', () => {
      level = Math.max(1, Number((level - 0.4).toFixed(1)));
      picture.style.transform = `scale(${level})`;
      if (level <= 1) {
        zoomBtn.disabled = true;
        zoomBtn.textContent = 'เปิดภาพเต็ม 100% แล้ว';
      }
    });
    controls.append(zoomBtn);

    const choicesBox = document.createElement('div');
    choicesBox.className = 'choices';
    options.forEach(opt => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = `${opt.title} (${formatDate(opt.date)})`;
      btn.addEventListener('click', () => {
        choicesBox.querySelectorAll('button').forEach(b => {
          b.disabled = true;
        });
        const isCorrect = opt.id === target.id;
        btn.classList.add(isCorrect ? 'answer-correct' : 'answer-wrong');
        picture.style.transform = 'scale(1)';
        showGameFeedback(isCorrect ? 'correct' : 'wrong');
        notify(isCorrect ? 'ทายภาพได้แม่นมาก ♡' : 'คำตอบจริงคืออีกข้อนะ!');

        const detail = document.createElement('p');
        detail.style.marginTop = '14px';
        detail.textContent = `เฉลย: ${target.title} (${formatDate(target.date)}) — ${
          target.memory || 'ภาพความทรงจำของเรา'
        }`;
        const nextBtn = document.createElement('button');
        nextBtn.type = 'button';
        nextBtn.className = 'primary';
        nextBtn.style.marginTop = '10px';
        nextBtn.textContent = 'ทายภาพต่อไป ↗';
        nextBtn.addEventListener('click', startZoom);
        wrap.append(detail, nextBtn);
      });
      choicesBox.append(btn);
    });

    wrap.append(hintText, box, controls, choicesBox);
    game('ภาพนี้ วันไหนกันนะ?', wrap);
  }

  // Game 4: Timeline Sort (Arrange 4 real dated events chronologically)
  function startTimelineGame() {
    const datedPool = memories.filter(m => m.date && m.date.length === 10 && mediaItems(m)[0]);
    // Pick 4 events with distinct dates
    const uniqueDates = [];
    const seenDates = new Set();
    for (const m of [...datedPool].sort(() => Math.random() - 0.5)) {
      if (!seenDates.has(m.date)) {
        seenDates.add(m.date);
        uniqueDates.push(m);
      }
      if (uniqueDates.length === 4) break;
    }

    const correctOrder = [...uniqueDates].sort((a, b) => a.date.localeCompare(b.date));
    let currentOrder = [...uniqueDates].sort(() => Math.random() - 0.5);
    // Ensure not already sorted
    if (currentOrder.every((m, i) => m.id === correctOrder[i].id) && currentOrder.length > 1) {
      currentOrder.reverse();
    }

    const wrap = document.createElement('div');
    const desc = document.createElement('p');
    desc.textContent =
      'เรียงลำดับเหตุการณ์ทั้ง 4 นี้ จาก "เกิดขึ้นก่อน (บนสุด)" ไปหา "เกิดขึ้นทีหลัง (ล่างสุด)"';

    const listEl = document.createElement('div');
    listEl.className = 'timeline-game-list';

    let revealed = false;

    const renderSlots = () => {
      listEl.textContent = '';
      currentOrder.forEach((mem, idx) => {
        const slot = document.createElement('div');
        slot.className = 'timeline-slot';
        if (revealed) {
          const isRightPos = mem.id === correctOrder[idx].id;
          slot.classList.add(isRightPos ? 'answer-correct' : 'answer-wrong');
        }

        const thumb = document.createElement('img');
        thumb.src = img(mediaItems(mem)[0].id);
        thumb.alt = mem.title;

        const info = document.createElement('div');
        info.className = 'timeline-slot-info';
        const b = document.createElement('b');
        b.textContent = `${idx + 1}. ${mem.title}`;
        const small = document.createElement('small');
        small.textContent = revealed
          ? `วันที่จริง: ${formatDate(mem.date)}`
          : 'เกิดขึ้นเมื่อไหร่กันนะ?';
        info.append(b, small);

        const ctrls = document.createElement('div');
        ctrls.className = 'timeline-slot-controls';

        const upBtn = document.createElement('button');
        upBtn.type = 'button';
        upBtn.textContent = '↑ เลื่อนขึ้น';
        upBtn.disabled = revealed || idx === 0;
        upBtn.addEventListener('click', () => {
          [currentOrder[idx - 1], currentOrder[idx]] = [currentOrder[idx], currentOrder[idx - 1]];
          renderSlots();
        });

        const downBtn = document.createElement('button');
        downBtn.type = 'button';
        downBtn.textContent = '↓ เลื่อนลง';
        downBtn.disabled = revealed || idx === currentOrder.length - 1;
        downBtn.addEventListener('click', () => {
          [currentOrder[idx + 1], currentOrder[idx]] = [currentOrder[idx], currentOrder[idx + 1]];
          renderSlots();
        });

        ctrls.append(upBtn, downBtn);
        slot.append(thumb, info, ctrls);
        listEl.append(slot);
      });
    };

    const actions = document.createElement('div');
    actions.className = 'dialog-actions';

    const checkBtn = document.createElement('button');
    checkBtn.type = 'button';
    checkBtn.className = 'primary';
    checkBtn.textContent = 'ตรวจคำตอบ ✓';

    const replayBtn = document.createElement('button');
    replayBtn.type = 'button';
    replayBtn.textContent = 'สุ่มโจทย์ชุดใหม่ ↻';
    replayBtn.addEventListener('click', startTimelineGame);

    checkBtn.addEventListener('click', () => {
      if (revealed) return;
      revealed = true;
      const allCorrect = currentOrder.every((m, i) => m.id === correctOrder[i].id);
      renderSlots();
      showGameFeedback(allCorrect ? 'correct' : 'wrong');
      notify(
        allCorrect
          ? 'เรียงไทม์ไลน์ถูกต้องครบทุกเหตุการณ์เลย! ♡'
          : 'มีบางเหตุการณ์สลับลำดับกันอยู่ ดูเฉลยวันที่ได้เลย!'
      );
      checkBtn.disabled = true;
    });

    actions.append(checkBtn, replayBtn);
    renderSlots();
    wrap.append(desc, listEl, actions);
    game('เรียงเส้นทางรักของเรา', wrap);
  }

  $$('.games > button').forEach(b =>
    b.addEventListener('click', () => {
      const map = {
        quiz: startQuiz,
        match: startMatch,
        zoom: startZoom,
        timeline: startTimelineGame
      };
      map[b.dataset.game]?.();
    })
  );

  // --- Couple's Wish Jar & Memory Notes ---
  const DEFAULT_WISHES = [
    {
      id: 'w-init-1',
      author: 'ทัก',
      tag: 'ความในใจ',
      text: 'ขอบคุณเบบี้ที่อยู่ด้วยกันมา 2 ปีแล้ว อยู่เป็นความสบายใจและไปเที่ยวหาของอร่อยด้วยกันไปอีกหลาย ๆ ปีเลยนะ ♡',
      date: '06/09/2026'
    },
    {
      id: 'w-init-2',
      author: 'เราสองคน',
      tag: 'ทริปที่อยากไป',
      text: 'ปีที่ 3 ไปเก็บที่เที่ยวใหม่ ๆ ถ่ายรูปคู่สวย ๆ และกินก๋วยเตี๋ยวเส้นหมี่ร้านอร่อยด้วยกันอีกเยอะ ๆ เลย 🌻',
      date: '06/09/2026'
    }
  ];

  let wishes = storage.get('love-wishes-v1', DEFAULT_WISHES);

  function renderWishes() {
    const listEl = $('#wishList');
    if (!listEl) return;
    listEl.textContent = '';

    if (!wishes.length) {
      listEl.innerHTML = '<p class="empty">ยังไม่มีโน้ตในสมุด ลองเขียนใบแรกแปะไว้ดูนะ ♡</p>';
      return;
    }

    wishes.forEach(item => {
      const card = document.createElement('article');
      card.className = 'wish-note';

      const head = document.createElement('div');
      head.className = 'wish-note-head';
      const tag = document.createElement('span');
      tag.className = 'wish-tag';
      tag.textContent = item.tag || 'ความในใจ';

      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'wish-delete';
      delBtn.setAttribute('aria-label', 'ลบโน้ตใบนี้');
      delBtn.textContent = '×';
      delBtn.addEventListener('click', () => {
        wishes = wishes.filter(w => w.id !== item.id);
        storage.set('love-wishes-v1', wishes);
        renderWishes();
        notify('นำโน้ตออกจากสมุดแล้ว');
      });

      head.append(tag, delBtn);

      const body = document.createElement('p');
      body.textContent = item.text;

      const foot = document.createElement('div');
      foot.className = 'wish-note-foot';
      const author = document.createElement('strong');
      author.textContent = `จาก: ${item.author}`;
      const date = document.createElement('span');
      date.textContent = item.date;
      foot.append(author, date);

      card.append(head, body, foot);
      listEl.append(card);
    });
  }

  $('#wishForm')?.addEventListener('submit', e => {
    e.preventDefault();
    const input = $('#wishInput');
    const authorSel = $('#wishAuthor');
    const tagSel = $('#wishTag');
    const text = (input?.value || '').trim();
    if (!text) return;

    const now = new Date();
    const dStr = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(
      2,
      '0'
    )}/${now.getFullYear()}`;

    const newWish = {
      id: `w-${Date.now()}`,
      author: authorSel?.value || 'เราสองคน',
      tag: tagSel?.value || 'ความในใจ',
      text,
      date: dStr
    };

    wishes.unshift(newWish);
    storage.set('love-wishes-v1', wishes);
    if (input) input.value = '';
    renderWishes();
    notify('แปะโน้ตลงสมุดคู่เราเรียบร้อยแล้ว ♡');
  });

  $('#exportWishes')?.addEventListener('click', () => {
    if (!wishes.length) {
      notify('ยังไม่มีโน้ตสำหรับดาวน์โหลด');
      return;
    }
    const lines = [
      '=========================================',
      '   สมุดโน้ตความในใจ & คำอธิษฐาน — อัยย์ & ทัก',
      '   Our Little Universe (06.09.2024 — 06.09.2026)',
      '=========================================',
      ''
    ];
    wishes.forEach((w, i) => {
      lines.push(`${i + 1}. [${w.tag}] จาก ${w.author} (${w.date})`);
      lines.push(`   "${w.text}"`);
      lines.push('');
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'our-little-universe-notes.txt';
    document.body.append(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    notify('ดาวน์โหลดไฟล์สมุดโน้ตเรียบร้อยแล้ว ♡');
  });

  // --- Secret Love Letter at Bottom ---
  function setupLoveLetter() {
    const footer = $('footer');
    if (!footer || $('#letterTrigger')) return;
    const trigger = document.createElement('button');
    trigger.id = 'letterTrigger';
    trigger.className = 'letter-trigger';
    trigger.type = 'button';
    trigger.hidden = true;
    trigger.innerHTML =
      '<span aria-hidden="true">✉</span><b>มีจดหมายถึงเบบี้</b><small>เลื่อนมาถึงข้างล่างสุดแล้ว เปิดอ่านได้เลย</small>';

    const openLetter = () => {
      const paper = document.createElement('article');
      paper.className = 'love-letter';
      const mark = document.createElement('span');
      mark.className = 'letter-mark';
      mark.textContent = '♡ 02';
      const heading = document.createElement('h3');
      heading.textContent = 'ถึงเบบี้';
      const message = document.createElement('p');
      message.textContent =
        'ขอบคุณเบบี้ที่อยู่ด้วยกันมา 2 ปีแล้ว บางครั้งเราอาจทะเลาะกันบ่อย แต่เชื่อไหม เค้ายังรักเบบี้เหมือนเดิม และรักขึ้นไปเรื่อย ๆ เลย อดใจที่จะรอปีต่อไปไม่ไหวแล้ววว';
      paper.append(mark, heading, message);
      game('จดหมายจากทัก', paper);
    };
    trigger.addEventListener('click', openLetter);
    footer.parentNode.insertBefore(trigger, footer);

    const revealAtBottom = () => {
      const distance = document.documentElement.scrollHeight - (window.scrollY + window.innerHeight);
      if (distance <= 24) {
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

  // --- Mascot & Upgraded Black Cat Room ---
  let hearts = Math.min(5, Math.max(0, Number(storage.get('love-hearts', 0)) || 0));
  let catAffection = Math.max(0, Number(storage.get('love-cat-affection', 0)) || 0);
  let catAccessory = storage.get('love-cat-accessory', 'none');

  const ACCESSORY_ICONS = {
    none: '',
    sunflower: '🌻',
    crown: '👑',
    ribbon: '🎀',
    star: '🌟'
  };

  const renderMascotAccessory = () => {
    const svgGroup = $('#catAccessorySvg');
    if (!svgGroup) return;
    svgGroup.textContent = '';
    const icon = ACCESSORY_ICONS[catAccessory];
    if (!icon) return;
    const txt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    txt.setAttribute('x', '95');
    txt.setAttribute('y', '36');
    txt.setAttribute('text-anchor', 'middle');
    txt.setAttribute('font-size', '28');
    txt.textContent = icon;
    svgGroup.append(txt);
  };
  renderMascotAccessory();

  const heartsLabel = $('#hearts');
  const updateHearts = () => {
    if (heartsLabel) heartsLabel.textContent = `♡ ${hearts} / 5`;
    storage.set('love-hearts', hearts);
  };

  const cat = $('#cat');
  const pupils = $('#pupils');
  const bubble = $('#bubble');
  let petTimer;
  let bubbleTimer;

  const spawnCatHearts = () => {
    if (!cat) return;
    const rect = cat.getBoundingClientRect();
    const heartsToShow = [
      { dx: -25, dy: -4, size: 28, delay: 0 },
      { dx: 8, dy: -10, size: 36, delay: 90 },
      { dx: 42, dy: -2, size: 24, delay: 170 }
    ];
    heartsToShow.forEach((item, index) => {
      const heart = document.createElement('span');
      heart.className = `cat-heart cat-heart-${index + 1}`;
      heart.textContent = '♥';
      heart.setAttribute('aria-hidden', 'true');
      heart.style.left = `${rect.left + rect.width / 2 + item.dx}px`;
      heart.style.top = `${rect.top + item.dy}px`;
      heart.style.fontSize = `${item.size}px`;
      heart.style.animationDelay = `${item.delay}ms`;
      heart.style.setProperty('--drift', `${item.dx * 0.7}px`);
      document.body.append(heart);
      setTimeout(() => heart.remove(), 1700);
    });
  };

  const pet = () => {
    if (!cat) return;
    playCatSound('pet');
    cat.classList.remove('pet');
    void cat.offsetWidth;
    cat.classList.add('pet');
    clearTimeout(petTimer);
    petTimer = setTimeout(() => cat.classList.remove('pet'), 850);
    spawnCatHearts();
    if (hearts < 5) hearts++;
    catAffection += 1;
    storage.set('love-cat-affection', catAffection);
    updateHearts();
    clearTimeout(bubbleTimer);
    if (bubble) {
      bubble.textContent = 'งื้อ~ อ้อนแล้วนะ ♡';
      bubbleTimer = setTimeout(() => {
        bubble.textContent =
          hearts >= 5 ? 'เปิดห้องแมวดำได้แล้ว! เหมียว!' : 'เหมียว~ ลูบอีกนิดนะ';
      }, 950);
    }
    if (hearts === 5 && catAffection === 5) notify('เก็บหัวใจครบ 5 ดวงแล้ว เปิดห้องแมวดำได้เลย ♡');
  };

  cat?.addEventListener('click', pet);

  const trackEyes = e => {
    if (!pupils || !cat || document.documentElement.classList.contains('reduced')) return;
    const pt = e.touches && e.touches[0] ? e.touches[0] : e;
    if (typeof pt.clientX !== 'number' || typeof pt.clientY !== 'number') return;
    const rect = cat.getBoundingClientRect();
    const eyeCenterX = rect.left + rect.width * 0.52;
    const eyeCenterY = rect.top + rect.height * 0.45;
    const dx = pt.clientX - eyeCenterX;
    const dy = pt.clientY - eyeCenterY;
    const angle = Math.atan2(dy, dx);
    const dist = Math.min(1, Math.hypot(dx, dy) / 220);
    const moveX = (Math.cos(angle) * 7.5 * dist).toFixed(2);
    const moveY = (Math.sin(angle) * 5.2 * dist).toFixed(2);
    pupils.style.transform = `translate(${moveX}px, ${moveY}px)`;
    pupils.setAttribute('transform', `translate(${moveX} ${moveY})`);
  };
  window.addEventListener('pointermove', trackEyes, { passive: true });
  window.addEventListener('mousemove', trackEyes, { passive: true });
  window.addEventListener('touchmove', trackEyes, { passive: true });

  $('#catRoom')?.addEventListener('click', () => {
    if (hearts < 5) {
      notify(`ลูบหัวแมวที่มุมขวาล่างให้ครบอีก ${5 - hearts} ดวงก่อนนะ`);
      return;
    }

    const wrap = document.createElement('div');
    wrap.className = 'room';

    const statsBar = document.createElement('div');
    statsBar.className = 'cat-stats-bar';
    const updateStatsText = () => {
      const level = Math.floor(catAffection / 5) + 1;
      statsBar.textContent = `🐾 เลเวลความผูกพัน Lv.${level} (ความรักสะสม ${catAffection} แต้ม)`;
    };
    updateStatsText();

    const stage = document.createElement('div');
    stage.className = 'room-cat-stage';

    const catSprite = document.createElement('div');
    catSprite.className = 'room-cat room-cat-sprite';
    catSprite.setAttribute('role', 'img');
    catSprite.setAttribute('aria-label', 'แมวดำกำลังกระพริบตาและแกว่งหาง');

    const accOverlay = document.createElement('span');
    accOverlay.className = 'room-cat-accessory';
    accOverlay.textContent = ACCESSORY_ICONS[catAccessory] || '';

    stage.append(catSprite, accOverlay);

    const p = document.createElement('p');
    p.textContent = 'ห้องเล็ก ๆ สำหรับพักใจของเรา — เลือกของเล่นหรือแต่งตัวให้น้องแมวได้เลย';

    const response = document.createElement('p');
    response.style.fontWeight = '500';
    response.textContent = 'เหมียว~ วันนี้อยากเล่นอะไรดีนะ?';

    let catMotionTimer;
    const framePosition = frame => `${(frame / 4) * 100}% 50%`;
    const animateCat = sequence => {
      clearInterval(catMotionTimer);
      if (motionDisabled()) return;
      const frames = [...sequence, 0];
      let index = 0;
      const showFrame = () => {
        catSprite.style.backgroundPosition = framePosition(frames[index]);
        index += 1;
        if (index >= frames.length) {
          clearInterval(catMotionTimer);
          catSprite.style.backgroundPosition = framePosition(0);
        }
      };
      showFrame();
      catMotionTimer = setInterval(showFrame, 220);
    };

    const addAffection = pts => {
      catAffection += pts;
      storage.set('love-cat-affection', catAffection);
      updateStatsText();
    };

    const actionRow = document.createElement('div');
    actionRow.className = 'room-actions';

    const feedBtn = document.createElement('button');
    feedBtn.type = 'button';
    feedBtn.textContent = 'ให้ขนมปลา 🍣';
    feedBtn.addEventListener('click', () => {
      playCatSound('treat');
      animateCat([0, 1, 2, 1]);
      addAffection(2);
      response.textContent = 'เหมียว! ขอบคุณสำหรับขนมปลาสุดอร่อยนะ ♡ (+2 ความผูกพัน)';
    });

    const playBtn = document.createElement('button');
    playBtn.type = 'button';
    playBtn.textContent = 'เล่นไหมพรม 🧶';
    playBtn.addEventListener('click', () => {
      playCatSound('play');
      animateCat([0, 3, 4, 3]);
      addAffection(2);
      response.textContent = 'แมวดำกระโดดตะครุบลูกไหมพรมอย่างร่าเริง! (+2 ความผูกพัน)';
    });

    const brushBtn = document.createElement('button');
    brushBtn.type = 'button';
    brushBtn.textContent = 'เกาคางกล่อมนอน 💤';
    brushBtn.addEventListener('click', () => {
      playCatSound('purr');
      animateCat([0, 1, 1, 0]);
      addAffection(3);
      response.textContent = 'ครืดด~ น้องแมวหลับตาพริ้มส่งเสียงเพอร์เบา ๆ อย่างอบอุ่น (+3 ความผูกพัน)';
    });

    actionRow.append(feedBtn, playBtn, brushBtn);

    // Wardrobe Controls
    const wardrobeRow = document.createElement('div');
    wardrobeRow.className = 'room-wardrobe';
    const outfits = [
      { id: 'none', label: 'ไม่ใส่เครื่องประดับ' },
      { id: 'sunflower', label: '🌻 ดอกทานตะวัน' },
      { id: 'ribbon', label: '🎀 โบสีชมพู' },
      { id: 'crown', label: '👑 มงกุฎตัวจิ๋ว' },
      { id: 'star', label: '🌟 ดาวนำโชค' }
    ];

    outfits.forEach(item => {
      const btn = document.createElement('button');
      btn.type = 'button';
      if (catAccessory === item.id) btn.classList.add('active');
      btn.textContent = item.label;
      btn.addEventListener('click', () => {
        catAccessory = item.id;
        storage.set('love-cat-accessory', catAccessory);
        accOverlay.textContent = ACCESSORY_ICONS[catAccessory] || '';
        renderMascotAccessory();
        $$('button', wardrobeRow).forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        response.textContent =
          item.id === 'none'
            ? 'ถอดเครื่องประดับแล้ว โชว์หูแมวดำน่ารักเหมือนเดิม!'
            : `แต่งตัวให้น้องแมวด้วย "${item.label}" น่ารักสุด ๆ ♡`;
      });
      wardrobeRow.append(btn);
    });

    wrap.append(statsBar, stage, p, actionRow, wardrobeRow, response);
    game('ห้องแมวดำของเรา', wrap);
  });

  // --- Footer Secret Heart ---
  $('#heartSecret')?.addEventListener('click', e => {
    e.currentTarget.textContent = '♥';
    spawnHeart(e.clientX, e.clientY);
    notify('เจอหัวใจลับของเราแล้ว ♡ รักเบบี้ที่สุดเลย');
  });

  function spawnHeart(x, y) {
    const heart = document.createElement('span');
    heart.className = 'floating-heart';
    heart.textContent = '♥';
    heart.style.left = `${x || innerWidth / 2}px`;
    heart.style.top = `${y || innerHeight - 50}px`;
    document.body.append(heart);
    setTimeout(() => heart.remove(), motionDisabled() ? 0 : 1400);
  }

  // --- Initial Render ---
  updateHearts();
  renderTimeline();
  renderHighlight();
  renderGallery();
  renderWishes();
  setupLoveLetter();
})();
