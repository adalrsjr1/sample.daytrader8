#!/bin/bash

mvn package
docker build -t daytrader8 .
