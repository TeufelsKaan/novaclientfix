import { createClient } from '@supabase/supabase-js';

const env = import.meta.env;
const supabase = env.VITE_SUPABASE_URL && env.VITE_SUPABASE_PUBLISHABLE_KEY
  ? createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY)
  : null;
const loginCard = document.querySelector('#login-card');
const toolsPanel = document.querySelector('#admin-tools');
const loginStatus = document.querySelector('#login-status');
const loginButton = document.querySelector('#login-button');
function status(message, error = false) {
  loginStatus.textContent = message;
  loginStatus.dataset.state = error ? 'error' : 'normal';
}
async function verifyAdmin(session) {
  if (!session || !supabase) return false;
  const { data, error } = await supabase.functions.invoke('admin-tools', { body: { action: 'status' } });
  if (error || !data?.authorized) {
    await supabase.auth.signOut();
    status(data?.message || 'Diese E-Mail ist nicht als Nova-Admin freigeschaltet.', true);
    loginCard.hidden = false;
    toolsPanel.hidden = true;
    return false;
  }
  loginCard.hidden = true;
  toolsPanel.hidden = false;
  return true;
}
if (!supabase) {
  status('Die Nova-Admin-Anmeldung ist noch nicht eingerichtet.', true);
  loginButton.disabled = true;
} else {
  supabase.auth.getSession().then(({ data }) => verifyAdmin(data.session));
  supabase.auth.onAuthStateChange((_event, session) => {
    if (session) verifyAdmin(session);
    else { loginCard.hidden = false; toolsPanel.hidden = true; }
  });
}
document.querySelector('#login-form').addEventListener('submit', async event => {
  event.preventDefault();
  if (!supabase) return;
  loginButton.disabled = true;
  status('Anmeldung wird geprüft …');
  try {
    const email = document.querySelector('#admin-email').value.trim();
    const password = document.querySelector('#admin-password').value;
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    const { data } = await supabase.auth.getSession();
    await verifyAdmin(data.session);
  } catch (error) {
    status('Anmeldung fehlgeschlagen. Prüfe E-Mail und Passwort.', true);
  } finally { loginButton.disabled = false; }
});
document.querySelector('#signout-button').addEventListener('click', async () => {
  await supabase?.auth.signOut();
  status('Du wurdest abgemeldet.');
});
