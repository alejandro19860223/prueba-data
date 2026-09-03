// ===================================
// TEMA PROFESIONAL PARA ECHARTS
// ===================================
const HERO_THEME = {
    color: ['#1e3a8a', '#2563eb', '#3b82f6', '#60a5fa', '#93c5fd', '#0ea5e9', '#0284c7', '#0369a1', '#075985', '#0c4a6e'],
    backgroundColor: 'transparent',
    textStyle: { fontFamily: "'Montserrat', 'Open Sans', sans-serif", fontSize: 12 },
    title: {
        textStyle: { fontFamily: "'Montserrat', sans-serif", fontWeight: 700, color: '#1e3a8a', fontSize: 14 },
        subtextStyle: { fontFamily: "'Open Sans', sans-serif", color: '#64748b', fontSize: 11 }
    },
    legend: {
        textStyle: { fontFamily: "'Open Sans', sans-serif", fontSize: 11, color: '#334155' }
    },
    tooltip: {
        backgroundColor: 'rgba(255,255,255,0.98)',
        borderColor: '#1e3a8a',
        borderWidth: 1,
        textStyle: { fontFamily: "'Open Sans', sans-serif", color: '#1e293b', fontSize: 12 },
        padding: [10, 14],
        shadowBlur: 10,
        shadowColor: 'rgba(0,0,0,0.1)'
    },
    dataZoom: [
        { type: 'inside', start: 0, end: 100 },
        {
            type: 'slider', show: true, start: 0, end: 100, height: 20, bottom: 10,
            borderColor: '#cbd5e1', fillerColor: 'rgba(30, 58, 138, 0.15)',
            handleStyle: { color: '#1e3a8a', borderColor: '#1e3a8a' },
            textStyle: { fontFamily: "'Open Sans', sans-serif", fontSize: 10, color: '#64748b' }
        }
    ],
    xAxis: {
        axisLine: { lineStyle: { color: '#cbd5e1' } },
        axisLabel: { fontFamily: "'Open Sans', sans-serif", color: '#475569', fontSize: 11 },
        splitLine: { show: false }
    },
    yAxis: {
        axisLine: { show: false },
        axisLabel: { fontFamily: "'Open Sans', sans-serif", color: '#475569', fontSize: 11 },
        splitLine: { lineStyle: { color: '#f1f5f9', type: 'dashed' } }
    },
    series: { lineStyle: { width: 2.5 }, symbolSize: 6, itemStyle: { borderWidth: 2 } }
};


// ===================================
// AGREGAR AL INICIO DEL ARCHIVO sistema.js
// ===================================

// Función para obtener el sector actual
function getSectorActual() {
    const sectorFilter = document.getElementById('sectorFilter');
    if (!sectorFilter) return { valor: 'nacional', texto: 'Sistema Financiero Nacional' };
    
    // Usar el texto de la opción seleccionada como identificador único
    const texto = sectorFilter.options[sectorFilter.selectedIndex].text;
    
    // Generar un valor único basado en el texto (limpiando espacios y caracteres especiales)
    const valor = texto.toLowerCase()
        .replace(/\s+/g, '_')
        .replace(/[^a-z0-9_]/g, '');
    
    console.log('🏦 Sector actual detectado:', { valor, texto });
    
    return {
        valor: valor,
        texto: texto
    };
}

// Función para crear ID único considerando sector
function crearIdUnico(cuadroId, variable, sector) {
    return `${cuadroId}_${sector}_${variable}`;
}


// ===================================
// FUNCIONALIDAD DEL ÁRBOL
// ===================================
function toggleNode(element) {
    const treeItem = element.parentElement;
    const toggleIcon = element.querySelector('.toggle-icon');
    const folderIcon = element.querySelector('.folder-icon');
    
    if (treeItem.classList.contains('collapsed')) {
        treeItem.classList.remove('collapsed');
        toggleIcon.textContent = '−';
        if (folderIcon) {
            folderIcon.classList.remove('fa-folder');
            folderIcon.classList.add('fa-folder-open');
        }
    } else {
        treeItem.classList.add('collapsed');
        toggleIcon.textContent = '+';
        if (folderIcon) {
            folderIcon.classList.remove('fa-folder-open');
            folderIcon.classList.add('fa-folder');
        }
    }
}

// ===================================
// TOGGLE DEL SIDEBAR (OVERLAY)
// ===================================
document.addEventListener('DOMContentLoaded', () => {
    const sidebarToggleBtn = document.getElementById('sidebarToggleBtn');
    const sidebarTree = document.getElementById('sidebarTree');
    const sidebarOverlay = document.getElementById('sidebarOverlay');
    const btnCloseSidebar = document.getElementById('btnCloseSidebar');
    
    if (sidebarToggleBtn) {
        sidebarToggleBtn.addEventListener('click', () => {
            sidebarTree.classList.add('open');
            sidebarOverlay.classList.add('active');
        });
    }
    
    if (btnCloseSidebar) {
        btnCloseSidebar.addEventListener('click', () => {
            sidebarTree.classList.remove('open');
            sidebarOverlay.classList.remove('active');
        });
    }
    
    if (sidebarOverlay) {
        sidebarOverlay.addEventListener('click', () => {
            sidebarTree.classList.remove('open');
            sidebarOverlay.classList.remove('active');
        });
    }
});

// ===================================
// CONFIGURACIÓN INICIAL
// ===================================
const DATA_PATHS = {
    sistema: 'data/base_estru_sistema.json',       // <-- TU ARCHIVO ORIGINAL
    listaEntidades: 'data/entidades_lista.json',   // El mapa que genera el script de R
    carpetaEntidades: 'data/entidades/',            // La carpeta con los JSON individuales
    balancesEntidades: 'data/balances/'            // La carpeta con los JSON de balances
};

const NOTAS_FILE = 'data/base_notas.json';
let allDataCache = [];
let tableData = [];
let currentCuadroId = '';
let currentChartType = 'line';
let currentChartRange = '5';
let selectedSeries = [];
let mainChart = null;
let expandedChart = null;
let singleChart = null;
let showLabels = false;
let notasData = {};
let balancesData = [];
let carteraData = [];
let entidadDataCache = {};  
let currentEntidadData = null; 
let entidadesMap = {}; 
let entidadBalancesDataCache = {}; // <-- NUEVA CACHÉ PARA NO REPETIR FETCH


// 1. Cargar el sistema consolidado al inicio
async function loadSistemaData() {
    console.log('🔄 Cargando datos consolidados del sistema...');
    try {
        const res = await fetch(DATA_PATHS.sistema); // <-- USA TU ARCHIVO ORIGINAL
        if (!res.ok) throw new Error('Error cargando el sistema');
        allDataCache = await res.json();
        console.log(`✅ Sistema cargado: ${allDataCache.length} filas`);
    } catch (error) {
        console.error('❌ Error cargando sistema:', error);
    }
}


// ===================================
// CARGAR BASE DE BALANCES
// ===================================
async function loadBalancesData() {
    console.log('🔄 Cargando base de balances...');
    try {
        const response = await fetch('data/base_balances.json');
        if (!response.ok) throw new Error('Error cargando base_balances.json');
        balancesData = await response.json();
        console.log(`✅ Balances cargados: ${balancesData.length} filas`);
        return balancesData;
    } catch (error) {
        console.error('❌ Error cargando balances:', error);
        return [];
    }
}

// ===================================
// CARGAR BASE DE CARTERA
// ===================================
async function loadCarteraData() {
    console.log('🔄 Cargando base de cartera...');
    try {
        const response = await fetch('data/base_cartera.json');
        if (!response.ok) throw new Error('Error cargando base_cartera.json');
        carteraData = await response.json();
        console.log(`✅ Cartera cargada: ${carteraData.length} filas`);
        return carteraData;
    } catch (error) {
        console.error('❌ Error cargando cartera:', error);
        return [];
    }
}

// ===================================
// CARGAR DATOS DE ENTIDAD ESPECÍFICA (BAJO DEMANDA)
// ===================================
async function loadEntidadData(entidadNombre) {
    // 1. Verificar si ya está en caché (para no descargarla dos veces)
    if (entidadDataCache[entidadNombre]) {
        console.log(`💾 Usando caché para: ${entidadNombre}`);
        return entidadDataCache[entidadNombre];
    }
    
    console.log(`🔄 Cargando datos bajo demanda de: ${entidadNombre}`);
    
    try {
        // 2. Crear nombre de archivo seguro (sin tildes ni caracteres raros)
        const nombreArchivo = entidadNombre
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '') 
            .replace(/[^A-Za-z0-9]/g, '_');                    
        
        // ✅ CORRECCIÓN: Usar DATA_PATHS.carpetaEntidades, no DATA_FILES
        const url = `${DATA_PATHS.carpetaEntidades}${nombreArchivo}.json`;
        
        const response = await fetch(url);
        if (!response.ok) throw new Error(`No se encontró el archivo: ${url}`);
        
        const data = await response.json();
        
        // 3. Guardar en caché para la próxima vez
        entidadDataCache[entidadNombre] = data;
        console.log(`✅ Entidad cargada exitosamente: ${data.length} filas`);
        
        return data;
    } catch (error) {
        console.error(`❌ Error cargando entidad ${entidadNombre}:`, error);
        return [];
    }
}


// ===================================
// CARGAR BALANCES DE ENTIDAD ESPECÍFICA (BAJO DEMANDA)
// ===================================
async function loadBalancesEntidadData(entidadNombre) {
    // 1. Verificar caché
    if (entidadBalancesDataCache[entidadNombre]) {
        console.log(`💾 Usando caché de balances para: ${entidadNombre}`);
        return entidadBalancesDataCache[entidadNombre];
    }
    
    console.log(`🔄 Cargando balances bajo demanda de: ${entidadNombre}`);
    
    try {
        // 2. Crear nombre de archivo seguro
        const nombreArchivo = entidadNombre
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '') 
            .replace(/[^A-Za-z0-9]/g, '_');                    
        
        const url = `${DATA_PATHS.balancesEntidades}${nombreArchivo}.json`;
        console.log(`📂 Intentando cargar desde: ${url}`);
        
        const response = await fetch(url);
        if (!response.ok) throw new Error(`No se encontró el archivo: ${url} (Status: ${response.status})`);
        
        const data = await response.json();
        
        // 3. Guardar en caché
        entidadBalancesDataCache[entidadNombre] = data;
        console.log(`✅ Balances de entidad cargados exitosamente: ${data.length} filas`);
        
        // 🔍 DEBUG: Mostrar un ejemplo de la primera fila para verificar estructura
        if (data.length > 0) {
            console.log('🔍 Ejemplo de primera fila cargada:', data[0]);
        }
        
        return data;
    } catch (error) {
        console.error(`❌ Error cargando balances de ${entidadNombre}:`, error);
        return [];
    }
}


// ===================================
// 🏦 CARGAR TABLA POR ENTIDAD FINANCIERA (OPTIMIZADA)
// ===================================
async function loadTableEfi(cuadroId) {
    console.log('🔄 Cargando tabla EFI:', cuadroId);
    
    showLoading();
    currentCuadroId = cuadroId;
    
    
    // Ocultar sector, mostrar entidad
    const sectorContainer = document.querySelector('.sector-selector label[for="sectorFilter"]');
    if (sectorContainer && sectorContainer.parentElement) {
        sectorContainer.parentElement.style.display = 'none';
    }

    const entidadContainer = document.getElementById('entidadFilterContainer');
    if (entidadContainer) {
        entidadContainer.classList.add('visible');
    }
    
    const analisisContainer = document.getElementById('analisisFilterContainer');
    if (analisisContainer) analisisContainer.classList.remove('visible');
    
    const carteraContainer = document.getElementById('carteraFilterContainer');
    if (carteraContainer) carteraContainer.classList.remove('visible');

    try {
        const entidadFilter = document.getElementById('entidadFilter');
        const searchInput = document.getElementById('entidadSearch');
        
        // ✅ CAMBIO: Valor por defecto 'BP. AMAZONAS'
        let entidadNombre = 'BP. AMAZONAS';
        
        // Si el filtro ya tiene un valor válido (diferente de 'todas' o vacío), lo respetamos
        if (entidadFilter && entidadFilter.value && entidadFilter.value !== 'todas') {
            entidadNombre = entidadFilter.value;
        } else if (entidadFilter) {
            // Si no, forzamos el valor por defecto en el selector y en el input de búsqueda
            entidadFilter.value = 'BP. AMAZONAS';
            if (searchInput) {
                searchInput.value = 'BP. AMAZONAS';
            }
        }
        
        console.log('🏦 Entidad seleccionada:', entidadNombre);
        
        // ✅ CARGAR SOLO LOS DATOS DE ESTA ENTIDAD
        if (entidadNombre === 'Todas las Entidades' || entidadNombre === 'todas') {
            // Usar datos SFN
            tableData = allDataCache.filter(row => row.Cuadro === cuadroId);
        } else {
            // Cargar datos específicos de la entidad
            currentEntidadData = await loadEntidadData(entidadNombre);
            tableData = currentEntidadData.filter(row => row.Cuadro === cuadroId);
        }
        
        console.log(`✅ Filas filtradas: ${tableData.length}`);
        
        if (tableData.length === 0) {
            const tableContainer = document.getElementById('tableContainer');
            if (tableContainer) {
                tableContainer.innerHTML = `
                    <div class="loading-table">
                        <i class="fas fa-exclamation-triangle"></i>
                        <p>No se encontraron datos para: ${entidadNombre}</p>
                        <p style="font-size: 0.75rem; color: #f59e0b; margin-top: 10px;">
                            Cuadro: ${cuadroId}
                        </p>
                    </div>
                `;
            }
            hideLoading();
            return;
        }
        
        // Actualizar títulos
        const titulo = tableData[0].Titulo_Cuadro;
        const contentTitle = document.getElementById('contentTitle');
        if (contentTitle) contentTitle.textContent = titulo;
        
        const unidad = tableData[0].Unidad;
        const contentSubtitle = document.getElementById('contentSubtitle');
        if (contentSubtitle && unidad) {
            contentSubtitle.textContent = `${unidad} - ${entidadNombre}`;
        }

        // Cerrar sidebar
        const sidebarTree = document.getElementById('sidebarTree');
        const sidebarOverlay = document.getElementById('sidebarOverlay');
        if (sidebarTree) sidebarTree.classList.remove('open');
        if (sidebarOverlay) sidebarOverlay.classList.remove('active');
        
        // Renderizar tabla
        renderTable();
        populatePeriodSelectors();
        updateCollectionPanel();
        mostrarNotas(cuadroId);

        console.log(`✅ TABLA EFI CARGADA: ${tableData.length} filas`);
        
    } catch (error) {
        console.error('❌ Error en loadTableEfi:', error);
    } finally {
        hideLoading();
    }
}

