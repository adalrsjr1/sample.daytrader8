#!/bin/bash

docker build -f Dockerfile-jmeter -t smarttuning/jmeter_daytrader .
docker build -f Dockerfile-dynamic_jmeter -t smarttuning/dynamic_jmeter_daytrader .

docker push smarttuning/jmeter_daytrader
docker push smarttuning/dynamic_jmeter_daytrader
