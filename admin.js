import { initializeApp } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-app.js";
import {
    getFirestore,
    collection,
    addDoc,
    setDoc,
    getDoc,
    getDocs,
    doc,
    deleteDoc,
    query,
    where
} from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";
import {
    getAuth,
    GoogleAuthProvider,
    signInWithPopup,
    signOut,
    onAuthStateChanged,
    browserSessionPersistence,
    setPersistence
} from "https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js";

// FIX #1: API Key — recuerda restringirla en Google Cloud Console a tu dominio admin
const firebaseConfig = {
    apiKey: "AIzaSyArmhy141BBuYQNKnIqILg0_7fGf5Nul2E",
    authDomain: "sintegra-store.firebaseapp.com",
    projectId: "sintegra-store",
    storageBucket: "sintegra-store.firebasestorage.app",
    messagingSenderId: "795975627623",
    appId: "1:795975627623:web:f790f64b5ca94b327cf5c2",
    measurementId: "G-8DXD7B4PP4"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

const MAIN_ADMIN_EMAIL = "josemanueldiazocampo1@gmail.com";
let currentAdmin = null;

// FIX #4: Función de escape HTML contra XSS
function escapeHTML(str) {
    if (str === null || str === undefined) return '';
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(String(str)));
    return div.innerHTML;
}

// FIX #13: Sesión expira al cerrar el navegador (no persiste indefinidamente)
await setPersistence(auth, browserSessionPersistence);

// ============================================
// AUTENTICACIÓN
// ============================================

// FIX: Usar addEventListener en vez de onclick inline (eliminado del HTML)
document.getElementById('googleLoginBtn').addEventListener('click', async () => {
    const btn = document.getElementById('googleLoginBtn');
    const errorEl = document.getElementById('loginError');
    btn.disabled = true;
    btn.textContent = 'Abriendo Google...';
    errorEl.style.display = 'none';

    try {
        await signInWithPopup(auth, googleProvider);
    } catch (error) {
        // FIX #12: Mensaje genérico al usuario, sin detalles internos
        errorEl.textContent = 'No se pudo iniciar sesión. Verifica que estás usando una cuenta autorizada.';
        errorEl.style.display = 'block';
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" width="20" alt="Google"> Entrar con Google';
    }
});

document.getElementById('logoutBtn').addEventListener('click', () => signOut(auth));

// ============================================
// OBSERVADOR DE SESIÓN
// ============================================
onAuthStateChanged(auth, async (user) => {
    if (user) {
        const email = user.email.toLowerCase();

        if (email === MAIN_ADMIN_EMAIL) {
            currentAdmin = { email, name: user.displayName || 'Administrador', role: 'host' };
            showAdminInterface();
        } else {
            // FIX #2: Consulta por campo "email" (no por ID del documento)
            // Esto requiere que al guardar admins se use el email como ID del doc (ver addAdmin)
            const q = query(collection(db, "admins"), where("email", "==", email));
            const snap = await getDocs(q);
            if (!snap.empty) {
                currentAdmin = { email, name: snap.docs[0].data().name || email, role: 'admin' };
                showAdminInterface();
            } else {
                await signOut(auth);
                const errorEl = document.getElementById('loginError');
                errorEl.textContent = 'No tienes permiso para acceder a este panel.';
                errorEl.style.display = 'block';
            }
        }
    } else {
        currentAdmin = null;
        showLoginScreen();
    }
});

function showAdminInterface() {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('adminInterface').style.display = 'block';

    // FIX #4: textContent para datos del usuario, no innerHTML
    document.getElementById('currentUserDisplay').textContent = `👤 ${currentAdmin.name} (${currentAdmin.role})`;

    // FIX #10: Mostrar u ocultar formulario de agregar admin según rol (UI)
    // La verdadera protección está en las Reglas de Firebase
    if (currentAdmin.role !== 'host') {
        document.getElementById('addAdminFormWrapper').style.display = 'none';
        document.getElementById('noAddAdminMsg').style.display = 'block';
    } else {
        document.getElementById('addAdminFormWrapper').style.display = 'block';
        document.getElementById('noAddAdminMsg').style.display = 'none';
    }

    loadCitas();
}

