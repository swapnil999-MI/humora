locals {
  db_host        = getenv("DB_HOST")
  db_port        = getenv("DB_PORT")
  db_user        = getenv("DB_USER")
  db_password    = getenv("DB_PASSWORD")
  db_name        = getenv("DB_NAME")
  db_dev_name    = getenv("DB_DEV_NAME")
  db_sslmode     = getenv("DB_SSLMODE")
  staging_db_url = getenv("STAGING_DB_URL")

  db_url  = "postgres://${local.db_user}:${local.db_password}@${local.db_host}:${local.db_port}/${local.db_name}?sslmode=${local.db_sslmode}"
  dev_url = "postgres://${local.db_user}:${local.db_password}@${local.db_host}:${local.db_port}/${local.db_dev_name}?sslmode=${local.db_sslmode}"
}

env "local" {
  src = "file://schema"
  migration {
    dir = "file://migrations"
  }
  url = local.db_url
  dev = local.dev_url
  format {
    migrate {
      diff = "{{ sql . \"  \" }}"
    }
  }
}

env "staging" {
  migration {
    dir = "file://migrations"
  }
  url = local.staging_db_url
}
