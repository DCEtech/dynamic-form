#!/usr/bin/env python3
"""
Inicialización de la base de datos SQLite para el formulario de clientes
"""

import mysql.connector
from mysql.connector import Error
import os
from pathlib import Path


def init_database(db_path='database/formulario_clientes.db'):
    """
    Inicializa la base de datos SQLite con el esquema definido
    
    Args:
        db_path (str): Ruta al archivo de base de datos
    """
    # Crear directorio si no existe
    db_dir = os.path.dirname(db_path)
    if db_dir and not os.path.exists(db_dir):
        os.makedirs(db_dir)

    # Leer el esquema SQL
    schema_path = Path(__file__).parent / 'schema.sql'

    try:
        with open(schema_path, 'r', encoding='utf-8') as f:
            schema_sql = f.read()

        # Conectar a la base de datos
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor(dictionary=True)

        # Ejecutar el esquema
        cursor.executescript(schema_sql)

        # Confirmar cambios
        conn.commit()

        print(f"✅ Base de datos inicializada correctamente en: {db_path}")

        # Verificar tablas creadas
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
        tables = cursor.fetchall()

        print("📋 Tablas creadas:")
        for table in tables:
            print(f"   - {table[0]}")

        # Verificar datos de ejemplo
        cursor.execute("SELECT COUNT(*) FROM clientes;")
        count = cursor.fetchone()[0]
        print(f"👥 Clientes de ejemplo: {count}")

        conn.close()

    except FileNotFoundError:
        print(f"❌ Error: No se encontró el archivo schema.sql en {schema_path}")
    except sqlite3.Error as e:
        print(f"❌ Error de SQLite: {e}")
    except Exception as e:
        print(f"❌ Error inesperado: {e}")


def get_connection():
    return mysql.connector.connect(
        host="127.0.0.1",
        user="root",
        password="root",
        database="formulario_clientes",
        autocommit=False
    )


def create_client(nombre_cliente, slug=None):
    """
    Crea un nuevo cliente en la base de datos
    
    Args:
        nombre_cliente (str): Nombre del cliente
        slug (str): Slug URL-friendly (opcional, se genera automáticamente)
        
    Returns:
        int: ID del cliente creado
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
            "INSERT INTO clientes (nombre_cliente, slug) VALUES (?, ?)",
            (nombre_cliente, slug)
        )
        cliente_id = cursor.lastrowid
        conn.commit()

        print(f"✅ Cliente creado: {nombre_cliente} (ID: {cliente_id}, Slug: {slug})")
        return cliente_id

    except sqlite3.IntegrityError:
        print(f"❌ Error: Ya existe un cliente con el nombre '{nombre_cliente}' o slug '{slug}'")
        return None
    finally:
        conn.close()


if __name__ == "__main__":
    # Inicializar base de datos
    init_database()

    # Ejemplo de uso
    print("\n🔧 Funciones disponibles:")
    print("- init_database(): Inicializar/recrear la base de datos")
    print("- get_connection(): Obtener conexión a la BD")
    print("- create_client(nombre, slug): Crear nuevo cliente")
