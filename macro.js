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
            height: 20,
            bottom: 10,
            borderColor: '#cbd5e1',
            fillerColor: 'rgba(30, 58, 138, 0.15)',
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
    series: {
        lineStyle: { width: 2.5 },
        symbolSize: 6,
        itemStyle: { borderWidth: 2 }
    }
};



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
const DATA_FILES = [
    'data/base_anual.json',
    'data/base_mensual.json',
    'data/base_trimestral.json'
];

const NOTAS_FILE = 'data/base_notas.json';
let allDataCache = []; // Cache de todos los datos combinados
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

// ===================================
// CARGAR TODOS LOS ARCHIVOS JSON AL INICIO
// ===================================
async function loadAllDataFiles() {
    console.log('🔄 Cargando todos los archivos de datos...');
    try {
        const promises = DATA_FILES.map(file => fetch(file).then(res => {
            if (!res.ok) throw new Error(`Error cargando ${file}`);
            return res.json();
        }));
        
        const allResults = await Promise.all(promises);
        allDataCache = allResults.flat(); // Combinar todos los arrays en uno solo
        
        console.log(`✅ Todos los datos cargados: ${allDataCache.length} filas totales`);
        return allDataCache;
    } catch (error) {
        console.error('❌ Error cargando archivos:', error);
        return [];
    }
}


// ===================================
// CARGAR TABLA DESDE EL MENÚ
// ===================================

async function loadTable(cuadroId) {
    console.log('🔄 Cargando tabla:', cuadroId);
    currentCuadroId = cuadroId;
    selectedSeries = [];
    
    // Si el cache está vacío, cargar todos los archivos
    if (allDataCache.length === 0) {
        await loadAllDataFiles();
    }
    
    try {
        // Filtrar datos del cache según el cuadroId
        tableData = allDataCache.filter(row => row.Cuadro === cuadroId);
        
        // Cargar notas
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
            return;
        }
        
        const titulo = tableData[0].Titulo_Cuadro;
        const contentTitle = document.getElementById('contentTitle');
        if (contentTitle) {
            contentTitle.textContent = titulo;
        }
        
        const unidad = tableData[0].Unidad;
        const contentSubtitle = document.getElementById('contentSubtitle');
        if (contentSubtitle && unidad) {
            contentSubtitle.textContent = unidad;
        }

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
    }
}

