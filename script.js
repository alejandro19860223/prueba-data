// ===================================
// 1. CONFIGURACIÓN DE SUPABASE
// ===================================
// ️ REEMPLAZA ESTOS VALORES CON LOS TUYOS DE SUPABASE
const SUPABASE_URL = 'https://mxpseuoksbrqsecukqou.supabase.co'; 
const SUPABASE_ANON_KEY = 'sb_publishable_mGMXUplvTP0wCbGa7av4jg_Z01-xPaX'; // Tu publishable key

// Inicializar el cliente de Supabase
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ===================================
// 2. FUNCIONES DE UTILIDAD
// ===================================
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

// Obtener usuario actual de Supabase
async function getCurrentUser() {
    const { data: { session } } = await supabase.auth.getSession();
    return session ? session.user : null;
}

// ===================================
// 3. ANIMACIÓN SLIDER DEL LOGIN
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
// 4. VALIDACIÓN DE PASSWORD (Tu código original)
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
// 5. REGISTRO DE USUARIO
// ===================================
const signUpForm = document.getElementById('signUpForm');

if (signUpForm) {
    signUpForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const username = document.getElementById('regUsername').value.trim();
        const email = document.getElementById('regEmail').value.trim();
        const newPassword = document.getElementById('regNewPassword').value;
        
        // Validaciones
        if (!/[a-zA-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
            showModal('Error', 'El password debe ser alfanumérico (letras y números).', 'error');
            return;
        }
        if (newPassword.length < 6) {
            showModal('Error', 'El password debe tener al menos 6 caracteres.', 'error');
            return;
        }
        
        // Registrar en Supabase
        const { data, error } = await supabase.auth.signUp({
            email: email,
            password: newPassword,
            options: {
                data: {
                    username: username
                }
            }
        });

        if (error) {
            showModal('Error', error.message, 'error');
            return;
        }

        showModal(
            '¡Registro Exitoso!', 
            `La cuenta para ${email} ha sido creada. Ahora puedes iniciar sesión.`,
            'success',
            () => {
                signUpForm.reset();
                container.classList.remove('right-panel-active');
            }
        );
    });
}

// ===================================
// 6. LOGIN DE USUARIO
// ===================================
const signInForm = document.getElementById('signInForm');

if (signInForm) {
    signInForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const usernameOrEmail = document.getElementById('loginUsername').value.trim();
        const password = document.getElementById('loginPassword').value;
        
        const { data, error } = await supabase.auth.signInWithPassword({
            email: usernameOrEmail,
            password: password
        });

        if (error) {
            showModal('Error', 'Credenciales incorrectas. Verifica tu correo y password.', 'error');
            return;
        }

        showModal(
            '¡Bienvenido!', 
            `Hola ${data.user.user_metadata.username || data.user.email}, has iniciado sesión correctamente.`,
            'success',
            () => {
                setTimeout(() => {
                    window.location.href = 'dashboard.html';
                }, 300);
            }
        );
    });
}

// ===================================
// 7. RECUPERAR PASSWORD
// ===================================
const forgotLink = document.querySelector('.forgot-link');
const forgotModal = document.getElementById('forgotModal');
const credentialsModal = document.getElementById('credentialsModal');
const closeForgotModal = document.getElementById('closeForgotModal');
const closeCredentialsModal = document.getElementById('closeCredentialsModal');
const forgotForm = document.getElementById('forgotForm');
const forgotEmail = document.getElementById('forgotEmail');

if (forgotLink) {
    forgotLink.addEventListener('click', (e) => {
        e.preventDefault();
        if (forgotModal) {
            forgotModal.classList.add('active');
            forgotEmail.focus();
        }
    });
}

if (closeForgotModal) {
    closeForgotModal.addEventListener('click', () => {
        if (forgotModal) {
            forgotModal.classList.remove('active');
            forgotForm.reset();
        }
    });
}

if (closeCredentialsModal) {
    closeCredentialsModal.addEventListener('click', () => {
        if (credentialsModal) {
            credentialsModal.classList.remove('active');
        }
    });
}

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

if (forgotForm) {
    forgotForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = forgotEmail.value.trim().toLowerCase();
        
        if (!email) {
            showModal('Error', 'Por favor ingresa tu correo electrónico.', 'error');
            return;
        }
        
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: window.location.origin + '/index.html'
        });

        if (error) {
            showModal('Error', 'No se pudo procesar la solicitud. Verifica el correo.', 'error');
            return;
        }

        showModal(
            'Correo Enviado', 
            `Se ha enviado un enlace seguro a ${email} para restablecer tu contraseña.`,
            'success',
            () => {
                forgotModal.classList.remove('active');
                forgotForm.reset();
            }
        );
    });
}

// ===================================
// 8. FUNCIONES DEL DASHBOARD
// ===================================
const welcomeModal = document.getElementById('welcomeModal');
const closeWelcomeModal = document.getElementById('closeWelcomeModal');
const welcomeUser = document.getElementById('welcomeUser');
const btnLogout = document.getElementById('btnLogout');

if (welcomeModal) {
    (async () => {
        const user = await getCurrentUser();
        
        if (!user) {
            window.location.href = 'index.html';
        } else {
            welcomeUser.textContent = `Bienvenido, ${user.user_metadata.username || user.email}`;
            
            setTimeout(() => {
                welcomeModal.classList.add('active');
            }, 500);
        }
    })();
    
    if (closeWelcomeModal) {
        closeWelcomeModal.addEventListener('click', () => {
            welcomeModal.classList.remove('active');
        });
    }
}

if (btnLogout) {
    btnLogout.addEventListener('click', async () => {
        await supabase.auth.signOut();
        window.location.href = 'index.html';
    });
}

function openSector(sector) {
    const sectorNames = {
        'macroeconomico': 'Entorno Macroeconómico',
        'financiero': 'Sistema Financiero Nacional',
        'tasas': 'Sistema de Tasas de Interés',
        'analisis': 'Análisis Financiero'
    };
    
    alert(`Abriendo sector: ${sectorNames[sector]}\n\n(Próximamente disponible)`);
}