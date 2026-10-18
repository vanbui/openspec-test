# midPoint 4.8.14 LTS with the Provision IAM (Exclamation Labs) SCIM2 connector
# built from source. See docs/adr/0006-midpoint-lts-and-community-scim2-connector.md.
#
# Build context: docker/midpoint (compose builds it as the midpoint_init and
# midpoint_server image). Nothing built here is committed to the repository.

# --- Stage 1: build the connector bundle from the pinned tag -------------------
# The connector's Gradle 7.2 wrapper needs a JDK no newer than 16.
FROM gradle:7.2-jdk11 AS connector

ARG SCIM2_CONNECTOR_TAG=V1.2.9
ARG SCIM2_CONNECTOR_COMMIT=05c404bbecf9c28938e2183411c7b04b4f8f4226

# The bundle name (and so midPoint's connector namespace) comes from the clone
# directory name, so it must stay "connector-scim2".
WORKDIR /src
RUN git clone --quiet --depth 1 --branch "${SCIM2_CONNECTOR_TAG}" \
      https://github.com/ExclamationLabs/connector-scim2.git connector-scim2 \
 && test "$(git -C connector-scim2 rev-parse HEAD)" = "${SCIM2_CONNECTOR_COMMIT}"

WORKDIR /src/connector-scim2
# BUILD_NUMBER fixes the otherwise time-derived artefact suffix. The tag's
# build.gradle resolves some dependencies with dynamic "-+" versions, so the
# resolved runtime classpath is recorded next to the bundle as provenance.
RUN BUILD_NUMBER=0 gradle --no-daemon --quiet fatJar -x test \
 && mkdir -p /out \
 && cp build/libs/connector-scim2-1.2.9-0-fat.jar /out/ \
 && gradle --no-daemon --quiet dependencies --configuration runtimeClasspath > /out/runtime-classpath.txt \
 && git rev-parse HEAD > /out/source-commit.txt

# --- Stage 2: midPoint runtime ------------------------------------------------
FROM evolveum/midpoint:4.8.14-alpine

# psql lets init.sh probe the repository and audit schemas directly.
RUN apk add --no-cache postgresql16-client

# Kept outside /opt/midpoint/var (the midpoint_home volume), so a reused volume
# cannot hide a rebuilt bundle: docker/midpoint/init.sh copies it into
# var/connid-connectors on every start.
COPY --from=connector /out/ /opt/midpoint/connector-bundle/
COPY init.sh /opt/midpoint/bin/idambox-init.sh
COPY render.sh /opt/midpoint/bin/idambox-render.sh
RUN chmod 0755 /opt/midpoint/bin/idambox-init.sh /opt/midpoint/bin/idambox-render.sh
