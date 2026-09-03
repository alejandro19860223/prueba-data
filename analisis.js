// ===================================
// CONFIGURACIÓN INICIAL
// ===================================
const DATA_PATHS = {
    listaEntidades: 'data/entidades_lista.json',
    carpetaEntidades: 'data/reportes/',
    sistema: 'data/base_estru_sistema.json',
};

let allDataCache = [];
let entidadDataCache = {};
let currentEntidadData = null;
let entidadesMap = {};
let currentCuadroId = '';
let currentMagazineEntity = '';
let sistemaEstructuraData = null;
let allHistoricalData = {};
let showChartLabels = true;

// ✅ CACHE para series originales
let allSeriesCache = {
    histChartActivo: [],
    histChartPasivo: [],
    histChartPatrimonio: [],
    histChartGanancias: []
};

let currentReportType = 'balances';
let lastActivePage = 1;
let allEntitiesData = [];

// ✅ CARGAR ESTRUCTURA DEL SISTEMA
async function loadSistemaEstructura() {
    try {
        const response = await fetch(DATA_PATHS.sistema);
        sistemaEstructuraData = await response.json();
        
    } catch (error) {
        
    }
}

// ===================================
// CARGAR TODAS LAS ENTIDADES (FUNCIÓN FALTANTE)
// ===================================
async function loadAllEntitiesData() {
    try {
        // console.log('🔄 Cargando todas las entidades...');
        
        // Obtener lista de todas las entidades
        const response = await fetch(DATA_PATHS.listaEntidades);
        const entidadesLista = await response.json();
        
        // // console.log('📋 Total de entidades en lista:', entidadesLista.length);
        
        // Cargar datos de cada entidad
        const promises = entidadesLista.map(async (entidad) => {
            try {
                const nombreArchivo = entidad.nombre.normalize('NFD')
                    .replace(/[\u0300-\u036f]/g, '')
                    .replace(/[^A-Za-z0-9]/g, '_');
                const url = `${DATA_PATHS.carpetaEntidades}${nombreArchivo}.json`;
                
                const dataResponse = await fetch(url);
                if (!dataResponse.ok) {
                    console.warn(`⚠️ No se pudo cargar: ${url}`);
                    return null;
                }
                
                const data = await dataResponse.json();
                
                if (!data || data.length === 0) {
                    console.warn(`⚠️ Datos vacíos para: ${entidad.nombre}`);
                    return null;
                }
                
                // Extraer solo la información necesaria (Filtro, Tamaño, Rango_Activos, @1)
                const primeraFila = data[0];
                const entidadInfo = {
                    Filtro: entidad.nombre,
                    Tamaño: primeraFila.Tamaño || 'Desconocido',
                    Rango_Activos: primeraFila.Rango_Activos || 'Desconocido',
                    DPA_PR: primeraFila.DPA_PR || 'Desconocido' // ✅ AGREGAR ESTA LÍNEA
                };
                
                // Agregar valores de activos (@1) para todas las fechas
                const cuentaActivo = data.find(r => r.CUC === '@1' || r.Variable === '@1' || r.CUC === '1');
                
                if (cuentaActivo) {
                    console.log(`✅ Cuenta @1 encontrada para: ${entidad.nombre}`);
                    const dateCols = Object.keys(cuentaActivo).filter(k => /^\d{4}-\d{2}$/.test(k));
                    console.log(`  📅 Columnas de fecha encontradas: ${dateCols.length}`);
                    
                    dateCols.forEach(col => {
                        const valor = parseFloat(cuentaActivo[col]);
                        entidadInfo[col] = isNaN(valor) ? 0 : valor;
                    });
                } else {
                    console.warn(`⚠️ No se encontró cuenta @1 para: ${entidad.nombre}`);
                    console.log('  Primeras filas:', data.slice(0, 2));
                }
                
                return entidadInfo;
            } catch (error) {
                console.error(`❌ Error cargando ${entidad.nombre}:`, error);
                return null;
            }
        });
        
        const results = await Promise.all(promises);
        allEntitiesData = results.filter(e => e !== null);
        
        console.log('✅ Todas las entidades cargadas:', allEntitiesData.length);
        console.log(' Primera entidad cargada:', allEntitiesData[0]);
        
        // Verificar si tenemos datos de fechas
        if (allEntitiesData.length > 0 && allEntitiesData[0]) {
            const fechas = Object.keys(allEntitiesData[0]).filter(k => /^\d{4}-\d{2}$/.test(k));
            console.log(' Fechas disponibles en primera entidad:', fechas.slice(0, 5));
        }
        
    } catch (error) {
        console.error('❌ Error cargando todas las entidades:', error);
    }
}

// ✅ NUEVA FUNCIÓN: Cargar datos de ranking para una cuenta específica y guardarlos en caché
window.rankingDataCache = window.rankingDataCache || {};

async function loadRankingData(cuentaCodigo = '@1') {
    const cacheKey = `ranking_${cuentaCodigo}`;
    
    // Si ya tenemos los datos en caché, los devolvemos inmediatamente
    if (window.rankingDataCache[cacheKey] && window.rankingDataCache[cacheKey].length > 0) {
        return window.rankingDataCache[cacheKey];
    }

    try {
        const response = await fetch(DATA_PATHS.listaEntidades);
        const entidadesLista = await response.json();
        
        const promises = entidadesLista.map(async (entidad) => {
            try {
                const nombreArchivo = entidad.nombre.normalize('NFD')
                    .replace(/[\u0300-\u036f]/g, '')
                    .replace(/[^A-Za-z0-9]/g, '_');
                const url = `${DATA_PATHS.carpetaEntidades}${nombreArchivo}.json`;
                
                const dataResponse = await fetch(url);
                if (!dataResponse.ok) return null;
                
                const data = await dataResponse.json();
                if (!data || data.length === 0) return null;
                
                const primeraFila = data[0];
                const entidadInfo = {
                    Filtro: entidad.nombre,
                    Tamaño: primeraFila.Tamaño || 'Desconocido',
                    Rango_Activos: primeraFila.Rango_Activos || 'Desconocido',
                    DPA_PR: primeraFila.DPA_PR || 'Desconocido' // ✅ AGREGAR ESTA LÍNEA
                };
                
                // ✅ Buscar la cuenta específica (ej. '@14', 'monto_total', 'mop')
                const cuentaData = data.find(r => 
                    (r.CUC && r.CUC.toString().toUpperCase() === cuentaCodigo.toUpperCase()) || 
                    (r.Variable && r.Variable.toString().toUpperCase() === cuentaCodigo.toUpperCase())
                );
                
                if (cuentaData) {
                    const dateCols = Object.keys(cuentaData).filter(k => /^\d{4}-\d{2}$/.test(k));
                    dateCols.forEach(col => {
                        const valor = parseFloat(cuentaData[col]);
                        entidadInfo[col] = isNaN(valor) ? 0 : valor;
                    });
                }
                
                return entidadInfo;
            } catch (error) {
                return null;
            }
        });
        
        const results = await Promise.all(promises);
        const filteredResults = results.filter(e => e !== null);
        
        // Guardar en caché global para no volver a cargarlo
        window.rankingDataCache[cacheKey] = filteredResults;
        return filteredResults;
        
    } catch (error) {
        console.error(`❌ Error cargando datos de ranking para ${cuentaCodigo}:`, error);
        return [];
    }
}

// ===================================
// VERIFICAR SESIÓN
// ===================================

document.addEventListener('DOMContentLoaded', () => {
    loadSistemaEstructura(); // ✅ Cargar estructura al inicio
    
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
    
    updateDateTime();
    setInterval(updateDateTime, 60000);
    initEntidadSelector();
    
});

// ✅ GENERADOR DE GRÁFICOS HISTÓRICOS PROFESIONALES
function createHistoricalChartOption(title, dateLabels, mainSeriesData, additionalSeries = []) {
    const allSeries = [
        {
            name: 'Entidad Actual',
            type: 'line',
            smooth: true,
            data: mainSeriesData,
            lineStyle: { width: 3, color: '#2563eb', shadowBlur: 10, shadowColor: 'rgba(37, 99, 235, 0.4)' },
            areaStyle: { 
                color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                    { offset: 0, color: 'rgba(37, 99, 235, 0.3)' },
                    { offset: 1, color: 'rgba(37, 99, 235, 0.05)' }
                ])
            },
            itemStyle: { color: '#2563eb' },
            symbol: 'circle',
            symbolSize: 6,
            // ✅ AGREGADO: Configuración de etiquetas respetando el switch
            label: {
                show: showChartLabels,
                position: 'top',
                formatter: (p) => formatNumber(p.value),
                fontSize: 9,
                fontWeight: 'bold',
                color: '#2563eb'
            }
        },
        ...additionalSeries.map((series, index) => ({
            name: series.name,
            type: 'line',
            smooth: true,
            data: series.data,
            lineStyle: { width: 2, color: series.color || `hsl(${200 + index * 30}, 70%, 50%)` },
            areaStyle: { opacity: 0.1 },
            itemStyle: { color: series.color || `hsl(${200 + index * 30}, 70%, 50%)` },
            symbol: 'circle',
            symbolSize: 6,
            // ✅ AGREGADO: Configuración de etiquetas respetando el switch
            label: {
                show: showChartLabels,
                position: 'top',
                formatter: (p) => formatNumber(p.value),
                fontSize: 9,
                fontWeight: 'bold',
                color: series.color || `hsl(${200 + index * 30}, 70%, 50%)`
            }
        }))
    ];

    // ✅ Calcular zoom para mostrar solo el último año por defecto
    const totalMonths = dateLabels.length;
    const monthsInYear = 12;
    let zoomStart = 0;
    let zoomEnd = 100;
    
    // Si hay más de 12 meses, mostrar solo los últimos 12
    if (totalMonths > monthsInYear) {
        zoomStart = ((totalMonths - monthsInYear) / totalMonths) * 100;
        zoomEnd = 100;
    }

    return {
        title: { 
            text: title, 
            left: 'center', 
            textStyle: { fontSize: 13, fontWeight: 'bold', color: '#1e3a8a' } 
        },
        tooltip: { 
            trigger: 'axis',
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            borderColor: '#e2e8f0',
            borderWidth: 1,
            textStyle: { color: '#334155', fontSize: 11 },
            valueFormatter: (value) => formatNumber(value)
        },
        legend: { 
            data: allSeries.map(s => s.name),
            orient: 'vertical',   // ✅ Leyendas en vertical
            right: '2%',           // ✅ Posicionadas a la derecha
            top: 'center',         // ✅ Centradas verticalmente
            textStyle: { fontSize: 10, color: '#64748b' },
            type: 'scroll',
            itemWidth: 12,
            itemHeight: 12,
            padding: [5, 10, 5, 5]
        },
        toolbox: {
            show: true, 
            right: '5%', 
            top: '0%',
            feature: {
                saveAsImage: { title: 'Descargar imagen' },
                magicType: { type: ['line', 'bar'], title: { line: 'Líneas', bar: 'Barras' } },
                restore: { title: 'Restaurar' }
            }
        },
        grid: { 
            left: '5%', 
            right: '18%',   // ✅ Aumentado para dar espacio a las leyendas
            bottom: '18%', 
            top: '15%', 
            containLabel: true 
        },
        xAxis: { 
            type: 'category', 
            data: dateLabels, 
            boundaryGap: false,
            axisLabel: { fontSize: 9, color: '#64748b', rotate: 45 },
            axisLine: { lineStyle: { color: '#cbd5e1' } }
        },
        yAxis: { 
            type: 'value',
            axisLabel: { fontSize: 9, color: '#64748b', formatter: (value) => formatNumber(value) },
            splitLine: { lineStyle: { color: '#f1f5f9', type: 'dashed' } }
        },
        dataZoom: [
            { 
                type: 'inside', 
                start: zoomStart,  // ✅ Mostrar últimos 12 meses por defecto
                end: zoomEnd,
                zoomOnMouseWheel: true,
                moveOnMouseMove: true
            },
            { 
                type: 'slider', 
                bottom: 0, 
                start: zoomStart,  // ✅ Mostrar últimos 12 meses por defecto
                end: zoomEnd, 
                height: 20,
                borderColor: '#e2e8f0',
                fillerColor: 'rgba(37, 99, 235, 0.1)',
                backgroundColor: '#f8fafc',
                handleIcon: 'M10.7,11.9v-1.3H9.3v1.3c-4.9,0.3-8.8,4.4-8.8,9.4c0,5,3.9,9.1,8.8,9.4v1.3h1.3v-1.3c4.9-0.3,8.8-4.4,8.8-9.4C19.5,16.3,15.6,12.2,10.7,11.9z M13.3,24.4H6.7v-1.2h6.6V24.4z M13.3,19.6H6.7v-1.2h6.6V19.6z',
                handleSize: '100%',
                handleStyle: {
                    color: '#fff',
                    shadowBlur: 3,
                    shadowColor: 'rgba(0, 0, 0, 0.3)',
                    shadowOffsetX: 2,
                    shadowOffsetY: 2
                }
            }
        ],
        series: allSeries
    };
}

    // ✅ Inicializar cache global si no existe (solo la primera vez)
    if (!window.seriesDataCache) {
        window.seriesDataCache = {
            histChartActivo: [],
            histChartPasivo: [],
            histChartPatrimonio: [],
            histChartGanancias: []
        };
    }

// ✅ PREPARAR GRÁFICOS HISTÓRICOS - CARGA TODA LA SERIE
async function prepareHistoricalCharts() {
    if (!currentMagazineData) {
        
        return;
    }

    // 1. Obtener TODAS las fechas disponibles
    const allDateCols = Object.keys(currentMagazineData[0])
        .filter(k => /^\d{4}-\d{2}$/.test(k))
        .sort();
    
    const dateLabels = allDateCols.map(d => {
        const [y, m] = d.split('-');
        return `${monthsNames[parseInt(m)-1]} ${y}`;
    });

    

    // 2. Función para obtener TODA la serie
    const getFullSeriesData = (code) => {
        const row = currentMagazineData.find(r => r.Variable === code || r.CUC === code);
        if (!row) return allDateCols.map(() => 0);
        return allDateCols.map(d => parseFloat(row[d]) || 0);
    };

    // 3. Buscar nombres de cuentas
    let cuentasPrincipales = { '@1': 'Activo', '@2': 'Pasivo', '@3': 'Patrimonio', 'Gan_Eje': 'Ganancias' };

    if (sistemaEstructuraData) {
        const sfn01 = sistemaEstructuraData.find(c => c.CUADRO === 'SFN01');
        const sfn02 = sistemaEstructuraData.find(c => c.CUADRO === 'SFN02');
        
        if (sfn01) {
            cuentasPrincipales['@1'] = sfn01.CUENTAS?.find(c => c.CUC === '@1')?.DESCRIPCION || 'Activo';
            cuentasPrincipales['@2'] = sfn01.CUENTAS?.find(c => c.CUC === '@2')?.DESCRIPCION || 'Pasivo';
            cuentasPrincipales['@3'] = sfn01.CUENTAS?.find(c => c.CUC === '@3')?.DESCRIPCION || 'Patrimonio';
        }
        if (sfn02) {
            cuentasPrincipales['Gan_Eje'] = sfn02.CUENTAS?.find(c => c.CUC === 'Gan_Eje')?.DESCRIPCION || 'Ganancias';
        }
    }

    // 4. Renderizar los 4 gráficos
    const chartsConfig = [
        { id: 'histChartActivo', code: '@1', title: `Evolución histórica de ${cuentasPrincipales['@1']}` },
        { id: 'histChartPasivo', code: '@2', title: `Evolución histórica de ${cuentasPrincipales['@2']}` },
        { id: 'histChartPatrimonio', code: '@3', title: `Evolución histórica de ${cuentasPrincipales['@3']}` },
        { id: 'histChartGanancias', code: 'Gan_Eje', title: `Evolución histórica de ${cuentasPrincipales['Gan_Eje']}` }
    ];

    chartsConfig.forEach(config => {
        const seriesData = getFullSeriesData(config.code);
        
        // ✅ GUARDAR serie original en cache
        allSeriesCache[config.id] = [{
            name: 'Entidad Actual',
            type: 'line',
            smooth: true,
            data: seriesData,
            lineStyle: { width: 3, color: '#2563eb', shadowBlur: 10, shadowColor: 'rgba(37, 99, 235, 0.4)' },
            areaStyle: { 
                color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                    { offset: 0, color: 'rgba(37, 99, 235, 0.3)' },
                    { offset: 1, color: 'rgba(37, 99, 235, 0.05)' }
                ])
            },
            itemStyle: { color: '#2563eb' },
            symbol: 'circle',
            symbolSize: 6,
            label: {
                show: showChartLabels,
                position: 'top',
                formatter: (p) => formatNumber(p.value),
                fontSize: 9,
                fontWeight: 'bold',
                color: '#2563eb'
            }
        }];
        
        // ✅ CREAR opción inicial con la serie original
        const option = createHistoricalChartOption(config.title, dateLabels, seriesData);
        initEchart(config.id, option);
        
        // ✅ APLICAR series adicionales del cache global SI EXISTEN
        if (window.seriesDataCache && window.seriesDataCache[config.id] && window.seriesDataCache[config.id].length > 0) {
            const chart = echarts.getInstanceByDom(document.getElementById(config.id));
            if (chart) {
                // ✅ ACTUALIZAR label.show de todas las series del cache
                window.seriesDataCache[config.id].forEach(series => {
                    if (series.label) {
                        series.label.show = showChartLabels;
                    }
                });
                
                const allSeries = [
                    allSeriesCache[config.id][0],
                    ...window.seriesDataCache[config.id]
                ].filter(s => s);
                
                chart.setOption({
                    series: allSeries,
                    legend: { data: allSeries.map(s => s.name).filter(n => n) }
                }, { replaceMerge: ['series'] });
            }
        }
    });

    // 5. Generar checkboxes con TODAS las entidades
    generateAllSeriesCheckboxes();
}

// ✅ GENERAR CHECKBOXES CON SECTORES FINANCIEROS (VERSIÓN FINAL)
async function generateAllSeriesCheckboxes() {
    const list = document.getElementById('historicalSeriesList');
    if (!list) return;

    try {
        if (!sistemaEstructuraData) {
            await loadSistemaEstructura();
        }

        

        // Filtrar filas donde Cuadro sea SFN01 o SFN02
        const filasSFN = sistemaEstructuraData.filter(fila => 
            fila.Cuadro === 'SFN01' || fila.Cuadro === 'SFN02'
        );

        if (filasSFN.length === 0) {
            
            list.innerHTML = '<p style="color: #ef4444; font-size: 11px;">Error: No se encontraron los sectores</p>';
            return;
        }

        // Extraer valores únicos de la columna "Filtro"
        const sectoresUnicos = [...new Set(filasSFN.map(fila => fila.Filtro).filter(f => f))];

        

        if (sectoresUnicos.length === 0) {
            list.innerHTML = '<p style="color: #ef4444; font-size: 11px;">No hay sectores disponibles</p>';
            return;
        }

        // ✅ CORRECCIÓN: Marcar checkboxes basándose en window.seriesDataCache
        list.innerHTML = `
            ${sectoresUnicos.map(sect => {
                // ✅ Verificar si este sector está en el cache (está activo)
                const isActive = window.seriesDataCache && 
                    Object.values(window.seriesDataCache).some(cacheArray => 
                        cacheArray.some(s => s.name === sect)
                    );
                
                return `
                    <label>
                        <input type="checkbox" value="${sect}" data-nombre="${sect}" 
                               onchange="toggleHistoricalSeries(this)" ${isActive ? 'checked' : ''}>
                        ${sect}
                    </label>
                `;
            }).join('')}
        `;

        
    } catch (error) {
        
        list.innerHTML = '<p style="color: #ef4444; font-size: 11px;">Error cargando sectores</p>';
    }
}

// ✅ AGREGAR/QUITAR SERIES - CON replaceMerge (ECharts 5.x)
async function toggleHistoricalSeries(checkbox) {
    const sectorNombre = checkbox.value;
    
    if (!window.seriesDataCache) {
        window.seriesDataCache = {
            histChartActivo: [],
            histChartPasivo: [],
            histChartPatrimonio: [],
            histChartGanancias: []
        };
    }
    
    if (checkbox.checked) {
        try {
            showMessage(`Cargando ${sectorNombre}...`, 'info');
            
            const filasSector = sistemaEstructuraData.filter(fila => 
                (fila.Cuadro === 'SFN01' || fila.Cuadro === 'SFN02') &&
                fila.Filtro === sectorNombre
            );

            if (filasSector.length === 0) {
                checkbox.checked = false;
                showMessage(`No hay datos para ${sectorNombre}`, 'error');
                return;
            }

            const allDateCols = Object.keys(currentMagazineData[0])
                .filter(k => /^\d{4}-\d{2}$/.test(k))
                .sort();
            
            const chartsIds = ['histChartActivo', 'histChartPasivo', 'histChartPatrimonio', 'histChartGanancias'];
            const codes = ['@1', '@2', '@3', 'Gan_Eje'];

            codes.forEach((code, index) => {
                const chartId = chartsIds[index];
                const chart = echarts.getInstanceByDom(document.getElementById(chartId));
                if (!chart) return;

                const filaCuenta = filasSector.find(f => f.CUC === code);
                if (!filaCuenta) return;

                const seriesData = allDateCols.map(dateCol => {
                    const valor = parseFloat(filaCuenta[dateCol]);
                    return isNaN(valor) ? 0 : valor;
                });

                if (window.seriesDataCache[chartId].some(s => s.name === sectorNombre)) return;

                // ✅ AGREGADO: Propiedad label para que respete el switch
                window.seriesDataCache[chartId].push({
                    name: sectorNombre,
                    type: 'line',
                    smooth: true,
                    data: seriesData,
                    lineStyle: { width: 2 },
                    areaStyle: { opacity: 0.1 },
                    label: {
                        show: showChartLabels,
                        position: 'top',
                        formatter: (p) => formatNumber(p.value),
                        fontSize: 9,
                        fontWeight: 'bold'
                    }
                });

                const currentOption = chart.getOption();
                const originalSeries = currentOption.series[0];
                const allSeries = [originalSeries, ...window.seriesDataCache[chartId]].filter(s => s);
                
                chart.setOption({
                    series: allSeries,
                    legend: { data: allSeries.map(s => s.name).filter(n => n) }
                }, { replaceMerge: ['series'] });
            });

            showMessage(`${sectorNombre} agregado`, 'success');
        } catch (error) {
            checkbox.checked = false;
            
            showMessage(`Error: ${error.message}`, 'error');
        }
    } else {
        const chartsIds = ['histChartActivo', 'histChartPasivo', 'histChartPatrimonio', 'histChartGanancias'];
        
        chartsIds.forEach(chartId => {
            const chart = echarts.getInstanceByDom(document.getElementById(chartId));
            if (!chart) return;

            window.seriesDataCache[chartId] = window.seriesDataCache[chartId].filter(s => s.name !== sectorNombre);

            const currentOption = chart.getOption();
            const originalSeries = currentOption.series[0];
            const allSeries = [originalSeries, ...window.seriesDataCache[chartId]].filter(s => s);
            
            chart.setOption({
                series: allSeries,
                legend: { data: allSeries.map(s => s.name).filter(n => n) }
            }, { replaceMerge: ['series'] });
        });
    }
}

// ✅ GENERADOR DE GRÁFICOS PROFESIONALES REUTILIZABLE
function createProfessionalChartOption(title, xAxisData, seriesConfig) {
    const formatValue = (val) => val.toLocaleString('es-EC', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    const shadowStyle = { shadowBlur: 10, shadowColor: 'rgba(0, 0, 0, 0.15)', shadowOffsetY: 5 };

    return {
        title: { text: title, left: 'center', textStyle: { fontSize: 14, fontWeight: 'bold', color: '#1e3a8a' } },
        tooltip: { 
            trigger: 'axis', axisPointer: { type: 'shadow', shadowStyle: { color: 'rgba(0,0,0,0.05)' } },
            backgroundColor: 'rgba(255, 255, 255, 0.95)', borderColor: '#e2e8f0', borderWidth: 1,
            textStyle: { color: '#334155', fontSize: 12 },
            valueFormatter: (value) => formatValue(value)
        },
        toolbox: {
            show: true, right: '5%', top: '0%',
            feature: {
                saveAsImage: { title: 'Descargar imagen' },
                magicType: { type: ['line', 'bar'], title: { line: 'Líneas', bar: 'Barras' } },
                restore: { title: 'Restaurar' }
            }
        },
        legend: { data: seriesConfig.map(s => s.name), bottom: 0, textStyle: { fontSize: 11, color: '#64748b' } },
        grid: { left: '5%', right: '5%', bottom: '15%', top: '18%', containLabel: true },
        xAxis: { 
            type: 'category', data: xAxisData,
            name: 'Meses', nameLocation: 'middle', nameGap: 25,
            nameTextStyle: { fontSize: 11, color: '#94a3b8', fontWeight: '600' },
            axisLine: { lineStyle: { color: '#cbd5e1' } }, axisTick: { show: false },
            axisLabel: { fontSize: 10, color: '#64748b' }
        },
        yAxis: { 
            type: 'value', name: 'millones USD',
            nameTextStyle: { fontSize: 11, color: '#94a3b8', fontWeight: '600', padding: [0, 0, 0, -30] },
            splitLine: { show: false }, axisLabel: { fontSize: 10, color: '#64748b' }
        },
        series: seriesConfig.map(config => ({
            type: 'bar', barWidth: '35%', ...config,
            itemStyle: { borderRadius: [4, 4, 0, 0], ...shadowStyle, ...(config.itemStyle || {}) },
            lineStyle: { width: 3, shadowBlur: 8, ...(config.lineStyle || {}) },
            areaStyle: { opacity: 0.1, ...(config.areaStyle || {}) },
            label: {
                show: showChartLabels, position: 'top',
                formatter: (p) => formatValue(p.value),
                fontSize: 9, fontWeight: 'bold', ...(config.label || {})
            }
        }))
    };
}

function populateSelectors() {
    const yearSel = document.getElementById('yearSelector');
    const monthSel = document.getElementById('monthSelector');
    const labelsToggle = document.getElementById('showLabelsToggle'); 
    
    yearSel.innerHTML = availableYears.map(y => `<option value="${y}" ${y===currentYear?'selected':''}>${y}</option>`).join('');
    monthSel.innerHTML = monthsNames.map((m, i) => {
        const mNum = String(i+1).padStart(2, '0');
        return `<option value="${mNum}" ${mNum===currentMonth?'selected':''}>${m}</option>`;
    }).join('');
    
    yearSel.onchange = () => { currentYear = yearSel.value; updateMagazineContent(); };
    monthSel.onchange = () => { currentMonth = monthSel.value; updateMagazineContent(); };
    
    if(labelsToggle) {
        const newToggle = labelsToggle.cloneNode(true);
        labelsToggle.parentNode.replaceChild(newToggle, labelsToggle);
        
        newToggle.addEventListener('change', (e) => {
            showChartLabels = e.target.checked;
            
            updateMagazineContent(); 
        });
    }
}

function updateDateTime() {
    const now = new Date();
    const options = { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true };
    const formattedDate = now.toLocaleDateString('es-EC', options);
    
    const dateTimeElement = document.getElementById('currentDateTime');
    if (dateTimeElement) {
        dateTimeElement.textContent = formattedDate;
    }
}

function downloadMagazinePDF() {
    const allPages = document.querySelectorAll('.magazine-page');
    const currentPage = document.querySelector('.magazine-page.active');
    
    if (!currentPage) return;
    
    let currentPageNum = 1;
    allPages.forEach((page, index) => {
        if (page === currentPage) {
            currentPageNum = index + 1;
        }
    });

    // Mostrar todas las páginas temporalmente para imprimir
    allPages.forEach(page => {
        page.style.display = 'block';
        page.style.visibility = 'visible';
        page.style.position = 'relative';
        page.style.height = 'auto';
        page.style.opacity = '1';
    });

    setTimeout(() => {
        // ✅ Lista completa CON LOS GRÁFICOS DE LAS PÁGINAS 6, 7, 8 AGREGADOS
        const chartIds = [
            'chartActivo', 'chartPasivo', 'chartPatrimonio',
            'histChartActivo', 'histChartPasivo', 'histChartPatrimonio', 'histChartGanancias',
            'chartBarrasApiladas', 'chartBarrasCuentas', 'chartHistoricoEstructura',
            'chartBarrasImproductivos', 'chartBarrasCuentasImproductivas', 'chartHistoricoImproductivos',
            'chartRanking', 'chartRanking_Pasivo', 'chartRanking_Cartera', 'chartRanking_MOA', 'chartRanking_MOP',
            'chartComparativoPyG', 'chartSankeyPyG',
            'chartComparativoPyGAnual', 'chartSankeyPyGAnual',
            'chartHistoricoCartera', 'chartComposicionCartera', 'chartMorosidad',
            'chartMiniIf012', 'chartMiniSb036', 'chartMiniSb037', 
            'chartMiniSb038', 'chartMiniSb039', 'chartMiniSb040',
            'chartHistoricoCarteraProd', 'chartHistoricoRefiRees',
            'chartComposicionCarteraProd', 'chartMorosidadProd',
            'chartMini1425', 'chartMini1433', 'chartMini1441',
            'chartMini1449', 'chartMini1457', 'chartMini1465',
            
            // ✅ AGREGADOS: Gráficos de páginas 6, 7, 8
            'chartBarrasApiladasPasivo', 'chartBarrasCuentasPasivo', 'chartHistoricoEstructuraPasivo',
            'chartBarrasApiladasExigible', 'chartBarrasCuentasExigible', 'chartHistoricoEstructuraExigible',
            'chartBarrasApiladasPasivoExigible', 'chartBarrasCuentasPasivoExigible', 'chartHistoricoPasivoExigible',

            'chartComparativoPyG', 'chartHistoricoEstructuraPYG', 
            
            'chartComparativoPyGAnual', 'chartHistoricoEstructuraPYGANUAL',

            'chartHistoricoCarteraCons', 'chartComposicionCarteraCons', 'chartMorosidadCons', 'chartMini1426', 'chartMini1434', 
            'chartMini1442', 'chartMini1450', 'chartMini1458', 'chartMini1466',

            'chartHistoricoCarteraInmo', 'chartHistoricoRefiReesInmo', 'chartMorosidadInmo', 'chartMini1427', 'chartMini1435', 
            'chartMini1443', 'chartMini1451', 'chartMini1459', 'chartMini1467',

            'chartHistoricoCarteraMicro', 'chartHistoricoRefiReesMicro', 'chartMorosidadMicro', 'chartMini1428', 'chartMini1436', 
            'chartMini1444', 'chartMini1452', 'chartMini1460', 'chartMini1468'  ,

            'chartTurbulenciaProductiva', 'chartTurbulenciaConsumo',
            'chartTurbulenciaInmo', 'chartTurbulenciaMicro',
            
            'chartHistoricoActivas', 'chartHistoricoPasivas', 
            'chartComposicionActivas', 'chartComposicionDepositos',

            'chartHistoricoMontoSegProd', 'chartHistoricoNumSegProd', 
            'chartComposicionMontoSegProd', 'chartComposicionNumSegProd',
            'chartMiniProCor', 'chartMiniProProc', 'chartMiniProProdem', 'chartMiniProProdpy',

            'chartHistoricoMontoSegCons', 'chartHistoricoNumSegCons', 
            'chartComposicionMontoSegCons', 'chartComposicionNumSegCons',
            'chartMiniCons', 'chartMiniEdu', 'chartMiniEduso',

            'chartHistoricoMontoSegInmo', 'chartHistoricoNumSegInmo', 
            'chartComposicionMontoSegInmo', 'chartComposicionNumSegInmo',
            'chartMiniProIn', 'chartMiniProVip', 'chartMiniProVis',

            'chartHistoricoMontoSegMic', 'chartHistoricoNumSegMic', 
            'chartComposicionMontoSegMic', 'chartComposicionNumSegMic',
            'chartMiniProMic', 'chartMiniProMino', 'chartMiniProMas', 'chartMiniProMaa',

            'chartHistoricoMontoSegPas', 'chartHistoricoNumSegPas', 
            'chartComposicionMontoSegPas', 'chartComposicionNumSegPas',
            'chartMiniProMop', 'chartMiniProOp30', 'chartMiniProOp61', 
            'chartMiniProOp91', 'chartMiniProOp121', 'chartMiniProOp181', 'chartMiniProOp361',

            'chartIndicador1', 'chartIndicador2', 'chartIndicador3',
            'chartIndicador4', 'chartIndicador5', 'chartIndicador6',
            'chartIndicador7', 'chartIndicador8', 'chartIndicador9',

            'chartCamels', 'chartPerlas',

            'chartInd29_1', 'chartInd29_2', 'chartInd29_3',
            'chartInd29_4', 'chartInd29_5', 'chartInd29_6',
            'chartInd29_7', 'chartInd29_8', 'chartInd29_9',

            'chartInd30_1', 'chartInd30_4', 'chartInd30_7',

            'chartInd31_1', 'chartInd31_2', 'chartInd31_3',
            'chartInd31_4', 'chartInd31_5', 'chartInd31_6',
            'chartInd31_7', 'chartInd31_8', 'chartInd31_9',
        ];
        
        chartIds.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                const chart = echarts.getInstanceByDom(element);
                if (chart) chart.resize();
            }
        });

        setTimeout(() => {
            window.print();
            
            const restoreState = () => {
                window.removeEventListener('focus', restoreState);
                
                setTimeout(() => {
                    allPages.forEach((page, index) => {
                        page.style.display = '';
                        page.style.visibility = '';
                        page.style.width = '100%';
                        page.style.opacity = '';
                        page.style.position = '';
                        page.style.height = '';
                        
                        if (index + 1 === currentPageNum) {
                            page.classList.add('active');
                        } else {
                            page.classList.remove('active');
                        }
                    });
                    
                    const dots = document.querySelectorAll('.dot');
                    dots.forEach((dot, index) => {
                        if (index + 1 === currentPageNum) {
                            dot.classList.add('active');
                        } else {
                            dot.classList.remove('active');
                        }
                    });
                    
                    setTimeout(() => {
                        // Redimensionar gráficos según la página actual (MISMO CÓDIGO QUE YA FUNCIONABA)
                        if (currentPageNum === 1) {
                            ['chartActivo', 'chartPasivo', 'chartPatrimonio'].forEach(id => {
                                const chart = echarts.getInstanceByDom(document.getElementById(id));
                                if (chart) chart.resize();
                            });
                        } else if (currentPageNum === 2) {
                            ['histChartActivo', 'histChartPasivo', 'histChartPatrimonio', 'histChartGanancias'].forEach(id => {
                                const chart = echarts.getInstanceByDom(document.getElementById(id));
                                if (chart) chart.resize();
                            });
                        } else if (currentPageNum === 3) {
                            ['chartBarrasApiladas', 'chartBarrasCuentas', 'chartHistoricoEstructura'].forEach(id => {
                                const chart = echarts.getInstanceByDom(document.getElementById(id));
                                if (chart) chart.resize();
                            });

                        } else if (currentPageNum === 4) {
                            ['chartBarrasImproductivos', 'chartBarrasCuentasImproductivas', 'chartHistoricoImproductivos'].forEach(id => {
                                const chart = echarts.getInstanceByDom(document.getElementById(id));
                                if (chart) chart.resize();
                            });

                        } else if (currentPageNum === 5) {
                            const chart = echarts.getInstanceByDom(document.getElementById('chartRanking'));
                            if (chart) chart.resize();

                        } else if (currentPageNum === 6) {
                            ['chartBarrasApiladasPasivo', 'chartBarrasCuentasPasivo', 'chartHistoricoEstructuraPasivo'].forEach(id => {
                                const chart = echarts.getInstanceByDom(document.getElementById(id));
                                if (chart) chart.resize();
                            });

                        } else if (currentPageNum === 7) {
                            ['chartBarrasApiladasExigible', 'chartBarrasCuentasExigible', 'chartHistoricoEstructuraExigible'].forEach(id => {
                                const chart = echarts.getInstanceByDom(document.getElementById(id));
                                if (chart) chart.resize();
                            });

                        } else if (currentPageNum === 8) {
                            ['chartBarrasApiladasPasivoExigible', 'chartBarrasCuentasPasivoExigible', 'chartHistoricoPasivoExigible'].forEach(id => {
                                const chart = echarts.getInstanceByDom(document.getElementById(id));
                                if (chart) chart.resize();
                            });

                        } else if (currentPageNum === 9) {
                            const chart = echarts.getInstanceByDom(document.getElementById('chartRanking_Pasivo'));
                            if (chart) chart.resize();

                        } else if (currentPageNum === 10) {
                            ['chartComparativoPyG', 'chartHistoricoEstructuraPYG'].forEach(id => {
                                const chart = echarts.getInstanceByDom(document.getElementById(id));
                                if (chart) chart.resize();
                            });

                        } else if (currentPageNum === 11) {
                            ['chartComparativoPyGAnual', 'chartHistoricoEstructuraPYGANUAL'].forEach(id => {
                                const chart = echarts.getInstanceByDom(document.getElementById(id));
                                if (chart) chart.resize();
                            });

                        } else if (currentPageNum === 12) {
                            ['chartHistoricoCartera', 'chartComposicionCartera', 'chartMorosidad',
                             'chartMiniIf012', 'chartMiniSb036', 'chartMiniSb037', 
                             'chartMiniSb038', 'chartMiniSb039', 'chartMiniSb040'].forEach(id => {
                                const chart = echarts.getInstanceByDom(document.getElementById(id));
                                if (chart) chart.resize();
                            });

                        } else if (currentPageNum === 13) {
                            ['chartHistoricoCarteraProd', 'chartHistoricoRefiRees',
                             'chartComposicionCarteraProd', 'chartMorosidadProd',
                             'chartMini1425', 'chartMini1433', 'chartMini1441',
                             'chartMini1449', 'chartMini1457', 'chartMini1465'].forEach(id => {
                                const chart = echarts.getInstanceByDom(document.getElementById(id));
                                if (chart) chart.resize();
                            });

                        } else if (currentPageNum === 14) {
                            ['chartHistoricoCarteraCons', 'chartHistoricoRefiReesCons',
                             'chartComposicionCarteraCons', 'chartMorosidadCons',
                             'chartMini1426', 'chartMini1434', 'chartMini1442',
                             'chartMini1450', 'chartMini1458', 'chartMini1466'].forEach(id => {
                                const chart = echarts.getInstanceByDom(document.getElementById(id));
                                if (chart) chart.resize();
                            });

                        } else if (currentPageNum === 15) {
                            ['chartHistoricoCarteraInmo', 'chartHistoricoRefiReesInmo',
                             'chartComposicionCarteraInmo', 'chartMorosidadInmo',
                             'chartMini1427', 'chartMini1435', 'chartMini1443',
                             'chartMini1451', 'chartMini1459', 'chartMini1467'].forEach(id => {
                                const chart = echarts.getInstanceByDom(document.getElementById(id));
                                if (chart) chart.resize();
                            });

                        } else if (currentPageNum === 16) {
                            ['chartHistoricoCarteraMicro', 'chartHistoricoRefiReesMicro',
                             'chartComposicionCarteraMicro', 'chartMorosidadMicro',
                             'chartMini1428', 'chartMini1436', 'chartMini1444',
                             'chartMini1452', 'chartMini1460', 'chartMini1468'].forEach(id => {
                                const chart = echarts.getInstanceByDom(document.getElementById(id));
                                if (chart) chart.resize();
                            });

                        } else if (currentPageNum === 17) {
                            ['chartTurbulenciaProductiva', 'chartTurbulenciaConsumo',
                             'chartTurbulenciaInmo', 'chartTurbulenciaMicro'].forEach(id => {
                                const chart = echarts.getInstanceByDom(document.getElementById(id));
                                if (chart) chart.resize();
                            });

                        } else if (currentPageNum === 18) {
                            renderOperacionesActivasPasivasPage();
                            ['chartHistoricoActivas', 'chartHistoricoPasivas', 
                            'chartComposicionActivas', 'chartComposicionDepositos'].forEach(id => {
                                const chart = echarts.getInstanceByDom(document.getElementById(id));
                                if (chart) chart.resize();
                            });

                        } else if (currentPageNum === 19) {
                            renderSegProductivoPage();
                            ['chartHistoricoMontoSegProd', 'chartHistoricoNumSegProd', 
                            'chartComposicionMontoSegProd', 'chartComposicionNumSegProd',
                            'chartMiniProCor', 'chartMiniProProc', 'chartMiniProProdem', 'chartMiniProProdpy'].forEach(id => {
                                const chart = echarts.getInstanceByDom(document.getElementById(id));
                                if (chart) chart.resize();
                            });

                        } else if (currentPageNum === 20) {
                            renderSegConsPage();
                            ['chartHistoricoMontoSegCons', 'chartHistoricoNumSegCons', 
                            'chartComposicionMontoSegCons', 'chartComposicionNumSegCons',
                            'chartMiniCons', 'chartMiniEdu', 'chartMiniEduso'].forEach(id => {
                                const chart = echarts.getInstanceByDom(document.getElementById(id));
                                if (chart) chart.resize();
                            });

                        } else if (currentPageNum === 21) {
                            renderSegInmobiliarioPage();
                            ['chartHistoricoMontoSegInmo', 'chartHistoricoNumSegInmo', 
                            'chartComposicionMontoSegInmo', 'chartComposicionNumSegInmo',
                            'chartMiniProIn', 'chartMiniProVip', 'chartMiniProVis'].forEach(id => {
                                const chart = echarts.getInstanceByDom(document.getElementById(id));
                                if (chart) chart.resize();
                            });

                        } else if (currentPageNum === 23) {
                            renderSegPasivasPage();
                            ['chartHistoricoMontoSegPas', 'chartHistoricoNumSegPas', 
                            'chartComposicionMontoSegPas', 'chartComposicionNumSegPas',
                            'chartMiniProMop', 'chartMiniProOp30', 'chartMiniProOp61', 
                            'chartMiniProOp91', 'chartMiniProOp121', 'chartMiniProOp181', 'chartMiniProOp361'].forEach(id => {
                                const chart = echarts.getInstanceByDom(document.getElementById(id));
                                if (chart) chart.resize();
                            });

                        } else if (currentPageNum === 24) {
                            renderRankingCarteraTable();
                            const chart = echarts.getInstanceByDom(document.getElementById('chartRanking_Cartera'));
                            if (chart) chart.resize();

                        } else if (currentPageNum === 25) {
                            renderRankingMOATable();
                            const chart = echarts.getInstanceByDom(document.getElementById('chartRanking_MOA'));
                            if (chart) chart.resize();

                        } else if (currentPageNum === 26) {
                            renderRankingMOPTable();
                            const chart = echarts.getInstanceByDom(document.getElementById('chartRanking_MOP'));
                            if (chart) chart.resize();

                        } else if (currentPageNum === 27) {
                            renderIndicadoresPage();
                            ['chartIndicador1', 'chartIndicador2', 'chartIndicador3',
                            'chartIndicador4', 'chartIndicador5', 'chartIndicador6',
                            'chartIndicador7', 'chartIndicador8', 'chartIndicador9'].forEach(id => {
                                const chart = echarts.getInstanceByDom(document.getElementById(id));
                                if (chart) chart.resize();
                            });

                        } else if (currentPageNum === 28) {
                            renderPage28();
                            ['chartCamels', 'chartPerlas'].forEach(id => {
                                const chart = echarts.getInstanceByDom(document.getElementById(id));
                                if (chart) chart.resize();
                            });

                        } else if (currentPageNum === 29) {
                            renderIndicadoresPage29();
                            ['chartInd29_1', 'chartInd29_2', 'chartInd29_3',
                             'chartInd29_4', 'chartInd29_5', 'chartInd29_6',
                             'chartInd29_7', 'chartInd29_8', 'chartInd29_9'].forEach(id => {
                                const chart = echarts.getInstanceByDom(document.getElementById(id));
                                if (chart) chart.resize();
                            });

                        } else if (currentPageNum === 30) {
                            renderIndicadoresPage30();
                            ['chartInd30_1',
                             'chartInd30_4',
                             'chartInd30_7',].forEach(id => {
                                const chart = echarts.getInstanceByDom(document.getElementById(id));
                                if (chart) chart.resize();
                            });

                        } else if (currentPageNum === 31) {
                            renderIndicadoresPage31();
                            ['chartInd31_1', 'chartInd31_2', 'chartInd31_3',
                             'chartInd31_4', 'chartInd31_5', 'chartInd31_6',
                             'chartInd31_7', 'chartInd31_8', 'chartInd31_9'].forEach(id => {
                                const chart = echarts.getInstanceByDom(document.getElementById(id));
                                if (chart) chart.resize();
                            });

                        }


                    }, 200);
                }, 100);
            };

            window.addEventListener('focus', restoreState);
            
            setTimeout(() => {
                window.removeEventListener('focus', restoreState);
                restoreState();
            }, 1000);
            
        }, 300);
    }, 100);
}


function subtractMonths(yearStr, monthStr, monthsToSubtract) {
    let y = parseInt(yearStr);
    let m = parseInt(monthStr) - 1;
    m -= monthsToSubtract;
    while (m < 0) { m += 12; y--; }
    return `${y}-${String(m + 1).padStart(2, '0')}`;
}

async function loadEntidadData(entidadNombre) {
    if (entidadDataCache[entidadNombre]) {
        // console.log(`💾 Usando caché para: ${entidadNombre}`);
        return entidadDataCache[entidadNombre];
    }
    
    // console.log(`🔄 Cargando datos bajo demanda de: ${entidadNombre}`);
    
    try {
        const nombreArchivo = entidadNombre.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9]/g, '_');
        const url = `${DATA_PATHS.carpetaEntidades}${nombreArchivo}.json`;
        
        const response = await fetch(url);
        if (!response.ok) throw new Error(`No se encontró el archivo: ${url}`);
        
        const data = await response.json();
        entidadDataCache[entidadNombre] = data;
        // console.log(`✅ Entidad cargada exitosamente: ${data.length} filas`);
        
        return data;
    } catch (error) {
        // console.error(`❌ Error cargando entidad ${entidadNombre}:`, error);
        return [];
    }
}


// Función para actualizar información de la entidad
async function updateEntityInfo(entidadNombre) {
    const entityInfoPanel = document.getElementById('entityInfoPanel');
    const entityNameDisplay = document.getElementById('entityNameDisplay');
    const entityTamaño = document.getElementById('entityTamaño');
    const entityRangoActivos = document.getElementById('entityRangoActivos');
    
    if (!entityInfoPanel || !entidadNombre || entidadNombre === 'todas') {
        if (entityInfoPanel) entityInfoPanel.style.display = 'none';
        return;
    }
    
    // Si allEntitiesData está vacío, cargarlo
    if (allEntitiesData.length === 0) {
        await loadAllEntitiesData();
    }
    
    // Buscar la entidad en allEntitiesData (que tiene Tamaño y Rango_Activos)
    const entidadData = allEntitiesData.find(e => e.Filtro === entidadNombre);
    
    if (entidadData) {
        entityNameDisplay.textContent = entidadNombre;
        entityTamaño.textContent = entidadData.Tamaño || 'No disponible';
        entityRangoActivos.textContent = entidadData.Rango_Activos || 'No disponible';
        entityInfoPanel.style.display = 'block';
        // console.log('✅ Información actualizada:', entidadData);
    } else {
        // console.warn('⚠️ Entidad no encontrada en allEntitiesData:', entidadNombre);
    }
}

function initEntidadSelector() {
    const selectEntidad = document.getElementById('entidadFilter');
    if (!selectEntidad) return;
    
    fetch(DATA_PATHS.listaEntidades) 
        .then(response => {
            if (!response.ok) throw new Error('No se pudo cargar el archivo de entidades');
            return response.json();
        })
        .then(data => {
            // console.log(`✅ Datos recibidos: ${data.length} entidades`);
            data.sort((a, b) => a.nombre.localeCompare(b.nombre));
            window.entidadesData = data;
            selectEntidad.innerHTML = '';
            
            const todasOption = document.createElement('option');
            todasOption.value = 'todas';
            todasOption.textContent = 'Todas las Entidades';
            selectEntidad.appendChild(todasOption);
            
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
            
            // console.log(`✅ ${data.length} entidades cargadas en Select2`);
            
            $(selectEntidad).select2({
                placeholder: 'Buscar entidad financiera...',
                allowClear: false,
                width: '100%',
                dropdownParent: $(document.body),
                language: {
                    noResults: function() { return "No se encontró la entidad"; },
                    searching: function() { return "Buscando..."; }
                }
            });
            
                $(selectEntidad).on('change', function() {
                    const entidadSeleccionada = $(this).val();
                    // console.log(` Entidad seleccionada: ${entidadSeleccionada}`);
                    
                    updateEntityInfo(entidadSeleccionada);
                    
                    if (entidadSeleccionada && entidadSeleccionada !== 'todas') {
                        // ✅ Si la vista de revista está abierta, usar el tipo actual
                        const magazineView = document.getElementById('digital-magazine-view');
                        if (magazineView && !magazineView.classList.contains('hidden')) {
                            loadMagazineReport(entidadSeleccionada, currentReportType);
                        } else {
                            loadEntidadData(entidadSeleccionada);
                        }
                    }
                });
            
            // ✅ Cargar información inicial
            updateEntityInfo(defaultNombre);
        })
        .catch(error => {
            console.error('❌ Error cargando entidades:', error);
            selectEntidad.innerHTML = '<option value="error">Error al cargar entidades</option>';
        });
}



function showMessage(message, type = 'info') {
    const toast = document.createElement('div');
    toast.style.cssText = `
        position: fixed; top: 100px; right: 20px; background: white;
        padding: 15px 25px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        display: flex; align-items: center; gap: 10px; z-index: 9999;
        animation: slideIn 0.3s ease; font-family: 'Open Sans', sans-serif; font-size: 14px;
    `;
    
    toast.innerHTML = `<i class="fas fa-info-circle" style="color: #2563eb;"></i><span>${message}</span>`;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

let currentMagazineData = null;
let availableYears = [];
let currentYear = '';
let currentMonth = '';
const monthsNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

function openReport(tipo) {
    // console.log(`📊 Abriendo reporte: ${tipo}`);
    const entidadFilter = document.getElementById('entidadFilter');
    const entidadSeleccionada = entidadFilter ? $(entidadFilter).val() : null;

    if (tipo === 'balances' || tipo === 'intermediacion' || tipo === 'productivo' || tipo === 'indicadores' || tipo === 'tasas' || tipo === 'comparativo') {
        if (!entidadSeleccionada || entidadSeleccionada === 'todas') {
            showMessage('Por favor seleccione una entidad financiera específica.', 'warning');
            return;
        }
        loadMagazineReport(entidadSeleccionada, tipo);
    } else {
        showMessage(`Cargando ${tipo}...`, 'info');
    }
}

// Función para actualizar info en vista de revista
async function updateEntityInfoMini(entidadNombre) {
    const entityInfoMini = document.getElementById('entityInfoMini');
    const miniTamaño = document.getElementById('miniEntityTamaño');
    const miniRango = document.getElementById('miniEntityRango');
    
    if (!entityInfoMini || !entidadNombre) return;
    
    // Si allEntitiesData está vacío, cargarlo
    if (allEntitiesData.length === 0) {
        await loadAllEntitiesData();
    }
    
    // Buscar en allEntitiesData en lugar de window.entidadesData
    const entidadData = allEntitiesData.find(e => e.Filtro === entidadNombre);
    
    if (entidadData) {
        miniTamaño.textContent = entidadData.Tamaño || '-';
        miniRango.textContent = entidadData.Rango_Activos || '-';
        entityInfoMini.style.display = 'flex';
        // console.log('✅ Info mini actualizada:', entidadData);
    } else {
        // console.warn('⚠️ Entidad no encontrada para info mini:', entidadNombre);
    }
}

async function loadMagazineReport(entidadNombre, tipoReporte = 'balances') {
    currentReportType = tipoReporte; // ✅ Guardar el tipo de reporte actual
    
    const msg = tipoReporte === 'intermediacion' ? 'Cargando Intermediación Financiera...' : 
                tipoReporte === 'productivo' ? 'Cargando Cartera Productiva...' :
                tipoReporte === 'consumo' ? 'Cargando Cartera Consumo...' : 'Cargando Balance General...';
    showMessage(msg, 'info');
    
    try {
        const hubSelector = document.getElementById('entidadFilterContainer');
        if (hubSelector) hubSelector.style.display = 'none';
        
        const data = await loadEntidadData(entidadNombre);
        if (!data || data.length === 0) throw new Error('Sin datos disponibles para esta entidad.');
        
        currentMagazineData = data;
        currentMagazineEntity = entidadNombre; 
        
        updateEntityInfoMini(entidadNombre);
        initMagazineEntitySelector(entidadNombre); 
        
        const dateColumns = Object.keys(data[0]).filter(k => /^\d{4}-\d{2}$/.test(k)).sort();
        const uniqueYears = [...new Set(dateColumns.map(d => d.split('-')[0]))];
        availableYears = uniqueYears.sort().reverse();
        
        currentYear = availableYears[0];
        const lastDate = dateColumns[dateColumns.length - 1];
        currentMonth = lastDate.split('-')[1];
        
        populateSelectors();
        
        const magazineView = document.getElementById('digital-magazine-view');
        if (magazineView) magazineView.classList.remove('hidden');
        
        updateMagazineContent();
        
        // ✅ RESTAURAR la última página en la que estaba el usuario
        setTimeout(() => {
            goToPage(lastActivePage);
        }, 100);
        
    } catch (error) {
        // console.error(error);
        showMessage('Error: ' + error.message, 'error');
    }
}

// ==========================================
// NAVEGACIÓN PROFESIONAL DE PÁGINAS
// ==========================================

// Función para obtener el número total de páginas
function getTotalPages() {
    return document.querySelectorAll('.magazine-page').length;
}

// Función para actualizar el selector de páginas
function updatePageSelector() {
    const selector = document.getElementById('pageSelector');
    const totalPages = getTotalPages();
    const currentPage = document.querySelector('.magazine-page.active');
    let currentPageNum = 1;
    
    if (currentPage) {
        const allPages = Array.from(document.querySelectorAll('.magazine-page'));
        currentPageNum = allPages.indexOf(currentPage) + 1;
    }
    
    // Mapeo de nombres por página (ajusta según tus hojas)
    const pageNames = {
        1: 'Balance General',
        2: 'Evolución Histórica',
        3: 'Activo Productivo',
        4: 'Activos Improductivos',
        5: 'Ranking por Activos',
        6: 'Estructura Pasivo',
        7: 'Pasivos Exigibles',
        8: 'Pasivos con Costo',
        9: 'Ranking Pasivos',
        10: 'PyG Mensual',
        11: 'PyG Anual',
        12: 'Intermediación Financiera',
        13: 'Cartera Productiva',
        14: 'Cartera Consumo',
        15: 'Cartera Inmobiliario',
        16: 'Cartera Microcrédito',
        17: 'Índice de Turbulencia',
        18: 'Monto Activas y Pasivas',
        19: 'Monto Activas Seg. Productivo',
        20: 'Monto Activas Seg. Consumo y Educativo',
        21: 'Monto Activas Seg. Inmobiliario Y Vivienda',
        22: 'Monto Activas Seg. Microcrédito',
        23: 'Monto de Operaciones Pasivas',
        24: 'Ranking Cartera Neta',
        25: 'Ranking MOA',
        26: 'Ranking MOP',
        27: 'Indicadores Financieros',
        28: 'Indicadores CAMELS - PERLAS',
        29: 'Evolución Indicadores CAMELS - PERLAS',
        30: 'Tasas de Interés',
        31: 'Comparación entre entidades',
        // Agrega más según necesites...
    };
    
    document.getElementById('totalPages').textContent = totalPages;
    selector.innerHTML = '';
    
    for (let i = 1; i <= totalPages; i++) {
        const option = document.createElement('option');
        option.value = i;
        option.textContent = `${i}. ${pageNames[i] || 'Hoja ' + i}`;
        if (i === currentPageNum) option.selected = true;
        selector.appendChild(option);
    }
}

// Funciones de navegación
function goToFirstPage() {
    goToPage(1);
}

function goToLastPage() {
    goToPage(getTotalPages());
}

function goToPrevPage() {
    const currentPage = document.querySelector('.magazine-page.active');
    const allPages = Array.from(document.querySelectorAll('.magazine-page'));
    const currentIndex = allPages.indexOf(currentPage);
    
    if (currentIndex > 0) {
        goToPage(currentIndex);
    }
}

function goToNextPage() {
    const currentPage = document.querySelector('.magazine-page.active');
    const allPages = Array.from(document.querySelectorAll('.magazine-page'));
    const currentIndex = allPages.indexOf(currentPage);
    
    if (currentIndex < allPages.length - 1) {
        goToPage(currentIndex + 2);
    }
}

// Modificar goToPage para actualizar el selector
const originalGoToPage = goToPage;
goToPage = function(pageNum) {
    originalGoToPage(pageNum);
    setTimeout(() => updatePageSelector(), 200);
};

// Inicializar al cargar
document.addEventListener('DOMContentLoaded', () => {
    updatePageSelector();
});

function closeMagazine() {
    const hubSelector = document.getElementById('entidadFilterContainer');
    if (hubSelector) hubSelector.style.display = 'block';

    const magazineView = document.getElementById('digital-magazine-view');
    if (magazineView) magazineView.classList.add('hidden');
}


function initMagazineEntitySelector(currentValue) {
    const magSelect = $('#magazineEntityFilter');
    
    if (!magSelect || magSelect.length === 0) return;
    
    if (magSelect.hasClass('select2-hidden-accessible')) {
        magSelect.select2('destroy');
    }
    
    magSelect.empty();
    
    if (window.entidadesData) {
        window.entidadesData.forEach(ent => {
            magSelect.append(new Option(ent.nombre, ent.nombre, false, ent.nombre === currentValue));
        });
    }
    
    magSelect.select2({
        placeholder: 'Buscar entidad...',
        width: '250px',
        dropdownParent: $('.magazine-toolbar'),
        language: {
            noResults: () => "No se encontró",
            searching: () => "Buscando..."
        }
    });
    
    // ✅ CAMBIO CLAVE: Usar currentReportType en lugar de hardcodear
    magSelect.off('change').on('change', async function() {
        const newEntity = $(this).val();
        if (newEntity && newEntity !== currentMagazineEntity) {
            // // console.log(`🔄 Cambio de entidad a: ${newEntity} (manteniendo reporte: ${currentReportType})`);
            await loadMagazineReport(newEntity, currentReportType); // ✅ Pasar el tipo actual
        }
    });
}

function formatHeaderDate(dateStr) {
    if (!dateStr) return '---';
    const [y, m] = dateStr.split('-');
    const monthNamesShort = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    return `${monthNamesShort[parseInt(m)-1]}-${y.slice(-2)}`;
}


function getPreviousMonthDate(year, month) {
    let y = parseInt(year);
    let m = parseInt(month);
    m--;
    if (m === 0) { m = 12; y--; }
    return `${y}-${String(m).padStart(2, '0')}`;
}

function formatNumber(num) {
    if (num === null || num === undefined || isNaN(num)) return '0,0';
    return num.toLocaleString('es-EC', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

function renderSummaryBox(kpis) {
    const setKpi = (id, valId, varId, code) => {
        document.getElementById(id).textContent = formatNumber(kpis[code]?.current || 0);
        const v = kpis[code]?.varAnnual || 0;
        const el = document.getElementById(varId);
        el.textContent = (v >= 0 ? '+' : '') + v.toFixed(2) + '%';
        el.className = `kpi-var ${v > 0 ? 'positive' : v < 0 ? 'negative' : 'neutral'}`;
    };
    
    setKpi('kpi-activo', '', 'var-activo', '@1');
    setKpi('kpi-pasivo', '', 'var-pasivo', '@2');
    setKpi('kpi-patrimonio', '', 'var-patrimonio', '@3');
    setKpi('kpi-ganancias', '', 'var-ganancias', 'Gan_Eje');
}

function renderMainTable(rows) {
    const tbody = document.getElementById('balancesTableBody');
    tbody.innerHTML = rows.map(r => {
        const getArrow = (v) => v > 0 ? '<i class="fas fa-arrow-up semaforo-icon" style="color:#22c55e"></i>' : 
                              v < 0 ? '<i class="fas fa-arrow-down semaforo-icon" style="color:#ef4444"></i>' : 
                              '<i class="fas fa-minus semaforo-icon" style="color:#94a3b8"></i>';
                              
        return `
            <tr>
                <td>${r.name}</td>
                <td>${formatNumber(r.prevYear)}</td>
                <td>${formatNumber(r.prevMonth)}</td>
                <td style="font-weight:700; color:var(--primary-blue)">${formatNumber(r.current)}</td>
                <td>${r.varMonthly.toFixed(2)}% ${getArrow(r.varMonthly)}</td>
                <td>${r.varAnnual.toFixed(2)}% ${getArrow(r.varAnnual)}</td>
            </tr>
        `;
    }).join('');
}

function renderComparativeCharts(kpis, targetDate, prevYearDate) {
    const [selYear] = targetDate.split('-').map(Number);
    const allDates = Object.keys(currentMagazineData[0]).filter(k => /^\d{4}-\d{2}$/.test(k)).sort();
    
    const currentYearMonths = allDates.filter(d => d.startsWith(`${selYear}-`));
    const previousYearMonths = allDates.filter(d => d.startsWith(`${selYear - 1}-`));
    const xAxisLabels = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

    const getMonthlyData = (code, monthsArray) => {
        const row = currentMagazineData.find(r => r.Variable === code || r.CUC === code);
        if (!row) return new Array(12).fill(0);
        return monthsArray.map(dateStr => parseFloat(row[dateStr]) || 0);
    };

    const baseStyles = {
        current: { name: 'Año Actual', itemStyle: { color: '#2563eb' }, lineStyle: { shadowColor: 'rgba(37, 99, 235, 0.4)' }, areaStyle: { color: '#2563eb' }, label: { color: '#2563eb' } },
        prev: { name: 'Año Anterior', itemStyle: { color: '#94a3b8' }, lineStyle: { shadowColor: 'rgba(148, 163, 184, 0.4)' }, areaStyle: { color: '#94a3b8' }, label: { color: '#94a3b8' } }
    };

    initEchart('chartActivo', createProfessionalChartOption('Análisis Comparativo del Activo', xAxisLabels, [
        { ...baseStyles.current, data: getMonthlyData('@1', currentYearMonths) },
        { ...baseStyles.prev, data: getMonthlyData('@1', previousYearMonths) }
    ]));

    initEchart('chartPasivo', createProfessionalChartOption('Análisis Comparativo del Pasivo', xAxisLabels, [
        { ...baseStyles.current, data: getMonthlyData('@2', currentYearMonths) },
        { ...baseStyles.prev, data: getMonthlyData('@2', previousYearMonths) }
    ]));

    initEchart('chartPatrimonio', createProfessionalChartOption('Análisis Comparativo del Patrimonio', xAxisLabels, [
        { ...baseStyles.current, data: getMonthlyData('@3', currentYearMonths) },
        { ...baseStyles.prev, data: getMonthlyData('@3', previousYearMonths) }
    ]));

    
}

function initEchart(domId, option) {
    const dom = document.getElementById(domId);
    let chart = echarts.getInstanceByDom(dom);
    if (!chart) chart = echarts.init(dom);
    
    const currentOption = chart.getOption();
    if (currentOption && currentOption.series && currentOption.series.length > 0) {
        const currentUserType = currentOption.series[0].type; 
        if (option.series) {
            option.series.forEach(s => s.type = currentUserType);
        }
    }

    chart.setOption(option, true); 
}

function logout() {
    if (confirm('¿Estás seguro que deseas cerrar sesión?')) {
        localStorage.removeItem('dataFinanciero_session');
        window.location.href = 'index.html';
    }
}

// ==========================================
// FUNCIÓN MAESTRA DE ACTUALIZACIÓN (ÚNICA VERSIÓN)
// ==========================================

   let isUpdating = false;

function updateMagazineContent() {
    console.log("🔄 [DEBUG] updateMagazineContent iniciado");
    if (!currentMagazineData) {
        console.warn("⚠️ currentMagazineData está vacío, cancelando actualización");
        return;
    }

    const targetDate = `${currentYear}-${currentMonth}`;
    const prevMonthDate = getPreviousMonthDate(currentYear, currentMonth);
    const prevYearDate = subtractMonths(currentYear, currentMonth, 12);

    // 1. Actualizar headers globales
    const thCurrent = document.getElementById('th-current');
    const thPrevMonth = document.getElementById('th-prev-month');
    const thPrevYear = document.getElementById('th-prev-year');
    if(thCurrent) thCurrent.textContent = formatHeaderDate(targetDate);
    if(thPrevMonth) thPrevMonth.textContent = formatHeaderDate(prevMonthDate);
    if(thPrevYear) thPrevYear.textContent = formatHeaderDate(prevYearDate);

    // 2. Renderizar Hoja 1
    const varsMap = {
        '@1': 'ACTIVO', '@2': 'PASIVO', '@3': 'PATRIMONIO',
        '@5': 'INGRESOS', '@4': 'GASTOS', 'Gan_Eje': 'GANANCIAS'
    };
    const tableRows = [];
    const kpis = {};
    Object.entries(varsMap).forEach(([code, name]) => {
        const row = currentMagazineData.find(r => r.Variable === code || r.CUC === code);
        if (!row) return;
        const valCurrent = parseFloat(row[targetDate]) || 0;
        const valPrevMonth = parseFloat(row[prevMonthDate]) || 0;
        const valPrevYear = parseFloat(row[prevYearDate]) || 0;
        const varMonthly = valPrevMonth !== 0 ? ((valCurrent - valPrevMonth) / Math.abs(valPrevMonth)) * 100 : 0;
        const varAnnual = valPrevYear !== 0 ? ((valCurrent - valPrevYear) / Math.abs(valPrevYear)) * 100 : 0;
        tableRows.push({ name, current: valCurrent, prevMonth: valPrevMonth, prevYear: valPrevYear, varMonthly, varAnnual });
        kpis[code] = { current: valCurrent, varAnnual };
    });
    renderSummaryBox(kpis);
    renderMainTable(tableRows); 
    renderComparativeCharts(kpis, targetDate, prevYearDate);
    prepareHistoricalCharts();

    // 3. Renderizar TODAS las páginas (incluyendo las de ranking)
    renderEstructuraActivoPage();
    renderImproductivoPage();
    renderEstructuraPasivoPage();
    renderEstructuraExigiblePage();
    renderEstructuraCostoPage();
    
    // ✅ FORZAR ACTUALIZACIÓN DE LAS HOJAS DE RANKING
    
    renderRankingTable();
    renderRankingTable_Pasivo();
  

    renderEstructuraPYG();
    renderEstructuraPYGANUAL();

    renderIntermediacionPage();
    renderCarteraProductivaPage();
    renderCarteraConsumoPage();
    renderCarteraInmobiliarioPage();
    renderCarteraMicrocreditoPage();
    renderTurbulenciaPage();
    renderOperacionesActivasPasivasPage();
    renderSegProductivoPage();
    renderSegConsPage();
    renderSegInmobiliarioPage();
    renderSegMicrocreditoPage();
    renderSegPasivasPage();
    
    renderRankingTable_Cartera();
    renderRankingTable_MOA();
    renderRankingTable_MOP();

    renderIndicadoresPage ();

    renderPage28();

    renderIndicadoresPage29();
    renderIndicadoresPage30();

    renderIndicadoresPage31();
}

function goToPage(pageNum) {
    
    lastActivePage = pageNum;
    
    // Actualizar clases de páginas activas
    document.querySelectorAll('.magazine-page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.dot').forEach(d => d.classList.remove('active'));
    
    const targetPage = document.querySelector(`.page-${pageNum}`);
    if (targetPage) {
        targetPage.classList.add('active');
    }
    
    const dots = document.querySelectorAll('.dot');
    if (dots[pageNum - 1]) {
        dots[pageNum - 1].classList.add('active');
    }
    
    // Renderizar contenido según la página
    setTimeout(() => {
        if (pageNum === 1) {
            renderEstructuraActivoPage();
            ['chartActivo', 'chartPasivo', 'chartPatrimonio'].forEach(id => {
                const chart = echarts.getInstanceByDom(document.getElementById(id));
                if (chart) chart.resize();
            });

        } else if (pageNum === 2) {
            ['histChartActivo', 'histChartPasivo', 'histChartPatrimonio', 'histChartGanancias'].forEach(id => {
                const chart = echarts.getInstanceByDom(document.getElementById(id));
                if (chart) chart.resize();
            });

        } else if (pageNum === 3) {
            ['chartBarrasApiladas', 'chartBarrasCuentas', 'chartHistoricoEstructura'].forEach(id => {
                const chart = echarts.getInstanceByDom(document.getElementById(id));
                if (chart) chart.resize();
            });

        } else if (pageNum === 4) {
            ['chartBarrasImproductivos', 'chartBarrasCuentasImproductivas', 'chartHistoricoImproductivos'].forEach(id => {
                const chart = echarts.getInstanceByDom(document.getElementById(id));
                if (chart) chart.resize();
            });

        } else if (pageNum === 5) {
            // ✅ Renderizar Hoja 5
            renderRankingTable();
            renderPanel2Table();
            const chart = echarts.getInstanceByDom(document.getElementById('chartRanking'));
            if (chart) chart.resize();

        } else if (pageNum === 6) {
            ['chartBarrasApiladasPasivo', 'chartBarrasCuentasPasivo', 'chartHistoricoEstructuraPasivo'].forEach(id => {
                const chart = echarts.getInstanceByDom(document.getElementById(id));
                if (chart) chart.resize();
            });

        } else if (pageNum === 7) {
            ['chartBarrasApiladasExigible', 'chartBarrasCuentasExigible', 'chartHistoricoEstructuraExigible'].forEach(id => {
                const chart = echarts.getInstanceByDom(document.getElementById(id));
                if (chart) chart.resize();
            });

        } else if (pageNum === 8) {
            ['chartBarrasApiladasCosto', 'chartBarrasCuentasCosto', 'chartHistoricoEstructuraCosto'].forEach(id => {
                const chart = echarts.getInstanceByDom(document.getElementById(id));
                if (chart) chart.resize();
            });

        } else if (pageNum === 9) {
            renderRankingTable_Pasivo();
            renderPanel2Table_Pasivo();
            const chart = echarts.getInstanceByDom(document.getElementById('chartRanking_Pasivo'));
            if (chart) chart.resize();

        } else if (pageNum === 10) {
            renderEstructuraPYG();
            ['chartComparativoPyG', 'chartHistoricoEstructuraPYG'].forEach(id => {
                const chart = echarts.getInstanceByDom(document.getElementById(id));
                if (chart) chart.resize();
            });

        } else if (pageNum === 11) {
            renderEstructuraPYGANUAL();
            ['chartComparativoPyGAnual', 'chartHistoricoEstructuraPYGANUAL'].forEach(id => {
                const chart = echarts.getInstanceByDom(document.getElementById(id));
                if (chart) chart.resize();
            });

        } else if (pageNum === 12) {
            renderIntermediacionPage();
            ['chartHistoricoCartera', 'chartComposicionCartera', 'chartMorosidad',
             'chartMiniIf012', 'chartMiniSb036', 'chartMiniSb037', 
             'chartMiniSb038', 'chartMiniSb039', 'chartMiniSb040'].forEach(id => {
                const chart = echarts.getInstanceByDom(document.getElementById(id));
                if (chart) chart.resize();
            });

        } else if (pageNum === 13) {
            renderCarteraProductivaPage();
            ['chartHistoricoCarteraProd', 'chartHistoricoRefiRees',
             'chartComposicionCarteraProd', 'chartMorosidadProd',
             'chartMini1425', 'chartMini1433', 'chartMini1441',
             'chartMini1449', 'chartMini1457', 'chartMini1465'].forEach(id => {
                const chart = echarts.getInstanceByDom(document.getElementById(id));
                if (chart) chart.resize();
            });

        } else if (pageNum === 14) {
            renderCarteraConsumoPage();
            ['chartHistoricoCarteraCons', 'chartHistoricoRefiReesCons',
             'chartComposicionCarteraCons', 'chartMorosidadCons',
             'chartMini1426', 'chartMini1434', 'chartMini1442',
             'chartMini1450', 'chartMini1458', 'chartMini1466'].forEach(id => {
                const chart = echarts.getInstanceByDom(document.getElementById(id));
                if (chart) chart.resize();
            });

        } else if (pageNum === 15) {
            renderCarteraInmobiliarioPage();
            ['chartHistoricoCarteraInmo', 'chartHistoricoRefiReesInmo',
            'chartComposicionCarteraInmo', 'chartMorosidadInmo',
            'chartMini1427', 'chartMini1435', 'chartMini1443',
            'chartMini1451', 'chartMini1459', 'chartMini1467'].forEach(id => {
                const chart = echarts.getInstanceByDom(document.getElementById(id));
                if (chart) chart.resize();
            });

        } else if (pageNum === 16) {
            renderCarteraMicrocreditoPage();
            ['chartHistoricoCarteraMicro', 'chartHistoricoRefiReesMicro',
            'chartComposicionCarteraMicro', 'chartMorosidadMicro',
            'chartMini1428', 'chartMini1436', 'chartMini1444',
            'chartMini1452', 'chartMini1460', 'chartMini1468'].forEach(id => {
                const chart = echarts.getInstanceByDom(document.getElementById(id));
                if (chart) chart.resize();
            });

        } else if (pageNum === 17) {
            renderTurbulenciaPage();
            ['chartTurbulenciaProductiva', 'chartTurbulenciaConsumo', 
             'chartTurbulenciaInmo', 'chartTurbulenciaMicro'].forEach(id => {
                const chart = echarts.getInstanceByDom(document.getElementById(id));
                if (chart) chart.resize();
            });

        } else if (pageNum === 18) {
            renderOperacionesActivasPasivasPage();
            ['chartHistoricoActivas', 'chartHistoricoPasivas', 
             'chartComposicionActivas', 'chartComposicionDepositos'].forEach(id => {
                const chart = echarts.getInstanceByDom(document.getElementById(id));
                if (chart) chart.resize();
            });

        } else if (pageNum === 19) {
            renderSegProductivoPage();
            ['chartHistoricoMontoSegProd', 'chartHistoricoNumSegProd', 
             'chartComposicionMontoSegProd', 'chartComposicionNumSegProd',
             'chartMiniProCor', 'chartMiniProProc', 'chartMiniProProdem', 'chartMiniProProdpy'].forEach(id => {
                const chart = echarts.getInstanceByDom(document.getElementById(id));
                if (chart) chart.resize();
            });

        } else if (pageNum === 20) {
            renderSegConsPage();
            ['chartHistoricoMontoSegCons', 'chartHistoricoNumSegCons', 
             'chartComposicionMontoSegCons', 'chartComposicionNumSegCons',
             'chartMiniCons', 'chartMiniEdu', 'chartMiniEduso'].forEach(id => {
                const chart = echarts.getInstanceByDom(document.getElementById(id));
                if (chart) chart.resize();
            });

        } else if (pageNum === 21) {
            renderSegInmobiliarioPage();
            ['chartHistoricoMontoSegInmo', 'chartHistoricoNumSegInmo', 
             'chartComposicionMontoSegInmo', 'chartComposicionNumSegInmo',
             'chartMiniProIn', 'chartMiniProVip', 'chartMiniProVis'].forEach(id => {
                const chart = echarts.getInstanceByDom(document.getElementById(id));
                if (chart) chart.resize();
            });

        } else if (pageNum === 22) {
            renderSegMicrocreditoPage();
            ['chartHistoricoMontoSegMic', 'chartHistoricoNumSegMic', 
             'chartComposicionMontoSegMic', 'chartComposicionNumSegMic',
             'chartMiniProMic', 'chartMiniProMino', 'chartMiniProMas', 'chartMiniProMaa'].forEach(id => {
                const chart = echarts.getInstanceByDom(document.getElementById(id));
                if (chart) chart.resize();
            });

        } else if (pageNum === 23) {
            renderSegPasivasPage();
            ['chartHistoricoMontoSegPas', 'chartHistoricoNumSegPas', 
             'chartComposicionMontoSegPas', 'chartComposicionNumSegPas',
             'chartMiniProMop', 'chartMiniProOp30', 'chartMiniProOp61', 
             'chartMiniProOp91', 'chartMiniProOp121', 'chartMiniProOp181', 'chartMiniProOp361'].forEach(id => {
                const chart = echarts.getInstanceByDom(document.getElementById(id));
                if (chart) chart.resize();
            });

        } else if (pageNum === 24) {
            renderRankingTable_Cartera();
            renderPanel2Table_Cartera();
            const chart = echarts.getInstanceByDom(document.getElementById('chartRanking_Cartera'));
            if (chart) chart.resize();

        } else if (pageNum === 25) {
            renderRankingTable_MOA();
            renderPanel2Table_MOA();
            const chart = echarts.getInstanceByDom(document.getElementById('chartRanking_MOA'));
            if (chart) chart.resize();

        } else if (pageNum === 26) {
            renderRankingTable_MOP();
            renderPanel2Table_MOP();
            const chart = echarts.getInstanceByDom(document.getElementById('chartRanking_MOP'));
            if (chart) chart.resize();
        
        } else if (pageNum === 27) {
            renderIndicadoresPage();
            ['chartIndicador1', 'chartIndicador2', 'chartIndicador3',
            'chartIndicador4', 'chartIndicador5', 'chartIndicador6',
            'chartIndicador7', 'chartIndicador8', 'chartIndicador9'].forEach(id => {
                const chart = echarts.getInstanceByDom(document.getElementById(id));
                if (chart) chart.resize();
            });

        } else if (pageNum === 28) {
            renderPage28();
            ['chartCamels', 'chartPerlas'].forEach(id => {
                const chart = echarts.getInstanceByDom(document.getElementById(id));
                if (chart) chart.resize();
            });

        }  else if (pageNum === 29) {
            renderIndicadoresPage29();
            ['chartInd29_1', 'chartInd29_2', 'chartInd29_3',
            'chartInd29_4', 'chartInd29_5', 'chartInd29_6',
            'chartInd29_7', 'chartInd29_8', 'chartInd29_9'].forEach(id => {
                const chart = echarts.getInstanceByDom(document.getElementById(id));
                if (chart) chart.resize();
            });

        }  else if (pageNum === 30) {
            renderIndicadoresPage30();
            ['chartInd30_1', 
            'chartInd30_4', 
            'chartInd30_7' ].forEach(id => {
                const chart = echarts.getInstanceByDom(document.getElementById(id));
                if (chart) chart.resize();
            });

        }  else if (pageNum === 31) {
            renderIndicadoresPage31();
            ['chartInd31_1', 'chartInd31_2', 'chartInd31_3',
            'chartInd31_4', 'chartInd31_5', 'chartInd31_6',
            'chartInd31_7', 'chartInd31_8', 'chartInd31_9' ].forEach(id => {
                const chart = echarts.getInstanceByDom(document.getElementById(id));
                if (chart) chart.resize();
            });

        }
        
        // Actualizar selector de páginas
        updatePageSelector();
        
    }, 150);
}

// ==========================================
// FUNCIONES GENERICAS GRAFICOS TABLAS
// ==========================================

// ==========================================
// FUNCIONES GENÉRICAS REUTILIZABLES
// ==========================================


// ✅ FUNCIÓN GENÉRICA PARA MINI KPIS CON GRÁFICOS (Reutilizable en 10+ hojas)
async function renderMiniKPIWithChart(cucCode, idSuffix, targetDate, chartType = 'bar', color = '#3b82f6') {
    if (!currentMagazineData) return;

    const row = currentMagazineData.find(r => r.CUC === cucCode || r.Variable === cucCode);
    if (!row) return;

    const prevMonthDate = getPreviousMonthDate(currentYear, currentMonth);
    const prevYearDate = subtractMonths(currentYear, currentMonth, 12);

    const valCurrent = parseFloat(row[targetDate]) || 0;
    const valPrevMonth = parseFloat(row[prevMonthDate]) || 0;
    
    // 1. Actualizar valor principal en el DOM
    const elValue = document.getElementById(`kpi-${idSuffix}-mini-value`);
    if (elValue) {
        elValue.textContent = valCurrent.toFixed(2) + '%';
    }

    // 2. Obtener últimos 6 meses para el gráfico
    const allDateCols = Object.keys(currentMagazineData[0]).filter(k => /^\d{4}-\d{2}$/.test(k)).sort();
    const last6Months = allDateCols.slice(-6);
    const chartData = last6Months.map(d => parseFloat(row[d]) || 0);
    const chartLabels = last6Months.map(d => {
        const [y, m] = d.split('-');
        return monthsNames[parseInt(m) - 1];
    });

    // 3. Construir IDs dinámicos basados en el sufijo (Ej: 'if012' -> 'chartMiniIf012')
    const capitalizedSuffix = idSuffix.charAt(0).toUpperCase() + idSuffix.slice(1);
    const chartId = `chartMini${capitalizedSuffix}`;
    const summaryId = `summary-${idSuffix}`;

    const chartDom = document.getElementById(chartId);
    if (!chartDom) return;

    let chart = echarts.getInstanceByDom(chartDom);
    if (!chart) chart = echarts.init(chartDom);

    // 4. Calcular variación mensual y determinar tendencia
    const varMonthly = valPrevMonth !== 0 ? ((valCurrent - valPrevMonth) / Math.abs(valPrevMonth)) * 100 : 0;
    
    let trendClass = 'trend-stable';
    let trendText = 'Estable';
    let trendIcon = '→';
    
    if (varMonthly > 0.5) {
        trendClass = 'trend-up';
        trendText = 'Subiendo';
        trendIcon = '↑';
    } else if (varMonthly < -0.5) {
        trendClass = 'trend-down';
        trendText = 'Bajando';
        trendIcon = '↓';
    }

    // 5. Actualizar resumen dinámico en el DOM
    const summaryEl = document.getElementById(summaryId);
    if (summaryEl) {
        summaryEl.innerHTML = `
            <div>${trendIcon} <span class="${trendClass}">${trendText}</span></div>
            <div style="font-size: 8px; margin-top: 2px;">
                Mensual: <span class="${varMonthly > 0 ? 'trend-up' : varMonthly < 0 ? 'trend-down' : 'trend-stable'}">${varMonthly > 0 ? '+' : ''}${varMonthly.toFixed(1)}%</span>
            </div>
        `;
    }

    // 6. Renderizar gráfico (Barra o Línea)
    const option = {
        grid: { top: 10, bottom: 20, left: 5, right: 5 },
        xAxis: {
            type: 'category',
            data: chartLabels,
            axisLabel: { fontSize: 7, color: '#64748b' },
            axisLine: { show: false },
            axisTick: { show: false }
        },
        yAxis: {
            type: 'value',
            axisLabel: { show: false },
            splitLine: { show: false }
        },
        series: [{
            type: chartType,
            data: chartData,
            smooth: chartType === 'line', // Suaviza solo si es línea
            symbol: chartType === 'line' ? 'circle' : 'none',
            symbolSize: 4,
            itemStyle: {
                color: color,
                borderRadius: chartType === 'bar' ? [3, 3, 0, 0] : undefined
            },
            areaStyle: chartType === 'line' ? { color: color + '33' } : undefined, // 20% de opacidad del color base
            label: {
                show: typeof showChartLabels !== 'undefined' ? showChartLabels : true,
                position: 'top',
                fontSize: 7,
                color: '#64748b',
                formatter: (p) => p.value.toFixed(1) + '%'
            },
            barWidth: chartType === 'bar' ? '70%' : undefined
        }]
    };

    chart.setOption(option, true);
}


// ✅ FUNCIÓN GENÉRICA PARA ACTUALIZAR KPIs
function updateKPIGenerico(cucCode, kpiPrefix, targetDate, prevYearDate) {
    // Búsqueda insensible a mayúsculas/minúsculas para evitar fallos por "MOP" vs "mop"
    const searchCode = String(cucCode).toUpperCase();
    const row = currentMagazineData.find(r => 
        (r.CUC && String(r.CUC).toUpperCase() === searchCode) || 
        (r.Variable && String(r.Variable).toUpperCase() === searchCode)
    );
    
    if (!row) {
        console.warn(`⚠️ [Hoja 23] No se encontró la fila para el código: "${cucCode}".`);
        console.log("🔍 Verifica que en tu JSON la columna se llame 'CUC' o 'Variable' y el valor sea exactamente '" + cucCode + "'. Primeras filas:", currentMagazineData.slice(0, 2));
        return;
    }
    
    const valCurrent = parseFloat(row[targetDate]) || 0;
    const valPrevYear = parseFloat(row[prevYearDate]) || 0;
    const varAnnual = valPrevYear !== 0 ? ((valCurrent - valPrevYear) / Math.abs(valPrevYear)) * 100 : 0;
    
    // Actualizar valor principal
    const valueEl = document.getElementById(`${kpiPrefix}-value`);
    if (valueEl) {
        valueEl.textContent = formatNumber(valCurrent);
    } else {
        console.warn(`⚠️ [Hoja 23] No se encontró el elemento HTML con id: "${kpiPrefix}-value"`);
    }
    
    // Actualizar variación
    const varElement = document.getElementById(`${kpiPrefix}-var`)?.querySelector('.var-value');
    if (varElement) {
        varElement.textContent = (varAnnual >= 0 ? '+' : '') + varAnnual.toFixed(2) + '%';
        varElement.className = 'var-value ' + (varAnnual > 0 ? 'positive' : varAnnual < 0 ? 'negative' : '');
    }
    
    // Mostrar fecha actual
    const dateEl = document.getElementById(`${kpiPrefix}-var`)?.querySelector('.var-date');
    if (dateEl) dateEl.textContent = formatHeaderDate(targetDate);
}

// ✅ FUNCIÓN GENÉRICA PARA RENDERIZAR TABLA DE ESTRUCTURA
async function renderTablaEstructuraGenerico(tableBodyId, headersConfig, cuentasConfig, targetDate, prevMonthDate, prevYearDate) {
    if (!currentMagazineData) return;
    
    // Actualizar headers si existen
    if (headersConfig.mes1) {
        const th1 = document.getElementById(headersConfig.mes1);
        if (th1) th1.textContent = formatHeaderDate(prevYearDate);
    }
    if (headersConfig.mes2) {
        const th2 = document.getElementById(headersConfig.mes2);
        if (th2) th2.textContent = formatHeaderDate(prevMonthDate);
    }
    if (headersConfig.mes3) {
        const th3 = document.getElementById(headersConfig.mes3);
        if (th3) th3.textContent = formatHeaderDate(targetDate);
    }
    
    const tbody = document.getElementById(tableBodyId);
    if (!tbody) return;
    
    let html = '';
    
    cuentasConfig.forEach(cuenta => {
        const row = currentMagazineData.find(r => r.CUC === cuenta.code);
        if (!row) return;
        
        const valCurrent = parseFloat(row[targetDate]) || 0;
        const valPrevMonth = parseFloat(row[prevMonthDate]) || 0;
        const valPrevYear = parseFloat(row[prevYearDate]) || 0;
        
        const varMonthly = valPrevMonth !== 0 ? ((valCurrent - valPrevMonth) / Math.abs(valPrevMonth)) * 100 : 0;
        const varAnnual = valPrevYear !== 0 ? ((valCurrent - valPrevYear) / Math.abs(valPrevYear)) * 100 : 0;
        
        const varMonthlyClass = varMonthly > 0 ? 'var-positiva' : varMonthly < 0 ? 'var-negativa' : '';
        const varAnnualClass = varAnnual > 0 ? 'var-positiva' : varAnnual < 0 ? 'var-negativa' : '';
        
        const varMonthlyIcon = varMonthly > 0 ? '▲' : varMonthly < 0 ? '▼' : '─';
        const varAnnualIcon = varAnnual > 0 ? '▲' : varAnnual < 0 ? '▼' : '─';
        
        html += `
            <tr class="nivel-${cuenta.nivel || 1}">
                <td>${cuenta.name}</td>
                <td>${formatNumber(valPrevYear)}</td>
                <td>${formatNumber(valPrevMonth)}</td>
                <td><strong>${formatNumber(valCurrent)}</strong></td>
                <td class="${varMonthlyClass}">${varMonthly.toFixed(2)}% ${varMonthlyIcon}</td>
                <td class="${varAnnualClass}">${varAnnual.toFixed(2)}% ${varAnnualIcon}</td>
            </tr>
        `;
    });
    
    tbody.innerHTML = html;
}

// ✅ FUNCIÓN GENÉRICA PARA GRÁFICO DE BARRAS AGRUPADAS (3 COLUMNAS)
function renderBarrasApiladasGenerico(chartId, title, seriesCode, targetDate, prevMonthDate, prevYearDate) {
    if (!currentMagazineData) return;
    
    const chartDom = document.getElementById(chartId);
    if (!chartDom) return;
    
    let chart = echarts.getInstanceByDom(chartDom);
    if (!chart) chart = echarts.init(chartDom);
    
    // Obtener la cuenta principal
    const mainAccount = currentMagazineData.find(r => r.CUC === seriesCode);
    
    const valPrevYear = mainAccount ? parseFloat(mainAccount[prevYearDate]) || 0 : 0;
    const valPrevMonth = mainAccount ? parseFloat(mainAccount[prevMonthDate]) || 0 : 0;
    const valCurrent = mainAccount ? parseFloat(mainAccount[targetDate]) || 0 : 0;
    
    const option = {
        tooltip: {
            trigger: 'axis',
            axisPointer: { type: 'shadow' },
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            borderColor: '#e2e8f0',
            borderWidth: 1,
            textStyle: { color: '#334155', fontSize: 11 },
            formatter: (params) => {
                let result = `<div style="padding: 5px;"><strong>${title}</strong></div>`;
                params.forEach(param => {
                    result += `<div style="display: flex; align-items: center; gap: 8px; margin: 4px 0;">
                        <span style="width: 10px; height: 10px; background: ${param.color}; border-radius: 2px;"></span>
                        <span>${param.seriesName}:</span>
                        <span style="font-weight: bold; margin-left: auto;">${formatNumber(param.value)}</span>
                    </div>`;
                });
                return result;
            }
        },
        legend: {
            data: [formatHeaderDate(prevYearDate), formatHeaderDate(prevMonthDate), formatHeaderDate(targetDate)],
            bottom: 0,
            textStyle: { fontSize: 10, color: '#64748b' }
        },
        grid: { left: '8%', right: '4%', bottom: '15%', top: '15%', containLabel: true },
        xAxis: {
            type: 'category',
            data: [title],
            axisLine: { lineStyle: { color: '#cbd5e1' } },
            axisLabel: { fontSize: 10, color: '#64748b', fontWeight: '600' },
            axisTick: { show: false }
        },
        yAxis: {
            type: 'value',
            name: 'millones USD',
            nameTextStyle: { fontSize: 10, color: '#64748b', fontWeight: '600', padding: [0, 0, 0, -40] },
            axisLine: { show: false },
            axisTick: { show: false },
            axisLabel: { fontSize: 9, color: '#64748b', formatter: (value) => formatNumber(value) },
            splitLine: { lineStyle: { color: '#f1f5f9', type: 'dashed' } }
        },
        series: [
            {
                name: formatHeaderDate(prevYearDate),
                type: 'bar',
                data: [valPrevYear],
                barWidth: '25%',
                itemStyle: { color: '#94a3b8', borderRadius: [4, 4, 0, 0] },
                label: { show: showChartLabels, position: 'top', formatter: (p) => formatNumber(p.value), fontSize: 8, fontWeight: 'bold', color: '#64748b' }
            },
            {
                name: formatHeaderDate(prevMonthDate),
                type: 'bar',
                data: [valPrevMonth],
                barWidth: '25%',
                itemStyle: { color: '#60a5fa', borderRadius: [4, 4, 0, 0] },
                label: { show: showChartLabels, position: 'top', formatter: (p) => formatNumber(p.value), fontSize: 8, fontWeight: 'bold', color: '#64748b' }
            },
            {
                name: formatHeaderDate(targetDate),
                type: 'bar',
                data: [valCurrent],
                barWidth: '25%',
                itemStyle: { 
                    color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                        { offset: 0, color: '#3b82f6' },
                        { offset: 1, color: '#1e3a8a' }
                    ]),
                    borderRadius: [4, 4, 0, 0],
                    shadowBlur: 10,
                    shadowColor: 'rgba(30, 58, 138, 0.3)',
                    shadowOffsetY: 5
                },
                label: { show: showChartLabels, position: 'top', formatter: (p) => formatNumber(p.value), fontSize: 9, fontWeight: 'bold', color: '#1e3a8a', distance: 3 }
            }
        ]
    };
    
    chart.setOption(option);
}

// ✅ FUNCIÓN GENÉRICA PARA GRÁFICO DE BARRAS POR CUENTAS
function renderBarrasCuentasGenerico(chartId, cuentasConfig, targetDate, prevMonthDate, prevYearDate) {
    if (!currentMagazineData) return;
    
    const chartDom = document.getElementById(chartId);
    if (!chartDom) return;
    
    let chart = echarts.getInstanceByDom(chartDom);
    if (!chart) chart = echarts.init(chartDom);
    
    const dataPrevYear = cuentasConfig.map(c => {
        const row = currentMagazineData.find(r => r.CUC === c.code);
        return row ? parseFloat(row[prevYearDate]) || 0 : 0;
    });
    
    const dataPrevMonth = cuentasConfig.map(c => {
        const row = currentMagazineData.find(r => r.CUC === c.code);
        return row ? parseFloat(row[prevMonthDate]) || 0 : 0;
    });
    
    const dataCurrent = cuentasConfig.map(c => {
        const row = currentMagazineData.find(r => r.CUC === c.code);
        return row ? parseFloat(row[targetDate]) || 0 : 0;
    });
    
    const option = {
        tooltip: {
            trigger: 'axis',
            axisPointer: { type: 'shadow' },
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            borderColor: '#e2e8f0',
            borderWidth: 1,
            textStyle: { color: '#334155', fontSize: 11 },
            formatter: (params) => {
                const param = params[0];
                return `<div style="padding: 5px;"><strong>${param.name}</strong><br/><span style="color: #64748b;">${param.seriesName}: ${formatNumber(param.value)}</span></div>`;
            }
        },
        legend: {
            data: [formatHeaderDate(prevYearDate), formatHeaderDate(prevMonthDate), formatHeaderDate(targetDate)],
            bottom: 0,
            textStyle: { fontSize: 10, color: '#64748b' }
        },
        grid: { left: '8%', right: '4%', bottom: '15%', top: '15%', containLabel: true },
        xAxis: {
            type: 'category',
            data: cuentasConfig.map(c => c.name),
            axisLine: { lineStyle: { color: '#cbd5e1' } },
            axisLabel: { fontSize: 10, color: '#64748b', fontWeight: '600' },
            axisTick: { show: false }
        },
        yAxis: {
            type: 'value',
            name: 'millones USD',
            nameTextStyle: { fontSize: 10, color: '#64748b', fontWeight: '600', padding: [0, 0, 0, -40] },
            axisLine: { show: false },
            axisTick: { show: false },
            axisLabel: { fontSize: 9, color: '#64748b', formatter: (value) => formatNumber(value) },
            splitLine: { lineStyle: { color: '#f1f5f9', type: 'dashed' } }
        },
        series: [
            {
                name: formatHeaderDate(prevYearDate),
                type: 'bar',
                data: dataPrevYear,
                barWidth: '25%',
                itemStyle: { color: '#94a3b8', borderRadius: [4, 4, 0, 0] },
                label: { show: showChartLabels, position: 'top', formatter: (p) => formatNumber(p.value), fontSize: 8, fontWeight: 'bold', color: '#64748b' }
            },
            {
                name: formatHeaderDate(prevMonthDate),
                type: 'bar',
                data: dataPrevMonth,
                barWidth: '25%',
                itemStyle: { color: '#60a5fa', borderRadius: [4, 4, 0, 0] },
                label: { show: showChartLabels, position: 'top', formatter: (p) => formatNumber(p.value), fontSize: 8, fontWeight: 'bold', color: '#64748b' }
            },
            {
                name: formatHeaderDate(targetDate),
                type: 'bar',
                data: dataCurrent,
                barWidth: '25%',
                itemStyle: { 
                    color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                        { offset: 0, color: '#3b82f6' },
                        { offset: 1, color: '#1e3a8a' }
                    ]),
                    borderRadius: [4, 4, 0, 0],
                    shadowBlur: 10,
                    shadowColor: 'rgba(30, 58, 138, 0.3)',
                    shadowOffsetY: 5
                },
                label: { show: showChartLabels, position: 'top', formatter: (p) => formatNumber(p.value), fontSize: 9, fontWeight: 'bold', color: '#1e3a8a', distance: 3 }
            }
        ]
    };
    
    chart.setOption(option);
}

// ✅ FUNCIÓN GENÉRICA PARA GRÁFICO HISTÓRICO CON ZOOM (LÍNEAS O BARRAS APILADAS) - VERSIÓN MEJORADA
function renderHistoricoEstructuraGenerico(chartId, seriesConfig, title = 'Evolución Histórica', leftAxisName = 'millones USD', rightAxisName = '%') {
    if (!currentMagazineData) return;
    
    const chartDom = document.getElementById(chartId);
    if (!chartDom) return;
    
    let chart = echarts.getInstanceByDom(chartDom);
    if (!chart) chart = echarts.init(chartDom);
    
    const allDateCols = Object.keys(currentMagazineData[0])
        .filter(k => /^\d{4}-\d{2}$/.test(k))
        .sort();
    
    const dateLabels = allDateCols.map(d => {
        const [y, m] = d.split('-');
        return `${monthsNames[parseInt(m)-1]} ${y}`;
    });
    
    // Verificar si hay series de tipo 'bar'
    const hasBarSeries = seriesConfig.some(s => s.type === 'bar');
    
    // Verificar si hay series con eje derecho
    const hasRightAxis = seriesConfig.some(s => s.yAxisIndex === 1);
    
    const seriesData = seriesConfig.map((config, index) => {
        const row = currentMagazineData.find(r => r.CUC === config.code);
        const data = row ? allDateCols.map(d => parseFloat(row[d]) || 0) : allDateCols.map(() => 0);
        
        // Determinar tipo de gráfico (barra o línea)
        const chartType = config.type || 'line';
        const yAxisIndex = config.yAxisIndex || 0; // 0 = izquierdo, 1 = derecho
        
        const baseSeries = {
            name: config.name,
            type: chartType,
            data: data,
            yAxisIndex: yAxisIndex, // Asignar eje correspondiente
            label: {
                show: showChartLabels,
                position: chartType === 'bar' ? 'top' : 'top',
                formatter: (p) => formatNumber(p.value),
                fontSize: chartType === 'bar' ? (hasBarSeries && seriesConfig.filter(s => s.type === 'bar').length > 3 ? 7 : 9) : 8,
                fontWeight: 'bold',
                color: chartType === 'bar' ? '#fff' : config.color,
                distance: chartType === 'bar' ? 3 : 3,
                // Rotar etiquetas si hay muchas barras
                rotate: hasBarSeries && seriesConfig.filter(s => s.type === 'bar').length > 5 ? 90 : 0
            }
        };
        
        // Configuración específica para barras
        if (chartType === 'bar') {
            baseSeries.barWidth = hasBarSeries && seriesConfig.filter(s => s.type === 'bar').length > 5 ? '80%' : '60%';
            baseSeries.itemStyle = {
                color: config.color,
                borderRadius: [4, 4, 0, 0],
                shadowBlur: 10,
                shadowColor: 'rgba(0, 0, 0, 0.15)',
                shadowOffsetY: 5
            };
            // Si hay múltiples barras, usar stack para apilar
            if (seriesConfig.filter(s => s.type === 'bar').length > 1) {
                baseSeries.stack = 'total';
            }
        } else {
            // Configuración para líneas (mantener tu estilo actual)
            baseSeries.smooth = true;
            baseSeries.lineStyle = {
                width: 3,
                color: config.color,
                shadowBlur: 10,
                shadowColor: `rgba(${index === 0 ? '37, 99, 235' : index === 1 ? '245, 158, 11' : index === 2 ? '16, 185, 129' : '239, 68, 68'}, 0.4)`
            };
            baseSeries.areaStyle = {
                opacity: 0.1,
                color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                    { offset: 0, color: config.color + '4D' },
                    { offset: 1, color: config.color + '0D' }
                ])
            };
            baseSeries.itemStyle = {
                color: config.color,
                shadowBlur: 8,
                shadowColor: config.color
            };
            baseSeries.symbol = 'circle';
            baseSeries.symbolSize = 6;
        }
        
        return baseSeries;
    });
    
    const totalMonths = dateLabels.length;
    let zoomStart = 0;
    let zoomEnd = 100;
    
    if (totalMonths > 12) {
        zoomStart = ((totalMonths - 12) / totalMonths) * 100;
        zoomEnd = 100;
    }
    
    // Configuración de ejes Y - AHORA USANDO LOS PARÁMETROS
    const yAxisConfig = hasRightAxis ? [
        {
            type: 'value',
            name: leftAxisName,
            nameTextStyle: { 
                fontSize: 10, 
                color: '#64748b', 
                fontWeight: '600', 
                padding: [0, 0, 0, -50] // ✅ Aumentado de -40 a -50 para separar más del centro
            },
            axisLine: { show: false },
            axisTick: { show: false },
            axisLabel: { 
                fontSize: 9, 
                color: '#64748b', 
                formatter: (value) => formatNumber(value),
                padding: [0, 5, 0, 0] // ✅ Agregado: separar etiquetas del eje
            },
            splitLine: { lineStyle: { color: '#f1f5f9', type: 'dashed' } },
            position: 'left'
        },
        {
            type: 'value',
            name: rightAxisName,
            nameTextStyle: { 
                fontSize: 10, 
                color: '#64748b', 
                fontWeight: '600', 
                padding: [0, 0, 0, 50] // ✅ Aumentado de 40 a 50 para separar más del centro
            },
            axisLine: { show: false },
            axisTick: { show: false },
            axisLabel: { 
                fontSize: 9, 
                color: '#64748b', 
                formatter: (value) => formatNumber(value),
                padding: [0, 0, 0, 5] // ✅ Agregado: separar etiquetas del eje
            },
            splitLine: { show: false },
            position: 'right'
        }
    ] : {
        type: 'value',
        name: leftAxisName,
        nameTextStyle: { 
            fontSize: 10, 
            color: '#64748b', 
            fontWeight: '600', 
            padding: [0, 0, 0, -40] 
        },
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { 
            fontSize: 9, 
            color: '#64748b', 
            formatter: (value) => formatNumber(value) 
        },
        splitLine: { lineStyle: { color: '#f1f5f9', type: 'dashed' } }
    };
    
    const option = {
        title: { text: title, left: 'center', textStyle: { fontSize: 11, fontWeight: 'bold', color: '#1e3a8a' } },
        tooltip: {
            trigger: 'axis',
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            borderColor: '#e2e8f0',
            borderWidth: 1,
            textStyle: { color: '#334155', fontSize: 11 },
            axisPointer: { type: hasBarSeries ? 'shadow' : 'cross', crossStyle: { color: '#94a3b8' } },
            formatter: (params) => {
                let result = `<div style="padding: 5px;"><strong>${params[0].name}</strong></div>`;
                params.forEach(param => {
                    result += `<div style="display: flex; align-items: center; gap: 8px; margin: 4px 0;">
                        <span style="width: 10px; height: 10px; background: ${param.color}; border-radius: ${param.seriesType === 'bar' ? '2px' : '50%'};"></span>
                        <span>${param.seriesName}:</span>
                        <span style="font-weight: bold; margin-left: auto;">${formatNumber(param.value)}</span>
                    </div>`;
                });
                return result;
            }
        },
        legend: {
            data: seriesConfig.map(s => s.name),
            orient: 'vertical',
            right: '2%',
            top: 'center',
            textStyle: { fontSize: 10, color: '#64748b' },
            type: 'scroll',
            itemWidth: 12,
            itemHeight: 12,
            padding: [5, 10, 5, 5]
        },
        toolbox: {
            show: true,
            right: '2%',
            top: '0%',
            iconStyle: { borderColor: '#94a3b8' },
            feature: {
                saveAsImage: { title: 'Descargar', iconStyle: { borderColor: '#2563eb' } },
                magicType: { type: ['line', 'bar'], title: { line: 'Líneas', bar: 'Barras' }, iconStyle: { borderColor: '#2563eb' } },
                restore: { title: 'Restaurar', iconStyle: { borderColor: '#2563eb' } },
                dataZoom: { title: { zoom: 'Zoom', back: 'Restaurar' }, iconStyle: { borderColor: '#2563eb' } }
            }
        },
        // ✅ GRID AJUSTADO: Más espacio a la derecha cuando hay doble eje
        grid: { 
            left: '6%', 
            right: hasRightAxis ? '26%' : '18%', // ✅ Aumentado de 22% a 26% para doble eje
            bottom: '18%', 
            top: '15%', 
            containLabel: true 
        },
        xAxis: {
            type: 'category',
            data: dateLabels,
            boundaryGap: hasBarSeries ? true : false,
            axisLine: { lineStyle: { color: '#cbd5e1' } },
            axisLabel: { 
                fontSize: 9, 
                color: '#64748b', 
                rotate: dateLabels.length > 15 ? 45 : 0,
                interval: 'auto' 
            },
            axisTick: { show: false }
        },
        yAxis: yAxisConfig,
        dataZoom: [
            { type: 'inside', start: zoomStart, end: zoomEnd, zoomOnMouseWheel: true, moveOnMouseMove: true },
            { 
                type: 'slider', 
                bottom: 0, 
                start: zoomStart, 
                end: zoomEnd, 
                height: 20,
                borderColor: '#e2e8f0',
                fillerColor: 'rgba(37, 99, 235, 0.1)',
                backgroundColor: '#f8fafc',
                handleIcon: 'M10.7,11.9v-1.3H9.3v1.3c-4.9,0.3-8.8,4.4-8.8,9.4c0,5,3.9,9.1,8.8,9.4v1.3h1.3v-1.3c4.9-0.3,8.8-4.4,8.8-9.4C19.5,16.3,15.6,12.2,10.7,11.9z M13.3,24.4H6.7v-1.2h6.6V24.4z M13.3,19.6H6.7v-1.2h6.6V19.6z',
                handleSize: '100%',
                handleStyle: { color: '#fff', shadowBlur: 3, shadowColor: 'rgba(0, 0, 0, 0.3)', shadowOffsetX: 2, shadowOffsetY: 2 }
            }
        ],
        series: seriesData
    };
    
    chart.setOption(option, true); 
}

// ==========================================
// PÁGINA 3: ESTRUCTURA DEL ACTIVO PRODUCTIVO
// ==========================================

// ==========================================
// FUNCIONES ESPECÍFICAS PARA HOJA 3
// ==========================================

// ✅ RENDERIZAR TABLA DE ESTRUCTURA DEL ACTIVO (HOJA 3)
async function renderEstructuraActivoTable() {
    if (!currentMagazineData) return;
    
    const targetDate = `${currentYear}-${currentMonth}`;
    const prevMonthDate = getPreviousMonthDate(currentYear, currentMonth);
    const prevYearDate = subtractMonths(currentYear, currentMonth, 12);
    
    const cuentasEstructura = [
        { code: 'SB010', name: 'ACTIVOS PRODUCTIVOS', nivel: 1 },
        { code: '@1103', name: '1103. Bancos y otras instituciones financieras', nivel: 2 },
        { code: '@12', name: '12. OPERACIONES INTERBANCARIAS', nivel: 2 },
        { code: '@13', name: '13. INVERSIONES', nivel: 2 },
        { code: 'IF007', name: 'CARTERA POR VENCER', nivel: 2 },
        { code: '@170105', name: '170105. Terrenos', nivel: 3 },
        { code: '@170110', name: '170110. Obras de Urbanización', nivel: 3 },
        { code: '@170115', name: '170115. Obras de Edificación', nivel: 3 },
        { code: '@1901', name: '1901. Inversiones en acciones y participaciones', nivel: 3 },
        { code: '@190205', name: '190205. Inversiones', nivel: 3 },
        { code: '@190210', name: '190210. Cartera de créditos por vencer', nivel: 3 },
        { code: '@190215', name: '190215. Cartera de créditos refinanciada por vencer', nivel: 3 },
        { code: '@190220', name: '190220. Cartera de créditos reestructurada por vencer', nivel: 3 },
        { code: '@190240', name: '190240. Deudores por aceptación', nivel: 3 },
        { code: '@190250', name: '190250. Bienes Realizables', nivel: 3 },
        { code: '@190280', name: '190280. Inversiones en acciones y participaciones', nivel: 3 },
        { code: '@190286', name: '190286. Fondos de liquidez', nivel: 3 },
        { code: '@1903', name: '1903. Otras inversiones en participaciones', nivel: 3 }
    ];
    
    await renderTablaEstructuraGenerico(
        'estructuraTableBody',
        { mes1: 'th-mes1-estructura', mes2: 'th-mes2-estructura', mes3: 'th-mes3-estructura' },
        cuentasEstructura,
        targetDate,
        prevMonthDate,
        prevYearDate
    );
    
    // Actualizar KPIs específicos de Hoja 3
    updateKPIGenerico('@1103', 'kpi-1103', targetDate, prevYearDate);
    updateKPIGenerico('@13', 'kpi-13', targetDate, prevYearDate);
    updateKPIGenerico('IF007', 'kpi-cartera-vencer', targetDate, prevYearDate);
}

// ✅ GRÁFICO DE BARRAS APILADAS (HOJA 3)
function renderBarrasApiladas() {
    const targetDate = `${currentYear}-${currentMonth}`;
    const prevMonthDate = getPreviousMonthDate(currentYear, currentMonth);
    const prevYearDate = subtractMonths(currentYear, currentMonth, 12);
    
    renderBarrasApiladasGenerico('chartBarrasApiladas', 'Activos Productivos', 'SB010', targetDate, prevMonthDate, prevYearDate);
}

// ✅ GRÁFICO DE BARRAS POR CUENTAS (HOJA 3)
function renderBarrasCuentas() {
    const targetDate = `${currentYear}-${currentMonth}`;
    const prevMonthDate = getPreviousMonthDate(currentYear, currentMonth);
    const prevYearDate = subtractMonths(currentYear, currentMonth, 12);
    
    const cuentas = [
        { code: '@1103', name: '1103' },
        { code: '@12', name: '12' },
        { code: '@13', name: '13' },
        { code: 'IF007', name: 'Cartera' }
    ];
    
    renderBarrasCuentasGenerico('chartBarrasCuentas', cuentas, targetDate, prevMonthDate, prevYearDate);
}

// ✅ GRÁFICO HISTÓRICO (HOJA 3)
function renderHistoricoEstructura() {
    const seriesConfig = [
        { code: '@1103', name: '1103. Bancos', color: '#2563eb' },
        { code: 'IF007', name: 'Cartera por Vencer', color: '#f59e0b' },
        { code: '@13', name: '13. Inversiones', color: '#10b981' },
        { code: '@12', name: '12. Operaciones', color: '#ef4444' }
    ];
    
    renderHistoricoEstructuraGenerico('chartHistoricoEstructura', seriesConfig, 'Evolución Histórica');
}

// ✅ FUNCIÓN PRINCIPAL PARA RENDERIZAR PÁGINA 3
async function renderEstructuraActivoPage() {
    await renderEstructuraActivoTable();
    renderBarrasApiladas();
    renderBarrasCuentas();
    renderHistoricoEstructura();
    generateDynamicAnalysis();
}


// ✅ GENERAR ANÁLISIS DINÁMICO
function generateDynamicAnalysis() {
    if (!currentMagazineData) return;
    
    const targetDate = `${currentYear}-${currentMonth}`;
    const prevMonthDate = getPreviousMonthDate(currentYear, currentMonth);
    const prevYearDate = subtractMonths(currentYear, currentMonth, 12);
    
    // Actualizar fecha en el header
    document.getElementById('analisis-fecha').textContent = formatHeaderDate(targetDate);
    
    // Obtener datos de las cuentas principales
    const cuentas = [
        { code: 'SB010', name: 'Activos Productivos' },
        { code: '@1103', name: 'Bancos' },
        { code: '@12', name: 'Operaciones Interbancarias' },
        { code: '@13', name: 'Inversiones' },
        { code: 'IF007', name: 'Cartera por Vencer' }
    ];
    
    const datos = cuentas.map(c => {
        const row = currentMagazineData.find(r => r.CUC === c.code);
        if (!row) return null;
        
        const valCurrent = parseFloat(row[targetDate]) || 0;
        const valPrevMonth = parseFloat(row[prevMonthDate]) || 0;
        const valPrevYear = parseFloat(row[prevYearDate]) || 0;
        
        const varMonthly = valPrevMonth !== 0 ? ((valCurrent - valPrevMonth) / Math.abs(valPrevMonth)) * 100 : 0;
        const varAnnual = valPrevYear !== 0 ? ((valCurrent - valPrevYear) / Math.abs(valPrevYear)) * 100 : 0;
        
        return {
            ...c,
            valCurrent,
            valPrevMonth,
            valPrevYear,
            varMonthly,
            varAnnual
        };
    }).filter(d => d !== null);
    
    const activosProductivos = datos.find(d => d.code === 'SB010');
    const bancos = datos.find(d => d.code === '@1103');
    const inversiones = datos.find(d => d.code === '@13');
    const cartera = datos.find(d => d.code === 'IF007');
    
    // Análisis general
    let analisisHTML = '';
    
    // 1. Resumen general
    analisisHTML += `<div class="analisis-seccion">`;
    analisisHTML += `<h5><i class="fas fa-chart-bar"></i> Resumen General</h5>`;
    
    if (activosProductivos) {
        const tendencia = activosProductivos.varMonthly > 0 ? 'crecimiento' : activosProductivos.varMonthly < 0 ? 'decrecimiento' : 'estabilidad';
        const icono = activosProductivos.varMonthly > 0 ? '📈' : activosProductivos.varMonthly < 0 ? '📉' : '➡️';
        
        analisisHTML += `<p>${icono} Los <strong>Activos Productivos</strong> registran ${formatNumber(activosProductivos.valCurrent)} millones USD, con una variación mensual de <span class="${activosProductivos.varMonthly > 0 ? 'highlight-positive' : activosProductivos.varMonthly < 0 ? 'highlight-negative' : ''}">${activosProductivos.varMonthly.toFixed(2)}%</span> y anual de <span class="${activosProductivos.varAnnual > 0 ? 'highlight-positive' : activosProductivos.varAnnual < 0 ? 'highlight-negative' : ''}">${activosProductivos.varAnnual.toFixed(2)}%</span>.</p>`;
        analisisHTML += `<p>La tendencia del período es de <strong>${tendencia}</strong> en la composición del activo productivo.</p>`;
    }
    
    analisisHTML += `</div>`;
    
    // 2. Análisis por componente
    analisisHTML += `<div class="analisis-seccion">`;
    analisisHTML += `<h5><i class="fas fa-pie-chart"></i> Composición del Activo Productivo</h5>`;
    analisisHTML += `<ul>`;
    
    if (bancos && bancos.valCurrent > 0) {
        const porcentaje = activosProductivos ? (bancos.valCurrent / activosProductivos.valCurrent) * 100 : 0;
        analisisHTML += `<li><strong>Bancos:</strong> ${formatNumber(bancos.valCurrent)} millones (${porcentaje.toFixed(1)}% del total) - Variación mensual: <span class="${bancos.varMonthly > 0 ? 'highlight-positive' : bancos.varMonthly < 0 ? 'highlight-negative' : ''}">${bancos.varMonthly.toFixed(2)}%</span></li>`;
    }
    
    if (inversiones && inversiones.valCurrent > 0) {
        const porcentaje = activosProductivos ? (inversiones.valCurrent / activosProductivos.valCurrent) * 100 : 0;
        analisisHTML += `<li><strong>Inversiones:</strong> ${formatNumber(inversiones.valCurrent)} millones (${porcentaje.toFixed(1)}% del total) - Variación mensual: <span class="${inversiones.varMonthly > 0 ? 'highlight-positive' : inversiones.varMonthly < 0 ? 'highlight-negative' : ''}">${inversiones.varMonthly.toFixed(2)}%</span></li>`;
    }
    
    if (cartera && cartera.valCurrent > 0) {
        const porcentaje = activosProductivos ? (cartera.valCurrent / activosProductivos.valCurrent) * 100 : 0;
        analisisHTML += `<li><strong>Cartera por Vencer:</strong> ${formatNumber(cartera.valCurrent)} millones (${porcentaje.toFixed(1)}% del total) - Variación mensual: <span class="${cartera.varMonthly > 0 ? 'highlight-positive' : cartera.varMonthly < 0 ? 'highlight-negative' : ''}">${cartera.varMonthly.toFixed(2)}%</span></li>`;
    }
    
    analisisHTML += `</ul>`;
    analisisHTML += `</div>`;
    
    // 3. Hallazgos destacados
    analisisHTML += `<div class="analisis-seccion">`;
    analisisHTML += `<h5><i class="fas fa-lightbulb"></i> Hallazgos Destacados</h5>`;
    
    // Encontrar la cuenta con mayor crecimiento
    const cuentasConVariacion = datos.filter(d => d.code !== 'SB010' && d.valCurrent > 0);
    if (cuentasConVariacion.length > 0) {
        const mayorCrecimiento = cuentasConVariacion.reduce((max, d) => d.varMonthly > max.varMonthly ? d : max);
        const mayorDecrecimiento = cuentasConVariacion.reduce((min, d) => d.varMonthly < min.varMonthly ? d : min);
        
        if (mayorCrecimiento.varMonthly > 0) {
            analisisHTML += `<p>✅ <strong>${mayorCrecimiento.name}</strong> presenta el mayor crecimiento mensual con <span class="highlight-positive">+${mayorCrecimiento.varMonthly.toFixed(2)}%</span>.</p>`;
        }
        
        if (mayorDecrecimiento.varMonthly < 0) {
            analisisHTML += `<p>⚠️ <strong>${mayorDecrecimiento.name}</strong> registra el mayor decrecimiento mensual con <span class="highlight-negative">${mayorDecrecimiento.varMonthly.toFixed(2)}%</span>.</p>`;
        }
    }
    
    // Análisis de concentración
    if (activosProductivos && cartera) {
        const concentracionCartera = (cartera.valCurrent / activosProductivos.valCurrent) * 100;
        if (concentracionCartera > 50) {
            analisisHTML += `<p>📊 La <strong>Cartera por Vencer</strong> representa más del 50% del activo productivo (${concentracionCartera.toFixed(1)}%), indicando alta concentración en operaciones de crédito.</p>`;
        } else if (concentracionCartera < 30) {
            analisisHTML += `<p>📊 La <strong>Cartera por Vencer</strong> representa menos del 30% del activo productivo (${concentracionCartera.toFixed(1)}%), sugiriendo diversificación en otras operaciones.</p>`;
        }
    }
    
    analisisHTML += `</div>`;
    
    // 4. Perspectiva
    analisisHTML += `<div class="analisis-seccion">`;
    analisisHTML += `<h5><i class="fas fa-binoculars"></i> Perspectiva</h5>`;
    
    if (activosProductivos && activosProductivos.varAnnual > 10) {
        analisisHTML += `<p> El activo productivo muestra un <strong>crecimiento anual sólido</strong> del ${activosProductivos.varAnnual.toFixed(2)}%, reflejando expansión en las operaciones de la entidad.</p>`;
    } else if (activosProductivos && activosProductivos.varAnnual < -5) {
        analisisHTML += `<p>🎯 El activo productivo presenta una <strong>contracción anual</strong> del ${activosProductivos.varAnnual.toFixed(2)}%, lo cual requiere atención en la estrategia de colocación.</p>`;
    } else {
        analisisHTML += `<p> El activo productivo mantiene una <strong>evolución estable</strong> con variación anual del ${activosProductivos?.varAnnual.toFixed(2) || 0}%, dentro de parámetros normales.</p>`;
    }
    
    analisisHTML += `</div>`;
    
    // Insertar el análisis en el contenedor
    document.getElementById('analisis-content').innerHTML = analisisHTML;
}

// ==========================================
// PÁGINA 3: FINAL DE LA HOJA 3
// ==========================================


// ==========================================
// PÁGINA 4: ESTRUCTURA DEL ACTIVO IMPRODUCTIVO
// ==========================================

// ==========================================
// PÁGINA 4: ESTRUCTURA DEL ACTIVO IMPRODUCTIVO
// ==========================================

// ✅ RENDERIZAR TABLA DE ACTIVO IMPRODUCTIVO (USANDO FUNCIÓN GENÉRICA)
async function renderImproductivoTable() {
    if (!currentMagazineData) return;
    
    const targetDate = `${currentYear}-${currentMonth}`;
    const prevMonthDate = getPreviousMonthDate(currentYear, currentMonth);
    const prevYearDate = subtractMonths(currentYear, currentMonth, 12);
    
    // Cuentas a mostrar con sus niveles - ACTIVO IMPRODUCTIVO
    const cuentasImproductivo = [
        { code: 'SB003', name: 'ACTIVOS IMPRODUCTIVOS BRUTOS', nivel: 1 },
        { code: '@11', name: '11. FONDOS DISPONIBLES', nivel: 2 },
        { code: '@13', name: '13. INVERSIONES', nivel: 2 },
        { code: 'IF008', name: 'CARTERA QUE NO DEVENGA INTERES', nivel: 2 },
        { code: 'IF009', name: 'CARTERA VENCIDA', nivel: 2 },
        { code: '@16', name: '16. CUENTAS POR COBRAR', nivel: 2 },
        { code: '@1699', name: '1699. (Provisión para cuentas por cobrar)', nivel: 3 },
        { code: '@17', name: '17. BIENES REALIZABLES, ADJUDICADOS POR PAGO...', nivel: 2 },
        { code: '@170105', name: '170105. Terrenos', nivel: 3 },
        { code: '@170110', name: '170110. Obras de Urbanización', nivel: 3 },
        { code: '@170115', name: '170115. Obras de Edificación', nivel: 3 },
        { code: '@1799', name: '1799. (Provisión para bienes realizables...)', nivel: 3 },
        { code: '@18', name: '18. PROPIEDADES Y EQUIPO', nivel: 2 },
        { code: '@19', name: '19. OTROS ACTIVOS', nivel: 2 },
        { code: '@1901', name: '1901. Inversiones en acciones y participaciones', nivel: 3 },
        { code: '@190205', name: '190205. Inversiones', nivel: 3 },
        { code: '@190210', name: '190210. Cartera de créditos por vencer', nivel: 3 },
        { code: '@190215', name: '190215. Cartera de créditos refinanciada por vencer', nivel: 3 },
        { code: '@190220', name: '190220. Cartera de créditos reestructurada por vencer', nivel: 3 },
        { code: '@190240', name: '190240. Deudores por aceptación', nivel: 3 },
        { code: '@190250', name: '190250. Bienes Realizables', nivel: 3 },
        { code: '@190280', name: '190280. Inversiones en acciones y participaciones', nivel: 3 },
        { code: '@190286', name: '190286. Fondos de liquidez', nivel: 3 },
        { code: '@1903', name: '1903. Otras inversiones en participaciones', nivel: 3 },
        { code: '@1999', name: '1999. (Provisión para otros activos irrecuperables)', nivel: 3 },
        { code: 'SB008', name: 'PROVISIONES', nivel: 1 },
        { code: '@1499', name: '1499. (PROVISIONES PARA CRÉDITOS INCOBRABLES)', nivel: 2 },
        { code: '@1699', name: '1699. (Provisión para cuentas por cobrar)', nivel: 2 },
        { code: '@1799', name: '1799. (Provisión para bienes realizables...)', nivel: 2 },
        { code: '@1999', name: '1999. (Provisión para otros activos irrecuperables)', nivel: 2 },
        { code: 'SB004', name: 'ACTIVOS IMPRODUCTIVOS NETOS', nivel: 1 }
    ];
    
    // ✅ USAR FUNCIÓN GENÉRICA con IDs de Hoja 4
    await renderTablaEstructuraGenerico(
        'improductivoTableBody',  // ID de la tabla de Hoja 4
        { 
            mes1: 'th-mes1-improductivo', 
            mes2: 'th-mes2-improductivo', 
            mes3: 'th-mes3-improductivo' 
        },
        cuentasImproductivo,
        targetDate,
        prevMonthDate,
        prevYearDate
    );
    
    // ✅ Actualizar KPIs usando función genérica
    updateKPIGenerico('SB003', 'kpi-sb003', targetDate, prevYearDate);
    updateKPIGenerico('SB008', 'kpi-sb008', targetDate, prevYearDate);
    updateKPIGenerico('SB004', 'kpi-sb004', targetDate, prevYearDate);
}

// ✅ GRÁFICO DE BARRAS - ACTIVOS IMPRODUCTIVOS NETOS (SB004) - USANDO FUNCIÓN GENÉRICA
function renderBarrasImproductivos() {
    const targetDate = `${currentYear}-${currentMonth}`;
    const prevMonthDate = getPreviousMonthDate(currentYear, currentMonth);
    const prevYearDate = subtractMonths(currentYear, currentMonth, 12);
    
    // ✅ USAR FUNCIÓN GENÉRICA con ID de Hoja 4
    renderBarrasApiladasGenerico(
        'chartBarrasImproductivos',  // ID del gráfico de Hoja 4
        'Activos Improductivos Netos', 
        'SB004', 
        targetDate, 
        prevMonthDate, 
        prevYearDate
    );
}

// ✅ GRÁFICO DE BARRAS POR CUENTAS IMPRODUCTIVAS - USANDO FUNCIÓN GENÉRICA
function renderBarrasCuentasImproductivas() {
    const targetDate = `${currentYear}-${currentMonth}`;
    const prevMonthDate = getPreviousMonthDate(currentYear, currentMonth);
    const prevYearDate = subtractMonths(currentYear, currentMonth, 12);
    
    const cuentas = [
        { code: '@11', name: 'Fondos Disp.' },
        { code: '@13', name: 'Inversiones' },
        { code: 'IF008', name: 'Cartera No Dev.' },
        { code: 'IF009', name: 'Cartera Vencida' }
    ];
    
    // ✅ USAR FUNCIÓN GENÉRICA con ID de Hoja 4
    renderBarrasCuentasGenerico(
        'chartBarrasCuentasImproductivas',  // ID del gráfico de Hoja 4
        cuentas,
        targetDate,
        prevMonthDate,
        prevYearDate
    );
}

// ✅ GRÁFICO HISTÓRICO IMPRODUCTIVOS - USANDO FUNCIÓN GENÉRICA
function renderHistoricoImproductivos() {
    const seriesConfig = [
        { code: '@11', name: 'Fondos Disponibles', color: '#3b82f6' },
        { code: '@13', name: 'Inversiones', color: '#10b981' },
        { code: 'IF008', name: 'Cartera No Dev.', color: '#f59e0b' },
        { code: 'IF009', name: 'Cartera Vencida', color: '#ef4444' }
    ];
    
    // ✅ USAR FUNCIÓN GENÉRICA con ID de Hoja 4
    renderHistoricoEstructuraGenerico(
        'chartHistoricoImproductivos',  // ID del gráfico de Hoja 4
        seriesConfig,
        'Evolución Histórica - Activos Improductivos'
    );
}

// ✅ GENERAR ANÁLISIS DINÁMICO - ACTIVO IMPRODUCTIVO (SE MANTIENE IGUAL)
function generateDynamicAnalysisImproductivo() {
    if (!currentMagazineData) return;
    
    const targetDate = `${currentYear}-${currentMonth}`;
    const prevMonthDate = getPreviousMonthDate(currentYear, currentMonth);
    const prevYearDate = subtractMonths(currentYear, currentMonth, 12);
    
    document.getElementById('analisis-fecha-improductivo').textContent = formatHeaderDate(targetDate);
    
    const sb003 = currentMagazineData.find(r => r.CUC === 'SB003');
    const sb004 = currentMagazineData.find(r => r.CUC === 'SB004');
    const sb008 = currentMagazineData.find(r => r.CUC === 'SB008');
    
    let analisisHTML = '';
    
    analisisHTML += `<div class="analisis-seccion">`;
    analisisHTML += `<h5><i class="fas fa-chart-bar"></i> Resumen General</h5>`;
    
    if (sb003) {
        const valCurrent = parseFloat(sb003[targetDate]) || 0;
        analisisHTML += `<p>📊 Los <strong>Activos Improductivos Brutos</strong> registran ${formatNumber(valCurrent)} millones USD.</p>`;
    }
    
    if (sb008) {
        const valCurrent = parseFloat(sb008[targetDate]) || 0;
        analisisHTML += `<p>⚠️ Las <strong>Provisiones Totales</strong> ascienden a ${formatNumber(valCurrent)} millones USD.</p>`;
    }
    
    if (sb004) {
        const valCurrent = parseFloat(sb004[targetDate]) || 0;
        const valPrevYear = parseFloat(sb004[prevYearDate]) || 0;
        const varAnnual = valPrevYear !== 0 ? ((valCurrent - valPrevYear) / Math.abs(valPrevYear)) * 100 : 0;
        
        analisisHTML += `<p>💰 Los <strong>Activos Improductivos Netos</strong> son ${formatNumber(valCurrent)} millones USD, con variación anual de <span class="${varAnnual > 0 ? 'highlight-negative' : 'highlight-positive'}">${varAnnual.toFixed(2)}%</span>.</p>`;
    }
    
    analisisHTML += `</div>`;
    
    // Composición
    analisisHTML += `<div class="analisis-seccion">`;
    analisisHTML += `<h5><i class="fas fa-pie-chart"></i> Composición</h5>`;
    
    const cuentas = ['@11', '@13', 'IF008', 'IF009'];
    const nombres = ['Fondos Disponibles', 'Inversiones', 'Cartera No Devenga', 'Cartera Vencida'];
    
    analisisHTML += `<ul>`;
    cuentas.forEach((code, idx) => {
        const row = currentMagazineData.find(r => r.CUC === code);
        if (row) {
            const val = parseFloat(row[targetDate]) || 0;
            const total = sb004 ? (parseFloat(sb004[targetDate]) || 1) : 1;
            const porcentaje = (val / total) * 100;
            analisisHTML += `<li><strong>${nombres[idx]}:</strong> ${formatNumber(val)} millones (${porcentaje.toFixed(1)}%)</li>`;
        }
    });
    analisisHTML += `</ul>`;
    analisisHTML += `</div>`;
    
    document.getElementById('analisis-content-improductivo').innerHTML = analisisHTML;
}

// ✅ FUNCIÓN PRINCIPAL PARA RENDERIZAR PÁGINA 4
async function renderImproductivoPage() {
    await renderImproductivoTable();
    renderBarrasImproductivos();
    renderBarrasCuentasImproductivas();
    renderHistoricoImproductivos();
    generateDynamicAnalysisImproductivo();
}

// ==========================================
// PÁGINA 4: FINAL DE LA HOJA 4
// ==========================================

// ==========================================
// PÁGINA 5: HOJA 5
// ==========================================

// ==========================================
// PÁGINA 5: FINAL DE LA HOJA 5
// ==========================================

// ==========================================
// SISTEMA GENÉRICO DE RANKING - HOJA 5, 6, 7, 8, etc.
// ==========================================

// ✅ CONFIGURACIÓN DE RANKINGS (Centralizada)
const RANKING_CONFIGS = {
    rankingActivos: {
        id: 'rankingActivos',
        cuentaCodigo: '@1',
        cuentaNombre: 'ACTIVOS',
        panel2Cuentas: [
            { code: '@1', name: 'ACTIVOS' },
            { code: 'IF007', name: 'CARTERA VENCER' },
            { code: 'SB010', name: 'ACTIVOS PRODUCTIVOS' }
        ],
        tablaBodyId: 'rankingTableBody',
        panel2BodyId: 'panel2TableBody',
        chartId: 'chartRanking',
        radioName: 'tipoRanking',
        headers: {
            prevYear: 'ranking-header-1',
            prevPart: 'ranking-header-2',
            current: 'ranking-header-3',
            currentPart: 'ranking-header-4'
        },
        panel2Headers: {
            prevYear: 'panel2-prev-year',
            current: 'panel2-current'
        },
        rankingNumberId: 'rankingNumber',
        rankingBadgeId: 'rankingBadge'
    },
    rankingPasivo: {
        id: 'rankingPasivo',
        cuentaCodigo: '@2',
        cuentaNombre: 'PASIVO',
        panel2Cuentas: [
            { code: '@2', name: 'PASIVO' },
            { code: '@21', name: 'OBLIGACIONES PÚBLICO' },
            { code: '@2103', name: 'DEPÓSITOS PLAZO' }
        ],
        tablaBodyId: 'rankingTableBody_Pasivo',
        panel2BodyId: 'panel2TableBody_Pasivo',
        chartId: 'chartRanking_Pasivo',
        radioName: 'tipoRankingPasivo',
        headers: {
            prevYear: 'ranking-header-1-pasivo',
            prevPart: 'ranking-header-2-pasivo',
            current: 'ranking-header-3-pasivo',
            currentPart: 'ranking-header-4-pasivo'
        },
        panel2Headers: {
            prevYear: 'panel2-prev-year-pasivo',
            current: 'panel2-current-pasivo'
        },
        rankingNumberId: 'rankingNumber_Pasivo',
        rankingBadgeId: 'rankingBadge_Pasivo'
    },
    // ✅ NUEVO: Configuración para Hoja 24 (Ranking Cartera)
    rankingCartera: {
        id: 'rankingCartera',
        cuentaCodigo: '@14',
        cuentaNombre: 'CARTERA',
        panel2Cuentas: [
            { code: '@14', name: 'CARTERA NETA' },
            { code: 'IF007', name: 'CARTERA POR VENCER' },
            { code: 'IF012', name: 'MOROSIDAD' }
        ],
        tablaBodyId: 'rankingTableBody_Cartera',
        panel2BodyId: 'panel2TableBody_Cartera',
        chartId: 'chartRanking_Cartera',
        radioName: 'tipoRankingCartera',
        headers: {
            prevYear: 'ranking-header-1-cartera',
            prevPart: 'ranking-header-2-cartera',
            current: 'ranking-header-3-cartera',
            currentPart: 'ranking-header-4-cartera'
        },
        panel2Headers: {
            prevYear: 'panel2-prev-year-cartera',
            current: 'panel2-current-cartera'
        },
        rankingNumberId: 'rankingNumber_Cartera',
        rankingBadgeId: 'rankingBadge_Cartera'
    },
    // ✅ NUEVO: Configuración para Hoja 24 (Ranking Cartera)
    rankingMOA: {
        id: 'rankingMOA',
        cuentaCodigo: 'monto_total',
        cuentaNombre: 'MOA',
        panel2Cuentas: [
            { code: 'monto_total', name: 'MOA' },
            { code: 'ope_total', name: '# OPERACIONES' },
            { code: 'monto_pro', name: 'PROMEDIO USD' }
        ],
        tablaBodyId: 'rankingTableBody_MOA',
        panel2BodyId: 'panel2TableBody_MOA',
        chartId: 'chartRanking_MOA',
        radioName: 'tipoRankingMOA',
        headers: {
            prevYear: 'ranking-header-1-moa',
            prevPart: 'ranking-header-2-moa',
            current: 'ranking-header-3-moa',
            currentPart: 'ranking-header-4-moa'
        },
        panel2Headers: {
            prevYear: 'panel2-prev-year-moa',
            current: 'panel2-current-moa'
        },
        rankingNumberId: 'rankingNumber_MOA',
        rankingBadgeId: 'rankingBadge_MOA'
    },
    // ✅ NUEVO: Configuración para Hoja 24 (Ranking Cartera)
    rankingMOP: {
        id: 'rankingMOP',
        cuentaCodigo: 'mop',
        cuentaNombre: 'MOP',
        panel2Cuentas: [
            { code: 'mop', name: 'MOP' },
            { code: 'OPTPE', name: '# OPERACIONES' },
            { code: 'pro_MOP', name: 'PROMEDIO USD' }
        ],
        tablaBodyId: 'rankingTableBody_MOP',
        panel2BodyId: 'panel2TableBody_MOP',
        chartId: 'chartRanking_MOP',
        radioName: 'tipoRankingMOP',
        headers: {
            prevYear: 'ranking-header-1-mop',
            prevPart: 'ranking-header-2-mop',
            current: 'ranking-header-3-mop',
            currentPart: 'ranking-header-4-mop'
        },
        panel2Headers: {
            prevYear: 'panel2-prev-year-mop',
            current: 'panel2-current-mop'
        },
        rankingNumberId: 'rankingNumber_MOP',
        rankingBadgeId: 'rankingBadge_MOP'
    }
};

// ✅ FUNCIÓN GENÉRICA PRINCIPAL - RENDERIZAR RANKING
async function renderRankingGenerico(configKey) {
    const config = RANKING_CONFIGS[configKey];
    if (!config) {
        console.error(`❌ Configuración no encontrada: ${configKey}`);
        return;
    }

    if (!currentMagazineData) {
        console.warn('️ currentMagazineData no disponible');
        return;
    }

    // ✅ 1. Cargar datos de la entidad para la cuenta específica del ranking
    const entidadesData = await loadRankingData(config.cuentaCodigo);
    
    if (entidadesData.length === 0) {
        console.warn(`⚠️ No se encontraron datos para la cuenta: ${config.cuentaCodigo}`);
        return;
    }
    
    const targetDate = `${currentYear}-${currentMonth}`;
    const prevYearDate = subtractMonths(currentYear, currentMonth, 12);
    
    // 2. Obtener el tipo de filtro seleccionado
    const filtroSeleccionado = document.querySelector(`input[name="${config.radioName}"]:checked`);
    const tipoFiltro = filtroSeleccionado ? filtroSeleccionado.value : 'sector';
    
    // 3. Obtener el valor de referencia de la entidad seleccionada
    const entidadReferencia = currentMagazineEntity;
    const entidadRefData = entidadesData.find(e => e.Filtro === entidadReferencia);
    
    if (!entidadRefData) {
        console.warn(`⚠️ Entidad de referencia no encontrada: ${entidadReferencia}`);
        return;
    }
    
    // 4. Filtrar entidades según el criterio
    let entidadesFiltradas = [];
    if (tipoFiltro === 'sector') {
        entidadesFiltradas = entidadesData.filter(e => e.Tamaño === entidadRefData.Tamaño);
    } else if (tipoFiltro === 'activos') {
        entidadesFiltradas = entidadesData.filter(e => e.Rango_Activos === entidadRefData.Rango_Activos);
    } else if (tipoFiltro === 'provincia') {
        // ✅ NUEVO: Filtrar por la columna DPR_PA del DataFrame
        entidadesFiltradas = entidadesData.filter(e => e.DPR_PA === entidadRefData.DPR_PA);
    }
    
    // 5. Calcular valores para cada entidad filtrada
    let rankingData = entidadesFiltradas.map(objEntidad => {
        const row = entidadesData.find(e => e.Filtro === objEntidad.Filtro);
        if (!row) return null;
        
        const valorAnterior = row[prevYearDate] !== undefined ? parseFloat(row[prevYearDate]) : 0;
        const valorActual = row[targetDate] !== undefined ? parseFloat(row[targetDate]) : 0;
        
        return {
            entidad: objEntidad.Filtro,
            valorAnterior: valorAnterior,
            valorActual: valorActual
        };
    }).filter(item => item !== null);

    // 6. Calcular totales y participaciones
    const totalAnterior = rankingData.reduce((sum, item) => sum + (item.valorAnterior || 0), 0);
    const totalActual = rankingData.reduce((sum, item) => sum + (item.valorActual || 0), 0);
    
    rankingData.forEach(item => {
        item.participacionAnterior = totalAnterior > 0 ? (item.valorAnterior / totalAnterior) * 100 : 0;
        item.participacionActual = totalActual > 0 ? (item.valorActual / totalActual) * 100 : 0;
    });

    // 7. Ordenar por la participación actual de mayor a menor
    rankingData.sort((a, b) => b.participacionActual - a.participacionActual);
    
    // 8. Agregar posición
    rankingData.forEach((item, index) => {
        item.posicion = index + 1;
    });
    
    // 9. Renderizar tabla y actualizar headers
    renderizarTablaRankingGenerico(rankingData, config);
    actualizarHeadersRankingGenerico(targetDate, prevYearDate, config);

    // 10. Renderizar gráfico de treemap
    renderRankingTreemapGenerico(rankingData, targetDate, config);
    
    // 11. Renderizar panel 2
    renderPanel2Generico(config);
    
    // 12. Calcular y mostrar posición en el ranking
    calcularYMostrarRankingPositionGenerico(rankingData, entidadReferencia, config);
}

// ✅ FUNCIÓN GENÉRICA - RENDERIZAR TABLA
function renderizarTablaRankingGenerico(datos, config) {
    const tbody = document.getElementById(config.tablaBodyId);
    if (!tbody) {
        console.warn(`⚠️ tbody no encontrado: ${config.tablaBodyId}`);
        return;
    }
    
    if (datos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 20px;">No hay datos disponibles</td></tr>';
        return;
    }
    
    let html = '';
    datos.forEach((item) => {
        let rowClasses = [];
        
        // Clases para el podio
        if (item.posicion === 1) rowClasses.push('posicion-oro');
        else if (item.posicion === 2) rowClasses.push('posicion-plata');
        else if (item.posicion === 3) rowClasses.push('posicion-bronce');
        
        // Resaltar la fila de la entidad actualmente seleccionada
        if (item.entidad === currentMagazineEntity) {
            rowClasses.push('entidad-actual');
        }
        
        const classString = rowClasses.join(' ');
        
        html += `
            <tr class="${classString}">
                <td>${item.posicion}</td>
                <td>${item.entidad}</td>
                <td>${formatNumber(item.valorAnterior)}</td>
                <td>${item.participacionAnterior.toFixed(2)}%</td>
                <td>${formatNumber(item.valorActual)}</td>
                <td>${item.participacionActual.toFixed(2)}%</td>
            </tr>
        `;
    });
    
    // Agregar fila de totales
    const totalAnterior = datos.reduce((sum, item) => sum + (item.valorAnterior || 0), 0);
    const totalActual = datos.reduce((sum, item) => sum + (item.valorActual || 0), 0);
    
    html += `
        <tr class="total-row">
            <td>-</td>
            <td>TOTAL</td>
            <td>${formatNumber(totalAnterior)}</td>
            <td>100.00%</td>
            <td>${formatNumber(totalActual)}</td>
            <td>100.00%</td>
        </tr>
    `;
    
    tbody.innerHTML = html;
}

// ✅ FUNCIÓN GENÉRICA - ACTUALIZAR HEADERS
function actualizarHeadersRankingGenerico(targetDate, prevYearDate, config) {
    const h1 = document.getElementById(config.headers.prevYear);
    const h2 = document.getElementById(config.headers.prevPart);
    const h3 = document.getElementById(config.headers.current);
    const h4 = document.getElementById(config.headers.currentPart);
    
    // ✅ CORREGIDO: Usar la variable dinámica en lugar de "Activos" fijo
    if (h1) h1.textContent = `${config.cuentaNombre} ${formatHeaderDate(prevYearDate)}`;
    if (h2) h2.textContent = `Part. ${formatHeaderDate(prevYearDate)}`;
    if (h3) h3.textContent = `${config.cuentaNombre} ${formatHeaderDate(targetDate)}`;
    if (h4) h4.textContent = `Part. ${formatHeaderDate(targetDate)}`;
}

// ✅ FUNCIÓN GENÉRICA - RENDERIZAR PANEL 2
function renderPanel2Generico(config) {
    if (!currentMagazineData) return;
    
    const targetDate = `${currentYear}-${currentMonth}`;
    const prevYearDate = subtractMonths(currentYear, currentMonth, 12);
    
    const tbody = document.getElementById(config.panel2BodyId);
    if (!tbody) {
        console.error(`❌ tbody panel2 no encontrado: ${config.panel2BodyId}`);
        return;
    }
    
    let html = '';
    
    config.panel2Cuentas.forEach(cuenta => {
        const row = currentMagazineData.find(r => r.CUC === cuenta.code);
        if (!row) {
            console.warn(`️ No se encontró cuenta ${cuenta.code} (${cuenta.name})`);
            return;
        }
        
        const valPrevYear = parseFloat(row[prevYearDate]) || 0;
        const valCurrent = parseFloat(row[targetDate]) || 0;
        const variacion = valPrevYear !== 0 ? ((valCurrent - valPrevYear) / Math.abs(valPrevYear)) * 100 : 0;
        
        const variacionClass = variacion > 0 ? 'var-positiva' : variacion < 0 ? 'var-negativa' : '';
        const variacionIcon = variacion > 0 ? '▲' : variacion < 0 ? '▼' : '─';
        
        html += `
            <tr>
                <td><strong>${cuenta.name}</strong></td>
                <td>${formatNumber(valPrevYear)}</td>
                <td><strong>${formatNumber(valCurrent)}</strong></td>
                <td class="${variacionClass}">${variacion.toFixed(1)}% ${variacionIcon}</td>
            </tr>
        `;
    });

    // Actualizar headers del panel 2
    const thPrevYear = document.getElementById(config.panel2Headers.prevYear);
    const thCurrent = document.getElementById(config.panel2Headers.current);
    
    if (thPrevYear) thPrevYear.textContent = formatHeaderDate(prevYearDate);
    if (thCurrent) thCurrent.textContent = formatHeaderDate(targetDate);
    
    tbody.innerHTML = html;
}

// ✅ FUNCIÓN GENÉRICA - CALCULAR POSICIÓN
function calcularYMostrarRankingPositionGenerico(rankingData, entidadReferencia, config) {
    const posicionEntity = rankingData.findIndex(item => item.entidad === entidadReferencia);
    const posicionFinal = posicionEntity !== -1 ? posicionEntity + 1 : 0;
    
    const rankingNumberElement = document.getElementById(config.rankingNumberId);
    const rankingBadge = document.getElementById(config.rankingBadgeId);
    
    if (rankingNumberElement && rankingBadge) {
        rankingNumberElement.textContent = posicionFinal;
        
        rankingBadge.classList.remove('posicion-oro', 'posicion-plata', 'posicion-bronce');
        
        if (posicionFinal === 1) {
            rankingBadge.classList.add('posicion-oro');
        } else if (posicionFinal === 2) {
            rankingBadge.classList.add('posicion-plata');
        } else if (posicionFinal === 3) {
            rankingBadge.classList.add('posicion-bronce');
        }
    }
}

// ✅ FUNCIÓN GENÉRICA - RENDERIZAR TREEMAP
function renderRankingTreemapGenerico(rankingData, targetDate, config) {
    const chartDom = document.getElementById(config.chartId);
    if (!chartDom) {
        console.warn(`⚠️ Contenedor no encontrado: ${config.chartId}`);
        return;
    }
    
    if (chartDom.offsetWidth === 0 || chartDom.offsetHeight === 0) {
        setTimeout(() => renderRankingTreemapGenerico(rankingData, targetDate, config), 300);
        return;
    }
    
    const existingChart = echarts.getInstanceByDom(chartDom);
    if (existingChart) {
        existingChart.dispose();
    }
    
    const chart = echarts.init(chartDom);
    
    const topEntities = rankingData.slice(0, 20);
    
    const treemapData = topEntities.map((item, index) => {
        let color;
        if (index === 0) {
            color = '#f59e0b';
        } else if (index === 1) {
            color = '#94a3b8';
        } else if (index === 2) {
            color = '#b45309';
        } else {
            const colors = ['#3b82f6', '#10b981', '#8b5cf6', '#ec4899', '#f97316', 
                          '#14b8a6', '#6366f1', '#ef4444', '#22c55e', '#a855f7'];
            color = colors[index % colors.length];
        }
        
        return {
            name: item.entidad,
            value: item.participacionActual.toFixed(2),
            itemStyle: {
                color: color,
                borderWidth: 2,
                borderColor: '#fff',
                gapWidth: 2
            },
            label: {
                show: true,
                formatter: (params) => {
                    const name = params.name;
                    const value = params.value;
                    const displayName = name.length > 20 ? name.substring(0, 20) + '...' : name;
                    return `{name|${displayName}}\n{value|${value}%}`;
                },
                rich: {
                    name: { fontSize: 10, fontWeight: 'bold', color: '#fff', lineHeight: 14 },
                    value: { fontSize: 9, color: 'rgba(255,255,255,0.9)', lineHeight: 12 }
                }
            },
            emphasis: {
                itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.3)' },
                label: {
                    show: true,
                    formatter: (params) => {
                        return `{name|${params.name}}\n{value|${params.value}%}\n{monto|${formatNumber(rankingData.find(r => r.entidad === params.name)?.valorActual || 0)}}`;
                    },
                    rich: {
                        name: { fontSize: 12, fontWeight: 'bold', color: '#fff', lineHeight: 16 },
                        value: { fontSize: 11, color: '#fff', lineHeight: 14 },
                        monto: { fontSize: 10, color: 'rgba(255,255,255,0.9)', lineHeight: 12 }
                    }
                }
            }
        };
    });
    
    const option = {
        tooltip: {
    formatter: (params) => {
        const entidad = rankingData.find(r => r.entidad === params.name);
        return `
            <div style="padding: 10px;">
                <div style="font-weight: bold; margin-bottom: 8px; font-size: 13px;">${params.name}</div>
                <div style="margin: 4px 0; font-size: 12px;">
                    <span style="color: #64748b;">Participación:</span> 
                    <span style="color: #2563eb; font-weight: bold; margin-left: 5px;">${params.value}%</span>
                </div>
                <div style="margin: 4px 0; font-size: 12px;">
                    <span style="color: #64748b;">${config.cuentaNombre}:</span> 
                    <span style="color: #2563eb; font-weight: bold; margin-left: 5px;">${formatNumber(entidad?.valorActual || 0)}</span>
                </div>
                <div style="margin: 4px 0; font-size: 11px; color: #94a3b8;">
                    ${formatHeaderDate(targetDate)}
                </div>
            </div>
        `;
    },
            backgroundColor: 'rgba(255, 255, 255, 0.98)',
            borderColor: '#e2e8f0',
            borderWidth: 1,
            textStyle: { color: '#334155', fontSize: 11 },
            padding: [10, 15]
        },
        title: {
            text: `Distribución de Participación - ${formatHeaderDate(targetDate)}`,
            left: 'center',
            textStyle: { fontSize: 13, fontWeight: 'bold', color: '#1e3a8a' }
        },
        series: [{
            name: 'Participación de Entidades',
            type: 'treemap',
            data: treemapData,
            width: '95%',
            height: '90%',
            top: '8%',
            left: '2.5%',
            roam: false,
            nodeClick: false,
            breadcrumb: { show: false },
            levels: [
                { itemStyle: { borderWidth: 2, gapWidth: 2, borderColor: '#fff' } },
                { itemStyle: { borderWidth: 2, gapWidth: 2, borderColor: '#fff' } }
            ],
            label: {
                show: true,
                formatter: (params) => {
                    const name = params.name;
                    const value = params.value;
                    const displayName = name.length > 25 ? name.substring(0, 25) + '...' : name;
                    return `{name|${displayName}}\n{value|${value}%}`;
                },
                rich: {
                    name: { fontSize: 10, fontWeight: 'bold', color: '#fff', lineHeight: 14 },
                    value: { fontSize: 9, color: 'rgba(255,255,255,0.9)', lineHeight: 12 }
                }
            },
            emphasis: {
                itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.3)' },
                label: { show: true }
            }
        }]
    };
    
    chart.setOption(option);
    
    setTimeout(() => {
        chart.resize();
    }, 100);
}

// ✅ INICIALIZAR EVENT LISTENERS PARA RANKINGS
function initRankingEventListeners() {
    Object.values(RANKING_CONFIGS).forEach(config => {
        const radioButtons = document.querySelectorAll(`input[name="${config.radioName}"]`);
        radioButtons.forEach(radio => {
            // Clonamos para eliminar listeners antiguos y evitar duplicados
            const newRadio = radio.cloneNode(true);
            radio.parentNode.replaceChild(newRadio, radio);
            
            newRadio.addEventListener('change', async () => {
                console.log(`🔄 Cambio detectado en ${config.radioName}, actualizando...`);
                await renderRankingGenerico(config.id);
            });
        });
    });
}

// ✅ INICIALIZACIÓN AUTOMÁTICA
document.addEventListener('DOMContentLoaded', () => {
    initRankingEventListeners();
});

// ✅ FUNCIONES ESPECÍFICAS PARA HOJA 5 (WRAPPER)
async function renderRankingTable() {
    await renderRankingGenerico('rankingActivos');
}
async function renderPanel2Table() { /* Incluida en genérico */ }
async function calcularYMostrarRankingPosition() { /* Incluida en genérico */ }
function renderRankingTreemap() { /* Incluida en genérico */ }

// ✅ ✅ NUEVO: FUNCIONES ESPECÍFICAS PARA HOJA 9 (RANKING PASIVO)
// Estas son las que faltaban y causaban que todo el script se detuviera
async function renderRankingTable_Pasivo() {
    await renderRankingGenerico('rankingPasivo');
}
async function renderPanel2Table_Pasivo() { /* Incluida en genérico */ }
async function calcularYMostrarRankingPosition_Pasivo() { /* Incluida en genérico */ }
function renderRankingTreemap_Pasivo() { /* Incluida en genérico */ }

// ✅ ✅ NUEVO: FUNCIONES ESPECÍFICAS PARA HOJA 9 (RANKING CARTERA)
// Estas son las que faltaban y causaban que todo el script se detuviera
async function renderRankingTable_Cartera() {
    await renderRankingGenerico('rankingCartera');
}
async function renderPanel2Table_Cartera() { /* Incluida en genérico */ }
async function calcularYMostrarRankingPosition_Cartera() { /* Incluida en genérico */ }
function renderRankingTreemap_Cartera() { /* Incluida en genérico */ }

// ✅ ✅ NUEVO: FUNCIONES ESPECÍFICAS PARA HOJA 9 (RANKING CARTERA)
// Estas son las que faltaban y causaban que todo el script se detuviera
async function renderRankingTable_MOA() {
    await renderRankingGenerico('rankingMOA');
}
async function renderPanel2Table_MOA() { /* Incluida en genérico */ }
async function calcularYMostrarRankingPosition_MOA() { /* Incluida en genérico */ }
function renderRankingTreemap_MOA() { /* Incluida en genérico */ }

// ✅ ✅ NUEVO: FUNCIONES ESPECÍFICAS PARA HOJA 9 (RANKING CARTERA)
// Estas son las que faltaban y causaban que todo el script se detuviera
async function renderRankingTable_MOP() {
    await renderRankingGenerico('rankingMOP');
}
async function renderPanel2Table_MOP() { /* Incluida en genérico */ }
async function calcularYMostrarRankingPosition_MOP() { /* Incluida en genérico */ }
function renderRankingTreemap_MOP() { /* Incluida en genérico */ }

// ✅ INICIALIZACIÓN AUTOMÁTICA
document.addEventListener('DOMContentLoaded', () => {
    initRankingEventListeners();
});


// ==========================================
// PÁGINA 6: 
// ==========================================

// ✅ RENDERIZAR TABLA DE ACTIVO IMPRODUCTIVO (USANDO FUNCIÓN GENÉRICA)
async function renderPasivoTable() {
    if (!currentMagazineData) return;
    
    const targetDate = `${currentYear}-${currentMonth}`;
    const prevMonthDate = getPreviousMonthDate(currentYear, currentMonth);
    const prevYearDate = subtractMonths(currentYear, currentMonth, 12);
    
    // Cuentas a mostrar con sus niveles - ACTIVO IMPRODUCTIVO
    const cuentasPasivo = [
        { code: '@21', name: '21. OBLIGACIONES CON EL PÚBLICO', nivel: 1 },
        { code: '@2101', name: '2101. Depósitos a la vista', nivel: 2 },
        { code: '@210135', name: '210135. Depósitos de ahorro', nivel: 3 },
        { code: '@2102', name: '2102. Operaciones de reporto', nivel: 2 },
        { code: '@2103', name: '2103. Depósitos a plazo', nivel: 2 },
        { code: '@2104', name: '2104. Depósitos de garantía', nivel: 2 },
        { code: '@2105', name: '2105. Depósitos restringidos', nivel: 2 },
        { code: '@22', name: '22. OPERACIONES INTERBANCARIAS', nivel: 1 },
        { code: '@23', name: '23. OBLIGACIONES INMEDIATAS', nivel: 1 },
        { code: '@24', name: '24. ACEPTACIONES EN CIRCULACIÓN', nivel: 1 },
        { code: '@25', name: '25. CUENTAS POR PAGAR', nivel: 1 },
        { code: '@26', name: '26. OBLIGACIONES FINANCIERAS', nivel: 1 },
        { code: '@27', name: '27. VALORES EN CIRCULACIÓN', nivel: 1 },
        { code: '@28', name: '28. OBLIGACIONES CONVERTIBLES EN ACCIONES Y APORTES PARA FUTURA CAPITALIZACIÓN', nivel: 1 },
        { code: '@29', name: '29. OTROS PASIVOS', nivel: 1 }
    ];
    
    // ✅ USAR FUNCIÓN GENÉRICA con IDs de Hoja 4
    await renderTablaEstructuraGenerico(
        'pasivoTableBody',  // ID de la tabla de Hoja 4
        { 
            mes1: 'th-mes1-pasivo', 
            mes2: 'th-mes2-pasivo', 
            mes3: 'th-mes3-pasivo' 
        },
        cuentasPasivo,
        targetDate,
        prevMonthDate,
        prevYearDate
    );
    
    // ✅ Actualizar KPIs usando función genérica
    updateKPIGenerico('@21', 'kpi-21', targetDate, prevYearDate);
    updateKPIGenerico('@2103', 'kpi-2103', targetDate, prevYearDate);
    updateKPIGenerico('@210135', 'kpi-210135', targetDate, prevYearDate);
}

// ✅ GRÁFICO DE BARRAS - ACTIVOS IMPRODUCTIVOS NETOS (SB004) - USANDO FUNCIÓN GENÉRICA
function renderBarrasApiladasPasivo() {
    const targetDate = `${currentYear}-${currentMonth}`;
    const prevMonthDate = getPreviousMonthDate(currentYear, currentMonth);
    const prevYearDate = subtractMonths(currentYear, currentMonth, 12);
    
    // ✅ USAR FUNCIÓN GENÉRICA con ID de Hoja 4
    renderBarrasApiladasGenerico(
        'chartBarrasApiladasPasivo',  // ID del gráfico de Hoja 4
        'Obligaciones con el Público', 
        '@21', 
        targetDate, 
        prevMonthDate, 
        prevYearDate
    );
}

// ✅ GRÁFICO DE BARRAS POR CUENTAS IMPRODUCTIVAS - USANDO FUNCIÓN GENÉRICA
function renderBarrasCuentasPasivo() {
    const targetDate = `${currentYear}-${currentMonth}`;
    const prevMonthDate = getPreviousMonthDate(currentYear, currentMonth);
    const prevYearDate = subtractMonths(currentYear, currentMonth, 12);
    
    const cuentas = [
        { code: '@2101', name: '2101' },
        { code: '@2103', name: '2103' },
        { code: '@210135', name: '210135' },
        { code: '@22', name: '22' }
    ];
    
    // ✅ USAR FUNCIÓN GENÉRICA con ID de Hoja 4
    renderBarrasCuentasGenerico(
        'chartBarrasCuentasPasivo',  // ID del gráfico de Hoja 4
        cuentas,
        targetDate,
        prevMonthDate,
        prevYearDate
    );
}

// ✅ GRÁFICO HISTÓRICO IMPRODUCTIVOS - USANDO FUNCIÓN GENÉRICA
function renderHistoricoEstructuraPasivo() {
    const seriesConfig = [
        { code: '@21', name: 'Obligaciones con el Público', color: '#3b82f6' },
        { code: '@2101', name: 'Depósitos a la vista', color: '#10b981' },
        { code: '@2103', name: 'Depósitos a plazo', color: '#f59e0b' },

    ];
    
    // ✅ USAR FUNCIÓN GENÉRICA con ID de Hoja 4
    renderHistoricoEstructuraGenerico(
        'chartHistoricoEstructuraPasivo',  // ID del gráfico de Hoja 4
        seriesConfig,
        'Evolución Histórica - Obligaciones con el Público'
    );
}

// ✅ GENERAR ANÁLISIS DINÁMICO - ACTIVO IMPRODUCTIVO (SE MANTIENE IGUAL)
function generateDynamicAnalysisPasivo() {
    if (!currentMagazineData) return;
    
    const targetDate = `${currentYear}-${currentMonth}`;
    const prevMonthDate = getPreviousMonthDate(currentYear, currentMonth);
    const prevYearDate = subtractMonths(currentYear, currentMonth, 12);
    
    // Actualizar fecha en el header
    document.getElementById('analisis-fecha-pasivo').textContent = formatHeaderDate(targetDate);
    
    // Obtener datos de las cuentas principales
    const cuentas = [
        { code: '@21', name: 'Obligaciones con el Público' },
        { code: '@2101', name: 'Depósitos a la vista' },
        { code: '@2103', name: 'Depósitos a plazo' },
        { code: '@210135', name: 'Depósitos de ahorro' },
        { code: '@22', name: 'Operaciones Interbancarias' }
    ];
    
    const datos = cuentas.map(c => {
        const row = currentMagazineData.find(r => r.CUC === c.code);
        if (!row) return null;
        
        const valCurrent = parseFloat(row[targetDate]) || 0;
        const valPrevMonth = parseFloat(row[prevMonthDate]) || 0;
        const valPrevYear = parseFloat(row[prevYearDate]) || 0;
        
        const varMonthly = valPrevMonth !== 0 ? ((valCurrent - valPrevMonth) / Math.abs(valPrevMonth)) * 100 : 0;
        const varAnnual = valPrevYear !== 0 ? ((valCurrent - valPrevYear) / Math.abs(valPrevYear)) * 100 : 0;
        
        return {
            ...c,
            valCurrent,
            valPrevMonth,
            valPrevYear,
            varMonthly,
            varAnnual
        };
    }).filter(d => d !== null);
    
    const obligacionesPublico = datos.find(d => d.code === '@21');
    const depositosVista = datos.find(d => d.code === '@2101');
    const depositosPlazo = datos.find(d => d.code === '@2103');
    const depositosAhorro = datos.find(d => d.code === '@210135');
    
    // Análisis general
    let analisisHTML = '';
    
    // 1. Resumen general
    analisisHTML += `<div class="analisis-seccion">`;
    analisisHTML += `<h5><i class="fas fa-chart-bar"></i> Resumen General</h5>`;
    if (obligacionesPublico) {
        const tendencia = obligacionesPublico.varMonthly > 0 ? 'crecimiento' : obligacionesPublico.varMonthly < 0 ? 'decrecimiento' : 'estabilidad';
        const icono = obligacionesPublico.varMonthly > 0 ? '📈' : obligacionesPublico.varMonthly < 0 ? '' : '➡️';
        analisisHTML += `<p>${icono} Las <strong>Obligaciones con el Público</strong> registran ${formatNumber(obligacionesPublico.valCurrent)} millones USD, con una variación mensual de <span class="${obligacionesPublico.varMonthly > 0 ? 'highlight-positive' : obligacionesPublico.varMonthly < 0 ? 'highlight-negative' : ''}">${obligacionesPublico.varMonthly.toFixed(2)}%</span> y anual de <span class="${obligacionesPublico.varAnnual > 0 ? 'highlight-positive' : obligacionesPublico.varAnnual < 0 ? 'highlight-negative' : ''}">${obligacionesPublico.varAnnual.toFixed(2)}%</span>.</p>`;
        analisisHTML += `<p>La tendencia del período es de <strong>${tendencia}</strong> en la captación de recursos.</p>`;
    }
    analisisHTML += `</div>`;
    
    // 2. Análisis por componente
    analisisHTML += `<div class="analisis-seccion">`;
    analisisHTML += `<h5><i class="fas fa-pie-chart"></i> Composición del Pasivo</h5>`;
    analisisHTML += `<ul>`;
    if (depositosVista && depositosVista.valCurrent > 0) {
        const porcentaje = obligacionesPublico ? (depositosVista.valCurrent / obligacionesPublico.valCurrent) * 100 : 0;
        analisisHTML += `<li><strong>Depósitos a la vista:</strong> ${formatNumber(depositosVista.valCurrent)} millones (${porcentaje.toFixed(1)}% del total) - Variación mensual: <span class="${depositosVista.varMonthly > 0 ? 'highlight-positive' : depositosVista.varMonthly < 0 ? 'highlight-negative' : ''}">${depositosVista.varMonthly.toFixed(2)}%</span></li>`;
    }
    if (depositosPlazo && depositosPlazo.valCurrent > 0) {
        const porcentaje = obligacionesPublico ? (depositosPlazo.valCurrent / obligacionesPublico.valCurrent) * 100 : 0;
        analisisHTML += `<li><strong>Depósitos a plazo:</strong> ${formatNumber(depositosPlazo.valCurrent)} millones (${porcentaje.toFixed(1)}% del total) - Variación mensual: <span class="${depositosPlazo.varMonthly > 0 ? 'highlight-positive' : depositosPlazo.varMonthly < 0 ? 'highlight-negative' : ''}">${depositosPlazo.varMonthly.toFixed(2)}%</span></li>`;
    }
    if (depositosAhorro && depositosAhorro.valCurrent > 0) {
        const porcentaje = obligacionesPublico ? (depositosAhorro.valCurrent / obligacionesPublico.valCurrent) * 100 : 0;
        analisisHTML += `<li><strong>Depósitos de ahorro:</strong> ${formatNumber(depositosAhorro.valCurrent)} millones (${porcentaje.toFixed(1)}% del total) - Variación mensual: <span class="${depositosAhorro.varMonthly > 0 ? 'highlight-positive' : depositosAhorro.varMonthly < 0 ? 'highlight-negative' : ''}">${depositosAhorro.varMonthly.toFixed(2)}%</span></li>`;
    }
    analisisHTML += `</ul>`;
    analisisHTML += `</div>`;
    
    // 3. Hallazgos destacados
    analisisHTML += `<div class="analisis-seccion">`;
    analisisHTML += `<h5><i class="fas fa-lightbulb"></i> Hallazgos Destacados</h5>`;
    
    // Encontrar la cuenta con mayor crecimiento
    const cuentasConVariacion = datos.filter(d => d.code !== '@21' && d.valCurrent > 0);
    if (cuentasConVariacion.length > 0) {
        const mayorCrecimiento = cuentasConVariacion.reduce((max, d) => d.varMonthly > max.varMonthly ? d : max);
        const mayorDecrecimiento = cuentasConVariacion.reduce((min, d) => d.varMonthly < min.varMonthly ? d : min);
        
        if (mayorCrecimiento.varMonthly > 0) {
            analisisHTML += `<p>✅ <strong>${mayorCrecimiento.name}</strong> presenta el mayor crecimiento mensual con <span class="highlight-positive">+${mayorCrecimiento.varMonthly.toFixed(2)}%</span>.</p>`;
        }
        if (mayorDecrecimiento.varMonthly < 0) {
            analisisHTML += `<p>️ <strong>${mayorDecrecimiento.name}</strong> registra el mayor decrecimiento mensual con <span class="highlight-negative">${mayorDecrecimiento.varMonthly.toFixed(2)}%</span>.</p>`;
        }
    }
    
    // Análisis de concentración
    if (obligacionesPublico && depositosPlazo) {
        const concentracionPlazo = (depositosPlazo.valCurrent / obligacionesPublico.valCurrent) * 100;
        if (concentracionPlazo > 50) {
            analisisHTML += `<p>📊 Los <strong>Depósitos a plazo</strong> representan más del 50% de las obligaciones con el público (${concentracionPlazo.toFixed(1)}%), indicando alta dependencia de recursos estables.</p>`;
        } else if (concentracionPlazo < 30) {
            analisisHTML += `<p>📊 Los <strong>Depósitos a plazo</strong> representan menos del 30% de las obligaciones con el público (${concentracionPlazo.toFixed(1)}%), sugiriendo diversificación en fuentes de fondeo.</p>`;
        }
    }
    analisisHTML += `</div>`;
    
    // 4. Perspectiva
    analisisHTML += `<div class="analisis-seccion">`;
    analisisHTML += `<h5><i class="fas fa-binoculars"></i> Perspectiva</h5>`;
    if (obligacionesPublico && obligacionesPublico.varAnnual > 10) {
        analisisHTML += `<p> Las obligaciones con el público muestran un <strong>crecimiento anual sólido</strong> del ${obligacionesPublico.varAnnual.toFixed(2)}%, reflejando expansión en la captación de recursos.</p>`;
    } else if (obligacionesPublico && obligacionesPublico.varAnnual < -5) {
        analisisHTML += `<p>🎯 Las obligaciones con el público presentan una <strong>contracción anual</strong> del ${obligacionesPublico.varAnnual.toFixed(2)}%, lo cual requiere atención en la estrategia de captación.</p>`;
    } else {
        analisisHTML += `<p> Las obligaciones con el público mantienen una <strong>evolución estable</strong> con variación anual del ${obligacionesPublico?.varAnnual.toFixed(2) || 0}%, dentro de parámetros normales.</p>`;
    }
    analisisHTML += `</div>`;
    
    // Insertar el análisis en el contenedor
    document.getElementById('analisis-content-pasivo').innerHTML = analisisHTML;
}

// ✅ FUNCION PRINCIPAL PARA RENDERIZAR PÁGINA 6
async function renderEstructuraPasivoPage() {
    await renderPasivoTable();
    renderBarrasApiladasPasivo();
    renderBarrasCuentasPasivo();
    renderHistoricoEstructuraPasivo();
    generateDynamicAnalysisPasivo();
}

// ==========================================
// PÁGINA 6: FINAL DE LA HOJA 6
// ==========================================

// ==========================================
// PÁGINA 7: 
// ==========================================

// ✅ RENDERIZAR TABLA DE ACTIVO IMPRODUCTIVO (USANDO FUNCIÓN GENÉRICA)
async function renderExigibleTable() {
    if (!currentMagazineData) return;
    
    const targetDate = `${currentYear}-${currentMonth}`;
    const prevMonthDate = getPreviousMonthDate(currentYear, currentMonth);
    const prevYearDate = subtractMonths(currentYear, currentMonth, 12);
    
    // Cuentas a mostrar con sus niveles - ACTIVO IMPRODUCTIVO
    const cuentasExigible = [
        { code: 'SB002', name: 'PASIVOS EXIGIBLES', nivel: 1 },
        { code: '@2101', name: '2101. Depósitos a la vista', nivel: 2 },
        { code: '@210135', name: '210135. Depósitos de ahorro', nivel: 3 },
        { code: '@2102', name: '2102. Operaciones de reporto', nivel: 2 },
        { code: '@2103', name: '2103. Depósitos a plazo', nivel: 2 },
        { code: '@210305', name: '210305. De 1 a 30 días', nivel: 3 },
        { code: '@210310', name: '210310. De 31 a 90 días', nivel: 3 },
        { code: '@210315', name: '210315. De 91 a 180 días', nivel: 3 },
        { code: '@210320', name: '210320. De 181 a 360 días', nivel: 3 },
        { code: '@210325', name: '210325. De más de 361 días', nivel: 3 },
        { code: '@210330', name: '210330. Depósitos por confirmar', nivel: 3 },
        { code: '@2105', name: '2105. Depósitos restringidos', nivel: 2 },
        { code: '@2201', name: '2201. Fondos interbancarios comprados', nivel: 2 },
        { code: '@23', name: '23. OBLIGACIONES INMEDIATAS', nivel: 1 },
        { code: '@24', name: '24. ACEPTACIONES EN CIRCULACIÓN', nivel: 1 },
        { code: '@26', name: '26. OBLIGACIONES FINANCIERAS', nivel: 1 },
        { code: '@27', name: '27. VALORES EN CIRCULACIÓN', nivel: 1 },
        { code: '@2903', name: '2903. Fondos en administración', nivel: 2 }
    ];
    
    // ✅ USAR FUNCIÓN GENÉRICA con IDs de Hoja 4
    await renderTablaEstructuraGenerico(
        'exigibleTableBody',  // ID de la tabla de Hoja 4
        { 
            mes1: 'th-mes1-exigible', 
            mes2: 'th-mes2-exigible', 
            mes3: 'th-mes3-exigible' 
        },
        cuentasExigible,
        targetDate,
        prevMonthDate,
        prevYearDate
    );
    
    // ✅ Actualizar KPIs usando función genérica
    updateKPIGenerico('SB002', 'kpi-sb002', targetDate, prevYearDate);
    updateKPIGenerico('@210305', 'kpi-210305', targetDate, prevYearDate);
    updateKPIGenerico('@210325', 'kpi-210325', targetDate, prevYearDate);
}

// ✅ GRÁFICO DE BARRAS - ACTIVOS IMPRODUCTIVOS NETOS (SB004) - USANDO FUNCIÓN GENÉRICA
function renderBarrasApiladasExigible() {
    const targetDate = `${currentYear}-${currentMonth}`;
    const prevMonthDate = getPreviousMonthDate(currentYear, currentMonth);
    const prevYearDate = subtractMonths(currentYear, currentMonth, 12);
    
    // ✅ USAR FUNCIÓN GENÉRICA con ID de Hoja 4
    renderBarrasApiladasGenerico(
        'chartBarrasApiladasExigible',  // ID del gráfico de Hoja 4
        'Pasivos Exigibles', 
        'SB002', 
        targetDate, 
        prevMonthDate, 
        prevYearDate
    );
}

// ✅ GRÁFICO DE BARRAS POR CUENTAS IMPRODUCTIVAS - USANDO FUNCIÓN GENÉRICA
function renderBarrasCuentasExigible() {
    const targetDate = `${currentYear}-${currentMonth}`;
    const prevMonthDate = getPreviousMonthDate(currentYear, currentMonth);
    const prevYearDate = subtractMonths(currentYear, currentMonth, 12);
    
    const cuentas = [
        { code: '@210305', name: '210305' },
        { code: '@210310', name: '210310' },
        { code: '@210315', name: '210315' },
        { code: '@210320', name: '210320' },
        { code: '@210325', name: '210325' }
    ];
    
    // ✅ USAR FUNCIÓN GENÉRICA con ID de Hoja 4
    renderBarrasCuentasGenerico(
        'chartBarrasCuentasExigible',  // ID del gráfico de Hoja 4
        cuentas,
        targetDate,
        prevMonthDate,
        prevYearDate
    );
}

// ✅ GRÁFICO HISTÓRICO IMPRODUCTIVOS - USANDO FUNCIÓN GENÉRICA
function renderHistoricoEstructuraExigible() {
    const seriesConfig = [
        { code: '@2103', name: 'Depósitos a plazo (total)', color: '#3b82f6', type: 'line' },
        { code: '@210305', name: '1-30 días', color: '#10b981', type: 'bar'  },
        { code: '@210310', name: '31-90 días', color: '#f59e0b' , type: 'bar' },
        { code: '@210315', name: '91-180 días', color: '#20666B' , type: 'bar' },
        { code: '@210320', name: '181-360 días', color: '#0B132B' , type: 'bar' },
        { code: '@210325', name: 'Más de 361 días', color: '#D9A05B' , type: 'bar' },

    ];
    
    // ✅ USAR FUNCIÓN GENÉRICA con ID de Hoja 4
    renderHistoricoEstructuraGenerico(
        'chartHistoricoEstructuraExigible',  // ID del gráfico de Hoja 4
        seriesConfig,
        'Evolución Histórica - Depósitos a plazo'
    );
}

// ✅ GENERAR ANÁLISIS DINÁMICO - ACTIVO IMPRODUCTIVO (SE MANTIENE IGUAL)
function generateDynamicAnalysisExigible() {
    if (!currentMagazineData) return;
    
    const targetDate = `${currentYear}-${currentMonth}`;
    const prevMonthDate = getPreviousMonthDate(currentYear, currentMonth);
    const prevYearDate = subtractMonths(currentYear, currentMonth, 12);
    
    // Actualizar fecha en el header
    document.getElementById('analisis-fecha-exigible').textContent = formatHeaderDate(targetDate);
    
    // Obtener datos de las cuentas principales
    const cuentas = [
        { code: 'SB002', name: 'Pasivos Exigibles' },
        { code: '@2101', name: 'Depósitos a la vista' },
        { code: '@2103', name: 'Depósitos a plazo' },
        { code: '@210305', name: 'Depósitos 1-30 días' },
        { code: '@210325', name: 'Depósitos más de 361 días' }
    ];
    
    const datos = cuentas.map(c => {
        const row = currentMagazineData.find(r => r.CUC === c.code);
        if (!row) return null;
        
        const valCurrent = parseFloat(row[targetDate]) || 0;
        const valPrevMonth = parseFloat(row[prevMonthDate]) || 0;
        const valPrevYear = parseFloat(row[prevYearDate]) || 0;
        
        const varMonthly = valPrevMonth !== 0 ? ((valCurrent - valPrevMonth) / Math.abs(valPrevMonth)) * 100 : 0;
        const varAnnual = valPrevYear !== 0 ? ((valCurrent - valPrevYear) / Math.abs(valPrevYear)) * 100 : 0;
        
        return {
            ...c,
            valCurrent,
            valPrevMonth,
            valPrevYear,
            varMonthly,
            varAnnual
        };
    }).filter(d => d !== null);
    
    const pasivosExigibles = datos.find(d => d.code === 'SB002');
    const depositosVista = datos.find(d => d.code === '@2101');
    const depositosPlazo = datos.find(d => d.code === '@2103');
    const depositosCorto = datos.find(d => d.code === '@210305');
    const depositosLargo = datos.find(d => d.code === '@210325');
    
    // Análisis general
    let analisisHTML = '';
    
    // 1. Resumen general
    analisisHTML += `<div class="analisis-seccion">`;
    analisisHTML += `<h5><i class="fas fa-chart-bar"></i> Resumen General</h5>`;
    
    if (pasivosExigibles) {
        const tendencia = pasivosExigibles.varMonthly > 0 ? 'crecimiento' : pasivosExigibles.varMonthly < 0 ? 'decrecimiento' : 'estabilidad';
        const icono = pasivosExigibles.varMonthly > 0 ? '📈' : pasivosExigibles.varMonthly < 0 ? '📉' : '➡️';
        
        analisisHTML += `<p>${icono} Los <strong>Pasivos Exigibles</strong> registran ${formatNumber(pasivosExigibles.valCurrent)} millones USD, con una variación mensual de <span class="${pasivosExigibles.varMonthly > 0 ? 'highlight-positive' : pasivosExigibles.varMonthly < 0 ? 'highlight-negative' : ''}">${pasivosExigibles.varMonthly.toFixed(2)}%</span> y anual de <span class="${pasivosExigibles.varAnnual > 0 ? 'highlight-positive' : pasivosExigibles.varAnnual < 0 ? 'highlight-negative' : ''}">${pasivosExigibles.varAnnual.toFixed(2)}%</span>.</p>`;
        analisisHTML += `<p>La tendencia del período es de <strong>${tendencia}</strong> en la captación de recursos exigibles.</p>`;
    }
    
    analisisHTML += `</div>`;
    
    // 2. Análisis por componente
    analisisHTML += `<div class="analisis-seccion">`;
    analisisHTML += `<h5><i class="fas fa-pie-chart"></i> Composición de Depósitos</h5>`;
    analisisHTML += `<ul>`;
    
    if (depositosVista && depositosVista.valCurrent > 0) {
        const porcentaje = pasivosExigibles ? (depositosVista.valCurrent / pasivosExigibles.valCurrent) * 100 : 0;
        analisisHTML += `<li><strong>Depósitos a la vista:</strong> ${formatNumber(depositosVista.valCurrent)} millones (${porcentaje.toFixed(1)}% del total) - Variación mensual: <span class="${depositosVista.varMonthly > 0 ? 'highlight-positive' : depositosVista.varMonthly < 0 ? 'highlight-negative' : ''}">${depositosVista.varMonthly.toFixed(2)}%</span></li>`;
    }
    
    if (depositosPlazo && depositosPlazo.valCurrent > 0) {
        const porcentaje = pasivosExigibles ? (depositosPlazo.valCurrent / pasivosExigibles.valCurrent) * 100 : 0;
        analisisHTML += `<li><strong>Depósitos a plazo:</strong> ${formatNumber(depositosPlazo.valCurrent)} millones (${porcentaje.toFixed(1)}% del total) - Variación mensual: <span class="${depositosPlazo.varMonthly > 0 ? 'highlight-positive' : depositosPlazo.varMonthly < 0 ? 'highlight-negative' : ''}">${depositosPlazo.varMonthly.toFixed(2)}%</span></li>`;
    }
    
    analisisHTML += `</ul>`;
    analisisHTML += `</div>`;
    
    // 3. Hallazgos destacados
    analisisHTML += `<div class="analisis-seccion">`;
    analisisHTML += `<h5><i class="fas fa-lightbulb"></i> Hallazgos Destacados</h5>`;
    
    if (depositosCorto && depositosCorto.valCurrent > 0 && depositosLargo && depositosLargo.valCurrent > 0) {
        const ratioCortoLargo = depositosCorto.valCurrent / depositosLargo.valCurrent;
        
        if (ratioCortoLargo > 2) {
            analisisHTML += `<p>📊 Los <strong>depósitos a corto plazo (1-30 días)</strong> representan más del doble que los de largo plazo, indicando alta liquidez pero mayor volatilidad en la captación.</p>`;
        } else if (ratioCortoLargo < 0.5) {
            analisisHTML += `<p>📊 Los <strong>depósitos a largo plazo (más de 361 días)</strong> predominan sobre los de corto plazo, indicando mayor estabilidad en la base de captación.</p>`;
        }
    }
    
    analisisHTML += `</div>`;
    
    // 4. Perspectiva
    analisisHTML += `<div class="analisis-seccion">`;
    analisisHTML += `<h5><i class="fas fa-binoculars"></i> Perspectiva</h5>`;
    
    if (pasivosExigibles && pasivosExigibles.varAnnual > 10) {
        analisisHTML += `<p> Los pasivos exigibles muestran un <strong>crecimiento anual sólido</strong> del ${pasivosExigibles.varAnnual.toFixed(2)}%, reflejando expansión en la captación de recursos.</p>`;
    } else if (pasivosExigibles && pasivosExigibles.varAnnual < -5) {
        analisisHTML += `<p>🎯 Los pasivos exigibles presentan una <strong>contracción anual</strong> del ${pasivosExigibles.varAnnual.toFixed(2)}%, lo cual requiere atención en la estrategia de captación.</p>`;
    } else {
        analisisHTML += `<p> Los pasivos exigibles mantienen una <strong>evolución estable</strong> con variación anual del ${pasivosExigibles?.varAnnual.toFixed(2) || 0}%, dentro de parámetros normales.</p>`;
    }
    
    analisisHTML += `</div>`;
    
    // Insertar el análisis en el contenedor
    document.getElementById('analisis-content-exigible').innerHTML = analisisHTML;
}

// ✅ FUNCION PRINCIPAL PARA RENDERIZAR PÁGINA 7
async function renderEstructuraExigiblePage() {
    await renderExigibleTable();
    renderBarrasApiladasExigible();
    renderBarrasCuentasExigible();
    renderHistoricoEstructuraExigible();
    generateDynamicAnalysisExigible();
}

// ==========================================
// PÁGINA 7: FINAL DE LA HOJA 7
// ==========================================


// ==========================================
// PÁGINA 8: 
// ==========================================

// ✅ RENDERIZAR TABLA DE ACTIVO IMPRODUCTIVO (USANDO FUNCIÓN GENÉRICA)
async function renderTablaCosto() {
    if (!currentMagazineData) return;
    
    const targetDate = `${currentYear}-${currentMonth}`;
    const prevMonthDate = getPreviousMonthDate(currentYear, currentMonth);
    const prevYearDate = subtractMonths(currentYear, currentMonth, 12);
    
    // Cuentas a mostrar con sus niveles - ACTIVO IMPRODUCTIVO
    const cuentasCosto = [
        { code: 'SB007', name: 'PASIVOS CON COSTO', nivel: 1 },
        { code: '@2101', name: '2101. Depósitos a la vista', nivel: 2 },
        { code: '@210110', name: '210110. Depósitos monetarios que no generan INTERESES', nivel: 3 },
        { code: '@210130', name: '210130. Cheques certificados', nivel: 3 },
        { code: '@210150', name: '210150. Depósitos por confirmar', nivel: 3 },
        { code: '@2102', name: '2102. Operaciones de reporto', nivel: 2 },
        { code: '@210210', name: '210210. Operaciones de reporto por confirmar', nivel: 3 },
        { code: '@2103', name: '2103. Depósitos a plazo', nivel: 2 },
        { code: '@210330', name: '210330. Depósitos por confirmar', nivel: 3 },
        { code: '@2104', name: '2104. Depósitos de garantía', nivel: 2 },
        { code: '@2105', name: '2105. Depósitos restringidos', nivel: 2 },
        { code: '@22', name: '22. OPERACIONES INTERBANCARIAS', nivel: 1 },
        { code: '@2203', name: '2203. Operaciones por confirmar', nivel: 2 },
        { code: '@26', name: '26. OBLIGACIONES FINANCIERAS', nivel: 1 },
        { code: '@27', name: '27. VALORES EN CIRCULACIÓN', nivel: 1 },
        { code: '@2790', name: '2790. Prima o descuento en colocación de valores en circulación', nivel: 2 },
        { code: '@280105', name: '280105. Obligaciones convertibles en acciones', nivel: 2 },
        { code: '@2903', name: '2903. Fondos en administración', nivel: 2 }
    ];
    
    // ✅ USAR FUNCIÓN GENÉRICA con IDs de Hoja 4
    await renderTablaEstructuraGenerico(
        'costoTableBody',  // ID de la tabla de Hoja 4
        { 
            mes1: 'th-mes1-costo', 
            mes2: 'th-mes2-costo', 
            mes3: 'th-mes3-costo' 
        },
        cuentasCosto,
        targetDate,
        prevMonthDate,
        prevYearDate
    );
    
    // ✅ Actualizar KPIs usando función genérica
    updateKPIGenerico('SB007', 'kpi-sb007', targetDate, prevYearDate);
    updateKPIGenerico('@2104', 'kpi-2104', targetDate, prevYearDate);
    updateKPIGenerico('@2105', 'kpi-2105', targetDate, prevYearDate);
}

// ✅ GRÁFICO DE BARRAS - ACTIVOS IMPRODUCTIVOS NETOS (SB004) - USANDO FUNCIÓN GENÉRICA
function renderBarrasApiladasCosto() {
    const targetDate = `${currentYear}-${currentMonth}`;
    const prevMonthDate = getPreviousMonthDate(currentYear, currentMonth);
    const prevYearDate = subtractMonths(currentYear, currentMonth, 12);
    
    // ✅ USAR FUNCIÓN GENÉRICA con ID de Hoja 4
    renderBarrasApiladasGenerico(
        'chartBarrasApiladasCosto',  // ID del gráfico de Hoja 4
        'Pasivos con Costo', 
        'SB007', 
        targetDate, 
        prevMonthDate, 
        prevYearDate
    );
}

// ✅ GRÁFICO DE BARRAS POR CUENTAS IMPRODUCTIVAS - USANDO FUNCIÓN GENÉRICA
function renderBarrasCuentasCosto() {
    const targetDate = `${currentYear}-${currentMonth}`;
    const prevMonthDate = getPreviousMonthDate(currentYear, currentMonth);
    const prevYearDate = subtractMonths(currentYear, currentMonth, 12);
    
    const cuentas = [
        { code: '@22', name: '22' },
        { code: '@26', name: '26' },
        { code: '@27', name: '27' }
    ];
    
    // ✅ USAR FUNCIÓN GENÉRICA con ID de Hoja 4
    renderBarrasCuentasGenerico(
        'chartBarrasCuentasCosto',  // ID del gráfico de Hoja 4
        cuentas,
        targetDate,
        prevMonthDate,
        prevYearDate
    );
}

// ✅ GRÁFICO HISTÓRICO IMPRODUCTIVOS - USANDO FUNCIÓN GENÉRICA
function renderHistoricoEstructuraCosto() {
    const seriesConfig = [
        { code: 'SB007', name: 'Pasivos con Costo', color: '#3b82f6' }
    ];
    
    // ✅ USAR FUNCIÓN GENÉRICA con ID de Hoja 4
    renderHistoricoEstructuraGenerico(
        'chartHistoricoEstructuraCosto',  // ID del gráfico de Hoja 4
        seriesConfig,
        'Evolución Histórica - Depósitos a plazo'
    );
}

// ✅ GENERAR ANÁLISIS DINÁMICO - ACTIVO IMPRODUCTIVO (SE MANTIENE IGUAL)
// ✅ GENERAR ANÁLISIS DINÁMICO - PASIVOS CON COSTO
function generateDynamicAnalysisCosto() {
    if (!currentMagazineData) return;
    
    const targetDate = `${currentYear}-${currentMonth}`;
    const prevMonthDate = getPreviousMonthDate(currentYear, currentMonth);
    const prevYearDate = subtractMonths(currentYear, currentMonth, 12);
    
    // Actualizar fecha en el header
    document.getElementById('analisis-fecha-costo').textContent = formatHeaderDate(targetDate);
    
    // Obtener datos de las cuentas principales
    const cuentas = [
        { code: 'SB007', name: 'Pasivos con Costo' },
        { code: '@2101', name: 'Depósitos a la vista' },
        { code: '@2103', name: 'Depósitos a plazo' },
        { code: '@2104', name: 'Depósitos de garantía' },
        { code: '@2105', name: 'Depósitos restringidos' },
        { code: '@22', name: 'Operaciones Interbancarias' },
        { code: '@26', name: 'Obligaciones Financieras' },
        { code: '@27', name: 'Valores en Circulación' }
    ];
    
    const datos = cuentas.map(c => {
        const row = currentMagazineData.find(r => r.CUC === c.code);
        if (!row) return null;
        
        const valCurrent = parseFloat(row[targetDate]) || 0;
        const valPrevMonth = parseFloat(row[prevMonthDate]) || 0;
        const valPrevYear = parseFloat(row[prevYearDate]) || 0;
        
        const varMonthly = valPrevMonth !== 0 ? ((valCurrent - valPrevMonth) / Math.abs(valPrevMonth)) * 100 : 0;
        const varAnnual = valPrevYear !== 0 ? ((valCurrent - valPrevYear) / Math.abs(valPrevYear)) * 100 : 0;
        
        return {
            ...c,
            valCurrent,
            valPrevMonth,
            valPrevYear,
            varMonthly,
            varAnnual
        };
    }).filter(d => d !== null);
    
    const pasivosCosto = datos.find(d => d.code === 'SB007');
    const depositosVista = datos.find(d => d.code === '@2101');
    const depositosPlazo = datos.find(d => d.code === '@2103');
    const depositosGarantia = datos.find(d => d.code === '@2104');
    const depositosRestringidos = datos.find(d => d.code === '@2105');
    
    // Análisis general
    let analisisHTML = '';
    
    // 1. Resumen general
    analisisHTML += `<div class="analisis-seccion">`;
    analisisHTML += `<h5><i class="fas fa-chart-bar"></i> Resumen General</h5>`;
    
    if (pasivosCosto) {
        const tendencia = pasivosCosto.varMonthly > 0 ? 'crecimiento' : pasivosCosto.varMonthly < 0 ? 'decrecimiento' : 'estabilidad';
        const icono = pasivosCosto.varMonthly > 0 ? '📈' : pasivosCosto.varMonthly < 0 ? '📉' : '➡️';
        
        analisisHTML += `<p>${icono} Los <strong>Pasivos con Costo</strong> registran ${formatNumber(pasivosCosto.valCurrent)} millones USD, con una variación mensual de <span class="${pasivosCosto.varMonthly > 0 ? 'highlight-positive' : pasivosCosto.varMonthly < 0 ? 'highlight-negative' : ''}">${pasivosCosto.varMonthly.toFixed(2)}%</span> y anual de <span class="${pasivosCosto.varAnnual > 0 ? 'highlight-positive' : pasivosCosto.varAnnual < 0 ? 'highlight-negative' : ''}">${pasivosCosto.varAnnual.toFixed(2)}%</span>.</p>`;
        analisisHTML += `<p>La tendencia del período es de <strong>${tendencia}</strong> en la captación de recursos con costo.</p>`;
    }
    
    analisisHTML += `</div>`;
    
    // 2. Análisis por componente
    analisisHTML += `<div class="analisis-seccion">`;
    analisisHTML += `<h5><i class="fas fa-pie-chart"></i> Composición de Pasivos con Costo</h5>`;
    analisisHTML += `<ul>`;
    
    if (depositosVista && depositosVista.valCurrent > 0) {
        const porcentaje = pasivosCosto ? (depositosVista.valCurrent / pasivosCosto.valCurrent) * 100 : 0;
        analisisHTML += `<li><strong>Depósitos a la vista:</strong> ${formatNumber(depositosVista.valCurrent)} millones (${porcentaje.toFixed(1)}% del total) - Variación mensual: <span class="${depositosVista.varMonthly > 0 ? 'highlight-positive' : depositosVista.varMonthly < 0 ? 'highlight-negative' : ''}">${depositosVista.varMonthly.toFixed(2)}%</span></li>`;
    }
    
    if (depositosPlazo && depositosPlazo.valCurrent > 0) {
        const porcentaje = pasivosCosto ? (depositosPlazo.valCurrent / pasivosCosto.valCurrent) * 100 : 0;
        analisisHTML += `<li><strong>Depósitos a plazo:</strong> ${formatNumber(depositosPlazo.valCurrent)} millones (${porcentaje.toFixed(1)}% del total) - Variación mensual: <span class="${depositosPlazo.varMonthly > 0 ? 'highlight-positive' : depositosPlazo.varMonthly < 0 ? 'highlight-negative' : ''}">${depositosPlazo.varMonthly.toFixed(2)}%</span></li>`;
    }
    
    if (depositosGarantia && depositosGarantia.valCurrent > 0) {
        const porcentaje = pasivosCosto ? (depositosGarantia.valCurrent / pasivosCosto.valCurrent) * 100 : 0;
        analisisHTML += `<li><strong>Depósitos de garantía:</strong> ${formatNumber(depositosGarantia.valCurrent)} millones (${porcentaje.toFixed(1)}% del total) - Variación mensual: <span class="${depositosGarantia.varMonthly > 0 ? 'highlight-positive' : depositosGarantia.varMonthly < 0 ? 'highlight-negative' : ''}">${depositosGarantia.varMonthly.toFixed(2)}%</span></li>`;
    }
    
    if (depositosRestringidos && depositosRestringidos.valCurrent > 0) {
        const porcentaje = pasivosCosto ? (depositosRestringidos.valCurrent / pasivosCosto.valCurrent) * 100 : 0;
        analisisHTML += `<li><strong>Depósitos restringidos:</strong> ${formatNumber(depositosRestringidos.valCurrent)} millones (${porcentaje.toFixed(1)}% del total) - Variación mensual: <span class="${depositosRestringidos.varMonthly > 0 ? 'highlight-positive' : depositosRestringidos.varMonthly < 0 ? 'highlight-negative' : ''}">${depositosRestringidos.varMonthly.toFixed(2)}%</span></li>`;
    }
    
    analisisHTML += `</ul>`;
    analisisHTML += `</div>`;
    
    // 3. Hallazgos destacados
    analisisHTML += `<div class="analisis-seccion">`;
    analisisHTML += `<h5><i class="fas fa-lightbulb"></i> Hallazgos Destacados</h5>`;
    
    const cuentasConVariacion = datos.filter(d => d.code !== 'SB007' && d.valCurrent > 0);
    if (cuentasConVariacion.length > 0) {
        const mayorCrecimiento = cuentasConVariacion.reduce((max, d) => d.varMonthly > max.varMonthly ? d : max);
        const mayorDecrecimiento = cuentasConVariacion.reduce((min, d) => d.varMonthly < min.varMonthly ? d : min);
        
        if (mayorCrecimiento.varMonthly > 0) {
            analisisHTML += `<p>✅ <strong>${mayorCrecimiento.name}</strong> presenta el mayor crecimiento mensual con <span class="highlight-positive">+${mayorCrecimiento.varMonthly.toFixed(2)}%</span>.</p>`;
        }
        
        if (mayorDecrecimiento.varMonthly < 0) {
            analisisHTML += `<p>⚠️ <strong>${mayorDecrecimiento.name}</strong> registra el mayor decrecimiento mensual con <span class="highlight-negative">${mayorDecrecimiento.varMonthly.toFixed(2)}%</span>.</p>`;
        }
    }
    
    analisisHTML += `</div>`;
    
    // 4. Perspectiva
    analisisHTML += `<div class="analisis-seccion">`;
    analisisHTML += `<h5><i class="fas fa-binoculars"></i> Perspectiva</h5>`;
    
    if (pasivosCosto && pasivosCosto.varAnnual > 10) {
        analisisHTML += `<p> Los pasivos con costo muestran un <strong>crecimiento anual sólido</strong> del ${pasivosCosto.varAnnual.toFixed(2)}%, reflejando expansión en la captación de recursos.</p>`;
    } else if (pasivosCosto && pasivosCosto.varAnnual < -5) {
        analisisHTML += `<p>🎯 Los pasivos con costo presentan una <strong>contracción anual</strong> del ${pasivosCosto.varAnnual.toFixed(2)}%, lo cual requiere atención en la estrategia de captación.</p>`;
    } else {
        analisisHTML += `<p> Los pasivos con costo mantienen una <strong>evolución estable</strong> con variación anual del ${pasivosCosto?.varAnnual.toFixed(2) || 0}%, dentro de parámetros normales.</p>`;
    }
    
    analisisHTML += `</div>`;
    
    // Insertar el análisis en el contenedor
    document.getElementById('analisis-content-costo').innerHTML = analisisHTML;
}

// ✅ FUNCION PRINCIPAL PARA RENDERIZAR PÁGINA 8
async function renderEstructuraCostoPage() {
    await renderTablaCosto();
    renderBarrasApiladasCosto();
    renderBarrasCuentasCosto();
    renderHistoricoEstructuraCosto();
    generateDynamicAnalysisCosto();
}


// ==========================================
// PÁGINA 10: ESTADO DE PÉRDIDAS Y GANANCIAS
// ==========================================

// ✅ RENDERIZAR TABLA DE ACTIVO IMPRODUCTIVO (USANDO FUNCIÓN GENÉRICA)
async function renderTablaPYG() {
    if (!currentMagazineData) return;
    
    const targetDate = `${currentYear}-${currentMonth}`;
    const prevMonthDate = getPreviousMonthDate(currentYear, currentMonth);
    const prevYearDate = subtractMonths(currentYear, currentMonth, 12);
    
    // Cuentas a mostrar con sus niveles - ACTIVO IMPRODUCTIVO
    const pygStructure = [
        { code: '@5', name: '5. INGRESOS', nivel: 1 },
        { code: '@51', name: '51. INTERESES Y DESCUENTOS GANADOS', nivel: 3 },
        { code: '@41', name: '41. INTERESES CAUSADOS', nivel: 3 },
        { code: 'Marg_Ne', name: 'MARGEN NETO INTERESES', nivel: 2 },
        { code: '@52', name: '52. COMISIONES GANADAS', nivel: 3 },
        { code: '@54', name: '54. INGRESOS POR SERVICIOS', nivel: 3 },
        { code: '@42', name: '42. COMISIONES CAUSADAS', nivel: 3 },
        { code: '@53', name: '53. UTILIDADES FINANCIERAS', nivel: 3 },
        { code: '@43', name: '43. PÉRDIDAS FINANCIERAS', nivel: 3 },
        { code: 'Mar_Br_Fi', name: 'MARGEN BRUTO FINANCIERO', nivel: 2 },
        { code: '@44', name: '44. PROVISIONES', nivel: 2 },
        { code: 'Mar_Ne_Fina', name: 'MARGEN NETO FINANCIERO', nivel: 1 },
        { code: '@45', name: '45. GASTOS DE OPERACIÓN', nivel: 2 },
        { code: 'Mar_Inte', name: 'MARGEN DE INTERMEDIACIÓN', nivel: 1 },
        { code: '@55', name: '55. OTROS INGRESOS OPERACIONALES', nivel: 1 },
        { code: '@46', name: '46. OTRAS PÉRDIDAS OPERACIONALES', nivel: 2 },
        { code: '@56', name: '56. OTROS INGRESOS', nivel: 2 },
        { code: '@47', name: '47. OTROS GASTOS Y PÉRDIDAS', nivel: 2 },
        { code: 'Gan_Pe_Imp', name: 'GANANCIA O (PÉRDIDA) ANTES DE IMPUESTOS', nivel: 2 },
        { code: '@48', name: '48. IMPUESTOS Y PARTICIPACIÓN A EMPLEADOS', nivel: 2 },
        { code: 'Gan_Eje', name: 'GANANCIA O (PÉRDIDA) DEL EJERCICIO', nivel: 2 }
    ];
    
    // ✅ USAR FUNCIÓN GENÉRICA con IDs de Hoja 4
    await renderTablaEstructuraGenerico(
        'pygTableBody',  // ID de la tabla de Hoja 4
        { 
            mes1: 'th-mes1-pyg', 
            mes2: 'th-mes2-pyg', 
            mes3: 'th-mes3-pyg' 
        },
        pygStructure,
        targetDate,
        prevMonthDate,
        prevYearDate
    );
    
    // ✅ Actualizar KPIs usando función genérica
    updateKPIGenerico('@5', 'kpi-ingresos', targetDate, prevYearDate);
    updateKPIGenerico('@4', 'kpi-gastos', targetDate, prevYearDate);
    updateKPIGenerico('Gan_Eje', 'kpi-ganeje', targetDate, prevYearDate);
}

// ✅ GRÁFICO DE BARRAS - ACTIVOS IMPRODUCTIVOS NETOS (SB004) - USANDO FUNCIÓN GENÉRICA
function renderComparativoPyGChart() {
    if (!currentMagazineData) return;
    
    const targetDate = `${currentYear}-${currentMonth}`;
    const prevYearDate = subtractMonths(currentYear, currentMonth, 12);
    const selYear = parseInt(currentYear);
    
    const allDates = Object.keys(currentMagazineData[0]).filter(k => /^\d{4}-\d{2}$/.test(k)).sort();
    const currentYearMonths = allDates.filter(d => d.startsWith(`${selYear}-`));
    const previousYearMonths = allDates.filter(d => d.startsWith(`${selYear - 1}-`));
    const xAxisLabels = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

    const getMonthlyData = (code, monthsArray) => {
        const row = currentMagazineData.find(r => r.Variable === code || r.CUC === code);
        if (!row) return new Array(12).fill(0);
        return monthsArray.map(dateStr => parseFloat(row[dateStr]) || 0);
    };

    const chartDom = document.getElementById('chartComparativoPyG');
    if (!chartDom) return;
    
    let chart = echarts.getInstanceByDom(chartDom);
    if (!chart) chart = echarts.init(chartDom);

    const option = {
        tooltip: {
            trigger: 'axis',
            axisPointer: { type: 'shadow' },
            formatter: (params) => {
                let res = `<div style="font-weight:bold; margin-bottom:5px;">${params[0].name}</div>`;
                params.forEach(p => {
                    res += `<div style="display:flex; align-items:center; gap:8px;">
                        <span style="width:10px; height:10px; background:${p.color}; border-radius:2px;"></span>
                        ${p.seriesName}: <strong>${formatNumber(p.value)}</strong>
                    </div>`;
                });
                return res;
            }
        },
        legend: { data: ['Año Actual', 'Año Anterior'], bottom: 0, textStyle: { fontSize: 10 } },
        grid: { left: '12%', right: '5%', bottom: '15%', top: '10%', containLabel: true },
        xAxis: { 
            type: 'category', 
            data: xAxisLabels, 
            axisLine: { lineStyle: { color: '#cbd5e1' } },
            axisLabel: { fontSize: 9, color: '#64748b' }
        },
        yAxis: { 
            type: 'value', 
            name: 'millones USD', 
            axisLabel: { formatter: (value) => formatNumber(value), fontSize: 9, color: '#64748b' }, 
            splitLine: { lineStyle: { type: 'dashed', color: '#f1f5f9' } } 
        },
        series: [
            {
                name: 'Año Actual',
                type: 'bar',
                data: getMonthlyData('Gan_Eje', currentYearMonths),
                itemStyle: { color: '#2563eb', borderRadius: [4, 4, 0, 0] },
                label: { show: showChartLabels, position: 'top', formatter: (p) => formatNumber(p.value), fontSize: 9, fontWeight: 'bold', color: '#2563eb' }
            },
            {
                name: 'Año Anterior',
                type: 'bar',
                data: getMonthlyData('Gan_Eje', previousYearMonths),
                itemStyle: { color: '#94a3b8', borderRadius: [4, 4, 0, 0] },
                label: { show: showChartLabels, position: 'top', formatter: (p) => formatNumber(p.value), fontSize: 9, fontWeight: 'bold', color: '#94a3b8' }
            }
        ]
    };
    chart.setOption(option, true);
}

// ✅ GRÁFICO HISTÓRICO IMPRODUCTIVOS - USANDO FUNCIÓN GENÉRICA
function renderHistoricoEstructuraPYG() {
    const seriesConfig = [
        { code: 'Marg_Ne', name: 'MARGEN NETO INTERESES', color: '#3b82f6', type: 'bar', yAxisIndex: 0 },
        { code: 'Mar_Br_Fi', name: 'MARGEN BRUTO FINANCIERO', color: '#10b981', type: 'bar' , yAxisIndex: 0 },
        { code: 'Mar_Ne_Fina', name: 'MARGEN NETO FINANCIERO', color: '#f59e0b' , type: 'bar', yAxisIndex: 0 },
        { code: 'Mar_Inte', name: 'MARGEN DE INTERMEDIACIÓN', color: '#20666B' , type: 'bar', yAxisIndex: 0 },
        { code: 'Mar_Oper', name: 'MARGEN OPERACIONAL', color: '#0B132B' , type: 'bar' , yAxisIndex: 0},
        { code: 'Gan_Pe_Imp', name: 'GANANCIA O (PÉRDIDA) ANTES DE IMPUESTOS', color: '#D9A05B' , type: 'bar', yAxisIndex: 0 },
        { code: 'Gan_Eje', name: 'GANANCIA O (PÉRDIDA) DEL EJERCICIO', color: '#c4b8e6' , type: 'line' , yAxisIndex: 1}
    ];
    
    // ✅ USAR FUNCIÓN GENÉRICA con ID de Hoja 4
    renderHistoricoEstructuraGenerico(
        'chartHistoricoEstructuraPYG',  // ID del gráfico de Hoja 4
        seriesConfig,
        'Evolución Histórica - Componentes PYG',
        'millones USD',
        'millones USD'
    );
}


function generateDynamicAnalysisPyG() {
    if (!currentMagazineData) return;
    
    const targetDate = `${currentYear}-${currentMonth}`;
    const prevMonthDate = getPreviousMonthDate(currentYear, currentMonth);
    const prevYearDate = subtractMonths(currentYear, currentMonth, 12);
    
    document.getElementById('analisis-fecha-pyg').textContent = formatHeaderDate(targetDate);
    
    const cuentas = [
        { code: '@5', name: 'Ingresos Totales' },
        { code: '@4', name: 'Gastos Totales' },
        { code: 'Gan_Eje', name: 'Ganancia del Ejercicio' },
        { code: 'Mar_Inte', name: 'Margen de Intermediación' }
    ];
    
    const datos = cuentas.map(c => {
        const row = currentMagazineData.find(r => r.CUC === c.code || r.Variable === c.code);
        if (!row) return null;
        
        const valCurrent = parseFloat(row[targetDate]) || 0;
        const valPrevMonth = parseFloat(row[prevMonthDate]) || 0;
        const valPrevYear = parseFloat(row[prevYearDate]) || 0;
        
        const varMonthly = valPrevMonth !== 0 ? ((valCurrent - valPrevMonth) / Math.abs(valPrevMonth)) * 100 : 0;
        const varAnnual = valPrevYear !== 0 ? ((valCurrent - valPrevYear) / Math.abs(valPrevYear)) * 100 : 0;
        
        return { ...c, valCurrent, valPrevMonth, valPrevYear, varMonthly, varAnnual };
    }).filter(d => d !== null);
    
    const ingresos = datos.find(d => d.code === '@5');
    const gastos = datos.find(d => d.code === '@4');
    const ganancia = datos.find(d => d.code === 'Gan_Eje');
    
    let analisisHTML = '';
    
    analisisHTML += `<div class="analisis-seccion"><h5><i class="fas fa-chart-bar"></i> Resumen General</h5>`;
    if (ingresos) {
        const tendencia = ingresos.varMonthly > 0 ? 'crecimiento' : ingresos.varMonthly < 0 ? 'decrecimiento' : 'estabilidad';
        const icono = ingresos.varMonthly > 0 ? '📈' : ingresos.varMonthly < 0 ? '📉' : '➡️';
        analisisHTML += `<p>${icono} Los <strong>Ingresos</strong> registran ${formatNumber(ingresos.valCurrent)} millones USD, con variación mensual de <span class="${ingresos.varMonthly > 0 ? 'highlight-positive' : ingresos.varMonthly < 0 ? 'highlight-negative' : ''}">${ingresos.varMonthly.toFixed(2)}%</span>.</p>`;
    }
    if (ganancia) {
        analisisHTML += `<p>La <strong>Ganancia del Ejercicio</strong> es de ${formatNumber(ganancia.valCurrent)} millones USD con variación anual de <span class="${ganancia.varAnnual > 0 ? 'highlight-positive' : ganancia.varAnnual < 0 ? 'highlight-negative' : ''}">${ganancia.varAnnual.toFixed(2)}%</span>.</p>`;
    }
    analisisHTML += `</div>`;
    
    document.getElementById('analisis-content-pyg').innerHTML = analisisHTML;
}

// ✅ FUNCION PRINCIPAL PARA RENDERIZAR PÁGINA 8
async function renderEstructuraPYG() {
    await renderTablaPYG();
    renderComparativoPyGChart();
    renderHistoricoEstructuraPYG();
    generateDynamicAnalysisPyG();
}



// ==========================================
// PÁGINA 11: ESTADO DE PÉRDIDAS Y GANANCIAS ANUALIZADO
// ==========================================


// ✅ RENDERIZAR TABLA DE ACTIVO IMPRODUCTIVO (USANDO FUNCIÓN GENÉRICA)
async function renderTablaPYGANUAL() {
    if (!currentMagazineData) return;
    
    const targetDate = `${currentYear}-${currentMonth}`;
    const prevMonthDate = getPreviousMonthDate(currentYear, currentMonth);
    const prevYearDate = subtractMonths(currentYear, currentMonth, 12);
    
    // Cuentas a mostrar con sus niveles - ACTIVO IMPRODUCTIVO
    const pygStructure = [
        { code: '@5A', name: '5. INGRESOS', nivel: 1 },
        { code: '@51A', name: '51. INTERESES Y DESCUENTOS GANADOS', nivel: 3 },
        { code: '@41A', name: '41. INTERESES CAUSADOS', nivel: 3 },
        { code: 'Marg_Ne_anual', name: 'MARGEN NETO INTERESES', nivel: 2 },
        { code: '@52A', name: '52. COMISIONES GANADAS', nivel: 3 },
        { code: '@54A', name: '54. INGRESOS POR SERVICIOS', nivel: 3 },
        { code: '@42A', name: '42. COMISIONES CAUSADAS', nivel: 3 },
        { code: '@53A', name: '53. UTILIDADES FINANCIERAS', nivel: 3 },
        { code: '@43A', name: '43. PÉRDIDAS FINANCIERAS', nivel: 3 },
        { code: 'Mar_Br_Fi_anual', name: 'MARGEN BRUTO FINANCIERO', nivel: 2 },
        { code: '@44A', name: '44. PROVISIONES', nivel: 2 },
        { code: 'Mar_Ne_Fina_anual', name: 'MARGEN NETO FINANCIERO', nivel: 1 },
        { code: '@45A', name: '45. GASTOS DE OPERACIÓN', nivel: 2 },
        { code: 'Mar_Inte_anual', name: 'MARGEN DE INTERMEDIACIÓN', nivel: 1 },
        { code: '@55A', name: '55. OTROS INGRESOS OPERACIONALES', nivel: 1 },
        { code: '@46A', name: '46. OTRAS PÉRDIDAS OPERACIONALES', nivel: 2 },
        { code: '@56A', name: '56. OTROS INGRESOS', nivel: 2 },
        { code: '@47A', name: '47. OTROS GASTOS Y PÉRDIDAS', nivel: 2 },
        { code: 'Gan_Pe_Imp_anual', name: 'GANANCIA O (PÉRDIDA) ANTES DE IMPUESTOS', nivel: 2 },
        { code: '@48A', name: '48. IMPUESTOS Y PARTICIPACIÓN A EMPLEADOS', nivel: 2 },
        { code: 'Gan_Eje_anual', name: 'GANANCIA O (PÉRDIDA) DEL EJERCICIO', nivel: 2 }
    ];
    
    // ✅ USAR FUNCIÓN GENÉRICA con IDs de Hoja 4
    await renderTablaEstructuraGenerico(
        'pygTableBodyAnual',  // ID de la tabla de Hoja 4
        { 
            mes1: 'th-mes1-pyg-anual', 
            mes2: 'th-mes2-pyg-anual', 
            mes3: 'th-mes3-pyg-anual' 
        },
        pygStructure,
        targetDate,
        prevMonthDate,
        prevYearDate
    );
    
    // ✅ Actualizar KPIs usando función genérica
    updateKPIGenerico('@5A', 'kpi-ingresos-anual', targetDate, prevYearDate);
    updateKPIGenerico('@4A', 'kpi-gastos-anual', targetDate, prevYearDate);
    updateKPIGenerico('Gan_Eje_anual', 'kpi-ganeje-anual', targetDate, prevYearDate);
}

// ✅ GRÁFICO DE BARRAS - ACTIVOS IMPRODUCTIVOS NETOS (SB004) - USANDO FUNCIÓN GENÉRICA
function renderComparativoPyGChartANUAL() {
    if (!currentMagazineData) return;
    
    const targetDate = `${currentYear}-${currentMonth}`;
    const prevYearDate = subtractMonths(currentYear, currentMonth, 12);
    const selYear = parseInt(currentYear);
    
    const allDates = Object.keys(currentMagazineData[0]).filter(k => /^\d{4}-\d{2}$/.test(k)).sort();
    const currentYearMonths = allDates.filter(d => d.startsWith(`${selYear}-`));
    const previousYearMonths = allDates.filter(d => d.startsWith(`${selYear - 1}-`));
    const xAxisLabels = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

    const getMonthlyData = (code, monthsArray) => {
        const row = currentMagazineData.find(r => r.Variable === code || r.CUC === code);
        if (!row) return new Array(12).fill(0);
        return monthsArray.map(dateStr => parseFloat(row[dateStr]) || 0);
    };

    const chartDom = document.getElementById('chartComparativoPyGAnual');
    if (!chartDom) return;
    
    let chart = echarts.getInstanceByDom(chartDom);
    if (!chart) chart = echarts.init(chartDom);

    const option = {
        tooltip: {
            trigger: 'axis',
            axisPointer: { type: 'shadow' },
            formatter: (params) => {
                let res = `<div style="font-weight:bold; margin-bottom:5px;">${params[0].name}</div>`;
                params.forEach(p => {
                    res += `<div style="display:flex; align-items:center; gap:8px;">
                        <span style="width:10px; height:10px; background:${p.color}; border-radius:2px;"></span>
                        ${p.seriesName}: <strong>${formatNumber(p.value)}</strong>
                    </div>`;
                });
                return res;
            }
        },
        legend: { data: ['Año Actual', 'Año Anterior'], bottom: 0, textStyle: { fontSize: 10 } },
        grid: { left: '12%', right: '5%', bottom: '15%', top: '10%', containLabel: true },
        xAxis: { 
            type: 'category', 
            data: xAxisLabels, 
            axisLine: { lineStyle: { color: '#cbd5e1' } },
            axisLabel: { fontSize: 9, color: '#64748b' }
        },
        yAxis: { 
            type: 'value', 
            name: 'millones USD', 
            axisLabel: { formatter: (value) => formatNumber(value), fontSize: 9, color: '#64748b' }, 
            splitLine: { lineStyle: { type: 'dashed', color: '#f1f5f9' } } 
        },
        series: [
            {
                name: 'Año Actual',
                type: 'bar',
                data: getMonthlyData('Gan_Eje_anual', currentYearMonths),
                itemStyle: { color: '#2563eb', borderRadius: [4, 4, 0, 0] },
                label: { show: showChartLabels, position: 'top', formatter: (p) => formatNumber(p.value), fontSize: 9, fontWeight: 'bold', color: '#2563eb' }
            },
            {
                name: 'Año Anterior',
                type: 'bar',
                data: getMonthlyData('Gan_Eje_anual', previousYearMonths),
                itemStyle: { color: '#94a3b8', borderRadius: [4, 4, 0, 0] },
                label: { show: showChartLabels, position: 'top', formatter: (p) => formatNumber(p.value), fontSize: 9, fontWeight: 'bold', color: '#94a3b8' }
            }
        ]
    };
    chart.setOption(option, true);
}

// ✅ GRÁFICO HISTÓRICO IMPRODUCTIVOS - USANDO FUNCIÓN GENÉRICA
function renderHistoricoEstructuraPYGANUAL() {
    const seriesConfig = [
        { code: 'Marg_Ne_anual', name: 'MARGEN NETO INTERESES', color: '#3b82f6', type: 'bar', yAxisIndex: 0 },
        { code: 'Mar_Br_Fi_anual', name: 'MARGEN BRUTO FINANCIERO', color: '#10b981', type: 'bar' , yAxisIndex: 0 },
        { code: 'Mar_Ne_Fina_anual', name: 'MARGEN NETO FINANCIERO', color: '#f59e0b' , type: 'bar', yAxisIndex: 0 },
        { code: 'Mar_Inte_anual', name: 'MARGEN DE INTERMEDIACIÓN', color: '#20666B' , type: 'bar', yAxisIndex: 0 },
        { code: 'Mar_Oper_anual', name: 'MARGEN OPERACIONAL', color: '#0B132B' , type: 'bar' , yAxisIndex: 0},
        { code: 'Gan_Pe_Imp_anual', name: 'GANANCIA O (PÉRDIDA) ANTES DE IMPUESTOS', color: '#D9A05B' , type: 'bar', yAxisIndex: 0 },
        { code: 'Gan_Eje_anual', name: 'GANANCIA O (PÉRDIDA) DEL EJERCICIO', color: '#c4b8e6' , type: 'line' , yAxisIndex: 1}
    ];
    
    // ✅ USAR FUNCIÓN GENÉRICA con ID de Hoja 4
    renderHistoricoEstructuraGenerico(
        'chartHistoricoEstructuraPYGANUAL',  // ID del gráfico de Hoja 4
        seriesConfig,
        'Evolución Histórica - Componentes PYG Anualizado',
        'millones USD',
        'millones USD'
    );
}


function generateDynamicAnalysisPyGANUAL() {
    if (!currentMagazineData) return;
    
    const targetDate = `${currentYear}-${currentMonth}`;
    const prevMonthDate = getPreviousMonthDate(currentYear, currentMonth);
    const prevYearDate = subtractMonths(currentYear, currentMonth, 12);
    
    document.getElementById('analisis-fecha-pygA').textContent = formatHeaderDate(targetDate);
    
    const cuentas = [
        { code: '@5A', name: 'Ingresos Totales' },
        { code: '@4A', name: 'Gastos Totales' },
        { code: 'Gan_Eje_anual', name: 'Ganancia del Ejercicio' },
        { code: 'Mar_Inte_anual', name: 'Margen de Intermediación' }
    ];
    
    const datos = cuentas.map(c => {
        const row = currentMagazineData.find(r => r.CUC === c.code || r.Variable === c.code);
        if (!row) return null;
        
        const valCurrent = parseFloat(row[targetDate]) || 0;
        const valPrevMonth = parseFloat(row[prevMonthDate]) || 0;
        const valPrevYear = parseFloat(row[prevYearDate]) || 0;
        
        const varMonthly = valPrevMonth !== 0 ? ((valCurrent - valPrevMonth) / Math.abs(valPrevMonth)) * 100 : 0;
        const varAnnual = valPrevYear !== 0 ? ((valCurrent - valPrevYear) / Math.abs(valPrevYear)) * 100 : 0;
        
        return { ...c, valCurrent, valPrevMonth, valPrevYear, varMonthly, varAnnual };
    }).filter(d => d !== null);
    
    const ingresos = datos.find(d => d.code === '@5A');
    const gastos = datos.find(d => d.code === '@4A');
    const ganancia = datos.find(d => d.code === 'Gan_Eje_anual');
    
    let analisisHTML = '';
    
    analisisHTML += `<div class="analisis-seccion"><h5><i class="fas fa-chart-bar"></i> Resumen General</h5>`;
    if (ingresos) {
        const tendencia = ingresos.varMonthly > 0 ? 'crecimiento' : ingresos.varMonthly < 0 ? 'decrecimiento' : 'estabilidad';
        const icono = ingresos.varMonthly > 0 ? '📈' : ingresos.varMonthly < 0 ? '📉' : '➡️';
        analisisHTML += `<p>${icono} Los <strong>Ingresos</strong> registran ${formatNumber(ingresos.valCurrent)} millones USD, con variación mensual de <span class="${ingresos.varMonthly > 0 ? 'highlight-positive' : ingresos.varMonthly < 0 ? 'highlight-negative' : ''}">${ingresos.varMonthly.toFixed(2)}%</span>.</p>`;
    }
    if (ganancia) {
        analisisHTML += `<p>La <strong>Ganancia del Ejercicio</strong> es de ${formatNumber(ganancia.valCurrent)} millones USD con variación anual de <span class="${ganancia.varAnnual > 0 ? 'highlight-positive' : ganancia.varAnnual < 0 ? 'highlight-negative' : ''}">${ganancia.varAnnual.toFixed(2)}%</span>.</p>`;
    }
    analisisHTML += `</div>`;
    
    document.getElementById('analisis-content-pygA').innerHTML = analisisHTML;
}

// ✅ FUNCION PRINCIPAL PARA RENDERIZAR PÁGINA 8
async function renderEstructuraPYGANUAL() {
    await renderTablaPYGANUAL();
    renderComparativoPyGChartANUAL();
    renderHistoricoEstructuraPYGANUAL();
    generateDynamicAnalysisPyGANUAL();
}

// ==========================================
// PÁGINA 11: FINAL DE LA HOJA 11
// ==========================================



// ==========================================
// PÁGINA 12: INTERMEDIACIÓN FINANCIERA
// ==========================================

// ✅ GRÁFICO HISTÓRICO IMPRODUCTIVOS - USANDO FUNCIÓN GENÉRICA
function renderHistoricoCartera() {
    const seriesConfig = [
        { code: 'IF011', name: 'Cart. Bruta', color: '#3b82f6', type: 'line'},
        { code: 'IF007', name: 'Cart. Vencer', color: '#10b981', type: 'bar' },
        { code: 'IF010', name: 'Cart. Improductiva', color: '#f59e0b' , type: 'bar'}
        
    ];
    
    // ✅ USAR FUNCIÓN GENÉRICA con ID de Hoja 4
    renderHistoricoEstructuraGenerico(
        'chartHistoricoCartera',  // ID del gráfico de Hoja 4
        seriesConfig,
        'Evolución Histórica - Cartera de Crédito',
        'millones USD'
        
    );
}

// ✅ GRÁFICO DE BARRAS POR CUENTAS IMPRODUCTIVAS - USANDO FUNCIÓN GENÉRICA
function renderComposicionCartera() {
    const targetDate = `${currentYear}-${currentMonth}`;
    const prevMonthDate = getPreviousMonthDate(currentYear, currentMonth);
    const prevYearDate = subtractMonths(currentYear, currentMonth, 12);
    
    const cuentas = [
        { code: 'IF011', name: 'Cart. Bruta' },
        { code: 'IF007', name: 'Por vencer' },
        { code: 'IF009', name: 'Vencida' },
        { code: 'IF008', name: 'No dev. int.' }
    ];
    
    // ✅ USAR FUNCIÓN GENÉRICA con ID de Hoja 4
    renderBarrasCuentasGenerico(
        'chartComposicionCartera',  // ID del gráfico de Hoja 4
        cuentas,
        targetDate,
        prevMonthDate,
        prevYearDate
    );
}

// ✅ GRÁFICO DE BARRAS - ACTIVOS IMPRODUCTIVOS NETOS (SB004) - USANDO FUNCIÓN GENÉRICA
function renderMorosidadChart() {
    if (!currentMagazineData) return;
    
    const targetDate = `${currentYear}-${currentMonth}`;
    const prevYearDate = subtractMonths(currentYear, currentMonth, 12);
    const selYear = parseInt(currentYear);
    
    const allDates = Object.keys(currentMagazineData[0]).filter(k => /^\d{4}-\d{2}$/.test(k)).sort();
    const currentYearMonths = allDates.filter(d => d.startsWith(`${selYear}-`));
    const previousYearMonths = allDates.filter(d => d.startsWith(`${selYear - 1}-`));
    const xAxisLabels = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

    const getMonthlyData = (code, monthsArray) => {
        const row = currentMagazineData.find(r => r.Variable === code || r.CUC === code);
        if (!row) return new Array(12).fill(0);
        return monthsArray.map(dateStr => parseFloat(row[dateStr]) || 0);
    };

    const chartDom = document.getElementById('chartMorosidad');
    if (!chartDom) return;
    
    let chart = echarts.getInstanceByDom(chartDom);
    if (!chart) chart = echarts.init(chartDom);

    const option = {
        tooltip: {
            trigger: 'axis',
            axisPointer: { type: 'shadow' },
            formatter: (params) => {
                let res = `<div style="font-weight:bold; margin-bottom:5px;">${params[0].name}</div>`;
                params.forEach(p => {
                    res += `<div style="display:flex; align-items:center; gap:8px;">
                        <span style="width:10px; height:10px; background:${p.color}; border-radius:2px;"></span>
                        ${p.seriesName}: <strong>${formatNumber(p.value)}</strong>
                    </div>`;
                });
                return res;
            }
        },
        legend: { data: ['Año Actual', 'Año Anterior'], bottom: 0, textStyle: { fontSize: 10 } },
        grid: { left: '8%', right: '5%', bottom: '12%', top: '15%', containLabel: true },
        xAxis: { 
            type: 'category', 
            data: xAxisLabels, 
            axisLine: { lineStyle: { color: '#cbd5e1' } },
            axisLabel: { fontSize: 9, color: '#64748b' }
        },
        yAxis: { 
            type: 'value', 
            name: 'porcentaje (%)', 
            axisLabel: { formatter: (value) => formatNumber(value), fontSize: 9, color: '#64748b' }, 
            splitLine: { lineStyle: { type: 'dashed', color: '#f1f5f9' } } 
        },
        series: [
            {
                name: 'Año Actual',
                type: 'bar',
                data: getMonthlyData('IF012', currentYearMonths),
                itemStyle: { color: '#2563eb', borderRadius: [4, 4, 0, 0] },
                label: { show: showChartLabels, position: 'top', formatter: (p) => formatNumber(p.value), fontSize: 9, fontWeight: 'bold', color: '#2563eb' }
            },
            {
                name: 'Año Anterior',
                type: 'bar',
                data: getMonthlyData('IF012', previousYearMonths),
                itemStyle: { color: '#94a3b8', borderRadius: [4, 4, 0, 0] },
                label: { show: showChartLabels, position: 'top', formatter: (p) => formatNumber(p.value), fontSize: 9, fontWeight: 'bold', color: '#94a3b8' }
            }
        ]
    };
    chart.setOption(option, true);
}

// ✅ FUNCION PRINCIPAL PARA RENDERIZAR PÁGINA 8
async function renderIntermediacionPage() {
    const targetDate = `${currentYear}-${currentMonth}`;
    const prevYearDate = subtractMonths(currentYear, currentMonth, 12);
    
    // 1. KPIs Grandes (Usando tu función genérica de KPIs normal)
    updateKPIGenerico('IF011', 'kpi-if011', targetDate, prevYearDate);
    updateKPIGenerico('@14', 'kpi-14', targetDate, prevYearDate);
    updateKPIGenerico('IF007', 'kpi-if007', targetDate, prevYearDate);
    updateKPIGenerico('IF009', 'kpi-if009', targetDate, prevYearDate);
    updateKPIGenerico('IF008', 'kpi-if008', targetDate, prevYearDate);
    
    // 2. ✅ MINI KPIS CON GRÁFICOS (Llamando a la función genérica)
    // Parámetros: (CódigoCUC, 'sufijo-para-ids', fecha, 'tipo-gráfico', 'color-hex')
    await renderMiniKPIWithChart('IF012', 'if012', targetDate, 'bar', '#FCA5A5');   // Morosidad (Rojo pastel)
    await renderMiniKPIWithChart('SB036', 'sb036', targetDate, 'line', '#93C5FD');  // Rend. Total (Azul pastel)
    await renderMiniKPIWithChart('SB037', 'sb037', targetDate, 'bar', '#86EFAC');   // Rend. Productivo (Verde pastel)
    await renderMiniKPIWithChart('SB038', 'sb038', targetDate, 'line', '#FDE047');  // Rend. Consumo (Amarillo pastel)
    await renderMiniKPIWithChart('SB039', 'sb039', targetDate, 'bar', '#C4B5FD');   // Rend. Inmobiliario (Morado pastel)
    await renderMiniKPIWithChart('SB040', 'sb040', targetDate, 'line', '#FDBA74');  // Rend. Microcrédito (Naranja pastel)
    
    // 3. Gráficos Grandes (Usando tus funciones genéricas de gráficos)
    renderHistoricoCartera(); // (Asumiendo que ya la adaptaste a la genérica o la dejas así si es de doble eje específico)
    renderComposicionCartera();
    renderMorosidadChart();
}

// ==========================================
// PÁGINA 11: FINAL DE LA HOJA 11
// ==========================================



// ==========================================
// PÁGINA 13: CARTERA DE CRÉDITO PRODUCTIVO
// ==========================================

// ✅ GRÁFICO HISTÓRICO IMPRODUCTIVOS - USANDO FUNCIÓN GENÉRICA
function renderHistoricoCarteraProd() {
    const seriesConfig = [
        { code: '@1401', name: 'Cart. Bruta (der)', color: '#3b82f6', type: 'line', yAxisIndex: 0 },
        { code: 'IF010_1', name: 'Cart. Vencer (der)', color: '#10b981', type: 'line' , yAxisIndex: 0},
        { code: 'IF012_1', name: 'Cart. Improductiva (izq)', color: '#f59e0b' , type: 'bar', yAxisIndex: 1}
        
    ];
    
    // ✅ USAR FUNCIÓN GENÉRICA con ID de Hoja 4
    renderHistoricoEstructuraGenerico(
        'chartHistoricoCarteraProd',  // ID del gráfico de Hoja 4
        seriesConfig,
        'Evolución Histórica - Cartera de Crédito',
        'millones USD',
        'porcentajes (%)'
        
    );
}

function renderHistoricoRefiRees() {
    const seriesConfig = [
        { code: '@1409', name: 'Cart. Bruta', color: '#3b82f6', type: 'line'},
        { code: '@1417', name: 'Cart. Vencer', color: '#10b981', type: 'line'}
        
    ];
    
    // ✅ USAR FUNCIÓN GENÉRICA con ID de Hoja 4
    renderHistoricoEstructuraGenerico(
        'chartHistoricoRefiRees',  // ID del gráfico de Hoja 4
        seriesConfig,
        'Evolución Histórica - Cartera de Crédito',
        'millones USD'
        
        
    );
}

// ✅ GRÁFICO DE BARRAS POR CUENTAS IMPRODUCTIVAS - USANDO FUNCIÓN GENÉRICA
function renderComposicionCarteraProd() {
    const targetDate = `${currentYear}-${currentMonth}`;
    const prevMonthDate = getPreviousMonthDate(currentYear, currentMonth);
    const prevYearDate = subtractMonths(currentYear, currentMonth, 12);
    
    const cuentas = [
        { code: 'IF011_1', name: 'Cart. Bruta' },
        { code: 'IF007_1', name: 'Por vencer' },
        { code: 'IF009_1', name: 'Vencida' },
        { code: 'IF008_1', name: 'No dev. int.' }
    ];
    
    // ✅ USAR FUNCIÓN GENÉRICA con ID de Hoja 4
    renderBarrasCuentasGenerico(
        'chartComposicionCarteraProd',  // ID del gráfico de Hoja 4
        cuentas,
        targetDate,
        prevMonthDate,
        prevYearDate
    );
}

// ✅ GRÁFICO DE BARRAS - ACTIVOS IMPRODUCTIVOS NETOS (SB004) - USANDO FUNCIÓN GENÉRICA
function renderMorosidadProd() {
    if (!currentMagazineData) return;
    
    const targetDate = `${currentYear}-${currentMonth}`;
    const prevYearDate = subtractMonths(currentYear, currentMonth, 12);
    const selYear = parseInt(currentYear);
    
    const allDates = Object.keys(currentMagazineData[0]).filter(k => /^\d{4}-\d{2}$/.test(k)).sort();
    const currentYearMonths = allDates.filter(d => d.startsWith(`${selYear}-`));
    const previousYearMonths = allDates.filter(d => d.startsWith(`${selYear - 1}-`));
    const xAxisLabels = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

    const getMonthlyData = (code, monthsArray) => {
        const row = currentMagazineData.find(r => r.Variable === code || r.CUC === code);
        if (!row) return new Array(12).fill(0);
        return monthsArray.map(dateStr => parseFloat(row[dateStr]) || 0);
    };

    const chartDom = document.getElementById('chartMorosidadProd');
    if (!chartDom) return;
    
    let chart = echarts.getInstanceByDom(chartDom);
    if (!chart) chart = echarts.init(chartDom);

    const option = {
        tooltip: {
            trigger: 'axis',
            axisPointer: { type: 'shadow' },
            formatter: (params) => {
                let res = `<div style="font-weight:bold; margin-bottom:5px;">${params[0].name}</div>`;
                params.forEach(p => {
                    res += `<div style="display:flex; align-items:center; gap:8px;">
                        <span style="width:10px; height:10px; background:${p.color}; border-radius:2px;"></span>
                        ${p.seriesName}: <strong>${formatNumber(p.value)}</strong>
                    </div>`;
                });
                return res;
            }
        },
        legend: { data: ['Año Actual', 'Año Anterior'], bottom: 0, textStyle: { fontSize: 10 } },
        grid: { left: '8%', right: '5%', bottom: '12%', top: '15%', containLabel: true },
        xAxis: { 
            type: 'category', 
            data: xAxisLabels, 
            axisLine: { lineStyle: { color: '#cbd5e1' } },
            axisLabel: { fontSize: 9, color: '#64748b' }
        },
        yAxis: { 
            type: 'value', 
            name: 'porcentaje (%)', 
            axisLabel: { formatter: (value) => formatNumber(value), fontSize: 9, color: '#64748b' }, 
            splitLine: { lineStyle: { type: 'dashed', color: '#f1f5f9' } } 
        },
        series: [
            {
                name: 'Año Actual',
                type: 'bar',
                data: getMonthlyData('IF012_1', currentYearMonths),
                itemStyle: { color: '#2563eb', borderRadius: [4, 4, 0, 0] },
                label: { show: showChartLabels, position: 'top', formatter: (p) => formatNumber(p.value), fontSize: 9, fontWeight: 'bold', color: '#2563eb' }
            },
            {
                name: 'Año Anterior',
                type: 'bar',
                data: getMonthlyData('IF012_1', previousYearMonths),
                itemStyle: { color: '#94a3b8', borderRadius: [4, 4, 0, 0] },
                label: { show: showChartLabels, position: 'top', formatter: (p) => formatNumber(p.value), fontSize: 9, fontWeight: 'bold', color: '#94a3b8' }
            }
        ]
    };
    chart.setOption(option, true);
}

// ✅ FUNCION PRINCIPAL PARA RENDERIZAR PÁGINA 8
async function renderCarteraProductivaPage() {
    const targetDate = `${currentYear}-${currentMonth}`;
    const prevYearDate = subtractMonths(currentYear, currentMonth, 12);
    
    // Actualizar KPIs de primera fila
    updateKPIGenerico('IF011_1', 'kpi-if011-prod', targetDate, prevYearDate);
    updateKPIGenerico('@1401', 'kpi-1401-prod', targetDate, prevYearDate);
    updateKPIGenerico('IF007_1', 'kpi-if007-prod', targetDate, prevYearDate);
    updateKPIGenerico('IF009_1', 'kpi-if009-prod', targetDate, prevYearDate);
    updateKPIGenerico('IF008_1', 'kpi-if008-prod', targetDate, prevYearDate);
    
    // 2. ✅ MINI KPIS CON GRÁFICOS (Llamando a la función genérica)
    // Parámetros: (CódigoCUC, 'sufijo-para-ids', fecha, 'tipo-gráfico', 'color-hex')
    await renderMiniKPIWithChart('@1425', '1425', targetDate, 'bar', '#FCA5A5');   // Morosidad (Rojo pastel)
    await renderMiniKPIWithChart('@1433', '1433', targetDate, 'line', '#93C5FD');  // Rend. Total (Azul pastel)
    await renderMiniKPIWithChart('@1441', '1441', targetDate, 'bar', '#86EFAC');   // Rend. Productivo (Verde pastel)
    await renderMiniKPIWithChart('@1449', '1449', targetDate, 'line', '#FDE047');  // Rend. Consumo (Amarillo pastel)
    await renderMiniKPIWithChart('@1457', '1457', targetDate, 'bar', '#C4B5FD');   // Rend. Inmobiliario (Morado pastel)
    await renderMiniKPIWithChart('@1465', '1465', targetDate, 'line', '#FDBA74');  // Rend. Microcrédito (Naranja pastel)
    
    // Renderizar gráficos
    renderHistoricoCarteraProd();
    renderHistoricoRefiRees();
    renderComposicionCarteraProd();
    renderMorosidadProd();
}

// ==========================================
// PÁGINA 13: FINAL DE LA HOJA 13
// ==========================================


// ==========================================
// PÁGINA 14: CARTERA DE CRÉDITO CONSUMO
// ==========================================

// ✅ GRÁFICO HISTÓRICO IMPRODUCTIVOS - USANDO FUNCIÓN GENÉRICA
function renderHistoricoCarteraCons() {
    const seriesConfig = [
        { code: '@1402', name: 'Cart. Bruta (der)', color: '#3b82f6', type: 'line', yAxisIndex: 0 },
        { code: 'IF010_2', name: 'Cart. Vencer (der)', color: '#10b981', type: 'line' , yAxisIndex: 0},
        { code: 'IF012_2', name: 'Cart. Improductiva (izq)', color: '#f59e0b' , type: 'bar', yAxisIndex: 1}
        
    ];
    
    // ✅ USAR FUNCIÓN GENÉRICA con ID de Hoja 4
    renderHistoricoEstructuraGenerico(
        'chartHistoricoCarteraCons',  // ID del gráfico de Hoja 4
        seriesConfig,
        'Evolución Histórica - Cartera de Crédito',
        'millones USD',
        'porcentajes (%)'
        
    );
}

function renderHistoricoRefiReesCons() {
    const seriesConfig = [
        { code: '@1410', name: 'Cart. Bruta', color: '#3b82f6', type: 'line'},
        { code: '@1418', name: 'Cart. Vencer', color: '#10b981', type: 'line'}
        
    ];
    
    // ✅ USAR FUNCIÓN GENÉRICA con ID de Hoja 4
    renderHistoricoEstructuraGenerico(
        'chartHistoricoRefiReesCons',  // ID del gráfico de Hoja 4
        seriesConfig,
        'Evolución Histórica - Cartera de Crédito',
        'millones USD'
        
        
    );
}

// ✅ GRÁFICO DE BARRAS POR CUENTAS IMPRODUCTIVAS - USANDO FUNCIÓN GENÉRICA
function renderComposicionCarteraCons() {
    const targetDate = `${currentYear}-${currentMonth}`;
    const prevMonthDate = getPreviousMonthDate(currentYear, currentMonth);
    const prevYearDate = subtractMonths(currentYear, currentMonth, 12);
    
    const cuentas = [
        { code: 'IF011_2', name: 'Cart. Bruta' },
        { code: 'IF007_2', name: 'Por vencer' },
        { code: 'IF009_2', name: 'Vencida' },
        { code: 'IF008_2', name: 'No dev. int.' }
    ];
    
    // ✅ USAR FUNCIÓN GENÉRICA con ID de Hoja 4
    renderBarrasCuentasGenerico(
        'chartComposicionCarteraCons',  // ID del gráfico de Hoja 4
        cuentas,
        targetDate,
        prevMonthDate,
        prevYearDate
    );
}

// ✅ GRÁFICO DE BARRAS - ACTIVOS IMPRODUCTIVOS NETOS (SB004) - USANDO FUNCIÓN GENÉRICA
function renderMorosidadCons() {
    if (!currentMagazineData) return;
    
    const targetDate = `${currentYear}-${currentMonth}`;
    const prevYearDate = subtractMonths(currentYear, currentMonth, 12);
    const selYear = parseInt(currentYear);
    
    const allDates = Object.keys(currentMagazineData[0]).filter(k => /^\d{4}-\d{2}$/.test(k)).sort();
    const currentYearMonths = allDates.filter(d => d.startsWith(`${selYear}-`));
    const previousYearMonths = allDates.filter(d => d.startsWith(`${selYear - 1}-`));
    const xAxisLabels = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

    const getMonthlyData = (code, monthsArray) => {
        const row = currentMagazineData.find(r => r.Variable === code || r.CUC === code);
        if (!row) return new Array(12).fill(0);
        return monthsArray.map(dateStr => parseFloat(row[dateStr]) || 0);
    };

    const chartDom = document.getElementById('chartMorosidadCons');
    if (!chartDom) return;
    
    let chart = echarts.getInstanceByDom(chartDom);
    if (!chart) chart = echarts.init(chartDom);

    const option = {
        tooltip: {
            trigger: 'axis',
            axisPointer: { type: 'shadow' },
            formatter: (params) => {
                let res = `<div style="font-weight:bold; margin-bottom:5px;">${params[0].name}</div>`;
                params.forEach(p => {
                    res += `<div style="display:flex; align-items:center; gap:8px;">
                        <span style="width:10px; height:10px; background:${p.color}; border-radius:2px;"></span>
                        ${p.seriesName}: <strong>${formatNumber(p.value)}</strong>
                    </div>`;
                });
                return res;
            }
        },
        legend: { data: ['Año Actual', 'Año Anterior'], bottom: 0, textStyle: { fontSize: 10 } },
        grid: { left: '8%', right: '5%', bottom: '12%', top: '15%', containLabel: true },
        xAxis: { 
            type: 'category', 
            data: xAxisLabels, 
            axisLine: { lineStyle: { color: '#cbd5e1' } },
            axisLabel: { fontSize: 9, color: '#64748b' }
        },
        yAxis: { 
            type: 'value', 
            name: 'porcentaje (%)', 
            axisLabel: { formatter: (value) => formatNumber(value), fontSize: 9, color: '#64748b' }, 
            splitLine: { lineStyle: { type: 'dashed', color: '#f1f5f9' } } 
        },
        series: [
            {
                name: 'Año Actual',
                type: 'bar',
                data: getMonthlyData('IF012_2', currentYearMonths),
                itemStyle: { color: '#2563eb', borderRadius: [4, 4, 0, 0] },
                label: { show: showChartLabels, position: 'top', formatter: (p) => formatNumber(p.value), fontSize: 9, fontWeight: 'bold', color: '#2563eb' }
            },
            {
                name: 'Año Anterior',
                type: 'bar',
                data: getMonthlyData('IF012_2', previousYearMonths),
                itemStyle: { color: '#94a3b8', borderRadius: [4, 4, 0, 0] },
                label: { show: showChartLabels, position: 'top', formatter: (p) => formatNumber(p.value), fontSize: 9, fontWeight: 'bold', color: '#94a3b8' }
            }
        ]
    };
    chart.setOption(option, true);
}

// ✅ FUNCION PRINCIPAL PARA RENDERIZAR PÁGINA 8
async function renderCarteraConsumoPage() {
    const targetDate = `${currentYear}-${currentMonth}`;
    const prevYearDate = subtractMonths(currentYear, currentMonth, 12);
    
    // Actualizar KPIs de primera fila
    updateKPIGenerico('IF011_2', 'kpi-if011-cons', targetDate, prevYearDate);
    updateKPIGenerico('@1402', 'kpi-1402-cons', targetDate, prevYearDate);
    updateKPIGenerico('IF007_2', 'kpi-if007-cons', targetDate, prevYearDate);
    updateKPIGenerico('IF009_2', 'kpi-if009-cons', targetDate, prevYearDate);
    updateKPIGenerico('IF008_2', 'kpi-if008-cons', targetDate, prevYearDate);
    
    // 2. ✅ MINI KPIS CON GRÁFICOS (Llamando a la función genérica)
    // Parámetros: (CódigoCUC, 'sufijo-para-ids', fecha, 'tipo-gráfico', 'color-hex')
    await renderMiniKPIWithChart('@1426', '1426', targetDate, 'bar', '#FCA5A5');   // Morosidad (Rojo pastel)
    await renderMiniKPIWithChart('@1434', '1434', targetDate, 'line', '#93C5FD');  // Rend. Total (Azul pastel)
    await renderMiniKPIWithChart('@1442', '1442', targetDate, 'bar', '#86EFAC');   // Rend. Productivo (Verde pastel)
    await renderMiniKPIWithChart('@1450', '1450', targetDate, 'line', '#FDE047');  // Rend. Consumo (Amarillo pastel)
    await renderMiniKPIWithChart('@1458', '1458', targetDate, 'bar', '#C4B5FD');   // Rend. Inmobiliario (Morado pastel)
    await renderMiniKPIWithChart('@1466', '1466', targetDate, 'line', '#FDBA74');  // Rend. Microcrédito (Naranja pastel)
    
    // Renderizar gráficos
     renderHistoricoCarteraCons();
    renderHistoricoRefiReesCons();
    renderComposicionCarteraCons();
    renderMorosidadCons();
}

// ==========================================
// PÁGINA 14: FINAL DE LA HOJA 14
// ==========================================


// ==========================================
// PÁGINA 15: CARTERA DE CRÉDITO INMOBILIARIO
// ==========================================

// ✅ GRÁFICO HISTÓRICO IMPRODUCTIVOS - USANDO FUNCIÓN GENÉRICA
function renderHistoricoCarteraInmo() {
    const seriesConfig = [
        { code: '@1403', name: 'Cart. Bruta (der)', color: '#3b82f6', type: 'line', yAxisIndex: 0 },
        { code: 'IF010_3', name: 'Cart. Vencer (der)', color: '#10b981', type: 'line' , yAxisIndex: 0},
        { code: 'IF012_3', name: 'Cart. Improductiva (izq)', color: '#f59e0b' , type: 'bar', yAxisIndex: 1}
        
    ];
    
    // ✅ USAR FUNCIÓN GENÉRICA con ID de Hoja 4
    renderHistoricoEstructuraGenerico(
        'chartHistoricoCarteraInmo',  // ID del gráfico de Hoja 4
        seriesConfig,
        'Evolución Histórica - Cartera de Crédito',
        'millones USD',
        'porcentajes (%)'
        
    );
}

function renderHistoricoRefiReesInmo() {
    const seriesConfig = [
        { code: '@1411', name: 'Cart. Bruta', color: '#3b82f6', type: 'line'},
        { code: '@1419', name: 'Cart. Vencer', color: '#10b981', type: 'line'}
        
    ];
    
    // ✅ USAR FUNCIÓN GENÉRICA con ID de Hoja 4
    renderHistoricoEstructuraGenerico(
        'chartHistoricoRefiReesInmo',  // ID del gráfico de Hoja 4
        seriesConfig,
        'Evolución Histórica - Cartera de Crédito',
        'millones USD'
        
        
    );
}

// ✅ GRÁFICO DE BARRAS POR CUENTAS IMPRODUCTIVAS - USANDO FUNCIÓN GENÉRICA
function renderComposicionCarteraInmo() {
    const targetDate = `${currentYear}-${currentMonth}`;
    const prevMonthDate = getPreviousMonthDate(currentYear, currentMonth);
    const prevYearDate = subtractMonths(currentYear, currentMonth, 12);
    
    const cuentas = [
        { code: 'IF011_3', name: 'Cart. Bruta' },
        { code: 'IF007_3', name: 'Por vencer' },
        { code: 'IF009_3', name: 'Vencida' },
        { code: 'IF008_3', name: 'No dev. int.' }
    ];
    
    // ✅ USAR FUNCIÓN GENÉRICA con ID de Hoja 4
    renderBarrasCuentasGenerico(
        'chartComposicionCarteraInmo',  // ID del gráfico de Hoja 4
        cuentas,
        targetDate,
        prevMonthDate,
        prevYearDate
    );
}

// ✅ GRÁFICO DE BARRAS - ACTIVOS IMPRODUCTIVOS NETOS (SB004) - USANDO FUNCIÓN GENÉRICA
function renderMorosidadInmo() {
    if (!currentMagazineData) return;
    
    const targetDate = `${currentYear}-${currentMonth}`;
    const prevYearDate = subtractMonths(currentYear, currentMonth, 12);
    const selYear = parseInt(currentYear);
    
    const allDates = Object.keys(currentMagazineData[0]).filter(k => /^\d{4}-\d{2}$/.test(k)).sort();
    const currentYearMonths = allDates.filter(d => d.startsWith(`${selYear}-`));
    const previousYearMonths = allDates.filter(d => d.startsWith(`${selYear - 1}-`));
    const xAxisLabels = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

    const getMonthlyData = (code, monthsArray) => {
        const row = currentMagazineData.find(r => r.Variable === code || r.CUC === code);
        if (!row) return new Array(12).fill(0);
        return monthsArray.map(dateStr => parseFloat(row[dateStr]) || 0);
    };

    const chartDom = document.getElementById('chartMorosidadInmo');
    if (!chartDom) return;
    
    let chart = echarts.getInstanceByDom(chartDom);
    if (!chart) chart = echarts.init(chartDom);

    const option = {
        tooltip: {
            trigger: 'axis',
            axisPointer: { type: 'shadow' },
            formatter: (params) => {
                let res = `<div style="font-weight:bold; margin-bottom:5px;">${params[0].name}</div>`;
                params.forEach(p => {
                    res += `<div style="display:flex; align-items:center; gap:8px;">
                        <span style="width:10px; height:10px; background:${p.color}; border-radius:2px;"></span>
                        ${p.seriesName}: <strong>${formatNumber(p.value)}</strong>
                    </div>`;
                });
                return res;
            }
        },
        legend: { data: ['Año Actual', 'Año Anterior'], bottom: 0, textStyle: { fontSize: 10 } },
        grid: { left: '8%', right: '5%', bottom: '12%', top: '15%', containLabel: true },
        xAxis: { 
            type: 'category', 
            data: xAxisLabels, 
            axisLine: { lineStyle: { color: '#cbd5e1' } },
            axisLabel: { fontSize: 9, color: '#64748b' }
        },
        yAxis: { 
            type: 'value', 
            name: 'porcentaje (%)', 
            axisLabel: { formatter: (value) => formatNumber(value), fontSize: 9, color: '#64748b' }, 
            splitLine: { lineStyle: { type: 'dashed', color: '#f1f5f9' } } 
        },
        series: [
            {
                name: 'Año Actual',
                type: 'bar',
                data: getMonthlyData('IF012_3', currentYearMonths),
                itemStyle: { color: '#2563eb', borderRadius: [4, 4, 0, 0] },
                label: { show: showChartLabels, position: 'top', formatter: (p) => formatNumber(p.value), fontSize: 9, fontWeight: 'bold', color: '#2563eb' }
            },
            {
                name: 'Año Anterior',
                type: 'bar',
                data: getMonthlyData('IF012_3', previousYearMonths),
                itemStyle: { color: '#94a3b8', borderRadius: [4, 4, 0, 0] },
                label: { show: showChartLabels, position: 'top', formatter: (p) => formatNumber(p.value), fontSize: 9, fontWeight: 'bold', color: '#94a3b8' }
            }
        ]
    };
    chart.setOption(option, true);
}

// ✅ FUNCION PRINCIPAL PARA RENDERIZAR PÁGINA 8
async function renderCarteraInmobiliarioPage() {
    const targetDate = `${currentYear}-${currentMonth}`;
    const prevYearDate = subtractMonths(currentYear, currentMonth, 12);
    
    // Actualizar KPIs de primera fila
    updateKPIGenerico('IF011_3', 'kpi-if011-inmo', targetDate, prevYearDate);
    updateKPIGenerico('@1403', 'kpi-1403-inmo', targetDate, prevYearDate);
    updateKPIGenerico('IF007_3', 'kpi-if007-inmo', targetDate, prevYearDate);
    updateKPIGenerico('IF009_3', 'kpi-if009-inmo', targetDate, prevYearDate);
    updateKPIGenerico('IF008_3', 'kpi-if008-inmo', targetDate, prevYearDate);
    
    // 2. ✅ MINI KPIS CON GRÁFICOS (Llamando a la función genérica)
    // Parámetros: (CódigoCUC, 'sufijo-para-ids', fecha, 'tipo-gráfico', 'color-hex')
    await renderMiniKPIWithChart('@1427', '1427', targetDate, 'bar', '#FCA5A5');   // Morosidad (Rojo pastel)
    await renderMiniKPIWithChart('@1435', '1435', targetDate, 'line', '#93C5FD');  // Rend. Total (Azul pastel)
    await renderMiniKPIWithChart('@1443', '1443', targetDate, 'bar', '#86EFAC');   // Rend. Productivo (Verde pastel)
    await renderMiniKPIWithChart('@1451', '1451', targetDate, 'line', '#FDE047');  // Rend. Consumo (Amarillo pastel)
    await renderMiniKPIWithChart('@1459', '1459', targetDate, 'bar', '#C4B5FD');   // Rend. Inmobiliario (Morado pastel)
    await renderMiniKPIWithChart('@1467', '1467', targetDate, 'line', '#FDBA74');  // Rend. Microcrédito (Naranja pastel)
    
    // Renderizar gráficos
    renderHistoricoCarteraInmo();
    renderHistoricoRefiReesInmo();
    renderComposicionCarteraInmo();
    renderMorosidadInmo();
}

// ==========================================
// PÁGINA 15: FINAL DE LA HOJA 15
// ==========================================



// ==========================================
// PÁGINA 16: CARTERA DE CRÉDITO MICROCREDITO
// ==========================================

// ✅ GRÁFICO HISTÓRICO IMPRODUCTIVOS - USANDO FUNCIÓN GENÉRICA
function renderHistoricoCarteraMicro() {
    const seriesConfig = [
        { code: '@1404', name: 'Cart. Bruta (der)', color: '#3b82f6', type: 'line', yAxisIndex: 0 },
        { code: 'IF010_4', name: 'Cart. Vencer (der)', color: '#10b981', type: 'line' , yAxisIndex: 0},
        { code: 'IF012_4', name: 'Cart. Improductiva (izq)', color: '#f59e0b' , type: 'bar', yAxisIndex: 1}
        
    ];
    
    // ✅ USAR FUNCIÓN GENÉRICA con ID de Hoja 4
    renderHistoricoEstructuraGenerico(
        'chartHistoricoCarteraMicro',  // ID del gráfico de Hoja 4
        seriesConfig,
        'Evolución Histórica - Cartera de Crédito',
        'millones USD',
        'porcentajes (%)'
        
    );
}

function renderHistoricoRefiReesMicro() {
    const seriesConfig = [
        { code: '@1412', name: 'Cart. Bruta', color: '#3b82f6', type: 'line'},
        { code: '@1420', name: 'Cart. Vencer', color: '#10b981', type: 'line'}
        
    ];
    
    // ✅ USAR FUNCIÓN GENÉRICA con ID de Hoja 4
    renderHistoricoEstructuraGenerico(
        'chartHistoricoRefiReesMicro',  // ID del gráfico de Hoja 4
        seriesConfig,
        'Evolución Histórica - Cartera de Crédito',
        'millones USD'
        
        
    );
}

// ✅ GRÁFICO DE BARRAS POR CUENTAS IMPRODUCTIVAS - USANDO FUNCIÓN GENÉRICA
function renderComposicionCarteraMicro() {
    const targetDate = `${currentYear}-${currentMonth}`;
    const prevMonthDate = getPreviousMonthDate(currentYear, currentMonth);
    const prevYearDate = subtractMonths(currentYear, currentMonth, 12);
    
    const cuentas = [
        { code: 'IF011_4', name: 'Cart. Bruta' },
        { code: 'IF007_4', name: 'Por vencer' },
        { code: 'IF009_4', name: 'Vencida' },
        { code: 'IF008_4', name: 'No dev. int.' }
    ];
    
    // ✅ USAR FUNCIÓN GENÉRICA con ID de Hoja 4
    renderBarrasCuentasGenerico(
        'chartComposicionCarteraMicro',  // ID del gráfico de Hoja 4
        cuentas,
        targetDate,
        prevMonthDate,
        prevYearDate
    );
}

// ✅ GRÁFICO DE BARRAS - ACTIVOS IMPRODUCTIVOS NETOS (SB004) - USANDO FUNCIÓN GENÉRICA
function renderMorosidadMicro() {
    if (!currentMagazineData) return;
    
    const targetDate = `${currentYear}-${currentMonth}`;
    const prevYearDate = subtractMonths(currentYear, currentMonth, 12);
    const selYear = parseInt(currentYear);
    
    const allDates = Object.keys(currentMagazineData[0]).filter(k => /^\d{4}-\d{2}$/.test(k)).sort();
    const currentYearMonths = allDates.filter(d => d.startsWith(`${selYear}-`));
    const previousYearMonths = allDates.filter(d => d.startsWith(`${selYear - 1}-`));
    const xAxisLabels = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

    const getMonthlyData = (code, monthsArray) => {
        const row = currentMagazineData.find(r => r.Variable === code || r.CUC === code);
        if (!row) return new Array(12).fill(0);
        return monthsArray.map(dateStr => parseFloat(row[dateStr]) || 0);
    };

    const chartDom = document.getElementById('chartMorosidadMicro');
    if (!chartDom) return;
    
    let chart = echarts.getInstanceByDom(chartDom);
    if (!chart) chart = echarts.init(chartDom);

    const option = {
        tooltip: {
            trigger: 'axis',
            axisPointer: { type: 'shadow' },
            formatter: (params) => {
                let res = `<div style="font-weight:bold; margin-bottom:5px;">${params[0].name}</div>`;
                params.forEach(p => {
                    res += `<div style="display:flex; align-items:center; gap:8px;">
                        <span style="width:10px; height:10px; background:${p.color}; border-radius:2px;"></span>
                        ${p.seriesName}: <strong>${formatNumber(p.value)}</strong>
                    </div>`;
                });
                return res;
            }
        },
        legend: { data: ['Año Actual', 'Año Anterior'], bottom: 0, textStyle: { fontSize: 10 } },
        grid: { left: '8%', right: '5%', bottom: '12%', top: '15%', containLabel: true },
        xAxis: { 
            type: 'category', 
            data: xAxisLabels, 
            axisLine: { lineStyle: { color: '#cbd5e1' } },
            axisLabel: { fontSize: 9, color: '#64748b' }
        },
        yAxis: { 
            type: 'value', 
            name: 'porcentaje (%)', 
            axisLabel: { formatter: (value) => formatNumber(value), fontSize: 9, color: '#64748b' }, 
            splitLine: { lineStyle: { type: 'dashed', color: '#f1f5f9' } } 
        },
        series: [
            {
                name: 'Año Actual',
                type: 'bar',
                data: getMonthlyData('IF012_4', currentYearMonths),
                itemStyle: { color: '#2563eb', borderRadius: [4, 4, 0, 0] },
                label: { show: showChartLabels, position: 'top', formatter: (p) => formatNumber(p.value), fontSize: 9, fontWeight: 'bold', color: '#2563eb' }
            },
            {
                name: 'Año Anterior',
                type: 'bar',
                data: getMonthlyData('IF012_4', previousYearMonths),
                itemStyle: { color: '#94a3b8', borderRadius: [4, 4, 0, 0] },
                label: { show: showChartLabels, position: 'top', formatter: (p) => formatNumber(p.value), fontSize: 9, fontWeight: 'bold', color: '#94a3b8' }
            }
        ]
    };
    chart.setOption(option, true);
}

// ✅ FUNCION PRINCIPAL PARA RENDERIZAR PÁGINA 8
async function renderCarteraMicrocreditoPage() {
    const targetDate = `${currentYear}-${currentMonth}`;
    const prevYearDate = subtractMonths(currentYear, currentMonth, 12);
    
    // Actualizar KPIs de primera fila
    updateKPIGenerico('IF011_4', 'kpi-if011-micro', targetDate, prevYearDate);
    updateKPIGenerico('@1404', 'kpi-1404-micro', targetDate, prevYearDate);
    updateKPIGenerico('IF007_4', 'kpi-if007-micro', targetDate, prevYearDate);
    updateKPIGenerico('IF009_4', 'kpi-if009-micro', targetDate, prevYearDate);
    updateKPIGenerico('IF008_4', 'kpi-if008-micro', targetDate, prevYearDate);
    
    // 2. ✅ MINI KPIS CON GRÁFICOS (Llamando a la función genérica)
    // Parámetros: (CódigoCUC, 'sufijo-para-ids', fecha, 'tipo-gráfico', 'color-hex')
    await renderMiniKPIWithChart('@1428', '1428', targetDate, 'bar', '#FCA5A5');   // Morosidad (Rojo pastel)
    await renderMiniKPIWithChart('@1436', '1436', targetDate, 'line', '#93C5FD');  // Rend. Total (Azul pastel)
    await renderMiniKPIWithChart('@1444', '1444', targetDate, 'bar', '#86EFAC');   // Rend. Productivo (Verde pastel)
    await renderMiniKPIWithChart('@1452', '1452', targetDate, 'line', '#FDE047');  // Rend. Consumo (Amarillo pastel)
    await renderMiniKPIWithChart('@1460', '1460', targetDate, 'bar', '#C4B5FD');   // Rend. Inmobiliario (Morado pastel)
    await renderMiniKPIWithChart('@1468', '1468', targetDate, 'line', '#FDBA74');  // Rend. Microcrédito (Naranja pastel)
    
    // Renderizar gráficos
    renderHistoricoCarteraMicro();
    renderHistoricoRefiReesMicro();
    renderComposicionCarteraMicro();
    renderMorosidadMicro();
}

// ==========================================
// PÁGINA 16: FINAL DE LA HOJA 16
// ==========================================


// ==========================================
// PÁGINA 17: ÍNDICE DE TURBULENCIA
// ==========================================

function updateKPITasa(cucCode, kpiPrefix, targetDate) {
    const row = currentMagazineData.find(r => r.CUC === cucCode || r.Variable === cucCode);
    if (!row) return;
    
    const valCurrent = parseFloat(row[targetDate]) || 0;
    
    document.getElementById(`${kpiPrefix}-value`).textContent = valCurrent.toFixed(2) + '%';
    document.getElementById(`${kpiPrefix}-date`).textContent = formatHeaderDate(targetDate);
}

function renderTurbulenciaChart(seriesName, varAnualSeries, chartId, title) {
    if (!currentMagazineData) return;
    
    const allDateCols = Object.keys(currentMagazineData[0]).filter(k => /^\d{4}-\d{2}$/.test(k)).sort();
    const dateLabels = allDateCols.map(d => {
        const [y, m] = d.split('-');
        return `${monthsNames[parseInt(m)-1]} ${y}`;
    });
    
    const getSeriesData = (code) => {
        const row = currentMagazineData.find(r => r.Variable === code || r.CUC === code);
        return row ? allDateCols.map(d => parseFloat(row[d]) || 0) : allDateCols.map(() => 0);
    };
    
    const turbData = getSeriesData(seriesName);
    const validData = turbData.filter(v => v !== 0 && !isNaN(v));
    const sortedData = [...validData].sort((a, b) => a - b);
    
    const p75Index = Math.floor(sortedData.length * 0.75);
    const p50Index = Math.floor(sortedData.length * 0.50);
    const p75 = sortedData[p75Index] || 0;
    const p50 = sortedData[p50Index] || 0;
    
    const barColors = turbData.map(value => {
        if (value <= p50) return '#2563eb';
        if (value <= p75) return '#94a3b8';
        return '#64748b';
    });
    
    const varAnualData = getSeriesData(varAnualSeries);
    
    // ✅ Crear datos constantes para las líneas de percentiles
    const p75LineData = dateLabels.map(() => p75);
    const p50LineData = dateLabels.map(() => p50);
    
    const chartDom = document.getElementById(chartId);
    if (!chartDom) return;
    
    let chart = echarts.getInstanceByDom(chartDom);
    if (!chart) chart = echarts.init(chartDom);
    
    let zoomStart = 0, zoomEnd = 100;
    if (dateLabels.length > 12) zoomStart = ((dateLabels.length - 12) / dateLabels.length) * 100;
    
    const option = {
        title: { 
            text: title, 
            left: 'center', 
            textStyle: { fontSize: 12, fontWeight: 'bold', color: '#1e3a8a' } 
        },
        toolbox: {
            show: true,
            right: '5%',
            top: '3%',
            feature: {
                saveAsImage: { title: 'Descargar', iconStyle: { borderColor: '#2563eb' } },
                magicType: { type: ['line', 'bar'], title: { line: 'Líneas', bar: 'Barras' }, iconStyle: { borderColor: '#2563eb' } },
                restore: { title: 'Restaurar', iconStyle: { borderColor: '#2563eb' } },
                dataZoom: { title: { zoom: 'Zoom', back: 'Restaurar' }, iconStyle: { borderColor: '#2563eb' } }
            }
        },
        tooltip: {
            trigger: 'axis',
            axisPointer: { type: 'cross' },
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            borderColor: '#e2e8f0',
            borderWidth: 1,
            textStyle: { color: '#334155', fontSize: 11 },
            formatter: function(params) {
                let result = `<div style="padding: 5px; font-weight: bold; margin-bottom: 5px;">${params[0].axisValue}</div>`;
                params.forEach(param => {
                    if (param.seriesName === 'Índice de Turbulencia') {
                        let nivel = param.value <= p50 ? 'Normal' : param.value <= p75 ? 'Turbulencia media' : 'Turbulencia alta';
                        result += `<div style="margin: 3px 0;"><span style="display: inline-block; width: 10px; height: 10px; background: ${param.color}; border-radius: 50%; margin-right: 5px;"></span><span style="color: #64748b;">${param.seriesName}:</span><span style="font-weight: bold; margin-left: 5px;">${param.value.toFixed(3)}</span> <span style="color: #94a3b8; font-size: 10px;">(${nivel})</span></div>`;
                    } else if (param.seriesName === 'Percentil 75%') {
                        result += `<div style="margin: 3px 0;"><span style="display: inline-block; width: 10px; height: 2px; background: #475569; margin-right: 5px;"></span><span style="color: #64748b;">${param.seriesName}:</span><span style="font-weight: bold; margin-left: 5px;">${p75.toFixed(3)}</span></div>`;
                    } else if (param.seriesName === 'Percentil 50%') {
                        result += `<div style="margin: 3px 0;"><span style="display: inline-block; width: 10px; height: 2px; background: #2563eb; margin-right: 5px;"></span><span style="color: #64748b;">${param.seriesName}:</span><span style="font-weight: bold; margin-left: 5px;">${p50.toFixed(3)}</span></div>`;
                    } else {
                        result += `<div style="margin: 3px 0;"><span style="display: inline-block; width: 10px; height: 10px; background: ${param.color}; border-radius: 50%; margin-right: 5px;"></span><span style="color: #64748b;">${param.seriesName}:</span><span style="font-weight: bold; margin-left: 5px;">${param.value.toFixed(2)}%</span></div>`;
                    }
                });
                return result;
            }
        },
        legend: { 
            data: ['Índice de Turbulencia', 'Percentil 75%', 'Percentil 50%', 'Var. Cartera Bruta Real'], 
            left: '3%',
            top: '8%',
            orient: 'vertical',
            textStyle: { fontSize: 9, color: '#64748b' } 
        },
        grid: { 
            left: '22%',
            right: '15%',
            bottom: '15%',
            top: '20%',
            containLabel: true
        },
        xAxis: { 
            type: 'category', 
            data: dateLabels, 
            boundaryGap: ['5%', '5%'],
            axisLine: { lineStyle: { color: '#cbd5e1' } },
            axisLabel: { fontSize: 8, color: '#64748b', rotate: 45 },
            axisTick: { show: false }
        },
        yAxis: [
            { 
                type: 'value', 
                name: 'Índice',
                nameLocation: 'middle',
                nameGap: 40,
                nameTextStyle: { fontSize: 9, color: '#64748b', fontWeight: '600' },
                axisLine: { show: true, lineStyle: { color: '#2563eb' } },
                axisTick: { show: false },
                axisLabel: { 
                    fontSize: 9, 
                    color: '#64748b',
                    margin: 15,
                    formatter: (value) => value.toFixed(1)
                },
                splitLine: { lineStyle: { color: '#f1f5f9', type: 'dashed' } },
                position: 'left',
                min: 'dataMin',
                max: 'dataMax'
            },
            { 
                type: 'value', 
                name: 'Var. Cartera Bruta Real',
                nameLocation: 'middle',
                nameGap: 55,
                nameTextStyle: { fontSize: 9, color: '#ef4444', fontWeight: '600' },
                axisLine: { show: true, lineStyle: { color: '#ef4444' } },
                axisTick: { show: false },
                axisLabel: { 
                    fontSize: 9, 
                    color: '#ef4444',
                    margin: 15,
                    formatter: (value) => value.toFixed(2) + '%'
                },
                splitLine: { show: false },
                position: 'right',
                min: 'dataMin',
                max: 'dataMax'
            }
        ],
        dataZoom: [ 
            { 
                type: 'inside', 
                start: zoomStart, 
                end: zoomEnd,
                zoomOnMouseWheel: true,
                moveOnMouseMove: true,
                zoomLock: false
            }, 
            { 
                type: 'slider', 
                bottom: 2, 
                start: zoomStart, 
                end: zoomEnd, 
                height: 18, 
                borderColor: '#e2e8f0', 
                fillerColor: 'rgba(37, 99, 235, 0.1)', 
                backgroundColor: '#f8fafc', 
                handleStyle: { color: '#fff', shadowBlur: 3 },
                dataBackground: {
                    lineStyle: { color: '#3b82f6' },
                    areaStyle: { color: '#3b82f6' }
                }
            } 
        ],
        series: [
            { 
                name: 'Índice de Turbulencia', 
                type: 'bar',
                data: turbData.map((value, index) => ({
                    value: value,
                    itemStyle: { color: barColors[index] }
                })),
                barWidth: '50%',
                barMaxWidth: 40,
                label: { show: false },
                yAxisIndex: 0,
                // ✅ Quitar markLine de aquí
            },
            { 
                name: 'Percentil 75%', 
                type: 'line',
                data: p75LineData,
                lineStyle: { width: 2, color: '#475569', type: 'dashed' },
                symbol: 'none',
                label: { 
                    show: true,
                    position: 'insideEndTop',
                    formatter: `P75: ${p75.toFixed(2)}`,
                    fontSize: 8,
                    color: '#64748b',
                    backgroundColor: 'rgba(255,255,255,0.8)',
                    padding: [2, 4],
                    borderRadius: 3
                },
                yAxisIndex: 0,
                silent: true,  // ✅ No interactivo
                animation: false  // ✅ Sin animación para mejor rendimiento
            },
            { 
                name: 'Percentil 50%', 
                type: 'line',
                data: p50LineData,
                lineStyle: { width: 2, color: '#2563eb', type: 'dashed' },
                symbol: 'none',
                label: { 
                    show: true,
                    position: 'insideEndTop',
                    formatter: `P50: ${p50.toFixed(2)}`,
                    fontSize: 8,
                    color: '#64748b',
                    backgroundColor: 'rgba(255,255,255,0.8)',
                    padding: [2, 4],
                    borderRadius: 3
                },
                yAxisIndex: 0,
                silent: true,  // ✅ No interactivo
                animation: false  // ✅ Sin animación para mejor rendimiento
            },
            { 
                name: 'Var. Cartera Bruta Real', 
                type: 'line',
                data: varAnualData,
                lineStyle: { width: 2.5, color: '#ef4444' },
                symbol: 'circle',
                symbolSize: 4,
                label: { show: false },
                yAxisIndex: 1,
                areaStyle: {
                    color: 'rgba(239, 68, 68, 0.1)'
                }
            }
        ]
    };
    
    // ✅ Eliminar markLine ya que ahora usamos series separadas
    
    chart.on('dataZoom', function(params) {
        setTimeout(() => {
            chart.resize();
        }, 100);
    });
    
    chart.setOption(option, true);
    
    setTimeout(() => {
        chart.resize();
    }, 100);
}

function generateTurbulenciaAnalysis() {
    const analysisDiv = document.getElementById('turbulenciaDetailedAnalysis');
    if (!analysisDiv) return;
    
    // Obtener datos actuales
    const getLatestValue = (variableName) => {
        const allDateCols = Object.keys(currentMagazineData[0]).filter(k => /^\d{4}-\d{2}$/.test(k)).sort();
        const latestDate = allDateCols[allDateCols.length - 1];
        // ✅ Buscar por el nombre EXACTO de la columna Variable en el dataframe
        const row = currentMagazineData.find(r => r.Variable === variableName);
        return row ? parseFloat(row[latestDate]) || 0 : 0;
    };
    
    // ✅ Usar los nombres exactos del dataframe de R
    const turbProductiva = getLatestValue('Tasa de Variación Anual Real Cart. Productiva');
    const turbConsumo = getLatestValue('Tasa de Variación Anual Real Cart. Consumo');
    const turbInmo = getLatestValue('Tasa de Variación Anual Real Cart. Inmobiliario');
    const turbMicro = getLatestValue('Tasa de Variación Anual Real Cart. Microcrédito');
    
    // Obtener percentiles
    const p75 = getLatestValue('Percentil 75');
    const p50 = getLatestValue('Percentil 50');
    
    // Determinar niveles
    const getLevel = (value) => {
        if (value < p50) return { class: 'highlight-positive', text: 'Normal' };
        if (value < p75) return { class: 'highlight-warning', text: 'Turbulencia Media' };
        return { class: 'highlight-negative', text: 'Turbulencia Alta' };
    };
    
    const levelProd = getLevel(turbProductiva);
    const levelCons = getLevel(turbConsumo);
    const levelInmo = getLevel(turbInmo);
    const levelMicro = getLevel(turbMicro);
    
    analysisDiv.innerHTML = `
        <div style="margin-bottom: 15px;">
            <strong style="color: var(--primary-blue);">Resumen Actual:</strong>
        </div>
        <ul style="list-style: none; padding: 0; margin: 0;">
            <li style="margin: 8px 0; padding: 8px; background: #f8fafc; border-radius: 6px; border-left: 3px solid #2563eb;">
                <strong>Cartera Productiva:</strong> ${turbProductiva.toFixed(3)} - <span class="${levelProd.class}">${levelProd.text}</span>
            </li>
            <li style="margin: 8px 0; padding: 8px; background: #f8fafc; border-radius: 6px; border-left: 3px solid #2563eb;">
                <strong>Cartera Consumo:</strong> ${turbConsumo.toFixed(3)} - <span class="${levelCons.class}">${levelCons.text}</span>
            </li>
            <li style="margin: 8px 0; padding: 8px; background: #f8fafc; border-radius: 6px; border-left: 3px solid #2563eb;">
                <strong>Cartera Inmobiliario:</strong> ${turbInmo.toFixed(3)} - <span class="${levelInmo.class}">${levelInmo.text}</span>
            </li>
            <li style="margin: 8px 0; padding: 8px; background: #f8fafc; border-radius: 6px; border-left: 3px solid #2563eb;">
                <strong>Cartera Microcrédito:</strong> ${turbMicro.toFixed(3)} - <span class="${levelMicro.class}">${levelMicro.text}</span>
            </li>
        </ul>
        <div style="margin-top: 15px; padding: 12px; background: #fef3c7; border-radius: 6px; border-left: 3px solid #f59e0b;">
            <strong>Interpretación:</strong>
            <p style="margin: 5px 0 0 0; font-size: 10px;">
                Los valores por encima del percentil 75% (${p75.toFixed(2)}) indican <span class="highlight-negative">turbulencia alta</span>, 
                lo que sugiere variaciones anómalas en la cartera de crédito que requieren atención especial.
            </p>
        </div>
    `;
}

async function renderTurbulenciaPage() {
    const targetDate = `${currentYear}-${currentMonth}`;
    
    // Actualizar KPIs (sin variación)
    updateKPITasa('tasa_14', 'kpi-tasa14', targetDate);
    updateKPITasa('tasa_IF0071', 'kpi-tasaif0071', targetDate);
    updateKPITasa('tasa_IF0072', 'kpi-tasaif0072', targetDate);
    updateKPITasa('tasa_IF0073', 'kpi-tasaif0073', targetDate);
    updateKPITasa('tasa_IF0074', 'kpi-tasaif0074', targetDate);
    
    // Renderizar gráficos de turbulencia
    // ✅ Primer parámetro: serie del índice (barras - eje izquierdo)
    // ✅ Segundo parámetro: serie de variación anual (línea - eje derecho)
    renderTurbulenciaChart('turbulencia', 'var_anual_comer', 'chartTurbulenciaProductiva', 'Índice de Turbulencia - Cartera Productiva');
    renderTurbulenciaChart('turbulencia', 'var_anual_cons', 'chartTurbulenciaConsumo', 'Índice de Turbulencia - Cartera Consumo');
    renderTurbulenciaChart('turbulencia', 'var_anual_inmo', 'chartTurbulenciaInmo', 'Índice de Turbulencia - Cartera Inmobiliario');
    renderTurbulenciaChart('turbulencia', 'var_anual_micro', 'chartTurbulenciaMicro', 'Índice de Turbulencia - Cartera Microcrédito');
    
    // Generar análisis
    generateTurbulenciaAnalysis();
}

// ==========================================
// PÁGINA 17: FINAL DE LA HOJA 17
// ==========================================



// ==========================================
// PÁGINA 18: MONTO DE OPERACIONES ACTIVAS Y PASIVAS
// ==========================================

// ✅ GRÁFICO HISTÓRICO IMPRODUCTIVOS - USANDO FUNCIÓN GENÉRICA
function renderHistoricoActivas() {
    const seriesConfig = [
        { code: 'monto_total', name: 'Monto Activas (der)', color: '#3b82f6', type: 'line', yAxisIndex: 0 },
        { code: 'ope_total', name: 'Número Operaciones (izq)', color: '#f59e0b' , type: 'bar', yAxisIndex: 1}
        
    ];
    
    // ✅ USAR FUNCIÓN GENÉRICA con ID de Hoja 4
    renderHistoricoEstructuraGenerico(
        'chartHistoricoActivas',  // ID del gráfico de Hoja 4
        seriesConfig,
        'Evolución Histórica - Operaciones Activas',
        'millones USD',
        'número'
        
    );
}

function renderHistoricoPasivas() {
    const seriesConfig = [
        { code: 'mop', name: 'Monto Pasivas (der)', color: '#3b82f6', type: 'line', yAxisIndex: 0 },
        { code: 'OPTPE', name: 'Número Operaciones (izq)', color: '#f59e0b' , type: 'bar', yAxisIndex: 1}
        
    ];
    
    // ✅ USAR FUNCIÓN GENÉRICA con ID de Hoja 4
    renderHistoricoEstructuraGenerico(
        'chartHistoricoPasivas',  // ID del gráfico de Hoja 4
        seriesConfig,
        'Evolución Histórica - Operaciones Pasivas',
        'millones USD',
        'número'
        
        
    );
}

// ✅ GRÁFICO DE BARRAS POR CUENTAS IMPRODUCTIVAS - USANDO FUNCIÓN GENÉRICA
function renderComposicionActivas() {
    const targetDate = `${currentYear}-${currentMonth}`;
    const prevMonthDate = getPreviousMonthDate(currentYear, currentMonth);
    const prevYearDate = subtractMonths(currentYear, currentMonth, 12);
    
    const cuentas = [
        { code: 'part_proc', name: 'Part. Prod. Corp.' },
        { code: 'part_empr', name: 'Part. Prod. Empr.' },
        { code: 'part_pyme', name: 'Part. Prod. PYMES' },
        { code: 'partmon_cons', name: 'Part. Consumo' },
        { code: 'partmon_inmo', name: 'Part. Inmo.' },
        { code: 'part_mino', name: 'Part. Mic. Minorista' },
        { code: 'part_simp', name: 'Part. Mic. Acu. Simple' },
        { code: 'part_amp', name: 'Part. Mic. Acu. Ampliada' }
    ];
    
    // ✅ USAR FUNCIÓN GENÉRICA con ID de Hoja 4
    renderBarrasCuentasGenerico(
        'chartComposicionActivas',  // ID del gráfico de Hoja 4
        cuentas,
        targetDate,
        prevMonthDate,
        prevYearDate
    );
}

// ✅ GRÁFICO DE BARRAS POR CUENTAS IMPRODUCTIVAS - USANDO FUNCIÓN GENÉRICA
function renderComposicionDepositos() {
    const targetDate = `${currentYear}-${currentMonth}`;
    const prevMonthDate = getPreviousMonthDate(currentYear, currentMonth);
    const prevYearDate = subtractMonths(currentYear, currentMonth, 12);
    
    const cuentas = [
        { code: 'part_30', name: 'Part. Dep. 30-60' },
        { code: 'part_60', name: 'Part. Dep. 61-90' },
        { code: 'part_90', name: 'Part. Dep. 91-120' },
        { code: 'part_120', name: 'Part. Dep. 121-180' },
        { code: 'part_180', name: 'Part. Dep. 181-360' },
        { code: 'part_360', name: 'Part. Dep. 361' }
    ];
    
    // ✅ USAR FUNCIÓN GENÉRICA con ID de Hoja 4
    renderBarrasCuentasGenerico(
        'chartComposicionDepositos',  // ID del gráfico de Hoja 4
        cuentas,
        targetDate,
        prevMonthDate,
        prevYearDate
    );
}

function generateAnalisisCreditoDepositos() {
    const analysisDiv = document.getElementById('analisisCreditoDepositos');
    if (!analysisDiv) return;
    
    const targetDate = `${currentYear}-${currentMonth}`;
    
    const getLatestValue = (code) => {
        const row = currentMagazineData.find(r => r.CUC === code || r.Variable === code);
        return row ? parseFloat(row[targetDate]) || 0 : 0;
    };
    
    const montoActivas = getLatestValue('monto_total');
    const numActivas = getLatestValue('ope_total');
    const montoPromActivas = getLatestValue('monto_pro');
    const montoPasivas = getLatestValue('mop');
    const numPasivas = getLatestValue('OPTPE');
    const montoPromPasivas = getLatestValue('pro_MOP');
    
    // Obtener composición
    const partCorp = getLatestValue('part_proc');
    const partEmpr = getLatestValue('part_empr');
    const partPyme = getLatestValue('part_pyme');
    const partCons = getLatestValue('partmon_cons');
    
    analysisDiv.innerHTML = `
        <div style="margin-bottom: 15px;">
            <strong style="color: var(--primary-blue);">Resumen de Operaciones:</strong>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px;">
            <div style="background: #f8fafc; padding: 12px; border-radius: 6px; border-left: 3px solid #2563eb;">
                <strong style="color: var(--primary-blue); font-size: 11px;">OPERACIONES ACTIVAS</strong>
                <p style="margin: 5px 0; font-size: 10px;">Monto Total: <strong>${formatNumber(montoActivas)} millones USD</strong></p>
                <p style="margin: 5px 0; font-size: 10px;">Número Operaciones: <strong>${formatNumber(numActivas)}</strong></p>
                <p style="margin: 5px 0; font-size: 10px;">Monto Promedio: <strong>${formatNumber(montoPromActivas)} USD</strong></p>
            </div>
            <div style="background: #f8fafc; padding: 12px; border-radius: 6px; border-left: 3px solid #10b981;">
                <strong style="color: var(--primary-blue); font-size: 11px;">OPERACIONES PASIVAS</strong>
                <p style="margin: 5px 0; font-size: 10px;">Monto Total: <strong>${formatNumber(montoPasivas)} millones USD</strong></p>
                <p style="margin: 5px 0; font-size: 10px;">Número Operaciones: <strong>${formatNumber(numPasivas)}</strong></p>
                <p style="margin: 5px 0; font-size: 10px;">Monto Promedio: <strong>${formatNumber(montoPromPasivas)} USD</strong></p>
            </div>
        </div>
        <div style="background: #fef3c7; padding: 12px; border-radius: 6px; border-left: 3px solid #f59e0b;">
            <strong style="font-size: 11px;">Composición del Crédito:</strong>
            <p style="margin: 5px 0; font-size: 10px;">
                Corporativo: <strong>${partCorp.toFixed(2)}%</strong> | 
                Empresarial: <strong>${partEmpr.toFixed(2)}%</strong> | 
                PYMES: <strong>${partPyme.toFixed(2)}%</strong> | 
                Consumo: <strong>${partCons.toFixed(2)}%</strong>
            </p>
        </div>
    `;
}


// ✅ FUNCION PRINCIPAL PARA RENDERIZAR PÁGINA 8
async function renderOperacionesActivasPasivasPage() {
    const targetDate = `${currentYear}-${currentMonth}`;
    const prevYearDate = subtractMonths(currentYear, currentMonth, 12);
    
    // Actualizar KPIs de primera fila
    updateKPIGenerico('monto_total', 'kpi-monto-total', targetDate, prevYearDate);
    updateKPIGenerico('ope_total', 'kpi-num-ope-total', targetDate, prevYearDate);
    updateKPIGenerico('monto_pro', 'kpi-monto-pro', targetDate, prevYearDate);
    updateKPIGenerico('mop', 'kpi-mop', targetDate, prevYearDate);
    updateKPIGenerico('OPTPE', 'kpi-optpe', targetDate, prevYearDate);
    updateKPIGenerico('pro_MOP', 'kpi-pro-mop', targetDate, prevYearDate);
    
    renderHistoricoActivas();
    renderHistoricoPasivas();
    renderComposicionActivas();
    renderComposicionDepositos();
    
    // Generar análisis
    generateAnalisisCreditoDepositos();
}

// ==========================================
// PÁGINA 18: FINAL DE LA HOJA 18
// ==========================================


// ==========================================
// PÁGINA 19: MOA PRODUCTIVO
// ==========================================

// ✅ GRÁFICO HISTÓRICO IMPRODUCTIVOS - USANDO FUNCIÓN GENÉRICA
function renderHistoricoMontoSegProd() {
    const seriesConfig = [
        { code: 'moa_cor', name: 'Seg. Productivo', color: '#3b82f6', type: 'line'},
        { code: 'proc', name: 'Prod. Corporativo', color: '#10b981', type: 'bar' },
        { code: 'prodem', name: 'Prod. Empresarial', color: '#f59e0b' , type: 'bar'},
        { code: 'prodpy', name: 'Prod. PYMES', color: '#20666B' , type: 'bar'}
        
    ];
    
    // ✅ USAR FUNCIÓN GENÉRICA con ID de Hoja 4
    renderHistoricoEstructuraGenerico(
        'chartHistoricoMontoSegProd',  // ID del gráfico de Hoja 4
        seriesConfig,
        'Evolución Histórica - Segmento Productivo',
        'millones USD'
        
    );
}

function renderHistoricoNumSegProd() {
    const seriesConfig = [
        { code: 'num_cor', name: 'Seg. Productivo', color: '#3b82f6', type: 'line'},
        { code: 'num_proc', name: 'Prod. Corporativo', color: '#10b981', type: 'bar' },
        { code: 'num_prodem', name: 'Prod. Empresarial', color: '#f59e0b' , type: 'bar'},
        { code: 'num_prodpy', name: 'Prod. PYMES', color: '#20666B' , type: 'bar'}
        
    ];
    
    // ✅ USAR FUNCIÓN GENÉRICA con ID de Hoja 4
    renderHistoricoEstructuraGenerico(
        'chartHistoricoNumSegProd',  // ID del gráfico de Hoja 4
        seriesConfig,
        'Evolución Histórica - Número de Operaciones',
        'número'
        
        
    );
}

// ✅ GRÁFICO DE BARRAS POR CUENTAS IMPRODUCTIVAS - USANDO FUNCIÓN GENÉRICA
function renderComposicionMontoSegProd() {
    const targetDate = `${currentYear}-${currentMonth}`;
    const prevMonthDate = getPreviousMonthDate(currentYear, currentMonth);
    const prevYearDate = subtractMonths(currentYear, currentMonth, 12);
    
    const cuentas = [
        { code: 'moa_cor', name: 'Seg. Productivo' },
        { code: 'proc', name: 'Prod. Corporativo' },
        { code: 'prodem', name: 'Prod. Empresarial' },
        { code: 'prodpy', name: 'Prod. PYMES' }
    ];
    
    // ✅ USAR FUNCIÓN GENÉRICA con ID de Hoja 4
    renderBarrasCuentasGenerico(
        'chartComposicionMontoSegProd',  // ID del gráfico de Hoja 4
        cuentas,
        targetDate,
        prevMonthDate,
        prevYearDate
    );
}

// ✅ GRÁFICO DE BARRAS - ACTIVOS IMPRODUCTIVOS NETOS (SB004) - USANDO FUNCIÓN GENÉRICA
function renderComposicionNumSegProd() {
    const targetDate = `${currentYear}-${currentMonth}`;
    const prevMonthDate = getPreviousMonthDate(currentYear, currentMonth);
    const prevYearDate = subtractMonths(currentYear, currentMonth, 12);
    
    const cuentas = [
        { code: 'num_cor', name: 'Seg. Productivo' },
        { code: 'num_proc', name: 'Prod. Corporativo' },
        { code: 'num_prodem', name: 'Prod. Empresarial' },
        { code: 'num_prodpy', name: 'Prod. PYMES' }
    ];
    
    // ✅ USAR FUNCIÓN GENÉRICA con ID de Hoja 4
    renderBarrasCuentasGenerico(
        'chartComposicionNumSegProd',  // ID del gráfico de Hoja 4
        cuentas,
        targetDate,
        prevMonthDate,
        prevYearDate
    );
}

async function updateKPIMiniSegProd(cucCode, kpiPrefix, targetDate) {
    const row = currentMagazineData.find(r => r.CUC === cucCode || r.Variable === cucCode);
    if (!row) return;
    
    const valCurrent = parseFloat(row[targetDate]) || 0;
    const prevMonthDate = getPreviousMonthDate(currentYear, currentMonth);
    const valPrevMonth = parseFloat(row[prevMonthDate]) || 0;
    
    const elValue = document.getElementById(`${kpiPrefix}-mini-value`);
    if (elValue) elValue.textContent = formatNumber(valCurrent);
    
    const allDateCols = Object.keys(currentMagazineData[0]).filter(k => /^\d{4}-\d{2}$/.test(k)).sort();
    const last6Months = allDateCols.slice(-6);
    
    const chartData = last6Months.map(d => parseFloat(row[d]) || 0);
    const chartLabels = last6Months.map(d => {
        const [y, m] = d.split('-');
        return monthsNames[parseInt(m)-1];
    });
    
    const codeMap = { 'pro_cor': 'ProCor', 'pro_proc': 'ProProc', 'pro_prodem': 'ProProdem', 'pro_prodpy': 'ProProdpy' };
    const colorMap = { 'pro_cor': '#3b82f6', 'pro_proc': '#8b5cf6', 'pro_prodem': '#f59e0b', 'pro_prodpy': '#10b981' };
    
    const chartId = `chartMini${codeMap[cucCode]}`;
    const chartDom = document.getElementById(chartId);
    if (!chartDom) return;
    
    const chart = echarts.init(chartDom);
    const varMonthly = valPrevMonth !== 0 ? ((valCurrent - valPrevMonth) / Math.abs(valPrevMonth)) * 100 : 0;
    
    let trendClass = 'trend-stable', trendText = 'Estable', trendIcon = '→';
    if (varMonthly > 0.5) { trendClass = 'trend-up'; trendText = 'Subiendo'; trendIcon = '↑'; }
    else if (varMonthly < -0.5) { trendClass = 'trend-down'; trendText = 'Bajando'; trendIcon = '↓'; }
    
    const summaryEl = document.getElementById(`summary-${kpiPrefix.replace('kpi-', '')}`);
    if (summaryEl) {
        summaryEl.innerHTML = `<div>${trendIcon} <span class="${trendClass}">${trendText}</span></div>
            <div style="font-size: 8px; margin-top: 2px;">Mensual: <span class="${varMonthly > 0 ? 'trend-up' : varMonthly < 0 ? 'trend-down' : 'trend-stable'}">${varMonthly > 0 ? '+' : ''}${varMonthly.toFixed(1)}%</span></div>`;
    }
    
    chart.setOption({
        grid: { top: 10, bottom: 20, left: 5, right: 5 },
        xAxis: { type: 'category', data: chartLabels, axisLabel: { fontSize: 7, color: '#64748b' }, axisLine: { show: false }, axisTick: { show: false } },
        yAxis: { type: 'value', axisLabel: { show: false }, splitLine: { show: false } },
        series: [{
            type: 'bar', data: chartData,
            itemStyle: { color: colorMap[cucCode] || '#3b82f6', borderRadius: [3, 3, 0, 0] },
            label: { show: showChartLabels, position: 'top', fontSize: 7, color: '#64748b', formatter: (p) => formatNumber(p.value) },
            barWidth: '70%'
        }]
    });
}


// ✅ FUNCION PRINCIPAL PARA RENDERIZAR PÁGINA 8
async function renderSegProductivoPage() {
    const targetDate = `${currentYear}-${currentMonth}`;
    const prevYearDate = subtractMonths(currentYear, currentMonth, 12);
    
    // Actualizar KPIs de primera fila
    updateKPIGenerico('moa_cor', 'kpi-moa-cor', targetDate, prevYearDate);
    updateKPIGenerico('num_cor', 'kpi-num-cor', targetDate, prevYearDate);
    updateKPIGenerico('proc', 'kpi-proc', targetDate, prevYearDate);
    updateKPIGenerico('proc', 'kpi-proc', targetDate, prevYearDate);
    updateKPIGenerico('prodpy', 'kpi-prodpy', targetDate, prevYearDate);
    
    // 2. ✅ MINI KPIS CON GRÁFICOS (Llamando a la función genérica)
    // Parámetros: (CódigoCUC, 'sufijo-para-ids', fecha, 'tipo-gráfico', 'color-hex')
    await updateKPIMiniSegProd('pro_cor', 'kpi-pro-cor', targetDate);
    await updateKPIMiniSegProd('pro_proc', 'kpi-pro-proc', targetDate);
    await updateKPIMiniSegProd('pro_prodem', 'kpi-pro-prodem', targetDate);
    await updateKPIMiniSegProd('pro_prodpy', 'kpi-pro-prodpy', targetDate);

    
    // Renderizar gráficos
    renderHistoricoMontoSegProd();
    renderHistoricoNumSegProd();
    renderComposicionMontoSegProd();
    renderComposicionNumSegProd();
}

// ==========================================
// PÁGINA 19: FINAL DE LA HOJA 19
// ==========================================



// ==========================================
// PÁGINA 20: MOA CONSUMO EDUCATIVO
// ==========================================

// ✅ GRÁFICO HISTÓRICO IMPRODUCTIVOS - USANDO FUNCIÓN GENÉRICA
function renderHistoricoMontoSegCons() {
    const seriesConfig = [
        { code: 'cons', name: 'Consumo', color: '#3b82f6', type: 'line'},
        { code: 'edu', name: 'Educativo', color: '#10b981', type: 'line' },
        { code: 'eduso', name: 'Educativo Social', color: '#f59e0b' , type: 'line'}
        
    ];
    
    // ✅ USAR FUNCIÓN GENÉRICA con ID de Hoja 4
    renderHistoricoEstructuraGenerico(
        'chartHistoricoMontoSegCons',  // ID del gráfico de Hoja 4
        seriesConfig,
        'Evolución Histórica - Segmento Consumo y Educativo',
        'millones USD'
        
    );
}

function renderHistoricoNumSegCons() {
    const seriesConfig = [
        { code: 'num_cons', name: 'Consumo', color: '#3b82f6', type: 'line'},
        { code: 'num_edu', name: 'Educativo', color: '#10b981', type: 'line' },
        { code: 'num_eduso', name: 'Educativo Social', color: '#f59e0b' , type: 'line'}
        
    ];
    
    // ✅ USAR FUNCIÓN GENÉRICA con ID de Hoja 4
    renderHistoricoEstructuraGenerico(
        'chartHistoricoNumSegCons',  // ID del gráfico de Hoja 4
        seriesConfig,
        'Evolución Histórica - Número de Operaciones',
        'número'
        
        
    );
}

// ✅ GRÁFICO DE BARRAS POR CUENTAS IMPRODUCTIVAS - USANDO FUNCIÓN GENÉRICA
function renderComposicionMontoSegCons() {
    const targetDate = `${currentYear}-${currentMonth}`;
    const prevMonthDate = getPreviousMonthDate(currentYear, currentMonth);
    const prevYearDate = subtractMonths(currentYear, currentMonth, 12);
    
    const cuentas = [
        { code: 'cons', name: 'Consumo' },
        { code: 'edu', name: 'Educativo' },
        { code: 'eduso', name: 'Educativo Social' }
    ];
    
    // ✅ USAR FUNCIÓN GENÉRICA con ID de Hoja 4
    renderBarrasCuentasGenerico(
        'chartComposicionMontoSegCons',  // ID del gráfico de Hoja 4
        cuentas,
        targetDate,
        prevMonthDate,
        prevYearDate
    );
}

// ✅ GRÁFICO DE BARRAS - ACTIVOS IMPRODUCTIVOS NETOS (SB004) - USANDO FUNCIÓN GENÉRICA
function renderComposicionNumSegCons() {
    const targetDate = `${currentYear}-${currentMonth}`;
    const prevMonthDate = getPreviousMonthDate(currentYear, currentMonth);
    const prevYearDate = subtractMonths(currentYear, currentMonth, 12);
    
    const cuentas = [
        { code: 'num_cons', name: 'Consumo' },
        { code: 'num_edu', name: 'Educativo' },
        { code: 'num_eduso', name: 'Educativo Social' }
    ];
    
    // ✅ USAR FUNCIÓN GENÉRICA con ID de Hoja 4
    renderBarrasCuentasGenerico(
        'chartComposicionNumSegCons',  // ID del gráfico de Hoja 4
        cuentas,
        targetDate,
        prevMonthDate,
        prevYearDate
    );
}

async function updateKPIMiniSegCons(cucCode, kpiPrefix, targetDate) {
    const row = currentMagazineData.find(r => r.CUC === cucCode || r.Variable === cucCode);
    if (!row) return;
    
    const valCurrent = parseFloat(row[targetDate]) || 0;
    const prevMonthDate = getPreviousMonthDate(currentYear, currentMonth);
    const valPrevMonth = parseFloat(row[prevMonthDate]) || 0;
    
    const elValue = document.getElementById(`${kpiPrefix}-mini-value`);
    if (elValue) elValue.textContent = formatNumber(valCurrent);
    
    const allDateCols = Object.keys(currentMagazineData[0]).filter(k => /^\d{4}-\d{2}$/.test(k)).sort();
    const last6Months = allDateCols.slice(-6);
    
    const chartData = last6Months.map(d => parseFloat(row[d]) || 0);
    const chartLabels = last6Months.map(d => {
        const [y, m] = d.split('-');
        return monthsNames[parseInt(m)-1];
    });
    
    const codeMap = { 'pro_cons': 'Cons', 'pro_edu': 'Edu', 'pro_eduso': 'Eduso' };
    const colorMap = { 'cons': '#f59e0b', 'edu': '#3b82f6', 'eduso': '#10b981' };
    
    const chartId = `chartMini${codeMap[cucCode]}`;
    const chartDom = document.getElementById(chartId);
    if (!chartDom) return;
    
    const chart = echarts.init(chartDom);
    const varMonthly = valPrevMonth !== 0 ? ((valCurrent - valPrevMonth) / Math.abs(valPrevMonth)) * 100 : 0;
    
    let trendClass = 'trend-stable', trendText = 'Estable', trendIcon = '→';
    if (varMonthly > 0.5) { trendClass = 'trend-up'; trendText = 'Subiendo'; trendIcon = '↑'; }
    else if (varMonthly < -0.5) { trendClass = 'trend-down'; trendText = 'Bajando'; trendIcon = '↓'; }
    
    const summaryEl = document.getElementById(`summary-${kpiPrefix.replace('kpi-', '')}`);
    if (summaryEl) {
        summaryEl.innerHTML = `<div>${trendIcon} <span class="${trendClass}">${trendText}</span></div>
            <div style="font-size: 8px; margin-top: 2px;">Mensual: <span class="${varMonthly > 0 ? 'trend-up' : varMonthly < 0 ? 'trend-down' : 'trend-stable'}">${varMonthly > 0 ? '+' : ''}${varMonthly.toFixed(1)}%</span></div>`;
    }
    
    chart.setOption({
        grid: { top: 10, bottom: 20, left: 5, right: 5 },
        xAxis: { type: 'category', data: chartLabels, axisLabel: { fontSize: 7, color: '#64748b' }, axisLine: { show: false }, axisTick: { show: false } },
        yAxis: { type: 'value', axisLabel: { show: false }, splitLine: { show: false } },
        series: [{
            type: 'bar', data: chartData,
            itemStyle: { color: colorMap[cucCode] || '#3b82f6', borderRadius: [3, 3, 0, 0] },
            label: { show: showChartLabels, position: 'top', fontSize: 7, color: '#64748b', formatter: (p) => formatNumber(p.value) },
            barWidth: '70%'
        }]
    });
}



// ✅ FUNCION PRINCIPAL PARA RENDERIZAR PÁGINA 8
async function renderSegConsPage() {
    const targetDate = `${currentYear}-${currentMonth}`;
    const prevYearDate = subtractMonths(currentYear, currentMonth, 12);
    
    // Actualizar KPIs de primera fila
    updateKPIGenerico('cons', 'kpi-cons', targetDate, prevYearDate);
    updateKPIGenerico('num_cons', 'kpi-num-cons', targetDate, prevYearDate);
    updateKPIGenerico('moa_educ', 'kpi-moa-educ', targetDate, prevYearDate);
    updateKPIGenerico('edu', 'kpi-edu', targetDate, prevYearDate);
    updateKPIGenerico('eduso', 'kpi-eduso', targetDate, prevYearDate);

    // 2. ✅ MINI KPIS CON GRÁFICOS (Llamando a la función genérica)
    // Parámetros: (CódigoCUC, 'sufijo-para-ids', fecha, 'tipo-gráfico', 'color-hex')
    await updateKPIMiniSegCons('pro_cons', 'kpi-cons', targetDate);
    await updateKPIMiniSegCons('pro_edu', 'kpi-edu', targetDate);
    await updateKPIMiniSegCons('pro_eduso', 'kpi-eduso', targetDate);
    
    renderHistoricoMontoSegCons();
    renderHistoricoNumSegCons();
    renderComposicionMontoSegCons();
    renderComposicionNumSegCons();
}

// ==========================================
// PÁGINA 20: FINAL DE LA HOJA 20
// ==========================================



// ==========================================
// PÁGINA 21: MOA INMOBILIARIO
// ==========================================

// ✅ GRÁFICO HISTÓRICO IMPRODUCTIVOS - USANDO FUNCIÓN GENÉRICA
function renderHistoricoMontoSegInmo() {
    const seriesConfig = [
        { code: 'inmo', name: 'Inmobiliario', color: '#3b82f6', type: 'line'},
        { code: 'vip', name: 'Vivienda de Interés Público', color: '#10b981', type: 'line' },
        { code: 'vis', name: 'Vivienda de Interés Social', color: '#f59e0b' , type: 'line'}
        
    ];
    
    // ✅ USAR FUNCIÓN GENÉRICA con ID de Hoja 4
    renderHistoricoEstructuraGenerico(
        'chartHistoricoMontoSegInmo',  // ID del gráfico de Hoja 4
        seriesConfig,
        'Evolución Histórica - Segmento Inmobiliario y Viv. Int. Pub. y Social',
        'millones USD'
        
    );
}

function renderHistoricoNumSegInmo() {
    const seriesConfig = [
        { code: 'num_inmo', name: 'Inmobiliario', color: '#3b82f6', type: 'line'},
        { code: 'num_vip', name: 'Vivienda de Interés Público', color: '#10b981', type: 'line' },
        { code: 'num_vis', name: 'Vivienda de Interés Social', color: '#f59e0b' , type: 'line'}
        
    ];
    
    // ✅ USAR FUNCIÓN GENÉRICA con ID de Hoja 4
    renderHistoricoEstructuraGenerico(
        'chartHistoricoNumSegInmo',  // ID del gráfico de Hoja 4
        seriesConfig,
        'Evolución Histórica - Número de Operaciones',
        'número'
        
        
    );
}

// ✅ GRÁFICO DE BARRAS POR CUENTAS IMPRODUCTIVAS - USANDO FUNCIÓN GENÉRICA
function renderComposicionMontoSegInmo() {
    const targetDate = `${currentYear}-${currentMonth}`;
    const prevMonthDate = getPreviousMonthDate(currentYear, currentMonth);
    const prevYearDate = subtractMonths(currentYear, currentMonth, 12);
    
    const cuentas = [
        { code: 'inmo', name: 'Inmobiliario' },
        { code: 'vip', name: 'Vivienda de Interés Público' },
        { code: 'vis', name: 'Vivienda de Interés Social' }
    ];
    
    // ✅ USAR FUNCIÓN GENÉRICA con ID de Hoja 4
    renderBarrasCuentasGenerico(
        'chartComposicionMontoSegInmo',  // ID del gráfico de Hoja 4
        cuentas,
        targetDate,
        prevMonthDate,
        prevYearDate
    );
}

// ✅ GRÁFICO DE BARRAS - ACTIVOS IMPRODUCTIVOS NETOS (SB004) - USANDO FUNCIÓN GENÉRICA
function renderComposicionNumSegInmo() {
    const targetDate = `${currentYear}-${currentMonth}`;
    const prevMonthDate = getPreviousMonthDate(currentYear, currentMonth);
    const prevYearDate = subtractMonths(currentYear, currentMonth, 12);
    
    const cuentas = [
        { code: 'num_in', name: 'Inmobiliario' },
        { code: 'num_vip', name: 'Vivienda de Interés Público' },
        { code: 'num_vis', name: 'Vivienda de Interés Social' }
    ];
    
    // ✅ USAR FUNCIÓN GENÉRICA con ID de Hoja 4
    renderBarrasCuentasGenerico(
        'chartComposicionNumSegInmo',  // ID del gráfico de Hoja 4
        cuentas,
        targetDate,
        prevMonthDate,
        prevYearDate
    );
}

async function updateKPIMiniSegInmo(cucCode, kpiPrefix, targetDate) {
    const row = currentMagazineData.find(r => r.CUC === cucCode || r.Variable === cucCode);
    if (!row) return;
    
    const valCurrent = parseFloat(row[targetDate]) || 0;
    const prevMonthDate = getPreviousMonthDate(currentYear, currentMonth);
    const valPrevMonth = parseFloat(row[prevMonthDate]) || 0;
    
    const elValue = document.getElementById(`${kpiPrefix}-mini-value`);
    if (elValue) elValue.textContent = formatNumber(valCurrent);
    
    const allDateCols = Object.keys(currentMagazineData[0]).filter(k => /^\d{4}-\d{2}$/.test(k)).sort();
    const last6Months = allDateCols.slice(-6);
    
    const chartData = last6Months.map(d => parseFloat(row[d]) || 0);
    const chartLabels = last6Months.map(d => {
        const [y, m] = d.split('-');
        return monthsNames[parseInt(m)-1];
    });
    
    const codeMap = { 'pro_in': 'ProIn', 'pro_vip': 'ProVip', 'pro_vis': 'ProVis' };
    const colorMap = { 'pro_in': '#2563eb', 'pro_vip': '#8b5cf6', 'pro_vis': '#10b981' };
    
    const chartId = `chartMini${codeMap[cucCode]}`;
    const chartDom = document.getElementById(chartId);
    if (!chartDom) return;
    
    const chart = echarts.init(chartDom);
    const varMonthly = valPrevMonth !== 0 ? ((valCurrent - valPrevMonth) / Math.abs(valPrevMonth)) * 100 : 0;
    
    let trendClass = 'trend-stable', trendText = 'Estable', trendIcon = '→';
    if (varMonthly > 0.5) { trendClass = 'trend-up'; trendText = 'Subiendo'; trendIcon = '↑'; }
    else if (varMonthly < -0.5) { trendClass = 'trend-down'; trendText = 'Bajando'; trendIcon = '↓'; }
    
    const summaryEl = document.getElementById(`summary-${kpiPrefix.replace('kpi-', '')}`);
    if (summaryEl) {
        summaryEl.innerHTML = `<div>${trendIcon} <span class="${trendClass}">${trendText}</span></div>
            <div style="font-size: 8px; margin-top: 2px;">Mensual: <span class="${varMonthly > 0 ? 'trend-up' : varMonthly < 0 ? 'trend-down' : 'trend-stable'}">${varMonthly > 0 ? '+' : ''}${varMonthly.toFixed(1)}%</span></div>`;
    }
    
    chart.setOption({
        grid: { top: 10, bottom: 20, left: 5, right: 5 },
        xAxis: { type: 'category', data: chartLabels, axisLabel: { fontSize: 7, color: '#64748b' }, axisLine: { show: false }, axisTick: { show: false } },
        yAxis: { type: 'value', axisLabel: { show: false }, splitLine: { show: false } },
        series: [{
            type: 'bar', data: chartData,
            itemStyle: { color: colorMap[cucCode] || '#3b82f6', borderRadius: [3, 3, 0, 0] },
            label: { show: showChartLabels, position: 'top', fontSize: 7, color: '#64748b', formatter: (p) => formatNumber(p.value) },
            barWidth: '70%'
        }]
    });
}


// ✅ FUNCION PRINCIPAL PARA RENDERIZAR PÁGINA 8
async function renderSegInmobiliarioPage() {
    const targetDate = `${currentYear}-${currentMonth}`;
    const prevYearDate = subtractMonths(currentYear, currentMonth, 12);
    
    // Actualizar KPIs de primera fila

    updateKPIGenerico('inmo', 'kpi-inmo', targetDate, prevYearDate);
    updateKPIGenerico('num_in', 'kpi-num-in', targetDate, prevYearDate);
    updateKPIGenerico('moa_vi', 'kpi-moa-vi', targetDate, prevYearDate);
    updateKPIGenerico('vip', 'kpi-vip', targetDate, prevYearDate);
    updateKPIGenerico('vis', 'kpi-vis', targetDate, prevYearDate);
    
    await updateKPIMiniSegInmo('pro_in', 'kpi-pro-in', targetDate);
    await updateKPIMiniSegInmo('pro_vip', 'kpi-pro-vip', targetDate);
    await updateKPIMiniSegInmo('pro_vis', 'kpi-pro-vis', targetDate);
    
    renderHistoricoMontoSegInmo();
    renderHistoricoNumSegInmo();
    renderComposicionMontoSegInmo();
    renderComposicionNumSegInmo();
}

// ==========================================
// PÁGINA 21: FINAL DE LA HOJA 21
// ==========================================


// ==========================================
// PÁGINA 22: MOA MICROCRÉDITO
// ==========================================

// ✅ GRÁFICO HISTÓRICO IMPRODUCTIVOS - USANDO FUNCIÓN GENÉRICA
function renderHistoricoMontoSegMic() {
    const seriesConfig = [
        { code: 'moa_mic', name: 'Microcrédito Total', color: '#3b82f6', type: 'line'},
        { code: 'mino', name: 'Mic. Minorista', color: '#10b981', type: 'bar' },
        { code: 'mas', name: 'Mic. Acum. Simple', color: '#f59e0b' , type: 'bar'},
        { code: 'maa', name: 'Mic. Acum. Ampliada', color: '#20666B' , type: 'bar'}
        
    ];
    
    // ✅ USAR FUNCIÓN GENÉRICA con ID de Hoja 4
    renderHistoricoEstructuraGenerico(
        'chartHistoricoMontoSegMic',  // ID del gráfico de Hoja 4
        seriesConfig,
        'Evolución Histórica - Segmento Microcrédito',
        'millones USD'
        
    );
}

function renderHistoricoNumSegMic () {
    const seriesConfig = [
        { code: 'num_mic', name: 'Microcrédito Total', color: '#3b82f6', type: 'line'},
        { code: 'num_mino', name: 'Mic. Minorista', color: '#10b981', type: 'bar' },
        { code: 'num_mas', name: 'Mic. Acum. Simple', color: '#f59e0b' , type: 'bar'},
        { code: 'num_maa', name: 'Mic. Acum. Ampliada', color: '#20666B' , type: 'bar'}
        
    ];
    
    // ✅ USAR FUNCIÓN GENÉRICA con ID de Hoja 4
    renderHistoricoEstructuraGenerico(
        'chartHistoricoNumSegMic',  // ID del gráfico de Hoja 4
        seriesConfig,
        'Evolución Histórica - Número de Operaciones',
        'número'
        
        
    );
}

// ✅ GRÁFICO DE BARRAS POR CUENTAS IMPRODUCTIVAS - USANDO FUNCIÓN GENÉRICA
function renderComposicionMontoSegMic() {
    const targetDate = `${currentYear}-${currentMonth}`;
    const prevMonthDate = getPreviousMonthDate(currentYear, currentMonth);
    const prevYearDate = subtractMonths(currentYear, currentMonth, 12);
    
    const cuentas = [
        { code: 'moa_mic', name: 'Microcrédito Total' },
        { code: 'mino', name: 'Mic. Minorista' },
        { code: 'mas', name: 'Mic. Acum. Simple' },
        { code: 'maa', name: 'Mic. Acum. Ampliada' }
    ];
    
    // ✅ USAR FUNCIÓN GENÉRICA con ID de Hoja 4
    renderBarrasCuentasGenerico(
        'chartComposicionMontoSegMic',  // ID del gráfico de Hoja 4
        cuentas,
        targetDate,
        prevMonthDate,
        prevYearDate
    );
}

// ✅ GRÁFICO DE BARRAS - ACTIVOS IMPRODUCTIVOS NETOS (SB004) - USANDO FUNCIÓN GENÉRICA
function renderComposicionNumSegMic() {
    const targetDate = `${currentYear}-${currentMonth}`;
    const prevMonthDate = getPreviousMonthDate(currentYear, currentMonth);
    const prevYearDate = subtractMonths(currentYear, currentMonth, 12);
    
    const cuentas = [
        { code: 'num_mic', name: 'Microcrédito Total' },
        { code: 'mino', name: 'Mic. Minorista' },
        { code: 'mas', name: 'Mic. Acum. Simple' },
        { code: 'maa', name: 'Mic. Acum. Ampliada' }
    ];
    
    // ✅ USAR FUNCIÓN GENÉRICA con ID de Hoja 4
    renderBarrasCuentasGenerico(
        'chartComposicionNumSegMic',  // ID del gráfico de Hoja 4
        cuentas,
        targetDate,
        prevMonthDate,
        prevYearDate
    );
}

async function updateKPIMiniSegMic(cucCode, kpiPrefix, targetDate) {
    const row = currentMagazineData.find(r => r.CUC === cucCode || r.Variable === cucCode);
    if (!row) return;
    
    const valCurrent = parseFloat(row[targetDate]) || 0;
    const prevMonthDate = getPreviousMonthDate(currentYear, currentMonth);
    const valPrevMonth = parseFloat(row[prevMonthDate]) || 0;
    
    const elValue = document.getElementById(`${kpiPrefix}-mini-value`);
    if (elValue) elValue.textContent = formatNumber(valCurrent);
    
    const allDateCols = Object.keys(currentMagazineData[0]).filter(k => /^\d{4}-\d{2}$/.test(k)).sort();
    const last6Months = allDateCols.slice(-6);
    
    const chartData = last6Months.map(d => parseFloat(row[d]) || 0);
    const chartLabels = last6Months.map(d => {
        const [y, m] = d.split('-');
        return monthsNames[parseInt(m)-1];
    });
    
    const codeMap = { 'pro_mic': 'ProMic', 'pro_mino': 'ProMino', 'pro_mas': 'ProMas', 'pro_maa': 'ProMaa' };
    const colorMap = { 'pro_mic': '#2563eb', 'pro_mino': '#10b981', 'pro_mas': '#f59e0b', 'pro_maa': '#8b5cf6' };
    
    const chartId = `chartMini${codeMap[cucCode]}`;
    const chartDom = document.getElementById(chartId);
    if (!chartDom) return;
    
    const chart = echarts.init(chartDom);
    const varMonthly = valPrevMonth !== 0 ? ((valCurrent - valPrevMonth) / Math.abs(valPrevMonth)) * 100 : 0;
    
    let trendClass = 'trend-stable', trendText = 'Estable', trendIcon = '→';
    if (varMonthly > 0.5) { trendClass = 'trend-up'; trendText = 'Subiendo'; trendIcon = '↑'; }
    else if (varMonthly < -0.5) { trendClass = 'trend-down'; trendText = 'Bajando'; trendIcon = '↓'; }
    
    const summaryEl = document.getElementById(`summary-${kpiPrefix.replace('kpi-', '')}`);
    if (summaryEl) {
        summaryEl.innerHTML = `<div>${trendIcon} <span class="${trendClass}">${trendText}</span></div>
            <div style="font-size: 8px; margin-top: 2px;">Mensual: <span class="${varMonthly > 0 ? 'trend-up' : varMonthly < 0 ? 'trend-down' : 'trend-stable'}">${varMonthly > 0 ? '+' : ''}${varMonthly.toFixed(1)}%</span></div>`;
    }
    
    chart.setOption({
        grid: { top: 10, bottom: 20, left: 5, right: 5 },
        xAxis: { type: 'category', data: chartLabels, axisLabel: { fontSize: 7, color: '#64748b' }, axisLine: { show: false }, axisTick: { show: false } },
        yAxis: { type: 'value', axisLabel: { show: false }, splitLine: { show: false } },
        series: [{
            type: 'bar', data: chartData,
            itemStyle: { color: colorMap[cucCode] || '#3b82f6', borderRadius: [3, 3, 0, 0] },
            label: { show: showChartLabels, position: 'top', fontSize: 7, color: '#64748b', formatter: (p) => formatNumber(p.value) },
            barWidth: '70%'
        }]
    });
}



// ✅ FUNCION PRINCIPAL PARA RENDERIZAR PÁGINA 8
async function renderSegMicrocreditoPage() {
    const targetDate = `${currentYear}-${currentMonth}`;
    const prevYearDate = subtractMonths(currentYear, currentMonth, 12);
    
    // Actualizar KPIs de primera fila

    updateKPIGenerico('moa_mic', 'kpi-moa-mic', targetDate, prevYearDate);
    updateKPIGenerico('num_mic', 'kpi-num-mic', targetDate, prevYearDate);
    updateKPIGenerico('mino', 'kpi-mino', targetDate, prevYearDate);
    updateKPIGenerico('mas', 'kpi-mas', targetDate, prevYearDate);
    updateKPIGenerico('maa', 'kpi-maa', targetDate, prevYearDate);
    
    await updateKPIMiniSegMic('pro_mic', 'kpi-pro-mic', targetDate);
    await updateKPIMiniSegMic('pro_mino', 'kpi-pro-mino', targetDate);
    await updateKPIMiniSegMic('pro_mas', 'kpi-pro-mas', targetDate);
    await updateKPIMiniSegMic('pro_maa', 'kpi-pro-maa', targetDate);
    
    renderHistoricoMontoSegMic();
    renderHistoricoNumSegMic();
    renderComposicionMontoSegMic();
    renderComposicionNumSegMic();
}

// ==========================================
// PÁGINA 22: FINAL DE LA HOJA 22
// ==========================================


// ==========================================
// PÁGINA 23: MO PASIVAS
// ==========================================

// ✅ GRÁFICO HISTÓRICO IMPRODUCTIVOS - USANDO FUNCIÓN GENÉRICA
function renderHistoricoMontoSegPas() {
    const seriesConfig = [
        { code: 'mop', name: 'Depósitos a Plazo', color: '#3b82f6', type: 'line'},
        { code: 'Plazo30', name: 'Plazo 30-60', color: '#10b981', type: 'bar' },
        { code: 'Plazo61', name: 'Plazo 61-90', color: '#f59e0b' , type: 'bar'},
        { code: 'Plazo91', name: 'Plazo 91-120', color: '#20666B' , type: 'bar'},
        { code: 'Plazo121', name: 'Plazo 121-180', color: '#0B132B' , type: 'bar'},
        { code: 'Plazo181', name: 'Plazo 181-360', color: '#D9A05B' , type: 'bar'},
        { code: 'Plazo361', name: 'Plazo +360', color: '#1e3a81' , type: 'bar'}
        
    ];
    
    // ✅ USAR FUNCIÓN GENÉRICA con ID de Hoja 4
    renderHistoricoEstructuraGenerico(
        'chartHistoricoMontoSegPas',  // ID del gráfico de Hoja 4
        seriesConfig,
        'Evolución Histórica - Monto de Operaciones Pasivas',
        'millones USD'
        
    );
}

function renderHistoricoNumSegPas () {
    const seriesConfig = [
        { code: 'OPTPE', name: 'Depósitos a Plazo', color: '#3b82f6', type: 'line'},
        { code: 'OPTPE30', name: 'Plazo 30-60', color: '#10b981', type: 'bar' },
        { code: 'OPTPE61', name: 'Plazo 61-90', color: '#f59e0b' , type: 'bar'},
        { code: 'OPTPE91', name: 'Plazo 91-120', color: '#20666B' , type: 'bar'},
        { code: 'OPTPE121', name: 'Plazo 121-180', color: '#0B132B' , type: 'bar'},
        { code: 'OPTPE181', name: 'Plazo 181-360', color: '#D9A05B' , type: 'bar'},
        { code: 'OPTPE361', name: 'Plazo +360', color: '#1e3a81' , type: 'bar'}
        
    ];
    
    // ✅ USAR FUNCIÓN GENÉRICA con ID de Hoja 4
    renderHistoricoEstructuraGenerico(
        'chartHistoricoNumSegPas',  // ID del gráfico de Hoja 4
        seriesConfig,
        'Evolución Histórica - Número de Operaciones',
        'número'
        
        
    );
}

// ✅ GRÁFICO DE BARRAS POR CUENTAS IMPRODUCTIVAS - USANDO FUNCIÓN GENÉRICA
function renderComposicionMontoSegPas() {
    const targetDate = `${currentYear}-${currentMonth}`;
    const prevMonthDate = getPreviousMonthDate(currentYear, currentMonth);
    const prevYearDate = subtractMonths(currentYear, currentMonth, 12);
    
    const cuentas = [
        { code: 'mop', name: 'Depósitos a Plazo'},
        { code: 'Plazo30', name: 'Plazo 30-60'},
        { code: 'Plazo61', name: 'Plazo 61-90'},
        { code: 'Plazo91', name: 'Plazo 91-120'},
        { code: 'Plazo121', name: 'Plazo 121-180'},
        { code: 'Plazo181', name: 'Plazo 181-360'},
        { code: 'Plazo361', name: 'Plazo +360'}
        
    ];
    
    // ✅ USAR FUNCIÓN GENÉRICA con ID de Hoja 4
    renderBarrasCuentasGenerico(
        'chartComposicionMontoSegPas',  // ID del gráfico de Hoja 4
        cuentas,
        targetDate,
        prevMonthDate,
        prevYearDate
    );
}

// ✅ GRÁFICO DE BARRAS - ACTIVOS IMPRODUCTIVOS NETOS (SB004) - USANDO FUNCIÓN GENÉRICA
function renderComposicionNumSegPas() {
    const targetDate = `${currentYear}-${currentMonth}`;
    const prevMonthDate = getPreviousMonthDate(currentYear, currentMonth);
    const prevYearDate = subtractMonths(currentYear, currentMonth, 12);
    
    const cuentas = [
        { code: 'OPTPE', name: 'Depósitos a Plazo'},
        { code: 'OPTPE30', name: 'Plazo 30-60'},
        { code: 'OPTPE61', name: 'Plazo 61-90'},
        { code: 'OPTPE91', name: 'Plazo 91-120'},
        { code: 'OPTPE121', name: 'Plazo 121-180'},
        { code: 'OPTPE181', name: 'Plazo 181-360'},
        { code: 'OPTPE361', name: 'Plazo +360'}
        
    ];
    
    // ✅ USAR FUNCIÓN GENÉRICA con ID de Hoja 4
    renderBarrasCuentasGenerico(
        'chartComposicionNumSegPas',  // ID del gráfico de Hoja 4
        cuentas,
        targetDate,
        prevMonthDate,
        prevYearDate
    );
}

async function updateKPIMiniSegPas(cucCode, kpiPrefix, targetDate) {
    const row = currentMagazineData.find(r => r.CUC === cucCode || r.Variable === cucCode);
    if (!row) return;
    
    const valCurrent = parseFloat(row[targetDate]) || 0;
    const prevMonthDate = getPreviousMonthDate(currentYear, currentMonth);
    const valPrevMonth = parseFloat(row[prevMonthDate]) || 0;
    
    const elValue = document.getElementById(`${kpiPrefix}-mini-value`);
    if (elValue) elValue.textContent = formatNumber(valCurrent);
    
    const allDateCols = Object.keys(currentMagazineData[0]).filter(k => /^\d{4}-\d{2}$/.test(k)).sort();
    const last6Months = allDateCols.slice(-6);
    
    const chartData = last6Months.map(d => parseFloat(row[d]) || 0);
    const chartLabels = last6Months.map(d => {
        const [y, m] = d.split('-');
        return monthsNames[parseInt(m)-1];
    });
    
    const codeMap = { 
        'pro_MOP': 'ProMop', 'pro_op30': 'ProOp30', 'pro_op61': 'ProOp61', 
        'pro_op91': 'ProOp91', 'pro_op121': 'ProOp121', 'pro_op181': 'ProOp181', 'pro_op361': 'ProOp361' 
    };
    const colorMap = { 
        'pro_MOP': '#3b82f6', 'pro_op30': '#60a5fa', 'pro_op61': '#93c5fd', 
        'pro_op91': '#1d4ed8', 'pro_op121': '#2563eb', 'pro_op181': '#1e3a8a', 'pro_op361': '#0ea5e9' 
    };
    
    const chartId = `chartMini${codeMap[cucCode]}`;
    const chartDom = document.getElementById(chartId);
    if (!chartDom) return;
    
    const chart = echarts.init(chartDom);
    const varMonthly = valPrevMonth !== 0 ? ((valCurrent - valPrevMonth) / Math.abs(valPrevMonth)) * 100 : 0;
    
    let trendClass = 'trend-stable', trendText = 'Estable', trendIcon = '→';
    if (varMonthly > 0.5) { trendClass = 'trend-up'; trendText = 'Subiendo'; trendIcon = '↑'; }
    else if (varMonthly < -0.5) { trendClass = 'trend-down'; trendText = 'Bajando'; trendIcon = '↓'; }
    
    const summaryEl = document.getElementById(`summary-${kpiPrefix.replace('kpi-', '')}`);
    if (summaryEl) {
        summaryEl.innerHTML = `<div>${trendIcon} <span class="${trendClass}">${trendText}</span></div>
            <div style="font-size: 8px; margin-top: 2px;">Mensual: <span class="${varMonthly > 0 ? 'trend-up' : varMonthly < 0 ? 'trend-down' : 'trend-stable'}">${varMonthly > 0 ? '+' : ''}${varMonthly.toFixed(1)}%</span></div>`;
    }
    
    chart.setOption({
        grid: { top: 10, bottom: 20, left: 5, right: 5 },
        xAxis: { type: 'category', data: chartLabels, axisLabel: { fontSize: 7, color: '#64748b' }, axisLine: { show: false }, axisTick: { show: false } },
        yAxis: { type: 'value', axisLabel: { show: false }, splitLine: { show: false } },
        series: [{
            type: 'bar', data: chartData,
            itemStyle: { color: colorMap[cucCode] || '#3b82f6', borderRadius: [3, 3, 0, 0] },
            label: { show: showChartLabels, position: 'top', fontSize: 7, color: '#64748b', formatter: (p) => formatNumber(p.value) },
            barWidth: '70%'
        }]
    });
}




// ✅ FUNCION PRINCIPAL PARA RENDERIZAR PÁGINA 8
async function renderSegPasivasPage() {
    const targetDate = `${currentYear}-${currentMonth}`;
    const prevYearDate = subtractMonths(currentYear, currentMonth, 12);
    
    updateKPIGenerico('mop', 'kpi-pasivas', targetDate, prevYearDate);
    updateKPIGenerico('OPTPE', 'kpi-operacionespas', targetDate, prevYearDate);
    updateKPIGenerico('pro_MOP', 'kpi-promediopas', targetDate, prevYearDate);

    
    await updateKPIMiniSegPas('pro_MOP', 'kpi-pro-mop', targetDate);
    await updateKPIMiniSegPas('pro_op30', 'kpi-pro-op30', targetDate);
    await updateKPIMiniSegPas('pro_op61', 'kpi-pro-op61', targetDate);
    await updateKPIMiniSegPas('pro_op91', 'kpi-pro-op91', targetDate);
    await updateKPIMiniSegPas('pro_op121', 'kpi-pro-op121', targetDate);
    await updateKPIMiniSegPas('pro_op181', 'kpi-pro-op181', targetDate);
    await updateKPIMiniSegPas('pro_op361', 'kpi-pro-op361', targetDate);
    
    renderHistoricoMontoSegPas();
    renderHistoricoNumSegPas();
    renderComposicionMontoSegPas();
    renderComposicionNumSegPas();
}

// ==========================================
// PÁGINA 23: FINAL DE LA HOJA 23
// ==========================================

// ==========================================
// PÁGINA 27: HOJA 27
// ==========================================

// ==========================================
// INDICADORES FINANCIEROS - HOJA 27
// ==========================================

let categoriaIndicadorActual = 'estructura';

// Configuración de indicadores por categoría
const CONFIG_INDICADORES = {
    estructura: {
        titulo: 'Estructura y Eficiencia',
        graficos: [
            { 
                id: 'chartIndicador1', 
                titulo: 'ACTIVOS IMPRODUCTIVOS NETOS / TOTAL ACTIVOS', 
                leftAxisName: 'porcentajes (%)',
                seriesConfig: [
                    { code: 'SB018A', name: 'Act. Imp. Netos', color: '#3b82f6', type: 'line'},
                                ]
            },
            
            { 
                id: 'chartIndicador2', 
                titulo: 'ACTIVOS PRODUCTIVOS / TOTAL ACTIVOS', 
                leftAxisName: 'porcentajes (%)',
                seriesConfig: [
                    { code: 'ac_prod_neto_acti', name: 'Act. Prod.', color: '#3b82f6', type: 'line'},
                                ]
            },

            { 
                id: 'chartIndicador3', 
                titulo: 'ACTIVOS PRODUCTIVOS / PASIVOS CON COSTO', 
                leftAxisName: 'porcentajes (%)',
                seriesConfig: [
                    { code: 'ac_prod_pco', name: 'Act. Prd/ PCC', color: '#3b82f6', type: 'line'},
                                ]
            },

            { 
                id: 'chartIndicador4', 
                titulo: 'GASTOS DE OPERACION ESTIMADOS / TOTAL ACTIVO PROMEDIO', 
                leftAxisName: 'porcentajes (%)',
                seriesConfig: [
                    { code: 'gast_oper_ac', name: 'Gastos Operación Estimada', color: '#10b981', type: 'line'},
                                ]
            },

            { 
                id: 'chartIndicador5', 
                titulo: 'GASTOS DE OPERACION  / MARGEN FINANCIERO', 
                leftAxisName: 'porcentajes (%)',
                seriesConfig: [
                    { code: 'gast_operacion', name: 'Gastos Operación', color: '#10b981', type: 'line'},
                                ]
            },

            { 
                id: 'chartIndicador6', 
                titulo: 'GASTOS DE PERSONAL ESTIMADOS / ACTIVO PROMEDIO', 
                leftAxisName: 'porcentajes (%)',
                seriesConfig: [
                    { code: 'gasto_personal', name: 'Gastos Personal Estimada', color: '#10b981', type: 'line'},
                                ]
            },

            { 
                id: 'chartIndicador7', 
                titulo: 'MARGEN DE INTERMEDIACIÓN ESTIMADO / PATRIMONIO PROMEDIO', 
                leftAxisName: 'porcentajes (%)',
                seriesConfig: [
                    { code: 'marg_int_pas', name: 'Mar. Int. Est./Patr.', color: '#1e3a81', type: 'line'},
                                ]
            },

            { 
                id: 'chartIndicador8', 
                titulo: 'MARGEN DE INTERMEDIACIÓN ESTIMADO / ACTIVO PROMEDIO', 
                leftAxisName: 'porcentajes (%)',
                seriesConfig: [
                    { code: 'marg_int_ac', name: 'Mar. Int. Est./Act.', color: '#1e3a81', type: 'line'},
                                ]
            },

            { 
                id: 'chartIndicador9', 
                titulo: 'FONDOS DISPONIBLES / TOTAL DEPOSITOS A CORTO PLAZO', 
                leftAxisName: 'porcentajes (%)',
                seriesConfig: [
                    { code: 'IF006', name: 'Liquidez', color: '#1e3a81', type: 'line'},
                                ]
            }
        ]
    },

    endeudamiento: {
        titulo: 'Morosidad - Cobertura - Rentabilidad',
        graficos: [
            { 
                id: 'chartIndicador1', 
                titulo: 'ÍNDICE DE MOROSIDAD', 
                leftAxisName: 'porcentajes (%)',
                seriesConfig: [
                    { code: 'IF012', name: 'Morosidad', color: '#3b82f6', type: 'line'},
                                ]
            },
            
            { 
                id: 'chartIndicador2', 
                titulo: 'COBERTURA DE LA CARTERA REFINANCIADA', 
                leftAxisName: 'porcentajes (%)',
                seriesConfig: [
                    { code: 'SB028', name: 'Cart. Refinanciada', color: '#3b82f6', type: 'line'},
                                ]
            },

            { 
                id: 'chartIndicador3', 
                titulo: 'CARTERA IMPRODUCTIVA DESCUBIERTA / (PATRIMONIO + RESULTADOS)', 
                leftAxisName: 'porcentajes (%)',
                seriesConfig: [
                    { code: 'SBP001', name: 'Cart. Imp. Descubierta', color: '#3b82f6', type: 'line'},
                                ]
            },

            { 
                id: 'chartIndicador4', 
                titulo: 'RESULTADOS DEL EJERCICIO / PATRIMONIO PROMEDIO', 
                leftAxisName: 'porcentajes (%)',
                seriesConfig: [
                    { code: 'IF004', name: 'ROE', color: '#10b981', type: 'line'},
                                ]
            },

            { 
                id: 'chartIndicador5', 
                titulo: 'RESULTADOS DEL EJERCICIO / ACTIVO PROMEDIO', 
                leftAxisName: 'porcentajes (%)',
                seriesConfig: [
                    { code: 'IF002', name: 'ROA', color: '#10b981', type: 'line'},
                                ]
            },

            { 
                id: 'chartIndicador6', 
                titulo: 'CARTERA BRUTA / (DEPOSITOS A LA VISTA + DEPOSITOS A PLAZO)', 
                leftAxisName: 'porcentajes (%)',
                seriesConfig: [
                    { code: 'Cart_Depo', name: 'Intermediación Financiera', color: '#10b981', type: 'line'},
                                ]
            },

            { 
                id: 'chartIndicador7', 
                titulo: 'RENDIMIENTO CARTERAS DE CRÉDITOS  REFINANCIADAS', 
                leftAxisName: 'porcentajes (%)',
                seriesConfig: [
                    { code: 'SB044', name: 'Cart. Refinanciada', color: '#1e3a81', type: 'line'},
                                ]
            },

            { 
                id: 'chartIndicador8', 
                titulo: 'RENDIMIENTO CARTERAS DE CRÉDITOS  REESTRUCTURADAS', 
                leftAxisName: 'porcentajes (%)',
                seriesConfig: [
                    { code: 'SB045', name: 'Cart. Reestructurada', color: '#1e3a81', type: 'line'},
                                ]
            },

            { 
                id: 'chartIndicador9', 
                titulo: 'RENDIMIENTO CARTERA POR VENCER TOTAL', 
                leftAxisName: 'porcentajes (%)',
                seriesConfig: [
                    { code: 'SB036', name: 'Cart. Vencer', color: '#1e3a81', type: 'line'},
                                ]
            }
        ]
    },

    cobertura: {
        titulo: 'Cobertura y  Morosidad por Cartera',
        graficos: [
            { 
                id: 'chartIndicador1', 
                titulo: 'ÍNDICE DE MOROSIDAD PRODUCITVO', 
                leftAxisName: 'porcentajes (%)',
                seriesConfig: [
                    { code: 'IF012_1', name: 'Morosidad Productivo', color: '#3b82f6', type: 'line'},
                                ]
            },
            
            { 
                id: 'chartIndicador2', 
                titulo: 'ÍNDICE DE MOROSIDAD CONSUMO', 
                leftAxisName: 'porcentajes (%)',
                seriesConfig: [
                    { code: 'IF012_2', name: 'Morosidad Consumo', color: '#3b82f6', type: 'line'},
                                ]
            },

            { 
                id: 'chartIndicador3', 
                titulo: 'ÍNDICE DE MOROSIDAD INMOBILIARIO', 
                leftAxisName: 'porcentajes (%)',
                seriesConfig: [
                    { code: 'IF012_3', name: 'Morosidad Inmobiliario', color: '#3b82f6', type: 'line'},
                                ]
            },

            { 
                id: 'chartIndicador4', 
                titulo: 'ÍNDICE DE MOROSIDAD MICROCRÉDITO', 
                leftAxisName: 'porcentajes (%)',
                seriesConfig: [
                    { code: 'IF012_4', name: 'Morosidad Microcrédito', color: '#10b981', type: 'line'},
                                ]
            },

            { 
                id: 'chartIndicador5', 
                titulo: 'COBERTURA PROVISIONES PRODUCTIVO', 
                leftAxisName: 'porcentajes (%)',
                seriesConfig: [
                    { code: 'SB029', name: 'Cober. Prod.', color: '#10b981', type: 'line'},
                                ]
            },

            { 
                id: 'chartIndicador6', 
                titulo: 'COBERTURA PROVISIONES CONSUMO', 
                leftAxisName: 'porcentajes (%)',
                seriesConfig: [
                    { code: 'SB030', name: 'Cober. Cons.', color: '#10b981', type: 'line'},
                                ]
            },

            { 
                id: 'chartIndicador7', 
                titulo: 'COBERTURA PROVISIONES INMOBILIARIO', 
                leftAxisName: 'porcentajes (%)',
                seriesConfig: [
                    { code: 'SB031', name: 'Cober. Inm.', color: '#1e3a81', type: 'line'},
                                ]
            },

            { 
                id: 'chartIndicador8', 
                titulo: 'COBERTURA PROVISIONES INMOBILIARIO', 
                leftAxisName: 'porcentajes (%)',
                seriesConfig: [
                    { code: 'SB032', name: 'Cober. Mic.', color: '#1e3a81', type: 'line'},
                                ]
            },

            { 
                id: 'chartIndicador9', 
                titulo: 'VULNERABILIDAD DEL PATRIMONIO', 
                leftAxisName: 'porcentajes (%)',
                seriesConfig: [
                    { code: 'SBP002', name: 'Vuln. Patr', color: '#1e3a81', type: 'line'},
                                ]
            }
        ]
    },

    roa: {
        titulo: 'Rendimientos',
        graficos: [
            { 
                id: 'chartIndicador1', 
                titulo: 'RENDIMIENTO CART. PROD.', 
                leftAxisName: 'porcentajes (%)',
                seriesConfig: [
                    { code: 'SB037', name: 'Rendi. Cart. Prod', color: '#3b82f6', type: 'line'},
                                ]
            },
            
            { 
                id: 'chartIndicador2', 
                titulo: 'RENDIMIENTO CART. CONSUMO.', 
                leftAxisName: 'porcentajes (%)',
                seriesConfig: [
                    { code: 'SB038', name: 'Rendi. Cart. Cons.', color: '#3b82f6', type: 'line'},
                                ]
            },

            { 
                id: 'chartIndicador3', 
                titulo: 'RENDIMIENTO CART. INMOBILIARIO', 
                leftAxisName: 'porcentajes (%)',
                seriesConfig: [
                    { code: 'SB039', name: 'Rendi. Cart. Inmobiliario', color: '#3b82f6', type: 'line'},
                                ]
            },

            { 
                id: 'chartIndicador4', 
                titulo: 'RENDIMIENTO CART. MICROCRÉDITO', 
                leftAxisName: 'porcentajes (%)',
                seriesConfig: [
                    { code: 'SB040', name: 'Rendi. Cart. Microcrédito', color: '#10b981', type: 'line'},
                                ]
            },

            { 
                id: 'chartIndicador5', 
                titulo: 'VULNERABILIDAD DEL PATRIMONIO', 
                leftAxisName: 'porcentajes (%)',
                seriesConfig: [
                    { code: 'SBP003', name: 'FK', color: '#10b981', type: 'line'},
                                ]
            },

            { 
                id: 'chartIndicador6', 
                titulo: 'VULNERABILIDAD DEL PATRIMONIO', 
                leftAxisName: 'porcentajes (%)',
                seriesConfig: [
                    { code: 'SB018B', name: 'FI', color: '#10b981', type: 'line'},
                                ]
            },

            { 
                id: 'chartIndicador7', 
                titulo: 'VULNERABILIDAD DEL PATRIMONIO', 
                leftAxisName: 'porcentajes (%)',
                seriesConfig: [
                    { code: 'SBP005', name: 'Índice de Capitalización', color: '#1e3a81', type: 'line'},
                                ]
            },

            { 
                id: 'chartIndicador8', 
                titulo: 'SUFICIENCIA PATRIMONIAL', 
                leftAxisName: 'porcentajes (%)',
                seriesConfig: [
                    { code: 'SB025', name: 'Sufi. Patr.', color: '#1e3a81', type: 'line'},
                                ]
            },

            { 
                id: 'chartIndicador9', 
                titulo: 'PATRIMONIO TÉCNICO', 
                leftAxisName: 'porcentajes (%)',
                seriesConfig: [
                    { code: 'SOLVENCIA', name: 'Patrimonio Técnico', color: '#1e3a81', type: 'line'},
                                ]
            }
        ]
    }
};

// Función principal para cambiar de categoría
function cambiarCategoriaIndicador(categoria) {
    // Actualizar categoría actual
    categoriaIndicadorActual = categoria;
    
    // Actualizar botones activos
    document.querySelectorAll('.indicador-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.categoria === categoria) {
            btn.classList.add('active');
        }
    });
    
    // Renderizar gráficos de la categoría seleccionada
    renderizarGraficosIndicadores(categoria);
}

// Función para renderizar todos los gráficos de una categoría usando TU función genérica
function renderizarGraficosIndicadores(categoria) {
    const config = CONFIG_INDICADORES[categoria];
    if (!config) return;
    
    // Iteramos sobre cada gráfico definido en la configuración
    config.graficos.forEach((grafico) => {
        // Opcional: Si tienes elementos HTML para los títulos, puedes actualizarlos así:
        // const tituloElement = document.getElementById(`titulo-grafico-${grafico.id}`);
        // if (tituloElement) tituloElement.textContent = grafico.titulo;
        
        // Aquí es donde usas TU función genérica profesional
        if (grafico.seriesConfig) {
            renderHistoricoEstructuraGenerico(
                grafico.id,
                grafico.seriesConfig,
                grafico.titulo || 'Indicador Financiero',
                grafico.leftAxisName || 'millones USD',
                grafico.rightAxisName || '%'
            );
        }
    });
}


// Función para actualizar cuando cambia la página activa
function renderIndicadoresPage() {
    if (categoriaIndicadorActual) {
        renderizarGraficosIndicadores(categoriaIndicadorActual);
    } else {
        // Por defecto mostrar estructura financiera
        cambiarCategoriaIndicador('estructura');
    }
}


// ==========================================
// PÁGINA 28: HOJA 28
// ==========================================

// ==========================================
// PÁGINA 28: INDICADORES DE EVALUACIÓN (CAMELS Y PERLAS)
// ==========================================

// ==========================================
// FUNCIÓN GENÉRICA PARA TABLAS DE INDICADORES
// (Variación en puntos porcentuales, no %)
// ==========================================
async function renderTablaIndicadoresGenerico(tableBodyId, headersConfig, indicadoresConfig, targetDate, prevMonthDate, prevYearDate) {
    if (!currentMagazineData) return;
    
    // Actualizar headers si existen
    if (headersConfig.mes1) {
        const th1 = document.getElementById(headersConfig.mes1);
        if (th1) th1.textContent = formatHeaderDate(prevYearDate);
    }
    if (headersConfig.mes2) {
        const th2 = document.getElementById(headersConfig.mes2);
        if (th2) th2.textContent = formatHeaderDate(prevMonthDate);
    }
    if (headersConfig.mes3) {
        const th3 = document.getElementById(headersConfig.mes3);
        if (th3) th3.textContent = formatHeaderDate(targetDate);
    }
    
    const tbody = document.getElementById(tableBodyId);
    if (!tbody) return;
    
    let html = '';
    
    indicadoresConfig.forEach(indicador => {
        const row = currentMagazineData.find(r => r.CUC === indicador.code || r.Variable === indicador.code);
        if (!row) return;
        
        const valCurrent = parseFloat(row[targetDate]) || 0;
        const valPrevMonth = parseFloat(row[prevMonthDate]) || 0;
        const valPrevYear = parseFloat(row[prevYearDate]) || 0;
        
        // DIFERENCIA: Variación en puntos porcentuales (diferencia simple)
        const varMonthly = valCurrent - valPrevMonth;
        const varAnnual = valCurrent - valPrevYear;
        
        const varMonthlyClass = varMonthly > 0 ? 'var-puntos-positiva' : varMonthly < 0 ? 'var-puntos-negativa' : '';
        const varAnnualClass = varAnnual > 0 ? 'var-puntos-positiva' : varAnnual < 0 ? 'var-puntos-negativa' : '';
        
        const varMonthlyIcon = varMonthly > 0 ? '▲' : varMonthly < 0 ? '▼' : '─';
        const varAnnualIcon = varAnnual > 0 ? '▲' : varAnnual < 0 ? '▼' : '─';
        
        html += `
            <tr class="nivel-${indicador.nivel || 1}">
                <td>${indicador.name}</td>
                <td>${indicador.meta || '-'}</td>
                <td>${formatNumber(valPrevYear)}</td>
                <td>${formatNumber(valPrevMonth)}</td>
                <td><strong>${formatNumber(valCurrent)}</strong></td>
                <td class="${varMonthlyClass}">${varMonthly.toFixed(2)} pp ${varMonthlyIcon}</td>
                <td class="${varAnnualClass}">${varAnnual.toFixed(2)} pp ${varAnnualIcon}</td>
            </tr>
        `;
    });
    
    tbody.innerHTML = html;
}

// ==========================================
// CÁLCULO DE CALIFICACIÓN CAMELS
// Basado en Índice de Vulnerabilidad Financiera (IVF_Cuantitativo)
// ==========================================
function calcularCalificacionCAMELS(ivfValue) {
    if (isNaN(ivfValue) || ivfValue === null) return { categoria: 'Sin dato', letra: 'E', class: 'calificacion-E' };
    
    let categoria, letra, cssClass;
    
    if (ivfValue >= 80) {
        categoria = "A - Excelente";
        letra = "A";
        cssClass = "calificacion-A";
    } else if (ivfValue >= 60) {
        categoria = "B - Muy Bueno";
        letra = "B";
        cssClass = "calificacion-B";
    } else if (ivfValue >= 50) {
        categoria = "C - Saludable";
        letra = "C";
        cssClass = "calificacion-C";
    } else if (ivfValue >= 40) {
        categoria = "D - Regular";
        letra = "D";
        cssClass = "calificacion-D";
    } else {
        categoria = "E - Alto Riesgo";
        letra = "E";
        cssClass = "calificacion-E";
    }
    
    return { categoria, letra, class: cssClass };
}

// ==========================================
// CÁLCULO DE CALIFICACIÓN PERLAS
// Basado en eficiencia PERLAS (efic_perlas_acum) - valor 0-100
// ==========================================
function calcularCalificacionPERLAS(eficienciaValue) {
    if (isNaN(eficienciaValue) || eficienciaValue === null) return { categoria: 'Sin dato', letra: 'E', class: 'calificacion-E' };
    
    let categoria, letra, cssClass;
    
    if (eficienciaValue >= 80) {
        categoria = "A - Excelente";
        letra = "A";
        cssClass = "calificacion-A";
    } else if (eficienciaValue >= 60) {
        categoria = "B - Muy Bueno";
        letra = "B";
        cssClass = "calificacion-B";
    } else if (eficienciaValue >= 50) {
        categoria = "C - Saludable";
        letra = "C";
        cssClass = "calificacion-C";
    } else if (eficienciaValue >= 40) {
        categoria = "D - Regular";
        letra = "D";
        cssClass = "calificacion-D";
    } else {
        categoria = "E - Alto Riesgo";
        letra = "E";
        cssClass = "calificacion-E";
    }
    
    return { categoria, letra, class: cssClass };
}

// ==========================================
// RENDERIZAR TABLA CAMELS
// ==========================================
async function renderTablaCAMELS() {
    if (!currentMagazineData) return;
    
    const targetDate = `${currentYear}-${currentMonth}`;
    const prevMonthDate = getPreviousMonthDate(currentYear, currentMonth);
    const prevYearDate = subtractMonths(currentYear, currentMonth, 12);
    
    // Configuración de indicadores CAMELS con CUC exactos
    const indicadoresCAMELS = [
        // SUFICIENCIA PATRIMONIAL (C)
        { code: 'C_1', name: 'COMPONENTE GLOBAL SUFICIENCIA PATRIMONIAL (C)', meta: '-', nivel: 1 },
        { code: 'C1_capit_neta', name: 'Capitalización Neta', meta: '-', nivel: 2 },
        { code: 'C2_Cobertura', name: 'Cobertura Patrimonial', meta: '-', nivel: 2 },
        { code: 'C3', name: 'Proporción de la cartera improductiva neta sobre capital regulatorio', meta: '-', nivel: 2 },
        
        // CALIDAD DE ACTIVOS (A)
        { code: 'A_1', name: 'COMPONENTE GLOBAL CALIDAD DE ACTIVOS (A)', meta: '-', nivel: 1 },
        { code: 'Porce_activ_impro', name: 'Porcentaje de activos improductivos', meta: '-', nivel: 2 },
        { code: 'A2_Inter_credi', name: 'Intermediación Crediticia', meta: '-', nivel: 2 },
        { code: 'A3_Calid_credi', name: 'Calidad de Créditos', meta: '-', nivel: 2 },
        { code: 'A4_Cober_credi', name: 'Cobertura Crediticia', meta: '-', nivel: 2 },
        
        // MANEJO ADMINISTRATIVO (M)
        { code: 'M_1', name: 'COMPONENTE GLOBAL MANEJO ADMINISTRATIVO (M)', meta: '-', nivel: 1 },
        { code: 'M1_Grado_absor_marge_finan', name: 'Grado de absorción del margen financiero', meta: '-', nivel: 2 },
        { code: 'Efici_opera', name: 'Eficiencia Operativa', meta: '-', nivel: 2 },
        { code: 'M3_des_estr', name: 'Manejo Administrativo', meta: '-', nivel: 2 },
        
        // RENTABILIDAD (E)
        { code: 'E_1', name: 'COMPONENTE GLOBAL RENTABILIDAD (E)', meta: '-', nivel: 1 },
        { code: 'E1_ROA', name: 'Rentabilidad sobre Activos (ROA)', meta: '-', nivel: 2 },
        { code: 'E4_ROE', name: 'Rentabilidad sobre Patrimonio (ROE)', meta: '-', nivel: 2 },
        { code: 'Efici_negoc', name: 'Eficiencia del negocio', meta: '-', nivel: 2 },
        { code: 'E6_Margen_Spread', name: 'Margen spread tasas', meta: '-', nivel: 2 },
        
        // LIQUIDEZ (L)
        { code: 'L_1', name: 'COMPONENTE GLOBAL LIQUIDEZ (L)', meta: '-', nivel: 1 },
        { code: 'Indic_liqui', name: 'Índice de Liquidez', meta: '-', nivel: 2 },
        { code: 'L2_moderado', name: 'Índice de Liquidez ampliada', meta: '-', nivel: 2 },
        { code: 'L3_severo', name: 'Índice de Liquidez ajustado', meta: '-', nivel: 2 },
        { code: 'L4_liquidez', name: 'Porcentaje de activos líquidos', meta: '-', nivel: 2 },
        
        // RIESGO MERCADO
        { code: 'Tasa_inter_impli', name: 'TASA DE INTERÉS IMPLICITA', meta: '-', nivel: 1 },
        
        // INDICADORES GLOBALES
        { code: 'Indic_CAMELS_1', name: 'INDICADOR CAMELS', meta: '-', nivel: 1 },
        { code: 'SOLVENCIA', name: 'Patrimonio Técnico', meta: '-', nivel: 1 },
        { code: 'IVF_Cuantitativo', name: 'ÍNDICE DE VULNERABILIDAD FINANCIERA', meta: '-', nivel: 1 }
    ];
    
    await renderTablaIndicadoresGenerico(
        'camelsTableBody',
        { mes1: 'th-camels-mes1', mes2: 'th-camels-mes2', mes3: 'th-camels-mes3' },
        indicadoresCAMELS,
        targetDate,
        prevMonthDate,
        prevYearDate
    );
    
    // Calcular y mostrar calificación basada en IVF_Cuantitativo
    await calcularYMostrarCalificacionCAMELS(targetDate, prevMonthDate, prevYearDate);
}

// ==========================================
// CALCULAR Y MOSTRAR CALIFICACIÓN CAMELS
// ==========================================
async function calcularYMostrarCalificacionCAMELS(targetDate, prevMonthDate, prevYearDate) {
    // Obtener el valor del Índice de Vulnerabilidad Financiera (IVF_Cuantitativo)
    const ivfRow = currentMagazineData.find(r => r.CUC === 'Indic_CAMELS_1' || r.Variable === 'Indic_CAMELS_1');
    
    if (!ivfRow) {
        console.warn('No se encontró IVF_Cuantitativo en los datos');
        return;
    }
    
    const ivfCurrent = parseFloat(ivfRow[targetDate]) || 0;
    const ivfPrevMonth = parseFloat(ivfRow[prevMonthDate]) || 0;
    const ivfPrevYear = parseFloat(ivfRow[prevYearDate]) || 0;
    
    // Calcular calificaciones
    const calCurrent = calcularCalificacionCAMELS(ivfCurrent);
    const calPrevMonth = calcularCalificacionCAMELS(ivfPrevMonth);
    const calPrevYear = calcularCalificacionCAMELS(ivfPrevYear);
    
    // Actualizar círculos de calificación
    actualizarCirculosCalificacion('camels-rating-current', calCurrent);
    actualizarCirculosCalificacion('camels-rating-prevmonth', calPrevMonth);
    actualizarCirculosCalificacion('camels-rating-prevyear', calPrevYear);
    
    // Mostrar valores de IVF
    const ivfCurrentEl = document.getElementById('camels-ivf-current');
    const ivfPrevMonthEl = document.getElementById('camels-ivf-prevmonth');
    const ivfPrevYearEl = document.getElementById('camels-ivf-prevyear');
    
    if (ivfCurrentEl) ivfCurrentEl.textContent = ivfCurrent.toFixed(2) + '%';
    if (ivfPrevMonthEl) ivfPrevMonthEl.textContent = ivfPrevMonth.toFixed(2) + '%';
    if (ivfPrevYearEl) ivfPrevYearEl.textContent = ivfPrevYear.toFixed(2) + '%';
}

// ==========================================
// RENDERIZAR TABLA PERLAS
// ==========================================
async function renderTablaPERLAS() {
    if (!currentMagazineData) return;
    
    const targetDate = `${currentYear}-${currentMonth}`;
    const prevMonthDate = getPreviousMonthDate(currentYear, currentMonth);
    const prevYearDate = subtractMonths(currentYear, currentMonth, 12);
    
    // Configuración de indicadores PERLAS con CUC exactos
    const indicadoresPERLAS = [
        // RIESGO A (Riesgo Crítico)
        { code: 'efic_RA_AC', name: 'RIESGO A (Riesgo Crítico)', meta: '50%', nivel: 1 },
        { code: 'S_P1_acum', name: 'Cobertura saldos morosos > 1 año', meta: '100% Mínimo', nivel: 2 },
        { code: 'S_E9_acum', name: 'Capital Institucional', meta: '10% Mínimo', nivel: 2 },
        { code: 'S_L1_acum', name: 'Liquidez', meta: '15 - 20%', nivel: 2 },
        { code: 'S_A1_acum', name: 'Morosidad', meta: '5% Máximo', nivel: 2 },
        { code: 'S_A2_acum', name: 'Activos Improductivos', meta: '5% Máximo', nivel: 2 },
        
        // RIESGO B (Alto Riesgo)
        { code: 'efic_RB_AC', name: 'RIESGO B (Alto Riesgo)', meta: '30%', nivel: 1 },
        { code: 'S_P2_acum', name: 'Cobertura saldos morosos < 1 año', meta: '35% Mínimo', nivel: 2 },
        { code: 'S_P6_acum', name: 'Solvencia', meta: '9% Mínimo', nivel: 2 },
        { code: 'S_E6_acum', name: 'Endeudamiento Externo', meta: '5% Máximo', nivel: 2 },
        { code: 'S_S2_acum', name: 'Crecimiento inversiones', meta: '16% Máximo', nivel: 2 },
        { code: 'S_R9_acum', name: 'Gastos Operativos', meta: '5% Máximo', nivel: 2 },
        
        // RIESGO C (Riesgo Medio)
        { code: 'efic_RC_AC', name: 'RIESGO C (Riesgo Medio)', meta: '20%', nivel: 1 },
        { code: 'S_E1_acum', name: 'Cartera de Créditos vs Activos', meta: '70 - 80%', nivel: 2 },
        { code: 'S_E3_acum', name: 'Inversiones Financieras', meta: '12% Mínimo', nivel: 2 },
        { code: 'S_E5_acum', name: 'Captaciones de Ahorro vs Activos', meta: '70 - 80%', nivel: 2 },
        { code: 'S_E7_acum', name: 'Aportaciones socios vs activos', meta: '4% Mínimo', nivel: 2 },
        { code: 'S_S9_acum', name: 'Crecimiento de Activos', meta: 'Mas que Inflación', nivel: 2 },
        
        // INDICADORES GLOBALES
        { code: 'perlas_acumulado', name: 'puntaje PERLAS alcanzado', meta: '-', nivel: 1 },
        { code: 'efic_perlas_acum', name: 'EFICIENCIA GLOBAL EN PERLAS', meta: '-', nivel: 1 }
    ];
    
    await renderTablaIndicadoresGenerico(
        'perlasTableBody',
        { mes1: 'th-perlas-mes1', mes2: 'th-perlas-mes2', mes3: 'th-perlas-mes3' },
        indicadoresPERLAS,
        targetDate,
        prevMonthDate,
        prevYearDate
    );
    
    // Calcular y mostrar calificación PERLAS basada en efic_perlas_acum
    await calcularYMostrarCalificacionPERLAS(targetDate, prevMonthDate, prevYearDate);
}

// ==========================================
// CALCULAR Y MOSTRAR CALIFICACIÓN PERLAS
// ==========================================
async function calcularYMostrarCalificacionPERLAS(targetDate, prevMonthDate, prevYearDate) {
    // Obtener el valor de eficiencia PERLAS (efic_perlas_acum)
    const perlasRow = currentMagazineData.find(r => r.CUC === 'efic_perlas_acum' || r.Variable === 'efic_perlas_acum');
    
    if (!perlasRow) {
        console.warn('No se encontró efic_perlas_acum en los datos');
        return;
    }
    
    // Los valores ya vienen en porcentaje (0-100)
    const perlasCurrent = parseFloat(perlasRow[targetDate]) || 0;
    const perlasPrevMonth = parseFloat(perlasRow[prevMonthDate]) || 0;
    const perlasPrevYear = parseFloat(perlasRow[prevYearDate]) || 0;
    
    // Calcular calificaciones
    const calCurrent = calcularCalificacionPERLAS(perlasCurrent);
    const calPrevMonth = calcularCalificacionPERLAS(perlasPrevMonth);
    const calPrevYear = calcularCalificacionPERLAS(perlasPrevYear);
    
    // Actualizar círculos de calificación PERLAS
    actualizarCirculosCalificacion('perlas-rating-current', calCurrent);
    actualizarCirculosCalificacion('perlas-rating-prevmonth', calPrevMonth);
    actualizarCirculosCalificacion('perlas-rating-prevyear', calPrevYear);
    
    // Mostrar valores de eficiencia PERLAS
    const perlasCurrentEl = document.getElementById('perlas-efic-current');
    const perlasPrevMonthEl = document.getElementById('perlas-efic-prevmonth');
    const perlasPrevYearEl = document.getElementById('perlas-efic-prevyear');
    
    if (perlasCurrentEl) perlasCurrentEl.textContent = perlasCurrent.toFixed(2) + '%';
    if (perlasPrevMonthEl) perlasPrevMonthEl.textContent = perlasPrevMonth.toFixed(2) + '%';
    if (perlasPrevYearEl) perlasPrevYearEl.textContent = perlasPrevYear.toFixed(2) + '%';
    
    // Mostrar puntaje PERLAS acumulado
    const perlasAcumRow = currentMagazineData.find(r => r.CUC === 'perlas_acumulado' || r.Variable === 'perlas_acumulado');
    if (perlasAcumRow) {
        const perlasAcumCurrent = parseFloat(perlasAcumRow[targetDate]) || 0;
        const perlasAcumPrevMonth = parseFloat(perlasAcumRow[prevMonthDate]) || 0;
        const perlasAcumPrevYear = parseFloat(perlasAcumRow[prevYearDate]) || 0;
        
        const perlasAcumCurrentEl = document.getElementById('perlas-acum-current');
        const perlasAcumPrevMonthEl = document.getElementById('perlas-acum-prevmonth');
        const perlasAcumPrevYearEl = document.getElementById('perlas-acum-prevyear');
        
        if (perlasAcumCurrentEl) perlasAcumCurrentEl.textContent = perlasAcumCurrent.toFixed(2);
        if (perlasAcumPrevMonthEl) perlasAcumPrevMonthEl.textContent = perlasAcumPrevMonth.toFixed(2);
        if (perlasAcumPrevYearEl) perlasAcumPrevYearEl.textContent = perlasAcumPrevYear.toFixed(2);
    }
}

// ==========================================
// ACTUALIZAR CÍRCULOS DE CALIFICACIÓN
// ==========================================
function actualizarCirculosCalificacion(elementId, calificacion) {
    const element = document.getElementById(elementId);
    if (!element) return;
    
    element.textContent = calificacion.letra;
    element.className = `rating-circle ${calificacion.class}`;
    element.title = calificacion.categoria;
}

// ==========================================
// CAMBIAR ENTRE INDICADORES (CAMELS/PERLAS)
// ==========================================
// ✅ FUNCIÓN PARA RENDERIZAR GRÁFICOS DE CAMELS
function renderChartCamels() {
    const seriesConfigCapital = [
        { code: 'Indic_CAMELS_1', name: 'Indicador CAMELS (%)', color: '#3b82f6', type: 'line' },
        { code: 'IVF_Cuantitativo', name: 'Índice de Vulnerabilidad Financiera (%)', color: '#ef4444', type: 'line' }
    ];
    renderHistoricoEstructuraGenerico('chartCamels', seriesConfigCapital, 'CAMELS', 'porcentaje');
    
    // Forzar resize después de un pequeño delay para asegurar que el contenedor visible tenga dimensiones
    setTimeout(() => {
        const chart = echarts.getInstanceByDom(document.getElementById('chartCamels'));
        if (chart) chart.resize();
    }, 100);
}

// ✅ FUNCIÓN PARA RENDERIZAR GRÁFICOS DE PERLAS
function renderChartPerlas() {
    const seriesConfigRentabilidad = [
        { code: 'efic_perlas_acum', name: 'Eficiencia PERLAS (%)', color: '#8b5cf6', type: 'line', yAxisIndex: 0 },
        { code: 'efic_RA_AC', name: 'Riesgo A (%)', color: '#10b981', type: 'line', yAxisIndex: 1 },
        { code: 'efic_RB_AC', name: 'Riesgo B (%)', color: '#f59e0b', type: 'line', yAxisIndex: 1 },
        { code: 'efic_RC_AC', name: 'Riesgo C (%)', color: '#0B132B', type: 'line', yAxisIndex: 1 }
    ];
    renderHistoricoEstructuraGenerico('chartPerlas', seriesConfigRentabilidad, 'PERLAS', '%', '%');
    
    // Forzar resize después de un pequeño delay
    setTimeout(() => {
        const chart = echarts.getInstanceByDom(document.getElementById('chartPerlas'));
        if (chart) chart.resize();
    }, 100);
}

// ✅ FUNCIÓN PRINCIPAL DE RENDERIZADO DE LA PÁGINA 28
async function renderPage28() {
    // ✅ Renderizar tablas
    await renderTablaCAMELS();
    await renderTablaPERLAS();
    
    // ✅ Renderizar gráficos de la pestaña activa
    const camelsContent = document.getElementById('camels-content');
    if (camelsContent && camelsContent.classList.contains('active')) {
        renderChartCamels();
    } else {
        renderChartPerlas();
    }
}

// ✅ FUNCIÓN PARA CAMBIAR ENTRE PESTAÑAS (CAMELS / PERLAS)
function switchIndicator(indicator) {
    // 1. Ocultar todos los contenidos y desactivar botones
    document.querySelectorAll('.indicator-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.btn-indicator').forEach(el => el.classList.remove('active'));
    
    // 2. Mostrar el contenido seleccionado y activar el botón
    const contentEl = document.getElementById(`${indicator}-content`);
    if (contentEl) contentEl.classList.add('active');
    
    const btnEl = document.querySelector(`[data-indicator="${indicator}"]`);
    if (btnEl) btnEl.classList.add('active');
    
    // 3. Renderizar los gráficos después de que el navegador haya pintado el cambio de display
    // requestAnimationFrame + setTimeout garantiza que el contenedor tenga dimensiones > 0
    requestAnimationFrame(() => {
        setTimeout(() => {
            if (indicator === 'camels') {
                renderChartCamels();
            } else if (indicator === 'perlas') {
                renderChartPerlas();
            }
        }, 50);
    });
}

// ==========================================
// INTEGRAR EN updateMagazineContent
// ==========================================
// Agregar en la función updateMagazineContent existente:
/*
renderPagina28();
*/

// ==========================================
// INTEGRAR EN goToPage (si usas navegación)
// ==========================================
// Agregar en la función goToPage existente:
/*
else if (pageNum === 28) {
    await renderPagina28();
}
*/

// ==========================================
// FINAL PAGINA 28
// ==========================================


// ==========================================
//  PAGINA 29
// ==========================================


let categoriaIndicadorActual29 = 'estructura';

// Configuración de indicadores por categoría
const CONFIG_INDICADORES_29 = {
    estructura: {
        titulo: 'Estructura y Eficiencia',
        graficos: [
            { 
                id: 'chartInd29_1', 
                titulo: 'SUFICIENCIA PATRIMONIAL (C)', 
                leftAxisName: 'porcentajes (%)',
                seriesConfig: [
                    { code: 'C1_1', name: 'SUFICIENCIA PATRIMONIAL (C)', color: '#3b82f6', type: 'line'},
                                ]
            },
            
            { 
                id: 'chartInd29_2', 
                titulo: 'Capitalización Neta', 
                leftAxisName: 'porcentajes (%)',
                seriesConfig: [
                    { code: 'C1_capit_neta', name: 'Capitalización Neta', color: '#3b82f6', type: 'line'},
                                ]
            },

            { 
                id: 'chartInd29_3', 
                titulo: 'Cobertura Patrimonial', 
                leftAxisName: 'porcentajes (%)',
                seriesConfig: [
                    { code: 'C2_Cobertura', name: 'Cobertura Patrimonial', color: '#3b82f6', type: 'line'},
                                ]
            },

            { 
                id: 'chartInd29_4', 
                titulo: 'Cartera improductiva neta sobre capital regulatorio', 
                leftAxisName: 'porcentajes (%)',
                seriesConfig: [
                    { code: 'C3', name: 'Cartera improductiva neta sobre capital regulatorio', color: '#10b981', type: 'line'},
                                ]
            }
        ]
    },

    liquidez: {
        titulo: 'CALIDAD DE ACTIVOS (A)',
        graficos: [
            { 
                id: 'chartInd29_1', 
                titulo: 'CALIDAD DE ACTIVOS (A)', 
                leftAxisName: 'porcentajes (%)',
                seriesConfig: [
                    { code: 'A1_1', name: 'CALIDAD DE ACTIVOS (A)', color: '#3b82f6', type: 'line'},
                                ]
            },
            
            { 
                id: 'chartInd29_2', 
                titulo: 'Porcentaje de activos improductivos', 
                leftAxisName: 'porcentajes (%)',
                seriesConfig: [
                    { code: 'Porce_activ_impro', name: 'Porcentaje de activos improductivos', color: '#3b82f6', type: 'line'},
                                ]
            },

            { 
                id: 'chartInd29_3', 
                titulo: 'Intermediación Crediticia', 
                leftAxisName: 'porcentajes (%)',
                seriesConfig: [
                    { code: 'A2_Inter_credi', name: 'Intermediación Crediticia', color: '#3b82f6', type: 'line'},
                                ]
            },

            { 
                id: 'chartInd29_4', 
                titulo: 'Calidad de Créditos', 
                leftAxisName: 'porcentajes (%)',
                seriesConfig: [
                    { code: 'A3_Calid_credi', name: 'Calidad de Créditos', color: '#10b981', type: 'line'},
                                ]
            },

            { 
                id: 'chartInd29_5', 
                titulo: 'Cobertura Crediticia', 
                leftAxisName: 'porcentajes (%)',
                seriesConfig: [
                    { code: 'A4_Cober_credi', name: 'Cobertura Crediticia', color: '#10b981', type: 'line'},
                                ]
            }
        ]
    },

    solvencia: {
        titulo: 'CAMELS: MANEJO ADMINISTRATIVO (M)',
        graficos: [
            { 
                id: 'chartInd29_1', 
                titulo: 'MANEJO ADMINISTRATIVO (M)', 
                leftAxisName: 'porcentajes (%)',
                seriesConfig: [
                    { code: 'M1_1', name: 'MANEJO ADMINISTRATIVO (M)', color: '#3b82f6', type: 'line'},
                                ]
            },
            
            { 
                id: 'chartInd29_2', 
                titulo: 'Grado de absorción del margen financiero', 
                leftAxisName: 'porcentajes (%)',
                seriesConfig: [
                    { code: 'M1_Grado_absor_marge_finan', name: 'Grado de absorción del margen financiero', color: '#3b82f6', type: 'line'},
                                ]
            },

            { 
                id: 'chartInd29_3', 
                titulo: 'Eficiencia Operativa', 
                leftAxisName: 'porcentajes (%)',
                seriesConfig: [
                    { code: 'Efici_opera', name: 'Eficiencia Operativa', color: '#3b82f6', type: 'line'},
                                ]
            },

            { 
                id: 'chartInd29_4', 
                titulo: 'Manejo Administrativo', 
                leftAxisName: 'porcentajes (%)',
                seriesConfig: [
                    { code: 'M3_des_estr', name: 'Manejo Administrativo', color: '#10b981', type: 'line'},
                                ]
            }
        ]
    },

    endeudamiento: {
        titulo: 'CAMELS: RENTABILIDAD (E)',
        graficos: [
            { 
                id: 'chartInd29_1', 
                titulo: 'RENTABILIDAD (E)', 
                leftAxisName: 'porcentajes (%)',
                seriesConfig: [
                    { code: 'E1_1', name: 'RENTABILIDAD (E)', color: '#3b82f6', type: 'line'},
                                ]
            },
            
            { 
                id: 'chartInd29_2', 
                titulo: 'Rentabilidad sobre Activos (ROA)', 
                leftAxisName: 'porcentajes (%)',
                seriesConfig: [
                    { code: 'E1_ROA', name: 'Rentabilidad sobre Activos (ROA)', color: '#3b82f6', type: 'line'},
                                ]
            },

            { 
                id: 'chartInd29_3', 
                titulo: 'Rentabilidad sobre Patrimonio (ROE)', 
                leftAxisName: 'porcentajes (%)',
                seriesConfig: [
                    { code: 'E4_ROE', name: 'Rentabilidad sobre Patrimonio (ROE)', color: '#3b82f6', type: 'line'},
                                ]
            },

            { 
                id: 'chartInd29_4', 
                titulo: 'Eficiencia del negocio', 
                leftAxisName: 'porcentajes (%)',
                seriesConfig: [
                    { code: 'Efici_negoc', name: 'Eficiencia del negocio', color: '#10b981', type: 'line'},
                                ]
            },

            { 
                id: 'chartInd29_5', 
                titulo: 'Margen spread tasas', 
                leftAxisName: 'porcentajes (%)',
                seriesConfig: [
                    { code: 'E6_Margen_Spread', name: 'Margen spread tasas', color: '#10b981', type: 'line'},
                                ]
            }
        ]
    },

    cobertura: {
        titulo: 'CAMELS: LIQUIDEZ (L) Y RIESGO DE MERCADO (S)',
        graficos: [
            { 
                id: 'chartInd29_1', 
                titulo: 'LIQUIDEZ (L)', 
                leftAxisName: 'porcentajes (%)',
                seriesConfig: [
                    { code: 'L1_1', name: 'LIQUIDEZ (L)', color: '#3b82f6', type: 'line'},
                                ]
            },
            
            { 
                id: 'chartInd29_2', 
                titulo: 'Índice de Liquidez', 
                leftAxisName: 'porcentajes (%)',
                seriesConfig: [
                    { code: 'Indic_liqui', name: 'Índice de Liquidez', color: '#3b82f6', type: 'line'},
                                ]
            },

            { 
                id: 'chartInd29_3', 
                titulo: 'Índice de Liquidez ampliada', 
                leftAxisName: 'porcentajes (%)',
                seriesConfig: [
                    { code: 'L2_moderado', name: 'Índice de Liquidez ampliada', color: '#3b82f6', type: 'line'},
                                ]
            },

            { 
                id: 'chartInd29_4', 
                titulo: 'Índice de Liquidez ajustado', 
                leftAxisName: 'porcentajes (%)',
                seriesConfig: [
                    { code: 'L3_severo', name: 'Índice de Liquidez ajustado', color: '#10b981', type: 'line'},
                                ]
            },

            { 
                id: 'chartInd29_5', 
                titulo: 'Porcentaje de activos líquidos', 
                leftAxisName: 'porcentajes (%)',
                seriesConfig: [
                    { code: 'L4_liquidez', name: 'Porcentaje de activos líquidos', color: '#10b981', type: 'line'},
                                ]
            },

            { 
                id: 'chartInd29_6', 
                titulo: 'TASA DE INTERÉS IMPLICITA (S)', 
                leftAxisName: 'porcentajes (%)',
                seriesConfig: [
                    { code: 'Tasa_inter_impli', name: 'TASA DE INTERÉS IMPLICITA (S)', color: '#10b981', type: 'line'},
                                ]
            }
        ]
    },

    maniobra: {
        titulo: 'PERLAS: PROTECCIÓN (P)',
        graficos: [
            { 
                id: 'chartInd29_1', 
                titulo: 'P1: Provisiones Cuentas Incobrables > 12', 
                leftAxisName: 'porcentajes (%)',
                seriesConfig: [
                    { code: 'P1_Provisiones', name: 'P1: Provisiones Cuentas Incobrables > 12', color: '#3b82f6', type: 'line'},
                                ]
            },
            
            { 
                id: 'chartInd29_2', 
                titulo: 'P2: Provisiones Cuentas Incobrables < 12', 
                leftAxisName: 'porcentajes (%)',
                seriesConfig: [
                    { code: 'P2_Provisiones', name: 'P2: Provisiones Cuentas Incobrables < 12', color: '#3b82f6', type: 'line'},
                                ]
            },

            { 
                id: 'chartInd29_3', 
                titulo: 'P4: Préstamos Castigados (Promedios móviles de 12 meses)', 
                leftAxisName: 'porcentajes (%)',
                seriesConfig: [
                    { code: 'P4_Castigados', name: 'P4: Préstamos Castigados (Promedios móviles de 12 meses)', color: '#3b82f6', type: 'line'},
                                ]
            },

            { 
                id: 'chartInd29_4', 
                titulo: 'P6: Solvencia', 
                leftAxisName: 'porcentajes (%)',
                seriesConfig: [
                    { code: 'P6_Solvencia', name: 'P6: Solvencia', color: '#10b981', type: 'line'},
                                ]
            }
        ]
    },

    roa: {
        titulo: 'PERLAS: ESTRUCTURA FINANCIERA EFICAZ (E)',
        graficos: [
            { 
                id: 'chartInd29_1', 
                titulo: 'E1: Cartera Neta', 
                leftAxisName: 'porcentajes (%)',
                seriesConfig: [
                    { code: 'E1_Cartera', name: 'E1: Cartera Neta', color: '#3b82f6', type: 'line'},
                                ]
            },
            
            { 
                id: 'chartInd29_2', 
                titulo: 'E2: Inversiones Líquidas', 
                leftAxisName: 'porcentajes (%)',
                seriesConfig: [
                    { code: 'E2_Inversiones', name: 'E2: Inversiones Líquidas', color: '#3b82f6', type: 'line'},
                                ]
            },

            { 
                id: 'chartInd29_3', 
                titulo: 'E3: Inversiones Financieras', 
                leftAxisName: 'porcentajes (%)',
                seriesConfig: [
                    { code: 'E3_Inversiones', name: 'E3: Inversiones Financieras', color: '#3b82f6', type: 'line'},
                                ]
            },

            { 
                id: 'chartInd29_4', 
                titulo: 'E4: Inversiones No Financieras', 
                leftAxisName: 'porcentajes (%)',
                seriesConfig: [
                    { code: 'E4_INNF', name: 'E4: Inversiones No Financieras', color: '#10b981', type: 'line'},
                                ]
            },

            { 
                id: 'chartInd29_5', 
                titulo: 'E5: Depósitos de Ahorro', 
                leftAxisName: 'porcentajes (%)',
                seriesConfig: [
                    { code: 'E5_Depo_Aho', name: 'E5: Depósitos de Ahorro', color: '#10b981', type: 'line'},
                                ]
            },

            { 
                id: 'chartInd29_6', 
                titulo: 'E6: Créditos Exterior', 
                leftAxisName: 'porcentajes (%)',
                seriesConfig: [
                    { code: 'E6_Cre_Exte', name: 'E6: Créditos Exterior', color: '#10b981', type: 'line'},
                                ]
            },

            { 
                id: 'chartInd29_7', 
                titulo: 'E7: Aporte Socios', 
                leftAxisName: 'porcentajes (%)',
                seriesConfig: [
                    { code: 'E7_Aporte', name: 'E7: Aporte Socios', color: '#10b981', type: 'line'},
                                ]
            },

            { 
                id: 'chartInd29_8', 
                titulo: 'E8: Capital', 
                leftAxisName: 'porcentajes (%)',
                seriesConfig: [
                    { code: 'E8_Capital', name: 'E8: Capital', color: '#10b981', type: 'line'},
                                ]
            },

            { 
                id: 'chartInd29_9', 
                titulo: 'E9: Capital Neto', 
                leftAxisName: 'porcentajes (%)',
                seriesConfig: [
                    { code: 'E9_Capital_Neto', name: 'E9: Capital Neto', color: '#10b981', type: 'line'},
                                ]
            }
        ]
    },

    apalancamiento: {
        titulo: 'PERLAS: TASA DE RENDIMIENTOS Y COSTO (R)',
        graficos: [
            { 
                id: 'chartInd29_1', 
                titulo: 'R1: Cartera Préstamos', 
                leftAxisName: 'porcentajes (%)',
                seriesConfig: [
                    { code: 'R1_Cartera', name: 'R1: Cartera Préstamos', color: '#3b82f6', type: 'line'},
                                ]
            },
            
            { 
                id: 'chartInd29_2', 
                titulo: 'R2: Inversiones inversiones lioquidas', 
                leftAxisName: 'porcentajes (%)',
                seriesConfig: [
                    { code: 'R2_Inve_Liqu', name: 'R2: Inversiones inversiones lioquidas', color: '#3b82f6', type: 'line'},
                                ]
            },

            { 
                id: 'chartInd29_3', 
                titulo: 'R5: Costo financiero: intereses sobre depósitos de ahorro / Promedio de depósitos de ahorro', 
                leftAxisName: 'porcentajes (%)',
                seriesConfig: [
                    { code: 'R5_C_fina_DA', name: 'R5: Costo financiero', color: '#3b82f6', type: 'line'},
                                ]
            },

            { 
                id: 'chartInd29_4', 
                titulo: 'R6. Costo financiero: intereses sobre el crédito externo / Promedio de crédito externo', 
                leftAxisName: 'porcentajes (%)',
                seriesConfig: [
                    { code: 'R6_In_crex', name: 'R6. Costo financiero', color: '#10b981', type: 'line'},
                                ]
            },

            { 
                id: 'chartInd29_5', 
                titulo: 'R8. Margen bruto / Promedio de activo total', 
                leftAxisName: 'porcentajes (%)',
                seriesConfig: [
                    { code: 'R8_Marg', name: 'R8. Margen bruto / Promedio de activo total', color: '#10b981', type: 'line'},
                                ]
            },

            { 
                id: 'chartInd29_6', 
                titulo: 'R9: Gastos de Operación', 
                leftAxisName: 'porcentajes (%)',
                seriesConfig: [
                    { code: 'R9_Gas_Oper', name: 'R9: Gastos de Operación', color: '#10b981', type: 'line'},
                                ]
            },

            { 
                id: 'chartInd29_7', 
                titulo: 'R10. Provisiones para préstamos incobrables / Promedio de activo total', 
                leftAxisName: 'porcentajes (%)',
                seriesConfig: [
                    { code: 'R10_Pr_Inc', name: 'R10. Provisiones para préstamos incobrables / Promedio de activo total', color: '#10b981', type: 'line'},
                                ]
            },

            { 
                id: 'chartInd29_8', 
                titulo: 'R11: Ingresos y Gastos extraordinarios', 
                leftAxisName: 'porcentajes (%)',
                seriesConfig: [
                    { code: 'R11_IngEx', name: 'R11: Ingresos extraordinarios', color: '#10b981', type: 'line'},
                    { code: 'R11_GasEx', name: 'R11: Gastos extraordinarios', color: '#D9A05B', type: 'line'},
                                ]
            },

            { 
                id: 'chartInd29_9', 
                titulo: 'R12: ROA y ROE', 
                leftAxisName: 'porcentajes (%)',
                seriesConfig: [
                    { code: 'R12_ROA', name: 'R12: ROA', color: '#10b981', type: 'line'},
                    { code: 'R13_ROE', name: 'R13: ROE', color: '#D9A05B', type: 'line'},
                                ]
            }
        ]
    },

    activo: {
        titulo: 'PERLAS: LIQUIDEZ (L)',
        graficos: [
            { 
                id: 'chartInd29_1', 
                titulo: 'L1: Disponibles', 
                leftAxisName: 'porcentajes (%)',
                seriesConfig: [
                    { code: 'L1_Prov_Inc', name: 'L1: Disponibles', color: '#3b82f6', type: 'line'},
                                ]
            },
            
            { 
                id: 'chartInd29_2', 
                titulo: 'L2: Reservas Liquidación', 
                leftAxisName: 'porcentajes (%)',
                seriesConfig: [
                    { code: 'L2_Reservas', name: 'L2: Reservas Liquidación', color: '#3b82f6', type: 'line'},
                                ]
            },

            { 
                id: 'chartInd29_3', 
                titulo: 'L3: Liquidación Improductivo', 
                leftAxisName: 'porcentajes (%)',
                seriesConfig: [
                    { code: 'L3_Improductivos', name: 'L3: Liquidación Improductivo', color: '#3b82f6', type: 'line'},
                                ]
            }
        ]
    },

    roe: {
        titulo: 'PERLAS: CALIDAD DE ACTIVOS (A)',
        graficos: [
            { 
                id: 'chartInd29_1', 
                titulo: 'A1: Morosidad', 
                leftAxisName: 'porcentajes (%)',
                seriesConfig: [
                    { code: 'A1_Moro', name: 'A1: Morosidad', color: '#3b82f6', type: 'line'},
                                ]
            },
            
            { 
                id: 'chartInd29_2', 
                titulo: 'A2: Activos Improductivos Netos', 
                leftAxisName: 'porcentajes (%)',
                seriesConfig: [
                    { code: 'A2_Act_Imp', name: 'A2: Activos Improductivos Netos', color: '#3b82f6', type: 'line'},
                                ]
            },

            { 
                id: 'chartInd29_3', 
                titulo: 'A3: Capital Neto / Activos Improductivos', 
                leftAxisName: 'porcentajes (%)',
                seriesConfig: [
                    { code: 'A3_Capi_neto', name: 'A3: Capital Neto / Activos Improductivos', color: '#3b82f6', type: 'line'},
                                ]
            }
        ]
    },

    autonomia: {
        titulo: 'PERLAS: SEÑALES (S)',
        graficos: [
            { 
                id: 'chartInd29_1', 
                titulo: 'S1: Crecimiento Préstamos', 
                leftAxisName: 'porcentajes (%)',
                seriesConfig: [
                    { code: 'S1_Crec_14', name: 'S1: Crecimiento Préstamos', color: '#3b82f6', type: 'line'},
                                ]
            },
            
            { 
                id: 'chartInd29_2', 
                titulo: 'S2: Crecimiento Inversiones Líquidas', 
                leftAxisName: 'porcentajes (%)',
                seriesConfig: [
                    { code: 'S2_Crec_INL', name: 'S2: Crecimiento Inversiones Líquidas', color: '#3b82f6', type: 'line'},
                                ]
            },

            { 
                id: 'chartInd29_3', 
                titulo: 'S3: Crecimiento Inversiones Financieras', 
                leftAxisName: 'porcentajes (%)',
                seriesConfig: [
                    { code: 'S3_Crec_INF', name: 'S3: Crecimiento Inversiones Financieras', color: '#3b82f6', type: 'line'},
                                ]
            },

            { 
                id: 'chartInd29_4', 
                titulo: 'S4: Crecimiento Inversiones No Financieras', 
                leftAxisName: 'porcentajes (%)',
                seriesConfig: [
                    { code: 'S4_Crec_INNF', name: 'S4: Crecimiento Inversiones No Financieras', color: '#10b981', type: 'line'},
                                ]
            },

            { 
                id: 'chartInd29_5', 
                titulo: 'S5: Crecimiento Depósitos Ahorro', 
                leftAxisName: 'porcentajes (%)',
                seriesConfig: [
                    { code: 'S5_Cre_Ahorro', name: 'S5: Crecimiento Depósitos Ahorro', color: '#10b981', type: 'line'},
                                ]
            },

            { 
                id: 'chartInd29_6', 
                titulo: 'S6: Crecimiento Aportaciones de Socios', 
                leftAxisName: 'porcentajes (%)',
                seriesConfig: [
                    { code: 'S6_Apor_Soci', name: 'S6: Crecimiento Aportaciones de Socios', color: '#10b981', type: 'line'},
                                ]
            },

            { 
                id: 'chartInd29_7', 
                titulo: 'S7: Crecimiento Participación de Reservas', 
                leftAxisName: 'porcentajes (%)',
                seriesConfig: [
                    { code: 'S7_Par_Reservas', name: 'S7: Crecimiento Participación de Reservas', color: '#10b981', type: 'line'},
                                ]
            },

            { 
                id: 'chartInd29_8', 
                titulo: 'S8: Crecimiento Capital Institucional Neto', 
                leftAxisName: 'porcentajes (%)',
                seriesConfig: [
                    { code: 'S8_K_neto', name: 'S8: Crecimiento Capital Institucional Neto', color: '#10b981', type: 'line'},
                    
                                ]
            },

            { 
                id: 'chartInd29_9', 
                titulo: 'S9: Crecimiento Activos', 
                leftAxisName: 'porcentajes (%)',
                seriesConfig: [
                    { code: 'S9_Cre_Activos', name: 'S9: Crecimiento Activos', color: '#10b981', type: 'line'},
                    
                                ]
            }
        ]
    }




};

// Función principal para cambiar de categoría en Hoja 29
function cambiarCategoriaIndicador29(categoria) {
    categoriaIndicadorActual29 = categoria;
    
    // Actualizar botones activos SOLO en la página 29
    document.querySelectorAll('#page-29 .indicador-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.categoria === categoria) {
            btn.classList.add('active');
        }
    });
    
    renderizarGraficosIndicadores29(categoria);
}

// Función para renderizar gráficos en Hoja 29
function renderizarGraficosIndicadores29(categoria) {
    const config = CONFIG_INDICADORES_29[categoria];
    if (!config) return;
    
    // 1. Ocultar todos los contenedores de gráficos de la página 29 primero
    for (let i = 1; i <= 9; i++) {
        const container = document.getElementById(`container-ind29-${i}`);
        if (container) {
            if (i <= config.graficos.length) {
                container.style.display = 'block'; // Mostrar si está en la config
            } else {
                container.style.display = 'none'; // Ocultar si no hay gráfico para este espacio
            }
        }
    }

    // 2. Renderizar solo los gráficos definidos en la configuración
    config.graficos.forEach((grafico) => {
        if (grafico.seriesConfig) {
            renderHistoricoEstructuraGenerico(
                grafico.id,
                grafico.seriesConfig,
                grafico.titulo || 'Indicador Financiero',
                grafico.leftAxisName || '%',
                grafico.rightAxisName || '%'
            );
        }
    });
}

// Función para inicializar la página 29
function renderIndicadoresPage29() {
    if (categoriaIndicadorActual29) {
        renderizarGraficosIndicadores29(categoriaIndicadorActual29);
    } else {
        cambiarCategoriaIndicador29('estructura');
    }
}

// ==========================================
// FINAL PAGINA 29
// ==========================================



// ==========================================
//  PAGINA 30
// ==========================================

// ✅ FUNCIÓN CORREGIDA - BANDAS MÁS VISIBLES Y CON ETIQUETAS
function renderHistoricoConBandasVolatilidad(chartId, seriesConfig, title = 'Tasas de Equilibrio y Volatilidad', subtitulo = '') {
    if (!currentMagazineData) return;
    
    const chartDom = document.getElementById(chartId);
    if (!chartDom) return;
    
    let chart = echarts.getInstanceByDom(chartDom);
    if (!chart) chart = echarts.init(chartDom);
    
    const allDateCols = Object.keys(currentMagazineData[0])
        .filter(k => /^\d{4}-\d{2}$/.test(k))
        .sort();
    
    const dateLabels = allDateCols.map(d => {
        const [y, m] = d.split('-');
        return `${monthsNames[parseInt(m)-1]} ${y}`;
    });
    
    // Obtener series principales
    const mainSeries = seriesConfig.find(s => s.tipo === 'principal');
    const secondarySeries = seriesConfig.find(s => s.tipo === 'secundaria');
    
    // Obtener series de bandas
    const banda1SDSuperior = seriesConfig.find(s => s.tipo === '1SD_superior');
    const banda1SDInferior = seriesConfig.find(s => s.tipo === '1SD_inferior');
    const banda2SDSuperior = seriesConfig.find(s => s.tipo === '2SD_superior');
    const banda2SDInferior = seriesConfig.find(s => s.tipo === '2SD_inferior');
    
    if (!mainSeries) return;
    
    // Obtener datos de serie principal
    const mainRow = currentMagazineData.find(r => r.CUC === mainSeries.code);
    const mainData = mainRow ? allDateCols.map(d => parseFloat(mainRow[d]) || 0) : allDateCols.map(() => 0);
    
    // Obtener datos de bandas
    let data1SDPlus = [], data1SDMinus = [], data2SDPlus = [], data2SDMinus = [];
    
    if (banda1SDSuperior && banda1SDInferior) {
        const row1SDPlus = currentMagazineData.find(r => r.CUC === banda1SDSuperior.code);
        const row1SDMinus = currentMagazineData.find(r => r.CUC === banda1SDInferior.code);
        if (row1SDPlus && row1SDMinus) {
            data1SDPlus = allDateCols.map(d => parseFloat(row1SDPlus[d]) || 0);
            data1SDMinus = allDateCols.map(d => parseFloat(row1SDMinus[d]) || 0);
        }
    }
    
    if (banda2SDSuperior && banda2SDInferior) {
        const row2SDPlus = currentMagazineData.find(r => r.CUC === banda2SDSuperior.code);
        const row2SDMinus = currentMagazineData.find(r => r.CUC === banda2SDInferior.code);
        if (row2SDPlus && row2SDMinus) {
            data2SDPlus = allDateCols.map(d => parseFloat(row2SDPlus[d]) || 0);
            data2SDMinus = allDateCols.map(d => parseFloat(row2SDMinus[d]) || 0);
        }
    }
    
    // Datos de serie secundaria
    let secondaryData = [];
    if (secondarySeries) {
        const secondaryRow = currentMagazineData.find(r => r.CUC === secondarySeries.code);
        secondaryData = secondaryRow ? allDateCols.map(d => parseFloat(secondaryRow[d]) || 0) : allDateCols.map(() => 0);
    }
    
    // Calcular zoom
    const totalMonths = dateLabels.length;
    let zoomStart = 0;
    let zoomEnd = 100;
    if (totalMonths > 12) {
        zoomStart = ((totalMonths - 12) / totalMonths) * 100;
        zoomEnd = 100;
    }
    
    // ✅ CREAR SERIES - TÉCNICA CORRECTA PARA BANDAS
    const seriesList = [];
    
    // 1. Banda ±2SD (externa) - Más visible con color azul claro
    if (data2SDPlus.length > 0 && data2SDMinus.length > 0) {
        // Línea superior de 2SD con área que rellena hacia abajo
        seriesList.push({
            name: 'Banda ±2SD',
            type: 'line',
            data: data2SDPlus,
            symbol: 'none',
            lineStyle: { width: 1, color: '#93c5fd', type: 'dashed' },
            areaStyle: {
                color: 'rgba(147, 197, 253, 0.3)', // Azul claro más visible
                origin: 'auto'
            },
            z: 1
        });
        
        // Línea inferior de 2SD con área blanca que "corta" el exceso
        seriesList.push({
            type: 'line',
            data: data2SDMinus,
            symbol: 'none',
            lineStyle: { width: 1, color: '#93c5fd', type: 'dashed' },
            areaStyle: {
                color: '#ffffff', // Blanco para cortar el área
                origin: 'auto'
            },
            name: 'Límite inferior ±2SD',
            z: 2
        });
    }
    
    // 2. Banda ±1SD (interna) - Más oscura y visible con color azul medio
    if (data1SDPlus.length > 0 && data1SDMinus.length > 0) {
        // Línea superior de 1SD con área que rellena hacia abajo
        seriesList.push({
            name: 'Banda ±1SD',
            type: 'line',
            data: data1SDPlus,
            symbol: 'none',
            lineStyle: { width: 1.5, color: '#3b82f6', type: 'dashed' },
            areaStyle: {
                color: 'rgba(59, 130, 246, 0.4)', // Azul medio más visible
                origin: 'auto'
            },
            z: 3
        });
        
        // Línea inferior de 1SD con área blanca que "corta" el exceso
        seriesList.push({
            type: 'line',
            data: data1SDMinus,
            symbol: 'none',
            lineStyle: { width: 1.5, color: '#3b82f6', type: 'dashed' },
            areaStyle: {
                color: '#ffffff', // Blanco para cortar el área
                origin: 'auto'
            },
            name: 'Límite inferior ±1SD',
            z: 4
        });
    }
    
    // 3. Línea principal (TAEB) - Línea roja sólida CON ETIQUETAS
    seriesList.push({
        name: mainSeries.name,
        type: 'line',
        data: mainData,
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        lineStyle: { width: 3, color: '#dc2626' },
        itemStyle: { color: '#dc2626', borderWidth: 2, borderColor: '#fff' },
        // ✅ ETIQUETAS CONECTADAS AL SWITCH
        label: {
            show: showChartLabels,
            position: 'top',
            formatter: (p) => formatNumber(p.value) + '%',
            fontSize: 9,
            fontWeight: 'bold',
            color: '#dc2626',
            distance: 3
        },
        z: 100
    });
    
    // 4. Línea secundaria (TEN) - Línea azul punteada CON ETIQUETAS
    if (secondarySeries && secondaryData.length > 0) {
        seriesList.push({
            name: secondarySeries.name,
            type: 'line',
            data: secondaryData,
            smooth: true,
            symbol: 'circle',
            symbolSize: 6,
            lineStyle: { width: 2.5, color: '#2563eb', type: 'dashed' },
            itemStyle: { color: '#2563eb', borderWidth: 2, borderColor: '#fff' },
            // ✅ ETIQUETAS CONECTADAS AL SWITCH
            label: {
                show: showChartLabels,
                position: 'top',
                formatter: (p) => formatNumber(p.value) + '%',
                fontSize: 9,
                fontWeight: 'bold',
                color: '#2563eb',
                distance: 3
            },
            z: 100
        });
    }
    
    const option = {
        title: { 
            text: title, 
            subtext: subtitulo,
            left: 'center', 
            textStyle: { fontSize: 13, fontWeight: 'bold', color: '#1e3a8a' },
            subtextStyle: { fontSize: 10, color: '#64748b' }
        },
        tooltip: {
            trigger: 'axis',
            backgroundColor: 'rgba(255, 255, 255, 0.98)',
            borderColor: '#e2e8f0',
            borderWidth: 1,
            textStyle: { color: '#334155', fontSize: 11 },
            axisPointer: { type: 'cross' },
            formatter: function(params) {
                let result = `<div style="font-weight:bold; margin-bottom:8px;">${params[0].name}</div>`;
                params.forEach(param => {
                    // ✅ FILTRAR: Solo mostrar si tiene nombre Y no está vacío
                    if (param.seriesName && param.seriesName.trim() !== '') {
                        result += `<div style="display:flex; align-items:center; gap:8px; margin:4px 0;">
                            <span style="width:10px; height:10px; background:${param.color}; border-radius:2px;"></span>
                            <span>${param.seriesName}:</span>
                            <span style="font-weight:bold; margin-left:auto;">${formatNumber(param.value)}%</span>
                        </div>`;
                    }
                });
                return result;
            }
        },
        legend: {
            data: [mainSeries.name, ...(secondarySeries ? [secondarySeries.name] : []), 'Banda ±1SD', 'Banda ±2SD'],
            bottom: 0,
            textStyle: { fontSize: 10, color: '#64748b' },
            itemWidth: 15,
            itemHeight: 10
        },
        grid: { 
            left: '6%', 
            right: '5%', 
            bottom: '22%', 
            top: '15%', 
            containLabel: true 
        },
        xAxis: {
            type: 'category',
            data: dateLabels,
            boundaryGap: false,
            axisLine: { lineStyle: { color: '#cbd5e1' } },
            axisLabel: { fontSize: 9, color: '#64748b', rotate: 45, interval: 'auto' }
        },
        yAxis: {
            type: 'value',
            name: 'Tasa (%)',
            nameTextStyle: { fontSize: 10, color: '#64748b', fontWeight: '600' },
            axisLabel: { fontSize: 9, color: '#64748b', formatter: (value) => formatNumber(value) },
            splitLine: { lineStyle: { color: '#f1f5f9', type: 'dashed' } }
        },
        dataZoom: [
            { type: 'inside', start: zoomStart, end: zoomEnd },
            { 
                type: 'slider', 
                bottom: 0, 
                start: zoomStart, 
                end: zoomEnd, 
                height: 20,
                borderColor: '#e2e8f0',
                fillerColor: 'rgba(37, 99, 246, 0.1)',
                backgroundColor: '#f8fafc'
            }
        ],
        series: seriesList
    };
    
    chart.setOption(option, true);
}

let categoriaIndicadorActual30 = 'estructura';

// Configuración de indicadores por categoría
const CONFIG_INDICADORES_30 = {
    estructura: {
        titulo: 'SEGMENTO PRODUCTIVO CORPORATIVO',
        graficos: [
            { 
                id: 'chartInd30_1', 
                titulo: 'COMPONENTES: PRODUCTIVO CORPORATIVO', 
                subtitulo: 'En porcentajes',
                tipoGrafico: 'generico',
                leftAxisName: 'porcentajes (%)',
                seriesConfig: [
                            { code: 'CF_Corporativo', name: 'Costo Fondeo', color: '#3b82f6', type: 'bar' },
                            { code: 'GO_Produc', name: 'Gastos Operativos', color: '#10b981', type: 'bar'  },
                            { code: 'RC_Corp', name: 'Riesgo de Crédito', color: '#f59e0b' , type: 'bar' },
                            { code: 'CK_Prod', name: 'Costo de Capital', color: '#20666B' , type: 'bar' }
                                ]
            },
            
            { 
                id: 'chartInd30_4', 
                titulo: 'Tasa Activa Efectiva Referencial y Tasa Activa Máxima', 
                subtitulo: 'En porcentajes',
                tipoGrafico: 'generico',
                leftAxisName: 'porcentajes (%)',
                seriesConfig: [
                            { code: 'ref_corp', name: 'Tasa Activa Efectiva Referencial', color: '#3b82f6', type: 'line' },
                            { code: 'max_cor', name: 'Tasa Activa Máxima', color: '#10b981', type: 'line'  }
                                ]
            },

            { 
                id: 'chartInd30_7', 
                titulo: 'Tasa de Interés de Mercado (EFI)', 
                subtitulo: 'En porcentajes',
                tipoGrafico: 'generico',
                leftAxisName: 'porcentajes (%)',
                seriesConfig: [
                    { code: 't_proc', name: 'Tasa Activa Efectiva EFI', color: '#3b82f6', type: 'line'},
                                ]
            }
        ]
    },

    solvencia: {
        titulo: 'COMPONENTES: PRODUCTIVO EMPRESARIAL',
        graficos: [
            { 
                id: 'chartInd30_1', 
                titulo: 'COMPONENTES: PRODUCTIVO EMPRESARIAL', 
                subtitulo: 'En porcentajes',
                tipoGrafico: 'generico',
                leftAxisName: 'porcentajes (%)',
                seriesConfig: [
                            { code: 'CF_Empresarial', name: 'Costo Fondeo', color: '#3b82f6', type: 'bar' },
                            { code: 'GO_Produc', name: 'Gastos Operativos', color: '#10b981', type: 'bar'  },
                            { code: 'RC_Emp', name: 'Riesgo de Crédito', color: '#f59e0b' , type: 'bar' },
                            { code: 'CK_Prod', name: 'Costo de Capital', color: '#20666B' , type: 'bar' }
                                ]
            },
            
            { 
                id: 'chartInd30_4', 
                titulo: 'Tasa Activa Efectiva Referencial y Tasa Activa Máxima', 
                subtitulo: 'En porcentajes',
                tipoGrafico: 'generico',
                leftAxisName: 'porcentajes (%)',
                seriesConfig: [
                            { code: 'ref_emp', name: 'Tasa Activa Efectiva Referencial', color: '#3b82f6', type: 'line' },
                            { code: 'max_emp', name: 'Tasa Activa Máxima', color: '#10b981', type: 'line'  },
                            { code: 't_prodem', name: 'Tasa Activa Efectiva EFI', color: '#f59e0b', type: 'line'  },
                                ]
            },

            { 
                id: 'chartInd30_7', 
                titulo: 'Tasa de Interés de Equilibrio (EFI)', 
                subtitulo: 'En porcentajes | Bandas grises: ±1SD y ±2SD',
                tipoGrafico: 'volatilidad',
                leftAxisName: 'porcentajes (%)',
                seriesConfig: [
                    { code: 'TAEB_Empr', name: 'TAEB (Efectiva Anual %)', tipo: 'principal' },
                    { code: 'TEN_Empr', name: 'TEN (Nominal %)', tipo: 'secundaria' },
                    { code: '@1mSD_Emp', tipo: '1SD_superior' },
                    { code: '@1SD_Emp', tipo: '1SD_inferior' },
                    { code: '@2mSD_Emp', tipo: '2SD_superior' },
                    { code: '@2SD_Emp', tipo: '2SD_inferior' }
                ]
            }
        ]
    },

    endeudamiento: {
        titulo: 'COMPONENTES: PRODUCTIVO PYMES',
        graficos: [
            { 
                id: 'chartInd30_1', 
                titulo: 'COMPONENTES: PRODUCTIVO PYMES', 
                subtitulo: 'En porcentajes',
                tipoGrafico: 'generico',
                leftAxisName: 'porcentajes (%)',
                seriesConfig: [
                            { code: 'CF_PYMES', name: 'Costo Fondeo', color: '#3b82f6', type: 'bar' },
                            { code: 'GO_Produc', name: 'Gastos Operativos', color: '#10b981', type: 'bar'  },
                            { code: 'RC_PYM', name: 'Riesgo de Crédito', color: '#f59e0b' , type: 'bar' },
                            { code: 'CK_Prod', name: 'Costo de Capital', color: '#20666B' , type: 'bar' }
                                ]
            },
            
            { 
                id: 'chartInd30_4', 
                titulo: 'Tasa Activa Efectiva Referencial y Tasa Activa Máxima', 
                subtitulo: 'En porcentajes',
                tipoGrafico: 'generico',
                leftAxisName: 'porcentajes (%)',
                seriesConfig: [
                            { code: 'ref_pym', name: 'Tasa Activa Efectiva Referencial', color: '#3b82f6', type: 'line' },
                            { code: 'max_pym', name: 'Tasa Activa Máxima', color: '#10b981', type: 'line'  },
                            { code: 't_prodpy', name: 'Tasa Activa Efectiva EFI', color: '#f59e0b', type: 'line'  },
                                ]
            },

            { 
                id: 'chartInd30_7', 
                titulo: 'Tasa de Interés de Equilibrio (EFI)', 
                subtitulo: 'En porcentajes | Bandas grises: ±1SD y ±2SD',
                tipoGrafico: 'volatilidad',
                leftAxisName: 'porcentajes (%)',
                seriesConfig: [
                    { code: 'TAEB_PYM', name: 'TAEB (Efectiva Anual %)', tipo: 'principal' },
                    { code: 'TEN_PYM', name: 'TEN (Nominal %)', tipo: 'secundaria' },
                    { code: '@1mSD_Pym', tipo: '1SD_superior' },
                    { code: '@1SD_Pym', tipo: '1SD_inferior' },
                    { code: '@2mSD_Pym', tipo: '2SD_superior' },
                    { code: '@2SD_Pym', tipo: '2SD_inferior' }
                ]
            }
        ]
    },

    cobertura: {
        titulo: 'COMPONENTES: CONSUMO',
        graficos: [
            { 
                id: 'chartInd30_1', 
                titulo: 'COMPONENTES: CONSUMO', 
                subtitulo: 'En porcentajes',
                tipoGrafico: 'generico',
                leftAxisName: 'porcentajes (%)',
                seriesConfig: [
                            { code: 'CF_Consumo', name: 'Costo Fondeo', color: '#3b82f6', type: 'bar' },
                            { code: 'GO_Consu', name: 'Gastos Operativos', color: '#10b981', type: 'bar'  },
                            { code: 'RC_Cons', name: 'Riesgo de Crédito', color: '#f59e0b' , type: 'bar' },
                            { code: 'CK_Cons', name: 'Costo de Capital', color: '#20666B' , type: 'bar' }
                                ]
            },
            
            { 
                id: 'chartInd30_4', 
                titulo: 'Tasa Activa Efectiva Referencial y Tasa Activa Máxima', 
                subtitulo: 'En porcentajes',
                tipoGrafico: 'generico',
                leftAxisName: 'porcentajes (%)',
                seriesConfig: [
                            { code: 'ref_cons', name: 'Tasa Activa Efectiva Referencial', color: '#3b82f6', type: 'line' },
                            { code: 'max_cons', name: 'Tasa Activa Máxima', color: '#10b981', type: 'line'  },
                            { code: 't_cons', name: 'Tasa Activa Efectiva EFI', color: '#f59e0b', type: 'line'  },
                                ]
            },

            { 
                id: 'chartInd30_7', 
                titulo: 'Tasa de Interés de Equilibrio (EFI)', 
                subtitulo: 'En porcentajes | Bandas grises: ±1SD y ±2SD',
                tipoGrafico: 'volatilidad',
                leftAxisName: 'porcentajes (%)',
                seriesConfig: [
                    { code: 'TAEB_Cons', name: 'TAEB (Efectiva Anual %)', tipo: 'principal' },
                    { code: 'TEN_Cons', name: 'TEN (Nominal %)', tipo: 'secundaria' },
                    { code: '@1mSD_Con', tipo: '1SD_superior' },
                    { code: '@1SD_Con', tipo: '1SD_inferior' },
                    { code: '@2mSD_Con', tipo: '2SD_superior' },
                    { code: '@2SD_Con', tipo: '2SD_inferior' }
                ]
            }
        ]
    },

    maniobra: {
        titulo: 'COMPONENTES: EDUCATIVO',
        graficos: [
            { 
                id: 'chartInd30_1', 
                titulo: 'SEGMENTO EDUCATIVO', 
                subtitulo: 'En porcentajes',
                tipoGrafico: 'generico',
                leftAxisName: 'porcentajes (%)',
                seriesConfig: [
                            { code: 'ref_educ', name: 'Tasa Activa Efectiva Referencial', color: '#3b82f6', type: 'line' },
                            { code: 'max_educ', name: 'Tasa Activa Máxima', color: '#10b981', type: 'line'  },
                            { code: 't_edu', name: 'Tasa Activa Efectiva EFI', color: '#f59e0b', type: 'line'  },
                                ]
            }
        ]
    },

    roa:  {
        titulo: 'COMPONENTES: INMOBILIARIO',
        graficos: [
            { 
                id: 'chartInd30_1', 
                titulo: 'COMPONENTES: INMOBILIARIO', 
                subtitulo: 'En porcentajes',
                tipoGrafico: 'generico',
                leftAxisName: 'porcentajes (%)',
                seriesConfig: [
                            { code: 'CF_Inmobiliario', name: 'Costo Fondeo', color: '#3b82f6', type: 'bar' },
                            { code: 'GO_Inmobi', name: 'Gastos Operativos', color: '#10b981', type: 'bar'  },
                            { code: 'RC_Inm', name: 'Riesgo de Crédito', color: '#f59e0b' , type: 'bar' },
                            { code: 'CK_Inmo', name: 'Costo de Capital', color: '#20666B' , type: 'bar' }
                                ]
            },
            
            { 
                id: 'chartInd30_4', 
                titulo: 'Tasa Activa Efectiva Referencial y Tasa Activa Máxima', 
                subtitulo: 'En porcentajes',
                tipoGrafico: 'generico',
                leftAxisName: 'porcentajes (%)',
                seriesConfig: [
                            { code: 'ref_inmo', name: 'Tasa Activa Efectiva Referencial', color: '#3b82f6', type: 'line' },
                            { code: 'max_inmo', name: 'Tasa Activa Máxima', color: '#10b981', type: 'line'  },
                            { code: 't_inmo', name: 'Tasa Activa Efectiva EFI', color: '#f59e0b', type: 'line'  },
                                ]
            },

            { 
                id: 'chartInd30_7', 
                titulo: 'Tasa de Interés de Equilibrio (EFI)', 
                subtitulo: 'En porcentajes | Bandas grises: ±1SD y ±2SD',
                tipoGrafico: 'volatilidad',
                leftAxisName: 'porcentajes (%)',
                seriesConfig: [
                    { code: 'TAEB_Inmo', name: 'TAEB (Efectiva Anual %)', tipo: 'principal' },
                    { code: 'TEN_Inmo', name: 'TEN (Nominal %)', tipo: 'secundaria' },
                    { code: '@1mSD_Inm', tipo: '1SD_superior' },
                    { code: '@1SD_Inm', tipo: '1SD_inferior' },
                    { code: '@2mSD_Inm', tipo: '2SD_superior' },
                    { code: '@2SD_Inm', tipo: '2SD_inferior' }
                ]
            }
        ]
    },

    apalancamiento:  {
        titulo: 'COMPONENTES: VIVIENDA DE INTERÉS PÚBLICO Y SOCIAL',
        graficos: [
            { 
                id: 'chartInd30_1', 
                titulo: 'Tasa Activa Efectiva Referencial y Tasa Activa Máxima VIP', 
                subtitulo: 'En porcentajes',
                tipoGrafico: 'generico',
                leftAxisName: 'porcentajes (%)',
                seriesConfig: [
                            { code: 'ref_vip', name: 'Tasa Activa Efectiva Referencial', color: '#3b82f6', type: 'line' },
                            { code: 'max_vip', name: 'Tasa Activa Máxima', color: '#10b981', type: 'line'  },
                            { code: 't_vip', name: 'Tasa Activa Efectiva EFI', color: '#f59e0b', type: 'line'  },
                                ]
            },
            
            { 
                id: 'chartInd30_4', 
                titulo: 'Tasa Activa Efectiva Referencial y Tasa Activa Máxima VIS', 
                subtitulo: 'En porcentajes',
                tipoGrafico: 'generico',
                leftAxisName: 'porcentajes (%)',
                seriesConfig: [
                            { code: 'ref_vis', name: 'Tasa Activa Efectiva Referencial', color: '#3b82f6', type: 'line' },
                            { code: 'max_vis', name: 'Tasa Activa Máxima', color: '#10b981', type: 'line'  },
                            { code: 't_vis', name: 'Tasa Activa Efectiva EFI', color: '#f59e0b', type: 'line'  },
                                ]
            }
        ]
    },

    activo:  {
        titulo: 'COMPONENTES: MICROCRÉDITO MINORISTA',
        graficos: [
            { 
                id: 'chartInd30_1', 
                titulo: 'COMPONENTES: MICROCRÉDITO MINORISTA', 
                subtitulo: 'En porcentajes',
                tipoGrafico: 'generico',
                leftAxisName: 'porcentajes (%)',
                seriesConfig: [
                            { code: 'CF_Minorista', name: 'Costo Fondeo', color: '#3b82f6', type: 'bar' },
                            { code: 'GO_Micro', name: 'Gastos Operativos', color: '#10b981', type: 'bar'  },
                            { code: 'RC_Mino', name: 'Riesgo de Crédito', color: '#f59e0b' , type: 'bar' },
                            { code: 'CK_Mino', name: 'Costo de Capital', color: '#20666B' , type: 'bar' }
                                ]
            },
            
            { 
                id: 'chartInd30_4', 
                titulo: 'Tasa Activa Efectiva Referencial y Tasa Activa Máxima', 
                subtitulo: 'En porcentajes',
                tipoGrafico: 'generico',
                leftAxisName: 'porcentajes (%)',
                seriesConfig: [
                            { code: 'ref_mino', name: 'Tasa Activa Efectiva Referencial', color: '#3b82f6', type: 'line' },
                            { code: 'max_mino', name: 'Tasa Activa Máxima', color: '#10b981', type: 'line'  },
                            { code: 't_mino', name: 'Tasa Activa Efectiva EFI', color: '#f59e0b', type: 'line'  },
                                ]
            },

            { 
                id: 'chartInd30_7', 
                titulo: 'Tasa de Interés de Equilibrio (EFI)', 
                subtitulo: 'En porcentajes | Bandas grises: ±1SD y ±2SD',
                tipoGrafico: 'volatilidad',
                leftAxisName: 'porcentajes (%)',
                seriesConfig: [
                    { code: 'TAEB_Mino', name: 'TAEB (Efectiva Anual %)', tipo: 'principal' },
                    { code: 'TEN_Mino', name: 'TEN (Nominal %)', tipo: 'secundaria' },
                    { code: '@1mSD_Mino', tipo: '1SD_superior' },
                    { code: '@1SD_Mino', tipo: '1SD_inferior' },
                    { code: '@2mSD_Mino', tipo: '2SD_superior' },
                    { code: '@2SD_Mino', tipo: '2SD_inferior' }
                ]
            }
        ]
    },

    simple:  {
        titulo: 'COMPONENTES: MICROCRÉDITO ACUMULACIÓN SIMPLE',
        graficos: [
            { 
                id: 'chartInd30_1', 
                titulo: 'COMPONENTES: MICROCRÉDITO ACUMULACIÓN SIMPLE', 
                subtitulo: 'En porcentajes',
                tipoGrafico: 'generico',
                leftAxisName: 'porcentajes (%)',
                seriesConfig: [
                            { code: 'CF_Simple', name: 'Costo Fondeo', color: '#3b82f6', type: 'bar' },
                            { code: 'GO_Micro', name: 'Gastos Operativos', color: '#10b981', type: 'bar'  },
                            { code: 'RC_Simp', name: 'Riesgo de Crédito', color: '#f59e0b' , type: 'bar' },
                            { code: 'CK_Mino', name: 'Costo de Capital', color: '#20666B' , type: 'bar' }
                                ]
            },
            
            { 
                id: 'chartInd30_4', 
                titulo: 'Tasa Activa Efectiva Referencial y Tasa Activa Máxima', 
                subtitulo: 'En porcentajes',
                tipoGrafico: 'generico',
                leftAxisName: 'porcentajes (%)',
                seriesConfig: [
                            { code: 'ref_simp', name: 'Tasa Activa Efectiva Referencial', color: '#3b82f6', type: 'line' },
                            { code: 'max_simp', name: 'Tasa Activa Máxima', color: '#10b981', type: 'line'  },
                            { code: 't_mas', name: 'Tasa Activa Efectiva EFI', color: '#f59e0b', type: 'line'  },
                                ]
            },

            { 
                id: 'chartInd30_7', 
                titulo: 'Tasa de Interés de Equilibrio (EFI)', 
                subtitulo: 'En porcentajes | Bandas grises: ±1SD y ±2SD',
                tipoGrafico: 'volatilidad',
                leftAxisName: 'porcentajes (%)',
                seriesConfig: [
                    { code: 'TAEB_Simpl', name: 'TAEB (Efectiva Anual %)', tipo: 'principal' },
                    { code: 'TEN_Simpl', name: 'TEN (Nominal %)', tipo: 'secundaria' },
                    { code: '@1mSD_Simp', tipo: '1SD_superior' },
                    { code: '@1SD_Simp', tipo: '1SD_inferior' },
                    { code: '@2mSD_Simp', tipo: '2SD_superior' },
                    { code: '@2SD_Simp', tipo: '2SD_inferior' }
                ]
            }
        ]
    },

    ampli:  {
        titulo: 'COMPONENTES: MICROCRÉDITO ACUMULACIÓN AMPLIADA',
        graficos: [
            { 
                id: 'chartInd30_1', 
                titulo: 'COMPONENTES: MICROCRÉDITO ACUMULACIÓN AMPLIADA', 
                subtitulo: 'En porcentajes',
                tipoGrafico: 'generico',
                leftAxisName: 'porcentajes (%)',
                seriesConfig: [
                            { code: 'CF_Ampliado', name: 'Costo Fondeo', color: '#3b82f6', type: 'bar' },
                            { code: 'GO_Micro', name: 'Gastos Operativos', color: '#10b981', type: 'bar'  },
                            { code: 'RC_Amp', name: 'Riesgo de Crédito', color: '#f59e0b' , type: 'bar' },
                            { code: 'CK_Mino', name: 'Costo de Capital', color: '#20666B' , type: 'bar' }
                                ]
            },
            
            { 
                id: 'chartInd30_4', 
                titulo: 'Tasa Activa Efectiva Referencial y Tasa Activa Máxima', 
                subtitulo: 'En porcentajes',
                tipoGrafico: 'generico',
                leftAxisName: 'porcentajes (%)',
                seriesConfig: [
                            { code: 'ref_ampl', name: 'Tasa Activa Efectiva Referencial', color: '#3b82f6', type: 'line' },
                            { code: 'max_ampl', name: 'Tasa Activa Máxima', color: '#10b981', type: 'line'  },
                            { code: 't_maa', name: 'Tasa Activa Efectiva EFI', color: '#f59e0b', type: 'line'  },
                                ]
            },

            { 
                id: 'chartInd30_7', 
                titulo: 'Tasa de Interés de Equilibrio (EFI)', 
                subtitulo: 'En porcentajes | Bandas grises: ±1SD y ±2SD',
                tipoGrafico: 'volatilidad',
                leftAxisName: 'porcentajes (%)',
                seriesConfig: [
                    { code: 'TAEB_Ampli', name: 'TAEB (Efectiva Anual %)', tipo: 'principal' },
                    { code: 'TEN_Ampli', name: 'TEN (Nominal %)', tipo: 'secundaria' },
                    { code: '@1mSD_Amp', tipo: '1SD_superior' },
                    { code: '@1SD_Amp', tipo: '1SD_inferior' },
                    { code: '@2mSD_Amp', tipo: '2SD_superior' },
                    { code: '@2SD_Amp', tipo: '2SD_inferior' }
                ]
            }
        ]
    },

    depo:  {
        titulo: 'DEPÓSTIOS A PLAZO: OPERACIONES NUEVAS',
        graficos: [
            { 
                id: 'chartInd30_1', 
                titulo: 'Tasa Pasiva Efectiva EFI', 
                subtitulo: 'En porcentajes',
                tipoGrafico: 'generico',
                leftAxisName: 'porcentajes (%)',
                seriesConfig: [
                            { code: 'TPE', name: 'Tasa Pasiva Efectiva EFI', color: '#3b82f6', type: 'line' }
                                ]
            },
            
            { 
                id: 'chartInd30_4', 
                titulo: 'Tasa Pasiva Efectiva por Plazo EFI', 
                subtitulo: 'En porcentajes',
                tipoGrafico: 'generico',
                leftAxisName: 'porcentajes (%)',
                seriesConfig: [
                            { code: 'TPE30', name: '1-60 días', color: '#10b981', type: 'line'  },
                            { code: 'TPE61', name: '61-90 días', color: '#f59e0b' , type: 'line' },
                            { code: 'TPE91', name: '91-120 días', color: '#20666B' , type: 'line' },
                            { code: 'TPE121', name: '121-180 días', color: '#0B132B' , type: 'line' },
                            { code: 'TPE181', name: '181-360 días', color: '#3b82f6' , type: 'line' },
                            { code: 'TPE361', name: 'Más de 361 días', color: '#D9A05B' , type: 'line' }
                                ]
            }
        ]
    }
};

// Función principal para cambiar de categoría en Hoja 29
function cambiarCategoriaIndicador30(categoria) {

    categoriaIndicadorActual30 = categoria;

    // Actualizar botones activos
    document.querySelectorAll('#page-30 .indicador-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.categoria === categoria) {
            btn.classList.add('active');
        }
    });
    
    // Renderizar los gráficos de la nueva categoría
    renderizarGraficosIndicadores30(categoria);
}

// Función para renderizar gráficos en Hoja 30
function renderizarGraficosIndicadores30(categoria) {

    

    const config = CONFIG_INDICADORES_30[categoria];
    if (!config) return;
    
    // 1. Ocultar TODOS los contenedores primero
    for (let i = 1; i <= 9; i++) {
        const container = document.getElementById(`container-ind30-${i}`);
        if (container) {
            container.style.display = 'none';
        }
    }

    // 2. Mostrar y renderizar solo los gráficos definidos en la configuración
    config.graficos.forEach((grafico) => {
        // Extraer el número del ID (ej: 'chartInd30_4' extrae '4')
        const match = grafico.id.match(/chartInd30_(\d+)/);
        if (match) {
            const index = match[1];
            const container = document.getElementById(`container-ind30-${index}`);
            if (container) {
                container.style.display = 'block'; // Mostrar el contenedor correspondiente
            }
        }

        // 3. Renderizar el gráfico según su tipo
        if (grafico.tipoGrafico === 'volatilidad') {
            renderHistoricoConBandasVolatilidad(
                grafico.id,
                grafico.seriesConfig,
                grafico.titulo,
                grafico.subtitulo || ''
            );
        } else {
            renderHistoricoEstructuraGenerico(
                grafico.id,
                grafico.seriesConfig,
                grafico.titulo,
                grafico.leftAxisName || 'porcentajes (%)'
                
            );
        }
    });
}

// Función para inicializar la página 29
function renderIndicadoresPage30() {
    cambiarCategoriaIndicador30(categoriaIndicadorActual30 || 'estructura'); // Carga la primera categoría por defecto
}

// ==========================================
// FINAL PAGINA 30
// ==========================================


// ==========================================
// PÁGINA 31: COMPARATIVO CON OTRAS ENTIDADES
// ==========================================

let categoriaIndicadorActual31 = 'estructura';
let entidadesSeleccionadas31 = []; // Almacena hasta 3 entidades seleccionadas
let datosEntidadesCache31 = {}; // Cache para datos de entidades adicionales

// Configuración de indicadores por categoría
const CONFIG_INDICADORES_31 = {
    estructura: {
        titulo: 'CUC DEL BALANCE',
        graficos: [
            { 
                id: 'chartInd31_1', 
                titulo: 'Activos', 
                leftAxisName: 'millones USD',
                seriesConfig: [
                    { code: '@1', name: 'Activos', color: '#3b82f6', type: 'line'},
                                ]
            },
            
            { 
                id: 'chartInd31_2', 
                titulo: 'Activos Productivos', 
                leftAxisName: 'millones USD',
                seriesConfig: [
                    { code: 'SB010', name: 'Activos Productivos', color: '#3b82f6', type: 'line'},
                                ]
            },

            { 
                id: 'chartInd31_3', 
                titulo: 'Activos improductivos netos', 
                leftAxisName: 'millones USD',
                seriesConfig: [
                    { code: 'SB004', name: 'Act. Imp. Netos', color: '#3b82f6', type: 'line'},
                                ]
            },

            { 
                id: 'chartInd31_4', 
                titulo: 'Pasivos', 
                leftAxisName: 'millones USD',
                seriesConfig: [
                    { code: '@2', name: 'Pasivos', color: '#10b981', type: 'line'},
                                ]
            },

            { 
                id: 'chartInd31_5', 
                titulo: 'Depósitos Ahorro', 
                leftAxisName: 'millones USD',
                seriesConfig: [
                    { code: '@210135', name: 'Dep. Ahorro', color: '#10b981', type: 'line'},
                                ]
            },

            { 
                id: 'chartInd31_6', 
                titulo: 'Depósitos Plazo', 
                leftAxisName: 'millones USD',
                seriesConfig: [
                    { code: '@2103', name: 'Dep. Plazo', color: '#10b981', type: 'line'},
                                ]
            },

            { 
                id: 'chartInd31_7', 
                titulo: 'Ingresos Anualizados', 
                leftAxisName: 'millones USD',
                seriesConfig: [
                    { code: '@5A', name: 'Ingresos Anualizados', color: '#D9A05B', type: 'line'},
                                ]
            },

            { 
                id: 'chartInd31_8', 
                titulo: 'Gastos Anualizados', 
                leftAxisName: 'millones USD',
                seriesConfig: [
                    { code: '@4A', name: 'Gastos Anualizados', color: '#D9A05B', type: 'line'},
                                ]
            },

            { 
                id: 'chartInd31_9', 
                titulo: 'Pérdidas y Ganancias Anualizadas', 
                leftAxisName: 'millones USD',
                seriesConfig: [
                    { code: 'Gan_Eje_anual', name: 'PYG Anualizados', color: '#D9A05B', type: 'line'},
                                ]
            }
        ]
    },

    liquidez: {
        titulo: 'IND. FINANCIEROS',
        graficos: [
            { 
                id: 'chartInd31_1', 
                titulo: 'Morosidad', 
                leftAxisName: 'porcentajes (%)',
                seriesConfig: [
                    { code: 'IF012', name: 'Morosidad', color: '#3b82f6', type: 'line'},
                                ]
            },
            
            { 
                id: 'chartInd31_2', 
                titulo: 'Índice de Liquidez', 
                leftAxisName: 'porcentajes (%)',
                seriesConfig: [
                    { code: 'IF006', name: 'Liquidez', color: '#3b82f6', type: 'line'},
                                ]
            },

            { 
                id: 'chartInd31_3', 
                titulo: 'Intermediación Financiera', 
                leftAxisName: 'porcentajes (%)',
                seriesConfig: [
                    { code: 'Cart_Depo', name: 'Intermediación Financiera', color: '#3b82f6', type: 'line'},
                                ]
            },

            { 
                id: 'chartInd31_4', 
                titulo: 'ROA', 
                leftAxisName: 'porcentajes (%)',
                seriesConfig: [
                    { code: 'IF002', name: 'ROA', color: '#10b981', type: 'line'},
                                ]
            },

            { 
                id: 'chartInd31_5', 
                titulo: 'ROE', 
                leftAxisName: 'porcentajes (%)',
                seriesConfig: [
                    { code: 'IF004', name: 'ROE', color: '#10b981', type: 'line'},
                                ]
            },

            { 
                id: 'chartInd31_6', 
                titulo: 'Rendimiento Cartera de Créditos', 
                leftAxisName: 'porcentajes (%)',
                seriesConfig: [
                    { code: 'SB036', name: 'Rendimiento Cartera', color: '#10b981', type: 'line'},
                                ]
            },

            { 
                id: 'chartInd31_7', 
                titulo: 'Carter Improductiva descubierta', 
                leftAxisName: 'porcentajes (%)',
                seriesConfig: [
                    { code: 'SBP001', name: 'Carter Improductiva descubierta', color: '#D9A05B', type: 'line'},
                                ]
            },

            { 
                id: 'chartInd31_8', 
                titulo: 'Carter Improductiva/Patrimonio', 
                leftAxisName: 'porcentajes (%)',
                seriesConfig: [
                    { code: 'SBP002', name: 'Carter Improductiva/Patrimonio', color: '#D9A05B', type: 'line'},
                                ]
            },

            { 
                id: 'chartInd31_9', 
                titulo: 'Patrimonio Técnico', 
                leftAxisName: 'porcentajes (%)',
                seriesConfig: [
                    { code: 'SOLVENCIA', name: 'Patrimonio Técnico', color: '#D9A05B', type: 'line'},
                                ]
            }
        ]
    },

    solvencia: {
        titulo: 'IND. CAMELS',
        graficos: [
            { 
                id: 'chartInd31_1', 
                titulo: 'Suficiencia Patrimonial (C)', 
                leftAxisName: 'porcentajes (%)',
                seriesConfig: [
                    { code: 'C1_1', name: 'Suficiencia Patrimonial', color: '#3b82f6', type: 'line'},
                                ]
            },
            
            { 
                id: 'chartInd31_2', 
                titulo: 'Calidad de Activos (A)', 
                leftAxisName: 'porcentajes (%)',
                seriesConfig: [
                    { code: 'A1_1', name: 'Calidad de Activos', color: '#3b82f6', type: 'line'},
                                ]
            },

            { 
                id: 'chartInd31_3', 
                titulo: 'Manejo Administrativo (M)', 
                leftAxisName: 'porcentajes (%)',
                seriesConfig: [
                    { code: 'M1_1', name: 'Manejo Administrativo', color: '#3b82f6', type: 'line'},
                                ]
            },

            { 
                id: 'chartInd31_4', 
                titulo: 'Rentabilidad (E)', 
                leftAxisName: 'porcentajes (%)',
                seriesConfig: [
                    { code: 'E1_1', name: 'Rentabilidad', color: '#10b981', type: 'line'},
                                ]
            },

            { 
                id: 'chartInd31_5', 
                titulo: 'Liquidez (L)', 
                leftAxisName: 'porcentajes (%)',
                seriesConfig: [
                    { code: 'L1_1', name: 'Liquidez', color: '#10b981', type: 'line'},
                                ]
            },

            { 
                id: 'chartInd31_6', 
                titulo: 'Riesgo de Mercado (S)', 
                leftAxisName: 'porcentajes (%)',
                seriesConfig: [
                    { code: 'Tasa_inter_impli', name: 'Riesgo de Mercado', color: '#10b981', type: 'line'},
                                ]
            },

            { 
                id: 'chartInd31_7', 
                titulo: 'Índice CAMELS', 
                leftAxisName: 'porcentajes (%)',
                seriesConfig: [
                    { code: 'Indic_CAMELS_1', name: 'Índice CAMELS', color: '#D9A05B', type: 'line'},
                                ]
            },

            { 
                id: 'chartInd31_8', 
                titulo: 'Índice de Vulnerabilidad Financiera (IVF)', 
                leftAxisName: 'porcentajes (%)',
                seriesConfig: [
                    { code: 'IVF_Cuantitativo', name: 'Índice de Vulnerabilidad Financiera (IVF)', color: '#D9A05B', type: 'line'},
                                ]
            }
        ]
    },

    endeudamiento: {
        titulo: 'IND. PERLAS',
        graficos: [
            { 
                id: 'chartInd31_1', 
                titulo: 'Riesgo Crítico', 
                leftAxisName: 'porcentajes (%)',
                seriesConfig: [
                    { code: 'efic_RA_AC', name: 'Riesgo Crítico', color: '#3b82f6', type: 'line'},
                                ]
            },
            
            { 
                id: 'chartInd31_2', 
                titulo: 'Alto Riesgo', 
                leftAxisName: 'porcentajes (%)',
                seriesConfig: [
                    { code: 'efic_RB_AC', name: 'Alto Riesgo', color: '#3b82f6', type: 'line'},
                                ]
            },

            { 
                id: 'chartInd31_3', 
                titulo: 'Riesgo Medio', 
                leftAxisName: 'porcentajes (%)',
                seriesConfig: [
                    { code: 'efic_RC_AC', name: 'Riesgo Medio', color: '#3b82f6', type: 'line'},
                                ]
            },

            { 
                id: 'chartInd31_4', 
                titulo: 'Puntaje alcanzado por la entidad', 
                leftAxisName: 'número',
                seriesConfig: [
                    { code: 'perlas_acumulado', name: 'Puntaje alcanzado', color: '#10b981', type: 'line'},
                                ]
            },

            { 
                id: 'chartInd31_5', 
                titulo: 'Eficienca Global PERLAS', 
                leftAxisName: 'porcentajes (%)',
                seriesConfig: [
                    { code: 'efic_perlas_acum', name: 'Eficienca Global', color: '#10b981', type: 'line'},
                                ]
            }
        ]
    },

    cobertura: {
        titulo: 'CRÉDITOS',
        graficos: [
            { 
                id: 'chartInd31_1', 
                titulo: 'Cartera por Vencer', 
                leftAxisName: 'millones USD',
                seriesConfig: [
                    { code: 'IF007', name: 'Cartera por Vencer', color: '#3b82f6', type: 'line'},
                                ]
            },
            
            { 
                id: 'chartInd31_2', 
                titulo: 'Cartera Vencida', 
                leftAxisName: 'millones USD',
                seriesConfig: [
                    { code: 'IF009', name: 'Cartera Vencida', color: '#3b82f6', type: 'line'},
                                ]
            },

            { 
                id: 'chartInd31_3', 
                titulo: 'Cartera no dev. int.', 
                leftAxisName: 'millones USD',
                seriesConfig: [
                    { code: 'IF008', name: 'Cartera no dev. int.', color: '#3b82f6', type: 'line'},
                                ]
            },

            { 
                id: 'chartInd31_4', 
                titulo: 'Cart. Productiva vencer', 
                leftAxisName: 'millones USD',
                seriesConfig: [
                    { code: 'IF007_1', name: 'Cart. Productiva vencer', color: '#10b981', type: 'line'},
                                ]
            },

            { 
                id: 'chartInd31_5', 
                titulo: 'Cart. Consumo vencer', 
                leftAxisName: 'millones USD',
                seriesConfig: [
                    { code: 'IF007_2', name: 'Cart. Consumo vencer', color: '#10b981', type: 'line'},
                                ]
            },

            { 
                id: 'chartInd31_6', 
                titulo: 'Cart. Inmobiliario vencer', 
                leftAxisName: 'millones USD',
                seriesConfig: [
                    { code: 'IF007_3', name: 'Cart. Inmobiliario vencer', color: '#10b981', type: 'line'},
                                ]
            },

            { 
                id: 'chartInd31_7', 
                titulo: 'Cart. Microcrédito vencer', 
                leftAxisName: 'millones USD',
                seriesConfig: [
                    { code: 'IF007_4', name: 'Cart. Microcrédito vencer', color: '#D9A05B', type: 'line'},
                                ]
            }
        ]
    },

    maniobra: {
        titulo: 'CRÉDITOS (FLUJOS)',
        graficos: [
            { 
                id: 'chartInd31_1', 
                titulo: 'MOA', 
                leftAxisName: 'millones USD',
                seriesConfig: [
                    { code: 'monto_total', name: 'MOA', color: '#3b82f6', type: 'line'},
                                ]
            },
            
            { 
                id: 'chartInd31_2', 
                titulo: 'Prod. Corporativo', 
                leftAxisName: 'millones USD',
                seriesConfig: [
                    { code: 'proc', name: 'Prod. Corporativo', color: '#3b82f6', type: 'line'},
                                ]
            },

            { 
                id: 'chartInd31_3', 
                titulo: 'Prod. Empresarial', 
                leftAxisName: 'millones USD',
                seriesConfig: [
                    { code: 'prodem', name: 'Prod. Empresarial', color: '#3b82f6', type: 'line'},
                                ]
            },

            { 
                id: 'chartInd31_4', 
                titulo: 'Prod. PYMES', 
                leftAxisName: 'millones USD',
                seriesConfig: [
                    { code: 'prodpy', name: 'P6: Prod. PYMES', color: '#10b981', type: 'line'},
                                ]
            },

            { 
                id: 'chartInd31_5', 
                titulo: 'Consumo', 
                leftAxisName: 'millones USD',
                seriesConfig: [
                    { code: 'cons', name: 'Consumo', color: '#10b981', type: 'line'},
                                ]
            },

            { 
                id: 'chartInd31_6', 
                titulo: 'Inmobiliario', 
                leftAxisName: 'millones USD',
                seriesConfig: [
                    { code: 'inmo', name: 'Inmobiliario', color: '#10b981', type: 'line'},
                                ]
            },

            { 
                id: 'chartInd31_7', 
                titulo: 'Mic. Minorista', 
                leftAxisName: 'millones USD',
                seriesConfig: [
                    { code: 'mino', name: 'Mic. Minorista', color: '#D9A05B', type: 'line'},
                                ]
            },

            { 
                id: 'chartInd31_8', 
                titulo: 'Mic. Acumulación Simple', 
                leftAxisName: 'millones USD',
                seriesConfig: [
                    { code: 'mas', name: 'Mic. Acumulación Simple', color: '#D9A05B', type: 'line'},
                                ]
            },

            { 
                id: 'chartInd31_9', 
                titulo: 'Mic. Acumulación Ampliada', 
                leftAxisName: 'millones USD',
                seriesConfig: [
                    { code: 'maa', name: 'Mic. Acumulación Ampliada', color: '#D9A05B', type: 'line'},
                                ]
            }
        ]
    },

    roa: {
        titulo: 'DEP. PLAZO (FLUJOS)',
        graficos: [
            { 
                id: 'chartInd31_1', 
                titulo: 'Depósitos a Plazo', 
                leftAxisName: 'millones USD',
                seriesConfig: [
                    { code: 'mop', name: 'Depósitos a Plazo', color: '#3b82f6', type: 'line'},
                                ]
            },
            
            { 
                id: 'chartInd31_2', 
                titulo: 'Dep. Plazo 30 - 60 días', 
                leftAxisName: 'millones USD',
                seriesConfig: [
                    { code: 'Plazo30', name: 'Dep. Plazo 30 - 60 días', color: '#3b82f6', type: 'line'},
                                ]
            },

            { 
                id: 'chartInd31_3', 
                titulo: 'Dep. Plazo 61 - 90 días', 
                leftAxisName: 'millones USD',
                seriesConfig: [
                    { code: 'Plazo61', name: 'Dep. Plazo 61 - 90 días', color: '#3b82f6', type: 'line'},
                                ]
            },

            { 
                id: 'chartInd31_4', 
                titulo: 'Dep. Plazo 91 - 120 días', 
                leftAxisName: 'millones USD',
                seriesConfig: [
                    { code: 'Plazo91', name: 'Dep. Plazo 91 - 120 días', color: '#10b981', type: 'line'},
                                ]
            },

            { 
                id: 'chartInd31_5', 
                titulo: 'Dep. Plazo 121 - 180 días', 
                leftAxisName: 'millones USD',
                seriesConfig: [
                    { code: 'Plazo121', name: 'Dep. Plazo 121 - 180 días', color: '#10b981', type: 'line'},
                                ]
            },

            { 
                id: 'chartInd31_6', 
                titulo: 'Dep. Plazo 181 - 360 días', 
                leftAxisName: 'millones USD',
                seriesConfig: [
                    { code: 'Plazo181', name: 'Dep. Plazo 181 - 360 días', color: '#10b981', type: 'line'},
                                ]
            },

            { 
                id: 'chartInd31_7', 
                titulo: 'Dep. Plazo 361 días o más', 
                leftAxisName: 'millones USD',
                seriesConfig: [
                    { code: 'Plazo361', name: 'Dep. Plazo 361 días o más', color: '#10b981', type: 'line'},
                                ]
            }
        ]
    },

    apalancamiento: {
        titulo: 'TASAS DE INT. ACTIVAS',
        graficos: [
            { 
                id: 'chartInd31_1', 
                titulo: 'Tasa Seg. Pro. Corporativo', 
                leftAxisName: 'porcentajes (%)',
                seriesConfig: [
                    { code: 't_proc', name: 'Seg. Pro. Corporativo', color: '#3b82f6', type: 'line'},
                                ]
            },
            
            { 
                id: 'chartInd31_2', 
                titulo: 'Tasa Seg. Pro. Empresarial', 
                leftAxisName: 'porcentajes (%)',
                seriesConfig: [
                    { code: 't_prodem', name: 'Seg. Pro. Empresarial', color: '#3b82f6', type: 'line'},
                                ]
            },

            { 
                id: 'chartInd31_3', 
                titulo: 'Tasa Seg. Pro. PYMES', 
                leftAxisName: 'porcentajes (%)',
                seriesConfig: [
                    { code: 't_prodpy', name: 'Seg. Pro. PYMES', color: '#3b82f6', type: 'line'},
                                ]
            },

            { 
                id: 'chartInd31_4', 
                titulo: 'Tasa Seg. Consumo', 
                leftAxisName: 'porcentajes (%)',
                seriesConfig: [
                    { code: 't_cons', name: 'Seg. Consumo', color: '#3b82f6', type: 'line'},
                                ]
            },

            { 
                id: 'chartInd31_5', 
                titulo: 'Tasa Seg. Inmobiliario', 
                leftAxisName: 'porcentajes (%)',
                seriesConfig: [
                    { code: 't_inmo', name: 'Seg. Inmobiliario', color: '#10b981', type: 'line'},
                                ]
            },

            { 
                id: 'chartInd31_6', 
                titulo: 'Tasa Seg. Microcrédito Minorista', 
                leftAxisName: 'porcentajes (%)',
                seriesConfig: [
                    { code: 't_mino', name: 'Seg. Microcrédito Minorista', color: '#10b981', type: 'line'},
                                ]
            },

            { 
                id: 'chartInd31_7', 
                titulo: 'Tasa Seg. Micro. Acumulación Simple', 
                leftAxisName: 'porcentajes (%)',
                seriesConfig: [
                    { code: 't_mas', name: 'Seg. Micro. Acumulación Simple', color: '#10b981', type: 'line'},
                                ]
            },

            { 
                id: 'chartInd31_8', 
                titulo: 'Tasa Seg. Micro. Acumulación Ampliada', 
                leftAxisName: 'porcentajes (%)',
                seriesConfig: [
                    { code: 't_maa', name: 'Seg. Micro. Acumulación Ampliada', color: '#10b981', type: 'line'}
                                ]
            }
        ]
    },

    activo: {
        titulo: 'TASAS ACTIVAS EQUILIBRIO',
         graficos: [
            { 
                id: 'chartInd31_1', 
                titulo: 'Tasa Seg. Pro. Empresarial', 
                leftAxisName: 'porcentajes (%)',
                seriesConfig: [
                    { code: 'TAEB_Empr', name: 'Seg. Pro. Empresarial', color: '#3b82f6', type: 'line'},
                                ]
            },
            
            { 
                id: 'chartInd31_2', 
                titulo: 'Tasa Seg. Pro. PYMES', 
                leftAxisName: 'porcentajes (%)',
                seriesConfig: [
                    { code: 'TAEB_PYM', name: 'Seg. Pro. PYMES', color: '#3b82f6', type: 'line'},
                                ]
            },

            { 
                id: 'chartInd31_3', 
                titulo: 'Tasa Seg. Consumo', 
                leftAxisName: 'porcentajes (%)',
                seriesConfig: [
                    { code: 'TAEB_Cons', name: 'Seg. Consumo', color: '#3b82f6', type: 'line'},
                                ]
            },

            { 
                id: 'chartInd31_4', 
                titulo: 'Tasa Seg. Inmobiliario', 
                leftAxisName: 'porcentajes (%)',
                seriesConfig: [
                    { code: 'TAEB_Inmo', name: 'Seg. Inmobiliario', color: '#3b82f6', type: 'line'},
                                ]
            },

            { 
                id: 'chartInd31_5', 
                titulo: 'Tasa Seg. Microcrédito Minorista', 
                leftAxisName: 'porcentajes (%)',
                seriesConfig: [
                    { code: 'TAEB_Mino', name: 'Seg. Microcrédito Minorista', color: '#10b981', type: 'line'},
                                ]
            },

            { 
                id: 'chartInd31_6', 
                titulo: 'Tasa Seg. Micro. Acumulación Simple', 
                leftAxisName: 'porcentajes (%)',
                seriesConfig: [
                    { code: 'TAEB_Simpl', name: 'Seg. Micro. Acumulación Simple', color: '#10b981', type: 'line'},
                                ]
            },

            { 
                id: 'chartInd31_7', 
                titulo: 'Tasa Seg. Micro. Acumulación Ampliada', 
                leftAxisName: 'porcentajes (%)',
                seriesConfig: [
                    { code: 'TAEB_Ampli', name: 'Seg. Micro. Acumulación Ampliada', color: '#10b981', type: 'line'},
                                ]
            }
        ]
    },

    roe: {
        titulo: 'TASAS PASIVAS',
        graficos: [
            { 
                id: 'chartInd31_1', 
                titulo: 'Tasa Pasiva Efectiva', 
                leftAxisName: 'porcentajes (%)',
                seriesConfig: [
                    { code: 'TPE', name: 'Tasa Pasiva Efectiva', color: '#3b82f6', type: 'line'},
                                ]
            },
            
            { 
                id: 'chartInd31_2', 
                titulo: 'Tasa Plazo 30 - 60 días', 
                leftAxisName: 'porcentajes (%)',
                seriesConfig: [
                    { code: 'TPE30', name: 'Tasa Plazo 30 - 60 días', color: '#3b82f6', type: 'line'},
                                ]
            },

            { 
                id: 'chartInd31_3', 
                titulo: 'Tasa Plazo 61 - 90 días', 
                leftAxisName: 'porcentajes (%)',
                seriesConfig: [
                    { code: 'TPE61', name: 'Tasa Plazo 61 - 90 días', color: '#3b82f6', type: 'line'},
                                ]
            },

            { 
                id: 'chartInd31_4', 
                titulo: 'Tasa Plazo 91 - 120 días', 
                leftAxisName: 'porcentajes (%)',
                seriesConfig: [
                    { code: 'TPE91', name: 'Tasa Plazo 91 - 120 días', color: '#10b981', type: 'line'},
                                ]
            },

            { 
                id: 'chartInd31_5', 
                titulo: 'Tasa Plazo 121 - 180 días', 
                leftAxisName: 'porcentajes (%)',
                seriesConfig: [
                    { code: 'TPE121', name: 'Tasa Plazo 121 - 180 días', color: '#10b981', type: 'line'},
                                ]
            },

            { 
                id: 'chartInd31_6', 
                titulo: 'Tasa Plazo 181 - 360 días', 
                leftAxisName: 'porcentajes (%)',
                seriesConfig: [
                    { code: 'TPE181', name: 'Tasa Plazo 181 - 360 días', color: '#10b981', type: 'line'},
                                ]
            },

            { 
                id: 'chartInd31_7', 
                titulo: 'Tasa Plazo más 360 días', 
                leftAxisName: 'porcentajes (%)',
                seriesConfig: [
                    { code: 'TPE361', name: 'Tasa Plazo más 360 días', color: '#10b981', type: 'line'},
                                ]
            }
        ]
    }
};

// Función para actualizar filtros y cargar entidades disponibles
async function actualizarFiltrosComparativo() {
    const tamañoFilter = document.getElementById('filtroTamaño').value;
    const provinciaFilter = document.getElementById('filtroProvincia').value;
    const rangoFilter = document.getElementById('filtroRango').value;
    
    // Si no hay datos cargados, cargarlos
    if (allEntitiesData.length === 0) {
        await loadAllEntitiesData();
    }
    
    // Filtrar entidades según criterios
    let entidadesFiltradas = allEntitiesData.filter(entidad => {
        // Excluir la entidad principal del reporte
        if (entidad.Filtro === currentMagazineEntity) return false;
        
        // Aplicar filtros
        if (tamañoFilter !== 'todos' && entidad.Tamaño !== tamañoFilter) return false;
        if (provinciaFilter !== 'todos' && entidad.DPA_PR !== provinciaFilter) return false;
        if (rangoFilter !== 'todos' && entidad.Rango_Activos !== rangoFilter) return false;
        
        return true;
    });
    
    // Actualizar checkbox de entidades
    actualizarCheckboxEntidades(entidadesFiltradas);
}

// Función para actualizar el checkbox de entidades
function actualizarCheckboxEntidades(entidades) {
    const container = document.getElementById('entidadesAdicionalesContainer');
    
    if (entidades.length === 0) {
        container.innerHTML = '<p style="color: #64748b; font-size: 11px; font-style: italic;">No hay entidades disponibles con estos filtros</p>';
        return;
    }
    
    let html = '';
    entidades.forEach(entidad => {
        const isSelected = entidadesSeleccionadas31.includes(entidad.Filtro);
        const isDisabled = !isSelected && entidadesSeleccionadas31.length >= 3;
        
        html += `
            <label style="${isDisabled ? 'opacity: 0.5; cursor: not-allowed;' : ''}">
                <input type="checkbox" 
                       value="${entidad.Filtro}" 
                       data-tamaño="${entidad.Tamaño}"
                       data-provincia="${entidad.DPA_PR}"
                       data-rango="${entidad.Rango_Activos}"
                       ${isSelected ? 'checked' : ''}
                       ${isDisabled ? 'disabled' : ''}
                       onchange="toggleEntidadAdicional(this)">
                ${entidad.Filtro}
            </label>
        `;
    });
    
    container.innerHTML = html;
}

// Función para toggle de entidad adicional
async function toggleEntidadAdicional(checkbox) {
    const entidadNombre = checkbox.value;
    
    if (checkbox.checked) {
        // Agregar entidad
        if (entidadesSeleccionadas31.length >= 3) {
            showMessage('Solo puede seleccionar hasta 3 entidades adicionales', 'warning');
            checkbox.checked = false;
            return;
        }
        
        entidadesSeleccionadas31.push(entidadNombre);
        
        // Cargar datos de la entidad si no están en cache
        if (!datosEntidadesCache31[entidadNombre]) {
            try {
                const data = await loadEntidadData(entidadNombre);
                datosEntidadesCache31[entidadNombre] = data;
            } catch (error) {
                console.error(`Error cargando ${entidadNombre}:`, error);
                checkbox.checked = false;
                entidadesSeleccionadas31 = entidadesSeleccionadas31.filter(e => e !== entidadNombre);
                return;
            }
        }
        
        showMessage(`${entidadNombre} agregada para comparación`, 'success');
    } else {
        // Remover entidad
        entidadesSeleccionadas31 = entidadesSeleccionadas31.filter(e => e !== entidadNombre);
        delete datosEntidadesCache31[entidadNombre];
        showMessage(`${entidadNombre} removida de la comparación`, 'info');
    }
    
    // Actualizar estado de checkboxes (habilitar/deshabilitar)
    actualizarEstadoCheckboxes();
    
    // Re-renderizar gráficos con las nuevas series
    renderizarGraficosIndicadores31(categoriaIndicadorActual31);
}

// Función para actualizar estado de checkboxes
function actualizarEstadoCheckboxes() {
    const checkboxes = document.querySelectorAll('#entidadesAdicionalesContainer input[type="checkbox"]');
    checkboxes.forEach(cb => {
        if (!cb.checked && entidadesSeleccionadas31.length >= 3) {
            cb.disabled = true;
            cb.parentElement.style.opacity = '0.5';
        } else {
            cb.disabled = false;
            cb.parentElement.style.opacity = '1';
        }
    });
}

// Función principal para cambiar categoría
function cambiarCategoriaIndicador31(categoria) {
    categoriaIndicadorActual31 = categoria;
    
    // Actualizar botones activos
    document.querySelectorAll('#page-31 .indicador-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.categoria === categoria) {
            btn.classList.add('active');
        }
    });
    
    renderizarGraficosIndicadores31(categoria);
}

// Función para renderizar gráficos con series adicionales
function renderizarGraficosIndicadores31(categoria) {
    const config = CONFIG_INDICADORES_31[categoria];
    if (!config) return;
    
    // 1. Ocultar contenedores vacíos
    for (let i = 1; i <= 9; i++) {
        const container = document.getElementById(`container-ind31-${i}`);
        if (container) {
            if (i <= config.graficos.length) {
                container.style.display = 'block';
            } else {
                container.style.display = 'none';
            }
        }
    }

    // 2. Renderizar cada gráfico
    config.graficos.forEach((grafico, index) => {
        if (grafico.seriesConfig) {
            // Preparar series adicionales de las entidades seleccionadas
            const seriesAdicionales = [];
            const coloresAdicionales = ['#10b981', '#f59e0b', '#ef4444']; // Verde, Ámbar, Rojo
            
            entidadesSeleccionadas31.forEach((entidadNombre, idx) => {
                const entidadData = datosEntidadesCache31[entidadNombre];
                if (!entidadData) return;
                
                grafico.seriesConfig.forEach((series, seriesIdx) => {
                    const row = entidadData.find(r => r.CUC === series.code || r.Variable === series.code);
                    if (!row) return;
                    
                    const allDateCols = Object.keys(entidadData[0])
                        .filter(k => /^\d{4}-\d{2}$/.test(k))
                        .sort();
                    
                    const data = allDateCols.map(d => parseFloat(row[d]) || 0);
                    
                    seriesAdicionales.push({
                        name: `${series.name} - ${entidadNombre}`,
                        type: 'line',
                        smooth: true,
                        data: data,
                        lineStyle: { 
                            width: 2, 
                            color: coloresAdicionales[idx % coloresAdicionales.length],
                            type: idx === 0 ? 'solid' : idx === 1 ? 'dashed' : 'dotted'
                        },
                        areaStyle: { opacity: 0.05 },
                        symbol: 'circle',
                        symbolSize: 4,
                        label: {
                            show: showChartLabels,
                            position: 'top',
                            formatter: (p) => formatNumber(p.value),
                            fontSize: 7,
                            color: coloresAdicionales[idx % coloresAdicionales.length]
                        }
                    });
                });
            });
            
            // Renderizar gráfico con series adicionales
            renderHistoricoEstructuraGenerico(
                grafico.id,
                grafico.seriesConfig,
                grafico.titulo || 'Indicador Financiero',
                grafico.leftAxisName || '%',
                grafico.rightAxisName || '%'
            );
            
            // Agregar series adicionales al gráfico
            setTimeout(() => {
                const chartDom = document.getElementById(grafico.id);
                if (chartDom) {
                    const chart = echarts.getInstanceByDom(chartDom);
                    if (chart && seriesAdicionales.length > 0) {
                        const currentOption = chart.getOption();
                        const allSeries = [...currentOption.series, ...seriesAdicionales];
                        
                        chart.setOption({
                            series: allSeries,
                            legend: {
                                data: allSeries.map(s => s.name),
                                orient: 'vertical',
                                right: '2%',
                                top: 'center',
                                textStyle: { fontSize: 9 },
                                type: 'scroll'
                            }
                        });
                    }
                }
            }, 100);
        }
    });
}

// Función para inicializar página 31
function renderIndicadoresPage31() {
    // Inicializar filtros
    actualizarFiltrosComparativo();
    
    // Renderizar categoría inicial
    if (categoriaIndicadorActual31) {
        renderizarGraficosIndicadores31(categoriaIndicadorActual31);
    } else {
        cambiarCategoriaIndicador31('estructura');
    }
}


// ==========================================
// FINAL PAGINA 31
// ==========================================









const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(400px); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(400px); opacity: 0; }
    }
`;
document.head.appendChild(style);