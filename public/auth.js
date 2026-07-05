import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
  signOut,
} from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js';

const firebaseConfig = {
  apiKey: 'AIzaSyD3pdmYwd3boG8qKy02_UrX1hTduueFcDQ',
  authDomain: 'book-lab-5a744.firebaseapp.com',
  projectId: 'book-lab-5a744',
  storageBucket: 'book-lab-5a744.firebasestorage.app',
  messagingSenderId: '3360284789',
  appId: '1:3360284789:web:1dba8a5114226fe0e6583c',
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

let idToken = null;

export function signInWithGoogle() {
  return signInWithPopup(auth, new GoogleAuthProvider());
}

export function logout() {
  return signOut(auth).then(() => {
    window.location.href = 'index.html';
  });
}

export function redirectIfSignedIn(destination) {
  onAuthStateChanged(auth, (fbUser) => {
    if (fbUser) window.location.href = destination;
  });
}

const NAV_LINKS = [
  { href: 'dashboard.html', label: 'Dashboard' },
  { href: 'booking.html', label: 'จองห้อง' },
  { href: 'calendar.html', label: 'ปฏิทินห้อง' },
  { href: 'approve.html', label: 'อนุมัติ', approverOnly: true },
  { href: 'inventory.html', label: 'สต็อกสารเคมี', approverOnly: true },
  { href: 'report.html', label: 'รายงานสารเคมี', approverOnly: true },
];

function renderNav(user) {
  const nav = document.getElementById('nav');
  if (!nav) return;
  const currentPage = location.pathname.split('/').pop();
  const links = NAV_LINKS.filter((l) => l.href !== currentPage)
    .filter((l) => !l.approverOnly || user.role === 'approver')
    .map((l) => `<a href="${l.href}">${l.label}</a>`)
    .join('');
  nav.innerHTML = `${links}<span style="margin-left:16px;">${user.name} (${user.role})</span><a href="#" id="logoutLink">ออกจากระบบ</a>`;
  document.getElementById('logoutLink').addEventListener('click', (e) => {
    e.preventDefault();
    logout();
  });
}

// Redirects to index.html if not signed in (or dashboard.html if approverOnly
// and the user isn't an approver), otherwise renders the nav and resolves
// with { id, name, email, role }.
export function requireAuth({ approverOnly = false } = {}) {
  return new Promise((resolve) => {
    onAuthStateChanged(auth, async (fbUser) => {
      if (!fbUser) {
        window.location.href = 'index.html';
        return;
      }
      idToken = await fbUser.getIdToken();
      const res = await fetch('/api/me', { headers: { Authorization: `Bearer ${idToken}` } });
      const data = await res.json();
      if (!data.user) {
        window.location.href = 'index.html';
        return;
      }
      if (approverOnly && data.user.role !== 'approver') {
        alert('สิทธิ์ไม่เพียงพอ: ต้องเป็น approver');
        window.location.href = 'dashboard.html';
        return;
      }
      renderNav(data.user);
      resolve(data.user);
    });
  });
}

export async function apiFetch(path, options = {}) {
  if (!idToken && auth.currentUser) {
    idToken = await auth.currentUser.getIdToken();
  }
  const headers = { ...(options.headers || {}), Authorization: `Bearer ${idToken}` };
  return fetch(path, { ...options, headers });
}
