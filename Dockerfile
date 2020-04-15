FROM maven:3-jdk-11-openj9 as build


COPY pom.xml /opt/daytrader8/pom.xml
COPY src/ /opt/daytrader8/src/
COPY resources/ /opt/daytrader8/resources/

WORKDIR /opt/daytrader8

RUN ls -lha && mvn clean package

FROM open-liberty:20.0.0.3-full-java8-openj9

USER root
RUN apt-get update && \
    apt-get install -y --no-install-recommends curl iputils-ping less net-tools && \
    rm -rf /var/lib/apt/lists/*

COPY --from=build --chown=1001:0 /opt/daytrader8/target/liberty/wlp/usr/shared/resources/ /opt/ol/wlp/usr/shared/resources/
COPY --from=build --chown=1001:0 /opt/daytrader8/src/main/liberty/config/server.xml /config/server.xml
COPY --from=build --chown=1001:0 /opt/daytrader8/target/io.openliberty.sample.daytrader8.war /config/apps

ENV MAX_QUOTES=1000 \
    MAX_USERS=500

EXPOSE 9080 9443

USER 1001

RUN /opt/ol/wlp/bin/server start && \
    /opt/ol/wlp/bin/server stop && \
    rm -rf /output/messaging logs/* $WLP_OUTPUT_DIR/.classCache && chmod -R g+rwx /opt/ol/wlp/output/*

