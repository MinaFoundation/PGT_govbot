# govbot

A discord bot for collective decision making, with the goal of being both _effective_, and _aligned_.

Some principles it follows:

_aligned_

- Decisions aren't enacted without the approval and input of the community they impact.

_effective_

- Decisions pull in the expertise of the community and relevant subject-matter-experts.

It is primarily for the Mina protocol community, but is intended to eventually be possible to deploy for other communities too.

See documentation on the plan for this [here](https://docs.google.com/document/d/1aNGYqRoUVXtOw8aef9mSQHHSIvG2thnrxMw7FCB_AhM/edit).

## Instructions

1. Clone the repo
2. Run `npm install`
3. Create a `.env` file in the root directory with the following variables:

```
# Discord Bot Configuration
DISCORD_TOKEN=your_discord_bot_token
CLIENT_ID=your_client_id (A.K.A. application id)
GUILD_ID=your_guild_id (A.K.A. server id)
PUBLIC_KEY=your_apps_public_key

# JWT Configuration for Login
JWT_PRIVATE_KEY_RS512=your_private_key
JWT_PUBLIC_KEY_RS512=your_public_key
# The keys should be in PEM format and include the BEGIN/END headers

# MEF Connection Configuration
MEF_FE_BASE_URL=http://your-mef-instance-url
# The URL where your MEF instance is hosted. This is used for generating login links.
# For staging environment, use: http://pgt-staging.minaprotocol.network

# Login Forum Configuration
LOGIN_FORUM_CHANNEL_ID=your_forum_channel_id
# The Discord forum channel ID where the "Login to MEF" interface will be displayed.
# If not set, defaults to: 1301096522452303894
# The bot will create a thread titled "Login to MEF" in this forum channel,
# containing a button that users can click to receive a secure, 30-second login link.

# Logging Configuration
GSS_LOG_LEVEL=DEBUG
# Available values: ERROR, WARN, INFO, DEBUG
# Set to DEBUG for detailed logging during development
```

4. Run `npm run dev` to start the bot in development mode

## Checking For Required Channels

In order to check if the required channels have been created on your server, you can run the following command:

```
npm run manage checkChannels
```

## Adding Admins

In order to add an admin to the bot, you can run the following command:

```
npm run manage addAdmin [discord_user_id]
```

## Container Support

The bot can be run using either Docker or Podman. Both methods use the same configuration files.

### Using Docker

Build and run:
```bash
# Build the image
docker build -t govbot:latest .

# Run with environment variables
docker run -it -d --env-file ./.env govbot:latest

# Run with docker-compose
docker-compose up --build -d

# View logs
docker logs -f pgt_govbot_bot_1

# Stop and remove containers
docker-compose down
```

### Using Podman

Build and run:
```bash
# Build and start with podman-compose
podman-compose -f docker-compose.yaml up --build -d

# View logs
podman logs -f pgt_govbot_bot_1

# Stop and remove containers
podman-compose -f docker-compose.yaml down
```

Note: The docker-compose.yaml file is compatible with both Docker and Podman.

## Login to MEF Functionality

The bot provides a "Login to MEF" interface in a designated forum channel. Here's how it works:

1. The bot creates a thread titled "Login to MEF" in the specified forum channel
2. The thread contains a button that users can click to receive a secure login link
3. Login links are ephemeral (only visible to the requesting user) and expire after 30 seconds
4. The forum channel can be configured using the `LOGIN_FORUM_CHANNEL_ID` environment variable
5. Login tokens are signed using RS512 algorithm with the configured JWT keys

To change the forum channel:
1. Create a new forum channel in your Discord server
2. Copy the channel ID (Right-click > Copy ID)
3. Set `LOGIN_FORUM_CHANNEL_ID` in your .env file to the new channel ID
4. Restart the bot

## Contributions

To make a contribution, follow these steps:

1. Make an issue that includes a user story for what the user should be able to do.
2. Get that issue tested by: es92, Remigiusz-antczak or Cristina Echeverry.
3. Get that issue approved by the product owners: es92, Remigiusz-antczak or Cristina Echeverry.
4. Write a PR and get it approved by the code owners and Mina devops: Es92, illya (developer), johnmarcou (Mina devops). Each PR must correspond to an approved issue. By default, PRs should be merged by the PR submitter, though in some cases if changes are needed, they can be merged by code owners.
