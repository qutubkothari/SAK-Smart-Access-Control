#!/bin/bash
curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"its_id":"ITS000001","password":"Admin123!"}'
