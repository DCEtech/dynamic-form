#!/usr/bin/env python3
"""
Aplicación Flask para el formulario dinámico de clientes
"""
import io
import os
import logging
import json
import uuid
from crypt import methods
from datetime import datetime
from pathlib import Path
from flask import Flask, render_template, request, jsonify, redirect, url_for, flash, session
from dotenv import load_dotenv

load_dotenv()
from werkzeug.utils import secure_filename
from database.init_db import get_connection
from slugify import slugify

# Importar configuración y modelos
import config
from models.cliente import Cliente
from models.formulario import Formulario
from services.storage import StorageService

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

storage = StorageService()


def allowed_file(filename):
    return '.' in filename and \
        filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


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
            'completado': cliente.completado,
            'ultima_actualizacion': formulario.fecha_actualizacion if formulario else cliente.fecha_creacion
        })

    return render_template('index.html', clientes=clientes_view)


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
        'completado': formulario_obj.completado,  # <--- IMPORTANTE
        'estado_pasos': formulario_obj.to_dict()['estado_pasos'],  # <--- IMPORTANTE
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


@app.route('/api/save', methods=['POST'])
def save_form_data():
    try:
        data = request.get_json()
        cliente_id = data.get('cliente_id')
        paso = data.get('paso')
        datos = data.get('datos')

        if not all([cliente_id, paso]) or datos is None:
            return jsonify({
                'error': 'Datos incompletos (cliente_id, paso o datos faltantes)'
            }), 400

        cliente = Cliente.obtener_por_id(cliente_id)
        if not cliente:
            return jsonify({
                'error': 'Cliente no existe. No se puede crear el formulario.'
            }), 400

        cliente_actualizado = None

        # Paso 1: actualizar nombre / slug si aplica
        if paso == 1:
            datos_empresa = datos or {}
            nombre_nuevo = datos_empresa.get('nombre')

            if nombre_nuevo and cliente.nombre_cliente != nombre_nuevo:
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

        # Obtener o crear formulario
        formulario_obj = Formulario.obtener_por_cliente(cliente_id)

        if not formulario_obj:
            formulario_obj = Formulario.crear(cliente_id)
            if not formulario_obj:
                raise Exception("No se pudo crear el formulario para el cliente.")

        # Guardar datos del paso
        guardado_exitoso = formulario_obj.guardar_paso(paso, datos)

        if not guardado_exitoso:
            raise Exception("Error al guardar el paso.")

        estado_pasos = {
            'datos_empresa': formulario_obj.paso_completo(1, formulario_obj.datos_empresa),
            'info_trasteros': formulario_obj.paso_completo(2, formulario_obj.info_trasteros),
            'usuarios_app': formulario_obj.paso_completo(3, formulario_obj.usuarios_app),
            'config_correo': formulario_obj.paso_completo(4, formulario_obj.config_correo),
            'niveles_acceso': formulario_obj.paso_completo(5, formulario_obj.niveles_acceso),
            'documentacion': formulario_obj.paso_completo(6, formulario_obj.documentacion),
        }

        formulario_obj_actualizado = Formulario.obtener_por_cliente(cliente_id)

        return jsonify({
            'success': True,
            'porcentaje': formulario_obj_actualizado.porcentaje_completado,
            'mensaje': 'Datos guardados correctamente',
            'formulario_data_actualizada': formulario_obj_actualizado.to_dict(),
            'estado_pasos': estado_pasos,
            'cliente_actualizado': cliente_actualizado
        })

    except Exception as e:
        import traceback
        app.logger.error("Error en save_form_data: %s", traceback.format_exc())
        return jsonify({
            'error': 'Error interno del servidor',
            'detalle': str(e)
        }), 500