// ===================================
// CARGAR TABLA DESDE EL MENÚ (SFN)
// ===================================
async function loadTable(cuadroId) {
    console.log('🔄 Cargando tabla:', cuadroId);
    
    showLoading();
    currentCuadroId = cuadroId;
    selectedSeries = [];
    
    // ✅ RESTAURAR selector de sector (por si fue ocultado por EFI)
    const sectorContainer = document.querySelector('.sector-selector label[for="sectorFilter"]');
    if (sectorContainer && sectorContainer.parentElement) {
        sectorContainer.parentElement.style.display = 'flex';
    }

    // Ocultar filtros que no aplican a tablas regulares
    const analisisContainer = document.getElementById('analisisFilterContainer');
    if (analisisContainer) analisisContainer.classList.remove('visible');
    
    const carteraContainer = document.getElementById('carteraFilterContainer');
    if (carteraContainer) carteraContainer.classList.remove('visible');

    const entidadContainer = document.getElementById('entidadFilterContainer');
    if (entidadContainer) entidadContainer.classList.remove('visible');

    if (allDataCache.length === 0) {
        await loadSistemaData();
    }
    
    try {
        tableData = allDataCache.filter(row => row.Cuadro === cuadroId);
        
        try {
            const notasResponse = await fetch(NOTAS_FILE);
            if (notasResponse.ok) {
                const todasLasNotas = await notasResponse.json();
                const notasCuadro = todasLasNotas.filter(nota => nota.Cuadro === cuadroId);
                if (notasCuadro.length > 0) {
                    notasData[cuadroId] = notasCuadro;
                }
            }
        } catch (error) {
            console.warn('⚠️ No se pudieron cargar las notas:', error);
        }

        const tableContainer = document.getElementById('tableContainer');
        
        if (tableData.length === 0) {
            if (tableContainer) {
                tableContainer.innerHTML = `
                    <div class="loading-table">
                        <i class="fas fa-exclamation-triangle"></i>
                        <p>No se encontraron datos para: ${cuadroId}</p>
                    </div>
                `;
            }
            hideLoading();
            return;
        }
        
        const titulo = tableData[0].Titulo_Cuadro;
        const contentTitle = document.getElementById('contentTitle');
        if (contentTitle) contentTitle.textContent = titulo;
        
        const unidad = tableData[0].Unidad;
        const contentSubtitle = document.getElementById('contentSubtitle');
        if (contentSubtitle && unidad) contentSubtitle.textContent = unidad;

        const sidebarTree = document.getElementById('sidebarTree');
        const sidebarOverlay = document.getElementById('sidebarOverlay');
        if (sidebarTree) sidebarTree.classList.remove('open');
        if (sidebarOverlay) sidebarOverlay.classList.remove('active');
        
        renderTable();
        populatePeriodSelectors();
        updateCollectionPanel();
        mostrarNotas(cuadroId);

        console.log(`✅ Datos cargados: ${tableData.length} filas`);
        
    } catch (error) {
        console.error('❌ Error:', error);
        const tableContainer = document.getElementById('tableContainer');
        if (tableContainer) {
            tableContainer.innerHTML = `
                <div class="loading-table">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>Error al cargar datos: ${error.message}</p>
                </div>
            `;
        }
    } finally {
        hideLoading();
    }
}

// ===================================
// 🏦 CARGAR TABLA DE CARTERA POR ENTIDAD FINANCIERA (EFI)
// ===================================
async function loadCarteraTableEfi(cuadroId) {
    console.log('🔄 Cargando tabla de cartera EFI:', cuadroId);
    
    showLoading();
    currentCuadroId = cuadroId;
    
    // 1. Manejo de visibilidad de filtros
    const sectorContainer = document.querySelector('.sector-selector label[for="sectorFilter"]');
    if (sectorContainer && sectorContainer.parentElement) {
        sectorContainer.parentElement.style.display = 'none';
    }

    const entidadContainer = document.getElementById('entidadFilterContainer');
    if (entidadContainer) {
        entidadContainer.classList.add('visible');
    }
    
    // Mostrar filtro de cartera
    const carteraContainer = document.getElementById('carteraFilterContainer');
    if (carteraContainer) carteraContainer.classList.add('visible');
    
    // Ocultar filtro de análisis
    const analisisContainer = document.getElementById('analisisFilterContainer');
    if (analisisContainer) analisisContainer.classList.remove('visible');

    try {
        // 2. Obtener entidad seleccionada
        const entidadFilter = document.getElementById('entidadFilter');
        let entidadNombre = 'BP. AMAZONAS'; // Valor por defecto
        
        if (entidadFilter && entidadFilter.value && entidadFilter.value !== 'todas') {
            entidadNombre = entidadFilter.value;
        } else if (entidadFilter) {
            entidadFilter.value = 'BP. AMAZONAS';
        }
        
        // 3. Obtener tipo de crédito seleccionado
        const carteraFilter = document.getElementById('carteraFilter');
        const tipoCreditoValor = carteraFilter ? carteraFilter.value : 'total';
        
        const tipoCreditoMap = {
            'prod': 'Productivo',
            'consumo': 'Consumo',
            'inmo': 'Inmobiliario',
            'vips': 'Vivienda interés Público y Social',
            'edu': 'Educativo',
            'micro': 'Microcrédito'
        };
        
        const tipoCreditoTexto = tipoCreditoMap[tipoCreditoValor] || 'Cartera Total';
        
        console.log(`🏦 Entidad: ${entidadNombre} | Tipo Crédito: ${tipoCreditoTexto}`);
        
        // 4. Cargar datos bajo demanda desde carpetaEntidades
        const dataEntidad = await loadEntidadData(entidadNombre);
        
        if (dataEntidad.length === 0) {
            console.warn(`️ La entidad "${entidadNombre}" no devolvió datos.`);
        }
        
        // 5. Filtrar por Cuadro y tipo de crédito
        tableData = dataEntidad.filter(row => {
            const matchCuadro = row.Cuadro === cuadroId;
            const idRow = row.ID || '';
            const matchTipoCredito = idRow === tipoCreditoTexto;
            return matchCuadro && matchTipoCredito;
        });
        
        console.log(`📊 Filas después del filtro: ${tableData.length}`);
        
        if (tableData.length === 0) {
            const tableContainer = document.getElementById('tableContainer');
            if (tableContainer) {
                tableContainer.innerHTML = `
                    <div class="loading-table">
                        <i class="fas fa-exclamation-triangle"></i>
                        <p>No se encontraron datos de cartera para: ${entidadNombre}</p>
                        <p style="font-size: 0.75rem; color: #f59e0b; margin-top: 10px;">
                            Cuadro: ${cuadroId} | Tipo: ${tipoCreditoTexto}
                        </p>
                    </div>
                `;
            }
            hideLoading();
            return;
        }
        
        // 6. Actualizar títulos
        const titulo = tableData[0].Titulo_Cuadro || 'Cartera de Créditos';
        const contentTitle = document.getElementById('contentTitle');
        if (contentTitle) contentTitle.textContent = titulo;
        
        const unidad = tableData[0].Unidad || '';
        const contentSubtitle = document.getElementById('contentSubtitle');
        if (contentSubtitle) {
            const tipoCreditoDisplay = carteraFilter ? carteraFilter.options[carteraFilter.selectedIndex].text : tipoCreditoTexto;
            contentSubtitle.textContent = `${unidad} - ${tipoCreditoDisplay} - ${entidadNombre}`;
        }

        // 7. Cerrar sidebar y renderizar
        const sidebarTree = document.getElementById('sidebarTree');
        const sidebarOverlay = document.getElementById('sidebarOverlay');
        if (sidebarTree) sidebarTree.classList.remove('open');
        if (sidebarOverlay) sidebarOverlay.classList.remove('active');
        
        renderTable();
        populatePeriodSelectors();
        updateCollectionPanel();
        mostrarNotas(cuadroId);
        
        console.log(`✅ Cartera EFI cargada: ${tableData.length} filas`);
        
    } catch (error) {
        console.error('❌ Error en loadCarteraTableEfi:', error);
        const tableContainer = document.getElementById('tableContainer');
        if (tableContainer) {
            tableContainer.innerHTML = `
                <div class="loading-table">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>Error al cargar datos: ${error.message}</p>
                </div>
            `;
        }
    } finally {
        hideLoading();
    }
}


// ===================================
// CARGAR TABLA DE CARTERA DE CRÉDITOS
// ===================================
async function loadCarteraTable(cuadroId) {
    console.log('🔄 Cargando tabla de cartera:', cuadroId);
    
    showLoading();
    currentCuadroId = cuadroId;

    
    // ✅ RESTAURAR selector de sector
    const sectorContainer = document.querySelector('.sector-selector label[for="sectorFilter"]');
    if (sectorContainer && sectorContainer.parentElement) {
        sectorContainer.parentElement.style.display = 'flex';
    }

    // Mostrar filtro de cartera
    const carteraContainer = document.getElementById('carteraFilterContainer');
    if (carteraContainer) carteraContainer.classList.add('visible');
    
    // Ocultar filtro de análisis
    const analisisContainer = document.getElementById('analisisFilterContainer');
    if (analisisContainer) analisisContainer.classList.remove('visible');
    
    // Ocultar filtro de entidad
    const entidadContainer = document.getElementById('entidadFilterContainer');
    if (entidadContainer) entidadContainer.classList.remove('visible');
    
    if (carteraData.length === 0) {
        await loadCarteraData();
    }
    
    try {
        const datosCuadro = carteraData.filter(row => row.Cuadro === cuadroId);
        
        const sectorFilter = document.getElementById('sectorFilter');
        const carteraFilter = document.getElementById('carteraFilter');
        
        const sectorValor = sectorFilter ? sectorFilter.value : 'nacional';
        const tipoCreditoValor = carteraFilter ? carteraFilter.value : 'total';
        
        const tipoCreditoMap = {
            'prod': 'Productivo',
            'consumo': 'Consumo',
            'inmo': 'Inmobiliario',
            'vips': 'Vivienda interés Público y Social',
            'edu': 'Educativo',
            'micro': 'Microcrédito'
        };
        
        const tipoCreditoTexto = tipoCreditoMap[tipoCreditoValor] || 'Cartera Total';
        
        tableData = datosCuadro.filter(row => {
            const filtroRow = row.Filtro || '';
            const idRow = row.ID || '';
            
            const matchSector = filtrarPorSector(filtroRow, sectorValor);
            const matchTipoCredito = idRow === tipoCreditoTexto;
            
            return matchSector && matchTipoCredito;
        });
        
        const tableContainer = document.getElementById('tableContainer');
        
        if (tableData.length === 0) {
            if (tableContainer) {
                tableContainer.innerHTML = `
                    <div class="loading-table">
                        <i class="fas fa-exclamation-triangle"></i>
                        <p>No se encontraron datos para los filtros seleccionados</p>
                        <p style="font-size: 0.8rem; margin-top: 5px;">Sector: ${sectorValor} | Tipo: ${tipoCreditoTexto}</p>
                    </div>
                `;
            }
            hideLoading();
            return;
        }
        
        try {
            const notasResponse = await fetch(NOTAS_FILE);
            if (notasResponse.ok) {
                const todasLasNotas = await notasResponse.json();
                const notasCuadro = todasLasNotas.filter(nota => nota.Cuadro === cuadroId);
                if (notasCuadro.length > 0) {
                    notasData[cuadroId] = notasCuadro;
                }
            }
        } catch (error) {
            console.warn('⚠️ No se pudieron cargar las notas:', error);
        }
        
        const titulo = tableData[0].Titulo_Cuadro;
        const contentTitle = document.getElementById('contentTitle');
        if (contentTitle) contentTitle.textContent = titulo;
        
        const unidad = tableData[0].Unidad;
        const contentSubtitle = document.getElementById('contentSubtitle');
        if (contentSubtitle && unidad) {
            const tipoCreditoTextoDisplay = carteraFilter ? carteraFilter.options[carteraFilter.selectedIndex].text : 'Cartera Total';
            contentSubtitle.textContent = `${unidad} - ${tipoCreditoTextoDisplay}`;
        }

        const sidebarTree = document.getElementById('sidebarTree');
        const sidebarOverlay = document.getElementById('sidebarOverlay');
        if (sidebarTree) sidebarTree.classList.remove('open');
        if (sidebarOverlay) sidebarOverlay.classList.remove('active');
        
        renderTable();
        populatePeriodSelectors();
        updateCollectionPanel();
        mostrarNotas(cuadroId);
        
        console.log(`✅ Cartera cargada: ${tableData.length} filas`);
        
    } catch (error) {
        console.error('❌ Error:', error);
        const tableContainer = document.getElementById('tableContainer');
        if (tableContainer) {
            tableContainer.innerHTML = `
                <div class="loading-table">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>Error al cargar datos: ${error.message}</p>
                </div>
            `;
        }
    } finally {
        hideLoading();
    }
}

