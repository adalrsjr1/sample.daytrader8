#!/bin/bash

jmeter -n \
  -Dprometheus.ip=0.0.0.0
  -DusePureIDs=true \
  -t $JMETER_HOME/daytrader8.jmx \
  -JTOPUID=$JTOPUID \
  -JHOST=$JHOST \
  -JPORT=$JPORT \
  -JRATIO=$JRATIO \
  -JTHREADS=$JTHREADS \
  -JRAMP=$JRAMP \
  -JMAXTHINKTIME=$JMAXTHINKTIME \
  -JSTOCKS=$JSTOCKS \
  -JDURATION=$JDURATION \
  -JQUOTES=$JQUOTES \
  -JSELLS=$JSELLS \
  -JBUYS=$JBUYS \
  -JWAIT_RESP=$JWAIT_RESP
