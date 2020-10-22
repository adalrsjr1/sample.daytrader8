#!/bin/bash
# Point to the internal API server hostname
APISERVER=https://kubernetes.default.svc

# Path to ServiceAccount token
SERVICEACCOUNT=/var/run/secrets/kubernetes.io/serviceaccount

# Read this Pod's namespace
NAMESPACE=$(cat ${SERVICEACCOUNT}/namespace)

# Read the ServiceAccount bearer token
TOKEN=$(cat ${SERVICEACCOUNT}/token)

# Reference the internal certificate authority (CA)
CACERT=${SERVICEACCOUNT}/ca.crt

# Explore the API with TOKEN
RESTARTS=$(curl -s \
  --cacert ${CACERT} \
  --header "Authorization: Bearer ${TOKEN}" \
  -X GET ${APISERVER}/api/v1/namespaces/default/pods/$HOSTNAME | \
  grep -E ".*restartCount.*[1-9]" | \
  head -n 1 | \
  cut -f 2 -d ':' | \
  cut -f 1 -d ',')

if [ -z "$RESTARTS" ]; then
  RESTARTS=0
fi

echo "restarts = $RESTARTS"
if [ "$RESTARTS" -gt 0 ]; then
  exit 1
else
  exit 0
fi
