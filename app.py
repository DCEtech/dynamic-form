#!/usr/bin/env python3
"""
Aplicación Flask para el formulario dinámico de clientes
"""

import os
import logging
import json
import uuid
from datetime import datetime
from pathlib import Path
from flask import Flask, render_template, request, jsonify, redirect, url_for, flash, session
from werkzeug.utils import secure_filename
from database.init_db import get_connection
from slugify import slugify
# import sqlite3

# Importar configuración y modelos
import config
from models.cliente import Cliente
from models.formulario import Formulario

# Configuración de la aplicación
app = Flask(__name__)
app.config.from_object(config.DevelopmentConfig)

# Configuración de uploads
UPLOAD_FOLDER = 'uploads'
ALLOWED_EXTENSIONS = {'txt', 'pdf', 'png', 'jpg', 'jpeg', 'gif', 'docx'}

if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

# Definición global de los nombres de los pasos
step_names = [
    "Datos de la Empresa",
    "Información de Trasteros",
    "Usuarios de la Aplicación",
    "Configuración de Correo",
    "Niveles de Acceso",
    "Documentación"
]


def allowed_file(filename):
    return '.' in filename and \
        filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


# def get_db_connection():
#     """Obtener conexión a la base de datos"""
#     conn = sqlite3.connect(app.config['DATABASE_PATH'])
#     conn.row_factory = sqlite3.Row
#     return conn


# def init_db():
#     """Inicializar la base de datos"""
#     with app.app_context():
#         conn = get_db_connection()
#         with open('database/schema.sql', 'r', encoding='utf-8') as f:
#             conn.executescript(f.read())
#         conn.close()


@app.route('/')
def index():
    clientes = Cliente.listar_todos(solo_activos=True)

    clientes_view = []

    for cliente in clientes:
        formulario = cliente.obtener_formulario()

        clientes_view.append({
            'id': cliente.id,
            'nombre_cliente': cliente.nombre_cliente,
            'slug': cliente.slug,
            'fecha_creacion': cliente.fecha_creacion,
            'paso_actual': formulario.paso_actual if formulario else 1,
            'porcentaje_completado': formulario.porcentaje_completado if formulario else 0,
            'ultima_actualizacion': formulario.fecha_actualizacion if formulario else cliente.fecha_creacion
        })

    return render_template('index.html', clientes=clientes_view)


# def index():
#     """Página principal - Lista de clientes"""
#     conn = get_db_connection()
#
#     # Obtener todos los clientes con su progreso
#     clientes = conn.execute('''
#                             SELECT c.*,
#                                    COALESCE(f.paso_actual, 1)                        as paso_actual,
#                                    COALESCE(f.porcentaje_completado, 0)              as porcentaje_completado,
#                                    COALESCE(f.fecha_actualizacion, c.fecha_creacion) as ultima_actualizacion
#                             FROM clientes c
#                                      LEFT JOIN formularios_clientes f ON c.id = f.cliente_id
#                             ORDER BY c.fecha_creacion DESC
#                             ''').fetchall()
#
#     conn.close()
#
#     return render_template('index.html', clientes=clientes)


@app.route('/cliente/nuevo', methods=['POST'])
def nuevo_cliente():
    base_name = "Nueva Empresa"
    slug_base = "nueva-empresa"

    clientes_existentes = Cliente.listar_todos(solo_activos=False)
    cantidad = len([
        c for c in clientes_existentes
        if c.nombre_cliente.startswith(base_name)
    ])

    nombre = f"{base_name} {cantidad + 1}"
    slug = f"{slug_base}-{cantidad + 1}"

    cliente = Cliente.crear(nombre, slug)

    if not cliente:
        flash("Error creando el cliente", "error")
        return redirect(url_for('index'))

    # Crear formulario asociado
    Formulario.crear(cliente.id)

    flash(f"Se ha creado el nuevo cliente '{nombre}'.", "success")
    return redirect(url_for('formulario_cliente', nombre_cliente=cliente.slug))


