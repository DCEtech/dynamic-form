"""
Modelo Cliente para el formulario dinámico
"""

from typing import Optional, Dict, List
from database.init_db import get_connection


class Cliente:
    """Modelo para gestionar clientes"""

    def __init__(self, id=None, nombre_cliente=None, slug=None,
                 fecha_creacion=None, activo=True, completado=False):
        self.id = id
        self.nombre_cliente = nombre_cliente
        self.slug = slug
        self.fecha_creacion = fecha_creacion
        self.activo = activo
        self.completado = completado

    @classmethod
    def crear(cls, nombre_cliente: str, slug: str = None) -> Optional['Cliente']:
        """
        Crea un nuevo cliente en la base de datos
        
        Args:
            nombre_cliente (str): Nombre del cliente
            slug (str): Slug URL-friendly (opcional)
            
        Returns:
            Cliente: Instancia del cliente creado o None si hay error
        """
        if not slug:
            # Generar slug automáticamente
            import re
            slug = re.sub(r'[^a-zA-Z0-9\s-]', '', nombre_cliente.lower())
            slug = re.sub(r'\s+', '-', slug.strip())

        conn = get_connection()
        cursor = conn.cursor(dictionary=True)

        try:
            cursor.execute(
                "INSERT INTO clientes (nombre_cliente, slug) VALUES (%s, %s)",
                (nombre_cliente, slug)
            )

            cliente_id = cursor.lastrowid
            conn.commit()

            # Retornar instancia del cliente creado
            return cls.obtener_por_id(cliente_id)

        except Exception as e:
            print("Error creando cliente:", e)
            return None
        finally:
            conn.close()

    @classmethod
    def obtener_por_id(cls, cliente_id: int) -> Optional['Cliente']:
        """Obtiene un cliente por su ID"""
        conn = get_connection()
        cursor = conn.cursor(dictionary=True)

        cursor.execute("SELECT * FROM clientes WHERE id = %s", (cliente_id,))

        row = cursor.fetchone()
        conn.close()

        if row:
            return cls(
                id=row['id'],
                nombre_cliente=row['nombre_cliente'],
                slug=row['slug'],
                fecha_creacion=row['fecha_creacion'],
                activo=bool(row['activo']),
                completado=bool(row['completado'])
            )
        return None

    @classmethod
    def obtener_por_slug(cls, slug: str) -> Optional['Cliente']:
        """Obtiene un cliente por su slug"""
        conn = get_connection()
        cursor = conn.cursor(dictionary=True)

        cursor.execute(
            "SELECT * FROM clientes WHERE slug = %s AND activo = 1", (slug,)
        )

        row = cursor.fetchone()
        conn.close()

        if row:
            return cls(
                id=row['id'],
                nombre_cliente=row['nombre_cliente'],
                slug=row['slug'],
                fecha_creacion=row['fecha_creacion'],
                activo=bool(row['activo']),
                completado=bool(row['completado'])
            )
        return None

    @classmethod
    def listar_todos(cls, solo_activos: bool = True) -> List['Cliente']:
        """Lista todos los clientes"""
        conn = get_connection()
        cursor = conn.cursor(dictionary=True)

        query = "SELECT * FROM clientes"
        if solo_activos:
            query += " WHERE activo = 1"
        query += " ORDER BY nombre_cliente"

        cursor.execute(query)
        rows = cursor.fetchall()
        conn.close()

        return [
            cls(
                id=row['id'],
                nombre_cliente=row['nombre_cliente'],
                slug=row['slug'],
                fecha_creacion=row['fecha_creacion'],
                activo=bool(row['activo']),
                completado=bool(row['completado'])
            )
            for row in rows
        ]

    def actualizar(self) -> bool:
        """Actualiza los datos del cliente en la base de datos"""
        conn = get_connection()
        cursor = conn.cursor(dictionary=True)

        try:
            cursor.execute(
                """UPDATE clientes
                   SET nombre_cliente = %s,
                       slug           = %s,
                       activo         = %s,
                       completado     = %s
                   WHERE id = %s""",
                (self.nombre_cliente, self.slug, self.activo, self.completado, self.id)
            )
            conn.commit()
            return True
        except Exception as e:
            print("Error actualizando datos del cliente:", e)
            return False
        finally:
            conn.close()

    def eliminar(self) -> bool:
        """Elimina el cliente (soft delete - marca como inactivo)"""
        self.activo = False
        return self.actualizar()

    def obtener_formulario(self) -> Optional['Formulario']:
        """Obtiene el formulario asociado al cliente"""
        from models.formulario import Formulario
        return Formulario.obtener_por_cliente(self.id)

    def crear_formulario(self) -> 'Formulario':
        """Crea un nuevo formulario para el cliente"""
        from models.formulario import Formulario
        return Formulario.crear(self.id)

    def calcular_progreso(self) -> Dict:
        """Calcula el progreso del formulario del cliente"""
        formulario = self.obtener_formulario()
        if not formulario:
            return {
                'paso_actual': 1,
                'porcentaje': 0,
                'pasos_completados': 0,
                'total_pasos': 6
            }

        return {
            'paso_actual': formulario.paso_actual,
            'porcentaje': formulario.porcentaje_completado,
            'pasos_completados': formulario.paso_actual - 1,
            'total_pasos': 6
        }

    def to_dict(self) -> Dict:
        """Convierte el cliente a diccionario"""
        return {
            'id': self.id,
            'nombre_cliente': self.nombre_cliente,
            'slug': self.slug,
            'fecha_creacion': self.fecha_creacion,
            'activo': self.activo,
            'completado': self.completado,
            'progreso': self.calcular_progreso()
        }

    def __repr__(self):
        return f"<Cliente {self.id}: {self.nombre_cliente} ({self.slug})>"
