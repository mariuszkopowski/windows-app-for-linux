const $ = (id) => document.getElementById(id);
let strings = {};

function setStatus(state, message) {
  const text = strings[`status.${state}`] || '';
  $('status-text').textContent = state === 'error' && message ? `${text}: ${message}` : text;
  $('status').classList.toggle('error', state === 'error');
}

window.qrAPI.onInit((data) => {
  strings = data.strings;
  $('title').textContent = strings.title;
  $('instructions').textContent = strings.instructions;
  $('hint').textContent = strings.hint;
  $('cancel').textContent = strings.cancel;
  setStatus('waiting-for-scan');
});

window.qrAPI.onQr(({ svg }) => {
  const img = document.createElement('img');
  img.alt = 'QR code';
  img.src = `data:image/svg+xml;base64,${btoa(svg)}`;
  $('qr').replaceChildren(img);
});

window.qrAPI.onStatus(({ state, message }) => setStatus(state, message));

$('cancel').addEventListener('click', () => window.qrAPI.cancel());