# def nuevo_cliente():
#     """Crear un nuevo cliente y redirigir a su formulario"""
#     conn = get_db_connection()
#
#     # Generar un nombre y slug únicos
#     base_name = "Nueva Empresa"
#     slug_base = "nueva-empresa"
#
#     # Buscar si ya existen empresas con ese nombre
#     existing_clients = conn.execute(
#         "SELECT nombre_cliente FROM clientes WHERE nombre_cliente LIKE ?",
#         (f"{base_name}%",)
#     ).fetchall()
#
#     # Generar un nombre único
#     new_name = f"{base_name} {len(existing_clients) + 1}"
#     new_slug = f"{slug_base}-{len(existing_clients) + 1}"
#
#     # Crear nuevo cliente
#     cursor = conn.cursor(dictionary=True)
#
#     cursor.execute(
#         "INSERT INTO clientes (nombre_cliente, slug) VALUES (?, ?)",
#         (new_name, new_slug)
#     )
#     conn.commit()
#     cliente_id = cursor.lastrowid
#
#     # Crear formulario asociado
#     Formulario.crear(cliente_id)
#
#     conn.close()
#
#     flash(f"Se ha creado el nuevo cliente '{new_name}'.", "success")
#     return redirect(url_for('formulario_cliente', nombre_cliente=new_slug))


@app.route('/cliente/<nombre_cliente>')
def formulario_cliente(nombre_cliente):
    # 🔎 Obtener cliente por slug
    cliente = Cliente.obtener_por_slug(nombre_cliente)

    if not cliente:
        flash("Cliente no encontrado", "error")
        return redirect(url_for('index'))

    # 📄 Obtener formulario
    formulario_obj = Formulario.obtener_por_cliente(cliente.id)

    if not formulario_obj:
        formulario_obj = Formulario.crear(cliente.id)

    formulario_data = {
        'formulario_id': formulario_obj.id,
        'clienteId': cliente.id,
        'nombreCliente': cliente.slug,
        'pasoActual': formulario_obj.paso_actual,
        'totalPasos': 6,
        'porcentajeCompletado': formulario_obj.porcentaje_completado,
        'porcentajeCompletadoStyled': f"{formulario_obj.porcentaje_completado}%",
        'stepNames': step_names,
        'datosFormulario': {
            'datos_empresa': formulario_obj.datos_empresa,
            'info_trasteros': formulario_obj.info_trasteros,
            'usuarios_app': formulario_obj.usuarios_app,
            'config_correo': formulario_obj.config_correo,
            'niveles_acceso': formulario_obj.niveles_acceso,
            'documentacion': formulario_obj.documentacion
        }
    }

    return render_template(
        'formulario.html',
        cliente=cliente,
        formulario=formulario_obj,
        formulario_data=formulario_data,
        step_names=step_names
    )


# def formulario_cliente(nombre_cliente):
#     conn = get_db_connection()
#
#     cliente = conn.execute(
#         'SELECT * FROM clientes WHERE slug = ?',
#         (nombre_cliente,)
#     ).fetchone()
#
#     if not cliente:
#         nombre_display = nombre_cliente.replace('-', ' ').title()
#         conn.execute(
#             'INSERT INTO clientes (nombre_cliente, slug) VALUES (?, ?)',
#             (nombre_display, nombre_cliente)
#         )
#         conn.commit()
#
#         cliente = conn.execute(
#             'SELECT * FROM clientes WHERE slug = ?',
#             (nombre_cliente,)
#         ).fetchone()
#
#     conn.close()
#
#     formulario_obj = Formulario.obtener_por_cliente(cliente['id'])
#
#     formulario_data = {
#         'formulario_id': formulario_obj.id if formulario_obj else None,
#         'clienteId': cliente['id'],
#         'nombreCliente': nombre_cliente,
#         'pasoActual': formulario_obj.paso_actual if formulario_obj else 1,
#         'totalPasos': 6,
#         'porcentajeCompletado': formulario_obj.porcentaje_completado if formulario_obj else 0,
#         'porcentajeCompletadoStyled': f"{formulario_obj.porcentaje_completado if formulario_obj else 0}%",
#         'stepNames': step_names,
#         'datosFormulario': {
#             'info_trasteros': formulario_obj.info_trasteros if formulario_obj else [],
#             'datos_empresa': formulario_obj.datos_empresa if formulario_obj else {},
#             'usuarios_app': formulario_obj.usuarios_app if formulario_obj else {},
#             'config_correo': formulario_obj.config_correo if formulario_obj else {},
#             'niveles_acceso': formulario_obj.niveles_acceso if formulario_obj else {},
#             'documentacion': formulario_obj.documentacion if formulario_obj else {}
#         }
#     }
#
#     return render_template(
#         'formulario.html',
#         cliente=cliente,
#         formulario=formulario_obj,
#         formulario_data=formulario_data,
#         step_names=step_names
#     )


