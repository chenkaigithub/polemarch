"""
Django settings for polemarch project.

Generated by 'django-admin startproject' using Django 1.10.

For more information on this file, see
https://docs.djangoproject.com/en/1.10/topics/settings/

For the full list of settings and their values, see
https://docs.djangoproject.com/en/1.10/ref/settings/
"""

import os
import sys

from configparser import ConfigParser, NoSectionError

from . import __file__ as file

APACHE = False if ("runserver" in sys.argv) else True

# Build paths inside the project like this: os.path.join(BASE_DIR, ...)
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(file)))
PY_VER = sys.version_info[0]
TMP_DIR = "/tmp"
__kwargs = dict(HOME=BASE_DIR, PY=PY_VER, TMP=TMP_DIR)

# Hack for keep user settings in /etc/polemarch/settings.ini
# or in file thats setups in env IHS_SETTINGS_FILE
CONFIG_FILE = os.getenv("POLEMARCH_SETTINGS_FILE", "/etc/polemarch/settings.ini")
config = ConfigParser()
config.read([CONFIG_FILE, os.path.join(BASE_DIR, 'main/settings.ini')])

# Quick-start development settings - unsuitable for production
# See https://docs.djangoproject.com/en/1.10/howto/deployment/checklist/

# SECURITY WARNING: keep the secret key used in production secret!
# To set key create file named `secret` near setting.ini file
# or set in POLEMARCH_SECRET_FILE env.
SECRET_FILE = os.getenv("POLEMARCH_SECRET_FILE", "/etc/polemarch/secret")
SECRET_KEY = '*sg17)9wa_e+4$n%7n7r_(kqwlsc^^xdoc3&px$hs)sbz(-ml1'
try:
    with open(SECRET_FILE, "r") as secret_file:
        SECRET_KEY = secret_file.read().strip()  # nocv
except IOError:
    pass

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = config.getboolean("main", "debug", fallback=False)

# Directory for git projects
PROJECTS_DIR = config.get("main", "projects_dir", fallback="{HOME}/projects").format(**__kwargs)
os.makedirs(PROJECTS_DIR) if not os.path.exists(PROJECTS_DIR) else None

ALLOWED_HOSTS = [item for item in config.get("web",
                                             "allowed_hosts",
                                             fallback="*").split(",") if item != ""]
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTOCOL', 'https')


# Application definition
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'django_celery_beat',
    'crispy_forms',
    'rest_framework',
    'rest_framework.authtoken',
    'django_filters',
    'docs',
    'polemarch.main',
    'polemarch.api',
]

try:
    import mod_wsgi
except ImportError:  # pragma: no cover
    pass
else:
    INSTALLED_APPS += ['mod_wsgi.server',]  # pragma: no cover

ADDONS = []

INSTALLED_APPS += ADDONS

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]
# Fix for django 1.8-9
MIDDLEWARE_CLASSES = MIDDLEWARE

ROOT_URLCONF = 'polemarch.main.urls'
TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [os.path.join(BASE_DIR, 'api/templates'),
                 os.path.join(BASE_DIR, 'main/templates')],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
                'polemarch.main.context_processors.settings_constants',
                'polemarch.main.context_processors.project_args',
            ],
        },
    },
]

WSGI = 'polemarch.main.wsgi'
WSGI_APPLICATION = "{}.application".format(WSGI)

try:
    __DB_SETTINGS = {k.upper():v.format(**__kwargs) for k,v in config.items('database')}
    if not __DB_SETTINGS: raise NoSectionError('database')
except NoSectionError:  # nocv
    __DB_SETTINGS = {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': os.path.join(BASE_DIR, 'db.polemarch.sqlite3'),
    }

__DB_OPTIONS = { }
try:
    int_values_types = ["timeout", "connect_timeout", "read_timeout", "write_timeout"]
    for k, v in config.items('database.options'):
        if k in int_values_types:
            __DB_OPTIONS[k] = int(float(v))
            continue
        __DB_OPTIONS[k] = v.format(**__kwargs)  # nocv
    if not __DB_OPTIONS: raise NoSectionError('database.options')
