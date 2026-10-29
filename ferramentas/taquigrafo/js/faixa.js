/* Limpa a faixa da legenda fora da página (Web Worker): mexer pixel a pixel numa imagem de
   2400 px a cada 0,7 s travava o vídeo e a rolagem. Recebe o recorte já ampliado, devolve a
   imagem preto no branco para o Tesseract, quanto dela é letra e se mudou desde a última. */

let anterior = null;

onmessage = async (ev) => {
  const m = ev.data;
  if (m.zerar) { anterior = null; return; }
  const { quadro, escala, alturaPlayer, margem } = m;
  const W = quadro.width, H = quadro.height;
  const tela = new OffscreenCanvas(W + margem * 2, H + margem * 2);
  const g = tela.getContext('2d', { willReadFrequently: true });
  g.fillStyle = '#fff';
  g.fillRect(0, 0, tela.width, tela.height);
  g.drawImage(quadro, margem, margem);
  quadro.close();
  const img = g.getImageData(margem, margem, W, H);
  const tinta = limpar(img.data, W, H, escala, alturaPlayer);
  g.putImageData(img, margem, margem);
  const mudou = comparar(img.data, W, H);
  // só vale ler (e codificar o PNG) quando tem letra e ela mudou
  const blob = tinta >= 0.002 && mudou ? await tela.convertToBlob({ type: 'image/png' }) : null;
  const imagem = tela.transferToImageBitmap();
  postMessage({ tinta, mudou, blob, imagem }, [imagem]);
};

// A legenda do YouTube é texto branco numa caixa escura. Fica preto o que é claro E tem fundo
// escuro por perto (a letra); o resto, inclusive slide branco atrás, vira branco.
function limpar(d, W, H, escala, alturaPlayer) {
  const lum = new Uint8Array(W * H);
  // fundo da legenda: escuro e neutro (preto/cinza). Letra azul ou vermelha de slide não conta
  const fundo = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) {
    const r = d[i * 4], gg = d[i * 4 + 1], b = d[i * 4 + 2];
    lum[i] = (r * 299 + gg * 587 + b * 114) / 1000;
    fundo[i] = lum[i] < 90 && Math.max(r, gg, b) - Math.min(r, gg, b) < 40 ? 1 : 0;
  }
  const fila = new Int32Array(W * H);
  const maxAlt = alturaPlayer * escala * 0.1;
  // Fundo de legenda é a CAIXA: uma mancha escura larga. A letra escura de um slide também é
  // escura e neutra, mas estreita; sem esta conta, o miolo claro do "o" e do "e" do slide
  // virava letra e a transcrição se enchia de "oe .o” 00000"
  const caixa = new Uint8Array(W * H);
  for (let i0 = 0; i0 < W * H; i0++) {
    if (fundo[i0] !== 1) continue;
    let n = 0, esq = W, dir = 0;
    fila[n++] = i0; fundo[i0] = 2;
    for (let k = 0; k < n; k++) {
      const i = fila[k], x = i % W;
      if (x < esq) esq = x;
      if (x > dir) dir = x;
      if (x > 0 && fundo[i - 1] === 1) { fundo[i - 1] = 2; fila[n++] = i - 1; }
      if (x < W - 1 && fundo[i + 1] === 1) { fundo[i + 1] = 2; fila[n++] = i + 1; }
      if (i >= W && fundo[i - W] === 1) { fundo[i - W] = 2; fila[n++] = i - W; }
      if (i < W * (H - 1) && fundo[i + W] === 1) { fundo[i + W] = 2; fila[n++] = i + W; }
    }
    if (dir - esq >= maxAlt) for (let k = 0; k < n; k++) caixa[fila[k]] = 1;
  }
  // "perto da caixa" em 2D (somas acumuladas: linha e depois coluna). Olhar só para os lados
  // apagava o meio das barras horizontais (do "t", do "e") e "acolhimento" virava "acolhimenio"
  const rh = Math.round(9 * escala), rv = Math.round(6 * escala);
  const perto = new Uint8Array(W * H);
  const acc = new Int32Array(W + 1);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) acc[x + 1] = acc[x] + caixa[y * W + x];
    for (let x = 0; x < W; x++) perto[y * W + x] = acc[Math.min(W, x + rh + 1)] - acc[Math.max(0, x - rh)] > 0 ? 1 : 0;
  }
  const col = new Int32Array(H + 1);
  const perto2 = new Uint8Array(W * H);
  for (let x = 0; x < W; x++) {
    for (let y = 0; y < H; y++) col[y + 1] = col[y] + perto[y * W + x];
    for (let y = 0; y < H; y++) perto2[y * W + x] = col[Math.min(H, y + rv + 1)] - col[Math.max(0, y - rv)] > 0 ? 1 : 0;
  }
  // Só "perto" não basta: a beira do slide claro encostada na caixa virava uma moldura preta.
  // Cada mancha clara é seguida até o fim; letra é mancha baixa e fechada pela caixa. A que
  // encosta na borda da imagem ou é alta demais (o slide, o cenário) fica de fora
  const claro = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) claro[i] = lum[i] > 140 ? 1 : 0;
  for (let i0 = 0; i0 < W * H; i0++) {
    if (claro[i0] !== 1) continue;
    let n = 0, topo = H, base = 0, borda = false;
    fila[n++] = i0; claro[i0] = 2;
    for (let k = 0; k < n; k++) {
      const i = fila[k], x = i % W, y = (i - x) / W;
      if (y < topo) topo = y;
      if (y > base) base = y;
      if (x === 0 || y === 0 || x === W - 1 || y === H - 1) borda = true;
      if (x > 0 && claro[i - 1] === 1) { claro[i - 1] = 2; fila[n++] = i - 1; }
      if (x < W - 1 && claro[i + 1] === 1) { claro[i + 1] = 2; fila[n++] = i + 1; }
      if (y > 0 && claro[i - W] === 1) { claro[i - W] = 2; fila[n++] = i - W; }
      if (y < H - 1 && claro[i + W] === 1) { claro[i + W] = 2; fila[n++] = i + W; }
    }
    if (borda || base - topo > maxAlt) for (let k = 0; k < n; k++) claro[fila[k]] = 3;
  }
  let texto = 0;
  for (let i = 0; i < W * H; i++) {
    const letra = claro[i] === 2 && perto2[i];
    if (letra) texto++;
    d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = letra ? 0 : 255;
  }
  return texto / (W * H);
}

// A faixa limpa é quase toda branca: na média, uma palavra nova some. Divide em 240×60 casas,
// conta a tinta de cada uma e vê quantas casas mudaram
function comparar(d, W, H) {
  const CX = 240, CY = 60;
  const casas = new Uint16Array(CX * CY);
  for (let y = 0; y < H; y++) {
    const cy = Math.min(CY - 1, Math.floor(y * CY / H)) * CX;
    for (let x = 0; x < W; x++) if (d[(y * W + x) * 4] === 0) casas[cy + Math.min(CX - 1, Math.floor(x * CX / W))]++;
  }
  const lado = (W / CX) * (H / CY);
  let dif = 0;
  if (anterior) for (let i = 0; i < casas.length; i++) if (Math.abs(casas[i] - anterior[i]) > lado * 0.15) dif++;
  const novo = !anterior || dif > 6;
  anterior = casas;
  return novo;
}
