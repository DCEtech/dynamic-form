/**
 * JavaScript principal para el formulario dinámico de clientes
 */

class FormularioCliente {
    constructor() {
        this.currentStep = 1;
        this.totalSteps = 6;
        this.clienteId = null;
        this.autoSaveInterval = null;
        this.isSubmitting = false;
        this.isCompleted = false;
        this.originalData = null; // Para comparar cambios
        this.mode = 'wizard';
        this.isDirty = false;
        this.hasChanges = false;

        this.init();
    }

    init() {
        // Obtener datos del formulario si están disponibles
        if (typeof window.formularioData !== 'undefined') {
            this.clienteId = window.formularioData.clienteId;

            // Forzamos que sea booleano puro
            this.isCompleted = window.formularioData.completado === true ||
                window.formularioData.completado === 1 ||
                window.formularioData.completado === "1";

            if (this.isCompleted) {
                this.currentStep = window.formularioData.pasoActual || 1;
                console.log('Modo lectura: Formulario completado');
            } else {
                this.currentStep = window.formularioData.pasoActual || 1;
            }
        }

        // Inicializar elementos DOM
        this.initializeElements();

        // Configurar eventos
        this.setupEvents();

        // Inicializar tooltips
        this.initializeTooltips();

        // Configurar guardado automático
        this.setupAutoSave();

        // Cargar datos existentes
        this.loadExistingData();
        console.log('Formulario inicializado correctamente');

    }

    initializeElements() {
        this.elements = {
            form: document.getElementById('dynamic-form'),
            btnNext: document.getElementById('btn-next'),
            btnPrevious: document.getElementById('btn-previous'),
            progressBar: document.getElementById('progress-bar'),
            progressPercentage: document.getElementById('progress-percentage'),
            currentStepSidebar: document.getElementById('current-step-sidebar'), // Nuevo ID para el paso actual en el sidebar
            totalStepsSidebar: document.getElementById('total-steps-sidebar'),   // Nuevo ID para el total de pasos en el sidebar
            currentStepTitle: document.getElementById('current-step-title'),     // Nuevo ID para el paso actual en el título
            stepNameTitle: document.getElementById('step-name-title'),           // Nuevo ID para el nombre del paso en el título
            saveStatus: document.getElementById('save-status'),
            saveIcon: document.getElementById('save-icon'),
            stepItems: document.querySelectorAll('.step-item'),
            formSteps: document.querySelectorAll('.form-step'),
        };
    }


    setupEvents() {
        // Botones de navegación
        if (this.elements.btnNext) {
            this.elements.btnNext.addEventListener('click', () => this.nextStep());
        }

        if (this.elements.btnPrevious) {
            this.elements.btnPrevious.addEventListener('click', () => this.previousStep());
        }

        // Navegación por pasos en sidebar
        this.elements.stepItems.forEach((item, index) => {
            item.addEventListener('click', (e) => {
                e.preventDefault();

                const targetStep = index + 1;
                console.log(`Click en paso ${targetStep}. Paso actual: ${this.currentStep}`);

                if (targetStep === this.currentStep) {
                    return;
                }

                // Si el backend dice que ese paso existe → permitir
                if (this.canNavigateToStep(targetStep)) {

                    // Si estamos avanzando al siguiente inmediato → validar
                    if (targetStep === this.currentStep + 1) {
                        if (!this.validateCurrentStep()) {
                            this.showToast(
                                'Complete los campos obligatorios del paso actual',
                                'error'
                            );
                            return;
                        }
                    }

                    this._navigateToStep(targetStep);
                    return;
                }

                // Intento de saltar a algo que no existe aún
                this.showToast(
                    'Debe completar los pasos anteriores antes de acceder a este',
                    'warning'
                );
            });
        });

        // Validación en tiempo real
        this.elements.form.addEventListener('input', (e) => {
            this.validateField(e.target);

            if (this.isCompleted) {
                this.isDirty = true;
            }

            this.updateProgress();
            this.updateFinalButton();
        });

        this.elements.form.addEventListener('change', (e) => {
            this.validateField(e.target);

            if (this.isCompleted) {
                this.isDirty = true;
            }

            this.updateProgress();
            this.updateFinalButton();
        });

        // Detectar cualquier cambio en el formulario para habilitar el botón de guardado
        this.elements.form.querySelectorAll('input, select, textarea').forEach(input => {
            input.addEventListener('change', () => {
                if (this.isCompleted) {
                    this.hasChanges = true;
                    this.updateNavigation();
                }
            });
        });
    }

    initializeTooltips() {
        // Inicializar tooltips de Bootstrap
        const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
        tooltipTriggerList.map(function (tooltipTriggerEl) {
            return new bootstrap.Tooltip(tooltipTriggerEl);
        });
    }

