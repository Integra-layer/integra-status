Deployment checklist for integra-status (EC2 standalone):

1. Verify all health endpoints in `lib/health-config.ts`
2. Test locally: `npm run build && node .next/standalone/server.js`
3. Type-check: `npx tsc --noEmit`
4. Push to git: `git push origin main`
5. SSH to EC2: `ssh -i ~/.ssh/integra-validator-key.pem ubuntu@3.92.110.107`
6. On EC2:
   ```
   cd /path/to/integra-status
   git pull
   npm run build
   sudo systemctl restart integra-status
   ```

Verify the deployment is live and all checks pass:
- `curl -s https://status.integralayer.com/api/health | jq '.up, .down'`
