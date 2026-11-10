/* O ouvido: reconhecimento de fala com o Whisper (modelo aberto, roda aqui no computador,
   sem chave e sem servidor). Fica num Web Worker porque transcrever pesa: na página, travaria
   o vídeo. Recebe trechos de fala já cortados (16 kHz, mono) e devolve o texto de cada um. */

import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1';

env.allowLocalModels = false;

let asr = null;
let especiais = null;

async function carregar(modelo) {
  asr = await pipeline('automatic-speech-recognition', modelo, {
    dtype: 'q8',
    device: 'wasm',
    // o modelo vem em vários arquivos; a página soma o progresso de todos
    progress_callback: (p) => {
      if (p.status === 'progress') postMessage({ tipo: 'progresso', arquivo: p.file, carregado: p.loaded, total: p.total });
    }
  });
  especiais = asr.tokenizer.model.convert_tokens_to_ids(['<|startofprev|>', '<|startoftranscript|>', '<|pt|>', '<|transcribe|>', '<|notimestamps|>']);
  postMessage({ tipo: 'pronto' });
}

// A "dica" é o contexto que o Whisper lê antes de ouvir (o que já foi dito, as palavras-chave):
// ele escreve no mesmo estilo e acerta mais sigla e nome. Vai como no Whisper original:
// <|startofprev|> dica <|startoftranscript|><|pt|><|transcribe|><|notimestamps|>
function inicio(dica) {
  const [prev, sot, pt, transcrever, semTempo] = especiais;
  const ids = asr.tokenizer.encode(' ' + dica.trim(), { add_special_tokens: false }).slice(-180);
  return { ids: [prev, ...ids, sot, pt, transcrever, semTempo], texto: asr.tokenizer.decode(ids, { skip_special_tokens: true }).trim() };
}

onmessage = async (ev) => {
  const m = ev.data;
  try {
    if (m.tipo === 'carregar') {
      await carregar(m.modelo);
    } else if (m.tipo === 'ouvir') {
      const t0 = performance.now();
      const opcoes = { language: 'portuguese', task: 'transcribe' };
      const d = m.dica ? inicio(m.dica) : null;
      if (d) opcoes.decoder_input_ids = d.ids;
      const r = await asr(m.audio, opcoes);
      let texto = (r.text || '').trim();
      // a resposta volta com a dica na frente: tira (se a decodificação mudou um espaço ou um
      // acento, acha o fim da dica no texto e corta dali, para ela nunca vazar para a fita)
      if (d && texto.startsWith(d.texto)) texto = texto.slice(d.texto.length).trim();
      else if (d) {
        const fim = d.texto.slice(-40);
        const i = fim.length >= 10 ? texto.indexOf(fim) : -1;
        if (i >= 0) texto = texto.slice(i + fim.length).trim();
      }
      postMessage({ tipo: 'texto', id: m.id, quando: m.quando, texto, ms: Math.round(performance.now() - t0), segundos: m.audio.length / 16000 });
    }
  } catch (e) {
    postMessage({ tipo: 'erro', id: m.id || null, msg: String((e && e.message) || e) });
  }
};
