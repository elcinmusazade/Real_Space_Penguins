/** The chat lives outside the campaign render tree so turns and navigation preserve the exchange. */
export function mountJarvis(root, getContext) {
  const launch = root.querySelector('.jarvis-launch');
  const panel = root.querySelector('.jarvis-panel');
  const form = root.querySelector('form');
  const input = form.querySelector('textarea');
  const send = form.querySelector('button');
  const log = root.querySelector('[role="log"]');
  const intro = root.querySelector('.jarvis-intro');
  const status = root.querySelector('[role="status"]');
  const retry = root.querySelector('.jarvis-retry');
  const turnLabel = root.querySelector('.jarvis-turn');
  let history = [], pending = null, failed = null;

  function toggle(open) {
    panel.hidden = !open;
    launch.hidden = open;
    launch.setAttribute('aria-expanded', String(open));
    if (open) input.focus();
    else if (!root.hidden) launch.focus({preventScroll: true});
  }

  function bubble(role, text, turn) {
    const item = document.createElement('p');
    item.className = 'jarvis-message ' + role;
    const author = document.createElement('strong');
    author.textContent = role === 'user' ? 'YOU' : 'JARVIS · TURN ' + String(turn).padStart(2, '0');
    item.append(author, document.createTextNode(text));
    log.append(item);
    log.scrollTop = log.scrollHeight;
  }

  async function ask(question, retrying = false) {
    question = question.trim();
    if (!question || question.length > 600 || pending) return;
    const {state, view} = getContext();
    const request = new AbortController();
    pending = request;
    failed = null;
    retry.hidden = true;
    intro.hidden = true;
    if (!retrying) bubble('user', question);
    send.disabled = true;
    if (!retrying) input.value = '';
    status.textContent = 'Reading your campaign…';
    try {
      const response = await fetch('/api/campaign/jarvis', {
        method: 'POST', headers: {'Content-Type': 'application/json'}, signal: request.signal,
        body: JSON.stringify({question, state, view, history: history.slice(-6)}),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || 'JARVIS could not answer. Please retry.');
      if (pending !== request) return;
      bubble('assistant', data.reply, data.turn);
      history.push({role: 'user', content: question}, {role: 'assistant', content: data.reply});
      status.textContent = '';
    } catch (error) {
      if (pending !== request || request.signal.aborted) return;
      failed = question;
      status.textContent = error instanceof SyntaxError || error instanceof TypeError
        ? 'The game server is unavailable. Restart the updated game server and retry.' : error.message;
      retry.hidden = false;
    } finally {
      if (pending === request) {
        pending = null;
        send.disabled = !input.value.trim();
      }
    }
  }

  launch.addEventListener('click', () => toggle(true));
  root.querySelector('.jarvis-close').addEventListener('click', () => toggle(false));
  root.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !panel.hidden) {
      event.stopPropagation();
      toggle(false);
    }
  });
  form.addEventListener('submit', event => { event.preventDefault(); ask(input.value); });
  input.addEventListener('input', () => { send.disabled = Boolean(pending) || !input.value.trim(); });
  input.addEventListener('keydown', event => {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      form.requestSubmit();
    }
  });
  for (const button of intro.querySelectorAll('button')) {
    button.addEventListener('click', () => ask(button.textContent));
  }
  retry.addEventListener('click', () => { if (failed) ask(failed, true); });

  return {
    sync(turn, blocked) {
      root.hidden = blocked;
      turnLabel.textContent = 'TURN ' + String(turn).padStart(2, '0');
    },
    reset() {
      pending?.abort();
      pending = null;
      failed = null;
      history = [];
      log.replaceChildren();
      status.textContent = input.value = '';
      send.disabled = retry.hidden = true;
      intro.hidden = false;
      if (!panel.hidden) toggle(false);
    },
  };
}

