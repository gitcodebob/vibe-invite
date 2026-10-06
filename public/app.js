const FIELDS = ['code', 'name', 'email'];
const BASE_TITLE = document.title;

const form = document.getElementById('redeem-form');
const submit = document.getElementById('submit');
const summary = document.getElementById('foutmeldingen');
const summaryList = summary.querySelector('ul');
const status = document.getElementById('status');
const formSection = document.getElementById('formulier');
const resultSection = document.getElementById('resultaat');
const resultTitle = document.getElementById('resultaat-titel');
const resultText = document.getElementById('resultaat-tekst');
const inviteList = document.getElementById('invites');
const inviteTemplate = document.getElementById('invite-template');

let busy = false;

// aria-describedby zoals in de HTML staat, zodat we de foutmelding er netjes voor kunnen zetten.
const baseDescribedBy = Object.fromEntries(
  FIELDS.map((f) => [f, form.elements[f].getAttribute('aria-describedby') ?? '']),
);

function clearErrors() {
  summary.hidden = true;
  summaryList.replaceChildren();
  for (const f of FIELDS) {
    const input = form.elements[f];
    const error = document.getElementById(`${f}-error`);
    input.removeAttribute('aria-invalid');
    if (baseDescribedBy[f]) input.setAttribute('aria-describedby', baseDescribedBy[f]);
    else input.removeAttribute('aria-describedby');
    error.hidden = true;
    error.textContent = '';
    input.closest('.field').classList.remove('field--error');
  }
  document.title = BASE_TITLE;
}

function showErrors(errors) {
  for (const { field, message } of errors) {
    const item = document.createElement('li');
    const input = field && form.elements[field];
    if (input) {
      const link = document.createElement('a');
      link.href = `#${field}`;
      link.textContent = message;
      link.addEventListener('click', (event) => {
        event.preventDefault();
        input.focus();
      });
      item.append(link);

      const error = document.getElementById(`${field}-error`);
      const prefix = document.createElement('span');
      prefix.className = 'visually-hidden';
      prefix.textContent = 'Fout: ';
      error.replaceChildren(prefix, message);
      error.hidden = false;
      input.setAttribute('aria-invalid', 'true');
      input.setAttribute('aria-describedby', `${field}-error ${baseDescribedBy[field]}`.trim());
      input.closest('.field').classList.add('field--error');
    } else {
      item.textContent = message;
    }
    summaryList.append(item);
  }
  document.title = `Fout: ${BASE_TITLE}`;
  summary.hidden = false;
  summary.focus();
}

function mailtoFor(code, name) {
  const subject = 'Uitnodiging voor het Education Vibe Cluster';
  const body = [
    'Hoi,',
    '',
    'Ik denk dat jij hier iets aan hebt. Met het Education Vibe Cluster zet je ieder idee live met één prompt.',
    '',
    `Jouw invitecode: ${code}`,
    `Vul hem in op ${location.origin}/`,
    '',
    'De code werkt één keer.',
    '',
    'Groet,',
    name,
  ].join('\n');
  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function renderInvites(invites, name) {
  inviteList.replaceChildren(
    ...invites.map((code) => {
      const item = inviteTemplate.content.firstElementChild.cloneNode(true);
      item.querySelector('.invite__code').textContent = code;
      for (const label of item.querySelectorAll('[data-code-label]')) label.textContent = ` code ${code}`;
      item.querySelector('[data-action="mail"]').href = mailtoFor(code, name);
      item.querySelector('[data-action="copy"]').dataset.code = code;
      return item;
    }),
  );
}

function showResult(data, name) {
  const email = data.email;
  if (data.status === 'redeemed') {
    resultTitle.textContent = 'Gelukt! Je code is geactiveerd';
    resultText.textContent =
      `De beheerders zetten je toegang klaar. Je krijgt een e-mail op ${email} zodra je aan de slag kunt.`;
  } else if (data.sameCode) {
    resultTitle.textContent = 'Je code was al geactiveerd';
    resultText.textContent = 'Je toegang is al aangevraagd. Hieronder staan je drie invitecodes nog een keer.';
  } else {
    resultTitle.textContent = 'Je hebt al toegang aangevraagd';
    resultText.textContent =
      `Met ${email} heb je eerder al een code gebruikt. De code ${data.code} is daarom niet gebruikt: ` +
      'geef hem aan een andere collega. Hieronder staan je eigen drie invitecodes.';
  }
  renderInvites(data.invites, name);
  document.title = `${resultTitle.textContent} – Education Vibe Cluster – Topicus`;
  formSection.hidden = true;
  resultSection.hidden = false;
  resultTitle.focus();
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (busy) return;
  busy = true;
  submit.setAttribute('aria-disabled', 'true');
  status.textContent = 'Je code wordt gecontroleerd.';
  clearErrors();

  const name = form.elements.name.value;
  try {
    const response = await fetch('/api/redeem', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: form.elements.code.value, name, email: form.elements.email.value }),
    });
    const data = await response.json().catch(() => null);
    if (response.ok && data?.invites) showResult(data, name.trim());
    else showErrors(data?.errors ?? [{ field: null, message: 'Er ging iets mis. Probeer het opnieuw.' }]);
  } catch {
    showErrors([{ field: null, message: 'Er is geen verbinding. Controleer je internet en probeer het opnieuw.' }]);
  } finally {
    busy = false;
    submit.removeAttribute('aria-disabled');
    status.textContent = '';
  }
});

inviteList.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-action="copy"]');
  if (!button) return;
  const code = button.dataset.code;

  for (const other of inviteList.querySelectorAll('[data-copied]')) {
    delete other.dataset.copied;
    other.querySelector('[data-label]').textContent = 'Kopieer';
  }
  try {
    await navigator.clipboard.writeText(code);
    button.dataset.copied = '';
    button.querySelector('[data-label]').textContent = 'Gekopieerd';
    status.textContent = `Code ${code} is gekopieerd.`;
  } catch {
    // Geen klembord (oude browser, geen toestemming): selecteer de code, dan kan het met Ctrl+C.
    const range = document.createRange();
    range.selectNodeContents(button.closest('.invite').querySelector('.invite__code'));
    getSelection().removeAllRanges();
    getSelection().addRange(range);
    status.textContent = `Kopiëren lukte niet. Code ${code} is geselecteerd: kopieer hem met Ctrl+C.`;
  }
});

document.getElementById('opnieuw').addEventListener('click', () => {
  form.reset();
  clearErrors();
  inviteList.replaceChildren();
  status.textContent = '';
  resultSection.hidden = true;
  formSection.hidden = false;
  form.elements.code.focus();
});

// Zolang er geen database is, draait de server een stub met een democode. Laat die zien.
fetch('/api/status')
  .then((response) => (response.ok ? response.json() : null))
  .then((info) => {
    if (info?.store !== 'stub' || !info.demoCode) return;
    document.getElementById('demo-code').textContent = info.demoCode;
    document.getElementById('fill-demo').addEventListener('click', () => {
      if (formSection.hidden) document.getElementById('opnieuw').click();
      form.elements.code.value = info.demoCode;
      (FIELDS.map((f) => form.elements[f]).find((input) => !input.value) ?? submit).focus();
    });
    document.getElementById('test-banner').hidden = false;
  })
  .catch(() => {});