function showLoginScreen() {
    document.getElementById('loginScreen').style.display = 'flex';
    document.getElementById('adminInterface').style.display = 'none';
}

// ============================================
// NAVEGACIÓN POR TABS
// ============================================
document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        const tabName = tab.getAttribute('data-tab');
        document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
        document.getElementById(`${tabName}Section`).classList.add('active');

        if (tabName === 'citas') loadCitas();
        if (tabName === 'webs') loadWebs();
        if (tabName === 'visionMision') loadVisionMision();
        if (tabName === 'team') loadTeam();
    });
});

// ============================================
// CITAS
// ============================================
async function loadCitas() {
    const list = document.getElementById('citasList');
    list.innerHTML = '<p style="text-align:center;color:var(--text-muted);">Cargando citas...</p>';

    try {
        const snap = await getDocs(collection(db, "citas"));
        list.innerHTML = '';

        if (snap.empty) {
            list.innerHTML = `<div class="empty-state"><div class="empty-state-icon">📅</div><p class="empty-state-text">No hay citas solicitadas</p></div>`;
            return;
        }

        snap.forEach(d => {
            const c = d.data();
            // Validar que tiene los campos esperados
            if (!c.customer || typeof c.customer !== 'object') return;

            const div = document.createElement('div');
            div.className = 'cita-card';

            // FIX #4: escapeHTML en todos los campos antes de insertar al DOM
            const name = escapeHTML(c.customer.name || 'Sin nombre');
            const contact = escapeHTML(c.customer.contact || 'No especificado');
            const email = escapeHTML(c.customer.email || 'No especificado');
            const message = escapeHTML(c.message || '');
            const time = escapeHTML(c.time || '');

            const initials = (c.customer.name || 'NN').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
            const fechaFormateada = c.date
                ? new Date(c.date + 'T12:00:00').toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
                : 'Fecha no especificada';

            div.innerHTML = `
                <div class="cita-card-header">
                    <div class="cita-card-customer">
                        <div class="cita-card-avatar">${escapeHTML(initials)}</div>
                        <div>
                            <div class="cita-card-name">${name}</div>
                            <div class="cita-card-datetime">
                                <span>📅</span>
                                <span>${escapeHTML(fechaFormateada)} ${time ? 'a las ' + time : ''}</span>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="cita-card-details">
                    <div class="cita-card-detail">
                        <span class="cita-card-label">📞 Teléfono</span>
                        <span class="cita-card-value">${contact}</span>
                    </div>
                    <div class="cita-card-detail">
                        <span class="cita-card-label">📧 Email</span>
                        <span class="cita-card-value">${email}</span>
                    </div>
                    ${message ? `<div class="cita-card-message"><span class="cita-card-label">📝 Mensaje</span><span class="cita-card-value">${message}</span></div>` : ''}
                </div>
                <div class="cita-card-actions">
                    <button class="delete-btn" data-id="${escapeHTML(d.id)}">🗑️ Eliminar Cita</button>
                </div>`;

            // FIX #4: Usar addEventListener en vez de onclick con el ID en el HTML
            div.querySelector('.delete-btn').addEventListener('click', () => deleteCita(d.id));
            list.appendChild(div);
        });
    } catch {
        list.innerHTML = '<p style="text-align:center;color:var(--danger);">Error al cargar las citas.</p>';
    }
}

async function deleteCita(id) {
    if (confirm('¿Eliminar esta cita?')) {
        try {
            await deleteDoc(doc(db, "citas", id));
            loadCitas();
        } catch {
            alert('Error al eliminar la cita.');
        }
    }
}