    setupAutoSave() {
        // Guardar automáticamente cada 30 segundos
        this.autoSaveInterval = setInterval(() => {
            this.autoSave();
        }, 30000);

        // Guardar al cambiar de pestaña/ventana
        window.addEventListener('beforeunload', () => {
            this.saveCurrentStep();
        });
    }

    nextStep() {
        if (this.isSubmitting) return;

        // 1. Si ya está completo y hay cambios, guardamos (lógica de edición)
        if (this.isCompleted && this.hasChanges) {
            this.saveCurrentStep().then(() => {
                this.hasChanges = false;
                this.showToast('Cambios guardados correctamente', 'success');
                this.updateNavigation();
            });
            return;
        }

        // 2. VALIDACIÓN CRÍTICA: Validar siempre el paso actual antes de hacer nada
        if (!this.validateCurrentStep()) {
            console.warn("Validación rechazada para el paso:", this.currentStep);
            return; // Detenemos la ejecución si falta algo
        }

        // 3. Navegación o Finalización
        if (this.currentStep < this.totalSteps) {
            this._navigateToStep(this.currentStep + 1);
        } else {

            this.completeForm();
        }
    }

    previousStep() {
        console.log(`Botón anterior presionado. Paso actual: ${this.currentStep}`);

        if (this.currentStep > 1) {
            console.log('Retrocediendo con botón anterior');
            this._navigateToStep(this.currentStep - 1);
        }
    }

    goToStep(step) {
        // Método simplificado que usa la nueva lógica
        console.log(`goToStep llamado para paso ${step}`);
        this._navigateToStep(step);
    }

    updateStepDisplay() {
        // Ocultar todos los pasos
        this.elements.formSteps.forEach(step => {
            step.classList.remove('active');
        });

        // Mostrar paso actual
        const currentStepElement = document.querySelector(`[data-step="${this.currentStep}"]`);
        if (currentStepElement) {
            currentStepElement.classList.add('active');
        }

        // Actualizar sidebar
        this.updateSidebar();

        // Actualizar visualización de paso actual en sidebar
        if (this.elements.currentStepSidebar) {
            this.elements.currentStepSidebar.textContent = this.currentStep;
        }

        // Actualizar visualización de paso y nombre en el título
        if (this.elements.currentStepTitle) {
            this.elements.currentStepTitle.textContent = this.currentStep;
        }
        if (this.elements.stepNameTitle) {
            // Aquí se necesita un array de nombres de pasos, que se pasa desde el backend
            // Asumiendo que `window.formularioData.stepNames` contiene esto
            if (window.formularioData && window.formularioData.stepNames) {
                this.elements.stepNameTitle.textContent = window.formularioData.stepNames[this.currentStep - 1];
            }
        }

        // Cargar los datos para el nuevo paso
        if (typeof window.formularioData !== 'undefined' && window.formularioData.datosFormulario) {
            this.loadStepData(this.currentStep, window.formularioData.datosFormulario);
        }

        // Scroll al top
        window.scrollTo({top: 0, behavior: 'smooth'});
    }

    updateSidebar() {
        this.elements.stepItems.forEach((item, index) => {
            const step = index + 1;
            const badge = item.querySelector('.step-number-badge');
            const checkIcon = item.querySelector('.step-check-icon');

            item.classList.remove('active', 'completed');

            // 1. Lógica del Paso Actual (Siempre azul para saber dónde estoy)
            if (step === this.currentStep) {
                item.classList.add('active');
                if (badge) {
                    badge.classList.remove('d-none', 'bg-secondary');
                    badge.classList.add('bg-primary');
                }
                if (checkIcon) checkIcon.classList.add('d-none');
                return; // Saltamos al siguiente paso del bucle
            }

            // 2. Lógica de Pasos Completados (Checks verdes)
            const nombresPasos = ['datos_empresa', 'info_trasteros', 'usuarios_app', 'config_correo', 'perfiles_acceso', 'documentacion'];
            const pasoKey = nombresPasos[step - 1];
            const estaValidado = window.formularioData.estado_pasos && window.formularioData.estado_pasos[pasoKey];

            // REGLA DE ORO: Si está validado Y (es un paso anterior O el formulario está terminado)
            if (estaValidado && (step < this.currentStep || this.isCompleted)) {
                item.classList.add('completed');
                if (badge) badge.classList.add('d-none');
                if (checkIcon) checkIcon.classList.remove('d-none');
            } else {
                // 3. Paso bloqueado o pendiente
                if (badge) {
                    badge.classList.remove('d-none', 'bg-primary');
                    badge.classList.add('bg-secondary');
                }
                if (checkIcon) checkIcon.classList.add('d-none');
            }
        });
    }