// ===================================
// CARGAR TABLA DE BALANCES
// ===================================
async function loadBalancesTable(cuadroId) {
    console.log('🔄 Cargando tabla de balances:', cuadroId);
    
    showLoading();
    currentCuadroId = cuadroId;
    
    // ✅ RESTAURAR selector de sector
    const sectorContainer = document.querySelector('.sector-selector label[for="sectorFilter"]');
    if (sectorContainer && sectorContainer.parentElement) {
        sectorContainer.parentElement.style.display = 'flex';
    }

    const carteraContainer = document.getElementById('carteraFilterContainer');
    if (carteraContainer) carteraContainer.classList.remove('visible');
    
    const analisisContainer = document.getElementById('analisisFilterContainer');
    if (analisisContainer) analisisContainer.classList.add('visible');
    
    const entidadContainer = document.getElementById('entidadFilterContainer');
    if (entidadContainer) entidadContainer.classList.remove('visible');

    if (balancesData.length === 0) {
        await loadBalancesData();
    }
    
    try {
        const sectorFilter = document.getElementById('sectorFilter');
        const analisisFilter = document.getElementById('analisisFilter');
        
        const sectorValor = sectorFilter ? sectorFilter.value : 'nacional';
        const analisisValor = analisisFilter ? analisisFilter.value : 'saldo';
         
        const idMap = {
            'saldo': 'Saldo Millones USD',
            'horizontal': 'Análisis Horizontal (%)',
            'vertical': 'Análisis Vertical (%)'
        };
        
        const targetId = idMap[analisisValor];
        
        tableData = balancesData.filter(row => {
            const matchCuadro = row.Cuadro === cuadroId;
            const matchId = row.ID === targetId;
            const filtroRow = row.Filtro || '';
            
            const matchSector = filtrarPorSector(filtroRow, sectorValor);
            
            return matchCuadro && matchId && matchSector;
        });
        
        const tableContainer = document.getElementById('tableContainer');
        
        if (tableData.length === 0) {
            if (tableContainer) {
                tableContainer.innerHTML = `
                    <div class="loading-table">
                        <i class="fas fa-exclamation-triangle"></i>
                        <p>No se encontraron datos para los filtros seleccionados</p>
                    </div>
                `;
            }
            hideLoading();
            return;
        }
        
        const titulo = tableData[0].Titulo_Cuadro || 'Balances del Sistema Financiero';
        const contentTitle = document.getElementById('contentTitle');
        if (contentTitle) contentTitle.textContent = titulo;
        
        const unidad = tableData[0].Unidad || '';
        const contentSubtitle = document.getElementById('contentSubtitle');
        if (contentSubtitle) {
            const analisisTexto = analisisFilter ? analisisFilter.options[analisisFilter.selectedIndex].text : '';
            contentSubtitle.textContent = `${unidad} - ${analisisTexto}`;
        }

        renderBalancesTableOptimized();
        populatePeriodSelectors();
        updateCollectionPanel();
        
        console.log(`✅ Balances cargados: ${tableData.length} filas`);
        
    } catch (error) {
        console.error('❌ Error:', error);
        const tableContainer = document.getElementById('tableContainer');
        if (tableContainer) {
            tableContainer.innerHTML = `
                <div class="loading-table">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>Error al cargar datos: ${error.message}</p>
                </div>
            `;
        }
    } finally {
        hideLoading();
    }
}

// ===================================
// FUNCIONES DE LOADING
// ===================================
function showLoading() {
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) {
        loadingOverlay.classList.add('active');
    }
}

function hideLoading() {
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) {
        loadingOverlay.classList.remove('active');
    }
}


// ===================================
// ✅ CORRECCIÓN: Filtrado correcto para TODOS los sectores
// ===================================
function filtrarPorSector(filtroRow, sectorValor) {
    // Mapeo de sectores a texto exacto en Filtro
    const sectorMap = {
        'nacional': 'Sistema Financiero Nacional (privado y eps)',
        'privado': 'Sector Financiero Privado',
        'popular': 'Sector Financiero Popular y Solidario',
        'grande': 'Bancos Privados Grandes',
        'medianos': 'Bancos Privados Medianos',
        'peque': 'Bancos Privados Pequeños',
        'seg1': 'Coop. Segmento 1',
        'seg2': 'Coop. Segmento 2',
        'seg3': 'Coop. Segmento 3',
        'mut': 'Asociación Mutualistas de Ahorro y Crédito para la Vivienda'
    };
    
    const textoBuscado = sectorMap[sectorValor];
    
    if (!textoBuscado) {
        console.warn('⚠️ Sector no reconocido:', sectorValor);
        return true; // Si no hay mapeo, mostrar todo
    }
    
    // Coincidencia exacta o que contenga el texto
    return filtroRow === textoBuscado || filtroRow.includes(textoBuscado);
}

// En loadBalancesTable - reemplazar la sección del filtrado:
const sectorValor = sectorFilter ? sectorFilter.value : 'nacional';
const analisisValor = analisisFilter ? analisisFilter.value : 'saldo';

const idMap = {
    'saldo': 'Saldo Millones USD',
    'horizontal': 'Análisis Horizontal (%)',
    'vertical': 'Análisis Vertical (%)'
};

const targetId = idMap[analisisValor];

tableData = balancesData.filter(row => {
    const matchCuadro = row.Cuadro === cuadroId;
    const matchId = row.ID === targetId;
    const filtroRow = row.Filtro || '';
    
    // ✅ USAR FUNCIÓN DE FILTRADO ACTUALIZADA
    const matchSector = filtrarPorSector(filtroRow, sectorValor);
    
    return matchCuadro && matchId && matchSector;
});


// ===================================
// RENDERIZAR TABLA NORMAL - VERSIÓN CORREGIDA
// ===================================
function renderTable() {
    const container = document.getElementById('tableContainer');
    if (!container) return;
    
    console.log('📊 Renderizando tabla...', {
        cuadroId: currentCuadroId,
        totalFilas: tableData.length,
        esEFI: currentCuadroId.endsWith('02') // ✅ DETECTA TEA02, TPE02
    });
    
    let filteredData = tableData;

    // ✅ DETECTAR si es modo entidad (por cuadro ID o por contenedor visible)
    const entidadContainer = document.getElementById('entidadFilterContainer');
    const esModoEntidad = entidadContainer && entidadContainer.classList.contains('visible');
    
    // ✅ SOLO aplicar filtro de sector si NO es modo entidad
    if (!esModoEntidad) {
        const sectorFilter = document.getElementById('sectorFilter');
        if (sectorFilter && sectorFilter.value) {
            console.log('🔍 Aplicando filtro de sector:', sectorFilter.value);
            filteredData = tableData.filter(row => {
                const filtroRow = row.Filtro || '';
                const filtroSeleccionado = sectorFilter.value;
                return filtrarPorSector(filtroRow, filtroSeleccionado);
            });
        }
    } else {
        console.log('⏭️ Saltando filtro de sector (modo entidad)');
    }
    
    const firstRow = filteredData[0];
    if (!firstRow) {
        console.error('❌ No hay datos después del filtrado');
        console.log('📋 Datos originales:', tableData.length, 'filas');
        console.log('📋 Datos filtrados:', filteredData.length, 'filas');
        if (tableData.length > 0) {
            console.log('🔍 Ejemplo de primera fila:', tableData[0]);
        }
        container.innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-triangle"></i><h3>No hay datos para el sector seleccionado</h3></div>`;
        return;
    }
    
    console.log(`✅ Datos para renderizar: ${filteredData.length} filas`);
    
    const allColumns = Object.keys(firstRow);
    const dateColumns = allColumns.filter(col => 
        /^\d{4}-\d{2}$/.test(col) || /^\d{4}-T\d$/.test(col) || /^\d{4}$/.test(col)
    ).sort();
    
    const fromSelect = document.getElementById('periodFrom');
    const toSelect = document.getElementById('periodTo');
    let filteredColumns = dateColumns;
    
    if (fromSelect && toSelect && fromSelect.value && toSelect.value) {
        filteredColumns = dateColumns.filter(col => col >= fromSelect.value && col <= toSelect.value);
    }
    
    if (filteredColumns.length === 0) {
        container.innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-triangle"></i><h3>Sin datos</h3></div>`;
        return;
    }
    
    // Guardar el índice ORIGINAL en tableData
    const rowsWithLevel = filteredData.map((row) => {
        let nivel = 0;
        if (row.Nivel1 && row.Nivel1.toString().trim() !== '') nivel = 1;
        if (row.Nivel2 && row.Nivel2.toString().trim() !== '') nivel = 2;
        if (row.Nivel3 && row.Nivel3.toString().trim() !== '') nivel = 3;
        if (row.Nivel4 && row.Nivel4.toString().trim() !== '') nivel = 4;
        if (row.Nivel5 && row.Nivel5.toString().trim() !== '') nivel = 5;
        if (row.Nivel6 && row.Nivel6.toString().trim() !== '') nivel = 6;
        if (row.Nivel7 && row.Nivel7.toString().trim() !== '') nivel = 7;
        
        const originalIndex = tableData.indexOf(row);
        return { index: originalIndex, row, nivel };
    });
    
    const groups = {};
    rowsWithLevel.forEach(item => {
        const groupName = item.row.Grupo || 'Sin Grupo';
        if (!groups[groupName]) groups[groupName] = [];
        groups[groupName].push(item);
    });
    
    let html = `
        <div class="table-wrapper">
            <table class="data-table">
                <thead>
                    <tr>
                        <th style="width: 50px;">Selec.</th>
                        <th style="width: 50px;">Graf.</th>
                        <th style="width: 50px;">Carrito</th>
                        <th>Variable</th>
                        ${filteredColumns.map(col => {
                            let displayCol = col;
                            if (/^\d{4}-\d{2}$/.test(col)) {
                                const [year, month] = col.split('-');
                                const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
                                displayCol = `${months[parseInt(month)-1]} ${year}`;
                            } else if (/^\d{4}-T\d$/.test(col)) {
                                const [year, quarter] = col.split('-');
                                displayCol = `${quarter} ${year}`;
                            }
                            return `<th class="year-header">${displayCol}</th>`;
                        }).join('')}
                    </tr>
                </thead>
                <tbody>
    `;
    
    Object.keys(groups).forEach(groupName => {
        html += `<tr class="group-header"><td colspan="${4 + filteredColumns.length}"><i class="fas fa-folder-open"></i> ${groupName}</td></tr>`;
        
        groups[groupName].forEach(item => {
            const rowIndex = item.index;
            const row = item.row;
            const nivel = item.nivel;
            const indentPx = nivel * 20;
            
            let icono = '';
            if (nivel === 0) icono = '<i class="fas fa-file-alt"></i>';
            else if (nivel === 1) icono = '<i class="fas fa-folder"></i>';
            else if (nivel === 2) icono = '<i class="fas fa-folder-open"></i>';
            else if (nivel === 3) icono = '<i class="fas fa-caret-right"></i>';
            else if (nivel === 4) icono = '<i class="fas fa-angle-right"></i>';
            else if (nivel === 5) icono = '<i class="fas fa-chevron-right"></i>';
            else icono = '<i class="fas fa-minus"></i>';
            
            const nivelClass = nivel > 0 ? `nivel-${nivel}` : '';
            
            html += `
                <tr class="fila-nivel ${nivelClass}" data-nivel="${nivel}">
                    <td><input type="checkbox" class="custom-checkbox" data-index="${rowIndex}" onchange="toggleSeriesCheckbox(this)"></td>
                    <td><button class="btn-action btn-chart" onclick="chartSingleSeries(${rowIndex})"><i class="fas fa-chart-line"></i></button></td>
                    <td><button class="btn-action btn-cart-add" onclick="agregarAlCarrito(${rowIndex})"><i class="fas fa-cart-plus"></i></button></td>
                    <td class="variable-name" style="padding-left: ${indentPx + 15}px;">${icono} <span>${row.Variable}</span></td>
                    ${filteredColumns.map(col => {
                        const valor = row[col];
                        const display = (valor === null || valor === undefined || valor === '' || valor === '-') ? '-' : formatNumber(valor);
                        return `<td class="year-value ${nivelClass}">${display}</td>`;
                    }).join('')}
                </tr>
            `;
        });
    });
    
    html += `</tbody></table></div>`;
    container.innerHTML = html;
    console.log('✅ Tabla renderizada correctamente');
}