@app.route('/api/save', methods=['POST'])
def save_form_data():
    """Guardar datos del formulario vía API"""
    try:
        data = request.get_json()
        cliente_id = data.get('cliente_id')
        paso = data.get('paso')
        datos = data.get('datos')

        # Se verifica que cliente_id y paso_actual estén presentes.
        # 'datos' puede ser un diccionario vacío si el paso no tiene campos o no se han rellenado aún.
        if not all([cliente_id, paso]) or datos is None:
            return jsonify({'error': 'Datos incompletos (cliente_id, paso o datos faltantes)'}), 400

        cliente_actualizado = None

        if paso == 1:
            datos_empresa = datos or {}
            nombre_nuevo = datos_empresa.get('nombre')

            if nombre_nuevo:
                cliente = Cliente.obtener_por_id(cliente_id)

                if cliente and cliente.nombre_cliente != nombre_nuevo:
                    slug_base = slugify(nombre_nuevo)
                    slug_final = slug_base
                    contador = 1

                    while Cliente.existe_slug(slug_final, excluir_id=cliente.id):
                        contador += 1
                        slug_final = f"{slug_base}-{contador}"

                    Cliente.actualizar_nombre_y_slug(
                        cliente_id=cliente.id,
                        nombre_cliente=nombre_nuevo,
                        slug=slug_final
                    )

                    cliente_actualizado = {
                        "nombre": nombre_nuevo,
                        "slug": slug_final
                    }

        # Obtener el formulario existente para este cliente
        formulario_obj = Formulario.obtener_por_cliente(cliente_id)

        if not formulario_obj:
            # Si no existe, creamos uno nuevo
            formulario_obj = Formulario.crear(cliente_id)
            if not formulario_obj:
                raise Exception("No se pudo crear el formulario para el cliente.")

        # Guardar los datos del paso utilizando el método del modelo
        guardado_exitoso = formulario_obj.guardar_paso(paso, datos)

        if not guardado_exitoso:
            raise Exception("Error al guardar el paso en la base de datos.")

        # Recargar el formulario para obtener los datos actualizados y el porcentaje
        formulario_obj_actualizado = Formulario.obtener_por_cliente(cliente_id)

        return jsonify({
            'success': True,
            'porcentaje': formulario_obj_actualizado.porcentaje_completado,
            'mensaje': 'Datos guardados correctamente',
            'formulario_data_actualizada': formulario_obj_actualizado.to_dict(),
            'cliente_actualizado': cliente_actualizado
        })



    except Exception as e:
        import traceback
        app.logger.error("Error en save_form_data: %s", traceback.format_exc())
        return jsonify({'error': 'Error interno del servidor. Detalles: ' + str(e)}), 500


