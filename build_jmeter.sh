#!/bin/bash

docker build -f Dockerfile-jmeter -t smarttuning/jmeter_daytrader .

docker push smarttuning/jmeter_daytrader