// ===================================
// 🚀 RENDERIZAR TABLA DE BALANCES - VERSIÓN FINAL CON COLUMNA SEPARADA
// ===================================
function renderBalancesTableOptimized() {
    // ✅ DETECTAR si estamos en modo EFI
    const entidadContainer = document.getElementById('entidadFilterContainer');
    const esModoEntidad = entidadContainer && entidadContainer.classList.contains('visible');
    
    // ✅ APLICAR FILTRADO DE SECTOR SOLO si NO es modo EFI
    const sectorFilter = document.getElementById('sectorFilter');
    let validTableData = tableData.filter(row => row.Variable !== undefined && row.Variable !== null);

    // ✅ SOLO aplicar filtro de sector si NO es una tabla EFI
    if (!esModoEntidad && sectorFilter && sectorFilter.value) {
        validTableData = validTableData.filter(row => {
            const filtroRow = row.Filtro || '';
            const filtroSeleccionado = sectorFilter.value;
            
            // ✅ USAR FUNCIÓN DE FILTRADO ACTUALIZADA
            return filtrarPorSector(filtroRow, filtroSeleccionado);
        });
    }
    
    console.log('🔍 Datos de balances:', validTableData.length, 'filas', esModoEntidad ? '(modo EFI)' : '(modo SFN)');
 
    const container = document.getElementById('tableContainer');
    if (!container) return;
    
    const firstRow = validTableData[0];
    if (!firstRow) {
        container.innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-triangle"></i><h3>Sin datos válidos</h3></div>`;
        return;
    }

    const allColumns = Object.keys(firstRow);
    const dateColumns = allColumns.filter(col => 
        /^\d{4}-\d{2}$/.test(col) || /^\d{4}-T\d$/.test(col) || /^\d{4}$/.test(col)
    ).sort();
    
    const fromSelect = document.getElementById('periodFrom');
    const toSelect = document.getElementById('periodTo');
    let filteredColumns = dateColumns;
    
    if (fromSelect && toSelect && fromSelect.value && toSelect.value) {
        filteredColumns = dateColumns.filter(col => col >= fromSelect.value && col <= toSelect.value);
    }
    
    if (filteredColumns.length === 0) {
        container.innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-triangle"></i><h3>Sin datos</h3></div>`;
        return;
    }
    
    // ✅ PASO 1: Construir mapa de filas y jerarquía
    const rowMap = new Map();
    const childrenMap = new Map();
    
    // Indexar TODAS las filas
    validTableData.forEach((row, idx) => {
        if (!row || !row.Variable) return;
        
        const nivel = parseInt(row.Nivel) || 1;
        const id = row.Codigo_Base ? row.Codigo_Base.toString().trim() : '';
        
        const uniqueKey = `row_${idx}`;
        
        rowMap.set(uniqueKey, { row, idx, nivel, id, key: uniqueKey });
        childrenMap.set(uniqueKey, []);
    });
    
    // Encontrar relaciones padre-hijo
    let parentChildCount = 0;
    
    validTableData.forEach((row, idx) => {
        if (!row || !row.Variable) return;
        
        const nivel = parseInt(row.Nivel) || 1;
        const id = row.Codigo_Base ? row.Codigo_Base.toString().trim() : '';
        const currentKey = `row_${idx}`;
        
        if (nivel <= 1) return;
        
        let parentKey = null;
        const parentNivel = nivel - 1;
        
        for (const [key, data] of rowMap) {
            if (data.nivel === parentNivel && 
                data.row.Cuadro === row.Cuadro &&
                data.row.Filtro === row.Filtro) {
                
                const parentId = data.id.toString();
                const childId = id.toString();
                
                if (childId.startsWith(parentId) && childId !== parentId) {
                    if (!parentKey || data.nivel > rowMap.get(parentKey).nivel) {
                        parentKey = key;
                    }
                }
            }
        }
        
        if (parentKey) {
            childrenMap.get(parentKey).push(currentKey);
            parentChildCount++;
        }
    });
    
    console.log(`✅ Relaciones padre-hijo encontradas: ${parentChildCount}`);
    
    // Guardar en variables globales
    window._balancesChildrenMap = childrenMap;
    window._balancesRowMap = rowMap;
    window._balancesFilteredColumns = filteredColumns;
    
    // ✅ PASO 2: Generar HTML
    let html = `
        <div class="table-wrapper">
            <table class="data-table" id="balancesTable">
                <thead>
                    <tr>
                        <th style="width: 40px;"></th>
                        <th style="width: 50px;">Selec.</th>
                        <th style="width: 50px;">Graf.</th>
                        <th style="width: 50px;">Carrito.</th>
                        <th>Cuenta Contable</th>
                        ${filteredColumns.map(col => {
                            let displayCol = col;
                            if (/^\d{4}-\d{2}$/.test(col)) {
                                const [year, month] = col.split('-');
                                const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
                                displayCol = `${months[parseInt(month)-1]} ${year}`;
                            }
                            return `<th>${displayCol}</th>`;
                        }).join('')}
                        <th style="width: 80px;">Código</th>
                    </tr>
                </thead>
                <tbody id="balancesTableBody">
    `;
    
    // Encontrar y ordenar nivel 1
    const nivel1Keys = Array.from(rowMap.entries())
        .filter(([key, data]) => data.nivel === 1)
        .sort((a, b) => a[1].id.toString().localeCompare(b[1].id.toString(), undefined, {numeric: true}))
        .map(([key]) => key);
    
    // Renderizar
    nivel1Keys.forEach(key => {
        const rowData = rowMap.get(key);
        html += renderHierarchicalRow(rowData, filteredColumns, childrenMap, 0);
    });
    
    html += `</tbody></table></div>`;
    container.innerHTML = html;
    
    console.log('✅ Tabla renderizada');
}

// ===================================
// ✅ RENDERIZAR FILA JERÁRQUICA - CON COLUMNA SEPARADA
// ===================================
function renderHierarchicalRow(rowData, filteredColumns, childrenMap, indentLevel) {
    const { row, idx, nivel, id, key } = rowData;
    const children = childrenMap.get(key) || [];
    const hasChildren = children.length > 0;
    const indentPx = indentLevel * 25;
    
    // ✅ CAMBIO 1: Todo contraído por defecto
    const isExpanded = false;
    
    // ✅ BOTÓN EN COLUMNA SEPARADA (primera columna)
    let expandButton = '';
    if (hasChildren) {
        const iconClass = isExpanded ? 'fa-minus-circle' : 'fa-plus-circle';
        expandButton = `
            <button class="btn-expand-tree" 
                    onclick="toggleHierarchicalRow('${key}', this)" 
                    title="${isExpanded ? 'Contraer' : 'Expandir'}"
                    style="cursor: pointer; background: none; border: none; color: #2563eb; font-size: 1.1rem;">
                <i class="fas ${iconClass}"></i>
            </button>
        `;
    } else {
        expandButton = `<span style="display: inline-block; width: 22px;"></span>`;
    }
    
    // Icono según nivel
    let icono = nivel === 1 ? '<i class="fas fa-folder" style="color: #f59e0b; margin-right: 5px;"></i>' : 
                nivel === 2 ? '<i class="fas fa-folder-open" style="color: #2563eb; margin-right: 5px;"></i>' : 
                '<i class="fas fa-file-alt" style="color: #94a3b8; margin-right: 5px;"></i>';
    
    // ✅ CAMBIO 2: Ocultar todo excepto nivel 1 (indentLevel 0)
    let html = `
        <tr class="balance-row nivel-${nivel}" 
            data-key="${key}" 
            data-nivel="${nivel}"
            style="${indentLevel >= 1 ? 'display: none;' : ''}">
            <td style="text-align: center;">${expandButton}</td>
            <td><input type="checkbox" class="custom-checkbox" data-index="${idx}" onchange="toggleSeriesCheckbox(this)"></td>
            <td><button class="btn-action btn-chart" onclick="chartSingleSeries(${idx})"><i class="fas fa-chart-line"></i></button></td>
            <td><button class="btn-action btn-cart-add" onclick="agregarAlCarrito(${idx})"><i class="fas fa-cart-plus"></i></button></td>
            <td class="variable-name" style="padding-left: ${indentPx + 10}px;">
                ${icono}
                <span>${row.Variable}</span>
            </td>
            ${filteredColumns.map(col => {
                const valor = row[col];
                const display = (valor === null || valor === undefined || valor === '' || valor === '-') ? '-' : formatNumber(valor);
                return `<td class="year-value">${display}</td>`;
            }).join('')}
            <td style="font-size: 0.7rem; color: #64748b;">${id}</td>
        </tr>
    `;
    
    // ✅ CAMBIO 3: SIEMPRE renderizar hijos (pero ocultos)
    if (hasChildren) {
        children.forEach(childKey => {
            const childData = window._balancesRowMap.get(childKey);
            if (childData) {
                html += renderHierarchicalRow(childData, filteredColumns, childrenMap, indentLevel + 1);
            }
        });
    }
    
    return html;
}

// ===================================
// ✅ TOGGLE EXPANDIR/CONTRAER
// ===================================
function toggleHierarchicalRow(parentKey, button) {
    console.log('🔄 Click en toggle:', parentKey);
    
    const icon = button.querySelector('i');
    const parentRow = button.closest('tr');
    const parentNivel = parseInt(parentRow.dataset.nivel) || 1;
    
    const isCurrentlyExpanded = icon.classList.contains('fa-minus-circle');
    
    if (isCurrentlyExpanded) {
        // CONTRAER
        icon.classList.remove('fa-minus-circle');
        icon.classList.add('fa-plus-circle');
        button.title = 'Expandir';
        
        let nextRow = parentRow.nextElementSibling;
        
        while (nextRow) {
            if (!nextRow.classList.contains('balance-row')) {
                nextRow = nextRow.nextElementSibling;
                continue;
            }
            
            const childNivel = parseInt(nextRow.dataset.nivel) || 1;
            
            if (childNivel <= parentNivel) break;
            
            nextRow.style.display = 'none';
            
            const childExpandBtn = nextRow.querySelector('.btn-expand-tree');
            if (childExpandBtn) {
                const childIcon = childExpandBtn.querySelector('i');
                if (childIcon && childIcon.classList.contains('fa-minus-circle')) {
                    childIcon.classList.remove('fa-minus-circle');
                    childIcon.classList.add('fa-plus-circle');
                    childExpandBtn.title = 'Expandir';
                }
            }
            
            nextRow = nextRow.nextElementSibling;
        }
    } else {
        // EXPANDIR
        icon.classList.remove('fa-plus-circle');
        icon.classList.add('fa-minus-circle');
        button.title = 'Contraer';
        
        let nextRow = parentRow.nextElementSibling;
        
        while (nextRow) {
            if (!nextRow.classList.contains('balance-row')) {
                nextRow = nextRow.nextElementSibling;
                continue;
            }
            
            const childNivel = parseInt(nextRow.dataset.nivel) || 1;
            
            if (childNivel <= parentNivel) break;
            
            if (childNivel === parentNivel + 1) {
                nextRow.style.display = '';
            }
            
            nextRow = nextRow.nextElementSibling;
        }
    }
}

// Hacer global
window.toggleHierarchicalRow = toggleHierarchicalRow;