// ============================================
// WEBS
// ============================================
async function loadWebs() {
    const list = document.getElementById('websList');
    list.innerHTML = '<p style="text-align:center;color:var(--text-muted);">Cargando webs...</p>';

    try {
        const snap = await getDocs(collection(db, "webs"));

        if (snap.empty) {
            list.innerHTML = `<div class="empty-state"><div class="empty-state-icon">🌐</div><p class="empty-state-text">No hay webs registradas</p></div>`;
            return;
        }

        const grid = document.createElement('div');
        grid.className = 'webs-grid';

        snap.forEach(d => {
            const w = d.data();
            // FIX #4: escapeHTML en todos los datos antes de insertar al DOM
            const card = document.createElement('div');
            card.className = 'web-card';
            card.innerHTML = `
                <div class="web-card-header">
                    <h4 class="web-card-name">${escapeHTML(w.name)}</h4>
                    <span class="web-card-category">${escapeHTML(w.category)}</span>
                </div>
                <a href="${escapeHTML(w.url)}" target="_blank" rel="noopener noreferrer" class="web-card-url">
                    <span>🔗</span><span>${escapeHTML(w.url)}</span>
                </a>
                ${w.description
                    ? `<p class="web-card-description">${escapeHTML(w.description)}</p>`
                    : '<p class="web-card-description" style="font-style:italic;opacity:0.6;">Sin descripción</p>'}
                <div class="web-card-actions">
                    <button class="web-card-delete">
                        <span>🗑️</span><span>Eliminar</span>
                    </button>
                </div>`;

            // FIX #4: addEventListener en vez de onclick inline
            card.querySelector('.web-card-delete').addEventListener('click', () => deleteWeb(d.id));
            grid.appendChild(card);
        });

        list.innerHTML = '';
        list.appendChild(grid);
    } catch {
        list.innerHTML = '<p style="text-align:center;color:var(--danger);">Error al cargar las webs.</p>';
    }
}

document.getElementById('addWebForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const urlValue = document.getElementById('webUrl').value.trim();

    // FIX #6: Validar que la URL sea https
    if (!urlValue.startsWith('https://')) {
        alert('La URL debe comenzar con https://');
        return;
    }

    try {
        await addDoc(collection(db, "webs"), {
            name: document.getElementById('webName').value.trim(),
            url: urlValue,
            category: document.getElementById('webCategory').value.trim(),
            description: document.getElementById('webDescription').value.trim()
        });
        e.target.reset();
        loadWebs();
    } catch {
        alert('Error al guardar la web.');
    }
});

async function deleteWeb(id) {
    if (confirm('¿Eliminar esta web?')) {
        try {
            await deleteDoc(doc(db, "webs", id));
            loadWebs();
        } catch {
            alert('Error al eliminar la web.');
        }
    }
}

