#!/bin/bash

docker build -f Dockerfile-Derby -t smarttuning/derby .
docker push smarttuning/derby
