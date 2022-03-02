# Install dependencies only when needed
FROM public.ecr.aws/bitnami/node:16-prod AS deps
WORKDIR /app
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

# Rebuild the source code only when needed
FROM public.ecr.aws/bitnami/node:16-prod AS builder
ARG ENV_VARS
ENV ENV_VARS ${ENV_VARS}
WORKDIR /app
COPY . .
COPY --from=deps /app/node_modules ./node_modules
RUN yarn build && yarn install --production --ignore-scripts --prefer-offline

# Production image, copy all the files and run next
FROM public.ecr.aws/bitnami/node:16-prod AS runner
WORKDIR /app

ENV NODE_ENV production


RUN addgroup --gid 1001 --system nodejs
RUN adduser --system nextjs --uid 1001

# You only need to copy next.config.js if you are NOT using the default configuration
# COPY --from=builder /app/next.config.js ./
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/.env ./.env

ARG BRANCH_NAME 
ENV DD_VERSION ${BRANCH_NAME}

USER nextjs

RUN yarn global add pm2

EXPOSE 3000

# Next.js collects completely anonymous telemetry data about general usage.
# Learn more here: https://nextjs.org/telemetry
# Uncomment the following line in case you want to disable telemetry.
# ENV NEXT_TELEMETRY_DISABLED 1

CMD "pm2-runime start npm --name 'web-client' -- start"