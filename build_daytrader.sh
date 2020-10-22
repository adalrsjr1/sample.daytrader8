#!/bin/bash

mvn package
docker build -f Dockerfile-daytrader -t smarttuning/daytrader8 .
docker build -f Dockerfile-daytrader-k8s -t smarttuning/daytrader8-k8s .

docker push smarttuning/daytrader8-k8s