@app.route('/api/upload', methods=['POST'])
def upload_file():
    storage_path = None

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

        formulario = Formulario.obtener_por_cliente(cliente_id)
        if not formulario:
            return jsonify({'error': 'No hay formulario activo para el cliente'}), 400

        filename = secure_filename(file.filename)
        unique_filename = f"{cliente_id}_{tipo_archivo}_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{filename}"

        folder = f"clientes/A-PruebaFormulario/{formulario.id}"

        # Subir archivo
        storage_path = storage.save(file.stream, unique_filename, folder)

        # Crear share público
        public_url = storage.create_public_share(storage_path)

        # Tamaño real
        file.stream.seek(0, os.SEEK_END)
        tamano_bytes = file.stream.tell()
        file.stream.seek(0)

        # Guardar en DB
        conn = get_connection()
        cursor = conn.cursor(dictionary=True)

        cursor.execute(
            """
            INSERT INTO archivos_clientes (formulario_id, nombre_original, nombre_archivo,
                                           tipo_archivo, tamano_bytes, ruta_archivo,
                                           public_url, paso_formulario, fecha_subida)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                formulario.id,
                filename,
                unique_filename,
                tipo_archivo,
                tamano_bytes,
                storage_path,
                public_url,
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
            'storage_path': storage_path,
            'public_url': public_url,
            'formulario_id': formulario.id,
            'archivo_id': cursor.lastrowid
        })

    except Exception as e:
        # ROLLBACK CLOUD
        if storage_path:
            try:
                storage.delete(storage_path)
            except Exception as cleanup_err:
                app.logger.error(f"Fallo limpiando archivo huérfano {storage_path}: {cleanup_err}")

        import traceback
        app.logger.error(traceback.format_exc())
        return jsonify({'error': 'Error al subir archivo', 'detalle': str(e)}), 500


@app.route('/api/formulario/<int:formulario_id>/archivo/<int:archivo_id>', methods=['DELETE'])
def remove_file(formulario_id, archivo_id):
    formulario = Formulario.obtener_por_id(formulario_id)
    if not formulario:
        return jsonify({'success': False, 'error': 'Formulario no encontrado'}), 404

    conn = get_connection()
    cursor = conn.cursor(dictionary=True)

    cursor.execute(
        "SELECT * FROM archivos_clientes WHERE id = %s AND formulario_id = %s",
        (archivo_id, formulario_id)
    )

    archivo = cursor.fetchone()

    if not archivo:
        conn.close()
        return jsonify({'success': False, 'error': 'Archivo no pertenece a este formulario'}), 404

    try:
        # borrar en Nextcloud
        storage.delete(archivo['ruta_archivo'])

        # borrar en DB
        cursor.execute("DELETE FROM archivos_clientes WHERE id = %s", (archivo_id,))
        conn.commit()

        return jsonify({'success': True})
    except Exception as e:
        conn.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500
    finally:
        conn.close()


@app.route('/api/formulario/<int:formulario_id>/archivos')
def get_form_files(formulario_id):
    formulario = Formulario.obtener_por_id(formulario_id)
    if not formulario:
        return jsonify({'archivos': []})

    return jsonify({'archivos': formulario.obtener_archivos()})


@app.route('/api/cliente/<cliente_id>/completar', methods=['POST'])
def completar_formulario(cliente_id):
    formulario = Formulario.obtener_por_cliente(cliente_id)
    cliente = Cliente.obtener_por_id(cliente_id)

    if not formulario or not cliente:
        return jsonify({'error': 'No se encontró la información'}), 404

    if not formulario.paso_completo(6, formulario.documentacion):
        return jsonify({
            'success': False,
            'error': 'No se puede finalizar: Faltan archivos obligatorios (Contratos, Planos o Logo).'
        }), 400

    # 1. Marcar formulario como completado
    formulario.completado = 1
    formulario.porcentaje_completado = 100  # Forzamos al cierre
    formulario._guardar_en_bd()

    # 2. Sincronizar con la tabla de clientes
    cliente.completado = True
    cliente.actualizar()

    return jsonify({
        'success': True,
        'mensaje': 'Formulario cerrado y guardado correctamente',
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
    app.run(debug=True, host='0.0.0.0', port=8080)
