#!/usr/bin/env python3
"""
Módulo de conexión a la base de datos MySQL y creación de clientes
"""

import mysql.connector
from mysql.connector import Error


def get_connection():
    """Obtiene una conexión a la base de datos MySQL"""
    return mysql.connector.connect(
        host="127.0.0.1",
        user="root",
        password="root",
        database="formulario_clientes",
        autocommit=False
    )


def create_client(nombre_cliente: str, slug: str = None):
    """Crea un nuevo cliente en la base de datos"""
    if not slug:
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
        print(f"Cliente creado: {nombre_cliente} (ID: {cliente_id}, Slug: {slug})")
        return cliente_id

    except Error as e:
        print(f"Error al crear cliente: {e}")
        return None
    finally:
        conn.close()


if __name__ == "__main__":
    print("Funciones disponibles:")
    print("- get_connection(): Obtener conexión a la BD")
    print("- create_client(nombre, slug): Crear nuevo cliente")
