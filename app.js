// Sistema de Gestión de Alquileres -

class RentalSystem {
    constructor() {
        this.propiedades = [
            { id: 1, nombre: "Casa Isidro N°1", direccion: "", color: "#4361ee", icon: "fas fa-city" },
            { id: 2, nombre: "Depto Isidro N°2", direccion: "", color: "#7209b7", icon: "fas fa-umbrella-beach" },
            { id: 3, nombre: "Casa Alsina", direccion: "", color: "#f72585", icon: "fas fa-building" },
    
        ];
        
        this.reservas = JSON.parse(localStorage.getItem('rental_reservas')) || this.generarDatosEjemplo();
        this.fechaActual = new Date();
        this.mesActual = this.fechaActual.getMonth();
        this.anoActual = this.fechaActual.getFullYear();
        this.deptoFiltro = 0; // 0 = todos
        this.notificationTimeout = null;
        this.historialFiltrado = [];
        
        this.init();
    }
    
    // ========== FUNCIÓN PARA NORMALIZAR FECHAS ==========
    
    normalizarFecha(fechaStr) {
        // Convierte una fecha string YYYY-MM-DD a Date sin problemas de zona horaria
        if (!fechaStr) return new Date();
        
        if (fechaStr.includes('T')) {
            // Si ya tiene formato ISO
            return new Date(fechaStr);
        } else {
            // Si es solo fecha YYYY-MM-DD, agregar zona horaria local
            const [year, month, day] = fechaStr.split('-').map(Number);
            // NOTA: month - 1 porque en JavaScript los meses van de 0 a 11
            return new Date(year, month - 1, day, 12, 0, 0); // Usamos mediodía para evitar problemas de zona horaria
        }
    }
    
    // ========== SISTEMA MEJORADO DE RECORDATORIOS ==========
    
    generarRecordatorios() {
        const hoy = new Date();
        const manana = new Date();
        manana.setDate(manana.getDate() + 1);
        
        // Limpiar notificaciones del día anterior
        const notificacionMostradaAyer = localStorage.getItem('notificacion_mostrada_hoy');
        const hoyStr = hoy.toDateString();
        
        if (notificacionMostradaAyer !== hoyStr) {
            localStorage.removeItem('notificacion_mostrada_hoy');
        }
        
        const recordatorios = [];
        
        // 1. Buscar check-outs de hoy (limpieza urgente)
        const checkoutsHoy = this.reservas.filter(reserva => {
            const salida = this.normalizarFecha(reserva.fechaSalida);
            const salidaStr = salida.toDateString();
            const hoyStr = hoy.toDateString();
            
            // Solo considerar reservas completadas (no canceladas)
            return reserva.estado !== 'cancelada' && 
                   salidaStr === hoyStr &&
                   (!reserva.limpiezaCompletada || reserva.limpiezaCompletada === false);
        });
        
        checkoutsHoy.forEach(reserva => {
            const propiedad = this.propiedades.find(p => p.id == reserva.propiedad);
            recordatorios.push({
                id: `limpieza_${reserva.id}_hoy`,
                tipo: 'limpieza',
                prioridad: 'urgente',
                fecha: hoy,
                titulo: '⚠️ Limpieza URGENTE',
                descripcion: `Check-out hoy de ${reserva.cliente.nombre}. El departamento queda vacío y necesita limpieza inmediata.`,
                propiedad: reserva.propiedad,
                color: propiedad.color,
                reservaId: reserva.id,
                checklist: this.generarChecklistLimpieza(),
                hora: reserva.horaSalida || '10:00'
            });
        });
        
        // 2. Buscar check-outs de mañana (limpieza programada)
        const checkoutsManana = this.reservas.filter(reserva => {
            const salida = this.normalizarFecha(reserva.fechaSalida);
            const mananaStr = manana.toDateString();
            const salidaStr = salida.toDateString();
            
            return reserva.estado !== 'cancelada' && 
                   salidaStr === mananaStr &&
                   (!reserva.limpiezaProgramada || reserva.limpiezaProgramada === false);
        });
        
        checkoutsManana.forEach(reserva => {
            const propiedad = this.propiedades.find(p => p.id == reserva.propiedad);
            recordatorios.push({
                id: `limpieza_${reserva.id}_manana`,
                tipo: 'limpieza',
                prioridad: 'manana',
                fecha: manana,
                titulo: '📅 Limpieza Programada',
                descripcion: `Mañana check-out de ${reserva.cliente.nombre}. Programar limpieza para el día siguiente.`,
                propiedad: reserva.propiedad,
                color: propiedad.color,
                reservaId: reserva.id,
                checklist: this.generarChecklistLimpieza()
            });
        });
        
        // 3. Buscar check-ins próximos (preparación)
        const en3Dias = new Date();
        en3Dias.setDate(en3Dias.getDate() + 3);
        
        const checkinsProximos = this.reservas.filter(reserva => {
            const entrada = this.normalizarFecha(reserva.fechaEntrada);
            return reserva.estado !== 'cancelada' && 
                   entrada > hoy && 
                   entrada <= en3Dias;
        });
        
        checkinsProximos.forEach(reserva => {
            const propiedad = this.propiedades.find(p => p.id == reserva.propiedad);
            const diasFaltan = Math.ceil((this.normalizarFecha(reserva.fechaEntrada) - hoy) / (1000 * 60 * 60 * 24));
            
            recordatorios.push({
                id: `preparacion_${reserva.id}`,
                tipo: 'preparacion',
                prioridad: diasFaltan === 1 ? 'urgente' : diasFaltan === 2 ? 'manana' : 'normal',
                fecha: this.normalizarFecha(reserva.fechaEntrada),
                titulo: `🏠 Preparar Depto en ${diasFaltan} día${diasFaltan > 1 ? 's' : ''}`,
                descripcion: `Check-in el ${this.formatearFecha(reserva.fechaEntrada)} a las ${reserva.horaEntrada || '14:00'} de ${reserva.cliente.nombre}. Verificar que todo esté listo.`,
                propiedad: reserva.propiedad,
                color: propiedad.color,
                reservaId: reserva.id,
                checklist: this.generarChecklistPreparacion()
            });
        });
        
        // 4. Buscar reservas que empiezan hoy
        const checkinsHoy = this.reservas.filter(reserva => {
            const entrada = this.normalizarFecha(reserva.fechaEntrada);
            return reserva.estado !== 'cancelada' && 
                   entrada.toDateString() === hoy.toDateString();
        });
        
        checkinsHoy.forEach(reserva => {
            const propiedad = this.propiedades.find(p => p.id == reserva.propiedad);
            recordatorios.push({
                id: `checkin_hoy_${reserva.id}`,
                tipo: 'checkin',
                prioridad: 'urgente',
                fecha: hoy,
                titulo: '🔑 Check-in Hoy',
                descripcion: `${reserva.cliente.nombre} llega hoy a las ${reserva.horaEntrada || '14:00'}. Preparar entrega de llaves.`,
                propiedad: reserva.propiedad,
                color: propiedad.color,
                reservaId: reserva.id
            });
        });
        
        // Filtrar recordatorios ya completados
        const completados = JSON.parse(localStorage.getItem('recordatorios_completados')) || [];
        return recordatorios
            .filter(r => !completados.some(c => c.id === r.id && 
                new Date(c.fecha).toDateString() === r.fecha.toDateString()))
            .sort((a, b) => {
                const prioridadOrden = { 'urgente': 1, 'manana': 2, 'normal': 3 };
                return prioridadOrden[a.prioridad] - prioridadOrden[b.prioridad] || a.fecha - b.fecha;
            });
    }
    
    generarChecklistLimpieza() {
        return [
            'Cambiar sábanas y fundas',
            'Limpiar baños a fondo',
            'Aspirar alfombras y pisos',
            'Limpiar cocina y electrodomésticos',
            'Reponer insumos (papel, jabón, etc.)',
            'Vaciar y limpiar basureros',
            'Verificar funcionamiento de todos los equipos',
            'Dejar llaves en lugar seguro'
        ];
    }
    
    generarChecklistPreparacion() {
        return [
            'Verificar limpieza general',
            'Confirmar que haya toallas limpias',
            'Revisar inventario de vajilla',
            'Probar aire acondicionado/calefacción',
            'Verificar funcionamiento de WiFi',
            'Dejar instrucciones claras',
            'Confirmar horario de check-in',
            'Preparar llaves/tarjetas de acceso'
        ];
    }
    
