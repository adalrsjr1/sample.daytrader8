#!/bin/bash

docker build -f Dockerfile-DB2 -t smarttuning/db2 .
docker push smarttuning/db2
