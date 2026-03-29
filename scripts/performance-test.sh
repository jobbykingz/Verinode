#!/bin/bash

TARGET=${1:-"http://localhost:4000"}
DURATION=${2:-"30s"}
VUS=${3:-10}

echo "Running performance test against $TARGET"
echo "Duration: $DURATION, Virtual Users: $VUS"

# Check if k6 is installed
if command -v k6 &> /dev/null; then
    k6 run - <(cat <<EOF
import http from 'k6/http';
import { sleep, check } from 'k6';
export let options = {
  vus: $VUS,
  duration: '$DURATION',
};
export default function () {
  let res = http.get('$TARGET');
  check(res, { 'status was 200': (r) => r.status == 200 });
  sleep(1);
}
EOF
)
else
    echo "k6 not installed. Using Apache Bench (ab) fallback..."
    # Fallback to ab if available, or just curl
    if command -v ab &> /dev/null; then
        ab -n 100 -c 10 $TARGET/health
    else
        echo "No load testing tool found. Running simple curl check."
        for i in {1..10}; do curl -s -o /dev/null -w "%{http_code}" $TARGET; echo; done
    fi
fi