    mostrarRecordatorios() {
        const recordatorios = this.generarRecordatorios();
        const panel = document.getElementById('recordatoriosList');
        const badge = document.getElementById('contadorRecordatorios');
        
        // Actualizar contador
        const noLeidos = recordatorios.length;
        badge.textContent = noLeidos;
        badge.style.display = noLeidos > 0 ? 'flex' : 'none';
        
        if (noLeidos === 0) {
            panel.innerHTML = `
                <div class="empty-state" style="padding: 40px 20px;">
                    <i class="far fa-check-circle" style="font-size: 48px; margin-bottom: 16px; color: #4caf50;"></i>
                    <h3 style="font-size: 16px; margin-bottom: 8px;">¡Todo al día!</h3>
                    <p style="font-size: 13px; color: var(--gray);">No hay recordatorios pendientes.</p>
                </div>
            `;
            return;
        }
        
        let html = '';
        
        recordatorios.forEach(recordatorio => {
            const propiedad = this.propiedades.find(p => p.id == recordatorio.propiedad);
            const fechaStr = recordatorio.fecha.toLocaleDateString('es-ES', {
                weekday: 'short',
                day: 'numeric',
                month: 'short'
            });
            
            // Agregar hora si está disponible
            let horaInfo = '';
            if (recordatorio.hora) {
                horaInfo = ` • ${recordatorio.hora}`;
            }
            
            html += `
                <div class="recordatorio-item ${recordatorio.prioridad}">
                    <div class="recordatorio-header">
                        <div class="recordatorio-titulo">
                            ${recordatorio.titulo}
                        </div>
                        <div class="recordatorio-fecha">
                            ${fechaStr}${horaInfo}
                        </div>
                    </div>
                    
                    <div class="recordatorio-descripcion">
                        ${recordatorio.descripcion}
                    </div>
                    
                    <div class="recordatorio-depto">
                        <div class="recordatorio-color" style="background: ${recordatorio.color};"></div>
                        ${propiedad.nombre}
                    </div>
                    
                    <div class="recordatorio-acciones">
                        <button class="btn-recordatorio btn-marcar-como" data-recordatorio-id="${recordatorio.id}">
                            <i class="fas fa-check"></i> Completado
                        </button>
                        ${recordatorio.checklist ? 
                            `<button class="btn-recordatorio btn-ir-a" data-recordatorio-id="${recordatorio.id}">
                                <i class="fas fa-clipboard-check"></i> Checklist
                            </button>` : ''
                        }
                    </div>
                </div>
            `;
        });
        
        panel.innerHTML = html;
        
        // Asignar event listeners a los botones
        panel.querySelectorAll('.btn-marcar-como').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const recordatorioId = e.target.closest('button').dataset.recordatorioId;
                this.marcarRecordatorioCompletado(recordatorioId);
            });
        });
        
        panel.querySelectorAll('.btn-ir-a').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const recordatorioId = e.target.closest('button').dataset.recordatorioId;
                this.verDetalleRecordatorio(recordatorioId);
            });
        });
        
        // Mostrar notificación si hay recordatorios urgentes
        const urgentes = recordatorios.filter(r => r.prioridad === 'urgente').length;
        if (urgentes > 0 && !localStorage.getItem('notificacion_mostrada_hoy')) {
            this.mostrarNotificacionLimpieza(urgentes);
        }
    }
    
    marcarRecordatorioCompletado(idRecordatorio) {
        const recordatorios = this.generarRecordatorios();
        const recordatorio = recordatorios.find(r => r.id === idRecordatorio);
        
        if (!recordatorio) return;
        
        // Si es una limpieza, marcar en la reserva
        if (recordatorio.tipo === 'limpieza') {
            const reservaIndex = this.reservas.findIndex(r => r.id == recordatorio.reservaId);
            if (reservaIndex !== -1) {
                if (recordatorio.prioridad === 'urgente') {
                    this.reservas[reservaIndex].limpiezaCompletada = true;
                    this.reservas[reservaIndex].fechaLimpieza = new Date().toISOString();
                } else {
                    this.reservas[reservaIndex].limpiezaProgramada = true;
                }
                this.guardarDatos();
            }
        }
        
        // Guardar en localStorage que este recordatorio fue completado
        const completados = JSON.parse(localStorage.getItem('recordatorios_completados')) || [];
        completados.push({
            id: idRecordatorio,
            fecha: new Date().toISOString(),
            tipo: recordatorio.tipo
        });
        localStorage.setItem('recordatorios_completados', JSON.stringify(completados));
        
        // Actualizar lista
        this.mostrarRecordatorios();
        
        // Actualizar contador
        const recordatoriosActualizados = this.generarRecordatorios();
        const sinCompletar = recordatoriosActualizados.length;
        
        document.getElementById('contadorRecordatorios').textContent = sinCompletar;
        document.getElementById('contadorRecordatorios').style.display = sinCompletar > 0 ? 'flex' : 'none';
        
        this.mostrarNotificacion('Recordatorio marcado como completado', 'success');
    }
    
    verDetalleRecordatorio(idRecordatorio) {
        const recordatorios = this.generarRecordatorios();
        const recordatorio = recordatorios.find(r => r.id === idRecordatorio);
        
        if (!recordatorio || !recordatorio.checklist) return;
        
        const propiedad = this.propiedades.find(p => p.id == recordatorio.propiedad);
        const reserva = this.reservas.find(r => r.id == recordatorio.reservaId);
        
        let modalContent = `
            <div class="recordatorio-detalle">
                <div style="margin-bottom: 20px;">
                    <h3 style="font-size: 18px; margin-bottom: 8px; color: var(--dark);">
                        ${recordatorio.titulo}
                    </h3>
                    <p style="color: var(--gray); font-size: 14px;">
                        ${recordatorio.descripcion}
                    </p>
                    <div style="display: flex; align-items: center; gap: 10px; margin-top: 12px;">
                        <div style="display: flex; align-items: center; gap: 6px; padding: 6px 12px; background: rgba(0,0,0,0.05); border-radius: 12px;">
                            <div style="width: 12px; height: 12px; border-radius: 50%; background: ${recordatorio.color};"></div>
                            <span style="font-size: 13px; font-weight: 500;">${propiedad.nombre}</span>
                        </div>
                        <div style="font-size: 13px; color: var(--gray);">
                            <i class="fas fa-user"></i> ${reserva.cliente.nombre}
                        </div>
                        <div style="font-size: 13px; color: var(--gray);">
                            <i class="fas fa-phone"></i> ${reserva.cliente.telefono}
                        </div>
                    </div>
                </div>
                
                <div class="recordatorio-checklist">
                    <h4 style="font-size: 16px; margin-bottom: 16px; display: flex; align-items: center; gap: 8px;">
                        <i class="fas fa-tasks"></i> Checklist de ${recordatorio.tipo === 'limpieza' ? 'Limpieza' : 'Preparación'}
                    </h4>
        `;
        
        recordatorio.checklist.forEach((item, index) => {
            const itemId = `check_${idRecordatorio}_${index}`;
            modalContent += `
                <div class="checklist-item-recordatorio">
                    <input type="checkbox" id="${itemId}" data-recordatorio-id="${idRecordatorio}" data-item-index="${index}">
                    <label for="${itemId}">${item}</label>
                </div>
            `;
        });
        
        modalContent += `
                </div>
                
                <div style="margin-top: 24px; display: flex; gap: 12px; justify-content: flex-end;">
                    <button class="btn btn-secondary" id="btnCerrarChecklist">
                        Cerrar
                    </button>
                    <button class="btn btn-primary" id="btnCompletarChecklist" data-recordatorio-id="${idRecordatorio}">
                        <i class="fas fa-check-double"></i> Marcar Todo Completado
                    </button>
                </div>
            </div>
        `;
        
        // Crear modal temporal
        const modal = document.createElement('div');
        modal.className = 'modal active';
        modal.style.display = 'flex';
        
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 500px;">
                <div class="modal-header">
                    <h2><i class="fas fa-clipboard-list"></i> Checklist Detallado</h2>
                    <button class="btn-close" id="btnCerrarModal">&times;</button>
                </div>
                ${modalContent}
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Event listeners para el modal
        const btnCerrarModal = modal.querySelector('#btnCerrarModal');
        const btnCerrarChecklist = modal.querySelector('#btnCerrarChecklist');
        const btnCompletarChecklist = modal.querySelector('#btnCompletarChecklist');
        
        const closeModal = () => modal.remove();
        
        btnCerrarModal.addEventListener('click', closeModal);
        btnCerrarChecklist.addEventListener('click', closeModal);
        
        // Cerrar al hacer clic en el overlay
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal();
            }
        });
        
        // Event listeners para checkboxes
        modal.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const recordatorioId = e.target.dataset.recordatorioId;
                const itemIndex = parseInt(e.target.dataset.itemIndex);
                this.marcarChecklistItem(recordatorioId, itemIndex);
            });
        });
        
        // Event listener para completar todo
        btnCompletarChecklist.addEventListener('click', (e) => {
            const recordatorioId = e.target.dataset.recordatorioId;
            this.completarChecklist(recordatorioId);
            closeModal();
        });
        
        // Cargar estado del checklist si existe
        this.cargarEstadoChecklist(idRecordatorio);
    }
    
    marcarChecklistItem(idRecordatorio, index) {
        const checklistEstado = JSON.parse(localStorage.getItem('checklist_estado')) || {};
        
        if (!checklistEstado[idRecordatorio]) {
            checklistEstado[idRecordatorio] = [];
        }
        
        const checkbox = document.getElementById(`check_${idRecordatorio}_${index}`);
        const item = document.querySelector(`#check_${idRecordatorio}_${index}`)?.closest('.checklist-item-recordatorio');
        
        if (checkbox && item) {
            if (checkbox.checked) {
                checklistEstado[idRecordatorio][index] = true;
                item.classList.add('completado');
            } else {
                checklistEstado[idRecordatorio][index] = false;
                item.classList.remove('completado');
            }
            
            localStorage.setItem('checklist_estado', JSON.stringify(checklistEstado));
        }
    }
    
    cargarEstadoChecklist(idRecordatorio) {
        const checklistEstado = JSON.parse(localStorage.getItem('checklist_estado')) || {};
        
        if (checklistEstado[idRecordatorio]) {
            checklistEstado[idRecordatorio].forEach((completado, index) => {
                if (completado) {
                    const checkbox = document.getElementById(`check_${idRecordatorio}_${index}`);
                    const item = checkbox?.closest('.checklist-item-recordatorio');
                    
                    if (checkbox && item) {
                        checkbox.checked = true;
                        item.classList.add('completado');
                    }
                }
            });
        }
    }
    
    completarChecklist(idRecordatorio) {
        const recordatorios = this.generarRecordatorios();
        const recordatorio = recordatorios.find(r => r.id === idRecordatorio);
        
        if (!recordatorio) return;
        
        const checklistEstado = JSON.parse(localStorage.getItem('checklist_estado')) || {};
        checklistEstado[idRecordatorio] = recordatorio.checklist.map(() => true);
        localStorage.setItem('checklist_estado', JSON.stringify(checklistEstado));
        
        // Marcar el recordatorio como completado también
        this.marcarRecordatorioCompletado(idRecordatorio);
        
        this.mostrarNotificacion('Checklist completado', 'success');
    }
    
    mostrarNotificacionLimpieza(cantidad) {
        const hoy = new Date().toDateString();
        localStorage.setItem('notificacion_mostrada_hoy', hoy);
        
        let mensaje = '';
        if (cantidad === 1) {
            mensaje = '⚠️ Tienes 1 limpieza urgente para hoy';
        } else {
            mensaje = `⚠️ Tienes ${cantidad} limpiezas urgentes para hoy`;
        }
        
        // Mostrar notificación con mayor duración
        this.mostrarNotificacion(mensaje, 'limpieza', 8000);
    }
    
    // ========== SISTEMA DE HISTORIAL DE RESERVAS ==========
    
    generarHistorialReservas() {
        const hoy = new Date();
        const filtroDepto = parseInt(document.getElementById('filtroDeptoHistorial').value) || 0;
        const filtroMes = parseInt(document.getElementById('filtroMesHistorial').value) || 0;
        const filtroAno = parseInt(document.getElementById('filtroAnoHistorial').value) || 0;
        const filtroEstado = document.getElementById('filtroEstadoHistorial').value;
        const busqueda = document.getElementById('buscarHistorial')?.value || '';
        
        let historial = this.reservas.filter(reserva => {
            // Filtrar por departamento
            if (filtroDepto > 0 && reserva.propiedad != filtroDepto) return false;
            
            const entrada = this.normalizarFecha(reserva.fechaEntrada);
            
            // Filtrar por mes
            if (filtroMes > 0 && (entrada.getMonth() + 1) != filtroMes) return false;
            
            // Filtrar por año
            if (filtroAno > 0 && entrada.getFullYear() != filtroAno) return false;
            
            // Filtrar por estado
            if (filtroEstado === 'completadas') {
                const salida = this.normalizarFecha(reserva.fechaSalida);
                if (salida >= hoy || reserva.estado === 'cancelada') return false;
            }
            if (filtroEstado === 'activas') {
                const salida = this.normalizarFecha(reserva.fechaSalida);
                if (salida < hoy || reserva.estado === 'cancelada') return false;
            }
            if (filtroEstado === 'canceladas' && reserva.estado !== 'cancelada') return false;
            
            // Filtrar por búsqueda
            if (busqueda) {
                const termino = busqueda.toLowerCase();
                return reserva.cliente.nombre.toLowerCase().includes(termino) ||
                       reserva.cliente.dni.includes(termino) ||
                       reserva.cliente.telefono.includes(termino) ||
                       (reserva.cliente.email && reserva.cliente.email.toLowerCase().includes(termino));
            }
            
            return true;
        }).sort((a, b) => {
            // Ordenar por fecha de salida (más reciente primero)
            return this.normalizarFecha(b.fechaSalida) - this.normalizarFecha(a.fechaSalida);
        });
        
        this.historialFiltrado = historial;
        return historial;
    }
    
    mostrarHistorial() {
        const historial = this.generarHistorialReservas();
        const container = document.getElementById('listaHistorial');
        const statsContainer = document.getElementById('historialStats');
        
        if (historial.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="far fa-calendar-times"></i>
                    <h3>No hay reservas en el historial</h3>
                    <p>No se encontraron reservas con los filtros aplicados.</p>
                </div>
            `;
            
            statsContainer.innerHTML = '';
            return;
        }
        
        // Calcular estadísticas
        const hoy = new Date();
        const completadas = historial.filter(r => this.normalizarFecha(r.fechaSalida) < hoy && r.estado !== 'cancelada').length;
        const activas = historial.filter(r => this.normalizarFecha(r.fechaSalida) >= hoy && r.estado !== 'cancelada').length;
        const canceladas = historial.filter(r => r.estado === 'cancelada').length;
        const ingresos = historial.reduce((total, r) => {
            if (r.estado !== 'cancelada' && r.precio) {
                return total + parseFloat(r.precio);
            }
            return total;
        }, 0);
        
        // Mostrar estadísticas
        statsContainer.innerHTML = `
            <div class="historial-stat-card">
                <div class="historial-stat-value">${historial.length}</div>
                <div class="historial-stat-label">Total Reservas</div>
            </div>
            <div class="historial-stat-card">
                <div class="historial-stat-value">${completadas}</div>
                <div class="historial-stat-label">Completadas</div>
            </div>
            <div class="historial-stat-card">
                <div class="historial-stat-value">${activas}</div>
                <div class="historial-stat-label">Activas</div>
            </div>
            <div class="historial-stat-card">
                <div class="historial-stat-value">${canceladas}</div>
                <div class="historial-stat-label">Canceladas</div>
            </div>
        `;
        
        // Mostrar lista de historial
        let html = '';
        
        historial.forEach(reserva => {
            const propiedad = this.propiedades.find(p => p.id == reserva.propiedad);
            const entrada = this.normalizarFecha(reserva.fechaEntrada);
            const salida = this.normalizarFecha(reserva.fechaSalida);
            const hoy = new Date();
            
            let estado = '';
            let estadoClass = '';
            
            if (reserva.estado === 'cancelada') {
                estado = 'Cancelada';
                estadoClass = 'cancelada';
            } else if (salida < hoy) {
                estado = 'Completada';
                estadoClass = 'completada';
            } else {
                estado = 'Activa';
                estadoClass = 'activa';
            }
            
            // Calcular duración
            const duracion = Math.ceil((salida - entrada) / (1000 * 60 * 60 * 24));
            
            html += `
                <div class="historial-item">
                    <div class="historial-item-header">
                        <div class="historial-cliente">
                            <i class="fas fa-user"></i>
                            ${reserva.cliente.nombre}
                        </div>
                        <div class="historial-estado ${estadoClass}">
                            ${estado}
                        </div>
                    </div>
                    
                    <div class="historial-info-grid">
                        <div class="historial-info-item">
                            <strong><i class="fas fa-building"></i> Departamento</strong>
                            <span>${propiedad.nombre}</span>
                        </div>
                        
                        <div class="historial-info-item">
                            <strong><i class="fas fa-calendar-day"></i> Fechas</strong>
                            <span>${this.formatearFecha(reserva.fechaEntrada)} - ${this.formatearFecha(reserva.fechaSalida)}</span>
                        </div>
                        
                        <div class="historial-info-item">
                            <strong><i class="fas fa-clock"></i> Duración</strong>
                            <span>${duracion} ${duracion === 1 ? 'día' : 'días'}</span>
                        </div>
                        
                        <div class="historial-info-item">
                            <strong><i class="fas fa-phone"></i> Contacto</strong>
                            <span>${reserva.cliente.telefono}</span>
                        </div>
                    </div>
                    
                    <div class="historial-info-grid">
                        <div class="historial-info-item">
                            <strong><i class="fas fa-id-card"></i> DNI</strong>
                            <span>${reserva.cliente.dni}</span>
                        </div>
                        
                        <div class="historial-info-item">
                            <strong><i class="fas fa-envelope"></i> Email</strong>
                            <span>${reserva.cliente.email || 'No especificado'}</span>
                        </div>
                        
                        <div class="historial-info-item">
                            <strong><i class="fas fa-users"></i> Personas</strong>
                            <span>${reserva.cantidadPersonas || 1} ${reserva.cantidadPersonas === 1 ? 'persona' : 'personas'}</span>
                        </div>
                        
                        <div class="historial-info-item">
                            <strong><i class="fas fa-clock"></i> Horas</strong>
                            <span>Entrada: ${reserva.horaEntrada || '14:00'}<br>Salida: ${reserva.horaSalida || '10:00'}</span>
                        </div>
                        
                        ${reserva.precio ? `
                            <div class="historial-info-item">
                                <strong><i class="fas fa-money-bill-wave"></i> Precio</strong>
                                <span>$${parseFloat(reserva.precio).toLocaleString('es-AR')}</span>
                            </div>
                        ` : ''}
                    </div>
                    
                    ${reserva.notas ? `
                        <div style="margin-top: 12px; padding: 12px; background: #f8f9fa; border-radius: 8px;">
                            <strong><i class="fas fa-sticky-note"></i> Notas:</strong>
                            <p style="margin-top: 4px; font-size: 13px; color: #666;">${reserva.notas}</p>
                        </div>
                    ` : ''}
                    
                    ${reserva.limpiezaCompletada ? `
                        <div style="margin-top: 12px; padding: 8px 12px; background: #e8f5e9; border-radius: 8px; font-size: 12px; color: #2e7d32;">
                            <i class="fas fa-broom"></i> Limpieza completada: ${reserva.fechaLimpieza ? this.formatearFecha(reserva.fechaLimpieza) : 'Sin fecha'}
                        </div>
                    ` : ''}
                    
                    <div class="reserva-acciones" style="margin-top: 16px;">
                        <button class="btn-small btn-info btn-ver-detalles-historial" data-reserva-id="${reserva.id}">
                            <i class="fas fa-eye"></i> Ver Detalles
                        </button>
                        <button class="btn-small btn-danger btn-eliminar-historial" data-reserva-id="${reserva.id}">
                            <i class="fas fa-trash"></i> Eliminar
                        </button>
                    </div>
                </div>
            `;
        });
        
        container.innerHTML = html;
        
        // Asignar event listeners
        container.querySelectorAll('.btn-ver-detalles-historial').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const reservaId = parseInt(e.target.closest('button').dataset.reservaId);
                this.mostrarDetallesReserva(reservaId);
            });
        });
        
        container.querySelectorAll('.btn-eliminar-historial').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const reservaId = parseInt(e.target.closest('button').dataset.reservaId);
                this.eliminarReservaPermanente(reservaId);
            });
        });
    }
    
    mostrarDetallesReserva(reservaId) {
        const reserva = this.reservas.find(r => r.id === reservaId);
        if (!reserva) return;
        
        const propiedad = this.propiedades.find(p => p.id == reserva.propiedad);
        const entrada = this.normalizarFecha(reserva.fechaEntrada);
        const salida = this.normalizarFecha(reserva.fechaSalida);
        const hoy = new Date();
        
        let estado = '';
        if (reserva.estado === 'cancelada') {
            estado = 'Cancelada';
        } else if (salida < hoy) {
            estado = 'Completada';
        } else {
            estado = 'Activa';
        }
        
        const duracion = Math.ceil((salida - entrada) / (1000 * 60 * 60 * 24));
        
        let mensaje = `
            <div style="max-width: 500px;">
                <h3 style="margin-bottom: 20px; color: var(--primary);">Detalles de Reserva</h3>
                
                <div style="background: white; border-radius: 12px; padding: 20px; border: 2px solid var(--gray-light); margin-bottom: 20px;">
                    <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
                        <div style="width: 12px; height: 12px; border-radius: 50%; background: ${propiedad.color};"></div>
                        <h4 style="font-size: 18px; margin: 0; color: var(--dark);">${propiedad.nombre}</h4>
                        <span style="margin-left: auto; padding: 4px 12px; background: ${estado === 'Completada' ? '#e8f5e9' : estado === 'Cancelada' ? '#ffebee' : '#e3f2fd'}; color: ${estado === 'Completada' ? '#2e7d32' : estado === 'Cancelada' ? '#c62828' : '#1565c0'}; border-radius: 20px; font-size: 12px; font-weight: 600;">${estado}</span>
                    </div>
                    
                    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-bottom: 16px;">
                        <div>
                            <strong style="display: block; font-size: 12px; color: var(--gray); margin-bottom: 4px;">Cliente</strong>
                            <span>${reserva.cliente.nombre}</span>
                        </div>
                        <div>
                            <strong style="display: block; font-size: 12px; color: var(--gray); margin-bottom: 4px;">DNI</strong>
                            <span>${reserva.cliente.dni}</span>
                        </div>
                        <div>
                            <strong style="display: block; font-size: 12px; color: var(--gray); margin-bottom: 4px;">Teléfono</strong>
                            <span>${reserva.cliente.telefono}</span>
                        </div>
                        <div>
                            <strong style="display: block; font-size: 12px; color: var(--gray); margin-bottom: 4px;">Email</strong>
                            <span>${reserva.cliente.email || 'No especificado'}</span>
                        </div>
                    </div>
                    
                    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-bottom: 16px;">
                        <div>
                            <strong style="display: block; font-size: 12px; color: var(--gray); margin-bottom: 4px;">Check-in</strong>
                            <span>${this.formatearFecha(reserva.fechaEntrada)}<br>${reserva.horaEntrada || '14:00'}</span>
                        </div>
                        <div>
                            <strong style="display: block; font-size: 12px; color: var(--gray); margin-bottom: 4px;">Check-out</strong>
                            <span>${this.formatearFecha(reserva.fechaSalida)}<br>${reserva.horaSalida || '10:00'}</span>
                        </div>
                        <div>
                            <strong style="display: block; font-size: 12px; color: var(--gray); margin-bottom: 4px;">Personas</strong>
                            <span>${reserva.cantidadPersonas || 1} ${reserva.cantidadPersonas === 1 ? 'persona' : 'personas'}</span>
                        </div>
                        <div>
                            <strong style="display: block; font-size: 12px; color: var(--gray); margin-bottom: 4px;">Duración</strong>
                            <span>${duracion} ${duracion === 1 ? 'día' : 'días'}</span>
                        </div>
                        <div>
                            <strong style="display: block; font-size: 12px; color: var(--gray); margin-bottom: 4px;">Fecha creación</strong>
                            <span>${this.formatearFecha(reserva.fechaCreacion)}</span>
                        </div>
                    </div>
                    
                    ${reserva.precio ? `
                        <div style="margin-bottom: 16px; padding: 12px; background: #e8f5e9; border-radius: 8px;">
                            <strong style="display: block; font-size: 12px; color: #2e7d32; margin-bottom: 4px;">Precio</strong>
                            <span style="font-size: 18px; font-weight: 700; color: #2e7d32;">$${parseFloat(reserva.precio).toLocaleString('es-AR')}</span>
                        </div>
                    ` : ''}
                    
                    ${reserva.notas ? `
                        <div style="margin-bottom: 16px;">
                            <strong style="display: block; font-size: 12px; color: var(--gray); margin-bottom: 4px;">Notas</strong>
                            <div style="padding: 12px; background: #f8f9fa; border-radius: 8px; font-size: 13px;">${reserva.notas}</div>
                        </div>
                    ` : ''}
                    
                    ${reserva.limpiezaCompletada ? `
                        <div style="padding: 12px; background: #e8f5e9; border-radius: 8px; font-size: 13px; color: #2e7d32;">
                            <i class="fas fa-broom"></i> Limpieza completada: ${reserva.fechaLimpieza ? this.formatearFecha(reserva.fechaLimpieza) : 'Sin fecha específica'}
                        </div>
                    ` : ''}
                </div>
                
                <div style="display: flex; gap: 12px; justify-content: flex-end;">
                    <button class="btn btn-secondary" id="btnCerrarDetalles">
                        Cerrar
                    </button>
                </div>
            </div>
        `;
        
        this.mostrarAlert(mensaje, 'info');
        
        // Event listener para cerrar
        setTimeout(() => {
            const btnCerrar = document.querySelector('#btnCerrarDetalles');
            if (btnCerrar) {
                btnCerrar.addEventListener('click', () => {
                    document.querySelector('.custom-alert-overlay')?.remove();
                });
            }
        }, 100);
    }
    
    eliminarReservaPermanente(id) {
        const reserva = this.reservas.find(r => r.id === id);
        if (!reserva) return;
        
        this.mostrarConfirm(
            `¿Estás seguro de eliminar permanentemente esta reserva del historial?<br><br>` +
            `<strong>Cliente:</strong> ${reserva.cliente.nombre}<br>` +
            `<strong>Fechas:</strong> ${this.formatearFecha(reserva.fechaEntrada)} - ${this.formatearFecha(reserva.fechaSalida)}<br><br>` +
            `<span style="color: var(--danger); font-weight: 600;">Esta acción no se puede deshacer.</span>`,
            () => {
                this.reservas = this.reservas.filter(r => r.id !== id);
                this.guardarDatos();
                
                this.mostrarHistorial();
                this.generarListaReservasConIndicadores();
                this.generarCalendarioMobile();
                this.actualizarEstadisticas();
                this.mostrarNotificacion('Reserva eliminada permanentemente del historial', 'success');
            }
        );
    }
    
    exportarHistorial() {
        const historial = this.generarHistorialReservas();
        
        if (historial.length === 0) {
            this.mostrarNotificacion('No hay datos para exportar', 'warning');
            return;
        }
        
        let csv = 'ID,Departamento,Fecha Entrada,Fecha Salida,Hora Entrada,Hora Salida,Cliente,DNI,Teléfono,Email,Cantidad Personas,Estado,Duración (días),Precio,Notas,Fecha Creación,Limpieza Completada\n';
        
        historial.forEach(reserva => {
            const propiedad = this.propiedades.find(p => p.id == reserva.propiedad);
            const entrada = this.normalizarFecha(reserva.fechaEntrada);
            const salida = this.normalizarFecha(reserva.fechaSalida);
            const duracion = Math.ceil((salida - entrada) / (1000 * 60 * 60 * 24));
            
            let estado = '';
            if (reserva.estado === 'cancelada') {
                estado = 'Cancelada';
            } else if (salida < new Date()) {
                estado = 'Completada';
            } else {
                estado = 'Activa';
            }
            
            const fila = [
                reserva.id,
                `"${propiedad.nombre}"`,
                `"${reserva.fechaEntrada}"`,
                `"${reserva.fechaSalida}"`,
                `"${reserva.horaEntrada || '14:00'}"`,
                `"${reserva.horaSalida || '10:00'}"`,
                `"${reserva.cliente.nombre}"`,
                `"${reserva.cliente.dni}"`,
                `"${reserva.cliente.telefono}"`,
                `"${reserva.cliente.email || ''}"`,
                reserva.cantidadPersonas || 1,
                `"${estado}"`,
                duracion,
                reserva.precio || '0',
                `"${reserva.notas || ''}"`,
                `"${reserva.fechaCreacion}"`,
                reserva.limpiezaCompletada ? 'Sí' : 'No'
            ];
            
            csv += fila.join(',') + '\n';
        });
        
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const fechaExportacion = new Date().toISOString().split('T')[0];
        a.download = `historial-reservas-${fechaExportacion}.csv`;
        a.click();
        
        this.mostrarNotificacion(`Historial exportado (${historial.length} registros)`, 'success');
    }
    
    // ========== SISTEMA MEJORADO DE RESERVAS ==========
    
    generarListaReservasConIndicadores(filtro = '') {
        const hoy = new Date();
        
        // Filtrar reservas activas y próximas
        let reservasFiltradas = this.reservas.filter(r => {
            if (r.estado === 'cancelada') return false;
            
            const entrada = this.normalizarFecha(r.fechaEntrada);
            const salida = this.normalizarFecha(r.fechaSalida);
            
            // Reservas en curso o próximas (hasta 30 días en el futuro)
            const en30Dias = new Date();
            en30Dias.setDate(en30Dias.getDate() + 30);
            
            return (hoy >= entrada && hoy <= salida) || // En curso
                   (entrada > hoy && entrada <= en30Dias); // Próximas (hasta 30 días)
        }).sort((a, b) => {
            // Ordenar por fecha de entrada (más próxima primero)
            const aEntrada = this.normalizarFecha(a.fechaEntrada);
            const bEntrada = this.normalizarFecha(b.fechaEntrada);
            
            // Primero las que están en curso
            const hoy = new Date();
            const aEnCurso = hoy >= this.normalizarFecha(a.fechaEntrada) && hoy <= this.normalizarFecha(a.fechaSalida);
            const bEnCurso = hoy >= this.normalizarFecha(b.fechaEntrada) && hoy <= this.normalizarFecha(b.fechaSalida);
            
            if (aEnCurso && !bEnCurso) return -1;
            if (!aEnCurso && bEnCurso) return 1;
            
            // Luego por fecha de entrada
            return aEntrada - bEntrada;
        });
        
        if (filtro) {
            const termino = filtro.toLowerCase();
            reservasFiltradas = reservasFiltradas.filter(r => 
                r.cliente.nombre.toLowerCase().includes(termino) ||
                r.cliente.dni.includes(termino) ||
                r.cliente.telefono.includes(termino)
            );
        }
        
        const lista = document.getElementById('listaReservas');
        
        if (reservasFiltradas.length === 0) {
            lista.innerHTML = `
                <div class="empty-state">
                    <i class="far fa-calendar-check"></i>
                    <h3>No hay reservas</h3>
                    <p>No hay reservas en curso o próximas.</p>
                    <button class="btn btn-primary" id="btnCrearPrimeraReserva" style="margin-top: 20px;">
                        <i class="fas fa-plus"></i> Crear primera reserva
                    </button>
                </div>
            `;
            
            // Event listener para el botón
            const btn = lista.querySelector('#btnCrearPrimeraReserva');
            if (btn) {
                btn.addEventListener('click', () => this.mostrarModalReserva());
            }
            
            return;
        }
        
        lista.innerHTML = '';
        
        reservasFiltradas.forEach(reserva => {
            const propiedad = this.propiedades.find(p => p.id == reserva.propiedad);
            const entrada = this.normalizarFecha(reserva.fechaEntrada);
            const salida = this.normalizarFecha(reserva.fechaSalida);
            const hoy = new Date();
            
            // Determinar el estado de la reserva
            let estado = '';
            let estadoColor = '';
            let estadoIcon = '';
            let estadoInfo = '';
            
            // Reserva en curso
            if (hoy >= entrada && hoy <= salida) {
                const diasTranscurridos = Math.floor((hoy - entrada) / (1000 * 60 * 60 * 24)) + 1;
                const diasTotales = Math.floor((salida - entrada) / (1000 * 60 * 60 * 24)) + 1;
                const diasRestantes = diasTotales - diasTranscurridos;
                
                estado = 'EN CURSO';
                estadoColor = '#4caf50';
                estadoIcon = 'fas fa-home';
                estadoInfo = `Día ${diasTranscurridos} de ${diasTotales} (Quedan ${diasRestantes} días)`;
            } 
            // Reserva próxima (futura)
            else {
                const diasFaltan = Math.ceil((entrada - hoy) / (1000 * 60 * 60 * 24));
                estado = 'PRÓXIMA';
                estadoColor = '#2196f3';
                estadoIcon = 'fas fa-calendar-alt';
                estadoInfo = `En ${diasFaltan} día${diasFaltan > 1 ? 's' : ''}`;
            }
            
            // Determinar si necesita indicador de limpieza
            let indicadorLimpieza = '';
            const manana = new Date();
            manana.setDate(manana.getDate() + 1);
            
            if (!reserva.limpiezaCompletada && salida.toDateString() === hoy.toDateString()) {
                indicadorLimpieza = '<span class="indicador-limpieza" title="Limpieza urgente para hoy"><i class="fas fa-broom"></i> Limpiar hoy</span>';
            } else if (!reserva.limpiezaProgramada && salida.toDateString() === manana.toDateString()) {
                indicadorLimpieza = '<span class="indicador-limpieza" title="Limpieza programada para mañana"><i class="fas fa-broom"></i> Limpiar mañana</span>';
            }
            
            const item = document.createElement('div');
            item.className = 'reserva-item';
            item.innerHTML = `
                <div class="reserva-header">
                    <div class="reserva-cliente">
                        <i class="fas fa-user"></i>
                        ${reserva.cliente.nombre}
                        ${indicadorLimpieza}
                    </div>
                    <div class="reserva-depto" style="background: ${propiedad.color}">
                        ${propiedad.nombre}
                    </div>
                </div>
                
                <div style="margin: 12px 0;">
                    <div style="display: inline-flex; align-items: center; gap: 8px; padding: 6px 12px; background: ${estadoColor}20; border-radius: 20px; font-size: 12px; font-weight: 600; color: ${estadoColor}; border: 1px solid ${estadoColor}40;">
                        <i class="${estadoIcon}"></i>
                        <span>${estado}</span>
                        <span>•</span>
                        <span>${estadoInfo}</span>
                    </div>
                </div>
                
                <div class="reserva-fechas">
                    <span><i class="fas fa-sign-in-alt"></i> ${this.formatearFecha(reserva.fechaEntrada)} ${reserva.horaEntrada ? `(${reserva.horaEntrada})` : ''}</span>
                    <i class="fas fa-arrow-right"></i>
                    <span><i class="fas fa-sign-out-alt"></i> ${this.formatearFecha(reserva.fechaSalida)} ${reserva.horaSalida ? `(${reserva.horaSalida})` : ''}</span>
                </div>
                
                <div class="reserva-contacto">
                    <span><i class="fas fa-id-card"></i> ${reserva.cliente.dni}</span>
                    <span><i class="fas fa-phone"></i> ${reserva.cliente.telefono}</span>
                    ${reserva.cliente.email ? `<span><i class="fas fa-envelope"></i> ${reserva.cliente.email}</span>` : ''}
                </div>
                
                <div style="margin-top: 8px;">
                    <span style="display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; background: #e3f2fd; border-radius: 12px; font-size: 13px; color: #1565c0;">
                        <i class="fas fa-users"></i> 
                        <span>${reserva.cantidadPersonas || 1} ${reserva.cantidadPersonas === 1 ? 'persona' : 'personas'}</span>
                    </span>
                </div>
                
                ${reserva.notas ? `
                    <div style="margin-top: 12px; padding: 12px; background: #f8f9fa; border-radius: 8px; font-size: 13px; color: #666;">
                        <strong><i class="fas fa-sticky-note"></i> Notas:</strong> ${reserva.notas}
                    </div>
                ` : ''}
                
                <div class="reserva-acciones">
                    <button class="btn-small btn-info btn-editar-reserva" data-reserva-id="${reserva.id}">
                        <i class="fas fa-edit"></i> Editar
                    </button>
                    <button class="btn-small btn-danger btn-cancelar-reserva" data-reserva-id="${reserva.id}">
                        <i class="fas fa-ban"></i> Cancelar
                    </button>
                    ${salida.toDateString() === hoy.toDateString() || 
                      salida.toDateString() === manana.toDateString() ? 
                      `<button class="btn-small btn-checklist-limpieza" data-reserva-id="${reserva.id}" style="background: #ff9800; color: white;">
                        <i class="fas fa-broom"></i> Checklist
                       </button>` : ''}
                </div>
            `;
            lista.appendChild(item);
        });
        
        // Asignar event listeners a los botones
        lista.querySelectorAll('.btn-editar-reserva').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const reservaId = parseInt(e.target.closest('button').dataset.reservaId);
                this.editarReserva(reservaId);
            });
        });
        
        lista.querySelectorAll('.btn-cancelar-reserva').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const reservaId = parseInt(e.target.closest('button').dataset.reservaId);
                this.cancelarReserva(reservaId);
            });
        });
        
        lista.querySelectorAll('.btn-checklist-limpieza').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const reservaId = parseInt(e.target.closest('button').dataset.reservaId);
                this.mostrarChecklistLimpieza(reservaId);
            });
        });
    }
    
    cancelarReserva(id) {
        const reserva = this.reservas.find(r => r.id === id);
        if (!reserva) return;
        
        const propiedad = this.propiedades.find(p => p.id == reserva.propiedad);
        
        this.mostrarConfirm(
            `¿Estás seguro de cancelar esta reserva?<br><br>` +
            `<strong>Cliente:</strong> ${reserva.cliente.nombre}<br>` +
            `<strong>Departamento:</strong> ${propiedad.nombre}<br>` +
            `<strong>Fechas:</strong> ${this.formatearFecha(reserva.fechaEntrada)} - ${this.formatearFecha(reserva.fechaSalida)}<br>` +
            `<strong>Personas:</strong> ${reserva.cantidadPersonas || 1} ${reserva.cantidadPersonas === 1 ? 'persona' : 'personas'}<br><br>` +
            `<span style="color: var(--warning);">La reserva se marcará como cancelada y permanecerá en el historial.</span>`,
            () => {
                const index = this.reservas.findIndex(r => r.id === id);
                if (index !== -1) {
                    this.reservas[index].estado = 'cancelada';
                    this.reservas[index].fechaCancelacion = new Date().toISOString();
                    this.guardarDatos();
                    
                    this.generarListaReservasConIndicadores();
                    this.generarCalendarioMobile();
                    this.generarGridDeptos();
                    this.actualizarEstadisticas();
                    this.mostrarRecordatorios();
                    
                    this.mostrarNotificacion('Reserva cancelada', 'warning');
                }
            }
        );
    }
    
    mostrarChecklistLimpieza(reservaId) {
        const reserva = this.reservas.find(r => r.id == reservaId);
        if (!reserva) return;
        
        const propiedad = this.propiedades.find(p => p.id == reserva.propiedad);
        const hoy = new Date();
        const salida = this.normalizarFecha(reserva.fechaSalida);
        const esHoy = salida.toDateString() === hoy.toDateString();
        
        const modal = document.createElement('div');
        modal.className = 'modal active';
        modal.style.display = 'flex';
        
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2><i class="fas fa-broom"></i> Checklist de Limpieza</h2>
                    <button class="btn-close" id="btnCerrarChecklistModal">&times;</button>
                </div>
                <div class="modal-body">
                    <div style="margin-bottom: 20px; padding: 16px; background: ${esHoy ? '#fff8e1' : '#e3f2fd'}; border-radius: 12px; border-left: 4px solid ${esHoy ? '#ff9800' : '#2196f3'};">
                        <h3 style="font-size: 16px; margin-bottom: 8px; color: ${esHoy ? '#d84315' : '#1565c0'}">
                            ${esHoy ? '⚠️ LIMPIEZA URGENTE' : '📅 LIMPIEZA PROGRAMADA'}
                        </h3>
                        <p style="font-size: 14px; color: #666; margin-bottom: 8px;">
                            Departamento: <strong>${propiedad.nombre}</strong>
                        </p>
                        <p style="font-size: 14px; color: #666; margin-bottom: 8px;">
                            Huésped saliente: <strong>${reserva.cliente.nombre}</strong> (${reserva.cantidadPersonas || 1} ${reserva.cantidadPersonas === 1 ? 'persona' : 'personas'})
                        </p>
                        <p style="font-size: 14px; color: #666;">
                            Fecha check-out: <strong>${this.formatearFecha(reserva.fechaSalida)} ${reserva.horaSalida ? '(' + reserva.horaSalida + ')' : ''}</strong>
                        </p>
                    </div>
                    
                    <div class="checklist-category">
                        <h3><i class="fas fa-broom"></i> Limpieza General</h3>
                        ${this.generarChecklistItems([
                            'Cambiar sábanas y fundas de almohadas',
                            'Limpiar y desinfectar baños',
                            'Aspirar alfombras y lavar pisos',
                            'Limpiar ventanas y espejos',
                            'Polvo en muebles y superficies'
                        ])}
                    </div>
                    
                    <div class="checklist-category">
                        <h3><i class="fas fa-kitchen-set"></i> Cocina</h3>
                        ${this.generarChecklistItems([
                            'Limpiar horno y microondas',
                            'Lavar vajilla y utensilios',
                            'Limpiar refrigerador',
                            'Verificar funcionamiento de electrodomésticos',
                            'Reponer elementos básicos'
                        ])}
                    </div>
                    
                    <div class="checklist-category">
                        <h3><i class="fas fa-shower"></i> Baños</h3>
                        ${this.generarChecklistItems([
                            'Reponer papel higiénico',
                            'Reponer jabón y shampoo',
                            'Limpiar ducha/bañera',
                            'Desinfectar inodoro',
                            'Reponer toallas limpias'
                        ])}
                    </div>
                    
                    <div class="checklist-category">
                        <h3><i class="fas fa-check-circle"></i> Verificación Final</h3>
                        ${this.generarChecklistItems([
                            'Verificar que todas las luces funcionen',
                            'Probar aire acondicionado/calefacción',
                            'Confirmar que WiFi funciona',
                            'Revisar cerraduras y seguridad',
                            'Dejar llaves en lugar designado'
                        ])}
                    </div>
                    
                    <div style="margin-top: 24px; padding: 16px; background: #e8f5e9; border-radius: 12px; border-left: 4px solid #4caf50;">
                        <h4 style="font-size: 14px; margin-bottom: 8px; color: #2e7d32;">
                            <i class="fas fa-clipboard-check"></i> Estado del Departamento
                        </h4>
                        <div style="display: flex; flex-direction: column; gap: 8px; margin-top: 12px;">
                            <label style="display: flex; align-items: center; gap: 8px; font-size: 14px; padding: 8px; border-radius: 8px; background: white;">
                                <input type="radio" name="estado_${reservaId}" value="excelente" checked>
                                <span>Excelente - Listo para nuevo huésped</span>
                            </label>
                            <label style="display: flex; align-items: center; gap: 8px; font-size: 14px; padding: 8px; border-radius: 8px; background: white;">
                                <input type="radio" name="estado_${reservaId}" value="regular">
                                <span>Regular - Necesita atención menor</span>
                            </label>
                            <label style="display: flex; align-items: center; gap: 8px; font-size: 14px; padding: 8px; border-radius: 8px; background: white;">
                                <input type="radio" name="estado_${reservaId}" value="problemas">
                                <span>Con problemas - Reportar mantenimiento</span>
                            </label>
                        </div>
                    </div>
                    
                    <div style="margin-top: 24px; display: flex; gap: 12px; justify-content: flex-end;">
                        <button class="btn btn-secondary" id="btnCancelarLimpieza">
                            Cancelar
                        </button>
                        <button class="btn btn-primary" id="btnMarcarLimpiezaCompletada" data-reserva-id="${reservaId}">
                            <i class="fas fa-check-double"></i> Marcar Limpieza Completada
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Event listeners
        const btnCerrar = modal.querySelector('#btnCerrarChecklistModal');
        const btnCancelar = modal.querySelector('#btnCancelarLimpieza');
        const btnMarcar = modal.querySelector('#btnMarcarLimpiezaCompletada');
        
        const closeModal = () => modal.remove();
        
        btnCerrar.addEventListener('click', closeModal);
        btnCancelar.addEventListener('click', closeModal);
        
        btnMarcar.addEventListener('click', (e) => {
            const reservaId = parseInt(e.target.dataset.reservaId);
            this.marcarLimpiezaCompletada(reservaId);
            closeModal();
        });
        
        // Cerrar al hacer clic en el overlay
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal();
            }
        });
    }
    
    marcarLimpiezaCompletada(reservaId) {
        const estadoSeleccionado = document.querySelector(`input[name="estado_${reservaId}"]:checked`);
        
        if (!estadoSeleccionado) {
            this.mostrarNotificacion('Por favor selecciona el estado del departamento', 'error');
            return;
        }
        
        const index = this.reservas.findIndex(r => r.id == reservaId);
        if (index !== -1) {
            this.reservas[index].limpiezaCompletada = true;
            this.reservas[index].fechaLimpieza = new Date().toISOString();
            this.reservas[index].estadoLimpieza = estadoSeleccionado.value;
            this.guardarDatos();
        }
        
        // Actualizar recordatorios
        this.mostrarRecordatorios();
        
        this.mostrarNotificacion('Limpieza marcada como completada', 'success');
    }
    
    generarDatosEjemplo() {
        const hoy = new Date();
        const reservasEjemplo = [];
        
        // Generar algunas reservas de ejemplo
        for (let i = 1; i <= 3; i++) {
            const fechaInicio = new Date(hoy);
            fechaInicio.setDate(fechaInicio.getDate() + i * 3);
            
            const fechaFin = new Date(fechaInicio);
            fechaFin.setDate(fechaFin.getDate() + 4);
            
            // Precio aleatorio entre 5000 y 20000
            const precio = (Math.floor(Math.random() * 15000) + 5000).toFixed(2);
            
            reservasEjemplo.push({
                id: Date.now() + i,
                propiedad: i,
                fechaEntrada: fechaInicio.toISOString().split('T')[0],
                fechaSalida: fechaFin.toISOString().split('T')[0],
                horaEntrada: '14:00',
                horaSalida: '10:00',
                cliente: {
                    nombre: `Cliente Ejemplo ${i}`,
                    dni: `1234567${i}`,
                    telefono: `+54 9 11 1234-567${i}`,
                    email: `cliente${i}@ejemplo.com`
                },
                cantidadPersonas: Math.floor(Math.random() * 4) + 1, // NUEVO: entre 1 y 4 personas
                notas: `Reserva de ejemplo ${i}`,
                estado: 'confirmada',
                precio: precio,
                fechaCreacion: new Date().toISOString(),
                limpiezaCompletada: false,
                limpiezaProgramada: false
            });
        }
        
        // Añadir una reserva en curso
        const reservaEnCurso = {
            id: Date.now() + 100,
            propiedad: 1,
            fechaEntrada: new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - 2).toISOString().split('T')[0],
            fechaSalida: new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + 3).toISOString().split('T')[0],
            horaEntrada: '14:00',
            horaSalida: '10:00',
            cliente: {
                nombre: 'Cliente En Curso',
                dni: '87654321',
                telefono: '+54 9 11 8765-4321',
                email: 'encurso@ejemplo.com'
            },
            cantidadPersonas: 2, // NUEVO
            notas: 'Reserva actualmente en curso',
            estado: 'confirmada',
            precio: '12000.00',
            fechaCreacion: new Date().toISOString(),
            limpiezaCompletada: false,
            limpiezaProgramada: false
        };
        reservasEjemplo.push(reservaEnCurso);
        
        // Añadir una reserva reciente (completada)
        const reservaReciente = {
            id: Date.now() + 200,
            propiedad: 2,
            fechaEntrada: new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - 10).toISOString().split('T')[0],
            fechaSalida: new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - 3).toISOString().split('T')[0],
            horaEntrada: '14:00',
            horaSalida: '10:00',
            cliente: {
                nombre: 'Cliente Reciente',
                dni: '11223344',
                telefono: '+54 9 11 1122-3344',
                email: 'reciente@ejemplo.com'
            },
            cantidadPersonas: 3, // NUEVO
            notas: 'Reserva recientemente finalizada',
            estado: 'confirmada',
            precio: '15000.00',
            fechaCreacion: new Date().toISOString(),
            limpiezaCompletada: true,
            fechaLimpieza: new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - 2).toISOString(),
            estadoLimpieza: 'excelente'
        };
        reservasEjemplo.push(reservaReciente);
        
        // Añadir una reserva cancelada
        const reservaCancelada = {
            id: Date.now() + 300,
            propiedad: 3,
            fechaEntrada: new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + 5).toISOString().split('T')[0],
            fechaSalida: new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + 8).toISOString().split('T')[0],
            horaEntrada: '14:00',
            horaSalida: '10:00',
            cliente: {
                nombre: 'Cliente Cancelado',
                dni: '55667788',
                telefono: '+54 9 11 5566-7788',
                email: 'cancelado@ejemplo.com'
            },
            cantidadPersonas: 4, // NUEVO
            notas: 'Reserva cancelada por el cliente',
            estado: 'cancelada',
            precio: '8000.00',
            fechaCreacion: new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - 15).toISOString(),
            fechaCancelacion: new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - 10).toISOString(),
            limpiezaCompletada: false
        };
        reservasEjemplo.push(reservaCancelada);
        
        return reservasEjemplo;
    }
    
    // ========== CALENDARIO MEJORADO ==========
    
    getOcupacionesDia(fecha) {
        const fechaStr = fecha.toISOString().split('T')[0];
        const hoy = new Date();
        
        return this.reservas.filter(reserva => {
            // Filtrar por departamento si está activo el filtro
            if (this.deptoFiltro > 0 && reserva.propiedad != this.deptoFiltro) {
                return false;
            }
            
            // No mostrar reservas canceladas en el calendario
            if (reserva.estado === 'cancelada') {
                return false;
            }
            
            // Usar fechas normalizadas
            const entrada = this.normalizarFecha(reserva.fechaEntrada);
            const salida = this.normalizarFecha(reserva.fechaSalida);
            
            // Normalizar la fecha del día que estamos evaluando
            const fechaDia = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate(), 12, 0, 0);
            
            // Solo mostrar en calendario si:
            // 1. La reserva aún no ha terminado (check-out)
            // 2. O si terminó hace menos de 2 días (para mostrar check-outs recientes)
            const dosDiasAtras = new Date();
            dosDiasAtras.setDate(dosDiasAtras.getDate() - 2);
            
            if (salida < dosDiasAtras && !reserva.limpiezaCompletada) {
                return false; // No mostrar reservas muy antiguas sin limpieza
            }
            
            // Función para comparar si dos fechas son el mismo día
            const esMismoDia = (fecha1, fecha2) => {
                return fecha1.getDate() === fecha2.getDate() && 
                       fecha1.getMonth() === fecha2.getMonth() && 
                       fecha1.getFullYear() === fecha2.getFullYear();
            };
            
            // Es día de check-in
            if (esMismoDia(fechaDia, entrada)) {
                return true;
            }
            
            // Es día intermedio
            if (fechaDia > entrada && fechaDia < salida) {
                return true;
            }
            
            // Es día de check-out
            if (esMismoDia(fechaDia, salida)) {
                return true;
            }
            
            return false;
        });
    }
    
    crearCeldaCalendario(dia, esOtroMes, esHoy = false, estaOcupado = false, fecha = null, ocupaciones = []) {
        const div = document.createElement('div');
        div.className = 'calendar-day';
        
        if (esOtroMes) div.classList.add('other-month');
        if (esHoy) div.classList.add('today');
        
        // Determinar tipos de eventos en este día
        let tieneCheckin = false;
        let tieneCheckout = false;
        let tieneOcupacionIntermedia = false;
        let reservaCompletada = false;
        
        if (estaOcupado && !esOtroMes && fecha) {
            // Normalizar la fecha del día
            const fechaNormalizada = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate(), 12, 0, 0);
            
            ocupaciones.forEach(ocupacion => {
                const entrada = this.normalizarFecha(ocupacion.fechaEntrada);
                const salida = this.normalizarFecha(ocupacion.fechaSalida);
                
                // Función para comparar si dos fechas son el mismo día
                const esMismoDia = (fecha1, fecha2) => {
                    return fecha1.getDate() === fecha2.getDate() && 
                           fecha1.getMonth() === fecha2.getMonth() && 
                           fecha1.getFullYear() === fecha2.getFullYear();
                };
                
                if (esMismoDia(fechaNormalizada, entrada)) {
                    tieneCheckin = true;
                }
                if (esMismoDia(fechaNormalizada, salida)) {
                    tieneCheckout = true;
                    
                    // Marcar como completada si la limpieza ya fue hecha
                    const hoy = new Date();
                    if (ocupacion.limpiezaCompletada && salida < hoy) {
                        reservaCompletada = true;
                    }
                }
                if (fechaNormalizada > entrada && fechaNormalizada < salida) {
                    tieneOcupacionIntermedia = true;
                }
            });
        }
        
        // Aplicar clases según los eventos
        if (estaOcupado && !esOtroMes) {
            if (reservaCompletada) {
                div.classList.add('completed');
            } else {
                div.classList.add('occupied');
                
                if (tieneCheckin && tieneCheckout) {
                    div.classList.add('checkin-checkout-same-day');
                    div.classList.add('has-checkin');
                    div.classList.add('has-checkout');
                } else if (tieneCheckin) {
                    div.classList.add('checkin');
                    div.classList.add('has-checkin');
                } else if (tieneCheckout) {
                    div.classList.add('checkout');
                    div.classList.add('has-checkout');
                }
                
                if (tieneOcupacionIntermedia && !(tieneCheckin && tieneCheckout)) {
                    div.classList.add('intermediate');
                }
            }
        }
        
        // Número del día
        const numSpan = document.createElement('span');
        numSpan.className = 'calendar-day-number';
        numSpan.textContent = dia;
        
        // Estado (puntos de color para cada propiedad ocupada)
        const statusDiv = document.createElement('div');
        statusDiv.className = 'calendar-day-status';
        
        if (estaOcupado && !esOtroMes && !reservaCompletada) {
            const deptosOcupados = new Set(ocupaciones.map(o => o.propiedad));
            
            // Si hay check-in y check-out el mismo día, mostramos iconos especiales
            if (tieneCheckin && tieneCheckout) {
                const iconContainer = document.createElement('div');
                iconContainer.className = 'double-event-icons';
                iconContainer.innerHTML = `
                    <span class="event-icon checkin-icon" title="Check-in">
                        <i class="fas fa-sign-in-alt"></i>
                    </span>
                    <span class="event-icon checkout-icon" title="Check-out">
                        <i class="fas fa-sign-out-alt"></i>
                    </span>
                `;
                statusDiv.appendChild(iconContainer);
            } else {
                // Mostrar puntos de color normales
                this.propiedades.forEach(prop => {
                    if (deptosOcupados.has(prop.id)) {
                        const dot = document.createElement('span');
                        dot.className = 'status-dot';
                        dot.style.background = prop.color;
                        statusDiv.appendChild(dot);
                    }
                });
            }
        } else if (reservaCompletada) {
            // Mostrar icono de completado
            const completadoIcon = document.createElement('i');
            completadoIcon.className = 'fas fa-check';
            completadoIcon.style.fontSize = '10px';
            completadoIcon.style.color = '#4caf50';
            statusDiv.appendChild(completadoIcon);
        }
        
        div.appendChild(numSpan);
        div.appendChild(statusDiv);
        
        // Tooltip mejorado
        if (fecha && !esOtroMes) {
            const fechaStr = fecha.toISOString().split('T')[0];
            const fechaFormateada = fecha.toLocaleDateString('es-ES', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
            
            let tooltip = fechaFormateada;
            
            if (estaOcupado) {
                const eventosDia = [];
                
                ocupaciones.forEach(ocupacion => {
                    const propiedad = this.propiedades.find(p => p.id == ocupacion.propiedad);
                    const entrada = this.normalizarFecha(ocupacion.fechaEntrada);
                    const salida = this.normalizarFecha(ocupacion.fechaSalida);
                    
                    const fechaNormalizada = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate(), 12, 0, 0);
                    
                    // Función para comparar si dos fechas son el mismo día
                    const esMismoDia = (fecha1, fecha2) => {
                        return fecha1.getDate() === fecha2.getDate() && 
                               fecha1.getMonth() === fecha2.getMonth() && 
                               fecha1.getFullYear() === fecha2.getFullYear();
                    };
                    
                    if (esMismoDia(fechaNormalizada, entrada)) {
                        eventosDia.push(`✔ Check-in: ${propiedad.nombre} (${ocupacion.cliente.nombre}, ${ocupacion.cantidadPersonas || 1} ${ocupacion.cantidadPersonas === 1 ? 'persona' : 'personas'}) ${ocupacion.horaEntrada || '14:00'}`);
                    }
                    if (esMismoDia(fechaNormalizada, salida)) {
                        let estado = '';
                        if (ocupacion.limpiezaCompletada) {
                            estado = ' [Limpieza completada]';
                        } else if (ocupacion.estado === 'cancelada') {
                            estado = ' [Cancelada]';
                        }
                        eventosDia.push(`✖ Check-out: ${propiedad.nombre} (${ocupacion.cliente.nombre}, ${ocupacion.cantidadPersonas || 1} ${ocupacion.cantidadPersonas === 1 ? 'persona' : 'personas'}) ${ocupacion.horaSalida || '10:00'}${estado}`);
                    }
                    if (fechaNormalizada > entrada && fechaNormalizada < salida) {
                        eventosDia.push(`◉ Ocupado: ${propiedad.nombre} (${ocupacion.cliente.nombre}, ${ocupacion.cantidadPersonas || 1} ${ocupacion.cantidadPersonas === 1 ? 'persona' : 'personas'})`);
                    }
                });
                
                if (eventosDia.length > 0) {
                    tooltip += '\n\n' + eventosDia.join('\n');
                }
            } else {
                tooltip += '\nDisponible';
            }
            
            div.title = tooltip;
            
            div.addEventListener('click', () => {
                this.mostrarDetallesDia(fecha, ocupaciones);
            });
        }
        
        return div;
    }
    // ========== BUSCADOR RÁPIDO DE DISPONIBILIDAD ==========

setupBuscadorDisponibilidad() {
    // Establecer fechas por defecto (hoy y en 7 días)
    const hoy = new Date();
    const en7Dias = new Date();
    en7Dias.setDate(en7Dias.getDate() + 7);
    
    const fechaDesdeInput = document.getElementById('fechaDesdeBusqueda');
    const fechaHastaInput = document.getElementById('fechaHastaBusqueda');
    
    // Formatear fechas para input type="date"
    const formatDateForInput = (date) => {
        return date.toISOString().split('T')[0];
    };
    
    fechaDesdeInput.value = formatDateForInput(hoy);
    fechaHastaInput.value = formatDateForInput(en7Dias);
    
    // Event listeners
    document.getElementById('btnBuscarDisponibilidad').addEventListener('click', () => {
        this.buscarDisponibilidadRapida();
    });
    
    document.getElementById('btnLimpiarBusqueda').addEventListener('click', () => {
        this.limpiarBusquedaDisponibilidad();
    });
    
    // Permitir Enter para buscar
    fechaDesdeInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            this.buscarDisponibilidadRapida();
        }
    });
    
    fechaHastaInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            this.buscarDisponibilidadRapida();
        }
    });
    
    // Validar que fecha hasta sea mayor que fecha desde
    fechaDesdeInput.addEventListener('change', () => {
        const desde = new Date(fechaDesdeInput.value);
        const hasta = new Date(fechaHastaInput.value);
        
        if (hasta <= desde) {
            // Si fecha hasta es menor o igual, ajustar a un día después
            const nuevaHasta = new Date(desde);
            nuevaHasta.setDate(nuevaHasta.getDate() + 1);
            fechaHastaInput.value = formatDateForInput(nuevaHasta);
        }
    });
}

buscarDisponibilidadRapida() {
    const fechaDesde = document.getElementById('fechaDesdeBusqueda').value;
    const fechaHasta = document.getElementById('fechaHastaBusqueda').value;
    
    if (!fechaDesde || !fechaHasta) {
        this.mostrarMensajeDisponibilidad('Por favor selecciona ambas fechas', 'error');
        return;
    }
    
    const inicio = this.normalizarFecha(fechaDesde);
    const fin = this.normalizarFecha(fechaHasta);
    
    if (fin <= inicio) {
        this.mostrarMensajeDisponibilidad('La fecha de fin debe ser posterior a la fecha de inicio', 'error');
        return;
    }
    
    // Calcular duración
    const duracion = Math.ceil((fin - inicio) / (1000 * 60 * 60 * 24)) + 1;
    
    // Buscar disponibilidad para cada departamento
    const resultados = [];
    
    this.propiedades.forEach(propiedad => {
        const disponibilidad = this.verificarDisponibilidadDepartamento(propiedad.id, inicio, fin);
        resultados.push({
            ...propiedad,
            disponibilidad,
            diasDisponibles: disponibilidad.diasDisponibles,
            conflictoCon: disponibilidad.conflictoCon
        });
    });
    
    // Mostrar resultados
    this.mostrarResultadosDisponibilidad(resultados, inicio, fin, duracion);
}

verificarDisponibilidadDepartamento(propiedadId, inicio, fin) {
    const reservasDepto = this.reservas.filter(r => 
        r.propiedad == propiedadId && 
        r.estado !== 'cancelada'
    );
    
    // Si no hay reservas, está completamente disponible
    if (reservasDepto.length === 0) {
        return {
            disponible: true,
            completamenteDisponible: true,
            diasDisponibles: Math.ceil((fin - inicio) / (1000 * 60 * 60 * 24)) + 1,
            conflictoCon: null,
            porcentajeDisponible: 100
        };
    }
    
    // Verificar conflictos día por día
    let diasConConflicto = 0;
    let conflictoConReserva = null;
    
    // Crear un array de fechas en el rango
    const fechas = [];
    const fechaActual = new Date(inicio);
    
    while (fechaActual <= fin) {
        fechas.push(new Date(fechaActual));
        fechaActual.setDate(fechaActual.getDate() + 1);
    }
    
    // Verificar cada día
    fechas.forEach(fecha => {
        const tieneConflicto = reservasDepto.some(reserva => {
            const reservaInicio = this.normalizarFecha(reserva.fechaEntrada);
            const reservaFin = this.normalizarFecha(reserva.fechaSalida);
            
            // Función para comparar si dos fechas son el mismo día
            const esMismoDia = (fecha1, fecha2) => {
                return fecha1.getDate() === fecha2.getDate() && 
                       fecha1.getMonth() === fecha2.getMonth() && 
                       fecha1.getFullYear() === fecha2.getFullYear();
            };
            
            // Verificar si la fecha está dentro de la reserva
            if (esMismoDia(fecha, reservaInicio) || esMismoDia(fecha, reservaFin)) {
                conflictoConReserva = reserva;
                return true;
            }
            
            if (fecha > reservaInicio && fecha < reservaFin) {
                conflictoConReserva = reserva;
                return true;
            }
            
            return false;
        });
        
        if (tieneConflicto) {
            diasConConflicto++;
        }
    });
    
    const totalDias = fechas.length;
    const diasDisponibles = totalDias - diasConConflicto;
    const porcentajeDisponible = Math.round((diasDisponibles / totalDias) * 100);
    
    return {
        disponible: diasDisponibles > 0,
        completamenteDisponible: diasConConflicto === 0,
        diasDisponibles,
        diasConConflicto,
        totalDias,
        conflictoCon: conflictoConReserva,
        porcentajeDisponible
    };
}

mostrarResultadosDisponibilidad(resultados, inicio, fin, duracion) {
    const container = document.getElementById('resultadosDisponibilidad');
    container.style.display = 'block';
    
    // Formatear fechas para mostrar
    const formatoFecha = (fecha) => {
        return fecha.toLocaleDateString('es-ES', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        });
    };
    
    let html = `
        <div class="disponibilidad-resultados">
            <div class="resultado-disponibilidad-header">
                <h4>
                    <i class="fas fa-calendar-check"></i>
                    Disponibilidad del ${formatoFecha(inicio)} al ${formatoFecha(fin)}
                </h4>
                <div class="resultado-dias">
                    ${duracion} ${duracion === 1 ? 'día' : 'días'}
                </div>
            </div>
    `;
    
    // Ordenar resultados: completamente disponibles primero, luego parciales
    resultados.sort((a, b) => {
        if (a.disponibilidad.completamenteDisponible && !b.disponibilidad.completamenteDisponible) return -1;
        if (!a.disponibilidad.completamenteDisponible && b.disponibilidad.completamenteDisponible) return 1;
        return b.disponibilidad.porcentajeDisponible - a.disponibilidad.porcentajeDisponible;
    });
    
    const completamenteDisponibles = resultados.filter(r => r.disponibilidad.completamenteDisponible);
    const parcialmenteDisponibles = resultados.filter(r => r.disponibilidad.disponible && !r.disponibilidad.completamenteDisponible);
    const noDisponibles = resultados.filter(r => !r.disponibilidad.disponible);
    
    // Departamentos completamente disponibles
    if (completamenteDisponibles.length > 0) {
        html += `
            <div style="margin-bottom: 20px;">
                <h5 style="font-size: 14px; font-weight: 600; color: #2e7d32; margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
                    <i class="fas fa-check-circle"></i>
                    Completamente Disponibles (${completamenteDisponibles.length})
                </h5>
                <div class="deptos-disponibles-grid">
        `;
        
        completamenteDisponibles.forEach(depto => {
            html += `
                <div class="depto-disponible-card disponible">
                    <div class="depto-disponible-header">
                        <div class="depto-disponible-color" style="background: ${depto.color};"></div>
                        <div class="depto-disponible-nombre">${depto.nombre}</div>
                        <div class="depto-disponible-estado estado-disponible">
                            Disponible
                        </div>
                    </div>
                    <div class="depto-disponible-info">
                        ✅ Libre por ${duracion} días
                    </div>
                    <div class="depto-disponible-acciones">
                        <button class="btn-reservar-disponible" data-depto-id="${depto.id}" data-fecha-desde="${inicio.toISOString().split('T')[0]}" data-fecha-hasta="${fin.toISOString().split('T')[0]}">
                            <i class="fas fa-calendar-plus"></i> Reservar Ahora
                        </button>
                        <button class="btn-ver-calendario" data-depto-id="${depto.id}">
                            <i class="far fa-calendar-alt"></i> Calendario
                        </button>
                    </div>
                </div>
            `;
        });
        
        html += `</div></div>`;
    }
    
    // Departamentos parcialmente disponibles
    if (parcialmenteDisponibles.length > 0) {
        html += `
            <div style="margin-bottom: 20px;">
                <h5 style="font-size: 14px; font-weight: 600; color: #ef6c00; margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
                    <i class="fas fa-exclamation-triangle"></i>
                    Parcialmente Disponibles (${parcialmenteDisponibles.length})
                </h5>
                <div class="deptos-disponibles-grid">
        `;
        
        parcialmenteDisponibles.forEach(depto => {
            const { diasDisponibles, totalDias, porcentajeDisponible, conflictoCon } = depto.disponibilidad;
            const clienteConflicto = conflictoCon ? conflictoCon.cliente.nombre : '';
            const fechaConflicto = conflictoCon ? `${this.formatearFecha(conflictoCon.fechaEntrada)} - ${this.formatearFecha(conflictoCon.fechaSalida)}` : '';
            
            html += `
                <div class="depto-disponible-card parcial">
                    <div class="depto-disponible-header">
                        <div class="depto-disponible-color" style="background: ${depto.color};"></div>
                        <div class="depto-disponible-nombre">${depto.nombre}</div>
                        <div class="depto-disponible-estado estado-parcial">
                            ${porcentajeDisponible}% Libre
                        </div>
                    </div>
                    <div class="depto-disponible-info">
                        ⚠️ ${diasDisponibles} de ${totalDias} días disponibles
                    </div>
                    ${conflictoCon ? `
                        <div class="depto-disponible-info" style="font-size: 12px; color: #ef6c00;">
                            <strong>Conflicto:</strong> ${clienteConflicto}<br>
                            <strong>Fechas:</strong> ${fechaConflicto}
                        </div>
                    ` : ''}
                    <div class="depto-disponible-acciones">
                        <button class="btn-reservar-disponible" data-depto-id="${depto.id}" data-fecha-desde="${inicio.toISOString().split('T')[0]}" data-fecha-hasta="${fin.toISOString().split('T')[0]}">
                            <i class="fas fa-calendar-plus"></i> Reservar Disponible
                        </button>
                        <button class="btn-ver-calendario" data-depto-id="${depto.id}">
                            <i class="far fa-calendar-alt"></i> Calendario
                        </button>
                    </div>
                </div>
            `;
        });
        
        html += `</div></div>`;
    }
    
    // Departamentos no disponibles
    if (noDisponibles.length > 0) {
        html += `
            <div style="margin-bottom: 20px;">
                <h5 style="font-size: 14px; font-weight: 600; color: #c62828; margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
                    <i class="fas fa-times-circle"></i>
                    No Disponibles (${noDisponibles.length})
                </h5>
                <div class="deptos-disponibles-grid">
        `;
        
        noDisponibles.forEach(depto => {
            const { conflictoCon } = depto.disponibilidad;
            const clienteConflicto = conflictoCon ? conflictoCon.cliente.nombre : '';
            const fechaConflicto = conflictoCon ? `${this.formatearFecha(conflictoCon.fechaEntrada)} - ${this.formatearFecha(conflictoCon.fechaSalida)}` : '';
            
            html += `
                <div class="depto-disponible-card no-disponible">
                    <div class="depto-disponible-header">
                        <div class="depto-disponible-color" style="background: ${depto.color};"></div>
                        <div class="depto-disponible-nombre">${depto.nombre}</div>
                        <div class="depto-disponible-estado estado-no-disponible">
                            Ocupado
                        </div>
                    </div>
                    <div class="depto-disponible-info">
                        ❌ No disponible en este rango
                    </div>
                    ${conflictoCon ? `
                        <div class="depto-disponible-info" style="font-size: 12px; color: #c62828;">
                            <strong>Ocupado por:</strong> ${clienteConflicto}<br>
                            <strong>Fechas:</strong> ${fechaConflicto}
                        </div>
                    ` : ''}
                    <div class="depto-disponible-acciones">
                        <button class="btn-ver-calendario" data-depto-id="${depto.id}" style="width: 100%;">
                            <i class="far fa-calendar-alt"></i> Ver Calendario
                        </button>
                    </div>
                </div>
            `;
        });
        
        html += `</div></div>`;
    }
    
    // Generar sugerencias de fechas alternativas (mantenido pero simplificado)
    const sugerencias = this.generarSugerenciasFechas(inicio, fin);
    
    if (sugerencias.length > 0) {
        html += `
            <div class="sugerencias-disponibilidad">
                <h5>
                    <i class="fas fa-lightbulb"></i>
                    Sugerencias de fechas alternativas
                </h5>
                <div class="lista-sugerencias">
        `;
        
        sugerencias.forEach((sugerencia, index) => {
            if (index < 3) { // Mostrar solo 3 sugerencias
                html += `
                    <div class="sugerencia-item" data-sugerencia-index="${index}">
                        <div class="sugerencia-fechas">
                            ${sugerencia.texto}
                        </div>
                        <div class="sugerencia-deptos">
                            ${sugerencia.deptosDisponibles} departamento${sugerencia.deptosDisponibles !== 1 ? 's' : ''} disponible${sugerencia.deptosDisponibles !== 1 ? 's' : ''}
                        </div>
                    </div>
                `;
            }
        });
        
        html += `</div></div>`;
    }
    
    html += `</div>`;
    container.innerHTML = html;
    
    // Asignar event listeners a los botones
    container.querySelectorAll('.btn-reservar-disponible').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const deptoId = parseInt(e.target.closest('button').dataset.deptoId);
            const fechaDesde = e.target.closest('button').dataset.fechaDesde;
            const fechaHasta = e.target.closest('button').dataset.fechaHasta;
            
            this.crearReservaDesdeDisponibilidad(deptoId, fechaDesde, fechaHasta);
        });
    });
    
    container.querySelectorAll('.btn-ver-calendario').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const deptoId = parseInt(e.target.closest('button').dataset.deptoId);
            this.filtrarCalendarioPorDepto(deptoId);
        });
    });
    
    container.querySelectorAll('.sugerencia-item').forEach(item => {
        item.addEventListener('click', (e) => {
            const index = parseInt(e.target.closest('.sugerencia-item').dataset.sugerenciaIndex);
            this.aplicarSugerencia(index, sugerencias);
        });
    });
    
    // Mostrar mensaje resumen
    const mensaje = this.generarMensajeResumen(completamenteDisponibles.length, parcialmenteDisponibles.length, noDisponibles.length);
    this.mostrarMensajeDisponibilidad(mensaje, 'info');
}

generarMensajeResumen(completos, parciales, noDisponibles) {
    const total = completos + parciales + noDisponibles;
    
    if (completos === total) {
        return `¡Excelente! Todos los departamentos están disponibles en las fechas seleccionadas.`;
    } else if (completos > 0) {
        return `Hay ${completos} departamento${completos !== 1 ? 's' : ''} completamente disponible${completos !== 1 ? 's' : ''} y ${parciales} parcialmente disponible${parciales !== 1 ? 's' : ''}.`;
    } else if (parciales > 0) {
        return `Hay ${parciales} departamento${parciales !== 1 ? 's' : ''} parcialmente disponible${parciales !== 1 ? 's' : ''}. Considera ajustar las fechas para mayor disponibilidad.`;
    } else {
        return `No hay departamentos disponibles en las fechas seleccionadas. Intenta con otras fechas.`;
    }
}

generarSugerenciasFechas(inicio, fin) {
    const sugerencias = [];
    const duracionOriginal = Math.ceil((fin - inicio) / (1000 * 60 * 60 * 24)) + 1;
    
    // Sugerencia 1: Mover fechas 2 días antes
    const inicioAntes = new Date(inicio);
    const finAntes = new Date(fin);
    inicioAntes.setDate(inicioAntes.getDate() - 2);
    finAntes.setDate(finAntes.getDate() - 2);
    
    const deptosDisponiblesAntes = this.contarDeptosCompletamenteDisponibles(inicioAntes, finAntes);
    if (deptosDisponiblesAntes > 0) {
        sugerencias.push({
            tipo: 'antes',
            inicio: inicioAntes,
            fin: finAntes,
            texto: `2 días antes (${this.formatearFechaSugerencia(inicioAntes)} - ${this.formatearFechaSugerencia(finAntes)})`,
            deptosDisponibles: deptosDisponiblesAntes
        });
    }
    
    // Sugerencia 2: Mover fechas 2 días después
    const inicioDespues = new Date(inicio);
    const finDespues = new Date(fin);
    inicioDespues.setDate(inicioDespues.getDate() + 2);
    finDespues.setDate(finDespues.getDate() + 2);
    
    const deptosDisponiblesDespues = this.contarDeptosCompletamenteDisponibles(inicioDespues, finDespues);
    if (deptosDisponiblesDespues > 0) {
        sugerencias.push({
            tipo: 'despues',
            inicio: inicioDespues,
            fin: finDespues,
            texto: `2 días después (${this.formatearFechaSugerencia(inicioDespues)} - ${this.formatearFechaSugerencia(finDespues)})`,
            deptosDisponibles: deptosDisponiblesDespues
        });
    }
    
    // Sugerencia 3: Semana siguiente
    const inicioSemanaSiguiente = new Date(inicio);
    const finSemanaSiguiente = new Date(fin);
    inicioSemanaSiguiente.setDate(inicioSemanaSiguiente.getDate() + 7);
    finSemanaSiguiente.setDate(finSemanaSiguiente.getDate() + 7);
    
    const deptosDisponiblesSemanaSiguiente = this.contarDeptosCompletamenteDisponibles(inicioSemanaSiguiente, finSemanaSiguiente);
    if (deptosDisponiblesSemanaSiguiente > 0) {
        sugerencias.push({
            tipo: 'semana_siguiente',
            inicio: inicioSemanaSiguiente,
            fin: finSemanaSiguiente,
            texto: `Semana siguiente (${this.formatearFechaSugerencia(inicioSemanaSiguiente)} - ${this.formatearFechaSugerencia(finSemanaSiguiente)})`,
            deptosDisponibles: deptosDisponiblesSemanaSiguiente
        });
    }
    
    return sugerencias.sort((a, b) => b.deptosDisponibles - a.deptosDisponibles);
}

contarDeptosCompletamenteDisponibles(inicio, fin) {
    let count = 0;
    
    this.propiedades.forEach(propiedad => {
        const disponibilidad = this.verificarDisponibilidadDepartamento(propiedad.id, inicio, fin);
        if (disponibilidad.completamenteDisponible) {
            count++;
        }
    });
    
    return count;
}

formatearFechaSugerencia(fecha) {
    return fecha.toLocaleDateString('es-ES', {
        day: 'numeric',
        month: 'short'
    });
}

aplicarSugerencia(index, sugerencias) {
    if (sugerencias && sugerencias[index]) {
        const sugerencia = sugerencias[index];
        
        // Actualizar los campos de fecha
        const formatDateForInput = (date) => {
            return date.toISOString().split('T')[0];
        };
        
        document.getElementById('fechaDesdeBusqueda').value = formatDateForInput(sugerencia.inicio);
        document.getElementById('fechaHastaBusqueda').value = formatDateForInput(sugerencia.fin);
        
        // Volver a buscar automáticamente
        setTimeout(() => {
            this.buscarDisponibilidadRapida();
        }, 300);
    }
}

mostrarMensajeDisponibilidad(mensaje, tipo = 'info') {
    // Limpiar mensajes anteriores
    const mensajesAnteriores = document.querySelectorAll('.mensaje-disponibilidad');
    mensajesAnteriores.forEach(msg => msg.remove());
    
    const mensajeDiv = document.createElement('div');
    mensajeDiv.className = `mensaje-disponibilidad ${tipo}`;
    mensajeDiv.innerHTML = `
        <i class="fas fa-${tipo === 'error' ? 'exclamation-circle' : tipo === 'success' ? 'check-circle' : 'info-circle'}"></i>
        <span>${mensaje}</span>
    `;
    
    const resultadosContainer = document.getElementById('resultadosDisponibilidad');
    resultadosContainer.parentNode.insertBefore(mensajeDiv, resultadosContainer);
}

limpiarBusquedaDisponibilidad() {
    // Limpiar resultados
    const container = document.getElementById('resultadosDisponibilidad');
    container.style.display = 'none';
    container.innerHTML = '';
    
    // Limpiar mensajes
    const mensajes = document.querySelectorAll('.mensaje-disponibilidad');
    mensajes.forEach(msg => msg.remove());
    
    // Restablecer fechas a valores por defecto
    const hoy = new Date();
    const en7Dias = new Date();
    en7Dias.setDate(en7Dias.getDate() + 7);
    
    const formatDateForInput = (date) => {
        return date.toISOString().split('T')[0];
    };
    
    document.getElementById('fechaDesdeBusqueda').value = formatDateForInput(hoy);
    document.getElementById('fechaHastaBusqueda').value = formatDateForInput(en7Dias);
    
    this.mostrarNotificacion('Búsqueda limpiada', 'info');
}

crearReservaDesdeDisponibilidad(deptoId, fechaDesde, fechaHasta) {
    // Cerrar resultados de búsqueda
    this.limpiarBusquedaDisponibilidad();
    
    // Llenar formulario de reserva
    const propiedad = this.propiedades.find(p => p.id == deptoId);
    
    if (!propiedad) {
        this.mostrarNotificacion('Departamento no encontrado', 'error');
        return;
    }
    
    // Llenar formulario
    document.getElementById('selectDepto').value = deptoId;
    document.getElementById('fechaEntrada').value = fechaDesde;
    document.getElementById('fechaSalida').value = fechaHasta;
    
    // Mostrar modal de reserva
    this.mostrarModalReserva();
    
    this.mostrarNotificacion(`Formulario preparado para reservar ${propiedad.nombre}`, 'success');
}

filtrarCalendarioPorDepto(deptoId) {
    // Cambiar a vista de calendario
    this.cambiarVista('calendar');
    
    // Aplicar filtro de departamento
    this.deptoFiltro = deptoId;
    this.generarFiltrosDepto();
    this.generarCalendarioMobile();
    
    // Mostrar mensaje
    const propiedad = this.propiedades.find(p => p.id == deptoId);
    if (propiedad) {
        this.mostrarNotificacion(`Mostrando calendario de ${propiedad.nombre}`, 'info');
    }
}
    
    // ========== FUNCIONALIDADES BÁSICAS (MANTENIDAS) ==========
    
    init() {
    this.setupEventListeners();
    this.generarSelectPropiedades();
    this.generarFiltrosDepto();
    this.generarCalendarioMobile();
    this.generarListaReservasConIndicadores();
    this.generarLeyenda();
    this.actualizarEstadisticas();
    this.generarGridDeptos();
    this.setupFechas();
    this.setupGestosTouch();
    
    // Inicializar sistema de recordatorios
    this.inicializarRecordatorios();
    
    // Inicializar sistema de historial
    this.inicializarHistorial();
    
    // NUEVO: Inicializar buscador de disponibilidad
    this.setupBuscadorDisponibilidad();
}
    
    inicializarRecordatorios() {
        // Configurar evento para el badge de recordatorios
        document.getElementById('badgeRecordatorios').addEventListener('click', () => {
            const panel = document.getElementById('recordatoriosPanel');
            panel.classList.toggle('show');
            this.mostrarRecordatorios();
        });
        
        document.getElementById('cerrarRecordatorios').addEventListener('click', () => {
            document.getElementById('recordatoriosPanel').classList.remove('show');
        });
        
        // Cerrar panel al hacer click fuera
        document.addEventListener('click', (e) => {
            const panel = document.getElementById('recordatoriosPanel');
            const badge = document.getElementById('badgeRecordatorios');
            
            if (panel && badge && !panel.contains(e.target) && !badge.contains(e.target)) {
                panel.classList.remove('show');
            }
        });
        
        // Mostrar recordatorios al cargar
        setTimeout(() => {
            this.mostrarRecordatorios();
        }, 1000);
        
        // Actualizar cada 5 minutos
        setInterval(() => {
            this.mostrarRecordatorios();
        }, 5 * 60 * 1000);
    }
    
    inicializarHistorial() {
        // Llenar select de años
        const selectAno = document.getElementById('filtroAnoHistorial');
        const anoActual = new Date().getFullYear();
        
        for (let i = anoActual; i >= anoActual - 5; i--) {
            const option = document.createElement('option');
            option.value = i;
            option.textContent = i;
            selectAno.appendChild(option);
        }
        
        // Llenar select de departamentos
        const selectDepto = document.getElementById('filtroDeptoHistorial');
        this.propiedades.forEach(prop => {
            const option = document.createElement('option');
            option.value = prop.id;
            option.textContent = prop.nombre;
            selectDepto.appendChild(option);
        });
        
        // Event listeners para filtros
        selectDepto.addEventListener('change', () => this.mostrarHistorial());
        document.getElementById('filtroMesHistorial').addEventListener('change', () => this.mostrarHistorial());
        selectAno.addEventListener('change', () => this.mostrarHistorial());
        document.getElementById('filtroEstadoHistorial').addEventListener('change', () => this.mostrarHistorial());
        document.getElementById('buscarHistorial').addEventListener('input', () => this.mostrarHistorial());
    }
    
    setupEventListeners() {
        // Botones principales
        document.getElementById('nuevaReservaBtn').addEventListener('click', () => this.mostrarModalReserva());
        document.getElementById('fabNuevaReserva').addEventListener('click', () => this.mostrarModalReserva());
        
        // Controles de vista
        document.getElementById('viewListBtn').addEventListener('click', () => this.cambiarVista('list'));
        document.getElementById('viewCalendarBtn').addEventListener('click', () => this.cambiarVista('calendar'));
        document.getElementById('viewGridBtn').addEventListener('click', () => this.cambiarVista('grid'));
        document.getElementById('viewHistoryBtn').addEventListener('click', () => this.cambiarVista('history'));
        
        // Controles del calendario
        document.getElementById('prevMonth').addEventListener('click', () => this.cambiarMes(-1));
        document.getElementById('nextMonth').addEventListener('click', () => this.cambiarMes(1));
        
        // Modal reserva
        document.getElementById('cerrarModal').addEventListener('click', () => this.cerrarModal());
        document.getElementById('cancelarReserva').addEventListener('click', () => this.cerrarModal());
        document.getElementById('formReserva').addEventListener('submit', (e) => this.guardarReserva(e));
        
        // Buscador
        document.getElementById('buscarCliente').addEventListener('input', (e) => this.buscarCliente(e.target.value));
        
        // Acciones flotantes
        document.querySelectorAll('.fab-secondary').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
            });
        });
        
        // Abrir/cerrar menú flotante
        document.getElementById('fabNuevaReserva').addEventListener('click', (e) => {
            e.stopPropagation();
            const menu = document.querySelector('.fab-menu');
            menu.classList.toggle('open');
        });
        
        // Cerrar menú al hacer click fuera
        document.addEventListener('click', () => {
            document.querySelector('.fab-menu').classList.remove('open');
        });
        
        // Validación de fechas
        document.getElementById('fechaEntrada').addEventListener('change', () => this.validarFechas());
        document.getElementById('fechaSalida').addEventListener('change', () => this.validarFechas());
    }
    
    setupGestosTouch() {
        let startX, startY;
        const calendar = document.querySelector('.mobile-calendar');
        
        if (calendar) {
            calendar.addEventListener('touchstart', (e) => {
                startX = e.touches[0].clientX;
                startY = e.touches[0].clientY;
            });
            
            calendar.addEventListener('touchend', (e) => {
                if (!startX || !startY) return;
                
                const endX = e.changedTouches[0].clientX;
                const endY = e.changedTouches[0].clientY;
                
                const diffX = startX - endX;
                const diffY = startY - endY;
                
                // Deslizar horizontalmente para cambiar mes
                if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 50) {
                    if (diffX > 0) {
                        this.cambiarMes(1); // Deslizar izquierda -> mes siguiente
                    } else {
                        this.cambiarMes(-1); // Deslizar derecha -> mes anterior
                    }
                }
                
                startX = null;
                startY = null;
            });
        }
    }
    
    cambiarVista(vista) {
        // Actualizar botones activos
        document.querySelectorAll('.view-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.view-container').forEach(container => container.classList.remove('active'));
        
        switch(vista) {
            case 'list':
                document.getElementById('viewListBtn').classList.add('active');
                document.getElementById('listView').classList.add('active');
                break;
            case 'calendar':
                document.getElementById('viewCalendarBtn').classList.add('active');
                document.getElementById('calendarView').classList.add('active');
                this.generarCalendarioMobile();
                break;
            case 'grid':
                document.getElementById('viewGridBtn').classList.add('active');
                document.getElementById('gridView').classList.add('active');
                this.generarGridDeptos();
                break;
            case 'history':
                document.getElementById('viewHistoryBtn').classList.add('active');
                document.getElementById('historyView').classList.add('active');
                this.mostrarHistorial();
                break;
        }
        
        // Cerrar menú flotante
        document.querySelector('.fab-menu').classList.remove('open');
    }
    
    // ========== FUNCIONES DE SISTEMA (MANTENIDAS) ==========
    
    generarSelectPropiedades() {
        const select = document.getElementById('selectDepto');
        select.innerHTML = '<option value="">Seleccionar...</option>';
        
        this.propiedades.forEach(prop => {
            const option = document.createElement('option');
            option.value = prop.id;
            option.textContent = `${prop.nombre} - ${prop.direccion}`;
            select.appendChild(option);
        });
        
        // También para el modal de disponibilidad
        const selectDispo = document.getElementById('dispoDepto');
        selectDispo.innerHTML = '<option value="0">Todos los departamentos</option>';
        this.propiedades.forEach(prop => {
            const option = document.createElement('option');
            option.value = prop.id;
            option.textContent = `${prop.nombre}`;
            selectDispo.appendChild(option);
        });
    }
    
    generarFiltrosDepto() {
        const container = document.getElementById('deptoFilters');
        container.innerHTML = '';
        
        // Botón "Todos"
        const btnTodos = document.createElement('button');
        btnTodos.className = `filter-btn ${this.deptoFiltro === 0 ? 'active' : ''}`;
        btnTodos.innerHTML = `
            <div class="color-indicator" style="background: #666;"></div>
            Todos
        `;
        btnTodos.addEventListener('click', () => {
            this.deptoFiltro = 0;
            this.generarFiltrosDepto();
            this.generarCalendarioMobile();
        });
        container.appendChild(btnTodos);
        
        // Botones para cada departamento
        this.propiedades.forEach(prop => {
            const btn = document.createElement('button');
            btn.className = `filter-btn ${this.deptoFiltro === prop.id ? 'active' : ''}`;
            btn.innerHTML = `
                <div class="color-indicator" style="background: ${prop.color};"></div>
                ${prop.nombre}
            `;
            btn.addEventListener('click', () => {
                this.deptoFiltro = prop.id;
                this.generarFiltrosDepto();
                this.generarCalendarioMobile();
            });
            container.appendChild(btn);
        });
    }
    
    generarCalendarioMobile() {
        const hoy = new Date();
        const primerDiaMes = new Date(this.anoActual, this.mesActual, 1);
        const ultimoDiaMes = new Date(this.anoActual, this.mesActual + 1, 0);
        const diasEnMes = ultimoDiaMes.getDate();
        const primerDiaSemana = primerDiaMes.getDay();
        
        // Actualizar título del mes
        const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
                      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
        document.getElementById('mesActual').textContent = `${meses[this.mesActual]} ${this.anoActual}`;
        
        // Generar encabezado de días de la semana
        const weekHeader = document.getElementById('weekHeader');
        const diasSemana = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
        weekHeader.innerHTML = diasSemana.map(dia => 
            `<div class="week-day">${dia}</div>`
        ).join('');
        
        // Generar cuadrícula del mes
        const monthGrid = document.getElementById('monthGrid');
        monthGrid.innerHTML = '';
        
        // Días del mes anterior (para completar primera semana)
        for (let i = 0; i < primerDiaSemana; i++) {
            const diaAnterior = new Date(this.anoActual, this.mesActual, -i);
            const cell = this.crearCeldaCalendario(diaAnterior.getDate(), true);
            monthGrid.appendChild(cell);
        }
        
        // Días del mes actual
        for (let dia = 1; dia <= diasEnMes; dia++) {
            const fecha = new Date(this.anoActual, this.mesActual, dia);
            const esHoy = fecha.toDateString() === hoy.toDateString();
            
            // Verificar ocupación
            const ocupaciones = this.getOcupacionesDia(fecha);
            const estaOcupado = ocupaciones.length > 0;
            
            const cell = this.crearCeldaCalendario(dia, false, esHoy, estaOcupado, fecha, ocupaciones);
            monthGrid.appendChild(cell);
        }
        
        // Calcular total de celdas (siempre 42 para 6 semanas)
        const totalCeldas = 42;
        const celdasActuales = primerDiaSemana + diasEnMes;
        
        // Días del mes siguiente (para completar última semana)
        for (let i = 1; i <= (totalCeldas - celdasActuales); i++) {
            const cell = this.crearCeldaCalendario(i, true);
            monthGrid.appendChild(cell);
        }
    }
    
    generarGridDeptos() {
        const grid = document.getElementById('deptosGrid');
        grid.innerHTML = '';
        
        this.propiedades.forEach(propiedad => {
            const reservasDepto = this.reservas.filter(r => r.propiedad == propiedad.id && r.estado !== 'cancelada');
            const reservasFuturas = reservasDepto.filter(r => this.normalizarFecha(r.fechaEntrada) >= new Date());
            const proximaReserva = reservasFuturas.sort((a, b) => this.normalizarFecha(a.fechaEntrada) - this.normalizarFecha(b.fechaEntrada))[0];
            
            const card = document.createElement('div');
            card.className = 'depto-card';
            card.innerHTML = `
                <div class="depto-header">
                    <div class="depto-color" style="background: ${propiedad.color}"></div>
                    <div class="depto-title">${propiedad.nombre}</div>
                </div>
                
                <div class="depto-stats">
                    <div class="stat-item">
                        <span class="stat-value">${reservasDepto.length}</span>
                        <span class="stat-label">Total</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-value">${reservasFuturas.length}</span>
                        <span class="stat-label">Futuras</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-value">${this.calcularOcupacion(propiedad.id)}%</span>
                        <span class="stat-label">Ocupación</span>
                    </div>
                </div>
                
                ${proximaReserva ? `
                    <div class="depto-next-booking">
                        <div class="next-booking-title">Próxima reserva:</div>
                        <div class="next-booking-dates">
                            ${this.formatearFecha(proximaReserva.fechaEntrada)} - ${this.formatearFecha(proximaReserva.fechaSalida)}
                        </div>
                        <div class="next-booking-client">
                            ${proximaReserva.cliente.nombre} (${proximaReserva.cantidadPersonas || 1} ${proximaReserva.cantidadPersonas === 1 ? 'persona' : 'personas'})
                        </div>
                    </div>
                ` : `
                    <div class="depto-next-booking" style="background: #e8f5e9;">
                        <div class="next-booking-title">Estado:</div>
                        <div class="next-booking-dates" style="color: #4caf50;">Disponible</div>
                        <div class="next-booking-client">Sin reservas próximas</div>
                    </div>
                `}
                
                <button class="btn-small btn-info btn-ver-depto" data-depto-id="${propiedad.id}" style="width: 100%; margin-top: 16px;">
                    <i class="fas fa-eye"></i> Ver Detalles
                </button>
            `;
            
            grid.appendChild(card);
        });
        
        // Asignar event listeners a los botones
        grid.querySelectorAll('.btn-ver-depto').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const deptoId = parseInt(e.target.closest('button').dataset.deptoId);
                this.verDepto(deptoId);
            });
        });
    }
    
    calcularOcupacion(propiedadId) {
        const ultimos30Dias = new Date();
        ultimos30Dias.setDate(ultimos30Dias.getDate() - 30);
        
        const reservasDepto = this.reservas.filter(r => 
            r.propiedad == propiedadId && 
            r.estado !== 'cancelada' &&
            this.normalizarFecha(r.fechaEntrada) >= ultimos30Dias
        );
        
        let diasOcupados = 0;
        reservasDepto.forEach(reserva => {
            const entrada = this.normalizarFecha(reserva.fechaEntrada);
            const salida = this.normalizarFecha(reserva.fechaSalida);
            const dias = Math.ceil((salida - entrada) / (1000 * 60 * 60 * 24));
            diasOcupados += dias;
        });
        
        return Math.min(Math.round((diasOcupados / 30) * 100), 100);
    }
    
    formatearFecha(fechaStr) {
        // Asegurarnos de manejar correctamente la fecha
        let fecha;
        
        if (fechaStr.includes('T')) {
            // Si ya tiene formato ISO
            fecha = new Date(fechaStr);
        } else {
            // Si es solo fecha YYYY-MM-DD, usar nuestra función de normalización
            fecha = this.normalizarFecha(fechaStr);
        }
        
        return fecha.toLocaleDateString('es-ES', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    }
    
    actualizarEstadisticas() {
        const hoy = new Date();
        
        // Reservas hoy (solo activas, no canceladas)
        const reservasHoy = this.reservas.filter(r => {
            const entrada = this.normalizarFecha(r.fechaEntrada);
            return entrada.toDateString() === hoy.toDateString() && 
                   r.estado !== 'cancelada';
        }).length;
        document.getElementById('reservasHoy').textContent = reservasHoy;
        
        // Departamentos ocupados hoy (solo activos)
        const deptosOcupados = this.propiedades.filter(prop => 
            this.reservas.some(r => {
                const entrada = this.normalizarFecha(r.fechaEntrada);
                const salida = this.normalizarFecha(r.fechaSalida);
                const hoyObj = new Date();
                return r.propiedad == prop.id && 
                       r.estado !== 'cancelada' &&
                       hoyObj >= entrada && 
                       hoyObj <= salida;
            })
        ).length;
        document.getElementById('deptosOcupados').textContent = deptosOcupados;
        
        // Clientes este mes (solo activos)
        const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
        const clientesMes = new Set(
            this.reservas.filter(r => {
                const entrada = this.normalizarFecha(r.fechaEntrada);
                return entrada >= inicioMes && 
                       r.estado !== 'cancelada';
            })
            .map(r => r.cliente.dni)
        ).size;
        document.getElementById('clientesMes').textContent = clientesMes;
        
        // Próximas llegadas (próximos 7 días, solo activas)
        const en7Dias = new Date();
        en7Dias.setDate(en7Dias.getDate() + 7);
        
        const proximasLlegadas = this.reservas.filter(r => {
            const fechaEntrada = this.normalizarFecha(r.fechaEntrada);
            return r.estado !== 'cancelada' &&
                   fechaEntrada >= new Date() && 
                   fechaEntrada <= en7Dias;
        }).length;
        document.getElementById('proximasLlegadas').textContent = proximasLlegadas;
    }
    
    // ========== FUNCIONES MODALES Y NOTIFICACIONES ==========
    
    mostrarModalReserva() {
        document.getElementById('modalReserva').classList.add('active');
        document.getElementById('fechaEntrada').focus();
        document.querySelector('.fab-menu').classList.remove('open');
    }
    
    cerrarModal() {
        document.getElementById('modalReserva').classList.remove('active');
        document.getElementById('formReserva').reset();
        delete document.getElementById('formReserva').dataset.editingId;
    }
    
    guardarReserva(e) {
        e.preventDefault();
        
        const form = document.getElementById('formReserva');
        const editingId = form.dataset.editingId;
        
        // Obtener horas
        const horaEntrada = document.getElementById('horaEntrada') ? document.getElementById('horaEntrada').value : '14:00';
        const horaSalida = document.getElementById('horaSalida') ? document.getElementById('horaSalida').value : '10:00';
        
        const reserva = {
            id: editingId ? parseInt(editingId) : Date.now(),
            propiedad: parseInt(document.getElementById('selectDepto').value),
            fechaEntrada: document.getElementById('fechaEntrada').value,
            fechaSalida: document.getElementById('fechaSalida').value,
            horaEntrada: horaEntrada,
            horaSalida: horaSalida,
            cliente: {
                nombre: document.getElementById('nombreCliente').value,
                dni: document.getElementById('dniCliente').value,
                telefono: document.getElementById('telefonoCliente').value,
                email: document.getElementById('emailCliente').value
            },
            cantidadPersonas: parseInt(document.getElementById('cantidadPersonas').value) || 1, // NUEVO CAMPO
            notas: document.getElementById('notasReserva').value,
            estado: 'confirmada',
            fechaCreacion: new Date().toISOString(),
            limpiezaCompletada: false,
            limpiezaProgramada: false
        };
        
        // Validar disponibilidad (excepto si estamos editando la misma reserva)
        if (!editingId && !this.validarDisponibilidad(reserva)) {
            this.mostrarNotificacion('El departamento no está disponible en esas fechas', 'error');
            return;
        }
        
        if (editingId) {
            // Actualizar reserva existente
            const index = this.reservas.findIndex(r => r.id == editingId);
            if (index !== -1) {
                // Mantener algunos datos existentes
                reserva.precio = this.reservas[index].precio;
                reserva.limpiezaCompletada = this.reservas[index].limpiezaCompletada;
                reserva.limpiezaProgramada = this.reservas[index].limpiezaProgramada;
                reserva.fechaLimpieza = this.reservas[index].fechaLimpieza;
                reserva.estadoLimpieza = this.reservas[index].estadoLimpieza;
                
                this.reservas[index] = reserva;
            }
        } else {
            // Nueva reserva
            this.reservas.push(reserva);
        }
        
        this.guardarDatos();
        
        this.cerrarModal();
        this.generarCalendarioMobile();
        this.generarListaReservasConIndicadores();
        this.generarGridDeptos();
        this.actualizarEstadisticas();
        this.mostrarRecordatorios();
        this.mostrarNotificacion(editingId ? 'Reserva actualizada' : 'Reserva guardada exitosamente', 'success');
    }
    
    validarDisponibilidad(reserva) {
        const entrada = this.normalizarFecha(reserva.fechaEntrada);
        const salida = this.normalizarFecha(reserva.fechaSalida);
        
        return !this.reservas.some(r => {
            if (r.propiedad != reserva.propiedad || r.id === reserva.id || r.estado === 'cancelada') return false;
            
            const rEntrada = this.normalizarFecha(r.fechaEntrada);
            const rSalida = this.normalizarFecha(r.fechaSalida);
            
            // Caso 1: Mismo día check-out y check-in - PERMITIDO
            if (entrada.getTime() === rSalida.getTime() && 
                salida.getTime() === rEntrada.getTime()) {
                return false; // Permitir check-out y check-in el mismo día
            }
            
            // Caso 2: Nueva reserva empieza durante una reserva existente
            if (entrada >= rEntrada && entrada < rSalida) {
                return true;
            }
            
            // Caso 3: Nueva reserva termina durante una reserva existente
            if (salida > rEntrada && salida <= rSalida) {
                return true;
            }
            
            // Caso 4: Nueva reserva contiene completamente a la existente
            if (entrada <= rEntrada && salida >= rSalida) {
                return true;
            }
            
            return false;
        });
    }
    
    editarReserva(id) {
        const reserva = this.reservas.find(r => r.id === id);
        if (!reserva) return;
        
        // Llenar formulario con datos de la reserva
        document.getElementById('selectDepto').value = reserva.propiedad;
        document.getElementById('fechaEntrada').value = reserva.fechaEntrada;
        document.getElementById('fechaSalida').value = reserva.fechaSalida;
        document.getElementById('nombreCliente').value = reserva.cliente.nombre;
        document.getElementById('dniCliente').value = reserva.cliente.dni;
        document.getElementById('telefonoCliente').value = reserva.cliente.telefono;
        document.getElementById('emailCliente').value = reserva.cliente.email || '';
        document.getElementById('cantidadPersonas').value = reserva.cantidadPersonas || 1; // NUEVO
        document.getElementById('notasReserva').value = reserva.notas || '';
        
        // Si existen campos de hora, llenarlos
        if (document.getElementById('horaEntrada') && reserva.horaEntrada) {
            document.getElementById('horaEntrada').value = reserva.horaEntrada;
        }
        if (document.getElementById('horaSalida') && reserva.horaSalida) {
            document.getElementById('horaSalida').value = reserva.horaSalida;
        }
        
        // Guardar el ID para actualización
        document.getElementById('formReserva').dataset.editingId = id;
        
        this.mostrarModalReserva();
    }
    
    buscarCliente(termino) {
        this.generarListaReservasConIndicadores(termino);
    }
    
    verDisponibilidad() {
        document.getElementById('modalDisponibilidad').classList.add('active');
        document.querySelector('.fab-menu').classList.remove('open');
    }
    
    cerrarModalDisponibilidad() {
        document.getElementById('modalDisponibilidad').classList.remove('active');
    }
    
    mostrarDisponibilidad() {
        const deptoId = parseInt(document.getElementById('dispoDepto').value);
        const mesesOffset = parseInt(document.getElementById('dispoMes').value);
        
        if (deptoId > 0) {
            this.deptoFiltro = deptoId;
        } else {
            this.deptoFiltro = 0;
        }
        
        const fechaTemp = new Date();
        fechaTemp.setMonth(fechaTemp.getMonth() + mesesOffset);
        this.mesActual = fechaTemp.getMonth();
        this.anoActual = fechaTemp.getFullYear();
        
        this.cambiarVista('calendar');
        this.generarFiltrosDepto();
        this.generarCalendarioMobile();
        
        this.cerrarModalDisponibilidad();
        
        const propiedad = deptoId > 0 ? this.propiedades.find(p => p.id == deptoId) : null;
        const mensaje = propiedad 
            ? `Mostrando disponibilidad de ${propiedad.nombre}`
            : 'Mostrando disponibilidad de todos los departamentos';
        
        this.mostrarNotificacion(mensaje, 'info');
    }
    
    generarLeyenda() {
        const leyenda = document.getElementById('leyendaPropiedades');
        leyenda.innerHTML = '';
        
        this.propiedades.forEach(prop => {
            const item = document.createElement('div');
            item.className = 'leyenda-item';
            item.innerHTML = `
                <div class="leyenda-color" style="background: ${prop.color}"></div>
                <div class="leyenda-text">${prop.nombre}</div>
            `;
            item.addEventListener('click', () => {
                this.deptoFiltro = prop.id;
                this.cambiarVista('calendar');
                this.generarFiltrosDepto();
                this.generarCalendarioMobile();
            });
            leyenda.appendChild(item);
        });
    }
    
    setupFechas() {
        const hoy = new Date().toISOString().split('T')[0];
        document.getElementById('fechaEntrada').min = hoy;
        document.getElementById('fechaSalida').min = hoy;
    }
    
    validarFechas() {
        const entrada = document.getElementById('fechaEntrada');
        const salida = document.getElementById('fechaSalida');
        
        if (entrada.value && salida.value) {
            if (new Date(salida.value) <= new Date(entrada.value)) {
                salida.setCustomValidity('La fecha de salida debe ser posterior a la de entrada');
            } else {
                salida.setCustomValidity('');
            }
        }
    }
    
    cambiarMes(delta) {
        this.mesActual += delta;
        
        if (this.mesActual < 0) {
            this.mesActual = 11;
            this.anoActual--;
        } else if (this.mesActual > 11) {
            this.mesActual = 0;
            this.anoActual++;
        }
        
        this.generarCalendarioMobile();
    }
    
    guardarDatos() {
        localStorage.setItem('rental_reservas', JSON.stringify(this.reservas));
    }
    
    exportarDatos() {
        let csv = 'Departamento,Fecha Entrada,Fecha Salida,Nombre,DNI,Teléfono,Email,Cantidad Personas,Notas\n';
        
        this.reservas.forEach(reserva => {
            const propiedad = this.propiedades.find(p => p.id == reserva.propiedad);
            const fila = [
                `"${propiedad.nombre}"`,
                `"${reserva.fechaEntrada}"`,
                `"${reserva.fechaSalida}"`,
                `"${reserva.cliente.nombre}"`,
                `"${reserva.cliente.dni}"`,
                `"${reserva.cliente.telefono}"`,
                `"${reserva.cliente.email || ''}"`,
                reserva.cantidadPersonas || 1,
                `"${reserva.notas || ''}"`
            ];
            csv += fila.join(',') + '\n';
        });
        
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `reservas-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        
        this.mostrarNotificacion('Datos exportados a CSV', 'success');
    }
    
    mostrarNotificacion(mensaje, tipo = 'info', duracion = 3000) {
        const notification = document.getElementById('notification');
        const text = document.getElementById('notificationText');
        
        // Limpiar notificaciones anteriores
        notification.classList.remove('show', 'success', 'error', 'warning', 'info', 'limpieza');
        
        // Agregar icono según el tipo
        let icon = 'fas fa-info-circle';
        if (tipo === 'success') icon = 'fas fa-check-circle';
        if (tipo === 'error') icon = 'fas fa-exclamation-circle';
        if (tipo === 'warning') icon = 'fas fa-exclamation-triangle';
        if (tipo === 'limpieza') icon = 'fas fa-broom';
        
        text.innerHTML = `<i class="${icon}"></i> ${mensaje}`;
        notification.classList.add(tipo, 'show');
        
        // Configurar cierre automático
        clearTimeout(this.notificationTimeout);
        this.notificationTimeout = setTimeout(() => {
            notification.classList.remove('show');
        }, duracion);
        
        // Permitir cerrar manualmente
        notification.onclick = () => {
            notification.classList.remove('show');
            clearTimeout(this.notificationTimeout);
        };
    }
    
    // ========== FUNCIONES AUXILIARES ==========
    
    mostrarAlert(mensaje, tipo = 'info') {
        // Crear overlay
        const overlay = document.createElement('div');
        overlay.className = 'custom-alert-overlay active';
        
        // Determinar título e icono según tipo
        let titulo = 'Información';
        let icono = 'fas fa-info-circle';
        let claseBoton = 'custom-alert-btn-confirm';
        
        if (tipo === 'warning') {
            titulo = 'Advertencia';
            icono = 'fas fa-exclamation-triangle';
        } else if (tipo === 'error') {
            titulo = 'Error';
            icono = 'fas fa-exclamation-circle';
            claseBoton = 'custom-alert-btn-danger';
        } else if (tipo === 'success') {
            titulo = 'Éxito';
            icono = 'fas fa-check-circle';
        }
        
        overlay.innerHTML = `
            <div class="custom-alert-container">
                <div class="custom-alert-header">
                    <i class="${icono}"></i>
                    <h3>${titulo}</h3>
                </div>
                <div class="custom-alert-body">
                    <div class="custom-alert-message">${mensaje}</div>
                </div>
                <div class="custom-alert-footer">
                    <button class="custom-alert-btn ${claseBoton}" id="alertConfirmBtn">
                        <i class="fas fa-check"></i> Aceptar
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(overlay);
        
        // Event listener para el botón
        const confirmBtn = overlay.querySelector('#alertConfirmBtn');
        confirmBtn.addEventListener('click', () => {
            overlay.remove();
        });
        
        // Cerrar al hacer clic fuera
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.remove();
            }
        });
        
        // Enfocar el botón para que funcione con Enter
        setTimeout(() => {
            confirmBtn.focus();
        }, 100);
    }
    
    mostrarConfirm(mensaje, callbackConfirm, callbackCancel = null) {
        const overlay = document.createElement('div');
        overlay.className = 'custom-alert-overlay active';
        
        overlay.innerHTML = `
            <div class="custom-alert-container">
                <div class="custom-alert-header">
                    <i class="fas fa-question-circle"></i>
                    <h3>Confirmar</h3>
                </div>
                <div class="custom-alert-body">
                    <div class="custom-alert-message">${mensaje}</div>
                </div>
                <div class="custom-alert-footer">
                    <button class="custom-alert-btn custom-alert-btn-cancel" id="confirmCancelBtn">
                        <i class="fas fa-times"></i> Cancelar
                    </button>
                    <button class="custom-alert-btn custom-alert-btn-danger" id="confirmOkBtn">
                        <i class="fas fa-check"></i> Confirmar
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(overlay);
        
        // Event listeners
        const cancelBtn = overlay.querySelector('#confirmCancelBtn');
        const okBtn = overlay.querySelector('#confirmOkBtn');
        
        const closeOverlay = () => overlay.remove();
        
        cancelBtn.addEventListener('click', () => {
            closeOverlay();
            if (callbackCancel) callbackCancel();
        });
        
        okBtn.addEventListener('click', () => {
            closeOverlay();
            if (callbackConfirm) callbackConfirm();
        });
        
        // Cerrar al hacer clic fuera
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                closeOverlay();
                if (callbackCancel) callbackCancel();
            }
        });
        
        // Enfocar botón cancelar por defecto
        setTimeout(() => {
            cancelBtn.focus();
        }, 100);
    }
    
    mostrarPrompt(mensaje, valorDefault = '', callback) {
        const overlay = document.createElement('div');
        overlay.className = 'custom-alert-overlay active';
        
        overlay.innerHTML = `
            <div class="custom-alert-container">
                <div class="custom-alert-header">
                    <i class="fas fa-edit"></i>
                    <h3>Ingresar valor</h3>
                </div>
                <div class="custom-alert-body">
                    <div class="custom-alert-message">${mensaje}</div>
                    <input type="text" class="custom-alert-input" id="customPromptInput" value="${valorDefault}" placeholder="Ingrese aquí...">
                </div>
                <div class="custom-alert-footer">
                    <button class="custom-alert-btn custom-alert-btn-cancel" id="promptCancelBtn">
                        <i class="fas fa-times"></i> Cancelar
                    </button>
                    <button class="custom-alert-btn custom-alert-btn-confirm" id="promptOkBtn">
                        <i class="fas fa-check"></i> Aceptar
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(overlay);
        
        // Event listeners
        const cancelBtn = overlay.querySelector('#promptCancelBtn');
        const okBtn = overlay.querySelector('#promptOkBtn');
        const input = overlay.querySelector('#customPromptInput');
        
        const closeOverlay = () => overlay.remove();
        
        cancelBtn.addEventListener('click', closeOverlay);
        
        okBtn.addEventListener('click', () => {
            if (input.value.trim()) {
                callback(input.value);
            }
            closeOverlay();
        });
        
        // Enfocar el input
        setTimeout(() => {
            input.focus();
            input.select();
            
            // Permitir Enter para aceptar
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    okBtn.click();
                }
            });
        }, 100);
        
        // Cerrar al hacer clic fuera
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                closeOverlay();
            }
        });
    }
    
    mostrarChecklist() {
        document.querySelector('.fab-menu').classList.remove('open');
        
        const checklistContent = `
            <div class="checklist-category">
                <h3><i class="fas fa-broom"></i> Limpieza</h3>
                ${this.generarChecklistItems([
                    'Cambiar sábanas y fundas',
                    'Limpiar baños completamente',
                    'Aspirar alfombras y pisos',
                    'Limpiar ventanas y espejos',
                    'Reponer papel higiénico',
                    'Reponer jabón y shampoo',
                    'Desinfectar superficies',
                    'Vaciar y limpiar basureros',
                    'Limpiar cocina y electrodomésticos',
                    'Revisar y reponer vajilla'
                ])}
            </div>
            
            <div class="checklist-category">
                <h3><i class="fas fa-tools"></i> Mantenimiento</h3>
                ${this.generarChecklistItems([
                    'Revisar aire acondicionado',
                    'Probar todas las luces',
                    'Verificar llaves de agua',
                    'Probar electrodomésticos',
                    'Revisar cerraduras',
                    'Controlar extintores',
                    'Verificar Wi-Fi',
                    'Revisar persianas/cortinas',
                    'Probar timbre/intercom',
                    'Revisar detector de humo'
                ])}
            </div>
        `;
        
        // Crear modal temporal para checklist
        const modal = document.createElement('div');
        modal.className = 'modal active';
        modal.style.display = 'flex';
        
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2><i class="fas fa-clipboard-check"></i> Checklist de Preparación</h2>
                    <button class="btn-close" id="btnCerrarChecklistGeneral">&times;</button>
                </div>
                <div class="modal-body">
                    ${checklistContent}
                    <div style="margin-top: 20px; text-align: center;">
                        <button class="btn btn-primary" id="btnChecklistListo">
                            <i class="fas fa-check"></i> Listo
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Event listeners
        const btnCerrar = modal.querySelector('#btnCerrarChecklistGeneral');
        const btnListo = modal.querySelector('#btnChecklistListo');
        
        const closeModal = () => modal.remove();
        
        btnCerrar.addEventListener('click', closeModal);
        btnListo.addEventListener('click', closeModal);
        
        // Cerrar al hacer clic en el overlay
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal();
            }
        });
    }
    
    generarChecklistItems(items) {
        return items.map(item => `
            <div class="checklist-item">
                <input type="checkbox" id="check_${item.replace(/\s+/g, '_')}">
                <label for="check_${item.replace(/\s+/g, '_')}">${item}</label>
            </div>
        `).join('');
    }
    
    mostrarReservasHoy() {
        const hoy = new Date();
        const reservasHoy = this.reservas.filter(r => {
            const entrada = this.normalizarFecha(r.fechaEntrada);
            return entrada.toDateString() === hoy.toDateString() && r.estado !== 'cancelada';
        });
        
        if (reservasHoy.length === 0) {
            this.mostrarAlert('No hay check-ins para hoy', 'info');
        } else {
            let mensaje = `<strong>Check-ins hoy (${reservasHoy.length}):</strong><br><br>`;
            reservasHoy.forEach(reserva => {
                const propiedad = this.propiedades.find(p => p.id == reserva.propiedad);
                mensaje += `<strong>• ${reserva.cliente.nombre}</strong><br>${propiedad.nombre}<br>Personas: ${reserva.cantidadPersonas || 1}<br>Hora: ${reserva.horaEntrada || '14:00'}<br>Tel: ${reserva.cliente.telefono}<br><br>`;
            });
            this.mostrarAlert(mensaje, 'info');
        }
    }
    
    mostrarOcupacionActual() {
        let mensaje = '<strong>Ocupación actual:</strong><br><br>';
        
        this.propiedades.forEach(prop => {
            const estaOcupado = this.reservas.some(r => {
                const entrada = this.normalizarFecha(r.fechaEntrada);
                const salida = this.normalizarFecha(r.fechaSalida);
                const hoy = new Date();
                return r.propiedad == prop.id && 
                       r.estado !== 'cancelada' &&
                       hoy >= entrada && 
                       hoy <= salida;
            });
            
            mensaje += `<strong>${prop.nombre}:</strong> ${estaOcupado ? '<span style="color: #f72585">🔴 Ocupado</span>' : '<span style="color: #4caf50">🟢 Disponible</span>'}<br>`;
        });
        
        this.mostrarAlert(mensaje, 'info');
    }
    
    mostrarClientesMes() {
        const hoy = new Date();
        const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
        const clientesMes = this.reservas.filter(r => {
            const entrada = this.normalizarFecha(r.fechaEntrada);
            return entrada >= inicioMes && 
                   r.estado !== 'cancelada';
        });
        
        if (clientesMes.length === 0) {
            this.mostrarAlert('No hay clientes este mes', 'info');
        } else {
            let mensaje = `<strong>Clientes este mes (${clientesMes.length}):</strong><br><br>`;
            clientesMes.slice(0, 10).forEach(reserva => {
                mensaje += `<strong>• ${reserva.cliente.nombre}</strong><br>${this.formatearFecha(reserva.fechaEntrada)}<br>Personas: ${reserva.cantidadPersonas || 1}<br><br>`;
            });
            
            if (clientesMes.length > 10) {
                mensaje += `<em>... y ${clientesMes.length - 10} más</em>`;
            }
            
            this.mostrarAlert(mensaje, 'info');
        }
    }
    
    mostrarProximasLlegadas() {
        const hoy = new Date();
        const en7Dias = new Date();
        en7Dias.setDate(en7Dias.getDate() + 7);
        
        const proximas = this.reservas.filter(r => {
            const fechaEntrada = this.normalizarFecha(r.fechaEntrada);
            return r.estado !== 'cancelada' &&
                   fechaEntrada >= hoy && 
                   fechaEntrada <= en7Dias;
        }).sort((a, b) => this.normalizarFecha(a.fechaEntrada) - this.normalizarFecha(b.fechaEntrada));
        
        if (proximas.length === 0) {
            this.mostrarAlert('No hay llegadas en los próximos 7 días', 'info');
        } else {
            let mensaje = `<strong>Próximas llegadas (${proximas.length}):</strong><br><br>`;
            proximas.forEach(reserva => {
                const propiedad = this.propiedades.find(p => p.id == reserva.propiedad);
                const diasFaltan = Math.ceil((this.normalizarFecha(reserva.fechaEntrada) - new Date()) / (1000 * 60 * 60 * 24));
                mensaje += `<strong>• ${reserva.cliente.nombre}</strong><br>${propiedad.nombre}<br>Personas: ${reserva.cantidadPersonas || 1}<br>En ${diasFaltan} días (${this.formatearFecha(reserva.fechaEntrada)} ${reserva.horaEntrada || '14:00'})<br><br>`;
            });
            this.mostrarAlert(mensaje, 'info');
        }
    }
    
    verDepto(propiedadId) {
        const propiedad = this.propiedades.find(p => p.id == propiedadId);
        const reservasDepto = this.reservas.filter(r => r.propiedad == propiedadId && r.estado !== 'cancelada');
        
        let mensaje = `<strong>${propiedad.nombre}</strong><br>${propiedad.direccion}<br><br>`;
        mensaje += `<strong>Reservas activas:</strong> ${reservasDepto.length}<br><br>`;
        
        const reservasFuturas = reservasDepto.filter(r => this.normalizarFecha(r.fechaEntrada) >= new Date());
        
        if (reservasFuturas.length > 0) {
            mensaje += '<strong>Próximas reservas:</strong><br>';
            reservasFuturas.slice(0, 3).forEach(reserva => {
                mensaje += `<strong>• ${reserva.cliente.nombre}:</strong> ${this.formatearFecha(reserva.fechaEntrada)} al ${this.formatearFecha(reserva.fechaSalida)} (${reserva.cantidadPersonas || 1} ${reserva.cantidadPersonas === 1 ? 'persona' : 'personas'})<br>`;
            });
            
            if (reservasFuturas.length > 3) {
                mensaje += `<em>... y ${reservasFuturas.length - 3} más</em><br>`;
            }
        } else {
            mensaje += '<strong>Sin reservas futuras</strong><br>';
        }
        
        // Ocupación del mes
        const ocupacion = this.calcularOcupacion(propiedadId);
        mensaje += `<br><strong>Ocupación últimos 30 días:</strong> ${ocupacion}%`;
        
        this.mostrarAlert(mensaje, 'info');
    }
    
    // ========== FUNCIONES MODALES DÍA (MANTENIDAS) ==========
    
    mostrarDetallesDia(fecha, ocupaciones) {
        const modal = document.getElementById('modalDia');
        const titulo = document.getElementById('modalDiaTitulo');
        const contenido = document.getElementById('modalDiaContenido');
        
        const fechaFormateada = fecha.toLocaleDateString('es-ES', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        
        titulo.textContent = fechaFormateada;
        
        if (ocupaciones.length === 0) {
            contenido.innerHTML = `
                <div class="empty-state">
                    <i class="far fa-calendar-check"></i>
                    <h3>Día disponible</h3>
                    <p>No hay reservas para esta fecha.</p>
                    <button class="btn btn-primary" id="btnCrearReservaDesdeModal" style="margin-top: 20px;">
                        <i class="fas fa-plus"></i> Crear Reserva
                    </button>
                </div>
            `;
            
            // Event listener para el botón
            const btn = contenido.querySelector('#btnCrearReservaDesdeModal');
            if (btn) {
                btn.addEventListener('click', () => {
                    this.mostrarModalReserva();
                    this.cerrarModalDia();
                });
            }
        } else {
            let html = '<div class="dia-ocupaciones">';
            
            // Separar eventos por tipo
            const checkins = [];
            const checkouts = [];
            const ocupacionesIntermedias = [];
            
            ocupaciones.forEach(ocupacion => {
                const entrada = this.normalizarFecha(ocupacion.fechaEntrada);
                const salida = this.normalizarFecha(ocupacion.fechaSalida);
                
                const fechaNormalizada = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate(), 12, 0, 0);
                
                // Función para comparar si dos fechas son el mismo día
                const esMismoDia = (fecha1, fecha2) => {
                    return fecha1.getDate() === fecha2.getDate() && 
                           fecha1.getMonth() === fecha2.getMonth() && 
                           fecha1.getFullYear() === fecha2.getFullYear();
                };
                
                if (esMismoDia(fechaNormalizada, entrada)) {
                    checkins.push(ocupacion);
                } else if (esMismoDia(fechaNormalizada, salida)) {
                    checkouts.push(ocupacion);
                } else {
                    ocupacionesIntermedias.push(ocupacion);
                }
            });
            
            // Mostrar check-ins primero
            if (checkins.length > 0) {
                html += `
                    <div class="event-section">
                        <h4 style="display: flex; align-items: center; gap: 8px; color: #4caf50; margin-bottom: 12px;">
                            <i class="fas fa-sign-in-alt"></i> Check-ins (${checkins.length})
                        </h4>
                `;
                
                checkins.forEach(ocupacion => {
                    html += this.generarTarjetaEvento(ocupacion, 'checkin', fecha);
                });
                
                html += '</div>';
            }
            
            // Mostrar check-outs
            if (checkouts.length > 0) {
                html += `
                    <div class="event-section">
                        <h4 style="display: flex; align-items: center; gap: 8px; color: #ff9800; margin-bottom: 12px;">
                            <i class="fas fa-sign-out-alt"></i> Check-outs (${checkouts.length})
                        </h4>
                `;
                
                checkouts.forEach(ocupacion => {
                    html += this.generarTarjetaEvento(ocupacion, 'checkout', fecha);
                });
                
                html += '</div>';
            }
            
            // Mostrar ocupaciones intermedias
            if (ocupacionesIntermedias.length > 0) {
                html += `
                    <div class="event-section">
                        <h4 style="display: flex; align-items: center; gap: 8px; color: #f72585; margin-bottom: 12px;">
                            <i class="fas fa-home"></i> Ocupaciones en curso (${ocupacionesIntermedias.length})
                        </h4>
                `;
                
                ocupacionesIntermedias.forEach(ocupacion => {
                    html += this.generarTarjetaEvento(ocupacion, 'intermediate', fecha);
                });
                
                html += '</div>';
            }
            
            html += '</div>';
            contenido.innerHTML = html;
            
            // Asignar event listeners a los botones generados dinámicamente
            contenido.querySelectorAll('.btn-cancelar-reserva-modal').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const reservaId = parseInt(e.target.closest('button').dataset.reservaId);
                    this.cancelarReserva(reservaId);
                });
            });
            
            contenido.querySelectorAll('.btn-editar-reserva-modal').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const reservaId = parseInt(e.target.closest('button').dataset.reservaId);
                    this.editarReserva(reservaId);
                    this.cerrarModalDia();
                });
            });
        }
        
        modal.classList.add('active');
    }
    
    generarTarjetaEvento(ocupacion, tipo, fechaActual) {
        const propiedad = this.propiedades.find(p => p.id == ocupacion.propiedad);
        const entrada = this.normalizarFecha(ocupacion.fechaEntrada);
        const salida = this.normalizarFecha(ocupacion.fechaSalida);
        
        let claseColor = '';
        let icono = '';
        let estado = '';
        
        switch(tipo) {
            case 'checkin':
                claseColor = '#4caf50';
                icono = 'fa-sign-in-alt';
                estado = '🟢 Llegada hoy';
                break;
            case 'checkout':
                claseColor = '#ff9800';
                icono = 'fa-sign-out-alt';
                estado = '🟠 Salida hoy';
                break;
            case 'intermediate':
                claseColor = '#f72585';
                icono = 'fa-home';
                const fechaActualNormalizada = new Date(fechaActual.getFullYear(), fechaActual.getMonth(), fechaActual.getDate(), 12, 0, 0);
                const diasTranscurridos = Math.ceil((fechaActualNormalizada - entrada) / (1000 * 60 * 60 * 24));
                const diasTotales = Math.ceil((salida - entrada) / (1000 * 60 * 60 * 24));
                estado = `⏳ Día ${diasTranscurridos} de ${diasTotales}`;
                break;
        }
        
        return `
            <div class="ocupacion-item" style="border-left: 4px solid ${claseColor}; margin-bottom: 16px;">
                <div class="ocupacion-header">
                    <div class="ocupacion-cliente">
                        <i class="fas ${icono}" style="color: ${claseColor}; margin-right: 8px;"></i>
                        ${ocupacion.cliente.nombre}
                    </div>
                    <div class="ocupacion-depto" style="background: ${propiedad.color}">
                        ${propiedad.nombre}
                    </div>
                </div>
                
                <div class="ocupacion-dates">
                    <span style="background: ${claseColor}20; padding: 4px 8px; border-radius: 6px; font-size: 12px; font-weight: 600; color: ${claseColor};">
                        ${estado}
                    </span>
                </div>
                
                <div style="margin-top: 8px;">
                    <span style="display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; background: #e3f2fd; border-radius: 8px; font-size: 12px;">
                        <i class="fas fa-users"></i>
                        ${ocupacion.cantidadPersonas || 1} ${ocupacion.cantidadPersonas === 1 ? 'persona' : 'personas'}
                    </span>
                </div>
                
                <div class="ocupacion-fechas-detalle" style="margin: 12px 0; font-size: 13px; color: #666;">
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                        <i class="fas fa-calendar-day" style="color: ${claseColor};"></i>
                        <strong>Check-in:</strong> ${this.formatearFecha(ocupacion.fechaEntrada)}
                        ${ocupacion.horaEntrada ? `<span style="background: ${claseColor}30; padding: 2px 6px; border-radius: 4px; margin-left: 8px;">${ocupacion.horaEntrada}</span>` : ''}
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <i class="fas fa-calendar-day" style="color: ${claseColor};"></i>
                        <strong>Check-out:</strong> ${this.formatearFecha(ocupacion.fechaSalida)}
                        ${ocupacion.horaSalida ? `<span style="background: ${claseColor}30; padding: 2px 6px; border-radius: 4px; margin-left: 8px;">${ocupacion.horaSalida}</span>` : ''}
                    </div>
                </div>
                
                <div class="ocupacion-contacto" style="font-size: 13px;">
                    <span><i class="fas fa-id-card"></i> ${ocupacion.cliente.dni}</span>
                    <span><i class="fas fa-phone"></i> ${ocupacion.cliente.telefono}</span>
                </div>
                
                <div class="reserva-acciones" style="margin-top: 16px;">
                    <button class="btn-small btn-danger btn-cancelar-reserva-modal" data-reserva-id="${ocupacion.id}">
                        <i class="fas fa-ban"></i> Cancelar
                    </button>
                    <button class="btn-small btn-info btn-editar-reserva-modal" data-reserva-id="${ocupacion.id}">
                        <i class="fas fa-edit"></i> Editar
                    </button>
                </div>
            </div>
        `;
    }
    
    cerrarModalDia() {
        document.getElementById('modalDia').classList.remove('active');
    }
    
    cerrarModalDisponibilidad() {
        document.getElementById('modalDisponibilidad').classList.remove('active');
    }
}

// Inicializar sistema cuando se carga la página
document.addEventListener('DOMContentLoaded', () => {
    window.sistema = new RentalSystem();
});