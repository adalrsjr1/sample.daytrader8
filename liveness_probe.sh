#!/bin/bash

#echo "curl -s 'http://prometheus-service.kube-monitoring.svc.cluster.local:9090/api/v1/query' \
#  --data-urlencode 'query=sum(rate(smarttuning_http_requests_total{code=~\"[2|3]..\",namespace=\"default\", pod=~'"\"$(hostname)\""',name!~\".*POD.*\"}['"$1"'s]))')"

THRUPUT=$(curl -s 'http://prometheus-service.kube-monitoring.svc.cluster.local:9090/api/v1/query' \
  --data-urlencode 'query=sum(rate(smarttuning_http_requests_total{code=~"[2|3]..",namespace="default", pod=~'"\"$(hostname)\""',name!~".*POD.*"}['"$1"'s]))' | \
awk 'NR>1{print $1}' RS='[' FS=']' | \
tail -n 1 | \
awk 'NR>1{print $1}' RS='"' FS='"' | \
head -n 1)

if [ -z "$THRUPUT" ]; then
  echo "empty response: $THRUPUT"
  exit 0
else
  echo "thruput: $THRUPUT"
  exit $(awk 'BEGIN{ print "'$THRUPUT'"<="'$2'" }')
fi
