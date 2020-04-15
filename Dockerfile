FROM open-liberty:20.0.0.3-full-java8-openj9

USER root
RUN apt-get update && \
    apt-get install -y --no-install-recommends curl iputils-ping less net-tools && \
    rm -rf /var/lib/apt/lists/*

COPY --chown=1001:0 src/main/liberty/config/server.xml /config/server.xml
COPY --chown=1001:0 target/io.openliberty.sample.daytrader8.war /config/apps
COPY --chown=1001:0 target/liberty/wlp/usr/shared/resources /opt/ol/wlp/usr/shared/resources

ENV MAX_QUOTES=1000 \
    MAX_USERS=500 \
    DB_ADDRESS=derby \
    DB_PORT=1527

EXPOSE 9080 9443

USER 1001

RUN /opt/ol/wlp/bin/server start && \
    /opt/ol/wlp/bin/server stop && \
    rm -rf /output/messaging logs/* $WLP_OUTPUT_DIR/.classCache && chmod -R g+rwx /opt/ol/wlp/output/*

