#!/bin/sh

printf "\n============================================\n"
printf "          Starting Humora Backend           \n"
printf "============================================\n\n"

exec air -c /app/infra/local/air.toml
