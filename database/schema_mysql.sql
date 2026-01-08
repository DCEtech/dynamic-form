-- Esquema MySQL para Formulario Dinámico de Clientes

CREATE TABLE IF NOT EXISTS clientes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre_cliente VARCHAR(100) UNIQUE NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
    activo TINYINT(1) DEFAULT 1,
    completado TINYINT(1) DEFAULT 0
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS formularios_clientes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    cliente_id INT NOT NULL,

    datos_empresa LONGTEXT,
    info_trasteros LONGTEXT,
    usuarios_app LONGTEXT,
    config_correo LONGTEXT,
    niveles_acceso LONGTEXT,
    documentacion LONGTEXT,

    paso_actual INT DEFAULT 1,
    porcentaje_completado INT DEFAULT 0,

    fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion DATETIME DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_formulario_cliente
        FOREIGN KEY (cliente_id)
        REFERENCES clientes(id)
        ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS archivos_clientes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    formulario_id INT NOT NULL,
    nombre_original VARCHAR(255) NOT NULL,
    nombre_archivo VARCHAR(255) NOT NULL,
    tipo_archivo VARCHAR(50) NOT NULL,
    size_bytes INT NOT NULL,
    ruta_archivo VARCHAR(500) NOT NULL,
    paso_formulario INT NOT NULL,
    fecha_subida DATETIME DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_archivos_formulario
        FOREIGN KEY (formulario_id)
        REFERENCES formularios_clientes(id)
        ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS logs_formulario (
    id INT AUTO_INCREMENT PRIMARY KEY,
    cliente_id INT NOT NULL,
    formulario_id INT,
    accion VARCHAR(100) NOT NULL,
    paso INT,
    detalles LONGTEXT,
    ip_address VARCHAR(45),
    user_agent LONGTEXT,
    fecha DATETIME DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_logs_cliente
        FOREIGN KEY (cliente_id)
        REFERENCES clientes(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_logs_formulario
        FOREIGN KEY (formulario_id)
        REFERENCES formularios_clientes(id)
        ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE INDEX idx_clientes_slug ON clientes(slug);
CREATE INDEX idx_formularios_cliente ON formularios_clientes(cliente_id);
CREATE INDEX idx_archivos_formulario ON archivos_clientes(formulario_id);
CREATE INDEX idx_logs_cliente ON logs_formulario(cliente_id);
CREATE INDEX idx_logs_fecha ON logs_formulario(fecha);
