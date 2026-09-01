// ===================================
// CONFIGURACIÓN INICIAL
// ===================================
const DEFAULT_PASSWORD = 'N$data2026';
const STORAGE_KEY = 'dataFinanciero_users';
const SESSION_KEY = 'dataFinanciero_session';

// ===================================
// FUNCIONES DE UTILIDAD
// ===================================
function getUsers() {
    const users = localStorage.getItem(STORAGE_KEY);
    return users ? JSON.parse(users) : [];
}

function saveUsers(users) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(users));
}

function getCurrentUser() {
    const session = localStorage.getItem(SESSION_KEY);
    return session ? JSON.parse(session) : null;
}

function showModal(title, message, type = 'success', callback = null) {
    const overlay = document.getElementById('modalOverlay');
    const modalIcon = document.getElementById('modalIcon');
    const modalTitle = document.getElementById('modalTitle');
    const modalMessage = document.getElementById('modalMessage');
    const modalBtn = document.getElementById('modalBtn');
    
    if (!overlay) return;
    
    modalTitle.textContent = title;
    modalMessage.textContent = message;
    modalIcon.className = 'modal-icon ' + type;
    
    // Cambiar ícono según tipo
    const icons = {
        success: 'fa-check-circle',
        error: 'fa-exclamation-circle',
        warning: 'fa-exclamation-triangle',
        info: 'fa-info-circle'
    };
    modalIcon.innerHTML = `<i class="fas ${icons[type]}"></i>`;
    
    overlay.classList.add('active');
    
    modalBtn.onclick = () => {
        overlay.classList.remove('active');
        if (callback) callback();
    };
}

// ===================================
// ANIMACIÓN SLIDER DEL LOGIN
// ===================================
const signUpButton = document.getElementById('signUp');
const signInButton = document.getElementById('signIn');
const container = document.getElementById('container');

if (signUpButton && signInButton && container) {
    signUpButton.addEventListener('click', () => {
        container.classList.add('right-panel-active');
    });
    
    signInButton.addEventListener('click', () => {
        container.classList.remove('right-panel-active');
    });
}

// ===================================
// VALIDACIÓN DE PASSWORD
// ===================================
const regNewPassword = document.getElementById('regNewPassword');
const passwordStrength = document.getElementById('passwordStrength');

if (regNewPassword) {
    regNewPassword.addEventListener('input', (e) => {
        const value = e.target.value;
        passwordStrength.className = 'password-strength';
        
        if (value.length === 0) return;
        
        if (value.length < 6) {
            passwordStrength.classList.add('weak');
        } else if (value.length < 10 || !/[A-Z]/.test(value) || !/[0-9]/.test(value)) {
            passwordStrength.classList.add('medium');
        } else {
            passwordStrength.classList.add('strong');
        }
    });
}

// ===================================
// REGISTRO DE USUARIO
// ===================================
const signUpForm = document.getElementById('signUpForm');

if (signUpForm) {
    signUpForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const username = document.getElementById('regUsername').value.trim();
        const email = document.getElementById('regEmail').value.trim();
        const oldPassword = document.getElementById('regOldPassword').value;
        const newPassword = document.getElementById('regNewPassword').value;
        
        // Validar password provisional
        if (oldPassword !== DEFAULT_PASSWORD) {
            showModal('Error', 'El password provisional no es correcto. Contacte al administrador.', 'error');
            return;
        }
        
        // Validar que el nuevo password sea alfanumérico
        if (!/[a-zA-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
            showModal('Error', 'El nuevo password debe ser alfanumérico (contener letras y números).', 'error');
            return;
        }
        
        if (newPassword.length < 6) {
            showModal('Error', 'El nuevo password debe tener al menos 6 caracteres.', 'error');
            return;
        }
        
        // Verificar si el usuario ya existe
        const users = getUsers();
        const existingUser = users.find(u => u.username === username || u.email === email);
        
        if (existingUser) {
            showModal('Error', 'El usuario o correo ya está registrado.', 'error');
            return;
        }
        
        // Crear nuevo usuario
        const newUser = {
            username: username,
            email: email,
            password: newPassword,
            mustChangePassword: false,
            createdAt: new Date().toISOString()
        };
        
        users.push(newUser);
        saveUsers(users);
        
        console.log('✅ Usuario registrado:', newUser);
        
        showModal(
            '¡Cambio de clave con éxito!', 
            `Su cuenta ha sido registrada. Se ha enviado una confirmación a ${email}. Ahora puede iniciar sesión con su nueva clave.`,
            'success',
            () => {
                // Limpiar formulario y volver al panel de login
                signUpForm.reset();
                container.classList.remove('right-panel-active');
                console.log('🔄 Volviendo al formulario de login...');
            }
        );
    });
}

// ===================================
// LOGIN DE USUARIO
// ===================================
const signInForm = document.getElementById('signInForm');

