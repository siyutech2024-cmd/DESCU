# Expire unpaid orders — scheduler step

`GET|POST /api/cron/expire-orders` (Bearer `CRON_SECRET`) cancels online orders that stayed
`pending_payment` past `expires_at` + 48 h and puts their products back on sale.

The GitHub Actions workflow `.github/workflows/auto-review.yml` runs hourly; add this step
after "Trigger Auto Review API" (the deploy token used for pushes lacks the `workflow`
scope, so this file has to be edited in the GitHub UI or pushed with a token that has it):

```yaml
      - name: Expire unpaid orders
        if: always()
        env:
          CRON_SECRET: ${{ secrets.CRON_SECRET }}
          API_URL: ${{ secrets.API_URL }}
        run: |
          URL="${API_URL:-https://descu.ai}/api/cron/expire-orders"
          response=$(curl -s -w "\n%{http_code}" -X POST "$URL" \
            -H "Authorization: Bearer $CRON_SECRET" \
            -H "Content-Type: application/json")
          http_code=$(echo "$response" | tail -n1)
          echo "Response: $(echo "$response" | sed '$d')"
          if [ "$http_code" -ge 200 ] && [ "$http_code" -lt 300 ]; then
            echo "✅ expire-orders completed"
          else
            echo "❌ expire-orders failed with HTTP $http_code"
            exit 1
          fi
```