    updateNavigation() {
        if (this.elements.btnPrevious) {
            this.elements.btnPrevious.disabled = this.currentStep <= 1;
        }

        if (!this.elements.btnNext) return;

        // CASO 1: Formulario ya completado
        if (this.isCompleted) {
            if (this.hasChanges) {
                // Si hubo cambios, mostramos "Guardar Cambios"
                this.elements.btnNext.style.display = 'block';
                this.elements.btnNext.innerHTML = '<i class="bi bi-save me-1"></i>Guardar cambios';
                this.elements.btnNext.className = 'btn btn-warning btn-sm';
            } else {
                // Si no hay cambios, en el paso 6 ocultamos, en el resto dejamos "Siguiente"
                if (this.currentStep === this.totalSteps) {
                    this.elements.btnNext.style.display = 'none';
                } else {
                    this.elements.btnNext.style.display = 'block';
                    this.elements.btnNext.innerHTML = 'Siguiente<i class="bi bi-arrow-right ms-1"></i>';
                    this.elements.btnNext.className = 'btn btn-primary btn-sm';
                }
            }
            return;
        }

        // CASO 2: Modo Wizard Normal (Sin completar)
        this.elements.btnNext.style.display = 'block';
        if (this.currentStep === this.totalSteps) {
            this.elements.btnNext.innerHTML = '<i class="bi bi-check-circle me-1"></i>Finalizar y Enviar';
            this.elements.btnNext.className = 'btn btn-success btn-sm';
        } else {
            this.elements.btnNext.innerHTML = 'Siguiente<i class="bi bi-arrow-right ms-1"></i>';
            this.elements.btnNext.className = 'btn btn-primary btn-sm';
        }
    }

    _validateTrasterosStep() {
        const trasteros = document.querySelectorAll(
            '.trastero-item:not(#trastero-template)'
        );

        if (trasteros.length === 0) {
            this.showToast('Debe agregar al menos un trastero', 'error');
            return false;
        }

        let isValid = true;

        trasteros.forEach(trastero => {
            const fields = [
                trastero.querySelector('.trastero-numero'),
                trastero.querySelector('.trastero-metros'),
                trastero.querySelector('.trastero-precio-sin-iva')
            ];

            fields.forEach(field => {
                if (!field || !field.value.trim()) {
                    field?.classList.add('is-invalid');
                    field?.classList.remove('is-valid');
                    isValid = false;
                } else {
                    field.classList.remove('is-invalid');
                    field.classList.add('is-valid');
                }
            });
        });

        return isValid;
    }

    _validateUsuariosStep() {
        const usuarios = document.querySelectorAll(
            '.usuario-item:not(#usuario-template)'
        );

        if (usuarios.length === 0) {
            this.showToast('Debe agregar al menos un usuario', 'error');
            return false;
        }

        let isValid = true;

        usuarios.forEach(usuario => {
            const requiredFields = [
                usuario.querySelector('.usuario-nombre'),
                usuario.querySelector('.usuario-email'),
                usuario.querySelector('.usuario-password'),
                usuario.querySelector('.usuario-confirm-password')
            ];

            const password = usuario.querySelector('.usuario-password')?.value;
            const confirm = usuario.querySelector('.usuario-confirm-password')?.value;

            requiredFields.forEach(field => {
                if (!field || !field.value.trim()) {
                    field?.classList.add('is-invalid');
                    field?.classList.remove('is-valid');
                    isValid = false;
                } else {
                    field.classList.remove('is-invalid');
                    field.classList.add('is-valid');
                }
            });

            if (password && confirm && password !== confirm) {
                usuario.querySelector('.usuario-confirm-password')
                    ?.classList.add('is-invalid');
                isValid = false;
            }
        });

        return isValid;
    }

    _validatePerfilesStep() {
        const perfiles = document.querySelectorAll('.nivel-item:not(#nivel-template)');

        if (perfiles.length === 0) {
            this.showToast('Debe agregar al menos un nivel de acceso', 'error');
            return false;
        }

        let isValid = true;

        perfiles.forEach(perfil => {
            const nombre = perfil.querySelector('.nivel-nombre');
            const descripcion = perfil.querySelector('.nivel-descripcion');

            if (!nombre.value.trim()) {
                nombre.classList.add('is-invalid');
                isValid = false;
            } else {
                nombre.classList.remove('is-invalid');
            }

            if (!descripcion.value.trim()) {
                descripcion.classList.add('is-invalid');
                isValid = false;
            } else {
                descripcion.classList.remove('is-invalid');
            }
        });

        return isValid;
    }

    getTrasterosData() {
        const trasteros = [];

        const items = document.querySelectorAll(
            '.trastero-item:not(#trastero-template)'
        );

        items.forEach((item) => {
            const data = {
                numero_trastero: item.querySelector('.trastero-numero')?.value?.trim() || '',
                metros: item.querySelector('.trastero-metros')?.value || '',
                metros_cubicos: item.querySelector('.trastero-cubicos')?.value || '',
                precio_sin_iva: item.querySelector('.trastero-precio-sin-iva')?.value || '',
                precio_con_iva: item.querySelector('.trastero-precio-con-iva')?.value || '',
                fianza: item.querySelector('.trastero-fianza')?.value || '',
            };

            // Si TODOS los campos están vacíos, no lo guardamos
            const hasAnyValue = Object.values(data).some(v => v !== '');
            if (!hasAnyValue) return;

            trasteros.push(data);
        });

        console.log('Trasteros serializados:', trasteros);
        return trasteros;
    }