if (signInForm) {
    signInForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const usernameOrEmail = document.getElementById('loginUsername').value.trim();
        const password = document.getElementById('loginPassword').value;
        
        const users = getUsers();
        const user = users.find(u => 
            (u.username === usernameOrEmail || u.email === usernameOrEmail) && 
            u.password === password
        );
        
        // Verificar si está intentando usar el password provisional
        const userExists = users.find(u => 
            u.username === usernameOrEmail || u.email === usernameOrEmail
        );
        
        if (userExists && password === DEFAULT_PASSWORD) {
            showModal(
                'Debe realizar el cambio de clave', 
                'Su cuenta aún tiene el password provisional. Por favor, haga clic en "Registrarse" para cambiar su clave antes de ingresar.',
                'warning',
                () => {
                    container.classList.add('right-panel-active');
                }
            );
            return;
        }
        
        // Verificar credenciales correctas
        if (!user) {
            showModal('Error', 'Usuario o password incorrectos.', 'error');
            return;
        }
        
        // Login exitoso - Guardar sesión
        localStorage.setItem(SESSION_KEY, JSON.stringify(user));
        console.log('✅ Sesión guardada:', user);
        
        // Mostrar modal de bienvenida y redirigir
        showModal(
            '¡Bienvenido!', 
            `Hola ${user.username}, ha iniciado sesión correctamente.`,
            'success',
            () => {
                console.log('🔄 Redirigiendo al dashboard...');
                // Usar setTimeout para asegurar que el modal se cierre primero
                setTimeout(() => {
                    window.location.href = 'dashboard.html';
                }, 300);
            }
        );
    });
}

// ===================================
// DASHBOARD
// ===================================
const welcomeModal = document.getElementById('welcomeModal');
const closeWelcomeModal = document.getElementById('closeWelcomeModal');
const welcomeUser = document.getElementById('welcomeUser');
const btnLogout = document.getElementById('btnLogout');

// Mostrar modal de bienvenida al cargar dashboard
if (welcomeModal) {
    const user = getCurrentUser();
    
    if (!user) {
        window.location.href = 'index.html';
    } else {
        welcomeUser.textContent = `Bienvenido, ${user.username}`;
        
        setTimeout(() => {
            welcomeModal.classList.add('active');
        }, 500);
    }
    
    if (closeWelcomeModal) {
        closeWelcomeModal.addEventListener('click', () => {
            welcomeModal.classList.remove('active');
        });
    }
}

// Logout
if (btnLogout) {
    btnLogout.addEventListener('click', () => {
        localStorage.removeItem(SESSION_KEY);
        window.location.href = 'index.html';
    });
}

// Abrir sector
function openSector(sector) {
    const sectorNames = {
        'macroeconomico': 'Entorno Macroeconómico',
        'financiero': 'Sistema Financiero Nacional',
        'tasas': 'Sistema de Tasas de Interés',
        'analisis': 'Análisis Financiero'
    };
    
    alert(`Abriendo sector: ${sectorNames[sector]}\n\n(Próximamente disponible)`);
}

// ===================================
// CREAR USUARIO ADMIN POR DEFECTO (solo primera vez)
// ===================================
(function initDefaultUser() {
    const users = getUsers();
    if (users.length === 0) {
        const adminUser = {
            username: 'admin',
            email: 'admin@datafinanciero.com',
            password: DEFAULT_PASSWORD,
            mustChangePassword: true,
            createdAt: new Date().toISOString()
        };
        users.push(adminUser);
        saveUsers(users);
        console.log('✅ Usuario admin creado con password provisional: N$data2026');
    }

    // ===================================
// RECUPERAR PASSWORD - MOSTRAR CREDENCIALES
// ===================================
const forgotLink = document.querySelector('.forgot-link');
const forgotModal = document.getElementById('forgotModal');
const credentialsModal = document.getElementById('credentialsModal');
const closeForgotModal = document.getElementById('closeForgotModal');
const closeCredentialsModal = document.getElementById('closeCredentialsModal');
const forgotForm = document.getElementById('forgotForm');
const forgotEmail = document.getElementById('forgotEmail');

// Abrir modal de recuperar password
if (forgotLink) {
    forgotLink.addEventListener('click', (e) => {
        e.preventDefault();
        if (forgotModal) {
            forgotModal.classList.add('active');
            forgotEmail.focus();
        }
    });
}

// Cerrar modal de recuperar password
if (closeForgotModal) {
    closeForgotModal.addEventListener('click', () => {
        if (forgotModal) {
            forgotModal.classList.remove('active');
            forgotForm.reset();
        }
    });
}

// Cerrar modal de credenciales
if (closeCredentialsModal) {
    closeCredentialsModal.addEventListener('click', () => {
        if (credentialsModal) {
            credentialsModal.classList.remove('active');
        }
    });
}

// Cerrar modales al hacer clic fuera
if (forgotModal) {
    forgotModal.addEventListener('click', (e) => {
        if (e.target === forgotModal) {
            forgotModal.classList.remove('active');
            forgotForm.reset();
        }
    });
}

if (credentialsModal) {
    credentialsModal.addEventListener('click', (e) => {
        if (e.target === credentialsModal) {
            credentialsModal.classList.remove('active');
        }
    });
}

// Procesar formulario de recuperación
if (forgotForm) {
    forgotForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const email = forgotEmail.value.trim().toLowerCase();
        
        if (!email) {
            showModal('Error', 'Por favor ingresa tu correo electrónico.', 'error');
            return;
        }
        
        const users = getUsers();
        const user = users.find(u => u.email.toLowerCase() === email);
        
        if (!user) {
            showModal(
                'Usuario no encontrado', 
                'No se encontró una cuenta asociada a este correo electrónico. Verifica el correo o contacta al administrador.',
                'error'
            );
            return;
        }
        
        // Mostrar credenciales en el modal
        document.getElementById('credUsername').textContent = user.username;
        document.getElementById('credPassword').textContent = user.password;
        document.getElementById('credEmail').textContent = user.email;
        
        // Cerrar modal de búsqueda y abrir modal de credenciales
        forgotModal.classList.remove('active');
        credentialsModal.classList.add('active');
        
        // Limpiar formulario
        forgotForm.reset();
        
        console.log('✅ Credenciales mostradas para:', user.email);
    });
}
})();