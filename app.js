// Sistema de Gestión de Alquileres - Versión Móvil Optimizada

class RentalSystem {
    constructor() {
        this.propiedades = [
            { id: 1, nombre: "Depto Centro", direccion: "Calle 123", color: "#4361ee", icon: "fas fa-city" },
            { id: 2, nombre: "Depto canalito", direccion: "Calle 456", color: "#7209b7", icon: "fas fa-umbrella-beach" },
            { id: 3, nombre: "Depto Alsina", direccion: "Calle 789", color: "#f72585", icon: "fas fa-building" },
            { id: 4, nombre: "Depto Chico", direccion: "Calle 101", color: "#4cc9f0", icon: "fas fa-home" }
        ];
        
        this.reservas = JSON.parse(localStorage.getItem('rental_reservas')) || this.generarDatosEjemplo();
        this.fechaActual = new Date();
        this.mesActual = this.fechaActual.getMonth();
        this.anoActual = this.fechaActual.getFullYear();
        this.deptoFiltro = 0; // 0 = todos
        this.notificationTimeout = null;
        
        this.init();
    }
    
    // ========== SISTEMA DE RECORDATORIOS ==========
    
    generarRecordatorios() {
        const hoy = new Date();
        const manana = new Date();
        manana.setDate(manana.getDate() + 1);
        
        const recordatorios = [];
        
        // Buscar check-outs de hoy (limpieza urgente)
        const checkoutsHoy = this.reservas.filter(reserva => {
            const salida = new Date(reserva.fechaSalida);
            return salida.toDateString() === hoy.toDateString();
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
                checklist: this.generarChecklistLimpieza()
            });
        });
        
        // Buscar check-outs de mañana (limpieza programada)
        const checkoutsManana = this.reservas.filter(reserva => {
            const salida = new Date(reserva.fechaSalida);
            return salida.toDateString() === manana.toDateString();
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
        
        // Buscar check-ins próximos (preparación)
        const en3Dias = new Date();
        en3Dias.setDate(en3Dias.getDate() + 3);
        
        const checkinsProximos = this.reservas.filter(reserva => {
            const entrada = new Date(reserva.fechaEntrada);
            return entrada > hoy && entrada <= en3Dias;
        });
        
        checkinsProximos.forEach(reserva => {
            const propiedad = this.propiedades.find(p => p.id == reserva.propiedad);
            const diasFaltan = Math.ceil((new Date(reserva.fechaEntrada) - hoy) / (1000 * 60 * 60 * 24));
            
            recordatorios.push({
                id: `preparacion_${reserva.id}`,
                tipo: 'preparacion',
                prioridad: diasFaltan === 1 ? 'urgente' : diasFaltan === 2 ? 'manana' : 'normal',
                fecha: new Date(reserva.fechaEntrada),
                titulo: `🏠 Preparar Depto en ${diasFaltan} día${diasFaltan > 1 ? 's' : ''}`,
                descripcion: `Check-in el ${this.formatearFecha(reserva.fechaEntrada)} de ${reserva.cliente.nombre}. Verificar que todo esté listo.`,
                propiedad: reserva.propiedad,
                color: propiedad.color,
                reservaId: reserva.id,
                checklist: this.generarChecklistPreparacion()
            });
        });
        
        return recordatorios.sort((a, b) => {
            // Ordenar por prioridad: urgente > manana > normal
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
            
            html += `
                <div class="recordatorio-item ${recordatorio.prioridad}">
                    <div class="recordatorio-header">
                        <div class="recordatorio-titulo">
                            ${recordatorio.titulo}
                        </div>
                        <div class="recordatorio-fecha">
                            ${fechaStr}
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
                        <button class="btn-recordatorio btn-marcar-como" onclick="sistema.marcarRecordatorioCompletado('${recordatorio.id}')">
                            <i class="fas fa-check"></i> Completado
                        </button>
                        <button class="btn-recordatorio btn-ir-a" onclick="sistema.verDetalleRecordatorio('${recordatorio.id}')">
                            <i class="fas fa-clipboard-check"></i> Checklist
                        </button>
                    </div>
                </div>
            `;
        });
        
        panel.innerHTML = html;
        
        // Mostrar notificación si hay recordatorios urgentes
        const urgentes = recordatorios.filter(r => r.prioridad === 'urgente').length;
        if (urgentes > 0 && !localStorage.getItem('notificacion_mostrada_hoy')) {
            this.mostrarNotificacionLimpieza(urgentes);
        }
    }
    
    marcarRecordatorioCompletado(idRecordatorio) {
        // Guardar en localStorage que este recordatorio fue completado
        const completados = JSON.parse(localStorage.getItem('recordatorios_completados')) || [];
        completados.push({
            id: idRecordatorio,
            fecha: new Date().toISOString()
        });
        localStorage.setItem('recordatorios_completados', JSON.stringify(completados));
        
        // Actualizar lista
        this.mostrarRecordatorios();
        
        // Actualizar contador
        const recordatorios = this.generarRecordatorios();
        const sinCompletar = recordatorios.filter(r => 
            !completados.some(c => c.id === r.id)
        ).length;
        
        document.getElementById('contadorRecordatorios').textContent = sinCompletar;
        
        this.mostrarNotificacion('Recordatorio marcado como completado', 'success');
    }
    
    verDetalleRecordatorio(idRecordatorio) {
        const recordatorios = this.generarRecordatorios();
        const recordatorio = recordatorios.find(r => r.id === idRecordatorio);
        
        if (!recordatorio) return;
        
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
                    <input type="checkbox" id="${itemId}" onchange="sistema.marcarChecklistItem('${idRecordatorio}', ${index})">
                    <label for="${itemId}">${item}</label>
                </div>
            `;
        });
        
        modalContent += `
                </div>
                
                <div style="margin-top: 24px; display: flex; gap: 12px; justify-content: flex-end;">
                    <button class="btn btn-secondary" onclick="this.closest('.modal').classList.remove('active')">
                        Cerrar
                    </button>
                    <button class="btn btn-primary" onclick="sistema.completarChecklist('${idRecordatorio}')">
                        <i class="fas fa-check-double"></i> Marcar Todo Completado
                    </button>
                </div>
            </div>
        `;
        
        // Crear modal temporal
        const modal = document.createElement('div');
        modal.className = 'modal active';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 500px;">
                <div class="modal-header">
                    <h2><i class="fas fa-clipboard-list"></i> Checklist Detallado</h2>
                    <button class="btn-close" onclick="this.parentElement.parentElement.remove()">&times;</button>
                </div>
                ${modalContent}
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Cargar estado del checklist si existe
        this.cargarEstadoChecklist(idRecordatorio);
    }
    
    marcarChecklistItem(idRecordatorio, index) {
        const checklistEstado = JSON.parse(localStorage.getItem('checklist_estado')) || {};
        
        if (!checklistEstado[idRecordatorio]) {
            checklistEstado[idRecordatorio] = [];
        }
        
        const checkbox = document.getElementById(`check_${idRecordatorio}_${index}`);
        const item = document.querySelector(`#check_${idRecordatorio}_${index}`).closest('.checklist-item-recordatorio');
        
        if (checkbox.checked) {
            checklistEstado[idRecordatorio][index] = true;
            item.classList.add('completado');
        } else {
            checklistEstado[idRecordatorio][index] = false;
            item.classList.remove('completado');
        }
        
        localStorage.setItem('checklist_estado', JSON.stringify(checklistEstado));
    }
    
    cargarEstadoChecklist(idRecordatorio) {
        const checklistEstado = JSON.parse(localStorage.getItem('checklist_estado')) || {};
        
        if (checklistEstado[idRecordatorio]) {
            checklistEstado[idRecordatorio].forEach((completado, index) => {
                if (completado) {
                    const checkbox = document.getElementById(`check_${idRecordatorio}_${index}`);
                    const item = checkbox.closest('.checklist-item-recordatorio');
                    
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
        
        // Marcar todos los checkboxes
        recordatorio.checklist.forEach((item, index) => {
            const checkbox = document.getElementById(`check_${idRecordatorio}_${index}`);
            const itemElement = checkbox.closest('.checklist-item-recordatorio');
            
            if (checkbox && itemElement) {
                checkbox.checked = true;
                itemElement.classList.add('completado');
            }
        });
        
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
        
        this.mostrarNotificacion(mensaje, 'limpieza');
    }
    
    // ========== INDICADORES EN LAS VISTAS ==========
    
    generarListaReservasConIndicadores(filtro = '') {
        const hoy = new Date();
        const manana = new Date();
        manana.setDate(manana.getDate() + 1);
        
        let reservasFiltradas = this.reservas
            .filter(r => new Date(r.fechaEntrada) >= hoy)
            .sort((a, b) => new Date(a.fechaEntrada) - new Date(b.fechaEntrada));
        
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
                    <h3>No hay reservas próximas</h3>
                    <p>No hay reservas programadas para los próximos días.</p>
                    <button class="btn btn-primary" onclick="sistema.mostrarModalReserva()" style="margin-top: 20px;">
                        <i class="fas fa-plus"></i> Crear primera reserva
                    </button>
                </div>
            `;
            return;
        }
        
        lista.innerHTML = '';
        
        reservasFiltradas.forEach(reserva => {
            const propiedad = this.propiedades.find(p => p.id == reserva.propiedad);
            const entrada = new Date(reserva.fechaEntrada);
            const salida = new Date(reserva.fechaSalida);
            
            // Determinar si necesita indicador de limpieza
            let indicadorLimpieza = '';
            if (salida.toDateString() === hoy.toDateString()) {
                indicadorLimpieza = '<span class="indicador-limpieza" title="Limpieza urgente para hoy"><i class="fas fa-broom"></i> Limpiar hoy</span>';
            } else if (salida.toDateString() === manana.toDateString()) {
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
                
                <div class="reserva-fechas">
                    <span><i class="fas fa-sign-in-alt"></i> ${this.formatearFecha(reserva.fechaEntrada)}</span>
                    <i class="fas fa-arrow-right"></i>
                    <span><i class="fas fa-sign-out-alt"></i> ${this.formatearFecha(reserva.fechaSalida)}</span>
                </div>
                
                <div class="reserva-contacto">
                    <span><i class="fas fa-id-card"></i> ${reserva.cliente.dni}</span>
                    <span><i class="fas fa-phone"></i> ${reserva.cliente.telefono}</span>
                    ${reserva.cliente.email ? `<span><i class="fas fa-envelope"></i> ${reserva.cliente.email}</span>` : ''}
                </div>
                
                ${reserva.notas ? `
                    <div style="margin-top: 12px; padding: 12px; background: #f8f9fa; border-radius: 8px; font-size: 13px; color: #666;">
                        <strong><i class="fas fa-sticky-note"></i> Notas:</strong> ${reserva.notas}
                    </div>
                ` : ''}
                
                <div class="reserva-acciones">
                    <button class="btn-small btn-info" onclick="sistema.editarReserva(${reserva.id})">
                        <i class="fas fa-edit"></i> Editar
                    </button>
                    <button class="btn-small btn-danger" onclick="sistema.eliminarReserva(${reserva.id})">
                        <i class="fas fa-trash"></i> Eliminar
                    </button>
                    ${salida.toDateString() === hoy.toDateString() || 
                      salida.toDateString() === manana.toDateString() ? 
                      `<button class="btn-small" style="background: #ff9800; color: white;" onclick="sistema.mostrarChecklistLimpieza(${reserva.id})">
                        <i class="fas fa-broom"></i> Checklist
                       </button>` : ''}
                </div>
            `;
            lista.appendChild(item);
        });
    }
    
    mostrarChecklistLimpieza(reservaId) {
        const reserva = this.reservas.find(r => r.id == reservaId);
        if (!reserva) return;
        
        const propiedad = this.propiedades.find(p => p.id == reserva.propiedad);
        const hoy = new Date();
        const salida = new Date(reserva.fechaSalida);
        const esHoy = salida.toDateString() === hoy.toDateString();
        
        const modal = document.createElement('div');
        modal.className = 'modal active';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2><i class="fas fa-broom"></i> Checklist de Limpieza</h2>
                    <button class="btn-close" onclick="this.parentElement.parentElement.remove()">&times;</button>
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
                            Huésped saliente: <strong>${reserva.cliente.nombre}</strong>
                        </p>
                        <p style="font-size: 14px; color: #666;">
                            Fecha check-out: <strong>${this.formatearFecha(reserva.fechaSalida)}</strong>
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
                        <div style="display: flex; gap: 16px; margin-top: 12px;">
                            <label style="display: flex; align-items: center; gap: 8px; font-size: 14px;">
                                <input type="radio" name="estado_${reservaId}" value="excelente" checked>
                                <span>Excelente - Listo para nuevo huésped</span>
                            </label>
                            <label style="display: flex; align-items: center; gap: 8px; font-size: 14px;">
                                <input type="radio" name="estado_${reservaId}" value="regular">
                                <span>Regular - Necesita atención menor</span>
                            </label>
                            <label style="display: flex; align-items: center; gap: 8px; font-size: 14px;">
                                <input type="radio" name="estado_${reservaId}" value="problemas">
                                <span>Con problemas - Reportar mantenimiento</span>
                            </label>
                        </div>
                    </div>
                    
                    <div style="margin-top: 24px; display: flex; gap: 12px; justify-content: flex-end;">
                        <button class="btn btn-secondary" onclick="this.closest('.modal').classList.remove('active')">
                            Cancelar
                        </button>
                        <button class="btn btn-primary" onclick="sistema.marcarLimpiezaCompletada(${reservaId})">
                            <i class="fas fa-check-double"></i> Marcar Limpieza Completada
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
    }
    
    marcarLimpiezaCompletada(reservaId) {
        const estadoSeleccionado = document.querySelector(`input[name="estado_${reservaId}"]:checked`);
        
        if (!estadoSeleccionado) {
            this.mostrarNotificacion('Por favor selecciona el estado del departamento', 'error');
            return;
        }
        
        const limpiezasCompletadas = JSON.parse(localStorage.getItem('limpiezas_completadas')) || [];
        limpiezasCompletadas.push({
            reservaId: reservaId,
            fecha: new Date().toISOString(),
            estado: estadoSeleccionado.value
        });
        
        localStorage.setItem('limpiezas_completadas', JSON.stringify(limpiezasCompletadas));
        
        // Cerrar modal
        document.querySelector('.modal.active').remove();
        
        this.mostrarNotificacion('Limpieza marcada como completada', 'success');
        
        // Actualizar recordatorios
        this.mostrarRecordatorios();
    }
    
    generarDatosEjemplo() {
        const hoy = new Date();
        const reservasEjemplo = [];
        
        // Generar algunas reservas de ejemplo
        for (let i = 1; i <= 4; i++) {
            const fechaInicio = new Date(hoy);
            fechaInicio.setDate(fechaInicio.getDate() + i * 3);
            
            const fechaFin = new Date(fechaInicio);
            fechaFin.setDate(fechaFin.getDate() + 4);
            
            reservasEjemplo.push({
                id: Date.now() + i,
                propiedad: i,
                fechaEntrada: fechaInicio.toISOString().split('T')[0],
                fechaSalida: fechaFin.toISOString().split('T')[0],
                cliente: {
                    nombre: `Cliente Ejemplo ${i}`,
                    dni: `1234567${i}`,
                    telefono: `+54 9 11 1234-567${i}`,
                    email: `cliente${i}@ejemplo.com`
                },
                notas: `Reserva de ejemplo ${i}`,
                estado: 'confirmada',
                fechaCreacion: new Date().toISOString()
            });
        }
        
        return reservasEjemplo;
    }
    
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
        
        // ========== NUEVO: Inicializar sistema de recordatorios ==========
        this.inicializarRecordatorios();
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
            
            if (!panel.contains(e.target) && !badge.contains(e.target)) {
                panel.classList.remove('show');
            }
        });
        
        // Mostrar recordatorios al cargar
        setTimeout(() => {
            this.mostrarRecordatorios();
        }, 1000);
        
        // Actualizar cada 30 minutos
        setInterval(() => {
            this.mostrarRecordatorios();
        }, 30 * 60 * 1000);
    }
    
    setupEventListeners() {
        // Botones principales
        document.getElementById('nuevaReservaBtn').addEventListener('click', () => this.mostrarModalReserva());
        document.getElementById('fabNuevaReserva').addEventListener('click', () => this.mostrarModalReserva());
        
        // Controles de vista
        document.getElementById('viewListBtn').addEventListener('click', () => this.cambiarVista('list'));
        document.getElementById('viewCalendarBtn').addEventListener('click', () => this.cambiarVista('calendar'));
        document.getElementById('viewGridBtn').addEventListener('click', () => this.cambiarVista('grid'));
        
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
        const calendar = document.querySelector('.month-grid');
        
        if (calendar) {
            calendar.addEventListener('touchstart', (e) => {
                startX = e.touches[0].clientX;
                startY = e.touches[0].clientY;
            });
            
            calendar.addEventListener('touchend', (e) => {
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
        }
    }
    
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
    
    crearCeldaCalendario(dia, esOtroMes, esHoy = false, estaOcupado = false, fecha = null, ocupaciones = []) {
        const div = document.createElement('div');
        div.className = 'calendar-day';
        
        if (esOtroMes) div.classList.add('other-month');
        if (esHoy) div.classList.add('today');
        
        // Determinar tipo de ocupación
        if (estaOcupado && !esOtroMes) {
            // Verificar si es check-in, check-out o día intermedio
            let esCheckin = false;
            let esCheckout = false;
            
            ocupaciones.forEach(ocupacion => {
                const entrada = new Date(ocupacion.fechaEntrada);
                const salida = new Date(ocupacion.fechaSalida);
                
                if (fecha.toDateString() === entrada.toDateString()) {
                    esCheckin = true;
                }
                if (fecha.toDateString() === salida.toDateString()) {
                    esCheckout = true;
                }
            });
            
            if (esCheckin) {
                div.classList.add('occupied', 'checkin');
            } else if (esCheckout) {
                div.classList.add('occupied', 'checkout');
            } else {
                div.classList.add('occupied');
            }
        }
        
        // Número del día
        const numSpan = document.createElement('span');
        numSpan.className = 'calendar-day-number';
        numSpan.textContent = dia;
        
        // Estado (puntos de color para cada propiedad ocupada)
        const statusDiv = document.createElement('div');
        statusDiv.className = 'calendar-day-status';
        
        if (estaOcupado && !esOtroMes) {
            const deptosOcupados = new Set(ocupaciones.map(o => o.propiedad));
            this.propiedades.forEach(prop => {
                if (deptosOcupados.has(prop.id)) {
                    const dot = document.createElement('span');
                    dot.className = 'status-dot';
                    dot.style.background = prop.color;
                    statusDiv.appendChild(dot);
                }
            });
        }
        
        div.appendChild(numSpan);
        div.appendChild(statusDiv);
        
        // Tooltip y click handler
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
                const nombresDeptos = ocupaciones.map(o => 
                    this.propiedades.find(p => p.id == o.propiedad).nombre
                ).join(', ');
                tooltip += `\nOcupado: ${nombresDeptos}`;
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
    
    getOcupacionesDia(fecha) {
        const fechaStr = fecha.toISOString().split('T')[0];
        
        return this.reservas.filter(reserva => {
            if (this.deptoFiltro > 0 && reserva.propiedad != this.deptoFiltro) {
                return false;
            }
            
            const entrada = new Date(reserva.fechaEntrada);
            const salida = new Date(reserva.fechaSalida);
            
            // CORRECCIÓN: Un día está ocupado si la fecha está entre el check-in y check-out INCLUSIVE
            // Normalizamos las fechas para comparar solo días
            const entradaNormalizada = new Date(entrada.getFullYear(), entrada.getMonth(), entrada.getDate());
            const salidaNormalizada = new Date(salida.getFullYear(), salida.getMonth(), salida.getDate());
            const fechaNormalizada = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
            
            return fechaNormalizada >= entradaNormalizada && fechaNormalizada <= salidaNormalizada;
        });
    }
    
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
                    <button class="btn btn-primary" onclick="sistema.mostrarModalReserva(); sistema.cerrarModalDia()" style="margin-top: 20px;">
                        <i class="fas fa-plus"></i> Crear Reserva
                    </button>
                </div>
            `;
        } else {
            let html = '<div class="dia-ocupaciones">';
            
            ocupaciones.forEach(ocupacion => {
                const propiedad = this.propiedades.find(p => p.id == ocupacion.propiedad);
                const entrada = new Date(ocupacion.fechaEntrada);
                const salida = new Date(ocupacion.fechaSalida);
                
                const esCheckin = entrada.toDateString() === fecha.toDateString();
                const esCheckout = salida.toDateString() === fecha.toDateString();
                
                html += `
                    <div class="ocupacion-item">
                        <div class="ocupacion-header">
                            <div class="ocupacion-cliente">${ocupacion.cliente.nombre}</div>
                            <div class="ocupacion-depto" style="background: ${propiedad.color}">
                                ${propiedad.nombre}
                            </div>
                        </div>
                        
                        <div class="ocupacion-dates">
                            <i class="fas fa-sign-in-alt"></i>
                            <span>${entrada.toLocaleDateString('es-ES')}</span>
                            <i class="fas fa-arrow-right"></i>
                            <i class="fas fa-sign-out-alt"></i>
                            <span>${salida.toLocaleDateString('es-ES')}</span>
                            ${esCheckin ? '<span class="badge" style="background: #4caf50; color: white; padding: 2px 8px; border-radius: 10px; font-size: 12px;">Check-in</span>' : ''}
                            ${esCheckout ? '<span class="badge" style="background: #f72585; color: white; padding: 2px 8px; border-radius: 10px; font-size: 12px;">Check-out</span>' : ''}
                        </div>
                        
                        <div class="ocupacion-contacto">
                            <span><i class="fas fa-id-card"></i> ${ocupacion.cliente.dni}</span>
                            <span><i class="fas fa-phone"></i> ${ocupacion.cliente.telefono}</span>
                            ${ocupacion.cliente.email ? `<span><i class="fas fa-envelope"></i> ${ocupacion.cliente.email}</span>` : ''}
                        </div>
                        
                        ${ocupacion.notas ? `
                            <div style="margin-top: 12px; padding: 12px; background: #f8f9fa; border-radius: 8px; font-size: 13px;">
                                <strong>Notas:</strong> ${ocupacion.notas}
                            </div>
                        ` : ''}
                        
                        <div class="reserva-acciones" style="margin-top: 16px;">
                            <button class="btn-small btn-danger" onclick="sistema.eliminarReserva(${ocupacion.id}); sistema.cerrarModalDia()">
                                <i class="fas fa-trash"></i> Eliminar
                            </button>
                        </div>
                    </div>
                `;
            });
            
            html += '</div>';
            contenido.innerHTML = html;
        }
        
        modal.classList.add('active');
    }
    
    cerrarModalDia() {
        document.getElementById('modalDia').classList.remove('active');
    }
    
    generarGridDeptos() {
        const grid = document.getElementById('deptosGrid');
        grid.innerHTML = '';
        
        this.propiedades.forEach(propiedad => {
            const reservasDepto = this.reservas.filter(r => r.propiedad == propiedad.id);
            const reservasFuturas = reservasDepto.filter(r => new Date(r.fechaEntrada) >= new Date());
            const proximaReserva = reservasFuturas.sort((a, b) => new Date(a.fechaEntrada) - new Date(b.fechaEntrada))[0];
            
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
                        <div class="next-booking-client">${proximaReserva.cliente.nombre}</div>
                    </div>
                ` : `
                    <div class="depto-next-booking" style="background: #e8f5e9;">
                        <div class="next-booking-title">Estado:</div>
                        <div class="next-booking-dates" style="color: #4caf50;">Disponible</div>
                        <div class="next-booking-client">Sin reservas próximas</div>
                    </div>
                `}
                
                <button class="btn-small btn-info" onclick="sistema.verDepto(${propiedad.id})" style="width: 100%; margin-top: 16px;">
                    <i class="fas fa-eye"></i> Ver Detalles
                </button>
            `;
            
            grid.appendChild(card);
        });
    }
    
    calcularOcupacion(propiedadId) {
        const ultimos30Dias = new Date();
        ultimos30Dias.setDate(ultimos30Dias.getDate() - 30);
        
        const reservasDepto = this.reservas.filter(r => 
            r.propiedad == propiedadId && 
            new Date(r.fechaEntrada) >= ultimos30Dias
        );
        
        let diasOcupados = 0;
        reservasDepto.forEach(reserva => {
            const entrada = new Date(reserva.fechaEntrada);
            const salida = new Date(reserva.fechaSalida);
            const dias = Math.ceil((salida - entrada) / (1000 * 60 * 60 * 24));
            diasOcupados += dias;
        });
        
        return Math.min(Math.round((diasOcupados / 30) * 100), 100);
    }
    
    verDepto(propiedadId) {
        const propiedad = this.propiedades.find(p => p.id == propiedadId);
        const reservasDepto = this.reservas.filter(r => r.propiedad == propiedadId);
        
        let mensaje = `${propiedad.nombre}\n${propiedad.direccion}\n\n`;
        mensaje += `Reservas totales: ${reservasDepto.length}\n\n`;
        
        const reservasFuturas = reservasDepto.filter(r => new Date(r.fechaEntrada) >= new Date());
        
        if (reservasFuturas.length > 0) {
            mensaje += 'Próximas reservas:\n';
            reservasFuturas.slice(0, 3).forEach(reserva => {
                mensaje += `• ${reserva.cliente.nombre}: ${this.formatearFecha(reserva.fechaEntrada)} al ${this.formatearFecha(reserva.fechaSalida)}\n`;
            });
        } else {
            mensaje += 'Sin reservas futuras\n';
        }
        
        alert(mensaje);
    }
    
    formatearFecha(fechaStr) {
        const fecha = new Date(fechaStr);
        return fecha.toLocaleDateString('es-ES', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    }
    
    actualizarEstadisticas() {
        const hoy = new Date().toISOString().split('T')[0];
        const inicioMes = new Date(this.anoActual, this.mesActual, 1).toISOString().split('T')[0];
        
        // Reservas hoy
        const reservasHoy = this.reservas.filter(r => r.fechaEntrada === hoy).length;
        document.getElementById('reservasHoy').textContent = reservasHoy;
        
        // Departamentos ocupados hoy
        const deptosOcupados = this.propiedades.filter(prop => 
            this.reservas.some(r => {
                const entrada = new Date(r.fechaEntrada);
                const salida = new Date(r.fechaSalida);
                const hoyObj = new Date();
                return r.propiedad == prop.id && hoyObj >= entrada && hoyObj <= salida;
            })
        ).length;
        document.getElementById('deptosOcupados').textContent = deptosOcupados;
        
        // Clientes este mes
        const clientesMes = new Set(
            this.reservas.filter(r => r.fechaEntrada >= inicioMes)
                .map(r => r.cliente.dni)
        ).size;
        document.getElementById('clientesMes').textContent = clientesMes;
        
        // Próximas llegadas (próximos 7 días)
        const en7Dias = new Date();
        en7Dias.setDate(en7Dias.getDate() + 7);
        
        const proximasLlegadas = this.reservas.filter(r => {
            const fechaEntrada = new Date(r.fechaEntrada);
            return fechaEntrada >= new Date() && fechaEntrada <= en7Dias;
        }).length;
        document.getElementById('proximasLlegadas').textContent = proximasLlegadas;
    }
    
    mostrarReservasHoy() {
        const hoy = new Date().toISOString().split('T')[0];
        const reservasHoy = this.reservas.filter(r => r.fechaEntrada === hoy);
        
        if (reservasHoy.length === 0) {
            this.mostrarNotificacion('No hay check-ins para hoy', 'info');
        } else {
            let mensaje = `Check-ins hoy (${reservasHoy.length}):\n\n`;
            reservasHoy.forEach(reserva => {
                const propiedad = this.propiedades.find(p => p.id == reserva.propiedad);
                mensaje += `• ${reserva.cliente.nombre}\n  ${propiedad.nombre}\n  Tel: ${reserva.cliente.telefono}\n\n`;
            });
            alert(mensaje);
        }
    }
    
    mostrarOcupacionActual() {
        let mensaje = 'Ocupación actual:\n\n';
        
        this.propiedades.forEach(prop => {
            const estaOcupado = this.reservas.some(r => {
                const entrada = new Date(r.fechaEntrada);
                const salida = new Date(r.fechaSalida);
                const hoy = new Date();
                return r.propiedad == prop.id && hoy >= entrada && hoy <= salida;
            });
            
            mensaje += `${prop.nombre}: ${estaOcupado ? '🔴 Ocupado' : '🟢 Disponible'}\n`;
        });
        
        alert(mensaje);
    }
    
    mostrarClientesMes() {
        const inicioMes = new Date(this.anoActual, this.mesActual, 1).toISOString().split('T')[0];
        const clientesMes = this.reservas.filter(r => r.fechaEntrada >= inicioMes);
        
        if (clientesMes.length === 0) {
            this.mostrarNotificacion('No hay clientes este mes', 'info');
        } else {
            let mensaje = `Clientes este mes (${clientesMes.length}):\n\n`;
            clientesMes.slice(0, 10).forEach(reserva => {
                mensaje += `• ${reserva.cliente.nombre}\n  ${this.formatearFecha(reserva.fechaEntrada)}\n\n`;
            });
            
            if (clientesMes.length > 10) {
                mensaje += `... y ${clientesMes.length - 10} más`;
            }
            
            alert(mensaje);
        }
    }
    
    mostrarProximasLlegadas() {
        const en7Dias = new Date();
        en7Dias.setDate(en7Dias.getDate() + 7);
        
        const proximas = this.reservas.filter(r => {
            const fechaEntrada = new Date(r.fechaEntrada);
            return fechaEntrada >= new Date() && fechaEntrada <= en7Dias;
        }).sort((a, b) => new Date(a.fechaEntrada) - new Date(b.fechaEntrada));
        
        if (proximas.length === 0) {
            this.mostrarNotificacion('No hay llegadas en los próximos 7 días', 'info');
        } else {
            let mensaje = `Próximas llegadas (${proximas.length}):\n\n`;
            proximas.forEach(reserva => {
                const propiedad = this.propiedades.find(p => p.id == reserva.propiedad);
                const diasFaltan = Math.ceil((new Date(reserva.fechaEntrada) - new Date()) / (1000 * 60 * 60 * 24));
                mensaje += `• ${reserva.cliente.nombre}\n  ${propiedad.nombre}\n  En ${diasFaltan} días (${this.formatearFecha(reserva.fechaEntrada)})\n\n`;
            });
            alert(mensaje);
        }
    }
    
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
        
        const reserva = {
            id: editingId ? parseInt(editingId) : Date.now(),
            propiedad: parseInt(document.getElementById('selectDepto').value),
            fechaEntrada: document.getElementById('fechaEntrada').value,
            fechaSalida: document.getElementById('fechaSalida').value,
            cliente: {
                nombre: document.getElementById('nombreCliente').value,
                dni: document.getElementById('dniCliente').value,
                telefono: document.getElementById('telefonoCliente').value,
                email: document.getElementById('emailCliente').value
            },
            notas: document.getElementById('notasReserva').value,
            estado: 'confirmada',
            fechaCreacion: new Date().toISOString()
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
        this.mostrarRecordatorios();  // Actualizar recordatorios
        this.mostrarNotificacion(editingId ? 'Reserva actualizada' : 'Reserva guardada exitosamente', 'success');
    }
    
    validarDisponibilidad(reserva) {
        const entrada = new Date(reserva.fechaEntrada);
        const salida = new Date(reserva.fechaSalida);
        
        return !this.reservas.some(r => {
            if (r.propiedad != reserva.propiedad || r.id === reserva.id) return false;
            
            const rEntrada = new Date(r.fechaEntrada);
            const rSalida = new Date(r.fechaSalida);
            
            return (entrada >= rEntrada && entrada <= rSalida) ||
                   (salida >= rEntrada && salida <= rSalida) ||
                   (entrada <= rEntrada && salida >= rSalida);
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
        document.getElementById('notasReserva').value = reserva.notas || '';
        
        // Guardar el ID para actualización
        document.getElementById('formReserva').dataset.editingId = id;
        
        this.mostrarModalReserva();
    }
    
    eliminarReserva(id) {
        if (confirm('¿Estás seguro de eliminar esta reserva?')) {
            this.reservas = this.reservas.filter(r => r.id !== id);
            this.guardarDatos();
            
            this.generarCalendarioMobile();
            this.generarListaReservasConIndicadores();
            this.generarGridDeptos();
            this.actualizarEstadisticas();
            this.mostrarRecordatorios();  // Actualizar recordatorios
            
            this.mostrarNotificacion('Reserva eliminada', 'success');
        }
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
        let csv = 'Departamento,Fecha Entrada,Fecha Salida,Nombre,DNI,Teléfono,Email,Notas\n';
        
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
    
    limpiarNotificaciones() {
        const notification = document.getElementById('notification');
        notification.classList.remove('show');
        clearTimeout(this.notificationTimeout);
    }
    
    // Métodos para funcionalidades adicionales
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
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2><i class="fas fa-clipboard-check"></i> Checklist de Preparación</h2>
                    <button class="btn-close" onclick="this.parentElement.parentElement.remove()">&times;</button>
                </div>
                <div class="modal-body">
                    ${checklistContent}
                    <div style="margin-top: 20px; text-align: center;">
                        <button class="btn btn-primary" onclick="this.parentElement.parentElement.parentElement.remove()">
                            <i class="fas fa-check"></i> Listo
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
    }
    
    generarChecklistItems(items) {
        return items.map(item => `
            <div class="checklist-item">
                <input type="checkbox" id="check_${item.replace(/\s+/g, '_')}">
                <label for="check_${item.replace(/\s+/g, '_')}">${item}</label>
            </div>
        `).join('');
    }
}

// Inicializar sistema cuando se carga la página
document.addEventListener('DOMContentLoaded', () => {
    window.sistema = new RentalSystem();
});