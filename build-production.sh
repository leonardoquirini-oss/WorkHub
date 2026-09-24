#!/bin/bash

# ===================================================================
# Script di Build e Push per Ambiente di Produzione
# ===================================================================
# Builda l'immagine Docker di WorkHub con le configurazioni corrette
# per l'ambiente di produzione e la pusha su un registry.
#
# Adattato da ../BERLink/build-production.sh: WorkHub e' un client
# separato di BERLink (single-service, nginx statico), quindi qui
# non c'e' split backend/frontend e VITE_API_URL resta di default
# "/api" (proxato da nginx verso BACKEND_URL, vedi nginx.conf) invece
# di essere ricostruito da URL pubblico + porta backend.
#
# Uso: ./build-production.sh <registry> <version> <VITE_url>
#
# Esempio:
#   ./build-production.sh -r docker.io/mycompany -v v1.0.0 -u https://portale.example.com
# ===================================================================

set -e  # Exit on error

# Colori per output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Funzione di log
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Funzione per mostrare l'help
show_help() {
    echo ""
    echo "Uso: $0 [OPZIONI]"
    echo ""
    echo "Opzioni:"
    echo "  -r, --registry REGISTRY       URL del Docker Registry (es: docker.io/mycompany)"
    echo "  -v, --version VERSION         Versione dell'immagine (es: v1.0.0, latest)"
    echo "  -u, --public-url URL          URL pubblico raggiungibile dal browser del tablet (es: https://portale.example.com)"
    echo "  -k, --keycloak-port PORT      Porta di Keycloak (default: 8080)"
    echo "  --realm REALM                 Realm Keycloak (default: gb-realm)"
    echo "  --client-id CLIENT_ID         Client ID Keycloak (default: berlink-client)"
    echo "  --api-url URL                 VITE_API_URL (default: /api, proxato da nginx verso BACKEND_URL)"
    echo "  --site-id ID                  Sito selezionato al primo accesso (default: 1)"
    echo "  --skip-push                   Non esegue il push dell'immagine"
    echo "  -h, --help                    Mostra questo help"
    echo ""
    echo "Esempio:"
    echo "  $0 -r docker.io/mycompany -v v1.0.0 -u https://portale.example.com"
    echo ""
}

# Default values
DOCKER_REGISTRY="docker.io/leonardoquirini"
VERSION="1.0.0"
VITE_URL="http://192.168.0.12"
KEYCLOAK_PORT="8080"
KEYCLOAK_REALM="gb-realm"
KEYCLOAK_CLIENT_ID="berlink-client"
VITE_API_URL="/api"
DEFAULT_SITE_ID="1"
SKIP_PUSH=false

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -r|--registry)
            DOCKER_REGISTRY="$2"
            shift 2
            ;;
        -v|--version)
            VERSION="$2"
            shift 2
            ;;
        -u|--public-url)
            VITE_URL="$2"
            shift 2
            ;;
        -k|--keycloak-port)
            KEYCLOAK_PORT="$2"
            shift 2
            ;;
        --realm)
            KEYCLOAK_REALM="$2"
            shift 2
            ;;
        --client-id)
            KEYCLOAK_CLIENT_ID="$2"
            shift 2
            ;;
        --api-url)
            VITE_API_URL="$2"
            shift 2
            ;;
        --site-id)
            DEFAULT_SITE_ID="$2"
            shift 2
            ;;
        --skip-push)
            SKIP_PUSH=true
            shift
            ;;
        -h|--help)
            show_help
            exit 0
            ;;
        *)
            log_error "Opzione sconosciuta: $1"
            show_help
            exit 1
            ;;
    esac
done

# Validazione parametri obbligatori
if [ -z "$DOCKER_REGISTRY" ]; then
    log_error "Registry non specificato. Usa -r o --registry"
    show_help
    exit 1
fi

if [ -z "$VERSION" ]; then
    log_error "Versione non specificata. Usa -v o --version"
    show_help
    exit 1
fi

if [ -z "$VITE_URL" ]; then
    log_error "URL pubblico non specificato. Usa -u o --public-url"
    show_help
    exit 1
fi

# Rimuovi trailing slash dall'URL
VITE_URL="${VITE_URL%/}"

# Keycloak: il browser del tablet deve raggiungerlo direttamente (non passa dal proxy nginx)
VITE_KEYCLOAK_URL="${VITE_URL}:${KEYCLOAK_PORT}"

# Nome dell'immagine
WORKHUB_IMAGE="${DOCKER_REGISTRY}/workhub:${VERSION}"

# Header
echo ""
echo "╔════════════════════════════════════════════════════════╗"
echo "║     WorkHub - Build Production Image                   ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""

# Mostra configurazione
log_info "Configurazione build:"
echo "  Registry:                 ${DOCKER_REGISTRY}"
echo "  Version:                  ${VERSION}"
echo "  Public URL   :            ${VITE_URL}"
echo "  Keycloak Port:            ${KEYCLOAK_PORT}"
echo "  Keycloak Realm:           ${KEYCLOAK_REALM}"
echo "  Keycloak Client ID:       ${KEYCLOAK_CLIENT_ID}"
echo "  Default Site ID:          ${DEFAULT_SITE_ID}"
echo ""
echo "  VITE_API_URL:             ${VITE_API_URL}"
echo "  VITE_KEYCLOAK_URL:        ${VITE_KEYCLOAK_URL}"
echo ""
echo "  WorkHub Image:            ${WORKHUB_IMAGE}"
echo ""

# Conferma
read -p "Vuoi procedere con il build? (y/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    log_warning "Build cancellato dall'utente"
    exit 0
fi

# Build
log_info "Building WorkHub image..."
log_info "  VITE_API_URL=${VITE_API_URL}"
log_info "  VITE_KEYCLOAK_URL=${VITE_KEYCLOAK_URL}"
log_info "  VITE_KEYCLOAK_REALM=${KEYCLOAK_REALM}"
log_info "  VITE_KEYCLOAK_CLIENT_ID=${KEYCLOAK_CLIENT_ID}"
log_info "  VITE_DEFAULT_SITE_ID=${DEFAULT_SITE_ID}"

docker build \
    -t "${WORKHUB_IMAGE}" \
    -f Dockerfile \
    --build-arg VITE_API_URL="${VITE_API_URL}" \
    --build-arg VITE_KEYCLOAK_URL="${VITE_KEYCLOAK_URL}" \
    --build-arg VITE_KEYCLOAK_REALM="${KEYCLOAK_REALM}" \
    --build-arg VITE_KEYCLOAK_CLIENT_ID="${KEYCLOAK_CLIENT_ID}" \
    --build-arg VITE_DEFAULT_SITE_ID="${DEFAULT_SITE_ID}" \
    .

log_success "Immagine buildata: ${WORKHUB_IMAGE}"

# Push dell'immagine
if [ "$SKIP_PUSH" = false ]; then
    echo ""
    log_info "Pushing image to registry..."
    docker push "${WORKHUB_IMAGE}"
    log_success "Image pushed: ${WORKHUB_IMAGE}"
else
    log_warning "Push skippato (--skip-push attivo)"
fi

# Summary
echo ""
echo "╔════════════════════════════════════════════════════════╗"
echo "║                   Build Completato                     ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""
log_success "Immagine creata con successo!"
echo ""
if [ "$SKIP_PUSH" = false ]; then
    log_info "Utilizza questa immagine sulla macchina target:"
    echo " WORKHUB: ${WORKHUB_IMAGE}"
else
    log_info "Per pushare l'immagine, esegui:"
    echo "  docker push ${WORKHUB_IMAGE}"
fi
echo ""