// ===================================
// FUNCIONES AUXILIARES
// ===================================
function formatNumber(value) {
    if (value === null || value === undefined || value === '') return '-';
    const num = parseFloat(value);
    if (isNaN(num)) return value;
    return num.toLocaleString('es-EC', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

function mostrarNotas(cuadroId) {
    const notasContainer = document.getElementById('notasContainer');
    if (!notasContainer) return;
    
    const notas = notasData[cuadroId];
    
    if (!notas || notas.length === 0) {
        notasContainer.style.display = 'none';
        notasContainer.innerHTML = '';
        return;
    }
    
    let html = `
        <div class="notas-content">
            <div class="notas-header">
                <i class="fas fa-info-circle"></i>
                <h4>Notas del Cuadro</h4>
            </div>
            <div class="notas-text">
    `;
    
    notas.forEach(nota => {
        html += `<p>${nota.Notas}</p>`;
    });
    
    html += `</div></div>`;
    
    notasContainer.innerHTML = html;
    notasContainer.style.display = 'block';
}

function populatePeriodSelectors() {
    const fromSelect = document.getElementById('periodFrom');
    const toSelect = document.getElementById('periodTo');
    if (!fromSelect || !toSelect) return;

    const firstRow = tableData[0];
    if (!firstRow) return;
    
    const allColumns = Object.keys(firstRow);
    
    const dateColumns = allColumns.filter(col => {
        return /^\d{4}-\d{2}$/.test(col) || /^\d{4}-T\d$/.test(col) || /^\d{4}$/.test(col);
    }).sort();
    
    if (dateColumns.length === 0) return;
    
    fromSelect.innerHTML = dateColumns.map(d => `<option value="${d}">${d}</option>`).join('');
    toSelect.innerHTML = dateColumns.map(d => `<option value="${d}">${d}</option>`).join('');

    if (dateColumns.length >= 60) {
        fromSelect.value = dateColumns[dateColumns.length - 60];
        toSelect.value = dateColumns[dateColumns.length - 1];
    } else if (dateColumns.length >= 20) {
        fromSelect.value = dateColumns[dateColumns.length - 20];
        toSelect.value = dateColumns[dateColumns.length - 1];
    } else if (dateColumns.length >= 5) {
        fromSelect.value = dateColumns[dateColumns.length - 5];
        toSelect.value = dateColumns[dateColumns.length - 1];
    } else {
        fromSelect.value = dateColumns[0];
        toSelect.value = dateColumns[dateColumns.length - 1];
    }
}

function toggleSeriesCheckbox(checkbox) {
    const index = parseInt(checkbox.dataset.index);
    const row = tableData[index]; // ✅ Ahora index es correcto (índice original en tableData)
    
    if (!row) {
        console.error('No se encontró la fila con índice:', index);
        return;
    }
    
    // ✅ CORRECCIÓN: Detectar si estamos en modo EFI o sector normal
    const entidadContainer = document.getElementById('entidadFilterContainer');
    const esModoEntidad = entidadContainer && entidadContainer.classList.contains('visible');
    
    let sectorInfo;
    
    if (esModoEntidad) {
        // ✅ MODO ENTIDAD: Obtener nombre de la entidad seleccionada
        const entidadFilter = document.getElementById('entidadFilter');
        const entidadNombre = entidadFilter ? entidadFilter.value : 'Entidad';
        sectorInfo = {
            valor: 'entidad_' + entidadNombre.toLowerCase().replace(/\s+/g, '_'),
            texto: entidadNombre,
            tipo: 'entidad'
        };
    } else {
        // ✅ MODO SECTOR: Usar sector financiero normal
        sectorInfo = getSectorActual();
        sectorInfo.tipo = 'sector';
    }
    
    if (checkbox.checked) {
        if (selectedSeries.length >= 10) {
            alert('Máximo 10 series');
            checkbox.checked = false;
            return;
        }
        
        // Crear ID único considerando sector/entidad
        const idUnico = crearIdUnico(currentCuadroId, row.Variable, sectorInfo.valor);
        
        // Verificar si ya existe esta variable en el MISMO sector/entidad
        const existeIndex = selectedSeries.findIndex(s => s.idUnico === idUnico);
        
        if (existeIndex >= 0) {
            // Ya existe en este sector/entidad: Actualizar los datos
            console.log(`🔄 Actualizando serie existente: ${row.Variable} - ${sectorInfo.texto}`);
            selectedSeries[existeIndex] = {
                ...selectedSeries[existeIndex],
                index: index,
                variable: row.Variable,
                data: row, // ✅ Ahora row contiene los datos CORRECTOS del sector
                idUnico: idUnico,
                sector: sectorInfo.valor,
                sectorNombre: sectorInfo.texto,
                cuadroId: currentCuadroId
            };
        } else {
            // No existe: Agregar como nueva serie
            console.log(`➕ Agregando nueva serie: ${row.Variable} - ${sectorInfo.texto}`);
            selectedSeries.push({
                index: index,
                variable: row.Variable,
                data: row, // ✅ Ahora row contiene los datos CORRECTOS del sector
                useRightAxis: false,
                chartType: 'line',
                idUnico: idUnico,
                sector: sectorInfo.valor,
                sectorNombre: sectorInfo.texto,
                cuadroId: currentCuadroId
            });
        }
    } else {
        // Eliminar considerando el sector/entidad
        const idUnico = crearIdUnico(currentCuadroId, row.Variable, sectorInfo.valor);
        selectedSeries = selectedSeries.filter(s => s.idUnico !== idUnico);
    }
    
    updateCollectionPanel();
}

function updateCollectionPanel() {
    const collectionSeries = document.getElementById('collectionSeries');
    const collectionCount = document.getElementById('collectionCount');
    const mainChartDiv = document.getElementById('collectionCharts');
    const emptyCharts = document.querySelector('.empty-charts');
    
    if (collectionCount) {
        collectionCount.textContent = `${selectedSeries.length} series`;
    }

    if (!collectionSeries) return;

    if (selectedSeries.length === 0) {
        collectionSeries.innerHTML = `
            <div class="empty-collection">
                <p>Activa hasta 10 series que quieras analizar.</p>
                <p class="small-text">Selecciona tus series del cuadro y agrégalas aquí.</p>
            </div>
        `;
        if (mainChartDiv) mainChartDiv.style.display = 'none';
        if (emptyCharts) emptyCharts.style.display = 'block';
        return;
    }

    // Mostrar series con su sector correspondiente
    collectionSeries.innerHTML = selectedSeries.map((series, idx) => `
        <div class="collection-item">
            <span class="collection-item-name">
                <strong>${series.variable}</strong>
                <small style="display:block;color:#059669;font-size:0.7rem;font-weight:500;margin-top:2px;">
                    🏦 ${series.sectorNombre || 'Sistema Financiero'}
                </small>
                ${series.cuadroId ? `
                    <small style="display:block;color:#94a3b8;font-size:0.65rem;font-weight:400;">
                        📊 ${series.cuadroId}
                    </small>
                ` : ''}
            </span>
            <div class="collection-item-actions">
                <label class="axis-toggle" title="Usar eje derecho">
                    <input type="checkbox" 
                        ${series.useRightAxis ? 'checked' : ''} 
                        onchange="toggleAxis(${idx})">
                    <span class="toggle-slider"></span>
                    <small>Eje Der</small>
                </label>
                <label class="chart-type-toggle" title="Cambiar tipo de gráfico">
                    <input type="checkbox" 
                        ${series.chartType === 'bar' ? 'checked' : ''} 
                        onchange="toggleChartType(${idx})">
                    <span class="toggle-slider"></span>
                    <small>Barra</small>
                </label>
                <button class="btn-action btn-chart" onclick="chartFromCollection(${idx})">
                    <i class="fas fa-chart-line"></i>
                </button>
                <button class="btn-action btn-delete" onclick="removeFromCollection(${idx})">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
    `).join('');

    if (emptyCharts) emptyCharts.style.display = 'none';
    if (mainChartDiv) {
        mainChartDiv.style.display = 'block';
        renderMainChart();
    }
}


function chartSingleSeries(index) {
    const row = tableData[index];
    openSingleChartModal(row.Variable, row);
}

function chartFromCollection(index) {
    if (typeof index === 'number' && index >= 0 && index < selectedSeries.length) {
        const series = selectedSeries[index];
        openSingleChartModal(series.variable, series.data);
    }
}

function removeFromCollection(index) {
    if (typeof index === 'number' && index >= 0 && index < selectedSeries.length) {
        const removedSeries = selectedSeries[index];
        selectedSeries.splice(index, 1);
        
        // Desmarcar checkbox en la tabla si existe
        if (removedSeries && removedSeries.index >= 0) {
            const checkbox = document.querySelector(`.custom-checkbox[data-index="${removedSeries.index}"]`);
            if (checkbox) checkbox.checked = false;
        }
    }
    
    updateCollectionPanel();
}

function toggleLabelsVisibility() {
    showLabels = document.getElementById('toggleLabels').checked;
    if (mainChart) renderMainChart();
}

function toggleChartType(index) {
    if (typeof index === 'number' && index >= 0 && index < selectedSeries.length) {
        selectedSeries[index].chartType = selectedSeries[index].chartType === 'line' ? 'bar' : 'line';
        renderMainChart();
    }
}

// ===================================
// FUNCIONES AUXILIARES PARA DETECCIÓN DE FECHAS
// ===================================
function detectDataType(dataRow) {
    const columns = Object.keys(dataRow);
    
    if (columns.some(col => /^\d{4}-\d{2}$/.test(col))) {
        return 'monthly';
    } else if (columns.some(col => /^\d{4}-T\d$/.test(col))) {
        return 'quarterly';
    } else {
        return 'annual';
    }
}

function getAllDateColumns(dataRow) {
    const columns = Object.keys(dataRow);
    
    return columns.filter(col => {
        return /^\d{4}-\d{2}$/.test(col) || /^\d{4}-T\d$/.test(col) || /^\d{4}$/.test(col);
    }).sort();
}

function formatDateLabel(dateStr, dataType) {
    if (dataType === 'monthly') {
        const [year, month] = dateStr.split('-');
        const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        return `${months[parseInt(month)-1]} ${year}`;
    } else if (dataType === 'quarterly') {
        const [year, quarter] = dateStr.split('-');
        return `${quarter} ${year}`;
    }
    return dateStr;
}

// Ejemplo: Cuando el usuario hace clic en "Estadísticas por entidad financiera"
function mostrarSelectorEntidades() {
    document.getElementById('entidadFilterContainer').style.display = 'block';
    document.getElementById('sectorFilter').value = 'entidad_especifica'; // Opcional
}

// Ejemplo: Cuando vuelve a "Sistema Financiero Nacional"
function ocultarSelectorEntidades() {
    document.getElementById('entidadFilterContainer').style.display = 'none';
}

// ===================================
// RENDERIZAR GRÁFICO PRINCIPAL - VERSIÓN MEJORADA
// ===================================
function renderMainChart() {
    if (selectedSeries.length === 0) return;
    const chartDom = document.getElementById('collectionCharts');
    if (!chartDom || typeof echarts === 'undefined') return;
    if (!mainChart) mainChart = echarts.init(chartDom);
    
    const dataType = detectDataType(selectedSeries[0].data);
    const allDateColumns = getAllDateColumns(selectedSeries[0].data);
    
    const startPercent = currentChartRange === '5' && allDateColumns.length > 5 
        ? Math.max(0, ((allDateColumns.length - 5) / allDateColumns.length) * 100) 
        : 0;
    
    const unidad = tableData[0] ? tableData[0].Unidad : '';
    
    let leftValues = [];
    let rightValues = [];
    
    selectedSeries.forEach(s => {
        allDateColumns.forEach(dateCol => {
            const val = parseFloat(s.data[dateCol]);
            if (!isNaN(val)) {
                if (s.useRightAxis) {
                    rightValues.push(val);
                } else {
                    leftValues.push(val);
                }
            }
        });
    });
    
    const leftMin = leftValues.length > 0 ? Math.min(...leftValues) : 0;
    const leftMax = leftValues.length > 0 ? Math.max(...leftValues) : 100;
    const leftRange = leftMax - leftMin;
    const leftPadding = leftRange * 0.1;
    
    const rightMin = rightValues.length > 0 ? Math.min(...rightValues) : 0;
    const rightMax = rightValues.length > 0 ? Math.max(...rightValues) : 100;
    const rightRange = rightMax - rightMin;
    const rightPadding = rightRange * 0.1;
    
    const hasRightAxisSeries = selectedSeries.some(s => s.useRightAxis);
    const hasBarSeries = selectedSeries.some(s => (s.chartType || currentChartType) === 'bar');

    const cuadroId = currentCuadroId;
    let sectorTitle = 'Evolución de las Estadísticas del Sector';
    if (cuadroId.includes('IEA')) {
        sectorTitle = 'Evolución de las Estadísticas del Sector';
    } else if (cuadroId.includes('SEF')) {
        sectorTitle = 'Evolución de las Estadísticas del Sector';
    } else if (cuadroId.includes('TIN')) {
        sectorTitle = 'Evolución de las Estadísticas del Sector';
    }
    
    const colorPalette = ['#1e3a8a', '#0ea5e9', '#059669', '#d97706', '#dc2626', '#7c3aed', '#db2777', '#0891b2', '#65a30d', '#ea580c'];
    
    const yAxisConfig = [
    {
        type: 'value',
        name: '',
        nameLocation: 'end',
        nameGap: 10,
        nameTextStyle: {
            fontFamily: "'Open Sans', sans-serif",
            color: '#64748b',
            fontSize: 11,
            fontWeight: 600
        },
        position: 'left',
        axisLabel: {
            fontFamily: "'Open Sans', sans-serif",
            color: '#475569',
            fontSize: 11,
            formatter: function(value) {
                return value.toFixed(1);
            }
        },
        splitLine: {
            lineStyle: {
                color: '#f1f5f9',
                type: 'dashed'
            }
        },
        axisLine: { show: false }
    }
    ];
    
if (hasRightAxisSeries) {
    const rightAxisSeriesNames = selectedSeries
        .filter(s => s.useRightAxis)
        .map(s => s.variable)
        .join(', ');
    
yAxisConfig.push({
    type: 'value',
    name: '',
    nameLocation: 'end',
    nameGap: 10,
    nameTextStyle: {
        fontFamily: "'Open Sans', sans-serif",
        color: '#059669',
        fontSize: 10,
        fontWeight: 600
    },
    position: 'right',
    axisLabel: {
        fontFamily: "'Open Sans', sans-serif",
        color: '#059669',
        fontSize: 11,
        formatter: function(value) {
            return value.toFixed(1);
        }
    },
    splitLine: { show: false },
    axisLine: { 
        show: true, 
        lineStyle: { color: '#059669' } 
    }
});
}
    
    const xAxisLabels = allDateColumns.map(dateCol => formatDateLabel(dateCol, dataType));
    
    // ✅ CORRECCIÓN: Crear nombres de series más descriptivos
    const seriesNames = selectedSeries.map(s => {
        // Si es una entidad financiera, mostrar el nombre de la entidad
        if (s.sector && s.sector.startsWith('entidad_')) {
            return `${s.variable} - ${s.sectorNombre}`;
        }
        // Si es un sector, mostrar el nombre del sector
        else if (s.sectorNombre) {
            return `${s.variable} - ${s.sectorNombre}`;
        }
        // Por defecto, solo la variable
        else {
            return s.variable;
        }
    });
    
    const option = {
        title: {
            text: sectorTitle,
            subtext: unidad,
            left: 'center',
            top: 10,
            textStyle: {
                fontFamily: "'Montserrat', sans-serif",
                fontSize: 14,
                fontWeight: 700,
                color: '#1e3a8a'
            },
            subtextStyle: {
                fontFamily: "'Open Sans', sans-serif",
                fontSize: 11,
                color: '#64748b'
            }
        },
        tooltip: {
            trigger: 'axis',
            backgroundColor: 'rgba(255,255,255,0.98)',
            borderColor: '#1e3a8a',
            borderWidth: 1,
            textStyle: {
                fontFamily: "'Open Sans', sans-serif",
                color: '#1e293b',
                fontSize: 12
            },
            padding: [10, 14],
            shadowBlur: 10,
            shadowColor: 'rgba(0,0,0,0.1)',
            axisPointer: {
                type: 'cross',
                crossStyle: { color: '#94a3b8' }
            }
        },
        legend: {
            data: seriesNames, // ✅ USAR NOMRES MEJORADOS
            bottom: 35,
            type: 'scroll',
            textStyle: {
                fontFamily: "'Open Sans', sans-serif",
                fontSize: 11,
                color: '#334155'
            }
        },
        grid: {
            left: hasBarSeries ? '8%' : '3%',
            right: hasRightAxisSeries ? '6%' : '4%',
            top: 70,
            bottom: 80,
            containLabel: true
        },
        xAxis: {
            type: 'category',
            boundaryGap: hasBarSeries,
            data: xAxisLabels,
            axisLabel: {
                fontFamily: "'Open Sans', sans-serif",
                color: '#475569',
                fontSize: dataType === 'monthly' ? 9 : 11,
                rotate: dataType === 'monthly' ? 45 : 0
            },
            axisLine: { lineStyle: { color: '#cbd5e1' } },
            axisTick: { show: false }
        },
        yAxis: yAxisConfig,
        dataZoom: [
            {
                type: 'inside',
                start: startPercent,
                end: 100
            },
            {
                type: 'slider',
                show: true,
                start: startPercent,
                end: 100,
                height: 20,
                bottom: 5,
                borderColor: '#cbd5e1',
                fillerColor: 'rgba(30, 58, 138, 0.15)',
                handleStyle: {
                    color: '#1e3a8a',
                    borderColor: '#1e3a8a'
                },
                textStyle: {
                    fontFamily: "'Open Sans', sans-serif",
                    fontSize: 10,
                    color: '#64748b'
                },
                dataBackground: {
                    lineStyle: { color: '#94a3b8' },
                    areaStyle: { color: '#e2e8f0' }
                }
            }
        ],
        series: selectedSeries.map((s, idx) => ({
            name: seriesNames[idx], // ✅ USAR NOMBRE MEJORADO
            type: s.chartType || 'line',
            yAxisIndex: s.useRightAxis ? 1 : 0,
            data: allDateColumns.map(dateCol => parseFloat(s.data[dateCol]) || 0),
            smooth: (s.chartType || 'line') === 'line',
            symbol: (s.chartType || 'line') === 'line' ? 'circle' : 'none', 
            symbolSize: 6,
            lineStyle: {
                width: 2.5,
                color: colorPalette[idx % colorPalette.length],
                shadowBlur: 4,
                shadowColor: 'rgba(0, 0, 0, 0.15)',
                shadowOffsetY: 2
            },
            itemStyle: {
                color: colorPalette[idx % colorPalette.length],
                borderWidth: 2,
                borderColor: '#ffffff',
                shadowBlur: 6,
                shadowColor: 'rgba(0, 0, 0, 0.2)'
            },
            emphasis: {
                focus: 'series',
                itemStyle: {
                    shadowBlur: 8,
                    shadowColor: 'rgba(0, 0, 0, 0.3)'
                }
            },
            label: {
                show: showLabels,
                position: 'top',
                fontFamily: "'Open Sans', sans-serif",
                fontSize: 10,
                color: '#475569',
                formatter: function(params) {
                    const val = params.value;
                    return val.toLocaleString('es-EC', { 
                        minimumFractionDigits: 1, 
                        maximumFractionDigits: 1 
                    });
                }
            },
            areaStyle: {
                color: {
                    type: 'linear',
                    x: 0, y: 0, x2: 0, y2: 1,
                    colorStops: [
                        { offset: 0, color: colorPalette[idx % colorPalette.length] + '30' },
                        { offset: 1, color: colorPalette[idx % colorPalette.length] + '05' }
                    ]
                }
            }
        }))
    };
    
    mainChart.setOption(option, true);
}

function openSingleChartModal(title, rowData) {
    const modalTitle = document.getElementById('singleChartTitle');
    const modal = document.getElementById('singleChartModal');
    if (modalTitle) modalTitle.textContent = title;
    if (modal) modal.classList.add('active');
    setTimeout(() => renderSingleChart(rowData), 100);
}

function toggleLabelsSingleVisibility() {
    showLabels = document.getElementById('toggleLabelsSingle').checked;
    if (singleChart) renderSingleChart(singleChart.getOption().series[0].data.length > 0 ? 
        tableData.find(r => r.Variable === document.getElementById('singleChartTitle').textContent) : 
        tableData[0]);
}

// ===================================
// RENDERIZAR GRÁFICO INDIVIDUAL
// ===================================
function renderSingleChart(rowData) {
    const chartDom = document.getElementById('singleChart');
    if (!chartDom || typeof echarts === 'undefined') return;
    if (!singleChart) singleChart = echarts.init(chartDom);
    
    const dataType = detectDataType(rowData);
    const allDateColumns = getAllDateColumns(rowData);
    
    const unidad = tableData[0] ? tableData[0].Unidad : '';
    
    const allValues = allDateColumns.map(dateCol => parseFloat(rowData[dateCol])).filter(val => !isNaN(val));
    const minVal = Math.min(...allValues);
    const maxVal = Math.max(...allValues);
    const range = maxVal - minVal;
    const padding = range * 0.1;
    
    const colorPalette = ['#1e3a8a', '#0ea5e9', '#059669', '#d97706', '#dc2626', '#7c3aed', '#db2777', '#0891b2', '#65a30d', '#ea580c'];
    
    const xAxisLabels = allDateColumns.map(dateCol => formatDateLabel(dateCol, dataType));
    
    const option = {
        title: {
            text: document.getElementById('singleChartTitle').textContent,
            subtext: unidad,
            left: 'center',
            top: 10,
            textStyle: {
                fontFamily: "'Montserrat', sans-serif",
                fontSize: 16,
                fontWeight: 700,
                color: '#1e3a8a'
            },
            subtextStyle: {
                fontFamily: "'Open Sans', sans-serif",
                fontSize: 12,
                color: '#64748b'
            }
        },
        tooltip: {
            trigger: 'axis',
            backgroundColor: 'rgba(255,255,255,0.98)',
            borderColor: '#1e3a8a',
            borderWidth: 1,
            textStyle: {
                fontFamily: "'Open Sans', sans-serif",
                color: '#1e293b',
                fontSize: 12
            },
            padding: [10, 14],
            shadowBlur: 10,
            shadowColor: 'rgba(0,0,0,0.1)',
            axisPointer: {
                type: 'cross',
                crossStyle: { color: '#94a3b8' }
            }
        },
        toolbox: {
            show: true,
            right: 20,
            top: 10,
            feature: {
                saveAsImage: { 
                    show: true,
                    title: 'Descargar',
                    pixelRatio: 2,
                    name: 'grafico_individual'
                },
                restore: { 
                    show: true,
                    title: 'Restaurar' 
                },
                magicType: { 
                    show: true,
                    type: ['line', 'bar'], 
                    title: { line: 'Líneas', bar: 'Barras' } 
                },
                dataZoom: {
                    show: true,
                    title: { zoom: 'Zoom', back: 'Zoom Reset' }
                }
            },
            iconStyle: {
                borderColor: '#1e3a8a'
            },
            emphasis: {
                iconStyle: {
                    borderColor: '#2563eb'
                }
            }
        },
        legend: {
            data: [rowData.Variable],
            bottom: 35,
            type: 'scroll',
            textStyle: {
                fontFamily: "'Open Sans', sans-serif",
                fontSize: 11,
                color: '#334155'
            }
        },
        grid: {
            left: '3%',
            right: '4%',
            top: 80,
            bottom: 90,
            containLabel: true
        },
        xAxis: {
            type: 'category',
            boundaryGap: false,
            data: xAxisLabels,
            axisLabel: {
                fontFamily: "'Open Sans', sans-serif",
                color: '#475569',
                fontSize: dataType === 'monthly' ? 9 : 11,
                rotate: dataType === 'monthly' ? 45 : 0
            },
            axisLine: { lineStyle: { color: '#cbd5e1' } },
            axisTick: { show: false }
        },
        yAxis: [
    {
        type: 'value',
        name: '',
        nameLocation: 'end',
        nameGap: 10,
        axisLabel: {
            fontFamily: "'Open Sans', sans-serif",
            color: '#475569',
            fontSize: 11,
            formatter: function(value) {
                return value.toFixed(1);
            }
        },
        splitLine: {
            lineStyle: {
                color: '#f1f5f9',
                type: 'dashed'
            }
        },
        axisLine: { show: false }
    },
    {
        type: 'value',
        name: '',
        nameLocation: 'end',
        nameGap: 10,
        nameTextStyle: {
            fontFamily: "'Open Sans', sans-serif",
            color: '#64748b',
            fontSize: 11,
            fontWeight: 600
        },
        axisLabel: { show: false },
        splitLine: { show: false },
        axisLine: { show: false }
    }
],
        dataZoom: [
            {
                type: 'inside',
                start: 0,
                end: 100
            },
            {
                type: 'slider',
                show: true,
                start: 0,
                end: 100,
                height: 25,
                bottom: 10,
                borderColor: '#cbd5e1',
                fillerColor: 'rgba(30, 58, 138, 0.15)',
                handleStyle: {
                    color: '#1e3a8a',
                    borderColor: '#1e3a8a'
                },
                textStyle: {
                    fontFamily: "'Open Sans', sans-serif",
                    fontSize: 10,
                    color: '#64748b'
                },
                dataBackground: {
                    lineStyle: { color: '#94a3b8' },
                    areaStyle: { color: '#e2e8f0' }
                }
            }
        ],
        series: [{
            name: rowData.Variable,
            type: 'line',
            yAxisIndex: 1,
            data: allDateColumns.map(dateCol => parseFloat(rowData[dateCol]) || 0),
            smooth: true,
            symbol: 'circle',
            symbolSize: 6,
            lineStyle: {
                width: 2.5,
                color: colorPalette[0],
                shadowBlur: 4,
                shadowColor: 'rgba(0, 0, 0, 0.15)',
                shadowOffsetY: 2
            },
            itemStyle: {
                color: colorPalette[0],
                borderWidth: 2,
                borderColor: '#ffffff',
                shadowBlur: 6,
                shadowColor: 'rgba(0, 0, 0, 0.2)'
            },
            emphasis: {
                focus: 'series',
                itemStyle: {
                    shadowBlur: 8,
                    shadowColor: 'rgba(0, 0, 0, 0.3)'
                }
            },
            label: {
                show: showLabels,
                position: 'top',
                fontFamily: "'Open Sans', sans-serif",
                fontSize: 10,
                color: '#475569',
                formatter: function(params) {
                    const val = params.value;
                    return val.toLocaleString('es-EC', { 
                        minimumFractionDigits: 1, 
                        maximumFractionDigits: 1 
                    });
                }
            },
            areaStyle: {
                color: {
                    type: 'linear',
                    x: 0, y: 0, x2: 0, y2: 1,
                    colorStops: [
                        { offset: 0, color: colorPalette[0] + '30' },
                        { offset: 1, color: colorPalette[0] + '05' }
                    ]
                }
            }
        }]
    };
    
    singleChart.setOption(option, true);
}

// ===================================
// RENDERIZAR GRÁFICO AMPLIADO
// ===================================
function renderExpandedChart() {
    if (selectedSeries.length === 0) return;
    const chartDom = document.getElementById('expandedChart');
    if (!chartDom || typeof echarts === 'undefined') return;
    if (!expandedChart) expandedChart = echarts.init(chartDom);
    
    const dataType = detectDataType(selectedSeries[0].data);
    const allDateColumns = getAllDateColumns(selectedSeries[0].data);
    
    const startPercent = currentChartRange === '5' && allDateColumns.length > 5 
        ? Math.max(0, ((allDateColumns.length - 5) / allDateColumns.length) * 100) 
        : 0;
    
    const unidad = tableData[0] ? tableData[0].Unidad : '';
    
    let leftValues = [];
    let rightValues = [];
    
    selectedSeries.forEach(s => {
        allDateColumns.forEach(dateCol => {
            const val = parseFloat(s.data[dateCol]);
            if (!isNaN(val)) {
                if (s.useRightAxis) {
                    rightValues.push(val);
                } else {
                    leftValues.push(val);
                }
            }
        });
    });
    
    const leftMin = leftValues.length > 0 ? Math.min(...leftValues) : 0;
    const leftMax = leftValues.length > 0 ? Math.max(...leftValues) : 100;
    const leftRange = leftMax - leftMin;
    const leftPadding = leftRange * 0.1;
    
    const rightMin = rightValues.length > 0 ? Math.min(...rightValues) : 0;
    const rightMax = rightValues.length > 0 ? Math.max(...rightValues) : 100;
    const rightRange = rightMax - rightMin;
    const rightPadding = rightRange * 0.1;
    
    const hasRightAxisSeries = selectedSeries.some(s => s.useRightAxis);
    const hasBarSeries = selectedSeries.some(s => (s.chartType || currentChartType) === 'bar');

    const cuadroId = currentCuadroId;
    let sectorTitle = 'Evolución de las Estadísticas del Sector';
    if (cuadroId.includes('IEA')) {
        sectorTitle = 'Evolución de las Estadísticas del Sector';
    } else if (cuadroId.includes('SEF')) {
        sectorTitle = 'Evolución de las Estadísticas del Sector';
    } else if (cuadroId.includes('TIN')) {
        sectorTitle = 'Evolución de las Estadísticas del Sector';
    }
    
    const colorPalette = ['#1e3a8a', '#0ea5e9', '#059669', '#d97706', '#dc2626', '#7c3aed', '#db2777', '#0891b2', '#65a30d', '#ea580c'];
    
    const yAxisConfig = [
    {
        type: 'value',
        name: '',
        nameLocation: 'end',
        nameGap: 10,
        nameTextStyle: {
            fontFamily: "'Open Sans', sans-serif",
            color: '#64748b',
            fontSize: 11,
            fontWeight: 600
        },
        position: 'left',
        axisLabel: {
            fontFamily: "'Open Sans', sans-serif",
            color: '#475569',
            fontSize: 11,
            formatter: function(value) {
                return value.toFixed(1);
            }
        },
        splitLine: {
            lineStyle: {
                color: '#f1f5f9',
                type: 'dashed'
            }
        },
        axisLine: { show: false }
    }
    ];
    
    if (hasRightAxisSeries) {
        const rightAxisSeriesNames = selectedSeries
            .filter(s => s.useRightAxis)
            .map(s => s.variable)
            .join(', ');
        
        yAxisConfig.push({
            type: 'value',
            name: '',
            nameLocation: 'end',
            nameGap: 10,
            nameTextStyle: {
                fontFamily: "'Open Sans', sans-serif",
                color: '#059669',
                fontSize: 10,
                fontWeight: 600
            },
            position: 'right',
            axisLabel: {
                fontFamily: "'Open Sans', sans-serif",
                color: '#059669',
                fontSize: 11,
                formatter: function(value) {
                    return value.toFixed(1);
                }
            },
            splitLine: { show: false },
            axisLine: { 
                show: true, 
                lineStyle: { color: '#059669' } 
            }
        });
    }
    
    const xAxisLabels = allDateColumns.map(dateCol => formatDateLabel(dateCol, dataType));
    
    // ✅ CORRECCIÓN: Crear nombres de series más descriptivos (igual que en renderMainChart)
    const seriesNames = selectedSeries.map(s => {
        if (s.sector && s.sector.startsWith('entidad_')) {
            return `${s.variable} - ${s.sectorNombre}`;
        } else if (s.sectorNombre) {
            return `${s.variable} - ${s.sectorNombre}`;
        } else {
            return s.variable;
        }
    });
    
    const option = {
        title: {
            text: sectorTitle,
            subtext: unidad,
            left: 'center',
            top: 10,
            textStyle: {
                fontFamily: "'Montserrat', sans-serif",
                fontSize: 16,
                fontWeight: 700,
                color: '#1e3a8a'
            },
            subtextStyle: {
                fontFamily: "'Open Sans', sans-serif",
                fontSize: 12,
                color: '#64748b'
            }
        },
        tooltip: {
            trigger: 'axis',
            backgroundColor: 'rgba(255,255,255,0.98)',
            borderColor: '#1e3a8a',
            borderWidth: 1,
            textStyle: {
                fontFamily: "'Open Sans', sans-serif",
                color: '#1e293b',
                fontSize: 12
            },
            padding: [10, 14],
            shadowBlur: 10,
            shadowColor: 'rgba(0,0,0,0.1)',
            axisPointer: {
                type: 'cross',
                crossStyle: { color: '#94a3b8' }
            }
        },
        toolbox: {
            show: true,
            right: 20,
            top: 10,
            feature: {
                saveAsImage: { 
                    show: true,
                    title: 'Descargar',
                    pixelRatio: 2,
                    name: 'grafico_ampliado'
                },
                restore: { 
                    show: true,
                    title: 'Restaurar' 
                },
                magicType: { 
                    show: true,
                    type: ['line', 'bar'], 
                    title: { line: 'Líneas', bar: 'Barras' } 
                },
                dataZoom: {
                    show: true,
                    title: { zoom: 'Zoom', back: 'Zoom Reset' }
                }
            },
            iconStyle: {
                borderColor: '#1e3a8a'
            },
            emphasis: {
                iconStyle: {
                    borderColor: '#2563eb'
                }
            }
        },
        legend: {
            data: seriesNames, // ✅ USAR NOMBRES MEJORADOS
            bottom: 35,
            type: 'scroll',
            textStyle: {
                fontFamily: "'Open Sans', sans-serif",
                fontSize: 11,
                color: '#334155'
            }
        },
        grid: {
            left: hasBarSeries ? '8%' : '3%',
            right: hasRightAxisSeries ? '6%' : '4%',
            top: 70,
            bottom: 80,
            containLabel: true
        },
        xAxis: {
            type: 'category',
            boundaryGap: hasBarSeries,
            data: xAxisLabels,
            axisLabel: {
                fontFamily: "'Open Sans', sans-serif",
                color: '#475569',
                fontSize: dataType === 'monthly' ? 9 : 11,
                rotate: dataType === 'monthly' ? 45 : 0
            },
            axisLine: { lineStyle: { color: '#cbd5e1' } },
            axisTick: { show: false }
        },
        yAxis: yAxisConfig,
        dataZoom: [
            {
                type: 'inside',
                start: startPercent,
                end: 100
            },
            {
                type: 'slider',
                show: true,
                start: startPercent,
                end: 100,
                height: 25,
                bottom: 10,
                borderColor: '#cbd5e1',
                fillerColor: 'rgba(30, 58, 138, 0.15)',
                handleStyle: {
                    color: '#1e3a8a',
                    borderColor: '#1e3a8a'
                },
                textStyle: {
                    fontFamily: "'Open Sans', sans-serif",
                    fontSize: 10,
                    color: '#64748b'
                },
                dataBackground: {
                    lineStyle: { color: '#94a3b8' },
                    areaStyle: { color: '#e2e8f0' }
                }
            }
        ],
        series: selectedSeries.map((s, idx) => ({
            name: seriesNames[idx], // ✅ USAR NOMBRE MEJORADO
            type: s.chartType || currentChartType,
            yAxisIndex: s.useRightAxis ? 1 : 0,
            data: allDateColumns.map(dateCol => parseFloat(s.data[dateCol]) || 0),
            smooth: (s.chartType || currentChartType) === 'line',  
            symbol: (s.chartType || currentChartType) === 'line' ? 'circle' : 'none',
            symbolSize: 6,
            lineStyle: {
                width: 2.5,
                color: colorPalette[idx % colorPalette.length],
                shadowBlur: 4,
                shadowColor: 'rgba(0, 0, 0, 0.15)',
                shadowOffsetY: 2
            },
            itemStyle: {
                color: colorPalette[idx % colorPalette.length],
                borderWidth: 2,
                borderColor: '#ffffff',
                shadowBlur: 6,
                shadowColor: 'rgba(0, 0, 0, 0.2)'
            },
            emphasis: {
                focus: 'series',
                itemStyle: {
                    shadowBlur: 8,
                    shadowColor: 'rgba(0, 0, 0, 0.3)'
                }
            },
            label: {
                show: showLabels,
                position: 'top',
                fontFamily: "'Open Sans', sans-serif",
                fontSize: 10,
                color: '#475569',
                formatter: function(params) {
                    const val = params.value;
                    return val.toLocaleString('es-EC', { 
                        minimumFractionDigits: 1, 
                        maximumFractionDigits: 1 
                    });
                }
            },
            areaStyle: currentChartType === 'line' ? {
                color: {
                    type: 'linear',
                    x: 0, y: 0, x2: 0, y2: 1,
                    colorStops: [
                        { offset: 0, color: colorPalette[idx % colorPalette.length] + '30' },
                        { offset: 1, color: colorPalette[idx % colorPalette.length] + '05' }
                    ]
                }
            } : undefined
        }))
    };
    
    expandedChart.setOption(option, true);
}

function toggleAxis(index) {
    if (typeof index === 'number' && index >= 0 && index < selectedSeries.length) {
        selectedSeries[index].useRightAxis = !selectedSeries[index].useRightAxis;
        renderMainChart();
    }
}

// ===================================
// CARRITO PERSISTENTE DE SERIES
// ===================================
let carritoSeries = JSON.parse(localStorage.getItem('carritoSeries')) || [];

function agregarAlCarrito(index) {
    const row = tableData[index];
    if (!row) return;
    
    // ✅ CORRECCIÓN: Detectar si estamos en modo EFI o sector normal
    const entidadContainer = document.getElementById('entidadFilterContainer');
    const esModoEntidad = entidadContainer && entidadContainer.classList.contains('visible');
    
    let sectorInfo;
    
    if (esModoEntidad) {
        // ✅ MODO ENTIDAD: Obtener nombre de la entidad seleccionada
        const entidadFilter = document.getElementById('entidadFilter');
        const entidadNombre = entidadFilter ? entidadFilter.value : 'Entidad';
        sectorInfo = {
            valor: 'entidad_' + entidadNombre.toLowerCase().replace(/\s+/g, '_'),
            texto: entidadNombre,
            tipo: 'entidad'
        };
    } else {
        // ✅ MODO SECTOR: Usar sector financiero normal
        sectorInfo = getSectorActual();
        sectorInfo.tipo = 'sector';
    }
    
    // Crear ID único considerando sector/entidad
    const idUnico = crearIdUnico(currentCuadroId, row.Variable, sectorInfo.valor);
    
    // Verificar si ya existe esta combinación exacta
    const existe = carritoSeries.find(s => {
        const sIdUnico = crearIdUnico(s.cuadroId, s.variable, s.sector);
        return sIdUnico === idUnico;
    });

    if (!existe) {
        carritoSeries.push({
            index: index,
            variable: row.Variable,
            cuadroId: currentCuadroId,
            cuadroNombre: tableData[0]?.Titulo_Cuadro || currentCuadroId,
            sector: sectorInfo.valor,
            sectorNombre: sectorInfo.texto,
            data: row
        });
        
        localStorage.setItem('carritoSeries', JSON.stringify(carritoSeries));
        actualizarContadorCarrito();
        
        alert(`✅ "${row.Variable}" de ${sectorInfo.texto} añadida al carrito.`);
    } else {
        alert(`️ La serie "${row.Variable}" de ${sectorInfo.texto} ya se encuentra en el carrito.`);
    }
}

function abrirModalCarrito() {
    const modal = document.getElementById('modalCarrito');
    if (modal) {
        modal.classList.add('active');
        renderizarCarrito();
    }
}

function cerrarModalCarrito() {
    const modal = document.getElementById('modalCarrito');
    if (modal) {
        modal.classList.remove('active');
    }
}

function renderizarCarrito() {
    const body = document.getElementById('modalCarritoBody');
    if (!body) return;
    
    if (carritoSeries.length === 0) {
        body.innerHTML = `
            <div class="carrito-vacio">
                <i class="fas fa-inbox"></i>
                <p>Tu carrito está vacío</p>
                <p class="small-text">Haz clic en el icono del carrito <i class="fas fa-cart-plus"></i> en la tabla para añadir series.</p>
            </div>
        `;
        return;
    }

    body.innerHTML = carritoSeries.map((serie, idx) => {
        const idUnico = crearIdUnico(serie.cuadroId, serie.variable, serie.sector);
        const yaEnPanel = selectedSeries.some(s => s.idUnico === idUnico);
        
        return `
            <div class="carrito-item">
                <div class="carrito-item-info">
                    <span class="carrito-item-variable" title="${serie.variable}">
                        <strong>${serie.variable}</strong>
                    </span>
                    <span class="carrito-item-cuadro">
                        <i class="fas fa-table"></i> ${serie.cuadroNombre}
                    </span>
                    ${serie.sectorNombre ? `
                        <span class="carrito-item-sector" style="font-size: 0.7rem; color: #059669; display: block; margin-top: 2px;">
                            <i class="fas fa-building"></i> ${serie.sectorNombre}
                        </span>
                    ` : ''}
                </div>
                <div class="carrito-item-actions">
                    <button class="btn-carrito-action btn-carrito-add-panel" 
                           onclick="agregarAlPanelDesdeCarrito(${idx})" 
                           title="${yaEnPanel ? 'Ya está en el panel' : 'Añadir al panel de gráficos'}"
                           ${yaEnPanel ? 'disabled style="opacity:0.4;cursor:not-allowed;"' : ''}>
                        <i class="fas ${yaEnPanel ? 'fa-check' : 'fa-plus-circle'}"></i>
                    </button>
                    <button class="btn-carrito-action btn-carrito-eliminar" onclick="eliminarDelCarrito(${idx})" title="Eliminar del carrito">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

function agregarAlPanelDesdeCarrito(indexCarrito) {
    const serieCarrito = carritoSeries[indexCarrito];
    if (!serieCarrito) return;
    
    if (selectedSeries.length >= 10) {
        alert('Máximo 10 series en el panel. Elimina alguna para agregar esta.');
        return;
    }

    // Crear ID único considerando sector
    const idUnico = crearIdUnico(serieCarrito.cuadroId, serieCarrito.variable, serieCarrito.sector);

    // Verificar si ya existe
    const existeIndex = selectedSeries.findIndex(s => s.idUnico === idUnico);

    if (existeIndex >= 0) {
        // ✅ YA EXISTE: Actualizar los datos
        selectedSeries[existeIndex] = {
            index: -1,
            variable: serieCarrito.variable,
            data: serieCarrito.data,
            useRightAxis: selectedSeries[existeIndex].useRightAxis,
            chartType: selectedSeries[existeIndex].chartType,
            idUnico: idUnico,
            cuadroNombre: serieCarrito.cuadroNombre,
            sector: serieCarrito.sector,
            sectorNombre: serieCarrito.sectorNombre
        };
    } else {
        // ✅ NO EXISTE: Agregar como nueva serie
        selectedSeries.push({
            index: -1,
            variable: serieCarrito.variable,
            data: serieCarrito.data,
            useRightAxis: false,
            chartType: 'line',
            idUnico: idUnico,
            cuadroNombre: serieCarrito.cuadroNombre,
            sector: serieCarrito.sector,
            sectorNombre: serieCarrito.sectorNombre
        });
    }

    updateCollectionPanel();
    renderizarCarrito();

    alert(`✅ "${serieCarrito.variable}" del ${serieCarrito.sectorNombre} añadida al panel de gráficos.`);
}

function eliminarDelCarrito(index) {
    carritoSeries.splice(index, 1);
    localStorage.setItem('carritoSeries', JSON.stringify(carritoSeries));
    actualizarContadorCarrito();
    renderizarCarrito();
}

function vaciarCarrito() {
    if (carritoSeries.length === 0) return;
    if (confirm('¿Estás seguro de vaciar el carrito? Se eliminarán todas las series guardadas.')) {
        carritoSeries = [];
        localStorage.setItem('carritoSeries', JSON.stringify(carritoSeries));
        actualizarContadorCarrito();
        renderizarCarrito();
    }
}

function actualizarContadorCarrito() {
    const contador = document.getElementById('carritoContador');
    const contadorHeader = document.getElementById('carritoContadorHeader');
    
    if (contador) {
        contador.textContent = carritoSeries.length;
        contador.style.display = carritoSeries.length > 0 ? 'flex' : 'none';
    }
    
    if (contadorHeader) {
        contadorHeader.textContent = carritoSeries.length;
        contadorHeader.style.display = carritoSeries.length > 0 ? 'flex' : 'none';
    }
    
    const badgeFlotante = document.querySelector('.carrito-contador');
    if (badgeFlotante) {
        badgeFlotante.textContent = carritoSeries.length;
        badgeFlotante.style.display = carritoSeries.length > 0 ? 'flex' : 'none';
    }
}

document.addEventListener('click', (e) => {
    const modalCarrito = document.getElementById('modalCarrito');
    if (modalCarrito && e.target === modalCarrito) {
        cerrarModalCarrito();
    }
});

function descargarTabla(formato = 'excel') {
    if (tableData.length === 0) {
        alert('No hay datos para descargar');
        return;
    }

    const tituloCuadro = tableData[0].Titulo_Cuadro || currentCuadroId;
    const unidad = tableData[0].Unidad || '';

    const primeraFila = tableData[0];
    const todasLasColumnas = Object.keys(primeraFila);
    
    const columnasExcluidas = ['Cuadro', 'Titulo_Cuadro', 'Unidad', 'Grupo', 'Variable', 'Nivel1', 'Nivel2', 'Nivel3', 'Nivel4', 'Nivel5', 'Nivel6', 'Nivel7'];
    
    const columnasDatos = todasLasColumnas.filter(col => !columnasExcluidas.includes(col)).sort();

    if (formato === 'excel') {
        descargarComoExcel(tituloCuadro, unidad, columnasDatos);
    } else {
        descargarComoCSV(tituloCuadro, unidad, columnasDatos);
    }
}

function descargarComoCSV(titulo, unidad, columnasDatos) {
    let csvContent = "\uFEFF";
    
    csvContent += `Cuadro: ${titulo}\n`;
    if (unidad) csvContent += `Unidad: ${unidad}\n`;
    csvContent += `\n`;
    
    const encabezados = ['Grupo', 'Variable', ...columnasDatos];
    csvContent += encabezados.map(h => `"${h}"`).join(',') + '\n';
    
    tableData.forEach(row => {
        const fila = [
            row.Grupo || '',
            row.Variable || '',
            ...columnasDatos.map(col => {
                const valor = row[col];
                return (valor === null || valor === undefined || valor === '') ? '' : valor;
            })
        ];
        csvContent += fila.map(celda => `"${celda}"`).join(',') + '\n';
    });
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${currentCuadroId}_datos.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function descargarComoExcel(titulo, unidad, columnasDatos) {
    let htmlContent = `
        <html xmlns:o="urn:schemas-microsoft-com:office:office" 
              xmlns:x="urn:schemas-microsoft-com:office:excel" 
              xmlns="http://www.w3.org/TR/REC-html40">
        <head>
            <meta charset="utf-8">
            <!--[if gte mso 9]>
            <xml>
                <x:ExcelWorkbook>
                    <x:ExcelWorksheets>
                        <x:ExcelWorksheet>
                            <x:Name>Datos</x:Name>
                            <x:WorksheetOptions>
                                <x:DisplayGridlines/>
                            </x:WorksheetOptions>
                        </x:ExcelWorksheet>
                    </x:ExcelWorksheets>
                </x:ExcelWorkbook>
            </xml>
            <![endif]-->
            <style>
                table { border-collapse: collapse; }
                th { background-color: #1e3a8a; color: white; font-weight: bold; border: 1px solid #ddd; padding: 8px; }
                td { border: 1px solid #ddd; padding: 6px; text-align: right; }
                td.text-left { text-align: left; }
                .grupo-row { background-color: #f1f5f9; font-weight: bold; }
                .header-info { background-color: #e2e8f0; padding: 10px; margin-bottom: 10px; }
            </style>
        </head>
        <body>
            <div class="header-info">
                <h2>${titulo}</h2>
                ${unidad ? `<p><strong>Unidad:</strong> ${unidad}</p>` : ''}
                <p><strong>Fecha de exportación:</strong> ${new Date().toLocaleDateString('es-EC')}</p>
            </div>
            <table>
                <thead>
                    <tr>
                        <th class="text-left">Grupo</th>
                        <th class="text-left">Variable</th>
                        ${columnasDatos.map(col => `<th>${formatearColumna(col)}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
    `;
    
    let grupoActual = '';
    tableData.forEach(row => {
        if (row.Grupo !== grupoActual) {
            if (grupoActual !== '') htmlContent += `</tr>`;
            grupoActual = row.Grupo;
            htmlContent += `<tr class="grupo-row"><td colspan="${2 + columnasDatos.length}">${grupoActual || 'Sin Grupo'}</td></tr>`;
        }
        
        htmlContent += `<tr>
            <td class="text-left">${row.Grupo || ''}</td>
            <td class="text-left">${row.Variable || ''}</td>
            ${columnasDatos.map(col => {
                const valor = row[col];
                const display = (valor === null || valor === undefined || valor === '') ? '' : 
                               typeof valor === 'number' ? valor.toLocaleString('es-EC', {minimumFractionDigits: 1, maximumFractionDigits: 2}) : valor;
                return `<td>${display}</td>`;
            }).join('')}
        </tr>`;
    });
    
    htmlContent += `
                </tbody>
            </table>
        </body>
        </html>
    `;
    
    const blob = new Blob(['\ufeff', htmlContent], { type: 'application/vnd.ms-excel' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${currentCuadroId}_datos.xls`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function formatearColumna(col) {
    if (/^\d{4}-\d{2}$/.test(col)) {
        const [year, month] = col.split('-');
        const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        return `${meses[parseInt(month)-1]} ${year}`;
    } else if (/^\d{4}-T\d$/.test(col)) {
        const [year, quarter] = col.split('-');
        return `${quarter} ${year}`;
    }
    return col;
}

window.loadTable = loadTable;

// ===================================
// 🎯 UN SOLO DOMCONTENTLOADED - SIN DUPLICACIONES
// ===================================
document.addEventListener('DOMContentLoaded', async () => {
    // Botón Ampliar
    const btnAmpliar = document.getElementById('btnAmpliar');
    if (btnAmpliar) {
        btnAmpliar.addEventListener('click', () => {
            if (selectedSeries.length === 0) {
                alert('Selecciona al menos una serie');
                return;
            }
            const modal = document.getElementById('chartModal');
            if (modal) modal.classList.add('active');
            setTimeout(() => renderExpandedChart(), 100);
        });
    }
    
    // Cerrar modales
    const btnCloseModal = document.getElementById('btnCloseModal');
    if (btnCloseModal) {
        btnCloseModal.addEventListener('click', () => {
            const modal = document.getElementById('chartModal');
            if (modal) modal.classList.remove('active');
        });
    }
    
    const btnCloseSingleModal = document.getElementById('btnCloseSingleModal');
    if (btnCloseSingleModal) {
        btnCloseSingleModal.addEventListener('click', () => {
            const modal = document.getElementById('singleChartModal');
            if (modal) modal.classList.remove('active');
        });
    }
    
    // Cambiar tipo de gráfico
    document.querySelectorAll('.btn-chart-view').forEach(btn => {
        btn.addEventListener('click', () => {
            btn.parentElement.querySelectorAll('.btn-chart-view').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            if (btn.closest('#chartModal')) {
                currentChartType = btn.dataset.view;
                renderExpandedChart();
            }
        });
    });
    
    // Cambiar rango
    document.querySelectorAll('input[name="chartRange"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            currentChartRange = e.target.value;
            renderExpandedChart();
            if (mainChart) renderMainChart();
        });
    });
    
    // Descargar tabla
    const btnDownloadTable = document.getElementById('btnDownloadTable');
    if (btnDownloadTable) {
        btnDownloadTable.addEventListener('click', () => {
            const formato = confirm('¿Deseas descargar en formato Excel?\n\nAceptar = Excel (.xls)\nCancelar = CSV (.csv)') ? 'excel' : 'csv';
            descargarTabla(formato);
        });
    }
    
    // Resize charts
    window.addEventListener('resize', () => {
        if (mainChart) mainChart.resize();
        if (expandedChart) expandedChart.resize();
        if (singleChart) singleChart.resize();
    });
    
    console.log('✅ Módulo Sistema Financiero cargado correctamente');
    
// Verificar sesión con Supabase
(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
        window.location.href = 'index.html';
        return;
    }
    
    const user = session.user;
    const welcomeUser = document.getElementById('welcomeUser');
    if (welcomeUser) {
        welcomeUser.textContent = `Bienvenido, ${user.user_metadata.username || user.email}`;
    }
    
    const btnLogout = document.getElementById('btnLogout');
    if (btnLogout) {
        btnLogout.addEventListener('click', async () => {
            await supabase.auth.signOut();
            window.location.href = 'index.html';
        });
    }
})();
    
    // Filtro de período
    const periodFrom = document.getElementById('periodFrom');
    const periodTo = document.getElementById('periodTo');

    if (periodFrom) {
        periodFrom.addEventListener('change', () => {
            if (periodTo && periodFrom.value > periodTo.value) {
                periodTo.value = periodFrom.value;
            }
            // ✅ Detectar si estamos en tabla de balances o normal
            const analisisContainer = document.getElementById('analisisFilterContainer');
            if (analisisContainer && analisisContainer.classList.contains('visible')) {
                renderBalancesTableOptimized();
            } else {
                renderTable();
            }
            console.log(`📅 Filtro aplicado: ${periodFrom.value} - ${periodTo.value}`);
        });
    }

    if (periodTo) {
        periodTo.addEventListener('change', () => {
            if (periodFrom && periodTo.value < periodFrom.value) {
                periodFrom.value = periodTo.value;
            }
            // ✅ Detectar si estamos en tabla de balances o normal
            const analisisContainer = document.getElementById('analisisFilterContainer');
            if (analisisContainer && analisisContainer.classList.contains('visible')) {
                renderBalancesTableOptimized();
            } else {
                renderTable();
            }
            console.log(`📅 Filtro aplicado: ${periodFrom.value} - ${periodTo.value}`);
        });
    }

    // Filtro de sector financiero
    const sectorFilter = document.getElementById('sectorFilter');
    if (sectorFilter) {
        sectorFilter.addEventListener('change', () => {
            console.log(`🏦 Filtro de sector aplicado: ${sectorFilter.value}`);
            
            // ✅ CORRECCIÓN: Detectar qué tipo de tabla está activa
            const analisisContainer = document.getElementById('analisisFilterContainer');
            const carteraContainer = document.getElementById('carteraFilterContainer');

            if (analisisContainer && analisisContainer.classList.contains('visible')) {
                // Estamos en Balances
                loadBalancesTable(currentCuadroId);
            } else if (carteraContainer && carteraContainer.classList.contains('visible')) {
                // ✅ ESTO ES LO QUE FALTABA: Estamos en Cartera, recargar con nuevo sector
                loadCarteraTable(currentCuadroId);
            } else {
                // Tabla Normal / Estructura General
                renderTable();
            }
        });
    }

// Filtro de análisis (solo para balances)
const analisisFilter = document.getElementById('analisisFilter');
if (analisisFilter) {
    analisisFilter.addEventListener('change', () => {
        console.log(` Tipo de análisis cambiado: ${analisisFilter.value}`);
        if (currentCuadroId) {
            // ✅ DETECTAR si es modo entidad
            const entidadContainer = document.getElementById('entidadFilterContainer');
            const esModoEntidad = entidadContainer && entidadContainer.classList.contains('visible');
            
            if (esModoEntidad || currentCuadroId.startsWith('EFI')) {
                loadBalancesTableEfi(currentCuadroId);
            } else {
                loadBalancesTable(currentCuadroId);
            }
        }
    });
}

    actualizarContadorCarrito();
    
    // Cerrar modal del carrito
    const modalCarrito = document.getElementById('modalCarrito');
    if (modalCarrito) {
        modalCarrito.addEventListener('click', (e) => {
            if (e.target === modalCarrito) {
                cerrarModalCarrito();
            }
        });
    }

    // Filtro de cartera de créditos
const carteraFilter = document.getElementById('carteraFilter');
if (carteraFilter) {
    carteraFilter.addEventListener('change', () => {
        console.log(`📊 Tipo de crédito cambiado: ${carteraFilter.value}`);
        if (currentCuadroId) {
            const entidadContainer = document.getElementById('entidadFilterContainer');
            const esModoEntidad = entidadContainer && entidadContainer.classList.contains('visible');
            
            if (esModoEntidad || currentCuadroId.startsWith('EFI')) {
                loadCarteraTableEfi(currentCuadroId);
            } else {
                loadCarteraTable(currentCuadroId);
            }
        }
    });
}

// Ocultar filtro de cartera por defecto
const carteraContainer = document.getElementById('carteraFilterContainer');
if (carteraContainer) {
    carteraContainer.classList.remove('visible');
}



// ===================================
// CARGAR SELECTOR DE ENTIDADES CON SELECT2
// ===================================
const selectEntidad = document.getElementById('entidadFilter');

if (selectEntidad) {
    fetch(DATA_PATHS.listaEntidades) 
        .then(response => {
            if (!response.ok) throw new Error('No se pudo cargar el archivo de entidades');
            return response.json();
        })
        .then(data => {
            console.log(`✅ Datos recibidos: ${data.length} entidades`);
            
            // 1. Ordenar alfabéticamente
            data.sort((a, b) => a.nombre.localeCompare(b.nombre));
            
            // 2. Guardar en variable global
            window.entidadesData = data;
            
            // 3. Limpiar select
            selectEntidad.innerHTML = '';
            
            const defaultNombre = 'BP. AMAZONAS';
            
            data.forEach(entidad => {
                const option = document.createElement('option');
                option.value = entidad.nombre;
                option.textContent = entidad.nombre;
                if (entidad.nombre === defaultNombre) {
                    option.selected = true;
                }
                selectEntidad.appendChild(option);
            });
            
            console.log(`✅ ${data.length} entidades cargadas en Select2`);
            
            // 4. INICIALIZAR SELECT2
            $(selectEntidad).select2({
                placeholder: 'Buscar entidad financiera...',
                allowClear: true,
                width: '100%',
                dropdownParent: $(document.body),
                language: {
                    noResults: function() {
                        return "No se encontró la entidad";
                    },
                    searching: function() {
                        return "Buscando...";
                    }
                }
            });
            
// 5. EVENTO: Cuando el usuario selecciona una entidad en Select2
$(selectEntidad).on('change', function() {
    const entidadSeleccionada = $(this).val();
    console.log(`🏦 Entidad seleccionada: ${entidadSeleccionada}`);
    
    if (currentCuadroId) {
        if (currentCuadroId === 'EFI06') { 
            loadBalancesTableEfi(currentCuadroId);
        } else if (currentCuadroId === 'EFI07'|| currentCuadroId === 'TEA02') { // <-- Ajusta al ID de tu cuadro de cartera
            loadCarteraTableEfi(currentCuadroId);
        } else {
            loadTableEfi(currentCuadroId);
        }
    }
});


        })
        .catch(error => {
            console.error('❌ Error cargando entidades:', error);
            selectEntidad.innerHTML = '<option value="error">Error al cargar entidades</option>';
        });
}

// ===================================
// CARGAR TABLA POR DEFECTO AL INICIAR
// ===================================
console.log('🚀 Iniciando carga inicial del sistema...');
await loadCarteraData();
loadCarteraTable('TEA01');
});