#!/usr/bin/env bash
# Ensayo de restauración de una copia REAL del respaldo nocturno de la nube en Supabase LOCAL
# (E9, S5-06, RNF-21; docs/operacion/RESTAURACION.md §3 paso 4 y §4).
#
#   scripts/ensayo-restauracion-nube.sh <carpeta>
#
# <carpeta> trae los artefactos bajados de Actions → Respaldo nocturno: respaldo-zammir-AAAA-MM-DD.tar.enc y,
# si existe, fotos-zammir-AAAA-MM-DD.tar.enc (se usa el más reciente de cada uno). Por ejemplo:
#   gh run download <id de la corrida> -n respaldo-zammir-AAAA-MM-DD -n fotos-zammir-AAAA-MM-DD -D <carpeta>
#
# Pide la CLAVE_DE_RESPALDO sin mostrarla. Abre las copias en una carpeta temporal FUERA del repositorio y la borra
# al terminar. Solo imprime conteos, nunca datos. BORRA la base de Supabase LOCAL y la recrea desde las migraciones;
# nunca toca la nube.
set -euo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
COPIAS="${1:-}"
if [[ -z "$COPIAS" || ! -d "$COPIAS" ]]; then
  echo 'Uso: scripts/ensayo-restauracion-nube.sh <carpeta con las copias cifradas>' >&2
  exit 2
fi
COPIA_BASE="$(find "$COPIAS" -maxdepth 1 -name 'respaldo-zammir-*.tar.enc' | sort | tail -n 1)"
COPIA_FOTOS="$(find "$COPIAS" -maxdepth 1 -name 'fotos-zammir-*.tar.enc' | sort | tail -n 1)"
if [[ -z "$COPIA_BASE" ]]; then
  echo "No hay respaldo-zammir-*.tar.enc en $COPIAS" >&2
  exit 2
fi

CONTENEDOR='supabase_db_zammir'
SUPABASE="$REPO/node_modules/.bin/supabase"
TRABAJO="$(mktemp -d)"
TRABAJO_W="$(cd "$TRABAJO" && (pwd -W 2> /dev/null || pwd))" # Docker en Windows necesita la ruta de Windows
trap 'rm -rf "$TRABAJO"' EXIT

dk() { MSYS_NO_PATHCONV=1 docker "$@"; }
seg() { date +%s; }
paso() { printf '\n▶ %s\n' "$1"; }
abrir() { openssl enc -d -aes-256-cbc -pbkdf2 -iter 600000 -pass env:CLAVE_DE_RESPALDO -in "$1"; }

dk inspect "$CONTENEDOR" > /dev/null 2>&1 || {
  echo "No encuentro el contenedor $CONTENEDOR: arranca Supabase local (pnpm db:start)."
  exit 1
}

echo "Copia de la base: $(basename "$COPIA_BASE")"
echo "Copia de las fotos: $(basename "${COPIA_FOTOS:-ninguna}")"
echo 'Este ensayo BORRA la base LOCAL de Supabase (zammir) y la recrea con la copia de la nube.'
read -r -p 'Escribe SI para continuar: ' confirma
[[ "$confirma" == 'SI' ]] || {
  echo 'Cancelado.'
  exit 1
}

# La clave se lee tal cual. Si no abre, se prueba sin retorno de carro y sin espacios en las orillas,
# por si el pegado los agregó.
IFS= read -r -s -p 'Pega la CLAVE_DE_RESPALDO (no se verá) y presiona Enter: ' tal_cual
echo
[[ -n "$tal_cual" ]] || {
  echo 'La clave está vacía.'
  exit 1
}
echo "  Recibí una clave de ${#tal_cual} caracteres."
sin_cr="${tal_cual//$'\r'/}"
recortada="$(printf '%s' "$sin_cr" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')"
export CLAVE_DE_RESPALDO=''
for candidata in "$tal_cual" "$sin_cr" "$recortada"; do
  if CLAVE_DE_RESPALDO="$candidata" abrir "$COPIA_BASE" 2> /dev/null | tar -t > /dev/null 2>&1; then
    CLAVE_DE_RESPALDO="$candidata"
    break
  fi
done
unset tal_cual sin_cr recortada candidata
if [[ -z "$CLAVE_DE_RESPALDO" ]]; then
  echo '  ✖ Esa clave no abre la copia: no es la misma con la que se cifró (entorno "respaldo" de GitHub).'
  exit 1
fi
echo "  La clave abre la copia (${#CLAVE_DE_RESPALDO} caracteres)."

inicio_total=$(seg)
mkdir -p "$TRABAJO/base" "$TRABAJO/fotos"

paso '1. Abriendo las copias cifradas'
t=$(seg)
abrir "$COPIA_BASE" | tar -C "$TRABAJO/base" -x
if [[ -n "$COPIA_FOTOS" ]]; then
  abrir "$COPIA_FOTOS" | tar -C "$TRABAJO/fotos" -x