// ============================================
// EQUIPO
// ============================================
async function loadTeam() {
    const list = document.getElementById('teamList');
    list.innerHTML = '<p style="text-align:center;color:var(--text-muted);">Cargando equipo...</p>';

    try {
        const grid = document.createElement('div');
        grid.className = 'admins-grid';

        // Card del admin principal
        const mainInitials = MAIN_ADMIN_EMAIL.split('@')[0].slice(0, 2).toUpperCase();
        const mainCard = document.createElement('div');
        mainCard.className = 'admin-card';
        mainCard.innerHTML = `
            <div class="admin-card-avatar host">${escapeHTML(mainInitials)}</div>
            <div class="admin-card-info">
                <div class="admin-card-name">Administrador Principal</div>
                <div class="admin-card-email">${escapeHTML(MAIN_ADMIN_EMAIL)}</div>
                <span class="admin-card-role host">👑 Host</span>
            </div>`;
        grid.appendChild(mainCard);

        // Cards de admins adicionales
        const snap = await getDocs(collection(db, "admins"));
        snap.forEach(d => {
            const a = d.data();
            const initials = (a.name || a.email || 'AD').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
            const card = document.createElement('div');
            card.className = 'admin-card';
            card.innerHTML = `
                <div class="admin-card-avatar">${escapeHTML(initials)}</div>
                <div class="admin-card-info">
                    <div class="admin-card-name">${escapeHTML(a.name || 'Sin nombre')}</div>
                    <div class="admin-card-email">${escapeHTML(a.email)}</div>
                    <span class="admin-card-role admin">👤 Admin</span>
                </div>
                ${currentAdmin?.role === 'host' ? `
                <div class="admin-card-actions">
                    <button class="admin-card-delete" title="Eliminar admin">🗑️</button>
                </div>` : ''}`;

            if (currentAdmin?.role === 'host') {
                card.querySelector('.admin-card-delete').addEventListener('click', () => deleteAdmin(d.id));
            }
            grid.appendChild(card);
        });

        list.innerHTML = '';
        list.appendChild(grid);
    } catch {
        list.innerHTML = '<p style="text-align:center;color:var(--danger);">Error al cargar el equipo.</p>';
    }
}

document.getElementById('addAdminForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (currentAdmin?.role !== 'host') {
        alert('Solo el administrador principal puede agregar nuevos miembros.');
        return;
    }

    const name = document.getElementById('newAdminName').value.trim();
    const email = document.getElementById('newAdminEmail').value.trim().toLowerCase();

    // FIX #6: Validar email antes de guardar
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        alert('El correo electrónico no es válido.');
        return;
    }

    // FIX #2: Usar el email como ID del documento para que isAuthorizedAdmin() funcione correctamente
    // La regla de Firebase usa: exists(/admins/$(request.auth.token.email.lower()))
    try {
        await setDoc(doc(db, "admins", email), { name, email });
        e.target.reset();
        loadTeam();
    } catch {
        alert('Error al agregar el administrador.');
    }
});

async function deleteAdmin(id) {
    if (confirm('¿Quitar este administrador?')) {
        try {
            await deleteDoc(doc(db, "admins", id));
            loadTeam();
        } catch {
            alert('Error al eliminar el administrador.');
        }
    }
}

// ============================================
// VISIÓN Y MISIÓN
// ============================================
async function loadVisionMision() {
    const misionTextEl = document.getElementById('misionText');
    const visionTextEl = document.getElementById('visionText');
    if (!misionTextEl || !visionTextEl) return;

    try {
        const [misionDoc, visionDoc] = await Promise.all([
            getDoc(doc(db, "visionMision", "mision")),
            getDoc(doc(db, "visionMision", "vision"))
        ]);

        if (misionDoc.exists()) misionTextEl.value = misionDoc.data().content || "";
        if (visionDoc.exists()) visionTextEl.value = visionDoc.data().content || "";
    } catch {
        alert('Error al cargar la visión y misión.');
    }
}

document.getElementById('saveMisionForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const content = document.getElementById('misionText').value.trim();
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;

    try {
        await setDoc(doc(db, "visionMision", "mision"), {
            type: "mision",
            content,
            updatedAt: new Date().toISOString()
        });
        btn.textContent = '✅ Guardado';
        setTimeout(() => { btn.textContent = '💾 Guardar Misión'; btn.disabled = false; }, 2000);
    } catch {
        alert('Error al guardar la misión.');
        btn.disabled = false;
    }
});

document.getElementById('saveVisionForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const content = document.getElementById('visionText').value.trim();
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;

    try {
        await setDoc(doc(db, "visionMision", "vision"), {
            type: "vision",
            content,
            updatedAt: new Date().toISOString()
        });
        btn.textContent = '✅ Guardado';
        setTimeout(() => { btn.textContent = '💾 Guardar Visión'; btn.disabled = false; }, 2000);
    } catch {
        alert('Error al guardar la visión.');
        btn.disabled = false;
    }
});
