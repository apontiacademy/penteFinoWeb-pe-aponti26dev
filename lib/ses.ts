import { SESv2Client } from '@aws-sdk/client-sesv2'

export function createSesClient() {
  return new SESv2Client({ region: process.env.AWS_REGION })
}
