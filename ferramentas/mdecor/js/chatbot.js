// Chatbot de atendimento e agendamento de visitas — regras simples (sem IA externa),
// mas fácil de trocar por uma API de IA depois (ver README.md).

const STORE_HOURS = {
  1: { open: '09:00', slots: ['09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00', '17:00'] }, // seg
  2: { open: '09:00', slots: ['09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00', '17:00'] }, // ter
  3: { open: '09:00', slots: ['09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00', '17:00'] }, // qua
  4: { open: '09:00', slots: ['09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00', '17:00'] }, // qui
  5: { open: '09:00', slots: ['09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00', '17:00'] }, // sex
  6: { open: '09:00', slots: ['09:00', '10:00', '11:00', '12:00'] }, // sáb
  0: null, // domingo fechado
};
const WHATSAPP_NUMBER = '5511999999999'; // troque pelo número real da loja

const MdecorChat = (() => {
  let booking = {};
  let launcherHasPing = true;

  function el(html) {
    const t = document.createElement('template');
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  }

  function scrollToBottom() {
    const body = document.getElementById('chat-body');
    body.scrollTop = body.scrollHeight;
  }

  function addBotMessage(html) {
    const body = document.getElementById('chat-body');
    body.appendChild(el(`
      <div class="msg msg-bot">
        <div class="msg-avatar"><svg viewBox="0 0 48 48" width="13" height="13" fill="currentColor" aria-hidden="true"><rect x="9" y="9" width="30" height="13" rx="6"/><rect x="9" y="23" width="30" height="11" rx="4"/><rect x="4" y="15" width="7" height="19" rx="3.5"/><rect x="37" y="15" width="7" height="19" rx="3.5"/></svg></div>
        <div class="msg-bubble">${html}</div>
      </div>
    `));
    scrollToBottom();
  }

  function addUserMessage(text) {
    const body = document.getElementById('chat-body');
    body.appendChild(el(`
      <div class="msg msg-user">
        <div class="msg-bubble">${text}</div>
      </div>
    `));
    scrollToBottom();
  }

  function withTyping(cb, delay = 550) {
    const body = document.getElementById('chat-body');
    const typing = el(`<div class="chat-typing" id="typing-indicator"><span></span><span></span><span></span></div>`);
    body.appendChild(typing);
    scrollToBottom();
    setTimeout(() => {
      typing.remove();
      cb();
    }, delay);
  }

  function clearInteractive() {
    document.querySelectorAll('.chat-quick-replies, .chat-form-card').forEach((n) => n.remove());
  }

  function addQuickReplies(options, onPick) {
    clearInteractive();
    const body = document.getElementById('chat-body');
    const wrap = el(`<div class="chat-quick-replies"></div>`);
    options.forEach((opt) => {
      const chip = el(`<button type="button" class="chip">${opt.label}</button>`);
      chip.addEventListener('click', () => {
        addUserMessage(opt.label);
        clearInteractive();
        onPick(opt.value);
      });
      wrap.appendChild(chip);
    });
    body.appendChild(wrap);
    scrollToBottom();
  }

  function addFormCard(innerHtml, onMount) {
    clearInteractive();
    const body = document.getElementById('chat-body');
    const card = el(`<div class="chat-form-card">${innerHtml}</div>`);
    body.appendChild(card);
    scrollToBottom();
    onMount(card);
  }

  function todayISO() {
    const d = new Date();
    return d.toISOString().slice(0, 10);
  }

  function formatDateBR(iso) {
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  }

  // ---------- Fluxo principal ----------

  function start() {
    booking = {};
    document.getElementById('chat-body').innerHTML = '';
    withTyping(() => {
      addBotMessage('Olá! Eu sou a assistente virtual da <strong>Mdecor</strong>. Posso te ajudar a agendar uma visita à loja, mostrar informações sobre os produtos ou o horário de funcionamento.');
      askMainMenu();
    }, 400);
  }

  function askMainMenu() {
    addQuickReplies([
      { label: 'Agendar visita', value: 'agendar' },
      { label: 'Ver produtos', value: 'produtos' },
      { label: 'Dúvidas sobre produtos', value: 'duvidas' },
      { label: 'Horário de funcionamento', value: 'horario' },
      { label: 'Falar no WhatsApp', value: 'whatsapp' },
    ], handleMainMenu);
  }

  function handleMainMenu(choice) {
    if (choice === 'agendar') {
      withTyping(() => startBookingFlow());
      return;
    }
    if (choice === 'produtos') {
      withTyping(() => {
        const cats = Object.entries(CATEGORY_LABELS).filter(([k]) => k !== 'todos');
        addBotMessage(`Temos estas categorias: ${cats.map(([, v]) => v).join(', ')}. Vou te levar até a vitrine.`);
        document.getElementById('produtos').scrollIntoView({ behavior: 'smooth' });
        setTimeout(askMainMenu, 300);
      });
      return;
    }
    if (choice === 'duvidas') {
      withTyping(startProductQA);
      return;
    }
    if (choice === 'horario') {
      withTyping(() => {
        addBotMessage(`
          <strong>Horário de funcionamento:</strong><br>
          Segunda a sexta: 09h às 18h<br>
          Sábado: 09h às 13h<br>
          Domingo: fechado
        `);
        setTimeout(askMainMenu, 300);
      });
      return;
    }
    if (choice === 'whatsapp') {
      withTyping(() => {
        addBotMessage('Você pode falar direto com a nossa equipe pelo WhatsApp, vou abrir uma conversa pra você.');
        window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent('Olá! Vim pelo site da Mdecor e gostaria de mais informações.')}`, '_blank');
        setTimeout(askMainMenu, 300);
      });
    }
  }

  // ---------- Dúvidas sobre produtos (busca no catálogo) ----------

  const CATEGORY_KEYWORDS = {
    sofas: ['sofa', 'sofá', 'sofas', 'sofás', 'chaise'],
    mesas: ['mesa', 'mesas', 'jantar'],
    camas: ['cama', 'camas', 'box'],
    estantes: ['estante', 'estantes', 'livro', 'prateleira'],
    racks: ['rack', 'racks', 'painel', 'tv'],
    poltronas: ['poltrona', 'poltronas'],
  };

  function stripAccents(str) {
    return str.normalize('NFD').replace(new RegExp('[\\u0300-\\u036f]', 'g'), '');
  }

  function extractNumber(str) {
    const milMatch = str.match(/(\d+(?:[.,]\d+)?)\s*mil/);
    if (milMatch) return parseFloat(milMatch[1].replace(',', '.')) * 1000;
    const numMatch = str.match(/(\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d+(?:,\d+)?)/);
    if (!numMatch) return null;
    return parseFloat(numMatch[1].replace(/\./g, '').replace(',', '.'));
  }

  function parseProductQuery(text) {
    const norm = stripAccents(text.toLowerCase());

    let category = null;
    for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
      if (keywords.some((k) => norm.includes(stripAccents(k)))) { category = cat; break; }
    }

    let color = null;
    const allColorNames = [...new Set(MdecorProducts.getAll().flatMap((p) => (p.colors || []).map((c) => c.name)))];
    for (const c of allColorNames) {
      const normColor = stripAccents(c.toLowerCase());
      const firstWord = normColor.split(' ')[0];
      if (norm.includes(normColor) || (firstWord.length > 3 && norm.includes(firstWord))) { color = c; break; }
    }

    let maxPrice = null;
    const maxMatch = norm.match(/(?:abaixo de|ate|menos de|no maximo)\s*(?:r\$)?\s*([\d.,]+\s*mil|[\d.,]+)/);
    if (maxMatch) maxPrice = extractNumber(maxMatch[1]);

    let minPrice = null;
    const minMatch = norm.match(/(?:acima de|mais de|a partir de)\s*(?:r\$)?\s*([\d.,]+\s*mil|[\d.,]+)/);
    if (minMatch) minPrice = extractNumber(minMatch[1]);

    return { category, color, maxPrice, minPrice, norm };
  }

  function searchProductsForQA(text) {
    const { category, color, maxPrice, minPrice, norm } = parseProductQuery(text);
    let list = MdecorProducts.getAll();
    const hasStructuredFilter = category || color || maxPrice != null || minPrice != null;

    if (category) list = list.filter((p) => p.category === category);
    if (color) list = list.filter((p) => (p.colors || []).some((c) => c.name === color));
    if (maxPrice != null) list = list.filter((p) => p.price <= maxPrice);
    if (minPrice != null) list = list.filter((p) => p.price >= minPrice);

    if (!hasStructuredFilter) {
      const words = norm.split(/\s+/).filter((w) => w.length > 3);
      list = list.filter((p) => {
        const haystack = stripAccents(`${p.name} ${p.description || ''}`.toLowerCase());
        return words.some((w) => haystack.includes(w));
      });
    }

    return list.filter((p) => !MdecorProducts.isOutOfStock(p)).slice(0, 4);
  }

  function formatProductAnswer(list) {
    if (!list.length) {
      return 'Não encontrei um produto exatamente assim. Você pode tentar de outro jeito (ex: "sofá cinza", "mesa até 2000 reais") ou ver o catálogo completo na seção de produtos do site.';
    }
    const intro = list.length === 1 ? 'Encontrei esta opção para você:' : `Encontrei ${list.length} opções para você:`;
    const items = list.map((p) => `
      <div style="margin:10px 0;padding-bottom:10px;border-bottom:1px solid #eee2ce">
        <strong>${p.name}</strong><br>
        ${CATEGORY_LABELS[p.category] || p.category} · ${currency(p.price)}<br>
        Cores: ${(p.colors || []).map((c) => c.name).join(', ')}
        ${MdecorProducts.isLowStock(p) ? `<br><span style="color:#b5452f;font-weight:700">Só restam ${p.stock} unidades!</span>` : ''}
      </div>
    `).join('');
    return `${intro}${items}`;
  }

  function startProductQA() {
    addBotMessage('Pode perguntar! Por exemplo: <em>"tem sofá cinza?"</em>, <em>"mesa até 2000 reais"</em> ou <em>"poltrona reclinável"</em>.');
    addFormCard(`
      <label for="chat-input-qa">Sua pergunta</label>
      <input type="text" id="chat-input-qa" placeholder="Ex: sofá cinza até 3000 reais" />
      <button type="button" class="btn btn-primary btn-block btn-sm" id="chat-qa-submit">Perguntar</button>
    `, (card) => {
      const input = card.querySelector('#chat-input-qa');
      const submit = () => {
        const val = input.value.trim();
        if (!val) { input.focus(); return; }
        addUserMessage(val);
        withTyping(() => {
          const results = searchProductsForQA(val);
          addBotMessage(formatProductAnswer(results));
          askProductQAFollowup();
        });
      };
      card.querySelector('#chat-qa-submit').addEventListener('click', submit);
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
      input.focus();
    });
  }

  function askProductQAFollowup() {
    addQuickReplies([
      { label: 'Perguntar outra coisa', value: 'again' },
      { label: 'Quero agendar uma visita', value: 'agendar' },
      { label: 'Voltar ao menu', value: 'menu' },
    ], (value) => {
      if (value === 'again') { withTyping(startProductQA); return; }
      if (value === 'agendar') { withTyping(startBookingFlow); return; }
      withTyping(askMainMenu);
    });
  }

  function startBookingFlow() {
    addBotMessage('Perfeito! Vamos agendar sua visita. Primeiro, qual o seu nome?');
    addFormCard(`
      <label for="chat-input-name">Seu nome</label>
      <input type="text" id="chat-input-name" placeholder="Digite seu nome completo" autocomplete="name" />
      <button type="button" class="btn btn-primary btn-block btn-sm" id="chat-name-submit">Continuar</button>
    `, (card) => {
      const input = card.querySelector('#chat-input-name');
      const submit = () => {
        const val = input.value.trim();
        if (!val) { input.focus(); return; }
        booking.name = val;
        addUserMessage(val);
        withTyping(askPhone);
      };
      card.querySelector('#chat-name-submit').addEventListener('click', submit);
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
      input.focus();
    });
  }

  function askPhone() {
    addBotMessage(`Prazer, ${booking.name.split(' ')[0]}! Qual o melhor telefone/WhatsApp para contato?`);
    addFormCard(`
      <label for="chat-input-phone">Telefone</label>
      <input type="tel" id="chat-input-phone" placeholder="(11) 91234-5678" autocomplete="tel" />
      <button type="button" class="btn btn-primary btn-block btn-sm" id="chat-phone-submit">Continuar</button>
    `, (card) => {
      const input = card.querySelector('#chat-input-phone');
      const submit = () => {
        const val = input.value.trim();
        if (val.replace(/\D/g, '').length < 10) { input.focus(); return; }
        booking.phone = val;
        addUserMessage(val);
        withTyping(() => {
          if (booking.productCategory) {
            askDate();
          } else {
            askProduct();
          }
        });
      };
      card.querySelector('#chat-phone-submit').addEventListener('click', submit);
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
      input.focus();
    });
  }

  function askProduct() {
    addBotMessage('Você tem interesse em alguma categoria específica de móveis?');
    const cats = Object.entries(CATEGORY_LABELS).filter(([k]) => k !== 'todos');
    addQuickReplies(
      [...cats.map(([k, v]) => ({ label: v, value: k })), { label: 'Ainda não sei', value: '' }],
      (value) => {
        booking.productCategory = value;
        withTyping(askDate);
      }
    );
  }

  function askDate() {
    addBotMessage('Qual data seria melhor para sua visita?');
    addFormCard(`
      <label for="chat-input-date">Data da visita</label>
      <input type="date" id="chat-input-date" min="${todayISO()}" />
      <button type="button" class="btn btn-primary btn-block btn-sm" id="chat-date-submit">Continuar</button>
    `, (card) => {
      const input = card.querySelector('#chat-input-date');
      input.value = todayISO();
      const submit = () => {
        const val = input.value;
        if (!val) { input.focus(); return; }
        const day = new Date(val + 'T12:00:00').getDay();
        if (!STORE_HOURS[day]) {
          addUserMessage(formatDateBR(val));
          withTyping(() => {
            addBotMessage('Aos domingos a loja fica fechada. Pode escolher outro dia?');
            askDate();
          });
          return;
        }
        booking.date = val;
        addUserMessage(formatDateBR(val));
        withTyping(askTime);
      };
      card.querySelector('#chat-date-submit').addEventListener('click', submit);
      input.focus();
    });
  }

  function askTime() {
    const day = new Date(booking.date + 'T12:00:00').getDay();
    const allSlots = STORE_HOURS[day].slots;
    const taken = MdecorStorage.takenSlots(booking.date);
    const available = allSlots.filter((s) => !taken.includes(s));

    if (!available.length) {
      addBotMessage('Todos os horários desse dia já foram preenchidos. Vamos tentar outra data?');
      withTyping(askDate);
      return;
    }

    addBotMessage(`Ótimo, temos estes horários disponíveis em ${formatDateBR(booking.date)}:`);
    addQuickReplies(available.map((s) => ({ label: s, value: s })), (time) => {
      booking.time = time;
      withTyping(showSummary);
    });
  }

  function showSummary() {
    const productLine = booking.productName
      ? `<li>Produto: ${booking.productName}</li>`
      : (booking.productCategory
        ? `<li>Interesse: ${CATEGORY_LABELS[booking.productCategory] || booking.productCategory}</li>`
        : '');
    addBotMessage(`
      Confirme os dados do seu agendamento:<br><br>
      <ul style="margin:0;padding-left:18px;line-height:1.7">
        <li>Nome: ${booking.name}</li>
        <li>Telefone: ${booking.phone}</li>
        ${productLine}
        <li>Data: ${formatDateBR(booking.date)} às ${booking.time}</li>
      </ul>
    `);
    addQuickReplies([
      { label: 'Confirmar agendamento', value: 'confirm' },
      { label: 'Recomeçar', value: 'restart' },
    ], (value) => {
      if (value === 'restart') { withTyping(startBookingFlow); return; }
      withTyping(saveBooking);
    });
  }

  function saveBooking() {
    MdecorStorage.add({
      name: booking.name,
      phone: booking.phone,
      productCategory: booking.productCategory || null,
      productName: booking.productName || null,
      date: booking.date,
      time: booking.time,
    });
    addBotMessage(`
      Agendamento recebido com sucesso!<br>
      Em breve nossa equipe confirma pelo telefone <strong>${booking.phone}</strong>.
      Te esperamos dia <strong>${formatDateBR(booking.date)} às ${booking.time}</strong> na loja Mdecor!
    `);
    addQuickReplies([
      { label: 'Fazer outro agendamento', value: 'new' },
      { label: 'Encerrar', value: 'end' },
    ], (value) => {
      if (value === 'new') { withTyping(startBookingFlow); return; }
      withTyping(() => {
        addBotMessage('Obrigada pela visita ao nosso site! Até logo.');
      });
    });
  }

  // ---------- Controle da janela ----------

  function openChat() {
    document.getElementById('chat-window').classList.add('open');
    document.getElementById('chat-launcher').setAttribute('aria-expanded', 'true');
    const ping = document.getElementById('chat-ping');
    if (ping) ping.remove();
    launcherHasPing = false;
    if (!document.getElementById('chat-body').hasChildNodes()) start();
  }

  function closeChat() {
    document.getElementById('chat-window').classList.remove('open');
    document.getElementById('chat-launcher').setAttribute('aria-expanded', 'false');
  }

  function openWithProduct(product) {
    openChat();
    booking = { productCategory: product.category, productName: product.name };
    document.getElementById('chat-body').innerHTML = '';
    withTyping(() => {
      addBotMessage(`Ótima escolha! Vamos agendar uma visita para você ver de perto o <strong>${product.name}</strong>. Qual o seu nome?`);
      addFormCard(`
        <label for="chat-input-name">Seu nome</label>
        <input type="text" id="chat-input-name" placeholder="Digite seu nome completo" autocomplete="name" />
        <button type="button" class="btn btn-primary btn-block btn-sm" id="chat-name-submit">Continuar</button>
      `, (card) => {
        const input = card.querySelector('#chat-input-name');
        const submit = () => {
          const val = input.value.trim();
          if (!val) { input.focus(); return; }
          booking.name = val;
          addUserMessage(val);
          withTyping(askPhone);
        };
        card.querySelector('#chat-name-submit').addEventListener('click', submit);
        input.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
        input.focus();
      });
    }, 400);
  }

  function init() {
    document.getElementById('chat-launcher').addEventListener('click', openChat);
    document.getElementById('chat-close').addEventListener('click', closeChat);
  }

  document.addEventListener('DOMContentLoaded', init);

  return { openChat, closeChat, openWithProduct };
})();

window.MdecorChat = MdecorChat;
