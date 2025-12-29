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

        this.init();
    }

    init() {
        // Obtener datos del formulario si están disponibles
        if (typeof window.formularioData !== 'undefined') {
            this.clienteId = window.formularioData.clienteId;
            this.currentStep = window.formularioData.pasoActual;
            this.totalSteps = window.formularioData.totalPasos;
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

        // Navegación por pasos en sidebar - Solución simplificada y robusta
        this.elements.stepItems.forEach((item, index) => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const targetStep = index + 1;

                console.log(`Click en paso ${targetStep}. Paso actual: ${this.currentStep}`);

                // Si es el mismo paso, no hacer nada
                if (targetStep === this.currentStep) {
                    return;
                }

                // Si retrocedemos, permitir siempre
                if (targetStep < this.currentStep) {
                    console.log('Retrocediendo - permitido');
                    this._navigateToStep(targetStep);
                    return;
                }

                // Si avanzamos, solo permitir al paso inmediatamente siguiente
                if (targetStep === this.currentStep + 1) {
                    console.log('Intentando avanzar al siguiente paso');

                    // Validar campos obligatorios del paso actual
                    if (!this.validateCurrentStep()) {
                        this.showToast(
                            'Complete los campos obligatorios del paso actual',
                            'error'
                        );
                        return;
                    }

                    console.log('Todos los campos válidos - procediendo');
                    this._navigateToStep(targetStep);
                } else {
                    // Intentar saltar varios pasos
                    this.showToast('Debe completar los pasos en orden secuencial', 'warning');
                }
            });
        });

        // Validación en tiempo real
        if (this.elements.form) {
            this.elements.form.addEventListener('input', (e) => {
                this.validateField(e.target);
                this.updateProgress();
            });

            this.elements.form.addEventListener('change', (e) => {
                this.validateField(e.target);
                this.updateProgress();
            });
        }

        // Prevenir envío accidental del formulario
        if (this.elements.form) {
            this.elements.form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.nextStep();
            });
        }

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

        console.log(`Botón siguiente presionado. Paso actual: ${this.currentStep}`);

        if (this.currentStep < this.totalSteps) {

            // 🔥 USAR SIEMPRE EL VALIDADOR CENTRAL
            if (!this.validateCurrentStep()) {
                console.log('Validación falló en nextStep');
                this.showToast('Complete los campos obligatorios del paso actual', 'error');
                return;
            }

            console.log('Validación exitosa - avanzando');
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
            item.classList.remove('active', 'completed');
            const badge = item.querySelector('.step-number-badge');
            const checkIcon = item.querySelector('.step-check-icon');

            // Determinar si el paso está completado (para la UI, basándose en la información disponible del frontend)
            // Verificar si hay datos según la estructura correcta de datos
            let tieneDatos = false;

            if (window.formularioData && window.formularioData.datosFormulario) {
                switch (step) {
                    case 1:
                        tieneDatos = window.formularioData.datosFormulario.datos_empresa &&
                            Object.keys(window.formularioData.datosFormulario.datos_empresa).length > 0;
                        break;
                    case 2:
                        tieneDatos = window.formularioData.datosFormulario.info_trasteros &&
                            Object.keys(window.formularioData.datosFormulario.info_trasteros).length > 0;
                        break;
                    case 3:
                        tieneDatos = window.formularioData.datosFormulario.usuarios_app &&
                            Object.keys(window.formularioData.datosFormulario.usuarios_app).length > 0;
                        break;
                    case 4:
                        tieneDatos = window.formularioData.datosFormulario.config_correo &&
                            Object.keys(window.formularioData.datosFormulario.config_correo).length > 0;
                        break;
                    case 5:
                        tieneDatos = window.formularioData.datosFormulario.niveles_acceso &&
                            Object.keys(window.formularioData.datosFormulario.niveles_acceso).length > 0;
                        break;
                    case 6:
                        tieneDatos = window.formularioData.datosFormulario.documentacion &&
                            Object.keys(window.formularioData.datosFormulario.documentacion).length > 0;
                        break;
                }
            }

            if (step === this.currentStep) {
                item.classList.add('active');
                if (badge) {
                    badge.classList.remove('bg-secondary');
                    badge.classList.add('bg-primary');
                    badge.textContent = step;
                }
                if (checkIcon) {
                    checkIcon.classList.add('d-none');
                }
            } else if (tieneDatos && step < this.currentStep) { // Si tiene datos y es un paso anterior
                item.classList.add('completed');
                if (badge) {
                    badge.classList.add('d-none');
                }
                if (checkIcon) {
                    checkIcon.classList.remove('d-none');
                }
            } else { // Pasos futuros o pasos anteriores sin datos
                if (badge) {
                    badge.classList.remove('d-none', 'bg-primary');
                    badge.classList.add('bg-secondary');
                    badge.textContent = step;
                }
                if (checkIcon) {
                    checkIcon.classList.add('d-none');
                }
            }
        });
    }

    updateNavigation() {
        // Botón anterior
        if (this.elements.btnPrevious) {
            this.elements.btnPrevious.disabled = this.currentStep <= 1;
        }

        // Botón siguiente
        if (this.elements.btnNext) {
            if (this.currentStep === this.totalSteps) {
                this.elements.btnNext.innerHTML = '<i class="bi bi-check-circle me-1"></i>Completar';
                this.elements.btnNext.classList.remove('btn-primary');
                this.elements.btnNext.classList.add('btn-success');
            } else {
                this.elements.btnNext.innerHTML = 'Siguiente<i class="bi bi-arrow-right ms-1"></i>';
                this.elements.btnNext.classList.remove('btn-success');
                this.elements.btnNext.classList.add('btn-primary');
            }
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

    _validateNivelesStep() {
        const niveles = document.querySelectorAll('.nivel-item:not(#nivel-template)');

        if (niveles.length === 0) {
            this.showToast('Debe agregar al menos un nivel de acceso', 'error');
            return false;
        }

        let isValid = true;

        niveles.forEach(nivel => {
            const nombre = nivel.querySelector('.nivel-nombre');
            const descripcion = nivel.querySelector('.nivel-descripcion');

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
                descripcion: item.querySelector('.trastero-descripcion')?.value || ''
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

    getNivelesData() {
        const niveles = [];

        document.querySelectorAll('.nivel-item:not(#nivel-template)').forEach(nivel => {
            const puertas = [];

            nivel.querySelectorAll('.puertas-grid input[type="checkbox"]:checked')
                .forEach(p => puertas.push(p.name));

            nivel.querySelectorAll('.puertas-personalizadas-list input[type="checkbox"]:checked')
                .forEach(p => puertas.push(
                    p.nextElementSibling?.textContent?.trim()
                ));

            niveles.push({
                nombre: nivel.querySelector('.nivel-nombre').value.trim(),
                prioridad: nivel.querySelector('.nivel-prioridad').value,
                descripcion: nivel.querySelector('.nivel-descripcion').value.trim(),
                acceso_24h: nivel.querySelector('.acceso-24h').checked,
                hora_inicio: nivel.querySelector('.hora-inicio')?.value || null,
                hora_fin: nivel.querySelector('.hora-fin')?.value || null,
                puertas
            });
        });

        console.log('Niveles serializados:', niveles);
        return niveles;
    }

    validateCurrentStep() {

        // Paso 2 → SOLO lógica de trasteros
        if (this.currentStep === 2) {
            return this._validateTrasterosStep();
        }

        // Paso 3 → SOLO lógica de usuarios
        if (this.currentStep === 3) {
            return this._validateUsuariosStep();
        }

        if (this.currentStep === 5) {
            return this._validateNivelesStep();
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
                niveles_acceso: this.getNivelesData()
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

    async saveStep6WithFiles() {
        this.updateSaveStatus('saving');

        // Accedemos a los archivos del paso 6
        const step6Container = document.querySelector('[data-step="6"]');
        if (!step6Container) return;

        const formData = new FormData();

        formData.append('cliente_id', this.clienteId);
        formData.append('paso', 6);

        // ----------------------------
        // 📎 Archivos
        // ----------------------------
        if (window.uploadedFilesPaso6) {
            Object.entries(window.uploadedFilesPaso6).forEach(([tipo, files]) => {
                files.forEach(file => {
                    formData.append(`documentos[${tipo}][]`, file);
                });
            });
        }

        // ----------------------------
        // 📝 Notas
        // ----------------------------
        const notas = step6Container.querySelector('#notas_adicionales')?.value || '';
        formData.append('notas_adicionales', notas);

        try {
            const response = await fetch('/api/save', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.mensaje || 'Error al guardar documentación');
            }

            this.updateSaveStatus('saved');

            // Actualizar datos globales
            if (!window.formularioData.datosFormulario) {
                window.formularioData.datosFormulario = {};
            }

            if (result.formulario_data_actualizada?.documentacion) {
                window.formularioData.datosFormulario.documentacion =
                    result.formulario_data_actualizada.documentacion;
            }

            return result;

        } catch (error) {
            console.error(error);
            this.updateSaveStatus('error');
            throw error;
        }
    }

    async saveCurrentStep() {
        if (!this.clienteId) return;

        if (this.currentStep === 6) {
            console.info('Paso 6: saveCurrentStep bloqueado, solo uploads');
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
                if (result.formulario_data_actualizada.niveles_acceso !== undefined) {
                    df.niveles_acceso = result.formulario_data_actualizada.niveles_acceso;
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

    updateProgress(percentage) {
        if (percentage !== undefined) {
            if (this.elements.progressBar) {
                this.elements.progressBar.style.width = `${percentage}%`;
                this.elements.progressBar.setAttribute('aria-valuenow', percentage);
            }

            if (this.elements.progressPercentage) {
                this.elements.progressPercentage.textContent = `${percentage}%`;
            }
        }
    }

    loadExistingData() {
        if (typeof window.formularioData !== 'undefined' && window.formularioData.datosFormulario) {
            const datos = window.formularioData.datosFormulario;

            console.log('datos ###', datos);

            // Cargar datos según el paso actual
            this.loadStepData(this.currentStep, datos);
            // Actualizar la barra de progreso con el porcentaje inicial
            this.updateProgress(window.formularioData.porcentajeCompletado);
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
            stepData = datos.niveles_acceso || datos.paso_5 || [];
        } else if (step === 6) {
            stepData = datos.documentacion || datos.paso_6 || {};
        }

        // =========================
        // PASO 2 – Trasteros
        // =========================
        // if (step === 2 && Array.isArray(stepData)) {
        //     const container = document.getElementById('trasteros-container');
        //     if (!container) return;
        //
        //     // Limpiar existentes
        //     container
        //         .querySelectorAll('.trastero-item:not(#trastero-template)')
        //         .forEach(el => el.remove());
        //
        //     stepData.forEach(trastero => {
        //         if (typeof window.addTrastero !== 'function') return;
        //
        //         const el = window.addTrastero();
        //         if (!el) return;
        //
        //         el.querySelector('.trastero-numero').value = trastero.numero_trastero || '';
        //         el.querySelector('.trastero-metros').value = trastero.metros || '';
        //         el.querySelector('.trastero-cubicos').value = trastero.metros_cubicos || '';
        //         el.querySelector('.trastero-precio-sin-iva').value = trastero.precio_sin_iva || '';
        //         el.querySelector('.trastero-precio-con-iva').value = trastero.precio_con_iva || '';
        //         el.querySelector('.trastero-fianza').value = trastero.fianza || '';
        //         el.querySelector('.trastero-descripcion').value = trastero.descripcion || '';
        //
        //         // Validar campos restaurados
        //         el.querySelectorAll('input, select, textarea').forEach(f => {
        //             this.validateField(f);
        //         });
        //     });
        //
        //     return; // ⬅️ CRÍTICO
        // }

        // =========================
        // PASO 3 – Usuarios
        // =========================
        // if (step === 3 && Array.isArray(stepData)) {
        //     const container = document.getElementById('usuarios-container');
        //
        //     if (!container) return;
        //
        //     if (typeof window.addUsuario !== 'function') return;
        //
        //     // Limpiar existentes
        //     container
        //         .querySelectorAll('.usuario-item:not(#usuario-template)')
        //         .forEach(el => el.remove());
        //
        //     stepData.forEach(usuario => {
        //         const el = window.addUsuario();
        //         if (!el) return;
        //
        //         el.querySelector('.usuario-nombre').value = usuario.nombre_usuario || '';
        //         el.querySelector('.usuario-email').value = usuario.email_usuario || '';
        //         el.querySelector('.usuario-password').value = usuario.password_usuario || '';
        //         el.querySelector('.usuario-confirm-password').value = usuario.confirm_password_usuario || '';
        //         el.querySelector('.usuario-rol').value = usuario.rol_usuario || 'usuario';
        //         el.querySelector('.usuario-departamento').value = usuario.departamento_usuario || '';
        //
        //         if (usuario.permisos) {
        //             el.querySelector('[name*="permisos_facturacion"]').checked = !!usuario.permisos.facturacion;
        //             el.querySelector('[name*="permisos_reportes"]').checked = !!usuario.permisos.reportes;
        //             el.querySelector('[name*="permisos_configuracion"]').checked = !!usuario.permisos.configuracion;
        //         }
        //
        //         // Forzar resumen + validaciones
        //         if (typeof updateUsuarioResumen === 'function') {
        //             updateUsuarioResumen(el);
        //         }
        //
        //         el.querySelectorAll('input, select').forEach(f => {
        //             this.validateField(f);
        //         });
        //     });
        //
        //     return; // ⬅️ IGUAL DE CRÍTICO
        // }

        // =========================
        // PASO 5: niveles dinámicos
        // =========================
        // if (step === 5 && Array.isArray(stepData)) {
        //     const container = document.getElementById('niveles-container');
        //     if (!container) return;
        //
        //     container
        //         .querySelectorAll('.nivel-item:not(#nivel-template)')
        //         .forEach(el => el.remove());
        //
        //     stepData.forEach(nivel => {
        //         if (typeof window.addNivel === 'function') {
        //             const el = window.addNivel();
        //             if (!el) return;
        //
        //             el.querySelector('.nivel-nombre').value = nivel.nombre || '';
        //             el.querySelector('.nivel-prioridad').value = nivel.prioridad || '';
        //             el.querySelector('.nivel-descripcion').value = nivel.descripcion || '';
        //             el.querySelector('.acceso-24h').checked = !!nivel.acceso_24h;
        //         }
        //     });
        //
        //     return;
        // }

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
        // Permitir navegación a cualquier paso completado o al siguiente inmediato
        if (step <= this.currentStep + 1) {
            return true;
        }

        // Verificar si el paso tiene datos ya guardados
        if (window.formularioData && window.formularioData.datosFormulario) {
            let tieneDatos = false;

            switch (step) {
                case 1:
                    tieneDatos = window.formularioData.datosFormulario.datos_empresa &&
                        Object.keys(window.formularioData.datosFormulario.datos_empresa).length > 0;
                    break;
                case 2:
                    tieneDatos = window.formularioData.datosFormulario.info_trasteros &&
                        Object.keys(window.formularioData.datosFormulario.info_trasteros).length > 0;
                    break;
                case 3:
                    tieneDatos = window.formularioData.datosFormulario.usuarios_app &&
                        Object.keys(window.formularioData.datosFormulario.usuarios_app).length > 0;
                    break;
                case 4:
                    tieneDatos = window.formularioData.datosFormulario.config_correo &&
                        Object.keys(window.formularioData.datosFormulario.config_correo).length > 0;
                    break;
                case 5:
                    tieneDatos = window.formularioData.datosFormulario.niveles_acceso &&
                        Object.keys(window.formularioData.datosFormulario.niveles_acceso).length > 0;
                    break;
                case 6:
                    tieneDatos = window.formularioData.datosFormulario.documentacion &&
                        Object.keys(window.formularioData.datosFormulario.documentacion).length > 0;
                    break;
            }

            return tieneDatos;
        }

        return false;
    }

    completeForm() {
        this.isSubmitting = true;

        // Mostrar modal de confirmación o completar directamente
        this.showToast('¡Formulario completado exitosamente!', 'success');

        // Redirigir o mostrar página de éxito
        setTimeout(() => {
            window.location.href = `/`;
        }, 2000);
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


