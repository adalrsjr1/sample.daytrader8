#!/bin/bash

mvn package
docker build -f Dockerfile-daytrader-k8s-db2 -t smarttuning/daytrader8-db2 .
docker build -f Dockerfile-daytrader-k8s-derby -t smarttuning/daytrader8-derby .
docker build -f Dockerfile-daytrader-k8s-embd -t smarttuning/daytrader8-embd .

docker push smarttuning/daytrader8-db2
docker push smarttuning/daytrader8-derby
docker push smarttuning/daytrader8-embd
