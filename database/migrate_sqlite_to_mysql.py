import sqlite3
import mysql.connector

SQLITE_DB = "database/formulario_clientes.db"

MYSQL_CONFIG = {
    "host": "127.0.0.1",
    "user": "root",
    "password": "root",
    "database": "formulario_clientes",
    "port": 3306,
}


def migrate_table(sqlite_conn, mysql_conn, table, sqlite_columns, mysql_columns):
    sqlite_cur = sqlite_conn.cursor()
    mysql_cur = mysql_conn.cursor()

    cols_sqlite = ", ".join(sqlite_columns)
    cols_mysql = ", ".join(mysql_columns)
    placeholders = ", ".join(["%s"] * len(mysql_columns))

    sqlite_cur.execute(f"SELECT {cols_sqlite} FROM {table}")
    rows = sqlite_cur.fetchall()

    for row in rows:
        values = [row[c] for c in sqlite_columns]
        mysql_cur.execute(
            f"INSERT INTO {table} ({cols_mysql}) VALUES ({placeholders})",
            values
        )

    mysql_conn.commit()
    print(f"✔ Migrada tabla {table}")


def main():
    sqlite_conn = sqlite3.connect(SQLITE_DB)
    sqlite_conn.row_factory = sqlite3.Row

    mysql_conn = mysql.connector.connect(**MYSQL_CONFIG)
    mysql_cur = mysql_conn.cursor()

    # 🔓 Desactivar FK checks SOLO durante la migración
    mysql_cur.execute("SET FOREIGN_KEY_CHECKS = 0;")
    mysql_conn.commit()

    # ORDEN IMPORTANTE POR FOREIGN KEYS
    migrate_table(
        sqlite_conn,
        mysql_conn,
        "clientes",
        ["id", "nombre_cliente", "slug", "fecha_creacion", "activo", "completado"],
        ["id", "nombre_cliente", "slug", "fecha_creacion", "activo", "completado"]
    )

    migrate_table(
        sqlite_conn,
        mysql_conn,
        "formularios_clientes",
        [
            "id", "cliente_id", "datos_empresa", "info_trasteros",
            "usuarios_app", "config_correo", "niveles_acceso",
            "documentacion", "paso_actual", "porcentaje_completado",
            "fecha_creacion", "fecha_actualizacion"
        ],
        [
            "id", "cliente_id", "datos_empresa", "info_trasteros",
            "usuarios_app", "config_correo", "niveles_acceso",
            "documentacion", "paso_actual", "porcentaje_completado",
            "fecha_creacion", "fecha_actualizacion"
        ]
    )

    migrate_table(
        sqlite_conn,
        mysql_conn,
        "archivos_clientes",
        [
            "id", "formulario_id", "nombre_original", "nombre_archivo",
            "tipo_archivo", "tamaño_bytes", "ruta_archivo",
            "paso_formulario", "fecha_subida"
        ],
        [
            "id", "formulario_id", "nombre_original", "nombre_archivo",
            "tipo_archivo", "tamano_bytes", "ruta_archivo",
            "paso_formulario", "fecha_subida"
        ]
    )

    migrate_table(
        sqlite_conn,
        mysql_conn,
        "logs_formulario",
        [
            "id", "cliente_id", "formulario_id", "accion",
            "paso", "detalles", "ip_address",
            "user_agent", "fecha"
        ],
        [
            "id", "cliente_id", "formulario_id", "accion",
            "paso", "detalles", "ip_address",
            "user_agent", "fecha"
        ]
    )

    # 🔒 Reactivar FK checks
    mysql_cur.execute("SET FOREIGN_KEY_CHECKS = 1;")
    mysql_conn.commit()

    sqlite_conn.close()
    mysql_conn.close()


if __name__ == "__main__":
    main()
