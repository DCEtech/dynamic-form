"""
Modelo Formulario para gestionar los datos del formulario dinámico
"""

import sqlite3
import json
from datetime import datetime
from typing import Optional, Dict, List, Any
from database.init_db import get_connection


class Formulario:
    """Modelo para gestionar formularios de clientes"""

    def __init__(self, id=None, cliente_id=None, datos_empresa=None,
                 info_trasteros=None, usuarios_app=None, config_correo=None,
                 niveles_acceso=None, documentacion=None, paso_actual=1,
                 porcentaje_completado=0, fecha_creacion=None, fecha_actualizacion=None):
        self.id = id
        self.cliente_id = cliente_id
        self.datos_empresa = datos_empresa or {}
        self.info_trasteros = info_trasteros or []
        self.usuarios_app = usuarios_app or {}
        self.config_correo = config_correo or {}
        self.niveles_acceso = niveles_acceso or {}
        self.documentacion = documentacion or {}
        self.paso_actual = paso_actual
        self.porcentaje_completado = porcentaje_completado
        self.fecha_creacion = fecha_creacion
        self.fecha_actualizacion = fecha_actualizacion

    @classmethod
    def crear(cls, cliente_id: int) -> 'Formulario':
        """
        Crea un nuevo formulario para un cliente
        
        Args:
            cliente_id (int): ID del cliente
            
        Returns:
            Formulario: Instancia del formulario creado
        """
        conn = get_connection()
        cursor = conn.cursor()

        cursor.execute(
            """INSERT INTO formularios_clientes (cliente_id, datos_empresa, info_trasteros,
                                                 usuarios_app, config_correo, niveles_acceso, documentacion)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (cliente_id, '{}', '[]', '{}', '{}', '{}', '{}')
        )
        formulario_id = cursor.lastrowid
        conn.commit()
        conn.close()

        return cls.obtener_por_id(formulario_id)

    @classmethod
    def obtener_por_id(cls, formulario_id: int) -> Optional['Formulario']:
        """Obtiene un formulario por su ID"""
        conn = get_connection()
        cursor = conn.cursor()

        cursor.execute("SELECT * FROM formularios_clientes WHERE id = ?", (formulario_id,))
        row = cursor.fetchone()
        conn.close()

        if row:
            return cls._from_row(row)
        return None

    @classmethod
    def obtener_por_cliente(cls, cliente_id: int) -> Optional['Formulario']:
        """Obtiene el formulario de un cliente específico"""
        conn = get_connection()
        cursor = conn.cursor()

        cursor.execute(
            "SELECT * FROM formularios_clientes WHERE cliente_id = ? ORDER BY fecha_creacion DESC LIMIT 1",
            (cliente_id,)
        )
        row = cursor.fetchone()
        conn.close()

        if row:
            return cls._from_row(row)
        return None

    @classmethod
    def _from_row(cls, row) -> 'Formulario':
        """Crea una instancia de Formulario desde una fila de la BD"""
        return cls(
            id=row['id'],
            cliente_id=row['cliente_id'],
            datos_empresa=json.loads(row['datos_empresa'] or '{}'),
            info_trasteros=json.loads(row['info_trasteros'] or '[]'),
            usuarios_app=json.loads(row['usuarios_app'] or '{}'),
            config_correo=json.loads(row['config_correo'] or '{}'),
            niveles_acceso=json.loads(row['niveles_acceso'] or '{}'),
            documentacion=json.loads(row['documentacion'] or '{}'),
            paso_actual=row['paso_actual'],
            porcentaje_completado=row['porcentaje_completado'],
            fecha_creacion=row['fecha_creacion'],
            fecha_actualizacion=row['fecha_actualizacion']
        )

    def guardar_paso(self, paso: int, datos: Dict[str, Any]) -> bool:
        """
        Guarda los datos de un paso específico
        
        Args:
            paso (int): Número del paso (1-6)
            datos (dict): Datos del paso
            
        Returns:
            bool: True si se guardó correctamente
        """
        # Mapear paso a campo correspondiente
        campos_paso = {
            1: 'datos_empresa',
            2: 'info_trasteros',
            3: 'usuarios_app',
            4: 'config_correo',
            5: 'niveles_acceso',
            6: 'documentacion'
        }

        if paso not in campos_paso:
            return False

        # Actualizar datos en memoria
        campo = campos_paso[paso]

        if paso == 2:
            if isinstance(datos, dict):
                datos = datos.get('trasteros', [])
            if not isinstance(datos, list):
                datos = []

        setattr(self, campo, datos)

        # Actualizar paso actual si es mayor
        if paso > self.paso_actual:
            self.paso_actual = paso

        # Calcular porcentaje de completado
        self.porcentaje_completado = self._calcular_porcentaje()

        # Guardar en base de datos
        return self._guardar_en_bd()

    def _calcular_porcentaje(self) -> int:
        """Calcula el porcentaje de completado basado en los datos"""
        pasos_completados = 0

        # Verificar cada paso
        if self._paso_completo(1, self.datos_empresa):
            pasos_completados += 1
        if self._paso_completo(2, self.info_trasteros):
            pasos_completados += 1
        if self._paso_completo(3, self.usuarios_app):
            pasos_completados += 1
        if self._paso_completo(4, self.config_correo):
            pasos_completados += 1
        if self._paso_completo(5, self.niveles_acceso):
            pasos_completados += 1
        if self._paso_completo(6, self.documentacion):
            pasos_completados += 1

        return int((pasos_completados / 6) * 100)

    def _paso_completo(self, paso: int, datos: Any) -> bool:
        """Verifica si un paso está completo según sus campos obligatorios"""
        campos_obligatorios = {
            1: ['nombre', 'nif', 'direccion', 'codigo_postal', 'provincia', 'telefono', 'email'],
            2: [],  # lista en si misma
            3: ['usuarios'],  # Al menos un usuario
            4: ['servidor_saliente', 'direccion_servidor', 'usuario_email', 'puerto'],
            5: ['niveles'],  # Al menos un nivel
            6: []  # Documentación es opcional
        }

        if paso not in campos_obligatorios:
            return False

        obligatorios = campos_obligatorios[paso]

        # Verificar campos obligatorios
        for campo in obligatorios:
            if campo not in datos or not datos[campo]:
                return False

        # Verificaciones especiales por paso
        if paso == 2:
            return isinstance(datos, list) and len(datos) > 0
        elif paso == 3 and isinstance(datos.get('usuarios'), list):
            return len(datos['usuarios']) > 0
        elif paso == 5 and isinstance(datos.get('niveles'), list):
            return len(datos['niveles']) > 0

        return True

    def _guardar_en_bd(self) -> bool:
        """Guarda el formulario en la base de datos"""
        conn = get_connection()
        cursor = conn.cursor()

        try:
            cursor.execute(
                """UPDATE formularios_clientes
                   SET datos_empresa         = ?,
                       info_trasteros        = ?,
                       usuarios_app          = ?,
                       config_correo         = ?,
                       niveles_acceso        = ?,
                       documentacion         = ?,
                       paso_actual           = ?,
                       porcentaje_completado = ?
                   WHERE id = ?""",
                (
                    json.dumps(self.datos_empresa, ensure_ascii=False),
                    json.dumps(self.info_trasteros, ensure_ascii=False),
                    json.dumps(self.usuarios_app, ensure_ascii=False),
                    json.dumps(self.config_correo, ensure_ascii=False),
                    json.dumps(self.niveles_acceso, ensure_ascii=False),
                    json.dumps(self.documentacion, ensure_ascii=False),
                    self.paso_actual,
                    self.porcentaje_completado,
                    self.id
                )
            )
            conn.commit()
            return True
        except sqlite3.Error:
            return False
        finally:
            conn.close()

    def obtener_datos_paso(self, paso: int) -> Dict[str, Any]:
        """Obtiene los datos de un paso específico"""
        campos_paso = {
            1: self.datos_empresa,
            2: self.info_trasteros,
            3: self.usuarios_app,
            4: self.config_correo,
            5: self.niveles_acceso,
            6: self.documentacion
        }

        if paso == 2:
            return self.info_trasteros or []

        return campos_paso.get(paso, {})

    def esta_completo(self) -> bool:
        """Verifica si el formulario está completamente lleno"""
        return self.porcentaje_completado == 100

    def obtener_archivos(self) -> List[Dict]:
        """Obtiene la lista de archivos subidos para este formulario"""
        conn = get_connection()
        cursor = conn.cursor()

        cursor.execute(
            """SELECT *
               FROM archivos_clientes
               WHERE formulario_id = ?
               ORDER BY fecha_subida DESC""",
            (self.id,)
        )
        rows = cursor.fetchall()
        conn.close()

        return [
            {
                'id': row['id'],
                'nombre_original': row['nombre_original'],
                'nombre_archivo': row['nombre_archivo'],
                'tipo_archivo': row['tipo_archivo'],
                'tamaño_bytes': row['tamaño_bytes'],
                'ruta_archivo': row['ruta_archivo'],
                'paso_formulario': row['paso_formulario'],
                'fecha_subida': row['fecha_subida']
            }
            for row in rows
        ]

    def to_dict(self) -> Dict:
        """Convierte el formulario a diccionario"""
        return {
            'id': self.id,
            'cliente_id': self.cliente_id,
            'paso_actual': self.paso_actual,
            'porcentaje_completado': self.porcentaje_completado,
            'datos_empresa': self.datos_empresa,
            'info_trasteros': self.info_trasteros,
            'usuarios_app': self.usuarios_app,
            'config_correo': self.config_correo,
            'niveles_acceso': self.niveles_acceso,
            'documentacion': self.documentacion,
            'fecha_creacion': self.fecha_creacion,
            'fecha_actualizacion': self.fecha_actualizacion,
            'archivos': self.obtener_archivos(),
            'completo': self.esta_completo()
        }

    def __repr__(self):
        return f"<Formulario {self.id}: Cliente {self.cliente_id} - {self.porcentaje_completado}%>"
