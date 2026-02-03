import os
import mysql.connector
from mysql.connector import Error


def get_connection():
    """
    Obtiene una conexión a la base de datos MySQL 
    leyendo la configuración del entorno.
    """
    try:
        # Leemos de las variables de entorno. 
        # Si no existen, usamos los valores de desarrollo por defecto.
        connection = mysql.connector.connect(
            host=os.environ.get('MYSQL_HOST', '127.0.0.1'),
            user=os.environ.get('MYSQL_USER', 'root'),
            password=os.environ.get('MYSQL_PASSWORD', 'root'),
            database=os.environ.get('MYSQL_DB', 'formulario_clientes'),
            autocommit=False
        )
        return connection

    except Error as e:
        print(f"Error al conectar a MySQL: {e}")
        return None