// ===================================
// RENDERIZAR TABLA
// ===================================
function renderTable() {
    const container = document.getElementById('tableContainer');
    if (!container) {
        console.error('❌ No se encontró tableContainer');
        return;
    }
    
    // ✅ DETECTAR TIPO DE DATOS (Anual, Mensual o Trimestral)
    function detectDataType() {
        const firstRow = tableData[0];
        const columns = Object.keys(firstRow);
        
        // Buscar columnas que sean fechas
        const dateColumns = columns.filter(col => {
            return /^\d{4}-\d{2}$/.test(col) ||  // YYYY-MM (mensual)
                   /^\d{4}-T\d$/.test(col) ||     // YYYY-TN (trimestral)
                   /^\d{4}$/.test(col);           // YYYY (anual)
        });
        
        if (dateColumns.some(col => /^\d{4}-\d{2}$/.test(col))) {
            return 'monthly';
        } else if (dateColumns.some(col => /^\d{4}-T\d$/.test(col))) {
            return 'quarterly';
        } else {
            return 'annual';
        }
    }
    
    // ✅ OBTENER TODAS LAS COLUMNAS DE FECHA ORDENADAS
    function getAllDateColumns() {
        const firstRow = tableData[0];
        const columns = Object.keys(firstRow);
        
        return columns.filter(col => {
            return /^\d{4}-\d{2}$/.test(col) ||  // Mensual
                   /^\d{4}-T\d$/.test(col) ||     // Trimestral
                   /^\d{4}$/.test(col);           // Anual
        }).sort();
    }
    
    const dataType = detectDataType();
    const allDateColumns = getAllDateColumns();
    
    console.log(`📊 Tipo de datos detectado: ${dataType}`);
    console.log(`📅 Columnas disponibles: ${allDateColumns.slice(0, 5).join(', ')}...`);
    
    // Filtrar columnas según el período seleccionado
    const fromSelect = document.getElementById('periodFrom');
    const toSelect = document.getElementById('periodTo');
    
    let filteredColumns = allDateColumns;
    
    if (fromSelect && toSelect) {
        const fromDate = fromSelect.value;
        const toDate = toSelect.value;
        
        filteredColumns = allDateColumns.filter(col => {
            return col >= fromDate && col <= toDate;
        });
    }
    
    if (filteredColumns.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-triangle empty-icon"></i>
                <h3>Sin datos en el período seleccionado</h3>
                <p>No hay datos disponibles para el rango seleccionado</p>
            </div>
        `;
        return;
    }
    
    // ===================================
    // CALCULAR NIVEL JERÁRQUICO DE CADA FILA
    // ===================================
    const rowsWithLevel = tableData.map((row, index) => {
        let nivel = 0;
        if (row.Nivel1 && row.Nivel1.toString().trim() !== '') nivel = 1;
        if (row.Nivel2 && row.Nivel2.toString().trim() !== '') nivel = 2;
        if (row.Nivel3 && row.Nivel3.toString().trim() !== '') nivel = 3;
        if (row.Nivel4 && row.Nivel4.toString().trim() !== '') nivel = 4;
        if (row.Nivel5 && row.Nivel5.toString().trim() !== '') nivel = 5;
        if (row.Nivel6 && row.Nivel6.toString().trim() !== '') nivel = 6;
        if (row.Nivel7 && row.Nivel7.toString().trim() !== '') nivel = 7;
        
        return { index, row, nivel };
    });
    
    // ===================================
    // AGRUPAR POR GRUPO
    // ===================================
    const groups = {};
    rowsWithLevel.forEach(item => {
        const groupName = item.row.Grupo || 'Sin Grupo';
        if (!groups[groupName]) groups[groupName] = [];
        groups[groupName].push(item);
    });
    
    // ===================================
    // GENERAR HTML
    // ===================================
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
                            // Formatear el encabezado según el tipo de dato
                            let displayCol = col;
                            if (dataType === 'monthly') {
                                // Convertir "2007-01" a "Ene 2007"
                                const [year, month] = col.split('-');
                                const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 
                                               'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
                                displayCol = `${months[parseInt(month)-1]} ${year}`;
                            } else if (dataType === 'quarterly') {
                                // Convertir "2007-T1" a "T1 2007"
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
        html += `
            <tr class="group-header">
                <td colspan="${4 + filteredColumns.length}">
                    <i class="fas fa-folder-open"></i> ${groupName}
                </td>
            </tr>
        `;
        
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
                    <td>
                        <input type="checkbox" class="custom-checkbox" 
                               data-index="${rowIndex}" 
                               onchange="toggleSeriesCheckbox(this)">
                    </td>
                    <td>
                        <button class="btn-action btn-chart" 
                                onclick="chartSingleSeries(${rowIndex})" 
                                title="Graficar">
                            <i class="fas fa-chart-line"></i>
                        </button>
                    </td>
                    <td>
                        <button class="btn-action btn-cart-add" 
                                onclick="agregarAlCarrito(${rowIndex})" 
                                title="Añadir al carrito">
                            <i class="fas fa-cart-plus"></i>
                        </button>
                    </td>
                    <td class="variable-name" style="padding-left: ${indentPx + 15}px;">
                        ${icono} <span>${row.Variable}</span>
                    </td>
                    ${filteredColumns.map(col => {
                        const valor = row[col];
                        const display = (valor === null || valor === undefined || valor === '' || valor === '-') 
                            ? '-' 
                            : formatNumber(valor);
                        return `<td class="year-value ${nivelClass}">${display}</td>`;
                    }).join('')}
                </tr>
            `;
        });
    });
    
    html += `</tbody></table></div>`;
    container.innerHTML = html;
}

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
    
    html += `
            </div>
        </div>
    `;
    
    notasContainer.innerHTML = html;
    notasContainer.style.display = 'block';
}

