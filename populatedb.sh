#!/bin/bash

# create if not exists and populate the DB

# set -ex

URL=${URL:-"http://localhost:9080/daytrader/config?action="}

SUCCESS_MSG="DayTrader tables successfully created!"

curl -v --silent "${URL}buildDBTables" 2>&1 | grep "$SUCCESS_MSG" > /dev/null
if [[ $? -ne 0 ]]; then
    echo "Daytrader tables couldn't be created!"
    exit
fi

echo "$SUCCESS_MSG"

SUCCESS_MSG="DayTrader Database Built"

curl -v --silent "${URL}buildDB" 2>&1 | grep "$SUCCESS_MSG" > /dev/null
if [[ $? -ne 0 ]]; then
    echo "Daytrader tables couldn't be populated!"
    exit
fi

echo "$SUCCESS_MSG"


