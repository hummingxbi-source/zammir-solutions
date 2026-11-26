#!/usr/bin/env bash
# Copia o restaura las fotos de medición (depósito `order-photos`) por el protocolo S3 de Supabase
# [PD-57, ADR-0046]. Lo usa el flujo "Respaldo nocturno" y la restauración (docs/operacion/RESTAURACION.md).
#
#   scripts/fotos-de-medicion.sh copiar    <carpeta>   # del proyecto a la carpeta
#   scripts/fotos-de-medicion.sh restaurar <carpeta>   # de la carpeta al proyecto (no borra nada)
#
# Variables (del proyecto: Supabase > Storage > S3 Configuration). Nunca se escriben en el repositorio:
#   SUPABASE_S3_ENDPOINT            p. ej. https://<ref>.storage.supabase.co/storage/v1/s3
#   SUPABASE_S3_REGION              la región que muestra el panel
#   SUPABASE_S3_ACCESS_KEY_ID       llave de acceso S3 del proyecto
#   SUPABASE_S3_SECRET_ACCESS_KEY   su secreto
#
# Usa la imagen oficial de la CLI de AWS en Docker, igual que el respaldo usa `postgres:17`: no instala nada.
# Las fotos no se cambian ni se borran [RN-18], así que la copia más reciente trae todas y `sync` solo
# agrega lo que falta; nunca se usa `--delete`.
set -euo pipefail

DEPOSITO='order-photos'
IMAGEN='amazon/aws-cli:2.42.4'

accion="${1:-}"
carpeta="${2:-}"
if [[ "$accion" != 'copiar' && "$accion" != 'restaurar' ]] || [[ -z "$carpeta" ]]; then
  echo 'Uso: scripts/fotos-de-medicion.sh copiar|restaurar <carpeta>' >&2
  exit 2
fi
for variable in SUPABASE_S3_ENDPOINT SUPABASE_S3_REGION SUPABASE_S3_ACCESS_KEY_ID SUPABASE_S3_SECRET_ACCESS_KEY; do
  if [[ -z "${!variable:-}" ]]; then
    echo "Falta la variable $variable." >&2
    exit 2
  fi
done

mkdir -p "$carpeta"
# En Windows (Git Bash), Docker necesita la ruta de Windows; en Linux, la normal.
ruta_local="$(cd "$carpeta" && (pwd -W 2>/dev/null || pwd))"

aws_s3() {
  MSYS_NO_PATHCONV=1 docker run --rm \
    -e AWS_ACCESS_KEY_ID="$SUPABASE_S3_ACCESS_KEY_ID" \
    -e AWS_SECRET_ACCESS_KEY="$SUPABASE_S3_SECRET_ACCESS_KEY" \
    -e AWS_DEFAULT_REGION="$SUPABASE_S3_REGION" \
    -e AWS_REQUEST_CHECKSUM_CALCULATION=when_required \
    -e AWS_RESPONSE_CHECKSUM_VALIDATION=when_required \
    -v "$ruta_local:/fotos" \
    "$IMAGEN" s3 "$@" --endpoint-url "$SUPABASE_S3_ENDPOINT" --only-show-errors
}

if [[ "$accion" == 'copiar' ]]; then
  aws_s3 sync "s3://$DEPOSITO" /fotos
else
  aws_s3 sync /fotos "s3://$DEPOSITO"
fi

total=$(find "$carpeta" -type f -name '*.jpg' | wc -l | tr -d ' ')
echo "Fotos en la carpeta: $total"
