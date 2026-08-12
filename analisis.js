// ===================================
// VERIFICAR SESIÓN
// ===================================
document.addEventListener('DOMContentLoaded', () => {
    // Verificar sesión
    const session = localStorage.getItem('dataFinanciero_session');
    if (!session) {
        window.location.href = 'login.html';
        return;
    }
    
    const user = JSON.parse(session);
    const usernameElement = document.getElementById('username');
    if (usernameElement) {
        usernameElement.textContent = user.username || 'Usuario';
    }
    
    // Actualizar fecha y hora
    updateDateTime();
    setInterval(updateDateTime, 60000); // Actualizar cada minuto
});

// ===================================
// ACTUALIZAR FECHA Y HORA
// ===================================
function updateDateTime() {
    const now = new Date();
    const options = { 
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    };
    const formattedDate = now.toLocaleDateString('es-EC', options);
    
    const dateTimeElement = document.getElementById('currentDateTime');
    if (dateTimeElement) {
        dateTimeElement.textContent = formattedDate;
    }
}

// ===================================
// ABRIR REPORTE
// ===================================
function openReport(tipo) {
    console.log(`Abriendo reporte: ${tipo}`);
    
    // Aquí puedes redirigir a diferentes páginas o abrir modales
    switch(tipo) {
        case 'finanzas':
            // window.location.href = 'reporte-finanzas.html';
            showMessage('Abriendo reporte de Finanzas...', 'info');
            break;
        case 'ventas':
            showMessage('Abriendo reporte de Ventas...', 'info');
            break;
        case 'rrhh':
            showMessage('Abriendo reporte de Recursos Humanos...', 'info');
            break;
        case 'operaciones':
            showMessage('Abriendo reporte de Operaciones...', 'info');
            break;
        case 'riesgos':
            showMessage('Abriendo reporte de Riesgos...', 'info');
            break;
        case 'cumplimiento':
            showMessage('Abriendo reporte de Cumplimiento...', 'info');
            break;
        case 'compras':
            showMessage('Abriendo reporte de Compras...', 'info');
            break;
        case 'externos':
            window.open('https://www.superbancos.gob.ec', '_blank');
            break;
        default:
            console.log('Tipo de reporte no reconocido');
    }
}

// ===================================
// MOSTRAR MENSAJE (Toast notification)
// ===================================
function showMessage(message, type = 'info') {
    // Crear elemento toast
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <i class="fas fa-info-circle"></i>
        <span>${message}</span>
    `;
    
    // Estilos del toast
    toast.style.cssText = `
        position: fixed;
        top: 100px;
        right: 20px;
        background: white;
        padding: 15px 25px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        display: flex;
        align-items: center;
        gap: 10px;
        z-index: 9999;
        animation: slideIn 0.3s ease;
        font-family: 'Open Sans', sans-serif;
        font-size: 14px;
    `;
    
    // Agregar animación CSS
    if (!document.getElementById('toast-styles')) {
        const style = document.createElement('style');
        style.id = 'toast-styles';
        style.textContent = `
            @keyframes slideIn {
                from {
                    transform: translateX(400px);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
            @keyframes slideOut {
                from {
                    transform: translateX(0);
                    opacity: 1;
                }
                to {
                    transform: translateX(400px);
                    opacity: 0;
                }
            }
        `;
        document.head.appendChild(style);
    }
    
    document.body.appendChild(toast);
    
    // Remover después de 3 segundos
    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ===================================
// LOGOUT
// ===================================
function logout() {
    if (confirm('¿Estás seguro que deseas cerrar sesión?')) {
        localStorage.removeItem('dataFinanciero_session');
        window.location.href = 'login.html';
    }
}

// ===================================
// EFECTOS ADICIONALES
// ===================================

// Animación de entrada de tarjetas
document.addEventListener('DOMContentLoaded', () => {
    const cards = document.querySelectorAll('.report-card');
    
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry, index) => {
            if (entry.isIntersecting) {
                setTimeout(() => {
                    entry.target.style.opacity = '0';
                    entry.target.style.transform = 'translateY(30px)';
                    
                    setTimeout(() => {
                        entry.target.style.transition = 'all 0.5s ease';
                        entry.target.style.opacity = '1';
                        entry.target.style.transform = 'translateY(0)';
                    }, 50);
                    
                    observer.unobserve(entry.target);
                }, index * 100);
            }
        });
    }, observerOptions);
    
    cards.forEach(card => {
        card.style.opacity = '0';
        observer.observe(card);
    });
});

// Efecto de búsqueda con teclado (atajos)
document.addEventListener('keydown', (e) => {
    // Alt + 1-8 para acceder rápidamente a los reportes
    if (e.altKey) {
        const reportes = ['finanzas', 'ventas', 'rrhh', 'operaciones', 'riesgos', 'cumplimiento', 'compras', 'externos'];
        const index = parseInt(e.key) - 1;
        
        if (index >= 0 && index < reportes.length) {
            e.preventDefault();
            openReport(reportes[index]);
        }
    }
});