except NoSectionError:  # nocv
    __DB_OPTIONS = {}

if __DB_SETTINGS['ENGINE'] == 'django.db.backends.mysql':  # nocv
    import pymysql
    pymysql.install_as_MySQLdb()

if __DB_SETTINGS['ENGINE'] == 'django.db.polemarch.sqlite3':
    __DB_OPTIONS["timeout"] = __DB_OPTIONS.get("timeout", 10)  # nocv

__DB_SETTINGS["OPTIONS"] = __DB_OPTIONS

DATABASES = {
    'default': __DB_SETTINGS
}


# Password validation
# https://docs.djangoproject.com/en/1.10/ref/settings/#auth-password-validators

AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
        'OPTIONS': {
            'min_length': 0,
        },
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]
LOGIN_URL = '/login/'
LOGOUT_URL = '/logout/'
LOGIN_REDIRECT_URL = '/'

PAGE_LIMIT = config.getint("web", "page_limit", fallback=1000)

# Rest Api settings
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework.authentication.SessionAuthentication',
        'rest_framework.authentication.BasicAuthentication',
        'rest_framework.authentication.TokenAuthentication',
    ),
    'DEFAULT_RENDERER_CLASSES': (
        'rest_framework.renderers.JSONRenderer',
        'rest_framework.renderers.BrowsableAPIRenderer',
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        "polemarch.api.permissions.ModelPermission",
    ),
    'EXCEPTION_HANDLER': 'polemarch.api.handlers.polemarch_exception_handler',
    'DEFAULT_FILTER_BACKENDS': ('rest_framework.filters.DjangoFilterBackend',),
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.LimitOffsetPagination',
    'PAGE_SIZE': config.getint("web", "rest_page_limit", fallback=PAGE_LIMIT),
}

# Internationalization
# https://docs.djangoproject.com/en/1.10/topics/i18n/

LANGUAGE_CODE = 'en'

LANGUAGES = (
  ('ru', 'Russian'),
  ('en', 'English'),
)

TIME_ZONE = config.get("main", "timezone", fallback="UTC")

USE_I18N = True

USE_L10N = True

USE_TZ = True


# Static files (CSS, JavaScript, Images)
# https://docs.djangoproject.com/en/1.10/howto/static-files/

STATIC_URL = config.get("web", "static_files_url", fallback="/static/")
STATICFILES_DIRS = [
    os.path.join(BASE_DIR, 'static')
]

STATICFILES_FINDERS = (
  'django.contrib.staticfiles.finders.FileSystemFinder',
  'django.contrib.staticfiles.finders.AppDirectoriesFinder',
)
if APACHE:
    STATIC_ROOT = os.path.join(BASE_DIR, 'static')

# Documentation files
# http://django-docs.readthedocs.io/en/latest/#docs-access-optional
DOCS_ROOT = os.path.join(BASE_DIR, 'doc/html')
DOCS_ACCESS = 'public'
DOC_URL = "/docs/"

# Celery settings
__broker_url = config.get("rpc", "connection", fallback="filesystem:///var/tmp").format(**__kwargs)
if __broker_url.startswith("filesystem://"):
    __broker_folder = __broker_url.split("://", 1)[1]
    CELERY_BROKER_URL = "filesystem://"
    CELERY_BROKER_TRANSPORT_OPTIONS = {
        "data_folder_in": __broker_folder,
        "data_folder_out": __broker_folder,
        "data_folder_processed": __broker_folder,
    }
else:
    CELERY_BROKER_URL = __broker_url  # nocv

CELERY_RESULT_BACKEND = config.get("rpc", "result_backend", fallback="file:///tmp").format(**__kwargs)
CELERY_WORKER_CONCURRENCY = config.getint("rpc", "concurrency", fallback=4)
CELERY_WORKER_HIJACK_ROOT_LOGGER = False
CELERY_BROKER_HEARTBEAT = config.getint("rpc", "heartbeat", fallback=10)
CELERY_BEAT_SCHEDULER = 'polemarch.main.celery_beat_scheduler:SingletonDatabaseScheduler'
CELERY_ACCEPT_CONTENT = ['pickle', 'json']
CELERY_TASK_SERIALIZER = 'pickle'
CELERY_RESULT_EXPIRES = config.getint("rpc", "results_expiry_days", fallback=10)