fi
unset CLAVE_DE_RESPALDO
echo "  Fotos en la copia: $(find "$TRABAJO/fotos" -type f -name '*.jpg' | wc -l | tr -d ' ')"
echo "  Listo en $(($(seg) - t)) s"

paso '2. Contando los renglones que trae la copia'
dk cp "$TRABAJO_W/base/public.dump" "$CONTENEDOR:/tmp/public.dump" > /dev/null
dk cp "$TRABAJO_W/base/auth.dump" "$CONTENEDOR:/tmp/auth.dump" > /dev/null
contar_copia() {
  dk exec "$CONTENEDOR" pg_restore --data-only -f - "$1" | awk '
    /^COPY / { tabla = $2; n = 0; dentro = 1; next }
    dentro && /^\\\.$/ { print tabla "|" n; dentro = 0; next }
    dentro { n++ }'
}
{
  contar_copia /tmp/public.dump
  contar_copia /tmp/auth.dump
} | sort > "$TRABAJO/esperado.txt"
echo "  Tablas en la copia: $(wc -l < "$TRABAJO/esperado.txt" | tr -d ' ')"

paso '3. Recreando la base local desde cero con las migraciones'
t=$(seg)
if ! (cd "$REPO" && "$SUPABASE" db reset) > "$TRABAJO/reset.log" 2>&1 < /dev/null; then
  echo '  ✖ Falló el reinicio de la base local:'
  tail -5 "$TRABAJO/reset.log"
  exit 1
fi
echo "  Listo en $(($(seg) - t)) s"

paso '4. Restaurando datos y cuentas'
t=$(seg)
dk cp "$TRABAJO_W/base/public.dump" "$CONTENEDOR:/tmp/public.dump" > /dev/null
dk cp "$TRABAJO_W/base/auth.dump" "$CONTENEDOR:/tmp/auth.dump" > /dev/null
# Los datos de arranque de las migraciones también vienen en la copia: se vacían para no duplicarlos
# (en modo de réplica, porque los documentos legales no se pueden borrar a propósito [RN-18]).
dk exec "$CONTENEDOR" psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 -q -c \
  'set session_replication_role = replica; truncate public.business_settings, public.product_categories, public.legal_documents restart identity cascade' 2> /dev/null
dk exec "$CONTENEDOR" pg_restore -U supabase_admin -d postgres --data-only --disable-triggers --no-owner --exit-on-error /tmp/auth.dump
dk exec "$CONTENEDOR" pg_restore -U supabase_admin -d postgres --data-only --disable-triggers --no-owner --exit-on-error /tmp/public.dump
echo "  Listo en $(($(seg) - t)) s"

paso '5. Restaurando las fotos de medición'
t=$(seg)
eval "$(cd "$REPO" && "$SUPABASE" status -o env 2> /dev/null | grep '^S3_PROTOCOL')"
export SUPABASE_S3_ENDPOINT='http://host.docker.internal:55321/storage/v1/s3'
export SUPABASE_S3_REGION="$S3_PROTOCOL_REGION"
export SUPABASE_S3_ACCESS_KEY_ID="$S3_PROTOCOL_ACCESS_KEY_ID"
export SUPABASE_S3_SECRET_ACCESS_KEY="$S3_PROTOCOL_ACCESS_KEY_SECRET"
(cd "$REPO" && bash scripts/fotos-de-medicion.sh restaurar "$TRABAJO/fotos") | sed 's/^/  /'
fotos_bd=$(dk exec "$CONTENEDOR" psql -U postgres -d postgres -At -c \
  "select count(*) from storage.objects where bucket_id = 'order-photos'")
echo "  Fotos registradas en la base local: $fotos_bd"
echo "  Listo en $(($(seg) - t)) s"

paso '6. Verificando: cada tabla debe tener los mismos renglones que la copia'
fallas=0
while IFS='|' read -r tabla esperado; do
  real=$(dk exec "$CONTENEDOR" psql -U postgres -d postgres -At -c "select count(*) from $tabla")
  if [[ "$real" == "$esperado" ]]; then
    printf '  ✔ %-40s %s\n' "$tabla" "$real"
  else
    printf '  ✖ %-40s copia %s, restaurada %s\n' "$tabla" "$esperado" "$real"
    fallas=$((fallas + 1))
  fi
done < "$TRABAJO/esperado.txt"
admins=$(dk exec "$CONTENEDOR" psql -U postgres -d postgres -At -c \
  "select count(*) from auth.users where raw_app_meta_data->>'rol' = 'ADMIN'")
echo "  Cuentas de administrador restauradas: $admins"

echo
if [[ $fallas -eq 0 ]]; then
  echo "RESULTADO: APROBADO. Todas las tablas coinciden con la copia. Tiempo total: $(($(seg) - inicio_total)) s."
else
  echo "RESULTADO: NO APROBADO. $fallas tabla(s) no coinciden. Tiempo total: $(($(seg) - inicio_total)) s."
  exit 1
fi