function populatePeriodSelectors() {
    const fromSelect = document.getElementById('periodFrom');
    const toSelect = document.getElementById('periodTo');
    if (!fromSelect || !toSelect) return;

    // Obtener todas las columnas de fecha
    const firstRow = tableData[0];
    const allColumns = Object.keys(firstRow);
    
    const dateColumns = allColumns.filter(col => {
        return /^\d{4}-\d{2}$/.test(col) ||  // Mensual
               /^\d{4}-T\d$/.test(col) ||     // Trimestral
               /^\d{4}$/.test(col);           // Anual
    }).sort();
    
    if (dateColumns.length === 0) {
        console.warn('⚠️ No se detectaron columnas de fecha');
        return;
    }
    
    console.log(`📅 Columnas de fecha detectadas: ${dateColumns.length}`);
    
    // Llenar los selectores con todas las fechas disponibles
    fromSelect.innerHTML = dateColumns.map(d => `<option value="${d}">${d}</option>`).join('');
    toSelect.innerHTML = dateColumns.map(d => `<option value="${d}">${d}</option>`).join('');

    // Seleccionar un rango por defecto (últimos 5 años o equivalente)
    if (dateColumns.length >= 60) { // Si hay datos mensuales de 5 años
        fromSelect.value = dateColumns[dateColumns.length - 60];
        toSelect.value = dateColumns[dateColumns.length - 1];
    } else if (dateColumns.length >= 20) { // Si hay datos trimestrales
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
    const row = tableData[index];
    if (checkbox.checked) {
        if (selectedSeries.length >= 10) {
            alert('Máximo 10 series');
            checkbox.checked = false;
            return;
        }
        if (!selectedSeries.find(s => s.index === index)) {
            selectedSeries.push({ 
                index, 
                variable: row.Variable, 
                data: row,
                useRightAxis: false,
                chartType: 'line'  // ← AGREGAR: tipo por defecto
            });
        }
    } else {
        selectedSeries = selectedSeries.filter(s => s.index !== index);
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

    collectionSeries.innerHTML = selectedSeries.map(series => `
        <div class="collection-item">
            <span class="collection-item-name">
                ${series.variable}
                ${series.cuadroNombre ? `<small style="display:block;color:#94a3b8;font-size:0.7rem;font-weight:400;">📊 ${series.cuadroNombre}</small>` : ''}
            </span>
            <div class="collection-item-actions">
                <label class="axis-toggle" title="Usar eje derecho">
                    <input type="checkbox" 
                          ${series.useRightAxis ? 'checked' : ''} 
                          onchange="toggleAxis(${series.index})">
                    <span class="toggle-slider"></span>
                    <small>Eje Der</small>
                </label>
                <label class="chart-type-toggle" title="Cambiar tipo de gráfico">
                    <input type="checkbox" 
                          ${series.chartType === 'bar' ? 'checked' : ''} 
                          onchange="toggleChartType(${series.index})">
                    <span class="toggle-slider"></span>
                    <small>Barra</small>
                </label>
                <button class="btn-action btn-chart" onclick="chartFromCollection(${series.index})">
                    <i class="fas fa-chart-line"></i>
                </button>
                <button class="btn-action btn-delete" onclick="removeFromCollection(${series.index === -1 ? `'${series.idUnico}'` : series.index})">
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
    const series = selectedSeries.find(s => s.index === index);
    if (series) openSingleChartModal(series.variable, series.data);
}

function removeFromCollection(index) {
    // Buscar por índice (para series de tabla) o por idUnico (para series de carrito)
    selectedSeries = selectedSeries.filter(s => {
        if (s.index === -1) {
            // Series del carrito: usar idUnico
            return s.idUnico !== index;
        } else {
            // Series de tabla: usar index numérico
            return s.index !== index;
        }
    });
    
    // Desmarcar checkbox si es de tabla
    if (typeof index === 'number' && index >= 0) {
        const checkbox = document.querySelector(`.custom-checkbox[data-index="${index}"]`);
        if (checkbox) checkbox.checked = false;
    }
    
    updateCollectionPanel();
}

function toggleLabelsVisibility() {
    showLabels = document.getElementById('toggleLabels').checked;
    if (mainChart) renderMainChart();
}


function toggleChartType(index) {
    const series = selectedSeries.find(s => s.index === index);
    if (series) {
        series.chartType = series.chartType === 'line' ? 'bar' : 'line';
        renderMainChart();
    }
}


// ===================================
// FUNCIONES AUXILIARES PARA DETECCIÓN DE FECHAS
// ===================================

// Detectar tipo de dato (anual, mensual, trimestral)
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

// Obtener todas las columnas de fecha ordenadas
function getAllDateColumns(dataRow) {
    const columns = Object.keys(dataRow);
    
    return columns.filter(col => {
        return /^\d{4}-\d{2}$/.test(col) ||  // Mensual (YYYY-MM)
               /^\d{4}-T\d$/.test(col) ||     // Trimestral (YYYY-TN)
               /^\d{4}$/.test(col);           // Anual (YYYY)
    }).sort();
}

// Formatear etiqueta de fecha para visualización
function formatDateLabel(dateStr, dataType) {
    if (dataType === 'monthly') {
        const [year, month] = dateStr.split('-');
        const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 
                       'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        return `${months[parseInt(month)-1]} ${year}`;
    } else if (dataType === 'quarterly') {
        const [year, quarter] = dateStr.split('-');
        return `${quarter} ${year}`;
    }
    return dateStr; // Anual
}

// ===================================
// RENDERIZAR GRÁFICO PRINCIPAL (CON EJES DUALES)
// ===================================

function renderMainChart() {
    if (selectedSeries.length === 0) return;
    const chartDom = document.getElementById('collectionCharts');
    if (!chartDom || typeof echarts === 'undefined') return;
    if (!mainChart) mainChart = echarts.init(chartDom);
    
    // Detectar tipo de dato y obtener columnas
    const dataType = detectDataType(selectedSeries[0].data);
    const allDateColumns = getAllDateColumns(selectedSeries[0].data);
    
    const startPercent = currentChartRange === '5' && allDateColumns.length > 5 
        ? Math.max(0, ((allDateColumns.length - 5) / allDateColumns.length) * 100) 
        : 0;
    
    const unidad = tableData[0] ? tableData[0].Unidad : '';
    
    // Separar valores por eje
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
    
    // Calcular rangos para eje izquierdo
    const leftMin = leftValues.length > 0 ? Math.min(...leftValues) : 0;
    const leftMax = leftValues.length > 0 ? Math.max(...leftValues) : 100;
    const leftRange = leftMax - leftMin;
    const leftPadding = leftRange * 0.1;
    
    // Calcular rangos para eje derecho
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
    
    // Configurar ejes Y dinámicamente
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
    
    // Agregar eje derecho si hay series que lo usen
if (hasRightAxisSeries) {
    // Obtener nombres de las series del eje derecho
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
    
    // Crear etiquetas formateadas para el eje X
    const xAxisLabels = allDateColumns.map(dateCol => formatDateLabel(dateCol, dataType));
    

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
            data: selectedSeries.map(s => s.variable),
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
            name: s.variable,
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
    
    // Detectar tipo de dato y obtener columnas
    const dataType = detectDataType(rowData);
    const allDateColumns = getAllDateColumns(rowData);
    
    const unidad = tableData[0] ? tableData[0].Unidad : '';
    
    const allValues = allDateColumns.map(dateCol => parseFloat(rowData[dateCol])).filter(val => !isNaN(val));
    const minVal = Math.min(...allValues);
    const maxVal = Math.max(...allValues);
    const range = maxVal - minVal;
    const padding = range * 0.1;
    
    const colorPalette = ['#1e3a8a', '#0ea5e9', '#059669', '#d97706', '#dc2626', '#7c3aed', '#db2777', '#0891b2', '#65a30d', '#ea580c'];
    
    // Crear etiquetas formateadas para el eje X
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
    
    // Detectar tipo de dato y obtener columnas
    const dataType = detectDataType(selectedSeries[0].data);
    const allDateColumns = getAllDateColumns(selectedSeries[0].data);
    
    const startPercent = currentChartRange === '5' && allDateColumns.length > 5 
        ? Math.max(0, ((allDateColumns.length - 5) / allDateColumns.length) * 100) 
        : 0;
    
    const unidad = tableData[0] ? tableData[0].Unidad : '';
    
    // Separar valores por eje
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
    
    // Calcular rangos para eje izquierdo
    const leftMin = leftValues.length > 0 ? Math.min(...leftValues) : 0;
    const leftMax = leftValues.length > 0 ? Math.max(...leftValues) : 100;
    const leftRange = leftMax - leftMin;
    const leftPadding = leftRange * 0.1;
    
    // Calcular rangos para eje derecho
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
    
    // Configurar ejes Y dinámicamente
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
    // Obtener nombres de las series del eje derecho
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
    
    // Crear etiquetas formateadas para el eje X
    const xAxisLabels = allDateColumns.map(dateCol => formatDateLabel(dateCol, dataType));
    
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
            data: selectedSeries.map(s => s.variable),
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
            name: s.variable,
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
    const series = selectedSeries.find(s => s.index === index);
    if (series) {
        series.useRightAxis = !series.useRightAxis;
        renderMainChart();
    }
}


// ===================================
// CARRITO PERSISTENTE DE SERIES (SIMPLIFICADO)
// ===================================
let carritoSeries = JSON.parse(localStorage.getItem('carritoSeries')) || [];

// Actualizar contador del carrito al cargar
document.addEventListener('DOMContentLoaded', () => {
    actualizarContadorCarrito();
});

// ===================================
// AGREGAR AL CARRITO DESDE LA TABLA (NUEVO)
// ===================================
function agregarAlCarrito(index) {
    const row = tableData[index];
    if (!row) return;
    
    const cuadroId = currentCuadroId;
    const cuadroNombre = tableData[0]?.Titulo_Cuadro || currentCuadroId;
    
    // Verificar si ya está en el carrito usando index y cuadroId como identificador único
    const existe = carritoSeries.find(s => s.index === index && s.cuadroId === cuadroId);
    
    if (!existe) {
        carritoSeries.push({
            index: index,
            variable: row.Variable,
            cuadroId: cuadroId,
            cuadroNombre: cuadroNombre,
            data: row // Guardamos los datos por si se necesitan en el futuro
        });
        
        localStorage.setItem('carritoSeries', JSON.stringify(carritoSeries));
        actualizarContadorCarrito();
        
        alert(`✅ "${row.Variable}" añadida al carrito.`);
    } else {
        alert(`⚠️ La serie "${row.Variable}" ya se encuentra en el carrito.`);
    }
}

// ===================================
// ABRIR/CERRAR MODAL DEL CARRITO
// ===================================
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

// ===================================
// RENDERIZAR CONTENIDO DEL CARRITO (SOLO LISTA)
// ===================================
// ===================================
// RENDERIZAR CONTENIDO DEL CARRITO (SOLO LISTA)
// ===================================
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
        // Verificar si ya está en el panel
        const idUnico = `${serie.cuadroId}_${serie.variable}`;
        const yaEnPanel = selectedSeries.some(s => s.idUnico === idUnico);
        
        return `
            <div class="carrito-item">
                <div class="carrito-item-info">
                    <span class="carrito-item-variable" title="${serie.variable}">${serie.variable}</span>
                    <span class="carrito-item-cuadro">
                        <i class="fas fa-table"></i> ${serie.cuadroNombre}
                    </span>
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

// ===================================
// AGREGAR AL PANEL DE GRÁFICOS DESDE EL CARRITO
// ===================================
function agregarAlPanelDesdeCarrito(indexCarrito) {
    const serieCarrito = carritoSeries[indexCarrito];
    if (!serieCarrito) return;
    
    // Validar límite de 10 series
    if (selectedSeries.length >= 10) {
        alert('Máximo 10 series en el panel. Elimina alguna para agregar esta.');
        return;
    }
    
    // Crear identificador único
    const idUnico = `${serieCarrito.cuadroId}_${serieCarrito.variable}`;
    
    // Verificar si ya está en el panel
    if (selectedSeries.some(s => s.idUnico === idUnico)) {
        alert(`⚠️ "${serieCarrito.variable}" ya está en el panel de gráficos.`);
        return;
    }
    
    // Agregar al panel con identificador único
    selectedSeries.push({
        index: -1,  // Índice especial para series del carrito
        variable: serieCarrito.variable,
        data: serieCarrito.data,
        useRightAxis: false,
        chartType: 'line',
        idUnico: idUnico,
        cuadroNombre: serieCarrito.cuadroNombre
    });
    
    // Actualizar el panel y el gráfico
    updateCollectionPanel();
    
    // Actualizar el modal del carrito para reflejar el cambio
    renderizarCarrito();
    
    alert(`✅ "${serieCarrito.variable}" añadida al panel de gráficos.`);
}

// ===================================
// ACCIONES DEL CARRITO
// ===================================
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

// Cerrar modal al hacer clic fuera de él
document.addEventListener('click', (e) => {
    const modalCarrito = document.getElementById('modalCarrito');
    if (modalCarrito && e.target === modalCarrito) {
        cerrarModalCarrito();
    }
});

// ===================================
// FUNCIÓN MEJORADA DE DESCARGA DE TABLA
// ===================================
function descargarTabla(formato = 'excel') {
    if (tableData.length === 0) {
        alert('No hay datos para descargar');
        return;
    }

    // Obtener el título del cuadro
    const tituloCuadro = tableData[0].Titulo_Cuadro || currentCuadroId;
    const unidad = tableData[0].Unidad || '';

    // Detectar todas las columnas de datos (excluyendo metadatos)
    const primeraFila = tableData[0];
    const todasLasColumnas = Object.keys(primeraFila);
    
    // Columnas que NO son de datos (metadatos)
    const columnasExcluidas = ['Cuadro', 'Titulo_Cuadro', 'Unidad', 'Grupo', 'Variable', 'Nivel1', 'Nivel2', 'Nivel3', 'Nivel4', 'Nivel5', 'Nivel6', 'Nivel7'];
    
    // Columnas de datos (fechas o períodos)
    const columnasDatos = todasLasColumnas.filter(col => !columnasExcluidas.includes(col)).sort();

    if (formato === 'excel') {
        descargarComoExcel(tituloCuadro, unidad, columnasDatos);
    } else {
        descargarComoCSV(tituloCuadro, unidad, columnasDatos);
    }
}

function descargarComoCSV(titulo, unidad, columnasDatos) {
    // Crear contenido CSV con BOM para Excel
    let csvContent = "\uFEFF"; // BOM para que Excel reconozca UTF-8
    
    // Información del cuadro
    csvContent += `Cuadro: ${titulo}\n`;
    if (unidad) csvContent += `Unidad: ${unidad}\n`;
    csvContent += `\n`;
    
    // Encabezados
    const encabezados = ['Grupo', 'Variable', ...columnasDatos];
    csvContent += encabezados.map(h => `"${h}"`).join(',') + '\n';
    
    // Datos
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
    
    // Crear blob y descargar
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
    // Crear tabla HTML para Excel
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
    
    // Agrupar datos
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
    
    // Crear blob y descargar
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
    // Formatear columnas de fecha
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


// ===================================
// HACER loadTable GLOBAL
// ===================================
window.loadTable = loadTable;

// ===================================
// EVENT LISTENERS
// ===================================
document.addEventListener('DOMContentLoaded', () => {
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
        // Mostrar opciones de descarga
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
    
    console.log('✅ Módulo Macroeconómico cargado correctamente');
    
    // Verificar sesión
    const session = localStorage.getItem('dataFinanciero_session');
    if (!session) {
        window.location.href = 'index.html';
        return;
    }
    
    const user = JSON.parse(session);
    const welcomeUser = document.getElementById('welcomeUser');
    if (welcomeUser) {
        welcomeUser.textContent = `Bienvenido, ${user.username}`;
    }
    
    const btnLogout = document.getElementById('btnLogout');
    if (btnLogout) {
        btnLogout.addEventListener('click', () => {
            localStorage.removeItem('dataFinanciero_session');
            window.location.href = 'index.html';
        });
    }
    
    // ===================================
// FILTRO DE PERÍODO (DESDE / HASTA)
// ===================================
const periodFrom = document.getElementById('periodFrom');
const periodTo = document.getElementById('periodTo');

if (periodFrom) {
    periodFrom.addEventListener('change', () => {
        // Validar que "Desde" no sea mayor que "Hasta"
        if (periodTo && parseInt(periodFrom.value) > parseInt(periodTo.value)) {
            periodTo.value = periodFrom.value;
        }
        renderTable();
        console.log(`📅 Filtro aplicado: ${periodFrom.value} - ${periodTo.value}`);
    });
}

if (periodTo) {
    periodTo.addEventListener('change', () => {
        // Validar que "Hasta" no sea menor que "Desde"
        if (periodFrom && parseInt(periodTo.value) < parseInt(periodFrom.value)) {
            periodFrom.value = periodTo.value;
        }
        renderTable();
        console.log(`📅 Filtro aplicado: ${periodFrom.value} - ${periodTo.value}`);
    });
}


// Cerrar modal al hacer clic fuera

    actualizarContadorCarrito();
    
    // Cerrar modal del carrito al hacer clic fuera
    const modalCarrito = document.getElementById('modalCarrito');
    if (modalCarrito) {
        modalCarrito.addEventListener('click', (e) => {
            if (e.target === modalCarrito) {
                cerrarModalCarrito();
            }
        });
    }

    // Cargar tabla por defecto
    loadTable('IEA111A');
});