    getUsuariosData() {
        const usuarios = [];

        const items = document.querySelectorAll(
            '.usuario-item:not(#usuario-template)'
        );

        items.forEach(usuario => {
            const nombre = usuario.querySelector('.usuario-nombre')?.value?.trim();
            const email = usuario.querySelector('.usuario-email')?.value?.trim();
            const password = usuario.querySelector('.usuario-password')?.value;
            const confirmPassword = usuario.querySelector('.usuario-confirm-password')?.value;

            // Si está vacío, no lo guardamos
            if (!nombre && !email) return;

            usuarios.push({
                nombre_usuario: nombre,
                email_usuario: email,
                password_usuario: password,
                confirm_password_usuario: confirmPassword,
                rol_usuario: usuario.querySelector('.usuario-rol')?.value || 'usuario',
                departamento_usuario: usuario.querySelector('.usuario-departamento')?.value || '',
                permisos: {
                    facturacion: usuario.querySelector('[name*="permisos_facturacion"]')?.checked || false,
                    reportes: usuario.querySelector('[name*="permisos_reportes"]')?.checked || false,
                    configuracion: usuario.querySelector('[name*="permisos_configuracion"]')?.checked || false,
                }
            });
        });

        console.log('usuarios', usuarios);

        console.log('Usuarios serializados:', usuarios);
        return usuarios;
    }

    getPerfilesData() {
        const perfiles = [];
        // Buscamos todos los items excepto el template
        document.querySelectorAll('.nivel-item:not(#nivel-template)').forEach(perfil => {
            const puertas = [];

            // 1. Obtener puertas de checkboxes (estándar)
            perfil.querySelectorAll('.puertas-grid input[type="checkbox"]:checked').forEach(p => {
                puertas.push(p.name);
            });

            // 2. Obtener puertas personalizadas (las etiquetas badge)
            perfil.querySelectorAll('.custom-door-tag').forEach(tag => {
                // El texto antes del icono
                puertas.push(tag.textContent.trim());
            });

            const es24h = perfil.querySelector('.acceso-24h').checked;

            perfiles.push({
                nombre: perfil.querySelector('.nivel-nombre').value.trim(),
                descripcion: perfil.querySelector('.nivel-descripcion').value.trim(),
                acceso_24h: es24h,
                hora_inicio: es24h ? null : perfil.querySelector('.hora-inicio').value,
                hora_fin: es24h ? null : perfil.querySelector('.hora-fin').value,
                puertas: puertas
            });
        });
        return perfiles;
    }

    validateCurrentStep() {
        if (this.isCompleted) {
            return true;
        }


        // Paso 2 → SOLO lógica de trasteros
        if (this.currentStep === 2) {
            return this._validateTrasterosStep();
        }

        // Paso 3 → SOLO lógica de usuarios
        if (this.currentStep === 3) {
            return this._validateUsuariosStep();
        }

        if (this.currentStep === 5) {
            return this._validatePerfilesStep();
        }

        if (this.currentStep === 6) {
            const files = window.uploadedFilesPaso6;

            const tieneContratos = files.contratos && files.contratos.length > 0;
            const tienePlanos = files.planos && files.planos.length > 0;
            const tieneLogo = files.logos && files.logos.some(f => f._tipo === 'logo_principal');

            if (!tieneContratos || !tienePlanos || !tieneLogo) {
                let faltantes = [];
                if (!tieneContratos) faltantes.push("Contratos");
                if (!tienePlanos) faltantes.push("Planos");
                if (!tieneLogo) faltantes.push("Logo Principal");

                this.showToast(`Faltan archivos obligatorios: ${faltantes.join(', ')}`, 'error');
                return false;
            }
            return true;
        }

        // Resto de pasos → validación normal
        const requiredFields = this._getRequiredFieldsForCurrentStep();
        const invalidFields = this._validateRequiredFields(requiredFields);

        return invalidFields.length === 0;
    }

    _getRequiredFieldsForCurrentStep() {
        const currentStepElement = document.querySelector(`[data-step="${this.currentStep}"]`);
        if (!currentStepElement) {
            console.log(`No se encontró elemento para paso ${this.currentStep}`);
            return [];
        }


        const requiredFields = currentStepElement.querySelectorAll('[required]');
        console.log(`Paso ${this.currentStep}: ${requiredFields.length} campos obligatorios encontrados`);

        return Array.from(requiredFields);
    }

