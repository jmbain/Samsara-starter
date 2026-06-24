locals {
  # All 15 Samsara entity slugs with their retention periods in days.
  # Retention values reflect data sensitivity and operational cadence:
  #   - high-frequency telemetry (GPS, engine, fuel): 7 days
  #   - event/compliance data (geofence, route, driver, HOS): 14–30 days
  entity_slugs = {
    "gps-locations"         = 7
    "engine-states"         = 7
    "odometer-obd"          = 7
    "odometer-gps"          = 7
    "geofence-events"       = 14
    "route-events"          = 14
    "vehicle-events"        = 14
    "driver-events"         = 14
    "driver-vehicle-roster" = 14
    "driver-hos-logs"       = 30
    "engine-hours"          = 7
    "fuel-levels"           = 7
    "fault-codes"           = 7
    "dvir-events"           = 14
    "safety-events"         = 14
  }

  # Flatten customers × entity_slugs into a single map keyed by "{customerId}__{slug}".
  # This allows for_each to create one confluent_kafka_topic resource per combination.
  topics = {
    for pair in flatten([
      for cid, _ in var.customers : [
        for slug, days in local.entity_slugs : {
          key   = "${cid}__${slug}"
          topic = "samsara.${cid}.${slug}"
          days  = days
        }
      ]
    ]) : pair.key => pair
  }
}

resource "confluent_kafka_topic" "this" {
  for_each = local.topics

  topic_name       = each.value.topic
  partitions_count = 6

  config = {
    "cleanup.policy"  = "delete"
    "retention.ms"    = tostring(each.value.days * 86400000)
    "retention.bytes" = "-1"
  }

  rest_endpoint = data.confluent_kafka_cluster.this.rest_endpoint
  kafka_cluster { id = data.confluent_kafka_cluster.this.id }

  credentials {
    key    = local.kafka_api_key
    secret = local.kafka_api_secret
  }
}
