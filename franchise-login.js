'use strict';
// UI demonstration only. This is not authentication or an access boundary.
const form = document.getElementById('login-form');
const email = document.getElementById('email');
const password = document.getElementById('password');
const message = document.getElementById('message');
document.querySelector('.toggle').addEventListener('click', event => {
  const reveal = password.type === 'password';
  password.type = reveal ? 'text' : 'password';
  event.currentTarget.textContent = reveal ? 'Hide' : 'Show';
  event.currentTarget.setAttribute('aria-label', reveal ? 'Hide password' : 'Show password');
  event.currentTarget.setAttribute('aria-pressed', String(reveal));
});
document.getElementById('demo').addEventListener('click', () => {
  email.value = 'jordan@example.com';
  password.value = 'GameGuysDemo';
  message.textContent = 'Demo account ready. Select Sign in to explore.';
  document.querySelector('.submit').focus();
});
document.getElementById('recovery').addEventListener('click', event => {
  event.preventDefault();
  message.textContent = 'Password recovery is not connected in this preview. Contact your franchise administrator for account help.';
});
form.addEventListener('submit', event => {
  event.preventDefault();
  if (email.value.trim().toLowerCase() !== 'jordan@example.com' || password.value !== 'GameGuysDemo') {
    message.textContent = 'This preview accepts only the sample account. Select Fill demo account below to continue.';
    return;
  }
  password.value = '';
  window.location.assign('franchise.html');
});