    _validateRequiredFields(fields) {
        const invalidFields = [];
        console.log(fields);
        fields.forEach(field => {
            const value = field.value ? field.value.trim() : '';
            const fieldLabel = this._getFieldLabel(field);

            console.log(`Validando ${fieldLabel}: "${value}"`);

            // Validación básica: campo requerido no puede estar vacío
            if (!value) {
                invalidFields.push(fieldLabel);
                field.classList.add('is-invalid');
                field.classList.remove('is-valid');
                return;
            }

            // Validaciones específicas por tipo
            let isValid = true;

            if (field.type === 'email') {
                isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
            } else if (field.pattern) {
                isValid = new RegExp(field.pattern).test(value);
            } else if (field.type === 'tel') {
                isValid = /^(\+34|0034|34)?[6789][0-9]{8}$/.test(value.replace(/\s/g, ''));
            }

            if (!isValid) {
                invalidFields.push(fieldLabel);
                field.classList.add('is-invalid');
                field.classList.remove('is-valid');
            } else {
                field.classList.remove('is-invalid');
                field.classList.add('is-valid');
            }
        });

        return invalidFields;
    }

    _getFieldLabel(field) {
        const label = document.querySelector(`label[for="${field.id}"]`);
        if (label) {
            return label.textContent.replace('*', '').trim();
        }
        return field.name || field.id || 'Campo desconocido';
    }

    _showFieldErrors(invalidFields) {
        // Hacer scroll al primer campo inválido
        const firstInvalidField = document.querySelector('.is-invalid');
        if (firstInvalidField) {
            firstInvalidField.scrollIntoView({behavior: 'smooth', block: 'center'});
            firstInvalidField.focus();
        }
    }

    _navigateToStep(step) {
        console.log(`Navegando al paso ${step}`);

        // Guardar datos del paso actual si estamos avanzando
        if (step > this.currentStep) {
            this.saveCurrentStep().catch(error => {
                console.error('Error al guardar:', error);
            });
        }

        // Cambiar el paso
        this.currentStep = step;
        this.updateStepDisplay();
        this.updateNavigation();

        // Cargar datos del nuevo paso
        if (window.formularioData && window.formularioData.datosFormulario) {
            this.loadStepData(step, window.formularioData.datosFormulario);
        }

        console.log(`Navegación completada al paso ${step}`);
    }

    validateField(field) {
        if (!field) return true;

        const fieldName = field.name || field.id || 'campo desconocido';
        let isValid = true;
        let reason = '';

        const value = field.value.trim();
        console.log(`Validando campo ${fieldName}, valor: "${value}"`);

        // Validación de campos requeridos
        if (field.hasAttribute('required') && !value) {
            isValid = false;
            reason = 'campo requerido vacío';
        }

        // Validaciones específicas por tipo
        if (value && field.type) {
            switch (field.type) {
                case 'email':
                    if (!this.validateEmail(value)) {
                        isValid = false;
                        reason = 'formato de email inválido';
                    }
                    break;
                case 'tel':
                    if (!this.validatePhone(value)) {
                        isValid = false;
                        reason = 'formato de teléfono inválido';
                    }
                    break;
                case 'url':
                    if (value && !this.validateURL(value)) {
                        isValid = false;
                        reason = 'URL inválida';
                    }
                    break;
                case 'number':
                    if (field.hasAttribute('min') && parseInt(value) < parseInt(field.getAttribute('min'))) {
                        isValid = false;
                        reason = `valor menor que el mínimo (${field.getAttribute('min')})`;
                    }
                    if (field.hasAttribute('max') && parseInt(value) > parseInt(field.getAttribute('max'))) {
                        isValid = false;
                        reason = `valor mayor que el máximo (${field.getAttribute('max')})`;
                    }
                    break;
            }
        }

        // Validaciones por patrón
        if (value && field.pattern) {
            const regex = new RegExp(field.pattern);
            if (!regex.test(value)) {
                isValid = false;
                reason = `no cumple el patrón requerido (${field.pattern})`;
            }
        }

        // Aplicar clases de validación
        if (isValid) {
            field.classList.remove('is-invalid');
            field.classList.add('is-valid');
            console.log(`Campo ${fieldName} válido`);
        } else {
            field.classList.remove('is-valid');
            field.classList.add('is-invalid');
            console.log(`Campo ${fieldName} inválido: ${reason}`);
        }

        return isValid;
    }

    validateEmail(email) {
        const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return regex.test(email);
    }

    validatePhone(phone) {
        const regex = /^(\+34|0034|34)?[6789][0-9]{8}$/;
        return regex.test(phone.replace(/\s/g, ''));
    }

    validateURL(url) {
        try {
            new URL(url);
            return true;
        } catch {
            return false;
        }
    }

