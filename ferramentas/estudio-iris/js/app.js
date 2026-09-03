(function () {
  "use strict";

  const CAMERA_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7l1.5-3h5L16 7"/><circle cx="12" cy="13.5" r="3.2"/></svg>';
  const HEART_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20s-7-4.35-9.5-8.8C1 8 2.3 4.7 5.4 4.1c1.9-.4 3.8.5 4.9 2.1C11.4 4.6 13.3 3.7 15.2 4.1c3.1.6 4.4 3.9 2.9 7.1C15.6 15.65 12 20 12 20z"/></svg>';
  const HEART_ICON_FILLED = '<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20s-7-4.35-9.5-8.8C1 8 2.3 4.7 5.4 4.1c1.9-.4 3.8.5 4.9 2.1C11.4 4.6 13.3 3.7 15.2 4.1c3.1.6 4.4 3.9 2.9 7.1C15.6 15.65 12 20 12 20z"/></svg>';

  const PHOTOS = [
    { id: "p1", tone: "ph-1", category: "casamento", title: "Cerimônia ao pôr do sol", shape: "wide", caption: "Casamento de Marina & Diego — luz natural, fim de tarde." },
    { id: "p2", tone: "ph-2", category: "ensaio", title: "Ensaio gestante", shape: "tall", caption: "Ensaio gestante em estúdio, luz suave." },
    { id: "p3", tone: "ph-3", category: "corporativo", title: "Retrato executivo", shape: "", caption: "Retrato corporativo para equipe comercial." },
    { id: "p4", tone: "ph-4", category: "evento", title: "Formatura de turma", shape: "", caption: "Cobertura de formatura — turno da noite." },
    { id: "p5", tone: "ph-5", category: "casamento", title: "Making of da noiva", shape: "", caption: "Preparação da noiva, detalhes do vestido." },
    { id: "p6", tone: "ph-6", category: "ensaio", title: "Ensaio de família", shape: "wide", caption: "Ensaio externo em família, luz da manhã." },
    { id: "p7", tone: "ph-7", category: "corporativo", title: "Evento de lançamento", shape: "", caption: "Cobertura do lançamento de produto." },
    { id: "p8", tone: "ph-8", category: "evento", title: "Aniversário de 15 anos", shape: "tall", caption: "Festa de debutante, salão de festas." },
    { id: "p9", tone: "ph-1", category: "casamento", title: "Primeira dança", shape: "", caption: "Primeira dança dos noivos, festa." },
    { id: "p10", tone: "ph-3", category: "ensaio", title: "Retrato individual", shape: "", caption: "Ensaio de retrato individual, luz de janela." },
    { id: "p11", tone: "ph-5", category: "corporativo", title: "Reunião de equipe", shape: "", caption: "Registro de dia a dia da empresa." },
    { id: "p12", tone: "ph-6", category: "evento", title: "Confraternização", shape: "", caption: "Confraternização de fim de ano da equipe." },
  ];

  const TESTIMONIALS = [
    { quote: "As fotos do nosso casamento contam a história do dia inteiro, não só os posados. Choramos vendo a galeria.", author: "Marina & Diego", role: "Casamento, 2025" },
    { quote: "Fiz o ensaio gestante em um dia corrido e mesmo assim o resultado ficou natural, sem nenhuma pose forçada.", author: "Camila Souza", role: "Ensaio gestante, 2024" },
    { quote: "Contratamos para os retratos da equipe toda e a entrega foi rápida, com um padrão visual muito consistente.", author: "Rafael Nogueira", role: "Retratos corporativos, 2025" },
    { quote: "Indiquei o Studio Íris pra três amigas depois da minha formatura. Atendimento atencioso do início ao fim.", author: "Beatriz Lima", role: "Evento de formatura, 2024" },
  ];

  const FAV_KEY = "studio-iris-favoritos";

  function getFavorites() {
    try {
      return JSON.parse(localStorage.getItem(FAV_KEY)) || [];
    } catch (e) {
      return [];
    }
  }

  function setFavorites(list) {
    localStorage.setItem(FAV_KEY, JSON.stringify(list));
  }

  function toggleFavorite(id) {
    const favs = getFavorites();
    const idx = favs.indexOf(id);
    if (idx >= 0) {
      favs.splice(idx, 1);
    } else {
      favs.push(id);
    }
    setFavorites(favs);
    renderFavCount();
    return favs.includes(id);
  }

  function renderFavCount() {
    const el = document.getElementById("favCount");
    if (el) el.textContent = String(getFavorites().length);
  }

  function photoNode(photo) {
    const favs = getFavorites();
    const isFav = favs.includes(photo.id);
    const el = document.createElement("div");
    el.className = "gallery-item" + (photo.shape ? " " + photo.shape : "");
    el.dataset.category = photo.category;
    el.dataset.id = photo.id;
    el.innerHTML =
      '<button class="fav-btn' + (isFav ? " is-active" : "") + '" data-fav="' + photo.id + '" title="Favoritar" type="button">' +
        (isFav ? HEART_ICON_FILLED : HEART_ICON) +
      '</button>' +
      '<div class="ph ' + photo.tone + '">' + CAMERA_ICON + '<span>' + photo.title + '</span></div>';
    return el;
  }

  let currentFilter = "todos";
  let showOnlyFavorites = false;

  function renderGallery() {
    const grid = document.getElementById("galleryGrid");
    const empty = document.getElementById("galleryEmpty");
    grid.innerHTML = "";

    const favs = getFavorites();
    let list = PHOTOS.filter(function (p) {
      const matchesFilter = currentFilter === "todos" || p.category === currentFilter;
      const matchesFav = !showOnlyFavorites || favs.includes(p.id);
      return matchesFilter && matchesFav;
    });

    list.forEach(function (photo) {
      grid.appendChild(photoNode(photo));
    });

    empty.classList.toggle("is-visible", showOnlyFavorites && list.length === 0);
  }

  function setActiveFilterButton(filter) {
    document.querySelectorAll(".filter-btn").forEach(function (btn) {
      btn.classList.toggle("is-active", btn.dataset.filter === filter);
    });
  }

  function initFilters() {
    document.getElementById("filters").addEventListener("click", function (e) {
      const btn = e.target.closest(".filter-btn");
      if (!btn) return;
      currentFilter = btn.dataset.filter;
      showOnlyFavorites = false;
      setActiveFilterButton(currentFilter);
      renderGallery();
    });
  }

  function initFavToggleNav() {
    document.getElementById("favToggle").addEventListener("click", function () {
      showOnlyFavorites = !showOnlyFavorites;
      if (showOnlyFavorites) {
        currentFilter = "todos";
        setActiveFilterButton("");
      }
      document.getElementById("portfolio").scrollIntoView({ behavior: "smooth" });
      renderGallery();
    });
  }

  function initGalleryClicks() {
    document.getElementById("galleryGrid").addEventListener("click", function (e) {
      const favBtn = e.target.closest(".fav-btn");
      if (favBtn) {
        const isNowFav = toggleFavorite(favBtn.dataset.fav);
        favBtn.classList.toggle("is-active", isNowFav);
        favBtn.innerHTML = isNowFav ? HEART_ICON_FILLED : HEART_ICON;
        if (showOnlyFavorites) renderGallery();
        return;
      }
      const item = e.target.closest(".gallery-item");
      if (item) openLightbox(item.dataset.id);
    });
  }

  let lightboxList = [];
  let lightboxIndex = 0;

  function currentVisiblePhotos() {
    const favs = getFavorites();
    return PHOTOS.filter(function (p) {
      const matchesFilter = currentFilter === "todos" || p.category === currentFilter;
      const matchesFav = !showOnlyFavorites || favs.includes(p.id);
      return matchesFilter && matchesFav;
    });
  }

  function openLightbox(id) {
    lightboxList = currentVisiblePhotos();
    lightboxIndex = lightboxList.findIndex(function (p) { return p.id === id; });
    if (lightboxIndex < 0) lightboxIndex = 0;
    renderLightbox();
    document.getElementById("lightbox").classList.add("is-open");
  }

  function renderLightbox() {
    const photo = lightboxList[lightboxIndex];
    if (!photo) return;
    const frame = document.getElementById("lightboxFrame");
    frame.innerHTML = '<div class="ph ' + photo.tone + '" style="height:100%"></div>' +
      '<div class="lightbox-caption">' + photo.caption + '</div>';
  }

  function closeLightbox() {
    document.getElementById("lightbox").classList.remove("is-open");
  }

  function stepLightbox(dir) {
    if (!lightboxList.length) return;
    lightboxIndex = (lightboxIndex + dir + lightboxList.length) % lightboxList.length;
    renderLightbox();
  }

  function initLightbox() {
    document.getElementById("lightboxClose").addEventListener("click", closeLightbox);
    document.getElementById("lightboxPrev").addEventListener("click", function () { stepLightbox(-1); });
    document.getElementById("lightboxNext").addEventListener("click", function () { stepLightbox(1); });
    document.getElementById("lightbox").addEventListener("click", function (e) {
      if (e.target.id === "lightbox") closeLightbox();
    });
    document.addEventListener("keydown", function (e) {
      if (!document.getElementById("lightbox").classList.contains("is-open")) return;
      if (e.key === "Escape") closeLightbox();
      if (e.key === "ArrowLeft") stepLightbox(-1);
      if (e.key === "ArrowRight") stepLightbox(1);
    });
  }

  let testiIndex = 0;
  let testiTimer = null;

  function renderTestimonials() {
    const track = document.getElementById("testiTrack");
    track.innerHTML = TESTIMONIALS.map(function (t, i) {
      return '<div class="testi-card' + (i === testiIndex ? " is-active" : "") + '">' +
        '<p class="testi-quote">“' + t.quote + '”</p>' +
        '<p class="testi-author">' + t.author + '</p>' +
        '<p class="testi-role">' + t.role + '</p>' +
        '</div>';
    }).join("") +
      '<div class="testi-dots">' + TESTIMONIALS.map(function (_, i) {
        return '<button data-dot="' + i + '" class="' + (i === testiIndex ? "is-active" : "") + '"></button>';
      }).join("") + '</div>';
  }

  function goToTestimonial(i) {
    testiIndex = (i + TESTIMONIALS.length) % TESTIMONIALS.length;
    renderTestimonials();
  }

  function initTestimonials() {
    renderTestimonials();
    document.getElementById("testiTrack").addEventListener("click", function (e) {
      const dot = e.target.closest("[data-dot]");
      if (!dot) return;
      goToTestimonial(Number(dot.dataset.dot));
      resetTestiTimer();
    });
    resetTestiTimer();
  }

  function resetTestiTimer() {
    clearInterval(testiTimer);
    testiTimer = setInterval(function () { goToTestimonial(testiIndex + 1); }, 6000);
  }

  function initHeaderScroll() {
    const header = document.getElementById("siteHeader");
    function update() {
      header.classList.toggle("is-scrolled", window.scrollY > 40);
    }
    document.addEventListener("scroll", update, { passive: true });
    update();
  }

  function initMobileNav() {
    const toggle = document.getElementById("navToggle");
    const links = document.getElementById("navLinks");
    toggle.addEventListener("click", function () {
      links.classList.toggle("is-open");
    });
    links.addEventListener("click", function (e) {
      if (e.target.tagName === "A") links.classList.remove("is-open");
    });
  }

  function initContactForm() {
    const form = document.getElementById("contatoForm");
    const note = document.getElementById("formNote");
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      const nome = document.getElementById("nome").value.trim();
      const telefone = document.getElementById("telefone").value.trim();
      const tipo = document.getElementById("tipo").value;
      const mensagem = document.getElementById("mensagem").value.trim();

      const texto =
        "Olá! Meu nome é " + nome + ".\n" +
        "Tenho interesse em: " + tipo + ".\n" +
        "Telefone para contato: " + telefone + ".\n" +
        "Detalhes: " + mensagem;

      const url = "https://wa.me/5511999998888?text=" + encodeURIComponent(texto);

      note.classList.add("is-visible");
      window.open(url, "_blank", "noopener");
      form.reset();
      setTimeout(function () { note.classList.remove("is-visible"); }, 5000);
    });
  }

  document.getElementById("anoAtual").textContent = new Date().getFullYear();

  renderFavCount();
  renderGallery();
  initFilters();
  initFavToggleNav();
  initGalleryClicks();
  initLightbox();
  initTestimonials();
  initHeaderScroll();
  initMobileNav();
  initContactForm();
})();