@app.route('/api/upload', methods=['POST'])
def upload_file():
    try:
        if 'file' not in request.files:
            return jsonify({'error': 'No se encontró archivo'}), 400

        file = request.files['file']
        cliente_id = request.form.get('cliente_id')
        tipo_archivo = request.form.get('tipo', 'general')

        if not cliente_id:
            return jsonify({'error': 'cliente_id requerido'}), 400

        if file.filename == '':
            return jsonify({'error': 'No se seleccionó archivo'}), 400

        if not allowed_file(file.filename):
            return jsonify({'error': 'Tipo de archivo no permitido'}), 400

        # 🔎 Obtener formulario vía MODELO (MySQL)
        formulario = Formulario.obtener_por_cliente(cliente_id)
        if not formulario:
            return jsonify({'error': 'No hay formulario activo para el cliente'}), 400

        filename = secure_filename(file.filename)

        unique_filename = (
            f"{cliente_id}_{tipo_archivo}_"
            f"{datetime.now().strftime('%Y%m%d_%H%M%S')}_{filename}"
        )

        file_path = os.path.join(UPLOAD_FOLDER, unique_filename)
        file.save(file_path)

        # 📦 Tamaño real del archivo
        tamano_bytes = os.path.getsize(file_path)

        # 💾 Insertar en MySQL
        conn = get_connection()
        cursor = conn.cursor(dictionary=True)

        cursor.execute(
            """
            INSERT INTO archivos_clientes (formulario_id,
                                           nombre_original,
                                           nombre_archivo,
                                           tipo_archivo,
                                           tamano_bytes,
                                           ruta_archivo,
                                           paso_formulario,
                                           fecha_subida)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                formulario.id,
                filename,
                unique_filename,
                tipo_archivo,
                tamano_bytes,
                file_path,
                6,
                datetime.now()
            )
        )

        conn.commit()
        cursor.close()
        conn.close()

        return jsonify({
            'success': True,
            'filename': unique_filename,
            'original_name': filename,
            'formulario_id': formulario.id
        })

    except Exception as e:
        import traceback
        app.logger.error(traceback.format_exc())
        return jsonify({'error': 'Error al subir archivo', 'detalle': str(e)}), 500


# def upload_file():
#     try:
#         if 'file' not in request.files:
#             return jsonify({'error': 'No se encontró archivo'}), 400
#
#         file = request.files['file']
#         cliente_id = request.form.get('cliente_id')  # se usa SOLO para localizar el formulario
#         tipo_archivo = request.form.get('tipo', 'general')
#
#         if not cliente_id:
#             return jsonify({'error': 'cliente_id requerido'}), 400
#
#         if file.filename == '':
#             return jsonify({'error': 'No se seleccionó archivo'}), 400
#
#         if not allowed_file(file.filename):
#             return jsonify({'error': 'Tipo de archivo no permitido'}), 400
#
#         filename = secure_filename(file.filename)
#
#         unique_filename = (
#             f"{cliente_id}_{tipo_archivo}_"
#             f"{datetime.now().strftime('%Y%m%d_%H%M%S')}_{filename}"
#         )
#
#         file_path = os.path.join(UPLOAD_FOLDER, unique_filename)
#         file.save(file_path)
#
#         conn = get_db_connection()
#         cursor = conn.cursor(dictionary=True)
#
#         # 🔎 Obtener formulario activo del cliente
#         cursor.execute("""
#                        SELECT id
#                        FROM formularios_clientes
#                        WHERE cliente_id = ?
#                        ORDER BY fecha_creacion DESC LIMIT 1
#                        """, (cliente_id,))
#
#         row = cursor.fetchone()
#         if not row:
#             conn.close()
#             return jsonify({'error': 'No hay formulario activo para el cliente'}), 400
#
#         formulario_id = row['id']
#
#         # ✅ INSERT SIN cliente_id
#         cursor.execute("""
#                        INSERT INTO archivos_clientes (formulario_id,
#                                                       nombre_original,
#                                                       nombre_archivo,
#                                                       tipo_archivo,
#                                                       tamaño_bytes,
#                                                       ruta_archivo,
#                                                       paso_formulario,
#                                                       fecha_subida)
#                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
#                        """, (
#                            formulario_id,
#                            filename,
#                            unique_filename,
#                            tipo_archivo,
#                            file.content_length or file.seek(0, os.SEEK_END) or file.tell(),
#                            file_path,
#                            6,
#                            datetime.now()
#                        ))
#
#         conn.commit()
#         conn.close()
#
#         return jsonify({
#             'success': True,
#             'filename': unique_filename,
#             'original_name': filename,
#             'formulario_id': formulario_id
#         })
#
#     except Exception as e:
#         return jsonify({'error': str(e)}), 500


@app.route('/api/formulario/<int:formulario_id>/archivos')
def get_form_files(formulario_id):
    formulario = Formulario.obtener_por_id(formulario_id)
    if not formulario:
        return jsonify({'archivos': []})

    return jsonify({'archivos': formulario.obtener_archivos()})


# def get_form_files(formulario_id):
#     conn = get_db_connection()
#     archivos = conn.execute("""
#                             SELECT *
#                             FROM archivos_clientes
#                             WHERE formulario_id = ?
#                             ORDER BY fecha_subida DESC
#                             """, (formulario_id,)).fetchall()
#     conn.close()
#
#     return jsonify({
#         'archivos': [
#             {
#                 'id': a['id'],
#                 'nombre_original': a['nombre_original'],
#                 'nombre_archivo': a['nombre_archivo'],
#                 'tipo_archivo': a['tipo_archivo'],
#                 'paso_formulario': a['paso_formulario']
#             }
#             for a in archivos
#         ]
#     })


# @app.route('/api/cliente/<cliente_id>/archivos')
# def get_client_files(cliente_id):
#     """Obtener archivos de un cliente"""
#     try:
#         conn = get_db_connection()
#         archivos = conn.execute('''
#                                 SELECT *
#                                 FROM archivos_clientes
#                                 WHERE cliente_id = ?
#                                 ORDER BY fecha_subida DESC
#                                 ''', (cliente_id,)).fetchall()
#         conn.close()
#
#         archivos_list = []
#         for archivo in archivos:
#             archivos_list.append({
#                 'id': archivo['id'],
#                 'nombre_original': archivo['nombre_original'],
#                 'tipo_archivo': archivo['tipo_archivo'],
#                 'fecha_subida': archivo['fecha_subida']
#             })
#
#         return jsonify({'archivos': archivos_list})
#
#     except Exception as e:
#         return jsonify({'error': str(e)}), 500


@app.route('/api/test-email', methods=['POST'])
def test_email_config():
    """Probar configuración de email"""
    try:
        data = request.get_json()

        # Aquí iría la lógica para probar la conexión SMTP
        # Por ahora simulamos el test

        servidor = data.get('servidor_saliente')
        puerto = data.get('puerto')
        usuario = data.get('usuario_email')

        if not all([servidor, puerto, usuario]):
            return jsonify({'error': 'Configuración incompleta'}), 400

        # Simulación de test exitoso (70% de probabilidad)
        import random
        success = random.random() > 0.3

        if success:
            return jsonify({
                'success': True,
                'mensaje': 'Conexión exitosa al servidor de correo'
            })
        else:
            return jsonify({
                'success': False,
                'error': 'No se pudo conectar al servidor. Verifique la configuración.'
            })

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/cliente/<cliente_id>/completar', methods=['POST'])
def completar_formulario(cliente_id):
    """Marcar formulario como completado"""
    formulario = Formulario.obtener_por_cliente(cliente_id)

    if not formulario:
        return jsonify({'error': 'Formulario no encontrado'}), 404

    # Marcar como finalizado
    formulario.paso_actual = 6
    formulario.porcentaje_completado = 100
    formulario._guardar_en_bd()

    return jsonify({
        'success': True,
        'mensaje': 'Formulario completado correctamente',
        'formulario': formulario.to_dict()
    })


@app.route('/api/clientes')
def get_clientes():
    """API para obtener lista de clientes"""
    try:
        clientes = Cliente.listar_todos(solo_activos=True)

        clientes_list = []
        for cliente in clientes:
            formulario = cliente.obtener_formulario()
            clientes_list.append({
                'id': cliente.id,
                'nombre_url': cliente.slug,  # antes nombre_url, ahora usamos slug
                'estado': 'activo' if cliente.activo else 'inactivo',
                'paso_actual': formulario.paso_actual if formulario else 1,
                'porcentaje_completado': formulario.porcentaje_completado if formulario else 0,
                'completado': cliente.completado,
                'fecha_creacion': cliente.fecha_creacion
            })

        return jsonify({'clientes': clientes_list})

    except Exception as e:
        return jsonify({'error': str(e)}), 500


# def get_clientes():
#     """API para obtener lista de clientes"""
#     try:
#         conn = get_db_connection()
#         clientes = conn.execute('''
#                                 SELECT c.*,
#                                        COALESCE(f.paso_actual, 1)           as paso_actual,
#                                        COALESCE(f.porcentaje_completado, 0) as porcentaje_completado,
#                                        COALESCE(f.completado, 0)            as completado
#                                 FROM clientes c
#                                          LEFT JOIN formularios f ON c.id = f.cliente_id
#                                 ORDER BY c.fecha_creacion DESC
#                                 ''').fetchall()
#         conn.close()
#
#         clientes_list = []
#         for cliente in clientes:
#             clientes_list.append({
#                 'id': cliente['id'],
#                 'nombre_url': cliente['nombre_url'],
#                 'estado': cliente['estado'],
#                 'paso_actual': cliente['paso_actual'],
#                 'porcentaje_completado': cliente['porcentaje_completado'],
#                 'completado': bool(cliente['completado']),
#                 'fecha_creacion': cliente['fecha_creacion']
#             })
#
#         return jsonify({'clientes': clientes_list})
#
#     except Exception as e:
#         return jsonify({'error': str(e)}), 500


def calcular_porcentaje_completado(datos_formulario):
    """Calcular porcentaje de completado basado en los datos del formulario"""
    total_pasos = 6
    pasos_completados = 0

    # Definir campos requeridos por paso
    campos_requeridos = {
        'paso_1': ['nombre_empresa', 'nif_cif', 'direccion', 'telefono', 'email'],
        'paso_2': ['numero_trasteros'],
        'paso_3': ['usuarios'],
        'paso_4': ['servidor_saliente', 'puerto', 'usuario_email'],
        'paso_5': ['niveles_acceso'],
        'paso_6': []  # Documentación es opcional
    }

    for paso, campos in campos_requeridos.items():
        if paso in datos_formulario:
            datos_paso = datos_formulario[paso]

            if paso == 'paso_6':  # Documentación siempre cuenta como completado
                pasos_completados += 1
            else:
                # Verificar si los campos requeridos están presentes
                campos_presentes = all(campo in datos_paso and datos_paso[campo] for campo in campos)
                if campos_presentes:
                    pasos_completados += 1

    return int((pasos_completados / total_pasos) * 100)


@app.errorhandler(404)
def not_found_error(error):
    return render_template('404.html'), 404


@app.errorhandler(500)
def internal_error(error):
    return render_template('500.html'), 500


# Filtros de template personalizados
@app.template_filter('datetime')
def datetime_filter(value):
    """Formatear datetime para mostrar en templates"""
    if isinstance(value, str):
        try:
            value = datetime.fromisoformat(value.replace('Z', '+00:00'))
        except:
            return value

    if isinstance(value, datetime):
        return value.strftime('%d/%m/%Y %H:%M')
    return value


@app.template_filter('date')
def date_filter(value):
    """Formatear fecha para mostrar en templates"""
    if isinstance(value, str):
        try:
            value = datetime.fromisoformat(value.replace('Z', '+00:00'))
        except:
            return value

    if isinstance(value, datetime):
        return value.strftime('%d/%m/%Y')
    return value


if __name__ == '__main__':
    # Inicializar base de datos si no existe
    # if not os.path.exists(app.config['DATABASE_PATH']):
    #     init_db()

    app.run(debug=True, host='0.0.0.0', port=8080)
