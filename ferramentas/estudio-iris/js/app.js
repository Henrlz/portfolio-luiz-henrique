(function () {
  "use strict";

  const HEART_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20s-7-4.35-9.5-8.8C1 8 2.3 4.7 5.4 4.1c1.9-.4 3.8.5 4.9 2.1C11.4 4.6 13.3 3.7 15.2 4.1c3.1.6 4.4 3.9 2.9 7.1C15.6 15.65 12 20 12 20z"/></svg>';
  const HEART_ICON_FILLED = '<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20s-7-4.35-9.5-8.8C1 8 2.3 4.7 5.4 4.1c1.9-.4 3.8.5 4.9 2.1C11.4 4.6 13.3 3.7 15.2 4.1c3.1.6 4.4 3.9 2.9 7.1C15.6 15.65 12 20 12 20z"/></svg>';
  const STAR_ICON = '<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M12 2l2.9 6.6 7.1.7-5.4 4.8 1.6 7-6.2-3.7L6 21.1l1.6-7L2.2 9.3l7.1-.7z"/></svg>';

  const PHOTOS = [
    { id: "p1", tone: "ph-1", category: "casamento", title: "Cerimônia ao pôr do sol", shape: "wide", caption: "Casamento de Marina & Diego — luz natural, fim de tarde." },
    { id: "p2", tone: "ph-2", category: "casal", title: "Ensaio de casal", shape: "tall", caption: "Ensaio de casal ao ar livre, luz da tarde." },
    { id: "p3", tone: "ph-5", category: "corporativo", title: "Retrato executivo", shape: "", caption: "Retrato corporativo para equipe comercial." },
    { id: "p4", tone: "ph-4", category: "15anos", title: "Festa de debutante", shape: "", caption: "Aniversário de 15 anos, salão de festas." },
    { id: "p5", tone: "ph-1", category: "casamento", title: "Making of da noiva", shape: "", caption: "Preparação da noiva, detalhes do vestido." },
    { id: "p6", tone: "ph-3", category: "infantil", title: "Festa infantil", shape: "wide", caption: "Aniversário infantil, tema safári." },
    { id: "p7", tone: "ph-6", category: "corporativo", title: "Evento de lançamento", shape: "", caption: "Cobertura do lançamento de produto." },
    { id: "p8", tone: "ph-6", category: "gestante", title: "Ensaio gestante", shape: "tall", caption: "Ensaio gestante em estúdio, luz suave." },
    { id: "p9", tone: "ph-1", category: "casamento", title: "Primeira dança", shape: "", caption: "Primeira dança dos noivos, festa." },
    { id: "p10", tone: "ph-2", category: "casal", title: "Pôr do sol a dois", shape: "", caption: "Ensaio pré-wedding ao entardecer." },
    { id: "p11", tone: "ph-3", category: "infantil", title: "Bolo e balões", shape: "", caption: "Detalhes de decoração da festa infantil." },
    { id: "p12", tone: "ph-4", category: "15anos", title: "Valsa dos 15 anos", shape: "", caption: "Valsa de abertura da festa de debutante." },
  ];

  const TESTIMONIALS = [
    { quote: "As fotos do nosso casamento contam a história do dia inteiro, não só os posados. Choramos vendo a galeria.", author: "Marina & Diego", role: "Casamento" },
    { quote: "Fiz o ensaio gestante em um dia corrido e mesmo assim o resultado ficou natural, sem nenhuma pose forçada.", author: "Camila Souza", role: "Gestante" },
    { quote: "Contratamos para os retratos da equipe toda e a entrega foi rápida, com um padrão visual muito consistente.", author: "Rafael Nogueira", role: "Corporativo" },
    { quote: "A festa de 15 anos da minha filha ficou eternizada com um cuidado que a gente não esperava. Recomendo de olhos fechados.", author: "Andrea Nunes", role: "Aniversário de 15 Anos" },
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
    return favs.includes(id);
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
      '<div class="ph ' + photo.tone + '"></div>';
    return el;
  }

  let currentFilter = "todos";
  let showOnlyFavorites = false;

  function visiblePhotos() {
    const favs = getFavorites();
    return PHOTOS.filter(function (p) {
      const matchesFilter = currentFilter === "todos" || p.category === currentFilter;
      const matchesFav = !showOnlyFavorites || favs.includes(p.id);
      return matchesFilter && matchesFav;
    });
  }

  function renderGallery() {
    const grid = document.getElementById("galleryGrid");
    const empty = document.getElementById("galleryEmpty");
    grid.innerHTML = "";
    const list = visiblePhotos();
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

  function applyFilter(filter) {
    currentFilter = filter;
    showOnlyFavorites = false;
    setActiveFilterButton(filter);
    renderGallery();
  }

  function initFilters() {
    document.getElementById("filters").addEventListener("click", function (e) {
      const btn = e.target.closest(".filter-btn");
      if (!btn) return;
      applyFilter(btn.dataset.filter);
    });
  }

  function initCategoryLinks() {
    document.querySelectorAll("[data-filter-link]").forEach(function (el) {
      el.addEventListener("click", function (e) {
        e.preventDefault();
        applyFilter(el.dataset.filterLink);
        document.getElementById("portfolio").scrollIntoView({ behavior: "smooth" });
        document.getElementById("navLinks").classList.remove("is-open");
      });
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

  function openLightbox(id) {
    lightboxList = visiblePhotos();
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

  function renderTestimonials() {
    const grid = document.getElementById("testiGrid");
    grid.innerHTML = TESTIMONIALS.map(function (t) {
      return '<div class="testi-card">' +
        '<div class="testi-stars">' + STAR_ICON.repeat(5) + '</div>' +
        '<p class="testi-quote">“' + t.quote + '”</p>' +
        '<div class="testi-foot">' +
          '<span class="testi-author">' + t.author + '</span>' +
          '<span class="testi-role">' + t.role + '</span>' +
        '</div>' +
      '</div>';
    }).join("");
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
    const dropdownItem = document.getElementById("dropdownItem");
    const dropdownTrigger = document.getElementById("dropdownTrigger");

    toggle.addEventListener("click", function () {
      links.classList.toggle("is-open");
    });

    dropdownTrigger.addEventListener("click", function (e) {
      if (window.innerWidth > 720) return;
      e.preventDefault();
      dropdownItem.classList.toggle("is-open");
    });

    links.addEventListener("click", function (e) {
      const link = e.target.closest("a");
      if (!link) return;
      if (link === dropdownTrigger || link.closest(".dropdown")) return;
      links.classList.remove("is-open");
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

  renderGallery();
  renderTestimonials();
  initFilters();
  initCategoryLinks();
  initGalleryClicks();
  initLightbox();
  initHeaderScroll();
  initMobileNav();
  initContactForm();
})();
