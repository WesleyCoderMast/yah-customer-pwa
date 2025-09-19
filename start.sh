#!/bin/bash
export NODE_ENV=production
node dist/index.js

stripe listen --forward-to localhost:5000/api/stripe/webhook