FROM node:current-buster

USER root
RUN apt-get update && \
    apt-get install -y \
        curl && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

RUN curl -fsSL -o get_helm.sh https://raw.githubusercontent.com/helm/helm/master/scripts/get-helm-3 \
    && chmod +x get_helm.sh && ./get_helm.sh

ARG GCS_TOKEN=""
ARG GCS_REGCRED=""
ARG GCS_REPO=""
ARG GCS_PROXY_HOST_NAME=""
ARG GCS_PROXY_PORT=""

ENV GCS_TOKEN=$GCS_TOKEN
ENV GCS_REGCRED=$GCS_REGCRED
ENV GCS_REPO=$GCS_REPO
ENV GCS_PROXY_HOST_NAME=$GCS_PROXY_HOST_NAME
ENV GCS_PROXY_PORT=$GCS_PROXY_PORT

RUN helm plugin install https://github.com/hayorov/helm-gcs.git

COPY ./server.js /usr/bin/server.js

CMD ["node", "/usr/bin/server.js"]