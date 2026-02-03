import os
from pathlib import Path


class Config:
    BASE_DIR = Path(__file__).parent
    SECRET_KEY = os.environ.get('SECRET_KEY', 'dev-key-123')

    # Base de Datos
    MYSQL_HOST = os.environ.get('MYSQL_HOST', '127.0.0.1')
    MYSQL_USER = os.environ.get('MYSQL_USER', 'root')
    MYSQL_PASSWORD = os.environ.get('MYSQL_PASSWORD', 'root')
    MYSQL_DB = os.environ.get('MYSQL_DB', 'formulario_clientes')

    # Nextcloud
    NEXTCLOUD_URL = os.environ.get('NEXTCLOUD_URL')
    NEXTCLOUD_USER = os.environ.get('NEXTCLOUD_USER')
    NEXTCLOUD_PASSWORD = os.environ.get('NEXTCLOUD_PASSWORD')
    NEXTCLOUD_PUBLIC_BASE = os.environ.get('NEXTCLOUD_PUBLIC_BASE')




class DevelopmentConfig(Config):
    DEBUG = True


class ProductionConfig(Config):
    DEBUG = False


config_dict = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'default': DevelopmentConfig
}