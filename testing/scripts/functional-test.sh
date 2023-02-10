#!/bin/bash
set -e

export ENV_FILE=.env.testing

npm run build:prepare
npm run build

npm run test:testing -- $@