# Some hacks with logs

LOG_LEVEL = os.getenv('DJANGO_LOG_LEVEL',
                      config.get("main", "log_level",
                                 fallback="WARNING")).upper()
LOG_FORMAT = "[%(asctime)s] %(levelname)s [%(name)s.%(funcName)s:%(lineno)d] %(message)s"
LOG_DATE_FORMAT = "%d/%b/%Y %H:%M:%S"

LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'standard': {
            'format': LOG_FORMAT,
            'datefmt': LOG_DATE_FORMAT
        },
    },
    'handlers': {
        'console': {
            'level': 'DEBUG',
            'formatter': 'standard',
            'class': 'logging.StreamHandler',
        },
        'file': {
            'level': 'DEBUG',
            'class': 'logging.FileHandler',
            'filename': '/dev/null'
        },
    },
    'loggers': {
        'polemarch': {
            'handlers': ['console'],
            'level': LOG_LEVEL,
        },
    }
}
SILENCED_SYSTEM_CHECKS = ['fields.W342', 'urls.W001', '1_10.W001',
                          "fields.W340", "urls.W005"]

try:
    __CACHE_DEFAULT_SETTINGS = {k.upper():v.format(**__kwargs) for k, v in config.items('cache')}
    if not __CACHE_DEFAULT_SETTINGS: raise NoSectionError('cache')
except NoSectionError:
    __CACHE_DEFAULT_SETTINGS = {
        'BACKEND': 'django.core.cache.backends.filebased.FileBasedCache',
        'LOCATION': '/tmp/polemarch_django_cache' + str(sys.version_info[0]),
    }

try:
    __CACHE_LOCKS_SETTINGS = {k.upper():v.format(**__kwargs) for k, v in config.items('locks')}
    if not __CACHE_LOCKS_SETTINGS: raise NoSectionError('locks')
except NoSectionError:
    __CACHE_LOCKS_SETTINGS = {
        'BACKEND': 'django.core.cache.backends.filebased.FileBasedCache',
        'LOCATION': '/tmp/polemarch_django_locks' + str(sys.version_info[0]),
    }


CACHES = {
    'default': __CACHE_DEFAULT_SETTINGS,
    "locks": __CACHE_LOCKS_SETTINGS
}

CREATE_INSTANCE_ATTEMPTS = config.getint("rpc", "create_instance_attempts", fallback=10)
CONCURRENCY = config.getint("rpc", "concurrency", fallback=4)

REPO_BACKENDS = {
    "GIT": {
        "BACKEND": "polemarch.main.repo_backends.Git",
        "OPTIONS": {
            "CLONE_KWARGS": {
                "depth": 1
            },
            "FETCH_KWARGS": {
            },
            "GIT_ENV": {
                "GLOBAL": {
                    "GIT_SSL_NO_VERIFY": "true"
                }
            }
        }
    },
    "TAR": {
        "BACKEND": "polemarch.main.repo_backends.Tar",
    },
    "MANUAL": {
        "BACKEND": "polemarch.main.repo_backends.Manual",
    }
}


TASKS_HANDLERS = {
    "REPO": {
        "BACKEND": "polemarch.main.tasks.RepoTask"
    },
    "SCHEDUER": {
        "BACKEND": "polemarch.main.tasks.ScheduledTask"
    },
    "MODULE": {
        "BACKEND": "polemarch.main.tasks.ExecuteAnsibleModule"
    },
    "PLAYBOOK": {
        "BACKEND": "polemarch.main.tasks.ExecuteAnsiblePlaybook"
    },
}


if "test" in sys.argv:
    CELERY_TASK_ALWAYS_EAGER = True
    REPO_BACKENDS["TEST"] = {
        "BACKEND": "polemarch.main.tests.repo_backends.Test",
    }