    showValidationErrors() {
        const firstInvalidField = document.querySelector('.is-invalid');
        if (firstInvalidField) {
            firstInvalidField.focus();
            firstInvalidField.scrollIntoView({behavior: 'smooth', block: 'center'});
        }

        // Mostrar toast de error
        this.showToast('Por favor, complete todos los campos obligatorios correctamente.', 'error');
    }

    getCurrentStepData() {

        if (this.currentStep === 2) {
            return {
                trasteros: this.getTrasterosData(),
            };
        }

        if (this.currentStep === 3) {
            return {
                usuarios: this.getUsuariosData(),
            };
        }

        if (this.currentStep === 5) {
            return {
                perfiles_acceso: this.getPerfilesData()
            };
        }

        const currentStepElement = document.querySelector(
            `[data-step="${this.currentStep}"]`
        );
        if (!currentStepElement) return {};

        const inputs = currentStepElement.querySelectorAll('input, select, textarea');
        const data = {};

        inputs.forEach(input => {
            if (input.name) {
                if (input.type === 'checkbox') {
                    data[input.name] = input.checked;
                } else if (input.type === 'radio') {
                    if (input.checked) data[input.name] = input.value;
                } else {
                    data[input.name] = input.value;
                }
            }
        });

        return data;
    }


    async saveCurrentStep() {
        if (!this.clienteId) return;

        if (this.currentStep === 6) {
            console.info('Paso 6: guardado manual, no autosave');
            return;
        }

        this.updateSaveStatus('saving');

        const data = this.getCurrentStepData();

        try {
            const response = await fetch('/api/save', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    cliente_id: this.clienteId,
                    paso: this.currentStep,
                    datos: data
                })
            });

            const result = await response.json();

            if (result.estado_pasos) {
                window.formularioData.estado_pasos = result.estado_pasos;
            }
            this.updateSidebar(); // Refrescar visualmente los checks

            // ===============================
            // 🔄 Actualizar nombre del cliente
            // ===============================
            if (result.cliente_actualizado) {
                const nuevoNombre = result.cliente_actualizado.nombre;

                // Sidebar (card izquierda)
                const sidebarTitle = document.querySelector('.card-header h5');
                if (sidebarTitle) {
                    sidebarTitle.innerHTML = `
            <i class="bi bi-building me-2"></i>
            ${nuevoNombre}
        `;
                }

                // Título del documento
                document.title = `${nuevoNombre} - Formulario`;
            }

            if (result.cliente_actualizado?.slug) {
                const nuevoSlug = result.cliente_actualizado.slug;

                const url = new URL(window.location.href);

                // Reemplazar el slug manteniendo el resto de la URL
                const partes = url.pathname.split('/');

                // Asumimos ruta tipo /cliente/<slug>/formulario
                const slugIndex = partes.indexOf('cliente') + 1;

                if (slugIndex > 0 && partes[slugIndex]) {
                    partes[slugIndex] = nuevoSlug;
                    const nuevaRuta = partes.join('/');

                    window.history.replaceState(
                        {slug: nuevoSlug},
                        '',
                        nuevaRuta + url.search
                    );

                    console.log('🔁 URL actualizada a:', nuevaRuta);
                }
            }


            if (!response.ok) {
                throw new Error(result.mensaje || 'Error al guardar');
            }

            // ----------------------------
            // ✅ PROGRESO
            // ----------------------------
            if (typeof result.porcentaje === 'number') {
                this.updateProgress(result.porcentaje);
            }

            this.updateSaveStatus('saved');

            // ----------------------------
            // ✅ ACTUALIZAR DATOS SIN ROMPER LA ESTRUCTURA
            // ----------------------------
            if (!window.formularioData.datosFormulario) {
                window.formularioData.datosFormulario = {};
            }

            const df = window.formularioData.datosFormulario;
            console.log('df', df);

            if (result.formulario_data_actualizada) {
                if (result.formulario_data_actualizada.datos_empresa !== undefined) {
                    df.datos_empresa = result.formulario_data_actualizada.datos_empresa;
                }
                if (result.formulario_data_actualizada.info_trasteros !== undefined) {
                    df.info_trasteros = result.formulario_data_actualizada.info_trasteros;
                }
                if (result.formulario_data_actualizada.usuarios_app !== undefined) {
                    df.usuarios_app = result.formulario_data_actualizada.usuarios_app;
                }
                if (result.formulario_data_actualizada.config_correo !== undefined) {
                    df.config_correo = result.formulario_data_actualizada.config_correo;
                }
                if (result.formulario_data_actualizada.perfiles_acceso !== undefined) {
                    df.perfiles_acceso = result.formulario_data_actualizada.perfiles_acceso;
                }
                if (result.formulario_data_actualizada.documentacion !== undefined) {
                    df.documentacion = result.formulario_data_actualizada.documentacion;
                }
            }

            return result;

        } catch (error) {
            console.error('Error al guardar:', error);
            this.updateSaveStatus('error');
            throw error;
        }
    }

    buildDocumentacionPayload() {
        const notas = document.querySelector('#notas_adicionales')?.value || '';

        const archivos = {
            contratos: [],
            planos: [],
            logo_principal: [],
            logo_alternativo: [],
            adicional: []
        };

        if (window.uploadedFilesPaso6) {
            // Archivos normales
            ['contratos', 'planos', 'adicional'].forEach(tipo => {
                (window.uploadedFilesPaso6[tipo] || []).forEach(file => {
                    if (file._serverFileId) {
                        archivos[tipo].push(file._serverFileId);
                    }
                });
            });

            // Logos
            (window.uploadedFilesPaso6.logos || []).forEach(file => {
                if (!file._serverFileId || !file._tipo) return;

                if (file._tipo === 'logo_principal') {
                    archivos.logo_principal.push(file._serverFileId);
                }

                if (file._tipo === 'logo_alternativo') {
                    archivos.logo_alternativo.push(file._serverFileId);
                }
            });
        }

        return {
            notas_adicionales: notas,
            archivos: archivos
        };
    }

    async saveStep6Notas() {
        const payload = this.buildDocumentacionPayload();

        this.updateSaveStatus('saving');

        const response = await fetch('/api/save', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                cliente_id: this.clienteId,
                paso: 6,
                datos: payload
            })
        });

        const result = await response.json();

        if (!response.ok) {
            this.updateSaveStatus('error');
            throw new Error(result.mensaje || 'Error guardando documentación');
        }

        // Sincronizar frontend con backend
        if (!window.formularioData.datosFormulario) {
            window.formularioData.datosFormulario = {};
        }

        window.formularioData.datosFormulario.documentacion =
            result.formulario_data_actualizada.documentacion;

        this.updateSaveStatus('saved');
    }

    autoSave() {
        if (this.validateCurrentStep()) {
            this.saveCurrentStep().catch(error => {
                console.log('Error en guardado automático:', error);
            });
        }
    }

    updateSaveStatus(status) {
        if (!this.elements.saveStatus || !this.elements.saveIcon) return;

        this.elements.saveStatus.className = `save-status ${status}`;

        switch (status) {
            case 'saving':
                this.elements.saveIcon.className = 'bi bi-cloud-arrow-up me-2';
                this.elements.saveStatus.textContent = 'Guardando...';
                break;
            case 'saved':
                this.elements.saveIcon.className = 'bi bi-cloud-check me-2';
                this.elements.saveStatus.textContent = 'Guardado automáticamente';
                break;
            case 'error':
                this.elements.saveIcon.className = 'bi bi-cloud-slash me-2';
                this.elements.saveStatus.textContent = 'Error al guardar';
                break;
        }
    }

    updateProgress(serverPercentage = null) {
        // 1. Si el formulario ya está marcado como completado globalmente
        if (this.isCompleted) {
            this.elements.progressBar.style.width = '100%';
            this.elements.progressPercentage.textContent = '100%';
            return;
        }

        // 2. Si recibimos el porcentaje real del backend (lo más certero)
        if (serverPercentage !== null) {
            this.elements.progressBar.style.width = serverPercentage + '%';
            this.elements.progressPercentage.textContent = serverPercentage + '%';
            return;
        }

        // 3. Si no hay dato del servidor, calculamos según pasos validados en window.formularioData
        if (window.formularioData && window.formularioData.estado_pasos) {
            const total = this.totalSteps;
            const completados = Object.values(window.formularioData.estado_pasos).filter(v => v === true).length;
            let percent = Math.round((completados / total) * 100);

            // Si el cálculo da 100 pero no ha hecho clic en completar, mostrar 99%
            if (percent >= 100 && !this.isCompleted) {
                percent = 99;
            }

            this.elements.progressBar.style.width = percent + '%';
            this.elements.progressPercentage.textContent = percent + '%';
        }
    }

    loadExistingData() {
        if (typeof window.formularioData !== 'undefined' && window.formularioData.datosFormulario) {
            const datos = window.formularioData.datosFormulario;

            this.loadStepData(this.currentStep, datos);

            if (this.isCompleted) {
                this.updateProgress(100);

                const steps = document.querySelectorAll('.step-item');

                steps.forEach(step => {
                    step.classList.remove('active');
                    step.classList.add('completed');
                });

                const currentStepEl = document.querySelector(`.step-item[data-step="${this.currentStep}"]`);
                if (currentStepEl) {
                    currentStepEl.classList.add('active');
                }
            } else {
                this.updateProgress(window.formularioData.porcentajeCompletado);
            }

            // Forzar sincronización inicial de botones
            this.updateNavigation();
        }
    }


    loadStepData(step, datos) {
        if (!datos) return;

        let stepData = null;

        // =========================
        // Resolver stepData
        // =========================
        if (step === 1) {
            stepData = datos.datos_empresa || datos.paso_1 || {};
        } else if (step === 2) {
            stepData = datos.info_trasteros || datos.paso_2 || [];
        } else if (step === 3) {
            stepData = datos.usuarios_app || datos.paso_3 || [];
        } else if (step === 4) {
            stepData = datos.config_correo || datos.paso_4 || {};
        } else if (step === 5) {
            stepData = datos.perfiles_acceso || datos.paso_5 || [];
        } else if (step === 6) {
            stepData = datos.documentacion || datos.paso_6 || {};
        }


        // =========================
        // Otros pasos (inputs simples)
        // =========================
        const stepElement = document.querySelector(`[data-step="${step}"]`);
        if (!stepElement || !stepData) return;

        Object.keys(stepData).forEach(key => {
            const field = stepElement.querySelector(`[name="${key}"]`);
            if (!field) return;

            if (field.type === 'checkbox') {
                field.checked = !!stepData[key];
            } else if (field.type === 'radio') {
                if (field.value === String(stepData[key])) {
                    field.checked = true;
                }
            } else {
                field.value = stepData[key];
            }

            this.validateField(field);
        });
    }

    canNavigateToStep(step) {

        if (this.isCompleted) return true;

        // Siempre puede volver atrás
        if (step <= this.currentStep) return true;

        // Para ir hacia adelante, el paso anterior inmediato DEBE estar validado
        const nombresPasos = ['datos_empresa', 'info_trasteros', 'usuarios_app', 'config_correo', 'perfiles_acceso', 'documentacion'];
        const pasoAnteriorKey = nombresPasos[step - 2]; // Si quiero ir al 3, chequeo el 2 (índice 1)

        const pasoAnteriorValidado = window.formularioData.estado_pasos && window.formularioData.estado_pasos[pasoAnteriorKey];

        return pasoAnteriorValidado === true;
    }

    async completeForm() {
        if (this.isSubmitting) return;
        this.isSubmitting = true;

        try {
            await this.saveStep6Notas();
            this.updateSaveStatus('saving');

            const response = await fetch(
                `/api/cliente/${this.clienteId}/completar`,
                {method: 'POST'}
            );

            const result = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(result.error || 'Error al completar el formulario');
            }

            // ✅ Progreso REAL desde backend
            this.updateProgress(100);
            this.isCompleted = true;
            this.hasChanges = false;
            this.updateNavigation();

            // ✅ Sincronizar estado global
            if (result.formulario) {
                window.formularioData.porcentajeCompletado =
                    result.formulario.porcentaje_completado;

                window.formularioData.pasoActual =
                    result.formulario.paso_actual;
            }

            this.updateSaveStatus('saved');
            this.showToast('¡Formulario completado exitosamente!', 'success');

            setTimeout(() => {
                window.location.href = '/';
            }, 1500);

        } catch (error) {
            console.error(error);
            this.isSubmitting = false;
            this.updateSaveStatus('error');
            this.showToast('Error al completar el formulario', 'error');
        }
    }


    showSaveError() {
        this.showToast('Error al guardar los datos. Por favor, inténtelo de nuevo.', 'error');
    }

    showToast(message, type = 'info') {
        // Crear toast dinámicamente
        const toastContainer = document.getElementById('toast-container') || this.createToastContainer();

        const toast = document.createElement('div');
        toast.className = `toast align-items-center text-white bg-${type === 'error' ? 'danger' : type} border-0`;
        toast.setAttribute('role', 'alert');
        toast.innerHTML = `
            <div class="d-flex">
                <div class="toast-body">
                    <i class="bi bi-${type === 'error' ? 'exclamation-triangle' : type === 'success' ? 'check-circle' : 'info-circle'} me-2"></i>
                    ${message}
                </div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
            </div>
        `;

        toastContainer.appendChild(toast);

        const bsToast = new bootstrap.Toast(toast);
        bsToast.show();

        // Eliminar toast después de que se oculte
        toast.addEventListener('hidden.bs.toast', () => {
            toast.remove();
        });
    }

    createToastContainer() {
        const container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'toast-container position-fixed top-0 end-0 p-3';
        container.style.zIndex = '1055';
        document.body.appendChild(container);
        return container;
    }

    destroy() {
        // Limpiar intervalos y eventos
        if (this.autoSaveInterval) {
            clearInterval(this.autoSaveInterval);
        }

        // Guardar datos antes de destruir
        this.saveCurrentStep().catch(console.error);
    }
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', function () {
    // Lógica específica para la página del formulario
    if (document.getElementById('dynamic-form')) {
        window.formularioCliente = new FormularioCliente();
    }

    // Inicializar tooltips globalmente
    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    tooltipTriggerList.map(function (tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl);
    });
});

// Limpiar al salir de la página del formulario
window.addEventListener('beforeunload', function () {
    if (window.formularioCliente) {
        window.formularioCliente.destroy();
    }
});


