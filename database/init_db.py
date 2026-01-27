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


if __name__ == "__main__":
    print("Funciones disponibles:")
    print("- get_connection(): Obtener conexión a la BD")
